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


def _recognise_outlined_page(pdf_path: str, page_index: int, requested: str):
    """Select a convention from exact vector callouts over bitonal outlined-wire art."""
    from ..detect.outlined_wires import detect_outlined_wires
    from ..labels.conventions import list_conventions, load_convention

    names = [requested] if requested != "auto" else list_conventions()
    ranked = []
    for name in names:
        convention = load_convention(name)
        result = detect_outlined_wires(pdf_path, page_index, convention)
        if not result["exclusive"]:
            continue
        distinctive = sum(
            any(part in convention.distinctive
                for part in wire.code.split(convention.two_color_sep))
            for wire in result["wires"]
        )
        ranked.append((len(result["wires"]) + 3 * distinctive,
                       len(result["wires"]), name, result))
    ranked.sort(key=lambda row: (row[0], row[1], row[2]), reverse=True)
    if not ranked:
        return None
    if requested == "auto" and len(ranked) > 1 and ranked[0][:2] == ranked[1][:2]:
        return None
    _score, _count, name, result = ranked[0]
    return name, result


def _outlined_solution(convention, detection):
    """Minimal PageSolution for a page whose exact callouts cover every outlined cable."""
    return {
        "convention": convention,
        "segments": [],
        "solver": {"claims": {}, "mate": {}, "at_dot": {}, "dot_arcs": {}},
        "dgroups": {},
        "dclaims": {},
        "housings": [],
        "inline_components": [],
        "terminal_dots": frozenset(),
        "holes": [],
        "twist": frozenset(),
        "bridge_twist": frozenset(),
        "outlined_wires": detection["wires"],
        "semantic_exclusions": detection.get("callout_leaders", ()),
    }


