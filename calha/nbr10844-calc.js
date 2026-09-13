/*
 * Núcleo de cálculo da NBR 10844:1989 — funções puras, sem DOM.
 * Unidades internas: comprimentos em metros, vazões em L/min, I em mm/h.
 * Script clássico: no navegador vira window.NBR10844; em Node, module.exports.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const dados = node ? require('./nbr10844-dados.js') : root.NBR10844_DADOS;
  const abacos = node ? require('./nbr10844-abacos.js') : root.NBR10844_ABACOS;
  const api = factory(dados, abacos);
  if (node) module.exports = api;
  else root.NBR10844 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DADOS, ABACOS) {
  'use strict';

  // Fator de Manning-Strickler da norma (5.5.7): Q em L/min com S em m² e R em m.
  const K = 60000;
  // Duração da chuva de projeto (5.1.3), em minutos.
  const DURACAO = 5;
  // Menor e maior intensidade da Tabela 5: faixa de conferência da equação IDF.
  const FAIXA_T5 = DADOS.TABELA5.reduce(function (f, l) {
    [1, 5, 25].forEach(function (t) {
      if (l.I[t] != null) { f[0] = Math.min(f[0], l.I[t]); f[1] = Math.max(f[1], l.I[t]); }
    });
    return f;
  }, [Infinity, 0]);

  /* ------------------------------------------------------------------ */
  /* Situações (plano de 13/09/2026, seção 3.1)                          */
  /* ------------------------------------------------------------------ */

  // Da mais branda para a mais grave. Só 'atende' e 'ressalva' deixam dizer que atende.
  const ESTADOS = ['atende', 'ressalva', 'nao_atende', 'fora_do_dominio', 'sem_suporte', 'incompleta', 'invalida'];
  function piorEstado(a, b) { return ESTADOS.indexOf(b) > ESTADOS.indexOf(a) ? b : a; }
  // Pior situação de uma lista de avisos; aviso sem classe (ou 'informativa') não conta.
  function situacao(lista) {
    return (lista || []).reduce(function (s, x) { return ESTADOS.indexOf(x.classe) >= 0 ? piorEstado(s, x.classe) : s; }, 'atende');
  }

  /* ------------------------------------------------------------------ */
  /* 5.1 — Intensidade pluviométrica                                     */
  /* ------------------------------------------------------------------ */

  // Equação de chuvas intensas (IDF): i = K·T^a / (t + b)^c, i em mm/h, t em min.
  function intensidadeIDF(p) {
    const Kc = Number(p.K);
    const T = Number(p.T);
    const a = Number(p.a) || 0;
    const b = Number(p.b) || 0;
    const c = Number(p.c) || 0;
    if (!(Kc > 0) || !(T > 0)) return NaN;
    return (Kc * Math.pow(T, a)) / Math.pow((p.t || DURACAO) + b, c);
  }

  // Situação da chuva (decisão D1 de 13/09/2026):
  // - coluna pedida da Tabela 5 com valor de período menor (entre parênteses, nota b) e coerente
  //   com os períodos menores → 'ressalva';
  // - sem valor na coluna, ou valor menor que o de um período menor → 'sem_suporte';
  // - falta dado → 'incompleta'; valor impossível → 'invalida'.
  // Um valor fora da faixa observada da Tabela 5 só é anotado: não é limite da norma.
  function intensidade(p) {
    const avisos = [];
    const aviso = function (nivel, classe, codigo, texto) { avisos.push({ nivel: nivel, classe: classe, codigo: codigo, texto: texto }); };
    const fim = function (r) { r.avisos = avisos; r.estado = situacao(avisos); r.Tpedido = p.T; return r; };
    const atipico = function (I) {
      if (I > FAIXA_T5[1] || I < FAIXA_T5[0]) {
        aviso('atencao', 'informativa', 'CHUVA_ATIPICA',
          'O valor está fora da faixa observada na Tabela 5 para 5 minutos (' + FAIXA_T5[0] + ' a ' + FAIXA_T5[1] + ' mm/h). ' +
          'Não é um limite da norma: confira se o dado está em mm/h e para t = 5 min (há equações em mm/min ou com t em horas).');
      }
    };
    if (p.modo === 'pequena') {
      if (!(p.areaProjecao > 0)) {
        aviso('erro', 'incompleta', 'CHUVA_PROJECAO_FALTA',
          'Informe a área de projeção horizontal da construção: I = 150 mm/h só vale até 100 m² (5.1.4).');
      } else if (p.areaProjecao > DADOS.AREA_PEQUENA) {
        aviso('erro', 'sem_suporte', 'CHUVA_PROJECAO_ACIMA',
          'I = 150 mm/h só vale para construções com até 100 m² de área de projeção horizontal (5.1.4). Use a Tabela 5 ou dados locais.');
      }
      return fim({ I: DADOS.I_PEQUENA_AREA, T: null, fonte: '5.1.4' });
    }
    if (p.modo === 'manual') {
      if (p.valor < 0) aviso('erro', 'invalida', 'CHUVA_VALOR_NEGATIVO', 'A intensidade não pode ser negativa: informe o valor em mm/h.');
      else if (!(p.valor > 0)) aviso('erro', 'incompleta', 'CHUVA_VALOR_FALTA', 'Informe uma intensidade maior que zero.');
      else atipico(p.valor);
      return fim({ I: p.valor > 0 ? p.valor : 0, T: p.T || null, fonte: '5.1.1' });
    }
    if (p.modo === 'idf') {
      const I = intensidadeIDF(p);
      if (!(I > 0)) {
        aviso('erro', 'incompleta', 'CHUVA_IDF_FALTA', 'Informe K, a, b e c da equação de chuvas intensas do local.');
        return fim({ I: 0, T: p.T, fonte: 'equação IDF' });
      }
      atipico(I);
      return fim({ I: I, T: p.T, fonte: 'equação IDF' });
    }
    const linha = DADOS.TABELA5.find(function (l) { return l.id === p.localId; });
    if (!linha) {
      aviso('erro', 'incompleta', 'CHUVA_LOCAL_FALTA', 'Escolha um local.');
      return fim({ I: 0, T: p.T, fonte: 'Tabela 5' });
    }
    const T = p.T;
    const I = linha.I[T];
    if (I == null) {
      // Sem valor para o período pedido: o maior período disponível abaixo dele entra só como
      // referência numérica; a situação fica sem suporte (não comprova conformidade).
      const alternativo = [25, 5, 1].find(function (t) { return t < T && linha.I[t] != null; });
      aviso('erro', 'sem_suporte', 'CHUVA_SEM_DADO_T',
        'A Tabela 5 não traz intensidade para T = ' + T + ' anos em ' + linha.local + '. Os números abaixo usam T = ' +
        linha.Treal[alternativo] + ' anos só como referência e não comprovam conformidade: informe um dado local (5.1.1) em "Valor local".');
      return fim({ I: linha.I[alternativo], T: linha.Treal[alternativo], linha: linha, fonte: 'Tabela 5' });
    }
    const Treal = linha.Treal[T];
    if (Treal !== T) {
      // Nota b: o número entre parênteses é o período de retorno a que o valor se refere.
      const menores = [1, 5].filter(function (t) { return t < T && linha.I[t] != null && linha.I[t] > I; });
      if (menores.length) {
        const t0 = menores[menores.length - 1];
        aviso('erro', 'sem_suporte', 'CHUVA_INCONSISTENTE',
          'Na Tabela 5, o valor de ' + linha.local + ' na coluna de ' + T + ' anos (' + I + ' mm/h) refere-se a T = ' + Treal +
          ' anos (entre parênteses, nota b) e é menor que o de T = ' + t0 + ' anos (' + linha.I[t0] + ' mm/h). O dado não sustenta T = ' +
          T + ' anos: informe um dado local (5.1.1).');
      } else {
        aviso('atencao', 'ressalva', 'CHUVA_T_DADO_MENOR',
          'Na Tabela 5, o valor da coluna de ' + T + ' anos em ' + linha.local + ' refere-se a T = ' + Treal +
          ' anos (entre parênteses, nota b): o posto não tinha observação suficiente para ' + T + ' anos. O resultado fica com ressalva de dado.');
      }
    }
    return fim({ I: I, T: Treal, linha: linha, fonte: 'Tabela 5' });
  }

  /* ------------------------------------------------------------------ */
  /* 5.2 — Área de contribuição (Figura 2)                               */
  /* ------------------------------------------------------------------ */

  // Cada caso da Figura 2: campos (m ou m²) e a fórmula. A chuva inclinada
  // pelo vento (1 horizontal : 2 vertical, 5.1.5) faz uma superfície vertical
  // de altura a "valer" a/2 de projeção horizontal.
  const SUPERFICIES = {
    a: {
      nome: 'Superfície plana horizontal',
      campos: [['a', 'Largura a (m)'], ['b', 'Comprimento b (m)']],
      formula: 'A = a · b',
      calc: function (v) { return v.a * v.b; },
      subst: function (v) { return f(v.a) + ' · ' + f(v.b); },
    },
    b: {
      nome: 'Superfície inclinada (água de telhado)',
      campos: [['a', 'Projeção horizontal a (m)'], ['h', 'Altura da água h (m)'], ['b', 'Comprimento b (m)']],
      formula: 'A = (a + h/2) · b',
      calc: function (v) { return (v.a + v.h / 2) * v.b; },
      subst: function (v) { return '(' + f(v.a) + ' + ' + f(v.h) + '/2) · ' + f(v.b); },
    },
    c: {
      nome: 'Superfície plana vertical única',
      campos: [['a', 'Altura a (m)'], ['b', 'Largura b (m)']],
      formula: 'A = a · b / 2',
      calc: function (v) { return (v.a * v.b) / 2; },
      subst: function (v) { return f(v.a) + ' · ' + f(v.b) + ' / 2'; },
    },
    d: {
      nome: 'Duas superfícies verticais opostas, uma mais alta',
      campos: [['a', 'Altura excedente a (m)'], ['b', 'Largura b (m)']],
      formula: 'A = a · b / 2',
      calc: function (v) { return (v.a * v.b) / 2; },
      subst: function (v) { return f(v.a) + ' · ' + f(v.b) + ' / 2'; },
    },
    e: {
      nome: 'Duas superfícies verticais opostas',
      campos: [['a', 'Altura a (m)'], ['b', 'Largura b (m)'], ['c', 'Altura c (m)'], ['d', 'Largura d (m)']],
      formula: 'A = |a·b − c·d| / 2',
      calc: function (v) { return Math.abs(v.a * v.b - v.c * v.d) / 2; },
      subst: function (v) { return '|' + f(v.a) + '·' + f(v.b) + ' − ' + f(v.c) + '·' + f(v.d) + '| / 2'; },
    },
    f: {
      nome: 'Duas superfícies verticais adjacentes e perpendiculares',
      campos: [['A1', 'Área da parede 1, A1 (m²)'], ['A2', 'Área da parede 2, A2 (m²)']],
      formula: 'A = √(A1² + A2²) / 2',
      calc: function (v) { return Math.sqrt(v.A1 * v.A1 + v.A2 * v.A2) / 2; },
      subst: function (v) { return '√(' + f(v.A1) + '² + ' + f(v.A2) + '²) / 2'; },
    },
    g: {
      nome: 'Três superfícies verticais em U (as opostas iguais)',
      campos: [['a', 'Altura a (m)'], ['b', 'Largura do fundo b (m)']],
      formula: 'A = a · b / 2',
      calc: function (v) { return (v.a * v.b) / 2; },
      subst: function (v) { return f(v.a) + ' · ' + f(v.b) + ' / 2'; },
    },
    h: {
      nome: 'Quatro superfícies verticais, uma mais alta',
      campos: [['a', 'Altura excedente a (m)'], ['b', 'Largura b (m)']],
      formula: 'A = a · b / 2',
      calc: function (v) { return (v.a * v.b) / 2; },
      subst: function (v) { return f(v.a) + ' · ' + f(v.b) + ' / 2'; },
    },
  };

  function f(x) {
    return (Math.round(x * 100) / 100).toLocaleString('pt-BR');
  }

  // Só a altura h da água inclinada pode valer zero (h = 0 é a superfície horizontal).
  const PODE_ZERO = { h: true };

  // Área de uma superfície e a situação de cada medida: vazia ou zero = incompleta, negativa
  // ou ilegível = inválida. Superfície que não está 'ok' não soma área nenhuma: nada de área
  // parcial nem de negativo trocado por zero em silêncio.
  function areaSuperficie(s) {
    const def = SUPERFICIES[s.tipo];
    const v = {};
    const campos = {};
    def.campos.forEach(function (c) {
      const k = c[0];
      const bruto = s.v[k];
      const vazio = bruto === '' || bruto === null || bruto === undefined;
      const x = vazio ? NaN : Number(bruto);
      if (vazio) campos[k] = 'incompleta';
      else if (!Number.isFinite(x) || x < 0) campos[k] = 'invalida';
      else if (x === 0 && !PODE_ZERO[k]) campos[k] = 'incompleta';
      v[k] = Number.isFinite(x) && x > 0 ? x : 0;
    });
    const sit = Object.keys(campos).map(function (k) { return campos[k]; });
    const estado = sit.indexOf('invalida') >= 0 ? 'invalida' : sit.length ? 'incompleta' : 'ok';
    return { A: estado === 'ok' ? def.calc(v) : 0, formula: def.formula, subst: def.subst(v), estado: estado, campos: campos };
  }

  function areaTotal(lista) {
    return lista.reduce(function (acc, s) { return acc + areaSuperficie(s).A; }, 0);
  }

  /* ------------------------------------------------------------------ */
  /* 5.3 — Vazão de projeto  +  5.5.4 / 5.5.6 (saídas e Tabela 1)        */
  /* ------------------------------------------------------------------ */

  function vazao(I, A) {
    return (I * A) / 60;
  }

  // Posições das saídas (m, a partir de uma ponta) para cada arranjo.
  function posicoesSaidas(p) {
    const L = p.Lc > 0 ? p.Lc : 1;
    const lim = function (x) { return Math.min(Math.max(x, 0), L); };
    if (p.config === 'intermediaria') return [lim(Number(p.x) || 0)];
    if (p.config === 'duas-pontas') return [0, L];
    if (p.config === 'espacadas') {
      const n = Math.max(1, Math.round(p.n || 1));
      const out = [];
      for (let k = 0; k < n; k++) out.push(((k + 0.5) * L) / n);
      return out;
    }
    if (p.config === 'personalizadas') {
      const v = (p.lista || []).filter(Number.isFinite).map(lim).sort(function (a, b) { return a - b; });
      return v.filter(function (x, k) { return k === 0 || x - v[k - 1] > 1e-9; });
    }
    return [L];
  }

  // Divide a calha entre as saídas supondo contribuição uniforme ao longo do
  // comprimento: entre duas saídas a água se divide no meio do caminho; da
  // ponta até a primeira saída, o trecho inteiro corre para ela. A calha é
  // dimensionada pelo maior trecho que escoa para uma saída (5.5.4); cada
  // condutor recebe a soma dos dois lados da sua saída.
  function distribuicao(p) {
    const precisaL = p.config === 'intermediaria' || p.config === 'personalizadas';
    const vazio = { fracCalha: 1, fracCondutor: 1, n: 1, trecho: null, saidas: [] };
    if (precisaL && !(p.Lc > 0)) {
      return Object.assign(vazio, { erro: 'Informe o comprimento da calha para localizar as saídas.' });
    }
    const L = p.Lc > 0 ? p.Lc : 1;
    const pos = posicoesSaidas(Object.assign({}, p, { Lc: L }));
    if (!pos.length) return Object.assign(vazio, { erro: 'Informe a posição de pelo menos uma saída.' });
    let maiorTrecho = 0;
    let maiorBacia = 0;
    const saidas = pos.map(function (x, k) {
      const esq = k === 0 ? 0 : (pos[k - 1] + x) / 2;
      const dir = k === pos.length - 1 ? L : (x + pos[k + 1]) / 2;
      maiorTrecho = Math.max(maiorTrecho, x - esq, dir - x);
      maiorBacia = Math.max(maiorBacia, dir - esq);
      return { x: x, fracao: (dir - esq) / L, ladoEsq: x - esq, ladoDir: dir - x };
    });
    const escala = p.Lc > 0 ? 1 : null;
    return {
      fracCalha: maiorTrecho / L,
      fracCondutor: maiorBacia / L,
      n: pos.length,
      trecho: escala ? maiorTrecho : null,
      saidas: saidas,
    };
  }

  function coefTabela1(curva, faixa) {
    if (!curva || curva === 'nenhuma') return 1;
    const linha = DADOS.TABELA1[curva];
    return faixa === 'ate2m' ? linha.ate2m : linha.de2a4m;
  }

  /* ------------------------------------------------------------------ */
  /* 5.5.7 — Calhas: Manning-Strickler                                   */
  /* ------------------------------------------------------------------ */

  function manning(S, P, n, i) {
    if (!(S > 0) || !(P > 0) || !(i > 0)) return 0;
    return K * (S / n) * Math.pow(S / P, 2 / 3) * Math.sqrt(i);
  }

  // Segmento circular de diâmetro D com lâmina y.
  function segmento(D, y) {
    const t = Math.min(Math.max(y / D, 0), 1);
    const th = 2 * Math.acos(1 - 2 * t);
    return { S: ((D * D) / 8) * (th - Math.sin(th)), P: (D * th) / 2, B: D * Math.sin(th / 2) };
  }

  const SECOES = {
    retangular: {
      geo: function (d, y) { return { S: d.b * y, P: d.b + 2 * y, B: d.b }; },
      altura: function (d) { return d.h; },
    },
    semicircular: {
      geo: function (d, y) { return segmento(d.D, y); },
      altura: function (d) { return d.D / 2; },
    },
    trapezoidal: {
      geo: function (d, y) {
        return { S: (d.b + d.z * y) * y, P: d.b + 2 * y * Math.sqrt(1 + d.z * d.z), B: d.b + 2 * d.z * y };
      },
      altura: function (d) { return d.h; },
    },
  };

  function qSecao(forma, dims, y, n, i) {
    const g = SECOES[forma].geo(dims, y);
    return manning(g.S, g.P, n, i);
  }

  // Lâmina normal y tal que Q(y) = Q, procurada em (0, yMax]. Q(y) é crescente
  // nas três formas até a borda, então bisseção basta.
  function laminaNormal(forma, dims, Q, n, i, yMax) {
    const Qmax = qSecao(forma, dims, yMax, n, i);
    if (!(Q > 0)) return { y: 0, Qmax: Qmax, cabe: true };
    if (Qmax < Q) return { y: null, Qmax: Qmax, cabe: false };
    let lo = 0;
    let hi = yMax;
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      if (qSecao(forma, dims, mid, n, i) < Q) lo = mid;
      else hi = mid;
    }
    return { y: hi, Qmax: Qmax, cabe: true };
  }

  // Verifica uma calha: lâmina necessária, capacidade no limite de lâmina
  // adotado (critério de bordo livre do projetista) e folgas.
  function verificarCalha(p) {
    const sec = SECOES[p.forma];
    const hTotal = sec.altura(p.dims);
    const yLim = hTotal * p.fracLamina;
    const cheia = laminaNormal(p.forma, p.dims, p.Q, p.n, p.i, hTotal);
    const Qlim = qSecao(p.forma, p.dims, yLim, p.n, p.i);
    const res = {
      hTotal: hTotal,
      yLim: yLim,
      Qlim: Qlim,
      Qcheia: cheia.Qmax,
      y: cheia.y,
      ok: cheia.cabe && cheia.y <= yLim + 1e-12,
      uso: Qlim > 0 ? p.Q / Qlim : Infinity,
    };
    if (cheia.cabe) {
      const g = sec.geo(p.dims, cheia.y);
      res.S = g.S;
      res.P = g.P;
      res.R = g.S / g.P;
      res.V = p.Q / 60000 / g.S;
      res.bordoLivre = hTotal - cheia.y;
    }
    return res;
  }

  function arredondaCima(x, passo) {
    return Math.ceil(x / passo - 1e-9) * passo;
  }

  // Tabela 3 interpolada (linear em D e em i), só dentro dela: 100 ≤ D ≤ 200 mm e
  // 0,5% ≤ i ≤ 2%, n = 0,011, lâmina D/2 (seção cheia). Fora disso não há valor: a tabela
  // não é extrapolada.
  function qTabela3(Dmm, i) {
    const t = DADOS.TABELA3;
    const Ds = t.linhas.map(function (l) { return l.D; });
    const is = t.declividades;
    if (!(Dmm >= Ds[0] - 1e-9 && Dmm <= Ds[Ds.length - 1] + 1e-9 && i >= is[0] - 1e-12 && i <= is[is.length - 1] + 1e-12)) return null;
    const pos = function (arr, x) {
      let k = 1;
      while (k < arr.length - 1 && arr[k] < x) k++;
      return { k: k, t: Math.min(Math.max((x - arr[k - 1]) / (arr[k] - arr[k - 1]), 0), 1) };
    };
    const a = pos(Ds, Dmm);
    const b = pos(is, i);
    const q = function (r, c) { return t.linhas[r].Q[c]; };
    const cima = q(a.k - 1, b.k - 1) + b.t * (q(a.k - 1, b.k) - q(a.k - 1, b.k - 1));
    const baixo = q(a.k, b.k - 1) + b.t * (q(a.k, b.k) - q(a.k, b.k - 1));
    return cima + a.t * (baixo - cima);
  }

  // A menor curva do ábaco da Figura 3 é H = 50 mm, e 5.6.4.1 só interpola. H é a lâmina limite
  // da calha, então a seção escolhida pelo botão deixa essa lâmina em pelo menos 50 mm: assim o
  // condutor vertical tem leitura com os mesmos dados.
  const H_MIN_ABACO = 0.05;

  // Dimensiona a menor seção comercial da forma escolhida (medidas em m, múltiplos de 5 mm;
  // semicircular só com os diâmetros da Tabela 3) que escoa a vazão e deixa a lâmina limite no
  // domínio do ábaco. `peloAbaco` diz quando foi o ábaco, e não a vazão, que decidiu.
  function dimensionarCalha(p) {
    const frac = p.fracLamina;
    const yMin = p.yMin != null ? p.yMin : H_MIN_ABACO;
    if (p.forma === 'semicircular') {
      let lo = 0.01;
      let hi = 2;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (qSecao('semicircular', { D: mid }, (frac * mid) / 2, p.n, p.i) < p.Q) lo = mid;
        else hi = mid;
      }
      // Só os diâmetros da Tabela 3 (100 a 200 mm), que a própria tabela confere. Se nenhum
      // serve, não se inventa um diâmetro fora dela: dims fica nulo.
      const DminAbaco = (2 * yMin) / frac;
      const precisa = Math.max(hi, DminAbaco);
      const tabela = DADOS.CALHAS_SEMICIRCULARES.find(function (d) { return d / 1000 >= precisa - 1e-6; });
      return {
        dims: tabela ? { D: tabela / 1000 } : null, Dmin: hi, DminAbaco: DminAbaco, peloAbaco: DminAbaco > hi + 1e-9,
        comercial: !!tabela, semTabela: !tabela,
      };
    }
    const hAbaco = arredondaCima(yMin / frac, 0.005);
    if (p.forma === 'retangular' && p.otima) {
      // Seção retangular de máxima eficiência: b = 2y.
      let lo = 0.001;
      let hi = 2;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (manning(2 * mid * mid, 4 * mid, p.n, p.i) < p.Q) lo = mid;
        else hi = mid;
      }
      const b = arredondaCima(2 * hi, 0.005);
      const y = laminaNormal('retangular', { b: b, h: 10 }, p.Q, p.n, p.i, 10).y;
      const hVazao = arredondaCima(y / frac, 0.005);
      return { dims: { b: b, h: Math.max(hVazao, hAbaco) }, y: y, peloAbaco: hAbaco > hVazao };
    }
    const dims = Object.assign({}, p.dims, { h: 10 });
    const y = laminaNormal(p.forma, dims, p.Q, p.n, p.i, 10).y;
    const hVazao = arredondaCima(y / frac, 0.005);
    return { dims: Object.assign({}, p.dims, { h: Math.max(hVazao, hAbaco) }), y: y, peloAbaco: hAbaco > hVazao };
  }

  // Desenvolvimento da chapa (largura planificada) em m: perímetro da seção + abas.
  function desenvolvimento(forma, dims, abas) {
    let d;
    if (forma === 'retangular') d = dims.b + 2 * dims.h;
    else if (forma === 'semicircular') d = (Math.PI * dims.D) / 2;
    else d = dims.b + 2 * dims.h * Math.sqrt(1 + dims.z * dims.z);
    return d + (abas || 0);
  }

  // Menor corte usual de bobina (mm) que comporta o desenvolvimento (m).
  function corteComercial(dev) {
    const c = DADOS.CORTES_CHAPA.find(function (x) { return x / 1000 >= dev - 1e-9; });
    return c || null;
  }

  /* ------------------------------------------------------------------ */
  /* 5.6 — Condutores verticais: ábacos da Figura 3                      */
  /* ------------------------------------------------------------------ */

  // Q ao longo de uma curva digitalizada [[D mm, Q L/min], ...] (D crescente),
  // com extrapolação linear pelas pontas.
  function qNaCurva(pts, D) {
    let k = 1;
    if (D <= pts[0][0]) k = 1;
    else if (D >= pts[pts.length - 1][0]) k = pts.length - 1;
    else while (pts[k][0] < D) k++;
    const a = pts[k - 1];
    const b = pts[k];
    return a[1] + ((D - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
  }

  // Interpola entre as duas curvas vizinhas da família, no mesmo D.
  // H: linear em H. L: linear em L até 25 m; entre 25 m e ∞, linear em 1/L.
  function qNaFamilia(familia, param, D, tipo) {
    const cs = familia;
    const u = function (v) { return tipo === 'L' ? (v >= 25 ? 25 + (1 - 25 / v) : v) : v; };
    const x = u(param);
    let k = 1;
    while (k < cs.length - 1 && u(cs[k].v) < x) k++;
    const c0 = cs[k - 1];
    const c1 = cs[k];
    const x0 = u(c0.v);
    const x1 = u(c1.v);
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    return qNaCurva(c0.pts, D) + t * (qNaCurva(c1.pts, D) - qNaCurva(c0.pts, D));
  }

  function diametroNaFamilia(familia, param, Q, tipo) {
    let lo = 20;
    let hi = 220;
    for (let k = 0; k < 70; k++) {
      const mid = (lo + hi) / 2;
      if (qNaFamilia(familia, param, mid, tipo) < Q) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  // Leitura da Figura 3 (5.6.4.1): interpola entre as curvas existentes. Abaixo
  // da menor curva de H ou de L não há leitura pela norma.
  function abaco(p) {
    const ab = ABACOS[p.saida];
    const avisos = [];
    let H = p.H;
    const L = p.L;
    if (H < 50 || L < 0.3) {
      avisos.push({
        nivel: 'erro',
        classe: 'fora_do_dominio',
        codigo: H < 50 ? 'ABACO_H_ABAIXO' : 'ABACO_L_ABAIXO',
        texto: H < 50
          ? 'H = ' + Math.round(H) + ' mm está abaixo da menor curva do ábaco (H = 50 mm). A norma manda interpolar entre as curvas existentes, sem extrapolar (5.6.4.1): use H entre 50 e 100 mm.'
          : 'L = ' + String(L).replace('.', ',') + ' m está abaixo da menor curva do ábaco (L = 0,3 m). A norma manda interpolar entre as curvas existentes, sem extrapolar (5.6.4.1).',
      });
      return { DH: NaN, DL: NaN, D: NaN, governa: null, fora: H < 50 ? 'H' : 'L', Hcurva: H, Lcurva: L, avisos: avisos };
    }
    if (H > 100) {
      avisos.push({
        nivel: 'info',
        classe: 'informativa',
        texto: 'H acima de 100 mm: lida a curva H = 100 mm, a mais alta do ábaco, o que dá diâmetro maior (a favor da segurança).',
      });
      H = 100;
    }
    // Fora do ábaco não há leitura: nenhum número (a busca vai de 20 a 220 mm e os extremos
    // dela não são diâmetros).
    if (p.Q > ab.Qmax) {
      avisos.push({
        nivel: 'erro',
        classe: 'fora_do_dominio',
        codigo: 'ABACO_Q_ACIMA',
        texto: 'Q = ' + Math.round(p.Q) + ' L/min passa do fim do ábaco (' + ab.Qmax + ' L/min): não há leitura. Divida a vazão entre mais saídas.',
      });
      return { DH: NaN, DL: NaN, D: NaN, governa: null, fora: 'Q', Hcurva: H, Lcurva: L, avisos: avisos };
    }
    const DH = diametroNaFamilia(ab.H, H, p.Q, 'H');
    const DL = diametroNaFamilia(ab.L, L, p.Q, 'L');
    const D = Math.max(DH, DL);
    if (D > 150) {
      avisos.push({
        nivel: 'erro',
        classe: 'fora_do_dominio',
        codigo: 'ABACO_D_ACIMA',
        texto: 'O diâmetro passaria de 150 mm, o fim do ábaco: não há leitura. Divida a vazão entre mais saídas.',
      });
      return { DH: DH > 150 ? NaN : DH, DL: DL > 150 ? NaN : DL, D: NaN, governa: null, fora: 'D', Hcurva: H, Lcurva: L, avisos: avisos };
    }
    return { DH: DH, DL: DL, D: D, governa: DH >= DL ? 'H' : 'L', Hcurva: H, Lcurva: L, avisos: avisos };
  }

  function adotarTubo(D, tubos) {
    const minimo = Math.max(D, DADOS.DIAMETRO_MINIMO_VERTICAL);
    const t = tubos.slice().sort(function (a, b) { return a.di - b.di; }).find(function (x) { return x.di >= minimo - 1e-9; });
    return { tubo: t || null, minimo: minimo, peloMinimo: D < DADOS.DIAMETRO_MINIMO_VERTICAL };
  }

  // Menor número de saídas espaçadas com que cada condutor cabe no ábaco e na
  // lista de tubos, mantendo H, L e o tipo de saída.
  function sugerirSaidas(p) {
    const ab = ABACOS[p.saida];
    for (let n = 1; n <= (p.nMax || 12); n++) {
      const Qc = p.Q / n;
      if (Qc > ab.Qmax) continue;
      const r = abaco({ saida: p.saida, Q: Qc, H: p.H, L: p.L });
      // H ou L fora do ábaco não mudam com o número de saídas; D ou Q acima mudam.
      if (r.fora === 'H' || r.fora === 'L') return null;
      if (r.fora) continue;
      const t = adotarTubo(r.D, p.tubos);
      if (t.tubo) return { n: n, Q: Qc, D: r.D, tubo: t.tubo };
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* 5.7 — Condutores horizontais: lâmina 2/3 D                          */
  /* ------------------------------------------------------------------ */

  function qCondutorHorizontal(Dmm, n, i) {
    const D = Dmm / 1000;
    const g = segmento(D, (2 * D) / 3);
    return manning(g.S, g.P, n, i);
  }

  // 5.7.2: capacidade a 2/3 do diâmetro INTERNO real de cada tubo, por Manning. Um Di
  // comercial nunca recebe a capacidade de outro diâmetro da tabela. Política da Tabela 4
  // (plano de 13/09/2026, seção 3.7): com Di igual a um D da tabela (±0,05 mm) e n e i iguais
  // aos de uma coluna, o aceite usa o valor impresso, e a linha registra "Tabela 4".
  function condutorHorizontal(p) {
    const t4 = DADOS.TABELA4;
    const base = p.tubos || t4.diametros.map(function (D) { return { dn: null, di: D, origem: 'norma' }; });
    const tubos = base.filter(function (t) { return t.di > 0; }).slice().sort(function (a, b) { return a.di - b.di; });
    const coluna = t4.Q[p.n] ? t4.declividades.findIndex(function (d) { return Math.abs(d - p.i) < 1e-9; }) : -1;
    const linhas = tubos.map(function (t) {
      const Qm = qCondutorHorizontal(t.di, p.n, p.i);
      const k = coluna >= 0 ? t4.diametros.findIndex(function (D) { return Math.abs(D - t.di) <= 0.05; }) : -1;
      const Qt = k >= 0 ? t4.Q[p.n][k][coluna] : null;
      return Object.assign({}, t, { D: t.di, Qmanning: Qm, Qtabela: Qt, Q: Qt != null ? Qt : Qm, fonteQ: Qt != null ? 'Tabela 4' : 'Manning' });
    });
    const escolhido = linhas.find(function (l) { return l.Q >= p.Q; }) || null;
    return { linhas: linhas, escolhido: escolhido };
  }

  return {
    K: K,
    DURACAO: DURACAO,
    DADOS: DADOS,
    ABACOS: ABACOS,
    SUPERFICIES: SUPERFICIES,
    SECOES: SECOES,
    ESTADOS: ESTADOS,
    piorEstado: piorEstado,
    situacao: situacao,
    intensidade: intensidade,
    intensidadeIDF: intensidadeIDF,
    areaSuperficie: areaSuperficie,
    areaTotal: areaTotal,
    vazao: vazao,
    posicoesSaidas: posicoesSaidas,
    distribuicao: distribuicao,
    coefTabela1: coefTabela1,
    manning: manning,
    segmento: segmento,
    qSecao: qSecao,
    laminaNormal: laminaNormal,
    verificarCalha: verificarCalha,
    qTabela3: qTabela3,
    dimensionarCalha: dimensionarCalha,
    desenvolvimento: desenvolvimento,
    corteComercial: corteComercial,
    qNaCurva: qNaCurva,
    qNaFamilia: qNaFamilia,
    diametroNaFamilia: diametroNaFamilia,
    abaco: abaco,
    adotarTubo: adotarTubo,
    sugerirSaidas: sugerirSaidas,
    qCondutorHorizontal: qCondutorHorizontal,
    condutorHorizontal: condutorHorizontal,
  };
});
