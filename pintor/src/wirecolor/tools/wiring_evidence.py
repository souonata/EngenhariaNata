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
    (re.compile(r"\bmultilink\s+hub\b", re.I),
     "multilink connector installation page, not a physical conductor diagram"),
    (re.compile(r"\blocation\s+of\s+sensors?\b|\bdisassembly,?\s+complete\s+engine\b", re.I),
     "sensor-location/engine illustration, not a physical conductor diagram"),
    (re.compile(r"\bcomponent\s+description\b", re.I),
     "component-description page, not a physical conductor diagram"),
    (re.compile(r"\bbleeding\b.{0,180}\bfuel\s+shut-off\s+valve\b", re.I),
     "fuel-service decision flow, not a wiring diagram"),
)

MECHANICAL_PAGE_PATTERN = re.compile(
    r"\b(?:propeller\s+shaft|bearing\s+box)\b",
    re.IGNORECASE,
)

CONNECTOR_TABLE_HEADER_PATTERN = re.compile(
    r"\b(?:ECM\s+connector\s+identification|pin\s+colou?r\s+function)\b",
    re.IGNORECASE,
)
CONNECTOR_TABLE_ROW_PATTERN = re.compile(
    r"\b(?:signal|driver|feed|ground|coil|input|output)\b",
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


def _text_layer_is_corrupted(text: str) -> bool:
    """Whether exact PDF text is too corrupt to support colour ownership.

    Some manuals render readable English through a substituted font but expose control-heavy
    gibberish such as ``7URXEOHVKRRWLQJ\x03`` to text extraction.  Parsing a fragment like ``1R``
    from that layer created dozens of convincing-looking flowchart wires.  Such a page is not
    declared non-electrical: it is routed to OCR, where the visible glyphs can be read honestly.
    """
    controls = sum(
        ord(character) < 32 and character not in "\t\n\r"
        for character in text
    )
    return controls >= 6 and controls >= max(6, len(text) // 250)


def _explicit_non_wiring_reason(text: str) -> str | None:
    for pattern, reason in NON_WIRING_PAGE_PATTERNS:
        if pattern.search(text):
            return reason
    if MECHANICAL_PAGE_PATTERN.search(text):
        return "mechanical repair/shaft page, not a wiring diagram"
    if CONNECTOR_TABLE_HEADER_PATTERN.search(text):
        return "connector pin/function table, not a physical conductor diagram"
    # Continuation sheets often omit the table heading.  A dense run of signal/driver/feed rows,
    # under a Symptoms/ECM context and without a wiring heading, is the same connector schedule.
    row_terms = len(CONNECTOR_TABLE_ROW_PATTERN.findall(text))
    if row_terms >= 5 and len(text) < 1400 \
            and re.search(r"\b(?:symptoms|ECM)\b", text, re.I) \
            and not PRIMARY_WIRING_HEADING.search(text):
        return "connector pin/function table continuation, not a physical conductor diagram"
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
    # Exact PDF text preserves case.  Real engineering abbreviations are printed in capitals;
    # prose and units are not.  The old parser upper-cased everything and consequently read
    # ``r/p`` (return permission), ``25w04`` (a date/week code) and ``25 gr`` (grams) as R/P, W
    # and GR beside ordinary form/table lines.  A lower-case parenthesised wire identifier remains
    # valid: ``0.75 WH (w14)`` is a real modern conductor legend.
    without_wire_id = re.sub(r"\(\s*w[0-9il|]+\s*\)?\s*$", "", raw, flags=re.IGNORECASE)
    if any(character.isalpha() and character.islower() for character in without_wire_id):
        return False
    return any(character.isdigit() for character in raw) or "/" in legend.code \
        or (len(legend.code) >= 2 and raw == raw.upper())


def _pin_layout_dominates(context) -> bool:
    """True for connector maps where colour text overwhelmingly annotates pins, not wires."""
    pins = len(context.pin_markers)
    conductors = len(context.legends)
    return pins >= 8 and pins > 2 * max(1, conductors)


def verify_vector_page(page, convention_name: str, dpi: int = DISCOVERY_DPI) -> dict:
    """Require the production vector graph to approve a physical conductor.

    The fast inventory pass intentionally has high recall: a positioned colour legend beside a
    long stroke is enough to become a candidate.  This second pass answers the stricter product
    question: can the same page be decomposed into physical conductors, associated with printed
    colour evidence and approved by the common engineering-semantics gate?  Connector-pin markers
    do not qualify because the requested report is specifically a list of diagrams containing
    paintable wires.
    """
    from ..engine.semantics import PHYSICAL_CONDUCTOR, enforce_vector_semantics
    from ..engine.vector_page import decide_vector_context, extract_vector_context
    from ..eval.vector_truth import geometry_is_trustworthy
    from ..labels.conventions import load_convention

    raw_text = page.get_text("text") or ""
    text = re.sub(r"\s+", " ", raw_text.replace("\x00", " ")).strip()
    if _text_layer_is_corrupted(raw_text):
        return {
            "status": "review",
            "mode": "vector-text-corrupt",
            "reason": "corrupted PDF text layer cannot prove printed colour codes; OCR required",
            "convention": convention_name,
            "physical_conductors": 0,
            "codes": [],
        }
    explicit_exclusion = _explicit_non_wiring_reason(text)
    if explicit_exclusion:
        return {
            "status": "rejected",
            "mode": "vector-topology",
            "reason": explicit_exclusion,
            "convention": convention_name,
            "physical_conductors": 0,
            "codes": [],
        }

    trustworthy, decline_reason = geometry_is_trustworthy(page, dpi)
    if not trustworthy:
        return {
            "status": "rejected",
            "mode": "vector-topology",
            "reason": decline_reason,
            "convention": convention_name,
            "physical_conductors": 0,
            "codes": [],
        }

    convention = load_convention(convention_name)
    context = extract_vector_context(
        page, dpi, convention, legend_filter=_looks_like_printed_code)
    if _pin_layout_dominates(context):
        return {
            "status": "rejected",
            "mode": "vector-connector-pin-layout",
            "reason": "colour labels predominantly identify connector pins, not physical wires",
            "convention": convention_name,
            "physical_conductors": 0,
            "codes": [],
            "runs": len(context.runs),
            "legends": len(context.legends),
            "pin_markers": len(context.pin_markers),
        }
    owned, decision = decide_vector_context(context)
    owned, _pin_markers, semantics = enforce_vector_semantics(
        context, owned, context.pin_markers, convention, decision=decision)
    physical = int(semantics["object_roles"].get(PHYSICAL_CONDUCTOR, 0))
    codes = sorted({
        str(claim["code"])
        for claim in semantics.get("paint_claims", ())
        if claim.get("role") == PHYSICAL_CONDUCTOR
    })
    verified = physical > 0 and bool(codes) and bool(semantics.get("release_safe"))
    return {
        "status": "verified" if verified else "rejected",
        "mode": "vector-topology",
        "reason": (
            "production semantics approved at least one physical vector conductor"
            if verified else
            "nearby colour-like text did not own any production-approved physical conductor"
        ),
        "convention": convention_name,
        "physical_conductors": physical,
        "codes": codes,
        "runs": len(context.runs),
        "legends": len(context.legends),
        "engineering_semantics": semantics,
    }


def verify_raster_image(image_path: str, ocr_evidence: dict,
                        convention_name: str = "auto") -> dict:
    """Reuse saved OCR and require the production raster graph to approve a conductor.

    No OCR is repeated here.  The broad inventory's page-level observations are written to the two
    cache files consumed by ``run_page``; the normal topology, ownership and engineering-semantics
    stages then run unchanged.  Automatic convention selection remains fail-closed, so a single
    ambiguous OCR token stays in review instead of turning an illustration into a wiring diagram.
    """
    import json
    from pathlib import Path
    import tempfile

    import cv2

    from ..engine.semantics import PHYSICAL_CONDUCTOR, enforce_raster_semantics
    from ..instrument import reset_for_tests
    from ..labels.conventions import load_convention
    from ..pipeline import run_page
    from .paint_raster import _score_conventions

    labels = list(ocr_evidence.get("legends") or ocr_evidence.get("labels") or ())
    if convention_name == "auto":
        selected, confidence, matching = _score_conventions(labels)
        if selected is None or confidence == "low":
            return {
                "status": "review",
                "mode": "raster-ocr-topology",
                "reason": "OCR did not establish one colour-code convention automatically",
                "convention": selected,
                "convention_confidence": confidence,
                "physical_conductors": 0,
                "codes": [],
            }
    else:
        convention = load_convention(convention_name)
        selected, confidence = convention_name, "explicit"
        matching = [
            label for label in labels
            if float(label.get("score", 0.0)) >= 0.80
            and all(part in convention.codes for part in str(label.get("code", "")).split("/"))
        ]
        if not matching:
            return {
                "status": "review",
                "mode": "raster-ocr-topology",
                "reason": "OCR found no strong label in the requested colour-code convention",
                "convention": selected,
                "convention_confidence": confidence,
                "physical_conductors": 0,
                "codes": [],
            }

    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"cannot read rendered page {image_path}")
    height, width = image.shape[:2]
    del image
    payload = {
        "image": [width, height],
        "labels": matching,
        "ocr_scales": list(ocr_evidence.get("ocr_scales", ())),
        "ocr_calls": 0,
    }
    convention = load_convention(selected)
    with tempfile.TemporaryDirectory(prefix="pintor-strict-raster-") as temp_name:
        root = Path(temp_name)
        labels_path = root / "labels.json"
        harvest_path = root / "harvest.json"
        encoded = json.dumps(payload, ensure_ascii=False)
        labels_path.write_text(encoded, encoding="utf-8")
        harvest_path.write_text(encoded, encoding="utf-8")
        # The supplied harvest contains every saved OCR observation, so contextual lenses are
        # lookup-only.  Disabling instrumentation also guarantees this verifier creates no OCR
        # memo or private geometric diagnostics outside its temporary directory.
        reset_for_tests()
        solution = run_page(
            str(image_path), str(labels_path), convention,
            harvest_path=str(harvest_path), allow_splice_propagation=False,
        )
        solution, semantics = enforce_raster_semantics(solution, convention)

    physical = int(semantics["object_roles"].get(PHYSICAL_CONDUCTOR, 0))
    codes = sorted({
        str(claim["code"])
        for claim in semantics.get("paint_claims", ())
        if claim.get("role") == PHYSICAL_CONDUCTOR
    })
    verified = physical > 0 and bool(codes) and bool(semantics.get("release_safe"))
    return {
        "status": "verified" if verified else "rejected",
        "mode": "raster-ocr-topology",
        "reason": (
            "saved OCR plus production topology approved at least one physical conductor"
            if verified else
            "OCR labels did not own any production-approved physical conductor"
        ),
        "convention": selected,
        "convention_confidence": confidence,
        "physical_conductors": physical,
        "codes": codes,
        "segments": len(solution.get("segments", ())),
        "engineering_semantics": semantics,
    }


def verify_outlined_page(pdf_path: str, page_index: int,
                         convention_name: str = "auto") -> dict:
    """Verify a pictorial page whose physical wires are closed raster outlines.

    These pages carry exact vector callout text and leaders but draw the actual cable bodies in a
    bitmap.  They are neither ordinary vector schematics nor generic OCR pages, so the strict
    verifier gives their existing exact hybrid detector an explicit route.
    """
    from ..engine.semantics import PHYSICAL_CONDUCTOR, enforce_raster_semantics
    from .paint_raster import _outlined_solution, _recognise_outlined_page

    recognised = _recognise_outlined_page(pdf_path, page_index, convention_name)
    if recognised is None:
        return {
            "status": "rejected",
            "mode": "hybrid-outlined-topology",
            "reason": "no exclusive exact-callout outlined-conductor scene was found",
            "convention": None,
            "physical_conductors": 0,
            "codes": [],
        }
    selected, detection = recognised
    from ..labels.conventions import load_convention
    convention = load_convention(selected)
    solution = _outlined_solution(convention, detection)
    solution, semantics = enforce_raster_semantics(solution, convention)
    physical = int(semantics["object_roles"].get(PHYSICAL_CONDUCTOR, 0))
    codes = sorted({
        str(claim["code"])
        for claim in semantics.get("paint_claims", ())
        if claim.get("role") == PHYSICAL_CONDUCTOR
    })
    verified = physical > 0 and bool(codes) and bool(semantics.get("release_safe"))
    return {
        "status": "verified" if verified else "rejected",
        "mode": "hybrid-outlined-topology",
        "reason": (
            "exact callouts cover production-approved outlined physical conductors"
            if verified else
            "outlined-wire evidence did not produce a production-approved physical conductor"
        ),
        "convention": selected,
        "physical_conductors": physical,
        "codes": codes,
        "engineering_semantics": semantics,
    }


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

    raw_text = page.get_text("text") or ""
    text = re.sub(r"\s+", " ", raw_text.replace("\x00", " ")).strip()
    if _text_layer_is_corrupted(raw_text):
        return {
            "status": "review",
            "confidence": "low",
            "convention": None,
            "legends": [],
            "assigned_codes": [],
            "assigned_runs": 0,
            "runs": 0,
            "requires_ocr": True,
            "reason": "corrupted PDF text layer requires OCR before colour evidence is trusted",
        }
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
    word_aliases = {}
    table_aliases = {}
    for convention in loaded:
        colours.update(convention.colors_bgr)
        distinctive.update(convention.distinctive)
        shared.update(convention.shared)
        grammars.update(convention.grammars)
        excluded.update(convention.excluded_from_evidence)
        word_aliases.update(convention.word_aliases)
        table_aliases.update(convention.table_aliases)
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
        word_aliases=word_aliases,
        table_aliases=table_aliases,
    )


