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

// Retorna { ok, atual, esperado, aNum, eNum }.
export function conferir(atual, esperado) {
  const esp = String(esperado).trim();

  // Resultado de g DATE: "DD,MM,YYYY W" (ou MM,DD,YYYY W) — comparação textual exata.
  if (/^\d{1,2},\d{2},\d{4}\s\d$/.test(esp)) {
    return { ok: String(atual).trim() === esp, atual, esperado };
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
