"""Select a wire-colour policy by publication-group cross-validation.

This is the generation-3 training entry point. Every non-lockbox drawing is useful training
evidence, but a classifier is never allowed to score a sibling page from the publication that
fitted its weights. The foreign lockbox is loaded only after model and policy files have been
selected and saved.

Example::

    python -m wirecolor.tools.cross_validate_learning \
      --root workspaces/wirecolor_qa --root workspaces/wirecolor_holdout \
      --lockbox-root workspaces/wirecolor_foreign --trials 120 \
      --classifier-out workspaces/wirecolor_qa/models/run_classifier_cv_v3.json \
      --policy-out workspaces/wirecolor_qa/models/decision_policy_cv_v3.json
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os


def balanced_group_folds(groups, labels, fold_count=5):
    """Greedily balance sheets by samples and both classes, without splitting a sheet."""
    stats = {}
    for group, label in zip(groups, labels):
        row = stats.setdefault(group, [0, 0, 0])
        row[0] += 1
        row[1 if label else 2] += 1
    fold_count = max(2, min(int(fold_count), len(stats)))
    folds = [[] for _ in range(fold_count)]
    totals = [[0, 0, 0] for _ in range(fold_count)]
    ordered = sorted(stats, key=lambda group: (-stats[group][0], -max(stats[group][1:]), group))
    for group in ordered:
        destination = min(
            range(fold_count),
            key=lambda index: (totals[index][0], totals[index][1], totals[index][2], index),
        )
        folds[destination].append(group)
        totals[destination] = [left + right for left, right in zip(
            totals[destination], stats[group])]
    return [sorted(fold) for fold in folds]


class CrossValidatedLedger:
    """Adapter exposing the optimiser's score protocol over out-of-fold models."""

    def __init__(self, ledger, folds, rows, labels, groups):
        from ..engine.classifier import fit_calibrated_classifier

        self.ledger = ledger
        self.fold_records = []
        for index, fold in enumerate(folds):
            held_groups = set(fold["groups"])
            held_tags = set(fold["tags"])
            train_indices = [i for i, group in enumerate(groups) if group not in held_groups]
            if not train_indices:
                raise ValueError("cross-validation fold has no training drawings")
            train_labels = [labels[i] for i in train_indices]
            if len(set(train_labels)) != 2:
                raise ValueError("cross-validation fold training data lacks one class")
            model = fit_calibrated_classifier(
                [rows[i] for i in train_indices], train_labels,
                groups=[groups[i] for i in train_indices],
                metadata={"role": "cross-validation", "held_fold": index,
                          "held_groups": sorted(held_groups), "unit": "atomic-piece"},
            )
            view = ledger.subset(held_tags)
            protected = view.baseline_pass_ids(None)
            self.fold_records.append({
                "index": index, "held_tags": sorted(held_tags),
                "held_groups": sorted(held_groups), "view": view,
                "model": model, "protected": protected,
            })

    def score(self, policy, _classifier=None, _protected=None):
        from ..engine.learning_data import aggregate_scores

        return aggregate_scores(
            record["view"].score(policy, record["model"], record["protected"])
            for record in self.fold_records
        )

    def fold_report(self, policy, baseline_policy):
        rows = []
        for record in self.fold_records:
            rows.append({
                "fold": record["index"], "held_tags": record["held_tags"],
                "held_groups": record["held_groups"],
                "baseline": record["view"].score(
                    baseline_policy, record["model"], record["protected"]).to_dict(),
                "selected": record["view"].score(
                    policy, record["model"], record["protected"]).to_dict(),
                "classifier": record["model"].metadata or {},
            })
        return rows

    def safe_abstention_seeds(self, policy):
        """Find the strongest OOF thresholds that preserve every known good wire."""
        records = [(record["view"], record["model"]) for record in self.fold_records]
        return safe_abstention_seeds(records, policy)


