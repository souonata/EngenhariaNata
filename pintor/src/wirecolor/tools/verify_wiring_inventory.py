"""Strictly verify broad wiring-page inventory candidates.

The first-stage ``pintor-inventory`` scanner is deliberately recall-oriented: exact positioned
text plus nearby vector ink, or OCR plus nearby line-like pixels, creates a candidate.  This tool
is the precision stage.  It reuses the saved OCR, runs the same physical-conductor topology and
engineering-semantics gates as production painting, and publishes only pages for which at least
one real wire can be painted safely.

Examples::

    pintor-verify-inventory --inventory D:/inventory/merged --out D:/inventory/strict
    pintor-verify-inventory --inventory D:/inventory/shard_00 D:/inventory/shard_01 \
        --out D:/inventory/strict

Source PDFs and first-stage ledgers are read-only.  Verification is append-only and resumable;
``wiring_diagrams.csv`` and ``report.html`` contain verified pages only, while
``verification.jsonl`` retains every rejection and review decision for audit.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import tempfile

from .inventory_wiring_pages import (
    CANDIDATE_STATUSES,
    DISCOVERY_DPI,
    SCANNER_VERSION,
    _render_for_ocr,
    _render_thumbnail,
)
from .wiring_evidence import (
    inspect_ocr_image,
    verify_outlined_page,
    verify_raster_image,
    verify_vector_page,
)


VERIFIER_VERSION = "wiring-page-strict-verifier-v3"
FINAL_STATUS = "verified"


def _ledger_paths(inputs: list[Path]) -> list[Path]:
    """Resolve files, shard directories or an inventory root to unique page ledgers."""
    ledgers = set()
    for raw in inputs:
        path = raw.resolve()
        if path.is_file():
            ledgers.add(path)
            continue
        direct = path / "pages.jsonl"
        if direct.is_file():
            ledgers.add(direct.resolve())
            continue
        if path.is_dir():
            ledgers.update(candidate.resolve() for candidate in path.rglob("pages.jsonl"))
    return sorted(ledgers, key=str)


def _source_fingerprint(record: dict) -> str:
    """Stable digest of every first-stage fact that can affect strict verification."""
    payload = {
        "scanner_version": record.get("scanner_version"),
        "manual_sha256": record.get("manual_sha256"),
        "manual_path": record.get("manual_path"),
        "page_1_based": record.get("page_1_based"),
        "status": record.get("status"),
        "vector": record.get("vector", {}),
        "ocr": record.get("ocr", {}),
    }
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256(encoded).hexdigest()


def load_candidates(inputs: list[Path]) -> dict[tuple[str, int], dict]:
    """Load the newest candidate record per manual/page across resumed or sharded ledgers."""
    latest = {}
    for ledger in _ledger_paths(inputs):
        with ledger.open(encoding="utf-8") as handle:
            for line in handle:
                try:
                    record = json.loads(line)
                    if record.get("status") not in CANDIDATE_STATUSES:
                        continue
                    key = (str(record["manual_key"]), int(record["page_1_based"]))
                except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                    continue
                current = latest.get(key)
                if current is None or str(record.get("scanned_utc", "")) >= str(
                        current.get("scanned_utc", "")):
                    record["_source_ledger"] = str(ledger)
                    latest[key] = record
    return latest


def _latest_verifications(path: Path) -> dict[tuple[str, int], dict]:
    latest = {}
    if not path.is_file():
        return latest
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            try:
                record = json.loads(line)
                if record.get("verifier_version") != VERIFIER_VERSION:
                    continue
                key = (str(record["manual_key"]), int(record["page_1_based"]))
                latest[key] = record
            except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                continue
    return latest


def _base_record(source: dict, result: dict, fingerprint: str) -> dict:
    return {
        "verifier_version": VERIFIER_VERSION,
        "verified_utc": datetime.now(timezone.utc).isoformat(),
        "source_fingerprint": fingerprint,
        "source_scanner_version": source.get("scanner_version"),
        "source_status": source.get("status"),
        "manual_key": str(source["manual_key"]),
        "manual_title": str(source.get("manual_title") or Path(source["manual_path"]).stem),
        "manual_path": str(source["manual_path"]),
        "manual_sha256": str(source.get("manual_sha256") or ""),
        "page_1_based": int(source["page_1_based"]),
        "page_index": int(source.get("page_index", int(source["page_1_based"]) - 1)),
        "page_count": int(source.get("page_count", 0)),
        "status": result["status"],
        "mode": result.get("mode"),
        "reason": result.get("reason", ""),
        "convention": result.get("convention"),
        "convention_confidence": result.get("convention_confidence"),
        "physical_conductors": int(result.get("physical_conductors", 0)),
        "codes": sorted(str(code) for code in result.get("codes", ())),
        "engineering_semantics": result.get("engineering_semantics"),
        "ocr_refreshed": bool(result.get("ocr_refreshed")),
        "ocr_evidence_status": result.get("ocr_evidence_status"),
        "thumbnail": None,
    }


def _should_try_outlined(source: dict, result: dict) -> bool:
    """Cheap gate for the expensive exact-callout/outlined-cable fallback.

    An outlined conductor needs both a raster illustration and at least two exact callouts.  Pure
    vector tables and flowcharts can never satisfy that contract, so rendering every rejected
    page under every convention only wastes time and can turn drafting furniture into evidence.
    """
    if result.get("mode") == "vector-text-corrupt":
        return False
    legends = source.get("vector", {}).get("legends") or ()
    try:
        image_coverage = float(source.get("image_coverage") or 0.0)
    except (TypeError, ValueError):
        image_coverage = 0.0
    return len(legends) >= 2 and image_coverage >= 0.03


def _fresh_ocr(image_path: Path, engine_cache: dict | None) -> dict:
    """Run current OCR while allowing a batch verifier to reuse one native engine."""
    cache = engine_cache if engine_cache is not None else {}
    engine = cache.get("engine")
    if engine is None:
        from ..labels.ocr import build_engine
        engine = build_engine(intra_op_threads=1)
        cache["engine"] = engine
    return inspect_ocr_image(str(image_path), engine=engine)


def _raster_result(source: dict, temp_dir: Path, *, dpi: int,
                   max_raster_pixels: int, convention_name: str,
                   refresh_ocr: bool, engine_cache: dict | None) -> dict:
    """Render once, optionally refresh stale OCR, and run the raster semantic verifier."""
    import fitz

    page_index = int(source.get("page_index", int(source["page_1_based"]) - 1))
    rendered = temp_dir / f"{source['manual_key']}-p{page_index + 1}.png"
    document = fitz.open(Path(source["manual_path"]))
    try:
        _render_for_ocr(document[page_index], rendered, dpi, max_raster_pixels)
    finally:
        document.close()
    try:
        evidence = (_fresh_ocr(rendered, engine_cache)
                    if refresh_ocr else dict(source.get("ocr") or {}))
        if evidence.get("status") not in {"probable", "review"} \
                or not evidence.get("legends"):
            status = "rejected" if evidence.get("status") in {
                "no_evidence", "excluded_non_wiring", "already_colored",
            } else "review"
            return {
                "status": status,
                "mode": "raster-ocr-topology",
                "reason": str(evidence.get("reason") or "OCR supplied no usable colour labels"),
                "convention": None,
                "physical_conductors": 0,
                "codes": [],
                "ocr_refreshed": refresh_ocr,
                "ocr_evidence_status": evidence.get("status"),
            }
        result = verify_raster_image(
            str(rendered), evidence, convention_name=convention_name)
        result["ocr_refreshed"] = refresh_ocr
        result["ocr_evidence_status"] = evidence.get("status")
        return result
    finally:
        rendered.unlink(missing_ok=True)


def verify_candidate(source: dict, temp_dir: Path, *, dpi: int = DISCOVERY_DPI,
                     max_raster_pixels: int = 80_000_000,
                     convention_name: str = "auto",
                     ocr_engine_cache: dict | None = None) -> dict:
    """Run the cheapest applicable production-semantic verifier for one candidate page."""
    import fitz

    fingerprint = _source_fingerprint(source)
    path = Path(source["manual_path"])
    if not path.is_file():
        return _base_record(source, {
            "status": "error", "mode": "source",
            "reason": f"source PDF is missing: {path}",
            "physical_conductors": 0, "codes": [],
        }, fingerprint)

    page_index = int(source.get("page_index", int(source["page_1_based"]) - 1))
    vector = source.get("vector", {})
    ocr = source.get("ocr", {})
    try:
        if vector.get("status") == "confirmed" and vector.get("convention"):
            document = fitz.open(path)
            try:
                result = verify_vector_page(
                    document[page_index], str(vector["convention"]), dpi=dpi)
            finally:
                document.close()
            if result["status"] != FINAL_STATUS \
                    and str(result.get("reason", "")).startswith("raster foldout:"):
                # The PDF text is exact but the conductors live in the large embedded scan.  OCR
                # that bitmap and run the production raster topology instead of treating the
                # vector preflight rejection as the final answer.
                result = _raster_result(
                    source, temp_dir, dpi=dpi, max_raster_pixels=max_raster_pixels,
                    convention_name=convention_name, refresh_ocr=True,
                    engine_cache=ocr_engine_cache,
                )
            if result["status"] != FINAL_STATUS and _should_try_outlined(source, result):
                outlined = verify_outlined_page(
                    str(path), page_index,
                    convention_name=(convention_name if convention_name != "auto" else "auto"),
                )
                if outlined["status"] == FINAL_STATUS:
                    result = outlined
        elif ocr.get("status") in {"probable", "review"} and ocr.get("legends"):
            result = _raster_result(
                source, temp_dir, dpi=dpi, max_raster_pixels=max_raster_pixels,
                convention_name=convention_name,
                refresh_ocr=source.get("scanner_version") != SCANNER_VERSION,
                engine_cache=ocr_engine_cache,
            )
        else:
            result = {
                "status": "review",
                "mode": "insufficient-evidence",
                "reason": "candidate has neither confirmed vector evidence nor reusable OCR labels",
                "convention": vector.get("convention"),
                "physical_conductors": 0,
                "codes": [],
            }
    except Exception as error:
        result = {
            "status": "error",
            "mode": "verification",
            "reason": f"strict verification failed: {type(error).__name__}: {error}",
            "convention": vector.get("convention"),
            "physical_conductors": 0,
            "codes": [],
        }
    return _base_record(source, result, fingerprint)


def _ensure_thumbnail(record: dict, out_dir: Path) -> str | None:
    if record.get("status") != FINAL_STATUS:
        return None
    import fitz

    target_dir = out_dir / "thumbnails"
    target_dir.mkdir(exist_ok=True)
    safe_key = sha256(str(record["manual_key"]).encode("utf-8")).hexdigest()[:16]
    target = target_dir / f"{safe_key}-p{record['page_1_based']}.jpg"
    if not target.is_file():
        document = fitz.open(record["manual_path"])
        try:
            _render_thumbnail(document[record["page_index"]], target)
        finally:
            document.close()
    return target.relative_to(out_dir).as_posix() if target.is_file() else None


def verify_inventory(candidates: dict[tuple[str, int], dict], out_dir: Path, *,
                     dpi: int = DISCOVERY_DPI, max_raster_pixels: int = 80_000_000,
                     convention_name: str = "auto", thumbnails: bool = True,
                     resume: bool = True, limit: int = 0,
                     progress_every: int = 10) -> dict[tuple[str, int], dict]:
    """Append strict decisions and return the newest decision for every requested candidate."""
    out_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = out_dir / "verification.jsonl"
    latest = _latest_verifications(ledger_path) if resume else {}
    ordered = sorted(candidates.items(), key=lambda item: (
        str(item[1].get("manual_title", "")), item[1]["page_1_based"]))
    if limit > 0:
        ordered = ordered[:limit]
    processed = 0
    ocr_engine_cache: dict = {}
    with ledger_path.open("a", encoding="utf-8", newline="\n") as ledger, \
            tempfile.TemporaryDirectory(prefix="pintor-strict-inventory-") as temp_name:
        temp_dir = Path(temp_name)
        for key, source in ordered:
            fingerprint = _source_fingerprint(source)
            existing = latest.get(key)
            if resume and existing and existing.get("source_fingerprint") == fingerprint:
                thumbnail = existing.get("thumbnail")
                thumbnail_missing = not thumbnail or not (out_dir / str(thumbnail)).is_file()
                if thumbnails and existing.get("status") == FINAL_STATUS and thumbnail_missing:
                    refreshed = dict(existing)
                    try:
                        refreshed["thumbnail"] = _ensure_thumbnail(refreshed, out_dir)
                    except Exception as error:
                        refreshed["thumbnail_error"] = f"{type(error).__name__}: {error}"
                    ledger.write(json.dumps(
                        refreshed, ensure_ascii=False, separators=(",", ":")) + "\n")
                    ledger.flush()
                    latest[key] = refreshed
                continue
            record = verify_candidate(
                source, temp_dir, dpi=dpi, max_raster_pixels=max_raster_pixels,
                convention_name=convention_name, ocr_engine_cache=ocr_engine_cache)
            if thumbnails and record["status"] == FINAL_STATUS:
                try:
                    record["thumbnail"] = _ensure_thumbnail(record, out_dir)
                except Exception as error:
                    record["thumbnail_error"] = f"{type(error).__name__}: {error}"
            ledger.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            ledger.flush()
            latest[key] = record
            processed += 1
            if progress_every > 0 and processed % progress_every == 0:
                print(
                    f"  {processed} candidates verified this run; "
                    f"latest {record['manual_key']} p{record['page_1_based']}: {record['status']}",
                    flush=True,
                )
    return {key: latest[key] for key, _source in ordered if key in latest}


def write_reports(records: dict[tuple[str, int], dict], out_dir: Path,
                  source_ledgers: list[Path]) -> dict:
    """Write a self-contained report whose visible rows are verified diagrams only."""
    rows = sorted(records.values(), key=lambda row: (
        str(row.get("manual_title", "")), int(row["page_1_based"])))
    verified = [row for row in rows if row.get("status") == FINAL_STATUS]
    statuses = ("verified", "rejected", "review", "error")
    counts = {status: sum(row.get("status") == status for row in rows) for status in statuses}
    summary = {
        "schema": VERIFIER_VERSION,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_ledgers": [str(path) for path in source_ledgers],
        "candidates_verified": len(rows),
        "verified_wiring_pages": len(verified),
        "manuals_with_verified_wiring": len({row["manual_key"] for row in verified}),
        "counts": counts,
        "verification_ledger": "verification.jsonl",
        "verified_csv": "wiring_diagrams.csv",
        "report_html": "report.html",
    }
    temporary = out_dir / "summary.json.tmp"
    temporary.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(out_dir / "summary.json")

    with (out_dir / "wiring_diagrams.csv").open(
            "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "manual", "page", "page_count", "mode", "convention", "physical_conductors",
            "codes", "reason", "pdf_path",
        ])
        for row in verified:
            writer.writerow([
                row["manual_title"], row["page_1_based"], row.get("page_count", 0), row["mode"],
                row.get("convention") or "", row["physical_conductors"],
                " ".join(row.get("codes", ())), row.get("reason", ""), row["manual_path"],
            ])

    cards = []
    for row in verified:
        image = (f'<img loading="lazy" src="{escape(row["thumbnail"])}" '
                 f'alt="Verified wiring page">' if row.get("thumbnail") else "")
        cards.append(
            f'<article>{image}<div><h2>{escape(row["manual_title"])}</h2>'
            f'<p><b>Page {row["page_1_based"]} of {row.get("page_count") or "?"}</b> · '
            f'{escape(str(row.get("mode") or ""))} · '
            f'{row["physical_conductors"]} physical conductors</p>'
            f'<p>Codes: {escape(", ".join(row.get("codes", ())))}</p>'
            f'<p>{escape(row.get("reason", ""))}</p>'
            f'<p class="path">{escape(row["manual_path"])}</p></div></article>'
        )
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Verified Pintor wiring diagrams</title><style>
body{{font:15px system-ui;margin:0 auto;max-width:1200px;padding:24px;background:#f3f5f7;color:#18202a}}
header{{position:sticky;top:0;background:#f3f5f7ee;padding:4px 0 16px;backdrop-filter:blur(8px)}}
article{{display:grid;grid-template-columns:minmax(220px,360px) 1fr;gap:20px;background:white;margin:16px 0;padding:14px;border-left:7px solid #18864b;border-radius:8px;box-shadow:0 2px 12px #0001}}
img{{width:100%;height:auto;border:1px solid #ccd3da}}h2{{margin:.2em 0;font-size:1.05rem}}.path{{font-size:.78rem;color:#667;overflow-wrap:anywhere}}
@media(max-width:700px){{article{{grid-template-columns:1fr}}}}
</style></head><body><header><h1>Verified paintable wiring diagrams</h1>
<p>{len(verified)} pages across {summary['manuals_with_verified_wiring']} manuals. Every visible
page has at least one colour-coded physical conductor approved by the production semantics gate.
Rejected, ambiguous and failed candidates remain only in the audit ledger.</p></header>
{''.join(cards) or '<p>No wiring page has passed strict verification yet.</p>'}</body></html>"""
    (out_dir / "report.html").write_text(html, encoding="utf-8")
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--inventory", nargs="+", required=True, type=Path,
        help="first-stage pages.jsonl files, shard directories or an inventory root",
    )
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--dpi", type=int, default=DISCOVERY_DPI)
    parser.add_argument("--max-raster-pixels", type=int, default=80_000_000)
    parser.add_argument("--convention", default="auto")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--progress-every", type=int, default=10)
    parser.add_argument("--no-thumbnails", action="store_true")
    parser.add_argument("--no-resume", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    ledgers = _ledger_paths(args.inventory)
    if not ledgers:
        raise SystemExit("no first-stage pages.jsonl ledger found")
    candidates = load_candidates(ledgers)
    if not candidates:
        raise SystemExit("no first-stage wiring candidates found")
    records = verify_inventory(
        candidates, args.out.resolve(), dpi=args.dpi,
        max_raster_pixels=args.max_raster_pixels,
        convention_name=args.convention,
        thumbnails=not args.no_thumbnails, resume=not args.no_resume,
        limit=args.limit, progress_every=args.progress_every,
    )
    summary = write_reports(records, args.out.resolve(), ledgers)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
