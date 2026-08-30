"""Build a local human-review dashboard for broad wiring-page candidates.

The inventory scanner is deliberately recall-oriented.  This tool turns its candidate ledger into
an offline, file:// friendly review surface with high-resolution page images, zoom/pan, explicit
paint/do-not-paint decisions, browser autosave and portable JSON feedback.

Examples::

    pintor-review-inventory --inventory D:/inventory/shard_00 \
        --out D:/inventory/shard_00

    pintor-review-inventory --inventory D:/inventory/shard_00 D:/inventory/shard_01 \
        --out D:/inventory/human_review --feedback previous-feedback.json

Source PDFs and inventory ledgers are read-only.  Human feedback is never promoted to a model or
painting rule automatically; the exported JSON is an auditable ground-truth input for later code
and evaluation work.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import shutil
from typing import Any, Mapping

from .verify_wiring_inventory import _source_fingerprint, load_candidates


REVIEW_SCHEMA = "pintor-wiring-page-review-v1"
FEEDBACK_SCHEMA = "pintor-wiring-page-feedback-v1"
DECISIONS = frozenset({"paintable_wiring", "do_not_paint", "unsure"})
DEFAULT_MAX_SIDE = 2800
DEFAULT_JPEG_QUALITY = 86


def _page_identity(record: Mapping[str, Any]) -> str:
    """Return a stable, non-path page ID suitable for feedback round-trips."""
    source = "|".join((
        str(record.get("manual_sha256") or ""),
        str(record["manual_key"]),
        str(int(record["page_1_based"])),
    ))
    return "page-" + sha256(source.encode("utf-8")).hexdigest()[:24]


def _all_codes(record: Mapping[str, Any]) -> list[str]:
    return sorted({
        str(legend.get("code"))
        for source in (record.get("vector", {}), record.get("ocr", {}))
        for legend in source.get("legends", ())
        if legend.get("code")
    })


def _automatic_mode(record: Mapping[str, Any]) -> str:
    vector = record.get("vector", {})
    ocr = record.get("ocr", {})
    if vector.get("status") == "confirmed":
        return "vector"
    if ocr.get("status") in {"probable", "review"}:
        return "ocr/raster"
    return "mixed/uncertain"


def _pdf_uri(record: Mapping[str, Any]) -> str:
    try:
        uri = Path(str(record["manual_path"])).resolve().as_uri()
    except (KeyError, OSError, ValueError):
        return ""
    return f"{uri}#page={int(record['page_1_based'])}"


def _render_review_image(record: Mapping[str, Any], out_dir: Path, *,
                         max_side: int, jpeg_quality: int) -> str:
    """Render one bounded high-resolution page image and return its relative path."""
    import fitz

    source = Path(str(record["manual_path"]))
    if not source.is_file():
        raise FileNotFoundError(f"source PDF is missing: {source}")
    page_index = int(record.get("page_index", int(record["page_1_based"]) - 1))
    image_key = "|".join((
        str(record.get("manual_sha256") or source), str(page_index), str(max_side),
    ))
    image_name = sha256(image_key.encode("utf-8")).hexdigest()[:24] + ".jpg"
    relative = Path("review-images") / image_name
    target = out_dir / relative
    if target.is_file() and target.stat().st_size > 0:
        return relative.as_posix()

    target.parent.mkdir(parents=True, exist_ok=True)
    document = fitz.open(source)
    try:
        if page_index < 0 or page_index >= len(document):
            raise IndexError(f"page {page_index + 1} is outside the {len(document)}-page PDF")
        page = document[page_index]
        longest_side = max(float(page.rect.width), float(page.rect.height), 1.0)
        scale = max_side / longest_side
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        temporary = target.with_suffix(".tmp.jpg")
        pixmap.pil_save(
            temporary, format="JPEG", quality=jpeg_quality, optimize=True,
        )
        temporary.replace(target)
    finally:
        document.close()
    return relative.as_posix()


def _card_thumbnail(record: Mapping[str, Any], out_dir: Path) -> str:
    """Copy the inventory thumbnail locally, or render a small fallback."""
    relative = record.get("thumbnail")
    ledger = record.get("_source_ledger")
    if relative and ledger:
        source = Path(str(ledger)).parent / str(relative)
        if source.is_file():
            target_relative = Path("review-thumbnails") / f"{_page_identity(record)}.jpg"
            target = out_dir / target_relative
            if not target.is_file() or target.stat().st_size != source.stat().st_size:
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_suffix(".tmp.jpg")
                shutil.copy2(source, temporary)
                temporary.replace(target)
            return target_relative.as_posix()
    return _render_review_image(record, out_dir, max_side=900, jpeg_quality=74)


def _review_record(record: Mapping[str, Any], out_dir: Path, *,
                   max_side: int, jpeg_quality: int) -> dict[str, Any]:
    review_image = _render_review_image(
        record, out_dir, max_side=max_side, jpeg_quality=jpeg_quality,
    )
    vector = record.get("vector", {})
    ocr = record.get("ocr", {})
    return {
        "id": _page_identity(record),
        "manual_key": str(record["manual_key"]),
        "manual_sha256": str(record.get("manual_sha256") or ""),
        "manual_title": str(record.get("manual_title") or Path(str(record["manual_path"])).stem),
        "page_1_based": int(record["page_1_based"]),
        "page_count": int(record.get("page_count") or 0),
        "source_fingerprint": _source_fingerprint(dict(record)),
        "automatic": {
            "status": str(record.get("status") or "review"),
            "confidence": str(record.get("confidence") or "low"),
            "mode": _automatic_mode(record),
            "reason": str(record.get("reason") or ""),
            "codes": _all_codes(record),
            "wire_evidence": int(
                vector.get("assigned_runs") or ocr.get("near_wire") or 0
            ),
        },
        "review_image": review_image,
        # Keep every image relative to review.html.  Besides making the dashboard movable, this
        # also means file:// and an optional localhost review server behave identically.
        "thumbnail": _card_thumbnail(record, out_dir),
        "pdf_uri": _pdf_uri(record),
    }


def validate_feedback(payload: Mapping[str, Any],
                      known_records: Mapping[str, Mapping[str, Any]] | None = None) -> dict[str, Any]:
    """Validate and normalize one dashboard feedback export.

    When ``known_records`` is provided, every decision must match the source manual, page and
    detector fingerprint represented by that dashboard.  This prevents silently applying a label
    to a different revision of a page.
    """
    if not isinstance(payload, Mapping) or payload.get("schema") != FEEDBACK_SCHEMA:
        raise ValueError(f"feedback schema must be {FEEDBACK_SCHEMA}")
    raw_decisions = payload.get("decisions")
    if not isinstance(raw_decisions, list):
        raise ValueError("feedback decisions must be a list")

    normalized = []
    seen = set()
    for index, raw in enumerate(raw_decisions):
        if not isinstance(raw, Mapping):
            raise ValueError(f"decision {index + 1} must be an object")
        page_id = str(raw.get("id") or "")
        decision = str(raw.get("decision") or "")
        if not page_id or page_id in seen:
            raise ValueError(f"decision {index + 1} has a missing or duplicate id")
        if decision not in DECISIONS:
            raise ValueError(f"decision {page_id} has unsupported value {decision!r}")
        try:
            page = int(raw["page_1_based"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"decision {page_id} has an invalid page number") from error
        if page < 1:
            raise ValueError(f"decision {page_id} has an invalid page number")
        item = {
            "id": page_id,
            "manual_key": str(raw.get("manual_key") or ""),
            "manual_sha256": str(raw.get("manual_sha256") or ""),
            "page_1_based": page,
            "decision": decision,
            "reason": str(raw.get("reason") or ""),
            "notes": str(raw.get("notes") or ""),
            "source_fingerprint": str(raw.get("source_fingerprint") or ""),
            "updated_utc": str(raw.get("updated_utc") or ""),
        }
        if known_records is not None:
            known = known_records.get(page_id)
            if known is None:
                raise ValueError(f"decision {page_id} is not present in this dashboard")
            for field in ("manual_key", "manual_sha256", "page_1_based", "source_fingerprint"):
                if item[field] != known[field]:
                    raise ValueError(f"decision {page_id} does not match dashboard field {field}")
        seen.add(page_id)
        normalized.append(item)
    return {
        "schema": FEEDBACK_SCHEMA,
        "exported_utc": str(payload.get("exported_utc") or ""),
        "reviewer": str(payload.get("reviewer") or ""),
        "source": dict(payload.get("source") or {}),
        "decisions": normalized,
    }


def load_feedback(path: Path, records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Load a prior export and return decisions keyed by stable review ID."""
    known = {record["id"]: record for record in records}
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    valid = validate_feedback(payload, known)
    return {decision["id"]: decision for decision in valid["decisions"]}


