"""Exhaustively inventory wiring-diagram pages without modifying source manuals.

Examples::

    python -m wirecolor.tools.inventory_wiring_pages \
        --library-manifest D:/private-library/manifest.json --out D:/inventory

    python -m wirecolor.tools.inventory_wiring_pages \
        --pdf-root D:/manuals --out D:/inventory --ocr-mode off

The default OCR mode is ``missing``: every page is inspected through exact PDF text and vector
geometry first, then raster-bearing pages not already decided are rendered and OCRed.  ``all`` is
available for a deliberately exhaustive OCR pass over text-only pages too.  Results are appended to
JSONL after each page, so a long run can resume safely.  JSON, CSV and HTML summaries are rebuilt
from the latest record for every page.
"""
from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import shutil
import tempfile
from urllib.parse import quote

from .wiring_evidence import (
    DISCOVERY_DPI,
    inspect_ocr_image,
    inspect_vector_page,
)


SCANNER_VERSION = "wiring-page-inventory-v13"
CANDIDATE_STATUSES = {"confirmed", "probable", "review"}
OCR_IMAGE_COVERAGE_MIN = 0.01
OCR_TEXT_CHARS_MAX = 80


@dataclass(frozen=True)
class Manual:
    key: str
    title: str
    path: Path
    sha256: str
    old_pages_1_based: frozenset[int]


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manuals_from_manifest(path: Path) -> list[Manual]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    base = path.parent
    manuals = []
    for item in raw.get("publications", ()):
        pdf_path = base / item["copy_path"]
        manuals.append(Manual(
            key=str(item["publication_id"]),
            title=str(item.get("title") or pdf_path.stem),
            path=pdf_path.resolve(),
            sha256=str(item.get("sha256") or ""),
            old_pages_1_based=frozenset(int(page) for page in item.get("wiring_pages_1_based", ())),
        ))
    return manuals


def manuals_from_root(root: Path) -> list[Manual]:
    manuals = []
    for pdf_path in sorted(root.rglob("*.pdf")):
        resolved = pdf_path.resolve()
        relative = pdf_path.relative_to(root).as_posix()
        manuals.append(Manual(
            key=relative,
            title=pdf_path.stem,
            path=resolved,
            sha256=_file_sha256(resolved),
            old_pages_1_based=frozenset(),
        ))
    return manuals


def _latest_records(path: Path) -> dict[tuple[str, int], dict]:
    latest = {}
    if not path.is_file():
        return latest
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            try:
                record = json.loads(line)
                if record.get("scanner_version") != SCANNER_VERSION:
                    continue
                latest[(str(record["manual_key"]), int(record["page_1_based"]))] = record
            except (ValueError, KeyError, TypeError):
                continue
    return latest


def _image_coverage(page) -> float:
    area = abs(page.rect.width * page.rect.height) or 1.0
    covered = 0.0
    for image in page.get_images(full=True):
        for rectangle in page.get_image_rects(image[0]):
            covered += abs(rectangle.width * rectangle.height)
    return round(covered / area, 3)


def _render_for_ocr(page, path: Path, requested_dpi: int,
                    max_pixels: int) -> tuple[int, int, int]:
    import fitz

    width, height = float(page.rect.width), float(page.rect.height)
    scale = requested_dpi / 72.0
    pixels = width * height * scale * scale
    if max_pixels > 0 and pixels > max_pixels:
        scale *= (max_pixels / pixels) ** 0.5
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    pixmap.save(path)
    return pixmap.width, pixmap.height, round(scale * 72)


def _render_thumbnail(page, path: Path, max_side: int = 1400) -> None:
    import fitz

    scale = min(max_side / max(float(page.rect.width), float(page.rect.height)), 2.0)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    pixmap.pil_save(path, format="JPEG", quality=78, optimize=True)


