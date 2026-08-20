"""Web boundary tests: upload validation, tenant isolation, feedback schema, and deletion."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.web_service import (
    InvalidUpload,
    JobStore,
    _owner_hash,
    create_app,
    inspect_pdf_source,
    process_job,
)


def _pdf_bytes(pages=1):
    import fitz

    document = fitz.open()
    for _ in range(pages):
        page = document.new_page(width=300, height=200)
        page.draw_line(fitz.Point(20, 100), fitz.Point(280, 100))
        page.insert_text(fitz.Point(80, 92), "1.5 RD")
    payload = document.tobytes()
    document.close()
    return payload


def _ready_processor(store, job_id):
    state = store.read(job_id)
    source = store.job_dir(job_id) / "source.pdf"
    store.update(job_id, **inspect_pdf_source(source, state["page"]), status="ready",
                 stage="review", convention="iec_two_letter",
                 convention_confidence="user-selected", metrics={"paint_rate": 0.5})


class WebServiceTests(unittest.TestCase):
    def setUp(self):
        try:
            from fastapi.testclient import TestClient
        except ImportError as error:
            self.skipTest(f"web extra not installed: {error}")
        self.TestClient = TestClient
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"PINTOR_COOKIE_SECURE": "0"})
        self.env.start()
        self.app = create_app(self.temp.name, processor=_ready_processor)
        self.client = TestClient(self.app, base_url="http://testserver")

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.temp.cleanup()

    def upload(self, consent=True):
        return self.client.post(
            "/api/jobs",
            files={"file": ("diagram.pdf", _pdf_bytes(), "application/pdf")},
            data={"page": "0", "convention": "iec_two_letter",
                  "consent_learning": str(consent).lower()},
        )

    def test_rejects_a_non_pdf_even_with_pdf_mime(self):
        response = self.client.post(
            "/api/jobs", files={"file": ("fake.pdf", b"not a pdf", "application/pdf")},
            data={"page": "0", "convention": "auto"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("PDF signature", response.json()["detail"])

    def test_upload_filename_is_sanitized_before_state_and_response_headers(self):
        response = self.client.post(
            "/api/jobs",
            files={"file": ("../bad\r\nX-Test: yes.pdf", _pdf_bytes(), "application/pdf")},
            data={"page": "0", "convention": "iec_two_letter"},
        )
        self.assertEqual(response.status_code, 202)
        name = response.json()["original_name"]
        self.assertNotIn("\r", name)
        self.assertNotIn("\n", name)
        self.assertNotIn(":", name)
        self.assertNotIn("/", name)

    def test_capabilities_are_explicit_without_private_paths(self):
        response = self.client.get("/api/capabilities")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["input"], "pdf-vector-or-raster-with-visible-colour-codes")
        self.assertEqual(payload["page_modes"], ["vector-text", "raster-ocr"])
        self.assertFalse(payload["automatic_training"])
        self.assertNotIn(str(Path(self.temp.name)), response.text)

    def test_private_beta_gate_requires_code_and_sets_http_only_cookie(self):
        code = "beta-test-code"
        key_hash = __import__("hashlib").sha256(code.encode("utf-8")).hexdigest()
        with patch.dict(os.environ, {
            "PINTOR_BETA_KEY_HASH": key_hash,
            "PINTOR_SESSION_SECRET": "s" * 48,
            "PINTOR_COOKIE_SECURE": "0",
        }):
            app = create_app(Path(self.temp.name) / "protected", processor=_ready_processor)
            client = self.TestClient(app, base_url="http://testserver")
            try:
                health = client.get("/api/health")
                self.assertTrue(health.json()["access_required"])
                self.assertFalse(health.json()["authenticated"])
                denied = client.get(
                    "/api/capabilities", headers={"Origin": "https://engnata.eu"},
                )
                self.assertEqual(denied.status_code, 401)
                self.assertEqual(
                    denied.headers["access-control-allow-origin"], "https://engnata.eu",
                )
                self.assertEqual(
                    client.post("/api/access", json={"code": "wrong"}).status_code, 401,
                )
                granted = client.post("/api/access", json={"code": code})
                self.assertEqual(granted.status_code, 200)
                self.assertIn("HttpOnly", granted.headers["set-cookie"])
                self.assertEqual(client.get("/api/capabilities").status_code, 200)
                self.assertTrue(client.get("/api/health").json()["authenticated"])

                stranger = self.TestClient(app, base_url="http://testserver")
                try:
                    self.assertEqual(stranger.get("/api/capabilities").status_code, 401)
                finally:
                    stranger.close()
            finally:
                client.close()

    def test_access_attempts_are_rate_limited(self):
        key_hash = __import__("hashlib").sha256(b"correct").hexdigest()
        with patch.dict(os.environ, {
            "PINTOR_BETA_KEY_HASH": key_hash,
            "PINTOR_SESSION_SECRET": "r" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCESS_ATTEMPTS": "2",
            "PINTOR_ACCESS_WINDOW_SECONDS": "600",
        }):
            app = create_app(Path(self.temp.name) / "limited", processor=_ready_processor)
            client = self.TestClient(app, base_url="http://testserver")
            try:
                self.assertEqual(client.post("/api/access", json={"code": "a"}).status_code, 401)
                self.assertEqual(client.post("/api/access", json={"code": "b"}).status_code, 401)
                blocked = client.post("/api/access", json={"code": "correct"})
                self.assertEqual(blocked.status_code, 429)
                self.assertGreaterEqual(int(blocked.headers["retry-after"]), 1)
            finally:
                client.close()

    def test_parser_rejects_password_protected_pdf_in_worker_boundary(self):
        import fitz

        document = fitz.open()
        document.new_page()
        encrypted = document.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner-secret",
            user_pw="user-secret",
        )
        document.close()
        path = Path(self.temp.name) / "encrypted.pdf"
        path.write_bytes(encrypted)
        with self.assertRaises(InvalidUpload):
            inspect_pdf_source(path, 0)

    def test_parser_rejects_page_outside_document(self):
        path = Path(self.temp.name) / "one-page.pdf"
        path.write_bytes(_pdf_bytes())
        with self.assertRaises(InvalidUpload):
            inspect_pdf_source(path, 4)

    def test_job_is_visible_only_to_its_owner_session(self):
        created = self.upload()
        self.assertEqual(created.status_code, 202)
        job_id = created.json()["id"]
        self.assertEqual(self.client.get(f"/api/jobs/{job_id}").status_code, 200)

        stranger = self.TestClient(self.app, base_url="http://testserver")
        try:
            self.assertEqual(stranger.get(f"/api/jobs/{job_id}").status_code, 404)
        finally:
            stranger.close()

    def test_feedback_requires_typed_geometry_and_stays_pending(self):
        job_id = self.upload(consent=True).json()["id"]
        response = self.client.post(f"/api/jobs/{job_id}/feedback", json={
            "annotations": [{
                "type": "wrong-colour",
                "geometry": {"type": "point", "points": [[0.4, 0.5]]},
                "expected_code": "GN/YE",
            }],
            "request_revision": True,
            "consent_learning": True,
        })
        self.assertEqual(response.status_code, 202)
        feedback_id = response.json()["id"]
        record = Path(self.temp.name) / "training_feedback" / feedback_id / "feedback.json"
        payload = __import__("json").loads(record.read_text(encoding="utf-8"))
        self.assertFalse(payload["trainable"])
        self.assertIsNone(payload["publication_group"])
        self.assertEqual(payload["document_group_candidate"], payload["source_sha256"])
        self.assertEqual(payload["annotations"][0]["training_target"], "legend-ownership")
        self.assertEqual(payload["annotations"][0]["expect"], "painted:GN/YE")

    def test_bleed_requires_a_segment_not_a_single_point(self):
        job_id = self.upload().json()["id"]
        response = self.client.post(f"/api/jobs/{job_id}/feedback", json={
            "annotations": [{
                "type": "bleed",
                "geometry": {"type": "point", "points": [[0.4, 0.5]]},
            }]
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("segment", response.json()["detail"])

    def test_dash_feedback_is_routed_to_renderer_not_wire_classifier(self):
        job_id = self.upload(consent=True).json()["id"]
        response = self.client.post(f"/api/jobs/{job_id}/feedback", json={
            "annotations": [{
                "type": "dash-style",
                "geometry": {"type": "segment", "points": [[0.2, 0.5], [0.8, 0.5]]},
            }],
            "consent_learning": True,
        })
        self.assertEqual(response.status_code, 202)
        feedback_id = response.json()["id"]
        record_path = Path(self.temp.name) / "training_feedback" / feedback_id / "feedback.json"
        record = __import__("json").loads(record_path.read_text(encoding="utf-8"))
        annotation = record["annotations"][0]
        self.assertEqual(annotation["training_target"], "renderer-line-style")
        self.assertEqual(annotation["expect"], "preserve-dash-pattern")
        self.assertFalse(record["trainable"])

    def test_owner_can_delete_private_job_and_pending_training_copy_immediately(self):
        job_id = self.upload(consent=True).json()["id"]
        response = self.client.post(f"/api/jobs/{job_id}/feedback", json={
            "annotations": [{
                "type": "missing",
                "geometry": {"type": "point", "points": [[0.4, 0.5]]},
            }],
            "consent_learning": True,
        })
        feedback_id = response.json()["id"]
        inbox = Path(self.temp.name) / "training_feedback" / feedback_id
        self.assertTrue(inbox.is_dir())
        self.assertEqual(self.client.delete(f"/api/jobs/{job_id}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/jobs/{job_id}").status_code, 404)
        self.assertFalse(inbox.exists())

    def test_failed_preservation_gate_quarantines_result_and_hides_internal_error(self):
        store = JobStore(Path(self.temp.name) / "gate")
        state = store.create(
            _pdf_bytes(), "gate.pdf", 0, "iec_two_letter", False,
            25 * 1024 * 1024, _owner_hash("a" * 64),
        )
        report = {"declined": False, "v2": {"passed": True}, "v7": {"passed": False}}
        with patch("wirecolor.tools.paint_vector.paint_page", return_value=report) as paint_mock:
            process_job(store, state["id"])
        self.assertEqual(paint_mock.call_args.kwargs["paint_dpi"], 720)
        self.assertEqual(paint_mock.call_args.kwargs["paint_pixel_budget"], 60_000_000)
        result = store.read(state["id"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error"], "processing failed; the result was quarantined")
        self.assertIn("V7", result["internal_error"])
        self.assertNotIn("internal_error", self.client.get("/api/capabilities").text)
        self.assertFalse((store.job_dir(state["id"]) / "painted.pdf").exists())

    def test_vector_refusal_falls_back_to_raster_ocr(self):
        store = JobStore(Path(self.temp.name) / "raster-fallback")
        state = store.create(
            _pdf_bytes(), "scan.pdf", 0, "iec_two_letter", False,
            25 * 1024 * 1024, _owner_hash("b" * 64),
        )
        generated = store.job_dir(state["id"]) / "generated" / "scan_p0_raster_colored.pdf"

        def raster_report(*_args, **_kwargs):
            generated.parent.mkdir(parents=True, exist_ok=True)
            generated.write_bytes((store.job_dir(state["id"]) / "source.pdf").read_bytes())
            return {
                "declined": False,
                "processing_mode": "raster-ocr",
                "convention": "iec_two_letter",
                "convention_confidence": "user-selected",
                "v2": {"passed": True},
                "v7": {"passed": True},
                "out_pdf": str(generated),
                "runs": 4,
                "runs_painted": 2,
                "paint_rate": 0.5,
                "codes": ["RD"],
            }

        vector_report = {
            "declined": True,
            "decline_reason": "raster scan",
            "runs": 0,
            "runs_painted": 0,
        }
        with patch("wirecolor.tools.paint_vector.paint_page", return_value=vector_report), \
                patch("wirecolor.tools.paint_raster.paint_page", side_effect=raster_report) as raster:
            process_job(store, state["id"])

        result = store.read(state["id"])
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["processing_mode"], "raster-ocr")
        self.assertEqual(result["metrics"]["processing_mode"], "raster-ocr")
        self.assertEqual(raster.call_args.kwargs["convention_name"], "iec_two_letter")
        self.assertTrue((store.job_dir(state["id"]) / "painted.pdf").is_file())


if __name__ == "__main__":
    unittest.main()
