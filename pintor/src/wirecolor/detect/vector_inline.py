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
        x0, y0, x1, y1 = legend.bbox
        tolerance = INLINE_OFFSET * ((y1 - y0) if legend.axis == "h" else (x1 - x0))
        window = _window(legend)
        ends = list(_near(piece_grid, *window))
        sides = {_side(legend, end, direction, length) for _i, end, direction, length in ends}
        crossings = [found for found in (_across(legend, end, direction, length)
                                         for _i, end, direction, length in ends) if found]
        for index, end, direction, length in _near(run_grid, *window):
            side = _side(legend, end, direction, length)
            crossing = _across(legend, end, direction, length)
            if (side is not None and -side in sides) or (crossing is not None and any(
                    other == -crossing[0] and abs(position - crossing[1]) <= tolerance
                    for other, position in crossings)):
                through.add((index, legend.code))
    return sorted(through)


def printed_in_line(legends, runs, pieces):
    """The codes printed in the line of a wire, and the runs of that wire.

    ``runs`` are the conductor runs a legend may claim. ``pieces`` is every decomposed piece,
    however short, so that a stub between the text and a pin still proves the wire passes through.
    Returns ``(legend indexes, [(legend index, run index), ...])``.
    """
    run_grid, piece_grid = _index(runs), _index(pieces)
    proven_legends, claims = [], []
    for li, legend in enumerate(legends):
        if legend.bbox is None or legend.leader:
            continue
        window = _window(legend)
        proven = {_side(legend, end, direction, length)
                  for _index_, end, direction, length in _near(piece_grid, *window)}
        if not {-1, 1} <= proven:
            continue
        proven_legends.append(li)
        claimed = sorted({index for index, end, direction, length in _near(run_grid, *window)
                          if _side(legend, end, direction, length) is not None})
        claims.extend((li, ri) for ri in claimed)
    return proven_legends, claims
