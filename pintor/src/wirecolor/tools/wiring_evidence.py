"""Page-level evidence for exhaustive wiring-diagram discovery.

Discovery answers a narrower question than painting: does a page contain at least one physical
wire with a printed colour code?  A single small sensor circuit is therefore enough, while a bare
letter inside a component, a colour glossary and prose mentioning a colour are not.

Vector pages are confirmed when exact positioned text supplies a strong legend and a sufficiently
long vector stroke runs beside it. Raster pages remain reviewable evidence: OCR must find a strong
code and the image must contain line-like ink near it. Discovery never edits the source PDF.
"""
from __future__ import annotations

from math import hypot
import re


DISCOVERY_DPI = 200

PRIMARY_WIRING_HEADING = re.compile(
    r"\b(?:wiring|wire|circuit)\s+(?:diagram|schematic)s?\b|\belectrical\s+schematic\b",
    re.IGNORECASE,
)

NON_WIRING_PAGE_PATTERNS = (
    (re.compile(r"\bproduct\s+newsletter\b|\bnew\s+engine\s+specifications\b", re.I),
     "product bulletin/specification page, not a wiring diagram"),
    (re.compile(r"\b(?:nominal\s+dimensions?|shimming\s+chart|calculations?\s+worksheet)\b", re.I),
     "mechanical dimension or calculation page, not a wiring diagram"),
    (re.compile(r"\bwiring\s+schedule\b", re.I),
     "connector wiring schedule, not a conductor diagram"),
    (re.compile(r"\b(?:ECM\s+\d+\s+pin\s+connector|J[- ]?\d+\s+ECM\s+\d+\s+pin\s+connector)\b", re.I),
     "connector pin table, not a conductor diagram"),
    (re.compile(r"\bcolou?r\s+codes?\s*,\s*(?:EDC\s+)?cables\b", re.I),
     "cable colour-code reference/layout page, not a wiring diagram"),
    (re.compile(r"\b(?:hydraulic\s+schedule|fuel\s+flow\s+diagram|"
                r"fuel\s+shut-off\s+valve\s+supplied\s+with\s+voltage)\b|"
                r"\bflow\s+diagram.{0,80}\bfuel\b", re.I),
     "hydraulic/fuel flow schematic, not an electrical wiring diagram"),
    (re.compile(r"\b(?:drive\s+models\s+and\s+generations|sterndrive\s+extensions?|"
                r"sterndrive\s+shift\s+system)\b", re.I),
     "mechanical drive page, not a wiring diagram"),
    (re.compile(r"\bNMEA\s+2000\s+interface\b|\bpin-out\s+connector\b", re.I),
     "interface/connector layout page, not a conductor diagram"),
    (re.compile(r"\bbleeding\b.{0,180}\bfuel\s+shut-off\s+valve\b", re.I),
     "fuel-service decision flow, not a wiring diagram"),
)

DIAGNOSTIC_PROSE_PATTERN = re.compile(
    r"\b(?:fault\s+tracing|fault\s+code\s+explanation|circuit\s+description|"
    r"component\s+location)\b",
    re.IGNORECASE,
)

MECHANICAL_PAGE_PATTERN = re.compile(
    r"\b(?:propeller\s+shaft|bearing\s+box)\b",
    re.IGNORECASE,
)


def _normalise_hough_lines(lines):
    """Return OpenCV Hough segments across its Linux and Windows result shapes."""
    if lines is None:
        return []
    import numpy as np

    values = np.asarray(lines)
    if values.size == 0:
        return []
    return [tuple(int(value) for value in row) for row in values.reshape(-1, 4)]


def _page_text(page) -> str:
    return re.sub(r"\s+", " ", (page.get_text("text") or "").replace("\x00", " ")).strip()


