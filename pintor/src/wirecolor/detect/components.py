"""Detection of small inline electrical components without a rectangular housing.

Open contacts are the important case: two circular terminals and an oblique contact blade can
sit over a faint, continuous CAD construction line.  Topology alone then sees one straight arc.
This detector finds the electrical symbol geometry along already-claimed conductors and returns
paint-protected capsules.  It is deliberately evidence-heavy so ordinary text holes and wire
crossings do not punch gaps in conductors.
"""
from __future__ import annotations

import math

import cv2
import numpy as np


def cut_inline_component_zones(wire: np.ndarray, zones) -> np.ndarray:
    """Remove recognised component capsules from a wire mask before topology is rebuilt.

    Paint knockout alone is not sufficient: if a faint CAD construction line runs underneath
    an open contact, the skeleton still represents both sides as one physical conductor.  Cutting
    the complete evidence-backed capsule makes the two leads distinct wire objects while leaving
    the component symbol itself outside conductor topology.
    """
    cut = wire.astype(np.uint8, copy=True)
    for x1, y1, x2, y2, radius in zones:
        a = (round(x1), round(y1))
        b = (round(x2), round(y2))
        r = max(1, round(radius))
        cv2.line(cut, a, b, 0, 2 * r, cv2.LINE_8)
        cv2.circle(cut, a, r, 0, -1)
        cv2.circle(cut, b, r, 0, -1)
    return cut.astype(bool)


def extend_boundary_with_inline_components(in_housing, zones):
    """Return a component-boundary predicate covering boxes and inline capsules.

    The topology solvers use this predicate both to reject labels printed inside components and
    to block inferred gap joins.  Keeping inline capsules in the same boundary API prevents a
    colour-like actuator annotation from reconnecting the two leads after the mask was cut.
    """
    zones = tuple(zones)

    def base_boundary(x, y, margin=0):
        try:
            return in_housing(x, y, margin)
        except TypeError:
            return in_housing(x, y)

    def boundary(x, y, margin=0):
        if base_boundary(x, y, margin):
            return True
        for x1, y1, x2, y2, radius in zones:
            dx, dy = x2 - x1, y2 - y1
            denom = dx * dx + dy * dy or 1.0
            t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / denom))
            px, py = x1 + t * dx, y1 + t * dy
            if (x - px) ** 2 + (y - py) ** 2 <= (radius + margin) ** 2:
                return True
        return False

    boxes = list(getattr(in_housing, "housings", ()))
    for x1, y1, x2, y2, radius in zones:
        x0, y0 = min(x1, x2) - radius, min(y1, y2) - radius
        x3, y3 = max(x1, x2) + radius, max(y1, y2) + radius
        boxes.append((x0, y0, x3 - x0, y3 - y0))
    boundary.housings = tuple(boxes)
    boundary.inline_components = zones
    return boundary


