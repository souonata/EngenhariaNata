"""The defect ledger: every confirmed defect becomes a permanent, re-runnable check.

    python -m wirecolor.tools.qa_cases --root workspaces/wirecolor_qa --evaluate
    python -m wirecolor.tools.qa_cases --root workspaces/wirecolor_qa --add-pins pins.json

This is the part that makes the loop cumulative. A defect found by the user or by the checker is
recorded with the page coordinate it was seen at and what SHOULD happen there, and from then on it
is re-evaluated on every round. A fix that quietly reintroduces an old defect is caught by name.

Cases are evaluated against the engine's own decisions, not against pixels: the run nearest the
pinned point is found and its assigned code is compared with the expectation. That is deliberately
one level above the paint -- it survives a change in band thickness, DPI or stripe order, and it
fails exactly when the OWNERSHIP is wrong, which is what every defect in the catalogue reduces to.

Expectations
    painted:<CODE>  the conductor there must carry this code (e.g. painted:GN/SB)
    painted         it must carry some colour, which one is not asserted
    black           it must be left unpainted (symbol ink, unlabelled conductor, dashed wire)
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from math import hypot

# How far from the pinned point we are still willing to call it "that conductor". A pin is placed
# by eye on a zoomed image, and the drawing's own lines are a couple of pixels wide at 200 DPI.
PIN_RADIUS_PX = 26.0


def _nearest_run(owned, x, y):
    best = None
    for run in owned:
        for index in range(len(run.points) - 1):
            (ax, ay), (bx, by) = run.points[index], run.points[index + 1]
            dx, dy = bx - ax, by - ay
            length2 = dx * dx + dy * dy
            t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length2))
            distance = hypot(x - (ax + t * dx), y - (ay + t * dy))
            if best is None or distance < best[0]:
                best = (distance, run)
    return best


def _decide(owned, case):
    """Verdict for one case: pass / fail / unresolved, with what was actually found."""
    found = _nearest_run(owned, *case["at"])
    if not found or found[0] > PIN_RADIUS_PX:
        # No conductor near the pin at all. That is itself information -- the geometry stage never
        # produced a run there -- so it is reported rather than silently passed.
        return {"verdict": "unresolved", "found": None,
                "distance_px": None if not found else round(found[0], 1)}
    distance, run = found
    actual = run.code
    expect = case["expect"]
    if case.get("class") == "wrong-colour" and expect == "painted":
        return {"verdict": "unresolved", "found": actual, "distance_px": round(distance, 1),
                "error": "wrong-colour case needs an exact painted:<CODE> expectation"}
    if expect == "black":
        passed = actual is None
    elif expect == "painted":
        passed = actual is not None
    elif expect.startswith("painted:"):
        passed = actual == expect.split(":", 1)[1]
    else:
        return {"verdict": "unresolved", "found": actual, "distance_px": round(distance, 1),
                "error": f"unknown expectation {expect!r}"}
    return {"verdict": "pass" if passed else "fail", "found": actual,
            "distance_px": round(distance, 1),
            "propagated": bool(getattr(run, "propagated", False))}


def _own_sheet(pdf_path, page_index, dpi, convention_name, decision_policy=None,
               run_classifier=None, return_context=False):
    """Re-derive the engine's ownership decisions for one sheet -- no painting, no writing."""
    import fitz

    from ..engine.vector_page import decide_vector_context, extract_vector_context
    from ..labels.conventions import load_convention

    convention = load_convention(convention_name)
    document = fitz.open(pdf_path)
    page = document[page_index]
    context = extract_vector_context(page, dpi, convention)
    owned, diagnostics = decide_vector_context(
        context, policy=decision_policy, classifier=run_classifier)
    document.close()
    return (owned, context, diagnostics) if return_context else owned


