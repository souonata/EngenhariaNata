"""Dashed-cable net solver.

"Dashed wires are not included in the main harness" -- the heavy battery / starter /
alternator runs. Being broken lines they never form a continuous skeleton, so the solid-wire
solver skips them. The round-6 pass union-found ANY collinear pair and merged perpendicular
ends as "corners" even at crossings, so where dashed runs cross each other the colours mixed.

This solver mirrors the solid net-solver's principles, all geometry-generic:
  A. PERIODIC collinear continuation: local dash pitch qualifies sparse gaps, and mutual-best
     ends preserve straight continuation at crossings.
  B. TOPOLOGY-AWARE turns: an L is a mutual, unique forward-ray intersection; a T requires
     through-ink on both sides and no ink beyond the terminating branch; a true X stays split.
  C. TERMINAL PROTECTION: inferred corners and branches stop at pins and component housings.
  D. COLOUR CONSTRAINT: nets seeded with different label codes can never merge -- crossing
     runs with different labels stay separate no matter the geometry.
  E. EXPLAINED GAP: a longer collinear gap is allowed only when its periodic phase agrees and
     perpendicular conductor ink explains the missing strokes; component housings still stop it.
Labels: gauged/two-colour labels are strong seeds (constrain merges, win claims); ungauged
codes such as ``R`` or ``SB`` are weak evidence.  A weak code may seed only a supported
periodic train, never constrains topology, and always loses to conflicting strong evidence.
"""
from __future__ import annotations

import math
from collections import defaultdict

from ..instrument import diag
from collections.abc import Mapping
from functools import lru_cache
from statistics import median

def _dash_shape(segments, si, min_points=10):
    o = segments[si]["order"]; L = len(o)
    if not (min_points <= L <= 170):
        return False
    (ya, xa), (yb, xb) = o[0], o[-1]
    chord = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5
    if chord < (8 if min_points >= 10 else 6):
        return False
    dev = max(abs((yb - ya) * (x - xa) - (xb - xa) * (y - ya)) for (y, x) in o) / chord
    if dev > 6.0:                    # a dash is a short near-straight stroke (round 11b: 6, so
        return False                 # a dash nicked by a twist-X curl still counts and the
    #                                  chain can heal around the pair-twist symbols)
    # round 12c: a BANANA is not a dash. dev 6 admits twist-loop arcs (uniformly curved);
    # a real nicked dash keeps its two half-chords aligned, a loop arc bends them apart.
    (ym, xm) = o[L // 2]
    a1 = math.atan2(ym - ya, xm - xa)
    a2 = math.atan2(yb - ym, xb - xm)
    d_ = a2 - a1
    while d_ > math.pi:
        d_ -= 2 * math.pi
    while d_ < -math.pi:
        d_ += 2 * math.pi
    return abs(d_) <= 0.35


def _strong_label(label):
    """Match the page ownership resolver's evidence-strength definition."""
    raw = str(label.get("raw", "")).upper()
    return any(ch.isdigit() for ch in raw) or "/" in str(label.get("code", ""))


def filter_terminal_holes(holes, labels, in_housing, terminal_dots=(),
                          inline_components=(), padding=8):
    """Discard OCR-glyph counters while preserving genuine electrical terminal holes.

    The enclosed white area in a printed ``R``, ``B`` or ``SB`` is geometrically identical to
    a tiny terminal circle.  Any stage that treats every enclosed area as an electrical boundary
    can therefore stop a real wire at its own colour legend.  A recognised legend owns the holes
    inside its page-coordinate box, except when the same point is inside a detected component or
    connector housing, where the electrical interpretation takes precedence.

    This helper is shared by dash topology, solid/dash continuity bridging and the final painter
    so all three stages use the same semantic set of terminal holes.
    """
    def inside_housing(x, y, margin=0):
        try:
            return in_housing(x, y, margin)
        except TypeError:
            return in_housing(x, y)

    label_boxes = []
    for label in labels:
        points = label.get("box", ())
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        if not xs or not ys:
            cx, cy = label.get("cx"), label.get("cy")
            w, h = label.get("w"), label.get("h")
            if None in (cx, cy, w, h):
                continue
            xs = [cx - w / 2, cx + w / 2]
            ys = [cy - h / 2, cy + h / 2]
        label_boxes.append((min(xs) - padding, min(ys) - padding,
                            max(xs) + padding, max(ys) + padding))

    def inside_inline_component(x, y):
        for x1, y1, x2, y2, radius in inline_components:
            dx, dy = x2 - x1, y2 - y1
            denom = dx * dx + dy * dy or 1.0
            t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / denom))
            px, py = x1 + t * dx, y1 + t * dy
            if (x - px) ** 2 + (y - py) ** 2 <= radius ** 2:
                return True
        return False

    terminal_points = tuple((float(x), float(y)) for x, y in terminal_dots)
    filtered = []
    for hole in holes:
        hx, hy = hole[:2]
        typographic = any(x0 <= hx <= x1 and y0 <= hy <= y1
                          for x0, y0, x1, y1 in label_boxes)
        explicit_terminal = any((hx - tx) ** 2 + (hy - ty) ** 2 <= 24 ** 2
                                for tx, ty in terminal_points)
        if typographic and not (inside_housing(hx, hy, 6) or explicit_terminal
                                or inside_inline_component(hx, hy)):
            continue
        filtered.append(hole)
    return filtered


def find_unlabelled_frame_roots(unlabelled, segments):
    """Return unlabelled dash roots that form axis-aligned rectangular frames.

    Optional-system boxes and similar drawing furniture are made from independent dashed
    strokes, so their four sides need not land in one union-find group.  A single side can
    nevertheless touch a coloured solid arc and inherit its colour through the dash/solid
    continuity bridge.  Detect only strong rectangle evidence: two long, parallel horizontal
    roots with matching spans plus long vertical roots covering both ends.  Labelled dash
    groups are deliberately outside this function; precision wins over recovering a doubtful
    unlabelled cable.
    """
    horizontal = {}
    vertical = {}
    for root, members in unlabelled.items():
        pts = [(x, y) for si in members for (y, x) in segments[si]["order"][::3]]
        if not pts:
            continue
        x0 = min(x for x, _y in pts); x1 = max(x for x, _y in pts)
        y0 = min(y for _x, y in pts); y1 = max(y for _x, y in pts)
        width, height = x1 - x0, y1 - y0
        if width >= 180 and height <= 8:
            horizontal[root] = (x0, x1, (y0 + y1) / 2)
        elif height >= 180 and width <= 8:
            vertical[root] = ((x0 + x1) / 2, y0, y1)

    guarded = set()
    hitems = list(horizontal.items())
    for i, (r1, (x01, x11, y1)) in enumerate(hitems):
        for r2, (x02, x12, y2) in hitems[i + 1:]:
            if not (60 <= abs(y2 - y1) <= 900):
                continue
            if abs(x01 - x02) > 35 or abs(x11 - x12) > 35:
                continue
            left_x = (x01 + x02) / 2
            right_x = (x11 + x12) / 2
            lo_y, hi_y = sorted((y1, y2))
            left = [r for r, (x, y0, y3) in vertical.items()
                    if abs(x - left_x) <= 35 and y0 <= lo_y + 35 and y3 >= hi_y - 35]
            right = [r for r, (x, y0, y3) in vertical.items()
                     if abs(x - right_x) <= 35 and y0 <= lo_y + 35 and y3 >= hi_y - 35]
            if left and right:
                guarded.update((r1, r2, left[0], right[0]))
    return guarded


