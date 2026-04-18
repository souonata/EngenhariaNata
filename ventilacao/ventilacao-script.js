/**
 * ventilacao-script.js
 * Calculadora de Ventilação Natural Residencial
 *
 * Calcula renovações de ar por hora (ACH), qualidade da ventilação
 * e área mínima de janelas conforme NBR 15575.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES
// ============================================

const SLIDER_TO_INPUT = {
    sliderComprimento: 'inputComprimento',
    sliderLargura:     'inputLargura',
    sliderPeDireito:   'inputPeDireito',
    sliderJanelas:     'inputJanelas',
    sliderPessoas:     'inputPessoas'
};

// Velocidade típica do vento por clima (m/s)
const VEL_VENTO = {
    quente:    2.5,
    temperado: 2.0,
    frio:      1.5
};

// Fator de eficiência por orientação (relativo aos ventos predominantes no Brasil)
// Sul e Leste recebem ventos mais favoráveis; Norte e Oeste são menos favorecidos
const FATOR_ORIENTACAO = {
    norte:  0.80,
    sul:    1.00,
    leste:  0.90,
    oeste:  0.70
};

// Coeficiente de descarga de janelas comuns (Cd)
const CD = 0.60;

// ACH mínimo residencial (ASHRAE 62.2 / NBR 15575)
const ACH_MIN_RESIDENCIAL = 6;

// Vazão de ar fresco por pessoa (m³/h) — ASHRAE 62.1
const VAZAO_POR_PESSOA = 27; // 7,5 L/s × 3,6

// Fração mínima da área do piso para ventilação — NBR 15575
const FRACAO_AREA_MINIMA = 1 / 8; // 12,5%

// ============================================
// CLASSE PRINCIPAL
// ============================================

class VentilacaoApp extends App {
    constructor() {
        super({
            appName: 'ventilacao',
            callbacks: {
                aoInicializar: () => this.inicializarVentilacao(),
                aoTrocarIdioma: () => this.atualizarResultado()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    get traducoes() {
        const idioma = i18n.obterIdiomaAtual();
        return this.config.traducoes[idioma] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarVentilacao() {
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

        document.querySelectorAll('input[name="orientacao"]').forEach(r =>
            r.addEventListener('change', () => this.atualizarResultado()));
        document.querySelectorAll('input[name="clima"]').forEach(r =>
            r.addEventListener('change', () => this.atualizarResultado()));
    }

    configurarIconesInfo() {
        [
            { iconId: 'infoIconComprimento', descricaoId: 'descricaoComprimento' },
            { iconId: 'infoIconLargura',     descricaoId: 'descricaoLargura'     },
            { iconId: 'infoIconPeDireito',   descricaoId: 'descricaoPeDireito'   },
            { iconId: 'infoIconJanelas',     descricaoId: 'descricaoJanelas'     },
            { iconId: 'infoIconPessoas',     descricaoId: 'descricaoPessoas'     }
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

            const iniciarPressao = (e) => {
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

            const pararPressao = () => {
                estaSegurando = false;
                if (animationFrame) cancelAnimationFrame(animationFrame);
            };

            btn.addEventListener('mousedown',   iniciarPressao);
            btn.addEventListener('touchstart',  iniciarPressao, { passive: false });
            btn.addEventListener('mouseup',     pararPressao);
            btn.addEventListener('mouseleave',  pararPressao);
            btn.addEventListener('touchend',    pararPressao);
            btn.addEventListener('touchcancel', pararPressao);
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
                const valor = parseFloat(input.value.replace(',', '.'));
                if (!isNaN(valor)) {
                    slider.value = valor;
                    input.value  = parseFloat(slider.value).toFixed(this.decimaisPorSlider(slider));
                }
                this.atualizarResultado();
            });
        });
    }

    decimaisPorSlider(slider) {
        const step = parseFloat(slider.step) || 1;
        if (step < 1) {
            return String(step).split('.')[1]?.length || 1;
        }
        return 0;
    }

    // ============================================
    // CÁLCULO
    // ============================================

    obterValores() {
        return {
            comprimento: parseFloat(document.getElementById('inputComprimento').value) || 5,
            largura:     parseFloat(document.getElementById('inputLargura').value)     || 4,
            peDireito:   parseFloat(document.getElementById('inputPeDireito').value)   || 2.7,
            janelas:     parseFloat(document.getElementById('inputJanelas').value)     || 2,
            pessoas:     parseInt(document.getElementById('inputPessoas').value)       || 2,
            orientacao:  document.querySelector('input[name="orientacao"]:checked')?.value || 'sul',
            clima:       document.querySelector('input[name="clima"]:checked')?.value  || 'quente'
        };
    }

    calcular(v) {
        const areaPiso  = v.comprimento * v.largura;           // m²
        const volume    = areaPiso * v.peDireito;              // m³
        const areaMinima = areaPiso * FRACAO_AREA_MINIMA;      // NBR 15575

        const velVento  = VEL_VENTO[v.clima]          || 2.0;
        const fatorOri  = FATOR_ORIENTACAO[v.orientacao] || 0.85;

        // Vazão pelo método da abertura (Bernoulli simplificado)
        const vazao = v.janelas * velVento * fatorOri * CD * 3600; // m³/h

        // ACH real
        const ach = vazao / volume;

        // ACH mínimo: maior entre o padrão residencial e o necessário por pessoa
        const achPorPessoas = (v.pessoas * VAZAO_POR_PESSOA) / volume;
        const achNecessario = Math.max(ACH_MIN_RESIDENCIAL, achPorPessoas);

        // Qualidade
        let qualidadeKey;
        if (ach >= achNecessario * 1.5) {
            qualidadeKey = 'excelente';
        } else if (ach >= achNecessario) {
            qualidadeKey = 'boa';
        } else if (ach >= achNecessario * 0.5) {
            qualidadeKey = 'aceitavel';
        } else {
            qualidadeKey = 'insuficiente';
        }

        // Déficit/excedente de janelas
        const deficitJanelas = areaMinima - v.janelas; // positivo = falta, negativo = sobra

        return { areaPiso, volume, areaMinima, velVento, fatorOri, vazao, ach, achNecessario, qualidadeKey, deficitJanelas };
    }

    // ============================================
    // DOM
    // ============================================

    atualizarResultado() {
        const v   = this.obterValores();
        const res = this.calcular(v);

        this.atualizarDOM(v, res);
        this.explicacao.renderizar(this.gerarExplicacao(v, res));
    }

    atualizarDOM(v, res) {
        const t    = this.traducoes;
        const isIt = i18n.obterIdiomaAtual() === 'it-IT';

        // ACH
        document.getElementById('resultadoACH').textContent =
            formatarNumero(res.ach, 1) + ' ACH';

        // Qualidade — badge com cor semafórica
        const qualLabel = t.qualidade?.[res.qualidadeKey] || res.qualidadeKey;
        const achEl = document.getElementById('resultadoQualidade');
        achEl.innerHTML = `<span class="qualidade-badge qualidade-${res.qualidadeKey}">${qualLabel}</span>`;

        // Volume
        document.getElementById('resultadoVolume').textContent =
            formatarNumero(res.volume, 1) + ' m³';

        // Vazão
        document.getElementById('resultadoVazao').textContent =
            formatarNumero(res.vazao, 0) + ' m³/h';

        // Área mínima NBR 15575
        document.getElementById('resultadoAreaMinima').textContent =
            formatarNumero(res.areaMinima, 2) + ' m²  (1/8 × ' + formatarNumero(res.areaPiso, 1) + ' m²)';

        // Status das janelas
        const statusEl = document.getElementById('resultadoStatusJanelas');
        if (res.deficitJanelas > 0) {
            const falta = isIt ? 'Mancano' : 'Faltam';
            statusEl.innerHTML = `<span class="status-badge status-falta">⚠️ ${falta} ${formatarNumero(res.deficitJanelas, 2)} m²</span>`;
        } else {
            const ok = isIt ? 'OK — excedente' : 'OK — excedente';
            statusEl.innerHTML = `<span class="status-badge status-ok">✅ ${ok} ${formatarNumero(-res.deficitJanelas, 2)} m²</span>`;
        }
    }

    gerarExplicacao(v, res) {
        const t    = this.traducoes;
        const isIt = i18n.obterIdiomaAtual() === 'it-IT';

        const nomeClima      = t.opcoes?.[v.clima]      || v.clima;
        const nomeOrientacao = t.opcoes?.[v.orientacao] || v.orientacao;
        const qualLabel      = t.qualidade?.[res.qualidadeKey] || res.qualidadeKey;

        return {
            linhas: [
                {
                    icone: '📐',
                    titulo: isIt ? 'Volume dell\'ambiente' : 'Volume do ambiente',
                    valor: `${formatarNumero(res.volume, 1)} m³`,
                    descricao: isIt
                        ? `${v.comprimento} m × ${v.largura} m × ${v.peDireito} m = ${formatarNumero(res.volume, 1)} m³`
                        : `${v.comprimento} m × ${v.largura} m × ${v.peDireito} m = ${formatarNumero(res.volume, 1)} m³`
                },
                {
                    icone: '💨',
                    titulo: isIt ? 'Portata d\'aria' : 'Vazão de ar',
                    valor: `${formatarNumero(res.vazao, 0)} m³/h`,
                    descricao: isIt
                        ? `Vento ${nomeClima} (${res.velVento} m/s), orientação ${nomeOrientacao} (fator ${res.fatorOri}), Cd=${CD}. Fórmula: A × v × fator × Cd × 3600.`
                        : `Vento ${nomeClima} (${res.velVento} m/s), orientação ${nomeOrientacao} (fator ${res.fatorOri}), Cd=${CD}. Fórmula: A × v × fator × Cd × 3600.`
                },
                {
                    icone: '🔄',
                    titulo: isIt ? 'Ricambi d\'aria (ACH)' : 'Renovações de ar (ACH)',
                    valor: `${formatarNumero(res.ach, 1)} ACH`,
                    descricao: isIt
                        ? `Minimo necessario: ${formatarNumero(res.achNecessario, 1)} ACH (maggiore tra residenziale ${ACH_MIN_RESIDENCIAL} e per persone ${formatarNumero((v.pessoas * VAZAO_POR_PESSOA) / res.volume, 1)}).`
                        : `Mínimo necessário: ${formatarNumero(res.achNecessario, 1)} ACH (maior entre residencial ${ACH_MIN_RESIDENCIAL} e por pessoas ${formatarNumero((v.pessoas * VAZAO_POR_PESSOA) / res.volume, 1)}).`
                },
                {
                    icone: '🪟',
                    titulo: isIt ? 'Superficie minima finestre (NBR 15575)' : 'Área mínima de janelas (NBR 15575)',
                    valor: `${formatarNumero(res.areaMinima, 2)} m²`,
                    descricao: isIt
                        ? `1/8 dell'area del pavimento (${formatarNumero(res.areaPiso, 1)} m²). Attuale: ${v.janelas} m² — ${res.deficitJanelas > 0 ? 'insufficiente' : 'conforme'}.`
                        : `1/8 da área do piso (${formatarNumero(res.areaPiso, 1)} m²). Atual: ${v.janelas} m² — ${res.deficitJanelas > 0 ? 'insuficiente' : 'conforme'}.`
                }
            ],
            destaque: isIt
                ? `Qualità ventilazione: ${qualLabel} — ${formatarNumero(res.ach, 1)} ACH`
                : `Qualidade da ventilação: ${qualLabel} — ${formatarNumero(res.ach, 1)} ACH`,
            dica: isIt
                ? 'La ventilazione incrociata (finestre su pareti opposte) può raddoppiare l\'efficacia della ventilazione naturale.'
                : 'A ventilação cruzada (janelas em paredes opostas) pode dobrar a eficácia da ventilação natural.',
            norma: 'NBR 15575'
        };
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new VentilacaoApp();
app.inicializar();
