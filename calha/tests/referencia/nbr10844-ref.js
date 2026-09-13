// Referência independente da NBR 10844:1989 para os testes: escrita a partir do texto da
// norma, sem importar nenhum módulo do app. Unidades: m, m², L/min, mm/h.

// 5.5.7: Q = K · (S/n) · R^(2/3) · i^(1/2), com K = 60 000 (Q em L/min, S em m², R em m).
export const K = 60000;

// Figura 2 (PDF p. 5): área de contribuição de cada superfície.
export function area(tipo, v) {
  switch (tipo) {
    case 'a': return v.a * v.b;
    case 'b': return (v.a + v.h / 2) * v.b;
    case 'c': case 'd': case 'g': case 'h': return (v.a * v.b) / 2;
    case 'e': return Math.abs(v.a * v.b - v.c * v.d) / 2;
    case 'f': return Math.sqrt(v.A1 * v.A1 + v.A2 * v.A2) / 2;
    default: throw new Error('tipo de superfície desconhecido: ' + tipo);
  }
}

// 5.3.1: Q = I · A / 60.
export const vazao = (I, A) => (I * A) / 60;

export function manning(S, P, n, i) {
  return K * (S / n) * Math.pow(S / P, 2 / 3) * Math.sqrt(i);
}

// Seção retangular com lâmina y.
export const retangular = (b, y) => ({ S: b * y, P: b + 2 * y });

// Segmento circular de diâmetro D com lâmina y.
export function segmento(D, y) {
  const th = 2 * Math.acos(1 - (2 * y) / D);
  return { S: ((D * D) / 8) * (th - Math.sin(th)), P: (D * th) / 2 };
}

// Lâmina normal numa seção retangular, por bisseção (independente da do app).
export function laminaRetangular(b, Q, n, i, yMax) {
  const q = (y) => { const g = retangular(b, y); return manning(g.S, g.P, n, i); };
  if (q(yMax) < Q) return null;
  let lo = 0;
  let hi = yMax;
  for (let k = 0; k < 100; k++) {
    const m = (lo + hi) / 2;
    if (q(m) < Q) lo = m;
    else hi = m;
  }
  return hi;
}

// 5.7.2: condutor horizontal com lâmina 2/3 do diâmetro interno.
export function capacidadeHorizontal(Dm, n, i) {
  const g = segmento(Dm, (2 * Dm) / 3);
  return manning(g.S, g.P, n, i);
}

// Tabela 4 impressa (PDF p. 9), n = 0,011; colunas i = 0,5 · 1 · 2 · 4 %.
export const TABELA4_N011 = {
  50: [32, 45, 64, 90], 75: [95, 133, 188, 267], 100: [204, 287, 405, 575], 125: [370, 521, 735, 1040],
  150: [602, 847, 1190, 1690], 200: [1300, 1820, 2570, 3650], 250: [2350, 3310, 4660, 6620], 300: [3820, 5380, 7590, 10800],
};
