"""Component symbols read from a vector page's own closed shapes.

A conductor is an open polyline; a component is a closed outline. Fuses, relays, sensors,
connector housings, injector actuator cases and the lens-shaped twisted-pair mark are all drawn
as closed subpaths -- a rectangle, an explicitly closed loop, or a subpath whose first and last
point coincide. Nothing else on a wiring sheet is closed except page furniture.

That matters because the topology reader in ``eval.vector_truth`` cannot tell a symbol edge from a
cable. A symbol outline touches the cables entering it, so union-find bonds them, and a run then
walks IN one side of a fuse and OUT the other into a completely different cable. Measured on pub 34
page 148: the twisted-pair mark over sensor 14 is two closed lenses laid across a pair of wires,
and the graph happily walks the lens from one wire to its neighbour.

Stroke width cannot be used to tell the two apart -- measured, the worst offending path on that
sheet uses the sheet's own modal CONDUCTOR pen. Closedness can.

So: find the closed shapes, bound their size, and delete the strokes they are DRAWN with before
topology is built. Two things follow at once. The symbol is no longer part of any conductor, so it
can never be painted. And the cables it used to bond are separate conductors again, so one legend
can no longer colour both.

Deleting only the symbol's own ink is deliberately narrower than erasing its bounding box from the
page; the wider version was implemented, measured and rejected (see ``strip_symbol_strokes``).

Bounding the size is what keeps this honest. The page border and the title block are also closed
rectangles and they are enormous; treating them as symbols would erase the sheet. The floor matters
just as much in the other direction: pin circles, splice stars and junction dots are closed too,
and deleting a junction dot would sever every tap on the page.
"""
from __future__ import annotations

# A symbol is at least this many modal pen widths across its SHORT side. Below it live the pin
# circles and junction dots -- closed, but electrical connections rather than components. Measured
# on pub 34 p148 (pen 1.58 px): pin circles are ~5 px, the twisted-pair lens is 19 px.
MIN_SIDE_PENS = 8.0

# ...and no bigger than this fraction of the page diagonal. The sheet border and the title block are
# closed rectangles spanning 30-80% of the diagonal; real housings measured at most 11%.
MAX_SIDE_DIAGONAL_FRACTION = 0.12

# A closed shape longer than this relative to its width is a rule, a bar or a frame, not a housing.
MAX_ASPECT = 14.0

# An OPAQUE housing is filled with the page colour and stroked in ink; a junction dot is filled
# with ink. Measured on Group 30 page 46: the sensor boxes and the fuse bodies are fill=(1,1,1)
# stroked in (0.12, 0.10, 0.09), so treating every fill as a junction discarded every one.
PAPER_FILL_MIN_CHANNEL = 0.9

# ---- twisted-pair (bowtie / X) marks -------------------------------------------------------------
# The twist mark on these sheets is a small BOWTIE drawn ON TOP of the cable: two crossing diagonals
# of near-equal length sharing a midpoint, emitted as ONE path (l, c, l, c). Its SHORT side is only
# ~9 px -- below MIN_SIDE_PENS, the floor that spares pin circles -- so the closed-symbol rule above
# never strips it. Yet its diagonal ENDPOINTS land on the cable and node it, so the run is severed
# and the colour dies at the twist (user rule: colours must PASS OVER these symbols).
#
# A real wire crossing is two SEPARATE long strokes that meet at no shared endpoint; it is never one
# small two-line path with a shared midpoint. That makes this primitive specific enough to strip: we
# delete the mark's own ink, the cable stroke underneath stays whole, and the colour runs straight
# through -- exactly what stripping a closed lens does for the other twist variant.
TWIST_LEN_FRACTION = 0.95      # a twist diagonal is shorter than the conductor floor
TWIST_LEN_RATIO = 0.65         # the two diagonals are near-equal in length
TWIST_MIN_ANGLE_DEG = 20.0     # they actually cross, not collinear
TWIST_MID_FRACTION = 0.30      # their midpoints coincide, within this share of the longer diagonal


