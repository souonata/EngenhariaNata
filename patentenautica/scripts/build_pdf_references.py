#!/usr/bin/env python3
"""Build a static question-to-page index for the 2011 nautical handbook."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
QUIZ_PATH = ROOT / "data" / "quiz-base.js"
PDF_PATH = ROOT / "Dispensa patente nautica 12M.pdf"
OUTPUT_PATH = ROOT / "data" / "question-references.json"

STOPWORDS = {
    "agli",
    "alla",
    "alle",
    "allo",
    "anche",
    "avere",
    "come",
    "con",
    "cosa",
    "dalla",
    "dalle",
    "dallo",
    "degli",
    "dei",
    "del",
    "della",
    "delle",
    "dello",
    "deve",
    "dove",
    "essere",
    "gli",
    "nella",
    "nelle",
    "nello",
    "non",
    "per",
    "piu",
    "puo",
    "quale",
    "quali",
    "quando",
    "sono",
    "sua",
    "sul",
    "sulla",
    "sulle",
    "tra",
    "una",
    "uno",
    "viene",
}


SECTIONS = {
    "scafo": ("Strutture principali dello scafo", "Estruturas principais do casco"),
    "timone-elica": ("Timone, elica ed effetti evolutivi", "Leme, hélice e efeitos evolutivos"),
    "motori": ("Motori marini e piccole avarie", "Motores marítimos e pequenas avarias"),
    "sicurezza": ("Dotazioni e sicurezza", "Equipamentos e segurança"),
    "incendio": ("Sinistri e incendio", "Sinistros e incêndio"),
    "soccorso": ("Soccorso e abbandono", "Socorro e abandono"),
    "maltempo": ("Navigazione con cattivo tempo", "Navegação com mau tempo"),
    "colreg": ("Prevenzione degli abbordi", "Prevenção de abalroamentos"),
    "fanali": ("Fanali e segnali diurni", "Luzes e sinais diurnos"),
    "costa": ("Navigazione in prossimità della costa", "Navegação próxima da costa"),
    "ancoraggio": ("Ancoraggio", "Fundeio"),
    "meteo": ("Meteorologia e bollettini", "Meteorologia e boletins"),
    "coordinate": ("Coordinate geografiche", "Coordenadas geográficas"),
    "carte": ("Carte nautiche e Mercatore", "Cartas náuticas e Mercator"),
    "bussola": ("Bussole magnetiche", "Bússolas magnéticas"),
    "strumenti": ("Solcometri, scandagli e GPS", "Odômetros, sondas e GPS"),
    "stima": ("Navigazione stimata, vento e corrente", "Navegação estimada, vento e corrente"),
    "costiera": ("Navigazione costiera e rilevamenti", "Navegação costeira e marcações"),
    "carteggio": ("Elementi di carteggio", "Elementos de carteggio"),
    "pubblicazioni": ("Portolano ed elenco dei fari", "Roteiro náutico e lista de faróis"),
    "normativa": ("Normativa e responsabilità del comandante", "Legislação e responsabilidade do comandante"),
    "documenti": ("Documenti da tenere a bordo", "Documentos de bordo"),
    "sci": ("Sci nautico", "Esqui aquático"),
}


def rule(section: str, pages: range | list[int], coverage: str = "direct") -> dict:
    return {"section": section, "pages": list(pages), "coverage": coverage}


TOPIC_RULES = {
    ("TEORIA DELLO SCAFO", "Nomenclatura delle parti principali dello scafo"): rule("scafo", range(3, 5)),
    ("TEORIA DELLO SCAFO", "Effetti evolutivi dell'elica e del timone. Elementi di stabilità dell'unità."): rule("timone-elica", [3, 4, 7, 8, 9, 10]),
    ("MOTORI", "Elementi di funzionamento dei sistemi di propulsione a motore"): rule("motori", [20, 21]),
    ("MOTORI", "Irregolarità, piccole avarie e modo di rimediarvi"): rule("motori", [20, 21]),
    ("MOTORI", "Calcolo dell'autonomia"): rule("motori", [21]),
    ("MOTORI", "Irregolarità e piccole avarie che possono prevedere un intervento non specialistico"): rule("motori", [20, 21]),
    ("MOTORI", "Calcolo dell'autonomia in relazione alla potenza del motore ed alla quantità residua di carburante"): rule("motori", [21]),
    ("SICUREZZA DELLA NAVIGAZIONE", "Prevenzione degli incendi e uso degli estintori"): rule("incendio", range(25, 29)),
    ("SICUREZZA DELLA NAVIGAZIONE", "Rischi derivanti dalla conduzione dell'unità sotto l'influenza di alcol o in stato di alterazione psico-fisica per l'uso di sostanze stupefacenti o psicotrope"): rule("normativa", [66, 67], "related"),
    ("SICUREZZA DELLA NAVIGAZIONE", "Dotazioni di sicurezza e mezzi di salvataggio"): rule("sicurezza", range(22, 25)),
    ("SICUREZZA DELLA NAVIGAZIONE", "Tipi di visite, loro periodicità e certificazioni"): rule("sicurezza", [22, 24, 66], "related"),
    ("SICUREZZA DELLA NAVIGAZIONE", "Comunicazioni radiotelefoniche e relative procedure: assistenza e soccorso"): rule("soccorso", [29, 30]),
    ("SICUREZZA DELLA NAVIGAZIONE", "Provvedimenti da adottare in caso di sinistro marittimo (incendio, collisione, falla, incaglio, uomo a mare)"): rule("incendio", range(25, 31)),
    ("SICUREZZA DELLA NAVIGAZIONE", "Sinistro e abbandono dell'unità"): rule("soccorso", [29, 30]),
    ("SICUREZZA DELLA NAVIGAZIONE", "Centro Internazionale Radio Medico (CIRM)."): rule("soccorso", [29, 30], "related"),
    ("SICUREZZA DELLA NAVIGAZIONE", "Precauzioni da adottare in caso di navigazione con tempo cattivo"): rule("maltempo", [31]),
    ("SICUREZZA DELLA NAVIGAZIONE", "Corretto uso degli apparati radio di bordo e chiamate di soccorso"): rule("soccorso", [29, 30]),
    ("MANOVRA E CONDOTTA", "Precauzioni all'ingresso e all'uscita dei porti"): rule("costa", [39, 40, 60], "related"),
    ("MANOVRA E CONDOTTA", "Navigazione in prossimità della costa"): rule("costa", [39, 40]),
    ("MANOVRA E CONDOTTA", "Ancoraggio"): rule("ancoraggio", range(40, 45)),
    ("MANOVRA E CONDOTTA", "Ormeggio e disormeggio"): rule("ancoraggio", [40, 44], "related"),
    ("COLREG E SEGNALAMENTO MARITTIMO", "Fanali e segnali diurni"): rule("fanali", range(33, 40)),
    ("COLREG E SEGNALAMENTO MARITTIMO", "Prevenire gli abbordi in mare"): rule("colreg", [32, 33]),
    ("COLREG E SEGNALAMENTO MARITTIMO", "I principali fanali luminosi e il sistema IALA"): rule("fanali", list(range(33, 40)) + [64, 65], "related"),
    ("METEOROLOGIA", "Elementi di meteorologia e strumenti"): rule("meteo", range(45, 50)),
    ("METEOROLOGIA", "Bollettini meteorologici e previsioni locali"): rule("meteo", range(45, 50)),
    ("METEOROLOGIA", "Venti"): rule("meteo", range(45, 50)),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Coordinate geografiche"): rule("coordinate", range(50, 54)),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Carte nautiche e proiezione di Mercatore"): rule("carte", range(54, 57)),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Navigazione elettronica"): rule("strumenti", [52, 53, 59, 60], "related"),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Orientamento e rosa dei venti"): rule("carte", [53, 56, 57, 58, 59]),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Bussole magnetiche"): rule("bussola", [57, 58, 59]),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Elementi di navigazione stimata: tempo, spazio e velocità"): rule("stima", [53, 59, 60, 61, 64, 65]),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Elementi di navigazione costiera"): rule("costiera", [62, 63]),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Prora e rotta, scarroccio e deriva per effetto del vento e della corrente"): rule("stima", [60, 61, 64, 65]),
    ("NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA", "Pubblicazioni"): rule("pubblicazioni", [64, 65]),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Leggi e regolamenti"): rule("normativa", [65, 66, 67], "related"),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Comandante, conduttore, utilizzatore"): rule("normativa", [65, 66, 67], "related"),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Attvità commerciale"): rule("normativa", [65, 66, 67], "related"),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Documenti"): rule("documenti", [22, 66]),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Attività commerciale"): rule("normativa", [65, 66, 67], "related"),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", ""): rule("normativa", [65, 66, 67], "related"),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Sci nautico"): rule("sci", [39, 40, 66, 67]),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Pesca"): rule("costa", [39, 40, 66, 67], "related"),
    ("NORMATIVA DIPORTISTICA E AMBIENTALE", "Norme ambientali"): rule("costa", [39, 40, 66, 67], "related"),
}


def normalize(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(char) != "Mn"
    )


def stem(token: str) -> str:
    for suffix in ("amente", "imenti", "imento", "azioni", "azione", "mente", "zioni", "zione"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 5:
            token = token[: -len(suffix)]
            break
    if len(token) > 6 and token[-1] in "aeio":
        token = token[:-1]
    return token[:10]


def tokens(value: str) -> list[str]:
    raw = re.findall(r"[a-z0-9]+", normalize(value))
    return [stem(token) for token in raw if len(token) >= 4 and token not in STOPWORDS]


def load_quiz() -> list[dict]:
    source = QUIZ_PATH.read_text(encoding="utf-8").strip()
    prefix = "window.PATENTE_QUIZ="
    if not source.startswith(prefix):
        raise ValueError("Unexpected quiz data wrapper")
    return json.loads(source[len(prefix) :].removesuffix(";"))


def page_lines(page) -> list[tuple[float, str]]:
    words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
    grouped: dict[int, list[dict]] = defaultdict(list)
    for word in words:
        grouped[round(float(word["top"]) / 4)].append(word)
    lines = []
    for row in sorted(grouped):
        row_words = sorted(grouped[row], key=lambda item: float(item["x0"]))
        lines.append((min(float(item["top"]) for item in row_words), " ".join(item["text"] for item in row_words)))
    return lines


def best_line_top(lines: list[tuple[float, str]], query: set[str], idf: dict[str, float]) -> int:
    best_score = -1.0
    best_top = 0
    for index in range(len(lines)):
        window = " ".join(text for _, text in lines[index : index + 3])
        overlap = query & set(tokens(window))
        score = sum(idf.get(token, 1.0) for token in overlap)
        if score > best_score:
            best_score = score
            best_top = max(0, round(lines[index][0] - 24))
    return best_top


def main() -> None:
    quiz = load_quiz()
    with pdfplumber.open(PDF_PATH) as pdf:
        if len(pdf.pages) != 67:
            raise ValueError(f"Expected 67 pages, found {len(pdf.pages)}")
        page_texts = [(page.extract_text() or "") for page in pdf.pages]
        lines_by_page = [page_lines(page) for page in pdf.pages]

    page_tokens = [set(tokens(text)) for text in page_texts]
    document_frequency = Counter(token for page in page_tokens for token in page)
    idf = {
        token: math.log((1 + len(page_tokens)) / (1 + count)) + 1
        for token, count in document_frequency.items()
    }

    seen_topics = {(question["theme"], question.get("topic", "")) for question in quiz}
    missing = sorted(seen_topics - TOPIC_RULES.keys())
    if missing:
        raise ValueError(f"Missing topic rules: {missing}")

    references = []
    match_counts = Counter()
    for question in quiz:
        topic_key = (question["theme"], question.get("topic", ""))
        topic_rule = TOPIC_RULES[topic_key]
        correct_answer = question["answers"][question["correct"]]
        # The topic restricts the candidate pages; it must not inflate the textual
        # match, which is calculated only from the question and its official answer.
        query_text = f'{question["question"]} {correct_answer}'
        query_tokens = tokens(query_text)
        query_set = set(query_tokens)
        query_weight = sum(idf.get(token, 1.0) for token in query_set) or 1.0

        candidates = []
        for page_number in topic_rule["pages"]:
            overlap = query_set & page_tokens[page_number - 1]
            overlap_weight = sum(idf.get(token, 1.0) for token in overlap)
            score = overlap_weight / query_weight
            candidates.append((score, len(overlap), page_number, overlap))
        score, overlap_count, page_number, overlap = max(candidates)

        if topic_rule["coverage"] == "related":
            match = "related"
        elif overlap_count >= 3 and score >= 0.18:
            match = "direct"
        else:
            match = "topic"
        match_counts[match] += 1

        visible_terms = []
        normalized_query_words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", query_text)
        for word in normalized_query_words:
            if stem(normalize(word)) in overlap and len(word) >= 4 and word.lower() not in {item.lower() for item in visible_terms}:
                visible_terms.append(word)
            if len(visible_terms) == 4:
                break

        references.append(
            {
                "id": question["id"],
                "page": page_number,
                "top": best_line_top(lines_by_page[page_number - 1], query_set, idf),
                "section": topic_rule["section"],
                "match": match,
                "terms": visible_terms,
            }
        )

    output = {
        "source": {
            "id": "dispensa",
            "title": "Dispensa patente nautica 12M",
            "edition": 2011,
            "pages": 67,
        },
        "sections": {
            key: {"title": title, "titlePt": title_pt}
            for key, (title, title_pt) in SECTIONS.items()
        },
        "summary": {
            "questions": len(references),
            "direct": match_counts["direct"],
            "topic": match_counts["topic"],
            "related": match_counts["related"],
        },
        "references": references,
    }
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(output["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
