"""Turn a human-marked review PDF into machine-checkable ground truth.

    python -m wirecolor.tools.ground_truth import-markup <marked_review.pdf> \
        --pub 2503 --diag <sheet>/diag --out routes_pub2503.json
    python -m wirecolor.tools.ground_truth merge <existing.json> <new.json> --out merged.json

A pink mark says "this is wrong here"; it does not say what the colour should be.  The missing
half is already on the page: the diagnostic dump knows every legend the sheet printed and where.
So each mark is converted into a CANDIDATE route -- the marked path sampled into checkpoints, plus
the colour code of the nearest strong legend that lies along it -- and written out for a human to
confirm.  Candidates are never silently promoted: a wrong expectation would poison every future
regression run, which is the one thing this ledger must never do.

Once confirmed, a route file is permanent: it is replayed against every rule change forever, so a
defect the user marked once can never come back unnoticed.
"""
from __future__ import annotations

import argparse
import json
import os

PT_PER_PX = 0.36          # 200-DPI working raster -> PDF points


def ink_paths(pdf_path, page_index=0):
    """Return each ink annotation as a list of (x, y) points in working-raster pixels."""
    import fitz

    document = fitz.open(pdf_path)
    page = document[page_index]
    paths = []
    for annot in page.annots() or ():
        if annot.type[1] not in {"Ink", "Polygon", "PolyLine", "Line", "Square"}:
            continue
        vertices = annot.vertices or []
        points = []
        for vertex in vertices:
            # Ink annotations nest their strokes; both shapes appear in the wild.
            if isinstance(vertex, (list, tuple)) and vertex and isinstance(
                    vertex[0], (list, tuple)):
                points.extend((float(p[0]) / PT_PER_PX, float(p[1]) / PT_PER_PX)
                              for p in vertex)
            else:
                points.append((float(vertex[0]) / PT_PER_PX, float(vertex[1]) / PT_PER_PX))
        if not points:
            rect = annot.rect
            points = [((rect.x0 + rect.x1) / 2 / PT_PER_PX,
                       (rect.y0 + rect.y1) / 2 / PT_PER_PX)]
        paths.append(points)
    document.close()
    return paths


def sample_path(points, spacing=260.0, limit=6):
    """Reduce a freehand stroke to a few checkpoints spread along it."""
    if not points:
        return []
    kept = [points[0]]
    for point in points[1:]:
        last = kept[-1]
        if ((point[0] - last[0]) ** 2 + (point[1] - last[1]) ** 2) ** 0.5 >= spacing:
            kept.append(point)
    if len(kept) == 1 and len(points) > 1:
        kept.append(points[-1])
    if len(kept) > limit:
        step = (len(kept) - 1) / (limit - 1)
        kept = [kept[int(round(i * step))] for i in range(limit)]
    return [(round(x), round(y)) for x, y in kept]


def _strong(raw, code):
    return any(ch.isdigit() for ch in str(raw)) or "/" in str(code)


def legends(diag_dir):
    """Every strong legend the sheet printed, from both representations' evidence."""
    found = []
    for channel in ("solid", "dash"):
        path = os.path.join(diag_dir, f"evidence_{channel}.json")
        if not os.path.exists(path):
            continue
        for row in json.load(open(path)):
            if row.get("decision") == "accepted" and _strong(row.get("raw"), row.get("code")):
                found.append((row["cx"], row["cy"], row["code"], str(row["raw"])))
    for channel in ("solid", "dash"):
        path = os.path.join(diag_dir, f"ownership_{channel}.json")
        if not os.path.exists(path):
            continue
        for row in json.load(open(path)):
            for item in row.get("evidence", ()):
                if _strong(item.get("raw"), item.get("code")):
                    found.append((item["cx"], item["cy"], item["code"], str(item["raw"])))
    return found


def nearest_legend(points, catalogue, reach=220.0):
    """The legend closest to the marked path, measured from every checkpoint."""
    best = None
    for cx, cy, code, raw in catalogue:
        distance = min(((cx - x) ** 2 + (cy - y) ** 2) ** 0.5 for x, y in points)
        if distance <= reach and (best is None or distance < best[0]):
            best = (distance, code, raw)
    return best


def import_markup(pdf_path, pub, diag_dir, page=0):
    catalogue = legends(diag_dir) if diag_dir else []
    routes = []
    for index, path in enumerate(ink_paths(pdf_path, page), start=1):
        points = sample_path(path)
        if len(points) < 1:
            continue
        match = nearest_legend(points, catalogue)
        routes.append({
            "name": f"{index:02d} marked path"
                    + (f" {match[2]}" if match else " (no legend found)"),
            "code": match[1] if match else None,
            "points": [list(point) for point in points],
            "status": "candidate",
            "evidence": ({"legend": match[2], "distance_px": round(match[0], 1)}
                         if match else {"legend": None}),
        })
    return {
        "pub": pub, "page": page,
        "units": "200-DPI working-render pixels (PDF points = px * 0.36)",
        "source": os.path.basename(pdf_path),
        "note": "CANDIDATES from a human markup. Confirm each code, then set status to confirmed.",
        "routes": routes,
    }


def merge(existing, incoming):
    """Union two route files, keeping confirmed entries and never dropping history."""
    by_name = {route["name"]: route for route in existing.get("routes", ())}
    for route in incoming.get("routes", ()):
        current = by_name.get(route["name"])
        if current and current.get("status", "confirmed") == "confirmed":
            continue
        by_name[route["name"]] = route
    merged = dict(existing)
    merged["routes"] = [by_name[name] for name in sorted(by_name)]
    return merged


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="command", required=True)

    imp = sub.add_parser("import-markup")
    imp.add_argument("pdf")
    imp.add_argument("--pub", type=int, required=True)
    imp.add_argument("--page", type=int, default=0)
    imp.add_argument("--diag", help="diagnostic dump used to name the expected colour")
    imp.add_argument("--out", required=True)

    mrg = sub.add_parser("merge")
    mrg.add_argument("existing")
    mrg.add_argument("incoming")
    mrg.add_argument("--out", required=True)

    args = ap.parse_args()
    if args.command == "import-markup":
        spec = import_markup(args.pdf, args.pub, args.diag, args.page)
        named = sum(1 for route in spec["routes"] if route["code"])
        print(f"{len(spec['routes'])} marked paths, {named} matched to a printed legend")
        for route in spec["routes"]:
            print(f"  {route['name']}: {len(route['points'])} checkpoints "
                  f"{route['points'][0]} .. {route['points'][-1]}")
    else:
        spec = merge(json.load(open(args.existing)), json.load(open(args.incoming)))
        print(f"{len(spec['routes'])} routes after merge")
    with open(args.out, "w") as fh:
        json.dump(spec, fh, indent=1)
    print(f"-> {args.out}")


if __name__ == "__main__":
    main()
