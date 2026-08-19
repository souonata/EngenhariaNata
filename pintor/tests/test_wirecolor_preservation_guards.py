"""Regression tests for the three preservation guards that shipped without any.

Each of these protected a real footgun that no test could see:
  * V7 reported PASS when its strongest check never ran;
  * an already-painted PDF could be painted again and still satisfy V7;
  * one --page index was applied to every publication, so "the corpus" was page 0 of each.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

import numpy as np

from wirecolor.batch import resolve_pages
from wirecolor.paint.raster_overlay import OCG_NAME, attach_overlay
from wirecolor.verify.validators import v2_vector_protected_overlap, v7_preservation


def _blank_pdf(path, pages=1):
    import fitz
    doc = fitz.open()
    for _ in range(pages):
        page = doc.new_page(width=300, height=200)
        page.draw_line(fitz.Point(20, 20), fitz.Point(280, 180))
    doc.save(path)
    doc.close()
    return path


def _overlay(height=200, width=300):
    """A BGRA overlay with one opaque band, so the painted output really differs."""
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    rgba[90:110, :, 2] = 255      # red band
    rgba[90:110, :, 3] = 255      # opaque
    return rgba


class PageEnumerationTests(unittest.TestCase):
    """A wiring publication is multi-page; the runner must be able to say so."""

    def test_all_enumerates_every_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = _blank_pdf(str(Path(tmp) / "m.pdf"), pages=5)
            pages, total = resolve_pages("all", pdf)
            self.assertEqual(pages, [0, 1, 2, 3, 4])
            self.assertEqual(total, 5)

    def test_explicit_list_is_honoured(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = _blank_pdf(str(Path(tmp) / "m.pdf"), pages=5)
            self.assertEqual(resolve_pages("0,2,4", pdf)[0], [0, 2, 4])

    def test_out_of_range_pages_are_dropped_not_crashed(self):
        """A page list is applied across publications of differing length."""
        with tempfile.TemporaryDirectory() as tmp:
            pdf = _blank_pdf(str(Path(tmp) / "m.pdf"), pages=2)
            self.assertEqual(resolve_pages("0,1,7", pdf)[0], [0, 1])

    def test_default_preserves_legacy_single_page_behaviour(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = _blank_pdf(str(Path(tmp) / "m.pdf"), pages=3)
            self.assertEqual(resolve_pages("0", pdf)[0], [0])


class IdempotencyTests(unittest.TestCase):
    def test_painting_an_already_painted_pdf_is_refused(self):
        """V7 cannot catch this: the painted file is a valid byte prefix of itself-plus-a-layer
        and keeps every original image hash, so a doubly-painted sheet passes every check."""
        with tempfile.TemporaryDirectory() as tmp:
            src = _blank_pdf(str(Path(tmp) / "src.pdf"))
            once = str(Path(tmp) / "once.pdf")
            attach_overlay(src, once, 0, _overlay())

            twice = str(Path(tmp) / "twice.pdf")
            with self.assertRaises(SystemExit) as caught:
                attach_overlay(once, twice, 0, _overlay())
            self.assertIn(OCG_NAME, str(caught.exception))

    def test_a_clean_original_is_still_painted(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = _blank_pdf(str(Path(tmp) / "src.pdf"))
            out = str(Path(tmp) / "out.pdf")
            stats = attach_overlay(src, out, 0, _overlay())
            self.assertEqual(stats["ocg"], OCG_NAME)
            self.assertGreater(stats["out_bytes"], stats["src_bytes"])


class V7RenderCheckTests(unittest.TestCase):
    def test_real_overlay_passes_with_the_render_check_actually_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = _blank_pdf(str(Path(tmp) / "src.pdf"))
            out = str(Path(tmp) / "out.pdf")
            stats = attach_overlay(src, out, 0, _overlay())
            result = v7_preservation(src, out, 0, stats["ocg"])
            self.assertTrue(result["byte_prefix"])
            self.assertTrue(result["original_images_kept"])
            # the guarantee is worthless unless the layer-off render was genuinely compared
            self.assertTrue(result["render_checked"])
            self.assertTrue(result["passed"])

    def test_chroma_separates_paint_from_antialiasing_exactly(self):
        """The layer-off check compares CHROMA at zero tolerance, not grey levels at a fudge.

        Antialiasing on monochrome artwork moves all three channels together, so it is neutral and
        shifts no pixel's chroma; paint adds colour. That makes the safety margin a physical
        property rather than a tuned constant."""
        with tempfile.TemporaryDirectory() as tmp:
            src = _blank_pdf(str(Path(tmp) / "src.pdf"))
            out = str(Path(tmp) / "out.pdf")
            stats = attach_overlay(src, out, 0, _overlay())

            result = v7_preservation(src, out, 0, stats["ocg"])
            self.assertEqual(result["max_chroma_delta"], 0)      # exact, no tolerance
            self.assertTrue(result["passed"])

            # with the layer ON the same comparison must be loudly different
            import fitz
            fitz.TOOLS.store_shrink(100)
            ds, do = fitz.open(src), fitz.open(out)
            a = np.frombuffer(ds[0].get_pixmap().samples, dtype=np.uint8).astype(np.int16)
            b = np.frombuffer(do[0].get_pixmap().samples, dtype=np.uint8).astype(np.int16)
            ds.close()
            do.close()
            self.assertGreater(int(np.abs(a - b).max()), 100)

    def test_unrun_render_check_fails_instead_of_silently_passing(self):
        """Looking for an OCG that is not there leaves the check unrun. Before this guard the
        validator still reported passed=True -- inverted for the one thing it exists to prove."""
        with tempfile.TemporaryDirectory() as tmp:
            src = _blank_pdf(str(Path(tmp) / "src.pdf"))
            out = str(Path(tmp) / "out.pdf")
            attach_overlay(src, out, 0, _overlay())
            result = v7_preservation(src, out, 0, "a layer name that does not exist")
            self.assertFalse(result["render_checked"])
            self.assertIsNone(result["layer_off_render_identical"])
            self.assertTrue(result["byte_prefix"])          # byte checks still hold
            self.assertFalse(result["passed"])              # but the verdict must not be PASS


class VectorProtectedRegionTests(unittest.TestCase):
    def test_clean_component_interior_passes(self):
        rgba = np.zeros((200, 300, 4), dtype=np.uint8)
        result = v2_vector_protected_overlap(rgba, [(80, 60, 140, 120)], 200, 200)
        self.assertTrue(result["passed"])

    def test_paint_inside_component_interior_fails(self):
        rgba = np.zeros((200, 300, 4), dtype=np.uint8)
        rgba[80:90, 100:120, 3] = 255
        result = v2_vector_protected_overlap(rgba, [(80, 60, 140, 120)], 200, 200)
        self.assertFalse(result["passed"])
        self.assertGreater(result["painted_px_in_protected"], 0)


if __name__ == "__main__":
    unittest.main()
