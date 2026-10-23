"""Codes printed inside a small closed box: connector-pin and relay-terminal cells.

A relay or connector drawn as a filled body lists each terminal in its own white cell -- ``DBL/W
86`` -- and the cable reaches the cell from outside. The housing detector looks for outlined
rectangles and never sees a filled body, so the code used to be treated as a loose cable label and
attached to the nearest passing wire. On a rasterised factory page (pub 36 p7) that painted the SB
wire leaving pin 87a DBL/W and an R/PU feed Y/R, both 40 px from the cell.

The cell is found from the background, not from its outline: the paper around the code is a
small region that does not reach the edge of a generous window. A code on open paper, or beside a
wire, sits in the page's own background and is never a cell. Paper closed in by thin wires is not
a cell either -- connector leads labelled "BL/R 1" between their neighbours make such pockets (pub
7741532 p73) -- so the cell must sit in a body: a few pixels outside its outline there is still
ink all round.
"""
from __future__ import annotations

import cv2
import numpy as np

# How far a cell may extend beyond its code, as a multiple of the code's own size, with a floor in
# pixels for short codes. A relay cell holds the code plus a terminal number ("DBL/W 86").
CELL_REACH_FACTOR = 2.0
CELL_REACH_MIN_PX = (120, 60)
# The interior of a cell is mostly paper: text and a terminal number take the rest.
CELL_MIN_PAPER_SHARE = 0.5
# Between these distances outside the cell's paper, nearly all is ink: the body that holds it.
CELL_WALL_PX = (5, 9)
CELL_WALL_INK_SHARE = 0.8
# A cable entering the cell ends within this distance of its outline.
CELL_ENTRY_PX = 16
# ... and leaves it: at least this much of the arc lies outside the outline.
CELL_EXIT_PX = 20


def _label_rect(label):
    xs = [p[0] for p in label["box"]]
    ys = [p[1] for p in label["box"]]
    return int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1


def enclosing_cell(binary, label):
    """The closed cell (x0, y0, x1, y1) around a printed code, or None on open paper."""
    height, width = binary.shape[:2]
    lx0, ly0, lx1, ly1 = _label_rect(label)
    reach_x = max(CELL_REACH_MIN_PX[0], int(CELL_REACH_FACTOR * (lx1 - lx0)))
    reach_y = max(CELL_REACH_MIN_PX[1], int(CELL_REACH_FACTOR * (ly1 - ly0)))
    wx0, wy0 = max(0, lx0 - reach_x), max(0, ly0 - reach_y)
    wx1, wy1 = min(width, lx1 + reach_x), min(height, ly1 + reach_y)
    paper = (binary[wy0:wy1, wx0:wx1] == 0).astype(np.uint8)
    # The code's own glyphs would split the paper around it; the cell is what holds them.
    paper[max(0, ly0 - wy0):ly1 - wy0, max(0, lx0 - wx0):lx1 - wx0] = 1
    _count, labels = cv2.connectedComponents(paper, connectivity=4)
    seed = labels[(ly0 + ly1) // 2 - wy0, (lx0 + lx1) // 2 - wx0]
    region = labels == seed
    if (region[0].any() or region[-1].any() or region[:, 0].any() or region[:, -1].any()):
        return None                       # the paper runs on: open page, not a cell
    rows = np.flatnonzero(region.any(axis=1))
    columns = np.flatnonzero(region.any(axis=0))
    cx0, cy0 = int(columns[0]) + wx0, int(rows[0]) + wy0
    cx1, cy1 = int(columns[-1]) + wx0 + 1, int(rows[-1]) + wy0 + 1
    if int(region.sum()) < CELL_MIN_PAPER_SHARE * (cx1 - cx0) * (cy1 - cy0):
        return None                       # an irregular pocket between strokes, not a cell
    inner, outer = (cv2.getStructuringElement(cv2.MORPH_RECT, (2 * d + 1, 2 * d + 1))
                    for d in CELL_WALL_PX)
    mask = region.astype(np.uint8)
    wall = (cv2.dilate(mask, outer) > 0) & ~(cv2.dilate(mask, inner) > 0)
    ink = binary[wy0:wy1, wx0:wx1] > 0
    if int((wall & ink).sum()) < CELL_WALL_INK_SHARE * max(1, int(wall.sum())):
        return None                       # paper beyond thin strokes: a pocket between wires
    return cx0, cy0, cx1, cy1


def annotate_pin_cells(binary, labels):
    """Mark every code that sits in a closed cell with ``label["pin_cell"]``; return the cells."""
    cells = []
    for label in labels:
        cell = enclosing_cell(binary, label)
        if cell is not None:
            label["pin_cell"] = cell
            cells.append(cell)
    return cells


def cell_entry_arc(cell, segments, excluded=()):
    """The one arc that ends at the cell's outline and leaves it, or None.

    No cable, or two cables (an inline connector cell has one on each side, and a connector is a
    colour boundary), leaves the code without an owner.
    """
    x0, y0, x1, y1 = cell
    entering = []
    for si, segment in enumerate(segments):
        if si in excluded:
            continue
        if not any(x0 - CELL_ENTRY_PX <= ex <= x1 + CELL_ENTRY_PX
                   and y0 - CELL_ENTRY_PX <= ey <= y1 + CELL_ENTRY_PX
                   for ey, ex in segment["ends"]):
            continue
        outside = sum(1 for y, x in segment["order"]
                      if not (x0 - 6 <= x <= x1 + 6 and y0 - 6 <= y <= y1 + 6))
        if outside >= CELL_EXIT_PX:
            entering.append(si)
    return entering[0] if len(entering) == 1 else None


def in_any_cell(cells, x, y, margin=0):
    return any(x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin
               for x0, y0, x1, y1 in cells)
