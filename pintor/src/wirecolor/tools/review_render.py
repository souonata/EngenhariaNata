"""Render comparison images from a 2-page review PDF for visual self-review.

    python -m wirecolor.tools.review_render tiles <review.pdf> <outdir> [--zoom 2.8] [--tile 600]
    python -m wirecolor.tools.review_render crop  <review.pdf> <out.png> --at 1889,578 \
        [--half 70] [--zoom 5]

A review PDF is the pink-markup format: page 1 colorized, page 2 the untouched original. Every
image produced here stacks the SAME region twice -- colorized on top, a magenta divider, the
original below -- because a defect is only meaningful against what the drawing actually shows: a
black wire may be unlabelled by design, and a missing band may simply be ink that was never there.

``tiles`` sweeps the whole sheet at page-reading zoom, which is how the human reviewer finds
problems; ``crop`` answers a specific suspicion at detail zoom, which is how a suspicion is
confirmed or dismissed before it is believed.
"""
from __future__ import annotations

import argparse
import json
import os


def _stack(page_colorized, page_original, clip, zoom):
    import fitz
    import numpy as np

    matrix = fitz.Matrix(zoom, zoom)
    top = page_colorized.get_pixmap(matrix=matrix, clip=clip)
    bottom = page_original.get_pixmap(matrix=matrix, clip=clip)
    width = top.width
    canvas = np.zeros((top.height + 6 + bottom.height, width, 3), dtype=np.uint8)
    canvas[:top.height] = np.frombuffer(top.samples, dtype=np.uint8).reshape(
        top.height, width, top.n)[:, :, :3]
    canvas[top.height:top.height + 6] = (255, 0, 255)
    canvas[top.height + 6:] = np.frombuffer(bottom.samples, dtype=np.uint8).reshape(
        bottom.height, width, bottom.n)[:, :, :3]
    return fitz.Pixmap(fitz.csRGB, width, canvas.shape[0], canvas.tobytes(), 0)


def render_tiles(pdf_path, outdir, zoom=2.8, tile_pt=600.0, overlap_pt=30.0):
    import fitz

    os.makedirs(outdir, exist_ok=True)
    doc = fitz.open(pdf_path)
    stem = os.path.splitext(os.path.basename(pdf_path))[0].replace("_review", "")
    colorized, original = doc[0], doc[1]
    width, height = colorized.rect.width, colorized.rect.height
    step = tile_pt - overlap_pt
    cols = max(1, int((width - overlap_pt + step - 1) // step))
    rows = max(1, int((height - overlap_pt + step - 1) // step))
    manifest = {"pdf": os.path.abspath(pdf_path), "page_w_pt": width, "page_h_pt": height,
                "zoom": zoom, "tile_pt": tile_pt, "rows": rows, "cols": cols, "tiles": []}
    for row in range(rows):
        for col in range(cols):
            x0 = min(col * step, max(0, width - tile_pt))
            y0 = min(row * step, max(0, height - tile_pt))
            clip = fitz.Rect(x0, y0, min(x0 + tile_pt, width), min(y0 + tile_pt, height))
            out = os.path.join(outdir, f"{stem}_r{row}c{col}.png")
            _stack(colorized, original, clip, zoom).save(out)
            manifest["tiles"].append({"file": os.path.basename(out), "row": row, "col": col,
                                      "x0_pt": round(x0, 1), "y0_pt": round(y0, 1)})
    path = os.path.join(outdir, f"{stem}_manifest.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=1)
    print(f"{stem}: {rows}x{cols} tiles of {tile_pt:.0f}pt at {zoom}x -> {outdir}")
    return manifest


def render_crop(pdf_path, out, cx_pt, cy_pt, half_pt=70.0, zoom=5.0):
    import fitz

    doc = fitz.open(pdf_path)
    colorized, original = doc[0], doc[1]
    clip = fitz.Rect(max(0, cx_pt - half_pt), max(0, cy_pt - half_pt),
                     min(cx_pt + half_pt, colorized.rect.width),
                     min(cy_pt + half_pt, colorized.rect.height))
    _stack(colorized, original, clip, zoom).save(out)
    print(f"crop ({cx_pt},{cy_pt}) half={half_pt} zoom={zoom} -> {out}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["tiles", "crop"])
    ap.add_argument("pdf")
    ap.add_argument("out")
    ap.add_argument("--zoom", type=float)
    ap.add_argument("--tile", type=float, default=600.0)
    ap.add_argument("--overlap", type=float, default=30.0)
    ap.add_argument("--at", help="crop centre as x,y in PDF points (page px * 0.36)")
    ap.add_argument("--half", type=float, default=70.0)
    args = ap.parse_args()

    if args.mode == "tiles":
        render_tiles(args.pdf, args.out, args.zoom or 2.8, args.tile, args.overlap)
    else:
        if not args.at:
            raise SystemExit("crop mode needs --at x,y")
        cx, cy = (float(part) for part in args.at.split(","))
        render_crop(args.pdf, args.out, cx, cy, args.half, args.zoom or 5.0)


if __name__ == "__main__":
    main()
