/**
 * Papel no projeto:
 * - Núcleo numérico da calculadora salarial (Brasil + Itália).
 * - Funções puras: recebem objeto de entrada, retornam objeto de resultado.
 * - Sem DOM, sem i18n, sem dependência de classes — testável em isolamento.
 *
 * Pontos seguros para IA editar:
 * - tabelas tributárias (atualizar mantendo data + fonte no comentário);
 * - parâmetros financeiros (TFR, addizionali, fatores de custo);
 * - novas faixas/regras desde que cobertas por teste em salario-calc.test.js.
 *
 * Cuidados antes de mexer:
 * - este arquivo é importado por salario-script.js e por salario-calc.test.js;
 * - alterar assinatura de função ou nome de constante quebra testes e UI;
 * - cada constante numérica deve ter comentário com ano vigente e fonte oficial.
 */

// ============================================
// CONSTANTES — BRASIL (Tabelas 2026)
// ============================================
// Fontes:
//  - INSS 2026: gov.br/inss (reajuste 3,9% — Portaria MPS/MF 2026); teto R$ 8.475,55.
//  - IRRF 2026: tabela tradicional vigente sem mudança em relação a 2025
//    (redutor adicional da isenção até R$ 5.000 não modelado nesta versão).

export const INSS_BR_FAIXAS = [
    { ate: 1621.00, aliq: 0.075 },
    { ate: 2902.84, aliq: 0.09 },
    { ate: 4354.27, aliq: 0.12 },
    { ate: 8475.55, aliq: 0.14 }
];
export const INSS_BR_TETO = 8475.55;

export const IRRF_BR_FAIXAS = [
    { ate: 2259.20, aliq: 0,     deduzir: 0      },
    { ate: 2826.65, aliq: 0.075, deduzir: 169.44 },
    { ate: 3751.05, aliq: 0.15,  deduzir: 381.44 },
    { ate: 4664.68, aliq: 0.225, deduzir: 662.77 },
    { ate: Infinity, aliq: 0.275, deduzir: 896.00 }
];
export const IRRF_BR_DEP = 189.59;
export const IRRF_BR_SIMPLIFICADO = 607.20;

export const FGTS_ALIQ = 0.08;
export const VT_MAX_ALIQ = 0.06;
export const FGTS_MULTA_RESCISAO = 0.40;
export const CUSTO_EMPRESA_FATOR = 1.70;

// ============================================
// CONSTANTES — ITÁLIA (2026)
// ============================================
// Fontes:
//  - IRPEF 2026: 2º scaglione passa de 35% para 33% (Legge di Bilancio 2026,
//    confermata da Agenzia delle Entrate). 1º scaglione (23%) e 3º (43%) inalterados.
//  - INPS 2026: Circolare INPS n. 6 del 30/01/2026; soglia +1% a €56.224 annui.
//    Nota: existe ainda massimale contributivo (€122.295) acima do qual não se contribui;
//    não modelado nesta versão (impacto apenas em rendas muito altas).

export const IRPEF_IT_FAIXAS = [
    { ate: 28000,    aliq: 0.23 },
    { ate: 50000,    aliq: 0.33 },
    { ate: Infinity, aliq: 0.43 }
];

export const INPS_IT_ALIQ = 0.0919;
export const INPS_IT_MASSIMALE = 56224;

export const ADD_REGIONAL_IT = {
    abruzzo: 1.73, basilicata: 1.23, calabria: 1.73, campania: 2.03,
    emilia: 1.93, friuli: 1.23, lazio: 3.33, liguria: 1.73,
    lombardia: 1.74, marche: 1.73, molise: 3.33, piemonte: 3.33,
    puglia: 1.33, sardegna: 1.23, sicilia: 1.23, toscana: 1.73,
    trentino: 1.23, umbria: 1.83, valledaosta: 1.23, veneto: 1.23
};

export const TFR_IT_DIVISOR = 13.5;
export const TFR_IT_ALIQ_NETA = 0.0691;
export const COSTO_AZIENDA_IT = 1.40;

// ============================================
// FUNÇÕES DE CÁLCULO — BRASIL
// ============================================

