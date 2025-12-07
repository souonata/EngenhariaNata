// ============================================
// CALCULADORA SOLAR
// ============================================
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: dado um consumo médio mensal (kWh), dias de autonomia e
// uma escolha de tecnologia de bateria (AGM ou LiFePO4), calcular um
// sistema fotovoltaico off-grid recomendado contendo:
//  - número de baterias (e sua capacidade total instalada, em kWh),
//  - número de painéis solares (quantidade × potência por painel),
//  - potência do inversor (kW),
//  - estimativa de custo baseada em preços unitários.
//
// Entrada (UI):
//  - consumo médio mensal (kWh)
//  - dias de autonomia (quantos dias o sistema deve suprir sem sol)
//  - vida útil desejada (anos) → traduzido em ciclos por ano → usado
//    para calcular um DoD (Depth of Discharge) alvo aceitável para
//    proteger a bateria e alcançar a vida útil desejada.
//  - escolha do tipo de bateria (AGM / Litio)
//  - configuração do fabricante (potência do painel, capacidade/peso/valor das baterias)
//
// Passo-a-passo do cálculo (resumido):
// 1) Determinar energia diária média = consumo mensal / 30 (kWh/dia).
// 2) A partir da vida útil desejada (anos) determinamos ciclos aproximados
//    = anos × 365. A partir de tabelas de ciclos vs DoD escolhemos um DoD
//    diário alvo (ex: 50%). DoD menor → mais capacidade nominal necessária.
// 3) Capacidade nominal necessária (kWh): calcula-se tanto pelo critério
//    "vida útil" (energia diária ÷ DoD) quanto pelo critério "autonomia"
//    (energia diária × dias de autonomia ÷ DoD). O requisito final é o
//    máximo desses dois (para atender ambos os critérios).
// 4) Determina-se energia entregue por uma unidade de bateria (kWh). Se
//    a bateria estiver configurada em Ah (retrocompatibilidade), convertendo
//    via tensão (V × Ah / 1000 → kWh). Em seguida: número de módulos =
//    ceil(capacidadeNecessária / kWhPorBateria). Para tensões 24/48 preferimos
//    números pares (paridade) — por isso incrementamos se necessário.
// 5) Capacidade real instalada = qtdBaterias × energiaPorBateria.
// 6) Energia utilizável do banco = capacidadeReal × DoD (kWh).
// 7) Necessidade de geração diária dos painéis = energiaUtilizavelBanco / eficiênciaSistema
//    (considerando perdas). Com Horas de Sol Pleno (HSP) conhecidas, calcula-se
//    a potência requerida em Watts e o número de painéis (ceil(potenciaNecessaria / W_por_painel)).
// 8) Inversor: dimensionamos com base na potência necessária dos painéis em kW
//    (mínimo 1 kW), e usamos uma tabela com preços por faixa para estimativa
//    do custo do inversor (interpolando quando necessário).
// 9) Custos: soma dos painéis (quantidade × preço por painel), baterias
//    (qtd × preço unitário), e inversor. Para visualização, convertemos para
//    a moeda do idioma (BRL/€) usando TAXA_BRL_EUR quando necessário.
//
// Observações de design e compatibilidade:
// - Mantemos compatibilidade com configurações antigas que guardavam
//   capacidade em Ah (por exemplo 100 Ah); nestes casos o código converte
//   Ah → kWh usando a tensão informada.
// - O algoritmo tenta ser conservador: arredonda para cima (ceil) e
//   garante paridade física (pareamento para tensões mais altas) para facilitar
//   montagem prática do banco de baterias.
// - As tabelas CICLOS_AGM e CICLOS_LITIO mapeiam cycles → DoD com interpolação
//   linear quando necessário (veja obterDoDPorCiclos / obterCiclosPorDoD).
//
// O arquivo preserva a lógica existente mas adiciona documentação para facilitar
// entendimento por estudantes e colaboradores.

// Variável que guarda o idioma atual (Português ou Italiano)
// Padroniza a chave localStorage para o mesmo usado pelo restante do projeto
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// ============================================
// CONSTANTES DO SISTEMA (Valores Fixos)
// ============================================

const HSP = 5.0; // Horas de Sol Pleno
const EFICIENCIA_SISTEMA = 0.80; // Eficiência global (perdas de 20%)

// Taxa de conversão BRL → EUR (aproximada, can be centralized in SiteConfig)
const TAXA_BRL_EUR = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.TAXA_BRL_EUR) ? SiteConfig.DEFAULTS.TAXA_BRL_EUR : 6.19;

// ============================================
// VALORES PADRÃO DOS COMPONENTES (em BRL)
// ============================================
// Defaults updated to use battery capacity in kWh (common off-grid modules)
// Choice rationale: common modular LiFePO4 packs for off-grid use are
// frequently 48V x 100Ah ≈ 4.8 kWh. AGM typical small deep-cycle 12V 100Ah ≈ 1.2 kWh.
// Prices are approximate market values (BRL) for typical modules.
const VALORES_PADRAO = {
    potenciaPainel: 400,
    precoPainel: 1200,
    // AGM defaults (12 V, capacity in kWh)
    tensaoAGM: 12,
        capacidadeAGM: (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.BATTERY && typeof SiteConfig.DEFAULTS.BATTERY.DEFAULT_AGM_KWH === 'number')
            ? SiteConfig.DEFAULTS.BATTERY.DEFAULT_AGM_KWH
            : 1.2,   // kWh (12 V × 100 Ah ≈ 1.2 kWh)
    precoAGM: 420,
    pesoAGM: 30,
    // Lithium defaults (48 V, capacity in kWh)
    tensaoLitio: 48,
        capacidadeLitio: (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.BATTERY && typeof SiteConfig.DEFAULTS.BATTERY.DEFAULT_LFP_KWH === 'number')
            ? SiteConfig.DEFAULTS.BATTERY.DEFAULT_LFP_KWH
            : 4.8, // kWh (48 V × 100 Ah ≈ 4.8 kWh) — common modular pack
    precoLitio: 12000,     // approximate BRL price for a 48V 100Ah LiFePO4 module
    pesoLitio: 60
};

