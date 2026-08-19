"""Tiled RapidOCR label discovery and conservative split-legend reconstruction."""
from __future__ import annotations

import re

import numpy as np

from .parse import GAUGES, parse_code


def _copy_token(token: dict) -> dict:
    """Return a shallow token copy with an independent OCR polygon."""
    out = dict(token)
    if token.get("box") is not None:
        out["box"] = [[float(p[0]), float(p[1])] for p in token["box"]]
    return out


def _bounds(token: dict) -> tuple[float, float, float, float]:
    box = token.get("box")
    if box:
        xs = [float(p[0]) for p in box]
        ys = [float(p[1]) for p in box]
        return min(xs), min(ys), max(xs), max(ys)
    cx, cy = float(token["cx"]), float(token["cy"])
    half_w, half_h = float(token["w"]) / 2, float(token["h"]) / 2
    return cx - half_w, cy - half_h, cx + half_w, cy + half_h


def _set_union_geometry(target: dict, other: dict) -> None:
    x0, y0, x1, y1 = _bounds(target)
    ox0, oy0, ox1, oy1 = _bounds(other)
    x0, y0, x1, y1 = min(x0, ox0), min(y0, oy0), max(x1, ox1), max(y1, oy1)
    target["box"] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    target["cx"], target["cy"] = (x0 + x1) / 2, (y0 + y1) / 2
    target["w"], target["h"] = x1 - x0, y1 - y0


def _overlap_fraction(a: dict, b: dict) -> float:
    """Intersection divided by the smaller box area (tile-duplicate metric)."""
    ax0, ay0, ax1, ay1 = _bounds(a)
    bx0, by0, bx1, by1 = _bounds(b)
    intersection = max(0.0, min(ax1, bx1) - max(ax0, bx0)) \
        * max(0.0, min(ay1, by1) - max(ay0, by0))
    aa = max(0.0, ax1 - ax0) * max(0.0, ay1 - ay0)
    ba = max(0.0, bx1 - bx0) * max(0.0, by1 - by0)
    return intersection / max(1.0, min(aa, ba))


def _drop_tile_duplicates(tokens: list[dict]) -> list[dict]:
    """Collapse only near-identical reads of the same text from overlapping OCR tiles."""
    kept: list[dict] = []
    for token in tokens:
        raw = str(token.get("raw", "")).strip().upper()
        duplicate = next((other for other in kept
                          if str(other.get("raw", "")).strip().upper() == raw
                          and raw and _overlap_fraction(token, other) >= 0.68), None)
        if duplicate is None:
            kept.append(token)
        elif float(token.get("score", 0.0)) > float(duplicate.get("score", 0.0)):
            kept[kept.index(duplicate)] = token
    return kept


def _valid_gauge(raw: str) -> bool:
    text = raw.strip().replace(",", ".")
    if not re.fullmatch(r"\d{1,2}(?:\.\d{1,2})?", text):
        return False
    try:
        return float(text) in GAUGES
    except ValueError:
        return False


def _bare_code(raw: str, convention) -> str | None:
    text = raw.strip().upper()
    if not re.fullmatch(r"[A-Z0]{1,3}(?:/[A-Z0]{1,3})?", text):
        return None
    return parse_code(text, convention)


