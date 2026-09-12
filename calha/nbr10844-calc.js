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

  function intensidade(p) {
    const avisos = [];
    if (p.modo === 'pequena') {
      if (p.areaProjecao > DADOS.AREA_PEQUENA) {
        avisos.push({
          nivel: 'erro',
          texto:
            'I = 150 mm/h só vale para construções com até 100 m² de área de projeção horizontal (5.1.4). ' +
            'Use a Tabela 5 ou dados locais.',
        });
      }
      return { I: DADOS.I_PEQUENA_AREA, T: null, fonte: '5.1.4', avisos: avisos };
    }
    if (p.modo === 'manual') {
      if (!(p.valor > 0)) avisos.push({ nivel: 'erro', texto: 'Informe uma intensidade maior que zero.' });
      return { I: p.valor || 0, T: p.T || null, fonte: '5.1.1', avisos: avisos };
    }
    if (p.modo === 'idf') {
      const I = intensidadeIDF(p);
      if (!(I > 0)) {
        avisos.push({ nivel: 'erro', texto: 'Informe K, a, b e c da equação de chuvas intensas do local.' });
        return { I: 0, T: p.T, fonte: 'equação IDF', avisos: avisos };
      }
      if (I > FAIXA_T5[1] || I < FAIXA_T5[0]) {
        avisos.push({
          nivel: 'atencao',
          texto:
            'O valor está fora da faixa da Tabela 5 para 5 minutos (' + FAIXA_T5[0] + ' a ' + FAIXA_T5[1] + ' mm/h). ' +
            'Confira se a equação dá i em mm/h com t em minutos (há equações em mm/min ou com t em horas).',
        });
      }
      return { I: I, T: p.T, fonte: 'equação IDF', avisos: avisos };
    }
    const linha = DADOS.TABELA5.find(function (l) { return l.id === p.localId; });
    if (!linha) return { I: 0, T: p.T, fonte: 'Tabela 5', avisos: [{ nivel: 'erro', texto: 'Escolha um local.' }] };
    let T = p.T;
    let I = linha.I[T];
    if (I == null) {
      // Sem dado para o período pedido: cai para o maior período disponível abaixo dele.
      const alternativo = [25, 5, 1].find(function (t) { return t < T && linha.I[t] != null; });
      avisos.push({
        nivel: 'erro',
        texto:
          'A Tabela 5 não traz valor para T = ' + T + ' anos em ' + linha.local + '. ' +
          'Mostrando T = ' + linha.Treal[alternativo] + ' anos, que é MENOR que o exigido: ' +
          'busque dados locais ou um posto vizinho de clima semelhante (nota a da Tabela 5).',
      });
      T = alternativo;
      I = linha.I[alternativo];
    }
    const Treal = linha.Treal[T];
    if (Treal !== T) {
      avisos.push({
        nivel: Treal < T ? 'atencao' : 'info',
        texto:
          'Na Tabela 5 este valor corresponde a T = ' + Treal + ' anos (entre parênteses na norma), ' +
          'porque o posto não tinha observações suficientes para ' + T + ' anos.',
      });
    }
    return { I: I, T: Treal, linha: linha, fonte: 'Tabela 5', avisos: avisos };
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

  function areaSuperficie(s) {
    const def = SUPERFICIES[s.tipo];
    const v = {};
    def.campos.forEach(function (c) { v[c[0]] = Math.max(0, Number(s.v[c[0]]) || 0); });
    return { A: def.calc(v), formula: def.formula, subst: def.subst(v) };
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

  // Dimensiona a menor seção da forma escolhida (medidas em m, múltiplos de 5 mm).
  function dimensionarCalha(p) {
    const frac = p.fracLamina;
    if (p.forma === 'semicircular') {
      let lo = 0.01;
      let hi = 2;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        if (qSecao('semicircular', { D: mid }, (frac * mid) / 2, p.n, p.i) < p.Q) lo = mid;
        else hi = mid;
      }
      const comercial = DADOS.CALHAS_SEMICIRCULARES.find(function (d) { return d / 1000 >= hi - 1e-9; });
      return { dims: { D: comercial ? comercial / 1000 : arredondaCima(hi, 0.005) }, Dmin: hi, comercial: !!comercial };
    }
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
      return { dims: { b: b, h: arredondaCima(y / frac, 0.005) }, y: y };
    }
    const dims = Object.assign({}, p.dims, { h: 10 });
    const y = laminaNormal(p.forma, dims, p.Q, p.n, p.i, 10).y;
    return { dims: Object.assign({}, p.dims, { h: arredondaCima(y / frac, 0.005) }), y: y };
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
        texto: H < 50
          ? 'H = ' + Math.round(H) + ' mm está abaixo da menor curva do ábaco (H = 50 mm). A norma manda interpolar entre as curvas existentes, sem extrapolar (5.6.4.1): use H entre 50 e 100 mm.'
          : 'L = ' + String(L).replace('.', ',') + ' m está abaixo da menor curva do ábaco (L = 0,3 m). A norma manda interpolar entre as curvas existentes, sem extrapolar (5.6.4.1).',
      });
      return { DH: NaN, DL: NaN, D: NaN, governa: null, fora: H < 50 ? 'H' : 'L', Hcurva: H, Lcurva: L, avisos: avisos };
    }
    if (H > 100) {
      avisos.push({
        nivel: 'info',
        texto: 'H acima de 100 mm: lida a curva H = 100 mm, a mais alta do ábaco, o que dá diâmetro maior (a favor da segurança).',
      });
      H = 100;
    }
    const DH = diametroNaFamilia(ab.H, H, p.Q, 'H');
    const DL = diametroNaFamilia(ab.L, L, p.Q, 'L');
    const D = Math.max(DH, DL);
    if (p.Q > ab.Qmax) {
      avisos.push({
        nivel: 'erro',
        texto: 'Q acima de ' + ab.Qmax + ' L/min sai do ábaco: divida a vazão entre mais condutores.',
      });
    }
    if (D > 150) {
      avisos.push({
        nivel: 'erro',
        texto: 'O diâmetro passa de 150 mm, limite do ábaco: aumente o número de condutores.',
      });
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
      if (r.fora) return null;
      if (r.D > 150) continue;
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

  function condutorHorizontal(p) {
    const linhas = DADOS.TABELA4.diametros.map(function (D) {
      return { D: D, Q: qCondutorHorizontal(D, p.n, p.i) };
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
