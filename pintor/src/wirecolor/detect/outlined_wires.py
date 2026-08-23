"""Recover hollow illustrated conductors without following their callout leaders.

Some installation manuals do not draw a conductor as one black centreline.  The raster illustration
draws two black edges with a white cable interior, while the PDF overlays a separate vector leader
from each printed colour code to that cable.  Flattening both layers and skeletonizing the ink makes
the leader look more wire-like than the cable and is therefore the wrong representation.

This detector is intentionally narrow and evidence-heavy:

* the colour text must be exact PDF text under a supported convention;
* it must have a one-to-one straight vector leader whose far endpoint lands inside a bitonal image;
* dilating the image ink must isolate a long, narrow background component at that endpoint; and
* at least two independent callouts must resolve before the page can use the exclusive outlined
  path.

The longest medial path through the isolated cable interior becomes paint geometry.  The leader,
text, component drawing, and the cable's original black outline never enter that geometry.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from heapq import heappop, heappush
from math import hypot

import cv2
import numpy as np
from skimage.morphology import skeletonize


MAX_LEGEND_TO_LEADER_PT = 18.0
MIN_LEADER_PT = 8.0
MAX_LEADER_PT = 100.0


@dataclass(frozen=True)
class OutlinedWire:
    """One outlined cable represented in 200-DPI page coordinates."""

    code: str
    legend_raw: str
    order: tuple[tuple[float, float], ...]  # (y, x), matching raster segment convention
    width: float
    target: tuple[float, float]
    image_bbox: tuple[float, float, float, float]

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class CalloutLeader:
    """A drafting annotation that points to a cable but carries no electrical current."""

    code: str
    legend_raw: str
    order: tuple[tuple[float, float], tuple[float, float]]  # (y, x), working coordinates
    width: float
    target: tuple[float, float]
    image_bbox: tuple[float, float, float, float]
    resolved_to_conductor: bool = False

    def to_dict(self):
        return asdict(self)


def _straight_leaders(page):
    leaders = []
    for drawing in page.get_drawings():
        items = drawing.get("items", ())
        if len(items) != 1 or items[0][0] != "l" or drawing.get("fill") is not None:
            continue
        _kind, first, second = items[0]
        length = hypot(second.x - first.x, second.y - first.y)
        if not (MIN_LEADER_PT <= length <= MAX_LEADER_PT):
            continue
        if float(drawing.get("width") or 0.0) > 2.0:
            continue
        leaders.append(((float(first.x), float(first.y)),
                        (float(second.x), float(second.y)),
                        float(drawing.get("width") or 1.0)))
    return leaders


def _inside(point, bbox, margin=0.75):
    x, y = point
    x0, y0, x1, y1 = bbox
    return x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin


def _pair_legends_to_leaders(page, legends, images, dpi, leaders=None):
    scale = dpi / 72.0
    leaders = _straight_leaders(page) if leaders is None else leaders
    edges = []
    for legend_index, legend in enumerate(legends):
        centre = (legend.x / scale, legend.y / scale)
        for leader_index, (first, second, _width) in enumerate(leaders):
            first_distance = hypot(first[0] - centre[0], first[1] - centre[1])
            second_distance = hypot(second[0] - centre[0], second[1] - centre[1])
            label_end, target = ((first, second) if first_distance <= second_distance
                                 else (second, first))
            label_distance = min(first_distance, second_distance)
            if label_distance > MAX_LEGEND_TO_LEADER_PT:
                continue
            image_indexes = [index for index, image in enumerate(images)
                             if _inside(target, image["bbox"])]
            if len(image_indexes) != 1:
                continue
            # The endpoint near the label must genuinely be the opposite end of the line.  This
            # prevents a line crossing the text from being interpreted in either direction.
            if hypot(target[0] - centre[0], target[1] - centre[1]) <= \
                    hypot(label_end[0] - centre[0], label_end[1] - centre[1]):
                continue
            edges.append((label_distance, legend_index, leader_index,
                          image_indexes[0], target))

    used_legends, used_leaders = set(), set()
    pairs = []
    for _score, legend_index, leader_index, image_index, target in sorted(edges):
        if legend_index in used_legends or leader_index in used_leaders:
            continue
        pairs.append((legend_index, image_index, target, leader_index))
        used_legends.add(legend_index)
        used_leaders.add(leader_index)
    return pairs


def _callouts_from_pairs(legends, images, leaders, pairs, dpi, resolved=()):
    scale = dpi / 72.0
    resolved = set(resolved)
    callouts = []
    for pair_index, (legend_index, image_index, target, leader_index) in enumerate(pairs):
        first, second, line_width = leaders[leader_index]
        legend = legends[legend_index]
        callouts.append(CalloutLeader(
            code=legend.code,
            legend_raw=legend.raw,
            order=((first[1] * scale, first[0] * scale),
                   (second[1] * scale, second[0] * scale)),
            # Enough clearance to preserve the original black leader under an overlay without
            # erasing a broad area where the leader touches its target cable.
            width=max(2.0, line_width * scale + 0.75),
            target=(target[0] * scale, target[1] * scale),
            image_bbox=images[image_index]["bbox"],
            resolved_to_conductor=pair_index in resolved,
        ))
    return callouts


def _ink_mask(document, image):
    import fitz

    pixmap = fitz.Pixmap(document, image["xref"])
    if pixmap.n != 1:
        return None
    pixels = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
        pixmap.height, pixmap.width)
    if int(pixels.min()) == int(pixels.max()):
        return None

    # Scans exported as PNG are often nominally bitonal but retain a narrow antialiasing fringe.
    # Treat those as two-tone only when almost every pixel is still close to black or white; this
    # deliberately rejects photographs and shaded component drawings before Otsu can force them
    # into an attractive but unsafe binary mask.
    near_extremes = np.count_nonzero((pixels <= 32) | (pixels >= 223)) / float(pixels.size)
    if near_extremes < 0.965:
        return None
    _threshold, classes = cv2.threshold(
        pixels, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    dark = classes == 0
    light = ~dark
    ink = dark if np.count_nonzero(dark) <= np.count_nonzero(light) else light
    fraction = float(np.count_nonzero(ink)) / float(ink.size)
    if not (0.005 <= fraction <= 0.25):
        return None
    return ink


def _farthest_path(skeleton, anchor):
    points = set(zip(*np.nonzero(skeleton)))
    if anchor not in points:
        return []

    def search(source):
        distance = {source: 0.0}
        previous = {}
        queue = [(0.0, source)]
        farthest = source
        while queue:
            value, point = heappop(queue)
            if value != distance.get(point):
                continue
            if value > distance[farthest]:
                farthest = point
            y, x = point
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if not (dx or dy):
                        continue
                    other = (y + dy, x + dx)
                    if other not in points:
                        continue
                    candidate = value + (2 ** 0.5 if dx and dy else 1.0)
                    if candidate >= distance.get(other, float("inf")):
                        continue
                    distance[other] = candidate
                    previous[other] = point
                    heappush(queue, (candidate, other))
        return farthest, previous, distance[farthest]

    first, _previous, _distance = search(anchor)
    second, previous, distance = search(first)
    path = [second]
    while path[-1] != first:
        parent = previous.get(path[-1])
        if parent is None:
            return []
        path.append(parent)
    return path if distance > 0 else []


def _component_label_near(labels, stats, point, image_shape, radius):
    x, y = point
    height, width = image_shape
    minimum_area = max(80, int(height * width * 0.00008))
    maximum_area = int(height * width * 0.04)
    minimum_span = min(height, width) * 0.04
    reach = max(12, radius * 3)
    best = None
    for yy in range(max(0, y - reach), min(height, y + reach + 1)):
        for xx in range(max(0, x - reach), min(width, x + reach + 1)):
            label = int(labels[yy, xx])
            if label == 0:
                continue
            left, top, box_width, box_height, area = (int(value) for value in stats[label])
            if not (minimum_area <= area <= maximum_area):
                continue
            if max(box_width, box_height) < minimum_span:
                continue
            if area / float(max(1, box_width * box_height)) > 0.62:
                continue
            score = (xx - x) ** 2 + (yy - y) ** 2
            if best is None or score < best[0]:
                best = (score, label)
    return None if best is None else best[1]


def _trace_image_targets(ink, image, targets, dpi):
    ink_distance = cv2.distanceTransform(ink.astype(np.uint8), cv2.DIST_L2, 5)
    positive = ink_distance[ink]
    radius = max(2, min(12, int(round(float(np.percentile(positive, 75)) * 1.5))))
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    barrier = cv2.dilate(ink.astype(np.uint8), kernel) > 0
    _count, labels, stats, _centroids = cv2.connectedComponentsWithStats(
        (~barrier).astype(np.uint8), 8)
    background_distance = cv2.distanceTransform((~ink).astype(np.uint8), cv2.DIST_L2, 5)

    x0, y0, x1, y1 = image["bbox"]
    height, width = ink.shape
    work_scale = dpi / 72.0
    sx_pt, sy_pt = (x1 - x0) / width, (y1 - y0) / height
    results = []
    for pair_index, target in targets:
        tx = int(round((target[0] - x0) / max(x1 - x0, 1e-6) * width))
        ty = int(round((target[1] - y0) / max(y1 - y0, 1e-6) * height))
        tx, ty = min(width - 1, max(0, tx)), min(height - 1, max(0, ty))
        component_label = _component_label_near(
            labels, stats, (tx, ty), ink.shape, radius)
        if component_label is None:
            continue
        component = labels == component_label
        medial = skeletonize(component)
        points = list(zip(*np.nonzero(medial)))
        if not points:
            continue
        anchor = min(points, key=lambda point: (point[0] - ty) ** 2 + (point[1] - tx) ** 2)
        if hypot(anchor[1] - tx, anchor[0] - ty) > max(12, 4 * radius):
            continue
        path = _farthest_path(medial, anchor)
        if len(path) < min(height, width) * 0.04:
            continue
        if min((point[0] - ty) ** 2 + (point[1] - tx) ** 2 for point in path) > \
                max(12, 4 * radius) ** 2:
            continue

        widths = [2.0 * background_distance[py, px] for py, px in path]
        page_width = float(np.median(widths)) * (sx_pt + sy_pt) / 2.0 * work_scale
        page_width = min(12.0, max(4.0, page_width))
        order = tuple(
            ((y0 + py * sy_pt) * work_scale, (x0 + px * sx_pt) * work_scale)
            for py, px in path
        )
        results.append((pair_index, order, page_width))
    return results


def detect_outlined_wires(pdf_path, page_index, convention, dpi=200):
    """Return a report with exact outlined-wire paths for one hybrid PDF page."""
    import fitz

    from ..labels.text_layer import read_legends

    document = fitz.open(pdf_path)
    page = document[page_index]
    legends = read_legends(page, dpi, convention)
    images = []
    for info in page.get_image_info(xrefs=True):
        transform = info.get("transform", ())
        if len(transform) != 6 or abs(transform[1]) > 1e-5 or abs(transform[2]) > 1e-5 \
                or transform[0] <= 0 or transform[3] <= 0:
            continue
        bbox = tuple(float(value) for value in info["bbox"])
        images.append({"xref": int(info["xref"]), "bbox": bbox})

    leaders = _straight_leaders(page)
    pairs = _pair_legends_to_leaders(page, legends, images, dpi, leaders=leaders)
    traced = []
    for image_index, image in enumerate(images):
        image_targets = [(pair_index, target)
                         for pair_index, (_legend_index, assigned_image, target, _leader_index)
                         in enumerate(pairs)
                         if assigned_image == image_index]
        if not image_targets:
            continue
        ink = _ink_mask(document, image)
        if ink is None:
            continue
        traced.extend(_trace_image_targets(ink, image, image_targets, dpi))
    document.close()

    by_pair = {pair_index: (order, width) for pair_index, order, width in traced}
    wires = []
    claimed_components = {}
    for pair_index, (legend_index, image_index, target, _leader_index) in enumerate(pairs):
        if pair_index not in by_pair:
            continue
        order, width = by_pair[pair_index]
        legend = legends[legend_index]
        # A second legend hitting the same medial path is only safe if it agrees.  Different codes
        # on effectively identical paths make the entire page non-exclusive and remain black.
        key = (image_index, round(sum(point[0] for point in order) / len(order) / 10),
               round(sum(point[1] for point in order) / len(order) / 10))
        prior = claimed_components.get(key)
        if prior is not None and prior != legend.code:
            continue
        claimed_components[key] = legend.code
        wires.append(OutlinedWire(
            code=legend.code,
            legend_raw=legend.raw,
            order=order,
            width=width,
            target=(target[0] * dpi / 72.0, target[1] * dpi / 72.0),
            image_bbox=images[image_index]["bbox"],
        ))

    exclusive = len(wires) >= 2 and len(wires) == len(pairs)
    callouts = _callouts_from_pairs(
        legends, images, leaders, pairs, dpi, resolved=by_pair)
    return {
        "wires": wires,
        "callout_leaders": callouts,
        "pair_count": len(pairs),
        "exclusive": exclusive,
    }


def detect_callout_leaders(pdf_path, page_index, conventions, dpi=200):
    """Classify exact vector leaders over raster art without requiring a paintable cable.

    This is a global non-wire guard.  Even when the outlined-cable route cannot safely resolve a
    conductor, a thin line that runs from an exact colour legend into one raster illustration is a
    drafting annotation and must stay out of every fallback painter.
    """
    import fitz

    from ..labels.text_layer import read_legends

    document = fitz.open(pdf_path)
    try:
        page = document[page_index]
        images = []
        for info in page.get_image_info(xrefs=True):
            transform = info.get("transform", ())
            if len(transform) != 6 or abs(transform[1]) > 1e-5 \
                    or abs(transform[2]) > 1e-5 or transform[0] <= 0 or transform[3] <= 0:
                continue
            images.append({
                "xref": int(info["xref"]),
                "bbox": tuple(float(value) for value in info["bbox"]),
            })
        leaders = _straight_leaders(page)
        unique = {}
        for convention in conventions:
            legends = read_legends(page, dpi, convention)
            pairs = _pair_legends_to_leaders(
                page, legends, images, dpi, leaders=leaders)
            for callout in _callouts_from_pairs(legends, images, leaders, pairs, dpi):
                key = tuple(round(value, 2) for point in callout.order for value in point)
                prior = unique.get(key)
                if prior is None or callout.legend_raw < prior.legend_raw:
                    unique[key] = callout
        return list(unique.values())
    finally:
        document.close()
