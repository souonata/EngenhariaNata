"""Tests for the cERL-mm scorer.

This is the ruler every later phase is judged with, so its own behaviour is pinned harder than the
code it measures. The properties that matter are not "does it compute a number" but:
  * an error truncates the run -- correctness after a mistake earns nothing;
  * a merge is categorical and needs declared negative ground truth to exist at all;
  * abstaining is better than lying but worse than succeeding;
  * scores are length-weighted, so a long cable cannot cost the same as a stub.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.eval.cerl import (
    ABSTENTION_PENALTY,
    BLACK,
    MERGED,
    NO_CONDUCTOR,
    SPLIT,
    WRONG_COLOUR,
    Observation,
    polyline_length,
    resample,
    score_corpus,
    score_route,
    score_sheet,
)

PX_PER_MM = 10.0          # a round number: 100 px of route = 10 mm


def straight(length_px, y=0.0):
    return [(0.0, y), (float(length_px), y)]


def route(rid, points, code="R/W", status="confirmed"):
    return {"id": rid, "points": points, "code": code, "status": status}


def uniform(conductor_id="c1", code="R/W", abstained=False):
    """Every coordinate observes the same conductor."""
    return lambda x, y: Observation(conductor_id, code, abstained)


def after(x_threshold, before, beyond):
    """Observation changes once x passes a threshold -- used to plant an error mid-route."""
    return lambda x, y: (before if x < x_threshold else beyond)


class ResampleTests(unittest.TestCase):
    def test_endpoints_are_always_present(self):
        pts = resample([(0, 0), (100, 0)], 30)
        self.assertEqual(pts[0], (0, 0))
        self.assertEqual(pts[-1], (100, 0))

    def test_spacing_is_respected_along_a_corner(self):
        pts = resample([(0, 0), (60, 0), (60, 60)], 20)
        # 120 px of path at 20 px spacing -> 7 points including both ends
        self.assertEqual(len(pts), 7)
        self.assertAlmostEqual(polyline_length(pts), 120.0, places=6)

    def test_degenerate_input_is_returned_unchanged(self):
        self.assertEqual(resample([(1, 1)], 10), [(1, 1)])


class RouteScoringTests(unittest.TestCase):
    def test_a_fully_correct_route_scores_one(self):
        s = score_route(route("r1", straight(100)), uniform(), PX_PER_MM, 10)
        self.assertEqual(s.erl, 1.0)
        self.assertIsNone(s.error)
        self.assertAlmostEqual(s.total_mm, 10.0)

    def test_missing_conductor_ends_the_run(self):
        observe = after(50, Observation("c1", "R/W"), None)
        s = score_route(route("r1", straight(100)), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, NO_CONDUCTOR)
        self.assertLess(s.erl, 0.6)

    def test_unpainted_conductor_is_black_not_missing(self):
        """'The engine lost the wire' and 'the engine saw it and left it black' are different
        defects with different fixes; the metric must not pool them."""
        observe = after(50, Observation("c1", "R/W"), Observation("c1", None))
        s = score_route(route("r1", straight(100)), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, BLACK)

    def test_wrong_colour_is_recorded_separately(self):
        observe = after(50, Observation("c1", "R/W"), Observation("c1", "GN/W"))
        s = score_route(route("r1", straight(100)), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, WRONG_COLOUR)

    def test_identity_change_is_a_split(self):
        observe = after(50, Observation("c1", "R/W"), Observation("c2", "R/W"))
        s = score_route(route("r1", straight(100)), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, SPLIT)

    def test_correctness_after_an_error_earns_nothing(self):
        """The core of run-length scoring: a conductor that is right, then wrong, then right again
        is not mostly-right. Everything past the first mistake misleads a technician."""
        def observe(x, y):
            if 40 <= x < 50:
                return Observation("c2", "R/W")        # a brief excursion onto another cable
            return Observation("c1", "R/W")
        s = score_route(route("r1", straight(100)), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, SPLIT)
        self.assertLessEqual(s.erl, 0.5)

    def test_abstention_scores_below_an_equivalent_honest_miss(self):
        at = 50
        missed = score_route(route("r1", straight(100)),
                             after(at, Observation("c1", "R/W"), None), PX_PER_MM, 10)
        refused = score_route(route("r1", straight(100)),
                              after(at, Observation("c1", "R/W"),
                                    Observation("c1", None, abstained=True)), PX_PER_MM, 10)
        self.assertLess(refused.erl, missed.erl)
        self.assertAlmostEqual(missed.erl - refused.erl, ABSTENTION_PENALTY, places=6)

    def test_scores_are_length_weighted_across_routes(self):
        """A long cable traced wrongly must dominate a short stub traced wrongly."""
        spec = {
            "px_per_mm": PX_PER_MM, "tolerance_px": 10,
            "routes": [route("long", straight(1000)), route("stub", straight(100, y=50))],
        }
        # the long route fails immediately, the stub is perfect
        def observe(x, y):
            if y == 50:
                return Observation("c2", "R/W")
            return None
        report = score_sheet(spec, observe)
        self.assertLess(report["cerl"], 0.1)          # not 0.5: length, not route count


class TopologyOnlyTests(unittest.TestCase):
    """A route with no expected colour scores tracing alone.

    This is the mode that makes the release gate measurable today: a vector page's own geometry
    yields exact conductor identity and exact separateness with zero human annotation, but it does
    not yield insulation colour. Splits and merges are judgeable now; colour has to wait for its
    own ground truth.
    """

    def test_unpainted_conductor_is_not_an_error_without_an_expected_colour(self):
        s = score_route(route("r1", straight(100), code=None),
                        uniform(code=None), PX_PER_MM, 10)
        self.assertIsNone(s.error)
        self.assertEqual(s.erl, 1.0)

    def test_any_colour_is_accepted_when_none_is_expected(self):
        observe = after(50, Observation("c1", "R/W"), Observation("c1", "GN/W"))
        s = score_route(route("r1", straight(100), code=None), observe, PX_PER_MM, 10)
        self.assertIsNone(s.error)

    def test_splits_are_still_caught_in_topology_only_mode(self):
        observe = after(50, Observation("c1"), Observation("c2"))
        s = score_route(route("r1", straight(100), code=None), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, SPLIT)

    def test_lost_conductor_is_still_caught_in_topology_only_mode(self):
        observe = after(50, Observation("c1"), None)
        s = score_route(route("r1", straight(100), code=None), observe, PX_PER_MM, 10)
        self.assertEqual(s.error, NO_CONDUCTOR)

    def test_merges_are_still_caught_in_topology_only_mode(self):
        spec = {"px_per_mm": PX_PER_MM, "tolerance_px": 10, "distinct": [["a", "b"]],
                "routes": [route("a", straight(100), code=None),
                           route("b", straight(100, y=50), code=None)]}
        report = score_sheet(spec, uniform("shared", code=None))
        self.assertEqual(report["merge_events"], 1)
        self.assertFalse(score_corpus([report])["release_gate"])


class MergeRuleTests(unittest.TestCase):
    def _shared_conductor_spec(self, distinct):
        return {
            "px_per_mm": PX_PER_MM, "tolerance_px": 10, "distinct": distinct,
            "routes": [route("a", straight(100)), route("b", straight(100, y=50), code="R/W")],
        }

    def test_without_declared_pairs_a_shared_conductor_is_not_a_merge(self):
        """Routes legitimately share a net at a junction box. A rule that fired there would be
        loosened within a week -- exactly the R7-R15 gradient."""
        report = score_sheet(self._shared_conductor_spec(distinct=None), uniform("shared"))
        self.assertEqual(report["merge_events"], 0)
        self.assertEqual(report["cerl"], 1.0)

    def test_declared_distinct_routes_sharing_a_conductor_is_a_merge(self):
        report = score_sheet(self._shared_conductor_spec(distinct=[["a", "b"]]), uniform("shared"))
        self.assertEqual(report["merge_events"], 1)
        self.assertEqual(report["cerl"], 0.0)         # BOTH routes truncated to zero
        for row in report["routes"]:
            self.assertEqual(row["error"], MERGED)

    def test_distinct_routes_on_separate_conductors_are_fine(self):
        observe = lambda x, y: Observation("c_top" if y == 0 else "c_bottom", "R/W")
        report = score_sheet(self._shared_conductor_spec(distinct=[["a", "b"]]), observe)
        self.assertEqual(report["merge_events"], 0)
        self.assertEqual(report["cerl"], 1.0)


class SheetAndCorpusTests(unittest.TestCase):
    def test_unconfirmed_routes_are_excluded_and_counted(self):
        """Unreviewed ground truth would let the engine's own output back in as its own oracle."""
        spec = {"px_per_mm": PX_PER_MM, "tolerance_px": 10,
                "routes": [route("a", straight(100)),
                           route("b", straight(100, y=50), status="draft")]}
        report = score_sheet(spec, uniform())
        self.assertEqual(report["routes_scored"], 1)
        self.assertEqual(report["routes_skipped_unconfirmed"], 1)

    def test_corpus_uses_the_median_sheet_not_the_mean(self):
        """A change that helps many sheets must not be able to hide a collapse on one."""
        sheets = [{"cerl": 0.9, "merge_events": 0, "wrong_colour_events": 0, "total_mm": 10},
                  {"cerl": 0.9, "merge_events": 0, "wrong_colour_events": 0, "total_mm": 10},
                  {"cerl": 0.0, "merge_events": 0, "wrong_colour_events": 0, "total_mm": 10}]
        summary = score_corpus(sheets)
        self.assertEqual(summary["cerl_median"], 0.9)
        self.assertEqual(summary["cerl_min"], 0.0)    # the collapse is still visible

    def test_release_gate_is_categorical_on_merges(self):
        clean = [{"cerl": 0.4, "merge_events": 0, "wrong_colour_events": 0, "total_mm": 1}]
        dirty = [{"cerl": 0.99, "merge_events": 1, "wrong_colour_events": 0, "total_mm": 1}]
        self.assertTrue(score_corpus(clean)["release_gate"])
        # a near-perfect score does not buy its way past a single merge
        self.assertFalse(score_corpus(dirty)["release_gate"])
        self.assertEqual(score_corpus(dirty)["cerl_median"], 0.99)   # reported, not multiplied


