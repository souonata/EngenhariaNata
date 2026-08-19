/**
 * Parâmetros agronômicos e de captura da Suécia — base do modo sueco do app
 * `fazenda`. Consultado em 2026-08-19.
 *
 * Mesma regra do `parametros-suecia.js`: **cada constante traz FONTE e DATA**.
 * Regra de pesca e temporada muda por ano, por água e por decisão de autoridade;
 * nada aqui deve ser atualizado de memória.
 *
 * ⚠️ Reversão de decisão registrada: o `fazenda` estava fora do sueco no
 * `AGENTS.md` justamente por falta desta base regional. É ela que este arquivo
 * começa a construir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE MUDA DE MÉTODO EM RELAÇÃO A BRASIL E ITÁLIA
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. O eixo não é "região agrícola", é a ZONA DE RUSTICIDADE (odlingszon I–VIII).
 *    Ela responde à pergunta sueca: a planta sobrevive ao inverno aqui?
 * 2. A produção é de UMA safra por ano, dentro de uma janela curta. Não há o
 *    escalonamento contínuo que o modelo brasileiro assume.
 * 3. Uma parte relevante do alimento não é cultivada: é COLHIDA ou CAPTURADA —
 *    bagas e cogumelos sob o allemansrätten, e lagostim/lagosta com armadilha,
 *    sob licença e temporada. É a diferença que o usuário pediu para incluir.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ZONAS DE RUSTICIDADE — odlingszoner
// Fonte: Riksförbundet Svensk Trädgård — Zonkartan.
// https://svensktradgard.se/tradgardsrad/zonkartan/sveriges-zonkarta/
// Consultado em 2026-08-19.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Suécia é dividida em 8 zonas: 1 é a mais amena e 8 a mais severa. Quanto
 * MAIOR o número que uma planta suporta, mais rústica ela é.
 *
 * ⚠️ Duas armadilhas de leitura da carta:
 *  - a carta vale para PLANTAS LENHOSAS (árvores e arbustos). Hortaliça anual
 *    não morre de inverno — o que a limita é o comprimento da temporada;
 *  - zona alta não é sinônimo de "norte": mar e grandes lagos amenizam, e a
 *    altitude agrava. O litoral do Norrland pode ser mais ameno que o interior
 *    de Svealand.
 */
export const ODLINGSZONER_SE = [
    { zona: 1, exemplos: 'Skåne costeiro, Blekinge, Halland, Öland, Gotland' },
    { zona: 2, exemplos: 'Skåne interior, litoral de Götaland, Mälardalen costeiro' },
    { zona: 3, exemplos: 'Götaland interior, Mälardalen' },
    { zona: 4, exemplos: 'Svealand, litoral do sul do Norrland' },
    { zona: 5, exemplos: 'Svealand interior, litoral de Norrland' },
    { zona: 6, exemplos: 'Norrland costeiro e vales fluviais' },
    { zona: 7, exemplos: 'Norrland interior' },
    { zona: 8, exemplos: 'alta montanha e o extremo norte' }
];

/**
 * Comprimento da temporada de cultivo, em dias, pela `vegetationsperiod` do
 * SMHI (parte do ano com média diária acima de +5 °C). É o mesmo número que a
 * versão sueca do app `chuva` usa — lá para saber quando o barril congela, aqui
 * para saber quanto tempo a planta tem para crescer.
 * Fonte: SMHI — Vegetationsperiod.
 * https://www.smhi.se/kunskapsbanken/klimat/fenologi/vegetationsperiod
 */
