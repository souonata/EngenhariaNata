// Apêndice D — condições de erro. O guia lista as condições (sem tabelas
// Keystrokes|Display), então verificamos que a calc sinaliza "Error" nas
// operações inválidas e que uma tecla seguinte limpa o erro.

export const erros = [
  {
    nome: "Error: division by zero (5 ÷ 0)",
    modo: "rpn",
    linhas: [{ keys: ["5", "ENTER", "0", "÷"], display: "Error 0" }],
  },
  {
    nome: "Error: 1/x of zero",
    modo: "rpn",
    linhas: [{ keys: ["0", "1/x"], display: "Error 0" }],
  },
  {
    nome: "Error: square root of a negative",
    modo: "rpn",
    linhas: [{ keys: ["4", "CHS", "g", "√x"], display: "Error 0" }],
  },
  {
    nome: "Error: LN of zero",
    modo: "rpn",
    linhas: [{ keys: ["0", "g", "LN"], display: "Error 0" }],
  },
  {
    nome: "Error: factorial of a non-integer",
    modo: "rpn",
    linhas: [{ keys: ["1.5", "g", "n!"], display: "Error 0" }],
  },
  {
    nome: "Error clears on next keypress (type 7 after ÷0)",
    modo: "rpn",
    linhas: [
      { keys: ["5", "ENTER", "0", "÷"], display: "Error 0" },
      { keys: ["7"], display: "7" },
    ],
  },
];