def evaluate(root, dpi=200, convention="volvo_classic", decision_policy=None,
             run_classifier=None, persist=True, only_tags=None):
    root = os.path.abspath(root)
    state_dir = os.path.join(root, "state")
    cases_path = os.path.join(state_dir, "cases.json")
    if not os.path.exists(cases_path):
        return {"cases": [], "summary": {"total": 0}}
    ledger = json.load(open(cases_path))
    sheets = {s["tag"]: s for s in json.load(open(os.path.join(state_dir, "eval_set.json")))["sheets"]}

    wanted = set(only_tags or ())
    selected_cases = [case for case in ledger["cases"]
                      if not wanted or case["tag"] in wanted]
    by_tag = {}
    for case in selected_cases:
        by_tag.setdefault(case["tag"], []).append(case)

    for tag, cases in by_tag.items():
        sheet = sheets.get(tag)
        if not sheet:
            for case in cases:
                case["result"] = {"verdict": "unresolved", "error": "sheet not in evaluation set"}
            continue
        owned = _own_sheet(os.path.join(root, sheet["pdf"]), sheet["page"], dpi, convention,
                           decision_policy=decision_policy, run_classifier=run_classifier)
        for case in cases:
            case["result"] = _decide(owned, case)

    counts = {"pass": 0, "fail": 0, "unresolved": 0}
    for case in selected_cases:
        verdict = case.get("result", {}).get("verdict", "unresolved")
        counts[verdict] = counts.get(verdict, 0) + 1
        # A case that passes is CLOSED, but stays in the ledger for ever -- that is the whole point.
        if verdict == "pass" and case.get("status") == "open":
            case["status"] = "fixed"
            case["closed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        elif verdict == "fail" and case.get("status") == "fixed":
            case["status"] = "reopened"
    ledger["summary"] = {"total": len(selected_cases), **counts,
                         "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    if persist:
        with open(cases_path, "w", encoding="utf-8") as handle:
            json.dump(ledger, handle, indent=1)
    return ledger


def add_pins(root, pins_path):
    """Fold pins exported from the inspector into the ledger, skipping duplicates."""
    root = os.path.abspath(root)
    cases_path = os.path.join(root, "state", "cases.json")
    ledger = json.load(open(cases_path)) if os.path.exists(cases_path) else {"cases": []}
    known = {(c["tag"], tuple(c["at"]), c["class"]): c for c in ledger["cases"]}
    incoming = json.load(open(pins_path))
    pins = incoming["pins"] if isinstance(incoming, dict) else incoming
    added = 0
    for pin in pins:
        key = (pin["tag"], tuple(pin["at"]), pin["class"])
        if key in known:
            current = known[key]
            incoming_expect = pin.get("expect", "painted")
            if current.get("class") == "wrong-colour" \
                    and current.get("expect") in {"painted", "unknown-colour"} \
                    and incoming_expect.startswith("painted:"):
                current["expect"] = incoming_expect
                current["printed_code"] = incoming_expect.split(":", 1)[1]
            continue
        ledger["cases"].append({
            "id": f"C{len(ledger['cases']) + 1}",
            "tag": pin["tag"],
            "class": pin["class"],
            "at": [round(float(pin["at"][0]), 1), round(float(pin["at"][1]), 1)],
            "expect": pin.get("expect", "painted"),
            "printed_code": pin.get("printed_code", ""),
            "note": pin.get("note", ""),
            "source": pin.get("source", "user"),
            "status": "open",
            "opened_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })
        known[key] = ledger["cases"][-1]
        added += 1
    json.dump(ledger, open(cases_path, "w"), indent=1)
    return added, len(ledger["cases"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--add-pins", help="pins JSON exported from the inspector")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--convention", default="volvo_classic")
    parser.add_argument("--decision-policy", help="versioned decision-policy JSON")
    parser.add_argument("--run-classifier", help="calibrated lightweight run-classifier JSON")
    args = parser.parse_args()

    if args.add_pins:
        added, total = add_pins(args.root, args.add_pins)
        print(f"added {added} cases, ledger now {total}")
    if args.evaluate:
        from ..engine.classifier import CalibratedRunClassifier
        from ..engine.policy import DecisionPolicy
        policy = DecisionPolicy.load(args.decision_policy)
        classifier = (CalibratedRunClassifier.load(args.run_classifier)
                      if args.run_classifier else None)
        ledger = evaluate(args.root, args.dpi, args.convention, policy, classifier)
        summary = ledger["summary"]
        print(f"{summary['total']} cases: {summary.get('pass', 0)} pass, "
              f"{summary.get('fail', 0)} fail, {summary.get('unresolved', 0)} unresolved")
        for case in ledger["cases"]:
            result = case.get("result", {})
            if result.get("verdict") != "pass":
                print(f"  {case['id']} {case['tag']} {case['class']}: expect {case['expect']}, "
                      f"found {result.get('found')!r} ({result.get('verdict')})")
        return 1 if summary.get("fail") else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
