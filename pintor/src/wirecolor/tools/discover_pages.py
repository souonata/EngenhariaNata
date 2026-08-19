"""Find every paintable wiring page in the library, and write the corpus manifest.

    python -m wirecolor.tools.discover_pages --db library.sqlite3 --base D:/drawings \
        --out workspaces/corpus/manifest.json

Why this exists: the corpus was selected as ``publications.title LIKE '%wiring diagram%'`` -- 109 of
7,264 publications. Measured against the whole library, **85% of the publications that carry
machine-readable wire colour codes are NOT titled that way.** They are Group 30 electrical
chapters, EGC/EFI/EVC diagnostics manuals, installation instructions and service bulletins. Any
number computed over the title-matched set was computed over a sixth of the real material.

Two stages, cheap first:

1. **Text stage** -- run the convention's wire-code grammar over ``pdf_pages.extracted_text``, which
   already holds text for ~149,000 pages. Sweeps the entire library without opening a PDF. A page
   carrying many colour codes IS a wiring diagram we can paint, whatever the publication is called.

2. **Structure stage** -- the text stage is blind to raster foldouts, which have no text layer at
   all; on the title-matched set most diagram pages are exactly that. So for any publication with a
   reason to be suspected -- a wiring-ish title, a wiring phrase anywhere in its text, or a stage-1
   hit -- every page is opened and judged on geometry: stroke primitives for vector pages, image
   coverage and page size for raster ones.

The manifest it writes is the input to every later run and every score, so it records WHY each page
was selected and what evidence tier it lands in. Nothing is written outside ``--out``; the library
is opened read-only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
from collections import Counter, defaultdict

# A page needs this many colour codes before it is a diagram rather than a passing mention in prose.
MIN_CODES = 8

# Titles worth opening even when the text stage found nothing -- raster foldouts hide behind these.
SUSPECT_TITLE = re.compile(r"wiring|schemat|circuit|electr|harness|group\s*30", re.IGNORECASE)

# Phrases that betray wiring content anywhere in a publication's text, including a contents page
# that names a foldout the foldout itself cannot describe ("Wiring diagrams ... 85").
#
# Deliberately STRONG phrases. "electrical system" alone was measured to pull in 1,031 extra
# publications -- it appears in the contents of nearly every engine manual -- taking the suspect
# set to 2,061 publications and 108,305 pages. The strong phrases plus title matching give 783
# publications and 46,610 pages, which is the difference between a sweep that finishes and one
# that does not.
SUSPECT_TEXT = ("wiring diagram", "wiring schematic", "circuit diagram",
                "electrical diagram", "cable harness", "group 30")


def code_patterns(convention):
    """Wire-code matchers built from the Convention, so this holds for any manufacturer."""
    token = "|".join(sorted((re.escape(t) for t in convention.codes), key=len, reverse=True))
    sep = re.escape(convention.two_color_sep)
    gauged = re.compile(
        rf"(?<![\w.])\d{{1,2}}[.,]\d{{1,2}}\s*(?:{token})(?:{sep}(?:{token}))?(?![\w])")
    striped = re.compile(rf"(?<![\w{sep}])(?:{token}){sep}(?:{token})(?![\w{sep}])")
    return gauged, striped


def text_stage(con, convention, min_codes=MIN_CODES):
    """Pages whose extracted text carries enough wire codes to be a paintable diagram."""
    gauged_re, striped_re = code_patterns(convention)
    hits = defaultdict(list)
    scanned = no_text = 0
    for pub, page, text in con.execute(
            "SELECT publication_id, page_number, extracted_text FROM pdf_pages"):
        scanned += 1
        if not text or len(text.strip()) < 20:
            no_text += 1
            continue
        gauged = len(gauged_re.findall(text))
        striped = len(striped_re.findall(text))
        if gauged + striped >= min_codes:
            hits[pub].append({"page": page, "gauged": gauged, "striped": striped})
    return hits, {"pages_scanned": scanned, "pages_without_text": no_text}


def suspect_publications(con, text_hits):
    """Publications worth opening in the structure stage."""
    suspects = {}
    for pub in text_hits:
        suspects[pub] = ["wire_codes_in_text"]
    for pub, title in con.execute("SELECT id, title FROM publications"):
        if title and SUSPECT_TITLE.search(title):
            suspects.setdefault(pub, []).append("title")
    like = " OR ".join(["lower(extracted_text) LIKE ?"] * len(SUSPECT_TEXT))
    params = [f"%{phrase}%" for phrase in SUSPECT_TEXT]
    for (pub,) in con.execute(
            f"SELECT DISTINCT publication_id FROM pdf_pages WHERE {like}", params):
        suspects.setdefault(pub, []).append("wiring_phrase_in_text")
    return suspects


def page_geometry(page, text_chars, want_strokes=None):
    """Structural evidence for one page, without rendering it.

    ``get_drawings()`` is by far the most expensive call here -- it materialises every path on the
    page -- and running it on all 46,610 pages of the suspect set costs hours, almost all of it
    spent on prose. So it runs only when the cheap evidence leaves the question open: a page that is
    already almost entirely covered by an image is a scan, and its stroke count is going to be zero
    whatever we do. ``text_chars`` comes from the database, which has it for every page, so it costs
    nothing here.
    """
    area = abs(page.rect.width * page.rect.height) or 1.0
    coverage = 0.0
    for info in page.get_images(full=True):
        for rect in page.get_image_rects(info[0]):
            coverage += abs(rect.width * rect.height)
    coverage = coverage / area

    if want_strokes is None:
        want_strokes = coverage < 0.6
    primitives = (sum(len(d.get("items", ())) for d in page.get_drawings())
                  if want_strokes else 0)
    return {
        "stroke_primitives": primitives,
        "strokes_counted": bool(want_strokes),
        "image_coverage": round(coverage, 3),
        "page_pt": [round(page.rect.width, 1), round(page.rect.height, 1)],
        "text_chars": text_chars,
    }


def classify(geometry, codes, wiring_publication=False):
    """Evidence tier for one page, and how strongly it is believed to be a wiring diagram.

    Returns ``(tier, status)`` where status is ``confirmed``, ``candidate`` or ``rejected``.

    **Stroke count is not evidence of a wiring diagram.** An earlier version treated
    ``stroke_primitives >= 500`` as sufficient, and over the whole library that selected 22,567
    pages across 1,696 publications -- including 9,308 pages of Operators manuals. A rendered
    sample settled it: a page with 4,279 primitives and no codes turned out to be a propeller
    assembly illustration. Any page with a table, a border or a line drawing clears that bar. It
    only looked right on the title-matched corpus, where every page was a wiring diagram already.

    What actually identifies a paintable page is **wire colour codes**, because those are the thing
    being painted. Geometry then says only HOW the page must be read, not WHETHER it is one.

    Raster foldouts carry no text layer at all, so codes cannot be counted on them. They are
    ``candidate`` -- a near-full-page image on a large sheet inside a publication independently
    known to be about wiring -- and must be confirmed by OCR before they are believed. Calling them
    confirmed here would be asserting a fact nothing has measured.
    """
    vector = geometry["stroke_primitives"] >= 500
    geometry_axis = "vector" if vector else "raster"
    long_edge_pt = max(geometry["page_pt"])
    foldout = (geometry["image_coverage"] >= 0.5 and long_edge_pt >= 700
               and geometry["text_chars"] < 200)

    if codes >= MIN_CODES:
        return f"{geometry_axis}+text", "confirmed"
    if foldout and wiring_publication:
        return f"{geometry_axis}+ocr", "candidate"
    return f"{geometry_axis}+ocr", "rejected"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True,
                        help="read-only SQLite index with publications and pdf_pages tables")
    parser.add_argument("--base", required=True,
                        help="base directory for relative publications.local_path values")
    parser.add_argument("--convention", default="volvo_classic")
    parser.add_argument("--min-codes", type=int, default=MIN_CODES)
    parser.add_argument("--text-only", action="store_true",
                        help="skip the structure stage (no PDFs opened)")
    parser.add_argument("--limit-publications", type=int)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    from ..labels.conventions import load_convention

    convention = load_convention(args.convention)
    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)

    text_hits, text_stats = text_stage(con, convention, args.min_codes)
    print(f"text stage: {text_stats['pages_scanned']} pages scanned, "
          f"{sum(len(v) for v in text_hits.values())} paintable pages in "
          f"{len(text_hits)} publications")

    suspects = suspect_publications(con, text_hits)
    print(f"structure stage: {len(suspects)} suspect publications")

    meta = {r[0]: {"title": r[1] or "", "type": r[2] or "?", "path": r[3]}
            for r in con.execute(
                "SELECT id, title, document_type, local_path FROM publications")}

    pages = []
    tiers = Counter()
    if not args.text_only:
        import fitz
        ordered = sorted(suspects)
        if args.limit_publications:
            ordered = ordered[:args.limit_publications]
        for n, pub in enumerate(ordered, 1):
            info = meta.get(pub)
            if not info or not info["path"]:
                continue
            path = info["path"] if os.path.isabs(info["path"]) \
                else os.path.join(args.base, info["path"])
            if not os.path.exists(path):
                continue
            codes_by_page = {h["page"]: h["gauged"] + h["striped"]
                             for h in text_hits.get(pub, ())}
            # A foldout is only believed to be wiring when its publication independently is: a
            # wiring-ish title, or codes found on some OTHER page of the same document.
            is_wiring_pub = ("title" in suspects[pub]) or bool(codes_by_page)
            # pdf_pages.page_number is 1-based and dense (verified: min 1, max == page count,
            # one row per page), so fitz index i is page_number i+1. There is deliberately NO
            # fallback to page_number == i: a "try 1-based, else 0-based" lookup silently
            # attributes each hit page's codes to TWO fitz indices, which inflated the confirmed
            # count from 350 to 623 before it was caught by the totals failing to reconcile.
            lengths = {r[0]: r[1] for r in con.execute(
                "SELECT page_number, LENGTH(TRIM(COALESCE(extracted_text,''))) "
                "FROM pdf_pages WHERE publication_id=?", (pub,))}
            try:
                document = fitz.open(path)
            except Exception as error:                      # a broken file is a manifest fact
                pages.append({"pub": pub, "error": f"{type(error).__name__}: {error}"})
                continue
            for index in range(len(document)):
                try:
                    text_chars = lengths.get(index + 1, 0)
                    geometry = page_geometry(document[index], text_chars)
                except Exception:                           # one bad page never stops the sweep
                    continue
                # page_number in pdf_pages is 1-based; fitz indexes from 0
                codes = codes_by_page.get(index + 1, 0)
                tier, status = classify(geometry, codes, wiring_publication=is_wiring_pub)
                if status == "rejected":
                    continue
                tiers[f"{tier}/{status}"] += 1
                pages.append({
                    "pub": pub, "page": index, "tier": tier, "status": status,
                    "title": info["title"][:70], "document_type": info["type"],
                    "titled_wiring": "wiring diagram" in info["title"].lower(),
                    "reasons": suspects[pub], "wire_codes": codes, **geometry,
                })
            document.close()
            if n % 50 == 0:
                print(f"  {n}/{len(ordered)} publications, {len(pages)} pages kept")

    manifest = {
        "convention": args.convention,
        "min_codes": args.min_codes,
        "text_stage": text_stats,
        "publications_with_wire_codes": len(text_hits),
        "suspect_publications": len(suspects),
        "tiers": dict(tiers),
        "pages": pages,
    }
    with open(args.out, "w") as handle:
        json.dump(manifest, handle, indent=1)
    print(f"-> {args.out}: {len(pages)} paintable pages, tiers {dict(tiers)}")


if __name__ == "__main__":
    main()