export function calcularINSS(bruto) {
    if (bruto <= 0) return 0;
    const base = Math.min(bruto, INSS_BR_TETO);
    let inss = 0;
    let anterior = 0;
    for (const faixa of INSS_BR_FAIXAS) {
        if (base > faixa.ate) {
            inss += (faixa.ate - anterior) * faixa.aliq;
            anterior = faixa.ate;
        } else {
            inss += (base - anterior) * faixa.aliq;
            break;
        }
    }
    return inss;
}

export function calcularIRRFBase(base) {
    for (const f of IRRF_BR_FAIXAS) {
        if (base <= f.ate) {
            return Math.max(0, base * f.aliq - f.deduzir);
        }
    }
    return 0;
}

export function calcularIRRF(baseBruto, inss, dependentes) {
    const baseTrad = Math.max(0, baseBruto - inss - dependentes * IRRF_BR_DEP);
    const baseSimp = Math.max(0, baseBruto - inss - IRRF_BR_SIMPLIFICADO);

    const irTrad = calcularIRRFBase(baseTrad);
    const irSimp = calcularIRRFBase(baseSimp);

    return Math.min(irTrad, irSimp);
}

export function calcularBR(v) {
    const bruto = v.bruto;
    const meses = v.meses;

    const inss = calcularINSS(bruto);
    const irrf = calcularIRRF(bruto, inss, v.dependentes);

    const vt = v.vt === 'sim' ? bruto * VT_MAX_ALIQ : 0;
    const plano = v.plano;
    const outros = v.outros;
    const totalDescontos = inss + irrf + vt + plano + outros;
    const liquido = bruto - totalDescontos;

    const fgtsMensal = bruto * FGTS_ALIQ;
    const fgtsAcumulado = fgtsMensal * meses;

    const mesesAtual = ((meses - 1) % 12) + 1;
    const decimoBruto = (bruto / 12) * mesesAtual;
    const decimoINSS = calcularINSS(decimoBruto);
    // Usa min(tradicional, simplificado) — alinhado com o IRRF mensal.
    const decimoIRRF = calcularIRRF(decimoBruto, decimoINSS, v.dependentes);
    const decimoLiquido = decimoBruto - decimoINSS - decimoIRRF;

    let feriasLiquido = 0;
    let feriasBruto = 0;
    if (meses >= 12) {
        feriasBruto = bruto + (bruto / 3);
        const fINSS = calcularINSS(feriasBruto);
        const fIRRF = calcularIRRF(feriasBruto, fINSS, v.dependentes);
        feriasLiquido = feriasBruto - fINSS - fIRRF;
    }

    // Aviso prévio: Lei 12.506/2011 + Nota Técnica MTE 184/2012.
    // 30 dias mínimo até o 1º ano completo; +3 dias por ano completo a partir do 2º.
    // Capa em 90 dias (alcançado a partir de 21 anos).
    const anos = Math.floor(meses / 12);
    const diasAviso = Math.min(90, 30 + Math.max(0, anos - 1) * 3);
    const aviso = (bruto / 30) * diasAviso;
    const feriasProp = (bruto + bruto / 3) * ((meses % 12) / 12);
    const decimoProp = decimoBruto;
    const multaFgts = fgtsAcumulado * FGTS_MULTA_RESCISAO;
    const rescisao = aviso + decimoProp + feriasProp + multaFgts + fgtsAcumulado;

    const custoEmpresa = bruto * CUSTO_EMPRESA_FATOR;
    const rendaAnual = liquido * 12 + decimoLiquido + feriasLiquido;
    const aliqEfetiva = bruto > 0 ? (totalDescontos / bruto) * 100 : 0;

    return {
        pais: 'br',
        bruto, inss, irrf, vt, plano, outros,
        totalDescontos, liquido, aliqEfetiva,
        fgtsMensal, fgtsAcumulado,
        decimoBruto, decimoLiquido,
        feriasBruto, feriasLiquido,
        rescisao, custoEmpresa, rendaAnual,
        avisoDias: diasAviso, multaFgts,
        dependentes: v.dependentes, meses
    };
}

