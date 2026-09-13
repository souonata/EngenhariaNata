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
  const { esc, nf, na, num, z, lerNum, mostrarNum, lerLista, normaliza, uid, copia, MAT_C, MAT_H, matCalha, matHor, tubosPadrao, linhaTubo, tubosDaLinha, rotuloTubo, avisosHtml, grande, pares, nota, aguardando, cabecalho, descSecao, ROTULO_STATUS, seloStatus } = U;

  /* ------------------------------------------------------------------ */
  /* Tubos: linha do catálogo, Tabela 4 ou tubos informados              */
  /* ------------------------------------------------------------------ */

  // Condutores verticais: a linha do catálogo existe só para PVC; os demais materiais usam os
  // tubos que o usuário informa. Sem nenhum, o app não inventa um Di (plano, seção 3.2, regra 6).
  function linhaVertical(estado) {
    return estado.materialV === 'pvc' && estado.linhaV && estado.linhaV !== 'usuario' ? estado.linhaV : 'usuario';
  }
  function tubosVerticais(estado) {
    const id = linhaVertical(estado);
    if (id !== 'usuario') return tubosDaLinha(id, 'vertical').map(function (t) { return Object.assign({}, t); });
    return (estado.tubos || []).filter(function (t) { return num(t.di) > 0; }).map(function (t) {
      return { dn: num(t.dn) > 0 ? num(t.dn) : null, di: num(t.di), linha: 'usuario', origem: 'usuario' };
    });
  }
  // Coletor: 'auto' é o coletor NBR 7362 enterrado e a Série Normal aparente (PVC); sem
  // catálogo, os diâmetros da Tabela 4 como Di, com ressalva para confirmar o tubo.
  function linhaDoTrecho(t) {
    const pvc = t.material === 'pvc';
    const l = t.linha || 'auto';
    if (l === 'auto') return pvc ? (t.instalacao === 'aparente' ? 'pvc-sn' : 'pvc-7362') : 'tabela4';
    if (!pvc && l !== 'usuario') return 'tabela4';
    return l;
  }
  // "Tubo de concreto" → "tubo de concreto"; "Ferro fundido" → "tubo de ferro fundido"; siglas ficam.
  function tuboDoMaterial(rotulo) {
    const r = String(rotulo).replace(/^tubo de /i, '');
    return 'tubo de ' + (/^[A-Z]{2,}/.test(r) ? r : r.charAt(0).toLowerCase() + r.slice(1));
  }
  function tubosTrecho(t) {
    const id = linhaDoTrecho(t);
    if (id === 'tabela4') return DD.TABELA4.diametros.map(function (D) { return { dn: null, di: D, linha: 'tabela4', origem: 'norma' }; });
    if (id === 'usuario') {
      return lerLista(t.tubosH).filter(function (x) { return x > 0; }).map(function (x) { return { dn: null, di: x, linha: 'usuario', origem: 'usuario' }; });
    }
    return tubosDaLinha(id, 'horizontal').map(function (x) { return Object.assign({}, x); });
  }

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
    const tubos = tubosVerticais(estado);
    const linhaV = linhaVertical(estado);
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
      if (!R.vert.fora && !tubos.length) R.vert.adocao.semTubos = true;
      if (R.vert.adocao.tubo) R.vert.folga = R.vert.adocao.tubo.di / R.vert.adocao.minimo - 1;
      if (tubos.length && (R.vert.fora === 'D' || R.vert.fora === 'Q' || (!R.vert.fora && !R.vert.adocao.tubo))) {
        R.vert.sugestao = N.sugerirSaidas({ Q: R.Q, H: H, L: Lv, saida: e.saida, tubos: tubos });
      }
      if (e.fonteH === 'digitada' && R.calha.pronta && H > R.calha.yLim * 1000 + 1e-9) {
        R.vert.avisos.push({ nivel: 'erro', classe: 'nao_atende', codigo: 'H_ACIMA_LIMITE', texto: 'H = ' + nf(H) + ' mm passa da lâmina limite adotada na calha (' + nf(R.calha.yLim * 1000) + ' mm): com essa lâmina a calha não atende ao próprio critério.' });
      }
    } else {
      R.vert.faltando = !(H > 0) ? 'H' : !(Lv > 0) ? 'L' : 'Q';
    }
    R.vert.linha = linhaV;
    R.vert.nTubos = tubos.length;
    // Sem catálogo do material e sem tubos informados: pede os tubos, não inventa um Di.
    if (!tubos.length) {
      const minimo = R.vert.adocao && Number.isFinite(R.vert.adocao.minimo) ? ' O ábaco pede Di ≥ ' + nf(R.vert.adocao.minimo) + ' mm.' : '';
      R.vert.avisos.push({
        nivel: 'erro', classe: 'incompleta', codigo: 'TUBOS_V_FALTA',
        texto: 'Informe os tubos de ' + matVertical(estado).toLowerCase() + ' que você vai comprar (DN e diâmetro interno do catálogo).' + minimo,
      });
    }
    const pequenos = linhaV === 'usuario' ? tubos.filter(function (t) { return t.di < DD.DIAMETRO_MINIMO_VERTICAL; }) : [];
    if (pequenos.length) {
      R.vert.avisos.push({
        nivel: 'info', classe: 'informativa', codigo: 'TUBO_V_MENOR_70',
        texto: pequenos.map(rotuloTubo).join(', ') + ': diâmetro interno abaixo de 70 mm não serve para condutor vertical (5.6.3) e fica fora da escolha.',
      });
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
    else if (!v.adocao.tubo) sobe(v.adocao.semTubos ? 'incompleta' : 'nao_atende');
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
    T.linha = linhaDoTrecho(t);
    T.linhaInfo = linhaTubo(T.linha);
    T.tubos = tubosTrecho(t);
    if (T.Q > 0 && T.i > 0 && T.tubos.length) Object.assign(T, N.condutorHorizontal({ Q: T.Q, n: T.n, i: T.i, tubos: T.tubos }), { pronto: true });
    if (T.linha === 'usuario' && !T.tubos.length) {
      T.avisos.push({ nivel: 'erro', classe: 'incompleta', codigo: 'TUBOS_H_FALTA', texto: 'Informe os diâmetros internos dos tubos disponíveis (mm), separados por ponto e vírgula.' });
    }
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
    if (T.pronto && !T.escolhido) {
      const maior = T.linhas[T.linhas.length - 1];
      T.avisos.push({
        nivel: 'erro', classe: 'nao_atende', codigo: 'TUBO_H_INSUFICIENTE',
        texto: 'Nenhum tubo da linha "' + T.linhaInfo.curto + '" basta: o maior, ' + rotuloTubo(maior) + ', leva ' + nf(maior.Q, 0) + ' L/min. Divida o coletor, aumente a declividade ou escolha outra linha.',
      });
    }
    if (T.escolhido) {
      // Grandezas de margem (plano, seção 3.8): uso = Q / capacidade; margem = capacidade / Q − 1.
      T.uso = T.Q / T.escolhido.Q;
      T.margem = T.escolhido.Q / T.Q - 1;
      if (T.linha === 'tabela4') {
        T.avisos.push({
          nivel: 'atencao', classe: 'ressalva', codigo: 'TUBO_DI_TABELA4',
          texto: 'O Di de ' + nf(T.escolhido.di) + ' mm é o D da Tabela 4, não de um tubo de catálogo: confirme que o ' + tuboDoMaterial(T.mat.rotulo) +
            ' comprado tem diâmetro interno igual ou maior (o DN não serve para cálculo, 3.11), ou informe os seus tubos.',
        });
      }
    }
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
      if (v.pronto && !v.fora && !v.adocao.tubo && !v.adocao.semTubos) out.push({ nome: nome, classe: 'nao_atende', texto: 'nenhum tubo da lista atende ao ábaco.' });
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
    P.passos = situacaoPassos(P, estado);
    // Linhas de tubo adotadas, com a fonte: vão para o memorial e o PDF.
    const usadas = {};
    Rs.forEach(function (R) { if (R.vert.adocao && R.vert.adocao.tubo) usadas[R.vert.linha] = true; });
    Ts.forEach(function (T) { if (T.escolhido) usadas[T.linha] = true; });
    P.linhasUsadas = Object.keys(usadas).map(linhaTubo);
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

  // O que falta ou falha numa calha, passo a passo (B.1 a B.4): [item, texto, seletor, classe]
  // do primeiro problema de cada passo. Um passo que só espera o anterior não entra.
  const SECAO_ALVO = { retangular: '#b', semicircular: '#Dcalha', trapezoidal: '#bt' };
  function semSecao(c) {
    if (c.forma === 'semicircular') return !(num(c.Dcalha) > 0);
    if (c.forma === 'retangular') return !(num(c.b) > 0 && num(c.h) > 0);
    return !(num(c.bt) > 0 && num(c.ht) > 0);
  }
  function pend52(R) {
    const c = R.c;
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
    return null;
  }
  function pend53(R) {
    const c = R.c;
    const e53 = primeiro(R.avisos53, 'erro');
    if (!e53) return null;
    return ['5.3', e53.texto, e53.codigo === 'SAIDAS_N' ? '#nSaidas' : c.saidas === 'personalizadas' ? '#listaSaidas' : c.saidas === 'intermediaria' && num(c.Lc) > 0 ? '#xSaida' : '#Lc', e53.classe];
  }
  function pend55(R) {
    const c = R.c;
    const k = R.calha;
    const k55 = (k.avisos || []).find(function (a) { return a.classe === 'invalida'; });
    if (k55) return ['5.5', k55.texto, k55.codigo === 'DECL_NEGATIVA' ? '#decl' : k55.codigo === 'Z_NEGATIVO' ? '#z' : SECAO_ALVO[c.forma], 'invalida'];
    if (!(k.i > 0)) return ['5.5', 'informe a declividade da calha.', '#decl'];
    if (semSecao(c)) return ['5.5', 'informe as medidas da seção da calha.', SECAO_ALVO[c.forma]];
    if (!k.pronta) return null;
    const e55 = primeiro(k.avisos, 'erro');
    if (e55) return ['5.5', e55.texto, '#decl', e55.classe];
    if (k.y == null) return ['5.5', 'a seção transborda. Use o botão de dimensionar, aumente a declividade ou ponha mais saídas.', '#btn-dimensionar'];
    if (!k.ok) return ['5.5', 'a lâmina passa do limite adotado. Use o botão de dimensionar ou aumente a declividade.', '#btn-dimensionar'];
    return null;
  }
  function pend56(R) {
    const c = R.c;
    const v = R.vert;
    const semTubos = (v.avisos || []).find(function (a) { return a.codigo === 'TUBOS_V_FALTA'; });
    if (v.invalido) return ['5.6', v.avisos[0].texto, v.faltando === 'L' ? '#Lcond' : '#Hlam', 'invalida'];
    if (!v.pronto) {
      // O comprimento L não depende da calha: é pedido mesmo antes de a lâmina H existir.
      if (v.faltando === 'L' || !(num(c.Lcond) > 0)) return ['5.6', 'informe o comprimento L do condutor vertical.', '#Lcond'];
      if (v.faltando === 'H' && c.fonteH === 'digitada') return ['5.6', 'informe a lâmina H na calha.', '#Hlam'];
      if (semTubos) return ['5.6', semTubos.texto, '#tubos input, #btn-add-tubo', 'incompleta'];
      return null;
    }
    if (v.fora === 'D' || v.fora === 'Q') {
      return ['5.6', v.sugestao ? 'o condutor passa do fim do ábaco: use ' + v.sugestao.n + ' saídas espaçadas.' : primeiro(v.avisos, 'erro').texto, '#r56', 'fora_do_dominio'];
    }
    if (v.fora) return ['5.6', primeiro(v.avisos, 'erro').texto, v.fora === 'L' ? '#Lcond' : c.fonteH === 'digitada' ? '#Hlam' : 'input[name="fonteH"]', 'fora_do_dominio'];
    if (semTubos) return ['5.6', semTubos.texto, '#tubos input, #btn-add-tubo', 'incompleta'];
    if (!v.adocao.tubo) {
      return ['5.6', v.sugestao ? 'nenhum tubo da linha atende: use ' + v.sugestao.n + ' saídas espaçadas.' : 'nenhum tubo da linha atende ao ábaco.', '#r56'];
    }
    const eH = primeiro(v.avisos, 'erro');
    if (eH) return ['5.6', eH.texto, '#Hlam', eH.classe];
    return null;
  }
  function pendenciasCalha(R) {
    return [pend52(R), pend53(R), pend55(R), pend56(R)].filter(Boolean);
  }
  function pendenciaCalha(R) { return pendenciasCalha(R)[0] || null; }

  // Pendências do projeto; a calha ativa vem primeiro. Sem chuva, nada mais adianta.
  function pendencias(P, estado) {
    const out = [];
    const add = function (item, texto, alvo, calhaId, classe) {
      out.push({ item: item, passo: PASSO_DO_ITEM[item], texto: texto, alvo: alvo, calhaId: calhaId || null, classe: classe || null });
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
      else if (!(T.Q > 0)) {
        // Trecho que já recebe calhas só espera a vazão delas (passo B): nada a fazer aqui.
        if (!T.recebe.length) add('5.7', nome + 'marque as calhas que chegam a ele.', '[data-trecho-calha="' + i + '"]');
      }
      else if (!(T.i > 0)) add('5.7', nome + 'informe a declividade.', alvo);
      else {
        const er = primeiro(T.avisos, 'erro');
        if (er) add('5.7', nome + er.texto, er.codigo === 'TUBOS_H_FALTA' ? '[data-trecho="' + i + '"][data-campo="tubosH"]' : er.codigo === 'TUBO_H_INSUFICIENTE' ? '[data-trecho="' + i + '"][data-campo="linha"]' : alvo, null, er.classe);
      }
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Passos do "Como usar": A, B (B.1 a B.4) e C                         */
  /* ------------------------------------------------------------------ */

  const PASSOS = [
    { id: 'A', item: '5.1', secao: '#s51', titulo: 'Intensidade pluviométrica' },
    { id: 'B.1', item: '5.2', secao: '#s52', titulo: 'Áreas de contribuição' },
    { id: 'B.2', item: '5.3', secao: '#s53', titulo: 'Saídas e vazão de projeto' },
    { id: 'B.3', item: '5.5', secao: '#s55', titulo: 'Seção da calha' },
    { id: 'B.4', item: '5.6', secao: '#s56', titulo: 'Condutores verticais' },
    { id: 'C', item: '5.7', secao: '#s57', titulo: 'Coletores horizontais' },
  ];
  const PASSO_DO_ITEM = { '5.1': 'A', '5.2': 'B.1', '5.3': 'B.2', '5.5': 'B.3', '5.6': 'B.4', '5.7': 'C' };

  // 'aguarda' = o passo não tem problema próprio, só espera um anterior. Não pesa na piora.
  function piorPasso(a, b) {
    if (a === 'aguarda') return b === 'atende' ? 'aguarda' : b;
    if (b === 'aguarda') return a === 'atende' ? 'aguarda' : a;
    return N.piorEstado(a, b);
  }
  function comEspera(proprio, pronto) { return proprio !== 'atende' ? proprio : pronto ? 'atende' : 'aguarda'; }

  function estadoPassoCalha(R, id) {
    const k = R.calha;
    const v = R.vert;
    if (id === 'B.1') return N.piorEstado(R.supEstado, R.A > 0 ? 'atende' : 'incompleta');
    if (id === 'B.2') return comEspera(N.situacao(R.avisos53), R.Q > 0);
    if (id === 'B.3') {
      let s = N.situacao(k.avisos);
      if (semSecao(R.c)) s = N.piorEstado(s, 'incompleta');
      if (k.pronta && (k.y == null || !k.ok)) s = N.piorEstado(s, 'nao_atende');
      return comEspera(s, k.pronta);
    }
    let s = N.situacao(v.avisos);
    if (v.invalido) s = N.piorEstado(s, 'invalida');
    else if (v.pronto && v.fora) s = N.piorEstado(s, 'fora_do_dominio');
    else if (v.pronto && !v.adocao.tubo && !v.adocao.semTubos) s = N.piorEstado(s, 'nao_atende');
    else if (!v.pronto && (v.faltando === 'L' || !(num(R.c.Lcond) > 0) || (v.faltando === 'H' && R.c.fonteH === 'digitada'))) s = N.piorEstado(s, 'incompleta');
    return comEspera(s, v.pronto);
  }

  function primeiraRessalva(listas) {
    for (let k = 0; k < listas.length; k++) {
      const a = (listas[k] || []).find(function (x) { return x.classe === 'ressalva'; });
      if (a) return a.texto;
    }
    return null;
  }

  // Situação de cada passo para o "Como usar": estado, o que fazer e para onde levar o clique.
  function situacaoPassos(P, estado) {
    const pend = pendencias(P, estado);
    const multi = P.calhas.length > 1;
    const ordem = [P.ativa].concat(P.calhas.filter(function (r) { return r !== P.ativa; }));
    const out = {};
    const ch = P.chuva;
    const pA = pend.find(function (p) { return p.passo === 'A'; }) || null;
    out.A = { estado: ch.I.I > 0 ? ch.estado : 'incompleta', pend: pA, texto: pA ? pA.texto : primeiraRessalva([ch.avisos51]) };
    ['B.1', 'B.2', 'B.3', 'B.4'].forEach(function (id) {
      const item = PASSOS.find(function (p) { return p.id === id; }).item;
      let s = 'atende';
      let pp = null;
      let ressalva = null;
      ordem.forEach(function (R) {
        s = piorPasso(s, estadoPassoCalha(R, id));
        const x = pendenciasCalha(R).find(function (q) { return q[0] === item; });
        const nome = multi ? (R.c.nome || 'Calha sem nome') + ': ' : '';
        if (x && !pp) pp = { item: item, passo: id, texto: nome + x[1], alvo: x[2], calhaId: R.c.id, classe: x[3] || null };
        if (!ressalva) {
          const r = primeiraRessalva(id === 'B.2' ? [R.avisos53] : id === 'B.3' ? [R.calha.avisos] : id === 'B.4' ? [R.vert.avisos] : []);
          if (r) ressalva = nome + r;
        }
      });
      out[id] = { estado: s, pend: pp, texto: pp ? pp.texto : ressalva };
    });
    let sB = 'atende';
    ['B.1', 'B.2', 'B.3', 'B.4'].forEach(function (id) { sB = piorPasso(sB, out[id].estado); });
    const pB = ['B.1', 'B.2', 'B.3', 'B.4'].map(function (id) { return out[id].pend; }).find(Boolean) || null;
    out.B = { estado: sB, pend: pB, texto: pB ? pB.texto : null };
    let sC = P.trechos.length ? 'atende' : 'incompleta';
    P.trechos.forEach(function (T) { sC = N.piorEstado(sC, T.estado); });
    if (P.semColetor.length) sC = N.piorEstado(sC, 'incompleta');
    const pC = pend.find(function (p) { return p.passo === 'C'; }) || null;
    // Incompleto sem nada a preencher no passo C: os trechos só esperam a vazão das calhas.
    if (sC === 'incompleta' && !pC && P.trechos.length && !P.semColetor.length) sC = 'aguarda';
    out.C = { estado: sC, pend: pC, texto: pC ? pC.texto : primeiraRessalva(P.trechos.map(function (T) { return T.avisos; })) };
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
    partes.push(v.adocao && v.adocao.tubo ? (n > 1 ? n + ' condutores' : '1 condutor') + ' ' + rotuloTubo(v.adocao.tubo) + ' com ' + na(num(c.Lcond)) + ' m' : 'o condutor não tem tubo que atenda');
    if (k.desnivel != null) partes.push('desnível de ' + nf(k.desnivel * 100, 1) + ' cm no maior trecho');
    return { status: R.status, texto: partes.join('; ') + '.' };
  }

  // Levantamento do projeto inteiro, que sai do cálculo. É o mínimo: cantos, emendas,
  // suportes e mudanças de direção do traçado real acrescentam peças. A mesma peça vinda de
  // calhas ou trechos diferentes é somada numa linha; quando há mais de uma origem, a base
  // mostra cada parcela.
  function listaMateriais(P, estado) {
    const matV = matVertical(estado).toLowerCase();
    const idV = linhaVertical(estado);
    const linhaV = idV === 'usuario' ? matV + ', tubo informado' : linhaTubo(idV).curto;
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
        const t = v.adocao.tubo;
        somar(VERTICAIS, 'Condutor vertical ' + (t.dn ? 'DN ' + t.dn : 'Di ' + na(t.di) + ' mm') + ', ' + linhaV + (t.dn ? ' (Di ' + na(t.di) + ' mm)' : ''), R.dist.n * Lv, 'm', '5.6', nome);
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
        const t = T.escolhido;
        const mat = tuboDoMaterial(T.mat.rotulo);
        const desc = T.linha === 'tabela4' ? mat + ' com Di ≥ ' + na(t.di) + ' mm (Tabela 4, confirmar)' :
          T.linha === 'usuario' ? mat + ', Di ' + na(t.di) + ' mm (informado)' : 'tubo DN ' + t.dn + ', ' + T.linhaInfo.curto + ' (Di ' + na(t.di) + ' mm)';
        somar(COLETORES, desc.charAt(0).toUpperCase() + desc.slice(1) + (enterrado ? ', enterrado' : ', aparente'), comp > 0 ? comp : null, 'm', '5.7.2', nome);
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
    linhaVertical: linhaVertical,
    tubosVerticais: tubosVerticais,
    linhaDoTrecho: linhaDoTrecho,
    tubosTrecho: tubosTrecho,
    PASSOS: PASSOS,
    PASSO_DO_ITEM: PASSO_DO_ITEM,
    situacaoPassos: situacaoPassos,
    pendenciasCalha: pendenciasCalha,
    pendencias: pendencias,
    respostaCalha: respostaCalha,
    listaMateriais: listaMateriais,
  };
});
