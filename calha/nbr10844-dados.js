/*
 * Dados tabelados da ABNT NBR 10844:1989 — Instalações prediais de águas pluviais.
 * Valores numéricos transcritos das Tabelas 1 a 5 da norma (a Tabela 5 reproduz
 * "Chuvas intensas no Brasil", Otto Pfafstetter, 1957). Grafias e UFs como na norma.
 *
 * Script clássico (não-módulo) para o site abrir direto do disco (file://);
 * em Node é carregado por require() nos testes.
 */
(function (root) {
  'use strict';

  // Tabela 1 — coeficientes multiplicativos da vazão de projeto (item 5.5.6):
  // saída a menos de 4 m de uma mudança de direção da calha.
  const TABELA1 = {
    'canto-reto': { rotulo: 'Canto reto', ate2m: 1.2, de2a4m: 1.1 },
    'canto-arredondado': { rotulo: 'Canto arredondado', ate2m: 1.1, de2a4m: 1.05 },
  };

  // Tabela 2 — coeficientes de rugosidade n (Manning-Strickler).
  const TABELA2 = [
    { id: 'plastico', n: 0.011, rotulo: 'Plástico, fibrocimento, aço, metais não-ferrosos' },
    { id: 'ferro', n: 0.012, rotulo: 'Ferro fundido, concreto alisado, alvenaria revestida' },
    { id: 'ceramica', n: 0.013, rotulo: 'Cerâmica, concreto não-alisado' },
    { id: 'tijolo', n: 0.015, rotulo: 'Alvenaria de tijolos não-revestida' },
  ];

  // Tabela 3 — capacidade de calhas semicirculares, n = 0,011, lâmina = D/2 (L/min).
  const TABELA3 = {
    declividades: [0.005, 0.01, 0.02],
    linhas: [
      { D: 100, Q: [130, 183, 256] },
      { D: 125, Q: [236, 333, 466] },
      { D: 150, Q: [384, 541, 757] },
      { D: 200, Q: [829, 1167, 1634] },
    ],
  };

  // Tabela 4 — capacidade de condutores horizontais de seção circular,
  // lâmina = 2/3 D (L/min). Chave = n; cada linha = [0,5% 1% 2% 4%].
  const TABELA4 = {
    declividades: [0.005, 0.01, 0.02, 0.04],
    diametros: [50, 75, 100, 125, 150, 200, 250, 300],
    Q: {
      0.011: [
        [32, 45, 64, 90], [95, 133, 188, 267], [204, 287, 405, 575], [370, 521, 735, 1040],
        [602, 847, 1190, 1690], [1300, 1820, 2570, 3650], [2350, 3310, 4660, 6620],
        [3820, 5380, 7590, 10800],
      ],
      0.012: [
        [29, 41, 59, 83], [87, 122, 172, 245], [187, 264, 372, 527], [339, 478, 674, 956],
        [552, 777, 1100, 1550], [1190, 1670, 2360, 3350], [2150, 3030, 4280, 6070],
        [3500, 4930, 6960, 9870],
      ],
      0.013: [
        [27, 38, 54, 76], [80, 113, 159, 226], [173, 243, 343, 486], [313, 441, 622, 882],
        [509, 717, 1010, 1430], [1100, 1540, 2180, 3040], [1990, 2800, 3950, 5600],
        [3230, 4550, 6420, 9110],
      ],
    },
  };

  // Tabela 5 — chuvas intensas no Brasil, duração 5 min (mm/h).
  // [local, I(T=1), I(T=5), T real da 2ª coluna, I(T=25), T real da 3ª coluna]
  // Quando a norma põe um período entre parênteses (observação insuficiente),
  // o T real vai no campo correspondente; null = sem dado ("-").
  const T5 = [
    ['Alegrete/RS', 174, 238, 5, 313, 17],
    ['Alto Itatiaia/RJ', 124, 164, 5, 240, 25],
    ['Alto Tapajós/PA', 168, 229, 5, 267, 21],
    ['Alto Teresópolis/RJ', 114, 137, 3, null, null],
    ['Aracaju/SE', 116, 122, 5, 126, 25],
    ['Avaré/SP', 115, 144, 5, 170, 25],
    ['Bagé/RS', 126, 204, 5, 234, 10],
    ['Barbacena/MG', 156, 222, 5, 265, 12],
    ['Barra do Corda/MA', 120, 128, 5, 152, 20],
    ['Bauru/SP', 110, 120, 5, 148, 9],
    ['Belém/PA', 138, 157, 5, 185, 20],
    ['Belo Horizonte/MG', 132, 227, 5, 230, 12],
    ['Blumenau/SC', 120, 125, 5, 152, 15],
    ['Bonsucesso/MG', 143, 196, 5, null, null],
    ['Cabo Frio/RJ', 113, 146, 5, 218, 25],
    ['Campos/RJ', 132, 206, 5, 240, 25],
    ['Campos do Jordão/SP', 122, 144, 5, 164, 9],
    ['Catalão/GO', 132, 174, 5, 198, 22],
    ['Caxambu/MG', 106, 137, 3, null, null],
    ['Caxias do Sul/RS', 120, 127, 5, 218, 25],
    ['Corumbá/MT', 120, 131, 5, 161, 9],
    ['Cruz Alta/RS', 204, 246, 5, 347, 14],
    ['Cuiabá/MT', 144, 190, 5, 230, 12],
    ['Curitiba/PR', 132, 204, 5, 228, 25],
    ['Encruzilhada/RS', 106, 126, 5, 158, 17],
    ['Fernando de Noronha/FN', 110, 120, 5, 140, 6],
    ['Florianópolis/SC', 114, 120, 5, 144, 25],
    ['Formosa/GO', 136, 176, 5, 217, 20],
    ['Fortaleza/CE', 120, 156, 5, 180, 21],
    ['Goiânia/GO', 120, 178, 5, 192, 17],
    ['Guaramiranga/CE', 114, 126, 5, 152, 19],
    ['Iraí/RS', 120, 198, 5, 228, 16],
    ['Jacarezinho/PR', 115, 122, 5, 146, 11],
    ['João Pessoa/PB', 115, 140, 5, 163, 23],
    ['Juaretê/AM', 192, 240, 5, 288, 10],
    ['km 47 - Rodovia Presidente Dutra/RJ', 122, 164, 5, 174, 14],
    ['Lins/SP', 96, 122, 5, 137, 13],
    ['Maceió/AL', 102, 122, 5, 174, 25],
    ['Manaus/AM', 138, 180, 5, 198, 25],
    ['Natal/RN', 113, 120, 5, 143, 19],
    ['Nazaré/PE', 118, 134, 5, 155, 19],
    ['Niterói/RJ', 130, 183, 5, 250, 25],
    ['Nova Friburgo/RJ', 120, 124, 5, 156, 25],
    ['Olinda/PE', 115, 167, 5, 173, 20],
    ['Ouro Preto/MG', 120, 211, 5, null, null],
    ['Paracatu/MG', 122, 233, 5, null, null],
    ['Paranaguá/PR', 127, 186, 5, 191, 23],
    ['Paratins/AM', 130, 200, 5, 205, 13],
    ['Passa Quatro/MG', 118, 180, 5, 192, 10],
    ['Passo Fundo/RS', 110, 125, 5, 180, 25],
    ['Petrópolis/RJ', 120, 126, 5, 156, 25],
    ['Pinheiral/RJ', 142, 214, 5, 244, 25],
    ['Piracicaba/SP', 119, 122, 5, 151, 10],
    ['Ponta Grossa/PR', 120, 126, 5, 148, 25],
    ['Porto Alegre/RS', 118, 146, 5, 167, 21],
    ['Porto Velho/RO', 130, 167, 5, 184, 10],
    ['Quixeramobim/CE', 115, 121, 5, 126, 25],
    ['Resende/RJ', 130, 203, 5, 264, 25],
    ['Rio Branco/AC', 126, 139, 2, null, null],
    ['Rio de Janeiro/RJ (Bangu)', 122, 156, 5, 174, 20],
    ['Rio de Janeiro/RJ (Ipanema)', 119, 125, 5, 160, 15],
    ['Rio de Janeiro/RJ (Jacarepaguá)', 120, 142, 5, 152, 6],
    ['Rio de Janeiro/RJ (Jardim Botânico)', 122, 167, 5, 227, 25],
    ['Rio de Janeiro/RJ (Praça XV)', 120, 174, 5, 204, 14],
    ['Rio de Janeiro/RJ (Praça Saenz Peña)', 125, 139, 5, 167, 18],
    ['Rio de Janeiro/RJ (Santa Cruz)', 121, 132, 5, 172, 20],
    ['Rio Grande/RS', 121, 204, 5, 222, 20],
    ['Salvador/BA', 108, 122, 5, 145, 24],
    ['Santa Maria/RS', 114, 122, 5, 145, 16],
    ['Santa Maria Madalena/RJ', 120, 126, 5, 152, 7],
    ['Santa Vitória do Palmar/RS', 120, 126, 5, 152, 18],
    ['Santos/SP', 136, 198, 5, 240, 25],
    ['Santos-Itapema/SP', 120, 174, 5, 204, 21],
    ['São Carlos/SP', 120, 178, 5, 161, 10],
    ['São Francisco do Sul/SC', 118, 132, 5, 167, 18],
    ['São Gonçalo/PB', 120, 124, 5, 152, 15],
    ['São Luiz/MA', 120, 126, 5, 152, 21],
    ['São Luiz Gonzaga/RS', 158, 209, 5, 253, 21],
    ['São Paulo/SP (Congonhas)', 122, 132, 5, null, null],
    ['São Paulo/SP (Mirante Santana)', 122, 172, 5, 191, 7],
    ['São Simão/SP', 116, 148, 5, 175, 25],
    ['Sena Madureira/AC', 120, 160, 5, 170, 7],
    ['Sete Lagoas/MG', 122, 182, 5, 281, 19],
    ['Soure/PA', 149, 162, 5, 212, 18],
    ['Taperinha/PA', 149, 202, 5, 241, 25],
    ['Taubaté/SP', 122, 172, 5, 208, 6],
    ['Teófilo Otoni/MG', 108, 121, 5, 154, 6],
    ['Teresina/PI', 154, 240, 5, 262, 23],
    ['Teresópolis/RJ', 115, 149, 5, 176, 25],
    ['Tupi/SP', 122, 154, 5, null, null],
    ['Turiaçu/MG', 126, 162, 5, 230, 25],
    ['Uaupés/AM', 144, 204, 5, 230, 17],
    ['Ubatuba/SP', 122, 149, 5, 184, 7],
    ['Uruguaiana/RS', 120, 142, 5, 161, 17],
    ['Vassouras/RJ', 125, 179, 5, 222, 25],
    ['Viamão/RS', 114, 126, 5, 152, 15],
    ['Vitória/ES', 102, 156, 5, 210, 25],
    ['Volta Redonda/RJ', 156, 216, 5, 265, 13],
  ];

  const TABELA5 = T5.map(function (r, idx) {
    const m = /\/([A-Z]{2})/.exec(r[0]);
    return {
      id: idx + 1,
      local: r[0],
      uf: m ? m[1] : '',
      I: { 1: r[1], 5: r[2], 25: r[4] },
      Treal: { 1: 1, 5: r[3], 25: r[5] },
    };
  });

  // Períodos de retorno do item 5.1.2.
  const PERIODOS = [
    { T: 1, rotulo: 'Áreas pavimentadas onde empoçamentos podem ser tolerados' },
    { T: 5, rotulo: 'Coberturas e/ou terraços' },
    { T: 25, rotulo: 'Coberturas e áreas onde empoçamento ou extravasamento não pode ser tolerado' },
  ];

  // Calhas semicirculares comerciais da Tabela 3 (diâmetro interno, mm).
  const CALHAS_SEMICIRCULARES = [100, 125, 150, 200];

  // Catálogo de tubos (decisão D4, 13/09/2026): Tigre e Amanco Wavin. O diâmetro interno
  // é Di = DE − 2e, com o DE e a espessura e impressos pelo fabricante; o DN não serve para
  // cálculo (3.11). Onde as duas marcas diferem, fica o menor Di, a favor da segurança.
  const LINHAS_TUBO = [
    { id: 'pvc-sn', rotulo: 'PVC Série Normal (NBR 5688)', curto: 'PVC Série Normal', material: 'pvc', usos: ['vertical', 'horizontal'],
      fonte: 'Tigre, Tubo Série Normal (ficha 2023); Amanco Wavin, ficha FTC000021 (out/2024)' },
    { id: 'pvc-sr', rotulo: 'PVC Série Reforçada (NBR 5688)', curto: 'PVC Série Reforçada', material: 'pvc', usos: ['vertical', 'horizontal'],
      fonte: 'Tigre, Tubo Série R e ficha Linha Esgoto Série Reforçada; Amanco Wavin, ficha FTC000022 (abr/2025)' },
    { id: 'aquapluv-88', rotulo: 'Condutor circular 88 da calha Tigre Aquapluv', curto: 'condutor Aquapluv 88', material: 'pvc', usos: ['vertical'],
      fonte: 'Tigre, catálogo Águas Pluviais e Drenagem (Aquapluv Style)' },
    { id: 'amanco-pluvial', rotulo: 'Condutor DN 100 da Calha Pluvial Amanco', curto: 'condutor Calha Pluvial Amanco', material: 'pvc', usos: ['vertical'],
      fonte: 'Amanco Wavin, ficha FTC000056 (ago/2024)' },
    { id: 'pvc-7362', rotulo: 'PVC coletor de parede maciça (NBR 7362)', curto: 'coletor PVC NBR 7362', material: 'pvc', usos: ['horizontal'],
      fonte: 'Tigre, Tubo Coletor Esgoto JEI (ficha mai/2025); Amanco Wavin, ficha Linha Coletor (2025)' },
  ];
  // [linha, DN, DE, e, observação]
  const CATALOGO_TUBOS = [
    ['pvc-sn', 50, 50.7, 1.6], ['pvc-sn', 75, 75.5, 1.7], ['pvc-sn', 100, 101.6, 1.8],
    ['pvc-sn', 150, 150, 2.6, 'Amanco e = 2,6; Tigre e = 2,5 (Di 145,0): vale o menor Di'], ['pvc-sn', 200, 200, 3.6],
    ['pvc-sr', 50, 50.7, 1.8], ['pvc-sr', 75, 75.5, 2], ['pvc-sr', 100, 101.6, 2.5], ['pvc-sr', 150, 150, 3.6],
    ['aquapluv-88', 88, 88, 1.7],
    ['amanco-pluvial', 100, 101.6, 1.8],
    ['pvc-7362', 100, 110, 2.5], ['pvc-7362', 150, 160, 3.6], ['pvc-7362', 200, 200, 4.5], ['pvc-7362', 250, 250, 6.1],
    ['pvc-7362', 300, 315, 7.7], ['pvc-7362', 350, 355, 8.7], ['pvc-7362', 400, 400, 9.8],
  ].map(function (r) {
    return { linha: r[0], dn: r[1], de: r[2], e: r[3], di: Math.round((r[2] - 2 * r[3]) * 10) / 10, origem: 'fabricante', obs: r[4] || '' };
  });

  // Tubos para condutores verticais: a norma manda adotar o DN cujo diâmetro
  // INTERNO seja ≥ D do ábaco (5.6.4.1) e nunca menor que 70 mm (5.6.3). Padrão: a Série
  // Normal do catálogo, só os de Di ≥ 70 mm.
  const TUBOS_VERTICAIS = CATALOGO_TUBOS.filter(function (t) { return t.linha === 'pvc-sn' && t.di >= 70; })
    .map(function (t) { return { dn: t.dn, di: t.di }; });

  // Materiais de calha admitidos no item 4.1.1, cada um com o n da sua linha na
  // Tabela 2. `chapa` indica calha de chapa dobrada (dá corte e massa por metro);
  // `alvenaria` exclui a seção semicircular.
  const MATERIAIS_CALHA = [
    { id: 'aco-galvanizado', rotulo: 'Chapa de aço galvanizado', n: 0.011, chapa: 'aco' },
    { id: 'flandres', rotulo: 'Folha-de-flandres', n: 0.011, chapa: 'aco' },
    { id: 'inox', rotulo: 'Aço inoxidável', n: 0.011, chapa: 'inox' },
    { id: 'cobre', rotulo: 'Chapa de cobre', n: 0.011, chapa: 'cobre' },
    { id: 'aluminio', rotulo: 'Alumínio', n: 0.011, chapa: 'aluminio' },
    { id: 'pvc', rotulo: 'PVC rígido', n: 0.011 },
    { id: 'fibra-vidro', rotulo: 'Fibra de vidro', n: 0.011 },
    { id: 'fibrocimento', rotulo: 'Fibrocimento', n: 0.011 },
    { id: 'concreto-alisado', rotulo: 'Concreto alisado', n: 0.012 },
    { id: 'alvenaria-revestida', rotulo: 'Alvenaria revestida', n: 0.012, alvenaria: true },
    { id: 'concreto-bruto', rotulo: 'Concreto não alisado', n: 0.013 },
    { id: 'alvenaria-tijolo', rotulo: 'Alvenaria de tijolos sem revestimento', n: 0.015, alvenaria: true },
  ];

  // Condutores horizontais de seção circular (4.1.3), com o n da Tabela 2.
  const MATERIAIS_HORIZONTAL = [
    { id: 'pvc', rotulo: 'PVC rígido', n: 0.011 },
    { id: 'fibrocimento', rotulo: 'Fibrocimento', n: 0.011 },
    { id: 'aco-galvanizado', rotulo: 'Aço galvanizado', n: 0.011 },
    { id: 'cobre', rotulo: 'Cobre', n: 0.011 },
    { id: 'ferro-fundido', rotulo: 'Ferro fundido', n: 0.012 },
    { id: 'concreto', rotulo: 'Tubo de concreto', n: 0.013 },
    { id: 'ceramica', rotulo: 'Cerâmica vidrada', n: 0.013 },
  ];

  // Condutores verticais (4.1.2). O ábaco da Figura 3 não depende do material
  // (foi construído para tubo rugoso, f = 0,04); o material vai para o memorial e a lista.
  const MATERIAIS_VERTICAL = [
    { id: 'pvc', rotulo: 'PVC rígido' },
    { id: 'ferro-fundido', rotulo: 'Ferro fundido' },
    { id: 'fibrocimento', rotulo: 'Fibrocimento' },
    { id: 'aco-galvanizado', rotulo: 'Tubo de aço galvanizado' },
    { id: 'chapa-aco', rotulo: 'Chapa de aço galvanizado' },
    { id: 'flandres', rotulo: 'Folha-de-flandres' },
    { id: 'cobre', rotulo: 'Cobre, tubo ou chapa' },
    { id: 'inox', rotulo: 'Aço inoxidável' },
    { id: 'aluminio', rotulo: 'Alumínio' },
    { id: 'fibra-vidro', rotulo: 'Fibra de vidro' },
  ];

  // Chapas: densidade em kg/dm³ (kg por m² de chapa com 1 mm).
  const CHAPAS = {
    aco: { rotulo: 'aço', dens: 7.85 },
    inox: { rotulo: 'aço inox', dens: 7.9 },
    cobre: { rotulo: 'cobre', dens: 8.94 },
    aluminio: { rotulo: 'alumínio', dens: 2.7 },
  };
  // Cortes usuais: divisões de bobinas de 1,00 m e 1,20 m (mm).
  const CORTES_CHAPA = [250, 300, 333, 400, 500, 600];
  const ESPESSURAS_CHAPA = [0.43, 0.5, 0.65, 0.8, 0.95];

  const api = {
    MATERIAIS_CALHA: MATERIAIS_CALHA,
    MATERIAIS_HORIZONTAL: MATERIAIS_HORIZONTAL,
    MATERIAIS_VERTICAL: MATERIAIS_VERTICAL,
    CHAPAS: CHAPAS,
    CORTES_CHAPA: CORTES_CHAPA,
    ESPESSURAS_CHAPA: ESPESSURAS_CHAPA,
    TABELA1: TABELA1,
    TABELA2: TABELA2,
    TABELA3: TABELA3,
    TABELA4: TABELA4,
    TABELA5: TABELA5,
    PERIODOS: PERIODOS,
    CALHAS_SEMICIRCULARES: CALHAS_SEMICIRCULARES,
    LINHAS_TUBO: LINHAS_TUBO,
    CATALOGO_TUBOS: CATALOGO_TUBOS,
    TUBOS_VERTICAIS: TUBOS_VERTICAIS,
    DIAMETRO_MINIMO_VERTICAL: 70,
    DECLIVIDADE_MINIMA: 0.005,
    I_PEQUENA_AREA: 150,
    AREA_PEQUENA: 100,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NBR10844_DADOS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