def _combined_status(vector: dict, ocr: dict) -> tuple[str, str, str]:
    if vector.get("status") == "excluded_non_wiring" or ocr.get("status") == "excluded_non_wiring":
        source = vector if vector.get("status") == "excluded_non_wiring" else ocr
        return ("excluded_non_wiring", "high",
                str(source.get("reason", "not a wiring diagram")))
    if vector.get("status") == "already_colored" or ocr.get("status") == "already_colored":
        source = vector if vector.get("status") == "already_colored" else ocr
        return "already_colored", "high", str(source.get("reason", "already coloured"))
    if vector.get("status") == "confirmed":
        return "confirmed", str(vector.get("confidence", "high")), str(vector.get("reason", ""))
    if ocr.get("status") in {"probable", "review"}:
        return str(ocr["status"]), str(ocr.get("confidence", "low")), str(ocr.get("reason", ""))
    if vector.get("status") == "review":
        return "review", str(vector.get("confidence", "low")), str(vector.get("reason", ""))
    if ocr.get("status") == "error":
        return "error", "none", str(ocr.get("reason", "OCR failed"))
    return "no_evidence", "none", "no colour-coded wire evidence found"


def _ocr_required(mode: str, vector: dict, *, image_coverage: float | None = None,
                  text_chars: int | None = None) -> bool:
    if vector.get("status") in {"already_colored", "excluded_non_wiring"}:
        return False
    if mode == "all":
        return True
    if mode != "missing" or vector.get("status") == "confirmed":
        return False
    # OCR is the fallback for raster content, not a second reading of text-only prose.  One per
    # cent of a page is already a small inset diagram; almost-empty text catches image-only scans
    # whose PDF image rectangle metadata is missing or unusual.
    if image_coverage is None or text_chars is None:
        return True
    return image_coverage >= OCR_IMAGE_COVERAGE_MIN or text_chars < OCR_TEXT_CHARS_MAX


def _record_complete(record: dict, ocr_mode: str) -> bool:
    if not record or record.get("scanner_version") != SCANNER_VERSION:
        return False
    vector = record.get("vector", {})
    if not _ocr_required(
        ocr_mode, vector,
        image_coverage=record.get("image_coverage"),
        text_chars=record.get("text_chars"),
    ):
        return True
    # A transient render/OCR failure must be retried on resume, not frozen into the ledger.
    return record.get("ocr", {}).get("status") not in {None, "not_run", "error"}


