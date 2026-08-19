"""Replay every cached sheet and audit it against all accumulated ground truth.

    python -m wirecolor.tools.corpus_replay --root /tmp/wirecolor_corpus \
        [--routes-dir tests/data] [--only pub2503_p0] [--priors priors.json]

This is the regression signal for a rule change.  Each sheet directory holds the working render,
the tiled OCR labels and the OCR memo from its first full run; replaying reuses the recognised
text and re-executes the entire reasoning chain, so a sheet that once cost two hours costs
minutes.  Every sheet with a ground-truth route file is scored checkpoint by checkpoint, and the
sheet profiles are aggregated into corpus priors with the outliers named.

A rule that improves one drawing and quietly breaks another is therefore visible immediately,
which is the whole point: the library only converges if nothing regresses.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import time


def _sheets(root, only=None):
    for work in sorted(glob.glob(os.path.join(root, "*", "*_work.png"))):
        directory = os.path.dirname(work)
        tag = os.path.basename(work)[: -len("_work.png")]
        if only and tag not in only:
            continue
        yield directory, tag, work


def replay_sheet(directory, tag, work, convention_name, routes_dir):
    from ..instrument import reset_for_tests
    from ..labels.conventions import load_convention
    from ..pipeline import run_page
    from ..profile import measure_sheet_profile, save_profile

    diag_dir = os.path.join(directory, "diag")
    memo = os.path.join(directory, "ocr_memo.json")
    # Rebind the instrumentation per sheet: one memo and one dump per drawing, so a replay of
    # sheet B can never inherit sheet A's cached reads.
    reset_for_tests(ocr_cache=memo, diag_dir=diag_dir)

    meta_path = os.path.join(directory, f"{tag}_meta.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    started = time.time()
    solution = run_page(work, os.path.join(directory, f"{tag}_labels.json"),
                        load_convention(convention_name))
    elapsed = time.time() - started

    profile = measure_sheet_profile(solution, meta)
    profile_path = save_profile(profile, os.path.join(directory, f"{tag}_profile.json"))

    result = {"tag": tag, "seconds": round(elapsed, 1), "profile": profile_path,
              "dash_pitch": profile["dash_rhythm"]["pitch"],
              "solid_claims": profile["coverage"]["solid_claims"],
              "dashed_routes": profile["topology"]["dashed_routes"]}

    routes_file = os.path.join(routes_dir, f"wirecolor_routes_{tag.split('_')[0]}.json")
    if os.path.exists(routes_file):
        from .route_audit import audit
        spec = json.load(open(routes_file))
        rows = audit(diag_dir, spec["routes"])
        result["routes"] = {
            "complete": sum(row["passed"] == row["total"] for row in rows),
            "total_routes": len(rows),
            "checkpoints_passed": sum(row["passed"] for row in rows),
            "checkpoints": sum(row["total"] for row in rows),
            "failing": [{"name": row["name"],
                         "at": [[item["x"], item["y"], item["state"]]
                                for item in row["checkpoints"] if item["state"] != "PASS"]}
                        for row in rows if row["passed"] != row["total"]],
        }
    return result, profile_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True,
                    help="directory holding one sub-directory per cached sheet")
    ap.add_argument("--routes-dir", default="tests/data")
    ap.add_argument("--convention", default="volvo_classic")
    ap.add_argument("--only", action="append")
    ap.add_argument("--priors", help="write the aggregated corpus priors here")
    ap.add_argument("--json", help="write the full replay result here")
    args = ap.parse_args()

    from ..profile import aggregate_profiles, outliers

    results, profile_paths = [], []
    for directory, tag, work in _sheets(args.root, args.only):
        print(f"--- replay {tag}")
        result, profile_path = replay_sheet(directory, tag, work,
                                            args.convention, args.routes_dir)
        results.append(result)
        profile_paths.append(profile_path)

    priors = aggregate_profiles(profile_paths)
    if args.priors:
        json.dump(priors, open(args.priors, "w"), indent=1)

    print("\n=== corpus replay ===")
    regressions = 0
    for result in results:
        routes = result.get("routes")
        if routes:
            complete = f"{routes['complete']}/{routes['total_routes']} routes, " \
                       f"{routes['checkpoints_passed']}/{routes['checkpoints']} checkpoints"
            regressions += routes["checkpoints"] - routes["checkpoints_passed"]
        else:
            complete = "no ground truth yet"
        print(f"{result['tag']}: {complete} | {result['seconds']}s | "
              f"pitch {result['dash_pitch']} | {result['dashed_routes']} dashed routes")
        for failing in (routes or {}).get("failing", ()):
            print(f"    FAIL {failing['name']}: {failing['at']}")

    for result, path in zip(results, profile_paths):
        flagged = outliers(json.load(open(path)), priors)
        for item in flagged:
            print(f"outlier {result['tag']}: {item['quantity']}={item['value']} "
                  f"vs corpus {item['corpus_median']} ({item['deviations']} MAD)")

    if args.json:
        json.dump({"sheets": results, "priors": priors}, open(args.json, "w"), indent=1)
    print(f"sheets {len(results)}; failing checkpoints {regressions}")
    raise SystemExit(0 if regressions == 0 else 1)


if __name__ == "__main__":
    main()
