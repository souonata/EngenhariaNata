/**
 * helice-script-new.js
 * Calculadora de Passo de Hélice - Versão Modular
 * 
 * Calcula o passo ideal da hélice para barcos de lazer considerando:
 * - Velocidade desejada
 * - RPM do motor
 * - Redução da rabeta
 * - Slip (deslizamento) estimado
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';

// ============================================
// CONSTANTES
// ============================================

// Constante de conversão de nós para polegadas/minuto (padrão da indústria náutica)
const CONSTANTE_CONVERSAO = 1056;

// Fatores de conversão de velocidade
const CONVERSAO_VELOCIDADE = {
    knots: 1,         // 1 nó = 1 nó (base)
    mph: 0.868976,    // 1 mph = 0.868976 nós
    kmh: 0.539957     // 1 km/h = 0.539957 nós
};

// Fatores de conversão de passo
const CONVERSAO_PASSO = {
    polegadas: 1,     // 1 polegada = 1 polegada (base)
    mm: 25.4          // 1 polegada = 25.4 mm
};

// Variável global para o gráfico Chart.js
let graficoHelice = null;

// ============================================
// CLASSE PRINCIPAL
// ============================================

class HeliceApp extends App {
    constructor() {
        super({
            appName: 'helice',
            callbacks: {
                aoInicializar: () => this.inicializarHelice(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        this.unidadeVelocidadeAtual = 'mph'; // Valor padrão
    }

    /**
     * Callback executado após inicialização
     * Configura eventos e elementos específicos do app
     */
    inicializarHelice() {
        this.configurarEventos();
        this.carregarChartJS();
        this.atualizarResultado();
    }

    /**
     * Callback executado após troca de idioma
     * Atualiza elementos traduzidos e gráfico
     */
    atualizarAposTrocaIdioma() {
        this.atualizarResultado();
    }

    /**
     * Configura todos os event listeners
     */
    configurarEventos() {
        // Info icons (tooltips)
        this.configurarIconesInfo();

        // Botões de incremento/decremento (setas + e -)
        this.configurarBotoesIncremento();

        // Inputs de texto
        this.configurarInputsTexto();

        // Sliders - atualizar resultado em tempo real
        ['sliderVelocidade', 'sliderReducao', 'sliderRPM', 'sliderSlip'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => this.atualizarResultado());
            }
        });

        // Radio buttons de unidades
        document.querySelectorAll('input[name="unidadeVelocidade"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const unidadeAnterior = this.unidadeVelocidadeAtual;
                this.unidadeVelocidadeAtual = e.target.value;
                this.atualizarLimitesVelocidade(unidadeAnterior);
                this.atualizarResultado();
            });
        });

        document.querySelectorAll('input[name="unidadePasso"]').forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultado());
        });

        // Botão do memorial
        const btnMemorial = document.getElementById('btnMemorial');
        if (btnMemorial) {
            btnMemorial.addEventListener('click', () => this.toggleMemorial());
        }

        // Botão voltar do memorial (há dois botões com classes diferentes)
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => this.toggleMemorial());
        }
        
        // Botão voltar do final do memorial
        document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });

        // Input de velocidade (campo de texto)
        const inputVelocidade = document.getElementById('inputVelocidade');
        if (inputVelocidade) {
            inputVelocidade.addEventListener('input', () => {
                const slider = document.getElementById('sliderVelocidade');
                const valor = this.parsearValor(inputVelocidade.value);
                if (!isNaN(valor) && valor > 0) {
                    slider.value = valor;
                    this.atualizarResultado();
                }
            });
        }
    }

    configurarIconesInfo() {
        const infoIcons = [
            { iconId: 'infoIconVelocidade', descricaoId: 'descricaoVelocidade' },
            { iconId: 'infoIconReducao', descricaoId: 'descricaoReducao' },
            { iconId: 'infoIconRPM', descricaoId: 'descricaoRPM' },
            { iconId: 'infoIconSlip', descricaoId: 'descricaoSlip' }
        ];

        infoIcons.forEach(({ iconId, descricaoId }) => {
            const icon = document.getElementById(iconId);
            const descricao = document.getElementById(descricaoId);

            if (icon && descricao) {
                icon.addEventListener('click', () => {
                    const isVisible = descricao.style.display !== 'none';
                    descricao.style.display = isVisible ? 'none' : 'block';
                });

                // Também permite usar Enter quando focado
                icon.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const isVisible = descricao.style.display !== 'none';
                        descricao.style.display = isVisible ? 'none' : 'block';
                    }
                });
            }
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
                
                const targetId = btn.getAttribute('data-target');
                const slider = document.getElementById(targetId);
                
                if (!slider) return;
                
                const tempoDecorrido = timestamp - tempoInicio;
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const range = max - min;
                
                const velocidade = range / 3000;
                const distancia = velocidade * tempoDecorrido;
                
                const valorInicial = parseFloat(btn.dataset.valorInicial);
                let novoValor = valorInicial + (distancia * direcao);
                
                novoValor = Math.max(min, Math.min(max, novoValor));
                
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
                direcao = parseFloat(stepStr) > 0 ? 1 : -1;
                
                btn.dataset.valorInicial = slider.value;
                
                tempoInicio = performance.now();
                animationFrame = requestAnimationFrame(animar);
            };
            
            const pararIncremento = () => {
                estaSegurando = false;
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                
                delete btn.dataset.valorInicial;
            };
            
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciarAnimacao();
            });
            
            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                pararIncremento();
            });
            
            btn.addEventListener('mouseleave', (e) => {
                pararIncremento();
            });
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                estaSegurando = true;
                iniciarAnimacao();
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
        const inputVelocidade = document.getElementById('inputVelocidade');
        const inputReducao = document.getElementById('inputReducao');
        const inputRPM = document.getElementById('inputRPM');
        const inputSlip = document.getElementById('inputSlip');
        
        const sliderVelocidade = document.getElementById('sliderVelocidade');
        const sliderReducao = document.getElementById('sliderReducao');
        const sliderRPM = document.getElementById('sliderRPM');
        const sliderSlip = document.getElementById('sliderSlip');

        const atualizarDoInput = (input, slider) => {
            const valor = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
            const numero = parseFloat(valor);
            
            if (!isNaN(numero)) {
                slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numero));
                this.atualizarResultado();
            }
        };

        if (inputVelocidade && sliderVelocidade) {
            inputVelocidade.addEventListener('blur', () => atualizarDoInput(inputVelocidade, sliderVelocidade));
            inputVelocidade.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputVelocidade, sliderVelocidade);
                    inputVelocidade.blur();
                }
            });
        }

        if (inputReducao && sliderReducao) {
            inputReducao.addEventListener('blur', () => atualizarDoInput(inputReducao, sliderReducao));
            inputReducao.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputReducao, sliderReducao);
                    inputReducao.blur();
                }
            });
        }

        if (inputRPM && sliderRPM) {
            inputRPM.addEventListener('blur', () => atualizarDoInput(inputRPM, sliderRPM));
            inputRPM.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputRPM, sliderRPM);
                    inputRPM.blur();
                }
            });
        }

        if (inputSlip && sliderSlip) {
            inputSlip.addEventListener('blur', () => atualizarDoInput(inputSlip, sliderSlip));
            inputSlip.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    atualizarDoInput(inputSlip, sliderSlip);
                    inputSlip.blur();
                }
            });
        }
    }

    /**
     * Carrega Chart.js dinamicamente se necessário
     */
    carregarChartJS() {
        if (typeof Chart !== 'undefined') {
            return; // Já carregado
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
        script.onload = () => this.atualizarGrafico();
        document.head.appendChild(script);
    }

    /**
     * Converte velocidade de qualquer unidade para nós
     */
    converterParaKnots(valor, unidade) {
        return valor * (CONVERSAO_VELOCIDADE[unidade] || 1);
    }

    /**
     * Converte velocidade de nós para qualquer unidade
     */
    converterDeKnots(valorKnots, unidade) {
        return valorKnots / (CONVERSAO_VELOCIDADE[unidade] || 1);
    }

    /**
     * Converte passo para a unidade desejada
     */
    converterPasso(valorPolegadas, unidade) {
        return unidade === 'mm' ? valorPolegadas * CONVERSAO_PASSO.mm : valorPolegadas;
    }

    /**
     * Parseia valor formatado (permite vírgula ou ponto)
     */
    parsearValor(texto) {
        if (!texto) return NaN;
        return parseFloat(texto.toString().replace(/,/g, '.'));
    }

    /**
     * Calcula passo, RPM da hélice e velocidade teórica
     */
    calcularPasso(velocidadeKnots, reducao, rpmMotor, slip) {
        // RPM efetivo na hélice
        const rpmHelice = rpmMotor / reducao;

        // Passo recomendado (fórmula náutica padrão)
        const passo = (velocidadeKnots * CONSTANTE_CONVERSAO * reducao) / (rpmMotor * (1 - slip));

        // Velocidade teórica (sem slip)
        const velocidadeTeorica = (passo * rpmMotor) / (CONSTANTE_CONVERSAO * reducao);

        return {
            passo: Math.round(passo * 10) / 10,
            rpmHelice: Math.round(rpmHelice),
            velocidadeTeorica: Math.round(velocidadeTeorica * 10) / 10
        };
    }

    /**
     * Atualiza limites do slider de velocidade ao mudar unidade
     */
    atualizarLimitesVelocidade(unidadeAnterior = null) {
        const slider = document.getElementById('sliderVelocidade');
        const inputVelocidade = document.getElementById('inputVelocidade');
        const unidadeAtual = document.querySelector('input[name="unidadeVelocidade"]:checked').value;

        // Obter valor atual
        let valorAtual = parseFloat(slider.value);
        if (inputVelocidade?.value) {
            const valorInput = this.parsearValor(inputVelocidade.value);
            if (!isNaN(valorInput) && valorInput > 0) {
                valorAtual = valorInput;
            }
        }

        // Converter para nós e depois para nova unidade
        let valorKnots;
        if (unidadeAnterior) {
            valorKnots = this.converterParaKnots(valorAtual, unidadeAnterior);
        } else {
            valorKnots = this.converterParaKnots(valorAtual, unidadeAtual);
        }

        // Definir limites (equivalente a 5-60 nós)
        let min, max;
        if (unidadeAtual === 'knots') {
            min = 5;
            max = 60;
        } else if (unidadeAtual === 'mph') {
            min = 6;
            max = 70;
        } else { // kmh
            min = 9;
            max = 112;
        }

        slider.min = min;
        slider.max = max;

        // Converter valor para nova unidade
        const novoValor = this.converterDeKnots(valorKnots, unidadeAtual);
        slider.value = Math.max(min, Math.min(max, novoValor));

        // Atualizar labels de range
        const rangeMin = document.getElementById('rangeMinVelocidade');
        const rangeMax = document.getElementById('rangeMaxVelocidade');
        if (rangeMin) rangeMin.textContent = min;
        if (rangeMax) rangeMax.textContent = max;
    }

    /**
     * Atualiza resultado do cálculo e interface
     */
    atualizarResultado() {
        // Obter valores dos inputs
        const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked')?.value || 'knots';
        const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked')?.value || 'polegadas';
        const reducao = parseFloat(document.getElementById('sliderReducao')?.value || 2);
        const rpmMotor = parseFloat(document.getElementById('sliderRPM')?.value || 5000);
        const slipPercent = parseFloat(document.getElementById('sliderSlip')?.value || 15);

        // Velocidade: usa o valor do slider diretamente
        const sliderVelocidade = document.getElementById('sliderVelocidade');
        const inputVelocidade = document.getElementById('inputVelocidade');
        let velocidade = parseFloat(sliderVelocidade?.value || 25);

        // Atualizar campos de texto com valores formatados
        const inputReducao = document.getElementById('inputReducao');
        const inputRPM = document.getElementById('inputRPM');
        const inputSlip = document.getElementById('inputSlip');

        if (inputVelocidade) inputVelocidade.value = formatarNumero(velocidade, 1);
        if (inputReducao) inputReducao.value = formatarNumero(reducao, 2);
        if (inputRPM) inputRPM.value = formatarNumero(rpmMotor, 0);
        if (inputSlip) inputSlip.value = formatarNumero(slipPercent, 0);

        // Converter velocidade para nós
        const velocidadeKnots = this.converterParaKnots(velocidade, unidadeVelocidade);

        // Calcular passo
        const resultado = this.calcularPasso(velocidadeKnots, reducao, rpmMotor, slipPercent / 100);

        // Converter e exibir resultados
        const passoConvertido = this.converterPasso(resultado.passo, unidadePasso);
        const velocidadeTeoricaConvertida = this.converterDeKnots(resultado.velocidadeTeorica, unidadeVelocidade);

        const resultadoPasso = document.getElementById('resultadoPasso');
        const rpmHeliceEl = document.getElementById('rpmHelice');
        const velocidadeTeoricaEl = document.getElementById('velocidadeTeorica');
        const unidadeVelocidadeTeoricaEl = document.getElementById('unidadeVelocidadeTeorica');

        if (resultadoPasso) {
            resultadoPasso.textContent = formatarNumero(passoConvertido, unidadePasso === 'mm' ? 0 : 1);
        }
        if (rpmHeliceEl) {
            rpmHeliceEl.textContent = formatarNumero(resultado.rpmHelice, 0);
        }
        if (velocidadeTeoricaEl) {
            velocidadeTeoricaEl.textContent = formatarNumero(velocidadeTeoricaConvertida, 1);
        }

        // Atualizar unidade de velocidade traduzida
        if (unidadeVelocidadeTeoricaEl) {
            const unidadeTexto = i18n.obterTraducao(`unidades.${unidadeVelocidade === 'knots' ? 'nos' : unidadeVelocidade}`);
            unidadeVelocidadeTeoricaEl.textContent = unidadeTexto || unidadeVelocidade;
        }

        // Atualizar gráfico
        this.atualizarGrafico();

        // Atualizar memorial se visível
        const memorial = document.getElementById('memorialSection');
        if (memorial && memorial.style.display !== 'none') {
            this.atualizarMemorial();
        }
    }

    /**
     * Atualiza o memorial de cálculo com valores atuais
     */
    atualizarMemorial() {
        const reducao = parseFloat(document.getElementById('sliderReducao')?.value || 2);
        const rpmMotor = parseFloat(document.getElementById('sliderRPM')?.value || 5000);
        const slipPercent = parseFloat(document.getElementById('sliderSlip')?.value || 15);
        const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked')?.value || 'knots';

        const sliderVelocidade = document.getElementById('sliderVelocidade');
        const inputVelocidade = document.getElementById('inputVelocidade');
        let velocidade = parseFloat(sliderVelocidade?.value || 25);
        
        if (inputVelocidade?.value) {
            const valorInput = this.parsearValor(inputVelocidade.value);
            if (!isNaN(valorInput) && valorInput > 0) {
                velocidade = valorInput;
            }
        }

        const velocidadeKnots = this.converterParaKnots(velocidade, unidadeVelocidade);
        const resultado = this.calcularPasso(velocidadeKnots, reducao, rpmMotor, slipPercent / 100);

        // Atualizar exemplos
        const exRpm = document.getElementById('memorial-exemplo-rpm');
        const exPasso = document.getElementById('memorial-exemplo-passo');
        const exVelocidade = document.getElementById('memorial-exemplo-velocidade');

        if (exRpm) {
            exRpm.textContent = `Motor ${formatarNumero(rpmMotor, 0)} RPM, redução ${formatarNumero(reducao, 2)}:1 → ${formatarNumero(rpmMotor, 0)} ÷ ${formatarNumero(reducao, 2)} = ${formatarNumero(resultado.rpmHelice, 0)} RPM na hélice`;
        }
        if (exPasso) {
            exPasso.textContent = `${formatarNumero(velocidadeKnots, 0)} nós, redução ${formatarNumero(reducao, 2)}:1, ${formatarNumero(rpmMotor, 0)} RPM, slip ${formatarNumero(slipPercent, 0)}% → (${formatarNumero(velocidadeKnots, 0)} × 1056 × ${formatarNumero(reducao, 2)}) ÷ (${formatarNumero(rpmMotor, 0)} × ${formatarNumero(1 - slipPercent/100, 2)}) = ${formatarNumero(resultado.passo, 1)} polegadas`;
        }
        if (exVelocidade) {
            exVelocidade.textContent = `Passo ${formatarNumero(resultado.passo, 1)}", ${formatarNumero(rpmMotor, 0)} RPM, redução ${formatarNumero(reducao, 2)}:1 → (${formatarNumero(resultado.passo, 1)} × ${formatarNumero(rpmMotor, 0)}) ÷ (1056 × ${formatarNumero(reducao, 2)}) = ${formatarNumero(resultado.velocidadeTeorica, 1)} nós`;
        }

        // Atualizar resumo
        const resumoRpm = document.getElementById('resumo-rpm-helice');
        const resumoPasso = document.getElementById('resumo-passo');
        const resumoVelocidade = document.getElementById('resumo-velocidade-teorica');

        if (resumoRpm) resumoRpm.textContent = formatarNumero(resultado.rpmHelice, 0) + ' rpm';
        if (resumoPasso) resumoPasso.textContent = formatarNumero(resultado.passo, 1) + '"';
        if (resumoVelocidade) resumoVelocidade.textContent = formatarNumero(resultado.velocidadeTeorica, 1) + ' nós';
    }

    /**
     * Alterna exibição do memorial
     */
    toggleMemorial() {
        const memorial = document.getElementById('memorialSection');
        const resultados = document.getElementById('resultadosSection');

        if (!memorial) return;

        if (memorial.style.display === 'none' || memorial.style.display === '') {
            this.atualizarMemorial();
            memorial.style.display = 'block';
            if (resultados) resultados.style.display = 'none';
        } else {
            memorial.style.display = 'none';
            if (resultados) resultados.style.display = 'block';
        }
    }

    /**
     * Atualiza/cria gráfico de relação Passo × Velocidade
     */
    atualizarGrafico() {
        if (typeof Chart === 'undefined') return;

        const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked')?.value || 'knots';
        const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked')?.value || 'polegadas';
        const reducao = parseFloat(document.getElementById('sliderReducao')?.value || 2);
        const rpmMotor = parseFloat(document.getElementById('sliderRPM')?.value || 5000);
        const slipPercent = parseFloat(document.getElementById('sliderSlip')?.value || 15);

        // Valor atual para marcador
        const sliderVelocidade = document.getElementById('sliderVelocidade');
        const velocidadeAtual = sliderVelocidade ? parseFloat(sliderVelocidade.value) : 25;
        const velocidadeAtualKnots = this.converterParaKnots(velocidadeAtual, unidadeVelocidade);
        const resultadoAtual = this.calcularPasso(velocidadeAtualKnots, reducao, rpmMotor, slipPercent / 100);
        const passoAtual = this.converterPasso(resultadoAtual.passo, unidadePasso);
        const velocidadeAtualConvertida = this.converterDeKnots(velocidadeAtualKnots, unidadeVelocidade);

        // Gerar dados do gráfico
        const velocidades = [];
        const passos = [];
        const passosSlipMin = [];
        const passosSlipMax = [];

        for (let vKnots = 5; vKnots <= 60; vKnots += 5) {
            const vConvertida = this.converterDeKnots(vKnots, unidadeVelocidade);
            velocidades.push(Math.round(vConvertida));

            const resultado = this.calcularPasso(vKnots, reducao, rpmMotor, slipPercent / 100);
            passos.push(this.converterPasso(resultado.passo, unidadePasso));

            const resultadoSlipMin = this.calcularPasso(vKnots, reducao, rpmMotor, 0.10);
            const resultadoSlipMax = this.calcularPasso(vKnots, reducao, rpmMotor, 0.20);
            passosSlipMin.push(this.converterPasso(resultadoSlipMin.passo, unidadePasso));
            passosSlipMax.push(this.converterPasso(resultadoSlipMax.passo, unidadePasso));
        }

        const ctx = document.getElementById('graficoHelice')?.getContext('2d');
        if (!ctx) return;

        // Destruir gráfico anterior
        if (graficoHelice) {
            graficoHelice.destroy();
        }

        // Criar novo gráfico
        graficoHelice = new Chart(ctx, {
            type: 'line',
            data: {
                labels: velocidades,
                datasets: [
                    {
                        label: i18n.obterTraducao('grafico.label') || 'Zona de Slip (10-20%)',
                        data: passosSlipMax,
                        borderColor: 'rgba(255, 193, 7, 0.3)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 1,
                        fill: '+1',
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        order: 3
                    },
                    {
                        label: '',
                        data: passosSlipMin,
                        borderColor: 'rgba(255, 193, 7, 0.3)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 1,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        order: 2
                    },
                    {
                        label: i18n.obterTraducao('grafico.label') || 'Passo Recomendado',
                        data: passos,
                        borderColor: 'rgba(0, 123, 255, 1)',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        order: 1
                    },
                    {
                        label: 'Ponto Atual',
                        data: velocidades.map((v, i) => 
                            Math.abs(v - Math.round(velocidadeAtualConvertida)) < 2 ? passoAtual : null
                        ),
                        borderColor: 'rgba(220, 53, 69, 1)',
                        backgroundColor: 'rgba(220, 53, 69, 1)',
                        pointRadius: 8,
                        pointHoverRadius: 10,
                        showLine: false,
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Desabilita animações para atualização instantânea
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: i18n.obterTraducao('grafico.eixoX') || 'Velocidade'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: i18n.obterTraducao('grafico.eixoY') || 'Passo Recomendado'
                        },
                        beginAtZero: false
                    }
                }
            }
        });
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new HeliceApp();
app.inicializar();
