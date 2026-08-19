"""How white is painted -- a fundamental rule.

A SINGLE white wire is railed in black on BOTH sides so the white core reads on white paper.
A TWO-COLOUR white cable (GN/W, Y/W, W/SB) instead lets the two colours TOUCH -- no black line
between them -- and rails the white in black ONLY on its outer edge, the side that abuts the paper.
The other colour reads against the paper on its own.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import numpy as np  # noqa: E402
from wirecolor.labels.conventions import load_convention  # noqa: E402
from wirecolor.paint.vector_overlay import _paint_piece  # noqa: E402

CONV = load_convention("volvo_classic")


def cross_section(tokens, band=14, height=80, width=200, y=40):
    """Paint one horizontal cable and return the vertical column of BGR pixels through it."""
    canvas = np.zeros((height, width, 4), np.uint8)
    points = np.array([[10, y], [width - 10, y]], np.float32)
    _paint_piece(canvas, points, tokens, band, CONV)
    column = canvas[:, width // 2, :]
    rows = []
    for b, g, r, a in column:
        if a < 128:
            rows.append("_")                       # transparent / unpainted
        elif b < 60 and g < 60 and r < 60:
            rows.append("K")                       # black
        elif b > 200 and g > 200 and r > 200:
            rows.append("W")                       # white
        else:
            rows.append("C")                       # some colour
    return "".join(rows).strip("_")


class WhiteRule(unittest.TestCase):
    def test_single_white_is_railed_on_both_sides(self):
        section = cross_section([CONV.white_token])
        self.assertTrue(section.startswith("K"), f"no top rail: {section}")
        self.assertTrue(section.endswith("K"), f"no bottom rail: {section}")
        self.assertIn("W", section)                # a visible white core between the rails

    def test_two_colour_white_touches_and_rails_only_the_white_side(self):
        section = cross_section(["GN", CONV.white_token])
        self.assertIn("C", section)                # the green half
        self.assertIn("W", section)                # the white half
        # black appears on ONE outer end only, never between the two colours
        self.assertNotEqual(section[0] == "K", section[-1] == "K",
                            f"black should rail exactly one outer edge: {section}")
        first_c, last_c = section.index("C"), section.rindex("C")
        first_w, last_w = section.index("W"), section.rindex("W")
        between = section[min(last_c, last_w) + 1:max(first_c, first_w)]
        self.assertNotIn("K", between, f"no black line between the two colours: {section}")

    def test_the_non_white_colour_is_not_railed(self):
        # the black rail sits on the white's side, not the green's
        section = cross_section(["GN", CONV.white_token])
        green_at_start = section.find("C") < section.find("W")
        if green_at_start:
            self.assertNotEqual(section[0], "K", f"green side must not be railed: {section}")
        else:
            self.assertNotEqual(section[-1], "K", f"green side must not be railed: {section}")


if __name__ == "__main__":
    unittest.main()
