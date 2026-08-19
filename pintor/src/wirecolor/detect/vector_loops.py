"""Clear colour that spread around a component symbol's outline.

The failure, seen on pub 77's injector actuators and marked by the user on several sheets: a wire
carries its colour into the box symbol it terminates in, and the colour then spreads around the
box outline, so the injector, relay or sensor case is painted in the wire's colour. The symbol
detector in ``vector_symbols`` misses these: the box is drawn as separate, open edge segments, not
one closed subpath, so nothing strips it before topology is built, and it is too irregular to be
recognised as a closed rectangle afterwards.

The signature that DOES separate a symbol outline from a conductor is how the colour got there. A
symbol edge is: (1) coloured only by PROPAGATION, never owning a legend of its own; (2) SHORT, a
single pin pitch, not a routed run; and (3) part of a tight CLUSTER of such edges packed into a
component-sized bounding box. A real cable fails at least one of these -- it owns its legend, or it
is long, or it leaves the area. A splice branch, the other thing propagation paints, leaves the
area too, so its cluster bounding box is large. Clearing the small clusters dissolves the box
outline while leaving every conductor and every splice branch painted.

This can only remove colour, never add or change it -- an unpainted line is a miss, a wrongly
coloured one is a lie.
"""
from __future__ import annotations

from math import hypot

# An edge is "short" below this many min-conductor lengths. A box edge spans one pin pitch, just
# over the conductor floor; a routed cable is well above it. Measured on pub 77 the injector box
# edges are 1.0-2.4 floors.
SHORT_FACTOR = 3.5

# The whole cluster must fit in a box this big (fraction of page diagonal, long side). Injector and
# relay outlines measure ~5% of the diagonal; 10% is the component ceiling. A splice whose branches
# fan out across the sheet blows past this and is left alone.
MAX_CLUSTER_SIDE_FRACTION = 0.10

# Fewest edges to call it a symbol. Two short propagated edges meeting in a small box is already a
# corner of an outline; a lone short branch is not enough and stays painted.
MIN_CLUSTER_RUNS = 2

SNAP_PX = 2.0


def _run_length(points):
    return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


def _key(point):
    return (round(point[0] / SNAP_PX), round(point[1] / SNAP_PX))


def strip_symbol_clusters(owned_runs, page_diagonal_px, min_conductor_px,
                          short_factor=SHORT_FACTOR, max_side_fraction=MAX_CLUSTER_SIDE_FRACTION,
                          min_runs=MIN_CLUSTER_RUNS):
    """Clear the code on short, propagated runs that form a component-sized cluster.

    Returns how many runs were cleared. ``owned_runs`` is mutated in place.
    """
    short_limit = short_factor * min_conductor_px
    edges = [run for run in owned_runs
             if run.code and getattr(run, "propagated", False) and len(run.points) >= 2
             and _run_length(run.points) < short_limit]
    if not edges:
        return 0

    # Where a painted LONG run (a conductor) touches the page. A cluster edge sitting on such a
    # node is the wire stub entering the box, not an outline edge -- sparing it keeps the wire that
    # attaches to the component connected, instead of blacking the short piece between box and bend.
    edge_ids = {id(run) for run in edges}
    wire_nodes = set()
    for run in owned_runs:
        if run.code and len(run.points) >= 2 and id(run) not in edge_ids \
                and _run_length(run.points) >= short_limit:
            wire_nodes.add(_key(run.points[0]))
            wire_nodes.add(_key(run.points[-1]))

    parent = {id(run): id(run) for run in edges}

    def find(node):
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    incident = {}
    for run in edges:
        for point in (run.points[0], run.points[-1]):
            incident.setdefault(_key(point), []).append(run)
    for runs in incident.values():
        for other in runs[1:]:
            parent[find(id(runs[0]))] = find(id(other))

    groups = {}
    for run in edges:
        groups.setdefault(find(id(run)), []).append(run)

    max_side = max_side_fraction * page_diagonal_px
    cleared = 0
    for members in groups.values():
        if len(members) < min_runs:
            continue
        xs = [p[0] for run in members for p in run.points]
        ys = [p[1] for run in members for p in run.points]
        if (max(xs) - min(xs)) > max_side or (max(ys) - min(ys)) > max_side:
            continue                              # too big to be a component outline
        for run in members:
            if _key(run.points[0]) in wire_nodes or _key(run.points[-1]) in wire_nodes:
                continue                          # the wire stub into the box -- keep it painted
            run.code = None
            run.propagated = False
            cleared += 1
    return cleared
