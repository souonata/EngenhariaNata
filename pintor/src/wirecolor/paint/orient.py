"""Consistent traversal orientation for two-colour stripe rendering (round-7 fix).

The two stripes of an `X/Y` band are drawn at +d and -d perpendicular offsets from the arc's
polyline, so WHICH colour lands on which side depends on the direction the arc happens to be
traversed. The skeleton cuts a wire into a new arc at every crossing, each with an arbitrary
direction -- so the stripe pair visibly swapped sides at crossings and corners (user pink
markup, pub 2550, 9 of 10 marks).

Fix: orient arcs consistently along each solver MATE CHAIN (the solver already knows which arc
continues which), then canonicalize the whole chain with a jitter-safe dominant-axis rule.
Stripe sides now propagate unbroken through crossings and corners; chains still break at
junction dots (a star point's spokes are separate conductors joining at the dot, where a fixed
side-assignment is geometrically impossible anyway).
"""
from __future__ import annotations


def _canonical_forward(order) -> bool:
    """True if the end-to-end direction is 'forward' under the dominant-axis rule
    (horizontal-ish arcs point +x, vertical-ish arcs point +y). Dominant axis, not
    lexicographic, so 1-px endpoint jitter on an axis-aligned run can never flip a chain."""
    (y0, x0), (y1, x1) = order[0], order[-1]
    dx, dy = x1 - x0, y1 - y0
    if abs(dx) >= abs(dy):
        return dx >= 0
    return dy >= 0


def orient_segments(segments, mate) -> dict:
    """arc index -> True (traverse stored order) / False (traverse reversed).

    Entering an arc at port k means traversing k -> 1-k; 'forward' = entered at port 0.
    For every chain: walk to one unmated end (or around a cycle), then sweep rightward
    assigning orientations, and finally flip the whole chain if its first arc's traversal
    violates the canonical rule."""
    orient = {}
    for s0 in range(len(segments)):
        if s0 in orient or not segments[s0]["order"]:
            continue
        # walk left to the chain's far end
        cur_arc, cur_entry = s0, 0
        seen = {s0}
        while True:
            far = mate.get((cur_arc, cur_entry))
            if far is None:
                break
            sj, kj = far
            if sj in seen:          # cycle: start the sweep here
                break
            seen.add(sj)
            cur_arc, cur_entry = sj, 1 - kj
        # sweep rightward
        chain = []
        arc, entry = cur_arc, cur_entry
        swept = set()
        while arc not in swept:
            swept.add(arc)
            chain.append((arc, entry == 0))
            nxt = mate.get((arc, 1 - entry))
            if nxt is None:
                break
            arc, entry = nxt
        first_arc, first_fwd = chain[0]
        o = segments[first_arc]["order"]
        flip = not _canonical_forward(o if first_fwd else o[::-1])
        for arc, fwd in chain:
            orient[arc] = fwd != flip
    return orient
