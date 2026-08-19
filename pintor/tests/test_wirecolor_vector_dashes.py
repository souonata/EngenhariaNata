"""Dashed conductors on a vector sheet must stay dashed once painted.

The sheets say it themselves: *"dashed wires are not included in the main harness"*. Painting one
solid states the opposite, so this is a correctness test, not a cosmetic one.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from wirecolor.detect.vector_dashes import mark_dashed, parse_pattern  # noqa: E402
from wirecolor.paint.vector_overlay import dash_spans  # noqa: E402


class Run:
    def __init__(self, points):
        self.points = points
        self.code = "R"


class ParsePattern(unittest.TestCase):
    def test_solid_forms_are_not_patterns(self):
        # '[] 0' is the explicit solid pattern and None means the path never set one; treating
        # either as a dash would dash the whole drawing.
        self.assertIsNone(parse_pattern("[] 0"))
        self.assertIsNone(parse_pattern(None))
        self.assertIsNone(parse_pattern(""))

    def test_reads_on_and_off_lengths(self):
        self.assertEqual(parse_pattern("[ 3.99454 11.98363 ] 0"), (3.99454, 11.98363))

    def test_single_value_means_equal_on_and_off(self):
        self.assertEqual(parse_pattern("[ 2.5 ] 0"), (2.5, 2.5))

    def test_garbage_is_not_a_pattern(self):
        self.assertIsNone(parse_pattern("[ nonsense ] 0"))


class MarkDashed(unittest.TestCase):
    def test_a_run_lying_on_dashed_ink_is_dashed(self):
        run = Run([(0.0, 0.0), (100.0, 0.0)])
        mark_dashed([run], [((0.0, 0.0), (100.0, 0.0))])
        self.assertTrue(run.dashed)

    def test_a_run_crossing_one_dashed_line_is_not_dashed(self):
        # The whole reason for the fraction test: a dashed leader line crossing a solid cable must
        # not turn the cable into a dashed one.
        run = Run([(0.0, 0.0), (200.0, 0.0)])
        mark_dashed([run], [((100.0, -50.0), (100.0, 50.0))])
        self.assertFalse(run.dashed)

    def test_no_dashed_ink_leaves_every_run_solid(self):
        run = Run([(0.0, 0.0), (50.0, 0.0)])
        self.assertEqual(mark_dashed([run], []), 0)
        self.assertFalse(run.dashed)


class DashSpans(unittest.TestCase):
    def test_spans_alternate_and_stay_inside_the_line(self):
        spans = dash_spans([(0.0, 0.0), (100.0, 0.0)], 10.0, 10.0)
        self.assertEqual(len(spans), 5)
        for span in spans:
            for x, y in span:
                self.assertGreaterEqual(x, -0.001)
                self.assertLessEqual(x, 100.001)
                self.assertAlmostEqual(y, 0.0)

    def test_painted_length_matches_the_duty_cycle(self):
        # A 25% duty cycle must paint about a quarter of the cable, or the printed dash and the
        # painted dash beat against each other and the wire reads as a dotted mess.
        spans = dash_spans([(0.0, 0.0), (400.0, 0.0)], 10.0, 30.0)
        painted = sum(abs(span[-1][0] - span[0][0]) for span in spans)
        self.assertAlmostEqual(painted, 100.0, delta=12.0)

    def test_a_corner_does_not_break_the_phase(self):
        # The walk is by arc length across the whole polyline, so a right-angle bend keeps the
        # dash rhythm instead of restarting it at every vertex.
        spans = dash_spans([(0.0, 0.0), (50.0, 0.0), (50.0, 50.0)], 10.0, 10.0)
        self.assertEqual(len(spans), 5)


if __name__ == "__main__":
    unittest.main()
