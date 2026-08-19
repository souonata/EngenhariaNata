"""Fast, OCR-free topology check for the three reviewed pub2503 routes."""
from __future__ import annotations

import sys

import cv2

sys.path.insert(0, "/tmp/wirecolor_p0")

from wirecolor import pipeline
from wirecolor.labels.conventions import load_convention


def label(code, raw, score, box):
    xs = [point[0] for point in box]
    ys = [point[1] for point in box]
    return {
        "code": code,
        "raw": raw,
        "score": score,
        "cx": sum(xs) / len(xs),
        "cy": sum(ys) / len(ys),
        "w": max(xs) - min(xs),
        "h": max(ys) - min(ys),
        "box": box,
        "_provenance": "targeted-diagnostic",
    }


EXTRA_LABELS = [
    label("R", "25 R", 0.98682,
          [[5210.0, 1731.0], [5210.0, 1622.0],
           [5258.5, 1622.0], [5258.5, 1731.0]]),
    label("R", "70 R", 0.99986,
          [[7754.6371, 4697.0238], [7858.6694, 4697.0238],
           [7858.6694, 4739.8810], [7754.6371, 4739.8810]]),
]


class EmptyScene:
    wires = {}
    label_distance = 140.0

    def refresh_evidence(self, _seeds):
        return None

    def rank_roots(self, *_args, **_kwargs):
        return []


original_filter = pipeline.filter_labels


def diagnostic_filter(data):
    return original_filter(data) + EXTRA_LABELS


def skip_multiscale(*_args, **_kwargs):
    return {"recovered": [], "crops": 0, "scene": EmptyScene()}


pipeline.filter_labels = diagnostic_filter
pipeline.collect_multiscale_evidence = skip_multiscale

solution = pipeline.run_page(
    "/tmp/wirecolor_p1/pub2503_p0_work.png",
    "/tmp/wirecolor_p1/pub2503_p0_labels.json",
    load_convention("volvo_classic"),
)
pipeline.paint_page_legacy(
    solution, "/tmp/wirecolor_p1/pub2503_targeted_topology_diag.png")

print("TARGETED_TOPOLOGY_DIAG_COMPLETE")
