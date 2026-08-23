"""Private-job web API for the Pintor beta.

The browser uploads one PDF and receives only random-id URLs for the painted page, previews, and
review submission. Source files remain outside the served Engenharia NATA tree. Human feedback is
copied into the training inbox only after explicit consent; a single review never changes the
production model directly.
"""
import asyncio
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
    ACCOUNT_COOKIE, AccountError, AccountStore, AccountSuspended, DuplicateUsername,
    InvalidCredentials, LastAdministrator,
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
# Neither the length of a manual nor the number of pages one job may paint is capped: a whole
# wiring manual is a legitimate job. Page notation still needs a ceiling, because "1-999999999"
# would expand into a list that exhausts memory before the PDF is even opened.
MAX_PAGE_NUMBER = 100_000
MAX_PAGE_SIDE_PT = 12_000
MAX_PAGE_AREA_PT2 = 24_000_000
ANALYSIS_DPI = 200
MAX_ANALYSIS_PIXELS = 75_000_000
BETA_COOKIE = "pintor_beta"
BETA_COOKIE_PURPOSE = b"pintor-beta-access-v1"
ACCOUNT_OWNER_PURPOSE = b"pintor-account-owner-v1:"
FEEDBACK_ID_RE = re.compile(r"^[a-f0-9]{32}$")
ROUND_ID_RE = re.compile(r"^[a-f0-9]{32}$")
MAX_ROUND_NAME = 80
ACTIVE_JOB_STATUSES = frozenset({"queued", "processing"})
# Why an administrator cannot erase a report yet. The console localizes its own copy; these
# strings are the API's answer to a direct call.
REMOVAL_BLOCKED_MESSAGES = {
    "not-adjudicated": "an expert must decide this report before it can be removed",
    "awaiting-clarification": "this report is waiting for its author to clarify it",
    "round-pending": "this report has not entered an improvement round yet",
    "round-open": "close the improvement round before removing its reports",
}


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


class ProcessingQueue:
    """First-in, first-out admission to the single painting slot.

    The beta paints one file at a time on purpose: a wiring sweep is memory-hungry and the host is
    capped at 3 GB and 2 CPUs. A plain semaphore already serialised the work, but it granted the
    slot in wake-up order and told nobody where they stood. This grants it in arrival order and can
    answer "how many files are ahead of mine", which is the whole difference between a wait and a
    hang for someone who uploaded ten manuals.
    """

    def __init__(self, slots: int = 1):
        self._condition = threading.Condition()
        self._waiting: deque[str] = deque()
        self._running: list[str] = []
        self._slots = max(1, slots)

    def enqueue(self, job_id: str) -> int:
        with self._condition:
            if job_id not in self._waiting and job_id not in self._running:
                self._waiting.append(job_id)
            return self._position(job_id)

    def _position(self, job_id: str) -> int:
        if job_id in self._running:
            return 0
        try:
            return self._waiting.index(job_id) + 1
        except ValueError:
            return 0

    def position(self, job_id: str) -> int:
        with self._condition:
            return self._position(job_id)

    def snapshot(self) -> dict:
        with self._condition:
            return {"running": list(self._running), "waiting": list(self._waiting)}

    def _may_start(self, job_id: str) -> bool:
        return len(self._running) < self._slots and bool(self._waiting) \
            and self._waiting[0] == job_id

    def acquire(self, job_id: str) -> None:
        """Block until this job is at the head of the queue and a slot is free."""
        with self._condition:
            if job_id not in self._waiting and job_id not in self._running:
                self._waiting.append(job_id)
            while not self._may_start(job_id):
                if job_id in self._running:
                    return
                self._condition.wait(timeout=1.0)
            self._waiting.remove(job_id)
            self._running.append(job_id)

    def release(self, job_id: str) -> None:
        with self._condition:
            if job_id in self._running:
                self._running.remove(job_id)
            self._condition.notify_all()

    def forget(self, job_id: str) -> None:
        with self._condition:
            if job_id in self._waiting:
                self._waiting.remove(job_id)
            self._condition.notify_all()


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
    if not isinstance(value, str) or not value.strip() or len(value) > 400:
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
        if first < 1 or last < first or last > MAX_PAGE_NUMBER:
            raise InvalidUpload(
                f"pages must be ascending numbers between 1 and {MAX_PAGE_NUMBER}"
            )
        for page_number in range(first, last + 1):
            page_index = page_number - 1
            if page_index not in seen:
                selected.append(page_index)
                seen.add(page_index)
    return selected


def _public_state(state: dict) -> dict:
    allowed = {
        "id", "status", "stage", "original_name", "page", "selected_pages", "pages",
        "page_count", "convention",
        "requested_convention", "convention_confidence", "created_at", "updated_at", "metrics",
        "processing_mode", "decline_reason", "error", "preview_original", "preview_painted",
        "download", "feedback_id", "current_page", "completed_pages", "selected_page_count",
        "page_discovery", "discovery", "queue_position", "finished_at", "source_bytes",
        "scanned_pages", "expires_at", "shared_for_improvement",
    }
    return {key: state[key] for key in allowed if key in state}


def _public_engineering_semantics(analysis: dict | None) -> dict | None:
    """Bounded semantic explanation for job/admin UIs; per-run geometry stays in private reports."""
    if not isinstance(analysis, dict):
        return None
    allowed = {
        "schema", "page_grammar", "decision_order", "object_roles", "physical_boundaries",
        "approved_claims", "abstained_claim_count", "colour_sources", "geometry_sources",
        "release_safe", "invariants", "notes", "semantic_abstentions",
    }
    return {key: analysis[key] for key in allowed if key in analysis}


