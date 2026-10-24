"""Two wires meeting at a pin are not a hairpin: a U-turn has nothing else at its tip."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.solver import solve  # noqa: E402


def _segment(points):
    k = min(14, len(points) - 1)
    return {"order": points, "ends": [points[0], points[-1]],
            "tang": [(points[0][0] - points[k][0], points[0][1] - points[k][1]),
                     (points[-1][0] - points[-1 - k][0], points[-1][1] - points[-1 - k][1])]}


def _line(a, b):
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])))
    return [(round(a[0] + (b[0] - a[0]) * t / n), round(a[1] + (b[1] - a[1]) * t / n))
            for t in range(n + 1)]


def _arms(stub):
    """A vertical wire and a diagonal one converging upward to almost the same point (y=50)."""
    arms = [_line((200, 100), (50, 100)), _line((200, 160), (52, 104))]
    if stub:
        arms.append(_line((35, 100), (0, 100)))   # a connector stub ending 15 px above the tip
    wire = np.zeros((240, 240), np.uint8)
    for points in arms:
        for (ya, xa), (yb, xb) in zip(points, points[1:]):
            cv2.line(wire, (xa, ya), (xb, yb), 1, 3)
    return [_segment(points) for points in arms], wire.astype(bool)


def _joined(stub):
    segments, wire = _arms(stub)
    twist = {2} if stub else set()
    sol = solve(segments, twist, [], lambda *_a: False, lambda *_a: None, wire, 240, 240)
    return sol["nfind"](0) == sol["nfind"](1)


class HairpinTip(unittest.TestCase):
    def test_two_converging_arms_with_a_free_tip_are_one_hairpin(self):
        self.assertTrue(_joined(stub=False))

    def test_two_wires_meeting_at_a_connector_stub_stay_apart(self):
        self.assertFalse(_joined(stub=True))


if __name__ == "__main__":
    unittest.main()
