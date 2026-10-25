"""Callout leaders on vector schematics: the short line from a printed code to the wire it names.

The factory-coloured gasoline sheets print most codes away from the bundle and draw a thin straight
leader from the text to the one conductor it names. Read as geometry, that leader did two kinds of
damage:

* it touched the conductor and made a T, so the conductor was cut into pieces at every callout and
  colour could not continue across the three-way node -- the far pieces stayed black;
* ownership measured from the text, which on a bundle is often nearer a neighbour than the
  conductor the leader actually touches -- a wrong colour, the worst failure this product has.

A leader is recognised only by drawing evidence. It is one short straight segment; one end is free
(nothing else touches it) and lies against the text of exactly one code; the other end lands on
another segment. Such a segment is annotation, not a conductor: it leaves the topology, and its
code is anchored where it touches the wire.

A leader lands on the body of a wire and makes a T: inside one stroke, or where two strokes of a
straight wire meet. Anywhere else the "leader" is the wire's own stub between its code and the next
node:

* where one stroke starts, the wire turns a corner, as with a code printed in a wire that leaves
  the text and bends away;
* where three or more strokes meet, the wire runs from the text to a junction, as with a code
  printed across a wire that rises to a star point.

Measured on pub 7745609, those stubs were taken for leaders 81 times: the stub left the topology,
the code was anchored on the corner or the star point, and the wire it is printed in stayed black.
"""
from __future__ import annotations

from dataclasses import replace
from math import hypot

# In page points; converted with the working resolution.
MIN_LEADER_PT = 2.0
MAX_LEADER_PT = 30.0
TEXT_GAP_PT = 3.0
TOUCH_PT = 1.0


def _distance_to_segment(point, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return hypot(point[0] - ax, point[1] - ay), a
    t = max(0.0, min(1.0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / length_sq))
    foot = (ax + t * dx, ay + t * dy)
    return hypot(point[0] - foot[0], point[1] - foot[1]), foot


def _line_distance(point, a, b):
    """Distance from ``point`` to the infinite line through a and b."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = hypot(dx, dy)
    if length == 0:
        return hypot(point[0] - a[0], point[1] - a[1])
    return abs(dy * (point[0] - a[0]) - dx * (point[1] - a[1])) / length


def _near_box(point, box, gap):
    x0, y0, x1, y1 = box
    return x0 - gap <= point[0] <= x1 + gap and y0 - gap <= point[1] <= y1 + gap


class _Grid:
    def __init__(self, segments, cell):
        self.cell = cell
        self.cells = {}
        for index, (a, b) in enumerate(segments):
            x0, x1 = sorted((a[0], b[0]))
            y0, y1 = sorted((a[1], b[1]))
            for cx in range(int(x0 // cell), int(x1 // cell) + 1):
                for cy in range(int(y0 // cell), int(y1 // cell) + 1):
                    self.cells.setdefault((cx, cy), []).append(index)

    def near(self, point):
        cx, cy = int(point[0] // self.cell), int(point[1] // self.cell)
        seen = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for index in self.cells.get((cx + dx, cy + dy), ()):
                    if index not in seen:
                        seen.add(index)
                        yield index


def detach_leaders(segments, legends, dpi):
    """Split callout leaders out of ``segments`` and anchor their codes on the wire they touch.

    Returns ``(segments_without_leaders, legends, leader_count)``. Legends without a leader are
    returned unchanged and in the same order.
    """
    scale = dpi / 72.0
    lowest, highest = MIN_LEADER_PT * scale, MAX_LEADER_PT * scale
    gap, touch = TEXT_GAP_PT * scale, TOUCH_PT * scale
    grid = _Grid(segments, cell=max(highest, 8.0))

    def touching(point, own):
        found = []
        for index in grid.near(point):
            if index == own:
                continue
            distance, foot = _distance_to_segment(point, *segments[index])
            if distance <= touch:
                found.append((index, foot))
        return found

    def along(index, other):
        """True when ``other`` is a copy of stroke ``index`` drawn over it, not its continuation."""
        (a, b), (c, d) = segments[index], segments[other]
        if any(_line_distance(point, c, d) > touch for point in (a, b)):
            return False
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = hypot(dx, dy)
        if length == 0:
            return False
        project = lambda point: ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length
        low, high = sorted((project(c), project(d)))
        return min(high, length) - max(low, 0.0) > touch

    def at_end(point, other):
        a, b = segments[other]
        return min(hypot(point[0] - a[0], point[1] - a[1]),
                   hypot(point[0] - b[0], point[1] - b[1])) <= touch

    def straight(first, second):
        (a, b), (c, d) = segments[first], segments[second]
        return _line_distance(c, a, b) <= touch and _line_distance(d, a, b) <= touch

    def node(index, point, targets):
        """True when the tip is a corner or a junction of the wire, not a point on its body."""
        # Some sheets draw a leader twice; its copy is neither, and nothing else is evidence.
        others = [target for target, _foot in targets if not along(index, target)]
        if not others or any(not at_end(point, other) for other in others):
            return False
        return not (len(others) == 2 and straight(*others))

    candidates = []
    boxed = [(index, legend) for index, legend in enumerate(legends) if legend.bbox]
    for index, (a, b) in enumerate(segments):
        length = hypot(b[0] - a[0], b[1] - a[1])
        if not lowest <= length <= highest:
            continue
        for free, tip in ((a, b), (b, a)):
            owners = [number for number, legend in boxed if _near_box(free, legend.bbox, gap)]
            if len(owners) != 1 or _near_box(tip, legends[owners[0]].bbox, gap):
                continue
            if touching(free, index):
                continue
            targets = touching(tip, index)
            if not targets or node(index, tip, targets):
                continue
            target_index, foot = targets[0]
            ta, tb = segments[target_index]
            axis = "h" if abs(tb[0] - ta[0]) >= abs(tb[1] - ta[1]) else "v"
            box = legends[owners[0]].bbox
            gap_to_text = hypot(free[0] - min(max(free[0], box[0]), box[2]),
                                free[1] - min(max(free[1], box[1]), box[3]))
            candidates.append((gap_to_text, length, owners[0], index, foot, axis))

    used_legends, used_segments, anchors = set(), set(), {}
    for _gap, _length, legend_index, segment_index, foot, axis in sorted(candidates):
        if legend_index in used_legends or segment_index in used_segments:
            continue
        used_legends.add(legend_index)
        used_segments.add(segment_index)
        anchors[legend_index] = (foot, axis)

    kept = [segment for index, segment in enumerate(segments) if index not in used_segments]
    moved = [replace(legend, x=anchors[index][0][0], y=anchors[index][0][1],
                     axis=anchors[index][1], leader=True) if index in anchors else legend
             for index, legend in enumerate(legends)]
    return kept, moved, len(used_segments)