def safe_abstention_seeds(records, policy):
    """Derive model-calibrated thresholds from one or more independently scored ledgers."""
    from ..tools.qa_cases import PIN_RADIUS_PX, _decide, _nearest_run

    protected_min = {"direct": 1.0, "propagated": 1.0}
    false_probabilities = {"direct": [], "propagated": []}
    observations = {"direct": 0, "propagated": 0}
    for view, model in records:
        decisions = view.decisions(policy, model)
        for tag, owned in decisions.items():
            context = view.contexts[tag]
            def edge_key(parent_index, points):
                endpoints = sorted((
                    (round(points[0][0], 4), round(points[0][1], 4)),
                    (round(points[-1][0], 4), round(points[-1][1], 4)),
                ))
                return parent_index, *endpoints

            piece_features = {
                edge_key(piece["parent_index"], piece["points"]): row
                for piece, row in zip(context.pieces, context.piece_features)
            }
            cases = view.scored_cases_by_tag[tag]
            for case in cases:
                result = _decide(owned, case)
                hit = _nearest_run(owned, *case["at"])
                if not hit or hit[0] > PIN_RADIUS_PX or hit[1].code is None:
                    continue
                run = hit[1]
                if run.corroborations:
                    continue
                kind = "propagated" if run.propagated else "direct"
                features = piece_features.get(
                    edge_key(run.index, run.points), context.run_features[run.index])
                probability = model.predict_probability(features)
                if result.get("verdict") == "pass" \
                        and case.get("expect", "").startswith("painted"):
                    protected_min[kind] = min(protected_min[kind], probability)
                    observations[kind] += 1
                elif case.get("expect") == "black" and result.get("found") is not None:
                    false_probabilities[kind].append(probability)

    bounds = policy.tunable_bounds()
    thresholds = {
        "direct": min(protected_min["direct"],
                      bounds["classifier_direct_min_probability"][1]),
        "propagated": min(protected_min["propagated"],
                          bounds["classifier_propagated_min_probability"][1]),
    }
    removable = {
        kind: sum(probability < thresholds[kind]
                  for probability in false_probabilities[kind])
        for kind in thresholds
    }
    def quantiles(values):
        ordered = sorted(values)
        if not ordered:
            return {}
        return {
            "min": ordered[0],
            "p25": ordered[round(0.25 * (len(ordered) - 1))],
            "median": ordered[round(0.50 * (len(ordered) - 1))],
            "p75": ordered[round(0.75 * (len(ordered) - 1))],
            "max": ordered[-1],
        }
    profiles = []
    if thresholds["direct"] > 0:
        profiles.append({"tune_direct_abstention": True,
                         "classifier_direct_min_probability": thresholds["direct"]})
    if thresholds["propagated"] > 0:
        profiles.append({"tune_propagated_abstention": True,
                         "classifier_propagated_min_probability": thresholds["propagated"]})
    if thresholds["direct"] > 0 and thresholds["propagated"] > 0:
        profiles.append({
            "tune_direct_abstention": True,
            "classifier_direct_min_probability": thresholds["direct"],
            "tune_propagated_abstention": True,
            "classifier_propagated_min_probability": thresholds["propagated"],
        })
    return profiles, {
        "max_safe_threshold": thresholds,
        "protected_probability_min": protected_min,
        "protected_wire_observations": observations,
        "false_paints_below_safe_threshold": removable,
        "false_paint_observations": {
            kind: len(values) for kind, values in false_probabilities.items()},
        "false_paint_probability_quantiles": {
            kind: quantiles(values) for kind, values in false_probabilities.items()},
    }


