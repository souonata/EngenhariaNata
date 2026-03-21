// CONFIGURAÇÕES SOLAR - SCRIPT
// Permite customizar valores de componentes (UI de administração)
//
// Esta página permite ajustar os valores padrão usados pela calculadora solar:
// potência/preço de painéis, tensão, capacidade, peso e preço das baterias (AGM / LiFePO4).
//
// Funções principais:
//  - carregarValores(): lê a configuração salva em localStorage ou usa VALORES_PADRAO;
//    aplica valores aos sliders da interface e atualiza as labels.
//  - salvarValores(): serializa os valores atuais dos sliders e salva em localStorage
//    para serem usados pela calculadora principal (solar.html).
//  - restaurarPadroes(): remove a configuração salva, voltando aos valores padrão.
//
//  - Capacidade é medida em kWh, mas a UI e calculadora aceitam conversões
//    de Ah para kWh quando necessário.

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';

let idiomaAtual = 'pt-BR';
// Valores padrão
const VALORES_PADRAO = {
    potenciaPainel: 400,
    precoPainel: 1200,
    // AGM (Chumbo-Ácido) - capacidade em kWh
    tensaoAGM: 12,
    capacidadeAGM: 1.2,   // kWh (~12V x 100Ah)
    precoAGM: 420,
    pesoAGM: 30,
    // LiFePO4 (Lítio) - módulo off-grid comum: 48V x 100Ah ≈ 4.8 kWh
    tensaoLitio: 48,
    capacidadeLitio: 4.8, // kWh
    precoLitio: 12000,
    pesoLitio: 60
};
// Limites máximos das baterias
const BATTERY_DEFAULTS = { DEFAULT_LFP_KWH: 4.8, DEFAULT_AGM_KWH: 1.2, LFP_MAX_KG: 180, AGM_MAX_KG: 180 };

// FUNÇÕES DE INTERFACE

function atualizarDisplays() {
    const moeda = i18n.t('moeda') || 'R$';
    
    // Painéis
    const potenciaPainel = document.getElementById('sliderPotenciaPainel').value;
    const precoPainel = document.getElementById('sliderPrecoPainel').value;
    document.getElementById('valPotenciaPainel').textContent = `${potenciaPainel} W`;
    document.getElementById('valPrecoPainel').textContent = `${moeda} ${parseInt(precoPainel).toLocaleString(idiomaAtual, {useGrouping: true})}`;
    
    // AGM
    const tensaoAGM = document.getElementById('sliderTensaoAGM').value;
    const capacidadeAGM = document.getElementById('sliderCapacidadeAGM').value;
    const precoAGM = document.getElementById('sliderPrecoAGM').value;
    const pesoAGM = document.getElementById('sliderPesoAGM').value;
    document.getElementById('valTensaoAGM').textContent = `${tensaoAGM} V`;
    document.getElementById('valCapacidadeAGM').textContent = `${parseFloat(capacidadeAGM).toFixed(1)} kWh`;
    document.getElementById('valPrecoAGM').textContent = `${moeda} ${parseInt(precoAGM).toLocaleString(idiomaAtual, {useGrouping: true})}`;
    document.getElementById('valPesoAGM').textContent = `${pesoAGM} kg`;
    
    // Lítio
    const tensaoLitio = document.getElementById('sliderTensaoLitio').value;
    const capacidadeLitio = document.getElementById('sliderCapacidadeLitio').value;
    const precoLitio = document.getElementById('sliderPrecoLitio').value;
    const pesoLitio = document.getElementById('sliderPesoLitio').value;
    document.getElementById('valTensaoLitio').textContent = `${tensaoLitio} V`;
    document.getElementById('valCapacidadeLitio').textContent = `${parseFloat(capacidadeLitio).toFixed(1)} kWh`;
    document.getElementById('valPrecoLitio').textContent = `${moeda} ${parseInt(precoLitio).toLocaleString(idiomaAtual, {useGrouping: true})}`;
    document.getElementById('valPesoLitio').textContent = `${pesoLitio} kg`;
}

function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const stepAttr = parseFloat(slider.step) || 1;
    let valor = parseFloat(slider.value);
    if (isNaN(valor)) valor = min;
    valor = Math.round(Math.max(min, Math.min(max, valor + step)) / stepAttr) * stepAttr;
    slider.value = valor;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    atualizarDisplays();
}

