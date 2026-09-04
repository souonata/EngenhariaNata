"""Tests for reading component symbols off a vector page's closed shapes.

The property under test is the one the painter depends on:

    a closed outline of component size is a SYMBOL and must leave the conductor graph;
    a junction dot, a page border and an open polyline must not.

Getting the floor wrong severs every splice on the sheet; getting the ceiling wrong erases the
page. Both bounds are therefore pinned here rather than left to the corpus to discover.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

import fitz

from wirecolor.detect.vector_symbols import (_is_twist_mark, classify_symbol_geometry,
                                             clip_segments_to_opaque, strip_symbol_strokes,
                                             symbol_geometry)
from wirecolor.eval.vector_truth import build_nets, extract_segments, node_segments

DPI = 200
SCALE = DPI / 72.0
PEN_PX = 1.0 * SCALE          # a 1 pt pen, so the 8-pen floor sits at ~22 px


def page_with(draw, width=400, height=300):
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    draw(page)
    return doc, page


def rect(page, x0, y0, x1, y1):
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(x0, y0, x1, y1))
    shape.finish(color=(0, 0, 0), width=1.0)
    shape.commit()


def line(page, x0, y0, x1, y1):
    shape = page.new_shape()
    shape.draw_line(fitz.Point(x0, y0), fitz.Point(x1, y1))
    shape.finish(color=(0, 0, 0), width=1.0)
    shape.commit()


def filled_rect(page, x0, y0, x1, y1, fill=(1, 1, 1)):
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(x0, y0, x1, y1))
    shape.finish(color=(0, 0, 0), fill=fill, width=1.0)
    shape.commit()


class SymbolZones(unittest.TestCase):
    def test_component_rectangle_is_a_symbol(self):
        doc, page = page_with(lambda p: rect(p, 100, 100, 140, 140))
        zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(len(zones), 1)
        self.assertEqual(len(strokes), 4)

    def test_junction_dot_is_not_a_symbol(self):
        """A closed shape only a few pen widths across is a connection, not a component."""
        doc, page = page_with(lambda p: rect(p, 100, 100, 103, 103))
        zones, _ = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(zones, [])

    def test_page_border_is_not_a_symbol(self):
        doc, page = page_with(lambda p: rect(p, 5, 5, 395, 295))
        zones, _ = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(zones, [])

    def test_open_polyline_is_not_a_symbol(self):
        def draw(p):
            line(p, 50, 50, 150, 50)
            line(p, 150, 50, 150, 150)
        doc, page = page_with(draw)
        zones, _ = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(zones, [])


class StripSymbolStrokes(unittest.TestCase):
    def test_symbol_stops_bonding_the_cables_it_touches(self):
        """Two cables ending on opposite edges of a housing must not become one net."""
        def draw(p):
            rect(p, 100, 100, 140, 140)
            line(p, 60, 120, 100, 120)        # cable arriving at the left edge
            line(p, 140, 120, 180, 120)       # a DIFFERENT cable leaving the right edge

        doc, page = page_with(draw)
        segments = extract_segments(page, DPI)
        self.assertEqual(len(build_nets(node_segments(segments))), 1,
                         "precondition: the housing outline bonds both cables")

        _, strokes = symbol_geometry(page, DPI, PEN_PX)
        stripped, removed = strip_symbol_strokes(segments, strokes)
        doc.close()

        self.assertEqual(removed, 4)
        self.assertEqual(len(build_nets(node_segments(stripped))), 2)

    def test_conductors_are_left_untouched(self):
        def draw(p):
            rect(p, 100, 100, 140, 140)
            line(p, 60, 200, 300, 200)

        doc, page = page_with(draw)
        segments = extract_segments(page, DPI)
        _, strokes = symbol_geometry(page, DPI, PEN_PX)
        stripped, removed = strip_symbol_strokes(segments, strokes)
        doc.close()

        self.assertEqual(removed, 4)
        self.assertEqual(len(stripped), len(segments) - 4)

    def test_no_symbols_is_a_no_op(self):
        segments = [((0.0, 0.0), (10.0, 0.0))]
        stripped, removed = strip_symbol_strokes(segments, set())
        self.assertEqual(removed, 0)
        self.assertEqual(stripped, segments)


class OpaqueHousings(unittest.TestCase):
    def test_a_paper_filled_housing_is_classified_without_breaking_the_legacy_api(self):
        doc, page = page_with(lambda p: filled_rect(p, 100, 100, 140, 140))
        details = classify_symbol_geometry(page, DPI, PEN_PX)
        legacy_zones, legacy_strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()

        self.assertEqual(details.zones, legacy_zones)
        self.assertEqual(details.stroke_keys, legacy_strokes)
        self.assertEqual(details.opaque_zones, details.zones)

    def test_an_ink_filled_shape_is_still_a_junction(self):
        doc, page = page_with(
            lambda p: filled_rect(p, 100, 100, 140, 140, fill=(0, 0, 0)))
        details = classify_symbol_geometry(page, DPI, PEN_PX)
        doc.close()

        self.assertEqual(details.zones, [])
        self.assertEqual(details.opaque_zones, [])

    def test_a_conductor_is_cut_only_inside_an_opaque_housing(self):
        segments = [((0.0, 50.0), (100.0, 50.0))]

        kept, clipped = clip_segments_to_opaque(
            segments, [(40.0, 40.0, 60.0, 60.0)])

        self.assertEqual(clipped, 1)
        self.assertEqual(
            kept,
            [((0.0, 50.0), (40.0, 50.0)), ((60.0, 50.0), (100.0, 50.0))],
        )

    def test_clear_and_absent_housings_are_no_ops(self):
        segments = [((0.0, 5.0), (100.0, 5.0))]

        self.assertEqual(
            clip_segments_to_opaque(segments, [(40.0, 40.0, 60.0, 60.0)]),
            (segments, 0),
        )
        self.assertEqual(clip_segments_to_opaque(segments, []), (segments, 0))

    def test_a_conductor_ending_under_the_fill_keeps_only_visible_geometry(self):
        kept, clipped = clip_segments_to_opaque(
            [((0.0, 50.0), (50.0, 50.0))], [(40.0, 40.0, 60.0, 60.0)])

        self.assertEqual(clipped, 1)
        self.assertEqual(kept, [((0.0, 50.0), (40.0, 50.0))])


class TwistMarkDetector(unittest.TestCase):
    """The bowtie primitive: two near-equal diagonals crossing at a shared midpoint, both short."""

    IDENT = fitz.Matrix(1, 1)

    def _lines(self, *segs):
        return [("l", fitz.Point(*a), fitz.Point(*b)) for a, b in segs]

    def test_crossing_equal_diagonals_are_a_twist(self):
        items = self._lines(((0, 0), (30, 20)), ((0, 20), (30, 0)))
        self.assertTrue(_is_twist_mark(items, self.IDENT, max_len=60))

    def test_parallel_lines_are_not_a_twist(self):
        items = self._lines(((0, 0), (30, 0)), ((0, 10), (30, 10)))
        self.assertFalse(_is_twist_mark(items, self.IDENT, max_len=60))

    def test_a_real_crossing_of_long_cables_is_not_a_twist(self):
        # two long strokes cross, but each is a routed cable, so both exceed the length cap
        items = self._lines(((0, 0), (100, 80)), ((0, 80), (100, 0)))
        self.assertFalse(_is_twist_mark(items, self.IDENT, max_len=60))

    def test_short_lines_with_separate_midpoints_are_not_a_twist(self):
        items = self._lines(((0, 0), (30, 20)), ((20, 20), (50, 0)))
        self.assertFalse(_is_twist_mark(items, self.IDENT, max_len=60))

    def test_a_single_line_is_not_a_twist(self):
        self.assertFalse(_is_twist_mark(self._lines(((0, 0), (30, 0))), self.IDENT, max_len=60))


class TwistMarkStripping(unittest.TestCase):
    """A genuine wire crossing is two SEPARATE single-line paths, never one two-line twist path,
    so it must survive. (The positive case -- a real bowtie path being stripped -- is exercised
    end to end by the corpus sweep; ``fitz.Shape`` cannot reproduce the clean two-line primitive a
    real PDF emits, it doubles each stroke, so it is not asserted here.)"""

    def test_two_separate_crossing_cables_are_not_stripped(self):
        def draw(p):
            line(p, 100, 100, 500, 500)
            line(p, 100, 500, 500, 100)
        doc, page = page_with(draw, width=800, height=600)
        _zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(strokes, set(), "real crossings of routed cables must survive")


if __name__ == "__main__":
    unittest.main()
