# Wirecolor Learning Layer

The learning layer is deliberately subordinate to the deterministic painter. It can rank bounded
graph decisions or abstain from low-confidence paint; it cannot mutate source code, invent a colour,
or bypass PDF-preservation checks.

## Architecture

1. `vector_page.py` extracts an immutable page context: vector runs, connectivity, legend evidence,
   symbols, and scale. Painter and QA use this same context and decision path.
2. `constraints.py` assigns legends globally with an explicit refusal option. The default fast
   linear assignment is algebraically equivalent to the general MILP; `constraint_solver="milp"`
   is retained for audits.
3. `classifier.py` is a small NumPy logistic model over intrinsic graph features. The abstention
   unit is an atomic polyline edge plus its parent-run context: a conductor fused to a frame can
   keep its wire edge coloured while the frame edge returns to black. Training and inference use
   the same cached immutable features.
4. Training groups all pages from one publication together. `cross_validate_learning.py` fits five
   cross-fitted models, selects thresholds only from publication-held-out predictions, and saves
   their average as the production ensemble. A non-monotonic calibration member falls back to a
   constant class prevalence, so it cannot invert wire/furniture evidence.
5. `abstain_with_classifier()` is fail-safe: low-confidence decisions become black again. It never
   changes one colour into another.
6. `policy.py` is the only optimisation genome. Bounds and coherence rules are versioned and
   validated when loading JSON.
7. `learning_data.py` caches expensive extraction by PDF SHA-256, page, DPI, convention, and cache
   schema. Candidate policies replay the cheap decision layer.
8. `tune_decision_policy.py` uses Bayesian TPE by default, with SciPy differential evolution as an
   independent comparison. Optimisation sees training only; validation selects among candidates;
   the lockbox is evaluated once after selection.

## Safety and promotion

- The default painter loads no classifier and preserves the proven deterministic baseline.
- Every previously passing training case is a hard constraint. Unsafe candidates are removed before
  validation selection; the scalar regression penalty is only an optimiser learning signal.
- Generation-3 promotion requires zero protected regressions, at least ten labelled non-lockbox
  sheets and 200 cases, accepted group calibration, and a labelled independent lockbox evaluated
  once after selection.
- A candidate JSON is an experiment, not a production policy. Production activation must be an
  explicit separate action after `promotion.eligible` is true and PDF V7 checks pass.

The loss is macro-averaged by sheet so heavily marked drawings cannot dominate. False paint costs
more than missed paint, and an exact wrong colour costs more than a generic miss.

## Commands

Run generation 3 from the `Pintor` directory:

```powershell
$env:PYTHONPATH='src'
python -m wirecolor.tools.cross_validate_learning `
  --root workspaces/wirecolor_qa `
  --root workspaces/wirecolor_holdout `
  --lockbox-root workspaces/wirecolor_foreign `
  --trials 120 `
  --classifier-out workspaces/wirecolor_qa/models/run_classifier_cv_v3.json `
  --policy-out workspaces/wirecolor_qa/models/decision_policy_cv_v3.json

python -m wirecolor.tools.qa_sweep --root workspaces/wirecolor_qa --workers 1 `
  --decision-policy workspaces/wirecolor_qa/models/decision_policy_cv_v3.json `
  --run-classifier workspaces/wirecolor_qa/models/run_classifier_cv_v3.json
```

The validated 2026-08-19 run used 385 atomic samples from 13 publications. Publication-group OOF
loss improved 0.47861887 -> 0.42844083: false paint 136 -> 112, wrong colour 11 -> 10, missed
paint 48 -> 49, unresolved 36 unchanged, and zero protected regressions. The frozen two-publication
foreign lockbox improved 0.56578947 -> 0.49682396: false paint 30 -> 26, all other defect counts
unchanged, and zero protected regressions. The report marks the candidate eligible for promotion.

Install the optimiser only on machines that train policies:

```powershell
python -m pip install -r requirements-learning.txt
```

The production painter does not import Optuna or scikit-learn.
