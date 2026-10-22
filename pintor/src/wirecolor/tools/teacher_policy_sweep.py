"""Replay the decision layer on the factory twins under candidate policies, scored by length.

    python -m wirecolor.tools.teacher_policy_sweep --bench workspaces/teacher \
        --pages teacher_pages.json --param min_direct_assignment_margin --values 0,0.06,0.12

The full teacher benchmark paints every page, which costs an hour per candidate. The decision a
policy changes happens before painting, so this replays only ``decide_vector_context`` on each
twin's cached context and compares every coloured run with the factory's colour of the conductor
it lies on. It is a proxy -- painting still adds semantics, trimming and the pixel gate -- and a
chosen value must be confirmed with ``teacher_bench``.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from math import hypot
from pathlib import Path

DPI = 200
TOLERANCE_PT = 2.0


def _truth_in_pixels(page, conductors):
    from ..eval.teacher import displayed_conductors

    scale = DPI / 72.0
    shown = displayed_conductors(conductors, page)
    return [([((a[0] * scale, a[1] * scale), (b[0] * scale, b[1] * scale))
              for a, b in conductor.segments], conductor) for conductor in shown]


def evaluate(owned, truth, convention) -> Counter:
    """Length of coloured run lying on a conductor of the same / another colour, and coverage."""
    from ..eval.teacher import _SegmentGrid, _point_segment_distance

    tolerance = TOLERANCE_PT * DPI / 72.0
    grid = _SegmentGrid(cell=24.0)
    for number, (segments, _conductor) in enumerate(truth):
        for a, b in segments:
            grid.add(number, a, b)

    def colours(code):
        return tuple(convention.colors_bgr.get(part) for part in str(code).split("/"))

    totals = Counter()
    covered = defaultdict(float)
    for run in owned:
        if not run.code or len(run.points) < 2:
            continue
        for a, b in zip(run.points, run.points[1:]):
            length = hypot(b[0] - a[0], b[1] - a[1])
            steps = max(1, int(length // 4.0))
            for step in range(steps + 1):
                point = (a[0] + (b[0] - a[0]) * step / steps, a[1] + (b[1] - a[1]) * step / steps)
                best, best_distance = None, tolerance
                for number, c, d in grid.near(point):
                    distance = _point_segment_distance(point, c, d)
                    if distance < best_distance:
                        best, best_distance = number, distance
                piece = length / (steps + 1)
                if best is None:
                    totals["off_truth"] += piece
                    continue
                conductor = truth[best][1]
                if not conductor.code or getattr(conductor, "factory_conflict", False):
                    continue
                if colours(run.code) == colours(conductor.code):
                    totals["right"] += piece
                    covered[best] += piece
                else:
                    totals["wrong"] += piece
    for number, (segments, conductor) in enumerate(truth):
        if conductor.code and not getattr(conductor, "factory_conflict", False):
            length = sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in segments)
            totals["truth"] += length
            totals["covered"] += min(length, covered.get(number, 0.0))
    return totals


def main() -> None:
    import fitz

    from ..engine.policy import DecisionPolicy
    from ..engine.vector_page import decide_vector_context, extract_vector_context
    from ..eval.teacher import (build_atlas, harvest_page, legend_votes, mark_printed_conflicts,
                                resolve_tokens)
    from ..labels.conventions import load_convention
    from ..labels.text_layer import read_legends, strong_legends

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bench", required=True, help="teacher_bench folder holding the twins")
    parser.add_argument("--pages", required=True)
    parser.add_argument("--param", required=True)
    parser.add_argument("--values", required=True)
    parser.add_argument("--publications", default=None, help="comma list to restrict to")
    args = parser.parse_args()
    convention = load_convention("volvo_classic")
    pages = json.loads(Path(args.pages).read_text(encoding="utf-8"))
    if args.publications:
        keep = set(args.publications.split(","))
        pages = [entry for entry in pages if str(entry["publication"]) in keep]
    values = [float(value) for value in args.values.split(",")]

    by_publication = defaultdict(list)
    for entry in pages:
        by_publication[str(entry["publication"])].append(entry)
    prepared = []
    for publication, entries in by_publication.items():
        loaded, votes = [], Counter()
        for entry in entries:
            document = fitz.open(entry["pdf"])
            page = document[int(entry["page"]) - 1]
            harvest = harvest_page(page)
            legends = strong_legends(read_legends(page, 72, convention))
            votes += legend_votes(harvest.conductors, legends)
            loaded.append((entry, document, page, harvest, legends))
        atlas = build_atlas(votes)
        for entry, document, page, harvest, legends in loaded:
            twin_path = Path(args.bench) / f"pub{publication}_p{entry['page']}_twin.pdf"
            if not twin_path.exists():
                continue
            resolve_tokens(harvest.conductors, atlas, convention)
            mark_printed_conflicts(harvest.conductors, legends, convention)
            with fitz.open(twin_path) as twin:
                context = extract_vector_context(twin[0], DPI, convention)
            prepared.append((publication, context, _truth_in_pixels(page, harvest.conductors)))
            print(f"  prepared pub{publication}_p{entry['page']}", flush=True)
        for *_rest, document, _page, _harvest, _legends in loaded:
            document.close()

    for value in values:
        policy = DecisionPolicy(**{args.param: value}).validate()
        totals = Counter()
        for _publication, context, truth in prepared:
            owned, _ = decide_vector_context(context, policy=policy)
            totals += evaluate(owned, truth, convention)
        painted = totals["right"] + totals["wrong"]
        print(json.dumps({
            args.param: value,
            "precision_by_length": round(totals["right"] / painted, 4) if painted else None,
            "coverage_by_length": round(totals["covered"] / totals["truth"], 4)
            if totals["truth"] else None,
            "off_truth_share": round(totals["off_truth"] / (painted + totals["off_truth"]), 4)
            if painted else None,
        }), flush=True)


if __name__ == "__main__":
    main()
