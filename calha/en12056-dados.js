/*
 * Dados tabelados da EN 12056-3:2000 — Sistemas de drenagem por gravidade dentro dos edifícios,
 * parte 3: drenagem de coberturas. Base da versão 4.0 do app (italiano e sueco).
 *
 * Valores transcritos das Tabelas 1, 2, 5, 6, 7, 8 e C.1 e das Figuras 5, 6 e 10. As três curvas
 * são figuras vetoriais no PDF da norma: os pontos abaixo foram lidos do próprio desenho e
 * calibrados pelas linhas internas da grade (resíduo < 0,001). Nenhum texto da norma é reproduzido.
 *
 * Unidades da norma: comprimentos de calha, bocal e tubo em mm; área de seção em mm²; área de
 * cobertura em m²; vazão em l/s; intensidade de chuva em l/(s·m²).
 *
 * Script clássico (não-módulo) para o site abrir direto do disco (file://);
 * em Node é carregado por require() nos testes.
 */
(function (root) {
  'use strict';

  // Tabela 1 (4.2.2) — intensidades mínimas de chuva, em l/(s·m²).
  const TABELA1 = [0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06];

  // Tabela 2 (4.2.2) — fatores de risco. Os rótulos ficam na camada de idioma.
  const TABELA2 = [
    { id: 'beiral', fator: 1.0 },
    { id: 'beiral-transtorno', fator: 1.5 },
    { id: 'interna', fator: 2.0 },
    { id: 'interna-excepcional', fator: 3.0 },
  ];

  // Tabela 3 (4.3.3) — área efetiva quando a prática nacional manda considerar vento.
  // 'sem-vento' é 4.3.2, o padrão da norma (4.3.1).
  const METODOS_AREA = ['sem-vento', 'chuva-26-graus', 'chuva-perpendicular'];

  // Tabela 5 (5.2.2) — bordo livre mínimo de calha de água-furtada e de platibanda, em mm,
  // em função da profundidade total Z (mm).
  // "menor que 85" é exclusivo: em Z = 85 já vale 0,3·Z.
  const TABELA5 = [
    { ateZ: 85, exclusivo: true, bordo: 25 },
    { ateZ: 250, fracaoZ: 0.3 },
    { ateZ: Infinity, bordo: 75 },
  ];

  // Tabela 6 (5.1.6, 5.2.5) — fator de capacidade FL de calhas longas.
  // Colunas: nivelada (0 a 3 mm/m) e declividades de 4, 6, 8 e 10 mm/m, todas caindo para a saída.
  const TABELA6 = {
    declividades: [0, 4, 6, 8, 10],
    linhas: [
      { LW: 50, FL: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { LW: 75, FL: [0.97, 1.02, 1.04, 1.07, 1.09] },
      { LW: 100, FL: [0.93, 1.03, 1.08, 1.13, 1.18] },
      { LW: 125, FL: [0.9, 1.05, 1.12, 1.2, 1.27] },
      { LW: 150, FL: [0.86, 1.07, 1.17, 1.27, 1.37] },
      { LW: 175, FL: [0.83, 1.08, 1.21, 1.33, 1.46] },
      { LW: 200, FL: [0.8, 1.1, 1.25, 1.4, 1.55] },
      { LW: 225, FL: [0.78, 1.1, 1.25, 1.4, 1.55] },
      { LW: 250, FL: [0.77, 1.1, 1.25, 1.4, 1.55] },
      { LW: 275, FL: [0.75, 1.1, 1.25, 1.4, 1.55] },
      { LW: 300, FL: [0.73, 1.1, 1.25, 1.4, 1.55] },
      { LW: 325, FL: [0.72, 1.1, 1.25, 1.4, 1.55] },
      { LW: 350, FL: [0.7, 1.1, 1.25, 1.4, 1.55] },
      { LW: 375, FL: [0.68, 1.1, 1.25, 1.4, 1.55] },
      { LW: 400, FL: [0.67, 1.1, 1.25, 1.4, 1.55] },
      { LW: 425, FL: [0.65, 1.1, 1.25, 1.4, 1.55] },
      { LW: 450, FL: [0.63, 1.1, 1.25, 1.4, 1.55] },
      { LW: 475, FL: [0.62, 1.1, 1.25, 1.4, 1.55] },
      { LW: 500, FL: [0.6, 1.1, 1.25, 1.4, 1.55] },
    ],
  };

  // Tabela 7 (5.3.4) — capacidade de bocal de calha com sola plana. Só os divisores: as fórmulas
  // ficam no núcleo. kO = 1,0 sem grelha e 0,5 com grelha ou ralo.
  const TABELA7 = {
    circularVertedor: 7500, // Q = kO · D · h^1,5 / 7500, válido com h ≤ D/2
    circularOrificio: 15000, // Q = kO · D² · h^0,5 / 15000, válido com h > D/2
    naoCircularVertedor: 24000, // Q = kO · LW · h^1,5 / 24000, válido com h ≤ 2·AO/LW
    naoCircularOrificio: 12000, // Q = kO · AO · h^0,5 / 12000
    koSemGrelha: 1.0,
    koComGrelha: 0.5,
    folgaLateral: 0.05, // nota 2: folga ≥ 5 % do diâmetro para valer a fórmula de vertedor
  };

  // Tabela 8 (6.1.1) — capacidade de condutores verticais circulares, l/s, pela equação de
  // Wyly-Eaton com kb = 0,25 mm. Acima de di = 300 mm a própria norma manda usar a equação.
  const TABELA8 = {
    diametros: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130,
      140, 150, 160, 170, 180, 190, 200, 220, 240, 260, 280, 300],
    Q: {
      0.2: [0.7, 0.9, 1.2, 1.5, 1.8, 2.2, 2.6, 3.0, 3.5, 4.0, 4.6, 6.0, 7.6, 9.4,
        11.4, 13.7, 16.3, 19.1, 22.3, 25.7, 29.5, 38.1, 48.0, 59.4, 72.4, 87.1],
      0.33: [1.7, 2.2, 2.7, 3.4, 4.1, 5.0, 5.9, 6.9, 8.1, 9.3, 10.7, 13.8, 17.4, 21.6,
        26.3, 31.6, 37.5, 44.1, 51.4, 59.3, 68.0, 87.7, 110.6, 137.0, 166.9, 200.6],
    },
    kb: 0.25,
    fPadrao: 0.33,
    fMinimo: 0.2,
    dnRiscoEntupimento: 75, // 6.1.3
  };

  // Tabela C.1 (anexo C, informativo) — coletores a 70 % de enchimento, Colebrook-White com
  // kb = 1,0 mm e ν = 1,31·10⁻⁶ m²/s. Cada par é [Q em l/s, v em m/s].
  // Conferido em 19/09/2026: a tabela sai exata da equação com UM diâmetro interno por DN
  // (DI_TABELA_C1), o mesmo nas dez declividades — o DN nominal não é o diâmetro de cálculo.
  const TABELA_C1 = {
    declividades: [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05],
    dn: [100, 125, 150, 200, 225, 250, 300],
    valores: {
      100: [[2.9, 0.5], [4.2, 0.8], [5.1, 1.0], [5.9, 1.1], [6.7, 1.2], [7.3, 1.3], [7.9, 1.5], [8.4, 1.6], [8.9, 1.7], [9.4, 1.7]],
      125: [[4.8, 0.6], [6.8, 0.9], [8.3, 1.1], [9.6, 1.2], [10.8, 1.4], [11.8, 1.5], [12.8, 1.6], [13.7, 1.8], [14.5, 1.9], [15.3, 2.0]],
      150: [[9.0, 0.7], [12.8, 1.0], [15.7, 1.3], [18.2, 1.5], [20.3, 1.6], [22.3, 1.8], [24.1, 1.9], [25.8, 2.1], [27.3, 2.2], [28.8, 2.3]],
      200: [[16.7, 0.8], [23.7, 1.2], [29.1, 1.5], [33.6, 1.7], [37.6, 1.9], [41.2, 2.1], [44.5, 2.2], [47.6, 2.4], [50.5, 2.5], [53.3, 2.7]],
      225: [[26.5, 0.9], [37.6, 1.3], [46.2, 1.6], [53.3, 1.9], [59.7, 2.1], [65.4, 2.3], [70.6, 2.5], [75.5, 2.7], [80.1, 2.8], [84.5, 3.0]],
      250: [[31.6, 1.0], [44.9, 1.4], [55.0, 1.7], [63.6, 2.0], [71.1, 2.2], [77.9, 2.4], [84.2, 2.6], [90.0, 2.8], [95.5, 3.0], [100.7, 3.1]],
      300: [[56.8, 1.1], [80.6, 1.6], [98.8, 2.0], [114.2, 2.3], [127.7, 2.6], [140.0, 2.8], [151.2, 3.0], [161.7, 3.2], [171.5, 3.4], [180.8, 3.6]],
    },
  };

  // Diâmetro interno com que cada DN da Tabela C.1 foi calculado (ver nota acima).
  const DI_TABELA_C1 = { 100: 96, 125: 115, 150: 146, 200: 184, 225: 219, 250: 234, 300: 292 };

  // Figura 5 — coeficiente de altura Fd em função de W/T. Pontos lidos do vetor do PDF; as
  // extremidades foram encostadas nos limites desenhados dos eixos (0, 1 e 3), de onde a espessura
  // do traço as afastava por menos de 0,004.
  const FIGURA5_FD = [
    [0.004, 0.1155], [0.008, 0.228], [0.015, 0.3391], [0.02, 0.3832], [0.03, 0.4269],
    [0.043, 0.4691], [0.061, 0.5106], [0.084, 0.5513], [0.109, 0.5897], [0.138, 0.6258],
    [0.17, 0.6608], [0.205, 0.6923], [0.243, 0.7216], [0.285, 0.7486], [0.328, 0.7718],
    [0.423, 0.8171], [0.522, 0.8581], [0.621, 0.895], [0.722, 0.9292], [0.826, 0.9577],
    [0.929, 0.984], [1.156, 1.0346], [1.383, 1.0809], [1.611, 1.1247], [1.84, 1.1646],
    [2.07, 1.2007], [2.3, 1.2334], [2.532, 1.2631], [2.764, 1.2882], [3, 1.3102],
  ];

  // Figura 6 — coeficiente de forma Fs em função de S/T (S = largura do fundo plano).
  const FIGURA6_FS = [
    [0, 0.8911], [0.037, 0.8992], [0.074, 0.907], [0.112, 0.9146], [0.151, 0.9219],
    [0.19, 0.9289], [0.231, 0.9356], [0.272, 0.942], [0.314, 0.9481], [0.355, 0.954],
    [0.399, 0.9594], [0.442, 0.9645], [0.486, 0.9694], [0.531, 0.9738], [0.576, 0.978],
    [0.622, 0.9818], [0.668, 0.9853], [0.715, 0.9884], [0.761, 0.9912], [0.808, 0.9937],
    [0.856, 0.9958], [0.903, 0.9975], [0.951, 0.9989], [1, 1.0],
  ];

  // Figura 10 — coeficiente de carga no bocal Fh em função de S/T (nota 3 da Tabela 7: h = Fh · W).
  const FIGURA10_FH = [
    [0, 0.6489], [0.043, 0.6322], [0.086, 0.6164], [0.131, 0.6014], [0.176, 0.5869],
    [0.223, 0.5732], [0.272, 0.5606], [0.321, 0.5485], [0.372, 0.5376], [0.424, 0.5276],
    [0.476, 0.5179], [0.53, 0.5096], [0.584, 0.5022], [0.639, 0.4954], [0.71, 0.488],
    [0.781, 0.4819], [0.853, 0.4768], [0.925, 0.473], [1, 0.4701],
  ];

  const api = {
    TABELA1: TABELA1,
    TABELA2: TABELA2,
    METODOS_AREA: METODOS_AREA,
    TABELA5: TABELA5,
    TABELA6: TABELA6,
    TABELA7: TABELA7,
    TABELA8: TABELA8,
    TABELA_C1: TABELA_C1,
    DI_TABELA_C1: DI_TABELA_C1,
    FIGURA5_FD: FIGURA5_FD,
    FIGURA6_FS: FIGURA6_FS,
    FIGURA10_FH: FIGURA10_FH,

    // Constantes do método (cláusulas 5 e 6).
    SEGURANCA: 0.9, // 5.1.2, 5.1.4, 5.2.3: QL = 0,9 · QN
    K_SEMICIRCULAR: 2.78e-5, // 5.1.2: QN = 2,78·10⁻⁵ · AE^1,25
    K_BEIRAL_QUADRADA: 3.48e-5, // 5.1.4: QSE
    K_INTERNA_QUADRADA: 3.89e-5, // 5.2.3: QSV
    EXPOENTE_AREA: 1.25,
    NIVELADA_ATE: 3, // 5.1.1 e 5.2.1: até 3 mm/m projeta-se como nivelada
    CURTA_ATE: 50, // 5.1.6 e 5.2.5: curta se L ≤ 50·W
    ANGULO_LIMITE: 10, // 5.1.8: ângulo maior que 10°
    FATOR_ANGULO: 0.85, // 5.1.8
    FATOR_RALO: 0.5, // 5.3.3: ralo em bocal de sola não plana
    AREA_BOCAL_SOLA_NAO_PLANA: 2, // 5.3.2 e Figura 8: 2× a seção do menor condutor capaz
    KB_COLETOR: 1.0, // anexo C
    VISCOSIDADE: 1.31e-6, // anexo C, m²/s
    ENCHIMENTO_COLETOR: 0.7, // 6.1.2 e anexo C
    DN_MINIMO_COLETOR: 100, // 6.3.3
    VAZAO_MAXIMA_EM_ESGOTO: 1.0, // 6.4 d)
    DI_MINIMO_SIFONICO: 32, // 6.2.9
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EN12056_DADOS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
