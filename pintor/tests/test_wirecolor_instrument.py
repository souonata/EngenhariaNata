"""Tests for the OCR memo and the diagnostic dump used by the route probe.

The instrumentation must be invisible to production runs (no environment variable set) and, when
enabled, must replay the recognised text exactly so that every later decision can be re-run
without paying for OCR again.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.instrument import DiagLog, OCRMemo, reset_for_tests
from wirecolor.tools.route_probe import probe


TOKENS = [([[0.0, 0.0], [8.0, 0.0], [8.0, 4.0], [0.0, 4.0]], "25 R", 0.97)]


class CountingEngine:
    def __init__(self):
        self.calls = 0

    def __call__(self, _image):
        self.calls += 1
        return list(TOKENS)


class OCRMemoTests(unittest.TestCase):
    def test_disabled_memo_always_calls_the_engine(self):
        memo = OCRMemo(None)
        engine = CountingEngine()
        for _ in range(3):
            memo.read(engine, object(), (0, 0, 10, 10, False))
        self.assertEqual(engine.calls, 3)
        memo.save()  # no path: must not raise

    def test_second_read_of_the_same_window_is_served_from_the_memo(self):
        memo = OCRMemo(None)
        memo.enabled = True
        engine = CountingEngine()
        first = memo.read(engine, object(), (10, 20, 30, 40, True))
        second = memo.read(engine, object(), (10, 20, 30, 40, True))
        self.assertEqual(engine.calls, 1)
        self.assertEqual(memo.hits, 1)
        self.assertEqual([t[1] for t in first], [t[1] for t in second])
        self.assertEqual([t[2] for t in first], [t[2] for t in second])

    def test_a_different_window_is_a_miss(self):
        memo = OCRMemo(None)
        memo.enabled = True
        engine = CountingEngine()
        memo.read(engine, object(), (0, 0, 10, 10, False))
        memo.read(engine, object(), (0, 0, 10, 11, False))
        self.assertEqual(engine.calls, 2)

    def test_cache_round_trips_through_disk_and_replays_the_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "memo.json")
            page = Path(tmp) / "page.png"
            page.write_bytes(b"page-bytes")

            memo = OCRMemo(path)
            memo.bind(str(page))
            engine = CountingEngine()
            memo.read(engine, object(), (5, 6, 7, 8, False))
            memo.save()

            replay = OCRMemo(path)
            replay.bind(str(page))
            reloaded = replay.read(CountingEngine(), object(), (5, 6, 7, 8, False))
            self.assertEqual(replay.hits, 1)
            self.assertEqual(replay.misses, 0)
            self.assertEqual(reloaded[0][1], "25 R")
            self.assertEqual(reloaded[0][2], 0.97)
            self.assertEqual([[float(p[0]), float(p[1])] for p in reloaded[0][0]],
                             TOKENS[0][0])

    def test_misses_are_checkpointed_so_a_crash_keeps_the_ocr_work(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "memo.json")
            memo = OCRMemo(path)
            memo.CHECKPOINT_EVERY = 3
            engine = CountingEngine()
            for window in range(3):
                memo.read(engine, object(), (window, 0, 10, 10, False))
            # No explicit save(): the checkpoint must already be on disk.
            with open(path, encoding="utf-8") as handle:
                self.assertEqual(len(json.load(handle)["reads"]), 3)

    def test_a_different_page_render_discards_the_memo(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "memo.json")
            page = Path(tmp) / "page.png"
            page.write_bytes(b"first")
            memo = OCRMemo(path)
            memo.bind(str(page))
            memo.read(CountingEngine(), object(), (0, 0, 4, 4, False))
            memo.save()

            page.write_bytes(b"second-render")
            replay = OCRMemo(path)
            replay.bind(str(page))
            engine = CountingEngine()
            replay.read(engine, object(), (0, 0, 4, 4, False))
            self.assertEqual(engine.calls, 1)


class DiagLogTests(unittest.TestCase):
    def test_disabled_log_records_nothing(self):
        log = DiagLog(None)
        log.record("evidence_solid", decision="accepted")
        log.dump()
        self.assertEqual(log._channels, {})

    def test_channels_are_dumped_as_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = DiagLog(tmp)
            log.record("evidence_solid", decision="accepted", code="R")
            log.record("evidence_solid", decision="duplicate", code="R")
            log.record("arcs", si=1)
            log.dump()
            with open(Path(tmp) / "evidence_solid.json", encoding="utf-8") as handle:
                rows = json.load(handle)
            self.assertEqual([row["decision"] for row in rows],
                             ["accepted", "duplicate"])
            with open(Path(tmp) / "arcs.json", encoding="utf-8") as handle:
                self.assertEqual(json.load(handle), [{"si": 1}])

    def test_reset_for_tests_rebinds_both_facilities(self):
        memo, log = reset_for_tests(None, None)
        self.assertFalse(memo.enabled)
        self.assertFalse(log.enabled)


class RouteProbeTests(unittest.TestCase):
    def _dump(self, tmp):
        DiagLog(tmp)
        log = DiagLog(tmp)
        log.record("arcs", si=7, root=3, dash_root=None,
                   points=[[100, 200], [100, 260]], code=None, dash_code=None,
                   excluded=None)
        log.record("scene_solid", root=3, bbox=[90, 190, 110, 270], length=400,
                   segments=2, conductor=True, codes=[], boundaries=["terminal"])
        log.record("ownership_solid", event="root", root=3, unresolved=True,
                   codes=["R", "SB"], evidence=[
                       {"code": "R", "raw": "25 R", "cx": 105.0, "cy": 210.0,
                        "score": 0.99, "provenance": "overview", "candidate_roots": [3]},
                       {"code": "SB", "raw": "25 SB", "cx": 108.0, "cy": 250.0,
                        "score": 0.91, "provenance": "multiscale", "candidate_roots": [3]},
                   ])
        log.record("evidence_solid", decision="beyond-label-distance", code="R",
                   raw="25 R", cx=140.0, cy=230.0, score=0.95,
                   window=[0, 0, 400, 400], window_reason="route-audit", target_root=3,
                   best_distance=180.0)
        log.dump()

    def test_probe_reports_root_evidence_and_rejections(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._dump(tmp)
            report = probe(tmp, 100, 230)
            self.assertIn("arc 7", report)
            self.assertIn("solid root 3", report)
            self.assertIn("unresolved=True", report)
            self.assertIn("'25 R'", report)
            self.assertIn("beyond-label-distance", report)

    def test_probe_reports_absence_of_geometry(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._dump(tmp)
            self.assertIn("no traced arc", probe(tmp, 5000, 5000))


if __name__ == "__main__":
    unittest.main()