function carregarValores() {
    const configSalva = localStorage.getItem('configSolar');
    const config = configSalva ? JSON.parse(configSalva) : VALORES_PADRAO;
    
    // Aplicar valores aos sliders
    document.getElementById('sliderPotenciaPainel').value = config.potenciaPainel || VALORES_PADRAO.potenciaPainel;
    document.getElementById('sliderPrecoPainel').value = config.precoPainel || VALORES_PADRAO.precoPainel;
    
    document.getElementById('sliderTensaoAGM').value = config.tensaoAGM || VALORES_PADRAO.tensaoAGM;
    document.getElementById('sliderCapacidadeAGM').value = config.capacidadeAGM || BATTERY_DEFAULTS.DEFAULT_AGM_KWH || VALORES_PADRAO.capacidadeAGM;
    document.getElementById('sliderPrecoAGM').value = config.precoAGM || VALORES_PADRAO.precoAGM;
    document.getElementById('sliderPesoAGM').value = config.pesoAGM || VALORES_PADRAO.pesoAGM;
    
    document.getElementById('sliderTensaoLitio').value = config.tensaoLitio || VALORES_PADRAO.tensaoLitio;
    document.getElementById('sliderCapacidadeLitio').value = config.capacidadeLitio || BATTERY_DEFAULTS.DEFAULT_LFP_KWH || VALORES_PADRAO.capacidadeLitio;
    document.getElementById('sliderPrecoLitio').value = config.precoLitio || VALORES_PADRAO.precoLitio;
    document.getElementById('sliderPesoLitio').value = config.pesoLitio || VALORES_PADRAO.pesoLitio;
    
    atualizarDisplays();
}

function salvarValores() {
    const config = {
        potenciaPainel: parseInt(document.getElementById('sliderPotenciaPainel').value),
        precoPainel: parseInt(document.getElementById('sliderPrecoPainel').value),
        tensaoAGM: parseInt(document.getElementById('sliderTensaoAGM').value),
        capacidadeAGM: parseFloat(document.getElementById('sliderCapacidadeAGM').value),
        precoAGM: parseInt(document.getElementById('sliderPrecoAGM').value),
        pesoAGM: parseInt(document.getElementById('sliderPesoAGM').value),
        tensaoLitio: parseInt(document.getElementById('sliderTensaoLitio').value),
        capacidadeLitio: parseFloat(document.getElementById('sliderCapacidadeLitio').value),
        precoLitio: parseInt(document.getElementById('sliderPrecoLitio').value),
        pesoLitio: parseInt(document.getElementById('sliderPesoLitio').value)
    };
    
    localStorage.setItem('configSolar', JSON.stringify(config));
    window.location.href = 'solar.html';
}

function restaurarPadroes() {
    localStorage.removeItem('configSolar');
    carregarValores();
}

// ============================================
// CLASSE PRINCIPAL
// ============================================

class ConfigSolarApp extends App {
    constructor() {
        super({
            appName: 'solar-config',
            callbacks: {
                aoInicializar: () => this.configurar(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
    }

    atualizarAposTrocaIdioma() {
        idiomaAtual = i18n.obterIdiomaAtual();
        atualizarDisplays();
    }

    configurar() {
        const sPesoAGM = document.getElementById('sliderPesoAGM');
        const sPesoLitio = document.getElementById('sliderPesoLitio');
        if (sPesoAGM) sPesoAGM.max = BATTERY_DEFAULTS.AGM_MAX_KG;
        if (sPesoLitio) sPesoLitio.max = BATTERY_DEFAULTS.LFP_MAX_KG;

        carregarValores();

        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', atualizarDisplays);
        });

        document.querySelectorAll('.arrow-btn').forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            btn.addEventListener('click', () => ajustarValor(targetId, step));
        });

        const btnSalvar = document.getElementById('btnSalvar');
        if (btnSalvar) btnSalvar.addEventListener('click', salvarValores);

        const btnResetar = document.getElementById('btnResetar');
        if (btnResetar) btnResetar.addEventListener('click', restaurarPadroes);
    }
}

new ConfigSolarApp().inicializar();

