"""A code printed on its wire owns that wire, even when a parallel wire runs nearer its centre."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.solver import solve  # noqa: E402


def _segment(points):
    k = min(14, len(points) - 1)
    return {"order": points, "ends": [points[0], points[-1]],
            "tang": [(points[0][0] - points[k][0], points[0][1] - points[k][1]),
                     (points[-1][0] - points[-1 - k][0], points[-1][1] - points[-1 - k][1])]}


def _horizontal(y, x0, x1):
    return _segment([(y, x) for x in range(x0, x1 + 1)])


def _label(code="W/BN", cx=150, cy=96, w=48, h=19):
    """A code whose OCR box sits a few pixels above the wire it is printed on (y=101)."""
    return {"code": code, "raw": f"{code} 1", "score": 0.99, "cx": cx, "cy": cy, "w": w, "h": h,
            "box": [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2],
                    [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]}


def _seeds(segments):
    sol = solve(segments, set(), [_label()], lambda *_a: False, lambda *_a: None,
                np.zeros((200, 320), bool), 320, 200)
    return sorted(si for _label_, si in sol["seeds"])


class CodePrintedOnItsWire(unittest.TestCase):
    def test_the_wire_under_the_text_wins_over_a_nearer_parallel_wire(self):
        segments = [
            _horizontal(101, 10, 121),     # 0 the wire the code is printed on, left of the text
            _horizontal(101, 179, 300),    # 1 ... and right of it
            _horizontal(118, 10, 300),     # 2 a parallel wire 22 px below the code's centre
        ]
        self.assertEqual(_seeds(segments), [0, 1])

    def test_a_wire_ending_on_one_side_only_is_not_the_codes_wire(self):
        segments = [_horizontal(101, 10, 121), _horizontal(118, 10, 300)]
        self.assertEqual(_seeds(segments), [1])                  # nearest wire, as before


class PrintedCodesAreStrong(unittest.TestCase):
    def test_two_bare_codes_on_their_wires_keep_the_wires_apart_at_a_shared_tip(self):
        """Bare SB and GR, each printed on its wire, on two wires that converge to one pin."""
        import cv2

        def line(a, b):
            n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])))
            return [(round(a[0] + (b[0] - a[0]) * t / n), round(a[1] + (b[1] - a[1]) * t / n))
                    for t in range(n + 1)]

        pieces = [line((50, 10), (50, 128)), line((50, 172), (100, 300)),
                  line((150, 10), (150, 128)), line((150, 172), (104, 300))]
        wire = np.zeros((200, 320), np.uint8)
        for points in pieces:
            for (ya, xa), (yb, xb) in zip(points, points[1:]):
                cv2.line(wire, (xa, ya), (xb, yb), 1, 5)
        labels = [_label("SB", cx=150, cy=45, w=40, h=16), _label("GR", cx=150, cy=145, w=40, h=16)]
        for label in labels:
            label["raw"] = label["code"]                    # bare: no gauge, no stripe
        sol = solve([_segment(p) for p in pieces], set(), labels, lambda *_a: False,
                    lambda *_a: None, wire.astype(bool), 320, 200)
        self.assertEqual(sorted(si for _label_, si in sol["seeds"]), [0, 1, 2, 3])
        self.assertNotEqual(sol["nfind"](1), sol["nfind"](3))


if __name__ == "__main__":
    unittest.main()
