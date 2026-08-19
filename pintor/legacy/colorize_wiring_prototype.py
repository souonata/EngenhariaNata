"""EXPERIMENTAL: paint wiring-diagram cables per their colour codes (raster/scanned PDFs).

Prototype developed interactively on pub 2476 (Wiring Diagram D9A2A/D9A2M, doc 893319) -- validated
on that ONE sheet only; generalisation across the other wiring diagrams is still to be proven.

Pipeline:
  1. OCR (RapidOCR, tiled) finds the colour-code labels: single codes (SB, R, GN...) and two-colour
     codes (R/BL, Y/SB...); the trailing cross-section number ("1,5") is stripped. Labels INSIDE a
     component symbol (e.g. a sensor's P2 pressure marker) are designations, not colours: rejected.
  2. Component housings (relays / sensors / connector bars) are detected as closed rectangles from
     the H/V line segments; cables are never painted inside them and their outlines are not wires.
  3. The wire mask (binary minus labels minus housings) is skeletonised and cut at branch points
     into arcs of ANY angle. Every arc end is a PORT; ports meeting at a junction form a NODE.
  4. GLOBAL NET-SOLVER (round 5; replaced greedy per-label tracing, which plateaued on chained
     forks): junction dots merge their arcs up front; labels seed colours onto their home nets;
     then nodes are resolved to a fixpoint by rules of decreasing certainty -- mutual-best
     collinear continuation (tangent + lateral term, so parallel wires crossing a bus never swap),
     corner-at-crossing, ink-connected hairpin tips (harness loop U-turns), and ELIMINATION: a
     port whose only colour-compatible candidate remains is committed, which resolves whole chains
     of forks. Gaps across erased labels / connector blocks are WEAK candidates: only elimination
     may commit them. Two nets carrying different codes can never merge.
  5. Twisted-pair 'Z' marks (and small infinity loops) are annotation: never painted, never traced.
  6. Render: single code = solid band; X/Y = the two colours run parallel; W (white) = same width,
     white core with a 1px black rail each side so it reads on white paper.

Usage (deps: opencv, numpy, scikit-image, PyMuPDF + rapidocr for OCR):
    python colorize_wiring_prototype.py page.png [labels.json] [out.png]
If labels.json does not exist it is produced by OCR first (needs rapidocr installed).
Known gaps: W-coded wires are inherently faint by design; genuinely ambiguous forks (two equally
plausible continuations, both colour-compatible) stay unresolved rather than guessed."""
import json
import os
import sys
from collections import defaultdict
import cv2
import numpy as np
from skimage.morphology import skeletonize

SRC = sys.argv[1] if len(sys.argv) > 1 else "wiring_2476.png"
LBL = sys.argv[2] if len(sys.argv) > 2 else "labels_2476.json"
OUT = sys.argv[3] if len(sys.argv) > 3 else "wiring_2476_v3.png"

CODES = {"BL", "BN", "BR", "DB", "DBL", "DGN", "GN", "GR", "LBL", "LBN", "LGN",
         "OR", "P", "PU", "R", "SB", "T", "VO", "W", "Y"}


def ocr_labels(image_path: str) -> dict:
    """Tiled RapidOCR pass that returns {"labels": [{code, raw, score, cx, cy, w, h, box}]}."""
    import re
    from PIL import Image
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

    def parse_code(text):
        """Accept both label grammars seen in the library:
        code-first  -- "SB 1,5", "R/BL", "W 1.0"
        gauge-first -- "1 Y (w3)", "1.5 BL/R (w6)"  (electromobility junction-box style)"""
        t = text.strip().upper().replace(" ", "").replace(",", ".")
        t = re.sub(r"\(W\d+\)$", "", t)                      # drop the "(w3)" wire-id suffix

        def _match(s):
            m = re.match(r"^(\d(\.\d+)?)?([A-Z]{1,3}(?:/[A-Z]{1,3})?)(\d(\.\d+)?)?$", s)
            if not m:
                return None
            code = m.group(3)
            return code if all(p in CODES for p in code.split("/")) else None

        c = _match(t)
        if c:
            return c
        # OCR reads the letter O as a 0 in codes ending in VO ('1 Y/VO' is scanned '1 Y/V0'): a lone
        # trailing '0' right after the colour letters is really that O -- fold it back in and retry.
        m0 = re.match(r"^(\d(?:\.\d+)?)?([A-Z]{1,3}(?:/[A-Z]{1,3})?)0$", t)
        if m0:
            return _match((m0.group(1) or "") + m0.group(2) + "O")
        return None

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
                if re.search(r"\bWH\b", txt.upper()):
                    wh_hits.add((round(sum(p[0] for p in pts) / 120), round(sum(p[1] for p in pts) / 120)))
                pxs = [p[0] for p in pts]; pys = [p[1] for p in pts]
                tokens.append({"raw": txt, "score": float(score),
                               "cx": sum(pxs) / 4, "cy": sum(pys) / 4,
                               "w": max(pxs) - min(pxs), "h": max(pys) - min(pys),
                               "box": pts})
    # a two-colour code broken across tokens ('BL/ GR' -> 'BL/' + 'GR') would seed the WRONG colour
    # from the surviving fragment: re-join a dangling-slash token with its nearest neighbour first.
    # The merge only APPLIES when the joined text parses to a code -- a tile-overlap duplicate
    # fragment next to an already-complete token must not corrupt it (the fragment is dropped).
    for t in tokens:
        r = t["raw"].strip().upper()
        if not r.endswith("/"):
            continue
        span = max(t["w"], t["h"])
        near = [u for u in tokens
                if u is not t and u["raw"] and abs(u["cx"] - t["cx"]) <= 1.6 * span
                and abs(u["cy"] - t["cy"]) <= 1.6 * span]
        t["raw"] = ""                       # a dangling-slash token never parses on its own
        if near:
            u = min(near, key=lambda u: (u["cx"] - t["cx"]) ** 2 + (u["cy"] - t["cy"]) ** 2)
            merged = r + u["raw"].strip().upper()
            # 'BL/'+'GR' -> 'BL/GR' parses: apply. 'R/'+'R/ BL 1.0' -> gibberish: keep u as is.
            if parse_code(merged):
                u["raw"] = merged
                u["score"] = min(u["score"], t["score"])
                xs_ = [p[0] for p in t["box"] + u["box"]]; ys_ = [p[1] for p in t["box"] + u["box"]]
                u["box"] = [[min(xs_), min(ys_)], [max(xs_), min(ys_)],
                            [max(xs_), max(ys_)], [min(xs_), max(ys_)]]
                u["cx"] = (min(xs_) + max(xs_)) / 2; u["cy"] = (min(ys_) + max(ys_)) / 2
                u["w"] = max(xs_) - min(xs_); u["h"] = max(ys_) - min(ys_)
    found = []
    for t in tokens:
        code = parse_code(t["raw"])
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
        print(f"all-white cabinet sheet detected ({len(wh_hits)} WH tokens): nothing to colourize")
        labels_out = []
    return {"image": [iw, ih], "labels": labels_out}


