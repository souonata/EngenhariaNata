/**
 * salario-script.js
 * Calculadora de salário líquido, benefícios e rescisão.
 *
 * Modo BR (pt-BR): CLT — INSS, IRRF, FGTS, 13º, férias, rescisão (valores 2025).
 * Modo IT (it-IT): Lavoro dipendente — IRPEF 3 scaglioni 2024, INPS, addizionali, TFR, tredicesima.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES — BRASIL (Tabelas 2025)
// ============================================

// INSS 2025 — faixas progressivas
const INSS_BR_FAIXAS = [
    { ate: 1518.00, aliq: 0.075 },
    { ate: 2793.88, aliq: 0.09  },
    { ate: 4190.83, aliq: 0.12  },
    { ate: 8157.41, aliq: 0.14  }
];
const INSS_BR_TETO = 8157.41; // salário máximo

// IRRF 2025 (vigente desde maio/2024)
const IRRF_BR_FAIXAS = [
    { ate: 2259.20, aliq: 0,     deduzir: 0      },
    { ate: 2826.65, aliq: 0.075, deduzir: 169.44 },
    { ate: 3751.05, aliq: 0.15,  deduzir: 381.44 },
    { ate: 4664.68, aliq: 0.225, deduzir: 662.77 },
    { ate: Infinity, aliq: 0.275, deduzir: 896.00 }
];
const IRRF_BR_DEP = 189.59;            // dedução por dependente
const IRRF_BR_SIMPLIFICADO = 607.20;   // desconto simplificado (substitui dependentes se melhor)

const FGTS_ALIQ = 0.08;
const VT_MAX_ALIQ = 0.06;
const FGTS_MULTA_RESCISAO = 0.40;
const CUSTO_EMPRESA_FATOR = 1.70; // aproximado Simples+INSS patronal+Sistema S+férias+13º

// ============================================
// CONSTANTES — ITÁLIA (2025-2026)
// ============================================

// IRPEF 3 scaglioni (riforma 2024)
const IRPEF_IT_FAIXAS = [
    { ate: 28000,    aliq: 0.23 },
    { ate: 50000,    aliq: 0.35 },
    { ate: Infinity, aliq: 0.43 }
];

const INPS_IT_ALIQ = 0.0919;          // lavoratore dipendente
const INPS_IT_MASSIMALE = 55008;      // 2025

// Addizionali regionali (aliquota unica ou media aproximada)
const ADD_REGIONAL_IT = {
    abruzzo: 1.73, basilicata: 1.23, calabria: 1.73, campania: 2.03,
    emilia: 1.93, friuli: 1.23, lazio: 3.33, liguria: 1.73,
    lombardia: 1.74, marche: 1.73, molise: 3.33, piemonte: 3.33,
    puglia: 1.33, sardegna: 1.23, sicilia: 1.23, toscana: 1.73,
    trentino: 1.23, umbria: 1.83, valledaosta: 1.23, veneto: 1.23
};

const TFR_IT_DIVISOR = 13.5;          // TFR = RAL / 13.5 = 7.41% (6.91% após contribuzione INPS 0.5%)
const TFR_IT_ALIQ_NETA = 0.0691;      // quota accantonata per TFR
const COSTO_AZIENDA_IT = 1.40;        // RAL + oneri patronali ~30%

// ============================================
// MAPEAMENTO SLIDER → INPUT
// ============================================
const SLIDER_TO_INPUT = {
    sliderBruto:       'inputBruto',
    sliderDependentes: 'inputDependentes',
    sliderPlano:       'inputPlano',
    sliderOutros:      'inputOutros',
    sliderMeses:       'inputMeses',
    sliderComunale:    'inputComunale'
};

const CONFIG_BRUTO_POR_MODO = {
    br: { min: 1000, max: 50000, step: 100, valorPadrao: 5000 },
    it: { min: 12000, max: 250000, step: 500, valorPadrao: 35000 }
};

// ============================================
// FUNÇÕES DE CÁLCULO — BRASIL
// ============================================

function calcularINSS(bruto) {
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

function calcularIRRF(baseBruto, inss, dependentes) {
    // Base tradicional
    const baseTrad = Math.max(0, baseBruto - inss - dependentes * IRRF_BR_DEP);
    // Base simplificada
    const baseSimp = Math.max(0, baseBruto - inss - IRRF_BR_SIMPLIFICADO);

    const irTrad = calcularIRRFBase(baseTrad);
    const irSimp = calcularIRRFBase(baseSimp);

    // Usa o menor
    return Math.min(irTrad, irSimp);
}

function calcularIRRFBase(base) {
    for (const f of IRRF_BR_FAIXAS) {
        if (base <= f.ate) {
            return Math.max(0, base * f.aliq - f.deduzir);
        }
    }
    return 0;
}

function calcularBR(v) {
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

    // 13º proporcional (baseado no mês atual — aproximação: usa meses % 12)
    const mesesAtual = ((meses - 1) % 12) + 1;
    const decimoBruto = (bruto / 12) * mesesAtual;
    const decimoINSS = calcularINSS(decimoBruto);
    const decimoIRRF = calcularIRRFBase(Math.max(0, decimoBruto - decimoINSS - v.dependentes * IRRF_BR_DEP));
    const decimoLiquido = decimoBruto - decimoINSS - decimoIRRF;

    // Férias + 1/3 (se tiver ≥12 meses de empresa)
    let feriasLiquido = 0, feriasBruto = 0;
    if (meses >= 12) {
        feriasBruto = bruto + (bruto / 3);
        const fINSS = calcularINSS(feriasBruto);
        const fIRRF = calcularIRRFBase(Math.max(0, feriasBruto - fINSS - v.dependentes * IRRF_BR_DEP));
        feriasLiquido = feriasBruto - fINSS - fIRRF;
    }

    // Rescisão sem justa causa
    const anos = Math.floor(meses / 12);
    const diasAviso = Math.min(90, 30 + (anos >= 1 ? anos * 3 : 0));
    const aviso = (bruto / 30) * diasAviso;
    const feriasProp = (bruto + bruto / 3) * ((meses % 12) / 12);
    const decimoProp = decimoBruto;
    const multaFgts = fgtsAcumulado * FGTS_MULTA_RESCISAO;
    const rescisao = aviso + decimoProp + feriasProp + multaFgts + fgtsAcumulado;

    // Custo empresa (mensal)
    const custoEmpresa = bruto * CUSTO_EMPRESA_FATOR;

    // Renda anual
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
        // para explicações
        avisoDias: diasAviso, multaFgts,
        dependentes: v.dependentes, meses
    };
}

// ============================================
// FUNÇÕES DE CÁLCULO — ITÁLIA
// ============================================

function calcularINPS(ralMensile) {
    const massimaleMensile = INPS_IT_MASSIMALE / 12;
    if (ralMensile <= massimaleMensile) {
        return ralMensile * INPS_IT_ALIQ;
    }
    return massimaleMensile * INPS_IT_ALIQ + (ralMensile - massimaleMensile) * (INPS_IT_ALIQ + 0.01);
}

function calcularINPSAnnuo(ralAnnuo) {
    if (ralAnnuo <= 0) return 0;
    const base = Math.min(ralAnnuo, INPS_IT_MASSIMALE);
    const excedente = Math.max(0, ralAnnuo - INPS_IT_MASSIMALE);
    return base * INPS_IT_ALIQ + excedente * (INPS_IT_ALIQ + 0.01);
}

function obterMensilitaIT(v) {
    return 12 + (v.tredicesima === 'sim' ? 1 : 0) + (v.quattordicesima === 'sim' ? 1 : 0);
}

function calcularIRPEFLorda(imponibile) {
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

// Detrazione lavoro dipendente (art. 13 TUIR, aggiornato 2024)
function calcularDetrazioneLavoro(redditoAnnuo) {
    if (redditoAnnuo <= 15000) {
        return 1955;
    } else if (redditoAnnuo <= 28000) {
        return 1910 + 1190 * ((28000 - redditoAnnuo) / 13000);
    } else if (redditoAnnuo <= 50000) {
        return 1910 * ((50000 - redditoAnnuo) / 22000);
    }
    return 0;
}

// Detrazione familiari a carico (simplificado: só >21 anni e outros, sem cônjuge detalhado)
function calcularDetrazioneFamiliari(numFamiliari, redditoAnnuo) {
    if (numFamiliari <= 0) return 0;
    // €750/familiar com decréscimo linear até €80.000
    const base = 750;
    const fator = Math.max(0, (80000 - redditoAnnuo) / 80000);
    return numFamiliari * base * fator;
}

function calcularIT(v) {
    const ral = v.bruto;
    const mensilita = obterMensilitaIT(v);
    const ralMensile = mensilita > 0 ? ral / mensilita : 0;
    const inpsAnnuo = calcularINPSAnnuo(ral);

    // Previdenza complementare (deducibile até €5.164,57/anno)
    const previdenza = Math.min(v.plano * 12, 5164.57);
    const imponibileAnnuo = Math.max(0, ral - inpsAnnuo - previdenza);

    const irpefLorda = calcularIRPEFLorda(imponibileAnnuo);
    const detrLavoro = calcularDetrazioneLavoro(imponibileAnnuo);
    const detrFamiliari = calcularDetrazioneFamiliari(v.dependentes, imponibileAnnuo);
    const detrazioni = detrLavoro + detrFamiliari;

    const irpefNetta = Math.max(0, irpefLorda - detrazioni);

    // Trattamento integrativo (ex-bonus Renzi): €1200/anno se reddito ≤ €15k e imposta > detrazioni
    let trattamentoIntegrativo = 0;
    if (imponibileAnnuo <= 15000 && irpefLorda > detrLavoro) {
        trattamentoIntegrativo = 1200;
    }

    // Addizionali (applicate sull'imponibile)
    const addReg = (ADD_REGIONAL_IT[v.regione] || 1.23) / 100;
    const addCom = (v.comunale || 0) / 100;
    const addRegionalAnnua = imponibileAnnuo * addReg;
    const addComunaleAnnua = imponibileAnnuo * addCom;

    // Tredicesima
    let tredicesimaNetta = 0, tredicesimaBruta = 0;
    let tredicesimaInps = 0, tredicesimaIrpef = 0;
    if (v.tredicesima === 'sim') {
        tredicesimaBruta = ralMensile;
        tredicesimaInps = calcularINPS(tredicesimaBruta);
    }

    // Quattordicesima
    let quattordicesimaNetta = 0, quattordicesimaBruta = 0;
    let quattordicesimaInps = 0, quattordicesimaIrpef = 0;
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

    // Mensile ordinario (12 buste paga base)
    const addRegionalMensile = addRegionalAnnua / 12;
    const addComunaleMensile = addComunaleAnnua / 12;
    const trattamentoMensile = trattamentoIntegrativo / 12;
    const irpefMensile = Math.max(0, irpefNetta - tredicesimaIrpef - quattordicesimaIrpef) / 12;
    const inpsMensile = Math.max(0, inpsAnnuo - tredicesimaInps - quattordicesimaInps) / 12;

    const outros = v.outros;
    const totalDescontos = inpsMensile + irpefMensile + addRegionalMensile + addComunaleMensile + outros + v.plano - trattamentoMensile;
    const liquido = ralMensile - totalDescontos;

    // TFR
    const tfrMensile = (ral * TFR_IT_ALIQ_NETA) / 12;
    let tfrAccumulato;
    if (v.tfrDestino === 'fondo') {
        // Fondo pensione — assume rendimento 4%/anno
        const ai = 0.04 / 12;
        tfrAccumulato = tfrMensile * ((Math.pow(1 + ai, v.meses) - 1) / ai);
    } else {
        // In azienda — rivalutazione 1,5% + 75% inflazione (assume 2% → 1,5% eff.) = ~3%/anno
        const ai = 0.03 / 12;
        tfrAccumulato = tfrMensile * ((Math.pow(1 + ai, v.meses) - 1) / ai);
    }

    // Liquidazione (TFR accumulato, senza anticipi)
    const liquidazione = tfrAccumulato;

    // Costo azienda médio mensal ao longo do ano
    const custoEmpresa = (ral * COSTO_AZIENDA_IT) / 12;

    const rendaAnual = liquido * 12 + tredicesimaNetta + quattordicesimaNetta;
    const aliqEfetiva = ralMensile > 0 ? (totalDescontos / ralMensile) * 100 : 0;

    return {
        pais: 'it',
        bruto: ralMensile, ral,
        inss: inpsMensile, irrf: irpefMensile,
        vt: addRegionalMensile,    // reuse field for "addizionale regionale" on BR=vt
        plano: addComunaleMensile, // reuse for addComunale (IT)
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

function calcularIRPEFMarginal(imponibileBase, importoExtra) {
    const totalCom = calcularIRPEFLorda(imponibileBase + importoExtra);
    const totalSem = calcularIRPEFLorda(imponibileBase);
    return totalCom - totalSem;
}

// ============================================
// CLASSE PRINCIPAL
// ============================================

class SalarioApp extends App {
    constructor() {
        super({
            appName: 'salario',
            callbacks: {
                aoInicializar:   () => this.inicializarSalario(),
                aoTrocarIdioma:  () => this.aposTrocarIdioma()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
        this.graficoDonut = null;
        this.graficoBarras = null;
        this.ultimoModoPaisAplicado = null;
    }

    get traducoes() {
        const idioma = i18n.obterIdiomaAtual();
        return this.config.traducoes[idioma] || this.config.traducoes['pt-BR'] || {};
    }

    get modoPais() {
        return i18n.obterIdiomaAtual() === 'it-IT' ? 'it' : 'br';
    }

    inicializarSalario() {
        this.aplicarModoPais();
        this.configurarEventos();
        document.addEventListener('engnata:themechange', () => {
            this.atualizarResultado();
        });
        this.atualizarResultado();
    }

    aposTrocarIdioma() {
        this.aplicarModoPais();
        this.atualizarResultado();
    }

    aplicarModoPais() {
        const body = document.body;
        body.classList.toggle('lang-br', this.modoPais === 'br');
        body.classList.toggle('lang-it', this.modoPais === 'it');
        // Atualiza unidades monetárias
        const moeda = i18n.obterMoeda() === 'EUR' ? '€' : 'R$';
        document.querySelectorAll('.moeda-unit, #unidadeMoeda').forEach(el => {
            el.textContent = moeda;
        });
        this.configurarEntradaBrutoPorPais();
    }

    // ============================================
    // EVENTOS
    // ============================================

    configurarEventos() {
        this.configurarIconesInfo();
        this.configurarBotoesIncremento();
        this.configurarSlidersEInputs();

        document.querySelectorAll('input[name="vt"], input[name="tredicesima"], input[name="quattordicesima"], input[name="tfrDestino"]')
            .forEach(r => r.addEventListener('change', () => this.atualizarResultado()));

        const selectRegione = document.getElementById('selectRegione');
        if (selectRegione) selectRegione.addEventListener('change', () => this.atualizarResultado());

        // Memorial
        document.getElementById('btnAbrirMemorial')?.addEventListener('click', () => this.abrirMemorial());
        document.getElementById('btnFecharMemorial')?.addEventListener('click', () => this.fecharMemorial());
        document.getElementById('btnVoltarMemorial2')?.addEventListener('click', () => this.fecharMemorial());
    }

    configurarIconesInfo() {
        document.querySelectorAll('.info-icon[data-info-target]').forEach((icon) => {
            const desc = document.getElementById(icon.getAttribute('data-info-target'));
            if (!icon || !desc) return;
            const toggle = () => {
                desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
            };
            icon.addEventListener('click', toggle);
            icon.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
        });
    }

    configurarEntradaBrutoPorPais() {
        const slider = document.getElementById('sliderBruto');
        const input = document.getElementById('inputBruto');
        const config = CONFIG_BRUTO_POR_MODO[this.modoPais];
        if (!slider || !input || !config) return;

        const valorAtual = parseFloat(String(input.value).replace(',', '.'));
        const configAnterior = this.ultimoModoPaisAplicado
            ? CONFIG_BRUTO_POR_MODO[this.ultimoModoPaisAplicado]
            : null;

        slider.min = String(config.min);
        slider.max = String(config.max);
        slider.step = String(config.step);

        let valorFinal = Number.isFinite(valorAtual) ? valorAtual : config.valorPadrao;
        if (!this.ultimoModoPaisAplicado && this.modoPais === 'it' && valorFinal <= CONFIG_BRUTO_POR_MODO.br.valorPadrao) {
            valorFinal = config.valorPadrao;
        }
        if (this.ultimoModoPaisAplicado && this.ultimoModoPaisAplicado !== this.modoPais) {
            const usavaValorPadraoAnterior = configAnterior
                ? Math.abs(valorFinal - configAnterior.valorPadrao) < 0.0001
                : false;
            if (usavaValorPadraoAnterior || valorFinal < config.min) {
                valorFinal = config.valorPadrao;
            }
        }

        valorFinal = Math.min(config.max, Math.max(config.min, valorFinal));
        slider.value = String(valorFinal);
        input.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
        this.ultimoModoPaisAplicado = this.modoPais;
    }

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            let animationFrame = null;
            let tempoInicio = 0;
            let estaSegurando = false;
            let direcao = 1;

            const animar = (timestamp) => {
                if (!estaSegurando) return;
                const sliderId = btn.getAttribute('data-target');
                const slider   = document.getElementById(sliderId);
                const inputId  = SLIDER_TO_INPUT[sliderId];
                const inputEl  = inputId ? document.getElementById(inputId) : null;
                if (!slider) return;

                const tempoDecorrido = timestamp - tempoInicio;
                const sliderMin  = parseFloat(slider.min);
                const sliderMax  = parseFloat(slider.max);
                const velocidade = (sliderMax - sliderMin) / 3000;
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
                novoValor = Math.max(sliderMin * 0.5, novoValor);

                slider.value = novoValor;
                if (inputEl) {
                    inputEl.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                }
                this.atualizarResultado();
                animationFrame = requestAnimationFrame(animar);
            };

            const iniciar = (e) => {
                e.preventDefault();
                const sliderId = btn.getAttribute('data-target');
                const slider   = document.getElementById(sliderId);
                if (!slider) return;
                direcao = parseFloat(btn.getAttribute('data-step')) > 0 ? 1 : -1;
                estaSegurando = true;
                btn.dataset.valorInicial = parseFloat(slider.value);
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const parar = () => {
                estaSegurando = false;
                if (animationFrame) cancelAnimationFrame(animationFrame);
            };

            btn.addEventListener('mousedown',   iniciar);
            btn.addEventListener('touchstart',  iniciar, { passive: false });
            btn.addEventListener('mouseup',     parar);
            btn.addEventListener('mouseleave',  parar);
            btn.addEventListener('touchend',    parar);
            btn.addEventListener('touchcancel', parar);
        });
    }

    configurarSlidersEInputs() {
        Object.entries(SLIDER_TO_INPUT).forEach(([sliderId, inputId]) => {
            const slider = document.getElementById(sliderId);
            const input  = document.getElementById(inputId);
            if (!slider || !input) return;

            slider.addEventListener('input', () => {
                input.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                this.atualizarResultado();
            });
            input.addEventListener('change', () => {
                const val = parseFloat(String(input.value).replace(',', '.'));
                if (!isNaN(val)) {
                    slider.value = val;
                    input.value = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                }
                this.atualizarResultado();
            });
        });
    }

    decimaisPorSlider(slider) {
        const step = parseFloat(slider.step) || 1;
        return step < 1 ? (String(step).split('.')[1]?.length || 1) : 0;
    }

    // ============================================
    // LEITURA DE ENTRADAS
    // ============================================

    obterValores() {
        return {
            bruto:         parseFloat(document.getElementById('inputBruto').value) || 0,
            dependentes:   parseInt(document.getElementById('inputDependentes').value) || 0,
            plano:         parseFloat(document.getElementById('inputPlano').value) || 0,
            outros:        parseFloat(document.getElementById('inputOutros').value) || 0,
            meses:         parseInt(document.getElementById('inputMeses').value) || 1,
            vt:            document.querySelector('input[name="vt"]:checked')?.value || 'nao',
            regione:       document.getElementById('selectRegione')?.value || 'veneto',
            comunale:      parseFloat(String(document.getElementById('inputComunale')?.value || '0').replace(',', '.')) || 0,
            tredicesima:   document.querySelector('input[name="tredicesima"]:checked')?.value || 'sim',
            quattordicesima: document.querySelector('input[name="quattordicesima"]:checked')?.value || 'nao',
            tfrDestino:    document.querySelector('input[name="tfrDestino"]:checked')?.value || 'azienda'
        };
    }

    // ============================================
    // RENDER
    // ============================================

    atualizarResultado() {
        const v = this.obterValores();
        const res = this.modoPais === 'it' ? calcularIT(v) : calcularBR(v);
        this.atualizarDOM(res);
        this.explicacao.renderizar(this.gerarExplicacao(res));
        this.atualizarGraficos(res);
    }

    fMoeda(v) {
        return formatarMoeda(v, i18n.obterMoeda());
    }

    atualizarDOM(r) {
        document.getElementById('resultadoLiquido').textContent = this.fMoeda(r.liquido);
        document.getElementById('resultadoInss').textContent    = this.fMoeda(r.inss);
        document.getElementById('resultadoIrrf').textContent    = this.fMoeda(r.irrf);

        if (r.pais === 'br') {
            document.getElementById('resultadoVt').textContent       = this.fMoeda(r.vt);
            document.getElementById('resultadoPlano').textContent    = this.fMoeda(r.plano);
            document.getElementById('resultadoFeriasBr').textContent = this.fMoeda(r.feriasLiquido);
        } else {
            document.getElementById('resultadoAddRegional').textContent = this.fMoeda(r.vt);
            document.getElementById('resultadoAddComunal').textContent  = this.fMoeda(r.plano);
            document.getElementById('resultadoFerias').textContent      = this.fMoeda(r.feriasLiquido);
        }

        document.getElementById('resultadoOutros').textContent         = this.fMoeda(r.outros);
        document.getElementById('resultadoTotalDescontos').textContent = this.fMoeda(r.totalDescontos);
        document.getElementById('resultadoAliqEfetiva').textContent    = formatarNumero(r.aliqEfetiva, 1) + '%';

        document.getElementById('resultadoDecimoTerceiro').textContent = this.fMoeda(r.decimoLiquido);
        document.getElementById('resultadoFgtsMensal').textContent     = this.fMoeda(r.fgtsMensal);
        document.getElementById('resultadoFgtsAcumulado').textContent  = this.fMoeda(r.fgtsAcumulado);
        document.getElementById('resultadoRendaAnual').textContent     = this.fMoeda(r.rendaAnual);
        document.getElementById('resultadoRescisao').textContent       = this.fMoeda(r.rescisao);
        document.getElementById('resultadoCustoEmpresa').textContent   = this.fMoeda(r.custoEmpresa);
    }

    gerarExplicacao(r) {
        const isIt = r.pais === 'it';
        const bruto = r.bruto;
        const liq = r.liquido;
        const pct = bruto > 0 ? (liq / bruto) * 100 : 0;

        const linhas = isIt ? [
            {
                icone: '💶',
                titulo: 'RAL → Netto',
                valor: `${this.fMoeda(bruto)} → ${this.fMoeda(liq)}`,
                descricao: `Da ogni €100 lordi, ti restano €${pct.toFixed(1)} in tasca. Aliquota effettiva: ${r.aliqEfetiva.toFixed(1)}%.`
            },
            {
                icone: '🏛️',
                titulo: 'INPS (9,19%)',
                valor: this.fMoeda(r.inss),
                descricao: `Contributo previdenziale obbligatorio. Va a costruire la tua pensione futura.`
            },
            {
                icone: '📊',
                titulo: 'IRPEF + Addizionali',
                valor: this.fMoeda(r.irrf + r.vt + r.plano),
                descricao: `IRPEF a 3 scaglioni (23%/35%/43%) meno detrazioni (€${Math.round(r.detrazioni)}/anno). Addizionali regionale e comunale applicate separatamente.`
            },
            {
                icone: '🎁',
                titulo: 'Tredicesima + TFR',
                valor: this.fMoeda(r.decimoLiquido + r.fgtsMensal * 12),
                descricao: `13ª mensilità (dicembre) + TFR 6,91% RAL accantonato ${r.tfrDestino === 'fondo' ? 'nel fondo pensione' : 'in azienda'}.`
            }
        ] : [
            {
                icone: '💰',
                titulo: 'Bruto → Líquido',
                valor: `${this.fMoeda(bruto)} → ${this.fMoeda(liq)}`,
                descricao: `De cada R$ 100 brutos, sobram R$ ${pct.toFixed(1)} no bolso. Alíquota efetiva: ${r.aliqEfetiva.toFixed(1)}%.`
            },
            {
                icone: '🏛️',
                titulo: 'INSS (progressivo)',
                valor: this.fMoeda(r.inss),
                descricao: `Contribuição previdenciária por faixas: 7,5% / 9% / 12% / 14%. Teto 2025: R$ ${formatarNumero(INSS_BR_TETO, 2)} (contribuição máx. ≈ R$ 951,62).`
            },
            {
                icone: '📊',
                titulo: 'IRRF',
                valor: this.fMoeda(r.irrf),
                descricao: `Base = bruto − INSS − dependentes (R$ 189,59 cada). Desconto simplificado (R$ 607,20) aplicado automaticamente se mais vantajoso.`
            },
            {
                icone: '🏦',
                titulo: 'FGTS',
                valor: `${this.fMoeda(r.fgtsMensal)}/mês`,
                descricao: `8% do bruto depositado pela empresa em conta vinculada. Acumulado em ${r.meses} meses: ${this.fMoeda(r.fgtsAcumulado)}.`
            },
            {
                icone: '🎁',
                titulo: '13º + Férias',
                valor: this.fMoeda(r.decimoLiquido + r.feriasLiquido),
                descricao: `13º proporcional aos ${((r.meses - 1) % 12) + 1} mês(es) do ciclo. Férias + 1/3 ${r.meses >= 12 ? 'disponíveis' : '(disponível após 12 meses)'}.`
            }
        ];

        return {
            linhas,
            destaque: isIt
                ? `Netto mensile ordinario: ${this.fMoeda(liq)} (${pct.toFixed(1)}% del lordo mensile, RAL ${this.fMoeda(r.ral)}/anno)`
                : `Líquido mensal: ${this.fMoeda(liq)} (${pct.toFixed(1)}% do bruto)`,
            dica: isIt
                ? 'Conferire il TFR a un fondo pensione può offrire rendimenti migliori (tipicamente 3-6% vs 1,5% fisso in azienda) e vantaggi fiscali al riscatto (aliquota fino 15% invece di 23%).'
                : 'Para simular rescisão, ajuste "Meses na Empresa". Direitos acumulam: 13º proporcional, férias + 1/3 após 12 meses, e multa de 40% sobre FGTS em demissão sem justa causa.',
            norma: isIt
                ? 'Riforma IRPEF 2024 (3 scaglioni) • TUIR art. 13 • INPS 2025'
                : 'INSS 2025 (Port. 6/2025) • IRRF 2024 (MP 1.206/24) • CLT'
        };
    }

    // ============================================
    // GRÁFICOS
    // ============================================

    get coresGrafico() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            liquido:  isDark ? '#4DD0E1' : '#00ACC1',
            inss:     '#EF5350',
            irrf:     '#FFA726',
            add1:     '#AB47BC',
            add2:     '#7E57C2',
            plano:    '#66BB6A',
            outros:   '#78909C',
            decimo:   isDark ? '#81C784' : '#43A047',
            ferias:   isDark ? '#FFD54F' : '#F9A825',
            fgts:     isDark ? '#64B5F6' : '#1E88E5',
            texto:    isDark ? '#E8EAED' : '#333'
        };
    }

    atualizarGraficos(r) {
        this.atualizarDonut(r);
        this.atualizarBarras(r);
    }

    atualizarDonut(r) {
        const canvas = document.getElementById('graficoDonut');
        if (!canvas || !window.Chart) return;

        const t = this.traducoes;
        const cores = this.coresGrafico;
        const isIt = r.pais === 'it';

        const labels = isIt
            ? ['Netto', 'INPS', 'IRPEF', 'Add. Regionale', 'Add. Comunale', 'Altre']
            : ['Líquido', 'INSS', 'IRRF', 'VT', 'Plano', 'Outros'];
        const data = [
            Math.max(0, r.liquido),
            r.inss, r.irrf, r.vt, r.plano, r.outros
        ];
        const bg = [cores.liquido, cores.inss, cores.irrf, cores.add1, cores.add2, cores.outros];

        if (this.graficoDonut) this.graficoDonut.destroy();
        this.graficoDonut = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: bg, borderWidth: 2, borderColor: 'transparent' }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: cores.texto, font: { size: 11 }, padding: 8, boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.parsed;
                                const total = data.reduce((a,b) => a+b, 0);
                                const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
                                return `${ctx.label}: ${this.fMoeda(val)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    atualizarBarras(r) {
        const canvas = document.getElementById('graficoBarras');
        if (!canvas || !window.Chart) return;

        const cores = this.coresGrafico;
        const isIt = r.pais === 'it';

        const labels = isIt
            ? ['12 × Netto', '13ª', '14ª', 'TFR annuo']
            : ['12 × Líquido', '13º', 'Férias + 1/3', 'FGTS anual'];
        const data = [
            r.liquido * 12,
            r.decimoLiquido,
            r.feriasLiquido,
            r.fgtsMensal * 12
        ];
        const bg = [cores.liquido, cores.decimo, cores.ferias, cores.fgts];

        if (this.graficoBarras) this.graficoBarras.destroy();
        this.graficoBarras = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ data, backgroundColor: bg, borderRadius: 6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => this.fMoeda(ctx.parsed.x)
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: cores.texto,
                            callback: (v) => this.fMoeda(v).replace(/,\d{2}$/, '')
                        },
                        grid: { color: 'rgba(128,128,128,0.15)' }
                    },
                    y: {
                        ticks: { color: cores.texto, font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // ============================================
    // MEMORIAL — Conteúdo dinâmico com referências
    // ============================================

    abrirMemorial() {
        const section = document.getElementById('memorialSection');
        const inputs = document.getElementById('inputsSection');
        const results = document.getElementById('resultadosSection');
        const v2 = document.getElementById('v2-explicacao');

        this.renderizarMemorial();
        section.style.display = 'block';
        if (inputs) inputs.style.display = 'none';
        if (results) results.style.display = 'none';
        if (v2) v2.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    fecharMemorial() {
        document.getElementById('memorialSection').style.display = 'none';
        const inputs = document.getElementById('inputsSection');
        const results = document.getElementById('resultadosSection');
        const v2 = document.getElementById('v2-explicacao');
        if (inputs) inputs.style.display = '';
        if (results) results.style.display = '';
        if (v2) v2.style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderizarMemorial() {
        const t = this.traducoes;
        const m = t.memorial || {};
        const isIt = this.modoPais === 'it';

        const tabelaInss = isIt
            ? `<table class="mem-tabela">
                 <thead><tr><th>Categoria</th><th>Aliquota</th></tr></thead>
                 <tbody>
                   <tr><td>Lavoratore dipendente</td><td>9,19%</td></tr>
                   <tr><td>Oltre massimale (€55.008/anno)</td><td>+1%</td></tr>
                   <tr><td>Datore di lavoro</td><td>~30%</td></tr>
                 </tbody>
               </table>`
            : `<table class="mem-tabela">
                 <thead><tr><th>Faixa (R$)</th><th>Alíquota</th></tr></thead>
                 <tbody>
                   <tr><td>até 1.518,00</td><td>7,5%</td></tr>
                   <tr><td>1.518,01 – 2.793,88</td><td>9%</td></tr>
                   <tr><td>2.793,89 – 4.190,83</td><td>12%</td></tr>
                   <tr><td>4.190,84 – 8.157,41</td><td>14%</td></tr>
                 </tbody>
               </table>`;

        const tabelaIrrf = isIt
            ? `<table class="mem-tabela">
                 <thead><tr><th>Scaglione (€)</th><th>Aliquota</th></tr></thead>
                 <tbody>
                   <tr><td>fino a 28.000</td><td>23%</td></tr>
                   <tr><td>28.001 – 50.000</td><td>35%</td></tr>
                   <tr><td>oltre 50.000</td><td>43%</td></tr>
                 </tbody>
               </table>`
            : `<table class="mem-tabela">
                 <thead><tr><th>Base (R$)</th><th>Alíquota</th><th>Dedução</th></tr></thead>
                 <tbody>
                   <tr><td>até 2.259,20</td><td>isento</td><td>—</td></tr>
                   <tr><td>2.259,21 – 2.826,65</td><td>7,5%</td><td>169,44</td></tr>
                   <tr><td>2.826,66 – 3.751,05</td><td>15%</td><td>381,44</td></tr>
                   <tr><td>3.751,06 – 4.664,68</td><td>22,5%</td><td>662,77</td></tr>
                   <tr><td>acima de 4.664,68</td><td>27,5%</td><td>896,00</td></tr>
                 </tbody>
               </table>`;

        const refs = (m.referencias || []).map(r =>
            `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.texto}</a></li>`
        ).join('');

        const secoes = [
            { titulo: m.introTitulo,    texto: m.introTexto },
            { titulo: m.inssTitulo,     texto: m.inssTexto,    extra: `<p><strong>${m.inssTabela || ''}</strong></p>${tabelaInss}` },
            { titulo: m.irrfTitulo,     texto: m.irrfTexto,    extra: `<p><strong>${m.irrfTabela || ''}</strong></p>${tabelaIrrf}` },
            { titulo: m.fgtsTitulo,     texto: m.fgtsTexto },
            { titulo: m.feriasTitulo,   texto: m.feriasTexto },
            { titulo: m.decimoTitulo,   texto: m.decimoTexto },
            { titulo: m.rescisaoTitulo, texto: m.rescisaoTexto },
            { titulo: m.custoTitulo,    texto: m.custoTexto }
        ];

        const html = secoes
            .filter(s => s.titulo)
            .map(s => `
                <div class="mem-secao">
                    <h3>${s.titulo}</h3>
                    <p>${s.texto || ''}</p>
                    ${s.extra || ''}
                </div>
            `).join('');

        const refHtml = refs ? `
            <div class="mem-secao">
                <h3>${m.referenciasTitulo || '📖 Referências'}</h3>
                <ul class="mem-referencias">${refs}</ul>
            </div>
        ` : '';

        document.getElementById('memorialConteudo').innerHTML = html + refHtml;
        document.getElementById('memorialTitulo').textContent = m.titulo || '';
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new SalarioApp();
        app.inicializar();
    });
} else {
    const app = new SalarioApp();
    app.inicializar();
}
