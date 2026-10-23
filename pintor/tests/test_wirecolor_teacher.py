"""Generation 2: factory-coloured pages as ground truth, and the engine changes they drove."""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.labels.conventions import load_convention
from wirecolor.labels.parse import parse_code


def _factory_page():
    """A small page in the 2026 factory style plus one classic-style conductor.

    * a 1.5 pt pink core over a 1.75 pt black rail with a 0.5 pt dark-green centred tracer,
      labelled "PINK / DK.GREEN 18";
    * a 4.0 pt red stroke with a 1.5 pt purple stroke over the same geometry, labelled "R/PU";
    * a 1.0 pt black component box, which is not a conductor.
    """
    import fitz

    document = fitz.open()
    page = document.new_page(width=400, height=200)
    for width, colour in ((1.75, (0, 0, 0)), (1.5, (1, 0.6, 0.8)), (0.5, (0, 0.4, 0.2))):
        page.draw_polyline([(20, 40), (300, 40), (300, 120)], color=colour, width=width,
                           closePath=False)
    page.insert_text((30, 36), "PINK / DK.GREEN 18", fontsize=6)
    for width, colour in ((4.0, (0.85, 0.15, 0.11)), (1.5, (0.59, 0.27, 0.47))):
        page.draw_polyline([(20, 160), (250, 160)], color=colour, width=width, closePath=False)
    page.insert_text((60, 154), "R/PU", fontsize=6)
    page.draw_rect(fitz.Rect(320, 100, 380, 180), color=(0, 0, 0), width=1.0)
    for x in (330, 340, 350):
        page.draw_line((x, 20), (x, 30), color=(0, 0, 0), width=1.0)
    return document, page


class AwgWordCodes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.convention = load_convention("volvo_classic")

    def test_the_2026_spellings_parse(self):
        cases = {"PINK / DK.GREEN 18": "P/DGN", "BLACK/LT.GREEN  18": "SB/LGN",
                 "BLACK 14": "SB", "GRAY/DK.GREEN  18": "GR/DGN", "DK.BLUE/WHITE 18": "DBL/W"}
        for text, code in cases.items():
            self.assertEqual(parse_code(text, self.convention, allow_pin=True), code, text)

    def test_prose_and_impossible_gauges_do_not_parse(self):
        for text in ("Torque 14", "RED 2", "RED 15", "Red wire to pin 4", "BLACK", "PED 15439568"):
            self.assertIsNone(parse_code(text, self.convention, allow_pin=True), text)

    def test_awg_words_are_exact_text_only(self):
        self.assertIsNone(parse_code("PINK / DK.GREEN 18", self.convention))

    def test_a_lightness_word_is_not_read_as_its_plain_colour(self):
        """'Dark green 1,5' used to match GREEN alone and paint the wire GN."""
        self.assertEqual(parse_code("Dark green 1,5", self.convention), "DGN")


