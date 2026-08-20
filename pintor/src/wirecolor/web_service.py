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

from .accounts import (
    ACCOUNT_COOKIE, AccountError, AccountStore, DuplicateUsername, InvalidCredentials,
)


PACKAGE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WORKSPACE = PACKAGE_ROOT / "workspaces" / "web"
JOB_ID_RE = re.compile(r"^[a-f0-9]{32}$")
SESSION_RE = re.compile(r"^[a-f0-9]{64}$")
COLOUR_CODE_RE = re.compile(r"^[A-Z]{1,3}(?:/[A-Z]{1,3})?$")
ERROR_TYPES = frozenset({
    "wrong-colour", "non-wire", "stops-mid", "missing", "bleed",
    "dash-style", "stripe-style",
})
MAX_DOCUMENT_PAGES = 2_000
MAX_SELECTED_PAGES = 50
MAX_PAGE_SIDE_PT = 12_000
MAX_PAGE_AREA_PT2 = 24_000_000
ANALYSIS_DPI = 200
MAX_ANALYSIS_PIXELS = 75_000_000
BETA_COOKIE = "pintor_beta"
BETA_COOKIE_PURPOSE = b"pintor-beta-access-v1"
ACCOUNT_OWNER_PURPOSE = b"pintor-account-owner-v1:"
FEEDBACK_ID_RE = re.compile(r"^[a-f0-9]{32}$")


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


def _account_owner_token(secret: str, account_id: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), ACCOUNT_OWNER_PURPOSE + account_id.encode("ascii"), hashlib.sha256,
    ).hexdigest()


def parse_page_selection(value: str) -> list[int]:
    """Parse human page notation into unique, zero-based indices.

    Accepted examples: ``40, 42, 44, 46`` and ``40-46``. Ranges are inclusive and the selected
    page count is bounded independently from the total manual length.
    """
    if not isinstance(value, str) or not value.strip() or len(value) > 200:
        raise InvalidUpload("enter at least one page number")
    selected = []
    seen = set()
    for raw_part in value.split(","):
        part = raw_part.strip()
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", part)
        if not match:
            raise InvalidUpload("pages must use numbers separated by commas or ascending ranges")
        first = int(match.group(1))
        last = int(match.group(2) or first)
        if first < 1 or last < first or last > MAX_DOCUMENT_PAGES:
            raise InvalidUpload(
                f"pages must be ascending numbers between 1 and {MAX_DOCUMENT_PAGES}"
            )
        for page_number in range(first, last + 1):
            page_index = page_number - 1
            if page_index not in seen:
                selected.append(page_index)
                seen.add(page_index)
            if len(selected) > MAX_SELECTED_PAGES:
                raise InvalidUpload(
                    f"select at most {MAX_SELECTED_PAGES} pages per private job"
                )
    return selected


