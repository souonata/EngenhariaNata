// Manual do proprietário — Apêndices A (RPN e a pilha), B (Modo ALG), C (Mais
// sobre a TIR) e F (Autoteste). Os Apêndices D (condições de erro) e E
// (fórmulas) não têm tabelas Keystrokes|Display — só texto de referência — e
// o G (cálculos do Reino Unido) segue o mesmo precedente do User Guide de
// ficar fora (regulatório, sem teclas testáveis).
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const handbookApendiceA = [
  {
    nome: "p173 — Constant via T-register (triple ENTER): $84,000 doubling for 3 years",
    modo: "rpn",
    titulo: { pt: "Constante no registrador T (ENTER×3)", it: "Costante nel registro T (ENTER×3)" },
    objetivo: {
      pt: "Guardar um número como constante nos registradores Y, Z e T (apertando ENTER 3 vezes) para multiplicar repetidamente por ele.",
      it: "Memorizzare un numero come costante nei registri Y, Z e T (premendo ENTER 3 volte) per moltiplicare ripetutamente per esso.",
    },
    tags: ["rpn", "pilha", "stack", "constante", "costante", "enter", "vendas", "vendite"],
    linhas: [
      { keys: ["2", "ENTER", "ENTER", "ENTER"], display: "2.00", nota: { pt: "ENTER 3× copia o 2 para Y, Z e T também (constante guardada).", it: "ENTER 3× copia il 2 anche in Y, Z e T (costante memorizzata)." } },
      { keys: ["84000", "×"], display: "168,000.00", nota: { pt: "Vendas do ano 1: 84.000 × 2 = 168.000 (T ainda guarda o 2).", it: "Vendite anno 1: 84.000 × 2 = 168.000 (T conserva ancora il 2)." } },
      { keys: ["×"], display: "336,000.00", nota: { pt: "Vendas do ano 2: ×2 de novo → 336.000.", it: "Vendite anno 2: ×2 di nuovo → 336.000." } },
      { keys: ["×"], display: "672,000.00", nota: { pt: "Vendas do ano 3: ×2 de novo → 672.000.", it: "Vendite anno 3: ×2 di nuovo → 672.000." } },
    ],
  },
  {
    nome: "p174 — Constant with CLx reset: package costs (15, 75, 250 units @ $4.38)",
    modo: "rpn",
    titulo: { pt: "Constante com CLx (preço de embalagens)", it: "Costante con CLx (prezzo di confezioni)" },
    objetivo: {
      pt: "Usar CLx entre as contas para limpar o visor sem perder a constante guardada em Y/Z/T (evita que a pilha suba e a constante suma).",
      it: "Usare CLx tra i calcoli per pulire il display senza perdere la costante memorizzata in Y/Z/T (evita che lo stack salga e la costante sparisca).",
    },
    tags: ["rpn", "pilha", "stack", "constante", "costante", "clx", "embalagem", "confezione"],
    linhas: [
      { keys: ["4.38", "ENTER", "ENTER", "ENTER"], display: "4.38", nota: { pt: "ENTER 3× guarda 4,38 como constante em Y, Z e T.", it: "ENTER 3× memorizza 4,38 come costante in Y, Z e T." } },
      { keys: ["15", "×"], display: "65.70", nota: { pt: "Embalagem de 15 unidades: 15 × 4,38 = 65,70.", it: "Confezione da 15 unità: 15 × 4,38 = 65,70." } },
      { keys: ["CLx", "75", "×"], display: "328.50", nota: { pt: "CLx limpa sem subir a pilha; 75 × 4,38 = 328,50.", it: "CLx pulisce senza far salire lo stack; 75 × 4,38 = 328,50." } },
      { keys: ["CLx", "250", "×"], display: "1,095.00", nota: { pt: "CLx de novo; 250 × 4,38 = 1.095,00.", it: "CLx di nuovo; 250 × 4,38 = 1.095,00." } },
    ],
  },
];