def _explicit_non_wiring_reason(text: str) -> str | None:
    for pattern, reason in NON_WIRING_PAGE_PATTERNS:
        if pattern.search(text):
            return reason
    if MECHANICAL_PAGE_PATTERN.search(text):
        return "mechanical repair/shaft page, not a wiring diagram"
    if DIAGNOSTIC_PROSE_PATTERN.search(text) and not PRIMARY_WIRING_HEADING.search(text):
        return "diagnostic/component-description page, not a wiring diagram"
    return None


def _excluded_payload(reason: str, convention=None, legends=(), **extra) -> dict:
    payload = {
        "status": "excluded_non_wiring",
        "confidence": "high",
        "convention": convention,
        "legends": [_legend_payload(legend) for legend in legends],
        "assigned_codes": [],
        "assigned_runs": 0,
        "runs": 0,
        "reason": reason,
    }
    payload.update(extra)
    return payload


def _legend_payload(legend) -> dict:
    return {
        "raw": legend.raw,
        "code": legend.code,
        "x": round(float(legend.x), 1),
        "y": round(float(legend.y), 1),
        "axis": legend.axis,
        "wire_id": legend.wire_id,
    }


def _strong_raw(raw: str, code: str) -> bool:
    if len(code) == 1 and re.fullmatch(r"[A-Za-z]\d{1,4}", raw.strip()):
        return False
    return any(character.isdigit() for character in raw) or "/" in code or len(code) >= 2


def _looks_like_printed_code(legend) -> bool:
    """Reject words and compact component/port designators that collide with colour tokens."""
    raw = legend.raw.strip()
    if len(legend.code) == 1 and re.fullmatch(r"[A-Za-z]\d{1,4}", raw):
        return False                       # P1 / T1 / R1 are ambiguous component designators
    return any(character.isdigit() for character in raw) or "/" in legend.code \
        or (len(legend.code) >= 2 and raw == raw.upper())


def inspect_vector_colour(page, dpi: int = DISCOVERY_DPI, legends: list | None = None) -> dict:
    """Measure chromatic long strokes, ignoring coloured fills, logos and short warning marks."""
    from ..eval.vector_truth import _matrix, canvas_diagonal_px

    matrix = _matrix(page, dpi)
    diagonal = canvas_diagonal_px(page, dpi)
    minimum_length = diagonal * 0.006
    minimum_coloured_route = diagonal * 0.02
    total_length = 0.0
    chromatic_length = 0.0
    long_segments = 0
    chromatic_segments = 0
    chromatic_near_legends = 0
    for path in page.get_drawings():
        colour = path.get("color")
        chromatic = colour is not None and max(colour) - min(colour) >= 0.12
        for item in path.get("items", ()):
            points = []
            if item[0] == "l":
                points = [item[1], item[2]]
            elif item[0] == "c":
                points = [item[1], item[2], item[3], item[4]]
            elif item[0] == "qu":
                quad = item[1]
                points = [quad.ul, quad.ur, quad.lr, quad.ll, quad.ul]
            elif item[0] == "re":
                rectangle = item[1]
                points = [rectangle.tl, rectangle.tr, rectangle.br, rectangle.bl, rectangle.tl]
            for left, right in zip(points, points[1:]):
                transformed_left, transformed_right = left * matrix, right * matrix
                length = hypot(
                    transformed_right.x - transformed_left.x,
                    transformed_right.y - transformed_left.y,
                )
                if length < minimum_length:
                    continue
                long_segments += 1
                total_length += length
                if chromatic:
                    chromatic_segments += 1
                    chromatic_length += length
                    segment = (
                        transformed_left.x, transformed_left.y,
                        transformed_right.x, transformed_right.y,
                    )
                    if length >= minimum_coloured_route and legends and any(
                            _point_segment_distance(legend.x, legend.y, segment) <= 220.0
                            for legend in legends):
                        chromatic_near_legends += 1
    share = chromatic_length / total_length if total_length else 0.0
    # Page-wide colour is not enough: manuals often place a blue cutaway, logo or warning beside a
    # separate black-and-white circuit. Only a conductor-scale chromatic stroke beside an actual
    # wire-colour legend proves that the wiring itself has already been coloured.
    already_colored = chromatic_near_legends >= 1
    return {
        "already_colored": already_colored,
        "long_segments": long_segments,
        "chromatic_segments": chromatic_segments,
        "chromatic_near_legends": chromatic_near_legends,
        "long_stroke_length_px": round(total_length, 1),
        "chromatic_stroke_length_px": round(chromatic_length, 1),
        "minimum_coloured_route_px": round(minimum_coloured_route, 1),
        "chromatic_share": round(share, 4),
    }


