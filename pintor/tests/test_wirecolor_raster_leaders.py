"""A code with a callout leader names the wire the leader ends on, even across a crossing wire."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.raster_leaders import detach_leaders, find_leaders  # noqa: E402
from wirecolor.detect.solver import solve  # noqa: E402


def _segment(points):
    k = min(14, len(points) - 1)
    return {"order": points, "ends": [points[0], points[-1]],
            "tang": [(points[0][0] - points[k][0], points[0][1] - points[k][1]),
                     (points[-1][0] - points[-1 - k][0], points[-1][1] - points[-1 - k][1])]}


def _horizontal(y, x0, x1):
    return _segment([(y, x) for x in range(x0, x1 + 1)])


def _vertical(x, y0, y1):
    step = 1 if y1 >= y0 else -1
    return _segment([(y, x) for y in range(y0, y1 + step, step)])


def _label(code="R/PU", cx=100, cy=200, w=50, h=26):
    return {"code": code, "raw": code, "score": 0.99, "cx": cx, "cy": cy, "w": w, "h": h,
            "box": [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2],
                    [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]}


def _callout_across_a_wire():
    """R/PU below two wires; its leader crosses the PU wire (y=160) to end on the R/PU wire (y=130)."""
    return [
        _vertical(100, 183, 163),           # 0 leader, from the text up to the crossing
        _horizontal(160, 20, 97),           # 1 crossed wire, left of the junction
        _horizontal(160, 103, 200),         # 2 crossed wire, right of it
        _vertical(100, 157, 133),           # 3 leader beyond the crossing
        _horizontal(130, 20, 97),           # 4 named wire, left half
        _horizontal(130, 103, 260),         # 5 named wire, right half
    ]


class FindLeaders(unittest.TestCase):
    def test_the_leader_is_followed_across_a_crossing_to_the_wire_it_ends_on(self):
        leaders = find_leaders(_callout_across_a_wire(), set(), [_label()])
        self.assertEqual(leaders, {0: ([0, 3], 5)})

    def test_detaching_moves_the_leader_out_of_the_topology(self):
        twist, labels = set(), [_label()]
        self.assertEqual(detach_leaders(_callout_across_a_wire(), twist, labels), 1)
        self.assertEqual(twist, {0, 3})
        self.assertEqual(labels[0]["leader_target"], 5)

    def test_a_wire_cut_by_a_code_printed_on_it_is_not_a_leader(self):
        segments = [_horizontal(200, 20, 72), _horizontal(200, 128, 200),
                    _vertical(30, 140, 197)]
        self.assertEqual(find_leaders(segments, set(), [_label()]), {})

    def test_a_wire_with_a_code_printed_across_it_is_not_a_leader(self):
        segments = _callout_across_a_wire()[:3] + [_vertical(100, 217, 280)]
        self.assertEqual(find_leaders(segments, set(), [_label()]), {})

    def test_a_line_that_ends_on_nothing_is_not_a_leader(self):
        self.assertEqual(find_leaders([_vertical(100, 183, 150)], set(), [_label()]), {})

    def test_a_code_in_a_terminal_cell_has_no_leader(self):
        label = _label()
        label["pin_cell"] = (70, 180, 130, 220)
        self.assertEqual(find_leaders(_callout_across_a_wire(), set(), [label]), {})


class SolverOwnership(unittest.TestCase):
    def test_the_code_seeds_the_wire_its_leader_ends_on_not_the_crossed_one(self):
        segments = _callout_across_a_wire()
        twist, labels = set(), [_label()]
        loose = solve(segments, set(), [_label()], lambda *_a: False, lambda *_a: None,
                      np.zeros((300, 300), bool), 300, 300)
        self.assertNotIn(loose["seeds"][0][1], (4, 5))                 # the old behaviour
        detach_leaders(segments, twist, labels)
        sol = solve(segments, twist, labels, lambda *_a: False, lambda *_a: None,
                    np.zeros((300, 300), bool), 300, 300)
        self.assertEqual([si for _label_, si in sol["seeds"]], [5])


if __name__ == "__main__":
    unittest.main()
