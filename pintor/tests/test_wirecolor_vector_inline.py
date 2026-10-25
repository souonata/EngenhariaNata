"""A code printed in the line of its wire names that wire, and no other, in the vector route."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.vector_inline import printed_in_line, printed_through  # noqa: E402
from wirecolor.engine.constraints import constrained_assign, veto_printed_through  # noqa: E402
from wirecolor.engine.policy import DecisionPolicy  # noqa: E402
from wirecolor.labels.text_layer import Legend  # noqa: E402


def _legend(code, x0, y0, x1, y1, axis="h", leader=False):
    return Legend(raw=code, code=code, x=(x0 + x1) / 2, y=(y0 + y1) / 2, axis=axis,
                  wire_id=None, bbox=(x0, y0, x1, y1), leader=leader)


def _assign(legends, runs, stubs=()):
    proven, claims = printed_in_line(legends, runs, list(runs) + list(stubs))
    owned, _ = constrained_assign(legends, runs, DecisionPolicy(),
                                  inline_legends=proven, inline_claims=claims)
    return [run.code for run in owned]


class Detection(unittest.TestCase):
    TEXT = (100, 95, 124, 105)                        # 10 px high, centre line y = 100

    def test_a_wire_broken_for_its_code_is_found_with_a_stub_on_the_far_side(self):
        wire, stub = [(0, 100), (99, 100)], [(125, 100), (140, 100)]
        proven, claims = printed_in_line([_legend("T/W", *self.TEXT)], [wire], [wire, stub])
        self.assertEqual(proven, [0])
        self.assertEqual(claims, [(0, 0)])

    def test_a_wire_stopping_at_the_text_on_one_side_only_is_not_proof(self):
        wire = [(0, 100), (99, 100)]
        self.assertEqual(printed_in_line([_legend("T/W", *self.TEXT)], [wire], [wire]), ([], []))

    def test_an_end_off_the_text_centre_line_is_another_wire(self):
        wire, stub = [(0, 106), (99, 106)], [(125, 100), (140, 100)]
        proven, _ = printed_in_line([_legend("T/W", *self.TEXT)], [wire], [wire, stub])
        self.assertEqual(proven, [])

    def test_a_wire_leaving_the_text_edge_across_its_axis_is_not_in_line(self):
        wire, stub = [(99, 100), (99, 0)], [(125, 100), (140, 100)]
        proven, _ = printed_in_line([_legend("T/W", *self.TEXT)], [wire], [wire, stub])
        self.assertEqual(proven, [])

    def test_vertical_text_reads_along_its_own_axis(self):
        wire, stub = [(100, 0), (100, 99)], [(100, 125), (100, 140)]
        legend = _legend("T/W", 95, 100, 105, 124, axis="v")
        self.assertEqual(printed_in_line([legend], [wire], [wire, stub]), ([0], [(0, 0)]))

    def test_a_leader_code_is_already_anchored_and_is_left_alone(self):
        wire, stub = [(0, 100), (99, 100)], [(125, 100), (140, 100)]
        legend = _legend("T/W", *self.TEXT, leader=True)
        self.assertEqual(printed_in_line([legend], [wire], [wire, stub]), ([], []))


class Assignment(unittest.TestCase):
    def test_the_two_pieces_a_code_splits_are_both_its_wire(self):
        """Judged by distance the code ties between its own two pieces and colours neither."""
        left, right = [(0, 100), (99, 100)], [(125, 100), (300, 100)]
        legend = _legend("T/W", 100, 95, 124, 105)
        owned, _ = constrained_assign([legend], [left, right], DecisionPolicy())
        self.assertEqual([run.code for run in owned], [None, None])
        self.assertEqual(_assign([legend], [left, right]), ["T/W", "T/W"])

    def test_dense_rows_each_code_takes_the_wire_it_is_printed_in(self):
        """DBL/OR's centre is nearer the end of the Y/GR wire one row below than its own wire's."""
        dbl_or = _legend("DBL/OR", 100, 95, 150, 105)
        y_gr = _legend("Y/GR", 108, 111, 142, 121)
        own, below = [(0, 100), (99, 100)], [(0, 116), (107, 116)]
        stubs = [[(151, 100), (165, 100)], [(143, 116), (160, 116)]]
        owned, _ = constrained_assign([dbl_or, y_gr], [own, below], DecisionPolicy())
        self.assertIsNone(owned[0].code)                 # left black by distance alone
        self.assertEqual(_assign([dbl_or, y_gr], [own, below], stubs), ["DBL/OR", "Y/GR"])

    def test_a_code_in_a_wire_too_short_to_paint_refuses_its_neighbour(self):
        """Its own wire is cut into stubs by crossings; the parallel run below is another wire."""
        legend = _legend("BL/P", 100, 95, 124, 105)
        stubs = [[(80, 100), (99, 100)], [(125, 100), (140, 100)]]
        neighbour = [(0, 112), (300, 112)]
        owned, _ = constrained_assign([legend], [neighbour], DecisionPolicy())
        self.assertEqual(owned[0].code, "BL/P")          # the wrong colour, by distance
        self.assertEqual(_assign([legend], [neighbour], stubs), [None])

    def test_a_piece_between_two_colours_printed_in_line_stays_black(self):
        red, green = _legend("R", 100, 95, 112, 105), _legend("GN", 200, 95, 216, 105)
        left, middle, right = [(0, 100), (99, 100)], [(113, 100), (199, 100)], \
            [(217, 100), (300, 100)]
        self.assertEqual(_assign([red, green], [left, middle, right]), ["R", None, "GN"])


class PrintedThrough(unittest.TestCase):
    LABEL = (90, 95, 130, 105)                       # a bundle label, 10 px high

    def test_a_wire_broken_across_a_label_passes_through_it(self):
        below, above = [(110, 106), (110, 300)], [(110, 0), (110, 94)]
        through = printed_through([_legend("P/DGN", *self.LABEL)], [below], [below, above])
        self.assertEqual(through, [(0, "P/DGN")])

    def test_a_wire_that_stops_under_a_label_does_not_pass_through_it(self):
        below = [(110, 106), (110, 300)]
        self.assertEqual(printed_through([_legend("P/DGN", *self.LABEL)], [below], [below]), [])

    def test_the_pieces_across_must_line_up(self):
        below, above = [(110, 106), (110, 300)], [(120, 0), (120, 94)]
        self.assertEqual(
            printed_through([_legend("P/DGN", *self.LABEL)], [below], [below, above]), [])

    def test_a_bare_letter_in_a_wire_vetoes_a_colour_claimed_by_distance(self):
        """A bare Y cannot paint, but the wire it is printed in is not P/DGN's."""
        bare_y = _legend("Y", 100, 95, 106, 105)
        p_dgn = _legend("P/DGN", 30, 107, 70, 117)
        wire, stub = [(0, 100), (99, 100)], [(107, 100), (120, 100)]
        owned, _ = constrained_assign([p_dgn], [wire], DecisionPolicy())
        self.assertEqual(owned[0].code, "P/DGN")
        through = printed_through([bare_y, p_dgn], [wire], [wire, stub])
        self.assertEqual(veto_printed_through(owned, through), 1)
        self.assertIsNone(owned[0].code)
        self.assertEqual(owned[0].abstain_reason, "another colour printed in its line")

    def test_a_run_between_two_printed_colours_is_vetoed_and_its_own_code_is_kept(self):
        """An injector pigtail code in line with a run that ends across the feed's label."""
        pigtail = _legend("GR/W", 20, 295, 60, 305)
        feed = _legend("P/DGN", *self.LABEL)
        run = [(61, 300), (110, 300), (110, 106)]
        pieces = [run, [(0, 300), (19, 300)], [(110, 0), (110, 94)]]
        owned, _ = constrained_assign([pigtail], [run], DecisionPolicy())
        through = printed_through([pigtail, feed], [run], pieces)
        self.assertEqual(sorted(code for _index, code in through), ["GR/W", "P/DGN"])
        veto_printed_through(owned, through)
        self.assertIsNone(owned[0].code)
        self.assertEqual(owned[0].abstain_reason, "two colours printed in its line")

        alone, _ = constrained_assign([pigtail], [run], DecisionPolicy())
        self.assertEqual(veto_printed_through(alone, [(0, "GR/W")]), 0)
        self.assertEqual(alone[0].code, "GR/W")


if __name__ == "__main__":
    unittest.main()
