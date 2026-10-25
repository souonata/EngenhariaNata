"""Codes printed in the line of their own wire.

These sheets break a wire to print its colour code. The stroke stops at one edge of the text and
resumes at the other, on the text's centre line. Judged only by distance from the text centre,
such a code can fail three ways:

- it ties between the two pieces of its own wire;
- it loses its run to the same code printed at the far end, which is ambiguous;
- where rows are 6 pt apart, it takes the parallel wire whose end happens to sit nearer.

All three were measured on pub 7745609 p7, where DBL/OR took the Y/GR wire.

The geometry settles it. A run is the wire the code is printed in when two things hold:

- its end sits just outside one edge of the text, on the text's centre line, and the run leaves
  along the text's axis;
- another stroke leaves the opposite edge the same way.

Both sides are required. A wire that merely stops at a piece of text, such as a component name,
has nothing on the far side.

A code proven to sit in a wire names that wire and no other. When every piece of that wire is too
short to be a run, the code refuses rather than claim a neighbour by distance. On p7, BL/P sits in
a wire cut into 36 pt and 48 pt pieces by crossings, and took the BL/W wire beside it.

A piece too short to be a run does not end the wire. The code's wire is followed along the text's
centre line, across crossing gaps of up to 1.5 text heights and never through a component, to the
first run. On pub 7745609 p7, BL/W leaves its text as a 23 pt piece that stops at a heavy wire
crossing it; the 74 pt run beyond that crossing is the BL/W wire, and was left black.

A run that doubles back on itself is two wires meeting at one pin, not one wire: two pin stubs of a
plug that end at the same pin form a V. A code claims no such run. On p7, SB reached the V formed
by the SB and Y stubs of one plug and painted the Y stub SB.

A code printed across its wires names them too: the wire stops at one long edge of the text and
resumes at the other, level with itself, as under a bundle label or an SB set across the wire that
rises to a star point. That claim is made only when the code is printed in line with nothing and no
stroke passes through the text unbroken. A code sitting on an unbroken wire may name that wire, and
the broken one would then be a crossing wire.

The converse protects the wire: a run that passes through printed codes may carry only that code.
Every code counts here: a bare letter too weak to paint as much as a full code, and a code printed
across its wires, as a bundle label is. Measured on pub 7749124 p11, the injector pigtail codes
(GR/Y, GR/W, GR/OR) sit in line with runs that continue through the injector plug into the P/DGN
feeds. The P/DGN label is printed across those feeds, so each run passes through two colours and
stays black. On pub 7745609, a P/DGN code 11 pt away took the wire a bare Y is printed in.
"""
from __future__ import annotations

from math import hypot

INLINE_OFFSET = 0.35   # an end's distance from the text centre line, in text heights
INLINE_GAP = 0.8       # how far outside the text edge an end may stop, in text heights
INLINE_OVERLAP = 0.25  # how far inside the edge it may reach: text boxes carry side bearings
INLINE_ALIGN = 0.9     # the first stretch must leave along the text axis (cosine)
INLINE_MIN_STUB = 0.25  # the shortest stretch that proves a side, in text heights
INLINE_CHAIN_GAP = 1.5  # a crossing gap the wire may jump on its way to a run, in text heights
INLINE_CHAIN_STEPS = 3  # short pieces followed before giving up
HAIRPIN_COS = -0.5      # a turn sharper than 120 degrees: the run doubles back on itself
CELL_PX = 32.0


def _first_stretch(points):
    """(end, unit direction into the run, length of that first straight step) at each end."""
    out = []
    for chain in (points, points[::-1]):
        end = chain[0]
        for other in chain[1:]:
            length = hypot(other[0] - end[0], other[1] - end[1])
            if length > 0.5:
                out.append((end, ((other[0] - end[0]) / length, (other[1] - end[1]) / length),
                            length))
                break
    return out


