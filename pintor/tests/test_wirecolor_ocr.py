"""Regression tests for conservative OCR cable-legend reconstruction."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.labels.conventions import load_convention
from wirecolor.labels.ocr import (
    _page_table_mapping,
    _table_code,
    merge_ocr_fragments,
    ocr_labels,
)
from wirecolor.labels.parse import parse_code


def _token(raw, x0, y0, x1, y1, score=0.95):
    return {
        "raw": raw,
        "score": score,
        "cx": (x0 + x1) / 2,
        "cy": (y0 + y1) / 2,
        "w": x1 - x0,
        "h": y1 - y0,
        "box": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
    }


class PageCodeTableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.convention = load_convention("volvo_classic")

    def test_legacy_aliases_require_an_explicit_dense_colour_table(self):
        words = ["Black", "Blue", "Green", "Yellow", "Orange", "White", "Brown", "Red"]
        tokens = [_token("Wire Colour", 0, 0, 20, 10),
                  _token("Kod/Code", 0, 15, 20, 25)]
        tokens.extend(_token(word, 30 + index * 20, 0, 45 + index * 20, 10)
                      for index, word in enumerate(words))
        mapping = _page_table_mapping(tokens, self.convention)

        self.assertEqual(mapping["B"], "SB")
        self.assertEqual(mapping["GR"], "GN")
        self.assertEqual(_table_code("Bl", mapping), "BL")
        self.assertEqual(_table_code("BI", mapping), "BL")
        self.assertIsNone(_table_code("2W)", mapping))

    def test_colour_words_without_code_table_headers_do_not_enable_aliases(self):
        tokens = [_token(word, index * 20, 0, index * 20 + 15, 10)
                  for index, word in enumerate(
                      ["Black", "Blue", "Green", "Yellow", "Orange", "White"])]
        self.assertEqual(_page_table_mapping(tokens, self.convention), {})

    def test_ocr_labels_tag_page_local_table_evidence(self):
        from PIL import Image

        reads = ["Wire Colour", "Kod/Code", "Black", "Blue", "Green", "Yellow",
                 "Orange", "White", "Brown", "Red", "B", "Gr", "R"]

        def engine(_image):
            return [
                ([[index * 12, 0], [index * 12 + 10, 0],
                  [index * 12 + 10, 10], [index * 12, 10]], raw, 0.99)
                for index, raw in enumerate(reads)
            ]

        with tempfile.TemporaryDirectory() as temp_name:
            image_path = Path(temp_name) / "table.png"
            Image.new("RGB", (300, 100), "white").save(image_path)
            result = ocr_labels(str(image_path), self.convention, engine=engine)

        self.assertTrue(result["page_code_table"])
        table_labels = {
            (label["raw"], label["code"])
            for label in result["labels"]
            if label["evidence_source"] == "page-code-table"
        }
        self.assertIn(("B", "SB"), table_labels)
        self.assertIn(("Gr", "GN"), table_labels)

    def test_can_bus_names_are_not_colour_codes(self):
        self.assertIsNone(parse_code("CAN H", self.convention))
        self.assertIsNone(parse_code("CAN L", self.convention))


class OcrFragmentMergeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.convention = load_convention("volvo_classic")

    def _strong(self, tokens):
        return [token for token in tokens
                if any(ch.isdigit() for ch in token["raw"])
                and parse_code(token["raw"], self.convention)]

    def test_horizontal_gauge_then_code(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 20, 12),
            _token("R", 25, 0, 34, 12),
        ], self.convention)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["raw"], "25 R")
        self.assertEqual(parse_code(result[0]["raw"], self.convention), "R")

    def test_horizontal_code_then_gauge(self):
        result = merge_ocr_fragments([
            _token("SB", 0, 0, 18, 12),
            _token("70", 23, 0, 43, 12),
        ], self.convention)

        self.assertEqual([token["raw"] for token in result], ["SB 70"])
        self.assertEqual(parse_code(result[0]["raw"], self.convention), "SB")

    def test_single_digit_gauge_uses_shared_baseline_not_glyph_aspect(self):
        result = merge_ocr_fragments([
            _token("4", 0, 0, 8, 12),
            _token("R", 13, 0, 21, 12),
        ], self.convention)

        self.assertEqual([token["raw"] for token in result], ["4 R"])

    def test_vertical_gauge_and_code(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 12, 20),
            _token("SB", 0, 25, 12, 44),
        ], self.convention)

        self.assertEqual(len(result), 1)
        self.assertEqual(parse_code(result[0]["raw"], self.convention), "SB")

    def test_invalid_gauge_is_not_merged(self):
        result = merge_ocr_fragments([
            _token("23", 0, 0, 20, 12),
            _token("R", 25, 0, 34, 12),
        ], self.convention)

        self.assertEqual({token["raw"] for token in result}, {"23", "R"})
        self.assertEqual(self._strong(result), [])

    def test_distant_fragments_are_not_merged(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 20, 12),
            _token("R", 45, 0, 54, 12),
        ], self.convention)

        self.assertEqual({token["raw"] for token in result}, {"25", "R"})

    def test_orthogonal_neighbour_is_not_merged(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 20, 10),
            _token("R", 5, 14, 15, 24),
        ], self.convention)

        self.assertEqual({token["raw"] for token in result}, {"25", "R"})

    def test_component_sized_neighbour_is_not_merged(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 20, 10),
            _token("R", 25, -5, 42, 22),
        ], self.convention)

        self.assertEqual({token["raw"] for token in result}, {"25", "R"})

    def test_ambiguous_code_neighbours_are_not_merged(self):
        result = merge_ocr_fragments([
            _token("R", -14, 0, -5, 12),
            _token("25", 0, 0, 20, 12),
            _token("SB", 25, 0, 43, 12),
        ], self.convention)

        self.assertEqual({token["raw"] for token in result}, {"R", "25", "SB"})

    def test_tile_overlap_duplicates_collapse_before_merge(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 20, 12, score=0.85),
            _token("25", 1, 0, 21, 12, score=0.97),
            _token("R", 25, 0, 34, 12, score=0.86),
            _token("R", 25.5, 0, 34.5, 12, score=0.96),
        ], self.convention)

        self.assertEqual(len(result), 1)
        self.assertEqual(parse_code(result[0]["raw"], self.convention), "R")
        self.assertAlmostEqual(result[0]["score"], 0.96)

    def test_overlapping_complete_read_wins_over_fragments(self):
        result = merge_ocr_fragments([
            _token("25", 0, 0, 20, 12),
            _token("R", 25, 0, 34, 12),
            _token("25 R", 0, -1, 34, 13, score=0.99),
        ], self.convention)

        self.assertEqual([token["raw"] for token in result], ["25 R"])
        self.assertEqual(result[0]["score"], 0.99)

    def test_dangling_slash_merge_is_preserved(self):
        result = merge_ocr_fragments([
            _token("BL/", 0, 0, 20, 12),
            _token("GR", 24, 0, 40, 12),
        ], self.convention)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["raw"], "BL/GR")
        self.assertEqual(parse_code(result[0]["raw"], self.convention), "BL/GR")

    def test_dangling_slash_does_not_corrupt_complete_neighbour(self):
        result = merge_ocr_fragments([
            _token("BL/", 0, 0, 20, 12),
            _token("0.75 R", 24, 0, 70, 12),
        ], self.convention)

        self.assertEqual([token["raw"] for token in result], ["0.75 R"])

    def test_input_tokens_are_not_mutated(self):
        source = [
            _token("25", 0, 0, 20, 12),
            _token("R", 25, 0, 34, 12),
        ]
        before = [dict(token, box=[point[:] for point in token["box"]]) for token in source]

        merge_ocr_fragments(source, self.convention)

        self.assertEqual(source, before)

    def test_vintage_bilingual_word_label_maps_to_classic_code(self):
        self.assertEqual(parse_code("Grön 1,5 - Green 1.5", self.convention), "GN")
        self.assertEqual(parse_code("Blå 0,75 - Blue 0.75", self.convention), "BL")
        self.assertEqual(parse_code("Vit 1,5 - Ivory 1.5", self.convention), "W")
        self.assertEqual(parse_code("Blå/Gul 0,75", self.convention), "BL/Y")
        self.assertEqual(parse_code("Blo/Gul 1,5", self.convention), "BL/Y")

    def test_colour_words_without_decimal_wire_gauge_are_not_labels(self):
        self.assertIsNone(parse_code("Green - Power", self.convention))
        self.assertIsNone(parse_code("1. Green indicator", self.convention))


if __name__ == "__main__":
    unittest.main()


class StrictWireIdTests(unittest.TestCase):
    """A clipped id must never be read as a different wire (round 16: 21% were truncated)."""

    def test_complete_id_parses_in_both_forms(self):
        from wirecolor.labels.parse import parse_wire_id, parse_wire_id_strict
        self.assertEqual(parse_wire_id("0.75 GR (w336)"), "W336")
        self.assertEqual(parse_wire_id_strict("0.75 GR (w336)"), "W336")

    def test_clipped_id_is_refused_by_the_strict_form(self):
        from wirecolor.labels.parse import parse_wire_id, parse_wire_id_strict
        self.assertEqual(parse_wire_id("0.75 Y (w29"), "W29")   # tolerant: fine for dedup
        self.assertIsNone(parse_wire_id_strict("0.75 Y (w29"))  # never an identity claim

    def test_ocr_digit_confusions_still_normalise(self):
        from wirecolor.labels.parse import parse_wire_id_strict
        self.assertEqual(parse_wire_id_strict("0.75 R (wll2)"), "W112")
        self.assertEqual(parse_wire_id_strict("1 BL (wI45)"), "W145")

    def test_a_label_without_an_id_yields_none(self):
        from wirecolor.labels.parse import parse_wire_id_strict
        self.assertIsNone(parse_wire_id_strict("25 R"))
