// Manual do proprietário — Seção 2 (Percentage and Calendar Functions, p.27-33).
// Diferente do User Guide, esta edição não mostra variantes ALG na própria
// Seção 2 (ficam só no Apêndice B); por isso aqui é só RPN, fiel ao manual.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const handbookSecao2Percentual = [
  {
    nome: "p27 — % (RPN): 14% of 300 = 42",
    modo: "rpn",
    titulo: { pt: "Porcentagem (RPN)", it: "Percentuale (RPN)" },
    objetivo: {
      pt: "Quanto é 14% de 300.",
      it: "Quanto è il 14% di 300.",
    },
    tags: ["rpn", "porcentagem", "percentuale", "%"],
    linhas: [
      { keys: ["300", "ENTER"], display: "300.00", nota: { pt: "Empilha a base 300.", it: "Mette la base 300 nello stack." } },
      { keys: ["14", "%"], display: "42.00", nota: { pt: "14% de 300 = 42.", it: "Il 14% di 300 = 42." } },
    ],
  },
  {
    nome: "p28 — Net amount (RPN): $13,250 car, −8% discount +6% tax = 12,921.40",
    modo: "rpn",
    titulo: { pt: "Valor líquido: desconto e imposto (RPN)", it: "Valore netto: sconto e imposta (RPN)" },
    objetivo: {
      pt: "Um carro de 13.250 com 8% de desconto e depois 6% de imposto sobre o valor já descontado.",
      it: "Un'auto di 13.250 con l'8% di sconto e poi il 6% di imposta sul valore già scontato.",
    },
    tags: ["rpn", "porcentagem", "percentuale", "desconto", "sconto", "imposto", "imposta", "carro", "auto"],
    linhas: [
      { keys: ["13250", "ENTER"], display: "13,250.00", nota: { pt: "Preço de tabela do carro.", it: "Prezzo di listino dell'auto." } },
      { keys: ["8", "%"], display: "1,060.00", nota: { pt: "8% de desconto = 1.060.", it: "8% di sconto = 1.060." } },
      { keys: ["-"], display: "12,190.00", nota: { pt: "Subtrai o desconto → 12.190.", it: "Sottrae lo sconto → 12.190." } },
      { keys: ["6", "%"], display: "731.40", nota: { pt: "6% de imposto sobre 12.190 = 731,40.", it: "6% di imposta su 12.190 = 731,40." } },
      { keys: ["+"], display: "12,921.40", nota: { pt: "Soma o imposto → custo total 12.921,40.", it: "Aggiunge l'imposta → costo totale 12.921,40." } },
    ],
  },
  {
    nome: "p28 — Percent difference (RPN): 58.50 → 53.25 = −8.97",
    modo: "rpn",
    titulo: { pt: "Diferença percentual (Δ%)", it: "Differenza percentuale (Δ%)" },
    objetivo: {
      pt: "De quanto % uma ação caiu, de 58,50 para 53,25.",
      it: "Di quanto % è calata un'azione, da 58,50 a 53,25.",
    },
    tags: ["rpn", "delta", "porcentagem", "percentuale", "ação", "azione"],
    linhas: [
      { keys: ["58.5", "ENTER"], display: "58.50", nota: { pt: "Preço de ontem.", it: "Prezzo di ieri." } },
      { keys: ["53.25", "Δ%"], display: "-8.97", nota: { pt: "Caiu quase 9%.", it: "È calato quasi del 9%." } },
    ],
  },
  {
    nome: "p29 — %T (RPN): sales split 3.92/2.36/1.67 million = 49.31 / 29.69 / 21.01",
    modo: "rpn",
    titulo: { pt: "Porcentagem do total (%T)", it: "Percentuale sul totale (%T)" },
    objetivo: {
      pt: "A fatia de cada região nas vendas totais (EUA 3,92M, Europa 2,36M, resto do mundo 1,67M).",
      it: "La quota di ogni regione sulle vendite totali (USA 3,92M, Europa 2,36M, resto del mondo 1,67M).",
    },
    tags: ["rpn", "%t", "total", "totale", "porcentagem", "percentuale", "vendas", "vendite"],
    linhas: [
      { keys: ["3.92", "ENTER"], display: "3.92", nota: { pt: "Vendas nos EUA (3,92 milhões).", it: "Vendite negli USA (3,92 milioni)." } },
      { keys: ["2.36", "+"], display: "6.28", nota: { pt: "Soma a Europa → 6,28.", it: "Aggiunge l'Europa → 6,28." } },
      { keys: ["1.67", "+"], display: "7.95", nota: { pt: "Soma o resto do mundo → total 7,95.", it: "Aggiunge il resto del mondo → totale 7,95." } },
      { keys: ["2.36"], display: "2.36", nota: { pt: "Digita a fatia da Europa.", it: "Digita la quota dell'Europa." } },
      { keys: ["%T"], display: "29.69", nota: { pt: "Europa é 29,69% do total.", it: "L'Europa è il 29,69% del totale." } },
      { keys: ["CLx", "3.92", "%T"], display: "49.31", nota: { pt: "EUA é 49,31% do total (o total continua guardado).", it: "Gli USA sono il 49,31% del totale (il totale resta memorizzato)." } },
      { keys: ["CLx", "1.67", "%T"], display: "21.01", nota: { pt: "Resto do mundo é 21,01% do total.", it: "Il resto del mondo è il 21,01% del totale." } },
    ],
  },
  {
    nome: "p30 — %T (RPN, known total): 2.36 of 7.95 = 29.69",
    modo: "rpn",
    titulo: { pt: "%T com total já conhecido (RPN)", it: "%T con totale già noto (RPN)" },
    objetivo: {
      pt: "Quando o total (7,95) já é conhecido de antemão, sem precisar somar as parcelas.",
      it: "Quando il totale (7,95) è già noto in anticipo, senza dover sommare le voci.",
    },
    tags: ["rpn", "%t", "total", "totale", "porcentagem", "percentuale"],
    linhas: [
      { keys: ["7.95", "ENTER"], display: "7.95", nota: { pt: "Total já conhecido: 7,95.", it: "Totale già noto: 7,95." } },
      { keys: ["2.36"], display: "2.36", nota: { pt: "A fatia a avaliar.", it: "La quota da valutare." } },
      { keys: ["%T"], display: "29.69", nota: { pt: "2,36 é 29,69% de 7,95.", it: "2,36 è il 29,69% di 7,95." } },
    ],
  },
];

