"""Answer "why is this physical wire black here?" from a diagnostic dump.

    python -m wirecolor.tools.route_probe --diag /tmp/diag --at 5248,1608 --at 7924,4500

Requires a run made with ``WIRECOLOR_DIAG_DIR`` set.  For every queried page coordinate the probe
reports the nearest traced arcs, the physical root each belongs to in the solid and dashed scenes,
the colour that root ended up owning, the ownership evidence behind it, and every OCR observation
seen nearby together with the decision that accepted or rejected it.  This replaces guessing from
a rendered image: the answer is always one of "no arc", "no evidence", "evidence rejected because
X", "conflicting evidence -> unresolved" or "painted".
"""
from __future__ import annotations

import argparse
import json
import os


def _load(directory, name):
    path = os.path.join(directory, f"{name}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def _polyline_distance(points, x, y):
    """Distance from a page coordinate to the sampled arc path, segments included.

    The dump samples the skeleton, so measuring against the vertices alone would report a point
    lying exactly on a long wire as several pixels away from it.
    """
    best = float("inf")
    for index, (px, py) in enumerate(points):
        best = min(best, ((px - x) ** 2 + (py - y) ** 2) ** 0.5)
        if index + 1 >= len(points):
            continue
        qx, qy = points[index + 1]
        dx, dy = qx - px, qy - py
        span = dx * dx + dy * dy
        if not span:
            continue
        t = max(0.0, min(1.0, ((x - px) * dx + (y - py) * dy) / span))
        best = min(best, ((px + t * dx - x) ** 2 + (py + t * dy - y) ** 2) ** 0.5)
    return best


def probe(directory, x, y, radius=25.0, evidence_radius=260.0):
    arcs = _load(directory, "arcs")
    lines = [f"== ({x}, {y}) =="]

    near = []
    for arc in arcs:
        best = _polyline_distance(arc["points"], x, y)
        if best <= radius:
            near.append((best, arc))
    near.sort(key=lambda item: item[0])
    if not near:
        lines.append(f"  no traced arc within {radius:.0f} px "
                     "(the ink here was never accepted as a conductor)")
    for distance, arc in near[:4]:
        state = arc.get("code") or arc.get("dash_code") or "BLACK"
        lines.append(
            f"  arc {arc['si']} at {distance:.0f} px: solid-root={arc.get('root')} "
            f"dash-root={arc.get('dash_root')} paint={state}"
            + (f" excluded={arc['excluded']}" if arc.get("excluded") else ""))

    roots = {("solid", arc.get("root")) for _d, arc in near if arc.get("root") is not None}
    roots |= {("dash", arc.get("dash_root")) for _d, arc in near
              if arc.get("dash_root") is not None}
    for channel, root in sorted(roots, key=lambda item: (item[0], item[1])):
        scene = {row["root"]: row for row in _load(directory, f"scene_{channel}")}
        owner = [row for row in _load(directory, f"ownership_{channel}")
                 if row.get("event") == "root" and row.get("root") == root]
        info = scene.get(root)
        if info:
            lines.append(f"  {channel} root {root}: length={info['length']} "
                         f"segments={info['segments']} conductor={info['conductor']} "
                         f"boundaries={','.join(info['boundaries'])}")
        if not owner:
            lines.append(f"  {channel} root {root}: NO ownership evidence "
                         "(no strong label was ever mapped to this physical wire)")
        for row in owner:
            lines.append(f"  {channel} root {root}: codes={row['codes']} "
                         f"unresolved={row['unresolved']}")
            for item in row["evidence"]:
                lines.append(f"      {item['provenance']:>10} {item['raw']!r} -> "
                             f"{item['code']} at ({item['cx']:.0f},{item['cy']:.0f}) "
                             f"score={item['score']} candidates={item['candidate_roots']}")
        for row in _load(directory, f"ownership_{channel}"):
            if row.get("event") in {"moved", "quarantined"} and root in {
                    row.get("root"), row.get("from_root"), row.get("to_root")}:
                lines.append(f"  {channel} {row['event']}: {row['raw']!r} -> {row['code']} "
                             f"at ({row['cx']:.0f},{row['cy']:.0f}) "
                             f"{ {k: v for k, v in row.items() if k not in {'event', 'raw', 'code', 'cx', 'cy'}} }")

    for channel in ("solid", "dash"):
        seen = []
        for row in _load(directory, f"evidence_{channel}"):
            d = ((row["cx"] - x) ** 2 + (row["cy"] - y) ** 2) ** 0.5
            if d <= evidence_radius:
                seen.append((d, row))
        seen.sort(key=lambda item: item[0])
        for d, row in seen[:8]:
            extra = {k: v for k, v in row.items()
                     if k not in {"decision", "code", "raw", "cx", "cy", "score",
                                  "window", "window_reason", "target_root"}}
            lines.append(f"  {channel} OCR {d:.0f} px: {row['raw']!r} -> {row['code']} "
                         f"score={row['score']} => {row['decision']} {extra if extra else ''}")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diag", required=True)
    ap.add_argument("--at", action="append", required=True,
                    help="page coordinate x,y in the 200-DPI working raster")
    ap.add_argument("--radius", type=float, default=25.0)
    args = ap.parse_args()
    for spec in args.at:
        x, y = (float(part) for part in spec.split(","))
        print(probe(args.diag, x, y, args.radius))


if __name__ == "__main__":
    main()
