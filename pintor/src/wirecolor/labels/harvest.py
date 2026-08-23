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

import gc
import math
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

# RapidOCR 3.9.2 clamps a large detector input to a 2000 px side, but the Linux worker reproduced
# std::bad_alloc at that exact square shape under RLIMIT_AS.  Keep every detector input below the
# proven failure: the 2x pass reads at most an 800 px source tile instead of allocating the old
# 4000 x 4000 preprocessing image and relying on RapidOCR to shrink it.  Grayscale page storage,
# bounded native thread pools and a disabled ONNX arena provide the remaining memory headroom.
MAX_ENGINE_SIDE = 1600
MAX_ENGINE_PIXELS = MAX_ENGINE_SIDE * MAX_ENGINE_SIDE

# Above this page size the two-scale A0 schedule cannot finish inside the production worker's
# 480-second CPU gate.  Omitting the 2x recovery pass reduces recall only: undetected legends have
# no ownership seed, so their conductors remain black under the existing abstention rules.
MULTISCALE_PAGE_PIXEL_LIMIT = 60_000_000


def _release_native_memory() -> None:
    """Return OCR's native allocations before full-page topology starts.

    ONNX Runtime and OpenCV allocate outside Python's object heap.  Dropping the engine and image
    references is necessary but glibc may otherwise keep their freed arenas mapped, so the next
    stage can hit RLIMIT_AS even while resident memory remains well below the container limit.
    Collection plus ``malloc_trim`` is best-effort: non-glibc platforms simply skip the latter.
    """
    gc.collect()
    try:
        import ctypes

        libc = ctypes.CDLL(None)
        malloc_trim = getattr(libc, "malloc_trim", None)
        if malloc_trim is not None:
            malloc_trim.argtypes = [ctypes.c_size_t]
            malloc_trim.restype = ctypes.c_int
            malloc_trim(0)
    except (AttributeError, OSError, TypeError):
        pass


def _tiles(width, height, tile=TILE, overlap=OVERLAP):
    step = tile - overlap
    ys = list(range(0, max(1, height - overlap), step)) or [0]
    xs = list(range(0, max(1, width - overlap), step)) or [0]
    for y0 in ys:
        for x0 in xs:
            yield x0, y0, min(width, x0 + tile), min(height, y0 + tile)


def _tall_text_present(image, x0, y0, x1, y1):
    """Does this tile contain any tall/narrow glyph run, i.e. is a rotated read worth its cost?

    Vertical legends are rare -- 29 of 1,997 text clusters on pub 2503 -- so sweeping every tile
    twice would double the page cost to serve a few percent of the labels.
    """
    import cv2

    window = image[y0:y1, x0:x1]
    if not window.size:
        return False
    if window.ndim == 3:
        window = cv2.cvtColor(window, cv2.COLOR_BGR2GRAY)
    binary = (window < 210).astype(np.uint8)
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(binary, 8)
    glyphs = np.zeros(binary.shape, np.uint8)
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


def _working_tile_side(scale: float, requested: int = TILE) -> int:
    """Largest working-pixel tile whose scaled inference stays below the ONNX memory cap."""
    if scale <= 0:
        raise ValueError("OCR scale must be positive")
    return max(1, min(int(requested), math.floor(MAX_ENGINE_SIDE / scale)))


def _bounded_scales(width: int, height: int, scales) -> tuple[float, ...]:
    """Conservatively drop magnified OCR when a page cannot fit the worker CPU budget."""
    requested = tuple(float(scale) for scale in scales)
    if width * height <= MULTISCALE_PAGE_PIXEL_LIMIT:
        return requested
    return (1.0,)


