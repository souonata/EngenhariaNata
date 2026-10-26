"""A conductor drawn as a thin filled outline must yield its centreline; a blob must not.

On autotraced and pictorial sheets a wire is often not stroked at all -- it is a long thin FILLED
rectangle. Some sheets go further: the whole drawing was outline-stroked before export, so every
wire piece is its own closed ring, many to one filled path, beside the triangles that fill its
joins (pub 7749393, the V REF circuits). These tests pin how those rings are read, how touching
ones are joined, and what is still rejected: dots, glyphs, bars, dashes, masks and holes.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import fitz  # noqa: E402
from wirecolor.eval.vector_truth import (_ribbon, _rings, build_nets, decompose_runs,  # noqa: E402
                                         extract_segments, filled_ribbons, node_segments)

DPI = 200
SCALE = DPI / 72.0


def corners(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


class RibbonShape(unittest.TestCase):
    def test_horizontal_ribbon_gives_its_midline(self):
        ribbon = _ribbon(corners(100, 200, 700, 203))
        (ax, ay), (bx, by) = ribbon.segment()
        self.assertAlmostEqual(ay, 201.5)
        self.assertAlmostEqual(by, 201.5)
        self.assertEqual({round(ax), round(bx)}, {100, 700})
        self.assertAlmostEqual(ribbon.half, 1.5)

    def test_vertical_ribbon_gives_its_midline(self):
        (ax, ay), (bx, by) = _ribbon(corners(400, 100, 403, 500)).segment()
        self.assertAlmostEqual(ax, 401.5)
        self.assertAlmostEqual(bx, 401.5)
        self.assertEqual({round(ay), round(by)}, {100, 500})

    def test_a_junction_dot_is_not_a_ribbon(self):
        # small and square -> a filled dot, not a wire
        self.assertIsNone(_ribbon(corners(100, 100, 104, 104)))

    def test_a_symbol_bar_is_too_thick(self):
        # long but 10 px wide -> a filled symbol body, above the ribbon width
        self.assertIsNone(_ribbon(corners(100, 100, 300, 110)))

    def test_a_short_sliver_is_not_a_ribbon(self):
        # thin but only 12 px long -> an end cap or a glyph stroke, below the length floor
        self.assertIsNone(_ribbon(corners(100, 100, 112, 102)))


def line_items(*points):
    return [("l", fitz.Point(*a), fitz.Point(*b)) for a, b in zip(points, points[1:])]


class Rings(unittest.TestCase):
    def test_a_ring_closes_where_it_returns_to_its_start(self):
        # The producer starts the join triangle at the very point the ribbon closed on, so
        # chaining by continuity alone would fuse them into one outline.
        ribbon = line_items((10, 10), (50, 10), (50, 11), (10, 11), (10, 10))
        triangle = line_items((10, 10), (9, 10.5), (10, 11), (10, 10))
        rings = _rings(ribbon + triangle)
        self.assertEqual([len(ring) for ring in rings], [5, 4])

    def test_a_break_in_continuity_starts_a_ring_and_a_rectangle_is_its_own(self):
        items = line_items((10, 10), (50, 10), (50, 11), (10, 11)) \
            + [("re", fitz.Rect(100, 100, 140, 101))] \
            + line_items((0, 0), (5, 0), (5, 5))
        self.assertEqual([len(ring) for ring in _rings(items)], [4, 5, 3])


def outline_page(rings, fill=(0, 0, 0), width=400, height=300, even_odd=False):
    """One filled, unstroked path made of explicitly closed rings, as an outline export emits."""
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    shape = page.new_shape()
    for ring in rings:
        shape.draw_polyline([*ring, ring[0]])
    shape.finish(color=None, fill=fill, closePath=False, even_odd=even_odd)
    shape.commit()
    return doc, page


def hribbon(x0, x1, y, half=0.375, mitre_left=False):
    """A horizontal wire piece of 0.75 pt pen, optionally with a pointed left end."""
    if mitre_left:
        return [(x0, y), (x0 + half, y - half), (x1, y - half), (x1, y + half),
                (x0 + half, y + half)]
    return corners(x0, y - half, x1, y + half)


def vribbon(x, y0, y1, half=0.375, mitre_top=False):
    if mitre_top:
        return [(x, y0), (x + half, y0 + half), (x + half, y1), (x - half, y1),
                (x - half, y0 + half)]
    return [(x - half, y0), (x + half, y0), (x + half, y1), (x - half, y1)]


def px(point):
    return (point[0] * SCALE, point[1] * SCALE)


class OutlineStrokedWires(unittest.TestCase):
    def test_a_corner_and_a_t_become_shared_points(self):
        # A mitred corner at (100, 100), a T leg ending on the bus's lower edge at x = 200, and the
        # little triangle that fills the corner's join.
        doc, page = outline_page([
            hribbon(99.625, 300, 100, mitre_left=True),
            vribbon(100, 99.625, 200, mitre_top=True),
            [(99.625, 100), (99.625, 99.625), (100, 99.625)],
            vribbon(200, 100.375, 180),
        ])
        segments = extract_segments(page, DPI)
        doc.close()
        self.assertEqual(len(segments), 3)
        def near(point, target):
            return abs(point[0] - target[0]) < 1e-3 and abs(point[1] - target[1]) < 1e-3

        ends = [point for segment in segments for point in segment]
        corner = px((100, 100))
        at_corner = [point for point in ends if near(point, corner)]
        self.assertEqual(len(at_corner), 2)
        self.assertEqual(at_corner[0], at_corner[1], "both pieces end on the same point")
        bus = next(segment for segment in segments if segment[1][0] - segment[0][0] > 100)
        leg = next(segment for segment in segments if near(segment[0], px((200, 100))))
        self.assertEqual(leg[0][1], bus[0][1], "the T leg ends on the bus centreline")

        noded = node_segments(segments)
        nets = build_nets(noded)
        self.assertEqual(len(nets), 1)
        runs = decompose_runs(noded, nets[0])
        self.assertEqual(len(runs), 3)
        turning = [run for run in runs if any(near(p, corner) for p in run[1:-1])]
        self.assertEqual(len(turning), 1, "one run walks round the corner")

    def test_without_the_join_the_corner_is_two_points(self):
        # The precondition the join exists for: the mitre tip of one piece and the end of the other
        # are half a pen apart, so the decomposition sees two free ends instead of a corner.
        from wirecolor.eval import vector_truth

        rings = [hribbon(99.625, 300, 100, mitre_left=True),
                 vribbon(100, 99.625, 200, mitre_top=True)]
        doc, page = outline_page(rings)
        original = vector_truth._join_ribbons
        vector_truth._join_ribbons = lambda ribbons, slack=0.5: ribbons
        try:
            segments = extract_segments(page, DPI)
        finally:
            vector_truth._join_ribbons = original
            doc.close()
        noded = node_segments(segments)
        nets = build_nets(noded)
        self.assertEqual(len(nets), 1, "the snap still bonds them electrically")
        self.assertEqual(len(decompose_runs(noded, nets[0])), 2)

    def test_a_line_hop_is_not_joined(self):
        # The horizontal wire breaks 1 pt either side of the vertical's ink: a crossing, no node.
        doc, page = outline_page([
            hribbon(50, 198.625, 100), hribbon(201.375, 350, 100), vribbon(200, 40, 160)])
        segments = extract_segments(page, DPI)
        doc.close()
        self.assertEqual(len(build_nets(node_segments(segments))), 3)

    def test_collinear_pieces_meet_halfway(self):
        doc, page = outline_page([hribbon(50, 150.1, 100), hribbon(150.2, 250, 100)])
        ribbons = [ribbon for _index, ribbon in filled_ribbons(page, DPI)]
        doc.close()
        left, right = sorted(ribbons, key=lambda ribbon: ribbon.lo)
        self.assertAlmostEqual(left.hi, right.lo)

    def test_a_row_of_filled_dashes_is_not_a_conductor(self):
        # A dashed box border drawn as one path of short filled rectangles. Read as one ribbon it
        # became a 387 pt "wire" along the ECM box on pub 7749393.
        doc, page = outline_page([corners(50 + 8 * i, 100, 54 + 8 * i, 101) for i in range(40)])
        segments = extract_segments(page, DPI)
        doc.close()
        self.assertEqual(segments, [])

    def test_a_paper_filled_ribbon_is_a_mask_not_a_wire(self):
        doc, page = outline_page([corners(50, 100, 250, 100.75)], fill=(1, 1, 1))
        self.assertEqual(extract_segments(page, DPI), [])
        doc.close()

    def test_a_slot_cut_out_of_a_shape_is_not_a_wire(self):
        doc, page = outline_page([corners(40, 80, 260, 120), corners(50, 100, 250, 100.75)],
                                 even_odd=True)
        self.assertEqual(extract_segments(page, DPI), [])
        doc.close()


if __name__ == "__main__":
    unittest.main()
