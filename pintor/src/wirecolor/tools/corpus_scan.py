"""Find every code-bearing page in the library index. Stdlib only, read-only, no PDF opened.

    python -m wirecolor.tools.corpus_scan --db library.sqlite3 --out workspaces/corpus_all.json

Deliberately dependency-free so it can be copied to the machine that HOLDS the library and run
there with the system Python even when the painter itself runs on another workstation.

Same grammar the painting path uses: a page needs MIN_CODES wire colour codes in its extracted text
before it counts as a paintable diagram. Measured over 149,210 indexed pages this selects 350 pages
across 78 publications, and 82% of them are NOT titled "wiring diagram" -- they are Group 30
electrical chapters, diagnostics manuals and installation posters.

    !! ``pdf_pages.page_number`` is 1-BASED. Every wirecolor tool takes a 0-based page index. The
    !! conversion belongs to the CONSUMER of this file, which is why the raw value is kept here.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import defaultdict

MIN_CODES = 8

# The volvo_classic token set, inlined so this file needs nothing from the package.
TOKENS = ["BL", "BN", "BR", "DB", "DBL", "DGN", "GN", "GR", "LBL", "LBN", "LGN",
          "OR", "P", "PU", "R", "SB", "T", "VO", "W", "Y"]
SEP = "/"


def code_patterns(tokens=TOKENS, sep=SEP):
    token = "|".join(sorted((re.escape(t) for t in tokens), key=len, reverse=True))
    esc = re.escape(sep)
    gauged = re.compile(
        rf"(?<![\w.])\d{{1,2}}[.,]\d{{1,2}}\s*(?:{token})(?:{esc}(?:{token}))?(?![\w])")
    striped = re.compile(rf"(?<![\w{esc}])(?:{token}){esc}(?:{token})(?![\w{esc}])")
    return gauged, striped


def scan(db_path, min_codes=MIN_CODES):
    gauged_re, striped_re = code_patterns()
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    titles, paths = {}, {}
    for pub, title, path in con.execute("SELECT id, title, local_path FROM publications"):
        titles[pub], paths[pub] = title, path

    hits = defaultdict(list)
    scanned = 0
    for pub, page, text in con.execute(
            "SELECT publication_id, page_number, extracted_text FROM pdf_pages"):
        scanned += 1
        if not text or len(text.strip()) < 20:
            continue
        count = len(gauged_re.findall(text)) + len(striped_re.findall(text))
        if count >= min_codes:
            hits[pub].append({"page": page, "codes": count})

    publications = []
    for pub, pages in hits.items():
        pages.sort(key=lambda p: -p["codes"])
        publications.append({"pub": pub, "title": titles.get(pub, ""), "path": paths.get(pub, ""),
                             "pages": pages, "page_count": len(pages),
                             "best_codes": pages[0]["codes"]})
    publications.sort(key=lambda p: -p["best_codes"])
    return {"publications": publications,
            "total_publications": len(publications),
            "total_pages": sum(p["page_count"] for p in publications),
            "pages_scanned": scanned,
            "min_codes": min_codes,
            "page_numbers_are": "1-based"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--min-codes", type=int, default=MIN_CODES)
    args = parser.parse_args()

    result = scan(args.db, args.min_codes)
    with open(args.out, "w") as handle:
        json.dump(result, handle, indent=1)
    print(f"{result['total_publications']} publications, {result['total_pages']} pages "
          f"(of {result['pages_scanned']} scanned)")


if __name__ == "__main__":
    main()