def inspect_vector_page(page, dpi: int = DISCOVERY_DPI,
                        convention_names: list[str] | None = None) -> dict:
    """Use exact PDF text plus direct stroke proximity to judge one page.

    Discovery deliberately stops before topology noding and global ownership. Dense foldouts can
    contain tens of thousands of primitives, making the full painting graph seconds slower per
    page. Direct adjacency is sufficient to inventory the page; the painter still performs the
    complete conservative ownership pass before applying any colour.
    """
    from ..eval.vector_truth import canvas_diagonal_px, extract_segments
    from ..labels.conventions import list_conventions, load_convention
    from ..labels.text_layer import read_legends, strong_legends

    text = _page_text(page)
    explicit_exclusion = _explicit_non_wiring_reason(text)
    if explicit_exclusion:
        return _excluded_payload(explicit_exclusion)

    names = convention_names or list_conventions()
    choices = []
    for name in names:
        convention = load_convention(name)
        legends = [
            legend for legend in strong_legends(read_legends(page, dpi, convention))
            if _looks_like_printed_code(legend)
        ]
        if not legends:
            continue
        distinctive = sum(
            legend.code.split("/")[0] in convention.distinctive for legend in legends)
        gauged_or_striped = sum(
            any(character.isdigit() for character in legend.raw) or "/" in legend.code
            for legend in legends)
        choices.append((distinctive, gauged_or_striped, len(legends), name, convention, legends))

    if not choices:
        return {
            "status": "no_evidence",
            "confidence": "none",
            "convention": None,
            "legends": [],
            "assigned_runs": 0,
            "runs": 0,
            "reason": "no strong positioned colour legend in the PDF text layer",
        }

    _distinctive, _reliable, _count, name, _convention, legends = max(choices)
    try:
        segments = extract_segments(page, dpi)
        colour_evidence = inspect_vector_colour(page, dpi, legends)
    except Exception as error:
        return {
            "status": "review",
            "confidence": "low",
            "convention": name,
            "legends": [_legend_payload(legend) for legend in legends],
            "assigned_runs": 0,
            "runs": 0,
            "reason": f"colour legend found but vector strokes failed: {type(error).__name__}: {error}",
        }

    if colour_evidence["already_colored"]:
        return {
            "status": "already_colored",
            "confidence": "high",
            "convention": name,
            "legends": [_legend_payload(legend) for legend in legends],
            "assigned_codes": [],
            "assigned_runs": 0,
            "runs": 0,
            "segments": len(segments),
            "colour_evidence": colour_evidence,
            "reason": "ignored because the wiring page already contains chromatic conductor strokes",
        }

    # A sensor/relay lead may be encoded as several short Bezier chords. Six thousandths of the
    # page diagonal retains those fragments while still excluding glyph strokes and junction dots.
    minimum_length = canvas_diagonal_px(page, dpi) * 0.006
    long_segments = [
        segment for segment in segments
        if hypot(segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]) >= minimum_length
    ]
    associations = []
    for legend in legends:
        nearest = min(
            (_point_segment_distance(legend.x, legend.y, (*segment[0], *segment[1]))
             for segment in long_segments), default=float("inf"))
        # Inventory is intentionally wider than paint ownership (150 px): a small relay lead in
        # the measured library prints its code 175 px beyond the curved stroke endpoint. The page
        # is included for review; painting still has to satisfy its stricter ownership threshold.
        if nearest <= 220.0:
            associations.append({
                "code": legend.code,
                "raw": legend.raw,
                "nearest_segment_px": round(nearest, 1),
            })
    exact_legends = [_legend_payload(legend) for legend in legends]
    if associations:
        if all(legend.code == "OR" and legend.raw.strip() == "OR" for legend in legends):
            return _excluded_payload(
                "ambiguous standalone OR in prose/dimensions, not conductor evidence",
                name, legends, runs=len(long_segments), segments=len(segments),
                colour_evidence=colour_evidence,
            )
        if (len(text) >= 900 and len(associations) <= 3
                and not PRIMARY_WIRING_HEADING.search(text)):
            return _excluded_payload(
                "prose-dominant instructional/diagnostic page with only an incidental small circuit",
                name, legends, runs=len(long_segments), segments=len(segments),
                colour_evidence=colour_evidence,
            )
        reliable = any(
            any(character.isdigit() for character in legend.raw) or "/" in legend.code
            for legend in legends)
        return {
            "status": "confirmed",
            "confidence": "high" if reliable else "medium",
            "convention": name,
            "legends": exact_legends,
            "assigned_codes": sorted({item["code"] for item in associations}),
            "assigned_runs": len(associations),
            "runs": len(long_segments),
            "segments": len(segments),
            "associations": associations,
            "colour_evidence": colour_evidence,
            "reason": "exact colour legend is adjacent to a sufficiently long vector stroke",
        }
    return {
        "status": "no_evidence",
        "confidence": "none",
        "convention": name,
        "legends": exact_legends,
        "assigned_codes": [],
        "assigned_runs": 0,
        "runs": len(long_segments),
        "segments": len(segments),
        "colour_evidence": colour_evidence,
        "reason": ("strong colour-like text was not resolved onto a nearby conductor"
                   if long_segments else "strong colour-like text found without conductor geometry"),
    }


