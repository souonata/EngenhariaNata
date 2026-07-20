"""Estrae la banca ministeriale e i 50 esercizi di carteggio per il sito statico."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
QUIZ_PDF = ROOT / "sources" / "quiz-ministeriali-dd-131-2022.pdf"
CARTEGGIO_PDF = ROOT / "sources" / "quiz-e-carteggio-dd-10-2022.pdf"
DATA_DIR = ROOT / "data"
FIGURE_DIR = ROOT / "assets" / "quiz-images"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def ocr_figure_number(page, bbox, temp_dir: Path) -> int | None:
    crop_path = temp_dir / "figure-cell.png"
    page.crop(bbox).to_image(resolution=320, antialias=True).save(crop_path)
    result = subprocess.run(
        [str(TESSERACT), str(crop_path), "stdout", "--psm", "6", "-l", "eng"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    ).stdout
    match = re.search(r"(?:figura|figure|fig|fiqua)?\s*([0-9]{1,3})", result, re.I)
    return int(match.group(1)) if match else None


def extract_quiz() -> list[dict]:
    questions: list[dict] = []
    missing_figures: list[int] = []
    with tempfile.TemporaryDirectory() as temp_name, pdfplumber.open(QUIZ_PDF) as pdf:
        temp_dir = Path(temp_name)
        for page in pdf.pages[:279]:
            for table in page.find_tables():
                extracted = table.extract()
                for row_index, values in enumerate(extracted):
                    if not values or len(values) < 13:
                        continue
                    number = clean(values[0])
                    if not number.isdigit() or clean(values[10]).upper() != "BASE":
                        continue

                    qid = int(number)
                    flags = [clean(values[i]).upper() for i in (4, 6, 8)]
                    correct = [i for i, flag in enumerate(flags) if flag == "V"]
                    note = ""
                    if qid == 226:
                        # Il PDF ufficiale marca due alternative come V; l’S-drive è l’alternativa A.
                        correct = [0]
                        note = "Il PDF del DD 131/2022 riporta due marcature V in questa riga; è stata mantenuta come corretta l’alternativa relativa alla trasmissione Sail Drive/S-drive."
                    if len(correct) != 1:
                        raise RuntimeError(f"Quesito {qid}: marcatura della risposta inattesa {flags}")

                    figure = None
                    cell = table.rows[row_index].cells[1]
                    if cell and any(
                        cell[0] <= image["x0"] <= cell[2]
                        and cell[1] <= image["top"] <= cell[3]
                        for image in page.images
                    ):
                        figure = ocr_figure_number(page, cell, temp_dir)
                        if figure is None:
                            missing_figures.append(qid)

                    questions.append(
                        {
                            "id": qid,
                            "code": clean(values[9]),
                            "question": clean(values[2]),
                            "answers": [clean(values[3]), clean(values[5]), clean(values[7])],
                            "correct": correct[0],
                            "theme": clean(values[11]),
                            "topic": clean(values[12]),
                            "figure": figure,
                            "note": note,
                        }
                    )

    questions.sort(key=lambda item: item["id"])
    if len(questions) != 1472:
        raise RuntimeError(f"Attesi 1472 quesiti BASE, estratti {len(questions)}")
    if missing_figures:
        raise RuntimeError(f"OCR non riuscito per le figure dei quesiti: {missing_figures}")
    return questions


def row_major_images(images: list[dict]) -> list[dict]:
    remaining = list(images)
    rows: list[list[dict]] = []
    while remaining:
        seed = min(remaining, key=lambda image: (image["top"] + image["bottom"]) / 2)
        center = (seed["top"] + seed["bottom"]) / 2
        row = [
            image
            for image in remaining
            if abs(((image["top"] + image["bottom"]) / 2) - center) <= 34
        ]
        row.sort(key=lambda image: image["x0"])
        rows.append(row)
        for image in row:
            remaining.remove(image)
    return [image for row in rows for image in row]


def extract_official_figures() -> int:
    if FIGURE_DIR.exists():
        shutil.rmtree(FIGURE_DIR)
    FIGURE_DIR.mkdir(parents=True)
    figure_number = 1
    with pdfplumber.open(QUIZ_PDF) as pdf:
        for page_number in range(280, 287):
            page = pdf.pages[page_number - 1]
            for image in row_major_images(page.images):
                pad = 3
                bbox = (
                    max(0, image["x0"] - pad),
                    max(0, image["top"] - pad),
                    min(page.width, image["x1"] + pad),
                    min(page.height, image["bottom"] + pad),
                )
                output = FIGURE_DIR / f"figura-{figure_number:03d}.png"
                page.crop(bbox).to_image(resolution=180, antialias=True).save(output)
                figure_number += 1
    count = figure_number - 1
    if count != 103:
        raise RuntimeError(f"Attese 103 figure, estratte {count}")
    return count


def exercise_starts(page_text: str) -> list[int]:
    starts: list[int] = []
    lines = page_text.splitlines(keepends=True)
    offsets: list[int] = []
    cursor = 0
    for line in lines:
        offsets.append(cursor)
        cursor += len(line)
    for index, line in enumerate(lines):
        if not re.match(r"^\s*(?:Partenza|Si parte)\b", line):
            continue
        preview = " ".join(lines[index : index + 4])
        if re.search(r"\bore\s+\d{1,2}[:h]\d{2}|\balle ore\s+\d{1,2}", preview, re.I):
            starts.append(offsets[index])
    return starts


def extract_carteggio() -> list[dict]:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        raise RuntimeError("pdftotext non trovato; installa Poppler o MiKTeX per rigenerare il carteggio")
    with tempfile.TemporaryDirectory() as temp_name:
        text_path = Path(temp_name) / "dd10.txt"
        subprocess.run([pdftotext, "-layout", str(CARTEGGIO_PDF), str(text_path)], check=True)
        pages = text_path.read_text(encoding="utf-8", errors="ignore").split("\f")
    sections = [
        (range(162, 167), "Nord-ovest · orizzontale"),
        (range(167, 173), "Nord-ovest · verticale"),
        (range(173, 179), "Sud-est"),
    ]
    exercises: list[dict] = []
    for page_range, sector in sections:
        for page_number in page_range:
            page = pages[page_number - 1]
            starts = exercise_starts(page)
            for index, start in enumerate(starts):
                end = starts[index + 1] if index + 1 < len(starts) else len(page)
                segment = page[start:end]
                if "quesito 1" not in segment.lower():
                    continue
                segment = re.sub(r"[\uf031-\uf039\uf02e]+", "", segment)
                lines = [clean(line) for line in segment.splitlines() if clean(line)]
                solution_index = next(
                    (i for i, line in enumerate(lines) if line.lower().startswith("distanza")),
                    None,
                )
                if solution_index is None:
                    raise RuntimeError(f"Soluzione non trovata a pagina {page_number}")
                prompt = "\n".join(lines[:solution_index])
                solution = "\n".join(lines[solution_index:])
                exercises.append(
                    {
                        "id": len(exercises) + 1,
                        "sector": sector,
                        "sourcePage": page_number,
                        "prompt": prompt,
                        "solution": solution,
                    }
                )
    if len(exercises) != 50:
        raise RuntimeError(f"Attesi 50 esercizi, estratti {len(exercises)}")
    return exercises


def write_js(path: Path, variable: str, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text(f"window.{variable}={serialized};\n", encoding="utf-8")


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    questions = extract_quiz()
    figures = extract_official_figures()
    exercises = extract_carteggio()
    write_js(DATA_DIR / "quiz-base.js", "PATENTE_QUIZ", questions)
    write_js(DATA_DIR / "carteggio.js", "PATENTE_CARTEGGIO", exercises)
    themes: dict[str, int] = {}
    for item in questions:
        themes[item["theme"]] = themes.get(item["theme"], 0) + 1
    print(json.dumps({"questions": len(questions), "figures": figures, "exercises": len(exercises), "themes": themes}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
