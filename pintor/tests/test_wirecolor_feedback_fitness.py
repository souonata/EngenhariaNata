"""The review marks, turned into a number the engine can be held to."""
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.detect.vector_symbols import runs_crossing_zones
from wirecolor.labels.conventions import load_convention
from wirecolor.tools.feedback_fitness import WEIGHTS, score_page, summarise


def _mark(kind, points, expected=None):
    geometry = {"type": "segment" if len(points) > 1 else "point", "points": points}
    return {"type": kind, "page": 0, "geometry": geometry, "expected_code": expected}


def _painted_band(height=100, width=100, rows=(48, 52), rgb=(255, 255, 255)):
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    rgba[rows[0]:rows[1], :, 0] = rgb[0]
    rgba[rows[0]:rows[1], :, 1] = rgb[1]
    rgba[rows[0]:rows[1], :, 2] = rgb[2]
    rgba[rows[0]:rows[1], :, 3] = 255
    return rgba


class MarkScoring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.convention = load_convention("volvo_classic")

    def test_a_missing_mark_is_met_only_where_colour_arrived(self):
        outcomes = score_page(_painted_band(), [
            _mark("missing", [[0.5, 0.5]]),
            _mark("missing", [[0.5, 0.1]]),
        ], self.convention)

        self.assertEqual([item.satisfied for item in outcomes], [True, False])

    def test_a_non_wire_mark_is_violated_by_paint(self):
        outcomes = score_page(_painted_band(), [_mark("non-wire", [[0.5, 0.5]])], self.convention)

        self.assertFalse(outcomes[0].satisfied)

    def test_a_stops_mid_mark_needs_colour_along_the_whole_segment(self):
        whole = score_page(_painted_band(), [
            _mark("stops-mid", [[0.1, 0.5], [0.9, 0.5]])], self.convention)
        half = score_page(_painted_band(rows=(48, 52)), [
            _mark("stops-mid", [[0.1, 0.5], [0.9, 0.9]])], self.convention)

        self.assertTrue(whole[0].satisfied)
        self.assertFalse(half[0].satisfied)

    def test_a_wrong_colour_mark_compares_against_the_named_code(self):
        blue = self.convention.colors_bgr["BL"]
        painted = _painted_band(rgb=(blue[2], blue[1], blue[0]))

        right = score_page(painted, [_mark("wrong-colour", [[0.5, 0.5]], "BL")], self.convention)
        wrong = score_page(painted, [_mark("wrong-colour", [[0.5, 0.5]], "R")], self.convention)

        self.assertTrue(right[0].satisfied)
        self.assertFalse(wrong[0].satisfied)

    def test_painting_everything_cannot_win_the_benchmark(self):
        """The whole point of the weights: recall bought with false paint must lose."""
        everything = np.full((100, 100, 4), 255, dtype=np.uint8)
        marks = [_mark("missing", [[0.5, 0.5]]), _mark("non-wire", [[0.2, 0.2]])]

        greedy = score_page(everything, marks, self.convention)
        honest = score_page(_painted_band(), marks, self.convention)

        greedy_score = sum(i.weight for i in greedy if i.satisfied)
        honest_score = sum(i.weight for i in honest if i.satisfied)
        self.assertGreater(honest_score, greedy_score)
        self.assertGreater(WEIGHTS["non-wire"], WEIGHTS["missing"])


class CrossingConductors(unittest.TestCase):
    ZONE = [(40.0, 40.0, 60.0, 60.0)]

    def test_a_conductor_through_a_symbol_is_identified(self):
        self.assertEqual(runs_crossing_zones([[(0, 50), (100, 50)]], self.ZONE), {0})

    def test_a_conductor_that_stops_at_the_symbol_is_kept(self):
        self.assertEqual(runs_crossing_zones([[(0, 50), (45, 50)]], self.ZONE), set())

    def test_a_conductor_clear_of_the_symbol_is_kept(self):
        self.assertEqual(runs_crossing_zones([[(0, 5), (100, 5)]], self.ZONE), set())

    def test_a_crossing_is_found_without_any_vertex_inside(self):
        """A wire drawn as one stroke crosses a small symbol placing no point in it."""
        self.assertEqual(runs_crossing_zones([[(0, 50), (100, 50)]], self.ZONE), {0})

    def test_only_the_crossing_conductor_is_withdrawn(self):
        runs = [[(0, 50), (100, 50)], [(0, 5), (100, 5)], [(0, 90), (100, 90)]]

        self.assertEqual(runs_crossing_zones(runs, self.ZONE), {0})


class Summary(unittest.TestCase):
    def test_summary_counts_by_kind(self):
        convention = load_convention("volvo_classic")
        outcomes = score_page(_painted_band(), [
            _mark("missing", [[0.5, 0.5]]),
            _mark("missing", [[0.5, 0.1]]),
            _mark("non-wire", [[0.5, 0.9]]),
        ], convention)

        class Page:
            painted = True

            def totals(self):
                return (sum(i.weight for i in outcomes if i.satisfied),
                        sum(i.weight for i in outcomes))

        Page.outcomes = outcomes
        report = summarise([Page()])

        self.assertEqual(report["marks"], 3)
        self.assertEqual(report["by_kind"]["missing"], {"total": 2, "satisfied": 1})
        self.assertEqual(report["by_kind"]["non-wire"], {"total": 1, "satisfied": 1})


if __name__ == "__main__":
    unittest.main()
