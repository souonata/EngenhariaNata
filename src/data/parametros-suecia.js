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
 * Grundavdrag: dedução automática, variável conforme a renda (não é linear —
 * sobe, atinge um teto e volta a cair até o piso). Os valores abaixo são os
 * pontos notáveis publicados pelo Skatteverket; a curva por faixa ainda precisa
 * ser implementada a partir da tabela oficial.
 */
export const GRUNDAVDRAG_2026 = {
  menor66: { base: 25100, maximo: 45600, minimo: 17400 },
  de66Anos: { base: 65800, maximo: 179100, minimo: 117500 },
};

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
 * Jobbskatteavdrag: crédito que reduz a kommunalskatt (não a statlig skatt).
 * A fórmula é escalonada em múltiplos do prisbasbelopp e ainda precisa ser
 * transcrita da tabela oficial antes de entrar no cálculo.
 * A partir de 2026 o crédito foi reforçado para quem tem mais de 66 anos.
 */
export const JOBBSKATTEAVDRAG_PENDENTE = true;

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