def solve_dashes(segments, twist, labels, in_housing, terminal_dots=(), holes=(),
                 solid_claimed=frozenset(), reserved_labels=(), return_state=False):
    """Returns (dgroups, dclaims, unlabelled) -- painter contract for the first two
    (dgroups: net root -> [dash segment indices]; dclaims: net root -> (d2, codes));
    `unlabelled` holds size-qualified nets with no label, candidates for rescue OCR.

    ``reserved_labels`` lets the page-level ownership resolver keep a label that already has
    a decisive solid-wire attachment out of dashed seeding.  Entries may be the mapping
    objects themselves, ``id(mapping)`` values, or stable ``(raw, cx, cy)`` tuples.  Object
    identity is intentional: two OCR observations with equal text are still independent
    evidence at different places on the sheet.
    """
    def _inside_housing(mx, my, margin=0):
        """Call both the production three-argument predicate and simple test doubles."""
        try:
            return in_housing(mx, my, margin)
        except TypeError:
            return in_housing(mx, my)

    _housing_boxes = tuple(getattr(in_housing, "housings", ()))

    # Enclosed background holes occur both in terminal circles and inside printed glyphs such as
    # R/B.  Use the same semantic filtering later consumed by the bridge and painter.
    terminal_holes = filter_terminal_holes(
        holes, labels, in_housing, terminal_dots=terminal_dots)
    _hole_pts = [(hx, hy) for (hx, hy, _hs) in terminal_holes]
    _pin_pts = [(dx, dy) for (dx, dy) in terminal_dots] + _hole_pts
    _pin_idx = {}
    for (px_, py_) in _pin_pts:
        _pin_idx.setdefault((int(px_) // 64, int(py_) // 64), []).append((px_, py_))

    def _at_pin(mx, my):
        cx, cy = int(mx) // 64, int(my) // 64
        for dxc in (-1, 0, 1):
            for dyc in (-1, 0, 1):
                for (px_, py_) in _pin_idx.get((cx + dxc, cy + dyc), []):
                    if abs(px_ - mx) <= 40 and abs(py_ - my) <= 40:
                        return True
        return False

    # A lone enclosed hole can still be an unread R/B glyph.  For short-wire boundary evidence,
    # trust overview terminal ticks plus compact clusters of two or more holes (terminal circles,
    # switch contacts, ground symbols), never a single uncorroborated hole.
    _hard_pin_pts = [(float(dx), float(dy)) for dx, dy in terminal_dots]
    for i, (hx, hy) in enumerate(_hole_pts):
        if any(4 <= ((hx - ox) ** 2 + (hy - oy) ** 2) ** 0.5 <= 36
               for j, (ox, oy) in enumerate(_hole_pts) if i != j):
            _hard_pin_pts.append((hx, hy))
    _hp_parent = list(range(len(_hard_pin_pts)))

    def _hp_find(i):
        while _hp_parent[i] != i:
            _hp_parent[i] = _hp_parent[_hp_parent[i]]
            i = _hp_parent[i]
        return i

    def _hp_union(i, j):
        ri, rj = _hp_find(i), _hp_find(j)
        if ri != rj:
            _hp_parent[rj] = ri

    for i, (px_, py_) in enumerate(_hard_pin_pts):
        for j in range(i):
            ox, oy = _hard_pin_pts[j]
            if math.hypot(px_ - ox, py_ - oy) <= 44:
                _hp_union(i, j)
    _hp_groups = {}
    for i, point in enumerate(_hard_pin_pts):
        _hp_groups.setdefault(_hp_find(i), []).append(point)
    _hard_pin_clusters = list(_hp_groups.values())
    _hard_pin_anchors = [
        (sum(x for x, _y in cluster) / len(cluster),
         sum(y for _x, y in cluster) / len(cluster))
        for cluster in _hard_pin_clusters
    ]
    _hard_pin_idx = {}
    for anchor_id, (px_, py_) in enumerate(_hard_pin_anchors):
        _hard_pin_idx.setdefault((int(px_) // 96, int(py_) // 96), []).append(
            (anchor_id, px_, py_))

    def _hard_pin_anchor(mx, my, tx, ty, reach=96):
        cx, cy = int(mx) // 96, int(my) // 96
        cells = max(1, int(math.ceil(reach / 96)))
        candidates = []
        for dxc in range(-cells, cells + 1):
            for dyc in range(-cells, cells + 1):
                for anchor_id, px_, py_ in _hard_pin_idx.get((cx + dxc, cy + dyc), ()):
                    dx, dy = px_ - mx, py_ - my
                    distance = math.hypot(dx, dy)
                    if distance <= reach and (distance <= 3 or (dx * tx + dy * ty) / distance >= 0.45):
                        candidates.append((distance, ("pin", anchor_id), px_, py_))
        return min(candidates, key=lambda item: item[0]) if candidates else None

    def _housing_anchor(mx, my, tx, ty, reach=96):
        # A component must lie on the endpoint's outward ray.  A large symmetric margin around
        # the endpoint would let both ends of a short glyph/tick route cite the same nearby box.
        for distance in range(0, reach + 1, 6):
            px_, py_ = mx + tx * distance, my + ty * distance
            if _housing_boxes:
                for housing_id, (hx, hy, hw, hh) in enumerate(_housing_boxes):
                    if hx - 3 <= px_ <= hx + hw + 3 and hy - 3 <= py_ <= hy + hh + 3:
                        return float(distance), ("housing", housing_id), px_, py_
            elif _inside_housing(px_, py_, 3):
                # Stable enough for simple predicate test doubles; production predicates expose
                # their exact rectangle list through ``make_in_housing`` above.
                return (float(distance),
                        ("housing-ray", round(px_ / 24), round(py_ / 24)), px_, py_)
        return None

    def _housing_corridor_blocked(x0, y0, x1, y1, margin=2):
        distance = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        steps = max(1, int(distance // 10))
        return any(_inside_housing(
            x0 + (x1 - x0) * step / steps,
            y0 + (y1 - y0) * step / steps,
            margin,
        ) for step in range(steps + 1))

    _reserved_object_ids = set()
    _reserved_numeric_ids = set()
    _reserved_keys = set()
    for _reserved in reserved_labels or ():
        if isinstance(_reserved, Mapping):
            _reserved_object_ids.add(id(_reserved))
        elif isinstance(_reserved, int):
            _reserved_numeric_ids.add(_reserved)
        elif isinstance(_reserved, tuple) and len(_reserved) == 3:
            _reserved_keys.add(_reserved)

    def _label_is_reserved(label):
        if id(label) in _reserved_object_ids or id(label) in _reserved_numeric_ids:
            reserved = True
        else:
            key = (label.get("raw"), label.get("cx"), label.get("cy"))
            reserved = key in _reserved_keys
        if reserved:
            # Cross-representation reservation is invisible in every counter, yet it can remove
            # the only legend a dashed cable has.  Record it so the decision is auditable.
            diag().record("reservation", raw=str(label.get("raw", "")),
                          code=label.get("code"), cx=label.get("cx"), cy=label.get("cy"),
                          provenance=label.get("_provenance", "overview"),
                          channel=label.get("_channel"))
        return reserved

    # round 12c: dash strokes touching a twist symbol are its arms, never cable
    _twb = {}
    for _tsi in twist:
        for (_ty, _tx) in segments[_tsi]["order"][::2]:
            _twb.setdefault((int(_ty) // 16, int(_tx) // 16), []).append((_ty, _tx))

    def _near_twist(mx, my):
        for _dyc in (-1, 0, 1):
            for _dxc in (-1, 0, 1):
                for (_ty, _tx) in _twb.get((int(my) // 16 + _dyc, int(mx) // 16 + _dxc), []):
                    if abs(_ty - my) <= 12 and abs(_tx - mx) <= 12:
                        return True
        return False

    dash, at_pin = [], set()
    for si in range(len(segments)):
        if si in twist or not _dash_shape(segments, si):
            continue
        # round 12: a segment the SOLID solver already claimed is a traced wire, never a
        # dash -- twisted-pair wires cut into dash-length pieces by their X symbols were
        # re-chained ACROSS the pair here and double-painted W/SB over the W wire.
        if si in solid_claimed:
            continue
        o0 = segments[si]["order"]
        _my0, _mx0 = o0[len(o0) // 2]
        if _near_twist(_mx0, _my0):
            continue
        o = segments[si]["order"]
        my, mx = o[len(o) // 2]
        if _inside_housing(mx, my):
            continue
        # rounds 11b/11e: a dash-shaped stroke sitting AT a terminal tick OR a pin symbol
        # (diamond / pin circle -- small enclosed holes) is connector/pin furniture. It must
        # never be PAINTED -- but it still CHAINS: a fuse-pin stub is the only link between
        # the run above a fuse and the run below it, and dropping it split the net so the
        # label could not cover the far side.
        if _at_pin(mx, my):
            at_pin.add(si)
        dash.append(si)

    # Some light-gray CAD dashes skeletonize to only 8-9 pixels.  Admitting every such stroke
    # would turn glyph fragments and component ticks into cable ink, so recover one only when it
    # lies on a confirmed collinear train with accepted dash strokes on both sides.  The support
    # check is iterative: once a missing phase member is restored it can support its neighbour,
    # but every accepted chain remains anchored by the normal 10+ pixel detector.
    short = []
    dash_set = set(dash)
    for si in range(len(segments)):
        if si in dash_set or si in twist or si in solid_claimed \
                or not _dash_shape(segments, si, min_points=8):
            continue
        o = segments[si]["order"]
        my, mx = o[len(o) // 2]
        if _near_twist(mx, my) or _inside_housing(mx, my):
            continue
        short.append(si)

    for _round in range(4):
        added = []
        for si in short:
            if si in dash_set:
                continue
            (ya, xa), (yb, xb) = segments[si]["ends"]
            cy, cx = (ya + yb) / 2, (xa + xb) / 2
            length = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5 or 1.0
            uy, ux = (yb - ya) / length, (xb - xa) / length
            sides = set()
            support_positions = []
            strong_support = 0
            for sj in dash + short:
                if sj == si:
                    continue
                (y0, x0), (y1, x1) = segments[sj]["ends"]
                length2 = ((y1 - y0) ** 2 + (x1 - x0) ** 2) ** 0.5 or 1.0
                uy2, ux2 = (y1 - y0) / length2, (x1 - x0) / length2
                if abs(uy * uy2 + ux * ux2) < 0.97:
                    continue
                cy2, cx2 = (y0 + y1) / 2, (x0 + x1) / 2
                vy, vx = cy2 - cy, cx2 - cx
                lateral = abs(vy * ux - vx * uy)
                along = vy * uy + vx * ux
                if lateral <= 5 and 10 <= abs(along) <= 180:
                    support_positions.append(along)
                    if sj in dash_set:
                        strong_support += 1
                    sides.add(1 if along > 0 else -1)
            two_sided_anchors = strong_support >= 2 and len(sides) == 2
            periodic_anchor = False
            if strong_support >= 1 and len(support_positions) >= 3:
                positions = sorted(support_positions + [0.0])
                gaps = [b - a for a, b in zip(positions, positions[1:])
                        if 10 <= b - a <= 100]
                if len(gaps) >= 2:
                    pitch = median(gaps)
                    consistent = [gap for gap in gaps
                                  if abs(gap - pitch) <= max(8.0, 0.35 * pitch)]
                    periodic_anchor = len(consistent) >= 2 \
                        and positions[-1] - positions[0] >= 70
            if two_sided_anchors or periodic_anchor:
                added.append(si)
        if not added:
            break
        for si in added:
            dash.append(si); dash_set.add(si)
            o = segments[si]["order"]
            my, mx = o[len(o) // 2]
            if _at_pin(mx, my):
                at_pin.add(si)
    if not dash:
        empty = ({}, {}, {}, {})
        if return_state:
            return (*empty, {"live": [], "mate": {}, "connected_ports": set(),
                             "seeds": [], "groups": {}, "nfind": lambda si: si,
                             "at_pin": set(), "boundary_bounded_short": set(),
                             "node_port_anchors": {}})
        return empty

    # --- union-find with per-net colour sets (the solid solver's merge constraint) ----------
    par = {si: si for si in dash}

    def find(a):
        while par[a] != a:
            par[a] = par[par[a]]; a = par[a]
        return a

    ncol = defaultdict(set)

    def colors_ok(a, b):
        ca, cb = ncol[find(a)], ncol[find(b)]
        return not ca or not cb or bool(ca & cb)

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            par[rb] = ra
            ncol[ra] |= ncol.pop(rb, set())

    # --- label seeding (before any merge: colours must prune wrong joins at crossings).
    # Round 11e: ambiguous labels use the SAME tie-breaks as the solid solver -- colour
    # compatibility first (a run never carries two codes: the ENGINE-fuse '2.5 R' must not
    # pile onto the already-seeded EVC column), then nearest. Two passes so unambiguous
    # labels commit their colours before the ambiguous ones choose.
    # Candidate tuple: (score, segment, raw d2, signed label->wire offset,
    #                   vertical?, quantized physical line id).
    _cands = []
    for L in labels:
        if _label_is_reserved(L) or _inside_housing(L["cx"], L["cy"]):
            continue
        raw = str(L.get("raw", "")).strip().upper()
        bare = not _strong_label(L)
        near_housing = bare and _inside_housing(L["cx"], L["cy"], 60)
        maxd = max(70, 0.9 * max(L["w"], L["h"]))
        # A single glyph's OCR box is often taller even when the legend belongs to a horizontal
        # route.  Treat its orientation as unknown and let periodic route support decide.
        compact_raw = "".join(ch for ch in raw if ch.isalpha())
        if bare and len(compact_raw) <= 1:
            want_v = None
        elif max(L["w"], L["h"]) >= 1.5 * max(1, min(L["w"], L["h"])):
            want_v = L["h"] > L["w"]
        else:
            want_v = None if bare else L["h"] > L["w"]
        per_line = {}
        line_support = defaultdict(list)
        for si in dash:
            (ya, xa), (yb, xb) = segments[si]["ends"]
            vertical = abs(yb - ya) >= abs(xb - xa)
            # round 11e: a dash label sits BESIDE its run, often over a GAP between dashes --
            # so measure the PERPENDICULAR distance to the dash's axis (with a 60 px axial
            # allowance past its ends), not the distance to the nearest ink point. The
            # ENGINE-fuse '2.5 R' is 25 px off its own column but 53 px off the neighbour;
            # nearest-ink said the opposite because the label erase cuts its own run there.
            ax, ay = xb - xa, yb - ya
            n2 = ax * ax + ay * ay or 1.0
            t = ((L["cx"] - xa) * ax + (L["cy"] - ya) * ay) / n2
            px_, py_ = xa + t * ax, ya + t * ay
            perp2 = (L["cx"] - px_) ** 2 + (L["cy"] - py_) ** 2
            over = max(0.0, -t, t - 1.0) * (n2 ** 0.5)
            d = perp2 + max(0.0, over - 60.0) ** 2
            if d > (maxd * 2.5) ** 2:
                continue
            if near_housing and _housing_corridor_blocked(
                    L["cx"], L["cy"], px_, py_):
                continue
            sc = d + (0 if want_v is None or vertical == want_v else 250 ** 2)
            axis_coord = (xa + xb) / 2 if vertical else (ya + yb) / 2
            off = axis_coord - (L["cx"] if vertical else L["cy"])
            line = (vertical, round(axis_coord / 8))
            candidate = (sc, si, d, off, vertical, line)
            centre = (ya + yb) / 2 if vertical else (xa + xb) / 2
            line_support[line].append((si, centre))
            if line not in per_line or sc < per_line[line][0]:
                per_line[line] = candidate
        ranked = sorted(per_line.values())
        ranked = [c for c in ranked if c[2] <= maxd * maxd]
        if bare:
            supported_lines = set()
            for line, members in line_support.items():
                centres = sorted({round(centre, 2) for _si, centre in members})
                if len(centres) < 3:
                    continue
                gaps = [b - a for a, b in zip(centres, centres[1:]) if 8 <= b - a <= 160]
                if len(gaps) < 2:
                    continue
                pitch = median(gaps)
                consistent = [gap for gap in gaps
                              if abs(gap - pitch) <= max(8.0, 0.35 * pitch)]
                vertical = line[0]
                label_pos = L["cy"] if vertical else L["cx"]
                label_radius = (L["h"] if vertical else L["w"]) * 0.4
                two_sided = any(pos < label_pos - label_radius for pos in centres) \
                    and any(pos > label_pos + label_radius for pos in centres)
                if len(consistent) >= 2 and two_sided:
                    supported_lines.add(line)
            ranked = [candidate for candidate in ranked if candidate[5] in supported_lines]
            # A code close to a component is accepted only when one route is geometrically
            # decisive; otherwise it remains a possible pin/designator and is quarantined.
            if near_housing and len(ranked) > 1:
                d0 = ranked[0][2] ** 0.5
                if ranked[1][2] ** 0.5 <= max(d0 * 1.5, d0 + 18):
                    ranked = []
        if ranked:
            _cands.append((L, bare, ranked, maxd, want_v))

    seeds = []                       # (label, dash segment, bare?, raw d2)

    def _constrains_topology(label):
        """Only page-level evidence, or this representation's own lens, may SPLIT a route.

        Round 16: a colour observed through ANOTHER representation's zoom lens is legitimate
        claim evidence, but it must never act as a topology constraint here.  The solid scene's
        contextual reads are appended to the shared page label list, so one foreign crop token
        landing beside a dashed cable seeded ``ncol`` and made ``colors_ok`` veto a perfectly
        periodic straight mate -- silently cutting the physical conductor in two (pub 2503 lost
        the junction-box half of 70 SB and the starter half of 70 R at ordinary in-rhythm gaps).
        Claiming stays unchanged; only the power to refuse a merge is withheld.
        """
        channel = label.get("_channel")
        return channel is None or channel == "dash"

    def _dash_seed(L, si, bare, d2):
        (ya, xa), (yb, xb) = segments[si]["ends"]
        L.setdefault("_wire_axis", "v" if abs(yb - ya) >= abs(xb - xa) else "h")
        seeds.append((L, si, bare, d2))
        if not bare and _constrains_topology(L):
            ncol[find(si)].add(frozenset(L["code"].split("/")))

    # Parallel labels are a small assignment problem, not independent nearest-neighbour
    # decisions.  When two legends share candidate lines in the same axial neighbourhood,
    # choose the minimum-total-distance one-to-one mapping.  This recovers the common layout
    # where every legend is printed to the same side of its conductor and one label is actually
    # a few pixels nearer the neighbouring line (pub2503: adjacent 25 SB / 25 R columns).
    plausible = {}
    for i, (_L, _bare, ranked, _maxd, want_v) in enumerate(_cands):
        d0 = ranked[0][2] ** 0.5
        same_axis = [c for c in ranked
                     if (want_v is None or c[4] == want_v)
                     and c[2] ** 0.5 <= 1.8 * max(d0, 1.0)]
        plausible[i] = same_axis or [ranked[0]]

    adjacency = {i: set() for i in range(len(_cands))}
    for i, (Li, _bi, _ri, _mi, vi) in enumerate(_cands):
        lines_i = {c[5] for c in plausible[i]}
        for j in range(i + 1, len(_cands)):
            Lj, _bj, _rj, _mj, vj = _cands[j]
            common_lines = lines_i & {c[5] for c in plausible[j]}
            same_neighbourhood = any(
                abs((Li["cy"] if vertical else Li["cx"])
                    - (Lj["cy"] if vertical else Lj["cx"])) <= 220
                for vertical, _axis_bin in common_lines
            )
            if common_lines and same_neighbourhood:
                adjacency[i].add(j); adjacency[j].add(i)

    preassigned = {}
    unseen = set(adjacency)
    while unseen:
        start = unseen.pop()
        component = {start}
        stack = [start]
        while stack:
            here = stack.pop()
            for other in adjacency[here] & unseen:
                unseen.remove(other); component.add(other); stack.append(other)
        if len(component) < 2 or len(component) > 8:
            continue
        order = sorted(component, key=lambda i: len(plausible[i]))
        line_ids = {c[5] for i in order for c in plausible[i]}
        if len(line_ids) < len(order):
            continue
        line_number = {line: n for n, line in enumerate(sorted(line_ids))}

        @lru_cache(maxsize=None)
        def assign(pos, used):
            if pos == len(order):
                return 0.0, ()
            best = None
            for candidate in plausible[order[pos]]:
                bit = 1 << line_number[candidate[5]]
                if used & bit:
                    continue
                tail = assign(pos + 1, used | bit)
                if tail is None:
                    continue
                option = (candidate[0] + tail[0], (candidate,) + tail[1])
                if best is None or option[0] < best[0]:
                    best = option
            return best

        chosen = assign(0, 0)
        if chosen is not None:
            for i, candidate in zip(order, chosen[1]):
                preassigned[i] = candidate

    _off_v, _off_h = [], []
    for i, candidate in sorted(preassigned.items()):
        L, bare, _ranked, _maxd, _want_v = _cands[i]
        _sc, si, d2, off, vertical, _line = candidate
        _dash_seed(L, si, bare, d2)
        if abs(off) >= 8:
            (_off_v if vertical else _off_h).append(off)

    _ambig = []
    for i, (L, bare, ranked, maxd, want_v) in enumerate(_cands):
        if i in preassigned:
            continue
        d0 = ranked[0][2] ** 0.5
        rivals = [c for c in ranked[1:] if c[2] ** 0.5 <= 1.8 * d0]
        if not rivals:
            _dash_seed(L, ranked[0][1], bare, ranked[0][2])
            off, vertical = ranked[0][3], ranked[0][4]
            if abs(off) >= 8:
                (_off_v if vertical else _off_h).append(off)
        else:
            _ambig.append((L, bare, ranked, d0, want_v))

    def _median(values):
        return sorted(values)[len(values) // 2] if values else 0

    side_median = {True: _median(_off_v), False: _median(_off_h)}
    side_count = {True: len(_off_v), False: len(_off_h)}
    _ambig.sort(key=lambda t: t[3])
    for (L, bare, ranked, d0, want_v) in _ambig:
        want = frozenset(L["code"].split("/"))

        def _key(c):
            _sc, si, _d, off, vertical, _line = c
            cols = ncol[find(si)]
            compat = (not cols) or want in cols
            side_known = want_v is not None and vertical == want_v \
                and side_count[vertical] >= 3 \
                and abs(side_median[vertical]) >= 8
            side_ok = side_known and (off > 0) == (side_median[vertical] > 0)
            return (0 if compat else 1, 0 if side_ok else 1, _sc)

        elig = [c for c in ranked if c[2] ** 0.5 <= 1.8 * d0]
        pick = min(elig, key=_key) if elig else ranked[0]
        _dash_seed(L, pick[1], bare, pick[2])

    # --- local dash rhythm -----------------------------------------------------------------
    # A cable is a periodic train, not an arbitrary collection of collinear stubs.  Estimate
    # the centre-to-centre pitch from three-or-more locally aligned strokes.  End strokes then
    # inherit the train's pitch, allowing a genuinely sparse rhythm while refusing the old
    # blind 230 px jump between unrelated battery/terminal stubs.
    geom = {}
    centre_idx = defaultdict(set)
    for si in dash:
        (ya, xa), (yb, xb) = segments[si]["ends"]
        length = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5 or 1.0
        uy, ux = (yb - ya) / length, (xb - xa) / length
        if ux < 0 or (abs(ux) < 1e-6 and uy < 0):
            uy, ux = -uy, -ux
        cy_, cx_ = (ya + yb) / 2, (xa + xb) / 2
        geom[si] = (cy_, cx_, uy, ux, length)
        centre_idx[(int(cy_) // 160, int(cx_) // 160)].add(si)

    nearest = defaultdict(dict)     # segment -> {-1/+1: (centre distance, neighbour)}
    for si in dash:
        cy_, cx_, uy, ux, _length = geom[si]
        by, bx = int(cy_) // 160, int(cx_) // 160
        seen = set()
        for dyc in (-1, 0, 1):
            for dxc in (-1, 0, 1):
                for sj in centre_idx.get((by + dyc, bx + dxc), ()):
                    if sj == si or sj in seen:
                        continue
                    seen.add(sj)
                    cy2, cx2, uy2, ux2, _length2 = geom[sj]
                    if abs(uy * uy2 + ux * ux2) < 0.96:
                        continue
                    vy, vx = cy2 - cy_, cx2 - cx_
                    along = vy * uy + vx * ux
                    lateral = abs(vy * ux - vx * uy)
                    spacing = abs(along)
                    if lateral > 9 or not (8 <= spacing <= 160):
                        continue
                    side = 1 if along > 0 else -1
                    if side not in nearest[si] or spacing < nearest[si][side][0]:
                        nearest[si][side] = (spacing, sj)

    rhythm_par = {si: si for si in dash}

    def _rhythm_find(si):
        while rhythm_par[si] != si:
            rhythm_par[si] = rhythm_par[rhythm_par[si]]
            si = rhythm_par[si]
        return si

    rhythm_edges = {}
    for si, sides in nearest.items():
        for spacing, sj in sides.values():
            edge = tuple(sorted((si, sj)))
            rhythm_edges[edge] = min(spacing, rhythm_edges.get(edge, float("inf")))
            ra, rb = _rhythm_find(si), _rhythm_find(sj)
            if ra != rb:
                rhythm_par[rb] = ra
    rhythm_members = defaultdict(set)
    rhythm_spacings = defaultdict(list)
    for si in dash:
        rhythm_members[_rhythm_find(si)].add(si)
    for (si, _sj), spacing in rhythm_edges.items():
        rhythm_spacings[_rhythm_find(si)].append(spacing)

    local_pitch = {}
    for rr, members in rhythm_members.items():
        samples = rhythm_spacings.get(rr, ())
        if len(members) < 3 or len(samples) < 2:
            continue
        pitch = median(samples)
        consistent = [v for v in samples if abs(v - pitch) <= max(8, 0.35 * pitch)]
        if len(consistent) < 2:
            continue
        pitch = median(consistent)
        for si in members:
            local_pitch[si] = pitch
    pitch_segments = frozenset(local_pitch)

    def _rhythm_group(si):
        return rhythm_members.get(_rhythm_find(si), {si})

    @lru_cache(maxsize=None)
    def _rhythm_boundary_ids(si):
        """Hard endpoints backing a short periodic fragment near a component.

        A crossing can consume the only dash between a terminal and the crossing.  Such a
        one- or two-stroke side has no statistically stable pitch of its own, but a distinct
        component/terminal at its remote end is still strong physical-wire evidence.
        """
        identities = set()
        for member in _rhythm_group(si):
            (ya, xa), (yb, xb) = segments[member]["ends"]
            length = math.hypot(yb - ya, xb - xa) or 1.0
            for k, (y, x) in enumerate(((ya, xa), (yb, xb))):
                sign = -1.0 if k == 0 else 1.0
                ty = sign * (yb - ya) / length
                tx = sign * (xb - xa) / length
                candidates = []
                housing = _housing_anchor(x, y, tx, ty)
                if housing is not None:
                    candidates.append(housing)
                hard_pin = _hard_pin_anchor(x, y, tx, ty)
                if hard_pin is not None:
                    candidates.append(hard_pin)
                if candidates:
                    identities.add(min(candidates, key=lambda item: item[0])[1])
        return identities

    # --- candidate edges between dash ENDS --------------------------------------------------
    # Outward direction is the chord: a 10-20 px skeleton fragment has a noisy deep tangent,
    # whereas dash strokes are straight by construction.
    E = []
    for si in dash:
        (ya, xa), (yb, xb) = segments[si]["ends"]
        n = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5 or 1.0
        for k in (0, 1):
            sgn = 1.0 if k == 1 else -1.0
            E.append((si, k, segments[si]["ends"][k],
                      (sgn * (yb - ya) / n, sgn * (xb - xa) / n)))
    endpoint_by_port = {(si, k): (y, x, ty, tx) for si, k, (y, x), (ty, tx) in E}
    idx = defaultdict(list)
    for i, (_si, _k, (y, x), _t) in enumerate(E):
        idx[(int(y) // 80, int(x) // 80)].append(i)

    def _protected_join(x, y):
        return _at_pin(x, y) or _inside_housing(x, y, 12)

    def _cross(ay, ax, by, bx):
        return ay * bx - ax * by

    # Long missing portions of an otherwise periodic dash train are legitimate only when the
    # drawing itself explains the loss: one or more perpendicular conductors cross the straight
    # corridor and fragment/absorb the dashed strokes during skeletonization.  Pre-compute only
    # substantive straight chords; text specks cannot vouch for a continuation.
    crossing_chords = []
    for sk, segment in enumerate(segments):
        (y0, x0), (y1, x1) = segment["ends"]
        length = ((y1 - y0) ** 2 + (x1 - x0) ** 2) ** 0.5
        if length < 40:
            continue
        # A long glyph stroke or a curved symbol is not evidence of another conductor.  Solid
        # drawing wires are straight between topology nodes, so require the sampled skeleton to
        # stay in a narrow corridor around its endpoint chord.
        deviation = max(
            abs((y1 - y0) * (px - x0) - (x1 - x0) * (py - y0)) / length
            for py, px in segment["order"][::max(1, len(segment["order"]) // 24)]
        )
        if deviation > 4.0:
            continue
        crossing_chords.append((sk, y0, x0, y1, x1,
                                (y1 - y0) / length, (x1 - x0) / length, length))

    def _corridor_points_blocked(ya, xa, yb, xb):
        distance = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5
        steps = max(1, int(distance // 10))
        for step in range(steps + 1):
            x = xa + (xb - xa) * step / steps
            y = ya + (yb - ya) * step / steps
            if _inside_housing(x, y, 12) or _at_pin(x, y):
                return True
        return False

    def _corridor_blocked(p, q):
        ya, xa, _tya, _txa = endpoint_by_port[p]
        yb, xb, _tyb, _txb = endpoint_by_port[q]
        return _corridor_points_blocked(ya, xa, yb, xb)

    def _periodic_crossing_gap(si, sj, p, q, d):
        if d > 600:
            return False
        pitches = [local_pitch[s] for s in (si, sj) if s in local_pitch]
        if not pitches:
            return False
        # Normally both sides independently establish the dash rhythm.  Near a component, the
        # crossing may consume enough ink that the terminal side retains only one or two strokes.
        # Admit that asymmetric case only when the short rhythm group has a hard remote boundary;
        # it can therefore never be an isolated glyph attracted to a real cable.
        if len(pitches) == 1:
            short_side = sj if si in local_pitch else si
            if not _rhythm_boundary_ids(short_side):
                return False
        pitch = median(pitches)
        centre_spacing = d + (geom[si][4] + geom[sj][4]) / 2
        periods = max(1, round(centre_spacing / pitch))
        if periods < 2 or abs(centre_spacing - periods * pitch) > max(12.0, 0.45 * pitch):
            return False
        if len(pitches) == 1 and d > min(260.0, 4.0 * pitch):
            return False
        ya, xa, _tya, _txa = endpoint_by_port[p]
        yb, xb, _tyb, _txb = endpoint_by_port[q]
        if _corridor_blocked(p, q):
            return False
        vy, vx = yb - ya, xb - xa
        required_crossing_length = min(100.0, max(40.0, 0.18 * d))
        for sk, y0, x0, y1, x1, uy, ux, chord_length in crossing_chords:
            if chord_length < required_crossing_length:
                continue
            if sk in (si, sj) or abs((vy / d) * uy + (vx / d) * ux) > 0.35:
                continue
            sy, sx = y1 - y0, x1 - x0
            den = _cross(vy, vx, sy, sx)
            if abs(den) < 1e-6:
                continue
            wy, wx = y0 - ya, x0 - xa
            t = _cross(wy, wx, sy, sx) / den
            u = _cross(wy, wx, vy, vx) / den
            if 0.04 <= t <= 0.96 and -0.05 <= u <= 1.05:
                return True

        # Heavy external conductors often CROSS another dashed conductor.  No individual
        # perpendicular stroke is long enough to enter ``crossing_chords`` above, even though
        # the periodic axis is plainly present on both sides of the crossing.  Reconstruct that
        # axis from its page-global dash train; a one-sided branch is deliberately insufficient.
        gap_y, gap_x = vy / d, vx / d
        crossing_candidates = set()
        sample_count = max(1, int(d // 80))
        for step in range(sample_count + 1):
            sy = ya + vy * step / sample_count
            sx = xa + vx * step / sample_count
            by, bx = int(sy) // 160, int(sx) // 160
            for dyc in (-1, 0, 1):
                for dxc in (-1, 0, 1):
                    crossing_candidates.update(centre_idx.get((by + dyc, bx + dxc), ()))
        for sk in crossing_candidates:
            if sk in (si, sj):
                continue
            cy, cx, uy, ux, _length = geom[sk]
            if abs(gap_y * uy + gap_x * ux) > 0.35:
                continue
            den = _cross(vy, vx, uy, ux)
            if abs(den) < 1e-6:
                continue
            wy, wx = cy - ya, cx - xa
            t = _cross(wy, wx, uy, ux) / den
            if not (0.04 <= t <= 0.96):
                continue
            hy, hx = ya + t * vy, xa + t * vx
            negative_members = set()
            positive_members = set()
            nearby_members = set()
            by, bx = int(hy) // 160, int(hx) // 160
            for dyc in range(-2, 3):
                for dxc in range(-2, 3):
                    nearby_members.update(centre_idx.get((by + dyc, bx + dxc), ()))
            for member in nearby_members:
                _mcy, _mcx, muy, mux, _mlength = geom[member]
                if abs(uy * muy + ux * mux) < 0.94:
                    continue
                (my0, mx0), (my1, mx1) = segments[member]["ends"]
                lateral = min(
                    abs((my0 - hy) * ux - (mx0 - hx) * uy),
                    abs((my1 - hy) * ux - (mx1 - hx) * uy),
                )
                if lateral > 11:
                    continue
                a0 = (my0 - hy) * uy + (mx0 - hx) * ux
                a1 = (my1 - hy) * uy + (mx1 - hx) * ux
                lo, hi = sorted((a0, a1))
                if lo < -3 and hi >= -180:
                    negative_members.add(member)
                if hi > 3 and lo <= 180:
                    positive_members.add(member)
            if negative_members and positive_members:
                # A lone glyph/tick crossing the hub is not a page-global dashed axis.  Demand
                # either distinct strokes on the two sides or a straddling stroke that itself
                # belongs to a confirmed periodic train.
                if any(left != right
                       for left in negative_members for right in positive_members) \
                        or bool((negative_members & positive_members) & pitch_segments):
                    return True
        return False

    def _strong_label_gap(si, sj, p, q, d):
        """A complete legend may explain several missing dash phases on its own wire.

        OCR/text knockout deliberately removes the full legend rectangle from conductor ink.
        The two surviving sides are joined only when the legend was strongly parsed, was seeded
        onto this exact physical line, lies axially inside the gap, and both sides have independent
        route evidence (periodicity and/or distinct hard component endpoints).
        """
        ya, xa, _tya, _txa = endpoint_by_port[p]
        yb, xb, _tyb, _txb = endpoint_by_port[q]
        gap_y, gap_x = (yb - ya) / d, (xb - xa) / d
        boundary_i = _rhythm_boundary_ids(si)
        boundary_j = _rhythm_boundary_ids(sj)
        route_supported = (
            (si in local_pitch and sj in local_pitch)
            or (si in local_pitch and bool(boundary_j))
            or (sj in local_pitch and bool(boundary_i))
            or any(left != right for left in boundary_i for right in boundary_j)
        )
        if not route_supported:
            return False

        for label, home, bare, _d2 in seeds:
            if bare or home not in geom:
                continue
            hcy, hcx, huy, hux, _hlen = geom[home]
            if abs(gap_y * huy + gap_x * hux) < 0.96:
                continue
            # The seed's own dash establishes the physical line identity.  This prevents a
            # nearby parallel label from vouching for the wrong conductor.
            if max(
                abs((ya - hcy) * hux - (xa - hcx) * huy),
                abs((yb - hcy) * hux - (xb - hcx) * huy),
            ) > 14:
                continue
            along = (label["cy"] - ya) * gap_y + (label["cx"] - xa) * gap_x
            if not (0 <= along <= d):
                continue
            points = label.get("box") or ()
            if not points:
                half_w = float(label.get("w", 0)) / 2
                half_h = float(label.get("h", 0)) / 2
                points = (
                    (label["cx"] - half_w, label["cy"] - half_h),
                    (label["cx"] + half_w, label["cy"] - half_h),
                    (label["cx"] + half_w, label["cy"] + half_h),
                    (label["cx"] - half_w, label["cy"] + half_h),
                )
            projected = [
                (py - ya) * gap_y + (px - xa) * gap_x for px, py in points
            ]
            normal = [
                (py - hcy) * hux - (px - hcx) * huy for px, py in points
            ]
            # The printed box must overlap (or nearly touch) the line and the open interval.
            normal_distance = (0 if min(normal) <= 0 <= max(normal)
                               else min(abs(min(normal)), abs(max(normal))))
            if normal_distance > 18 or max(projected) < 0 or min(projected) > d:
                continue
            longitudinal_span = max(projected) - min(projected)
            available_pitches = [local_pitch[s] for s in (si, sj) if s in local_pitch]
            if available_pitches:
                pitch = median(available_pitches)
            else:
                pitch = max(32.0, min(90.0, 2.5 * median((geom[si][4], geom[sj][4]))))
            if d <= min(600.0, longitudinal_span + 2.5 * pitch + 30.0):
                return True
        return False

    def _straight_allowed(si, sj, d, mx, my, p, q):
        # Components and connectors are hard physical-wire boundaries.  Even equal-colour wires
        # on their two terminals remain separate objects; colour may be inferred later, but the
        # topology never passes through the device.
        def verdict(allowed, reason):
            # A refused straight mate is the single most consequential silent decision in the
            # dash tracer: it is what leaves half a physical conductor unlabelled and black.
            # Record every near-collinear candidate so the reason is inspectable, never inferred.
            if not allowed and d <= 240:
                diag().record("dash_mate", si=si, sj=sj, d=round(d, 1),
                              mx=round(mx, 1), my=round(my, 1), reason=reason)
            return allowed

        if _corridor_blocked(p, q):
            return verdict(False, "corridor-blocked")
        pitches = [local_pitch[s] for s in (si, sj) if s in local_pitch]
        if not pitches:
            if d <= 96 or _strong_label_gap(si, sj, p, q, d):
                return True
            return verdict(False, "no-local-pitch-and-too-far")
        pitch = median(pitches)
        centre_spacing = d + (geom[si][4] + geom[sj][4]) / 2
        expected_gap = max(3.0, pitch - (geom[si][4] + geom[sj][4]) / 2)
        cap = min(130.0, max(58.0, 1.8 * expected_gap + 12.0))
        one_period = d <= cap and abs(centre_spacing - pitch) <= max(18.0, 0.45 * pitch)
        if one_period or _periodic_crossing_gap(si, sj, p, q, d) \
                or _strong_label_gap(si, sj, p, q, d):
            return True
        return verdict(False, f"off-rhythm(pitch={pitch:.0f},spacing={centre_spacing:.0f},"
                              f"cap={cap:.0f})")

    def _ray_corner(y, x, ty, tx, y2, x2, ty2, tx2):
        den = _cross(ty, tx, ty2, tx2)
        if abs(den) < 0.45:
            return None
        vy, vx = y2 - y, x2 - x
        t = _cross(vy, vx, ty2, tx2) / den
        u = _cross(vy, vx, ty, tx) / den
        if t < -2 or u < -2:
            return None
        return t, u, y + t * ty, x + t * tx

    def _corner_reach(si):
        if si not in local_pitch:
            return 48.0
        # At a dashed 90-degree bend the last stroke on each leg can be almost one full pitch
        # away from the mathematical corner.  Mutual forward-ray nomination plus the complete
        # component/pin corridor guard makes that rhythm-sized reach safe.
        return min(80.0, max(48.0, 0.95 * local_pitch[si]))

    strong = defaultdict(dict)       # port -> {mate port: score}
    corner = defaultdict(dict)       # forward-ray L joins, never blind endpoint radius
    for i, (si, k, (y, x), (ty, tx)) in enumerate(E):
        cy, cx = int(y) // 80, int(x) // 80
        for dyc in range(-8, 9):
            for dxc in range(-8, 9):
                for j in idx.get((cy + dyc, cx + dxc), []):
                    sj, kj, (y2, x2), (ty2, tx2) = E[j]
                    if sj == si:
                        continue
                    p, q = (si, k), (sj, kj)
                    vy, vx = y2 - y, x2 - x
                    d = (vy * vy + vx * vx) ** 0.5
                    if d < 1 or d > 600:
                        continue
                    uy, ux = vy / d, vx / d
                    ahead = ty * uy + tx * ux
                    back = ty2 * uy + tx2 * ux
                    lat = abs(vy * tx - vx * ty)
                    dot = ty * ty2 + tx * tx2
                    if ahead > 0.88 and back < -0.88 and lat <= 9 and \
                            _straight_allowed(si, sj, d, (x + x2) / 2, (y + y2) / 2,
                                              p, q):
                        strong[p][q] = -dot - 0.005 * d
                        continue
                    if d > 230:
                        continue
                    if abs(dot) > 0.5 or si in at_pin or sj in at_pin:
                        continue
                    hit = _ray_corner(y, x, ty, tx, y2, x2, ty2, tx2)
                    if hit is None:
                        continue
                    t, u, hy, hx = hit
                    if t > _corner_reach(si) or u > _corner_reach(sj):
                        continue
                    if _protected_join(hx, hy) or _at_pin(x, y) or _at_pin(x2, y2):
                        continue
                    if _corridor_points_blocked(y, x, hy, hx) \
                            or _corridor_points_blocked(y2, x2, hy, hx):
                        continue
                    corner[p][q] = -(t + u + 0.1 * d)

    # --- solve straight trains first --------------------------------------------------------
    mate = {}

    def commit(p, q):
        if p in mate or q in mate or not colors_ok(p[0], q[0]):
            return False
        mate[p] = q; mate[q] = p
        union(p[0], q[0])
        return True

    for _round in range(80):
        progressed = False
        best = {}
        for p, candidates in strong.items():
            available = {q: score for q, score in candidates.items()
                         if q not in mate and colors_ok(p[0], q[0])}
            if p not in mate and available:
                best[p] = max(available, key=available.get)
        for p, q in best.items():
            if best.get(q) == p and p < q and commit(p, q):
                progressed = True
        # Elimination remains safe for straight continuation after mutual pairs consume the
        # crossing alternatives.  There is deliberately no long weak-edge pool any more.
        for p, candidates in strong.items():
            if p in mate:
                continue
            available = [q for q in candidates
                         if q not in mate and colors_ok(p[0], q[0])]
            if len(set(available)) == 1 and commit(p, available[0]):
                progressed = True
        if not progressed:
            break

    # --- topology-aware T nodes -------------------------------------------------------------
    # A T exists only when the branch axis ends at the hub and a perpendicular dash train has
    # ink on BOTH sides.  If the branch axis also has ink beyond the hub, this is an X crossing
    # and the axes must remain separate.
    ink_idx = defaultdict(set)
    for si in dash:
        order = segments[si]["order"]
        stride = max(1, len(order) // 6)
        for py, px in order[::stride]:
            ink_idx[(int(py) // 64, int(px) // 64)].add(si)
        py, px = order[-1]
        ink_idx[(int(py) // 64, int(px) // 64)].add(si)

    def _nearby_segments(hy, hx, cells=2):
        by, bx = int(hy) // 64, int(hx) // 64
        found = set()
        for dyc in range(-cells, cells + 1):
            for dxc in range(-cells, cells + 1):
                found.update(ink_idx.get((by + dyc, bx + dxc), ()))
        return found

    def _axis_support(hy, hx, ay, ax, reach=120):
        negative, positive = set(), set()
        for sk in _nearby_segments(hy, hx, 3):
            if sk in at_pin:
                continue
            _cy, _cx, uy, ux, _length = geom[sk]
            if abs(ay * uy + ax * ux) < 0.94:
                continue
            (y0, x0), (y1, x1) = segments[sk]["ends"]
            lateral0 = abs((y0 - hy) * ax - (x0 - hx) * ay)
            lateral1 = abs((y1 - hy) * ax - (x1 - hx) * ay)
            if min(lateral0, lateral1) > 11:
                continue
            a0 = (y0 - hy) * ay + (x0 - hx) * ax
            a1 = (y1 - hy) * ay + (x1 - hx) * ax
            lo, hi = sorted((a0, a1))
            negative_clear = not _corridor_points_blocked(
                hy, hx, y0 if a0 <= a1 else y1, x0 if a0 <= a1 else x1)
            positive_clear = not _corridor_points_blocked(
                hy, hx, y0 if a0 >= a1 else y1, x0 if a0 >= a1 else x1)
            if lo < -3 and hi >= -reach and negative_clear:
                negative.add(sk)
            if hi > 3 and lo <= reach and positive_clear:
                positive.add(sk)
        return negative, positive

    t_joined_ports = set()
    t_port_anchors = {}
    for si, k, (y, x), (ty, tx) in E:
        p = (si, k)
        if p in mate or si in at_pin or _at_pin(x, y):
            continue
        reach = max(54.0, _corner_reach(si) + 12.0)
        hub_candidates = {}
        for sj in _nearby_segments(y, x, 3):
            if sj == si:
                continue
            _cy, _cx, uy2, ux2, _length2 = geom[sj]
            if abs(ty * uy2 + tx * ux2) > 0.45:
                continue
            y2, x2 = segments[sj]["ends"][0]
            hit = _ray_corner(y, x, ty, tx, y2, x2, uy2, ux2)
            if hit is None:
                # The canonical through direction can point either way.  Its ray sign is not
                # semantically meaningful, so retry with the opposite direction.
                hit = _ray_corner(y, x, ty, tx, y2, x2, -uy2, -ux2)
            if hit is None:
                continue
            t, _u, hy, hx = hit
            if not (0 <= t <= reach) or _protected_join(hx, hy):
                continue
            if _corridor_points_blocked(y, x, hy, hx):
                continue
            through_neg, through_pos = _axis_support(hy, hx, uy2, ux2)
            if not through_neg or not through_pos:
                continue
            _stem_neg, stem_pos = _axis_support(hy, hx, ty, tx)
            stem_pos = {sk for sk in stem_pos if sk != si}
            if stem_pos:             # four-sided support: a true X, not a T
                continue
            angle_key = round(math.atan2(uy2, ux2) % math.pi, 1)
            key = (round(hy / 6), round(hx / 6), angle_key)
            support = through_neg | through_pos
            current = hub_candidates.get(key)
            if current is None or t < current[0]:
                hub_candidates[key] = (t, hy, hx, support, (uy2, ux2))
        if not hub_candidates:
            continue
        ranked = sorted(hub_candidates.values(), key=lambda item: item[0])
        if len(ranked) > 1 and ranked[1][0] - ranked[0][0] < 10:
            continue                 # more than one credible hub: do not guess
        _t, hy, hx, support, (through_y, through_x) = ranked[0]
        # A T is an electrical node, not proof that its three incident cable sections are one
        # physical wire.  Record every incident port as a hard colour boundary and undo the
        # straight mate which may already span the hub.  Electrical adjacency can be used later
        # for consensus inference, but colour ownership must stop at the node: different wire
        # codes are valid on different legs of the same splice/ground terminal.
        incident_ports = {p}
        through_ports = {}
        for sj, kj, (y2, x2), (ty2, tx2) in E:
            if sj not in support:
                continue
            vy, vx = hy - y2, hx - x2
            dist = (vy * vy + vx * vx) ** 0.5
            if dist <= 0 or (ty2 * vy + tx2 * vx) / dist <= 0.75:
                continue
            if dist > _corner_reach(sj) + 12:
                continue
            projection = (y2 - hy) * through_y + (x2 - hx) * through_x
            if abs(projection) <= 2:
                continue
            side = 1 if projection > 0 else -1
            if side not in through_ports or dist < through_ports[side][0]:
                through_ports[side] = (dist, (sj, kj))
        incident_ports.update(port for _distance, port in through_ports.values())
        for port in list(incident_ports):
            other = mate.get(port)
            if other in incident_ports:
                mate.pop(port, None)
                mate.pop(other, None)
        t_joined_ports.update(incident_ports)
        for port in incident_ports:
            t_port_anchors[port] = (hx, hy)

    # Straight ownership is completely represented by ``mate``.  Rebuild union-find after
    # T-node discovery so a mate revoked at a node also splits the physical roots before L-corner
    # decisions inspect colour compatibility; union-find itself cannot delete an earlier edge.
    # Deliberately do not union ``t_joined_ports``.
    par = {si: si for si in dash}
    ncol = defaultdict(set)
    for label, si, bare, _d2 in seeds:
        if not bare and _constrains_topology(label):
            ncol[si].add(frozenset(label["code"].split("/")))
    for port, other in mate.items():
        if port < other:
            union(port[0], other[0])

    # --- unique mutual L corners ------------------------------------------------------------
    # Forward rays make the 24/26/33 px drawing gaps equivalent: both strokes nominate the
    # same geometric corner.  A T presents two near-equal perpendicular choices and therefore
    # cannot sneak through this stage as an arbitrary L.
    def _unique_corner(p):
        if p in mate or p in t_joined_ports:
            return None
        if any(q not in mate and colors_ok(p[0], q[0]) for q in strong.get(p, {})):
            return None
        available = [(score, q) for q, score in corner.get(p, {}).items()
                     if q not in mate and q not in t_joined_ports and colors_ok(p[0], q[0])]
        if not available:
            return None
        available.sort(reverse=True)
        if len(available) > 1 and available[0][0] - available[1][0] < 10:
            return None
        return available[0][1]

    for _round in range(20):
        choices = {p: q for p in corner if (q := _unique_corner(p)) is not None}
        progressed = False
        for p, q in choices.items():
            if choices.get(q) == p and p < q and commit(p, q):
                progressed = True
        if not progressed:
            break

    # --- groups + claims --------------------------------------------------------------------
    groups = defaultdict(list)
    for si in dash:
        groups[find(si)].append(si)

    dclaims_rank = {}                # root -> ((bare?, d2), codes): strong labels outrank bare
    for L, si, bare, d2 in seeds:
        r = find(si)
        rank = (1 if bare else 0, d2)
        if r not in dclaims_rank or rank < dclaims_rank[r][0]:
            dclaims_rank[r] = (rank, L["code"].split("/"))

    def _boundary_bounded(members):
        anchors = []
        for si in members:
            for k, (y, x) in enumerate(segments[si]["ends"]):
                port = (si, k)
                if port in mate and port not in t_joined_ports:
                    continue
                _ey, _ex, ty, tx = endpoint_by_port[port]
                candidates = []
                if port in t_port_anchors:
                    hx, hy = t_port_anchors[port]
                    candidates.append((math.hypot(hx - x, hy - y),
                                       ("node", round(hx / 6), round(hy / 6)), hx, hy))
                housing = _housing_anchor(x, y, tx, ty)
                if housing is not None:
                    candidates.append(housing)
                hard_pin = _hard_pin_anchor(x, y, tx, ty)
                if hard_pin is not None:
                    candidates.append(hard_pin)
                if candidates:
                    _distance, identity, ax, ay = min(candidates, key=lambda item: item[0])
                    anchors.append((identity, ax, ay))
        # Two open ports citing the same nearby component are one boundary, not two.  Stable
        # component/node/terminal identities preserve scale independence: distinct compact
        # terminals are valid even when closer than a fixed pixel threshold.
        return any(identity1 != identity2
                   for i, (identity1, _ax1, _ay1) in enumerate(anchors)
                   for identity2, _ax2, _ay2 in anchors[i + 1:])

    dgroups, dclaims, unlabelled = {}, {}, {}
    boundary_bounded_short = set()
    for r, members in groups.items():
        paintable = [s for s in members if s not in at_pin]
        total = sum(len(segments[s]["order"]) for s in paintable)
        normal_route = len(paintable) >= 2 and total >= 60
        # A complete gauged/two-colour legend is enough to retain a genuinely short cable
        # between nearby components, but only when three strokes independently establish a
        # periodic train.  Keep the normal size gate for bare R/SB tokens and OCR-free roots:
        # isolated glyph fragments must never become wires merely because one letter is close.
        strong_short_route = (
            r in dclaims_rank
            and dclaims_rank[r][0][0] == 0
            and len(paintable) >= 3
            and total >= 40
            and any(si in local_pitch for si in paintable)
        )
        # Two nearby components can leave room for only two printed dash strokes, often one on
        # each side of a one-letter code.  Admit such a route only when its two physical ends are
        # independently backed by component/terminal/node geometry.  This is topology evidence,
        # not a blanket relaxation of the dash-size threshold.
        bounded_short_route = (
            len(paintable) >= 2
            and total >= 18
            and _boundary_bounded(members)
        )
        if bounded_short_route:
            boundary_bounded_short.add(r)
        if not (normal_route or strong_short_route or bounded_short_route):
            continue
        if r in dclaims_rank:
            dgroups[r] = paintable
            rank, codes = dclaims_rank[r]
            dclaims[r] = (rank[1], codes)
        else:
            # boundary boxes carry no code and must stay unpainted, but a run whose label
            # the tiled OCR simply missed is a rescue candidate (round 11).
            unlabelled[r] = paintable

    # open chain ends per size-qualified net, for the dash<->solid continuity bridge
    # (round 11f): a run often alternates between dashed strokes and thin CONTINUOUS
    # routing lines; the pipeline links these ends to solid-arc ends and floods colour.
    open_ports = {}
    for r in list(dgroups) + list(unlabelled):
        ports = []
        for si in groups[r]:
            (ya, xa), (yb, xb) = segments[si]["ends"]
            n = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5 or 1.0
            for k in (0, 1):
                if (si, k) not in mate and (si, k) not in t_joined_ports:
                    sgn = 1.0 if k == 1 else -1.0
                    ports.append((si, k, segments[si]["ends"][k],
                                  (sgn * (yb - ya) / n, sgn * (xb - xa) / n)))
        open_ports[r] = ports
    result = (dgroups, dclaims, unlabelled, open_ports)
    if not return_state:
        return result
    return (*result, {
        "live": [si for members in groups.values() for si in members if si not in at_pin],
        "mate": dict(mate),
        "connected_ports": set(t_joined_ports),
        "seeds": [(label, si) for label, si, _bare, _d2 in seeds],
        "groups": {root: list(members) for root, members in groups.items()},
        "boundary_bounded_short": set(boundary_bounded_short),
        "node_port_anchors": dict(t_port_anchors),
        "nfind": find,
        "at_pin": set(at_pin),
    })
