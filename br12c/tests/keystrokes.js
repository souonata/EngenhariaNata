// Tradutor: notação de teclas do guia HP 12C Platinum -> ações da calculadora.
//
// Cada linha do guia é uma sequência de "tokens". Um token pode ser:
//   - um número:           "500", "5.35", "11024.82"  -> dígitos (+ decimal)
//   - uma tecla primária:  "n", "PV", "ENTER", "+", "7", "f", "g"
//   - uma função gold/blue: "AMORT", "12x", "BEG", "REG", "NPV", ...
//
// Como o guia escreve o prefixo f/g explicitamente (ex.: "g 12x", "f 2"),
// basta resolver CADA token para a ação da tecla que carrega aquele rótulo e
// emitir em ordem. Ex.: ["g","12x"] -> ["shift:g","tvm:n"].
//
// O mapa de rótulos -> ação é construído a partir de KEY_ROWS (exposto pelo
// app.js via globalThis.__BR12C_KEYS__). ALIASES cobre variações de notação do
// guia e desambigua rótulos repetidos; cresce capítulo a capítulo.

export const ALIASES = {
  // variações de grafia do guia vs rótulos do KEY_ROWS
  "12÷": "tvm:i",
  "12/": "tvm:i",
  CFo: "tvm:PV",
  CF0: "tvm:PV",
  "=": "enter",
  RPN: "digit:8", // g+RPN (tecla 8)
  ALG: "digit:7", // g+ALG (tecla 7)
};

// Constrói { rótulo -> ação } a partir de KEY_ROWS. Primeira ocorrência vence
// (rótulos ambíguos são resolvidos por ALIASES).
export function construirMapa(keyRows) {
  const mapa = {};
  for (const row of keyRows) {
    for (const k of row) {
      for (const rotulo of [k.main, k.f, k.g]) {
        if (rotulo && !(rotulo in mapa)) mapa[rotulo] = k.action;
      }
    }
  }
  return mapa;
}

const NUMERO = /^[0-9]+([.,][0-9]+)?$/;

// tokens (array de strings) -> array de ações (data-action).
export function traduzir(tokens, keyRows, aliases = ALIASES) {
  const mapa = construirMapa(keyRows);
  const acoes = [];
  for (const tokenBruto of tokens) {
    const token = String(tokenBruto).trim();
    if (token === "") continue;

    if (NUMERO.test(token)) {
      for (const ch of token) {
        acoes.push(ch === "." || ch === "," ? "decimal" : "digit:" + ch);
      }
      continue;
    }

    const acao = token in aliases ? aliases[token] : mapa[token];
    if (!acao) {
      throw new Error(`Tecla do guia não mapeada: "${token}" (adicione em ALIASES)`);
    }
    acoes.push(acao);
  }
  return acoes;
}
