// ajustarValorPadrao é carregado via script tag no HTML
// ============================================
// CONFIGURAÇÕES SOLAR - SCRIPT
// Permite customizar valores de componentes (UI de administração)
// ============================================
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
// Observações:
//  - O arquivo aceita defaults do SiteConfig (se presente) para manter
//    consistência com configurações globais do site.
//  - Capacidade é medida em kWh, mas a UI e calculadora aceitam conversões
//    de Ah para kWh quando necessário.

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

// Permite que defaults do SiteConfig sobrescrevam alguns valores padrão de baterias
const BATTERY_DEFAULTS = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.BATTERY) ? SiteConfig.DEFAULTS.BATTERY : { DEFAULT_LFP_KWH: 4.8, DEFAULT_AGM_KWH: 1.2, LFP_MAX_KG: 180, AGM_MAX_KG: 180 };

// Idioma atual (herda do localStorage)
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// ============================================
// DICIONÁRIO DE TRADUÇÃO
// ============================================
const traducoes = {
    'pt-BR': {
        'config-title': '⚙️ Configurações',
        'config-subtitle': 'Valores de Referência 2024',
        'config-ref-title': '📋 Valores de Referência (Brasil 2024)',
        'config-ref-painel': 'Painel Solar 400-450W: R$ 1.200',
        'config-ref-bat-agm': 'Bateria AGM 12V 100Ah (~1.2 kWh): R$ 420',
        'config-ref-bat-litio': 'Bateria Lítio 48V 100Ah (~4.8 kWh): R$ 12.000',
        'config-ref-inv1': 'Inversor Off-Grid 1kW: R$ 1.100',
        'config-ref-inv2': 'Inversor Off-Grid 2kW: R$ 1.550',
        'config-ref-inv5': 'Inversor Off-Grid 5kW: R$ 2.500',
        'config-paineis': 'Painéis Solares',
        'config-potencia-painel': 'Potência',
        'config-preco-painel': 'Preço por Painel',
        'config-bat-agm': 'Bateria Chumbo-Ácido (AGM)',
        'config-bat-litio': 'Bateria Lítio (LiFePO₄)',
        'config-tensao': 'Tensão',
        'config-capacidade': 'Capacidade',
        'config-preco-bat': 'Preço',
        'config-peso-bat': 'Peso',
        'config-salvar': '💾 Salvar e Voltar',
        'config-resetar': '🔄 Restaurar Padrões',
        'footer': 'Solar - Engenharia NATA @ 2025',
        'moeda': 'R$'
        , 'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        'config-title': '⚙️ Configurazioni',
        'config-subtitle': 'Valori di Riferimento 2024',
        'config-ref-title': '📋 Valori di Riferimento (Italia 2024)',
        'config-ref-painel': 'Pannello Solare 400-450W: € 194',
        'config-ref-bat-agm': 'Batteria AGM 12V 100Ah (~1.2 kWh): € 68',
        'config-ref-bat-litio': 'Batteria Litio 48V 100Ah (~4.8 kWh): € 1.940',
        'config-ref-inv1': 'Inverter Off-Grid 1kW: € 178',
        'config-ref-inv2': 'Inverter Off-Grid 2kW: € 250',
        'config-ref-inv5': 'Inverter Off-Grid 5kW: € 404',
        'config-paineis': 'Pannelli Solari',
        'config-potencia-painel': 'Potenza',
        'config-preco-painel': 'Prezzo per Pannello',
        'config-bat-agm': 'Batteria Piombo-Acido (AGM)',
        'config-bat-litio': 'Batteria Litio (LiFePO₄)',
        'config-tensao': 'Tensione',
        'config-capacidade': 'Capacità',
        'config-preco-bat': 'Prezzo',
        'config-peso-bat': 'Peso',
        'config-salvar': '💾 Salva e Torna',
        'config-resetar': '🔄 Ripristina Predefiniti',
        'footer': 'Solare - Engenharia NATA @ 2025',
        'moeda': '€'
        , 'aria-home': 'Torna alla schermata iniziale'
    }
};

// ============================================
// FUNÇÕES DE INTERFACE
// ============================================

function trocarIdioma(idioma) {
    idiomaAtual = idioma;
    // Persiste a escolha de idioma para todo o portfólio (centralized key)
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, idioma);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.getAttribute('data-i18n');
        if (traducoes[idioma] && traducoes[idioma][chave]) {
            el.textContent = traducoes[idioma][chave];
        }
    });
    atualizarDisplays();

    // Ajusta aria-label do botão home para o idioma selecionado (acessibilidade)
    const homeLabel = traducoes[idioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

function atualizarDisplays() {
    const moeda = traducoes[idiomaAtual]?.['moeda'] || 'R$';
    
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
    ajustarValorPadrao(targetId, step, { onInput: atualizarDisplays });
}

function carregarValores() {
    const configSalva = localStorage.getItem(SITE_LS.SOLAR_CONFIG_KEY);
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
    
    localStorage.setItem(SITE_LS.SOLAR_CONFIG_KEY, JSON.stringify(config));
    window.location.href = 'solar.html';
}

function restaurarPadroes() {
    localStorage.removeItem(SITE_LS.SOLAR_CONFIG_KEY);
    carregarValores();
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Carregar idioma e valores salvos
    trocarIdioma(idiomaAtual);
    carregarValores();
    // Apply centralized battery max limits from SiteConfig if available
    const batteryDefaults = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.BATTERY) ? SiteConfig.DEFAULTS.BATTERY : { LFP_MAX_KG: 180, AGM_MAX_KG: 180, DEFAULT_LFP_KWH: 4.8, DEFAULT_AGM_KWH: 1.2 };
    const sPesoAGM = document.getElementById('sliderPesoAGM');
    const sPesoLitio = document.getElementById('sliderPesoLitio');
    if (sPesoAGM) sPesoAGM.max = batteryDefaults.AGM_MAX_KG;
    if (sPesoLitio) sPesoLitio.max = batteryDefaults.LFP_MAX_KG;
    
    // Listeners para todos os sliders
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        slider.addEventListener('input', atualizarDisplays);
    });
    
    // Listeners para botões +/- - usa função global com aceleração exponencial
    if (typeof configurarBotoesSliderComAceleracao === 'function') {
        // Usa função de ajuste local
        function ajustarValorSolarConfig(targetId, step) {
            ajustarValor(targetId, step);
        }
        configurarBotoesSliderComAceleracao(SITE_SEL.ARROW_BTN, ajustarValorSolarConfig);
    } else {
        // Fallback para código antigo se a função global não estiver disponível
        document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            btn.addEventListener('click', () => ajustarValor(targetId, step));
        });
    }
    
    // Botão Salvar
    document.getElementById('btnSalvar').addEventListener('click', salvarValores);
    
    // Botão Restaurar
    document.getElementById('btnResetar').addEventListener('click', restaurarPadroes);
});