if __name__ == "__main__":
    unittest.main()


class PhysicalContinuationTests(unittest.TestCase):
    """Electrical connectivity never proves physical conductor colour continuity."""

    def _run(self, index, points, code=None):
        from wirecolor.engine.ownership import OwnedRun
        return OwnedRun(index=index, points=points, code=code, legend_raw=None, distance=None)

    def test_unlabelled_branches_stay_black_at_a_splice(self):
        from wirecolor.engine.ownership import propagate_continuations
        runs = [self._run(0, [(0, 0), (100, 0)], code="R/W"),
                self._run(1, [(100, 0), (200, 0)]),
                self._run(2, [(100, 0), (100, 80)])]
        self.assertEqual(propagate_continuations(runs), 0)
        self.assertEqual([r.code for r in runs], ["R/W", None, None])

    def test_conflicting_codes_at_a_splice_propagate_nothing(self):
        from wirecolor.engine.ownership import propagate_continuations
        runs = [self._run(0, [(0, 0), (100, 0)], code="R/W"),
                self._run(1, [(100, 0), (200, 0)], code="GN/SB"),
                self._run(2, [(100, 0), (100, 80)])]
        self.assertEqual(propagate_continuations(runs), 0)
        self.assertIsNone(runs[2].code)          # ambiguous: black beats wrong

    def test_an_existing_colour_is_never_overwritten(self):
        from wirecolor.engine.ownership import propagate_continuations
        runs = [self._run(0, [(0, 0), (100, 0)], code="R/W"),
                self._run(1, [(100, 0), (200, 0)], code="BL")]
        propagate_continuations(runs)
        self.assertEqual([r.code for r in runs], ["R/W", "BL"])

    def test_colour_carries_along_a_chain_of_unlabelled_branches(self):
        from wirecolor.engine.ownership import propagate_continuations
        runs = [self._run(0, [(0, 0), (100, 0)], code="Y"),
                self._run(1, [(100, 0), (200, 0)]),
                self._run(2, [(200, 0), (300, 0)])]
        propagate_continuations(runs)
        self.assertEqual([r.code for r in runs], ["Y", "Y", "Y"])