// ============================================
// FUNÇÕES DE CÁLCULO — ITÁLIA
// ============================================

export function calcularINPS(ralMensile) {
    const massimaleMensile = INPS_IT_MASSIMALE / 12;
    if (ralMensile <= massimaleMensile) {
        return ralMensile * INPS_IT_ALIQ;
    }
    return massimaleMensile * INPS_IT_ALIQ + (ralMensile - massimaleMensile) * (INPS_IT_ALIQ + 0.01);
}

export function calcularINPSAnnuo(ralAnnuo) {
    if (ralAnnuo <= 0) return 0;
    const base = Math.min(ralAnnuo, INPS_IT_MASSIMALE);
    const excedente = Math.max(0, ralAnnuo - INPS_IT_MASSIMALE);
    return base * INPS_IT_ALIQ + excedente * (INPS_IT_ALIQ + 0.01);
}

export function obterMensilitaIT(v) {
    return 12 + (v.tredicesima === 'sim' ? 1 : 0) + (v.quattordicesima === 'sim' ? 1 : 0);
}

export function calcularIRPEFLorda(imponibile) {
    if (imponibile <= 0) return 0;
    let ir = 0;
    let anterior = 0;
    for (const f of IRPEF_IT_FAIXAS) {
        if (imponibile > f.ate) {
            ir += (f.ate - anterior) * f.aliq;
            anterior = f.ate;
        } else {
            ir += (imponibile - anterior) * f.aliq;
            break;
        }
    }
    return ir;
}

export function calcularDetrazioneLavoro(redditoAnnuo) {
    if (redditoAnnuo <= 15000) {
        return 1955;
    } else if (redditoAnnuo <= 28000) {
        return 1910 + 1190 * ((28000 - redditoAnnuo) / 13000);
    } else if (redditoAnnuo <= 50000) {
        return 1910 * ((50000 - redditoAnnuo) / 22000);
    }
    return 0;
}

export function calcularDetrazioneFamiliari(numFamiliari, redditoAnnuo) {
    if (numFamiliari <= 0) return 0;
    const base = 750;
    const fator = Math.max(0, (80000 - redditoAnnuo) / 80000);
    return numFamiliari * base * fator;
}

export function calcularIRPEFMarginal(imponibileBase, importoExtra) {
    const totalCom = calcularIRPEFLorda(imponibileBase + importoExtra);
    const totalSem = calcularIRPEFLorda(imponibileBase);
    return totalCom - totalSem;
}

