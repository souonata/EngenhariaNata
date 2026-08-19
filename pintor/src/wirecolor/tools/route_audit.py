"""Objective per-route regression signal from a diagnostic dump.

    python -m wirecolor.tools.route_audit --diag /tmp/diag \
        --routes tests/data/wirecolor_routes_pub2503.json

Each route lists checkpoints on one physical wire together with the colour code its printed legend
demands.  A checkpoint passes when a traced arc near it carries exactly that code in either the
solid or the dashed representation.  Reading the answer from the dump instead of from a rendered
image keeps the signal exact (no anti-aliasing, no band-width guessing) and costs milliseconds, so
every iteration of an ownership rule can be measured immediately.

Exit code 0 when every checkpoint passes, 1 otherwise.
"""
from __future__ import annotations

import argparse
import json
import os

from .route_probe import _polyline_distance


def audit(directory, routes, radius=16.0):
    arcs = json.load(open(os.path.join(directory, "arcs.json")))
    results = []
    for route in routes:
        expected = route["code"]
        checkpoints = []
        for x, y in route["points"]:
            near = [(_polyline_distance(arc["points"], x, y), arc) for arc in arcs]
            near = sorted((item for item in near if item[0] <= radius),
                          key=lambda item: item[0])
            codes = {arc.get("code") or arc.get("dash_code")
                     for _d, arc in near} - {None}
            if not near:
                state, detail = "NO-ARC", "no traced conductor here"
            elif expected in codes:
                state, detail = "PASS", ""
            elif codes:
                state, detail = "WRONG", f"painted {sorted(codes)}"
            else:
                excluded = {arc["excluded"] for _d, arc in near if arc.get("excluded")}
                state = "BLACK"
                detail = f"excluded={sorted(excluded)}" if excluded else "unpainted"
            checkpoints.append({"x": x, "y": y, "state": state, "detail": detail,
                                "arc": near[0][1]["si"] if near else None,
                                "root": near[0][1].get("root") if near else None,
                                "dash_root": near[0][1].get("dash_root") if near else None})
        passed = sum(item["state"] == "PASS" for item in checkpoints)
        results.append({"name": route["name"], "code": expected,
                        "passed": passed, "total": len(checkpoints),
                        "checkpoints": checkpoints})
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diag", required=True)
    ap.add_argument("--routes", required=True)
    ap.add_argument("--radius", type=float, default=16.0)
    ap.add_argument("--json", help="also write the full result as JSON here")
    args = ap.parse_args()

    spec = json.load(open(args.routes))
    results = audit(args.diag, spec["routes"], args.radius)
    complete = 0
    for row in results:
        mark = "OK  " if row["passed"] == row["total"] else (
            "PART" if row["passed"] else "FAIL")
        complete += row["passed"] == row["total"]
        print(f"[{mark}] {row['name']}  {row['passed']}/{row['total']}")
        for item in row["checkpoints"]:
            if item["state"] != "PASS":
                print(f"        ({item['x']},{item['y']}) {item['state']} {item['detail']} "
                      f"arc={item['arc']} root={item['root']} dash_root={item['dash_root']}")
    checkpoints = sum(row["total"] for row in results)
    passed = sum(row["passed"] for row in results)
    print(f"routes complete {complete}/{len(results)}; checkpoints {passed}/{checkpoints}")
    if args.json:
        json.dump(results, open(args.json, "w"), indent=1)
    raise SystemExit(0 if passed == checkpoints else 1)


if __name__ == "__main__":
    main()
