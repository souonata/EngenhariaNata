"""Ground truth derived from a vector page's own geometry.

On roughly a quarter of this corpus the PDF still carries the draughtsman's actual strokes. Where
it does, conductor topology is not something to infer from pixels -- it is something to *read*. This
module reads it, and emits a route spec in the format ``eval.cerl`` scores.

What that buys: the raster pipeline can be run over the same page rasterized at the working DPI and
scored against an answer that is known exactly, with no human annotation. In particular it makes
``merge_events`` -- the hard release gate, and the failure this product must never ship --
measurable for the first time.

The one thing that makes this trustworthy is how junctions are distinguished from crossings:

    An endpoint that touches another stroke joins it.  A stroke that merely crosses another
    mid-span does not.

In a wiring diagram a T-junction is drawn as a stroke *ending* on another, while two unrelated
cables crossing is two strokes passing through each other with no endpoint at the intersection.
Raster tracing has to guess which is which -- that guess is the origin of most of this project's
lost routes. In vector space the distinction is explicit, so the ground truth is stronger than
anything the pipeline under test could produce.

Deliberately conservative: a conductor wrongly present in ground truth is far worse than one
missing, because it would score the engine against a fiction. Short strokes, filled shapes and
page furniture are dropped rather than guessed at.
"""
from __future__ import annotations

import json
from math import hypot

# Shortest run worth scoring, in MILLIMETRES of page -- not pixels. This corpus spans A4 to A0 at
# a working DPI that may change, so a pixel literal would mean something different on every sheet.
# Measured on a real A0 page: at 5 mm the population is dominated by symbol edges and glyph strokes
# (median run 70 px); at 25 mm what survives are conductors, with lengths falling smoothly rather
# than off a cliff.
MIN_CONDUCTOR_MM = None      # None => derive from the page, see min_conductor_px()

# Shortest run worth scoring, as a fraction of the page DIAGONAL. Conductors scale with the
# drawing: 25 mm was measured on an A0 foldout, but applying it to an A4 circuit fragment in a
# diagnostics manual discarded almost every conductor on the page (38 runs found, 2 painted).
# 1.7% of the diagonal gives ~25 mm on A0 and ~6 mm on A4, which is the same thing said in a way
# that survives a change of sheet size.
MIN_CONDUCTOR_DIAGONAL_FRACTION = 0.017

# Endpoints within this distance are the same point. Vector drawings are exact, so this only has to
# absorb rounding in the PDF's own coordinates, not drafting slop.
SNAP_PX = 1.5

# Grid cell for the spatial index. Only affects speed, never the result.
CELL_PX = 64.0

# Noding and net-building compare every endpoint against all strokes in its 3x3 cell neighbourhood,
# which is O(k^2) when k strokes pile into one spot. A conductor junction is a handful of wires; only
# a HATCHED DECORATION packs thousands. Measured: a foreign A0 sheet's "VOLVO PENTA" title-block logo
# put 5597 strokes in one neighbourhood and noding ran for an hour, while the densest real wiring
# region across the corpus is ~1800 and finishes in seconds. Above this bound the neighbourhood is a
# logo/legend fill, never conductors, so skipping its endpoint work changes no painted result.
MAX_NODE_NEIGHBOURHOOD = 3000


def _matrix(page, dpi):
    """get_drawings() coordinates -> working-render pixels.

    ``get_drawings()`` reports UNROTATED page space, while ``get_pixmap()`` renders the page as
    displayed, so the page's own rotation has to be applied before scaling. A plain scale matrix is
    not enough: on a 90-degree page it puts ground-truth points outside the rendered image
    entirely. Asserted against a real render in the tests, because a silent drift here would slide
    every polyline off its conductor and quietly turn every score into noise.
    """
    import fitz
    return page.rotation_matrix * fitz.Matrix(dpi / 72.0, dpi / 72.0)