class Harvest(unittest.TestCase):
    def test_rail_core_and_tracers_are_one_conductor_each(self):
        from wirecolor.eval.teacher import harvest_page

        document, page = _factory_page()
        harvest = harvest_page(page)
        widths = sorted(round(conductor.width, 2) for conductor in harvest.conductors)
        self.assertEqual(widths, [1.5, 4.0])
        two_colour = [conductor for conductor in harvest.conductors if conductor.tracer_rgb]
        self.assertEqual(len(two_colour), 2)
        self.assertEqual(harvest.rail_pairs, 1)
        document.close()

    def test_the_palette_is_learned_from_the_printed_codes(self):
        from wirecolor.eval.teacher import (build_atlas, harvest_page, legend_votes,
                                            resolve_tokens)
        from wirecolor.labels.text_layer import read_legends, strong_legends

        convention = load_convention("volvo_classic")
        document, page = _factory_page()
        harvest = harvest_page(page)
        atlas = build_atlas(legend_votes(harvest.conductors,
                                         strong_legends(read_legends(page, 72, convention))),
                            min_support=1)
        resolve_tokens(harvest.conductors, atlas, convention)
        self.assertEqual(sorted(conductor.code for conductor in harvest.conductors),
                         ["P/DGN", "R/PU"])
        document.close()

    def test_the_twin_is_monochrome_and_keeps_the_codes_as_text(self):
        import fitz

        from wirecolor.eval.teacher import build_twin, harvest_page

        document, page = _factory_page()
        harvest = harvest_page(page)
        twin_document = fitz.open()
        twin = build_twin(page, harvest, twin_document)
        colours = {tuple(round(v, 2) for v in drawing["color"])
                   for drawing in twin.get_drawings() if drawing.get("color")}
        self.assertTrue(all(max(c) - min(c) < 0.01 for c in colours), colours)
        self.assertIn("PINK / DK.GREEN 18", twin.get_text())
        # no conductor polyline is closed back to its start
        for drawing in twin.get_drawings():
            self.assertFalse(drawing.get("closePath") and drawing.get("width") == harvest.pen)
        twin_document.close()
        document.close()

    def test_a_printed_code_that_contradicts_the_paint_is_a_factory_conflict(self):
        from wirecolor.eval.teacher import (Conductor, mark_printed_conflicts)
        from wirecolor.labels.text_layer import Legend

        convention = load_convention("volvo_classic")
        conductor = Conductor(segments=[((0, 10), (100, 10))], width=2, base_rgb=(0, 0, 0),
                              base_token="SB")
        legend = Legend(raw="RED 16", code="R", x=50, y=6, axis="h", wire_id=None)
        self.assertEqual(mark_printed_conflicts([conductor], [legend], convention), 1)
        self.assertTrue(conductor.factory_conflict)


class TrimAtComponentEdges(unittest.TestCase):
    class Run:
        def __init__(self, points):
            self.points = points

    def test_a_conductor_ending_inside_a_box_stops_at_its_edge(self):
        from wirecolor.detect.vector_symbols import trim_runs_ending_inside_zones

        run = self.Run([(0, 50), (100, 50), (130, 50)])
        self.assertEqual(trim_runs_ending_inside_zones([run], [(110, 30, 160, 70)]), 1)
        self.assertEqual(run.points[-1], (110.0, 50.0))
        self.assertEqual(run.points[0], (0.0, 50.0))

    def test_a_conductor_through_a_box_is_left_for_the_crossing_test(self):
        from wirecolor.detect.vector_symbols import (runs_crossing_zones,
                                                     trim_runs_ending_inside_zones)

        run = self.Run([(0, 50), (200, 50)])
        self.assertEqual(trim_runs_ending_inside_zones([run], [(110, 30, 160, 70)]), 0)
        self.assertEqual(runs_crossing_zones([run], [(110, 30, 160, 70)]), {0})

    def test_a_run_wholly_inside_a_box_is_emptied(self):
        from wirecolor.detect.vector_symbols import trim_runs_ending_inside_zones

        run = self.Run([(120, 40), (150, 40)])
        trim_runs_ending_inside_zones([run], [(110, 30, 160, 70)])
        self.assertEqual(run.points, [])


class ConnectorPinTicks(unittest.TestCase):
    def test_wires_drawn_into_a_connector_keep_their_colour_up_to_its_edge(self):
        """Three labelled wires run 20 pt into a connector body to their pin numbers.

        Before trimming, the paint reached deep into the body and the pixel gate's repair pass
        withdrew all three (the main engine paints 0 of them).
        """
        import fitz

        from wirecolor.tools.paint_vector import paint_page

        with tempfile.TemporaryDirectory() as folder:
            document = fitz.open()
            page = document.new_page(width=595, height=842)
            for y, label in ((300, "1.5 R"), (330, "0.75 GN/SB"), (360, "1.5 BL")):
                page.draw_line((60, y), (330, y), color=(0, 0, 0), width=0.6)
                page.insert_text((120, y - 3), label, fontsize=6)
            page.draw_rect(fitz.Rect(310, 285, 350, 375), color=(0, 0, 0), width=0.6)
            for number, y in enumerate((300, 330, 360), 1):
                page.insert_text((318, y + 2), str(number), fontsize=6)
            pdf = str(Path(folder) / "connector.pdf")
            document.save(pdf)
            document.close()
            report = paint_page(pdf, 0, folder, convention_name="volvo_classic",
                                overlay_path=str(Path(folder) / "overlay.png"))
        self.assertEqual(report["runs_painted"], 3)
        self.assertEqual(report["runs_trimmed_at_symbols"], 3)
        self.assertTrue(report["v2"]["passed"])


