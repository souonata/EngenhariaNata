"""Staged batch colorization into a PRIVATE staging area.

    python -m wirecolor.batch --staging workspaces/batch --db library.sqlite3 \
        --base D:/drawings --pubs 2550,2476,2503
    python -m wirecolor.batch --staging workspaces/batch --db library.sqlite3 \
        --base D:/drawings --query --limit 5

Safety contract (enforced here, not merely intended):

* the source library is opened READ-ONLY and every source file's sha256 is compared before and
  after the sheet is processed -- a run that alters an original fails loudly;
* every byte written goes inside the staging root, which is created private (0700) and lives
  outside the served application tree, so a painted diagram is never published by accident;
* nothing is written to the manuals database and no publication record is touched.

Replacing the library's PDFs with painted versions is deliberately NOT part of this tool.  That
step happens only after a human review of the staged output, by a separate explicit action.

Each sheet directory accumulates its own working render, tiled OCR labels, OCR memo, diagnostic
dump, profile, colorized PDF and 2-page review PDF, so a re-run replays from cache in minutes and
the whole corpus can be re-audited after any rule change.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import time
import traceback

WIRING_QUERY = """
    SELECT id, title FROM publications
     WHERE lower(title) LIKE '%wiring diagram%'
     ORDER BY id
"""


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _inside(root, path):
    root = os.path.realpath(root)
    return os.path.realpath(path).startswith(root + os.sep)


def select_sheets(db, pubs=None, query=False, limit=None):
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        if pubs:
            marks = ",".join("?" * len(pubs))
            rows = con.execute(
                f"SELECT id, title FROM publications WHERE id IN ({marks}) ORDER BY id",
                pubs).fetchall()
        elif query:
            rows = con.execute(WIRING_QUERY).fetchall()
        else:
            rows = []
    finally:
        con.close()
    return rows[:limit] if limit else rows


def source_path(db, pub, base):
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        row = con.execute(
            "SELECT local_path FROM publications WHERE id=?", (pub,)).fetchone()
    finally:
        con.close()
    if not row:
        raise SystemExit(f"pub {pub} not found")
    return row[0] if os.path.isabs(row[0]) else os.path.join(base, row[0])


def page_count(pdf_path):
    import fitz
    doc = fitz.open(pdf_path)
    try:
        return len(doc)
    finally:
        doc.close()


def resolve_pages(spec, pdf_path):
    """Which page indices of one publication to process.

    A wiring-diagram publication is a multi-page document -- cover, symbol key, several diagram
    sheets, revision history. Applying a single page index to every publication (the previous
    behaviour, default 0) silently reduced "the corpus" to "page 0 of each publication", so every
    coverage and route number ever reported was measured on one page per document.
    """
    total = page_count(pdf_path)
    if spec == "all":
        return list(range(total)), total
    wanted = [int(part) for part in str(spec).split(",") if part.strip() != ""]
    return [p for p in wanted if 0 <= p < total], total


def process_sheet(pub, page, title, staging, db, base, convention_name, routes_dir):
    """Colorize one page entirely inside ``staging``; return its report."""
    from .instrument import reset_for_tests
    from .detect.outlined_wires import detect_callout_leaders
    from .engine.semantics import enforce_raster_semantics
    from .labels.conventions import load_convention
    from .paint.raster_overlay import attach_overlay, build_overlay_rgba, render_native
    from .pipeline import run_page
    from .prep import make_transform, native_canvas_size, render_working_png
    from .profile import measure_sheet_profile, save_profile
    from .verify.validators import v2_protected_overlap, v7_preservation

    tag = f"pub{pub}_p{page}"
    sheet_dir = os.path.join(staging, "sheets", tag)
    os.makedirs(sheet_dir, exist_ok=True)
    if not _inside(staging, sheet_dir):
        raise SystemExit(f"refusing to write outside the staging root: {sheet_dir}")

    pdf_path = source_path(db, pub, base)
    before = sha256(pdf_path)
    started = time.time()

    # One memo and one diagnostic dump per sheet: a replay of sheet B can never inherit sheet A.
    reset_for_tests(ocr_cache=os.path.join(sheet_dir, "ocr_memo.json"),
                    diag_dir=os.path.join(sheet_dir, "diag"))

    work = os.path.join(sheet_dir, f"{tag}_work.png")
    meta_path = os.path.join(sheet_dir, f"{tag}_meta.json")
    if not (os.path.exists(work) and os.path.exists(meta_path)):
        with open(meta_path, "w") as fh:
            json.dump(render_working_png(pdf_path, page, work), fh)
    meta = json.load(open(meta_path))

    convention = load_convention(convention_name)
    solution = run_page(work, os.path.join(sheet_dir, f"{tag}_labels.json"), convention)
    solution["semantic_exclusions"] = detect_callout_leaders(
        pdf_path, page, [convention])
    solution, engineering_semantics = enforce_raster_semantics(solution, convention)
    profile = measure_sheet_profile(solution, meta)
    save_profile(profile, os.path.join(sheet_dir, f"{tag}_profile.json"))

    width, height = native_canvas_size(meta)
    transform = make_transform(meta)
    native = render_native(pdf_path, page, width, height)
    rgba = build_overlay_rgba(solution, native, transform)
    del native

    colorized = os.path.join(sheet_dir, f"{tag}_colorized.pdf")
    if os.path.exists(colorized):
        os.remove(colorized)
    stats = attach_overlay(pdf_path, colorized, page, rgba)
    v2 = v2_protected_overlap(rgba, solution, transform)
    v7 = v7_preservation(pdf_path, colorized, page, stats["ocg"])

    import fitz
    review = os.path.join(sheet_dir, f"{tag}_review.pdf")
    document = fitz.open()
    painted, original = fitz.open(colorized), fitz.open(pdf_path)
    document.insert_pdf(painted, from_page=page, to_page=page)
    document.insert_pdf(original, from_page=page, to_page=page)
    document.save(review)
    document.close(); painted.close(); original.close()

    after = sha256(pdf_path)
    if before != after:
        raise SystemExit(f"ORIGINAL MODIFIED for pub {pub} -- aborting the batch")

    report = {
        "pub": pub, "page": page, "title": title, "tag": tag,
        "source_sha256": before, "source_unchanged": True,
        "seconds": round(time.time() - started, 1),
        "validators": {"V2": v2, "V7": v7},
        "passed": bool(v2["passed"] and v7["passed"]),
        "engineering_semantics": engineering_semantics,
        "profile": {"dash_pitch": profile["dash_rhythm"]["pitch"],
                    "dash_stroke": profile["dash_rhythm"]["stroke"],
                    "labels": profile["labels"]["count"],
                    "distinct_codes": profile["codes"]["distinct_codes"],
                    "solid_claims": profile["coverage"]["solid_claims"],
                    "dashed_routes": profile["topology"]["dashed_routes"],
                    "unresolved_roots": profile["coverage"]["unresolved_roots"]},
        "review_pdf": review, "colorized_pdf": colorized,
    }

    routes_file = os.path.join(routes_dir, f"wirecolor_routes_pub{pub}.json")
    if os.path.exists(routes_file):
        from .tools.route_audit import audit
        rows = audit(os.path.join(sheet_dir, "diag"),
                     json.load(open(routes_file))["routes"], radius=25.0)
        report["ground_truth"] = {
            "routes_complete": sum(r["passed"] == r["total"] for r in rows),
            "routes": len(rows),
            "checkpoints_passed": sum(r["passed"] for r in rows),
            "checkpoints": sum(r["total"] for r in rows),
        }
    with open(os.path.join(sheet_dir, "report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--staging", required=True)
    ap.add_argument("--pubs", help="comma-separated publication ids")
    ap.add_argument("--query", action="store_true",
                    help="select every publication titled '%%wiring diagram%%'")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--pages", default="0",
                    help="page indices per publication: 'all', or a comma-separated list "
                         "(default '0' -- the legacy behaviour, one page per document)")
    ap.add_argument("--db", required=True,
                    help="read-only SQLite catalogue with publications(id,title,local_path)")
    ap.add_argument("--base", required=True,
                    help="base directory for relative publications.local_path values")
    ap.add_argument("--convention", default="volvo_classic")
    ap.add_argument("--routes-dir", default="/tmp/wirecolor_p0/routes")
    ap.add_argument("--force", action="store_true", help="re-process finished sheets")
    args = ap.parse_args()

    staging = os.path.realpath(args.staging)
    os.makedirs(staging, mode=0o700, exist_ok=True)
    print(f"staging root (private, never served): {staging}")

    pubs = [int(part) for part in args.pubs.split(",")] if args.pubs else None
    sheets = select_sheets(args.db, pubs, args.query, args.limit)
    if not sheets:
        raise SystemExit("no sheets selected -- pass --pubs or --query")
    print(f"{len(sheets)} sheet(s) selected")

    index_path = os.path.join(staging, "index.json")
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    for pub, title in sheets:
        pages, total_pages = resolve_pages(args.pages, source_path(args.db, pub, args.base))
        if not pages:
            print(f"[skip] pub{pub}: no page of {total_pages} matches --pages {args.pages}")
            continue
        for page in pages:
            tag = f"pub{pub}_p{page}"
            done = index.get(tag, {}).get("passed")
            if done and not args.force:
                print(f"[skip] {tag} already complete")
                continue
            print(f"[run ] {tag} (of {total_pages} pages): {title}")
            try:
                report = process_sheet(pub, page, title, staging, args.db, args.base,
                                       args.convention, args.routes_dir)
            except SystemExit:
                raise
            except Exception as error:                  # one bad sheet never stops the batch
                # A crash is a DISTINCT outcome from a bad result: without this flag a refactor
                # that turns an exception into a silent low-coverage run looks like an improvement.
                report = {"pub": pub, "tag": tag, "title": title, "passed": False,
                          "crashed": True,
                          "error": f"{type(error).__name__}: {error}",
                          "traceback": traceback.format_exc()[-2000:]}
                print(f"[FAIL] {tag}: {report['error']}")
            report["source_pages"] = total_pages
            index[tag] = report
            tmp = f"{index_path}.tmp"
            with open(tmp, "w") as fh:
                json.dump(index, fh, indent=1)
            os.replace(tmp, index_path)
            if report.get("passed"):
                truth = report.get("ground_truth")
                extra = (f" | ground truth {truth['checkpoints_passed']}/{truth['checkpoints']}"
                         if truth else "")
                print(f"[ok  ] {tag} in {report['seconds']}s | "
                      f"{report['profile']['solid_claims']} solid claims, "
                      f"{report['profile']['dashed_routes']} dashed routes{extra}")

    complete = sum(1 for row in index.values() if row.get("passed"))
    print(f"\nstaged {complete}/{len(index)} sheets under {staging}")
    print("originals verified unchanged; nothing published, nothing written to the database")


if __name__ == "__main__":
    main()