def scan_library(manuals: list[Manual], out_dir: Path, ocr_mode: str = "missing",
                 dpi: int = DISCOVERY_DPI, max_ocr_pixels: int = 80_000_000,
                 thumbnails: bool = True, resume: bool = True,
                 start_manual: int = 0, limit_manuals: int = 0, limit_pages: int = 0,
                 progress_every: int = 25, start_page: int = 0) -> dict:
    """Scan every page and return the latest per-page record mapping."""
    import fitz

    out_dir.mkdir(parents=True, exist_ok=True)
    thumbnails_dir = out_dir / "thumbnails"
    if thumbnails:
        thumbnails_dir.mkdir(exist_ok=True)
    records_path = out_dir / "pages.jsonl"
    latest = _latest_records(records_path) if resume else {}
    selected_manuals = manuals[max(0, start_manual):]
    if limit_manuals > 0:
        selected_manuals = selected_manuals[:limit_manuals]
    processed = 0
    ocr_engine = None
    with records_path.open("a", encoding="utf-8", newline="\n") as ledger, \
            tempfile.TemporaryDirectory(prefix="pintor-inventory-") as temp_name:
        temp_dir = Path(temp_name)
        stop = False
        for manual_number, manual in enumerate(selected_manuals, 1):
            if not manual.path.is_file():
                print(f"missing manual: {manual.path}")
                continue
            try:
                document = fitz.open(manual.path)
            except Exception as error:
                print(f"cannot open {manual.path}: {type(error).__name__}: {error}")
                continue
            print(f"[{manual_number}/{len(selected_manuals)}] {manual.title} ({len(document)} pages)")
            try:
                first_page = max(0, start_page) if manual_number == 1 else 0
                for page_index in range(min(first_page, len(document)), len(document)):
                    if limit_pages > 0 and processed >= limit_pages:
                        stop = True
                        break
                    key = (manual.key, page_index + 1)
                    existing = latest.get(key)
                    if resume and _record_complete(existing or {}, ocr_mode):
                        continue
                    page = document[page_index]
                    known_by_old_scan = page_index + 1 in manual.old_pages_1_based
                    vector = dict((existing or {}).get("vector") or {})
                    if not vector:
                        try:
                            vector = inspect_vector_page(page, dpi=dpi)
                        except Exception as error:
                            vector = {
                                "status": "error", "confidence": "none", "legends": [],
                                "reason": f"vector inspection failed: {type(error).__name__}: {error}",
                            }
                    text_chars = int((existing or {}).get("text_chars", -1))
                    if text_chars < 0:
                        text_chars = len((page.get_text("text") or "").strip())
                    image_coverage = (existing or {}).get("image_coverage")
                    if image_coverage is None:
                        image_coverage = _image_coverage(page)
                    ocr = dict((existing or {}).get("ocr") or {"status": "not_run"})
                    rendered = None
                    if _ocr_required(
                        ocr_mode, vector,
                        image_coverage=float(image_coverage), text_chars=text_chars,
                    ) and ocr.get("status") in {None, "not_run"}:
                        rendered = temp_dir / f"page-{manual_number}-{page_index + 1}.png"
                        try:
                            width, height, actual_dpi = _render_for_ocr(
                                page, rendered, dpi, max_ocr_pixels)
                            if ocr_engine is None:
                                from ..labels.ocr import build_engine
                                ocr_engine = build_engine(intra_op_threads=1)
                            ocr = inspect_ocr_image(str(rendered), engine=ocr_engine)
                            ocr.update({
                                "render_width": width,
                                "render_height": height,
                                "requested_dpi": dpi,
                                "actual_dpi": actual_dpi,
                            })
                        except Exception as error:
                            ocr = {
                                "status": "error", "confidence": "none", "legends": [],
                                "reason": f"OCR inspection failed: {type(error).__name__}: {error}",
                            }
                    status, confidence, reason = _combined_status(vector, ocr)
                    thumb_relative = None
                    if thumbnails and status in CANDIDATE_STATUSES:
                        thumb_name = f"{quote(manual.key, safe='')}-p{page_index + 1}.jpg"
                        thumb_path = thumbnails_dir / thumb_name
                        if not thumb_path.is_file():
                            try:
                                _render_thumbnail(page, thumb_path)
                            except Exception as error:
                                print(f"  thumbnail failed p{page_index + 1}: {error}")
                        if thumb_path.is_file():
                            thumb_relative = thumb_path.relative_to(out_dir).as_posix()
                    record = {
                        "scanner_version": SCANNER_VERSION,
                        "scanned_utc": datetime.now(timezone.utc).isoformat(),
                        "manual_key": manual.key,
                        "manual_title": manual.title,
                        "manual_path": str(manual.path),
                        "manual_sha256": manual.sha256,
                        "page_1_based": page_index + 1,
                        "page_index": page_index,
                        "page_count": len(document),
                        "known_by_old_8_code_scan": known_by_old_scan,
                        "text_chars": text_chars,
                        "image_coverage": image_coverage,
                        "status": status,
                        "confidence": confidence,
                        "reason": reason,
                        "vector": vector,
                        "ocr": ocr,
                        "thumbnail": thumb_relative,
                    }
                    ledger.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
                    ledger.flush()
                    latest[key] = record
                    processed += 1
                    if progress_every > 0 and processed % progress_every == 0:
                        print(f"  {processed} pages processed this run; latest p{page_index + 1}: {status}")
                    if rendered is not None:
                        rendered.unlink(missing_ok=True)
            finally:
                document.close()
                try:
                    fitz.TOOLS.store_shrink(100)
                except Exception:
                    pass
            if stop:
                break
    return latest


def _all_codes(record: dict) -> list[str]:
    codes = {
        str(legend.get("code"))
        for source in (record.get("vector", {}), record.get("ocr", {}))
        for legend in source.get("legends", ())
        if legend.get("code")
    }
    return sorted(codes)


