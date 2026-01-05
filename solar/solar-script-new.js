/**
 * solar-script-new.js
 * Dimensionador de Sistema Fotovoltaico Off-Grid - Versão Modular
 * Versão: 1.0.0
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { configurarInputComSlider, obterValorReal, limparValorReal } from '../src/utils/input-handlers.js';

// ============================================
// CONSTANTES DO SISTEMA
// ============================================

const HSP = 5.0; // Horas de Sol Pleno (média conservadora)
const EFICIENCIA_SISTEMA = 0.80; // Eficiência global (80% = perdas de 20%)
const FATOR_PICO_CONSUMO = 5.0; // Fator de pico (5x o consumo médio horário)
const TAXA_BRL_EUR = 6.19;

// Valores padrão dos componentes
const VALORES_PADRAO = {
    potenciaPainel: 400,
    precoPainel: 1200,
    tensaoAGM: 12,
    capacidadeAGM: 1.2,   // kWh
    precoAGM: 420,
    pesoAGM: 30,
    tensaoLitio: 48,
    capacidadeLitio: 4.8, // kWh
    precoLitio: 12000,
    pesoLitio: 60
};

// Tabelas de ciclos vs DoD
const CICLOS_AGM = [
    {dod: 25, c: 1500}, {dod: 30, c: 1310}, {dod: 35, c: 1001}, {dod: 40, c: 785},
    {dod: 45, c: 645}, {dod: 50, c: 698}, {dod: 55, c: 614}, {dod: 60, c: 545},
    {dod: 65, c: 486}, {dod: 70, c: 437}, {dod: 75, c: 395}, {dod: 80, c: 358},
    {dod: 85, c: 340}, {dod: 90, c: 315}, {dod: 95, c: 293}
];

const CICLOS_LITIO = [
    {dod: 25, c: 10000}, {dod: 30, c: 9581}, {dod: 35, c: 7664}, {dod: 40, c: 6233},
    {dod: 45, c: 5090}, {dod: 50, c: 5090}, {dod: 55, c: 4505}, {dod: 60, c: 4005},
    {dod: 65, c: 3606}, {dod: 70, c: 3277}, {dod: 75, c: 3000}, {dod: 80, c: 2758},
    {dod: 85, c: 2581}, {dod: 90, c: 2399}, {dod: 95, c: 2239}
];

// Preços de inversores com MPPT integrado
const PRECOS_INVERSOR_BRL = [
    { kw: 1, preco: 1800, mpptA: 40 },
    { kw: 2, preco: 2800, mpptA: 60 },
    { kw: 3, preco: 3800, mpptA: 80 },
    { kw: 5, preco: 5500, mpptA: 100 },
    { kw: 6, preco: 6500, mpptA: 120 }
];

const PRECOS_INVERSOR_EUR = PRECOS_INVERSOR_BRL.map(item => ({
    kw: item.kw,
    preco: Math.round(item.preco / TAXA_BRL_EUR),
    mpptA: item.mpptA
}));

// ============================================
// CLASSE PRINCIPAL
// ============================================

class SolarApp extends App {
    constructor() {
        super({
            appName: 'solar',
            callbacks: {
                aoInicializar: () => this.inicializarSolar(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        
        // Estado do aplicativo
        this.estado = {
            consumoMensal: 200,
            diasAutonomia: 1,
            vidaUtil: 20,
            tipoBateria: 'litio'
        };
        
        // Configuração de cálculos (pode ser customizada via localStorage)
        this.configCalculo = this.obterConfig();
        
        // Gráficos
        this.graficos = {
            barras: null,
            pizza: null
        };
        
        // Estado dos botões de incremento
        this.estadoBotoes = {
            estaSegurando: false,
            animationId: null,
            targetId: null,
            step: 0,
            tempoInicio: null,
            valorInicial: null,
            delayTimeout: null
        };
    }
    
    // ============================================
    // CONFIGURAÇÃO
    // ============================================
    
    obterConfig() {
        const configSalva = localStorage.getItem('configSolar');
        return configSalva ? JSON.parse(configSalva) : VALORES_PADRAO;
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    inicializarSolar() {
        console.log('🔧 Iniciando Solar...');
        
        try {
            this.configurarEventos();
            console.log('✅ Eventos configurados');
            
            this.configurarBotoesIncremento();
            console.log('✅ Botões incremento configurados');
            
            this.configurarInputsTexto();
            console.log('✅ Inputs texto configurados');
            
            this.configurarMemorial();
            console.log('✅ Memorial configurado');
            
            this.atualizarLimitesVidaUtil();
            console.log('✅ Limites vida útil atualizados');
            
            this.atualizarResultados();
            console.log('✅ Resultados atualizados');
            
            this.inicializarGraficos();
            console.log('✅ Gráficos inicializados');
            
            console.log('✅ Solar inicializado com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao inicializar Solar:', error);
        }
    }
    
    // ============================================
    // CONFIGURAÇÃO DE EVENTOS
    // ============================================
    
    configurarEventos() {
        // Sliders
        const sliders = ['sliderConsumo', 'sliderAutonomia', 'sliderVidaUtil'];
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', () => {
                    const inputId = id.replace('slider', 'input');
                    const input = document.getElementById(inputId);
                    
                    // Limpar valorReal e atualizar input
                    limparValorReal(input);
                    if (input) {
                        input.value = Math.round(slider.value);
                    }
                    
                    this.atualizarResultados();
                });
            }
        });
        
        // Radio buttons de tipo de bateria
        const radiosBateria = document.querySelectorAll('input[name="tipoBateria"]');
        radiosBateria.forEach(radio => {
            radio.addEventListener('change', () => {
                this.estado.tipoBateria = radio.value;
                this.atualizarLimitesVidaUtil();
                this.atualizarResultados();
            });
        });
        
        // Botões de memorial
        const btnMemorial = document.getElementById('btnMemorial');
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        const btnVoltarMemorial = document.querySelector('.btn-voltar-memorial');
        const memorialSection = document.getElementById('memorialSection');
        
        if (btnMemorial && memorialSection) {
            btnMemorial.addEventListener('click', () => {
                memorialSection.style.display = 'block';
                this.atualizarMemorial();
                memorialSection.scrollIntoView({ behavior: 'smooth' });
            });
        }
        
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => {
                if (memorialSection) memorialSection.style.display = 'none';
            });
        }
        
        if (btnVoltarMemorial) {
            btnVoltarMemorial.addEventListener('click', () => {
                if (memorialSection) memorialSection.style.display = 'none';
            });
        }
        
        // Info icons
        this.configurarInfoIcons();
    }
    
    configurarInfoIcons() {
        const infoIcons = [
            { iconId: 'infoIconConsumo', descId: 'descricaoConsumo' },
            { iconId: 'infoIconAutonomia', descId: 'descricaoAutonomia' },
            { iconId: 'infoIconVidaUtil', descId: 'descricaoVidaUtil' }
        ];
        
        infoIcons.forEach(({ iconId, descId }) => {
            const icon = document.getElementById(iconId);
            const desc = document.getElementById(descId);
            
            if (icon && desc) {
                icon.addEventListener('click', () => {
                    const isVisible = desc.style.display !== 'none';
                    desc.style.display = isVisible ? 'none' : 'block';
                });
            }
        });
    }
    
    atualizarLimitesVidaUtil() {
        const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked')?.value || 'litio';
        const sliderVidaUtil = document.getElementById('sliderVidaUtil');
        
        if (sliderVidaUtil) {
            if (tipoBateria === 'litio') {
                sliderVidaUtil.min = 5;
                sliderVidaUtil.max = 25;
                sliderVidaUtil.value = Math.min(Math.max(sliderVidaUtil.value, 5), 25);
            } else {
                sliderVidaUtil.min = 1;
                sliderVidaUtil.max = 5;
                sliderVidaUtil.value = Math.min(Math.max(sliderVidaUtil.value, 1), 5);
            }
        }
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
        
        // Primeiro incremento imediato
        this.ajustarValor(targetId, step);
        
        // Aguarda 500ms antes de iniciar animação contínua
        this.estadoBotoes.delayTimeout = setTimeout(() => {
            if (this.estadoBotoes.estaSegurando) {
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
        
        const velocidade = range / 3000;
        const distanciaPercorrida = velocidade * tempoDecorrido;
        
        let novoValor = valorInicial + (step > 0 ? distanciaPercorrida : -distanciaPercorrida);
        novoValor = Math.max(min, Math.min(max, novoValor));
        
        const stepSlider = parseFloat(slider.step) || 1;
        novoValor = Math.round(novoValor / stepSlider) * stepSlider;
        
        const valorAtual = parseFloat(slider.value);
        if (Math.abs(novoValor - valorAtual) >= stepSlider / 2) {
            slider.value = novoValor;
            this.atualizarResultados();
        }
        
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
        this.atualizarResultados();
    }
    
    configurarInputsTexto() {
        const inputs = [
            { id: 'inputConsumo', sliderId: 'sliderConsumo' },
            { id: 'inputAutonomia', sliderId: 'sliderAutonomia' },
            { id: 'inputVidaUtil', sliderId: 'sliderVidaUtil' }
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
    
    configurarMemorial() {
        // Memorial será atualizado dinamicamente quando aberto
    }
    
    atualizarMemorial() {
        const resultado = this.calcularSistemaFotovoltaico();
        const moeda = i18n.idioma === 'pt-BR' ? 'R$' : '€';
        
        // Atualizar exemplos do memorial
        const exemploDiaria = document.getElementById('memorial-exemplo-energia-diaria');
        if (exemploDiaria) {
            const consumoMensal = parseFloat(document.getElementById('sliderConsumo')?.value || 200);
            exemploDiaria.textContent = `Consumo de ${consumoMensal} kWh/mês → ${consumoMensal} ÷ 30 = ${formatarNumero(resultado.energiaDiaria, 1)} kWh/dia`;
        }
        
        const exemploDoD = document.getElementById('memorial-exemplo-dod');
        if (exemploDoD) {
            const vidaUtil = parseFloat(document.getElementById('sliderVidaUtil')?.value || 20);
            const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked')?.value || 'litio';
            const ciclos = vidaUtil * 365;
            const tipoBateriaTexto = tipoBateria === 'litio' ? 'LiFePO4' : 'AGM';
            exemploDoD.textContent = `Vida útil de ${vidaUtil} anos → ${vidaUtil} × 365 = ${ciclos} ciclos → DoD ≈ ${formatarNumero(resultado.dod, 0)}% (${tipoBateriaTexto})`;
        }
        
        const exemploCapacidade = document.getElementById('memorial-exemplo-capacidade');
        if (exemploCapacidade) {
            const diasAutonomia = parseFloat(document.getElementById('sliderAutonomia')?.value || 1);
            const capacidadeVidaUtil = resultado.energiaDiaria / (resultado.dod / 100);
            const capacidadeAutonomia = (resultado.energiaDiaria * diasAutonomia) / (resultado.dod / 100);
            exemploCapacidade.textContent = `${formatarNumero(resultado.energiaDiaria, 1)} kWh/dia, DoD ${formatarNumero(resultado.dod, 0)}%, ${diasAutonomia} dias autonomia → Máximo(${formatarNumero(capacidadeVidaUtil, 1)} kWh, ${formatarNumero(capacidadeAutonomia, 1)} kWh) = ${formatarNumero(resultado.capacidadeNecessaria, 1)} kWh`;
        }
        
        const exemploBaterias = document.getElementById('memorial-exemplo-baterias');
        if (exemploBaterias) {
            const capacidadePorBateria = resultado.capacidadeReal / resultado.numBaterias;
            exemploBaterias.textContent = `${formatarNumero(resultado.capacidadeNecessaria, 1)} kWh necessários, baterias de ${formatarNumero(capacidadePorBateria, 1)} kWh → ${formatarNumero(resultado.capacidadeNecessaria / capacidadePorBateria, 1)} → ${resultado.numBaterias} baterias → ${resultado.numBaterias}×${formatarNumero(capacidadePorBateria, 1)} = ${formatarNumero(resultado.capacidadeReal, 1)} kWh instalados → ${formatarNumero(resultado.capacidadeReal, 1)}×${formatarNumero(resultado.dod / 100, 2)} = ${formatarNumero(resultado.energiaUtilizavel, 1)} kWh utilizáveis`;
        }
        
        const exemploPaineis = document.getElementById('memorial-exemplo-paineis');
        if (exemploPaineis) {
            const energiaAGerar = resultado.energiaUtilizavel / EFICIENCIA_SISTEMA;
            const potenciaNecessaria = (energiaAGerar * 1000) / HSP;
            exemploPaineis.textContent = `${formatarNumero(resultado.energiaUtilizavel, 1)} kWh utilizáveis, eficiência ${EFICIENCIA_SISTEMA * 100}%, HSP ${HSP}h → ${formatarNumero(energiaAGerar, 1)} kWh/dia → ${formatarNumero(potenciaNecessaria, 0)}W → ${formatarNumero(potenciaNecessaria / this.configCalculo.potenciaPainel, 1)} → ${resultado.numPaineis} painéis`;
        }
        
        const exemploInversor = document.getElementById('memorial-exemplo-inversor');
        if (exemploInversor) {
            const consumoHorario = resultado.energiaDiaria / 24;
            const consumoPico = consumoHorario * FATOR_PICO_CONSUMO;
            exemploInversor.textContent = `Consumo diário ${formatarNumero(resultado.energiaDiaria, 1)} kWh → ${formatarNumero(consumoHorario, 2)} kW/h × ${FATOR_PICO_CONSUMO} = ${formatarNumero(consumoPico, 2)} kW pico → Inversor de ${resultado.potenciaInversor} kW com MPPT ${Math.round(resultado.mpptCapacidade)}A integrado`;
        }
        
        const exemploMPPT = document.getElementById('memorial-exemplo-mppt');
        if (exemploMPPT) {
            const potenciaTotalPaineis = resultado.numPaineis * this.configCalculo.potenciaPainel;
            exemploMPPT.textContent = `${resultado.numPaineis} painéis × ${this.configCalculo.potenciaPainel}W = ${potenciaTotalPaineis}W ÷ ${document.querySelector('input[name="tipoBateria"]:checked')?.value === 'litio' ? '48V' : '12V'} = ${formatarNumero(resultado.correnteNecessaria, 1)}A necessários → Inversor ${resultado.potenciaInversor}kW com MPPT ${Math.round(resultado.mpptCapacidade)}A (adequado)`;
        }
        
        // Atualizar resumo calculado
        const resumoEnergiaDiaria = document.getElementById('resumo-energia-diaria');
        if (resumoEnergiaDiaria) {
            resumoEnergiaDiaria.textContent = `${formatarNumero(resultado.energiaDiaria, 2)} kWh/dia`;
        }
        
        const resumoDod = document.getElementById('resumo-dod');
        if (resumoDod) {
            resumoDod.textContent = `${formatarNumero(resultado.dod, 1)}%`;
        }
        
        const resumoCapacidade = document.getElementById('resumo-capacidade');
        if (resumoCapacidade) {
            resumoCapacidade.textContent = `${formatarNumero(resultado.capacidadeNecessaria, 2)} kWh`;
        }
        
        const resumoBaterias = document.getElementById('resumo-baterias');
        if (resumoBaterias) {
            resumoBaterias.textContent = `${resultado.numBaterias} × ${formatarNumero(resultado.capacidadeReal / resultado.numBaterias, 1)} kWh = ${formatarNumero(resultado.capacidadeReal, 1)} kWh`;
        }
        
        const resumoPaineis = document.getElementById('resumo-paineis');
        if (resumoPaineis) {
            resumoPaineis.textContent = `${resultado.numPaineis} × ${this.configCalculo.potenciaPainel}W = ${formatarNumero(resultado.numPaineis * this.configCalculo.potenciaPainel / 1000, 2)} kW`;
        }
        
        const resumoInversor = document.getElementById('resumo-inversor');
        if (resumoInversor) {
            resumoInversor.textContent = `${resultado.potenciaInversor} kW`;
        }
        
        const resumoMPPT = document.getElementById('resumo-mppt');
        if (resumoMPPT) {
            resumoMPPT.textContent = `${Math.round(resultado.mpptCapacidade)}A (integrado)`;
        }
    }
    
    // ============================================
    // FUNÇÕES DE CÁLCULO CORE
    // ============================================
    
    obterDoDPorCiclos(ciclos, tipoBateria) {
        const tabela = tipoBateria === 'litio' ? CICLOS_LITIO : CICLOS_AGM;
        
        // Se ciclos menor que o mínimo, retorna DoD mínimo
        if (ciclos <= tabela[0].c) return tabela[0].dod;
        
        // Se ciclos maior que o máximo, retorna DoD máximo
        if (ciclos >= tabela[tabela.length - 1].c) return tabela[tabela.length - 1].dod;
        
        // Interpolação linear
        for (let i = 0; i < tabela.length - 1; i++) {
            const p1 = tabela[i];
            const p2 = tabela[i + 1];
            
            if (ciclos >= p2.c && ciclos <= p1.c) {
                const t = (ciclos - p2.c) / (p1.c - p2.c);
                return p2.dod + t * (p1.dod - p2.dod);
            }
        }
        
        return tabela[tabela.length - 1].dod;
    }
    
    calcularSistemaFotovoltaico() {
        try {
            // Obter valores dos inputs
            const consumoMensal = parseFloat(document.getElementById('sliderConsumo')?.value || 200);
            const diasAutonomia = parseFloat(document.getElementById('sliderAutonomia')?.value || 1);
            const vidaUtil = parseFloat(document.getElementById('sliderVidaUtil')?.value || 20);
            const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked')?.value || 'litio';
            
            console.log('📊 Calculando sistema:', { consumoMensal, diasAutonomia, vidaUtil, tipoBateria });
            
            // 1. Energia diária
            const energiaDiaria = consumoMensal / 30;
        
        // 2. Determinar DoD
        const ciclosTotais = vidaUtil * 365;
        const dod = this.obterDoDPorCiclos(ciclosTotais, tipoBateria) / 100; // converter para decimal
        
        // 3. Capacidade necessária
        const capacidadePorVidaUtil = energiaDiaria / dod;
        const capacidadePorAutonomia = (energiaDiaria * diasAutonomia) / dod;
        const capacidadeNecessaria = Math.max(capacidadePorVidaUtil, capacidadePorAutonomia);
        
        // 4. Número de baterias
        const capacidadePorBateria = tipoBateria === 'litio' 
            ? this.configCalculo.capacidadeLitio 
            : this.configCalculo.capacidadeAGM;
        
        let numBaterias = Math.ceil(capacidadeNecessaria / capacidadePorBateria);
        
        // Garantir paridade para 24V e 48V
        const tensao = tipoBateria === 'litio' ? this.configCalculo.tensaoLitio : this.configCalculo.tensaoAGM;
        if ((tensao === 24 || tensao === 48) && numBaterias % 2 !== 0) {
            numBaterias++;
        }
        
        const capacidadeReal = numBaterias * capacidadePorBateria;
        const energiaUtilizavel = capacidadeReal * dod;
        
        // 5. Número de painéis
        const energiaAGerar = energiaUtilizavel / EFICIENCIA_SISTEMA;
        const potenciaNecessaria = (energiaAGerar * 1000) / HSP;
        const numPaineis = Math.ceil(potenciaNecessaria / this.configCalculo.potenciaPainel);
        
        // 6. Inversor
        const consumoMedioHorario = energiaDiaria / 24;
        const consumoPico = consumoMedioHorario * FATOR_PICO_CONSUMO;
        let potenciaInversor = Math.max(consumoPico, 1); // Mínimo 1kW
        
        // 7. MPPT
        const potenciaTotalPaineis = numPaineis * this.configCalculo.potenciaPainel;
        const correnteNecessaria = potenciaTotalPaineis / tensao;
        
        // Encontrar inversor com MPPT adequado
        const moeda = i18n.idioma === 'pt-BR' ? 'BRL' : 'EUR';
        const tabelaPrecos = moeda === 'BRL' ? PRECOS_INVERSOR_BRL : PRECOS_INVERSOR_EUR;
        
        let inversorSelecionado = tabelaPrecos.find(inv => inv.kw >= potenciaInversor);
        
        // Verificar se MPPT é suficiente
        while (inversorSelecionado && inversorSelecionado.mpptA < correnteNecessaria) {
            const index = tabelaPrecos.indexOf(inversorSelecionado);
            if (index < tabelaPrecos.length - 1) {
                inversorSelecionado = tabelaPrecos[index + 1];
            } else {
                break;
            }
        }
        
        if (!inversorSelecionado) {
            inversorSelecionado = tabelaPrecos[tabelaPrecos.length - 1];
        }
        
        // 8. Custos
        const precoPorBateria = tipoBateria === 'litio' ? this.configCalculo.precoLitio : this.configCalculo.precoAGM;
        const custoPaineis = numPaineis * this.configCalculo.precoPainel;
        const custoBaterias = numBaterias * precoPorBateria;
        const custoInversor = inversorSelecionado.preco;
        const custoTotal = custoPaineis + custoBaterias + custoInversor;
        
        // Peso das baterias
        const pesoPorBateria = tipoBateria === 'litio' ? this.configCalculo.pesoLitio : this.configCalculo.pesoAGM;
        const pesoTotal = numBaterias * pesoPorBateria;
        
        return {
            energiaDiaria,
            dod: dod * 100, // converter de volta para porcentagem
            capacidadeNecessaria,
            numBaterias,
            capacidadeReal,
            energiaUtilizavel,
            numPaineis,
            potenciaInversor: inversorSelecionado.kw,
            mpptCapacidade: inversorSelecionado.mpptA,
            correnteNecessaria,
            pesoTotal,
            custos: {
                paineis: custoPaineis,
                baterias: custoBaterias,
                inversor: custoInversor,
                mppt: 0, // Incluído no inversor
                total: custoTotal
            }
        };
        } catch (error) {
            console.error('❌ Erro ao calcular sistema fotovoltaico:', error);
            // Retornar valores padrão em caso de erro
            return {
                energiaDiaria: 0,
                dod: 0,
                capacidadeNecessaria: 0,
                numBaterias: 0,
                capacidadeReal: 0,
                energiaUtilizavel: 0,
                numPaineis: 0,
                potenciaInversor: 0,
                mpptCapacidade: 0,
                correnteNecessaria: 0,
                pesoTotal: 0,
                custos: {
                    paineis: 0,
                    baterias: 0,
                    inversor: 0,
                    mppt: 0,
                    total: 0
                }
            };
        }
    }
    
    // ============================================
    // ATUALIZAÇÃO DE RESULTADOS
    // ============================================
    
    inicializarGraficos() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js não está carregado');
            return;
        }
        
        this.criarGraficoAmortizacao();
        this.criarGraficoSazonalidade();
    }
    
    criarGraficoAmortizacao() {
        const canvas = document.getElementById('graficoAmortizacao');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destruir gráfico existente se houver
        if (this.graficos.barras) {
            this.graficos.barras.destroy();
        }
        
        // Dados de exemplo (devem ser calculados com base no resultado)
        const anos = Array.from({length: 25}, (_, i) => `Ano ${i + 1}`);
        const custoInvestimento = -15000; // Exemplo
        const economiaAnual = 2000; // Exemplo
        const economiaAcumulada = anos.map((_, i) => custoInvestimento + (economiaAnual * (i + 1)));
        
        this.graficos.barras = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: anos.filter((_, i) => i % 5 === 0 || i === 0 || i === 24), // Mostrar a cada 5 anos
                datasets: [{
                    label: i18n.idioma === 'pt-BR' ? 'Economia Acumulada' : 'Risparmio Accumulato',
                    data: economiaAcumulada.filter((_, i) => i % 5 === 0 || i === 0 || i === 24),
                    backgroundColor: 'rgba(45, 159, 163, 0.6)',
                    borderColor: 'rgba(45, 159, 163, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return i18n.idioma === 'pt-BR' 
                                    ? 'R$ ' + value.toLocaleString('pt-BR')
                                    : '€ ' + value.toLocaleString('it-IT');
                            }
                        }
                    }
                }
            }
        });
    }
    
    criarGraficoSazonalidade() {
        const canvas = document.getElementById('graficoSazonalidade');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destruir gráfico existente se houver
        if (this.graficos.pizza) {
            this.graficos.pizza.destroy();
        }
        
        const meses = i18n.idioma === 'pt-BR' 
            ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            : ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        
        // HSP médio mensal (exemplo para Brasil central)
        const hspMensal = [4.5, 4.8, 5.0, 5.2, 5.5, 5.3, 5.6, 5.8, 5.4, 5.0, 4.7, 4.3];
        
        this.graficos.pizza = new Chart(ctx, {
            type: 'line',
            data: {
                labels: meses,
                datasets: [{
                    label: i18n.idioma === 'pt-BR' ? 'Horas de Sol Pico (HSP)' : 'Ore di Sole Pieno (HSP)',
                    data: hspMensal,
                    borderColor: 'rgba(255, 193, 7, 1)',
                    backgroundColor: 'rgba(255, 193, 7, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 7,
                        ticks: {
                            callback: function(value) {
                                return value + 'h';
                            }
                        }
                    }
                }
            }
        });
    }
    
    atualizarDoDDiario(resultado) {
        const descVidaUtil = document.getElementById('descVidaUtil');
        if (descVidaUtil && resultado.dod !== undefined) {
            const dodPercentual = formatarNumero(resultado.dod, 1);
            const texto = i18n.idioma === 'pt-BR' 
                ? `DoD Diário: ${dodPercentual}%`
                : `DoD Giornaliero: ${dodPercentual}%`;
            descVidaUtil.textContent = texto;
        }
    }
    
    atualizarResultados() {
        console.log('🔄 Atualizando resultados...');
        
        try {
            const resultado = this.calcularSistemaFotovoltaico();
            console.log('📊 Resultado do cálculo:', resultado);
            
            // Atualizar valores dos inputs
            const sliderConsumo = document.getElementById('sliderConsumo');
            const sliderAutonomia = document.getElementById('sliderAutonomia');
            const sliderVidaUtil = document.getElementById('sliderVidaUtil');
            
            const inputConsumo = document.getElementById('inputConsumo');
            const inputAutonomia = document.getElementById('inputAutonomia');
            const inputVidaUtil = document.getElementById('inputVidaUtil');
            
            if (inputConsumo && sliderConsumo) inputConsumo.value = Math.round(sliderConsumo.value);
            if (inputAutonomia && sliderAutonomia) inputAutonomia.value = Math.round(sliderAutonomia.value);
            if (inputVidaUtil && sliderVidaUtil) inputVidaUtil.value = Math.round(sliderVidaUtil.value);
            
            // Atualizar DoD Diário
            this.atualizarDoDDiario(resultado);
            
            // Atualizar resultados na tela
            this.atualizarExibicaoResultados(resultado);
            console.log('✅ Resultados atualizados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao atualizar resultados:', error);
        }
    }
    
    atualizarDoDDiario(resultado) {
        const descVidaUtil = document.getElementById('descVidaUtil');
        if (descVidaUtil && resultado.dod !== undefined) {
            const dodPercentual = formatarNumero(resultado.dod * 100, 1);
            const texto = i18n.idioma === 'pt-BR' 
                ? `DoD Diário: ${dodPercentual}%`
                : `DoD Giornaliero: ${dodPercentual}%`;
            descVidaUtil.textContent = texto;
        }
    }
    
    atualizarExibicaoResultados(resultado) {
        const moeda = i18n.idioma === 'pt-BR' ? 'R$' : '€';
        const simboloMoeda = i18n.idioma === 'pt-BR' ? 'BRL' : 'EUR';
        
        // Atualizar placas solares
        const resQtdPlacas = document.getElementById('resQtdPlacas');
        if (resQtdPlacas) {
            resQtdPlacas.textContent = `${resultado.numPaineis} × ${this.configCalculo.potenciaPainel}W`;
        }
        
        // Atualizar baterias
        const resQtdBaterias = document.getElementById('resQtdBaterias');
        if (resQtdBaterias) {
            const capacidadePorBateria = resultado.capacidadeReal / resultado.numBaterias;
            resQtdBaterias.textContent = `${resultado.numBaterias} × ${formatarNumero(capacidadePorBateria, 1)}kWh`;
        }
        
        // Atualizar inversor
        const resPotenciaInversor = document.getElementById('resPotenciaInversor');
        if (resPotenciaInversor) {
            resPotenciaInversor.textContent = `${resultado.potenciaInversor} kW`;
        }
        
        // Atualizar MPPT
        const resCorrenteMPPT = document.getElementById('resCorrenteMPPT');
        if (resCorrenteMPPT) {
            resCorrenteMPPT.textContent = `${Math.round(resultado.mpptCapacidade)}A`;
        }
        
        // Atualizar peso
        const resPesoBaterias = document.getElementById('resPesoBaterias');
        if (resPesoBaterias) {
            resPesoBaterias.textContent = `${formatarNumero(resultado.pesoTotal)} kg`;
        }
        
        // Atualizar custo total
        const resPrecoEstimado = document.getElementById('resPrecoEstimado');
        if (resPrecoEstimado) {
            resPrecoEstimado.textContent = formatarMoeda(resultado.custos.total, simboloMoeda);
        }
        
        // Atualizar detalhamento de custos
        const custoPaineis = document.getElementById('custoPaineis');
        const custoBaterias = document.getElementById('custoBaterias');
        const custoInversor = document.getElementById('custoInversor');
        
        if (custoPaineis) custoPaineis.textContent = formatarMoeda(resultado.custos.paineis, simboloMoeda);
        if (custoBaterias) custoBaterias.textContent = formatarMoeda(resultado.custos.baterias, simboloMoeda);
        if (custoInversor) custoInversor.textContent = formatarMoeda(resultado.custos.inversor, simboloMoeda);
    }
    
    atualizarAposTrocaIdioma() {
        this.atualizarResultados();
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new SolarApp();
        app.inicializar();
    });
} else {
    const app = new SolarApp();
    app.inicializar();
}
