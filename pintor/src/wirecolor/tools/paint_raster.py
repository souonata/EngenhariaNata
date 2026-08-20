"""Paint one rasterized wiring page with OCR and conservative pixel topology.

This is the production wrapper around the older raster analysis pipeline.  It deliberately keeps
the web contract identical to the vector painter: the source PDF is copied byte-for-byte, colour
is appended in a removable optional-content group, and V2/V7 must pass before the caller may
release the result.
"""
from __future__ import annotations

import json
import math
import os
import time


MIN_OCR_SCORE = 0.80


def _union_convention():
    """Closed vocabulary used only for one convention-neutral OCR sweep."""
    from ..labels.conventions import Convention, list_conventions, load_convention

    loaded = [load_convention(name) for name in list_conventions()]
    colours = {}
    for convention in loaded:
        for code, colour in convention.colors_bgr.items():
            previous = colours.setdefault(code, colour)
            if previous != colour:
                raise ValueError(f"colour code {code!r} is ambiguous across conventions")
    return Convention(
        name="auto_union",
        codes=frozenset(colours),
        colors_bgr=colours,
        white_token="__NO_AUTO_WHITE__",
        all_white_token="__NO_AUTO_WHITE__",
        distinctive=frozenset().union(*(item.distinctive for item in loaded)),
        excluded_from_evidence=frozenset(),
        shared=frozenset().union(*(item.shared for item in loaded)),
        grammars=tuple(dict.fromkeys(grammar for item in loaded for grammar in item.grammars)),
        two_color_sep="/",
    )


def _score_conventions(labels: list[dict]) -> tuple[str | None, str, list[dict]]:
    from ..labels.conventions import list_conventions, load_convention

    # Convention selection is a document-level decision.  Weak one-off OCR reads must never pick
    # the colour vocabulary for the whole page; an uncertain page asks the user to confirm it.
    labels = [label for label in labels if float(label.get("score", 0.0)) >= MIN_OCR_SCORE]
    ranked = []
    for name in list_conventions():
        convention = load_convention(name)
        matching = [label for label in labels
                    if all(part in convention.codes for part in label["code"].split("/"))]
        distinctive = sum(
            any(part in convention.distinctive for part in label["code"].split("/"))
            for label in matching
        )
        ranked.append((len(matching) + 3 * distinctive, len(matching), name, matching))
    ranked.sort(key=lambda row: (row[0], row[1], row[2]), reverse=True)
    if not ranked or ranked[0][0] == 0:
        return None, "low", []
    best = ranked[0]
    runner_score = ranked[1][0] if len(ranked) > 1 else 0
    confidence = "high" if best[1] >= 2 and best[0] >= 5 \
        and best[0] >= runner_score + 3 else "low"
    return best[2], confidence, best[3]


def _recognise_page_labels(image_path: str, labels_path: str, harvest_path: str,
                           requested: str) -> tuple[str | None, str, int]:
    """Run OCR once, then select/filter the colour-code convention without rereading the page."""
    from ..labels.conventions import list_conventions, load_convention
    from ..labels.harvest import harvest_labels

    if requested != "auto" and requested not in list_conventions():
        raise ValueError("unknown colour-code convention")
    reading_convention = _union_convention() if requested == "auto" else load_convention(requested)
    harvested = harvest_labels(image_path, reading_convention)
    labels = [label for label in harvested.get("labels", [])
              if float(label.get("score", 0.0)) >= MIN_OCR_SCORE]
    if requested == "auto":
        selected, confidence, labels = _score_conventions(labels)
    else:
        selected, confidence = requested, "user-selected"
        convention = load_convention(selected)
        labels = [label for label in labels
                  if all(part in convention.codes for part in label["code"].split("/"))]

    payload = {"image": harvested.get("image", []), "labels": labels}
    for path in (labels_path, harvest_path):
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle)
    return selected, confidence, len(labels)


def _canvas_size(meta: dict, pixel_budget: int) -> tuple[int, int]:
    from ..prep import native_canvas_size

    width, height = native_canvas_size(meta)
    pixels = width * height
    if pixels <= pixel_budget:
        return width, height
    scale = math.sqrt(pixel_budget / float(pixels))
    width, height = max(1, math.floor(width * scale)), max(1, math.floor(height * scale))
    while width * height > pixel_budget:
        if width >= height:
            width -= 1
        else:
            height -= 1
    # Analysis and painting have separate budgets: a 200-DPI A0 analysis is about 66 Mpx, while
    # its sparse overlay is capped at 60 Mpx.  A small downscale here is safe because topology has
    # already been solved on the working raster and the transform preserves page alignment.
    return width, height


