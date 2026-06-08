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
  {
    nome: "p69-70 — Amortização (25 anos, $250k a 5.25%): 1º e 2º anos",
    modo: "rpn",
    linhas: [
      { keys: ["f", "FIN"], display: "0.00" },
      { keys: ["5.25", "g", "12÷"], display: "0.44" },
      { keys: ["250000", "PV"], display: "250,000.00" },
      { keys: ["1498.12", "CHS", "PMT"], display: "-1,498.12" },
      { keys: ["g", "END"], display: "-1,498.12" },
      { keys: ["12", "f", "AMORT"], display: "-13,006.53" },
      { keys: ["x≷y"], display: "-4,970.91" },
      { keys: ["RCL", "PV"], display: "245,029.09" },
      { keys: ["RCL", "n"], display: "12.00" },
      { keys: ["12", "f", "AMORT"], display: "-12,739.18" },
      { keys: ["x≷y"], display: "-5,238.26" },
      { keys: ["RCL", "PV"], display: "239,790.83" },
      { keys: ["RCL", "n"], display: "24.00" },
    ],
  },
  {
    nome: "p43 — Juros simples (360 dias): $450 a 7%, 60 dias = 5.25",
    modo: "rpn",
    linhas: [
      { keys: ["60", "n"], display: "60.00" },
      { keys: ["7", "i"], display: "7.00" },
      { keys: ["450", "CHS", "PV"], display: "-450.00" },
      { keys: ["f", "INT"], display: "5.25" },
      { keys: ["+"], display: "455.25" },
    ],
  },
  {
    nome: "p43 — Juros simples (365 dias) = 5.18",
    modo: "rpn",
    linhas: [
      { keys: ["60", "n"], display: "60.00" },
      { keys: ["7", "i"], display: "7.00" },
      { keys: ["450", "CHS", "PV"], display: "-450.00" },
      { keys: ["f", "INT", "R↓", "x≷y"], display: "5.18" },
      { keys: ["+"], display: "455.18" },
    ],
  },
];
