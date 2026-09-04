"""Score a painted page against the marks a human reviewer left on it.

The beta already collects typed review marks -- *missing*, *stops-mid*, *non-wire*, *bleed*,
*wrong-colour* -- each pinned to a normalised point or segment on one page of one manual. Until now
they were read by eye. This turns them into a number, which is the thing every later decision needs:

* a **regression benchmark**, so a change to the engine is measured against a reviewer's judgement
  across several manuals instead of one page someone happened to open;
* a **fitness function**, so a parameter search over :class:`~wirecolor.engine.policy.DecisionPolicy`
  has something to optimise that is not a proxy.

The score is deliberately asymmetric. Painting a conductor the reviewer never asked about is cheap;
painting something they marked as *not a wire* is expensive. That matches the product: a missed wire
is a smaller failure than a confident wrong colour, and it stops a search from buying recall by
painting everything.

Nothing here promotes anything. It reports; a human decides what to keep.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import json
import math
from pathlib import Path

# A reviewer places a mark by eye on a zoomed page, so it lands near the conductor rather than on
# its centreline. Measured against the exported marks, a tolerance of this fraction of the page
# diagonal covers the placement scatter without letting one mark answer for its neighbour.
MARK_TOLERANCE_DIAGONAL = 0.004

# What each mark asserts about the finished page.
WANT_PAINT = {"missing", "stops-mid"}
WANT_BARE = {"non-wire", "bleed"}
WANT_CODE = {"wrong-colour"}

# A wrong colour is the failure a reviewer trusts least, so it costs most; a miss is the cheapest.
WEIGHTS = {"missing": 1.0, "stops-mid": 1.0, "non-wire": 4.0, "bleed": 4.0, "wrong-colour": 6.0}


@dataclass
class MarkOutcome:
    kind: str
    page: int
    satisfied: bool | None
    detail: str = ""
    scorable: bool = True

    @property
    def weight(self) -> float:
        return WEIGHTS.get(self.kind, 1.0)


@dataclass
class PageScore:
    manual: str
    page: int
    painted: bool
    reason: str = ""
    outcomes: list = field(default_factory=list)

    def totals(self) -> tuple[float, float]:
        scorable = [item for item in self.outcomes if item.scorable]
        earned = sum(item.weight for item in scorable if item.satisfied)
        possible = sum(item.weight for item in scorable)
        return earned, possible


def _sample_points(geometry, samples: int = 9) -> list:
    """The points a mark asserts about: one for a point, several along a segment."""
    points = [tuple(float(value) for value in point) for point in geometry.get("points", ())]
    if len(points) < 2:
        return points[:1]
    (x0, y0), (x1, y1) = points[0], points[-1]
    return [(x0 + (x1 - x0) * index / (samples - 1.0),
             y0 + (y1 - y0) * index / (samples - 1.0)) for index in range(samples)]


def _painted_near(alpha, x: float, y: float, radius_px: float):
    """(is_painted, column, row) for the overlay pixel nearest a normalised point."""
    height, width = alpha.shape[:2]
    column, row = int(round(x * width)), int(round(y * height))
    reach = max(1, int(round(radius_px)))
    left, right = max(0, column - reach), min(width, column + reach + 1)
    top, bottom = max(0, row - reach), min(height, row + reach + 1)
    if right <= left or bottom <= top:
        return False, column, row
    window = alpha[top:bottom, left:right]
    return bool((window > 0).any()), column, row


def _dominant_colour(rgba, x: float, y: float, radius_px: float):
    """The most common opaque RGB near a point, or None when nothing is painted there."""
    import numpy as np

    height, width = rgba.shape[:2]
    column, row = int(round(x * width)), int(round(y * height))
    reach = max(1, int(round(radius_px)))
    left, right = max(0, column - reach), min(width, column + reach + 1)
    top, bottom = max(0, row - reach), min(height, row + reach + 1)
    if right <= left or bottom <= top:
        return None
    window = rgba[top:bottom, left:right]
    opaque = window[window[:, :, 3] > 0]
    if not len(opaque):
        return None
    colours, counts = np.unique(opaque[:, :3], axis=0, return_counts=True)
    return tuple(int(value) for value in colours[counts.argmax()])


def _expected_rgb(code: str, convention) -> tuple | None:
    if convention is None:
        return None
    parts = str(code).split("/")
    if not all(part in convention.codes for part in parts):
        return None
    blue, green, red = convention.colors_bgr[parts[0]]
    return (red, green, blue)


def score_page(overlay_rgba, marks: list, convention, colour_tolerance: int = 60) -> list:
    """Judge every mark on one page against the overlay that was produced for it."""
    height, width = overlay_rgba.shape[:2]
    radius = math.hypot(width, height) * MARK_TOLERANCE_DIAGONAL
    alpha = overlay_rgba[:, :, 3]
    outcomes = []
    for mark in marks:
        kind = str(mark.get("type"))
        points = _sample_points(mark.get("geometry") or {})
        if not points:
            outcomes.append(MarkOutcome(
                kind=kind, page=int(mark.get("page", -1)), satisfied=None,
                detail="mark has no usable point geometry", scorable=False))
            continue
        hits = [_painted_near(alpha, x, y, radius)[0] for x, y in points]
        if kind in WANT_PAINT:
            # A segment is satisfied when colour survives along it, not merely at one end.
            satisfied = all(hits) if len(points) > 1 else hits[0]
            detail = f"{sum(hits)}/{len(hits)} pontos pintados"
        elif kind in WANT_BARE:
            satisfied = not any(hits)
            detail = f"{sum(hits)}/{len(hits)} pontos pintados (deviam estar limpos)"
        elif kind in WANT_CODE:
            wanted = _expected_rgb(mark.get("expected_code") or "", convention)
            found = _dominant_colour(overlay_rgba, points[0][0], points[0][1], radius)
            if wanted is None:
                outcomes.append(MarkOutcome(
                    kind=kind, page=int(mark.get("page", -1)), satisfied=None,
                    detail=("expected colour code is absent from the selected convention: "
                            f"{mark.get('expected_code')!r}"), scorable=False))
                continue
            satisfied = found is not None and all(
                abs(int(a) - int(b)) <= colour_tolerance for a, b in zip(found, wanted))
            detail = f"esperado {wanted}, encontrado {found}"
        else:
            outcomes.append(MarkOutcome(
                kind=kind, page=int(mark.get("page", -1)), satisfied=None,
                detail=f"unsupported mark type: {kind}", scorable=False))
            continue
        outcomes.append(MarkOutcome(kind=kind, page=int(mark.get("page", -1)),
                                    satisfied=satisfied, detail=detail))
    return outcomes


def balanced_fitness(outcomes: list[MarkOutcome]) -> tuple[float, dict]:
    """Geometric mean of coverage, clean-region safety, and exact-colour correctness.

    The weighted score remains useful for a human-readable severity total, but it is unsafe as a
    genetic objective by itself: on the first real export an entirely blank overlay scored 0.2911
    because the few high-weight negative marks outweighed 206 missing-colour marks. Requiring every
    represented objective prevents both blank output and paint-everything output from winning.
    """
    groups = {
        "coverage": WANT_PAINT,
        "clean_regions": WANT_BARE,
        "exact_colour": WANT_CODE,
    }
    components = {}
    for name, kinds in groups.items():
        relevant = [item for item in outcomes if item.scorable and item.kind in kinds]
        if relevant:
            components[name] = sum(bool(item.satisfied) for item in relevant) / len(relevant)
    if not components:
        return 0.0, {}
    product = 1.0
    for value in components.values():
        product *= value
    return product ** (1.0 / len(components)), components


def load_reports(path: str | Path) -> list:
    """Read an exported feedback file: either a list of reports or one report."""
    raw = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    reports = raw if isinstance(raw, list) else [raw]
    return [report for report in reports if report.get("annotations")]


def marks_by_page(report: dict) -> dict:
    grouped = {}
    for mark in report.get("annotations", ()):
        grouped.setdefault(int(mark.get("page", -1)), []).append(mark)
    return grouped


def summarise(scores: list) -> dict:
    """Aggregate page scores into the numbers a reviewer and an optimiser both read."""
    from collections import Counter

    per_kind = Counter()
    per_kind_ok = Counter()
    per_kind_unscorable = Counter()
    earned = possible = 0.0
    all_outcomes = []
    publication_totals = {}
    for page in scores:
        page_earned, page_possible = page.totals()
        earned += page_earned
        possible += page_possible
        manual_totals = publication_totals.setdefault(page.manual, [0.0, 0.0])
        manual_totals[0] += page_earned
        manual_totals[1] += page_possible
        for outcome in page.outcomes:
            all_outcomes.append(outcome)
            if not outcome.scorable:
                per_kind_unscorable[outcome.kind] += 1
                continue
            per_kind[outcome.kind] += 1
            per_kind_ok[outcome.kind] += int(outcome.satisfied)
    fitness, components = balanced_fitness(all_outcomes)
    publication_scores = [earned_ / possible_ for earned_, possible_ in publication_totals.values()
                          if possible_]
    return {
        "pages": len(scores),
        "pages_painted": sum(1 for page in scores if page.painted),
        "marks": int(sum(per_kind.values())),
        "marks_total": len(all_outcomes),
        "marks_unscorable": int(sum(per_kind_unscorable.values())),
        "marks_satisfied": int(sum(per_kind_ok.values())),
        "weighted_score": round(earned / possible, 4) if possible else 0.0,
        "publication_macro_weighted_score": (
            round(sum(publication_scores) / len(publication_scores), 4)
            if publication_scores else 0.0),
        "fitness_score": round(fitness, 4),
        "fitness_components": {
            key: round(value, 4) for key, value in sorted(components.items())},
        "by_kind": {
            kind: {
                "total": per_kind[kind],
                "satisfied": per_kind_ok[kind],
                "unscorable": per_kind_unscorable[kind],
            }
            for kind in sorted(set(per_kind) | set(per_kind_unscorable))
        },
    }
