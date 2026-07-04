// Manual do proprietário — Seção 5 (Additional Operating Features, p.70-75).
// Formatos de exibição (FIX, científico, mantissa), x≷y, LAST X (constantes e
// recuperação de erro de digitação). Mesmos exemplos numéricos do User Guide
// (mesma calculadora, mesma seção), aqui nas próprias páginas do Handbook.
// Campos didáticos bilíngues {pt,it}.

export const handbookSecao5 = [
  {
    nome: "p71-73 — Display formats: FIX, scientific (f .) and mantissa (f PREFIX)",
    modo: "rpn",
    titulo: { pt: "Formatos de exibição (FIX, científico, mantissa)", it: "Formati di visualizzazione (FIX, scientifico, mantissa)" },
    objetivo: {
      pt: "Mudar como o número aparece (casas decimais, notação científica, mantissa completa) sem alterar o valor guardado internamente.",
      it: "Cambiare come appare il numero (decimali, notazione scientifica, mantissa completa) senza alterare il valore memorizzato internamente.",
    },
    tags: ["fix", "científico", "scientifico", "mantissa", "prefix", "exibição", "visualizzazione", "casas decimais", "decimali"],
    linhas: [
      { keys: ["19.8745632", "ENTER", "5", "-"], display: "14.87", nota: { pt: "19,8745632 − 5 = 14,87 (padrão, FIX 2).", it: "19,8745632 − 5 = 14,87 (standard, FIX 2)." } },
      { keys: ["f", "4"], display: "14.8746", nota: { pt: "FIX 4 → 4 casas: 14,8746.", it: "FIX 4 → 4 decimali: 14,8746." } },
      { keys: ["f", "1"], display: "14.9", nota: { pt: "FIX 1 → 1 casa: 14,9.", it: "FIX 1 → 1 decimale: 14,9." } },
      { keys: ["f", "0"], display: "15.", nota: { pt: "FIX 0 → sem casas: 15.", it: "FIX 0 → nessun decimale: 15." } },
      { keys: ["f", "9"], display: "14.87456320", nota: { pt: "FIX 9 → só 8 casas cabem no visor (10 dígitos no total): 14,87456320.", it: "FIX 9 → nel display entrano solo 8 decimali (10 cifre in totale): 14,87456320." } },
      { keys: ["f", "."], display: "1.487456 01", nota: { pt: "Notação científica: 1,487456×10¹.", it: "Notazione scientifica: 1,487456×10¹." } },
      { keys: ["f", "PREFIX"], display: "1487456320", nota: { pt: "Segura f PREFIX para ver a mantissa cheia: 1487456320.", it: "Tieni f PREFIX per vedere la mantissa intera: 1487456320." } },
      { keys: ["f", "2"], display: "14.87", nota: { pt: "Volta a FIX 2: 14,87 (o valor interno nunca mudou).", it: "Torna a FIX 2: 14,87 (il valore interno non è mai cambiato)." } },
    ],
  },
  {
    nome: "p73 — The x≷y key: fixing a keyed-in-backwards subtraction, 144.25 − 25.83 = 118.42",
    modo: "rpn",
    titulo: { pt: "Corrigir ordem com x≷y", it: "Correggere l'ordine con x≷y" },
    objetivo: {
      pt: "Digitou os números na ordem errada para subtrair? x≷y troca X e Y sem precisar recomeçar.",
      it: "Hai digitato i numeri nell'ordine sbagliato per sottrarre? x≷y scambia X e Y senza dover ricominciare.",
    },
    tags: ["rpn", "pilha", "stack", "x≷y", "troca", "scambio", "erro", "errore"],
    linhas: [
      { keys: ["25.83", "ENTER", "144.25"], display: "144.25", nota: { pt: "Ops! Digitou 25,83 primeiro, depois 144,25 (ordem trocada).", it: "Ops! Ha digitato prima 25,83, poi 144,25 (ordine invertito)." } },
      { keys: ["x≷y"], display: "25.83", nota: { pt: "x≷y troca os dois → o número certo (25,83) volta pro X.", it: "x≷y scambia i due → il numero giusto (25,83) torna in X." } },
      { keys: ["-"], display: "118.42", nota: { pt: "144,25 − 25,83 = 118,42.", it: "144,25 − 25,83 = 118,42." } },
    ],
  },
  {
    nome: "p75 — Constant arithmetic via LAST X (g LSTx): package cost ×4.38",
    modo: "rpn",
    titulo: { pt: "Constante com LAST X (×4,38)", it: "Costante con LAST X (×4,38)" },
    objetivo: {
      pt: "Calcular o custo de embalagens de 15, 75 e 250 peças a 4,38 cada, reaproveitando o preço unitário com g LST x.",
      it: "Calcolare il costo di confezioni da 15, 75 e 250 pezzi a 4,38 ciascuno, riutilizzando il prezzo unitario con g LST x.",
    },
    tags: ["rpn", "constante", "costante", "lstx", "last x", "multiplicação", "moltiplicazione", "embalagem", "confezione"],
    linhas: [
      { keys: ["15", "ENTER", "4.38", "×"], display: "65.70", nota: { pt: "15 × 4,38 = 65,70 (embalagem de 15).", it: "15 × 4,38 = 65,70 (confezione da 15)." } },
      { keys: ["75", "g", "LSTx"], display: "4.38", nota: { pt: "75 e LST x trazem de volta o preço unitário 4,38.", it: "75 e LST x richiamano il prezzo unitario 4,38." } },
      { keys: ["×"], display: "328.50", nota: { pt: "75 × 4,38 = 328,50.", it: "75 × 4,38 = 328,50." } },
      { keys: ["250", "g", "LSTx"], display: "4.38", nota: { pt: "250 e LST x trazem 4,38 de novo.", it: "250 e LST x richiamano di nuovo 4,38." } },
      { keys: ["×"], display: "1,095.00", nota: { pt: "250 × 4,38 = 1.095,00.", it: "250 × 4,38 = 1.095,00." } },
    ],
  },
  {
    nome: "p75 — Recovering from a digit-entry error via LAST X: 429,000 ÷ 987 = 434.65",
    modo: "rpn",
    titulo: { pt: "Corrigir erro de digitação com LAST X", it: "Correggere un errore di digitazione con LAST X" },
    objetivo: {
      pt: "Digitou 9987 em vez de 987 sem perceber? g LST x recupera o número usado antes da conta errada, sem precisar redigitar tudo.",
      it: "Hai digitato 9987 invece di 987 senza accorgertene? g LST x recupera il numero usato prima del calcolo sbagliato, senza dover ridigitare tutto.",
    },
    tags: ["rpn", "lstx", "last x", "erro", "errore", "correção", "correzione", "divisão", "divisione"],
    linhas: [
      { keys: ["429000", "ENTER"], display: "429,000.00", nota: { pt: "Produção anual total: 429.000.", it: "Produzione annua totale: 429.000." } },
      { keys: ["9987", "÷"], display: "42.96", nota: { pt: "Dividiu por 9987 por engano → 42,96 (parece baixo demais!).", it: "Diviso per 9987 per sbaglio → 42,96 (sembra troppo basso!)." } },
      { keys: ["g", "LSTx"], display: "9,987.00", nota: { pt: "g LST x devolve o 9.987 usado — aí vê o erro de digitação.", it: "g LST x restituisce il 9.987 usato — così si vede l'errore di digitazione." } },
      { keys: ["429000", "ENTER", "987", "÷"], display: "434.65", nota: { pt: "Refaz com o divisor certo (987) → 434,65.", it: "Rifà col divisore giusto (987) → 434,65." } },
    ],
  },
];