def run(roots, classifier_out, policy_out, lockbox_root=None, cache_dir=None,
        trials=120, folds=5, seed=20260819, report_path=None):
    from ..engine.classifier import RunClassifierEnsemble
    from ..engine.learning_data import CachedLedger, combine_ledgers
    from ..engine.policy import DecisionPolicy
    from .train_run_classifier import collect_training_rows, drawing_group_key
    from .tune_decision_policy import (_measurably_better, _tpe_candidates,
                                       _zero_regression_candidates)

    ledgers = [CachedLedger(root, cache_dir=cache_dir).prepare() for root in roots]
    combined = combine_ledgers(ledgers)
    rows, labels, groups, excluded = collect_training_rows(combined)
    held_group_folds = balanced_group_folds(groups, labels, fold_count=folds)
    group_folds = [{
        "groups": held_groups,
        "tags": [tag for tag in combined.contexts
                 if drawing_group_key(tag) in set(held_groups)],
    } for held_groups in held_group_folds]
    cross_validated = CrossValidatedLedger(combined, group_folds, rows, labels, groups)

    base = DecisionPolicy().evolved(
        name="classifier-shadow-v2", classifier_assignment_weight=0.0,
        classifier_direct_min_probability=0.0,
        classifier_propagated_min_probability=0.0,
    )
    baseline = cross_validated.score(base)
    abstention_seeds, separation = cross_validated.safe_abstention_seeds(base)
    # The model argument only opens the bounded classifier fields in the existing optimiser.  Each
    # actual score uses the appropriate fold-specific model inside CrossValidatedLedger.
    model_sentinel = cross_validated.fold_records[0]["model"]
    ranked, optimiser = _tpe_candidates(
        cross_validated, base, set(), trials, seed, model_sentinel,
        seed_profiles=abstention_seeds)
    safe_ranked, rejected = _zero_regression_candidates(
        ranked, lambda policy: cross_validated.score(policy))
    if not safe_ranked:
        safe_ranked = [(baseline.loss, base)]

    selected_cv_template = safe_ranked[0][1]
    selected_cv = cross_validated.score(selected_cv_template)
    selected = selected_cv_template.evolved(name="learned-cv-v3")
    # New drawings have no natural held-out member, so production averages all cross-fitted models.
    # This preserves the out-of-fold probability scale used to select abstention thresholds and is
    # more robust to one draughtsman's style than refitting a single in-sample model.
    final_model = RunClassifierEnsemble(
        tuple(record["model"] for record in cross_validated.fold_records),
        metadata={
            "role": "cross-fitted-production-ensemble", "unit": "atomic-piece",
            "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "roots": [os.path.abspath(root) for root in roots],
            "members": len(cross_validated.fold_records), **excluded,
        },
    )
    final_model.save(classifier_out)
    selected.save(policy_out)

    report = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": "drawing-group-cross-validation",
        "roots": [os.path.abspath(root) for root in roots],
        "lockbox_root": os.path.abspath(lockbox_root) if lockbox_root else None,
        "folds": cross_validated.fold_report(selected_cv_template, base),
        "cv_policy_template": selected_cv_template.to_dict(),
        "cv_baseline": baseline.to_dict(), "cv_selected": selected_cv.to_dict(),
        "final_non_lockbox": selected_cv.to_dict(),
        "selected_policy": selected.to_dict(),
        "classifier": os.path.abspath(classifier_out),
        "policy": os.path.abspath(policy_out),
        "training": {**excluded, "samples": len(rows), "groups": len(set(groups)),
                     "wire_samples": sum(labels),
                     "non_wire_samples": len(labels) - sum(labels)},
        "classifier_separation": separation,
        "final_classifier": final_model.metadata,
        "unsafe_cv_candidates_rejected": rejected,
        **optimiser,
    }
    reasons = []
    if selected_cv.baseline_regressions:
        reasons.append("cross-validation reopened protected cases")
    if not _measurably_better(selected_cv.loss, baseline.loss):
        reasons.append("cross-validation has no measurable improvement over baseline")
    if len(set(groups)) < 10 or selected_cv.cases < 200:
        reasons.append("non-lockbox coverage is below 10 sheets / 200 cases")
    if any((member.metadata or {}).get("calibration_rejected")
           for member in final_model.members):
        reasons.append("a cross-fitted classifier calibration was rejected")

    # This block is intentionally last: neither fitting, search, nor selection can observe it.
    if lockbox_root:
        lockbox = CachedLedger(lockbox_root).prepare()
        if lockbox.contexts and lockbox.cases:
            lockbox_protected = lockbox.baseline_pass_ids(None)
            lockbox_baseline = lockbox.score(base, final_model, lockbox_protected)
            lockbox_selected = lockbox.score(selected, final_model, lockbox_protected)
            report["lockbox_baseline"] = lockbox_baseline.to_dict()
            report["lockbox"] = lockbox_selected.to_dict()
            if lockbox_selected.baseline_regressions:
                reasons.append("lockbox reopened protected cases")
            if lockbox_selected.loss > lockbox_baseline.loss:
                reasons.append("lockbox loss is worse than baseline")
        else:
            reasons.append("lockbox has no labelled cases")
    else:
        reasons.append("no independent lockbox supplied")

    report["promotion"] = {
        "eligible": not reasons, "reasons": reasons,
        "rule": "OOF improvement; zero protected regressions; >=10 sheets/200 cases; "
                "accepted calibration; one-shot non-degraded lockbox",
    }
    report_path = report_path or os.path.splitext(policy_out)[0] + "-report.json"
    os.makedirs(os.path.dirname(os.path.abspath(report_path)) or ".", exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return selected, final_model, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, action="append",
                        help="labelled non-lockbox root; repeat for additional datasets")
    parser.add_argument("--lockbox-root")
    parser.add_argument("--cache-dir")
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--trials", type=int, default=120)
    parser.add_argument("--seed", type=int, default=20260819)
    parser.add_argument("--classifier-out", required=True)
    parser.add_argument("--policy-out", required=True)
    parser.add_argument("--report")
    args = parser.parse_args()
    _policy, _model, report = run(
        args.root, args.classifier_out, args.policy_out, args.lockbox_root,
        args.cache_dir, args.trials, args.folds, args.seed, args.report)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