class JobStore:
    """Filesystem-backed beta job store with random, path-safe identifiers."""

    def __init__(self, root: str | Path = DEFAULT_WORKSPACE, retention_hours: int = 24):
        self.root = Path(root).resolve()
        self.jobs = self.root / "jobs"
        self.training = self.root / "training_feedback"
        # Improvement rounds live outside the training inbox so the feedback globs stay exact.
        self.rounds = self.root / "improvement_rounds"
        # The service is not an archive. An uploaded manual is held long enough to be downloaded
        # and then erased; the only thing that outlives the window is what its owner deliberately
        # shared by marking errors on it.
        self.retention_seconds = max(1, retention_hours) * 3600
        # Deployments point TMPDIR here so a 200 MB upload spools onto the data volume instead of
        # the container's small RAM-backed /tmp.
        self.spool = self.root / "tmp"
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.training.mkdir(parents=True, exist_ok=True)
        self.rounds.mkdir(parents=True, exist_ok=True)
        self.spool.mkdir(parents=True, exist_ok=True)

    def job_dir(self, job_id: str) -> Path:
        if not JOB_ID_RE.fullmatch(job_id):
            raise JobNotFound(job_id)
        path = (self.jobs / job_id).resolve()
        if path.parent != self.jobs:
            raise JobNotFound(job_id)
        if not path.is_dir():
            raise JobNotFound(job_id)
        return path

    def job_dir_exists(self, job_id: str) -> bool:
        return (self.jobs / job_id).is_dir()

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

    def create(self, content: bytes | Path, filename: str | None, pages: list[int] | int,
               convention: str, consent_learning: bool, max_bytes: int, owner_hash: str,
               max_storage_bytes: int = 0, account: dict | None = None,
               max_active_jobs: int = 20, max_owner_bytes: int = 0) -> dict:
        """Create a job from PDF bytes, or from a file already streamed to disk.

        A 200 MB manual must never be held in memory to be checked, so the HTTP layer streams the
        upload to a temporary file and hands over the path.
        """
        staged = Path(content) if isinstance(content, (str, Path)) else None
        if staged is not None:
            size = staged.stat().st_size
            with staged.open("rb") as handle:
                signature = handle.read(5)
        else:
            size = len(content)
            signature = content[:5]
        if not size or size > max_bytes:
            raise InvalidUpload("PDF is empty or exceeds the upload limit")
        if signature != b"%PDF-":
            raise InvalidUpload("file does not have a PDF signature")
        self.cleanup_expired()
        if max_owner_bytes and self.bytes_for_owner_hash(owner_hash) + size > max_owner_bytes:
            raise InvalidUpload(
                "this account has filled its storage; delete a drawing to make room"
            )
        if max_storage_bytes and self.directory_bytes(self.root) + size > max_storage_bytes:
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
        if max_active_jobs and active >= max_active_jobs:
            raise InvalidUpload(
                f"this account already has {max_active_jobs} files waiting or being painted"
            )

        selected_pages = [pages] if isinstance(pages, int) else list(pages)
        if any(not isinstance(page, int) or page < 0 for page in selected_pages):
            raise InvalidUpload("invalid selected page")
        selected_pages = list(dict.fromkeys(selected_pages))
        # No selection means "sweep the document and paint every wiring diagram in it".
        discovery = not selected_pages

        job_id = uuid.uuid4().hex
        directory = self.jobs / job_id
        directory.mkdir(mode=0o700)
        source = directory / "source.pdf"
        digest = hashlib.sha256()
        if staged is not None:
            os.replace(staged, source)
            with source.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
        else:
            source.write_bytes(content)
            digest.update(content)

        now = int(time.time())
        state = {
            "id": job_id,
            "status": "queued",
            "stage": "queued",
            "original_name": _safe_name(filename),
            "page": selected_pages[0] if selected_pages else None,
            "selected_pages": selected_pages,
            "selected_page_count": len(selected_pages),
            "page_discovery": "auto" if discovery else "manual",
            "requested_convention": convention,
            "consent_learning": bool(consent_learning),
            "source_bytes": size,
            "source_sha256": digest.hexdigest(),
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
        reported_pages = sorted({item["page"] for item in annotations})
        engineering_semantics = {
            str(item.get("page")): _public_engineering_semantics(
                item.get("engineering_semantics"))
            for item in state.get("pages", ())
            if item.get("page") in reported_pages and item.get("engineering_semantics")
        }
        record = {
            "id": feedback_id,
            "job_id": job_id,
            "source_sha256": state["source_sha256"],
            "document_group_candidate": state["source_sha256"],
            "publication_group": None,
            "page": annotations[0]["page"] if len({item["page"] for item in annotations}) == 1
                else None,
            "pages": reported_pages,
            "convention": state.get("convention"),
            "engineering_semantics": engineering_semantics,
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
                "pages": state.get("pages", []),
                "metrics": state.get("metrics", {}),
                "source_sha256": state.get("source_sha256"),
            })
            _atomic_json(inbox / "feedback.json", record)

        self.update(job_id, status="revision-requested", stage="human-review",
                    feedback_id=feedback_id)
        return record

    def list_all(self) -> list[dict]:
        """Every stored job, used only by restart recovery inside the service."""
        records = []
        for state_path in self.jobs.glob("*/state.json"):
            try:
                records.append(json.loads(state_path.read_text(encoding="utf-8")))
            except Exception:
                continue
        return records

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

    def count_owned(self, session_id: str) -> int:
        return len(self.list_owned(session_id))

    def delete_all_owned(self, session_id: str) -> int:
        """Erase every job of one owner, including copies still awaiting adjudication."""
        removed = 0
        for record in self.list_owned(session_id):
            try:
                self.delete_owned(record["id"], session_id)
            except (JobNotFound, OSError):
                continue
            removed += 1
        return removed

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
            "review_note", "reviewer_username", "decision", "review_history", "round_id",
            "engineering_semantics",
        }
        payload = {key: record[key] for key in allowed if key in record}
        if not detailed:
            payload["annotation_count"] = len(record.get("annotations") or [])
            payload.pop("annotations", None)
            payload.pop("review_history", None)
            payload.pop("engineering_semantics", None)
        return payload

    def removal_state(self, record: dict) -> dict:
        """Whether an administrator may erase this report, and why not when they may not.

        A report is the only thing a reporter deliberately left behind, so it is erasable only
        once it is spent. Accepted, that means the batch which carried it into the code was
        closed; a report the reporter never shared for learning cannot enter a batch at all, so
        an accepted one is already spent. Rejected is spent in the other direction: it can never
        enter a batch either. Only an undecided report and one awaiting its author's clarification
        are still live.
        """
        decision = record.get("decision")
        if not decision:
            return {"deletable": False, "reason": "not-adjudicated"}
        if decision == "needs-clarification":
            # Still live: the author was asked for more and may yet answer.
            return {"deletable": False, "reason": "awaiting-clarification"}
        if decision == "rejected":
            # A rejected report can never enter an improvement round, so it is already spent.
            return {"deletable": True, "reason": None}
        if not record.get("consent_learning"):
            return {"deletable": True, "reason": None}
        round_id = record.get("round_id")
        if not round_id:
            return {"deletable": False, "reason": "round-pending"}
        try:
            batch = self.read_round(str(round_id))
        except (JobNotFound, OSError, ValueError):
            # The batch is unreadable, so nothing proves the report was already used.
            return {"deletable": False, "reason": "round-pending"}
        if batch.get("status") != "closed":
            return {"deletable": False, "reason": "round-open"}
        return {"deletable": True, "reason": None}

    def _with_removal_state(self, record: dict, payload: dict) -> dict:
        state = self.removal_state(record)
        payload["deletable"] = state["deletable"]
        payload["delete_blocked_reason"] = state["reason"]
        return payload

    def list_feedback(self) -> list[dict]:
        records = [
            self._with_removal_state(record, self._public_feedback(record))
            for _, record in self._feedback_locations().values()
        ]
        return sorted(records, key=lambda item: item.get("created_at", 0), reverse=True)

    def get_feedback(self, feedback_id: str) -> dict:
        if not FEEDBACK_ID_RE.fullmatch(feedback_id):
            raise JobNotFound(feedback_id)
        located = self._feedback_locations().get(feedback_id)
        if not located:
            raise JobNotFound(feedback_id)
        return self._with_removal_state(
            located[1], self._public_feedback(located[1], detailed=True),
        )

    def delete_feedback(self, feedback_id: str) -> dict:
        """Erase an accepted, already-curated report and everything it kept alive.

        The closed round's manifest already froze what the report contributed, so removing it
        loses no history: the round detail simply reports the item as missing from then on. The
        reporter's job stops being protected from the retention sweep, which is the point — the
        drawing was only held because a report referenced it.
        """
        if not FEEDBACK_ID_RE.fullmatch(feedback_id):
            raise JobNotFound(feedback_id)
        located = self._feedback_locations().get(feedback_id)
        if not located:
            raise JobNotFound(feedback_id)
        record = located[1]
        state = self.removal_state(record)
        if not state["deletable"]:
            raise ValueError(REMOVAL_BLOCKED_MESSAGES[state["reason"]])

        job_id = str(record.get("job_id") or "")
        live_path = self.jobs / job_id / "feedback" / f"{feedback_id}.json"
        try:
            live_path.unlink()
        except OSError:
            pass
        shutil.rmtree(self.training / feedback_id, ignore_errors=True)
        # Give the reporter back a plain finished job instead of one pointing at a report that
        # no longer exists; the retention sweep may now collect it like any other.
        try:
            job_state = self.read(job_id)
        except (JobNotFound, ValueError, OSError):
            job_state = None
        if job_state is not None and job_state.get("feedback_id") == feedback_id:
            job_state.pop("feedback_id", None)
            job_state["status"] = "ready"
            job_state["stage"] = "review"
            job_state["updated_at"] = int(time.time())
            _atomic_json(self.job_dir(job_id) / "state.json", job_state)
        return {"id": feedback_id, "job_id": job_id, "round_id": record.get("round_id")}

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
        current_round = self.open_round()
        joined = (
            decision == "accepted" and record.get("consent_learning") and current_round is not None
        )
        if joined:
            record["round_id"] = current_round["id"]
        elif record.get("round_id"):
            # A report that stops being accepted leaves the batch it had joined.
            previous = record["round_id"]
            record["round_id"] = None
            try:
                stale = self.read_round(previous)
                if stale.get("status") == "open":
                    self._write_round_membership(stale, feedback_id, False)
            except JobNotFound:
                pass
        live_path = self.jobs / str(record.get("job_id")) / "feedback" / f"{feedback_id}.json"
        archive_path = self.training / feedback_id / "feedback.json"
        if live_path.is_file():
            _atomic_json(live_path, record)
        if archive_path.is_file():
            _atomic_json(archive_path, record)
        if joined:
            self._write_round_membership(current_round, feedback_id, True)
        return self._with_removal_state(record, self._public_feedback(record, detailed=True))

    # ---- Improvement rounds -------------------------------------------------------------
    # A round is a curated batch of expert-accepted reports. Closing one writes an offline
    # manifest; the web service still never trains or promotes a model by itself.

    def _round_path(self, round_id: str) -> Path:
        if not ROUND_ID_RE.fullmatch(round_id):
            raise JobNotFound(round_id)
        path = (self.rounds / f"{round_id}.json").resolve()
        if path.parent != self.rounds:
            raise JobNotFound(round_id)
        return path

    def read_round(self, round_id: str) -> dict:
        path = self._round_path(round_id)
        if not path.is_file():
            raise JobNotFound(round_id)
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _public_round(record: dict) -> dict:
        return {
            "id": record.get("id"),
            "name": record.get("name"),
            "status": record.get("status", "open"),
            "created_at": record.get("created_at"),
            "created_by": record.get("created_by"),
            "closed_at": record.get("closed_at"),
            "closed_by": record.get("closed_by"),
            "note": record.get("note", ""),
            "item_count": len(record.get("items") or []),
        }

    def list_rounds(self) -> list[dict]:
        records = []
        for path in self.rounds.glob("*.json"):
            if path.name.endswith("-manifest.json"):
                continue
            try:
                records.append(self._public_round(json.loads(path.read_text(encoding="utf-8"))))
            except Exception:
                continue
        return sorted(records, key=lambda item: item.get("created_at") or 0, reverse=True)

    def open_round(self) -> dict | None:
        for path in sorted(self.rounds.glob("*.json")):
            if path.name.endswith("-manifest.json"):
                continue
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if record.get("status") == "open":
                return record
        return None

    def create_round(self, name: str, admin: dict) -> dict:
        label = str(name or "").strip()[:MAX_ROUND_NAME]
        if not label:
            raise ValueError("the round needs a name")
        if self.open_round():
            raise ValueError("close the open round before starting another one")
        record = {
            "id": uuid.uuid4().hex,
            "name": label,
            "status": "open",
            "created_at": int(time.time()),
            "created_by": admin.get("username"),
            "closed_at": None,
            "closed_by": None,
            "note": "",
            "items": [],
        }
        _atomic_json(self._round_path(record["id"]), record)
        return self._public_round(record)

    def _write_round_membership(self, record: dict, feedback_id: str, include: bool) -> dict:
        items = [item for item in (record.get("items") or []) if item != feedback_id]
        if include:
            items.append(feedback_id)
        record["items"] = items
        _atomic_json(self._round_path(record["id"]), record)
        return record

    def _tag_feedback_round(self, feedback_id: str, round_id: str | None) -> None:
        located = self._feedback_locations().get(feedback_id)
        if not located:
            return
        record = dict(located[1])
        record["round_id"] = round_id
        live_path = self.jobs / str(record.get("job_id")) / "feedback" / f"{feedback_id}.json"
        archive_path = self.training / feedback_id / "feedback.json"
        for path in (live_path, archive_path):
            if path.is_file():
                _atomic_json(path, record)

    def set_round_item(self, round_id: str, feedback_id: str, include: bool) -> dict:
        record = self.read_round(round_id)
        if record.get("status") != "open":
            raise ValueError("a closed round can no longer change")
        if include:
            report = self.get_feedback(feedback_id)
            if report.get("decision") != "accepted":
                raise ValueError("only expert-accepted reports enter an improvement round")
            for other in self.list_rounds():
                if other["id"] == round_id:
                    continue
                if feedback_id in (self.read_round(other["id"]).get("items") or []):
                    raise ValueError("this report already belongs to another round")
        record = self._write_round_membership(record, feedback_id, include)
        self._tag_feedback_round(feedback_id, round_id if include else None)
        return self._public_round(record)

    def round_detail(self, round_id: str) -> dict:
        record = self.read_round(round_id)
        located = self._feedback_locations()
        items = []
        for feedback_id in record.get("items") or []:
            found = located.get(feedback_id)
            if not found:
                # The reporter deleted the job, or the account was removed with its data.
                items.append({"id": feedback_id, "missing": True})
                continue
            items.append({**self._public_feedback(found[1]), "missing": False})
        payload = self._public_round(record)
        payload["items"] = items
        return payload

    def close_round(self, round_id: str, admin: dict, note: str = "") -> dict:
        record = self.read_round(round_id)
        if record.get("status") != "open":
            raise ValueError("this round is already closed")
        detail = self.round_detail(round_id)
        now = int(time.time())
        record.update({
            "status": "closed",
            "closed_at": now,
            "closed_by": admin.get("username"),
            "note": str(note or "").strip()[:2000],
        })
        _atomic_json(self._round_path(round_id), record)
        manifest = {
            "round": self._public_round(record),
            "generated_at": now,
            "automatic_training": False,
            "reports": [],
        }
        for item in detail["items"]:
            if item.get("missing"):
                manifest["reports"].append({"id": item["id"], "missing": True})
                continue
            full = self.get_feedback(item["id"])
            inbox = self.training / item["id"]
            manifest["reports"].append({
                **full,
                "artifacts_present": sorted(
                    path.name for path in inbox.glob("*")
                ) if inbox.is_dir() else [],
            })
        _atomic_json(self.rounds / f"{round_id}-manifest.json", manifest)
        return self._public_round(record)

    def shared_job_ids(self) -> set[str]:
        """Jobs whose owner marked errors on them and agreed to share the result.

        Those are the only uploads that outlive the retention window, because they are the ones
        somebody deliberately contributed. Everything else is transient by design.

        An expert rejection ends the contribution, so the drawing rejoins the retention contract
        instead of being held forever by a report that will never improve anything. The evidence
        the reporter shared is not lost with it: a consented report keeps its own copy of the
        source, result and previews in the training inbox, which the sweep never touches.
        """
        shared = set()
        for _, record in self._feedback_locations().values():
            if record.get("decision") == "rejected":
                continue
            if record.get("consent_learning") and record.get("job_id"):
                shared.add(str(record["job_id"]))
        return shared

    def cleanup_expired(self, now: int | None = None) -> int:
        """Erase expired terminal jobs that were not deliberately shared for improvement.

        A queued or running job has no download window yet. Its final state update starts the
        retention clock, so a long queue or a legitimate multi-hour manual cannot be removed from
        underneath the worker.
        """
        threshold = (now or int(time.time())) - self.retention_seconds
        protected = self.shared_job_ids()
        removed = 0
        for directory in self.jobs.iterdir():
            state_path = directory / "state.json"
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if str(state.get("id")) in protected:
                continue
            if state.get("status") in ACTIVE_JOB_STATUSES:
                continue
            if state.get("updated_at", 0) >= threshold:
                continue
            shutil.rmtree(directory, ignore_errors=True)
            removed += 1
        return removed

    @staticmethod
    def directory_bytes(directory: Path) -> int:
        total = 0
        for path in directory.rglob("*"):
            try:
                if path.is_file():
                    total += path.stat().st_size
            except OSError:
                continue
        return total

    def owner_bytes(self, session_id: str) -> int:
        """Disk held by one owner, so a permanent archive can still carry a quota."""
        return self.bytes_for_owner_hash(_owner_hash(session_id))

    def bytes_for_owner_hash(self, owner_hash: str) -> int:
        total = 0
        for state_path in self.jobs.glob("*/state.json"):
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if state.get("owner_hash") != owner_hash:
                continue
            total += self.directory_bytes(state_path.parent)
        return total

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