def find_inline_component_zones(gray: np.ndarray, segments, claims, holes) -> list[tuple]:
    """Return ``(x1, y1, x2, y2, radius)`` protected capsules in working pixels.

    Required evidence:
    - a pair of similarly-sized small circles;
    - both circles and their midpoint lie on the same claimed conductor;
    - the pair axis follows that conductor; and
    - substantive off-axis ink exists between the circles (contact blade/component symbol).

    Hough search is limited to small ROIs around pre-existing enclosed-hole candidates near
    claimed conductors; this keeps an A0 page exhaustive but inexpensive.
    """
    if gray is None or not claims or not holes:
        return []

    height, width = gray.shape[:2]
    cell = 32
    spatial = {}
    for si in claims:
        if si >= len(segments):
            continue
        order = segments[si]["order"]
        for oi in range(0, len(order), 4):
            y, x = order[oi]
            spatial.setdefault((int(x) // cell, int(y) // cell), []).append((si, oi, x, y))

    def nearest(x, y, limit):
        best = None
        reach = int(math.ceil(limit / cell))
        for gx in range(int(x) // cell - reach, int(x) // cell + reach + 1):
            for gy in range(int(y) // cell - reach, int(y) // cell + reach + 1):
                for si, oi, px, py in spatial.get((gx, gy), ()):
                    d2 = (px - x) ** 2 + (py - y) ** 2
                    if d2 <= limit * limit and (best is None or d2 < best[0]):
                        order = segments[si]["order"]
                        a = max(0, oi - 12)
                        b = min(len(order) - 1, oi + 12)
                        dy = order[b][0] - order[a][0]
                        dx = order[b][1] - order[a][1]
                        n = math.hypot(dx, dy) or 1.0
                        best = (d2, si, dx / n, dy / n,
                                tuple(claims.get(si, (None, ()))[1]))
        return best

    circles = []
    radius = 90
    for hx, hy, _hs in holes:
        if nearest(hx, hy, 48) is None:
            continue
        x0, x1 = max(0, round(hx) - radius), min(width, round(hx) + radius + 1)
        y0, y1 = max(0, round(hy) - radius), min(height, round(hy) + radius + 1)
        roi = gray[y0:y1, x0:x1]
        found = cv2.HoughCircles(
            roi, cv2.HOUGH_GRADIENT, dp=1, minDist=18,
            param1=80, param2=14, minRadius=5, maxRadius=15)
        if found is None:
            continue
        for cx, cy, cr in found[0]:
            gx, gy = float(cx + x0), float(cy + y0)
            if nearest(gx, gy, 18) is None:
                continue
            if any((gx - ox) ** 2 + (gy - oy) ** 2 <= 16 for ox, oy, _or in circles):
                continue
            circles.append((gx, gy, float(cr)))

    binary = gray < 210

    def has_off_axis_ink(a, b):
        x1, y1, _r1 = a
        x2, y2, _r2 = b
        dx, dy = x2 - x1, y2 - y1
        dist = math.hypot(dx, dy)
        ux, uy = dx / dist, dy / dist
        px, py = -uy, ux
        hits = 0
        occupied_steps = 0
        for step in range(33):
            t = 0.18 + 0.64 * step / 32.0
            bx, by = x1 + dx * t, y1 + dy * t
            step_hit = False
            for offset in range(4, 23, 2):
                for sign in (-1, 1):
                    sx = round(bx + sign * px * offset)
                    sy = round(by + sign * py * offset)
                    if 0 <= sx < width and 0 <= sy < height and binary[sy, sx]:
                        hits += 1
                        step_hit = True
            occupied_steps += int(step_hit)
        return hits >= 18 and occupied_steps >= 8

    zones = []
    for i, a in enumerate(circles):
        x1, y1, r1 = a
        na = nearest(x1, y1, 18)
        if na is None:
            continue
        for b in circles[i + 1:]:
            x2, y2, r2 = b
            dist = math.hypot(x2 - x1, y2 - y1)
            if not 28 <= dist <= 110 or abs(r1 - r2) > 6:
                continue
            nb = nearest(x2, y2, 18)
            nm = nearest((x1 + x2) / 2, (y1 + y2) / 2, 14)
            # A component symbol commonly skeletonizes into several small arcs (left lead,
            # terminal rims, blade, right lead).  Requiring one segment id would therefore
            # miss the exact case we need to protect.  Identical resolved colour ownership
            # across both terminals and the midpoint is the physical-wire invariant.
            if (nb is None or nm is None or not na[4]
                    or not (na[4] == nb[4] == nm[4])):
                continue
            ux, uy = (x2 - x1) / dist, (y2 - y1) / dist
            if abs(ux * nm[2] + uy * nm[3]) < 0.88:
                continue
            if not has_off_axis_ink(a, b):
                continue
            zone = (x1, y1, x2, y2, max(r1, r2) + 14)
            if not any(math.hypot((x1 + x2 - z[0] - z[2]) / 2,
                                  (y1 + y2 - z[1] - z[3]) / 2) < 18 for z in zones):
                zones.append(zone)
    return zones
