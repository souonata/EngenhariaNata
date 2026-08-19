"""Tests for straight sub-run extraction -- the fix for phantom conductor positions."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.detect.runs import alongside, extract_runs, signed_offset


def _segment(points):
    return {"order": points, "ends": (points[0], points[-1])}


def _vertical(x, y0, y1, step=5):
    return _segment([(float(y), float(x)) for y in range(y0, y1 + 1, step)])


def _horizontal(y, x0, x1, step=5):
    return _segment([(float(y), float(x)) for x in range(x0, x1 + 1, step)])


class RunExtractionTests(unittest.TestCase):
    def test_a_straight_vertical_wire_yields_one_run_on_its_own_line(self):
        runs = [r for r in extract_runs([_vertical(500, 100, 400)]) if r.axis == "v"]

        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0].cross, 500.0)
        self.assertEqual((runs[0].along0, runs[0].along1), (100.0, 400.0))

    def test_a_bent_arc_never_reports_a_position_between_its_legs(self):
        # The pub 2503 hairpin: two vertical legs joined by a horizontal top. Averaging the whole
        # arc puts the "conductor" in the empty channel between the legs.
        left = [(float(y), 600.0) for y in range(400, 199, -5)]
        top = [(200.0, float(x)) for x in range(600, 721, 5)]
        right = [(float(y), 720.0) for y in range(200, 401, 5)]
        arc = _segment(left + top + right)

        verticals = sorted(r.cross for r in extract_runs([arc]) if r.axis == "v")

        self.assertEqual(verticals, [600.0, 720.0])
        self.assertNotIn(660.0, verticals)          # the phantom midpoint

    def test_a_stub_at_one_end_does_not_drag_the_line(self):
        points = [(float(y), 500.0) for y in range(100, 401, 5)]
        points += [(400.0, 502.0), (400.0, 504.0)]
        runs = [r for r in extract_runs([_segment(points)]) if r.axis == "v"]

        self.assertEqual(runs[0].cross, 500.0)

    def test_short_stretches_are_not_runs(self):
        self.assertEqual(extract_runs([_vertical(500, 100, 120)], min_length=40.0), [])

    def test_line_width_scales_the_straightness_tolerance(self):
        # A 16-px pen sheet: a wire wobbling within its own stroke is still one straight run.
        points = [(float(y), 500.0 + (y % 3)) for y in range(100, 401, 5)]
        wide = [r for r in extract_runs([_segment(points)], line_width=16.0) if r.axis == "v"]

        self.assertEqual(len(wide), 1)


class OffsetTests(unittest.TestCase):
    def test_offset_is_signed_so_the_printing_side_is_usable(self):
        run = [r for r in extract_runs([_vertical(500, 100, 400)]) if r.axis == "v"][0]

        self.assertEqual(signed_offset(run, 460.0, 250.0), 40.0)
        self.assertEqual(signed_offset(run, 540.0, 250.0), -40.0)

    def test_a_legend_past_the_end_of_a_run_is_not_alongside_it(self):
        run = [r for r in extract_runs([_vertical(500, 100, 400)]) if r.axis == "v"][0]

        self.assertTrue(alongside(run, 460.0, 250.0))
        self.assertFalse(alongside(run, 460.0, 600.0))
        self.assertTrue(alongside(run, 460.0, 430.0, allowance=60.0))

    def test_runs_alongside_each_other_report_their_shared_extent(self):
        runs = extract_runs([_vertical(500, 100, 400), _vertical(579, 200, 500)])
        first = next(r for r in runs if r.axis == "v" and r.cross == 500.0)
        second = next(r for r in runs if r.axis == "v" and r.cross == 579.0)

        self.assertEqual(first.overlap(second), 200.0)
        self.assertEqual(first.overlap(first), 300.0)

    def test_runs_on_different_axes_never_overlap(self):
        runs = extract_runs([_vertical(500, 100, 400), _horizontal(250, 300, 700)])
        vertical = next(r for r in runs if r.axis == "v")
        horizontal = next(r for r in runs if r.axis == "h")

        self.assertEqual(vertical.overlap(horizontal), 0.0)


if __name__ == "__main__":
    unittest.main()
