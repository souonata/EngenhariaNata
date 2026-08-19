"""A page's own "Cable color" key ("BL = Blue", "GN = Green"...) must not be read as wire legends.

The reader parses the CODE column exactly like a wire label, so a sheet that prints its key ships a
dozen phantom legends that name no conductor -- they depress legend-realization and one sitting near
a wire could mis-colour it. The tell is unambiguous: a code with an "=" immediately to its right. No
wire label is ever followed by "=", so the filter drops the glossary and nothing else.
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import fitz  # noqa: E402

from wirecolor.labels.conventions import load_convention  # noqa: E402
from wirecolor.labels.text_layer import _is_glossary_entry, read_legends  # noqa: E402


class IsGlossaryEntry(unittest.TestCase):
    def test_equals_immediately_to_the_right_is_a_glossary_row(self):
        code = (100.0, 100.0, 118.0, 110.0)          # "BL", 10pt tall
        equals = [(126.0, 100.0, 134.0, 110.0)]      # "=" a few pt to the right, same row
        self.assertTrue(_is_glossary_entry(code, equals))

    def test_no_equals_is_a_real_label(self):
        code = (100.0, 100.0, 118.0, 110.0)
        self.assertFalse(_is_glossary_entry(code, []))

    def test_equals_to_the_left_does_not_count(self):
        code = (100.0, 100.0, 118.0, 110.0)
        equals = [(80.0, 100.0, 88.0, 110.0)]        # "=" is to the LEFT
        self.assertFalse(_is_glossary_entry(code, equals))

    def test_equals_far_away_does_not_count(self):
        code = (100.0, 100.0, 118.0, 110.0)
        equals = [(300.0, 100.0, 308.0, 110.0)]      # far to the right -> different column
        self.assertFalse(_is_glossary_entry(code, equals))

    def test_equals_on_another_row_does_not_count(self):
        code = (100.0, 100.0, 118.0, 110.0)
        equals = [(126.0, 200.0, 134.0, 210.0)]      # right x, but a different line
        self.assertFalse(_is_glossary_entry(code, equals))


class ReadLegendsDropsTheKey(unittest.TestCase):
    def _page(self):
        document = fitz.open()
        page = document.new_page(width=400, height=400)
        # a colour-key row: "BL = Blue"
        page.insert_text(fitz.Point(100, 100), "BL", fontsize=10)
        page.insert_text(fitz.Point(122, 100), "=", fontsize=10)
        page.insert_text(fitz.Point(140, 100), "Blue", fontsize=10)
        # a real wire label, no "=" anywhere near it
        page.insert_text(fitz.Point(250, 300), "GN", fontsize=10)
        return fitz.open("pdf", document.tobytes())[0]

    def test_key_code_dropped_real_label_kept(self):
        legends = read_legends(self._page(), 200, load_convention("volvo_classic"))
        codes = sorted(l.code for l in legends)
        self.assertIn("GN", codes)
        self.assertNotIn("BL", codes)


if __name__ == "__main__":
    unittest.main()
