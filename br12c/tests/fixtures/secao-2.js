// Capítulo 2 — Seção 2 do guia (Percentage and Calendar). Parte percentual.
// Campos didáticos (titulo/objetivo/tags/nota) são bilíngues {pt,it}; a suíte
// de testes os ignora.

export const secao2Percentual = [
  {
    nome: "p31 — % (RPN): 14% of 300 = 42",
    modo: "rpn",
    titulo: { pt: "Porcentagem (RPN)", it: "Percentuale (RPN)" },
    objetivo: {
      pt: "Quanto é 14% de 300 — ex.: a comissão sobre uma venda de 300.",
      it: "Quanto è il 14% di 300 — es.: la commissione su una vendita di 300.",
    },
    tags: ["rpn", "porcentagem", "percentuale", "%", "comissão", "commissione"],
    linhas: [
      { keys: ["300", "ENTER"], display: "300.00", nota: { pt: "Empilha a base 300.", it: "Mette la base 300 nello stack." } },
      { keys: ["14", "%"], display: "42.00", nota: { pt: "14 % calcula 14% de 300 = 42.", it: "14 % calcola il 14% di 300 = 42." } },
    ],
  },
  {
    nome: "p32 — % (ALG): 14% of 300 = 42",
    modo: "alg",
    titulo: { pt: "Porcentagem (ALG)", it: "Percentuale (ALG)" },
    objetivo: {
      pt: "A mesma porcentagem (14% de 300) no modo algébrico.",
      it: "La stessa percentuale (14% di 300) in modalità algebrica.",
    },
    tags: ["alg", "porcentagem", "percentuale", "%"],
    linhas: [
      { keys: ["300", "×"], display: "300.00", nota: { pt: "Base 300 e o operador ×.", it: "Base 300 e l'operatore ×." } },
      { keys: ["14", "%"], display: "0.14", nota: { pt: "14 % vira a fração 0,14.", it: "14 % diventa la frazione 0,14." } },
      { keys: ["="], display: "42.00", nota: { pt: "= conclui: 300 × 14% = 42.", it: "= conclude: 300 × 14% = 42." } },
    ],
  },
  {
    nome: "p32 — % (ALG) after ×: 25% of 200 = 50",
    modo: "alg",
    titulo: { pt: "Porcentagem encadeada (ALG)", it: "Percentuale concatenata (ALG)" },
    objetivo: {
      pt: "25% de 200 direto numa expressão ALG.",
      it: "25% di 200 direttamente in un'espressione ALG.",
    },
    tags: ["alg", "porcentagem", "percentuale", "%"],
    linhas: [
      { keys: ["200", "×", "25", "%", "="], display: "50.00", nota: { pt: "200 × 25% = 50, tudo numa sequência.", it: "200 × 25% = 50, tutto in una sequenza." } },
    ],
  },
  {
    nome: "p33 — Net amount (RPN): 23250 −8% +6% = 22,673.40",
    modo: "rpn",
    titulo: { pt: "Valor líquido: desconto e acréscimo (RPN)", it: "Valore netto: sconto e aumento (RPN)" },
    objetivo: {
      pt: "Aplicar um desconto de 8% e depois um acréscimo de 6% sobre um valor.",
      it: "Applicare uno sconto dell'8% e poi un aumento del 6% su un importo.",
    },
    tags: ["rpn", "porcentagem", "percentuale", "desconto", "sconto", "acréscimo", "aumento", "líquido", "netto"],
    linhas: [
      { keys: ["23250", "ENTER"], display: "23,250.00", nota: { pt: "Empilha o valor base 23.250.", it: "Mette nello stack il valore base 23.250." } },
      { keys: ["8", "%"], display: "1,860.00", nota: { pt: "Calcula 8% de 23.250 = 1.860.", it: "Calcola l'8% di 23.250 = 1.860." } },
      { keys: ["-"], display: "21,390.00", nota: { pt: "Subtrai o desconto → 21.390.", it: "Sottrae lo sconto → 21.390." } },
      { keys: ["6", "%"], display: "1,283.40", nota: { pt: "Calcula 6% de 21.390 = 1.283,40.", it: "Calcola il 6% di 21.390 = 1.283,40." } },
      { keys: ["+"], display: "22,673.40", nota: { pt: "Soma o acréscimo → 22.673,40.", it: "Aggiunge l'aumento → 22.673,40." } },
    ],
  },
  {
    nome: "p33 — Simple interest via % (ALG): 1250 +7% = 1,337.50",
    modo: "alg",
    titulo: { pt: "Juros simples via % (ALG)", it: "Interesse semplice con % (ALG)" },
    objetivo: {
      pt: "Somar 7% de juros a um capital de 1.250 (o montante final).",
      it: "Aggiungere il 7% di interesse a un capitale di 1.250 (il montante finale).",
    },
    tags: ["alg", "juros", "interesse", "porcentagem", "percentuale", "montante"],
    linhas: [
      { keys: ["1250", "+", "7", "%"], display: "87.50", nota: { pt: "7% de 1.250 = 87,50 (os juros).", it: "Il 7% di 1.250 = 87,50 (gli interessi)." } },
      { keys: ["="], display: "1,337.50", nota: { pt: "= conclui: 1.250 + 87,50 = 1.337,50.", it: "= conclude: 1.250 + 87,50 = 1.337,50." } },
    ],
  },
  {
    nome: "p33 — Net amount (ALG): 23250 −8% +6% = 22,673.40",
    modo: "alg",
    titulo: { pt: "Valor líquido: desconto e acréscimo (ALG)", it: "Valore netto: sconto e aumento (ALG)" },
    objetivo: {
      pt: "O mesmo desconto de 8% e acréscimo de 6%, agora no modo ALG.",
      it: "Lo stesso sconto dell'8% e aumento del 6%, ora in modalità ALG.",
    },
    tags: ["alg", "porcentagem", "percentuale", "desconto", "sconto", "líquido", "netto"],
    linhas: [
      { keys: ["23250", "-", "8", "%"], display: "1,860.00", nota: { pt: "8% de 23.250 = 1.860.", it: "L'8% di 23.250 = 1.860." } },
      { keys: ["+"], display: "21,390.00", nota: { pt: "Subtrai o desconto → 21.390.", it: "Sottrae lo sconto → 21.390." } },
      { keys: ["6", "%"], display: "1,283.40", nota: { pt: "6% de 21.390 = 1.283,40.", it: "Il 6% di 21.390 = 1.283,40." } },
      { keys: ["="], display: "22,673.40", nota: { pt: "= conclui: 21.390 + 1.283,40 = 22.673,40.", it: "= conclude: 21.390 + 1.283,40 = 22.673,40." } },
    ],
  },
  {
    nome: "p34 — Δ% (RPN): 58.5 → 53.25 = −8.97",
    modo: "rpn",
    titulo: { pt: "Diferença percentual (Δ%)", it: "Differenza percentuale (Δ%)" },
    objetivo: {
      pt: "De quanto % um valor mudou — ex.: a queda de preço de 58,50 para 53,25.",
      it: "Di quanto % è cambiato un valore — es.: il calo di prezzo da 58,50 a 53,25.",
    },
    tags: ["rpn", "delta", "variação", "variazione", "porcentagem", "percentuale", "preço", "prezzo"],
    linhas: [
      { keys: ["58.5", "ENTER"], display: "58.50", nota: { pt: "Empilha o valor original 58,50.", it: "Mette nello stack il valore originale 58,50." } },
      { keys: ["53.25", "Δ%"], display: "-8.97", nota: { pt: "Δ% calcula a variação até 53,25 → −8,97% (caiu).", it: "Δ% calcola la variazione fino a 53,25 → −8,97% (calo)." } },
    ],
  },
  {
    nome: "p35 — %T (RPN): percent of total = 29.69 / 49.31 / 21.01",
    modo: "rpn",
    titulo: { pt: "Porcentagem do total (%T)", it: "Percentuale sul totale (%T)" },
    objetivo: {
      pt: "Qual a fatia de cada parcela no total — ex.: o peso de 3 itens na soma.",
      it: "Qual è la quota di ogni voce sul totale — es.: il peso di 3 voci nella somma.",
    },
    tags: ["rpn", "total", "totale", "porcentagem", "percentuale", "%t", "fatia", "quota"],
    linhas: [
      { keys: ["3.92", "ENTER"], display: "3.92", nota: { pt: "Primeira parcela, 3,92.", it: "Prima voce, 3,92." } },
      { keys: ["2.36", "+"], display: "6.28", nota: { pt: "Soma 2,36 → 6,28.", it: "Somma 2,36 → 6,28." } },
      { keys: ["1.67", "+"], display: "7.95", nota: { pt: "Soma 1,67 → total 7,95.", it: "Somma 1,67 → totale 7,95." } },
      { keys: ["2.36"], display: "2.36", nota: { pt: "Digita a parcela a avaliar (2,36).", it: "Digita la voce da valutare (2,36)." } },
      { keys: ["%T"], display: "29.69", nota: { pt: "%T: 2,36 é 29,69% do total.", it: "%T: 2,36 è il 29,69% del totale." } },
      { keys: ["CLx", "3.92", "%T"], display: "49.31", nota: { pt: "3,92 é 49,31% do total.", it: "3,92 è il 49,31% del totale." } },
      { keys: ["CLx", "1.67", "%T"], display: "21.01", nota: { pt: "1,67 é 21,01% do total.", it: "1,67 è il 21,01% del totale." } },
    ],
  },
  {
    nome: "p36 — %T (RPN, known total): 2.36 of 7.95 = 29.69",
    modo: "rpn",
    titulo: { pt: "%T com total conhecido (RPN)", it: "%T con totale noto (RPN)" },
    objetivo: {
      pt: "A fatia de 2,36 quando o total (7,95) já é conhecido.",
      it: "La quota di 2,36 quando il totale (7,95) è già noto.",
    },
    tags: ["rpn", "total", "totale", "porcentagem", "percentuale", "%t"],
    linhas: [
      { keys: ["7.95", "ENTER"], display: "7.95", nota: { pt: "Empilha o total 7,95.", it: "Mette nello stack il totale 7,95." } },
      { keys: ["2.36"], display: "2.36", nota: { pt: "Digita a parcela 2,36.", it: "Digita la voce 2,36." } },
      { keys: ["%T"], display: "29.69", nota: { pt: "%T: 2,36 é 29,69% de 7,95.", it: "%T: 2,36 è il 29,69% di 7,95." } },
    ],
  },
  {
    nome: "p36 — %T (ALG): percent of total = 29.69",
    modo: "alg",
    titulo: { pt: "%T (ALG)", it: "%T (ALG)" },
    objetivo: {
      pt: "A fatia de uma parcela no total, no modo ALG.",
      it: "La quota di una voce sul totale, in modalità ALG.",
    },
    tags: ["alg", "total", "totale", "porcentagem", "percentuale", "%t"],
    linhas: [
      { keys: ["3.92", "+", "2.36", "+", "1.67", "="], display: "7.95", nota: { pt: "Soma as parcelas → total 7,95.", it: "Somma le voci → totale 7,95." } },
      { keys: ["2.36"], display: "2.36", nota: { pt: "Digita a parcela 2,36.", it: "Digita la voce 2,36." } },
      { keys: ["%T"], display: "29.69", nota: { pt: "%T: 2,36 é 29,69% do total.", it: "%T: 2,36 è il 29,69% del totale." } },
    ],
  },
];

