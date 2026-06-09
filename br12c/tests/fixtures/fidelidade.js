// Testes de fidelidade à HP 12C Platinum (correções da auditoria técnica).
// Cada caso simula o pressionar real das teclas e confere o display.

export const fidelidade = [
  {
    // #1 (Alto): o n CALCULADO é arredondado ao próximo inteiro (quirk do 12C).
    // 1.5% / PV 0 / PMT -25 / FV 365 -> n bruto ≈ 13,30 -> HP mostra 14.
    nome: "#1 — n calculado arredonda para inteiro (≈13,30 → 14)",
    modo: "rpn",
    linhas: [
      { keys: ["f", "REG"], display: "0.00" },
      { keys: ["1.5", "i"], display: "1.50" },
      { keys: ["0", "PV"], display: "0.00" },
      { keys: ["25", "CHS", "PMT"], display: "-25.00" },
      { keys: ["365", "FV"], display: "365.00" },
      { keys: ["n"], display: "14.00" },
    ],
  },
  {
    // #5 (RPN): RND habilita o stack lift; o próximo número levanta a pilha.
    // 1,236 -> RND(FIX 2)=1,24; 8 levanta; 1,24 + 8 = 9,24.
    nome: "#5 — f RND reabilita o stack lift (1.236 RND 8 + = 9.24)",
    modo: "rpn",
    linhas: [
      { keys: ["f", "REG"], display: "0.00" },
      { keys: ["1.236", "f", "RND"], display: "1.24" },
      { keys: ["8", "+"], display: "9.24" },
    ],
  },
  {
    // #6: STO ÷ 0 deve sinalizar Error (não deixar o registrador mudo).
    nome: "#6 — STO ÷ 0 gera Error 0",
    modo: "rpn",
    linhas: [
      { keys: ["100", "STO", "5"], display: "100.00" },
      { keys: ["0", "STO", "÷", "5"], display: "Error 0" },
    ],
  },
  {
    // #3: estatística sem dados -> Error 2 (código de erro da 12C).
    nome: "#3 — média sem dados gera Error 2",
    modo: "rpn",
    linhas: [
      { keys: ["f", "Σ"], display: "0.00" },
      { keys: ["g", "x̄"], display: "Error 2" },
    ],
  },
  {
    // #4: SST em Run mode executa uma instrução por vez (single-step). Grava o
    // programa "preço −25% +5" e percorre com SST (entrada 625), linha a linha.
    nome: "#4 — SST single-step em Run mode (625 → 473.75)",
    modo: "rpn",
    linhas: [
      { keys: ["f", "P/R"], display: "000," },
      { keys: ["f", "PRGM"], display: "000," },
      { keys: ["ENTER"], display: "001,        36" },
      { keys: ["2"], display: "002,         2" },
      { keys: ["5"], display: "003,         5" },
      { keys: ["%"], display: "004,        25" },
      { keys: ["-"], display: "005,        30" },
      { keys: ["5"], display: "006,         5" },
      { keys: ["+"], display: "007,        40" },
      { keys: ["f", "P/R"], display: "0.00" },
      { keys: ["625"], display: "625." },
      { keys: ["SST"], display: "625.00" }, // linha 001 ENTER
      { keys: ["SST"], display: "2." }, // linha 002 dígito 2
      { keys: ["SST"], display: "25." }, // linha 003 dígito 5 (acumula → 25)
      { keys: ["SST"], display: "156.25" }, // linha 004 %
      { keys: ["SST"], display: "468.75" }, // linha 005 −
      { keys: ["SST"], display: "5." }, // linha 006 dígito 5
      { keys: ["SST"], display: "473.75" }, // linha 007 +
    ],
  },
];