export const handbookSecao2Calendario = [
  {
    nome: "p31-32 — Future date (D.MY, g DATE): 14 May 2004 + 120 days = 11 Sep 2004 (Sat)",
    modo: "rpn",
    titulo: { pt: "Data futura (g DATE)", it: "Data futura (g DATE)" },
    objetivo: {
      pt: "A data de vencimento de uma opção de 120 dias comprada em 14 de maio de 2004.",
      it: "La data di scadenza di un'opzione di 120 giorni acquistata il 14 maggio 2004.",
    },
    tags: ["calendário", "calendario", "data", "date", "vencimento", "scadenza", "opção", "opzione"],
    linhas: [
      { keys: ["g", "D.MY"], display: "0.00", nota: { pt: "Formato de data dia.mês.ano (D.MY).", it: "Formato data giorno.mese.anno (D.MY)." } },
      { keys: ["14.052004", "ENTER"], display: "14.05", nota: { pt: "Data inicial: 14 de maio de 2004.", it: "Data iniziale: 14 maggio 2004." } },
      { keys: ["120", "g", "DATE"], display: "11,09,2004 6", nota: { pt: "+120 dias → 11 de setembro de 2004 (o 6 indica sábado).", it: "+120 giorni → 11 settembre 2004 (il 6 indica sabato)." } },
    ],
  },
  {
    // ERRATA do manual (2003, p.33): o próprio livro mostra "10.152005 g ΔDYS"
    // (15 de outubro) dando "498.00", mas 3 jun 2004 → 15 out 2005 são
    // efetivamente 499 dias (conferido de forma independente com Date do JS:
    // Date.UTC(2005,9,15) − Date.UTC(2004,5,3) = 499 dias). A edição do User
    // Guide (2007) parece ter corrigido isso usando 14 out (→ 498, ver
    // fixtures/secao-2.js). Aqui ficamos com o valor matematicamente correto
    // (499), já que o objetivo é verificar a calculadora, não reproduzir o erro.
    nome: "p32-33 — Days between dates (M.DY, g ΔDYS): 3 Jun 2004 → 15 Oct 2005 = 499 (492 on 30-day basis)",
    modo: "rpn",
    titulo: { pt: "Dias entre datas (ΔDYS)", it: "Giorni tra date (ΔDYS)" },
    objetivo: {
      pt: "Quantos dias (reais e na base de 30 dias/mês) há entre duas datas, para calcular juros simples. (O manual original de 2003 imprime 498 aqui — é uma errata; 499 é o valor correto, e é o que a calculadora mostra.)",
      it: "Quanti giorni (effettivi e sulla base di 30 giorni/mese) ci sono tra due date, per calcolare l'interesse semplice. (Il manuale originale del 2003 stampa 498 qui — è un errata; 499 è il valore corretto, ed è quello che mostra la calcolatrice.)",
    },
    tags: ["calendário", "calendario", "data", "date", "dias", "giorni", "juros simples", "interesse semplice", "errata"],
    linhas: [
      { keys: ["g", "M.DY"], display: "0.00", nota: { pt: "Formato de data mês.dia.ano (M.DY).", it: "Formato data mese.giorno.anno (M.DY)." } },
      { keys: ["6.032004", "ENTER"], display: "6.03", nota: { pt: "Data inicial: 3 de junho de 2004.", it: "Data iniziale: 3 giugno 2004." } },
      { keys: ["10.152005", "g", "ΔDYS"], display: "499.00", nota: { pt: "Data final 15 de outubro de 2005 → 499 dias corridos (o manual original imprime 498 — errata).", it: "Data finale 15 ottobre 2005 → 499 giorni effettivi (il manuale originale stampa 498 — errata)." } },
      { keys: ["x≷y"], display: "492.00", nota: { pt: "Troca para ver 492 dias na base de 30 dias por mês.", it: "Scambia per vedere 492 giorni sulla base di 30 giorni al mese." } },
    ],
  },
];
