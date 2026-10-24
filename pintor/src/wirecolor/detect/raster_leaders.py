"""Callout leaders on scanned schematics: the thin line from a printed code to the wire it names.

The vector route detaches leaders from exact strokes (``vector_leaders.py``). A scan has only the
skeleton, and there a leader is harder to see: every wire it crosses on the way cuts it into
pieces at a junction. On a rasterised factory page (pub 7743245 p5) the leader from ``R/PU``
crosses a PU wire before it reaches the R/PU wire; the code was attached to the crossed PU wire,
which is nearer the text, and the two leader pieces were painted as if they were cable.

A leader is recognised only by drawing evidence:

* its first piece is short and straight, and starts free (nothing else touches that end) against
  the text of exactly one code;
* it leaves the code across the code's own axis -- a wire cut by a code printed on it runs along
  the text, a leader does not -- and nothing continues in line on the far side of the code: a code
  printed across a wire (two ``T/SB`` on pub 7749124 p7) cuts that wire into two in-line pieces;
* it continues straight through a crossing, where the crossed wire passes on both sides, until it
  ends on a wire: one arc, or the two halves of one wire, and nothing straight beyond;
* the whole line is no longer than a callout (30 pt).

The code is then anchored on that wire and the leader pieces leave the topology.
"""
from __future__ import annotations

from math import hypot

# At the 200-DPI working resolution of the scan route.
MAX_LEADER_PX = 84            # 30 pt
TEXT_GAP_PX = 10              # labels are erased from the wire mask with a 3 px margin
JOIN_PX = 10                  # the skeleton cuts a 5x5 hole at every junction
STRAIGHT_PX = 2.0             # largest deviation of a straight piece from its chord
MIN_TARGET_PX = 24            # a leader names a wire, not a fragment of an outline
ALONG_TEXT_COS = 0.87         # a leader leaving within 30 degrees of the text axis is a wire
CONTINUE_COS = 0.95
OPPOSITE_COS = -0.8
IN_LINE_PX = 6                # how far off the line a wire beyond the code may still lie


def _rect(label):
    xs = [p[0] for p in label["box"]]
    ys = [p[1] for p in label["box"]]
    return min(xs), min(ys), max(xs), max(ys)


def _gap_to_rect(point, rect):
    y, x = point
    x0, y0, x1, y1 = rect
    return hypot(max(x0 - x, 0.0, x - x1), max(y0 - y, 0.0, y - y1))


def _unit(vy, vx):
    length = hypot(vy, vx)
    return (vy / length, vx / length) if length else (0.0, 0.0)


def _chord(segment):
    (ay, ax), (by, bx) = segment["ends"]
    return hypot(by - ay, bx - ax)


def _straight(segment):
    (ay, ax), (by, bx) = segment["ends"]
    chord = hypot(by - ay, bx - ax)
    if chord < 4:
        return False
    return all(abs((by - ay) * (x - ax) - (bx - ax) * (y - ay)) / chord <= STRAIGHT_PX
               for y, x in segment["order"][::2])


def _inward(segment, k):
    """Direction from end ``k`` into the arc."""
    ty, tx = segment["tang"][k]
    return _unit(-ty, -tx)


