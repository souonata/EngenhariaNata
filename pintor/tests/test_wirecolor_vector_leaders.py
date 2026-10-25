"""A callout leader lands on a wire; a wire's own stub turning a corner is not a leader."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.vector_leaders import detach_leaders  # noqa: E402
from wirecolor.labels.text_layer import Legend  # noqa: E402

DPI = 72                                         # one working pixel per point


def _code(x0=100, y0=95, x1=112, y1=105):
    return Legend(raw="SB", code="SB", x=(x0 + x1) / 2, y=(y0 + y1) / 2, axis="h",
                  wire_id=None, bbox=(x0, y0, x1, y1))


class Leaders(unittest.TestCase):
    def test_a_short_line_from_the_code_onto_a_wire_is_a_leader(self):
        stub, wire = ((113, 100), (130, 100)), ((130, 50), (130, 200))
        kept, legends, count = detach_leaders([stub, wire], [_code()], DPI)
        self.assertEqual(count, 1)
        self.assertEqual(kept, [wire])
        self.assertTrue(legends[0].leader)
        self.assertEqual((legends[0].x, legends[0].y), (130, 100))

    def test_the_wire_turning_a_corner_beside_its_code_is_not_a_leader(self):
        """The code is printed in its wire; the wire leaves the text and bends down."""
        left, stub, down = ((0, 100), (99, 100)), ((113, 100), (130, 100)), ((130, 100), (130, 200))
        kept, legends, count = detach_leaders([left, stub, down], [_code()], DPI)
        self.assertEqual(count, 0)
        self.assertEqual(kept, [left, stub, down])
        self.assertFalse(legends[0].leader)

    def test_the_wire_rising_from_its_code_to_a_star_point_is_not_a_leader(self):
        """A code printed across its wire: the piece above the text runs up to a junction."""
        code = Legend(raw="SB", code="SB", x=110, y=134, axis="h", wire_id=None,
                      bbox=(106, 130, 114, 138))
        rise = ((110, 129), (110, 110))
        star = [((110, 110), (60, 110)), ((110, 110), (160, 110)), ((110, 110), (110, 60))]
        kept, legends, count = detach_leaders([rise, *star], [code], DPI)
        self.assertEqual(count, 0)
        self.assertIn(rise, kept)
        self.assertFalse(legends[0].leader)

    def test_a_leader_on_a_vertex_of_a_straight_wire_is_still_a_leader(self):
        """Two strokes of one wire meet where the leader lands: that is a T, not a corner."""
        stub, upper, lower = ((113, 100), (130, 100)), ((130, 50), (130, 100)), ((130, 100), (130, 200))
        _kept, legends, count = detach_leaders([stub, upper, lower], [_code()], DPI)
        self.assertEqual(count, 1)
        self.assertTrue(legends[0].leader)


if __name__ == "__main__":
    unittest.main()
