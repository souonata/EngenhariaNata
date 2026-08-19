"""Global legend ownership with explicit refusal and learned wire priors.

The fast path is the same exact linear assignment problem the proven engine already solved.  When
a run classifier is present, ownership becomes a mixed-integer model: assigning any legend to a
run activates that run and pays its learned non-wire penalty once.  This prevents multiple nearby
legends from independently overwhelming the same furniture prior, and keeps every decision global.
"""
from __future__ import annotations

from dataclasses import dataclass

from .classifier import run_feature_rows
from .policy import DecisionPolicy


@dataclass(frozen=True)
class ConstraintDiagnostics:
    solver: str
    candidates: int
    assigned: int
    refused: int
    abstained_margin: int = 0
    classifier_influenced: bool = False
    fallback_reason: str | None = None

    def to_dict(self):
        return {
            "solver": self.solver, "candidates": self.candidates,
            "assigned": self.assigned, "refused": self.refused,
            "abstained_margin": self.abstained_margin,
            "classifier_influenced": self.classifier_influenced,
            "fallback_reason": self.fallback_reason,
        }


def _candidate_table(legends, runs, policy):
    from .ownership import cost

    table = []
    for li, legend in enumerate(legends):
        for ri, points in enumerate(runs):
            value = cost(
                legend, points,
                max_ownership_px=policy.max_ownership_px,
                axis_mismatch_cost=policy.axis_mismatch_cost,
            )
            if value is not None:
                table.append((li, ri, float(value)))
    return table


def _finish(legends, runs, candidates, chosen, policy, solver, classifier_influenced,
            fallback_reason=None):
    from .ownership import OwnedRun, cost

    owned = [OwnedRun(index=i, points=points, code=None, legend_raw=None, distance=None)
             for i, points in enumerate(runs)]
    by_legend = {}
    for li, ri, value in candidates:
        by_legend.setdefault(li, []).append((value, ri))
    assigned_legends = set()
    abstained_margin = 0
    for li, ri, value in chosen:
        alternatives = [candidate for candidate, other_ri in by_legend.get(li, ())
                        if other_ri != ri]
        second = min([policy.refuse_cost, *alternatives])
        margin = max(0.0, (second - value) / max(policy.refuse_cost, 1e-6))
        if margin < policy.min_direct_assignment_margin:
            owned[ri].abstained = True
            owned[ri].abstain_reason = "ambiguous direct assignment"
            owned[ri].abstained_from_code = legends[li].code
            abstained_margin += 1
            continue
        legend = legends[li]
        owned[ri].code = legend.code
        owned[ri].legend_raw = legend.raw
        owned[ri].distance = round(value, 1)
        owned[ri].confidence = round(min(1.0, 0.55 * max(
            0.0, 1.0 - value / max(policy.refuse_cost, 1.0)) + 0.45 * margin), 4)
        assigned_legends.add(li)

    # Repeated same-code legends corroborate but can never steal or recolour a run.
    for li, legend in enumerate(legends):
        if li in assigned_legends:
            continue
        for run in owned:
            if run.code != legend.code:
                continue
            if cost(legend, run.points,
                    max_ownership_px=policy.max_ownership_px,
                    axis_mismatch_cost=policy.axis_mismatch_cost) is not None:
                run.corroborations += 1
                run.confidence = min(1.0, run.confidence + 0.15)
                break

    diagnostics = ConstraintDiagnostics(
        solver=solver, candidates=len(candidates), assigned=len(assigned_legends),
        refused=len(legends) - len(assigned_legends), abstained_margin=abstained_margin,
        classifier_influenced=classifier_influenced, fallback_reason=fallback_reason)
    return owned, diagnostics


def _linear_assignment(legends, runs, candidates, policy, fallback_reason=None,
                       run_activation_costs=None):
    import numpy as np
    from scipy.optimize import linear_sum_assignment

    n_legends, n_runs = len(legends), len(runs)
    big = 1e6
    matrix = np.full((n_legends, n_runs + n_legends), big, dtype=float)
    run_activation_costs = run_activation_costs or [0.0] * n_runs
    for li, ri, value in candidates:
        matrix[li, ri] = value + run_activation_costs[ri]
    for li in range(n_legends):
        matrix[li, n_runs + li] = policy.refuse_cost
    rows, cols = linear_sum_assignment(matrix)
    geometric = {(li, ri): value for li, ri, value in candidates}
    chosen = [(int(li), int(ri), float(geometric[(int(li), int(ri))]))
              for li, ri in zip(rows, cols) if ri < n_runs and matrix[li, ri] < big]
    learned = any(cost > 0 for cost in run_activation_costs)
    solver = "linear-assignment+learned-prior" if learned else "linear-assignment"
    return _finish(legends, runs, candidates, chosen, policy, solver, learned,
                   fallback_reason=fallback_reason)