def _pair_geometry(gauge: dict, code: dict) -> tuple[str, float] | None:
    """Return (text axis, cost) when two fragments are clearly on one text line.

    The numeric box supplies the primary orientation. This prevents a horizontal pin number
    from being joined to a component designator immediately above or below it.
    """
    gx0, gy0, gx1, gy1 = _bounds(gauge)
    cx0, cy0, cx1, cy1 = _bounds(code)
    gw, gh = max(1.0, gx1 - gx0), max(1.0, gy1 - gy0)
    cw, ch = max(1.0, cx1 - cx0), max(1.0, cy1 - cy0)
    gcx, gcy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
    ccx, ccy = (cx0 + cx1) / 2, (cy0 + cy1) / 2
    gauge_glyphs = len(str(gauge.get("raw", "")).strip().replace(".", "").replace(",", ""))
    code_glyphs = len(str(code.get("raw", "")).strip().replace("/", ""))

    choices: list[tuple[str, float]] = []
    for axis in ("horizontal", "vertical"):
        if axis == "horizontal":
            # A definitely vertical OCR word cannot form a horizontal text line, and vice versa.
            # A one-glyph token is naturally portrait even in horizontal text, so its aspect
            # ratio is not orientation evidence; the shared baseline still is.
            if (gauge_glyphs > 1 and gh > 1.20 * gw) \
                    or (code_glyphs > 1 and ch > 1.55 * cw):
                continue
            gauge_thickness, code_thickness = gh, ch
            cross_overlap = min(gy1, cy1) - max(gy0, cy0)
            cross_delta = abs(gcy - ccy)
            gap = max(gx0, cx0) - min(gx1, cx1)
            along_delta = abs(gcx - ccx)
            largest_extent = max(gw, cw)
        else:
            if (gauge_glyphs > 1 and gw > 1.20 * gh) \
                    or (code_glyphs > 1 and cw > 1.55 * ch):
                continue
            gauge_thickness, code_thickness = gw, cw
            cross_overlap = min(gx1, cx1) - max(gx0, cx0)
            cross_delta = abs(gcx - ccx)
            gap = max(gy0, cy0) - min(gy1, cy1)
            along_delta = abs(gcy - ccy)
            largest_extent = max(gh, ch)

        small_thickness = min(gauge_thickness, code_thickness)
        large_thickness = max(gauge_thickness, code_thickness)
        if small_thickness / large_thickness < 0.58:
            continue                         # unlike font sizes: usually a pin/component neighbour
        if cross_overlap < 0.52 * small_thickness:
            continue                         # not the same baseline/column
        if along_delta <= 0.42 * largest_extent:
            continue                         # overlapping reads, not adjacent fragments
        if gap < -0.18 * small_thickness or gap > max(4.0, 0.90 * large_thickness):
            continue
        cost = max(0.0, gap) / large_thickness \
            + 1.8 * cross_delta / large_thickness \
            + (1.0 - small_thickness / large_thickness)
        choices.append((axis, cost))
    return min(choices, key=lambda item: item[1]) if choices else None


def _merge_dangling_slashes(tokens: list[dict], convention) -> None:
    """Preserve the historical ``BL/`` + ``GR`` repair before normal parsing."""
    for token in tokens:
        raw = str(token.get("raw", "")).strip().upper()
        if not raw.endswith("/"):
            continue
        span = max(float(token.get("w", 0)), float(token.get("h", 0)))
        near = [other for other in tokens
                if other is not token and other.get("raw")
                and abs(float(other["cx"]) - float(token["cx"])) <= 1.6 * span
                and abs(float(other["cy"]) - float(token["cy"])) <= 1.6 * span]
        token["raw"] = ""                  # a dangling slash never parses by itself
        if not near:
            continue
        other = min(near, key=lambda candidate:
                    (float(candidate["cx"]) - float(token["cx"])) ** 2
                    + (float(candidate["cy"]) - float(token["cy"])) ** 2)
        merged = raw + str(other["raw"]).strip().upper()
        if parse_code(merged, convention):
            other["raw"] = merged
            other["score"] = min(float(other.get("score", 1.0)),
                                 float(token.get("score", 1.0)))
            _set_union_geometry(other, token)


def _is_complete_gauged_label(token: dict, convention) -> bool:
    raw = str(token.get("raw", ""))
    return any(ch.isdigit() for ch in raw) and parse_code(raw, convention) is not None


