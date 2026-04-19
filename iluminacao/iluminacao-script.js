/**
 * iluminacao-script.js
 * Calculadora de Iluminação Residencial (LEDs)
 *
 * Calcula iluminação necessária baseado em tamanho, tipo de atividade,
 * cor das paredes, pé direito e luz natural (conforme NBR 5413)
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES E DADOS
// ============================================

// Lux recomendado por tipo de atividade (NBR 5413)
const LUX_RECOMENDADO = {
    sala: 150,
    quarto: 100,
    cozinha: 300,
    banheiro: 200,
    escritorio: 300,
    corredor: 100
};

// Fatores de redução por luz natural disponível
const FATORES_LUZ_NATURAL = {
    muita: 0.5,
    media: 0.65,
    pouca: 0.85,
    nenhuma: 1.0
};

// Fatores de reflexão por cor das paredes
const FATORES_REFLEXAO = {
    clara: 0.8,
    media: 0.5,
    escura: 0.3
};

// Lâmpadas LED disponíveis (watts) — todas LED, 100 lm/W
const TIPOS_LAMPADAS = [6, 9, 12, 15];
const LUMENS_POR_WATT = 100;

// Temperatura de cor recomendada por potência LED
// (associação prática ao uso típico por cômodo, não regra física)
const TEMP_COR_LED = {
    6:  { pt: 'LED 2700K — Branco Quente',  it: 'LED 2700K — Bianco Caldo'   },
    9:  { pt: 'LED 3000K — Branco Quente',  it: 'LED 3000K — Bianco Caldo'   },
    12: { pt: 'LED 4000K — Branco Neutro',  it: 'LED 4000K — Bianco Neutro'  },
    15: { pt: 'LED 6500K — Branco Frio',    it: 'LED 6500K — Bianco Freddo'  }
};

// Horas de funcionamento por dia (média residencial)
const HORAS_FUNCIONAMENTO_DIA = 5;

// Limites do slider de tarifa por idioma (BR em R$/kWh, IT em €/kWh)
const TARIFA_CONFIG = {
    'pt-BR': { min: 0.5,  max: 3.0,  step: 0.01, defaultValue: 1.2,  decimals: 2 },
    'it-IT': { min: 0.10, max: 0.80, step: 0.01, defaultValue: 0.30, decimals: 2 }
};

// Mapa slider → input de texto correspondente
const SLIDER_TO_INPUT = {
    sliderArea:       'inputArea',
    sliderPeDireito:  'inputPeDireito',
    sliderTarifa:     'inputTarifa'
};

// ============================================
// CLASSE PRINCIPAL
// ============================================

class IluminacaoApp extends App {
    constructor() {
        super({
            appName: 'iluminacao',
            callbacks: {
                aoInicializar: () => this.inicializarIluminacao(),
                aoTrocarIdioma: () => {
                    this.aplicarLimitesTarifaPorIdioma();
                    this.atualizarResultado();
                }
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    aplicarLimitesTarifaPorIdioma() {
        const idioma = i18n.obterIdiomaAtual();
        const config = TARIFA_CONFIG[idioma] || TARIFA_CONFIG['pt-BR'];
        const slider = document.getElementById('sliderTarifa');
        const input  = document.getElementById('inputTarifa');
        if (!slider || !input) return;

        const valorAtual = parseFloat(input.value);
        slider.min  = String(config.min);
        slider.max  = String(config.max);
        slider.step = String(config.step);

        const foraDaFaixa = isNaN(valorAtual) || valorAtual < config.min || valorAtual > config.max;
        const novoValor = foraDaFaixa ? config.defaultValue : valorAtual;
        slider.value = String(novoValor);
        input.value  = novoValor.toFixed(config.decimals);
    }

    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarIluminacao() {
        this.configurarEventos();
        this.aplicarLimitesTarifaPorIdioma();
        document.addEventListener('engnata:themechange', () => this.atualizarResultado());
        this.atualizarResultado();
    }

    // ============================================
    // CONFIGURAÇÃO DE EVENTOS
    // ============================================

    configurarEventos() {
        this.configurarIconesInfo();
        this.configurarBotoesIncremento();
        this.configurarSlidersEInputs();

        document.querySelectorAll('input[name="atividade"]').forEach(r =>
            r.addEventListener('change', () => this.atualizarResultado()));
        document.querySelectorAll('input[name="corParedes"]').forEach(r =>
            r.addEventListener('change', () => this.atualizarResultado()));
        document.querySelectorAll('input[name="luzNatural"]').forEach(r =>
            r.addEventListener('change', () => this.atualizarResultado()));

        // Memorial
        document.getElementById('btnMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.getElementById('btnFecharMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.querySelectorAll('.btn-voltar-memorial').forEach(btn =>
            btn.addEventListener('click', () => this.toggleMemorial()));
    }

    toggleMemorial() {
        const memorial   = document.getElementById('memorialSection');
        const resultados = document.getElementById('resultadosSection');
        if (!memorial || !resultados) return;
        const mostrar = memorial.style.display === 'none';
        memorial.style.display   = mostrar ? 'block' : 'none';
        resultados.style.display = mostrar ? 'none'  : 'block';
        if (mostrar) memorial.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    atualizarMemorial(valores, luxRec, lumens, config, consumo) {
        const t = this.traducoes;
        const isIt = i18n.obterIdiomaAtual() === 'it-IT';
        const moeda = isIt ? 'EUR' : 'BRL';
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        const luxBase = LUX_RECOMENDADO[valores.atividade] || 150;
        const fatorLuz = FATORES_LUZ_NATURAL[valores.luzNatural] || 1.0;
        const fatorReflexao = FATORES_REFLEXAO[valores.corParedes] || 0.5;
        const fatorPD = valores.peDireito / 2.7;
        const denom = fatorReflexao * (1 - 0.1 * (fatorPD - 1));

        set('memorial-exemplo-lux',
            `${luxBase} × ${fatorLuz.toFixed(2)} = ${luxRec} lux`);
        set('memorial-exemplo-lumens',
            `(${valores.area} × ${luxRec}) ÷ (${fatorReflexao.toFixed(2)} × ${(1 - 0.1 * (fatorPD - 1)).toFixed(3)}) = ${formatarNumero(lumens, 0)} lm`);
        set('memorial-exemplo-luminarias',
            `⌈${formatarNumero(lumens, 0)} ÷ (${config.wattagem} × 100)⌉ = ${config.quantidade} × ${config.wattagem}W = ${config.potenciaTotal}W`);
        set('memorial-exemplo-custo',
            `${config.potenciaTotal}W × 5h × 30 ÷ 1000 = ${formatarNumero(consumo.consumoMensal, 2)} kWh → ${formatarMoeda(consumo.custoMensal, moeda)}`);

        set('resumo-area',       `${valores.area} m²`);
        set('resumo-atividade',  t?.opcoes?.[valores.atividade] ?? valores.atividade);
        set('resumo-cor',        t?.opcoes?.[valores.corParedes] ?? valores.corParedes);
        set('resumo-pd',         `${valores.peDireito} m`);
        set('resumo-luz',        t?.opcoes?.[valores.luzNatural] ?? valores.luzNatural);
        set('resumo-lux',        `${luxRec} lux`);
        set('resumo-lumens',     `${formatarNumero(lumens, 0)} lm`);
        set('resumo-luminarias', `${config.quantidade} × ${config.wattagem}W (${config.potenciaTotal}W)`);
        set('resumo-consumo',    `${formatarNumero(consumo.consumoMensal, 1)} kWh`);
        set('resumo-custo',      formatarMoeda(consumo.custoMensal, moeda));
    }

    configurarIconesInfo() {
        [
            { iconId: 'infoIconArea',      descricaoId: 'descricaoArea'      },
            { iconId: 'infoIconPeDireito', descricaoId: 'descricaoPeDireito' },
            { iconId: 'infoIconTarifa',    descricaoId: 'descricaoTarifa'    }
        ].forEach(({ iconId, descricaoId }) => {
            const icon = document.getElementById(iconId);
            const desc = document.getElementById(descricaoId);
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

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            const HOLD_DELAY_MS = 180;
            let animationFrame = null;
            let timeoutSegurar = null;
            let tempoInicio = 0;
            let estaSegurando = false;
            let iniciouAnimacaoContinua = false;
            let direcao = 1;

            const animar = (timestamp) => {
                if (!estaSegurando) return;

                const sliderId = btn.getAttribute('data-target');
                const slider = document.getElementById(sliderId);
                const inputId = SLIDER_TO_INPUT[sliderId];
                const inputEl = inputId ? document.getElementById(inputId) : null;
                if (!slider) return;

                const tempoDecorrido = timestamp - tempoInicio;
                const sliderMin = parseFloat(slider.min);
                const sliderMax = parseFloat(slider.max);
                const velocidade = (sliderMax - sliderMin) / 3000;
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
                novoValor = Math.max(sliderMin * 0.5, novoValor);

                slider.value = novoValor;
                if (inputEl) {
                    const decimals = this.decimaisPorSlider(slider);
                    inputEl.value = parseFloat(slider.value).toFixed(decimals);
                }
                this.atualizarResultado();
                animationFrame = requestAnimationFrame(animar);
            };

            const iniciarAnimacao = () => {
                if (animationFrame) return;
                const sliderId = btn.getAttribute('data-target');
                const slider = document.getElementById(sliderId);
                if (!slider) return;
                const stepRaw = parseFloat(btn.getAttribute('data-step')) || 1;
                direcao = stepRaw > 0 ? 1 : -1;
                btn.dataset.valorInicial = parseFloat(slider.value);
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const aplicarIncrementoUnico = () => {
                const sliderId = btn.getAttribute('data-target');
                const slider = document.getElementById(sliderId);
                const inputId = SLIDER_TO_INPUT[sliderId];
                const inputEl = inputId ? document.getElementById(inputId) : null;
                if (!slider) return;
                const passo = parseFloat(btn.getAttribute('data-step') || '0');
                if (!passo) return;

                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const casasDecimais = (String(Math.abs(passo)).split('.')[1] || '').length;
                let novoValor = parseFloat(slider.value) + passo;
                novoValor = Math.max(min, Math.min(max, novoValor));
                novoValor = Number(novoValor.toFixed(Math.max(casasDecimais, 3)));

                slider.value = novoValor;
                if (inputEl) {
                    const decimals = this.decimaisPorSlider(slider);
                    inputEl.value = parseFloat(slider.value).toFixed(decimals);
                }
                this.atualizarResultado();
            };

            const pararPressao = () => {
                estaSegurando = false;
                iniciouAnimacaoContinua = false;
                if (timeoutSegurar) { clearTimeout(timeoutSegurar); timeoutSegurar = null; }
                if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
            };

            const aoPressionar = (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciouAnimacaoContinua = false;
                timeoutSegurar = setTimeout(() => {
                    if (!estaSegurando) return;
                    iniciouAnimacaoContinua = true;
                    iniciarAnimacao();
                }, HOLD_DELAY_MS);
            };

            const aoSoltar = (e) => {
                if (e) e.preventDefault();
                const foiToqueRapido = estaSegurando && !iniciouAnimacaoContinua;
                pararPressao();
                if (foiToqueRapido) aplicarIncrementoUnico();
            };

            btn.addEventListener('mousedown', aoPressionar);
            btn.addEventListener('touchstart', aoPressionar, { passive: false });
            btn.addEventListener('mouseup', aoSoltar);
            btn.addEventListener('mouseleave', pararPressao);
            btn.addEventListener('touchend', aoSoltar);
            btn.addEventListener('touchcancel', pararPressao);
        });
    }

    configurarSlidersEInputs() {
        Object.entries(SLIDER_TO_INPUT).forEach(([sliderId, inputId]) => {
            const slider = document.getElementById(sliderId);
            const input = document.getElementById(inputId);
            if (!slider || !input) return;

            // Slider → Input
            slider.addEventListener('input', () => {
                const decimals = this.decimaisPorSlider(slider);
                input.value = parseFloat(slider.value).toFixed(decimals);
                this.atualizarResultado();
            });

            // Input → Slider
            input.addEventListener('change', () => {
                const valor = parseFloat(input.value.replace(',', '.'));
                if (!isNaN(valor)) {
                    slider.value = valor;
                    const decimals = this.decimaisPorSlider(slider);
                    input.value = parseFloat(slider.value).toFixed(decimals);
                }
                this.atualizarResultado();
            });
        });
    }

    decimaisPorSlider(slider) {
        const step = parseFloat(slider.step) || 1;
        if (step < 1) {
            const parts = String(step).split('.');
            return parts[1]?.length || 1;
        }
        return 0;
    }

    // ============================================
    // LÓGICA DE CÁLCULO
    // ============================================

    obterValoresEntrada() {
        return {
            area:       parseFloat(document.getElementById('inputArea').value) || 20,
            atividade:  document.querySelector('input[name="atividade"]:checked')?.value  || 'sala',
            corParedes: document.querySelector('input[name="corParedes"]:checked')?.value || 'clara',
            peDireito:  parseFloat(document.getElementById('inputPeDireito').value) || 2.7,
            luzNatural: document.querySelector('input[name="luzNatural"]:checked')?.value || 'muita',
            tarifa:     parseFloat(document.getElementById('inputTarifa').value) || 1.2
        };
    }

    calcularLuxRecomendado(atividade, luzNatural) {
        const luxBase  = LUX_RECOMENDADO[atividade] || 150;
        const fatorLuz = FATORES_LUZ_NATURAL[luzNatural] || 1.0;
        return Math.round(luxBase * fatorLuz);
    }

    calcularLumensNecessarios(area, luxRecomendado, corParedes, peDireito) {
        const fatorReflexao = FATORES_REFLEXAO[corParedes] || 0.5;
        const fatorPeDireito = peDireito / 2.7;
        const lumens = (area * luxRecomendado) / (fatorReflexao * (1 - 0.1 * (fatorPeDireito - 1)));
        return Math.round(lumens);
    }

    definirConfiguracaoLuminarias(lumensNecessarios) {
        let melhorConfig = null;
        let menorPotencia = Infinity;

        for (const watt of TIPOS_LAMPADAS) {
            const lumensPorLampada = watt * LUMENS_POR_WATT;
            const quantidade = Math.ceil(lumensNecessarios / lumensPorLampada);

            if (quantidade > 0 && quantidade <= 10) {
                const potenciaTotal = watt * quantidade;
                if (potenciaTotal < menorPotencia) {
                    menorPotencia = potenciaTotal;
                    melhorConfig = {
                        quantidade,
                        wattagem: watt,
                        potenciaTotal,
                        lumensUnitario: lumensPorLampada,
                        lumensReais: lumensPorLampada * quantidade
                    };
                }
            }
        }

        return melhorConfig || { quantidade: 2, wattagem: 9, potenciaTotal: 18, lumensUnitario: 900, lumensReais: 1800 };
    }

    calcularConsumoECusto(potenciaTotal, tarifa) {
        const consumoDiario  = (potenciaTotal * HORAS_FUNCIONAMENTO_DIA) / 1000;
        const consumoMensal  = consumoDiario * 30;
        const custoMensal    = consumoMensal * tarifa;
        const custoAnual     = custoMensal * 12;
        return { consumoDiario, consumoMensal, custoMensal, custoAnual };
    }

    // ============================================
    // ATUALIZAÇÃO DO DOM
    // ============================================

    atualizarResultado() {
        const valores            = this.obterValoresEntrada();
        const luxRecomendado     = this.calcularLuxRecomendado(valores.atividade, valores.luzNatural);
        const lumensNecessarios  = this.calcularLumensNecessarios(
            valores.area, luxRecomendado, valores.corParedes, valores.peDireito
        );
        const configLuminarias   = this.definirConfiguracaoLuminarias(lumensNecessarios);
        const consumoECusto      = this.calcularConsumoECusto(configLuminarias.potenciaTotal, valores.tarifa);

        this.atualizarDOM(luxRecomendado, configLuminarias, consumoECusto);
        this.atualizarMemorial(valores, luxRecomendado, lumensNecessarios, configLuminarias, consumoECusto);
        this.explicacao.renderizar(
            this.gerarExplicacao(valores, luxRecomendado, lumensNecessarios, configLuminarias, consumoECusto)
        );
    }

    atualizarDOM(luxRecomendado, config, consumo) {
        const idioma = i18n.obterIdiomaAtual();
        const moeda  = idioma === 'it-IT' ? 'EUR' : 'BRL';

        document.getElementById('resultadoLux').textContent      = formatarNumero(luxRecomendado, 0);
        document.getElementById('resultadoPotencia').textContent = formatarNumero(config.potenciaTotal, 0);
        document.getElementById('resultadoQuantidade').textContent = config.quantidade;
        document.getElementById('resultadoConsumo').textContent  = formatarNumero(consumo.consumoMensal, 1);
        document.getElementById('resultadoCusto').textContent    = formatarMoeda(consumo.custoMensal, moeda);
        document.getElementById('resultadoCustoAnual').textContent = formatarMoeda(consumo.custoAnual, moeda);

        this.atualizarTabelaLuminarias(config);
    }

    atualizarTabelaLuminarias(config) {
        const corpoTabela = document.getElementById('corpoTabelaLuminarias');
        if (!corpoTabela) return;

        const idioma = i18n.obterIdiomaAtual();
        const isIt   = idioma === 'it-IT';

        const tempCor    = TEMP_COR_LED[config.wattagem] || TEMP_COR_LED[9];
        const tipoLabel  = isIt ? tempCor.it : tempCor.pt;
        const totalLabel = isIt ? 'Totale' : 'Total';

        corpoTabela.innerHTML = `
            <tr>
                <td>${config.quantidade}×</td>
                <td>${config.wattagem}W / ${config.lumensUnitario} lm</td>
                <td>${tipoLabel}</td>
            </tr>
            <tr class="tabela-total-row">
                <td><strong>= ${config.quantidade}×</strong></td>
                <td><strong>${config.potenciaTotal}W / ${config.lumensReais} lm</strong></td>
                <td><em>${totalLabel}</em></td>
            </tr>
        `;
    }

    gerarExplicacao(valores, luxRecomendado, lumensNecessarios, config, consumo) {
        const t      = this.traducoes;
        const idioma = i18n.obterIdiomaAtual();
        const isIt   = idioma === 'it-IT';
        const moeda  = isIt ? 'EUR' : 'BRL';

        const nomeAtividade  = t.opcoes?.[valores.atividade]  || valores.atividade;
        const nomeLuzNatural = t.opcoes?.[valores.luzNatural] || valores.luzNatural;
        const nomeParedes    = t.opcoes?.[valores.corParedes] || valores.corParedes;

        const reducaoPct     = Math.round((1 - FATORES_LUZ_NATURAL[valores.luzNatural]) * 100);
        const reflexaoPct    = Math.round(FATORES_REFLEXAO[valores.corParedes] * 100);

        return {
            linhas: [
                {
                    icone: '💡',
                    titulo: isIt ? 'Lux consigliato (NBR 5413)' : 'Lux recomendado (NBR 5413)',
                    valor: `${luxRecomendado} lux`,
                    descricao: isIt
                        ? `${nomeAtividade}: base ${LUX_RECOMENDADO[valores.atividade]} lux — ridotto del ${reducaoPct}% per luce naturale "${nomeLuzNatural}".`
                        : `${nomeAtividade}: base ${LUX_RECOMENDADO[valores.atividade]} lux — reduzido ${reducaoPct}% pela luz natural "${nomeLuzNatural}".`
                },
                {
                    icone: '🔆',
                    titulo: isIt ? 'Flusso luminoso totale' : 'Lumens totais necessários',
                    valor: `${lumensNecessarios} lm`,
                    descricao: isIt
                        ? `Pareti ${nomeParedes} (riflessione ${reflexaoPct}%), altezza ${valores.peDireito} m, area ${valores.area} m².`
                        : `Paredes ${nomeParedes} (reflexão ${reflexaoPct}%), pé-direito ${valores.peDireito} m, área ${valores.area} m².`
                },
                {
                    icone: '🔌',
                    titulo: isIt ? 'Lampade LED consigliate' : 'Lâmpadas LED recomendadas',
                    valor: `${config.quantidade}× ${config.wattagem}W LED`,
                    descricao: isIt
                        ? `Totale installata: ${config.potenciaTotal} W — ${config.lumensReais} lm prodotti (${LUMENS_POR_WATT} lm/W).`
                        : `Potência instalada: ${config.potenciaTotal} W — ${config.lumensReais} lm produzidos (${LUMENS_POR_WATT} lm/W).`
                },
                {
                    icone: '💰',
                    titulo: isIt ? 'Costo mensile stimato' : 'Custo mensal estimado',
                    valor: formatarMoeda(consumo.custoMensal, moeda),
                    descricao: isIt
                        ? `${consumo.consumoMensal.toFixed(1)} kWh/mese × €${valores.tarifa.toFixed(2)}/kWh (${HORAS_FUNCIONAMENTO_DIA}h/giorno, 30 giorni).`
                        : `${consumo.consumoMensal.toFixed(1)} kWh/mês × R$ ${valores.tarifa.toFixed(2)}/kWh (${HORAS_FUNCIONAMENTO_DIA}h/dia, 30 dias).`
                }
            ],
            destaque: isIt
                ? `${config.quantidade} lampade LED ${config.wattagem}W per un ambiente di ${valores.area} m²`
                : `${config.quantidade} lâmpadas LED de ${config.wattagem}W para ${valores.area} m²`,
            dica: isIt
                ? 'Le lampade LED consumano fino all\'80% meno delle lampadine tradizionali e durano oltre 25.000 ore.'
                : 'Lâmpadas LED consomem até 80% menos que as incandescentes e duram mais de 25.000 horas.',
            norma: 'NBR 5413'
        };
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new IluminacaoApp();
app.inicializar();
