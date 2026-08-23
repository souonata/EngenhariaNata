"""Role-first electrical semantics shared by every production painter.

Geometry answers where ink is.  It does not answer what the ink means.  This module is the common
gate between page-specific extraction and rendering: every proposed colour must identify an
electrical/drafting role, a physical conductor representation, and an authoritative printed source
for the colour.  Anything that cannot do so is removed before the overlay is built.

The gate is deliberately deterministic.  A learned classifier may propose that a stroke resembles
a wire, but it cannot turn an annotation into a conductor, cross a component boundary, or invent a
colour.  Those remain engineering invariants.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


SCHEMA = "pintor-engineering-semantics-v1"

PHYSICAL_CONDUCTOR = "physical-conductor"
CONNECTOR_PIN = "connector-pin"
ANNOTATION_LEADER = "annotation-leader"
COMPONENT_BOUNDARY = "component-or-connector-boundary"
TERMINAL_OR_JUNCTION = "terminal-or-junction"
UNRESOLVED_GEOMETRY = "unresolved-geometry"

DECISION_ORDER = (
    "classify-page-grammar",
    "classify-object-roles",
    "build-physical-conductors-between-boundaries",
    "associate-authoritative-colour-evidence",
    "reject-conflicts-and-unknowns",
    "render-only-approved-roles",
)


@dataclass(frozen=True)
class SemanticClaim:
    """One requested coloured object and the engineering reason it may or may not be painted."""

    object_id: str
    role: str
    code: str
    colour_source: str
    geometry_source: str
    safe: bool
    reason: str | None = None

    def to_dict(self):
        return {
            "object_id": self.object_id,
            "role": self.role,
            "code": self.code,
            "colour_source": self.colour_source,
            "geometry_source": self.geometry_source,
            "safe": self.safe,
            "reason": self.reason,
        }


def _parts(code: str, convention) -> tuple[str, ...]:
    return tuple(part for part in str(code).split(convention.two_color_sep) if part)


def _supported(code: str, convention) -> bool:
    parts = _parts(code, convention)
    return bool(parts) and len(parts) <= 2 and all(
        part in convention.colors_bgr for part in parts)


def _analysis(grammar: str, roles: dict[str, int], claims: list[SemanticClaim],
              boundaries: dict[str, int], *, notes=()) -> dict[str, Any]:
    rejected = [claim for claim in claims if not claim.safe]
    approved = [claim for claim in claims if claim.safe]
    colour_sources = {}
    geometry_sources = {}
    for claim in approved:
        colour_sources[claim.colour_source] = colour_sources.get(claim.colour_source, 0) + 1
        geometry_sources[claim.geometry_source] = geometry_sources.get(claim.geometry_source, 0) + 1
    return {
        "schema": SCHEMA,
        "page_grammar": grammar,
        "decision_order": list(DECISION_ORDER),
        "object_roles": {key: int(value) for key, value in roles.items()},
        "physical_boundaries": {key: int(value) for key, value in boundaries.items()},
        "paint_claims": [claim.to_dict() for claim in approved],
        "abstained_claims": [claim.to_dict() for claim in rejected],
        "approved_claims": len(approved),
        "abstained_claim_count": len(rejected),
        "colour_sources": colour_sources,
        "geometry_sources": geometry_sources,
        "release_safe": all(
            claim.role in {PHYSICAL_CONDUCTOR, CONNECTOR_PIN}
            and claim.safe and bool(claim.colour_source)
            for claim in approved
        ),
        "invariants": {
            "colour_invented": False,
            "annotation_painted": False,
            "component_boundary_painted": False,
            "electrical_net_used_as_colour_identity": False,
            "unknown_role_painted": False,
        },
        "notes": list(notes),
    }


def declined_analysis(reason: str, grammar: str = "unresolved") -> dict[str, Any]:
    """Semantic record for a page declined before paintable objects could be established."""
    result = _analysis(
        grammar,
        {UNRESOLVED_GEOMETRY: 1},
        [],
        {},
        notes=(reason,),
    )
    result["release_safe"] = False
    return result


def enforce_vector_semantics(context, owned, pin_markers, convention, decision=None):
    """Remove semantically invalid vector claims and return approved pins plus an audit.

    Vector extraction has already removed recognised closed symbols before ownership.  This final
    common gate verifies that every remaining coloured run is a physical conductor with an exact
    printed source (directly or through an unbranched continuation), and that connector-pin colour
    is represented only by an explicit pin marker.
    """
    claims: list[SemanticClaim] = []
    approved_runs = 0
    abstained = 0
    for ordinal, run in enumerate(owned):
        if not run.code:
            continue
        code = str(run.code)
        source = ("unbranched-physical-continuation" if run.propagated
                  else "exact-vector-legend")
        reason = None
        if not _supported(code, convention):
            reason = "unsupported-or-invented-colour-code"
        elif not run.legend_raw:
            reason = "missing-authoritative-printed-colour-source"
        elif run.contested:
            reason = "conflicting-colour-evidence-on-one-physical-conductor"
        elif run.abstained:
            reason = run.abstain_reason or "upstream-semantic-abstention"
        elif len(run.points) < 2:
            reason = "missing-physical-conductor-geometry"
        safe = reason is None
        claims.append(SemanticClaim(
            object_id=f"vector-run:{run.index}:{ordinal}",
            role=PHYSICAL_CONDUCTOR,
            code=code,
            colour_source=source,
            geometry_source="open-vector-run-between-hard-boundaries",
            safe=safe,
            reason=reason,
        ))
        if safe:
            approved_runs += 1
            continue
        run.abstained_from_code = run.code
        run.code = None
        run.legend_raw = None
        run.propagated = False
        run.abstained = True
        run.abstain_reason = f"engineering semantics: {reason}"
        abstained += 1

    approved_pins = []
    for ordinal, marker in enumerate(pin_markers):
        code = str(marker.code)
        reason = None
        if not _supported(code, convention):
            reason = "unsupported-or-invented-colour-code"
        elif not marker.legend_raw:
            reason = "missing-authoritative-printed-colour-source"
        elif marker.radius <= 0 or marker.outer_radius <= marker.radius:
            reason = "unsafe-pin-marker-clearance"
        safe = reason is None
        claims.append(SemanticClaim(
            object_id=f"connector-pin:{ordinal}",
            role=CONNECTOR_PIN,
            code=code,
            colour_source="exact-connector-pin-callout",
            geometry_source="clearance-bounded-pin-interior",
            safe=safe,
            reason=reason,
        ))
        if safe:
            approved_pins.append(marker)
        else:
            abstained += 1

    grammar = ("pictorial-connector-schedule" if approved_pins and not approved_runs
               else "born-digital-wiring-schematic")
    diagnostics = decision or {}
    stripped_furniture = sum(int(diagnostics.get(key, 0)) for key in (
        "rails_stripped", "boxes_stripped", "frames_stripped", "frame_splits"))
    roles = {
        PHYSICAL_CONDUCTOR: approved_runs,
        CONNECTOR_PIN: len(approved_pins),
        COMPONENT_BOUNDARY: int(context.symbol_zones) + stripped_furniture,
        ANNOTATION_LEADER: 0,
        UNRESOLVED_GEOMETRY: sum(1 for run in owned if not run.code),
    }
    analysis = _analysis(
        grammar,
        roles,
        claims,
        {
            COMPONENT_BOUNDARY: int(context.symbol_zones),
            TERMINAL_OR_JUNCTION: 0,
        },
        notes=(
            "Exact text supplies colour; vector topology supplies physical conductor geometry.",
            "Components, connector bodies, rails and frames are classified before rendering.",
        ),
    )
    analysis["semantic_abstentions"] = abstained
    return owned, approved_pins, analysis


def enforce_raster_semantics(solution: dict, convention):
    """Remove unsafe raster claims and attach a role-first engineering audit to the solution."""
    claims: list[SemanticClaim] = []
    segments = solution.get("segments", ())
    solid = solution.get("solver", {}).get("claims", {})
    for segment_index, claim in list(solid.items()):
        codes = tuple(str(code) for code in claim[1])
        code = convention.two_color_sep.join(codes)
        reason = None
        if not _supported(code, convention):
            reason = "unsupported-or-invented-colour-code"
        elif not (0 <= int(segment_index) < len(segments)):
            reason = "missing-physical-conductor-geometry"
        elif len(segments[int(segment_index)].get("order", ())) < 2:
            reason = "missing-physical-conductor-geometry"
        safe = reason is None
        claims.append(SemanticClaim(
            object_id=f"raster-solid:{segment_index}",
            role=PHYSICAL_CONDUCTOR,
            code=code,
            colour_source="ocr-legend-ownership",
            geometry_source="pixel-conductor-between-hard-boundaries",
            safe=safe,
            reason=reason,
        ))
        if not safe:
            del solid[segment_index]

    dgroups = solution.get("dgroups", {})
    dclaims = solution.get("dclaims", {})
    for root, claim in list(dclaims.items()):
        codes = tuple(str(code) for code in claim[1])
        code = convention.two_color_sep.join(codes)
        members = dgroups.get(root, ())
        reason = None
        if not _supported(code, convention):
            reason = "unsupported-or-invented-colour-code"
        elif not members or any(not (0 <= int(index) < len(segments)) for index in members):
            reason = "missing-dashed-conductor-geometry"
        safe = reason is None
        claims.append(SemanticClaim(
            object_id=f"raster-dashed:{root}",
            role=PHYSICAL_CONDUCTOR,
            code=code,
            colour_source="ocr-dashed-legend-ownership",
            geometry_source="dashed-physical-conductor-between-hard-boundaries",
            safe=safe,
            reason=reason,
        ))
        if not safe:
            del dclaims[root]

    outlined = []
    for ordinal, wire in enumerate(solution.get("outlined_wires", ())):
        code = str(wire.code if hasattr(wire, "code") else wire["code"])
        legend_raw = wire.legend_raw if hasattr(wire, "legend_raw") else wire.get("legend_raw")
        order = wire.order if hasattr(wire, "order") else wire.get("order", ())
        reason = None
        if not _supported(code, convention):
            reason = "unsupported-or-invented-colour-code"
        elif not legend_raw:
            reason = "missing-authoritative-printed-colour-source"
        elif len(order) < 2:
            reason = "missing-outlined-conductor-geometry"
        safe = reason is None
        claims.append(SemanticClaim(
            object_id=f"outlined-conductor:{ordinal}",
            role=PHYSICAL_CONDUCTOR,
            code=code,
            colour_source="exact-vector-callout",
            geometry_source="medial-axis-of-closed-raster-cable-interior",
            safe=safe,
            reason=reason,
        ))
        if safe:
            outlined.append(wire)
    solution["outlined_wires"] = outlined

    callouts = solution.get("semantic_exclusions", ())
    approved = sum(1 for claim in claims if claim.safe)
    assigned_segment_ids = {int(index) for index in solid}
    for root in dclaims:
        assigned_segment_ids.update(int(index) for index in dgroups.get(root, ()))
    grammar = ("pictorial-outlined-harness" if outlined
               else "raster-wiring-schematic")
    roles = {
        PHYSICAL_CONDUCTOR: approved,
        CONNECTOR_PIN: 0,
        ANNOTATION_LEADER: len(callouts),
        COMPONENT_BOUNDARY: len(solution.get("housings", ()))
        + len(solution.get("inline_components", ())),
        UNRESOLVED_GEOMETRY: max(0, len(segments) - len(assigned_segment_ids)),
    }
    analysis = _analysis(
        grammar,
        roles,
        claims,
        {
            COMPONENT_BOUNDARY: roles[COMPONENT_BOUNDARY],
            TERMINAL_OR_JUNCTION: len(solution.get("terminal_dots", ())),
        },
        notes=(
            "Pixel topology proposes conductors; exact/OCR legends remain the only colour source.",
            "Recognised annotation leaders are protected independently of conductor tracing.",
        ),
    )
    analysis["semantic_abstentions"] = sum(1 for claim in claims if not claim.safe)
    solution["engineering_semantics"] = analysis
    return solution, analysis