export const TEMPORADA_CULTIVO_SE = {
    syd: { zonaTipica: 1, dias: 225 },
    mellan: { zonaTipica: 3, dias: 190 },
    norr: { zonaTipica: 6, dias: 155 }
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUÇÃO VEGETAL — referência de rendimento
// Fonte: Jordbruksverket — Skörd av potatis 2025 (estatística preliminar).
// https://jordbruksverket.se/om-jordbruksverket/jordbruksverkets-officiella-statistik/jordbruksverkets-statistikrapporter/statistik/2025-12-05-skord-av-potatis-2025.-preliminar-statistik
// Consultado em 2026-08-19.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Batata é a âncora de rendimento do modelo sueco: é a cultura de que existe
 * estatística oficial anual e a que sustenta caloricamente um cultivo caseiro
 * em clima curto. 43 580 kg/ha na safra de 2025 → 4,36 kg/m² em lavoura
 * profissional. Horta doméstica costuma ficar abaixo disso.
 */
export const RENDIMENTO_BATATA_SE = {
    kgPorHectare: 43580,
    get kgPorM2() {
        return this.kgPorHectare / 10000;
    },
    ano: 2025,
    observacao: 'lavoura profissional; horta doméstica rende menos'
};

// ─────────────────────────────────────────────────────────────────────────────
// PROTEÍNA ANIMAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Galinha poedeira. A ave comercial põe ~300 ovos/ano; a de quintal, 150–200 —
 * e é este o número que interessa a quem planeja autoprodução.
 * ⚠️ Diferença sueca: a postura CAI no inverno por falta de luz. Sem luz
 * artificial no galinheiro, os meses escuros rendem pouco ou nada.
 * Fonte: SLU — Hönans livscykel; Svenska Lanthönsklubben — Hönsskötsel.
 * https://www.slu.se/om-slu/organisation/institutioner/institutionen-for-tillampad-husdjursvetenskap-och-valfard/fodertabeller-och-naringsrekommendationer/naringsrekommendationer-for-fagel/lasvart-om-fjaderfa/honans-livscykel/
 * https://www.kackel.se/honsskotsel/
 * Consultado em 2026-08-19.
 */
export const GALINHA_SE = {
    ovosAnoQuintal: { minimo: 150, maximo: 200 },
    ovosAnoComercial: 300,
    quedaInvernoSemLuz: true
};

/**
 * Abelhas. Média sueca em torno de 30 kg de mel por colmeia e temporada; a
 * faixa normal vai de 20 a 50 kg, e o intervalo observado é muito mais largo.
 * Fonte: Allt om Biodling — Medelskörd; Biodlarna — Att skaffa bin.
 * https://alltombiodling.se/medelskord/
 * https://www.biodlarna.se/bin-och-biodling/att-skaffa-bin/
 * Consultado em 2026-08-19.
 */
export const ABELHAS_SE = {
    melKgPorColmeiaMedia: 30,
    melKgPorColmeiaFaixa: { minimo: 20, maximo: 50 }
};

/**
 * Ovelha. O abate usual é aos 4–6 meses, com carcaça de 15–20 kg; a carne
 * aproveitada por cordeiro fica em 15–25 kg.
 * Fonte: Gård & Djurhälsan — Tolka din slaktavräkning (Får & Lamm);
 * Svenskt Kött — Lammkött.
 * https://www.gardochdjurhalsan.se/tolka-din-slaktavrakning-far-lamm/
 * https://svensktkott.se/om-kott/djuruppfodning/varfor-ska-man-valja-svenskt-lammkott/
 * Consultado em 2026-08-19.
 */
export const OVELHA_SE = {
    idadeAbateMeses: { minimo: 4, maximo: 6 },
    carcacaKg: { minimo: 15, maximo: 20 },
    carneKgPorCordeiro: { minimo: 15, maximo: 25 }
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURA — armadilhas e colheita silvestre
// É a parte que não tem equivalente no modelo brasileiro ou italiano do app.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KRÄFTFISKE — lagostim de ÁGUA DOCE (signalkräfta, Pacifastacus leniusculus).
 *
 * ⚠️ A armadilha aqui é jurídica, não física: **quase toda a água sueca é
 * privada para efeito de pesca de lagostim**. O allemansrätten NÃO cobre
 * kräftfiske. A única água aberta ao público é o VÄTTERN, e mesmo assim só em
 * três fins de semana por ano.
 *
 * A `flodkräfta` (Astacus astacus), nativa, está ameaçada — a peste do lagostim
 * carregada pela signalkräfta a dizimou. Ela sobrevive sobretudo em Värmland,
 * Dalsland, Dalarna, Gotland, Öland e Norrland, e não é alvo de pesca
 * recreativa livre.
 *
 * Fonte: Havs- och vattenmyndigheten — Signalkräfta, regler för fiske och
 * hantering (regras em vigor desde 12/12/2019; página atualizada em 6/7/2026).
 * https://www.havochvatten.se/fiske-och-handel/regler-och-lagar/arter-regler-for-fiske-och-rapportering/signalkrafta---regler-for-fiske-och-hantering.html
 * Consultado em 2026-08-19.
 */
export const KRAFTFISKE_SE = {
    aguaAbertaAoPublico: 'Vättern',
    /** Sexta 17h → domingo 17h, em três fins de semana seguidos. */
    temporada: {
        inicio: 'quarta sexta-feira de agosto',
        horaInicio: '17:00',
        horaFim: '17:00',
        finsDeSemana: 3
    },
    burasPorPessoa: 6,
    /** Malha < 50 mm exige 2 aberturas de fuga circulares de 28 mm. */
    aberturaFugaMm: 28,
    aberturasFugaMinimas: 2,
    malhaQueExigeFugaMm: 50,
    capturaPorPessoaDia: 60,
    capturaPorPessoaFimDeSemana: 120,
    tamanhoMinimoCm: 10,
    exigeLicencaEmVattern: false,
    /** Em qualquer outra água é preciso autorização do detentor do direito. */
    exigeAutorizacaoDoProprietarioForaDeVattern: true,
    /** Transporte de lagostim VIVO é restrito à área de manejo. */
    transporteVivoRestrito: true,
    flodkraftaAmeacada: true
};

/**
 * HAVSKRÄFTA — lagostim de ÁGUA SALGADA (Nephrops norvegicus), na costa oeste.
 * Diferente do de água doce em tudo o que importa ao planejamento: pode ser
 * pescado o ANO INTEIRO, e a restrição é de tamanho e de construção da armadilha.
 *
 * Fonte: Havs- och vattenmyndigheten — Havskräfta, minimimått och
 * redskapsbegränsningar (rymningshål obrigatório desde 1/1/2023).
 * https://www.havochvatten.se/fiske-och-handel/regler-och-lagar/arter-regler-for-fiske-och-rapportering/havskrafta---minimimatt-och-redskapsbegransningar.html
 * Consultado em 2026-08-19.
 */
export const HAVSKRAFTA_SE = {
    temporada: 'ano inteiro',
    burasPorPessoa: 6,
    tamanhoMinimoCm: 9,
    medicao: 'da borda posterior da órbita à borda posterior da carapaça',
    /** Abaixo de 30 m de profundidade a bur precisa de abertura de fuga. */
    aberturaFugaMm: 75,
    profundidadeQueDispensaFugaM: 30,
    rymningshalObrigatorioDesde: '2023-01-01'
};

/**
 * HUMMER — lagosta europeia. Entra aqui porque usa a mesma armadilha e o mesmo
 * barco, mas tem temporada fechada e curta.
 * Fonte: Havs- och vattenmyndigheten e Länsstyrelsen Västra Götaland —
 * hummerpremiär.
 * https://www.lansstyrelsen.se/vastra-gotaland/djur/fiske.html
 * Consultado em 2026-08-19.
 */
export const HUMMER_SE = {
    inicio: 'primeira segunda-feira após 20 de setembro, às 07:00',
    fim: 'último dia de novembro'
};

/**
 * ALLEMANSRÄTTEN — colheita silvestre. É o oposto do kräftfiske: bagas e
 * cogumelos podem ser colhidos em terra alheia, mesmo em escala e para venda,
 * desde que sem prejuízo desarrazoado ao proprietário.
 *
 * ⚠️ Armadilha: **avelãs e outras nozes NÃO estão cobertas**, e cinco cogumelos
 * são protegidos e não podem ser colhidos de forma alguma (bombmurkla,
 * igelkottaggsvamp, doftticka, saffransticka, storporig brandticka).
 *
 * Fonte: Naturvårdsverket — Plocka blommor, bär och svamp.
 * https://www.naturvardsverket.se/amnesomraden/allemansratten/sa-gor-vi-allemansratt/plocka-blommor-bar-och-svamp/
 * Consultado em 2026-08-19.
 */
export const ALLEMANSRATTEN_SE = {
    cobreBagas: true,
    cobreCogumelos: true,
    cobreNozes: false,
    permiteVenda: true,
    cogumelosProtegidos: [
        'bombmurkla',
        'igelkottaggsvamp',
        'doftticka',
        'saffransticka',
        'storporig brandticka'
    ],
    cobreKraftfiske: false
};

// ─────────────────────────────────────────────────────────────────────────────
// BAGAS E FRUTAS — rusticidade
// Fonte: Riksförbundet Svensk Trädgård — Faktablad 15, Bär;
// Hushållningssällskapet — Odling av Aronia, Blåbärstry, Havtorn (2021).
// https://svensktradgard.se/media/jftj3ozw/faktablad_15_bar.pdf
// https://hushallningssallskapet.se/wp-content/uploads/2023/11/odlingsbeskrivning-udda-bar-2021.pdf
// Consultado em 2026-08-19.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * As BAGAS é que dominam o cultivo nórdico — não a fruta de árvore. Aguentam
 * inverno, frutificam dentro da janela curta e chegam mais ao norte.
 *
 * `zonaMaxima` = zona mais severa em que a planta ainda vinga.
 */
export const BAGAS_SE = [
    {
        chave: 'aronia',
        nome: { sv: 'Aronia', pt: 'Aronia', it: 'Aronia' },
        zonaMaxima: 6,
        colheita: 'set–out'
    },
    {
        chave: 'svartaVinbar',
        nome: { sv: 'Svarta vinbär', pt: 'Groselha-preta', it: 'Ribes nero' },
        zonaMaxima: 6,
        colheita: 'jul–ago',
        // Frutifica no ramo do ano anterior: podar tudo elimina a safra.
        frutificaEmRamoDoAnoAnterior: true,
        cultivares: ['Öjebyn (zona 6)', 'Petter® E', 'Narve Viking E']
    },
    {
        chave: 'hallon',
        nome: { sv: 'Hallon', pt: 'Framboesa', it: 'Lampone' },
        // Ciclo de dois anos: brota num ano, floresce e frutifica no seguinte.
        cicloAnos: 2,
        colheita: 'jul–ago'
    },
    {
        chave: 'jordgubbar',
        nome: { sv: 'Jordgubbar', pt: 'Morango', it: 'Fragola' },
        vidaUtilAnos: { minimo: 8, maximo: 10 },
        colheita: 'jun–jul'
    },
    {
        chave: 'havtorn',
        nome: { sv: 'Havtorn', pt: 'Espinheiro-marítimo', it: 'Olivello spinoso' },
        colheita: 'ago–set',
        // Dioico: sem planta macho ao lado, a fêmea não dá fruto nenhum.
        exigePlantaMachoEFemea: true,
        frutificaEmRamoDoAnoAnterior: true
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// PENDENTE DE PESQUISA — não preencher de memória
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O que ainda falta levantar COM FONTE antes de a tela sueca do `fazenda`
 * dimensionar área e produção. Registrado aqui de propósito: é melhor a lista
 * do que um número inventado.
 */
export const PENDENTE_PESQUISA_SE = [
    'Rendimento por m² de hortaliça a hortaliça (base: Jordbruksverket, Skörd av trädgårdsväxter, tabelas de Trädgårdsodling).',
    'Dias da semeadura à colheita por cultura e por zona.',
    'Janela de semeadura mês a mês por zona (calendário de plantio).',
    'Rendimento por planta de cada baga e de cada fruteira.',
    'Fruteiras de árvore (äpple, päron, plommon, körsbär): cultivares por zona e produção.',
    'Coelho: produtividade e ciclo em clima frio.',
    'Necessidade de forragem/inverno por animal (a estabulação sueca é longa).'
];
