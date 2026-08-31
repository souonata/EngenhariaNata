"""Paint one vector wiring page end to end.

    python -m wirecolor.tools.paint_vector --pdf X.pdf --page 0 --out-dir /tmp/painted

The tier-A/B path in full: read exact conductor geometry from the page's own strokes, read exact
wire codes from its text layer, decide ownership once for the whole page, paint, and verify that
the original survived untouched.

No OCR, no skeletonization, no tuned pixel constants. On the measured corpus this path covers the
majority of evidenced pages -- 213 of 350 are born-digital -- which is the opposite of the
assumption the raster pipeline was built under.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import replace


# The overlay is a raster image laid over the page, so its resolution is independent of the
# geometry analysis. Analysis stays at 200 DPI because the ownership distances are calibrated
# there; painting goes as high as the sheet can afford. At 200 DPI an A4 band is 3 px, which
# cannot express a white core inside its own border -- more pixels fix the PROPORTIONS and keep
# the overlay sharp when the technician zooms in.
PAINT_DPI = 1200

# ...but an A0 foldout at 600 DPI is a 2.2 GB canvas. Cap the pixel budget instead of the DPI, so
# small sheets get the full boost and large ones keep what they already have.
# Measured: an A4 at 1200 DPI is 139 M pixels, took 9.8 s and added under 1 MB to the PDF over the
# same sheet at 600 DPI. That is the empirical ceiling this budget is set from -- it is a MEMORY
# bound (4 bytes a pixel while the canvas is live), not a file-size one, because the overlay is
# almost entirely transparent and compresses away.
PAINT_PIXEL_BUDGET = 150_000_000

# Withdrawing a conductor can expose a zone the previous overlay covered, so the repair
# loop runs until the gate is clean. Bounded because each pass repaints the sheet.
MAX_REPAIR_PASSES = 6


def vector_coverage_stats(source_runs, owned_runs, source_scale=1.0):
    """Count parent runs and geometric coverage after optional atomic-edge splitting."""
    from math import hypot

    def length(points):
        return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))

    painted_parents = {run.index for run in owned_runs if run.code}
    continuation_parents = {
        run.index for run in owned_runs if run.code and run.propagated}
    total_length = sum(length(points) for points in source_runs) * source_scale
    painted_length = sum(length(run.points) for run in owned_runs if run.code)
    return {
        "painted_parents": painted_parents,
        "continuation_parents": continuation_parents,
        "total_length": total_length,
        "painted_length": painted_length,
        "paint_rate": painted_length / total_length if total_length else 0.0,
    }


def paint_dpi_for(page, analysis_dpi, want=PAINT_DPI, budget=PAINT_PIXEL_BUDGET):
    """Highest paint resolution this page can afford, never below the analysis resolution."""
    width_pt, height_pt = page.rect.width, page.rect.height
    # Fine rungs so each sheet size actually spends its budget. With a coarse ladder an A3 could
    # afford 881 DPI but dropped to 600, wasting half the canvas it was allowed.
    for candidate in (want, 900, 800, 720, 600, 500, 450, 400, 360, 300, 240, analysis_dpi):
        scale = candidate / 72.0
        if width_pt * scale * height_pt * scale <= budget:
            return max(candidate, analysis_dpi)
    return analysis_dpi


def paint_page(pdf_path, page_index, out_dir, dpi=200, convention_name="volvo_classic",
               diagnose=False, band_scale=None, paint_dpi=None, paint_pixel_budget=None, force=False,
               decision_policy=None, run_classifier=None, overlay_path=None):
    import fitz

    from ..detect.vector_dashes import dashed_geometry, mark_dashed
    from ..engine.ownership import corroboration_rate
    from ..engine.policy import DecisionPolicy
    from ..engine.semantics import declined_analysis, enforce_vector_semantics
    from ..engine.vector_page import decide_vector_context, extract_vector_context
    from ..eval.vector_truth import geometry_is_trustworthy
    from ..labels.conventions import load_convention
    from ..paint.raster_overlay import attach_overlay, write_overlay_png
    from ..paint.vector_overlay import band_mm_for, band_px, build_rgba
    from ..verify.validators import v2_vector_protected_overlap, v7_preservation

    started = time.time()
    convention = load_convention(convention_name)
    decision_policy = (decision_policy or DecisionPolicy()).validate()
    os.makedirs(out_dir, exist_ok=True)

    document = fitz.open(pdf_path)
    page = document[page_index]

    # Refuse a raster foldout before painting its crop marks and callout boxes. The vector path
    # cannot read a schematic that lives inside a bitmap, and returning statistics about page
    # furniture -- or worse, shipping a purple callout box painted as a wire -- is a lie the honest
    # tier gate replaces with a decline. --force paints anyway.
    trustworthy, decline_reason = geometry_is_trustworthy(page, dpi)
    if not trustworthy and not force:
        report = {
            "pdf": pdf_path, "page": page_index, "dpi": dpi,
            "declined": True, "decline_reason": decline_reason,
            "runs": 0, "runs_painted": 0, "paint_rate": 0.0,
            "engineering_semantics": declined_analysis(
                decline_reason, grammar="raster-or-unsupported-vector-page"),
            "seconds": round(time.time() - started, 1),
        }
        document.close()
        tag = f"{os.path.splitext(os.path.basename(pdf_path))[0][:40]}_p{page_index}"
        with open(os.path.join(out_dir, f"{tag}_report.json"), "w") as handle:
            json.dump(report, handle, indent=1)
        return report

    # Extract once, then solve through the same parameterised graph path used by QA and learning.
    context = extract_vector_context(page, dpi, convention)
    owned, decision = decide_vector_context(
        context, policy=decision_policy, classifier=run_classifier)
    pen_px = context.pen_px
    runs = context.runs

    # "Dashed wires are not included in the main harness" -- painting them solid contradicts the
    # sheet's own title block, so the dash has to survive the paint.
    dashed_segments, dash_pitch = dashed_geometry(page, dpi)
    dashed = mark_dashed(owned, dashed_segments)
    owned, semantic_pin_markers, engineering_semantics = enforce_vector_semantics(
        context, owned, context.pin_markers, convention, decision=decision)

    # paint at the sheet's affordable resolution; geometry was analysed at `dpi`
    out_dpi = paint_dpi_for(
        page, dpi, want=paint_dpi or PAINT_DPI,
        budget=paint_pixel_budget or PAINT_PIXEL_BUDGET)
    factor = out_dpi / float(dpi)
    if factor != 1.0:
        for run in owned:
            run.points = [(x * factor, y * factor) for x, y in run.points]
    pin_markers = [replace(
        marker,
        x=marker.x * factor,
        y=marker.y * factor,
        radius=marker.radius * factor,
        outer_radius=marker.outer_radius * factor,
        connector_bbox=tuple(value * factor for value in marker.connector_bbox),
    ) for marker in semantic_pin_markers]
    # A conductor traced THROUGH a component symbol asserts a connection the sheet does not show,
    # so its colour is untrustworthy along its whole length -- but only its own. Refusing the page
    # for it was measured against a reviewer's marks and cost far more than it protected: four such
    # pages carried 152 of 232 marks and satisfied none, because a page never released satisfies
    # nothing. Abstaining per conductor is what the rest of the engine already does.
    from ..detect.vector_symbols import runs_crossing_zones

    scaled_zones = [tuple(value * factor for value in zone) for zone in context.blocked_zones]
    # The painted band is wider than the centreline it follows, so a conductor skimming a small
    # symbol can cover it end to end without its centreline spanning it. Judging both with the same
    # half-band tolerance keeps the geometric withdrawal and the pixel gate from disagreeing.
    half_band = max(1.0, band_px(pen_px * factor, band_scale, out_dpi,
                                 (page.rect.width, page.rect.height)) / 2.0)
    crossing = runs_crossing_zones(owned, scaled_zones, tolerance=half_band)
    runs_withdrawn = len(crossing)
    if crossing:
        owned = [run for index, run in enumerate(owned) if index not in crossing]

    scale = out_dpi / 72.0
    canvas_hw = (int(round(page.rect.height * scale)), int(round(page.rect.width * scale)))
    page_pt = (page.rect.width, page.rect.height)
    scaled_pitch = None if dash_pitch is None else (dash_pitch[0] * factor, dash_pitch[1] * factor)
    rgba, painted = build_rgba(owned, canvas_hw, convention, out_dpi, pen_px=pen_px * factor,
                               diagnose=diagnose, scale=band_scale, page_pt=page_pt,
                               dash_pitch=scaled_pitch, pin_markers=pin_markers)
    v2 = v2_vector_protected_overlap(
        rgba, context.blocked_zones, analysis_dpi=dpi, paint_dpi=out_dpi,
        pen_px=pen_px * factor)
    # The centreline test misses paint that reaches a symbol through a dash group or a band wider
    # than the stroke it follows, so close the loop on the measurement itself: withdraw every
    # conductor touching a zone the pixels report, paint again, and look again. One pass was not
    # enough -- withdrawing a conductor can expose a zone the first overlay had hidden, and on the
    # measured corpus a single pass left page 40 refused, costing 24 of its 27 reviewer marks.
    for _repair in range(MAX_REPAIR_PASSES):
        if not (v2.get("zones_crossed") or v2.get("zones_entered_deeply")):
            break
        # The gate reports zones in ANALYSIS pixels; the runs are already in paint pixels.
        repair_zones = [tuple(value * factor for value in zone)
                        for zone in (*v2["crossed_zones"], *v2.get("deep_zones", ()))]
        touching = runs_crossing_zones(owned, repair_zones, tolerance=1e9)
        if not touching:
            break                          # nothing left to withdraw; the page is judged as is
        runs_withdrawn += len(touching)
        owned = [run for index, run in enumerate(owned) if index not in touching]
        rgba, painted = build_rgba(
            owned, canvas_hw, convention, out_dpi, pen_px=pen_px * factor,
            diagnose=diagnose, scale=band_scale, page_pt=page_pt,
            dash_pitch=scaled_pitch, pin_markers=pin_markers)
        v2 = v2_vector_protected_overlap(
            rgba, context.blocked_zones, analysis_dpi=dpi, paint_dpi=out_dpi,
            pen_px=pen_px * factor)
    document.close()

    tag = f"{os.path.splitext(os.path.basename(pdf_path))[0][:40]}_p{page_index}"
    suffix_scale = "" if band_scale is None else f"_s{band_scale:g}".replace(".", "")
    out_pdf = os.path.join(out_dir, f"{tag}{suffix_scale}_diagnostic.pdf" if diagnose
                           else f"{tag}{suffix_scale}_colored.pdf")
    if overlay_path:
        write_overlay_png(overlay_path, rgba)
        v7 = None
        out_pdf = None
    else:
        stats = attach_overlay(pdf_path, out_pdf, page_index, rgba)
        v7 = v7_preservation(pdf_path, out_pdf, page_index, stats["ocg"])

    # A learned decision may split one extracted run into atomic edges.  Counting those edges as
    # new runs produces impossible coverage above 100%.  Report unique parent runs for counts and
    # geometric length for coverage, which also represents a partially blacked frame honestly.
    coverage = vector_coverage_stats(runs, owned, source_scale=factor)
    painted_parents = coverage["painted_parents"]
    continuation_parents = coverage["continuation_parents"]
    total_length = coverage["total_length"]
    painted_length = coverage["painted_length"]

    report = {
        "pdf": pdf_path, "page": page_index, "dpi": dpi,
        "segments": context.segments, "nets": context.nets, "runs": len(runs),
        "symbol_zones": context.symbol_zones,
        "symbol_strokes_removed": context.symbol_strokes_removed,
        "legends": len(context.legends),
        "pin_markers_painted": len(pin_markers),
        "pin_marker_codes": sorted({marker.code for marker in pin_markers}),
        "runs_painted": len(painted_parents),
        "painted_atomic_pieces": painted,
        "runs_by_legend": len(painted_parents - continuation_parents),
        "runs_by_continuation": len(continuation_parents),
        "runs_dashed": dashed,
        "runs_bridged": decision["runs_bridged"],
        "rails_stripped": decision["rails_stripped"],
        "boxes_stripped": decision["boxes_stripped"],
        "frames_stripped": decision["frames_stripped"],
        "frame_splits": decision["frame_splits"],
        "learned_abstentions": decision["learned_abstentions"],
        "semantic_abstentions": engineering_semantics["semantic_abstentions"],
        "runs_withdrawn_crossing_symbols": runs_withdrawn,
        "decision_abstentions": decision["abstained"],
        "decision": decision,
        "decision_policy": decision_policy.to_dict(),
        "run_classifier": None if run_classifier is None else (run_classifier.metadata or {}),
        "dash_pitch_px": None if dash_pitch is None else list(dash_pitch),
        "paint_dpi": out_dpi,
        "pen_px": round(pen_px, 2),
        "band_px": band_px(pen_px * factor, band_scale, out_dpi, page_pt),
        "band_mm": round(band_mm_for(*page_pt), 2),
        "band_scale": band_scale if band_scale is not None else "default",
        "runs_unpainted": len(runs) - len(painted_parents),
        "painted_length_px": round(painted_length, 1),
        "total_length_px": round(total_length, 1),
        "paint_rate": round(coverage["paint_rate"], 3),
        "coverage_metric": "painted-vector-length-v2",
        "engineering_semantics": engineering_semantics,
        "corroboration_rate": round(corroboration_rate(owned), 3),
        "codes": sorted(
            {run.code for run in owned if run.code}
            | {marker.code for marker in pin_markers}),
        "v7": v7,
        "v2": v2,
        "out_pdf": out_pdf,
        "overlay_png": overlay_path,
        "seconds": round(time.time() - started, 1),
    }
    suffix = "_diagnostic_report.json" if diagnose else "_report.json"
    with open(os.path.join(out_dir, f"{tag}{suffix_scale}{suffix}"), "w") as handle:
        json.dump(report, handle, indent=1)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--page", type=int, default=0)
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--convention", default="volvo_classic")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--paint-dpi", type=int, default=None,
                        help="overlay resolution (default: highest the sheet affords)")
    parser.add_argument("--band-scale", type=float, default=None,
                        help="thin or thicken every painted band (0.7 = 30%% thinner). "
                             "Sheet density is not predictable from the pen width, so this "
                             "is the knob to turn on a crowded drawing.")
    parser.add_argument("--diagnose", action="store_true",
                        help="stroke unclaimed runs in magenta so they can be reviewed")
    parser.add_argument("--force", action="store_true",
                        help="paint even a page flagged as a raster foldout (no vector schematic)")
    parser.add_argument("--decision-policy", help="versioned decision-policy JSON")
    parser.add_argument("--run-classifier", help="calibrated lightweight run-classifier JSON")
    args = parser.parse_args()

    from ..engine.classifier import CalibratedRunClassifier
    from ..engine.policy import DecisionPolicy
    policy = DecisionPolicy.load(args.decision_policy)
    classifier = (CalibratedRunClassifier.load(args.run_classifier)
                  if args.run_classifier else None)
    report = paint_page(args.pdf, args.page, args.out_dir, args.dpi, args.convention,
                        diagnose=args.diagnose, band_scale=args.band_scale,
                        paint_dpi=args.paint_dpi, force=args.force,
                        decision_policy=policy, run_classifier=classifier)
    print(json.dumps({k: v for k, v in report.items() if k != "codes"}, indent=1))
    if report.get("declined"):
        print("declined:", report["decline_reason"])
    else:
        print("codes:", ", ".join(report["codes"]))


if __name__ == "__main__":
    main()
