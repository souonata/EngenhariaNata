"""Read the whole drawing's text ONCE, the way an engineer does.

The previous design re-read the page through ~1,000 contextual zoom windows, one per uncertain
wire endpoint -- about 2,100 OCR calls and ninety minutes per sheet.  Two measurements killed that
design:

* OCR cost is dominated by PER-CALL overhead, not by pixel area: a tightly cropped single legend
  costs 1.39 s while a 4000x4000 tile costs 5.3 s.  Cropping to the text was 93x less area and no
  faster at all.
* A legend is a STATIC page feature.  It does not change depending on which wire is being asked
  about, so reading it once per interested wire is pure waste.

So the page is swept once at the magnification where its smallest legend is legible.  Measured on
pub 2503: 2000-px tiles upscaled 2x recover the `70 R` legend that the 1x pass misses entirely,
while 3000-px tiles lose it -- the largest tile that still reads small print.  Twenty tiles cover
an A0 sheet in about two minutes, plus a rotated sweep for the vertical legends.

The result is the complete page label set, cached like any other OCR pass.  Every later "zoom
lens" is then a query against this set instead of a new OCR call.
"""
from __future__ import annotations

import re

import numpy as np

from .ocr import build_engine, merge_ocr_fragments
from .parse import parse_code

# Largest tile that still reads the smallest printed legend (measured, see the module docstring).
TILE = 2000
SCALE = 2.0
# A vertical two-colour legend is ~160 px tall at 200 DPI; a smaller overlap lets a tile boundary
# clip it and the fragment then reads as the WRONG code ('BL/ GR' -> 'GR').
OVERLAP = 180


def _tiles(width, height, tile=TILE, overlap=OVERLAP):
    step = tile - overlap
    ys = list(range(0, max(1, height - overlap), step)) or [0]
    xs = list(range(0, max(1, width - overlap), step)) or [0]
    for y0 in ys:
        for x0 in xs:
            yield x0, y0, min(width, x0 + tile), min(height, y0 + tile)


def _tall_text_present(binary, x0, y0, x1, y1):
    """Does this tile contain any tall/narrow glyph run, i.e. is a rotated read worth its cost?

    Vertical legends are rare -- 29 of 1,997 text clusters on pub 2503 -- so sweeping every tile
    twice would double the page cost to serve a few percent of the labels.
    """
    import cv2

    window = binary[y0:y1, x0:x1]
    if not window.size:
        return False
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(window, 8)
    glyphs = np.zeros(window.shape, np.uint8)
    for index in range(1, count):
        gx, gy, gw, gh, area = stats[index]
        if 4 <= gh <= 46 and 2 <= gw <= 46 and 8 <= area <= 900:
            glyphs[gy:gy + gh, gx:gx + gw] = 1
    if not glyphs.any():
        return False
    stacked = cv2.dilate(glyphs, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 25)))
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(stacked, 8)
    for index in range(1, count):
        _gx, _gy, gw, gh, area = stats[index]
        if area >= 40 and gh > 1.4 * gw:
            return True
    return False


def _read_tile(engine, image, x0, y0, x1, y1, scale, rotated):
    import cv2

    crop = cv2.cvtColor(image[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    upscaled = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    height = crop.shape[0]
    if rotated:
        upscaled = cv2.rotate(upscaled, cv2.ROTATE_90_CLOCKWISE)
    tokens = []
    for box, text, score in engine(upscaled):
        if rotated:
            # clockwise rotation: (xr, yr) -> (x = yr, y = tile_height - xr)
            points = [(float(p[1]) / scale, height - float(p[0]) / scale) for p in box]
        else:
            points = [(float(p[0]) / scale, float(p[1]) / scale) for p in box]
        page = [[x0 + px, y0 + py] for px, py in points]
        xs = [p[0] for p in page]
        ys = [p[1] for p in page]
        tokens.append({"raw": str(text), "score": float(score),
                       "cx": sum(xs) / len(xs), "cy": sum(ys) / len(ys),
                       "w": max(xs) - min(xs), "h": max(ys) - min(ys),
                       "box": page})
    return tokens


def harvest_labels(image_path: str, convention, scales=(1.0, SCALE), tile=TILE,
                   overlap=OVERLAP, verbose=True) -> dict:
    """One page-wide multi-scale text read; same output shape as the legacy tiled pass.

    Both magnifications are swept because they see different text: measured on pub 2503, the 2x
    pass recovers 67 legends the 1x pass never sees (small print) while missing 55 it does see
    (large print, which 2x pushes past the detector's comfortable size).  Since cost is per call
    and not per pixel, sweeping twice is cheap and the union is what an engineer actually ends up
    with after looking at the drawing both ways.
    """
    import cv2

    engine = build_engine()
    image = cv2.imread(image_path)
    height, width = image.shape[:2]
    binary = (cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) < 210).astype(np.uint8)
    all_white = re.escape(convention.all_white_token)

    tokens = []
    white_hits = set()
    upright = rotated_reads = 0
    for scale in scales:
        for x0, y0, x1, y1 in _tiles(width, height, tile, overlap):
            found = _read_tile(engine, image, x0, y0, x1, y1, scale, rotated=False)
            upright += 1
            if _tall_text_present(binary, x0, y0, x1, y1):
                found += _read_tile(engine, image, x0, y0, x1, y1, scale, rotated=True)
                rotated_reads += 1
            for token in found:
                if re.search(rf"\b{all_white}\b", token["raw"].upper()):
                    white_hits.add((round(token["cx"] / 120), round(token["cy"] / 120)))
            tokens.extend(found)

    tokens = merge_ocr_fragments(tokens, convention)
    found = []
    for token in tokens:
        code = parse_code(token["raw"], convention)
        if not code:
            continue
        found.append({"code": code, "raw": token["raw"], "score": round(token["score"], 3),
                      "cx": round(token["cx"], 1), "cy": round(token["cy"], 1),
                      "w": round(token["w"], 1), "h": round(token["h"], 1),
                      "box": [[round(a, 1), round(b, 1)] for a, b in token["box"]]})

    unique = {}
    for label in found:
        key = (label["code"], round(label["cx"] / 30), round(label["cy"] / 30))
        if key not in unique or label["score"] > unique[key]["score"]:
            unique[key] = label
    labels = list(unique.values())

    # All-white cabinet sheet (PCC/LCC style): every wire is "N.NN WH (wNN)" -- nothing to colour.
    if len(white_hits) >= 10 and len(white_hits) > 2 * len(labels):
        print(f"all-white cabinet sheet detected ({len(white_hits)} "
              f"{convention.all_white_token} tokens): nothing to colourize")
        labels = []
    if verbose:
        print(f"harvest: {upright} tiles at {'x/'.join(str(s) for s in scales)}x "
              f"+ {rotated_reads} rotated -> {len(labels)} labels")
    return {"image": [width, height], "labels": labels}


def labels_in_window(labels, x0, y0, x1, y1, exclude_ids=()):
    """Every harvested legend whose centre lies in a window, as multiscale observations.

    This replaces contextual re-OCR: the text was already read once, so a zoom lens is a query.
    """
    out = []
    for label in labels:
        if id(label) in exclude_ids:
            continue
        if x0 <= label["cx"] <= x1 and y0 <= label["cy"] <= y1:
            out.append((label["code"], label["raw"], label["cx"], label["cy"],
                        label["h"] > label["w"], label.get("score", 1.0),
                        label.get("box")))
    return out
