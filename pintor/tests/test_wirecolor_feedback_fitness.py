"""The review marks, turned into a number the engine can be held to."""
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.detect.vector_symbols import runs_crossing_zones
from wirecolor.labels.conventions import load_convention
from wirecolor.tools.feedback_fitness import (WEIGHTS, PageScore, balanced_fitness,
                                              score_page, summarise)


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

    def test_a_gap_smaller_than_the_tolerance_is_still_seen(self):
        """The scorer must not go blind exactly where the remaining work is.

        The tolerance exists for the scatter of a reviewer's click, which is ACROSS the wire. Applied
        as a disc it also blurs ALONG the mark, so a defect shorter than the radius always scores as
        satisfied. On the D13 foldout the radius is 46 px; after the bridge fix the reviewer's
        remaining marks were 30 px long, and all five scored 5/5 while they were still looking at a
        real gap. Probing perpendicular keeps the along-track resolution.
        """
        import numpy as np

        convention = load_convention("volvo_classic")
        # A painted wire with a short bare stub at the top, shorter than the tolerance radius.
        rgba = np.zeros((400, 400, 4), dtype=np.uint8)
        rgba[40:400, 198:202, :] = 255
        mark = _mark("stops-mid", [[0.5, 0.03], [0.5, 0.09]])

        outcome = score_page(rgba, [mark], convention)[0]

        self.assertFalse(outcome.satisfied)

    def test_a_point_mark_keeps_the_disc(self):
        """A point mark asserts no extent, so shrinking its tolerance would only add noise."""
        import numpy as np

        convention = load_convention("volvo_classic")
        rgba = np.zeros((400, 400, 4), dtype=np.uint8)
        rgba[198:202, 0:400, :] = 255
        beside = _mark("missing", [[0.5, 0.502]])

        self.assertTrue(score_page(rgba, [beside], convention)[0].satisfied)

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

    def test_neither_blank_nor_paint_everything_can_win_genetic_fitness(self):
        blank = np.zeros((100, 100, 4), dtype=np.uint8)
        everything = np.full((100, 100, 4), 255, dtype=np.uint8)
        marks = [
            _mark("missing", [[0.5, 0.5]]),
            _mark("non-wire", [[0.2, 0.2]]),
        ]

        blank_score, _ = balanced_fitness(score_page(blank, marks, self.convention))
        greedy_score, _ = balanced_fitness(score_page(everything, marks, self.convention))
        honest_score, _ = balanced_fitness(score_page(_painted_band(), marks, self.convention))

        self.assertEqual(blank_score, 0.0)
        self.assertEqual(greedy_score, 0.0)
        self.assertEqual(honest_score, 1.0)

    def test_unknown_expected_code_is_reported_as_unscorable(self):
        outcomes = score_page(
            _painted_band(), [_mark("wrong-colour", [[0.5, 0.5]], "E")], self.convention)

        self.assertEqual(len(outcomes), 1)
        self.assertFalse(outcomes[0].scorable)
        self.assertIsNone(outcomes[0].satisfied)


