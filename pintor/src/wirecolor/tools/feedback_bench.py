"""Run the marked pages of the review corpus and report how the engine scores against them.

    python -m wirecolor.tools.feedback_bench --feedback marks.json --library D:/volvo-library \
        --out workspaces/bench

This is the regression benchmark for painting quality. It paints only the pages a reviewer actually
marked, scores them with :mod:`wirecolor.tools.feedback_fitness`, and writes one JSON report. The
same entry point is what a policy search calls per candidate, so the number a search optimises and
the number a human reads are the same number.

The OCR and geometry of a page do not depend on the decision policy, so each page keeps its label
cache between runs; a second pass over the same corpus re-solves rather than re-reads.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import time

from .feedback_fitness import PageScore, load_reports, marks_by_page, score_page, summarise


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_source(name: str, library: Path, digest: str | None = None,
                candidates: list[Path] | None = None,
                digest_cache: dict[Path, str] | None = None) -> Path | None:
    """Locate a source deterministically and enforce its exported SHA-256 when present."""
    candidates = sorted(candidates if candidates is not None else library.rglob("*.pdf"))
    digest_cache = digest_cache if digest_cache is not None else {}
    wanted_digest = str(digest or "").lower()
    stem = Path(name).stem if name else ""
    named = [candidate for candidate in candidates
             if candidate.name == name or (stem and candidate.stem == stem)]
    ordered = named + [candidate for candidate in candidates if candidate not in set(named)]
    if not wanted_digest:
        return named[0] if named else None
    for candidate in ordered:
        actual = digest_cache.setdefault(candidate, _sha256_file(candidate))
        if actual.lower() == wanted_digest:
            return candidate
    return None


def paint_and_score(pdf: Path, page_index: int, marks: list, out_dir: Path,
                    policy=None, paint_dpi: int = 720,
                    paint_pixel_budget: int = 60_000_000) -> PageScore:
    """Paint one marked page through the same route the web service would choose."""
    import numpy as np
    from PIL import Image

    from ..labels.conventions import load_convention
    from ..tools.paint_raster import paint_page as paint_raster_page
    from ..tools.paint_vector import paint_page as paint_vector_page
    from ..web_service import _select_convention

    overlay = out_dir / f"{pdf.stem[:40]}-p{page_index}.png"
    convention_name, confidence = _select_convention(pdf, page_index, "auto")
    report = {"declined": True, "runs": 0, "runs_painted": 0, "legends": 0}
    if confidence != "low":
        report = paint_vector_page(
            str(pdf), page_index, str(out_dir), convention_name=convention_name,
            paint_dpi=paint_dpi, paint_pixel_budget=paint_pixel_budget,
            decision_policy=policy, overlay_path=str(overlay))
    if report.get("declined") or (
            report.get("runs_painted") == 0 and report.get("legends") == 0):
        report = paint_raster_page(
            str(pdf), page_index, str(out_dir), convention_name="auto",
            paint_pixel_budget=paint_pixel_budget, overlay_path=str(overlay))
        convention_name = report.get("convention") or convention_name

    gate = report.get("v2") or {}
    released = not report.get("declined") and gate.get("passed", True) and overlay.is_file()
    reason = str(report.get("decline_reason") or "")
    if not reason and not gate.get("passed", True):
        reason = f"protected-region gate {gate.get('name', 'V2')} refused this page"

    if not released:
        # An unreleased page satisfies nothing: every mark on it stays unmet, which is exactly the
        # cost a refusal carries for the reviewer who marked it.
        outcomes = score_page(np.zeros((4, 4, 4), dtype=np.uint8), marks,
                              load_convention(convention_name) if convention_name else None)
        return PageScore(manual=pdf.stem, page=page_index, painted=False,
                         reason=reason or "not released", outcomes=outcomes)

    rgba = np.array(Image.open(overlay).convert("RGBA"))
    outcomes = score_page(rgba, marks, load_convention(convention_name))
    overlay.unlink(missing_ok=True)
    return PageScore(manual=pdf.stem, page=page_index, painted=True, outcomes=outcomes)


def run(feedback: Path, library: Path, out_dir: Path, policy=None,
        limit_pages: int | None = None) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    scores, missing_sources, benchmark_errors = [], [], []
    source_candidates = sorted(library.rglob("*.pdf"))
    digest_cache = {}
    started = time.time()
    for report in load_reports(feedback):
        pdf = find_source(report.get("original_name") or "", library,
                          report.get("source_sha256"), source_candidates, digest_cache)
        if pdf is None:
            missing_sources.append(report.get("original_name"))
            continue
        for page_index, marks in sorted(marks_by_page(report).items()):
            if limit_pages is not None and len(scores) >= limit_pages:
                break
            print(f"  {pdf.stem[:44]} p{page_index + 1} ({len(marks)} marcas)", flush=True)
            try:
                scores.append(paint_and_score(pdf, page_index, marks, out_dir, policy=policy))
            except Exception as error:                 # one bad page never stops a benchmark
                import numpy as np

                from ..labels.conventions import load_convention

                message = f"{type(error).__name__}: {error}"
                benchmark_errors.append({
                    "manual": pdf.name, "page_1_based": page_index + 1, "error": message})
                outcomes = score_page(
                    np.zeros((4, 4, 4), dtype=np.uint8), marks,
                    load_convention(report.get("convention") or "volvo_classic"),
                )
                scores.append(PageScore(manual=pdf.stem, page=page_index, painted=False,
                                        reason=message, outcomes=outcomes))
    payload = {
        "schema": "pintor-feedback-benchmark-v1",
        "seconds": round(time.time() - started, 1),
        "complete": not missing_sources and not benchmark_errors,
        "sources_not_found": missing_sources,
        "errors": benchmark_errors,
        "summary": summarise(scores),
        "pages": [{
            "manual": page.manual, "page_1_based": page.page + 1, "painted": page.painted,
            "reason": page.reason,
            "marks": [{"kind": item.kind, "satisfied": item.satisfied,
                       "scorable": item.scorable, "detail": item.detail}
                      for item in page.outcomes],
        } for page in scores],
    }
    (out_dir / "benchmark.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feedback", required=True, help="exported review marks (JSON)")
    parser.add_argument("--library", required=True, help="root holding the source manuals")
    parser.add_argument("--out", required=True, help="directory for the benchmark report")
    parser.add_argument("--limit-pages", type=int, default=None)
    args = parser.parse_args()

    payload = run(Path(args.feedback), Path(args.library), Path(args.out),
                  limit_pages=args.limit_pages)
    print(json.dumps(payload["summary"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
