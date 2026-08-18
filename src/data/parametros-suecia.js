/**
 * Parâmetros fiscais e de crédito imobiliário da Suécia — ano de 2026.
 *
 * Base para a Fase 4 da iniciativa trilíngue (`salario` e `mutuo` em modo
 * sueco). Cada constante traz a FONTE e a DATA da consulta, porque estes
 * números mudam por ano fiscal e não devem ser atualizados de memória.
 *
 * ⚠️ DUAS REGRAS MUDARAM EM 1 DE ABRIL DE 2026 — cuidado ao consultar material
 * mais antigo (ou modelos de IA com corte de conhecimento anterior):
 *   1. O `skärpt amorteringskrav` (1% extra para dívida acima de 4,5× a renda
 *      bruta anual) foi REVOGADO. Não existe mais.
 *   2. O `bolånetak` subiu de 85% para 90% do valor do imóvel, ou seja, a
 *      entrada mínima caiu de 15% para 10%.
 *
 * Consultado em 2026-08-18.
 */

// ─────────────────────────────────────────────────────────────────────────────
// IMPOSTO DE RENDA SOBRE O TRABALHO (para o app `salario`)
// Fonte: Skatteverket — "Belopp och procent inkomstår 2026"
// https://www.skatteverket.se/privat/skatter/beloppochprocent/2026.4.1522bf3f19aea8075ba21.html
// ─────────────────────────────────────────────────────────────────────────────

export const PRISBASBELOPP_2026 = 59200; // SEK
export const FORHOJT_PRISBASBELOPP_2026 = 60500; // SEK

/**
 * Grundavdrag: dedução automática, variável conforme a renda. A curva não é
 * linear — sobe, atinge um teto e volta a cair até um piso. Expressa em
 * múltiplos do prisbasbelopp (PBB).
 *
 * Conferência dos três pontos notáveis contra os valores publicados pelo
 * Skatteverket para 2026 (PBB = 59 200):
 *   0,423 × 59 200 = 25 042  → publicado "25 100 vid låga inkomster"
 *   0,770 × 59 200 = 45 584  → publicado "máximo 45 600"
 *   0,293 × 59 200 = 17 346  → publicado "mínimo 17 400"
 * Os três batem, o que valida os coeficientes.
 */
export const GRUNDAVDRAG_2026 = {
  menor66: { base: 25100, maximo: 45600, minimo: 17400 },
  de66Anos: { base: 65800, maximo: 179100, minimo: 117500 },
};

/** Faixas do grundavdrag em múltiplos de PBB, para quem tem menos de 66 anos. */
export const GRUNDAVDRAG_FAIXAS_PBB = {
  pisoPbb: 0.423, // valor base nas rendas baixas
  inicioSubidaPbb: 0.99, // a partir daqui soma 20% do excedente
  taxaSubida: 0.2,
  tetoPbb: 0.77, // teto do grundavdrag
  inicioDescidaPbb: 3.11, // a partir daqui desconta 10% do excedente
  taxaDescida: 0.1,
  fimDescidaPbb: 7.88, // abaixo disto a curva já chegou ao piso
  minimoPbb: 0.293,
};

/**
 * Calcula o grundavdrag de quem tem menos de 66 anos, em coroas.
 * @param {number} rendaAnual  Fastställd förvärvsinkomst (renda bruta anual).
 * @param {number} pbb         Prisbasbelopp do ano.
 */
export function calcularGrundavdrag(rendaAnual, pbb = PRISBASBELOPP_2026) {
  const f = GRUNDAVDRAG_FAIXAS_PBB;
  const emPbb = rendaAnual / pbb;

  if (emPbb <= f.inicioSubidaPbb) {
    return f.pisoPbb * pbb;
  }

  if (emPbb <= f.inicioDescidaPbb) {
    const subida =
      f.pisoPbb * pbb + f.taxaSubida * (rendaAnual - f.inicioSubidaPbb * pbb);
    return Math.min(subida, f.tetoPbb * pbb);
  }

  if (emPbb <= f.fimDescidaPbb) {
    const descida =
      f.tetoPbb * pbb - f.taxaDescida * (rendaAnual - f.inicioDescidaPbb * pbb);
    return Math.max(descida, f.minimoPbb * pbb);
  }

  return f.minimoPbb * pbb;
}

/** Statlig inkomstskatt: 20% sobre o que passa da skiktgräns. */
export const SKIKTGRANS_2026 = 643000; // renda tributável APÓS grundavdrag
export const STATLIG_SKATT_TAXA = 0.2;

