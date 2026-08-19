"""Deterministic output validators.

P1 ships the two preservation-critical checks; the full V1-V8 stack lands in P3.

V2  protected-region overlap: no overlay alpha inside a housing expanded by TERM_GAP
    (knockout makes this true by construction -- the validator re-measures it on the final
    overlay so a knockout regression can never ship).
V7  preservation: the output PDF must contain the original byte-for-byte as a prefix
    (incremental save), every original image XObject on the page must hash identically,
    and rendering the output with the overlay layer OFF must reproduce the original render
    pixel-for-pixel (layer-toggle fallback: skip with a warning if the PyMuPDF build cannot
    switch OC state -- the two byte-level checks still hold).
"""
from __future__ import annotations

import hashlib

import numpy as np

from ..paint.legacy import TERM_GAP

# Luminance difference above which a pixel cannot be antialiasing. Measured on a dense A0 vector
# sheet (58,828 strokes): with the overlay OFF the residual peaks at 16 levels and is scattered,
# while painted pixels reach 255 over hundreds of thousands of contiguous pixels. 32 sits an
# order of magnitude below paint and twice above the observed antialiasing ceiling.
LUMA_DELTA_LIMIT = 32

# How many pixels may exceed that luma delta before it is a greyscale LEAK rather than antialiasing.
# The overlay is ONE OCG: if its colour toggles off cleanly (chroma_pixels == 0) its black pixels are
# gone too, so a residual luma delta cannot be paint leaking -- it is re-render antialiasing on the
# original's own edges. That jitter is, in the validator author's words, "a handful of stray pixels",
# while a real greyscale band is hundreds of thousands. Measured: a normal A0 stays at 0 above the
# limit; a foreign A0 with a hatched title-block logo (pub2505) scatters ~150 lightened edge pixels,
# none at the overlay's footprint. 2000 sits two orders of magnitude below any real band and an order
# above the worst jitter, so it changes no clean sheet (all sit at 0) and stops the false alarm.
LUMA_AREA_LIMIT = 2000

# Chroma difference below which a pixel is re-render noise rather than paint. An earlier version
# required chroma to be EXACTLY unchanged, generalised from a single sheet. Measured across four
# sheets that is false: re-rendering alone shifts chroma by up to 3, and one page produced a
# nonzero chroma delta while painting NOTHING at all -- proof the residual is not paint. Painted
# pixels reach 240, so 8 sits 80x below paint and well above the observed noise. The verdict then
# uses the pixel COUNT above this floor, not the maximum: noise is a handful of stray pixels,
# whereas paint is hundreds of thousands.
CHROMA_NOISE_FLOOR = 8


def _rgb(pixmap) -> np.ndarray:
    """Pixmap samples as an (h, w, 3) int16 array, alpha dropped."""
    array = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
        pixmap.height, pixmap.width, pixmap.n).astype(np.int16)
    return array[:, :, :3]


def _chroma(rgb: np.ndarray) -> np.ndarray:
    """How colourful each pixel is: 0 for any grey, large for saturated paint."""
    return rgb.max(axis=2) - rgb.min(axis=2)


def v2_protected_overlap(rgba: np.ndarray, solution: dict, transform) -> dict:
    """Sum of overlay alpha inside protected housings and inline components."""
    alpha = rgba[:, :, 3]
    Hc, Wc = alpha.shape
    bad = 0
    for hx, hy, hw, hh in solution["housings"]:
        x0, y0, ww, hh2 = transform.rect(hx - TERM_GAP, hy - TERM_GAP,
                                         hw + 2 * TERM_GAP, hh + 2 * TERM_GAP)
        sub = alpha[max(0, round(y0)):min(Hc, round(y0 + hh2)),
                    max(0, round(x0)):min(Wc, round(x0 + ww))]
        bad += int(np.count_nonzero(sub))
    for x1, y1, x2, y2, radius in solution.get("inline_components", ()):
        probe = np.zeros_like(alpha)
        a = tuple(round(v) for v in transform.pt(x1, y1))
        b = tuple(round(v) for v in transform.pt(x2, y2))
        r = round(radius * transform.s)
        import cv2
        cv2.line(probe, a, b, 255, 2 * r, cv2.LINE_8)
        cv2.circle(probe, a, r, 255, -1)
        cv2.circle(probe, b, r, 255, -1)
        bad += int(np.count_nonzero(alpha[probe > 0]))
    return dict(name="V2", passed=bad == 0, painted_px_in_protected=bad)


def v2_vector_protected_overlap(rgba: np.ndarray, protected_zones, analysis_dpi: int,
                                paint_dpi: int) -> dict:
    """No vector overlay alpha inside the interior of a detected component symbol.

    Vector zones are measured in analysis pixels while the overlay may be rendered at a much
    higher DPI. A narrow edge margin excludes antialiasing where a conductor legitimately ends at
    a symbol boundary; paint in the symbol interior remains a categorical failure.
    """
    alpha = rgba[:, :, 3]
    height, width = alpha.shape
    factor = paint_dpi / float(analysis_dpi)
    margin = max(2, round(2.0 * factor))
    bad = 0
    checked = 0
    for x0, y0, x1, y1 in protected_zones:
        left = max(0, round(x0 * factor) + margin)
        top = max(0, round(y0 * factor) + margin)
        right = min(width, round(x1 * factor) - margin)
        bottom = min(height, round(y1 * factor) - margin)
        if right <= left or bottom <= top:
            continue
        checked += 1
        bad += int(np.count_nonzero(alpha[top:bottom, left:right]))
    return dict(name="V2-vector", passed=bad == 0, protected_zones_checked=checked,
                painted_px_in_protected=bad)


