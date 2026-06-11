// Capítulo 1 — Seção 1 do guia (Getting Started).
// Exemplos com tabela explícita de Keystrokes|Display. Pulados (outros capítulos):
//   - EEX/notação científica (Seção 5)
//   - backspace (sem tecla on-screen)
//   - √x na cadeia (Seção 7)
//   - parênteses ALG (provável não implementado / Seção 5)
//
// Campos didáticos (titulo/objetivo/tags por exemplo, nota por linha) são
// bilíngues {pt,it} e usados pelo robô do guia; a suíte de testes os ignora.

export const secao1 = [
  {
    nome: "p21 — Simple arithmetic (RPN): 13 ÷ 2 = 6.50",
    modo: "rpn",
    titulo: { pt: "Aritmética simples (RPN)", it: "Aritmetica semplice (RPN)" },
    objetivo: {
      pt: "Dividir 13 por 2 em RPN — a base do método: o número vem antes da operação.",
      it: "Dividere 13 per 2 in RPN — la base del metodo: il numero precede l'operazione.",
    },
    tags: ["rpn", "aritmética", "aritmetica", "divisão", "divisione", "básico", "base"],
    linhas: [
      { keys: ["13", "ENTER"], display: "13.00", nota: { pt: "Digita 13 e empilha com ENTER (separa do próximo número).", it: "Digita 13 e lo mette nello stack con ENTER (lo separa dal numero seguente)." } },
      { keys: ["2", "÷"], display: "6.50", nota: { pt: "Digita 2 e divide: 13 ÷ 2 = 6,50.", it: "Digita 2 e divide: 13 ÷ 2 = 6,50." } },
    ],
  },
  {
    nome: "p22 — Simple arithmetic (ALG): 21.1 + 23.8 = 44.90",
    modo: "alg",
    titulo: { pt: "Aritmética simples (ALG)", it: "Aritmetica semplice (ALG)" },
    objetivo: {
      pt: "Somar dois números no modo algébrico (ALG), como numa calculadora comum.",
      it: "Sommare due numeri in modalità algebrica (ALG), come una calcolatrice comune.",
    },
    tags: ["alg", "algébrico", "algebrico", "soma", "somma"],
    linhas: [
      { keys: ["CLx", "CLx"], display: "0.00", nota: { pt: "Limpa o visor antes de começar.", it: "Pulisce il display prima di iniziare." } },
      { keys: ["21.1", "+"], display: "21.10", nota: { pt: "Digita 21,1 e o operador +.", it: "Digita 21,1 e l'operatore +." } },
      { keys: ["23.8"], display: "23.8", nota: { pt: "Digita o segundo número, 23,8.", it: "Digita il secondo numero, 23,8." } },
      { keys: ["="], display: "44.90", nota: { pt: "= conclui: 21,1 + 23,8 = 44,90.", it: "= conclude: 21,1 + 23,8 = 44,90." } },
    ],
  },
  {
    nome: "p22 — Chain calculation (ALG): 77.35 − 90.89 = −13.54",
    modo: "alg",
    titulo: { pt: "Cálculo em cadeia (ALG)", it: "Calcolo in catena (ALG)" },
    objetivo: {
      pt: "Subtração no modo ALG que dá resultado negativo.",
      it: "Sottrazione in modalità ALG con risultato negativo.",
    },
    tags: ["alg", "subtração", "sottrazione", "negativo"],
    linhas: [
      { keys: ["CLx", "CLx"], display: "0.00", nota: { pt: "Limpa o visor.", it: "Pulisce il display." } },
      { keys: ["77.35", "-"], display: "77.35", nota: { pt: "Digita 77,35 e o operador −.", it: "Digita 77,35 e l'operatore −." } },
      { keys: ["90.89", "="], display: "-13.54", nota: { pt: "Subtrai 90,89 → −13,54 (resultado negativo).", it: "Sottrae 90,89 → −13,54 (risultato negativo)." } },
    ],
  },
  {
    nome: "p23 — Checkbook chain calculation (RPN) = 1,064.54",
    modo: "rpn",
    titulo: { pt: "Saldo de talão de cheques (RPN)", it: "Saldo del libretto assegni (RPN)" },
    objetivo: {
      pt: "Encadear várias operações sem anotar resultados intermediários — o saldo de uma conta.",
      it: "Concatenare più operazioni senza annotare i risultati intermedi — il saldo di un conto.",
    },
    tags: ["rpn", "cadeia", "catena", "saldo", "conta", "conto", "subtração", "sottrazione"],
    linhas: [
      { keys: ["58.33", "ENTER"], display: "58.33", nota: { pt: "Saldo inicial 58,33 empilhado.", it: "Saldo iniziale 58,33 nello stack." } },
      { keys: ["22.95", "-"], display: "35.38", nota: { pt: "Desconta um cheque de 22,95 → 35,38.", it: "Sottrae un assegno di 22,95 → 35,38." } },
      { keys: ["13.7", "-"], display: "21.68", nota: { pt: "Desconta 13,70 → 21,68.", it: "Sottrae 13,70 → 21,68." } },
      { keys: ["10.14", "-"], display: "11.54", nota: { pt: "Desconta 10,14 → 11,54.", it: "Sottrae 10,14 → 11,54." } },
      { keys: ["1053", "+"], display: "1,064.54", nota: { pt: "Soma um depósito de 1.053 → saldo final 1.064,54.", it: "Aggiunge un deposito di 1.053 → saldo finale 1.064,54." } },
    ],
  },
  {
    nome: "p25 — (3×4)+(5×6) = 42 (RPN)",
    modo: "rpn",
    titulo: { pt: "Soma de dois produtos (RPN)", it: "Somma di due prodotti (RPN)" },
    objetivo: {
      pt: "Ver a pilha guardar um resultado enquanto você calcula outro: (3×4)+(5×6).",
      it: "Vedere lo stack conservare un risultato mentre ne calcoli un altro: (3×4)+(5×6).",
    },
    tags: ["rpn", "pilha", "stack", "multiplicação", "moltiplicazione", "parênteses", "parentesi"],
    linhas: [
      { keys: ["3", "ENTER", "4", "×"], display: "12.00", nota: { pt: "Calcula 3×4 = 12 (fica guardado na pilha).", it: "Calcola 3×4 = 12 (resta nello stack)." } },
      { keys: ["5", "ENTER", "6", "×"], display: "30.00", nota: { pt: "Calcula 5×6 = 30; o 12 anterior subiu na pilha.", it: "Calcola 5×6 = 30; il 12 precedente è salito nello stack." } },
      { keys: ["+"], display: "42.00", nota: { pt: "Soma os dois produtos: 12 + 30 = 42.", it: "Somma i due prodotti: 12 + 30 = 42." } },
    ],
  },
  {
    nome: "p26 — Long chain (ALG): 456−75÷18.5×68÷1.9 = 737.07",
    modo: "alg",
    titulo: { pt: "Cadeia longa (ALG)", it: "Catena lunga (ALG)" },
    objetivo: {
      pt: "Cálculo em cadeia no modo ALG, da esquerda para a direita: 456−75÷18,5×68÷1,9.",
      it: "Calcolo in catena in ALG, da sinistra a destra: 456−75÷18,5×68÷1,9.",
    },
    tags: ["alg", "cadeia", "catena"],
    linhas: [
      { keys: ["CLx", "CLx"], display: "0.00", nota: { pt: "Limpa o visor.", it: "Pulisce il display." } },
      { keys: ["456", "-", "75", "÷"], display: "381.00", nota: { pt: "456 − 75 = 381 (resultado parcial mostrado).", it: "456 − 75 = 381 (risultato parziale mostrato)." } },
      { keys: ["18.5", "×"], display: "20.59", nota: { pt: "381 ÷ 18,5 = 20,59.", it: "381 ÷ 18,5 = 20,59." } },
      { keys: ["68", "÷"], display: "1,400.43", nota: { pt: "20,59 × 68 = 1.400,43.", it: "20,59 × 68 = 1.400,43." } },
      { keys: ["1.9", "="], display: "737.07", nota: { pt: "1.400,43 ÷ 1,9 = 737,07.", it: "1.400,43 ÷ 1,9 = 737,07." } },
    ],
  },
  {
    nome: "p28 — Invoice with STO/RCL (RPN) = 8,000.00",
    modo: "rpn",
    titulo: { pt: "Fatura com memórias STO/RCL (RPN)", it: "Fattura con memorie STO/RCL (RPN)" },
    objetivo: {
      pt: "Guardar valores em registradores (STO) e recuperá-los (RCL) para montar uma fatura.",
      it: "Memorizzare valori nei registri (STO) e richiamarli (RCL) per comporre una fattura.",
    },
    tags: ["rpn", "memória", "memoria", "sto", "rcl", "registrador", "registro", "fatura", "fattura"],
    linhas: [
      { keys: ["1250", "STO", "0"], display: "1,250.00", nota: { pt: "Guarda 1.250 no registrador 0.", it: "Memorizza 1.250 nel registro 0." } },
      { keys: ["500", "STO", "2"], display: "500.00", nota: { pt: "Guarda 500 no registrador 2.", it: "Memorizza 500 nel registro 2." } },
      { keys: ["RCL", "0"], display: "1,250.00", nota: { pt: "Recupera o 1.250 do registrador 0.", it: "Richiama 1.250 dal registro 0." } },
      { keys: ["6", "×"], display: "7,500.00", nota: { pt: "Multiplica por 6 → 7.500.", it: "Moltiplica per 6 → 7.500." } },
      { keys: ["RCL", "2"], display: "500.00", nota: { pt: "Recupera o 500 do registrador 2.", it: "Richiama 500 dal registro 2." } },
      { keys: ["+"], display: "8,000.00", nota: { pt: "Soma → total da fatura 8.000.", it: "Somma → totale fattura 8.000." } },
    ],
  },
  {
    nome: "p28 — Invoice with STO/RCL (ALG) = 8,000.00",
    modo: "alg",
    titulo: { pt: "Fatura com memórias STO/RCL (ALG)", it: "Fattura con memorie STO/RCL (ALG)" },
    objetivo: {
      pt: "A mesma fatura, agora no modo algébrico (ALG).",
      it: "La stessa fattura, ora in modalità algebrica (ALG).",
    },
    tags: ["alg", "memória", "memoria", "sto", "rcl", "fatura", "fattura"],
    linhas: [
      { keys: ["1250", "STO", "0"], display: "1,250.00", nota: { pt: "Guarda 1.250 no registrador 0.", it: "Memorizza 1.250 nel registro 0." } },
      { keys: ["500", "STO", "2"], display: "500.00", nota: { pt: "Guarda 500 no registrador 2.", it: "Memorizza 500 nel registro 2." } },
      { keys: ["RCL", "0"], display: "1,250.00", nota: { pt: "Recupera o 1.250.", it: "Richiama 1.250." } },
      { keys: ["×", "6"], display: "6.", nota: { pt: "Multiplica o 1.250 por 6.", it: "Moltiplica 1.250 per 6." } },
      { keys: ["+", "RCL", "2"], display: "500.00", nota: { pt: "+ fecha 1.250×6 = 7.500; RCL 2 traz 500 para somar.", it: "+ chiude 1.250×6 = 7.500; RCL 2 porta 500 da sommare." } },
      { keys: ["="], display: "8,000.00", nota: { pt: "= conclui: 7.500 + 500 = 8.000.", it: "= conclude: 7.500 + 500 = 8.000." } },
    ],
  },
  {
    nome: "p29 — Storage register arithmetic (RPN): checkbook balance = 1,064.54",
    modo: "rpn",
    titulo: { pt: "Aritmética no registrador (RPN)", it: "Aritmetica sul registro (RPN)" },
    objetivo: {
      pt: "Somar e subtrair direto na memória (STO −, STO +) para manter um saldo acumulado.",
      it: "Sommare e sottrarre direttamente in memoria (STO −, STO +) per tenere un saldo accumulato.",
    },
    tags: ["rpn", "memória", "memoria", "sto", "registrador", "registro", "saldo"],
    linhas: [
      { keys: ["58.33", "STO", "0"], display: "58.33", nota: { pt: "Guarda o saldo inicial 58,33 no registrador 0.", it: "Memorizza il saldo iniziale 58,33 nel registro 0." } },
      { keys: ["22.95", "STO", "-", "0"], display: "22.95", nota: { pt: "Subtrai 22,95 direto no registrador 0.", it: "Sottrae 22,95 direttamente nel registro 0." } },
      { keys: ["13.7", "STO", "-", "0"], display: "13.70", nota: { pt: "Subtrai 13,70 no registrador 0.", it: "Sottrae 13,70 nel registro 0." } },
      { keys: ["10.14", "STO", "-", "0"], display: "10.14", nota: { pt: "Subtrai 10,14 no registrador 0.", it: "Sottrae 10,14 nel registro 0." } },
      { keys: ["1053", "STO", "+", "0"], display: "1,053.00", nota: { pt: "Soma 1.053 no registrador 0.", it: "Aggiunge 1.053 nel registro 0." } },
      { keys: ["RCL", "0"], display: "1,064.54", nota: { pt: "Recupera o saldo acumulado: 1.064,54.", it: "Richiama il saldo accumulato: 1.064,54." } },
    ],
  },
  {
    // Digit separators (p.17): na 12C real e "segurar . e ligar ON"; aqui o combo
    // usa o modo Segurar (HOLD): trava ON, toca "." -> alterna . <-> , e vice-versa.
    nome: "p17 — Digit separators: ON + . swaps point and comma (via Hold mode)",
    modo: "rpn",
    titulo: { pt: "Separadores de dígitos (ponto/vírgula)", it: "Separatori di cifre (punto/virgola)" },
    objetivo: {
      pt: "Alternar entre os padrões 1.234,56 e 1,234.56 (ON + .), usando o modo Segurar.",
      it: "Alternare tra i formati 1.234,56 e 1,234.56 (ON + .), usando la modalità Blocco.",
    },
    tags: ["separador", "separatore", "ponto", "punto", "vírgula", "virgola", "formato", "hold", "segurar", "blocco"],
    linhas: [
      { keys: ["1234.56", "ENTER"], display: "1,234.56", nota: { pt: "Digita 1.234,56 (ponto de milhar, vírgula decimal).", it: "Digita 1.234,56 (punto delle migliaia, virgola decimale)." } },
      { keys: ["HOLD", "ON", "."], display: "=1,234.56", nota: { pt: "Segurar ON + . alterna para o padrão US: 1,234.56.", it: "Blocco ON + . passa al formato US: 1,234.56." } },
      { keys: ["ON", ".", "HOLD"], display: "=1.234,56", nota: { pt: "Repete o combo e volta ao padrão original: 1.234,56.", it: "Ripete il combo e torna al formato originale: 1.234,56." } },
    ],
  },
];