def _milp_assignment(legends, runs, candidates, policy, classifier, min_run_px,
                     feature_rows=None):
    import numpy as np
    from scipy.optimize import Bounds, LinearConstraint, milp
    from scipy.sparse import coo_matrix

    n_candidates = len(candidates)
    n_legends, n_runs = len(legends), len(runs)
    refusal_offset = n_candidates
    activation_offset = refusal_offset + n_legends
    n_vars = activation_offset + n_runs

    rows, cols, data = [], [], []
    lower, upper = [], []

    # Every legend is either assigned once or explicitly refused.
    by_legend = {}
    by_run = {}
    for ci, (li, ri, _value) in enumerate(candidates):
        by_legend.setdefault(li, []).append(ci)
        by_run.setdefault(ri, []).append(ci)
    row = 0
    for li in range(n_legends):
        for ci in by_legend.get(li, ()):
            rows.append(row); cols.append(ci); data.append(1.0)
        rows.append(row); cols.append(refusal_offset + li); data.append(1.0)
        lower.append(1.0); upper.append(1.0); row += 1

    # A physical run owns at most one distinct legend in the primary pass.
    for ri in range(n_runs):
        for ci in by_run.get(ri, ()):
            rows.append(row); cols.append(ci); data.append(1.0)
        lower.append(-np.inf); upper.append(1.0); row += 1

    # Assignment implies run activation.  The activation carries the learned furniture penalty.
    for ci, (_li, ri, _value) in enumerate(candidates):
        rows.extend((row, row)); cols.extend((ci, activation_offset + ri)); data.extend((1.0, -1.0))
        lower.append(-np.inf); upper.append(0.0); row += 1

    matrix = coo_matrix((data, (rows, cols)), shape=(row, n_vars)).tocsr()
    objective = np.zeros(n_vars, dtype=float)
    for ci, (_li, _ri, value) in enumerate(candidates):
        objective[ci] = value
    objective[refusal_offset:activation_offset] = policy.refuse_cost
    feature_rows = feature_rows or run_feature_rows(runs, legends, min_run_px)
    probabilities = [classifier.predict_probability(features) for features in feature_rows]
    for ri, probability in enumerate(probabilities):
        objective[activation_offset + ri] = policy.classifier_assignment_weight * (1.0 - probability)

    result = milp(
        c=objective, integrality=np.ones(n_vars, dtype=np.uint8),
        bounds=Bounds(np.zeros(n_vars), np.ones(n_vars)),
        constraints=LinearConstraint(matrix, np.asarray(lower), np.asarray(upper)),
        options={"time_limit": policy.milp_time_limit_seconds, "presolve": True},
    )
    if not result.success or result.x is None:
        reason = getattr(result, "message", "MILP returned no solution")
        return _linear_assignment(legends, runs, candidates, policy,
                                  fallback_reason=f"MILP fallback: {reason}")
    chosen = [(li, ri, value) for ci, (li, ri, value) in enumerate(candidates)
              if result.x[ci] >= 0.5]
    return _finish(legends, runs, candidates, chosen, policy, "milp", True)


def constrained_assign(legends, runs, policy=None, classifier=None, min_run_px=1.0,
                       feature_rows=None):
    """Assign every legend globally, with an explicit refusal outcome.

    Without a classifier the specialized exact assignment solver is the fastest correct solver.
    With a classifier a MILP adds one shared activation variable per run so learned non-wire
    evidence is paid once and remains globally consistent.
    """
    policy = (policy or DecisionPolicy()).validate()
    classifier_unit = (getattr(classifier, "metadata", None) or {}).get("unit")
    assignment_classifier = None if classifier_unit == "atomic-piece" else classifier
    if not legends or not runs:
        return _finish(legends, runs, [], [], policy, "empty", bool(assignment_classifier))
    candidates = _candidate_table(legends, runs, policy)
    if assignment_classifier is None or policy.classifier_assignment_weight <= 0:
        return _linear_assignment(legends, runs, candidates, policy)
    if policy.constraint_solver == "auto":
        features = feature_rows or run_feature_rows(runs, legends, min_run_px)
        activation_costs = [policy.classifier_assignment_weight
                            * (1.0 - assignment_classifier.predict_probability(row))
                            for row in features]
        # There is at most one primary legend per run, therefore the MILP activation variable can
        # be eliminated algebraically: adding its one-time cost to each candidate is exactly the
        # same optimisation problem and lets the specialized assignment solver run far faster.
        return _linear_assignment(legends, runs, candidates, policy,
                                  run_activation_costs=activation_costs)
    try:
        return _milp_assignment(legends, runs, candidates, policy, assignment_classifier, min_run_px,
                                feature_rows=feature_rows)
    except Exception as error:
        # Painting must remain available if an optional learning dependency/model is broken.
        return _linear_assignment(
            legends, runs, candidates, policy,
            fallback_reason=f"MILP exception: {type(error).__name__}: {error}")


def abstain_with_classifier(owned, feature_rows, classifier, policy):
    """Remove low-confidence colours; never add or change a colour.

    A directly printed legend is stronger than a model, hence its much lower threshold.  A colour
    inherited only by graph propagation needs stronger wire evidence.  Every abstention is recorded
    on the run for diagnostics and review.
    """
    if classifier is None:
        return 0
    abstained = 0
    for run, features in zip(owned, feature_rows):
        if not run.code:
            continue
        probability = classifier.predict_probability(features)
        run.wire_probability = round(probability, 4)
        threshold = (policy.classifier_propagated_min_probability if run.propagated
                     else policy.classifier_direct_min_probability)
        if probability >= threshold or run.corroborations:
            continue
        run.abstained_from_code = run.code
        run.code = None
        run.legend_raw = None
        run.abstained = True
        run.abstain_reason = ("learned non-wire prior after propagation" if run.propagated
                              else "learned non-wire prior")
        run.propagated = False
        abstained += 1
    return abstained
