// Capítulo 5 — Seção 5 (Additional Operating Features): x≷y, LST x, constante.

export const secao5 = [
  {
    nome: "p90 — x≷y (RPN): 144.25 − 25.83 = 118.42",
    modo: "rpn",
    linhas: [
      { keys: ["25.83", "ENTER", "144.25"], display: "144.25" },
      { keys: ["x≷y"], display: "25.83" },
      { keys: ["-"], display: "118.42" },
    ],
  },
  {
    nome: "p91 — Aritmética com constante via LST x (×4.38)",
    modo: "rpn",
    linhas: [
      { keys: ["15", "ENTER", "4.38", "×"], display: "65.70" },
      { keys: ["75", "g", "LSTx"], display: "4.38" },
      { keys: ["×"], display: "328.50" },
      { keys: ["250", "g", "LSTx"], display: "4.38" },
      { keys: ["×"], display: "1,095.00" },
    ],
  },
  {
    nome: "p91-92 — Recuperar de erro de digitação via LST x",
    modo: "rpn",
    linhas: [
      { keys: ["429000", "ENTER", "9987", "÷"], display: "42.96" },
      { keys: ["g", "LSTx"], display: "9,987.00" },
      { keys: ["429000", "ENTER", "987", "÷"], display: "434.65" },
    ],
  },
];
