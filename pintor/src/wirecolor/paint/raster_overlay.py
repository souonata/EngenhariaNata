"""Native-resolution band overlay for raster wiring sheets.

Reproduces the user-approved v1 band look (solid 7 px @200 DPI, two-colour stripe pair,
white-core-black-rails W, wider dashes) at the ORIGINAL raster's resolution, as a transparent
RGBA overlay placed on the page inside an optional-content group ("Wire colors") via
INCREMENTAL save -- the original PDF bytes stay a byte-identical prefix of the output and the
colour layer is toggleable in the viewer.

Overlay construction guarantees composite parity with the legacy painter: bands are stroked
onto a copy of the native page render exactly like v1 (so anti-aliased edge pixels blend
against the real underlying artwork, no transparent-canvas fringes), then everything outside
the stroked coverage mask is made fully transparent, and protected regions (housings expanded
by TERM_GAP, scaled) are knocked out -- the v1 housing-restore semantics.
"""
from __future__ import annotations

import cv2
import numpy as np

from ..prep import Transform
from .legacy import TERM_GAP, _perp_offsets

OCG_NAME = "Wire colors"


def _scaled_strokers(convention, t: Transform):
    """v1 band geometry scaled by the transform (widths in native px)."""
    colors = convention.colors_bgr
    white = convention.white_token
    s = t.s

    def w(px):                       # scale a v1 200-DPI width, keep >= 1
        return max(1, round(px * s))

    def _stroke(canvas, mask, poly, code, thick):
        pi = poly.astype(np.int32)
        if code == white:            # white channel: TRUE white core delimited by a 2-px black
            # rail each side (round 10e, user pref -- 1 px vanished at 100% viewer zoom).
            B = w(thick)
            cv2.polylines(canvas, [pi], False, (0, 0, 0), B + 4, cv2.LINE_AA)
            cv2.polylines(canvas, [pi], False, (255, 255, 255), B, cv2.LINE_AA)
            cv2.polylines(mask, [pi], False, 255, B + 4, cv2.LINE_AA)
        else:
            cv2.polylines(canvas, [pi], False, colors[code], w(thick), cv2.LINE_AA)
            cv2.polylines(mask, [pi], False, 255, w(thick), cv2.LINE_AA)

    def _pts(order):
        return np.array([(x * t.sx, y * t.sy) for (y, x) in order], np.float32)

    def _pair_stroke(canvas, mask, pts, codes, total_v1):
        """Two-colour band as two ABUTTING half-bands (round-8c, user markup): the halves
        overlap ~1 px at the centreline so neither white paper nor the original wire ink can
        ever show between the colours -- the transition is a hard colour-to-colour edge.
        A W half is plain near-white here (no rails: a rail would re-draw exactly the dark
        seam line the abutment removes)."""
        B = max(4, w(total_v1))                     # total band width, native px
        half = max(2, round(B / 2) + 1)             # +1 -> centre overlap kills the seam
        a, b = _perp_offsets(pts, B / 4)
        halves = list(zip((a, b), codes))
        # a W half draws FIRST: true white + 1-px black rails, and the partner colour then
        # covers the seam-side rail -- outer delimiter stays, colour edge stays hard (8c).
        halves.sort(key=lambda h: 0 if h[1] == white else 1)
        for poly, code in halves:
            pi = poly.astype(np.int32)
            if code == white:
                # 2-px outer rail (round 10e); the partner half draws after and covers the
                # seam-side excess, keeping the hard colour edge of round 8c.
                cv2.polylines(canvas, [pi], False, (0, 0, 0), half + 4, cv2.LINE_AA)
                cv2.polylines(canvas, [pi], False, (255, 255, 255), half, cv2.LINE_AA)
            else:
                cv2.polylines(canvas, [pi], False, colors[code], half, cv2.LINE_AA)
        cv2.polylines(mask, [pts.astype(np.int32)], False, 255, B + 6, cv2.LINE_AA)

    def render_seg(canvas, mask, order, codes):
        if len(order) < 10:          # ultra-short stubs paint as round blobs; skip them (v1 rule)
            return
        pts = _pts(order)
        if len(pts) < 2:
            return
        if len(codes) == 1:
            _stroke(canvas, mask, pts, codes[0], 7)
        else:
            _pair_stroke(canvas, mask, pts, codes, 8)

    def render_dash(canvas, mask, order, codes, thick=10):
        if len(order) < 6:
            return
        pts = _pts(order)
        if len(pts) < 2:
            return
        if len(codes) == 1:
            _stroke(canvas, mask, pts, codes[0], thick)
        else:
            _pair_stroke(canvas, mask, pts, codes, thick)
        # NOTE: thick values are v1 200-DPI units; scaling to native px happens via w().

    return render_seg, render_dash


