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

from wirecolor.detect.vector_symbols import (_is_twist_mark, assembled_rectangles,
                                             classify_symbol_geometry,
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


def stroke(page, *points):
    """One open path through ``points``, emitted exactly as drawn (``line`` closes it back)."""
    shape = page.new_shape()
    shape.draw_polyline([fitz.Point(x, y) for x, y in points])
    shape.finish(color=(0, 0, 0), width=1.0, closePath=False)
    shape.commit()


def loose_box(page, x0, y0, x1, y1):
    """A rectangle drawn as four independent one-stroke paths, as the D4/D6 p111 pin boxes are."""
    stroke(page, (x0, y0), (x1, y0))
    stroke(page, (x1, y1), (x1, y0))
    stroke(page, (x0, y1), (x1, y1))
    stroke(page, (x0, y0), (x0, y1))


class AssembledRectangles(unittest.TestCase):
    def test_four_loose_strokes_meeting_at_the_corners_are_a_symbol(self):
        doc, page = page_with(lambda p: loose_box(p, 100, 100, 140, 120))
        zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(len(zones), 1)
        self.assertEqual(len(strokes), 4)

    def test_the_assembled_box_stops_bonding_the_cables_it_touches(self):
        def draw(p):
            loose_box(p, 100, 100, 140, 140)
            stroke(p, (60, 120), (100, 120))
            stroke(p, (140, 120), (180, 120))

        doc, page = page_with(draw)
        segments = extract_segments(page, DPI)
        self.assertEqual(len(build_nets(node_segments(segments))), 1,
                         "precondition: the loose outline bonds both cables")
        _, strokes = symbol_geometry(page, DPI, PEN_PX)
        stripped, removed = strip_symbol_strokes(segments, strokes)
        doc.close()
        self.assertEqual(removed, 4)
        self.assertEqual(len(build_nets(node_segments(stripped))), 2)

    def test_each_rectangle_is_found_once(self):
        doc, page = page_with(lambda p: loose_box(p, 100, 100, 140, 120))
        found = assembled_rectangles(page.get_drawings())
        doc.close()
        self.assertEqual(len(found), 1)

    def test_a_side_inside_a_longer_polyline_is_a_route_not_a_side(self):
        """Three loose sides closed by a conductor's L-shaped route are not a housing."""
        def draw(p):
            stroke(p, (100, 100), (140, 100))
            stroke(p, (140, 100), (140, 120))
            stroke(p, (100, 120), (140, 120))
            stroke(p, (60, 100), (100, 100), (100, 120))

        doc, page = page_with(draw)
        zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual((zones, strokes), ([], set()))

    def test_sides_that_do_not_meet_are_not_a_rectangle(self):
        def draw(p):
            stroke(p, (100, 100), (140, 100))
            stroke(p, (140, 100), (140, 120))
            stroke(p, (100, 120), (140, 120))
            stroke(p, (100, 103), (100, 120))      # 3 pt short of the corner

        doc, page = page_with(draw)
        found = assembled_rectangles(page.get_drawings())
        doc.close()
        self.assertEqual(found, [])

    def test_assembled_shapes_keep_the_closed_shape_size_bounds(self):
        """The floor that spares junction squares and the ceiling that spares the page border
        apply to an assembled rectangle exactly as to a closed path."""
        doc, page = page_with(lambda p: loose_box(p, 100, 100, 103, 103))
        self.assertEqual(symbol_geometry(page, DPI, PEN_PX), ([], set()))
        doc.close()
        doc, page = page_with(lambda p: loose_box(p, 5, 5, 395, 295))
        zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(zones, [])
        self.assertEqual(len(strokes), 4, "a frame is not a zone, but its ink is not wire either")


class OversizedOutlines(unittest.TestCase):
    """A rectangle too large or too thin to be a component is not a protected zone -- a zone
    withdraws every run that crosses it -- but its ink is still not a conductor. On D4/D6 p111 the
    89-pole connector (40% of the diagonal) and a 10 x 352 pt pin strip are each one long edge that
    every pin wire touches, so leaving that edge in topology bonds all of those wires together."""

    def test_a_long_connector_strip_loses_its_ink_but_protects_nothing(self):
        def draw(p):
            loose_box(p, 300, 20, 310, 280)
            for y in (60, 100, 140):
                stroke(p, (200, y), (300, y))

        doc, page = page_with(draw)
        segments = extract_segments(page, DPI)
        self.assertEqual(len(build_nets(node_segments(segments))), 1,
                         "precondition: the strip's edge bonds every pin wire")
        zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        stripped, removed = strip_symbol_strokes(segments, strokes)
        doc.close()
        self.assertEqual(zones, [])
        self.assertEqual(removed, 4)
        self.assertEqual(len(build_nets(node_segments(stripped))), 3)

    def test_an_oversized_closed_rectangle_loses_its_ink_but_protects_nothing(self):
        doc, page = page_with(lambda p: rect(p, 100, 20, 140, 280))
        zones, strokes = symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(zones, [])
        self.assertEqual(len(strokes), 4)

    def test_an_oversized_closed_shape_that_is_not_a_rectangle_is_left_alone(self):
        def draw(p):
            shape = p.new_shape()
            shape.draw_polyline([fitz.Point(x, y) for x, y in
                                 ((20, 20), (380, 20), (380, 280), (200, 150), (20, 280))])
            shape.finish(color=(0, 0, 0), width=1.0, closePath=True)
            shape.commit()

        doc, page = page_with(draw)
        self.assertEqual(symbol_geometry(page, DPI, PEN_PX), ([], set()))
        doc.close()

    def test_an_oversized_rectangle_leaves_its_outline_as_a_barrier(self):
        doc, page = page_with(lambda p: rect(p, 100, 20, 140, 280))
        barriers = classify_symbol_geometry(page, DPI, PEN_PX).barriers
        doc.close()
        self.assertEqual(len(barriers), 4)
        x0, y0, x1, y1 = (value / SCALE for value in barriers[0])
        self.assertAlmostEqual(min(y0, y1), 20, places=3)

    def test_a_protected_rectangle_needs_no_barrier(self):
        doc, page = page_with(lambda p: rect(p, 100, 100, 140, 140))
        geometry = classify_symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(len(geometry.zones), 1)
        self.assertEqual(geometry.barriers, [])


def ribbon_page(rings, width=400, height=300):
    """One filled, unstroked path of explicitly closed rings: an outline-stroked drawing."""
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    shape = page.new_shape()
    for ring in rings:
        shape.draw_polyline([*ring, ring[0]])
    shape.finish(color=None, fill=(0, 0, 0), closePath=False)
    shape.commit()
    return doc, page


def bar(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def ribbon_box(x0, y0, x1, y1, half=0.5):
    """Four side rings, each running to the outer edge of its neighbours, as an outline export
    draws a 1 pt box."""
    return [bar(x0 - half, y0 - half, x1 + half, y0 + half),
            bar(x0 - half, y0 - half, x0 + half, y1 + half),
            bar(x1 - half, y0 - half, x1 + half, y1 + half),
            bar(x0 - half, y1 - half, x1 + half, y1 + half)]


class RibbonHousings(unittest.TestCase):
    """On an outline-stroked sheet a housing is four filled rings in the wire's own ink. The
    reader in ``vector_truth`` turns them into conductor segments, so the symbol classifier must
    find the same rectangle there or the box joins every lead that meets it."""

    def test_a_box_of_four_ribbons_is_a_symbol(self):
        doc, page = ribbon_page(ribbon_box(100, 100, 140, 150))
        geometry = classify_symbol_geometry(page, DPI, PEN_PX)
        segments = extract_segments(page, DPI)
        doc.close()
        self.assertEqual(len(geometry.zones), 1)
        x0, y0, x1, y1 = (value / SCALE for value in geometry.zones[0])
        self.assertAlmostEqual(x0, 100, places=3)
        self.assertAlmostEqual(y1, 150, places=3)
        stripped, removed = strip_symbol_strokes(segments, geometry.stroke_keys)
        self.assertEqual((removed, stripped), (4, []))

    def test_the_ribbon_box_stops_bonding_the_leads_it_touches(self):
        # A lead outside the box and the wiper lead inside it both end on the left side.
        rings = ribbon_box(100, 100, 140, 150) + [bar(60, 119.625, 99.5, 120.375),
                                                  bar(100.5, 119.625, 125, 120.375)]
        doc, page = ribbon_page(rings)
        segments = extract_segments(page, DPI)
        self.assertEqual(len(build_nets(node_segments(segments))), 1,
                         "precondition: the side bonds the lead outside to the one inside")
        geometry = classify_symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        stripped, removed = strip_symbol_strokes(segments, geometry.stroke_keys)
        self.assertEqual(removed, 4)
        self.assertEqual(len(geometry.zones), 1)

    def test_a_side_that_runs_past_its_corner_is_a_wire(self):
        rings = ribbon_box(100, 100, 140, 150)
        rings[1] = bar(99.5, 99.5, 100.5, 200)        # the left side carries on down as a wire
        doc, page = ribbon_page(rings)
        geometry = classify_symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(geometry.zones, [])
        self.assertEqual(geometry.stroke_keys, set())

    def test_sides_that_do_not_touch_are_not_a_rectangle(self):
        rings = ribbon_box(100, 100, 140, 150)
        rings[3] = bar(100.5, 152, 139.5, 153)        # the bottom floats 2 pt below the sides
        doc, page = ribbon_page(rings)
        self.assertEqual(classify_symbol_geometry(page, DPI, PEN_PX).zones, [])
        doc.close()

    def test_a_ribbon_box_too_large_to_protect_is_a_barrier(self):
        doc, page = ribbon_page(ribbon_box(100, 20, 140, 280))
        geometry = classify_symbol_geometry(page, DPI, PEN_PX)
        doc.close()
        self.assertEqual(geometry.zones, [])
        self.assertEqual(len(geometry.stroke_keys), 4)
        self.assertEqual(len(geometry.barriers), 4)


if __name__ == "__main__":
    unittest.main()
