/**
 * arcondicionado-script-new.js
 * Dimensionador de Ar Condicionado - Versão Modular
 * 
 * Cálculo de BTU para sistemas multi-split residenciais
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';

// ============================================
// CLASSE PRINCIPAL
// ============================================

class ArcondicionadoApp extends App {
        atualizarValoresRadiosPorIdioma() {
            const idioma = this.obterIdiomaAtual();

            // Insolação
            const radiosInsolacao = document.querySelectorAll('input[name="insolacao"]');
            const VALORES_INSOLACAO = {
                'pt-BR': ['baixa', 'media', 'alta'],
                'it-IT': ['bassa', 'media', 'alta'],
                'sv-SE': ['lag', 'medel', 'hog']
            };
            const valoresInsolacao = VALORES_INSOLACAO[idioma] || VALORES_INSOLACAO['it-IT'];
            radiosInsolacao.forEach((radio, idx) => {
                radio.value = valoresInsolacao[idx];
            });
            if (radiosInsolacao.length > 0 && !Array.from(radiosInsolacao).some(r => r.checked)) {
                radiosInsolacao[0].checked = true;
            }

            // Isolamento
            const radiosIsolamento = document.querySelectorAll('input[name="isolamento"]');
            const VALORES_ISOLAMENTO = {
                'pt-BR': ['ruim', 'medio', 'bom'],
                'it-IT': ['scarso', 'medio', 'buono'],
                'sv-SE': ['daligt', 'medel', 'bra']
            };
            const valoresIsolamento = VALORES_ISOLAMENTO[idioma] || VALORES_ISOLAMENTO['it-IT'];
            radiosIsolamento.forEach((radio, idx) => {
                radio.value = valoresIsolamento[idx];
            });
            if (radiosIsolamento.length > 0 && !Array.from(radiosIsolamento).some(r => r.checked)) {
                radiosIsolamento[0].checked = true;
            }

            // Dispara cálculo imediatamente
            this.atualizarResultados();
        }
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
            isolamento: 'medio',
            classeEnergetica: 'D',
            valorClasseEnergetica: 1.75
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
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    inicializarArcondicionado() {
        this.configurarEventos();
        this.configurarClasseEnergetica();
        this.configurarBotoesIncremento();
        this.configurarInputsTexto();
        this.configurarInfoIcons();
        this.configurarMemorial();
        this.configurarVisibilidadeInicial();
        this.atualizarValoresRadiosPorIdioma();
        // Recalcula e atualiza resultados ao entrar no app
        this.forcarRecalculoResultados();
    }

    configurarClasseEnergetica() {
        const boxes = document.querySelectorAll('.classe-box');
        const selecionadoInicial = document.querySelector('.classe-box-selected');

        if (selecionadoInicial) {
            this.estado.classeEnergetica = selecionadoInicial.getAttribute('data-classe') || this.estado.classeEnergetica;
            this.estado.valorClasseEnergetica = parseFloat(selecionadoInicial.getAttribute('data-valor')) || this.estado.valorClasseEnergetica;
        }

        boxes.forEach(box => {
            box.setAttribute('tabindex', '0');
            box.setAttribute('role', 'radio');
            box.setAttribute('aria-label', `${box.getAttribute('data-classe')} - ${box.getAttribute('title')}`);
            if (box.dataset.classeConfigurada === 'true') return;

            box.dataset.classeConfigurada = 'true';
            box.addEventListener('click', () => {
                boxes.forEach(b => b.classList.remove('classe-box-selected'));
                box.classList.add('classe-box-selected');
                this.estado.classeEnergetica = box.getAttribute('data-classe');
                this.estado.valorClasseEnergetica = parseFloat(box.getAttribute('data-valor'));
                const inputClasse = document.getElementById('inputClasseEnergetica');
                if (inputClasse) inputClasse.value = this.estado.valorClasseEnergetica;
                this.atualizarAtributosClasseEnergetica(boxes);
                this.atualizarResultados();
            });
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    box.click();
                }
            });
        });
        this.atualizarAtributosClasseEnergetica(boxes);
    }

    atualizarAtributosClasseEnergetica(boxes = document.querySelectorAll('.classe-box')) {
        boxes.forEach(box => {
            const selecionado = box.classList.contains('classe-box-selected');
            box.setAttribute('aria-checked', selecionado ? 'true' : 'false');
        });
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
                slider.addEventListener('input', () => this.aoMudarSlider(id));
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
        
        // Aguarda 300ms antes de iniciar animação contínua
        this.estadoBotoes.delayTimeout = setTimeout(() => {
            if (this.estadoBotoes.estaSegurando) {
                // Captura valor inicial DEPOIS do primeiro incremento
                this.estadoBotoes.valorInicial = parseFloat(slider.value);
                this.estadoBotoes.tempoInicio = performance.now();
                this.estadoBotoes.animationId = requestAnimationFrame((timestamp) => this.animarIncremento(timestamp));
            }
        }, 300);
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
            
            // Aplicar valor ao perder foco
            input.addEventListener('blur', () => {
                this.aplicarValorInput(input, slider);
            });
            
            // Aplicar valor ao pressionar Enter
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.aplicarValorInput(input, slider);
                    input.blur();
                }
            });
        });
    }
    
    aplicarValorInput(input, slider) {
        let valor = input.value.trim().toUpperCase();
        
        // Remove caracteres não numéricos exceto ponto e vírgula
        valor = valor.replace(/[^0-9.,KM]/g, '');
        
        // Substitui vírgula por ponto
        valor = valor.replace(',', '.');
        
        // Converte sufixos k/m
        if (valor.endsWith('K')) {
            valor = parseFloat(valor.slice(0, -1)) * 1000;
        } else if (valor.endsWith('M')) {
            valor = parseFloat(valor.slice(0, -1)) * 1000000;
        } else {
            valor = parseFloat(valor);
        }
        
        if (isNaN(valor)) {
            // Se inválido, restaura valor do slider
            valor = parseFloat(slider.value);
        }
        
        // Aplica limites do slider
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        valor = Math.max(min, Math.min(max, valor));
        
        // Atualiza slider e input
        slider.value = valor;
        this.aoMudarSlider(slider.id);
    }
    
    configurarInfoIcons() {
        const infoIcons = document.querySelectorAll('.info-icon');
        infoIcons.forEach(icon => {
            const alternarDescricao = (e) => {
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
            };

            icon.addEventListener('click', alternarDescricao);
            icon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    alternarDescricao(e);
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
        
        const valor = parseFloat(slider.value);
        
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
        // Atualiza valores dos radios para o idioma correto
        this.atualizarValoresRadiosPorIdioma();
        // Força atualização completa ao trocar idioma
        this.forcarRecalculoResultados();
        // Atualiza memorial se estiver visível
        const memorialSection = document.getElementById('memorialSection');
        if (memorialSection && memorialSection.style.display === 'block') {
            this.atualizarMemorialComValores();
        }
    }

    forcarRecalculoResultados() {
        // Atualiza todos os campos dependentes do idioma
        this.atualizarResultados();
        // Atualiza inputs para refletir possíveis mudanças de formato
        const sliders = ['sliderNumAmbientes', 'sliderAreaTotal', 'sliderArea', 'sliderAltura', 'sliderPessoas', 'sliderEquipamentos'];
        sliders.forEach(id => {
            this.aoMudarSlider(id);
        });
    }
    
    // ============================================
    // FUNÇÕES DE CÁLCULO BTU
    // ============================================

    obterIdiomaAtual() {
        return i18n.obterIdiomaAtual();
    }
    
    getBTUPorM2(isolamento = 'medio') {
        const idioma = this.obterIdiomaAtual();
        // Itália e Suécia embutem o isolamento no próprio BTU/m²; o Brasil
        // aplica um fator à parte. Os valores suecos são os mais baixos: verão
        // curto e ameno, e envolvente bem isolada pelas exigências do BBR.
        const BTU_POR_M2 = {
            'it-IT': { buono: 300, medio: 340, scarso: 400, padrao: 340 },
            'sv-SE': { bra: 250, medel: 290, daligt: 340, padrao: 290 }
        };
        const tabela = BTU_POR_M2[idioma];
        if (tabela) {
            return tabela[isolamento] ?? tabela.padrao;
        }
        return 700;
    }
    
    getBTUPorPessoa() {
        return i18n.porIdioma({ 'pt-BR': 600, 'it-IT': 200, 'sv-SE': 200 });
    }
    
    calcularBTUPessoas(pessoas) {
        // Só a prática brasileira isenta as duas primeiras pessoas.
        const isentas = i18n.porIdioma({ 'pt-BR': 2, 'it-IT': 0, 'sv-SE': 0 });
        return Math.max(0, pessoas - isentas) * this.getBTUPorPessoa();
    }
    
    getBTUPorEquipamento() {
        return i18n.porIdioma({ 'pt-BR': 600, 'it-IT': 300, 'sv-SE': 300 });
    }
    
    getFatorInsolacao(nivel) {
        const FATORES_INSOLACAO = {
            'pt-BR': { baixa: 1.0, media: 1.15, alta: 1.3 },
            'it-IT': { bassa: 0.9, media: 1.0, alta: 1.2 },
            'sv-SE': { lag: 0.9, medel: 1.0, hog: 1.15 }
        };
        const fatores = FATORES_INSOLACAO[this.obterIdiomaAtual()] || FATORES_INSOLACAO['it-IT'];
        return fatores[nivel] || 1.0;
    }
    
    getFatorIsolamento(nivel) {
        // Na Itália e na Suécia o isolamento já entra no BTU/m², então aqui
        // vale 1; só o Brasil aplica um fator separado.
        if (this.obterIdiomaAtual() !== 'pt-BR') {
            return 1.0;
        }
        const fatores = { bom: 0.8, medio: 1.0, ruim: 1.2 };
        return fatores[nivel] || 1.0;
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
        const fatorIsolamento = this.getFatorIsolamento(isolamento);
        // Fator classe energética: quanto maior o valor, maior a perda (multiplicador)
        const fatorClasseEnergetica = this.estado.valorClasseEnergetica || 1.75;
        // O fator pode ser aplicado como multiplicador final
        const btuFinalTotal = btuBaseTotal * fatorInsolacao * fatorIsolamento * fatorClasseEnergetica;
        
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
            custoTotal,
            fatorClasseEnergetica
        };
    }
    
    calcularCustoUnidadeInterna(btu) {
        // Faixas de preço para unidades internas (2025-2026)
        const idioma = this.obterIdiomaAtual();
        const FAIXAS_INTERNA = {
            'pt-BR': [
                { min: 0, max: 7000, preco: 700 },
                { min: 7001, max: 9000, preco: 850 },
                { min: 9001, max: 12000, preco: 1050 },
                { min: 12001, max: 18000, preco: 1400 },
                { min: 18001, max: 24000, preco: 1850 },
                { min: 24001, max: 30000, preco: 2300 },
                { min: 30001, max: 36000, preco: 2800 },
                { min: 36001, max: 48000, preco: 3600 },
                { min: 48001, max: 60000, preco: 4500 }
            ],
            'it-IT': [
                { min: 0, max: 9000, preco: 220 },
                { min: 9001, max: 12000, preco: 280 },
                { min: 12001, max: 18000, preco: 360 },
                { min: 18001, max: 24000, preco: 460 },
                { min: 24001, max: 30000, preco: 560 },
                { min: 30001, max: 36000, preco: 680 },
                { min: 36001, max: 48000, preco: 860 },
                { min: 48001, max: 60000, preco: 1050 },
                { min: 60001, max: 120000, preco: 1900 },
                { min: 120001, max: 180000, preco: 2600 }
            ],
            'sv-SE': [
                { min: 0, max: 9000, preco: 3000 },
                { min: 9001, max: 12000, preco: 3800 },
                { min: 12001, max: 18000, preco: 4800 },
                { min: 18001, max: 24000, preco: 6200 },
                { min: 24001, max: 30000, preco: 7500 },
                { min: 30001, max: 36000, preco: 9000 },
                { min: 36001, max: 48000, preco: 11500 },
                { min: 48001, max: 60000, preco: 14000 },
                { min: 60001, max: 120000, preco: 25000 },
                { min: 120001, max: 180000, preco: 35000 }
            ]
        };
        const faixas = FAIXAS_INTERNA[idioma] || FAIXAS_INTERNA['it-IT'];
        const faixa = faixas.find(f => btu >= f.min && btu <= f.max);
        return faixa ? faixa.preco : faixas[faixas.length - 1].preco;
    }
    
    calcularCustoUnidadeExterna(btu) {
        // Faixas de preço para unidades externas (2025-2026)
        const idioma = this.obterIdiomaAtual();
        const FAIXAS_EXTERNA = {
            'pt-BR': [
                { min: 0, max: 24000, preco: 1500 },
                { min: 24001, max: 36000, preco: 2600 },
                { min: 36001, max: 48000, preco: 3600 },
                { min: 48001, max: 60000, preco: 4800 },
                { min: 60001, max: 84000, preco: 7000 },
                { min: 84001, max: 120000, preco: 9800 },
                { min: 120001, max: 180000, preco: 14000 }
            ],
            'it-IT': [
                { min: 0, max: 24000, preco: 260 },
                { min: 24001, max: 36000, preco: 380 },
                { min: 36001, max: 48000, preco: 520 },
                { min: 48001, max: 60000, preco: 680 },
                { min: 60001, max: 84000, preco: 980 },
                { min: 84001, max: 120000, preco: 1400 },
                { min: 120001, max: 180000, preco: 2100 }
            ],
            'sv-SE': [
                { min: 0, max: 24000, preco: 3500 },
                { min: 24001, max: 36000, preco: 5000 },
                { min: 36001, max: 48000, preco: 7000 },
                { min: 48001, max: 60000, preco: 9000 },
                { min: 60001, max: 84000, preco: 13000 },
                { min: 84001, max: 120000, preco: 18500 },
                { min: 120001, max: 180000, preco: 28000 }
            ]
        };
        const faixas = FAIXAS_EXTERNA[idioma] || FAIXAS_EXTERNA['it-IT'];
        const faixa = faixas.find(f => btu >= f.min && btu <= f.max);
        return faixa ? faixa.preco : faixas[faixas.length - 1].preco;
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

        this.renderizarExplicacao(resultado, numAmbientes);
    }

    renderizarExplicacao(resultado, numAmbientes) {
        const tc = mapa => i18n.porIdioma(mapa);
        const capacidadeExterna = resultado.combinacaoExterna.reduce((soma, btu) => soma + btu, 0);
        const folga = capacidadeExterna - resultado.btuTotal;

        this.explicacao.renderizar({
            destaque: tc({
                'pt-BR': `Sistema multi-split recomendado para ${numAmbientes} ambiente(s), com carga térmica de ${this.formatarBTU(resultado.btuTotal)}.`,
                'it-IT': `Sistema multi-split consigliato per ${numAmbientes} ambiente/i, con carico termico di ${this.formatarBTU(resultado.btuTotal)}.`,
                'sv-SE': `Rekommenderat multisplitsystem för ${numAmbientes} rum, med en värmelast på ${this.formatarBTU(resultado.btuTotal)}.`
            }),
            linhas: [
                {
                    icone: '❄️',
                    titulo: tc({ 'pt-BR': 'BTU Necessário', 'it-IT': 'BTU Necessario', 'sv-SE': 'Nödvändig BTU' }),
                    valor: this.formatarBTU(resultado.btuTotal),
                    descricao: tc({
                        'pt-BR': 'Carga térmica calculada com área, altura, pessoas, equipamentos, insolação, isolamento e classe energética.',
                        'it-IT': 'Carico termico calcolato con area, altezza, persone, apparecchi, insolazione, isolamento e classe energetica.',
                        'sv-SE': 'Värmelast beräknad utifrån yta, takhöjd, personer, apparater, solinstrålning, isolering och energiklass.'
                    })
                },
                {
                    icone: '🏢',
                    titulo: tc({ 'pt-BR': 'Unidade Externa', 'it-IT': 'Unita Esterna', 'sv-SE': 'Utomhusdel' }),
                    valor: `${resultado.numUnidadesExternas} unidade(s)`,
                    descricao: tc({
                        'pt-BR': `Capacidade instalada: ${this.formatarBTU(capacidadeExterna)} (folga: ${this.formatarBTU(Math.max(folga, 0))}).`,
                        'it-IT': `Capacita installata: ${this.formatarBTU(capacidadeExterna)} (margine: ${this.formatarBTU(Math.max(folga, 0))}).`,
                        'sv-SE': `Installerad kapacitet: ${this.formatarBTU(capacidadeExterna)} (marginal: ${this.formatarBTU(Math.max(folga, 0))}).`
                    })
                },
                {
                    icone: '🧩',
                    titulo: tc({ 'pt-BR': 'Unidades Internas', 'it-IT': 'Unita Interne', 'sv-SE': 'Inomhusdelar' }),
                    valor: Object.values(resultado.unidadesInternasPorModelo).reduce((s, n) => s + n, 0).toString(),
                    descricao: tc({
                        'pt-BR': 'Distribuição das evaporadoras por ambiente para equilibrar conforto e eficiência.',
                        'it-IT': 'Distribuzione delle evaporatrici per ambiente per bilanciare comfort ed efficienza.',
                        'sv-SE': 'Fördelning av inomhusdelarna per rum för att väga av komfort mot verkningsgrad.'
                    })
                },
                {
                    icone: '💰',
                    titulo: tc({ 'pt-BR': 'Custo do Sistema', 'it-IT': 'Costo del Sistema', 'sv-SE': 'Systemets kostnad' }),
                    valor: this.formatarMoedaComConversao(resultado.custoTotal),
                    descricao: tc({
                        'pt-BR': `Externa: ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas)} | Internas: ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas)}.`,
                        'it-IT': `Esterna: ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas)} | Interne: ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas)}.`,
                        'sv-SE': `Utomhusdel: ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas)} | Inomhusdelar: ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas)}.`
                    })
                }
            ],
            dica: tc({
                'pt-BR': 'Pé-direito alto e insolação forte elevam BTU. Melhor isolamento reduz consumo elétrico ao longo do tempo.',
                'it-IT': 'Altezza elevata e alta insolazione aumentano i BTU. Migliore isolamento riduce i consumi elettrici nel tempo.',
                'sv-SE': 'Hög takhöjd och stark solinstrålning drar upp BTU. I Sverige är kylbehovet litet — en luftvärmepump som både värmer och kyler är oftast rimligare än ren komfortkyla.'
            }),
            norma: tc({
                'pt-BR': 'Método residencial simplificado (ASHRAE / boas práticas HVAC)',
                'it-IT': 'Metodo residenziale semplificato (ASHRAE / buone pratiche HVAC)',
                'sv-SE': 'Förenklad metod för bostäder (ASHRAE / god praxis inom HVAC), med Boverkets byggregler som ram'
            })
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
        const idioma = this.obterIdiomaAtual();
        const fatorIsolamento = this.getFatorIsolamento(isolamento);
        const fatorClasseEnergetica = resultado.fatorClasseEnergetica;
        const btuFinalTotal = resultado.btuTotal;
        const classeEnergetica = this.estado.classeEnergetica || 'D';
        
        // Atualizar exemplos no memorial
        const exemploVolume = document.getElementById('memorial-exemplo-volume');
        if (exemploVolume) {
            exemploVolume.textContent = `${formatarNumero(areaTotal, 0)} m² × ${this.formatarDecimal(altura, 1)} m = ${formatarNumero(volumeTotal, 1)} m³`;
        }
        
        const exemploBtuBase = document.getElementById('memorial-exemplo-btu-base');
        if (exemploBtuBase) {
            const textoPessoas = i18n.porIdioma({ 'pt-BR': 'pessoas', 'it-IT': 'persone', 'sv-SE': 'personer' });
            const textoEquipamentos = i18n.porIdioma({ 'pt-BR': 'equipamentos', 'it-IT': 'apparecchi', 'sv-SE': 'apparater' });
            exemploBtuBase.textContent = `${formatarNumero(areaTotal, 1)} m² × ${this.getBTUPorM2(isolamento)} BTU/m² × ${this.formatarDecimal(fatorAltura, 2)} = ${this.formatarBTU(btuAreaTotal)} + ${pessoas} ${textoPessoas} = ${this.formatarBTU(btuPessoasTotal)} + ${equipamentos} ${textoEquipamentos} = ${this.formatarBTU(btuEquipamentosTotal)}`;
        }
        
        const exemploFatores = document.getElementById('memorial-exemplo-fatores');
        if (exemploFatores) {
            exemploFatores.textContent = `${this.formatarBTU(btuBaseTotal)} × ${this.formatarDecimal(fatorInsolacao, 2)} × ${this.formatarDecimal(fatorIsolamento, 2)} × ${this.formatarDecimal(fatorClasseEnergetica, 2)} (${classeEnergetica}) = ${this.formatarBTU(btuFinalTotal)}`;
        }
        
        const exemploBtuPorAmbiente = document.getElementById('memorial-exemplo-btu-por-ambiente');
        if (exemploBtuPorAmbiente) {
            const textoAmbientes = i18n.porIdioma({ 'pt-BR': 'ambientes', 'it-IT': 'ambienti', 'sv-SE': 'rum' });
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

        const exemploModelo = document.getElementById('memorial-exemplo-modelo');
        if (exemploModelo) {
            const modelosInternos = Object.keys(resultado.unidadesInternasPorModelo)
                .map(modelo => {
                    const qtd = resultado.unidadesInternasPorModelo[modelo];
                    return `${qtd} × ${this.formatarBTU(parseInt(modelo))}`;
                })
                .join(' + ');
            const modelosExternos = resultado.combinacaoExterna.map(m => this.formatarBTU(m)).join(' + ');
            exemploModelo.textContent = i18n.porIdioma({
                'pt-BR': `${this.formatarBTU(resultado.btuPorAmbiente)} por ambiente → internas: ${modelosInternos}. BTU total real: ${this.formatarBTU(resultado.btuTotalReal)}. Externa: ${modelosExternos}.`,
                'it-IT': `${this.formatarBTU(resultado.btuPorAmbiente)} per ambiente → interne: ${modelosInternos}. BTU totale reale: ${this.formatarBTU(resultado.btuTotalReal)}. Esterna: ${modelosExternos}.`,
                'sv-SE': `${this.formatarBTU(resultado.btuPorAmbiente)} per rum → inomhusdelar: ${modelosInternos}. Verklig total BTU: ${this.formatarBTU(resultado.btuTotalReal)}. Utomhusdel: ${modelosExternos}.`
            });
        }
        
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

        const exemploCusto = document.getElementById('memorial-exemplo-custo');
        if (exemploCusto) {
            exemploCusto.textContent = i18n.porIdioma({
                'pt-BR': `${this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas)} (externa) + ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas)} (internas) = ${this.formatarMoedaComConversao(resultado.custoTotal)}`,
                'it-IT': `${this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas)} (esterna) + ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas)} (interne) = ${this.formatarMoedaComConversao(resultado.custoTotal)}`,
                'sv-SE': `${this.formatarMoedaComConversao(resultado.custoTotalUnidadesExternas)} (utomhusdel) + ${this.formatarMoedaComConversao(resultado.custoTotalUnidadesInternas)} (inomhusdelar) = ${this.formatarMoedaComConversao(resultado.custoTotal)}`
            });
        }
    }
    
    // ============================================
    // FUNÇÕES DE FORMATAÇÃO
    // ============================================
    
    formatarBTU(valor) {
        if (isNaN(valor)) return '0 BTU';
        return `${Math.round(valor).toLocaleString('pt-BR')} BTU`;
    }
    
    formatarMoedaComConversao(valor) {
        const idioma = this.obterIdiomaAtual();
        const simbolo = i18n.porIdioma({ 'pt-BR': 'R$', 'it-IT': '€', 'sv-SE': 'kr' });
        return `${simbolo} ${Math.round(valor).toLocaleString(idioma)}`;
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
        const app = new ArcondicionadoApp();
        app.inicializar();
    });
} else {
    const app = new ArcondicionadoApp();
    app.inicializar();
}