export const handbookApendiceB = [
  {
    nome: "p175 — Simple arithmetic in ALG: 21.1 + 23.8 = 44.90",
    modo: "alg",
    titulo: { pt: "Aritmética simples em ALG", it: "Aritmetica semplice in ALG" },
    objetivo: { pt: "Soma simples no modo algébrico (ALG), pressionando = ao final.", it: "Somma semplice in modalità algebrica (ALG), premendo = alla fine." },
    tags: ["alg", "algébrico", "algebrico", "soma", "somma"],
    linhas: [
      { keys: ["21.1", "+"], display: "21.10", nota: { pt: "Digita 21,1 e o operador +.", it: "Digita 21,1 e l'operatore +." } },
      { keys: ["23.8", "="], display: "44.90", nota: { pt: "= conclui: 21,1 + 23,8 = 44,90.", it: "= conclude: 21,1 + 23,8 = 44,90." } },
    ],
  },
  {
    nome: "p175-176 — Chained ALG without intermediate '=': √65×12=96.75, then ÷3.5=27.64",
    modo: "alg",
    titulo: { pt: "Cadeia em ALG sem = intermediário", it: "Catena in ALG senza = intermedio" },
    objetivo: {
      pt: "Uma conta em ALG (77,35−90,89), depois uma nova em cadeia (√65×12÷3,5) sem apertar = entre os passos — só no final.",
      it: "Un calcolo in ALG (77,35−90,89), poi uno nuovo in catena (√65×12÷3,5) senza premere = tra i passaggi — solo alla fine.",
    },
    tags: ["alg", "algébrico", "algebrico", "cadeia", "catena", "raiz", "radice"],
    linhas: [
      { keys: ["77.35", "-"], display: "77.35", nota: { pt: "Digita 77,35 e o operador −.", it: "Digita 77,35 e l'operatore −." } },
      { keys: ["90.89", "="], display: "-13.54", nota: { pt: "= conclui: 77,35 − 90,89 = −13,54.", it: "= conclude: 77,35 − 90,89 = −13,54." } },
      { keys: ["65", "g", "√x", "×", "12", "="], display: "96.75", nota: { pt: "Nova conta: √65 × 12 = 96,75.", it: "Nuovo calcolo: √65 × 12 = 96,75." } },
      { keys: ["÷", "3.5", "="], display: "27.64", nota: { pt: "Continua a cadeia sem repetir números: ÷3,5 → 27,64.", it: "Continua la catena senza ripetere i numeri: ÷3,5 → 27,64." } },
    ],
  },
  {
    nome: "p176 — Negative numbers in ALG: -75 × 7.1 = -532.50",
    modo: "alg",
    titulo: { pt: "Números negativos em ALG (CHS)", it: "Numeri negativi in ALG (CHS)" },
    objetivo: { pt: "Trocar o sinal de um número já digitado em ALG e multiplicar.", it: "Cambiare il segno di un numero già digitato in ALG e moltiplicare." },
    tags: ["alg", "algébrico", "algebrico", "chs", "negativo", "sinal", "segno"],
    linhas: [
      { keys: ["75", "CHS"], display: "-75", nota: { pt: "CHS troca o sinal de 75 → −75.", it: "CHS cambia il segno di 75 → −75." } },
      { keys: ["×", "7.1", "="], display: "-532.50", nota: { pt: "−75 × 7,1 = −532,50.", it: "−75 × 7,1 = −532,50." } },
    ],
  },
];

