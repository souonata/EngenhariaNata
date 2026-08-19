"""Component-housing and connector-border detection.

The rectangle detector is extracted from colorize_wiring_prototype.py (lines 206-280) and
keeps the v6 H/V, wide, tall, bigconn and double-bar variants.  Some control units have no
closed rectangle in the raster, however: their outline is interrupted by a dense row of pin
circles.  ``find_dense_pin_border_arcs`` catches those interrupted borders after skeleton
solving so their outlines are never painted as wires.
"""
from __future__ import annotations

from collections import defaultdict

import cv2

K, EPS = 26, 9


def detect_housings(binary, labels, W, H):
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
                # big control-unit connector (PCU / EMS / SDU): a closed rectangle spanning much of
                # the sheet width but relatively flat. Its outline + terminal pins must never be
                # painted, so bypass the single-box size cap (320) that would otherwise reject
                # something this large.
                bigconn = rw >= 0.30 * W and rh <= 0.16 * H
                if min(rw, rh) >= 18 and (max(rw, rh) <= 320 or wide or tall or bigconn):
                    housings.append((min(x0, x1) - 3, min(yc, yb) - 3, rw + 6, rh + 6))
                break
    # double-bar connectors (e.g. CONNECTOR A/B): two long parallel H edges close together -- catch
    # the strip between them so the housing bars are not painted (the single-rectangle test misses
    # these).
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
    return _kept


def make_in_housing(housings):
    def in_housing(px, py, m=0):
        return any(hx - m <= px <= hx + hw + m and hy - m <= py <= hy + hh + m
                   for hx, hy, hw, hh in housings)
    # Geometry consumers sometimes need stable component identity, not only a boolean hit.
    # Function attributes preserve the lightweight predicate API used by existing tests/callers.
    in_housing.housings = tuple(housings)
    return in_housing


def find_dense_pin_border_arcs(segments, claims):
    """Return claimed arcs that form an interrupted connector border or fused pin rims.

    A genuine conductor reaches or crosses an electrical junction.  A connector border has
    a different, highly specific signature: at least four parallel conductors stop at the
    same small distance from a long perpendicular line because pin circles occupy the gap.
    The line is split into arcs between the pins, and each arc can otherwise inherit the
    colour of a neighbouring conductor (pub 2503, ECM4).

    This is deliberately removal-only and symmetric for horizontal and vertical borders.
    Sparse bus bars and ordinary crossings do not qualify: support must contain four aligned
    ports, span at least 120 px, and have pin gaps agreeing within 8 px.
    """

    def _axis_candidates(horizontal):
        borders = []                # (arc, cross coordinate, along start, along end)
        ports = []                  # (along coordinate, cross coordinate)
        furniture = []              # (arc, along start/end, cross start/end)
        for si, segment in enumerate(segments):
            order = segment["order"]
            xs = [p[1] for p in order]
            ys = [p[0] for p in order]
            x0, x1 = min(xs), max(xs)
            y0, y1 = min(ys), max(ys)
            dx, dy = x1 - x0, y1 - y0
            if horizontal:
                along0, along1, cross0, cross1 = x0, x1, y0, y1
                if dx >= 25 and dy <= 12:
                    borders.append((si, (y0 + y1) / 2, x0, x1))
                if dy >= 40 and dx <= 15:
                    ports.extend((ex, ey) for ey, ex in segment["ends"])
            else:
                along0, along1, cross0, cross1 = y0, y1, x0, x1
                if dy >= 25 and dx <= 12:
                    borders.append((si, (x0 + x1) / 2, y0, y1))
                if dx >= 40 and dy <= 15:
                    ports.extend((ey, ex) for ey, ex in segment["ends"])
            if along1 - along0 <= 32 and cross1 - cross0 <= 32:
                furniture.append((si, along0, along1, cross0, cross1))
        return borders, ports, furniture

    guarded = set()
    for horizontal in (True, False):
        borders, ports, furniture = _axis_candidates(horizontal)
        rows = []
        for item in sorted(borders, key=lambda z: (z[1], z[2])):
            _si, cross, lo, hi = item
            for row in rows:
                # Pin symbols and labels can interrupt a module outline for hundreds of px.
                if abs(row["cross"] - cross) <= 4 and lo <= row["hi"] + 480:
                    row["items"].append(item)
                    coords = sorted(q[1] for q in row["items"])
                    row["cross"] = coords[len(coords) // 2]
                    row["lo"] = min(row["lo"], lo)
                    row["hi"] = max(row["hi"], hi)
                    break
            else:
                rows.append({"cross": cross, "lo": lo, "hi": hi, "items": [item]})

        for row in rows:
            if row["hi"] - row["lo"] < 250:
                continue
            for side in (-1, 1):
                candidates = []
                for along, cross in ports:
                    gap = (cross - row["cross"]) * side
                    if row["lo"] - 30 <= along <= row["hi"] + 30 and 10 <= gap <= 30:
                        candidates.append((along, gap))
                # Keep the densest common pin-gap band so a stray endpoint cannot veto an
                # otherwise clean row on a noisy scan.
                support = []
                for _along, gap in candidates:
                    near = [p for p in candidates if abs(p[1] - gap) <= 4]
                    if len(near) > len(support):
                        support = near
                if len(support) < 4:
                    continue
                alo = min(p[0] for p in support)
                ahi = max(p[0] for p in support)
                if ahi - alo < 120:
                    continue
                # Include the short outline lead before the first and after the last pin.
                alo -= 160
                ahi += 160
                for si, _cross, lo, hi in row["items"]:
                    if si in claims and hi >= alo and lo <= ahi:
                        guarded.add(si)
                # A pin circle fused to the outline is not an enclosed background hole.  Its
                # two tiny rim arcs can be claimed and keep the conductor's end "connected",
                # defeating END_GAP (pub 2503: EA93/EA58).  Dense-row evidence makes the
                # corridor between each wire end and the border unambiguously pin furniture.
                for along, gap in support:
                    port_cross = row["cross"] + side * gap
                    c0, c1 = sorted((row["cross"], port_cross))
                    for si, lo, hi, cross0, cross1 in furniture:
                        if si not in claims:
                            continue
                        if abs((lo + hi) / 2 - along) > 18:
                            continue
                        if cross0 >= c0 - 6 and cross1 <= c1 + 6:
                            guarded.add(si)
    return guarded
