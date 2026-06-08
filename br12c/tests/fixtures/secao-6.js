// Capítulo 6 — Seção 6 (Statistics). Média, desvio-padrão e média ponderada.

export const secao6 = [
  {
    nome: "p95-96 — Média e desvio-padrão (7 vendedores)",
    modo: "rpn",
    linhas: [
      { keys: ["f", "Σ"], display: "0.00" },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00" },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00" },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00" },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00" },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00" },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00" },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00" },
      { keys: ["g", "x̄"], display: "21,714.29" },
      { keys: ["x≷y"], display: "40.00" },
      { keys: ["g", "s"], display: "4,820.59" },
      { keys: ["x≷y"], display: "6.03" },
    ],
  },
  {
    nome: "p99 — Média ponderada (gasolina) = 1.19",
    modo: "rpn",
    linhas: [
      { keys: ["f", "Σ"], display: "0.00" },
      { keys: ["1.16", "ENTER", "15", "Σ+"], display: "1.00" },
      { keys: ["1.24", "ENTER", "7", "Σ+"], display: "2.00" },
      { keys: ["1.2", "ENTER", "10", "Σ+"], display: "3.00" },
      { keys: ["1.18", "ENTER", "17", "Σ+"], display: "4.00" },
      { keys: ["g", "x̄w"], display: "1.19" },
    ],
  },
  {
    nome: "p97-98 — Regressão linear: x̂, correlação r e intercepto",
    modo: "rpn",
    linhas: [
      { keys: ["f", "Σ"], display: "0.00" },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00" },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00" },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00" },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00" },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00" },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00" },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00" },
      { keys: ["48", "g", "x̂,r"], display: "28,818.93" },
      { keys: ["x≷y"], display: "0.90" },
      { keys: ["0", "g", "ŷ,r"], display: "15.55" },
    ],
  },
];
