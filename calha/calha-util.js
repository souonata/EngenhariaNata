/*
 * Calha 10844 — utilidades da interface: números em pt-BR, escape de HTML,
 * materiais e pedaços de HTML reaproveitados pelos outros módulos. Sem estado.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node ? [require('./nbr10844-calc.js')] : [root.NBR10844];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaUtil = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N) {
  'use strict';

  const DD = N.DADOS;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function nf(x, dec) {
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('pt-BR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function na(x) {
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  function num(v) {
    if (v === '' || v === null || v === undefined) return NaN;
    const x = Number(v);
    return Number.isFinite(x) ? x : NaN;
  }
  function z(x) { return Number.isFinite(x) ? x : 0; }

  // Campos numéricos aceitam vírgula ou ponto como separador decimal.
  function lerNum(s) {
    let t = String(s == null ? '' : s).trim().replace(/\s/g, '');
    if (t === '') return '';
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    const x = Number(t);
    return Number.isFinite(x) ? x : '';
  }
  function mostrarNum(v) {
    if (v === '' || v == null || !Number.isFinite(Number(v))) return '';
    return String(v).replace('.', ',');
  }
  function lerLista(s) {
    return String(s || '').split(/[;\s]+/).map(lerNum).filter(function (v) { return v !== ''; });
  }
  function normaliza(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  const MAT_C = DD.MATERIAIS_CALHA;
  const MAT_H = DD.MATERIAIS_HORIZONTAL;
  function matCalha(id) { return MAT_C.find(function (m) { return m.id === id; }) || MAT_C[0]; }
  function matHor(id) { return MAT_H.find(function (m) { return m.id === id; }) || MAT_H[0]; }
  function tubosPadrao() { return DD.TUBOS_VERTICAIS.map(function (t) { return { dn: t.dn, di: t.di }; }); }

  /* ------------------------------------------------------------------ */
  /* Pedaços de HTML                                                    */
  /* ------------------------------------------------------------------ */

  function avisosHtml(lista) {
    if (!lista || !lista.length) return '';
    return '<ul class="avisos">' + lista.map(function (a) {
      return '<li class="aviso ' + a.nivel + '">' + (a.html || esc(a.texto)) + '</li>';
    }).join('') + '</ul>';
  }
  function grande(sim, valor, uni) {
    return '<div class="grande"><span class="sim">' + sim + '</span><span class="num">' + valor + '</span><span class="uni">' + uni + '</span></div>';
  }
  function pares(lista) {
    return '<dl class="pares">' + lista.map(function (p) {
      return '<div><dt>' + p[0] + '</dt><dd>' + p[1] + '</dd></div>';
    }).join('') + '</dl>';
  }
  function nota(titulo, texto) {
    return '<p class="nota-norma"><strong>' + titulo + '</strong>' + texto + '</p>';
  }
  function aguardando(texto) {
    return '<p class="explica">' + texto + '</p>';
  }
  function cabecalho(esquerda, selo) {
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">' + esquerda + selo + '</div>';
  }
  function descSecao(c) {
    if (c.forma === 'semicircular') return 'semicircular ⌀' + nf(c.dims.D * 1000);
    if (c.forma === 'retangular') return nf(c.dims.b * 1000) + ' × ' + nf(c.dims.h * 1000);
    return 'trapezoidal ' + nf(c.dims.b * 1000) + ' × ' + nf(c.dims.h * 1000);
  }
  const ROTULO_STATUS = { ok: 'atende', atencao: 'revisar', erro: 'não atende', '': 'incompleta' };
  function seloStatus(st) { return '<span class="selo ' + st + '">' + ROTULO_STATUS[st] + '</span>'; }

  return {
    esc: esc,
    nf: nf,
    na: na,
    num: num,
    z: z,
    lerNum: lerNum,
    mostrarNum: mostrarNum,
    lerLista: lerLista,
    normaliza: normaliza,
    uid: uid,
    copia: copia,
    MAT_C: MAT_C,
    MAT_H: MAT_H,
    matCalha: matCalha,
    matHor: matHor,
    tubosPadrao: tubosPadrao,
    avisosHtml: avisosHtml,
    grande: grande,
    pares: pares,
    nota: nota,
    aguardando: aguardando,
    cabecalho: cabecalho,
    descSecao: descSecao,
    ROTULO_STATUS: ROTULO_STATUS,
    seloStatus: seloStatus,
  };
});
