"""Pintor's standalone wiring-diagram colourization engine.

The generation-3 decision path combines page-level topology, hard constraints, a calibrated
lightweight classifier over atomic conductor pieces, and explicit abstention.

Package layout:
    labels/       label parsing, OCR, filtering (conventions loader lives here too)
    conventions/  colour-code convention registries (JSON data files)
    detect/       housings, junction dots, skeleton/arcs, global net-solver, dashed cables
    paint/        PDF overlay renderers
    pipeline.py   raster compatibility pipeline
    tools/        painter, review, evaluation, and learning commands
"""

__version__ = "3.0.0"
