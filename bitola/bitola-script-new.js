/**
 * bitola-script-new.js
 * Calculadora de Bitola de Fios - Versão Modular
 * 
 * Calcula a área de seção mínima de fios elétricos para circuitos CC e CA
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';
import { configurarInputComSlider, obterValorReal, limparValorReal } from '../src/utils/input-handlers.js';

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
    }

    inicializarBitola() {
        this.configurarEventos();
        this.atualizarLimitesPotencia();
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
                slider.addEventListener('input', () => {
                    // Limpar valorReal do input correspondente ao usar o slider
                    const inputId = id.replace('slider', 'input');
                    const input = document.getElementById(inputId);
                    if (input) {
                        limparValorReal(input);
                    }
                    this.atualizarResultado();
                });
            }
        });

        // Radio buttons de tipo de corrente
        document.querySelectorAll('input[name="tipoCorrente"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.atualizarLimitesPotencia();
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
                console.log(`✅ Configurado ícone: ${iconId}`);
                
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
                console.warn(`⚠️ Elemento não encontrado: ${iconId} ou ${descricaoId}`);
            }
        });
    }

    configurarBotoesIncremento() {
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            let animationFrame = null;
            let tempoInicio = 0;
            let estaSegurando = false;
            let direcao = 1;
            let timeoutInicial = null;
            let incrementouUmaVez = false;
            
            const animar = (timestamp) => {
                if (!estaSegurando) return;
                
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                
                if (!slider) return;
                
                const tempoDecorrido = timestamp - tempoInicio;
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
            
            const incrementarUmaVez = () => {
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                if (!slider) return;
                
                const stepStr = btn.getAttribute('data-step');
                let step;
                
                if (stepStr === 'dynamic' || stepStr === '-dynamic') {
                    const valor = parseFloat(slider.value);
                    if (valor < 100) step = 1;
                    else if (valor < 1000) step = 10;
                    else if (valor < 10000) step = 100;
                    else step = 1000;
                    
                    if (stepStr === '-dynamic') step = -step;
                } else {
                    step = parseFloat(stepStr);
                }
                
                const novoValor = Math.max(
                    parseFloat(slider.min),
                    Math.min(parseFloat(slider.max), parseFloat(slider.value) + step)
                );
                
                slider.value = novoValor;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                incrementouUmaVez = true;
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
                
                // Salva valor inicial
                btn.dataset.valorInicial = slider.value;
                
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };
            
            const pararIncremento = () => {
                estaSegurando = false;
                
                if (timeoutInicial) {
                    clearTimeout(timeoutInicial);
                    timeoutInicial = null;
                }
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                
                delete btn.dataset.valorInicial;
                incrementouUmaVez = false;
            };
            
            // Mouse: segurar botão
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                estaSegurando = true;
                
                // Incrementa uma vez imediatamente
                incrementarUmaVez();
                
                // Aguarda 500ms antes de iniciar incremento contínuo
                timeoutInicial = setTimeout(() => {
                    if (estaSegurando) {
                        iniciarAnimacao();
                    }
                }, 500);
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
                
                // Incrementa uma vez imediatamente
                incrementarUmaVez();
                
                // Aguarda 500ms antes de iniciar incremento contínuo
                timeoutInicial = setTimeout(() => {
                    if (estaSegurando) {
                        iniciarAnimacao();
                    }
                }, 500);
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

        // Parser customizado para potência (aceita k e M)
        const parsePotencia = (valor) => {
            const textoLimpo = valor.replace(/[^\d.,kmKM]/g, '');
            let numero = parseFloat(textoLimpo.replace(',', '.'));
            
            if (valor.toLowerCase().includes('k')) {
                numero *= 1000;
            } else if (valor.toLowerCase().includes('m')) {
                numero *= 1000000;
            }
            
            return numero;
        };

        // Configurar inputs com sliders usando o utilitário
        if (inputPotencia && sliderPotencia) {
            configurarInputComSlider({
                input: inputPotencia,
                slider: sliderPotencia,
                onUpdate: () => this.atualizarResultado(),
                parseValue: parsePotencia
            });
        }

        if (inputComprimento && sliderComprimento) {
            configurarInputComSlider({
                input: inputComprimento,
                slider: sliderComprimento,
                onUpdate: () => this.atualizarResultado()
            });
        }

        if (inputTensaoCC && sliderTensaoCC) {
            configurarInputComSlider({
                input: inputTensaoCC,
                slider: sliderTensaoCC,
                onUpdate: () => this.atualizarResultado()
            });
        }

        if (inputQuedaTensao && sliderQuedaTensao) {
            configurarInputComSlider({
                input: inputQuedaTensao,
                slider: sliderQuedaTensao,
                onUpdate: () => this.atualizarResultado()
            });
        }
    }

    atualizarLimitesPotencia() {
        const tipoCorrente = document.querySelector('input[name="tipoCorrente"]:checked')?.value;
        const sliderPotencia = document.getElementById('sliderPotencia');
        const inputPotencia = document.getElementById('inputPotencia');
        
        if (!sliderPotencia) return;
        
        // Definir limites baseado no tipo de corrente
        const limites = tipoCorrente === 'ca' 
            ? { min: 1, max: 3000 }  // CA: 0-3000W
            : { min: 1, max: 500 };   // CC: 0-500W
        
        sliderPotencia.min = limites.min;
        sliderPotencia.max = limites.max;
        
        // Ajustar valor atual se estiver fora do novo range
        const valorAtual = obterValorReal(inputPotencia, sliderPotencia);
        if (valorAtual > limites.max) {
            sliderPotencia.value = limites.max;
            if (inputPotencia) {
                limparValorReal(inputPotencia);
            }
        } else if (valorAtual < limites.min) {
            sliderPotencia.value = limites.min;
            if (inputPotencia) {
                limparValorReal(inputPotencia);
            }
        }
    }

    atualizarVisibilidadeTensao() {
        const tipoCorrente = document.querySelector('input[name="tipoCorrente"]:checked')?.value;
        const secaoTensaoCA = document.getElementById('secaoTensaoCA');
        const secaoTensaoCC = document.getElementById('secaoTensaoCC');
        const tensaoCAInline = document.getElementById('tensaoCAInline');
        
        console.log('🔄 Tipo de corrente:', tipoCorrente);
        console.log('📍 tensaoCAInline encontrado:', !!tensaoCAInline);

        if (tipoCorrente === 'ca') {
            if (secaoTensaoCA) secaoTensaoCA.style.display = 'block';
            if (secaoTensaoCC) secaoTensaoCC.style.display = 'none';
            if (tensaoCAInline) {
                tensaoCAInline.style.display = 'flex';
                console.log('✅ tensaoCAInline exibido');
            }
        } else {
            if (secaoTensaoCA) secaoTensaoCA.style.display = 'none';
            if (secaoTensaoCC) secaoTensaoCC.style.display = 'block';
            if (tensaoCAInline) {
                tensaoCAInline.style.display = 'none';
                console.log('❌ tensaoCAInline ocultado');
            }
        }
    }

    parsearValor(texto) {
        if (!texto) return NaN;
        // Remove pontos de milhar e substitui vírgula por ponto
        const limpo = texto.toString().replace(/\./g, '').replace(/,/g, '.');
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
            return BITOLAS_COMERCIAIS[0];
        }

        const areaComSeguranca = areaMinima * FATOR_SEGURANCA;

        for (let i = 0; i < BITOLAS_COMERCIAIS.length; i++) {
            if (BITOLAS_COMERCIAIS[i] >= areaComSeguranca) {
                return BITOLAS_COMERCIAIS[i];
            }
        }

        return BITOLAS_COMERCIAIS[BITOLAS_COMERCIAIS.length - 1];
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

        // Usar valor real do input se disponível, senão usar slider
        const potencia = obterValorReal(inputPotencia, sliderPotencia);
        const comprimento = obterValorReal(inputComprimento, sliderComprimento);
        const quedaPercentual = obterValorReal(inputQuedaTensao, sliderQuedaTensao);
        const tensao = this.obterTensaoAtual();

        // Atualizar inputs de texto
        if (inputPotencia) inputPotencia.value = this.formatarComSufixo(potencia);
        if (inputComprimento) inputComprimento.value = formatarNumero(comprimento, 1);
        if (inputQuedaTensao) inputQuedaTensao.value = formatarNumero(quedaPercentual, 1);
        if (inputTensaoCC) {
            const indice = parseInt(sliderTensaoCC?.value || 0);
            inputTensaoCC.value = formatarNumero(TENSOES_CC_TIPICAS[indice] || 12, 1);
        }

        // Validação básica
        if (potencia <= 0 || comprimento <= 0 || tensao <= 0 || quedaPercentual <= 0) {
            this.limparResultados();
            return;
        }

        // Calcular
        const corrente = this.calcularCorrente(potencia, tensao);
        const areaMin = this.calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual);
        const bitola = this.selecionarBitolaComercial(areaMin);
        const quedaRealPercentual = this.calcularQuedaReal(comprimento, corrente, tensao, bitola);
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
            bitolaComercial.textContent = isFinite(bitola) ? formatarNumero(bitola, 2) + ' mm²' : '-';
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
            this.atualizarMemorial(potencia, comprimento, tensao, quedaPercentual, corrente, areaMin, bitola, quedaRealPercentual, disjuntor);
        }
    }

    limparResultados() {
        const ids = ['areaMinima', 'bitolaComercial', 'correnteCircuito', 'quedaReal', 'disjuntorComercial'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
    }

    atualizarMemorial(potencia, comprimento, tensao, quedaPercentual, corrente, areaMin, bitola, quedaReal, disjuntor) {
        // Atualizar exemplos
        const exCorrente = document.getElementById('memorial-exemplo-corrente');
        const exArea = document.getElementById('memorial-exemplo-area');
        const exBitola = document.getElementById('memorial-exemplo-bitola');
        const exQueda = document.getElementById('memorial-exemplo-queda');
        const exDisjuntor = document.getElementById('memorial-exemplo-disjuntor');

        if (exCorrente) {
            exCorrente.textContent = `${formatarNumero(potencia, 0)}W ÷ ${formatarNumero(tensao, 1)}V = ${formatarNumero(corrente, 2)}A`;
        }
        if (exArea) {
            const quedaVolts = (quedaPercentual / 100) * tensao;
            exArea.textContent = `(2 × 0.0178 × ${formatarNumero(comprimento, 1)} × ${formatarNumero(corrente, 2)}) ÷ ${formatarNumero(quedaVolts, 2)} = ${formatarNumero(areaMin, 2)} mm²`;
        }
        if (exBitola) {
            exBitola.textContent = `${formatarNumero(areaMin, 2)} mm² × 1.25 = ${formatarNumero(areaMin * 1.25, 2)} mm² → Bitola comercial: ${formatarNumero(bitola, 2)} mm²`;
        }
        if (exQueda) {
            exQueda.textContent = `((2 × 0.0178 × ${formatarNumero(comprimento, 1)} × ${formatarNumero(corrente, 2)}) ÷ ${formatarNumero(bitola, 2)}) ÷ ${formatarNumero(tensao, 1)} × 100 = ${formatarNumero(quedaReal, 2)}%`;
        }
        if (exDisjuntor) {
            exDisjuntor.textContent = `${formatarNumero(corrente, 2)}A × 1.25 = ${formatarNumero(corrente * 1.25, 2)}A → Disjuntor comercial: ${formatarNumero(disjuntor, 0)}A`;
        }

        // Atualizar resumo
        const resumoCorrente = document.getElementById('resumo-corrente');
        const resumoArea = document.getElementById('resumo-area');
        const resumoBitola = document.getElementById('resumo-bitola');
        const resumoQueda = document.getElementById('resumo-queda');
        const resumoDisjuntor = document.getElementById('resumo-disjuntor');

        if (resumoCorrente) resumoCorrente.textContent = formatarNumero(corrente, 2) + ' A';
        if (resumoArea) resumoArea.textContent = formatarNumero(areaMin, 2) + ' mm²';
        if (resumoBitola) resumoBitola.textContent = formatarNumero(bitola, 2) + ' mm²';
        if (resumoQueda) resumoQueda.textContent = formatarNumero(quedaReal, 2) + '%';
        if (resumoDisjuntor) resumoDisjuntor.textContent = formatarNumero(disjuntor, 0) + ' A';
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