def _candidate_feedback_record(record: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": _page_identity(record),
        "manual_key": str(record["manual_key"]),
        "manual_sha256": str(record.get("manual_sha256") or ""),
        "page_1_based": int(record["page_1_based"]),
        "source_fingerprint": _source_fingerprint(dict(record)),
    }


def load_candidate_feedback(path: Path,
                            candidates: Mapping[tuple[str, int], Mapping[str, Any]]) \
        -> dict[str, dict[str, Any]]:
    """Validate feedback against the full source ledger before any round sampling."""
    known = {
        item["id"]: item
        for item in (_candidate_feedback_record(record) for record in candidates.values())
    }
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    valid = validate_feedback(payload, known)
    return {decision["id"]: decision for decision in valid["decisions"]}


def _current_prefilter_reason(record: Mapping[str, Any]) -> str | None:
    """Apply cheap current text-layer rules to an older broad-inventory record."""
    import fitz

    from .wiring_evidence import (
        _explicit_non_wiring_reason,
        _page_text,
        _text_layer_is_corrupted,
    )

    source = Path(str(record["manual_path"]))
    document = fitz.open(source)
    try:
        page_index = int(record.get("page_index", int(record["page_1_based"]) - 1))
        page = document[page_index]
        raw_text = page.get_text("text") or ""
        if _text_layer_is_corrupted(raw_text) \
                and not (record.get("ocr", {}).get("legends") or ()):
            return "corrupted exact text has no independent OCR colour evidence"
        return _explicit_non_wiring_reason(_page_text(page))
    finally:
        document.close()


