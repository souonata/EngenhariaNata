"""Regression tests for vector callouts over hollow raster conductor illustrations."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

from wirecolor.detect.outlined_wires import detect_outlined_wires
from wirecolor.labels.conventions import load_convention
from wirecolor.tools.paint_raster import paint_page


def _make_hybrid_pdf(path: Path, include_bottom_callout: bool = True):
    import fitz

    image = np.full((600, 1000), 255, np.uint8)
    top = np.array([(100, 200), (300, 170), (600, 230), (880, 210)], np.int32)
    bottom = np.array([(100, 450), (300, 420), (600, 480), (880, 470)], np.int32)
    for points in (top, bottom):
        cv2.polylines(image, [points], False, 0, 36, cv2.LINE_AA)
        cv2.polylines(image, [points], False, 255, 24, cv2.LINE_AA)

    encoded, payload = cv2.imencode(".png", image)
    if not encoded:
        raise RuntimeError("could not encode outlined-wire fixture")

    document = fitz.open()
    page = document.new_page(width=500, height=300)
    image_rect = fitz.Rect(20, 20, 350, 250)
    page.insert_image(image_rect, stream=payload.tobytes())
    page.draw_line(fitz.Point(300, 106.5), fitz.Point(370, 106.5), width=1)
    page.insert_text(fitz.Point(373, 110), "BL/W", fontsize=10)
    if include_bottom_callout:
        page.draw_line(fitz.Point(300, 191.5), fitz.Point(370, 191.5), width=1)
        page.insert_text(fitz.Point(373, 195), "GN", fontsize=10)
    document.save(path)
    document.close()


class OutlinedWireTests(unittest.TestCase):
    def test_one_callout_is_not_enough_to_claim_the_special_page_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "ambiguous.pdf"
            _make_hybrid_pdf(source, include_bottom_callout=False)

            result = detect_outlined_wires(
                str(source), 0, load_convention("volvo_classic"))

        self.assertEqual(result["pair_count"], 1)
        self.assertEqual(len(result["wires"]), 1)
        self.assertEqual(len(result["callout_leaders"]), 1)
        self.assertTrue(result["callout_leaders"][0].resolved_to_conductor)
        self.assertFalse(result["exclusive"])

    def test_exact_leaders_recover_only_the_two_hollow_cable_centrelines(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "outlined.pdf"
            _make_hybrid_pdf(source)

            result = detect_outlined_wires(
                str(source), 0, load_convention("volvo_classic"))

        self.assertTrue(result["exclusive"])
        self.assertEqual(result["pair_count"], 2)
        self.assertEqual(len(result["callout_leaders"]), 2)
        self.assertTrue(all(leader.resolved_to_conductor
                            for leader in result["callout_leaders"]))
        self.assertEqual({wire.code for wire in result["wires"]}, {"BL/W", "GN"})
        for wire in result["wires"]:
            self.assertGreater(len(wire.order), 100)
            self.assertGreaterEqual(wire.width, 4)
            self.assertLessEqual(wire.width, 12)

    def test_hybrid_path_skips_ocr_and_never_paints_the_vector_leaders(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "outlined.pdf"
            overlay = root / "overlay.png"
            _make_hybrid_pdf(source)

            with patch(
                "wirecolor.tools.paint_raster._recognise_page_labels",
                side_effect=AssertionError("exact hybrid path must not invoke OCR"),
            ):
                report = paint_page(
                    str(source), 0, str(root / "output"),
                    convention_name="volvo_classic", overlay_path=str(overlay),
                )

            rgba = cv2.imread(str(overlay), cv2.IMREAD_UNCHANGED)

        self.assertEqual(report["processing_mode"], "hybrid-vector-callout-raster-outline")
        self.assertEqual(report["runs_painted"], 2)
        self.assertEqual(report["outlined_wires_painted"], 2)
        self.assertEqual(set(report["codes"]), {"BL/W", "GN"})
        self.assertTrue(report["v2"]["passed"])
        scale = report["paint_dpi"] / 72.0
        # Both vector leaders lie between x=300 and x=370. Their midpoint must remain absent from
        # the overlay even though their target endpoint identifies the neighbouring cable.
        for y_pt in (106.5, 191.5):
            x, y = round(335 * scale), round(y_pt * scale)
            self.assertEqual(int(np.count_nonzero(rgba[y - 3:y + 4, x - 3:x + 4, 3])), 0)
        # The two target cable interiors are painted.
        for y_pt in (106.5, 191.5):
            x, y = round(297 * scale), round(y_pt * scale)
            self.assertGreater(int(np.count_nonzero(rgba[y - 6:y + 7, x - 6:x + 7, 3])), 0)


if __name__ == "__main__":
    unittest.main()