/** Brytpunkt: renda BRUTA a partir da qual a statlig skatt começa a incidir. */
export const BRYTPUNKT_2026 = {
  menor66: 660400,
  de66Anos: 760500,
};

/**
 * Kommunalskatt: cada kommun tem a sua alíquota (são 290). 32,38% é a média
 * nacional de 2026 — serve de valor padrão, mas o app deveria deixar o usuário
 * informar a alíquota do próprio município.
 * Fonte: SCB — Kommunalskatterna 2026.
 * https://www.scb.se/hitta-statistik/statistik-efter-amne/offentlig-ekonomi/finanser-for-den-kommunala-sektorn/kommunalskatterna/
 */
export const KOMMUNALSKATT_MEDIA_2026 = 0.3238;

/** Imposto sobre renda de capital (juros, dividendos, ganhos). */
export const KAPITALSKATT = 0.3;

/**
 * Arbetsgivaravgift: encargo do EMPREGADOR sobre o salário bruto — não sai do
 * líquido do trabalhador, mas compõe o custo total da contratação.
 * Fonte: Skatteverket / Ekonomifakta.
 * https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html
 */
export const ARBETSGIVARAVGIFT_2026 = 0.3142;

/**
 * Redução temporária de 2026 para jovens: nascidos entre 2003 e 2007 pagam
 * 20,81% sobre a parcela até 25 000 kr por mês civil.
 */
export const ARBETSGIVARAVGIFT_JOVEM_2026 = {
  taxa: 0.2081,
  tetoMensal: 25000,
  nascidosDe: 2003,
  nascidosAte: 2007,
};

/**
 * Semesterlön: 12% é a taxa da semesterlagen quando se usa o método percentual
 * (o equivalente funcional das férias + 1/3 no Brasil). NÃO existe 13ª nem 14ª
 * mensalidade na Suécia — isso é específico de Brasil e Itália.
 */
export const SEMESTERLON_TAXA = 0.12;
export const TEM_DECIMO_TERCEIRO = false;

/**
 * Jobbskatteavdrag (JSA): crédito que abate a KOMMUNALSKATT — nunca a statlig
 * skatt. Escalonado por faixas de renda do trabalho, em múltiplos de PBB, e
 * multiplicado pela alíquota municipal, então vale mais em município de
 * imposto alto.
 *
 * ⚠️ Mudança de 2026: a avtrappning (redução progressiva do benefício nas
 * rendas altas) foi ELIMINADA. O crédito agora chega a um platô e não cai
 * mais. Material anterior a 2026 descreve a regra antiga.
 *
 * Conferência: no topo da 3ª faixa a base é 162 625 kr; multiplicada pela
 * kommunalskatt média de 32,38% dá 4 388 kr/mês, que bate com o máximo
 * publicado para 2026 (4 366–4 388 kr/mês, conforme o município). Base
 * legal: 67 kap. 5–9 §§ inkomstskattelagen.
 */
export const JOBBSKATTEAVDRAG_2026 = {
  faixa1Ate: 53872, // 0,91 PBB
  faixa1Coef: 0.916,
  faixa2Ate: 191808, // 3,24 PBB
  faixa2Coef: 0.32,
  faixa3Ate: 478336, // 8,08 PBB — a partir daqui é platô
  faixa3Coef: 0.2413,
  temAvtrappning: false, // removida em 2026
};

/**
 * Calcula o jobbskatteavdrag anual, em coroas.
 * @param {number} rendaTrabalhoAnual  Arbetsinkomst bruta do ano.
 * @param {number} kommunalskatt       Alíquota municipal em decimal (ex.: 0,3238).
 */
