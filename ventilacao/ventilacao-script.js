/**
 * ventilacao-script.js
 * Calculadora de Ventilação Natural
 *
 * Calcula ACH disponível, qualidade da ventilação e área mínima de aberturas
 * conforme ASHRAE 62.1/62.2 e NBR 15575:2021.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES
// ============================================

const SLIDER_TO_INPUT = {
    sliderComp:      'inputComp',
    sliderLarg:      'inputLarg',
    sliderPeDireito: 'inputPeDireito',
    sliderJanelas:   'inputJanelas'
};

// Coeficiente de descarga (janelas convencionais)
const CD = 0.50;

// ACH mínimo recomendado por tipo de ambiente (ASHRAE 62.1/62.2)
const ACH_NECESSARIO = {
    sala:       7,
    dormitorio: 6,
    cozinha:    20,
    banheiro:   10,
    escritorio: 8
};

// Velocidade de referência do vento por clima (m/s)
const VELOCIDADE_VENTO = {
    costeiro:  5.0,
    rural:     4.0,
    suburbano: 2.5,
    urbano:    1.5
};

// Fator de orientação das aberturas em relação ao vento dominante
const FATOR_ORIENTACAO = {
    favoravel:    1.0,
    neutro:       0.6,
    desfavoravel: 0.3
};

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
        this.configurarInputsTexto();

        ['sliderComp', 'sliderLarg', 'sliderPeDireito', 'sliderJanelas'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) slider.addEventListener('input', () => this.atualizarResultado());
        });

        document.querySelectorAll('input[name="tipoAmbiente"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });
        document.querySelectorAll('input[name="clima"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });
        document.querySelectorAll('input[name="orientacao"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });

        document.getElementById('btnMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.getElementById('btnFecharMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });
    }

    configurarIconesInfo() {
        [
            { iconId: 'infoIconComp',      descricaoId: 'descricaoComp' },
            { iconId: 'infoIconLarg',      descricaoId: 'descricaoLarg' },
            { iconId: 'infoIconPeDireito', descricaoId: 'descricaoPeDireito' },
            { iconId: 'infoIconJanelas',   descricaoId: 'descricaoJanelas' }
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
                const inputEl  = document.getElementById(SLIDER_TO_INPUT[sliderId]);
                if (!slider) return;

                const tempoDecorrido = timestamp - tempoInicio;
                const sliderMin = parseFloat(slider.min);
                const sliderMax = parseFloat(slider.max);
                const velocidade = (sliderMax - sliderMin) / 3000;
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
                novoValor = Math.max(parseFloat(slider.min) * 0.5, novoValor);

                slider.value = novoValor;
                if (inputEl) inputEl.value = formatarNumero(novoValor, 1);
                this.atualizarResultado();

                animationFrame = requestAnimationFrame(animar);
            };

            const iniciar = () => {
                if (animationFrame) return;
                const sliderId = btn.getAttribute('data-target');
                const slider   = document.getElementById(sliderId);
                const inputEl  = document.getElementById(SLIDER_TO_INPUT[sliderId]);
                if (!slider) return;
                direcao = parseFloat(btn.getAttribute('data-step')) > 0 ? 1 : -1;
                const valorAtual = inputEl ? this.parsearValor(inputEl.value) : parseFloat(slider.value);
                btn.dataset.valorInicial = isNaN(valorAtual) ? parseFloat(slider.value) : valorAtual;
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const pararIncremento = () => {
                estaSegurando = false;
                if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
                delete btn.dataset.valorInicial;
            };

            btn.addEventListener('mousedown', e => { e.preventDefault(); estaSegurando = true; iniciar(); });
            btn.addEventListener('mouseup', e => { e.preventDefault(); pararIncremento(); });
            btn.addEventListener('mouseleave', () => pararIncremento());
            btn.addEventListener('touchstart', e => { e.preventDefault(); estaSegurando = true; iniciar(); });
            btn.addEventListener('touchend', e => { e.preventDefault(); pararIncremento(); });
            btn.addEventListener('touchcancel', () => pararIncremento());
        });
    }

    configurarInputsTexto() {
        const pares = [
            { inputId: 'inputComp',      sliderId: 'sliderComp' },
            { inputId: 'inputLarg',      sliderId: 'sliderLarg' },
            { inputId: 'inputPeDireito', sliderId: 'sliderPeDireito' },
            { inputId: 'inputJanelas',   sliderId: 'sliderJanelas' }
        ];

        pares.forEach(({ inputId, sliderId }) => {
            const input  = document.getElementById(inputId);
            const slider = document.getElementById(sliderId);
            if (!input || !slider) return;

            input.addEventListener('input', () => {
                const valor = this.parsearValor(input.value);
                if (!isNaN(valor) && valor > 0) {
                    slider.value = valor;
                    this.atualizarResultado();
                }
            });
        });
    }

    parsearValor(texto) {
        const normalizado = texto.toString().trim()
            .replace(/[^\d,.-]/g, '')
            .replace(',', '.');
        return parseFloat(normalizado);
    }

    // ============================================
    // CÁLCULO
    // ============================================

    calcular(comp, larg, peDireito, janelas, tipoAmbiente, clima, orientacao) {
        const volume = comp * larg * peDireito;

        const achNecessario = ACH_NECESSARIO[tipoAmbiente] ?? ACH_NECESSARIO.sala;
        const vVento        = VELOCIDADE_VENTO[clima]      ?? VELOCIDADE_VENTO.suburbano;
        const fOrientacao   = FATOR_ORIENTACAO[orientacao] ?? FATOR_ORIENTACAO.neutro;

        // Vazão disponível (m³/s)
        const q = CD * janelas * vVento * fOrientacao;

        // ACH disponível
        const achDisponivel = volume > 0 ? (q * 3600) / volume : 0;

        // Razão qualidade
        const ratio = achNecessario > 0 ? achDisponivel / achNecessario : 0;

        // Nível de qualidade
        let nivelQualidade;
        if (ratio < 0.5)      nivelQualidade = 'insuficiente';
        else if (ratio < 1.0) nivelQualidade = 'minima';
        else if (ratio < 1.5) nivelQualidade = 'adequada';
        else if (ratio < 2.5) nivelQualidade = 'boa';
        else                  nivelQualidade = 'excelente';

        // Área mínima NBR 15575 (10% do piso)
        const areaMinima = 0.10 * comp * larg;

        // Déficit/excedente
        const diferenca = janelas - areaMinima;

        return {
            volume,
            achNecessario,
            achDisponivel,
            ratio,
            nivelQualidade,
            areaMinima,
            diferenca,
            q,
            vEfetivo: vVento * fOrientacao
        };
    }

    // ============================================
    // ATUALIZAÇÃO DA UI
    // ============================================

    lerValor(inputId, sliderId, defaultVal) {
        const inputEl  = document.getElementById(inputId);
        const sliderEl = document.getElementById(sliderId);
        if (inputEl && document.activeElement === inputEl) {
            const v = this.parsearValor(inputEl.value);
            return (!isNaN(v) && v > 0) ? v : defaultVal;
        }
        return parseFloat(sliderEl?.value ?? defaultVal);
    }

    atualizarResultado() {
        const comp       = this.lerValor('inputComp',      'sliderComp',      5);
        const larg       = this.lerValor('inputLarg',      'sliderLarg',      4);
        const peDireito  = this.lerValor('inputPeDireito', 'sliderPeDireito', 2.7);
        const janelas    = this.lerValor('inputJanelas',   'sliderJanelas',   3);
        const tipoAmbiente = document.querySelector('input[name="tipoAmbiente"]:checked')?.value ?? 'sala';
        const clima        = document.querySelector('input[name="clima"]:checked')?.value         ?? 'suburbano';
        const orientacao   = document.querySelector('input[name="orientacao"]:checked')?.value    ?? 'neutro';

        // Sincroniza inputs de texto
        const ativo = document.activeElement;
        const syncInput = (id, valor, casas) => {
            const el = document.getElementById(id);
            if (el && ativo !== el) el.value = formatarNumero(valor, casas);
        };
        syncInput('inputComp',      comp,      1);
        syncInput('inputLarg',      larg,      1);
        syncInput('inputPeDireito', peDireito, 1);
        syncInput('inputJanelas',   janelas,   1);

        const r = this.calcular(comp, larg, peDireito, janelas, tipoAmbiente, clima, orientacao);
        const t = this.traducoes;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        // ACH disponível
        set('resultadoACH', `${formatarNumero(r.achDisponivel, 1)} trocas/h`);

        // Qualidade com badge colorido
        const labelQualidade = t?.qualidade?.[r.nivelQualidade] ?? r.nivelQualidade;
        const elQualidade = document.getElementById('resultadoQualidade');
        if (elQualidade) {
            elQualidade.textContent = labelQualidade;
            elQualidade.className = `valor-resultado-grande qualidade-${r.nivelQualidade}`;
        }

        // Área mínima
        set('resultadoAreaMinima', `${formatarNumero(r.areaMinima, 2)} m²`);

        // Situação das aberturas
        const isIT = i18n.obterIdiomaAtual() === 'it-IT';
        let situacaoTexto;
        if (r.diferenca >= 0) {
            situacaoTexto = isIT
                ? `✅ +${formatarNumero(r.diferenca, 2)} m² acima do mínimo`
                : `✅ +${formatarNumero(r.diferenca, 2)} m² acima do mínimo`;
        } else {
            situacaoTexto = isIT
                ? `⚠️ ${formatarNumero(Math.abs(r.diferenca), 2)} m² abaixo do mínimo`
                : `⚠️ ${formatarNumero(Math.abs(r.diferenca), 2)} m² abaixo do mínimo`;
        }
        set('resultadoSituacao', situacaoTexto);

        this.atualizarMemorial(comp, larg, peDireito, janelas, tipoAmbiente, clima, orientacao, r);
        this.renderizarExplicacao(comp, larg, janelas, tipoAmbiente, clima, orientacao, r);
    }

    atualizarMemorial(comp, larg, peDireito, janelas, tipoAmbiente, clima, orientacao, r) {
        const t = this.traducoes;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('memorial-exemplo-volume',
            `${formatarNumero(comp, 1)} m × ${formatarNumero(larg, 1)} m × ${formatarNumero(peDireito, 1)} m = ${formatarNumero(r.volume, 1)} m³`
        );

        const nomeAmbiente = t?.opcoes?.[tipoAmbiente] ?? tipoAmbiente;
        set('memorial-exemplo-ach-necessario',
            `${nomeAmbiente} → ${r.achNecessario} trocas/h necessárias`
        );

        const nomeClima = t?.opcoes?.[clima] ?? clima;
        const nomeOrientacao = t?.opcoes?.[orientacao] ?? orientacao;
        const vBase = VELOCIDADE_VENTO[clima] ?? 2.5;
        const fOr   = FATOR_ORIENTACAO[orientacao] ?? 0.6;
        set('memorial-exemplo-vento',
            `${nomeClima} + ${nomeOrientacao} → ${formatarNumero(vBase, 1)} × ${formatarNumero(fOr, 1)} = ${formatarNumero(r.vEfetivo, 2)} m/s efetivo`
        );

        set('memorial-exemplo-vazao',
            `Q = ${formatarNumero(CD, 2)} × ${formatarNumero(janelas, 1)} × ${formatarNumero(vBase, 1)} × ${formatarNumero(fOr, 1)} = ${formatarNumero(r.q, 3)} m³/s`
        );

        set('memorial-exemplo-ach',
            `ACH = ${formatarNumero(r.q, 3)} × 3600 / ${formatarNumero(r.volume, 1)} = ${formatarNumero(r.achDisponivel, 1)} trocas/h`
        );

        set('memorial-exemplo-area-minima',
            `0,10 × ${formatarNumero(comp, 1)} × ${formatarNumero(larg, 1)} = ${formatarNumero(r.areaMinima, 2)} m² mínimos`
        );

        // Resumo
        set('resumo-comp',        `${formatarNumero(comp, 1)} m`);
        set('resumo-larg',        `${formatarNumero(larg, 1)} m`);
        set('resumo-pe-direito',  `${formatarNumero(peDireito, 1)} m`);
        set('resumo-volume',      `${formatarNumero(r.volume, 1)} m³`);
        set('resumo-janelas',     `${formatarNumero(janelas, 1)} m²`);
        set('resumo-ambiente',    t?.opcoes?.[tipoAmbiente] ?? tipoAmbiente);
        set('resumo-clima',       t?.opcoes?.[clima] ?? clima);
        set('resumo-orientacao',  t?.opcoes?.[orientacao] ?? orientacao);
        set('resumo-ach',         `${formatarNumero(r.achDisponivel, 1)} trocas/h`);
        set('resumo-qualidade',   t?.qualidade?.[r.nivelQualidade] ?? r.nivelQualidade);
        set('resumo-area-minima', `${formatarNumero(r.areaMinima, 2)} m²`);
    }

    renderizarExplicacao(comp, larg, janelas, tipoAmbiente, clima, orientacao, r) {
        const t = this.traducoes;
        const isIT = i18n.obterIdiomaAtual() === 'it-IT';

        const nivelEmoji = {
            insuficiente: '🔴',
            minima:       '🟠',
            adequada:     '🟡',
            boa:          '🟢',
            excelente:    '🔵'
        }[r.nivelQualidade] ?? '⚪';

        const labelQualidade = t?.qualidade?.[r.nivelQualidade] ?? r.nivelQualidade;

        const destaque = isIT
            ? `Ambiente di ${formatarNumero(r.volume, 1)} m³: ${formatarNumero(r.achDisponivel, 1)} cambi d'aria/h disponibili — ventilazione ${labelQualidade.toLowerCase()}.`
            : `Ambiente de ${formatarNumero(r.volume, 1)} m³: ${formatarNumero(r.achDisponivel, 1)} trocas/h disponíveis — ventilação ${labelQualidade.toLowerCase()}.`;

        const dicaSituacao = r.diferenca >= 0
            ? (isIT
                ? `Le aperture superano il minimo NBR 15575 di ${formatarNumero(r.diferenca, 2)} m².`
                : `As aberturas superam o mínimo da NBR 15575 em ${formatarNumero(r.diferenca, 2)} m².`)
            : (isIT
                ? `Le aperture sono ${formatarNumero(Math.abs(r.diferenca), 2)} m² sotto il minimo NBR 15575. Aumentare la superficie apribile.`
                : `As aberturas estão ${formatarNumero(Math.abs(r.diferenca), 2)} m² abaixo do mínimo da NBR 15575. Aumente a área abrível.`);

        this.explicacao.renderizar({
            destaque,
            linhas: [
                {
                    icone: '💨',
                    titulo: t?.resultado?.ach ?? 'ACH Disponível',
                    valor: `${formatarNumero(r.achDisponivel, 1)} trocas/h`,
                    descricao: isIT
                        ? `Necessario: ${r.achNecessario} cambi/h — rapporto: ${formatarNumero(r.ratio, 2)}×`
                        : `Necessário: ${r.achNecessario} trocas/h — razão: ${formatarNumero(r.ratio, 2)}×`
                },
                {
                    icone: nivelEmoji,
                    titulo: t?.resultado?.qualidade ?? 'Qualidade',
                    valor: labelQualidade,
                    descricao: isIT
                        ? `Volume ${formatarNumero(r.volume, 1)} m³, Q = ${formatarNumero(r.q, 3)} m³/s, v = ${formatarNumero(r.vEfetivo, 2)} m/s`
                        : `Volume ${formatarNumero(r.volume, 1)} m³, Q = ${formatarNumero(r.q, 3)} m³/s, v = ${formatarNumero(r.vEfetivo, 2)} m/s`
                },
                {
                    icone: '📐',
                    titulo: t?.resultado?.areaMinima ?? 'Área Mínima NBR',
                    valor: `${formatarNumero(r.areaMinima, 2)} m²`,
                    descricao: isIT
                        ? `10% del pavimento (${formatarNumero(comp, 1)} × ${formatarNumero(larg, 1)} m)`
                        : `10% do piso (${formatarNumero(comp, 1)} × ${formatarNumero(larg, 1)} m)`
                },
                {
                    icone: r.diferenca >= 0 ? '✅' : '⚠️',
                    titulo: t?.resultado?.situacao ?? 'Situação',
                    valor: `${formatarNumero(janelas, 1)} m²`,
                    descricao: dicaSituacao
                }
            ],
            dica: isIT
                ? 'Per la ventilazione trasversale, posizionare aperture su pareti opposte per massimizzare il flusso d\'aria.'
                : 'Para ventilação cruzada, posicione aberturas em paredes opostas para maximizar o fluxo de ar.',
            norma: 'NBR 15575:2021 — Desempenho de Edificações Habitacionais | ASHRAE 62.1/62.2'
        });
    }

    // ============================================
    // MEMORIAL TOGGLE
    // ============================================

    toggleMemorial() {
        const memorial   = document.getElementById('memorialSection');
        const resultados = document.getElementById('resultadosSection');
        if (!memorial || !resultados) return;

        const mostrar = memorial.style.display === 'none';
        memorial.style.display   = mostrar ? 'block' : 'none';
        resultados.style.display = mostrar ? 'none'  : 'block';

        if (mostrar) memorial.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new VentilacaoApp();
app.inicializar();
