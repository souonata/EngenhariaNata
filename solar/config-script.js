// ============================================
// CONFIGURAÇÕES SOLAR - SCRIPT
// Permite customizar valores de componentes
// ============================================

// Valores padrão (referência 2024)
const VALORES_PADRAO = {
    potenciaPainel: 400,
    precoPainel: 1200,
    // AGM (Chumbo-Ácido)
    tensaoAGM: 12,
    capacidadeAGM: 100,
    precoAGM: 420,
    pesoAGM: 30,
    // LiFePO4 (Lítio)
    tensaoLitio: 12,
    capacidadeLitio: 100,
    precoLitio: 3500,
    pesoLitio: 12
};

// Idioma atual (herda do localStorage)
let idiomaAtual = localStorage.getItem('idiomaSolar') || 'pt-BR';

// ============================================
// DICIONÁRIO DE TRADUÇÃO
// ============================================
const traducoes = {
    'pt-BR': {
        'config-title': '⚙️ Configurações',
        'config-subtitle': 'Valores de Referência 2024',
        'config-ref-title': '📋 Valores de Referência (Brasil 2024)',
        'config-ref-painel': 'Painel Solar 400-450W: R$ 1.200',
        'config-ref-bat-agm': 'Bateria AGM 12V 100Ah: R$ 420',
        'config-ref-bat-litio': 'Bateria LiFePO₄ 12V 100Ah: R$ 3.500',
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
        'footer': 'Solar - Engenharia NATA © 2025',
        'moeda': 'R$'
    },
    'it-IT': {
        'config-title': '⚙️ Configurazioni',
        'config-subtitle': 'Valori di Riferimento 2024',
        'config-ref-title': '📋 Valori di Riferimento (Italia 2024)',
        'config-ref-painel': 'Pannello Solare 400-450W: € 194',
        'config-ref-bat-agm': 'Batteria AGM 12V 100Ah: € 68',
        'config-ref-bat-litio': 'Batteria LiFePO₄ 12V 100Ah: € 565',
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
        'footer': 'Solare - Engenharia NATA © 2025',
        'moeda': '€'
    }
};

// ============================================
// FUNÇÕES DE INTERFACE
// ============================================

function trocarIdioma(idioma) {
    idiomaAtual = idioma;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.getAttribute('data-i18n');
        if (traducoes[idioma] && traducoes[idioma][chave]) {
            el.textContent = traducoes[idioma][chave];
        }
    });
    atualizarDisplays();
}

function atualizarDisplays() {
    const moeda = traducoes[idiomaAtual]['moeda'];
    
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
    document.getElementById('valCapacidadeAGM').textContent = `${capacidadeAGM} Ah`;
    document.getElementById('valPrecoAGM').textContent = `${moeda} ${parseInt(precoAGM).toLocaleString(idiomaAtual, {useGrouping: true})}`;
    document.getElementById('valPesoAGM').textContent = `${pesoAGM} kg`;
    
    // Lítio
    const tensaoLitio = document.getElementById('sliderTensaoLitio').value;
    const capacidadeLitio = document.getElementById('sliderCapacidadeLitio').value;
    const precoLitio = document.getElementById('sliderPrecoLitio').value;
    const pesoLitio = document.getElementById('sliderPesoLitio').value;
    document.getElementById('valTensaoLitio').textContent = `${tensaoLitio} V`;
    document.getElementById('valCapacidadeLitio').textContent = `${capacidadeLitio} Ah`;
    document.getElementById('valPrecoLitio').textContent = `${moeda} ${parseInt(precoLitio).toLocaleString(idiomaAtual, {useGrouping: true})}`;
    document.getElementById('valPesoLitio').textContent = `${pesoLitio} kg`;
}

function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    let valor = parseFloat(slider.value) + parseFloat(step);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    
    if (valor < min) valor = min;
    if (valor > max) valor = max;
    
    slider.value = valor;
    atualizarDisplays();
}

function carregarValores() {
    const configSalva = localStorage.getItem('configSolar');
    const config = configSalva ? JSON.parse(configSalva) : VALORES_PADRAO;
    
    // Aplicar valores aos sliders
    document.getElementById('sliderPotenciaPainel').value = config.potenciaPainel || VALORES_PADRAO.potenciaPainel;
    document.getElementById('sliderPrecoPainel').value = config.precoPainel || VALORES_PADRAO.precoPainel;
    
    document.getElementById('sliderTensaoAGM').value = config.tensaoAGM || VALORES_PADRAO.tensaoAGM;
    document.getElementById('sliderCapacidadeAGM').value = config.capacidadeAGM || VALORES_PADRAO.capacidadeAGM;
    document.getElementById('sliderPrecoAGM').value = config.precoAGM || VALORES_PADRAO.precoAGM;
    document.getElementById('sliderPesoAGM').value = config.pesoAGM || VALORES_PADRAO.pesoAGM;
    
    document.getElementById('sliderTensaoLitio').value = config.tensaoLitio || VALORES_PADRAO.tensaoLitio;
    document.getElementById('sliderCapacidadeLitio').value = config.capacidadeLitio || VALORES_PADRAO.capacidadeLitio;
    document.getElementById('sliderPrecoLitio').value = config.precoLitio || VALORES_PADRAO.precoLitio;
    document.getElementById('sliderPesoLitio').value = config.pesoLitio || VALORES_PADRAO.pesoLitio;
    
    atualizarDisplays();
}

function salvarValores() {
    const config = {
        potenciaPainel: parseInt(document.getElementById('sliderPotenciaPainel').value),
        precoPainel: parseInt(document.getElementById('sliderPrecoPainel').value),
        tensaoAGM: parseInt(document.getElementById('sliderTensaoAGM').value),
        capacidadeAGM: parseInt(document.getElementById('sliderCapacidadeAGM').value),
        precoAGM: parseInt(document.getElementById('sliderPrecoAGM').value),
        pesoAGM: parseInt(document.getElementById('sliderPesoAGM').value),
        tensaoLitio: parseInt(document.getElementById('sliderTensaoLitio').value),
        capacidadeLitio: parseInt(document.getElementById('sliderCapacidadeLitio').value),
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
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Carregar idioma e valores salvos
    trocarIdioma(idiomaAtual);
    carregarValores();
    
    // Listeners para todos os sliders
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        slider.addEventListener('input', atualizarDisplays);
    });
    
    // Listeners para botões +/-
    document.querySelectorAll('.arrow-btn').forEach(btn => {
        let intervalId = null;
        let timeoutId = null;
        
        const iniciarAjuste = () => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            ajustarValor(targetId, step);
            
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100);
            }, 400);
        };
        
        const pararAjuste = () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
            timeoutId = null;
            intervalId = null;
        };
        
        btn.addEventListener('mousedown', iniciarAjuste);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            iniciarAjuste();
        });
        btn.addEventListener('mouseup', pararAjuste);
        btn.addEventListener('mouseleave', pararAjuste);
        btn.addEventListener('touchend', pararAjuste);
        btn.addEventListener('touchcancel', pararAjuste);
    });
    
    // Botão Salvar
    document.getElementById('btnSalvar').addEventListener('click', salvarValores);
    
    // Botão Restaurar
    document.getElementById('btnResetar').addEventListener('click', restaurarPadroes);
});
