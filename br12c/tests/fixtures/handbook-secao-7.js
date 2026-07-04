// Manual do proprietário — Seção 7 (Mathematics and Number-Alteration
// Functions, p.82-84). Funções de um número (recíproco, mantissa, RND, INTG,
// LST x, FRAC) e a função potência (y^x). Campos didáticos bilíngues {pt,it}.

export const handbookSecao7 = [
  {
    nome: "p83 — One-number functions: reciprocal, mantissa, RND, INTG, LST x, FRAC (0.258 → 3.88)",
    modo: "rpn",
    titulo: { pt: "Recíproco, mantissa, arredondar (RND), parte inteira/fracionária", it: "Reciproco, mantissa, arrotondare (RND), parte intera/frazionaria" },
    objetivo: {
      pt: "Ver a mantissa completa de um número, arredondá-lo de verdade (não só na exibição) e separar sua parte inteira da fracionária.",
      it: "Vedere la mantissa completa di un numero, arrotondarlo davvero (non solo nella visualizzazione) e separare la sua parte intera da quella frazionaria.",
    },
    tags: ["matemática", "matematica", "recíproco", "reciproco", "mantissa", "rnd", "arredondar", "arrotondare", "intg", "frac", "lst x"],
    linhas: [
      { keys: ["0.258", "1/x"], display: "3.88", nota: { pt: "1 ÷ 0,258 = 3,875968992 (mostrado arredondado: 3,88).", it: "1 ÷ 0,258 = 3,875968992 (mostrato arrotondato: 3,88)." } },
      { keys: ["f", "PREFIX"], display: "3875968992", nota: { pt: "f PREFIX revela os 10 dígitos internos: o valor não mudou, só a exibição.", it: "f PREFIX rivela le 10 cifre interne: il valore non è cambiato, solo la visualizzazione." } },
      { keys: ["f", "RND"], display: "3.88", nota: { pt: "f RND: agora sim ALTERA o número interno para 3,88 (não parece diferente ainda).", it: "f RND: ora SÌ altera il numero interno a 3,88 (non sembra ancora diverso)." } },
      { keys: ["f", "PREFIX"], display: "3880000000", nota: { pt: "A mantissa confirma: o valor interno virou 3,88 exato (zeros à direita).", it: "La mantissa conferma: il valore interno è diventato 3,88 esatto (zeri a destra)." } },
      { keys: ["g", "INTG"], display: "3.00", nota: { pt: "g INTG: só a parte inteira, 3.", it: "g INTG: solo la parte intera, 3." } },
      { keys: ["g", "LSTx"], display: "3.88", nota: { pt: "g LST x: recupera o 3,88 de antes do INTG.", it: "g LST x: recupera il 3,88 di prima dell'INTG." } },
      { keys: ["g", "FRAC"], display: "0.88", nota: { pt: "g FRAC: só a parte fracionária do 3,88 recuperado, 0,88.", it: "g FRAC: solo la parte frazionaria del 3,88 recuperato, 0,88." } },
    ],
  },
  {
    nome: "p84 — Power function (y^x): 2^1.4=2.64, 2^-1.4=0.38, (-2)^3=-8.00, 2^(1/3)=1.26",
    modo: "rpn",
    titulo: { pt: "Função potência (y^x)", it: "Funzione potenza (y^x)" },
    objetivo: {
      pt: "Quatro potências com y^x: expoente positivo, negativo, base negativa com expoente inteiro, e uma raiz cúbica via expoente fracionário.",
      it: "Quattro potenze con y^x: esponente positivo, negativo, base negativa con esponente intero, e una radice cubica tramite esponente frazionario.",
    },
    tags: ["matemática", "matematica", "potência", "potenza", "y^x", "expoente", "esponente", "raiz cúbica", "radice cubica"],
    linhas: [
      { keys: ["2", "ENTER", "1.4", "y^x"], display: "2.64", nota: { pt: "2^1,4 = 2,64.", it: "2^1,4 = 2,64." } },
      { keys: ["2", "ENTER", "1.4", "CHS", "y^x"], display: "0.38", nota: { pt: "2^(−1,4) = 0,38.", it: "2^(−1,4) = 0,38." } },
      { keys: ["2", "CHS", "ENTER", "3", "y^x"], display: "-8.00", nota: { pt: "(−2)³ = −8.", it: "(−2)³ = −8." } },
      { keys: ["2", "ENTER", "3", "1/x", "y^x"], display: "1.26", nota: { pt: "2^(1/3) = raiz cúbica de 2 ≈ 1,26.", it: "2^(1/3) = radice cubica di 2 ≈ 1,26." } },
    ],
  },
];
