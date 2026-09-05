"""Optimise only the bounded wirecolor decision genome, never source code.

Bayesian TPE (default):

    python -m wirecolor.tools.tune_decision_policy --train-root workspaces/wirecolor_qa \
      --validation-root workspaces/wirecolor_holdout --trials 120 --out policy.json

Evolutionary comparison (SciPy differential evolution):

    python -m wirecolor.tools.tune_decision_policy --train-root workspaces/wirecolor_qa \
      --sampler differential-evolution --trials 180 --out policy-de.json

Deterministic genetic search with an exact evaluation budget:

    python -m wirecolor.tools.tune_decision_policy --train-root workspaces/wirecolor_qa \
      --sampler genetic --trials 240 --seed 20260901 --out policy-ga.json

The optimiser sees the training ledger only.  Validation selects among the best training
candidates; an optional lockbox is scored exactly once after selection and can never influence the
parameters.  Existing passing cases are hard constraints through a dominating penalty.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
import os
import random


SEARCH_FIELDS = (
    "max_ownership_px", "refuse_cost", "axis_mismatch_cost",
    "promoted_min_run_factor", "promoted_max_fold",
    "bridge_max_gap_px", "bridge_gap_factor", "bridge_angle_tol_deg",
    "bridge_lateral_min_px", "bridge_lateral_factor",
    "continuation_snap_px", "min_direct_assignment_margin",
    "classifier_assignment_weight", "classifier_direct_min_probability",
    "classifier_propagated_min_probability",
)
INTEGER_FIELDS = set()
CLASSIFIER_FIELDS = {
    "classifier_assignment_weight", "classifier_direct_min_probability",
    "classifier_propagated_min_probability",
}


def _zero_regression_candidates(ranked, score_policy):
    """Return only candidates inside the proven engine's hard safety envelope."""
    safe = []
    rejected = 0
    for train_loss, policy in ranked:
        if score_policy(policy).baseline_regressions == 0:
            safe.append((train_loss, policy))
        else:
            rejected += 1
    return safe, rejected


def _measurably_better(candidate_loss, baseline_loss, epsilon=1e-9):
    """A no-op profile is safe but not a learning result worth promoting."""
    return candidate_loss < baseline_loss - epsilon


def _candidate(base, values):
    values = dict(values)
    if values["refuse_cost"] >= values["max_ownership_px"]:
        return None
    values["name"] = "learned-v1"
    try:
        return base.evolved(**values)
    except ValueError:
        return None


def _tpe_candidates(ledger, base, protected, trials, seed, classifier, seed_profiles=None):
    try:
        import optuna
    except ImportError as error:
        raise RuntimeError(
            "TPE optimisation needs the optional requirements-wirecolor-learning.txt") from error

    bounds = base.tunable_bounds()
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    sampler = optuna.samplers.TPESampler(seed=seed, multivariate=True, group=True)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    baseline_trial = {
        "tune_structure": False, "tune_assignment_prior": False,
        "tune_direct_abstention": False, "tune_propagated_abstention": False,
    }
    study.enqueue_trial(baseline_trial)
    for profile in seed_profiles or ():
        study.enqueue_trial({**baseline_trial, **profile})
    if classifier is not None:
        # Safe one-dimensional probes teach TPE whether each learned action helps before it samples
        # joint profiles.  Conditional gates prevent a useful propagated-only abstention from being
        # hidden by a simultaneous unsafe direct-assignment change.
        for threshold in (0.05, 0.10, 0.20, 0.30):
            study.enqueue_trial({**baseline_trial, "tune_propagated_abstention": True,
                                 "classifier_propagated_min_probability": threshold})

    def objective(trial):
        values = {name: getattr(base, name) for name in SEARCH_FIELDS}
        tune_structure = trial.suggest_categorical("tune_structure", (False, True))
        if tune_structure:
            for name in SEARCH_FIELDS:
                if name not in CLASSIFIER_FIELDS:
                    values[name] = trial.suggest_float(name, *bounds[name])
        supports_assignment_prior = classifier is not None and (
            (getattr(classifier, "metadata", None) or {}).get("unit") != "atomic-piece")
        tune_assignment = supports_assignment_prior and trial.suggest_categorical(
            "tune_assignment_prior", (False, True))
        if tune_assignment:
            values["classifier_assignment_weight"] = trial.suggest_float(
                "classifier_assignment_weight", *bounds["classifier_assignment_weight"])
        tune_direct = classifier is not None and trial.suggest_categorical(
            "tune_direct_abstention", (False, True))
        if tune_direct:
            values["classifier_direct_min_probability"] = trial.suggest_float(
                "classifier_direct_min_probability",
                *bounds["classifier_direct_min_probability"])
        tune_propagated = classifier is not None and trial.suggest_categorical(
            "tune_propagated_abstention", (False, True))
        if tune_propagated:
            values["classifier_propagated_min_probability"] = trial.suggest_float(
                "classifier_propagated_min_probability",
                *bounds["classifier_propagated_min_probability"])
        policy = _candidate(base, values)
        if policy is None:
            return 1000.0
        score = ledger.score(policy, classifier, protected)
        trial.set_user_attr("policy", policy.to_dict())
        trial.set_user_attr("score", score.to_dict())
        return score.loss

    study.optimize(objective, n_trials=trials, n_jobs=1, show_progress_bar=False)
    ranked = []
    for trial in sorted(study.trials, key=lambda item: item.value if item.value is not None else math.inf):
        raw = trial.user_attrs.get("policy")
        if raw:
            ranked.append((trial.value, base.from_dict(raw)))
    return ranked, {"sampler": "tpe", "trials": len(study.trials), "seed": seed}