def _sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def v7_preservation(src_pdf: str, out_pdf: str, page_index: int, ocg_name: str) -> dict:
    import fitz

    # 1) byte-prefix: incremental save appends, never rewrites.
    prefix_ok = True
    with open(src_pdf, "rb") as fs, open(out_pdf, "rb") as fo:
        while True:
            a = fs.read(1 << 20)
            if not a:
                break
            b = fo.read(len(a))
            if a != b:
                prefix_ok = False
                break

    # 2) original image XObjects untouched.
    ds, do = fitz.open(src_pdf), fitz.open(out_pdf)
    src_hashes = sorted(_sha(ds.extract_image(im[0])["image"])
                        for im in ds[page_index].get_images(full=True))
    out_imgs = do[page_index].get_images(full=True)
    out_hashes = sorted(_sha(do.extract_image(im[0])["image"]) for im in out_imgs)
    # the overlay adds image(s); every ORIGINAL hash must still be present.
    imgs_ok = all(h in out_hashes for h in src_hashes)
    do.close()

    # 3) overlay layer off -> render identical to the original. The layer toggle only affects
    # pages loaded AFTER it (MuPDF caches page OC state on first load, and step 2 above loads
    # the page), so the toggle runs on a FRESH document handle before any page access.
    # set_layer() alone is also not enough -- only the UI-config toggle switches visibility
    # (both verified empirically on PyMuPDF 1.2x / pub 2550).
    render_ok, render_checked = True, False
    render_delta = chroma_delta = chroma_pixels = luma_pixels = None
    try:
        # purge MuPDF's GLOBAL object store first: cached pages/images from earlier renders of
        # the same file in this process make the OC toggle silently ineffective (seen on pub
        # 2476 in-flow: FAIL in p1_run, PASS standalone).
        fitz.TOOLS.store_shrink(100)
        do = fitz.open(out_pdf)
        for cfg in do.layer_ui_configs():
            if cfg.get("text") == ocg_name:
                do.set_layer_ui_config(cfg["number"], 2)      # action 2 = OFF
                mat = fitz.Matrix(1, 1)
                p_src = ds[page_index].get_pixmap(matrix=mat)
                p_out = do[page_index].get_pixmap(matrix=mat)
                if p_src.samples == p_out.samples:
                    render_delta = chroma_delta = chroma_pixels = luma_pixels = 0
                else:
                    # Exact byte equality is unusable on VECTOR artwork: re-rendering after the
                    # incremental save shifts antialiased edges, and on a dense A0 sheet that is
                    # ~3% of pixels by up to 16 levels. A grey-level tolerance alone would then be
                    # a fudge factor.
                    #
                    # Instead, split the comparison by what the two effects physically are.
                    # Antialiasing on monochrome artwork moves all three channels together, so it
                    # is NEUTRAL and changes no pixel's chroma; paint adds colour. Measured on that
                    # same sheet: with the layer off the chroma difference is exactly 0, and with
                    # it on it reaches 240 across 249,333 pixels. So chroma is compared at ZERO
                    # tolerance -- no fudge at all -- and luminance only has to rule out a
                    # greyscale band, which chroma cannot see.
                    a = _rgb(p_src)
                    b = _rgb(p_out)
                    if a.shape != b.shape:
                        render_delta = chroma_delta = chroma_pixels = 255
                        luma_pixels = LUMA_AREA_LIMIT + 1        # a size mismatch is a real failure
                    else:
                        luma = np.abs(a - b).max(axis=2)
                        render_delta = int(luma.max())
                        luma_pixels = int((luma > LUMA_DELTA_LIMIT).sum())
                        difference = np.abs(_chroma(a) - _chroma(b))
                        chroma_delta = int(difference.max())
                        chroma_pixels = int((difference > CHROMA_NOISE_FLOOR).sum())
                # a greyscale LEAK is a band of pixels, not a scatter: judge by AREA, not the max,
                # so a few lightened antialiased edges on a dense sheet cannot fail preservation
                loud = luma_pixels > LUMA_AREA_LIMIT
                render_ok = (chroma_pixels == 0) and not loud
                render_checked = True
                break
        do.close()
    except Exception as exc:                                  # noqa: BLE001
        print(f"V7: layer-off render check unavailable ({exc}); byte checks still enforced")

    ds.close()
    # An UNRUN render check is a FAILURE, not a pass. Previously render_ok stayed True when the
    # OCG was never found (or the toggle raised), so the one check that actually proves the
    # original artwork still renders identically could silently not run and the sheet still
    # reported V7 passed -- exactly inverted for the guarantee this validator exists to give.
    return dict(name="V7", passed=prefix_ok and imgs_ok and render_ok and render_checked,
                byte_prefix=prefix_ok, original_images_kept=imgs_ok,
                render_checked=render_checked, max_render_delta=render_delta,
                max_chroma_delta=chroma_delta, chromatic_pixels=chroma_pixels,
                luma_leak_pixels=luma_pixels,
                layer_off_render_identical=(render_ok if render_checked else None))