def modal_pen_px(page, dpi):
    """The drawing's own conductor pen width, in working pixels.

    Painted bands must be a multiple of THIS, not of the page. Measured across the corpus the drawn
    pen varies more than 6x between sheet sizes -- 0.22 pt on an A4 chapter figure, 0.57 pt on A3,
    1.42 pt on an A0 foldout -- so a fixed millimetre band that reads correctly on A0 is nearly
    17x the drawn line on A4 and buries the artwork it is supposed to annotate.

    Zero-width strokes are excluded: PDF treats 0 as "thinnest the device can draw", which is a
    hairline instruction rather than a measurement.
    """
    from collections import Counter
    widths = Counter()
    for path in page.get_drawings():
        width = path.get("width")
        if width is None or path.get("color") is None:
            continue
        # round FIRST, then reject zero: a 0.001 pt stroke is a hairline instruction that rounds
        # to 0.0, and testing the raw value let those become the modal "width" -- which silently
        # collapsed the painted band to its floor on the very sheet with the heaviest pen.
        key = round(width, 2)
        if key > 0:
            widths[key] += len(path.get("items", ()))
    if not widths:
        return 1.0
    return widths.most_common(1)[0][0] * dpi / 72.0


# On some sheets (autotraced / pictorial harness drawings) a conductor is not STROKED at all -- it
# is a long, thin FILLED rectangle. The width of that ribbon in working pixels: measured on
# pub 4872 the conductor ribbons are 1.7-3.3 px, while a filled symbol bar or a glyph stroke is
# thicker. 6 px sits clear above the ribbons and below the symbol bars, and the min-conductor floor
# downstream discards anything too short to be a wire, so a fuse element or a tick mark cannot slip
# through as a conductor.
MAX_RIBBON_SHORT_PX = 6.0
MIN_RIBBON_LONG_PX = 18.0            # shorter filled slivers are end caps, glyph strokes, dots


def _filled_ribbon_centerline(path, matrix):
    """Midline of a thin, long filled rectangle -- a conductor drawn as fill, not stroke.

    Returns one segment (the ribbon's long axis through its centre) or None. Only axis-aligned
    ribbons are handled: conductors on these sheets are orthogonal, and a diagonal bbox midline
    would misplace the wire. The bbox is taken in WORKING pixels so the thresholds mean the same
    thing at any page rotation.
    """
    rect = path.get("rect")
    if rect is None:
        return None
    corners = [fitz_point(rect.x0, rect.y0) * matrix, fitz_point(rect.x1, rect.y0) * matrix,
               fitz_point(rect.x1, rect.y1) * matrix, fitz_point(rect.x0, rect.y1) * matrix]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    width, height = x1 - x0, y1 - y0
    short, long = min(width, height), max(width, height)
    if short > MAX_RIBBON_SHORT_PX or long < MIN_RIBBON_LONG_PX:
        return None
    if width >= height:                         # horizontal ribbon
        mid = (y0 + y1) / 2.0
        return ((x0, mid), (x1, mid))
    mid = (x0 + x1) / 2.0                        # vertical ribbon
    return ((mid, y0), (mid, y1))


def extract_segments(page, dpi):
    """Straight segments of the page's conductor ink, in working pixels.

    Stroked paths contribute their strokes. A filled path is normally page furniture -- a symbol
    body, a junction dot, a title block -- and is skipped, EXCEPT a long thin filled rectangle,
    which is a conductor drawn as fill and contributes its centreline. Curves are flattened to their
    control-point chords; conductors here are overwhelmingly orthogonal, and a curve that is part of
    one still contributes endpoints in the right places for topology.
    """
    matrix = _matrix(page, dpi)
    segments = []
    for path in page.get_drawings():
        if path.get("fill") is not None and path.get("color") is None:
            ribbon = _filled_ribbon_centerline(path, matrix)
            if ribbon and hypot(ribbon[1][0] - ribbon[0][0], ribbon[1][1] - ribbon[0][1]) > 0:
                segments.append(ribbon)
            continue
        for item in path.get("items", ()):
            op = item[0]
            points = []
            if op == "l":
                points = [item[1], item[2]]
            elif op == "c":
                points = [item[1], item[2], item[3], item[4]]
            elif op == "qu":
                quad = item[1]
                points = [quad.ul, quad.ur, quad.lr, quad.ll, quad.ul]
            elif op == "re":
                rect = item[1]
                points = [fitz_point(rect.x0, rect.y0), fitz_point(rect.x1, rect.y0),
                          fitz_point(rect.x1, rect.y1), fitz_point(rect.x0, rect.y1),
                          fitz_point(rect.x0, rect.y0)]
            for a, b in zip(points, points[1:]):
                ta, tb = a * matrix, b * matrix
                pa, pb = (ta.x, ta.y), (tb.x, tb.y)
                if hypot(pb[0] - pa[0], pb[1] - pa[1]) > 0:
                    segments.append((pa, pb))
    return segments


