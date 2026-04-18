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
                aoTrocarIdioma: () => this.atualizarResultado()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarIluminacao() {
        this.configurarEventos();
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
            let animationFrame = null;
            let tempoInicio = 0;
            let estaSegurando = false;
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

            const iniciarPressao = (e) => {
                e.preventDefault();
                const sliderId = btn.getAttribute('data-target');
                const slider = document.getElementById(sliderId);
                if (!slider) return;
                const stepRaw = parseFloat(btn.getAttribute('data-step')) || 1;
                direcao = stepRaw > 0 ? 1 : -1;
                estaSegurando = true;
                btn.dataset.valorInicial = parseFloat(slider.value);
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const pararPressao = () => {
                estaSegurando = false;
                if (animationFrame) cancelAnimationFrame(animationFrame);
            };

            btn.addEventListener('mousedown', iniciarPressao);
            btn.addEventListener('touchstart', iniciarPressao, { passive: false });
            btn.addEventListener('mouseup', pararPressao);
            btn.addEventListener('mouseleave', pararPressao);
            btn.addEventListener('touchend', pararPressao);
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
                        ? `${consumo.consumoMensal.toFixed(1)} kWh/mese × ${valores.tarifa.toFixed(2)} R$/kWh (${HORAS_FUNCIONAMENTO_DIA}h/giorno, 30 giorni).`
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
