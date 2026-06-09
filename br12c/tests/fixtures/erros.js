// Apêndice D — condições de erro. O guia lista as condições (sem tabelas
// Keystrokes|Display), então verificamos que a calc sinaliza "Error" nas
// operações inválidas e que uma tecla seguinte limpa o erro.

export const erros = [
  {
    nome: "Error: divisão por zero (5 ÷ 0)",
    modo: "rpn",
    linhas: [{ keys: ["5", "ENTER", "0", "÷"], display: "Error 0" }],
  },
  {
    nome: "Error: 1/x de zero",
    modo: "rpn",
    linhas: [{ keys: ["0", "1/x"], display: "Error 0" }],
  },
  {
    nome: "Error: raiz quadrada de negativo",
    modo: "rpn",
    linhas: [{ keys: ["4", "CHS", "g", "√x"], display: "Error 0" }],
  },
  {
    nome: "Error: LN de zero",
    modo: "rpn",
    linhas: [{ keys: ["0", "g", "LN"], display: "Error 0" }],
  },
  {
    nome: "Error: fatorial de não-inteiro",
    modo: "rpn",
    linhas: [{ keys: ["1.5", "g", "n!"], display: "Error 0" }],
  },
  {
    nome: "Erro é limpo ao pressionar uma tecla (digita 7 após ÷0)",
    modo: "rpn",
    linhas: [
      { keys: ["5", "ENTER", "0", "÷"], display: "Error 0" },
      { keys: ["7"], display: "7" },
    ],
  },
];
