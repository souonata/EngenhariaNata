/*
 * Calha 10844 — modo simples: entradas em linguagem comum → estado do projeto → resultado.
 * Não há cálculo próprio aqui. As entradas viram o mesmo estado do modo avançado, a seção é
 * dimensionada pelo mesmo caminho do botão do passo B.3 (dimensionarCalha, que deixa a lâmina
 * no início do ábaco) e o resultado é o de calcularProjeto. Sem DOM: calha-simples-app.js mostra.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? [require('./nbr10844-calc.js'), require('./calha-util.js'), require('./calha-estado.js'), require('./calha-projeto.js')]
    : [root.NBR10844, root.CalhaUtil, root.CalhaEstado, root.CalhaProjeto];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaSimples = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, U, E, P) {
  'use strict';

  const DD = N.DADOS;
  const { nf, na, num, normaliza } = U;

  // O que o modo simples fixa por conta própria, cada um dito uma vez no resultado. O que é
  // critério do app ou dado de fabricante vem dito como tal.
  const PADROES = [
    'Calha de chapa de aço galvanizado. A conta vale igual para PVC, que tem a mesma rugosidade na norma.',
    'Caimento da calha de 0,5%, o mínimo da norma.',
    'Água até ⅔ da altura da calha, com ⅓ de folga contra transbordamento: critério do app, a norma não fixa esse valor.',
    'Saída da calha em furo simples, de borda reta: critério do app. A saída com funil, que permite cano menor, está no modo avançado.',
    'Cano de descida de PVC Série Normal, com o diâmetro interno do catálogo Tigre e Amanco (dado de fabricante).',
  ];

  // Entradas do modo simples → campo da tela, para levar o foco ao que falta.
  const CAMPOS = {
    cidade: '#s-busca', areaProj: '#s-area', Ilocal: '#s-ilocal', mureta: '#s-mureta',
    Lc: '#s-Lc', largura: '#s-largura', altura: '#s-altura', Lcond: '#s-Lcond', nDescidas: '#s-n',
  };
  const SAIDAS = { ponta: 'ponta', meio: 'intermediaria', duas: 'duas-pontas', varias: 'espacadas' };
  const SUCESSO = 'Esta calha dá conta da chuva de projeto.';

  function entradasVazias() {
    return {
      localId: '', semTabela: '', areaProj: '', Ilocal: '', fonteChuva: '',
      posicao: 'beiral', mureta: '',
      Lc: '', largura: '', altura: '', Lcond: '',
      descidas: 'ponta', nDescidas: 3, forma: 'retangular',
    };
  }
  // A água principal do exemplo do modo avançado (residência em Curitiba).
  function exemplo() {
    return Object.assign(entradasVazias(), { localId: E.idLocal('Curitiba/PR'), Lc: 12, largura: 5, altura: 1.5, Lcond: 3, descidas: 'meio' });
  }

  // Calha atrás de mureta: se transbordar, a água entra na construção (5.1.2, T = 25 anos).
  function periodo(ent) { return ent.posicao === 'platibanda' ? 25 : 5; }

  function cidade(id) {
    return DD.TABELA5.find(function (l) { return l.id === Number(id); }) || null;
  }
  // Cidades da Tabela 5 cujo nome contém o texto (sem acentos); as que começam por ele primeiro.
  function buscarCidades(q, max) {
    const f = normaliza(String(q || '').trim());
    if (f.length < 2) return [];
    const comeca = function (l) { return normaliza(l.local).indexOf(f) === 0 ? 0 : 1; };
    return DD.TABELA5.filter(function (l) { return normaliza(l.local).indexOf(f) >= 0; })
      .sort(function (a, b) { return comeca(a) - comeca(b); })
      .slice(0, max || 8);
  }

  function passo1Pronto(ent) {
    if (ent.semTabela === 'pequena') return num(ent.areaProj) > 0;
    if (ent.semTabela === 'local') return num(ent.Ilocal) > 0;
    return !!cidade(ent.localId);
  }

  // O que falta ou está errado nas entradas, na ordem da tela e em palavras comuns.
  function faltas(ent) {
    const out = [];
    const medida = function (campo, nome, podeZero) {
      const v = ent[campo];
      if (v === '' || v == null) out.push({ campo: campo, texto: nome, classe: 'incompleta' });
      else if (!(Number(v) >= 0)) out.push({ campo: campo, texto: nome + ': o valor não pode ser negativo', classe: 'invalida' });
      else if (Number(v) === 0 && !podeZero) out.push({ campo: campo, texto: nome + ': o valor precisa ser maior que zero', classe: 'incompleta' });
    };
    if (ent.semTabela === 'pequena') medida('areaProj', 'área da construção vista de cima');
    else if (ent.semTabela === 'local') medida('Ilocal', 'chuva forte da sua cidade');
    else if (!cidade(ent.localId)) out.push({ campo: 'cidade', texto: 'cidade da obra', classe: 'incompleta' });
    medida('Lc', 'comprimento da calha');
    medida('largura', 'largura da água do telhado');
    medida('altura', 'altura da cumeeira', true);
    if (ent.posicao === 'platibanda') medida('mureta', 'altura da mureta acima do telhado');
    medida('Lcond', 'altura da calha até o chão');
    if (ent.descidas === 'varias') {
      const n = Number(ent.nDescidas);
      if (!(Number.isInteger(n) && n >= 2)) {
        out.push({ campo: 'nDescidas', texto: 'número de descidas (2 ou mais)', classe: ent.nDescidas === '' || ent.nDescidas == null ? 'incompleta' : 'invalida' });
      }
    }
    return out;
  }

  // As entradas viram o estado do modo avançado: uma calha, a água de telhado da Figura 2(b)
  // e, atrás de mureta, a face interna dela, Figura 2(c) (como a posição "platibanda" do avançado).
  function montarEstado(ent) {
    const e = E.estadoVazio();
    const c = e.calhas[0];
    const T = periodo(ent);
    e.T = T;
    if (ent.semTabela === 'pequena') {
      e.modoI = 'pequena';
      e.areaProj = ent.areaProj;
    } else if (ent.semTabela === 'local') {
      e.modoI = 'manual';
      e.Imanual = ent.Ilocal;
      e.Tmanual = T;
      e.fonteChuva = ent.fonteChuva || '';
    } else {
      e.modoI = 'tabela';
      e.localId = cidade(ent.localId) ? Number(ent.localId) : '';
    }
    const plat = ent.posicao === 'platibanda';
    const Lc = ent.Lc;
    Object.assign(c, {
      posicao: plat ? 'platibanda' : 'beiral',
      tipoCalha: plat ? 'platibanda' : 'beiral',
      superficies: [{ tipo: 'b', v: { a: ent.largura, h: ent.altura, b: Lc } }],
      Lc: Lc,
      saidas: SAIDAS[ent.descidas] || 'ponta',
      xSaida: ent.descidas === 'meio' && num(Lc) > 0 ? num(Lc) / 2 : '',
      nSaidas: ent.descidas === 'varias' ? ent.nDescidas : 2,
      material: 'aco-galvanizado', decl: 0.5, fracLamina: '0.6667', saida: 'a',
      forma: ent.forma === 'semicircular' ? 'semicircular' : 'retangular',
      otima: ent.forma !== 'semicircular',
      Lcond: ent.Lcond,
    });
    if (plat) c.superficies.push({ tipo: 'c', v: { a: ent.mureta, b: Lc } });
    e.materialV = 'pvc';
    e.linhaV = 'pvc-sn';
    return e;
  }

  // O mesmo caminho do botão "Calcular a altura mínima" / "Escolher o menor diâmetro": a menor
  // seção comercial que escoa a vazão e deixa a lâmina limite em pelo menos 50 mm.
  function dimensionar(e) {
    const c = e.calhas[0];
    const R0 = P.calcularCalha(e, c, P.calcularChuva(e));
    if (!(R0.Qcalha > 0) || !(R0.calha.i > 0)) return null;
    const r = N.dimensionarCalha({ forma: c.forma, dims: {}, Q: R0.Qcalha, n: R0.calha.n, i: R0.calha.i, fracLamina: R0.calha.frac, otima: c.otima });
    if (c.forma === 'retangular') {
      c.b = Math.round(r.dims.b * 1000);
      c.h = Math.round(r.dims.h * 1000);
    } else if (r.dims) {
      c.Dcalha = Math.round(r.dims.D * 1000);
    }
    return r;
  }

  const TOM = { atende: 'ok', ressalva: 'ressalva', incompleta: 'falta' };
  // Só "atende" é sucesso; "ressalva" mostra o resultado com o aviso; o resto é problema.
  function tomDe(situacao) { return TOM[situacao] || 'erro'; }

  // Avisos do motor que o modo simples reescreve em palavras comuns; os outros passam como estão.
  function emPalavras(a, ctx) {
    const lin = ctx.linha;
    switch (a.codigo) {
      case 'CHUVA_T_DADO_MENOR':
        return 'A tabela da norma para ' + lin.local + ' só tem medições de ' + lin.Treal[ctx.T] + ' anos para a chuva de ' + ctx.T +
          ' anos. O resultado vale, com essa ressalva.';
      case 'CHUVA_SEM_FONTE':
        return 'Anote de onde veio o valor da chuva (estudo, prefeitura ou órgão do estado): sem a fonte, o resultado fica com ressalva.';
      case 'CHUVA_SEM_DADO_T':
      case 'CHUVA_INCONSISTENTE':
        return 'A tabela da norma não tem um valor confiável da chuva de ' + ctx.T + ' anos para ' + lin.local +
          '. Informe a chuva da sua cidade em "Minha cidade não está na lista" ou use o modo avançado.';
      case 'CHUVA_PROJECAO_ACIMA':
        return 'O valor de 150 mm/h sem dado da cidade só vale para construções de até 100 m² vistas de cima. Escolha a cidade na lista ou informe a chuva da sua cidade.';
      case 'CHUVA_PROJECAO_SUPERFICIES':
        return 'O telhado informado passa de 100 m² visto de cima, e o valor de 150 mm/h sem dado da cidade só vale até 100 m². Escolha a cidade na lista ou informe a chuva da sua cidade.';
      default:
        return a.texto;
    }
  }

  function avisosDa(Pj, R, classe) {
    return [Pj.chuva.avisos51, R.avisos53, R.calha.avisos, R.vert.avisos].reduce(function (acc, l) {
      return acc.concat((l || []).filter(function (a) { return a.classe === classe; }));
    }, []);
  }

  function textoChuva(Pj, ent) {
    const I = Pj.chuva.I;
    if (ent.semTabela === 'pequena') return nf(I.I) + ' mm/h, o valor da norma para construções de até 100 m² vistas de cima';
    if (ent.semTabela === 'local') return nf(I.I) + ' mm/h, informada por você' + (String(ent.fonteChuva || '').trim() ? ' (' + String(ent.fonteChuva).trim() + ')' : '');
    return nf(I.I) + ' mm/h em ' + I.linha.local + ': a chuva forte de 5 minutos que volta, em média, a cada ' + I.T + (I.T === 1 ? ' ano' : ' anos');
  }

  // Números do resultado já em texto, para a tela e para os testes lerem a mesma coisa.
  function resultadoDe(Pj, R, ent) {
    const k = R.calha;
    const t = R.vert.adocao.tubo;
    const n = R.dist.n;
    const L = num(ent.Lcond);
    const semi = k.forma === 'semicircular';
    const secao = semi ? { D: k.dims.D * 1000 } : { b: k.dims.b * 1000, h: k.dims.h * 1000 };
    return {
      forma: k.forma,
      secao: secao,
      y: k.y * 1000,
      yLim: k.yLim * 1000,
      H: R.H,
      descidas: n,
      tubo: { dn: t.dn, di: t.di },
      calha: semi
        ? { rotulo: 'Meia-cana', valor: nf(secao.D) + ' mm', detalhe: 'diâmetro' }
        : { rotulo: 'Calha retangular', valor: nf(secao.b) + ' × ' + nf(secao.h) + ' mm', detalhe: 'largura × altura' },
      descida: {
        rotulo: n === 1 ? '1 cano de descida' : n + ' canos de descida',
        valor: t.dn ? 'DN ' + t.dn : 'Di ' + na(t.di) + ' mm',
        detalhe: 'PVC, diâmetro interno ' + na(t.di) + ' mm · ' + na(L) + ' m ' + (n === 1 ? '' : 'cada'),
      },
      caimento: {
        rotulo: 'Caimento da calha',
        valor: na(k.i * 100) + '%',
        detalhe: nf(k.i * 1000) + ' mm a cada metro' + (k.desnivel != null ? ' · ' + nf(k.desnivel * 100, 1) + ' cm no trecho mais longo até a descida' : ''),
      },
      agua: 'Na chuva de projeto, a água sobe ' + nf(k.y * 1000) + ' mm na calha, dentro do limite de ' + nf(k.yLim * 1000) + ' mm.',
      numeros: [
        'Chuva de projeto: ' + textoChuva(Pj, ent) + '.',
        'Área que escoa para a calha: ' + nf(R.A, 1) + ' m².',
        'Água que chega à calha: ' + nf(R.Q, 0) + ' L/min' + (n > 1 ? '; cada descida recebe ' + nf(R.Qcond, 0) + ' L/min' : '') + '.',
      ],
    };
  }

  // Título, mensagens e a ação sugerida para cada situação. O título de sucesso só sai em "atende".
  function textos(res, ent) {
    const R = res.R;
    const Pj = res.P;
    const ctx = { linha: Pj.chuva.I.linha, T: res.T };
    const s = res.situacao;
    if (s === 'atende') return { titulo: SUCESSO, mensagens: [] };
    if (s === 'ressalva') {
      return { titulo: 'Atende, com uma ressalva.', mensagens: avisosDa(Pj, R, 'ressalva').map(function (a) { return emPalavras(a, ctx); }) };
    }
    if (s === 'sem_suporte') {
      return { titulo: 'Falta um dado de chuva que a norma aceite.', mensagens: avisosDa(Pj, R, 'sem_suporte').map(function (a) { return emPalavras(a, ctx); }) };
    }
    const dim = res.dimensionamento;
    if (dim && dim.semTabela) {
      return {
        titulo: 'A meia-cana não serve para esta calha.',
        mensagens: ['As meias-canas da norma vão de 100 a 200 mm, e nenhuma dá conta desta água (seriam ' + nf(dim.Dmin * 1000) + ' mm). Use a calha retangular ou mais descidas.'],
        acao: { tipo: 'forma', forma: 'retangular', rotulo: 'Usar a calha retangular' },
      };
    }
    const v = R.vert;
    if (s === 'fora_do_dominio' && v.pronto && (v.fora === 'D' || v.fora === 'Q')) {
      return v.sugestao
        ? {
          titulo: 'Uma descida só não dá conta.',
          mensagens: ['Com ' + v.sugestao.n + ' descidas espaçadas ao longo da calha, cada cano leva a sua parte da água.'],
          acao: { tipo: 'descidas', n: v.sugestao.n, rotulo: 'Usar ' + v.sugestao.n + ' descidas' },
        }
        : { titulo: 'Este caso pede o modo avançado.', mensagens: ['A água é demais para os canos que a norma calcula: no modo avançado dá para dividir o telhado em mais calhas.'] };
    }
    if (s === 'fora_do_dominio' && v.fora === 'L') {
      return { titulo: 'A descida é curta demais.', mensagens: ['A norma não calcula canos com menos de 30 cm. Confira a altura da calha até o chão.'], alvo: CAMPOS.Lcond };
    }
    const diag = Pj.diagnosticos.filter(function (d) { return d.classe === s && /^Calha/.test(d.nome); }).map(function (d) { return d.texto; });
    if (s === 'fora_do_dominio' || s === 'nao_atende' || s === 'invalida') {
      return { titulo: s === 'nao_atende' ? 'Não atende.' : 'Este caso pede o modo avançado.', mensagens: diag };
    }
    return { titulo: 'Falta um dado.', mensagens: diag.length ? diag : ['Abra no modo avançado para ver o que falta.'] };
  }

  function resolver(ent) {
    const e = montarEstado(ent);
    const f = faltas(ent);
    const res = { entradas: ent, estado: e, faltas: f, T: periodo(ent), mostrarResultado: false, mensagens: [] };
    if (f.length) {
      const inval = f.filter(function (x) { return x.classe === 'invalida'; });
      res.situacao = inval.length ? 'invalida' : 'incompleta';
      res.tom = tomDe(res.situacao);
      res.titulo = inval.length ? 'Confira os valores.' : 'Falta preencher: ' + f.map(function (x) { return x.texto; }).join(', ') + '.';
      res.mensagens = inval.map(function (x) { return x.texto.charAt(0).toUpperCase() + x.texto.slice(1) + '.'; });
      res.alvo = CAMPOS[(inval[0] || f[0]).campo];
      return res;
    }
    res.dimensionamento = dimensionar(e);
    res.P = P.calcularProjeto(e);
    res.R = res.P.calhas[0];
    res.situacao = res.R.estado;
    res.tom = tomDe(res.situacao);
    res.mostrarResultado = res.situacao === 'atende' || res.situacao === 'ressalva';
    if (res.mostrarResultado) res.resultado = resultadoDe(res.P, res.R, ent);
    return Object.assign(res, textos(res, ent));
  }

  // O mesmo formato do "Copiar link do cálculo" do modo avançado, que o lê ao abrir.
  function codificar(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
  function decodificar(s) { return JSON.parse(decodeURIComponent(escape(atob(s)))); }
  function linkAvancado(estado) { return 'avancado.html#s=' + encodeURIComponent(codificar(estado)); }

  return {
    PADROES: PADROES,
    CAMPOS: CAMPOS,
    SUCESSO: SUCESSO,
    entradasVazias: entradasVazias,
    exemplo: exemplo,
    periodo: periodo,
    cidade: cidade,
    buscarCidades: buscarCidades,
    passo1Pronto: passo1Pronto,
    faltas: faltas,
    montarEstado: montarEstado,
    dimensionar: dimensionar,
    tomDe: tomDe,
    resolver: resolver,
    codificar: codificar,
    decodificar: decodificar,
    linkAvancado: linkAvancado,
  };
});
