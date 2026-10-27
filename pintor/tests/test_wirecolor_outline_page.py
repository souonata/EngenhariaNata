"""An outline-stroked sheet reaches the decision layer as wires, not as an empty page.

On pub 7749393 (the V REF diagnostic circuits) every wire is a filled ring and the page read as two
segments, so the painter returned it unchanged although the upload detector had confirmed it. This
runs the page context end to end on a synthetic sheet drawn the same way.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import fitz  # noqa: E402
from wirecolor.engine.vector_page import (CONTEXT_SCHEMA_VERSION, VectorPageContext,  # noqa: E402
                                          decide_vector_context, extract_vector_context)
from wirecolor.labels.conventions import load_convention  # noqa: E402

DPI = 200


def outline_sheet():
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    shape = page.new_shape()
    # An L-shaped wire, two rings meeting at a mitred corner, as the V REF sheets draw it.
    for ring in ([(99.625, 300), (100, 299.625), (300, 299.625), (300, 300.375), (100, 300.375)],
                 [(100, 299.625), (100.375, 300), (100.375, 450), (99.625, 450), (99.625, 300)]):
        shape.draw_polyline([*ring, ring[0]])
    shape.finish(color=None, fill=(0, 0, 0), closePath=False)
    shape.commit()
    # A housing far too large to protect, whose outline must still stop a bridge.
    frame = page.new_shape()
    frame.draw_rect(fitz.Rect(350, 100, 380, 700))
    frame.finish(color=(0, 0, 0), width=1.0)
    frame.commit()
    page.insert_text((200, 296), "GR/BR", fontsize=6)
    return doc, page


class OutlineStrokedPage(unittest.TestCase):
    def test_the_wire_is_one_run_and_takes_its_printed_code(self):
        doc, page = outline_sheet()
        context = extract_vector_context(page, DPI, load_convention("volvo_classic"))
        doc.close()
        self.assertEqual(len(context.runs), 1, "the two rings are one wire round the corner")
        self.assertEqual([legend.code for legend in context.legends], ["GR/BR"])
        owned, _diagnostics = decide_vector_context(context)
        self.assertEqual([run.code for run in owned], ["GR/BR"])

    def test_an_inline_connector_of_filled_chevrons_stops_a_bridge(self):
        # The harness wire ends just above an inline connector and the sensor's own lead resumes
        # below it, as on the oxygen sensor of pub 7749393 p146. Without the connector the bridge
        # carries the colour across the 3 pt gap; with it the lead stays black.
        def sheet(connector):
            doc = fitz.open()
            page = doc.new_page(width=595, height=842)
            rings = [[(99.625, 300), (100.375, 300), (100.375, 400), (99.625, 400)],
                     [(99.625, 403), (100.375, 403), (100.375, 470), (99.625, 470)]]
            if connector:
                rings += [[(100, 399.5), (102, 400.5), (102, 402), (100, 401), (98, 402),
                           (98, 400.5)],
                          [(100, 401.5), (102, 402.5), (102, 404), (100, 403), (98, 404),
                           (98, 402.5)]]
            shape = page.new_shape()
            for ring in rings:
                shape.draw_polyline([*ring, ring[0]])
            shape.finish(color=None, fill=(0, 0, 0), closePath=False)
            shape.commit()
            page.insert_text((104, 350), "P/DGN", fontsize=6)
            return doc, page

        for connector, expected in ((False, ["P/DGN", "P/DGN"]), (True, ["P/DGN", None])):
            doc, page = sheet(connector)
            context = extract_vector_context(page, DPI, load_convention("volvo_classic"))
            doc.close()
            owned, diagnostics = decide_vector_context(context)
            by_top = sorted(owned, key=lambda run: min(y for _x, y in run.points))
            self.assertEqual([run.code for run in by_top], expected, f"connector={connector}")

    def test_the_context_keeps_its_bridge_barriers(self):
        doc, page = outline_sheet()
        context = extract_vector_context(page, DPI, load_convention("volvo_classic"))
        doc.close()
        self.assertEqual(len(context.bridge_barriers), 4)
        raw = context.to_dict()
        self.assertEqual(raw["schema_version"], CONTEXT_SCHEMA_VERSION)
        again = VectorPageContext.from_dict(raw)
        self.assertEqual(again.bridge_barriers, context.bridge_barriers)


if __name__ == "__main__":
    unittest.main()
