"""A code printed in a terminal cell belongs to the cable entering that cell, or to nothing."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wirecolor.detect.pin_cells import cell_entry_arc, enclosing_cell  # noqa: E402
from wirecolor.detect.solver import solve  # noqa: E402

CELL = (180, 120, 300, 160)                 # x0, y0, x1, y1 of the cell's paper


def _label(code, cx, cy, w=100, h=24, cell=None):
    label = {"code": code, "raw": code, "score": 0.99, "cx": cx, "cy": cy, "w": w, "h": h,
             "box": [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2],
                     [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]}
    if cell is not None:
        label["pin_cell"] = cell
    return label


def _segment(points):
    k = min(14, len(points) - 1)
    return {"order": points, "ends": [points[0], points[-1]],
            "tang": [(points[0][0] - points[k][0], points[0][1] - points[k][1]),
                     (points[-1][0] - points[-1 - k][0], points[-1][1] - points[-1 - k][1])]}


def _relay_page():
    """A filled relay body (ink) holding one white terminal cell with a code in it."""
    binary = np.zeros((300, 420), np.uint8)
    binary[50:250, 100:350] = 255              # the body is ink at the scan threshold
    x0, y0, x1, y1 = CELL
    binary[y0:y1, x0:x1] = 0                   # the cell's paper
    binary[135:146, 200:260] = 255             # the code's glyphs
    return binary


class EnclosingCell(unittest.TestCase):
    def test_a_code_in_a_closed_cell_finds_its_cell(self):
        self.assertEqual(enclosing_cell(_relay_page(), _label("DBL/W", 230, 140, w=64, h=14)),
                         CELL)

    def test_a_code_on_open_paper_has_no_cell(self):
        binary = _relay_page()
        binary[277:285, 30:90] = 255
        self.assertIsNone(enclosing_cell(binary, _label("SB", 60, 281, w=64, h=14)))

    def test_a_code_in_a_pocket_closed_by_thin_wires_has_no_cell(self):
        binary = np.zeros((300, 420), np.uint8)
        binary[100:104, 150:330] = 255         # four thin wires closing a pocket of paper
        binary[156:160, 150:330] = 255
        binary[100:160, 150:154] = 255
        binary[100:160, 326:330] = 255
        binary[124:136, 200:260] = 255
        self.assertIsNone(enclosing_cell(binary, _label("BL/R", 230, 130, w=64, h=14)))

    def test_a_code_between_two_parallel_wires_has_no_cell(self):
        binary = np.zeros((300, 420), np.uint8)
        binary[100:103, :] = 255
        binary[140:143, :] = 255
        binary[117:126, 180:240] = 255
        self.assertIsNone(enclosing_cell(binary, _label("R/PU", 210, 121, w=64, h=12)))


class CellEntryArc(unittest.TestCase):
    def test_the_one_cable_ending_at_the_cell_owns_it(self):
        cable = _segment([(140, x) for x in range(40, 179)])
        passing = _segment([(200, x) for x in range(40, 400)])
        self.assertEqual(cell_entry_arc(CELL, [passing, cable]), 1)

    def test_a_cable_on_each_side_leaves_the_code_without_owner(self):
        left = _segment([(140, x) for x in range(40, 179)])
        right = _segment([(140, x) for x in range(302, 400)])
        self.assertIsNone(cell_entry_arc(CELL, [left, right]))

    def test_the_cells_own_outline_is_not_a_cable(self):
        x0, y0, x1, y1 = CELL
        outline = _segment([(y0 - 2, x) for x in range(x0 - 2, x1 + 3)])
        cable = _segment([(140, x) for x in range(40, 179)])
        self.assertEqual(cell_entry_arc(CELL, [outline, cable]), 1)


class SolverOwnership(unittest.TestCase):
    def _solve(self, labels, segments):
        wire = np.zeros((300, 420), dtype=bool)
        return solve(segments, set(), labels, lambda *_args: False, lambda *_args: None,
                     wire, 420, 300)

    def test_a_cell_code_seeds_the_cable_entering_the_cell_not_the_nearest_wire(self):
        cable = _segment([(140, x) for x in range(40, 179)])
        passing = _segment([(175, x) for x in range(150, 400)])      # 35 px below the code
        loose = self._solve([_label("DBL/W", 240, 140)], [cable, passing])
        self.assertEqual([si for _label_, si in loose["seeds"]], [1])  # the old behaviour
        boxed = self._solve([_label("DBL/W", 240, 140, cell=CELL)], [cable, passing])
        self.assertEqual([si for _label_, si in boxed["seeds"]], [0])

    def test_a_cell_code_with_no_cable_entering_is_not_used(self):
        passing = _segment([(175, x) for x in range(150, 400)])
        sol = self._solve([_label("DBL/W", 240, 140, cell=CELL)], [passing])
        self.assertEqual(sol["seeds"], [])


if __name__ == "__main__":
    unittest.main()
