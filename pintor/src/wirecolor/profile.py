"""Per-sheet drawing-style profile: what THIS drawing does, measured from the drawing itself.

The library spans decades, drawing houses and scan resolutions, so the quantities that a colorizer
needs are not universal constants: the dash rhythm of a heavy cable, how far a legend is printed
from its conductor and on which side, how thick the ink is, which colour codes the sheet even uses.
Round 16 measured pub 2503's power area by hand and found pitch 44.4 px / stroke 12 px -- exactly
the kind of number that must be observed, not assumed.

A profile is pure observation: measuring it never changes what gets painted.  It is the input to
the learning layer -- profiles aggregate into corpus priors that bootstrap an unseen sheet and flag
a statistical outlier for review instead of shipping it blind.
"""
from __future__ import annotations

import json
import os
from collections import Counter


def _median(values, default=0.0):
    ordered = sorted(values)
    if not ordered:
        return default
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[middle])
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def _axis_of(segment):
    (ya, xa), (yb, xb) = segment["ends"]
    return "v" if abs(yb - ya) >= abs(xb - xa) else "h"


def _stroke_geometry(segment):
    """Length along the arc's own axis and the centre coordinate on that axis."""
    (ya, xa), (yb, xb) = segment["ends"]
    if _axis_of(segment) == "v":
        return abs(yb - ya), (ya + yb) / 2.0
    return abs(xb - xa), (xa + xb) / 2.0


def dash_rhythm(segments, routes):
    """Median stroke length, centre-to-centre pitch and ink gap of the sheet's dashed cables.

    ``routes`` is any iterable of member-index groups (dgroups plus the unlabelled roots).  Only
    consecutive strokes on the same axis of the same physical route contribute, so a corner or a
    crossing never invents a pitch.
    """
    strokes, pitches = [], []
    for members in routes:
        by_axis = {}
        for si in members:
            if si >= len(segments):
                continue
            length, centre = _stroke_geometry(segments[si])
            by_axis.setdefault(_axis_of(segments[si]), []).append((centre, length))
        for run in by_axis.values():
            run.sort()
            strokes.extend(length for _centre, length in run)
            for (c0, _l0), (c1, _l1) in zip(run, run[1:]):
                spacing = c1 - c0
                # A route also contains strokes separated by a crossing or a component; only a
                # plausible single period (under four typical strokes) describes the rhythm.
                if 0 < spacing <= 200:
                    pitches.append(spacing)
    stroke = _median(strokes)
    pitch = _median(pitches)
    return {"stroke": round(stroke, 1), "pitch": round(pitch, 1),
            "gap": round(max(0.0, pitch - stroke), 1),
            "strokes_measured": len(strokes), "periods_measured": len(pitches)}


def code_census(labels):
    """Which colour codes and gauges the sheet actually prints.

    A code that appears nowhere else on the page is weak evidence for a lone OCR read; the census
    is what makes that judgement possible instead of trusting every recognised token equally.
    """
    codes = Counter()
    gauges = Counter()
    for label in labels:
        code = label.get("code")
        if code:
            codes[code] += 1
        raw = str(label.get("raw", ""))
        gauge = raw.split()[0] if raw and raw.split()[0][:1].isdigit() else None
        if gauge:
            gauges[gauge] += 1
    return {"codes": dict(codes.most_common()), "gauges": dict(gauges.most_common()),
            "distinct_codes": len(codes)}


def label_geometry(labels):
    widths = [label.get("w", 0) for label in labels]
    heights = [label.get("h", 0) for label in labels]
    vertical = sum(1 for label in labels if label.get("h", 0) > label.get("w", 0))
    return {"count": len(labels),
            "median_w": round(_median(widths), 1),
            "median_h": round(_median(heights), 1),
            "vertical_share": round(vertical / len(labels), 3) if labels else 0.0}


def _arc_length(segment):
    points = segment["order"]
    return sum(((points[i + 1][0] - points[i][0]) ** 2
                + (points[i + 1][1] - points[i][1]) ** 2) ** 0.5
               for i in range(len(points) - 1))


def paint_coverage(solution, top=10):
    """How much of the drawing's conductor ink actually carries a colour.

    Round 16 shipped a sheet whose fifteen marked routes scored 44/50 while only HALF the ink on
    the page was painted -- long harness runs left black in plain sight.  Per-route ground truth
    cannot see that, because it only knows about the routes somebody already marked.  Coverage is
    therefore reported for every sheet, together with the longest unpainted runs, so an obviously
    incomplete sheet can never again look finished.
    """
    segments = solution["segments"]
    claims = solution["solver"].get("claims", {})
    dash_members = {si for members in solution.get("dgroups", {}).values() for si in members}
    excluded = set(solution.get("edge_excluded", ())) | set(solution.get("pin_border_arcs", ())) \
        | set(solution.get("twist", ()))

    total = painted_length = 0.0
    unpainted = []
    for si, segment in enumerate(segments):
        length = _arc_length(segment)
        total += length
        if si in claims or si in dash_members:
            painted_length += length
        elif si not in excluded:
            unpainted.append((length, si, segment["ends"]))
    unpainted.sort(key=lambda row: -row[0])
    return {
        "painted_ink_fraction": round(painted_length / total, 3) if total else 0.0,
        "painted_arcs": len(claims) + len(dash_members),
        "arcs": len(segments),
        "longest_unpainted": [
            {"length": round(length), "arc": si,
             "from": [round(ends[0][1]), round(ends[0][0])],
             "to": [round(ends[-1][1]), round(ends[-1][0])]}
            for length, si, ends in unpainted[:top]],
    }


