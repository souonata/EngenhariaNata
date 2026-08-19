"""verdict_for grades a sheet on LEGEND REALIZATION, not paint rate, once it has enough legends.

Paint rate divides painted runs by ALL runs, so a furniture-dense sheet -- a gasoline or sterndrive
diagram that is mostly component, connector, rail and relay outlines, with SB=black as a common
insulation colour -- reads "weak" even when every printed colour was faithfully applied (measured:
pub47 37% paint rate / 93% legends realized, pub93 33% / 100%). The verdict must not call those weak.
When there are too few legends to trust realization, it falls back to the old paint-rate rule.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.tools.qa_dashboard import (REALIZATION_GOOD, REALIZATION_MIN_LEGENDS,
                                          REALIZATION_PARTIAL, verdict_for)


def sheet(paint_rate=0.5, legends=40, realized=None, unpainted_nearby=0, **extra):
    signals = {"unpainted_with_nearby_legend": unpainted_nearby,
               "colour_change_junctions": 0, "bare_codes_refused": 0}
    if realized is not None:
        signals["legend_realization"] = realized
        signals["legends_realized"] = round(realized * legends)
    return {"runs": max(legends * 2, 60), "legends": legends, "paint_rate": paint_rate,
            "signals": signals, **extra}


class RealizationDrivesVerdict(unittest.TestCase):
    def test_furniture_dense_but_fully_realized_is_good_not_weak(self):
        # pub93: a third of runs painted, but every printed colour reached a wire
        v = verdict_for(sheet(paint_rate=0.33, legends=80, realized=1.0))
        self.assertEqual(v, "good")

    def test_low_paint_rate_high_realization_is_good(self):
        # pub47: 37% paint rate, 93% of codes realized
        v = verdict_for(sheet(paint_rate=0.37, legends=146, realized=0.93))
        self.assertEqual(v, "good")

    def test_most_codes_realized_is_partial(self):
        v = verdict_for(sheet(paint_rate=0.4, legends=40, realized=0.80))
        self.assertEqual(v, "partial")

    def test_codes_not_reaching_wires_is_weak_even_at_high_paint_rate(self):
        # a genuine failure: lots of geometry coloured, but the printed codes are NOT on the wires
        v = verdict_for(sheet(paint_rate=0.9, legends=40, realized=0.40))
        self.assertEqual(v, "weak")

    def test_thresholds_are_boundary_correct(self):
        self.assertEqual(verdict_for(sheet(legends=40, realized=REALIZATION_GOOD)), "good")
        self.assertEqual(verdict_for(sheet(legends=40, realized=REALIZATION_PARTIAL)), "partial")
        self.assertEqual(verdict_for(sheet(legends=40, realized=REALIZATION_PARTIAL - 0.01)), "weak")


class FallbackWhenRealizationUntrustworthy(unittest.TestCase):
    def test_too_few_legends_falls_back_to_paint_rate(self):
        # below the legend floor, one missed code would swing realization wildly -> trust paint rate
        few = REALIZATION_MIN_LEGENDS - 1
        self.assertEqual(verdict_for(sheet(paint_rate=0.95, legends=few, realized=0.3)), "good")
        self.assertEqual(verdict_for(sheet(paint_rate=0.30, legends=few, realized=1.0)), "weak")

    def test_old_record_without_signal_uses_paint_rate(self):
        # a round recorded before the signal existed has no legend_realization key
        self.assertEqual(verdict_for(sheet(paint_rate=0.95, legends=40, realized=None)), "good")
        self.assertEqual(verdict_for(sheet(paint_rate=0.30, legends=40, realized=None)), "weak")
        self.assertEqual(
            verdict_for(sheet(paint_rate=0.9, legends=40, realized=None, unpainted_nearby=20)),
            "partial")


class GatesUnaffected(unittest.TestCase):
    def test_declined_and_crashed_and_no_geometry_still_short_circuit(self):
        self.assertEqual(verdict_for({"declined": True}), "declined")
        self.assertEqual(verdict_for({"crashed": True}), "no-geometry")
        # a raster foldout: many codes, almost no strokes -> no-geometry regardless of realization
        s = sheet(paint_rate=0.0, legends=100, realized=0.0)
        s["runs"] = 5
        self.assertEqual(verdict_for(s), "no-geometry")


if __name__ == "__main__":
    unittest.main()
