"""cERL-mm -- the ruler.

Scores a painted sheet by **how far each conductor is traced correctly before the first mistake**,
in page millimetres, with merges penalised categorically rather than proportionally.

Why not coverage.  The metric this replaces passes a checkpoint when *any* arc within 16-25 px
carries the expected code, so a correctly-painted neighbour rescues a lost conductor -- a solver
that fused every ``R`` conductor into one net and every ``SB`` into another would score full marks.
Coverage has the mirror flaw: it counts painted ink without asking whether the paint is on the
right conductor.  Neither can see the failure this product must never ship.

Why run length.  Borrowed from connectomics (expected run length), where the task is identical in
shape: trace a thin branching network through crossings, and score how far you get before an error.
A conductor that is correct for 90% of its length and then jumps to a different cable is not 90%
good -- everything after the jump is wrong, and a technician following it is being actively
misled.  So a route's score is the arclength before its *first* error, not the fraction of samples
that happen to be right.

Why millimetres.  Pixels are not comparable across sheets: this corpus spans A4 to A0 and is
rendered at a working DPI that may itself change.  Millimetres of correctly-traced conductor mean
the same thing on every sheet, so per-sheet scores can be aggregated without a hidden weighting by
page size.

The scorer knows nothing about PDFs, OpenCV or the pipeline.  It asks a caller-supplied
``observe(x, y)`` what is at a page coordinate.  That keeps it (a) testable with pure fixtures,
(b) usable against rendered output *and* against a vector page's own exact geometry, which is how
tier A/B sheets generate their own ground truth.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from math import hypot

# A run ends at the first of these.  Order is not priority -- exactly one ends any given run.
NO_CONDUCTOR = "no_conductor"      # nothing traced here at all: the engine lost the wire
BLACK = "black"                    # a conductor is here but was left unpainted
WRONG_COLOUR = "wrong_colour"      # painted, but not the colour the sheet says
SPLIT = "split"                    # the conductor id changed: one cable traced as two
ABSTAINED = "abstained"            # the engine explicitly declined to decide
MERGED = "merged"                  # two conductors the sheet says are distinct share one id

# An abstention must score slightly worse than an honest miss, or refusing everything becomes the
# optimal strategy.  Small enough that abstaining is still far better than painting wrongly.
ABSTENTION_PENALTY = 0.02

MM_PER_PT = 25.4 / 72.0


@dataclass(frozen=True)
class Observation:
    """What the engine put at a page coordinate.

    ``conductor_id`` is the identity the tracer assigned; ``code`` is the colour it painted, or
    ``None`` for an unpainted conductor.  ``abstained`` marks a conductor the engine traced but
    deliberately refused to colour -- a different outcome from failing to notice it, and the two
    must never be pooled.
    """
    conductor_id: str
    code: str | None = None
    abstained: bool = False


@dataclass
class RouteScore:
    route_id: str
    expected_code: str
    total_mm: float
    correct_mm: float
    error: str | None                 # None when the whole route traced correctly
    error_at: tuple | None            # page coordinate of the first error
    conductor_ids: frozenset = field(default_factory=frozenset)

    @property
    def erl(self) -> float:
        """Fraction of the route traced correctly before the first error."""
        return 1.0 if self.total_mm <= 0 else self.correct_mm / self.total_mm


def polyline_length(points) -> float:
    return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


def resample(points, spacing):
    """Points every ``spacing`` along the polyline, always including both endpoints.

    Sampling density is the measurement resolution: too coarse and a short wrong section hides
    between samples, too fine and we pay for nothing because the tolerance is wider than the step.
    """
    if len(points) < 2 or spacing <= 0:
        return list(points)
    out = [tuple(points[0])]
    carried = 0.0
    for a, b in zip(points, points[1:]):
        seg = hypot(b[0] - a[0], b[1] - a[1])
        if seg <= 0:
            continue
        travelled = spacing - carried
        while travelled <= seg:
            t = travelled / seg
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            travelled += spacing
        carried = (carried + seg) % spacing
    if out[-1] != tuple(points[-1]):
        out.append(tuple(points[-1]))
    return out


def score_route(route, observe, px_per_mm, spacing_px):
    """Walk one ground-truth route until the first error.

    ``observe(x, y)`` returns an ``Observation`` or ``None`` (nothing traced within tolerance).
    Distances are converted to millimetres so sheets of different size and DPI are comparable.
    """
    points = [tuple(p) for p in route["points"]]
    expected = route.get("code")          # None => topology-only (see the colour check below)
    total_px = polyline_length(points)
    total_mm = total_px / px_per_mm if px_per_mm else 0.0
    samples = resample(points, spacing_px)

    established = None
    seen_ids = set()
    travelled_px = 0.0
    error = None
    error_at = None

    for index, sample in enumerate(samples):
        if index:
            previous = samples[index - 1]
            step = hypot(sample[0] - previous[0], sample[1] - previous[1])
        else:
            step = 0.0

        seen = observe(sample[0], sample[1])
        if seen is None:
            error, error_at = NO_CONDUCTOR, sample
            break
        seen_ids.add(seen.conductor_id)
        if established is None:
            established = seen.conductor_id
        elif seen.conductor_id != established:
            error, error_at = SPLIT, sample
            break
        if seen.abstained:
            error, error_at = ABSTAINED, sample
            break
        # expected is None => TOPOLOGY-ONLY scoring: judge tracing (splits and merges) without
        # judging colour. This is what makes the release gate measurable with no human annotation
        # at all: a vector page's own exact geometry supplies conductor identity, but not the
        # insulation colour, which is a separate ground truth with a separate provenance.
        if expected is not None:
            if seen.code is None:
                error, error_at = BLACK, sample
                break
            if seen.code != expected:
                error, error_at = WRONG_COLOUR, sample
                break
        travelled_px += step

    correct_mm = travelled_px / px_per_mm if px_per_mm else 0.0
    if error == ABSTAINED:
        # abstention costs the remaining length plus a nudge, so refusing is never free
        correct_mm = max(0.0, correct_mm - ABSTENTION_PENALTY * total_mm)
    return RouteScore(route_id=str(route["id"]), expected_code=expected, total_mm=total_mm,
                      correct_mm=min(correct_mm, total_mm), error=error, error_at=error_at,
                      conductor_ids=frozenset(seen_ids))


def apply_merge_rule(scores, distinct_pairs):
    """Truncate BOTH routes of any declared-distinct pair that shares a painted conductor.

    A merge is not "two routes share a root" -- routes legitimately meet at a junction box, and a
    rule that fired there would be loosened within a week.  It is only a merge when the sheet's own
    ground truth declares the two conductors ``distinct`` and the engine painted them as one.  That
    makes negative ground truth mandatory: without declared pairs, a merge is not expressible at
    all, and this function correctly reports none.
    """
    by_id = {s.route_id: s for s in scores}
    merged = []
    for left, right in distinct_pairs or ():
        a, b = by_id.get(str(left)), by_id.get(str(right))
        if a is None or b is None:
            continue
        shared = a.conductor_ids & b.conductor_ids
        if shared:
            merged.append({"routes": [a.route_id, b.route_id], "conductors": sorted(shared)})
            for side in (a, b):
                side.correct_mm = 0.0
                side.error = MERGED
    return merged


def score_sheet(spec, observe):
    """Score one sheet.

    ``spec`` carries the ground truth and the sheet's own scale:
        px_per_mm, tolerance_px, routes[], distinct[], and optionally must_not_paint[].
    Only routes marked ``status: confirmed`` count -- an unreviewed route would let the engine's
    own output back in as its own ground truth.
    """
    px_per_mm = spec["px_per_mm"]
    # Sample spacing is the markup tolerance, not the pen width: hand-drawn ground truth carries
    # human precision of 10-25 px, so a pen-width step would be measuring the annotator's mouse.
    spacing = spec.get("spacing_px") or spec["tolerance_px"]
    routes = [r for r in spec["routes"] if r.get("status") == "confirmed"]
    scores = [score_route(r, observe, px_per_mm, spacing) for r in routes]
    merges = apply_merge_rule(scores, spec.get("distinct"))

    total = sum(s.total_mm for s in scores)
    correct = sum(s.correct_mm for s in scores)
    errors = {}
    for s in scores:
        if s.error:
            errors[s.error] = errors.get(s.error, 0) + 1
    return {
        "routes_scored": len(scores),
        "routes_skipped_unconfirmed": len(spec["routes"]) - len(routes),
        # length-weighted: a 2 m cable traced wrongly must not cost the same as a 10 cm stub
        "cerl": (correct / total) if total else 0.0,
        "correct_mm": round(correct, 1),
        "total_mm": round(total, 1),
        "merge_events": len(merges),
        "merges": merges,
        "wrong_colour_events": errors.get(WRONG_COLOUR, 0),
        "errors": errors,
        "routes": [{"id": s.route_id, "erl": round(s.erl, 4), "code": s.expected_code,
                    "correct_mm": round(s.correct_mm, 1), "total_mm": round(s.total_mm, 1),
                    "error": s.error, "error_at": s.error_at} for s in scores],
    }


def score_corpus(sheet_reports):
    """Aggregate across sheets.

    The corpus figure is the **median** sheet, not the mean and not a pooled ratio: a mean lets one
    huge sheet dominate, and a pooled ratio lets a change that helps 139 sheets hide a collapse on
    the one that mattered.  ``merge_events`` is reported ALONGSIDE the score and never multiplied
    into it -- a multiplicative penalty collapses to nothing at thirty merges and gives no gradient
    in the regime a change starts from.  Two numbers, one gate.
    """
    reports = [r for r in sheet_reports if r]
    if not reports:
        return {"sheets": 0, "cerl_median": 0.0, "merge_events": 0, "release_gate": False}
    values = sorted(r["cerl"] for r in reports)
    middle = len(values) // 2
    median = (values[middle] if len(values) % 2
              else (values[middle - 1] + values[middle]) / 2)
    merges = sum(r["merge_events"] for r in reports)
    return {
        "sheets": len(reports),
        "cerl_median": median,
        "cerl_min": values[0],
        "cerl_max": values[-1],
        "merge_events": merges,
        "wrong_colour_events": sum(r["wrong_colour_events"] for r in reports),
        "total_mm": round(sum(r["total_mm"] for r in reports), 1),
        # merges are categorical: zero, or the build does not ship
        "release_gate": merges == 0,
    }
