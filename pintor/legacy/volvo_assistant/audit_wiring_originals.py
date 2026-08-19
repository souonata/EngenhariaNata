"""Find wiring-diagram publications whose stored PDF is not the untouched portal original.

The pre-2026 download pipeline recompressed every PDF with Ghostscript ``/ebook``, which
irreversibly downsampled raster images (color/gray to 150 DPI, mono to 300 DPI). Sampling fresh
portal downloads showed the portal originals are never Ghostscript-produced, so a Ghostscript
``producer`` on a stored file is a reliable fingerprint of that lost resolution — even when the
file still passes the readability DPI floors used by audit_pdf_quality.

This audit selects every publication that carries wiring/electrical-diagram content (wiring-like
title, or page text mentioning a wiring/circuit/electrical diagram) and reports which of them are
still recompressed copies. It changes nothing; feed its manifest to::

    .venv/bin/python -m scripts.repair_pdf_quality --manifest <out> --restore-originals --apply

Usage:
    .venv/bin/python -m scripts.audit_wiring_originals
    .venv/bin/python -m scripts.audit_wiring_originals --out logs/wiring-originals-audit.jsonl
    .venv/bin/python -m scripts.audit_wiring_originals --all-types   # every publication, not just wiring
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import ROOT, connect, init_db, list_downloaded_publications, resolve_stored_path

DEFAULT_REPORT = ROOT / "logs" / "wiring-originals-audit.jsonl"

# Library titles are en-US; matching generously is safe because restoring a portal original can
# never reduce quality, so a false positive only costs one same-edition download.
WIRING_TITLE_RE = re.compile(r"wiring|schemat|circuit|electr|harness", re.IGNORECASE)

# FTS5 phrases matched against extracted page text. These find wiring chapters inside manuals
# whose titles say nothing about electrics: the raster foldouts themselves have no text layer, but
# the TOC/index of the same publication names them ("Wiring diagrams ... 85", "Group 30 Electrical
# system"). Single words subsume their longer phrases ("wiring" covers "wiring diagram/schematic").
# FTS5 matching is token-exact (no stemming), so plurals must be listed explicitly.
WIRING_TEXT_PHRASES = (
    "wiring",
    "schematic",
    "schematics",
    "circuit diagram",
    "circuit diagrams",
    "electrical diagram",
    "electrical diagrams",
    "electrical system",
    "electrical systems",
    "cable harness",
    "cable harnesses",
    "group 30",
)

# Publications whose whole text layer is below this length are image-only scans (classic engine
# manuals, drawings). Their index cannot be searched, so wiring content can never be ruled out —
# they are always included.
NO_TEXT_LAYER_MAX_CHARS = 200

MAX_RECORDED_PAGES = 40


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Flag wiring-diagram publications whose stored PDF is a Ghostscript-recompressed copy instead of the portal original."
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_REPORT, help="Manifest JSONL path.")
    parser.add_argument("--summary-out", type=Path, help="Summary JSON path (defaults beside --out).")
    parser.add_argument("--all-types", action="store_true", help="Audit every downloaded publication instead of only wiring-content ones.")
    parser.add_argument("--limit", type=int, default=None, help="Audit at most this many selected publications.")
    parser.add_argument("--progress-every", type=int, default=100, help="Print progress every N files.")
    args = parser.parse_args()

    init_db()
    publications = list_downloaded_publications()
    text_hits = wiring_text_pages()
    text_lengths = publication_text_lengths()

    selected: list[tuple[dict[str, Any], list[str], list[int]]] = []
    for publication in publications:
        reasons: list[str] = []
        if WIRING_TITLE_RE.search(str(publication.get("title") or "")):
            reasons.append("title")
        pages = sorted(text_hits.get(int(publication["id"]), ()))
        if pages:
            reasons.append("page_text")
        if text_lengths.get(int(publication["id"]), 0) < NO_TEXT_LAYER_MAX_CHARS:
            reasons.append("no_text_layer")
        if args.all_types and not reasons:
            reasons.append("all_types")
        if reasons:
            selected.append((publication, reasons, pages))
    if args.limit is not None:
        selected = selected[: max(args.limit, 0)]

    report_path = absolute_output_path(args.out)
    summary_path = absolute_output_path(args.summary_out) if args.summary_out else report_path.with_suffix(".summary.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    status_counts: Counter[str] = Counter()
    needs_by_type: Counter[str] = Counter()
    started_at = utc_now()

    # Stream into a temp file and publish atomically: the repair loop re-reads this manifest every
    # cycle, and a truncated-but-valid JSONL prefix would make it falsely conclude it is drained.
    temporary_report = report_path.with_suffix(report_path.suffix + ".tmp")
    with temporary_report.open("w", encoding="utf-8") as output:
        for index, (publication, reasons, pages) in enumerate(selected, start=1):
            record = inspect_publication(publication, reasons, pages)
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
            output.flush()
            status_counts[record["status"]] += 1
            if record["status"] == "needs_original":
                needs_by_type[str(publication.get("document_type") or "(blank)")] += 1
            if args.progress_every > 0 and (index % args.progress_every == 0 or index == len(selected)):
                print(
                    json.dumps(
                        {
                            "event": "wiring_originals_audit_progress",
                            "checked": index,
                            "selected": len(selected),
                            "needs_original": status_counts["needs_original"],
                        }
                    ),
                    flush=True,
                )

    os.replace(temporary_report, report_path)

    summary = {
        "started_at": started_at,
        "finished_at": utc_now(),
        "report": str(report_path),
        "downloaded_publications": len(publications),
        "selected": len(selected),
        "all_types": bool(args.all_types),
        "status_counts": dict(status_counts),
        "needs_original": status_counts["needs_original"],
        "needs_original_by_document_type": dict(needs_by_type.most_common()),
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"event": "wiring_originals_audit_finished", **summary}, ensure_ascii=False), flush=True)
    return 0


def inspect_publication(publication: dict[str, Any], reasons: list[str], text_pages: list[int]) -> dict[str, Any]:
    record: dict[str, Any] = {
        "publication_id": int(publication["id"]),
        "publication_number": publication.get("publication_number"),
        "title": publication.get("title"),
        "document_type": publication.get("document_type"),
        "version_date": publication.get("version_date"),
        "local_path": publication.get("local_path"),
        "sha256": publication.get("sha256"),
        "wiring_match": reasons,
        "wiring_text_pages": text_pages[:MAX_RECORDED_PAGES],
        "wiring_text_pages_truncated": len(text_pages) > MAX_RECORDED_PAGES,
        "producer": None,
        "ghostscript_producer": False,
        "page_count": None,
        "status": "error",
        "error": None,
    }
    stored_path = publication.get("local_path")
    path = resolve_stored_path(stored_path) if stored_path else None
    if not path or not path.is_file():
        record["status"] = "missing_file"
        record["error"] = "stored PDF does not exist"
        return record
    try:
        import fitz

        with fitz.open(path) as doc:
            producer = str((doc.metadata or {}).get("producer") or "").strip()
            record["producer"] = producer or None
            record["ghostscript_producer"] = "ghostscript" in producer.casefold()
            record["page_count"] = doc.page_count
    except Exception as exc:  # noqa: BLE001 - the audit must continue past one malformed PDF
        record["error"] = str(exc)
        return record
    record["status"] = "needs_original" if record["ghostscript_producer"] else "already_original"
    return record


def wiring_text_pages() -> dict[int, set[int]]:
    """Publication -> page numbers whose extracted text mentions a wiring/electrical diagram."""
    hits: dict[int, set[int]] = {}
    with connect() as conn:
        for phrase in WIRING_TEXT_PHRASES:
            quoted = '"' + phrase.replace('"', " ") + '"'
            try:
                rows = conn.execute(
                    "SELECT publication_id, page_number FROM pdf_pages_fts WHERE pdf_pages_fts MATCH ?",
                    (quoted,),
                ).fetchall()
            except Exception:  # noqa: BLE001 - fall back to a slower LIKE scan without FTS
                rows = conn.execute(
                    "SELECT publication_id, page_number FROM pdf_pages WHERE LOWER(extracted_text) LIKE ?",
                    (f"%{phrase.casefold()}%",),
                ).fetchall()
            for row in rows:
                hits.setdefault(int(row["publication_id"]), set()).add(int(row["page_number"]))
    return hits


def publication_text_lengths() -> dict[int, int]:
    """Publication -> total extracted-text length; ~0 means an image-only scan with no index to search."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT publication_id, SUM(LENGTH(COALESCE(extracted_text, ''))) AS total FROM pdf_pages GROUP BY publication_id"
        ).fetchall()
    return {int(row["publication_id"]): int(row["total"] or 0) for row in rows}


def absolute_output_path(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
