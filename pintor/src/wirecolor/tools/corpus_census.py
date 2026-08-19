"""Structural census of every wiring diagram in the library, without OCR.

    python -m wirecolor.tools.corpus_census --staging /home/popov/wirecolor-staging \
        [--limit 20] [--pubs 2503,2550]

The colorizer must be universal, so its rules cannot be tuned to one drawing.  This pass measures
what the sheets actually ARE -- page class, ink weight, line thickness, text density and
orientation, dash rhythm, furniture -- across the whole corpus, cheaply enough to run on all of
them: everything here comes from the binarized render and connected components, so a sheet costs
seconds instead of the minutes an OCR pass needs.

The output is one census record per sheet plus corpus aggregates, which is what tells us which
"constants" in the pipeline are really per-sheet variables, and which sheets are outliers that must
never be shipped on assumptions borrowed from the others.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
from collections import Counter

import numpy as np


def _runs(row, threshold=210):
    """Widths of consecutive ink runs along one scan line."""
    out, start = [], None
    for index, value in enumerate(row):
        if value < threshold and start is None:
            start = index
        elif value >= threshold and start is not None:
            out.append(index - start)
            start = None
    return out


def measure_page(image_path):
    import cv2

    gray = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    height, width = gray.shape[:2]
    ink = gray < 210
    dark = gray < 140
    binary = ink.astype(np.uint8)

    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(binary, 8)
    glyph = np.zeros((height, width), np.uint8)
    glyphs = 0
    for index in range(1, count):
        gx, gy, gw, gh, area = stats[index]
        if 4 <= gh <= 46 and 2 <= gw <= 46 and 8 <= area <= 900:
            glyph[gy:gy + gh, gx:gx + gw] = 1
            glyphs += 1

    def clusters(kernel):
        dilated = cv2.dilate(glyph, cv2.getStructuringElement(cv2.MORPH_RECT, kernel))
        total, _lab, st, _cen = cv2.connectedComponentsWithStats(dilated, 8)
        return [tuple(int(v) for v in st[i][:5]) for i in range(1, total) if st[i][4] >= 40]

    horizontal = clusters((25, 9))
    vertical = [box for box in clusters((9, 25)) if box[3] > 1.4 * box[2]]

    # Line weight: sample scan lines and take the modal ink-run width, which is the pen the sheet
    # draws its conductors with.  A sheet whose wires are 1 px and one whose wires are 4 px cannot
    # share a hard-coded thickness gate.
    widths = []
    for y in range(0, height, max(1, height // 400)):
        widths.extend(w for w in _runs(gray[y]) if w <= 40)
    weights = np.bincount(np.array(widths, dtype=int)) if widths else np.array([0])

    ink_px = int(ink.sum())
    return {
        "page_px": [width, height],
        "ink_fraction": round(ink_px / (width * height), 5),
        "dark_share_of_ink": round(float(dark.sum()) / max(1, ink_px), 3),
        "components": count - 1,
        "glyph_blobs": glyphs,
        "text_clusters": len(horizontal),
        "vertical_text_clusters": len(vertical),
        "text_area_fraction": round(
            sum((w + 16) * (h + 16) for _x, _y, w, h, _a in horizontal) / (width * height), 4),
        "modal_line_width": int(weights.argmax()) if weights.size > 1 else 0,
        "line_width_p90": int(np.percentile(widths, 90)) if widths else 0,
    }


def native_evidence(page, convention):
    """What the PDF hands us for THIS page before any computer vision runs.

    Two INDEPENDENT axes, deliberately not collapsed into one verdict:

    * geometry -- 'vector' when the page carries real stroke primitives. Counted over path ITEMS,
      not ``len(get_drawings())``: one path object can hold thousands of segments, and page
      furniture (a border, a title block) is a handful of paths either way.
    * labels -- 'text' only when wire codes appear on THIS page, spatially placed like legends.

    The label test is the delicate one. Counting characters cannot work: a table of contents or a
    wire-LIST table scores high while telling us nothing, because painting needs each code's
    POSITION beside the run it names. Measured on this corpus, a character-count rule over-reported
    the text tier more than twofold -- single letters used as page GRID REFERENCES parsed as colour
    codes, and several publications carry their codes on a different page from the geometry.
    So a page qualifies only when its codes are spread over the sheet rather than aligned into a
    few columns; a table aligns and never rotates, whereas diagram legends run both ways.

    The code grammar comes from the Convention, so this stays true for any manufacturer.
    """
    sep = re.escape(convention.two_color_sep)
    token = "|".join(sorted((re.escape(c) for c in convention.codes), key=len, reverse=True))
    # a real wire code carries a gauge or a stripe separator; a bare token is too weak to count
    code_re = re.compile(
        rf"^\s*(?:\d{{1,2}}[.,]\d{{1,2}}\s*(?:{token})(?:{sep}(?:{token}))?"
        rf"|(?:{token}){sep}(?:{token}))\s*$")

    primitives = sum(len(d.get("items", ())) for d in page.get_drawings())

    codes = []
    for block in page.get_text("dict").get("blocks", ()):
        for line in block.get("lines", ()):
            direction = line.get("dir", (1, 0))
            for span in line.get("spans", ()):
                if code_re.match(span.get("text", "")):
                    x0, y0, _x1, _y1 = span["bbox"]
                    codes.append((x0, y0,
                                  "h" if abs(direction[0]) >= abs(direction[1]) else "v"))

    width = page.rect.width or 1.0
    height = page.rect.height or 1.0
    placed = False
    spread_x = spread_y = column_concentration = 0.0
    if len(codes) >= 5:
        xs = [c[0] for c in codes]
        ys = [c[1] for c in codes]
        spread_x = (max(xs) - min(xs)) / width
        spread_y = (max(ys) - min(ys)) / height
        bins = Counter(round(x / 6) for x in xs)
        column_concentration = sum(n for _, n in bins.most_common(3)) / len(codes)
        placed = spread_x > 0.5 and spread_y > 0.5 and column_concentration < 0.5

    return {
        "stroke_primitives": primitives,
        "geometry": "vector" if primitives >= 500 else "raster",
        "wire_codes_in_text": len(codes),
        "wire_codes_placed": placed,
        "code_spread": [round(spread_x, 2), round(spread_y, 2)],
        "code_column_concentration": round(column_concentration, 2),
        "code_rotation_mix": dict(Counter(c[2] for c in codes)) if codes else {},
        "labels": "text" if placed else "ocr",
    }


def census_sheet(pub, page, title, pdf_path, staging, convention):
    from ..prep import render_working_png

    tag = f"pub{pub}_p{page}"
    sheet_dir = os.path.join(staging, "sheets", tag)
    os.makedirs(sheet_dir, exist_ok=True)
    work = os.path.join(sheet_dir, f"{tag}_work.png")
    meta_path = os.path.join(sheet_dir, f"{tag}_meta.json")
    if not (os.path.exists(work) and os.path.exists(meta_path)):
        with open(meta_path, "w") as fh:
            json.dump(render_working_png(pdf_path, page, work), fh)
    meta = json.load(open(meta_path))

    import fitz
    document = fitz.open(pdf_path)
    target = document[page]
    text_chars = len(target.get_text("text").strip())
    drawings = len(target.get_drawings())
    images = len(target.get_images(full=True))
    evidence = native_evidence(target, convention)
    # provenance: a Ghostscript producer fingerprints the legacy recompression that irreversibly
    # downsampled mono images, so scores must never be pooled across producers.
    producer = (document.metadata or {}).get("producer") or "?"
    pages_in_source = len(document)
    document.close()

    record = {"pub": pub, "page": page, "title": title, "tag": tag,
              "pages_in_source": pages_in_source, "producer": producer,
              "page_pt": [round(meta.get("width", 0), 1), round(meta.get("height", 0), 1)],
              "rotation": meta.get("rotation", 0),
              "text_layer_chars": text_chars, "vector_drawings": drawings,
              "embedded_images": images,
              # the evidence TIER is the pair, e.g. "vector+text"; the old single `source` field
              # keyed a geometry verdict off a text-character count, conflating the two axes.
              "source": evidence["geometry"],
              "tier": f"{evidence['geometry']}+{evidence['labels']}"}
    record.update(evidence)
    record.update(measure_page(work))
    return record


def aggregate(records):
    def spread(key, getter=None):
        values = [(getter(r) if getter else r.get(key)) for r in records]
        values = [v for v in values if isinstance(v, (int, float))]
        if not values:
            return None
        values.sort()
        middle = values[len(values) // 2]
        return {"median": middle, "min": values[0], "max": values[-1], "n": len(values)}

    classes = {}
    for record in records:
        classes[record["source"]] = classes.get(record["source"], 0) + 1
    return {
        "sheets": len(records),
        "classes": classes,
        "ink_fraction": spread("ink_fraction"),
        "dark_share_of_ink": spread("dark_share_of_ink"),
        "modal_line_width": spread("modal_line_width"),
        "text_clusters": spread("text_clusters"),
        "vertical_text_share": spread(None, lambda r: round(
            r["vertical_text_clusters"] / max(1, r["text_clusters"]), 3)),
        "text_area_fraction": spread("text_area_fraction"),
        "page_width_px": spread(None, lambda r: r["page_px"][0]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--staging", required=True)
    ap.add_argument("--pubs")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--pages", default="0",
                    help="page indices per publication: 'all', or a comma-separated list. "
                         "A wiring publication is multi-page; the old single --page silently "
                         "censused page 0 of every document and called it the corpus.")
    ap.add_argument("--convention", default="volvo_classic")
    ap.add_argument("--out", default="census.json")
    args = ap.parse_args()

    from ..batch import select_sheets, source_path, resolve_pages, DB
    from ..labels.conventions import load_convention

    convention = load_convention(args.convention)
    pubs = [int(part) for part in args.pubs.split(",")] if args.pubs else None
    sheets = select_sheets(DB, pubs, query=not pubs, limit=args.limit)
    print(f"census over {len(sheets)} publication(s), pages={args.pages}")

    out_path = os.path.join(args.staging, args.out)
    records = json.load(open(out_path))["sheets"] if os.path.exists(out_path) else []
    done = {r["tag"] for r in records}
    for pub, title in sheets:
        pdf_path = source_path(DB, pub)
        try:
            pages, _total = resolve_pages(args.pages, pdf_path)
        except Exception as error:                       # unreadable source is a census fact
            records.append({"pub": pub, "title": title, "tag": f"pub{pub}_p?",
                            "error": f"{type(error).__name__}: {error}", "source": "error"})
            continue
        for page in pages:
            tag = f"pub{pub}_p{page}"
            if tag in done:
                continue
            started = time.time()
            try:
                record = census_sheet(pub, page, title, pdf_path, args.staging, convention)
                record["seconds"] = round(time.time() - started, 1)
            except Exception as error:                   # a broken sheet never stops the census
                record = {"pub": pub, "tag": tag, "title": title,
                          "error": f"{type(error).__name__}: {error}", "source": "error"}
            records.append(record)
            print(f"  {tag}: {record.get('tier', record.get('source'))} "
                  f"{record.get('page_px')} ink {record.get('ink_fraction')} "
                  f"clusters {record.get('text_clusters')} line {record.get('modal_line_width')}px")
        tmp = f"{out_path}.tmp"
        with open(tmp, "w") as fh:
            json.dump({"sheets": records, "corpus": aggregate(records)}, fh, indent=1)
        os.replace(tmp, out_path)

    corpus = aggregate([r for r in records if r.get("source") != "error"])
    print(json.dumps(corpus, indent=1))
    print(f"-> {out_path}")


if __name__ == "__main__":
    main()
