/**
 * chuva-script.js
 * Calculadora de Captação de Água da Chuva
 *
 * Calcula volume captado, cisterna ideal, risco de overflow e economia
 * conforme NBR 15527:2019.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES
// ============================================

// Mapa slider → input de texto correspondente
const SLIDER_TO_INPUT = {
    sliderArea:    'inputArea',
    sliderChuva:   'inputChuva',
    sliderPessoas: 'inputPessoas'
};

// Coeficiente de aproveitamento do telhado (NBR 15527)
const COEF_APROVEITAMENTO = 0.80;

// Demanda em litros/pessoa/dia por tipo de uso
const DEMANDA_POR_USO = {
    jardim:   6,   // irrigação básica de jardim
    sanitario: 40, // descarga (maior consumidor doméstico)
    limpeza:  20,  // limpeza de piso, lavagem de carro etc.
    completo: 66   // soma dos três (40 + 6 + 20)
};

// Volumes comerciais de cisterna em litros (ordem crescente)
const CISTERNAS_COMERCIAIS = [500, 1000, 2000, 5000, 10000, 15000, 20000];

// Tarifa de referência de água potável (R$/m³) — SABESP média residencial
const TARIFA_AGUA_BRL = 7.50;
const TARIFA_AGUA_EUR = 2.50;

// ============================================
// CLASSE PRINCIPAL
// ============================================

class ChuvaApp extends App {
    constructor() {
        super({
            appName: 'chuva',
            callbacks: {
                aoInicializar: () => this.inicializarChuva(),
                aoTrocarIdioma: () => this.atualizarResultado()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    get traducoes() {
        const idioma = i18n.obterIdiomaAtual();
        return this.config.traducoes[idioma] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarChuva() {
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

        // Sliders
        ['sliderArea', 'sliderChuva', 'sliderPessoas'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) slider.addEventListener('input', () => this.atualizarResultado());
        });

        // Radio buttons de uso
        document.querySelectorAll('input[name="tipoUso"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });

        // Memorial
        document.getElementById('btnMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.getElementById('btnFecharMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });
    }

    configurarIconesInfo() {
        [
            { iconId: 'infoIconArea',    descricaoId: 'descricaoArea' },
            { iconId: 'infoIconChuva',   descricaoId: 'descricaoChuva' },
            { iconId: 'infoIconPessoas', descricaoId: 'descricaoPessoas' }
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
                // Sem clamping: permite valores além dos limites do slider
                let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
                // Mínimo de 1 para evitar valores sem sentido
                novoValor = Math.max(1, novoValor);

                slider.value = novoValor; // slider clipa visualmente ao seu range
                if (inputEl) inputEl.value = Math.round(novoValor);
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
                // Lê valor atual do input (pode estar além do range do slider)
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
            { inputId: 'inputArea',    sliderId: 'sliderArea' },
            { inputId: 'inputChuva',   sliderId: 'sliderChuva' },
            { inputId: 'inputPessoas', sliderId: 'sliderPessoas' }
        ];

        pares.forEach(({ inputId, sliderId }) => {
            const input  = document.getElementById(inputId);
            const slider = document.getElementById(sliderId);
            if (!input || !slider) return;

            input.addEventListener('input', () => {
                const valor = this.parsearValor(input.value);
                if (!isNaN(valor) && valor > 0) {
                    // Slider clipa visualmente ao seu range, mas o cálculo usa o valor real do input
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

    calcular(area, precipitacao, pessoas, tipoUso) {
        // Volume captado por mês (litros)
        const captacao = area * precipitacao * COEF_APROVEITAMENTO;

        // Demanda mensal (litros)
        const litrosPorDia = DEMANDA_POR_USO[tipoUso] ?? DEMANDA_POR_USO.sanitario;
        const demanda = pessoas * litrosPorDia * 30;

        // Cisterna: demanda × 1,20 → arredondar para volume comercial
        const cisternaMinima = demanda * 1.20;
        const cisterna = CISTERNAS_COMERCIAIS.find(v => v >= cisternaMinima) ?? 20000;

        // Risco de overflow
        const overflow = captacao > 0
            ? Math.max(0, ((captacao - demanda) / captacao) * 100)
            : 0;

        // Economia
        const idioma = i18n.obterIdiomaAtual();
        const tarifa = idioma === 'it-IT' ? TARIFA_AGUA_EUR : TARIFA_AGUA_BRL;
        const utilizavel = Math.min(captacao, demanda);
        const economia = utilizavel * 0.001 * tarifa; // converte L → m³

        return { captacao, demanda, cisterna, overflow, economia, tarifa };
    }

    // ============================================
    // ATUALIZAÇÃO DA UI
    // ============================================

    // Lê o valor do input de texto (se em foco) ou do slider, sem clampar
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
        const area         = this.lerValor('inputArea',    'sliderArea',    80);
        const precipitacao = this.lerValor('inputChuva',   'sliderChuva',   100);
        const pessoas      = this.lerValor('inputPessoas', 'sliderPessoas', 3);
        const tipoUso      = document.querySelector('input[name="tipoUso"]:checked')?.value ?? 'sanitario';

        // Sincroniza inputs de texto — só sobrescreve se NÃO estiver em foco
        const ativo = document.activeElement;
        const inputArea    = document.getElementById('inputArea');
        const inputChuva   = document.getElementById('inputChuva');
        const inputPessoas = document.getElementById('inputPessoas');
        if (inputArea    && ativo !== inputArea)    inputArea.value    = formatarNumero(area, 0);
        if (inputChuva   && ativo !== inputChuva)   inputChuva.value   = formatarNumero(precipitacao, 0);
        if (inputPessoas && ativo !== inputPessoas) inputPessoas.value = formatarNumero(pessoas, 0);

        const r = this.calcular(area, precipitacao, pessoas, tipoUso);
        const idioma = i18n.obterIdiomaAtual();
        const moeda  = idioma === 'it-IT' ? 'EUR' : 'BRL';

        // Captação mensal
        const captacaoTexto = r.captacao >= 1000
            ? `${formatarNumero(r.captacao / 1000, 2)} m³`
            : `${formatarNumero(r.captacao, 0)} L`;

        // Cisterna
        const cisternaTexto = r.cisterna >= 1000
            ? `${formatarNumero(r.cisterna / 1000, 0)} m³ (${formatarNumero(r.cisterna, 0)} L)`
            : `${formatarNumero(r.cisterna, 0)} L`;

        // Overflow com badge colorido
        const overflowNivel = r.overflow < 20 ? 'baixo' : r.overflow < 50 ? 'medio' : 'alto';
        const overflowLabel = this.traducoes?.overflow?.[overflowNivel] ?? overflowNivel;
        const overflowTexto = `${formatarNumero(r.overflow, 1)}%`;

        // Economia
        const economiaTexto = formatarMoeda(r.economia, moeda);

        // Atualizar DOM
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('resultadoCaptacao', captacaoTexto);
        set('resultadoCisterna', cisternaTexto);
        set('resultadoOverflow', `${overflowTexto} — ${overflowLabel}`);
        set('resultadoEconomia', economiaTexto);

        // Colorir risco de overflow
        const elOverflow = document.getElementById('resultadoOverflow');
        if (elOverflow) {
            elOverflow.className = `valor-resultado overflow-${overflowNivel}`;
        }

        // Atualizar memorial
        this.atualizarMemorial(area, precipitacao, pessoas, tipoUso, r, moeda);

        // Painel V2
        this.renderizarExplicacao(area, precipitacao, r, moeda);
    }

    atualizarMemorial(area, precipitacao, pessoas, tipoUso, r, moeda) {
        const t = this.traducoes;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('memorial-exemplo-captacao',
            `${formatarNumero(area, 0)} m² × ${formatarNumero(precipitacao, 0)} mm × 0,80 = ${formatarNumero(r.captacao, 0)} L/mês`
        );

        const litrosDia = DEMANDA_POR_USO[tipoUso] ?? 40;
        const nomeUso = t?.uso?.[tipoUso] ?? tipoUso;
        set('memorial-exemplo-demanda',
            `${pessoas} pessoas × ${litrosDia} L/dia × 30 dias (${nomeUso}) = ${formatarNumero(r.demanda, 0)} L/mês`
        );

        set('memorial-exemplo-cisterna',
            `${formatarNumero(r.demanda, 0)} × 1,20 = ${formatarNumero(r.demanda * 1.20, 0)} L → cisterna de ${formatarNumero(r.cisterna, 0)} L`
        );

        set('memorial-exemplo-overflow',
            `${formatarNumero(r.captacao, 0)} − ${formatarNumero(r.demanda, 0)} = ${formatarNumero(r.captacao - r.demanda, 0)} L excesso → ${formatarNumero(r.overflow, 1)}%`
        );

        set('memorial-exemplo-economia',
            `mín(${formatarNumero(r.captacao, 0)}, ${formatarNumero(r.demanda, 0)}) = ${formatarNumero(Math.min(r.captacao, r.demanda), 0)} L × ${formatarNumero(r.tarifa, 2)}/m³ = ${formatarMoeda(r.economia, moeda)}`
        );

        // Resumo
        set('resumo-area',     `${formatarNumero(area, 0)} m²`);
        set('resumo-chuva',    `${formatarNumero(precipitacao, 0)} mm/mês`);
        set('resumo-pessoas',  `${pessoas}`);
        set('resumo-uso',      t?.uso?.[tipoUso] ?? tipoUso);
        set('resumo-captacao', `${formatarNumero(r.captacao, 0)} L/mês`);
        set('resumo-cisterna', `${formatarNumero(r.cisterna, 0)} L`);
        set('resumo-overflow', `${formatarNumero(r.overflow, 1)}%`);
        set('resumo-economia', formatarMoeda(r.economia, moeda));
    }

    renderizarExplicacao(area, precipitacao, r, moeda) {
        const t = this.traducoes;
        const idioma = i18n.obterIdiomaAtual();
        const isIT = idioma === 'it-IT';

        const captacaoStr = r.captacao >= 1000
            ? `${formatarNumero(r.captacao / 1000, 2)} m³`
            : `${formatarNumero(r.captacao, 0)} L`;

        const overflowNivel = r.overflow < 20 ? 'baixo' : r.overflow < 50 ? 'medio' : 'alto';
        const overflowEmoji = overflowNivel === 'baixo' ? '🟢' : overflowNivel === 'medio' ? '🟡' : '🔴';

        const destaque = isIT
            ? `Con ${formatarNumero(area, 0)} m² di tetto e ${formatarNumero(precipitacao, 0)} mm/mese di pioggia, si raccolgono ${captacaoStr} al mese.`
            : `Com ${formatarNumero(area, 0)} m² de telhado e ${formatarNumero(precipitacao, 0)} mm de chuva/mês, você capta ${captacaoStr}.`;

        const dica = isIT
            ? 'Filtrare l\'acqua prima dello stoccaggio. Le prime piogge devono essere scartate (autosvuotamento).'
            : 'Filtre a água antes de armazenar. As primeiras chuvas devem ser descartadas (dispositivo de autolimpeza).';

        this.explicacao.renderizar({
            destaque,
            linhas: [
                {
                    icone: '💧',
                    titulo: t?.resultado?.captacao ?? 'Captação Mensal',
                    valor: captacaoStr,
                    descricao: isIT
                        ? `Area ${formatarNumero(area, 0)} m² × ${formatarNumero(precipitacao, 0)} mm × 0,80 (coeff. utilizzo)`
                        : `Área ${formatarNumero(area, 0)} m² × ${formatarNumero(precipitacao, 0)} mm × 0,80 (coef. aproveitamento)`
                },
                {
                    icone: '🏺',
                    titulo: t?.resultado?.cisterna ?? 'Cisterna Recomendada',
                    valor: `${formatarNumero(r.cisterna, 0)} L`,
                    descricao: isIT
                        ? `Domanda mensile ${formatarNumero(r.demanda, 0)} L × 1,20 di margine di sicurezza`
                        : `Demanda mensal ${formatarNumero(r.demanda, 0)} L × 1,20 de margem de segurança`
                },
                {
                    icone: overflowEmoji,
                    titulo: t?.resultado?.overflow ?? 'Risco de Overflow',
                    valor: `${formatarNumero(r.overflow, 1)}%`,
                    descricao: isIT
                        ? r.overflow > 0
                            ? `${formatarNumero(r.captacao - r.demanda, 0)} L/mese in eccesso — considerare cisterna più grande o uso aggiuntivo`
                            : 'La domanda supera la raccolta — nessun overflow previsto'
                        : r.overflow > 0
                            ? `${formatarNumero(r.captacao - r.demanda, 0)} L/mês em excesso — considere cisterna maior ou uso adicional`
                            : 'Demanda supera captação — sem risco de overflow'
                },
                {
                    icone: '💰',
                    titulo: t?.resultado?.economia ?? 'Economia/mês',
                    valor: formatarMoeda(r.economia, moeda),
                    descricao: isIT
                        ? `${formatarNumero(Math.min(r.captacao, r.demanda), 0)} L utilizzati × tariffa ${formatarNumero(r.tarifa, 2)}/m³`
                        : `${formatarNumero(Math.min(r.captacao, r.demanda), 0)} L aproveitados × tarifa R$ ${formatarNumero(r.tarifa, 2)}/m³`
                }
            ],
            dica,
            norma: 'NBR 15527:2019 — Aproveitamento de Água de Chuva em Coberturas para Fins Não Potáveis'
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

const app = new ChuvaApp();
app.inicializar();
