"""GLOBAL NET-SOLVER -- extracted verbatim from colorize_wiring_prototype.py (lines 396-891).

Greedy per-label tracing plateaued on the long unlabelled harness loops: every chained fork is
ambiguous seen from one end, but becomes FORCED once the neighbouring nets take colours. So the
whole sheet is solved at once: every arc end is a PORT, ports meeting at a junction form a NODE,
and nodes are resolved by rules of decreasing certainty until a fixpoint -- mutual-best collinear
continuation (with a lateral term, so two parallel wires crossing a bus cannot swap), then
corner-at-crossing, then ELIMINATION: a port whose only colour-compatible candidate remains is
committed, which resolves whole chains greedy tracing could not.
"""
from __future__ import annotations

from collections import defaultdict

import cv2
import numpy as np

from .skeleton import deep_tang as _deep_tang, unit


def solve(segments, twist, labels, in_housing, dot_near, wire, W, H,
          probe=None, who=None, netends=None, deadends=False, color_boundary_dots=()):
    """Run the net-solver. Returns a dict with everything downstream stages (paint, dashes,
    validators) and the P0 golden harness need: mate, at_dot, claims, seeds, per-net colour
    state (nfind/net_colors/seed_pts) and the v1 counter line values."""

    def deep_tang(si, k, win=30):
        return _deep_tang(segments, si, k, win)

    # junction dots CONNECT everything they touch: all arcs ending at a dot belong to the same
    # cable (that is what the filled dot means), so colour propagates through the whole dotted net
    # -- e.g. a star point's branches or a daisy-chained injector return all take the node's colour.
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

    label_boxes = []
    for L in labels:
        xs_ = [p[0] for p in L["box"]]; ys_ = [p[1] for p in L["box"]]
        label_boxes.append((min(xs_) - 5, min(ys_) - 5, max(xs_) + 5, max(ys_) + 5))

    def in_label_box(px, py):
        return any(bx0 <= px <= bx1 and by0 <= py <= by1 for bx0, by0, bx1, by1 in label_boxes)

    def gap_corridor_blocked(a, b):
        """Components and electrical nodes are hard physical-wire boundaries.

        Sampling the complete corridor avoids the historical midpoint shortcut, which could
        jump straight through a narrow relay, switch or terminal that sat off the midpoint.
        """
        ay, ax = a
        by, bx = b
        distance = ((by - ay) ** 2 + (bx - ax) ** 2) ** 0.5
        steps = max(1, int(distance // 10))
        for step in range(steps + 1):
            x = ax + (bx - ax) * step / steps
            y = ay + (by - ay) * step / steps
            if in_housing(x, y, 8) or dot_near(y, x, 8):
                return True
        return False

    PROBE = probe
    WHO = who

    def arc_candidates(cx, cy, want_vertical=None, maxd=62):
        """Ranked wire-arc candidates for a label. Codes are printed ALONG their wire (rotated
        with it), so a vertical label must match a locally-vertical arc -- a mismatched-
        orientation arc (e.g. a stray connector-bar edge) is heavily penalised rather than
        chosen by raw distance. Returns [(score, si, raw_d2, (y, x) nearest point), ...] best
        first; the v1 contract holds: a label attaches ONLY if the top-scored arc's raw
        distance clears maxd."""
        cands = []
        for si, s in enumerate(segments):
            if si in twist:
                continue
            o = s["order"]
            best = None
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
                    best = (score, d, (y, x))
            if best is not None:
                cands.append((best[0], si, best[1], best[2]))
        cands.sort(key=lambda t: t[0])
        return cands

    def _probe_near(*pts):
        return PROBE is not None and any(abs(p[1] - PROBE[0]) < 40 and abs(p[0] - PROBE[1]) < 40
                                         for p in pts)

    # --- nets: union-find over segments; a net's colour set constrains which merges are legal ----
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

    # Junction dots connect the ELECTRICAL net, but a splice joins distinct physical cable pieces
    # whose colours may differ.  Real splice dots are therefore hard colour boundaries.  Thin
    # terminal-tick false positives retain the historical merge so a single conductor is not cut
    # merely because its connector tick looked dot-like.
    color_boundary_dots = set(color_boundary_dots)
    at_dot = set()
    for _d, _lst in dot_arcs.items():
        for (si, k) in _lst:
            at_dot.add((si, k))
        if _d not in color_boundary_dots:
            for (_sa, _), (_sb, _) in zip(_lst, _lst[1:]):
                nunion(_sa, _sb)

    # --- label seeds: colour each label's home net (rejection rules unchanged from rounds 1-4) ---
    seeds = []                             # (label, home segment)
    rej = nomatch = 0
    _pending = []                          # (label, maxd, ranked arc candidates)

    def _strong_seed(L):
        """Gauged or two-colour labels are trustworthy; BARE single letters are not (pin
        designators read as codes). Round 10b: bare letters no longer enter net_colors, so
        a stray designator can never BLOCK a legitimate merge (a lone 'P' at the fuel-press
        sensor kept {P} on the upper run and vetoed its collinear join to the BL/OR net)."""
        return (any(ch.isdigit() for ch in str(L.get("raw", "")).upper())
                or "/" in L["code"]
                or L.get("evidence_source") in {
                    "page-code-table", "parallel-bare-bundle",
                })

    def _seed(L, si):
        seeds.append((L, si))
        if _strong_seed(L):
            net_colors[nfind(si)].add(frozenset(L["code"].split("/")))
        seed_pts[nfind(si)].append((L["cy"], L["cx"]))

    for L in labels:
        if in_housing(L["cx"], L["cy"]):
            rej += 1
            continue
        # the bottom-right title block (logo, doc number, legend) yields garbage OCR "codes" that
        # would paint logo strokes -- never treat anything in that corner as a cable label.
        if L["cx"] > 0.62 * W and L["cy"] > 0.70 * H:
            rej += 1
            continue
        # round 8: a bare single-letter label with no gauge digits sitting AT a housing is a
        # pin/component designator ('T' temp pin, 'R' relay coil), never a cable code -- as a
        # seed it painted whole sensor nets tan on pub 2550.
        _raw = str(L.get("raw", "")).strip().upper()
        if len(L["code"]) == 1 and not any(ch.isdigit() for ch in _raw) \
                and in_housing(L["cx"], L["cy"], 60):
            rej += 1
            continue
        # wide labels (gauge-first style: "1.5 BL/R (w6)") sit at the end of a leader, farther from
        # their wire than compact codes -- scale the match radius with the label's own size.
        maxd = max(62, 0.9 * max(L["w"], L["h"]))
        cands = arc_candidates(L["cx"], L["cy"], want_vertical=L["h"] > L["w"], maxd=maxd)
        if not cands or cands[0][2] > maxd * maxd:
            nomatch += 1
            continue
        _pending.append((L, maxd, cands))

    # round 8b: SIDE-CONSISTENT attachment. Labels are printed on one consistent side of their
    # wire per sheet (~40 px left on pub 2550); when parallel wires run closer together than
    # that offset, raw nearest-distance attaches a label to its NEIGHBOUR's wire ('0.75 W/SB'
    # seeded the 0.75 W wire, painting it black/white). Unambiguous labels (second candidate
    # beyond 1.8x the best distance) attach exactly as v1, seed IMMEDIATELY, and VOTE the
    # sheet's side convention. Ambiguous ones (round 10c) then prefer, in order: a wire whose
    # net colours are COMPATIBLE with this label (a wire never carries two different codes --
    # so '0.75 SB' cannot land on the BN/W wire, and 'W/SB' cannot land on the W wire), then
    # the voted side (so a plain-R label stays on its own red wire rather than jumping to an
    # unlabelled neighbour), then distance.
    _off_v, _off_h = [], []                # signed label->wire offsets: vertical, horizontal
    _ambiguous = []
    for (L, maxd, cands) in _pending:
        d0 = cands[0][2] ** 0.5
        rivals = [c for c in cands[1:] if c[2] <= maxd * maxd and c[2] ** 0.5 <= 1.8 * d0]
        if not rivals:
            _seed(L, cands[0][1])
            ny, nx = cands[0][3]
            off = (nx - L["cx"]) if L["h"] > L["w"] else (ny - L["cy"])
            if abs(off) >= 8:
                (_off_v if L["h"] > L["w"] else _off_h).append(off)
        else:
            _ambiguous.append((L, maxd, cands, d0))

    def _median(v):
        return sorted(v)[len(v) // 2] if v else 0
    _mv, _mh = _median(_off_v), _median(_off_h)
    _ambiguous.sort(key=lambda t: t[3])    # most-confident attachments claim their wire first
    for (L, maxd, cands, d0) in _ambiguous:
        vertical = L["h"] > L["w"]
        med = _mv if vertical else _mh
        side_known = abs(med) >= 8 and len(_off_v if vertical else _off_h) >= 3
        elig = [c for c in cands if c[2] <= maxd * maxd and c[2] ** 0.5 <= 1.8 * d0]

        def _key(c):
            sc, si, d2, (ny, nx) = c
            off = (nx - L["cx"]) if vertical else (ny - L["cy"])
            side_ok = side_known and (off > 0) == (med > 0)
            cols = net_colors[nfind(si)]
            compat = (not cols) or frozenset(L["code"].split("/")) in cols
            return (0 if compat else 1, 0 if side_ok else 1, sc)

        _seed(L, min(elig, key=_key)[1] if elig else cands[0][1])

    # --- ink connectivity: the referee for HAIRPIN TIPS. The two arms of a harness loop's U-turn
    # point the SAME way, which round 4 rightly banned as a continuation (that is what the
    # neighbouring stripe of a cable pair looks like) -- but at a hairpin the ink itself is one
    # continuous stroke, while pair stripes are separate strokes. Twist-mark pixels are removed
    # first so a 'Z' can still never join a pair.
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
        """Hairpin arms CONVERGE to the tip; pair stripes stay parallel. Compare the gap at the
        ends with the gap 30 px in."""
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
        dominates, so a spoke that bends away shortly after the junction loses to the true
        straight-through wire) plus a LATERAL penalty -- the far end must lie ON my line, so where
        two parallel wires cross a bus together each pairs with its own far side, never its
        neighbour's."""
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

    # --- candidates ------------------------------------------------------------------------------
    # STRONG: ports meeting at a node (14 px, same adjacency the greedy tracer used). Same-direction
    #   mates (deep dot >= 0.8) are dropped UNLESS ink-connected AND converging (hairpin tip).
    # WEAK: never committed by geometry alone, only by elimination with colour pruning --
    #   (a) collinear far-side bridges across erased label text / connector housings (round-1 rule;
    #       lateral tolerance relaxed 6 -> 12 px because scan skew drifts that much over a 100+ px
    #       gap -- safe now that commitment requires being the ONLY compatible candidate);
    #   (b) near gaps <= 30 px slightly ahead (light-ink breaks just past the 14 px node radius:
    #       the audit's near-miss bucket).
    live = [si for si in range(len(segments)) if si not in twist]
    cands = defaultdict(dict)              # port -> {mate port: score}
    weak = set()                           # (p, q) pairs that only elimination may commit
    l_pairs = set()                        # around-the-corner label-box jumps (last resort)

    # spatial prefilter for the weak-gap scan. Targets must normally be >= 40 px (never bridge onto
    # a dash/fragment -- a dashed outline would chain heal-by-heal otherwise), but a gap crossing an
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
                blocked_gap = gap_corridor_blocked(E, Ej)
                near_gap = opposed and dist <= 30 and ahead >= 0.7 and lat <= 8 \
                    and not blocked_gap
                # Only erased label text explains a long missing solid-wire section.  A
                # component housing is the opposite: it terminates the physical conductor.
                far_gap = opposed and ahead >= 0.9 and lat <= 12 and lbl_gap \
                    and not blocked_gap
                # L-gap: erased text can swallow a CORNER -- then no collinear far side exists, but
                # the two cut ends' outward rays cross inside the label box, each pointing at the
                # crossing.
                l_gap = False
                if not (near_gap or far_gap) and abs(dp[0] * dq[0] + dp[1] * dq[1]) <= 0.35:
                    _det = dp[0] * dq[1] - dp[1] * dq[0]
                    if abs(_det) > 1e-6:
                        _t1 = (vy * dq[1] - vx * dq[0]) / _det
                        _t2 = (vy * dp[1] - vx * dp[0]) / _det
                        if 3 <= _t1 <= 170 and 3 <= _t2 <= 170:
                            _Xy, _Xx = E[0] + _t1 * dp[0], E[1] + _t1 * dp[1]
                            l_gap = in_label_box(_Xx, _Xy) \
                                and not gap_corridor_blocked(E, (_Xy, _Xx)) \
                                and not gap_corridor_blocked(Ej, (_Xy, _Xx))
                # label-box gaps: any source, stub targets ok. Elsewhere: the dash/fragment bans
                # hold for both sides (a seeded source is a label's own cut wire, also never a dash).
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

    # --- nodes: cluster ports whose ends meet (transitive closure of the 14 px adjacency) --------
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

    # --- solve to fixpoint -------------------------------------------------------------------------
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
        # RULE A -- mutual-best strong continuation per node (the crossing resolver): both ports
        # name each other their best available mate and the score clears the greedy tracer's 0.2 bar.
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

    if netends is not None:    # dump the OPEN frontier of the net covering a point
        _nx, _ny = netends
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

    # --- ownership: a net is painted with its labels' codes; when several labels share a net the
    # arc takes the CLOSEST label's codes (a code printed on a wire always beats one from across
    # the sheet).
    net_seeds = defaultdict(list)
    for (L, si) in seeds:
        net_seeds[nfind(si)].append(L)

    # round 10 (user markup: a pin-designator 'P' 61+ px from its housing painted a whole run
    # pink): BARE single-letter labels -- no gauge digits, no slash -- are LOW-confidence.
    # They may only paint a net that CORROBORATES them: either a strong (gauged/two-colour)
    # seed of any colour also owns the net (then the bare letter is kept only if it agrees
    # with a strong seed's colours), or a second bare letter of the SAME code sits on the
    # net. A lone bare letter never paints a net by itself -- black over wrong.
    for _root, _Ls in list(net_seeds.items()):
        _st = [L for L in _Ls if _strong_seed(L)]
        if _st:
            _sc = {frozenset(L["code"].split("/")) for L in _st}
            net_seeds[_root] = [L for L in _Ls
                                if _strong_seed(L) or frozenset(L["code"].split("/")) in _sc]
        else:
            from collections import Counter as _Counter
            _best, _n = _Counter(L["code"] for L in _Ls).most_common(1)[0]
            net_seeds[_root] = [L for L in _Ls if L["code"] == _best] if _n >= 2 else []
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

    if deadends:
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

    return dict(mate=mate, at_dot=at_dot, dot_arcs=dict(dot_arcs), claims=claims, seeds=seeds,
                painted=painted, nfind=nfind, net_colors=net_colors, seed_pts=seed_pts,
                rejected_in_housing=rej, no_match=nomatch, live=live,
                color_boundary_dots=color_boundary_dots,
                # The sheet's own printing convention, voted by unambiguous attachments: how far
                # and on which side a legend sits from its conductor.  Exposed so the page profile
                # can record it and later sheets can be compared against the corpus.
                label_side_offset=dict(vertical=_mv, horizontal=_mh,
                                       vertical_votes=len(_off_v),
                                       horizontal_votes=len(_off_h)))
