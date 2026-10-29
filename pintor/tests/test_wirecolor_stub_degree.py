"""A node's degree counts every piece of ink meeting it, runs or not (safety rule 2).

A piece shorter than the conductor floor never becomes a run, but it is still an arm of the node it
ends on. Left out, a wire ending in a T on an outline looked like a corner, and its colour ran along
the outline: round a pin strip on pub 7737962 p60, up a dashed connector line on pub 47706663 p78.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import fitz  # noqa: E402

from wirecolor.engine.ownership import OwnedRun, propagate_continuations  # noqa: E402
from wirecolor.engine.vector_page import (VectorPageContext, decide_vector_context,  # noqa: E402
                                          extract_vector_context)
from wirecolor.labels.conventions import load_convention  # noqa: E402

DPI = 200
SCALE = DPI / 72.0


def run(index, points, code=None):
    return OwnedRun(index=index, points=points, code=code, legend_raw=None, distance=None)


def stroke(shape, a, b):
    shape.draw_line(fitz.Point(*a), fitz.Point(*b))


def painted(draw):
    """The coded runs of a 400 x 500 pt page, whose conductor floor is about 11 pt."""
    document = fitz.open()
    page = document.new_page(width=400, height=500)
    draw(page)
    context = extract_vector_context(page, DPI, load_convention("volvo_classic"))
    document.close()
    owned, _diagnostics = decide_vector_context(context)
    return context, [owned_run for owned_run in owned if owned_run.code]


class StubArms(unittest.TestCase):
    def test_a_short_arm_makes_the_node_a_branch(self):
        corner = [run(0, [(0, 100), (0, 0)], code="Y"), run(1, [(0, 0), (80, 0)])]
        self.assertEqual(propagate_continuations(corner, stub_ends=[(0, 0), (-10, 0)]), 0)
        self.assertIsNone(corner[1].code)

    def test_an_overshoot_is_not_an_arm_but_a_short_joining_piece_is(self):
        from wirecolor.engine.vector_page import _arm_stub_ends

        wire, arm = [(0, 0), (0, 100)], [(0, 100), (100, 100)]
        overshoot = [(0, 100), (0, 103)]                   # 3 px, ending in free space
        arc = [(100, 100), (102, 102)]                     # as short, but joining two nodes
        bend = [(102, 102), (102, 200)]
        pieces = [wire, arm, overshoot, arc, bend]
        stubs = [(overshoot, 3.0), (arc, 2.8)]
        self.assertEqual(_arm_stub_ends(pieces, stubs, overshoot_px=4.0), [(100, 100), (102, 102)])
        self.assertEqual(len(_arm_stub_ends(pieces, stubs, overshoot_px=1.0)), 4)

    def test_a_stub_at_another_node_changes_nothing(self):
        corner = [run(0, [(0, 100), (0, 0)], code="Y"), run(1, [(0, 0), (80, 0)])]
        propagate_continuations(corner, stub_ends=[(200, 0), (210, 0)])
        self.assertEqual([owned_run.code for owned_run in corner], ["Y", "Y"])


class WireEndingInATee(unittest.TestCase):
    def test_colour_stops_where_a_wire_meets_a_pin_strip(self):
        """Pub 7737962 p60: the last wire of a pin strip ends on its top edge 8 pt from the
        previous pin, and the edge turns the strip's corner down to the unit it sits on."""
        def draw(page):
            shape = page.new_shape()
            stroke(shape, (60, 300), (186, 300))           # the strip's top edge
            stroke(shape, (186, 300), (186, 320))          # its right side
            stroke(shape, (60, 300), (60, 320))            # its left side
            stroke(shape, (40, 320), (300, 320))           # the unit below
            for x in (170, 178):                           # two pins 8 pt apart
                stroke(shape, (x, 100), (x, 300))
            shape.finish(color=(0, 0, 0), width=0.5, closePath=False)
            shape.commit()
            page.insert_text((181, 200), "PU/R", fontsize=6)

        context, coded = painted(draw)
        self.assertTrue(context.stub_ends, "precondition: the edge between the pins is a stub")
        self.assertEqual([owned_run.code for owned_run in coded], ["PU/R"])
        self.assertTrue(all(y <= 300 * SCALE + 1e-6 for owned_run in coded
                            for _x, y in owned_run.points), "no colour round the strip")

    def test_colour_stops_where_a_wire_meets_a_dashed_connector_line(self):
        """Pub 47706663 p78: PU/LBL ends on a dashed line 7 pt above one of its gaps."""
        def draw(page):
            shape = page.new_shape()
            stroke(shape, (60, 250), (200, 250))
            shape.finish(color=(0, 0, 0), width=0.75, closePath=False)
            shape.commit()
            dashed = page.new_shape()
            stroke(dashed, (200, 220), (200, 256))
            stroke(dashed, (200, 264), (200, 300))
            dashed.finish(color=(0, 0, 0), width=1.0, dashes="[4 4] 0", closePath=False)
            dashed.commit()
            page.insert_text((120, 246), "PU/R", fontsize=6)

        _context, coded = painted(draw)
        self.assertEqual([owned_run.code for owned_run in coded], ["PU/R"])
        self.assertTrue(all(x <= 200 * SCALE + 1e-6 and abs(y - 250 * SCALE) < 1e-3
                            for owned_run in coded for x, y in owned_run.points),
                        "no colour up or down the dashed line")

    def test_colour_turns_a_corner_drawn_with_an_overshoot(self):
        """The down stroke runs 1 pt past the corner it turns: hidden in the ink, not an arm."""
        def draw(page):
            shape = page.new_shape()
            stroke(shape, (100, 100), (100, 301))
            stroke(shape, (100, 300), (250, 300))
            shape.finish(color=(0, 0, 0), width=0.75, closePath=False)
            shape.commit()
            page.insert_text((103, 200), "PU/R", fontsize=6)

        context, coded = painted(draw)
        self.assertFalse(context.stub_ends)
        self.assertEqual([owned_run.code for owned_run in coded], ["PU/R", "PU/R"])

    def test_the_stub_ends_survive_the_context_round_trip(self):
        context = VectorPageContext.from_dict({
            **_empty_context(), "stub_ends": [[1.0, 2.0], [3.0, 4.0]]})
        self.assertEqual(context.stub_ends, [(1.0, 2.0), (3.0, 4.0)])
        self.assertEqual(context.to_dict()["stub_ends"], [[1.0, 2.0], [3.0, 4.0]])


def _empty_context():
    from wirecolor.engine.vector_page import CONTEXT_SCHEMA_VERSION
    return {"schema_version": CONTEXT_SCHEMA_VERSION, "runs": [], "min_run_px": 1.0,
            "page_diagonal_px": 1.0, "pen_px": 1.0, "segments": 0, "nets": 0,
            "symbol_zones": 0, "symbol_strokes_removed": 0, "run_features": [], "pieces": [],
            "piece_features": []}


if __name__ == "__main__":
    unittest.main()
