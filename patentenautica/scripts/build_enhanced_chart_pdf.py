#!/usr/bin/env python3
"""Build a higher-DPI Carta 5/D PDF without changing page geometry."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

Image.MAX_IMAGE_PIXELS = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-pdf", required=True, type=Path)
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def embedded_image_dimensions(page) -> tuple[int, int]:
    xobjects = page["/Resources"]["/XObject"].get_object()
    images = [
        item.get_object()
        for item in xobjects.values()
        if item.get_object().get("/Subtype") == "/Image"
    ]
    if len(images) != 1:
        raise ValueError(f"Attesa una sola immagine incorporata, trovate {len(images)}.")
    return int(images[0]["/Width"]), int(images[0]["/Height"])


def main() -> None:
    args = parse_args()
    source_page = PdfReader(str(args.source_pdf)).pages[0]
    page_width = float(source_page.mediabox.width)
    page_height = float(source_page.mediabox.height)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    document = canvas.Canvas(
        str(args.output),
        pagesize=(page_width, page_height),
        pageCompression=1,
    )
    document.setTitle("Carta 5D - 340 DPI migliorata")
    document.setAuthor("Engenharia NATA")
    document.setSubject(
        "Copia didattica ad alta risoluzione; geometria e contenuto invariati"
    )
    document.drawImage(
        ImageReader(str(args.image)),
        0,
        0,
        width=page_width,
        height=page_height,
        preserveAspectRatio=False,
        mask=None,
    )
    document.showPage()
    document.save()

    result = PdfReader(str(args.output))
    if len(result.pages) != 1:
        raise ValueError("Il PDF migliorato deve contenere una sola pagina.")
    result_page = result.pages[0]
    result_size = (
        float(result_page.mediabox.width),
        float(result_page.mediabox.height),
    )
    if result_size != (page_width, page_height):
        raise ValueError(f"Dimensioni pagina modificate: {result_size}.")
    image_size = embedded_image_dimensions(result_page)
    if image_size != (15002, 9688):
        raise ValueError(f"Dimensioni raster inattese: {image_size}.")

    print(
        f"Carta PDF migliorata: {args.output} "
        f"({image_size[0]}x{image_size[1]} px, pagina {page_width}x{page_height} pt)"
    )


if __name__ == "__main__":
    main()
