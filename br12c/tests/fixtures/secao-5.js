// Capítulo 5 — Seção 5 (Additional Operating Features): x≷y, LST x, constante.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const secao5 = [
  {
    nome: "p90 — x≷y (RPN): 144.25 − 25.83 = 118.42",
    modo: "rpn",
    titulo: { pt: "Trocar X e Y na pilha (x≷y)", it: "Scambiare X e Y nello stack (x≷y)" },
    objetivo: {
      pt: "Inverter a ordem dos dois últimos números para subtrair na ordem certa.",
      it: "Invertire l'ordine degli ultimi due numeri per sottrarre nell'ordine giusto.",
    },
    tags: ["rpn", "pilha", "stack", "x≷y", "troca", "scambio"],
    linhas: [
      { keys: ["25.83", "ENTER", "144.25"], display: "144.25", nota: { pt: "Empilha 25,83, depois 144,25 (ordem trocada).", it: "Mette 25,83 nello stack, poi 144,25 (ordine invertito)." } },
      { keys: ["x≷y"], display: "25.83", nota: { pt: "x≷y troca os dois → agora 25,83 está em X.", it: "x≷y scambia i due → ora 25,83 è in X." } },
      { keys: ["-"], display: "118.42", nota: { pt: "144,25 − 25,83 = 118,42.", it: "144,25 − 25,83 = 118,42." } },
    ],
  },
  {
    nome: "p91 — Constant arithmetic via LST x (×4.38)",
    modo: "rpn",
    titulo: { pt: "Constante com LST x (×4,38)", it: "Costante con LST x (×4,38)" },
    objetivo: {
      pt: "Multiplicar vários números pela mesma constante reaproveitando o último X (LST x).",
      it: "Moltiplicare più numeri per la stessa costante riutilizzando l'ultimo X (LST x).",
    },
    tags: ["rpn", "constante", "costante", "lstx", "last x", "multiplicação", "moltiplicazione"],
    linhas: [
      { keys: ["15", "ENTER", "4.38", "×"], display: "65.70", nota: { pt: "15 × 4,38 = 65,70.", it: "15 × 4,38 = 65,70." } },
      { keys: ["75", "g", "LSTx"], display: "4.38", nota: { pt: "75 e LST x traz de volta a constante 4,38.", it: "75 e LST x richiama la costante 4,38." } },
      { keys: ["×"], display: "328.50", nota: { pt: "75 × 4,38 = 328,50.", it: "75 × 4,38 = 328,50." } },
      { keys: ["250", "g", "LSTx"], display: "4.38", nota: { pt: "250 e LST x traz 4,38 de novo.", it: "250 e LST x richiama di nuovo 4,38." } },
      { keys: ["×"], display: "1,095.00", nota: { pt: "250 × 4,38 = 1.095,00.", it: "250 × 4,38 = 1.095,00." } },
    ],
  },
  {
    nome: "p91-92 — Recovering from a digit-entry error via LST x",
    modo: "rpn",
    titulo: { pt: "Corrigir erro de digitação com LST x", it: "Correggere un errore di digitazione con LST x" },
    objetivo: {
      pt: "Recuperar o número errado já usado numa operação (LST x) para refazer o cálculo certo.",
      it: "Recuperare il numero sbagliato già usato in un'operazione (LST x) per rifare il calcolo corretto.",
    },
    tags: ["rpn", "lstx", "last x", "erro", "errore", "correção", "correzione"],
    linhas: [
      { keys: ["429000", "ENTER", "9987", "÷"], display: "42.96", nota: { pt: "Dividiu por 9987 por engano → 42,96.", it: "Diviso per 9987 per sbaglio → 42,96." } },
      { keys: ["g", "LSTx"], display: "9,987.00", nota: { pt: "LST x devolve o 9.987 que foi digitado.", it: "LST x restituisce il 9.987 digitato." } },
      { keys: ["429000", "ENTER", "987", "÷"], display: "434.65", nota: { pt: "Refaz com o divisor certo (987) → 434,65.", it: "Rifà col divisore giusto (987) → 434,65." } },
    ],
  },
  {
    nome: "p87-89 — Display formats: FIX, scientific (f .) and mantissa (f CLEAR PREFIX)",
    modo: "rpn",
    titulo: { pt: "Formatos de exibição (FIX, científico, mantissa)", it: "Formati di visualizzazione (FIX, scientifico, mantissa)" },
    objetivo: {
      pt: "Mudar como o número aparece (casas decimais, notação científica e a mantissa completa) sem alterar o valor armazenado.",
      it: "Cambiare come appare il numero (decimali, notazione scientifica e mantissa completa) senza alterare il valore memorizzato.",
    },
    tags: ["fix", "científico", "scientifico", "mantissa", "prefix", "exibição", "visualizzazione", "casas decimais", "decimali"],
    linhas: [
      { keys: ["19.8745632", "ENTER", "5", "-"], display: "14.87", nota: { pt: "Calcula 19,8745632 − 5 = 14,87 (em FIX 2).", it: "Calcola 19,8745632 − 5 = 14,87 (in FIX 2)." } },
      { keys: ["f", "4"], display: "14.8746", nota: { pt: "FIX 4 → 4 casas: 14,8746.", it: "FIX 4 → 4 decimali: 14,8746." } },
      { keys: ["f", "1"], display: "14.9", nota: { pt: "FIX 1 → 1 casa: 14,9.", it: "FIX 1 → 1 decimale: 14,9." } },
      { keys: ["f", "0"], display: "15.", nota: { pt: "FIX 0 → sem casas: 15.", it: "FIX 0 → nessun decimale: 15." } },
      { keys: ["f", "9"], display: "14.87456320", nota: { pt: "FIX 9 → 9 casas: 14,87456320.", it: "FIX 9 → 9 decimali: 14,87456320." } },
      { keys: ["f", "."], display: "1.487456 01", nota: { pt: "Notação científica: 1,487456×10¹.", it: "Notazione scientifica: 1,487456×10¹." } },
      { keys: ["f", "PREFIX"], display: "1487456320", nota: { pt: "Segura f PREFIX para ver a mantissa cheia: 1487456320.", it: "Tieni f PREFIX per vedere la mantissa intera: 1487456320." } },
      { keys: ["f", "2"], display: "14.87", nota: { pt: "Volta a FIX 2: 14,87 (o valor nunca mudou).", it: "Torna a FIX 2: 14,87 (il valore non è mai cambiato)." } },
    ],
  },
];
