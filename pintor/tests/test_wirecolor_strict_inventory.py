"""Precision-stage regressions for automatic wiring-diagram discovery."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

import fitz

from wirecolor.tools.verify_wiring_inventory import (
    VERIFIER_VERSION,
    _source_fingerprint,
    load_candidates,
    verify_candidate,
    verify_inventory,
    write_reports,
)
from wirecolor.tools.inventory_wiring_pages import SCANNER_VERSION
from wirecolor.tools.wiring_evidence import (
    _pin_layout_dominates,
    _tag_parallel_bare_bundle,
    _text_layer_is_corrupted,
    _looks_like_printed_code,
    inspect_vector_page,
    verify_raster_image,
    verify_vector_page,
)


class PrintedCodeCaseTests(unittest.TestCase):
    @staticmethod
    def legend(raw, code):
        return SimpleNamespace(raw=raw, code=code)

    def test_lowercase_business_abbreviation_is_not_a_wire_code(self):
        self.assertFalse(_looks_like_printed_code(self.legend("r/p", "R/P")))

    def test_lowercase_week_and_weight_units_are_not_wire_codes(self):
        self.assertFalse(_looks_like_printed_code(self.legend("25w04", "W")))
        self.assertFalse(_looks_like_printed_code(self.legend("25 gr", "GR")))

    def test_lowercase_parenthesised_wire_id_remains_valid(self):
        self.assertTrue(_looks_like_printed_code(self.legend("0.75 WH (w14)", "WH")))

    def test_control_heavy_substituted_font_text_requires_ocr(self):
        self.assertTrue(_text_layer_is_corrupted(
            "7URXEOHVKRRWLQJ\x03'7&\x03\x13\x13\x14\x19\x03" * 3))
        self.assertFalse(_text_layer_is_corrupted(
            "Troubleshooting DTC 0016: check the colour-coded sensor circuit."))

    def test_connector_pin_markers_must_not_count_as_physical_wires(self):
        pin_heavy = SimpleNamespace(pin_markers=[object()] * 23, legends=[object()])
        real_wires = SimpleNamespace(pin_markers=[], legends=[object()] * 14)
        self.assertTrue(_pin_layout_dominates(pin_heavy))
        self.assertFalse(_pin_layout_dominates(real_wires))

    def test_parallel_bare_bundle_requires_three_codes_and_ink_on_both_sides(self):
        labels = [
            {"raw": code, "code": code, "score": 0.99,
             "cx": 100.0, "cy": y, "w": 24.0, "h": 12.0}
            for code, y in (("GN", 50.0), ("GR", 75.0), ("SB", 100.0))
        ]
        segments = [
            (40, int(y), 85, int(y)) for y in (50, 75, 100)
        ] + [
            (115, int(y), 165, int(y)) for y in (50, 75, 100)
        ]
        self.assertEqual(_tag_parallel_bare_bundle(labels, segments), 3)
        self.assertTrue(all(label["evidence_source"] == "parallel-bare-bundle"
                            for label in labels))

        one_sided = [dict(label, evidence_source=None) for label in labels]
        self.assertEqual(_tag_parallel_bare_bundle(one_sided, segments[:3]), 0)


class StrictSemanticVerificationTests(unittest.TestCase):
    @staticmethod
    def _page(draw):
        document = fitz.open()
        page = document.new_page(width=400, height=300)
        draw(page)
        reopened = fitz.open("pdf", document.tobytes())
        document.close()
        return reopened

    def test_exact_vector_conductor_passes_production_semantics(self):
        def draw(page):
            page.draw_line(fitz.Point(70, 150), fitz.Point(350, 150), width=0.8)
            page.insert_text(fitz.Point(150, 140), "1.5 RD", fontsize=9)

        document = self._page(draw)
        try:
            result = verify_vector_page(document[0], "iec_two_letter")
        finally:
            document.close()
        self.assertEqual(result["status"], "verified")
        self.assertGreaterEqual(result["physical_conductors"], 1)
        self.assertIn("RD", result["codes"])

    def test_flowchart_return_permission_is_rejected_before_topology(self):
        def draw(page):
            page.insert_text(fitz.Point(100, 45), "ROUTINE DISCREPANCIES AND RETURNS", fontsize=11)
            for row in range(2):
                y = 100 + row * 90
                page.draw_rect(fitz.Rect(80, y, 180, y + 35), width=0.8)
                page.draw_line(fitz.Point(130, y + 35), fitz.Point(130, y + 75), width=0.8)
                page.insert_text(fitz.Point(145, y + 62), "send r/p", fontsize=9)

        document = self._page(draw)
        try:
            broad = inspect_vector_page(document[0])
            strict = verify_vector_page(document[0], "volvo_classic")
        finally:
            document.close()
        self.assertEqual(broad["status"], "no_evidence")
        self.assertEqual(strict["status"], "rejected")
        self.assertEqual(strict["physical_conductors"], 0)

    def test_saved_ocr_is_reused_for_raster_topology_without_rereading(self):
        import cv2
        import numpy as np

        with tempfile.TemporaryDirectory() as temp_name:
            image_path = Path(temp_name) / "page.png"
            image = np.full((300, 500, 3), 255, dtype=np.uint8)
            cv2.line(image, (60, 150), (440, 150), (0, 0, 0), 3)
            cv2.imwrite(str(image_path), image)
            evidence = {
                "legends": [
                    {"raw": "1.5 RD", "code": "RD", "score": 0.99,
                     "cx": 180.0, "cy": 135.0, "w": 60.0, "h": 16.0, "box": []},
                    {"raw": "0.75 BK", "code": "BK", "score": 0.99,
                     "cx": 320.0, "cy": 135.0, "w": 65.0, "h": 16.0, "box": []},
                ]
            }
            solution = {
                "segments": [{"order": [(150, 60), (150, 440)]}],
                "solver": {"claims": {0: (1.0, ["RD"])}},
                "dgroups": {}, "dclaims": {}, "housings": [],
                "inline_components": [], "terminal_dots": [],
            }
            with patch(
                "wirecolor.tools.paint_raster._score_conventions",
                return_value=("iec_two_letter", "high", evidence["legends"]),
            ), patch("wirecolor.pipeline.run_page", return_value=solution) as run:
                result = verify_raster_image(str(image_path), evidence)
        self.assertEqual(result["status"], "verified")
        self.assertEqual(result["physical_conductors"], 1)
        self.assertIn("RD", result["codes"])
        run.assert_called_once()

    def test_ambiguous_single_ocr_label_stays_out_of_verified_report(self):
        evidence = {"legends": [{"raw": "PU", "code": "PU", "score": 0.99}]}
        with patch(
            "wirecolor.tools.paint_raster._score_conventions",
            return_value=("volvo_classic", "low", evidence["legends"]),
        ), patch("wirecolor.pipeline.run_page") as run:
            result = verify_raster_image("not-needed.png", evidence)
        self.assertEqual(result["status"], "review")
        run.assert_not_called()


class StrictInventoryReportTests(unittest.TestCase):
    @staticmethod
    def _candidate(key, page, scanned, status="confirmed"):
        return {
            "scanner_version": "broad-v1",
            "scanned_utc": scanned,
            "manual_key": key,
            "manual_title": f"Manual {key}",
            "manual_path": f"C:/private/{key}.pdf",
            "manual_sha256": f"digest-{key}",
            "page_1_based": page,
            "page_index": page - 1,
            "page_count": 10,
            "status": status,
            "vector": {"status": status, "convention": "iec_two_letter"},
            "ocr": {"status": "not_run"},
        }

    def test_sharded_ledgers_keep_newest_candidate(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            for name, record in (
                ("a", self._candidate("m", 3, "2026-08-30T10:00:00+00:00")),
                ("b", self._candidate("m", 3, "2026-08-30T11:00:00+00:00", "review")),
            ):
                shard = root / name
                shard.mkdir()
                (shard / "pages.jsonl").write_text(
                    json.dumps(record) + "\n", encoding="utf-8")
            loaded = load_candidates([root])
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[("m", 3)]["status"], "review")

    @staticmethod
    def _one_page_pdf(path):
        document = fitz.open()
        document.new_page(width=300, height=200)
        document.save(path)
        document.close()

    def test_stale_saved_ocr_is_refreshed_before_strict_verification(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            source_path = root / "manual.pdf"
            self._one_page_pdf(source_path)
            source = self._candidate("m", 1, "2026-08-30T10:00:00+00:00", "review")
            source.update({
                "manual_path": str(source_path),
                "scanner_version": "wiring-page-inventory-v13",
                "vector": {"status": "no_evidence", "convention": None},
                "ocr": {"status": "review", "legends": [
                    {"raw": "SB", "code": "SB", "score": 1.0},
                ]},
            })
            verified = {
                "status": "verified", "mode": "raster-ocr-topology", "reason": "test",
                "physical_conductors": 2, "codes": ["SB"], "ocr_refreshed": True,
            }
            with patch(
                "wirecolor.tools.verify_wiring_inventory._raster_result",
                return_value=verified,
            ) as raster:
                result = verify_candidate(source, root)

        self.assertEqual(result["status"], "verified")
        self.assertTrue(raster.call_args.kwargs["refresh_ocr"])

    def test_current_saved_ocr_is_reused(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            source_path = root / "manual.pdf"
            self._one_page_pdf(source_path)
            source = self._candidate("m", 1, "2026-08-30T10:00:00+00:00", "review")
            source.update({
                "manual_path": str(source_path),
                "scanner_version": SCANNER_VERSION,
                "vector": {"status": "no_evidence", "convention": None},
                "ocr": {"status": "probable", "legends": [
                    {"raw": "SB", "code": "SB", "score": 1.0},
                    {"raw": "GN", "code": "GN", "score": 1.0},
                ]},
            })
            with patch(
                "wirecolor.tools.verify_wiring_inventory._raster_result",
                return_value={"status": "review", "mode": "raster-ocr-topology",
                              "reason": "test", "physical_conductors": 0, "codes": []},
            ) as raster:
                verify_candidate(source, root)

        self.assertFalse(raster.call_args.kwargs["refresh_ocr"])

    def test_raster_foldout_falls_back_to_fresh_ocr_topology(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            source_path = root / "manual.pdf"
            self._one_page_pdf(source_path)
            source = self._candidate("m", 1, "2026-08-30T10:00:00+00:00")
            source.update({
                "manual_path": str(source_path),
                "scanner_version": SCANNER_VERSION,
                "image_coverage": 0.60,
                "vector": {"status": "confirmed", "convention": "volvo_classic",
                           "legends": [{"code": "SB"}, {"code": "GN"}]},
            })
            raster_verified = {
                "status": "verified", "mode": "raster-ocr-topology", "reason": "test",
                "physical_conductors": 4, "codes": ["GN", "SB"], "ocr_refreshed": True,
            }
            with patch(
                "wirecolor.tools.verify_wiring_inventory.verify_vector_page",
                return_value={"status": "rejected", "mode": "vector-topology",
                              "reason": "raster foldout: vector ink too sparse",
                              "physical_conductors": 0, "codes": []},
            ), patch(
                "wirecolor.tools.verify_wiring_inventory._raster_result",
                return_value=raster_verified,
            ) as raster:
                result = verify_candidate(source, root)

        self.assertEqual(result["status"], "verified")
        self.assertTrue(raster.call_args.kwargs["refresh_ocr"])

    def test_visible_outputs_contain_verified_pages_only(self):
        with tempfile.TemporaryDirectory() as temp_name:
            out = Path(temp_name)
            common = {
                "verifier_version": VERIFIER_VERSION,
                "manual_key": "m", "manual_title": "Manual", "manual_path": "C:/m.pdf",
                "page_count": 3, "mode": "vector-topology", "convention": "iec_two_letter",
                "reason": "test", "codes": ["RD"], "thumbnail": None,
            }
            records = {
                ("m", 1): {**common, "page_1_based": 1, "status": "verified",
                           "physical_conductors": 2},
                ("m", 2): {**common, "page_1_based": 2, "status": "rejected",
                           "physical_conductors": 0},
                ("m", 3): {**common, "page_1_based": 3, "status": "review",
                           "physical_conductors": 0},
            }
            summary = write_reports(records, out, [Path("source/pages.jsonl")])
            csv_text = (out / "wiring_diagrams.csv").read_text(encoding="utf-8-sig")
            html = (out / "report.html").read_text(encoding="utf-8")
        self.assertEqual(summary["verified_wiring_pages"], 1)
        self.assertIn("Manual,1,3", csv_text)
        self.assertNotIn("Manual,2,3", csv_text)
        self.assertIn("Page 1 of 3", html)
        self.assertNotIn("Page 2 of 3", html)

    def test_resume_backfills_a_missing_verified_thumbnail_without_reverification(self):
        with tempfile.TemporaryDirectory() as temp_name:
            out = Path(temp_name)
            source = self._candidate("m", 1, "2026-08-30T10:00:00+00:00")
            existing = {
                "verifier_version": VERIFIER_VERSION,
                "source_fingerprint": _source_fingerprint(source),
                "manual_key": "m", "manual_title": "Manual", "manual_path": "C:/m.pdf",
                "page_1_based": 1, "page_index": 0, "page_count": 10,
                "status": "verified", "physical_conductors": 1, "codes": ["RD"],
                "mode": "vector-topology", "thumbnail": None,
            }
            (out / "verification.jsonl").write_text(
                json.dumps(existing) + "\n", encoding="utf-8")
            with patch(
                "wirecolor.tools.verify_wiring_inventory._ensure_thumbnail",
                return_value="thumbnails/m-p1.jpg",
            ) as thumbnail, patch(
                "wirecolor.tools.verify_wiring_inventory.verify_candidate",
            ) as verify:
                records = verify_inventory({("m", 1): source}, out, progress_every=0)
        self.assertEqual(records[("m", 1)]["thumbnail"], "thumbnails/m-p1.jpg")
        thumbnail.assert_called_once()
        verify.assert_not_called()


if __name__ == "__main__":
    unittest.main()
