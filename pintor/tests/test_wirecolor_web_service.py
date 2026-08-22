"""Web boundary tests: upload validation, tenant isolation, feedback schema, and deletion."""
import itertools
import json
import os
import threading
import time
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
    MAX_PAGE_NUMBER,
    ProcessingQueue,
    _owner_hash,
    create_app,
    inspect_pdf_source,
    parse_page_selection,
    process_job,
    process_job_isolated,
)
from wirecolor.accounts import hash_password


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
    store.update(job_id, **inspect_pdf_source(source, state["selected_pages"]), status="ready",
                 stage="review", convention="iec_two_letter",
                 convention_confidence="user-selected", metrics={"paint_rate": 0.5})


def _write_overlay(path, width=300, height=200):
    import cv2
    import numpy as np

    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    cv2.line(rgba, (20, height // 2), (width - 20, height // 2), (0, 0, 255, 255), 3)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    self_ok = cv2.imwrite(str(path), rgba)
    if not self_ok:
        raise RuntimeError("test overlay encode failed")


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
        self.assertEqual(payload["scope"], "selected-pages-in-one-preserved-document")
        self.assertIsNone(payload["max_selected_pages"])
        self.assertIsNone(payload["max_document_pages"])
        self.assertTrue(payload["automatic_page_discovery"])
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

    def test_accounts_require_beta_access_and_password_has_four_character_minimum(self):
        code = "beta-account-code"
        key_hash = __import__("hashlib").sha256(code.encode("utf-8")).hexdigest()
        with patch.dict(os.environ, {
            "PINTOR_BETA_KEY_HASH": key_hash,
            "PINTOR_SESSION_SECRET": "a" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
        }):
            app = create_app(Path(self.temp.name) / "account-gate", processor=_ready_processor)
            client = self.TestClient(app, base_url="http://testserver")
            try:
                self.assertEqual(client.post("/api/accounts/register", json={
                    "username": "tester", "password": "1234",
                }).status_code, 401)
                self.assertEqual(client.post("/api/access", json={"code": code}).status_code, 200)
                too_short = client.post("/api/accounts/register", json={
                    "username": "tester", "password": "123",
                })
                self.assertEqual(too_short.status_code, 422)
                created = client.post("/api/accounts/register", json={
                    "username": "tester", "password": "1234",
                })
                self.assertEqual(created.status_code, 201)
                self.assertIn("HttpOnly", created.headers["set-cookie"])
                self.assertEqual(created.json()["account"]["role"], "user")
                self.assertEqual(client.get("/api/account").status_code, 200)
                self.assertEqual(client.get("/api/account/jobs").json()["jobs"], [])
                self.assertEqual(client.post("/api/accounts/logout").status_code, 204)
                self.assertEqual(client.get("/api/account").status_code, 401)
                login = client.post("/api/accounts/login", json={
                    "username": "TESTER", "password": "1234",
                })
                self.assertEqual(login.status_code, 200)
            finally:
                client.close()

    def test_account_username_is_unique_and_login_errors_are_generic(self):
        with patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "u" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
        }):
            app = create_app(Path(self.temp.name) / "account-unique", processor=_ready_processor)
            client = self.TestClient(app, base_url="http://testserver")
            try:
                self.assertEqual(client.post("/api/accounts/register", json={
                    "username": "BetaUser", "password": "abcd",
                }).status_code, 201)
                duplicate = client.post("/api/accounts/register", json={
                    "username": "betauser", "password": "wxyz",
                })
                self.assertEqual(duplicate.status_code, 409)
                client.post("/api/accounts/logout")
                missing = client.post("/api/accounts/login", json={
                    "username": "missing", "password": "abcd",
                })
                wrong = client.post("/api/accounts/login", json={
                    "username": "BetaUser", "password": "wxyz",
                })
                self.assertEqual(missing.status_code, 401)
                self.assertEqual(wrong.status_code, 401)
                self.assertEqual(missing.json()["detail"], wrong.json()["detail"])
            finally:
                client.close()

    def test_accounts_isolate_jobs_and_preserve_access_across_login_sessions(self):
        with patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "j" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
        }):
            app = create_app(Path(self.temp.name) / "account-jobs", processor=_ready_processor)
            owner = self.TestClient(app, base_url="http://testserver")
            stranger = self.TestClient(app, base_url="http://testserver")
            second_device = self.TestClient(app, base_url="http://testserver")
            try:
                owner.post("/api/accounts/register", json={
                    "username": "owner", "password": "1234",
                })
                stranger.post("/api/accounts/register", json={
                    "username": "stranger", "password": "1234",
                })
                created = owner.post(
                    "/api/jobs",
                    files={"file": ("diagram.pdf", _pdf_bytes(), "application/pdf")},
                    data={"page": "0", "convention": "iec_two_letter"},
                )
                self.assertEqual(created.status_code, 202)
                job_id = created.json()["id"]
                self.assertEqual(stranger.get(f"/api/jobs/{job_id}").status_code, 404)
                second_device.post("/api/accounts/login", json={
                    "username": "owner", "password": "1234",
                })
                self.assertEqual(second_device.get(f"/api/jobs/{job_id}").status_code, 200)
                jobs = second_device.get("/api/account/jobs").json()["jobs"]
                self.assertEqual([item["id"] for item in jobs], [job_id])
            finally:
                owner.close()
                stranger.close()
                second_device.close()

    def test_only_admin_can_review_feedback_and_acceptance_never_trains_automatically(self):
        admin_hash = hash_password("admin-test")
        root = Path(self.temp.name) / "admin-review"
        with patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "m" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
            "PINTOR_ADMIN_USERNAME": "review-admin",
            "PINTOR_ADMIN_PASSWORD_HASH": admin_hash,
        }):
            app = create_app(root, processor=_ready_processor)
            tester = self.TestClient(app, base_url="http://testserver")
            admin = self.TestClient(app, base_url="http://testserver")
            try:
                tester.post("/api/accounts/register", json={
                    "username": "reporter", "password": "1234",
                })
                created = tester.post(
                    "/api/jobs",
                    files={"file": ("diagram.pdf", _pdf_bytes(), "application/pdf")},
                    data={"page": "0", "convention": "iec_two_letter",
                          "consent_learning": "true"},
                )
                job_id = created.json()["id"]
                job_dir = root / "jobs" / job_id
                (job_dir / "painted.pdf").write_bytes(_pdf_bytes())
                (job_dir / "original-p0.jpg").write_bytes(b"original-preview")
                (job_dir / "painted-p0.jpg").write_bytes(b"painted-preview")
                report = tester.post(f"/api/jobs/{job_id}/feedback", json={
                    "annotations": [{
                        "type": "missing",
                        "geometry": {"type": "point", "points": [[0.4, 0.5]]},
                        "page": 0,
                    }],
                    "note": "wire should be coloured",
                    "consent_learning": True,
                })
                feedback_id = report.json()["id"]
                self.assertEqual(tester.get("/api/admin/feedback").status_code, 403)
                login = admin.post("/api/accounts/login", json={
                    "username": "review-admin", "password": "admin-test",
                })
                self.assertEqual(login.status_code, 200)
                queue = admin.get("/api/admin/feedback")
                self.assertEqual(queue.status_code, 200)
                self.assertEqual(queue.json()["feedback"][0]["account_username"], "reporter")
                detail = admin.get(f"/api/admin/feedback/{feedback_id}")
                self.assertEqual(detail.status_code, 200)
                self.assertEqual(
                    admin.get(
                        f"/api/admin/feedback/{feedback_id}/preview/original?page=0",
                    ).content,
                    b"original-preview",
                )
                decided = admin.post(f"/api/admin/feedback/{feedback_id}/decision", json={
                    "decision": "accepted", "note": "confirmed by expert",
                })
                self.assertEqual(decided.status_code, 200)
                payload = decided.json()["feedback"]
                self.assertEqual(payload["status"], "expert-accepted")
                self.assertTrue(payload["eligible_for_dataset"])
                self.assertFalse(payload["trainable"])
            finally:
                tester.close()
                admin.close()

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

    def test_page_notation_accepts_any_length_and_still_refuses_nonsense(self):
        self.assertEqual(parse_page_selection("40, 42, 44-46"), [39, 41, 43, 44, 45])
        # No cap on how many pages one job may paint: a whole manual is a legitimate selection.
        self.assertEqual(len(parse_page_selection("1-4000")), 4000)
        for broken in ("", "0", "46-40", "seven", f"1-{MAX_PAGE_NUMBER + 1}"):
            with self.subTest(notation=broken), self.assertRaises(InvalidUpload):
                parse_page_selection(broken)

    def test_page_notation_contract_examples(self):
        examples = {
            "1": [0],
            "12": [11],
            "92": [91],
            "1, 5, 9, 95": [0, 4, 8, 94],
            "1-5": [0, 1, 2, 3, 4],
            "2-7": [1, 2, 3, 4, 5, 6],
            "12-50": list(range(11, 50)),
            "1, 3-5, 9-11, 15": [0, 2, 3, 4, 8, 9, 10, 14],
        }
        for notation, expected in examples.items():
            with self.subTest(notation=notation):
                self.assertEqual(parse_page_selection(notation), expected)

    def test_manual_larger_than_the_old_cap_accepts_only_requested_pages(self):
        response = self.client.post(
            "/api/jobs",
            files={"file": ("large-manual.pdf", _pdf_bytes(80), "application/pdf")},
            data={"pages": "40, 42, 44, 46", "convention": "iec_two_letter"},
        )
        self.assertEqual(response.status_code, 202)
        state = self.client.get(f"/api/jobs/{response.json()['id']}").json()
        self.assertEqual(state["selected_pages"], [39, 41, 43, 45])
        self.assertEqual(state["page_count"], 80)

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
        def vector_report(*_args, **kwargs):
            _write_overlay(kwargs["overlay_path"])
            return {
                "declined": False, "v2": {"passed": True}, "runs": 1,
                "runs_painted": 1, "legends": 1,
            }

        with patch("wirecolor.tools.paint_vector.paint_page", side_effect=vector_report) \
                as paint_mock, patch(
                    "wirecolor.verify.validators.v7_preservation",
                    return_value={"passed": False},
                ):
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
        def raster_report(*_args, **kwargs):
            _write_overlay(kwargs["overlay_path"])
            return {
                "declined": False,
                "processing_mode": "raster-ocr",
                "convention": "iec_two_letter",
                "convention_confidence": "user-selected",
                "v2": {"passed": True},
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

    def test_one_job_paints_four_selected_pages_and_preserves_the_full_manual(self):
        import fitz

        store = JobStore(Path(self.temp.name) / "multi-page")
        selected = [39, 41, 43, 45]
        state = store.create(
            _pdf_bytes(60), "manual.pdf", selected, "iec_two_letter", False,
            25 * 1024 * 1024, _owner_hash("f" * 64),
        )

        def vector_report(*_args, **kwargs):
            _write_overlay(kwargs["overlay_path"])
            return {
                "declined": False,
                "processing_mode": "vector-text",
                "v2": {"passed": True},
                "legends": 1,
                "runs": 3,
                "runs_painted": 1,
                "paint_rate": 1 / 3,
                "codes": ["RD"],
                "decision_abstentions": 0,
                "seconds": 0.1,
            }

        with patch("wirecolor.tools.paint_vector.paint_page", side_effect=vector_report) as painter:
            process_job(store, state["id"])

        result = store.read(state["id"])
        self.assertEqual(result["status"], "ready")
        self.assertEqual([item["page"] for item in result["pages"]], selected)
        self.assertTrue(all(item["status"] == "painted" for item in result["pages"]))
        self.assertEqual(result["metrics"]["pages_painted"], 4)
        self.assertEqual(painter.call_count, 4)
        output = fitz.open(store.job_dir(state["id"]) / "painted.pdf")
        try:
            self.assertEqual(len(output), 60)
        finally:
            output.close()

    def test_safe_page_abstention_does_not_discard_other_selected_pages(self):
        store = JobStore(Path(self.temp.name) / "partial-multi-page")
        state = store.create(
            _pdf_bytes(4), "manual.pdf", [0, 2], "iec_two_letter", False,
            25 * 1024 * 1024, _owner_hash("e" * 64),
        )

        def vector_report(_pdf, page_index, _out, **kwargs):
            if page_index == 0:
                _write_overlay(kwargs["overlay_path"])
                return {
                    "declined": False, "v2": {"passed": True}, "legends": 1,
                    "runs": 1, "runs_painted": 1, "paint_rate": 1.0,
                }
            return {"declined": True, "legends": 1, "runs": 0, "runs_painted": 0}

        raster_decline = {
            "declined": True, "processing_mode": "raster-ocr",
            "convention": "iec_two_letter", "convention_confidence": "user-selected",
            "decline_reason": "no safe colour assignment", "runs": 0,
        }
        with patch("wirecolor.tools.paint_vector.paint_page", side_effect=vector_report), patch(
            "wirecolor.tools.paint_raster.paint_page", return_value=raster_decline,
        ):
            process_job(store, state["id"])

        result = store.read(state["id"])
        self.assertEqual(result["status"], "ready")
        self.assertEqual([item["status"] for item in result["pages"]], ["painted", "declined"])
        self.assertEqual(result["metrics"]["pages_painted"], 1)
        self.assertEqual(result["metrics"]["pages_declined"], 1)
        self.assertTrue((store.job_dir(state["id"]) / "painted-p2.jpg").is_file())

    def test_isolated_worker_reaps_native_threads_after_terminal_failure(self):
        store = JobStore(Path(self.temp.name) / "terminal-worker")
        state = store.create(
            _pdf_bytes(), "failed-a0.pdf", 0, "auto", False,
            25 * 1024 * 1024, _owner_hash("e" * 64),
        )
        store.update(state["id"], status="failed", stage="failed",
                     error="processing failed; the result was quarantined")

        class FakeWorker:
            def __init__(self):
                self.alive = True
                self.exitcode = None
                self.terminated = False

            def start(self):
                pass

            def join(self, _timeout=None):
                pass

            def is_alive(self):
                return self.alive

            def terminate(self):
                self.terminated = True
                self.alive = False
                self.exitcode = -15

        worker = FakeWorker()

        class FakeContext:
            @staticmethod
            def Process(**_kwargs):
                return worker

        # A clock that simply advances, so the test asserts the grace period rather than the
        # exact number of times the supervisor happens to read the clock.
        ticks = itertools.count(0.0, 1.0)
        with patch("multiprocessing.get_context", return_value=FakeContext()), patch(
            "wirecolor.web_service.time.monotonic", side_effect=lambda: next(ticks),
        ), patch.dict(os.environ, {"PINTOR_JOB_TIMEOUT_SECONDS": "100"}):
            process_job_isolated(store, state["id"])

        self.assertTrue(worker.terminated)
        self.assertEqual(store.read(state["id"])["status"], "failed")


class AdminConsoleTests(unittest.TestCase):
    """Account administration, self-service deletion, and curated improvement rounds."""

    def setUp(self):
        try:
            from fastapi.testclient import TestClient
        except ImportError as error:
            self.skipTest(f"web extra not installed: {error}")
        self.TestClient = TestClient
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "console"
        self.env = patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "c" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
            "PINTOR_ADMIN_USERNAME": "popov",
            "PINTOR_ADMIN_PASSWORD_HASH": hash_password("admin-test"),
        })
        self.env.start()
        self.app = create_app(self.root, processor=_ready_processor)
        self.admin = self.TestClient(self.app, base_url="http://testserver")
        self.admin.post("/api/accounts/login", json={
            "username": "popov", "password": "admin-test",
        })

    def tearDown(self):
        self.admin.close()
        self.env.stop()
        self.temp.cleanup()

    def client_for(self, username, password="1234"):
        client = self.TestClient(self.app, base_url="http://testserver")
        self.addCleanup(client.close)
        client.post("/api/accounts/register", json={
            "username": username, "password": password,
        })
        return client

    def upload_for(self, client):
        created = client.post(
            "/api/jobs",
            files={"file": ("diagram.pdf", _pdf_bytes(), "application/pdf")},
            data={"page": "0", "convention": "iec_two_letter", "consent_learning": "true"},
        )
        self.assertEqual(created.status_code, 202)
        job_id = created.json()["id"]
        job_dir = self.root / "jobs" / job_id
        (job_dir / "painted.pdf").write_bytes(_pdf_bytes())
        (job_dir / "original-p0.jpg").write_bytes(b"original-preview")
        (job_dir / "painted-p0.jpg").write_bytes(b"painted-preview")
        return job_id

    def report_for(self, client, job_id):
        report = client.post(f"/api/jobs/{job_id}/feedback", json={
            "annotations": [{
                "type": "missing",
                "geometry": {"type": "point", "points": [[0.4, 0.5]]},
                "page": 0,
            }],
            "note": "wire should be coloured",
            "consent_learning": True,
        })
        self.assertEqual(report.status_code, 202)
        return report.json()["id"]

    def find_account(self, username):
        listing = self.admin.get("/api/admin/accounts")
        self.assertEqual(listing.status_code, 200)
        for account in listing.json()["accounts"]:
            if account["username"] == username:
                return account
        raise AssertionError(f"{username} is not listed")

    def test_account_listing_counts_jobs_and_reports_and_is_admin_only(self):
        tester = self.client_for("reporter")
        job_id = self.upload_for(tester)
        self.report_for(tester, job_id)
        self.assertEqual(tester.get("/api/admin/accounts").status_code, 403)
        account = self.find_account("reporter")
        self.assertEqual(account["role"], "user")
        self.assertEqual(account["status"], "active")
        self.assertEqual(account["job_count"], 1)
        self.assertEqual(account["report_count"], 1)
        self.assertEqual(account["pending_count"], 1)
        self.assertFalse(account["is_self"])
        self.assertTrue(self.find_account("popov")["is_self"])

    def test_suspended_account_loses_its_session_and_can_be_reactivated(self):
        tester = self.client_for("suspendable")
        account = self.find_account("suspendable")
        suspended = self.admin.post(
            f"/api/admin/accounts/{account['id']}/status", json={"status": "suspended"},
        )
        self.assertEqual(suspended.status_code, 200)
        self.assertEqual(tester.get("/api/account").status_code, 401)
        blocked = tester.post("/api/accounts/login", json={
            "username": "suspendable", "password": "1234",
        })
        self.assertEqual(blocked.status_code, 403)
        self.admin.post(
            f"/api/admin/accounts/{account['id']}/status", json={"status": "active"},
        )
        self.assertEqual(
            tester.post("/api/accounts/login", json={
                "username": "suspendable", "password": "1234",
            }).status_code,
            200,
        )

    def test_administrator_cannot_suspend_demote_or_delete_itself(self):
        popov = self.find_account("popov")
        self.assertEqual(self.admin.post(
            f"/api/admin/accounts/{popov['id']}/status", json={"status": "suspended"},
        ).status_code, 400)
        self.assertEqual(self.admin.post(
            f"/api/admin/accounts/{popov['id']}/role", json={"role": "user"},
        ).status_code, 400)
        self.assertEqual(
            self.admin.delete(f"/api/admin/accounts/{popov['id']}").status_code, 400,
        )

    def test_promotion_grants_the_console_and_demotion_takes_it_back(self):
        helper = self.client_for("helper")
        account = self.find_account("helper")
        self.assertEqual(self.admin.post(
            f"/api/admin/accounts/{account['id']}/role", json={"role": "admin"},
        ).json()["account"]["role"], "admin")
        # The role change revoked the old cookie, so the new powers need a fresh sign-in.
        self.assertEqual(helper.get("/api/admin/accounts").status_code, 401)
        helper.post("/api/accounts/login", json={"username": "helper", "password": "1234"})
        self.assertEqual(helper.get("/api/admin/accounts").status_code, 200)
        self.admin.post(f"/api/admin/accounts/{account['id']}/role", json={"role": "user"})
        helper.post("/api/accounts/login", json={"username": "helper", "password": "1234"})
        self.assertEqual(helper.get("/api/admin/accounts").status_code, 403)

    def test_admin_deletion_erases_the_account_jobs_and_pending_training_copies(self):
        tester = self.client_for("removable")
        job_id = self.upload_for(tester)
        self.report_for(tester, job_id)
        account = self.find_account("removable")
        self.assertTrue((self.root / "jobs" / job_id).is_dir())
        self.assertTrue(any(self.root.joinpath("training_feedback").iterdir()))
        self.assertEqual(
            self.admin.delete(f"/api/admin/accounts/{account['id']}").status_code, 204,
        )
        self.assertFalse((self.root / "jobs" / job_id).is_dir())
        self.assertFalse(any(self.root.joinpath("training_feedback").iterdir()))
        self.assertEqual(tester.get("/api/account").status_code, 401)
        with self.assertRaises(AssertionError):
            self.find_account("removable")

    def test_owner_lists_and_deletes_only_its_own_painted_documents(self):
        first = self.client_for("owner-one")
        second = self.client_for("owner-two")
        mine = self.upload_for(first)
        theirs = self.upload_for(second)
        listing = first.get("/api/account/jobs")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual([job["id"] for job in listing.json()["jobs"]], [mine])
        self.assertEqual(first.delete(f"/api/jobs/{theirs}").status_code, 404)
        self.assertEqual(first.delete(f"/api/jobs/{mine}").status_code, 204)
        self.assertEqual(first.get("/api/account/jobs").json()["jobs"], [])
        self.assertEqual(second.get("/api/account/jobs").json()["jobs"][0]["id"], theirs)

    def test_self_service_deletion_needs_the_password_and_removes_every_document(self):
        tester = self.client_for("closer")
        job_id = self.upload_for(tester)
        self.report_for(tester, job_id)
        wrong = tester.request("DELETE", "/api/account", json={"password": "not-the-password"})
        self.assertEqual(wrong.status_code, 401)
        self.assertTrue((self.root / "jobs" / job_id).is_dir())
        closed = tester.request("DELETE", "/api/account", json={"password": "1234"})
        self.assertEqual(closed.status_code, 204)
        self.assertFalse((self.root / "jobs" / job_id).is_dir())
        self.assertFalse(any(self.root.joinpath("training_feedback").iterdir()))
        self.assertEqual(tester.get("/api/account").status_code, 401)
        self.assertEqual(
            tester.post("/api/accounts/login", json={
                "username": "closer", "password": "1234",
            }).status_code,
            401,
        )

    def test_accepted_reports_join_the_open_round_and_closing_writes_an_offline_manifest(self):
        tester = self.client_for("round-reporter")
        job_id = self.upload_for(tester)
        feedback_id = self.report_for(tester, job_id)
        created = self.admin.post("/api/admin/rounds", json={"name": "Round 1 - raster"})
        self.assertEqual(created.status_code, 201)
        round_id = created.json()["round"]["id"]
        self.assertEqual(
            self.admin.post("/api/admin/rounds", json={"name": "second"}).status_code, 409,
        )
        self.admin.post(f"/api/admin/feedback/{feedback_id}/decision", json={
            "decision": "accepted", "note": "confirmed",
        })
        detail = self.admin.get(f"/api/admin/rounds/{round_id}").json()["round"]
        self.assertEqual([item["id"] for item in detail["items"]], [feedback_id])
        self.assertEqual(detail["items"][0]["round_id"], round_id)
        # Reversing the decision takes the report back out of the batch.
        self.admin.post(f"/api/admin/feedback/{feedback_id}/decision", json={
            "decision": "needs-clarification", "note": "which wire?",
        })
        self.assertEqual(
            self.admin.get(f"/api/admin/rounds/{round_id}").json()["round"]["items"], [],
        )
        self.admin.post(f"/api/admin/feedback/{feedback_id}/decision", json={
            "decision": "accepted", "note": "confirmed",
        })
        closed = self.admin.post(f"/api/admin/rounds/{round_id}/close", json={
            "note": "ready for offline curation",
        })
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.json()["round"]["status"], "closed")
        manifest = json.loads(
            (self.root / "improvement_rounds" / f"{round_id}-manifest.json")
            .read_text(encoding="utf-8")
        )
        self.assertFalse(manifest["automatic_training"])
        self.assertEqual(manifest["reports"][0]["id"], feedback_id)
        self.assertIn("source.pdf", manifest["reports"][0]["artifacts_present"])
        # A closed round is a snapshot: it accepts no further members.
        self.assertEqual(self.admin.post(f"/api/admin/rounds/{round_id}/items", json={
            "feedback_id": feedback_id, "include": False,
        }).status_code, 409)
        self.assertEqual(self.admin.post(f"/api/admin/rounds/{round_id}/close", json={
            "note": "",
        }).status_code, 409)

    def test_only_accepted_reports_can_be_added_by_hand_and_rounds_are_admin_only(self):
        tester = self.client_for("manual-reporter")
        job_id = self.upload_for(tester)
        feedback_id = self.report_for(tester, job_id)
        round_id = self.admin.post(
            "/api/admin/rounds", json={"name": "manual"},
        ).json()["round"]["id"]
        self.assertEqual(tester.get("/api/admin/rounds").status_code, 403)
        self.assertEqual(self.admin.post(f"/api/admin/rounds/{round_id}/items", json={
            "feedback_id": feedback_id, "include": True,
        }).status_code, 409)
        self.admin.post(f"/api/admin/feedback/{feedback_id}/decision", json={
            "decision": "rejected", "note": "not a wire",
        })
        self.assertEqual(self.admin.post(f"/api/admin/rounds/{round_id}/items", json={
            "feedback_id": feedback_id, "include": True,
        }).status_code, 409)


