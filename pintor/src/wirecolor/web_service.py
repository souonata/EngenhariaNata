"""Private-job web API for the Pintor beta.

The browser uploads one PDF and receives only random-id URLs for the painted page, previews, and
review submission. Source files remain outside the served Engenharia NATA tree. Human feedback is
copied into the training inbox only after explicit consent; a single review never changes the
production model directly.
"""
import hashlib
import hmac
import ipaddress
import json
import os
import re
import shutil
import threading
import time
import uuid
import math
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable


PACKAGE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WORKSPACE = PACKAGE_ROOT / "workspaces" / "web"
JOB_ID_RE = re.compile(r"^[a-f0-9]{32}$")
SESSION_RE = re.compile(r"^[a-f0-9]{64}$")
COLOUR_CODE_RE = re.compile(r"^[A-Z]{1,3}(?:/[A-Z]{1,3})?$")
ERROR_TYPES = frozenset({
    "wrong-colour", "non-wire", "stops-mid", "missing", "bleed",
    "dash-style", "stripe-style",
})
MAX_PAGES = 50
MAX_PAGE_SIDE_PT = 12_000
MAX_PAGE_AREA_PT2 = 24_000_000
ANALYSIS_DPI = 200
MAX_ANALYSIS_PIXELS = 75_000_000
BETA_COOKIE = "pintor_beta"
BETA_COOKIE_PURPOSE = b"pintor-beta-access-v1"


class JobNotFound(KeyError):
    """Raised when a random job id does not resolve inside the workspace."""


class InvalidUpload(ValueError):
    """Raised when an upload is not a safe, readable PDF."""


class SlidingWindowLimiter:
    """Small in-process limiter for the single-worker private beta API."""

    def __init__(self):
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, math.ceil(events[0] + window_seconds - now))
                return False, retry_after
            events.append(now)
            return True, 0


def _beta_cookie_token(secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), BETA_COOKIE_PURPOSE, hashlib.sha256).hexdigest()


def _atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def _safe_name(name: str | None) -> str:
    # Browsers normally send a basename, but never trust it for response headers or UI text.
    candidate = (name or "diagram.pdf").replace("\\", "/").rsplit("/", 1)[-1]
    candidate = re.sub(r"[^A-Za-z0-9._ -]+", "_", candidate).strip(" .")
    return candidate[:120] or "diagram.pdf"


def _owner_hash(session_id: str) -> str:
    return hashlib.sha256(session_id.encode("ascii")).hexdigest()


def _public_state(state: dict) -> dict:
    allowed = {
        "id", "status", "stage", "original_name", "page", "page_count", "convention",
        "requested_convention", "convention_confidence", "created_at", "updated_at", "metrics",
        "processing_mode", "decline_reason", "error", "preview_original", "preview_painted",
        "download", "feedback_id",
    }
    return {key: state[key] for key in allowed if key in state}


