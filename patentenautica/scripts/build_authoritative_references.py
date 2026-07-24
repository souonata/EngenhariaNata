#!/usr/bin/env python3
"""Build the official-source catalogue and per-question reference index.

The canonical answer always remains in data/quiz-base.js. This generator never
copies the ``correct`` field into the reference layer.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
QUIZ_PATH = ROOT / "data" / "quiz-base.js"
OFFICIAL_QUIZ_PATH = ROOT / "sources" / "quiz-ministeriali-dd-131-2022.pdf"
SOURCES_OUTPUT = ROOT / "data" / "authoritative-sources.json"
REFERENCES_OUTPUT = ROOT / "data" / "question-authority.json"
CHECKED_ON = "2026-07-24"


def load_quiz() -> list[dict]:
    raw = QUIZ_PATH.read_text(encoding="utf-8").strip()
    match = re.fullmatch(r"window\.PATENTE_QUIZ=(.*);", raw, re.DOTALL)
    if not match:
        raise RuntimeError("Formato inatteso in data/quiz-base.js")
    return json.loads(match.group(1))


def normalize(value: str) -> str:
    value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


SOURCE_SPECS = [
    {
        "id": "mit-quiz-2022",
        "title": "Elenco nazionale unico dei quesiti BASE — DD 131/2022",
        "titlePt": "Lista nacional única de questões BASE — DD 131/2022",
        "authority": "Ministero delle Infrastrutture e dei Trasporti",
        "kind": "banca ministeriale",
        "status": "testo ufficiale d’esame",
        "statusPt": "texto oficial do exame",
        "localFile": "quiz-ministeriali-dd-131-2022.pdf",
        "officialUrl": "https://www.mit.gov.it/nfsmitgov/files/media/normativa/2022-05/ALLEGATO%20A%20QUIZ%20PATENTI%20NAUTICHE%20DD%20131%20DEL%2031%20MAGGIO%202022.pdf",
        "noteIt": "Contiene il testo e il valore V/F ministeriale da cui è ricavato il gabarito del sito.",
        "notePt": "Contém o texto e o valor V/F ministerial dos quais deriva o gabarito do site.",
    },
    {
        "id": "mit-programma-2021",
        "title": "Programmi d’esame per le patenti nautiche — DM 323/2021",
        "titlePt": "Programas de exame para habilitações náuticas — DM 323/2021",
        "authority": "Ministero delle Infrastrutture e dei Trasporti",
        "kind": "decreto ministeriale",
        "status": "programma ufficiale",
        "statusPt": "programa oficial",
        "localFile": "dm-323-2021-programma-esame.pdf",
        "officialUrl": "https://www.mit.gov.it/nfsmitgov/files/media/normativa/2022-05/Decreto%20Ministeriale%20numero%20323%20del%2010%20agosto%202021.pdf",
        "noteIt": "Definisce materie, prove e competenze richieste per l’abilitazione entro 12 miglia.",
        "notePt": "Define matérias, provas e competências exigidas para a habilitação até 12 milhas.",
    },
    {
        "id": "mit-normativa",
        "title": "Normativa sulle patenti nautiche",
        "titlePt": "Normas sobre habilitações náuticas",
        "authority": "Ministero delle Infrastrutture e dei Trasporti",
        "kind": "indice istituzionale",
        "status": "pagina ufficiale aggiornata",
        "statusPt": "página oficial atualizada",
        "officialUrl": "https://www.mit.gov.it/temi/patenti-mezzi-abilitazioni/patenti-nautiche/normativa",
        "noteIt": "Indice MIT da consultare per decreti, circolari e aggiornamenti successivi alla banca 2022.",
        "notePt": "Índice do MIT para decretos, circulares e atualizações posteriores ao banco de 2022.",
    },
    {
        "id": "codice-nautica",
        "title": "Codice della nautica da diporto — D.Lgs. 171/2005",
        "titlePt": "Código da náutica de recreio — D.Lgs. 171/2005",
        "authority": "Normattiva / Gazzetta Ufficiale",
        "kind": "norma",
        "status": "testo vigente online · atto originario locale",
        "statusPt": "texto vigente online · ato original local",
        "localFile": "authoritative/gazzetta-dlgs-171-2005.pdf",
        "officialUrl": "https://www.normattiva.it/eli/id/2005/08/31/005G0200/CONSOLIDATED",
        "noteIt": "Per applicazione pratica e sanzioni prevale sempre il testo consolidato vigente su Normattiva.",
        "notePt": "Para aplicação prática e sanções, prevalece sempre o texto consolidado vigente no Normattiva.",
    },
    {
        "id": "regolamento-146",
        "title": "Regolamento di attuazione — DM 146/2008",
        "titlePt": "Regulamento de aplicação — DM 146/2008",
        "authority": "Normattiva / Gazzetta Ufficiale",
        "kind": "norma",
        "status": "testo vigente online · atto originario locale",
        "statusPt": "texto vigente online · ato original local",
        "localFile": "authoritative/gazzetta-dm-146-2008.pdf",
        "officialUrl": "https://www.normattiva.it/uri-res/N2Ls?urn:nir:ministero.infrastrutture.trasporti:decreto:2008-07-29;146!vig=",
        "noteIt": "Disciplina patenti, sicurezza, visite e dotazioni; leggere insieme alle modifiche del 2024.",
        "notePt": "Disciplina habilitações, segurança, inspeções e equipamentos; deve ser lido com as alterações de 2024.",
    },
    {
        "id": "regolamento-133-2024",
        "title": "Aggiornamento del regolamento di attuazione — DM 133/2024",
        "titlePt": "Atualização do regulamento de aplicação — DM 133/2024",
        "authority": "Gazzetta Ufficiale",
        "kind": "norma",
        "status": "vigente dal 21 ottobre 2024",
        "statusPt": "vigente desde 21 de outubro de 2024",
        "localFile": "authoritative/gazzetta-dm-133-2024.pdf",
        "officialUrl": "https://www.gazzettaufficiale.it/eli/gu/2024/09/21/222/so/35/sg/pdf",
        "noteIt": "Aggiorna numerosi articoli e allegati del DM 146/2008, comprese le dotazioni.",
        "notePt": "Atualiza diversos artigos e anexos do DM 146/2008, incluindo os equipamentos.",
    },
    {
        "id": "colreg-1972",
        "title": "Regolamento internazionale per prevenire gli abbordi in mare — COLREG 1972",
        "titlePt": "Regulamento internacional para evitar abalroamentos — COLREG 1972",
        "authority": "Gazzetta Ufficiale / IMO",
        "kind": "convenzione ratificata",
        "status": "testo normativo ufficiale",
        "statusPt": "texto normativo oficial",
        "localFile": "authoritative/gazzetta-colreg-legge-1085-1977.pdf",
        "officialUrl": "https://www.gazzettaufficiale.it/atto/vediMenuHTML?atto.codiceRedazionale=077U1085&atto.dataPubblicazioneGazzetta=1978-02-17&tipoSerie=serie_generale&tipoVigenza=originario",
        "noteIt": "Fonte primaria italiana per regole di governo, fanali, segnali e condotta in visibilità ridotta.",
        "notePt": "Fonte primária italiana para regras de governo, luzes, sinais e navegação com visibilidade reduzida.",
    },
    {
        "id": "iala-buoyage",
        "title": "IALA Maritime Buoyage System — Recommendation R1001",
        "titlePt": "Sistema de balizamento marítimo IALA — Recomendação R1001",
        "authority": "IALA",
        "kind": "standard internazionale",
        "status": "edizione ufficiale online",
        "statusPt": "edição oficial online",
        "officialUrl": "https://www.iala-aism.org/product/r1001/",
        "noteIt": "Definisce segnali laterali, cardinali, pericolo isolato, acque sicure e segnali speciali.",
        "notePt": "Define sinais laterais, cardinais, perigo isolado, águas seguras e sinais especiais.",
    },
    {
        "id": "iim-carte",
        "title": "Carte nautiche e rappresentazioni",
        "titlePt": "Cartas náuticas e representações",
        "authority": "Istituto Idrografico della Marina",
        "kind": "pagina tecnica istituzionale",
        "status": "fonte ufficiale online",
        "statusPt": "fonte oficial online",
        "officialUrl": "https://www.marina.difesa.it/noi-siamo-la-marina/pilastro-logistico/scientifici/idrografico/cosafacciamo/Pagine/CarteNautiche.aspx",
        "noteIt": "Spiega Mercatore, gnomonica, lossodromia, ortodromia, scale e tipi di carta.",
        "notePt": "Explica Mercator, gnomônica, loxodromia, ortodromia, escalas e tipos de carta.",
    },
    {
        "id": "iim-pubblicazioni",
        "title": "Pubblicazioni nautiche",
        "titlePt": "Publicações náuticas",
        "authority": "Istituto Idrografico della Marina",
        "kind": "pagina tecnica istituzionale",
        "status": "fonte ufficiale online",
        "statusPt": "fonte oficial online",
        "officialUrl": "https://www.marina.difesa.it/noi-siamo-la-marina/pilastro-logistico/scientifici/idrografico/cosafacciamo/Pagine/Documentazione.aspx",
        "noteIt": "Descrive Portolani, Elenco fari, Radioservizi e pubblicazioni di ausilio alla navigazione.",
        "notePt": "Descreve roteiros, lista de faróis, serviços rádio e publicações de apoio à navegação.",
    },
    {
        "id": "mimit-radio",
        "title": "Servizio radioelettrico marittimo",
        "titlePt": "Serviço radioelétrico marítimo",
        "authority": "Ministero delle Imprese e del Made in Italy",
        "kind": "pagina istituzionale",
        "status": "fonte ufficiale online",
        "statusPt": "fonte oficial online",
        "officialUrl": "https://www.mimit.gov.it/index.php/it/comunicazioni/radio/autorizzazioni-e-licenze/servizio-radioelettrico-marittimo",
        "noteIt": "Riferimento per licenza di esercizio, certificati di operatore, MMSI, VHF, EPIRB e AIS.",
        "notePt": "Referência para licença, certificados de operador, MMSI, VHF, EPIRB e AIS.",
    },
    {
        "id": "cirm",
        "title": "Telemedical Maritime Assistance Service",
        "titlePt": "Serviço de assistência médica marítima à distância",
        "authority": "Centro Internazionale Radio Medico",
        "kind": "servizio istituzionale",
        "status": "servizio operativo H24",
        "statusPt": "serviço operacional 24 h",
        "officialUrl": "https://www.cirm-tmas.it/",
        "noteIt": "Fonte diretta sul servizio CIRM e sui dati da comunicare per ottenere assistenza medica a distanza.",
        "notePt": "Fonte direta sobre o serviço CIRM e os dados a comunicar para assistência médica à distância.",
    },
    {
        "id": "vigili-estintori",
        "title": "Uso degli estintori",
        "titlePt": "Uso de extintores",
        "authority": "Corpo Nazionale dei Vigili del Fuoco",
        "kind": "guida istituzionale",
        "status": "fonte ufficiale online",
        "statusPt": "fonte oficial online",
        "officialUrl": "https://www.vigilfuoco.it/sites/default/files/2024-04/Uso%20Estintori.pdf",
        "noteIt": "Guida pratica pubblica su classi d’incendio, scelta e impiego iniziale degli estintori.",
        "notePt": "Guia público sobre classes de incêndio, escolha e uso inicial dos extintores.",
    },
    {
        "id": "meteoam",
        "title": "Avviso di burrasca e scala Beaufort",
        "titlePt": "Aviso de temporal e escala Beaufort",
        "authority": "Servizio Meteorologico dell’Aeronautica Militare",
        "kind": "pagina tecnica istituzionale",
        "status": "fonte ufficiale online",
        "statusPt": "fonte oficial online",
        "officialUrl": "https://www.meteoam.it/it/documentazione-tecnica/avviso-di-burrasca",
        "noteIt": "Descrive gli avvisi di vento forte e la corrispondenza con la scala Beaufort.",
        "notePt": "Descreve avisos de vento forte e sua correspondência com a escala Beaufort.",
    },
    {
        "id": "sci-nautico-1960",
        "title": "Disciplina dello sci nautico — DM 26 gennaio 1960",
        "titlePt": "Regulamentação do esqui aquático — DM 26 de janeiro de 1960",
        "authority": "Gazzetta Ufficiale",
        "kind": "norma",
        "status": "atto ufficiale · verificare ordinanze locali",
        "statusPt": "ato oficial · verificar normas locais",
        "localFile": "authoritative/gazzetta-dm-sci-nautico-1960.pdf",
        "officialUrl": "https://www.gazzettaufficiale.it/eli/gu/1960/02/04/29/sg/pdf",
        "noteIt": "Fonte nazionale; partenza, rientro e limiti costieri sono integrati dalle ordinanze marittime locali.",
        "notePt": "Fonte nacional; saída, retorno e limites costeiros são complementados por normas marítimas locais.",
    },
    {
        "id": "pesca-1639",
        "title": "Regolamento della pesca marittima — DPR 1639/1968",
        "titlePt": "Regulamento da pesca marítima — DPR 1639/1968",
        "authority": "Gazzetta Ufficiale / Normattiva",
        "kind": "norma",
        "status": "atto ufficiale · verificare testo vigente",
        "statusPt": "ato oficial · verificar texto vigente",
        "localFile": "authoritative/gazzetta-dpr-pesca-1639-1968.pdf",
        "officialUrl": "https://www.normattiva.it/eli/id/1969/07/25/068U1639/CONSOLIDATED",
        "noteIt": "Riferimento per pesca sportiva e subacquea; quote e campagne possono essere aggiornate annualmente.",
        "notePt": "Referência para pesca esportiva e subaquática; quotas e campanhas podem ser atualizadas anualmente.",
    },
    {
        "id": "codice-ambiente",
        "title": "Norme in materia ambientale — D.Lgs. 152/2006",
        "titlePt": "Normas ambientais — D.Lgs. 152/2006",
        "authority": "Normattiva / Gazzetta Ufficiale",
        "kind": "norma",
        "status": "testo vigente online · atto originario locale",
        "statusPt": "texto vigente online · ato original local",
        "localFile": "authoritative/gazzetta-dlgs-152-2006.pdf",
        "officialUrl": "https://www.normattiva.it/eli/id/2006/04/14/006G0171/CONSOLIDATED",
        "noteIt": "Quadro normativo per scarichi, rifiuti e tutela delle acque; prevale il testo consolidato online.",
        "notePt": "Quadro normativo para descargas, resíduos e proteção das águas; prevalece o texto consolidado online.",
    },
    {
        "id": "aree-protette-394",
        "title": "Legge quadro sulle aree protette — L. 394/1991",
        "titlePt": "Lei-quadro sobre áreas protegidas — L. 394/1991",
        "authority": "Gazzetta Ufficiale / Normattiva",
        "kind": "norma",
        "status": "atto ufficiale · regolamento locale determinante",
        "statusPt": "ato oficial · regulamento local determinante",
        "localFile": "authoritative/gazzetta-legge-394-1991.pdf",
        "officialUrl": "https://www.normattiva.it/eli/id/1991/12/13/091G0441/CONSOLIDATED",
        "noteIt": "Stabilisce il quadro delle aree marine protette; ogni area ha decreto istitutivo e regolamento propri.",
        "notePt": "Estabelece o quadro das áreas marinhas protegidas; cada área tem decreto e regulamento próprios.",
    },
    {
        "id": "mase-aree-protette",
        "title": "Aree marine protette",
        "titlePt": "Áreas marinhas protegidas",
        "authority": "Ministero dell’Ambiente e della Sicurezza Energetica",
        "kind": "pagina istituzionale",
        "status": "fonte ufficiale online",
        "statusPt": "fonte oficial online",
        "officialUrl": "https://www.mase.gov.it/portale/aree-naturali-protette-e-rete-natura-2000",
        "noteIt": "Portale istituzionale per l’elenco e la disciplina delle aree protette.",
        "notePt": "Portal institucional para a lista e disciplina das áreas protegidas.",
    },
    {
        "id": "ispra-oli-usati",
        "title": "Gli oli usati e l’ambiente — Rapporto ISPRA",
        "titlePt": "Óleos usados e meio ambiente — Relatório ISPRA",
        "authority": "ISPRA",
        "kind": "rapporto tecnico pubblico",
        "status": "fonte tecnica istituzionale online",
        "statusPt": "fonte técnica institucional online",
        "officialUrl": "https://www.isprambiente.gov.it/contentfiles/00003800/3854-rapporti-01-11.pdf",
        "noteIt": "A pagina 10 quantifica in circa 5.000 m² la pellicola prodotta da cinque litri di olio usato.",
        "notePt": "Na página 10, quantifica em cerca de 5.000 m² a película produzida por cinco litros de óleo usado.",
    },
]


def source_ref(source: str, locator_it: str, locator_pt: str | None = None, page: int | None = None) -> dict:
    item = {
        "source": source,
        "locatorIt": locator_it,
        "locatorPt": locator_pt or locator_it,
    }
    if page:
        item["page"] = page
    return item


RULES = {
    "scafo": {
        "titleIt": "Struttura, nomenclatura e stabilità",
        "titlePt": "Estrutura, nomenclatura e estabilidade",
        "principleIt": "Usa le definizioni nautiche in senso rigoroso: parti dello scafo, dimensioni, assi, movimenti e condizioni di equilibrio non sono sinonimi tra loro.",
        "principlePt": "Use as definições náuticas com rigor: partes do casco, dimensões, eixos, movimentos e condições de equilíbrio não são sinônimos.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · teoria dello scafo", "Anexo A · teoria do casco")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "governo": {
        "titleIt": "Elica, timone ed effetti evolutivi",
        "titlePt": "Hélice, leme e efeitos evolutivos",
        "principleIt": "Distingui spinta dell’elica, flusso sul timone ed effetto laterale delle pale; verso di rotazione, marcia e posizione del timone determinano l’evoluzione.",
        "principlePt": "Distinga empuxo da hélice, fluxo sobre o leme e efeito lateral das pás; rotação, marcha e posição do leme determinam a evolução.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · elica, timone e stabilità", "Anexo A · hélice, leme e estabilidade")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "motori": {
        "titleIt": "Propulsione a motore",
        "titlePt": "Propulsão a motor",
        "principleIt": "Applica il ciclo e la funzione reale dei componenti: alimentazione, accensione o iniezione, lubrificazione, raffreddamento, scarico e trasmissione.",
        "principlePt": "Aplique o ciclo e a função real dos componentes: alimentação, ignição ou injeção, lubrificação, arrefecimento, escape e transmissão.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · motori", "Anexo A · motores")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "motori-avarie": {
        "titleIt": "Irregolarità e piccole avarie",
        "titlePt": "Irregularidades e pequenas avarias",
        "principleIt": "Prima proteggi persone e impianto, poi diagnostica per sintomo; pressione olio, temperatura e ingresso d’acqua richiedono interventi immediati e compatibili con la sicurezza.",
        "principlePt": "Primeiro proteja pessoas e instalação, depois diagnostique pelo sintoma; pressão do óleo, temperatura e entrada de água exigem ação imediata e segura.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · avarie non specialistiche", "Anexo A · avarias não especializadas")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "autonomia": {
        "titleIt": "Autonomia e riserva di carburante",
        "titlePt": "Autonomia e reserva de combustível",
        "principleIt": "Calcola consumo orario e durata utile mantenendo la riserva richiesta dal quesito; non confondere quantità disponibile, consumo totale e margine di sicurezza.",
        "principlePt": "Calcule consumo horário e duração útil mantendo a reserva pedida; não confunda quantidade disponível, consumo total e margem de segurança.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · calcolo dell’autonomia", "Anexo A · cálculo de autonomia")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "dotazioni": {
        "titleIt": "Dotazioni, visite e certificazioni",
        "titlePt": "Equipamentos, inspeções e certificados",
        "principleIt": "Le dotazioni dipendono dalla navigazione effettivamente svolta e dalla distanza dalla costa; per uso reale consulta sempre gli allegati vigenti, aggiornati nel 2024.",
        "principlePt": "Os equipamentos dependem da navegação efetivamente realizada e da distância da costa; para uso real consulte sempre os anexos vigentes, atualizados em 2024.",
        "sources": [
            source_ref("regolamento-146", "Capo IV e allegati · sicurezza", "Capítulo IV e anexos · segurança"),
            source_ref("regolamento-133-2024", "Artt. 59–96 e allegati", "Arts. 59–96 e anexos"),
        ],
        "primarySource": "regolamento-133-2024",
        "currency": "current-check",
    },
    "incendio": {
        "titleIt": "Prevenzione incendi ed estintori",
        "titlePt": "Prevenção de incêndio e extintores",
        "principleIt": "Elimina combustibile, comburente o calore senza esporre l’equipaggio; l’agente estinguente deve essere adatto alla classe d’incendio e usato mantenendo una via di fuga.",
        "principlePt": "Elimine combustível, comburente ou calor sem expor a tripulação; o agente extintor deve servir à classe de incêndio e ser usado mantendo rota de fuga.",
        "sources": [
            source_ref("vigili-estintori", "Classi e impiego degli estintori", "Classes e uso dos extintores"),
            source_ref("regolamento-146", "Protezione antincendio", "Proteção contra incêndio"),
        ],
        "primarySource": "vigili-estintori",
        "currency": "current-check",
    },
    "sinistri": {
        "titleIt": "Sinistri e salvaguardia delle persone",
        "titlePt": "Sinistros e proteção das pessoas",
        "principleIt": "La priorità è salvare le persone, limitare il danno e chiedere assistenza con informazioni chiare; ogni manovra successiva dipende dal tipo di sinistro.",
        "principlePt": "A prioridade é salvar pessoas, limitar danos e pedir assistência com informações claras; as ações seguintes dependem do tipo de sinistro.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · sinistri, soccorso e abbandono", "Anexo A · sinistros, socorro e abandono")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "maltempo": {
        "titleIt": "Navigazione con cattivo tempo",
        "titlePt": "Navegação com mau tempo",
        "principleIt": "Riduci esposizione e velocità, assicura persone e materiali, mantieni governo e tenuta stagna e scegli una rotta compatibile con vento, onda e costa sottovento.",
        "principlePt": "Reduza exposição e velocidade, prenda pessoas e materiais, mantenha governo e estanqueidade e escolha rota compatível com vento, onda e costa a sotavento.",
        "sources": [
            source_ref("mit-programma-2021", "Allegato A · precauzioni con tempo cattivo", "Anexo A · precauções com mau tempo"),
            source_ref("meteoam", "Avvisi di burrasca e scala Beaufort", "Avisos de temporal e escala Beaufort"),
        ],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "radio": {
        "titleIt": "Radio, assistenza e soccorso",
        "titlePt": "Rádio, assistência e socorro",
        "principleIt": "Distingui licenza della stazione, certificato dell’operatore e procedura di chiamata; in emergenza usa priorità, canale e dati identificativi appropriati.",
        "principlePt": "Distinga licença da estação, certificado do operador e procedimento de chamada; em emergência use prioridade, canal e dados de identificação adequados.",
        "sources": [source_ref("mimit-radio", "Licenze, certificati, MMSI, VHF ed EPIRB", "Licenças, certificados, MMSI, VHF e EPIRB")],
        "primarySource": "mimit-radio",
        "currency": "current-check",
    },
    "cirm": {
        "titleIt": "Assistenza medica CIRM",
        "titlePt": "Assistência médica CIRM",
        "principleIt": "Il CIRM presta assistenza medica marittima a distanza: comunica identità, posizione, sintomi, parametri, farmaci disponibili e recapito radio o telefonico.",
        "principlePt": "O CIRM presta assistência médica marítima à distância: informe identidade, posição, sintomas, parâmetros, medicamentos disponíveis e contato rádio ou telefônico.",
        "sources": [source_ref("cirm", "Servizio TMAS e richiesta di assistenza", "Serviço TMAS e pedido de assistência")],
        "primarySource": "cirm",
        "currency": "current-check",
    },
    "alcol": {
        "titleIt": "Alterazione psicofisica",
        "titlePt": "Alteração psicofísica",
        "principleIt": "Il comando richiede piena capacità di giudizio e reazione; alcol e sostanze aumentano rischio e responsabilità e sono disciplinati dal Codice della nautica.",
        "principlePt": "O comando exige plena capacidade de julgamento e reação; álcool e substâncias aumentam risco e responsabilidade e são regulados pelo Código náutico.",
        "sources": [source_ref("codice-nautica", "Disposizioni su comando, condotta e sanzioni", "Disposições sobre comando, condução e sanções")],
        "primarySource": "codice-nautica",
        "currency": "current-check",
    },
    "manovra": {
        "titleIt": "Manovra, porto e prossimità della costa",
        "titlePt": "Manobra, porto e proximidade da costa",
        "principleIt": "Valuta abbrivio, vento, corrente, spazio e ordinanze locali; velocità e manovra devono permettere controllo continuo e arresto in sicurezza.",
        "principlePt": "Avalie seguimento, vento, corrente, espaço e normas locais; velocidade e manobra devem permitir controle contínuo e parada segura.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · manovra e condotta", "Anexo A · manobra e condução")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "ormeggio": {
        "titleIt": "Ormeggio e disormeggio",
        "titlePt": "Atracação e desatracação",
        "principleIt": "Cime e manovre controllano i movimenti rispetto a banchina, vento e corrente; prepara parabordi, ordine delle cime e via d’uscita prima di impegnare lo spazio.",
        "principlePt": "Cabos e manobras controlam movimentos em relação ao cais, vento e corrente; prepare defensas, ordem dos cabos e saída antes de ocupar o espaço.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · manovra e condotta", "Anexo A · manobra e condução")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "ancoraggio": {
        "titleIt": "Ancoraggio",
        "titlePt": "Fundeio",
        "principleIt": "Scelta del fondo, profondità, calumo, spazio di giro e verifica della tenuta determinano un ancoraggio sicuro; divieti e aree protette prevalgono sempre.",
        "principlePt": "Tipo de fundo, profundidade, filame, área de giro e teste de tença determinam um fundeio seguro; proibições e áreas protegidas sempre prevalecem.",
        "sources": [
            source_ref("mit-programma-2021", "Allegato A · ancoraggio", "Anexo A · fundeio"),
            source_ref("iim-pubblicazioni", "Portolano e informazioni per rade e ancoraggi", "Roteiro e informações para enseadas e fundeadouros"),
        ],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "colreg-abbordi": {
        "titleIt": "Prevenzione degli abbordi",
        "titlePt": "Prevenção de abalroamentos",
        "principleIt": "Prima identifica visibilità, tipo di incontro e responsabilità; poi esegui una manovra tempestiva, evidente e conforme alle Regole COLREG.",
        "principlePt": "Primeiro identifique visibilidade, tipo de encontro e responsabilidade; depois faça manobra antecipada, clara e conforme às COLREG.",
        "sources": [source_ref("colreg-1972", "Regole 1–19", "Regras 1–19")],
        "primarySource": "colreg-1972",
        "currency": "current-check",
    },
    "colreg-segnali": {
        "titleIt": "Fanali, sagome e segnali",
        "titlePt": "Luzes, marcas e sinais",
        "principleIt": "Leggi insieme colore, settore, disposizione e stato dell’unità; un singolo fanale isolato non basta se il quesito descrive una configurazione completa.",
        "principlePt": "Leia em conjunto cor, setor, disposição e condição da embarcação; uma luz isolada não basta quando a questão descreve configuração completa.",
        "sources": [source_ref("colreg-1972", "Regole 20–37 e allegati", "Regras 20–37 e anexos")],
        "primarySource": "colreg-1972",
        "currency": "current-check",
    },
    "iala": {
        "titleIt": "Segnalamento marittimo IALA",
        "titlePt": "Balizamento marítimo IALA",
        "principleIt": "Forma, colore, miraglio e ritmo luminoso identificano la funzione del segnale; per i laterali considera anche regione e direzione convenzionale del segnalamento.",
        "principlePt": "Forma, cor, marca de tope e ritmo luminoso identificam a função; nos laterais considere também região e direção convencional do balizamento.",
        "sources": [source_ref("iala-buoyage", "Sistema IALA · segnali marittimi", "Sistema IALA · sinais marítimos")],
        "primarySource": "iala-buoyage",
        "currency": "stable",
    },
    "meteo": {
        "titleIt": "Elementi e strumenti meteorologici",
        "titlePt": "Elementos e instrumentos meteorológicos",
        "principleIt": "Interpreta pressione, tendenza, temperatura, umidità, nubi e fronti come insieme; uno strumento misura una grandezza specifica, non direttamente il tempo futuro.",
        "principlePt": "Interprete pressão, tendência, temperatura, umidade, nuvens e frentes em conjunto; cada instrumento mede uma grandeza, não diretamente o tempo futuro.",
        "sources": [
            source_ref("mit-programma-2021", "Allegato A · meteorologia", "Anexo A · meteorologia"),
            source_ref("meteoam", "Documentazione tecnica meteorologica", "Documentação técnica meteorológica"),
        ],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "meteo-bollettini": {
        "titleIt": "Bollettini e previsioni",
        "titlePt": "Boletins e previsões",
        "principleIt": "Distingui osservazione, previsione e avviso; area, validità temporale, vento, mare e fenomeni significativi devono essere letti nel loro contesto.",
        "principlePt": "Distinga observação, previsão e aviso; área, validade, vento, mar e fenômenos relevantes devem ser lidos em contexto.",
        "sources": [source_ref("meteoam", "Avvisi e scala Beaufort", "Avisos e escala Beaufort")],
        "primarySource": "meteoam",
        "currency": "current-check",
    },
    "venti": {
        "titleIt": "Venti",
        "titlePt": "Ventos",
        "principleIt": "Il vento è denominato dalla direzione di provenienza; intensità, variazioni locali e interazione con costa e pressione determinano gli effetti sulla navigazione.",
        "principlePt": "O vento é nomeado pela direção de onde vem; intensidade, variações locais e interação com costa e pressão determinam os efeitos na navegação.",
        "sources": [source_ref("meteoam", "Scala Beaufort e vento", "Escala Beaufort e vento")],
        "primarySource": "meteoam",
        "currency": "stable",
    },
    "coordinate": {
        "titleIt": "Coordinate geografiche",
        "titlePt": "Coordenadas geográficas",
        "principleIt": "La latitudine si misura dall’Equatore verso nord o sud; la longitudine dal meridiano di Greenwich verso est o ovest, usando gradi e primi coerenti.",
        "principlePt": "A latitude é medida do Equador para norte ou sul; a longitude de Greenwich para leste ou oeste, usando graus e minutos coerentes.",
        "sources": [
            source_ref("mit-programma-2021", "Allegato A · coordinate geografiche", "Anexo A · coordenadas geográficas"),
            source_ref("iim-carte", "Rappresentazioni e reticolo geografico", "Representações e grade geográfica"),
        ],
        "primarySource": "iim-carte",
        "currency": "stable",
    },
    "carte": {
        "titleIt": "Carte nautiche e Mercatore",
        "titlePt": "Cartas náuticas e Mercator",
        "principleIt": "Scala, proiezione e simboli stabiliscono cosa si può misurare: su Mercatore la lossodromia è retta e distanze e latitudini si leggono sulla scala laterale.",
        "principlePt": "Escala, projeção e símbolos determinam o que pode ser medido: em Mercator a loxodromia é reta e distâncias e latitudes são lidas na escala lateral.",
        "sources": [source_ref("iim-carte", "Mercatore, gnomonica, scale e tipi di carta", "Mercator, gnomônica, escalas e tipos de carta")],
        "primarySource": "iim-carte",
        "currency": "stable",
    },
    "orientamento": {
        "titleIt": "Orientamento e rosa dei venti",
        "titlePt": "Orientação e rosa dos ventos",
        "principleIt": "Direzioni e prore sono angoli da 000° a 360° misurati in senso orario dal nord di riferimento indicato.",
        "principlePt": "Direções e proas são ângulos de 000° a 360° medidos no sentido horário a partir do norte indicado.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · orientamento e rosa dei venti", "Anexo A · orientação e rosa dos ventos")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "bussola": {
        "titleIt": "Bussola magnetica",
        "titlePt": "Bússola magnética",
        "principleIt": "Separa nord vero, magnetico e bussola; declinazione e deviazione si applicano con segno coerente nelle operazioni di correzione e conversione.",
        "principlePt": "Separe norte verdadeiro, magnético e da agulha; declinação e desvio entram com sinal coerente nas correções e conversões.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · bussole magnetiche", "Anexo A · bússolas magnéticas")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "stima": {
        "titleIt": "Navigazione stimata",
        "titlePt": "Navegação estimada",
        "principleIt": "Applica la relazione spazio = velocità × tempo con unità coerenti; il punto stimato dipende da rotta, velocità, tempo e dagli effetti non osservati.",
        "principlePt": "Aplique distância = velocidade × tempo com unidades coerentes; a posição estimada depende de rumo, velocidade, tempo e efeitos não observados.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · tempo, spazio e velocità", "Anexo A · tempo, distância e velocidade")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "vento-corrente": {
        "titleIt": "Prora, rotta, scarroccio e deriva",
        "titlePt": "Proa, rumo, abatimento e deriva",
        "principleIt": "La prora è l’orientamento dello scafo; la rotta è il percorso sul fondo. Vento e corrente generano spostamenti distinti da comporre vettorialmente.",
        "principlePt": "Proa é a orientação do casco; rumo é o percurso sobre o fundo. Vento e corrente geram deslocamentos distintos, combinados vetorialmente.",
        "sources": [source_ref("mit-programma-2021", "Allegato A · deriva e scarroccio", "Anexo A · deriva e abatimento")],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "costiera": {
        "titleIt": "Navigazione costiera",
        "titlePt": "Navegação costeira",
        "principleIt": "Un luogo di posizione nasce da una misura osservabile; due o più luoghi indipendenti permettono di determinare il punto nave e valutarne l’incertezza.",
        "principlePt": "Uma linha de posição nasce de medida observável; duas ou mais linhas independentes permitem determinar a posição e sua incerteza.",
        "sources": [
            source_ref("mit-programma-2021", "Allegato A · navigazione costiera", "Anexo A · navegação costeira"),
            source_ref("iim-carte", "Carte per navigazione costiera", "Cartas para navegação costeira"),
        ],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "elettronica": {
        "titleIt": "Navigazione elettronica",
        "titlePt": "Navegação eletrônica",
        "principleIt": "GPS, ecoscandaglio, radar e AIS sono ausili con funzioni diverse; dati, allarmi e precisione devono essere verificati con carta e osservazione.",
        "principlePt": "GPS, ecobatímetro, radar e AIS são auxílios diferentes; dados, alarmes e precisão devem ser verificados com carta e observação.",
        "sources": [
            source_ref("mit-programma-2021", "Allegato A · navigazione elettronica", "Anexo A · navegação eletrônica"),
            source_ref("mimit-radio", "AIS, EPIRB e apparati radio", "AIS, EPIRB e equipamentos rádio"),
        ],
        "primarySource": "mit-quiz-2022",
        "currency": "stable",
    },
    "pubblicazioni": {
        "titleIt": "Pubblicazioni nautiche",
        "titlePt": "Publicações náuticas",
        "principleIt": "Carta, Portolano, Elenco fari, Radioservizi e Avvisi ai naviganti hanno funzioni complementari e devono essere aggiornati.",
        "principlePt": "Carta, roteiro, lista de faróis, serviços rádio e avisos aos navegantes têm funções complementares e devem estar atualizados.",
        "sources": [source_ref("iim-pubblicazioni", "Portolani, fari, radioservizi e Avvisi", "Roteiros, faróis, serviços rádio e avisos")],
        "primarySource": "iim-pubblicazioni",
        "currency": "current-check",
    },
    "normativa": {
        "titleIt": "Leggi e regolamenti del diporto",
        "titlePt": "Leis e regulamentos da náutica de recreio",
        "principleIt": "Distingui natante, imbarcazione e nave, titolo abilitativo, uso e distanza dalla costa; per la vita reale prevale il testo vigente, non la formulazione storica del quiz.",
        "principlePt": "Distinga embarcação miúda, embarcação e navio, habilitação, uso e distância da costa; na prática prevalece o texto vigente, não a redação histórica do quiz.",
        "sources": [
            source_ref("codice-nautica", "Codice della nautica da diporto", "Código da náutica de recreio"),
            source_ref("regolamento-146", "Regolamento di attuazione", "Regulamento de aplicação"),
            source_ref("regolamento-133-2024", "Modifiche 2024", "Alterações de 2024"),
            source_ref("mit-normativa", "Indice degli aggiornamenti MIT", "Índice de atualizações do MIT"),
        ],
        "primarySource": "codice-nautica",
        "currency": "current-check",
    },
    "comandante": {
        "titleIt": "Comandante, conduttore e utilizzatore",
        "titlePt": "Comandante, condutor e utilizador",
        "principleIt": "Comando e condotta comportano doveri e responsabilità proprie; proprietà, leasing o presenza dell’armatore non trasferiscono automaticamente la direzione nautica.",
        "principlePt": "Comando e condução geram deveres e responsabilidades próprios; propriedade, leasing ou presença do armador não transferem automaticamente a direção náutica.",
        "sources": [source_ref("codice-nautica", "Comando, condotta, utilizzatore e sanzioni", "Comando, condução, utilizador e sanções")],
        "primarySource": "codice-nautica",
        "currency": "current-check",
    },
    "commerciale": {
        "titleIt": "Uso commerciale dell’unità",
        "titlePt": "Uso comercial da embarcação",
        "principleIt": "Locazione, noleggio, insegnamento e appoggio immersioni sono usi distinti, con soggetti, responsabilità e requisiti specifici.",
        "principlePt": "Locação, fretamento, ensino e apoio a mergulho são usos distintos, com sujeitos, responsabilidades e requisitos específicos.",
        "sources": [source_ref("codice-nautica", "Art. 2 e disciplina dell’uso commerciale", "Art. 2 e disciplina do uso comercial")],
        "primarySource": "codice-nautica",
        "currency": "current-check",
    },
    "documenti": {
        "titleIt": "Documenti di bordo",
        "titlePt": "Documentos de bordo",
        "principleIt": "Ogni documento prova un requisito diverso dell’unità, del motore, della stazione radio, dell’assicurazione o del conduttore; obbligo e forma dipendono dal caso.",
        "principlePt": "Cada documento comprova requisito distinto da embarcação, motor, rádio, seguro ou condutor; obrigação e forma dependem do caso.",
        "sources": [
            source_ref("codice-nautica", "Documenti e regime amministrativo", "Documentos e regime administrativo"),
            source_ref("mimit-radio", "Licenza di esercizio radio", "Licença de estação rádio"),
        ],
        "primarySource": "codice-nautica",
        "currency": "current-check",
    },
    "sci": {
        "titleIt": "Sci nautico",
        "titlePt": "Esqui aquático",
        "principleIt": "Servono patente, equipaggio e dotazioni specifiche; distanze, corridoi, partenza e rientro restano subordinati anche all’ordinanza locale.",
        "principlePt": "São necessários habilitação, tripulação e equipamentos específicos; distâncias, corredores, saída e retorno também dependem da norma local.",
        "sources": [
            source_ref("sci-nautico-1960", "DM 26 gennaio 1960 · disciplina nazionale", "DM 26 de janeiro de 1960 · disciplina nacional", page=9),
            source_ref("mit-normativa", "Aggiornamenti e ordinanze da verificare", "Atualizações e normas locais a verificar"),
        ],
        "primarySource": "sci-nautico-1960",
        "currency": "current-check",
    },
    "pesca": {
        "titleIt": "Pesca sportiva e subacquea",
        "titlePt": "Pesca esportiva e subaquática",
        "principleIt": "La pesca sportiva non ha fine commerciale; attrezzi, quantità, segnalazione del subacqueo, distanze e campagne di specie protette seguono norme specifiche e aggiornabili.",
        "principlePt": "A pesca esportiva não tem fim comercial; petrechos, quantidades, sinalização do mergulhador, distâncias e campanhas de espécies protegidas seguem normas específicas e atualizáveis.",
        "sources": [source_ref("pesca-1639", "Pesca sportiva e subacquea · artt. 128–142", "Pesca esportiva e subaquática · arts. 128–142")],
        "primarySource": "pesca-1639",
        "currency": "current-check",
    },
    "ambiente": {
        "titleIt": "Tutela ambientale e aree marine protette",
        "titlePt": "Proteção ambiental e áreas marinhas protegidas",
        "principleIt": "Scarichi e rifiuti in mare sono vietati o strettamente regolati; nelle aree protette il decreto istitutivo e il regolamento di gestione determinano attività, zone, ormeggio e ancoraggio.",
        "principlePt": "Descargas e resíduos no mar são proibidos ou estritamente regulados; nas áreas protegidas, decreto e regulamento definem atividades, zonas, amarração e fundeio.",
        "sources": [
            source_ref("codice-ambiente", "Tutela delle acque, scarichi e rifiuti", "Proteção das águas, descargas e resíduos"),
            source_ref("aree-protette-394", "Artt. 18–19 · aree marine protette", "Arts. 18–19 · áreas marinhas protegidas"),
            source_ref("mase-aree-protette", "Portale delle aree protette", "Portal das áreas protegidas"),
        ],
        "primarySource": "codice-ambiente",
        "currency": "current-check",
    },
}


TOPIC_RULE = {
    "Nomenclatura delle parti principali dello scafo": "scafo",
    "Effetti evolutivi dell'elica e del timone. Elementi di stabilità dell'unità.": "governo",
    "Elementi di funzionamento dei sistemi di propulsione a motore": "motori",
    "Irregolarità e piccole avarie che possono prevedere un intervento non specialistico": "motori-avarie",
    "Irregolarità, piccole avarie e modo di rimediarvi": "motori-avarie",
    "Calcolo dell'autonomia": "autonomia",
    "Calcolo dell'autonomia in relazione alla potenza del motore ed alla quantità residua di carburante": "autonomia",
    "Dotazioni di sicurezza e mezzi di salvataggio": "dotazioni",
    "Tipi di visite, loro periodicità e certificazioni": "dotazioni",
    "Prevenzione degli incendi e uso degli estintori": "incendio",
    "Provvedimenti da adottare in caso di sinistro marittimo (incendio, collisione, falla, incaglio, uomo a mare)": "sinistri",
    "Sinistro e abbandono dell'unità": "sinistri",
    "Precauzioni da adottare in caso di navigazione con tempo cattivo": "maltempo",
    "Corretto uso degli apparati radio di bordo e chiamate di soccorso": "radio",
    "Comunicazioni radiotelefoniche e relative procedure: assistenza e soccorso": "radio",
    "Centro Internazionale Radio Medico (CIRM).": "cirm",
    "Rischi derivanti dalla conduzione dell'unità sotto l'influenza di alcol o in stato di alterazione psico-fisica per l'uso di sostanze stupefacenti o psicotrope": "alcol",
    "Precauzioni all'ingresso e all'uscita dei porti": "manovra",
    "Navigazione in prossimità della costa": "manovra",
    "Ormeggio e disormeggio": "ormeggio",
    "Ancoraggio": "ancoraggio",
    "Prevenire gli abbordi in mare": "colreg-abbordi",
    "Fanali e segnali diurni": "colreg-segnali",
    "I principali fanali luminosi e il sistema IALA": "iala",
    "Elementi di meteorologia e strumenti": "meteo",
    "Bollettini meteorologici e previsioni locali": "meteo-bollettini",
    "Venti": "venti",
    "Coordinate geografiche": "coordinate",
    "Carte nautiche e proiezione di Mercatore": "carte",
    "Orientamento e rosa dei venti": "orientamento",
    "Bussole magnetiche": "bussola",
    "Elementi di navigazione stimata: tempo, spazio e velocità": "stima",
    "Prora e rotta, scarroccio e deriva per effetto del vento e della corrente": "vento-corrente",
    "Elementi di navigazione costiera": "costiera",
    "Navigazione elettronica": "elettronica",
    "Pubblicazioni": "pubblicazioni",
    "": "normativa",
    "Leggi e regolamenti": "normativa",
    "Comandante, conduttore, utilizzatore": "comandante",
    "Attività commerciale": "commerciale",
    "Attvità commerciale": "commerciale",
    "Documenti": "documenti",
    "Sci nautico": "sci",
    "Pesca": "pesca",
    "Norme ambientali": "ambiente",
}


QUESTION_OVERRIDES = {
    1464: {
        "primarySource": "ispra-oli-usati",
        "specificIt": "Cinque litri di olio usato possono formare una pellicola di circa 5.000 m² che ostacola l’ossigenazione dell’acqua. Per questo la dispersione è vietata; l’ordine di grandezza corrisponde a circa una volta e mezzo un campo da calcio.",
        "specificPt": "Cinco litros de óleo usado podem formar uma película de cerca de 5.000 m² que dificulta a oxigenação da água. Por isso a dispersão é proibida; a ordem de grandeza equivale a cerca de um campo e meio de futebol.",
        "sourceRefs": [
            source_ref(
                "ispra-oli-usati",
                "Pagina 10 · cinque litri coprono circa 5.000 m²",
                "Página 10 · cinco litros cobrem cerca de 5.000 m²",
                page=10,
            )
        ],
    }
}


def build_source_catalog() -> dict:
    sources = []
    for spec in SOURCE_SPECS:
        source = dict(spec)
        local_file = source.get("localFile")
        if local_file:
            path = ROOT / "sources" / local_file
            if not path.is_file():
                raise FileNotFoundError(f"Fonte locale mancante: {path}")
            source["bytes"] = path.stat().st_size
            source["sha256"] = sha256(path)
            if path.suffix.lower() == ".pdf":
                source["pages"] = len(PdfReader(str(path)).pages)
        sources.append(source)
    return {
        "schemaVersion": 1,
        "checkedOn": CHECKED_ON,
        "policy": {
            "it": "Solo atti, siti e pubblicazioni ufficiali o istituzionali. Le spiegazioni sono originali di Rotta 12; nessun manuale o contenuto didattico privato è riprodotto.",
            "pt": "Somente atos, sites e publicações oficiais ou institucionais. As explicações são originais do Rotta 12; nenhum manual ou conteúdo didático privado é reproduzido.",
        },
        "sources": sources,
    }


def official_quiz_pages(quiz: list[dict]) -> dict[int, int]:
    reader = PdfReader(str(OFFICIAL_QUIZ_PATH))
    pages = [normalize(page.extract_text() or "") for page in reader.pages]
    result = {}
    for question in quiz:
        question_text = normalize(question["question"])
        candidates: list[int] = []
        for length in (100, 80, 60, 45, 32):
            needle = question_text[:length].strip()
            candidates = [
                index + 1
                for index, page_text in enumerate(pages)
                if needle and needle in page_text
            ]
            if candidates:
                break
        if len(candidates) > 1:
            code = normalize(question["code"])
            pattern = re.compile(rf"(?<!\d){re.escape(code)}(?!\d)")
            coded = [
                page
                for page in candidates
                if code and pattern.search(pages[page - 1])
            ]
            if len(coded) == 1:
                candidates = coded
        if len(candidates) != 1:
            raise RuntimeError(
                f"Impossibile localizzare univocamente il quesito {question['id']}: {candidates}"
            )
        result[question["id"]] = candidates[0]
    return result


def build_question_references(quiz: list[dict], official_pages: dict[int, int]) -> dict:
    references = []
    rule_counts = {rule_id: 0 for rule_id in RULES}
    for question in quiz:
        topic = question.get("topic", "")
        rule_id = TOPIC_RULE.get(topic)
        if not rule_id:
            raise RuntimeError(
                f"Argomento senza regola: {question['theme']} / {topic}"
            )
        rule_counts[rule_id] += 1
        reference = {
            "id": question["id"],
            "officialPage": official_pages[question["id"]],
            "rule": rule_id,
        }
        reference.update(QUESTION_OVERRIDES.get(question["id"], {}))
        if "correct" in reference or "answer" in reference:
            raise RuntimeError("La reference layer non può contenere il gabarito")
        references.append(reference)
    return {
        "schemaVersion": 1,
        "generatedOn": CHECKED_ON,
        "summary": {
            "questions": len(references),
            "rules": sum(1 for count in rule_counts.values() if count),
            "questionSpecificExplanations": len(QUESTION_OVERRIDES),
            "officialPageCoverage": len(official_pages),
            "ruleCounts": rule_counts,
        },
        "rules": RULES,
        "references": references,
    }


def main() -> None:
    quiz = load_quiz()
    catalog = build_source_catalog()
    official_pages = official_quiz_pages(quiz)
    references = build_question_references(quiz, official_pages)
    SOURCES_OUTPUT.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    REFERENCES_OUTPUT.write_text(
        json.dumps(references, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Fonti: {len(catalog['sources'])}; "
        f"quesiti: {len(references['references'])}; "
        f"pagine MIT: {len(official_pages)}"
    )


if __name__ == "__main__":
    main()
