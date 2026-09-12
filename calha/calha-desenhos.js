/*
 * Calha 10844 — desenhos em SVG: Figura 2 redesenhada, seção da calha,
 * ábaco da Figura 3 com a leitura e esquema da fachada. Devolvem texto SVG.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node ? [require('./nbr10844-calc.js'), require('./calha-util.js')] : [root.NBR10844, root.CalhaUtil];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaDesenhos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, U) {
  'use strict';

  const DD = N.DADOS;
  const { esc, nf, na, num, z, lerNum, mostrarNum, lerLista, normaliza, uid, copia, MAT_C, MAT_H, matCalha, matHor, tubosPadrao, avisosHtml, grande, pares, nota, aguardando, cabecalho, descSecao, ROTULO_STATUS, seloStatus } = U;

  // Figura 2 da norma redesenhada em perspectiva oblíqua, com todas as cotas.
  // Áreas que contam: tom de água (face inteira) ou hachura (faixa).
  function ralo(x, y) {
    return '<g class="fr" transform="translate(' + x + ' ' + y + ')"><path d="M0 0 H14 L19 -4 H5 Z M4.8 0 L9.8 -4 M9.4 0 L14.4 -4 M2.5 -2 H16.5"/></g>';
  }
  function vr(x, y, t) { return '<text class="fv" x="' + x + '" y="' + y + '">' + t + '</text>'; }
  const FIGURAS = {
    a: '<path class="fa" d="M20 108 L120 108 L190 68 L90 68 Z"/><path class="fl" d="M20 108 L120 108 L190 68 L90 68 Z"/>' + ralo(96, 90) +
      '<path class="fx" d="M20 112 V129 M120 112 V129 M124 111 L132 119 M194 71 L202 79"/>' +
      '<path class="fc" d="M22 124 H118 M129 116 L199 76"/>' + vr(66, 142, 'a') + vr(171, 111, 'b'),
    b: '<path class="fl" d="M32 110 L82 80 L140 47 L90 77 Z"/>' +
      '<path class="fa" d="M82 80 L132 110 L190 77 L140 47 Z"/><path class="fl" d="M82 80 L132 110 L190 77 L140 47 Z M32 110 H132"/>' +
      '<path class="fl" d="M127.5 110 a4.5 4.5 0 0 0 9 0"/>' +
      '<path class="fx" d="M22 80 H78 M22 110 H29 M82 84 V133 M132 116 V133 M137 114 L144 121 M195 81 L202 88"/>' +
      '<path class="fc" d="M26 82 V108 M84 128 H130 M141 119 L199 86"/>' + vr(12, 100, 'h') + vr(102, 144, 'a') + vr(176, 116, 'b'),
    c: '<path class="fa" d="M51 78 L155 20 V74 L51 132 Z"/>' +
      '<path class="fl" d="M51 78 L155 20 V74 L51 132 Z M44 132 V78 H51 M44 78 L148 20 H155 M44 132 H51"/>' + ralo(146, 124) +
      '<path class="fx" d="M28 78 H41 M28 132 H41 M43 74 L37 66 M147 16 L141 8"/>' +
      '<path class="fc" d="M32 80 V130 M39 69 L143 11"/>' + vr(18, 109, 'a') + vr(84, 35, 'b'),
    d: '<path class="fl" d="M24 62 L104 18 V78 L24 122 Z M18 122 V62 H24 M18 62 L98 18 H104 M18 122 H24"/>' +
      '<path class="fh" d="M24 62 L104 18 V48 L24 92 Z"/><path class="fx" d="M24 92 L104 48"/>' +
      '<path class="fl" d="M130 92 L210 48 V78 L130 122 Z M124 122 V92 H130 M124 92 L204 48 H210 M124 122 H130"/>' +
      '<path class="fo" d="M124 92 H24 M204 48 H104"/>' + ralo(62, 116) +
      '<path class="fx" d="M5 62 H15 M5 92 H15 M17 58 L11 50 M97 14 L91 6"/>' +
      '<path class="fc" d="M9 64 V90 M12 54 L92 10"/>' + vr(-2, 81, 'a') + vr(44, 28, 'b'),
    e: '<path class="fl" d="M25 54 L65 32 V106 L25 128 Z M20 128 V54 H25 M20 54 L60 32 H65 M20 128 H25"/>' +
      '<path class="fh" d="M25 54 L65 32 V68 L25 90 Z"/><path class="fx" d="M25 90 L65 68"/>' +
      '<path class="fl" d="M150 72 L198 46 V102 L150 128 Z"/>' +
      '<path class="fh" d="M150 72 L198 46 V76 L150 102 Z"/><path class="fx" d="M150 102 L198 76"/>' +
      '<path class="fo" d="M65 32 L150 72 M65 68 L150 102"/>' + ralo(96, 124) +
      '<path class="fx" d="M6 54 H17 M6 90 H22 M19 50 L14 43 M59 28 L54 21 M200 46 H212 M200 76 H212 M152 106 L158 113 M200 80 L206 87"/>' +
      '<path class="fc" d="M10 56 V88 M15 46 L55 24 M208 48 V74 M156 110 L204 84"/>' +
      vr(-1, 77, 'a') + vr(27, 31, 'b') + vr(211, 66, 'c') + vr(184, 108, 'd'),
    f: '<path class="fa" d="M22 136 V52 L72 24 V108 Z"/><path class="fl" d="M22 136 V52 L72 24 V108 Z"/>' +
      '<path class="fa" d="M72 44 H196 V108 H72 Z"/><path class="fl" d="M72 44 H196 V108 H72"/>' + ralo(80, 124) +
      '<text class="fv" x="36" y="92">A<tspan dy="3">1</tspan></text><text class="fv" x="126" y="82">A<tspan dy="3">2</tspan></text>',
    g: '<path class="fa" d="M92 30 H182 V110 H92 Z"/><path class="fl" d="M92 30 H182 V110 H92 Z"/>' +
      '<path class="fs" d="M92 65 L42 95 V140 L92 110 Z"/>' + ralo(100, 128) +
      '<path class="fs" d="M182 65 L132 95 V140 L182 110 Z"/>' +
      '<path class="fx" d="M92 17 V27 M182 17 V27 M185 30 H199 M185 110 H199"/>' +
      '<path class="fc" d="M94 22 H180 M195 32 V108"/>' + vr(133, 16, 'b') + vr(201, 74, 'a'),
    h: '<path class="fo" d="M22 136 L94 96 H200"/>' +
      '<path class="fh" d="M22 61 L94 21 V56 L22 96 Z"/><path class="fl" d="M22 96 V61 L94 21 V56"/>' +
      '<path class="fl" d="M22 96 L94 56 H200 L128 96 Z M22 96 V136 H128 V96 M128 136 L200 96 V56"/>' +
      '<path class="fx" d="M5 61 H18 M5 96 H18 M21 57 L15 49 M93 17 L87 9"/>' +
      '<path class="fc" d="M9 63 V94 M16 53 L88 13"/>' + vr(-2, 82, 'a') + vr(46, 29, 'b'),
  };

  /* ------------------------------------------------------------------ */
  /* Desenho: seção da calha                                            */
  /* ------------------------------------------------------------------ */

  function svgSecao(forma, dimsM, yM, yLimM) {
    const W = 380, Hh = 230, cx = 190, base = 178;
    const mm = function (v) { return v * 1000; };
    let larg, alt;
    if (forma === 'retangular') { larg = mm(dimsM.b); alt = mm(dimsM.h); }
    else if (forma === 'semicircular') { larg = mm(dimsM.D); alt = mm(dimsM.D) / 2; }
    else { larg = mm(dimsM.b) + 2 * dimsM.z * mm(dimsM.h); alt = mm(dimsM.h); }
    const s = Math.min(230 / larg, 140 / alt);
    const topo = base - alt * s;
    const y = yM == null ? null : mm(yM) * s;
    const yl = mm(yLimM) * s;
    let chapa = '';
    let agua = '';
    let limite = '';
    let cotaLarg = '';
    if (forma === 'retangular') {
      const hb = (mm(dimsM.b) * s) / 2;
      chapa = 'M' + (cx - hb) + ' ' + topo + ' V' + base + ' H' + (cx + hb) + ' V' + topo;
      if (y) agua = '<rect class="agua" x="' + (cx - hb) + '" y="' + (base - y) + '" width="' + 2 * hb + '" height="' + y + '"/>';
      limite = '<line class="limite" x1="' + (cx - hb - 8) + '" y1="' + (base - yl) + '" x2="' + (cx + hb + 8) + '" y2="' + (base - yl) + '"/>';
      cotaLarg = [cx - hb, cx + hb, 'b = ' + nf(mm(dimsM.b)) + ' mm'];
    } else if (forma === 'semicircular') {
      const r = (mm(dimsM.D) * s) / 2;
      chapa = 'M' + (cx - r) + ' ' + topo + ' A' + r + ' ' + r + ' 0 0 0 ' + (cx + r) + ' ' + topo;
      const semi = function (dy) { return Math.sqrt(Math.max(0, r * r - Math.pow(r - dy, 2))); };
      if (y) {
        const w = semi(y);
        agua = '<path class="agua" d="M' + (cx - w) + ' ' + (base - y) + ' A' + r + ' ' + r + ' 0 0 0 ' + (cx + w) + ' ' + (base - y) + ' Z"/>';
      }
      const wl = semi(yl);
      limite = '<line class="limite" x1="' + (cx - wl - 8) + '" y1="' + (base - yl) + '" x2="' + (cx + wl + 8) + '" y2="' + (base - yl) + '"/>';
      cotaLarg = [cx - r, cx + r, 'D = ' + nf(mm(dimsM.D)) + ' mm'];
    } else {
      const hb = (mm(dimsM.b) * s) / 2;
      const zt = dimsM.z;
      chapa = 'M' + (cx - hb - zt * alt * s) + ' ' + topo + ' L' + (cx - hb) + ' ' + base + ' H' + (cx + hb) + ' L' + (cx + hb + zt * alt * s) + ' ' + topo;
      if (y) {
        agua = '<path class="agua" d="M' + (cx - hb - zt * y) + ' ' + (base - y) + ' L' + (cx - hb) + ' ' + base + ' H' + (cx + hb) + ' L' + (cx + hb + zt * y) + ' ' + (base - y) + ' Z"/>';
      }
      limite = '<line class="limite" x1="' + (cx - hb - zt * yl - 8) + '" y1="' + (base - yl) + '" x2="' + (cx + hb + zt * yl + 8) + '" y2="' + (base - yl) + '"/>';
      cotaLarg = [cx - hb, cx + hb, 'b = ' + nf(mm(dimsM.b)) + ' mm'];
    }
    const direita = cx + (larg * s) / 2 + 22;
    const esquerda = cx - (larg * s) / 2 - 22;
    let txt = '';
    txt += '<path class="linha-cota" d="M' + cotaLarg[0] + ' ' + (base + 16) + ' H' + cotaLarg[1] + ' M' + cotaLarg[0] + ' ' + (base + 11) + ' V' + (base + 21) + ' M' + cotaLarg[1] + ' ' + (base + 11) + ' V' + (base + 21) + '"/>';
    txt += '<text class="cota" x="' + cx + '" y="' + (base + 34) + '" text-anchor="middle">' + cotaLarg[2] + '</text>';
    txt += '<path class="linha-cota" d="M' + direita + ' ' + topo + ' V' + base + ' M' + (direita - 5) + ' ' + topo + ' H' + (direita + 5) + ' M' + (direita - 5) + ' ' + base + ' H' + (direita + 5) + '"/>';
    txt += '<text class="cota" x="' + (direita + 8) + '" y="' + ((topo + base) / 2 + 4) + '">' + (forma === 'semicircular' ? 'D/2' : 'h') + ' = ' + nf(alt) + ' mm</text>';
    if (y) {
      txt += '<path class="nivel" d="M' + esquerda + ' ' + (base - y) + ' V' + base + ' M' + (esquerda - 5) + ' ' + (base - y) + ' H' + (esquerda + 5) + ' M' + (esquerda - 5) + ' ' + base + ' H' + (esquerda + 5) + '"/>';
      txt += '<text class="cota" x="' + (esquerda - 8) + '" y="' + (base - y / 2 + 4) + '" text-anchor="end" style="fill:var(--agua)">y = ' + nf(mm(yM)) + ' mm</text>';
    }
    txt += '<text x="' + (cx + (larg * s) / 2 + 30) + '" y="' + (base - yl - 4) + '" style="fill:var(--atencao)">limite</text>';
    return '<svg class="desenho" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Seção transversal da calha com a lâmina d\'água calculada">' +
      agua + limite + '<path class="chapa" d="' + chapa + '"/>' + txt + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Desenho: ábaco da Figura 3                                         */
  /* ------------------------------------------------------------------ */

  function svgAbaco(k, Qc, Hin, Lin, res) {
    const ab = N.ABACOS[k];
    const W = 560, Hh = 440, ml = 50, mr = 44, mt = 14, mb = 42;
    const pw = W - ml - mr, ph = Hh - mt - mb;
    const X = function (q) { return ml + (Math.min(Math.max(q, 0), 2800) / 2800) * pw; };
    const Y = function (d) { return mt + ((150 - Math.min(Math.max(d, 50), 150)) / 100) * ph; };
    const dentro = function (q, d) { return q >= 0 && q <= 2800 && d >= 50 && d <= 150; };
    function caminho(fnQ, d0, d1) {
      let dstr = '';
      let aberto = false;
      for (let d = d0; d <= d1 + 1e-9; d += 0.5) {
        const q = fnQ(d);
        if (dentro(q, d)) { dstr += (aberto ? ' L' : ' M') + X(q).toFixed(1) + ' ' + Y(d).toFixed(1); aberto = true; }
        else aberto = false;
      }
      return dstr;
    }
    let s = '<svg class="desenho abaco" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-labelledby="abaco-t"><title id="abaco-t">Ábaco (' + k +
      ') da Figura 3 com a leitura do diâmetro para Q = ' + nf(Qc) + ' L/min</title>';
    for (let q = 0; q <= 2800; q += 100) s += '<line class="grade' + (q % 400 === 0 ? ' forte' : '') + '" x1="' + X(q) + '" y1="' + Y(150) + '" x2="' + X(q) + '" y2="' + Y(50) + '"/>';
    for (let d = 50; d <= 150; d += 5) s += '<line class="grade' + (d % 10 === 0 ? ' forte' : '') + '" x1="' + X(0) + '" y1="' + Y(d) + '" x2="' + X(2800) + '" y2="' + Y(d) + '"/>';
    s += '<g class="eixo">';
    for (let q = 0; q <= 2800; q += 400) s += '<text x="' + X(q) + '" y="' + (Y(50) + 17) + '" text-anchor="middle">' + q + '</text>';
    for (let d = 50; d <= 150; d += 10) s += '<text x="' + (X(0) - 7) + '" y="' + (Y(d) + 4) + '" text-anchor="end">' + d + '</text>';
    s += '<text x="' + X(2800) + '" y="' + (Y(50) + 35) + '" text-anchor="end">Q (L/min)</text>';
    s += '<text transform="translate(13 ' + (mt + ph / 2) + ') rotate(-90)" text-anchor="middle">D (mm)</text></g>';

    ab.H.forEach(function (c) {
      s += '<path class="curva-h" d="' + caminho(function (d) { return N.qNaCurva(c.pts, d); }, c.faixa[0], c.faixa[1]) + '"/>';
      const d1 = c.faixa[1];
      const q1 = N.qNaCurva(c.pts, d1);
      s += '<text class="rotulo-curva" x="' + (X(q1) + 3) + '" y="' + (Y(d1) + (d1 >= 149 ? 11 : -3)) + '">H' + c.v + '</text>';
    });
    ab.L.forEach(function (c) {
      s += '<path class="curva-l" d="' + caminho(function (d) { return N.qNaCurva(c.pts, d); }, c.faixa[0], c.faixa[1]) + '"/>';
      const d1 = c.faixa[1];
      let q1 = N.qNaCurva(c.pts, d1);
      if (q1 > 2800) q1 = 2800;
      s += '<text class="rotulo-curva" x="' + (X(q1) + 4) + '" y="' + (Y(d1) + 4) + '">' + (c.v === Infinity ? 'L∞' : 'L' + na(c.v)) + '</text>';
    });

    if (res && Qc > 0) {
      const Hc = Math.min(Math.max(Hin, 50), 100);
      const Lc = Math.max(Lin, 0.3);
      s += '<path class="ativa-h" d="' + caminho(function (d) { return N.qNaFamilia(ab.H, Hc, d, 'H'); }, 50, 150) + '"/>';
      s += '<path class="ativa-l" d="' + caminho(function (d) { return N.qNaFamilia(ab.L, Lc, d, 'L'); }, 50, 150) + '"/>';
      const Dtopo = Math.max(res.DH, res.DL);
      const xq = X(Qc);
      s += '<line class="guia" x1="' + xq + '" y1="' + Y(50) + '" x2="' + xq + '" y2="' + Y(Dtopo) + '"/>';
      s += '<line class="guia-d" x1="' + xq + '" y1="' + Y(Dtopo) + '" x2="' + X(0) + '" y2="' + Y(Dtopo) + '"/>';
      s += '<circle class="marco h" cx="' + xq + '" cy="' + Y(res.DH) + '" r="5"/>';
      s += '<circle class="marco l" cx="' + xq + '" cy="' + Y(res.DL) + '" r="5"/>';
      s += '<circle class="marco d" cx="' + X(0) + '" cy="' + Y(Dtopo) + '" r="4"/>';
      const lado = Qc > 2000 ? 'end' : 'start';
      const dx = Qc > 2000 ? -9 : 9;
      if (Dtopo < 50) {
        // As duas leituras caem abaixo do eixo: um rótulo só, sem amontoar no pé do ábaco.
        s += '<text class="etq d" x="' + (xq + dx) + '" y="' + (Y(50) - 12) + '" text-anchor="' + lado + '">H ' + nf(Hin) + ' mm e L ' + na(Lin) + ' m pedem D &lt; 50 mm</text>';
      } else {
        const sep = Math.abs(Y(res.DH) - Y(res.DL)) < 15;
        s += '<text class="etq h" x="' + (xq + dx) + '" y="' + (Y(res.DH) + (sep && res.DH >= res.DL ? -6 : 4)) + '" text-anchor="' + lado + '">H ' + nf(Hin) + ' mm → ' + (res.DH < 50 ? '&lt; 50' : nf(res.DH)) + '</text>';
        s += '<text class="etq l" x="' + (xq + dx) + '" y="' + (Y(res.DL) + (sep && res.DL > res.DH ? -6 : sep ? 14 : 4)) + '" text-anchor="' + lado + '">L ' + na(Lin) + ' m → ' + (res.DL < 50 ? '&lt; 50' : nf(res.DL)) + '</text>';
        s += '<text class="etq d" x="' + (X(0) + 8) + '" y="' + (Y(Dtopo) - 6) + '">D = ' + nf(Dtopo) + ' mm</text>';
      }
    }
    return s + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Desenho: esquema da fachada da calha ativa                          */
  /* ------------------------------------------------------------------ */

  function svgEsquema(R, P) {
    const c = R.c;
    // Nenhum texto cruza traço: o rótulo do coletor fica abaixo da linha do coletor, onde
    // não passa condutor, e a cota da saída intermediária vai abaixo dele.
    const W = 960, Hh = 334, X0 = 120, X1 = 820, yC = 110, yG = 246, yCol = 270;
    const temL = num(c.Lc) > 0;
    const L = temL ? num(c.Lc) : 10;
    const XX = function (x) { return X0 + (x / L) * (X1 - X0); };
    const saidas = R.dist.saidas && R.dist.saidas.length ? R.dist.saidas : [{ x: temL ? L : 1, fracao: 1 }];
    const pos = saidas.map(function (s) { return temL ? s.x : s.x * L; });
    const T = P.trechos.find(function (t) { return t.t.calhas.indexOf(c.id) >= 0; });
    let s = '<svg class="esq" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-labelledby="esq-t"><title id="esq-t">Esquema da calha ' +
      esc(c.nome || '') + ' com ' + pos.length + ' saída(s) e os condutores até o coletor</title>';
    s += '<path class="esq-cota" d="M' + X0 + ' 16 H' + X1 + '"/>';
    s += '<text class="esq-rot" x="' + (X0 + X1) / 2 + '" y="11" text-anchor="middle">' + (temL ? 'L = ' + na(L) + ' m' : 'comprimento não informado · posições fora de escala') + '</text>';
    s += '<path class="esq-telhado" d="M' + (X0 - 14) + ' ' + (yC - 8) + ' L' + (X0 + 60) + ' 34 H' + (X1 - 60) + ' L' + (X1 + 14) + ' ' + (yC - 8) + ' Z"/>';
    s += '<text class="esq-rot" x="' + (X0 + X1) / 2 + '" y="72" text-anchor="middle">' +
      (R.A > 0 ? 'A = ' + nf(R.A, 1) + ' m² · Q = ' + nf(R.Q, 0) + ' L/min' : 'Informe a área de contribuição (5.2)') + '</text>';
    s += '<rect class="esq-fachada" x="' + X0 + '" y="' + (yC + 8) + '" width="' + (X1 - X0) + '" height="' + (yG - yC - 8) + '"/>';
    s += '<path class="esq-chao" d="M40 ' + yG + ' H' + (W - 40) + '"/>';
    s += '<rect class="esq-calha' + (R.calha.pronta && !R.calha.ok ? ' falha' : '') + '" x="' + (X0 - 14) + '" y="' + (yC - 8) + '" width="' + (X1 - X0 + 28) + '" height="16" rx="3"/>';
    // Setas: cada ponto da calha corre para a saída mais próxima.
    const passo = L / 16;
    for (let x = passo / 2; x < L; x += passo) {
      let alvo = pos[0];
      pos.forEach(function (p) { if (Math.abs(p - x) < Math.abs(alvo - x)) alvo = p; });
      if (Math.abs(alvo - x) < L * 0.03) continue;
      const d = alvo > x ? 1 : -1;
      const cx = XX(x);
      s += '<path class="esq-seta" d="M' + (cx - 5 * d) + ' ' + (yC - 4) + ' L' + (cx + 5 * d) + ' ' + yC + ' L' + (cx - 5 * d) + ' ' + (yC + 4) + ' Z"/>';
    }
    const k = R.calha;
    s += '<text class="esq-rot" x="' + (X0 + X1) / 2 + '" y="94" text-anchor="middle">Calha ' + (k.pronta ? descSecao(k) + ' mm' : 'a dimensionar') +
      (k.i > 0 ? ' · i = ' + na(k.i * 100) + '%' : '') + (k.desnivel != null ? ' · desnível ' + nf(k.desnivel * 100, 1) + ' cm' : '') + '</text>';
    const dn = R.vert.pronto && R.vert.adocao.tubo ? 'DN ' + R.vert.adocao.tubo.dn : 'DN a definir';
    const xsTubo = pos.map(XX);
    // Lado livre para o rótulo de um condutor: sem outro condutor a menos de LARG_ROT.
    const LARG_ROT = 110;
    const ladoLivre = function (x, dir) {
      return xsTubo.every(function (o) { const d = (o - x) * dir; return d <= 0 || d > LARG_ROT; });
    };
    pos.forEach(function (p, j) {
      const x = XX(p);
      s += '<rect class="esq-tubo" x="' + (x - 6) + '" y="' + (yC + 8) + '" width="12" height="' + (yCol - yC - 8) + '"/>';
      if (pos.length <= 4 || j === 0) {
        let dir = p > L * 0.8 ? -1 : 1;
        if (!ladoLivre(x, dir)) dir = -dir;
        if (!ladoLivre(x, dir)) return;
        const tx = x + 14 * dir;
        const anc = dir < 0 ? 'end' : 'start';
        s += '<text class="esq-rot" x="' + tx + '" y="' + (yC + 66) + '" text-anchor="' + anc + '">' + dn + '</text>';
        s += '<text x="' + tx + '" y="' + (yC + 84) + '" text-anchor="' + anc + '">' + nf(R.Q * saidas[j].fracao, 0) + ' L/min</text>';
        if (j === 0 && num(c.Lcond) > 0) s += '<text x="' + tx + '" y="' + (yC + 102) + '" text-anchor="' + anc + '">L = ' + na(num(c.Lcond)) + ' m</text>';
      }
    });
    const xs = pos.map(XX);
    const xa = Math.min.apply(null, xs) - 6;
    const xb = W - 56;
    s += '<path class="esq-coletor" d="M' + xa + ' ' + yCol + ' H' + xb + '"/>';
    s += '<path class="esq-seta" d="M' + xb + ' ' + (yCol - 8) + ' L' + (xb + 16) + ' ' + yCol + ' L' + xb + ' ' + (yCol + 8) + ' Z"/>';
    s += '<text class="esq-rot" x="' + (xb + 16) + '" y="' + (yCol + 24) + '" text-anchor="end">' +
      (T ? esc(T.t.nome || 'Coletor') + (T.pronto && T.escolhido ? ': D ' + T.escolhido.D + ' mm · i = ' + na(T.i * 100) + '%' : '') : 'Sem coletor: marque esta calha num trecho (5.7)') + '</text>';
    if (temL && c.saidas === 'intermediaria' && pos.length === 1) {
      s += '<path class="esq-cota" d="M' + X0 + ' ' + (Hh - 8) + ' H' + XX(pos[0]) + '"/>';
      s += '<text x="' + (X0 + XX(pos[0])) / 2 + '" y="' + (Hh - 13) + '" text-anchor="middle">' + na(pos[0]) + ' m</text>';
    }
    return s + '</svg>';
  }

  return {
    FIGURAS: FIGURAS,
    svgSecao: svgSecao,
    svgAbaco: svgAbaco,
    svgEsquema: svgEsquema,
  };
});
