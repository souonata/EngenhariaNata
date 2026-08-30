"""Tests for exhaustive discovery of even one-wire sensor diagrams."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

import fitz

from wirecolor.tools.discover_pages import classify, scan_document
from wirecolor.tools.inventory_wiring_pages import (
    Manual,
    SCANNER_VERSION,
    merge_ledgers,
    scan_library,
    write_reports,
)
from wirecolor.tools.wiring_evidence import (
    _normalise_hough_lines,
    inspect_ocr_image,
    inspect_vector_page,
)


class WiringEvidenceTests(unittest.TestCase):
    @staticmethod
    def _page(draw):
        document = fitz.open()
        page = document.new_page(width=400, height=300)
        draw(page)
        reopened = fitz.open("pdf", document.tobytes())
        document.close()
        return reopened

    def test_one_colour_coded_sensor_wire_is_confirmed(self):
        def draw(page):
            page.draw_line(fitz.Point(80, 150), fitz.Point(340, 150), width=0.8)
            page.insert_text(fitz.Point(130, 141), "1.5 RD", fontsize=9)
            page.draw_rect(fitz.Rect(35, 130, 80, 170), width=0.8)
            page.insert_text(fitz.Point(50, 155), "S1", fontsize=8)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "confirmed")
        self.assertIn("RD", evidence["assigned_codes"])
        self.assertGreaterEqual(evidence["assigned_runs"], 1)

    def test_hough_lines_accept_linux_and_windows_opencv_shapes(self):
        import numpy as np

        expected = [(1, 2, 3, 4), (5, 6, 7, 8)]
        linux_shape = np.array(expected, dtype=np.int32)
        windows_shape = linux_shape.reshape(2, 1, 4)

        self.assertEqual(_normalise_hough_lines(linux_shape), expected)
        self.assertEqual(_normalise_hough_lines(windows_shape), expected)

    def test_already_coloured_vector_wire_is_ignored(self):
        def draw(page):
            page.draw_line(
                fitz.Point(80, 150), fitz.Point(340, 150), width=1.2, color=(1, 0, 0))
            page.insert_text(fitz.Point(130, 141), "1.5 RD", fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "already_colored")
        self.assertTrue(evidence["colour_evidence"]["already_colored"])

    def test_short_coloured_mark_does_not_hide_black_wire(self):
        def draw(page):
            page.draw_line(fitz.Point(80, 150), fitz.Point(340, 150), width=0.8)
            page.draw_line(
                fitz.Point(20, 20), fitz.Point(22, 20), width=1.0, color=(1, 0, 0))
            page.insert_text(fitz.Point(130, 141), "1.5 RD", fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "confirmed")
        self.assertFalse(evidence["colour_evidence"]["already_colored"])

    def test_coloured_illustration_does_not_hide_separate_black_wiring(self):
        def draw(page):
            for y in (20, 32, 44, 56):
                page.draw_line(
                    fitz.Point(40, y), fitz.Point(360, y),
                    width=1.0, color=(0.1, 0.1, 0.9),
                )
            page.draw_line(fitz.Point(80, 230), fitz.Point(340, 230), width=0.8)
            page.insert_text(fitz.Point(130, 221), "1.5 RD", fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "confirmed")
        self.assertGreaterEqual(evidence["colour_evidence"]["chromatic_segments"], 4)
        self.assertEqual(evidence["colour_evidence"]["chromatic_near_legends"], 0)

    def test_bare_sensor_letter_is_not_a_colour_legend(self):
        def draw(page):
            page.draw_rect(fitz.Rect(130, 100, 270, 200), width=0.8)
            page.insert_text(fitz.Point(195, 155), "P", fontsize=12)
            page.draw_line(fitz.Point(40, 150), fitz.Point(130, 150), width=0.8)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "no_evidence")

    def test_colour_like_prose_without_a_wire_is_rejected(self):
        document = self._page(
            lambda page: page.insert_text(fitz.Point(40, 80), "Use replacement cable 1.5 RD."))
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "no_evidence")
        self.assertEqual(evidence["assigned_runs"], 0)

    def test_lower_case_or_in_illustrated_prose_is_not_orange(self):
        def draw(page):
            page.draw_line(fitz.Point(40, 180), fitz.Point(350, 180), width=0.8)
            page.insert_text(fitz.Point(40, 80), "Connect adapter cable or disconnect the sensor.")

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "no_evidence")
        self.assertEqual(evidence["legends"], [])

    def test_upper_case_or_dimension_is_not_an_orange_wire(self):
        def draw(page):
            page.draw_line(fitz.Point(40, 180), fitz.Point(350, 180), width=0.8)
            page.insert_text(fitz.Point(170, 170), "OR", fontsize=9)
            page.insert_text(fitz.Point(40, 80), "Choose dimension 88.00 OR 89.00.")

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "excluded_non_wiring")

    def test_connector_pin_table_is_not_a_wiring_diagram(self):
        def draw(page):
            page.insert_text(fitz.Point(40, 35), "J-1 ECM 32 Pin Connector", fontsize=12)
            for row, code in enumerate(("SB/GN", "W/SB", "Y/GR", "SB/Y")):
                y = 80 + row * 30
                page.draw_rect(fitz.Rect(40, y - 16, 360, y + 8), width=0.8)
                page.insert_text(fitz.Point(80, y), code, fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "excluded_non_wiring")
        self.assertIn("pin table", evidence["reason"])

    def test_cable_colour_reference_layout_is_not_a_wiring_diagram(self):
        def draw(page):
            page.insert_text(fitz.Point(40, 35), "Color codes, EDC cables", fontsize=12)
            page.insert_text(fitz.Point(40, 65), "Single installation", fontsize=10)
            for row, code in enumerate(("R", "VO", "BL/R", "R/Y", "BN", "OR")):
                page.insert_text(fitz.Point(55, 95 + row * 18), f"{row + 1}. {code}", fontsize=9)
            page.draw_line(fitz.Point(230, 80), fitz.Point(230, 240), width=2)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "excluded_non_wiring")
        self.assertIn("reference/layout", evidence["reason"])

    def test_product_bulletin_is_excluded_without_legacy_rescue(self):
        def draw(page):
            page.insert_text(fitz.Point(40, 35), "PRODUCT NEWSLETTER", fontsize=14)
            page.insert_text(fitz.Point(40, 60), "NEW ENGINE SPECIFICATIONS", fontsize=11)
            page.insert_text(fitz.Point(40, 90), "V6-200-P V6-250-P V8-300-C-P", fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "excluded_non_wiring")

    def test_prose_dominant_diagnostic_with_incidental_circuit_is_excluded(self):
        document = fitz.open()
        page = document.new_page(width=500, height=600)
        page.insert_text(fitz.Point(35, 35), "Fuel System Diagnosis - Electrical", fontsize=13)
        for row in range(15):
            page.insert_text(
                fitz.Point(35, 65 + row * 16),
                "Diagnostic procedure checks the relay, fuse, pump and control module operation.",
                fontsize=7,
            )
        for row, code in enumerate(("1.5 RD", "0.75 GN")):
            y = 400 + row * 55
            page.draw_line(fitz.Point(80, y), fitz.Point(420, y), width=0.8)
            page.insert_text(fitz.Point(170, y - 8), code, fontsize=9)
        reopened = fitz.open("pdf", document.tobytes())
        document.close()
        try:
            evidence = inspect_vector_page(reopened[0])
        finally:
            reopened.close()
        self.assertEqual(evidence["status"], "excluded_non_wiring")
        self.assertIn("prose-dominant", evidence["reason"])

    def test_diagnostic_heading_alone_is_not_mistaken_for_wiring_evidence(self):
        document = fitz.open()
        page = document.new_page(width=500, height=700)
        page.insert_text(fitz.Point(40, 50), "30-2 Fault Tracing", fontsize=12)
        page.insert_text(fitz.Point(40, 80), "Circuit description", fontsize=12)
        reopened = fitz.open("pdf", document.tobytes())
        document.close()
        try:
            evidence = inspect_vector_page(reopened[0])
        finally:
            reopened.close()
        self.assertEqual(evidence["status"], "no_evidence")

    def test_ocr_diagnostic_heading_without_labels_has_no_evidence(self):
        ocr_result = {
            "image": [700, 500],
            "text": "Fault tracing Circuit description 1.5 RD 0.75 SB",
            "labels": [],
        }
        with patch("wirecolor.labels.ocr.ocr_labels", return_value=ocr_result):
            evidence = inspect_ocr_image("unused.png")
        self.assertEqual(evidence["status"], "no_evidence")

    def test_small_real_circuit_on_diagnostic_page_remains_a_candidate(self):
        def draw(page):
            page.insert_text(fitz.Point(40, 35), "Circuit Description", fontsize=12)
            page.draw_line(fitz.Point(70, 150), fitz.Point(350, 150), width=0.8)
            page.insert_text(fitz.Point(150, 141), "GN/Y", fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "confirmed")
        self.assertIn("GN/Y", evidence["assigned_codes"])

    def test_connector_table_continuation_is_excluded(self):
        def draw(page):
            page.insert_text(fitz.Point(40, 35), "Symptoms", fontsize=12)
            rows = ["IAT Signal", "ECT Signal", "MIL Driver", "Battery Feed",
                    "Power Ground", "IAC Coil", "Pump Relay Output", "Shift Input"]
            for row, label in enumerate(rows):
                y = 70 + row * 24
                page.draw_line(fitz.Point(40, y), fitz.Point(360, y), width=0.8)
                page.insert_text(fitz.Point(60, y - 4), f"{row + 1} GN/Y {label}", fontsize=8)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "excluded_non_wiring")
        self.assertIn("table continuation", evidence["reason"])

    def test_ocr_component_designator_is_not_a_colour_legend(self):
        ocr_result = {
            "image": [700, 500],
            "text": "37-0 Wiring Diagrams R1",
            "labels": [{"code": "R", "raw": "R1", "score": 0.99}],
        }
        with patch("wirecolor.labels.ocr.ocr_labels", return_value=ocr_result):
            evidence = inspect_ocr_image("unused.png")
        self.assertEqual(evidence["status"], "no_evidence")

    def test_hydraulic_port_designators_are_not_colour_codes(self):
        def draw(page):
            page.draw_line(fitz.Point(40, 180), fitz.Point(350, 180), width=0.8)
            page.insert_text(fitz.Point(100, 170), "P1", fontsize=9)
            page.insert_text(fitz.Point(260, 170), "T1", fontsize=9)

        document = self._page(draw)
        try:
            evidence = inspect_vector_page(document[0])
        finally:
            document.close()
        self.assertEqual(evidence["status"], "no_evidence")
        self.assertEqual(evidence["legends"], [])

    def test_small_sensor_page_is_selected_by_whole_document_sweep(self):
        with tempfile.TemporaryDirectory() as temp_name:
            source = Path(temp_name) / "manual.pdf"
            document = fitz.open()
            page = document.new_page(width=400, height=300)
            page.draw_line(fitz.Point(80, 150), fitz.Point(340, 150), width=0.8)
            page.insert_text(fitz.Point(130, 141), "1.5 RD", fontsize=9)
            document.new_page(width=400, height=300).insert_text(
                fitz.Point(40, 80), "General maintenance instructions.")
            document.save(source)
            document.close()
            report = scan_document(source)
        self.assertEqual(report["confirmed"], [0])
        self.assertEqual(report["selected"], [0])
        self.assertEqual(report["evidence"][0]["tier"], "vector+owned-colour")

    def test_already_coloured_page_is_not_selected_by_whole_document_sweep(self):
        with tempfile.TemporaryDirectory() as temp_name:
            source = Path(temp_name) / "coloured-manual.pdf"
            document = fitz.open()
            page = document.new_page(width=400, height=300)
            codes = ["1.5 RD", "2.5 BK", "0.75 BN", "1.0 BU", "1.5 GN",
                     "2.5 YE", "1.0 GY", "0.75 WH", "1.5 OG", "2.5 VT"]
            for row, code in enumerate(codes):
                y = 40 + row * 22
                page.draw_line(
                    fitz.Point(110, y), fitz.Point(360, y),
                    color=(0.9, 0.1, 0.1), width=1.2,
                )
                page.insert_text(fitz.Point(35, y + 3), code, fontsize=8)
            document.save(source)
            document.close()
            report = scan_document(source)
        self.assertEqual(report["confirmed"], [])
        self.assertEqual(report["selected"], [])
        self.assertEqual(report["already_colored"], [0])
        self.assertFalse(report["wiring_document"])

    def test_dense_colour_code_list_is_not_selected_without_owned_wires(self):
        with tempfile.TemporaryDirectory() as temp_name:
            source = Path(temp_name) / "parts-reference.pdf"
            document = fitz.open()
            page = document.new_page(width=400, height=500)
            page.insert_text(fitz.Point(40, 45), "Parts reference", fontsize=14)
            codes = [
                "1.5 RD", "2.5 BK", "0.75 BN", "1.0 BU", "1.5 GN",
                "2.5 YE", "1.0 GY", "0.75 WH", "1.5 OG", "2.5 VT",
            ]
            for row, code in enumerate(codes):
                page.insert_text(fitz.Point(50, 85 + row * 28), code, fontsize=9)
            document.save(source)
            document.close()
            report = scan_document(source)
        self.assertEqual(report["confirmed"], [])
        self.assertEqual(report["selected"], [])


    def test_raster_ocr_records_one_label_next_to_a_line_for_review(self):
        import cv2
        import numpy as np

        with tempfile.TemporaryDirectory() as temp_name:
            image_path = Path(temp_name) / "sensor.png"
            image = np.full((500, 700, 3), 255, dtype=np.uint8)
            cv2.line(image, (100, 250), (620, 250), (0, 0, 0), 3)
            cv2.imwrite(str(image_path), image)
            ocr_result = {
                "image": [700, 500],
                "labels": [{
                    "code": "RD", "raw": "1.5 RD", "score": 0.98,
                    "cx": 250.0, "cy": 225.0, "w": 75.0, "h": 22.0,
                    "box": [[212.5, 214.0], [287.5, 214.0],
                            [287.5, 236.0], [212.5, 236.0]],
                }],
            }
            with patch("wirecolor.labels.ocr.ocr_labels", return_value=ocr_result):
                evidence = inspect_ocr_image(str(image_path))
        self.assertEqual(evidence["status"], "review")
        self.assertEqual(evidence["near_wire"], 1)

    def test_raster_ocr_ignores_a_coloured_wire(self):
        import cv2
        import numpy as np

        with tempfile.TemporaryDirectory() as temp_name:
            image_path = Path(temp_name) / "sensor-coloured.png"
            image = np.full((500, 700, 3), 255, dtype=np.uint8)
            cv2.line(image, (100, 250), (620, 250), (0, 0, 255), 4)
            cv2.imwrite(str(image_path), image)
            ocr_result = {
                "image": [700, 500],
                "labels": [{
                    "code": "RD", "raw": "1.5 RD", "score": 0.98,
                    "cx": 250.0, "cy": 225.0, "w": 75.0, "h": 22.0,
                    "box": [[212.5, 214.0], [287.5, 214.0],
                            [287.5, 236.0], [212.5, 236.0]],
                }],
            }
            with patch("wirecolor.labels.ocr.ocr_labels", return_value=ocr_result):
                evidence = inspect_ocr_image(str(image_path))
        self.assertEqual(evidence["status"], "already_colored")
        self.assertEqual(evidence["chromatic_near_labels"], 1)

    def test_inventory_resumes_page_ledger_and_writes_reports(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            source = root / "manual.pdf"
            document = fitz.open()
            page = document.new_page(width=400, height=300)
            page.draw_line(fitz.Point(80, 150), fitz.Point(340, 150), width=0.8)
            page.insert_text(fitz.Point(130, 141), "1.5 RD", fontsize=9)
            document.new_page(width=400, height=300).insert_text(
                fitz.Point(40, 80), "General maintenance instructions.")
            document.save(source)
            document.close()
            manual = Manual(
                key="test", title="Test manual", path=source,
                sha256="test-digest", old_pages_1_based=frozenset({2}),
            )
            out = root / "inventory"
            first = scan_library([manual], out, ocr_mode="off", thumbnails=False,
                                 progress_every=0)
            line_count = len((out / "pages.jsonl").read_text(encoding="utf-8").splitlines())
            second = scan_library([manual], out, ocr_mode="off", thumbnails=False,
                                  progress_every=0)
            self.assertEqual(len((out / "pages.jsonl").read_text(
                encoding="utf-8").splitlines()), line_count)
            self.assertEqual(first, second)
            summary = write_reports(second, [manual], out, str(source), "off")
            self.assertEqual(summary["candidate_pages"], 1)
            self.assertEqual(summary["new_candidate_pages_beyond_old_8_code_scan"], 1)
            self.assertTrue((out / "candidates.csv").is_file())
            self.assertTrue((out / "report.html").is_file())

            merged = merge_ledgers([out], root / "merged")
            self.assertEqual(merged, second)
            self.assertEqual(len((root / "merged" / "pages.jsonl").read_text(
                encoding="utf-8").splitlines()), 2)

            with patch(
                "wirecolor.tools.inventory_wiring_pages._render_for_ocr",
                side_effect=MemoryError("temporary OCR allocation failure"),
            ):
                failed = scan_library([manual], out, ocr_mode="missing", thumbnails=False,
                                      progress_every=0)
                retried = scan_library([manual], out, ocr_mode="missing", thumbnails=False,
                                       progress_every=0)
            self.assertEqual(failed[("test", 2)]["status"], "error")
            self.assertEqual(failed[("test", 2)]["ocr"]["status"], "error")
            self.assertEqual(retried[("test", 2)]["ocr"]["status"], "error")
            self.assertEqual(len((out / "pages.jsonl").read_text(
                encoding="utf-8").splitlines()), 4)

    def test_merge_ledgers_keeps_newest_duplicate_page(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            old_dir, new_dir = root / "old", root / "new"
            old_dir.mkdir()
            new_dir.mkdir()
            common = {
                "scanner_version": SCANNER_VERSION,
                "manual_key": "m", "page_1_based": 1,
                "thumbnail": "thumbnails/m-p1.jpg",
            }
            old = {**common, "scanned_utc": "2026-08-22T10:00:00+00:00", "status": "review"}
            new = {**common, "scanned_utc": "2026-08-22T11:00:00+00:00", "status": "confirmed"}
            (old_dir / "pages.jsonl").write_text(json.dumps(old) + "\n", encoding="utf-8")
            (new_dir / "pages.jsonl").write_text(json.dumps(new) + "\n", encoding="utf-8")
            (new_dir / "thumbnails").mkdir()
            (new_dir / "thumbnails" / "m-p1.jpg").write_bytes(b"thumbnail")
            merged_dir = root / "merged"
            merged = merge_ledgers([new_dir, old_dir], merged_dir)
            self.assertEqual(
                (merged_dir / "thumbnails" / "m-p1.jpg").read_bytes(), b"thumbnail")
        self.assertEqual(merged[("m", 1)]["status"], "confirmed")


class PageClassificationTests(unittest.TestCase):
    """The candidate shapes a whole-document sweep is allowed to send to OCR."""

    @staticmethod
    def _geometry(coverage, text_chars, strokes=0, page_pt=(595.0, 842.0)):
        return {
            "stroke_primitives": strokes,
            "strokes_counted": True,
            "image_coverage": coverage,
            "page_pt": list(page_pt),
            "text_chars": text_chars,
        }

    def test_scanned_plate_with_a_parts_list_beside_it_is_a_candidate(self):
        """The shape of the 2000-era Volvo wiring manuals: a scan plus a typeset component list.

        The text-free foldout rule rejected every page of those files, so a document titled
        "Wiring Diagram" was declined for carrying no readable colour codes -- while OCR on one of
        those pages reads twelve codes and the production topology approves 91 conductors.
        """
        geometry = self._geometry(coverage=0.519, text_chars=903)
        tier, status = classify(geometry, codes=0, wiring_publication=True,
                                allow_text_confirmation=False)
        self.assertEqual((tier, status), ("raster+ocr", "candidate"))

    def test_a_scanned_plate_outside_a_wiring_publication_stays_rejected(self):
        geometry = self._geometry(coverage=0.519, text_chars=903)
        self.assertEqual(
            classify(geometry, codes=0, wiring_publication=False,
                     allow_text_confirmation=False)[1],
            "rejected",
        )

    def test_a_small_inset_image_is_not_a_scanned_plate(self):
        geometry = self._geometry(coverage=0.07, text_chars=128)
        self.assertEqual(
            classify(geometry, codes=0, wiring_publication=True,
                     allow_text_confirmation=False)[1],
            "rejected",
        )

    def test_a_vector_page_is_not_promoted_by_the_scanned_plate_rule(self):
        """A page with its own vector schematic is the exact route's business, not OCR's."""
        geometry = self._geometry(coverage=0.30, text_chars=2027, strokes=1619)
        self.assertEqual(
            classify(geometry, codes=0, wiring_publication=True,
                     allow_text_confirmation=False)[1],
            "rejected",
        )

    def test_the_text_free_foldout_remains_a_candidate(self):
        geometry = self._geometry(coverage=0.94, text_chars=12, page_pt=(1684.0, 1190.0))
        self.assertEqual(
            classify(geometry, codes=0, wiring_publication=True,
                     allow_text_confirmation=False)[1],
            "candidate",
        )


if __name__ == "__main__":
    unittest.main()
