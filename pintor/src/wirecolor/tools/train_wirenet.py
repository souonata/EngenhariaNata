"""Train WireNet: a small U-Net that tells conductor ink from every other ink on a wiring page.

    python -m wirecolor.tools.train_wirenet --data workspaces/wirenet/data \
        --val-publications 91,47718008 --out workspaces/wirenet/run1

Training needs PyTorch (``pip install torch``); the painter never does -- it runs the exported
ONNX file through onnxruntime, which the OCR route already ships (see ``engine/wirenet.py``).

What the network may decide is fixed by ``docs/ELECTRICAL_SAFETY_RULES.md``: wire-versus-furniture
is a learnable decision, colour is not. WireNet therefore outputs three classes per pixel --
paper, conductor ink, other ink -- and nothing about colour. The painter uses it only to withdraw
paint from ink the network does not recognise as a conductor, which can turn a colour black and
never one colour into another.

Pages are split by publication: a sheet and its neighbours in the same manual share a draughtsman,
a symbol library and a pen, and a page-level split would measure memory, not generalisation.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import random
import time

CLASSES = 3            # 0 paper, 1 conductor ink, 2 other ink
TILE = 256


def build_model(base: int = 16, depth: int = 5):
    import torch
    from torch import nn

    def block(c_in, c_out):
        return nn.Sequential(
            nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out),
            nn.ReLU(inplace=True),
            nn.Conv2d(c_out, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out),
            nn.ReLU(inplace=True))

    class UNet(nn.Module):
        def __init__(self):
            super().__init__()
            widths = [base * 2 ** level for level in range(depth)]
            self.down = nn.ModuleList()
            c_in = 1
            for width in widths:
                self.down.append(block(c_in, width))
                c_in = width
            self.pool = nn.MaxPool2d(2)
            self.up = nn.ModuleList()
            self.merge = nn.ModuleList()
            for width in reversed(widths[:-1]):
                self.up.append(nn.ConvTranspose2d(c_in, width, 2, stride=2))
                self.merge.append(block(width * 2, width))
                c_in = width
            self.head = nn.Conv2d(c_in, CLASSES, 1)

        def forward(self, x):
            skips = []
            for index, layer in enumerate(self.down):
                x = layer(x)
                if index < len(self.down) - 1:
                    skips.append(x)
                    x = self.pool(x)
            for up, merge in zip(self.up, self.merge):
                x = up(x)
                x = merge(torch.cat([x, skips.pop()], dim=1))
            return self.head(x)

    return UNet()


def _augment(image, label, rng):
    """Geometry, pen weight, blur and noise: a vector twin made to look like any manual."""
    import cv2
    import numpy as np

    k = rng.randrange(4)
    image, label = np.rot90(image, k).copy(), np.rot90(label, k).copy()
    if rng.random() < 0.5:
        image, label = image[:, ::-1].copy(), label[:, ::-1].copy()
    if rng.random() < 0.4:
        # Heavier or lighter pen: grow or shrink the ink, and give new ink its neighbour's class.
        kernel = np.ones((3, 3), np.uint8)
        if rng.random() < 0.6:
            image = cv2.erode(image, kernel)
            # A pixel the heavier pen adds belongs to the conductor it grew from, if any.
            near_wire = cv2.dilate((label == 1).astype(np.uint8), kernel).astype(bool)
            fresh = (label == 0) & (image < 160)
            label = label.copy()
            label[fresh & near_wire] = 1
            label[fresh & ~near_wire] = 2
        else:
            image = cv2.dilate(image, kernel)
            label = np.where(image >= 160, 0, label).astype(np.uint8)
    image = image.astype(np.float32)
    if rng.random() < 0.5:
        image = cv2.GaussianBlur(image, (0, 0), rng.uniform(0.3, 1.2))
    if rng.random() < 0.5:
        image = image + np.random.normal(0, rng.uniform(2, 14), image.shape).astype(np.float32)
    if rng.random() < 0.3:
        low, high = rng.uniform(0, 60), rng.uniform(190, 255)
        image = low + (image / 255.0) * (high - low)
    if rng.random() < 0.15:
        image = np.where(image < rng.uniform(110, 190), 0.0, 255.0).astype(np.float32)
    return np.clip(image, 0, 255), label


class TileSampler:
    """Random tiles, most of them centred on ink so paper does not dominate the batches."""

    def __init__(self, pages, rng, augment=True):
        import numpy as np

        self.pages = pages
        self.rng = rng
        self.augment = augment
        self.ink = [np.argwhere(page["label"] > 0) for page in pages]
        weights = [len(ink) for ink in self.ink]
        total = float(sum(weights)) or 1.0
        self.weights = [weight / total for weight in weights]

    def tile(self):
        import numpy as np

        index = self.rng.choices(range(len(self.pages)), weights=self.weights)[0]
        page = self.pages[index]
        height, width = page["image"].shape
        if self.rng.random() < 0.85 and len(self.ink[index]):
            row, column = self.ink[index][self.rng.randrange(len(self.ink[index]))]
        else:
            row, column = self.rng.randrange(height), self.rng.randrange(width)
        top = int(min(max(0, row - TILE // 2), max(0, height - TILE)))
        left = int(min(max(0, column - TILE // 2), max(0, width - TILE)))
        image = np.full((TILE, TILE), 255, np.uint8)
        label = np.zeros((TILE, TILE), np.uint8)
        crop = page["image"][top:top + TILE, left:left + TILE]
        image[:crop.shape[0], :crop.shape[1]] = crop
        label[:crop.shape[0], :crop.shape[1]] = page["label"][top:top + TILE, left:left + TILE]
        if self.augment:
            return _augment(image, label, self.rng)
        return image.astype(np.float32), label


def predict_page(model, image, device, tile=512, overlap=48):
    """Class probabilities for a whole page, tiled with overlap; returns (3, H, W)."""
    import numpy as np
    import torch

    height, width = image.shape
    step = tile - 2 * overlap
    out = np.zeros((CLASSES, height, width), np.float32)
    padded = np.full((height + 2 * tile, width + 2 * tile), 255, np.float32)
    padded[overlap:overlap + height, overlap:overlap + width] = image
    model.eval()
    with torch.no_grad():
        for top in range(0, height, step):
            for left in range(0, width, step):
                window = padded[top:top + tile, left:left + tile]
                x = torch.from_numpy((1.0 - window / 255.0)[None, None]).to(device)
                probs = torch.softmax(model(x), dim=1)[0].float().cpu().numpy()
                inner = probs[:, overlap:tile - overlap, overlap:tile - overlap]
                rows = min(step, height - top)
                columns = min(step, width - left)
                out[:, top:top + rows, left:left + columns] = inner[:, :rows, :columns]
    return out


def evaluate(model, pages, device) -> dict:
    """Over every ink pixel of the validation pages: is conductor ink told from other ink?"""
    import numpy as np

    tp = fp = fn = correct = total = 0
    for page in pages:
        probs = predict_page(model, page["image"].astype(np.float32), device)
        ink = page["label"] > 0
        predicted = probs[1] > probs[2]
        truth = page["label"] == 1
        tp += int((predicted & truth & ink).sum())
        fp += int((predicted & ~truth & ink).sum())
        fn += int((~predicted & truth & ink).sum())
        correct += int(((predicted == truth) & ink).sum())
        total += int(ink.sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"conductor_precision": round(precision, 4), "conductor_recall": round(recall, 4),
            "conductor_f1": round(f1, 4), "ink_accuracy": round(correct / total, 4) if total else 0}


def export_onnx(model, path: Path) -> None:
    import torch

    model.eval().cpu()
    dummy = torch.zeros(1, 1, 256, 256)
    torch.onnx.export(model, dummy, str(path), input_names=["ink"], output_names=["logits"],
                      dynamic_axes={"ink": {2: "height", 3: "width"},
                                    "logits": {2: "height", 3: "width"}},
                      opset_version=17)


def main() -> None:
    import numpy as np
    import torch

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True)
    parser.add_argument("--val-publications", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--steps", type=int, default=6000)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-3)
    parser.add_argument("--base", type=int, default=16)
    parser.add_argument("--seed", type=int, default=20261022)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    torch.manual_seed(args.seed)
    data = Path(args.data)
    index = json.loads((data / "index.json").read_text(encoding="utf-8"))
    held_out = {value.strip() for value in args.val_publications.split(",") if value.strip()}
    train, val = [], []
    for entry in index:
        with np.load(data / entry["file"]) as arrays:
            page = {"image": arrays["image"], "label": arrays["label"], **entry}
        (val if entry["publication"] in held_out else train).append(page)
    train_pubs = sorted({page["publication"] for page in train})
    print(f"train {len(train)} pages / {len(train_pubs)} publications; "
          f"val {len(val)} pages / {sorted(held_out)}", flush=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(base=args.base).to(device)
    print(f"device {device}, parameters {sum(p.numel() for p in model.parameters()):,}",
          flush=True)
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, max_lr=args.lr,
                                                   total_steps=args.steps)
    weights = torch.tensor([0.05, 1.0, 1.0], device=device)
    sampler = TileSampler(train, rng)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    best, history, started = -1.0, [], time.time()
    scaler = torch.amp.GradScaler(enabled=device.type == "cuda")
    for step in range(1, args.steps + 1):
        model.train()
        tiles = [sampler.tile() for _ in range(args.batch)]
        x = torch.from_numpy(np.stack([1.0 - image / 255.0 for image, _ in tiles])[:, None]
                             .astype(np.float32)).to(device)
        y = torch.from_numpy(np.stack([label for _, label in tiles]).astype(np.int64)).to(device)
        with torch.autocast(device.type, enabled=device.type == "cuda"):
            logits = model(x)
            loss = torch.nn.functional.cross_entropy(logits, y, weight=weights)
        optimiser.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(optimiser)
        scaler.update()
        schedule.step()
        if step % 250 == 0 or step == args.steps:
            row = {"step": step, "loss": round(float(loss), 4),
                   "seconds": round(time.time() - started)}
            if step % 1000 == 0 or step == args.steps:
                row.update(evaluate(model, val, device))
                if row["conductor_f1"] > best:
                    best = row["conductor_f1"]
                    torch.save(model.state_dict(), out / "wirenet.pt")
            history.append(row)
            print(json.dumps(row), flush=True)
    model.load_state_dict(torch.load(out / "wirenet.pt", map_location="cpu"))
    export_onnx(model, out / "wirenet.onnx")
    (out / "training.json").write_text(json.dumps({
        "train_publications": train_pubs, "val_publications": sorted(held_out),
        "args": vars(args), "best_val_conductor_f1": best, "history": history,
    }, indent=1), encoding="utf-8")
    print(f"best val conductor F1 {best}; exported {out / 'wirenet.onnx'}", flush=True)


if __name__ == "__main__":
    main()