def _de_candidates(ledger, base, protected, trials, seed, classifier):
    from scipy.optimize import differential_evolution

    bounds_map = base.tunable_bounds()
    bounds = [bounds_map[name] for name in SEARCH_FIELDS]
    seen = {}
    baseline_vector = [getattr(base, name) for name in SEARCH_FIELDS]

    def objective(vector):
        values = dict(zip(SEARCH_FIELDS, vector))
        policy = _candidate(base, values)
        if policy is None:
            return 1000.0
        key = tuple(round(float(value), 8) for value in vector)
        if key not in seen:
            seen[key] = (ledger.score(policy, classifier, protected).loss, policy)
        return seen[key][0]

    dimension = len(bounds)
    popsize = 5
    maxiter = max(1, trials // max(1, popsize * dimension) - 1)
    result = differential_evolution(
        objective, bounds, seed=seed, popsize=popsize, maxiter=maxiter,
        polish=False, workers=1, updating="immediate", tol=0.0, x0=baseline_vector)
    ranked = sorted(seen.values(), key=lambda item: item[0])
    return ranked, {"sampler": "differential-evolution", "evaluations": result.nfev,
                    "requested_trials": trials, "seed": seed}


def _genetic_candidates(ledger, base, protected, trials, seed, classifier,
                        seed_profiles=None):
    """Evolve bounded policies with deterministic, budgeted genetic search.

    The chromosome lives in the unit cube and is decoded exclusively through
    :meth:`DecisionPolicy.tunable_bounds`.  The proven baseline is always the first evaluated
    member.  Only fields that can affect the supplied classifier are active, so a shadow run does
    not spend its finite budget evolving inert genes.  Every decoded policy is repaired for the
    sole cross-field invariant and then passed through ``DecisionPolicy.validate()`` by
    :func:`_candidate` before it can reach the ledger.

    ``trials`` is a hard cap on unique calls to ``ledger.score``.  Elites and duplicate offspring
    are served from a canonical-policy cache and therefore do not consume that budget.
    """
    budget = int(trials)
    if budget < 1:
        raise ValueError("genetic optimisation needs at least one evaluation")

    rng = random.Random(int(seed))
    bounds_map = base.tunable_bounds()
    classifier_unit = (getattr(classifier, "metadata", None) or {}).get("unit")
    active_fields = tuple(
        name for name in SEARCH_FIELDS
        if name not in CLASSIFIER_FIELDS
        or (classifier is not None and (
            name != "classifier_assignment_weight" or classifier_unit != "atomic-piece"))
    )
    dimensions = len(active_fields)
    if not dimensions:
        raise ValueError("genetic optimisation has no active decision-policy fields")

    population_size = min(budget, max(6, min(32, 2 * dimensions)))
    elite_count = max(1, population_size // 5)
    tournament_size = 3
    crossover_rate = 0.90
    mutation_rate = 1.0 / dimensions
    mutation_sigma = 0.12
    cache = {}
    cache_hits = 0
    repaired_candidates = 0
    rejected_candidates = 0
    clipped_genes = 0
    nonfinite_scores = 0
    generations = 0

    def encode(policy):
        return tuple(
            (float(getattr(policy, name)) - bounds_map[name][0])
            / (bounds_map[name][1] - bounds_map[name][0])
            for name in active_fields
        )

    def decode(genome):
        nonlocal clipped_genes, repaired_candidates, rejected_candidates
        clipped = []
        for raw in genome:
            value = min(1.0, max(0.0, float(raw)))
            clipped_genes += int(value != raw)
            clipped.append(value)
        values = {name: getattr(base, name) for name in SEARCH_FIELDS}
        for name, unit_value in zip(active_fields, clipped):
            low, high = bounds_map[name]
            value = low + unit_value * (high - low)
            if name in INTEGER_FIELDS:
                value = int(round(value))
            values[name] = value

        # Refusal must become cheaper before the absolute ownership reach ends.  Repairing this
        # dependent constraint keeps crossover productive while the policy loader remains the final
        # authority over every bound and coherence rule.
        if values["refuse_cost"] >= values["max_ownership_px"]:
            values["refuse_cost"] = max(
                bounds_map["refuse_cost"][0], values["max_ownership_px"] - 1e-6)
            repaired_candidates += 1
        policy = _candidate(base, values)
        if policy is None:
            rejected_candidates += 1
            return None, tuple(clipped)
        # Return the repaired policy's chromosome, rather than the pre-repair proposal, so its
        # descendants inherit exactly the decision that earned this fitness.
        return policy, encode(policy)

    def canonical_key(policy):
        # The JSON policy is the replay unit.  Names are provenance, not decisions, and are omitted
        # so the baseline and an equivalent evolved chromosome share one cached score.
        return tuple(round(float(getattr(policy, name)), 12) for name in SEARCH_FIELDS)

    def evaluate(genome, policy=None):
        nonlocal cache_hits, nonfinite_scores
        if policy is None:
            policy, genome = decode(genome)
        else:
            genome = tuple(min(1.0, max(0.0, float(value))) for value in genome)
        if policy is None:
            return None, False
        key = canonical_key(policy)
        if key in cache:
            cache_hits += 1
            return cache[key], False
        if len(cache) >= budget:
            return None, False
        loss = float(ledger.score(policy, classifier, protected).loss)
        if not math.isfinite(loss):
            loss = math.inf
            nonfinite_scores += 1
        record = (loss, policy, tuple(genome), key)
        cache[key] = record
        return record, True

    baseline_genome = encode(base)
    baseline_record, _ = evaluate(baseline_genome, policy=base)
    population = [baseline_record]
    population_keys = {baseline_record[3]}

    def add_initial(genome, policy=None):
        if len(population) >= population_size or len(cache) >= budget:
            return
        record, _new = evaluate(genome, policy=policy)
        if record is not None and record[3] not in population_keys:
            population.append(record)
            population_keys.add(record[3])

    # Safe, measured profiles and both corners make the first generation cover the full bounded
    # range.  The baseline remains first and survives through elitism if every mutation is worse.
    for profile in seed_profiles or ():
        changes = {name: value for name, value in profile.items() if name in active_fields}
        try:
            seeded = base.evolved(name="learned-v1", **changes)
        except ValueError:
            continue
        add_initial(encode(seeded), policy=seeded)
    add_initial((0.0,) * dimensions)
    add_initial((1.0,) * dimensions)
    attempts = 0
    while len(population) < population_size and len(cache) < budget:
        before = len(population)
        add_initial(tuple(rng.random() for _ in range(dimensions)))
        attempts = 0 if len(population) > before else attempts + 1
        if attempts > max(100, 20 * population_size):
            break

    def rank(records):
        return sorted(records, key=lambda item: (item[0], item[3]))

    def tournament(records):
        contestants = [records[rng.randrange(len(records))]
                       for _ in range(min(tournament_size, len(records)))]
        return min(contestants, key=lambda item: (item[0], item[3]))

    while len(cache) < budget and population:
        ordered = rank(population)
        elites = ordered[:min(elite_count, len(ordered))]
        wanted_new = min(max(1, population_size - len(elites)), budget - len(cache))
        offspring = []
        offspring_keys = set()
        attempts = 0
        max_attempts = max(200, 50 * wanted_new)
        while len(offspring) < wanted_new and len(cache) < budget and attempts < max_attempts:
            attempts += 1
            left = tournament(population)[2]
            right = tournament(population)[2]
            if rng.random() < crossover_rate:
                # Blend crossover permits a small extrapolation; decode clips it to the certified
                # unit cube before any policy can be scored.
                child = []
                for a, b in zip(left, right):
                    blend = rng.uniform(-0.15, 1.15)
                    child.append(blend * a + (1.0 - blend) * b)
            else:
                child = list(left)

            mutated = False
            for index in range(dimensions):
                if rng.random() < mutation_rate:
                    child[index] += rng.gauss(0.0, mutation_sigma)
                    mutated = True
            if not mutated:
                index = rng.randrange(dimensions)
                child[index] += rng.gauss(0.0, mutation_sigma)

            record, is_new = evaluate(child)
            if is_new and record[3] not in offspring_keys:
                offspring.append(record)
                offspring_keys.add(record[3])

        # Floating chromosomes almost never collide, but a deterministic immigrant prevents a
        # narrow, converged population from ending before its requested evaluation budget.
        while len(offspring) < wanted_new and len(cache) < budget and attempts < 2 * max_attempts:
            attempts += 1
            record, is_new = evaluate(tuple(rng.random() for _ in range(dimensions)))
            if is_new and record[3] not in offspring_keys:
                offspring.append(record)
                offspring_keys.add(record[3])
        if not offspring:
            break
        population = elites + offspring
        generations += 1

    ranked = [(record[0], record[1]) for record in rank(cache.values())]
    return ranked, {
        "sampler": "genetic", "trials": len(cache), "evaluations": len(cache),
        "requested_trials": budget, "seed": int(seed), "generations": generations,
        "population_size": population_size, "final_population_size": len(population),
        "elite_count": elite_count, "tournament_size": tournament_size,
        "crossover_rate": crossover_rate, "mutation_rate": mutation_rate,
        "mutation_sigma": mutation_sigma, "genes": list(active_fields),
        "normalization": "unit-interval-to-decision-policy-bounds",
        "baseline_included": True, "cache_hits": cache_hits,
        "repaired_candidates": repaired_candidates,
        "rejected_candidates": rejected_candidates, "clipped_genes": clipped_genes,
        "nonfinite_scores": nonfinite_scores,
    }


def optimise(train_root, out_path, validation_root=None, lockbox_root=None, cache_dir=None,
             trials=120, sampler="tpe", seed=20260725, classifier_path=None, report_path=None):
    from ..engine.classifier import CalibratedRunClassifier
    from ..engine.learning_data import CachedLedger
    from ..engine.policy import DecisionPolicy

    classifier = CalibratedRunClassifier.load(classifier_path) if classifier_path else None
    base = DecisionPolicy()
    if classifier is not None:
        # A newly trained model starts in true shadow mode.  The optimiser may grant influence only
        # where it improves the ledger without breaking any case the proven engine already passes.
        base = base.evolved(
            name="classifier-shadow-v1", classifier_assignment_weight=0.0,
            classifier_direct_min_probability=0.0,
            classifier_propagated_min_probability=0.0)
    train = CachedLedger(train_root, cache_dir=cache_dir).prepare()
    # Protected cases belong to the proven rule engine, not to an unvalidated new classifier.
    protected = train.baseline_pass_ids(None)
    baseline = train.score(base, classifier, protected)
    if sampler == "tpe":
        ranked, run_meta = _tpe_candidates(train, base, protected, trials, seed, classifier)
    elif sampler == "differential-evolution":
        ranked, run_meta = _de_candidates(train, base, protected, trials, seed, classifier)
    elif sampler == "genetic":
        ranked, run_meta = _genetic_candidates(
            train, base, protected, trials, seed, classifier)
    else:
        raise ValueError(f"unknown decision-policy sampler {sampler!r}")
    if not ranked:
        raise RuntimeError("optimiser produced no valid decision policy")

    # The proven rule engine is the safety envelope.  A scalar penalty helps the optimiser learn,
    # but it is not a substitute for a hard feasibility constraint: validation must never select a
    # policy that reopens even one protected training case.
    safe_ranked, rejected_for_regressions = _zero_regression_candidates(
        ranked, lambda policy: train.score(policy, classifier, protected))
    if not safe_ranked:
        safe_ranked = [(baseline.loss, base)]

    shortlisted = safe_ranked[:min(10, len(safe_ranked))]
    validation = None
    if validation_root:
        validation = CachedLedger(validation_root).prepare()
        validation_protected = validation.baseline_pass_ids(None)
        if validation.contexts and validation.cases:
            shortlisted = sorted(
                ((validation.score(policy, classifier, validation_protected).loss, policy,
                  train_loss) for train_loss, policy in shortlisted),
                key=lambda item: (item[0], item[2]))
            _validation_loss, selected, selected_train_loss = shortlisted[0]
        else:
            selected_train_loss, selected = safe_ranked[0]
    else:
        selected_train_loss, selected = safe_ranked[0]

    selected_score = train.score(selected, classifier, protected)
    selected.save(out_path)
    report = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "train_root": os.path.abspath(train_root),
        "validation_root": os.path.abspath(validation_root) if validation_root else None,
        "lockbox_root": os.path.abspath(lockbox_root) if lockbox_root else None,
        "classifier": os.path.abspath(classifier_path) if classifier_path else None,
        "protected_baseline_cases": len(protected),
        "unsafe_candidates_rejected": rejected_for_regressions,
        "baseline": baseline.to_dict(), "selected": selected_score.to_dict(),
        "selected_policy": selected.to_dict(), **run_meta,
    }
    promotion_reasons = []
    if selected_score.baseline_regressions:
        # Defensive duplicate of the hard selection constraint.  This should be unreachable, but a
        # future optimiser refactor must fail closed rather than silently promoting an unsafe model.
        promotion_reasons.append("training reopened protected cases")
    if not _measurably_better(selected_score.loss, baseline.loss):
        promotion_reasons.append("training has no measurable improvement over baseline")
    if validation and validation.contexts and validation.cases:
        validation_protected = validation.baseline_pass_ids(None)
        validation_baseline = validation.score(base, classifier, validation_protected)
        validation_selected = validation.score(selected, classifier, validation_protected)
        report["validation_baseline"] = validation_baseline.to_dict()
        report["validation"] = validation_selected.to_dict()
        if validation_selected.baseline_regressions:
            promotion_reasons.append("validation reopened protected cases")
        if validation_selected.loss > validation_baseline.loss:
            promotion_reasons.append("validation loss is worse than baseline")
        elif not _measurably_better(validation_selected.loss, validation_baseline.loss):
            promotion_reasons.append("validation has no measurable improvement over baseline")
        if validation_selected.sheets < 5 or validation_selected.cases < 100:
            promotion_reasons.append("labelled validation coverage is below 5 sheets / 100 cases")
    else:
        promotion_reasons.append("no labelled validation ledger")
    if classifier and (classifier.metadata or {}).get("calibration_rejected"):
        promotion_reasons.append("classifier calibration was rejected as non-monotonic")
    if lockbox_root:
        lockbox = CachedLedger(lockbox_root).prepare()
        # Deliberately evaluated only after the policy has already been saved/selected.
        if lockbox.contexts and lockbox.cases:
            lockbox_protected = lockbox.baseline_pass_ids(None)
            lockbox_baseline = lockbox.score(base, classifier, lockbox_protected)
            lockbox_selected = lockbox.score(selected, classifier, lockbox_protected)
            report["lockbox_baseline"] = lockbox_baseline.to_dict()
            report["lockbox"] = lockbox_selected.to_dict()
            if lockbox_selected.baseline_regressions:
                promotion_reasons.append("lockbox reopened protected cases")
            if lockbox_selected.loss > lockbox_baseline.loss:
                promotion_reasons.append("lockbox loss is worse than baseline")
        else:
            report["lockbox"] = {"status": "no labelled cases; not used as a proxy objective"}
            promotion_reasons.append("lockbox has no labelled correctness cases")
    else:
        promotion_reasons.append("no independent lockbox supplied")
    report["promotion"] = {
        "eligible": not promotion_reasons,
        "reasons": promotion_reasons,
        "rule": "measurable train+validation improvement; zero protected regressions; "
                "validation >=5 sheets/100 cases; calibrated model; labelled non-degraded lockbox",
    }
    report_path = report_path or os.path.splitext(out_path)[0] + "-report.json"
    os.makedirs(os.path.dirname(os.path.abspath(report_path)) or ".", exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return selected, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train-root", required=True)
    parser.add_argument("--validation-root")
    parser.add_argument("--lockbox-root")
    parser.add_argument("--cache-dir")
    parser.add_argument("--trials", type=int, default=120)
    parser.add_argument(
        "--sampler", choices=("tpe", "differential-evolution", "genetic"), default="tpe")
    parser.add_argument("--seed", type=int, default=20260725)
    parser.add_argument("--classifier")
    parser.add_argument("--out", required=True)
    parser.add_argument("--report")
    args = parser.parse_args()
    _policy, report = optimise(
        args.train_root, args.out, args.validation_root, args.lockbox_root,
        args.cache_dir, args.trials, args.sampler, args.seed, args.classifier, args.report)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