class JobStore:
    """Filesystem-backed beta job store with random, path-safe identifiers."""

    def __init__(self, root: str | Path = DEFAULT_WORKSPACE, retention_hours: int = 24):
        self.root = Path(root).resolve()
        self.jobs = self.root / "jobs"
        self.training = self.root / "training_feedback"
        self.retention_seconds = max(1, retention_hours) * 3600
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.training.mkdir(parents=True, exist_ok=True)

    def job_dir(self, job_id: str) -> Path:
        if not JOB_ID_RE.fullmatch(job_id):
            raise JobNotFound(job_id)
        path = (self.jobs / job_id).resolve()
        if path.parent != self.jobs:
            raise JobNotFound(job_id)
        if not path.is_dir():
            raise JobNotFound(job_id)
        return path

    def read(self, job_id: str) -> dict:
        path = self.job_dir(job_id) / "state.json"
        if not path.is_file():
            raise JobNotFound(job_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def read_owned(self, job_id: str, session_id: str | None) -> dict:
        if not session_id or not SESSION_RE.fullmatch(session_id):
            raise JobNotFound(job_id)
        state = self.read(job_id)
        if state.get("owner_hash") != _owner_hash(session_id):
            raise JobNotFound(job_id)
        return state

    def update(self, job_id: str, **changes) -> dict:
        state = self.read(job_id)
        state.update(changes)
        state["updated_at"] = int(time.time())
        _atomic_json(self.job_dir(job_id) / "state.json", state)
        return state

    def create(self, content: bytes, filename: str | None, page: int, convention: str,
               consent_learning: bool, max_bytes: int, owner_hash: str,
               max_storage_bytes: int = 0) -> dict:
        if not content or len(content) > max_bytes:
            raise InvalidUpload("PDF is empty or exceeds the upload limit")
        if not content.startswith(b"%PDF-"):
            raise InvalidUpload("file does not have a PDF signature")
        self.cleanup_expired()
        if max_storage_bytes:
            used = 0
            for path in self.root.rglob("*"):
                try:
                    if path.is_file():
                        used += path.stat().st_size
                except OSError:
                    continue
            if used + len(content) > max_storage_bytes:
                raise InvalidUpload("private beta storage is temporarily full")
        active = 0
        for state_path in self.jobs.glob("*/state.json"):
            try:
                existing = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if existing.get("owner_hash") == owner_hash \
                    and existing.get("status") in {"queued", "processing"}:
                active += 1
        if active >= 2:
            raise InvalidUpload("this beta session already has two active jobs")

        job_id = uuid.uuid4().hex
        directory = self.jobs / job_id
        directory.mkdir(mode=0o700)
        source = directory / "source.pdf"
        source.write_bytes(content)

        now = int(time.time())
        state = {
            "id": job_id,
            "status": "queued",
            "stage": "queued",
            "original_name": _safe_name(filename),
            "page": page,
            "requested_convention": convention,
            "consent_learning": bool(consent_learning),
            "source_sha256": hashlib.sha256(content).hexdigest(),
            "owner_hash": owner_hash,
            "created_at": now,
            "updated_at": now,
        }
        _atomic_json(directory / "state.json", state)
        return state

    def artifact(self, job_id: str, name: str, session_id: str | None = None) -> Path:
        if name not in {"original.jpg", "painted.jpg", "painted.pdf"}:
            raise JobNotFound(job_id)
        if session_id is not None:
            self.read_owned(job_id, session_id)
        path = self.job_dir(job_id) / name
        if not path.is_file():
            raise JobNotFound(job_id)
        return path

    def add_feedback(self, job_id: str, payload: dict, session_id: str | None = None) -> dict:
        state = self.read_owned(job_id, session_id) if session_id is not None else self.read(job_id)
        if state.get("status") not in {"ready", "revision-requested"}:
            raise ValueError("job is not ready for review")

        annotations = normalize_annotations(payload.get("annotations"), state)
        if not annotations:
            raise ValueError("at least one annotation is required")

        feedback_id = uuid.uuid4().hex
        record = {
            "id": feedback_id,
            "job_id": job_id,
            "source_sha256": state["source_sha256"],
            "document_group_candidate": state["source_sha256"],
            "publication_group": None,
            "page": state["page"],
            "convention": state.get("convention"),
            "annotations": annotations,
            "note": str(payload.get("note") or "").strip()[:2000],
            "request_revision": bool(payload.get("request_revision", True)),
            "consent_learning": bool(payload.get("consent_learning", False)
                                     and state.get("consent_learning", False)),
            "created_at": int(time.time()),
            "status": "queued-for-review",
            "trainable": False,
        }
        feedback_dir = self.job_dir(job_id) / "feedback"
        _atomic_json(feedback_dir / f"{feedback_id}.json", record)

        if record["consent_learning"]:
            inbox = self.training / feedback_id
            inbox.mkdir(mode=0o700)
            shutil.copyfile(self.job_dir(job_id) / "source.pdf", inbox / "source.pdf")
            _atomic_json(inbox / "feedback.json", record)

        self.update(job_id, status="revision-requested", stage="human-review",
                    feedback_id=feedback_id)
        return record

    def cleanup_expired(self, now: int | None = None) -> int:
        threshold = (now or int(time.time())) - self.retention_seconds
        removed = 0
        for directory in self.jobs.iterdir():
            state_path = directory / "state.json"
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if state.get("updated_at", 0) >= threshold:
                continue
            shutil.rmtree(directory, ignore_errors=True)
            removed += 1
        return removed

    def delete_owned(self, job_id: str, session_id: str | None) -> None:
        self.read_owned(job_id, session_id)
        # Explicit deletion overrides prior learning consent while feedback is still waiting for
        # expert adjudication. Accepted, immutable dataset snapshots are governed offline and are
        # never created by this service.
        for directory in self.training.iterdir():
            record_path = directory / "feedback.json"
            try:
                record = json.loads(record_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if record.get("job_id") == job_id:
                shutil.rmtree(directory, ignore_errors=True)
        shutil.rmtree(self.job_dir(job_id))


def normalize_annotations(raw, state: dict) -> list[dict]:
    if not isinstance(raw, list) or len(raw) > 100:
        raise ValueError("annotations must be a list with at most 100 entries")

    normalized = []
    for item in raw:
        if not isinstance(item, dict) or item.get("type") not in ERROR_TYPES:
            raise ValueError("unknown annotation type")
        geometry = item.get("geometry")
        if geometry is None and "x" in item and "y" in item:
            geometry = {"type": "point", "points": [[item["x"], item["y"]]]}
        if not isinstance(geometry, dict) or geometry.get("type") not in {"point", "segment"}:
            raise ValueError("annotation geometry must be a point or segment")
        points = geometry.get("points")
        expected_count = 1 if geometry["type"] == "point" else 2
        if not isinstance(points, list) or len(points) != expected_count:
            raise ValueError(f"{geometry['type']} geometry needs {expected_count} point(s)")
        clean_points = []
        for point in points:
            try:
                x, y = float(point[0]), float(point[1])
            except (IndexError, TypeError, ValueError) as error:
                raise ValueError("annotation coordinates must be numbers") from error
            if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                raise ValueError("annotation coordinates must be normalized between 0 and 1")
            clean_points.append([round(x, 6), round(y, 6)])

        segment_types = {"stops-mid", "bleed", "dash-style", "stripe-style"}
        required_geometry = "segment" if item["type"] in segment_types else "point"
        if geometry["type"] != required_geometry:
            raise ValueError(f"{item['type']} annotations require {required_geometry} geometry")

        expected = str(item.get("expected_code") or "").strip().upper().replace(" ", "")
        if item["type"] == "wrong-colour" and not COLOUR_CODE_RE.fullmatch(expected):
            raise ValueError("wrong-colour annotations require a valid expected colour code")
        if expected and not COLOUR_CODE_RE.fullmatch(expected):
            raise ValueError("invalid expected colour code")

        expectation = {
            "wrong-colour": f"painted:{expected}",
            "non-wire": "black",
            "bleed": "black",
            "stops-mid": "painted",
            "missing": "painted",
            "dash-style": "preserve-dash-pattern",
            "stripe-style": "preserve-base-tracer",
        }[item["type"]]
        centre_x = sum(point[0] for point in clean_points) / len(clean_points)
        centre_y = sum(point[1] for point in clean_points) / len(clean_points)
        analysis_at = [round(centre_x * float(state["page_width_pt"]) * 200.0 / 72.0, 1),
                       round(centre_y * float(state["page_height_pt"]) * 200.0 / 72.0, 1)]
        training_target = {
            "non-wire": "wire-vs-furniture",
            "missing": "tracing-or-abstention",
            "wrong-colour": "legend-ownership",
            "stops-mid": "physical-continuity",
            "bleed": "must-not-link-boundary",
            "dash-style": "renderer-line-style",
            "stripe-style": "renderer-base-tracer",
        }[item["type"]]
        normalized.append({
            "type": item["type"],
            "class": item["type"],
            "geometry": {"type": geometry["type"], "points": clean_points},
            "at": analysis_at,
            "expected_code": expected or None,
            "expect": expectation,
            "note": str(item.get("note") or "").strip()[:500],
            "source": "web-beta-user",
            "training_target": training_target,
            "adjudication": "pending",
        })
    return normalized


def inspect_pdf_source(pdf_path: Path, page_index: int) -> dict:
    """Parse and validate an untrusted source inside the isolated job process."""
    import fitz

    try:
        document = fitz.open(pdf_path)
    except Exception as error:
        raise InvalidUpload("PDF cannot be opened by the beta parser") from error
    try:
        if document.needs_pass:
            raise InvalidUpload("password-protected PDFs are not supported in the beta")
        page_count = len(document)
        if page_count < 1:
            raise InvalidUpload("PDF has no pages")
        if page_count > MAX_PAGES:
            raise InvalidUpload(f"PDF has more than the beta limit of {MAX_PAGES} pages")
        if page_index < 0 or page_index >= page_count:
            raise InvalidUpload(f"page must be between 1 and {page_count}")

        selected = None
        for index in range(page_count):
            rect = document[index].rect
            values = (rect.width, rect.height, rect.width * rect.height)
            if not all(math.isfinite(value) and value > 0 for value in values):
                raise InvalidUpload(f"page {index + 1} has invalid dimensions")
            if max(values[:2]) > MAX_PAGE_SIDE_PT or values[2] > MAX_PAGE_AREA_PT2:
                raise InvalidUpload(f"page {index + 1} exceeds the beta dimension limit")
            if index == page_index:
                analysis_pixels = values[2] * (ANALYSIS_DPI / 72.0) ** 2
                if analysis_pixels > MAX_ANALYSIS_PIXELS:
                    raise InvalidUpload("selected page exceeds the beta processing budget")
                selected = rect
        return {
            "page_count": page_count,
            "page_width_pt": selected.width,
            "page_height_pt": selected.height,
        }
    finally:
        document.close()


def _select_convention(pdf_path: Path, page_index: int, requested: str) -> tuple[str, str]:
    from .labels.conventions import list_conventions, load_convention
    from .labels.text_layer import read_legends, strong_legends

    available = list_conventions()
    if requested != "auto":
        if requested not in available:
            raise ValueError("unknown colour-code convention")
        return requested, "user-selected"

    import fitz

    document = fitz.open(pdf_path)
    page = document[page_index]
    scored = []
    for name in available:
        convention = load_convention(name)
        legends = strong_legends(read_legends(page, 200, convention))
        distinctive = sum(legend.code.split("/")[0] in convention.distinctive for legend in legends)
        score = len(legends) + distinctive * 3
        scored.append((score, len(legends), name))
    document.close()
    scored.sort(reverse=True)
    best = scored[0]
    confidence = "high" if best[0] >= 6 and (len(scored) == 1 or best[0] >= scored[1][0] + 3) \
        else "low"
    return best[2], confidence


def _load_models():
    from .engine.classifier import CalibratedRunClassifier
    from .engine.policy import DecisionPolicy

    # Models are never loaded implicitly from an ignored developer workspace. The hard electrical
    # rules changed for the standalone beta, so an operator must explicitly mount a revalidated,
    # versioned artifact and set these paths. Otherwise the deterministic conservative baseline runs.
    policy_value = os.getenv("PINTOR_POLICY_PATH", "").strip()
    classifier_value = os.getenv("PINTOR_CLASSIFIER_PATH", "").strip()
    policy_path = Path(policy_value) if policy_value else None
    classifier_path = Path(classifier_value) if classifier_value else None
    policy = DecisionPolicy.load(str(policy_path) if policy_path and policy_path.is_file() else None)
    classifier = CalibratedRunClassifier.load(str(classifier_path)) \
        if classifier_path and classifier_path.is_file() else None
    return policy, classifier


def _render_preview(pdf_path: Path, page_index: int, out_path: Path,
                    max_side: int = 4800, max_pixels: int = 22_000_000) -> tuple[int, int]:
    import fitz

    document = fitz.open(pdf_path)
    page = document[page_index]
    width, height = page.rect.width, page.rect.height
    scale = min(max_side / max(width, height), (max_pixels / (width * height)) ** 0.5)
    scale = max(scale, 1.0)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    pixmap.pil_save(out_path, format="JPEG", quality=90, optimize=True)
    size = (pixmap.width, pixmap.height)
    document.close()
    return size


def process_job(store: JobStore, job_id: str) -> None:
    """Run the conservative painter and write only sanitized job state."""
    try:
        state = store.update(job_id, status="processing", stage="reading-diagram")
        directory = store.job_dir(job_id)
        source = directory / "source.pdf"
        state = store.update(job_id, **inspect_pdf_source(source, state["page"]))
        convention, confidence = _select_convention(
            source, state["page"], state["requested_convention"])
        original_size = _render_preview(source, state["page"], directory / "original.jpg")
        store.update(job_id, stage="tracing-conductors", convention=convention,
                     convention_confidence=confidence)

        generated = directory / "generated"
        if confidence == "low" and state["requested_convention"] == "auto":
            # Exact vector geometry is not permission to guess its colour vocabulary.  Let the
            # convention-neutral OCR sweep decide from visible labels, or abstain.
            report = {"declined": True, "runs": 0, "runs_painted": 0}
        else:
            from .tools.paint_vector import paint_page

            policy, classifier = _load_models()
            report = paint_page(
                str(source), state["page"], str(generated), convention_name=convention,
                paint_dpi=int(os.getenv("PINTOR_PAINT_DPI", "720")),
                paint_pixel_budget=int(os.getenv("PINTOR_PAINT_PIXEL_BUDGET", "60000000")),
                decision_policy=policy, run_classifier=classifier,
            )
        # Raster-only scans and pages whose colour legends are image pixels deliberately fail the
        # vector capability gate.  Re-run the same source through OCR + pixel topology instead of
        # treating that honest vector refusal as a terminal error.
        vector_needs_ocr = (
            report.get("runs_painted") == 0 and report.get("legends") == 0
        )
        if report.get("declined") or vector_needs_ocr:
            store.update(job_id, stage="reading-raster-labels", processing_mode="raster-ocr")
            from .tools.paint_raster import paint_page as paint_raster_page

            report = paint_raster_page(
                str(source), state["page"], str(generated),
                convention_name=state["requested_convention"],
                paint_pixel_budget=int(
                    os.getenv("PINTOR_PAINT_PIXEL_BUDGET", "60000000")
                ),
            )
            if report.get("convention"):
                convention = report["convention"]
            confidence = report.get("convention_confidence", confidence)
            store.update(job_id, convention=convention, convention_confidence=confidence)

        if report.get("declined"):
            stage = "confirm-colour-convention" \
                if confidence == "low" and state["requested_convention"] == "auto" \
                else "needs-manual-review"
            store.update(
                job_id, status="declined", stage=stage,
                decline_reason=report.get("decline_reason", "unsupported page geometry"),
                processing_mode=report.get("processing_mode", "vector-text"),
                preview_original=f"/api/jobs/{job_id}/preview/original",
                metrics={
                    "preview_width": original_size[0], "preview_height": original_size[1],
                    "labels": report.get("labels", 0), "runs": report.get("runs", 0),
                    "abstentions": report.get("decision_abstentions", 0),
                },
            )
            return

        if not (report.get("v2") or {}).get("passed"):
            raise RuntimeError("protected-region gate V2 failed")
        if not (report.get("v7") or {}).get("passed"):
            raise RuntimeError("source-preservation gate V7 failed")
        painted = directory / "painted.pdf"
        shutil.move(report["out_pdf"], painted)
        import fitz

        verification = fitz.open(painted)
        if len(verification) != state["page_count"] or verification.needs_pass:
            verification.close()
            painted.unlink(missing_ok=True)
            raise RuntimeError("generated PDF failed reopen/page-count verification")
        verification.close()
        painted_size = _render_preview(painted, state["page"], directory / "painted.jpg")
        v7 = report.get("v7") or {}
        metrics = {
            "paint_rate": report.get("paint_rate", 0),
            "runs": report.get("runs", 0),
            "runs_painted": report.get("runs_painted", 0),
            "codes": report.get("codes", []),
            "abstentions": report.get("decision_abstentions", 0)
                + report.get("learned_abstentions", 0),
            "original_preserved": bool(v7.get("passed")),
            "paint_dpi": report.get("paint_dpi"),
            "seconds": report.get("seconds"),
            "processing_mode": report.get("processing_mode", "vector-text"),
            "preview_width": painted_size[0],
            "preview_height": painted_size[1],
        }
        store.update(
            job_id, status="ready", stage="review", metrics=metrics,
            processing_mode=report.get("processing_mode", "vector-text"),
            preview_original=f"/api/jobs/{job_id}/preview/original",
            preview_painted=f"/api/jobs/{job_id}/preview/painted",
            download=f"/api/jobs/{job_id}/download",
        )
    except InvalidUpload as error:
        try:
            store.update(job_id, status="declined", stage="invalid-pdf",
                         decline_reason=str(error)[:500])
        except Exception:
            pass
    except Exception as error:
        try:
            store.update(job_id, status="failed", stage="failed",
                         error="processing failed; the result was quarantined",
                         internal_error=f"{type(error).__name__}: {error}"[:1000])
        except Exception:
            pass


def _worker_entry(workspace_root: str, job_id: str, memory_mb: int, cpu_seconds: int) -> None:
    """Child-process entry point; POSIX deployments apply hard memory and CPU ceilings."""
    try:
        import resource

        memory_bytes = memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 5))
    except (ImportError, OSError, ValueError):
        pass
    process_job(JobStore(workspace_root), job_id)