def _item_points(item):
    import fitz
    op = item[0]
    if op == "l":
        return [item[1], item[2]]
    if op == "c":
        return [item[1], item[2], item[3], item[4]]
    if op == "re":
        r = item[1]
        return [fitz.Point(r.x0, r.y0), fitz.Point(r.x1, r.y0),
                fitz.Point(r.x1, r.y1), fitz.Point(r.x0, r.y1), fitz.Point(r.x0, r.y0)]
    if op == "qu":
        q = item[1]
        return [q.ul, q.ur, q.lr, q.ll, q.ul]
    return []


def _subpaths(items):
    """Split a drawing's item list into subpaths by point continuity.

    ``get_drawings`` hands back one flat list of items per path object, but a path object can hold
    several disjoint subpaths -- both lenses of a twisted-pair mark arrive together. Chaining on
    "this item starts where the last one ended" recovers them.
    """
    out, current = [], []
    for item in items:
        points = _item_points(item)
        if not points:
            continue
        if current and abs(current[-1].x - points[0].x) < 0.05 \
                and abs(current[-1].y - points[0].y) < 0.05:
            current.extend(points[1:])
        else:
            if current:
                out.append(current)
            current = list(points)
    if current:
        out.append(current)
    return out


def _seg_key(a, b):
    ka = (round(a[0], 3), round(a[1], 3))
    kb = (round(b[0], 3), round(b[1], 3))
    return (ka, kb) if ka <= kb else (kb, ka)


def _path_segments_px(items, matrix):
    """Every straight segment a path is drawn with, keyed exactly as ``extract_segments`` emits it.

    Mirrors ``extract_segments`` item-by-item (a 'c' curve becomes the segments between its four
    control points), so a stroke key produced here strips the matching segment out of the soup.
    """
    out = []
    for item in items:
        pts = [(p * matrix) for p in _item_points(item)]
        for a, b in zip(pts, pts[1:]):
            if a.x != b.x or a.y != b.y:
                out.append(((a.x, a.y), (b.x, b.y)))
    return out


def _is_opaque_housing(path) -> bool:
    """True when a path is filled with paper and stroked in ink -- a housing that HIDES the sheet.

    This is the one symbol that may cut a conductor. A stroked mark such as the twisted-pair lens
    lies on top of a live cable and the cable continues underneath, which is why clipping every
    stroke crossing a symbol was measured worse and rejected. An opaque housing is the opposite: it
    paints over whatever runs beneath, so the drawing itself refuses to say the conductor continues.
    """
    fill = path.get("fill")
    if fill is None or path.get("color") is None:
        return False
    return min(fill) >= PAPER_FILL_MIN_CHANNEL


def _is_twist_mark(items, matrix, max_len):
    """True when a path is a bowtie twisted-pair mark: two near-equal diagonals crossing at a shared
    midpoint, both shorter than a conductor. The tiny end-cap curves are ignored."""
    from math import atan2, degrees, hypot

    lines = []
    for item in items:
        if item[0] == "l":
            a, b = item[1] * matrix, item[2] * matrix
            lines.append(((a.x, a.y), (b.x, b.y)))
    if len(lines) != 2:
        return False
    (a1, b1), (a2, b2) = lines
    l1 = hypot(b1[0] - a1[0], b1[1] - a1[1])
    l2 = hypot(b2[0] - a2[0], b2[1] - a2[1])
    long_, short_ = max(l1, l2), min(l1, l2)
    if long_ < 4.0 or long_ > max_len or short_ < TWIST_LEN_RATIO * long_:
        return False
    m1 = ((a1[0] + b1[0]) / 2.0, (a1[1] + b1[1]) / 2.0)
    m2 = ((a2[0] + b2[0]) / 2.0, (a2[1] + b2[1]) / 2.0)
    if hypot(m1[0] - m2[0], m1[1] - m2[1]) > TWIST_MID_FRACTION * long_:
        return False
    diff = abs(degrees(atan2(b1[1] - a1[1], b1[0] - a1[0]) - atan2(b2[1] - a2[1], b2[0] - a2[0]))) % 180.0
    return min(diff, 180.0 - diff) >= TWIST_MIN_ANGLE_DEG


