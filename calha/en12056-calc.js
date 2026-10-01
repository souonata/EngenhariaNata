/*
 * Núcleo de cálculo da EN 12056-3:2000 — funções puras, sem DOM, sem texto de interface.
 * Cada função devolve avisos com código e dados; quem traduz é a camada de idioma (it/sv).
 *
 * Unidades: calha, bocal e tubo em mm; seção em mm²; cobertura em m²; vazão em l/s;
 * intensidade de chuva em l/(s·m²); declividade de calha em mm/m; de tubo, adimensional (m/m).
 *
 * Contrato de situações igual ao do núcleo da NBR (nbr10844-calc.js): só 'atende' e 'ressalva'
 * deixam dizer que atende; 'sem_suporte' é o que a norma não cobre.
 *
 * Script clássico: no navegador vira window.EN12056; em Node, module.exports.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const dados = node ? require('./en12056-dados.js') : root.EN12056_DADOS;
  const api = factory(dados);
  if (node) module.exports = api;
  else root.EN12056 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Situações                                                           */
  /* ------------------------------------------------------------------ */

  const ESTADOS = ['atende', 'ressalva', 'nao_atende', 'fora_do_dominio', 'sem_suporte', 'incompleta', 'invalida'];
  function piorEstado(a, b) { return ESTADOS.indexOf(b) > ESTADOS.indexOf(a) ? b : a; }
  function situacao(lista) {
    return (lista || []).reduce(function (s, x) { return ESTADOS.indexOf(x.classe) >= 0 ? piorEstado(s, x.classe) : s; }, 'atende');
  }
  function aviso(classe, codigo, dados) { return { classe: classe, codigo: codigo, dados: dados || {} }; }
  function nota(codigo, dados) { return aviso('informativa', codigo, dados); }

  function numero(x) { return typeof x === 'number' && isFinite(x); }
  function positivo(x) { return numero(x) && x > 0; }

  /* ------------------------------------------------------------------ */
  /* Curvas das Figuras 5, 6 e 10                                        */
  /* ------------------------------------------------------------------ */

  // Interpolação linear entre os pontos lidos da figura. Fora do eixo desenhado devolve null:
  // a norma não dá valor ali, e inventar um seria sair do domínio sem avisar.
  function naCurva(pts, x) {
    if (!numero(x) || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    for (let k = 1; k < pts.length; k++) {
      if (x <= pts[k][0]) {
        const a = pts[k - 1];
        const b = pts[k];
        const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return pts[pts.length - 1][1];
  }

  function Fd(WsobreT) { return naCurva(D.FIGURA5_FD, WsobreT); }
  function Fs(SsobreT) { return naCurva(D.FIGURA6_FS, SsobreT); }
  function Fh(SsobreT) { return naCurva(D.FIGURA10_FH, SsobreT); }

  /* ------------------------------------------------------------------ */
  /* 4 — chuva, área e vazão                                             */
  /* ------------------------------------------------------------------ */

  function fatorRisco(id) {
    const linha = D.TABELA2.find(function (l) { return l.id === id; });
    return linha ? linha.fator : null;
  }

  /*
   * Intensidade de projeto r, em l/(s·m²). Três caminhos:
   *  - 'estatistica' (4.2.1): r vem de estatística local de chuvas; o fator de risco da Tabela 2
   *    NÃO se aplica (a norma é explícita), porque o risco já está na escolha do período;
   *  - 'tabela1' (4.2.2): r = valor da Tabela 1 × fator de risco da Tabela 2;
   *  - 'pratica-nacional': a prática do país define a intensidade mínima (um valor estatístico,
   *    não um da lista da Tabela 1) e manda multiplicá-la pelo fator de risco. Fica marcado.
   * kf é um fator climático nacional (ex.: Svenskt Vatten): fora da EN, entra como nota.
   */
  function intensidade(p) {
    const avisos = [];
    const kf = p.kf == null ? 1 : p.kf;
    if (!numero(kf) || kf <= 0) return { r: null, avisos: [aviso('invalida', 'kf-invalido', { kf: p.kf })], situacao: 'invalida' };
    if (kf !== 1) avisos.push(nota('fator-climatico', { kf: kf }));

    if (p.via === 'estatistica') {
      if (!positivo(p.r)) return { r: null, avisos: [aviso('incompleta', 'sem-intensidade', {})], situacao: 'incompleta' };
      if (p.risco) avisos.push(nota('risco-nao-se-aplica', { risco: p.risco }));
      const r = p.r * kf;
      return { r: r, base: p.r, fator: 1, kf: kf, via: p.via, avisos: avisos, situacao: situacao(avisos) };
    }

    const fator = fatorRisco(p.risco);
    if (fator == null) return { r: null, avisos: [aviso('incompleta', 'sem-risco', { risco: p.risco })], situacao: 'incompleta' };
    if (!positivo(p.rBase)) return { r: null, avisos: [aviso('incompleta', 'sem-intensidade', {})], situacao: 'incompleta' };

    if (p.via === 'tabela1') {
      const naTabela = D.TABELA1.some(function (v) { return Math.abs(v - p.rBase) < 1e-9; });
      if (!naTabela) avisos.push(nota('fora-da-tabela1', { rBase: p.rBase }));
    } else if (p.via === 'pratica-nacional') {
      avisos.push(nota('base-pratica-nacional', { rBase: p.rBase }));
    } else {
      return { r: null, avisos: [aviso('invalida', 'via-desconhecida', { via: p.via })], situacao: 'invalida' };
    }
    const r = p.rBase * fator * kf;
    return { r: r, base: p.rBase, fator: fator, kf: kf, via: p.via, avisos: avisos, situacao: situacao(avisos) };
  }

  // Probabilidade de a chuva de período de retorno T ser igualada ou superada ao menos uma vez
  // em "anos" de vida útil. Estatística comum; serve para explicar a escolha de T em 4.2.1.
  function probabilidadeExcedencia(T, anos) {
    if (!positivo(T) || !positivo(anos)) return null;
    return 1 - Math.pow(1 - 1 / T, anos);
  }

  /*
   * Área efetiva da cobertura, em m² (4.3). Sem vento é o padrão da norma (4.3.1).
   * Paredes que escorrem para o telhado entram com 50 % (4.3.4) e só onde o vento é considerado.
   */
  function areaEfetiva(p) {
    const avisos = [];
    const metodo = p.vento || 'sem-vento';
    if (D.METODOS_AREA.indexOf(metodo) < 0) {
      return { A: null, avisos: [aviso('invalida', 'metodo-area-desconhecido', { vento: metodo })], situacao: 'invalida' };
    }
    if (!positivo(p.LR)) return { A: null, avisos: [aviso('incompleta', 'sem-comprimento', {})], situacao: 'incompleta' };

    let A = null;
    if (metodo === 'sem-vento') {
      if (!positivo(p.BR)) return { A: null, avisos: [aviso('incompleta', 'sem-largura', {})], situacao: 'incompleta' };
      A = p.LR * p.BR;
    } else if (metodo === 'chuva-26-graus') {
      if (!positivo(p.BR) || !numero(p.HR) || p.HR < 0) return { A: null, avisos: [aviso('incompleta', 'sem-altura', {})], situacao: 'incompleta' };
      A = p.LR * (p.BR + p.HR / 2);
      avisos.push(nota('vento-considerado', { metodo: metodo }));
    } else {
      const TR = positivo(p.TR) ? p.TR : (positivo(p.BR) && numero(p.HR) ? Math.sqrt(p.BR * p.BR + p.HR * p.HR) : null);
      if (!positivo(TR)) return { A: null, avisos: [aviso('incompleta', 'sem-rampa', {})], situacao: 'incompleta' };
      A = p.LR * TR;
      avisos.push(nota('vento-considerado', { metodo: metodo }));
    }

    const paredes = (p.paredes || []).reduce(function (s, x) { return s + (positivo(x) ? x : 0); }, 0);
    let Aparedes = 0;
    if (paredes > 0) {
      if (metodo === 'sem-vento') avisos.push(nota('paredes-sem-vento', { paredes: paredes }));
      else Aparedes = paredes / 2;
    }
    return { A: A + Aparedes, Atelhado: A, Aparedes: Aparedes, metodo: metodo, avisos: avisos, situacao: situacao(avisos) };
  }

  // 4.1: Q = r · A · C, com C = 1,0 salvo prática nacional.
  function vazao(p) {
    const C = p.C == null ? 1 : p.C;
    if (!positivo(p.r) || !positivo(p.A) || !positivo(C)) {
      return { Q: null, avisos: [aviso('incompleta', 'sem-dados-vazao', {})], situacao: 'incompleta' };
    }
    const avisos = C !== 1 ? [nota('coeficiente-escoamento', { C: C })] : [];
    return { Q: p.r * p.A * C, C: C, avisos: avisos, situacao: situacao(avisos) };
  }

  /* ------------------------------------------------------------------ */
  /* 5 — geometria e capacidade das calhas                               */
  /* ------------------------------------------------------------------ */

  // Formas da Figura 4 (mais a meia-cana da Figura 2). 'solaPlana' diz se vale a Tabela 7.
  const FORMAS = {
    semicircular: {
      solaPlana: false,
      profundidade: function (d) { return d.D / 2; },
      largura: function (d, y) {
        const R = d.D / 2;
        const t = Math.max(0, Math.min(y, R));
        return 2 * Math.sqrt(Math.max(0, R * R - (R - t) * (R - t)));
      },
      // Área do segmento circular até a altura y (y = R dá π·D²/8).
      area: function (d, y) {
        const R = d.D / 2;
        const t = Math.max(0, Math.min(y, R));
        const teta = 2 * Math.acos(Math.max(-1, Math.min(1, (R - t) / R)));
        return (R * R / 2) * (teta - Math.sin(teta));
      },
      fundo: function () { return 0; },
    },
    retangular: {
      solaPlana: true,
      profundidade: function (d) { return d.Z; },
      largura: function (d) { return d.T; },
      area: function (d, y) { return d.T * y; },
      fundo: function (d) { return d.T; },
    },
    trapezoidal: {
      solaPlana: true,
      profundidade: function (d) { return d.Z; },
      largura: function (d, y) { return d.S + (d.T - d.S) * (y / d.Z); },
      area: function (d, y) { return (y * (d.S + FORMAS.trapezoidal.largura(d, y))) / 2; },
      fundo: function (d) { return d.S; },
    },
    triangular: {
      solaPlana: true, // fundo nulo: a nota 3 da Tabela 7 cita a triangular, com S/T = 0
      profundidade: function (d) { return d.Z; },
      largura: function (d, y) { return d.T * (y / d.Z); },
      area: function (d, y) { return (y * FORMAS.triangular.largura(d, y)) / 2; },
      fundo: function () { return 0; },
    },
  };

  function dimsValidas(forma, dims) {
    if (!FORMAS[forma] || !dims) return false;
    if (forma === 'semicircular') return positivo(dims.D);
    if (forma === 'retangular') return positivo(dims.T) && positivo(dims.Z);
    if (forma === 'trapezoidal') return positivo(dims.T) && positivo(dims.Z) && numero(dims.S) && dims.S >= 0 && dims.S <= dims.T;
    return positivo(dims.T) && positivo(dims.Z);
  }

  // Tabela 5 — bordo livre mínimo de calha de água-furtada e de platibanda.
  function bordoLivre(Z) {
    if (!positivo(Z)) return null;
    const linha = D.TABELA5.find(function (l) { return l.exclusivo ? Z < l.ateZ : Z <= l.ateZ; });
    return linha.fracaoZ ? linha.fracaoZ * Z : linha.bordo;
  }

  /*
   * Geometria de projeto de uma calha: profundidade de água W, largura T na linha d'água,
   * fundo S e área de cálculo (AE na de beiral, AW na interna, já sem a obstrução de 5.2.7).
   */
  function geometria(p) {
    const forma = FORMAS[p.forma];
    const Z = forma.profundidade(p.dims);
    const interna = p.tipo === 'interna';
    const fb = interna ? bordoLivre(Z) : 0;
    const W = Z - fb;
    if (!(W > 0)) return null;
    const obstrucao = positivo(p.obstrucao) ? 2 * p.obstrucao : 0; // 5.2.7: descontar 2× a área
    const area = forma.area(p.dims, W) - obstrucao;
    return {
      Z: Z,
      bordoLivre: fb,
      W: W,
      T: forma.largura(p.dims, W),
      S: forma.fundo(p.dims),
      area: area,
      obstrucaoDescontada: obstrucao,
      solaPlana: forma.solaPlana,
    };
  }

  /*
   * Fator de capacidade FL (Tabela 6) para calha longa. Entre linhas interpola; entre colunas usa
   * a declividade tabelada imediatamente abaixo (a favor da segurança, porque FL cresce com a
   * declividade). Declividade só conta se cada trecho cai para a própria saída (5.1.7 e 5.2.6).
   */
  function fatorComprimento(p) {
    const avisos = [];
    const W = p.W;
    const L = p.L;
    if (!positivo(W) || !positivo(L)) return { FL: null, avisos: [aviso('incompleta', 'sem-comprimento-calha', {})] };
    const LW = L / W;
    if (LW <= D.CURTA_ATE) return { FL: 1, LW: LW, curta: true, coluna: null, avisos: avisos };

    let decl = numero(p.declividade) ? p.declividade : 0;
    if (decl < 0) return { FL: null, LW: LW, avisos: [aviso('invalida', 'declividade-negativa', { declividade: decl })] };
    if (decl > D.NIVELADA_ATE && p.caimentoParaSaida === false) {
      avisos.push(nota('caimento-nao-aproveitado', { declividade: decl }));
      decl = 0;
    }
    if (decl <= D.NIVELADA_ATE) decl = 0;

    const cols = D.TABELA6.declividades;
    let ic = 0;
    for (let k = 0; k < cols.length; k++) if (decl >= cols[k]) ic = k;
    if (decl > cols[cols.length - 1]) avisos.push(nota('declividade-acima-da-tabela', { declividade: decl, usada: cols[ic] }));
    else if (decl > 0 && decl !== cols[ic]) avisos.push(nota('declividade-arredondada', { declividade: decl, usada: cols[ic] }));

    const linhas = D.TABELA6.linhas;
    if (LW > linhas[linhas.length - 1].LW) {
      avisos.push(aviso('fora_do_dominio', 'lw-acima-da-tabela', { LW: LW, maximo: linhas[linhas.length - 1].LW }));
      return { FL: null, LW: LW, curta: false, coluna: cols[ic], avisos: avisos };
    }
    let FL = linhas[0].FL[ic];
    for (let k = 1; k < linhas.length; k++) {
      if (LW <= linhas[k].LW) {
        const a = linhas[k - 1];
        const b = linhas[k];
        const t = (LW - a.LW) / (b.LW - a.LW);
        FL = a.FL[ic] + t * (b.FL[ic] - a.FL[ic]);
        break;
      }
    }
    return { FL: FL, LW: LW, curta: false, coluna: cols[ic], avisos: avisos };
  }

  /*
   * Capacidade de projeto de uma calha (5.1 e 5.2).
   * p: { tipo:'beiral'|'interna', forma, dims, L, declividade, caimentoParaSaida, angulo, ralo,
   *      obstrucao, QNensaio, Q }
   * Devolve a capacidade final Qcap (já com 0,9, FL, ângulo e ralo) e, havendo Q, a verificação.
   */
  function calha(p) {
    if (!dimsValidas(p.forma, p.dims)) {
      return { Qcap: null, avisos: [aviso('invalida', 'dimensoes-invalidas', { forma: p.forma })], situacao: 'invalida' };
    }
    if (p.tipo !== 'beiral' && p.tipo !== 'interna') {
      return { Qcap: null, avisos: [aviso('invalida', 'tipo-de-calha-invalido', { tipo: p.tipo })], situacao: 'invalida' };
    }
    const g = geometria(p);
    if (!g || !(g.area > 0)) {
      return { Qcap: null, avisos: [aviso('invalida', 'secao-sem-area', {})], situacao: 'invalida' };
    }
    const avisos = [];

    // A EN só dá capacidade de meia-cana como calha de beiral (5.1.2). Como calha interna,
    // a forma não está coberta: nada de inventar número.
    if (p.forma === 'semicircular' && p.tipo === 'interna') {
      avisos.push(aviso('sem_suporte', 'meia-cana-interna', {}));
      return { geometria: g, Qcap: null, avisos: avisos, situacao: situacao(avisos) };
    }

    let QN = null;
    let fd = null;
    let fs = null;
    let base = null;
    if (positivo(p.QNensaio)) {
      QN = p.QNensaio; // anexo A: ensaio substitui o cálculo, e o 0,9 continua valendo
      avisos.push(nota('capacidade-por-ensaio', { QN: QN }));
    } else if (p.forma === 'semicircular') {
      QN = D.K_SEMICIRCULAR * Math.pow(g.area, D.EXPOENTE_AREA);
      base = 'semicircular';
    } else {
      fd = Fd(g.W / g.T);
      fs = Fs(g.S / g.T);
      if (fd == null || fs == null) {
        avisos.push(aviso('fora_do_dominio', 'fora-das-figuras', { WT: g.W / g.T, ST: g.S / g.T }));
        return { geometria: g, Qcap: null, Fd: fd, Fs: fs, avisos: avisos, situacao: situacao(avisos) };
      }
      const k = p.tipo === 'beiral' ? D.K_BEIRAL_QUADRADA : D.K_INTERNA_QUADRADA;
      base = p.tipo === 'beiral' ? 'QSE' : 'QSV';
      QN = k * Math.pow(g.area, D.EXPOENTE_AREA) * fd * fs;
    }

    const QL = D.SEGURANCA * QN;
    const fl = fatorComprimento({ W: g.W, L: p.L, declividade: p.declividade, caimentoParaSaida: p.caimentoParaSaida });
    fl.avisos.forEach(function (a) { avisos.push(a); });
    if (fl.FL == null) {
      return { geometria: g, QN: QN, QL: QL, Fd: fd, Fs: fs, FL: null, Qcap: null, avisos: avisos, situacao: situacao(avisos) };
    }

    const fatorAngulo = p.angulo ? D.FATOR_ANGULO : 1; // 5.1.8
    if (p.angulo) avisos.push(nota('angulo-maior-que-10', {}));
    const fatorRalo = p.ralo ? D.FATOR_RALO : 1; // 5.3.3
    if (p.ralo) avisos.push(nota('ralo-no-bocal', {}));

    const Qcap = QL * fl.FL * fatorAngulo * fatorRalo;
    const res = {
      geometria: g,
      base: base,
      Fd: fd,
      Fs: fs,
      QN: QN,
      QL: QL,
      FL: fl.FL,
      LW: fl.LW,
      curta: fl.curta,
      colunaTabela6: fl.coluna,
      fatorAngulo: fatorAngulo,
      fatorRalo: fatorRalo,
      Qcap: Qcap,
    };
    if (positivo(p.Q)) {
      res.Q = p.Q;
      res.uso = p.Q / Qcap;
      res.ok = Qcap >= p.Q;
      if (!res.ok) avisos.push(aviso('nao_atende', 'calha-nao-escoa', { Q: p.Q, Qcap: Qcap }));
    }
    res.avisos = avisos;
    res.situacao = situacao(avisos);
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* 5.3 — bocais                                                        */
  /* ------------------------------------------------------------------ */

  // Nota 3 da Tabela 7: a carga disponível num bocal de calha de sola plana é h = Fh · W.
  function cargaDisponivel(g) {
    if (!g || !positivo(g.W) || !positivo(g.T)) return null;
    const f = Fh(g.S / g.T);
    return f == null ? null : f * g.W;
  }

  // Figura 9 — diâmetro efetivo. A legenda impressa da norma tem erro conhecido (SR 620 §7.1.2):
  // o limite é DO ≤ 1,5·di, coerente com di ≥ 2·DO/3.
  function diametroEfetivo(p) {
    const avisos = [];
    if (!positivo(p.DO)) return { D: null, avisos: [aviso('incompleta', 'sem-diametro-bocal', {})], situacao: 'incompleta' };
    if (p.borda === 'vivo') return { D: p.DO, avisos: avisos, situacao: 'atende' };
    if (!positivo(p.di)) return { D: null, avisos: [aviso('incompleta', 'sem-diametro-condutor', {})], situacao: 'incompleta' };
    if (p.DO > 1.5 * p.di) avisos.push(aviso('fora_do_dominio', 'bocal-largo-demais', { DO: p.DO, di: p.di }));
    if (p.borda === 'conico') {
      if (!positivo(p.LT) || p.LT < p.DO) avisos.push(aviso('fora_do_dominio', 'cone-curto', { LT: p.LT, DO: p.DO }));
      return { D: p.DO, avisos: avisos, situacao: situacao(avisos) };
    }
    if (p.borda === 'arredondado') {
      if (!positivo(p.R) || p.R < p.DO / 6) avisos.push(aviso('fora_do_dominio', 'raio-pequeno', { R: p.R, DO: p.DO }));
      return { D: 0.9 * p.DO, avisos: avisos, situacao: situacao(avisos) };
    }
    return { D: null, avisos: [aviso('invalida', 'borda-desconhecida', { borda: p.borda })], situacao: 'invalida' };
  }

  // Tabela 7 — capacidade do bocal, em l/s. Circular usa o diâmetro efetivo D; não circular usa o
  // comprimento de vertedor LW e a área em planta AO. ko = 0,5 com grelha ou ralo.
  function capacidadeBocal(p) {
    const ko = p.grelha ? D.TABELA7.koComGrelha : D.TABELA7.koSemGrelha;
    const h = p.h;
    if (!positivo(h)) return { Q: null, avisos: [aviso('incompleta', 'sem-carga', {})], situacao: 'incompleta' };
    const avisos = [];
    let Q = null;
    let regime = null;
    if (p.tipo === 'circular') {
      if (!positivo(p.D)) return { Q: null, avisos: [aviso('incompleta', 'sem-diametro-bocal', {})], situacao: 'incompleta' };
      if (h <= p.D / 2) {
        Q = (ko * p.D * Math.pow(h, 1.5)) / D.TABELA7.circularVertedor;
        regime = 'vertedor';
        if (positivo(p.folga) && p.folga < D.TABELA7.folgaLateral * p.D) {
          avisos.push(aviso('fora_do_dominio', 'folga-insuficiente', { folga: p.folga, minimo: D.TABELA7.folgaLateral * p.D }));
        }
      } else {
        Q = (ko * p.D * p.D * Math.sqrt(h)) / D.TABELA7.circularOrificio;
        regime = 'orificio';
      }
    } else if (p.tipo === 'nao-circular') {
      if (!positivo(p.LW) || !positivo(p.AO)) return { Q: null, avisos: [aviso('incompleta', 'sem-bocal-nao-circular', {})], situacao: 'incompleta' };
      if (h <= (2 * p.AO) / p.LW) {
        Q = (ko * p.LW * Math.pow(h, 1.5)) / D.TABELA7.naoCircularVertedor;
        regime = 'vertedor';
      } else {
        Q = (ko * p.AO * Math.sqrt(h)) / D.TABELA7.naoCircularOrificio;
        regime = 'orificio';
      }
    } else {
      return { Q: null, avisos: [aviso('invalida', 'tipo-de-bocal-invalido', { tipo: p.tipo })], situacao: 'invalida' };
    }
    if (positivo(p.Q)) {
      avisos.push(Q >= p.Q ? nota('bocal-ok', { Q: p.Q, Qcap: Q }) : aviso('nao_atende', 'bocal-nao-escoa', { Q: p.Q, Qcap: Q }));
    }
    return { Q: Q, ko: ko, regime: regime, h: h, avisos: avisos, situacao: situacao(avisos) };
  }

  // Menor diâmetro efetivo circular que passa Q com a carga h (inverte a Tabela 7).
  function diametroBocalCircular(p) {
    if (!positivo(p.Q) || !positivo(p.h)) return null;
    const ko = p.grelha ? D.TABELA7.koComGrelha : D.TABELA7.koSemGrelha;
    const Dvertedor = (p.Q * D.TABELA7.circularVertedor) / (ko * Math.pow(p.h, 1.5));
    if (Dvertedor >= 2 * p.h) return { D: Dvertedor, regime: 'vertedor' };
    const Dorificio = Math.sqrt((p.Q * D.TABELA7.circularOrificio) / (ko * Math.sqrt(p.h)));
    return { D: Dorificio, regime: 'orificio' };
  }

  // 5.3.2 e Figura 8 — bocal de calha de sola não plana (meia-cana): a norma não dá fórmula;
  // considera satisfatória a abertura com área em planta ≥ 2× a seção do menor condutor capaz.
  function bocalSolaNaoPlana(p) {
    const cond = dimensionarCondutor({ Q: p.Q, f: p.f });
    if (!cond.di) return { areaMinima: null, avisos: cond.avisos, situacao: cond.situacao };
    const secao = (Math.PI * cond.di * cond.di) / 4;
    return {
      di: cond.di,
      areaMinima: D.AREA_BOCAL_SOLA_NAO_PLANA * secao,
      avisos: [nota('bocal-por-area', { di: cond.di })].concat(cond.avisos),
      situacao: 'atende',
    };
  }

  // 5.3.5 e Figura 12 — comprimento de vertedor de uma caixa coletora para a vazão Q com carga h.
  function caixaColetora(p) {
    if (!positivo(p.Q) || !positivo(p.h)) return { LW: null, avisos: [aviso('incompleta', 'sem-dados-caixa', {})], situacao: 'incompleta' };
    return {
      LW: (p.Q * D.TABELA7.naoCircularVertedor) / Math.pow(p.h, 1.5),
      avisos: [],
      situacao: 'atende',
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6.1 — condutores verticais                                          */
  /* ------------------------------------------------------------------ */

  // Equação de Wyly-Eaton, base da Tabela 8.
  function condutor(p) {
    const f = p.f == null ? D.TABELA8.fPadrao : p.f;
    if (!positivo(p.di)) return { Q: null, avisos: [aviso('incompleta', 'sem-diametro-condutor', {})], situacao: 'incompleta' };
    if (!numero(f) || f < D.TABELA8.fMinimo || f > D.TABELA8.fPadrao) {
      return { Q: null, avisos: [aviso('invalida', 'enchimento-fora-da-faixa', { f: f })], situacao: 'invalida' };
    }
    const Q = 2.5e-4 * Math.pow(D.TABELA8.kb, -0.167) * Math.pow(p.di, 2.667) * Math.pow(f, 1.667);
    const avisos = [];
    if (p.di < D.TABELA8.dnRiscoEntupimento) avisos.push(nota('risco-de-entupimento', { di: p.di }));
    return { Q: Q, f: f, avisos: avisos, situacao: situacao(avisos) };
  }

  // Valor impresso da Tabela 8, quando o diâmetro e o enchimento são exatamente os da tabela.
  function condutorTabela8(di, f) {
    const col = D.TABELA8.Q[f];
    if (!col) return null;
    const k = D.TABELA8.diametros.findIndex(function (x) { return Math.abs(x - di) <= 0.05; });
    return k < 0 ? null : col[k];
  }

  /*
   * Menor condutor que passa Q. Sem lista de tubos, usa os diâmetros da Tabela 8 e, quando o
   * enchimento é o da tabela, o valor impresso; com lista, calcula pelo Di real de cada tubo.
   */
  function dimensionarCondutor(p) {
    const f = p.f == null ? D.TABELA8.fPadrao : p.f;
    if (!positivo(p.Q)) return { di: null, avisos: [aviso('incompleta', 'sem-vazao', {})], situacao: 'incompleta' };
    const lista = (p.tubos && p.tubos.length ? p.tubos.slice() : D.TABELA8.diametros.map(function (di) { return { di: di }; }))
      .filter(function (t) { return positivo(t.di); })
      .sort(function (a, b) { return a.di - b.di; });
    const linhas = lista.map(function (t) {
      const impresso = p.tubos && p.tubos.length ? null : condutorTabela8(t.di, f);
      const calc = condutor({ di: t.di, f: f });
      return Object.assign({}, t, {
        Qtabela: impresso,
        Qcalculado: calc.Q,
        Q: impresso != null ? impresso : calc.Q,
        fonte: impresso != null ? 'Tabela 8' : 'Wyly-Eaton',
      });
    });
    const escolhido = linhas.find(function (l) { return l.Q != null && l.Q >= p.Q; }) || null;
    const avisos = [];
    if (!escolhido) avisos.push(aviso('nao_atende', 'sem-condutor-suficiente', { Q: p.Q }));
    else if (escolhido.di < D.TABELA8.dnRiscoEntupimento) avisos.push(nota('risco-de-entupimento', { di: escolhido.di }));
    return {
      di: escolhido ? escolhido.di : null,
      escolhido: escolhido,
      linhas: linhas,
      f: f,
      avisos: avisos,
      situacao: situacao(avisos),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6.3 e anexo C — coletores                                           */
  /* ------------------------------------------------------------------ */

  // Colebrook-White num tubo circular parcialmente cheio (padrão: 70 % de enchimento).
  // di em mm, declividade i em m/m. Devolve Q em l/s e v em m/s.
  function coletor(p) {
    const enchimento = p.enchimento == null ? D.ENCHIMENTO_COLETOR : p.enchimento;
    if (!positivo(p.di) || !positivo(p.i)) return { Q: null, avisos: [aviso('incompleta', 'sem-dados-coletor', {})], situacao: 'incompleta' };
    if (!(enchimento > 0 && enchimento <= 1)) return { Q: null, avisos: [aviso('invalida', 'enchimento-invalido', { enchimento: enchimento })], situacao: 'invalida' };
    const kb = (p.kb == null ? D.KB_COLETOR : p.kb) / 1000;
    const nu = p.nu == null ? D.VISCOSIDADE : p.nu;
    const dia = p.di / 1000;
    const teta = 2 * Math.acos(1 - 2 * enchimento);
    const A = ((dia * dia) / 8) * (teta - Math.sin(teta));
    const P = (dia * teta) / 2;
    const Dh = (4 * A) / P;
    const raiz = Math.sqrt(2 * 9.81 * Dh * p.i);
    const v = -2 * raiz * Math.log10(kb / (3.71 * Dh) + (2.51 * nu) / (Dh * raiz));
    const avisos = [];
    if (positivo(p.diCondutor) && p.di < p.diCondutor) avisos.push(aviso('nao_atende', 'coletor-menor-que-condutor', { di: p.di, diCondutor: p.diCondutor }));
    if (p.dn != null && p.dn < D.DN_MINIMO_COLETOR) avisos.push(aviso('nao_atende', 'coletor-abaixo-do-dn-minimo', { dn: p.dn }));
    return { Q: A * v * 1000, v: v, A: A, P: P, Dh: Dh, enchimento: enchimento, avisos: avisos, situacao: situacao(avisos) };
  }

  // Par [Q, v] impresso na Tabela C.1, quando o DN e a declividade são os da tabela.
  function coletorTabelaC1(dn, i) {
    const linha = D.TABELA_C1.valores[dn];
    if (!linha) return null;
    const k = D.TABELA_C1.declividades.findIndex(function (x) { return Math.abs(x - i) < 1e-9; });
    return k < 0 ? null : { Q: linha[k][0], v: linha[k][1] };
  }

  function dimensionarColetor(p) {
    if (!positivo(p.Q) || !positivo(p.i)) return { escolhido: null, avisos: [aviso('incompleta', 'sem-dados-coletor', {})], situacao: 'incompleta' };
    const lista = (p.tubos || D.TABELA_C1.dn.map(function (dn) { return { dn: dn, di: D.DI_TABELA_C1[dn] }; }))
      .filter(function (t) { return positivo(t.di); })
      .sort(function (a, b) { return a.di - b.di; });
    const linhas = lista.map(function (t) {
      const r = coletor({ di: t.di, i: p.i, kb: p.kb, nu: p.nu, enchimento: p.enchimento });
      return Object.assign({}, t, { Q: r.Q, v: r.v });
    });
    const minimo = p.diCondutor || 0;
    const escolhido = linhas.find(function (l) {
      return l.Q >= p.Q && l.di >= minimo && (l.dn == null || l.dn >= D.DN_MINIMO_COLETOR);
    }) || null;
    const avisos = escolhido ? [] : [aviso('nao_atende', 'sem-coletor-suficiente', { Q: p.Q })];
    return { escolhido: escolhido, linhas: linhas, avisos: avisos, situacao: situacao(avisos) };
  }

  /* ------------------------------------------------------------------ */
  /* Dimensionamento direto de calhas (usado pelo modo simples)          */
  /* ------------------------------------------------------------------ */

  // Menor meia-cana de beiral que escoa Q, em passos de "passo" mm (só a EN, sem catálogo).
  function menorMeiaCana(p) {
    const passo = p.passo || 5;
    const limite = p.limite || 600;
    for (let Dmm = passo; Dmm <= limite; Dmm += passo) {
      const r = calha({
        tipo: 'beiral', forma: 'semicircular', dims: { D: Dmm }, L: p.L,
        declividade: p.declividade, caimentoParaSaida: p.caimentoParaSaida,
        angulo: p.angulo, ralo: p.ralo, Q: p.Q,
      });
      if (r.Qcap != null && r.Qcap >= p.Q) return { D: Dmm, calha: r };
    }
    return { D: null, calha: null };
  }

  // Menor calha retangular que escoa Q, na proporção largura/profundidade pedida (padrão 2:1,
  // que é a mais eficiente das retangulares) e em passos de "passo" mm.
  function menorRetangular(p) {
    const passo = p.passo || 5;
    const limite = p.limite || 600;
    const razao = p.razao || 2;
    for (let Z = passo; Z <= limite; Z += passo) {
      const T = Math.ceil((razao * Z) / passo) * passo;
      const r = calha({
        tipo: p.tipo || 'beiral', forma: 'retangular', dims: { T: T, Z: Z }, L: p.L,
        declividade: p.declividade, caimentoParaSaida: p.caimentoParaSaida,
        angulo: p.angulo, ralo: p.ralo, obstrucao: p.obstrucao, Q: p.Q,
      });
      if (r.Qcap != null && r.Qcap >= p.Q) return { T: T, Z: Z, calha: r };
    }
    return { T: null, Z: null, calha: null };
  }

  return {
    DADOS: D,
    ESTADOS: ESTADOS,
    piorEstado: piorEstado,
    situacao: situacao,
    FORMAS: FORMAS,
    naCurva: naCurva,
    Fd: Fd,
    Fs: Fs,
    Fh: Fh,
    fatorRisco: fatorRisco,
    intensidade: intensidade,
    probabilidadeExcedencia: probabilidadeExcedencia,
    areaEfetiva: areaEfetiva,
    vazao: vazao,
    bordoLivre: bordoLivre,
    geometria: geometria,
    fatorComprimento: fatorComprimento,
    calha: calha,
    cargaDisponivel: cargaDisponivel,
    diametroEfetivo: diametroEfetivo,
    capacidadeBocal: capacidadeBocal,
    diametroBocalCircular: diametroBocalCircular,
    bocalSolaNaoPlana: bocalSolaNaoPlana,
    caixaColetora: caixaColetora,
    condutor: condutor,
    condutorTabela8: condutorTabela8,
    dimensionarCondutor: dimensionarCondutor,
    coletor: coletor,
    coletorTabelaC1: coletorTabelaC1,
    dimensionarColetor: dimensionarColetor,
    menorMeiaCana: menorMeiaCana,
    menorRetangular: menorRetangular,
  };
});
