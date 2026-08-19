"""Versioned, bounded parameters for wire-colour decision making.

The engine used to keep its thresholds as unrelated module globals.  That made a measured change
easy to ship, but made controlled learning impossible: an optimiser needs a small, explicit genome
whose values can be validated, recorded and replayed byte-for-byte.  ``DecisionPolicy`` is that
genome.  It contains decisions only; PDF extraction and paint appearance are deliberately outside
the search space.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, fields, replace
import json
import os
from typing import ClassVar


SCHEMA_VERSION = 1


@dataclass(frozen=True)
class DecisionPolicy:
    """All parameters that an optimiser is allowed to change.

    Bounds are intentionally conservative and are enforced on load.  Source-code mutation is not
    part of the learning loop: a candidate may move these measured thresholds, but cannot disable
    preservation checks or invent a new rule.
    """

    schema_version: int = SCHEMA_VERSION
    name: str = "conservative-v1"
    constraint_solver: str = "auto"  # auto reduces to exact assignment; "milp" is audit/debug

    # Legend -> run ownership.
    max_ownership_px: float = 150.0
    refuse_cost: float = 90.0
    axis_mismatch_cost: float = 45.0

    # Weak, corroborated bare-letter recovery.
    promoted_min_run_factor: float = 4.0
    promoted_max_fold: float = 2.5

    # Continuity across a small symbol gap.
    bridge_max_gap_px: float = 30.0
    bridge_gap_factor: float = 0.60
    bridge_angle_tol_deg: float = 12.0
    bridge_lateral_min_px: float = 6.0
    bridge_lateral_factor: float = 0.12
    bridge_max_passes: int = 8

    # Exact-node colour propagation.
    continuation_snap_px: float = 1.5
    continuation_max_passes: int = 12

    # Learned run prior.  It is inert when no classifier is supplied.
    classifier_assignment_weight: float = 18.0
    classifier_direct_min_probability: float = 0.08
    classifier_propagated_min_probability: float = 0.30

    # Explicit ambiguity abstention.  Zero preserves the measured baseline; learned candidates may
    # raise it, but only inside the safe bound below.
    min_direct_assignment_margin: float = 0.0

    # The general constraint solver has a deadline and falls back to the exact assignment solver.
    milp_time_limit_seconds: float = 8.0

    _BOUNDS: ClassVar[dict[str, tuple[float, float]]] = {
        "max_ownership_px": (90.0, 220.0),
        "refuse_cost": (55.0, 130.0),
        "axis_mismatch_cost": (15.0, 80.0),
        "promoted_min_run_factor": (3.5, 7.0),
        "promoted_max_fold": (1.8, 3.0),
        "bridge_max_gap_px": (18.0, 42.0),
        "bridge_gap_factor": (0.35, 0.80),
        "bridge_angle_tol_deg": (6.0, 16.0),
        "bridge_lateral_min_px": (3.0, 8.0),
        "bridge_lateral_factor": (0.06, 0.18),
        "bridge_max_passes": (2, 12),
        "continuation_snap_px": (0.8, 2.5),
        "continuation_max_passes": (4, 20),
        "classifier_assignment_weight": (0.0, 35.0),
        # Direct legends remain strongly protected by the hard regression gate.  The previous
        # 0.25 ceiling sat below every observed false-paint probability and made this parameter a
        # decorative knob; 0.60 lets calibration express evidence while still refusing aggressive
        # high-confidence deletion.
        "classifier_direct_min_probability": (0.0, 0.60),
        "classifier_propagated_min_probability": (0.0, 0.60),
        "min_direct_assignment_margin": (0.0, 0.18),
        "milp_time_limit_seconds": (1.0, 30.0),
    }

    def validate(self) -> "DecisionPolicy":
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(
                f"unsupported decision-policy schema {self.schema_version}; expected {SCHEMA_VERSION}")
        if self.constraint_solver not in {"auto", "milp"}:
            raise ValueError("constraint_solver must be 'auto' or 'milp'")
        for key, (low, high) in self._BOUNDS.items():
            value = getattr(self, key)
            if not low <= value <= high:
                raise ValueError(f"{key}={value!r} is outside the safe range [{low}, {high}]")
        if self.refuse_cost >= self.max_ownership_px:
            # A candidate beyond REFUSE_COST may still exist for global matching, but refusal must
            # become preferable before the absolute geometric reach ends.
            raise ValueError("refuse_cost must be smaller than max_ownership_px")
        return self

    def evolved(self, **changes) -> "DecisionPolicy":
        return replace(self, **changes).validate()

    def to_dict(self) -> dict:
        return asdict(self)

    def save(self, path: str) -> str:
        self.validate()
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, indent=2, sort_keys=True)
            handle.write("\n")
        return path

    @classmethod
    def from_dict(cls, raw: dict) -> "DecisionPolicy":
        allowed = {field.name for field in fields(cls) if not field.name.startswith("_")}
        unknown = set(raw) - allowed
        if unknown:
            raise ValueError(f"unknown decision-policy fields: {', '.join(sorted(unknown))}")
        return cls(**raw).validate()

    @classmethod
    def load(cls, path: str | None) -> "DecisionPolicy":
        if not path:
            return cls().validate()
        with open(path, encoding="utf-8") as handle:
            return cls.from_dict(json.load(handle))

    @classmethod
    def tunable_bounds(cls) -> dict[str, tuple[float, float]]:
        """Public copy of the safe optimiser search space."""
        return dict(cls._BOUNDS)
