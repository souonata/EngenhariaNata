/*
 * Calha 10844 — memorial de cálculo do projeto: passos por item da norma,
 * agrupados por calha, e a versão em texto corrido para copiar.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node ? [require('./nbr10844-calc.js'), require('./calha-util.js'), require('./calha-projeto.js')] : [root.NBR10844, root.CalhaUtil, root.CalhaProjeto];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaMemorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, U, PJ) {
  'use strict';

  const { esc, nf, na, num, z, lerNum, mostrarNum, lerLista, normaliza, uid, copia, MAT_C, MAT_H, matCalha, matHor, tubosPadrao, linhaTubo, rotuloTubo, avisosHtml, grande, pares, nota, aguardando, cabecalho, descSecao, ROTULO_STATUS, seloStatus } = U;
  const textoSaidas = PJ.textoSaidas;
  const TEXTO_FONTE_H = PJ.TEXTO_FONTE_H;

  /* ------------------------------------------------------------------ */
  /* Memorial do projeto                                                */
  /* ------------------------------------------------------------------ */

  const TEXTO_SAIDAS = {
    ponta: 'uma saída na ponta',
    intermediaria: 'uma saída intermediária',
    'duas-pontas': 'uma saída em cada ponta',
    espacadas: 'saídas igualmente espaçadas',
    personalizadas: 'saídas em posições informadas',
  };

  function pct(x) { return (x >= 0 ? '+' : '') + nf(x * 100, 0) + '%'; }
  function diTexto(t) { return t.de ? 'DE ' + na(t.de) + ' − 2 × ' + na(t.e) + ' = Di ' + na(t.di) + ' mm' : 'Di ' + na(t.di) + ' mm'; }

  // Tubo adotado com a origem do diâmetro interno: catálogo (DE e e do fabricante) ou informado.
  function textoTuboV(v, estado) {
    const t = v.adocao.tubo;
    const lin = linhaTubo(v.linha);
    const nome = (t.dn ? 'DN ' + t.dn + ', ' : '') + (v.linha === 'usuario' ? PJ.matVertical(estado).toLowerCase() + ', tubo informado pelo usuário' : lin.rotulo);
    return 'Adotado ' + nome + ': ' + diTexto(t) + ' ≥ ' + nf(v.adocao.minimo) + ' mm' + (v.adocao.peloMinimo ? ' (mínimo de 70 mm do item 5.6.3)' : '') +
      '; folga de diâmetro ' + pct(v.folga) + '.' + (t.de ? ' Fonte: ' + lin.fonte + '.' : '');
  }
  function textoTuboH(T) {
    const t = T.escolhido;
    return 'Adotado ' + (t.dn ? 'DN ' + t.dn + ' (' + diTexto(t) + ')' : diTexto(t)) + ': capacidade ' + nf(t.Q, 0) + ' L/min ' +
      (t.fonteQ === 'Tabela 4' ? '(valor impresso na Tabela 4, mesmas condições)' : '(Manning a 2/3 do Di)') + '; uso ' + nf(T.uso * 100, 0) + '% da capacidade.' +
      (t.de ? ' Fonte: ' + T.linhaInfo.fonte + '.' : '');
  }

  function memorialCalha(R, estado) {
    const e = R.c;
    const passos = [];
    passos.push(['5.2', 'Área de contribuição', R.sups.map(function (s, idx) {
      const t = e.superficies[idx].tipo;
      return '(' + t + ') ' + N.SUPERFICIES[t].nome + ': ' + s.formula + ' = ' + s.subst + ' = ' + nf(s.A, 2) + ' m²';
    }).concat(['Total: A = ' + nf(R.A, 2) + ' m²'])]);
    passos.push(['5.3', 'Vazão de projeto', [
      'Q = I · A / 60 = ' + nf(R.I.I, 1) + ' · ' + nf(R.A, 2) + ' / 60 = ' + nf(R.Q, 1) + ' L/min',
      'Saídas: ' + TEXTO_SAIDAS[e.saidas] + ' (' + textoSaidas(R) + ').',
      'Calha: Q · ' + nf(R.dist.fracCalha, 3) + ' (maior trecho, 5.5.4)' + (R.coef !== 1 ? ' · ' + nf(R.coef, 2) + ' (Tabela 1)' : '') + ' = ' + nf(R.Qcalha, 1) + ' L/min',
      R.dist.n + ' condutor(es) vertical(is); o mais carregado recebe ' + nf(R.Qcond, 1) + ' L/min',
    ]]);
    const c = R.calha;
    if (c.pronta) {
      const sec = c.forma === 'retangular' ? 'retangular b = ' + nf(c.dims.b * 1000) + ' mm, h = ' + nf(c.dims.h * 1000) + ' mm' :
        c.forma === 'semicircular' ? 'semicircular D = ' + nf(c.dims.D * 1000) + ' mm' :
        'trapezoidal b = ' + nf(c.dims.b * 1000) + ' mm, z = ' + na(c.dims.z) + ', h = ' + nf(c.dims.h * 1000) + ' mm';
      const linhas = [
        'Calha de ' + (e.tipoCalha === 'agua-furtada' ? 'água-furtada' : e.tipoCalha) + ', seção ' + sec + ', ' + c.mat.rotulo.toLowerCase() + ' (n = ' + nf(c.n, 3) + '), i = ' + na(c.i * 100) + '%.',
        c.y != null ? 'Manning-Strickler: lâmina y = ' + nf(c.y * 1000) + ' mm para Q = ' + nf(R.Qcalha, 1) + ' L/min (limite adotado ' + nf(c.yLim * 1000) + ' mm; capacidade no limite ' + nf(c.Qlim, 0) + ' L/min; bordo livre ' + nf(c.bordoLivre * 1000) + ' mm).' :
          'Manning-Strickler: a seção cheia escoa ' + nf(c.Qcheia, 0) + ' L/min, menos que a vazão de projeto.',
        c.ok ? 'Seção atende.' : 'Seção NÃO atende ao critério adotado.',
      ];
      if (c.desnivel != null) linhas.push('Desnível no maior trecho: ' + nf(c.desnivel * 100, 1) + ' cm em ' + na(R.dist.trecho) + ' m.');
      if (c.chapa) linhas.push('Chapa de ' + c.chapa.metal + ' ' + nf(Number(e.espessura), 2) + ' mm: desenvolvimento ' + nf(c.chapa.dev * 1000, 0) + ' mm, corte ' + (c.chapa.corte ? c.chapa.corte + ' mm' : 'acima de 600 mm') + ', cerca de ' + nf(c.chapa.massa, 2) + ' kg/m.');
      passos.push(['5.5', 'Calha', linhas]);
    }
    const v = R.vert;
    if (v.pronto && v.fora) {
      passos.push(['5.6', 'Condutor vertical', [
        'Ábaco (' + e.saida + ') da Figura 3: Q = ' + nf(R.Qcond, 1) + ' L/min, H = ' + nf(R.H) + ' mm, L = ' + na(num(e.Lcond)) + ' m.',
        v.avisos[0].texto,
      ]]);
    } else if (v.pronto) {
      passos.push(['5.6', 'Condutor vertical', [
        'Ábaco (' + e.saida + ') da Figura 3, ' + (e.saida === 'a' ? 'saída em aresta viva' : 'funil de saída') + ': Q = ' + nf(R.Qcond, 1) + ' L/min, H = ' + nf(R.H) + ' mm (' + TEXTO_FONTE_H[e.fonteH] + '), L = ' + na(num(e.Lcond)) + ' m.',
        'D pela curva H = ' + (v.DH < 50 ? '< 50' : nf(v.DH)) + ' mm; pela curva L = ' + (v.DL < 50 ? '< 50' : nf(v.DL)) + ' mm; vale a interseção mais alta: D = ' + (v.D < 50 ? '< 50' : nf(v.D)) + ' mm.',
        v.adocao.tubo ? textoTuboV(v, estado) : v.adocao.semTubos ? 'Sem tubos: informe o diâmetro interno dos tubos de ' + PJ.matVertical(estado).toLowerCase() + ' (Di ≥ ' + nf(v.adocao.minimo) + ' mm).' : 'Nenhum tubo disponível atende.',
      ].concat(v.avisos.map(function (a) { return 'Obs.: ' + a.texto; }))]);
    }
    return passos;
  }

  function memorial(P, estado) {
    const e = estado;
    const ch = P.chuva;
    let t1 = '';
    const fonte = String(e.fonteChuva || '').trim();
    if (e.modoI === 'tabela') {
      // Período pedido e período a que o valor se refere (nota b da Tabela 5), sempre os dois.
      const Tp = Number(e.T);
      t1 = 'Local: ' + (ch.I.linha ? ch.I.linha.local : '—') + ' (Tabela 5). Período de retorno pedido T = ' + Tp + ' anos' +
        (ch.I.T && ch.I.T !== Tp ? '; o valor usado refere-se a T = ' + ch.I.T + ' anos' : '') + ', duração de 5 min. I = ' + nf(ch.I.I) + ' mm/h.';
    } else if (e.modoI === 'idf') {
      t1 = 'Equação IDF local i = K·T^a/(t+b)^c com K = ' + na(num(e.idfK)) + ', a = ' + na(num(e.idfA)) + ', b = ' + na(num(e.idfB)) + ', c = ' + na(num(e.idfC)) +
        ', T = ' + e.T + ' anos e t = 5 min: I = ' + nf(ch.I.I, 1) + ' mm/h. Fonte: ' + (fonte || 'não informada') + '.';
    } else if (e.modoI === 'pequena') {
      t1 = 'Construção com até 100 m² de projeção horizontal (' + na(num(e.areaProj)) + ' m²): I = 150 mm/h (5.1.4).';
    } else {
      t1 = 'Intensidade de dado pluviométrico local: I = ' + nf(ch.I.I) + ' mm/h' + (ch.I.T ? ', T = ' + ch.I.T + ' anos' : '') + '. Fonte: ' + (fonte || 'não informada') + '.';
    }
    const obs51 = ch.avisos51.filter(function (a) { return a.classe && a.classe !== 'informativa'; }).map(function (a) { return 'Obs.: ' + a.texto; });
    const grupos = [{ titulo: 'Chuva de projeto', passos: [['5.1', 'Intensidade pluviométrica', [t1].concat(obs51)]] }];
    P.calhas.forEach(function (R) { grupos.push({ titulo: 'Calha: ' + (R.c.nome || 'sem nome'), passos: memorialCalha(R, estado) }); });
    if (P.trechos.length) {
      grupos.push({
        titulo: 'Coletores horizontais',
        passos: P.trechos.map(function (T) {
          const linhas = [
            'Recebe: ' + (T.recebe.length ? T.recebe.map(function (r) { return r.c.nome || 'sem nome'; }).join(', ') : 'nenhuma calha') +
              (z(num(T.t.Qextra)) > 0 ? ' + ' + nf(num(T.t.Qextra), 0) + ' L/min extra' : '') + '. Q = ' + nf(T.Q, 1) + ' L/min.',
            T.mat.rotulo + ' (n = ' + nf(T.n, 3) + '), ' + (T.t.instalacao === 'aparente' ? 'aparente' : 'enterrado') + ', i = ' + na(T.i * 100) + '%, lâmina 2/3 do Di.',
            'Tubo: ' + T.linhaInfo.rotulo + '.',
          ];
          if (T.pronto) linhas.push(T.escolhido ? textoTuboH(T) : 'Nenhum tubo da linha atende.');
          if (T.desnivel != null) linhas.push('Desnível: ' + nf(T.desnivel * 100, 1) + ' cm em ' + na(num(T.t.comp)) + ' m.');
          return ['5.7', T.t.nome || 'Trecho', linhas];
        }),
      });
    }
    const concl = [];
    const prontas = P.calhas.filter(function (r) { return r.calha.pronta; });
    if (prontas.length) concl.push(prontas.length + ' calha(s): ' + prontas.map(function (r) { return (r.c.nome || 'sem nome') + ' ' + descSecao(r.calha) + ' mm'; }).join('; '));
    const porTubo = {};
    const ordemTubo = [];
    P.calhas.forEach(function (r) {
      if (!(r.vert.pronto && r.vert.adocao.tubo)) return;
      const k = rotuloTubo(r.vert.adocao.tubo);
      if (!(k in porTubo)) { porTubo[k] = 0; ordemTubo.push([r.vert.adocao.tubo.di, k]); }
      porTubo[k] += r.dist.n;
    });
    ordemTubo.sort(function (a, b) { return a[0] - b[0]; });
    if (ordemTubo.length) concl.push('condutores verticais: ' + ordemTubo.map(function (x) { return porTubo[x[1]] + ' × ' + x[1]; }).join(', '));
    const trs = P.trechos.filter(function (T) { return T.escolhido; });
    if (trs.length) concl.push('coletores: ' + trs.map(function (T) { return (T.t.nome || 'trecho') + ' ' + rotuloTubo(T.escolhido); }).join(', '));
    // A conclusão diz a situação do projeto antes do resultado: nunca um resultado "limpo" de
    // um projeto com pendência ou ressalva.
    const sit = P.status !== 'ok' ? 'Situação do projeto: ' + ROTULO_STATUS[P.status] + '. ' : '';
    return { grupos: grupos, conclusao: concl.length ? sit + 'Resultado: ' + concl.join('; ') + '.' : sit.trim() };
  }

  function textoMemorial(m, estado) {
    const linhas = ['MEMORIAL DE CÁLCULO — ÁGUAS PLUVIAIS (NBR 10844:1989)', estado.projeto || 'Obra sem nome', ''];
    m.grupos.forEach(function (g) {
      linhas.push('== ' + g.titulo.toUpperCase() + ' ==');
      g.passos.forEach(function (p) {
        linhas.push(p[0] + ' ' + p[1]);
        p[2].forEach(function (t) { linhas.push('  ' + t); });
      });
      linhas.push('');
    });
    if (m.conclusao) linhas.push(m.conclusao);
    return linhas.join('\n');
  }

  return {
    memorialCalha: memorialCalha,
    memorial: memorial,
    textoMemorial: textoMemorial,
  };
});
