"""Tests for turning a human markup into machine-checkable ground truth."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.tools.ground_truth import merge, nearest_legend, sample_path


class SamplePathTests(unittest.TestCase):
    def test_a_freehand_stroke_becomes_spread_checkpoints(self):
        stroke = [(x, 100) for x in range(0, 1200, 5)]

        points = sample_path(stroke, spacing=260.0)

        self.assertGreaterEqual(len(points), 4)
        self.assertEqual(points[0], (0, 100))
        for before, after in zip(points, points[1:]):
            self.assertGreaterEqual(after[0] - before[0], 200)

    def test_a_short_mark_keeps_both_ends(self):
        self.assertEqual(sample_path([(10, 10), (12, 90)]), [(10, 10), (12, 90)])

    def test_checkpoints_are_capped(self):
        stroke = [(x, 0) for x in range(0, 8000, 10)]
        self.assertLessEqual(len(sample_path(stroke, spacing=100.0, limit=6)), 6)

    def test_an_empty_mark_yields_nothing(self):
        self.assertEqual(sample_path([]), [])


class LegendMatchTests(unittest.TestCase):
    CATALOGUE = [
        (7262, 4252, "SB", "70 SB"),
        (7807, 4718, "R", "70 R"),
        (2808, 2200, "OR", "0.75 OR (w91)"),
    ]

    def test_the_nearest_legend_along_the_marked_path_is_chosen(self):
        match = nearest_legend([(7224, 4299), (7316, 4293)], self.CATALOGUE)

        self.assertIsNotNone(match)
        self.assertEqual(match[1], "SB")
        self.assertEqual(match[2], "70 SB")

    def test_a_mark_far_from_every_legend_stays_unnamed(self):
        self.assertIsNone(nearest_legend([(100, 100)], self.CATALOGUE))

    def test_distance_is_measured_from_every_checkpoint_not_only_the_first(self):
        # The first checkpoint is far from any legend; a later one sits beside '70 R'.
        match = nearest_legend([(1000, 1000), (7800, 4760)], self.CATALOGUE)

        self.assertEqual(match[1], "R")


class MergeTests(unittest.TestCase):
    def test_a_confirmed_route_is_never_overwritten_by_a_candidate(self):
        existing = {"routes": [{"name": "02 pre-heat", "code": "R",
                                "points": [[1, 2]], "status": "confirmed"}]}
        incoming = {"routes": [{"name": "02 pre-heat", "code": "SB",
                                "points": [[9, 9]], "status": "candidate"}]}

        merged = merge(existing, incoming)

        self.assertEqual(len(merged["routes"]), 1)
        self.assertEqual(merged["routes"][0]["code"], "R")

    def test_new_marks_are_added(self):
        existing = {"routes": [{"name": "02", "code": "R", "points": [[1, 2]],
                                "status": "confirmed"}]}
        incoming = {"routes": [{"name": "07", "code": "SB", "points": [[3, 4]],
                                "status": "candidate"}]}

        self.assertEqual(len(merge(existing, incoming)["routes"]), 2)

    def test_a_candidate_may_be_refined_by_a_later_import(self):
        existing = {"routes": [{"name": "07", "code": None, "points": [[1, 2]],
                                "status": "candidate"}]}
        incoming = {"routes": [{"name": "07", "code": "SB", "points": [[3, 4]],
                                "status": "candidate"}]}

        self.assertEqual(merge(existing, incoming)["routes"][0]["code"], "SB")


if __name__ == "__main__":
    unittest.main()