if not os.path.exists(LBL):
    json.dump(ocr_labels(SRC), open(LBL, "w"))
    print(f"OCR labels written to {LBL}")

COLORS = {
    "BL": (210, 110, 0), "BN": (25, 60, 110), "BR": (25, 60, 110), "DB": (150, 0, 0),
    "DBL": (150, 0, 0), "DGN": (40, 110, 0), "GN": (60, 165, 0), "GR": (140, 140, 140),
    "LBL": (235, 190, 120), "LBN": (85, 135, 180), "LGN": (90, 205, 150), "OR": (0, 130, 240),
    "P": (190, 120, 235), "PU": (175, 50, 140), "R": (30, 30, 225), "SB": (25, 25, 25),
    "T": (95, 155, 195), "VO": (205, 60, 150), "W": (255, 255, 255), "Y": (0, 210, 240),
}
K, EPS = 26, 9

data = json.load(open(LBL)); labels = data["labels"]
# OCR fragment guard: the same printed text often yields BOTH the full code and a piece of it as
# separate tokens ('BL/W' + a lone 'W'). A label whose colour parts are a strict subset of a
# label whose BOX it sits inside is that text's fragment, never a second wire's code -- and as a
# seed it would poison the whole net with the wrong colour. (Centre-inside-box, not proximity:
# adjacent pins' real labels sit close together but never inside each other's text box.)
_keep = []
for _i, _Li in enumerate(labels):
    if min(_Li["w"], _Li["h"]) < 16:   # a code glyph is ~30 px at 200 DPI; a 7 px-thin "letter"
        continue                       # is a piece of line art (housing edge) misread as text
    _pi = set(_Li["code"].split("/"))
    _frag = False
    for _j, _Lj in enumerate(labels):
        if _i == _j or not _pi < set(_Lj["code"].split("/")):
            continue
        _xs = [p[0] for p in _Lj["box"]]; _ys = [p[1] for p in _Lj["box"]]
        if min(_xs) - 6 <= _Li["cx"] <= max(_xs) + 6 and min(_ys) - 6 <= _Li["cy"] <= max(_ys) + 6:
            _frag = True
            break
    if not _frag:
        _keep.append(_Li)
labels = _keep
img = cv2.imread(SRC); H, W = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# <210 (not <128): many sheets draw the long harness runs in LIGHT GRAY ink -- a strict threshold
# erases them from the wire mask entirely, making whole loops untraceable/unpaintable.
binary = (gray < 210).astype(np.uint8) * 255

# ---- housings: reuse the v6 H/V-rectangle detector -------------------------------------------
# labels are erased INSET by 4 px here (not expanded): a designation label hugging a housing edge
# ('P4' inside a sensor box, or an edge piece OCR'd as a letter) must not nick the edge line, or
# the rectangle test loses the whole housing and its outline gets painted as wire.
bin2 = binary.copy()
for L in labels:
    xs = [p[0] for p in L["box"]]; ys = [p[1] for p in L["box"]]
    _x0, _x1 = int(min(xs)) + 4, int(max(xs)) - 4
    _y0, _y1 = int(min(ys)) + 4, int(max(ys)) - 4
    if _x1 > _x0 and _y1 > _y0:
        bin2[max(0, _y0):min(H, _y1), max(0, _x0):min(W, _x1)] = 0
