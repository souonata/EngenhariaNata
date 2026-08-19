"""Legacy full-page repaint -- extracted verbatim from colorize_wiring_prototype.py
(lines 894-922, 942-945, 1022-1050). This is the renderer the P0 golden-equivalence harness
compares against the frozen v1 script; the native-resolution overlay painter (P1) replaces it
for shipping output but reuses the same band geometry.

Colour table injected via the Convention (v1's COLORS global). The v1 extend_to_housing()
helper is intentionally NOT carried over: it was already dead code, superseded by the TERM_GAP
housing restore (round 6).
"""
from __future__ import annotations

import cv2
import numpy as np


def _perp_offsets(pts, d):
    p = pts.astype(np.float32)
    tang = np.zeros_like(p)
    tang[1:-1] = p[2:] - p[:-2]; tang[0] = p[1] - p[0]; tang[-1] = p[-1] - p[-2]
    nrm = np.linalg.norm(tang, axis=1, keepdims=True); nrm[nrm == 0] = 1
    tang /= nrm
    perp = np.stack([-tang[:, 1], tang[:, 0]], axis=1)
    return p + d * perp, p - d * perp


def make_strokers(convention):
    colors = convention.colors_bgr
    white = convention.white_token

    def _stroke(out, poly, code, thick):
        pi = poly.astype(np.int32)
        if code == white:   # white channel: black rail then white core on any-angle curve
            cv2.polylines(out, [pi], False, (0, 0, 0), thick + 2, cv2.LINE_AA)
            cv2.polylines(out, [pi], False, (255, 255, 255), max(1, thick - 2), cv2.LINE_AA)
        else:
            cv2.polylines(out, [pi], False, colors[code], thick, cv2.LINE_AA)

    def render_seg(out, order, codes):
        if len(order) < 10:      # ultra-short stubs paint as round blobs; skip them
            return
        pts = np.array([(x, y) for (y, x) in order], np.float32)
        if len(pts) < 2:
            return
        if len(codes) == 1:
            _stroke(out, pts, codes[0], 7)
        else:
            a, b = _perp_offsets(pts, 3.0)
            _stroke(out, a, codes[0], 4)
            _stroke(out, b, codes[1], 4)

    def render_dash(out, order, codes, thick=10):
        if len(order) < 6:
            return
        pts = np.array([(x, y) for (y, x) in order], np.float32)
        if len(pts) < 2:
            return
        if len(codes) == 1:
            _stroke(out, pts, codes[0], thick)
        else:
            a, b = _perp_offsets(pts, 3.5)
            _stroke(out, a, codes[0], max(3, thick // 2))
            _stroke(out, b, codes[1], max(3, thick // 2))

    return render_seg, render_dash


TERM_GAP = 9


def paint_legacy(img, segments, claims, dgroups, dclaims, housings, convention):
    """v1's exact painting sequence: solid nets, then dashed runs, then restore the ORIGINAL
    pixels over every housing EXPANDED by TERM_GAP, so each cable stops a little BEFORE its
    terminal instead of running onto the connector's pins / outline (user feedback: the paint
    must not follow the connectors). Returns (out_image, dash_painted_count)."""
    render_seg, render_dash = make_strokers(convention)
    H, W = img.shape[:2]
    out = img.copy()
    # paint every arc with its winning (closest-label) colours
    for sj, (_d, codes) in claims.items():
        render_seg(out, segments[sj]["order"], codes)

    _dash_painted = 0
    for r, (_d, codes) in dclaims.items():
        for si in dgroups[r]:
            render_dash(out, segments[si]["order"], codes)
        _dash_painted += 1

    for hx, hy, hw, hh in housings:
        y0, y1 = max(0, hy - TERM_GAP), min(H, hy + hh + TERM_GAP)
        x0, x1 = max(0, hx - TERM_GAP), min(W, hx + hw + TERM_GAP)
        out[y0:y1, x0:x1] = img[y0:y1, x0:x1]
    return out, _dash_painted