// Função para obter configuração atual (customizada ou padrão)
function obterConfig() {
    const configSalva = localStorage.getItem(SITE_LS.SOLAR_CONFIG_KEY);
    return configSalva ? JSON.parse(configSalva) : VALORES_PADRAO;
}

// ============================================
// TABELAS DE VIDA ÚTIL (Ciclos vs Descarga)
// DoD mínimo = 25%, máximo = 95%
// ============================================

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

// ============================================
// PREÇOS DE INVERSORES (Tabela fixa)
// ============================================

const PRECOS_INVERSOR_BRL = [
    { kw: 1, preco: 1100 },
    { kw: 2, preco: 1550 },
    { kw: 5, preco: 2500 }
];
const PRECOS_INVERSOR_EUR = [
    { kw: 1, preco: 178 },
    { kw: 2, preco: 250 },
    { kw: 5, preco: 404 }
];

/**
 * Calcula o preço estimado de um inversor baseado na potência desejada
 * 
 * Esta função usa interpolação linear para estimar o preço de inversores
 * com potências que não estão diretamente na tabela de preços. Isso evita
 * a necessidade de ter uma entrada na tabela para cada possível potência.
 * 
 * @param {number} potenciaKw - Potência do inversor em quilowatts (kW)
 * @param {string} moeda - Moeda desejada ('BRL' para Real ou 'EUR' para Euro)
 * @returns {number} Preço estimado do inversor na moeda especificada
 * 
 * Explicação do algoritmo:
 * 1. Se a potência for menor ou igual ao menor valor da tabela, retorna o preço mínimo
 * 2. Se a potência for maior que o maior valor da tabela, faz extrapolação linear
 *    (estende a linha formada pelos dois últimos pontos da tabela)
 * 3. Se a potência estiver entre dois pontos da tabela, faz interpolação linear
 *    (calcula um valor proporcional entre os dois pontos)
 * 
 * Exemplo de interpolação:
 * - Tabela: 1kW = R$ 1100, 2kW = R$ 1550
 * - Potência desejada: 1.5kW
 * - Razão: (1.5 - 1) / (2 - 1) = 0.5 (meio caminho)
 * - Preço: 1100 + 0.5 × (1550 - 1100) = 1100 + 225 = R$ 1325
 */
function calcularPrecoInversor(potenciaKw, moeda) {
    // PASSO 1: Seleciona a tabela de preços baseada na moeda
    // Se a moeda for BRL (Real), usa a tabela em reais; caso contrário, usa a tabela em euros
    const tabela = moeda === 'BRL' ? PRECOS_INVERSOR_BRL : PRECOS_INVERSOR_EUR;
    
    // PASSO 2: Verifica se a potência é menor ou igual ao menor valor da tabela
    // Se for, retorna o preço do menor inversor da tabela (sem extrapolação para baixo)
    if (potenciaKw <= tabela[0].kw) {
        return tabela[0].preco;
    }
    
    // PASSO 3: Verifica se a potência é maior ou igual ao maior valor da tabela
    // Se for, faz extrapolação linear para cima usando os dois últimos pontos
    if (potenciaKw >= tabela[tabela.length - 1].kw) {
        const ultimo = tabela[tabela.length - 1];      // Último ponto da tabela (maior potência)
        const penultimo = tabela[tabela.length - 2];   // Penúltimo ponto da tabela
        
        // Calcula a taxa de variação de preço por kW (inclinação da reta)
        // Exemplo: se 2kW = R$ 1550 e 5kW = R$ 2500, então:
        // precoPorKw = (2500 - 1550) / (5 - 2) = 950 / 3 ≈ R$ 316,67 por kW
        const precoPorKw = (ultimo.preco - penultimo.preco) / (ultimo.kw - penultimo.kw);
        
        // Extrapola o preço: preço do último ponto + (diferença de potência × taxa por kW)
        // Exemplo: para 7kW, preço = 2500 + (7 - 5) × 316,67 = 2500 + 633,34 = R$ 3133,34
        return ultimo.preco + (potenciaKw - ultimo.kw) * precoPorKw;
    }
    
    // PASSO 4: Interpola entre dois pontos da tabela
    // Procura o intervalo na tabela onde a potência desejada se encaixa
    for (let i = 0; i < tabela.length - 1; i++) {
        const p1 = tabela[i];     // Ponto inferior do intervalo
        const p2 = tabela[i + 1]; // Ponto superior do intervalo
        
        // Verifica se a potência está dentro deste intervalo
        if (potenciaKw >= p1.kw && potenciaKw <= p2.kw) {
            // Calcula a razão (0 a 1) de onde a potência está no intervalo
            // Exemplo: se p1 = 1kW, p2 = 2kW e potenciaKw = 1.5kW:
            // razao = (1.5 - 1) / (2 - 1) = 0.5 (meio caminho)
            const razao = (potenciaKw - p1.kw) / (p2.kw - p1.kw);
            
            // Interpola o preço proporcionalmente
            // Exemplo: se p1.preco = 1100, p2.preco = 1550 e razao = 0.5:
            // preco = 1100 + 0.5 × (1550 - 1100) = 1100 + 225 = 1325
            return p1.preco + razao * (p2.preco - p1.preco);
        }
    }
    
    // PASSO 5: Fallback (não deveria chegar aqui, mas retorna o preço máximo como segurança)
    return tabela[tabela.length - 1].preco;
}