def _read_tile(engine, image, x0, y0, x1, y1, scale, rotated):
    """Read one outer tile through bounded inference subtiles in global page coordinates."""
    import cv2

    tokens = []
    outer_width, outer_height = x1 - x0, y1 - y0
    side = _working_tile_side(scale)
    overlap = min(OVERLAP, max(0, side - 1))
    for sx0, sy0, sx1, sy1 in _tiles(outer_width, outer_height, side, overlap):
        px0, py0, px1, py1 = x0 + sx0, y0 + sy0, x0 + sx1, y0 + sy1
        source = image[py0:py1, px0:px1]
        if source.ndim == 2:
            crop = cv2.cvtColor(source, cv2.COLOR_GRAY2RGB)
        else:
            crop = cv2.cvtColor(source, cv2.COLOR_BGR2RGB)
        upscaled = cv2.resize(crop, None, fx=scale, fy=scale,
                              interpolation=cv2.INTER_CUBIC)
        del crop
        height = source.shape[0]
        inference = cv2.rotate(upscaled, cv2.ROTATE_90_CLOCKWISE) if rotated else upscaled
        if inference.shape[0] * inference.shape[1] > MAX_ENGINE_PIXELS:
            raise RuntimeError(
                f"OCR inference tile exceeds memory cap: "
                f"{inference.shape[1]}x{inference.shape[0]}"
            )
        readings = engine(inference)
        del inference, upscaled
        for box, text, score in readings:
            if rotated:
                # clockwise rotation: (xr, yr) -> (x = yr, y = tile_height - xr)
                points = [(float(p[1]) / scale,
                           height - float(p[0]) / scale) for p in box]
            else:
                points = [(float(p[0]) / scale, float(p[1]) / scale) for p in box]
            page = [[px0 + px, py0 + py] for px, py in points]
            xs = [p[0] for p in page]
            ys = [p[1] for p in page]
            tokens.append({"raw": str(text), "score": float(score),
                           "cx": sum(xs) / len(xs), "cy": sum(ys) / len(ys),
                           "w": max(xs) - min(xs), "h": max(ys) - min(ys),
                           "box": page})
        del readings
    return tokens


def harvest_labels(image_path: str, convention, scales=(1.0, SCALE), tile=TILE,
                   overlap=OVERLAP, verbose=True) -> dict:
    """One page-wide multi-scale text read; same output shape as the legacy tiled pass.

    Both magnifications normally run because they see different text: measured on pub 2503, the 2x
    pass recovers 67 legends the 1x pass never sees (small print) while missing 55 it does see
    (large print, which 2x pushes past the detector's comfortable size).  Pages above the explicit
    CPU-safe pixel limit use only native scale.  This deliberately loses some recall on A0 while
    preserving the hard rule that a legend without trustworthy evidence leaves its wire black.
    """
    import cv2

    # OpenCV also sizes its native pool from the host (28 threads on the A0 reproduction machine),
    # independently of the two-CPU container quota.  The job child is single-purpose, so one
    # preprocessing thread avoids reserving needless stacks while ONNX uses the two allotted CPUs.
    cv2.setNumThreads(1)
    engine = build_engine()
    # A0 at 200 DPI is 9362 x 6623.  Reading it as BGR cost ~186 MB, then the old page-wide binary
    # added another ~62 MB.  OCR only needs luminance: keep one ~62 MB grayscale page and create
    # RGB plus threshold buffers for one bounded tile at a time.
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"cannot read OCR page image: {image_path}")
    height, width = image.shape[:2]
    active_scales = _bounded_scales(width, height, scales)
    all_white = re.escape(convention.all_white_token)

    tokens = []
    white_hits = set()
    upright = rotated_reads = 0
    for scale in active_scales:
        bounded_tile = _working_tile_side(scale, tile)
        bounded_overlap = min(overlap, max(0, bounded_tile - 1))
        for x0, y0, x1, y1 in _tiles(
                width, height, bounded_tile, bounded_overlap):
            found = _read_tile(engine, image, x0, y0, x1, y1, scale, rotated=False)
            upright += 1
            if _tall_text_present(image, x0, y0, x1, y1):
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
        print(f"harvest: {upright} tiles at {'x/'.join(str(s) for s in active_scales)}x "
              f"+ {rotated_reads} rotated -> {len(labels)} labels")
    result = {"image": [width, height], "labels": labels,
              "ocr_scales": list(active_scales), "ocr_calls": upright + rotated_reads}
    # The caller's next operation creates full-page connected-component label arrays.  Dispose of
    # the three ONNX sessions and the page raster first, then ask glibc to unmap free arenas.
    del engine, image, tokens, found, labels
    _release_native_memory()
    return result


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
