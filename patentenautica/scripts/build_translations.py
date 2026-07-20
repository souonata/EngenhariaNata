"""Gera as traduções estáticas IT -> PT usadas pelo Rotta 12.

O italiano ministerial permanece exclusivamente em ``quiz-base.js``. Este script
cria arquivos paralelos sem campos de gabarito, portanto uma tradução nunca pode
alterar a alternativa correta. O modelo só é necessário durante a regeneração;
o navegador usa os JSON já versionados e funciona offline.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Iterable

import torch
from transformers import MarianMTModel, MarianTokenizer


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MODEL_NAME = "Helsinki-NLP/opus-mt-tc-big-itc-itc"
MODEL_REVISION = "a185ba7b3cac07bbd692dd517577b8c2dc7abb2c"
TARGET_PREFIX = ">>por<< "
CACHE_VERSION = 2
NUMBER_PATTERN = re.compile(r"\d+(?:[.,:’']\d+)*|\b[IVXLCDM]+°", re.IGNORECASE)

PROTECTED_TERMS = (
    (r"\baccost(?:o|a|are|ando|ata|ato)\s+a\s+dritta\b", "guino para boreste"),
    (r"\baccost(?:o|a|are|ando|ata|ato)\s+a\s+sinistra\b", "guino para bombordo"),
    (r"\blimite\s+di\s+dritta\b", "limite de boreste"),
    (r"\bdritta\b", "boreste"),
    (r"\bscarroccio\b", "abatimento causado pelo vento"),
    (r"\brilevament(?:o|i)\b", "marcação náutica"),
    (r"\b(?:motore\s+)?fuoribordo\b", "motor de popa"),
    (r"\bmotore\s+fuori\s+bordo\b", "motor de popa"),
    (r"\bancoraggio\b", "fundeio"),
    (r"\bmede\s+laterali\b", "balizas laterais"),
)

FORBIDDEN_TRANSLATIONS = (
    r"engate em linha reta",
    r"limite de reta",
    r"descaroço",
    r"carrasco",
    r"detecção",
    r"fora de bordo",
    r"off-road",
    r"\bncora\b",
    r"medidas laterais",
    r"embarcaçãos",
    r"rota de rota",
    r"campo de corrida",
    r"campos boe",
    r"campos boês",
    r"fundiário",
    r"perdão do bem",
    r"proprietário do navio",
    r"\bndia\b",
)

TRANSLATION_OVERRIDES = {
    "TEORIA DELLO SCAFO": "TEORIA DO CASCO",
    "MOTORI": "MOTORES",
    "SICUREZZA DELLA NAVIGAZIONE": "SEGURANÇA DA NAVEGAÇÃO",
    "MANOVRA E CONDOTTA": "MANOBRA E CONDUÇÃO",
    "COLREG E SEGNALAMENTO MARITTIMO": "COLREG E SINALIZAÇÃO MARÍTIMA",
    "METEOROLOGIA": "METEOROLOGIA",
    "NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA": "NAVEGAÇÃO CARTOGRÁFICA E ELETRÔNICA",
    "NORMATIVA DIPORTISTICA E AMBIENTALE": "LEGISLAÇÃO DO RECREIO E AMBIENTAL",
    "Ancoraggio": "Fundeio",
    "ancora": "âncora",
    "Indice ufficiale di leggi, decreti e banche dati dei quesiti.":
        "Índice oficial de leis, decretos e bancos de dados de questões.",
    "Indice generale dei capitoli e degli esercizi.":
        "Índice geral dos capítulos e dos exercícios.",
    "Dispensa patente nautica 12M": "Apostila para habilitação náutica 12 M",
    "Ambito della patente": "Âmbito da habilitação náutica",
    "Brezze e venti mediterranei": "Brisas e ventos mediterrâneos",
    "Coordinate e carta nautica": "Coordenadas e carta náutica",
    "Incendio, falla e incaglio": "Incêndio, via d'água e encalhe",
    "Ormeggio e disormeggio": "Amarração e desatracação",
    "Vedetta e rischio di collisione": "Vigia e risco de colisão",
    "Normativa diportistica e ambientale": "Legislação do recreio e ambiental",
    "Prua e poppa definiscono le estremità; dritta e sinistra si individuano guardando verso prua. Baglio massimo, lunghezza e pescaggio condizionano la manovra e l’accesso ai fondali.":
        "Proa e popa definem as extremidades; boreste e bombordo são identificados olhando para a proa. Boca máxima, comprimento e calado condicionam a manobra e o acesso a águas rasas.",
    "il baglio massimo.": "a boca máxima.",
    "prora vada a dritta.": "a proa guine para boreste.",
    "Com'è denominata la massima lunghezza dell'unità navale, cioè quella misurata tra le estremità prodiera e poppiera?":
        "Como se denomina o comprimento máximo da embarcação, medido entre as extremidades de proa e de popa?",
    "Le murate sono:": "Os costados são:",
    "Cos'è il ponte di coperta?": "O que é o convés?",
    "Cosa si intende per locale macchine o locale apparato motore di un'unità?":
        "O que se entende por praça de máquinas ou compartimento do motor de uma embarcação?",
    "Scegli fondale, profondità, ridosso e spazio di brandeggio. Il rapporto fra lunghezza di cima o catena e profondità determina l’angolo di tiro sull’ancora.":
        "Escolha o tipo de fundo, a profundidade, o abrigo e o espaço para o círculo de giro. A relação entre o comprimento do cabo ou da corrente e a profundidade determina o ângulo de tração sobre a âncora.",
    "Controlla carta, cavi sottomarini, aree vietate, vento previsto, marea e altre imbarcazioni.":
        "Confira a carta náutica, os cabos submarinos, as áreas proibidas, o vento previsto, a maré e as outras embarcações.",
    "Cala, non lanciare, l’ancora; arretra lentamente mentre fili la linea d’ormeggio.":
        "Baixe, não arremesse, a âncora; recue lentamente enquanto larga o cabo ou a corrente de fundeio.",
    "Verifica la tenuta con riferimenti o allarme GPS e prevedi cambi di vento o corrente.":
        "Verifique se a âncora unhou usando referências ou o alarme do GPS e antecipe mudanças de vento ou corrente.",
    "Per salpare, portati sulla verticale senza usare il salpa-ancora per rimorchiare l’imbarcazione.":
        "Para suspender a âncora, posicione-se na vertical sem usar o molinete para rebocar a embarcação.",
    "abbrivio": "seguimento",
    "alla fonda": "fundeado",
    "assetto": "trim (assento)",
    "brandeggio": "círculo de giro",
    "calumo": "filame (calumo)",
    "cima": "cabo",
    "corrente": "corrente",
    "disormeggio": "desatracação",
    "dotazioni": "equipamentos obrigatórios",
    "ecoscandaglio": "ecobatímetro",
    "elica": "hélice",
    "falla": "via d'água",
    "gassa d’amante": "lais de guia",
    "girante": "rotor da bomba",
    "incaglio": "encalhe",
    "iniettore": "injetor",
    "maestrale": "mistral",
    "nodo parlato": "volta do fiel",
    "nodo di bitta": "nó de bita",
    "nodo di bozza": "nó de boça",
    "ordinate": "cavernas",
    "PAN PAN": "PAN PAN",
    "paratie": "anteparas",
    "pescaggio": "calado",
    "presa a mare": "tomada d'água do mar",
    "punto nave": "posição da embarcação",
    "raffreddamento": "refrigeração",
    "salvagente": "boia salva-vidas",
    "SECURITE": "SECURITÉ",
    "sorpasso": "ultrapassagem",
    "temporale": "temporal",
    "timone": "leme",
    "vedetta": "vigia",
    "quando non impegnati a tale fine, possono essere occupati da altra unità, con l'obbligo di essere liberati in caso di richiesta di portatore di handicap comunicata al concessionario almeno 24 ore prima.":
        "Quando não estiverem destinados a esse fim, podem ser ocupados por outra embarcação, com a obrigação de serem liberados se uma pessoa com deficiência fizer a solicitação ao concessionário com pelo menos 24 horas de antecedência.",
    "dalle ore 08:00 alle ore 17:00 le unità non devono mostrare nessun altra luce che possa essere confusa con i fanali prescritti dal COLREG.":
        "Das 08:00 às 17:00, as embarcações não devem exibir nenhuma outra luz que possa ser confundida com as luzes prescritas pelo COLREG.",
    "dalle ore 08:00 alle ore 19:00 le unità non devono mostrare nessun altra luce che possa essere confusa con i fanali prescritti dal COLREG.":
        "Das 08:00 às 19:00, as embarcações não devem exibir nenhuma outra luz que possa ser confundida com as luzes prescritas pelo COLREG.",
    "bisogna arrivare alle ore 09:00 sapendo che il consumo orario del motore è di 10 l/h,":
        "É necessário chegar às 09:00, sabendo que o consumo horário do motor é de 10 l/h,",
    "attraversare il campo di regata non appena le unità in gara si siano spostate in altro settore della zona di regata.":
        "Atravessar o campo de regata assim que as embarcações em competição tiverem se deslocado para outro setor da área de regata.",
    "La velocità effettiva (Ve) altro non è che la velocità:":
        "A velocidade efetiva (Ve) nada mais é do que a velocidade:",
    "non è mai responsabile del perimento del bene.":
        "Nunca é responsável pela perda do bem.",
    "soltanto in acque libere da bagnanti e da imbarcazioni, se non vietato dalle ordinanze locali, ovvero entro gli appositi corridoi di lancio.":
        "Somente em águas sem banhistas e sem embarcações, se não for proibido pelas normas locais, ou dentro dos corredores de lançamento apropriados.",
    "nei campi boe l'ancoraggio non è mai consentito.":
        "Nos campos de boias, o fundeio nunca é permitido.",
    "comunicare sul canale 16 VHF l'intenzione di attraversare il campo di gara e attendere istruzioni.":
        "Comunicar pelo canal 16 VHF a intenção de atravessar o campo de regata e aguardar instruções.",
    "modificare il proprio percorso di rotta per mantenersi a debita distanza dai limiti del campo di gara.":
        "Alterar a própria rota para manter distância adequada dos limites do campo de regata.",
    'Come avvalersi del "bow truster" intendendo ormeggiarsi in banchina sul proprio lato dritto?':
        "Como utilizar o bow thruster (propulsor de proa) para atracar no cais pelo lado de boreste?",
    "in accosto a sinistra, in modo da favorire la traslazione dell'unità parallelamente alla banchina.":
        "Guinando para bombordo, de modo a favorecer o deslocamento lateral da embarcação paralelamente ao cais.",
    "in accosto a dritta, in modo da favorire la traslazione dell'unità parallelamente alla banchina.":
        "Guinando para boreste, de modo a favorecer o deslocamento lateral da embarcação paralelamente ao cais.",
    "non va mai azionato durante la manovra d'ormeggio.":
        "Nunca deve ser acionado durante a manobra de atracação.",
    "di scarroccio e deriva.":
        "do abatimento causado pelo vento e da deriva causada pela corrente.",
    "ancorché non proprietario dell'imbarcazione, assume tutti i rischi relativi al perimento del bene.":
        "Embora não seja proprietário da embarcação, assume todos os riscos relativos à perda ou ao perecimento do bem.",
    "poiché non è il proprietario dell'imbarcazione, non si assume i rischi relativi al perimento del bene, a meno che non derivi da una sua grave imperizia.":
        "Como não é proprietário da embarcação, não assume os riscos relativos à perda ou ao perecimento do bem, salvo se decorrer de grave imperícia sua.",
    "sino a che l'unità da diporto non subisca modifiche agli elementi strutturali o di identificazione della stessa ovvero importanti innovazioni.":
        "Até que a embarcação de recreio sofra alterações nos elementos estruturais ou de identificação, ou inovações importantes.",
    "Generalmente, in zona B delle Aree Marine Protette la navigazione:":
        "Em geral, na zona B das Áreas Marinhas Protegidas, a navegação:",
    "Nelle aree marine protette dove l'ormeggio è regolamentato tramite campi boe:":
        "Nas áreas marinhas protegidas onde a amarração é regulamentada por campos de boias:",
    "nei campi boe l'ancoraggio è consentito dall'alba al tramonto.":
        "Nos campos de boias, o fundeio é permitido do nascer ao pôr do sol.",
    "nei campi boe l'ancoraggio è consentito solo se c'è sufficiente spazio di manovra.":
        "Nos campos de boias, o fundeio só é permitido quando houver espaço de manobra suficiente.",
    "in marcia avanti, tende a fare accostare la poppa a dritta.":
        "Em marcha avante, tende a fazer a popa guinar para boreste.",
    "accostano a dritta entrambe.":
        "Ambas guinam para boreste.",
    "si passa a dritta del segnale.":
        "Passa-se a boreste do sinal.",
    "Quando viene utilizzato di massima l'ormeggio su di un ancora o a ruota?":
        "Quando se utiliza, em regra, a amarração sobre uma âncora ou à roda?",
    "al fuso per regolare l'ancoraggio.":
        "À haste para regular o fundeio.",
}


def normalize_directions(source: str, translated: str) -> str:
    if "procede dritta" in source.casefold():
        return translated

    result = translated
    if re.search(r"\bdritta\b", source, re.IGNORECASE):
        result = re.sub(
            r"\b(?:borets|boriste|boris|boca|boreca|bora|dereita|bóreste|borês|borestes|borboletas?|boirão|borrão|bores)\b",
            "boreste",
            result,
            flags=re.IGNORECASE,
        )
        result = re.sub(r"\b(?:na borda|à borda|a bordo)(?=[,.;]|\s|$)", "a boreste", result, flags=re.IGNORECASE)
        result = re.sub(r"\b(?:na margem|à margem|à beira)\b", "a boreste", result, flags=re.IGNORECASE)

    expected = [
        "boreste" if token.casefold() == "dritta" else "bombordo"
        for token in re.findall(r"\b(?:dritta|sinistra)\b", source, re.IGNORECASE)
    ]
    matches = list(re.finditer(r"\b(?:boreste|bombordo)\b", result, re.IGNORECASE))
    if expected and len(matches) >= len(expected):
        pieces = []
        cursor = 0
        for match, replacement in zip(matches[: len(expected)], expected, strict=True):
            pieces.extend((result[cursor : match.start()], replacement))
            cursor = match.end()
        pieces.append(result[cursor:])
        result = "".join(pieces)
    return result


def load_window_json(filename: str):
    raw = (DATA / filename).read_text(encoding="utf-8").strip()
    match = re.match(r"window\.([A-Z0-9_]+)\s*=", raw)
    if not match:
        raise ValueError(f"Formato window.* inválido em {filename}")
    variable = match.group(1)
    script = (
        "global.window=global;"
        f"require({json.dumps(str(DATA / filename))});"
        f"process.stdout.write(JSON.stringify(global.{variable}));"
    )
    result = subprocess.run(
        ["node", "-e", script],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)


def write_json(filename: str, payload) -> None:
    (DATA / filename).write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def nonempty_lines(value: str) -> list[str]:
    return [line.strip() for line in value.splitlines() if line.strip()]


def translate_lines(value: str, translations: dict[str, str]) -> str:
    return "\n".join(translations[line] for line in nonempty_lines(value))


def prepare_for_model(source: str) -> str:
    """Protege termos cujo sentido náutico costuma se perder na tradução geral."""
    result = source
    for pattern, replacement in PROTECTED_TERMS:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return result


def placeholder_label(index: int) -> str:
    label = ""
    value = index
    while True:
        label = chr(65 + (value % 26)) + label
        value = value // 26 - 1
        if value < 0:
            return label


def protect_numbers(source: str) -> tuple[str, dict[str, str]]:
    replacements: dict[str, str] = {}

    def replace(match: re.Match) -> str:
        placeholder = f"ZXPN{placeholder_label(len(replacements))}QZ"
        replacements[placeholder] = match.group(0)
        return f" {placeholder} "

    return NUMBER_PATTERN.sub(replace, source), replacements


def restore_numbers(translated: str, replacements: dict[str, str]) -> str:
    result = translated
    for placeholder, original in replacements.items():
        result = result.replace(placeholder, original)
    result = re.sub(r"\s+([,.;:!?°])", r"\1", result)
    return re.sub(r"\s{2,}", " ", result).strip()


def nautical_postprocess(source: str, translated: str) -> str:
    """Corrige falsos amigos recorrentes sem tocar no texto oficial italiano."""
    if source in TRANSLATION_OVERRIDES:
        return TRANSLATION_OVERRIDES[source]

    if (
        re.match(r"^(?:distanza|velocità|ETA|partenza|arrivo)\b", source, re.IGNORECASE)
        and NUMBER_PATTERN.search(source)
        and len(source) <= 80
    ):
        result = source
        deterministic_terms = (
            (r"^distanza\b", "distância"),
            (r"^velocità\b", "Velocidade"),
            (r"\bconsumo\b", "consumo"),
            (r"^partenza\b", "Partida"),
            (r"^arrivo\b", "Chegada"),
        )
        for pattern, replacement in deterministic_terms:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
        return result

    result = translated.strip()
    source_folded = source.casefold()

    terminology_rules = (
        (r"\bbaglio\b", r"\b(?:brilho|baço|raio)\b", "boca"),
        (r"\bpescaggio\b", r"\b(?:pesca|pescagem|pescaria|mergulho)\b", "calado"),
        (r"\bordinate\b", r"\b(?:arrumados|ordenadas|ordens?)\b", "cavernas"),
        (r"\bparatie\b", r"\b(?:muros|paredes|aparelho)\b", "anteparas"),
        (r"\bfasciame\b", r"\bbandagem\b", "chapeamento"),
        (r"\bassetto\b", r"\b(?:arranjo|ajuste)\b", "trim"),
        (r"\bgirante\b", r"\bgiratóri[oa]\b", "rotor da bomba"),
        (r"\bpresa a mare\b", r"\b(?:tomada(?: de água)?|válvula de aderência|atirar para o mar)\b", "tomada d'água do mar"),
        (r"\bfolle\b", r"\b(?:louca|loucura|enlouquecer)\b", "neutro"),
        (r"\babbrivio\b", r"\b(?:abajur|abreviada|abreviatura|abafamento|atrito|encurtamento|espera)\b", "seguimento"),
        (r"\bcima\b", r"\b(?:cima|tampa|top|topo|parte superior)\b", "cabo"),
        (r"\bfalla\b", r"\bfalha\b", "via d'água"),
        (r"\bincaglio\b", r"\b(?:encaixe|encalço|engano|enredo|fracasso|peito)\b", "encalhe"),
        (r"\bridoss\w*\b", r"\b(?:curvatura|arredores)\b", "abrigo"),
        (r"\bbrandeggio\b", r"\b(?:brandagem|leo)\b", "círculo de giro"),
        (r"\bvedetta\b", r"\b(?:aparelho|vettel)\b", "vigia"),
        (r"\bvedetta\b", r"\bvisão e audição\b", "vigia visual e auditiva"),
        (r"\bvedetta\b", r"\bserviço de (?:observação|vigilância)\b", "serviço de vigia"),
        (r"\btesta d['’]albero\b", r"\bcabeça de (?:árvore|eixo)\b", "mastro"),
        (r"\btemporali?\b", r"\btemporári[oa]s?\b", "temporal"),
        (r"\bcarta nautica\b", r"\brasgo de papel de papel de mar\b", "trecho da carta náutica"),
        (r"\bcarta nautica\b", r"\b(?:livro|papel de papel de mar|papel de mar|papel náutico|mapa náutico|cartão náutico)\b", "carta náutica"),
        (r"\bpunto nave\b", r"\bponto (?:nave|de navio)\b", "posição da embarcação"),
        (r"\becoscandaglio\b", r"\b(?:ecoescandalo|ecosscandalho|ecoscandalho|ecoscandalo)\b", "ecobatímetro"),
        (r"\bportolani\b", r"\bportais\b", "roteiros náuticos"),
    )
    for source_pattern, target_pattern, replacement in terminology_rules:
        if re.search(source_pattern, source_folded, re.IGNORECASE):
            result = re.sub(target_pattern, replacement, result, flags=re.IGNORECASE)

    if re.search(r"\baccost\w*\s+a\s+dritta\b", source_folded):
        result = re.sub(
            r"(?:engate|acosto|encost(?:o|ado|a)|aproximação|aproximo)(?:\s+em\s+linha)?\s+(?:reta|direita|à?\s*boreste)",
            "guino para boreste",
            result,
            flags=re.IGNORECASE,
        )
    if re.search(r"\blimite\s+di\s+dritta\b", source_folded):
        result = re.sub(r"limite\s+(?:de|da)\s+(?:reta|direita)", "limite de boreste", result, flags=re.IGNORECASE)
    if re.search(r"\bdritta\b", source_folded):
        result = re.sub(r"\blinha reta\b", "boreste", result, flags=re.IGNORECASE)
        result = re.sub(r"\blado direito\b", "lado de boreste", result, flags=re.IGNORECASE)
        result = re.sub(r"\b(?:direita|dereita|boreca|bora)\b", "boreste", result, flags=re.IGNORECASE)
    if "scarroccio" in source_folded:
        result = re.sub(r"\b(descaroço|carrasco|deslizamento)\b", "abatimento", result, flags=re.IGNORECASE)
        result = re.sub(
            r"\b(?:abater-se|abate|vento é causado)(?:\s+(?:devido a|pelo|causado pelo))?\s+vento\b",
            "abatimento causado pelo vento",
            result,
            flags=re.IGNORECASE,
        )
        result = re.sub(r"\babate causado pelo vento\b", "abatimento causado pelo vento", result, flags=re.IGNORECASE)
        result = re.sub(r"\babate causada pelo vento\b", "abatimento causado pelo vento", result, flags=re.IGNORECASE)
        result = re.sub(r"\babater-se devido ao vento\b", "abatimento causado pelo vento", result, flags=re.IGNORECASE)
        result = re.sub(r"\babater causado pelo vento\b", "abatimento causado pelo vento", result, flags=re.IGNORECASE)
    if "rilevament" in source_folded:
        result = re.sub(
            r"\b(detecção|levantamento|relevamento)(s)?\b",
            r"marcação\2",
            result,
            flags=re.IGNORECASE,
        )
        result = re.sub(r"\bdetectando\b", "fazendo a marcação de", result, flags=re.IGNORECASE)
        result = re.sub(r"\bdetectar\b", "marcar", result, flags=re.IGNORECASE)
        result = re.sub(r"\bmarcas náuticas\b", "marcações náuticas", result, flags=re.IGNORECASE)
        result = re.sub(r"\bmarco náutico\b", "marcação náutica", result, flags=re.IGNORECASE)
    if re.search(r"\bprodier\w*\b", source_folded):
        result = re.sub(r"\b(?:prodigal|prodier\w*)\b", "de proa", result, flags=re.IGNORECASE)
    if re.search(r"\bpoppier\w*\b", source_folded):
        result = re.sub(r"\bpoppier\w*\b", "de popa", result, flags=re.IGNORECASE)
    if re.search(r"\bmurate?\b", source_folded):
        result = re.sub(r"\bmuralhas?\b", "costados", result, flags=re.IGNORECASE)
    if "ponte di coperta" in source_folded:
        result = re.sub(r"\bponte de cobertor\b", "convés", result, flags=re.IGNORECASE)
    if re.search(r"\bsinistra\b", source_folded):
        result = re.sub(r"\b(?:lado )?esquerd[oa]\b", "bombordo", result, flags=re.IGNORECASE)
    if "fuoribordo" in source_folded:
        result = re.sub(
            r"\b(?:motor\s+)?(?:fora de bordo|fora-borda|off-road)\b",
            "motor de popa",
            result,
            flags=re.IGNORECASE,
        )
    if "motore fuori bordo" in source_folded:
        result = re.sub(r"\bmotor fora de bordo\b", "motor de popa", result, flags=re.IGNORECASE)
    if "tempi fuori bordo" in source_folded:
        result = re.sub(
            r"\b(?:carburação|configuração) de quatro tempos fora de bordo\b",
            "configuração de quatro tempos do tipo motor de popa",
            result,
            flags=re.IGNORECASE,
        )
    if "catena" in source_folded and "fuori bordo" in source_folded:
        result = "a parte da corrente da âncora que fica para fora da embarcação."
    if "fuori rotta" in source_folded:
        result = re.sub(r"\boff-road\b", "desvio de rota", result, flags=re.IGNORECASE)
    if "ancora galleggiante" in source_folded:
        result = re.sub(r"\bncora flutuante\b", "Âncora flutuante", result, flags=re.IGNORECASE)
    if re.search(r"\bancora\b", source_folded):
        result = re.sub(r"\bncora\b", "âncora", result, flags=re.IGNORECASE)
    if "ancoraggio" in source_folded:
        result = re.sub(
            r"\b(?:ndia|mergulho|fundição|fundiário|ancoragem|funénio|fundo da roda|fundo de roda)\b",
            "fundeio",
            result,
            flags=re.IGNORECASE,
        )
        result = re.sub(
            r"\b(?:funéio|fundéio|fundéia|fundino|fundião|afundar)\b",
            "fundeio",
            result,
            flags=re.IGNORECASE,
        )
    if "ormeggio" in source_folded:
        result = re.sub(r"\bancoragem\b", "amarração", result, flags=re.IGNORECASE)
    if "campi boe" in source_folded:
        result = re.sub(r"\bcampos? (?:boe|boês|bodes|de bóias)\b", "campos de boias", result, flags=re.IGNORECASE)
    if "bagnanti" in source_folded:
        result = re.sub(r"\b(?:banhos|banhadores)\b", "banhistas", result, flags=re.IGNORECASE)
    if "perimento" in source_folded:
        result = re.sub(r"\bperdão\b", "perda", result, flags=re.IGNORECASE)
    if "regata" in source_folded or "campo di gara" in source_folded:
        result = re.sub(r"\bcampo de corrida\b", "campo de regata", result, flags=re.IGNORECASE)
    if "imbarcazione" in source_folded:
        result = re.sub(r"\bnavio\b", "embarcação", result, flags=re.IGNORECASE)
    if "ancoraggio" in source_folded:
        result = re.sub(r"\bncora\b", "fundeio", result, flags=re.IGNORECASE)
    if "mede laterali" in source_folded:
        result = re.sub(r"\bmedidas laterais\b", "balizas laterais", result, flags=re.IGNORECASE)

    if re.search(r"\bfanal(?:e|i)\b", source_folded):
        result = re.sub(r"\bfaróis\b", "luzes", result, flags=re.IGNORECASE)
        result = re.sub(r"\bfarol\b", "luz", result, flags=re.IGNORECASE)
    if re.search(r"\bunità\b", source_folded):
        result = re.sub(
            r"\bunidade(s)?\b",
            lambda match: "embarcações" if match.group(1) else "embarcação",
            result,
            flags=re.IGNORECASE,
        )
    if "scafo" in source_folded:
        result = re.sub(r"\bcasco naval\b", "casco", result, flags=re.IGNORECASE)
    if "diporto" in source_folded:
        result = re.sub(r"\bprazer\b", "recreio", result, flags=re.IGNORECASE)
    if "rilevament" in source_folded:
        result = re.sub(r"\brelevamento(s)?\b", r"marcação\1", result, flags=re.IGNORECASE)
    if "precedenza" in source_folded:
        result = re.sub(r"\bprioridade\b", "preferência", result, flags=re.IGNORECASE)
    if "abbord" in source_folded:
        result = re.sub(r"\babord(?:agem|emento)s?\b", "colisão", result, flags=re.IGNORECASE)
    if "scogli affioranti" in source_folded:
        result = re.sub(r"\b(?:espinhos|escolhos)\b", "rochedos aflorantes", result, flags=re.IGNORECASE)
    if "cinture di salvataggio" in source_folded:
        result = re.sub(r"\bcintos? (?:de segurança|salva-vidas)\b", "coletes salva-vidas", result, flags=re.IGNORECASE)
        result = result.replace(" e parte superior", " e cabo")
    if "consumo orario" in source_folded:
        result = re.sub(r"\bconsumo (?:de energia|por hora)\b", "consumo horário", result, flags=re.IGNORECASE)
    if "patente nautica" in source_folded:
        result = re.sub(r"\bcarta de condução(?: náutica)?\b", "habilitação náutica", result, flags=re.IGNORECASE)
    if "natante da diporto" in source_folded:
        result = re.sub(r"\bbarco de recreio\b", "natante de recreio (categoria italiana)", result, flags=re.IGNORECASE)
    if "imbarcazione da diporto" in source_folded:
        result = re.sub(
            r"\b(?:barco|embarcação) de recreio\b",
            "imbarcazione de recreio (categoria italiana registrada)",
            result,
            flags=re.IGNORECASE,
        )

    result = re.sub(r"\bmilhas marítimas\b", "milhas náuticas", result, flags=re.IGNORECASE)
    result = re.sub(r"\bos luzes\b", "as luzes", result, flags=re.IGNORECASE)
    result = re.sub(r"\bembarcaçãos\b", "embarcações", result, flags=re.IGNORECASE)
    result = re.sub(r"\bcarta de condução náutica\b", "habilitação náutica", result, flags=re.IGNORECASE)
    return normalize_directions(source, result)


def final_translation(source: str, translations: dict[str, str]) -> str:
    if not source or not source.strip():
        return ""
    return nautical_postprocess(source, translations[source])


def collect_strings(content, quiz, exercises) -> list[str]:
    strings: list[str] = []

    def add(value) -> None:
        if isinstance(value, str) and value.strip():
            strings.append(value.strip())

    for chapter in content["chapters"]:
        add(chapter["title"])
        for topic in chapter["topics"]:
            add(topic["title"])
            add(topic["summary"])
            for point in topic["points"]:
                add(point)
            for tag in topic["tags"]:
                add(tag)
    for source in content["sources"]:
        for field in ("group", "title", "status", "note"):
            add(source.get(field))
    for item in quiz:
        for field in ("question", "theme", "topic", "note"):
            add(item.get(field))
        for answer in item["answers"]:
            add(answer)
    for item in exercises:
        add(item["sector"])
        for line in nonempty_lines(item["prompt"]):
            add(line)
        for line in nonempty_lines(item["solution"]):
            add(line)
    return list(dict.fromkeys(strings))


def load_cache(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_cache(path: Path, cache: dict[str, str]) -> None:
    path.write_text(
        json.dumps(cache, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    (DATA / "translation-cache.meta.json").write_text(
        json.dumps({"version": CACHE_VERSION, "model": MODEL_NAME, "revision": MODEL_REVISION}, indent=2) + "\n",
        encoding="utf-8",
    )


def invalidate_legacy_cache(cache: dict[str, str], strings: list[str]) -> None:
    meta_path = DATA / "translation-cache.meta.json"
    version = None
    if meta_path.exists():
        version = json.loads(meta_path.read_text(encoding="utf-8")).get("version")
    if version == CACHE_VERSION:
        return
    protected_patterns = tuple(pattern for pattern, _ in PROTECTED_TERMS)
    for source in list(cache):
        if source not in strings:
            continue
        if NUMBER_PATTERN.search(source) or any(re.search(pattern, source, re.IGNORECASE) for pattern in protected_patterns):
            del cache[source]


def batches(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def generate_translations(strings: list[str], cache: dict[str, str], batch_size: int) -> dict[str, str]:
    invalidate_legacy_cache(cache, strings)
    pending = [value for value in strings if value not in cache]
    if not pending:
        return cache

    tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME, revision=MODEL_REVISION)
    model = MarianMTModel.from_pretrained(MODEL_NAME, revision=MODEL_REVISION)
    model.eval()
    torch.set_num_threads(max(1, min(8, (os.cpu_count() or 2) - 1)))

    cache_path = DATA / "translation-cache.json"
    total = len(pending)
    with torch.inference_mode():
        for batch_number, batch in enumerate(batches(pending, batch_size), start=1):
            protected_batch = []
            numeric_replacements = []
            for value in batch:
                prepared, replacements = protect_numbers(prepare_for_model(value))
                protected_batch.append(prepared)
                numeric_replacements.append(replacements)
            encoded = tokenizer(
                [TARGET_PREFIX + value for value in protected_batch],
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            )
            generated = model.generate(**encoded, max_new_tokens=512, num_beams=1)
            translated = tokenizer.batch_decode(generated, skip_special_tokens=True)
            for source, target, replacements in zip(batch, translated, numeric_replacements, strict=True):
                cache[source] = restore_numbers(target, replacements)
            if batch_number % 20 == 0:
                done = min(batch_number * batch_size, total)
                print(f"Traduzidos {done}/{total}")
                save_cache(cache_path, cache)
    save_cache(cache_path, cache)
    return cache


def translated_content(content, translations: dict[str, str]):
    result = {"exam": deepcopy(content["exam"]), "chapters": [], "sources": []}
    for chapter in content["chapters"]:
        translated_chapter = {
            "id": chapter["id"],
            "title": final_translation(chapter["title"], translations),
            "topics": [],
        }
        for topic in chapter["topics"]:
            translated_chapter["topics"].append(
                {
                    "id": topic["id"],
                    "title": final_translation(topic["title"], translations),
                    "summary": final_translation(topic["summary"], translations),
                    "points": [final_translation(value, translations) for value in topic["points"]],
                    "tags": [final_translation(value, translations) for value in topic["tags"]],
                }
            )
        result["chapters"].append(translated_chapter)
    for source in content["sources"]:
        translated_source = {"id": source["id"]}
        for field in ("group", "title", "status", "note"):
            if source.get(field):
                translated_source[field] = final_translation(source[field], translations)
        result["sources"].append(translated_source)
    return result


def translated_quiz(quiz, translations: dict[str, str]):
    return [
        {
            "id": item["id"],
            "question": final_translation(item["question"], translations),
            "answers": [final_translation(answer, translations) for answer in item["answers"]],
            "theme": final_translation(item["theme"], translations),
            "topic": final_translation(item["topic"], translations),
            **({"note": final_translation(item["note"], translations)} if item.get("note") else {}),
        }
        for item in quiz
    ]


def translated_exercises(exercises, translations: dict[str, str]):
    return [
        {
            "id": item["id"],
            "sector": final_translation(item["sector"], translations),
            "prompt": "\n".join(final_translation(line, translations) for line in nonempty_lines(item["prompt"])),
            "solution": "\n".join(final_translation(line, translations) for line in nonempty_lines(item["solution"])),
        }
        for item in exercises
    ]


def numeric_tokens(value: str) -> list[str]:
    return NUMBER_PATTERN.findall(value)


def negation_preserved(italian: str, portuguese: str) -> bool:
    if re.search(r"\b(não|nem|nunca|sem|exceto|salvo)\b", portuguese, re.IGNORECASE):
        return True
    idioms = (
        (r"\bnon appena\b", r"\bassim que\b"),
        (r"\bentro e non oltre\b", r"\baté\b"),
        (r"\bsino a che.+\bnon\b", r"\baté\b"),
        (r"\baltro non è che\b", r"\bnada mais é do que\b"),
    )
    return any(
        re.search(source_pattern, italian, re.IGNORECASE)
        and re.search(target_pattern, portuguese, re.IGNORECASE)
        for source_pattern, target_pattern in idioms
    )


def validate_contextual_terms(pairs: list[tuple[int, str, str]]) -> list[str]:
    expectations = (
        (r"\bdritta\b", r"\bboreste\b", "dritta/boreste"),
        (r"\bsinistra\b", r"\bbombordo\b", "sinistra/bombordo"),
        (r"\bscarroccio\b", r"\babatimento\b", "scarroccio/abatimento"),
        (r"\brilevament", r"\bmarcaç(?:ão|ões)", "rilevamento/marcação"),
        (r"\bancoraggio\b", r"\bfundeio\b", "ancoraggio/fundeio"),
        (r"\bormeggio\b", r"\b(?:amarração|atracação|fundeio|amarr|atrac)", "ormeggio/amarração"),
        (r"\bcampi boe\b", r"\bcampos de boias\b", "campi boe/campos de boias"),
        (r"\bbagnanti\b", r"\bbanhistas\b", "bagnanti/banhistas"),
        (r"\bperimento\b", r"\b(?:perda|perecimento)\b", "perimento/perda"),
        (r"\bregata\b|\bcampo di gara\b", r"\bregata\b", "regata/regata"),
        (r"\bbaglio\b", r"\bboca\b", "baglio/boca"),
        (r"\bpescaggio\b", r"\bcalado\b", "pescaggio/calado"),
        (r"\bordinate\b", r"\bcavernas\b", "ordinate/cavernas"),
        (r"\bparatie\b", r"\banteparas\b", "paratie/anteparas"),
        (r"\bgirante\b", r"\b(?:rotor|impulsor)\b", "girante/rotor"),
        (r"\bpresa a mare\b", r"\btomada d['’]água\b", "presa a mare/tomada d'água"),
        (r"\babbrivio\b", r"\bseguimento\b", "abbrivio/seguimento"),
        (r"\bcima\b", r"\bcabo\b", "cima/cabo"),
        (r"\bfalla\b", r"\bvia d['’]água\b", "falla/via d'água"),
        (r"\bincaglio\b", r"\bencalhe\b", "incaglio/encalhe"),
        (r"\bvedetta\b", r"\bvigia\b", "vedetta/vigia"),
        (r"\becoscandaglio\b", r"\becobatímetro\b", "ecoscandaglio/ecobatímetro"),
        (r"\bcarta nautica\b", r"\bcarta náutica\b", "carta nautica/carta náutica"),
        (r"\btemporale\b|\btemporali\b", r"\b(?:temporal|tempestade)", "temporale/tempestade"),
    )
    failures = []
    for question_id, italian, portuguese in pairs:
        for source_pattern, target_pattern, label in expectations:
            exempt_straight = label == "dritta/boreste" and "procede dritta" in italian.casefold()
            exempt_temporal = label == "temporale/tempestade" and re.search(
                r"\b(?:intervall\w+|validità)\s+temporal[ei]", italian, re.IGNORECASE
            )
            if (
                not exempt_straight
                and not exempt_temporal
                and re.search(source_pattern, italian, re.IGNORECASE)
                and not re.search(target_pattern, portuguese, re.IGNORECASE)
            ):
                failures.append(f"Q{question_id}: {label}")
        if italian.rstrip().endswith(":") and not portuguese.rstrip().endswith(":"):
            failures.append(f"Q{question_id}: dois-pontos finais")
    return failures


def content_translation_pairs(content, content_pt) -> list[tuple[str, str, str]]:
    pairs = []
    for source_chapter, target_chapter in zip(content["chapters"], content_pt["chapters"], strict=True):
        chapter_ref = f"Guia capítulo {source_chapter['id']}"
        pairs.append((chapter_ref, source_chapter["title"], target_chapter["title"]))
        for source_topic, target_topic in zip(source_chapter["topics"], target_chapter["topics"], strict=True):
            topic_ref = f"Guia tópico {source_topic['id']}"
            pairs.extend(
                (
                    (topic_ref, source_topic["title"], target_topic["title"]),
                    (topic_ref, source_topic["summary"], target_topic["summary"]),
                )
            )
            pairs.extend(
                (topic_ref, source_value, target_value)
                for source_value, target_value in zip(source_topic["points"], target_topic["points"], strict=True)
            )
            pairs.extend(
                (topic_ref, source_value, target_value)
                for source_value, target_value in zip(source_topic["tags"], target_topic["tags"], strict=True)
            )
    for source_item, target_item in zip(content["sources"], content_pt["sources"], strict=True):
        source_ref = f"Fonte {source_item['id']}"
        for field in ("group", "title", "status", "note"):
            if source_item.get(field):
                pairs.append((source_ref, source_item[field], target_item[field]))
    return pairs


def audit(content, content_pt, quiz, quiz_pt, exercises, exercises_pt) -> dict:
    if len(quiz) != 1472:
        raise RuntimeError(f"Esperadas 1.472 questões oficiais; encontradas {len(quiz)}")
    if [item["id"] for item in quiz] != [item["id"] for item in quiz_pt]:
        raise RuntimeError("A ordem ou os IDs das traduções de quiz divergem do italiano")
    if any(len(item["answers"]) != 3 for item in quiz_pt):
        raise RuntimeError("Uma tradução não contém exatamente três alternativas")
    if any("correct" in item or "code" in item or "figure" in item for item in quiz_pt):
        raise RuntimeError("A camada traduzida não pode duplicar campos oficiais de identidade/gabarito")
    expected_themes = {
        source: target
        for source, target in TRANSLATION_OVERRIDES.items()
        if source.isupper() and source in {item["theme"] for item in quiz}
    }
    actual_themes = {source["theme"]: target["theme"] for source, target in zip(quiz, quiz_pt, strict=True)}
    if any(actual_themes.get(source) != target for source, target in expected_themes.items()):
        raise RuntimeError("As traduções das oito matérias oficiais não correspondem ao vocabulário controlado")

    numeric_mismatches = []
    negation_warnings = []
    contextual_pairs = content_translation_pairs(content, content_pt)
    for source, target in zip(quiz, quiz_pt, strict=True):
        pairs = [(source["question"], target["question"]), *zip(source["answers"], target["answers"], strict=True)]
        for italian, portuguese in pairs:
            contextual_pairs.append((source["id"], italian, portuguese))
            source_numbers = numeric_tokens(italian)
            target_numbers = numeric_tokens(portuguese)
            if source_numbers and Counter(source_numbers) - Counter(target_numbers):
                numeric_mismatches.append(source["id"])
            if re.search(r"\bnon\b", italian, re.IGNORECASE) and not negation_preserved(italian, portuguese):
                negation_warnings.append(source["id"])
    if numeric_mismatches:
        ids = sorted(set(numeric_mismatches))
        raise RuntimeError(f"Números/unidades potencialmente alterados nas questões: {ids[:30]}")

    exercise_numeric_mismatches = []
    for source, target in zip(exercises, exercises_pt, strict=True):
        contextual_pairs.extend(
            (
                (f"Carteggio {source['id']}", source["sector"], target["sector"]),
                (f"Carteggio {source['id']}", source["prompt"], target["prompt"]),
                (f"Carteggio {source['id']}", source["solution"], target["solution"]),
            )
        )
        if Counter(numeric_tokens(source["prompt"])) - Counter(numeric_tokens(target["prompt"])):
            exercise_numeric_mismatches.append(source["id"])
        if Counter(numeric_tokens(source["solution"])) - Counter(numeric_tokens(target["solution"])):
            exercise_numeric_mismatches.append(source["id"])
    if exercise_numeric_mismatches:
        ids = sorted(set(exercise_numeric_mismatches))
        raise RuntimeError(f"Números alterados no carteggio: {ids}")

    final_payloads = [target for _, _, target in content_translation_pairs(content, content_pt)] + [
        value
        for item in quiz_pt
        for value in (item["question"], *item["answers"], item["theme"], item["topic"], item.get("note", ""))
    ] + [value for item in exercises_pt for value in (item["sector"], item["prompt"], item["solution"])]
    forbidden_hits = {
        pattern: [value for value in final_payloads if re.search(pattern, value, re.IGNORECASE)][:3]
        for pattern in FORBIDDEN_TRANSLATIONS
    }
    forbidden_hits = {pattern: values for pattern, values in forbidden_hits.items() if values}
    if forbidden_hits:
        raise RuntimeError(f"Traduções náuticas proibidas encontradas: {forbidden_hits}")
    if negation_warnings:
        raise RuntimeError(f"Negações potencialmente perdidas nas questões: {sorted(set(negation_warnings))}")
    contextual_failures = validate_contextual_terms(contextual_pairs)
    if contextual_failures:
        raise RuntimeError(f"Terminologia/contexto inválido: {contextual_failures[:60]}")

    return {
        "model": MODEL_NAME,
        "revision": MODEL_REVISION,
        "questions": len(quiz),
        "exercises": len(exercises),
        "correctFieldsInTranslation": 0,
        "numericMismatches": 0,
        "forbiddenTerminologyHits": 0,
        "contextualTerminologyFailures": 0,
        "negationWarnings": sorted(set(negation_warnings)),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    content = load_window_json("content.js")
    quiz = load_window_json("quiz-base.js")
    exercises = load_window_json("carteggio.js")
    cache_path = DATA / "translation-cache.json"
    cache = generate_translations(collect_strings(content, quiz, exercises), load_cache(cache_path), args.batch_size)

    content_pt = translated_content(content, cache)
    quiz_pt = translated_quiz(quiz, cache)
    exercises_pt = translated_exercises(exercises, cache)
    report = audit(content, content_pt, quiz, quiz_pt, exercises, exercises_pt)

    write_json("content-pt.json", content_pt)
    write_json("quiz-pt.json", quiz_pt)
    write_json("carteggio-pt.json", exercises_pt)
    write_json("translation-report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
