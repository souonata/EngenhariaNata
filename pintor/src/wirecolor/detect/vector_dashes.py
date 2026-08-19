"""Which conductors the draughtsman drew DASHED, and with what pitch. Vector path.

A dashed wire on these sheets is not a drawing flourish, it carries information: the title block of
several drawings says *"dashed wires are not included in the main harness"*. Painting one solid
tells a technician the opposite of what the drawing says, so the dash has to survive the paint.

The dash is a PDF rendering attribute (``path["dashes"]``), not geometry -- ``get_drawings()``
returns the full-length line and the viewer breaks it up. So the geometry stage keeps producing one
continuous conductor, which is what topology wants, and this module answers the separate question
of how that conductor should be STROKED. (``detect/dashes.py`` solves a different problem: on a
RASTER sheet the dashes really are separate blobs and have to be re-joined into a net.)

Rare enough to be worth stating: measured across four vector sheets, dashed items are 4 of 2,193 on
pub 34, 57 of 36,019 on pub 2542 and 60 of 1,926 on pub 77. That rarity is why a run must be
MOSTLY dashed before it is treated as dashed -- one dashed leader line crossing a solid cable must
not turn the cable into a dashed one.
"""
from __future__ import annotations

from math import hypot

from ..eval.vector_truth import _matrix

# How close a conductor point has to be to a drawn dashed line to count as lying on it. The run was
# built from these very strokes, so a true match is sub-pixel; this only absorbs the rounding in
# node splitting.
ON_DASH_PX = 2.0

# Fraction of a run's sampled length that must lie on dashed ink before the run is painted dashed.
# Deliberately high: dashing a solid cable is a wrong statement about the harness, while leaving a
# dashed cable solid is merely the defect we already have.
DASHED_FRACTION = 0.6

# Sampling step along a run, in pixels. Fine enough that a short dashed branch is not missed.
SAMPLE_PX = 6.0

CELL_PX = 48.0


def parse_pattern(dashes):
    """The on/off lengths of a PDF dash array, in points. ``None`` when the line is solid.

    PyMuPDF hands this back as the raw string, e.g. ``'[ 3.99454 11.98363 ] 0'``. ``'[] 0'`` is the
    explicit solid pattern and ``None`` means the path never set one.
    """
    if not dashes:
        return None
    inside = dashes.split("[", 1)[-1].split("]", 1)[0].strip()
    if not inside:
        return None
    try:
        values = [float(value) for value in inside.split()]
    except ValueError:
        return None
    values = [value for value in values if value > 0]
    if not values:
        return None
    return values[0], (values[1] if len(values) > 1 else values[0])


def dashed_geometry(page, dpi):
    """Segments drawn with a dash pattern, and the sheet's modal (on, off) pitch in pixels."""
    from collections import Counter

    matrix = _matrix(page, dpi)
    scale = dpi / 72.0
    segments = []
    pitches = Counter()
    for path in page.get_drawings():
        pattern = parse_pattern(path.get("dashes"))
        if pattern is None:
            continue
        if path.get("fill") is not None and path.get("color") is None:
            continue
        on, off = pattern
        for item in path.get("items", ()):
            if item[0] != "l":
                continue
            start, end = item[1] * matrix, item[2] * matrix
            first, second = (start.x, start.y), (end.x, end.y)
            length = hypot(second[0] - first[0], second[1] - first[1])
            if length <= 0:
                continue
            segments.append((first, second))
            # weighted by length, so one long dashed cable decides the pitch rather than a dozen
            # short dashed leader lines
            pitches[(round(on * scale, 1), round(off * scale, 1))] += length
    if not pitches:
        return [], None
    return segments, pitches.most_common(1)[0][0]


def _index(segments, cell=CELL_PX):
    grid = {}
    for segment in segments:
        (ax, ay), (bx, by) = segment
        steps = max(1, int(hypot(bx - ax, by - ay) / cell) + 1)
        for step in range(steps + 1):
            t = step / steps
            key = (int((ax + t * (bx - ax)) // cell), int((ay + t * (by - ay)) // cell))
            grid.setdefault(key, []).append(segment)
    return grid


def _distance(x, y, segment):
    (ax, ay), (bx, by) = segment
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length2))
    return hypot(x - (ax + t * dx), y - (ay + t * dy))


def mark_dashed(runs, segments, tolerance=ON_DASH_PX, fraction=DASHED_FRACTION, cell=CELL_PX):
    """Set ``run.dashed`` on every run lying mostly on dashed ink. Returns how many were marked."""
    if not segments:
        for run in runs:
            run.dashed = False
        return 0
    grid = _index(segments, cell)
    marked = 0
    for run in runs:
        on = total = 0
        for (ax, ay), (bx, by) in zip(run.points, run.points[1:]):
            steps = max(1, int(hypot(bx - ax, by - ay) / SAMPLE_PX))
            for step in range(steps):
                t = (step + 0.5) / steps
                x, y = ax + t * (bx - ax), ay + t * (by - ay)
                total += 1
                near = grid.get((int(x // cell), int(y // cell)))
                if near and min(_distance(x, y, segment) for segment in near) <= tolerance:
                    on += 1
        run.dashed = bool(total) and (on / total) >= fraction
        marked += run.dashed
    return marked
