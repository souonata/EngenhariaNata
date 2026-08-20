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
    MAX_SELECTED_PAGES,
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
        self.assertEqual(payload["max_selected_pages"], MAX_SELECTED_PAGES)
        self.assertGreater(payload["max_document_pages"], 50)
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

    def test_page_notation_accepts_commas_ranges_and_rejects_oversized_selection(self):
        self.assertEqual(parse_page_selection("40, 42, 44-46"), [39, 41, 43, 44, 45])
        with self.assertRaises(InvalidUpload):
            parse_page_selection(f"1-{MAX_SELECTED_PAGES + 1}")

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

    def test_manual_over_50_pages_accepts_only_requested_pages(self):
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

        with patch("multiprocessing.get_context", return_value=FakeContext()), patch(
            "wirecolor.web_service.time.monotonic",
            side_effect=[0.0, 1.0, 2.0, 2.0, 3.0, 7.0],
        ), patch.dict(os.environ, {"PINTOR_JOB_TIMEOUT_SECONDS": "100"}):
            process_job_isolated(store, state["id"])

        self.assertTrue(worker.terminated)
        self.assertEqual(store.read(state["id"])["status"], "failed")


if __name__ == "__main__":
    unittest.main()
