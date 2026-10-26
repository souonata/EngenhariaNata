"""Discovery rules measured on the 2026-10 library scan: codes with an AWG equivalent, circuits
beside connector tables, and black diagrams with one tinted stroke."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import fitz  # noqa: E402

from wirecolor.labels.conventions import load_convention  # noqa: E402
from wirecolor.labels.parse import parse_code  # noqa: E402
from wirecolor.tools.wiring_evidence import inspect_vector_page  # noqa: E402

CODES = ("GN/Y", "SB/R", "T/SB", "PU/W", "LGN/R", "BL/W", "R/PU")


def _page(draw):
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    draw(page)
    return document, page


class AwgEquivalent(unittest.TestCase):
    def setUp(self):
        self.convention = load_convention("volvo_classic")

    def test_a_metric_gauge_followed_by_its_awg_in_brackets_is_read(self):
        for raw, code in (("BN/BL 1,0 (17)", "BN/BL"), ("GN 0,5 (20)", "GN"),
                          ("R/PU 6 (10)", "R/PU"), ("GN/W1,5 (16)", "GN/W")):
            self.assertEqual(parse_code(raw, self.convention, allow_pin=True), code, raw)

    def test_the_bracket_is_dropped_only_after_a_real_cross_section(self):
        self.assertIsNone(parse_code("R (17)", self.convention, allow_pin=True))
        self.assertIsNone(parse_code("SB 7 (17)", self.convention, allow_pin=True))


class CircuitBesideAConnectorTable(unittest.TestCase):
    @staticmethod
    def _header(page):
        page.insert_text(fitz.Point(60, 60), "DTC 1641 Buzzer Control", fontsize=11)
        page.insert_text(fitz.Point(60, 560), "Pin Color Function", fontsize=9)

    def test_a_circuit_drawn_above_the_table_is_confirmed(self):
        def draw(page):
            self._header(page)
            for index, code in enumerate(CODES):
                x = 80 + index * 60
                page.draw_line(fitz.Point(x, 120), fitz.Point(x, 400), width=0.8)
                page.insert_text(fitz.Point(x + 3, 160 + index * 30), code, fontsize=7)
        document, page = _page(draw)
        verdict = inspect_vector_page(page)
        document.close()
        self.assertEqual(verdict["status"], "confirmed", verdict.get("reason"))

    def test_a_table_with_its_codes_in_one_column_stays_excluded(self):
        def draw(page):
            self._header(page)
            for index, code in enumerate(CODES):
                y = 590 + index * 20
                page.insert_text(fitz.Point(100, y), code, fontsize=8)
                page.draw_line(fitz.Point(60, y + 6), fitz.Point(500, y + 6), width=0.5)
        document, page = _page(draw)
        verdict = inspect_vector_page(page)
        document.close()
        self.assertEqual(verdict["status"], "excluded_non_wiring")


class AlreadyColoured(unittest.TestCase):
    @staticmethod
    def _circuit(page, tinted):
        for index, code in enumerate(CODES):
            x = 80 + index * 60
            colour = (0.85, 0.1, 0.1) if index < tinted else (0, 0, 0)
            page.draw_line(fitz.Point(x, 120), fitz.Point(x, 700), width=0.8, color=colour)
            page.insert_text(fitz.Point(x + 3, 160 + index * 30), code, fontsize=7)

    def test_one_tinted_stroke_does_not_make_a_black_diagram_coloured(self):
        document, page = _page(lambda page: (
            self._circuit(page, tinted=0),
            page.draw_line(fitz.Point(80, 120), fitz.Point(80, 150), width=0.8,
                           color=(0.85, 0.1, 0.1))))
        verdict = inspect_vector_page(page)
        document.close()
        self.assertEqual(verdict["status"], "confirmed", verdict.get("reason"))

    def test_a_drawing_with_its_conductors_in_colour_is_already_coloured(self):
        document, page = _page(lambda page: self._circuit(page, tinted=4))
        verdict = inspect_vector_page(page)
        document.close()
        self.assertEqual(verdict["status"], "already_colored")


class ScannedPagesAreRead(unittest.TestCase):
    """A scanned page is kept for what OCR reads on it, not for its shape."""

    def _document(self, tmp):
        import numpy as np

        image = np.full((400, 600, 3), 255, np.uint8)
        image[200, 50:550] = 0                          # a line, so the image is not blank
        document = fitz.open()
        for _ in range(3):
            page = document.new_page(width=842, height=595)
            pixmap = fitz.Pixmap(fitz.csRGB, 600, 400, image.tobytes(), False)
            page.insert_image(fitz.Rect(40, 40, 800, 560), pixmap=pixmap)
            page.insert_text(fitz.Point(40, 580), "Group 30 wiring diagram", fontsize=8)
        path = Path(tmp) / "scan.pdf"
        document.save(path)
        document.close()
        return path

    def _scan(self, verdicts, **options):
        import tempfile
        from unittest.mock import patch

        from wirecolor.tools import discover_pages

        def read(_path, prospects, *_args, **_kwargs):
            return {index: verdicts[index] for index in prospects}

        with tempfile.TemporaryDirectory() as tmp, \
                patch.object(discover_pages, "_read_scanned_pages", side_effect=read):
            return discover_pages.scan_document(self._document(tmp), **options)

    def test_only_the_page_where_ocr_finds_codes_is_selected(self):
        report = self._scan({0: {"status": "probable"}, 1: {"status": "no_evidence"},
                             2: {"status": "review"}})
        self.assertEqual(report["selected"], [0])
        self.assertEqual(report["scanned_pages_read"], 3)

    def test_a_headed_drawing_with_outlined_labels_is_read_too(self):
        """No text layer and no image: the codes are vector outlines, so only OCR can see them."""
        import tempfile
        from unittest.mock import patch

        from wirecolor.tools import discover_pages

        document = fitz.open()
        page = document.new_page(width=842, height=595)
        page.insert_text(fitz.Point(40, 40), "Wiring Diagram", fontsize=11)
        for index in range(220):
            y = 60 + (index % 110) * 4.5
            x = 60 if index < 110 else 460
            page.draw_line(fitz.Point(x, y), fitz.Point(x + 300, y), width=0.4)
        read = []
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "outlined.pdf"
            document.save(path)
            document.close()
            with patch.object(discover_pages, "_read_scanned_pages",
                              side_effect=lambda _p, prospects, *a, **k: (
                                  read.extend(prospects) or {0: {"status": "probable"}})):
                report = discover_pages.scan_document(path)
        self.assertEqual(read, [0])
        self.assertEqual(report["selected"], [0])

    def test_the_old_structural_rule_returns_when_scans_are_not_read(self):
        report = self._scan({}, read_scans=False)
        self.assertEqual(report["selected"], [0, 1, 2])
        self.assertEqual(report["scanned_pages_read"], 0)


if __name__ == "__main__":
    unittest.main()