// ============================================
// DICIONÁRIO DE TRADUÇÃO
// ============================================
const traducoes = {
    'pt-BR': {
        'app-title': '☀️ Solar',
        'app-subtitle': 'Dimensionamento de Sistema Fotovoltaico',
        'label-consumo': 'Consumo Médio Mensal',
        'label-autonomia': 'Dias de Autonomia',
        'label-tipo-bateria': 'Tipo de Bateria',
        'opt-chumbo': 'Chumbo-Ácido (Gel/VRLA)',
        'opt-litio': 'Lítio (LiFePO4)',
        'label-vida-util': 'Vida Útil Desejada',
        'results-title': 'Sistema Recomendado',
        'res-placas': 'Placas Solares',
        'res-baterias': 'Baterias',
        'res-inversor': 'Inversor',
        'res-onda-pura': 'Onda Senoidal Pura',
        'res-peso': 'Peso das Baterias',
        'res-estimativa': 'Estimativa de Custo',
        'custos-titulo': 'Detalhamento de Custos',
        'custo-total': 'Total',
        'footer': 'Solar - Engenharia NATA © 2025',
        'dias': 'dias',
        'dia': 'dia',
        'anos': 'anos',
        'ano': 'ano',
        'moeda': 'R$'
        , 'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        'app-title': '☀️ Solare',
        'app-subtitle': 'Dimensionamento Impianto Fotovoltaico',
        'label-consumo': 'Consumo Medio Mensile',
        'label-autonomia': 'Giorni di Autonomia',
        'label-tipo-bateria': 'Tipo di Batteria',
        'opt-chumbo': 'Piombo-Acido (Gel/AGM)',
        'opt-litio': 'Litio (LiFePO4)',
        'label-vida-util': 'Vita Utile Desiderata',
        'results-title': 'Sistema Consigliato',
        'res-placas': 'Pannelli Solari',
        'res-baterias': 'Batterie',
        'res-inversor': 'Inverter',
        'res-onda-pura': 'Onda Sinusoidale Pura',
        'res-peso': 'Peso Batterie',
        'res-estimativa': 'Costo Stimato',
        'custos-titulo': 'Dettaglio Costi',
        'custo-total': 'Totale',
        'footer': 'Solare - Engenharia NATA © 2025',
        'dias': 'giorni',
        'dia': 'giorno',
        'anos': 'anni',
        'ano': 'anno',
        'moeda': '€'
        , 'aria-home': 'Torna alla schermata iniziale'
    }
};

// Controle para os botões de seta
let intervalId = null;
let timeoutId = null;

// ============================================
// FUNÇÃO: TROCAR IDIOMA
// ============================================
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    // Persiste a preferência de idioma usando a chave padronizada do projeto
        localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (traducoes[novoIdioma][key]) {
            el.textContent = traducoes[novoIdioma][key];
        }
    });

    document.querySelectorAll('.btn-idioma').forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    atualizarInterface();

    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Calcula o DoD (Depth of Discharge - Profundidade de Descarga) permitido
 * baseado no número de ciclos desejados da bateria
 * 
 * Esta função é fundamental para o dimensionamento do sistema. Ela determina
 * qual percentual da capacidade da bateria pode ser usado diariamente para
 * garantir que a bateria dure o número de anos desejado.
 * 
 * A relação é inversa: quanto mais ciclos você quer (mais anos de vida útil),
 * menor deve ser o DoD diário (menos você pode descarregar a bateria por dia).
 * 
 * @param {number} ciclos - Número total de ciclos desejados (ex: 1825 para 5 anos × 365 dias)
 * @param {string} tipo - Tipo de bateria ('litio' para LiFePO4 ou 'chumbo' para AGM/Gel)
 * @returns {number} DoD em percentual (ex: 50 para 50%)
 * 
 * Explicação:
 * - As tabelas CICLOS_AGM e CICLOS_LITIO relacionam ciclos de vida com DoD
 * - Exemplo: bateria LiFePO4 com DoD de 50% pode fazer ~5090 ciclos
 * - Se você quer 1825 ciclos (5 anos), precisa usar um DoD menor (ex: ~60%)
 * - A função interpola linearmente entre os pontos da tabela para valores intermediários
 */
function obterDoDPorCiclos(ciclos, tipo) {
    // PASSO 1: Seleciona a tabela de ciclos baseada no tipo de bateria
    // Baterias de lítio têm muito mais ciclos que baterias de chumbo-ácido
    const dados = tipo === 'litio' ? CICLOS_LITIO : CICLOS_AGM;
    
    // PASSO 2: Verifica se o número de ciclos é maior ou igual ao máximo da tabela
    // Se for, retorna o DoD mínimo (25%) - isso significa que você quer muitos ciclos,
    // então precisa usar a bateria de forma muito conservadora
    if (ciclos >= dados[0].c) return dados[0].dod; // Mínimo DoD = 25%
    
    // PASSO 3: Verifica se o número de ciclos é menor ou igual ao mínimo da tabela
    // Se for, retorna o DoD máximo (95%) - isso significa que você quer poucos ciclos,
    // então pode usar a bateria de forma mais agressiva
    if (ciclos <= dados[dados.length - 1].c) return dados[dados.length - 1].dod; // Máximo DoD = 95%

    // PASSO 4: Interpola entre dois pontos da tabela
    // Procura o intervalo na tabela onde o número de ciclos se encaixa
    // Nota: a tabela está ordenada do maior número de ciclos (menor DoD) para o menor
    for (let i = 0; i < dados.length - 1; i++) {
        const p1 = dados[i];     // Ponto com mais ciclos (menor DoD)
        const p2 = dados[i+1];   // Ponto com menos ciclos (maior DoD)
        
        // Verifica se o número de ciclos está dentro deste intervalo
        // Nota: p1.c > p2.c porque a tabela está em ordem decrescente
        if (ciclos <= p1.c && ciclos >= p2.c) {
            // Calcula a razão (0 a 1) de onde o número de ciclos está no intervalo
            // Exemplo: se p1.c = 5090, p2.c = 4005 e ciclos = 4500:
            // razao = (4500 - 4005) / (5090 - 4005) = 495 / 1085 ≈ 0.456
            const razao = (ciclos - p2.c) / (p1.c - p2.c);
            
            // Interpola o DoD proporcionalmente
            // Como p1.dod < p2.dod (menos ciclos = maior DoD), somamos a diferença
            // Exemplo: se p1.dod = 50%, p2.dod = 60% e razao = 0.456:
            // dod = 60 + 0.456 × (50 - 60) = 60 - 4.56 = 55.44%
            return p2.dod + razao * (p1.dod - p2.dod);
        }
    }
    
    // PASSO 5: Fallback (não deveria chegar aqui, mas retorna 50% como valor padrão)
    return 50;
}

