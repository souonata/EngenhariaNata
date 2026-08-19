"""Synthetic topology regressions for periodic heavy dashed conductors."""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.detect.dashes import filter_terminal_holes, solve_dashes


def _line(y0, x0, y1, x1, points=21):
    order = [
        (y0 + (y1 - y0) * i / (points - 1),
         x0 + (x1 - x0) * i / (points - 1))
        for i in range(points)
    ]
    return {"order": order, "ends": (order[0], order[-1])}


def _h(y, x0, x1):
    return _line(y, x0, y, x1)


def _v(x, y0, y1):
    return _line(y0, x, y1, x)


def _label(code, raw, cx, cy, vertical=False):
    w, h = (24, 100) if vertical else (100, 24)
    return {
        "code": code,
        "raw": raw,
        "score": 0.99,
        "cx": cx,
        "cy": cy,
        "w": w,
        "h": h,
        "box": ((cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2),
                (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)),
    }


def _no_housing(_x, _y, _margin=0):
    return False


def _groups(result):
    dgroups, _dclaims, unlabelled, _ports = result
    return [set(members) for members in dgroups.values()] + [
        set(members) for members in unlabelled.values()
    ]


def _group_for(groups, segment_index):
    return next(group for group in groups if segment_index in group)


class DashedTopologyTests(unittest.TestCase):
    def test_label_glyph_holes_are_not_electrical_boundaries(self):
        label = _label("R", "R", 100, 100)
        holes = ((100, 100, 12), (200, 100, 12))

        filtered = filter_terminal_holes(holes, [label], _no_housing)

        self.assertEqual(filtered, [(200, 100, 12)])

    def test_hole_inside_component_remains_terminal_even_under_label_box(self):
        label = _label("R", "R", 100, 100)

        def housing(x, y, margin=0):
            return 90 - margin <= x <= 110 + margin \
                and 90 - margin <= y <= 110 + margin

        filtered = filter_terminal_holes(((100, 100, 12),), [label], housing)

        self.assertEqual(filtered, [(100, 100, 12)])

    def test_known_terminal_hole_survives_overlapping_label_box(self):
        label = _label("R", "R", 100, 100)

        filtered = filter_terminal_holes(
            ((100, 100, 12),), [label], _no_housing,
            terminal_dots=((102, 99),))

        self.assertEqual(filtered, [(100, 100, 12)])

    def test_inline_contact_hole_survives_overlapping_label_box(self):
        label = _label("R", "R", 100, 100)

        filtered = filter_terminal_holes(
            ((100, 100, 12),), [label], _no_housing,
            inline_components=((80, 100, 120, 100, 18),))

        self.assertEqual(filtered, [(100, 100, 12)])

    def test_empty_dash_scene_keeps_the_complete_state_contract(self):
        result = solve_dashes(
            [], set(), [], _no_housing, return_state=True)

        self.assertEqual(result[:4], ({}, {}, {}, {}))
        self.assertEqual(result[4]["at_pin"], set())
        self.assertEqual(result[4]["boundary_bounded_short"], set())
        self.assertEqual(result[4]["node_port_anchors"], {})

    def test_forward_ray_L_joins_across_rhythm_sized_corner_gaps(self):
        for requested_gap in (24.0, 26.0, 33.0, 58.0):
            with self.subTest(gap=requested_gap):
                offset = requested_gap / math.sqrt(2)
                horizontal_end = 100 - offset
                vertical_start = 100 + offset
                segments = [
                    _h(100, horizontal_end - 80, horizontal_end - 60),
                    _h(100, horizontal_end - 50, horizontal_end - 30),
                    _h(100, horizontal_end - 20, horizontal_end),
                    _v(100, vertical_start, vertical_start + 20),
                    _v(100, vertical_start + 30, vertical_start + 50),
                    _v(100, vertical_start + 60, vertical_start + 80),
                ]

                groups = _groups(solve_dashes(
                    segments, set(), [], _no_housing,
                ))

                self.assertEqual(len(groups), 1)
                self.assertEqual(groups[0], set(range(6)))

    def test_forward_ray_L_does_not_cross_a_component_on_either_leg(self):
        offset = 33 / math.sqrt(2)
        horizontal_end = 100 - offset
        vertical_start = 100 + offset
        segments = [
            _h(100, horizontal_end - 80, horizontal_end - 60),
            _h(100, horizontal_end - 50, horizontal_end - 30),
            _h(100, horizontal_end - 20, horizontal_end),
            _v(100, vertical_start, vertical_start + 20),
            _v(100, vertical_start + 30, vertical_start + 50),
            _v(100, vertical_start + 60, vertical_start + 80),
        ]

        def housing(x, y, margin=0):
            return 77 - margin <= x <= 78 + margin \
                and 94 - margin <= y <= 106 + margin

        groups = _groups(solve_dashes(segments, set(), [], housing))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 3))

    def test_true_X_keeps_the_two_periodic_axes_separate(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 90),
            _h(100, 110, 120), _h(100, 130, 150), _h(100, 160, 180),
            _v(100, 20, 40), _v(100, 50, 70), _v(100, 80, 90),
            _v(100, 110, 120), _v(100, 130, 150), _v(100, 160, 180),
        ]

        groups = _groups(solve_dashes(segments, set(), [], _no_housing))

        self.assertEqual(len(groups), 2)
        self.assertEqual(_group_for(groups, 0), set(range(6)))
        self.assertEqual(_group_for(groups, 6), set(range(6, 12)))

    def test_T_is_an_electrical_node_and_keeps_three_physical_wires_separate(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 90),
            _h(100, 110, 120), _h(100, 130, 150), _h(100, 160, 180),
            _v(100, 122, 142), _v(100, 152, 172), _v(100, 182, 202),
        ]

        groups = _groups(solve_dashes(segments, set(), [], _no_housing))

        self.assertEqual(len(groups), 3)
        self.assertEqual(_group_for(groups, 0), {0, 1, 2})
        self.assertEqual(_group_for(groups, 3), {3, 4, 5})
        self.assertEqual(_group_for(groups, 6), {6, 7, 8})

        state = solve_dashes(
            segments, set(), [], _no_housing, return_state=True)[4]
        self.assertEqual(len(state["connected_ports"]), 3)
        self.assertEqual(set(state["node_port_anchors"]), state["connected_ports"])

    def test_different_colour_labels_do_not_cross_a_T_node(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 90),
            _h(100, 110, 120), _h(100, 130, 150), _h(100, 160, 180),
            _v(100, 122, 142), _v(100, 152, 172), _v(100, 182, 202),
        ]
        labels = [
            _label("SB", "25 SB", 30, 82),
            _label("R", "25 R", 170, 82),
        ]

        dgroups, dclaims, _unlabelled, _ports = solve_dashes(
            segments, set(), labels, _no_housing)
        root_by_segment = {
            member: root for root, members in dgroups.items() for member in members
        }

        self.assertNotEqual(root_by_segment[0], root_by_segment[3])
        self.assertEqual(dclaims[root_by_segment[0]][1], ["SB"])
        self.assertEqual(dclaims[root_by_segment[3]][1], ["R"])

    def test_T_does_not_cross_a_component_on_the_stem(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 90),
            _h(100, 110, 120), _h(100, 130, 150), _h(100, 160, 180),
            _v(100, 122, 142), _v(100, 152, 172), _v(100, 182, 202),
        ]

        def housing(x, y, margin=0):
            return 98 - margin <= x <= 102 + margin \
                and 114 - margin <= y <= 115 + margin

        groups = _groups(solve_dashes(segments, set(), [], housing))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 6))

    def test_terminal_legs_do_not_enable_a_151_pixel_battery_bridge(self):
        segments = [
            _h(100, -40, -20), _h(100, -10, 10), _h(100, 20, 40),
            _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 251, 271), _h(100, 281, 301), _h(100, 311, 331),
            _h(100, 341, 361), _h(100, 371, 391),
            _v(100, 110, 130), _v(100, 140, 160), _v(100, 170, 190),
            _v(251, 110, 130), _v(251, 140, 160), _v(251, 170, 190),
        ]

        groups = _groups(solve_dashes(
            segments, set(), [], _no_housing,
            terminal_dots=((100, 100), (251, 100)),
        ))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 7))
        self.assertEqual(_group_for(groups, 0), {0, 1, 2})
        self.assertEqual(_group_for(groups, 7), {7, 8, 9})

    def test_reserved_solid_label_is_excluded_from_dash_seeding(self):
        segments = [_h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100)]
        label = _label("Y", "0.75 Y (w236)", 60, 88)

        claimed = solve_dashes(segments, set(), [label], _no_housing)
        reserved = solve_dashes(
            segments, set(), [label], _no_housing, reserved_labels=[label],
        )

        self.assertTrue(claimed[1])
        self.assertFalse(reserved[1])
        self.assertTrue(reserved[2])

    def test_hole_inside_recognised_colour_glyph_is_not_a_terminal_boundary(self):
        segments = [_h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100)]
        label = _label("R", "25 R", 60, 88)

        dgroups, dclaims, _unlabelled, _ports = solve_dashes(
            segments, set(), [label], _no_housing,
            holes=((60, 88, 12),),
        )

        self.assertTrue(dgroups)
        root = next(iter(dgroups))
        self.assertEqual(dclaims[root][1], ["R"])

    def test_strong_label_retains_a_short_periodic_route(self):
        segments = [
            _line(100, 20, 100, 34, points=15),
            _line(100, 50, 100, 64, points=15),
            _line(100, 80, 100, 94, points=15),
        ]
        label = _label("R", "25 R", 57, 82)
        label["w"], label["h"] = 24, 18

        dgroups, dclaims, unlabelled, _ports = solve_dashes(
            segments, set(), [label], _no_housing)

        self.assertFalse(unlabelled)
        self.assertEqual(len(dgroups), 1)
        root = next(iter(dgroups))
        self.assertEqual(set(dgroups[root]), {0, 1, 2})
        self.assertEqual(dclaims[root][1], ["R"])

    def test_bare_label_does_not_relax_the_short_route_gate(self):
        segments = [
            _line(100, 20, 100, 34, points=15),
            _line(100, 50, 100, 64, points=15),
            _line(100, 80, 100, 94, points=15),
        ]
        label = _label("R", "R", 57, 82)
        label["w"], label["h"] = 24, 18

        result = solve_dashes(
            segments, set(), [label], _no_housing, return_state=True)

        self.assertEqual(len(result[4]["seeds"]), 1)
        self.assertFalse(result[0])
        self.assertFalse(result[2])

    def test_two_dash_wire_between_hard_components_is_retained_for_zoom(self):
        segments = [
            _line(20, 100, 30, 100, points=11),
            _line(50, 100, 60, 100, points=11),
        ]

        def housing(x, y, margin=0):
            return 90 - margin <= x <= 110 + margin \
                and 0 - margin <= y <= 10 + margin

        result = solve_dashes(
            segments, set(), [], housing,
            holes=((95, 130, 12), (105, 130, 12)),
            return_state=True)

        self.assertEqual(len(result[2]), 1)
        root = next(iter(result[2]))
        self.assertEqual(set(result[2][root]), {0, 1})
        self.assertIn(root, result[4]["boundary_bounded_short"])

    def test_two_unbounded_ticks_are_not_retained_as_a_wire(self):
        segments = [
            _line(20, 100, 30, 100, points=11),
            _line(50, 100, 60, 100, points=11),
        ]

        result = solve_dashes(
            segments, set(), [], _no_housing, return_state=True)

        self.assertFalse(result[0])
        self.assertFalse(result[2])
        self.assertFalse(result[4]["boundary_bounded_short"])

    def test_two_ports_cannot_cite_the_same_hole_cluster_as_two_boundaries(self):
        segments = [
            _line(50, 100, 60, 100, points=11),
            _line(78, 100, 88, 100, points=11),
        ]

        result = solve_dashes(
            segments, set(), [], _no_housing,
            holes=((95, 0, 12), (105, 0, 12)),
            return_state=True)

        self.assertFalse(result[0])
        self.assertFalse(result[2])
        self.assertFalse(result[4]["boundary_bounded_short"])

    def test_two_ports_cannot_cite_the_same_housing_as_two_boundaries(self):
        segments = [
            _line(50, 100, 60, 100, points=11),
            _line(78, 100, 88, 100, points=11),
        ]

        def housing(x, y, margin=0):
            return 90 - margin <= x <= 110 + margin \
                and 0 - margin <= y <= 20 + margin

        result = solve_dashes(
            segments, set(), [], housing, return_state=True)

        self.assertFalse(result[0])
        self.assertFalse(result[2])
        self.assertFalse(result[4]["boundary_bounded_short"])

    def test_transitive_hole_cluster_is_one_boundary_regardless_of_input_order(self):
        segments = [
            _line(100, 80, 100, 90, points=11),
            _line(100, 105, 100, 115, points=11),
        ]
        holes = tuple((x, 141, 12) for x in (0, 140, 35, 70, 105))

        result = solve_dashes(
            segments, set(), [], _no_housing, holes=holes, return_state=True)

        self.assertFalse(result[2])
        self.assertFalse(result[4]["boundary_bounded_short"])

    def test_distinct_terminal_clusters_need_no_fixed_eighty_pixel_separation(self):
        segments = [
            _line(100, 40, 100, 50, points=11),
            _line(100, 60, 100, 70, points=11),
        ]
        holes = ((16, 141, 12), (22, 141, 12),
                 (88, 141, 12), (94, 141, 12))

        result = solve_dashes(
            segments, set(), [], _no_housing, holes=holes, return_state=True)

        self.assertEqual(len(result[2]), 1)
        self.assertTrue(result[4]["boundary_bounded_short"])

    def test_two_long_strokes_keep_component_bounded_bare_support_flag(self):
        segments = [
            _line(20, 100, 50, 100, points=31),
            _line(70, 100, 100, 100, points=31),
        ]

        def housing(x, y, margin=0):
            return 90 - margin <= x <= 110 + margin \
                and 0 - margin <= y <= 10 + margin

        result = solve_dashes(
            segments, set(), [], housing,
            holes=((95, 170, 12), (105, 170, 12)),
            return_state=True)

        root = next(iter(result[2]))
        self.assertIn(root, result[4]["boundary_bounded_short"])

    def test_parallel_side_labels_are_assigned_one_to_one_not_both_to_nearest_run(self):
        segments = [
            _v(100, 20, 40), _v(100, 50, 70), _v(100, 80, 100),
            _v(178, 20, 40), _v(178, 50, 70), _v(178, 80, 100),
        ]
        labels = [
            _label("SB", "SB", 63, 60, vertical=True),
            # This R text is 36 px from the SB line and 42 px from its own R line.
            _label("R", "R", 136, 60, vertical=True),
        ]
        for label in labels:
            label["w"], label["h"] = 20, 40

        dgroups, dclaims, _unlabelled, _ports = solve_dashes(
            segments, set(), labels, _no_housing)
        by_members = {frozenset(members): dclaims[root][1]
                      for root, members in dgroups.items()}

        self.assertEqual(by_members[frozenset({0, 1, 2})], ["SB"])
        self.assertEqual(by_members[frozenset({3, 4, 5})], ["R"])

    def test_ungauged_SB_is_weak_and_gauged_label_wins_the_same_route(self):
        segments = [_h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100)]
        weak = _label("SB", "SB", 60, 90)
        weak["w"], weak["h"] = 40, 20
        strong = _label("R", "25 R", 60, 70)

        dgroups, dclaims, _unlabelled, _ports = solve_dashes(
            segments, set(), [weak, strong], _no_housing)

        root = next(root for root, members in dgroups.items() if 0 in members)
        self.assertEqual(dclaims[root][1], ["R"])

    def test_supported_bare_code_near_but_outside_component_can_seed(self):
        segments = [_h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100)]
        label = _label("R", "R", 60, 125)
        label["w"], label["h"] = 24, 32

        def housing(x, y, margin=0):
            return 45 - margin <= x <= 75 + margin \
                and 140 - margin <= y <= 160 + margin

        result = solve_dashes(
            segments, set(), [label], housing, return_state=True)

        self.assertEqual(len(result[4]["seeds"]), 1)
        self.assertIs(result[4]["seeds"][0][0], label)
        self.assertIn(result[4]["seeds"][0][1], {0, 1, 2})
        self.assertTrue(result[1])

    def test_near_component_bare_code_without_periodic_support_is_not_a_seed(self):
        segments = [_h(100, 20, 40), _h(100, 50, 70)]
        label = _label("R", "R", 45, 125)
        label["w"], label["h"] = 24, 32

        def housing(x, y, margin=0):
            return 30 - margin <= x <= 60 + margin \
                and 140 - margin <= y <= 160 + margin

        result = solve_dashes(
            segments, set(), [label], housing, return_state=True)

        self.assertFalse(result[4]["seeds"])

    def test_tall_single_glyph_uses_unique_horizontal_periodic_support(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _v(160, 20, 40), _v(160, 50, 70), _v(160, 80, 100),
        ]
        label = _label("R", "R", 60, 75)
        label["w"], label["h"] = 23, 32

        result = solve_dashes(
            segments, set(), [label], _no_housing, return_state=True)

        self.assertTrue(result[4]["seeds"])
        _owned_label, home = result[4]["seeds"][0]
        self.assertIn(home, {0, 1, 2})

    def test_eight_pixel_dash_is_admitted_only_inside_confirmed_collinear_train(self):
        segments = [
            _h(100, 20, 40),
            _line(100, 50, 100, 70, points=9),
            _h(100, 80, 100),
            _h(100, 110, 130),
            # An isolated short stroke has no two-sided periodic support.
            _line(200, 50, 200, 70, points=9),
        ]

        groups = _groups(solve_dashes(segments, set(), [], _no_housing))

        self.assertEqual(_group_for(groups, 0), {0, 1, 2, 3})
        self.assertTrue(all(4 not in group for group in groups))

    def test_long_periodic_gap_joins_only_when_crossing_ink_explains_missing_dashes(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 350, 370), _h(100, 380, 400), _h(100, 410, 430),
            # A continuous perpendicular conductor crosses the otherwise phase-aligned gap.
            _line(40, 225, 160, 225, points=201),
        ]

        groups = _groups(solve_dashes(segments, set(), [], _no_housing))

        self.assertEqual(_group_for(groups, 0), set(range(6)))

    def test_long_periodic_gap_without_crossing_evidence_stays_separate(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 350, 370), _h(100, 380, 400), _h(100, 410, 430),
        ]

        groups = _groups(solve_dashes(segments, set(), [], _no_housing))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 3))

    def test_dashed_axis_on_both_sides_explains_an_X_crossing_gap(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 230, 250), _h(100, 260, 280), _h(100, 290, 310),
            _v(165, 20, 40), _v(165, 50, 70), _v(165, 80, 90),
            _v(165, 110, 120), _v(165, 130, 150), _v(165, 160, 180),
        ]

        groups = _groups(solve_dashes(
            segments, set(), [], _no_housing,
        ))

        self.assertEqual(_group_for(groups, 0), set(range(6)))
        self.assertEqual(_group_for(groups, 6), set(range(6, 12)))

    def test_strong_label_bridges_dash_phases_hidden_by_its_text(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 230, 250), _h(100, 260, 280), _h(100, 290, 310),
        ]
        label = _label("R", "25 R", 165, 82)

        groups = _groups(solve_dashes(
            segments, set(), [label], _no_housing,
        ))

        self.assertEqual(_group_for(groups, 0), set(range(6)))

    def test_bare_label_does_not_bridge_a_long_dash_gap(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 230, 250), _h(100, 260, 280), _h(100, 290, 310),
        ]
        label = _label("R", "R", 165, 82)

        groups = _groups(solve_dashes(
            segments, set(), [label], _no_housing,
        ))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 3))

    def test_parallel_strong_label_cannot_vouch_for_another_lines_gap(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 230, 250), _h(100, 260, 280), _h(100, 290, 310),
            _h(160, 120, 140), _h(160, 150, 170), _h(160, 180, 200),
        ]
        label = _label("R", "25 R", 160, 142)

        groups = _groups(solve_dashes(
            segments, set(), [label], _no_housing,
        ))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 3))

    def _periodic_train(self, y=100, strokes=12, pitch=44, stroke=12, x0=200):
        """A page-typical heavy dashed cable: pitch 44 px, 12 px strokes, 32 px gaps."""
        return [_h(y, x0 + i * pitch, x0 + i * pitch + stroke) for i in range(strokes)]

    def test_periodic_train_with_one_legend_is_a_single_physical_route(self):
        segments = self._periodic_train()
        label = _label("SB", "70 SB", 240, 70)

        groups = _groups(solve_dashes(segments, set(), [label], _no_housing))

        self.assertEqual(_group_for(groups, 0), _group_for(groups, 11))

    def test_foreign_scene_zoom_label_cannot_split_a_periodic_route(self):
        # Round 16: contextual reads recovered by the SOLID scene are appended to the shared page
        # label list.  One of them landing beside a dashed cable used to seed a conflicting colour
        # constraint and veto an ordinary in-rhythm mate, cutting the conductor in half.
        segments = self._periodic_train()
        own = _label("SB", "70 SB", 240, 70)
        foreign = _label("R", "70 R", 465, 70)
        foreign["_provenance"] = "multiscale"
        foreign["_channel"] = "solid"

        groups = _groups(solve_dashes(segments, set(), [own, foreign], _no_housing))

        self.assertEqual(_group_for(groups, 0), _group_for(groups, 11))

    def test_page_level_conflicting_legend_still_splits_a_route(self):
        # The constraint mechanism itself must survive: two page-level legends printed on the same
        # line genuinely describe two different conductors and must not be merged.
        segments = self._periodic_train()
        own = _label("SB", "70 SB", 240, 70)
        rival = _label("R", "70 R", 465, 70)

        groups = _groups(solve_dashes(segments, set(), [own, rival], _no_housing))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 11))

    def test_foreign_scene_label_may_still_claim_an_unlabelled_route(self):
        segments = self._periodic_train()
        foreign = _label("SB", "70 SB", 240, 70)
        foreign["_provenance"] = "multiscale"
        foreign["_channel"] = "solid"

        dgroups, dclaims, unlabelled, _ports = solve_dashes(
            segments, set(), [foreign], _no_housing)

        self.assertFalse(unlabelled)
        self.assertEqual(len(dgroups), 1)
        self.assertEqual(list(dclaims.values())[0][1], ["SB"])

    def test_strong_label_can_recover_two_dash_wire_between_components(self):
        segments = [
            _line(100, 20, 100, 34, points=15),
            _line(100, 166, 100, 180, points=15),
        ]
        label = _label("R", "25 R", 100, 82)

        def housing(x, y, margin=0):
            return ((0 - margin <= x <= 10 + margin)
                    or (190 - margin <= x <= 200 + margin)) \
                and 88 - margin <= y <= 112 + margin

        dgroups, dclaims, unlabelled, _ports = solve_dashes(
            segments, set(), [label], housing)

        self.assertFalse(unlabelled)
        self.assertEqual(len(dgroups), 1)
        root = next(iter(dgroups))
        self.assertEqual(set(dgroups[root]), {0, 1})
        self.assertEqual(dclaims[root][1], ["R"])

    def test_component_still_blocks_a_strong_label_gap(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 230, 250), _h(100, 260, 280), _h(100, 290, 310),
        ]
        label = _label("R", "25 R", 165, 82)

        def housing(x, y, margin=0):
            return 150 - margin <= x <= 180 + margin \
                and 85 - margin <= y <= 115 + margin

        groups = _groups(solve_dashes(
            segments, set(), [label], housing,
        ))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 3))

    def test_long_gap_does_not_join_a_periodic_train_to_an_isolated_stroke(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 350, 370),
            _line(40, 225, 160, 225, points=201),
        ]

        groups = _groups(solve_dashes(segments, set(), [], _no_housing))

        self.assertEqual(_group_for(groups, 0), {0, 1, 2})
        self.assertTrue(all(3 not in group for group in groups))

    def test_component_housing_blocks_even_crossing_supported_periodic_gap(self):
        segments = [
            _h(100, 20, 40), _h(100, 50, 70), _h(100, 80, 100),
            _h(100, 350, 370), _h(100, 380, 400), _h(100, 410, 430),
            _line(40, 225, 160, 225, points=201),
        ]

        def housing(x, y, margin=0):
            return 210 - margin <= x <= 240 + margin \
                and 85 - margin <= y <= 115 + margin

        groups = _groups(solve_dashes(segments, set(), [], housing))

        self.assertNotEqual(_group_for(groups, 0), _group_for(groups, 3))


if __name__ == "__main__":
    unittest.main()