export function calcularIT(v) {
    const ral = v.bruto;
    const mensilita = obterMensilitaIT(v);
    const ralMensile = mensilita > 0 ? ral / mensilita : 0;
    const inpsAnnuo = calcularINPSAnnuo(ral);

    const previdenza = Math.min(v.plano * 12, 5164.57);
    const imponibileAnnuo = Math.max(0, ral - inpsAnnuo - previdenza);

    const irpefLorda = calcularIRPEFLorda(imponibileAnnuo);
    const detrLavoro = calcularDetrazioneLavoro(imponibileAnnuo);
    const detrFamiliari = calcularDetrazioneFamiliari(v.dependentes, imponibileAnnuo);
    const detrazioni = detrLavoro + detrFamiliari;

    const irpefNetta = Math.max(0, irpefLorda - detrazioni);

    // Trattamento integrativo (ex-bonus Renzi):
    // - €1200/anno abaixo de €15.000 (capienza positiva: imposta lorda > detrazione lavoro);
    // - decai linearmente entre €15.000 e €28.000;
    // - zero acima de €28.000.
    let trattamentoIntegrativo = 0;
    if (irpefLorda > detrLavoro) {
        if (imponibileAnnuo <= 15000) {
            trattamentoIntegrativo = 1200;
        } else if (imponibileAnnuo <= 28000) {
            trattamentoIntegrativo = 1200 * ((28000 - imponibileAnnuo) / 13000);
        }
    }

    const addReg = (ADD_REGIONAL_IT[v.regione] || 1.23) / 100;
    const addCom = (v.comunale || 0) / 100;
    const addRegionalAnnua = imponibileAnnuo * addReg;
    const addComunaleAnnua = imponibileAnnuo * addCom;

    let tredicesimaNetta = 0;
    let tredicesimaBruta = 0;
    let tredicesimaInps = 0;
    let tredicesimaIrpef = 0;
    if (v.tredicesima === 'sim') {
        tredicesimaBruta = ralMensile;
        tredicesimaInps = calcularINPS(tredicesimaBruta);
    }

    let quattordicesimaNetta = 0;
    let quattordicesimaBruta = 0;
    let quattordicesimaInps = 0;
    let quattordicesimaIrpef = 0;
    if (v.quattordicesima === 'sim') {
        quattordicesimaBruta = ralMensile;
        quattordicesimaInps = calcularINPS(quattordicesimaBruta);
    }

    const imponibileTredicesima = Math.max(0, tredicesimaBruta - tredicesimaInps);
    const imponibileQuattordicesima = Math.max(0, quattordicesimaBruta - quattordicesimaInps);
    let imponibileBaseMensilitaOrdinarie = Math.max(
        0,
        imponibileAnnuo - imponibileTredicesima - imponibileQuattordicesima
    );

    if (tredicesimaBruta > 0) {
        tredicesimaIrpef = calcularIRPEFMarginal(imponibileBaseMensilitaOrdinarie, imponibileTredicesima);
        tredicesimaNetta = tredicesimaBruta - tredicesimaInps - tredicesimaIrpef;
        imponibileBaseMensilitaOrdinarie += imponibileTredicesima;
    }

    if (quattordicesimaBruta > 0) {
        quattordicesimaIrpef = calcularIRPEFMarginal(imponibileBaseMensilitaOrdinarie, imponibileQuattordicesima);
        quattordicesimaNetta = quattordicesimaBruta - quattordicesimaInps - quattordicesimaIrpef;
    }

    const addRegionalMensile = addRegionalAnnua / 12;
    const addComunaleMensile = addComunaleAnnua / 12;
    const trattamentoMensile = trattamentoIntegrativo / 12;
    const irpefMensile = Math.max(0, irpefNetta - tredicesimaIrpef - quattordicesimaIrpef) / 12;
    const inpsMensile = Math.max(0, inpsAnnuo - tredicesimaInps - quattordicesimaInps) / 12;

    const outros = v.outros;
    const totalDescontos = inpsMensile + irpefMensile + addRegionalMensile + addComunaleMensile + outros + v.plano - trattamentoMensile;
    const liquido = ralMensile - totalDescontos;

    const tfrMensile = (ral * TFR_IT_ALIQ_NETA) / 12;
    let tfrAccumulato;
    if (v.tfrDestino === 'fondo') {
        const ai = 0.04 / 12;
        tfrAccumulato = tfrMensile * ((Math.pow(1 + ai, v.meses) - 1) / ai);
    } else {
        const ai = 0.03 / 12;
        tfrAccumulato = tfrMensile * ((Math.pow(1 + ai, v.meses) - 1) / ai);
    }

    const liquidazione = tfrAccumulato;
    const custoEmpresa = (ral * COSTO_AZIENDA_IT) / 12;
    const rendaAnual = liquido * 12 + tredicesimaNetta + quattordicesimaNetta;
    const aliqEfetiva = ralMensile > 0 ? (totalDescontos / ralMensile) * 100 : 0;

    return {
        pais: 'it',
        bruto: ralMensile, ral,
        inss: inpsMensile, irrf: irpefMensile,
        vt: addRegionalMensile,
        plano: addComunaleMensile,
        outros, totalDescontos, liquido, aliqEfetiva,
        detrazioni, detrLavoro, detrFamiliari, trattamentoIntegrativo,
        fgtsMensal: tfrMensile, fgtsAcumulado: tfrAccumulato,
        decimoBruto: tredicesimaBruta, decimoLiquido: tredicesimaNetta,
        feriasBruto: quattordicesimaBruta, feriasLiquido: quattordicesimaNetta,
        rescisao: liquidazione, custoEmpresa, rendaAnual,
        regione: v.regione, meses: v.meses, dependentes: v.dependentes,
        tfrDestino: v.tfrDestino, mensilita
    };
}