def symbol_geometry(page, dpi, pen_px, min_side_pens=MIN_SIDE_PENS,
                    max_side_fraction=MAX_SIDE_DIAGONAL_FRACTION):
    """(zones, stroke_keys) for the page's component symbols, in working pixels.

    ``zones`` are the bounding boxes. ``stroke_keys`` identify the individual straight segments the
    symbols are drawn with, keyed exactly as ``eval.vector_truth.extract_segments`` emits them, so
    the symbol can be lifted out of the segment soup without touching anything else.
    """
    from ..eval.vector_truth import (MIN_CONDUCTOR_DIAGONAL_FRACTION, _matrix, canvas_diagonal_px)

    matrix = _matrix(page, dpi)
    diagonal = canvas_diagonal_px(page, dpi)
    min_side = min_side_pens * max(pen_px, 0.5)
    max_side = diagonal * max_side_fraction
    max_twist_len = diagonal * MIN_CONDUCTOR_DIAGONAL_FRACTION * TWIST_LEN_FRACTION

    zones, strokes, opaque_zones = [], set(), []
    for path in page.get_drawings():
        items = path.get("items", ())
        # A twisted-pair bowtie is stroked (fill=None) but is not a closed housing; strip its own
        # ink so the cable underneath stays one run and the colour passes straight over the mark.
        if path.get("fill") is None and _is_twist_mark(items, matrix, max_twist_len):
            for a, b in _path_segments_px(items, matrix):
                strokes.add(_seg_key(a, b))
            continue
        # A FILLED closed shape is a junction dot, a splice star or a pin circle -- an electrical
        # connection, not a component. Measured on pub 2543 p0: 125 of 228 candidate zones were the
        # 24 px filled splice markers, and cutting the graph at those severs every splice on the
        # sheet. Component housings are drawn as outlines.
        opaque = _is_opaque_housing(path)
        if path.get("fill") is not None and not opaque:
            continue
        for subpath in _subpaths(items):
            if len(subpath) < 3:
                continue
            if abs(subpath[0].x - subpath[-1].x) > 0.6 or abs(subpath[0].y - subpath[-1].y) > 0.6:
                continue                      # open: a conductor, not a symbol
            points = [(p * matrix) for p in subpath]
            xs = [p.x for p in points]
            ys = [p.y for p in points]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            width, height = x1 - x0, y1 - y0
            short, long_ = min(width, height), max(width, height)
            if short < min_side or long_ > max_side:
                continue
            if long_ > MAX_ASPECT * max(short, 1e-6):
                continue                      # a bar or a frame, not a housing
            zones.append((x0, y0, x1, y1))
            if opaque:
                opaque_zones.append((x0, y0, x1, y1))
            for a, b in zip(points, points[1:]):
                if a.x != b.x or a.y != b.y:
                    strokes.add(_seg_key((a.x, a.y), (b.x, b.y)))
    return zones, strokes, opaque_zones


def strip_symbol_strokes(segments, stroke_keys):
    """Drop the segments a symbol is drawn with, leaving every conductor untouched.

    This is the whole fix, and it is deliberately narrower than clipping the zone out of the page.
    A symbol outline is what BONDS the cables meeting it: the twisted-pair lens on pub 34 p148 lies
    across a pair of wires and union-find happily walks from one wire to the other through the lens,
    so one legend ends up owning both. Delete the lens and the two wires are two conductors again.

    Clipping every stroke that merely PASSES THROUGH the zone was tried instead and measured worse:
    the twisted-pair mark sits on top of a live cable, so cutting there severed nine correctly
    coloured wires on pub 34 p148 into a coloured half by the legend and a black half at the ECU
    pin. Removing only the symbol's own ink keeps the cable whole and still un-bonds it.
    """
    if not stroke_keys:
        return list(segments), 0
    kept = [(a, b) for a, b in segments if _seg_key(a, b) not in stroke_keys]
    return kept, len(segments) - len(kept)


def _segment_inside_zone(a, b, zone):
    """The part of segment a->b that lies inside ``zone``, as endpoints, or None."""
    x0, y0, x1, y1 = zone
    enter, leave = 0.0, 1.0
    for lo, hi, start, delta in ((x0, x1, a[0], b[0] - a[0]), (y0, y1, a[1], b[1] - a[1])):
        if abs(delta) < 1e-9:
            if start < lo or start > hi:
                return None
            continue
        first, second = (lo - start) / delta, (hi - start) / delta
        enter = max(enter, min(first, second))
        leave = min(leave, max(first, second))
    if leave <= enter:
        return None
    return ((a[0] + (b[0] - a[0]) * enter, a[1] + (b[1] - a[1]) * enter),
            (a[0] + (b[0] - a[0]) * leave, a[1] + (b[1] - a[1]) * leave))


