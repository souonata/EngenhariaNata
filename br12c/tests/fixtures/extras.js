// Fixtures do Robot Guide para Section 7 e Appendices A/B/C (índice EN do User
// Guide). Exemplos curtos com números já validados pelo motor nas suítes headless
// (matematica/pilha/secao-4/smoke). Cada exemplo é independente: o runner zera a
// calculadora e fixa o modo (f RPN / f ALG) antes de cada um.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const secao7 = [
  {
    nome: "p100 — y^x: 2 ENTER 3 y^x = 8",
    modo: "rpn",
    titulo: { pt: "Potência (y^x)", it: "Potenza (y^x)" },
    objetivo: { pt: "Elevar um número a uma potência: 2³ = 8.", it: "Elevare un numero a una potenza: 2³ = 8." },
    tags: ["matemática", "matematica", "potência", "potenza", "y^x", "expoente", "esponente"],
    linhas: [
      { keys: ["2", "ENTER", "3", "y^x"], display: "8.00", nota: { pt: "2 elevado a 3 = 8.", it: "2 elevato a 3 = 8." } },
    ],
  },
  {
    nome: "p101 — √x and n!: √4 = 2; 5 n! = 120",
    modo: "rpn",
    titulo: { pt: "Raiz quadrada e fatorial (√x, n!)", it: "Radice quadrata e fattoriale (√x, n!)" },
    objetivo: { pt: "Duas funções de um número: a raiz quadrada de 4 e o fatorial de 5.", it: "Due funzioni di un numero: la radice quadrata di 4 e il fattoriale di 5." },
    tags: ["matemática", "matematica", "raiz", "radice", "√x", "fatorial", "fattoriale", "n!"],
    linhas: [
      { keys: ["4", "g", "√x"], display: "2.00", nota: { pt: "Raiz quadrada de 4 = 2.", it: "Radice quadrata di 4 = 2." } },
      { keys: ["5", "g", "n!"], display: "120.00", nota: { pt: "Fatorial de 5 = 5×4×3×2×1 = 120.", it: "Fattoriale di 5 = 5×4×3×2×1 = 120." } },
    ],
  },
  {
    nome: "p102 — INTG and FRAC of 2.5",
    modo: "rpn",
    titulo: { pt: "Parte inteira e fracionária (INTG, FRAC)", it: "Parte intera e frazionaria (INTG, FRAC)" },
    objetivo: { pt: "Separar a parte inteira e a parte decimal de 2,5.", it: "Separare la parte intera e la parte decimale di 2,5." },
    tags: ["matemática", "matematica", "intg", "frac", "inteiro", "intero", "fração", "frazione"],
    linhas: [
      { keys: ["2.5", "g", "INTG"], display: "2.00", nota: { pt: "Parte inteira de 2,5 = 2.", it: "Parte intera di 2,5 = 2." } },
      { keys: ["2.5", "g", "FRAC"], display: "0.50", nota: { pt: "Parte fracionária de 2,5 = 0,50.", it: "Parte frazionaria di 2,5 = 0,50." } },
    ],
  },
];

export const apendiceA = [
  {
    nome: "p235 — R↓ rolls the stack: 1↑2↑3↑4 R↓ → 3",
    modo: "rpn",
    titulo: { pt: "Girar a pilha (R↓)", it: "Ruotare lo stack (R↓)" },
    objetivo: { pt: "Ver como R↓ gira os 4 níveis da pilha (T, Z, Y, X).", it: "Vedere come R↓ ruota i 4 livelli dello stack (T, Z, Y, X)." },
    tags: ["rpn", "pilha", "stack", "r↓", "roll", "gira"],
    linhas: [
      { keys: ["1", "ENTER", "2", "ENTER", "3", "ENTER", "4", "R↓"], display: "3.00", nota: { pt: "Pilha = 4,3,2,1; R↓ desce tudo → X mostra 3.", it: "Stack = 4,3,2,1; R↓ scende tutto → X mostra 3." } },
    ],
  },
  {
    nome: "p238 — LST x recalls the operand: 12÷3, LSTx, × → 12",
    modo: "rpn",
    titulo: { pt: "LST x recupera o operando", it: "LST x richiama l'operando" },
    objetivo: { pt: "Recuperar o último número usado numa operação (o divisor) com LST x.", it: "Richiamare l'ultimo numero usato in un'operazione (il divisore) con LST x." },
    tags: ["rpn", "lstx", "last x", "operando", "pilha", "stack"],
    linhas: [
      { keys: ["12", "ENTER", "3", "÷"], display: "4.00", nota: { pt: "12 ÷ 3 = 4.", it: "12 ÷ 3 = 4." } },
      { keys: ["g", "LSTx"], display: "3.00", nota: { pt: "LST x traz de volta o 3 (o último operando).", it: "LST x richiama il 3 (l'ultimo operando)." } },
      { keys: ["×"], display: "12.00", nota: { pt: "4 × 3 = 12 (desfaz a divisão).", it: "4 × 3 = 12 (annulla la divisione)." } },
    ],
  },
];