def process_job_isolated(store: JobStore, job_id: str) -> None:
    """Run one untrusted PDF in a killable process instead of the API process."""
    import multiprocessing

    timeout = int(os.getenv("PINTOR_JOB_TIMEOUT_SECONDS", "180"))
    memory_mb = int(os.getenv("PINTOR_JOB_MEMORY_MB", "2560"))
    cpu_seconds = int(os.getenv("PINTOR_JOB_CPU_SECONDS", "150"))
    context = multiprocessing.get_context("spawn")
    worker = context.Process(
        target=_worker_entry,
        args=(str(store.root), job_id, memory_mb, cpu_seconds),
        daemon=False,
    )
    worker.start()
    worker.join(timeout)
    if worker.is_alive():
        worker.terminate()
        worker.join(10)
        store.update(job_id, status="failed", stage="failed",
                     error="ProcessingTimeout: beta processing time limit exceeded")
    elif worker.exitcode != 0:
        state = store.read(job_id)
        if state.get("status") not in {"ready", "declined", "failed"}:
            store.update(job_id, status="failed", stage="failed",
                         error=f"WorkerExit: isolated worker exited with code {worker.exitcode}")


def create_app(workspace_root: str | Path | None = None,
               processor: Callable[[JobStore, str], None] | None = None):
    """Create the FastAPI application without making the CLI depend on web packages."""
    from fastapi import (
        BackgroundTasks, Cookie, FastAPI, File, Form, HTTPException, Request, UploadFile,
    )
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, JSONResponse, Response
    from pydantic import BaseModel, Field

    store = JobStore(workspace_root or os.getenv("PINTOR_WEB_ROOT", str(DEFAULT_WORKSPACE)),
                     retention_hours=int(os.getenv("PINTOR_RETENTION_HOURS", "24")))
    processor = processor or process_job_isolated
    max_bytes = int(os.getenv("PINTOR_MAX_UPLOAD_MB", "25")) * 1024 * 1024
    secure_cookie = os.getenv("PINTOR_COOKIE_SECURE", "1") != "0"
    beta_key_hash = os.getenv("PINTOR_BETA_KEY_HASH", "").strip().lower()
    session_secret = os.getenv("PINTOR_SESSION_SECRET", "")
    if beta_key_hash and not re.fullmatch(r"[a-f0-9]{64}", beta_key_hash):
        raise RuntimeError("PINTOR_BETA_KEY_HASH must be a SHA-256 hex digest")
    if beta_key_hash and len(session_secret) < 32:
        raise RuntimeError("PINTOR_SESSION_SECRET must contain at least 32 characters")
    beta_enabled = bool(beta_key_hash)
    expected_beta_cookie = _beta_cookie_token(session_secret) if beta_enabled else ""
    trust_proxy_headers = os.getenv("PINTOR_TRUST_PROXY_HEADERS", "0") == "1"
    access_limit = int(os.getenv("PINTOR_ACCESS_ATTEMPTS", "5"))
    access_window = int(os.getenv("PINTOR_ACCESS_WINDOW_SECONDS", "600"))
    job_limit = int(os.getenv("PINTOR_JOB_RATE_LIMIT", "10"))
    job_window = int(os.getenv("PINTOR_JOB_RATE_WINDOW_SECONDS", "3600"))
    request_limit = int(os.getenv("PINTOR_REQUEST_RATE_LIMIT", "300"))
    request_window = int(os.getenv("PINTOR_REQUEST_RATE_WINDOW_SECONDS", "60"))
    max_storage_bytes = int(os.getenv("PINTOR_MAX_STORAGE_MB", "8192")) * 1024 * 1024
    max_concurrent_jobs = int(os.getenv("PINTOR_MAX_CONCURRENT_JOBS", "1"))
    limiter = SlidingWindowLimiter()
    processing_slots = threading.BoundedSemaphore(max(1, max_concurrent_jobs))
    origins = [value.strip() for value in os.getenv(
        "PINTOR_ALLOWED_ORIGINS",
        "https://engnata.eu,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if value.strip()]

    class FeedbackPayload(BaseModel):
        annotations: list[dict] = Field(min_length=1, max_length=100)
        note: str = Field(default="", max_length=2000)
        request_revision: bool = True
        consent_learning: bool = False

    class AccessPayload(BaseModel):
        code: str = Field(min_length=1, max_length=128)

    @asynccontextmanager
    async def lifespan(_app):
        store.cleanup_expired()
        yield

    app = FastAPI(title="Pintor beta API", version="0.2.1", docs_url=None, redoc_url=None,
                  lifespan=lifespan)
    app.state.store = store

    def request_ip(request: Request) -> str:
        if trust_proxy_headers:
            candidate = request.headers.get("cf-connecting-ip", "").strip()
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                pass
        return request.client.host if request.client else "unknown"

    def api_error(request: Request, status: int, detail: str,
                  retry_after: int | None = None):
        headers = {"Cache-Control": "no-store"}
        origin = request.headers.get("origin")
        if origin in origins:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
            headers["Vary"] = "Origin"
        if retry_after is not None:
            headers["Retry-After"] = str(retry_after)
        return JSONResponse({"detail": detail}, status_code=status, headers=headers)

    @app.middleware("http")
    async def protect_private_beta(request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        client = request_ip(request)
        allowed, retry_after = limiter.allow(
            f"request:{client}", request_limit, request_window,
        )
        if not allowed:
            return api_error(request, 429, "request rate limit exceeded", retry_after)
        supplied = request.cookies.get(BETA_COOKIE, "")
        authorized = not beta_enabled or hmac.compare_digest(supplied, expected_beta_cookie)
        if request.url.path not in {"/api/health", "/api/access"} and not authorized:
            return api_error(request, 401, "private beta access required")
        response = await call_next(request)
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    def health(request: Request):
        supplied = request.cookies.get(BETA_COOKIE, "")
        authenticated = not beta_enabled or hmac.compare_digest(
            supplied, expected_beta_cookie,
        )
        return {
            "status": "ok", "beta": True, "access_required": beta_enabled,
            "authenticated": authenticated,
        }

    @app.post("/api/access")
    def beta_access(request: Request, payload: AccessPayload):
        if not beta_enabled:
            return {"status": "ok", "access_required": False}
        client = request_ip(request)
        allowed, retry_after = limiter.allow(
            f"access:{client}", access_limit, access_window,
        )
        if not allowed:
            return api_error(request, 429, "too many access attempts", retry_after)
        supplied_hash = hashlib.sha256(payload.code.strip().encode("utf-8")).hexdigest()
        if not hmac.compare_digest(supplied_hash, beta_key_hash):
            return api_error(request, 401, "invalid beta access code")
        response = JSONResponse({"status": "ok", "access_required": True})
        response.set_cookie(
            BETA_COOKIE, expected_beta_cookie, max_age=30 * 24 * 3600,
            httponly=True, secure=secure_cookie, samesite="strict", path="/api",
        )
        return response

    @app.get("/api/capabilities")
    def capabilities():
        from .labels.conventions import list_conventions

        return {
            "version": "0.2.1",
            "beta": True,
            "input": "pdf-vector-or-raster-with-visible-colour-codes",
            "page_modes": ["vector-text", "raster-ocr"],
            "scope": "one-selected-page-per-job",
            "max_upload_bytes": max_bytes,
            "max_pages": MAX_PAGES,
            "max_analysis_pixels": MAX_ANALYSIS_PIXELS,
            "max_concurrent_jobs": max(1, max_concurrent_jobs),
            "retention_hours": store.retention_seconds // 3600,
            "conventions": ["auto", *list_conventions()],
            "model": "operator-mounted-revalidated-artifact-or-conservative-baseline",
            "automatic_training": False,
        }

    @app.post("/api/jobs", status_code=202)
    async def create_job(request: Request, background: BackgroundTasks,
                         file: UploadFile = File(...),
                         page: int = Form(0), convention: str = Form("auto"),
                         consent_learning: bool = Form(False),
                         pintor_session: str | None = Cookie(default=None)):
        client = request_ip(request)
        allowed, retry_after = limiter.allow(f"job:{client}", job_limit, job_window)
        if not allowed:
            return api_error(request, 429, "job creation rate limit exceeded", retry_after)
        session_id = pintor_session if pintor_session and SESSION_RE.fullmatch(pintor_session) \
            else uuid.uuid4().hex + uuid.uuid4().hex
        content = await file.read(max_bytes + 1)
        try:
            state = store.create(content, file.filename, page, convention,
                                 consent_learning, max_bytes, _owner_hash(session_id),
                                 max_storage_bytes=max_storage_bytes)
        except InvalidUpload as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        def run_queued_job() -> None:
            with processing_slots:
                processor(store, state["id"])

        background.add_task(run_queued_job)
        response = JSONResponse(_public_state(state), status_code=202)
        response.set_cookie(
            "pintor_session", session_id, max_age=store.retention_seconds,
            httponly=True, secure=secure_cookie, samesite="strict", path="/api",
        )
        return response

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str, pintor_session: str | None = Cookie(default=None)):
        try:
            return _public_state(store.read_owned(job_id, pintor_session))
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="job not found") from error

    @app.get("/api/jobs/{job_id}/preview/{kind}")
    def preview(job_id: str, kind: str,
                pintor_session: str | None = Cookie(default=None)):
        name = {"original": "original.jpg", "painted": "painted.jpg"}.get(kind)
        if not name:
            raise HTTPException(status_code=404, detail="preview not found")
        try:
            return FileResponse(store.artifact(job_id, name, pintor_session),
                                media_type="image/jpeg",
                                headers={"Cache-Control": "private, no-store"})
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="preview not found") from error

    @app.get("/api/jobs/{job_id}/download")
    def download(job_id: str, pintor_session: str | None = Cookie(default=None)):
        try:
            state = store.read_owned(job_id, pintor_session)
            stem = Path(state["original_name"]).stem[:80]
            return FileResponse(store.artifact(job_id, "painted.pdf", pintor_session),
                                media_type="application/pdf",
                                filename=f"{stem}-painted.pdf",
                                headers={"Cache-Control": "private, no-store"})
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="painted PDF not found") from error

    @app.post("/api/jobs/{job_id}/feedback", status_code=202)
    def feedback(job_id: str, payload: FeedbackPayload,
                 pintor_session: str | None = Cookie(default=None)):
        try:
            record = store.add_feedback(job_id, payload.model_dump(), pintor_session)
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="job not found") from error
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return {"id": record["id"], "status": record["status"],
                "learning": record["consent_learning"]}

    @app.delete("/api/jobs/{job_id}", status_code=204)
    def delete_job(job_id: str, pintor_session: str | None = Cookie(default=None)):
        try:
            store.delete_owned(job_id, pintor_session)
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="job not found") from error
        return Response(status_code=204)

    return app


def main() -> None:
    import uvicorn

    uvicorn.run(
        create_app(),
        host=os.getenv("PINTOR_HOST", "127.0.0.1"),
        port=int(os.getenv("PINTOR_PORT", "8765")),
        proxy_headers=True,
        server_header=False,
    )


if __name__ == "__main__":
    main()