// ============================================
// FUNÇÃO: CALCULAR CICLOS POR DoD (inversa)
// ============================================
// Esta função é a inversa da anterior: recebe um DoD (%) e retorna
// o número aproximado de ciclos esperados. Também usa interpolação
// linear entre pontos da tabela. É útil para mostrar como alterar o
// DoD afeta a vida útil (ciclos) estimada.
function obterCiclosPorDoD(dod, tipo) {
    const dados = tipo === 'litio' ? CICLOS_LITIO : CICLOS_AGM;
    
    // Se DoD menor que o mínimo da tabela, retorna ciclos máximos
    if (dod <= dados[0].dod) return dados[0].c;
    // Se DoD maior que o máximo da tabela, retorna ciclos mínimos
    if (dod >= dados[dados.length - 1].dod) return dados[dados.length - 1].c;

    // Interpola entre os pontos da tabela
    for (let i = 0; i < dados.length - 1; i++) {
        const p1 = dados[i];
        const p2 = dados[i+1];
        
        if (dod >= p1.dod && dod <= p2.dod) {
            const razao = (dod - p1.dod) / (p2.dod - p1.dod);
            return p1.c + razao * (p2.c - p1.c);
        }
    }
    return 1000; // Valor padrão de segurança
}

// ============================================
// FUNÇÃO: AJUSTAR VALORES (Botões de Seta)
// ============================================
// ============================================
// FUNÇÃO: AJUSTAR VALORES (Botões de Seta)
// ============================================
// Os botões +/- da interface chamam esta função para aumentar ou diminuir
// um valor ligado a um ID de slider/text input. Aqui aplicamos limites,
// arredondamento e atualizamos a interface para refletir a mudança.
function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    let valor = parseFloat(slider.value) || 0;
    
    valor += step;
    
    // Respeita os limites do slider
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    
    if (valor < min) valor = min;
    if (valor > max) valor = max;
    
    // Arredonda para evitar problemas de ponto flutuante
    slider.value = Math.round(valor * 10) / 10;
    
    atualizarInterface();
}

// ============================================
// FUNÇÃO: ATUALIZAR INTERFACE (UI)
// ============================================
// Coleta estado atual dos controles (sliders e rádios) e atualiza todos
// os textos da tela. Calcula o DoD alvo com base na vida útil pedida e
// invoca a função principal de cálculo (calcularSistema) passando o
// DoD convertido para fração (ex: 50% → 0.5).
// Além disso, garante limites corretos para sliders e corrige valores
// fora dos limites (por exemplo, vida útil máx/mín).
function atualizarInterface() {
    // 1. Ler valores dos sliders
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;
    
    const consumo = parseInt(sliderConsumo.value);
    const autonomia = parseInt(sliderAutonomia.value);
    
    // 2. Ajustar limites do slider de Vida Útil baseado no tipo de bateria
    if (tipoBateria === 'litio') {
        sliderVidaUtil.min = "5";
        sliderVidaUtil.max = "25";
    } else {
        sliderVidaUtil.min = "1";
        sliderVidaUtil.max = "5";
    }
    
    // 3. Corrigir valor se estiver fora dos limites
    let vidaUtil = parseFloat(sliderVidaUtil.value);
    const minVida = parseFloat(sliderVidaUtil.min);
    const maxVida = parseFloat(sliderVidaUtil.max);
    
    if (vidaUtil < minVida) {
        vidaUtil = minVida;
        sliderVidaUtil.value = vidaUtil;
    }
    if (vidaUtil > maxVida) {
        vidaUtil = maxVida;
        sliderVidaUtil.value = vidaUtil;
    }

    // 4. Atualizar displays de valor
    document.getElementById('valConsumo').textContent = `${consumo} kWh`;
    
    const textoDias = autonomia === 1 ? 
        (idiomaAtual === 'pt-BR' ? 'dia' : 'giorno') : 
        (idiomaAtual === 'pt-BR' ? 'dias' : 'giorni');
    document.getElementById('valAutonomia').textContent = `${autonomia} ${textoDias}`;

    const textoAnos = vidaUtil === 1 ?
        (idiomaAtual === 'pt-BR' ? 'ano' : 'anno') :
        (idiomaAtual === 'pt-BR' ? 'anos' : 'anni');
    document.getElementById('valVidaUtil').textContent = `${vidaUtil} ${textoAnos}`;

    // 5. Calcular DoD Alvo
    const ciclos = vidaUtil * 365;
    let dodAlvo = obterDoDPorCiclos(ciclos, tipoBateria);

    // Mostra a porcentagem de descarga diária calculada
    const dodExibicao = Math.round(dodAlvo);
    const textoNota = idiomaAtual === 'pt-BR' ? 'DoD Diário' : 'DoD Giornaliero';
    document.getElementById('descVidaUtil').textContent = `${textoNota}: ${dodExibicao}%`;

    // Chama a função principal de cálculo
    calcularSistema(dodAlvo / 100);
}

