"""Memory and electrical-safety contracts for page-once raster OCR tiling."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.labels.conventions import load_convention
from wirecolor.labels.harvest import (
    MAX_ENGINE_PIXELS,
    _bounded_scales,
    _read_tile,
    _release_native_memory,
    _tiles,
    _working_tile_side,
    harvest_labels,
)
from wirecolor.labels.ocr import build_engine
from wirecolor.pipeline import resolve_physical_wire_colors
from wirecolor.web_service import JobStore, _owner_hash, process_job


# A 2000 x 2000 working tile became a 4000 x 4000 engine image at 2x. RapidOCR clamped its detector
# tensor to a 2000 px side, but Linux reproduced std::bad_alloc at that exact square shape. The
# production constant below is therefore smaller than the proven failure, not merely equal to it.


def _dark_box_engine(calls: list[tuple[int, int]]):
    """Return one deterministic OCR box around the dark fixture pixels in each inference tile."""
    import cv2

    def engine(image):
        height, width = image.shape[:2]
        calls.append((width, height))
        if width * height > MAX_ENGINE_PIXELS:
            raise AssertionError(
                f"OCR inference tile exceeded the safety cap: {width}x{height}"
            )
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        ys, xs = np.nonzero(gray < 64)
        if not len(xs):
            return []
        x0, x1 = float(xs.min()), float(xs.max() + 1)
        y0, y1 = float(ys.min()), float(ys.max() + 1)
        return [(
            [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
            "1.5 RD",
            0.99,
        )]

    return engine


def _pdf_bytes():
    import fitz

    document = fitz.open()
    document.new_page(width=300, height=200)
    payload = document.tobytes()
    document.close()
    return payload


class OcrTilingMemoryTests(unittest.TestCase):
    def test_native_release_is_best_effort_when_malloc_trim_is_unavailable(self):
        with patch("ctypes.CDLL", side_effect=OSError("non-glibc runtime")):
            _release_native_memory()

    def test_rapidocr_onnx_threads_and_arena_are_memory_bounded(self):
        captured = {}

        class FakeRapidOCR:
            def __init__(self, **kwargs):
                captured.update(kwargs)

            def __call__(self, _image):
                return SimpleNamespace(boxes=None, txts=None, scores=None)

        with patch.dict(sys.modules, {
            "rapidocr": SimpleNamespace(RapidOCR=FakeRapidOCR),
        }):
            engine = build_engine()

        self.assertEqual(engine(np.zeros((8, 8, 3), dtype=np.uint8)), [])
        params = captured["params"]
        self.assertEqual(params["EngineConfig.onnxruntime.intra_op_num_threads"], 2)
        self.assertEqual(params["EngineConfig.onnxruntime.inter_op_num_threads"], 1)
        self.assertFalse(params["EngineConfig.onnxruntime.enable_cpu_mem_arena"])

    def test_tb66_a0_outer_tiles_cover_the_page_with_overlap(self):
        # 3370.32 x 2384.16 pt at 200 DPI, rounded as PyMuPDF does for the working raster.
        width, height = 9362, 6623
        tiles = list(_tiles(width, height, tile=2000, overlap=180))

        self.assertEqual(tiles[0], (0, 0, 2000, 2000))
        self.assertTrue(all(0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height
                            for x0, y0, x1, y1 in tiles))
        self.assertEqual(max(x1 for _x0, _y0, x1, _y1 in tiles), width)
        self.assertEqual(max(y1 for _x0, _y0, _x1, y1 in tiles), height)

        xs = sorted({(x0, x1) for x0, _y0, x1, _y1 in tiles})
        ys = sorted({(y0, y1) for _x0, y0, _x1, y1 in tiles})
        self.assertTrue(all(right >= next_left
                            for (_left, right), (next_left, _next_right)
                            in zip(xs, xs[1:])))
        self.assertTrue(all(bottom >= next_top
                            for (_top, bottom), (next_top, _next_bottom)
                            in zip(ys, ys[1:])))

    def test_tb66_production_schedule_bounds_every_scaled_tile(self):
        width, height = 9362, 6623
        calls = 0
        for scale in (1.0, 2.0):
            side = _working_tile_side(scale, requested=2000)
            overlap = min(180, side - 1)
            schedule = list(_tiles(width, height, side, overlap))
            calls += len(schedule)
            self.assertEqual(max(x1 for _x0, _y0, x1, _y1 in schedule), width)
            self.assertEqual(max(y1 for _x0, _y0, _x1, y1 in schedule), height)
            for x0, y0, x1, y1 in schedule:
                scaled_width = round((x1 - x0) * scale)
                scaled_height = round((y1 - y0) * scale)
                self.assertLessEqual(scaled_width * scaled_height, MAX_ENGINE_PIXELS)

        # A hard ceiling catches accidental nested-tiling explosions. Rotated reads, when needed,
        # reuse this same schedule and are counted separately by the runtime diagnostics.
        self.assertEqual(_working_tile_side(1.0, requested=2000), 1600)
        self.assertEqual(_working_tile_side(2.0, requested=2000), 800)
        self.assertLessEqual(calls, 220)

    def test_tb66_a0_drops_recovery_scale_and_worst_case_stays_within_70_calls(self):
        width, height = 9362, 6623
        scales = _bounded_scales(width, height, (1.0, 2.0))

        self.assertEqual(scales, (1.0,))
        side = _working_tile_side(scales[0], requested=2000)
        upright = len(list(_tiles(width, height, side, overlap=180)))
        worst_case_with_every_tile_rotated = upright * 2

        self.assertEqual(upright, 35)
        self.assertLessEqual(worst_case_with_every_tile_rotated, 70)

    def test_two_x_read_never_sends_more_than_four_megapixels_to_onnx(self):
        image = np.full((2000, 2000, 3), 255, dtype=np.uint8)
        image[880:920, 930:1010] = 0
        calls: list[tuple[int, int]] = []

        tokens = _read_tile(
            _dark_box_engine(calls), image, 0, 0, 2000, 2000,
            scale=2.0, rotated=False,
        )

        self.assertGreater(len(calls), 1, "the unsafe 16 MP engine image was not subdivided")
        self.assertTrue(all(width * height <= MAX_ENGINE_PIXELS for width, height in calls))
        self.assertTrue(tokens)
        # The fixture is centred at (970, 900) in working-page coordinates.
        self.assertTrue(any(abs(token["cx"] - 970) <= 2 for token in tokens), tokens)
        self.assertTrue(any(abs(token["cy"] - 900) <= 2 for token in tokens), tokens)

    def test_rotated_subtile_coordinates_map_back_to_the_working_page(self):
        image = np.full((2000, 2000, 3), 255, dtype=np.uint8)
        image[620:700, 1440:1480] = 0
        calls: list[tuple[int, int]] = []

        tokens = _read_tile(
            _dark_box_engine(calls), image, 0, 0, 2000, 2000,
            scale=2.0, rotated=True,
        )

        self.assertGreater(len(calls), 1)
        self.assertTrue(all(width * height <= MAX_ENGINE_PIXELS for width, height in calls))
        self.assertTrue(any(abs(token["cx"] - 1460) <= 2 for token in tokens), tokens)
        self.assertTrue(any(abs(token["cy"] - 660) <= 2 for token in tokens), tokens)

    def test_overlapping_outer_and_inner_tiles_emit_one_global_label(self):
        import cv2

        # The legend is wholly visible in two adjacent outer tiles and may also be visible in
        # multiple inference subtiles. All observations must collapse at the original page box.
        image = np.full((900, 2200, 3), 255, dtype=np.uint8)
        image[410:450, 1840:1920] = 0
        calls: list[tuple[int, int]] = []
        convention = load_convention("iec_two_letter")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "overlap.png"
            self.assertTrue(cv2.imwrite(str(path), image))
            with patch(
                "wirecolor.labels.harvest.build_engine",
                return_value=_dark_box_engine(calls),
            ), patch(
                "wirecolor.labels.harvest._tall_text_present", return_value=False,
            ), patch(
                "wirecolor.labels.harvest._release_native_memory",
            ) as release_native:
                harvested = harvest_labels(
                    str(path), convention, scales=(2.0,), tile=2000,
                    overlap=180, verbose=False,
                )

        release_native.assert_called_once_with()
        self.assertTrue(all(width * height <= MAX_ENGINE_PIXELS for width, height in calls))
        self.assertEqual(len(harvested["labels"]), 1, harvested["labels"])
        label = harvested["labels"][0]
        self.assertEqual(label["code"], "RD")
        self.assertAlmostEqual(label["cx"], 1880.0, delta=2.0)
        self.assertAlmostEqual(label["cy"], 430.0, delta=2.0)


class OcrTilingReleaseGateTests(unittest.TestCase):
    def test_conflicting_overlap_reads_leave_wire_ownership_unpainted(self):
        segment = {
            "order": [(100, x) for x in range(20, 181)],
            "ends": [(100, 20), (100, 180)],
        }

        def label(code):
            return {
                "code": code,
                "raw": f"1.5 {code}",
                "score": 0.99,
                "cx": 100.0,
                "cy": 90.0,
                "w": 70.0,
                "h": 20.0,
                "box": [[65, 80], [135, 80], [135, 100], [65, 100]],
            }

        solution = {
            "nfind": lambda _segment_index: 0,
            "live": [0],
            # Model two overlapping OCR subtiles disagreeing about the same printed legend.
            "seeds": [(label("RD"), 0), (label("BU"), 0)],
            "claims": {0: (0, ["RD"])},
        }

        result = resolve_physical_wire_colors([segment], solution)

        self.assertEqual(result["unresolved"], 1)
        self.assertEqual(solution["unresolved_roots"], {0})
        self.assertNotIn(0, solution["claims"])

    def test_web_quarantines_raster_output_when_v2_fails(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            os.environ, {"PINTOR_COOKIE_SECURE": "0"},
        ):
            store = JobStore(directory)
            state = store.create(
                _pdf_bytes(), "a0-scan.pdf", 0, "iec_two_letter", False,
                25 * 1024 * 1024, _owner_hash("d" * 64),
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
            ):
                process_job(store, state["id"])

            result = store.read(state["id"])
            painted_exists = (store.job_dir(state["id"]) / "painted.pdf").exists()

        self.assertEqual(result["status"], "failed")
        self.assertIn("V2", result["internal_error"])
        self.assertFalse(painted_exists)

    def test_web_quarantines_raster_output_when_v7_fails(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            os.environ, {"PINTOR_COOKIE_SECURE": "0"},
        ):
            store = JobStore(directory)
            state = store.create(
                _pdf_bytes(), "a0-scan.pdf", 0, "iec_two_letter", False,
                25 * 1024 * 1024, _owner_hash("c" * 64),
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
                "v2": {"name": "V2", "passed": True},
                "v7": {"name": "V7", "passed": False},
            }
            with patch(
                "wirecolor.tools.paint_vector.paint_page", return_value=vector_report,
            ), patch(
                "wirecolor.tools.paint_raster.paint_page", return_value=raster_report,
            ):
                process_job(store, state["id"])

            result = store.read(state["id"])
            painted_exists = (store.job_dir(state["id"]) / "painted.pdf").exists()

        self.assertEqual(result["status"], "failed")
        self.assertIn("V7", result["internal_error"])
        self.assertFalse(painted_exists)


if __name__ == "__main__":
    unittest.main()