class BareCodeGrammar(unittest.TestCase):
    def _legend(self, raw, code, x=0.0):
        from wirecolor.labels.text_layer import Legend

        return Legend(raw=raw, code=code, x=x, y=0.0, axis="h", wire_id=None)

    def test_a_sheet_of_bare_codes_accepts_a_bare_letter_outside_symbols(self):
        from wirecolor.labels.text_layer import promote_bare_letters

        convention = load_convention("volvo_classic")
        strong = [self._legend("SB", "SB", 1000.0 * i) for i in range(14)]
        bare_r = self._legend("R", "R", 5.0)
        promoted = promote_bare_letters(strong + [bare_r], strong, [], convention)
        self.assertEqual(promoted, [bare_r])

    def test_a_gauged_sheet_still_needs_a_corroborating_peer(self):
        from wirecolor.labels.text_layer import promote_bare_letters

        convention = load_convention("volvo_classic")
        strong = [self._legend("1.5 SB", "SB", 1000.0 * i) for i in range(14)]
        bare_p = self._legend("P", "P", 5.0)
        self.assertEqual(promote_bare_letters(strong + [bare_p], strong, [], convention), [])

    def test_a_bare_letter_inside_a_symbol_is_never_promoted(self):
        from wirecolor.labels.text_layer import promote_bare_letters

        convention = load_convention("volvo_classic")
        strong = [self._legend("SB", "SB", 1000.0 * i) for i in range(14)]
        bare_p = self._legend("P", "P", 5.0)
        promoted = promote_bare_letters(strong + [bare_p], strong, [(0, -10, 10, 10)],
                                        convention)
        self.assertEqual(promoted, [])


