// Capítulo 1 — Seção 1 do guia (Getting Started).
// Exemplos com tabela explícita de Keystrokes|Display. Pulados (outros capítulos):
//   - EEX/notação científica (Seção 5)
//   - backspace (sem tecla on-screen)
//   - √x na cadeia (Seção 7)
//   - parênteses ALG (provável não implementado / Seção 5)

export const secao1 = [
  {
    nome: "p21 — Simple arithmetic (RPN): 13 ÷ 2 = 6.50",
    modo: "rpn",
    linhas: [
      { keys: ["13", "ENTER"], display: "13.00" },
      { keys: ["2", "÷"], display: "6.50" },
    ],
  },
  {
    nome: "p22 — Simple arithmetic (ALG): 21.1 + 23.8 = 44.90",
    modo: "alg",
    linhas: [
      { keys: ["CLx", "CLx"], display: "0.00" },
      { keys: ["21.1", "+"], display: "21.10" },
      { keys: ["23.8"], display: "23.8" },
      { keys: ["="], display: "44.90" },
    ],
  },
  {
    nome: "p22 — Chain calculation (ALG): 77.35 − 90.89 = −13.54",
    modo: "alg",
    linhas: [
      { keys: ["CLx", "CLx"], display: "0.00" },
      { keys: ["77.35", "-"], display: "77.35" },
      { keys: ["90.89", "="], display: "-13.54" },
    ],
  },
  {
    nome: "p23 — Checkbook chain calculation (RPN) = 1,064.54",
    modo: "rpn",
    linhas: [
      { keys: ["58.33", "ENTER"], display: "58.33" },
      { keys: ["22.95", "-"], display: "35.38" },
      { keys: ["13.7", "-"], display: "21.68" },
      { keys: ["10.14", "-"], display: "11.54" },
      { keys: ["1053", "+"], display: "1,064.54" },
    ],
  },
  {
    nome: "p25 — (3×4)+(5×6) = 42 (RPN)",
    modo: "rpn",
    linhas: [
      { keys: ["3", "ENTER", "4", "×"], display: "12.00" },
      { keys: ["5", "ENTER", "6", "×"], display: "30.00" },
      { keys: ["+"], display: "42.00" },
    ],
  },
  {
    nome: "p26 — Long chain (ALG): 456−75÷18.5×68÷1.9 = 737.07",
    modo: "alg",
    linhas: [
      { keys: ["CLx", "CLx"], display: "0.00" },
      { keys: ["456", "-", "75", "÷"], display: "381.00" },
      { keys: ["18.5", "×"], display: "20.59" },
      { keys: ["68", "÷"], display: "1,400.43" },
      { keys: ["1.9", "="], display: "737.07" },
    ],
  },
  {
    nome: "p28 — Invoice with STO/RCL (RPN) = 8,000.00",
    modo: "rpn",
    linhas: [
      { keys: ["1250", "STO", "0"], display: "1,250.00" },
      { keys: ["500", "STO", "2"], display: "500.00" },
      { keys: ["RCL", "0"], display: "1,250.00" },
      { keys: ["6", "×"], display: "7,500.00" },
      { keys: ["RCL", "2"], display: "500.00" },
      { keys: ["+"], display: "8,000.00" },
    ],
  },
  {
    nome: "p28 — Invoice with STO/RCL (ALG) = 8,000.00",
    modo: "alg",
    linhas: [
      { keys: ["1250", "STO", "0"], display: "1,250.00" },
      { keys: ["500", "STO", "2"], display: "500.00" },
      { keys: ["RCL", "0"], display: "1,250.00" },
      { keys: ["×", "6"], display: "6." },
      { keys: ["+", "RCL", "2"], display: "500.00" },
      { keys: ["="], display: "8,000.00" },
    ],
  },
  {
    nome: "p29 — Storage register arithmetic (RPN): checkbook balance = 1,064.54",
    modo: "rpn",
    linhas: [
      { keys: ["58.33", "STO", "0"], display: "58.33" },
      { keys: ["22.95", "STO", "-", "0"], display: "22.95" },
      { keys: ["13.7", "STO", "-", "0"], display: "13.70" },
      { keys: ["10.14", "STO", "-", "0"], display: "10.14" },
      { keys: ["1053", "STO", "+", "0"], display: "1,053.00" },
      { keys: ["RCL", "0"], display: "1,064.54" },
    ],
  },
  {
    // Digit separators (p.17): na 12C real e "segurar . e ligar ON"; aqui o combo
    // usa o modo Segurar (HOLD): trava ON, toca "." -> alterna . <-> , e vice-versa.
    nome: "p17 — Digit separators: ON + . swaps point and comma (via Hold mode)",
    modo: "rpn",
    linhas: [
      { keys: ["1234.56", "ENTER"], display: "1,234.56" },
      { keys: ["HOLD", "ON", "."], display: "=1,234.56" },
      { keys: ["ON", ".", "HOLD"], display: "=1.234,56" },
    ],
  },
];
