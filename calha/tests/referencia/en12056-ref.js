// Referência independente da EN 12056-3:2000 para os testes: escrita a partir do texto da norma,
// sem importar nenhum módulo do app. Os fatores Fd, Fs e Fh usam os AJUSTES publicados na SR 620
// (HR Wallingford), que são outra fonte que não as curvas lidas do PDF — a diferença entre as duas
// é conferida nos testes, não escondida.
// Unidades: mm, mm², l/s, l/(s·m²).

export const SEGURANCA = 0.9;

// 5.1.2 / 5.1.4 / 5.2.3
export const QN_semicircular = (AE) => 2.78e-5 * Math.pow(AE, 1.25);
export const QSE = (AE) => 3.48e-5 * Math.pow(AE, 1.25);
export const QSV = (AW) => 3.89e-5 * Math.pow(AW, 1.25);

// Ajustes da SR 620 (equações 6.5, 6.6 e 7.9).
export const FdAjuste = (WT) => Math.pow(WT, 0.25);
export const FsAjuste = (ST) => 0.8943 + 0.2013 * ST - 0.0965 * ST * ST;
export const FhAjuste = (ST) => 0.6459 - 0.3084 * ST + 0.1415 * ST * ST;

// Tabela 5 — bordo livre mínimo de calha de água-furtada e de platibanda.
export function bordoLivre(Z) {
  if (Z < 85) return 25;
  if (Z <= 250) return 0.3 * Z;
  return 75;
}

// Tabela 6 — coluna nivelada (0 a 3 mm/m), transcrita da norma.
export const FL_NIVELADA = {
  50: 1.0, 75: 0.97, 100: 0.93, 125: 0.9, 150: 0.86, 175: 0.83, 200: 0.8, 225: 0.78,
  250: 0.77, 275: 0.75, 300: 0.73, 325: 0.72, 350: 0.7, 375: 0.68, 400: 0.67, 425: 0.65,
  450: 0.63, 475: 0.62, 500: 0.6,
};

export function FLnivelada(LW) {
  if (LW <= 50) return 1;
  if (LW > 500) return null;
  const chaves = Object.keys(FL_NIVELADA).map(Number).sort((a, b) => a - b);
  for (let k = 1; k < chaves.length; k++) {
    if (LW <= chaves[k]) {
      const a = chaves[k - 1];
      const b = chaves[k];
      return FL_NIVELADA[a] + ((LW - a) / (b - a)) * (FL_NIVELADA[b] - FL_NIVELADA[a]);
    }
  }
  return null;
}

// Tabela 7 — capacidade de bocal de sola plana.
export const bocalCircular = (D, h, ko = 1) => (h <= D / 2
  ? (ko * D * Math.pow(h, 1.5)) / 7500
  : (ko * D * D * Math.sqrt(h)) / 15000);
export const bocalNaoCircular = (LW, AO, h, ko = 1) => (h <= (2 * AO) / LW
  ? (ko * LW * Math.pow(h, 1.5)) / 24000
  : (ko * AO * Math.sqrt(h)) / 12000);

// Tabela 8 — equação de Wyly-Eaton, com kb = 0,25 mm.
export const condutor = (di, f = 0.33) => 2.5e-4 * Math.pow(0.25, -0.167) * Math.pow(di, 2.667) * Math.pow(f, 1.667);

// Anexo C — Colebrook-White num tubo parcialmente cheio (di em mm, i em m/m).
export function coletor(di, i, enchimento = 0.7, kb = 1.0, nu = 1.31e-6) {
  const d = di / 1000;
  const teta = 2 * Math.acos(1 - 2 * enchimento);
  const A = ((d * d) / 8) * (teta - Math.sin(teta));
  const Dh = (4 * A) / ((d * teta) / 2);
  const raiz = Math.sqrt(2 * 9.81 * Dh * i);
  const v = -2 * raiz * Math.log10(kb / 1000 / (3.71 * Dh) + (2.51 * nu) / (Dh * raiz));
  return { Q: A * v * 1000, v };
}

// Seções da Figura 2 e da Figura 4.
export const areaSemicircular = (D) => (Math.PI * D * D) / 8;
export const areaTrapezio = (S, T, y) => (y * (S + T)) / 2;