def runs_crossing_zones(runs, zones, tolerance=1.0):
    """Indices of the runs whose polyline passes THROUGH a protected zone, not merely into it.

    A conductor that ends at a component is normal and its stroke cap may sit inside the outline.
    A conductor that enters one side of a symbol and leaves by the opposite side is the tracer
    asserting a connection across a component, and its colour cannot be trusted anywhere along it.

    Dropping just those runs is what lets the rest of the sheet be released. Refusing the whole page
    for them was measured against a reviewer's marks: four pages carried 152 of 232 marks, and every
    one of those marks went unmet, because a page that is never released satisfies nothing.

    The test is on the segments, not the vertices: a conductor drawn as one long stroke crosses a
    small symbol without placing a single point inside it.
    """
    crossing = set()
    for index, run in enumerate(runs):
        points = [(float(x), float(y)) for x, y in getattr(run, "points", run)]
        if len(points) < 2:
            continue
        for zone in zones:
            covered = []
            for a, b in zip(points, points[1:]):
                part = _segment_inside_zone(a, b, zone)
                if part is not None:
                    covered.extend(part)
            if not covered:
                continue
            x0, y0, x1, y1 = zone
            spans_x = (max(p[0] for p in covered) - min(p[0] for p in covered)
                       >= (x1 - x0) - 2 * tolerance)
            spans_y = (max(p[1] for p in covered) - min(p[1] for p in covered)
                       >= (y1 - y0) - 2 * tolerance)
            if spans_x or spans_y:
                crossing.add(index)
                break
    return crossing
def clip_segments_to_opaque(segments, opaque_zones, margin=0.0):
    """Cut conductor ink where an OPAQUE housing covers it, keeping the parts outside.

    A wire drawn as one long stroke can run underneath a fuse body or a sensor box, because the
    housing is painted over it. Topology then walks straight through the component and one legend
    colours both sides, which is a connection the sheet never shows -- on Group 30 page 46 an `OR`
    conductor was painted down through the middle fuse to ground.

    Only opaque housings clip. A stroked mark such as the twisted-pair lens lies *on top of* a cable
    that visibly continues, and clipping there was measured to sever nine correctly coloured wires
    (see ``strip_symbol_strokes``); those never reach this function.
    """
    if not opaque_zones:
        return list(segments), 0

    def _outside_parts(a, b):
        """The parts of segment a->b that no zone covers, as (start, end) fractions."""
        spans = [(0.0, 1.0)]
        for x0, y0, x1, y1 in opaque_zones:
            x0, y0, x1, y1 = x0 - margin, y0 - margin, x1 + margin, y1 + margin
            enter, leave = 0.0, 1.0
            for lo, hi, start, delta in (
                (x0, x1, a[0], b[0] - a[0]),
                (y0, y1, a[1], b[1] - a[1]),
            ):
                if abs(delta) < 1e-9:
                    if start < lo or start > hi:
                        enter, leave = 1.0, 0.0
                        break
                    continue
                first, second = (lo - start) / delta, (hi - start) / delta
                enter = max(enter, min(first, second))
                leave = min(leave, max(first, second))
            if leave <= enter:
                continue                      # this zone does not cover any of the segment
            kept = []
            for lo, hi in spans:
                if enter > lo:
                    kept.append((lo, min(hi, enter)))
                if leave < hi:
                    kept.append((max(lo, leave), hi))
            spans = [(lo, hi) for lo, hi in kept if hi - lo > 1e-6]
            if not spans:
                break
        return spans

    kept, cut = [], 0
    for a, b in segments:
        spans = _outside_parts(a, b)
        if len(spans) == 1 and spans[0] == (0.0, 1.0):
            kept.append((a, b))
            continue
        cut += 1
        for lo, hi in spans:
            start = (a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo)
            end = (a[0] + (b[0] - a[0]) * hi, a[1] + (b[1] - a[1]) * hi)
            if start != end:
                kept.append((start, end))
    return kept, cut
