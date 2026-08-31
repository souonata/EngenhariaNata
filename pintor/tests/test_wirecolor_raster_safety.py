"""Electrical safety contracts for the raster/OCR web fallback."""
import os
import sys
import tempfile
from dataclasses import replace

import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.prep import Transform
from wirecolor.verify.validators import (v2_protected_overlap,
                                         v2_vector_protected_overlap)
from wirecolor.web_service import JobStore, _owner_hash, process_job


def _pdf_bytes():
    import fitz

    document = fitz.open()
    document.new_page(width=300, height=200)
    payload = document.tobytes()
    document.close()
    return payload


def _raster_solution():
    label = {"code": "RD", "raw": "1.5 RD"}
    return {
        "segments": [{"order": [(20, 20), (20, 80)]}],
        "solver": {"claims": {0: (label, ["RD"])}},
        "dgroups": {},
        "dclaims": {},
        "housings": [],
        "inline_components": [],
    }


class RasterElectricalSafetyTests(unittest.TestCase):
    def test_a_weak_ocr_read_is_dropped_before_the_vocabulary_is_chosen(self):
        from wirecolor.tools.paint_raster import _score_conventions

        selected, confidence, labels = _score_conventions([
            {"code": "RD", "score": 0.97},
            {"code": "BU", "score": 0.41},
        ])

        self.assertEqual([label["code"] for label in labels], ["RD"])
        self.assertEqual(selected, "iec_two_letter")
        # `RD` exists in one vocabulary only, so nothing disagrees about the colour it would be
        # painted. Calling that "low" used to decline the page and ask a reviewer to break a tie
        # that had no second side. How much evidence is enough is decided per conductor downstream.
        self.assertEqual(confidence, "high")

    def test_a_vocabulary_is_only_ambiguous_when_the_colour_would_differ(self):
        from wirecolor.labels.conventions import colour_conflicts, list_conventions

        # The two registries overlap on BN and GN alone, and agree on both.
        self.assertEqual(colour_conflicts(list_conventions(), {"BN", "GN", "RD", "SB"}), set())

    def test_a_registry_that_repaints_a_shared_code_is_reported_as_conflicting(self):
        from unittest.mock import patch

        from wirecolor.labels import conventions as registry

        real = registry.load_convention

        def fake(name):
            convention = real("volvo_classic" if name == "rival" else name)
            if name == "rival":
                recoloured = dict(convention.colors_bgr)
                recoloured["GN"] = (0, 0, 255)
                return replace(convention, name="rival", colors_bgr=recoloured)
            return convention

        with patch.object(registry, "load_convention", fake):
            self.assertEqual(
                registry.colour_conflicts(["volvo_classic", "rival"], {"GN", "SB"}), {"GN"})

    def test_raster_canvas_never_rounds_above_pixel_budget(self):
        from wirecolor.tools.paint_raster import _canvas_size

        meta = {
            "working_w": 100,
            "working_h": 100,
            "native": {"width": 500, "height": 500},
        }
        width, height = _canvas_size(meta, 11_428)

        self.assertLessEqual(width * height, 11_428)

    def test_unclaimed_dashed_routes_do_not_inflate_paint_coverage(self):
        from wirecolor.profile import paint_coverage

        segment = {"order": [(0, 0), (0, 100)], "ends": [(0, 0), (0, 100)]}
        solution = {
            "segments": [segment],
            "solver": {"claims": {}},
            "dgroups": {7: [0]},
            "dclaims": {},
            "edge_excluded": set(),
            "pin_border_arcs": set(),
            "twist": set(),
        }

        coverage = paint_coverage(solution)

        self.assertEqual(coverage["painted_ink_fraction"], 0.0)
        self.assertEqual(coverage["painted_arcs"], 0)

    def test_raster_production_wrapper_disables_splice_colour_propagation(self):
        """A conductive splice must not imply one physical conductor colour."""
        from wirecolor.tools.paint_raster import paint_page

        solution = _raster_solution()
        rgba = np.zeros((100, 100, 4), dtype=np.uint8)
        rgba[20, 20, 3] = 255
        profile = {
            "coverage": {
                "unresolved_roots": 0,
                "painted_ink_fraction": 1.0,
            },
        }
        meta = {
            "working_w": 100,
            "working_h": 100,
            "page_w": 72,
            "page_h": 72,
            "native": None,
        }

        with tempfile.TemporaryDirectory() as directory, \
                patch("wirecolor.instrument.reset_for_tests"), \
                patch("wirecolor.prep.render_working_png", return_value=meta), \
                patch("wirecolor.tools.paint_raster._recognise_outlined_page", return_value=None), \
                patch(
                    "wirecolor.tools.paint_raster._recognise_page_labels",
                    return_value=("iec_two_letter", "user-selected", 1),
                ), \
                patch("wirecolor.pipeline.run_page", return_value=solution) as run_page, \
                patch("wirecolor.profile.measure_sheet_profile", return_value=profile), \
                patch(
                    "wirecolor.paint.raster_overlay.render_native",
                    return_value=np.zeros((100, 100, 3), dtype=np.uint8),
                ), \
                patch(
                    "wirecolor.paint.raster_overlay.build_overlay_rgba",
                    return_value=rgba,
                ), \
                patch(
                    "wirecolor.verify.validators.v2_protected_overlap",
                    return_value={"name": "V2", "passed": True},
                ), \
                patch(
                    "wirecolor.paint.raster_overlay.attach_overlay",
                    return_value={"ocg": "Pintor Wire Colors"},
                ), \
                patch(
                    "wirecolor.verify.validators.v7_preservation",
                    return_value={"name": "V7", "passed": True},
                ):
            report = paint_page(
                "scan.pdf", 0, directory,
                convention_name="iec_two_letter", paint_pixel_budget=10_000,
            )

        self.assertFalse(report["declined"])
        self.assertFalse(run_page.call_args.kwargs["allow_splice_propagation"])

    def test_a_stroke_cap_at_a_symbol_edge_is_trimmed_not_refused(self):
        """A conductor ending at a component overshoots the boundary by about the pen width.

        On a reviewed sheet that was 27 pixels, three deep, against one edge -- and it refused a
        whole page whose colours were correct. The paint is erased; the page is not condemned.
        """
        # The conductor arrives from outside and its cap stops three pixels past the boundary.
        rgba = np.zeros((120, 120, 4), dtype=np.uint8)
        rgba[44:50, 0:25, 3] = 255

        verdict = v2_vector_protected_overlap(
            rgba, [(20, 20, 80, 80)], analysis_dpi=200, paint_dpi=200, pen_px=6)

        self.assertTrue(verdict["passed"])
        self.assertEqual(verdict["zones_crossed"], 0)
        self.assertGreater(verdict["painted_px_in_protected"], 0)
        # Erased inside the symbol, untouched outside it.
        self.assertEqual(int(rgba[44:50, 22:25, 3].sum()), 0)
        self.assertEqual(int(rgba[44:50, 0:20, 3].sum()), 6 * 20 * 255)

    def test_colour_running_through_a_symbol_still_fails(self):
        """Erasing this would leave colour on both sides and assert a connection that is not there."""
        rgba = np.zeros((120, 120, 4), dtype=np.uint8)
        rgba[48:52, 0:120, 3] = 255

        verdict = v2_vector_protected_overlap(
            rgba, [(20, 20, 80, 80)], analysis_dpi=200, paint_dpi=200, pen_px=6)

        self.assertFalse(verdict["passed"])
        self.assertEqual(verdict["zones_crossed"], 1)

    def test_paint_reaching_deep_from_one_edge_is_not_a_stroke_cap(self):
        rgba = np.zeros((120, 120, 4), dtype=np.uint8)
        rgba[30:70, 30:60, 3] = 255

        verdict = v2_vector_protected_overlap(
            rgba, [(20, 20, 80, 80)], analysis_dpi=200, paint_dpi=200, pen_px=6)

        self.assertFalse(verdict["passed"])
        self.assertEqual(verdict["zones_entered_deeply"], 1)

    def test_a_clean_page_is_left_untouched(self):
        rgba = np.zeros((120, 120, 4), dtype=np.uint8)
        rgba[100:110, 100:110, 3] = 255

        verdict = v2_vector_protected_overlap(
            rgba, [(20, 20, 80, 80)], analysis_dpi=200, paint_dpi=200, pen_px=6)

        self.assertTrue(verdict["passed"])
        self.assertEqual(verdict["painted_px_in_protected"], 0)
        self.assertEqual(int(rgba[100:110, 100:110, 3].sum()), 10 * 10 * 255)

    def test_v2_rejects_overlay_inside_a_component_housing(self):
        rgba = np.zeros((120, 120, 4), dtype=np.uint8)
        rgba[35, 40, 3] = 255
        solution = {
            "housings": [(20, 20, 40, 30)],
            "inline_components": [],
        }

        verdict = v2_protected_overlap(rgba, solution, Transform(1.0, 1.0))

        self.assertFalse(verdict["passed"])
        self.assertGreater(verdict["painted_px_in_protected"], 0)

    def test_v2_rejects_overlay_crossing_an_inline_component(self):
        rgba = np.zeros((120, 120, 4), dtype=np.uint8)
        rgba[75, 60, 3] = 255
        solution = {
            "housings": [],
            "inline_components": [(20, 75, 95, 75, 6)],
        }

        verdict = v2_protected_overlap(rgba, solution, Transform(1.0, 1.0))

        self.assertFalse(verdict["passed"])
        self.assertGreater(verdict["painted_px_in_protected"], 0)

    def test_web_quarantines_a_raster_result_when_v2_fails(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            os.environ, {"PINTOR_COOKIE_SECURE": "0"},
        ):
            store = JobStore(directory)
            state = store.create(
                _pdf_bytes(), "scan.pdf", 0, "iec_two_letter", False,
                25 * 1024 * 1024, _owner_hash("b" * 64),
            )
            vector_report = {
                "declined": True,
                "decline_reason": "raster scan with no trustworthy vector geometry",
                "runs": 0,
                "runs_painted": 0,
            }
            raster_report = {
                "declined": False,
                "processing_mode": "raster-ocr",
                "v2": {"name": "V2", "passed": False},
                "v7": {"name": "V7", "passed": True},
            }
            with patch(
                "wirecolor.tools.paint_vector.paint_page", return_value=vector_report,
            ), patch(
                "wirecolor.tools.paint_raster.paint_page", return_value=raster_report,
            ) as raster_painter:
                process_job(store, state["id"])

            result = store.read(state["id"])

        self.assertEqual(result["status"], "declined")
        self.assertIn("V2", result["decline_reason"])
        self.assertEqual(
            raster_painter.call_args.kwargs["convention_name"], "iec_two_letter",
        )


if __name__ == "__main__":
    unittest.main()