def paint_page(pdf_path: str, page_index: int, out_dir: str, convention_name: str = "auto",
               paint_pixel_budget: int = 60_000_000) -> dict:
    """Analyse, paint, and verify one raster or image-only page."""
    import cv2

    from ..instrument import reset_for_tests
    from ..labels.conventions import load_convention
    from ..paint.raster_overlay import attach_overlay, build_overlay_rgba, render_native
    from ..pipeline import run_page
    from ..prep import Transform, render_working_png
    from ..profile import measure_sheet_profile
    from ..verify.validators import v2_protected_overlap, v7_preservation

    started = time.time()
    os.makedirs(out_dir, exist_ok=True)
    tag = f"{os.path.splitext(os.path.basename(pdf_path))[0][:40]}_p{page_index}_raster"
    work = os.path.join(out_dir, f"{tag}_work.png")
    labels_path = os.path.join(out_dir, f"{tag}_labels.json")
    harvest_path = os.path.join(out_dir, f"{tag}_harvest.json")
    reset_for_tests(
        ocr_cache=os.path.join(out_dir, f"{tag}_ocr_memo.json"),
        diag_dir=os.path.join(out_dir, f"{tag}_diag"),
    )

    meta = render_working_png(pdf_path, page_index, work)
    selected, confidence, label_count = _recognise_page_labels(
        work, labels_path, harvest_path, convention_name,
    )
    if selected is None or (convention_name == "auto" and confidence == "low"):
        return {
            "pdf": pdf_path,
            "page": page_index,
            "declined": True,
            "decline_reason": (
                "OCR could not identify the colour-code convention with enough confidence; "
                "select the convention explicitly and try again"
            ),
            "convention": selected,
            "convention_confidence": confidence,
            "labels": label_count,
            "runs": 0,
            "runs_painted": 0,
            "paint_rate": 0.0,
            "processing_mode": "raster-ocr",
            "seconds": round(time.time() - started, 1),
        }

    convention = load_convention(selected)
    solution = run_page(
        work, labels_path, convention, harvest_path=harvest_path,
        allow_splice_propagation=False,
    )
    profile = measure_sheet_profile(solution, meta)
    solid_claims = len(solution["solver"].get("claims", {}))
    dashed_claims = sum(len(solution["dgroups"][root]) for root in solution.get("dclaims", {}))
    if solid_claims + dashed_claims == 0:
        return {
            "pdf": pdf_path,
            "page": page_index,
            "declined": True,
            "decline_reason": (
                "OCR found a supported code profile, but no conductor could be assigned a colour "
                "safely; the page was left unchanged for review"
            ),
            "convention": selected,
            "convention_confidence": confidence,
            "labels": label_count,
            "runs": len(solution["segments"]),
            "runs_painted": 0,
            "paint_rate": 0.0,
            "processing_mode": "raster-ocr",
            "seconds": round(time.time() - started, 1),
        }

    width, height = _canvas_size(meta, paint_pixel_budget)
    transform = Transform(
        sx=width / float(meta["working_w"]),
        sy=height / float(meta["working_h"]),
    )
    native = render_native(pdf_path, page_index, width, height)
    rgba = build_overlay_rgba(solution, native, transform)
    del native
    if not cv2.countNonZero(rgba[:, :, 3]):
        raise RuntimeError("raster painter produced an empty overlay after safety knockouts")

    v2 = v2_protected_overlap(rgba, solution, transform)
    out_pdf = os.path.join(out_dir, f"{tag}_colored.pdf")
    stats = attach_overlay(pdf_path, out_pdf, page_index, rgba)
    v7 = v7_preservation(pdf_path, out_pdf, page_index, stats["ocg"])
    coverage = profile["coverage"]
    codes = sorted({
        "/".join(claim[1])
        for claim in solution["solver"].get("claims", {}).values()
    } | {
        "/".join(claim[1]) for claim in solution.get("dclaims", {}).values()
    })
    report = {
        "pdf": pdf_path,
        "page": page_index,
        "declined": False,
        "processing_mode": "raster-ocr",
        "convention": selected,
        "convention_confidence": confidence,
        "labels": label_count,
        "runs": len(solution["segments"]),
        "runs_painted": solid_claims + dashed_claims,
        "decision_abstentions": coverage.get("unresolved_roots", 0),
        "learned_abstentions": 0,
        "paint_rate": coverage.get("painted_ink_fraction", 0.0),
        "paint_dpi": round(72.0 * width / float(meta["page_w"])),
        "codes": codes,
        "v2": v2,
        "v7": v7,
        "out_pdf": out_pdf,
        "seconds": round(time.time() - started, 1),
    }
    with open(os.path.join(out_dir, f"{tag}_report.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=1)
    return report
