"""Strip colour that leaked onto a connector edge or a component frame.

The failure this fixes, in one picture: a connector pin-out draws every wire as a vertical stub
dropping onto the connector's horizontal top edge. That edge is one long straight line, noded at
every pin into short segments. Each segment clears the min-conductor floor and becomes a "run", and
the nearest pin legend -- printed vertically along its stub -- is the cheapest match, so the edge
between pin 58 and pin 46 gets painted the colour of pin 58's wire. Ten of the eighteen
"colour on a non-wire" defects in the round-1 audit were exactly this, on four different sheets.

The safe discriminator is COLOUR, not geometry. A real bus that taps many wires is noded into
short collinear pieces too, and it must keep its paint -- but a bus is ONE colour from end to end.
A connector edge picks up a DIFFERENT colour from every pin it passes, so a run of collinear,
touching segments carrying three or more distinct codes cannot be a conductor. That test leaves a
monochrome bus untouched while dissolving the rainbow that only a leaked frame produces.

Runs identified as rail are left BLACK (code cleared), never repainted, in keeping with the
project's rule that an unpainted line is a miss but a wrongly coloured one is a lie.
"""
from __future__ import annotations

from math import hypot

# A rail run is a short, straight, axis-aligned segment. "Short" is relative to the sheet: a
# connector edge segment spans one pin pitch, far below a routed conductor. 3x the min-conductor
# floor is generous enough to catch a wide pin pitch and still well under a real cross-sheet run.
MAX_RAIL_RUN_FLOORS = 3.0

# Two rail segments belong to the same rail when they share a constant coordinate this close: the
# edge is drawn as one straight line, so the drift is sub-pixel and this only absorbs node rounding.
COLLINEAR_TOL_PX = 3.0

# Largest gap bridged between two segments of one rail, as a fraction of the page diagonal. It has
# to be generous: most inter-pin edge pieces fall below the conductor floor and never become runs,
# so the few that do are separated by several pin pitches (measured up to 369 px on the pub 30 PCU
# connector). The polychromatic test is what keeps this safe -- bridging a wide gap can only ever
# merge collinear segments, and three different colours on one straight line is still a frame.
MAX_GAP_FRACTION = 0.16

# The whole rail must be longer than a component symbol to be a connector edge rather than a
# genuine short jumper -- same 12% of the page diagonal that bounds symbol detection.
MIN_RAIL_SPAN_FRACTION = 0.12

# Distinct colours along one rail before it is judged a leaked frame rather than a bus. Three is
# deliberately clear of two: a real splice where two colours meet end to end stays safe.
MIN_DISTINCT_CODES = 3


def _straight_axis(points):
    """(axis, constant coord, lo, hi) for an axis-aligned run, else None.

    Only near-perfectly horizontal or vertical runs qualify. A connector edge is drawn straight;
    an L-shaped or diagonal conductor is not a rail and must never be dissolved by this pass.
    """
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    width, height = max(xs) - min(xs), max(ys) - min(ys)
    if height <= COLLINEAR_TOL_PX and width > height:
        return "h", sum(ys) / len(ys), min(xs), max(xs)
    if width <= COLLINEAR_TOL_PX and height > width:
        return "v", sum(xs) / len(xs), min(ys), max(ys)
    return None