hL = cv2.morphologyEx(bin2, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (K, 1)))
vL = cv2.morphologyEx(bin2, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, K)))
nh, _, sh, _ = cv2.connectedComponentsWithStats(hL, 8)
nv, _, sv, _ = cv2.connectedComponentsWithStats(vL, 8)
hsegs, vsegs = [], []
for i in range(1, nh):
    x, y, w, h = int(sh[i, 0]), int(sh[i, 1]), int(sh[i, 2]), int(sh[i, 3])
    if w >= K and h <= 14:
        hsegs.append((x, y + h // 2, x + w))
for i in range(1, nv):
    x, y, w, h = int(sv[i, 0]), int(sv[i, 1]), int(sv[i, 2]), int(sv[i, 3])
    if h >= K and w <= 14:
        vsegs.append((x + w // 2, y, y + h))
vidx = defaultdict(list)
for (xc, y0, y1) in vsegs:
    vidx[round(xc / 6)].append((xc, y0, y1))
def v_end_near(px, py):
    for dc in (-1, 0, 1):
        for (xc, y0, y1) in vidx.get(round(px / 6) + dc, []):
            if abs(xc - px) <= EPS and (abs(y0 - py) <= EPS or abs(y1 - py) <= EPS):
                return (xc, y0, y1)
    return None
housings = []
for (x0, yc, x1) in hsegs:
    L1 = v_end_near(x0, yc); R1 = v_end_near(x1, yc)
    if not L1 or not R1:
        continue
    yb = L1[1] if abs(L1[1] - yc) > abs(L1[2] - yc) else L1[2]
    yb2 = R1[1] if abs(R1[1] - yc) > abs(R1[2] - yc) else R1[2]
    if abs(yb - yb2) > 10:
        continue
    for (bx0, byc, bx1) in hsegs:
        if abs(byc - yb) <= EPS and abs(bx0 - x0) <= 12 and abs(bx1 - x1) <= 12:
            rw, rh = abs(x1 - x0), abs(yb - yc)
            # housing shapes: small component box (absolute size), a WIDE connector bar (width
            # scales with the sheet), or a TALL narrow pin strip (relay/fuse columns).
            wide = rh <= max(260, 0.08 * H) and rw <= 0.55 * W
            tall = rw <= 260 and rh <= 0.30 * H
            # big control-unit connector (PCU / EMS / SDU): a closed rectangle spanning much of the
            # sheet width but relatively flat. Its outline + terminal pins must never be painted, so
            # bypass the single-box size cap (320) that would otherwise reject something this large.
            bigconn = rw >= 0.30 * W and rh <= 0.16 * H
            if min(rw, rh) >= 18 and (max(rw, rh) <= 320 or wide or tall or bigconn):
                housings.append((min(x0, x1) - 3, min(yc, yb) - 3, rw + 6, rh + 6))
            break
# double-bar connectors (e.g. CONNECTOR A/B): two long parallel H edges close together -- catch the
# strip between them so the housing bars are not painted (the single-rectangle test misses these).
longh = [(x0, yc, x1) for (x0, yc, x1) in hsegs if x1 - x0 > 400]
for (x0, yc, x1) in longh:
    for (bx0, byc, bx1) in longh:
        if 25 < byc - yc < 65 and abs(bx0 - x0) < 80 and abs(bx1 - x1) < 80:  # a matched connector row-pair
            housings.append((min(x0, bx0) - 4, yc - 4, max(x1, bx1) - min(x0, bx0) + 8, byc - yc + 8))

# dedup: drop housings whose centre falls inside a larger kept housing
housings.sort(key=lambda b: b[2] * b[3], reverse=True)
_kept = []
for hb in housings:
    cx0, cy0 = hb[0] + hb[2] / 2, hb[1] + hb[3] / 2
    if not any(ox <= cx0 <= ox + ow and oy <= cy0 <= oy + oh for ox, oy, ow, oh in _kept):
        _kept.append(hb)
housings = _kept

def in_housing(px, py, m=0):
    return any(hx - m <= px <= hx + hw + m and hy - m <= py <= hy + hh + m for hx, hy, hw, hh in housings)

# ---- junction dots ---------------------------------------------------------------------------
# each dot carries its own reach radius: the skeleton branch-cut pushes arc ends 15-25 px away
# from a large dot's centre, so a fixed radius misses a big star point's arms.
_dist = cv2.distanceTransform(binary, cv2.DIST_L2, 3)
_dm = cv2.dilate(((_dist >= 3.5) * 255).astype(np.uint8), np.ones((3, 3), np.uint8))
_nd, _, _sd, _cd = cv2.connectedComponentsWithStats(_dm, 8)
dots = [(int(_cd[i][0]), int(_cd[i][1]), max(20, max(int(_sd[i, 2]), int(_sd[i, 3])) // 2 + 10))
        for i in range(1, _nd)
        if 5 <= int(_sd[i, 2]) <= 26 and 5 <= int(_sd[i, 3]) <= 26 and int(_sd[i, 4]) >= 18]
# scanned dots often dither into STIPPLE (no solid core, invisible to the distance transform):
# find them as roundish blobs of dense ink. Junction dots never sit on the sheet frame or in the
# bottom-right title block -- dense logo/text blobs there are rejected.
_dens = cv2.boxFilter((binary > 0).astype(np.float32), -1, (15, 15))
_nc, _, _sc, _cc = cv2.connectedComponentsWithStats(((_dens >= 0.55) * 255).astype(np.uint8), 8)
for i in range(1, _nc):
    _w, _h, _a = int(_sc[i, 2]), int(_sc[i, 3]), int(_sc[i, 4])
    _cx, _cy = int(_cc[i][0]), int(_cc[i][1])
    if not (10 <= _w <= 45 and 10 <= _h <= 45 and _a >= 100 and 0.5 <= _w / _h <= 2.0):
        continue
    if min(_cx, _cy, W - _cx, H - _cy) <= 150 or (_cx > 0.62 * W and _cy > 0.70 * H):
        continue
    if any(abs(dx - _cx) <= 12 and abs(dy - _cy) <= 12 for dx, dy, _r in dots):
        continue
    dots.append((_cx, _cy, max(20, max(_w, _h) // 2 + 10)))

def dot_near(y, x, r=0):
    for dx, dy, dr in dots:
        rr = max(dr, r)
        if abs(dx - x) <= rr and abs(dy - y) <= rr:
            return (dx, dy)
    return None

# ---- wire mask -> skeleton -> arcs -----------------------------------------------------------
wire = binary > 0
for L in labels:
    xs = [p[0] for p in L["box"]]; ys = [p[1] for p in L["box"]]
    wire[max(0, int(min(ys)) - 3):min(H, int(max(ys)) + 3), max(0, int(min(xs)) - 3):min(W, int(max(xs)) + 3)] = False
for hx, hy, hw, hh in housings:
    wire[max(0, hy):min(H, hy + hh), max(0, hx):min(W, hx + hw)] = False
skel = skeletonize(wire).astype(np.uint8)
nbcount = cv2.filter2D(skel, -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) - skel
branch = ((skel > 0) & (nbcount >= 3)).astype(np.uint8)
cut = skel.copy()
cut[cv2.dilate(branch, np.ones((5, 5), np.uint8)) > 0] = 0
ncomp, lbls = cv2.connectedComponents(cut, 8)

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

twist = {si for si, s in enumerate(segments) if is_twist_mark(s)}

# text remnants: tiny arcs living inside an erased label box (leftover strokes of the erased code
# text). Never paint or trace through them.
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

# junction dots CONNECT everything they touch: all arcs ending at a dot belong to the same cable
# (that is what the filled dot means), so colour propagates through the whole dotted net -- e.g.
# a star point's branches or a daisy-chained injector return all take the node's colour.
dot_arcs = defaultdict(list)
for _si, _s in enumerate(segments):
    if _si in twist:
        continue
    for _k, _e in enumerate(_s["ends"]):
        _d = dot_near(_e[0], _e[1], 20)
        if _d:
            dot_arcs[_d].append((_si, _k))

# endpoint index for junction adjacency
eidx = defaultdict(list)
for si, s in enumerate(segments):
    for k, e in enumerate(s["ends"]):
        eidx[(round(e[0] / 6), round(e[1] / 6))].append((si, k))
def others_at(pt, exclude):
    out = []
    for dcy in (-3, -2, -1, 0, 1, 2, 3):
        for dcx in (-3, -2, -1, 0, 1, 2, 3):
            for (si, k) in eidx.get((round(pt[0] / 6) + dcy, round(pt[1] / 6) + dcx), []):
                if si == exclude:
                    continue
                e = segments[si]["ends"][k]
                if abs(e[0] - pt[0]) <= 14 and abs(e[1] - pt[1]) <= 14:
                    out.append((si, k))
    return out

def unit(v):
    n = (v[0] ** 2 + v[1] ** 2) ** 0.5 or 1
    return (v[0] / n, v[1] / n)

def deep_tang(si, k, win=30):
    """Outward tangent measured over a LONG window, so an arc that leaves a junction straight but
    bends shortly after (a star-spoke to a dot) scores worse than the true straight continuation."""
    o = segments[si]["order"]
    kk = min(win, len(o) - 1)
    if k == 0:
        return unit((o[0][0] - o[kk][0], o[0][1] - o[kk][1]))
    return unit((o[-1][0] - o[-1 - kk][0], o[-1][1] - o[-1 - kk][1]))

label_boxes = []
for L in labels:
    xs_ = [p[0] for p in L["box"]]; ys_ = [p[1] for p in L["box"]]
    label_boxes.append((min(xs_) - 5, min(ys_) - 5, max(xs_) + 5, max(ys_) + 5))

def in_label_box(px, py):
    return any(bx0 <= px <= bx1 and by0 <= py <= by1 for bx0, by0, bx1, by1 in label_boxes)

PROBE = None
if "--probe" in sys.argv:
    _pi = sys.argv.index("--probe")
    PROBE = (float(sys.argv[_pi + 1]), float(sys.argv[_pi + 2]))
WHO = None
if "--who" in sys.argv:
    _wi = sys.argv.index("--who")
    WHO = (float(sys.argv[_wi + 1]), float(sys.argv[_wi + 2]))  # x, y

def nearest_segment(cx, cy, want_vertical=None, maxd=62):
    """Nearest wire arc to a label. Codes are printed ALONG their wire (rotated with it), so a
    vertical label must match a locally-vertical arc -- a mismatched-orientation arc (e.g. a stray
    connector-bar edge) is heavily penalised rather than chosen by raw distance."""
    best = None
    for si, s in enumerate(segments):
        if si in twist:
            continue
        o = s["order"]
        for idx in range(0, len(o), 4):
            y, x = o[idx]
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d > (maxd * 3) ** 2:
                continue
            score = d
            if want_vertical is not None:
                j0, j1 = max(0, idx - 5), min(len(o) - 1, idx + 5)
                dy_ = abs(o[j1][0] - o[j0][0]); dx_ = abs(o[j1][1] - o[j0][1])
                if (dy_ >= dx_) != want_vertical:
                    score += 250 ** 2                 # wrong orientation: only as a last resort
            if best is None or score < best[0]:
                best = (score, si, d)
    if best and best[2] <= maxd * maxd:
        return best[1]
    return None

# ---- GLOBAL NET-SOLVER -------------------------------------------------------------------------
# Greedy per-label tracing plateaued on the long unlabelled harness loops: every chained fork is
# ambiguous seen from one end, but becomes FORCED once the neighbouring nets take colours. So the
# whole sheet is solved at once: every arc end is a PORT, ports meeting at a junction form a NODE,
# and nodes are resolved by rules of decreasing certainty until a fixpoint -- mutual-best collinear
# continuation (with a lateral term, so two parallel wires crossing a bus cannot swap), then
# corner-at-crossing, then ELIMINATION: a port whose only colour-compatible candidate remains is
# committed, which resolves whole chains greedy tracing could not.

def _probe_near(*pts):
    return PROBE is not None and any(abs(p[1] - PROBE[0]) < 40 and abs(p[0] - PROBE[1]) < 40 for p in pts)

# --- nets: union-find over segments; a net's colour set constrains which merges are legal --------
_net = list(range(len(segments)))
def nfind(a):
    while _net[a] != a:
        _net[a] = _net[_net[a]]; a = _net[a]
    return a
net_colors = defaultdict(set)          # net root -> {frozenset(code parts), ...} seeded by labels
def colors_ok(a, b):
    ca, cb = net_colors[nfind(a)], net_colors[nfind(b)]
    return not ca or not cb or bool(ca & cb)   # 'BL/R' == 'R/BL' via frozenset; 'R' != 'R/BL'
seed_pts = defaultdict(list)           # net root -> [(y, x) of its seed labels]
def nunion(a, b):
    ra, rb = nfind(a), nfind(b)
    if ra == rb:
        return
    _net[rb] = ra
    net_colors[ra] |= net_colors.pop(rb, set())
    seed_pts[ra] += seed_pts.pop(rb, [])

# junction dots CONNECT everything they touch (round-2 rule): merge their arcs up front and take
# those ports out of the pairing game entirely.
at_dot = set()
for _d, _lst in dot_arcs.items():
    for (si, k) in _lst:
        at_dot.add((si, k))
    for (_sa, _), (_sb, _) in zip(_lst, _lst[1:]):
        nunion(_sa, _sb)

# --- label seeds: colour each label's home net (rejection rules unchanged from rounds 1-4) -------
seeds = []                             # (label, home segment)
rej = nomatch = 0
for L in labels:
    if in_housing(L["cx"], L["cy"]):
        rej += 1
        continue
    # the bottom-right title block (logo, doc number, legend) yields garbage OCR "codes" that would
    # paint logo strokes -- never treat anything in that corner as a cable label.
    if L["cx"] > 0.62 * W and L["cy"] > 0.70 * H:
        rej += 1
        continue
    # wide labels (gauge-first style: "1.5 BL/R (w6)") sit at the end of a leader, farther from
    # their wire than compact codes -- scale the match radius with the label's own size.
    si = nearest_segment(L["cx"], L["cy"], want_vertical=L["h"] > L["w"],
                         maxd=max(62, 0.9 * max(L["w"], L["h"])))
    if si is None:
        nomatch += 1
        continue
    seeds.append((L, si))
    net_colors[nfind(si)].add(frozenset(L["code"].split("/")))
    seed_pts[nfind(si)].append((L["cy"], L["cx"]))

# --- ink connectivity: the referee for HAIRPIN TIPS. The two arms of a harness loop's U-turn point
# the SAME way, which round 4 rightly banned as a continuation (that is what the neighbouring
# stripe of a cable pair looks like) -- but at a hairpin the ink itself is one continuous stroke,
# while pair stripes are separate strokes. Twist-mark pixels are removed first so a 'Z' can still
# never join a pair.
_conn = wire.copy()
_twm = np.zeros((H, W), np.uint8)
for _si in twist:
    for (_y, _x) in segments[_si]["order"]:
        _twm[_y, _x] = 1
_conn[cv2.dilate(_twm, np.ones((9, 9), np.uint8)) > 0] = False

def ink_connected(Ea, Eb):
    ay, ax, by, bx = int(Ea[0]), int(Ea[1]), int(Eb[0]), int(Eb[1])
    y0 = max(0, min(ay, by) - 20); y1 = min(H, max(ay, by) + 21)
    x0 = max(0, min(ax, bx) - 20); x1 = min(W, max(ax, bx) + 21)
    win = _conn[y0:y1, x0:x1].astype(np.uint8)
    if not win[ay - y0, ax - x0] or not win[by - y0, bx - x0]:
        return False
    _, comp = cv2.connectedComponents(win, 8)
    return comp[ay - y0, ax - x0] == comp[by - y0, bx - x0]

def converging(p, q):
    """Hairpin arms CONVERGE to the tip; pair stripes stay parallel. Compare the gap at the ends
    with the gap 30 px in."""
    (si, ki), (sj, kj) = p, q
    oa, ob = segments[si]["order"], segments[sj]["order"]
    Ea = oa[0] if ki == 0 else oa[-1]; Eb = ob[0] if kj == 0 else ob[-1]
    ia = min(30, len(oa) - 1); ib = min(30, len(ob) - 1)
    Pa = oa[ia] if ki == 0 else oa[-1 - ia]; Pb = ob[ib] if kj == 0 else ob[-1 - ib]
    d_end = ((Ea[0] - Eb[0]) ** 2 + (Ea[1] - Eb[1]) ** 2) ** 0.5
    d_in = ((Pa[0] - Pb[0]) ** 2 + (Pa[1] - Pb[1]) ** 2) ** 0.5
    return d_end < 0.7 * d_in

def cont_score(p, q):
    """Continuation quality of pairing two ports: the rounds-1-4 tangent formula (deep tangent
    dominates, so a spoke that bends away shortly after the junction loses to the true straight-
    through wire) plus a LATERAL penalty -- the far end must lie ON my line, so where two parallel
    wires cross a bus together each pairs with its own far side, never its neighbour's."""
    (si, ki), (sj, kj) = p, q
    Ei, Ej = segments[si]["ends"][ki], segments[sj]["ends"][kj]
    shi, shj = unit(segments[si]["tang"][ki]), unit(segments[sj]["tang"][kj])
    dpi, dpj = deep_tang(si, ki), deep_tang(sj, kj)
    s = -0.3 * (shi[0] * shj[0] + shi[1] * shj[1]) - 0.7 * (dpi[0] * dpj[0] + dpi[1] * dpj[1])
    vy, vx = Ej[0] - Ei[0], Ej[1] - Ei[1]
    d = (vy * vy + vx * vx) ** 0.5
    if d >= 3:
        lat = max(abs(vy * dpi[1] - vx * dpi[0]), abs(vy * dpj[1] - vx * dpj[0]))
        s -= 0.35 * min(1.0, lat / (0.6 * d + 4))
    return s

# --- candidates ----------------------------------------------------------------------------------
# STRONG: ports meeting at a node (14 px, same adjacency the greedy tracer used). Same-direction
#   mates (deep dot >= 0.8) are dropped UNLESS ink-connected AND converging (hairpin tip).
# WEAK: never committed by geometry alone, only by elimination with colour pruning --
#   (a) collinear far-side bridges across erased label text / connector housings (round-1 rule;
#       lateral tolerance relaxed 6 -> 12 px because scan skew drifts that much over a 100+ px gap
#       -- safe now that commitment requires being the ONLY compatible candidate);
#   (b) near gaps <= 30 px slightly ahead (light-ink breaks just past the 14 px node radius: the
#       audit's near-miss bucket).
live = [si for si in range(len(segments)) if si not in twist]
cands = defaultdict(dict)              # port -> {mate port: score}
weak = set()                           # (p, q) pairs that only elimination may commit
l_pairs = set()                        # around-the-corner label-box jumps (last resort)

# spatial prefilter for the weak-gap scan. Targets must normally be >= 40 px (never bridge onto a
# dash/fragment -- a dashed outline would chain heal-by-heal otherwise), but a gap crossing an
# ERASED LABEL BOX may land on a stub down to 12 px: the erased code text chops the wire into
# pieces that are often ALL short, and those stubs are cut wire, not dashes.
_gap_ports = [(sj, kj) for sj in live if len(segments[sj]["order"]) >= 12
              for kj in (0, 1) if (sj, kj) not in at_dot]
_gap_pos = np.array([segments[sj]["ends"][kj] for (sj, kj) in _gap_ports], np.float32) \
    if _gap_ports else np.zeros((0, 2), np.float32)

for si in live:
    seeded_si = bool(net_colors[nfind(si)])   # a label's own wire stub is never a dash/fragment:
    for k in (0, 1):                          # the erased code text cuts the wire into short pieces
        p = (si, k)
        if p in at_dot:
            continue
        E = segments[si]["ends"][k]
        dp = deep_tang(si, k)
        for (sj, kj) in others_at(E, si):
            if sj in twist or (sj, kj) in at_dot:
                continue
            q = (sj, kj)
            dq = deep_tang(sj, kj)
            if dp[0] * dq[0] + dp[1] * dq[1] >= 0.8:   # side-by-side pair mate (round-4 ban) ...
                Eq = segments[sj]["ends"][kj]
                if not (converging(p, q) and ink_connected(E, Eq)):
                    continue                            # ... unless it is a hairpin tip
            cands[p][q] = cont_score(p, q)
        # weak gap mates (numpy prefilter, then exact checks on the survivors)
        _dy = _gap_pos[:, 0] - E[0]; _dx = _gap_pos[:, 1] - E[1]
        _d2 = _dy * _dy + _dx * _dx
        for gi in np.nonzero((_d2 >= 144) & (_d2 <= 28900))[0]:
            q = _gap_ports[gi]
            sj, kj = q
            if sj == si or q in cands[p]:
                continue
            Ej = segments[sj]["ends"][kj]
            vy, vx = Ej[0] - E[0], Ej[1] - E[1]
            dist = (vy * vy + vx * vx) ** 0.5
            ahead = (vy * dp[0] + vx * dp[1]) / dist
            lat = abs(vy * dp[1] - vx * dp[0])
            dq = deep_tang(sj, kj)
            lbl_gap = in_label_box((E[1] + Ej[1]) / 2, (E[0] + Ej[0]) / 2)
            # far side must continue back along my line. Inside a label box a SHORT tangent may
            # vouch instead: the far arc often corners right after the cut, corrupting its deep
            # tangent even though the gap itself is perfectly straight.
            opposed = dp[0] * dq[0] + dp[1] * dq[1] <= -0.8
            if not opposed and lbl_gap:
                _sq = deep_tang(sj, kj, 6)
                opposed = dp[0] * _sq[0] + dp[1] * _sq[1] <= -0.6
            near_gap = opposed and dist <= 30 and ahead >= 0.7 and lat <= 8
            far_gap = opposed and ahead >= 0.9 and lat <= 12 and \
                (lbl_gap or in_housing((E[1] + Ej[1]) / 2, (E[0] + Ej[0]) / 2, 2))
            # L-gap: erased text can swallow a CORNER -- then no collinear far side exists, but the
            # two cut ends' outward rays cross inside the label box, each pointing at the crossing.
            l_gap = False
            if not (near_gap or far_gap) and abs(dp[0] * dq[0] + dp[1] * dq[1]) <= 0.35:
                _det = dp[0] * dq[1] - dp[1] * dq[0]
                if abs(_det) > 1e-6:
                    _t1 = (vy * dq[1] - vx * dq[0]) / _det
                    _t2 = (vy * dp[1] - vx * dp[0]) / _det
                    if 3 <= _t1 <= 170 and 3 <= _t2 <= 170:
                        _Xy, _Xx = E[0] + _t1 * dp[0], E[1] + _t1 * dp[1]
                        l_gap = in_label_box(_Xx, _Xy)
            # label-box gaps: any source, stub targets ok. Elsewhere: the dash/fragment bans hold
            # for both sides (a seeded source is a label's own cut wire, also never a dash).
            if (far_gap and lbl_gap) or l_gap:
                ok = True
            elif near_gap or far_gap:
                ok = (seeded_si or len(segments[si]["order"]) >= 25) \
                    and len(segments[sj]["order"]) >= 40
            else:
                ok = False
            if ok:
                sc = cont_score(p, q) - 0.01 * dist            # prefer the shortest gap
                cands[p][q] = sc
                weak.add((p, q)); weak.add((q, p))
                if l_gap:
                    l_pairs.add((p, q)); l_pairs.add((q, p))
                if (far_gap and lbl_gap) or l_gap:
                    cands[q][p] = sc     # label-cut stubs: elimination may fire from either side

# L-gaps are a LAST RESORT: an around-the-corner jump may never compete with (and dilute) real
# candidates -- keep an L edge only where BOTH ports have nothing else.
for (p, q) in {tuple(sorted(pr)) for pr in l_pairs}:
    if any((p, o) not in l_pairs for o in cands[p]) or any((q, o) not in l_pairs for o in cands[q]):
        cands[p].pop(q, None); cands[q].pop(p, None)

# --- nodes: cluster ports whose ends meet (transitive closure of the 14 px adjacency) ------------
_pp = {}
def pfind(p):
    while _pp.setdefault(p, p) != p:
        _pp[p] = _pp[_pp[p]]; p = _pp[p]
    return p
for si in live:
    for k in (0, 1):
        E = segments[si]["ends"][k]
        for (sj, kj) in others_at(E, si):
            if sj not in twist:
                ra, rb = pfind((si, k)), pfind((sj, kj))
                if ra != rb:
                    _pp[rb] = ra
nodes = defaultdict(list)
for si in live:
    for k in (0, 1):
        if (si, k) not in at_dot:
            nodes[pfind((si, k))].append((si, k))

# --- solve to fixpoint ---------------------------------------------------------------------------
mate = {}
def commit(p, q, why):
    if p in mate or q in mate or not colors_ok(p[0], q[0]):
        return False
    mate[p] = q; mate[q] = p
    nunion(p[0], q[0])
    if _probe_near(segments[p[0]]["ends"][p[1]], segments[q[0]]["ends"][q[1]]):
        Ep = segments[p[0]]["ends"][p[1]]
        print(f"PROBE commit[{why}] seg{p[0]}e{p[1]}<->seg{q[0]}e{q[1]} at (y{Ep[0]},x{Ep[1]})")
    return True

def avail(p):
    return [(q, sc) for q, sc in cands[p].items()
            if q not in mate and colors_ok(p[0], q[0])]

def seed_dist(p):
    """How far this port is from its net's nearest seed label (INF when uncolored). Commits are
    processed nearest-seed-first, so nets flood OUTWARD from their labels and a contested chain
    goes to the CLOSEST label -- the solver-level form of the round-2 ownership rule (a code
    printed on a wire always beats one from across the sheet)."""
    pts = seed_pts.get(nfind(p[0]))
    if not pts:
        return float("inf")
    E = segments[p[0]]["ends"][p[1]]
    return min(((E[0] - y) ** 2 + (E[1] - x) ** 2) ** 0.5 for (y, x) in pts)

for _round in range(120):
    proposals = []
    # RULE A -- mutual-best strong continuation per node (the crossing resolver): both ports name
    # each other their best available mate and the score clears the greedy tracer's 0.2 bar.
    for plist in nodes.values():
        free = [p for p in plist if p not in mate]
        if len(free) < 2:
            continue
        best = {}
        for p in free:
            strong = [(q, sc) for q, sc in avail(p) if (p, q) not in weak]
            if strong:
                best[p] = max(strong, key=lambda t: t[1])
        for p, (q, sc) in best.items():
            if sc >= 0.2 and best.get(q, (None, -9))[0] == p and p < q:
                proposals.append((0, p, q, "mutual-best"))
    # RULE B -- corner-at-crossing (round-4 rule at node level): after the collinear pairs are
    # gone, exactly two ports left at the node continue EACH OTHER around the corner.
    for plist in nodes.values():
        free = [p for p in plist if p not in mate]
        if len(free) == 2:
            p, q = free
            if q in cands[p] and (p, q) not in weak \
                    and len(segments[p[0]]["order"]) >= 25 and len(segments[q[0]]["order"]) >= 25:
                proposals.append((1, p, q, "corner"))
    # RULE C -- elimination (the chain resolver): a port whose only colour-compatible candidate
    # remains takes it, weak gap candidates included. A low-score (corner-like) pick may still
    # never land on a dash/fragment (round-4 corner rule).
    for si in live:
        for k in (0, 1):
            p = (si, k)
            if p in mate or p in at_dot:
                continue
            av = avail(p)
            if len(av) == 1:
                q, _sc = av[0]
                if _sc >= 0.2 or len(segments[q[0]]["order"]) >= 25:
                    proposals.append((2, p, q, "elimination"))
    if not proposals:
        break
    proposals.sort(key=lambda t: (t[0], min(seed_dist(t[1]), seed_dist(t[2]))))
    changed = False
    for tier, p, q, why in proposals:
        if p in mate or q in mate:               # a same-round earlier commit took one of them
            continue
        if tier == 2:                            # elimination validity can go stale within a round
            av = avail(p)
            if len(av) != 1 or av[0][0] != q:
                continue
        if tier == 1:
            free = [x for x in nodes[pfind(p)] if x not in mate]
            if len(free) != 2:
                continue
        changed |= commit(p, q, why)
    if not changed:
        break

if "--netends" in sys.argv:    # dump the OPEN frontier of the net covering a point
    _ni = sys.argv.index("--netends")
    _nx, _ny = float(sys.argv[_ni + 1]), float(sys.argv[_ni + 2])
    _best = min(((min((x - _nx) ** 2 + (y - _ny) ** 2 for (y, x) in segments[si]["order"][::4]), si)
                 for si in live), default=(None, None))
    _root = nfind(_best[1])
    _members = [si for si in live if nfind(si) == _root]
    _cols = {"/".join(sorted(c)) for c in net_colors[_root]}
    print(f"NET of ({_nx:.0f},{_ny:.0f}): seed seg{_best[1]} root{_root} arcs={len(_members)} colors={_cols or '{}'}")
    for si in _members:
        for k in (0, 1):
            p = (si, k)
            if p in mate or p in at_dot:
                continue
            E = segments[si]["ends"][k]
            print(f"  OPEN seg{si}e{k} at (y{E[0]},x{E[1]}) len={len(segments[si]['order'])} "
                  f"cands={len(cands[p])} avail={len(avail(p))}")

if PROBE is not None:      # post-solve dump: every port near the probe point and why it stands
    for si in live:
        for k in (0, 1):
            E = segments[si]["ends"][k]
            if abs(E[1] - PROBE[0]) > 60 or abs(E[0] - PROBE[1]) > 60:
                continue
            p = (si, k)
            root = nfind(si)
            cols = {"/".join(sorted(c)) for c in net_colors[root]}
            state = ("dot" if p in at_dot else
                     f"mate=seg{mate[p][0]}e{mate[p][1]}" if p in mate else "OPEN")
            print(f"PROBE port seg{si}e{k} (y{E[0]},x{E[1]}) len={len(segments[si]['order'])} "
                  f"net_colors={cols or '{}'} {state}")
            if p not in mate and p not in at_dot:
                for q, sc in sorted(cands[p].items(), key=lambda t: -t[1]):
                    tag = "weak" if (p, q) in weak else "strong"
                    blocked = "" if colors_ok(si, q[0]) else " COLOR-BLOCKED"
                    taken = f" taken-by seg{mate[q][0]}e{mate[q][1]}" if q in mate else ""
                    print(f"    cand seg{q[0]}e{q[1]} {tag} score={sc:.2f}{blocked}{taken}")

# --- ownership: a net is painted with its labels' codes; when several labels share a net the arc
# takes the CLOSEST label's codes (a code printed on a wire always beats one from across the sheet).
net_seeds = defaultdict(list)
for (L, si) in seeds:
    net_seeds[nfind(si)].append(L)
claims = {}                            # arc -> (squared px distance to its claiming label, codes)
for si in live:
    for L in net_seeds.get(nfind(si), ()):
        d = min((x - L["cx"]) ** 2 + (y - L["cy"]) ** 2 for (y, x) in segments[si]["order"][::5])
        if si not in claims or d < claims[si][0]:
            claims[si] = (d, L["code"].split("/"))
painted = len(seeds)
print(f"rejected_in_housing={rej} no_match={nomatch} nets_colored={len(net_seeds)} "
      f"solver_commits={len(mate) // 2}")

if WHO is not None:
    for (L, si) in seeds:
        root = nfind(si)
        if any(nfind(sj) == root and abs(y - WHO[1]) < 25 and abs(x - WHO[0]) < 25
               for sj in live for (y, x) in segments[sj]["order"][::5]):
            print(f"WHO: label {L['code']} at ({L['cx']:.0f},{L['cy']:.0f}) covers ({WHO[0]:.0f},{WHO[1]:.0f})")

if "--deadends" in sys.argv:
    from collections import Counter
    reasons = Counter()
    spots = []
    for si in claims:
        for k in (0, 1):
            p = (si, k)
            if p in mate or p in at_dot:
                continue
            E = segments[si]["ends"][k]
            if dot_near(E[0], E[1]):
                continue
            if in_housing(E[1], E[0], 6):
                reasons["at_housing(ok)"] += 1
                continue
            all_c = cands[p]
            compat = avail(p)
            if not all_c:
                if any(sj in twist for (sj, _kj) in others_at(E, si)):
                    reasons["only_twist_nearby"] += 1; spots.append(("twist", E))
                    continue
                near = any(
                    abs(e[0] - E[0]) <= 26 and abs(e[1] - E[1]) <= 26
                    for tj, t in enumerate(segments) if tj != si for e in t["ends"])
                key = "no_arc<=14px_but_one<=26px" if near else "isolated_end"
                reasons[key] += 1; spots.append((key, E))
            elif not compat:
                reasons["all_neighbours_claimed"] += 1
            else:
                reasons["fork_unresolved"] += 1; spots.append(("fork", E))
    print("DEADEND reasons:", dict(reasons))
    for key, E in spots[:25]:
        print(f"   {key} at (y{E[0]},x{E[1]})")

def _perp_offsets(pts, d):
    p = pts.astype(np.float32)
    tang = np.zeros_like(p)
    tang[1:-1] = p[2:] - p[:-2]; tang[0] = p[1] - p[0]; tang[-1] = p[-1] - p[-2]
    nrm = np.linalg.norm(tang, axis=1, keepdims=True); nrm[nrm == 0] = 1
    tang /= nrm
    perp = np.stack([-tang[:, 1], tang[:, 0]], axis=1)
    return p + d * perp, p - d * perp

def _stroke(out, poly, code, thick):
    pi = poly.astype(np.int32)
    if code == "W":   # white channel: black rail then white core on any-angle curve
        cv2.polylines(out, [pi], False, (0, 0, 0), thick + 2, cv2.LINE_AA)
        cv2.polylines(out, [pi], False, (255, 255, 255), max(1, thick - 2), cv2.LINE_AA)
    else:
        cv2.polylines(out, [pi], False, COLORS[code], thick, cv2.LINE_AA)

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

def extend_to_housing(out, si, k, codes, reach=26):
    """A cable must visually TOUCH its component (connector/sensor/relay/battery pin): if this arc
    end points into a housing within a few px, draw the missing nub up to the housing border."""
    o = segments[si]["order"]
    E = o[0] if k == 0 else o[-1]
    t = deep_tang(si, k, 12)
    for step in range(2, reach):
        py, px = E[0] + t[0] * step, E[1] + t[1] * step
        if in_housing(px, py, 0):
            pts = np.array([[E[1], E[0]], [px, py]], np.float32)
            if len(codes) == 1:
                _stroke(out, pts, codes[0], 7)
            else:
                a, b = _perp_offsets(pts, 3.0)
                _stroke(out, a, codes[0], 4)
                _stroke(out, b, codes[1], 4)
            return

out = img.copy()
# paint every arc with its winning (closest-label) colours
for sj, (_d, codes) in claims.items():
    render_seg(out, segments[sj]["order"], codes)

# ---- DASHED CABLES ------------------------------------------------------------------------------
# "Dashed wires are not included in the main harness" (the heavy battery / starter / alternator
# runs). Being broken lines they never form a continuous skeleton, so the solid-wire solver skips
# them. Colour them in a separate pass: chain collinear dash segments (across the gaps and around
# 90-deg corners) into runs, keep ONLY runs that a colour label sits on -- so the dashed BOUNDARY
# boxes, which carry no code, are never painted -- and stroke each dash a little WIDER, since these
# are thick-gauge cables (kept dashed: each segment is painted, the gaps are left open).
def _dash_shape(si):
    o = segments[si]["order"]; L = len(o)
    if not (10 <= L <= 130):
        return False
    (ya, xa), (yb, xb) = o[0], o[-1]
    chord = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5
    if chord < 8:
        return False
    dev = max(abs((yb - ya) * (x - xa) - (xb - xa) * (y - ya)) for (y, x) in o) / chord
    return dev <= 3.5                                    # a dash is a short straight stroke

_dc = []
for si in range(len(segments)):
    if si in twist or not _dash_shape(si):
        continue
    my, mx = segments[si]["order"][len(segments[si]["order"]) // 2]
    if in_housing(mx, my):
        continue
    _dc.append(si)
_dpar = list(range(len(segments)))
def _dfind(a):
    while _dpar[a] != a:
        _dpar[a] = _dpar[_dpar[a]]; a = _dpar[a]
    return a
_dends = [(si, k, segments[si]["ends"][k]) for si in _dc for k in (0, 1)]
for _i in range(len(_dends)):
    si, ki, Ei = _dends[_i]
    ti = deep_tang(si, ki, 12)
    for _j in range(_i + 1, len(_dends)):
        sj, kj, Ej = _dends[_j]
        if sj == si:
            continue
        vy, vx = Ej[0] - Ei[0], Ej[1] - Ei[1]
        d = (vy * vy + vx * vx) ** 0.5
        if d < 1:
            continue
        uy, ux = vy / d, vx / d
        tj = deep_tang(sj, kj, 12)
        # collinear across a real dash GAP (>=10 px, so solid wires merely cut at a crossing -- gap
        # ~5 px -- are never chained); or two dash ends TOUCHING at a 90-deg corner.
        collinear = 10 <= d <= 90 and (ti[0] * uy + ti[1] * ux > 0.85) and (tj[0] * uy + tj[1] * ux < -0.85)
        corner = d <= 16 and abs(ti[0] * tj[0] + ti[1] * tj[1]) < 0.4
        if collinear or corner:
            ra, rb = _dfind(si), _dfind(sj)
            if ra != rb:
                _dpar[rb] = ra
_dgroups = defaultdict(list)
for si in _dc:
    _dgroups[_dfind(si)].append(si)
_dgroups = {r: m for r, m in _dgroups.items() if len(m) >= 3}     # a regular dash pattern only

# colour a dashed run only if a code label sits ON it (dashed boundary boxes carry no code)
_dclaims = {}
for L in labels:
    if in_housing(L["cx"], L["cy"]):
        continue
    best = None
    for r, m in _dgroups.items():
        for si in m:
            for (y, x) in segments[si]["order"][::4]:
                dd = (x - L["cx"]) ** 2 + (y - L["cy"]) ** 2
                if best is None or dd < best[0]:
                    best = (dd, r)
    if best and best[0] <= 60 ** 2:
        r = best[1]
        if r not in _dclaims or best[0] < _dclaims[r][0]:
            _dclaims[r] = (best[0], L["code"].split("/"))

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

_dash_painted = 0
for r, (_d, codes) in _dclaims.items():
    for si in _dgroups[r]:
        render_dash(out, segments[si]["order"], codes)
    _dash_painted += 1

# Restore the ORIGINAL pixels over every housing, EXPANDED by a small margin, so each cable stops a
# little BEFORE its terminal instead of running onto the connector's pins / outline (user feedback:
# the paint must not follow the connectors). The margin is the visible "stop just before" gap and it
# also erases the wire-colour off any connector edge the tracer briefly rode. (This replaces the old
# extend-to-touch nub, which did the opposite -- it pushed paint INTO the component.)
TERM_GAP = 9
for hx, hy, hw, hh in housings:
    y0, y1 = max(0, hy - TERM_GAP), min(H, hy + hh + TERM_GAP)
    x0, x1 = max(0, hx - TERM_GAP), min(W, hx + hw + TERM_GAP)
    out[y0:y1, x0:x1] = img[y0:y1, x0:x1]
cv2.imwrite(OUT, out)
print(f"labels={len(labels)} painted={painted} | housings={len(housings)} dots={len(dots)} "
      f"segments={len(segments)} dash_cables={_dash_painted} -> {OUT}")
