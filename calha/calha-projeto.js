/*
 * Calha 10844 — cálculo do projeto inteiro: chuva (5.1), cada calha (5.2 a 5.6)
 * e os trechos de coletor (5.7). Recebe o estado e devolve resultados; sem DOM.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node ? [require('./nbr10844-calc.js'), require('./calha-util.js')] : [root.NBR10844, root.CalhaUtil];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaProjeto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, U) {
  'use strict';

  const DD = N.DADOS;
  const { esc, nf, na, num, z, lerNum, mostrarNum, lerLista, normaliza, uid, copia, MAT_C, MAT_H, matCalha, matHor, tubosPadrao, avisosHtml, grande, pares, nota, aguardando, cabecalho, descSecao, ROTULO_STATUS, seloStatus } = U;

  /* ------------------------------------------------------------------ */
  /* Cálculo: chuva (5.1), cada calha (5.2 a 5.6), coletores (5.7)       */
  /* ------------------------------------------------------------------ */

  function calcularChuva(estado) {
    const e = estado;
    const R = {};
    R.I = N.intensidade({
      modo: e.modoI, localId: Number(e.localId), T: Number(e.T),
      areaProjecao: z(num(e.areaProj)), valor: z(num(e.Imanual)),
      K: num(e.idfK), a: num(e.idfA), b: num(e.idfB), c: num(e.idfC),
    });
    if (e.modoI === 'manual') R.I.T = Number.isFinite(num(e.Tmanual)) ? num(e.Tmanual) : null;
    R.avisos51 = R.I.avisos.slice();
    const Tnom = e.modoI === 'manual' ? num(e.Tmanual) : e.modoI === 'pequena' ? NaN : Number(e.T);
    const criticas = e.calhas.filter(function (c) { return c.tipoCalha === 'platibanda' || c.tipoCalha === 'agua-furtada'; });
    if (criticas.length && Tnom < 25) {
      R.avisos51.push({
        nivel: 'info',
        texto: (criticas.length === 1 ? 'A calha "' + (criticas[0].nome || 'sem nome') + '" é de ' + (criticas[0].tipoCalha === 'platibanda' ? 'platibanda' : 'água-furtada') : 'Há calhas de platibanda ou de água-furtada') +
          '. Onde empoçamento ou extravasamento não puder ser tolerado, a norma pede T = 25 anos (5.1.2) e admite extravasores como segurança adicional (5.5.5).',
      });
    }
    return R;
  }

  function calcularCalha(estado, c, chuva) {
    const e = Object.assign({}, estado, c);
    const R = { c: c, I: chuva.I };

    // 5.2
    R.sups = e.superficies.map(function (s) { return N.areaSuperficie(s); });
    R.A = R.sups.reduce(function (a, s) { return a + s.A; }, 0);

    // 5.3
    R.Q = N.vazao(z(R.I.I), R.A);
    R.dist = N.distribuicao({
      config: e.saidas, Lc: z(num(e.Lc)), x: z(num(e.xSaida)), n: z(num(e.nSaidas)), lista: lerLista(e.listaSaidas),
    });
    // 5.5.6: a Tabela 1 vale para calhas de beiral e de platibanda.
    R.coef = e.tipoCalha === 'agua-furtada' ? 1 : N.coefTabela1(e.curva, e.faixa);
    R.Qcalha = R.Q * R.dist.fracCalha * R.coef;
    R.Qcond = R.Q * R.dist.fracCondutor;
    R.avisos53 = [];
    if (R.dist.erro) R.avisos53.push({ nivel: 'erro', texto: R.dist.erro });
    if (e.saidas === 'intermediaria' && num(e.xSaida) > num(e.Lc)) {
      R.avisos53.push({ nivel: 'erro', texto: 'A saída está além do comprimento da calha. Confira as duas medidas.' });
    }
    if (e.saidas === 'personalizadas' && lerLista(e.listaSaidas).some(function (x) { return x < 0 || x > num(e.Lc); })) {
      R.avisos53.push({ nivel: 'atencao', texto: 'Há posição fora da calha; ela foi levada para a ponta mais próxima.' });
    }

    // 5.5
    const mat = matCalha(e.material);
    const n = mat.n;
    const i = z(num(e.decl)) / 100;
    const frac = Number(e.fracLamina);
    let dims;
    if (e.forma === 'retangular') dims = { b: z(num(e.b)) / 1000, h: z(num(e.h)) / 1000 };
    else if (e.forma === 'semicircular') dims = { D: z(num(e.Dcalha)) / 1000 };
    else dims = { b: z(num(e.bt)) / 1000, z: z(num(e.z)), h: z(num(e.ht)) / 1000 };
    R.calha = { n: n, i: i, frac: frac, dims: dims, forma: e.forma, mat: mat, avisos: [] };
    const temSecao = e.forma === 'semicircular' ? dims.D > 0 : dims.b > 0 && dims.h > 0;
    if (temSecao && i > 0 && R.Qcalha > 0) {
      Object.assign(R.calha, N.verificarCalha({ forma: e.forma, dims: dims, Q: R.Qcalha, n: n, i: i, fracLamina: frac }));
      R.calha.pronta = true;
      if (R.dist.trecho != null) R.calha.desnivel = i * R.dist.trecho;
    }
    if (mat.chapa && temSecao) {
      const dev = N.desenvolvimento(e.forma, dims, z(num(e.abas)) / 1000);
      const corte = N.corteComercial(dev);
      const chapa = DD.CHAPAS[mat.chapa];
      R.calha.chapa = { dev: dev, corte: corte, metal: chapa.rotulo, massa: (corte ? corte / 1000 : dev) * z(Number(e.espessura)) * chapa.dens };
    }
    if (e.tipoCalha !== 'agua-furtada' && i > 0 && i < DD.DECLIVIDADE_MINIMA - 1e-9) {
      R.calha.avisos.push({ nivel: 'erro', texto: 'Calhas de beiral e platibanda precisam de declividade uniforme de no mínimo 0,5% (5.5.2).' });
    }
    if (e.tipoCalha === 'agua-furtada') {
      R.calha.avisos.push({ nivel: 'info', texto: 'Na calha de água-furtada a inclinação acompanha o projeto da cobertura (5.5.3).' });
    }
    if (frac === 1 && e.forma !== 'semicircular') {
      R.calha.avisos.push({ nivel: 'info', texto: 'Seção cheia não deixa bordo livre: qualquer excesso transborda. Onde isso não for tolerável, a norma prevê extravasores (5.5.5).' });
    }
    if (!(i > 0)) R.calha.avisos.push({ nivel: 'erro', texto: 'Informe a declividade da calha.' });
    if (e.forma === 'semicircular' && n === 0.011 && temSecao) {
      const t3 = DD.TABELA3;
      const lin = t3.linhas.find(function (l) { return l.D === Math.round(dims.D * 1000); });
      const j = t3.declividades.findIndex(function (d) { return Math.abs(d - i) < 1e-9; });
      if (lin && j >= 0) R.calha.tabela3 = { D: lin.D, Q: lin.Q[j], i: i };
    }

    // 5.6
    let H = NaN;
    if (e.fonteH === 'digitada') H = num(e.Hlam);
    else if (R.calha.pronta) H = e.fonteH === 'calculada' ? (R.calha.y != null ? R.calha.y * 1000 : NaN) : R.calha.yLim * 1000;
    R.H = H;
    R.vert = { avisos: [] };
    const tubos = e.tubos.filter(function (t) { return num(t.di) > 0; }).map(function (t) { return { dn: t.dn, di: num(t.di) }; });
    if (R.Qcond > 0 && H > 0 && num(e.Lcond) > 0) {
      R.vert = N.abaco({ saida: e.saida, Q: R.Qcond, H: H, L: num(e.Lcond) });
      R.vert.pronto = true;
      if (R.vert.fora) {
        R.vert.adocao = { tubo: null, minimo: NaN, peloMinimo: false };
      } else {
        R.vert.adocao = N.adotarTubo(R.vert.D, tubos);
        const falhou = !R.vert.adocao.tubo || R.vert.D > 150 || R.Qcond > N.ABACOS[e.saida].Qmax;
        if (falhou) R.vert.sugestao = N.sugerirSaidas({ Q: R.Q, H: H, L: num(e.Lcond), saida: e.saida, tubos: tubos });
      }
    } else {
      R.vert.faltando = !(H > 0) ? 'H' : !(num(e.Lcond) > 0) ? 'L' : 'Q';
    }
    R.status = statusCalha(R);
    return R;
  }

  function temNivel(lista, nivel) { return (lista || []).some(function (a) { return a.nivel === nivel; }); }

  // Situação da calha inteira: '' incompleta, 'ok', 'atencao' ou 'erro'.
  function statusCalha(R) {
    const c = R.calha;
    const v = R.vert;
    if (!(R.Q > 0) || !c.pronta || !v.pronto) return '';
    if (c.y == null || temNivel(c.avisos, 'erro') || temNivel(R.avisos53, 'erro') || !v.adocao.tubo || temNivel(v.avisos, 'erro')) return 'erro';
    if (!c.ok || temNivel(v.avisos, 'atencao') || temNivel(R.avisos53, 'atencao')) return 'atencao';
    return 'ok';
  }

  function calcularTrecho(t, Rs) {
    const T = { t: t, avisos: [] };
    T.recebe = Rs.filter(function (r) { return t.calhas.indexOf(r.c.id) >= 0; });
    T.Q = T.recebe.reduce(function (s, r) { return s + r.Q; }, 0) + z(num(t.Qextra));
    T.mat = matHor(t.material);
    T.n = T.mat.n;
    T.i = z(num(t.decl)) / 100;
    if (T.Q > 0 && T.i > 0) Object.assign(T, N.condutorHorizontal({ Q: T.Q, n: T.n, i: T.i }), { pronto: true });
    if (!(T.i > 0)) T.avisos.push({ nivel: 'erro', texto: 'Informe a declividade.' });
    else if (T.i < DD.DECLIVIDADE_MINIMA - 1e-9) T.avisos.push({ nivel: 'erro', texto: 'Declividade mínima de 0,5% (5.7.1).' });
    const comp = num(t.comp);
    if (comp > 0 && T.i > 0) T.desnivel = T.i * comp;
    if (comp > 20) {
      T.avisos.push({
        nivel: 'info',
        texto: na(comp) + ' m: preveja ' + (t.instalacao === 'aparente' ? 'inspeção (5.7.3)' : 'caixa de areia (5.7.4)') +
          ' a cada 20 m de trecho reto, além das conexões e das mudanças de direção ou de declividade.',
      });
    }
    if (T.pronto && !T.escolhido) T.avisos.push({ nivel: 'erro', texto: 'Nem o tubo de 300 mm basta: divida o coletor ou aumente a declividade.' });
    const t4 = DD.TABELA4;
    const j = t4.declividades.findIndex(function (d) { return Math.abs(d - T.i) < 1e-9; });
    T.colT4 = t4.Q[T.n] && j >= 0 ? t4.Q[T.n].map(function (l) { return l[j]; }) : null;
    T.status = !T.pronto ? '' : !T.escolhido || temNivel(T.avisos, 'erro') ? 'erro' : temNivel(T.avisos, 'atencao') ? 'atencao' : 'ok';
    return T;
  }

  function calcularProjeto(estado) {
    const chuva = calcularChuva(estado);
    const Rs = estado.calhas.map(function (c) { return calcularCalha(estado, c, chuva); });
    const Ts = estado.trechos.map(function (t) { return calcularTrecho(t, Rs); });
    return {
      chuva: chuva,
      calhas: Rs,
      trechos: Ts,
      ativa: Rs.find(function (r) { return r.c.id === estado.ativa; }) || Rs[0],
      A: Rs.reduce(function (s, r) { return s + r.A; }, 0),
      Q: Rs.reduce(function (s, r) { return s + r.Q; }, 0),
      semColetor: Rs.filter(function (r) { return r.Q > 0 && !estado.trechos.some(function (t) { return t.calhas.indexOf(r.c.id) >= 0; }); }),
    };
  }

  function textoSaidas(R) {
    const e = R.c;
    const t = R.dist.trecho;
    if (e.saidas === 'ponta') return 'a calha inteira escoa para a saída';
    if (e.saidas === 'intermediaria') return t != null ? 'maior lado: ' + na(t) + ' m de ' + na(z(num(e.Lc))) + ' m' : '—';
    if (e.saidas === 'duas-pontas') return 'metade da calha para cada ponta' + (t != null ? ' (' + na(t) + ' m)' : '');
    if (e.saidas === 'espacadas') return R.dist.n + ' saídas; cada lado de saída recebe ' + (t != null ? na(t) + ' m' : '1/' + 2 * R.dist.n + ' da calha');
    return t != null ? 'maior trecho entre divisor e saída: ' + na(t) + ' m' : '—';
  }

  const TEXTO_FONTE_H = {
    limite: 'lâmina máxima admitida na calha',
    calculada: 'lâmina calculada na calha (a favor da segurança)',
    digitada: 'valor digitado',
  };

  /* ------------------------------------------------------------------ */
  /* Leitura rápida: próximo passo, resposta direta, lista de materiais  */
  /* ------------------------------------------------------------------ */

  function primeiro(lista, nivel) { return (lista || []).find(function (a) { return a.nivel === nivel; }); }

  function matVertical(estado) {
    const l = DD.MATERIAIS_VERTICAL;
    return (l.find(function (m) { return m.id === estado.materialV; }) || l[0]).rotulo;
  }

  // O que falta ou falha numa calha, na ordem da norma: [item, texto, seletor].
  function pendenciaCalha(R) {
    const c = R.c;
    const k = R.calha;
    const v = R.vert;
    if (!(R.A > 0)) return ['5.2', 'preencha as medidas das superfícies que escoam para a calha.', '#superficies input'];
    const e53 = primeiro(R.avisos53, 'erro');
    if (e53) return ['5.3', e53.texto, c.saidas === 'personalizadas' ? '#listaSaidas' : c.saidas === 'intermediaria' && num(c.Lc) > 0 ? '#xSaida' : '#Lc'];
    if (!(k.i > 0)) return ['5.5', 'informe a declividade da calha.', '#decl'];
    if (!k.pronta) return ['5.5', 'informe as medidas da seção da calha.', { retangular: '#b', semicircular: '#Dcalha', trapezoidal: '#bt' }[c.forma]];
    const e55 = primeiro(k.avisos, 'erro');
    if (e55) return ['5.5', e55.texto, '#decl'];
    if (k.y == null) return ['5.5', 'a seção transborda. Use o botão de dimensionar, aumente a declividade ou ponha mais saídas.', '#btn-dimensionar'];
    if (!k.ok) return ['5.5', 'a lâmina passa do limite adotado. Use o botão de dimensionar ou aumente a declividade.', '#btn-dimensionar'];
    if (!v.pronto) {
      if (v.faltando === 'L') return ['5.6', 'informe o comprimento L do condutor vertical.', '#Lcond'];
      if (v.faltando === 'H') return ['5.6', 'informe a lâmina H na calha.', '#Hlam'];
      return null;
    }
    if (v.fora) return ['5.6', primeiro(v.avisos, 'erro').texto, v.fora === 'L' ? '#Lcond' : c.fonteH === 'digitada' ? '#Hlam' : 'input[name="fonteH"]'];
    if (!v.adocao.tubo || v.D > 150 || R.Qcond > N.ABACOS[c.saida].Qmax) {
      return ['5.6', v.sugestao ? 'o condutor não cabe no ábaco: use ' + v.sugestao.n + ' saídas espaçadas.' : 'nenhum tubo da lista atende ao ábaco.', '#r56'];
    }
    return null;
  }

  // Pendências do projeto; a calha ativa vem primeiro. Sem chuva, nada mais adianta.
  function pendencias(P, estado) {
    const out = [];
    const add = function (item, texto, alvo, calhaId) { out.push({ item: item, texto: texto, alvo: alvo, calhaId: calhaId || null }); };
    const ch = P.chuva;
    if (!(ch.I.I > 0)) {
      const m = estado.modoI;
      add('5.1', m === 'tabela' ? 'escolha o local da obra na Tabela 5.' : m === 'idf' ? 'informe K, a, b e c da equação de chuvas intensas.' :
        m === 'pequena' ? 'informe a área de projeção da construção.' : 'informe a intensidade pluviométrica do local.',
      { tabela: '#busca-local', idf: '#idfK', pequena: '#areaProj', manual: '#Imanual' }[m]);
      return out;
    }
    const e51 = primeiro(ch.avisos51, 'erro');
    if (e51) add('5.1', e51.texto, '#s51');
    const ordem = [P.ativa].concat(P.calhas.filter(function (r) { return r !== P.ativa; }));
    ordem.forEach(function (R) {
      const p = pendenciaCalha(R);
      if (p) add(p[0], (P.calhas.length > 1 ? (R.c.nome || 'Calha sem nome') + ': ' : '') + p[1], p[2], R.c.id);
    });
    P.semColetor.forEach(function (R) {
      add('5.7', '"' + (R.c.nome || 'Calha sem nome') + '" não chega a nenhum coletor: marque-a no trecho que recebe seus condutores.', '#trechos');
    });
    P.trechos.forEach(function (T, i) {
      const nome = (T.t.nome || 'Trecho') + ': ';
      const alvo = '[data-trecho="' + i + '"][data-campo="decl"]';
      if (!(T.Q > 0)) add('5.7', nome + 'marque as calhas que chegam a ele.', '[data-trecho-calha="' + i + '"]');
      else if (!(T.i > 0)) add('5.7', nome + 'informe a declividade.', alvo);
      else {
        const er = primeiro(T.avisos, 'erro');
        if (er) add('5.7', nome + er.texto, alvo);
      }
    });
    return out;
  }

  // A calha em uma frase: o que foi adotado e quanto sobra.
  function respostaCalha(R) {
    if (!R.status) return null;
    const k = R.calha;
    const v = R.vert;
    const c = R.c;
    const partes = ['Calha ' + descSecao(k) + ' mm de ' + k.mat.rotulo.toLowerCase() + ' com ' + na(k.i * 100) + '% de caimento'];
    partes.push(k.y != null ? 'a água sobe ' + nf(k.y * 1000) + ' mm de um limite de ' + nf(k.yLim * 1000) + ' mm (' + nf(k.uso * 100) + '% da capacidade)' : 'transborda mesmo cheia');
    const n = R.dist.n;
    partes.push(v.adocao && v.adocao.tubo ? (n > 1 ? n + ' condutores' : '1 condutor') + ' DN ' + v.adocao.tubo.dn + ' com ' + na(num(c.Lcond)) + ' m' : 'o condutor não tem tubo que atenda');
    if (k.desnivel != null) partes.push('desnível de ' + nf(k.desnivel * 100, 1) + ' cm no maior trecho');
    return { status: R.status, texto: partes.join('; ') + '.' };
  }

  // Levantamento do projeto inteiro, que sai do cálculo. É o mínimo: cantos, emendas,
  // suportes e mudanças de direção do traçado real acrescentam peças. A mesma peça vinda de
  // calhas ou trechos diferentes é somada numa linha; quando há mais de uma origem, a base
  // mostra cada parcela.
  function listaMateriais(P, estado) {
    const matV = matVertical(estado).toLowerCase();
    const CALHAS = 0, VERTICAIS = 1, COLETORES = 2;
    const grupos = [
      { titulo: 'Calhas', itens: [] },
      { titulo: 'Condutores verticais', itens: [] },
      { titulo: 'Coletores horizontais', itens: [] },
    ];
    const porChave = {};
    const fmt = function (x, un) { return un === 'kg' ? nf(x, 1) : un === 'm' ? na(x) : String(x); };
    // qtd null = medida não informada naquela origem; qtd texto = quantidade que não se soma.
    function somar(g, peca, qtd, un, ref, origem) {
      const chave = g + '|' + peca + '|' + un;
      let it = porChave[chave];
      if (!it) {
        it = porChave[chave] = { peca: peca, un: un, ref: ref, total: 0, texto: null, partes: [], falta: [] };
        grupos[g].itens.push(it);
      }
      if (typeof qtd === 'string') { it.texto = qtd; it.partes.push(origem); }
      else if (qtd == null) it.falta.push(origem);
      else { it.total += qtd; it.partes.push(origem + ' ' + fmt(qtd, un)); }
    }

    P.calhas.forEach(function (R) {
      const c = R.c;
      const k = R.calha;
      const v = R.vert;
      const nome = c.nome || 'calha sem nome';
      const Lc = num(c.Lc);
      if (k.pronta) somar(CALHAS, 'Calha ' + descSecao(k) + ' mm, ' + k.mat.rotulo.toLowerCase(), Lc > 0 ? Lc : null, 'm', '5.5', nome);
      if (k.chapa && k.chapa.corte) {
        somar(CALHAS, 'Chapa de ' + k.chapa.metal + ' ' + nf(Number(c.espessura), 2) + ' mm, corte ' + k.chapa.corte + ' mm',
          Lc > 0 ? k.chapa.massa * Lc : null, 'kg', 'massa aproximada', nome);
      }
      if (R.Q > 0) somar(CALHAS, 'Saída ' + (c.saida === 'b' ? 'com funil' : 'em aresta viva'), R.dist.n, 'un', '5.6.4.1', nome);
      if (v.pronto && v.adocao.tubo) {
        const Lv = num(c.Lcond);
        somar(VERTICAIS, 'Condutor vertical DN ' + v.adocao.tubo.dn + ', ' + matV, R.dist.n * Lv, 'm', '5.6', nome);
        somar(VERTICAIS, 'Curva de raio longo no pé do condutor', R.dist.n, 'un', '5.7.5', nome);
        somar(VERTICAIS, 'Inspeção ou caixa de areia no pé do condutor', R.dist.n, 'un', '5.7.5', nome);
      }
    });
    P.trechos.forEach(function (T) {
      const nome = T.t.nome || 'trecho';
      const comp = num(T.t.comp);
      const enterrado = T.t.instalacao !== 'aparente';
      const base = enterrado ? '5.7.4' : '5.7.3';
      if (T.escolhido) {
        somar(COLETORES, 'Tubo de diâmetro interno ' + T.escolhido.D + ' mm, ' + T.mat.rotulo.toLowerCase() + (enterrado ? ', enterrado' : ', aparente'),
          comp > 0 ? comp : null, 'm', '5.7.2', nome);
      }
      const inter = comp > 0 ? Math.max(0, Math.ceil(comp / 20 - 1e-9) - 1) : 0;
      if (inter) somar(COLETORES, (enterrado ? 'Caixa de areia' : 'Inspeção') + ' intermediária em trecho reto', inter, 'un', base, nome);
      if (T.Q > 0) somar(COLETORES, (enterrado ? 'Caixas de areia' : 'Inspeções') + ' nas conexões e mudanças de direção ou de declividade', 'pelo traçado', '', base, nome);
    });

    // Dentro do grupo: tubos primeiro, depois as peças contadas, por fim o que sai do traçado.
    const ordem = function (it) { return it.texto ? 2 : /^Tubo /.test(it.peca) ? 0 : 1; };
    return grupos.map(function (g) {
      return {
        titulo: g.titulo,
        itens: g.itens.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) {
          return ordem(a.it) - ordem(b.it) || a.i - b.i;
        }).map(function (x) {
          const it = x.it;
          const origens = it.partes.length + it.falta.length;
          let ref = it.ref;
          if (!it.texto && origens > 1) ref += ' · ' + it.partes.join(' + ');
          if (it.texto && origens > 1) ref += ' · ' + it.partes.join(', ');
          if (it.falta.length) ref += ' · sem medida: ' + it.falta.join(', ');
          const qtd = it.texto || (it.partes.length ? fmt(it.total, it.un) : '—') + (it.partes.length && it.falta.length ? ' + ?' : '');
          return { peca: it.peca, qtd: qtd, un: it.un, ref: ref };
        }),
      };
    });
  }

  return {
    calcularChuva: calcularChuva,
    calcularCalha: calcularCalha,
    statusCalha: statusCalha,
    calcularTrecho: calcularTrecho,
    calcularProjeto: calcularProjeto,
    temNivel: temNivel,
    textoSaidas: textoSaidas,
    TEXTO_FONTE_H: TEXTO_FONTE_H,
    matVertical: matVertical,
    pendencias: pendencias,
    respostaCalha: respostaCalha,
    listaMateriais: listaMateriais,
  };
});
