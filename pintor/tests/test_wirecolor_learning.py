"""The learning layer may tune decisions, but can only abstain or select bounded evidence."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from types import SimpleNamespace


sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from wirecolor.engine.classifier import (FEATURE_NAMES, CalibratedRunClassifier,
                                         RunClassifierEnsemble, fit_calibrated_classifier,
                                         run_feature_rows)
from wirecolor.engine.constraints import abstain_with_classifier, constrained_assign
from wirecolor.engine.learning_data import LedgerScore, aggregate_scores, deduplicate_cases_by_run
from wirecolor.engine.ownership import OwnedRun, assign
from wirecolor.engine.policy import DecisionPolicy
from wirecolor.labels.text_layer import Legend
from wirecolor.tools.tune_decision_policy import (_measurably_better,
                                                   _genetic_candidates,
                                                   _zero_regression_candidates)
from wirecolor.tools.cross_validate_learning import balanced_group_folds
from wirecolor.tools.train_run_classifier import drawing_group_key
from wirecolor.tools.paint_vector import vector_coverage_stats
from wirecolor.tools.qa_dashboard import CLASSES
from wirecolor.tools.qa_cases import _decide


def _legend(code="R", x=50, y=5):
    return Legend(raw=f"0.75 {code}", code=code, x=x, y=y, axis="h", wire_id=None)


class DecisionPolicyTests(unittest.TestCase):
    def test_round_trip_and_unknown_fields_are_rejected(self):
        policy = DecisionPolicy().evolved(refuse_cost=91.0)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "policy.json")
            policy.save(path)
            self.assertEqual(DecisionPolicy.load(path), policy)
        raw = policy.to_dict()
        raw["disable_v7"] = True
        with self.assertRaises(ValueError):
            DecisionPolicy.from_dict(raw)

    def test_unsafe_or_incoherent_genome_is_rejected(self):
        with self.assertRaises(ValueError):
            DecisionPolicy().evolved(refuse_cost=140.0)
        with self.assertRaises(ValueError):
            DecisionPolicy().evolved(max_ownership_px=90.0, refuse_cost=100.0)

    def test_optimizer_hard_rejects_candidates_that_reopen_protected_cases(self):
        ranked = [(0.1, "unsafe"), (0.2, "safe")]
        safe, rejected = _zero_regression_candidates(
            ranked,
            lambda policy: SimpleNamespace(
                baseline_regressions=3 if policy == "unsafe" else 0),
        )
        self.assertEqual(safe, [(0.2, "safe")])
        self.assertEqual(rejected, 1)

    def test_markup_tool_includes_balanced_validation_controls(self):
        classes = {row[0] for row in CLASSES}
        self.assertIn("correct-wire", classes)
        self.assertIn("correct-black", classes)

    def test_noop_candidate_is_not_a_measurable_improvement(self):
        self.assertFalse(_measurably_better(0.4, 0.4))
        self.assertFalse(_measurably_better(0.4000000001, 0.4))
        self.assertTrue(_measurably_better(0.39, 0.4))

    def test_wrong_colour_without_exact_code_cannot_pass_as_generic_paint(self):
        owned = [OwnedRun(1, [(0, 0), (100, 0)], "R", "0.75 R", 1.0)]
        result = _decide(owned, {
            "class": "wrong-colour", "expect": "painted", "at": [50, 0]})
        self.assertEqual(result["verdict"], "unresolved")

    def test_aggregate_score_counts_regression_penalty_once(self):
        left = LedgerScore(10.25, 0.75, 5, 1, 1, 0, 0, 0, 1)
        right = LedgerScore(0.5, 0.5, 5, 1, 2, 0, 0, 0, 0)
        combined = aggregate_scores([left, right])
        self.assertEqual(combined.baseline_regressions, 1)
        self.assertAlmostEqual(combined.loss, 10.375)


class GeneticPolicyTests(unittest.TestCase):
    class QuadraticLedger:
        def __init__(self, target=220.0):
            self.target = target
            self.calls = 0

        def score(self, policy, _classifier, _protected):
            self.calls += 1
            return SimpleNamespace(
                loss=((policy.max_ownership_px - self.target) / 130.0) ** 2,
                baseline_regressions=0,
            )

    @staticmethod
    def signature(ranked):
        return [
            (loss, tuple(policy.to_dict()[name] for name in (
                "max_ownership_px", "refuse_cost", "axis_mismatch_cost",
                "bridge_gap_factor", "continuation_snap_px",
            )))
            for loss, policy in ranked
        ]

    def test_genetic_search_is_deterministic_for_one_seed(self):
        left_ledger = self.QuadraticLedger(target=197.0)
        right_ledger = self.QuadraticLedger(target=197.0)

        left, left_meta = _genetic_candidates(
            left_ledger, DecisionPolicy(), set(), 64, 9137, None)
        right, right_meta = _genetic_candidates(
            right_ledger, DecisionPolicy(), set(), 64, 9137, None)

        self.assertEqual(self.signature(left), self.signature(right))
        self.assertEqual(left_meta, right_meta)
        self.assertEqual(left_ledger.calls, 64)
        self.assertEqual(right_ledger.calls, 64)
        self.assertTrue(left_meta["baseline_included"])

    def test_every_genetic_candidate_respects_policy_bounds_and_coherence(self):
        ranked, metadata = _genetic_candidates(
            self.QuadraticLedger(), DecisionPolicy(), set(), 80, 42, None)
        bounds = DecisionPolicy.tunable_bounds()

        self.assertEqual(len(ranked), metadata["evaluations"])
        self.assertLessEqual(metadata["evaluations"], metadata["requested_trials"])
        for _loss, policy in ranked:
            self.assertEqual(policy.validate(), policy)
            self.assertLess(policy.refuse_cost, policy.max_ownership_px)
            for field, (low, high) in bounds.items():
                self.assertLessEqual(low, getattr(policy, field), field)
                self.assertLessEqual(getattr(policy, field), high, field)

    def test_genetic_search_improves_a_fake_ledger_without_losing_the_baseline(self):
        ledger = self.QuadraticLedger(target=220.0)
        baseline = DecisionPolicy()
        baseline_loss = ledger.score(baseline, None, set()).loss

        ranked, metadata = _genetic_candidates(
            ledger, baseline, set(), 48, 20260901, None)

        self.assertLess(ranked[0][0], baseline_loss)
        self.assertAlmostEqual(ranked[0][1].max_ownership_px, 220.0)
        self.assertGreater(metadata["generations"], 0)
        self.assertTrue(any(policy == baseline for _loss, policy in ranked))


class GraphFeatureTests(unittest.TestCase):
    def test_features_describe_graph_without_using_a_painted_answer(self):
        runs = [[(0, 0), (100, 0)], [(50, -30), (50, 0), (50, 30)]]
        rows = run_feature_rows(runs, [_legend(x=20, y=4)], min_run_px=20)
        self.assertEqual(tuple(rows[0]), FEATURE_NAMES)
        self.assertGreater(rows[0]["nearby_legend_count"], 0)
        self.assertEqual(rows[0]["endpoint_degree_max"], 1.0)
        self.assertNotIn("code", rows[0])

    def test_features_capture_frame_like_perpendicular_terminations(self):
        rail = [(50, 0), (50, 100)]
        wires = [[(0, y), (50, y)] for y in (20, 40, 60, 80)]
        rows = run_feature_rows([rail, *wires], [], min_run_px=10)
        self.assertEqual(rows[0]["interior_termination_count"], 4.0)
        self.assertEqual(rows[0]["perpendicular_termination_share"], 1.0)
        self.assertGreater(rows[0]["axis_aligned_share"], 0.99)

    def test_repeated_pins_on_one_physical_run_get_one_scoring_vote(self):
        owned = [OwnedRun(7, [(0, 0), (100, 0)], "R", "0.75 R", 1.0)]
        cases = [
            {"id": "C1", "at": [10, 0], "expect": "black", "source": "user"},
            {"id": "C2", "at": [90, 0], "expect": "black", "source": "user"},
            {"id": "C3", "at": [50, 0], "expect": "painted:R", "source": "checker"},
        ]
        selected = deduplicate_cases_by_run(owned, cases)
        self.assertEqual([case["id"] for case in selected], ["C1", "C3"])

    def test_atomic_pieces_cannot_report_more_than_full_parent_coverage(self):
        source = [[(0, 0), (50, 0), (100, 0)]]
        pieces = [
            OwnedRun(0, [(0, 0), (50, 0)], "R", "R", 0),
            OwnedRun(0, [(50, 0), (100, 0)], "R", "R", 0),
        ]
        stats = vector_coverage_stats(source, pieces)
        self.assertEqual(len(stats["painted_parents"]), 1)
        self.assertEqual(stats["paint_rate"], 1.0)


class ConstraintSolverTests(unittest.TestCase):
    def test_without_classifier_exactly_matches_proven_assignment(self):
        legends = [_legend("R", 50, 5), _legend("GN", 50, 45)]
        runs = [[(0, 0), (100, 0)], [(0, 40), (100, 40)]]
        old = assign(legends, runs)
        new, diagnostics = constrained_assign(legends, runs, DecisionPolicy())
        self.assertEqual([run.code for run in new], [run.code for run in old])
        self.assertEqual(diagnostics.solver, "linear-assignment")

    def test_classifier_prior_is_paid_globally_and_can_avoid_furniture(self):
        class FurniturePrior:
            metadata = {"fixture": True}

            @staticmethod
            def predict_probability(row):
                return 0.0 if row["closed"] else 1.0

        # The closed outline is geometrically closer, but its learned activation penalty makes the
        # slightly farther open conductor the lower-cost global solution.
        outline = [(45, 0), (55, 0), (55, 10), (45, 10), (45, 0)]
        conductor = [(0, 20), (100, 20)]
        policy = DecisionPolicy().evolved(classifier_assignment_weight=30.0)
        owned, diagnostics = constrained_assign(
            [_legend("R", 50, 2)], [outline, conductor], policy,
            classifier=FurniturePrior(), min_run_px=10)
        self.assertIsNone(owned[0].code)
        self.assertEqual(owned[1].code, "R")
        self.assertTrue(diagnostics.classifier_influenced)

    def test_general_milp_and_fast_reduction_reach_the_same_solution(self):
        class FurniturePrior:
            @staticmethod
            def predict_probability(row):
                return 0.0 if row["closed"] else 1.0

        outline = [(45, 0), (55, 0), (55, 10), (45, 10), (45, 0)]
        conductor = [(0, 20), (100, 20)]
        base = DecisionPolicy().evolved(classifier_assignment_weight=30.0)
        fast, _ = constrained_assign([_legend("R", 50, 2)], [outline, conductor], base,
                                     FurniturePrior(), 10)
        general, diagnostics = constrained_assign(
            [_legend("R", 50, 2)], [outline, conductor],
            base.evolved(constraint_solver="milp"), FurniturePrior(), 10)
        self.assertEqual([run.code for run in general], [run.code for run in fast])
        self.assertEqual(diagnostics.solver, "milp")

    def test_low_probability_propagation_abstains_but_never_changes_colour(self):
        class NeverWire:
            @staticmethod
            def predict_probability(_row):
                return 0.01

        direct = OwnedRun(0, [(0, 0), (100, 0)], "R", "0.75 R", 2.0)
        inherited = OwnedRun(1, [(100, 0), (200, 0)], "R", "0.75 R", None,
                             propagated=True)
        rows = run_feature_rows([direct.points, inherited.points], [], 20)
        n = abstain_with_classifier([direct, inherited], rows, NeverWire(), DecisionPolicy())
        self.assertEqual(n, 2)  # direct threshold is deliberately non-zero when a model is enabled
        self.assertIsNone(direct.code)
        self.assertIsNone(inherited.code)
        self.assertNotEqual(direct.code, "GN")


class ClassifierTrainingTests(unittest.TestCase):
    def test_model_is_group_calibrated_serializable_and_orders_examples(self):
        rows, labels, groups = [], [], []
        for group in range(10):
            for label in (0, 1):
                row = {name: 0.0 for name in FEATURE_NAMES}
                row["straightness"] = 0.15 if label == 0 else 1.0
                row["fold_ratio"] = 4.0 if label == 0 else 1.0
                row["closed"] = float(label == 0)
                rows.append(row); labels.append(label); groups.append(f"sheet-{group}")
        model = fit_calibrated_classifier(rows, labels, groups)
        self.assertGreater(model.predict_probability(rows[1]), model.predict_probability(rows[0]))
        self.assertTrue(model.metadata["calibration_groups"])
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "model.json")
            model.save(path)
            loaded = CalibratedRunClassifier.load(path)
            self.assertAlmostEqual(loaded.predict_probability(rows[1]),
                                   model.predict_probability(rows[1]), places=8)

    def test_group_fold_builder_never_splits_a_drawing(self):
        groups = ["a", "a", "b", "b", "c", "c", "d", "d"]
        labels = [0, 1] * 4
        folds = balanced_group_folds(groups, labels, fold_count=3)
        flattened = [group for fold in folds for group in fold]
        self.assertEqual(sorted(flattened), sorted(set(groups)))
        self.assertEqual(len(flattened), len(set(flattened)))

    def test_sibling_pages_share_one_validation_group(self):
        self.assertEqual(drawing_group_key("pub34_p148"), "pub34")
        self.assertEqual(drawing_group_key("pub34_p150"), "pub34")

    def test_cross_fitted_ensemble_round_trips_and_averages(self):
        size = len(FEATURE_NAMES)
        low = CalibratedRunClassifier((0.0,) * size, (1.0,) * size,
                                      (0.0,) * size, -2.0)
        high = CalibratedRunClassifier((0.0,) * size, (1.0,) * size,
                                       (0.0,) * size, 2.0)
        ensemble = RunClassifierEnsemble((low, high), {"unit": "atomic-piece"})
        row = {name: 0.0 for name in FEATURE_NAMES}
        self.assertAlmostEqual(ensemble.predict_probability(row), 0.5)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "ensemble.json")
            ensemble.save(path)
            loaded = CalibratedRunClassifier.load(path)
            self.assertIsInstance(loaded, RunClassifierEnsemble)
            self.assertAlmostEqual(loaded.predict_probability(row), 0.5)

class BridgeBudget(unittest.TestCase):

    def test_the_bridge_ceiling_clears_a_twist_that_replaces_cable(self):
        """A twist mark can stand in a gap the cable does not cross, and the gap scales with the sheet.

        On D13 page 1 the conductor stops at y=980 and resumes at y=1012 with the bowtie in the 32
        px between; no ink crosses, so colour cannot pass. The budget is
        `min(bridge_max_gap_px, bridge_gap_factor * min_run_px)`, and on that foldout the relative
        term asks for 117 while the ceiling cuts it to 30 -- a large sheet given an A4 bridge.
        """
        policy = DecisionPolicy()

        self.assertGreater(policy.bridge_max_gap_px, 32.0)
        # ...and the ceiling stays inside the bounds a search is allowed to move it within.
        low, high = DecisionPolicy._BOUNDS["bridge_max_gap_px"]
        self.assertGreaterEqual(policy.bridge_max_gap_px, low)
        self.assertLessEqual(policy.bridge_max_gap_px, high)

    def test_the_bridge_ceiling_only_binds_on_a_large_sheet(self):
        """On A4 the relative term governs, so raising the ceiling changes nothing there."""
        policy = DecisionPolicy()
        a4_relative = policy.bridge_gap_factor * 48.7        # measured min_run_px on D1/D2 p46
        foldout_relative = policy.bridge_gap_factor * 194.9  # measured min_run_px on D13 p1

        self.assertLess(a4_relative, policy.bridge_max_gap_px)
        self.assertGreater(foldout_relative, policy.bridge_max_gap_px)


if __name__ == "__main__":
    unittest.main()