def strip_connector_rails(owned_runs, page_diagonal_px, min_conductor_px):
    """Clear the code on runs that form a polychromatic connector edge or component frame.

    Returns the number of runs dissolved. ``owned_runs`` is mutated in place.
    """
    max_len = MAX_RAIL_RUN_FLOORS * min_conductor_px
    min_span = MIN_RAIL_SPAN_FRACTION * page_diagonal_px
    max_gap = MAX_GAP_FRACTION * page_diagonal_px

    # candidate rail segments: short, straight, axis-aligned
    candidates = []
    for run in owned_runs:
        if len(run.points) < 2:
            continue
        length = sum(hypot(b[0] - a[0], b[1] - a[1])
                     for a, b in zip(run.points, run.points[1:]))
        if length > max_len:
            continue
        line = _straight_axis(run.points)
        if line:
            axis, coord, lo, hi = line
            candidates.append((axis, coord, lo, hi, run))

    # group by axis and constant coordinate (bucketed), then split each group into contiguous rails
    from collections import defaultdict
    groups = defaultdict(list)
    for axis, coord, lo, hi, run in candidates:
        groups[(axis, round(coord / COLLINEAR_TOL_PX))].append((lo, hi, run))

    dissolved = 0
    for members in groups.values():
        members.sort(key=lambda m: (m[0], m[1]))   # by position only; OwnedRun is not orderable
        rail = [members[0]]
        for lo, hi, run in members[1:]:
            if lo - rail[-1][1] <= max_gap:
                rail.append((lo, hi, run))
            else:
                dissolved += _judge_rail(rail, min_span)
                rail = [(lo, hi, run)]
        dissolved += _judge_rail(rail, min_span)
    return dissolved


def _judge_rail(rail, min_span):
    """Dissolve the rail's runs if it spans far enough and carries enough distinct colours."""
    if len(rail) < MIN_DISTINCT_CODES:
        return 0
    span = rail[-1][1] - rail[0][0]
    if span < min_span:
        return 0
    codes = {run.code for _lo, _hi, run in rail if run.code}
    if len(codes) < MIN_DISTINCT_CODES:
        return 0
    dissolved = 0
    for _lo, _hi, run in rail:
        if run.code:
            run.code = None
            run.propagated = False
            dissolved += 1
    return dissolved


# --- monochromatic housing / component frame borders --------------------------------------------
#
# The rail strip above catches a connector edge that is BROKEN into per-pin pieces, each a different
# colour. A different connector draws its edge as one UNBROKEN line -- the tall right border of an
# ECU pin column -- and a single pin's colour propagates the whole length, so the border is one long
# monochrome run. The rail strip cannot see it (one colour, one run) and the cluster strip cannot
# (too long). But the same colour insight still works, turned ninety degrees: a real bus feeds one
# colour, while a housing edge is the place where many DIFFERENT-coloured wires terminate. So a long
# straight run that three or more differently-coloured perpendicular wires end against is a frame.

# The border must be at least this many min-conductor lengths to be a housing edge rather than a
# short jumper.
FRAME_MIN_LENGTH_FACTOR = 4.0

# A wire counts as terminating against the border if its end lands this close, in working pixels.
# The pin symbol between the wire and the edge leaves a small gap, so this is a few pen widths, not
# zero. Measured safe: at 32 px pub 77's four housing borders are found and no protected sheet loses
# a conductor. Widening it is NOT safe as a blunt global change -- 60 px regressed 8 sheets (pub4872
# -14 painted, pub3749/pub3750 lost real conductors): on dense/pictorial sheets a real conductor is
# met by 5+ differently-coloured perpendicular ends within 60 px, so the distinct-colour guard alone
# does not hold at that reach. A wider-pitch connector edge (pub34 p150's divider, 24 stubs at 55 px)
# is instead caught by the FAR tier below, which demands many MORE distinct colours.
FRAME_ATTACH_PX = 32.0

# A far tier for wide-pitch connector edges the near reach misses. A run met by a LARGE number of
# distinct-coloured perpendicular terminations within FRAME_FAR_ATTACH_PX is a connector frame beyond
# any doubt -- a real conductor never gathers this many. The count bar is set well above what any
# protected sheet's real conductor reaches at this reach (measured max on the dev set: see the sweep).
FRAME_FAR_ATTACH_PX = 60.0
FRAME_FAR_MIN_DISTINCT = 14

# Distinct wire colours terminating on the border before it is judged a frame. Two thresholds:
#  - counting only SHORT pin-stub terminations, three is enough (a small connector edge);
#  - counting terminations of ANY length, five is required, because a big connector is met by wires
#    that route across the sheet. Five sits clear above the most a real conductor coincidentally
#    passes on the protected sheets (measured: 4), while the connector edges carry 9-18.
FRAME_MIN_DISTINCT_SHORT = 3
FRAME_MIN_DISTINCT_ANY = 5