def fitz_point(x, y):
    import fitz
    return fitz.Point(x, y)


class _Union:
    def __init__(self, n):
        self.parent = list(range(n))

    def find(self, a):
        while self.parent[a] != a:
            self.parent[a] = self.parent[self.parent[a]]
            a = self.parent[a]
        return a

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _point_on_segment(point, a, b, tolerance):
    """Distance from ``point`` to segment ab is within tolerance."""
    px, py = point
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return hypot(px - ax, py - ay) <= tolerance
    t = ((px - ax) * dx + (py - ay) * dy) / length_sq
    t = max(0.0, min(1.0, t))
    return hypot(px - (ax + t * dx), py - (ay + t * dy)) <= tolerance


def _grid_index(segments):
    index = {}
    for i, (a, b) in enumerate(segments):
        x0, x1 = sorted((a[0], b[0]))
        y0, y1 = sorted((a[1], b[1]))
        for cx in range(int(x0 // CELL_PX), int(x1 // CELL_PX) + 1):
            for cy in range(int(y0 // CELL_PX), int(y1 // CELL_PX) + 1):
                index.setdefault((cx, cy), []).append(i)
    return index


def node_segments(segments, snap_px=SNAP_PX):
    """Split every stroke where another stroke's endpoint lands on its span.

    Drawings are not drawn as graphs. A bus is one long stroke and the cables tapping off it simply
    *end* on it -- the long stroke has no vertex there at all. Until those touch points become real
    vertices, a branch is invisible to any graph walk, so the tap and the bus look like two
    unrelated runs and the bus never splits into the separate cables either side of the junction.

    This is the standard noding step, and it is what makes the crossing/junction distinction
    survive into the graph: an endpoint touching a span creates a shared vertex (a junction), while
    two strokes crossing with no endpoint at the intersection still create none (a crossover).
    """
    index = _grid_index(segments)
    cuts = {}
    for i, (a, b) in enumerate(segments):
        for endpoint in (a, b):
            cx, cy = int(endpoint[0] // CELL_PX), int(endpoint[1] // CELL_PX)
            if sum(len(index.get((cx + ox, cy + oy), ())) for ox in (-1, 0, 1)
                   for oy in (-1, 0, 1)) > MAX_NODE_NEIGHBOURHOOD:
                continue                      # dense hatched decoration, not a conductor junction
            seen = set()
            for ox in (-1, 0, 1):
                for oy in (-1, 0, 1):
                    for j in index.get((cx + ox, cy + oy), ()):
                        if j == i or j in seen:
                            continue
                        seen.add(j)
                        pa, pb = segments[j]
                        if not _point_on_segment(endpoint, pa, pb, snap_px):
                            continue
                        dx, dy = pb[0] - pa[0], pb[1] - pa[1]
                        length_sq = dx * dx + dy * dy
                        if length_sq == 0:
                            continue
                        t = ((endpoint[0] - pa[0]) * dx + (endpoint[1] - pa[1]) * dy) / length_sq
                        # only interior touches split; a shared endpoint already is a vertex
                        if snap_px / length_sq ** 0.5 < t < 1 - snap_px / length_sq ** 0.5:
                            cuts.setdefault(j, []).append(t)

    out = []
    for i, (a, b) in enumerate(segments):
        if i not in cuts:
            out.append((a, b))
            continue
        parameters = sorted({0.0, 1.0, *cuts[i]})
        for t0, t1 in zip(parameters, parameters[1:]):
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            if hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0:
                out.append((p0, p1))
    return out


def build_nets(segments, snap_px=SNAP_PX):
    """Group segments into electrically distinct conductors.

    Two segments join when an ENDPOINT of one touches the other -- at its endpoint (a corner or a
    daisy chain) or along its span (a T-junction). Two segments that cross without either owning an
    endpoint at the intersection are left apart, which is exactly what an unconnected crossover
    means on a wiring sheet.
    """
    index = {}
    for i, (a, b) in enumerate(segments):
        x0, x1 = sorted((a[0], b[0]))
        y0, y1 = sorted((a[1], b[1]))
        for cx in range(int(x0 // CELL_PX), int(x1 // CELL_PX) + 1):
            for cy in range(int(y0 // CELL_PX), int(y1 // CELL_PX) + 1):
                index.setdefault((cx, cy), []).append(i)

    union = _Union(len(segments))
    for i, (a, b) in enumerate(segments):
        for endpoint in (a, b):
            cx, cy = int(endpoint[0] // CELL_PX), int(endpoint[1] // CELL_PX)
            if sum(len(index.get((cx + ox, cy + oy), ())) for ox in (-1, 0, 1)
                   for oy in (-1, 0, 1)) > MAX_NODE_NEIGHBOURHOOD:
                continue                      # dense hatched decoration, not a conductor junction
            seen = set()
            for ox in (-1, 0, 1):
                for oy in (-1, 0, 1):
                    for j in index.get((cx + ox, cy + oy), ()):
                        if j == i or j in seen:
                            continue
                        seen.add(j)
                        if _point_on_segment(endpoint, segments[j][0], segments[j][1], snap_px):
                            union.union(i, j)

    nets = {}
    for i in range(len(segments)):
        nets.setdefault(union.find(i), []).append(i)
    return list(nets.values())


def canvas_diagonal_px(page, dpi):
    """Page diagonal in working pixels -- the natural scale for "how long is a real conductor"."""
    scale = dpi / 72.0
    return hypot(page.rect.width * scale, page.rect.height * scale)


# Below this the page carries no schematic geometry the vector path can read: the drawing is a
# raster foldout, and what strokes exist are a header rule, table underlines and crop marks around
# it. Total stroked vector length as a multiple of the page diagonal is the measure. Measured over
# the corpus: raster sheets 0.55-1.91, every sheet with real conductors >= 10.62 -- a 5.5x gap with
# nothing in it, so 5.0 sits clear of both sides.
MIN_SCHEMATIC_INK_RATIO = 5.0

# ...and the schematic lives inside one big embedded bitmap. Largest embedded image as a fraction
# of the page area: 0.0% on every paintable sheet, 12-64% on every raster one. AND-ing the two is
# what makes refusal safe -- a real vector schematic that happens to carry a logo has a low image
# fraction OR a high ink ratio, so it is never declined.
MAX_RASTER_IMAGE_COVERAGE = 0.05

# A distinct raster tier: a full-page SCAN. Unlike a poster (ink 0.55-1.91), a scanned diagram
# carries a border, table rules and a few stray stubs drawn as vector on top of the bitmap, so its
# ink ratio lands INSIDE the schematic range (measured 10.72 on the one such sheet) even though every
# conductor is a pixel the vector path can never reach. The distinguishing tell is that ONE image
# covers essentially the whole page. Measured over the corpus: the only sheet with a near-full-page
# image is that scan (100% coverage); real vector schematics carry no such image and run ink 36-76,
# far above the ceiling -- so this tier declines the scan and nothing else.
FULL_PAGE_IMAGE_COVERAGE = 0.90
RASTER_SCAN_INK_RATIO = 15.0


def vector_ink_ratio(page, dpi):
    """Total stroked vector length as a multiple of the page diagonal."""
    total = sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in extract_segments(page, dpi))
    return total / canvas_diagonal_px(page, dpi)


def largest_image_coverage(page):
    """Area of the biggest embedded image as a fraction of the page, 0.0 if none place-able."""
    page_area = page.rect.width * page.rect.height or 1.0
    best = 0.0
    for image in page.get_images(full=True):
        try:
            for rect in page.get_image_rects(image[0]):
                best = max(best, (rect.width * rect.height) / page_area)
        except Exception:
            continue
    return best


def geometry_is_trustworthy(page, dpi):
    """(ok, reason): whether the vector path should paint this page at all.

    A raster foldout produces a handful of runs from its crop marks and page furniture, and the
    nearest legend is happy to colour them -- which is how an installation poster comes to ship a
    purple callout box painted as a wire. The honest move is to recognise the tier and DECLINE,
    not to return statistics about crop marks. Both conditions must hold, so a dense vector sheet
    is never refused.
    """
    ink = vector_ink_ratio(page, dpi)
    image = largest_image_coverage(page)
    if ink < MIN_SCHEMATIC_INK_RATIO and image >= MAX_RASTER_IMAGE_COVERAGE:
        return False, (f"raster foldout: vector ink {ink:.2f}x diagonal "
                       f"(< {MIN_SCHEMATIC_INK_RATIO}), largest image {image:.0%} of page")
    if image >= FULL_PAGE_IMAGE_COVERAGE and ink < RASTER_SCAN_INK_RATIO:
        return False, (f"raster scan: one image covers {image:.0%} of page, "
                       f"only stray vector ink {ink:.2f}x diagonal (< {RASTER_SCAN_INK_RATIO})")
    return True, None


def _key(point):
    return (round(point[0] / SNAP_PX), round(point[1] / SNAP_PX))


def _adjacency(segments, member_indices):
    nodes = {}

    def node(point):
        key = _key(point)
        nodes.setdefault(key, point)
        return key

    adjacency = {}
    for i in member_indices:
        a, b = segments[i]
        ka, kb = node(a), node(b)
        if ka == kb:
            continue
        adjacency.setdefault(ka, set()).add(kb)
        adjacency.setdefault(kb, set()).add(ka)
    return nodes, adjacency


def decompose_runs(segments, member_indices):
    """Split one electrical net into physical conductor RUNS.

    A net is not a conductor. Everything bonded to a ground rail is one net, and on a real sheet
    that swallowed 10,824 of 40,432 strokes on the first page measured -- while being, physically,
    dozens of separate cables with different colours. Painting needs the cables, not the net.

    A run is therefore a maximal chain of strokes between *branch* points: nodes where three or
    more strokes meet (a junction, a splice, a tap) or where the ink simply ends. Nodes of degree
    two are not boundaries -- a cable that merely turns a corner or is drawn as two collinear
    strokes is still one cable, which is exactly the continuation the raster tracer also has to
    keep together.
    """
    nodes, adjacency = _adjacency(segments, member_indices)
    if not adjacency:
        return []

    boundary = {k for k, neighbours in adjacency.items() if len(neighbours) != 2}
    runs = []
    walked = set()

    def walk(start, first):
        chain = [start, first]
        previous, current = start, first
        while current not in boundary:
            options = [n for n in adjacency[current] if n != previous]
            if not options:
                break
            previous, current = current, options[0]
            chain.append(current)
            if len(chain) > len(adjacency) + 2:      # defensive: never loop forever
                break
        return chain

    for start in boundary:
        for neighbour in adjacency[start]:
            if (start, neighbour) in walked:
                continue
            chain = walk(start, neighbour)
            walked.add((start, neighbour))
            walked.add((chain[-1], chain[-2]))
            runs.append([nodes[k] for k in chain])

    if not runs:
        # a pure cycle has no boundary node at all; break it at an arbitrary point
        start = next(iter(adjacency))
        runs.append([nodes[k] for k in walk(start, next(iter(adjacency[start])))])
    return runs


def longest_path(segments, member_indices):
    """A dense polyline traversing the net along its longest run.

    A conductor's net is a graph, not a line; scoring needs one walkable path through it. The
    longest one is chosen because it is the run a technician would follow, and because a route that
    covers more of the conductor exercises more of the tracer.
    """
    nodes = {}

    def node(point):
        key = (round(point[0] / SNAP_PX), round(point[1] / SNAP_PX))
        nodes.setdefault(key, point)
        return key

    adjacency = {}
    for i in member_indices:
        a, b = segments[i]
        ka, kb = node(a), node(b)
        if ka == kb:
            continue
        adjacency.setdefault(ka, []).append(kb)
        adjacency.setdefault(kb, []).append(ka)
    if not adjacency:
        return []

    def farthest(start):
        """Dijkstra from ``start``; returns the most distant node and the parent map.

        SHORTEST-path relaxation, deliberately. Relaxing on the longer path instead looks like it
        would find a longer route, but it does not terminate: a net containing a loop -- a ring
        main, a rectangular bus, any cable returning to a shared rail -- can always be walked once
        more around the cycle for extra length, so the queue never drains. Longest-path is
        NP-hard in general; two Dijkstra sweeps give the true diameter on a tree and a long,
        well-defined, walkable path on anything else.
        """
        import heapq

        distance = {start: 0.0}
        parent = {start: None}
        heap = [(0.0, start)]
        best, best_distance = start, 0.0
        while heap:
            here, current = heapq.heappop(heap)
            if here > distance.get(current, float("inf")):
                continue
            if here > best_distance:
                best, best_distance = current, here
            for neighbour in adjacency.get(current, ()):
                step = hypot(nodes[neighbour][0] - nodes[current][0],
                             nodes[neighbour][1] - nodes[current][1])
                if here + step < distance.get(neighbour, float("inf")):
                    distance[neighbour] = here + step
                    parent[neighbour] = current
                    heapq.heappush(heap, (here + step, neighbour))
        return best, parent

    end_a, _ = farthest(next(iter(adjacency)))
    end_b, parent = farthest(end_a)
    path = []
    cursor = end_b
    while cursor is not None:
        path.append(nodes[cursor])
        cursor = parent[cursor]
    return path[::-1]


def build_truth(page, dpi, min_conductor_mm=MIN_CONDUCTOR_MM, max_routes=None):
    """Route spec for one vector page, in the format ``eval.cerl.score_sheet`` consumes.

    ``code`` is null on every route: the geometry knows identity, not insulation colour. That makes
    these routes TOPOLOGY-ONLY ground truth, which is precisely the half that needs no human.
    """
    segments = node_segments(extract_segments(page, dpi))
    nets = build_nets(segments)
    if min_conductor_mm is None:
        diagonal_px = (canvas_diagonal_px(page, dpi))
        min_conductor_px = diagonal_px * MIN_CONDUCTOR_DIAGONAL_FRACTION
    else:
        min_conductor_px = min_conductor_mm * dpi / 25.4

    routes = []
    for net_index, net in enumerate(nets):
        for points in decompose_runs(segments, net):
            if len(points) < 2:
                continue
            length = sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))
            if length < min_conductor_px:
                continue
            routes.append({
                "points": [[round(x, 2), round(y, 2)] for x, y in points],
                "length_px": round(length, 1),
                "net": net_index,
                # node keys of the run's two ends, used below to decide separateness
                "_ends": (_key(points[0]), _key(points[-1])),
            })

    routes.sort(key=lambda r: -r["length_px"])
    if max_routes:
        routes = routes[:max_routes]
    for n, route in enumerate(routes, 1):
        route["id"] = f"v{n:04d}"
        route["code"] = None                 # topology-only: see the module docstring
        route["status"] = "confirmed"        # derived from the source, not from the engine's output

    # Negative ground truth, CONSERVATIVELY. Two runs that share no endpoint are certainly
    # different conductors and are safe to declare distinct. Two runs that meet at a branch point
    # are NOT declared: at a T the cable usually continues straight through and only the tap is a
    # separate conductor, and deciding which is which is the very judgement under test. A false
    # merge report would discredit the one gate this project cannot afford to have doubted, so
    # sensitivity is traded away for certainty.
    distinct = []
    for i, a in enumerate(routes):
        ends_a = set(a["_ends"])
        for b in routes[i + 1:]:
            if ends_a.isdisjoint(b["_ends"]):
                distinct.append([a["id"], b["id"]])
    for route in routes:
        del route["_ends"]

    return {
        "source": "vector_geometry",
        "dpi": dpi,
        "px_per_mm": dpi / 25.4,
        "tolerance_px": round(max(3.0, dpi / 50.0), 2),
        "routes": routes,
        "distinct": distinct,
        "stats": {"segments": len(segments), "nets": len(nets), "routes": len(routes)},
    }


def main():
    import argparse

    import fitz

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--page", type=int, default=0)
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--min-mm", type=float, default=MIN_CONDUCTOR_MM,
                        help="shortest run kept, in millimetres of page")
    parser.add_argument("--max-routes", type=int)
    parser.add_argument("--out")
    args = parser.parse_args()

    document = fitz.open(args.pdf)
    truth = build_truth(document[args.page], args.dpi,
                        min_conductor_mm=args.min_mm, max_routes=args.max_routes)
    document.close()
    truth["pdf"] = args.pdf
    truth["page"] = args.page

    if args.out:
        with open(args.out, "w") as handle:
            json.dump(truth, handle, indent=1)
        print(f"-> {args.out}")
    print(json.dumps(truth["stats"], indent=1))
    lengths = [r["length_px"] for r in truth["routes"]]
    if lengths:
        print(f"route length px: min {min(lengths)} median "
              f"{sorted(lengths)[len(lengths) // 2]} max {max(lengths)}")


if __name__ == "__main__":
    main()
