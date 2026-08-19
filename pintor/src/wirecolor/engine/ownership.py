"""Which printed legend names which conductor.

This is the failure this project actually has. `HANDOFF.md:236-241` records it in the repo's own
words -- *"the new geometry is correct, but the full multiscale ownership pass merged or quarantined
one physical dash root and left real sections black"* -- and all three Round-16 fixes that moved the
checkpoint count were evidence fixes, not tracing fixes.

The existing approach decides each legend independently: take the nearest run. That is provably
wrong in the one place it matters. In a bundle of parallel wires spaced ~40 px apart, with legends
offset ~40 px from the wire they name, *every* legend's nearest run can be the same wire. Deciding
them one at a time cannot express "these four legends name four different wires", which is precisely
the situation on the sheets that lose routes. `multiscale.py:576-584` records this conclusion
already, and the code was never written.

So ownership is solved once, for the whole page, as a minimum-cost assignment with a priced refusal
column: a legend that fits nothing pays REFUSE_COST and owns nothing, rather than being forced onto
its least-bad neighbour. Refusing is a supported outcome, because black beats wrong.

One exception to strict one-to-one: a long conductor usually has its code printed more than once,
often at both ends. Those extra legends are recovered afterwards, but ONLY onto a run whose assigned
code already matches -- so a repeated code can corroborate a decision and can never overturn or
steal one.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot

# Beyond this a legend cannot plausibly be naming the run at all (working pixels at 200 DPI:
# ~19 mm). Legends sit alongside their conductor, not across the sheet from it.
MAX_OWNERSHIP_PX = 150.0

# Cost of owning nothing. Set at the distance beyond which we would rather leave a conductor black
# than guess: an assignment only happens when it is better than this.
REFUSE_COST = 90.0

# Penalty added when a legend's text direction disagrees with the run it would name. A legend is
# printed alongside its conductor, so a horizontal legend on a vertical wire is evidence against.
AXIS_MISMATCH_COST = 45.0


@dataclass
class OwnedRun:
    index: int
    points: list
    code: str | None
    legend_raw: str | None
    distance: float | None
    corroborations: int = 0        # extra legends carrying the same code that also fit this run
    propagated: bool = False       # coloured by continuation, not by a legend of its own
    contested: bool = False        # too many different codes nearby to be one cable
    confidence: float = 0.0        # auditable decision confidence, never used as a colour itself
    wire_probability: float | None = None
    abstained: bool = False
    abstain_reason: str | None = None
    abstained_from_code: str | None = None


def _nearest(x, y, points):
    """Distance to the polyline AND the direction of the segment that was nearest.

    The local direction matters, not the run's overall shape. A cable that turns a corner has no
    single orientation, and judging a legend against the run's bounding box asks the wrong
    question: a legend is printed alongside one particular stretch of wire, so that stretch is what
    its orientation must agree with.
    """
    best = float("inf")
    axis = None
    for a, b in zip(points, points[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            distance = hypot(x - a[0], y - a[1])
            local = None
        else:
            t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / length_sq))
            distance = hypot(x - (a[0] + t * dx), y - (a[1] + t * dy))
            local = "h" if abs(dx) >= abs(dy) else "v"
        if distance < best:
            best, axis = distance, local
            if best == 0.0:
                break
    return best, axis


def _distance_to_polyline(x, y, points):
    return _nearest(x, y, points)[0]


def _run_axis(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    dx, dy = max(xs) - min(xs), max(ys) - min(ys)
    if dx >= 1.5 * max(dy, 1e-6):
        return "h"
    if dy >= 1.5 * max(dx, 1e-6):
        return "v"
    return None


def cost(legend, points, run_axis=None, max_ownership_px=MAX_OWNERSHIP_PX,
         axis_mismatch_cost=AXIS_MISMATCH_COST):
    """Cost of legend naming this run, or None when it is not a candidate at all.

    Orientation is judged against the LOCAL direction of the nearest stretch of the conductor.
    Using the run's overall axis instead cost a real wire on pub 2542: an L-shaped cable spanning
    4,320 px horizontally and 2,363 px vertically was labelled "horizontal" by its bounding box, so
    the vertical legend printed 58 px from its vertical stretch collected the mismatch penalty and
    the total exceeded REFUSE_COST -- the legend refused a wire it was sitting next to, and 7,824 px
    of conductor stayed black.
    """
    distance, local_axis = _nearest(legend.x, legend.y, points)
    if distance > max_ownership_px:
        return None
    penalty = 0.0
    if local_axis is not None and legend.axis != local_axis:
        penalty += axis_mismatch_cost
    return distance + penalty


def assign(legends, runs):
    """Assign legends to runs as one global minimum-cost matching.

    ``runs`` is a list of point lists. Returns a list of ``OwnedRun``, one per input run.
    """
    import numpy as np
    from scipy.optimize import linear_sum_assignment

    axes = [_run_axis(points) for points in runs]
    owned = [OwnedRun(index=i, points=points, code=None, legend_raw=None, distance=None)
             for i, points in enumerate(runs)]
    if not legends or not runs:
        return owned

    n_legends, n_runs = len(legends), len(runs)
    # Columns: one per run, then one refusal column per legend. The refusal block is diagonal so a
    # legend can only ever refuse on its OWN column -- otherwise refusals would compete with each
    # other and the solver could be forced to accept a bad match to free a shared refusal slot.
    big = 1e6
    matrix = np.full((n_legends, n_runs + n_legends), big, dtype=float)
    for i, legend in enumerate(legends):
        for j, points in enumerate(runs):
            value = cost(legend, points)
            if value is not None:
                matrix[i, j] = value
        matrix[i, n_runs + i] = REFUSE_COST

    rows, cols = linear_sum_assignment(matrix)
    for i, j in zip(rows, cols):
        if j >= n_runs or matrix[i, j] >= big:
            continue                                   # refused, or no candidate at all
        legend = legends[i]
        owned[j].code = legend.code
        owned[j].legend_raw = legend.raw
        owned[j].distance = round(float(matrix[i, j]), 1)

    # Corroboration pass: a repeated code can confirm a run, never capture one. Legends that
    # refused are allowed to attach to an already-assigned run only when the code already agrees,
    # so the same code printed at both ends of a conductor becomes free evidence rather than a
    # competing claim. This never changes a colour, so it cannot introduce a wrong one.
    assigned_legends = {i for i, j in zip(rows, cols) if j < n_runs and matrix[i, j] < big}
    for i, legend in enumerate(legends):
        if i in assigned_legends:
            continue
        for j, run in enumerate(owned):
            if run.code != legend.code:
                continue
            if cost(legend, run.points) is not None:
                run.corroborations += 1
                break
    return owned


def corroboration_rate(owned):
    """Fraction of painted runs confirmed by a second printed copy of the same code.

    Free accuracy signal: it needs no annotation and no human. A conductor whose code is printed at
    both ends and assigned consistently at both is very unlikely to be a mis-assignment, so this is
    the one quality number available on a sheet nobody has ever reviewed.
    """
    painted = [run for run in owned if run.code]
    if not painted:
        return 0.0
    return sum(1 for run in painted if run.corroborations) / len(painted)


def _outward(run, at_start):
    """Unit vector pointing OUT of the run at one end, and the end point itself."""
    from math import hypot
    if at_start:
        (x0, y0), (x1, y1) = run.points[0], run.points[1]
        tip, inward = run.points[0], (x1 - x0, y1 - y0)
    else:
        (x0, y0), (x1, y1) = run.points[-1], run.points[-2]
        tip, inward = run.points[-1], (x1 - x0, y1 - y0)
    length = hypot(*inward) or 1.0
    # outward = away from the body, i.e. the reverse of the inward step
    return tip, (-inward[0] / length, -inward[1] / length)


def bridge_straight_continuations(owned, max_gap_px, min_conductor_px,
                                  angle_tol_deg=12.0, max_passes=8,
                                  lateral_min_px=6.0, lateral_factor=0.12,
                                  blocked_zones=()):
    """Carry a colour across a small gap to the run that continues STRAIGHT on the far side.

    A component symbol drawn on a conductor -- a hop, a bowtie twisted-pair mark, a small box --
    interrupts the stroke, so the two halves of one cable become two runs that do not share a node.
    Only the half beside the legend gets painted and the cable turns black at the symbol. Twelve of
    the round-1 audit's defects were exactly that.

    The bridge is deliberately narrow, because guessing a continuation is how a wrong colour
    spreads. A coloured run's open end is joined to an uncoded run's open end only when:

      * the gap is short (a symbol's width, not a routing distance),
      * the far run leaves its end pointing back along the SAME straight line (collinear, within a
        few degrees) -- never around a corner, which is the case the audit's wrong-colour bleed
        came from,
      * the far end sits squarely ahead, not off to one side, and
      * it is the ONLY uncoded candidate in that cone -- at a fork we decline rather than guess,
      * the gap does not cross a component zone. A fuse, switch, contact, connector, terminal or
        unknown closed symbol is a physical conductor boundary, even when both sides are collinear.

    Only uncoded runs are ever painted, so this can add paint but never change an existing colour.
    """
    from math import atan2, cos, degrees, hypot, radians, sin

    tol = radians(angle_tol_deg)
    lateral_limit = max(lateral_min_px, lateral_factor * min_conductor_px)

    def crosses_blocked_zone(a, b):
        """Conservative segment/rectangle intersection, including an endpoint inside the zone."""
        for x0, y0, x1, y1 in blocked_zones:
            if x0 <= a[0] <= x1 and y0 <= a[1] <= y1:
                return True
            if x0 <= b[0] <= x1 and y0 <= b[1] <= y1:
                return True
            dx, dy = b[0] - a[0], b[1] - a[1]
            for edge, value, lo, hi in (("x", x0, y0, y1), ("x", x1, y0, y1),
                                        ("y", y0, x0, x1), ("y", y1, x0, x1)):
                delta = dx if edge == "x" else dy
                if abs(delta) < 1e-9:
                    continue
                origin = a[0] if edge == "x" else a[1]
                t = (value - origin) / delta
                if 0.0 <= t <= 1.0:
                    other = a[1] + t * dy if edge == "x" else a[0] + t * dx
                    if lo <= other <= hi:
                        return True
        return False

    added = 0
    for _ in range(max_passes):
        # open ends, recomputed each pass because a bridge can extend a coloured chain
        ends = []
        for run in owned:
            if len(run.points) < 2:
                continue
            for at_start in (True, False):
                tip, out = _outward(run, at_start)
                ends.append((run, tip, out))

        changed = 0
        for run, tip, out in ends:
            if not run.code:
                continue
            base = atan2(out[1], out[0])
            candidates = []
            for other, tip2, out2 in ends:
                if other is run or other.code:
                    continue
                gap = hypot(tip2[0] - tip[0], tip2[1] - tip[1])
                if gap < 0.5 or gap > max_gap_px:
                    continue
                if crosses_blocked_zone(tip, tip2):
                    continue
                # the far end must lie ahead, along `out`
                ahead = atan2(tip2[1] - tip[1], tip2[0] - tip[0])
                if abs((ahead - base + 3.14159) % 6.28318 - 3.14159) > tol:
                    continue
                # and it must leave its own body pointing back toward us (collinear, not a corner)
                back = atan2(-out2[1], -out2[0])
                if abs((back - base + 3.14159) % 6.28318 - 3.14159) > tol:
                    continue
                # lateral offset of the far tip from our ray
                lateral = abs(-sin(base) * (tip2[0] - tip[0]) + cos(base) * (tip2[1] - tip[1]))
                if lateral > lateral_limit:
                    continue
                candidates.append((gap, other))
            if len(candidates) == 1:
                other = candidates[0][1]
                other.code = run.code
                other.legend_raw = run.legend_raw
                other.propagated = True
                if hasattr(other, "confidence"):
                    other.confidence = max(getattr(other, "confidence", 0.0),
                                           0.75 * getattr(run, "confidence", 0.0))
                changed += 1
        added += changed
        if not changed:
            break
    return added


# A promoted bare single letter is only trusted where it paints a real cable. Measured: genuine
# bare-letter conductors run 6.5x the min-conductor floor and up (the pub34 starter R is 636 px, 9x);
# the connector-pin stubs a bare letter wrongly claims are <=2.9x. 4x sits cleanly between them.
PROMOTED_MIN_RUN_FACTOR = 4.0


def _length_pts(points):
    return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


# A run whose traced length far exceeds its bounding-box diagonal folds back on itself -- the
# internal zig-zag of a connector pin-strip, not a routed cable. A weak bare-letter legend must not
# claim one. Measured: real cables run 1.0-1.9x their bbox diagonal; a pub80 connector strip that a
# promoted 'R' grabbed folds at 3.4x. 2.5 sits clear of every real cable measured.
PROMOTED_MAX_FOLD = 2.5


def _folds_back(points, fold_max):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    diagonal = hypot(max(xs) - min(xs), max(ys) - min(ys))
    return _length_pts(points) > fold_max * max(diagonal, 1.0)


def assign_weak_to_leftovers(owned, weak_legends, min_run_px, policy=None):
    """Let weak (promoted bare-letter) legends claim ONLY runs the strong pass left black.

    A bare single letter is weak evidence, so it must never compete in the main matching: on pub80 a
    promoted bare ``R`` entering the global assignment displaced a gauged ``R 1,5`` onto a connector
    pin-strip, painting a non-wire red. Running the weak legends in a SECOND phase, against only the
    already-uncoloured runs, removes that whole displacement class -- the strong assignment is exactly
    what it was before promotion, and a bare letter can at most ADD paint to a leftover run.

    A length gate keeps it off short connector stubs (a real bare-letter cable is many min-conductor
    lengths; a stub is one or two). Greedy nearest within the ownership radius: each weak legend takes
    its cheapest free long run, each run goes to at most one legend. Returns the count assigned.
    """
    refuse_cost = REFUSE_COST if policy is None else policy.refuse_cost
    max_ownership_px = MAX_OWNERSHIP_PX if policy is None else policy.max_ownership_px
    axis_mismatch_cost = AXIS_MISMATCH_COST if policy is None else policy.axis_mismatch_cost
    fold_max = PROMOTED_MAX_FOLD if policy is None else policy.promoted_max_fold
    free = [run for run in owned if not run.code and len(run.points) >= 2
            and _length_pts(run.points) >= min_run_px
            and not _folds_back(run.points, fold_max)]
    pairs = []
    for legend in weak_legends:
        for run in free:
            value = cost(legend, run.points, max_ownership_px=max_ownership_px,
                         axis_mismatch_cost=axis_mismatch_cost)
            if value is not None and value < refuse_cost:
                pairs.append((value, id(run), id(legend), legend, run))
    pairs.sort(key=lambda t: (t[0], t[1], t[2]))       # cheapest first; ids only to break ties safely
    used_runs, used_legends, assigned = set(), set(), 0
    for value, run_id, legend_id, legend, run in pairs:
        if run_id in used_runs or legend_id in used_legends:
            continue
        run.code = legend.code
        run.legend_raw = legend.raw
        run.distance = round(float(value), 1)
        run.confidence = max(0.0, min(1.0, 1.0 - value / max(refuse_cost, 1.0)))
        used_runs.add(run_id)
        used_legends.add(legend_id)
        assigned += 1
    return assigned


def propagate_continuations(owned, snap_px=1.5, max_passes=12):
    """Carry colour only through an unbranched degree-2 physical continuation.

    Electrical connectivity and conductor identity are different layers. A splice, terminal or
    star point can connect several independently manufactured wires, each with its own colour. A
    node of degree three or more is therefore a hard boundary: an unlabelled branch stays black.

    At degree two, one coded run and one uncoded run are the two visible pieces of the same physical
    stroke after vector decomposition. The uncoded half may inherit the code. Conflicting explicit
    codes still stop propagation, and an existing assignment is never overwritten.
    """
    def key(point):
        return (round(point[0] / snap_px), round(point[1] / snap_px))

    nodes = {}
    for run in owned:
        if len(run.points) < 2:
            continue
        for point in (run.points[0], run.points[-1]):
            nodes.setdefault(key(point), []).append(run)

    added = 0
    for _ in range(max_passes):
        changed = 0
        for incident in nodes.values():
            unique_incident = list({id(run): run for run in incident}.values())
            if len(unique_incident) != 2:
                continue                      # splice/fork/terminal: physical colour boundary
            codes = {run.code for run in unique_incident if run.code}
            if len(codes) != 1:
                continue                      # nothing to give, or a real colour boundary
            code = next(iter(codes))
            source = next(run for run in unique_incident if run.code == code)
            for run in unique_incident:
                if run.code:
                    continue
                run.code = code
                run.legend_raw = source.legend_raw
                run.propagated = True
                run.confidence = max(run.confidence, 0.8 * source.confidence)
                changed += 1
        added += changed
        if not changed:
            break
    return added