def find_leaders(segments, twist, labels):
    """Map label index -> (leader arc indices, target arc index) for every recognised leader."""
    ends = {}
    for si, segment in enumerate(segments):
        if si in twist:
            continue
        for k, (y, x) in enumerate(segment["ends"]):
            ends.setdefault((round(y / JOIN_PX), round(x / JOIN_PX)), []).append((si, k))

    def ends_near(point, exclude=()):
        y, x = point
        found = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for si, k in ends.get((round(y / JOIN_PX) + dy, round(x / JOIN_PX) + dx), ()):
                    if si in exclude:
                        continue
                    ey, ex = segments[si]["ends"][k]
                    if hypot(ey - y, ex - x) <= JOIN_PX:
                        found.append((si, k))
        return found

    rects = [None if label.get("pin_cell") is not None else _rect(label) for label in labels]
    candidates = []
    for si, segment in enumerate(segments):
        if si in twist or not _straight(segment) or _chord(segment) > MAX_LEADER_PX:
            continue
        for k in (0, 1):
            free = segment["ends"][k]
            owners = [index for index, rect in enumerate(rects)
                      if rect is not None and _gap_to_rect(free, rect) <= TEXT_GAP_PX]
            if len(owners) != 1 or ends_near(free, exclude={si}):
                continue
            owner = owners[0]
            x0, y0, x1, y1 = rects[owner]
            direction = _inward(segment, k)
            along = abs(direction[1]) if (x1 - x0) >= (y1 - y0) else abs(direction[0])
            if along >= ALONG_TEXT_COS:
                continue
            if _continues_beyond(segments, si, free, direction, rects[owner], ends):
                continue
            walked = _walk(segments, twist, si, 1 - k, direction, ends_near)
            if walked is None:
                continue
            chain, target = walked
            candidates.append((_gap_to_rect(free, rects[owner]), owner, chain, target))

    leaders, used = {}, set()
    for _gap, owner, chain, target in sorted(candidates, key=lambda c: c[0]):
        if owner in leaders or used & set(chain):
            continue
        leaders[owner] = (chain, target)
        used |= set(chain)
    return leaders


def _continues_beyond(segments, own, free, direction, rect, ends):
    """True when a piece on the code's far side carries on the same line: a wire through the text."""
    fy, fx = free
    for pieces in ends.values():
        for si, k in pieces:
            if si == own:
                continue
            end = segments[si]["ends"][k]
            if _gap_to_rect(end, rect) > TEXT_GAP_PX:
                continue
            vy, vx = end[0] - fy, end[1] - fx
            behind = vy * direction[0] + vx * direction[1]
            lateral = abs(vy * direction[1] - vx * direction[0])
            inward = _inward(segments[si], k)
            if (behind < 0 and lateral <= IN_LINE_PX
                    and inward[0] * direction[0] + inward[1] * direction[1] <= -0.9):
                return True
    return False


def _walk(segments, twist, first, far_end, direction, ends_near):
    """Follow a leader through crossings to the wire it ends on; None if it is not a leader."""
    chain = [first]
    length = _chord(segments[first])
    tip = segments[first]["ends"][far_end]
    while True:
        here = ends_near(tip, exclude=set(chain))
        onward = [(si, k) for si, k in here
                  if _straight(segments[si])
                  and sum(a * b for a, b in zip(_inward(segments[si], k), direction))
                  >= CONTINUE_COS]
        crossed = [(si, k) for si, k in here if (si, k) not in onward]
        if (len(onward) == 1 and len(crossed) == 2
                and _opposite(segments, crossed)
                and length + _chord(segments[onward[0][0]]) <= MAX_LEADER_PX):
            si, k = onward[0]
            chain.append(si)
            length += _chord(segments[si])
            tip = segments[si]["ends"][1 - k]
            continue
        if onward or not crossed or len(crossed) > 2:
            return None
        if len(crossed) == 2 and not _opposite(segments, crossed):
            return None
        target = max((si for si, _k in crossed), key=lambda si: len(segments[si]["order"]))
        if target in twist or len(segments[target]["order"]) < MIN_TARGET_PX:
            return None
        return chain, target


def _opposite(segments, pair):
    (sa, ka), (sb, kb) = pair
    a, b = _inward(segments[sa], ka), _inward(segments[sb], kb)
    return a[0] * b[0] + a[1] * b[1] <= OPPOSITE_COS


def detach_leaders(segments, twist, labels):
    """Anchor each leader's code on its wire (``label["leader_target"]``); leaders join ``twist``.

    Returns the number of leaders. Annotations from an earlier topology are cleared first, because
    the pipeline rebuilds the skeleton after cutting inline components.
    """
    for label in labels:
        label.pop("leader_target", None)
    leaders = find_leaders(segments, twist, labels)
    for owner, (chain, target) in leaders.items():
        labels[owner]["leader_target"] = target
        twist.update(chain)
    return len(leaders)