// ============================================
// FUNÇÃO PRINCIPAL: CALCULAR O SISTEMA
// ============================================
// Esta é a função central do algoritmo que, dado um DoD alvo (fração),
// monta toda a configuração do sistema. As etapas implementadas são:
// 1) Ler valores da UI (consumo, autonomia, tipo de bateria).
// 2) Ler config customizada (ou defaults) — suporta formatos antigos
//    (capacidade em Ah) convertendo para kWh quando necessário.
// 3) Calcular capacidade necessária por dois critérios: vida útil e
//    autonomia; escolher o máximo dos dois.
// 4) Calcular número de baterias (ceil) e ajustar paridade prática.
// 5) Calcular painéis necessários considerando eficiência do sistema
//    e horas de sol pleno (HSP).
// 6) Dimensionar inversor e estimar custos. Finalmente preenche o DOM
//    com os resultados formatados para o idioma atual.
//
// A função tenta ser transparente: também gera frases explicativas
// (motivos) para cada dimensão (baterias, painéis, inversor), que são
// mostradas na UI para educar o usuário sobre o porquê dos números.
/**
 * Função principal que calcula todo o dimensionamento do sistema solar
 * 
 * Esta é a função central do algoritmo. Ela recebe o DoD alvo (em fração decimal,
 * ex: 0.5 para 50%) e calcula:
 * - Quantidade de baterias necessárias
 * - Quantidade de painéis solares necessários
 * - Potência do inversor
 * - Peso total das baterias
 * - Custo estimado do sistema
 * 
 * @param {number} dodAlvo - DoD (Depth of Discharge) alvo em fração decimal (ex: 0.5 para 50%)
 * 
 * Algoritmo resumido:
 * 1. Calcula energia diária necessária (consumo mensal ÷ 30 dias)
 * 2. Calcula capacidade de baterias necessária por dois critérios:
 *    - Critério A: Vida útil (energia diária ÷ DoD)
 *    - Critério B: Autonomia (energia diária × dias de autonomia ÷ DoD)
 *    - Escolhe o maior dos dois (gargalo)
 * 3. Calcula quantidade de baterias (arredonda para cima e garante paridade)
 * 4. Calcula quantidade de painéis (baseado na energia necessária para recarregar o banco)
 * 5. Dimensiona o inversor (mínimo 1kW ou potência dos painéis)
 * 6. Calcula custos e exibe resultados na interface
 */
