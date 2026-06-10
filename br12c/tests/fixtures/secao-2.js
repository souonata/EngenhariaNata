// Capítulo 2 — Seção 2 do guia (Percentage and Calendar). Parte percentual.

export const secao2Percentual = [
  {
    nome: "p31 — % (RPN): 14% of 300 = 42",
    modo: "rpn",
    linhas: [
      { keys: ["300", "ENTER"], display: "300.00" },
      { keys: ["14", "%"], display: "42.00" },
    ],
  },
  {
    nome: "p32 — % (ALG): 14% of 300 = 42",
    modo: "alg",
    linhas: [
      { keys: ["300", "×"], display: "300.00" },
      { keys: ["14", "%"], display: "0.14" },
      { keys: ["="], display: "42.00" },
    ],
  },
  {
    nome: "p32 — % (ALG) after ×: 25% of 200 = 50",
    modo: "alg",
    linhas: [{ keys: ["200", "×", "25", "%", "="], display: "50.00" }],
  },
  {
    nome: "p33 — Net amount (RPN): 23250 −8% +6% = 22,673.40",
    modo: "rpn",
    linhas: [
      { keys: ["23250", "ENTER"], display: "23,250.00" },
      { keys: ["8", "%"], display: "1,860.00" },
      { keys: ["-"], display: "21,390.00" },
      { keys: ["6", "%"], display: "1,283.40" },
      { keys: ["+"], display: "22,673.40" },
    ],
  },
  {
    nome: "p33 — Simple interest via % (ALG): 1250 +7% = 1,337.50",
    modo: "alg",
    linhas: [
      { keys: ["1250", "+", "7", "%"], display: "87.50" },
      { keys: ["="], display: "1,337.50" },
    ],
  },
  {
    nome: "p33 — Net amount (ALG): 23250 −8% +6% = 22,673.40",
    modo: "alg",
    linhas: [
      { keys: ["23250", "-", "8", "%"], display: "1,860.00" },
      { keys: ["+"], display: "21,390.00" },
      { keys: ["6", "%"], display: "1,283.40" },
      { keys: ["="], display: "22,673.40" },
    ],
  },
  {
    nome: "p34 — Δ% (RPN): 58.5 → 53.25 = −8.97",
    modo: "rpn",
    linhas: [
      { keys: ["58.5", "ENTER"], display: "58.50" },
      { keys: ["53.25", "Δ%"], display: "-8.97" },
    ],
  },
  {
    nome: "p35 — %T (RPN): percent of total = 29.69 / 49.31 / 21.01",
    modo: "rpn",
    linhas: [
      { keys: ["3.92", "ENTER"], display: "3.92" },
      { keys: ["2.36", "+"], display: "6.28" },
      { keys: ["1.67", "+"], display: "7.95" },
      { keys: ["2.36"], display: "2.36" },
      { keys: ["%T"], display: "29.69" },
      { keys: ["CLx", "3.92", "%T"], display: "49.31" },
      { keys: ["CLx", "1.67", "%T"], display: "21.01" },
    ],
  },
  {
    nome: "p36 — %T (RPN, known total): 2.36 of 7.95 = 29.69",
    modo: "rpn",
    linhas: [
      { keys: ["7.95", "ENTER"], display: "7.95" },
      { keys: ["2.36"], display: "2.36" },
      { keys: ["%T"], display: "29.69" },
    ],
  },
  {
    nome: "p36 — %T (ALG): percent of total = 29.69",
    modo: "alg",
    linhas: [
      { keys: ["3.92", "+", "2.36", "+", "1.67", "="], display: "7.95" },
      { keys: ["2.36"], display: "2.36" },
      { keys: ["%T"], display: "29.69" },
    ],
  },
];

export const secao2Calendario = [
  {
    nome: "p40 — Days between dates (ΔDYS): 3 Jun 2004 → 14 Oct 2005",
    modo: "rpn",
    linhas: [
      { keys: ["g", "M.DY"], display: "0.00" },
      { keys: ["6.032004", "ENTER"], display: "6.03" },
      { keys: ["10.142005", "g", "ΔDYS"], display: "498.00" },
      { keys: ["x≷y"], display: "491.00" },
    ],
  },
  {
    nome: "p39 — Future date (g DATE): 14 May 2004 + 120 days = 11 Sep 2004 (Sat)",
    modo: "rpn",
    linhas: [
      { keys: ["g", "D.MY"], display: "0.00" },
      { keys: ["14.052004", "ENTER"], display: "14.05" },
      { keys: ["120", "g", "DATE"], display: "11,09,2004 6" },
    ],
  },
];