def build_overlay_rgba(solution: dict, native_bgr: np.ndarray, t: Transform) -> np.ndarray:
    """Paint the bands onto a copy of the native render and cut the RGBA overlay out of it.
    native_bgr: the page rendered at native-canvas resolution (band AA blends against it)."""
    from .orient import _canonical_forward, orient_segments

    convention = solution["convention"]
    render_seg, render_dash = _scaled_strokers(convention, t)
    segments = solution["segments"]

    canvas = native_bgr.copy()
    mask = np.zeros(canvas.shape[:2], np.uint8)

    # round 7: mate-chain orientation so a two-colour pair keeps its stripe sides through
    # crossings and corners (the raw arc direction is arbitrary after skeleton cuts).
    mate = solution["solver"]["mate"]
    at_dot = solution["solver"]["at_dot"]
    orient = orient_segments(segments, mate)

    # round 9 (user markup, supercharger pins): paint must stop a little BEFORE a wire's end
    # when the wire terminates -- at connector pins, terminals, or any free end. A FREE end is
    # a port with no solver continuation and no junction dot; mated ends (wire continues) and
    # dot ends (electrical joint -- paint must reach the dot) are never trimmed.
    END_GAP = 20                     # working px: the stroke's ROUND end cap extends ~half a
    #                                  band width past the trimmed endpoint, so the trim must
    #                                  over-shoot for a visible gap (user rounds 3-4 markup)

    claims = solution["solver"]["claims"]
    terminal_dots = solution.get("terminal_dots", set())

    # port -> its junction dot + member list
    _port_dot = {}
    for _d, _members in solution["solver"].get("dot_arcs", {}).items():
        for _p in _members:
            _port_dot[_p] = (_d, _members)

    def _joint_port(port):
        """True only for a port at a REAL splice dot (fat round core), never a terminal
        tick that false-positives as a dot (round 9d, measured bimodal split)."""
        if port not in at_dot:
            return False
        d, _members = _port_dot.get(port, (None, ()))
        return d is not None and d not in terminal_dots

    def _raw_connected(port):
        return port in mate or _joint_port(port)

    # round 9c: tiny claimed arcs not connected at BOTH ends are pin-circle rim / terminal
    # junk (tick pieces), never a cable span -- painting them puts a colour blob on the pin.
    painted = {sj for sj in claims
               if len(segments[sj]["order"]) >= 20
               or (_raw_connected((sj, 0)) and _raw_connected((sj, 1)))}

    def _connected(port):
        """A port continues the wire only if it joins a REAL dot joint where >= 2 painted
        arcs meet, or an arc that will actually be painted. A mate into UNPAINTED ink, a
        terminal-tick 'dot', or a lone-arc dot is a wire END: trim, so the band stops short
        of connector tick marks too (rounds 9c-9d, user markup)."""
        if port in at_dot:
            if not _joint_port(port):
                return False
            _d, members = _port_dot.get(port, (None, ()))
            return sum(1 for (si, _k) in members if si in painted) >= 2
        far = mate.get(port)
        return far is not None and far[0] in painted

    def _trimmed(sj, order):
        cut = min(END_GAP, max(0, (len(order) - 6) // 2))
        lo = cut if not (_connected((sj, 0)) or (sj, 0) in bridged_ports) else 0
        hi = len(order) - (cut if not (_connected((sj, 1)) or (sj, 1) in bridged_ports) else 0)
        return order[lo:hi]

    # round 12b/12d: LOOP-DETOUR STRAIGHTENING. When a twist-X's loop is ink-continuous with
    # a wire, the skeleton traces the wire THROUGH the loop and the claimed arc detours
    # around it. No real wire turns this hard within ~78 px; only annotation loops do.
    # Replace the detour section with its straight chord so the band passes straight through
    # the symbol (user rule for CAN twisted pairs).
    import math

    def _loop_boxes(order):
        n = len(order)
        if n < 24:
            return []
        pts = order[::3]
        ang = [math.atan2(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])
               for k in range(len(pts) - 1)]
        difs = []
        for k in range(1, len(ang)):
            dd = ang[k] - ang[k - 1]
            while dd > math.pi:
                dd -= 2 * math.pi
            while dd < -math.pi:
                dd += 2 * math.pi
            difs.append(dd)
        boxes = []
        Wn, s = 26, 0.0
        cur = None
        for k in range(len(difs)):
            s += difs[k]
            if k >= Wn:
                s -= difs[k - Wn]
            if abs(s) > 4.4:                       # ~252 deg of NET turn in ~78 px: loop
                #                                    detours only (a legit U-turn is 180)
                i0, i1 = max(0, (k - Wn) * 3), min(n - 1, (k + 2) * 3)
                if cur and i0 <= cur[1] + 9:
                    cur[1] = i1
                else:
                    cur = [i0, i1]
                    boxes.append(cur)
        return boxes

    def _straightened(order):
        secs = _loop_boxes(order)
        if not secs:
            return order
        out, k = [], 0
        for (i0, i1) in secs:
            out.extend(order[k:i0 + 1])
            k = i1                          # skip the detour; polylines draw the chord
        out.extend(order[k:])
        return out

    # round 12d (user rule): colours PASS STRAIGHT THROUGH the pair-twist symbols. Bridges
    # are decided BEFORE arc rendering so the joined ends keep their full length (no END
    # trim, no capsule-chain look). Two sources: MATED pairs with a wide cut (the twist
    # exclusion pushes arcs 30-40 px apart) and FREE same-coloured strictly-collinear ends
    # (the X is often absorbed or cut invisibly). A bridge may never cross a protected zone.
    # Round 14: a FREE bridge is legal only across an actual detected twist zone. Otherwise the
    # same geometry also jumps through open switches and other in-line components.
    _guard_gap = TERM_GAP + 12

    _twist_boxes = []
    for _tsi in solution.get("bridge_twist", solution.get("twist", ())):
        _o = segments[_tsi]["order"]
        _ys = [p[0] for p in _o]; _xs = [p[1] for p in _o]
        _twist_boxes.append((min(_xs) - 35, min(_ys) - 35,
                             max(_xs) + 35, max(_ys) + 35))

    def _crosses_twist(a, b):
        for k in range(13):
            py = a[0] + (b[0] - a[0]) * k / 12.0
            px = a[1] + (b[1] - a[1]) * k / 12.0
            if any(x0 <= px <= x1 and y0 <= py <= y1
                   for x0, y0, x1, y1 in _twist_boxes):
                return True
        return False

    def _bridge_ok(a, b):
        for k in range(12):
            py = a[0] + (b[0] - a[0]) * k / 11.0
            px = a[1] + (b[1] - a[1]) * k / 11.0
            if any(hx - _guard_gap <= px <= hx + hw + _guard_gap
                   and hy - _guard_gap <= py <= hy + hh + _guard_gap
                   for (hx, hy, hw, hh) in solution["housings"]):
                return False
            if any(abs(dx - px) <= 22 and abs(dy - py) <= 22 for (dx, dy) in terminal_dots):
                return False
            for x1, y1, x2, y2, radius in solution.get("inline_components", ()):
                vx, vy = x2 - x1, y2 - y1
                vv = vx * vx + vy * vy or 1.0
                q = max(0.0, min(1.0, ((px - x1) * vx + (py - y1) * vy) / vv))
                if (px - (x1 + q * vx)) ** 2 + (py - (y1 + q * vy)) ** 2 <= radius ** 2:
                    return False
        return True

    bridges = []                     # (ptA, ptB, codes)
    bridged_ports = set()
    # Mated pairs with a wide cut, both sides painted the same colour.  A solver mate is
    # topological evidence that the two wire pieces belong together; it is not permission to
    # paint the missing geometry between them.  Open contacts and other inline components can
    # look exactly like a collinear mate.  Only a recognised twist annotation is paint-through
    # geometry; every other gap remains visible as the component/wire boundary.
    for p, q in mate.items():
        if p >= q:
            continue
        (si_, _ki), (sj_, _kj) = p, q
        if si_ not in painted or sj_ not in painted:
            continue
        ci = claims[si_][1]
        if claims[sj_][1] != ci:
            continue
        a = segments[si_]["ends"][p[1]]
        b = segments[sj_]["ends"][q[1]]
        if (((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 > 12
                and _crosses_twist(a, b) and _bridge_ok(a, b)):
            bridges.append((a, b, ci))
            bridged_ports.add(p); bridged_ports.add(q)
    # free same-coloured collinear ends: the SOURCE must be free (unconnected), the TARGET
    # may be any painted end of the same colour -- including one already resting on a splice
    # dot, so the band crosses the X and lands on the joint (user rule).
    _targets = []
    _sources = []
    for sj_ in painted:
        codes_ = tuple(claims[sj_][1])
        o = segments[sj_]["order"]
        (ya, xa), (yb, xb) = o[0], o[-1]
        n = ((yb - ya) ** 2 + (xb - xa) ** 2) ** 0.5 or 1.0
        for k in (0, 1):
            sgn = 1.0 if k == 1 else -1.0
            entry = (codes_, segments[sj_]["ends"][k],
                     (sgn * (yb - ya) / n, sgn * (xb - xa) / n), (sj_, k))
            _targets.append(entry)
            if not _connected((sj_, k)) and (sj_, k) not in bridged_ports:
                _sources.append(entry)
    used = set()
    for (ci, (ey, ex), (ty, tx), pi_) in _sources:
        if pi_ in used:
            continue
        best = None
        for (cj, (jy, jx), (jty, jtx), pj_) in _targets:
            if pj_ == pi_ or cj != ci:
                continue
            vy, vx = jy - ey, jx - ex
            d = (vy * vy + vx * vx) ** 0.5
            if d < 4 or d > 130:
                continue
            uy, ux = vy / d, vx / d
            if ty * uy + tx * ux <= 0.8 or jty * uy + jtx * ux >= -0.8:
                continue
            if abs(vy * tx - vx * ty) > 10:
                continue
            if not _crosses_twist((ey, ex), (jy, jx)):
                continue
            if best is None or d < best[0]:
                best = (d, (jy, jx), pj_)
        if best is not None:
            a, b = (ey, ex), best[1]
            if _bridge_ok(a, b):
                bridges.append((a, b, list(ci)))
                bridged_ports.add(pi_); bridged_ports.add(best[2])
                used.add(pi_); used.add(best[2])

    for sj in painted:
        codes = claims[sj][1]
        order = _straightened(_trimmed(sj, segments[sj]["order"]))
        if not orient.get(sj, True):
            order = order[::-1]
        render_seg(canvas, mask, order, codes)

    for (a, b, ci) in bridges:
        pts = [(a[0] + (b[0] - a[0]) * k / 11.0, a[1] + (b[1] - a[1]) * k / 11.0)
               for k in range(12)]
        if not _canonical_forward(pts):
            pts = pts[::-1]
        render_seg(canvas, mask, pts, list(ci))

    for r, (_d, codes) in solution["dclaims"].items():
        for si in solution["dgroups"][r]:
            order = segments[si]["order"]
            if not _canonical_forward(order):   # dashes have no mates; dominant-axis rule
                order = order[::-1]
            render_dash(canvas, mask, order, codes)

    # protected-region knockout: v1's housing restore, scaled -- each cable stops just before
    # its terminal and connector outlines/pins can never stay painted. The margin is wider
    # than v1's TERM_GAP (round 9c): relay/component pin circles STRADDLE the housing outline,
    # sticking ~15 px past the detected rect, and were left painted with the 9 px margin.
    gap = TERM_GAP + 12
    for hx, hy, hw, hh in solution["housings"]:
        x0, y0, ww, hh2 = t.rect(hx - gap, hy - gap, hw + 2 * gap, hh + 2 * gap)
        Hc, Wc = mask.shape
        mask[max(0, round(y0)):min(Hc, round(y0 + hh2)),
             max(0, round(x0)):min(Wc, round(x0 + ww))] = 0

    # round 12d (user rule): colours PASS STRAIGHT THROUGH the pair-twist symbols (CAN
    # twisted pairs) -- no gap, no paint on the symbol's own strokes. Twist clusters are
    # located for the straight-bridge pass below; nothing is knocked out here.
    _clusters = []
    for _si in solution.get("twist", ()):
        o = segments[_si]["order"]
        ys_ = [p[0] for p in o]; xs_ = [p[1] for p in o]
        bb = [min(xs_), min(ys_), max(xs_), max(ys_)]
        for c in _clusters:
            if not (bb[2] < c[0] - 30 or bb[0] > c[2] + 30 or bb[3] < c[1] - 30 or bb[1] > c[3] + 30):
                c[0] = min(c[0], bb[0]); c[1] = min(c[1], bb[1])
                c[2] = max(c[2], bb[2]); c[3] = max(c[3], bb[3])
                break
        else:
            _clusters.append(bb)

    # round 9e: terminal-dot knockout. The end trim measures from the SKELETON end, which
    # stops mid-blob inside a fat terminal tick -- so the band could still restart flush with
    # the tick's base. Clearing a disc around every terminal dot (tick + ~10 px) guarantees
    # the gap from the tick's outer face, on any sheet, any connector style. Real splice
    # dots are never in this set (fat-core classification in the pipeline).
    for (dx, dy) in terminal_dots:
        cx, cy = t.pt(dx, dy)
        cv2.circle(mask, (round(cx), round(cy)), round(22 * t.s), 0, -1)

    # Inline symbols without a rectangular housing (open switch/button contacts, etc.) are
    # protected capsules.  This also handles CAD drawings whose faint construction line runs
    # continuously underneath the symbol: topology may remain continuous, but paint may not
    # cover the component interior.
    for x1, y1, x2, y2, radius in solution.get("inline_components", ()):
        a = tuple(round(v) for v in t.pt(x1, y1))
        b = tuple(round(v) for v in t.pt(x2, y2))
        cv2.line(mask, a, b, 0, round(2 * radius * t.s), cv2.LINE_AA)
        cv2.circle(mask, a, round(radius * t.s), 0, -1)
        cv2.circle(mask, b, round(radius * t.s), 0, -1)

    # round 9: pin-circle knockout. A small enclosed background hole (pin circle, diamond)
    # within reach of a painted arc END gets a cleared disc around it -- the band stops just
    # before the pin even when the circle rim fused with the wire skeleton and the end-trim
    # could not fire (its port is 'mated' into the rim).
    _hidx = {}
    for (hx, hy, hs) in solution.get("holes", ()):
        _hidx.setdefault((int(hx) // 32, int(hy) // 32), []).append((hx, hy, hs))
    _done = set()
    for sj in solution["solver"]["claims"]:
        for (ey, ex) in segments[sj]["ends"]:
            for dcx in (-1, 0, 1):
                for dcy in (-1, 0, 1):
                    for (hx, hy, hs) in _hidx.get((int(ex) // 32 + dcx, int(ey) // 32 + dcy), []):
                        if (hx, hy) in _done or abs(hx - ex) > 20 or abs(hy - ey) > 20:
                            continue
                        _done.add((hx, hy))
                        cx, cy = t.pt(hx, hy)
                        # +12 (round 12e): rim hooks curl ~25 px around a pin circle when the
                        # wire skeleton fuses with the rim -- the disc must swallow the curl.
                        r = round((hs / 2 + 6 + TERM_GAP + 12) * t.s)
                        cv2.circle(mask, (round(cx), round(cy)), r, 0, -1)

    # zero the colour plane wherever the overlay is transparent: the RGB channel would otherwise
    # carry the ENTIRE native render (558 MB flate on an A0 sheet); constant zeros compress to
    # almost nothing and are invisible behind alpha=0 anyway.
    canvas[mask == 0] = 0
    rgba = np.dstack([canvas, mask])
    return rgba


def render_native(pdf_path: str, page_index: int, nw: int, nh: int) -> np.ndarray:
    """Render the page at the native canvas resolution (for band AA blending)."""
    import fitz
    doc = fitz.open(pdf_path)
    page = doc[page_index]
    mat = fitz.Matrix(nw / page.rect.width, nh / page.rect.height)
    pix = page.get_pixmap(matrix=mat)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    doc.close()
    if (img.shape[1], img.shape[0]) != (nw, nh):
        img = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
    return img


def attach_overlay(src_pdf: str, out_pdf: str, page_index: int, rgba: np.ndarray) -> dict:
    """Copy the original PDF to out_pdf untouched, then append the overlay with INCREMENTAL
    save: an OCG'd full-page image above the artwork. Returns stats for the validators."""
    import shutil

    import fitz
    # Refuse to paint an already-painted sheet. V7 cannot catch this: a previously colorized PDF
    # is a valid byte PREFIX of itself-plus-another-layer and keeps every original image hash, so
    # a doubly-painted file passes every preservation check while stacking a second opaque overlay.
    # The staged colorized PDF lives beside the source, so feeding one back is a live footgun.
    probe = fitz.open(src_pdf)
    existing = {(cfg.get("text") or "") for cfg in probe.layer_ui_configs()}
    probe.close()
    if OCG_NAME in existing:
        raise SystemExit(
            f"refusing to paint {src_pdf}: it already carries a '{OCG_NAME}' layer "
            "(this looks like a colorized output, not an original)")

    shutil.copyfile(src_pdf, out_pdf)
    src_size = None
    with open(src_pdf, "rb") as f:
        f.seek(0, 2)
        src_size = f.tell()

    ok, png = cv2.imencode(".png", rgba)   # BGRA png; PyMuPDF embeds alpha as SMask
    if not ok:
        raise RuntimeError("overlay PNG encode failed")
    png_bytes = png.tobytes()

    doc = fitz.open(out_pdf)
    ocg = doc.add_ocg(OCG_NAME, on=True)
    page = doc[page_index]
    # insert in DISPLAY space: build the overlay in the same orientation as the working render
    # (get_pixmap applies page rotation), so a rotated page needs the compensating rotate.
    page.insert_image(page.rect, stream=png_bytes, oc=ocg,
                      rotate=(360 - page.rotation) % 360, overlay=True)
    # deflate: insert_image stores the decoded samples UNCOMPRESSED (an A0 overlay would append
    # ~557 MB raw); the zeroed-outside-mask colour plane and sparse alpha flate down to a few MB.
    doc.save(out_pdf, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP, deflate=True)
    doc.close()

    out_size = None
    with open(out_pdf, "rb") as f:
        f.seek(0, 2)
        out_size = f.tell()
    return dict(src_bytes=src_size, out_bytes=out_size,
                overlay_png_bytes=len(png_bytes), ocg=OCG_NAME)