def _merge_gauge_code_fragments(tokens: list[dict], convention) -> None:
    gauges = [i for i, token in enumerate(tokens)
              if token.get("raw") and _valid_gauge(str(token["raw"]))]
    codes = [(i, _bare_code(str(token.get("raw", "")), convention))
             for i, token in enumerate(tokens) if token.get("raw")]
    codes = [(i, code) for i, code in codes if code is not None]

    candidates: list[tuple[int, int, str, float, str]] = []
    for gi in gauges:
        for ci, code in codes:
            if gi == ci:
                continue
            geometry = _pair_geometry(tokens[gi], tokens[ci])
            if geometry is None:
                continue
            axis, cost = geometry
            gauge_raw = str(tokens[gi]["raw"]).strip().upper()
            code_raw = str(tokens[ci]["raw"]).strip().upper()
            if axis == "horizontal":
                gauge_first = float(tokens[gi]["cx"]) < float(tokens[ci]["cx"])
            else:
                gauge_first = float(tokens[gi]["cy"]) < float(tokens[ci]["cy"])
            merged = f"{gauge_raw} {code_raw}" if gauge_first else f"{code_raw} {gauge_raw}"
            if parse_code(merged, convention) == code:
                candidates.append((gi, ci, axis, cost, merged))

    # Ambiguous fragments are much more likely to be pin numbers or component designators.
    # Tile duplicates have already been collapsed, so require a unique geometric partner in
    # both directions rather than guessing the nearest of several plausible neighbours.
    by_gauge: dict[int, list[tuple]] = {}
    by_code: dict[int, list[tuple]] = {}
    for candidate in candidates:
        by_gauge.setdefault(candidate[0], []).append(candidate)
        by_code.setdefault(candidate[1], []).append(candidate)
    accepted = [candidate for candidate in candidates
                if len(by_gauge[candidate[0]]) == 1 and len(by_code[candidate[1]]) == 1]

    for gi, ci, _axis, _cost, merged in accepted:
        gauge, code_token = tokens[gi], tokens[ci]
        if not gauge.get("raw") or not code_token.get("raw"):
            continue
        parsed = parse_code(merged, convention)

        # An overlapping complete read is the same legend seen by a neighbouring OCR tile.
        # Keep that stronger read and discard both fragments instead of manufacturing a duplicate.
        union = _copy_token(gauge)
        _set_union_geometry(union, code_token)
        complete = next((token for k, token in enumerate(tokens)
                         if k not in (gi, ci) and token.get("raw")
                         and _is_complete_gauged_label(token, convention)
                         and parse_code(str(token["raw"]), convention) == parsed
                         and _overlap_fraction(token, union) >= 0.58), None)
        if complete is not None:
            gauge["raw"] = ""
            code_token["raw"] = ""
            continue

        code_token["raw"] = merged
        code_token["score"] = min(float(code_token.get("score", 1.0)),
                                  float(gauge.get("score", 1.0)))
        _set_union_geometry(code_token, gauge)
        gauge["raw"] = ""


def merge_ocr_fragments(tokens: list[dict], convention) -> list[dict]:
    """Conservatively reconstruct OCR-split cable legends.

    ``tokens`` uses the same dictionary schema as :func:`ocr_labels`: ``raw``, ``score``,
    ``cx``, ``cy``, ``w``, ``h`` and ``box``. The function is intentionally independent of
    tiling, so local/rotated OCR passes can call it before applying their strong-label filter.

    Repairs are limited to dangling two-colour slashes and a valid closed-vocabulary gauge next
    to one bare colour code on the same text line. Inputs are not mutated.
    """
    merged = _drop_tile_duplicates([_copy_token(token) for token in tokens])
    _merge_dangling_slashes(merged, convention)
    _merge_gauge_code_fragments(merged, convention)
    return [token for token in merged if str(token.get("raw", "")).strip()]


