"""A wire end on a filled component body terminates at that component; it joins nothing there."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.housings import filled_bodies, on_filled_body  # noqa: E402
from wirecolor.detect.solver import solve  # noqa: E402


def _page():
    """A filled relay body with a white terminal cell, two thin wires, and a junction dot."""
    binary = np.zeros((300, 400), np.uint8)
    binary[80:220, 200:320] = 255                # the relay body
    binary[120:150, 230:290] = 0                 # a white terminal cell inside it
    binary[100:103, 20:200] = 255                # a wire ending at the body (3 px thick)
    binary[250:253, 20:380] = 255                # a wire passing below
    yy, xx = np.ogrid[:300, :400]
    binary[(yy - 251) ** 2 + (xx - 100) ** 2 <= 81] = 255   # a junction dot on it (r = 9 px)
    return binary


def _segment(points):
    k = min(14, len(points) - 1)
    return {"order": points, "ends": [points[0], points[-1]],
            "tang": [(points[0][0] - points[k][0], points[0][1] - points[k][1]),
                     (points[-1][0] - points[-1 - k][0], points[-1][1] - points[-1 - k][1])]}


class FilledBodies(unittest.TestCase):
    def test_the_body_is_found_and_wires_dots_and_cells_are_not(self):
        bodies = filled_bodies(_page())
        self.assertTrue(bodies[150, 300])                   # inside the body
        self.assertFalse(bodies[101, 100])                  # the wire leading to it
        self.assertFalse(bodies[251, 300])                  # the wire passing below
        self.assertFalse(bodies[251, 100])                  # the junction dot
        self.assertFalse(bodies[135, 260])                  # the terminal cell stays a hole

    def test_a_page_without_bodies_has_no_body_predicate(self):
        self.assertIsNone(on_filled_body(filled_bodies(np.zeros((300, 400), np.uint8))))


class TwoCablesAtOneRelay(unittest.TestCase):
    def _joined(self, with_body):
        # one cable arrives at the relay's left edge from the left, another leaves the same edge
        # just below and turns down: the corner rule would join them as one cable
        incoming = _segment([(140, x) for x in range(60, 200)])
        leaving = _segment([(145 + d, 200) for d in range(0, 120)])
        body = np.zeros((300, 400), np.uint8)
        body[80:160, 200:320] = 1
        on_body = on_filled_body(body) if with_body else None
        sol = solve([incoming, leaving], set(), [], lambda *_a: False, lambda *_a: None,
                    np.zeros((300, 400), bool), 400, 300, on_body=on_body)
        return sol["nfind"](0) == sol["nfind"](1)

    def test_without_the_body_the_corner_rule_joins_them(self):
        self.assertTrue(self._joined(with_body=False))

    def test_two_cables_ending_on_a_relay_body_stay_apart(self):
        self.assertFalse(self._joined(with_body=True))


if __name__ == "__main__":
    unittest.main()
