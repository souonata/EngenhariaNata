/**
 * bitola-script-new.js
 * Calculadora de Bitola de Fios - Versão Modular
 *
 * Calcula a área de seção mínima de fios elétricos para circuitos CC e CA
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CONSTANTES
// ============================================

const RESISTIVIDADE_COBRE = 0.0178; // Ω·mm²/m (NBR 5410)
const BITOLAS_COMERCIAIS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const DISJUNTORES_COMERCIAIS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];
const FATOR_SEGURANCA = 1.25;
const TENSOES_CC_TIPICAS = [3.3, 5, 9, 12, 15, 20, 24, 36, 48, 60, 72, 84, 96];

// ============================================
// CLASSE PRINCIPAL
// ============================================

class BitolaApp extends App {
    constructor() {
        super({
            appName: 'bitola',
            callbacks: {
                aoInicializar: () => this.inicializarBitola(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }

    /**
     * Getter para acessar traduções do idioma atual
     */
    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarBitola() {
        this.configurarEventos();
        this.atualizarResultado();
    }

    atualizarAposTrocaIdioma() {
        this.atualizarResultado();
    }

    configurarEventos() {
        // Info icons (tooltips)
        this.configurarIconesInfo();

        // Inputs de texto
        this.configurarInputsTexto();

        // Sliders
        ['sliderPotencia', 'sliderComprimento', 'sliderTensaoCC', 'sliderQuedaTensao'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => this.atualizarResultado());
            }
        });

        // Radio buttons de tipo de corrente
        document.querySelectorAll('input[name="tipoCorrente"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.atualizarVisibilidadeTensao();
                this.atualizarResultado();
            });
        });

        // Radio buttons de tensão CA
        document.querySelectorAll('input[name="tensaoCA"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });

        // Botões de incremento/decremento (setas + e -)
        this.configurarBotoesIncremento();

        // Botão do memorial
        const btnMemorial = document.getElementById('btnMemorial');
        if (btnMemorial) {
            btnMemorial.addEventListener('click', () => this.toggleMemorial());
        }

        // Botão voltar do memorial
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => this.toggleMemorial());
        }

        document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });

        // Inicializar visibilidade
        this.atualizarVisibilidadeTensao();
    }

    configurarIconesInfo() {
        const infoIcons = [
            { iconId: 'infoIconPotencia', descricaoId: 'descricaoPotencia' },
            { iconId: 'infoIconComprimento', descricaoId: 'descricaoComprimento' },
            { iconId: 'infoIconTensaoCC', descricaoId: 'descricaoTensaoCC' },
            { iconId: 'infoIconQuedaTensao', descricaoId: 'descricaoQuedaTensao' }
        ];

        infoIcons.forEach(({ iconId, descricaoId }) => {
            const icon = document.getElementById(iconId);
            const descricao = document.getElementById(descricaoId);

            if (icon && descricao) {
                // Garante estado inicial
                descricao.style.display = 'none';

                icon.addEventListener('click', () => {
                    const isVisible = descricao.style.display === 'block';
                    descricao.style.display = isVisible ? 'none' : 'block';
                });

                // Também permite usar Enter quando focado
                icon.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const isVisible = descricao.style.display === 'block';
                        descricao.style.display = isVisible ? 'none' : 'block';
                    }
                });
            } else {
            }
        });
    }

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            let animationFrame = null;
            let timeoutId = null;
            let estaSegurando = false;
            let jaIniciouAnimacao = false;
            let direcao = 1;
            const DELAY_AUTO = 500; // ms de espera antes de iniciar incremento automático

            const animar = (timestamp) => {
                if (!estaSegurando) return;

                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);

                if (!slider) return;

                const tempoDecorrido = timestamp - parseFloat(btn.dataset.tempoInicio);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const range = max - min;

                // Velocidade linear: percorre todo o range em 3 segundos
                const velocidade = range / 3000; // unidades por ms
                const distancia = velocidade * tempoDecorrido;

                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + (distancia * direcao);

                // Limita aos bounds
                novoValor = Math.max(min, Math.min(max, novoValor));

                // Se chegou no limite, para
                if ((direcao > 0 && novoValor >= max) || (direcao < 0 && novoValor <= min)) {
                    slider.value = novoValor;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    pararIncremento();
                    return;
                }

                slider.value = novoValor;
                slider.dispatchEvent(new Event('input', { bubbles: true }));

                animationFrame = requestAnimationFrame(animar);
            };

            const iniciarAnimacao = () => {
                if (animationFrame) return;

                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;

                const stepStr = btn.getAttribute('data-step');

                // Determina direção baseado no data-step
                if (stepStr === 'dynamic' || parseFloat(stepStr) > 0) {
                    direcao = 1;
                } else {
                    direcao = -1;
                }

                // Salva estado inicial para animação
                btn.dataset.valorInicial = slider.value;
                btn.dataset.tempoInicio = performance.now();

                jaIniciouAnimacao = true;
                animationFrame = requestAnimationFrame(animar);
            };

            const incrementoUnitario = () => {
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;

                const stepStr = btn.getAttribute('data-step');
                const passo = stepStr === 'dynamic' ? 1 : Math.abs(parseFloat(stepStr)) || 1;
                const direcaoLocal = stepStr === 'dynamic' || parseFloat(stepStr) > 0 ? 1 : -1;

                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);

                let novoValor = parseFloat(slider.value) + (passo * direcaoLocal);
                novoValor = Math.max(min, Math.min(max, novoValor));

                slider.value = novoValor;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            };

            const pararIncremento = () => {
                estaSegurando = false;
                jaIniciouAnimacao = false;

                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }

                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                delete btn.dataset.valorInicial;
                delete btn.dataset.tempoInicio;
            };

            // Mouse: segurar botão
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                estaSegurando = true;

                // Primeiro: incrementa apenas 1 unidade
                incrementoUnitario();

                // Depois de um tempo: inicia incremento automático
                timeoutId = setTimeout(() => {
                    if (estaSegurando && !jaIniciouAnimacao) {
                        iniciarAnimacao();
                    }
                }, DELAY_AUTO);
            });

            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                pararIncremento();
            });

            btn.addEventListener('mouseleave', (e) => {
                pararIncremento();
            });

            // Touch: segurar botão em dispositivos móveis
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                estaSegurando = true;

                // Primeiro: incrementa apenas 1 unidade
                incrementoUnitario();

                // Depois de um tempo: inicia incremento automático
                timeoutId = setTimeout(() => {
                    if (estaSegurando && !jaIniciouAnimacao) {
                        iniciarAnimacao();
                    }
                }, DELAY_AUTO);
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                pararIncremento();
            });

            btn.addEventListener('touchcancel', (e) => {
                pararIncremento();
            });
        });
    }

    configurarInputsTexto() {
        const inputPotencia = document.getElementById('inputPotencia');
        const inputComprimento = document.getElementById('inputComprimento');
        const inputTensaoCC = document.getElementById('inputTensaoCC');
        const inputQuedaTensao = document.getElementById('inputQuedaTensao');

        const sliderPotencia = document.getElementById('sliderPotencia');
        const sliderComprimento = document.getElementById('sliderComprimento');
        const sliderTensaoCC = document.getElementById('sliderTensaoCC');
        const sliderQuedaTensao = document.getElementById('sliderQuedaTensao');

        const atualizarDoInput = (input, slider, tipo) => {
            const numero = this.parsearValor(input.value);

            if (!isNaN(numero)) {
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                let valorFinal = numero;

                if (tipo === 'potencia') {
                    valorFinal = Math.min(999999, Math.max(min, numero));
                    input.dataset.valorReal = valorFinal;
                    slider.value = Math.min(max, valorFinal);
                } else if (tipo === 'tensaoCC') {
                    valorFinal = Math.max(min, numero);
                    input.dataset.valorReal = valorFinal;
                    // Ajusta slider para a tensao tipica mais proxima
                    let indiceMaisProximo = 0;
                    let menorDiferenca = Infinity;
                    for (let i = 0; i < TENSOES_CC_TIPICAS.length; i++) {
                        const diferenca = Math.abs(TENSOES_CC_TIPICAS[i] - valorFinal);
                        if (diferenca < menorDiferenca) {
                            menorDiferenca = diferenca;
                            indiceMaisProximo = i;
                        }
                    }
                    slider.value = indiceMaisProximo;
                } else {
                    valorFinal = Math.max(min, Math.min(max, numero));
                    slider.value = valorFinal;
                }

                this.atualizarResultado();
            }
        };

        if (inputPotencia && sliderPotencia) {
            inputPotencia.addEventListener('blur', () => atualizarDoInput(inputPotencia, sliderPotencia, 'potencia'));
            inputPotencia.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputPotencia, sliderPotencia, 'potencia');
                    inputPotencia.blur();
                }
            });
            sliderPotencia.addEventListener('input', () => {
                inputPotencia.dataset.valorReal = sliderPotencia.value;
            });
        }

        if (inputComprimento && sliderComprimento) {
            inputComprimento.addEventListener('blur', () => atualizarDoInput(inputComprimento, sliderComprimento, 'comprimento'));
            inputComprimento.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputComprimento, sliderComprimento, 'comprimento');
                    inputComprimento.blur();
                }
            });
        }

        if (inputTensaoCC && sliderTensaoCC) {
            inputTensaoCC.addEventListener('blur', () => atualizarDoInput(inputTensaoCC, sliderTensaoCC, 'tensaoCC'));
            inputTensaoCC.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputTensaoCC, sliderTensaoCC, 'tensaoCC');
                    inputTensaoCC.blur();
                }
            });
            sliderTensaoCC.addEventListener('input', () => {
                const indice = parseInt(sliderTensaoCC.value || 0);
                const tensao = TENSOES_CC_TIPICAS[indice] || 12;
                inputTensaoCC.dataset.valorReal = tensao;
            });
        }

        if (inputQuedaTensao && sliderQuedaTensao) {
            inputQuedaTensao.addEventListener('blur', () => atualizarDoInput(inputQuedaTensao, sliderQuedaTensao, 'queda'));
            inputQuedaTensao.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputQuedaTensao, sliderQuedaTensao, 'queda');
                    inputQuedaTensao.blur();
                }
            });
        }
    }

    atualizarVisibilidadeTensao() {
        const tipoCorrente = document.querySelector('input[name="tipoCorrente"]:checked')?.value;
        const secaoTensaoCA = document.getElementById('secaoTensaoCA');
        const secaoTensaoCC = document.getElementById('secaoTensaoCC');
        const tensaoCAInline = document.getElementById('tensaoCAInline');

        if (tipoCorrente === 'ca') {
            if (secaoTensaoCA) secaoTensaoCA.style.display = 'block';
            if (secaoTensaoCC) secaoTensaoCC.style.display = 'none';
            if (tensaoCAInline) {
                tensaoCAInline.style.display = 'flex';
            }
        } else {
            if (secaoTensaoCA) secaoTensaoCA.style.display = 'none';
            if (secaoTensaoCC) secaoTensaoCC.style.display = 'block';
            if (tensaoCAInline) {
                tensaoCAInline.style.display = 'none';
            }
        }
    }

    parsearValor(texto) {
        if (!texto) return NaN;
        const valor = texto.toString().trim();

        if (valor.includes(',')) {
            // Formato pt-BR: ponto milhar, virgula decimal
            const limpo = valor.replace(/\./g, '').replace(/,/g, '.');
            return parseFloat(limpo);
        }

        // Se vier com ponto e sem virgula, tratar ponto como decimal
        const limpo = valor.replace(/,/g, '');
        return parseFloat(limpo);
    }

    obterTensaoAtual() {
        const tipoCorrente = document.querySelector('input[name="tipoCorrente"]:checked')?.value;

        if (tipoCorrente === 'ca') {
            const tensaoCA = document.querySelector('input[name="tensaoCA"]:checked')?.value;
            return parseFloat(tensaoCA) || 110;
        } else {
            const sliderTensaoCC = document.getElementById('sliderTensaoCC');
            const indice = parseInt(sliderTensaoCC?.value || 0);
            return TENSOES_CC_TIPICAS[indice] || 12;
        }
    }

    calcularCorrente(potencia, tensao) {
        if (tensao === 0) return 0;
        return potencia / tensao;
    }

    calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual) {
        const quedaVolts = (quedaPercentual / 100) * tensao;
        if (quedaVolts === 0) return Infinity;
        return (2 * RESISTIVIDADE_COBRE * comprimento * corrente) / quedaVolts;
    }

    selecionarBitolaComercial(areaMinima) {
        if (!isFinite(areaMinima) || areaMinima <= 0) {
            return { bitola: BITOLAS_COMERCIAIS[0], multiplicador: 1, bitolaEquivalente: BITOLAS_COMERCIAIS[0] };
        }

        const areaComSeguranca = areaMinima * FATOR_SEGURANCA;

        for (let i = 0; i < BITOLAS_COMERCIAIS.length; i++) {
            if (BITOLAS_COMERCIAIS[i] >= areaComSeguranca) {
                return { bitola: BITOLAS_COMERCIAIS[i], multiplicador: 1, bitolaEquivalente: BITOLAS_COMERCIAIS[i] };
            }
        }

        const bitolaMaxima = BITOLAS_COMERCIAIS[BITOLAS_COMERCIAIS.length - 1];
        const multiplicador = Math.ceil(areaComSeguranca / bitolaMaxima);
        return {
            bitola: bitolaMaxima,
            multiplicador,
            bitolaEquivalente: bitolaMaxima * multiplicador
        };
    }

    formatarBitolaComercial(bitola, multiplicador) {
        const textoBitola = `${formatarNumero(bitola, 2)} mm²`;
        if (multiplicador > 1) {
            return `${textoBitola} (${multiplicador}x)`;
        }
        return textoBitola;
    }

    selecionarDisjuntorComercial(corrente) {
        const correnteComSeguranca = corrente * FATOR_SEGURANCA;

        for (let i = 0; i < DISJUNTORES_COMERCIAIS.length; i++) {
            if (DISJUNTORES_COMERCIAIS[i] >= correnteComSeguranca) {
                return DISJUNTORES_COMERCIAIS[i];
            }
        }

        return DISJUNTORES_COMERCIAIS[DISJUNTORES_COMERCIAIS.length - 1];
    }

    calcularQuedaReal(comprimento, corrente, tensao, bitola) {
        if (tensao === 0 || bitola === 0) return 0;
        const quedaVolts = (2 * RESISTIVIDADE_COBRE * comprimento * corrente) / bitola;
        return (quedaVolts / tensao) * 100;
    }

    formatarComSufixo(valor) {
        return formatarNumero(valor, 0);
    }

    atualizarResultado() {
        // Obter valores dos inputs
        const inputPotencia = document.getElementById('inputPotencia');
        const inputComprimento = document.getElementById('inputComprimento');
        const inputQuedaTensao = document.getElementById('inputQuedaTensao');
        const inputTensaoCC = document.getElementById('inputTensaoCC');

        const sliderPotencia = document.getElementById('sliderPotencia');
        const sliderComprimento = document.getElementById('sliderComprimento');
        const sliderQuedaTensao = document.getElementById('sliderQuedaTensao');
        const sliderTensaoCC = document.getElementById('sliderTensaoCC');

        const potenciaValorReal = inputPotencia?.dataset.valorReal;
        const potencia = potenciaValorReal ? parseFloat(potenciaValorReal) : parseFloat(sliderPotencia?.value || 100);
        const comprimento = parseFloat(sliderComprimento?.value || 10);
        const quedaPercentual = parseFloat(sliderQuedaTensao?.value || 3);
        const tensao = this.obterTensaoAtual();

        // Atualizar inputs de texto
        if (inputPotencia) {
            inputPotencia.value = this.formatarComSufixo(potencia);
            inputPotencia.dataset.valorReal = potencia;
        }
        if (inputComprimento) inputComprimento.value = formatarNumero(comprimento, 1);
        if (inputQuedaTensao) inputQuedaTensao.value = formatarNumero(quedaPercentual, 1);
        if (inputTensaoCC) {
            const tensaoValorReal = inputTensaoCC.dataset.valorReal;
            if (tensaoValorReal) {
                inputTensaoCC.value = formatarNumero(parseFloat(tensaoValorReal), 1);
            } else {
                const indice = parseInt(sliderTensaoCC?.value || 0);
                inputTensaoCC.value = formatarNumero(TENSOES_CC_TIPICAS[indice] || 12, 1);
            }
        }

        // Validação básica
        if (potencia <= 0 || comprimento <= 0 || tensao <= 0 || quedaPercentual <= 0) {
            this.limparResultados();
            return;
        }

        // Calcular
        const corrente = this.calcularCorrente(potencia, tensao);
        const areaMin = this.calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual);
        const bitolaSelecionada = this.selecionarBitolaComercial(areaMin);
        const quedaRealPercentual = this.calcularQuedaReal(comprimento, corrente, tensao, bitolaSelecionada.bitolaEquivalente);
        const disjuntor = this.selecionarDisjuntorComercial(corrente);

        // Atualizar interface
        const areaMinima = document.getElementById('areaMinima');
        const bitolaComercial = document.getElementById('bitolaComercial');
        const correnteCircuito = document.getElementById('correnteCircuito');
        const quedaReal = document.getElementById('quedaReal');
        const disjuntorComercial = document.getElementById('disjuntorComercial');

        if (areaMinima) {
            areaMinima.textContent = isFinite(areaMin) ? formatarNumero(areaMin, 2) + ' mm²' : '-';
        }
        if (bitolaComercial) {
            bitolaComercial.textContent = isFinite(bitolaSelecionada.bitola)
                ? this.formatarBitolaComercial(bitolaSelecionada.bitola, bitolaSelecionada.multiplicador)
                : '-';
        }
        if (correnteCircuito) {
            correnteCircuito.textContent = isFinite(corrente) ? formatarNumero(corrente, 2) + ' A' : '-';
        }
        if (quedaReal) {
            quedaReal.textContent = isFinite(quedaRealPercentual) ? formatarNumero(quedaRealPercentual, 2) + '%' : '-';
        }
        if (disjuntorComercial) {
            disjuntorComercial.textContent = isFinite(disjuntor) ? formatarNumero(disjuntor, 0) + ' A' : '-';
        }

        // Atualizar memorial se visível
        const memorial = document.getElementById('memorialSection');
        if (memorial && memorial.style.display !== 'none') {
            this.atualizarMemorial(
                potencia,
                comprimento,
                tensao,
                quedaPercentual,
                corrente,
                areaMin,
                bitolaSelecionada,
                quedaRealPercentual,
                disjuntor
            );
        }

        // Painel de explicação V2.0
        this.renderizarExplicacao({ potencia, comprimento, tensao, corrente, areaMin, bitolaSelecionada, quedaRealPercentual, quedaPercentual, disjuntor });
    }

    limparResultados() {
        const ids = ['areaMinima', 'bitolaComercial', 'correnteCircuito', 'quedaReal', 'disjuntorComercial'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
        this.explicacao.limpar();
    }

    renderizarExplicacao({ potencia, comprimento, tensao, corrente, areaMin, bitolaSelecionada, quedaRealPercentual, quedaPercentual, disjuntor }) {
        const pt = i18n.obterIdiomaAtual() === 'pt-BR';
        const bitolaStr = isFinite(bitolaSelecionada?.bitola)
            ? this.formatarBitolaComercial(bitolaSelecionada.bitola, bitolaSelecionada.multiplicador)
            : '-';

        const quedaOk = quedaRealPercentual <= quedaPercentual;
        const dicaPt = quedaOk
            ? 'A queda de tensão está dentro do limite. O fio dimensionado é adequado para o circuito.'
            : 'A queda de tensão real excede o limite especificado. Considere aumentar a bitola ou reduzir o comprimento.';
        const dicaIt = quedaOk
            ? 'La caduta di tensione è nei limiti. Il cavo dimensionato è adeguato per il circuito.'
            : 'La caduta di tensione reale supera il limite. Considera di aumentare la sezione o ridurre la lunghezza.';

        this.explicacao.renderizar({
            destaque: pt
                ? `Use fio de ${bitolaStr} para proteger este circuito com segurança.`
                : `Usa cavo da ${bitolaStr} per proteggere questo circuito in sicurezza.`,
            linhas: [
                {
                    icone: '⚡',
                    titulo: pt ? 'Corrente do Circuito' : 'Corrente del Circuito',
                    valor: `${formatarNumero(corrente, 2)} A`,
                    descricao: pt
                        ? `Com ${formatarNumero(potencia, 0)}W em ${formatarNumero(tensao, 1)}V. Quanto maior a corrente, mais grosso precisa ser o fio.`
                        : `Con ${formatarNumero(potencia, 0)}W a ${formatarNumero(tensao, 1)}V. Maggiore la corrente, più grosso deve essere il cavo.`
                },
                {
                    icone: '📏',
                    titulo: pt ? 'Área Mínima Calculada' : 'Sezione Minima Calcolata',
                    valor: `${formatarNumero(areaMin, 2)} mm²`,
                    descricao: pt
                        ? 'Calculada pela fórmula da resistividade do cobre (NBR 5410). O comercial aplica +25% de margem de segurança.'
                        : 'Calcolata con la formula della resistività del rame. Il cavo commerciale applica un margine di sicurezza del +25%.'
                },
                {
                    icone: '🔌',
                    titulo: pt ? 'Bitola Comercial' : 'Sezione Commerciale',
                    valor: bitolaStr,
                    descricao: pt
                        ? 'É a bitola padrão mais próxima disponível nas lojas. Esta é a que você vai comprar.'
                        : 'È la sezione standard più vicina disponibile nei negozi. Questo è ciò che acquisterai.'
                },
                {
                    icone: '📉',
                    titulo: pt ? 'Queda de Tensão Real' : 'Caduta di Tensione Reale',
                    valor: `${formatarNumero(quedaRealPercentual, 2)}% ${quedaOk ? '✅' : '⚠️'}`,
                    descricao: pt
                        ? `Até 3% é aceitável pela NBR 5410 para circuitos terminais. Limite definido: ${quedaPercentual}%.`
                        : `Fino al 3% è accettabile per circuiti terminali. Limite impostato: ${quedaPercentual}%.`
                },
                {
                    icone: '🔬',
                    titulo: pt ? 'Disjuntor Recomendado' : 'Interruttore Raccomandato',
                    valor: `${formatarNumero(disjuntor, 0)} A`,
                    descricao: pt
                        ? 'Desliga automaticamente se a corrente ultrapassar o limite, protegendo o fio e os equipamentos.'
                        : 'Si disattiva automaticamente se la corrente supera il limite, proteggendo il cavo e le apparecchiature.'
                }
            ],
            dica: pt ? dicaPt : dicaIt,
            norma: pt ? 'ABNT NBR 5410:2004+Errata 1:2008 — Instalações Elétricas de Baixa Tensão' : 'ABNT NBR 5410:2004 — Impianti Elettrici a Bassa Tensione'
        });
    }

    atualizarMemorial(potencia, comprimento, tensao, quedaPercentual, corrente, areaMin, bitolaSelecionada, quedaReal, disjuntor) {
        // Atualizar exemplos - apenas valores numéricos e unidades
        const exCorrente = document.getElementById('memorial-exemplo-corrente');
        const exArea = document.getElementById('memorial-exemplo-area');
        const exBitola = document.getElementById('memorial-exemplo-bitola');
        const exQueda = document.getElementById('memorial-exemplo-queda');
        const exDisjuntor = document.getElementById('memorial-exemplo-disjuntor');

        if (exCorrente) {
            exCorrente.textContent = `${formatarNumero(potencia, 0)}${this.traducoes.unidades.watt} ÷ ${formatarNumero(tensao, 1)}${this.traducoes.unidades.volt} = ${formatarNumero(corrente, 2)}${this.traducoes.unidades.ampere}`;
        }
        if (exArea) {
            const quedaVolts = (quedaPercentual / 100) * tensao;
            exArea.textContent = `(2 × 0.0178 × ${formatarNumero(comprimento, 1)} × ${formatarNumero(corrente, 2)}) ÷ ${formatarNumero(quedaVolts, 2)} = ${formatarNumero(areaMin, 2)} ${this.traducoes.unidades.mm2}`;
        }
        if (exBitola) {
            exBitola.textContent = `${formatarNumero(areaMin, 2)} ${this.traducoes.unidades.mm2} × 1.25 = ${formatarNumero(areaMin * 1.25, 2)} ${this.traducoes.unidades.mm2} → ${this.formatarBitolaComercial(bitolaSelecionada.bitola, bitolaSelecionada.multiplicador)}`;
        }
        if (exQueda) {
            exQueda.textContent = `((2 × 0.0178 × ${formatarNumero(comprimento, 1)} × ${formatarNumero(corrente, 2)}) ÷ ${formatarNumero(bitolaSelecionada.bitolaEquivalente, 2)}) ÷ ${formatarNumero(tensao, 1)} × 100 = ${formatarNumero(quedaReal, 2)}${this.traducoes.unidades.percent}`;
        }
        if (exDisjuntor) {
            exDisjuntor.textContent = `${formatarNumero(corrente, 2)}${this.traducoes.unidades.ampere} × 1.25 = ${formatarNumero(corrente * 1.25, 2)}${this.traducoes.unidades.ampere} → ${formatarNumero(disjuntor, 0)}${this.traducoes.unidades.ampere}`;
        }

        // Atualizar resumo
        const resumoCorrente = document.getElementById('resumo-corrente');
        const resumoArea = document.getElementById('resumo-area');
        const resumoBitola = document.getElementById('resumo-bitola');
        const resumoQueda = document.getElementById('resumo-queda');
        const resumoDisjuntor = document.getElementById('resumo-disjuntor');

        if (resumoCorrente) resumoCorrente.textContent = formatarNumero(corrente, 2) + ' ' + this.traducoes.unidades.ampere;
        if (resumoArea) resumoArea.textContent = formatarNumero(areaMin, 2) + ' ' + this.traducoes.unidades.mm2;
        if (resumoBitola) resumoBitola.textContent = this.formatarBitolaComercial(bitolaSelecionada.bitola, bitolaSelecionada.multiplicador);
        if (resumoQueda) resumoQueda.textContent = formatarNumero(quedaReal, 2) + this.traducoes.unidades.percent;
        if (resumoDisjuntor) resumoDisjuntor.textContent = formatarNumero(disjuntor, 0) + ' ' + this.traducoes.unidades.ampere;
    }

    toggleMemorial() {
        const memorial = document.getElementById('memorialSection');
        const resultados = document.getElementById('resultadosSection');

        if (!memorial) return;

        if (memorial.style.display === 'none' || memorial.style.display === '') {
            this.atualizarResultado(); // Atualiza memorial com valores atuais
            memorial.style.display = 'block';
            if (resultados) resultados.style.display = 'none';
        } else {
            memorial.style.display = 'none';
            if (resultados) resultados.style.display = 'block';
        }
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

// Garante que o DOM está completamente carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new BitolaApp();
        app.inicializar();
    });
} else {
    const app = new BitolaApp();
    app.inicializar();
}