def _evidence_lane(record: Mapping[str, Any]) -> tuple[str, str]:
    return _automatic_mode(record), str(record.get("status") or "review")


def _evidence_signature(record: Mapping[str, Any]) -> tuple[Any, ...]:
    reason = str(record.get("reason") or "").casefold()
    reason = reason.replace("multiple colour legends", "colour legends") \
        .replace("one colour legend", "colour legends")
    codes = tuple(_all_codes(record))
    code_shape = codes if len(codes) <= 8 else ("dense", str(len(codes) // 5))
    return (
        str(record["manual_key"]), _automatic_mode(record),
        str(record.get("status") or "review"), reason, code_shape,
    )


def select_diverse_candidates(candidates: Mapping[tuple[str, int], dict], *,
                              max_pages: int = 0, max_per_manual: int = 0,
                              max_per_signature: int = 1) -> dict[tuple[str, int], dict]:
    """Deterministically interleave evidence modes while suppressing repeated page families."""
    if max_pages <= 0 and max_per_manual <= 0 and max_per_signature <= 0:
        return dict(candidates)
    lanes: dict[tuple[str, str], list[tuple[tuple[str, int], dict]]] = {}
    for key, record in candidates.items():
        lanes.setdefault(_evidence_lane(record), []).append((key, record))
    for rows in lanes.values():
        rows.sort(key=lambda item: (
            str(item[1].get("manual_title") or "").casefold(),
            int(item[1]["page_1_based"]), str(item[1]["manual_key"]),
        ))

    lane_order = sorted(lanes, key=lambda lane: (
        {"review": 0, "probable": 1, "confirmed": 2}.get(lane[1], 3), lane[0],
    ))
    selected: dict[tuple[str, int], dict] = {}
    manual_counts: dict[str, int] = {}
    signature_counts: dict[tuple[Any, ...], int] = {}
    positions = {lane: 0 for lane in lane_order}
    while lane_order and (max_pages <= 0 or len(selected) < max_pages):
        progressed = False
        for lane in tuple(lane_order):
            rows = lanes[lane]
            while positions[lane] < len(rows):
                key, record = rows[positions[lane]]
                positions[lane] += 1
                manual = str(record["manual_key"])
                signature = _evidence_signature(record)
                if max_per_manual > 0 and manual_counts.get(manual, 0) >= max_per_manual:
                    continue
                if max_per_signature > 0 \
                        and signature_counts.get(signature, 0) >= max_per_signature:
                    continue
                selected[key] = record
                manual_counts[manual] = manual_counts.get(manual, 0) + 1
                signature_counts[signature] = signature_counts.get(signature, 0) + 1
                progressed = True
                break
            if positions[lane] >= len(rows):
                lane_order.remove(lane)
            if max_pages > 0 and len(selected) >= max_pages:
                break
        if not progressed:
            break
    return selected


def _dataset_id(records: list[dict[str, Any]]) -> str:
    source = "\n".join(
        f"{item['id']}|{item['source_fingerprint']}" for item in records
    )
    return sha256(source.encode("utf-8")).hexdigest()[:20]


def build_dashboard(inputs: list[Path], out_dir: Path, *, max_side: int = DEFAULT_MAX_SIDE,
                    jpeg_quality: int = DEFAULT_JPEG_QUALITY, feedback: Path | None = None,
                    exclude_reviewed: bool = False, apply_current_prefilter: bool = False,
                    max_pages: int = 0, max_per_manual: int = 0,
                    max_per_signature: int = 0, progress_every: int = 20) -> dict[str, Any]:
    """Render all candidate pages and write ``review.html`` plus a compact manifest."""
    if max_side < 600:
        raise ValueError("review image max side must be at least 600 pixels")
    if not 40 <= jpeg_quality <= 100:
        raise ValueError("JPEG quality must be between 40 and 100")
    candidates = load_candidates(inputs)
    if not candidates:
        raise ValueError("no first-stage wiring candidates found")
    all_candidate_count = len(candidates)
    prior_feedback = load_candidate_feedback(feedback.resolve(), candidates) if feedback else {}
    excluded_reviewed = 0
    if exclude_reviewed:
        before = len(candidates)
        candidates = {
            key: record for key, record in candidates.items()
            if _page_identity(record) not in prior_feedback
        }
        excluded_reviewed = before - len(candidates)
    prefilter_rejections = []
    if apply_current_prefilter:
        retained = {}
        for key, record in candidates.items():
            try:
                reason = _current_prefilter_reason(record)
            except (OSError, RuntimeError, ValueError, IndexError) as error:
                reason = None
                record = dict(record)
                record["prefilter_error"] = f"{type(error).__name__}: {error}"
            if reason:
                prefilter_rejections.append({
                    "manual_key": str(record["manual_key"]),
                    "page_1_based": int(record["page_1_based"]),
                    "reason": reason,
                })
            else:
                retained[key] = record
        candidates = retained
    eligible_count = len(candidates)
    candidates = select_diverse_candidates(
        candidates, max_pages=max_pages, max_per_manual=max_per_manual,
        max_per_signature=max_per_signature,
    )
    if not candidates:
        raise ValueError("no unreviewed candidate remains after round selection")

    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    ordered = sorted(
        candidates.values(),
        key=lambda row: (str(row.get("manual_title") or "").casefold(),
                         int(row["page_1_based"]), str(row["manual_key"])),
    )
    errors = []
    for number, candidate in enumerate(ordered, 1):
        try:
            records.append(_review_record(
                candidate, out_dir, max_side=max_side, jpeg_quality=jpeg_quality,
            ))
        except Exception as error:  # keep a 560-page review resumable after one damaged PDF
            errors.append({
                "manual_key": str(candidate.get("manual_key") or ""),
                "page_1_based": int(candidate.get("page_1_based") or 0),
                "error": f"{type(error).__name__}: {error}",
            })
        if progress_every > 0 and (number % progress_every == 0 or number == len(ordered)):
            print(f"review images {number}/{len(ordered)}; errors {len(errors)}")

    if not records:
        raise ValueError("no candidate page could be rendered")
    record_ids = {record["id"] for record in records}
    initial = {page_id: decision for page_id, decision in prior_feedback.items()
               if page_id in record_ids}
    data = {
        "schema": REVIEW_SCHEMA,
        "feedback_schema": FEEDBACK_SCHEMA,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_id": _dataset_id(records),
        "source_ledgers": [str(path) for path in inputs],
        "image_max_side": max_side,
        "source_candidate_pages": all_candidate_count,
        "eligible_candidate_pages": eligible_count,
        "excluded_prior_feedback": excluded_reviewed,
        "excluded_current_prefilter": len(prefilter_rejections),
        "records": records,
        "initial_feedback": initial,
    }
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    encoded = encoded.replace("<", "\\u003c").replace(">", "\\u003e")
    html = DASHBOARD_HTML.replace("__REVIEW_DATA__", encoded)
    temporary = out_dir / "review.html.tmp"
    temporary.write_text(html, encoding="utf-8")
    temporary.replace(out_dir / "review.html")

    manifest = {
        "schema": REVIEW_SCHEMA,
        "generated_utc": data["generated_utc"],
        "dataset_id": data["dataset_id"],
        "candidate_pages": len(records),
        "manuals": len({record["manual_key"] for record in records}),
        "render_errors": errors,
        "image_max_side": max_side,
        "review_html": "review.html",
        "feedback_schema": FEEDBACK_SCHEMA,
        "source_candidate_pages": all_candidate_count,
        "eligible_candidate_pages": eligible_count,
        "excluded_prior_feedback": excluded_reviewed,
        "excluded_current_prefilter": len(prefilter_rejections),
        "prefilter_rejections": prefilter_rejections,
        "selection": {
            "max_pages": max_pages,
            "max_per_manual": max_per_manual,
            "max_per_signature": max_per_signature,
        },
    }
    temporary = out_dir / "review-manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(out_dir / "review-manifest.json")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--inventory", nargs="+", required=True, type=Path,
        help="first-stage pages.jsonl files, shard directories or an inventory root",
    )
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--image-max-side", type=int, default=DEFAULT_MAX_SIDE)
    parser.add_argument("--jpeg-quality", type=int, default=DEFAULT_JPEG_QUALITY)
    parser.add_argument(
        "--feedback", type=Path,
        help="optional prior dashboard export to validate and preload",
    )
    parser.add_argument(
        "--exclude-reviewed", action="store_true",
        help="exclude every page already decided in --feedback",
    )
    parser.add_argument(
        "--apply-current-prefilter", action="store_true",
        help="apply current cheap text/page-family exclusions to older inventory records",
    )
    parser.add_argument("--max-pages", type=int, default=0)
    parser.add_argument("--max-per-manual", type=int, default=0)
    parser.add_argument("--max-per-signature", type=int, default=0)
    parser.add_argument("--progress-every", type=int, default=20)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        summary = build_dashboard(
            args.inventory, args.out,
            max_side=args.image_max_side,
            jpeg_quality=args.jpeg_quality,
            feedback=args.feedback,
            exclude_reviewed=args.exclude_reviewed,
            apply_current_prefilter=args.apply_current_prefilter,
            max_pages=args.max_pages,
            max_per_manual=args.max_per_manual,
            max_per_signature=args.max_per_signature,
            progress_every=args.progress_every,
        )
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error
    print(json.dumps(summary, ensure_ascii=False, indent=2))


DASHBOARD_HTML = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pintor wiring candidate review</title>
<style>
:root{color-scheme:light;--bg:#eef1f4;--card:#fff;--ink:#16212c;--muted:#607080;--line:#cbd3da;
  --accent:#0f6574;--yes:#18794e;--no:#b42318;--maybe:#a15c00;--focus:#ffbf47}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
button,input,select,textarea{font:inherit}.top{position:sticky;z-index:20;top:0;background:#eef1f4f2;border-bottom:1px solid var(--line);backdrop-filter:blur(9px)}
.top-inner{max-width:1500px;margin:auto;padding:14px 20px}.headline{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap}.headline h1{font-size:1.35rem;margin:0}.headline p{margin:3px 0 0;color:var(--muted)}
.progress{margin-left:auto;min-width:260px}.meter{height:8px;background:#d8dfe5;border-radius:99px;overflow:hidden}.meter>span{display:block;height:100%;width:0;background:var(--yes);transition:width .2s}
.counts{display:flex;gap:12px;margin-top:5px;font-size:12px;color:var(--muted);flex-wrap:wrap}.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.toolbar input[type=search]{min-width:260px;flex:1}
input,select,textarea,.btn{border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);padding:7px 9px}.btn{cursor:pointer;font-weight:650}.btn:hover{border-color:var(--accent)}.btn:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--focus);outline-offset:1px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.save-state{color:var(--muted);font-size:12px}.save-state.warn{color:var(--no);font-weight:700}
main{max-width:1500px;margin:auto;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px}.empty{padding:50px;text-align:center;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-left:6px solid #8392a0;border-radius:10px;box-shadow:0 3px 14px #13202b0d;overflow:hidden}.card[data-decision=paintable_wiring]{border-left-color:var(--yes)}.card[data-decision=do_not_paint]{border-left-color:var(--no)}.card[data-decision=unsure]{border-left-color:var(--maybe)}
.preview{display:block;width:100%;height:250px;padding:0;border:0;border-bottom:1px solid var(--line);background:#dde3e8;cursor:zoom-in;overflow:hidden}.preview img{display:block;width:100%;height:100%;object-fit:contain;background:white}.content{padding:13px}.title-row{display:flex;gap:10px;align-items:flex-start}.title-row h2{font-size:1rem;line-height:1.25;margin:0;flex:1}.page{white-space:nowrap;font-weight:750}.badges{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.badge{font-size:11px;background:#eef2f5;color:#43515d;border-radius:999px;padding:3px 7px}.badge.confirmed{background:#d9f3e5;color:#0f623d}.badge.probable{background:#deecfa;color:#18588c}.badge.review{background:#fff0cf;color:#815000}
.reason{color:var(--muted);min-height:2.8em}.codes{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:11px 0}.decision{padding:8px 5px;background:white;border:1px solid var(--line);border-radius:7px;cursor:pointer;font-weight:700}.decision.yes[aria-pressed=true]{background:var(--yes);color:#fff;border-color:var(--yes)}.decision.no[aria-pressed=true]{background:var(--no);color:#fff;border-color:var(--no)}.decision.maybe[aria-pressed=true]{background:var(--maybe);color:#fff;border-color:var(--maybe)}
.details{display:grid;gap:7px}.details label{display:grid;gap:3px;color:var(--muted);font-size:12px}.details textarea{min-height:56px;resize:vertical}.links{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}.links a{color:var(--accent);font-weight:700;text-decoration:none}.links a:hover{text-decoration:underline}
dialog{width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#10161c;color:#fff}dialog::backdrop{background:#10161c}.viewer-stage{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none}.viewer-stage.dragging{cursor:grabbing}.viewer-image{position:absolute;left:0;top:0;max-width:none;max-height:none;transform-origin:0 0;user-select:none;-webkit-user-drag:none;background:#fff}.viewer-bar{position:absolute;z-index:3;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#111a22dd;border:1px solid #ffffff2b;border-radius:9px;padding:8px;backdrop-filter:blur(8px)}.viewer-bar .btn{background:#26323d;color:#fff;border-color:#53616d}.viewer-title{min-width:220px;flex:1;font-weight:700}.viewer-hint{font-size:12px;color:#bac6cf}.viewer-decisions{display:flex;gap:5px}.viewer-decisions .decision{background:#26323d;color:#fff;border-color:#53616d}.viewer-decisions .yes[aria-pressed=true]{background:var(--yes)}.viewer-decisions .no[aria-pressed=true]{background:var(--no)}.viewer-decisions .maybe[aria-pressed=true]{background:var(--maybe)}
@media(max-width:720px){.grid{grid-template-columns:1fr}.top-inner,main{padding-left:10px;padding-right:10px}.toolbar input[type=search]{min-width:100%}.preview{height:220px}.viewer-hint{display:none}}
</style></head><body>
<header class="top"><div class="top-inner"><div class="headline"><div><h1>Pintor wiring candidate review</h1><p>Confirm only pages with physical wires and printed colour codes that Pintor may paint.</p></div><div class="progress"><div class="meter"><span id="meter"></span></div><div class="counts" id="counts"></div></div></div>
<div class="toolbar"><input id="search" type="search" placeholder="Search manual, page, code or reason" aria-label="Search candidates"><select id="autoFilter" aria-label="Automatic status"><option value="all">All automatic statuses</option><option value="confirmed">Auto confirmed</option><option value="probable">Auto probable</option><option value="review">Auto review</option></select><select id="decisionFilter" aria-label="Human decision"><option value="all">All human decisions</option><option value="pending">Pending only</option><option value="paintable_wiring">Paintable wiring</option><option value="do_not_paint">Do not paint</option><option value="unsure">Unsure</option></select><input id="reviewer" placeholder="Reviewer name (optional)" aria-label="Reviewer name"><button class="btn" id="next">Next pending</button><button class="btn primary" id="export">Export feedback JSON</button><label class="btn" for="import">Import feedback</label><input id="import" type="file" accept="application/json,.json" hidden><span class="save-state" id="saveState"></span></div></div></header>
<main><div class="grid" id="grid"></div><div class="empty" id="empty" hidden>No pages match these filters.</div></main>
<dialog id="viewer"><div class="viewer-stage" id="viewerStage"><img class="viewer-image" id="viewerImage" alt="Full page review image"></div><div class="viewer-bar"><button class="btn" id="closeViewer" aria-label="Close viewer">Close</button><span class="viewer-title" id="viewerTitle"></span><span class="viewer-hint">wheel: zoom · drag: pan · double-click: fit · Y/N/U: decide</span><button class="btn" id="zoomOut" aria-label="Zoom out">−</button><button class="btn" id="fit">Fit</button><button class="btn" id="zoomIn" aria-label="Zoom in">+</button><div class="viewer-decisions" id="viewerDecisions"></div></div></dialog>
<script>const DATA=__REVIEW_DATA__;
const YES_REASONS=[['physical-coded-wires','Physical wires with printed colour codes'],['outlined-coded-harness','Outlined harness wires with colour callouts'],['raster-coded-wires','Scanned/raster wires with readable colour codes'],['other-paintable','Other paintable wiring diagram']];
const NO_REASONS=[['no-physical-coded-wires','No physical colour-coded wires'],['connector-pin-labels-only','Connector or pin labels only'],['component-illustration','Component/connector illustration'],['flowchart-process','Flowchart or service process'],['table-legend-reference','Table, legend or colour reference'],['mechanical-hydraulic','Mechanical, hydraulic or fuel diagram'],['already-coloured','Wires are already coloured'],['non-electrical','Not an electrical diagram'],['other-do-not-paint','Other reason not to paint']];
const UNSURE_REASONS=[['needs-closer-review','Needs closer review'],['codes-unreadable','Colour codes are unreadable'],['wire-ownership-unclear','Physical wire ownership is unclear'],['partial-or-mixed-page','Partial or mixed page'],['other-unsure','Other uncertainty']];
const byId=Object.fromEntries(DATA.records.map(r=>[r.id,r]));
let state={reviewer:'',decisions:{...DATA.initial_feedback}};
const storageKey='pintor-wiring-review:'+DATA.dataset_id;
const saveState=document.getElementById('saveState');
function restore(){try{const raw=localStorage.getItem(storageKey);if(raw){const parsed=JSON.parse(raw);if(parsed&&parsed.decisions)state={reviewer:parsed.reviewer||'',decisions:{...state.decisions,...parsed.decisions}}}saveState.textContent='Autosaved in this browser'}catch(e){saveState.textContent='Browser autosave unavailable — export frequently';saveState.classList.add('warn')}}
function persist(){state.reviewer=document.getElementById('reviewer').value.trim();try{localStorage.setItem(storageKey,JSON.stringify(state));saveState.textContent='Saved locally '+new Date().toLocaleTimeString();saveState.classList.remove('warn')}catch(e){saveState.textContent='Not autosaved — export feedback now';saveState.classList.add('warn')}updateStats()}
restore();document.getElementById('reviewer').value=state.reviewer;
function h(tag,attrs={},...children){const node=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')node.className=v;else if(k.startsWith('on'))node.addEventListener(k.slice(2),v);else node.setAttribute(k,v)}for(const child of children)node.append(child instanceof Node?child:document.createTextNode(String(child)));return node}
const thumbnailObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const image=entry.target;image.src=image.dataset.src;thumbnailObserver.unobserve(image)}},{rootMargin:'500px'}):{observe:image=>{image.src=image.dataset.src}};
function reasonOptions(decision){return decision==='paintable_wiring'?YES_REASONS:decision==='do_not_paint'?NO_REASONS:decision==='unsure'?UNSURE_REASONS:[]}
function setDecision(id,decision,reason){const previous=state.decisions[id]||{};state.decisions[id]={id,decision,reason:reason===undefined?(previous.decision===decision?previous.reason:''):reason,notes:previous.notes||'',updated_utc:new Date().toISOString()};persist();syncCard(id);syncViewer();applyFilters()}
function feedbackItem(record,decision){return {id:record.id,manual_key:record.manual_key,manual_sha256:record.manual_sha256,page_1_based:record.page_1_based,decision:decision.decision,reason:decision.reason||'',notes:decision.notes||'',source_fingerprint:record.source_fingerprint,updated_utc:decision.updated_utc||new Date().toISOString()}}
function decisionButtons(record,where){const wrap=h('div',{class:where==='viewer'?'viewer-decisions':'actions'});for(const [value,label,cls] of [['paintable_wiring','Paintable','yes'],['do_not_paint','Do not paint','no'],['unsure','Unsure','maybe']]){wrap.append(h('button',{class:'decision '+cls,type:'button','data-value':value,'aria-pressed':'false',onclick:()=>setDecision(record.id,value)},label))}return wrap}
function makeCard(record){const decision=state.decisions[record.id];const image=h('img',{'data-src':record.thumbnail,alt:'Candidate page '+record.page_1_based,loading:'lazy'});thumbnailObserver.observe(image);const preview=h('button',{class:'preview',type:'button',onclick:()=>openViewer(record.id)},image);const badges=h('div',{class:'badges'},h('span',{class:'badge '+record.automatic.status},'Auto '+record.automatic.status),h('span',{class:'badge'},record.automatic.mode),h('span',{class:'badge'},record.automatic.confidence+' confidence'),h('span',{class:'badge'},record.automatic.wire_evidence+' wire signals'));
const content=h('div',{class:'content'},h('div',{class:'title-row'},h('h2',{},record.manual_title),h('span',{class:'page'},'Page '+record.page_1_based+(record.page_count?' / '+record.page_count:''))),badges,h('div',{class:'codes'},record.automatic.codes.length?'Codes: '+record.automatic.codes.join(', '):'Codes unresolved'),h('p',{class:'reason'},record.automatic.reason),decisionButtons(record,'card'));
const reason=h('select',{'data-role':'reason',onchange:e=>{const d=state.decisions[record.id];if(d){d.reason=e.target.value;d.updated_utc=new Date().toISOString();persist()}}});const notes=h('textarea',{'data-role':'notes',placeholder:'Optional note for improving detection',onchange:e=>{const d=state.decisions[record.id]||{id:record.id,decision:'unsure',reason:'needs-closer-review'};d.notes=e.target.value;d.updated_utc=new Date().toISOString();state.decisions[record.id]=d;persist();syncCard(record.id)}});const details=h('div',{class:'details'},h('label',{},'Reason',reason),h('label',{},'Notes',notes));const links=h('div',{class:'links'},record.pdf_uri?h('a',{href:record.pdf_uri,target:'_blank',rel:'noopener'},'Open original PDF page'):h('span',{},'Original PDF unavailable'),h('span',{class:'save-state'},record.id));content.append(details,links);const card=h('article',{class:'card','data-id':record.id,'data-decision':decision?decision.decision:'pending'},preview,content);return card}
const grid=document.getElementById('grid');for(const record of DATA.records)grid.append(makeCard(record));
function syncCard(id){const card=grid.querySelector(`[data-id="${CSS.escape(id)}"]`);if(!card)return;const d=state.decisions[id];card.dataset.decision=d?d.decision:'pending';for(const b of card.querySelectorAll('.decision'))b.setAttribute('aria-pressed',String(Boolean(d&&b.dataset.value===d.decision)));const select=card.querySelector('[data-role=reason]');const reasons=d?reasonOptions(d.decision):[];select.replaceChildren(h('option',{value:''},d?'Select a reason':'Choose a decision first'));for(const [value,label] of reasons)select.append(h('option',{value},label));select.disabled=!d;select.value=d?d.reason||'':'';const notes=card.querySelector('[data-role=notes]');notes.disabled=!d;notes.value=d?d.notes||'':''}
for(const record of DATA.records)syncCard(record.id);
function updateStats(){const values=Object.values(state.decisions);const yes=values.filter(d=>d.decision==='paintable_wiring').length,no=values.filter(d=>d.decision==='do_not_paint').length,unsure=values.filter(d=>d.decision==='unsure').length,done=yes+no+unsure,total=DATA.records.length;document.getElementById('meter').style.width=(100*done/total)+'%';document.getElementById('counts').replaceChildren(h('span',{},done+' / '+total+' reviewed'),h('span',{},yes+' paintable'),h('span',{},no+' do not paint'),h('span',{},unsure+' unsure'))}
function applyFilters(){const query=document.getElementById('search').value.trim().toLowerCase(),auto=document.getElementById('autoFilter').value,human=document.getElementById('decisionFilter').value;let visible=0;for(const record of DATA.records){const card=grid.querySelector(`[data-id="${CSS.escape(record.id)}"]`),d=state.decisions[record.id],decision=d?d.decision:'pending';const hay=[record.manual_title,record.manual_key,record.page_1_based,record.automatic.reason,...record.automatic.codes].join(' ').toLowerCase();const show=(!query||hay.includes(query))&&(auto==='all'||record.automatic.status===auto)&&(human==='all'||decision===human);card.hidden=!show;if(show)visible++}document.getElementById('empty').hidden=visible!==0;updateStats()}
for(const id of ['search','autoFilter','decisionFilter'])document.getElementById(id).addEventListener(id==='search'?'input':'change',applyFilters);document.getElementById('reviewer').addEventListener('change',persist);
document.getElementById('next').onclick=()=>{const target=DATA.records.find(r=>!state.decisions[r.id]);if(!target)return;document.getElementById('decisionFilter').value='all';applyFilters();grid.querySelector(`[data-id="${CSS.escape(target.id)}"]`).scrollIntoView({behavior:'smooth',block:'center'})};
function exportFeedback(){const decisions=DATA.records.filter(r=>state.decisions[r.id]).map(r=>feedbackItem(r,state.decisions[r.id]));const payload={schema:DATA.feedback_schema,exported_utc:new Date().toISOString(),reviewer:document.getElementById('reviewer').value.trim(),source:{review_schema:DATA.schema,dataset_id:DATA.dataset_id,generated_utc:DATA.generated_utc,candidate_pages:DATA.records.length},decisions};const blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pintor-wiring-feedback-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);saveState.textContent='Exported '+decisions.length+' decisions'}
document.getElementById('export').onclick=exportFeedback;
document.getElementById('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const payload=JSON.parse(await file.text());if(payload.schema!==DATA.feedback_schema||!Array.isArray(payload.decisions))throw new Error('unsupported feedback schema');const imported={};for(const item of payload.decisions){const known=byId[item.id];if(!known||!['paintable_wiring','do_not_paint','unsure'].includes(item.decision))continue;if(item.manual_key!==known.manual_key||Number(item.page_1_based)!==known.page_1_based||item.manual_sha256!==known.manual_sha256||item.source_fingerprint!==known.source_fingerprint)continue;imported[item.id]=item}state.decisions={...state.decisions,...imported};if(payload.reviewer)document.getElementById('reviewer').value=payload.reviewer;persist();for(const r of DATA.records)syncCard(r.id);applyFilters();alert('Imported '+Object.keys(imported).length+' matching decisions.')}catch(error){alert('Could not import feedback: '+error.message)}finally{e.target.value=''}};
const viewer=document.getElementById('viewer'),stage=document.getElementById('viewerStage'),full=document.getElementById('viewerImage'),viewerDecisions=document.getElementById('viewerDecisions');let currentId=null,scale=1,ox=0,oy=0,drag=null;
function applyView(){full.style.transform=`translate(${ox}px,${oy}px) scale(${scale})`}
function fitView(){if(!full.naturalWidth)return;scale=Math.min(stage.clientWidth/full.naturalWidth,stage.clientHeight/full.naturalHeight)*.96;ox=(stage.clientWidth-full.naturalWidth*scale)/2;oy=(stage.clientHeight-full.naturalHeight*scale)/2;applyView()}
function zoomAt(factor,x=stage.clientWidth/2,y=stage.clientHeight/2){const next=Math.min(16,Math.max(.05,scale*factor));ox=x-(x-ox)*(next/scale);oy=y-(y-oy)*(next/scale);scale=next;applyView()}
function openViewer(id){currentId=id;const r=byId[id];document.getElementById('viewerTitle').textContent=r.manual_title+' · page '+r.page_1_based;full.src=r.review_image;viewer.showModal();syncViewer();if(full.complete)fitView()}
function syncViewer(){if(!currentId)return;const record=byId[currentId],d=state.decisions[currentId];viewerDecisions.replaceChildren(...[...decisionButtons(record,'viewer').children]);for(const b of viewerDecisions.querySelectorAll('.decision'))b.setAttribute('aria-pressed',String(Boolean(d&&b.dataset.value===d.decision)))}
full.onload=fitView;document.getElementById('closeViewer').onclick=()=>viewer.close();document.getElementById('fit').onclick=fitView;document.getElementById('zoomIn').onclick=()=>zoomAt(1.3);document.getElementById('zoomOut').onclick=()=>zoomAt(1/1.3);stage.ondblclick=fitView;
stage.addEventListener('wheel',e=>{e.preventDefault();const rect=stage.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top)},{passive:false});stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,ox,oy};stage.classList.add('dragging');stage.setPointerCapture(e.pointerId)});stage.addEventListener('pointermove',e=>{if(!drag)return;ox=drag.ox+e.clientX-drag.x;oy=drag.oy+e.clientY-drag.y;applyView()});stage.addEventListener('pointerup',()=>{drag=null;stage.classList.remove('dragging')});stage.addEventListener('pointercancel',()=>{drag=null;stage.classList.remove('dragging')});addEventListener('resize',()=>{if(viewer.open)fitView()});
addEventListener('keydown',e=>{if(!viewer.open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='Escape'){viewer.close();return}const decision=e.key.toLowerCase()==='y'?'paintable_wiring':e.key.toLowerCase()==='n'?'do_not_paint':e.key.toLowerCase()==='u'?'unsure':null;if(decision){e.preventDefault();setDecision(currentId,decision)}});
applyFilters();</script></body></html>'''


if __name__ == "__main__":
    main()