def _point_segment_distance(px: float, py: float, segment: tuple[int, int, int, int]) -> float:
    x1, y1, x2, y2 = segment
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    position = 0.0 if not length_sq else max(
        0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    return hypot(px - (x1 + position * dx), py - (y1 + position * dy))


def _tag_parallel_bare_bundle(labels: list[dict],
                              segments: list[tuple[int, int, int, int]]) -> int:
    """Promote bare codes only when parallel ink crosses every label in a compact bundle.

    Diagnostic break-out harnesses may print ``GN``, ``GR`` and ``SB`` directly on several short,
    parallel conductors with no gauge. A lone bare token remains weak; three distinct,
    high-confidence codes aligned as one bundle and independently bounded by ink on both sides are
    physical-conductor evidence. Tables and connector schedules fail the two-sided ink test.
    """
    candidates = [
        label for label in labels
        if float(label.get("score", 0.0)) >= 0.95
        and re.fullmatch(r"[A-Za-z]{2,3}", str(label.get("raw", "")).strip())
        and len(str(label.get("code", ""))) >= 2
    ]
    if len({str(label.get("code")) for label in candidates}) < 3:
        return 0

    def supported(label: dict, axis: str) -> bool:
        cx, cy = float(label["cx"]), float(label["cy"])
        # Codes are commonly printed in the channel between two closely-spaced conductors rather
        # than centred on the stroke. The whole bundle is still compact and aligned, so allow one
        # wire pitch of cross-axis offset while retaining the mandatory ink on both axial sides.
        thickness = max(70.0, 2.2 * min(float(label.get("w", 0)),
                                        float(label.get("h", 0))))
        before = after = False
        for x1, y1, x2, y2 in segments:
            dx, dy = abs(x2 - x1), abs(y2 - y1)
            if axis == "h":
                if dx < 3 * max(dy, 1) or abs((y1 + y2) / 2 - cy) > thickness:
                    continue
                before |= min(x1, x2) < cx - 0.45 * float(label.get("w", 0))
                after |= max(x1, x2) > cx + 0.45 * float(label.get("w", 0))
            else:
                if dy < 3 * max(dx, 1) or abs((x1 + x2) / 2 - cx) > thickness:
                    continue
                before |= min(y1, y2) < cy - 0.45 * float(label.get("h", 0))
                after |= max(y1, y2) > cy + 0.45 * float(label.get("h", 0))
        return before and after

    for axis, aligned, spread in (
        ("h", "cx", "w"), ("v", "cy", "h"),
    ):
        qualified = [label for label in candidates if supported(label, axis)]
        if len({str(label.get("code")) for label in qualified}) < 3:
            continue
        positions = [float(label[aligned]) for label in qualified]
        allowance = max(70.0, 2.2 * max(float(label.get(spread, 0)) for label in qualified))
        if max(positions) - min(positions) > allowance:
            continue
        for label in qualified:
            label["evidence_source"] = "parallel-bare-bundle"
        return len(qualified)
    return 0


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
        if label.get("evidence_source") == "page-code-table"
        or _strong_raw(str(label.get("raw", "")), str(label.get("code", "")))
    ]
    if not labels:
        return {
            "status": "no_evidence", "confidence": "none", "legends": [],
            "near_wire": 0, "line_segments": 0,
            "reason": "OCR found no strong colour legend",
            "page_code_table": bool(result.get("page_code_table")),
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
            "page_code_table": bool(result.get("page_code_table")),
        }

    parallel_bare_bundle = _tag_parallel_bare_bundle(associated, segments)
    if parallel_bare_bundle:
        for promoted in associated:
            if promoted.get("evidence_source") != "parallel-bare-bundle":
                continue
            for label in labels:
                if (label.get("code") == promoted.get("code")
                        and abs(float(label["cx"]) - float(promoted["cx"])) < 1.0
                        and abs(float(label["cy"]) - float(promoted["cy"])) < 1.0):
                    label["evidence_source"] = "parallel-bare-bundle"
                    break

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
        "page_code_table": bool(result.get("page_code_table")),
        "parallel_bare_bundle": parallel_bare_bundle,
    }