def combined_convention(names: list[str] | None = None):
    """Return one conservative OCR vocabulary covering every installed convention."""
    from ..labels.conventions import Convention, list_conventions, load_convention

    loaded = [load_convention(name) for name in (names or list_conventions())]
    if not loaded:
        raise ValueError("no colour-code convention is installed")
    colours = {}
    distinctive = set()
    shared = set()
    grammars = set()
    excluded = set()
    for convention in loaded:
        colours.update(convention.colors_bgr)
        distinctive.update(convention.distinctive)
        shared.update(convention.shared)
        grammars.update(convention.grammars)
        excluded.update(convention.excluded_from_evidence)
    return Convention(
        name="all-installed",
        codes=frozenset(colours),
        colors_bgr=colours,
        white_token="WH" if "WH" in colours else loaded[0].white_token,
        all_white_token="WH" if "WH" in colours else loaded[0].all_white_token,
        distinctive=frozenset(distinctive),
        excluded_from_evidence=frozenset(excluded),
        shared=frozenset(shared),
        grammars=tuple(sorted(grammars)),
        two_color_sep="/",
    )


def _point_segment_distance(px: float, py: float, segment: tuple[int, int, int, int]) -> float:
    x1, y1, x2, y2 = segment
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    position = 0.0 if not length_sq else max(
        0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    return hypot(px - (x1 + position * dx), py - (y1 + position * dy))


def inspect_ocr_image(image_path: str, convention_names: list[str] | None = None,
                      engine=None) -> dict:
    """Find reviewable raster evidence: OCR colour labels with nearby line-like ink."""
    import cv2
    import numpy as np

    from ..labels.ocr import ocr_labels

    convention = combined_convention(convention_names)
    if engine is None:
        result = ocr_labels(image_path, convention)
    else:
        result = ocr_labels(image_path, convention, engine=engine)
    explicit_exclusion = _explicit_non_wiring_reason(str(result.get("text", "")))
    if explicit_exclusion:
        return _excluded_payload(explicit_exclusion)
    labels = [
        label for label in result.get("labels", ())
        if _strong_raw(str(label.get("raw", "")), str(label.get("code", "")))
    ]
    if not labels:
        return {
            "status": "no_evidence", "confidence": "none", "legends": [],
            "near_wire": 0, "line_segments": 0,
            "reason": "OCR found no strong colour legend",
        }

    colour_image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if colour_image is None:
        raise ValueError(f"cannot read rendered page {image_path}")
    image = cv2.cvtColor(colour_image, cv2.COLOR_BGR2GRAY)
    channel_range = colour_image.max(axis=2).astype(np.int16) \
        - colour_image.min(axis=2).astype(np.int16)
    ink = ((image < 210) | (channel_range >= 45)).astype(np.uint8) * 255
    for label in labels:
        box = label.get("box") or ()
        if not box:
            continue
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        x0, x1 = max(0, int(min(xs)) - 4), min(ink.shape[1], int(max(xs)) + 5)
        y0, y1 = max(0, int(min(ys)) - 4), min(ink.shape[0], int(max(ys)) + 5)
        ink[y0:y1, x0:x1] = 0

    minimum = max(32, round(hypot(*ink.shape) * 0.004))
    lines = cv2.HoughLinesP(
        ink, 1, np.pi / 180, threshold=max(18, minimum // 2),
        minLineLength=minimum, maxLineGap=max(8, minimum // 3),
    )
    segments = _normalise_hough_lines(lines)
    associated = []
    chromatic_near_labels = 0
    for label in labels:
        reach = max(70.0, 3.5 * max(float(label.get("w", 0)), float(label.get("h", 0))))
        nearby_segments = [
            segment for segment in segments
            if _point_segment_distance(float(label["cx"]), float(label["cy"]), segment) <= reach
        ]
        nearest = min(
            (_point_segment_distance(float(label["cx"]), float(label["cy"]), segment)
             for segment in nearby_segments), default=float("inf"))
        payload = dict(label)
        payload["nearest_line_px"] = None if nearest == float("inf") else round(nearest, 1)
        if nearest <= reach:
            associated.append(payload)
            line_is_chromatic = False
            for x1, y1, x2, y2 in nearby_segments:
                samples = max(12, min(200, round(hypot(x2 - x1, y2 - y1))))
                xs = np.clip(np.linspace(x1, x2, samples).round().astype(int),
                             0, colour_image.shape[1] - 1)
                ys = np.clip(np.linspace(y1, y2, samples).round().astype(int),
                             0, colour_image.shape[0] - 1)
                pixels = colour_image[ys, xs].astype(np.int16)
                ranges = pixels.max(axis=1) - pixels.min(axis=1)
                if np.mean(ranges >= 45) >= 0.30:
                    line_is_chromatic = True
                    break
            if line_is_chromatic:
                chromatic_near_labels += 1

    if chromatic_near_labels:
        return {
            "status": "already_colored",
            "confidence": "high",
            "legends": [dict(label) for label in labels],
            "associated_legends": associated,
            "near_wire": len(associated),
            "chromatic_near_labels": chromatic_near_labels,
            "line_segments": len(segments),
            "reason": "ignored because OCR colour legends sit beside chromatic line work",
        }

    if len(associated) >= 2:
        status, confidence = "probable", "medium"
        reason = "OCR found multiple colour legends beside line-like ink"
    elif associated:
        status, confidence = "review", "low"
        reason = "OCR found one colour legend beside line-like ink"
    else:
        status, confidence = "review", "low"
        reason = "OCR found colour legend text, but nearby wire geometry was not resolved"
    return {
        "status": status,
        "confidence": confidence,
        "legends": [dict(label) for label in labels],
        "associated_legends": associated,
        "near_wire": len(associated),
        "chromatic_near_labels": 0,
        "line_segments": len(segments),
        "reason": reason,
    }
