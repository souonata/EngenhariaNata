"""Tests for the per-sheet drawing-style profile and the corpus priors built from it."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.profile import (
    aggregate_profiles,
    code_census,
    dash_rhythm,
    label_geometry,
    measure_sheet_profile,
    outliers,
    save_profile,
)


def _h(y, x0, x1):
    order = [(float(y), float(x0 + (x1 - x0) * i / 10)) for i in range(11)]
    return {"order": order, "ends": (order[0], order[-1])}


def _v(x, y0, y1):
    order = [(float(y0 + (y1 - y0) * i / 10), float(x)) for i in range(11)]
    return {"order": order, "ends": (order[0], order[-1])}


def _label(code, raw, cx, cy, w=100, h=24):
    return {"code": code, "raw": raw, "cx": cx, "cy": cy, "w": w, "h": h}


class DashRhythmTests(unittest.TestCase):
    def test_measures_the_page_rhythm_of_a_periodic_cable(self):
        # pitch 44, stroke 12 -- the rhythm measured by hand on pub 2503's power area.
        segments = [_h(100, 200 + i * 44, 212 + i * 44) for i in range(12)]

        rhythm = dash_rhythm(segments, [list(range(12))])

        self.assertEqual(rhythm["stroke"], 12.0)
        self.assertEqual(rhythm["pitch"], 44.0)
        self.assertEqual(rhythm["gap"], 32.0)
        self.assertEqual(rhythm["periods_measured"], 11)

    def test_a_corner_does_not_invent_a_period(self):
        horizontal = [_h(100, 200 + i * 44, 212 + i * 44) for i in range(4)]
        vertical = [_v(400, 120 + i * 44, 132 + i * 44) for i in range(4)]
        segments = horizontal + vertical

        rhythm = dash_rhythm(segments, [list(range(8))])

        self.assertEqual(rhythm["pitch"], 44.0)
        self.assertEqual(rhythm["periods_measured"], 6)

    def test_a_component_sized_hole_is_not_counted_as_a_period(self):
        segments = [_h(100, 200, 212), _h(100, 244, 256), _h(100, 900, 912)]

        rhythm = dash_rhythm(segments, [[0, 1, 2]])

        self.assertEqual(rhythm["pitch"], 44.0)
        self.assertEqual(rhythm["periods_measured"], 1)

    def test_no_dashed_route_yields_a_neutral_rhythm(self):
        self.assertEqual(dash_rhythm([], [])["periods_measured"], 0)


class CensusTests(unittest.TestCase):
    def test_census_counts_codes_and_gauges(self):
        labels = [_label("R", "70 R", 0, 0), _label("R", "25 R", 0, 0),
                  _label("SB", "70 SB", 0, 0), _label("R", "R", 0, 0)]

        census = code_census(labels)

        self.assertEqual(census["codes"], {"R": 3, "SB": 1})
        self.assertEqual(census["gauges"], {"70": 2, "25": 1})
        self.assertEqual(census["distinct_codes"], 2)

    def test_label_geometry_reports_orientation_mix(self):
        labels = [_label("R", "70 R", 0, 0), _label("R", "70 R", 0, 0, w=24, h=100)]

        geometry = label_geometry(labels)

        self.assertEqual(geometry["count"], 2)
        self.assertEqual(geometry["vertical_share"], 0.5)


class SheetProfileTests(unittest.TestCase):
    def _solution(self):
        segments = [_h(100, 200 + i * 44, 212 + i * 44) for i in range(6)]
        return {
            "W": 9362, "H": 6623, "segments": segments,
            "labels": [_label("SB", "70 SB", 240, 70)],
            "housings": ((0, 0, 10, 10),), "terminal_dots": frozenset({(1, 2)}),
            "inline_components": (), "dgroups": {0: list(range(6))},
            "convention": {"name": "volvo_classic"},
            "solver": {"claims": {0: (1, ["SB"])}, "painted": 1,
                       "unresolved_roots": set(),
                       "label_side_offset": {"vertical": -40, "horizontal": 0,
                                             "vertical_votes": 9, "horizontal_votes": 1}},
        }

    def test_profile_records_what_the_sheet_does(self):
        profile = measure_sheet_profile(self._solution(), {"rotation": 0, "dpi": 300})

        self.assertEqual(profile["page"]["width"], 9362)
        self.assertEqual(profile["page"]["native_dpi"], 300)
        self.assertEqual(profile["convention"], "volvo_classic")
        self.assertEqual(profile["dash_rhythm"]["pitch"], 44.0)
        self.assertEqual(profile["label_side_offset"]["vertical"], -40)
        self.assertEqual(profile["topology"]["dashed_routes"], 1)
        self.assertEqual(profile["codes"]["codes"], {"SB": 1})

    def test_profile_round_trips_through_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = save_profile(measure_sheet_profile(self._solution()),
                                str(Path(tmp) / "p.json"))
            with open(path, encoding="utf-8") as handle:
                self.assertEqual(json.load(handle)["dash_rhythm"]["stroke"], 12.0)


class CorpusPriorTests(unittest.TestCase):
    def _write(self, tmp, pitches):
        paths = []
        for index, pitch in enumerate(pitches):
            profile = {"dash_rhythm": {"pitch": pitch, "stroke": 12},
                       "label_side_offset": {"vertical": -40},
                       "topology": {"median_arc_length": 60},
                       "convention": "volvo_classic"}
            path = Path(tmp) / f"p{index}.json"
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(profile, handle)
            paths.append(str(path))
        return paths

    def test_priors_report_central_tendency_and_spread(self):
        with tempfile.TemporaryDirectory() as tmp:
            priors = aggregate_profiles(self._write(tmp, [44, 45, 43, 44]))

        self.assertEqual(priors["sheets"], 4)
        self.assertEqual(priors["dash_pitch"]["median"], 44.0)
        self.assertEqual(priors["conventions"], {"volvo_classic": 4})

    def test_empty_corpus_is_not_an_error(self):
        self.assertEqual(aggregate_profiles([])["sheets"], 0)

    def test_a_sheet_far_from_the_corpus_is_flagged_not_painted_blind(self):
        with tempfile.TemporaryDirectory() as tmp:
            priors = aggregate_profiles(self._write(tmp, [44, 45, 43, 44]))
        stranger = {"dash_rhythm": {"pitch": 120, "stroke": 12},
                    "label_side_offset": {"vertical": -40},
                    "topology": {"median_arc_length": 60}}

        flagged = outliers(stranger, priors)

        self.assertEqual([item["quantity"] for item in flagged], ["dash_pitch"])

    def test_a_sheet_inside_the_corpus_band_is_not_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            priors = aggregate_profiles(self._write(tmp, [44, 45, 43, 44]))
        ordinary = {"dash_rhythm": {"pitch": 46, "stroke": 12},
                    "label_side_offset": {"vertical": -38},
                    "topology": {"median_arc_length": 62}}

        self.assertEqual(outliers(ordinary, priors), [])


class PaintCoverageTests(unittest.TestCase):
    """Round 16 shipped a 52%-painted sheet as 'good'. Coverage must be visible per sheet."""

    def _solution(self, claims, dgroups=None):
        segments = [_h(100, 0, 1000), _h(200, 0, 1000),
                    _h(300, 0, 1000), _h(400, 0, 500)]
        return {"segments": segments, "solver": {"claims": claims},
                "dgroups": dgroups or {}, "edge_excluded": set(),
                "pin_border_arcs": set(), "twist": set()}

    def test_fully_painted_sheet_reports_one(self):
        from wirecolor.profile import paint_coverage
        claims = {i: (0, ["R"]) for i in range(4)}
        self.assertEqual(paint_coverage(self._solution(claims))["painted_ink_fraction"], 1.0)

    def test_half_painted_sheet_is_visible_not_hidden(self):
        from wirecolor.profile import paint_coverage
        report = paint_coverage(self._solution({0: (0, ["R"]), 1: (0, ["SB"])}))
        self.assertLess(report["painted_ink_fraction"], 0.65)
        self.assertGreater(report["painted_ink_fraction"], 0.5)

    def test_the_longest_unpainted_runs_are_named_with_coordinates(self):
        from wirecolor.profile import paint_coverage
        report = paint_coverage(self._solution({3: (0, ["R"])}))
        longest = report["longest_unpainted"][0]
        self.assertEqual(longest["length"], 1000)
        self.assertIn("from", longest)
        self.assertIn("to", longest)

    def test_dashed_routes_count_as_painted(self):
        from wirecolor.profile import paint_coverage
        report = paint_coverage(self._solution({}, dgroups={7: [0, 1, 2, 3]}))
        self.assertEqual(report["painted_ink_fraction"], 1.0)

    def test_excluded_furniture_is_not_reported_as_a_missing_wire(self):
        from wirecolor.profile import paint_coverage
        solution = self._solution({0: (0, ["R"])})
        solution["edge_excluded"] = {1, 2, 3}
        self.assertEqual(paint_coverage(solution)["longest_unpainted"], [])


if __name__ == "__main__":
    unittest.main()
