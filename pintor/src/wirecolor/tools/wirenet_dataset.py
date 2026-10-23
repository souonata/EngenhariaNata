"""Training pages for WireNet, built from the factory-coloured diagrams.

    python -m wirecolor.tools.wirenet_dataset --pages pages.json --out workspaces/wirenet/data

Each page of ``pages.json`` (``{"pdf", "page", "publication"}``) becomes one compressed ``.npz``:

* ``image``: the monochrome twin rendered in grey at the analysis resolution -- what the painter
  sees on a black-and-white manual;
* ``label``: per pixel 0 = paper, 1 = conductor ink, 2 = any other ink (component, text, frame,
  dimension, leader).

The conductor class comes from the factory's own colour: the harvested conductors are drawn alone
at the twin's pen, and the twin's ink under them is conductor ink. Nothing here needs a reviewer.
The publication id travels with every page so training and validation can be split by
publication, never by page.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

DPI = 200
INK_LEVEL = 160


def render_gray(page, dpi=DPI):
    import fitz
    import numpy as np

    pixmap = page.get_pixmap(matrix=fitz.Matrix(dpi / 72.0, dpi / 72.0), colorspace=fitz.csGRAY,
                             alpha=False)
    return np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
        pixmap.height, pixmap.stride)[:, :pixmap.width].copy()


def conductor_mask(source, conductors, pen, shape, dpi=DPI):
    """The harvested conductors alone, drawn at the twin's pen, as a boolean mask.

    Drawn in the source's unrotated space and given its rotation, exactly like the twin.
    """
    import fitz
    import numpy as np

    document = fitz.open()
    page = document.new_page(width=source.cropbox.width, height=source.cropbox.height)
    shape_ = page.new_shape()
    for conductor in conductors:
        for a, b in conductor.segments:
            shape_.draw_line(fitz.Point(*a), fitz.Point(*b))
        shape_.finish(color=(0, 0, 0), width=pen, lineCap=1, closePath=False)
    shape_.commit()
    if source.rotation:
        page.set_rotation(source.rotation)
    gray = render_gray(page, dpi)
    document.close()
    mask = np.zeros(shape, dtype=bool)
    rows, columns = min(shape[0], gray.shape[0]), min(shape[1], gray.shape[1])
    mask[:rows, :columns] = gray[:rows, :columns] < INK_LEVEL
    return mask


def build_page(page) -> dict:
    """Image and label for one factory-coloured page, through its monochrome twin."""
    import cv2
    import fitz
    import numpy as np

    from ..eval.teacher import build_twin, harvest_page

    harvest = harvest_page(page)
    document = fitz.open()
    twin = build_twin(page, harvest, document)
    image = render_gray(twin)
    document.close()
    ink = image < INK_LEVEL
    wires = conductor_mask(page, harvest.conductors, harvest.pen, image.shape)
    # One pixel of slack: anti-aliasing puts the twin's edge pixels a hair outside the mask.
    wires = cv2.dilate(wires.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    label = np.zeros(image.shape, dtype=np.uint8)
    label[ink] = 2
    label[ink & wires] = 1
    return {"image": image, "label": label, "conductors": len(harvest.conductors)}


def main() -> None:
    import fitz
    import numpy as np

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for entry in json.loads(Path(args.pages).read_text(encoding="utf-8")):
        name = f"pub{entry['publication']}_p{entry['page']}.npz"
        target = out / name
        if not target.exists():
            try:
                with fitz.open(entry["pdf"]) as document:
                    page = document[int(entry["page"]) - 1]
                    built = build_page(page)
            except Exception as error:                  # one bad page never stops the build
                print(f"skip {name}: {type(error).__name__}: {error}", flush=True)
                continue
            if built["conductors"] < 8:
                print(f"skip {name}: {built['conductors']} conductors", flush=True)
                continue
            np.savez_compressed(target, image=built["image"], label=built["label"])
            print(f"{name}: {built['image'].shape} conductor px "
                  f"{int((built['label'] == 1).sum())}", flush=True)
        index.append({"file": name, "publication": str(entry["publication"]),
                      "pdf": entry["pdf"], "page": entry["page"]})
    (out / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
