/*
 * Calha 10844 — formato do estado do projeto (versão 3), exemplos prontos e
 * migração dos formatos antigos. Funções puras: o estado vivo fica em calha-app.js.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node ? [require('./nbr10844-calc.js'), require('./calha-util.js')] : [root.NBR10844, root.CalhaUtil];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaEstado = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, U) {
  'use strict';

  const DD = N.DADOS;
  const { esc, nf, na, num, z, lerNum, mostrarNum, lerLista, normaliza, uid, copia, MAT_C, MAT_H, matCalha, matHor, tubosPadrao, avisosHtml, grande, pares, nota, aguardando, cabecalho, descSecao, ROTULO_STATUS, seloStatus } = U;

  /* ------------------------------------------------------------------ */
  /* Estado: campos do projeto + lista de calhas + trechos de coletor    */
  /* ------------------------------------------------------------------ */

  function novaCalha(nome) {
    return {
      id: uid(), nome: nome || 'Calha 1',
      superficies: [{ tipo: 'b', v: { a: '', h: '', b: '' } }],
      Lc: '', saidas: 'ponta', xSaida: '', nSaidas: 2, listaSaidas: '', curva: 'nenhuma', faixa: 'ate2m',
      tipoCalha: 'beiral', material: 'aco-galvanizado', decl: 0.5, forma: 'retangular',
      b: '', h: '', Dcalha: '', bt: '', z: 0.5, ht: '', fracLamina: '0.6667', otima: false,
      espessura: 0.5, abas: 40,
      saida: 'a', fonteH: 'limite', Hlam: '', Lcond: '',
    };
  }
  function novoTrecho(nome, ids) {
    // linha 'auto': coletor NBR 7362 enterrado e Série Normal aparente (PVC); Tabela 4 nos demais.
    return { id: uid(), nome: nome || 'Trecho', calhas: ids || [], Qextra: '', material: 'pvc', decl: 1, comp: '', instalacao: 'enterrado', linha: 'auto', tubosH: '' };
  }
  function estadoVazio() {
    const c = novaCalha('Calha 1');
    return {
      versao: 3, projeto: '',
      modoI: 'tabela', localId: '', T: 5, areaProj: '', Imanual: '', Tmanual: '', fonteChuva: '',
      idfK: '', idfA: '', idfB: '', idfC: '',
      // Condutores verticais: linha do catálogo; `tubos` são os que o usuário informa (linha 'usuario').
      materialV: 'pvc', linhaV: 'pvc-sn', tubos: [],
      calhas: [c], ativa: c.id,
      trechos: [novoTrecho('Coletor 1', [c.id])],
    };
  }
  function idLocal(nome) {
    const l = DD.TABELA5.find(function (x) { return x.local === nome; });
    return l ? l.id : '';
  }

  const EXEMPLOS = {
    residencia: function () {
      const e = estadoVazio();
      const c = e.calhas[0];
      e.projeto = 'Residência unifamiliar, Curitiba/PR (exemplo)';
      e.localId = idLocal('Curitiba/PR');
      e.areaProj = 90;
      Object.assign(c, {
        nome: 'Beiral da frente',
        superficies: [{ tipo: 'b', v: { a: 5, h: 1.5, b: 12 } }, { tipo: 'c', v: { a: 2, b: 4 } }],
        Lc: 12, saidas: 'intermediaria', xSaida: 4, b: 120, h: 80, Lcond: 3,
      });
      Object.assign(e.trechos[0], { nome: 'Coletor da frente', comp: 8 });
      return { estado: e, nome: 'uma residência em Curitiba' };
    },
    galpao: function () {
      const e = estadoVazio();
      const c1 = e.calhas[0];
      e.projeto = 'Galpão 20 × 30 m, São Paulo/SP (exemplo)';
      e.localId = idLocal('São Paulo/SP (Mirante Santana)');
      Object.assign(c1, {
        nome: 'Água leste', superficies: [{ tipo: 'b', v: { a: 10, h: 1.5, b: 30 } }],
        Lc: 30, saidas: 'duas-pontas', b: 200, h: 120, Lcond: 6,
      });
      const c2 = Object.assign(copia(c1), { id: uid(), nome: 'Água oeste' });
      e.calhas.push(c2);
      e.trechos = [
        Object.assign(novoTrecho('Trecho A (água leste)', [c1.id]), { comp: 30 }),
        Object.assign(novoTrecho('Trecho B (as duas águas)', [c1.id, c2.id]), { comp: 15 }),
      ];
      return { estado: e, nome: 'um galpão em São Paulo' };
    },
    sobrado: function () {
      const e = estadoVazio();
      const c1 = e.calhas[0];
      e.projeto = 'Sobrado com platibanda, Porto Alegre/RS (exemplo)';
      e.localId = idLocal('Porto Alegre/RS');
      e.T = 25;
      Object.assign(c1, {
        nome: 'Platibanda da frente', tipoCalha: 'platibanda',
        superficies: [{ tipo: 'b', v: { a: 6, h: 1.2, b: 10 } }, { tipo: 'c', v: { a: 0.8, b: 10 } }],
        Lc: 10, saidas: 'intermediaria', xSaida: 5, curva: 'canto-reto', faixa: 'de2a4m', b: 200, h: 120, Lcond: 6,
      });
      const c2 = Object.assign(copia(c1), {
        id: uid(), nome: 'Platibanda dos fundos',
        superficies: [{ tipo: 'b', v: { a: 6, h: 1.2, b: 8 } }, { tipo: 'c', v: { a: 0.8, b: 8 } }],
        Lc: 8, saidas: 'ponta', curva: 'nenhuma',
      });
      e.calhas.push(c2);
      e.trechos = [Object.assign(novoTrecho('Coletor único', [c1.id, c2.id]), { comp: 18 })];
      return { estado: e, nome: 'um sobrado com platibanda em Porto Alegre' };
    },
  };

  const MAPA_MAT_C = { plastico: 'aco-galvanizado', ferro: 'concreto-alisado', ceramica: 'concreto-bruto', tijolo: 'alvenaria-tijolo' };
  const MAPA_MAT_H = { plastico: 'pvc', ferro: 'ferro-fundido', ceramica: 'ceramica', tijolo: 'concreto' };
  const MAPA_SAIDAS = { extremidade: 'ponta', multiplas: 'espacadas' };

  function validar(e) {
    if (!e.calhas.length) e.calhas = [novaCalha('Calha 1')];
    e.calhas.forEach(function (c) {
      if (!MAT_C.some(function (m) { return m.id === c.material; })) c.material = MAT_C[0].id;
      // As opções "lâmina calculada" e "digitar" saíram na 3.7.1: H é sempre a lâmina limite.
      c.fonteH = 'limite';
    });
    if (!DD.MATERIAIS_VERTICAL.some(function (m) { return m.id === e.materialV; })) e.materialV = DD.MATERIAIS_VERTICAL[0].id;
    if (!Array.isArray(e.tubos)) e.tubos = [];
    const linhaV = DD.LINHAS_TUBO.find(function (l) { return l.id === e.linhaV; });
    if (e.linhaV !== 'usuario' && !(linhaV && linhaV.usos.indexOf('vertical') >= 0)) e.linhaV = 'pvc-sn';
    e.trechos.forEach(function (t) {
      if (!MAT_H.some(function (m) { return m.id === t.material; })) t.material = MAT_H[0].id;
      if (t.instalacao !== 'aparente') t.instalacao = 'enterrado';
      const l = DD.LINHAS_TUBO.find(function (x) { return x.id === t.linha; });
      if (['auto', 'usuario', 'tabela4'].indexOf(t.linha) < 0 && !(l && l.usos.indexOf('horizontal') >= 0)) t.linha = 'auto';
      if (typeof t.tubosH !== 'string') t.tubosH = '';
      t.calhas = t.calhas.filter(function (id) { return e.calhas.some(function (c) { return c.id === id; }); });
    });
    if (!e.calhas.some(function (c) { return c.id === e.ativa; })) e.ativa = e.calhas[0].id;
    return e;
  }

  // Antes do catálogo (3.6.x e anteriores) havia uma só lista de tubos, com Di aproximados de
  // PVC. A lista intacta vira a Série Normal do catálogo; uma lista editada continua valendo,
  // como tubos informados pelo usuário. Material sem catálogo não herda os Di de PVC.
  const TUBOS_ANTIGOS = [[75, 72], [100, 97], [150, 146], [200, 194]];
  function migrarTubos(e, s) {
    if (s.linhaV !== undefined) return;
    const t = Array.isArray(s.tubos) ? s.tubos : null;
    const intacta = !t || (t.length === TUBOS_ANTIGOS.length && t.every(function (x, k) {
      return Number(x.dn) === TUBOS_ANTIGOS[k][0] && Number(x.di) === TUBOS_ANTIGOS[k][1];
    }));
    if (intacta) {
      e.linhaV = e.materialV === 'pvc' ? 'pvc-sn' : 'usuario';
      e.tubos = [];
    } else {
      e.linhaV = 'usuario';
      e.tubos = t.map(function (x) { return { dn: x.dn, di: x.di }; });
    }
  }

  function migrar(s) {
    if (s.versao === 3) {
      const e = Object.assign(estadoVazio(), s);
      e.calhas = (s.calhas || []).map(function (c) { return Object.assign(novaCalha(), c); });
      e.trechos = (s.trechos || []).map(function (t) { return Object.assign(novoTrecho(), t); });
      migrarTubos(e, s);
      return validar(e);
    }
    // Versões 1 e 2: uma calha só, com os campos soltos no estado.
    const v = Object.assign({}, s);
    if (!v.versao) {
      if (MAPA_MAT_C[v.material]) v.material = MAPA_MAT_C[v.material];
      if (MAPA_MAT_H[v.materialH]) v.materialH = MAPA_MAT_H[v.materialH];
      if (MAPA_SAIDAS[v.saidas]) v.saidas = MAPA_SAIDAS[v.saidas];
      v.fonteH = 'limite';
    }
    const e = estadoVazio();
    ['projeto', 'modoI', 'localId', 'T', 'areaProj', 'Imanual', 'Tmanual', 'idfK', 'idfA', 'idfB', 'idfC', 'tubos'].forEach(function (k) {
      if (v[k] !== undefined) e[k] = v[k];
    });
    const c = e.calhas[0];
    Object.keys(c).forEach(function (k) { if (k !== 'id' && k !== 'nome' && v[k] !== undefined) c[k] = v[k]; });
    const t = e.trechos[0];
    if (v.materialH) t.material = v.materialH;
    if (v.declH !== undefined) t.decl = v.declH;
    if (v.QHauto === false) { t.calhas = []; t.Qextra = v.QH; }
    migrarTubos(e, v);
    return validar(e);
  }

  return {
    novaCalha: novaCalha,
    novoTrecho: novoTrecho,
    estadoVazio: estadoVazio,
    idLocal: idLocal,
    EXEMPLOS: EXEMPLOS,
    validar: validar,
    migrar: migrar,
  };
});
