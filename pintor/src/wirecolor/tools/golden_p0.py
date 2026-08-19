"""P0 golden-equivalence harness: prove the wirecolor extraction is behaviour-identical to the
frozen v1 script (colorize_wiring_prototype.py) on the golden sheets.

Runs where the source catalogue and drawings are available:

    python -m wirecolor.tools.golden_p0 --db library.sqlite3 --base D:/drawings \
        --pubs 2457 2461 2476 2550 6994 2483 --ocr-check 2461

Per pub: render page 0 of the CURRENT original PDF at the v1 working scale (200 DPI), let v1
produce the labels JSON (OCR) on first use, then run BOTH pipelines on the identical
png+labels inputs and require:
  - pixel-identical output PNGs,
  - identical stdout (counters, deadend histograms; output-path token normalised),
  - with --ocr-check N: v2's OCR module independently reproduces v1's labels JSON for pub N.

Everything is written under --workdir (default /tmp/wirecolor_p0); originals are opened
read-only. Exit code 0 = all goldens pass.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys

DPI = 200


def render_page(pub_id: int, workdir: str, db: str, base: str) -> str:
    import fitz
    png = os.path.join(workdir, f"pub{pub_id}_p0.png")
    if os.path.exists(png):
        return png
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    row = con.execute("SELECT local_path FROM publications WHERE id=?", (pub_id,)).fetchone()
    con.close()
    if not row:
        raise SystemExit(f"pub {pub_id} not found in DB")
    doc = fitz.open(os.path.join(base, row[0]))
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(DPI / 72.0, DPI / 72.0))
    pix.save(png)
    doc.close()
    return png


def norm_stdout(text: str, out_name: str) -> list:
    lines = []
    for ln in text.splitlines():
        ln = ln.replace(out_name, "OUT")
        if ln.startswith("OCR labels written"):    # only the first runner pays the OCR
            continue
        lines.append(ln.rstrip())
    return lines


def run_v1(v1_script: str, python: str, png: str, lbl: str, out: str, cwd: str) -> str:
    r = subprocess.run([python, v1_script, png, lbl, out, "--deadends"],
                       capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        raise SystemExit(f"v1 failed on {png}:\n{r.stderr[-3000:]}")
    return r.stdout


def run_v2(python: str, png: str, lbl: str, out: str, cwd: str) -> str:
    r = subprocess.run([python, "-m", "wirecolor.tools.p0_run", png, lbl, out, "--deadends"],
                       capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        raise SystemExit(f"v2 failed on {png}:\n{r.stderr[-3000:]}")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pubs", nargs="+", type=int, required=True)
    ap.add_argument("--workdir", default="/tmp/wirecolor_p0")
    ap.add_argument("--db", required=True)
    ap.add_argument("--base", required=True)
    ap.add_argument("--v1", default=None, help="path to the frozen v1 script "
                    "(default: <workdir>/colorize_wiring_prototype.py)")
    ap.add_argument("--ocr-check", type=int, default=None,
                    help="pub id whose labels JSON v2's OCR must independently reproduce")
    args = ap.parse_args()

    os.makedirs(args.workdir, exist_ok=True)
    v1_script = args.v1 or os.path.join(args.workdir, "colorize_wiring_prototype.py")
    python = sys.executable

    import cv2
    import numpy as np

    failures = []
    for pub in args.pubs:
        png = render_page(pub, args.workdir, args.db, args.base)
        lbl = os.path.join(args.workdir, f"pub{pub}_labels.json")
        out1 = os.path.join(args.workdir, f"pub{pub}_v1.png")
        out2 = os.path.join(args.workdir, f"pub{pub}_v2.png")

        so1 = run_v1(v1_script, python, png, lbl, out1, args.workdir)
        so2 = run_v2(python, png, lbl, out2, args.workdir)

        i1, i2 = cv2.imread(out1), cv2.imread(out2)
        px_ok = i1 is not None and i2 is not None and np.array_equal(i1, i2)
        if not px_ok and i1 is not None and i2 is not None and i1.shape == i2.shape:
            ndiff = int(np.count_nonzero(np.any(i1 != i2, axis=2)))
            px_msg = f"{ndiff} differing px"
        else:
            px_msg = "shape/read mismatch" if not px_ok else ""

        n1, n2 = norm_stdout(so1, os.path.basename(out1)), norm_stdout(so2, os.path.basename(out2))
        n1 = [ln.replace(out1, "OUT") for ln in n1]
        n2 = [ln.replace(out2, "OUT") for ln in n2]
        out_ok = n1 == n2

        status = "PASS" if (px_ok and out_ok) else "FAIL"
        print(f"[{status}] pub {pub}: pixels={'identical' if px_ok else px_msg} "
              f"stdout={'identical' if out_ok else 'DIFFERS'}")
        if not out_ok:
            for a, b in zip(n1, n2):
                if a != b:
                    print(f"    v1: {a}\n    v2: {b}")
            if len(n1) != len(n2):
                print(f"    line counts differ: v1={len(n1)} v2={len(n2)}")
        if status == "FAIL":
            failures.append(pub)

    if args.ocr_check is not None:
        pub = args.ocr_check
        png = os.path.join(args.workdir, f"pub{pub}_p0.png")
        ref = os.path.join(args.workdir, f"pub{pub}_labels.json")
        chk = os.path.join(args.workdir, f"pub{pub}_labels_v2check.json")
        if os.path.exists(chk):
            os.remove(chk)
        from ..labels.conventions import load_convention
        from ..labels.ocr import ocr_labels
        json.dump(ocr_labels(png, load_convention("volvo_classic")), open(chk, "w"))
        same = json.load(open(ref)) == json.load(open(chk))
        print(f"[{'PASS' if same else 'FAIL'}] pub {pub}: v2 OCR labels "
              f"{'reproduce v1 exactly' if same else 'DIFFER from v1'}")
        if not same:
            failures.append(f"ocr-{pub}")

    print(f"\nP0 golden result: {len(args.pubs) - len([f for f in failures if isinstance(f, int)])}"
          f"/{len(args.pubs)} sheets identical"
          + (f", failures: {failures}" if failures else " -- extraction is behaviour-frozen."))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
