// Fixtures do Robot Guide para Section 7 e Appendices A/B/C (índice EN do User
// Guide). Exemplos curtos com números já validados pelo motor nas suítes headless
// (matematica/pilha/secao-4/smoke). Cada exemplo é independente: o runner zera a
// calculadora e fixa o modo (f RPN / f ALG) antes de cada um.

export const secao7 = [
  {
    nome: "p100 — y^x: 2 ENTER 3 y^x = 8",
    modo: "rpn",
    linhas: [{ keys: ["2", "ENTER", "3", "y^x"], display: "8.00" }],
  },
  {
    nome: "p101 — √x and n!: √4 = 2; 5 n! = 120",
    modo: "rpn",
    linhas: [
      { keys: ["4", "g", "√x"], display: "2.00" },
      { keys: ["5", "g", "n!"], display: "120.00" },
    ],
  },
  {
    nome: "p102 — INTG and FRAC of 2.5",
    modo: "rpn",
    linhas: [
      { keys: ["2.5", "g", "INTG"], display: "2.00" },
      { keys: ["2.5", "g", "FRAC"], display: "0.50" },
    ],
  },
];

export const apendiceA = [
  {
    nome: "p235 — R↓ rolls the stack: 1↑2↑3↑4 R↓ → 3",
    modo: "rpn",
    linhas: [{ keys: ["1", "ENTER", "2", "ENTER", "3", "ENTER", "4", "R↓"], display: "3.00" }],
  },
  {
    nome: "p238 — LST x recalls the operand: 12÷3, LSTx, × → 12",
    modo: "rpn",
    linhas: [
      { keys: ["12", "ENTER", "3", "÷"], display: "4.00" },
      { keys: ["g", "LSTx"], display: "3.00" },
      { keys: ["×"], display: "12.00" },
    ],
  },
];

export const apendiceB = [
  {
    nome: "p242 — Arithmetic in ALG: 2 + 3 = 5",
    modo: "alg",
    linhas: [{ keys: ["2", "+", "3", "="], display: "5.00" }],
  },
  {
    nome: "p243 — ALG: 19.8745632 − 5 = 14.87",
    modo: "alg",
    linhas: [
      { keys: ["19.8745632", "-"], display: "19.87" },
      { keys: ["5", "="], display: "14.87" },
    ],
  },
];

export const apendiceC = [
  {
    nome: "p248 — IRR (grouped cash flows p.76-78, full setup) = 13.72",
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
      { keys: ["f", "IRR"], display: "13.72" },
    ],
  },
];

// Appendix F — Verifying Proper Operation (self-test do teclado/display): na 12C
// real entra-se "segurando ÷ e ligando ON"; aqui o combo usa o modo Segurar (HOLD).
// Acende todos os segmentos, depois exige as 40 teclas na ordem fisica (ENTER 2x,
// linhas 3 e 4); termina em 12. Ordem errada -> Error 9.
export const apendiceF = [
  {
    nome: "p266 — Keyboard/display self-test: ÷+ON, all 40 keys in order → 12",
    modo: "rpn",
    linhas: [
      { keys: ["HOLD", "÷", "ON"], display: "8888888888" },
      {
        keys: [
          "n", "i", "PV", "PMT", "FV", "CHS", "7", "8", "9", "÷",
          "y^x", "1/x", "%T", "Δ%", "%", "EEX", "4", "5", "6", "×",
          "R/S", "SST", "R↓", "x≷y", "CLx", "ENTER", "1", "2", "3", "-",
          "ON", "f", "g", "STO", "RCL", "ENTER", "0", ".", "Σ+", "+",
        ],
        display: "12",
      },
    ],
  },
];
