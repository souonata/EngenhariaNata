"""A polychromatic connector edge must lose its colour; a monochrome bus must keep it.

The discriminator the whole module rests on: a real conductor is one colour end to end, while a
connector edge picks up a different colour from every pin it passes. These tests pin that boundary
so a future change cannot quietly start dissolving buses.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import fitz  # noqa: E402

from wirecolor.detect.vector_rails import strip_connector_rails  # noqa: E402
from wirecolor.eval.vector_truth import geometry_is_trustworthy  # noqa: E402


class Run:
    def __init__(self, points, code):
        self.points = points
        self.code = code
        self.propagated = False


# A page diagonal big enough that the rails below clear the 12% span floor, with a small
# min-conductor so the short edge segments qualify as rail candidates.
DIAG = 3000.0
FLOOR = 50.0


def horizontal(y, x0, x1, code):
    return Run([(x0, y), (x1, y)], code)


class StripConnectorRails(unittest.TestCase):
    def test_polychromatic_edge_is_dissolved(self):
        # Five short collinear segments on one line, five different colours: a connector edge.
        rail = [horizontal(1224, 400 + i * 200, 400 + i * 200 + 60, code)
                for i, code in enumerate(["Y", "R/W", "BN/OR", "GR/SB", "OR"])]
        n = strip_connector_rails(rail, DIAG, FLOOR)
        self.assertEqual(n, 5)
        self.assertTrue(all(r.code is None for r in rail))

    def test_monochrome_bus_is_left_alone(self):
        # Same geometry, one colour: a bus tapped many times. It must keep every segment.
        bus = [horizontal(1224, 400 + i * 200, 400 + i * 200 + 60, "SB")
               for i in range(5)]
        n = strip_connector_rails(bus, DIAG, FLOOR)
        self.assertEqual(n, 0)
        self.assertTrue(all(r.code == "SB" for r in bus))

    def test_two_colours_is_not_enough(self):
        # A real end-to-end splice where two colours meet must not be mistaken for a frame.
        pair = [horizontal(1224, 400, 460, "R"), horizontal(1224, 700, 760, "R"),
                horizontal(1224, 1000, 1060, "GN")]
        self.assertEqual(strip_connector_rails(pair, DIAG, FLOOR), 0)

    def test_long_runs_are_not_rail_candidates(self):
        # Three different colours, but each run is a long routed conductor, not a short edge piece.
        longruns = [horizontal(1224, 0, 900, "Y"), horizontal(1224, 1000, 1900, "R"),
                    horizontal(1224, 2000, 2900, "GN")]
        self.assertEqual(strip_connector_rails(longruns, DIAG, FLOOR), 0)

    def test_short_span_is_not_a_rail(self):
        # Three colours, three short segments, but they span less than a symbol -- a cluster of
        # tiny stubs, not a connector edge across the sheet.
        tiny = [horizontal(1224, 400, 430, "Y"), horizontal(1224, 450, 480, "R"),
                horizontal(1224, 500, 530, "GN")]
        self.assertEqual(strip_connector_rails(tiny, DIAG, FLOOR), 0)

    def test_diagonal_runs_are_never_rail(self):
        # A rail is a straight drawn edge; an L or a diagonal conductor is not, whatever its colours.
        diag = [Run([(400, 1200), (460, 1260)], "Y"), Run([(700, 1200), (760, 1260)], "R"),
                Run([(1000, 1200), (1060, 1260)], "GN")]
        self.assertEqual(strip_connector_rails(diag, DIAG, FLOOR), 0)

    def test_vertical_edge_is_dissolved(self):
        # The CONNECTOR A/B box border on pub 80 is a vertical line at one x carrying BN/OR, OR, W.
        rail = [Run([(736, 350 + i * 200), (736, 350 + i * 200 + 60)], code)
                for i, code in enumerate(["BN/OR", "OR", "W", "OR", "W"])]
        self.assertEqual(strip_connector_rails(rail, DIAG, FLOOR), 5)


class GeometryTrust(unittest.TestCase):
    """The raster-foldout gate: refuse a page whose schematic is a bitmap, not strokes."""

    def test_thresholds_separate_the_measured_corpus(self):
        from wirecolor.eval.vector_truth import (MIN_SCHEMATIC_INK_RATIO,
                                                 MAX_RASTER_IMAGE_COVERAGE)
        # measured: raster sheets 0.55-1.91 ink, 12-64% image; vector sheets >=10.62 ink, 0% image
        self.assertGreater(MIN_SCHEMATIC_INK_RATIO, 1.91)
        self.assertLess(MIN_SCHEMATIC_INK_RATIO, 10.62)
        self.assertGreater(MAX_RASTER_IMAGE_COVERAGE, 0.0)
        self.assertLess(MAX_RASTER_IMAGE_COVERAGE, 0.12)

    def test_full_page_scan_thresholds_isolate_the_scan(self):
        from wirecolor.eval.vector_truth import (FULL_PAGE_IMAGE_COVERAGE, RASTER_SCAN_INK_RATIO,
                                                 MAX_RASTER_IMAGE_COVERAGE)
        # a scanned diagram is ONE image over the whole page: measured 100% coverage, next-highest
        # non-scan raster image 65% -> the full-page tell sits above every poster, at/under a page
        self.assertGreater(FULL_PAGE_IMAGE_COVERAGE, 0.65)
        self.assertGreater(FULL_PAGE_IMAGE_COVERAGE, MAX_RASTER_IMAGE_COVERAGE)
        self.assertLessEqual(FULL_PAGE_IMAGE_COVERAGE, 1.0)
        # the scan's stray vector ink is 10.72x diagonal; real vector schematics run 36-76 -> the
        # ceiling sits above the scan and far below any real schematic
        self.assertGreater(RASTER_SCAN_INK_RATIO, 10.72)
        self.assertLess(RASTER_SCAN_INK_RATIO, 36.0)


def _synthetic_page(n_lines, line_len, with_image):
    """A page carrying `n_lines` strokes and optionally one full-page image, round-tripped through
    bytes so get_images/get_drawings both see the content."""
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    if with_image:
        pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 4, 4))
        pixmap.clear_with(210)
        page.insert_image(page.rect, pixmap=pixmap)
    y = 20.0
    for _ in range(n_lines):
        page.draw_line(fitz.Point(30, y), fitz.Point(30 + line_len, y), width=0.8)
        y += 6
    reopened = fitz.open("pdf", document.tobytes())
    document.close()
    return reopened[0]


class RasterScanTier(unittest.TestCase):
    """The second decline tier: a full-page SCAN whose stray vector ink clears the poster floor."""

    def test_full_page_image_with_stray_ink_is_declined(self):
        # 100% image + ink 7.76x (above the 5.0 poster floor, below the 15.0 scan ceiling) = pub23
        page = _synthetic_page(n_lines=10, line_len=800, with_image=True)
        ok, reason = geometry_is_trustworthy(page, 200)
        self.assertFalse(ok)
        self.assertIn("raster scan", reason)

    def test_dense_vector_over_a_full_page_image_still_paints(self):
        # a real schematic that happens to sit over a full-page background: ink 31x clears the ceiling
        page = _synthetic_page(n_lines=40, line_len=800, with_image=True)
        ok, _reason = geometry_is_trustworthy(page, 200)
        self.assertTrue(ok)

    def test_moderate_ink_without_an_image_still_paints(self):
        # the ink ceiling must never bite on its own -- only in the presence of a full-page image
        page = _synthetic_page(n_lines=10, line_len=800, with_image=False)
        ok, _reason = geometry_is_trustworthy(page, 200)
        self.assertTrue(ok)


class StripFrameBorders(unittest.TestCase):
    """A long line that many DIFFERENT-coloured wires terminate on is a housing edge, not a bus."""

    def test_monochrome_border_with_polychromatic_terminations_is_cleared(self):
        from wirecolor.detect.vector_rails import strip_frame_borders
        border = Run([(1000, 100), (1000, 900)], "R")          # long vertical edge
        wires = [Run([(900, 200), (1000, 200)], "GN"),          # horizontal wires ending on it
                 Run([(900, 400), (1000, 400)], "BL/SB"),
                 Run([(900, 600), (1000, 600)], "Y/GR")]
        self.assertEqual(strip_frame_borders([border, *wires], FLOOR), 1)
        self.assertIsNone(border.code)
        self.assertTrue(all(w.code for w in wires))            # the wires keep their colour

    def test_a_bus_feeding_one_colour_is_kept(self):
        from wirecolor.detect.vector_rails import strip_frame_borders
        bus = Run([(1000, 100), (1000, 900)], "SB")
        taps = [Run([(900, 200), (1000, 200)], "SB"),          # branches inherit the bus colour
                Run([(900, 400), (1000, 400)], "SB"),
                Run([(900, 600), (1000, 600)], "SB")]
        self.assertEqual(strip_frame_borders([bus, *taps], FLOOR), 0)
        self.assertEqual(bus.code, "SB")

    def test_two_colours_is_not_enough(self):
        from wirecolor.detect.vector_rails import strip_frame_borders
        border = Run([(1000, 100), (1000, 900)], "R")
        wires = [Run([(900, 200), (1000, 200)], "GN"), Run([(900, 400), (1000, 400)], "BL")]
        self.assertEqual(strip_frame_borders([border, *wires], FLOOR), 0)

    def test_parallel_wires_do_not_count_as_terminations(self):
        from wirecolor.detect.vector_rails import strip_frame_borders
        border = Run([(1000, 100), (1000, 900)], "R")
        # three long PARALLEL (vertical) neighbours -- same axis as the border, not perpendicular
        para = [Run([(1000, 100), (1000, 900)], code) for code in ("GN", "BL", "Y")]
        # displace them so they aren't the border itself
        for i, run in enumerate(para):
            run.points = [(1000 + 5 * (i + 1), 100), (1000 + 5 * (i + 1), 900)]
        self.assertEqual(strip_frame_borders([border, *para], FLOOR), 0)


class SplitFusedFrameBorders(unittest.TestCase):
    """A housing edge fused into a conductor is cut out and blacked; the wire survives on each side."""

    class R:  # a splittable run (not the frozen test Run above -- split needs mutable ownership)
        def __init__(self, points, code):
            self.index = 0
            self.points = points
            self.code = code
            self.legend_raw = code
            self.distance = 0.0
            self.propagated = False

    def test_edge_is_cut_out_and_wire_kept(self):
        from wirecolor.detect.vector_rails import split_fused_frame_borders
        # a run that comes in horizontally, runs down a long vertical edge, and leaves horizontally
        fused = self.R([(200, 500), (1000, 500), (1000, 1500), (1800, 1500)], "R")
        # six different-coloured horizontal wires terminating on the vertical edge at x=1000
        wires = [self.R([(700, 550 + i * 150), (1000, 550 + i * 150)], code)
                 for i, code in enumerate(["GN", "BL", "Y", "SB", "W/SB", "VO"])]
        new, n = split_fused_frame_borders([fused, *wires], 50.0)
        self.assertEqual(n, 1)
        # the vertical stretch is now black; horizontal wire stubs of the original keep R
        painted = [r for r in new if r.code == "R"]
        black = [r for r in new if r.code is None]
        self.assertTrue(painted, "the wire portions must stay painted")
        self.assertTrue(black, "the edge portion must be blacked")
        for r in black:
            xs = [p[0] for p in r.points]
            self.assertLess(max(xs) - min(xs), 5)   # the blacked piece is the vertical edge

    def test_a_plain_conductor_is_not_split(self):
        from wirecolor.detect.vector_rails import split_fused_frame_borders
        wire = self.R([(0, 100), (1000, 100), (1000, 900)], "R")
        # only two neighbours -- nowhere near the frame signature
        near = [self.R([(900, 300), (1000, 300)], "GN"), self.R([(900, 500), (1000, 500)], "BL")]
        new, n = split_fused_frame_borders([wire, *near], 50.0)
        self.assertEqual(n, 0)
        self.assertEqual(len([r for r in new if r.code == "R"]), 1)


if __name__ == "__main__":
    unittest.main()