class NonWireMarksAnchorOnTheDrawing(unittest.TestCase):
    """A non-wire mark asks about the object under it, not about any paint in the square.

    The canvas is a housing edge (a vertical stroke) with a wire running into it from the left.
    The wire legitimately ends at the housing, so its band stops a pixel short of the edge.
    """

    SIZE = 2000

    @classmethod
    def setUpClass(cls):
        cls.convention = load_convention("volvo_classic")

    def _drawing(self):
        ink = np.zeros((self.SIZE, self.SIZE), dtype=bool)
        ink[800:1200, 999:1002] = True            # housing edge
        ink[999:1002, 500:999] = True             # wire ending at the housing
        return ink

    def _wire_painted(self):
        rgba = np.zeros((self.SIZE, self.SIZE, 4), dtype=np.uint8)
        rgba[996:1005, 500:998] = 255
        return rgba

    def _at(self, column, row):
        return _mark("non-wire", [[column / self.SIZE, row / self.SIZE]])

    def test_a_wire_ending_at_the_housing_no_longer_fails_the_housing_mark(self):
        mark = self._at(1004, 1008)

        square = score_page(self._wire_painted(), [mark], self.convention)[0]
        anchored = score_page(self._wire_painted(), [mark], self.convention,
                              ink=self._drawing())[0]

        self.assertFalse(square.satisfied)
        self.assertTrue(anchored.satisfied)
        self.assertIn("1/1 ancorados", anchored.detail)

    def test_a_painted_housing_still_fails_the_mark(self):
        rgba = self._wire_painted()
        rgba[800:1200, 997:1005] = 255

        anchored = score_page(rgba, [self._at(1004, 1008)], self.convention,
                              ink=self._drawing())[0]

        self.assertFalse(anchored.satisfied)

    def test_a_mark_with_no_ink_in_reach_keeps_the_square(self):
        rgba = self._wire_painted()
        rgba[1300:1310, 1300:1310] = 255

        anchored = score_page(rgba, [self._at(1305, 1312)], self.convention,
                              ink=self._drawing())[0]

        self.assertFalse(anchored.satisfied)
        self.assertIn("0/1 ancorados", anchored.detail)

    def test_an_ink_mask_of_another_size_is_ignored(self):
        mark = self._at(1004, 1008)

        anchored = score_page(self._wire_painted(), [mark], self.convention,
                              ink=np.ones((10, 10), dtype=bool))[0]

        self.assertFalse(anchored.satisfied)

    def test_paint_everything_still_fails_every_anchored_mark(self):
        everything = np.full((self.SIZE, self.SIZE, 4), 255, dtype=np.uint8)

        anchored = score_page(everything, [self._at(1004, 1008)], self.convention,
                              ink=self._drawing())[0]

        self.assertFalse(anchored.satisfied)

    def _two_colour_wire(self, base, tracer, base_rows=4, tracer_rows=5):
        """A horizontal W/BL-style cable: two touching stripes over a drawn conductor."""
        rgba = np.zeros((self.SIZE, self.SIZE, 4), dtype=np.uint8)
        rgba[996:996 + base_rows, 500:998, :3] = base
        rgba[996 + base_rows:996 + base_rows + tracer_rows, 500:998, :3] = tracer
        rgba[996:996 + base_rows + tracer_rows, 500:998, 3] = 255
        return rgba

    def _rgb(self, code):
        return tuple(reversed(self.convention.colors_bgr[code]))

    def _wrong_colour_mark(self, code):
        return _mark("wrong-colour", [[700 / self.SIZE, 1003 / self.SIZE]], code)

    def test_a_two_colour_cable_needs_both_colours_not_the_base_majority(self):
        """The v1 ruler compared the majority pixel with the base colour alone.

        On D1/D2 page 46 both scorable wrong-colour marks were W/BL cables and both failed with
        "found BL": one stripe of a two-stripe cable outnumbering the other by a row is enough.
        """
        rgba = self._two_colour_wire(self._rgb("W"), self._rgb("BL"))
        mark = self._wrong_colour_mark("W/BL")

        square = score_page(rgba, [mark], self.convention)[0]
        anchored = score_page(rgba, [mark], self.convention, ink=self._drawing())[0]

        self.assertFalse(square.satisfied)
        self.assertTrue(anchored.satisfied)

    def test_the_bare_seam_between_two_non_white_stripes_keeps_them_one_band(self):
        """The renderer leaves the centre pixel bare between two non-white stripes."""
        rgba = self._two_colour_wire(self._rgb("Y"), self._rgb("SB"))
        rgba[1000, :, 3] = 0

        anchored = score_page(rgba, [self._wrong_colour_mark("Y/SB")], self.convention,
                              ink=self._drawing())[0]

        self.assertTrue(anchored.satisfied, anchored.detail)

    def test_a_one_colour_cable_cannot_answer_for_a_two_colour_code(self):
        blue = self._rgb("BL")
        rgba = self._two_colour_wire(blue, blue)

        anchored = score_page(rgba, [self._wrong_colour_mark("W/BL")], self.convention,
                              ink=self._drawing())[0]

        self.assertFalse(anchored.satisfied)

    def test_a_colour_the_code_does_not_name_fails_when_it_is_not_rare(self):
        rgba = self._two_colour_wire(self._rgb("W"), self._rgb("BL"))
        red = self._two_colour_wire(self._rgb("R"), self._rgb("R"), base_rows=0, tracer_rows=12)
        touching = red[:, :, 3] > 0
        touching[:, :700] = False
        rgba[touching] = red[touching]

        anchored = score_page(rgba, [self._wrong_colour_mark("W/BL")], self.convention,
                              ink=self._drawing())[0]

        self.assertFalse(anchored.satisfied)

    def test_the_source_ink_lands_under_the_overlay_pixel_that_would_colour_it(self):
        import tempfile

        import fitz

        from wirecolor.tools.feedback_bench import source_ink

        with tempfile.TemporaryDirectory() as folder:
            pdf = Path(folder) / "line.pdf"
            document = fitz.open()
            page = document.new_page(width=100, height=50)
            page.draw_line((10, 25), (90, 25), width=2)
            document.save(pdf)
            document.close()

            ink = source_ink(pdf, 0, (200, 400))

        self.assertEqual(ink.shape, (200, 400))
        self.assertTrue(ink[100, 200])
        self.assertFalse(ink[50, 200])
        self.assertFalse(ink[100, 10])


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

        # Use the real PageScore: a hand-rolled stand-in went stale the moment `summarise` began
        # averaging by publication, and the test failed for its own shape rather than the code's.
        report = summarise([PageScore(manual="m", page=0, painted=True, outcomes=outcomes)])

        self.assertEqual(report["marks"], 3)
        self.assertEqual(
            report["by_kind"]["missing"],
            {"total": 2, "satisfied": 1, "unscorable": 0},
        )
        self.assertEqual(
            report["by_kind"]["non-wire"],
            {"total": 1, "satisfied": 1, "unscorable": 0},
        )

    def test_a_blank_overlay_cannot_win_the_fitness(self):
        """The failure that made the first reported number meaningless.

        The weighted total is a severity sum, and the few high-weight negative marks outweighed 206
        missing-colour ones: an entirely blank overlay scored 0.2911 on the real export, against
        0.3006 for a build that actually painted. The balanced fitness is a geometric mean over the
        objectives, so any objective left at zero takes the whole score with it.
        """
        import numpy as np

        convention = load_convention("volvo_classic")
        marks = [_mark("missing", [[0.5, 0.5]]), _mark("non-wire", [[0.2, 0.2]])]
        blank = np.zeros((100, 100, 4), dtype=np.uint8)
        everything = np.full((100, 100, 4), 255, dtype=np.uint8)

        blank_fitness, _ = balanced_fitness(score_page(blank, marks, convention))
        greedy_fitness, _ = balanced_fitness(score_page(everything, marks, convention))
        honest_fitness, _ = balanced_fitness(score_page(_painted_band(), marks, convention))

        self.assertEqual(blank_fitness, 0.0)
        self.assertEqual(greedy_fitness, 0.0)
        self.assertGreater(honest_fitness, 0.0)


if __name__ == "__main__":
    unittest.main()