def _semantic_callout_exclusions(pdf_path: str, page_index: int, requested: str):
    """Find annotation leaders for every raster path; unreadable metadata simply yields none."""
    from ..detect.outlined_wires import detect_callout_leaders
    from ..labels.conventions import list_conventions, load_convention

    names = [requested] if requested != "auto" else list_conventions()
    try:
        return detect_callout_leaders(
            pdf_path, page_index, [load_convention(name) for name in names])
    except (FileNotFoundError, OSError, RuntimeError, ValueError):
        # The ordinary raster route remains available for a valid image-only PDF with no vector
        # annotation layer.  Release safety still comes from the common semantic gate and V2/V7.
        return []


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
    from ..labels.conventions import (HOUSE_CONVENTION, colour_conflicts, list_conventions,
                                      load_convention)

    # Convention selection is a document-level decision, and the only decision that matters is
    # which *colours* the page gets. Two vocabularies that agree on every observed code are
    # interchangeable, so ranking them is enough and there is nothing for a reviewer to confirm.
    # The old rule demanded a score gap and called a narrow win "low", which declined whole pages
    # over an ambiguity that did not exist. Whether the evidence is *sufficient* is a separate
    # question, answered downstream by the production topology and the semantics gate, per
    # conductor rather than per page.
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
    # Score, then raw matches, then the house vocabulary ahead of an exact tie.
    ranked.sort(key=lambda row: (row[0], row[1], row[2] == HOUSE_CONVENTION, row[2]),
                reverse=True)
    if not ranked or ranked[0][0] == 0:
        return None, "low", []
    best = ranked[0]
    observed = {label["code"] for label in best[3]}
    rivals = [row[2] for row in ranked[1:] if row[1] > 0]
    ambiguous = bool(rivals) and bool(colour_conflicts([best[2], *rivals], observed))
    return best[2], "low" if ambiguous else "high", best[3]


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

    payload = {
        "image": harvested.get("image", []),
        "labels": labels,
        "ocr_scales": harvested.get("ocr_scales", []),
        "ocr_calls": harvested.get("ocr_calls", 0),
    }
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
               paint_pixel_budget: int = 60_000_000, overlay_path: str | None = None) -> dict:
    """Analyse, paint, and verify one raster or image-only page."""
    import cv2

    from ..engine.semantics import declined_analysis, enforce_raster_semantics
    from ..instrument import reset_for_tests
    from ..labels.conventions import load_convention
    from ..paint.raster_overlay import (
        attach_overlay, build_overlay_rgba, render_native, write_overlay_png,
    )
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
    outlined = _recognise_outlined_page(pdf_path, page_index, convention_name)
    if outlined is not None:
        selected, outlined_detection = outlined
        confidence = ("user-selected-exact-callouts" if convention_name != "auto"
                      else "exact-callouts")
        label_count = outlined_detection["pair_count"]
        convention = load_convention(selected)
        solution = _outlined_solution(convention, outlined_detection)
        profile = {"coverage": {
            "unresolved_roots": 0,
            "painted_ink_fraction": 1.0,
        }}
    else:
        selected, confidence, label_count = _recognise_page_labels(
            work, labels_path, harvest_path, convention_name,
        )
        if selected is None or (convention_name == "auto" and confidence == "low"):
            return {
                "pdf": pdf_path,
                "page": page_index,
                "declined": True,
                "decline_reason": (
                    "no readable colour code was found on this page"
                    if selected is None else
                    "the readable colour codes are claimed by two vocabularies that would paint "
                    "them differently, so no colour is safe to assert"
                ),
                "convention": selected,
                "convention_confidence": confidence,
                "labels": label_count,
                "runs": 0,
                "runs_painted": 0,
                "paint_rate": 0.0,
                "processing_mode": "raster-ocr",
                "engineering_semantics": declined_analysis(
                    "colour convention could not be established"),
                "seconds": round(time.time() - started, 1),
            }

        convention = load_convention(selected)
        solution = run_page(
            work, labels_path, convention, harvest_path=harvest_path,
            allow_splice_propagation=False,
        )
        solution["semantic_exclusions"] = _semantic_callout_exclusions(
            pdf_path, page_index, selected)
    solution, engineering_semantics = enforce_raster_semantics(solution, convention)
    if outlined is None:
        profile = measure_sheet_profile(solution, meta)
    solid_claims = len(solution["solver"].get("claims", {}))
    dashed_claims = sum(len(solution["dgroups"][root]) for root in solution.get("dclaims", {}))
    outlined_claims = len(solution.get("outlined_wires", ()))
    if solid_claims + dashed_claims + outlined_claims == 0:
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
            "engineering_semantics": engineering_semantics,
            "semantic_abstentions": engineering_semantics["semantic_abstentions"],
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
    if overlay_path:
        write_overlay_png(overlay_path, rgba)
        v7 = None
        out_pdf = None
    else:
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
        "processing_mode": ("hybrid-vector-callout-raster-outline"
                            if outlined_claims else "raster-ocr"),
        "convention": selected,
        "convention_confidence": confidence,
        "labels": label_count,
        "runs": len(solution["segments"]) + outlined_claims,
        "runs_painted": solid_claims + dashed_claims + outlined_claims,
        "outlined_wires_painted": outlined_claims,
        "decision_abstentions": coverage.get("unresolved_roots", 0),
        "learned_abstentions": 0,
        "semantic_abstentions": engineering_semantics["semantic_abstentions"],
        "paint_rate": coverage.get("painted_ink_fraction", 0.0),
        "paint_dpi": round(72.0 * width / float(meta["page_w"])),
        "codes": sorted(set(codes) | {
            wire.code if hasattr(wire, "code") else wire["code"]
            for wire in solution.get("outlined_wires", ())
        }),
        "coverage_metric": ("exact-outlined-callout-realization"
                            if outlined_claims else "painted-raster-ink"),
        "engineering_semantics": engineering_semantics,
        "v2": v2,
        "v7": v7,
        "out_pdf": out_pdf,
        "overlay_png": overlay_path,
        "seconds": round(time.time() - started, 1),
    }
    with open(os.path.join(out_dir, f"{tag}_report.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=1)
    return report