class DiscoveryAndQueueTests(unittest.TestCase):
    """Whole-document sweeps, the single painting slot, and what a returning owner sees."""

    def setUp(self):
        try:
            from fastapi.testclient import TestClient
        except ImportError as error:
            self.skipTest(f"web extra not installed: {error}")
        self.TestClient = TestClient
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "sweep"

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def manual_bytes(wiring_pages=(2, 4), total=6):
        import fitz

        document = fitz.open()
        codes = ["1.5 RD", "2.5 BK", "0.75 BN", "1.0 BU", "1.5 GN",
                 "2.5 YE", "1.0 GY", "0.75 WH", "1.5 OG", "2.5 VT"]
        for index in range(total):
            page = document.new_page(width=595, height=842)
            if index in wiring_pages:
                page.insert_text(fitz.Point(40, 40), "Wiring diagram", fontsize=13)
                for row, code in enumerate(codes):
                    page.draw_line(fitz.Point(150, 80 + row * 22), fitz.Point(520, 80 + row * 22))
                    page.insert_text(fitz.Point(60, 84 + row * 22), code, fontsize=9)
            else:
                for row in range(12):
                    page.insert_text(fitz.Point(40, 90 + row * 16),
                                     "General maintenance of the engine assembly.", fontsize=9)
        payload = document.tobytes()
        document.close()
        return payload

    def test_sweep_finds_the_wiring_pages_and_leaves_the_prose_alone(self):
        from wirecolor.tools.discover_pages import scan_document

        source = Path(self.temp.name) / "manual.pdf"
        source.write_bytes(self.manual_bytes())
        report = scan_document(source)
        self.assertEqual(report["page_count"], 6)
        self.assertEqual(report["confirmed"], [2, 4])
        self.assertEqual(report["selected"], [2, 4])
        self.assertTrue(report["wiring_document"])

    def test_a_document_without_wire_codes_is_declined_not_painted(self):
        from wirecolor.tools.discover_pages import scan_document

        source = Path(self.temp.name) / "prose.pdf"
        source.write_bytes(self.manual_bytes(wiring_pages=(), total=3))
        self.assertEqual(scan_document(source)["selected"], [])

        store = JobStore(self.root / "prose-job")
        state = store.create(source.read_bytes(), "prose.pdf", [], "auto", False,
                             25 * 1024 * 1024, _owner_hash("a" * 64))
        self.assertEqual(state["page_discovery"], "auto")
        process_job(store, state["id"])
        result = store.read(state["id"])
        self.assertEqual(result["status"], "declined")
        self.assertEqual(result["stage"], "no-wiring-page")
        self.assertEqual(result["discovery"]["pages_scanned"], 3)

    def test_an_upload_without_a_page_selection_paints_every_diagram_it_finds(self):
        store = JobStore(self.root / "sweep-job")
        state = store.create(self.manual_bytes(), "manual.pdf", [], "auto", False,
                             25 * 1024 * 1024, _owner_hash("b" * 64))
        self.assertEqual(state["selected_pages"], [])

        def vector_report(*_args, **kwargs):
            _write_overlay(kwargs["overlay_path"], width=595, height=842)
            return {
                "declined": False, "processing_mode": "vector-text", "v2": {"passed": True},
                "legends": 1, "runs": 3, "runs_painted": 2, "paint_rate": 2 / 3,
                "codes": ["RD"], "decision_abstentions": 0, "seconds": 0.1,
            }

        with patch("wirecolor.tools.paint_vector.paint_page", side_effect=vector_report) as painter:
            process_job(store, state["id"])

        result = store.read(state["id"])
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["selected_pages"], [2, 4])
        self.assertEqual(painter.call_count, 2)
        self.assertEqual(result["discovery"]["confirmed"], 2)
        self.assertEqual(result["metrics"]["pages_painted"], 2)
        self.assertTrue(result["finished_at"])

    def test_the_queue_grants_the_single_slot_in_arrival_order(self):
        queue = ProcessingQueue(slots=1)
        self.assertEqual(queue.enqueue("first"), 1)
        self.assertEqual(queue.enqueue("second"), 2)
        self.assertEqual(queue.enqueue("third"), 3)
        queue.acquire("first")
        self.assertEqual(queue.position("first"), 0)
        self.assertEqual(queue.position("second"), 1)

        started = []
        blocked = threading.Thread(target=lambda: (queue.acquire("second"), started.append("second")))
        blocked.start()
        blocked.join(timeout=0.5)
        # "second" cannot start while "first" holds the only slot.
        self.assertEqual(started, [])
        queue.release("first")
        blocked.join(timeout=5)
        self.assertEqual(started, ["second"])
        queue.release("second")
        queue.forget("third")
        self.assertEqual(queue.snapshot(), {"running": [], "waiting": []})

    def test_several_files_queue_behind_each_other_and_report_their_place(self):
        order = []
        gate = threading.Event()

        def slow_processor(store, job_id):
            order.append(job_id)
            gate.wait(timeout=10)
            store.update(job_id, status="ready", stage="review", finished_at=1)

        env = patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "q" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
        })
        env.start()
        self.addCleanup(env.stop)
        app = create_app(self.root / "queued", processor=slow_processor)
        client = self.TestClient(app, base_url="http://testserver")
        self.addCleanup(client.close)
        client.post("/api/accounts/register", json={"username": "batch", "password": "1234"})

        # TestClient runs a background task inline, so the second upload has to be posted from
        # another thread to observe the queue at all.
        results = {}

        def upload(name):
            results[name] = client.post(
                "/api/jobs",
                files={"file": (name, _pdf_bytes(), "application/pdf")},
                data={"page": "0", "convention": "iec_two_letter"},
            ).json()

        first = threading.Thread(target=upload, args=("one.pdf",))
        first.start()
        for _ in range(100):
            if order:
                break
            time.sleep(0.05)
        self.assertEqual(len(order), 1)
        second = threading.Thread(target=upload, args=("two.pdf",))
        second.start()
        time.sleep(0.5)
        self.assertEqual(len(order), 1, "the second file must wait for the single slot")
        gate.set()
        first.join(timeout=10)
        second.join(timeout=10)
        self.assertEqual(len(order), 2)
        listing = client.get("/api/account/jobs").json()
        self.assertEqual(len(listing["jobs"]), 2)
        self.assertEqual(listing["active"], 0)

    def test_a_returning_owner_sees_what_finished_while_they_were_away(self):
        env = patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "r" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
        })
        env.start()
        self.addCleanup(env.stop)
        app = create_app(self.root / "returning", processor=_ready_processor)
        client = self.TestClient(app, base_url="http://testserver")
        self.addCleanup(client.close)
        registered = client.post(
            "/api/accounts/register", json={"username": "away", "password": "1234"},
        ).json()["account"]
        for name in ("old.pdf", "fresh.pdf"):
            client.post(
                "/api/jobs",
                files={"file": (name, _pdf_bytes(), "application/pdf")},
                data={"page": "0", "convention": "iec_two_letter"},
            )
        store = app.state.store
        visit = registered["last_login_at"]
        by_name = {record["original_name"]: record["id"] for record in store.list_all()}
        # One conversion landed before the owner left, the other while they were away.
        store.update(by_name["old.pdf"], finished_at=visit - 60)
        store.update(by_name["fresh.pdf"], finished_at=visit + 60)

        client.post("/api/accounts/logout")
        client.post("/api/accounts/login", json={"username": "away", "password": "1234"})
        listing = client.get("/api/account/jobs").json()
        self.assertEqual(listing["since"], visit)
        self.assertEqual(listing["active"], 0)
        flags = {job["original_name"]: job["finished_since_last_login"]
                 for job in listing["jobs"]}
        self.assertEqual(flags, {"old.pdf": False, "fresh.pdf": True})


