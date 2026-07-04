// Manual do proprietário (HP 12C Platinum Owner's Handbook and Problem-Solving
// Guide, © 2003) — introdução "Making Financial Calculations Easy" (p.10-13) e
// Seção 1 (Getting Started, p.16-26). Edição/paginação diferentes do User Guide
// já coberto em fixtures/secao-1.js e fixtures/secao-3.js — alguns exemplos
// coincidem em números (mesma calculadora, mesmo problema clássico), outros
// divergem de fato (ex.: o Exemplo 2 da introdução usa capitalização
// SEMESTRAL aqui, mas anual na edição do User Guide — por isso não pulamos
// nada: cada manual é transcrito por completo e de forma independente).
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const handbookIntro = [
  {
    nome: "MH p10-12 — Ex.1-4: college fund walkthrough (PV, FV semiannual, PMT, minimum rate)",
    modo: "rpn",
    titulo: { pt: "Introdução — Guia da faculdade da filha (4 exemplos)", it: "Introduzione — Guida al fondo università della figlia (4 esempi)" },
    objetivo: {
      pt: "Os 4 exemplos de abertura do manual, encadeados: quanto depositar hoje (PV), quanto rende uma apólice semestral (FV), quanto depositar por mês para completar a meta (PMT) e qual a taxa mínima necessária (i).",
      it: "I 4 esempi di apertura del manuale, in sequenza: quanto depositare oggi (PV), quanto rende una polizza semestrale (FV), quanto depositare al mese per completare l'obiettivo (PMT) e qual è il tasso minimo necessario (i).",
    },
    tags: ["introdução", "introduzione", "financeiro", "finanziario", "tvm", "pv", "fv", "pmt", "faculdade", "università", "begin", "end", "semestral", "semestrale"],
    linhas: [
      { keys: ["f", "REG", "f", "2"], display: "0.00", nota: { pt: "Zera tudo e fixa 2 casas decimais.", it: "Azzera tutto e fissa 2 decimali." } },
      { keys: ["4", "g", "12x"], display: "48.00", nota: { pt: "Ex.1 — 4 anos × 12 = 48 meses (n).", it: "Es.1 — 4 anni × 12 = 48 mesi (n)." } },
      { keys: ["6", "g", "12÷"], display: "0.50", nota: { pt: "6% ao ano ÷ 12 = 0,5% ao mês (i).", it: "6% annuo ÷ 12 = 0,5% al mese (i)." } },
      { keys: ["500", "PMT"], display: "500.00", nota: { pt: "Saque mensal de 500 (PMT).", it: "Prelievo mensile di 500 (PMT)." } },
      { keys: ["g", "BEG"], display: "500.00", nota: { pt: "Modo início de período (saques no começo do mês).", it: "Modalità inizio periodo (prelievi a inizio mese)." } },
      { keys: ["PV"], display: "-21,396.61", nota: { pt: "PV: depositar 21.396,61 hoje.", it: "PV: depositare 21.396,61 oggi." } },
      { keys: ["f", "FIN"], display: "-21,396.61", nota: { pt: "Ex.2 — limpa só os registradores financeiros (mantém o resto).", it: "Es.2 — pulisce solo i registri finanziari (mantiene il resto)." } },
      { keys: ["14", "ENTER", "2", "×", "n"], display: "28.00", nota: { pt: "14 anos × 2 períodos/ano = 28 (capitalização SEMESTRAL).", it: "14 anni × 2 periodi/anno = 28 (capitalizzazione SEMESTRALE)." } },
      { keys: ["5.35", "ENTER", "2", "÷", "i"], display: "2.68", nota: { pt: "5,35% ao ano ÷ 2 = 2,68% ao semestre.", it: "5,35% annuo ÷ 2 = 2,68% al semestre." } },
      { keys: ["5000", "CHS", "PV"], display: "-5,000.00", nota: { pt: "Investe 5.000 hoje (saída = negativo).", it: "Investe 5.000 oggi (uscita = negativo)." } },
      { keys: ["FV"], display: "10,470.85", nota: { pt: "FV: a apólice valerá 10.470,85 em 14 anos.", it: "FV: la polizza varrà 10.470,85 in 14 anni." } },
      { keys: ["f", "FIN"], display: "10,470.85", nota: { pt: "Ex.3 — limpa os registradores financeiros.", it: "Es.3 — pulisce i registri finanziari." } },
      { keys: ["14", "g", "12x"], display: "168.00", nota: { pt: "14 anos × 12 = 168 meses (n).", it: "14 anni × 12 = 168 mesi (n)." } },
      { keys: ["6", "g", "12÷"], display: "0.50", nota: { pt: "6% ÷ 12 = 0,5% ao mês (i).", it: "6% ÷ 12 = 0,5% al mese (i)." } },
      { keys: ["10925.76", "FV"], display: "10,925.76", nota: { pt: "Meta: 10.925,76 (FV).", it: "Obiettivo: 10.925,76 (FV)." } },
      { keys: ["g", "END"], display: "10,925.76", nota: { pt: "Modo fim de período (depósitos no fim do mês).", it: "Modalità fine periodo (depositi a fine mese)." } },
      { keys: ["PMT"], display: "-41.65", nota: { pt: "PMT: depositar 41,65 por mês.", it: "PMT: depositare 41,65 al mese." } },
      { keys: ["45", "CHS", "PMT"], display: "-45.00", nota: { pt: "Ex.4 — em vez disso, parcela fixa de 45 por mês (saída).", it: "Es.4 — invece, rata fissa di 45 al mese (uscita)." } },
      { keys: ["i"], display: "0.42", nota: { pt: "Taxa periódica (mensal) mínima: 0,42%.", it: "Tasso periodico (mensile) minimo: 0,42%." } },
      { keys: ["12", "×"], display: "5.01", nota: { pt: "×12: taxa anual mínima de 5,01%.", it: "×12: tasso annuo minimo del 5,01%." } },
    ],
  },
];

