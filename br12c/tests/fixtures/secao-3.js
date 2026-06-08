// Capítulo 3 — Seção 3 (Basic Financial). Juros compostos / TVM.
// Exemplos canônicos 1–3 de "Making Financial Calculations Easy" (p.12–14),
// encadeados (Ex.2 e 3 continuam do display anterior via f CLEAR FIN).

export const secao3 = [
  {
    nome: "p12-14 — Juros compostos (Ex.1-3): PV / FV / PMT, BEG e END",
    modo: "rpn",
    linhas: [
      // Exemplo 1: depósito necessário (PV), modo BEGIN.
      { keys: ["f", "REG"], display: "0.00" },
      { keys: ["f", "2"], display: "0.00" },
      { keys: ["4", "g", "12x"], display: "48.00" },
      { keys: ["6", "g", "12÷"], display: "0.50" },
      { keys: ["500", "PMT"], display: "500.00" },
      { keys: ["g", "BEG"], display: "500.00" },
      { keys: ["PV"], display: "-21,396.61" },
      // Exemplo 2: valor futuro (FV) da apólice.
      { keys: ["f", "FIN"], display: "-21,396.61" },
      { keys: ["14", "n"], display: "14.00" },
      { keys: ["5.35", "i"], display: "5.35" },
      { keys: ["5000", "CHS", "PV"], display: "-5,000.00" },
      { keys: ["FV"], display: "10,371.79" },
      // Exemplo 3: pagamento mensal (PMT), modo END.
      { keys: ["f", "FIN"], display: "10,371.79" },
      { keys: ["14", "g", "12x"], display: "168.00" },
      { keys: ["6", "g", "12÷"], display: "0.50" },
      { keys: ["11024.82", "FV"], display: "11,024.82" },
      { keys: ["g", "END"], display: "11,024.82" },
      { keys: ["PMT"], display: "-42.03" },
    ],
  },
];