def build_engine():
    try:
        from rapidocr import RapidOCR
        _eng = RapidOCR()

        def engine(im):
            out = _eng(im)
            boxes = getattr(out, "boxes", None); txts = getattr(out, "txts", None)
            if boxes is None or txts is None:
                return []
            scores = getattr(out, "scores", None) or [1.0] * len(txts)
            return list(zip(boxes, txts, scores))
    except ImportError:
        from rapidocr_onnxruntime import RapidOCR
        _eng = RapidOCR()

        def engine(im):
            res, _ = _eng(im)
            return res or []
    return engine


def ocr_labels(image_path: str, convention) -> dict:
    """Tiled RapidOCR pass that returns {"labels": [{code, raw, score, cx, cy, w, h, box}]}."""
    from PIL import Image
    engine = build_engine()
    _aw = re.escape(convention.all_white_token)   # "WH" escapes to itself: regex parity with v1

    arr = np.array(Image.open(image_path).convert("RGB"))
    ih, iw, _ = arr.shape
    tokens = []
    wh_hits = set()         # "0.75 WH (w83)"-style tokens: cabinet sheets where EVERY wire is white
    #                         (positions, not a count: the tile overlap reads border tokens twice)
    # dynamic tiling: ~1200px tiles regardless of sheet size, so an A0 sheet rendered at 200 DPI
    # (the scale all detection constants are tuned for) OCRs as reliably as an A2 one.
    ny = max(3, (ih + 1099) // 1100)
    nx = max(4, (iw + 1199) // 1200)
    ov = 180     # a vertical two-colour label is ~160 px tall at 200 DPI; a smaller overlap lets a
    #              tile boundary clip it and the fragment reads as the WRONG code ('BL/ GR' -> 'GR')
    for iy in range(ny):
        for ix in range(nx):
            y0 = max(0, iy * ih // ny - ov); y1 = min(ih, (iy + 1) * ih // ny + ov)
            x0 = max(0, ix * iw // nx - ov); x1 = min(iw, (ix + 1) * iw // nx + ov)
            for box, txt, score in engine(arr[y0:y1, x0:x1]):
                pts = [[float(p[0]) + x0, float(p[1]) + y0] for p in box]
                if re.search(rf"\b{_aw}\b", txt.upper()):
                    wh_hits.add((round(sum(p[0] for p in pts) / 120), round(sum(p[1] for p in pts) / 120)))
                pxs = [p[0] for p in pts]; pys = [p[1] for p in pts]
                tokens.append({"raw": txt, "score": float(score),
                               "cx": sum(pxs) / 4, "cy": sum(pys) / 4,
                               "w": max(pxs) - min(pxs), "h": max(pys) - min(pys),
                               "box": pts})
    # Repair split legends before parsing. In addition to the historical ``BL/`` + ``GR``
    # repair, RapidOCR sometimes emits a power-wire legend as ``25`` + ``R``/``SB``.
    tokens = merge_ocr_fragments(tokens, convention)
    found = []
    for t in tokens:
        code = parse_code(t["raw"], convention)
        if not code:
            continue
        found.append({"code": code, "raw": t["raw"], "score": round(t["score"], 3),
                      "cx": round(t["cx"], 1), "cy": round(t["cy"], 1),
                      "w": round(t["w"], 1), "h": round(t["h"], 1),
                      "box": [[round(a, 1), round(b, 1)] for a, b in t["box"]]})
    uniq = {}
    for lab in found:
        key = (lab["code"], round(lab["cx"] / 30), round(lab["cy"] / 30))
        if key not in uniq or lab["score"] > uniq[key]["score"]:
            uniq[key] = lab
    labels_out = list(uniq.values())
    # all-white cabinet sheet (PCC/LCC style): every wire is "N.NN WH (wNN)" -- nothing to colour.
    if len(wh_hits) >= 10 and len(wh_hits) > 2 * len(labels_out):
        print(f"all-white cabinet sheet detected ({len(wh_hits)} {_aw} tokens): nothing to colourize")
        labels_out = []
    return {"image": [iw, ih], "labels": labels_out}
