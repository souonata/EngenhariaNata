"""Junction-dot detection -- extracted verbatim from colorize_wiring_prototype.py
(lines 282-312): distance-transform cores plus the stipple pass for dithered scanned dots.
"""
from __future__ import annotations

import cv2
import numpy as np


def detect_dots(binary, W, H):
    # each dot carries its own reach radius: the skeleton branch-cut pushes arc ends 15-25 px away
    # from a large dot's centre, so a fixed radius misses a big star point's arms.
    _dist = cv2.distanceTransform(binary, cv2.DIST_L2, 3)
    _dm = cv2.dilate(((_dist >= 3.5) * 255).astype(np.uint8), np.ones((3, 3), np.uint8))
    _nd, _, _sd, _cd = cv2.connectedComponentsWithStats(_dm, 8)
    dots = [(int(_cd[i][0]), int(_cd[i][1]), max(20, max(int(_sd[i, 2]), int(_sd[i, 3])) // 2 + 10))
            for i in range(1, _nd)
            if 5 <= int(_sd[i, 2]) <= 26 and 5 <= int(_sd[i, 3]) <= 26 and int(_sd[i, 4]) >= 18]
    # scanned dots often dither into STIPPLE (no solid core, invisible to the distance transform):
    # find them as roundish blobs of dense ink. Junction dots never sit on the sheet frame or in the
    # bottom-right title block -- dense logo/text blobs there are rejected.
    _dens = cv2.boxFilter((binary > 0).astype(np.float32), -1, (15, 15))
    _nc, _, _sc, _cc = cv2.connectedComponentsWithStats(((_dens >= 0.55) * 255).astype(np.uint8), 8)
    for i in range(1, _nc):
        _w, _h, _a = int(_sc[i, 2]), int(_sc[i, 3]), int(_sc[i, 4])
        _cx, _cy = int(_cc[i][0]), int(_cc[i][1])
        if not (10 <= _w <= 45 and 10 <= _h <= 45 and _a >= 100 and 0.5 <= _w / _h <= 2.0):
            continue
        if min(_cx, _cy, W - _cx, H - _cy) <= 150 or (_cx > 0.62 * W and _cy > 0.70 * H):
            continue
        if any(abs(dx - _cx) <= 12 and abs(dy - _cy) <= 12 for dx, dy, _r in dots):
            continue
        dots.append((_cx, _cy, max(20, max(_w, _h) // 2 + 10)))
    return dots


def make_dot_near(dots):
    def dot_near(y, x, r=0):
        for dx, dy, dr in dots:
            rr = max(dr, r)
            if abs(dx - x) <= rr and abs(dy - y) <= rr:
                return (dx, dy)
        return None
    return dot_near
