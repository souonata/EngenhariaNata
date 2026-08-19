"""Working-scale rendering + working<->native geometry transform.

Detection always runs at the v1-validated WORKING SCALE: the page rendered with PyMuPDF at
Matrix(200/72) -- the scale every tuned constant in detect/ assumes. Painting happens at
NATIVE resolution (the embedded raster's own pixel grid, or vector points): geometry from the
working solve is mapped up by a simple similarity transform.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

WORKING_DPI = 200


def render_working_png(pdf_path: str, page_index: int, out_png: str) -> dict:
    """Render one page at the working scale (the exact v1 render call). Returns page metadata
    needed downstream: working pixel size, page rect (pt), rotation, native image info."""
    import fitz
    doc = fitz.open(pdf_path)
    page = doc[page_index]
    pix = page.get_pixmap(matrix=fitz.Matrix(WORKING_DPI / 72.0, WORKING_DPI / 72.0))
    pix.save(out_png)
    meta = dict(
        working_w=pix.width, working_h=pix.height,
        page_w=page.rect.width, page_h=page.rect.height,
        rotation=page.rotation,
        native=native_image_info(doc, page),
    )
    doc.close()
    return meta


def native_image_info(doc, page) -> dict | None:
    """The single full-page embedded raster of a bitonal wiring sheet (None for vector pages).
    When several images exist, take the largest by pixel count."""
    best = None
    for im in page.get_images(full=True):
        xr = doc.extract_image(im[0])
        if best is None or xr["width"] * xr["height"] > best["width"] * best["height"]:
            best = dict(xref=im[0], width=xr["width"], height=xr["height"],
                        ext=xr["ext"], colorspace=xr["colorspace"], bpc=xr["bpc"])
    return best


@dataclass(frozen=True)
class Transform:
    """Similarity map from working-render pixels to the native paint canvas pixels.

    The native canvas spans the same page area as the working render (both are plain scalings
    of the displayed page), so the map is a pure per-axis scale. `s` is the average scale,
    used to scale stroke widths and gap margins.
    """
    sx: float
    sy: float

    @property
    def s(self) -> float:
        return (self.sx + self.sy) / 2.0

    def pt(self, x: float, y: float) -> tuple:
        return (x * self.sx, y * self.sy)

    def rect(self, x: float, y: float, w: float, h: float) -> tuple:
        return (x * self.sx, y * self.sy, w * self.sx, h * self.sy)


def native_canvas_size(meta: dict) -> tuple:
    """Native paint-canvas dimensions: the embedded image's own resolution mapped to the full
    page (so the canvas aligns with the working render's page coverage). Falls back to the
    working size (scale 1.0) when the page has no usable embedded raster."""
    nat = meta.get("native")
    ww, wh = meta["working_w"], meta["working_h"]
    if not nat:
        return ww, wh
    # scale = native image px per working px, derived from the dominant axis to be robust to
    # small margins around the embedded image on the page.
    s = max(nat["width"] / ww, nat["height"] / wh)
    if s <= 1.0:                      # never paint BELOW working resolution
        return ww, wh
    return round(ww * s), round(wh * s)


def make_transform(meta: dict) -> Transform:
    nw, nh = native_canvas_size(meta)
    return Transform(sx=nw / meta["working_w"], sy=nh / meta["working_h"])
