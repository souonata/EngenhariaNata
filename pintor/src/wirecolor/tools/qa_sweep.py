"""Paint every sheet in an evaluation set, measure it, and record the round.

    python -m wirecolor.tools.qa_sweep --root workspaces/wirecolor_qa --note "symbol stripping v2"

One round = one full pass over the evaluation set with the code as it stands. The point is not the
absolute numbers; it is the DELTA against the previous round. Every change to the engine so far has
been judged on a single sheet, which is how a fix for one drawing has twice made another worse
without anyone noticing until the user opened it.

Writes ``state/rounds.json`` (append-only history) and ``state/latest.json``. A sheet that gets
worse is reported as a REGRESSION with the size of the drop, and the run exits non-zero, so this
can gate a change the same way a test suite does.

Sheets are painted in separate processes: a 1200 DPI A4 canvas is ~600 MB while it is live, so the
worker count is a memory decision, not a CPU one.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone

# A drop bigger than this in paint rate is a regression, not noise. Painting is deterministic, so
# the true noise floor is zero; the tolerance exists only so a sheet whose run count shifts by one
# does not cry wolf.
PAINT_RATE_TOLERANCE = 0.005

# Preview raster for the dashboard grid. Small on purpose -- the grid is for spotting which sheet
# to open, and the inspector renders its own sheet at review resolution.
PREVIEW_PX = 900


def _size_class(width_pt, height_pt):
    """ISO name for the sheet, from its longest side. Only used for grouping in the dashboard."""
    long_mm = max(width_pt, height_pt) * 25.4 / 72.0
    for name, limit in (("A5", 220), ("A4", 310), ("A3", 430), ("A2", 610), ("A1", 860)):
        if long_mm <= limit:
            return name
    return "A0"


def paint_one(job):
    """Paint and measure one sheet. Runs in its own process; must not raise."""
    sys.path.insert(0, job["scripts_dir"])
    from wirecolor.tools.paint_vector import paint_page
    from wirecolor.tools.qa_report import analyse

    started = time.time()
    if job.get("user_declined"):
        return {"tag": job["tag"], "pub": job["pub"], "page": job["page"], "title": job["title"],
                "crashed": False, "declined": True, "decline_reason": job["user_declined"],
                "user_declined": True, "runs": 0, "painted": 0, "paint_rate": 0.0, "legends": 0,
                "by_legend": 0, "by_continuation": 0, "rails_stripped": 0, "boxes_stripped": 0,
                "frames_stripped": 0, "runs_bridged": 0, "symbol_zones": 0,
                "symbol_strokes_removed": 0, "paint_dpi": 0, "band_mm": 0.0, "band_px": 0,
                "corroboration_rate": 0.0, "inherited_length_pct": 0.0, "codes": [],
                "size_class": "-", "page_pt": [0, 0], "v7_passed": True, "v7": {"passed": True},
                "signals": {"unpainted_with_nearby_legend": 0, "colour_change_junctions": 0,
                            "bare_codes_refused": 0},
                "worst_unpainted": [], "worst_colour_changes": [], "bare_codes_refused": [],
                "out_pdf": None, "preview": None, "seconds": round(time.time() - started, 1)}
    try:
        from wirecolor.engine.classifier import CalibratedRunClassifier
        from wirecolor.engine.policy import DecisionPolicy
        policy = DecisionPolicy.from_dict(job["decision_policy"])
        classifier = (CalibratedRunClassifier.load(job["run_classifier"])
                      if job.get("run_classifier") else None)
        report = paint_page(job["pdf"], job["page"], job["out_dir"], dpi=job["dpi"],
                            convention_name=job["convention"], band_scale=job["band_scale"],
                            decision_policy=policy, run_classifier=classifier)
        if report.get("declined"):
            return {"tag": job["tag"], "pub": job["pub"], "page": job["page"],
                    "title": job["title"], "crashed": False, "declined": True,
                    "decline_reason": report["decline_reason"], "runs": 0, "painted": 0,
                    "paint_rate": 0.0, "legends": 0, "by_legend": 0, "by_continuation": 0,
                    "rails_stripped": 0, "runs_bridged": 0, "symbol_zones": 0,
                    "symbol_strokes_removed": 0, "paint_dpi": 0, "band_mm": 0.0, "band_px": 0,
                    "corroboration_rate": 0.0, "inherited_length_pct": 0.0, "codes": [],
                    "size_class": "-", "page_pt": [0, 0], "v7_passed": True, "v7": {"passed": True},
                    "signals": {"unpainted_with_nearby_legend": 0, "colour_change_junctions": 0,
                                "bare_codes_refused": 0},
                    "worst_unpainted": [], "worst_colour_changes": [], "bare_codes_refused": [],
                    "out_pdf": None, "preview": None,
                    "seconds": round(time.time() - started, 1)}
        signals = analyse(job["pdf"], job["page"], job["dpi"], job["convention"])
    except Exception:
        return {"tag": job["tag"], "crashed": True, "error": traceback.format_exc()[-2000:],
                "seconds": round(time.time() - started, 1)}

    import fitz
    document = fitz.open(report["out_pdf"])
    page = document[job["page"]]
    page_pt = [round(page.rect.width, 1), round(page.rect.height, 1)]
    preview = os.path.join(job["preview_dir"], f"{job['tag']}.jpg")
    zoom = PREVIEW_PX / max(page.rect.width, page.rect.height)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    pixmap.pil_save(preview, format="JPEG", quality=72)
    document.close()

    return {
        "tag": job["tag"],
        "pub": job["pub"],
        "page": job["page"],
        "title": job["title"],
        "crashed": False,
        "page_pt": page_pt,
        "size_class": _size_class(*page_pt),
        "runs": report["runs"],
        "painted": report["runs_painted"],
        "paint_rate": report["paint_rate"],
        "coverage_metric": report.get("coverage_metric", "painted-run-count-v1"),
        "by_legend": report["runs_by_legend"],
        "by_continuation": report["runs_by_continuation"],
        "rails_stripped": report.get("rails_stripped", 0),
        "boxes_stripped": report.get("boxes_stripped", 0),
        "frames_stripped": report.get("frames_stripped", 0),
        "frame_splits": report.get("frame_splits", 0),
        "runs_bridged": report.get("runs_bridged", 0),
        "legends": report["legends"],
        "symbol_zones": report["symbol_zones"],
        "symbol_strokes_removed": report["symbol_strokes_removed"],
        "paint_dpi": report["paint_dpi"],
        "band_mm": report["band_mm"],
        "band_px": report["band_px"],
        "corroboration_rate": report["corroboration_rate"],
        "inherited_length_pct": signals["inherited_length_pct"],
        "codes": report["codes"],
        "v7_passed": bool(report["v7"].get("passed")),
        "v7": report["v7"],
        "signals": signals["signals"],
        "worst_unpainted": signals["worst_unpainted"],
        "worst_colour_changes": signals["worst_colour_changes"],
        "bare_codes_refused": signals["bare_codes_refused"],
        "out_pdf": report["out_pdf"],
        "preview": preview,
        "seconds": round(time.time() - started, 1),
    }


def _delta(now, before):
    """What changed on this sheet since the last round, and whether that is a regression."""
    if not before or before.get("crashed") or now.get("crashed"):
        return {}
    if now.get("coverage_metric", "painted-run-count-v1") \
            != before.get("coverage_metric", "painted-run-count-v1"):
        return {"coverage_metric_changed": True}
    out = {
        "paint_rate": round(now["paint_rate"] - before["paint_rate"], 3),
        "painted": now["painted"] - before["painted"],
        "runs": now["runs"] - before["runs"],
        "unpainted_with_legend": (now["signals"]["unpainted_with_nearby_legend"]
                                  - before["signals"]["unpainted_with_nearby_legend"]),
    }
    reasons = []
    # Declining a raster foldout drops its paint rate to zero on purpose -- it was painting page
    # furniture. That is a correction, not a regression.
    if now.get("declined"):
        out["regression"] = []
        return out
    # A paint-rate drop fully explained by stripping leaked frame colour is a CORRECTION, not a
    # regression: those runs were painting a non-conductor and are now black on purpose. Only the
    # unexplained part of a drop is suspicious.
    newly_black = max(0, before["painted"] - now["painted"])
    corrected = (now.get("rails_stripped", 0) + now.get("boxes_stripped", 0)
                 + now.get("frames_stripped", 0) + now.get("frame_splits", 0))
    if out["paint_rate"] < -PAINT_RATE_TOLERANCE and newly_black > corrected:
        reasons.append(f"paint rate {before['paint_rate']:.3f} -> {now['paint_rate']:.3f}")
    if before["v7_passed"] and not now["v7_passed"]:
        reasons.append("V7 preservation broke")
    # More labelled-but-black is only a regression when it is NOT explained by two benign causes:
    # (a) coverage rose alongside it -- parsing a new batch of legends raises both counts at once,
    # which is progress; (b) a strip pass blacked a non-wire that happens to sit near its own wire's
    # legend -- clearing N frame/box runs can add up to N to this count on purpose. Flag only the
    # rise that neither explains: a real conductor near a legend that went black for no good reason.
    unexplained = out["unpainted_with_legend"] - corrected
    if unexplained > 0 and out["painted"] <= 0:
        reasons.append(f"+{unexplained} labelled runs left black, no new paint")
    out["regression"] = reasons
    return out


def sweep(root, note="", workers=4, only=None, dpi=200, convention="volvo_classic",
          band_scale=None, decision_policy=None, run_classifier=None):
    from ..engine.policy import DecisionPolicy

    decision_policy = (decision_policy or DecisionPolicy()).validate()
    root = os.path.abspath(root)
    state_dir = os.path.join(root, "state")
    out_dir = os.path.join(root, "painted")
    preview_dir = os.path.join(root, "previews")
    for directory in (state_dir, out_dir, preview_dir):
        os.makedirs(directory, exist_ok=True)

    sheets = json.load(open(os.path.join(state_dir, "eval_set.json")))["sheets"]
    if only:
        wanted = set(only)
        sheets = [s for s in sheets if s["tag"] in wanted]
    scripts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    # Sheets the user has judged should not be painted at all -- a dense foldout the paint only
    # clutters. Their say-so overrides everything; it is respected per sheet by tag rather than by
    # a fragile automatic density metric that could wrongly decline a valid dense drawing.
    decline_path = os.path.join(state_dir, "decline.json")
    declined_by_user = json.load(open(decline_path)) if os.path.exists(decline_path) else {}

    jobs = [{
        "tag": s["tag"], "pub": s["pub"], "page": s["page"], "title": s["title"],
        "pdf": os.path.join(root, s["pdf"]), "out_dir": out_dir, "preview_dir": preview_dir,
        "dpi": dpi, "convention": convention, "band_scale": band_scale,
        "scripts_dir": scripts_dir,
        "user_declined": declined_by_user.get(s["tag"]),
        "decision_policy": decision_policy.to_dict(),
        "run_classifier": os.path.abspath(run_classifier) if run_classifier else None,
    } for s in sheets]

    started = time.time()
    results = []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for result in pool.map(paint_one, jobs):
            results.append(result)
            mark = "CRASH" if result["crashed"] else f"{result['paint_rate']:.0%}"
            print(f"  {result['tag']:>16} {mark:>6}  {result['seconds']:>5.1f}s", flush=True)

    rounds_path = os.path.join(state_dir, "rounds.json")
    history = json.load(open(rounds_path))["rounds"] if os.path.exists(rounds_path) else []
    previous = {s["tag"]: s for s in history[-1]["sheets"]} if history else {}

    regressions = []
    for result in results:
        result["delta"] = _delta(result, previous.get(result["tag"]))
        if result["delta"].get("regression"):
            regressions.append((result["tag"], result["delta"]["regression"]))

    ok = [r for r in results if not r["crashed"]]
    # The paintable set excludes raster foldouts the pipeline declined: scoring a page it correctly
    # refused -- as a 0 or, worse, as the 1.0 the furniture used to earn -- is not a measure of how
    # well it paints. The median is over what it actually attempts.
    paintable = [r for r in ok if not r.get("declined")]
    # The defect ledger is the correctness signal, distinct from coverage. Once the engine starts
    # REMOVING colour that leaked onto a frame, paint rate goes DOWN on a sheet that got better --
    # so paint rate alone can no longer say whether a round improved. The ledger can: every entry
    # is a confirmed defect with the outcome it should have, re-checked here against this round.
    from .qa_cases import evaluate as evaluate_cases
    try:
        classifier_for_ledger = None
        if run_classifier:
            from ..engine.classifier import CalibratedRunClassifier
            classifier_for_ledger = CalibratedRunClassifier.load(run_classifier)
        ledger = evaluate_cases(root, decision_policy=decision_policy,
                                run_classifier=classifier_for_ledger,
                                persist=not bool(only), only_tags=only)
        ledger_summary = ledger.get("summary", {})
    except Exception:
        ledger_summary = {}

    totals = {
        "sheets": len(results),
        "crashed": sum(1 for r in results if r["crashed"]),
        "declined": sum(1 for r in ok if r.get("declined")),
        "runs": sum(r["runs"] for r in ok),
        "painted": sum(r["painted"] for r in ok),
        "paint_rate": round(sum(r["painted"] for r in ok) / max(1, sum(r["runs"] for r in ok)), 3),
        # the median PAINTABLE sheet is the honest headline: one A0 with 367 runs otherwise
        # dominates a total pooled over twenty drawings, and a declined foldout is not a sheet the
        # pipeline had an opinion about
        "median_paint_rate": round(sorted(r["paint_rate"] for r in paintable)[len(paintable) // 2], 3)
                             if paintable else 0.0,
        "v7_failures": sum(1 for r in ok if not r["v7_passed"]),
        "labelled_but_black": sum(r["signals"]["unpainted_with_nearby_legend"] for r in ok),
        "defects_total": ledger_summary.get("total", 0),
        "defects_fixed": ledger_summary.get("pass", 0),
        "defects_open": ledger_summary.get("fail", 0),
        "seconds": round(time.time() - started, 1),
    }

    # A --only run is a spot-check on a few sheets, not a round. Recording it as one poisons the
    # round-over-round trend: the next full round would compare its 20-sheet totals against a
    # 3-sheet partial and report a +1400 "gain". So a partial run refreshes latest.json for the
    # inspector but never appends to the history the console charts.
    partial = bool(only)
    entry = {
        "round": history[-1]["round"] if (partial and history) else len(history) + 1,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": note,
        "partial": partial,
        "sheets_run": len(results),
        "totals": totals,
        "regressions": regressions,
        "sheets": results,
    }
    if not partial:
        history.append(entry)
        json.dump({"rounds": history}, open(rounds_path, "w"), indent=1)
        json.dump(entry, open(os.path.join(state_dir, "latest.json"), "w"), indent=1)
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="workspace holding pdfs/ and state/")
    parser.add_argument("--note", default="", help="what changed since the last round")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--only", nargs="*", help="run just these tags")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--convention", default="volvo_classic")
    parser.add_argument("--band-scale", type=float, default=None)
    parser.add_argument("--decision-policy", help="versioned decision-policy JSON")
    parser.add_argument("--run-classifier", help="calibrated lightweight run-classifier JSON")
    args = parser.parse_args()

    from ..engine.policy import DecisionPolicy
    policy = DecisionPolicy.load(args.decision_policy)
    entry = sweep(args.root, args.note, args.workers, args.only, args.dpi, args.convention,
                  args.band_scale, policy, args.run_classifier)
    totals = entry["totals"]
    print(f"\nround {entry['round']}: {totals['painted']}/{totals['runs']} runs painted, "
          f"median sheet {totals['median_paint_rate']:.0%}, "
          f"{totals['labelled_but_black']} labelled runs left black, "
          f"{totals['v7_failures']} V7 failures, {totals['crashed']} crashes "
          f"({totals['seconds']}s)")
    for tag, reasons in entry["regressions"]:
        print(f"  REGRESSION {tag}: {'; '.join(reasons)}")
    return 1 if entry["regressions"] or totals["crashed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
