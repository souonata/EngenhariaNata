"""Colour must cross a symbol gap along a straight line, but never turn a corner to do it.

The bridge exists to carry a cable's colour through a hop or a twisted-pair mark that broke its
stroke. The danger is that the same mechanism, unchecked, guesses a continuation at a corner or a
fork and spreads a wrong colour -- which is worse than leaving the far half black. These tests pin
the line between the two.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from wirecolor.engine.ownership import bridge_straight_continuations  # noqa: E402


class Run:
    def __init__(self, points, code=None):
        self.points = points
        self.code = code
        self.legend_raw = code
        self.propagated = False


class BridgeStraightContinuations(unittest.TestCase):
    def test_carries_colour_straight_across_a_small_gap(self):
        left = Run([(0, 100), (100, 100)], "GR/Y")
        right = Run([(120, 100), (300, 100)])          # 20 px gap, perfectly collinear
        n = bridge_straight_continuations([left, right], max_gap_px=30, min_conductor_px=50)
        self.assertEqual(n, 1)
        self.assertEqual(right.code, "GR/Y")
        self.assertTrue(right.propagated)

    def test_does_not_turn_a_corner(self):
        # The wrong-colour bleed the audit found came from a colour turning 90 degrees at a
        # crossing. A perpendicular neighbour must never be bridged.
        horizontal = Run([(0, 100), (100, 100)], "Y/W")
        vertical = Run([(110, 100), (110, 300)])       # leaves the gap at a right angle
        self.assertEqual(bridge_straight_continuations([horizontal, vertical],
                                                       max_gap_px=30, min_conductor_px=50), 0)
        self.assertIsNone(vertical.code)

    def test_declines_at_a_fork(self):
        # Two uncoded runs continue ahead; which one is the cable is a guess, so bridge neither.
        source = Run([(0, 100), (100, 100)], "R")
        one = Run([(120, 96), (300, 92)])
        two = Run([(120, 104), (300, 108)])
        self.assertEqual(bridge_straight_continuations([source, one, two],
                                                       max_gap_px=40, min_conductor_px=50), 0)

    def test_respects_the_gap_limit(self):
        left = Run([(0, 100), (100, 100)], "BL")
        far = Run([(200, 100), (400, 100)])            # 100 px away -- a routing distance
        self.assertEqual(bridge_straight_continuations([left, far],
                                                       max_gap_px=30, min_conductor_px=50), 0)

    def test_never_overwrites_an_existing_colour(self):
        left = Run([(0, 100), (100, 100)], "R")
        right = Run([(120, 100), (300, 100)], "GN")    # already coloured -- a real boundary
        bridge_straight_continuations([left, right], max_gap_px=30, min_conductor_px=50)
        self.assertEqual(right.code, "GN")

    def test_component_zone_blocks_a_collinear_bridge(self):
        left = Run([(0, 100), (100, 100)], "R")
        right = Run([(120, 100), (300, 100)])
        blocked = [(104, 88, 116, 112)]
        self.assertEqual(bridge_straight_continuations(
            [left, right], max_gap_px=30, min_conductor_px=50, blocked_zones=blocked), 0)
        self.assertIsNone(right.code)

    def test_offset_line_is_not_bridged(self):
        # Collinear in direction but laterally displaced -- a different cable running parallel.
        left = Run([(0, 100), (100, 100)], "OR")
        parallel = Run([(120, 140), (300, 140)])       # 40 px to the side
        self.assertEqual(bridge_straight_continuations([left, parallel],
                                                       max_gap_px=30, min_conductor_px=50), 0)


if __name__ == "__main__":
    unittest.main()
