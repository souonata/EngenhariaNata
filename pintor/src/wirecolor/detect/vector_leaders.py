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

    def touches(point, own):
        for index in grid.near(point):
            if index == own:
                continue
            distance, foot = _distance_to_segment(point, *segments[index])
            if distance <= touch:
                return index, foot
        return None

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
            if touches(free, index) is not None:
                continue
            target = touches(tip, index)
            if target is None:
                continue
            target_index, foot = target
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