export const secao2Calendario = [
  {
    nome: "p40 — Days between dates (ΔDYS): 3 Jun 2004 → 14 Oct 2005",
    modo: "rpn",
    titulo: { pt: "Dias entre datas (ΔDYS)", it: "Giorni tra date (ΔDYS)" },
    objetivo: {
      pt: "Contar quantos dias há entre duas datas (ex.: o prazo de um contrato).",
      it: "Contare quanti giorni ci sono tra due date (es.: la durata di un contratto).",
    },
    tags: ["calendário", "calendario", "data", "date", "dias", "giorni", "prazo", "durata", "ΔDYS"],
    linhas: [
      { keys: ["g", "M.DY"], display: "0.00", nota: { pt: "Define o formato de data mês.dia.ano (M.DY).", it: "Imposta il formato data mese.giorno.anno (M.DY)." } },
      { keys: ["6.032004", "ENTER"], display: "6.03", nota: { pt: "Primeira data: 3 jun 2004.", it: "Prima data: 3 giu 2004." } },
      { keys: ["10.142005", "g", "ΔDYS"], display: "498.00", nota: { pt: "Segunda data: 14 out 2005 → 498 dias corridos.", it: "Seconda data: 14 ott 2005 → 498 giorni effettivi." } },
      { keys: ["x≷y"], display: "491.00", nota: { pt: "Troca para ver 491 dias na base 30/360.", it: "Scambia per vedere 491 giorni nella base 30/360." } },
    ],
  },
  {
    nome: "p39 — Future date (g DATE): 14 May 2004 + 120 days = 11 Sep 2004 (Sat)",
    modo: "rpn",
    titulo: { pt: "Data futura (g DATE)", it: "Data futura (g DATE)" },
    objetivo: {
      pt: "Achar a data N dias após uma data — ex.: um vencimento 120 dias depois.",
      it: "Trovare la data N giorni dopo una data — es.: una scadenza 120 giorni dopo.",
    },
    tags: ["calendário", "calendario", "data", "date", "vencimento", "scadenza", "futuro", "DATE"],
    linhas: [
      { keys: ["g", "D.MY"], display: "0.00", nota: { pt: "Define o formato de data dia.mês.ano (D.MY).", it: "Imposta il formato data giorno.mese.anno (D.MY)." } },
      { keys: ["14.052004", "ENTER"], display: "14.05", nota: { pt: "Data inicial: 14 mai 2004.", it: "Data iniziale: 14 mag 2004." } },
      { keys: ["120", "g", "DATE"], display: "11,09,2004 6", nota: { pt: "+120 dias → 11 set 2004 (o 6 indica sábado).", it: "+120 giorni → 11 set 2004 (il 6 indica sabato)." } },
    ],
  },
];