export function calcularJobbskatteavdrag(rendaTrabalhoAnual, kommunalskatt) {
  const j = JOBBSKATTEAVDRAG_2026;
  const renda = Math.max(0, rendaTrabalhoAnual);

  let base;
  if (renda <= j.faixa1Ate) {
    base = j.faixa1Coef * renda;
  } else if (renda <= j.faixa2Ate) {
    base = j.faixa1Coef * j.faixa1Ate + j.faixa2Coef * (renda - j.faixa1Ate);
  } else {
    const baseFaixa2 =
      j.faixa1Coef * j.faixa1Ate + j.faixa2Coef * (j.faixa2Ate - j.faixa1Ate);
    // Acima da 3ª faixa o benefício estabiliza: sem avtrappning desde 2026.
    const rendaConsiderada = Math.min(renda, j.faixa3Ate);
    base = baseFaixa2 + j.faixa3Coef * (rendaConsiderada - j.faixa2Ate);
  }

  return base * kommunalskatt;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRÉDITO IMOBILIÁRIO — BOLÅN (para o app `mutuo`)
// Fonte: Finansinspektionen, via Handelsbanken e Boio (regras de 1/4/2026).
// https://www.handelsbanken.se/sv/ekonomi-i-livet/privatekonomi/boendeekonomi/for-hushall/nya-amorteringskrav
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Amorteringskrav: amortização mínima anual, em % do valor do empréstimo,
 * definida SOMENTE pela belåningsgrad (relação empréstimo/valor do imóvel).
 * Desde 1/4/2026 não há mais o acréscimo por múltiplo da renda.
 */
export const AMORTERINGSKRAV_2026 = [
  { belaningsgradAcima: 0.7, amortizacaoAnual: 0.02 },
  { belaningsgradAcima: 0.5, amortizacaoAnual: 0.01 },
  { belaningsgradAcima: 0.0, amortizacaoAnual: 0.0 },
];

/** Teto de amortização exigida: 3% ao ano. */
export const AMORTERINGSKRAV_MAXIMO = 0.03;

/**
 * Bolånetak: financiamento máximo em relação ao valor do imóvel. Subiu de 85%
 * para 90% em 1/4/2026 — a entrada mínima caiu de 15% para 10%.
 */
export const BOLANETAK_2026 = 0.9;
export const ENTRADA_MINIMA_2026 = 0.1;

/**
 * Ränteavdrag: dedução dos juros pagos. 30% sobre os primeiros 100 000 kr de
 * despesa líquida com juros no ano e 21% sobre o excedente.
 * ⚠️ Novidade de 2026: não há mais dedução para empréstimos SEM garantia real
 * (o bolån, por ser garantido pelo imóvel, segue dedutível).
 */
export const RANTEAVDRAG = {
  taxaAte100k: 0.3,
  taxaAcima100k: 0.21,
  limite: 100000,
  exigeGarantiaReal: true, // regra nova de 2026
};

// ─────────────────────────────────────────────────────────────────────────────
// SOLAR FOTOVOLTAICO — prática sueca (para o app `solar`)
// Fonte: Skatteverket (grön teknik) e Energimyndigheten (produção específica).
// https://www.skatteverket.se/privat/fastigheterochbostad/gronteknik.4.676f4884175c97df4192860.html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Na Suécia o padrão é solar CONECTADA À REDE, não off-grid. Dimensionar um
 * sistema isolado pelo inverno sueco levaria a um banco de baterias absurdo:
 * em dezembro a produção fica em torno de 3% do pico de verão. Quem mora lá
 * consome da rede no inverno e exporta o excedente no verão.
 */
export const SOLAR_SE_CONECTADA_A_REDE = true;

/**
 * Produção específica anual, em kWh por kW instalado (kWp). Varia com a
 * latitude: a irradiação vai de ~800 kWh/m²·ano no norte a ~1300 no sul.
 */
export const PRODUCAO_ESPECIFICA_SE = {
  sul: 1050, // Skåne, Blekinge, Halland
  centro: 950, // Svealand e Götaland interior
  norte: 850, // Norrland
};

/**
 * Fração da produção tipicamente consumida na própria casa, sem bateria. O
 * resto é exportado. Depende muito do perfil de consumo — valor educativo.
 */
export const AUTOCONSUMO_TIPICO_SE = 0.35;

/**
 * Grön teknik: redução de imposto sobre o custo de mão de obra e material.
 * A alíquota de solceller caiu em 1/7/2025 (era 19,4%). Bateria e carregador
 * de veículo elétrico seguem em 50%.
 */
export const GRON_TEKNIK_SE = {
  solceller: 0.15,
  bateria: 0.5,
  carregador: 0.5,
  tetoPorPessoaAno: 50000,
};

/**
 * ⚠️ Extinta em 1 de janeiro de 2026: a redução de 60 öre por kWh vendido à
 * rede (a "60-öringen"). Cálculos de retorno feitos com material anterior a
 * 2026 superestimam o ganho da exportação.
 */
export const SESSENTA_ORINGEN_EXTINTA_2026 = true;

/** Custo típico de instalação chave na mão, em SEK por kW instalado. */
export const CUSTO_INSTALACAO_SEK_POR_KWP = 15000;

// ─────────────────────────────────────────────────────────────────────────────
// VENTILAÇÃO — exigência de VAZÃO (para o app `ventilacao`)
// Fonte: Boverket, BFS 2024:8, 3 kap. "Luft", 5 § (consultado em 2026-08-18).
// https://www.boverket.se/sv/PBL-kunskapsbanken/regler-om-byggande/hygien-halsa-och-miljo/luft/utformning/
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Mudança de regime: o BBR foi substituído pelas novas regras da Boverket
 * em 1/7/2025, e o período de transição terminou em 1/7/2026 — desde então
 * as regras novas valem sozinhas (BBR não é mais aplicável).
 *
 * O que NÃO mudou: o piso de 0,35 l/s·m² sobreviveu como *föreskrift*
 * vinculante (BFS 2024:8, 3 kap. 5 §), não como recomendação. O que mudou é o
 * entorno: as regras novas são de desempenho (funktionskrav) e as
 * recomendações setoriais de detalhe ("branschrekommendationerna Luft") ainda
 * estavam sendo escritas em setembro de 2026.
 */
export const BBR_SUBSTITUIDO_POR_BFS_2024_8 = true;

/**
 * A exigência sueca é de VAZÃO DE AR EXTERIOR, não de proporção de área de
 * janela. É esta a diferença de método que justifica uma tela própria: no
 * Brasil e na Itália a pergunta é "a janela é grande o bastante?"; na Suécia é
 * "o sistema entrega litros por segundo o ano inteiro?".
 */
export const VENTILACAO_SE = {
  /** l/s por m² de área de piso — piso absoluto para habitações. */
  fluxoPorM2: 0.35,
  /** l/s por pessoa em bostadsrum (quarto/sala). */
  fluxoPorPessoa: 4.0,
  /** l/s por m² admitido quando ninguém está em casa (ventilação sob demanda). */
  fluxoReduzidoDesocupado: 0.1,
};

/**
 * Recuperação de calor por tipo de sistema — fração da perda de ventilação
 * que volta para dentro da casa.
 *
 * Fonte: Svensk Ventilation e fabricantes (trocador rotativo recupera 75–86%;
 * medição de campo num Systemair VM2 deu ~80%). O FVP não é trocador: é bomba
 * de calor sobre o ar de exaustão e recupera 50–60%, mas CONSOME eletricidade
 * (COP ~3) — por isso vem com ressalva na tela.
 * https://www.svenskventilation.se/ventilation/olika-satt-att-ventilera/ftx-varmeatervinning/
 */
export const RECUPERACAO_CALOR_SE = {
  sjalvdrag: 0, // tiragem térmica; sem recuperação
  franluft: 0, // exaustão mecânica; sem recuperação
  fvp: 0.55, // frånluftsvärmepump — via bomba de calor
  ftx: 0.8, // trocador de calor ar-ar
};

/**
 * Graus-dia de aquecimento (graddagar) de um ano normal, por região.
 * Fonte: SMHI Graddagar, normalperiod 1991–2020 — a Suécia inteira fica
 * tipicamente entre 3.100 e 4.000, com o Norrland bem acima.
 * https://www.smhi.se/professionella-tjanster/hallbara-stader/smhi-energi-index-och-graddagar---normalarskorrigering-varme
 */
export const GRADDAGAR_SE = {
  syd: 3100, // Skåne, Blekinge, Halland
  mellan: 3600, // Svealand e Götaland interior
  norr: 5000, // Norrland
};

/**
 * Capacidade volumétrica do ar, ρ·cp ≈ 1,2 kg/m³ × 1005 J/(kg·K).
 * Usada para converter vazão + graus-dia em kWh por ano.
 */
export const AR_RHO_CP = 1206; // J/(m³·K)

/**
 * OVK (obligatorisk ventilationskontroll): inspeção periódica por lei.
 * Villa/radhus só na construção nova, qualquer sistema. Prédio de apartamentos:
 * 3 anos com FT/FTX, 6 anos com F. Självdrag em casa unifamiliar é isento.
 * https://www.boverket.se/sv/PBL-kunskapsbanken/regler-om-byggande/ovk/
 */
export const OVK_INTERVALO_ANOS = {
  flerbostadshusFTX: 3,
  flerbostadshusF: 6,
  smahus: null, // só na construção nova
};