# A frame edge is long and THIN. A straight line has a near-zero short side; a thin housing
# rectangle (the tall ECU-connector border measures 28 x 776 px) has a short side a small fraction
# of its long side. Both are frame-shaped; an L-bend or a diagonal cable is not, and the colour
# test would spare it anyway.
STRAIGHT_TOL_PX = 4.0
FRAME_ASPECT = 0.12


def _frame_shaped(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    short = min(max(xs) - min(xs), max(ys) - min(ys))
    long = max(max(xs) - min(xs), max(ys) - min(ys))
    return short <= max(STRAIGHT_TOL_PX, FRAME_ASPECT * long)


def _is_vertical(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (max(ys) - min(ys)) > (max(xs) - min(xs))


def _distance_to_run(point, run):
    best = None
    for index in range(len(run.points) - 1):
        (ax, ay), (bx, by) = run.points[index], run.points[index + 1]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / length2))
        distance = hypot(point[0] - (ax + t * dx), point[1] - (ay + t * dy))
        best = distance if best is None else min(best, distance)
    return best if best is not None else float("inf")


def _length(run):
    return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(run.points, run.points[1:]))


def strip_frame_borders(owned_runs, min_conductor_px, page_diagonal_px=None):
    """Clear the colour on housing edges that many differently-coloured wires terminate on.

    A candidate is a single thin, long, frame-shaped run -- a housing rectangle edge. A real bus is
    safe: the wires it feeds INHERIT its colour, so their terminations agree and the distinct count
    stays at one. A frame is where many DIFFERENT colours abut a straight line. Two thresholds: three
    distinct SHORT pin stubs, or five distinct terminations of ANY length (a big connector is met by
    wires that route across the sheet; five clears the most a real conductor coincidentally passes).

    Returns the count of runs cleared; mutates in place. ``page_diagonal_px`` is accepted for call
    compatibility but not needed here.
    """
    frame_min = FRAME_MIN_LENGTH_FACTOR * min_conductor_px
    wires = [run for run in owned_runs if run.code and len(run.points) >= 2]
    borders = [run for run in owned_runs
               if run.code and len(run.points) >= 2
               and _frame_shaped(run.points) and _length(run) > frame_min]

    cleared = 0
    for border in borders:
        if _frame_terminations(border, wires, frame_min, border):
            border.code = None
            border.propagated = False
            cleared += 1
    return cleared


def _frame_terminations(border, wires, frame_min, self_run, border_points=None):
    """True when enough differently-coloured wires terminate perpendicular on this edge to call it a
    frame. Two tiers: the NEAR reach (32 px) needs only a few distinct colours, but a wider-pitch
    connector edge is met further out, so a FAR reach (60 px) is allowed if MANY more distinct colours
    abut it -- a count no real conductor reaches (measured dev-set max 8; connector edges carry 23-31).
    """
    points = border_points if border_points is not None else border.points
    probe = border if border_points is None else _Poly(points)
    vertical = _is_vertical(points)
    near_short, near_any, far_any = set(), set(), set()
    for wire in wires:
        if wire is self_run or not wire.code:
            continue
        if _is_vertical(wire.points) == vertical:
            continue                              # need a perpendicular termination
        best = min(_distance_to_run(end, probe) for end in (wire.points[0], wire.points[-1]))
        if best <= FRAME_FAR_ATTACH_PX:
            far_any.add(wire.code)
            if best <= FRAME_ATTACH_PX:
                near_any.add(wire.code)
                if _length(wire) <= frame_min:
                    near_short.add(wire.code)
    return (len(near_short) >= FRAME_MIN_DISTINCT_SHORT
            or len(near_any) >= FRAME_MIN_DISTINCT_ANY
            or len(far_any) >= FRAME_FAR_MIN_DISTINCT)