def write_reports(latest: dict[tuple[str, int], dict], manuals: list[Manual],
                  out_dir: Path, source: str, ocr_mode: str) -> dict:
    records = sorted(latest.values(), key=lambda row: (str(row["manual_key"]), row["page_1_based"]))
    candidates = [row for row in records if row.get("status") in CANDIDATE_STATUSES]
    counts = {status: sum(row.get("status") == status for row in records)
              for status in ("confirmed", "probable", "review", "already_colored",
                             "excluded_non_wiring", "no_evidence", "error")}
    pending_ocr = sum(
        _ocr_required(
            ocr_mode, row.get("vector", {}),
            image_coverage=row.get("image_coverage"), text_chars=row.get("text_chars"),
        ) and row.get("ocr", {}).get("status") in {None, "not_run"}
        for row in records)
    ocr_errors = sum(row.get("ocr", {}).get("status") == "error" for row in records)
    summary = {
        "schema": SCANNER_VERSION,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "ocr_mode": ocr_mode,
        "manuals_configured": len(manuals),
        "manuals_scanned": len({row["manual_key"] for row in records}),
        "pages_scanned": len(records),
        "candidate_pages": len(candidates),
        "new_candidate_pages_beyond_old_8_code_scan": sum(
            not row.get("known_by_old_8_code_scan", False) for row in candidates),
        "ignored_already_colored_pages": counts["already_colored"],
        "ignored_non_wiring_pages": counts["excluded_non_wiring"],
        "pending_ocr_pages": pending_ocr,
        "ocr_error_pages": ocr_errors,
        "counts": counts,
        "complete_for_requested_mode": (pending_ocr == 0 and ocr_errors == 0)
        if ocr_mode != "off" else True,
        "records": "pages.jsonl",
        "candidates_csv": "candidates.csv",
        "report_html": "report.html",
    }
    temporary = out_dir / "summary.json.tmp"
    temporary.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(out_dir / "summary.json")

    with (out_dir / "candidates.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "manual", "page", "status", "confidence", "codes", "wire_evidence",
            "known_by_old_scan", "reason", "pdf_path",
        ])
        for row in candidates:
            writer.writerow([
                row["manual_title"], row["page_1_based"], row["status"], row["confidence"],
                " ".join(_all_codes(row)),
                row.get("vector", {}).get("assigned_runs")
                or row.get("ocr", {}).get("near_wire", 0),
                row.get("known_by_old_8_code_scan", False), row.get("reason", ""),
                row["manual_path"],
            ])

    cards = []
    for row in candidates:
        image = (f'<img loading="lazy" src="{escape(row["thumbnail"])}" alt="Page preview">'
                 if row.get("thumbnail") else "")
        codes = escape(", ".join(_all_codes(row)) or "unresolved")
        cards.append(
            f'<article class="{escape(row["status"])}">{image}<div><h2>{escape(row["manual_title"])}</h2>'
            f'<p><b>Page {row["page_1_based"]}</b> · {escape(row["status"])} / '
            f'{escape(row["confidence"])} · codes: {codes}</p>'
            f'<p>{escape(row.get("reason", ""))}</p>'
            f'<p class="path">{escape(row["manual_path"])}</p></div></article>')
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Pintor black-and-white wiring-page inventory</title><style>
body{{font:15px system-ui;margin:0 auto;max-width:1200px;padding:24px;background:#f3f5f7;color:#18202a}}
header{{position:sticky;top:0;background:#f3f5f7ee;padding:4px 0 16px;backdrop-filter:blur(8px)}}
article{{display:grid;grid-template-columns:minmax(220px,360px) 1fr;gap:20px;background:white;margin:16px 0;padding:14px;border-left:7px solid #7b8794;border-radius:8px;box-shadow:0 2px 12px #0001}}
article.confirmed{{border-color:#18864b}}article.probable{{border-color:#2677c9}}article.review{{border-color:#d58b16}}
img{{width:100%;height:auto;border:1px solid #ccd3da}}h2{{margin:.2em 0;font-size:1.05rem}}.path{{font-size:.78rem;color:#667;overflow-wrap:anywhere}}
@media(max-width:700px){{article{{grid-template-columns:1fr}}}}
</style></head><body><header><h1>Pintor black-and-white wiring-page inventory</h1>
<p>{len(candidates)} candidate pages across {summary['manuals_scanned']} manuals;
{counts['confirmed']} confirmed, {counts['probable']} probable, {counts['review']} review;
{counts['already_colored']} already-coloured wiring pages ignored and
{counts['excluded_non_wiring']} non-wiring pages rejected.</p></header>
{''.join(cards) or '<p>No candidate page has been found yet.</p>'}</body></html>"""
    (out_dir / "report.html").write_text(html, encoding="utf-8")
    return summary


def merge_ledgers(inputs: list[Path], out_dir: Path) -> dict[tuple[str, int], dict]:
    """Merge disjoint/resumed shard ledgers and their referenced thumbnails."""
    out_dir.mkdir(parents=True, exist_ok=True)
    merged = {}
    shards = []
    for input_path in inputs:
        shard = input_path if input_path.is_dir() else input_path.parent
        shards.append(shard)
        ledger = input_path / "pages.jsonl" if input_path.is_dir() else input_path
        for key, record in _latest_records(ledger).items():
            current = merged.get(key)
            if current is None or str(record.get("scanned_utc", "")) >= str(
                    current.get("scanned_utc", "")):
                merged[key] = record
    target_thumbnails = out_dir / "thumbnails"
    for relative in sorted({
            str(record["thumbnail"]) for record in merged.values() if record.get("thumbnail")}):
        target = out_dir / relative
        for shard in shards:
            source = shard / relative
            if source.is_file():
                target_thumbnails.mkdir(exist_ok=True)
                shutil.copy2(source, target)
                break
    with (out_dir / "pages.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for record in sorted(
                merged.values(), key=lambda row: (str(row["manual_key"]), row["page_1_based"])):
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    return merged


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--library-manifest", type=Path)
    source.add_argument("--pdf-root", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--ocr-mode", choices=("off", "missing", "all"), default="missing")
    parser.add_argument("--dpi", type=int, default=DISCOVERY_DPI)
    parser.add_argument("--max-ocr-pixels", type=int, default=80_000_000)
    parser.add_argument("--no-thumbnails", action="store_true")
    parser.add_argument("--no-resume", action="store_true")
    parser.add_argument("--start-manual", type=int, default=0,
                        help="zero-based first manifest manual (for disjoint parallel shards)")
    parser.add_argument("--limit-manuals", type=int, default=0)
    parser.add_argument("--limit-pages", type=int, default=0)
    parser.add_argument("--start-page", type=int, default=0,
                        help="zero-based first page of the first selected manual")
    parser.add_argument("--progress-every", type=int, default=25)
    parser.add_argument("--merge-ledgers", nargs="+", type=Path,
                        help="merge completed shard directories instead of scanning")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.ocr_mode != "off":
        try:
            import rapidocr  # noqa: F401
        except ImportError:
            try:
                import rapidocr_onnxruntime  # noqa: F401
            except ImportError as error:
                raise SystemExit(
                    'OCR mode requires the optional runtime: install with pip install -e ".[ocr]"'
                ) from error
    if args.library_manifest:
        manuals = manuals_from_manifest(args.library_manifest.resolve())
        source = str(args.library_manifest.resolve())
    else:
        manuals = manuals_from_root(args.pdf_root.resolve())
        source = str(args.pdf_root.resolve())
    if not manuals:
        raise SystemExit("no PDF manuals found")
    if args.merge_ledgers:
        latest = merge_ledgers([path.resolve() for path in args.merge_ledgers], args.out.resolve())
        summary = write_reports(latest, manuals, args.out.resolve(), source, args.ocr_mode)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    latest = scan_library(
        manuals, args.out.resolve(), ocr_mode=args.ocr_mode, dpi=args.dpi,
        max_ocr_pixels=args.max_ocr_pixels, thumbnails=not args.no_thumbnails,
        resume=not args.no_resume, start_manual=args.start_manual,
        limit_manuals=args.limit_manuals,
        limit_pages=args.limit_pages, progress_every=args.progress_every,
        start_page=args.start_page,
    )
    summary = write_reports(latest, manuals, args.out.resolve(), source, args.ocr_mode)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
