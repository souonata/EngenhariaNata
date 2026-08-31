"""Automated quality signals for a painted sheet.

    python -m wirecolor.tools.qa_report --pdf X.pdf --page N [--json out.json]

Every defect this project has shipped was found by a human looking at a rendered sheet and pointing
at it. This pass computes the part of that judgement a machine can make, so a regression is caught
before it reaches anyone: it cannot see whether a colour is *right*, but it can see whether a
labelled conductor was left black, whether component ink got painted, whether a cable changes
colour halfway along, and whether the two halves of a striped cable are equal.

None of these are pass/fail on their own. They are the numbers a reviewer would otherwise have to
count by hand, and their job is to say WHERE to look.
"""
from __future__ import annotations

import argparse
import json
from math import hypot

# A legend is "realized" when a run carrying its exact code is painted within this radius of the
# printed text. Sized to reach the conductor the label sits beside (labels print a little off the
# wire) without straying to a parallel neighbour in a bundle.
REALIZE_REACH_PX = 160.0


def _run_length(points):
    return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


def analyse(pdf_path, page_index, dpi=200, convention_name="volvo_classic"):
    import fitz

    from ..detect.vector_symbols import strip_symbol_strokes, symbol_geometry
    from ..engine.ownership import MAX_OWNERSHIP_PX, _nearest, assign, corroboration_rate
    from ..engine.ownership import bridge_straight_continuations, propagate_continuations
    from ..eval.vector_truth import (MIN_CONDUCTOR_DIAGONAL_FRACTION, build_nets,
                                     canvas_diagonal_px, decompose_runs, extract_segments,
                                     modal_pen_px, node_segments)
    from ..labels.conventions import load_convention
    from ..labels.text_layer import read_legends, strong_legends

    convention = load_convention(convention_name)
    document = fitz.open(pdf_path)
    page = document[page_index]
    page_pt = (page.rect.width, page.rect.height)

    pen_px = modal_pen_px(page, dpi)
    zones, symbol_strokes, _opaque = symbol_geometry(page, dpi, pen_px)
    stripped, dropped = strip_symbol_strokes(extract_segments(page, dpi), symbol_strokes)
    segments = node_segments(stripped)
    nets = build_nets(segments)

    minimum = canvas_diagonal_px(page, dpi) * MIN_CONDUCTOR_DIAGONAL_FRACTION
    runs = []
    for net in nets:
        for points in decompose_runs(segments, net):
            if len(points) >= 2 and _run_length(points) >= minimum:
                runs.append(points)

    every_legend = read_legends(page, dpi, convention)
    legends = strong_legends(every_legend)
    refused_bare = [l.raw for l in every_legend if l not in legends]

    owned = assign(legends, runs)
    propagated = propagate_continuations(owned)
    bridge_straight_continuations(owned, max_gap_px=min(30.0, 0.6 * minimum),
                                  min_conductor_px=minimum)
    propagate_continuations(owned)
    from ..detect.vector_loops import strip_symbol_clusters
    from ..detect.vector_rails import strip_connector_rails, strip_frame_borders, split_fused_frame_borders
    strip_connector_rails(owned, canvas_diagonal_px(page, dpi), minimum)
    strip_symbol_clusters(owned, canvas_diagonal_px(page, dpi), minimum)
    strip_frame_borders(owned, minimum, canvas_diagonal_px(page, dpi))
    owned, _ = split_fused_frame_borders(owned, minimum)

    # --- signal 1: a conductor with a legend right beside it that stayed black -----------------
    unpainted_with_legend = []
    for run in owned:
        if run.code:
            continue
        best = None
        for legend in legends:
            distance, _axis = _nearest(legend.x, legend.y, run.points)
            if best is None or distance < best[0]:
                best = (distance, legend)
        if best and best[0] <= MAX_OWNERSHIP_PX:
            unpainted_with_legend.append({
                "length_px": round(_run_length(run.points)),
                "nearest_legend": best[1].raw,
                "distance_px": round(best[0], 1),
                "at": [round(run.points[0][0]), round(run.points[0][1])],
            })
    unpainted_with_legend.sort(key=lambda r: -r["length_px"])

    # --- signal 2: two painted conductors meeting with DIFFERENT colours ----------------------
    # A cable that changes colour halfway is either a real splice or a mis-assignment. Real splices
    # exist, so this is a pointer, not a verdict -- but a long run changing colour is worth a look.
    ends = {}
    for run in owned:
        if len(run.points) < 2:
            continue
        for point in (run.points[0], run.points[-1]):
            ends.setdefault((round(point[0] / 1.5), round(point[1] / 1.5)), []).append(run)
    colour_changes = []
    for key, incident in ends.items():
        codes = {r.code for r in incident if r.code}
        if len(codes) > 1:
            longest = max((r for r in incident if r.code), key=lambda r: _run_length(r.points))
            colour_changes.append({
                "at": [key[0] * 3 // 2, key[1] * 3 // 2],
                "codes": sorted(codes),
                "longest_px": round(_run_length(longest.points)),
            })
    colour_changes.sort(key=lambda c: -c["longest_px"])

    # --- signal 3: how much painted length rests on inheritance rather than a legend -----------
    painted = [r for r in owned if r.code]
    painted_px = sum(_run_length(r.points) for r in painted) or 1.0
    inherited_px = sum(_run_length(r.points) for r in painted if r.propagated)

    # --- signal 4: legend realization -- did each printed colour code get applied to a wire? ---
    # paint_rate divides painted runs by ALL runs, so a furniture-dense sheet (component, connector,
    # rail and relay outlines) or one where SB=black is a common insulation colour reads "low" even
    # when every printed colour was faithfully applied. Realization measures the thing that actually
    # matters: of the gauged legends, how many have their exact code painted on a run within reach.
    # It is immune to furniture and to black-on-black wires, and it is conservative here -- a colour
    # printed several times along one wire counts each label, so duplicates only ever lower it.
    realized = 0
    for legend in legends:
        for run in painted:
            if run.code != legend.code:
                continue
            distance, _axis = _nearest(legend.x, legend.y, run.points)
            if distance <= REALIZE_REACH_PX:
                realized += 1
                break
    legend_realization = round(realized / len(legends), 3) if legends else 0.0

    document.close()
    return {
        "pdf": pdf_path,
        "page": page_index,
        "page_pt": [round(page_pt[0], 1), round(page_pt[1], 1)],
        "runs": len(runs),
        "painted": len(painted),
        "paint_rate": round(len(painted) / len(runs), 3) if runs else 0.0,
        "legends": len(legends),
        "symbol_zones": len(zones),
        "symbol_strokes_removed": dropped,
        "propagated_runs": propagated,
        "inherited_length_pct": round(100 * inherited_px / painted_px, 1),
        "corroboration_rate": round(corroboration_rate(owned), 3),
        "signals": {
            "unpainted_with_nearby_legend": len(unpainted_with_legend),
            "colour_change_junctions": len(colour_changes),
            "bare_codes_refused": len(refused_bare),
            "legend_realization": legend_realization,
            "legends_realized": realized,
        },
        "worst_unpainted": unpainted_with_legend[:12],
        "worst_colour_changes": colour_changes[:12],
        "bare_codes_refused": sorted(set(refused_bare))[:20],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--page", type=int, default=0)
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--convention", default="volvo_classic")
    parser.add_argument("--json", help="also write the full report here")
    args = parser.parse_args()

    report = analyse(args.pdf, args.page, args.dpi, args.convention)
    if args.json:
        with open(args.json, "w") as handle:
            json.dump(report, handle, indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