def _axis_portions(points, tol=STRAIGHT_TOL_PX):
    """Maximal straight axis-aligned stretches of a polyline, as (i, j, vertical) index ranges.

    A housing edge fused into a conductor is one such stretch -- a long straight run of the run's
    own points -- with the rest of the run bending away as the wire. Diagonal stretches are skipped:
    a housing edge is orthogonal.
    """
    n = len(points)
    out = []
    i = 0
    while i < n - 1:
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        vertical = abs(x1 - x0) <= tol and abs(y1 - y0) > abs(x1 - x0)
        horizontal = abs(y1 - y0) <= tol and abs(x1 - x0) > abs(y1 - y0)
        if not (vertical or horizontal):
            i += 1
            continue
        const = x0 if vertical else y0
        j = i + 1
        while j < n - 1:
            (a0, b0), (a1, b1) = points[j], points[j + 1]
            if vertical and abs(a1 - a0) <= tol and abs(a1 - const) <= tol and abs(b1 - b0) > abs(a1 - a0):
                j += 1
            elif horizontal and abs(b1 - b0) <= tol and abs(b1 - const) <= tol and abs(a1 - a0) > abs(b1 - b0):
                j += 1
            else:
                break
        out.append((i, j, vertical))
        i = j
    return out


def split_fused_frame_borders(owned_runs, min_conductor_px):
    """Split a housing edge off the conductor it is fused into, and black only the edge.

    A big connector's edge is often electrically joined to a wire, so the geometry stage reads the
    two as one run and paints both. This finds the straight stretch of such a run that carries the
    frame signature -- five or more DIFFERENT-coloured wires terminating perpendicular along it --
    cuts the run at that stretch's ends, and leaves the stretch black while the wire keeps its
    colour on either side. Returns (new_owned_runs, edges_split).
    """
    from ..engine.ownership import OwnedRun

    frame_min = FRAME_MIN_LENGTH_FACTOR * min_conductor_px
    wires = [run for run in owned_runs if run.code and len(run.points) >= 2]

    def edge_terminations(points, i, j, vertical, self_run):
        return _frame_terminations(None, wires, frame_min, self_run, border_points=points[i:j + 1])

    def portion_length(points, i, j):
        return hypot(points[j][0] - points[i][0], points[j][1] - points[i][1])

    new_runs = []
    edges_split = 0
    for run in owned_runs:
        if not run.code or len(run.points) < 3:
            new_runs.append(run)
            continue
        edges = []
        for i, j, vertical in _axis_portions(run.points):
            if j - i >= 1 and portion_length(run.points, i, j) > frame_min \
                    and edge_terminations(run.points, i, j, vertical, run):
                edges.append((i, j))
        if not edges:
            new_runs.append(run)
            continue
        # cut the polyline: wire portions keep the code, edge portions go black
        edges_split += len(edges)
        prev = 0
        pieces = []                                   # (points, is_edge)
        for i, j in edges:
            if i > prev:
                pieces.append((run.points[prev:i + 1], False))
            pieces.append((run.points[i:j + 1], True))
            prev = j
        if prev < len(run.points) - 1:
            pieces.append((run.points[prev:], False))
        for pts, is_edge in pieces:
            if len(pts) < 2:
                continue
            length = sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
            keep_code = None if (is_edge or length < min_conductor_px) else run.code
            new_runs.append(OwnedRun(index=run.index, points=list(pts), code=keep_code,
                                     legend_raw=run.legend_raw if keep_code else None,
                                     distance=run.distance,
                                     corroborations=getattr(run, "corroborations", 0) if keep_code else 0,
                                     propagated=run.propagated if keep_code else False,
                                     confidence=getattr(run, "confidence", 0.0) if keep_code else 0.0,
                                     wire_probability=getattr(run, "wire_probability", None),
                                     abstained=getattr(run, "abstained", False),
                                     abstain_reason=getattr(run, "abstain_reason", None),
                                     abstained_from_code=getattr(run, "abstained_from_code", None)))
    return new_runs, edges_split


class _Poly:
    """Minimal run-like wrapper so _distance_to_run can measure to a bare point list."""
    __slots__ = ("points",)

    def __init__(self, points):
        self.points = points
