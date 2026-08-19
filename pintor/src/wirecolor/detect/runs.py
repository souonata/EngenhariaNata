"""Straight sub-runs: the atom a legend can actually be measured against.

A skeleton arc is not a straight line.  Measuring "where is this conductor" by averaging the cross
coordinate over an entire arc returns a phantom position whenever the arc bends: on pub 2503,
11.2% of non-excluded arcs bend in both axes, and one alternator hairpin reports a conductor at
x=6702 where there is no ink at all -- 24 px from a legend whose real wire lies 32 px away on the
OTHER side.  Every offset-based decision built on that number is aligning against something that
does not exist, which is why a per-label offset rule measured WORSE than no rule at all.

A run is a maximal stretch of one arc whose cross coordinate stays inside the sheet's own line
width, long enough for a legend to be printed alongside it.  Its cross position is the MEDIAN, so
a stub at one end cannot drag the line off the ink.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Run:
    """One straight stretch of conductor, in page coordinates."""

    rid: int
    si: int
    axis: str          # 'v' (constant x) or 'h' (constant y)
    cross: float       # median coordinate across the run
    along0: float
    along1: float
    spread: float      # max deviation from ``cross`` inside the run

    @property
    def length(self):
        return self.along1 - self.along0

    def overlap(self, other):
        """Shared extent along the common axis; 0 when the runs do not run alongside."""
        if other.axis != self.axis:
            return 0.0
        return max(0.0, min(self.along1, other.along1) - max(self.along0, other.along0))


def _median(values):
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[middle])
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def _split_axis(points, axis, tolerance):
    """Break a polyline into maximal stretches that stay straight on ``axis``."""
    stretches, current = [], []
    for y, x in points:
        cross, along = (x, y) if axis == "v" else (y, x)
        if current:
            crosses = [c for c, _a in current]
            low, high = min(min(crosses), cross), max(max(crosses), cross)
            if high - low > tolerance:
                stretches.append(current)
                current = []
        current.append((cross, along))
    if current:
        stretches.append(current)
    return stretches


def extract_runs(segments, line_width=3.0, min_length=40.0, indices=None):
    """Straight runs of every segment, both axes considered independently.

    ``line_width`` is the sheet's measured pen width (census ``line_width_p90``), so the same code
    behaves correctly on a 1-px vector sheet and on a 16-px legacy scan.  ``min_length`` should be
    about twice a legend's extent: a stretch shorter than the text beside it cannot be the thing
    that text is labelling.
    """
    tolerance = max(2.0, line_width + 1.0)
    runs = []
    for si in (range(len(segments)) if indices is None else indices):
        points = segments[si]["order"]
        if len(points) < 2:
            continue
        for axis in ("v", "h"):
            for stretch in _split_axis(points, axis, tolerance):
                if len(stretch) < 2:
                    continue
                alongs = [a for _c, a in stretch]
                along0, along1 = min(alongs), max(alongs)
                if along1 - along0 < min_length:
                    continue
                crosses = [c for c, _a in stretch]
                cross = _median(crosses)
                runs.append(Run(rid=len(runs), si=si, axis=axis, cross=cross,
                                along0=along0, along1=along1,
                                spread=max(crosses) - min(crosses)))
    return runs


def signed_offset(run, cx, cy):
    """Signed distance from a legend centre to a run, across the run's axis.

    Positive means the conductor lies at a greater coordinate than the legend, which is what makes
    the sheet's printing side a usable one-sided constraint.
    """
    return run.cross - (cx if run.axis == "v" else cy)


def alongside(run, cx, cy, allowance=0.0):
    """Is the legend printed beside this run rather than past either of its ends?"""
    along = cy if run.axis == "v" else cx
    return run.along0 - allowance <= along <= run.along1 + allowance