export const apendiceB = [
  {
    nome: "p242 — Arithmetic in ALG: 2 + 3 = 5",
    modo: "alg",
    titulo: { pt: "Aritmética em ALG (2 + 3)", it: "Aritmetica in ALG (2 + 3)" },
    objetivo: { pt: "Soma simples no modo algébrico.", it: "Somma semplice in modalità algebrica." },
    tags: ["alg", "algébrico", "algebrico", "soma", "somma"],
    linhas: [
      { keys: ["2", "+", "3", "="], display: "5.00", nota: { pt: "2 + 3 = 5.", it: "2 + 3 = 5." } },
    ],
  },
  {
    nome: "p243 — ALG: 19.8745632 − 5 = 14.87",
    modo: "alg",
    titulo: { pt: "Subtração em ALG", it: "Sottrazione in ALG" },
    objetivo: { pt: "Subtração no modo ALG, com o display em FIX 2.", it: "Sottrazione in modalità ALG, con il display in FIX 2." },
    tags: ["alg", "algébrico", "algebrico", "subtração", "sottrazione"],
    linhas: [
      { keys: ["19.8745632", "-"], display: "19.87", nota: { pt: "Digita 19,8745632 (mostra 19,87) e o operador −.", it: "Digita 19,8745632 (mostra 19,87) e l'operatore −." } },
      { keys: ["5", "="], display: "14.87", nota: { pt: "− 5 = 14,87.", it: "− 5 = 14,87." } },
    ],
  },
];

export const apendiceC = [
  {
    nome: "p248 — IRR (grouped cash flows p.76-78, full setup) = 13.72",
    modo: "rpn",
    titulo: { pt: "TIR (IRR) — exemplo completo", it: "TIR (IRR) — esempio completo" },
    objetivo: {
      pt: "Montagem completa de uma série de fluxos agrupados (Nj) e o cálculo da TIR (a taxa interna de retorno).",
      it: "Impostazione completa di una serie di flussi raggruppati (Nj) e il calcolo della TIR (il tasso interno di rendimento).",
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

// Appendix F — Verifying Proper Operation (self-test do teclado/display): na 12C
// real entra-se "segurando ÷ e ligando ON"; aqui o combo usa o modo Segurar (HOLD).
// Acende todos os segmentos, depois exige as 40 teclas na ordem fisica (ENTER 2x,
// linhas 3 e 4); termina em 12. Ordem errada -> Error 9.
export const apendiceF = [
  {
    nome: "p266 — Keyboard/display self-test: ÷+ON, all 40 keys in order → 12",
    modo: "rpn",
    titulo: { pt: "Autoteste do teclado e display", it: "Autotest di tastiera e display" },
    objetivo: {
      pt: "O teste de fábrica da 12C: acende todos os segmentos e exige as 40 teclas na ordem física; termina em 12 se tudo estiver ok.",
      it: "Il test di fabbrica della 12C: accende tutti i segmenti ed esige i 40 tasti nell'ordine fisico; finisce a 12 se tutto è a posto.",
    },
    tags: ["autoteste", "autotest", "teclado", "tastiera", "display", "manutenção", "manutenzione", "self-test"],
    linhas: [
      { keys: ["HOLD", "÷", "ON"], display: "8888888888", nota: { pt: "Modo Segurar + ÷ + ON entra no teste: acende 8888888888.", it: "Blocco + ÷ + ON entra nel test: accende 8888888888." } },
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