def _index(pieces):
    grid = {}
    for index, points in enumerate(pieces):
        for end, direction, length in _first_stretch(points):
            key = (int(end[0] // CELL_PX), int(end[1] // CELL_PX))
            grid.setdefault(key, []).append((index, end, direction, length))
    return grid


def _near(grid, x0, y0, x1, y1):
    for cx in range(int(x0 // CELL_PX), int(x1 // CELL_PX) + 1):
        for cy in range(int(y0 // CELL_PX), int(y1 // CELL_PX) + 1):
            yield from grid.get((cx, cy), ())


def _side(legend, end, direction, length):
    """-1 or +1 when this end leaves the low or high edge of the text in line with it, else None."""
    x0, y0, x1, y1 = legend.bbox
    if legend.axis == "h":
        along, across, d_along = end[0], end[1], direction[0]
        low, high, centre, height = x0, x1, (y0 + y1) / 2.0, y1 - y0
    else:
        along, across, d_along = end[1], end[0], direction[1]
        low, high, centre, height = y0, y1, (x0 + x1) / 2.0, x1 - x0
    if height <= 0 or abs(across - centre) > INLINE_OFFSET * height:
        return None
    if length < INLINE_MIN_STUB * height:
        return None
    if (low - INLINE_GAP * height <= along <= low + INLINE_OVERLAP * height
            and d_along <= -INLINE_ALIGN):
        return -1
    if (high - INLINE_OVERLAP * height <= along <= high + INLINE_GAP * height
            and d_along >= INLINE_ALIGN):
        return 1
    return None


def _across(legend, end, direction, length):
    """(-1 or +1, position along the text) when this end leaves the text across its axis."""
    x0, y0, x1, y1 = legend.bbox
    if legend.axis == "h":
        along, across, d_across = end[0], end[1], direction[1]
        low, high, start, stop, height = y0, y1, x0, x1, y1 - y0
    else:
        along, across, d_across = end[1], end[0], direction[0]
        low, high, start, stop, height = x0, x1, y0, y1, x1 - x0
    if height <= 0 or length < INLINE_MIN_STUB * height or not start <= along <= stop:
        return None
    if (low - INLINE_GAP * height <= across <= low + INLINE_OVERLAP * height
            and d_across <= -INLINE_ALIGN):
        return -1, along
    if (high - INLINE_OVERLAP * height <= across <= high + INLINE_GAP * height
            and d_across >= INLINE_ALIGN):
        return 1, along
    return None


def _doubles_back(points):
    """True when the polyline turns back on itself by more than 120 degrees at some vertex."""
    steps = [(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:])
             if hypot(b[0] - a[0], b[1] - a[1]) > 0.5]
    for (ax, ay), (bx, by) in zip(steps, steps[1:]):
        if (ax * bx + ay * by) / (hypot(ax, ay) * hypot(bx, by)) < HAIRPIN_COS:
            return True
    return False


def _passes_through(legend, segment_grid):
    """True when some stroke crosses the text's inner box without a break."""
    x0, y0, x1, y1 = legend.bbox
    inset = INLINE_OVERLAP * min(x1 - x0, y1 - y0)
    box = (x0 + inset, y0 + inset, x1 - inset, y1 - inset)
    if box[0] >= box[2] or box[1] >= box[3]:
        return False
    for a, b in {segment for cell in _cells(box) for segment in segment_grid.get(cell, ())}:
        for t in (i / 16 for i in range(17)):
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
                return True
    return False


def _cells(box):
    for cx in range(int(box[0] // CELL_PX), int(box[2] // CELL_PX) + 1):
        for cy in range(int(box[1] // CELL_PX), int(box[3] // CELL_PX) + 1):
            yield cx, cy


def _segment_grid(pieces):
    grid = {}
    for points in pieces:
        for a, b in zip(points, points[1:]):
            box = (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))
            for cell in _cells(box):
                grid.setdefault(cell, []).append((a, b))
    return grid


def _window(legend):
    x0, y0, x1, y1 = legend.bbox
    reach = INLINE_GAP * max(x1 - x0, y1 - y0)
    return x0 - reach, y0 - reach, x1 + reach, y1 + reach


def printed_through(legends, runs, pieces):
    """``(run index, code)`` for every printed code a run passes through, in line or across.

    ``legends`` is every code on the page, weak or strong. A run passes through a code when one of
    its ends leaves an edge of the text and another piece leaves the opposite edge in line with it.
    """
    run_grid, piece_grid = _index(runs), _index(pieces)
    through = set()
    for legend in legends:
        if legend.bbox is None or legend.leader:
            continue
        window = _window(legend)
        ends = list(_near(piece_grid, *window))
        sides = {_side(legend, end, direction, length) for _i, end, direction, length in ends}
        for index, end, direction, length in _near(run_grid, *window):
            side = _side(legend, end, direction, length)
            if side is not None and -side in sides:
                through.add((index, legend.code))
        through.update((index, legend.code)
                       for index in _crossed_runs(legend, ends, run_grid, window))
    return sorted(through)


def _crossed_runs(legend, piece_ends, run_grid, window):
    """Runs that leave a long edge of the text, level with a piece leaving the opposite edge."""
    x0, y0, x1, y1 = legend.bbox
    tolerance = INLINE_OFFSET * ((y1 - y0) if legend.axis == "h" else (x1 - x0))
    crossings = [found for found in (_across(legend, end, direction, length)
                                     for _i, end, direction, length in piece_ends) if found]
    crossed = set()
    for index, end, direction, length in _near(run_grid, *window):
        crossing = _across(legend, end, direction, length)
        if crossing is not None and any(other == -crossing[0]
                                        and abs(position - crossing[1]) <= tolerance
                                        for other, position in crossings):
            crossed.add(index)
    return crossed


def _line(legend):
    """(along, across) coordinates of a point in the text's frame, its centre line and height."""
    x0, y0, x1, y1 = legend.bbox
    if legend.axis == "h":
        return (lambda point: (point[0], point[1])), (y0 + y1) / 2.0, y1 - y0
    return (lambda point: (point[1], point[0])), (x0 + x1) / 2.0, x1 - x0


def _crosses_zone(a, b, zones):
    """True when the straight gap a-b touches a component zone (both ends or any point between)."""
    for x0, y0, x1, y1 in zones:
        for t in (0.0, 0.25, 0.5, 0.75, 1.0):
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if x0 <= x <= x1 and y0 <= y <= y1:
                return True
    return False


def _follow(legend, side, start, pieces, piece_grid, run_of, zones):
    """The run reached from a short piece on ``side`` along the text's centre line, or None."""
    frame, centre, height = _line(legend)
    tolerance, gap = INLINE_OFFSET * height, INLINE_CHAIN_GAP * height
    current = start
    for _step in range(INLINE_CHAIN_STEPS):
        points = pieces[current]
        if any(abs(frame(point)[1] - centre) > tolerance for point in points):
            return None                               # the wire turns off the line: not ours to follow
        far = max(points, key=lambda point: side * frame(point)[0])
        reach = far[0] - gap, far[1] - gap, far[0] + gap, far[1] + gap
        found = set()
        for index, end, direction, _length in _near(piece_grid, *reach):
            along, across = frame(end)
            step = side * (along - frame(far)[0])
            leaving = side * (direction[0] if legend.axis == "h" else direction[1])
            if (index != current and 0 < step <= gap and abs(across - centre) <= tolerance
                    and leaving >= INLINE_ALIGN and not _crosses_zone(far, end, zones)):
                found.add(index)
        if len(found) != 1:
            return None                               # nothing ahead, or a fork: decline
        current = found.pop()
        if id(pieces[current]) in run_of:
            return run_of[id(pieces[current])]
    return None


def printed_in_line(legends, runs, pieces, zones=()):
    """The codes printed in the line of a wire, and the runs of that wire.

    ``runs`` are the conductor runs a legend may claim. ``pieces`` is every decomposed piece,
    however short, so that a stub between the text and a pin still proves the wire passes through;
    a run must be the same list object in both. ``zones`` are component boxes a followed wire never
    crosses. Returns ``(legend indexes, [(legend index, run index), ...])``.
    """
    run_grid, piece_grid = _index(runs), _index(pieces)
    segment_grid = _segment_grid(pieces)
    run_of = {id(points): index for index, points in enumerate(runs)}
    proven_legends, claims = [], []
    for li, legend in enumerate(legends):
        if legend.bbox is None or legend.leader:
            continue
        window = _window(legend)
        piece_ends = list(_near(piece_grid, *window))
        ends = [(index, _side(legend, end, direction, length))
                for index, end, direction, length in piece_ends]
        if not {-1, 1} <= {side for _index_, side in ends}:
            crossed = _crossed_runs(legend, piece_ends, run_grid, window)
            if crossed and not _passes_through(legend, segment_grid):
                proven_legends.append(li)
                claims.extend((li, ri) for ri in sorted(crossed) if not _doubles_back(runs[ri]))
            continue
        proven_legends.append(li)
        claimed = {index for index, end, direction, length in _near(run_grid, *window)
                   if _side(legend, end, direction, length) is not None}
        for index, side in ends:
            if side is not None and id(pieces[index]) not in run_of:
                reached = _follow(legend, side, index, pieces, piece_grid, run_of, zones)
                if reached is not None:
                    claimed.add(reached)
        claims.extend((li, ri) for ri in sorted(claimed) if not _doubles_back(runs[ri]))
    return proven_legends, claims
