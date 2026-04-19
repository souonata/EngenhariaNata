/**
 * bombaagua-script.js
 * Calculadora educativa de bomba d'agua
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

const SLIDER_TO_INPUT = {
    sliderAltura: 'inputAltura',
    sliderComprimento: 'inputComprimento',
    sliderVazao: 'inputVazao',
    sliderDiametro: 'inputDiametro'
};

const G = 9.80665;
const DENSIDADE_AGUA = 1000;
const VISCOSIDADE_CINEMATICA = 1.004e-6;
const RUGOSIDADE_PVC = 1.5e-6;
const EFICIENCIA_BOMBA = 0.55;
const PERDAS_ACESSORIOS = 0.15;
const RESERVA_COMERCIAL = 1.15;
const KW_POR_CV = 0.7355;
const FAIXAS_CV = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10];

class BombaAguaApp extends App {
    constructor() {
        super({
            appName: 'bombaagua',
            callbacks: {
                aoInicializar: () => this.inicializarBombaAgua(),
                aoTrocarIdioma: () => this.atualizarResultado()
            }
        });

        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    get traducoes() {
        const idioma = i18n.obterIdiomaAtual();
        return this.config.traducoes[idioma] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarBombaAgua() {
        this.configurarEventos();
        document.addEventListener('engnata:themechange', () => this.atualizarResultado());
        this.atualizarResultado();
    }

    configurarEventos() {
        this.configurarIconesInfo();
        this.configurarBotoesIncremento();
        this.configurarInputsTexto();

        Object.keys(SLIDER_TO_INPUT).forEach((id) => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => this.atualizarResultado());
            }
        });

        document.getElementById('btnMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.getElementById('btnFecharMemorial')?.addEventListener('click', () => this.toggleMemorial());
        document.querySelectorAll('.btn-voltar-memorial').forEach((btn) => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });
    }

    configurarIconesInfo() {
        [
            { iconId: 'infoIconAltura', descricaoId: 'descricaoAltura' },
            { iconId: 'infoIconComprimento', descricaoId: 'descricaoComprimento' },
            { iconId: 'infoIconVazao', descricaoId: 'descricaoVazao' },
            { iconId: 'infoIconDiametro', descricaoId: 'descricaoDiametro' }
        ].forEach(({ iconId, descricaoId }) => {
            const icon = document.getElementById(iconId);
            const desc = document.getElementById(descricaoId);
            if (!icon || !desc) return;

            const toggle = () => {
                desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
            };

            icon.addEventListener('click', toggle);
            icon.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggle();
                }
            });
        });
    }

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach((btn) => {
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
                const inputEl = document.getElementById(SLIDER_TO_INPUT[sliderId]);
                if (!slider) return;

                const tempoDecorrido = timestamp - tempoInicio;
                const sliderMin = parseFloat(slider.min);
                const sliderMax = parseFloat(slider.max);
                const velocidade = (sliderMax - sliderMin) / 3000;
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
                novoValor = Math.max(sliderMin, Math.min(sliderMax, novoValor));

                slider.value = novoValor;
                if (inputEl) {
                    inputEl.value = this.formatarValorCampo(sliderId, novoValor);
                }

                this.atualizarResultado();
                animationFrame = requestAnimationFrame(animar);
            };

            const iniciarAnimacao = () => {
                if (animationFrame) return;
                const sliderId = btn.getAttribute('data-target');
                const slider = document.getElementById(sliderId);
                const inputEl = document.getElementById(SLIDER_TO_INPUT[sliderId]);
                if (!slider) return;

                direcao = parseFloat(btn.getAttribute('data-step')) > 0 ? 1 : -1;
                const valorAtual = inputEl ? this.parsearValor(inputEl.value) : parseFloat(slider.value);
                btn.dataset.valorInicial = isNaN(valorAtual) ? parseFloat(slider.value) : valorAtual;
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };

            const aplicarIncrementoUnico = () => {
                const sliderId = btn.getAttribute('data-target');
                const slider = document.getElementById(sliderId);
                const inputEl = document.getElementById(SLIDER_TO_INPUT[sliderId]);
                if (!slider) return;
                const passo = parseFloat(btn.getAttribute('data-step') || '0');
                if (!passo) return;

                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const valorBase = inputEl ? this.parsearValor(inputEl.value) : parseFloat(slider.value);
                const valorAtual = isNaN(valorBase) ? parseFloat(slider.value) : valorBase;
                const casasDecimais = (String(Math.abs(passo)).split('.')[1] || '').length;
                let novoValor = valorAtual + passo;
                novoValor = Math.max(min, Math.min(max, novoValor));
                novoValor = Number(novoValor.toFixed(Math.max(casasDecimais, 3)));

                slider.value = novoValor;
                if (inputEl) inputEl.value = this.formatarValorCampo(sliderId, novoValor);
                this.atualizarResultado();
            };

            const parar = () => {
                estaSegurando = false;
                iniciouAnimacaoContinua = false;
                if (timeoutSegurar) { clearTimeout(timeoutSegurar); timeoutSegurar = null; }
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                delete btn.dataset.valorInicial;
            };

            const aoPressionar = (event) => {
                event.preventDefault();
                estaSegurando = true;
                iniciouAnimacaoContinua = false;
                timeoutSegurar = setTimeout(() => {
                    if (!estaSegurando) return;
                    iniciouAnimacaoContinua = true;
                    iniciarAnimacao();
                }, HOLD_DELAY_MS);
            };

            const aoSoltar = (event) => {
                if (event) event.preventDefault();
                const foiToqueRapido = estaSegurando && !iniciouAnimacaoContinua;
                parar();
                if (foiToqueRapido) aplicarIncrementoUnico();
            };

            btn.addEventListener('mousedown', aoPressionar);
            btn.addEventListener('mouseup', aoSoltar);
            btn.addEventListener('mouseleave', parar);
            btn.addEventListener('touchstart', aoPressionar);
            btn.addEventListener('touchend', aoSoltar);
            btn.addEventListener('touchcancel', parar);
        });
    }

    configurarInputsTexto() {
        [
            { inputId: 'inputAltura', sliderId: 'sliderAltura' },
            { inputId: 'inputComprimento', sliderId: 'sliderComprimento' },
            { inputId: 'inputVazao', sliderId: 'sliderVazao' },
            { inputId: 'inputDiametro', sliderId: 'sliderDiametro' }
        ].forEach(({ inputId, sliderId }) => {
            const input = document.getElementById(inputId);
            const slider = document.getElementById(sliderId);
            if (!input || !slider) return;

            input.addEventListener('input', () => {
                const valor = this.parsearValor(input.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                if (!isNaN(valor) && valor >= min && valor <= max) {
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

    formatarValorCampo(sliderId, valor) {
        if (sliderId === 'sliderAltura') {
            return formatarNumero(valor, 1);
        }
        return formatarNumero(valor, 0);
    }

    lerValor(inputId, sliderId, defaultVal) {
        const inputEl = document.getElementById(inputId);
        const sliderEl = document.getElementById(sliderId);
        if (inputEl && document.activeElement === inputEl) {
            const valor = this.parsearValor(inputEl.value);
            return !isNaN(valor) ? valor : defaultVal;
        }
        return parseFloat(sliderEl?.value ?? defaultVal);
    }

    calcularFatorAtrito(reynolds, diametroM) {
        if (!isFinite(reynolds) || reynolds <= 0) return 0;
        if (reynolds < 2300) {
            return 64 / reynolds;
        }

        const termoA = RUGOSIDADE_PVC / (3.7 * diametroM);
        const termoB = 5.74 / Math.pow(reynolds, 0.9);
        const denominador = Math.log10(termoA + termoB);
        return 0.25 / Math.pow(denominador, 2);
    }

    selecionarFaixaBomba(potenciaKw) {
        const alvoKw = potenciaKw * RESERVA_COMERCIAL;
        let indice = FAIXAS_CV.findIndex((cv) => cv * KW_POR_CV >= alvoKw);
        if (indice === -1) {
            indice = FAIXAS_CV.length - 1;
        }

        const cvMin = FAIXAS_CV[indice];
        const cvMax = FAIXAS_CV[Math.min(indice + 1, FAIXAS_CV.length - 1)];
        const faixa = cvMin === cvMax
            ? `${formatarNumero(cvMin, cvMin < 1 ? 2 : 1)} CV`
            : `${formatarNumero(cvMin, cvMin < 1 ? 2 : 1)} a ${formatarNumero(cvMax, cvMax < 1 ? 2 : 1)} CV`;

        return { alvoKw, cvMin, cvMax, faixa };
    }

    determinarTipoBomba(alturaTotal, vazaoLmin) {
        const pt = i18n.obterIdiomaAtual() !== 'it-IT';

        if (alturaTotal <= 20 && vazaoLmin <= 80) {
            return pt ? 'centrifuga residencial' : 'centrifuga residenziale';
        }

        if (alturaTotal <= 45) {
            return pt ? 'periferica ou centrifuga de maior pressao' : 'periferica o centrifuga ad alta prevalenza';
        }

        return pt ? 'multistagio / booster' : 'multistadio / booster';
    }

    calcular(altura, comprimento, vazaoLmin, diametroMm) {
        const vazaoM3s = vazaoLmin / 60000;
        const diametroM = diametroMm / 1000;
        const areaTubo = Math.PI * Math.pow(diametroM, 2) / 4;
        const velocidade = areaTubo > 0 ? vazaoM3s / areaTubo : 0;
        const reynolds = diametroM > 0 ? (velocidade * diametroM) / VISCOSIDADE_CINEMATICA : 0;
        const fatorAtrito = this.calcularFatorAtrito(reynolds, diametroM);
        const perdaLinear = fatorAtrito * (comprimento / diametroM) * (Math.pow(velocidade, 2) / (2 * G));
        const perdaAcessorios = perdaLinear * PERDAS_ACESSORIOS;
        const perdasTotais = perdaLinear + perdaAcessorios;
        const alturaTotal = altura + perdasTotais;
        const pressaoPerdasKpa = DENSIDADE_AGUA * G * perdasTotais / 1000;
        const pressaoTotalKpa = DENSIDADE_AGUA * G * alturaTotal / 1000;
        const potenciaHidraulicaW = DENSIDADE_AGUA * G * vazaoM3s * alturaTotal;
        const potenciaBombaKw = (potenciaHidraulicaW / EFICIENCIA_BOMBA) / 1000;
        const potenciaCv = potenciaBombaKw / KW_POR_CV;
        const consumoHora = potenciaBombaKw;
        const faixaBomba = this.selecionarFaixaBomba(potenciaBombaKw);
        const tipoBomba = this.determinarTipoBomba(alturaTotal, vazaoLmin);

        return {
            altura,
            comprimento,
            vazaoLmin,
            vazaoM3s,
            diametroMm,
            diametroM,
            areaTubo,
            velocidade,
            reynolds,
            fatorAtrito,
            perdaLinear,
            perdaAcessorios,
            perdasTotais,
            alturaTotal,
            pressaoPerdasKpa,
            pressaoTotalKpa,
            potenciaHidraulicaW,
            potenciaBombaKw,
            potenciaCv,
            consumoHora,
            faixaBomba,
            tipoBomba
        };
    }

    atualizarResultado() {
        const altura = this.lerValor('inputAltura', 'sliderAltura', 12);
        const comprimento = this.lerValor('inputComprimento', 'sliderComprimento', 35);
        const vazao = this.lerValor('inputVazao', 'sliderVazao', 35);
        const diametro = this.lerValor('inputDiametro', 'sliderDiametro', 25);

        const campos = [
            { inputId: 'inputAltura', valor: formatarNumero(altura, 1) },
            { inputId: 'inputComprimento', valor: formatarNumero(comprimento, 0) },
            { inputId: 'inputVazao', valor: formatarNumero(vazao, 0) },
            { inputId: 'inputDiametro', valor: formatarNumero(diametro, 0) }
        ];

        campos.forEach(({ inputId, valor }) => {
            const input = document.getElementById(inputId);
            if (input && document.activeElement !== input) {
                input.value = valor;
            }
        });

        const r = this.calcular(altura, comprimento, vazao, diametro);

        this.definirTexto('resultadoPotencia', `${formatarNumero(r.potenciaBombaKw, 2)} kW (${formatarNumero(r.potenciaCv, 2)} CV)`);
        this.definirTexto('resultadoFaixa', `${r.faixaBomba.faixa}`);
        this.definirTexto('resultadoPerdas', `${formatarNumero(r.perdasTotais, 2)} mca (${formatarNumero(r.pressaoPerdasKpa, 1)} kPa)`);
        this.definirTexto('resultadoAlturaTotal', `${formatarNumero(r.alturaTotal, 2)} mca`);
        this.definirTexto('resultadoEnergia', `${formatarNumero(r.consumoHora, 2)} kWh/h`);
        this.definirTexto('resultadoPressao', `${formatarNumero(r.pressaoTotalKpa, 1)} kPa`);

        this.atualizarMemorial(r);
        this.atualizarExplicacao(r);
    }

    definirTexto(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor;
        }
    }

    atualizarMemorial(r) {
        const pt = i18n.obterIdiomaAtual() !== 'it-IT';

        this.definirTexto('memorial-exemplo-vazao',
            `${formatarNumero(r.vazaoLmin, 0)} L/min = ${formatarNumero(r.vazaoM3s, 6)} m³/s`);
        this.definirTexto('memorial-exemplo-velocidade',
            `${pt ? 'Area' : 'Area'} = ${formatarNumero(r.areaTubo, 6)} m² -> ${pt ? 'velocidade' : 'velocita'} = ${formatarNumero(r.velocidade, 2)} m/s`);
        this.definirTexto('memorial-exemplo-reynolds',
            `Re = ${formatarNumero(r.reynolds, 0)} e f = ${formatarNumero(r.fatorAtrito, 4)}`);
        this.definirTexto('memorial-exemplo-perdas',
            `${pt ? 'Perda linear' : 'Perdita lineare'} = ${formatarNumero(r.perdaLinear, 2)} m + ${pt ? 'acessorios' : 'accessori'} = ${formatarNumero(r.perdaAcessorios, 2)} m -> ${pt ? 'total' : 'totale'} = ${formatarNumero(r.perdasTotais, 2)} m`);
        this.definirTexto('memorial-exemplo-altura',
            `${formatarNumero(r.altura, 1)} m + ${formatarNumero(r.perdasTotais, 2)} m = ${formatarNumero(r.alturaTotal, 2)} mca`);
        this.definirTexto('memorial-exemplo-potencia',
            `P = ${formatarNumero(r.potenciaBombaKw, 2)} kW -> ${formatarNumero(r.potenciaCv, 2)} CV`);

        this.definirTexto('resumo-altura', `${formatarNumero(r.altura, 1)} m`);
        this.definirTexto('resumo-comprimento', `${formatarNumero(r.comprimento, 0)} m`);
        this.definirTexto('resumo-vazao', `${formatarNumero(r.vazaoLmin, 0)} L/min`);
        this.definirTexto('resumo-diametro', `${formatarNumero(r.diametroMm, 0)} mm`);
        this.definirTexto('resumo-velocidade', `${formatarNumero(r.velocidade, 2)} m/s`);
        this.definirTexto('resumo-perdas', `${formatarNumero(r.perdasTotais, 2)} mca`);
        this.definirTexto('resumo-altura-total', `${formatarNumero(r.alturaTotal, 2)} mca`);
        this.definirTexto('resumo-potencia', `${formatarNumero(r.potenciaBombaKw, 2)} kW (${formatarNumero(r.potenciaCv, 2)} CV)`);
        this.definirTexto('resumo-faixa', r.faixaBomba.faixa);
    }

    atualizarExplicacao(r) {
        const pt = i18n.obterIdiomaAtual() !== 'it-IT';
        const velocidadeAlta = r.velocidade > 2.5;
        const velocidadeBaixa = r.velocidade < 0.6;
        const perdasAltas = r.perdasTotais > Math.max(3, r.altura * 0.4);

        let dica = pt
            ? 'O conjunto parece equilibrado para uma bomba residencial.'
            : 'L insieme sembra equilibrato per una pompa residenziale.';

        if (velocidadeAlta) {
            dica = pt
                ? 'A velocidade ficou alta. Um diametro maior reduz perdas, ruído e consumo.'
                : 'La velocita e alta. Un diametro maggiore riduce perdite, rumore e consumo.';
        } else if (velocidadeBaixa) {
            dica = pt
                ? 'A velocidade ficou baixa. O tubo esta folgado para esta vazao, o que reduz perdas, mas pode encarecer a instalacao.'
                : 'La velocita e bassa. Il tubo e sovradimensionato per questa portata: meno perdite, ma piu costo di installazione.';
        } else if (perdasAltas) {
            dica = pt
                ? 'As perdas estao pesadas em relacao a altura estatica. Vale encurtar trechos ou aumentar o diametro.'
                : 'Le perdite sono elevate rispetto alla prevalenza statica. Conviene accorciare il percorso o aumentare il diametro.';
        }

        const destaque = pt
            ? `Para ${formatarNumero(r.vazaoLmin, 0)} L/min e ${formatarNumero(r.alturaTotal, 2)} mca, a faixa comercial sugerida e ${r.faixaBomba.faixa} (${r.tipoBomba}).`
            : `Per ${formatarNumero(r.vazaoLmin, 0)} L/min e ${formatarNumero(r.alturaTotal, 2)} mca, la fascia commerciale suggerita e ${r.faixaBomba.faixa} (${r.tipoBomba}).`;

        this.explicacao.renderizar({
            destaque,
            linhas: [
                {
                    icone: '📏',
                    titulo: pt ? 'Altura total que a bomba precisa vencer' : 'Prevalenza totale da vincere',
                    valor: `${formatarNumero(r.alturaTotal, 2)} mca`,
                    descricao: pt
                        ? `${formatarNumero(r.altura, 1)} m de altura estatica + ${formatarNumero(r.perdasTotais, 2)} m de perdas`
                        : `${formatarNumero(r.altura, 1)} m di prevalenza statica + ${formatarNumero(r.perdasTotais, 2)} m di perdite`
                },
                {
                    icone: '💨',
                    titulo: pt ? 'Velocidade da agua no tubo' : 'Velocita dell acqua nel tubo',
                    valor: `${formatarNumero(r.velocidade, 2)} m/s`,
                    descricao: pt
                        ? 'Faixa usual de conforto hidraulico: aproximadamente 0,6 a 2,0 m/s'
                        : 'Intervallo usuale di comfort idraulico: circa 0,6 a 2,0 m/s'
                },
                {
                    icone: '⚙️',
                    titulo: pt ? 'Potencia estimada da bomba' : 'Potenza stimata della pompa',
                    valor: `${formatarNumero(r.potenciaBombaKw, 2)} kW`,
                    descricao: `${formatarNumero(r.potenciaCv, 2)} CV`
                },
                {
                    icone: '⚡',
                    titulo: pt ? 'Consumo especifico por hora' : 'Consumo specifico per ora',
                    valor: `${formatarNumero(r.consumoHora, 2)} kWh/h`,
                    descricao: pt
                        ? 'Multiplique pelo numero de horas de uso para estimar o consumo diario ou mensal'
                        : 'Moltiplica per le ore di utilizzo per stimare il consumo giornaliero o mensile'
                }
            ],
            dica,
            norma: pt
                ? 'Modelo simplificado com Darcy-Weisbach, agua limpa e tubulacao lisa tipo PVC'
                : 'Modello semplificato con Darcy-Weisbach, acqua pulita e tubazione liscia tipo PVC'
        });
    }

    toggleMemorial() {
        const memorial = document.getElementById('memorialSection');
        const resultados = document.getElementById('resultadosSection');
        if (!memorial || !resultados) return;

        const mostrar = memorial.style.display === 'none';
        memorial.style.display = mostrar ? 'block' : 'none';
        resultados.style.display = mostrar ? 'none' : 'block';

        if (mostrar) {
            memorial.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

const app = new BombaAguaApp();
app.inicializar();
