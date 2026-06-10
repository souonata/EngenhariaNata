// Smoke do Capítulo 0: prova o pipeline (tradutor + loader + comparador) com
// teclas que a calc JÁ implementa. Não testa o guia em si — só a infra.

export const smoke = [
  {
    nome: "RPN: 2 ENTER 3 + = 5",
    linhas: [{ keys: ["2", "ENTER", "3", "+"], display: "5.00" }],
  },
  {
    nome: "f + digit sets decimal places (FIX)",
    linhas: [
      { keys: ["2", "ENTER", "3", "+"], display: "5.00" },
      { keys: ["f", "1"], display: "5.0" },
      { keys: ["f", "4"], display: "5.0000" },
    ],
  },
];
