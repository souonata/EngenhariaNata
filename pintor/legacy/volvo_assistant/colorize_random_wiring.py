"""Colorize a RANDOM wiring diagram end-to-end and assemble a reviewable PDF.

Run on the homelab VM (repo venv has cv2 / rapidocr / scikit-image / PyMuPDF):

    .venv/bin/python -m scripts.colorize_random_wiring            # random wiring diagram, net-solver
    .venv/bin/python -m scripts.colorize_random_wiring 2457       # a specific publication id
    .venv/bin/python -m scripts.colorize_random_wiring --greedy   # round-4 tracer instead of --net

Picks a wiring diagram that has a local PDF, renders each page at 200 DPI (the scale the detector is
tuned for), runs colorize_wiring_prototype.py on it (net-solver by default), and writes a colorized
PDF + the per-page PNGs to OUTDIR (default /tmp/colorized). Prints the output paths; send the PDF/PNG
back for review.
"""
import os
import sqlite3
import subprocess
import sys

import fitz  # PyMuPDF

HERE = os.path.dirname(os.path.abspath(__file__))      # backend/scripts
ROOT = os.path.dirname(HERE)                           # backend/
DB = os.path.join(ROOT, "database", "volvo_manuals.sqlite3")
SCRIPT = os.path.join(HERE, "colorize_wiring_prototype.py")

args = sys.argv[1:]
NET = "--greedy" not in args                           # net-solver by default; --greedy for round 4
OUTDIR = next((a for a in args if a.startswith("/") or a.startswith("./")), "/tmp/colorized")
want_id = next((int(a) for a in args if a.isdigit()), None)
MAX_PAGES = 6                                          # wiring diagrams are short; cap runaway matches
os.makedirs(OUTDIR, exist_ok=True)

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
if want_id is not None:
    row = conn.execute(
        "SELECT id,title,publication_number,local_path FROM publications WHERE id=?", (want_id,)
    ).fetchone()
else:
    row = conn.execute(
        "SELECT id,title,publication_number,local_path FROM publications "
        "WHERE (lower(title) LIKE '%wiring%' OR lower(document_type) LIKE '%wiring%') "
        "AND local_path IS NOT NULL AND local_path != '' ORDER BY RANDOM() LIMIT 1"
    ).fetchone()
if not row:
    sys.exit("no wiring diagram with a local PDF found")

pdf_path = row["local_path"]
if not os.path.isabs(pdf_path):
    pdf_path = os.path.join(ROOT, pdf_path)
print(f"PUB id={row['id']} num={row['publication_number']} title={row['title']!r}")
print(f"PDF {pdf_path}  (mode={'net-solver' if NET else 'greedy'})")
if not os.path.exists(pdf_path):
    sys.exit(f"PDF not found on disk: {pdf_path}")

doc = fitz.open(pdf_path)
n = min(doc.page_count, MAX_PAGES)
colored = []
for pno in range(n):
    pix = doc[pno].get_pixmap(matrix=fitz.Matrix(200 / 72.0, 200 / 72.0))
    src = os.path.join(OUTDIR, f"pub{row['id']}_p{pno}.png")
    out = os.path.join(OUTDIR, f"pub{row['id']}_p{pno}_colored.png")
    lbl = os.path.join(OUTDIR, f"pub{row['id']}_p{pno}.labels.json")
    pix.save(src)
    cmd = [sys.executable, SCRIPT, src, lbl, out] + (["--net"] if NET else [])
    print("RUN:", " ".join(cmd))
    subprocess.run(cmd, check=False)
    if os.path.exists(out):
        colored.append(out)
doc.close()

if not colored:
    sys.exit("no page produced a colorized output")

pdf_out = os.path.join(OUTDIR, f"pub{row['id']}_colored.pdf")
cdoc = fitz.open()
for p in colored:
    img = fitz.open(p)
    cdoc.insert_pdf(fitz.open("pdf", img.convert_to_pdf()))
    img.close()
cdoc.save(pdf_out)
cdoc.close()
print(f"COLORIZED_PDF {pdf_out}")
print(f"COLORIZED_PNGS {colored}")
if doc.page_count > MAX_PAGES:
    print(f"NOTE: only first {MAX_PAGES} of {doc.page_count} pages colorized (page cap)")