export const handbookSecao1 = [
  {
    nome: "p19-20 — Simple arithmetic (RPN): 13 ÷ 2 = 6.50",
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
    nome: "p21 — Checkbook chain calculation (RPN) = 1,064.54",
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
      { keys: ["13.70", "-"], display: "21.68", nota: { pt: "Desconta 13,70 → 21,68.", it: "Sottrae 13,70 → 21,68." } },
      { keys: ["10.14", "-"], display: "11.54", nota: { pt: "Desconta 10,14 → 11,54.", it: "Sottrae 10,14 → 11,54." } },
      { keys: ["1053", "+"], display: "1,064.54", nota: { pt: "Soma um depósito de 1.053 → saldo final 1.064,54.", it: "Aggiunge un deposito di 1.053 → saldo finale 1.064,54." } },
    ],
  },
  {
    nome: "p22 — (3×4)+(5×6) = 42 (RPN)",
    modo: "rpn",
    titulo: { pt: "Soma de dois produtos (RPN)", it: "Somma di due prodotti (RPN)" },
    objetivo: {
      pt: "Ver a pilha guardar um resultado enquanto você calcula outro: (3×4)+(5×6).",
      it: "Vedere lo stack conservare un risultato mentre ne calcoli un altro: (3×4)+(5×6).",
    },
    tags: ["rpn", "pilha", "stack", "multiplicação", "moltiplicazione"],
    linhas: [
      { keys: ["3", "ENTER", "4", "×"], display: "12.00", nota: { pt: "Calcula 3×4 = 12 (fica guardado na pilha).", it: "Calcola 3×4 = 12 (resta nello stack)." } },
      { keys: ["5", "ENTER", "6", "×"], display: "30.00", nota: { pt: "Calcula 5×6 = 30; o 12 anterior subiu na pilha.", it: "Calcola 5×6 = 30; il 12 precedente è salito nello stack." } },
      { keys: ["+"], display: "42.00", nota: { pt: "Soma os dois produtos: 12 + 30 = 42.", it: "Somma i due prodotti: 12 + 30 = 42." } },
    ],
  },
  {
    nome: "p24 — STO/RCL invoice, survives power OFF/ON (Continuous Memory) = 22,000.00",
    modo: "rpn",
    titulo: { pt: "Fatura com STO/RCL — sobrevive ao desligar (Memória Contínua)", it: "Fattura con STO/RCL — sopravvive allo spegnimento (Memoria Continua)" },
    objetivo: {
      pt: "Guarda preços em registradores, DESLIGA e LIGA a calculadora, e confirma que os valores continuam lá (Memória Contínua).",
      it: "Memorizza i prezzi nei registri, SPEGNE e ACCENDE la calcolatrice, e conferma che i valori sono ancora lì (Memoria Continua).",
    },
    tags: ["rpn", "memória", "memoria", "sto", "rcl", "registrador", "registro", "fatura", "fattura", "desligar", "spegnere", "on", "off"],
    linhas: [
      { keys: ["3250", "STO", "1"], display: "3,250.00", nota: { pt: "Guarda o preço do computador (3.250) no registrador 1.", it: "Memorizza il prezzo del computer (3.250) nel registro 1." } },
      { keys: ["2500", "STO", "2"], display: "2,500.00", nota: { pt: "Guarda o preço da impressora (2.500) no registrador 2.", it: "Memorizza il prezzo della stampante (2.500) nel registro 2." } },
      { keys: ["ON"], display: "=", nota: { pt: "Desliga a calculadora.", it: "Spegne la calcolatrice." } },
      { keys: ["ON"], display: "2,500.00", nota: { pt: "Liga de novo: o visor volta a mostrar o último valor (2.500).", it: "Riaccende: il display torna a mostrare l'ultimo valore (2.500)." } },
      { keys: ["RCL", "1"], display: "3,250.00", nota: { pt: "Recupera o preço do computador (os registradores sobreviveram ao desligar).", it: "Richiama il prezzo del computer (i registri sono sopravvissuti allo spegnimento)." } },
      { keys: ["6", "×"], display: "19,500.00", nota: { pt: "Multiplica por 6 computadores → 19.500.", it: "Moltiplica per 6 computer → 19.500." } },
      { keys: ["RCL", "2"], display: "2,500.00", nota: { pt: "Recupera o preço da impressora.", it: "Richiama il prezzo della stampante." } },
      { keys: ["+"], display: "22,000.00", nota: { pt: "Soma → total da fatura: 22.000.", it: "Somma → totale fattura: 22.000." } },
    ],
  },
  {
    nome: "p26 — Storage register arithmetic (RPN): checkbook balance = 1,064.54",
    modo: "rpn",
    titulo: { pt: "Aritmética no registrador (RPN)", it: "Aritmetica sul registro (RPN)" },
    objetivo: {
      pt: "Somar e subtrair direto na memória (STO −, STO +) para manter um saldo acumulado, sem passar pelo visor.",
      it: "Sommare e sottrarre direttamente in memoria (STO −, STO +) per tenere un saldo accumulato, senza passare dal display.",
    },
    tags: ["rpn", "memória", "memoria", "sto", "registrador", "registro", "saldo"],
    linhas: [
      { keys: ["58.33", "STO", "0"], display: "58.33", nota: { pt: "Guarda o saldo inicial 58,33 no registrador 0.", it: "Memorizza il saldo iniziale 58,33 nel registro 0." } },
      { keys: ["22.95", "STO", "-", "0"], display: "22.95", nota: { pt: "Subtrai 22,95 direto no registrador 0.", it: "Sottrae 22,95 direttamente nel registro 0." } },
      { keys: ["13.70", "STO", "-", "0"], display: "13.70", nota: { pt: "Subtrai 13,70 no registrador 0.", it: "Sottrae 13,70 nel registro 0." } },
      { keys: ["10.14", "STO", "-", "0"], display: "10.14", nota: { pt: "Subtrai 10,14 no registrador 0.", it: "Sottrae 10,14 nel registro 0." } },
      { keys: ["1053", "STO", "+", "0"], display: "1,053.00", nota: { pt: "Soma 1.053 no registrador 0.", it: "Aggiunge 1.053 nel registro 0." } },
      { keys: ["RCL", "0"], display: "1,064.54", nota: { pt: "Recupera o saldo acumulado: 1.064,54.", it: "Richiama il saldo accumulato: 1.064,54." } },
    ],
  },
];
