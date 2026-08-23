"""Read connector pin colour schedules without pretending their furniture is a wire.

Pictorial installation pages often print a colour code beside each pin of a drawn connector, but
do not draw the conductors themselves.  Giving those legends to the normal ownership solver makes
the nearest closed outline -- the connector housing, relay case, pin rim, or actuator box -- look
like a conductor.  That is a category error.

The PDF already gives us a safer representation: exact circle geometry for every pin, an enclosing
connector housing, and exact text coordinates for the colour schedule.  This module pairs a legend
with the pin on the same row or column.  The legend is then withheld from wire ownership and the
renderer puts a small colour disc *inside* the original pin.  Two-colour codes become two equal
semicircles.

The disc radius is geometric rather than tuned per page: at most 72% of the pin radius, further
bounded by the nearest neighbouring pin and the housing edge.  It therefore cannot touch the pin
rim, connector border, or another marker.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot


REFERENCE_DPI = 200.0
MIN_PIN_DIAMETER_PX = 3.0
MAX_PIN_DIAMETER_PX = 24.0
MAX_HOUSING_SIDE_PX = 300.0
MAX_LEGEND_REACH_PX = 90.0
MIN_MARKER_RADIUS_PX = 0.8
PIN_RADIUS_FRACTION = 0.72


@dataclass(frozen=True)
class PinMarker:
    """One connector pin marker in analysis-pixel coordinates."""

    x: float
    y: float
    radius: float
    outer_radius: float
    code: str
    legend_raw: str
    connector_bbox: tuple[float, float, float, float]


@dataclass(frozen=True)
class _Pin:
    index: int
    x: float
    y: float
    radius: float


@dataclass(frozen=True)
class _Connector:
    index: int
    bbox: tuple[float, float, float, float]
    pins: tuple[_Pin, ...]


def _rect_px(path, scale):
    rect = path["rect"]
    return (rect.x0 * scale, rect.y0 * scale, rect.x1 * scale, rect.y1 * scale)


def _is_circle_path(path, scale, unit):
    items = path.get("items", ())
    if len(items) != 4 or any(item[0] != "c" for item in items):
        return False
    x0, y0, x1, y1 = _rect_px(path, scale)
    width, height = x1 - x0, y1 - y0
    minimum = MIN_PIN_DIAMETER_PX * unit
    maximum = MAX_PIN_DIAMETER_PX * unit
    return (minimum <= width <= maximum and minimum <= height <= maximum
            and 0.78 <= width / max(height, 1e-6) <= 1.28)


def _contains(bbox, pin, margin=0.25):
    x0, y0, x1, y1 = bbox
    return (x0 + margin <= pin.x - pin.radius and pin.x + pin.radius <= x1 - margin
            and y0 + margin <= pin.y - pin.radius and pin.y + pin.radius <= y1 - margin)


def _cluster_count(values, tolerance):
    clusters = []
    for value in sorted(values):
        if not clusters or value - clusters[-1][-1] > tolerance:
            clusters.append([value])
        else:
            clusters[-1].append(value)
    return len(clusters)


def _connector_groups(page, dpi):
    scale = dpi / 72.0
    unit = dpi / REFERENCE_DPI
    drawings = page.get_drawings()
    pins = []
    for index, path in enumerate(drawings):
        if not _is_circle_path(path, scale, unit):
            continue
        x0, y0, x1, y1 = _rect_px(path, scale)
        pins.append(_Pin(
            index=index,
            x=(x0 + x1) / 2.0,
            y=(y0 + y1) / 2.0,
            radius=min(x1 - x0, y1 - y0) / 2.0,
        ))

    candidates = []
    minimum_side = 10.0 * unit
    maximum_side = MAX_HOUSING_SIDE_PX * unit
    for index, path in enumerate(drawings):
        if _is_circle_path(path, scale, unit):
            continue
        bbox = _rect_px(path, scale)
        width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if min(width, height) < minimum_side or max(width, height) > maximum_side:
            continue
        inside = tuple(pin for pin in pins if _contains(bbox, pin, margin=0.2 * unit))
        if len(inside) < 2:
            continue
        tolerance = max(2.0 * unit, max(pin.radius for pin in inside))
        # Connector pins form a row, a column, or a rectangular grid.  Random circles inside a
        # component do not become a connector unless at least one axis has repeated positions.
        x_clusters = _cluster_count((pin.x for pin in inside), tolerance)
        y_clusters = _cluster_count((pin.y for pin in inside), tolerance)
        if x_clusters == len(inside) and y_clusters == len(inside):
            continue
        candidates.append((width * height, index, bbox, inside))

    # A large drawing can contain a smaller connector.  Give every pin to the smallest qualifying
    # housing so one schedule never appears twice.
    claimed = set()
    connectors = []
    for _area, index, bbox, inside in sorted(candidates):
        fresh = tuple(pin for pin in inside if pin.index not in claimed)
        if len(fresh) < 2:
            continue
        connectors.append(_Connector(index=index, bbox=bbox, pins=fresh))
        claimed.update(pin.index for pin in fresh)
    return connectors


def _side(legend, bbox):
    x0, y0, x1, y1 = bbox
    choices = []
    if legend.x < x0:
        choices.append((x0 - legend.x, "left"))
    if legend.x > x1:
        choices.append((legend.x - x1, "right"))
    if legend.y < y0:
        choices.append((y0 - legend.y, "top"))
    if legend.y > y1:
        choices.append((legend.y - y1, "bottom"))
    return min(choices, default=(float("inf"), None))


def _edge_pins(connector, side, unit):
    pins = connector.pins
    if side in {"left", "right"}:
        edge = min(pin.x for pin in pins) if side == "left" else max(pin.x for pin in pins)
        tolerance = max(2.0 * unit, max(pin.radius for pin in pins))
        return [pin for pin in pins if abs(pin.x - edge) <= tolerance]
    edge = min(pin.y for pin in pins) if side == "top" else max(pin.y for pin in pins)
    tolerance = max(2.0 * unit, max(pin.radius for pin in pins))
    return [pin for pin in pins if abs(pin.y - edge) <= tolerance]


def _marker_radius(pin, connector, unit):
    nearest = min(
        (hypot(pin.x - other.x, pin.y - other.y) for other in connector.pins
         if other.index != pin.index),
        default=float("inf"),
    )
    x0, y0, x1, y1 = connector.bbox
    housing_clearance = min(pin.x - x0, x1 - pin.x, pin.y - y0, y1 - pin.y)
    radius = min(
        PIN_RADIUS_FRACTION * pin.radius,
        0.32 * nearest,
        0.55 * housing_clearance,
    )
    return radius if radius >= MIN_MARKER_RADIUS_PX * unit else None


def connector_pin_markers(page, dpi, legends):
    """Return ``(markers, legend_indexes)`` for exact pin schedules on a vector page.

    At least two legends must align with different pins in one housing.  That second independent
    match is the semantic gate separating a connector schedule from a colour word that merely
    happens to sit near a component circle.
    """
    unit = dpi / REFERENCE_DPI
    connectors = _connector_groups(page, dpi)
    edges = []
    for connector_index, connector in enumerate(connectors):
        for legend_index, legend in enumerate(legends):
            outside, side = _side(legend, connector.bbox)
            if side is None or outside > MAX_LEGEND_REACH_PX * unit:
                continue
            for pin in _edge_pins(connector, side, unit):
                alignment = abs(legend.y - pin.y) if side in {"left", "right"} \
                    else abs(legend.x - pin.x)
                if alignment > max(6.0 * unit, 1.8 * pin.radius):
                    continue
                radius = _marker_radius(pin, connector, unit)
                if radius is None:
                    continue
                score = outside + 4.0 * alignment
                edges.append((score, connector_index, legend_index, pin, radius))

    used_legends, used_pins = set(), set()
    assignments = []
    for score, connector_index, legend_index, pin, radius in sorted(edges):
        pin_key = (connector_index, pin.index)
        if legend_index in used_legends or pin_key in used_pins:
            continue
        assignments.append((score, connector_index, legend_index, pin, radius))
        used_legends.add(legend_index)
        used_pins.add(pin_key)

    counts = {}
    for _score, connector_index, _legend_index, _pin, _radius in assignments:
        counts[connector_index] = counts.get(connector_index, 0) + 1

    markers, accepted_legends = [], set()
    for _score, connector_index, legend_index, pin, radius in assignments:
        # One aligned code is still ambiguous with a component annotation.  Two distinct pin
        # matches prove that this housing carries a connector schedule.
        if counts.get(connector_index, 0) < 2:
            continue
        legend = legends[legend_index]
        markers.append(PinMarker(
            x=pin.x,
            y=pin.y,
            radius=radius,
            outer_radius=pin.radius,
            code=legend.code,
            legend_raw=legend.raw,
            connector_bbox=connectors[connector_index].bbox,
        ))
        accepted_legends.add(legend_index)
    markers.sort(key=lambda marker: (marker.y, marker.x, marker.code))
    return markers, accepted_legends
