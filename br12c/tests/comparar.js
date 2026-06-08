// Comparador locale-aware entre o display da calc (pt-BR: "." milhar, "," decimal)
// e o display esperado do guia (US: "," milhar, "." decimal).
//
// Compara por VALOR numérico arredondado às casas mostradas no guia (que já é o
// valor exibido com o FIX corrente). Displays especiais (Error, running, etc.)
// caem na comparação textual.

function parseGuia(s) {
  return Number(String(s).replace(/\s/g, "").replace(/,/g, ""));
}

function parseCalc(s) {
  return Number(String(s).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}

function casasDecimais(s) {
  const m = String(s).match(/[.,](\d+)\s*$/);
  return m ? m[1].length : 0;
}

// Notação científica "M.MMMMMM EE" / "M,MMMMMM-EE" -> valor numérico.
function parseSci(s) {
  const m = String(s)
    .trim()
    .match(/^(-?\d[.,]\d{1,6})\s?(-?)(\d{2})$/);
  if (!m) return NaN;
  const mant = Number(m[1].replace(",", "."));
  const exp = (m[2] === "-" ? -1 : 1) * Number(m[3]);
  return mant * Math.pow(10, exp);
}

// Retorna { ok, atual, esperado, aNum, eNum }.
export function conferir(atual, esperado) {
  const esp = String(esperado).trim();

  // Resultado de g DATE: "DD,MM,YYYY W" (ou MM,DD,YYYY W) — comparação textual exata.
  if (/^\d{1,2},\d{2},\d{4}\s\d$/.test(esp)) {
    return { ok: String(atual).trim() === esp, atual, esperado };
  }

  // Linha de programa (modo PRGM): "LLL," ou "LLL, keycode" — comparação ignorando
  // espaços. Começa com 3 dígitos + vírgula e NÃO é um número US válido (130,000.00).
  if (/^\d{3},/.test(esp) && !/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(esp)) {
    return {
      ok: String(atual).replace(/\s+/g, "") === esp.replace(/\s+/g, ""),
      atual,
      esperado,
    };
  }

  // Notação científica (display f .): compara por valor (mantissa 6 dígitos).
  if (/^-?\d[.,]\d{1,6}[\s-]\d{2}$/.test(esp)) {
    const a = parseSci(atual);
    const e = parseSci(esp);
    const ok = Number.isFinite(a) && Number.isFinite(e) && Math.abs(a - e) <= Math.abs(e) * 1e-6 + 1e-9;
    return { ok, atual, esperado, aNum: a, eNum: e };
  }

  // Texto especial (contém letras): comparação textual tolerante.
  if (/[a-zA-Z]/.test(esp)) {
    return {
      ok: String(atual).trim().toLowerCase() === esp.toLowerCase(),
      atual,
      esperado,
    };
  }

  const a = parseCalc(atual);
  const e = parseGuia(esp);
  const casas = casasDecimais(esp);
  const aR = Number(a.toFixed(casas));
  const eR = Number(e.toFixed(casas));
  const ok = Math.abs(aR - eR) < 0.5 * Math.pow(10, -casas) + 1e-9;
  return { ok, atual, esperado, aNum: a, eNum: e };
}
