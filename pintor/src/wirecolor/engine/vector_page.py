"""Single source of truth for vector-page extraction and colour decisions.

Painting, QA, training and parameter optimisation must run the same graph.  Previously the QA
ledger carried a hand-copied version of ``paint_vector``'s ownership pipeline; any future learning
change would therefore risk being evaluated against a different engine.  This module separates the
expensive immutable page context from the cheap, parameterised decision pass.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from math import hypot

from .policy import DecisionPolicy


CONTEXT_SCHEMA_VERSION = 5


@dataclass
class VectorPageContext:
    runs: list[list[tuple[float, float]]]
    raw_legends: list
    legends: list
    promoted: list
    pin_markers: list
    min_run_px: float
    page_diagonal_px: float
    pen_px: float
    segments: int
    nets: int
    symbol_zones: int
    blocked_zones: list[tuple[float, float, float, float]]
    symbol_strokes_removed: int
    run_features: list[dict]
    pieces: list[dict]
    piece_features: list[dict]
    schema_version: int = CONTEXT_SCHEMA_VERSION

    def to_dict(self):
        return {
            "schema_version": self.schema_version,
            "runs": [[[float(x), float(y)] for x, y in points] for points in self.runs],
            "raw_legends": [asdict(legend) for legend in self.raw_legends],
            "legends": [asdict(legend) for legend in self.legends],
            "promoted": [asdict(legend) for legend in self.promoted],
            "pin_markers": [asdict(marker) for marker in self.pin_markers],
            "min_run_px": self.min_run_px,
            "page_diagonal_px": self.page_diagonal_px,
            "pen_px": self.pen_px,
            "segments": self.segments,
            "nets": self.nets,
            "symbol_zones": self.symbol_zones,
            "blocked_zones": [list(zone) for zone in self.blocked_zones],
            "symbol_strokes_removed": self.symbol_strokes_removed,
            "run_features": self.run_features,
            "pieces": self.pieces,
            "piece_features": self.piece_features,
        }

    @classmethod
    def from_dict(cls, raw):
        from ..detect.vector_pins import PinMarker
        from ..labels.text_layer import Legend

        if int(raw.get("schema_version", 0)) != CONTEXT_SCHEMA_VERSION:
            raise ValueError("vector decision cache schema mismatch")
        legends = lambda name: [Legend(**item) for item in raw.get(name, ())]
        return cls(
            runs=[[(float(x), float(y)) for x, y in points] for points in raw["runs"]],
            raw_legends=legends("raw_legends"), legends=legends("legends"),
            promoted=legends("promoted"),
            pin_markers=[PinMarker(
                **{**item, "connector_bbox": tuple(item["connector_bbox"])})
                for item in raw.get("pin_markers", ())],
            min_run_px=float(raw["min_run_px"]),
            page_diagonal_px=float(raw["page_diagonal_px"]), pen_px=float(raw["pen_px"]),
            segments=int(raw["segments"]), nets=int(raw["nets"]),
            symbol_zones=int(raw["symbol_zones"]),
            blocked_zones=[tuple(float(value) for value in zone)
                           for zone in raw.get("blocked_zones", ())],
            symbol_strokes_removed=int(raw["symbol_strokes_removed"]),
            run_features=[{str(key): float(value) for key, value in row.items()}
                          for row in raw["run_features"]],
            pieces=[{
                "parent_index": int(piece["parent_index"]),
                "segment_index": int(piece["segment_index"]),
                "points": [(float(x), float(y)) for x, y in piece["points"]],
            } for piece in raw["pieces"]],
            piece_features=[{str(key): float(value) for key, value in row.items()}
                            for row in raw["piece_features"]],
        )


def extract_vector_context(page, dpi, convention, *, legend_filter=None):
    """Read immutable geometry and text evidence once.

    ``legend_filter`` is a discovery-only precision gate.  Production painting keeps the default
    and therefore preserves its established behaviour; the exhaustive inventory can require the
    exact printed spelling to look like an engineering colour code before it spends the full
    topology pass on a candidate page.
    """
    from ..detect.vector_pins import connector_pin_markers
    from ..detect.vector_symbols import strip_symbol_strokes, symbol_geometry
    from ..eval.vector_truth import (MIN_CONDUCTOR_DIAGONAL_FRACTION, build_nets,
                                     canvas_diagonal_px, decompose_runs, extract_segments,
                                     modal_pen_px, node_segments)
    from ..labels.text_layer import promote_bare_letters, read_legends, strong_legends

    pen_px = modal_pen_px(page, dpi)
    zones, symbol_strokes = symbol_geometry(page, dpi, pen_px)
    stripped, zone_dropped = strip_symbol_strokes(extract_segments(page, dpi), symbol_strokes)
    segments = node_segments(stripped)
    nets = build_nets(segments)
    diagonal = canvas_diagonal_px(page, dpi)
    minimum = diagonal * MIN_CONDUCTOR_DIAGONAL_FRACTION
    runs = []
    for net in nets:
        for points in decompose_runs(segments, net):
            if len(points) < 2:
                continue
            length = sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))
            if length >= minimum:
                runs.append(points)
    raw_legends = read_legends(page, dpi, convention)
    if legend_filter is not None:
        raw_legends = [legend for legend in raw_legends if legend_filter(legend)]
    pin_markers, pin_legend_indexes = connector_pin_markers(page, dpi, raw_legends)
    conductor_legends = [legend for index, legend in enumerate(raw_legends)
                         if index not in pin_legend_indexes]
    legends = strong_legends(conductor_legends)
    promoted = promote_bare_letters(conductor_legends, legends, zones, convention)
    from .classifier import atomic_piece_feature_rows, run_feature_rows

    run_features = run_feature_rows(runs, legends, minimum)
    pieces, piece_features = atomic_piece_feature_rows(runs, legends, minimum)
    return VectorPageContext(
        runs=runs, raw_legends=raw_legends, legends=legends, promoted=promoted,
        pin_markers=pin_markers,
        min_run_px=minimum, page_diagonal_px=diagonal, pen_px=pen_px,
        segments=len(segments), nets=len(nets), symbol_zones=len(zones),
        blocked_zones=list(zones),
        symbol_strokes_removed=zone_dropped,
        run_features=run_features,
        pieces=pieces, piece_features=piece_features,
    )


def decide_vector_context(context, policy=None, classifier=None):
    """Solve a cached page graph under one replayable decision policy."""
    from ..detect.vector_loops import strip_symbol_clusters
    from ..detect.vector_rails import (split_fused_frame_borders, strip_connector_rails,
                                       strip_frame_borders)
    from .classifier import run_feature_rows
    from .constraints import abstain_with_classifier, constrained_assign
    from .ownership import (assign_weak_to_leftovers, bridge_straight_continuations,
                            propagate_continuations)

    policy = (policy or DecisionPolicy()).validate()
    owned, constraint_diagnostics = constrained_assign(
        context.legends, context.runs, policy=policy, classifier=classifier,
        min_run_px=context.min_run_px, feature_rows=context.run_features)
    bare_recovered = assign_weak_to_leftovers(
        owned, context.promoted, policy.promoted_min_run_factor * context.min_run_px,
        policy=policy)
    propagated = propagate_continuations(
        owned, snap_px=policy.continuation_snap_px,
        max_passes=policy.continuation_max_passes)
    bridge_gap = min(policy.bridge_max_gap_px, policy.bridge_gap_factor * context.min_run_px)
    bridged = bridge_straight_continuations(
        owned, max_gap_px=bridge_gap, min_conductor_px=context.min_run_px,
        angle_tol_deg=policy.bridge_angle_tol_deg, max_passes=policy.bridge_max_passes,
        lateral_min_px=policy.bridge_lateral_min_px,
        lateral_factor=policy.bridge_lateral_factor,
        blocked_zones=context.blocked_zones)
    propagated += propagate_continuations(
        owned, snap_px=policy.continuation_snap_px,
        max_passes=policy.continuation_max_passes)

    rails_stripped = strip_connector_rails(
        owned, context.page_diagonal_px, context.min_run_px)
    boxes_stripped = strip_symbol_clusters(
        owned, context.page_diagonal_px, context.min_run_px)
    frames_stripped = strip_frame_borders(
        owned, context.min_run_px, context.page_diagonal_px)
    owned, frame_splits = split_fused_frame_borders(owned, context.min_run_px)

    final_features = []
    if classifier is not None:
        from .ownership import OwnedRun

        def edge_key(parent_index, a, b):
            left = (round(a[0], 4), round(a[1], 4))
            right = (round(b[0], 4), round(b[1], 4))
            return parent_index, *sorted((left, right))

        feature_by_edge = {
            edge_key(piece["parent_index"], *piece["points"]): features
            for piece, features in zip(context.pieces, context.piece_features)
        }
        atomic_owned = []
        for run in owned:
            if not run.code or len(run.points) < 2:
                atomic_owned.append(run)
                final_features.append(context.run_features[run.index])
                continue
            for a, b in zip(run.points, run.points[1:]):
                key = edge_key(run.index, a, b)
                atomic_owned.append(OwnedRun(
                    index=run.index, points=[a, b], code=run.code,
                    legend_raw=run.legend_raw, distance=run.distance,
                    corroborations=run.corroborations, propagated=run.propagated,
                    contested=run.contested, confidence=run.confidence,
                    wire_probability=run.wire_probability, abstained=run.abstained,
                    abstain_reason=run.abstain_reason,
                    abstained_from_code=run.abstained_from_code,
                ))
                final_features.append(feature_by_edge.get(key, context.run_features[run.index]))
        owned = atomic_owned
    else:
        final_features = [context.run_features[run.index] for run in owned]
    learned_abstentions = abstain_with_classifier(
        owned, final_features, classifier, policy)
    diagnostics = {
        "constraints": constraint_diagnostics.to_dict(),
        "bare_recovered": bare_recovered,
        "propagation_events": propagated,
        "runs_bridged": bridged,
        "rails_stripped": rails_stripped,
        "boxes_stripped": boxes_stripped,
        "frames_stripped": frames_stripped,
        "frame_splits": frame_splits,
        "learned_abstentions": learned_abstentions,
        "painted_by_continuation": sum(1 for run in owned if run.code and run.propagated),
        "abstained": sum(1 for run in owned if run.abstained),
        "abstentions": [
            {
                "run": run.index,
                "from_code": run.abstained_from_code,
                "probability": run.wire_probability,
                "reason": run.abstain_reason,
                "bbox": [round(min(p[0] for p in run.points), 1),
                         round(min(p[1] for p in run.points), 1),
                         round(max(p[0] for p in run.points), 1),
                         round(max(p[1] for p in run.points), 1)],
            }
            for run in owned if run.abstained and run.points
        ],
    }
    return owned, diagnostics