function calcularSistema(dodAlvo) {
    // ============================================
    // PASSO 1: OBTER VALORES DA INTERFACE
    // ============================================
    // Lê os valores dos sliders e radio buttons da interface do usuário
    const consumoMensal = parseFloat(document.getElementById('sliderConsumo').value) || 0; // Consumo em kWh/mês
    const autonomia = parseInt(document.getElementById('sliderAutonomia').value);           // Dias de autonomia
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;  // 'litio' ou 'chumbo'

    // ============================================
    // PASSO 2: OBTER CONFIGURAÇÃO DOS COMPONENTES
    // ============================================
    // Obtém a configuração customizada do usuário (salva no localStorage) ou usa os valores padrão
    const config = obterConfig();
    
    // Compatibilidade com versões antigas: configurações antigas guardavam capacidade em Ah (ex: 100 Ah)
    // Se a capacidade parecer muito grande (>20), interpreta como Ah e converte para kWh usando a tensão
    // Isso permite que configurações antigas continuem funcionando
    if (config.capacidadeLitio && config.capacidadeLitio > 20 && config.tensaoLitio) {
        config.capacidadeLitioAh = config.capacidadeLitio; // Preserva o valor antigo em Ah
        // Converte Ah para kWh: kWh = (V × Ah) / 1000
        // Exemplo: 48V × 100Ah = 4800 Wh = 4.8 kWh
        config.capacidadeLitio = (config.tensaoLitio * config.capacidadeLitio) / 1000;
    }
    if (config.capacidadeAGM && config.capacidadeAGM > 20 && config.tensaoAGM) {
        config.capacidadeAGMAh = config.capacidadeAGM; // Preserva o valor antigo em Ah
        // Converte Ah para kWh: kWh = (V × Ah) / 1000
        // Exemplo: 12V × 100Ah = 1200 Wh = 1.2 kWh
        config.capacidadeAGM = (config.tensaoAGM * config.capacidadeAGM) / 1000;
    }
    
    // ============================================
    // PASSO 3: MONTAR ESPECIFICAÇÕES DAS BATERIAS
    // ============================================
    // Cria um objeto com todas as especificações da bateria escolhida
    // Suporta capacidade expressa em kWh (padrão novo) mas mantém compatibilidade
    // com configurações antigas que usavam Ah
    const batSpec = (tipoBateria === 'litio')
        ? { 
            v: config.tensaoLitio,                    // Tensão em volts (ex: 48V)
            kwh: config.capacidadeLitio,              // Capacidade em kWh (ex: 4.8 kWh)
            ah: config.capacidadeLitioAh || null,     // Capacidade em Ah (se disponível, para referência)
            price_brl: config.precoLitio,             // Preço unitário em BRL
            weight: config.pesoLitio                  // Peso em kg
          }
        : { 
            v: config.tensaoAGM,                      // Tensão em volts (ex: 12V)
            kwh: config.capacidadeAGM,                // Capacidade em kWh (ex: 1.2 kWh)
            ah: config.capacidadeAGMAh || null,       // Capacidade em Ah (se disponível, para referência)
            price_brl: config.precoAGM,               // Preço unitário em BRL
            weight: config.pesoAGM                    // Peso em kg
          };
    
    // Obtém especificações dos painéis solares
    const POTENCIA_PAINEL = config.potenciaPainel; // Potência de cada painel em Watts (ex: 400W)
    const PRECO_PAINEL = config.precoPainel;       // Preço de cada painel em BRL

    // ============================================
    // PASSO 4: VALIDAÇÃO DE ENTRADA
    // ============================================
    // Se o consumo for inválido (zero ou negativo), zera todos os resultados e sai da função
    if (consumoMensal <= 0) {
        // Zera todos os campos de resultado na interface
        ['resQtdPlacas', 'resQtdBaterias', 'resPotenciaInversor', 'resPesoBaterias'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        // Zera o preço estimado
        document.getElementById('resPrecoEstimado').textContent = `${traducoes[idiomaAtual]['moeda']} 0`;
        return; // Interrompe a execução da função
    }

    // ============================================
    // PASSO 5: CALCULAR ENERGIA DIÁRIA NECESSÁRIA
    // ============================================
    // Converte o consumo mensal para consumo diário médio
    // Divide por 30 para obter a média diária (assumindo 30 dias por mês)
    const energiaDiaria = consumoMensal / 30; // kWh/dia
    
    // ============================================
    // PASSO 6: DIMENSIONAMENTO DAS BATERIAS
    // ============================================
    // O DoD escolhido (via slider de vida útil) afeta AMBOS os critérios:
    // - Quanto menor o DoD, mais baterias são necessárias para a mesma energia utilizável
    // - O DoD limita quanto da capacidade nominal pode ser usada diariamente
    
    // CRITÉRIO A: Vida Útil
    // Calcula a capacidade nominal necessária para 1 dia de consumo com o DoD alvo
    // Fórmula: capacidadeNominal = energiaDiaria / DoD
    // Exemplo: se consumo diário = 10 kWh e DoD = 50% (0.5):
    // capacidadeNominal = 10 / 0.5 = 20 kWh nominais
    // Isso garante que a bateria não seja descarregada além do DoD alvo em um dia normal
    const capVidaUtil = energiaDiaria / dodAlvo;
    
    // CRITÉRIO B: Autonomia
    // Calcula a capacidade nominal necessária para N dias de autonomia com o MESMO DoD
    // Fórmula: capacidadeNominal = (energiaDiaria × autonomia) / DoD
    // Exemplo: se autonomia = 3 dias, consumo = 10 kWh/dia, DoD = 50% (0.5):
    // energiaTotalNecessaria = 10 × 3 = 30 kWh utilizáveis
    // capacidadeNominal = 30 / 0.5 = 60 kWh nominais
    // Isso garante que o sistema funcione por N dias sem sol, respeitando o DoD alvo
    const energiaAutonomia = energiaDiaria * autonomia; // kWh utilizáveis necessários para a autonomia
    const capAutonomia = energiaAutonomia / dodAlvo;    // kWh nominais necessários
    
    // Escolhe o maior requisito (o gargalo)
    // O sistema precisa atender AMBOS os critérios, então escolhemos o maior valor
    // Exemplo: se capVidaUtil = 20 kWh e capAutonomia = 60 kWh, escolhemos 60 kWh
    const capacidadeNecessariaKWh = Math.max(capVidaUtil, capAutonomia);
    
    // ============================================
    // PASSO 7: CALCULAR QUANTIDADE DE BATERIAS
    // ============================================
    // Calcula a energia (capacidade) de uma única bateria
    // Prioriza kWh se disponível; caso contrário, calcula a partir de V × Ah / 1000
    const energiaPorBateria = (typeof batSpec.kwh === 'number' && !isNaN(batSpec.kwh))
        ? batSpec.kwh  // Usa kWh diretamente se disponível
        : ((batSpec.v && batSpec.ah) ? (batSpec.v * batSpec.ah) / 1000 : 0); // Calcula de Ah se necessário
    
    // Calcula a quantidade de baterias necessárias
    // Arredonda para cima (Math.ceil) para garantir que temos capacidade suficiente
    // Exemplo: se precisamos de 60 kWh e cada bateria tem 4.8 kWh:
    // qtdBaterias = ceil(60 / 4.8) = ceil(12.5) = 13 baterias
    let qtdBaterias = Math.ceil(capacidadeNecessariaKWh / energiaPorBateria);
    
    // Garante paridade (número par) para tensões mais altas (24V/48V)
    // Isso facilita a montagem prática do banco de baterias (conexão em série/paralelo)
    // Exemplo: se calculamos 13 baterias, incrementamos para 14 (par)
    if (qtdBaterias % 2 !== 0 && qtdBaterias > 1) qtdBaterias++; // Preferência por pares
    
    // Calcula a capacidade real do banco de baterias instalado
    // Isso pode ser maior que a capacidade necessária devido ao arredondamento e paridade
    // Exemplo: se precisamos de 60 kWh mas instalamos 14 baterias de 4.8 kWh:
    // capacidadeReal = 14 × 4.8 = 67.2 kWh
    const capacidadeRealKWh = qtdBaterias * energiaPorBateria;
    
    // ============================================
    // PASSO 8: DIMENSIONAMENTO DOS PAINÉIS SOLARES
    // ============================================
    // Os painéis precisam gerar energia suficiente para recarregar o banco de baterias
    // em 1 dia de sol. A energia a recarregar é o que foi descarregado = capacidade × DoD
    // Isso já inclui o consumo diário, pois o banco foi dimensionado para isso
    
    // Calcula a energia utilizável do banco de baterias
    // Esta é a energia que pode ser extraída do banco respeitando o DoD alvo
    // Exemplo: se capacidadeReal = 67.2 kWh e DoD = 50% (0.5):
    // energiaUtilizavel = 67.2 × 0.5 = 33.6 kWh utilizáveis
    const energiaUtilizavelBanco = capacidadeRealKWh * dodAlvo;
    
    // Calcula a energia que os painéis devem gerar por dia
    // Considera as perdas do sistema (cabo, controlador, inversor, etc.)
    // Fórmula: energiaGerar = energiaUtilizavel / eficienciaSistema
    // Exemplo: se energiaUtilizavel = 33.6 kWh e eficiencia = 80% (0.8):
    // energiaTotalGerar = 33.6 / 0.8 = 42 kWh/dia
    const energiaTotalGerar = energiaUtilizavelBanco / EFICIENCIA_SISTEMA;
    
    // Calcula a potência solar necessária em Watts
    // Fórmula: potencia = (energia × 1000) / HSP
    // Onde HSP (Horas de Sol Pleno) é o número médio de horas de sol por dia
    // Exemplo: se energiaTotalGerar = 42 kWh/dia e HSP = 5 horas:
    // potenciaSolar = (42 × 1000) / 5 = 8400 W = 8.4 kW
    const potenciaSolarNecessaria = (energiaTotalGerar * 1000) / HSP; // Watts
    
    // Calcula a quantidade de painéis necessários
    // Arredonda para cima para garantir que temos potência suficiente
    // Exemplo: se precisamos de 8400 W e cada painel tem 400 W:
    // qtdPaineis = ceil(8400 / 400) = ceil(21) = 21 painéis
    const qtdPaineis = Math.ceil(potenciaSolarNecessaria / POTENCIA_PAINEL);
    
    // ============================================
    // PASSO 9: DIMENSIONAMENTO DO INVERSOR
    // ============================================
    // O inversor deve aguentar a potência dos painéis + margem para picos
    // Mínimo de 1 kW (requisito prático para sistemas off-grid)
    // Fórmula: potenciaInversor = max(1kW, ceil(potenciaSolar / 1000))
    // Exemplo: se potenciaSolar = 8400 W:
    // potenciaInversor = max(1, ceil(8.4)) = max(1, 9) = 9 kW
    const potenciaInversor = Math.max(1, Math.ceil(potenciaSolarNecessaria / 1000)); // Mínimo 1kW
    
    // ============================================
    // PASSO 10: CALCULAR PESO E CUSTOS
    // ============================================
    // Calcula o peso total das baterias
    // Exemplo: se temos 14 baterias de 60 kg cada:
    // pesoTotal = 14 × 60 = 840 kg
    const pesoTotal = qtdBaterias * batSpec.weight;
    
    // Conversão de moeda: a configuração salva os preços em BRL (Real)
    // Se o idioma for italiano, converte para EUR (Euro) usando a taxa de câmbio
    const moedaCalculo = idiomaAtual === 'pt-BR' ? 'BRL' : 'EUR';
    // Fator de conversão: 1 para BRL (sem conversão) ou 1/taxa para EUR
    // Exemplo: se TAXA_BRL_EUR = 6.19, então 1 BRL = 1/6.19 ≈ 0.1615 EUR
    const fatorConversao = idiomaAtual === 'pt-BR' ? 1 : 1 / TAXA_BRL_EUR;
    
    // Converte os preços unitários para a moeda do idioma
    // Exemplo: se PRECO_PAINEL = 1200 BRL e fatorConversao = 0.1615:
    // precoPainelConvertido = 1200 × 0.1615 ≈ 194 EUR
    const precoPainelConvertido = PRECO_PAINEL * fatorConversao;
    const precoBateriaConvertido = batSpec.price_brl * fatorConversao;
    
    // Calcula os custos totais de cada componente
    // Exemplo: se temos 21 painéis a 1200 BRL cada:
    // custoPaineis = 21 × 1200 = 25200 BRL
    const custoPaineis = qtdPaineis * precoPainelConvertido;
    const custoBaterias = qtdBaterias * precoBateriaConvertido;
    // O preço do inversor é calculado por interpolação baseado na potência
    const custoInversor = calcularPrecoInversor(potenciaInversor, moedaCalculo);
    
    // Calcula o custo total do sistema
    // Exemplo: custoTotal = 25200 + 168000 + 2500 = 195700 BRL
    const custoTotal = custoPaineis + custoBaterias + custoInversor;

    // 6. Exibir Resultados
    document.getElementById('resQtdPlacas').textContent = `${qtdPaineis} x ${POTENCIA_PAINEL}W`;
    // Exibe quantas unidades do módulo escolhido (kWh e tensão)
    const unidadeKWh = (typeof batSpec.kwh === 'number' ? batSpec.kwh.toFixed(1) : (batSpec.ah ? ((batSpec.v * batSpec.ah)/1000).toFixed(1) : '0.0'));
    document.getElementById('resQtdBaterias').textContent = `${qtdBaterias} x ${unidadeKWh} kWh (${batSpec.v}V)`;
    document.getElementById('resPotenciaInversor').textContent = `${potenciaInversor} kW`;
    document.getElementById('resPesoBaterias').textContent = `${pesoTotal} kg`;
    
    const moeda = traducoes[idiomaAtual]['moeda'];
    const formatarPreco = (valor) => `${moeda} ${valor.toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true})}`;
    
    // Exibir custos detalhados
    document.getElementById('resPrecoEstimado').textContent = formatarPreco(custoTotal);
    document.getElementById('custoPaineis').textContent = formatarPreco(custoPaineis);
    document.getElementById('custoBaterias').textContent = formatarPreco(custoBaterias);
    document.getElementById('custoInversor').textContent = formatarPreco(custoInversor);
    
    // Motivo do dimensionamento das BATERIAS — explicita parâmetros que geraram o gargalo
    // Ex: autonomia X dias × consumoDiario Y kWh → utilizável necessário Z kWh → DoD alvo W% → capacidade nominal necessária T kWh → módulos M × S kWh
    let motivoBaterias = '';
    const consumoDiario = energiaDiaria; // kWh/dia
    const capNecessariaRounded = Math.round(capacidadeNecessariaKWh * 100) / 100;
    const energiaPorBatRounded = Math.round(energiaPorBateria * 100) / 100;

    if (autonomia > 1) {
        if (idiomaAtual === 'pt-BR') {
            motivoBaterias = `(gargalo: autonomia) ${autonomia} dia(s) × ${consumoDiario.toFixed(3)} kWh/dia → utilizável necessário ${energiaAutonomia.toFixed(3)} kWh → DoD alvo ${Math.round(dodAlvo * 100)}% → capacidade nominal necessária ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        } else {
            motivoBaterias = `(limite: autonomia) ${autonomia} giorno(i) × ${consumoDiario.toFixed(3)} kWh/giorno → utilizzabile necessario ${energiaAutonomia.toFixed(3)} kWh → DoD target ${Math.round(dodAlvo * 100)}% → capacità nominale necessaria ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        }
    } else {
        // Quando autonomia === 1, o dimensionamento vem da vida útil / DoD desejado
        if (idiomaAtual === 'pt-BR') {
            motivoBaterias = `(gargalo: vida útil) DoD alvo ${Math.round(dodAlvo * 100)}% → energia diária ${consumoDiario.toFixed(3)} kWh → capacidade nominal necessária ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        } else {
            motivoBaterias = `(limite: vita utile) DoD target ${Math.round(dodAlvo * 100)}% → energia giornaliera ${consumoDiario.toFixed(3)} kWh → capacità nominale necessaria ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        }
    }
    document.getElementById('resMotivoBaterias').textContent = motivoBaterias;
    
    // Motivo do dimensionamento dos PAINÉIS — explicita porque exigem essa potência (recarga do banco)
    const energiaUtilBancoRounded = Math.round(energiaUtilizavelBanco * 100) / 100;
    const energiaTotalGerarRounded = Math.round(energiaTotalGerar * 100) / 100;
    const potenciaReqRounded = Math.round(potenciaSolarNecessaria);
    let motivoPaineis = '';
    if (idiomaAtual === 'pt-BR') {
        motivoPaineis = `(gargalo: recarga do banco) banco fornece ${energiaUtilBancoRounded} kWh utilizáveis → com perdas ${energiaTotalGerarRounded} kWh/dia → potência requerida ≈ ${potenciaReqRounded} W → ${qtdPaineis} × ${POTENCIA_PAINEL}W`;
    } else {
        motivoPaineis = `(limite: ricarica banco) banco fornisce ${energiaUtilBancoRounded} kWh utilizzabili → con perdite ${energiaTotalGerarRounded} kWh/giorno → potenza richiesta ≈ ${potenciaReqRounded} W → ${qtdPaineis} × ${POTENCIA_PAINEL}W`;
    }
    document.getElementById('resMotivoPaineis').textContent = motivoPaineis;
    
    // Motivo do dimensionamento do INVERSOR — mostra se é limite mínimo ou potência dos painéis
    const potenciaPaineisKw = (qtdPaineis * POTENCIA_PAINEL) / 1000;
    const potenciaMinimaKw = 1;
    let motivoInversor = '';
    if (potenciaInversor === potenciaMinimaKw && potenciaPaineisKw < potenciaMinimaKw) {
        if (idiomaAtual === 'pt-BR') {
            motivoInversor = `(gargalo: mínimo 1kW) potência dos painéis ${potenciaPaineisKw.toFixed(2)} kW < mínimo exigido ${potenciaMinimaKw} kW`;
        } else {
            motivoInversor = `(limite: minimo 1kW) potenza pannelli ${potenciaPaineisKw.toFixed(2)} kW < minimo richiesto ${potenciaMinimaKw} kW`;
        }
    } else {
        if (idiomaAtual === 'pt-BR') {
            motivoInversor = `(gargalo: potência painéis) painéis fornecem ${potenciaPaineisKw.toFixed(2)} kW → inversor dimensionado ${potenciaInversor} kW`;
        } else {
            motivoInversor = `(limite: potenza pannelli) pannelli forniscono ${potenciaPaineisKw.toFixed(2)} kW → inverter dimensionado ${potenciaInversor} kW`;
        }
    }
    document.getElementById('resMotivoInversor').textContent = motivoInversor;
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar botões de idioma
    document.querySelectorAll('.btn-idioma').forEach(btn => {
        btn.addEventListener('click', () => {
            trocarIdioma(btn.getAttribute('data-lang'));
        });
    });

    // 2. Configurar botões de seta (Arrow Buttons)
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));

        // Função para iniciar a repetição
        const startRepeating = () => {
            ajustarValor(targetId, step); // Primeiro clique imediato
            
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100); // Repete a cada 100ms
            }, 500); // Espera 500ms antes de começar a repetir
        };

        // Função para parar a repetição
        const stopRepeating = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };

        // Eventos de Mouse (PC)
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Evita seleção de texto
            startRepeating();
        });
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);

        // Eventos de Toque (Mobile)
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Evita scroll/zoom
            startRepeating();
        });
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
    });

    // 3. Configurar sliders (eventos de input)
    ['sliderConsumo', 'sliderAutonomia', 'sliderVidaUtil'].forEach(id => {
        document.getElementById(id).addEventListener('input', atualizarInterface);
    });

    // 4. Configurar Radio Buttons (Tipo de Bateria)
    document.querySelectorAll('input[name="tipoBateria"]').forEach(radio => {
        radio.addEventListener('change', atualizarInterface);
    });

    // 5. Inicializar
    trocarIdioma(idiomaAtual);

    // Ripple helper is provided by /ripple.js (global attachRippleTo)
    // ripple attachments centralized in ripple-init.js
});