class RenderStyles(unittest.TestCase):
    class Run:
        def __init__(self, code, raw):
            self.points = [(20.0, 50.0), (180.0, 50.0)]
            self.code = code
            self.legend_raw = raw
            self.contested = False
            self.abstained = False

    def _paint(self, code, raw="R/PU", style="oem", gauge="0"):
        import os

        from wirecolor.paint.vector_overlay import build_rgba

        previous = os.environ.get("PINTOR_RENDER_GAUGE")
        os.environ["PINTOR_RENDER_GAUGE"] = gauge
        try:
            rgba, _ = build_rgba([self.Run(code, raw)], (100, 200), load_convention("volvo_classic"),
                                 200, pen_px=2.8, page_pt=(595, 842), style=style)
        finally:
            if previous is None:
                os.environ.pop("PINTOR_RENDER_GAUGE", None)
            else:
                os.environ["PINTOR_RENDER_GAUGE"] = previous
        return rgba

    def _column(self, rgba):
        column = rgba[:, 100]
        return [tuple(int(v) for v in pixel[:3]) for pixel in column if pixel[3]]

    def test_oem_draws_rail_core_and_a_centred_tracer(self):
        convention = load_convention("volvo_classic")
        red = tuple(convention.colors_bgr["R"])          # the canvas is BGRA, as OpenCV draws
        purple = tuple(convention.colors_bgr["PU"])
        column = self._column(self._paint("R/PU"))
        self.assertEqual(column[0], (0, 0, 0))
        self.assertEqual(column[-1], (0, 0, 0))
        self.assertIn(red, column)
        middle = column[len(column) // 2]
        self.assertEqual(middle, purple)
        self.assertEqual(column[:len(column) // 2].count(red),
                         column[len(column) // 2 + 1:].count(red))

    def test_oem_keeps_the_single_colour_band_footprint(self):
        """Every geometric gate was measured against the band a one-colour cable paints."""
        oem = len(self._column(self._paint("R/PU", style="oem")))
        single = len(self._column(self._paint("R", raw="R", style="stripes")))
        self.assertEqual(oem, single)

    def test_a_heavier_printed_gauge_draws_a_heavier_cable(self):
        signal = len(self._column(self._paint("R", raw="R 0,75", gauge="1")))
        battery = len(self._column(self._paint("R", raw="35 R", gauge="1")))
        self.assertGreater(battery, 2 * signal)

    def test_gauge_widths_can_be_turned_off(self):
        signal = len(self._column(self._paint("R", raw="R 0,75", gauge="0")))
        battery = len(self._column(self._paint("R", raw="35 R", gauge="0")))
        self.assertEqual(signal, battery)

    def test_oem_with_gauge_is_the_default(self):
        import os

        from wirecolor.paint.vector_overlay import gauge_widths_enabled, render_style

        saved = {key: os.environ.pop(key, None)
                 for key in ("PINTOR_RENDER_STYLE", "PINTOR_RENDER_GAUGE")}
        try:
            self.assertEqual(render_style(), "oem")
            self.assertTrue(gauge_widths_enabled())
        finally:
            for key, value in saved.items():
                if value is not None:
                    os.environ[key] = value

    def test_oem_white_is_railed_and_never_black_between_colours(self):
        convention = load_convention("volvo_classic")
        green = tuple(convention.colors_bgr["GN"])
        single = self._column(self._paint("W", raw="W"))
        self.assertEqual((single[0], single[-1]), ((0, 0, 0), (0, 0, 0)))
        self.assertIn((255, 255, 255), single)
        pair = self._column(self._paint("GN/W", raw="GN/W"))
        inner = pair[1:-1]
        self.assertNotIn((0, 0, 0), inner)
        self.assertIn(green, inner)
        self.assertEqual(inner[len(inner) // 2], (255, 255, 255))

    def test_gauges_are_read_from_both_systems(self):
        from wirecolor.paint.vector_overlay import gauge_factor

        self.assertEqual(gauge_factor("BLACK 14"), 2.0)
        self.assertEqual(gauge_factor("PINK / DK.GREEN 18"), 1.0)
        self.assertEqual(gauge_factor("SB 1,5"), 1.33)
        self.assertEqual(gauge_factor("R (w192)"), 1.0)


class WireNetFilter(unittest.TestCase):
    class Run:
        def __init__(self, points, code):
            self.points = points
            self.code = code
            self.abstained = False
            self.abstain_reason = None
            self.abstained_from_code = None

    def test_a_run_the_network_does_not_see_as_a_conductor_goes_black(self):
        from wirecolor.engine.wirenet import withdraw_unrecognised_runs

        probability = np.zeros((100, 200), np.float32)
        probability[48:53, 10:190] = 0.9          # a conductor along y = 50
        wire = self.Run([(10, 50), (190, 50)], "R")
        housing = self.Run([(10, 80), (190, 80)], "R")
        self.assertEqual(withdraw_unrecognised_runs([wire, housing], probability), 1)
        self.assertEqual(wire.code, "R")
        self.assertIsNone(housing.code)
        self.assertEqual(housing.abstained_from_code, "R")

    def test_the_filter_never_changes_a_colour(self):
        from wirecolor.engine.wirenet import withdraw_unrecognised_runs

        probability = np.ones((100, 200), np.float32)
        run = self.Run([(10, 50), (190, 50)], "GN/SB")
        withdraw_unrecognised_runs([run], probability)
        self.assertEqual(run.code, "GN/SB")


if __name__ == "__main__":
    unittest.main()