class LargeManualTests(unittest.TestCase):
    """A 200 MB manual kept for good: streamed in, quota-bounded, supervised by progress."""

    def setUp(self):
        try:
            from fastapi.testclient import TestClient
        except ImportError as error:
            self.skipTest(f"web extra not installed: {error}")
        self.TestClient = TestClient
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "large"
        self.env = patch.dict(os.environ, {
            "PINTOR_SESSION_SECRET": "l" * 48,
            "PINTOR_COOKIE_SECURE": "0",
            "PINTOR_ACCOUNTS_REQUIRED": "1",
        })
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def signed_in(self, app, username="owner"):
        client = self.TestClient(app, base_url="http://testserver")
        self.addCleanup(client.close)
        client.post("/api/accounts/register", json={"username": username, "password": "1234"})
        return client

    def test_upload_is_streamed_to_disk_and_keeps_its_bytes_and_digest(self):
        import hashlib

        app = create_app(self.root / "streamed", processor=_ready_processor)
        client = self.signed_in(app)
        payload = _pdf_bytes(40)
        # Larger than one read chunk would be if the endpoint still slurped the whole body.
        created = client.post(
            "/api/jobs",
            files={"file": ("manual.pdf", payload, "application/pdf")},
            data={"page": "0", "convention": "iec_two_letter"},
        )
        self.assertEqual(created.status_code, 202)
        state = app.state.store.read(created.json()["id"])
        self.assertEqual(state["source_bytes"], len(payload))
        self.assertEqual(state["source_sha256"], hashlib.sha256(payload).hexdigest())
        stored = app.state.store.job_dir(state["id"]) / "source.pdf"
        self.assertEqual(stored.read_bytes(), payload)
        # Nothing is left behind in the staging area.
        staging = app.state.store.root / "incoming"
        self.assertFalse(staging.is_dir() and any(staging.iterdir()))

    def test_a_file_over_the_limit_is_refused_without_being_kept(self):
        with patch.dict(os.environ, {"PINTOR_MAX_UPLOAD_MB": "1"}):
            app = create_app(self.root / "too-big", processor=_ready_processor)
            client = self.signed_in(app)
            oversized = _pdf_bytes(1) + b"\0" * (2 * 1024 * 1024)
            response = client.post(
                "/api/jobs",
                files={"file": ("huge.pdf", oversized, "application/pdf")},
                data={"page": "0", "convention": "auto"},
            )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(app.state.store.list_all(), [])
        staging = app.state.store.root / "incoming"
        self.assertFalse(staging.is_dir() and any(staging.iterdir()))

    def test_only_a_manual_shared_for_improvement_outlives_the_retention_window(self):
        store = JobStore(self.root / "retention")
        self.assertEqual(store.retention_seconds, 24 * 3600)
        session = "ab" * 32
        owner = _owner_hash(session)
        plain = store.create(_pdf_bytes(), "plain.pdf", [0], "auto", True,
                             25 * 1024 * 1024, owner,
                             account={"id": "acc-1", "username": "keeper"})
        shared = store.create(_pdf_bytes(), "shared.pdf", [0], "auto", True,
                              25 * 1024 * 1024, owner,
                              account={"id": "acc-1", "username": "keeper"})
        for job in (plain, shared):
            store.update(job["id"], **inspect_pdf_source(
                store.job_dir(job["id"]) / "source.pdf", [0]), status="ready", stage="review")

        # Marking an error and agreeing to share it is what makes a manual worth keeping.
        store.add_feedback(shared["id"], {
            "annotations": [{
                "type": "missing",
                "geometry": {"type": "point", "points": [[0.4, 0.5]]},
                "page": 0,
            }],
            "note": "this wire should be coloured",
            "consent_learning": True,
        }, session)

        long_ago = int(time.time()) - 40 * 3600
        for job_id in (plain["id"], shared["id"]):
            path = store.job_dir(job_id) / "state.json"
            record = json.loads(path.read_text(encoding="utf-8"))
            record["updated_at"] = long_ago
            path.write_text(json.dumps(record), encoding="utf-8")

        self.assertEqual(store.cleanup_expired(), 1)
        self.assertFalse(store.job_dir_exists(plain["id"]))
        self.assertTrue((store.job_dir(shared["id"]) / "source.pdf").is_file())
        self.assertEqual([record["id"] for record in store.list_all()], [shared["id"]])

    def test_a_report_kept_without_consent_does_not_keep_the_manual(self):
        store = JobStore(self.root / "no-consent")
        session = "cd" * 32
        owner = _owner_hash(session)
        job = store.create(_pdf_bytes(), "quiet.pdf", [0], "auto", False,
                           25 * 1024 * 1024, owner)
        store.update(job["id"], **inspect_pdf_source(
            store.job_dir(job["id"]) / "source.pdf", [0]), status="ready", stage="review")
        store.add_feedback(job["id"], {
            "annotations": [{
                "type": "missing",
                "geometry": {"type": "point", "points": [[0.4, 0.5]]},
                "page": 0,
            }],
            "note": "reported but not shared",
            "consent_learning": True,
        }, session)
        # The job was uploaded without learning consent, so the report cannot grant it.
        self.assertEqual(store.shared_job_ids(), set())
        path = store.job_dir(job["id"]) / "state.json"
        record = json.loads(path.read_text(encoding="utf-8"))
        record["updated_at"] = int(time.time()) - 40 * 3600
        path.write_text(json.dumps(record), encoding="utf-8")
        self.assertEqual(store.cleanup_expired(), 1)
        self.assertEqual(store.list_all(), [])

    def test_an_account_over_its_storage_quota_is_asked_to_make_room(self):
        with patch.dict(os.environ, {"PINTOR_MAX_ACCOUNT_STORAGE_MB": "1"}):
            app = create_app(self.root / "quota", processor=_ready_processor)
            client = self.signed_in(app)
            filler = _pdf_bytes(1) + b"\0" * (900 * 1024)
            first = client.post(
                "/api/jobs",
                files={"file": ("first.pdf", filler, "application/pdf")},
                data={"page": "0", "convention": "auto"},
            )
            self.assertEqual(first.status_code, 202)
            second = client.post(
                "/api/jobs",
                files={"file": ("second.pdf", filler, "application/pdf")},
                data={"page": "0", "convention": "auto"},
            )
            self.assertEqual(second.status_code, 400)
            self.assertIn("storage", second.json()["detail"])
            listing = client.get("/api/account/jobs").json()
            self.assertEqual(listing["retention_hours"], 24)
            self.assertGreater(listing["storage_used_bytes"], 0)
            self.assertEqual(listing["storage_limit_bytes"], 1024 * 1024)
            # Deleting the first manual makes room again.
            client.delete(f"/api/jobs/{first.json()['id']}")
            third = client.post(
                "/api/jobs",
                files={"file": ("third.pdf", filler, "application/pdf")},
                data={"page": "0", "convention": "auto"},
            )
            self.assertEqual(third.status_code, 202)

    def test_a_page_preview_the_worker_skipped_is_rendered_on_first_view(self):
        with patch.dict(os.environ, {"PINTOR_EAGER_PREVIEWS": "0"}):
            app = create_app(self.root / "lazy", processor=_ready_processor)
            client = self.signed_in(app)
            created = client.post(
                "/api/jobs",
                files={"file": ("manual.pdf", _pdf_bytes(3), "application/pdf")},
                data={"pages": "1", "convention": "iec_two_letter"},
            )
            job_id = created.json()["id"]
            directory = app.state.store.job_dir(job_id)
            self.assertFalse((directory / "original-p0.jpg").is_file())
            response = client.get(f"/api/jobs/{job_id}/preview/original?page=0")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["content-type"], "image/jpeg")
            self.assertTrue((directory / "original-p0.jpg").is_file())

    def test_a_long_job_survives_as_long_as_it_keeps_reporting_progress(self):
        store = JobStore(self.root / "supervised")
        state = store.create(_pdf_bytes(), "long.pdf", [0], "auto", False,
                             25 * 1024 * 1024, _owner_hash("p" * 64))
        job_id = state["id"]
        clock = itertools.count(0.0, 60.0)

        class FakeWorker:
            def __init__(self):
                self.alive = True
                self.exitcode = 0
                self.terminated = False
                self.polls = 0

            def start(self):
                pass

            def join(self, _timeout=None):
                self.polls += 1
                if self.polls <= 8:
                    # A healthy long job: every poll it has moved on to another page.
                    store.update(job_id, completed_pages=self.polls, current_page=self.polls)
                if self.polls >= 12:
                    store.update(job_id, status="ready", stage="review")
                    self.alive = False

            def is_alive(self):
                return self.alive

            def terminate(self):
                self.terminated = True
                self.alive = False
                self.exitcode = -15

        worker = FakeWorker()

        class FakeContext:
            @staticmethod
            def Process(**_kwargs):
                return worker

        with patch("multiprocessing.get_context", return_value=FakeContext()), patch(
            "wirecolor.web_service.time.monotonic", side_effect=lambda: next(clock),
        ), patch.dict(os.environ, {
            "PINTOR_JOB_MAX_SECONDS": "100000",
            "PINTOR_JOB_STALL_SECONDS": "900",
        }, clear=False):
            os.environ.pop("PINTOR_JOB_TIMEOUT_SECONDS", None)
            process_job_isolated(store, job_id)

        # Fifteen simulated minutes of real work is not a hang: nothing was killed.
        self.assertFalse(worker.terminated)
        self.assertEqual(store.read(job_id)["status"], "ready")

    def test_a_job_that_stops_moving_is_killed_as_stalled(self):
        store = JobStore(self.root / "stalled")
        state = store.create(_pdf_bytes(), "stuck.pdf", [0], "auto", False,
                             25 * 1024 * 1024, _owner_hash("q" * 64))
        job_id = state["id"]
        store.update(job_id, status="processing", stage="tracing-conductors")
        clock = itertools.count(0.0, 60.0)

        class FrozenWorker:
            def __init__(self):
                self.alive = True
                self.exitcode = None
                self.terminated = False

            def start(self):
                pass

            def join(self, _timeout=None):
                pass

            def is_alive(self):
                return self.alive

            def terminate(self):
                self.terminated = True
                self.alive = False
                self.exitcode = -15

        worker = FrozenWorker()

        class FakeContext:
            @staticmethod
            def Process(**_kwargs):
                return worker

        with patch("multiprocessing.get_context", return_value=FakeContext()), patch(
            "wirecolor.web_service.time.monotonic", side_effect=lambda: next(clock),
        ), patch.dict(os.environ, {
            "PINTOR_JOB_MAX_SECONDS": "100000",
            "PINTOR_JOB_STALL_SECONDS": "600",
        }, clear=False):
            os.environ.pop("PINTOR_JOB_TIMEOUT_SECONDS", None)
            process_job_isolated(store, job_id)

        self.assertTrue(worker.terminated)
        result = store.read(job_id)
        self.assertEqual(result["status"], "failed")
        self.assertIn("ProcessingStalled", result["error"])


if __name__ == "__main__":
    unittest.main()
