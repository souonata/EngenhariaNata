// Apêndice D — condições de erro. O guia lista as condições (sem tabelas
// Keystrokes|Display), então verificamos que a calc sinaliza "Error" nas
// operações inválidas e que uma tecla seguinte limpa o erro.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const erros = [
  {
    nome: "Error: division by zero (5 ÷ 0)",
    modo: "rpn",
    titulo: { pt: "Erro: divisão por zero", it: "Errore: divisione per zero" },
    objetivo: { pt: "A calculadora sinaliza Error 0 numa operação matemática inválida (÷ 0).", it: "La calcolatrice segnala Error 0 in un'operazione matematica non valida (÷ 0)." },
    tags: ["erro", "errore", "error 0", "divisão por zero", "divisione per zero"],
    linhas: [
      { keys: ["5", "ENTER", "0", "÷"], display: "Error 0", nota: { pt: "5 ÷ 0 não existe → Error 0.", it: "5 ÷ 0 non esiste → Error 0." } },
    ],
  },
  {
    nome: "Error: 1/x of zero",
    modo: "rpn",
    titulo: { pt: "Erro: 1/x de zero", it: "Errore: 1/x di zero" },
    objetivo: { pt: "O inverso de zero é indefinido → Error 0.", it: "L'inverso di zero è indefinito → Error 0." },
    tags: ["erro", "errore", "error 0", "inverso", "1/x"],
    linhas: [
      { keys: ["0", "1/x"], display: "Error 0", nota: { pt: "1 ÷ 0 não existe → Error 0.", it: "1 ÷ 0 non esiste → Error 0." } },
    ],
  },
  {
    nome: "Error: square root of a negative",
    modo: "rpn",
    titulo: { pt: "Erro: raiz de número negativo", it: "Errore: radice di numero negativo" },
    objetivo: { pt: "Não existe raiz quadrada real de um número negativo → Error 0.", it: "Non esiste radice quadrata reale di un numero negativo → Error 0." },
    tags: ["erro", "errore", "error 0", "raiz", "radice", "negativo"],
    linhas: [
      { keys: ["4", "CHS", "g", "√x"], display: "Error 0", nota: { pt: "√(−4) não é real → Error 0.", it: "√(−4) non è reale → Error 0." } },
    ],
  },
  {
    nome: "Error: LN of zero",
    modo: "rpn",
    titulo: { pt: "Erro: logaritmo de zero", it: "Errore: logaritmo di zero" },
    objetivo: { pt: "O logaritmo natural de zero é indefinido → Error 0.", it: "Il logaritmo naturale di zero è indefinito → Error 0." },
    tags: ["erro", "errore", "error 0", "logaritmo", "ln"],
    linhas: [
      { keys: ["0", "g", "LN"], display: "Error 0", nota: { pt: "ln(0) é indefinido → Error 0.", it: "ln(0) è indefinito → Error 0." } },
    ],
  },
  {
    nome: "Error: factorial of a non-integer",
    modo: "rpn",
    titulo: { pt: "Erro: fatorial de não-inteiro", it: "Errore: fattoriale di non intero" },
    objetivo: { pt: "O fatorial (n!) só vale para inteiros → 1,5 dá Error 0.", it: "Il fattoriale (n!) vale solo per interi → 1,5 dà Error 0." },
    tags: ["erro", "errore", "error 0", "fatorial", "fattoriale", "n!"],
    linhas: [
      { keys: ["1.5", "g", "n!"], display: "Error 0", nota: { pt: "1,5! não é definido → Error 0.", it: "1,5! non è definito → Error 0." } },
    ],
  },
  {
    nome: "Error clears on next keypress (type 7 after ÷0)",
    modo: "rpn",
    titulo: { pt: "O erro some na próxima tecla", it: "L'errore sparisce al tasto successivo" },
    objetivo: { pt: "Depois de um erro, basta digitar para limpá-lo e continuar.", it: "Dopo un errore, basta digitare per cancellarlo e continuare." },
    tags: ["erro", "errore", "error 0", "limpar", "cancellare", "recuperar", "recuperare"],
    linhas: [
      { keys: ["5", "ENTER", "0", "÷"], display: "Error 0", nota: { pt: "Provoca Error 0 (÷ 0).", it: "Provoca Error 0 (÷ 0)." } },
      { keys: ["7"], display: "7", nota: { pt: "Digitar 7 limpa o erro → mostra 7.", it: "Digitare 7 cancella l'errore → mostra 7." } },
    ],
  },
];