def _public_state(state: dict) -> dict:
    allowed = {
        "id", "status", "stage", "original_name", "page", "selected_pages", "pages",
        "page_count", "convention",
        "requested_convention", "convention_confidence", "created_at", "updated_at", "metrics",
        "processing_mode", "decline_reason", "error", "preview_original", "preview_painted",
        "download", "feedback_id", "current_page", "completed_pages", "selected_page_count",
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

    def create(self, content: bytes, filename: str | None, pages: list[int] | int, convention: str,
               consent_learning: bool, max_bytes: int, owner_hash: str,
               max_storage_bytes: int = 0, account: dict | None = None) -> dict:
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

        selected_pages = [pages] if isinstance(pages, int) else list(pages)
        if not selected_pages or len(selected_pages) > MAX_SELECTED_PAGES:
            raise InvalidUpload(f"select between 1 and {MAX_SELECTED_PAGES} pages")
        if any(not isinstance(page, int) or page < 0 for page in selected_pages):
            raise InvalidUpload("invalid selected page")
        selected_pages = list(dict.fromkeys(selected_pages))

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
            "page": selected_pages[0],
            "selected_pages": selected_pages,
            "selected_page_count": len(selected_pages),
            "requested_convention": convention,
            "consent_learning": bool(consent_learning),
            "source_sha256": hashlib.sha256(content).hexdigest(),
            "owner_hash": owner_hash,
            "account_id": account.get("id") if account else None,
            "account_username": account.get("username") if account else None,
            "created_at": now,
            "updated_at": now,
        }
        _atomic_json(directory / "state.json", state)
        return state

    def artifact(self, job_id: str, name: str, session_id: str | None = None) -> Path:
        if name != "painted.pdf" and not re.fullmatch(
            r"(?:original|painted)-p\d{1,4}\.jpg", name,
        ):
            raise JobNotFound(job_id)
        if session_id is not None:
            self.read_owned(job_id, session_id)
        path = self.job_dir(job_id) / name
        if not path.is_file():
            raise JobNotFound(job_id)
        return path

    def add_feedback(self, job_id: str, payload: dict, session_id: str | None = None,
                     account: dict | None = None) -> dict:
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
            "page": annotations[0]["page"] if len({item["page"] for item in annotations}) == 1
                else None,
            "pages": sorted({item["page"] for item in annotations}),
            "convention": state.get("convention"),
            "annotations": annotations,
            "note": str(payload.get("note") or "").strip()[:2000],
            "request_revision": bool(payload.get("request_revision", True)),
            "consent_learning": bool(payload.get("consent_learning", False)
                                     and state.get("consent_learning", False)),
            "created_at": int(time.time()),
            "status": "queued-for-review",
            "trainable": False,
            "eligible_for_dataset": False,
            "account_id": account.get("id") if account else state.get("account_id"),
            "account_username": account.get("username") if account
                else state.get("account_username"),
            "original_name": state.get("original_name"),
        }
        feedback_dir = self.job_dir(job_id) / "feedback"
        _atomic_json(feedback_dir / f"{feedback_id}.json", record)

        if record["consent_learning"]:
            inbox = self.training / feedback_id
            inbox.mkdir(mode=0o700)
            shutil.copyfile(self.job_dir(job_id) / "source.pdf", inbox / "source.pdf")
            painted = self.job_dir(job_id) / "painted.pdf"
            if painted.is_file():
                shutil.copyfile(painted, inbox / "painted.pdf")
            for page_index in record["pages"]:
                for kind in ("original", "painted"):
                    preview = self.job_dir(job_id) / f"{kind}-p{page_index}.jpg"
                    if preview.is_file():
                        shutil.copyfile(preview, inbox / preview.name)
            _atomic_json(inbox / "job.json", {
                "id": job_id,
                "original_name": state.get("original_name"),
                "selected_pages": state.get("selected_pages") or [state.get("page")],
                "page_dimensions": state.get("page_dimensions", {}),
                "convention": state.get("convention"),
                "processing_mode": state.get("processing_mode"),
                "metrics": state.get("metrics", {}),
                "source_sha256": state.get("source_sha256"),
            })
            _atomic_json(inbox / "feedback.json", record)

        self.update(job_id, status="revision-requested", stage="human-review",
                    feedback_id=feedback_id)
        return record

    def list_owned(self, session_id: str) -> list[dict]:
        owner_hash = _owner_hash(session_id)
        records = []
        for state_path in self.jobs.glob("*/state.json"):
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if state.get("owner_hash") != owner_hash:
                continue
            records.append(_public_state(state))
        return sorted(records, key=lambda item: item.get("created_at", 0), reverse=True)

    def _feedback_locations(self) -> dict[str, tuple[Path, dict]]:
        records: dict[str, tuple[Path, dict]] = {}
        for record_path in self.jobs.glob("*/feedback/*.json"):
            try:
                record = json.loads(record_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            feedback_id = record.get("id")
            if isinstance(feedback_id, str) and FEEDBACK_ID_RE.fullmatch(feedback_id):
                records[feedback_id] = (record_path, record)
        for record_path in self.training.glob("*/feedback.json"):
            try:
                record = json.loads(record_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            feedback_id = record.get("id")
            if isinstance(feedback_id, str) and FEEDBACK_ID_RE.fullmatch(feedback_id):
                records.setdefault(feedback_id, (record_path, record))
        return records

    @staticmethod
    def _public_feedback(record: dict, detailed: bool = False) -> dict:
        allowed = {
            "id", "job_id", "pages", "page", "convention", "annotations", "note",
            "request_revision", "consent_learning", "created_at", "status", "trainable",
            "eligible_for_dataset", "account_username", "original_name", "reviewed_at",
            "review_note", "reviewer_username", "decision", "review_history",
        }
        payload = {key: record[key] for key in allowed if key in record}
        if not detailed:
            payload["annotation_count"] = len(record.get("annotations") or [])
            payload.pop("annotations", None)
            payload.pop("review_history", None)
        return payload

    def list_feedback(self) -> list[dict]:
        records = [
            self._public_feedback(record)
            for _, record in self._feedback_locations().values()
        ]
        return sorted(records, key=lambda item: item.get("created_at", 0), reverse=True)

    def get_feedback(self, feedback_id: str) -> dict:
        if not FEEDBACK_ID_RE.fullmatch(feedback_id):
            raise JobNotFound(feedback_id)
        located = self._feedback_locations().get(feedback_id)
        if not located:
            raise JobNotFound(feedback_id)
        return self._public_feedback(located[1], detailed=True)

    def feedback_artifact(self, feedback_id: str, name: str) -> Path:
        if not FEEDBACK_ID_RE.fullmatch(feedback_id) or not (
            name in {"source.pdf", "painted.pdf"}
            or re.fullmatch(r"(?:original|painted)-p\d{1,4}\.jpg", name)
        ):
            raise JobNotFound(feedback_id)
        located = self._feedback_locations().get(feedback_id)
        if not located:
            raise JobNotFound(feedback_id)
        record_path, record = located
        live = self.jobs / str(record.get("job_id")) / name
        archived = self.training / feedback_id / name
        for candidate in (live, archived):
            try:
                resolved = candidate.resolve()
            except OSError:
                continue
            if resolved.is_file() and (
                self.jobs in resolved.parents or self.training in resolved.parents
            ):
                return resolved
        raise JobNotFound(feedback_id)

    def adjudicate_feedback(self, feedback_id: str, decision: str, note: str,
                            reviewer: dict) -> dict:
        if decision not in {"accepted", "rejected", "needs-clarification"}:
            raise ValueError("invalid expert decision")
        locations = self._feedback_locations()
        located = locations.get(feedback_id)
        if not located:
            raise JobNotFound(feedback_id)
        record = dict(located[1])
        now = int(time.time())
        history = list(record.get("review_history") or [])
        history.append({
            "decision": decision,
            "note": str(note or "").strip()[:2000],
            "reviewed_at": now,
            "reviewer_id": reviewer["id"],
            "reviewer_username": reviewer["username"],
        })
        record.update({
            "decision": decision,
            "status": f"expert-{decision}",
            "review_note": str(note or "").strip()[:2000],
            "reviewed_at": now,
            "reviewer_id": reviewer["id"],
            "reviewer_username": reviewer["username"],
            "review_history": history,
            # Adjudication only makes a consented report eligible for a later offline dataset.
            # The web service never trains or promotes a model.
            "eligible_for_dataset": bool(
                decision == "accepted" and record.get("consent_learning")
            ),
            "trainable": False,
        })
        live_path = self.jobs / str(record.get("job_id")) / "feedback" / f"{feedback_id}.json"
        archive_path = self.training / feedback_id / "feedback.json"
        if live_path.is_file():
            _atomic_json(live_path, record)
        if archive_path.is_file():
            _atomic_json(archive_path, record)
        return self._public_feedback(record, detailed=True)

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
    selected_pages = state.get("selected_pages") or [state["page"]]
    page_dimensions = state.get("page_dimensions") or {
        str(state["page"]): {
            "page_width_pt": state["page_width_pt"],
            "page_height_pt": state["page_height_pt"],
        }
    }
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

        try:
            page_index = int(item.get("page", state["page"]))
        except (TypeError, ValueError) as error:
            raise ValueError("annotation page must be an integer") from error
        if page_index not in selected_pages or str(page_index) not in page_dimensions:
            raise ValueError("annotation page was not selected for this job")
        dimensions = page_dimensions[str(page_index)]

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
        analysis_at = [
            round(centre_x * float(dimensions["page_width_pt"]) * 200.0 / 72.0, 1),
            round(centre_y * float(dimensions["page_height_pt"]) * 200.0 / 72.0, 1),
        ]
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
            "page": page_index,
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


def inspect_pdf_source(pdf_path: Path, page_indices: list[int] | int) -> dict:
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
        if page_count > MAX_DOCUMENT_PAGES:
            raise InvalidUpload(
                f"PDF has more than the safety limit of {MAX_DOCUMENT_PAGES} pages"
            )
        selected_pages = [page_indices] if isinstance(page_indices, int) else list(page_indices)
        if not selected_pages or len(selected_pages) > MAX_SELECTED_PAGES:
            raise InvalidUpload(f"select between 1 and {MAX_SELECTED_PAGES} pages")
        if any(index < 0 or index >= page_count for index in selected_pages):
            raise InvalidUpload(f"selected pages must be between 1 and {page_count}")

        dimensions = {}
        for index in selected_pages:
            rect = document[index].rect
            values = (rect.width, rect.height, rect.width * rect.height)
            if not all(math.isfinite(value) and value > 0 for value in values):
                raise InvalidUpload(f"page {index + 1} has invalid dimensions")
            if max(values[:2]) > MAX_PAGE_SIDE_PT or values[2] > MAX_PAGE_AREA_PT2:
                raise InvalidUpload(f"page {index + 1} exceeds the beta dimension limit")
            analysis_pixels = values[2] * (ANALYSIS_DPI / 72.0) ** 2
            if analysis_pixels > MAX_ANALYSIS_PIXELS:
                raise InvalidUpload(f"selected page {index + 1} exceeds the processing budget")
            dimensions[str(index)] = {
                "page_width_pt": rect.width,
                "page_height_pt": rect.height,
            }
        return {
            "page_count": page_count,
            "page_dimensions": dimensions,
            # Legacy fields keep old feedback fixtures and one-page clients compatible.
            "page_width_pt": dimensions[str(selected_pages[0])]["page_width_pt"],
            "page_height_pt": dimensions[str(selected_pages[0])]["page_height_pt"],
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
    """Paint selected pages sequentially and release one preserved multi-page PDF."""
    try:
        state = store.update(job_id, status="processing", stage="reading-diagram")
        directory = store.job_dir(job_id)
        source = directory / "source.pdf"
        selected_pages = state.get("selected_pages") or [state["page"]]
        state = store.update(job_id, **inspect_pdf_source(source, selected_pages))
        generated = directory / "generated"
        generated.mkdir(parents=True, exist_ok=True)
        page_results = []
        overlays = []
        policy, classifier = _load_models()
        paint_budget = int(os.getenv("PINTOR_PAINT_PIXEL_BUDGET", "60000000"))

        for position, page_index in enumerate(selected_pages, start=1):
            store.update(
                job_id, stage="reading-diagram", current_page=page_index,
                completed_pages=position - 1, pages=page_results,
            )
            original_name = f"original-p{page_index}.jpg"
            original_size = _render_preview(source, page_index, directory / original_name)
            convention, confidence = _select_convention(
                source, page_index, state["requested_convention"])
            store.update(
                job_id, stage="tracing-conductors", convention=convention,
                convention_confidence=confidence,
            )
            overlay_path = generated / f"page-{page_index}-overlay.png"

            if confidence == "low" and state["requested_convention"] == "auto":
                # Exact vector geometry is not permission to guess its colour vocabulary. Let the
                # convention-neutral OCR sweep decide from visible labels, or abstain.
                report = {"declined": True, "runs": 0, "runs_painted": 0}
            else:
                from .tools.paint_vector import paint_page

                report = paint_page(
                    str(source), page_index, str(generated), convention_name=convention,
                    paint_dpi=int(os.getenv("PINTOR_PAINT_DPI", "720")),
                    paint_pixel_budget=paint_budget, decision_policy=policy,
                    run_classifier=classifier, overlay_path=str(overlay_path),
                )

            vector_needs_ocr = (
                report.get("runs_painted") == 0 and report.get("legends") == 0
            )
            if report.get("declined") or vector_needs_ocr:
                store.update(job_id, stage="reading-raster-labels", processing_mode="raster-ocr")
                from .tools.paint_raster import paint_page as paint_raster_page

                report = paint_raster_page(
                    str(source), page_index, str(generated),
                    convention_name=state["requested_convention"],
                    paint_pixel_budget=paint_budget, overlay_path=str(overlay_path),
                )
                if report.get("convention"):
                    convention = report["convention"]
                confidence = report.get("convention_confidence", confidence)

            page_metrics = {
                "paint_rate": report.get("paint_rate", 0),
                "labels": report.get("labels", report.get("legends", 0)),
                "runs": report.get("runs", 0),
                "runs_painted": report.get("runs_painted", 0),
                "codes": report.get("codes", []),
                "abstentions": report.get("decision_abstentions", 0)
                    + report.get("learned_abstentions", 0),
                "paint_dpi": report.get("paint_dpi"),
                "seconds": report.get("seconds"),
                "preview_width": original_size[0],
                "preview_height": original_size[1],
            }
            page_result = {
                "page": page_index,
                "page_number": page_index + 1,
                "status": "declined" if report.get("declined") else "painted",
                "decline_reason": report.get("decline_reason"),
                "convention": convention,
                "convention_confidence": confidence,
                "processing_mode": report.get("processing_mode", "vector-text"),
                "preview_original": f"/api/jobs/{job_id}/preview/original?page={page_index}",
                "metrics": page_metrics,
            }
            page_results.append(page_result)

            if report.get("declined"):
                overlay_path.unlink(missing_ok=True)
                continue
            if not (report.get("v2") or {}).get("passed"):
                raise RuntimeError(f"protected-region gate V2 failed on page {page_index + 1}")
            if not overlay_path.is_file():
                raise RuntimeError(f"painter did not produce page {page_index + 1} overlay")
            overlays.append((page_index, str(overlay_path)))

        if not overlays:
            reasons = [
                f"page {item['page_number']}: {item['decline_reason'] or 'no safe colour assignment'}"
                for item in page_results
            ]
            ambiguous = all(
                item["convention_confidence"] == "low" for item in page_results
            ) and state["requested_convention"] == "auto"
            store.update(
                job_id, status="declined",
                stage="confirm-colour-convention" if ambiguous else "needs-manual-review",
                decline_reason="; ".join(reasons)[:500], pages=page_results,
                completed_pages=len(selected_pages), current_page=None,
                preview_original=page_results[0]["preview_original"],
                processing_mode="mixed" if len({p["processing_mode"] for p in page_results}) > 1
                    else page_results[0]["processing_mode"],
            )
            return

        from .paint.raster_overlay import attach_overlays
        from .verify.validators import v7_preservation

        painted = directory / "painted.pdf"
        stats = attach_overlays(str(source), str(painted), overlays)
        for item in page_results:
            if item["status"] != "painted":
                continue
            v7 = v7_preservation(str(source), str(painted), item["page"], stats["ocg"])
            if not v7.get("passed"):
                painted.unlink(missing_ok=True)
                raise RuntimeError(
                    f"source-preservation gate V7 failed on page {item['page_number']}"
                )
            item["metrics"]["original_preserved"] = True

        import fitz

        verification = fitz.open(painted)
        if len(verification) != state["page_count"] or verification.needs_pass:
            verification.close()
            painted.unlink(missing_ok=True)
            raise RuntimeError("generated PDF failed reopen/page-count verification")
        verification.close()

        for item in page_results:
            painted_name = f"painted-p{item['page']}.jpg"
            painted_size = _render_preview(
                painted, item["page"], directory / painted_name,
            )
            item["preview_painted"] = (
                f"/api/jobs/{job_id}/preview/painted?page={item['page']}"
            )
            item["metrics"]["preview_width"] = painted_size[0]
            item["metrics"]["preview_height"] = painted_size[1]
            item["metrics"].setdefault("original_preserved", True)

        total_runs = sum(item["metrics"]["runs"] for item in page_results)
        weighted_rate = sum(
            item["metrics"]["paint_rate"] * item["metrics"]["runs"]
            for item in page_results
        )
        modes = {item["processing_mode"] for item in page_results}
        conventions = {item["convention"] for item in page_results if item["convention"]}
        metrics = {
            "paint_rate": weighted_rate / total_runs if total_runs else 0,
            "runs": total_runs,
            "runs_painted": sum(item["metrics"]["runs_painted"] for item in page_results),
            "codes": sorted({
                code for item in page_results for code in item["metrics"]["codes"]
            }),
            "abstentions": sum(item["metrics"]["abstentions"] for item in page_results),
            "original_preserved": True,
            "seconds": round(sum(item["metrics"]["seconds"] or 0 for item in page_results), 1),
            "processing_mode": "mixed" if len(modes) > 1 else next(iter(modes)),
            "pages_requested": len(page_results),
            "pages_painted": sum(item["status"] == "painted" for item in page_results),
            "pages_declined": sum(item["status"] == "declined" for item in page_results),
        }
        store.update(
            job_id, status="ready", stage="review", metrics=metrics,
            pages=page_results, completed_pages=len(selected_pages), current_page=None,
            convention="mixed" if len(conventions) > 1 else next(iter(conventions), None),
            convention_confidence="mixed" if len({
                item["convention_confidence"] for item in page_results
            }) > 1 else page_results[0]["convention_confidence"],
            processing_mode=metrics["processing_mode"],
            preview_original=page_results[0]["preview_original"],
            preview_painted=page_results[0]["preview_painted"],
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
            (store.job_dir(job_id) / "painted.pdf").unlink(missing_ok=True)
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
    deadline = time.monotonic() + timeout
    terminal_since = None
    terminal_states = {"ready", "declined", "failed", "revision-requested"}
    while worker.is_alive():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        worker.join(min(1.0, remaining))
        if not worker.is_alive():
            break
        try:
            status = store.read(job_id).get("status")
        except Exception:
            status = None
        if status in terminal_states:
            terminal_since = terminal_since or time.monotonic()
            # ONNX/OpenCV may retain native threads after process_job has already written a
            # fail-closed terminal state. Give normal interpreter cleanup a short grace period,
            # then reap the child so one failed sheet cannot hold the single beta worker slot.
            if time.monotonic() - terminal_since >= 5.0:
                worker.terminate()
                worker.join(10)
                break
        else:
            terminal_since = None
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
    accounts_required = os.getenv("PINTOR_ACCOUNTS_REQUIRED", "0") == "1"
    account_session_days = int(os.getenv("PINTOR_ACCOUNT_SESSION_DAYS", "30"))
    accounts = AccountStore(store.root / "accounts.sqlite3", session_days=account_session_days)
    processor = processor or process_job_isolated
    max_bytes = int(os.getenv("PINTOR_MAX_UPLOAD_MB", "25")) * 1024 * 1024
    secure_cookie = os.getenv("PINTOR_COOKIE_SECURE", "1") != "0"
    beta_key_hash = os.getenv("PINTOR_BETA_KEY_HASH", "").strip().lower()
    session_secret = os.getenv("PINTOR_SESSION_SECRET", "")
    if beta_key_hash and not re.fullmatch(r"[a-f0-9]{64}", beta_key_hash):
        raise RuntimeError("PINTOR_BETA_KEY_HASH must be a SHA-256 hex digest")
    if (beta_key_hash or accounts_required) and len(session_secret) < 32:
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
    account_limit = int(os.getenv("PINTOR_ACCOUNT_ATTEMPTS", "10"))
    account_window = int(os.getenv("PINTOR_ACCOUNT_WINDOW_SECONDS", "600"))
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

    class AccountPayload(BaseModel):
        username: str = Field(min_length=1, max_length=64)
        password: str = Field(min_length=4, max_length=128)

    class DecisionPayload(BaseModel):
        decision: str
        note: str = Field(default="", max_length=2000)

    admin_username = os.getenv("PINTOR_ADMIN_USERNAME", "").strip()
    admin_password_hash = os.getenv("PINTOR_ADMIN_PASSWORD_HASH", "").strip()
    if bool(admin_username) != bool(admin_password_hash):
        raise RuntimeError(
            "PINTOR_ADMIN_USERNAME and PINTOR_ADMIN_PASSWORD_HASH must be configured together"
        )
    if admin_username:
        try:
            accounts.bootstrap_admin(admin_username, admin_password_hash)
        except AccountError as error:
            raise RuntimeError(f"administrator bootstrap failed: {error}") from error

    @asynccontextmanager
    async def lifespan(_app):
        store.cleanup_expired()
        yield

    app = FastAPI(title="Pintor beta API", version="0.4.0", docs_url=None, redoc_url=None,
                  lifespan=lifespan)
    app.state.store = store
    app.state.accounts = accounts

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

    def account_from_token(token: str | None) -> dict | None:
        return accounts.current(token)

    def require_account(token: str | None) -> dict:
        account = account_from_token(token)
        if not account:
            raise HTTPException(status_code=401, detail="account authentication required")
        return account

    def require_admin(token: str | None) -> dict:
        account = require_account(token)
        if account.get("role") != "admin":
            raise HTTPException(status_code=403, detail="administrator access required")
        return account

    def resolve_owner(account_token: str | None, legacy_session: str | None) -> tuple[str, dict | None]:
        account = account_from_token(account_token)
        if account:
            return _account_owner_token(session_secret, account["id"]), account
        if accounts_required:
            raise HTTPException(status_code=401, detail="account authentication required")
        session = legacy_session if legacy_session and SESSION_RE.fullmatch(legacy_session) \
            else uuid.uuid4().hex + uuid.uuid4().hex
        return session, None

    def set_account_cookies(response: Response, token: str, account: dict) -> None:
        max_age = accounts.session_seconds
        response.set_cookie(
            ACCOUNT_COOKIE, token, max_age=max_age, httponly=True, secure=secure_cookie,
            samesite="strict", path="/api",
        )
        response.set_cookie(
            "pintor_session", _account_owner_token(session_secret, account["id"]),
            max_age=max_age, httponly=True, secure=secure_cookie, samesite="strict", path="/api",
        )

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
        account = account_from_token(request.cookies.get(ACCOUNT_COOKIE))
        return {
            "status": "ok", "beta": True, "access_required": beta_enabled,
            "authenticated": authenticated, "accounts_required": accounts_required,
            "account_authenticated": bool(account),
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

    @app.post("/api/accounts/register", status_code=201)
    def register_account(request: Request, payload: AccountPayload,
                         pintor_account: str | None = Cookie(default=None)):
        client = request_ip(request)
        allowed, retry_after = limiter.allow(
            f"account-register:{client}", account_limit, account_window,
        )
        if not allowed:
            return api_error(request, 429, "too many account attempts", retry_after)
        try:
            account = accounts.register(payload.username, payload.password)
        except DuplicateUsername as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except AccountError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        accounts.revoke(pintor_account)
        token, _ = accounts.create_session(account["id"])
        response = JSONResponse({"account": account}, status_code=201)
        set_account_cookies(response, token, account)
        return response

    @app.post("/api/accounts/login")
    def login_account(request: Request, payload: AccountPayload,
                      pintor_account: str | None = Cookie(default=None)):
        client = request_ip(request)
        allowed, retry_after = limiter.allow(
            f"account-login:{client}", account_limit, account_window,
        )
        if not allowed:
            return api_error(request, 429, "too many account attempts", retry_after)
        try:
            account = accounts.authenticate(payload.username, payload.password)
        except InvalidCredentials as error:
            raise HTTPException(status_code=401, detail="invalid username or password") from error
        accounts.revoke(pintor_account)
        token, _ = accounts.create_session(account["id"])
        response = JSONResponse({"account": account})
        set_account_cookies(response, token, account)
        return response

    @app.get("/api/account")
    def current_account(pintor_account: str | None = Cookie(default=None)):
        return {"account": require_account(pintor_account)}

    @app.post("/api/accounts/logout", status_code=204)
    def logout_account(pintor_account: str | None = Cookie(default=None)):
        accounts.revoke(pintor_account)
        response = Response(status_code=204)
        response.delete_cookie(ACCOUNT_COOKIE, path="/api", secure=secure_cookie, samesite="strict")
        response.delete_cookie("pintor_session", path="/api", secure=secure_cookie,
                               samesite="strict")
        return response

    @app.get("/api/account/jobs")
    def account_jobs(pintor_account: str | None = Cookie(default=None)):
        account = require_account(pintor_account)
        owner_token = _account_owner_token(session_secret, account["id"])
        return {"jobs": store.list_owned(owner_token)}

    @app.get("/api/capabilities")
    def capabilities():
        from .labels.conventions import list_conventions

        return {
            "version": "0.4.0",
            "beta": True,
            "input": "pdf-vector-or-raster-with-visible-colour-codes",
            "page_modes": ["vector-text", "raster-ocr"],
            "scope": "selected-pages-in-one-preserved-document",
            "max_upload_bytes": max_bytes,
            "max_document_pages": MAX_DOCUMENT_PAGES,
            "max_selected_pages": MAX_SELECTED_PAGES,
            "max_analysis_pixels": MAX_ANALYSIS_PIXELS,
            "max_concurrent_jobs": max(1, max_concurrent_jobs),
            "retention_hours": store.retention_seconds // 3600,
            "conventions": ["auto", *list_conventions()],
            "model": "operator-mounted-revalidated-artifact-or-conservative-baseline",
            "automatic_training": False,
            "accounts_required": accounts_required,
        }

    @app.post("/api/jobs", status_code=202)
    async def create_job(request: Request, background: BackgroundTasks,
                         file: UploadFile = File(...),
                         page: int = Form(0), pages: str = Form(""),
                         convention: str = Form("auto"),
                         consent_learning: bool = Form(False),
                         pintor_session: str | None = Cookie(default=None),
                         pintor_account: str | None = Cookie(default=None)):
        client = request_ip(request)
        allowed, retry_after = limiter.allow(f"job:{client}", job_limit, job_window)
        if not allowed:
            return api_error(request, 429, "job creation rate limit exceeded", retry_after)
        session_id, account = resolve_owner(pintor_account, pintor_session)
        content = await file.read(max_bytes + 1)
        try:
            selected_pages = parse_page_selection(pages) if pages.strip() else [page]
            state = store.create(content, file.filename, selected_pages, convention,
                                 consent_learning, max_bytes, _owner_hash(session_id),
                                 max_storage_bytes=max_storage_bytes, account=account)
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
    def job_status(job_id: str, pintor_session: str | None = Cookie(default=None),
                   pintor_account: str | None = Cookie(default=None)):
        try:
            owner_token, _ = resolve_owner(pintor_account, pintor_session)
            return _public_state(store.read_owned(job_id, owner_token))
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="job not found") from error

    @app.get("/api/jobs/{job_id}/preview/{kind}")
    def preview(job_id: str, kind: str, page: int | None = None,
                pintor_session: str | None = Cookie(default=None),
                pintor_account: str | None = Cookie(default=None)):
        if kind not in {"original", "painted"}:
            raise HTTPException(status_code=404, detail="preview not found")
        try:
            owner_token, _ = resolve_owner(pintor_account, pintor_session)
            state = store.read_owned(job_id, owner_token)
            page_index = state["page"] if page is None else page
            if page_index not in (state.get("selected_pages") or [state["page"]]):
                raise JobNotFound(job_id)
            name = f"{kind}-p{page_index}.jpg"
            return FileResponse(store.artifact(job_id, name, owner_token),
                                media_type="image/jpeg",
                                headers={"Cache-Control": "private, no-store"})
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="preview not found") from error

    @app.get("/api/jobs/{job_id}/download")
    def download(job_id: str, pintor_session: str | None = Cookie(default=None),
                 pintor_account: str | None = Cookie(default=None)):
        try:
            owner_token, _ = resolve_owner(pintor_account, pintor_session)
            state = store.read_owned(job_id, owner_token)
            stem = Path(state["original_name"]).stem[:80]
            return FileResponse(store.artifact(job_id, "painted.pdf", owner_token),
                                media_type="application/pdf",
                                filename=f"{stem}-painted.pdf",
                                headers={"Cache-Control": "private, no-store"})
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="painted PDF not found") from error

    @app.post("/api/jobs/{job_id}/feedback", status_code=202)
    def feedback(job_id: str, payload: FeedbackPayload,
                 pintor_session: str | None = Cookie(default=None),
                 pintor_account: str | None = Cookie(default=None)):
        try:
            owner_token, account = resolve_owner(pintor_account, pintor_session)
            record = store.add_feedback(job_id, payload.model_dump(), owner_token, account=account)
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="job not found") from error
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return {"id": record["id"], "status": record["status"],
                "learning": record["consent_learning"]}

    @app.delete("/api/jobs/{job_id}", status_code=204)
    def delete_job(job_id: str, pintor_session: str | None = Cookie(default=None),
                   pintor_account: str | None = Cookie(default=None)):
        try:
            owner_token, _ = resolve_owner(pintor_account, pintor_session)
            store.delete_owned(job_id, owner_token)
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="job not found") from error
        return Response(status_code=204)

    @app.get("/api/admin/feedback")
    def admin_feedback_list(pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        return {"feedback": store.list_feedback()}

    @app.get("/api/admin/feedback/{feedback_id}")
    def admin_feedback_detail(feedback_id: str,
                              pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        try:
            return {"feedback": store.get_feedback(feedback_id)}
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="feedback not found") from error

    @app.get("/api/admin/feedback/{feedback_id}/preview/{kind}")
    def admin_feedback_preview(feedback_id: str, kind: str, page: int,
                               pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        if kind not in {"original", "painted"}:
            raise HTTPException(status_code=404, detail="preview not found")
        try:
            artifact = store.feedback_artifact(feedback_id, f"{kind}-p{page}.jpg")
            return FileResponse(artifact, media_type="image/jpeg",
                                headers={"Cache-Control": "private, no-store"})
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="preview not found") from error

    @app.get("/api/admin/feedback/{feedback_id}/document/{kind}")
    def admin_feedback_document(feedback_id: str, kind: str,
                                pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        names = {"source": "source.pdf", "painted": "painted.pdf"}
        if kind not in names:
            raise HTTPException(status_code=404, detail="document not found")
        try:
            artifact = store.feedback_artifact(feedback_id, names[kind])
            return FileResponse(artifact, media_type="application/pdf",
                                headers={"Cache-Control": "private, no-store"})
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="document not found") from error

    @app.post("/api/admin/feedback/{feedback_id}/decision")
    def admin_feedback_decision(feedback_id: str, payload: DecisionPayload,
                                pintor_account: str | None = Cookie(default=None)):
        reviewer = require_admin(pintor_account)
        try:
            record = store.adjudicate_feedback(
                feedback_id, payload.decision, payload.note, reviewer,
            )
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="feedback not found") from error
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return {"feedback": record}

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
