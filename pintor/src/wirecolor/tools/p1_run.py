"""P1 runner: one pub page end-to-end through the native-resolution overlay path.

    python -m wirecolor.tools.p1_run --db library.sqlite3 --base D:/drawings --pub 2550 \
        [--page 0] [--workdir workspaces/p1] [--convention volvo_classic]

Steps: resolve the original PDF (read-only DB) -> working render (200 DPI) -> cached OCR
labels -> v1-frozen detection/solve -> native render -> band overlay RGBA -> attach as OCG
layer with incremental save -> validators V2 + V7 -> 2-page review PDF (colorized page, then
original page -- the pink-markup format).
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pub", type=int, required=True)
    ap.add_argument("--page", type=int, default=0)
    ap.add_argument("--workdir", default="/tmp/wirecolor_p1")
    ap.add_argument("--db", required=True)
    ap.add_argument("--base", required=True)
    ap.add_argument("--convention", default="volvo_classic")
    ap.add_argument("--harvest", action="store_true",
                    help="read the page's text once (multi-scale tiles) and answer every "
                         "contextual zoom from it instead of re-OCRing per wire")
    ap.add_argument("--analysis-only", action="store_true",
                    help="stop after detection/solve (writes the diagnostic dump, skips the "
                         "native render and the PDF) -- the fast loop for rule work")
    args = ap.parse_args()

    import cv2

    from ..detect.outlined_wires import detect_callout_leaders
    from ..engine.semantics import enforce_raster_semantics
    from ..labels.conventions import load_convention
    from ..paint.raster_overlay import attach_overlay, build_overlay_rgba, render_native
    from ..pipeline import run_page
    from ..prep import make_transform, native_canvas_size, render_working_png
    from ..verify.validators import v2_protected_overlap, v7_preservation

    os.makedirs(args.workdir, exist_ok=True)
    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    row = con.execute("SELECT local_path, title FROM publications WHERE id=?", (args.pub,)).fetchone()
    con.close()
    if not row:
        raise SystemExit(f"pub {args.pub} not found")
    pdf_path, title = os.path.join(args.base, row[0]), row[1]
    print(f"pub {args.pub} p{args.page}: {title}")

    tag = f"pub{args.pub}_p{args.page}"
    wpng = os.path.join(args.workdir, f"{tag}_work.png")
    meta_path = os.path.join(args.workdir, f"{tag}_meta.json")
    if not (os.path.exists(wpng) and os.path.exists(meta_path)):
        meta = render_working_png(pdf_path, args.page, wpng)
        json.dump(meta, open(meta_path, "w"))
    meta = json.load(open(meta_path))

    convention = load_convention(args.convention)
    labels_path = os.path.join(args.workdir, f"{tag}_labels.json")
    harvest_path = os.path.join(args.workdir, f"{tag}_harvest.json") if args.harvest else None
    solution = run_page(wpng, labels_path, convention, harvest_path=harvest_path)
    solution["semantic_exclusions"] = detect_callout_leaders(
        pdf_path, args.page, [convention])
    solution, engineering_semantics = enforce_raster_semantics(solution, convention)

    # Observation only: record what this drawing does (dash rhythm, legend offset, code census)
    # so the corpus can build priors and flag a sheet whose style sits outside them.
    from ..profile import measure_sheet_profile, save_profile
    profile = measure_sheet_profile(solution, meta)
    profile_path = save_profile(profile, os.path.join(args.workdir, f"{tag}_profile.json"))
    rhythm = profile["dash_rhythm"]
    print(f"profile -> {profile_path} (dash pitch {rhythm['pitch']} / stroke {rhythm['stroke']} "
          f"from {rhythm['periods_measured']} periods)")
    print(f"engineering semantics -> {engineering_semantics['page_grammar']}; "
          f"{engineering_semantics['approved_claims']} approved, "
          f"{engineering_semantics['abstained_claim_count']} abstained")

    if args.analysis_only:
        print(f"analysis-only: {len(solution['segments'])} arcs, "
              f"{len(solution['solver']['claims'])} solid claims, "
              f"{len(solution['dgroups'])} dashed routes")
        raise SystemExit(0)

    nw, nh = native_canvas_size(meta)
    t = make_transform(meta)
    print(f"native canvas {nw}x{nh} (scale {t.s:.3f}), rotation={meta['rotation']}")
    native_bgr = render_native(pdf_path, args.page, nw, nh)
    rgba = build_overlay_rgba(solution, native_bgr, t)
    del native_bgr

    out_pdf = os.path.join(args.workdir, f"{tag}_colorized.pdf")
    if os.path.exists(out_pdf):
        os.remove(out_pdf)
    stats = attach_overlay(pdf_path, out_pdf, args.page, rgba)
    print(f"overlay png {stats['overlay_png_bytes']/1e6:.1f} MB; "
          f"pdf {stats['src_bytes']/1e6:.1f} -> {stats['out_bytes']/1e6:.1f} MB "
          f"({stats['out_bytes']/max(1, stats['src_bytes']):.2f}x)")

    v2 = v2_protected_overlap(rgba, solution, t)
    v7 = v7_preservation(pdf_path, out_pdf, args.page, stats["ocg"])
    for v in (v2, v7):
        print(f"[{'PASS' if v['passed'] else 'FAIL'}] {v['name']}: "
              f"{ {k: val for k, val in v.items() if k not in ('name', 'passed')} }")

    # 2-page review PDF: colorized page first, original second (the pink-markup format)
    import fitz
    review = os.path.join(args.workdir, f"{tag}_review.pdf")
    rd = fitz.open()
    dout = fitz.open(out_pdf)
    dsrc = fitz.open(pdf_path)
    rd.insert_pdf(dout, from_page=args.page, to_page=args.page)
    rd.insert_pdf(dsrc, from_page=args.page, to_page=args.page)
    rd.save(review)
    rd.close(); dout.close(); dsrc.close()
    print(f"review -> {review}")
    ok = v2["passed"] and v7["passed"]
    print(f"P1 {'PASS' if ok else 'FAIL'} for {tag}")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
