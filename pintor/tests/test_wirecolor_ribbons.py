"""A conductor drawn as a thin filled rectangle must yield its centreline; a blob must not.

On autotraced and pictorial sheets a wire is often not stroked at all -- it is a long thin FILLED
rectangle. Those were discarded as "page furniture" and the sheet painted almost nothing. This
recovers them, while still rejecting the filled dots, glyphs and symbol bodies that share the
"fill, no stroke" shape.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import fitz  # noqa: E402
from wirecolor.eval.vector_truth import _filled_ribbon_centerline  # noqa: E402

IDENTITY = fitz.Matrix(1, 1)


def filled_rect(x0, y0, x1, y1):
    return {"rect": fitz.Rect(x0, y0, x1, y1), "fill": (0, 0, 0), "color": None}


class RibbonCentreline(unittest.TestCase):
    def test_horizontal_ribbon_gives_its_midline(self):
        seg = _filled_ribbon_centerline(filled_rect(100, 200, 700, 203), IDENTITY)
        self.assertIsNotNone(seg)
        (ax, ay), (bx, by) = seg
        self.assertAlmostEqual(ay, 201.5)
        self.assertAlmostEqual(by, 201.5)
        self.assertEqual({round(ax), round(bx)}, {100, 700})

    def test_vertical_ribbon_gives_its_midline(self):
        seg = _filled_ribbon_centerline(filled_rect(400, 100, 403, 500), IDENTITY)
        (ax, ay), (bx, by) = seg
        self.assertAlmostEqual(ax, 401.5)
        self.assertAlmostEqual(bx, 401.5)
        self.assertEqual({round(ay), round(by)}, {100, 500})

    def test_a_junction_dot_is_not_a_ribbon(self):
        # small and square -> a filled dot, not a wire
        self.assertIsNone(_filled_ribbon_centerline(filled_rect(100, 100, 104, 104), IDENTITY))

    def test_a_symbol_bar_is_too_thick(self):
        # long but 10 px wide -> a filled symbol body, above the ribbon width
        self.assertIsNone(_filled_ribbon_centerline(filled_rect(100, 100, 300, 110), IDENTITY))

    def test_a_short_sliver_is_not_a_ribbon(self):
        # thin but only 12 px long -> an end cap or a glyph stroke, below the length floor
        self.assertIsNone(_filled_ribbon_centerline(filled_rect(100, 100, 112, 102), IDENTITY))


if __name__ == "__main__":
    unittest.main()
