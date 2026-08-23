"""The common role-first electrical semantics gate cannot be bypassed by a painter."""
from __future__ import annotations

import unittest
from types import SimpleNamespace

import numpy as np

from wirecolor.detect.outlined_wires import CalloutLeader
from wirecolor.engine.ownership import OwnedRun
from wirecolor.engine.semantics import (
    ANNOTATION_LEADER,
    PHYSICAL_CONDUCTOR,
    enforce_raster_semantics,
    enforce_vector_semantics,
)
from wirecolor.labels.conventions import load_convention
from wirecolor.paint.raster_overlay import build_overlay_rgba
from wirecolor.paint.vector_overlay import build_rgba
from wirecolor.prep import Transform


def _context(symbol_zones=0):
    return SimpleNamespace(symbol_zones=symbol_zones)


def _segment(y=50, x0=10, x1=91):
    order = [(y, x) for x in range(x0, x1)]
    return {"order": order, "ends": [order[0], order[-1]]}


def _raster_solution(code="BL", callouts=()):
    return {
        "segments": [_segment()],
        "convention": load_convention("volvo_classic"),
        "solver": {
            "claims": {0: (1.0, [code])},
            "mate": {},
            "at_dot": set(),
            "dot_arcs": {},
        },
        "dgroups": {},
        "dclaims": {},
        "housings": [],
        "inline_components": [],
        "terminal_dots": set(),
        "holes": [],
        "twist": set(),
        "bridge_twist": set(),
        "semantic_exclusions": list(callouts),
    }


class EngineeringSemanticsTests(unittest.TestCase):
    def setUp(self):
        self.convention = load_convention("volvo_classic")

    def test_vector_colour_without_authoritative_printed_source_is_blacked(self):
        run = OwnedRun(
            index=3, points=[(0, 0), (100, 0)], code="BL",
            legend_raw=None, distance=3.0,
        )

        owned, pins, analysis = enforce_vector_semantics(
            _context(), [run], [], self.convention)

        self.assertIsNone(owned[0].code)
        self.assertEqual(pins, [])
        self.assertEqual(analysis["approved_claims"], 0)
        self.assertEqual(analysis["abstained_claim_count"], 1)
        self.assertEqual(
            analysis["abstained_claims"][0]["reason"],
            "missing-authoritative-printed-colour-source",
        )

    def test_unbranched_vector_continuation_keeps_the_printed_colour_source(self):
        run = OwnedRun(
            index=4, points=[(0, 0), (100, 0)], code="R/SB",
            legend_raw="0.75 R/SB", distance=None, propagated=True,
        )

        owned, _pins, analysis = enforce_vector_semantics(
            _context(symbol_zones=2), [run], [], self.convention)

        self.assertEqual(owned[0].code, "R/SB")
        self.assertEqual(analysis["object_roles"][PHYSICAL_CONDUCTOR], 1)
        self.assertEqual(
            analysis["paint_claims"][0]["colour_source"],
            "unbranched-physical-continuation",
        )
        self.assertTrue(analysis["release_safe"])

    def test_raster_gate_removes_an_invented_colour_before_rendering(self):
        solution = _raster_solution(code="MAGENTA")

        solution, analysis = enforce_raster_semantics(solution, self.convention)

        self.assertEqual(solution["solver"]["claims"], {})
        self.assertEqual(analysis["approved_claims"], 0)
        self.assertEqual(analysis["abstained_claim_count"], 1)
        self.assertFalse(analysis["invariants"]["colour_invented"])

    def test_dashed_members_are_counted_as_resolved_physical_geometry(self):
        solution = _raster_solution()
        solution["segments"] = [_segment(y=40), _segment(y=60)]
        solution["solver"]["claims"] = {}
        solution["dgroups"] = {7: [0, 1]}
        solution["dclaims"] = {7: (1.0, ["BL"])}

        _solution, analysis = enforce_raster_semantics(solution, self.convention)

        self.assertEqual(analysis["object_roles"][PHYSICAL_CONDUCTOR], 1)
        self.assertEqual(analysis["object_roles"]["unresolved-geometry"], 0)

    def test_annotation_leader_is_knocked_out_even_on_generic_raster_fallback(self):
        leader = CalloutLeader(
            code="BL",
            legend_raw="BL",
            order=((50, 45), (50, 55)),
            width=4,
            target=(45, 50),
            image_bbox=(0, 0, 100, 100),
        )
        solution = _raster_solution(callouts=[leader])

        overlay = build_overlay_rgba(
            solution,
            np.full((100, 110, 3), 255, np.uint8),
            Transform(1.0, 1.0),
        )

        self.assertGreater(int(overlay[50, 35, 3]), 0)
        self.assertEqual(int(overlay[50, 50, 3]), 0)
        analysis = solution["engineering_semantics"]
        self.assertEqual(analysis["object_roles"][ANNOTATION_LEADER], 1)
        self.assertFalse(analysis["invariants"]["annotation_painted"])

    def test_vector_renderer_also_refuses_a_code_without_printed_evidence(self):
        run = OwnedRun(
            index=8, points=[(10, 10), (90, 10)], code="BL",
            legend_raw=None, distance=1.0,
        )

        overlay, painted = build_rgba(
            [run], (100, 100), self.convention, 200,
        )

        self.assertEqual(painted, 0)
        self.assertEqual(int(np.count_nonzero(overlay[:, :, 3])), 0)


if __name__ == "__main__":
    unittest.main()
