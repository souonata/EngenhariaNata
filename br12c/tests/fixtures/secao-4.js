// Capítulo 4 — Seção 4 (Additional Financial). NPV, IRR e fluxo de caixa.

export const secao4 = [
  {
    nome: "p74-75 — NPV (fluxo não-agrupado): duplex = 212.18",
    modo: "rpn",
    linhas: [
      { keys: ["f", "REG"], display: "0.00" },
      { keys: ["80000", "CHS", "g", "CFo"], display: "-80,000.00" },
      { keys: ["500", "CHS", "g", "CFj"], display: "-500.00" },
      { keys: ["4500", "g", "CFj"], display: "4,500.00" },
      { keys: ["5500", "g", "CFj"], display: "5,500.00" },
      { keys: ["4500", "g", "CFj"], display: "4,500.00" },
      { keys: ["130000", "g", "CFj"], display: "130,000.00" },
      { keys: ["RCL", "n"], display: "5.00" },
      { keys: ["13", "i"], display: "13.00" },
      { keys: ["f", "NPV"], display: "212.18" },
    ],
  },
  {
    nome: "p76-78 — NPV (fluxo agrupado) = 907.77 e IRR = 13.72",
    modo: "rpn",
    linhas: [
      { keys: ["f", "REG"], display: "0.00" },
      { keys: ["79000", "CHS", "g", "CFo"], display: "-79,000.00" },
      { keys: ["14000", "g", "CFj"], display: "14,000.00" },
      { keys: ["11000", "g", "CFj"], display: "11,000.00" },
      { keys: ["10000", "g", "CFj"], display: "10,000.00" },
      { keys: ["3", "g", "Nj"], display: "3.00" },
      { keys: ["9100", "g", "CFj"], display: "9,100.00" },
      { keys: ["9000", "g", "CFj"], display: "9,000.00" },
      { keys: ["2", "g", "Nj"], display: "2.00" },
      { keys: ["4500", "g", "CFj"], display: "4,500.00" },
      { keys: ["100000", "g", "CFj"], display: "100,000.00" },
      { keys: ["RCL", "n"], display: "7.00" },
      { keys: ["13.5", "i"], display: "13.50" },
      { keys: ["f", "NPV"], display: "907.77" },
      { keys: ["f", "IRR"], display: "13.72" },
    ],
  },
];
