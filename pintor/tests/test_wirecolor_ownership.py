"""Regression tests for physical-wire colour ownership boundaries."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.detect.solver import solve
from wirecolor.detect.components import (
    cut_inline_component_zones,
    extend_boundary_with_inline_components,
    find_inline_component_zones,
)
from wirecolor.detect.skeleton import build_segments
from wirecolor.labels.conventions import load_convention
from wirecolor.labels.parse import parse_code, parse_wire_id
from wirecolor.multiscale import PageScene, collect_multiscale_evidence
from wirecolor.paint.raster_overlay import build_overlay_rgba
from wirecolor.pipeline import resolve_physical_wire_colors, resolved_label_ids
import wirecolor.pipeline as pipeline
from wirecolor.prep import Transform


def _segment(points):
    k = min(14, len(points) - 1)
    return {
        "order": points,
        "ends": [points[0], points[-1]],
        "tang": [
            (points[0][0] - points[k][0], points[0][1] - points[k][1]),
            (points[-1][0] - points[-1 - k][0], points[-1][1] - points[-1 - k][1]),
        ],
    }


def _label(code, raw, cx, cy, vertical=False):
    w, h = (24, 100) if vertical else (100, 24)
    return {
        "code": code, "raw": raw, "score": 0.99,
        "cx": cx, "cy": cy, "w": w, "h": h,
        "box": [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2],
                [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]],
    }


class ConventionRegistryTests(unittest.TestCase):
    def test_loader_rejects_path_traversal(self):
        with self.assertRaises(ValueError):
            load_convention("../private")


class OcrWireIdTests(unittest.TestCase):
    def test_vertical_ocr_wire_id_variants_do_not_hide_colour(self):
        convention = load_convention("volvo_classic")
        for raw in ("0.75 BL (w192)", "0.75 BL (WI92)",
                    "0.75 BL (W|92)", "0.75 BL (wI92"):
            with self.subTest(raw=raw):
                self.assertEqual(parse_code(raw, convention), "BL")

    def test_ocr_wire_id_variants_normalize_to_same_identity(self):
        for raw in ("0.75 BL (w192)", "0.75 BL (WI92)",
                    "0.75 BL (W|92)", "0.75 BL (wL92"):
            with self.subTest(raw=raw):
                self.assertEqual(parse_wire_id(raw), "W192")

    def test_local_strong_read_upgrades_nearby_bare_same_code_token(self):
        convention = load_convention("volvo_classic")
        old_engine = pipeline._ENGINE

        def fake_engine(_image):
            return [
                ([[20, 80], [58, 80], [58, 110], [20, 110]], "25", 0.96),
                ([[64, 80], [86, 80], [86, 110], [64, 110]], "R", 0.95),
            ]

        pipeline._ENGINE = fake_engine
        try:
            bare = _label("R", "R", 27, 47)
            found = pipeline._reocr_region(
                np.zeros((100, 100, 3), dtype=np.uint8),
                0, 0, 100, 100, convention, [bare])
        finally:
            pipeline._ENGINE = old_engine

        self.assertTrue(any(code == "R" and "25" in raw for code, raw, *_rest in found))

    def test_close_parallel_wire_id_is_not_suppressed_as_same_ocr_label(self):
        convention = load_convention("volvo_classic")
        old_engine = pipeline._ENGINE

        def fake_engine(_image):
            return [
                ([[40, 80], [180, 80], [180, 110], [40, 110]],
                  "25 R (w2)", 0.99),
            ]

        pipeline._ENGINE = fake_engine
        try:
            known = _label("R", "25 R (w1)", 55, 47)
            found = pipeline._reocr_region(
                np.zeros((100, 100, 3), dtype=np.uint8),
                0, 0, 100, 100, convention, [known])
        finally:
            pipeline._ENGINE = old_engine

        self.assertTrue(found)
        self.assertTrue(all("w2" in observation[1] for observation in found))
        self.assertTrue(all(len(observation) == 7 for observation in found))


class ColourBoundaryTests(unittest.TestCase):
    def _inline_symbol_fixture(self, blade=True):
        gray = np.full((140, 220), 255, np.uint8)
        import cv2
        cv2.line(gray, (10, 70), (68, 70), 80, 2)
        cv2.line(gray, (152, 70), (210, 70), 80, 2)
        cv2.circle(gray, (80, 70), 8, 80, 2)
        cv2.circle(gray, (140, 70), 8, 80, 2)
        if blade:
            cv2.line(gray, (85, 55), (136, 68), 80, 2)
        binary = gray < 210
        n, _labels, stats, centres = cv2.connectedComponentsWithStats(
            (~binary).astype(np.uint8), 8)
        holes = [
            (float(centres[i][0]), float(centres[i][1]),
             int(max(stats[i, 2], stats[i, 3])))
            for i in range(1, n)
            if 8 <= stats[i, 4] <= 250 and stats[i, 2] <= 22 and stats[i, 3] <= 22
        ]
        segment = _segment([(70, x) for x in range(10, 211)])
        return gray, segment, holes

    def test_open_contact_symbol_creates_a_protected_capsule(self):
        gray, segment, holes = self._inline_symbol_fixture(blade=True)

        zones = find_inline_component_zones(gray, [segment], {0: (0, ["BL"])}, holes)

        self.assertEqual(len(zones), 1)
        self.assertAlmostEqual((zones[0][0] + zones[0][2]) / 2, 110, delta=3)

    def test_component_arcs_share_physical_colour_not_segment_identity(self):
        gray, _ignored_segment, holes = self._inline_symbol_fixture(blade=True)
        segments = [
            _segment([(70, x) for x in range(10, 86)]),
            _segment([(70, x) for x in range(90, 131)]),
            _segment([(70, x) for x in range(136, 211)]),
        ]
        claims = {i: (i, ["BL"]) for i in range(3)}

        zones = find_inline_component_zones(gray, segments, claims, holes)

        self.assertEqual(len(zones), 1)

    def test_plain_terminal_circles_without_component_ink_do_not_punch_a_wire(self):
        gray, segment, holes = self._inline_symbol_fixture(blade=False)

        zones = find_inline_component_zones(gray, [segment], {0: (0, ["BL"])}, holes)

        self.assertEqual(zones, [])

    def test_inline_component_capsule_splits_one_construction_line_into_two_roots(self):
        wire = np.zeros((140, 220), dtype=bool)
        wire[70, 10:211] = True
        cut = cut_inline_component_zones(
            wire, ((80, 70, 140, 70, 22),))
        segments = build_segments(cut)

        self.assertEqual(len(segments), 2)
        sol = solve(
            segments, set(), [], lambda *_args: False, lambda *_args: None,
            cut, 220, 140)

        self.assertNotEqual(sol["nfind"](0), sol["nfind"](1))

    def test_colour_like_component_text_cannot_rejoin_cut_leads(self):
        wire = np.zeros((140, 220), dtype=bool)
        wire[70, 10:211] = True
        zone = (80, 70, 140, 70, 22)
        cut = cut_inline_component_zones(wire, (zone,))
        segments = build_segments(cut)
        boundary = extend_boundary_with_inline_components(
            lambda *_args: False, (zone,))
        annotation = _label("R", "25 R", 110, 70)

        sol = solve(
            segments, set(), [annotation], boundary, lambda *_args: None,
            cut, 220, 140)

        self.assertNotEqual(sol["nfind"](0), sol["nfind"](1))
        self.assertFalse(sol["seeds"])

    def test_conflict_moves_to_parallel_wire_with_other_end_corroboration(self):
        segments = [
            _segment([(100, x) for x in range(20, 121)]),
            _segment([(y, 120) for y in range(100, 221)]),
            _segment([(140, x) for x in range(20, 121)]),
        ]
        yellow = _label("Y", "0.75 Y (w1)", 60, 110)
        blue = _label("BL", "0.75 BL (w2)", 130, 180, vertical=True)
        yellow_other_end = _label("Y", "0.75 Y (w3)", 100, 150)
        sol = {
            "nfind": lambda si: 0 if si in (0, 1) else 2,
            "live": [0, 1, 2],
            "seeds": [(yellow, 0), (blue, 1), (yellow_other_end, 2)],
            "claims": {0: (0, ["Y"]), 1: (0, ["Y"]), 2: (0, ["Y"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["moved"], 1)
        self.assertEqual(sol["claims"][0][1], ["BL"])
        self.assertEqual(sol["claims"][1][1], ["BL"])
        self.assertEqual(sol["claims"][2][1], ["Y"])

    def test_open_inline_component_gap_is_not_painted_through(self):
        segments = [
            _segment([(50, x) for x in range(10, 61)]),
            _segment([(50, x) for x in range(120, 171)]),
        ]
        mate = {(0, 1): (1, 0), (1, 0): (0, 1)}
        solution = {
            "segments": segments,
            "convention": load_convention("volvo_classic"),
            "solver": {
                "mate": mate, "at_dot": set(),
                "claims": {0: (0, ["BL"]), 1: (1, ["BL"])},
                "dot_arcs": {},
            },
            "bridge_twist": set(), "twist": set(),
            "housings": [], "terminal_dots": set(), "holes": [],
            "dclaims": {}, "dgroups": {},
        }

        overlay = build_overlay_rgba(
            solution, np.full((100, 200, 3), 255, np.uint8), Transform(1.0, 1.0))

        self.assertEqual(int(overlay[50, 90, 3]), 0)

    def test_recognised_twist_gap_remains_paintable(self):
        segments = [
            _segment([(50, x) for x in range(10, 61)]),
            _segment([(50, x) for x in range(120, 171)]),
            _segment([(y, 90) for y in range(35, 66)]),
        ]
        mate = {(0, 1): (1, 0), (1, 0): (0, 1)}
        solution = {
            "segments": segments,
            "convention": load_convention("volvo_classic"),
            "solver": {
                "mate": mate, "at_dot": set(),
                "claims": {0: (0, ["BL"]), 1: (1, ["BL"])},
                "dot_arcs": {},
            },
            "bridge_twist": {2}, "twist": {2},
            "housings": [], "terminal_dots": set(), "holes": [],
            "dclaims": {}, "dgroups": {},
        }

        overlay = build_overlay_rgba(
            solution, np.full((100, 200, 3), 255, np.uint8), Transform(1.0, 1.0))

        self.assertGreater(int(overlay[50, 90, 3]), 0)

    def test_unresolved_conflicting_wire_is_left_unpainted(self):
        segments = [_segment([(100, x) for x in range(20, 181)])]
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [
                (_label("Y", "0.75 Y (w1)", 50, 90), 0),
                (_label("BL", "0.75 BL (w2)", 150, 90), 0),
            ],
            "claims": {0: (0, ["Y"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["unresolved"], 1)
        self.assertNotIn(0, sol["claims"])
        self.assertEqual(sol["unresolved_roots"], {0})

    def test_one_provisional_crop_conflict_cannot_erase_overview_owned_wire(self):
        segments = [_segment([(100, x) for x in range(20, 421)])]
        overview = _label("OR", "0.75 OR (w91)", 60, 90)
        crop_noise = _label("GN", "0.75 GN (w92)", 330, 90)
        crop_noise["_provenance"] = "multiscale"
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(overview, 0), (crop_noise, 0)],
            "claims": {0: (0, ["OR"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["unresolved"], 0)
        self.assertEqual(result["ignored_provisional"], 1)
        self.assertEqual(sol["claims"][0][1], ["OR"])

    def test_close_same_colour_wire_ids_survive_final_resolver_dedup(self):
        segments = [
            _segment([(100, x) for x in range(20, 421)]),
            _segment([(108, x) for x in range(20, 421)]),
        ]
        w1 = _label("R", "25 R (w1)", 60, 100)
        w2 = _label("R", "25 R (w2)", 60, 108)
        sol = {
            "nfind": lambda si: si,
            "live": [0, 1],
            "seeds": [(w1, 0), (w2, 1)],
            "claims": {0: (0, ["R"]), 1: (0, ["R"])},
        }

        resolve_physical_wire_colors(segments, sol)

        self.assertEqual(len(sol["seeds"]), 2)
        self.assertEqual(sol["claims"][0][1], ["R"])
        self.assertEqual(sol["claims"][1][1], ["R"])

    def test_single_unique_remote_conflict_keeps_long_wire_unresolved(self):
        segments = [_segment([(100, x) for x in range(20, 821)])]
        overview = _label("OR", "0.75 OR (w91)", 60, 90)
        remote = _label("GN", "0.75 GN", 700, 90)
        remote["_provenance"] = "multiscale"
        remote["_candidate_roots"] = [0]
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(overview, 0), (remote, 0)],
            "claims": {0: (0, ["OR"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["unresolved"], 1)
        self.assertEqual(result["ignored_provisional"], 0)
        self.assertNotIn(0, sol["claims"])
        self.assertEqual(sol["unresolved_roots"], {0})

    def test_unique_remote_different_wire_id_is_not_silently_quarantined(self):
        segments = [_segment([(100, x) for x in range(20, 821)])]
        overview = _label("OR", "0.75 OR (w91)", 60, 90)
        remote = _label("GN", "0.75 GN (w92)", 700, 90)
        remote["_provenance"] = "multiscale"
        remote["_candidate_roots"] = [0]
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(overview, 0), (remote, 0)],
            "claims": {0: (0, ["OR"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["unresolved"], 1)
        self.assertEqual(result["ignored_provisional"], 0)
        self.assertNotIn(0, sol["claims"])

    def test_independent_remote_crop_conflicts_keep_wire_unpainted(self):
        segments = [_segment([(100, x) for x in range(20, 821)])]
        overview = _label("OR", "0.75 OR (w91)", 60, 90)
        crop_a = _label("GN", "0.75 GN", 350, 90)
        crop_b = _label("GN", "0.75 GN", 720, 90)
        crop_a["_provenance"] = crop_b["_provenance"] = "multiscale"
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(overview, 0), (crop_a, 0), (crop_b, 0)],
            "claims": {0: (0, ["OR"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["unresolved"], 1)
        self.assertEqual(result["ignored_provisional"], 0)
        self.assertNotIn(0, sol["claims"])
        self.assertEqual(sol["unresolved_roots"], {0})

    def test_neighbour_wire_id_cannot_veto_explicit_overview_wire_id(self):
        segments = [_segment([(100, x) for x in range(20, 821)])]
        overview = _label("OR", "0.75 OR (w91)", 60, 90)
        crop_a = _label("GN", "0.75 GN (w92)", 350, 90)
        crop_b = _label("GN", "0.75 GN (w92)", 720, 90)
        crop_a["_provenance"] = crop_b["_provenance"] = "multiscale"
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(overview, 0), (crop_a, 0), (crop_b, 0)],
            "claims": {0: (0, ["OR"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["unresolved"], 0)
        self.assertEqual(result["ignored_provisional"], 2)
        self.assertEqual(sol["claims"][0][1], ["OR"])

    def test_exact_parallel_tie_uses_wire_id_owner_not_lower_root_number(self):
        segments = [
            _segment([(y, 2807) for y in range(1700, 3401)]),
            _segment([(y, 2886) for y in range(1700, 3401)]),
        ]
        w91 = _label("OR", "0.75 OR (W91)", 2768.0, 3221.5, vertical=True)
        w92 = _label("GN", "0.75 GN (W92)", 2925.0, 3221.0, vertical=True)
        tied_crop = _label("GN", "GN (w92)", 2846.5, 3154.0, vertical=True)
        tied_crop["_provenance"] = "multiscale"
        tied_crop["_candidate_roots"] = [0, 1]
        sol = {
            "nfind": lambda si: si,
            "live": [0, 1],
            # Nearest-neighbour mapping chose lower root 0 for the exact tie.
            "seeds": [(w91, 0), (w92, 1), (tied_crop, 0)],
            "claims": {0: (0, ["OR"]), 1: (0, ["GN"])},
        }

        result = resolve_physical_wire_colors(segments, sol)

        self.assertEqual(result["moved"], 1)
        self.assertEqual(result["unresolved"], 0)
        self.assertEqual(sol["claims"][0][1], ["OR"])
        self.assertEqual(sol["claims"][1][1], ["GN"])
        moved_seed = next((label, home) for label, home in sol["seeds"]
                          if label is tied_crop)
        self.assertEqual(sol["nfind"](moved_seed[1]), 1)

    def test_only_final_matching_solid_label_is_reserved_from_dash_scene(self):
        # A real conductor (a long traced wire) owning exactly this code reserves its legend.
        wire = _segment([(90, x) for x in range(20, 421)])
        fragment = _segment([(200, x) for x in range(20, 33)])
        owned = _label("Y", "0.75 Y (w236)", 50, 60)
        merely_considered = _label("R", "25 R", 150, 190)
        sol = {
            "nfind": lambda si: si,
            "live": [0, 1],
            "seeds": [(owned, 0), (merely_considered, 1)],
            "claims": {0: (0, ["Y"])},
        }

        stable = resolved_label_ids(sol, [wire, fragment])

        self.assertIn(id(owned), stable)
        self.assertNotIn(id(merely_considered), stable)

    def test_a_stroke_sized_fragment_cannot_confiscate_a_cables_legend(self):
        # Round 16 (pub 2503 '70 SB'): the solid tracer picked up ONE dash stroke of a heavy
        # dashed cable.  That 13-point root satisfied "claims collapse to exactly this code"
        # purely because the label was its only evidence, and took the legend away from the
        # 36-stroke conductor the text is actually printed on.
        fragment = _segment([(90, x) for x in range(7256, 7269)])
        lone = _label("SB", "70 SB", 7262, 4252)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(lone, 0)],
            "claims": {0: (0, ["SB"])},
        }

        self.assertEqual(resolved_label_ids(sol, [fragment]), set())

    def test_a_short_wire_may_still_reserve_when_a_second_reading_agrees(self):
        fragment = _segment([(90, x) for x in range(20, 33)])
        legend = _label("SB", "70 SB", 30, 60)
        elsewhere = _label("SB", "70 SB", 600, 60)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(legend, 0), (elsewhere, 0)],
            "claims": {0: (0, ["SB"])},
        }

        self.assertEqual(len(resolved_label_ids(sol, [fragment])), 2)

    def test_re_reading_one_printed_legend_is_not_corroboration(self):
        # The tiled pass and a contextual zoom routinely see the same printed text twice.  Two
        # reads of ONE legend are one piece of evidence, not two.
        fragment = _segment([(90, x) for x in range(20, 33)])
        overview = _label("SB", "70 SB", 7262, 4252)
        same_text_again = _label("SB", "70 SB", 7268, 4250)
        same_text_again["_provenance"] = "multiscale"
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(overview, 0), (same_text_again, 0)],
            "claims": {0: (0, ["SB"])},
        }

        self.assertEqual(resolved_label_ids(sol, [fragment]), set())

    def test_bare_evidence_cannot_corroborate_a_reservation(self):
        fragment = _segment([(90, x) for x in range(20, 33)])
        legend = _label("SB", "70 SB", 30, 60)
        bare = _label("SB", "SB", 600, 60)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(legend, 0), (bare, 0)],
            "claims": {0: (0, ["SB"])},
        }

        self.assertEqual(resolved_label_ids(sol, [fragment]), set())

    def test_bare_dash_evidence_cannot_override_gauged_evidence(self):
        segments = [_segment([(100, x) for x in range(20, 181)])]
        strong = _label("R", "25 R", 60, 88)
        weak = _label("SB", "SB", 140, 88)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(strong, 0), (weak, 0)],
            "claims": {0: (0, ["R"])},
        }

        result = resolve_physical_wire_colors(segments, sol, include_bare=True)

        self.assertEqual(result["unresolved"], 0)
        self.assertEqual(sol["claims"][0][1], ["R"])

    def test_a_lone_bare_letter_never_colours_an_unbounded_route(self):
        # Round 16: a dashed enclosure frame ("STARTER MOTOR") runs for thousands of pixels past
        # unrelated text, so single glyphs land on it.  Three such letters made the frame look
        # labelled, defeated the unlabelled-frame guard and left a real conductor unresolved.
        segments = [_segment([(100, x) for x in range(20, 900)])]
        stray = _label("T", "T", 400, 88)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(stray, 0)],
            "claims": {},
        }

        resolve_physical_wire_colors(segments, sol, include_bare=True)

        self.assertNotIn(0, sol["claims"])

    def test_two_agreeing_bare_readings_do_colour_a_route(self):
        segments = [_segment([(100, x) for x in range(20, 900)])]
        first = _label("R", "R", 200, 88)
        second = _label("R", "R", 700, 88)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(first, 0), (second, 0)],
            "claims": {},
        }

        resolve_physical_wire_colors(segments, sol, include_bare=True)

        self.assertEqual(sol["claims"][0][1], ["R"])

    def test_a_lone_bare_letter_still_colours_a_component_bounded_lead(self):
        # A varistor-to-engine-body lead has no room for a gauged legend: the drawing prints the
        # bare colour beside it and that single letter IS the label.
        segments = [_segment([(100, x) for x in range(20, 120)])]
        legend = _label("R", "R", 70, 88)
        sol = {
            "nfind": lambda _si: 0,
            "live": [0],
            "seeds": [(legend, 0)],
            "claims": {},
            "scene_boundary_bounded_roots": {0},
        }

        resolve_physical_wire_colors(segments, sol, include_bare=True)

        self.assertEqual(sol["claims"][0][1], ["R"])

    def test_component_housing_is_a_hard_boundary_for_solid_gap(self):
        segments = [
            _segment([(100, x) for x in range(20, 101)]),
            _segment([(100, x) for x in range(180, 261)]),
        ]

        def housing(x, y, margin=0):
            return 110 - margin <= x <= 170 + margin \
                and 80 - margin <= y <= 120 + margin

        sol = solve(
            segments, set(), [], housing, lambda *_args: None,
            np.zeros((220, 320), dtype=bool), 320, 220,
        )

        self.assertNotEqual(sol["nfind"](0), sol["nfind"](1))

    def test_real_splice_is_not_a_colour_union(self):
        segments = [
            _segment([(100, x) for x in range(20, 101)]),
            _segment([(100, x) for x in range(100, 181)]),
        ]
        labels = [
            _label("R", "0.75 R (w1)", 55, 88),
            _label("BL", "0.75 BL (w2)", 145, 88),
        ]

        def dot_near(y, x, _r=0):
            return (100, 100) if abs(y - 100) <= 8 and abs(x - 100) <= 8 else None

        sol = solve(
            segments, set(), labels, lambda _x, _y, _m=0: False,
            dot_near, np.zeros((240, 240), dtype=bool), 240, 240,
            color_boundary_dots={(100, 100)},
        )

        self.assertNotEqual(sol["nfind"](0), sol["nfind"](1))
        self.assertEqual(sol["claims"][0][1], ["R"])
        self.assertEqual(sol["claims"][1][1], ["BL"])


class MultiscaleSceneTests(unittest.TestCase):
    def _solution(self, segments, roots, seeds):
        return {
            "nfind": lambda si: roots[si],
            "live": list(range(len(segments))),
            "mate": {},
            "seeds": list(seeds),
            "all_labels": [label for label, _home in seeds],
            "claims": {},
        }

    def test_remote_zoom_adds_evidence_to_the_same_global_wire(self):
        segments = [_segment([(100, x) for x in range(20, 921)])]
        first = _label("BL", "0.75 BL (w1)", 60, 90)
        sol = self._solution(segments, [0], [(first, 0)])
        calls = []

        def fake_reocr(_img, x0, y0, x1, y1, _convention, _known):
            calls.append((x0, y0, x1, y1))
            if x0 <= 850 <= x1 and y0 <= 90 <= y1:
                return [("BL", "0.75 BL (w1)", 850, 90, False, 0.99)]
            return []

        result = collect_multiscale_evidence(
            np.zeros((300, 1000, 3), dtype=np.uint8), segments, sol, None,
            1000, 300, fake_reocr)

        self.assertTrue(calls)
        self.assertEqual(len(result["recovered"]), 1)
        self.assertEqual(sol["nfind"](result["recovered"][0][1]), 0)
        self.assertEqual(len(sol["seeds"]), 2)

    def test_single_code_wire_is_audited_along_its_full_route(self):
        segments = [_segment([(100, x) for x in range(20, 5021)])]
        first = _label("BL", "0.75 BL (w1)", 60, 90)
        sol = self._solution(segments, [0], [(first, 0)])
        calls = []
        emitted = False

        def fake_reocr(_img, x0, y0, x1, y1, _convention, _known):
            nonlocal emitted
            calls.append((x0, y0, x1, y1))
            if not emitted and x0 <= 2500 <= x1:
                emitted = True
                return [("R", "0.75 R (w2)", 2500, 90, False, 0.99)]
            return []

        result = collect_multiscale_evidence(
            np.zeros((300, 5200, 3), dtype=np.uint8), segments, sol, None,
            5200, 300, fake_reocr)

        self.assertTrue(any(x0 <= 2500 <= x1 for x0, _y0, x1, _y1 in calls))
        self.assertTrue(any(label["code"] == "R" for label, _home in result["recovered"]))

    def test_ambiguous_strong_provisional_has_no_owner_without_corroboration(self):
        segments = [
            _segment([(100, x) for x in range(20, 421)]),
            _segment([(120, x) for x in range(20, 421)]),
        ]
        sol = self._solution(segments, [0, 1], [])
        sol["scene_require_hard_boundary"] = False
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [("R", "25 R", 220, 110, False, 0.99)]

        result = collect_multiscale_evidence(
            np.zeros((300, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 300, fake_reocr)

        self.assertEqual(result["recovered"], [])

    def test_close_same_colour_labels_on_different_wires_are_not_deduplicated(self):
        segments = [
            _segment([(100, x) for x in range(20, 421)]),
            _segment([(140, x) for x in range(20, 421)]),
        ]
        sol = self._solution(segments, [0, 1], [])
        sol["scene_require_hard_boundary"] = False
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [
                ("R", "25 R (w1)", 220, 105, False, 0.99),
                ("R", "25 R (w2)", 220, 135, False, 0.98),
            ]

        result = collect_multiscale_evidence(
            np.zeros((300, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 300, fake_reocr)

        self.assertEqual(len(result["recovered"]), 2)
        for label, _home in result["recovered"]:
            xs = [point[0] for point in label["box"]]
            ys = [point[1] for point in label["box"]]
            self.assertEqual(max(xs) - min(xs), label["w"])
            self.assertEqual(max(ys) - min(ys), label["h"])

    def test_production_ocr_polygon_is_preserved_on_recovered_label(self):
        segments = [_segment([(150, x) for x in range(20, 421)])]
        sol = self._solution(segments, [0], [])
        sol["scene_require_hard_boundary"] = False
        emitted = False
        observed_box = [[190, 132], [250, 132], [250, 152], [190, 152]]

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [("R", "25 R", 220, 142, False, 0.99, observed_box)]

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 500, fake_reocr)

        label = result["recovered"][0][0]
        self.assertEqual(label["box"], observed_box)
        self.assertEqual((label["w"], label["h"]), (60.0, 20.0))

    def test_scene_memory_preserves_global_paths_across_crossing_and_curve_arcs(self):
        segments = [
            _segment([(100, x) for x in range(20, 101)]),
            _segment([(100, x) for x in range(100, 181)]),
            _segment([(y, 100) for y in range(20, 101)]),
            _segment([(y, 100) for y in range(100, 181)]),
            _segment([(100 + i, 180 + i // 2) for i in range(81)]),
        ]
        # The horizontal conductor continues through the crossing and around the curved arc;
        # the vertical conductor remains a separate physical wire.
        sol = self._solution(segments, [0, 0, 2, 2, 0], [])
        sol["mate"] = {(0, 1): (1, 0), (1, 0): (0, 1),
                       (1, 1): (4, 0), (4, 0): (1, 1),
                       (2, 1): (3, 0), (3, 0): (2, 1)}

        scene = PageScene(segments, sol, 400, 300)

        self.assertEqual(set(scene.wires), {0, 2})
        self.assertEqual(scene.wires[0].segments, (0, 1, 4))
        self.assertEqual(scene.wires[2].segments, (2, 3))

    def test_T_node_ports_remain_splice_endpoints_in_the_global_scene(self):
        segments = [
            _segment([(100, x) for x in range(20, 91)]),
            _segment([(100, x) for x in range(110, 181)]),
            _segment([(y, 100) for y in range(120, 191)]),
        ]
        sol = self._solution(segments, [0, 1, 2], [])
        sol["connected_ports"] = {(0, 1), (1, 0), (2, 0)}
        sol["node_port_anchors"] = {
            (0, 1): (100, 100),
            (1, 0): (100, 100),
            (2, 0): (100, 100),
        }

        scene = PageScene(segments, sol, 300, 300)

        for root in (0, 1, 2):
            splice_ends = [endpoint for endpoint in scene.wires[root].endpoints
                           if endpoint.boundary == "splice"]
            self.assertEqual(len(splice_ends), 1)
            self.assertEqual((splice_ends[0].x, splice_ends[0].y), (100, 100))

    def test_bare_zoom_code_requires_unique_two_sided_periodic_route_support(self):
        segments = [
            _segment([(250, x) for x in range(200, 221)]),
            _segment([(250, x) for x in range(230, 251)]),
            _segment([(250, x) for x in range(260, 281)]),
        ]
        sol = self._solution(segments, [0, 0, 0], [])
        sol.update({
            "scene_min_wire_length": 40,
            "scene_require_hard_boundary": False,
            "scene_allow_bare_ocr": True,
            "scene_bare_evidence_counts": True,
        })
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            # Deliberately tall glyph box orientation; route geometry must recover horizontal.
            return [("R", "R", 240, 238, True, 0.99)]

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 500, fake_reocr)

        self.assertEqual(len(result["recovered"]), 1)
        self.assertEqual(result["recovered"][0][0]["_wire_axis"], "h")

    def test_tiny_glyph_root_in_competing_scene_cannot_veto_bare_wire_code(self):
        segments = [
            _segment([(250, x) for x in range(200, 221)]),
            _segment([(250, x) for x in range(230, 251)]),
            _segment([(250, x) for x in range(260, 281)]),
            # The solid skeleton saw one stroke of the OCR glyph itself as a micro-wire.
            _segment([(y, 240) for y in range(232, 247)]),
        ]
        own = self._solution(segments, [0, 0, 0, 3], [])
        own.update({
            "live": [0, 1, 2],
            "scene_min_wire_length": 40,
            "scene_require_hard_boundary": False,
            "scene_allow_bare_ocr": True,
            "scene_bare_evidence_counts": True,
        })
        foreign = self._solution(segments, [0, 0, 0, 3], [])
        foreign["live"] = [3]
        own["competing_scenes"] = [PageScene(segments, foreign, 500, 500)]
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [("R", "R", 240, 238, True, 0.999)]

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, own, None,
            500, 500, fake_reocr)

        self.assertEqual(len(result["recovered"]), 1)

    def test_real_conductor_in_competing_scene_still_vetoes_the_same_token(self):
        segments = [
            _segment([(250, x) for x in range(200, 221)]),
            _segment([(250, x) for x in range(230, 251)]),
            _segment([(250, x) for x in range(260, 281)]),
            _segment([(238, x) for x in range(20, 421)]),
        ]
        own = self._solution(segments, [0, 0, 0, 3], [])
        own.update({
            "live": [0, 1, 2],
            "scene_min_wire_length": 40,
            "scene_require_hard_boundary": False,
            "scene_allow_bare_ocr": True,
            "scene_bare_evidence_counts": True,
        })
        foreign_label = _label("R", "25 R", 60, 226)
        foreign = self._solution(segments, [0, 0, 0, 3], [(foreign_label, 3)])
        foreign["live"] = [3]
        foreign["claims"] = {3: (0, ["R"])}
        own["competing_scenes"] = [PageScene(segments, foreign, 500, 500)]
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [("R", "R", 240, 238, True, 0.999)]

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, own, None,
            500, 500, fake_reocr)

        self.assertEqual(result["recovered"], [])

    def test_bare_zoom_code_near_only_two_ticks_is_quarantined(self):
        segments = [
            _segment([(250, x) for x in range(200, 221)]),
            _segment([(250, x) for x in range(230, 251)]),
        ]
        sol = self._solution(segments, [0, 0], [])
        sol.update({
            "scene_min_wire_length": 20,
            "scene_require_hard_boundary": False,
            "scene_allow_bare_ocr": True,
            "scene_bare_evidence_counts": True,
        })
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [("R", "R", 225, 238, False, 0.99)]

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 500, fake_reocr)

        self.assertEqual(result["recovered"], [])

    def test_high_confidence_bare_code_can_label_two_component_bounded_strokes(self):
        segments = [
            _segment([(250, x) for x in range(200, 221)]),
            _segment([(250, x) for x in range(230, 251)]),
        ]
        sol = self._solution(segments, [0, 0], [])
        sol.update({
            "scene_min_wire_length": 20,
            "scene_require_hard_boundary": False,
            "scene_allow_bare_ocr": True,
            "scene_bare_evidence_counts": True,
            "scene_boundary_bounded_roots": {0},
        })
        emitted = False

        def fake_reocr(_img, _x0, _y0, _x1, _y1, _convention, _known):
            nonlocal emitted
            if emitted:
                return []
            emitted = True
            return [("R", "R", 225, 238, False, 0.99)]

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 500, fake_reocr)

        self.assertEqual(len(result["recovered"]), 1)

    def test_low_confidence_bare_code_cannot_label_two_component_bounded_strokes(self):
        segments = [
            _segment([(250, x) for x in range(200, 221)]),
            _segment([(250, x) for x in range(230, 251)]),
        ]
        sol = self._solution(segments, [0, 0], [])
        sol.update({
            "scene_min_wire_length": 20,
            "scene_require_hard_boundary": False,
            "scene_allow_bare_ocr": True,
            "scene_bare_evidence_counts": True,
            "scene_boundary_bounded_roots": {0},
        })

        result = collect_multiscale_evidence(
            np.zeros((500, 500, 3), dtype=np.uint8), segments, sol, None,
            500, 500,
            lambda *_args: [("R", "R", 225, 238, False, 0.90)])

        self.assertEqual(result["recovered"], [])

    def test_zoom_token_is_mapped_globally_not_forced_onto_crop_target(self):
        segments = [
            _segment([(100, x) for x in range(20, 921)]),
            _segment([(140, x) for x in range(20, 921)]),
        ]
        first_a = _label("R", "0.75 R (w1)", 60, 90)
        first_b = _label("BL", "0.75 BL (w2)", 60, 130)
        sol = self._solution(segments, [0, 1], [(first_a, 0), (first_b, 1)])
        emitted = False

        def fake_reocr(_img, x0, y0, x1, y1, _convention, _known):
            nonlocal emitted
            if not emitted and x0 <= 850 <= x1 and y0 <= 132 <= y1:
                emitted = True
                return [("BL", "0.75 BL (w2)", 850, 132, False, 0.99)]
            return []

        result = collect_multiscale_evidence(
            np.zeros((300, 1000, 3), dtype=np.uint8), segments, sol, None,
            1000, 300, fake_reocr)

        self.assertEqual(len(result["recovered"]), 1)
        self.assertEqual(sol["nfind"](result["recovered"][0][1]), 1)

    def test_every_uncertain_wire_gets_a_zoom_without_global_crop_cap(self):
        segments = []
        seeds = []
        roots = []
        for i in range(30):
            y = 40 + i * 30
            segments.append(_segment([(y, x) for x in range(20, 721)]))
            seeds.append((_label("BL", f"0.75 BL (w{i})", 50, y - 10), i))
            roots.append(i)
        sol = self._solution(segments, roots, seeds)

        result = collect_multiscale_evidence(
            np.zeros((1000, 800, 3), dtype=np.uint8), segments, sol, None,
            800, 1000, lambda *_args: [])

        # Each of the 30 wires receives a context view and, when that is inconclusive, a
        # closer detail view.  The old implementation stopped the whole page at 24 crops.
        self.assertGreaterEqual(result["crops"], 60)
        self.assertEqual(len(PageScene(segments, sol, 800, 1000).wires), 30)

    def test_text_inside_component_is_context_not_wire_colour_evidence(self):
        segments = [_segment([(100, x) for x in range(20, 921)])]
        first = _label("BL", "0.75 BL (w1)", 60, 90)
        sol = self._solution(segments, [0], [(first, 0)])
        sol["housings"] = ((400, 60, 100, 80),)
        emitted = False

        def fake_reocr(_img, x0, y0, x1, y1, _convention, _known):
            nonlocal emitted
            if not emitted and x0 <= 450 <= x1 and y0 <= 90 <= y1:
                emitted = True
                return [("R", "30 R", 450, 90, False, 0.99)]
            return []

        result = collect_multiscale_evidence(
            np.zeros((300, 1000, 3), dtype=np.uint8), segments, sol, None,
            1000, 300, fake_reocr)

        self.assertEqual(result["recovered"], [])
        self.assertEqual(len(result["scene"].objects), 1)

    def test_text_inside_inline_contact_is_not_wire_colour_evidence(self):
        segments = [_segment([(100, x) for x in range(20, 921)])]
        first = _label("BL", "0.75 BL (w1)", 60, 90)
        sol = self._solution(segments, [0], [(first, 0)])
        sol["inline_components"] = ((420, 100, 480, 100, 30),)
        emitted = False

        def fake_reocr(_img, x0, y0, x1, y1, _convention, _known):
            nonlocal emitted
            if not emitted and x0 <= 450 <= x1 and y0 <= 100 <= y1:
                emitted = True
                return [("R", "R", 450, 100, False, 0.999)]
            return []

        result = collect_multiscale_evidence(
            np.zeros((300, 1000, 3), dtype=np.uint8), segments, sol, None,
            1000, 300, fake_reocr)

        self.assertEqual(result["recovered"], [])
        self.assertEqual(len(result["scene"].objects), 1)


if __name__ == "__main__":
    unittest.main()