def inspect_pdf_source(pdf_path: Path, page_indices: list[int] | int,
                       tolerate_oversized: bool = False) -> dict:
    """Parse and validate an untrusted source inside the isolated job process.

    ``tolerate_oversized`` is used by the discovery sweep: one page too large for the analysis
    budget must not sink a whole manual, so it is reported and skipped instead of raising.
    """
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
        selected_pages = [page_indices] if isinstance(page_indices, int) else list(page_indices)
        if not selected_pages:
            raise InvalidUpload("no page to paint")
        if any(index < 0 or index >= page_count for index in selected_pages):
            raise InvalidUpload(f"selected pages must be between 1 and {page_count}")

        dimensions = {}
        oversized = []
        for index in selected_pages:
            rect = document[index].rect
            values = (rect.width, rect.height, rect.width * rect.height)
            reason = None
            if not all(math.isfinite(value) and value > 0 for value in values):
                reason = f"page {index + 1} has invalid dimensions"
            elif max(values[:2]) > MAX_PAGE_SIDE_PT or values[2] > MAX_PAGE_AREA_PT2:
                reason = f"page {index + 1} exceeds the beta dimension limit"
            elif values[2] * (ANALYSIS_DPI / 72.0) ** 2 > MAX_ANALYSIS_PIXELS:
                reason = f"page {index + 1} exceeds the processing budget"
            if reason:
                if not tolerate_oversized:
                    raise InvalidUpload(reason)
                oversized.append({"page": index, "reason": reason})
                continue
            dimensions[str(index)] = {
                "page_width_pt": rect.width,
                "page_height_pt": rect.height,
            }
        kept = [index for index in selected_pages if str(index) in dimensions]
        if not kept:
            raise InvalidUpload("no selected page fits the processing budget")
        return {
            "page_count": page_count,
            "page_dimensions": dimensions,
            "selected_pages": kept,
            "oversized_pages": oversized,
            # Legacy fields keep old feedback fixtures and one-page clients compatible.
            "page_width_pt": dimensions[str(kept[0])]["page_width_pt"],
            "page_height_pt": dimensions[str(kept[0])]["page_height_pt"],
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


def _release_page_caches() -> None:
    """Drop MuPDF's per-page store between pages.

    Without this a sweep grows steadily across a long manual: every page that has been touched
    keeps its parsed content, fonts and decoded images in the shared store, and the process only
    gives them back when the document is closed -- which, for a single job, is at the very end.
    """
    import gc

    try:
        import fitz

        fitz.TOOLS.store_shrink(100)
    except Exception:
        pass
    gc.collect()


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


def discover_job_pages(store: JobStore, job_id: str, source: Path, state: dict) -> dict | None:
    """Sweep a whole document for wiring diagrams; returns None when nothing is paintable."""
    from .tools.discover_pages import scan_document

    store.update(job_id, stage="scanning-document")
    def report_progress(scanned: int, total: int) -> None:
        store.update(job_id, stage="scanning-document", scanned_pages=scanned,
                     page_count=total)

    report = scan_document(
        source, state.get("requested_convention", "auto"),
        max_pages=int(os.getenv("PINTOR_SCAN_MAX_PAGES", "0")),
        progress=report_progress,
    )
    summary = {
        "page_count": report["page_count"],
        "pages_scanned": report["pages_scanned"],
        "wiring_document": report["wiring_document"],
        "confirmed": len(report["confirmed"]),
        "candidates": len(report["candidates"]),
        "excluded_non_wiring": len(report["excluded_non_wiring"]),
        "already_colored": len(report["already_colored"]),
        # Evidence is kept only for the pages that were chosen, so the operator can audit a sweep.
        "evidence": report["evidence"][:500],
    }
    if not report["selected"]:
        store.update(
            job_id, status="declined", stage="no-wiring-page", discovery=summary,
            page_count=report["page_count"],
            decline_reason="no page in this document carries readable wire colour codes",
            completed_pages=0, current_page=None,
        )
        return None
    return store.update(
        job_id, selected_pages=report["selected"], page=report["selected"][0],
        selected_page_count=len(report["selected"]), discovery=summary,
        page_count=report["page_count"],
    )


def process_job(store: JobStore, job_id: str) -> None:
    """Paint selected pages sequentially and release one preserved multi-page PDF."""
    try:
        state = store.update(job_id, status="processing", stage="reading-diagram")
        directory = store.job_dir(job_id)
        source = directory / "source.pdf"
        selected_pages = list(state.get("selected_pages") or [])
        if not selected_pages and state.get("page") is not None:
            selected_pages = [state["page"]]
        sweeping = not selected_pages
        if sweeping:
            state = discover_job_pages(store, job_id, source, state)
            if state is None:
                return
            selected_pages = state["selected_pages"]
        # A page too large to analyse sinks an explicit request, but never a whole-manual sweep.
        state = store.update(
            job_id, **inspect_pdf_source(source, selected_pages, tolerate_oversized=sweeping),
        )
        selected_pages = state["selected_pages"]
        generated = directory / "generated"
        generated.mkdir(parents=True, exist_ok=True)
        page_results = []
        policy, classifier = _load_models()
        paint_budget = int(os.getenv("PINTOR_PAINT_PIXEL_BUDGET", "60000000"))
        # Previews are rendered up front only for the pages a reviewer opens first; the rest are
        # rendered on demand. On a 300-page sweep the eager version alone would write gigabytes.
        eager_previews = int(os.getenv("PINTOR_EAGER_PREVIEWS", "12"))
        painted = directory / "painted.pdf"
        overlay_ocg = None
        attached = 0

        for position, page_index in enumerate(selected_pages, start=1):
            store.update(
                job_id, stage="reading-diagram", current_page=page_index,
                completed_pages=position - 1, pages=page_results,
            )
            original_size = (0, 0)
            if position <= eager_previews:
                original_size = _render_preview(
                    source, page_index, directory / f"original-p{page_index}.jpg",
                )
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
                    + report.get("learned_abstentions", 0)
                    + report.get("semantic_abstentions", 0),
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
                "engineering_semantics": _public_engineering_semantics(
                    report.get("engineering_semantics")),
                "preview_original": f"/api/jobs/{job_id}/preview/original?page={page_index}",
                "metrics": page_metrics,
            }
            page_results.append(page_result)

            if report.get("declined"):
                overlay_path.unlink(missing_ok=True)
                _release_page_caches()
                continue
            if not (report.get("v2") or {}).get("passed"):
                raise RuntimeError(f"protected-region gate V2 failed on page {page_index + 1}")
            if not overlay_path.is_file():
                raise RuntimeError(f"painter did not produce page {page_index + 1} overlay")

            # Attach and verify this page NOW, then drop its PNG. Staging every overlay until the
            # end is what makes a long manual run out of disk, and it also hides a preservation
            # failure until hours of painting have already been spent.
            store.update(job_id, stage="attaching-layer", current_page=page_index)
            from .paint.raster_overlay import append_overlays, attach_overlays
            from .verify.validators import v7_preservation

            release = lambda _page, staged: Path(staged).unlink(missing_ok=True)  # noqa: E731
            if attached == 0:
                stats = attach_overlays(
                    str(source), str(painted), [(page_index, str(overlay_path))],
                    on_attached=release,
                )
                overlay_ocg = stats["ocg"]
            else:
                stats = append_overlays(
                    str(painted), [(page_index, str(overlay_path))], on_attached=release,
                )
            attached += 1
            v7 = v7_preservation(str(source), str(painted), page_index, overlay_ocg)
            if not v7.get("passed"):
                painted.unlink(missing_ok=True)
                raise RuntimeError(
                    f"source-preservation gate V7 failed on page {page_index + 1}"
                )
            page_result["metrics"]["original_preserved"] = True
            if position <= eager_previews:
                painted_size = _render_preview(
                    painted, page_index, directory / f"painted-p{page_index}.jpg",
                )
                page_result["metrics"]["preview_width"] = painted_size[0]
                page_result["metrics"]["preview_height"] = painted_size[1]
            _release_page_caches()

        if not attached:
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
                finished_at=int(time.time()),
            )
            return

        import fitz

        verification = fitz.open(painted)
        if len(verification) != state["page_count"] or verification.needs_pass:
            verification.close()
            painted.unlink(missing_ok=True)
            raise RuntimeError("generated PDF failed reopen/page-count verification")
        verification.close()
        _release_page_caches()

        # A declined page is still shown under "painted": the sheet the reviewer sees there is the
        # untouched original, which is exactly what abstention means.
        for position, item in enumerate(page_results, start=1):
            item["preview_painted"] = f"/api/jobs/{job_id}/preview/painted?page={item['page']}"
            item["metrics"].setdefault("original_preserved", True)
            preview = directory / f"painted-p{item['page']}.jpg"
            if position <= eager_previews and not preview.is_file():
                size = _render_preview(painted, item["page"], preview)
                item["metrics"]["preview_width"] = size[0]
                item["metrics"]["preview_height"] = size[1]
        _release_page_caches()

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
            preview_painted=next(
                (item["preview_painted"] for item in page_results if item.get("preview_painted")),
                None,
            ),
            download=f"/api/jobs/{job_id}/download",
            finished_at=int(time.time()),
        )
    except InvalidUpload as error:
        try:
            store.update(job_id, status="declined", stage="invalid-pdf",
                         decline_reason=str(error)[:500], finished_at=int(time.time()))
        except Exception:
            pass
    except Exception as error:
        try:
            (store.job_dir(job_id) / "painted.pdf").unlink(missing_ok=True)
            store.update(job_id, status="failed", stage="failed",
                         error="processing failed; the result was quarantined",
                         internal_error=f"{type(error).__name__}: {error}"[:1000],
                         finished_at=int(time.time()))
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
    """Run one untrusted PDF in a killable process instead of the API process.

    Supervision watches PROGRESS, not only the clock. A fixed 180-second deadline was fine while a
    job meant a handful of pages; a 400-page manual painted page by page is a healthy job that runs
    for hours, and killing it at three minutes would be indistinguishable from the feature not
    existing. So a job is killed when it stops moving (no state change for ``stall_seconds``), or
    when it passes an absolute ceiling -- never merely for being long.
    """
    import multiprocessing

    ceiling = os.getenv("PINTOR_JOB_TIMEOUT_SECONDS") or os.getenv("PINTOR_JOB_MAX_SECONDS")
    max_seconds = int(ceiling or 21_600)
    stall_seconds = int(os.getenv("PINTOR_JOB_STALL_SECONDS", "900"))
    memory_mb = int(os.getenv("PINTOR_JOB_MEMORY_MB", "2560"))
    # The CPU rlimit is a backstop against a runaway loop, not the primary bound; tying it to the
    # ceiling keeps it from cutting off legitimate long work.
    cpu_seconds = int(os.getenv("PINTOR_JOB_CPU_SECONDS", str(max_seconds)))
    context = multiprocessing.get_context("spawn")
    worker = context.Process(
        target=_worker_entry,
        args=(str(store.root), job_id, memory_mb, cpu_seconds),
        daemon=False,
    )
    worker.start()
    deadline = time.monotonic() + max_seconds
    terminal_since = None
    last_progress = time.monotonic()
    last_marker = None
    stalled = False
    terminal_states = {"ready", "declined", "failed", "revision-requested"}
    while worker.is_alive():
        now = time.monotonic()
        if now >= deadline:
            break
        worker.join(min(1.0, deadline - now))
        if not worker.is_alive():
            break
        try:
            state = store.read(job_id)
        except Exception:
            state = {}
        status = state.get("status")
        marker = (
            state.get("updated_at"), state.get("stage"), state.get("current_page"),
            state.get("completed_pages"), state.get("scanned_pages"),
        )
        if marker != last_marker:
            last_marker = marker
            last_progress = time.monotonic()
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
            if time.monotonic() - last_progress >= stall_seconds:
                stalled = True
                break
    if worker.is_alive():
        worker.terminate()
        worker.join(10)
        store.update(
            job_id, status="failed", stage="failed",
            error="ProcessingStalled: no progress for the stall window"
            if stalled else "ProcessingTimeout: beta processing time limit exceeded",
            finished_at=int(time.time()),
        )
    elif worker.exitcode != 0:
        state = store.read(job_id)
        if state.get("status") not in {"ready", "declined", "failed"}:
            store.update(job_id, status="failed", stage="failed",
                         error=f"WorkerExit: isolated worker exited with code {worker.exitcode}")


