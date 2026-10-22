"""WireNet at painting time: which ink on the page the network recognises as a conductor.

The model is trained offline (``tools/train_wirenet.py``) on the factory-coloured diagrams and
shipped as ONNX, so the painter needs only onnxruntime, which the OCR route already carries.

It is a fail-safe filter, nothing more. ``withdraw_unrecognised_runs`` turns a coloured run black
when the network does not see conductor ink along it; it never assigns, changes or invents a
colour, and it is off unless an operator mounts a model (``PINTOR_WIRENET_PATH``), like every other
learned artefact in this package.
"""
from __future__ import annotations

from math import hypot
import os

# A run keeps its colour only when the network calls most of its length conductor ink.
MIN_CONDUCTOR_SHARE = 0.5


class WireNet:
    def __init__(self, path: str, tile: int = 512, overlap: int = 48):
        import onnxruntime

        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = int(os.getenv("PINTOR_WIRENET_THREADS", "2"))
        options.inter_op_num_threads = 1
        self.session = onnxruntime.InferenceSession(path, sess_options=options,
                                                    providers=["CPUExecutionProvider"])
        self.path = path
        self.tile = tile
        self.overlap = overlap

    @classmethod
    def from_environment(cls):
        path = os.getenv("PINTOR_WIRENET_PATH", "").strip()
        return cls(path) if path and os.path.isfile(path) else None

    def conductor_probability(self, gray):
        """P(conductor ink) per pixel for a grey page render (uint8, white paper)."""
        import numpy as np

        height, width = gray.shape
        tile, overlap = self.tile, self.overlap
        step = tile - 2 * overlap
        padded = np.full((height + 2 * tile, width + 2 * tile), 255, np.float32)
        padded[overlap:overlap + height, overlap:overlap + width] = gray
        out = np.zeros((height, width), np.float32)
        for top in range(0, height, step):
            for left in range(0, width, step):
                window = 1.0 - padded[top:top + tile, left:left + tile] / 255.0
                logits = self.session.run(None, {"ink": window[None, None].astype(np.float32)})[0][0]
                logits = logits - logits.max(axis=0, keepdims=True)
                exp = np.exp(logits)
                probability = exp[1] / exp.sum(axis=0)
                inner = probability[overlap:tile - overlap, overlap:tile - overlap]
                rows, columns = min(step, height - top), min(step, width - left)
                out[top:top + rows, left:left + columns] = inner[:rows, :columns]
        return out


def run_conductor_share(points, probability, reach: int = 2, step: float = 2.0) -> float:
    """Share of a run's centreline samples where the network sees conductor ink nearby."""
    height, width = probability.shape
    seen = total = 0
    for a, b in zip(points, points[1:]):
        length = hypot(b[0] - a[0], b[1] - a[1])
        for index in range(max(1, int(length // step)) + 1):
            t = index / max(1, int(length // step))
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            column, row = int(round(x)), int(round(y))
            if not (0 <= row < height and 0 <= column < width):
                continue
            window = probability[max(0, row - reach):row + reach + 1,
                                 max(0, column - reach):column + reach + 1]
            total += 1
            seen += bool(window.max() >= 0.5)
    return seen / total if total else 0.0


def withdraw_unrecognised_runs(owned, probability) -> int:
    """Turn black every coloured run the network does not recognise as conductor ink."""
    withdrawn = 0
    for run in owned:
        if not run.code or len(run.points) < 2:
            continue
        share = run_conductor_share(run.points, probability)
        if share < MIN_CONDUCTOR_SHARE:
            run.abstained_from_code = run.code
            run.abstain_reason = f"wirenet conductor share {share:.2f}"
            run.abstained = True
            run.code = None
            withdrawn += 1
    return withdrawn
