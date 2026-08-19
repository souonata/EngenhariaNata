"""Regression tests for removal-only drawing-furniture guards."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.detect.dashes import find_unlabelled_frame_roots
from wirecolor.detect.housings import find_dense_pin_border_arcs


def _segment(points):
    return {"order": points, "ends": (points[0], points[-1])}


def _horizontal(y, x0, x1):
    return _segment([(y, x) for x in range(x0, x1 + 1)])


def _vertical(x, y0, y1):
    return _segment([(y, x) for y in range(y0, y1 + 1)])


class DashFrameGuardTests(unittest.TestCase):
    def test_complete_unlabelled_rectangle_is_guarded(self):
        segments = [
            _horizontal(100, 100, 400),
            _horizontal(300, 100, 400),
            _vertical(100, 100, 300),
            _vertical(400, 100, 300),
        ]
        unlabelled = {10: [0], 11: [1], 12: [2], 13: [3]}

        self.assertEqual(
            find_unlabelled_frame_roots(unlabelled, segments),
            {10, 11, 12, 13},
        )

    def test_incomplete_frame_is_not_guarded(self):
        segments = [
            _horizontal(100, 100, 400),
            _horizontal(300, 100, 400),
            _vertical(100, 100, 300),
        ]
        unlabelled = {10: [0], 11: [1], 12: [2]}

        self.assertEqual(find_unlabelled_frame_roots(unlabelled, segments), set())


class DensePinBorderGuardTests(unittest.TestCase):
    def test_dense_horizontal_pin_row_is_guarded(self):
        segments = [
            _horizontal(100, 0, 45),
            _horizontal(100, 70, 115),
            _horizontal(100, 140, 185),
            _horizontal(100, 210, 300),
            _vertical(10, 30, 80),
            _vertical(80, 30, 80),
            _vertical(150, 30, 80),
            _vertical(220, 30, 80),
            _segment([(84, 6), (90, 2), (96, 6)]),
        ]
        claims = {i: (0, ["R"]) for i in range(4)} | {8: (0, ["R"])}

        self.assertEqual(find_dense_pin_border_arcs(segments, claims), {0, 1, 2, 3, 8})

    def test_sparse_bus_bar_remains_paintable(self):
        segments = [
            _horizontal(100, 0, 300),
            _vertical(40, 30, 80),
            _vertical(260, 30, 80),
        ]
        claims = {0: (0, ["BL"])}

        self.assertEqual(find_dense_pin_border_arcs(segments, claims), set())

    def test_vertical_pin_row_uses_the_same_guard(self):
        segments = [
            _vertical(100, 0, 45),
            _vertical(100, 70, 115),
            _vertical(100, 140, 185),
            _vertical(100, 210, 300),
            _horizontal(10, 30, 80),
            _horizontal(80, 30, 80),
            _horizontal(150, 30, 80),
            _horizontal(220, 30, 80),
            _segment([(6, 84), (2, 90), (6, 96)]),
        ]
        claims = {i: (0, ["R"]) for i in range(4)} | {8: (0, ["R"])}

        self.assertEqual(find_dense_pin_border_arcs(segments, claims), {0, 1, 2, 3, 8})


if __name__ == "__main__":
    unittest.main()
