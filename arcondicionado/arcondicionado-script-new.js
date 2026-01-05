/**
 * arcondicionado-script-new.js
 * Dimensionador de Ar Condicionado - Versão Modular
 * 
 * Cálculo de BTU para sistemas multi-split residenciais
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { configurarInputComSlider, obterValorReal, limparValorReal } from '../src/utils/input-handlers.js';

// ============================================
// CLASSE PRINCIPAL
// ============================================

class ArcondicionadoApp extends App {
    constructor() {
        super({
            appName: 'arcondicionado',
            callbacks: {
                aoInicializar: () => this.inicializarArcondicionado(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        
        // Estado do aplicativo
        this.estado = {
            numAmbientes: 1,
            areaTotal: 20,
            area: 20,
            altura: 2.7,
            pessoas: 2,
            equipamentos: 3,
            insolacao: 'media',
            isolamento: 'medio'
        };
        
        // Estado dos botões de incremento (hold)
        this.estadoBotoes = {
            estaSegurando: false,
            animationId: null,
            targetId: null,
            step: 0,
            tempoInicio: null,
            valorInicial: null,
            delayTimeout: null
        };
        
        // Constantes do sistema
        this.MODELOS_COMERCIAIS = [5000, 7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];
        this.MODELOS_COMERCIAIS_EXTERNAS = [18000, 24000, 30000, 36000, 48000, 60000, 72000, 84000, 96000, 120000, 144000, 180000];
        this.BTU_PARA_KW = 0.000293;
        
        // Taxas de conversão de moeda
        this.TAXA_BRL_EUR = 6.19;
        
        // Gráficos
        this.graficoCusto = null;
        this.graficoBTU = null;
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    inicializarArcondicionado() {
        this.configurarEventos();
        this.configurarBotoesIncremento();
        this.configurarInputsTexto();
        this.configurarInfoIcons();
        this.configurarMemorial();
        this.configurarVisibilidadeInicial();
        this.atualizarResultados();
    }
    
    // ============================================
    // CONFIGURAÇÃO DE EVENTOS
    // ============================================
    
    configurarEventos() {
        // Sliders
        const sliders = ['sliderNumAmbientes', 'sliderAreaTotal', 'sliderArea', 'sliderAltura', 'sliderPessoas', 'sliderEquipamentos'];
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => {
                    // Limpar valorReal do input correspondente ao usar o slider
                    const inputId = id.replace('slider', 'input');
                    const input = document.getElementById(inputId);
                    limparValorReal(input);
                    this.aoMudarSlider(id);
                });
            }
        });
        
        // Radios (insolação e isolamento)
        const radios = document.querySelectorAll('input[name="insolacao"], input[name="isolamento"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultados());
        });
    }
    
    configurarBotoesIncremento() {
        const botoes = document.querySelectorAll('.arrow-btn');
        botoes.forEach(botao => {
            const targetId = botao.getAttribute('data-target');
            const step = parseFloat(botao.getAttribute('data-step'));
            
            // Mouse events
            botao.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.iniciarIncremento(targetId, step);
            });
            botao.addEventListener('mouseup', () => this.pararIncremento());
            botao.addEventListener('mouseleave', () => this.pararIncremento());
            
            // Touch events
            botao.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.iniciarIncremento(targetId, step);
            });
            botao.addEventListener('touchend', () => this.pararIncremento());
            botao.addEventListener('touchcancel', () => this.pararIncremento());
        });
    }
    
    iniciarIncremento(targetId, step) {
        if (this.estadoBotoes.estaSegurando) return;
        
        this.estadoBotoes.estaSegurando = true;
        this.estadoBotoes.targetId = targetId;
        this.estadoBotoes.step = step;
        
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        // Primeiro incremento imediato (clique simples)
        this.ajustarValor(targetId, step);
        
        // Aguarda 500ms antes de iniciar animação contínua
        this.estadoBotoes.delayTimeout = setTimeout(() => {
            if (this.estadoBotoes.estaSegurando) {
                // Captura valor inicial DEPOIS do primeiro incremento
                this.estadoBotoes.valorInicial = parseFloat(slider.value);
                this.estadoBotoes.tempoInicio = performance.now();
                this.estadoBotoes.animationId = requestAnimationFrame((timestamp) => this.animarIncremento(timestamp));
            }
        }, 500);
    }
    
    animarIncremento(timestamp) {
        if (!this.estadoBotoes.estaSegurando) return;
        
        const { targetId, step, tempoInicio, valorInicial } = this.estadoBotoes;
        const tempoDecorrido = timestamp - tempoInicio;
        
        const slider = document.getElementById(targetId);
        if (!slider) {
            this.pararIncremento();
            return;
        }
        
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const range = max - min;
        
        // Velocidade linear: percorre todo range em 3000ms
        const velocidade = range / 3000;
        const distanciaPercorrida = velocidade * tempoDecorrido;
        
        // Calcula novo valor baseado na posição inicial + distância
        let novoValor = valorInicial + (step > 0 ? distanciaPercorrida : -distanciaPercorrida);
        novoValor = Math.max(min, Math.min(max, novoValor));
        
        // Arredonda para o step do slider
        const stepSlider = parseFloat(slider.step) || 1;
        novoValor = Math.round(novoValor / stepSlider) * stepSlider;
        
        const valorAtual = parseFloat(slider.value);
        if (Math.abs(novoValor - valorAtual) >= stepSlider / 2) {
            slider.value = novoValor;
            this.aoMudarSlider(targetId);
        }
        
        // Continua animação se ainda estiver segurando e não chegou no limite
        if (this.estadoBotoes.estaSegurando && novoValor > min && novoValor < max) {
            this.estadoBotoes.animationId = requestAnimationFrame((ts) => this.animarIncremento(ts));
        } else if (novoValor <= min || novoValor >= max) {
            this.pararIncremento();
        }
    }
    
    pararIncremento() {
        this.estadoBotoes.estaSegurando = false;
        
        if (this.estadoBotoes.delayTimeout) {
            clearTimeout(this.estadoBotoes.delayTimeout);
            this.estadoBotoes.delayTimeout = null;
        }
        
        if (this.estadoBotoes.animationId) {
            cancelAnimationFrame(this.estadoBotoes.animationId);
            this.estadoBotoes.animationId = null;
        }
    }
    
    ajustarValor(targetId, step) {
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        const valorAtual = parseFloat(slider.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const stepSlider = parseFloat(slider.step) || 1;
        
        let novoValor = valorAtual + step * stepSlider;
        novoValor = Math.max(min, Math.min(max, novoValor));
        
        slider.value = novoValor;
        this.aoMudarSlider(targetId);
    }
    
    configurarInputsTexto() {
        const inputs = [
            { id: 'inputNumAmbientes', sliderId: 'sliderNumAmbientes' },
            { id: 'inputAreaTotal', sliderId: 'sliderAreaTotal' },
            { id: 'inputArea', sliderId: 'sliderArea' },
            { id: 'inputAltura', sliderId: 'sliderAltura' },
            { id: 'inputPessoas', sliderId: 'sliderPessoas' },
            { id: 'inputEquipamentos', sliderId: 'sliderEquipamentos' }
        ];
        
        inputs.forEach(({ id, sliderId }) => {
            const input = document.getElementById(id);
            const slider = document.getElementById(sliderId);
            
            if (!input || !slider) return;
            
            configurarInputComSlider({
                input: input,
                slider: slider,
                onUpdate: () => this.atualizarResultados()
            });
        });
    }
    
    configurarInfoIcons() {
        const infoIcons = document.querySelectorAll('.info-icon');
        infoIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Encontrar a div descricao-info que é irmã do cabecalho-controle
                const grupoEntrada = icon.closest('.grupo-entrada');
                if (grupoEntrada) {
                    const descricao = grupoEntrada.querySelector('.descricao-info');
                    if (descricao) {
                        const estaVisivel = descricao.style.display === 'block';
                        descricao.style.display = estaVisivel ? 'none' : 'block';
                    }
                }
            });
        });
    }
    
    configurarMemorial() {
        const btnMemorial = document.getElementById('btnMemorial');
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        const btnsVoltar = document.querySelectorAll('.btn-voltar-memorial');
        
        if (btnMemorial) {
            btnMemorial.addEventListener('click', () => this.toggleMemorial());
        }
        
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => this.toggleMemorial());
        }
        
        btnsVoltar.forEach(btn => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });
    }
    
    toggleMemorial() {
        const memorialSection = document.getElementById('memorialSection');
        const resultadosSection = document.getElementById('resultadosSection');
        
        if (!memorialSection) return;
        
        if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
            this.atualizarMemorialComValores();
            memorialSection.style.display = 'block';
            if (resultadosSection) resultadosSection.style.display = 'none';
        } else {
            memorialSection.style.display = 'none';
            if (resultadosSection) resultadosSection.style.display = 'block';
        }
    }
    
    configurarVisibilidadeInicial() {
        const numAmbientes = parseInt(document.getElementById('sliderNumAmbientes')?.value || 1);
        this.ajustarVisibilidadeCampos(numAmbientes);
    }
    
    ajustarVisibilidadeCampos(numAmbientes) {
        const grupoAreaIndividual = document.getElementById('grupoAreaIndividual');
        const grupoAreaTotal = document.getElementById('grupoAreaTotal');
        
        if (grupoAreaIndividual) {
            grupoAreaIndividual.style.display = numAmbientes > 1 ? 'none' : 'block';
        }
        
        if (grupoAreaTotal) {
            grupoAreaTotal.style.display = numAmbientes > 1 ? 'block' : 'none';
        }
    }
    
    aoMudarSlider(sliderId) {
        const slider = document.getElementById(sliderId);
        if (!slider) return;
        
        // Mapeamento de sliders para inputs
        const inputMap = {
            'sliderNumAmbientes': 'inputNumAmbientes',
            'sliderAreaTotal': 'inputAreaTotal',
            'sliderArea': 'inputArea',
            'sliderAltura': 'inputAltura',
            'sliderPessoas': 'inputPessoas',
            'sliderEquipamentos': 'inputEquipamentos'
        };
        
        const inputId = inputMap[sliderId];
        const input = document.getElementById(inputId);
        const valor = obterValorReal(input, slider, parseFloat(slider.value));
        
        if (input) {
            // Formata valor conforme o tipo
            if (sliderId === 'sliderAltura') {
                input.value = this.formatarDecimal(valor, 1);
            } else {
                input.value = Math.round(valor);
            }
        }
        
        // Atualiza estado
        switch (sliderId) {
            case 'sliderNumAmbientes':
                this.estado.numAmbientes = Math.round(valor);
                this.ajustarVisibilidadeCampos(this.estado.numAmbientes);
                break;
            case 'sliderAreaTotal':
                this.estado.areaTotal = valor;
                break;
            case 'sliderArea':
                this.estado.area = valor;
                break;
            case 'sliderAltura':
                this.estado.altura = valor;
                break;
            case 'sliderPessoas':
                this.estado.pessoas = Math.round(valor);
                break;
            case 'sliderEquipamentos':
                this.estado.equipamentos = Math.round(valor);
                break;
        }
        
        this.atualizarResultados();
    }
    
    atualizarAposTrocaIdioma() {
        this.atualizarResultados();
    }
    
    // ============================================
    // FUNÇÕES DE CÁLCULO BTU
    // ============================================
    
    getBTUPorM2(isolamento = 'medio') {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        
        if (idioma === 'it-IT') {
            switch (isolamento) {
                case 'bom': return 300;
                case 'medio': return 340;
                case 'ruim': return 400;
                default: return 340;
            }
        } else {
            return 700; // Brasil - clima tropical
        }
    }
    
    getBTUPorPessoa() {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        return idioma === 'it-IT' ? 200 : 600;
    }
    
    calcularBTUPessoas(pessoas) {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        
        if (idioma === 'it-IT') {
            return pessoas * this.getBTUPorPessoa();
        } else {
            // Brasil: apenas pessoas além das primeiras 2
            const pessoasAdicionais = Math.max(0, pessoas - 2);
            return pessoasAdicionais * this.getBTUPorPessoa();
        }
    }
    
    getBTUPorEquipamento() {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        return idioma === 'it-IT' ? 300 : 600;
    }
    
    getFatorInsolacao(nivel) {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        
        if (idioma === 'it-IT') {
            const fatores = { baixa: 0.9, media: 1.0, alta: 1.2 };
            return fatores[nivel] || 1.0;
        } else {
            const fatores = { baixa: 1.0, media: 1.15, alta: 1.3 };
            return fatores[nivel] || 1.0;
        }
    }
    
    getFatorIsolamento(nivel) {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        
        if (idioma === 'it-IT') {
            const fatores = { bom: 0.85, medio: 1.0, ruim: 1.3 };
            return fatores[nivel] || 1.0;
        } else {
            const fatores = { bom: 0.8, medio: 1.0, ruim: 1.2 };
            return fatores[nivel] || 1.0;
        }
    }
    
    calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento) {
        // Cálculo BTU base
        const fatorAltura = altura / 2.7;
        const btuAreaTotal = areaTotal * this.getBTUPorM2(isolamento) * fatorAltura;
        const btuPessoasTotal = this.calcularBTUPessoas(pessoas);
        const btuEquipamentosTotal = equipamentos * this.getBTUPorEquipamento();
        const btuBaseTotal = btuAreaTotal + btuPessoasTotal + btuEquipamentosTotal;
        
        // Aplicar fatores
        const fatorInsolacao = this.getFatorInsolacao(insolacao);
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        const fatorIsolamento = idioma === 'it-IT' ? 1.0 : this.getFatorIsolamento(isolamento);
        const btuFinalTotal = btuBaseTotal * fatorInsolacao * fatorIsolamento;
        
        // BTU por ambiente
        const btuPorAmbiente = btuFinalTotal / numAmbientes;
        
        // Selecionar modelos comerciais para unidades internas
        let unidadesInternasPorAmbiente = 1;
        let combinacaoInterna = [];
        
        if (btuPorAmbiente <= 60000) {
            // Arredondar para cima para o modelo comercial mais próximo
            const modeloInterno = this.MODELOS_COMERCIAIS.find(m => m >= btuPorAmbiente) || 60000;
            combinacaoInterna = [modeloInterno];
        } else {
            // Múltiplas unidades de 60k por ambiente
            unidadesInternasPorAmbiente = Math.ceil(btuPorAmbiente / 60000);
            combinacaoInterna = Array(unidadesInternasPorAmbiente).fill(60000);
        }
        
        // Total de unidades internas
        const unidadesInternas = numAmbientes * unidadesInternasPorAmbiente;
        
        // Contabilizar unidades internas por modelo
        const unidadesInternasPorModelo = {};
        combinacaoInterna.forEach(modelo => {
            const count = numAmbientes;
            unidadesInternasPorModelo[modelo] = (unidadesInternasPorModelo[modelo] || 0) + count;
        });
        
        // BTU total real (soma das unidades internas)
        const btuTotalReal = combinacaoInterna.reduce((sum, btu) => sum + btu, 0) * numAmbientes;
        
        // Selecionar modelos para unidades externas
        let numUnidadesExternas = 1;
        let combinacaoExterna = [];
        
        if (btuTotalReal <= 180000) {
            const modeloExterno = this.MODELOS_COMERCIAIS_EXTERNAS.find(m => m >= btuTotalReal) || 180000;
            combinacaoExterna = [modeloExterno];
        } else {
            // Múltiplas unidades de 180k
            numUnidadesExternas = Math.ceil(btuTotalReal / 180000);
            combinacaoExterna = Array(numUnidadesExternas).fill(180000);
        }
        
        const btuTotalExterno = combinacaoExterna.reduce((sum, btu) => sum + btu, 0);
        
        // Calcular custos
        const custoUnidadeExterna = this.calcularCustoUnidadeExterna(combinacaoExterna[0]);
        const custoTotalUnidadesExternas = custoUnidadeExterna * numUnidadesExternas;
        
        let custoTotalUnidadesInternas = 0;
        Object.keys(unidadesInternasPorModelo).forEach(modelo => {
            const qtd = unidadesInternasPorModelo[modelo];
            const custo = this.calcularCustoUnidadeInterna(parseInt(modelo));
            custoTotalUnidadesInternas += custo * qtd;
        });
        
        const custoTotal = custoTotalUnidadesExternas + custoTotalUnidadesInternas;
        
        return {
            btuTotal: btuFinalTotal,
            btuPorAmbiente,
            btuTotalReal,
            unidadesInternasPorAmbiente,
            combinacaoInterna,
            unidadesInternas,
            unidadesInternasPorModelo,
            numUnidadesExternas,
            combinacaoExterna,
            btuTotalExterno,
            custoTotalUnidadesExternas,
            custoTotalUnidadesInternas,
            custoTotal
        };
    }
    
    calcularCustoUnidadeInterna(btu) {
        // Faixas de preço para unidades internas (2025-2026)
        const faixas = [
            { min: 0, max: 7000, preco: 1500 },
            { min: 7001, max: 9000, preco: 1800 },
            { min: 9001, max: 12000, preco: 2200 },
            { min: 12001, max: 18000, preco: 2800 },
            { min: 18001, max: 24000, preco: 3500 },
            { min: 24001, max: 30000, preco: 4200 },
            { min: 30001, max: 36000, preco: 5000 },
            { min: 36001, max: 48000, preco: 6500 },
            { min: 48001, max: 60000, preco: 8000 }
        ];
        
        const faixa = faixas.find(f => btu >= f.min && btu <= f.max);
        return faixa ? faixa.preco : 8000;
    }
    
    calcularCustoUnidadeExterna(btu) {
        // Faixas de preço para unidades externas (2025-2026)
        const faixas = [
            { min: 0, max: 24000, preco: 3000 },
            { min: 24001, max: 36000, preco: 4500 },
            { min: 36001, max: 48000, preco: 6000 },
            { min: 48001, max: 60000, preco: 7500 },
            { min: 60001, max: 84000, preco: 10000 },
            { min: 84001, max: 120000, preco: 15000 },
            { min: 120001, max: 180000, preco: 22000 }
        ];
        
        const faixa = faixas.find(f => btu >= f.min && btu <= f.max);
        return faixa ? faixa.preco : 22000;
    }
    
    // ============================================
    // ATUALIZAÇÃO DE RESULTADOS
    // ============================================
    
    atualizarResultados() {
        const numAmbientes = this.estado.numAmbientes;
        const areaTotal = numAmbientes > 1 ? this.estado.areaTotal : this.estado.area;
        const altura = this.estado.altura;
        const pessoas = this.estado.pessoas;
        const equipamentos = this.estado.equipamentos;
        const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
        const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
        
        const resultado = this.calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento);
        
        // Atualizar display dos resultados
        this.atualizarDisplayResultados(resultado, numAmbientes);
    }
    
    atualizarDisplayResultados(resultado, numAmbientes) {
        // BTU Total
        const elementoBtuTotal = document.getElementById('btuTotalMultisplit');
        if (elementoBtuTotal) {
            elementoBtuTotal.textContent = this.formatarBTU(resultado.btuTotal);
        }
        
        // Unidade Externa
        const elementoUnidadeExterna = document.getElementById('unidadeExternaMultisplit');
        if (elementoUnidadeExterna) {
            if (resultado.numUnidadesExternas > 1) {
                const modelos = resultado.combinacaoExterna.map(m => this.formatarBTU(m));
                elementoUnidadeExterna.textContent = `${resultado.numUnidadesExternas} unidades: ${modelos.join(' + ')}`;
            } else {
                elementoUnidadeExterna.textContent = this.formatarBTU(resultado.combinacaoExterna[0]);
            }
        }
        
        // Unidades Internas
        const elementoUnidadesInternas = document.getElementById('unidadesInternasMultisplit');
        if (elementoUnidadesInternas) {
            const partes = [];
            Object.keys(resultado.unidadesInternasPorModelo).forEach(modelo => {
                const qtd = resultado.unidadesInternasPorModelo[modelo];
                if (qtd > 1) {
                    partes.push(`${qtd} × ${this.formatarBTU(parseInt(modelo))}`);
                } else {
                    partes.push(this.formatarBTU(parseInt(modelo)));
                }
            });
            elementoUnidadesInternas.textContent = partes.join(' + ');
        }
        
        // Custo Sistema
        const elementoCustoSistema = document.getElementById('custoSistemaMultisplit');
        if (elementoCustoSistema) {
            elementoCustoSistema.textContent = this.formatarMoedaComConversao(resultado.custoTotal);
        }
        
        // Detalhamento custos
        const elementoCustoExterna = document.getElementById('custoUnidadeExternaMultisplit');
        if (elementoCustoExterna) {
            elementoCustoExterna.textContent = this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas);
        }
        
        const elementoCustoInternas = document.getElementById('custoUnidadesInternasMultisplit');
        if (elementoCustoInternas) {
            elementoCustoInternas.textContent = this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas);
        }
        
        // Gráficos
        this.atualizarGraficos(resultado, numAmbientes);
    }
    
    atualizarGraficos(resultado, numAmbientes) {
        // Gráfico de Custo (pie chart)
        this.atualizarGraficoCusto(resultado);
        
        // Gráfico de BTU (bar chart)
        this.atualizarGraficoBTU(resultado, numAmbientes);
    }
    
    atualizarGraficoCusto(resultado) {
        const ctx = document.getElementById('graficoCustoArCondicionado');
        if (!ctx) return;
        
        // Destruir gráfico anterior se existir
        if (this.graficoCusto) {
            this.graficoCusto.destroy();
        }
        
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        const labelExterna = idioma === 'pt-BR' ? 'Unidade Externa' : 'Unità Esterna';
        const labelInternas = idioma === 'pt-BR' ? 'Unidades Internas' : 'Unità Interne';
        
        this.graficoCusto = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: [labelExterna, labelInternas],
                datasets: [{
                    data: [resultado.custoTotalUnidadesExternas, resultado.custoTotalUnidadesInternas],
                    backgroundColor: ['#FF6384', '#36A2EB']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    atualizarGraficoBTU(resultado, numAmbientes) {
        const ctx = document.getElementById('graficoBTUArCondicionado');
        if (!ctx) return;
        
        // Destruir gráfico anterior se existir
        if (this.graficoBTU) {
            this.graficoBTU.destroy();
        }
        
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        const labelAmbiente = idioma === 'pt-BR' ? 'Ambiente' : 'Ambiente';
        
        const labels = Array.from({ length: numAmbientes }, (_, i) => `${labelAmbiente} ${i + 1}`);
        const data = Array(numAmbientes).fill(resultado.btuPorAmbiente);
        
        this.graficoBTU = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'BTU',
                    data,
                    backgroundColor: '#4BC0C0'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // ============================================
    // MEMORIAL DE CÁLCULO
    // ============================================
    
    atualizarMemorialComValores() {
        const numAmbientes = this.estado.numAmbientes;
        const areaTotal = numAmbientes > 1 ? this.estado.areaTotal : this.estado.area;
        const altura = this.estado.altura;
        const pessoas = this.estado.pessoas;
        const equipamentos = this.estado.equipamentos;
        const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
        const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
        
        const resultado = this.calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento);
        
        // Calcular valores intermediários
        const volumeTotal = areaTotal * altura;
        const fatorAltura = altura / 2.7;
        const btuAreaTotal = areaTotal * this.getBTUPorM2(isolamento) * fatorAltura;
        const btuPessoasTotal = this.calcularBTUPessoas(pessoas);
        const btuEquipamentosTotal = equipamentos * this.getBTUPorEquipamento();
        const btuBaseTotal = btuAreaTotal + btuPessoasTotal + btuEquipamentosTotal;
        
        const fatorInsolacao = this.getFatorInsolacao(insolacao);
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        const fatorIsolamento = idioma === 'it-IT' ? 1.0 : this.getFatorIsolamento(isolamento);
        const btuFinalTotal = btuBaseTotal * fatorInsolacao * fatorIsolamento;
        
        // Atualizar exemplos no memorial
        const exemploVolume = document.getElementById('memorial-exemplo-volume');
        if (exemploVolume) {
            exemploVolume.textContent = `${formatarNumero(areaTotal, 0)} m² × ${this.formatarDecimal(altura, 1)} m = ${formatarNumero(volumeTotal, 1)} m³`;
        }
        
        const exemploBtuBase = document.getElementById('memorial-exemplo-btu-base');
        if (exemploBtuBase) {
            const textoPessoas = idioma === 'pt-BR' ? 'pessoas' : 'persone';
            const textoEquipamentos = idioma === 'pt-BR' ? 'equipamentos' : 'apparecchi';
            exemploBtuBase.textContent = `${formatarNumero(areaTotal, 1)} m² × ${this.getBTUPorM2(isolamento)} BTU/m² × ${this.formatarDecimal(fatorAltura, 2)} = ${this.formatarBTU(btuAreaTotal)} + ${pessoas} ${textoPessoas} = ${this.formatarBTU(btuPessoasTotal)} + ${equipamentos} ${textoEquipamentos} = ${this.formatarBTU(btuEquipamentosTotal)}`;
        }
        
        const exemploFatores = document.getElementById('memorial-exemplo-fatores');
        if (exemploFatores) {
            exemploFatores.textContent = `${this.formatarBTU(btuBaseTotal)} × ${this.formatarDecimal(fatorInsolacao, 2)} × ${this.formatarDecimal(fatorIsolamento, 2)} = ${this.formatarBTU(btuFinalTotal)}`;
        }
        
        const exemploBtuPorAmbiente = document.getElementById('memorial-exemplo-btu-por-ambiente');
        if (exemploBtuPorAmbiente) {
            const textoAmbientes = idioma === 'pt-BR' ? 'ambientes' : 'ambienti';
            exemploBtuPorAmbiente.textContent = `${this.formatarBTU(btuFinalTotal)} ÷ ${numAmbientes} ${textoAmbientes} = ${this.formatarBTU(resultado.btuPorAmbiente)}`;
        }
        
        // Atualizar resumo
        const resumoVolume = document.getElementById('resumo-volume');
        if (resumoVolume) resumoVolume.textContent = `${formatarNumero(volumeTotal, 1)} m³`;
        
        const resumoBtuBase = document.getElementById('resumo-btu-base');
        if (resumoBtuBase) resumoBtuBase.textContent = this.formatarBTU(btuBaseTotal);
        
        const resumoBtuFinal = document.getElementById('resumo-btu-final-calc');
        if (resumoBtuFinal) resumoBtuFinal.textContent = this.formatarBTU(btuFinalTotal);
        
        const resumoBtuPorAmbiente = document.getElementById('resumo-btu-por-ambiente');
        if (resumoBtuPorAmbiente) resumoBtuPorAmbiente.textContent = this.formatarBTU(resultado.btuPorAmbiente);
        
        const resumoUnidadeInterna = document.getElementById('resumo-unidade-interna');
        if (resumoUnidadeInterna) {
            const partes = [];
            Object.keys(resultado.unidadesInternasPorModelo).forEach(modelo => {
                const qtd = resultado.unidadesInternasPorModelo[modelo];
                partes.push(`${qtd} × ${this.formatarBTU(parseInt(modelo))}`);
            });
            resumoUnidadeInterna.textContent = partes.join(' + ');
        }
        
        const resumoBtuTotalReal = document.getElementById('resumo-btu-total-real');
        if (resumoBtuTotalReal) resumoBtuTotalReal.textContent = this.formatarBTU(resultado.btuTotalReal);
        
        const resumoUnidadeExterna = document.getElementById('resumo-unidade-externa');
        if (resumoUnidadeExterna) {
            const modelos = resultado.combinacaoExterna.map(m => this.formatarBTU(m));
            resumoUnidadeExterna.textContent = modelos.join(' + ');
        }
        
        const resumoCustoTotal = document.getElementById('resumo-custo-total');
        if (resumoCustoTotal) resumoCustoTotal.textContent = this.formatarMoedaComConversao(resultado.custoTotal);
    }
    
    // ============================================
    // FUNÇÕES DE FORMATAÇÃO
    // ============================================
    
    formatarBTU(valor) {
        if (isNaN(valor)) return '0 BTU';
        return `${Math.round(valor).toLocaleString('pt-BR')} BTU`;
    }
    
    formatarMoedaComConversao(valor) {
        const idioma = localStorage.getItem('idiomaPreferido') || 'pt-BR';
        
        if (idioma === 'it-IT') {
            const valorEUR = valor / this.TAXA_BRL_EUR;
            return formatarMoeda(valorEUR, 'EUR', 0);
        } else {
            return formatarMoeda(valor, 'BRL', 0);
        }
    }
    
    formatarDecimal(valor, decimais = 1) {
        if (isNaN(valor)) return '0';
        return valor.toFixed(decimais).replace('.', ',');
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ Arcondicionado: DOM carregado, inicializando...');
        const app = new ArcondicionadoApp();
        app.inicializar();
    });
} else {
    console.log('✅ Arcondicionado: DOM já carregado, inicializando imediatamente...');
    const app = new ArcondicionadoApp();
    app.inicializar();
}