async def _cleanup_expired_periodically(store: JobStore, interval_seconds: float) -> None:
    """Keep the 24-hour contract even when the API receives no new uploads."""
    while True:
        await asyncio.sleep(interval_seconds)
        store.cleanup_expired()


def create_app(workspace_root: str | Path | None = None,
               processor: Callable[[JobStore, str], None] | None = None):
    """Create the FastAPI application without making the CLI depend on web packages."""
    from fastapi import (
        BackgroundTasks, Cookie, FastAPI, File, Form, HTTPException, Request, UploadFile,
    )
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, JSONResponse, Response
    from pydantic import BaseModel, Field

    # Uploads are transient: kept long enough to be downloaded, then erased. Only a manual whose
    # owner marked errors and agreed to share it survives the window.
    store = JobStore(workspace_root or os.getenv("PINTOR_WEB_ROOT", str(DEFAULT_WORKSPACE)),
                     retention_hours=int(os.getenv("PINTOR_RETENTION_HOURS", "24")))
    cleanup_interval_seconds = max(
        1, int(os.getenv("PINTOR_CLEANUP_INTERVAL_SECONDS", "300")),
    )
    accounts_required = os.getenv("PINTOR_ACCOUNTS_REQUIRED", "0") == "1"
    account_session_days = int(os.getenv("PINTOR_ACCOUNT_SESSION_DAYS", "30"))
    accounts = AccountStore(store.root / "accounts.sqlite3", session_days=account_session_days)
    processor = processor or process_job_isolated
    max_bytes = int(os.getenv("PINTOR_MAX_UPLOAD_MB", "200")) * 1024 * 1024
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
    max_storage_bytes = int(os.getenv("PINTOR_MAX_STORAGE_MB", "20480")) * 1024 * 1024
    max_owner_bytes = int(os.getenv("PINTOR_MAX_ACCOUNT_STORAGE_MB", "5120")) * 1024 * 1024
    max_concurrent_jobs = int(os.getenv("PINTOR_MAX_CONCURRENT_JOBS", "1"))
    account_limit = int(os.getenv("PINTOR_ACCOUNT_ATTEMPTS", "10"))
    account_window = int(os.getenv("PINTOR_ACCOUNT_WINDOW_SECONDS", "600"))
    max_active_jobs = int(os.getenv("PINTOR_MAX_ACTIVE_JOBS", "20"))
    limiter = SlidingWindowLimiter()
    queue = ProcessingQueue(max(1, max_concurrent_jobs))
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

    class AccountStatusPayload(BaseModel):
        status: str

    class AccountRolePayload(BaseModel):
        role: str

    class AccountDeletePayload(BaseModel):
        password: str = Field(min_length=1, max_length=128)

    class RoundPayload(BaseModel):
        name: str = Field(min_length=1, max_length=MAX_ROUND_NAME)

    class RoundClosePayload(BaseModel):
        note: str = Field(default="", max_length=2000)

    class RoundItemPayload(BaseModel):
        feedback_id: str
        include: bool = True

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

    def requeue_interrupted() -> None:
        """After a restart, files that were waiting or mid-paint go back to the front of the line."""
        pending = []
        for record in store.list_all():
            if record.get("status") in {"queued", "processing"}:
                pending.append(record)
        for record in sorted(pending, key=lambda item: item.get("created_at", 0)):
            store.update(record["id"], status="queued", stage="queued")
            job_id = record["id"]
            queue.enqueue(job_id)

            def resume(job_id=job_id) -> None:
                queue.acquire(job_id)
                try:
                    processor(store, job_id)
                finally:
                    queue.release(job_id)

            threading.Thread(target=resume, name=f"pintor-resume-{job_id[:8]}",
                             daemon=True).start()

    @asynccontextmanager
    async def lifespan(_app):
        store.cleanup_expired()
        if os.getenv("PINTOR_RESUME_ON_START", "1") == "1":
            requeue_interrupted()
        cleanup_task = asyncio.create_task(
            _cleanup_expired_periodically(store, cleanup_interval_seconds),
        )
        try:
            yield
        finally:
            cleanup_task.cancel()
            try:
                await cleanup_task
            except asyncio.CancelledError:
                pass

    app = FastAPI(title="Pintor beta API", version="0.5.0", docs_url=None, redoc_url=None,
                  lifespan=lifespan)
    app.state.store = store
    app.state.accounts = accounts
    app.state.queue = queue

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
        except AccountSuspended as error:
            raise HTTPException(status_code=403, detail="this account is suspended") from error
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
        """Everything this account owns: still queued, being painted, or finished.

        ``since`` is the previous sign-in, so the interface can point at what finished while the
        owner was away. Jobs older than the retention window are gone by then, by design.
        """
        account = require_account(pintor_account)
        owner_token = _account_owner_token(session_secret, account["id"])
        since = account.get("previous_login_at") or 0
        shared = store.shared_job_ids()
        jobs = []
        for record in store.list_owned(owner_token):
            if record.get("status") == "queued":
                record["queue_position"] = queue.position(record["id"])
            record["finished_since_last_login"] = bool(
                record.get("finished_at") and record["finished_at"] > since
            )
            # A shared manual has no deadline; everything else says exactly when it disappears.
            record["shared_for_improvement"] = record["id"] in shared
            record["expires_at"] = None if (
                record["shared_for_improvement"]
                or record.get("status") in ACTIVE_JOB_STATUSES
            ) else record.get("updated_at", 0) + store.retention_seconds
            jobs.append(record)
        return {
            "jobs": jobs,
            "since": since,
            "active": sum(job.get("status") in {"queued", "processing"} for job in jobs),
            "retention_hours": store.retention_seconds // 3600,
            "storage_used_bytes": store.owner_bytes(owner_token),
            "storage_limit_bytes": max_owner_bytes,
        }

    @app.delete("/api/account", status_code=204)
    def delete_own_account(request: Request, payload: AccountDeletePayload,
                           pintor_account: str | None = Cookie(default=None)):
        """Close an account: the password is retyped, then jobs and credentials both go away."""
        account = require_account(pintor_account)
        client = request_ip(request)
        allowed, retry_after = limiter.allow(
            f"account-delete:{client}", account_limit, account_window,
        )
        if not allowed:
            return api_error(request, 429, "too many account attempts", retry_after)
        try:
            accounts.authenticate(account["username"], payload.password)
        except AccountError as error:
            raise HTTPException(status_code=401, detail="invalid password") from error
        store.delete_all_owned(_account_owner_token(session_secret, account["id"]))
        try:
            accounts.delete_account(account["id"])
        except LastAdministrator as error:
            raise HTTPException(
                status_code=409, detail="the beta must keep one active administrator",
            ) from error
        response = Response(status_code=204)
        response.delete_cookie(ACCOUNT_COOKIE, path="/api", secure=secure_cookie,
                               samesite="strict")
        response.delete_cookie("pintor_session", path="/api", secure=secure_cookie,
                               samesite="strict")
        return response

    @app.get("/api/capabilities")
    def capabilities():
        from .labels.conventions import list_conventions

        return {
            "version": "0.5.0",
            "beta": True,
            "input": "pdf-vector-or-raster-with-visible-colour-codes",
            "page_modes": ["vector-text", "raster-ocr"],
            "scope": "selected-pages-in-one-preserved-document",
            "max_upload_bytes": max_bytes,
            "max_document_pages": None,
            "max_selected_pages": None,
            "page_number_ceiling": MAX_PAGE_NUMBER,
            "automatic_page_discovery": True,
            "max_active_jobs_per_account": max_active_jobs,
            "max_analysis_pixels": MAX_ANALYSIS_PIXELS,
            "max_concurrent_jobs": max(1, max_concurrent_jobs),
            "retention_hours": store.retention_seconds // 3600,
            "kept_until_deleted": False,
            "shared_reports_outlive_retention": True,
            "max_account_storage_bytes": max_owner_bytes,
            "conventions": ["auto", *list_conventions()],
            "model": "operator-mounted-revalidated-artifact-or-conservative-baseline",
            "automatic_training": False,
            "accounts_required": accounts_required,
            "self_service_account_deletion": True,
            "improvement_rounds": "expert-curated-offline-manifest",
        }

    @app.post("/api/jobs", status_code=202)
    async def create_job(request: Request, background: BackgroundTasks,
                         file: UploadFile = File(...),
                         page: int | None = Form(None), pages: str = Form(""),
                         convention: str = Form("auto"),
                         consent_learning: bool = Form(False),
                         pintor_session: str | None = Cookie(default=None),
                         pintor_account: str | None = Cookie(default=None)):
        client = request_ip(request)
        allowed, retry_after = limiter.allow(f"job:{client}", job_limit, job_window)
        if not allowed:
            return api_error(request, 429, "job creation rate limit exceeded", retry_after)
        session_id, account = resolve_owner(pintor_account, pintor_session)
        # A 200 MB manual is streamed straight to disk: reading it into the API process would
        # cost more memory than the whole painting worker is allowed.
        staging = store.root / "incoming"
        staging.mkdir(parents=True, exist_ok=True)
        staged = staging / f"{uuid.uuid4().hex}.pdf"
        received = 0
        try:
            with staged.open("wb") as handle:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    received += len(chunk)
                    if received > max_bytes:
                        raise InvalidUpload("PDF is empty or exceeds the upload limit")
                    handle.write(chunk)
            # No page notation and no explicit page: the worker sweeps the whole document.
            if pages.strip():
                selected_pages = parse_page_selection(pages)
            elif page is not None:
                selected_pages = [page]
            else:
                selected_pages = []
            state = store.create(staged, file.filename, selected_pages, convention,
                                 consent_learning, max_bytes, _owner_hash(session_id),
                                 max_storage_bytes=max_storage_bytes, account=account,
                                 max_active_jobs=max_active_jobs,
                                 max_owner_bytes=max_owner_bytes if account else 0)
        except InvalidUpload as error:
            staged.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=str(error)) from error
        except Exception:
            staged.unlink(missing_ok=True)
            raise

        job_id = state["id"]
        position = queue.enqueue(job_id)

        def run_queued_job() -> None:
            queue.acquire(job_id)
            try:
                processor(store, job_id)
            finally:
                queue.release(job_id)

        background.add_task(run_queued_job)
        response = JSONResponse(
            {**_public_state(state), "queue_position": position}, status_code=202,
        )
        # Retention no longer bounds this cookie: for an anonymous owner it is the only handle on
        # the job, and for an account it is reissued on every sign-in.
        response.set_cookie(
            "pintor_session", session_id,
            max_age=accounts.session_seconds if account else store.retention_seconds,
            httponly=True, secure=secure_cookie, samesite="strict", path="/api",
        )
        return response

    def ensure_preview(job_id: str, kind: str, page_index: int) -> None:
        """Render a preview the worker skipped.

        Long sweeps only pre-render the first pages, so the rest are produced the first time
        somebody actually looks at them and cached from then on.
        """
        directory = store.job_dir(job_id)
        target = directory / f"{kind}-p{page_index}.jpg"
        if target.is_file():
            return
        origin = directory / ("source.pdf" if kind == "original" else "painted.pdf")
        if not origin.is_file():
            raise JobNotFound(job_id)
        try:
            _render_preview(origin, page_index, target)
        except Exception as error:
            raise JobNotFound(job_id) from error

    def with_queue(state: dict) -> dict:
        payload = _public_state(state)
        if payload.get("status") == "queued":
            payload["queue_position"] = queue.position(state["id"])
        return payload

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str, pintor_session: str | None = Cookie(default=None),
                   pintor_account: str | None = Cookie(default=None)):
        try:
            owner_token, _ = resolve_owner(pintor_account, pintor_session)
            return with_queue(store.read_owned(job_id, owner_token))
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
            ensure_preview(job_id, kind, page_index)
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
            queue.forget(job_id)
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
            try:
                artifact = store.feedback_artifact(feedback_id, f"{kind}-p{page}.jpg")
            except JobNotFound:
                # The reporter's job may still hold the page even if no preview was staged.
                report = store.get_feedback(feedback_id)
                ensure_preview(str(report.get("job_id")), kind, page)
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

    @app.delete("/api/admin/feedback/{feedback_id}")
    def admin_delete_feedback(feedback_id: str,
                              pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        try:
            removed = store.delete_feedback(feedback_id)
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="feedback not found") from error
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        return {"removed": removed}

    def owner_token_for(account_id: str) -> str:
        return _account_owner_token(session_secret, account_id)

    def report_summary() -> dict[str, dict]:
        summary: dict[str, dict] = {}
        for record in store.list_feedback():
            # list_feedback() hides account_id, so reports are grouped by the stored username.
            key = record.get("account_username")
            if not key:
                continue
            entry = summary.setdefault(key, {"total": 0, "accepted": 0, "pending": 0})
            entry["total"] += 1
            if record.get("decision") == "accepted":
                entry["accepted"] += 1
            elif not record.get("decision"):
                entry["pending"] += 1
        return summary

    @app.get("/api/admin/accounts")
    def admin_accounts(pintor_account: str | None = Cookie(default=None)):
        admin = require_admin(pintor_account)
        by_username = report_summary()
        listing = []
        for account in accounts.list_accounts():
            summary = by_username.get(account["username"], {})
            listing.append({
                **account,
                "storage_bytes": store.owner_bytes(owner_token_for(account["id"])),
                "job_count": store.count_owned(owner_token_for(account["id"])),
                "report_count": summary.get("total", 0),
                "accepted_count": summary.get("accepted", 0),
                "pending_count": summary.get("pending", 0),
                "is_self": account["id"] == admin["id"],
            })
        return {"accounts": listing}

    def guard_self(admin: dict, account_id: str) -> None:
        if admin["id"] == account_id:
            raise HTTPException(
                status_code=400,
                detail="administrators cannot change their own account from the console",
            )

    @app.post("/api/admin/accounts/{account_id}/status")
    def admin_account_status(account_id: str, payload: AccountStatusPayload,
                             pintor_account: str | None = Cookie(default=None)):
        admin = require_admin(pintor_account)
        guard_self(admin, account_id)
        try:
            return {"account": accounts.set_status(account_id, payload.status)}
        except LastAdministrator as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except AccountError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.post("/api/admin/accounts/{account_id}/role")
    def admin_account_role(account_id: str, payload: AccountRolePayload,
                           pintor_account: str | None = Cookie(default=None)):
        admin = require_admin(pintor_account)
        guard_self(admin, account_id)
        try:
            return {"account": accounts.set_role(account_id, payload.role)}
        except LastAdministrator as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except AccountError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.delete("/api/admin/accounts/{account_id}", status_code=204)
    def admin_delete_account(account_id: str,
                             pintor_account: str | None = Cookie(default=None)):
        admin = require_admin(pintor_account)
        guard_self(admin, account_id)
        if not accounts.get(account_id):
            raise HTTPException(status_code=404, detail="account not found")
        store.delete_all_owned(owner_token_for(account_id))
        try:
            accounts.delete_account(account_id)
        except LastAdministrator as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        except AccountError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return Response(status_code=204)

    @app.get("/api/admin/rounds")
    def admin_rounds(pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        current = store.open_round()
        return {
            "rounds": store.list_rounds(),
            "open_round_id": current["id"] if current else None,
        }

    @app.post("/api/admin/rounds", status_code=201)
    def admin_create_round(payload: RoundPayload,
                           pintor_account: str | None = Cookie(default=None)):
        admin = require_admin(pintor_account)
        try:
            return {"round": store.create_round(payload.name, admin)}
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.get("/api/admin/rounds/{round_id}")
    def admin_round_detail(round_id: str, pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        try:
            return {"round": store.round_detail(round_id)}
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="round not found") from error

    @app.post("/api/admin/rounds/{round_id}/items")
    def admin_round_items(round_id: str, payload: RoundItemPayload,
                          pintor_account: str | None = Cookie(default=None)):
        require_admin(pintor_account)
        try:
            store.set_round_item(round_id, payload.feedback_id, payload.include)
            return {"round": store.round_detail(round_id)}
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="round or report not found") from error
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/admin/rounds/{round_id}/close")
    def admin_close_round(round_id: str, payload: RoundClosePayload,
                          pintor_account: str | None = Cookie(default=None)):
        admin = require_admin(pintor_account)
        try:
            return {"round": store.close_round(round_id, admin, payload.note)}
        except JobNotFound as error:
            raise HTTPException(status_code=404, detail="round not found") from error
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

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
