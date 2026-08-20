"""Synthetic, corpus-free tests for the standalone raster PDF painter.

The fixture is deliberately born as pixels: one full-page PNG is embedded in the PDF, with no
PDF text objects or vector drawing commands.  OCR is replaced by deterministic recognised-label
JSON so CI measures topology, overlay construction and release validators rather than an OCR
model's platform-dependent confidence.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.eval.vector_truth import geometry_is_trustworthy, largest_image_coverage
from wirecolor.paint.raster_overlay import OCG_NAME
from wirecolor.tools.paint_raster import paint_page


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _make_raster_only_pdf(path: Path) -> None:
    import fitz
    from PIL import Image, ImageDraw, ImageFont

    width, height = 1200, 800
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    # One long, isolated conductor with a rasterized IEC legend above it.  Extra component-like
    # furniture makes this a schematic fixture rather than a single-line special case.
    draw.line((90, 390, 1110, 390), fill="black", width=4)
    draw.rectangle((30, 330, 90, 450), outline="black", width=4)
    draw.rectangle((1110, 330, 1170, 450), outline="black", width=4)
    draw.ellipse((72, 372, 108, 408), outline="black", width=3)
    draw.ellipse((1092, 372, 1128, 408), outline="black", width=3)
    font = ImageFont.load_default(size=28)
    draw.text((500, 335), "1.5 RD", fill="black", font=font)

    raster = io.BytesIO()
    image.save(raster, format="PNG", optimize=False)
    document = fitz.open()
    # 432 x 288 pt rendered at the painter's fixed 200 DPI is exactly 1200 x 800 px.
    page = document.new_page(width=432, height=288)
    page.insert_image(page.rect, stream=raster.getvalue())
    document.save(path)
    document.close()


def _recognised_labels(_image_path: str, labels_path: str, harvest_path: str,
                       requested: str) -> tuple[str, str, int]:
    if requested != "iec_two_letter":
        raise AssertionError("the synthetic fixture must use an explicit convention")
    label = {
        "code": "RD",
        "raw": "1.5 RD",
        "score": 0.99,
        "cx": 548.0,
        "cy": 350.0,
        "w": 96.0,
        "h": 30.0,
        "box": [[496.0, 333.0], [600.0, 333.0], [600.0, 367.0], [496.0, 367.0]],
    }
    payload = {"image": [1200, 800], "labels": [label]}
    for destination in (labels_path, harvest_path):
        Path(destination).write_text(json.dumps(payload), encoding="utf-8")
    return "iec_two_letter", "user-selected", 1


class RasterStandaloneTests(unittest.TestCase):
    def test_image_only_pdf_runs_the_raster_path_and_passes_release_gates(self):
        import fitz

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "synthetic-raster.pdf"
            output = root / "output"
            _make_raster_only_pdf(source)
            source_hash = _sha256(source)

            document = fitz.open(source)
            page = document[0]
            self.assertEqual(page.get_text().strip(), "")
            self.assertEqual(page.get_drawings(), [])
            self.assertEqual(len(page.get_images(full=True)), 1)
            self.assertGreaterEqual(largest_image_coverage(page), 0.99)
            trustworthy, reason = geometry_is_trustworthy(page, 200)
            self.assertFalse(trustworthy)
            self.assertIn("raster", reason)
            document.close()

            with patch(
                "wirecolor.tools.paint_raster._recognise_page_labels",
                side_effect=_recognised_labels,
            ):
                report = paint_page(
                    str(source), 0, str(output), convention_name="iec_two_letter",
                    paint_pixel_budget=2_000_000,
                )

            self.assertFalse(report["declined"])
            self.assertEqual(report["processing_mode"], "raster-ocr")
            self.assertEqual(report["convention"], "iec_two_letter")
            self.assertEqual(report["labels"], 1)
            self.assertGreater(report["runs_painted"], 0)
            self.assertIn("RD", report["codes"])
            self.assertTrue(report["v2"]["passed"], report["v2"])
            self.assertTrue(report["v7"]["passed"], report["v7"])
            self.assertTrue(Path(report["out_pdf"]).is_file())
            self.assertEqual(_sha256(source), source_hash)

            painted = fitz.open(report["out_pdf"])
            try:
                self.assertEqual(len(painted), 1)
                self.assertEqual(painted[0].get_text().strip(), "")
                self.assertIn(OCG_NAME, {
                    config.get("text") for config in painted.layer_ui_configs()
                })
            finally:
                painted.close()


if __name__ == "__main__":
    unittest.main()
