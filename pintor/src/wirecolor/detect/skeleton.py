"""Wire mask -> skeleton -> arcs, plus twist-mark / text-remnant exclusion -- extracted
verbatim from colorize_wiring_prototype.py (lines 314-394 and helpers at 425-436).
"""
from __future__ import annotations

from collections import defaultdict

import cv2
import numpy as np
from skimage.morphology import skeletonize


def build_wire_mask(binary, labels, housings, W, H):
    wire = binary > 0
    for L in labels:
        xs = [p[0] for p in L["box"]]; ys = [p[1] for p in L["box"]]
        wire[max(0, int(min(ys)) - 3):min(H, int(max(ys)) + 3),
             max(0, int(min(xs)) - 3):min(W, int(max(xs)) + 3)] = False
    for hx, hy, hw, hh in housings:
        wire[max(0, hy):min(H, hy + hh), max(0, hx):min(W, hx + hw)] = False
    return wire


def order_arc(pixset):
    def nbrs(p):
        return [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                if (dy, dx) != (0, 0) and (p[0] + dy, p[1] + dx) in pixset]
    ends = [p for p in pixset if len(nbrs(p)) == 1]
    start = ends[0] if ends else next(iter(pixset))
    order = [start]; seen = {start}; cur = start
    while True:
        nx = [n for n in nbrs(cur) if n not in seen]
        if not nx:
            break
        cur = nx[0]; seen.add(cur); order.append(cur)
    return order


def build_segments(wire):
    skel = skeletonize(wire).astype(np.uint8)
    nbcount = cv2.filter2D(skel, -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) - skel
    branch = ((skel > 0) & (nbcount >= 3)).astype(np.uint8)
    cut = skel.copy()
    cut[cv2.dilate(branch, np.ones((5, 5), np.uint8)) > 0] = 0
    ncomp, lbls = cv2.connectedComponents(cut, 8)

    ys, xs = np.nonzero(cut)
    bylabel = defaultdict(set)
    for y, x in zip(ys.tolist(), xs.tolist()):
        bylabel[lbls[y, x]].add((y, x))
    segments = []  # dict: order(list of (y,x)), ends[2]=(y,x), tang[2]=(dy,dx) outward
    for lab, pixset in bylabel.items():
        if len(pixset) < 6:
            continue
        order = order_arc(pixset)
        if len(order) < 6:
            continue
        a, b = order[0], order[-1]
        # 14px tangent window: long enough that a bent star-spoke (horizontal for its first few px,
        # then diving to a junction dot) is NOT mistaken for the straight continuation of a bus wire.
        ka = min(14, len(order) - 1)
        ta = (order[0][0] - order[ka][0], order[0][1] - order[ka][1])   # outward at a
        tb = (order[-1][0] - order[-1 - ka][0], order[-1][1] - order[-1 - ka][1])
        segments.append(dict(order=order, ends=[a, b], tang=[ta, tb]))
    return segments


# ---- twisted-pair marks: the small 'Z' (or infinity-loop) symbols drawn ACROSS a cable pair are
# annotation, never cable -- exclude them from painting and from tracing so a cable can neither be
# painted through one nor jump to its neighbour via one.
def is_twist_mark(seg):
    o = seg["order"]
    n = len(o)
    (y0, x0), (y1, x1) = o[0], o[-1]
    dy, dx = abs(y1 - y0), abs(x1 - x0)
    span = max(dx, dy)
    # short diagonal stroke (the 'Z' body): both axes move substantially over a small length
    if n <= 85 and span >= 8 and min(dx, dy) >= 0.35 * span:
        return True
    # small closed-ish loop (the 'infinity' variant): path much longer than its bounding box
    ys_ = [p[0] for p in o]; xs_ = [p[1] for p in o]
    bdiag = ((max(xs_) - min(xs_)) ** 2 + (max(ys_) - min(ys_)) ** 2) ** 0.5
    if bdiag <= 55 and n >= 1.6 * max(bdiag, 1):
        return True
    return False


def find_twist(segments, labels):
    twist = {si for si, s in enumerate(segments) if is_twist_mark(s)}

    # text remnants: tiny arcs living inside an erased label box (leftover strokes of the erased
    # code text). Never paint or trace through them.
    _lbl_boxes_pre = []
    for L in labels:
        xs_ = [p[0] for p in L["box"]]; ys_ = [p[1] for p in L["box"]]
        _lbl_boxes_pre.append((min(xs_) - 5, min(ys_) - 5, max(xs_) + 5, max(ys_) + 5))

    def _in_lbl(px, py):
        return any(b[0] <= px <= b[2] and b[1] <= py <= b[3] for b in _lbl_boxes_pre)

    for si, s in enumerate(segments):
        if len(s["order"]) < 40:
            my_, mx_ = s["order"][len(s["order"]) // 2]
            if _in_lbl(mx_, my_):
                twist.add(si)
    return twist


# ---- shared geometry helpers (v1 lines 425-436) ------------------------------------------------
def unit(v):
    n = (v[0] ** 2 + v[1] ** 2) ** 0.5 or 1
    return (v[0] / n, v[1] / n)


def deep_tang(segments, si, k, win=30):
    """Outward tangent measured over a LONG window, so an arc that leaves a junction straight but
    bends shortly after (a star-spoke to a dot) scores worse than the true straight continuation."""
    o = segments[si]["order"]
    kk = min(win, len(o) - 1)
    if k == 0:
        return unit((o[0][0] - o[kk][0], o[0][1] - o[kk][1]))
    return unit((o[-1][0] - o[-1 - kk][0], o[-1][1] - o[-1 - kk][1]))
