"""Build the read-only SQLite index ``discover_pages`` and ``batch`` expect, from a folder of PDFs.

    python -m wirecolor.tools.library_index --root E:/drawings --out workspaces/library.sqlite3
    python -m wirecolor.tools.library_index --root E:/drawings --out workspaces/library.sqlite3 \
        --resume

Why this exists: every tool downstream reads ``publications(id, title, document_type, local_path)``
and ``pdf_pages(publication_id, page_number, extracted_text)``. That index is produced by the
Volvo Penta assistant on the machine that ingested the library, and it travels badly -- its
``local_path`` values are relative to the drive letter of the machine that wrote it, and it is
blind to every PDF added to the archive afterwards. Pointing the discovery sweep at an archive
nobody re-indexed silently narrows the corpus, which is the exact failure §F1 of
``docs/WIRECOLOR-V4-DECISION.md`` documents.

So: walk a folder, extract page text once, write the index. Text extraction over thousands of
publications takes hours, so the run is **resumable** -- a publication whose sha256 is already
recorded is skipped, and the database is committed per publication. Interrupting the run and
restarting it loses at most one publication's work.

Nothing is written outside ``--out``. Every PDF is opened read-only and never rewritten.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sqlite3
import sys
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS publications (
    id            INTEGER PRIMARY KEY,
    title         TEXT,
    document_type TEXT,
    local_path    TEXT UNIQUE,
    sha256        TEXT,
    page_count    INTEGER,
    indexed_utc   TEXT
);
CREATE TABLE IF NOT EXISTS pdf_pages (
    publication_id INTEGER,
    page_number    INTEGER,
    extracted_text TEXT,
    PRIMARY KEY (publication_id, page_number)
);
CREATE INDEX IF NOT EXISTS pdf_pages_pub ON pdf_pages(publication_id);
"""

# Volvo publications carry their part number in the filename. It is the only stable identity the
# archive offers -- the same publication appears under different folder trees and different
# human-written names -- so it is preferred over path order for the publication id.
PART_NUMBER = re.compile(r"(?<!\d)(\d{7,8})(?!\d)")

# Document type is read off the path the way the catalogue names it; unknown is honest, not "?".
DOC_TYPES = ("Workshop manual", "Installation Manual", "Installation Instruction",
             "Installation Poster", "Service Bulletin", "Product Newsletter",
             "Operator manual", "Service Protocol", "Template")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def document_type(relative_path):
    haystack = relative_path.replace("_", " ").replace("-", " ").lower()
    for candidate in DOC_TYPES:
        if candidate.lower() in haystack:
            return candidate
    return "Unknown"


def title_for(document, relative_path):
    """Metadata title when the publisher set a real one, else the filename."""
    meta = (document.metadata or {}).get("title") or ""
    meta = meta.strip()
    if len(meta) >= 4 and not meta.lower().endswith(".pdf"):
        return meta
    stem = os.path.splitext(os.path.basename(relative_path))[0]
    return stem.replace("_", " ")


def publication_id(relative_path, taken):
    """The Volvo part number when the filename carries one, else a synthetic id above the range.

    Synthetic ids start at 10_000_000 so they can never collide with a real part number, which
    matters when an index built here is later merged with one built by the assistant.
    """
    for match in PART_NUMBER.findall(os.path.basename(relative_path)):
        number = int(match)
        if number not in taken:
            return number
    number = 10_000_000
    while number in taken:
        number += 1
    return number


def walk_pdfs(root):
    for directory, _, files in os.walk(root):
        for name in sorted(files):
            if name.lower().endswith(".pdf"):
                yield os.path.join(directory, name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="archive root; becomes --base downstream")
    parser.add_argument("--out", required=True, help="SQLite index to create or extend")
    parser.add_argument("--resume", action="store_true",
                        help="skip publications already recorded with the same sha256")
    parser.add_argument("--limit", type=int, help="stop after this many publications (smoke runs)")
    args = parser.parse_args()

    import fitz

    connection = sqlite3.connect(args.out)
    connection.executescript(SCHEMA)

    known = {row[0]: row[1] for row in
             connection.execute("SELECT local_path, sha256 FROM publications")}
    taken = {row[0] for row in connection.execute("SELECT id FROM publications")}

    indexed = skipped = failed = 0
    started = time.time()
    for path in walk_pdfs(args.root):
        relative = os.path.relpath(path, args.root).replace("\\", "/")
        digest = sha256(path)
        if args.resume and known.get(relative) == digest:
            skipped += 1
            continue

        try:
            document = fitz.open(path)
        except Exception as error:                                  # corrupt or encrypted
            print(f"  !! {relative}: {error}", file=sys.stderr)
            failed += 1
            continue

        pub = publication_id(relative, taken)
        taken.add(pub)
        try:
            connection.execute("DELETE FROM pdf_pages WHERE publication_id=?", (pub,))
            connection.execute(
                "INSERT OR REPLACE INTO publications"
                " (id, title, document_type, local_path, sha256, page_count, indexed_utc)"
                " VALUES (?,?,?,?,?,?,datetime('now'))",
                (pub, title_for(document, relative), document_type(relative), relative, digest,
                 document.page_count))
            connection.executemany(
                "INSERT OR REPLACE INTO pdf_pages (publication_id, page_number, extracted_text)"
                " VALUES (?,?,?)",
                ((pub, number + 1, page.get_text() or "")
                 for number, page in enumerate(document)))
            connection.commit()
        finally:
            document.close()

        indexed += 1
        if indexed % 25 == 0:
            rate = indexed / max(time.time() - started, 1e-9)
            print(f"  {indexed} indexed, {skipped} skipped ({rate:.1f}/s)", flush=True)
        if args.limit and indexed >= args.limit:
            break

    pages = connection.execute("SELECT count(*) FROM pdf_pages").fetchone()[0]
    publications = connection.execute("SELECT count(*) FROM publications").fetchone()[0]
    connection.close()
    print(f"{publications} publications, {pages} pages in {args.out} "
          f"({indexed} indexed, {skipped} skipped, {failed} unreadable, "
          f"{time.time() - started:.0f}s)")


if __name__ == "__main__":
    main()