// Apêndice C (More About IRR) não tem tabela Keystrokes|Display própria — é
// texto de orientação sobre como "chutar" taxas melhores quando a TIR tem
// múltiplas raízes. Como no User Guide, reusamos aqui o exemplo completo de
// TIR (fluxos agrupados) já verificado na Seção 4 como o "exemplo prático".
export const handbookApendiceC = [
  {
    nome: "p60-61 — IRR (grouped cash flows, full setup, reused as Appendix C's worked example) = 13.72",
    modo: "rpn",
    titulo: { pt: "TIR (IRR) — exemplo completo", it: "TIR (IRR) — esempio completo" },
    objetivo: {
      pt: "Montagem completa de uma série de fluxos agrupados (Nj) e o cálculo da TIR — o Apêndice C explica como refinar o chute quando há mais de uma raiz.",
      it: "Impostazione completa di una serie di flussi raggruppati (Nj) e il calcolo della TIR — l'Appendice C spiega come affinare il tentativo quando c'è più di una radice.",
    },
    tags: ["financeiro", "finanziario", "irr", "tir", "fluxo de caixa", "flusso di cassa", "nj", "retorno", "rendimento"],
    linhas: [
      { keys: ["f", "REG"], display: "0.00", nota: { pt: "Zera os registradores.", it: "Azzera i registri." } },
      { keys: ["79000", "CHS", "g", "CFo"], display: "-79,000.00", nota: { pt: "Investimento inicial: −79.000 (CF0).", it: "Investimento iniziale: −79.000 (CF0)." } },
      { keys: ["14000", "g", "CFj"], display: "14,000.00", nota: { pt: "Ano 1: +14.000.", it: "Anno 1: +14.000." } },
      { keys: ["11000", "g", "CFj"], display: "11,000.00", nota: { pt: "Ano 2: +11.000.", it: "Anno 2: +11.000." } },
      { keys: ["10000", "g", "CFj"], display: "10,000.00", nota: { pt: "Fluxo de +10.000…", it: "Flusso di +10.000…" } },
      { keys: ["3", "g", "Nj"], display: "3.00", nota: { pt: "…por 3 anos (Nj = 3).", it: "…per 3 anni (Nj = 3)." } },
      { keys: ["9100", "g", "CFj"], display: "9,100.00", nota: { pt: "+9.100.", it: "+9.100." } },
      { keys: ["9000", "g", "CFj"], display: "9,000.00", nota: { pt: "Fluxo de +9.000…", it: "Flusso di +9.000…" } },
      { keys: ["2", "g", "Nj"], display: "2.00", nota: { pt: "…por 2 anos (Nj = 2).", it: "…per 2 anni (Nj = 2)." } },
      { keys: ["4500", "g", "CFj"], display: "4,500.00", nota: { pt: "+4.500.", it: "+4.500." } },
      { keys: ["100000", "g", "CFj"], display: "100,000.00", nota: { pt: "Último ano: +100.000.", it: "Ultimo anno: +100.000." } },
      { keys: ["f", "IRR"], display: "13.72", nota: { pt: "TIR = 13,72%.", it: "TIR = 13,72%." } },
    ],
  },
];

// Apêndice F: mesmo autoteste de fábrica do teclado/display do User Guide —
// aqui o Handbook descreve exatamente o mesmo combo (ON + ÷), só que nas suas
// próprias páginas (196-198).
export const handbookApendiceF = [
  {
    nome: "p196-198 — Keyboard/display self-test: ON+÷, all 40 keys in order → 12",
    modo: "rpn",
    titulo: { pt: "Autoteste do teclado e display", it: "Autotest di tastiera e display" },
    objetivo: {
      pt: "O teste de fábrica da 12C: acende todos os segmentos e exige as 40 teclas na ordem física; termina em 12 se tudo estiver ok.",
      it: "Il test di fabbrica della 12C: accende tutti i segmenti ed esige i 40 tasti nell'ordine fisico; finisce a 12 se tutto è a posto.",
    },
    tags: ["autoteste", "autotest", "teclado", "tastiera", "display", "manutenção", "manutenzione", "self-test", "bateria", "batteria"],
    linhas: [
      { keys: ["HOLD", "÷", "ON"], display: "8888888888", nota: { pt: "Segura ÷ e liga (ON): acende todos os segmentos, 8888888888.", it: "Tieni ÷ e accendi (ON): accende tutti i segmenti, 8888888888." } },
      {
        keys: [
          "n", "i", "PV", "PMT", "FV", "CHS", "7", "8", "9", "÷",
          "y^x", "1/x", "%T", "Δ%", "%", "EEX", "4", "5", "6", "×",
          "R/S", "SST", "R↓", "x≷y", "CLx", "ENTER", "1", "2", "3", "-",
          "ON", "f", "g", "STO", "RCL", "ENTER", "0", ".", "Σ+", "+",
        ],
        display: "12",
        nota: {
          pt: "Pressiona as 40 teclas na ordem física (linhas 1→4); se todas respondem, o teste termina em 12.",
          it: "Preme i 40 tasti nell'ordine fisico (righe 1→4); se tutte rispondono, il test finisce a 12.",
        },
      },
    ],
  },
];
