"""Train the tiny wire-vs-furniture graph classifier from the permanent defect ledger.

    python -m wirecolor.tools.train_run_classifier \
        --root workspaces/wirecolor_qa --out workspaces/wirecolor_qa/models/run_classifier.json

One physical run contributes at most one sample per sheet, regardless of how many pins were placed
on it.  Conflicting pins on one unsplit run are excluded rather than averaged into a lie.  The
classifier is calibrated on whole held-out sheets and is safe to deploy in shadow mode first.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
import re


def drawing_group_key(tag):
    """Keep sibling pages from one publication in the same validation group."""
    return re.sub(r"_p\d+$", "", str(tag))


def collect_training_rows(ledger, include_tags=None):
    from ..engine.ownership import OwnedRun
    from .qa_cases import PIN_RADIUS_PX, _nearest_run

    rows, labels, groups = [], [], []
    excluded_conflicts = excluded_unresolved = 0
    include_tags = set(ledger.contexts) if include_tags is None else set(include_tags)
    for tag, context in ledger.contexts.items():
        if tag not in include_tags:
            continue
        raw_runs = [OwnedRun(index=i, points=piece["points"], code=None,
                             legend_raw=None, distance=None)
                    for i, piece in enumerate(context.pieces)]
        features = context.piece_features
        labels_by_run = {}
        for case in ledger.cases_by_tag[tag]:
            nearest = _nearest_run(raw_runs, *case["at"])
            if not nearest or nearest[0] > PIN_RADIUS_PX:
                excluded_unresolved += 1
                continue
            run = nearest[1]
            label = 0 if case.get("expect") == "black" else 1
            labels_by_run.setdefault(run.index, set()).add(label)
        for run_index, observed in labels_by_run.items():
            if len(observed) != 1:
                excluded_conflicts += 1
                continue
            rows.append(features[run_index])
            labels.append(next(iter(observed)))
            groups.append(drawing_group_key(tag))
    return rows, labels, groups, {
        "excluded_conflicting_runs": excluded_conflicts,
        "excluded_unresolved_pins": excluded_unresolved,
    }


def train(roots, out_path, cache_dir=None, dpi=200, convention="volvo_classic"):
    from ..engine.classifier import fit_calibrated_classifier
    from ..engine.learning_data import CachedLedger, combine_ledgers

    roots = [roots] if isinstance(roots, (str, os.PathLike)) else list(roots)
    ledgers = [CachedLedger(root, cache_dir=cache_dir, dpi=dpi,
                            convention=convention) for root in roots]
    ledger = combine_ledgers(ledgers)
    rows, labels, groups, excluded = collect_training_rows(ledger)
    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "roots": [os.path.abspath(root) for root in roots], "dpi": dpi,
        "convention": convention, "unit": "atomic-piece",
        **excluded,
    }
    model = fit_calibrated_classifier(rows, labels, groups=groups, metadata=metadata)
    model.save(out_path)

    probabilities = [model.predict_probability(row) for row in rows]
    predictions = [probability >= 0.5 for probability in probabilities]
    confusion = {"true_wire": 0, "true_non_wire": 0, "false_wire": 0, "false_non_wire": 0}
    for predicted, label in zip(predictions, labels):
        if predicted and label:
            confusion["true_wire"] += 1
        elif not predicted and not label:
            confusion["true_non_wire"] += 1
        elif predicted:
            confusion["false_wire"] += 1
        else:
            confusion["false_non_wire"] += 1
    return model, {"model": os.path.abspath(out_path), "confusion_at_0_5": confusion,
                   **(model.metadata or {})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, action="append",
                        help="labelled non-lockbox root; repeat to combine drawing sets")
    parser.add_argument("--out", required=True)
    parser.add_argument("--cache-dir")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--convention", default="volvo_classic")
    args = parser.parse_args()
    _model, report = train(args.root, args.out, args.cache_dir, args.dpi, args.convention)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