def measure_sheet_profile(solution, meta=None):
    """Observe one solved page.  ``solution`` is the dict returned by ``pipeline.run_page``."""
    segments = solution["segments"]
    sol = solution["solver"]
    routes = list(solution.get("dgroups", {}).values())
    arc_lengths = [len(segment["order"]) for segment in segments]
    profile = {
        "page": {"width": solution["W"], "height": solution["H"],
                 "rotation": (meta or {}).get("rotation", 0),
                 "native_dpi": (meta or {}).get("dpi")},
        "convention": getattr(solution.get("convention"), "name", None)
        or (solution.get("convention") or {}).get("name"),
        "topology": {"arcs": len(segments),
                     "median_arc_length": round(_median(arc_lengths), 1),
                     "housings": len(solution.get("housings", ())),
                     "terminal_dots": len(solution.get("terminal_dots", ())),
                     "inline_components": len(solution.get("inline_components", ())),
                     "dashed_routes": len(routes)},
        "dash_rhythm": dash_rhythm(segments, routes),
        "label_side_offset": sol.get("label_side_offset", {}),
        "labels": label_geometry(solution.get("labels", ())),
        "codes": code_census(solution.get("labels", ())),
        "coverage": {"solid_claims": len(sol.get("claims", {})),
                     "painted_nets": sol.get("painted", 0),
                     "unresolved_roots": len(sol.get("unresolved_roots", ())),
                     **paint_coverage(solution)},
    }
    return profile


def save_profile(profile, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "w") as fh:
        json.dump(profile, fh, indent=1)
    return path


def aggregate_profiles(paths):
    """Corpus priors: the library's central tendency plus the spread that defines an outlier.

    A new sheet starts from these priors and, once measured, is compared against them: a drawing
    whose rhythm or legend offset sits far outside the corpus is flagged for review rather than
    silently painted with assumptions that do not hold for it.
    """
    profiles = []
    for path in paths:
        try:
            with open(path, encoding="utf-8") as handle:
                profiles.append(json.load(handle))
        except (OSError, ValueError):
            continue
    if not profiles:
        return {"sheets": 0}

    def spread(getter):
        values = [value for value in (getter(p) for p in profiles) if value]
        if not values:
            return None
        median = _median(values)
        deviation = _median([abs(value - median) for value in values])
        return {"median": round(median, 1), "mad": round(deviation, 1),
                "min": round(min(values), 1), "max": round(max(values), 1),
                "n": len(values)}

    return {
        "sheets": len(profiles),
        "dash_pitch": spread(lambda p: p.get("dash_rhythm", {}).get("pitch")),
        "dash_stroke": spread(lambda p: p.get("dash_rhythm", {}).get("stroke")),
        "label_offset_vertical": spread(
            lambda p: abs(p.get("label_side_offset", {}).get("vertical") or 0)),
        "label_offset_horizontal": spread(
            lambda p: abs(p.get("label_side_offset", {}).get("horizontal") or 0)),
        "median_arc_length": spread(
            lambda p: p.get("topology", {}).get("median_arc_length")),
        "conventions": dict(Counter(p.get("convention") for p in profiles)),
    }


def outliers(profile, priors, tolerance=6.0):
    """Report every measured quantity that sits more than ``tolerance`` MADs from the corpus."""
    checks = {
        "dash_pitch": profile.get("dash_rhythm", {}).get("pitch"),
        "dash_stroke": profile.get("dash_rhythm", {}).get("stroke"),
        "label_offset_vertical": abs(
            profile.get("label_side_offset", {}).get("vertical") or 0),
        "label_offset_horizontal": abs(
            profile.get("label_side_offset", {}).get("horizontal") or 0),
        "median_arc_length": profile.get("topology", {}).get("median_arc_length"),
    }
    flagged = []
    for name, value in checks.items():
        prior = priors.get(name)
        if not prior or not value:
            continue
        # A zero MAD means the corpus agrees exactly so far; fall back to a proportional band
        # rather than declaring every small difference an outlier.
        scale = prior["mad"] or max(1.0, 0.15 * prior["median"])
        deviation = abs(value - prior["median"]) / scale
        if deviation > tolerance:
            flagged.append({"quantity": name, "value": value,
                            "corpus_median": prior["median"],
                            "deviations": round(deviation, 1)})
    return flagged
