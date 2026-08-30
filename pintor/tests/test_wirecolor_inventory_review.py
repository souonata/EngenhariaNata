"""Regressions for the offline human-review dashboard."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

import fitz

from wirecolor.tools.review_wiring_inventory import (
    FEEDBACK_SCHEMA,
    REVIEW_SCHEMA,
    build_dashboard,
    select_diverse_candidates,
    validate_feedback,
)
from wirecolor.tools.verify_wiring_inventory import _source_fingerprint


class InventoryReviewDashboardTests(unittest.TestCase):
    @staticmethod
    def _candidate(pdf: Path, title: str = "Synthetic wiring page") -> dict:
        return {
            "scanner_version": "wiring-page-inventory-v13",
            "scanned_utc": "2026-08-30T10:00:00+00:00",
            "manual_key": "manual-42",
            "manual_title": title,
            "manual_path": str(pdf),
            "manual_sha256": "synthetic-digest",
            "page_1_based": 1,
            "page_index": 0,
            "page_count": 1,
            "status": "confirmed",
            "confidence": "high",
            "reason": "exact colour legend is adjacent to a physical conductor",
            "vector": {
                "status": "confirmed",
                "confidence": "high",
                "convention": "iec_two_letter",
                "assigned_runs": 1,
                "legends": [{"raw": "1.5 RD", "code": "RD"}],
            },
            "ocr": {"status": "not_run", "legends": []},
            "thumbnail": None,
        }

    @staticmethod
    def _write_pdf(path: Path) -> None:
        document = fitz.open()
        page = document.new_page(width=400, height=300)
        page.draw_line(fitz.Point(40, 150), fitz.Point(360, 150), width=1)
        page.insert_text(fitz.Point(150, 140), "1.5 RD", fontsize=10)
        document.save(path)
        document.close()

    def test_builds_file_friendly_zoom_pan_and_feedback_surface(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            pdf = root / "manual.pdf"
            self._write_pdf(pdf)
            inventory = root / "inventory"
            inventory.mkdir()
            candidate = self._candidate(pdf, "A title </script> that must stay data")
            (inventory / "pages.jsonl").write_text(
                json.dumps(candidate) + "\n", encoding="utf-8",
            )
            out = root / "review"

            manifest = build_dashboard(
                [inventory], out, max_side=600, jpeg_quality=70, progress_every=0,
            )
            html = (out / "review.html").read_text(encoding="utf-8")
            data = json.loads((out / "review-manifest.json").read_text(encoding="utf-8"))
            images = list((out / "review-images").glob("*.jpg"))

        self.assertEqual(manifest["schema"], REVIEW_SCHEMA)
        self.assertEqual(data["candidate_pages"], 1)
        # With no first-stage thumbnail fixture, the dashboard renders one small card fallback and
        # one 600 px review image.  Real inventories copy their existing thumbnails instead.
        self.assertEqual(len(images), 2)
        self.assertIn("wheel: zoom", html)
        self.assertIn("pointermove", html)
        self.assertIn("Export feedback JSON", html)
        self.assertIn(FEEDBACK_SCHEMA, html)
        self.assertIn("\\u003c/script\\u003e", html)
        self.assertNotIn("A title </script>", html)

    def test_feedback_validator_rejects_mismatched_detector_revision(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            pdf = root / "manual.pdf"
            self._write_pdf(pdf)
            candidate = self._candidate(pdf)
            source_fingerprint = _source_fingerprint(candidate)
            known = {
                "page-id": {
                    "id": "page-id",
                    "manual_key": "manual-42",
                    "manual_sha256": "synthetic-digest",
                    "page_1_based": 1,
                    "source_fingerprint": source_fingerprint,
                }
            }
            decision = {
                "id": "page-id",
                "manual_key": "manual-42",
                "manual_sha256": "synthetic-digest",
                "page_1_based": 1,
                "decision": "paintable_wiring",
                "reason": "physical-coded-wires",
                "notes": "clear colour codes",
                "source_fingerprint": source_fingerprint,
                "updated_utc": "2026-08-30T11:00:00+00:00",
            }
            payload = {"schema": FEEDBACK_SCHEMA, "decisions": [decision]}

            valid = validate_feedback(payload, known)
            changed = json.loads(json.dumps(payload))
            changed["decisions"][0]["source_fingerprint"] = "different-detector-input"

            with self.assertRaisesRegex(ValueError, "source_fingerprint"):
                validate_feedback(changed, known)

        self.assertEqual(valid["decisions"][0]["decision"], "paintable_wiring")

    def test_feedback_validator_rejects_unknown_decision(self):
        payload = {
            "schema": FEEDBACK_SCHEMA,
            "decisions": [{
                "id": "page-id",
                "manual_key": "m",
                "manual_sha256": "digest",
                "page_1_based": 1,
                "decision": "paint_everything",
            }],
        }
        with self.assertRaisesRegex(ValueError, "unsupported"):
            validate_feedback(payload)

    def test_second_round_interleaves_modes_and_caps_repeated_manuals(self):
        candidates = {}
        for manual, pages, status, vector_status in (
            ("a", range(1, 6), "confirmed", "confirmed"),
            ("b", range(1, 4), "probable", "no_evidence"),
            ("c", range(1, 4), "review", "no_evidence"),
        ):
            for page in pages:
                candidates[(manual, page)] = {
                    "manual_key": manual,
                    "manual_title": f"Manual {manual}",
                    "page_1_based": page,
                    "status": status,
                    "reason": "same repeated evidence",
                    "vector": {"status": vector_status, "legends": [{"code": "RD"}]},
                    "ocr": {"status": status, "legends": [{"code": "RD"}]},
                }

        selected = select_diverse_candidates(
            candidates, max_pages=6, max_per_manual=2, max_per_signature=1,
        )

        counts = {}
        for manual, _page in selected:
            counts[manual] = counts.get(manual, 0) + 1
        self.assertLessEqual(len(selected), 6)
        self.assertEqual(set(counts), {"a", "b", "c"})
        self.assertTrue(all(count <= 2 for count in counts.values()))


if __name__ == "__main__":
    unittest.main()
