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
from pathlib import Path
from types import SimpleNamespace

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


def classify(geometry, codes, wiring_publication=False, allow_text_confirmation=True):
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
    # A scanned plate does not stop being a wiring diagram because a component list is typeset
    # beside it. The 2000-era Volvo wiring manuals print exactly that shape -- a half-page scan of
    # the schematic with 700-1300 characters of parts list next to it -- and the text-free foldout
    # rule rejected every one of them, so a file whose title is "Wiring Diagram" was declined for
    # carrying no readable colour codes. Requiring no vector schematic of its own keeps this from
    # competing with the exact route, and OCR still has to find the codes before anything is
    # painted.
    scanned_plate = (geometry["image_coverage"] >= 0.25 and long_edge_pt >= 700 and not vector)

    if allow_text_confirmation and codes >= MIN_CODES:
        return f"{geometry_axis}+text", "confirmed"
    if (foldout or scanned_plate) and wiring_publication:
        return f"{geometry_axis}+ocr", "candidate"
    return f"{geometry_axis}+ocr", "rejected"


def merged_convention(names=None):
    """One matcher covering several conventions, for uploads that did not name one.

    Detection only has to answer "is this page a wiring diagram", not "which vocabulary is it
    written in" -- that question is settled later, per page, by ``_select_convention``. Taking the
    union of the code tokens keeps a Volvo foldout and an IEC schematic equally visible to the
    sweep.
    """
    from ..labels.conventions import list_conventions, load_convention

    chosen = list(names) if names else list_conventions()
    codes = set()
    separator = "/"
    for name in chosen:
        try:
            convention = load_convention(name)
        except Exception:
            continue
        codes.update(convention.codes)
        separator = convention.two_color_sep
    if not codes:
        raise ValueError("no usable convention for page discovery")
    return SimpleNamespace(codes=frozenset(codes), two_color_sep=separator)


def scan_document(pdf_path, convention_name="auto", min_codes=MIN_CODES, max_pages=0,
                  progress=None, chunk_pages=50):
    """Judge every page of ONE uploaded document and report the paintable ones.

    Same two kinds of evidence as the library sweep, applied to a single file:

    * **positioned code beside vector ink** -- one strong legend is enough when a sufficiently long
      stroke runs beside it, which retains small sensor and relay figures;
    * **raster foldout inside a wiring document** -- a near-full-page image on a large sheet with
      almost no text, in a file that is independently known to be about wiring. It carries no text
      to count, so it is a *candidate*: only OCR can confirm it, and the painter abstains if the
      labels never materialise.

    Returns the page indices to paint plus the evidence behind each one, so the interface can say
    why a page was chosen and the operator can audit a sweep afterwards.
    """
    import fitz

    convention_names = None if convention_name in ("", "auto") else [convention_name]
    convention = merged_convention(convention_names)
    gauged_re, striped_re = code_patterns(convention)
    from .wiring_evidence import inspect_vector_page
    document = fitz.open(pdf_path)
    try:
        page_count = len(document)
    finally:
        document.close()
    limit = page_count if max_pages <= 0 else min(page_count, max_pages)
    evidence = []
    wiring_phrase = bool(SUSPECT_TITLE.search(Path(pdf_path).name))

    # The document is reopened every ``chunk_pages`` pages. MuPDF keeps the parsed content, fonts
    # and decoded images of every page it has touched in a per-document store, so a single open
    # document walked from page 1 to page 2,000 grows for the whole walk. Closing it hands all of
    # that back, which is what keeps a 2,000-page sweep flat instead of linear in manual length.
    start = 0
    while start < limit:
        stop = min(start + max(1, chunk_pages), limit)
        document = fitz.open(pdf_path)
        try:
            for index in range(start, stop):
                page = document[index]
                text = page.get_text("text") or ""
                lowered = text.lower()
                if not wiring_phrase and any(phrase in lowered for phrase in SUSPECT_TEXT):
                    wiring_phrase = True
                codes = len(gauged_re.findall(text)) + len(striped_re.findall(text))
                vector = inspect_vector_page(page, convention_names=convention_names)
                # The ownership graph already materialised the drawing primitives on pages with
                # legends. Pages without legends need only the cheap image-coverage probe here.
                geometry = page_geometry(page, len(text.strip()), want_strokes=False)
                geometry["stroke_primitives"] = int(vector.get("segments", 0))
                evidence.append({
                    "page": index,
                    "codes": codes,
                    "geometry": geometry,
                    "vector": vector,
                })
        finally:
            document.close()
        start = stop
        if progress is not None:
            # Progress is also the liveness signal the job supervisor watches during a long sweep.
            progress(start, limit)

    # A file that contains one confirmed diagram is a wiring document, which is what lets its
    # untyped foldouts be treated as candidates rather than noise.
    confirmed_anywhere = any(
        item["vector"].get("status") == "confirmed" for item in evidence)
    wiring_document = wiring_phrase or confirmed_anywhere

    pages = []
    for item in evidence:
        # The whole-document sweep has the ownership graph above, so raw text density must never
        # confirm a page here.  Tables, connector schedules and colour-code glossaries routinely
        # contain eight or more valid tokens without containing a paintable wire.
        tier, status = classify(
            item["geometry"], item["codes"], wiring_document,
            allow_text_confirmation=False,
        )
        if item["vector"].get("status") == "excluded_non_wiring":
            tier, status = "vector+non-wiring", "rejected"
        elif item["vector"].get("status") == "already_colored":
            tier, status = "vector+already-coloured", "rejected"
        elif item["vector"].get("status") == "confirmed":
            tier, status = "vector+owned-colour", "confirmed"
        elif item["vector"].get("status") == "review":
            tier, status = "vector+colour-review", "candidate"
        pages.append({
            "page": item["page"],
            "codes": item["codes"],
            "tier": tier,
            "status": status,
            "image_coverage": item["geometry"]["image_coverage"],
            "stroke_primitives": item["geometry"]["stroke_primitives"],
            "vector": item["vector"],
        })

    confirmed = [item["page"] for item in pages if item["status"] == "confirmed"]
    candidates = [item["page"] for item in pages if item["status"] == "candidate"]
    excluded_non_wiring = [
        item["page"] for item in pages
        if item["vector"].get("status") == "excluded_non_wiring"
    ]
    already_colored = [
        item["page"] for item in pages
        if item["vector"].get("status") == "already_colored"
    ]
    return {
        "page_count": page_count,
        "pages_scanned": limit,
        "wiring_document": wiring_document,
        "min_codes": min_codes,
        "confirmed": confirmed,
        "candidates": candidates,
        "excluded_non_wiring": excluded_non_wiring,
        "already_colored": already_colored,
        "selected": sorted(set(confirmed) | set(candidates)),
        "evidence": [item for item in pages if item["status"] != "rejected"],
    }


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
