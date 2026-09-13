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
    // Dado local ou equação sem fonte registrada: a conta sai, mas com ressalva (5.1.1).
    if ((e.modoI === 'idf' || e.modoI === 'manual') && R.I.I > 0 && !String(e.fonteChuva || '').trim()) {
      R.avisos51.push({ nivel: 'atencao', classe: 'ressalva', codigo: 'CHUVA_SEM_FONTE', texto: 'Informe a fonte do dado de chuva (estudo, órgão ou posto). Sem ela, o resultado fica com ressalva e o PDF registra a falta.' });
    }
    // 5.1.4: as coberturas informadas não podem somar mais projeção que o limite do item.
    if (e.modoI === 'pequena') {
      const proj = e.calhas.reduce(function (s, c) {
        return s + (c.superficies || []).reduce(function (t, x) {
          const a = num(x.v && x.v.a);
          const b = num(x.v && x.v.b);
          return t + ((x.tipo === 'a' || x.tipo === 'b') && a > 0 && b > 0 ? a * b : 0);
        }, 0);
      }, 0);
      if (proj > DD.AREA_PEQUENA + 1e-9) {
        R.avisos51.push({ nivel: 'erro', classe: 'sem_suporte', codigo: 'CHUVA_PROJECAO_SUPERFICIES', texto: 'As coberturas informadas somam ' + nf(proj, 1) + ' m² de projeção horizontal, mais que os 100 m² do item 5.1.4: use a Tabela 5 ou dados locais.' });
      }
    }
    const Tnom = e.modoI === 'manual' ? num(e.Tmanual) : e.modoI === 'pequena' ? NaN : Number(e.T);
    const criticas = e.calhas.filter(function (c) { return c.tipoCalha === 'platibanda' || c.tipoCalha === 'agua-furtada'; });
    if (criticas.length && Tnom < 25) {
      R.avisos51.push({
        nivel: 'info',
        classe: 'informativa',
        texto: (criticas.length === 1 ? 'A calha "' + (criticas[0].nome || 'sem nome') + '" é de ' + (criticas[0].tipoCalha === 'platibanda' ? 'platibanda' : 'água-furtada') : 'Há calhas de platibanda ou de água-furtada') +
          '. Onde empoçamento ou extravasamento não puder ser tolerado, a norma pede T = 25 anos (5.1.2) e admite extravasores como segurança adicional (5.5.5).',
      });
    }
    R.estado = N.situacao(R.avisos51);
    return R;
  }

  function calcularCalha(estado, c, chuva) {
    const e = Object.assign({}, estado, c);
    const R = { c: c, I: chuva.I };

    // 5.2 — superfície vazia, zerada ou negativa não soma área: fica incompleta ou inválida.
    R.sups = e.superficies.map(function (s) { return N.areaSuperficie(s); });
    R.A = R.sups.reduce(function (a, s) { return a + s.A; }, 0);
    R.supEstado = R.sups.reduce(function (acc, s) { return N.piorEstado(acc, s.estado === 'ok' ? 'atende' : s.estado); }, 'atende');

    // 5.3
    R.Q = N.vazao(z(R.I.I), R.A);
    R.dist = N.distribuicao({
      config: e.saidas, Lc: z(num(e.Lc)), x: z(num(e.xSaida)), n: z(num(e.nSaidas)), lista: lerLista(e.listaSaidas),
    });
    // 5.5.6: a Tabela 1 vale para calhas de beiral e de platibanda.
    R.coef = e.tipoCalha === 'agua-furtada' ? 1 : N.coefTabela1(e.curva, e.faixa);
    R.Qcalha = R.Q * R.dist.fracCalha * R.coef;
    R.Qcond = R.Q * R.dist.fracCondutor;
    // Nenhuma entrada de saídas é ajustada em silêncio: fora da calha ou número de saídas
    // quebrado é inválido.
    R.avisos53 = [];
    if (R.dist.erro) R.avisos53.push({ nivel: 'erro', classe: 'incompleta', texto: R.dist.erro });
    if (num(e.Lc) < 0) R.avisos53.push({ nivel: 'erro', classe: 'invalida', codigo: 'LC_NEGATIVO', texto: 'O comprimento da calha não pode ser negativo.' });
    if (e.saidas === 'intermediaria' && (num(e.xSaida) > num(e.Lc) || num(e.xSaida) < 0)) {
      R.avisos53.push({ nivel: 'erro', classe: 'invalida', codigo: 'SAIDA_FORA', texto: 'A saída está fora da calha (0 a ' + na(num(e.Lc)) + ' m). Confira as duas medidas.' });
    }
    if (e.saidas === 'personalizadas' && lerLista(e.listaSaidas).some(function (x) { return x < 0 || x > num(e.Lc); })) {
      R.avisos53.push({ nivel: 'erro', classe: 'invalida', codigo: 'SAIDA_FORA', texto: 'Há posição fora da calha (0 a ' + na(num(e.Lc)) + ' m): corrija a lista de saídas.' });
    }
    if (e.saidas === 'espacadas') {
      const nS = num(e.nSaidas);
      if (!(Number.isInteger(nS) && nS >= 1)) {
        R.avisos53.push({ nivel: 'erro', classe: Number.isFinite(nS) ? 'invalida' : 'incompleta', codigo: 'SAIDAS_N', texto: 'O número de saídas espaçadas deve ser um inteiro, 1 ou mais.' });
      }
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
    const medidas = e.forma === 'retangular' ? [e.b, e.h] : e.forma === 'semicircular' ? [e.Dcalha] : [e.bt, e.ht];
    const negativa = medidas.some(function (x) { return num(x) < 0; });
    const zNegativo = e.forma === 'trapezoidal' && num(e.z) < 0;
    if (negativa) R.calha.avisos.push({ nivel: 'erro', classe: 'invalida', codigo: 'SECAO_NEGATIVA', texto: 'As medidas da seção não podem ser negativas.' });
    if (zNegativo) R.calha.avisos.push({ nivel: 'erro', classe: 'invalida', codigo: 'Z_NEGATIVO', texto: 'O talude z da seção trapezoidal não pode ser negativo (z = 0 é a seção retangular).' });
    const temSecao = !negativa && !zNegativo && (e.forma === 'semicircular' ? dims.D > 0 : dims.b > 0 && dims.h > 0);
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
      R.calha.avisos.push({ nivel: 'erro', classe: 'nao_atende', codigo: 'DECL_MINIMA', texto: 'Calhas de beiral e platibanda precisam de declividade uniforme de no mínimo 0,5% (5.5.2).' });
    }
    // Declividade incomum não é regra da norma: só um lembrete de conferir a digitação.
    if (e.tipoCalha !== 'agua-furtada' && i > 0.05) {
      R.calha.avisos.push({ nivel: 'info', classe: 'informativa', codigo: 'DECL_ATIPICA', texto: 'Declividade de ' + na(i * 100) + '%: incomum para calha de beiral ou platibanda. Confira a digitação.' });
    }
    if (e.tipoCalha === 'agua-furtada') {
      R.calha.avisos.push({ nivel: 'info', classe: 'informativa', texto: 'Na calha de água-furtada a inclinação acompanha o projeto da cobertura (5.5.3).' });
    }
    if (frac === 1 && e.forma !== 'semicircular') {
      R.calha.avisos.push({ nivel: 'info', classe: 'informativa', texto: 'Seção cheia não deixa bordo livre: qualquer excesso transborda. Onde isso não for tolerável, a norma prevê extravasores (5.5.5).' });
    }
    if (num(e.decl) < 0) R.calha.avisos.push({ nivel: 'erro', classe: 'invalida', codigo: 'DECL_NEGATIVA', texto: 'A declividade da calha não pode ser negativa.' });
    else if (!(i > 0)) R.calha.avisos.push({ nivel: 'erro', classe: 'incompleta', texto: 'Informe a declividade da calha.' });
    if (e.forma === 'semicircular' && n === 0.011 && temSecao) {
      const t3 = DD.TABELA3;
      const lin = t3.linhas.find(function (l) { return l.D === Math.round(dims.D * 1000); });
      const j = t3.declividades.findIndex(function (d) { return Math.abs(d - i) < 1e-9; });
      if (lin && j >= 0) R.calha.tabela3 = { D: lin.D, Q: lin.Q[j], i: i };
    }

    // 5.6 — H é a lâmina de água na calha (5.6.4): digitada, não passa da altura da calha.
    let H = NaN;
    if (e.fonteH === 'digitada') H = num(e.Hlam);
    else if (R.calha.pronta) H = e.fonteH === 'calculada' ? (R.calha.y != null ? R.calha.y * 1000 : NaN) : R.calha.yLim * 1000;
    R.H = H;
    R.vert = { avisos: [] };
    const tubos = e.tubos.filter(function (t) { return num(t.di) > 0; }).map(function (t) { return { dn: t.dn, di: num(t.di) }; });
    const Lv = num(e.Lcond);
    let bloqueio = null;
    if (e.fonteH === 'digitada' && H < 0) {
      bloqueio = { codigo: 'H_NEGATIVO', texto: 'A lâmina H não pode ser negativa.' };
    } else if (e.fonteH === 'digitada' && H > 0 && R.calha.pronta && H > R.calha.hTotal * 1000 + 1e-9) {
      bloqueio = { codigo: 'H_ACIMA_ALTURA', texto: 'H = ' + nf(H) + ' mm passa da altura da calha (' + nf(R.calha.hTotal * 1000) + ' mm): a lâmina não pode ser maior que a própria calha (5.6.4).' };
    } else if (Lv < 0) {
      bloqueio = { codigo: 'L_NEGATIVO', texto: 'O comprimento L do condutor não pode ser negativo.' };
    }
    if (bloqueio) {
      R.vert.avisos.push(Object.assign({ nivel: 'erro', classe: 'invalida' }, bloqueio));
      R.vert.invalido = true;
      R.vert.faltando = bloqueio.codigo === 'L_NEGATIVO' ? 'L' : 'H';
    } else if (R.Qcond > 0 && H > 0 && Lv > 0) {
      R.vert = N.abaco({ saida: e.saida, Q: R.Qcond, H: H, L: Lv });
      R.vert.pronto = true;
      R.vert.adocao = R.vert.fora ? { tubo: null, minimo: NaN, peloMinimo: false } : N.adotarTubo(R.vert.D, tubos);
      if (R.vert.fora === 'D' || R.vert.fora === 'Q' || (!R.vert.fora && !R.vert.adocao.tubo)) {
        R.vert.sugestao = N.sugerirSaidas({ Q: R.Q, H: H, L: Lv, saida: e.saida, tubos: tubos });
      }
      if (e.fonteH === 'digitada' && R.calha.pronta && H > R.calha.yLim * 1000 + 1e-9) {
        R.vert.avisos.push({ nivel: 'erro', classe: 'nao_atende', codigo: 'H_ACIMA_LIMITE', texto: 'H = ' + nf(H) + ' mm passa da lâmina limite adotada na calha (' + nf(R.calha.yLim * 1000) + ' mm): com essa lâmina a calha não atende ao próprio critério.' });
      }
    } else {
      R.vert.faltando = !(H > 0) ? 'H' : !(Lv > 0) ? 'L' : 'Q';
    }
    return R;
  }

  function temNivel(lista, nivel) { return (lista || []).some(function (a) { return a.nivel === nivel; }); }

  // Situação de exibição de cada estado (selo, ponto e classes de CSS).
  const EXIBICAO = { atende: 'ok', ressalva: 'ressalva', nao_atende: 'erro', fora_do_dominio: 'fora', sem_suporte: 'semsuporte', incompleta: '', invalida: 'invalida' };

  // Situação da calha inteira, na precedência do plano (inválida > incompleta > sem suporte >
  // fora do domínio > não atende > ressalva > atende). A chuva entra em todas as calhas.
  function estadoCalha(R, chuva) {
    let s = 'atende';
    const sobe = function (x) { s = N.piorEstado(s, x); };
    sobe(R.supEstado);
    if (!(R.A > 0)) sobe('incompleta');
    [R.avisos53, R.calha.avisos, R.vert.avisos].forEach(function (l) { sobe(N.situacao(l)); });
    const c = R.calha;
    if (!c.pronta) sobe('incompleta');
    else if (c.y == null || !c.ok) sobe('nao_atende');
    const v = R.vert;
    if (v.invalido) sobe('invalida');
    else if (!v.pronto) sobe('incompleta');
    else if (v.fora) sobe('fora_do_dominio');
    else if (!v.adocao.tubo) sobe('nao_atende');
    sobe(chuva.estado);
    if (!(chuva.I.I > 0)) sobe('incompleta');
    return s;
  }

  function calcularTrecho(t, Rs) {
    const T = { t: t, avisos: [] };
    T.recebe = Rs.filter(function (r) { return t.calhas.indexOf(r.c.id) >= 0; });
    const extra = num(t.Qextra);
    T.Q = T.recebe.reduce(function (s, r) { return s + r.Q; }, 0) + (extra > 0 ? extra : 0);
    T.mat = matHor(t.material);
    T.n = T.mat.n;
    T.i = z(num(t.decl)) / 100;
    if (T.Q > 0 && T.i > 0) Object.assign(T, N.condutorHorizontal({ Q: T.Q, n: T.n, i: T.i }), { pronto: true });
    if (extra < 0) T.avisos.push({ nivel: 'erro', classe: 'invalida', codigo: 'QEXTRA_NEGATIVA', texto: 'A vazão extra não pode ser negativa.' });
    if (num(t.decl) < 0) T.avisos.push({ nivel: 'erro', classe: 'invalida', codigo: 'DECL_NEGATIVA', texto: 'A declividade não pode ser negativa.' });
    else if (!(T.i > 0)) T.avisos.push({ nivel: 'erro', classe: 'incompleta', texto: 'Informe a declividade.' });
    else if (T.i < DD.DECLIVIDADE_MINIMA - 1e-9) T.avisos.push({ nivel: 'erro', classe: 'nao_atende', texto: 'Declividade mínima de 0,5% (5.7.1).' });
    const comp = num(t.comp);
    if (comp < 0) T.avisos.push({ nivel: 'erro', classe: 'invalida', codigo: 'COMP_NEGATIVO', texto: 'O comprimento do trecho não pode ser negativo.' });
    if (comp > 0 && T.i > 0) T.desnivel = T.i * comp;
    if (comp > 20) {
      T.avisos.push({
        nivel: 'info',
        classe: 'informativa',
        texto: na(comp) + ' m: preveja ' + (t.instalacao === 'aparente' ? 'inspeção (5.7.3)' : 'caixa de areia (5.7.4)') +
          ' a cada 20 m de trecho reto, além das conexões e das mudanças de direção ou de declividade.',
      });
    }
    if (T.pronto && !T.escolhido) T.avisos.push({ nivel: 'erro', classe: 'nao_atende', texto: 'Nem o tubo de 300 mm basta: divida o coletor ou aumente a declividade.' });
    const t4 = DD.TABELA4;
    const j = t4.declividades.findIndex(function (d) { return Math.abs(d - T.i) < 1e-9; });
    T.colT4 = t4.Q[T.n] && j >= 0 ? t4.Q[T.n].map(function (l) { return l[j]; }) : null;
    return T;
  }

  // Trecho: a própria verificação mais o que recebe. Contribuição desconhecida (calha
  // incompleta ou inválida) deixa o trecho incompleto, mesmo que a hidráulica feche.
  function avaliarTrecho(T) {
    const desconhecidas = T.recebe.filter(function (r) { return r.estado === 'incompleta' || r.estado === 'invalida'; });
    if (desconhecidas.length) {
      T.avisos.push({
        nivel: 'erro', classe: 'incompleta', codigo: 'TRECHO_CONTRIBUICAO_INCOMPLETA',
        texto: 'Recebe ' + desconhecidas.map(function (r) { return '"' + (r.c.nome || 'calha sem nome') + '"'; }).join(', ') +
          ' com dados incompletos ou inválidos: a vazão deste trecho ainda não é conhecida.',
      });
    }
    let s = N.situacao(T.avisos);
    if (!T.pronto) s = N.piorEstado(s, 'incompleta');
    T.recebe.forEach(function (r) { if (r.estado === 'sem_suporte' || r.estado === 'ressalva') s = N.piorEstado(s, r.estado); });
    T.estado = s;
    T.status = EXIBICAO[s];
  }

  // Lista única do que impede o "atende" ou o qualifica: alimenta a faixa do PDF, o memorial
  // e o coach. Avisos informativos ficam de fora.
  function diagnosticos(P) {
    const out = [];
    const add = function (nome, a) {
      if (a.classe && a.classe !== 'informativa' && a.classe !== 'atende') out.push({ nome: nome, classe: a.classe, texto: a.texto });
    };
    P.chuva.avisos51.forEach(function (a) { add('Chuva', a); });
    P.calhas.forEach(function (R) {
      const nome = 'Calha "' + (R.c.nome || 'sem nome') + '"';
      R.sups.forEach(function (s, k) {
        if (s.estado !== 'ok') {
          out.push({ nome: nome, classe: s.estado, texto: 'superfície ' + (k + 1) + ' (' + R.c.superficies[k].tipo + ') ' + (s.estado === 'invalida' ? 'com valor inválido (negativo ou ilegível).' : 'com medida vazia ou zero.') });
        }
      });
      [R.avisos53, R.calha.avisos, R.vert.avisos].forEach(function (l) { (l || []).forEach(function (a) { add(nome, a); }); });
      const c = R.calha;
      if (c.pronta && c.y == null) out.push({ nome: nome, classe: 'nao_atende', texto: 'a seção transborda mesmo cheia.' });
      else if (c.pronta && !c.ok) out.push({ nome: nome, classe: 'nao_atende', texto: 'a lâmina passa do limite adotado.' });
      else if (!c.pronta && R.A > 0 && R.Q > 0 && !temNivel(c.avisos, 'erro')) out.push({ nome: nome, classe: 'incompleta', texto: 'faltam as medidas da seção.' });
      const v = R.vert;
      if (c.pronta && !v.pronto && !v.invalido) {
        out.push({ nome: nome, classe: 'incompleta', texto: 'condutor vertical sem ' + (v.faltando === 'L' ? 'o comprimento L.' : v.faltando === 'H' ? 'a lâmina H.' : 'vazão.') });
      }
      if (v.pronto && !v.fora && !v.adocao.tubo) out.push({ nome: nome, classe: 'nao_atende', texto: 'nenhum tubo da lista atende ao ábaco.' });
    });
    P.trechos.forEach(function (T) {
      const nome = 'Trecho "' + (T.t.nome || 'sem nome') + '"';
      T.avisos.forEach(function (a) { add(nome, a); });
      if (!T.pronto && !T.avisos.some(function (a) { return a.classe === 'incompleta' || a.classe === 'invalida'; })) {
        out.push({ nome: nome, classe: 'incompleta', texto: T.Q > 0 ? 'falta a declividade.' : 'não recebe nenhuma calha.' });
      }
    });
    P.semColetor.forEach(function (R) {
      out.push({ nome: 'Calha "' + (R.c.nome || 'sem nome') + '"', classe: 'incompleta', texto: 'não chega a nenhum trecho de coletor (5.7).' });
    });
    return out;
  }

  // Uma avaliação só: tela, coach, quadro, memorial, lista de materiais e PDF leem os mesmos
  // estados (plano de 13/09/2026, seção 3.1). Ninguém recalcula conformidade por conta própria.
  function calcularProjeto(estado) {
    const chuva = calcularChuva(estado);
    const Rs = estado.calhas.map(function (c) { return calcularCalha(estado, c, chuva); });
    Rs.forEach(function (R) { R.estado = estadoCalha(R, chuva); R.status = EXIBICAO[R.estado]; });
    const Ts = estado.trechos.map(function (t) { return calcularTrecho(t, Rs); });
    Ts.forEach(avaliarTrecho);
    const P = {
      chuva: chuva,
      calhas: Rs,
      trechos: Ts,
      ativa: Rs.find(function (r) { return r.c.id === estado.ativa; }) || Rs[0],
      A: Rs.reduce(function (s, r) { return s + r.A; }, 0),
      Q: Rs.reduce(function (s, r) { return s + r.Q; }, 0),
      semColetor: Rs.filter(function (r) { return r.Q > 0 && !estado.trechos.some(function (t) { return t.calhas.indexOf(r.c.id) >= 0; }); }),
    };
    let s = chuva.estado;
    Rs.concat(Ts).forEach(function (x) { s = N.piorEstado(s, x.estado); });
    if (P.semColetor.length) s = N.piorEstado(s, 'incompleta');
    P.estado = s;
    P.status = EXIBICAO[s];
    P.diagnosticos = diagnosticos(P);
    return P;
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

  // O que falta ou falha numa calha, na ordem da norma: [item, texto, seletor, classe].
  function pendenciaCalha(R) {
    const c = R.c;
    const k = R.calha;
    const v = R.vert;
    const iSup = R.sups.findIndex(function (s) { return s.estado !== 'ok'; });
    if (iSup >= 0) {
      const s = R.sups[iSup];
      const tipo = c.superficies[iSup].tipo;
      const campo = Object.keys(s.campos).find(function (x) { return s.campos[x] === 'invalida'; }) || Object.keys(s.campos)[0];
      const cl = s.campos[campo];
      const sup = 'a superfície (' + tipo + ') ' + N.SUPERFICIES[tipo].nome.toLowerCase();
      return ['5.2', cl === 'invalida' ? sup + ' tem valor inválido em "' + campo + '" (negativo ou ilegível): corrija.' :
        sup + ' está sem "' + campo + '" (vazio ou zero): preencha ou remova a superfície.',
      '#superficies [data-sup="' + iSup + '"][data-var="' + campo + '"]', cl];
    }
    if (!(R.A > 0)) return ['5.2', 'preencha as medidas das superfícies que escoam para a calha.', '#superficies input'];
    const e53 = primeiro(R.avisos53, 'erro');
    if (e53) {
      return ['5.3', e53.texto, e53.codigo === 'SAIDAS_N' ? '#nSaidas' : c.saidas === 'personalizadas' ? '#listaSaidas' : c.saidas === 'intermediaria' && num(c.Lc) > 0 ? '#xSaida' : '#Lc', e53.classe];
    }
    const k55 = (k.avisos || []).find(function (a) { return a.classe === 'invalida'; });
    if (k55) {
      return ['5.5', k55.texto, k55.codigo === 'DECL_NEGATIVA' ? '#decl' : k55.codigo === 'Z_NEGATIVO' ? '#z' : { retangular: '#b', semicircular: '#Dcalha', trapezoidal: '#bt' }[c.forma], 'invalida'];
    }
    if (!(k.i > 0)) return ['5.5', 'informe a declividade da calha.', '#decl'];
    if (!k.pronta) return ['5.5', 'informe as medidas da seção da calha.', { retangular: '#b', semicircular: '#Dcalha', trapezoidal: '#bt' }[c.forma]];
    const e55 = primeiro(k.avisos, 'erro');
    if (e55) return ['5.5', e55.texto, '#decl', e55.classe];
    if (k.y == null) return ['5.5', 'a seção transborda. Use o botão de dimensionar, aumente a declividade ou ponha mais saídas.', '#btn-dimensionar'];
    if (!k.ok) return ['5.5', 'a lâmina passa do limite adotado. Use o botão de dimensionar ou aumente a declividade.', '#btn-dimensionar'];
    if (v.invalido) return ['5.6', v.avisos[0].texto, v.faltando === 'L' ? '#Lcond' : '#Hlam', 'invalida'];
    if (!v.pronto) {
      if (v.faltando === 'L') return ['5.6', 'informe o comprimento L do condutor vertical.', '#Lcond'];
      if (v.faltando === 'H') return ['5.6', 'informe a lâmina H na calha.', '#Hlam'];
      return null;
    }
    if (v.fora === 'D' || v.fora === 'Q') {
      return ['5.6', v.sugestao ? 'o condutor passa do fim do ábaco: use ' + v.sugestao.n + ' saídas espaçadas.' : primeiro(v.avisos, 'erro').texto, '#r56', 'fora_do_dominio'];
    }
    if (v.fora) return ['5.6', primeiro(v.avisos, 'erro').texto, v.fora === 'L' ? '#Lcond' : c.fonteH === 'digitada' ? '#Hlam' : 'input[name="fonteH"]', 'fora_do_dominio'];
    if (!v.adocao.tubo) {
      return ['5.6', v.sugestao ? 'nenhum tubo da lista atende: use ' + v.sugestao.n + ' saídas espaçadas.' : 'nenhum tubo da lista atende ao ábaco.', '#r56'];
    }
    const eH = primeiro(v.avisos, 'erro');
    if (eH) return ['5.6', eH.texto, '#Hlam', eH.classe];
    return null;
  }

  // Pendências do projeto; a calha ativa vem primeiro. Sem chuva, nada mais adianta.
  function pendencias(P, estado) {
    const out = [];
    const add = function (item, texto, alvo, calhaId, classe) {
      out.push({ item: item, texto: texto, alvo: alvo, calhaId: calhaId || null, classe: classe || null });
    };
    const ch = P.chuva;
    if (!(ch.I.I > 0)) {
      const m = estado.modoI;
      const e0 = primeiro(ch.avisos51, 'erro');
      add('5.1', e0 && e0.classe === 'invalida' ? e0.texto : m === 'tabela' ? 'escolha o local da obra na Tabela 5.' : m === 'idf' ? 'informe K, a, b e c da equação de chuvas intensas.' :
        m === 'pequena' ? 'informe a área de projeção da construção.' : 'informe a intensidade pluviométrica do local.',
      { tabela: '#busca-local', idf: '#idfK', pequena: '#areaProj', manual: '#Imanual' }[m], null, e0 ? e0.classe : null);
      return out;
    }
    const e51 = primeiro(ch.avisos51, 'erro');
    if (e51) add('5.1', e51.texto, /PROJECAO/.test(e51.codigo || '') ? '#areaProj' : '#s51', null, e51.classe);
    const ordem = [P.ativa].concat(P.calhas.filter(function (r) { return r !== P.ativa; }));
    ordem.forEach(function (R) {
      const p = pendenciaCalha(R);
      if (p) add(p[0], (P.calhas.length > 1 ? (R.c.nome || 'Calha sem nome') + ': ' : '') + p[1], p[2], R.c.id, p[3]);
    });
    P.semColetor.forEach(function (R) {
      add('5.7', '"' + (R.c.nome || 'Calha sem nome') + '" não chega a nenhum coletor: marque-a no trecho que recebe seus condutores.', '#trechos');
    });
    P.trechos.forEach(function (T, i) {
      const nome = (T.t.nome || 'Trecho') + ': ';
      const alvo = '[data-trecho="' + i + '"][data-campo="decl"]';
      const inval = T.avisos.find(function (a) { return a.classe === 'invalida'; });
      if (inval) add('5.7', nome + inval.texto, inval.codigo === 'QEXTRA_NEGATIVA' ? '[data-trecho="' + i + '"][data-campo="Qextra"]' : inval.codigo === 'COMP_NEGATIVO' ? '[data-trecho="' + i + '"][data-campo="comp"]' : alvo, null, 'invalida');
      else if (!(T.Q > 0)) add('5.7', nome + 'marque as calhas que chegam a ele.', '[data-trecho-calha="' + i + '"]');
      else if (!(T.i > 0)) add('5.7', nome + 'informe a declividade.', alvo);
      else {
        const er = primeiro(T.avisos, 'erro');
        if (er) add('5.7', nome + er.texto, alvo, null, er.classe);
      }
    });
    return out;
  }

  // A calha em uma frase: o que foi adotado e quanto sobra.
  function respostaCalha(R) {
    if (!R.status || !R.calha.pronta) return null;
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
    estadoCalha: estadoCalha,
    EXIBICAO: EXIBICAO,
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
