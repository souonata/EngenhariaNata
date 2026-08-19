"""Tiny, inspectable classifier for intrinsic run geometry.

This is intentionally not a vision model.  The PDF reader has already converted the page into a
graph; the learned task is the much smaller question "does this graph run look like a conductor or
page furniture?".  A calibrated logistic model is fast on a two-core CPU, serialises to readable
JSON, and cannot alter the source document.  It supplies a prior to constrained ownership and an
abstention signal; it never invents a colour.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
from math import exp, hypot, log
import os


MODEL_SCHEMA_VERSION = 3
PARENT_FEATURE_NAMES = (
    "parent_log_length_over_floor",
    "parent_fold_ratio",
    "parent_log_segment_count",
    "parent_endpoint_contact_count",
    "parent_interior_termination_count",
    "parent_perpendicular_termination_share",
)
FEATURE_NAMES = (
    "log_length_over_floor",
    "straightness",
    "fold_ratio",
    "log_bbox_over_floor",
    "horizontal_share",
    "endpoint_degree_min",
    "endpoint_degree_max",
    "closed",
    "log_point_count",
    "nearest_legend_over_floor",
    "nearby_legend_count",
    "nearby_code_diversity",
    "log_segment_count",
    "longest_segment_share",
    "axis_aligned_share",
    "turn_density",
    "endpoint_contact_count",
    "interior_termination_count",
    "perpendicular_termination_share",
    "collinear_endpoint_continuations",
    *PARENT_FEATURE_NAMES,
)


def _length(points):
    return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


def _distance_to_run(x, y, points):
    best = float("inf")
    for a, b in zip(points, points[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length_sq = dx * dx + dy * dy
        t = 0.0 if length_sq == 0 else max(
            0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / length_sq))
        best = min(best, hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)))
    return best


def _node_key(point, snap_px):
    return round(point[0] / snap_px), round(point[1] / snap_px)


def _segment_geometry(points):
    """Return stable local geometry without consulting any paint decision."""
    from math import atan2, pi

    segments = []
    for a, b in zip(points, points[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = hypot(dx, dy)
        if length <= 1e-9:
            continue
        angle = atan2(dy, dx) % pi
        segments.append((a, b, dx, dy, length, angle))
    return segments


def _point_to_run_contact(point, points, geometry=None):
    """Distance, segment angle and position along the closest run segment."""
    best = (float("inf"), 0.0, 0.0)
    for a, b, dx, dy, _length, angle in (geometry or _segment_geometry(points)):
        length_sq = dx * dx + dy * dy
        t = max(0.0, min(1.0, ((point[0] - a[0]) * dx
                              + (point[1] - a[1]) * dy) / length_sq))
        distance = hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
        if distance < best[0]:
            best = (distance, angle, t)
    return best


def _angle_difference(a, b):
    from math import pi

    difference = abs(a - b) % pi
    return min(difference, pi - difference)


def run_feature_rows(runs, legends, min_run_px, snap_px=1.5, legend_reach_px=180.0):
    """Return one intrinsic feature dictionary per run.

    Features do not include the engine's assigned colour or whether propagation happened.  That is
    crucial: the model learns the drawing, not a previous version of the engine's answer.
    """
    floor = max(float(min_run_px), 1.0)
    degrees = {}
    geometries = [_segment_geometry(points) if len(points) >= 2 else [] for points in runs]
    for run_index, points in enumerate(runs):
        if len(points) < 2:
            continue
        for point in (points[0], points[-1]):
            key = _node_key(point, snap_px)
            degrees[key] = degrees.get(key, 0) + 1

    rows = []
    for run_index, points in enumerate(runs):
        if len(points) < 2:
            rows.append({name: 0.0 for name in FEATURE_NAMES})
            continue
        length = max(_length(points), 1e-6)
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        diagonal = max(hypot(max(xs) - min(xs), max(ys) - min(ys)), 1e-6)
        horizontal = sum(abs(b[0] - a[0]) for a, b in zip(points, points[1:]))
        vertical = sum(abs(b[1] - a[1]) for a, b in zip(points, points[1:]))
        legend_distances = [(_distance_to_run(legend.x, legend.y, points), legend.code)
                            for legend in legends]
        nearby = [(distance, code) for distance, code in legend_distances
                  if distance <= legend_reach_px]
        nearest = min((distance for distance, _code in legend_distances), default=legend_reach_px)
        end_degrees = [degrees.get(_node_key(point, snap_px), 0)
                       for point in (points[0], points[-1])]
        geometry = geometries[run_index]
        segment_lengths = [segment[4] for segment in geometry]
        axis_aligned = sum(
            segment[4] for segment in geometry
            if min(abs(segment[2]), abs(segment[3])) <= 0.12 * segment[4])
        turns = 0
        for left, right in zip(geometry, geometry[1:]):
            if _angle_difference(left[5], right[5]) > 0.18:
                turns += 1

        endpoint_contacts = 0
        interior_terminations = 0
        perpendicular_terminations = 0
        collinear_continuations = 0
        contact_radius = max(1.5, float(snap_px))
        endpoint_radius = 2.5 * contact_radius
        for other_index, other_points in enumerate(runs):
            if other_index == run_index or len(other_points) < 2:
                continue
            other_geometry = geometries[other_index]
            if not other_geometry:
                continue
            for endpoint, other_segment in (
                    (other_points[0], other_geometry[0]),
                    (other_points[-1], other_geometry[-1])):
                distance, local_angle, position = _point_to_run_contact(
                    endpoint, points, geometry=geometry)
                if distance > contact_radius:
                    continue
                near_own_endpoint = min(
                    hypot(endpoint[0] - points[0][0], endpoint[1] - points[0][1]),
                    hypot(endpoint[0] - points[-1][0], endpoint[1] - points[-1][1]),
                ) <= endpoint_radius
                other_angle = other_segment[5]
                angle_difference = _angle_difference(local_angle, other_angle)
                if near_own_endpoint or position <= 0.02 or position >= 0.98:
                    endpoint_contacts += 1
                    if angle_difference <= 0.18:
                        collinear_continuations += 1
                else:
                    interior_terminations += 1
                    if angle_difference >= 1.22:
                        perpendicular_terminations += 1
        rows.append({
            "log_length_over_floor": log(1.0 + length / floor),
            "straightness": diagonal / length,
            "fold_ratio": length / diagonal,
            "log_bbox_over_floor": log(1.0 + diagonal / floor),
            "horizontal_share": horizontal / max(horizontal + vertical, 1e-6),
            "endpoint_degree_min": float(min(end_degrees)),
            "endpoint_degree_max": float(max(end_degrees)),
            "closed": float(hypot(points[0][0] - points[-1][0],
                                  points[0][1] - points[-1][1]) <= snap_px),
            "log_point_count": log(1.0 + len(points)),
            "nearest_legend_over_floor": min(nearest, legend_reach_px) / floor,
            "nearby_legend_count": float(len(nearby)),
            "nearby_code_diversity": float(len({code for _distance, code in nearby})),
            "log_segment_count": log(1.0 + len(geometry)),
            "longest_segment_share": max(segment_lengths, default=0.0) / length,
            "axis_aligned_share": axis_aligned / length,
            "turn_density": float(turns) / max(length / floor, 1.0),
            "endpoint_contact_count": float(endpoint_contacts),
            "interior_termination_count": float(interior_terminations),
            "perpendicular_termination_share": (
                float(perpendicular_terminations) / max(interior_terminations, 1)),
            "collinear_endpoint_continuations": float(collinear_continuations),
            **{name: 0.0 for name in PARENT_FEATURE_NAMES},
        })
    return rows


def atomic_piece_feature_rows(runs, legends, min_run_px, snap_px=1.5,
                              legend_reach_px=180.0):
    """Describe each polyline edge locally while retaining its parent-run context.

    A vector run may fuse a real conductor to a connector or component border.  One label for the
    whole run is then contradictory.  Atomic pieces let abstention black only the furniture edge;
    parent features preserve the long-range evidence that this piece belongs to a larger route.
    """
    parents = run_feature_rows(
        runs, legends, min_run_px, snap_px=snap_px, legend_reach_px=legend_reach_px)
    pieces = []
    for parent_index, points in enumerate(runs):
        for segment_index, (a, b) in enumerate(zip(points, points[1:])):
            if hypot(b[0] - a[0], b[1] - a[1]) <= 1e-9:
                continue
            pieces.append({
                "parent_index": parent_index, "segment_index": segment_index,
                "points": [a, b],
            })
    local = run_feature_rows(
        [piece["points"] for piece in pieces], legends, min_run_px,
        snap_px=snap_px, legend_reach_px=legend_reach_px)
    parent_mapping = {
        "parent_log_length_over_floor": "log_length_over_floor",
        "parent_fold_ratio": "fold_ratio",
        "parent_log_segment_count": "log_segment_count",
        "parent_endpoint_contact_count": "endpoint_contact_count",
        "parent_interior_termination_count": "interior_termination_count",
        "parent_perpendicular_termination_share": "perpendicular_termination_share",
    }
    for piece, row in zip(pieces, local):
        parent = parents[piece["parent_index"]]
        for target, source in parent_mapping.items():
            row[target] = parent[source]
    return pieces, local


def feature_vector(row):
    return [float(row.get(name, 0.0)) for name in FEATURE_NAMES]


def _sigmoid(value):
    if value >= 0:
        return 1.0 / (1.0 + exp(-min(value, 60.0)))
    value = max(value, -60.0)
    positive = exp(value)
    return positive / (1.0 + positive)


@dataclass(frozen=True)
class CalibratedRunClassifier:
    means: tuple[float, ...]
    scales: tuple[float, ...]
    weights: tuple[float, ...]
    bias: float
    calibration_slope: float = 1.0
    calibration_intercept: float = 0.0
    metadata: dict | None = None
    schema_version: int = MODEL_SCHEMA_VERSION

    def __post_init__(self):
        size = len(FEATURE_NAMES)
        if not (len(self.means) == len(self.scales) == len(self.weights) == size):
            raise ValueError(f"classifier expects {size} values for every parameter vector")
        if self.schema_version != MODEL_SCHEMA_VERSION:
            raise ValueError(f"unsupported classifier schema {self.schema_version}")

    def raw_logit(self, row):
        values = feature_vector(row)
        standardized = [(value - mean) / max(scale, 1e-9)
                        for value, mean, scale in zip(values, self.means, self.scales)]
        return self.bias + sum(weight * value for weight, value in zip(self.weights, standardized))

    def predict_probability(self, row):
        calibrated = self.calibration_slope * self.raw_logit(row) + self.calibration_intercept
        return _sigmoid(calibrated)

    def to_dict(self):
        return {
            "schema_version": self.schema_version,
            "feature_names": list(FEATURE_NAMES),
            "means": list(self.means),
            "scales": list(self.scales),
            "weights": list(self.weights),
            "bias": self.bias,
            "calibration_slope": self.calibration_slope,
            "calibration_intercept": self.calibration_intercept,
            "metadata": self.metadata or {},
        }

    def save(self, path):
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, indent=2, sort_keys=True)
            handle.write("\n")
        return path

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as handle:
            raw = json.load(handle)
        if raw.get("kind") == "ensemble":
            return RunClassifierEnsemble.from_dict(raw)
        if tuple(raw.get("feature_names", ())) != FEATURE_NAMES:
            raise ValueError("classifier feature schema does not match this engine")
        return cls(
            means=tuple(raw["means"]), scales=tuple(raw["scales"]),
            weights=tuple(raw["weights"]), bias=float(raw["bias"]),
            calibration_slope=float(raw.get("calibration_slope", 1.0)),
            calibration_intercept=float(raw.get("calibration_intercept", 0.0)),
            metadata=raw.get("metadata", {}),
            schema_version=int(raw.get("schema_version", 0)),
        )


@dataclass(frozen=True)
class RunClassifierEnsemble:
    """Average cross-fitted models for stable inference on a genuinely unseen drawing."""

    members: tuple[CalibratedRunClassifier, ...]
    metadata: dict | None = None
    schema_version: int = MODEL_SCHEMA_VERSION

    def __post_init__(self):
        if not self.members:
            raise ValueError("classifier ensemble needs at least one member")
        if self.schema_version != MODEL_SCHEMA_VERSION:
            raise ValueError(f"unsupported classifier schema {self.schema_version}")

    def predict_probability(self, row):
        return sum(member.predict_probability(row) for member in self.members) / len(self.members)

    def to_dict(self):
        return {
            "kind": "ensemble", "schema_version": self.schema_version,
            "feature_names": list(FEATURE_NAMES),
            "members": [member.to_dict() for member in self.members],
            "metadata": self.metadata or {},
        }

    def save(self, path):
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, indent=2, sort_keys=True)
            handle.write("\n")
        return path

    @classmethod
    def from_dict(cls, raw):
        if tuple(raw.get("feature_names", ())) != FEATURE_NAMES:
            raise ValueError("classifier feature schema does not match this engine")
        members = []
        for item in raw.get("members", ()):
            if item.get("kind") == "ensemble":
                raise ValueError("nested classifier ensembles are not supported")
            members.append(CalibratedRunClassifier(
                means=tuple(item["means"]), scales=tuple(item["scales"]),
                weights=tuple(item["weights"]), bias=float(item["bias"]),
                calibration_slope=float(item.get("calibration_slope", 1.0)),
                calibration_intercept=float(item.get("calibration_intercept", 0.0)),
                metadata=item.get("metadata", {}),
                schema_version=int(item.get("schema_version", 0)),
            ))
        return cls(tuple(members), metadata=raw.get("metadata", {}),
                   schema_version=int(raw.get("schema_version", 0)))


def _fit_logistic(x, y, sample_weight, iterations=1200, learning_rate=0.04, l2=0.02):
    """Small deterministic weighted logistic regression using only NumPy."""
    import numpy as np

    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    sw = np.asarray(sample_weight, dtype=float)
    weights = np.zeros(x.shape[1], dtype=float)
    bias = 0.0
    # Adam converges reliably on the small, differently-scaled annotation sets encountered here.
    mw = np.zeros_like(weights)
    vw = np.zeros_like(weights)
    mb = vb = 0.0
    beta1, beta2 = 0.9, 0.999
    denom = max(float(sw.sum()), 1.0)
    for step in range(1, iterations + 1):
        logits = np.clip(x @ weights + bias, -40.0, 40.0)
        predictions = 1.0 / (1.0 + np.exp(-logits))
        error = (predictions - y) * sw
        grad_w = x.T @ error / denom + l2 * weights
        grad_b = float(error.sum() / denom)
        mw = beta1 * mw + (1.0 - beta1) * grad_w
        vw = beta2 * vw + (1.0 - beta2) * (grad_w * grad_w)
        mb = beta1 * mb + (1.0 - beta1) * grad_b
        vb = beta2 * vb + (1.0 - beta2) * (grad_b * grad_b)
        mw_hat, vw_hat = mw / (1.0 - beta1 ** step), vw / (1.0 - beta2 ** step)
        mb_hat, vb_hat = mb / (1.0 - beta1 ** step), vb / (1.0 - beta2 ** step)
        weights -= learning_rate * mw_hat / (np.sqrt(vw_hat) + 1e-8)
        bias -= learning_rate * mb_hat / ((vb_hat ** 0.5) + 1e-8)
    return weights, bias


def fit_calibrated_classifier(rows, labels, groups=None, metadata=None):
    """Fit with group-out-of-fold probability calibration.

    Multiple pins on one drawing are correlated, so every calibration prediction comes from a
    model that saw none of that sheet.  Five group folds use all available styles for calibration;
    the final classifier is then fitted on all rows.  Fewer than four groups leave calibration as
    identity and are recorded as insufficient evidence.
    """
    import numpy as np

    if len(rows) != len(labels) or not rows:
        raise ValueError("rows and labels must be non-empty and have equal length")
    y = np.asarray(labels, dtype=float)
    if set(y.tolist()) != {0.0, 1.0}:
        raise ValueError("training data must contain both wire and non-wire examples")
    x = np.asarray([feature_vector(row) for row in rows], dtype=float)
    groups = list(groups or [str(i) for i in range(len(rows))])
    unique_groups = sorted(set(groups))

    def fit_mask(mask):
        local_means = x[mask].mean(axis=0)
        local_scales = x[mask].std(axis=0)
        local_scales[local_scales < 1e-9] = 1.0
        local_x = (x - local_means) / local_scales
        local_y = y[mask]
        positives = max(1, int(local_y.sum()))
        negatives = max(1, int((1 - local_y).sum()))
        class_weight = np.where(local_y > 0.5, len(local_y) / (2 * positives),
                                len(local_y) / (2 * negatives))
        local_weights, local_bias = _fit_logistic(local_x[mask], local_y, class_weight)
        return local_means, local_scales, local_weights, local_bias, local_x

    # Group-out-of-fold logits for calibration.
    oof_logits = np.full(len(rows), np.nan, dtype=float)
    folds = min(5, len(unique_groups)) if len(unique_groups) >= 4 else 0
    fold_groups = []
    for fold in range(folds):
        held_groups = {group for index, group in enumerate(unique_groups) if index % folds == fold}
        fold_groups.append(sorted(held_groups))
        train_mask = np.asarray([group not in held_groups for group in groups])
        held_mask = ~train_mask
        if len(set(y[train_mask])) < 2 or not held_mask.any():
            continue
        _m, _s, fold_weights, fold_bias, fold_x = fit_mask(train_mask)
        oof_logits[held_mask] = fold_x[held_mask] @ fold_weights + fold_bias

    # Final model learns from every labelled run; only its calibration used out-of-fold answers.
    all_mask = np.ones(len(rows), dtype=bool)
    means, scales, weights, bias, standardized = fit_mask(all_mask)

    slope, intercept = 1.0, 0.0
    calibration_mask = np.isfinite(oof_logits)
    model_metadata_rejection = None
    if calibration_mask.all() and len(set(y[calibration_mask])) == 2:
        z = np.column_stack([oof_logits[calibration_mask]])
        cal_weights, cal_bias = _fit_logistic(
            z, y[calibration_mask], np.ones(int(calibration_mask.sum())),
            iterations=800, learning_rate=0.025, l2=0.05)
        candidate_slope, candidate_intercept = float(cal_weights[0]), float(cal_bias)
        # Calibration may shift confidence but must not reverse the classifier's ordering.  A
        # negative Platt slope on one small held-out style means that fold is not representative;
        # accepting it would turn every likely wire into a likely non-wire.  Preserve the base
        # model and record the rejected fold instead.
        if candidate_slope > 0:
            slope, intercept = candidate_slope, candidate_intercept
        else:
            # A negative Platt slope says the fold cannot safely rank unseen drawings.  Falling
            # back to the observed prevalence is calibrated but deliberately non-discriminative:
            # this member can stabilize an ensemble, never invert wire and furniture evidence.
            prevalence = min(1.0 - 1e-6, max(1e-6, float(y.mean())))
            slope, intercept = 0.0, log(prevalence / (1.0 - prevalence))
            model_metadata_rejection = {
                "calibration_fallback": "constant class prevalence",
                "rejected_calibration_slope": candidate_slope,
            }
    elif folds:
        model_metadata_rejection = {"calibration_rejected": "incomplete group folds"}
    else:
        model_metadata_rejection = {"calibration_rejected": "fewer than four groups"}

    model_metadata = dict(metadata or {})
    model_metadata.update({
        "samples": len(rows), "wire_samples": int(y.sum()),
        "non_wire_samples": int((1 - y).sum()),
        "groups": len(unique_groups),
        "calibration_method": "group-oof" if folds else "identity",
        "calibration_folds": fold_groups,
        "calibration_groups": unique_groups if folds else [],
    })
    if model_metadata_rejection:
        model_metadata.update(model_metadata_rejection)
    return CalibratedRunClassifier(
        means=tuple(float(v) for v in means), scales=tuple(float(v) for v in scales),
        weights=tuple(float(v) for v in weights), bias=float(bias),
        calibration_slope=slope, calibration_intercept=intercept,
        metadata=model_metadata,
    )
