"""Decolourise the factory-coloured pages, paint them again, and score every conductor.

    python -m wirecolor.tools.teacher_bench --pages pages.json --out workspaces/teacher

``pages.json`` is a list of ``{"pdf": path, "page": 1-based number, "publication": id}``. Pages of
one publication share one palette atlas, learned from the printed codes on all of them.

This is the conductor-level benchmark of :mod:`wirecolor.eval.teacher`: where the reviewer-mark
benchmark asserts a few hundred points, this one asserts the colour of every conductor the factory
painted. The twin, the overlay and the scores are written to ``--out``; the source PDFs are only
read.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import time


def _paint_with(engine_src: str, twin_pdf: Path, out_dir: Path, overlay: Path) -> dict:
    """Paint with another source tree's engine, in its own interpreter, so the truth stays fixed.

    The twins and their ground truth are always built by this tree; only the painter changes.
    That is what makes a baseline and a candidate comparable conductor by conductor.
    """
    import os
    import subprocess
    import sys

    # The other tree may predate this module, so the route logic travels with the call.
    import inspect

    script = ("import json, sys\nfrom pathlib import Path\n"
              + inspect.getsource(_paint).replace("from ..", "from wirecolor.")
              + "print('@@' + json.dumps(_paint(Path(sys.argv[1]), Path(sys.argv[2]), "
              "Path(sys.argv[3]))))\n")
    environment = dict(os.environ)
    paths = [engine_src] + [part for part in environment.get("PYTHONPATH", "").split(os.pathsep)
                            if part and not part.rstrip("/\\").endswith("src")]
    environment["PYTHONPATH"] = os.pathsep.join(paths)
    completed = subprocess.run([sys.executable, "-c", script, str(twin_pdf), str(out_dir),
                                str(overlay)], capture_output=True, text=True, env=environment)
    for line in completed.stdout.splitlines():
        if line.startswith("@@"):
            return json.loads(line[2:])
    raise RuntimeError(f"engine at {engine_src} failed: {completed.stderr[-400:]}")


def _paint(twin_pdf: Path, out_dir: Path, overlay: Path) -> dict:
    """Paint page 0 of the twin through the route the web service would choose."""
    from ..tools.paint_raster import paint_page as paint_raster_page
    from ..tools.paint_vector import paint_page as paint_vector_page
    from ..web_service import _select_convention

    convention_name, confidence = _select_convention(twin_pdf, 0, "auto")
    report = {"declined": True, "runs": 0, "runs_painted": 0, "legends": 0}
    route = "vector"
    if confidence != "low":
        report = paint_vector_page(str(twin_pdf), 0, str(out_dir), convention_name=convention_name,
                                   paint_dpi=720, paint_pixel_budget=60_000_000,
                                   overlay_path=str(overlay))
    if report.get("declined") or (report.get("runs_painted") == 0 and report.get("legends") == 0):
        route = "raster"
        report = paint_raster_page(str(twin_pdf), 0, str(out_dir), convention_name="auto",
                                   paint_pixel_budget=60_000_000, overlay_path=str(overlay))
        convention_name = report.get("convention") or convention_name
    gate = report.get("v2") or {}
    released = not report.get("declined") and gate.get("passed", True) and overlay.is_file()
    return {"route": route, "convention": convention_name, "confidence": confidence,
            "released": bool(released),
            "reason": str(report.get("decline_reason") or ("" if released else "not released")),
            "legends": report.get("legends"), "runs_painted": report.get("runs_painted")}


def rasterised(document, dpi: int, seed: str = ""):
    """The twin as a scan: one grey page image, no text layer, no vector ink.

    A light blur and grain stand in for the scanner. The page keeps its size and rotation, so the
    painted overlay lands in the frame the truth is scored in.
    """
    import hashlib

    import fitz
    import numpy as np

    rng = np.random.default_rng(int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16))
    out = fitz.open()
    for page in document:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(dpi / 72.0, dpi / 72.0),
                                 colorspace=fitz.csGRAY, alpha=False)
        gray = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
            pixmap.height, pixmap.stride)[:, :pixmap.width].astype(np.float32)
        import cv2

        gray = cv2.GaussianBlur(gray, (0, 0), 0.6)
        gray = np.clip(gray + rng.normal(0.0, 6.0, gray.shape), 0, 255).astype(np.uint8)
        ok, png = cv2.imencode(".png", gray)
        target = out.new_page(width=page.rect.width, height=page.rect.height)
        target.insert_image(target.rect, stream=png.tobytes())
    return out


def run(pages: list, out_dir: Path, keep_overlays: bool = False,
        engine_src: str | None = None, twins_only: bool = False,
        raster_dpi: int | None = None, rescore: bool = False) -> dict:
    import fitz
    import numpy as np
    from PIL import Image

    from ..eval.teacher import (build_atlas, build_twin, displayed_conductors, harvest_page,
                                legend_votes,
                                mark_printed_conflicts, resolve_tokens, score_overlay,
                                summarise_scores)
    from ..labels.conventions import load_convention
    from ..labels.text_layer import read_legends, strong_legends

    Image.MAX_IMAGE_PIXELS = None
    out_dir.mkdir(parents=True, exist_ok=True)
    # A rescore judges the overlays an earlier run kept against the truth this tree builds now,
    # so a change to the ruler is measured on identical paint without repainting.
    earlier = {}
    if rescore:
        report = json.loads((out_dir / "teacher_benchmark.json").read_text(encoding="utf-8"))
        earlier = {(str(record["publication"]), int(record["page"])): record.get("paint")
                   for record in report["pages"]}
    convention = load_convention("volvo_classic")
    started = time.time()

    by_publication = defaultdict(list)
    for entry in pages:
        by_publication[str(entry["publication"])].append(entry)

    reports, atlases = [], {}
    for publication, entries in by_publication.items():
        harvested, votes = [], Counter()
        for entry in entries:
            document = fitz.open(entry["pdf"])
            page = document[int(entry["page"]) - 1]
            harvest = harvest_page(page)
            legends = strong_legends(read_legends(page, 72, convention))
            votes += legend_votes(harvest.conductors, legends)
            harvested.append((entry, document, page, harvest, legends))
        atlas = build_atlas(votes)
        atlases[publication] = {"|".join(map(str, rgb)): value for rgb, value in atlas.items()}

        for entry, document, page, harvest, legends in harvested:
            tag = f"pub{publication}_p{entry['page']}"
            print(f"  {tag}: {len(harvest.conductors)} conductors", flush=True)
            record = {"publication": publication, "page": int(entry["page"]),
                      "pdf": str(entry["pdf"]), "conductors": len(harvest.conductors),
                      "rail_pairs": harvest.rail_pairs, "tracers": harvest.tracers}
            try:
                resolve_tokens(harvest.conductors, atlas, convention)
                record["factory_conflicts"] = mark_printed_conflicts(
                    harvest.conductors, legends, convention)
                overlay = out_dir / f"{tag}_overlay.png"
                if rescore:
                    painted = earlier.get((publication, int(entry["page"])))
                    if painted is None:
                        raise RuntimeError("the earlier run has no paint record for this page")
                else:
                    twin_doc = fitz.open()
                    build_twin(page, harvest, twin_doc)
                    twin_pdf = out_dir / f"{tag}_twin.pdf"
                    if raster_dpi:
                        twin_doc = rasterised(twin_doc, raster_dpi, seed=f"{tag}")
                    twin_doc.save(twin_pdf)
                    twin_doc.close()
                    if twins_only:
                        reports.append(record)
                        continue
                    painted = (_paint_with(engine_src, twin_pdf, out_dir, overlay) if engine_src
                               else _paint(twin_pdf, out_dir, overlay))
                record["paint"] = painted
                if painted["released"]:
                    rgba = np.array(Image.open(overlay).convert("RGBA"))
                else:
                    rgba = np.zeros((int(page.rect.height), int(page.rect.width), 4),
                                    dtype=np.uint8)
                results, paint_stats = score_overlay(rgba, page.rect,
                                                     displayed_conductors(harvest.conductors, page),
                                                     convention)
                record["summary"] = summarise_scores(results, paint_stats)
                record["conductor_scores"] = [result.__dict__ for result in results]
                if not keep_overlays and not rescore:
                    overlay.unlink(missing_ok=True)
            except Exception as error:                  # one bad page never stops a benchmark
                record["error"] = f"{type(error).__name__}: {error}"
            reports.append(record)
            summary = record.get("summary") or {}
            print(f"    {record.get('paint', {}).get('route')} "
                  f"released={record.get('paint', {}).get('released')} "
                  f"coverage={summary.get('coverage')} precision="
                  f"{summary.get('exact_colour_precision')} stray="
                  f"{summary.get('stray_paint_fraction')} {record.get('error', '')}", flush=True)
        for _entry, document, _page, _harvest, _legends in harvested:
            document.close()

    payload = {
        "schema": "pintor-teacher-benchmark-v1",
        "seconds": round(time.time() - started, 1),
        "summary": aggregate(reports),
        "atlases": atlases,
        "pages": reports,
    }
    name = "teacher_benchmark_rescored.json" if rescore else "teacher_benchmark.json"
    (out_dir / name).write_text(json.dumps(payload, indent=1), encoding="utf-8")
    return payload


def aggregate(reports: list) -> dict:
    """Micro totals over every scored conductor, and the macro mean over publications."""
    verdicts, length = Counter(), Counter()
    per_publication = defaultdict(Counter)
    for record in reports:
        for result in record.get("conductor_scores", ()):
            verdict = result["verdict"]
            verdicts[verdict] += 1
            length[verdict] += result["length_pt"]
            per_publication[record["publication"]][verdict] += 1
    scored = verdicts["right"] + verdicts["wrong"] + verdicts["missed"]

    def coverage(counts):
        total = counts["right"] + counts["wrong"] + counts["missed"]
        return counts["right"] / total if total else None

    macro = [value for value in (coverage(counts) for counts in per_publication.values())
             if value is not None]
    return {
        "pages": len(reports),
        "pages_released": sum(1 for record in reports
                              if record.get("paint", {}).get("released")),
        "conductors": dict(verdicts),
        "coverage": round(verdicts["right"] / scored, 4) if scored else 0.0,
        "coverage_by_length": round(length["right"] / sum(
            length[key] for key in ("right", "wrong", "missed")), 4) if scored else 0.0,
        "exact_colour_precision": round(
            verdicts["right"] / (verdicts["right"] + verdicts["wrong"]), 4)
        if verdicts["right"] + verdicts["wrong"] else None,
        "publication_macro_coverage": round(sum(macro) / len(macro), 4) if macro else 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", required=True, help="JSON list of {pdf, page, publication}")
    parser.add_argument("--out", required=True, help="directory for twins and the report")
    parser.add_argument("--keep-overlays", action="store_true")
    parser.add_argument("--raster-dpi", type=int, default=None,
                        help="turn each twin into an image-only scan at this resolution")
    parser.add_argument("--rescore", action="store_true",
                        help="judge the overlays kept in --out against the current truth, "
                             "without painting; writes teacher_benchmark_rescored.json")
    parser.add_argument("--twins-only", action="store_true",
                        help="build the twins and stop: input for teacher_policy_sweep")
    parser.add_argument("--engine-src", default=None,
                        help="paint with the wirecolor package under this src directory instead")
    args = parser.parse_args()
    pages = json.loads(Path(args.pages).read_text(encoding="utf-8"))
    payload = run(pages, Path(args.out), keep_overlays=args.keep_overlays,
                  engine_src=args.engine_src, twins_only=args.twins_only,
                  raster_dpi=args.raster_dpi, rescore=args.rescore)
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    main()
