// Parte II — Programação (Seção 8). Grava o programa "preço − 25% + 5" (desconto
// e frete) em modo PRGM e o executa com R/S. Guia p.108 (gravação) e p.117 (run).

export const programa = [
  {
    nome: "p108/117 — Programa desconto+frete: grava (001-007) e roda 625 → 473.75",
    modo: "rpn",
    linhas: [
      { keys: ["f", "P/R"], display: "000," },
      { keys: ["ENTER"], display: "001,        36" },
      { keys: ["2"], display: "002,         2" },
      { keys: ["5"], display: "003,         5" },
      { keys: ["%"], display: "004,        25" },
      { keys: ["-"], display: "005,        30" },
      { keys: ["5"], display: "006,         5" },
      { keys: ["+"], display: "007,        40" },
      { keys: ["f", "P/R"], display: "0.00" },
      { keys: ["625"], display: "625." },
      { keys: ["R/S"], display: "473.75" },
    ],
  },
  {
    nome: "p112 — SST avança e g BST retrocede em modo Programa",
    modo: "rpn",
    linhas: [
      { keys: ["f", "P/R"], display: "000," },
      { keys: ["ENTER"], display: "001,        36" },
      { keys: ["2"], display: "002,         2" },
      { keys: ["g", "BST"], display: "001,        36" },
      { keys: ["g", "BST"], display: "000," },
      { keys: ["SST"], display: "001,        36" },
      { keys: ["SST"], display: "002,         2" },
    ],
  },
  {
    nome: "p116 — g GTO . 000 posiciona na linha 000",
    modo: "rpn",
    linhas: [
      { keys: ["f", "P/R"], display: "000," },
      { keys: ["ENTER"], display: "001,        36" },
      { keys: ["g", "GTO", ".", "0", "0", "0"], display: "000," },
    ],
  },
  {
    nome: "p119-123 — Programa de fatura (PSE + acumuladores): item 13×68.50",
    modo: "rpn",
    linhas: [
      { keys: ["6.75", "STO", "0"], display: "6.75" },
      { keys: ["f", "P/R"], display: "000," },
      { keys: ["f", "PRGM"], display: "000," },
      { keys: ["×"], display: "001,        20" },
      { keys: ["g", "PSE"], display: "002,    43 31" },
      { keys: ["STO", "+", "1"], display: "003,44 40   1" },
      { keys: ["RCL", "0"], display: "004,    45   0" },
      { keys: ["%"], display: "005,        25" },
      { keys: ["g", "PSE"], display: "006,    43 31" },
      { keys: ["STO", "+", "2"], display: "007,44 40   2" },
      { keys: ["+"], display: "008,        40" },
      { keys: ["STO", "+", "3"], display: "009,44 40   3" },
      { keys: ["f", "P/R"], display: "6.75" },
      { keys: ["13", "ENTER", "68.5", "R/S"], display: "950.61" },
      { keys: ["RCL", "1"], display: "890.50" },
      { keys: ["RCL", "2"], display: "60.11" },
      { keys: ["RCL", "3"], display: "950.61" },
    ],
  },
];
