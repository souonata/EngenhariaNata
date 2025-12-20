// Função utilitária para formatar moeda SEM DECIMAIS, com conversão BRL→EUR se necessário
// ajustarValorPadrao é carregado via script tag no HTML
function formatarMoedaSemDecimalComConversao(valor, idioma) {
    if (!idioma) {
        const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
        idioma = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');
    }
    let valorConvertido = valor;
    let moeda = 'BRL';
    if (idioma === 'it-IT') {
        // Converte de reais para euros usando taxa global
        const taxa = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.TAXA_BRL_EUR) ? SiteConfig.DEFAULTS.TAXA_BRL_EUR : 6.19;
        valorConvertido = valor / taxa;
        moeda = 'EUR';
        // Força separador de milhares para it-IT
        let partes = Math.round(valorConvertido).toString().split("");
        let resultado = "";
        for (let i = 0; i < partes.length; i++) {
            if ((partes.length - i) % 3 === 0 && i !== 0) resultado += ".";
            resultado += partes[i];
        }
        return resultado + " €";
    } else {
        moeda = 'BRL';
        return new Intl.NumberFormat(idioma, {
            style: 'currency',
            currency: moeda,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(valorConvertido);
    }
}
// ============================================
// DIMENSIONADOR DE AR CONDICIONADO RESIDENCIAL
// Sistema Multi-Split
// ============================================
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: calcular a capacidade necessária de ar condicionado (em BTU)
// para um sistema multi-split residencial baseado em vários fatores:
//  - Área total dos ambientes (soma de todas as áreas)
//  - Número de ambientes (1 a 8)
//  - Altura do pé direito
//  - Número total de pessoas
//  - Número total de equipamentos elétricos
//  - Insolação (exposição ao sol)
//  - Isolamento térmico
//
// Sistema Multi-Split:
// - Calcula BTU total necessário para todos os ambientes
// - Divide BTU total pelo número de ambientes para dimensionar unidades internas
// - Dimensiona unidade externa (condensadora) para atender o BTU total real
// - Permite múltiplas unidades internas por ambiente (até 60k BTU cada)
// - Permite múltiplas unidades externas (até 180k BTU cada)
// - Calcula custo estimado baseado em faixas de preço de mercado
//
// Fórmula base:
// Fator Altura = Altura (m) ÷ 2.7 m (padrão)
// BTU Área Total = Área Total (m²) × 700 BTU/m² × Fator Altura
// BTU Pessoas Total = Número Total de Pessoas × 600 BTU/pessoa
// BTU Equipamentos Total = Número Total de Equipamentos × 600 BTU/equipamento
// BTU Base Total = BTU Área Total + BTU Pessoas Total + BTU Equipamentos Total
// BTU Final Total = BTU Base Total × Fator Insolação × Fator Isolamento
// BTU por Ambiente = BTU Final Total ÷ Número de Ambientes
//
// Fatores:
// - Insolação: Baixa (1.0), Média (1.15), Alta (1.3)
// - Isolamento: Bom (0.8), Médio (1.0), Ruim (1.2)
//
// Limites:
// - Número de ambientes: 1 a 8
// - Área total: 10 a 300 m²
// - Unidades internas: até 60k BTU cada (múltiplas permitidas)
// - Unidades externas: até 180k BTU cada (múltiplas permitidas)

// ============================================
// CONFIGURAÇÃO DE CHAVES E SELETORES
// ============================================
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// ============================================
// CONSTANTES DO SISTEMA
// ============================================

/**
 * ============================================
 * CONSTANTES DE DIMENSIONAMENTO
 * ============================================
 */

/**
 * BTU por metro quadrado (BTU/m²)
 * 
 * Representa a quantidade de energia térmica necessária para resfriar
 * 1 metro quadrado de área de piso em um ambiente residencial.
 * 
 * Este valor é baseado em:
 * - Normas técnicas de climatização (ASHRAE, ABNT)
 * - Práticas da indústria de ar condicionado
 * - Cálculos de carga térmica para ambientes residenciais
 * - Referências da internet e fabricantes (600-800 BTU/m²)
 * 
 * O valor de 700 BTU/m² é uma média que considera:
 * - Transferência de calor através de paredes, teto e piso
 * - Infiltração de ar externo
 * - Ganhos solares através de janelas
 * - Carga térmica interna (pessoas, equipamentos, iluminação)
 * - Altura padrão de pé direito residencial (2.7m)
 * 
 * FÓRMULA: BTU_Área = Área (m²) × 700 BTU/m² × Fator Altura
 * 
 * NOTA: Este valor pode variar dependendo de:
 * - Região climática (maior em regiões quentes)
 * - Tipo de construção (maior em construções antigas)
 * - Orientação solar do ambiente
 * - Altura do pé direito (valores maiores para pé direito alto)
 * 
 * FONTE: Normas técnicas, práticas da indústria e referências online
 */
const BTU_POR_M2 = 700; // BTU por metro quadrado

/**
 * BTU_POR_PESSOA - BTU adicional necessário por pessoa
 * 
 * Representa o calor metabólico gerado por uma pessoa em repouso
 * ou em atividade leve, que precisa ser removido pelo ar condicionado.
 * 
 * O calor gerado por uma pessoa varia conforme:
 * - Atividade física (repouso: ~100 W, atividade leve: ~150 W)
 * - Metabolismo individual
 * - Umidade expirada
 * 
 * O valor de 600 BTU/pessoa é uma média conservadora que considera:
 * - Calor sensível: ~400 BTU/h
 * - Calor latente (umidade): ~200 BTU/h
 * - Total: ~600 BTU/h por pessoa
 * 
 * FÓRMULA: BTU_Pessoas = Número de Pessoas × 600
 * 
 * FONTE: Normas técnicas ASHRAE e práticas da indústria
 */
const BTU_POR_PESSOA = 600; // BTU por pessoa

/**
 * BTU_POR_EQUIPAMENTO - BTU adicional necessário por equipamento elétrico
 * 
 * Representa o calor gerado por equipamentos elétricos que precisa
 * ser removido pelo ar condicionado.
 * 
 * Equipamentos elétricos geram calor porque:
 * - Toda energia elétrica consumida é convertida em calor (lei da conservação)
 * - Eficiência dos equipamentos: parte da energia vira trabalho útil,
 *   mas a maior parte vira calor residual
 * 
 * Exemplos de equipamentos e seu calor gerado:
 * - TV LED 50": ~100-150 W → ~350-500 BTU/h
 * - Computador desktop: ~150-300 W → ~500-1000 BTU/h
 * - Geladeira: ~100-200 W → ~350-700 BTU/h
 * - Lâmpadas incandescentes: ~60-100 W → ~200-350 BTU/h
 * 
 * O valor de 600 BTU/equipamento é uma média conservadora que considera
 * equipamentos típicos de uma residência.
 * 
 * FÓRMULA: BTU_Equipamentos = Número de Equipamentos × 600
 * 
 * NOTA: Para equipamentos de alta potência (forno, secadora, etc.),
 * pode ser necessário considerar valores maiores ou cálculos específicos.
 * 
 * FONTE: Normas técnicas e práticas da indústria
 */
const BTU_POR_EQUIPAMENTO = 600; // BTU por equipamento elétrico

// Fatores de insolação (exposição solar)
// Baseado em normas técnicas e práticas de engenharia:
// - Baixa: ambientes com pouca ou nenhuma exposição solar direta (0% de aumento)
// - Média: ambientes com exposição solar moderada (15% de aumento)
// - Alta: ambientes com muita exposição solar direta, muitas janelas voltadas para o sol (30% de aumento)
const FATORES_INSOLACAO = {
    baixa: 1.0,    // Pouca exposição solar (sem aumento)
    media: 1.15,   // Exposição solar moderada (+15%)
    alta: 1.3      // Muita exposição solar (+30%)
};

// Fatores de isolamento térmico
// Baseado em normas técnicas e práticas de engenharia:
// - Bom: isolamento adequado (lã de vidro, EPS, etc.) reduz transferência de calor (-20%)
// - Médio: isolamento padrão, sem isolamento especial (sem alteração)
// - Ruim: sem isolamento ou muitas aberturas aumenta transferência de calor (+20%)
const FATORES_ISOLAMENTO = {
    bom: 0.8,      // Bom isolamento (reduz necessidade em 20%)
    medio: 1.0,    // Isolamento médio (padrão, sem alteração)
    ruim: 1.2      // Isolamento ruim (aumenta necessidade em 20%)
};

// Modelos comerciais de ar condicionado (BTU)
// Inclui 5000 BTU para áreas muito pequenas (até 2 m²)
// Para unidades internas (splits individuais)
// Limite máximo: 60k BTU por unidade interna
const MODELOS_COMERCIAIS = [5000, 7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];

// Modelos comerciais para unidades externas multi-split (condensadoras)
// Inclui modelos maiores para sistemas multi-split
const MODELOS_COMERCIAIS_EXTERNAS = [18000, 24000, 30000, 36000, 48000, 60000, 72000, 84000, 96000, 120000, 144000, 180000];

// Conversão BTU para kW (1 BTU/h ≈ 0.000293 kW)
const BTU_PARA_KW = 0.000293;

// ============================================
// DICIONÁRIO DE TRADUÇÕES
// ============================================
const traducoes = {
    'pt-BR': {
        'app-title': '❄️ Dimensionador de Ar Condicionado',
        'app-subtitle': 'Cálculo de BTU para Ambientes Residenciais',
        'label-area': 'Área do Ambiente',
        'label-altura': 'Altura do Pé Direito',
        'label-pessoas': 'Número de Pessoas',
        'label-equipamentos': 'Equipamentos Elétricos',
        'label-insolacao': 'Insolação (Exposição ao Sol)',
        'label-isolamento': 'Isolamento Térmico',
        'unit-m2': 'm²',
        'unit-meter': 'm',
        'unit-people': 'pessoas',
        'unit-devices': 'unidades',
        'unit-rooms': 'ambientes',
        'label-sistema-multisplit': '🏢 Sistema Multi-Split',
        'label-num-ambientes': 'Número de Ambientes com Ar Condicionado',
        'label-area-total': 'Soma das Áreas dos Ambientes',
        'dica-num-ambientes': '💡 Número de cômodos/ambientes que terão ar condicionado',
        'dica-area-total': '💡 Soma da área de todos os ambientes que terão ar condicionado',
        'resultado-multisplit-title': '🏢 Sistema Multi-Split',
        'resultado-btu-total': 'BTU Total Necessário:',
        'resultado-unidade-externa': 'Unidade Externa (Condensadora):',
        'resultado-unidades-internas': 'Unidades Internas (Evaporadoras):',
        'resultado-custo-sistema': 'Custo Estimado do Sistema:',
        'detalhamento-custos': '💰 Detalhamento dos Custos:',
        'graficos-title': '📊 Visualizações',
        'grafico-custo-title': 'Distribuição de Custos',
        'grafico-btu-title': 'BTU por Ambiente',
        'custo-unidade-externa': 'Unidade Externa:',
        'custo-unidades-internas': 'Unidades Internas:',
        'dados-tecnicos': '⚙️ Dados Técnicos:',
        'opt-baixa': 'Baixa',
        'opt-media': 'Média',
        'opt-alta': 'Alta',
        'opt-ruim': 'Ruim',
        'opt-medio': 'Médio',
        'opt-bom': 'Bom',
        'dica-altura': '💡 Altura padrão residencial: 2,7m',
        'dica-equipamentos': '💡 TV, computador, geladeira, etc. (cada um conta como 1 unidade)',
        'dica-insolacao': '💡 Alta = muitas janelas voltadas para o sol; Baixa = pouca exposição solar',
        'dica-isolamento': '💡 Bom = isolamento adequado; Ruim = sem isolamento ou muitas aberturas',
        'resultados-title': '📊 Resultados',
        'resultado-btu': 'Capacidade Recomendada:',
        'resultado-potencia': 'Potência Equivalente:',
        'resultado-volume': 'Volume do Ambiente:',
        'resultado-btu-base': 'BTU Base (Volume + Pessoas + Equipamentos):',
        'resultado-btu-final': 'BTU Final (após fatores de insolação e isolamento):',
        'info-modelos': '💡 Modelos Comerciais Comuns:',
        'footer': 'Dimensionador de Ar Condicionado - Engenharia Nata @ 2025',
        'aria-home': 'Voltar para a tela inicial',
        'watermark-dev': '🚧 EM DESENVOLVIMENTO',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'memorial-title': '📚 Memorial de Cálculo - Dimensionamento de Ar Condicionado',
        'memorial-intro-title': '🎯 Objetivo do Dimensionamento',
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculada a capacidade necessária de ar condicionado (em BTU) para um sistema multi-split residencial, considerando área total, altura do pé direito, número de ambientes, pessoas, equipamentos, insolação e isolamento térmico. Todas as fórmulas foram validadas através de testes automatizados.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Volume Total do Sistema',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'O volume total determina a quantidade de ar que precisa ser resfriado em todos os ambientes do sistema. A área total é a soma das áreas de todos os ambientes que terão ar condicionado.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular BTU Base Total',
        'memorial-passo2-explicacao': 'O BTU base é calculado considerando a área (ajustada pela altura do pé direito), o número total de pessoas e equipamentos elétricos. Cada pessoa e equipamento gera calor que precisa ser removido pelo ar condicionado. O fator de altura normaliza o cálculo para pé direito padrão de 2.7m.',
        'memorial-passo3-title': '3️⃣ Passo 3: Aplicar Fatores de Ajuste (Insolação e Isolamento)',
        'memorial-passo3-explicacao': 'Os fatores de insolação e isolamento ajustam a capacidade necessária baseado nas condições dos ambientes. Estes são fatores multiplicadores que refletem o impacto real das condições ambientais na carga térmica. Os fatores são aplicados multiplicando o BTU base: primeiro pela insolação, depois pelo isolamento.',
        'memorial-fatores-title': 'Fatores utilizados:',
        'memorial-fatores-insolacao': 'Insolação: Baixa (1.0), Média (1.15), Alta (1.3) — Baseado em práticas da indústria de refrigeração',
        'memorial-fatores-isolamento': 'Isolamento: Bom (0.8), Médio (1.0), Ruim (1.2) — Baseado em normas técnicas ASHRAE',
        'fator-insolacao-baixa': 'Baixa',
        'fator-insolacao-media': 'Média',
        'fator-insolacao-alta': 'Alta',
        'fator-isolamento-bom': 'Bom',
        'fator-isolamento-medio': 'Médio',
        'fator-isolamento-ruim': 'Ruim',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcular BTU por Ambiente',
        'memorial-passo4-explicacao': 'O BTU final total é dividido pelo número de ambientes para determinar a capacidade necessária de cada unidade interna (evaporadora). Cada split interno será dimensionado para atender sua parte proporcional do sistema.',
        'memorial-modelos-title': 'Modelos comerciais disponíveis:',
        'memorial-modelos-lista': '5.000, 7.000, 9.000, 12.000, 18.000, 24.000, 30.000, 36.000, 48.000, 60.000 BTU',
        'memorial-passo5-title': '5️⃣ Passo 5: Selecionar Modelos Comerciais',
        'memorial-passo5-explicacao': 'O BTU calculado por ambiente é arredondado para cima para o modelo comercial mais próximo. Se o BTU necessário por ambiente exceder 60k BTU (maior modelo interno disponível), serão usadas múltiplas unidades internas de 60k BTU por ambiente. A unidade externa (condensadora) deve ter capacidade para o BTU total real do sistema (soma das capacidades de todas as unidades internas). Se o BTU total exceder 180k BTU (maior modelo externo disponível), serão usadas múltiplas unidades externas de 180k BTU.',
        'memorial-resumo-title': '📊 Resumo Calculado - Sistema Multi-Split',
        'memorial-resumo-volume': 'Volume Total:',
        'memorial-resumo-btu-base': 'BTU Base Total:',
        'memorial-resumo-btu-final-calc': 'BTU Final Total (após fatores):',
        'memorial-resumo-btu-final': 'BTU Recomendado (modelo comercial):',
        'memorial-resumo-potencia': 'Potência (kW):',
        'memorial-passo6-title': '6️⃣ Passo 6: Calcular Custo Estimado',
        'memorial-passo6-explicacao': 'O custo é estimado com base em faixas de preço de mercado (2024-2025) para unidades externas e internas vendidas separadamente. Os valores são médias das faixas de preço pesquisadas.',
        'memorial-resumo-btu-por-ambiente': 'BTU por Ambiente:',
        'memorial-resumo-unidade-interna': 'Unidade Interna (Modelo):',
        'memorial-resumo-btu-total-real': 'BTU Total Real:',
        'memorial-resumo-unidade-externa': 'Unidade Externa (Modelo):',
        'memorial-resumo-custo-total': 'Custo Total Estimado:',
        'memorial-formula-volume': 'Volume Total (m³) = Área Total (m²) × Altura (m)',
        'memorial-formula-fator-altura': 'Fator Altura = Altura (m) ÷ 2.7 m (padrão)',
        'memorial-formula-btu-area': 'BTU Área Total = Área Total (m²) × 700 BTU/m² × Fator Altura',
        'memorial-formula-btu-pessoas': 'BTU Pessoas Total = Número Total de Pessoas × 600 BTU/pessoa',
        'memorial-formula-btu-equipamentos': 'BTU Equipamentos Total = Número Total de Equipamentos × 600 BTU/equipamento',
        'memorial-formula-btu-base': 'BTU Base Total = BTU Área Total + BTU Pessoas Total + BTU Equipamentos Total',
        'memorial-formula-btu-final': 'BTU Final Total = BTU Base Total × Fator Insolação × Fator Isolamento',
        'memorial-btu-por-m2': 'BTU por m²:',
        'memorial-btu-por-m2-texto': '700 BTU/m² — Valor padrão amplamente aceito na indústria para dimensionamento residencial. Este valor é multiplicado pelo fator de altura (altura ÷ 2.7m) para ajustar quando o pé direito é diferente do padrão.',
        'memorial-btu-por-pessoa': 'BTU por Pessoa:',
        'memorial-btu-por-pessoa-texto': '600 BTU/pessoa — Considera calor metabólico (calor sensível ~400 BTU/h + calor latente ~200 BTU/h)',
        'memorial-btu-por-equipamento': 'BTU por Equipamento:',
        'memorial-btu-por-equipamento-texto': '600 BTU/equipamento — Baseado na Lei da Conservação de Energia: toda energia elétrica consumida é convertida em calor',
        'memorial-fatores-afetam-titulo': '💡 Como os fatores afetam o cálculo:',
        'memorial-fatores-insolacao-texto': 'Insolação: Ambientes com maior exposição solar recebem mais calor, aumentando a necessidade de refrigeração. Baixa insolação (1.0) não altera o cálculo. Média insolação (1.15) aumenta em 15%. Alta insolação (1.3) aumenta em 30%.',
        'memorial-fatores-isolamento-texto': 'Isolamento: Bom isolamento (0.8) reduz a necessidade de refrigeração em 20%, pois diminui a transferência de calor entre o ambiente interno e externo. Isolamento médio (1.0) não altera o cálculo. Isolamento ruim (1.2) aumenta a necessidade em 20%.',
        'memorial-lei-fisica-titulo': '⚛️ Lei Física Aplicada — Conservação de Energia e Transferência de Calor:',
        'memorial-lei-fisica-texto': 'Todo equipamento elétrico gera calor porque a energia elétrica consumida é transformada em calor (Lei da Conservação de Energia). O ar condicionado remove esse calor do ambiente interno e transfere para o ambiente externo (Transferência de Calor: calor sempre flui do mais quente para o mais frio).'
    },
    'it-IT': {
        'app-title': '❄️ Dimensionatore Climatizzatore',
        'app-subtitle': 'Calcolo BTU per Ambienti Residenziali',
        'label-area': 'Area Ambiente',
        'label-altura': 'Altezza Soffitto',
        'label-pessoas': 'Numero Persone',
        'label-equipamentos': 'Apparecchi Elettrici',
        'label-insolacao': 'Insolazione (Esposizione Sole)',
        'label-isolamento': 'Isolamento Termico',
        'unit-m2': 'm²',
        'unit-meter': 'm',
        'unit-people': 'persone',
        'unit-devices': 'unità',
        'unit-rooms': 'ambienti',
        'label-sistema-multisplit': '🏢 Sistema Multi-Split',
        'label-num-ambientes': 'Numero Ambienti con Climatizzatore',
        'label-area-total': 'Somma delle Aree degli Ambienti',
        'dica-num-ambientes': '💡 Numero di stanze/ambienti che avranno climatizzatore',
        'dica-area-total': '💡 Somma dell\'area di tutti gli ambienti che avranno climatizzatore',
        'resultado-multisplit-title': '🏢 Sistema Multi-Split',
        'resultado-btu-total': 'BTU Totali Necessari:',
        'resultado-unidade-externa': 'Unità Esterna (Condensatore):',
        'resultado-unidades-internas': 'Unità Interne (Evaporatori):',
        'resultado-custo-sistema': 'Costo Stimato del Sistema:',
        'detalhamento-custos': '💰 Dettaglio dei Costi:',
        'graficos-title': '📊 Visualizzazioni',
        'grafico-custo-title': 'Distribuzione dei Costi',
        'grafico-btu-title': 'BTU per Ambiente',
        'custo-unidade-externa': 'Unità Esterna:',
        'custo-unidades-internas': 'Unità Interne:',
        'dados-tecnicos': '⚙️ Dati Tecnici:',
        'opt-baixa': 'Bassa',
        'opt-media': 'Media',
        'opt-alta': 'Alta',
        'opt-ruim': 'Scarso',
        'opt-medio': 'Medio',
        'opt-bom': 'Buono',
        'dica-altura': '💡 Altezza standard residenziale: 2,7m',
        'dica-equipamentos': '💡 TV, computer, frigorifero, ecc. (ognuno conta come 1 unità)',
        'dica-insolacao': '💡 Alta = molte finestre esposte al sole; Bassa = poca esposizione solare',
        'dica-isolamento': '💡 Buono = isolamento adeguato; Scarso = senza isolamento o molte aperture',
        'resultados-title': '📊 Risultati',
        'resultado-btu': 'Capacità Consigliata:',
        'resultado-potencia': 'Potenza Equivalente:',
        'resultado-volume': 'Volume Ambiente:',
        'resultado-btu-base': 'BTU Base (Volume + Persone + Apparecchi):',
        'resultado-btu-final': 'BTU Finale (dopo fattori insolazione e isolamento):',
        'info-modelos': '💡 Modelli Commerciali Comuni:',
        'footer': 'Dimensionatore Climatizzatore - Engenharia Nata @ 2025',
        'aria-home': 'Torna alla schermata iniziale',
        'watermark-dev': '🚧 IN SVILUPPO',
        'learn-more': 'SCOPRI DI PIÙ!',
        'back': '← Indietro',
        'btn-memorial': 'Vedi Memoriale di Calcolo',
        'memorial-title': '📚 Memoriale di Calcolo - Dimensionamento Climatizzatore',
        'memorial-intro-title': '🎯 Obiettivo del Dimensionamento',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolata la capacità necessaria del climatizzatore (in BTU) per un sistema multi-split residenziale, considerando area totale, altezza del soffitto, numero di ambienti, persone, apparecchi, insolazione e isolamento termico. Tutte le formule sono state validate attraverso test automatizzati.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Volume Totale del Sistema',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'Il volume totale determina la quantità di aria che deve essere raffreddata in tutti gli ambienti del sistema. L\'area totale è la somma delle aree di tutti gli ambienti che avranno climatizzatore.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare BTU Base Totale',
        'memorial-passo2-explicacao': 'Il BTU base è calcolato considerando l\'area (aggiustata per l\'altezza del soffitto), il numero totale di persone e apparecchi elettrici. Ogni persona e apparecchio genera calore che deve essere rimosso dal climatizzatore. Il fattore di altezza normalizza il calcolo per un\'altezza standard del soffitto di 2.7m.',
        'memorial-passo3-title': '3️⃣ Passo 3: Applicare Fattori di Aggiustamento (Insolazione e Isolamento)',
        'memorial-passo3-explicacao': 'I fattori di insolazione e isolamento aggiustano la capacità necessaria in base alle condizioni degli ambienti. Questi sono fattori moltiplicatori che riflettono l\'impatto reale delle condizioni ambientali sul carico termico. I fattori sono applicati moltiplicando il BTU base: prima per l\'insolazione, poi per l\'isolamento.',
        'memorial-fatores-title': 'Fattori utilizzati:',
        'memorial-fatores-insolacao': 'Insolazione: Bassa (1.0), Media (1.15), Alta (1.3) — Basato su pratiche dell\'industria della refrigerazione',
        'memorial-fatores-isolamento': 'Isolamento: Buono (0.8), Medio (1.0), Scarso (1.2) — Basato su norme tecniche ASHRAE',
        'fator-insolacao-baixa': 'Bassa',
        'fator-insolacao-media': 'Media',
        'fator-insolacao-alta': 'Alta',
        'fator-isolamento-bom': 'Buono',
        'fator-isolamento-medio': 'Medio',
        'fator-isolamento-ruim': 'Scarso',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcolare BTU per Ambiente',
        'memorial-passo4-explicacao': 'Il BTU finale totale è diviso per il numero di ambienti per determinare la capacità necessaria di ogni unità interna (evaporatore). Ogni split interno sarà dimensionato per soddisfare la sua parte proporzionale del sistema.',
        'memorial-modelos-title': 'Modelli commerciali disponibili:',
        'memorial-modelos-lista': '5.000, 7.000, 9.000, 12.000, 18.000, 24.000, 30.000, 36.000, 48.000, 60.000 BTU',
        'memorial-passo5-title': '5️⃣ Passo 5: Selezionare Modelli Commerciali',
        'memorial-passo5-explicacao': 'Il BTU calcolato per ambiente viene arrotondato per eccesso al modello commerciale più vicino. Se il BTU necessario per ambiente supera 60k BTU (modello interno più grande disponibile), saranno usate più unità interne da 60k BTU per ambiente. L\'unità esterna (condensatore) deve avere capacità per il BTU totale reale del sistema (somma delle capacità di tutte le unità interne). Se il BTU totale supera 180k BTU (modello esterno più grande disponibile), saranno usate più unità esterne da 180k BTU.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato - Sistema Multi-Split',
        'memorial-resumo-volume': 'Volume Totale:',
        'memorial-resumo-btu-base': 'BTU Base Totale:',
        'memorial-resumo-btu-final-calc': 'BTU Finale Totale (dopo fattori):',
        'memorial-resumo-btu-final': 'BTU Consigliato (modello commerciale):',
        'memorial-resumo-potencia': 'Potenza (kW):',
        'memorial-passo6-title': '6️⃣ Passo 6: Calcolare Costo Stimato',
        'memorial-passo6-explicacao': 'Il costo è stimato sulla base di fasce di prezzo di mercato (2024-2025) per unità esterne e interne vendute separatamente. I valori sono medie delle fasce di prezzo ricercate.',
        'memorial-resumo-btu-por-ambiente': 'BTU per Ambiente:',
        'memorial-resumo-unidade-interna': 'Unità Interna (Modello):',
        'memorial-resumo-btu-total-real': 'BTU Totali Reali:',
        'memorial-resumo-unidade-externa': 'Unità Esterna (Modello):',
        'memorial-resumo-custo-total': 'Costo Totale Stimato:',
        'memorial-formula-volume': 'Volume Totale (m³) = Area Totale (m²) × Altezza (m)',
        'memorial-formula-fator-altura': 'Fattore Altezza = Altezza (m) ÷ 2.7 m (standard)',
        'memorial-formula-btu-area': 'BTU Area Totale = Area Totale (m²) × 700 BTU/m² × Fattore Altezza',
        'memorial-formula-btu-pessoas': 'BTU Persone Totale = Numero Totale di Persone × 600 BTU/persona',
        'memorial-formula-btu-equipamentos': 'BTU Apparecchi Totale = Numero Totale di Apparecchi × 600 BTU/apparecchio',
        'memorial-formula-btu-base': 'BTU Base Totale = BTU Area Totale + BTU Persone Totale + BTU Apparecchi Totale',
        'memorial-formula-btu-final': 'BTU Finale Totale = BTU Base Totale × Fattore Insolazione × Fattore Isolamento',
        'memorial-btu-por-m2': 'BTU per m²:',
        'memorial-btu-por-m2-texto': '700 BTU/m² — Valore standard ampiamente accettato nell\'industria per il dimensionamento residenziale. Questo valore è moltiplicato per il fattore di altezza (altezza ÷ 2.7m) per aggiustare quando l\'altezza del soffitto è diversa dallo standard.',
        'memorial-btu-por-pessoa': 'BTU per Persona:',
        'memorial-btu-por-pessoa-texto': '600 BTU/persona — Considera calore metabolico (calore sensibile ~400 BTU/h + calore latente ~200 BTU/h)',
        'memorial-btu-por-equipamento': 'BTU per Apparecchio:',
        'memorial-btu-por-equipamento-texto': '600 BTU/apparecchio — Basato sulla Legge di Conservazione dell\'Energia: tutta l\'energia elettrica consumata è convertita in calore',
        'memorial-fatores-afetam-titulo': '💡 Come i fattori influenzano il calcolo:',
        'memorial-fatores-insolacao-texto': 'Insolazione: Ambienti con maggiore esposizione solare ricevono più calore, aumentando la necessità di raffreddamento. Insolazione bassa (1.0) non altera il calcolo. Insolazione media (1.15) aumenta del 15%. Insolazione alta (1.3) aumenta del 30%.',
        'memorial-fatores-isolamento-texto': 'Isolamento: Buon isolamento (0.8) riduce la necessità di raffreddamento del 20%, poiché diminuisce il trasferimento di calore tra l\'ambiente interno ed esterno. Isolamento medio (1.0) non altera il calcolo. Isolamento scarso (1.2) aumenta la necessità del 20%.',
        'memorial-lei-fisica-titulo': '⚛️ Legge Fisica Applicata — Conservazione dell\'Energia e Trasferimento di Calore:',
        'memorial-lei-fisica-texto': 'Ogni apparecchio elettrico genera calore perché l\'energia elettrica consumata è trasformata in calore (Legge di Conservazione dell\'Energia). Il climatizzatore rimuove questo calore dall\'ambiente interno e lo trasferisce all\'ambiente esterno (Trasferimento di Calore: il calore fluisce sempre dal più caldo al più freddo).'
    }
};

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula o BTU necessário para o ambiente
 * @param {number} area - Área do ambiente em m²
 * @param {number} altura - Altura do pé direito em metros
 * @param {number} pessoas - Número de pessoas
 * @param {number} equipamentos - Número de equipamentos elétricos
 * @param {string} insolacao - Nível de insolação ('baixa', 'media', 'alta')
 * @param {string} isolamento - Nível de isolamento ('bom', 'medio', 'ruim')
 * @returns {Object} Objeto com BTU recomendado, potência em kW, volume e BTU base
 */
function calcularBTU(area, altura, pessoas, equipamentos, insolacao, isolamento) {
    // PASSO 1: Calcular BTU base por área (área × 700 BTU/m²)
    // Ajusta o BTU por m² baseado na altura do pé direito (fator de correção)
    const fatorAltura = altura / 2.7; // Normaliza para pé direito padrão de 2.7m
    const btuArea = area * BTU_POR_M2 * fatorAltura;
    
    // PASSO 2: Adicionar BTU por pessoas
    const btuPessoas = pessoas * BTU_POR_PESSOA;
    
    // PASSO 3: Adicionar BTU por equipamentos
    const btuEquipamentos = equipamentos * BTU_POR_EQUIPAMENTO;
    
    // PASSO 4: Calcular BTU base total (antes dos fatores)
    const btuBase = btuArea + btuPessoas + btuEquipamentos;
    
    // PASSO 5: Calcular volume para exibição (mantido para compatibilidade)
    const volume = area * altura; // m³
    
    // PASSO 6: Aplicar fatores de insolação e isolamento
    // Estes fatores são multiplicadores que ajustam a carga térmica baseada nas condições ambientais
    const fatorInsolacao = FATORES_INSOLACAO[insolacao] || 1.0;
    const fatorIsolamento = FATORES_ISOLAMENTO[isolamento] || 1.0;
    
    // PASSO 7: Calcular BTU final
    // Multiplica o BTU base pelos fatores de insolação e isolamento
    // Exemplo: 20.000 BTU × 1.15 (insolação média) × 0.8 (isolamento bom) = 18.400 BTU
    const btuFinal = btuBase * fatorInsolacao * fatorIsolamento;
    
    // PASSO 8: Selecionar modelo comercial mais próximo (arredondar para cima)
    const btuRecomendado = selecionarModeloComercial(btuFinal);
    
    // PASSO 9: Converter para kW
    const potenciaKw = btuRecomendado * BTU_PARA_KW;
    
    return {
        btuRecomendado: btuRecomendado,
        potenciaKw: potenciaKw,
        volume: volume,
        btuBase: btuBase,
        btuFinal: btuFinal  // BTU após aplicar fatores, antes do arredondamento
    };
}

/**
 * Seleciona o modelo comercial de ar condicionado mais próximo
 * Sempre arredonda para cima (modelo maior ou igual)
 * @param {number} btuNecessario - BTU necessário calculado
 * @returns {number} BTU do modelo comercial recomendado
 */
function selecionarModeloComercial(btuNecessario) {
    // Percorre os modelos comerciais do menor para o maior
    // Retorna o primeiro que seja maior ou igual ao necessário
    for (let i = 0; i < MODELOS_COMERCIAIS.length; i++) {
        if (MODELOS_COMERCIAIS[i] >= btuNecessario) {
            return MODELOS_COMERCIAIS[i];
        }
    }
    
    // Se nenhum modelo atender, retorna o maior disponível
    return MODELOS_COMERCIAIS[MODELOS_COMERCIAIS.length - 1];
}

/**
 * Encontra a melhor combinação de modelos comerciais para atingir um valor alvo
 * Versão simplificada: usa o maior modelo disponível quando necessário múltiplas unidades
 * @param {number} valorAlvo - Valor em BTU que precisa ser atingido
 * @param {Array<number>} modelos - Array de modelos comerciais disponíveis
 * @param {number} maxUnidades - Número máximo de unidades a considerar (padrão: 10)
 * @returns {Object} Objeto com {combinacao: Array<number>, total: number, quantidade: number}
 *                   onde combinacao é o array de modelos usados, total é a soma, quantidade é o número de unidades
 */
function encontrarMelhorCombinacao(valorAlvo, modelos, maxUnidades = 10) {
    // Se o valor alvo for menor ou igual ao menor modelo, retorna apenas esse modelo
    if (valorAlvo <= modelos[0]) {
        return {
            combinacao: [modelos[0]],
            total: modelos[0],
            quantidade: 1
        };
    }
    
    // Se o valor alvo for menor ou igual ao maior modelo, retorna o modelo mais próximo
    const maiorModelo = modelos[modelos.length - 1];
    if (valorAlvo <= maiorModelo) {
        for (let i = 0; i < modelos.length; i++) {
            if (modelos[i] >= valorAlvo) {
                return {
                    combinacao: [modelos[i]],
                    total: modelos[i],
                    quantidade: 1
                };
            }
        }
    }
    
    // Para valores maiores que o maior modelo, usa múltiplas unidades do maior modelo
    const numUnidades = Math.ceil(valorAlvo / maiorModelo);
    const combinacao = Array(numUnidades).fill(maiorModelo);
    
    return {
        combinacao: combinacao,
        total: maiorModelo * numUnidades,
        quantidade: numUnidades
    };
}

/**
 * Seleciona o modelo comercial de unidade externa multi-split mais próximo
 * Sempre arredonda para cima (modelo maior ou igual)
 * @param {number} btuNecessario - BTU necessário calculado
 * @returns {Object} Objeto com {combinacao: Array<number>, total: number, quantidade: number}
 */
function selecionarModeloComercialExterna(btuNecessario) {
    // Tenta encontrar um modelo único primeiro
    for (let i = 0; i < MODELOS_COMERCIAIS_EXTERNAS.length; i++) {
        if (MODELOS_COMERCIAIS_EXTERNAS[i] >= btuNecessario) {
            return {
                combinacao: [MODELOS_COMERCIAIS_EXTERNAS[i]],
                total: MODELOS_COMERCIAIS_EXTERNAS[i],
                quantidade: 1
            };
        }
    }
    
    // Se não encontrou modelo único, usa múltiplas unidades do maior modelo
    const maiorModelo = MODELOS_COMERCIAIS_EXTERNAS[MODELOS_COMERCIAIS_EXTERNAS.length - 1];
    const numUnidades = Math.ceil(btuNecessario / maiorModelo);
    const combinacao = Array(numUnidades).fill(maiorModelo);
    
    return {
        combinacao: combinacao,
        total: maiorModelo * numUnidades,
        quantidade: numUnidades
    };
}

/**
 * Converte string numérica para número, aceitando tanto ponto quanto vírgula como decimal
 * Usa a função global converterValorFormatadoParaNumero do site-config.js
 * @param {string} valorTexto - Valor como string (pode ter ponto ou vírgula)
 * @returns {number} Valor numérico
 */
function converterParaNumero(valorTexto) {
    if (!valorTexto) return NaN;
    const resultado = converterValorFormatadoParaNumero(valorTexto);
    return isNaN(resultado) ? NaN : resultado;
}

// Função formatarNumero agora está em assets/js/site-config.js
// Usa diretamente a função global formatarNumero(valor, casasDecimais = 0)

/**
 * Formata BTU para exibição com notação "k" quando >= 1000
 * Exemplos: 999 → "999 BTU", 5000 → "5k BTU", 12000 → "12k BTU", 24000 → "24k BTU"
 * @param {number} valor - Valor em BTU
 * @returns {string} Valor formatado com "BTU"
 */
function formatarBTU(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    // Usa a função genérica formatarNumeroComSufixo para consistência
    return formatarNumeroComSufixo(valor, 1) + ' BTU';
}

/**
 * Formata número com casas decimais
 * Usa a função global formatarNumeroDecimal do site-config.js
 * Sempre usa vírgula como separador decimal (padrão brasileiro)
 * @param {number} valor - Valor numérico
 * @param {number} decimais - Número de casas decimais
 * @returns {string} Valor formatado com vírgula
 */
// Função formatarDecimal - alias para formatarNumeroDecimal de site-config.js
// Mantida para compatibilidade com código existente
function formatarDecimal(valor, decimais = 1) {
    return formatarNumeroDecimal(valor, decimais);
}

/**
 * Calcula o dimensionamento e custo do sistema multi-split
 * 
 * IMPORTANTE: Em sistemas multi-split, os componentes são vendidos separadamente:
 * - 1 Unidade Externa (Condensadora): Serve múltiplas unidades internas, mais cara
 * - N Unidades Internas (Evaporadoras): Uma para cada ambiente, vendidas separadamente
 * 
 * O custo total = Custo da Unidade Externa + (Custo de cada Unidade Interna × Quantidade)
 * 
 * @param {number} numAmbientes - Número de ambientes com ar condicionado
 * @param {number} areaTotal - SOMA das áreas de todos os ambientes em m² (já é a soma total)
 * @param {number} altura - Altura do pé direito em metros
 * @param {number} pessoas - Número de pessoas (distribuídas entre os ambientes)
 * @param {number} equipamentos - Número de equipamentos (distribuídos entre os ambientes)
 * @param {string} insolacao - Nível de insolação
 * @param {string} isolamento - Nível de isolamento
 * @returns {Object} Objeto com BTU total, unidade externa, unidades internas e custo
 */
function calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento) {
    // IMPORTANTE: areaTotal já é a SOMA de todas as áreas dos ambientes
    // 
    // LÓGICA CORRIGIDA:
    // 1. Calcula o BTU total necessário para toda a área (considerando pessoas e equipamentos totais)
    // 2. Divide o BTU total pelo número de ambientes para obter o BTU por ambiente
    // 3. A unidade externa deve ter capacidade para o BTU total do sistema
    
    // Calcula BTU total do sistema considerando a área total
    // Usa pessoas e equipamentos totais (não divididos) para calcular a carga térmica total
    // Ajusta o BTU por m² baseado na altura do pé direito (fator de correção)
    const fatorAltura = altura / 2.7; // Normaliza para pé direito padrão de 2.7m
    const btuAreaTotal = areaTotal * BTU_POR_M2 * fatorAltura;
    const btuPessoasTotal = pessoas * BTU_POR_PESSOA;
    const btuEquipamentosTotal = equipamentos * BTU_POR_EQUIPAMENTO;
    const btuBaseTotal = btuAreaTotal + btuPessoasTotal + btuEquipamentosTotal;
    
    // Aplica fatores de insolação e isolamento
    const fatorInsolacao = FATORES_INSOLACAO[insolacao] || 1.0;
    const fatorIsolamento = FATORES_ISOLAMENTO[isolamento] || 1.0;
    const btuFinalTotal = btuBaseTotal * fatorInsolacao * fatorIsolamento;
    
    // BTU total necessário para o sistema (antes de dividir por ambientes)
    const btuTotal = btuFinalTotal;
    
    // Calcula BTU por ambiente (divide o total pelo número de ambientes)
    // Cada split interno será dimensionado para atender sua parte proporcional
    const btuPorAmbienteCalculado = btuTotal / numAmbientes;
    
    // Encontra a melhor combinação de modelos comerciais para cada ambiente
    // Limite máximo: 60k BTU por unidade interna
    const combinacaoPorAmbiente = encontrarMelhorCombinacao(btuPorAmbienteCalculado, MODELOS_COMERCIAIS, 10);
    
    // Agrupa as unidades internas por modelo para facilitar o cálculo de custo
    const unidadesInternasPorModelo = {};
    combinacaoPorAmbiente.combinacao.forEach(modelo => {
        unidadesInternasPorModelo[modelo] = (unidadesInternasPorModelo[modelo] || 0) + numAmbientes;
    });
    
    // Total de unidades internas no sistema
    const unidadesInternas = combinacaoPorAmbiente.quantidade * numAmbientes;
    
    // BTU total real do sistema = soma das capacidades de todas as unidades internas
    const btuTotalReal = combinacaoPorAmbiente.total * numAmbientes;
    
    // Unidade externa (condensadora/máquina de fora) deve ter capacidade para o BTU total real
    // Usa combinação inteligente de modelos quando necessário
    const combinacaoExterna = selecionarModeloComercialExterna(btuTotalReal);
    const numUnidadesExternas = combinacaoExterna.quantidade;
    
    // Faixas de preço para UNIDADES EXTERNAS MULTI-SPLIT (condensadoras)
    // Valores baseados em condensadoras multi-split vendidas separadamente
    // Nota: Unidades externas multi-split são mais caras que splits simples porque
    // precisam ter capacidade para múltiplas unidades internas
    const faixasPrecoExternas = {
        18000: { min: 4000, max: 8000 },    // Condensadora 18k BTU multi-split
        24000: { min: 5000, max: 10000 },   // Condensadora 24k BTU multi-split
        30000: { min: 8000, max: 15000 },   // Condensadora 30k BTU multi-split
        36000: { min: 10000, max: 18000 },  // Condensadora 36k BTU multi-split
        48000: { min: 12000, max: 22000 },  // Condensadora 48k BTU multi-split
        60000: { min: 18000, max: 35000 },  // Condensadora 60k BTU multi-split
        72000: { min: 22000, max: 42000 },  // Condensadora 72k BTU multi-split
        84000: { min: 28000, max: 50000 },  // Condensadora 84k BTU multi-split
        96000: { min: 35000, max: 60000 },  // Condensadora 96k BTU multi-split
        120000: { min: 45000, max: 75000 }, // Condensadora 120k BTU multi-split
        144000: { min: 55000, max: 90000 }, // Condensadora 144k BTU multi-split
        180000: { min: 70000, max: 120000 } // Condensadora 180k BTU multi-split
    };
    
    // Faixas de preço para UNIDADES INTERNAS (evaporadoras) vendidas separadamente
    // Valores baseados em evaporadoras vendidas individualmente para multi-split
    // Nota: Unidades internas são mais baratas que splits completos porque
    // não incluem a unidade externa
    // Limite máximo: 60k BTU por unidade interna
    const faixasPrecoInternas = {
        5000: { min: 1000, max: 1800 },    // Evaporadora 5k BTU
        7000: { min: 1100, max: 1900 },    // Evaporadora 7k BTU
        9000: { min: 1200, max: 2000 },    // Evaporadora 9k BTU
        12000: { min: 1500, max: 2500 },   // Evaporadora 12k BTU
        18000: { min: 2000, max: 3500 },   // Evaporadora 18k BTU
        24000: { min: 2500, max: 4500 },   // Evaporadora 24k BTU
        30000: { min: 3500, max: 6000 },   // Evaporadora 30k BTU
        36000: { min: 4000, max: 7000 },   // Evaporadora 36k BTU
        48000: { min: 5000, max: 9000 },   // Evaporadora 48k BTU
        60000: { min: 6500, max: 12000 }   // Evaporadora 60k BTU
    };
    
    // Custo das unidades externas multi-split (condensadoras)
    // Calcula custo considerando a combinação de modelos
    let custoTotalUnidadesExternas = 0;
    combinacaoExterna.combinacao.forEach(modelo => {
        let faixaExterna = faixasPrecoExternas[modelo];
        if (!faixaExterna) {
            // Estimativa: R$ 300 por 1000 BTU para unidades externas multi-split
            const estimativaMin = (modelo / 1000) * 300;
            const estimativaMax = (modelo / 1000) * 600;
            faixaExterna = { min: estimativaMin, max: estimativaMax };
        }
        const custoPorUnidade = (faixaExterna.min + faixaExterna.max) / 2;
        custoTotalUnidadesExternas += custoPorUnidade;
    });
    
    // Custo das unidades internas (evaporadoras)
    // Calcula custo considerando a combinação de modelos por ambiente
    let custoTotalUnidadesInternas = 0;
    Object.keys(unidadesInternasPorModelo).forEach(modeloBTU => {
        const modelo = parseInt(modeloBTU);
        const quantidade = unidadesInternasPorModelo[modelo];
        let faixaInterna = faixasPrecoInternas[modelo];
        if (!faixaInterna) {
            // Estimativa: R$ 150 por 1000 BTU para unidades internas
            const estimativaMin = (modelo / 1000) * 150;
            const estimativaMax = (modelo / 1000) * 250;
            faixaInterna = { min: estimativaMin, max: estimativaMax };
        }
        const custoPorUnidade = (faixaInterna.min + faixaInterna.max) / 2;
        custoTotalUnidadesInternas += custoPorUnidade * quantidade;
    });
    
    // Custo total do sistema
    const custoTotal = custoTotalUnidadesExternas + custoTotalUnidadesInternas;
    
    // Calcula custo médio por unidade externa para exibição
    const custoPorUnidadeExterna = numUnidadesExternas > 0 
        ? custoTotalUnidadesExternas / numUnidadesExternas 
        : 0;
    
    return {
        btuTotal: btuTotalReal, // BTU total real (soma das capacidades de todas as unidades internas)
        btuTotalCalculado: btuTotal, // BTU total calculado (antes do arredondamento)
        numUnidadesExternas: numUnidadesExternas,
        combinacaoExterna: combinacaoExterna.combinacao,
        btuTotalExterno: combinacaoExterna.total,
        unidadesInternas: unidadesInternas,
        unidadesInternasPorAmbiente: combinacaoPorAmbiente.quantidade,
        combinacaoInterna: combinacaoPorAmbiente.combinacao,
        unidadesInternasPorModelo: unidadesInternasPorModelo,
        custoTotal: custoTotal,
        custoTotalUnidadesExternas: custoTotalUnidadesExternas,
        custoPorUnidadeExterna: custoPorUnidadeExterna,
        custoTotalUnidadesInternas: custoTotalUnidadesInternas
    };
}

/**
 * Atualiza os resultados na interface
 */
function atualizarResultados() {
    try {
    // Obtém valores dos inputs ou sliders
    const inputArea = document.getElementById('inputArea');
    const inputAltura = document.getElementById('inputAltura');
    const inputPessoas = document.getElementById('inputPessoas');
    const inputEquipamentos = document.getElementById('inputEquipamentos');
    const inputNumAmbientes = document.getElementById('inputNumAmbientes');
    const inputAreaTotal = document.getElementById('inputAreaTotal');
    
    const sliderArea = document.getElementById('sliderArea');
    const sliderAltura = document.getElementById('sliderAltura');
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderEquipamentos = document.getElementById('sliderEquipamentos');
    const sliderNumAmbientes = document.getElementById('sliderNumAmbientes');
    const sliderAreaTotal = document.getElementById('sliderAreaTotal');
    
    // Lê valores do sistema multi-split primeiro
    let numAmbientes = parseInt(sliderNumAmbientes?.value || 1);
    if (inputNumAmbientes && inputNumAmbientes.value && !isNaN(parseInt(inputNumAmbientes.value))) {
        numAmbientes = parseInt(inputNumAmbientes.value);
    }
    
    let areaTotal = parseFloat(sliderAreaTotal?.value || 20);
    if (inputAreaTotal && inputAreaTotal.value) {
        const valorConvertido = converterParaNumero(inputAreaTotal.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            areaTotal = valorConvertido;
        }
    }
    
    // Controla visibilidade dos inputs de área
    const grupoAreaIndividual = document.getElementById('grupoAreaIndividual');
    const grupoAreaTotal = document.getElementById('grupoAreaTotal');
    
    if (grupoAreaIndividual) {
        if (numAmbientes > 1) {
            grupoAreaIndividual.style.display = 'none';
        } else {
            grupoAreaIndividual.style.display = 'block';
        }
    }
    
    if (grupoAreaTotal) {
        if (numAmbientes > 1) {
            grupoAreaTotal.style.display = 'block';
        } else {
            grupoAreaTotal.style.display = 'none';
        }
    }
    
    // Sempre usa areaTotal no cálculo (para 1 ambiente, sincroniza com área individual)
    if (numAmbientes === 1 && sliderArea) {
        // Quando é split simples (1 ambiente), sincroniza areaTotal com área individual
        const areaIndividual = parseFloat(sliderArea.value) || 20;
        if (inputArea && inputArea.value) {
            const valorConvertido = converterParaNumero(inputArea.value);
            if (!isNaN(valorConvertido) && valorConvertido > 0) {
                areaTotal = valorConvertido;
            } else {
                areaTotal = areaIndividual;
            }
        } else {
            areaTotal = areaIndividual;
        }
        // Sincroniza o sliderAreaTotal e inputAreaTotal com o valor individual
        if (sliderAreaTotal) sliderAreaTotal.value = areaTotal;
        if (inputAreaTotal) inputAreaTotal.value = Math.round(areaTotal);
    }
    
    let altura = sliderAltura ? parseFloat(sliderAltura.value) : 2.7;
    if (inputAltura && inputAltura.value) {
        const valorConvertido = converterParaNumero(inputAltura.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            altura = valorConvertido;
        }
    }
    
    let pessoas = sliderPessoas ? parseInt(sliderPessoas.value) : 2;
    if (inputPessoas && inputPessoas.value && !isNaN(parseInt(inputPessoas.value))) {
        pessoas = parseInt(inputPessoas.value);
    }
    
    let equipamentos = sliderEquipamentos ? parseInt(sliderEquipamentos.value) : 2;
    if (inputEquipamentos && inputEquipamentos.value && !isNaN(parseInt(inputEquipamentos.value))) {
        equipamentos = parseInt(inputEquipamentos.value);
    }
    
    // Obtém valores dos radio buttons
    const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
    const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
    
    // Calcula e atualiza sistema multi-split (sempre, mesmo para 1 ambiente)
    let resultadoMultisplit;
    try {
        resultadoMultisplit = calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento);
    } catch (error) {
        console.error('[Ar Condicionado] Erro ao calcular sistema:', error);
        resultadoMultisplit = null;
    }
    
    // Verifica se o resultado é válido
    if (!resultadoMultisplit || typeof resultadoMultisplit !== 'object') {
        console.error('[Ar Condicionado] Erro: resultadoMultisplit inválido', resultadoMultisplit);
        // Mesmo com erro, tenta limpar os campos
        const elemCustoSistema = document.getElementById('custoSistemaMultisplit');
        if (elemCustoSistema) elemCustoSistema.textContent = '-';
        const elemBtuTotal = document.getElementById('btuTotalMultisplit');
        if (elemBtuTotal) elemBtuTotal.textContent = '-';
        const elemUnidadeExterna = document.getElementById('unidadeExternaMultisplit');
        if (elemUnidadeExterna) elemUnidadeExterna.textContent = '-';
        const elemUnidadesInternas = document.getElementById('unidadesInternasMultisplit');
        if (elemUnidadesInternas) elemUnidadesInternas.textContent = '-';
        return;
    }
    
    // Custo total em destaque
    const elemCustoSistema = document.getElementById('custoSistemaMultisplit');
    if (elemCustoSistema) {
        elemCustoSistema.textContent = formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotal, idiomaAtual);
    }
    
    // Detalhamento dos custos
    const textoUnidadesExternas = resultadoMultisplit.numUnidadesExternas > 1 
        ? `${resultadoMultisplit.numUnidadesExternas} × ${formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoPorUnidadeExterna, idiomaAtual)}`
        : formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotalUnidadesExternas, idiomaAtual);
    const elemCustoUnidadeExterna = document.getElementById('custoUnidadeExternaMultisplit');
    if (elemCustoUnidadeExterna) {
        elemCustoUnidadeExterna.textContent = textoUnidadesExternas;
    }
    const elemCustoUnidadesInternas = document.getElementById('custoUnidadesInternasMultisplit');
    if (elemCustoUnidadesInternas) {
        elemCustoUnidadesInternas.textContent = formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotalUnidadesInternas, idiomaAtual);
    }
    
    // Dados técnicos
    const elemBtuTotal = document.getElementById('btuTotalMultisplit');
    if (elemBtuTotal) {
        elemBtuTotal.textContent = formatarBTU(Math.round(resultadoMultisplit.btuTotal));
    }
    
    // Formata unidade(s) externa(s)
    let textoUnidadeExterna;
    if (resultadoMultisplit.numUnidadesExternas > 1) {
        // Agrupa modelos iguais para exibição
        const modelosAgrupados = {};
        resultadoMultisplit.combinacaoExterna.forEach(modelo => {
            modelosAgrupados[modelo] = (modelosAgrupados[modelo] || 0) + 1;
        });
        const partes = Object.keys(modelosAgrupados).map(modelo => {
            const qtd = modelosAgrupados[modelo];
            return qtd > 1 ? `${qtd} × ${formatarBTU(parseInt(modelo))}` : formatarBTU(parseInt(modelo));
        });
        textoUnidadeExterna = partes.join(' + ');
    } else {
        textoUnidadeExterna = formatarBTU(resultadoMultisplit.combinacaoExterna[0]);
    }
    const elemUnidadeExterna = document.getElementById('unidadeExternaMultisplit');
    if (elemUnidadeExterna) {
        elemUnidadeExterna.textContent = textoUnidadeExterna;
    }
    
    // Formata unidade(s) interna(s)
    let textoUnidadesInternas;
    if (resultadoMultisplit.unidadesInternasPorAmbiente > 1) {
        // Mostra a combinação por ambiente
        const partesCombinacao = [];
        resultadoMultisplit.combinacaoInterna.forEach(modelo => {
            partesCombinacao.push(formatarBTU(modelo));
        });
        const combinacaoTexto = partesCombinacao.join(' + ');
        textoUnidadesInternas = `${resultadoMultisplit.unidadesInternas} unidades (${resultadoMultisplit.unidadesInternasPorAmbiente} por ambiente: ${combinacaoTexto})`;
    } else {
        // Agrupa modelos iguais para exibição
        const modelosAgrupados = {};
        Object.keys(resultadoMultisplit.unidadesInternasPorModelo).forEach(modelo => {
            modelosAgrupados[modelo] = resultadoMultisplit.unidadesInternasPorModelo[modelo];
        });
        const partes = Object.keys(modelosAgrupados).map(modelo => {
            const qtd = modelosAgrupados[modelo];
            return qtd > 1 ? `${qtd} × ${formatarBTU(parseInt(modelo))}` : formatarBTU(parseInt(modelo));
        });
        textoUnidadesInternas = partes.join(' + ');
    }
    const elemUnidadesInternas = document.getElementById('unidadesInternasMultisplit');
    if (elemUnidadesInternas) {
        elemUnidadesInternas.textContent = textoUnidadesInternas;
    }
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
    
    // Atualiza os gráficos
    atualizarGraficosArCondicionado(resultadoMultisplit, numAmbientes);
    } catch (error) {
        console.error('[Ar Condicionado] Erro em atualizarResultados:', error);
        console.error('[Ar Condicionado] Stack trace:', error.stack);
    }
}

// Variáveis globais para gráficos
let graficoCustoArCondicionado = null;
let graficoBTUArCondicionado = null;

/**
 * Atualiza os gráficos de visualização do sistema de ar condicionado
 * @param {Object} resultadoMultisplit - Resultado do cálculo do sistema multi-split
 * @param {number} numAmbientes - Número de ambientes
 */
function atualizarGraficosArCondicionado(resultadoMultisplit, numAmbientes) {
    if (!resultadoMultisplit) return;
    
    // Carrega Chart.js dinamicamente se ainda não estiver carregado
    if (typeof Chart === 'undefined') {
        if (typeof carregarChartJS === 'function') {
            carregarChartJS(() => {
                atualizarGraficosArCondicionado(resultadoMultisplit, numAmbientes);
            });
        }
        return;
    }
    
    // Atualiza gráfico de pizza: Distribuição de custos
    atualizarGraficoCusto(resultadoMultisplit);
    
    // Atualiza gráfico de barras: BTU por ambiente
    atualizarGraficoBTU(resultadoMultisplit, numAmbientes);
}

/**
 * Cria ou atualiza o gráfico de pizza de distribuição de custos
 * @param {Object} resultadoMultisplit - Resultado do cálculo
 */
function atualizarGraficoCusto(resultadoMultisplit) {
    const ctx = document.getElementById('graficoCustoArCondicionado');
    if (!ctx) return;
    
    // Destruir gráfico anterior se existir
    if (graficoCustoArCondicionado) {
        graficoCustoArCondicionado.destroy();
    }
    
    const custoExterno = resultadoMultisplit.custoTotalUnidadesExternas || 0;
    const custoInterno = resultadoMultisplit.custoTotalUnidadesInternas || 0;
    
    // Não criar gráfico se não houver dados
    if (custoExterno === 0 && custoInterno === 0) return;
    
    graficoCustoArCondicionado = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: [
                idiomaAtual === 'pt-BR' ? 'Unidade Externa' : 'Unità Esterna',
                idiomaAtual === 'pt-BR' ? 'Unidades Internas' : 'Unità Interne'
            ],
            datasets: [{
                data: [custoExterno, custoInterno],
                backgroundColor: [
                    'rgba(25, 118, 210, 0.8)',  // Azul para externa
                    'rgba(255, 152, 0, 0.8)'     // Laranja para internas
                ],
                borderColor: [
                    'rgba(25, 118, 210, 1)',
                    'rgba(255, 152, 0, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            const moeda = idiomaAtual === 'it-IT' ? '€' : 'R$';
                            return `${label}: ${formatarMoedaSemDecimalComConversao(value, idiomaAtual)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Cria ou atualiza o gráfico de barras de BTU por ambiente
 * @param {Object} resultadoMultisplit - Resultado do cálculo
 * @param {number} numAmbientes - Número de ambientes
 */
function atualizarGraficoBTU(resultadoMultisplit, numAmbientes) {
    const ctx = document.getElementById('graficoBTUArCondicionado');
    if (!ctx) return;
    
    // Destruir gráfico anterior se existir
    if (graficoBTUArCondicionado) {
        graficoBTUArCondicionado.destroy();
    }
    
    // Calcula BTU por ambiente
    const btuPorAmbiente = resultadoMultisplit.btuTotalCalculado / numAmbientes;
    
    // Cria labels para cada ambiente
    const labels = [];
    const dados = [];
    for (let i = 1; i <= numAmbientes; i++) {
        labels.push(`${idiomaAtual === 'pt-BR' ? 'Ambiente' : 'Ambiente'} ${i}`);
        dados.push(Math.round(btuPorAmbiente));
    }
    
    // Não criar gráfico se não houver dados
    if (dados.length === 0) return;
    
    graficoBTUArCondicionado = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: idiomaAtual === 'pt-BR' ? 'BTU Necessário' : 'BTU Necessario',
                data: dados,
                backgroundColor: 'rgba(25, 118, 210, 0.6)',
                borderColor: 'rgba(25, 118, 210, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${formatarBTU(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'BTU' : 'BTU',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return formatarBTU(value);
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'Ambientes' : 'Ambienti',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

/**
 * Troca o idioma da interface
 * @param {string} novoIdioma - Código do idioma ('pt-BR' ou 'it-IT')
 */
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    // Atualiza todos os elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza botões de idioma (ativação visual)
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualiza resultados (sempre usa sistema multi-split)
    atualizarResultados();
    
    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Ajusta o valor de um slider usando botões de seta
 * @param {string} targetId - ID do slider
 * @param {number} step - Valor do incremento/decremento
 */
function ajustarValor(targetId, step) {
    ajustarValorPadrao(targetId, step);
}

// Controle para botões de seta (repetição ao segurar)
let intervalId = null;
let timeoutId = null;

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Configurar botões de idioma
    document.getElementById('btnPortugues')?.addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano')?.addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Inicializar idioma
    trocarIdioma(idiomaAtual);
    
    // Configurar sliders
    const sliderArea = document.getElementById('sliderArea');
    const sliderAltura = document.getElementById('sliderAltura');
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderEquipamentos = document.getElementById('sliderEquipamentos');
    
    // Função auxiliar para atualizar área
    const atualizarArea = () => {
        const valor = parseFloat(sliderArea.value);
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputArea);
        }
        atualizarResultados();
    };
    
    // Aplica throttle reduzido nos sliders para melhor responsividade (50ms)
    // Adiciona também listener 'change' para garantir que o valor final seja sempre atualizado
    if (sliderArea) {
    sliderArea.addEventListener('input', throttle(() => {
        atualizarArea();
    }, 50)); // Reduzido de 100ms para 50ms
    // Listener 'change' garante que o valor final seja sempre atualizado quando o usuário solta o slider
    sliderArea.addEventListener('change', atualizarArea);
    }
    
    // Função auxiliar para atualizar altura
    const atualizarAltura = () => {
        const valor = parseFloat(sliderAltura.value);
        const inputAltura = document.getElementById('inputAltura');
        if (inputAltura) {
            inputAltura.value = formatarDecimal(valor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAltura);
        }
        atualizarResultados();
    };
    
    if (sliderAltura) {
    sliderAltura.addEventListener('input', throttle(atualizarAltura, 50));
    sliderAltura.addEventListener('change', atualizarAltura);
    }
    
    // Função auxiliar para atualizar pessoas
    const atualizarPessoas = () => {
        const valor = parseInt(sliderPessoas.value);
        const inputPessoas = document.getElementById('inputPessoas');
        if (inputPessoas) {
            inputPessoas.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        }
        atualizarResultados();
    };
    
    if (sliderPessoas) {
    sliderPessoas.addEventListener('input', throttle(atualizarPessoas, 50));
    sliderPessoas.addEventListener('change', atualizarPessoas);
    }
    
    // Função auxiliar para atualizar equipamentos
    const atualizarEquipamentos = () => {
        const valor = parseInt(sliderEquipamentos.value);
        const inputEquipamentos = document.getElementById('inputEquipamentos');
        if (inputEquipamentos) {
            inputEquipamentos.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputEquipamentos);
        }
        atualizarResultados();
    };
    
    if (sliderEquipamentos) {
    sliderEquipamentos.addEventListener('input', throttle(atualizarEquipamentos, 50));
    sliderEquipamentos.addEventListener('change', atualizarEquipamentos);
    }
    
    // Configurar sliders do sistema multi-split
    const sliderNumAmbientes = document.getElementById('sliderNumAmbientes');
    const sliderAreaTotal = document.getElementById('sliderAreaTotal');
    
    if (sliderNumAmbientes) {
        const atualizarNumAmbientes = () => {
            const valor = parseInt(sliderNumAmbientes.value);
            const inputNumAmbientes = document.getElementById('inputNumAmbientes');
            if (inputNumAmbientes) {
                inputNumAmbientes.value = valor;
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputNumAmbientes);
            }
            
            // Controla visibilidade dos inputs de área
            const grupoAreaIndividual = document.getElementById('grupoAreaIndividual');
            const grupoAreaTotal = document.getElementById('grupoAreaTotal');
            
            if (grupoAreaIndividual) {
                if (valor > 1) {
                    grupoAreaIndividual.style.display = 'none';
                } else {
                    grupoAreaIndividual.style.display = 'block';
                    // Quando volta para 1 ambiente, sincroniza área total com área individual
                    const inputArea = document.getElementById('inputArea');
                    const sliderArea = document.getElementById('sliderArea');
                    if (inputArea && sliderArea) {
                        const areaIndividual = parseFloat(sliderArea.value);
                        const inputAreaTotal = document.getElementById('inputAreaTotal');
                        const sliderAreaTotal = document.getElementById('sliderAreaTotal');
                        if (inputAreaTotal) inputAreaTotal.value = Math.round(areaIndividual);
                        if (sliderAreaTotal) sliderAreaTotal.value = areaIndividual;
                    }
                }
            }
            
            if (grupoAreaTotal) {
                if (valor > 1) {
                    grupoAreaTotal.style.display = 'block';
                } else {
                    grupoAreaTotal.style.display = 'none';
                }
            }
            
            atualizarResultados();
        };
        sliderNumAmbientes.addEventListener('input', throttle(atualizarNumAmbientes, 50));
        sliderNumAmbientes.addEventListener('change', atualizarNumAmbientes);
    }
    
    if (sliderAreaTotal) {
        const atualizarAreaTotal = () => {
            const valor = parseFloat(sliderAreaTotal.value);
            const inputAreaTotal = document.getElementById('inputAreaTotal');
            if (inputAreaTotal) {
                inputAreaTotal.value = Math.round(valor);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAreaTotal);
            }
            atualizarResultados();
        };
        sliderAreaTotal.addEventListener('input', throttle(atualizarAreaTotal, 50));
        sliderAreaTotal.addEventListener('change', atualizarAreaTotal);
    }
    
    // Configurar inputs editáveis
    const inputArea = document.getElementById('inputArea');
    const inputAltura = document.getElementById('inputAltura');
    const inputPessoas = document.getElementById('inputPessoas');
    const inputEquipamentos = document.getElementById('inputEquipamentos');
    
    if (inputArea) {
        inputArea.addEventListener('focus', (e) => e.target.select());
        inputArea.addEventListener('input', () => {
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputArea);
            const valor = converterParaNumero(inputArea.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderArea');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    if (inputAltura) {
        inputAltura.addEventListener('focus', (e) => e.target.select());
        inputAltura.addEventListener('input', () => {
            // Aceita tanto ponto quanto vírgula
            const valor = converterParaNumero(inputAltura.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderAltura');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                // Sempre exibe com vírgula
                inputAltura.value = formatarDecimal(valor, 1);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAltura);
                atualizarResultados();
            }
        });
        // Ao perder o foco, garante formatação correta
        inputAltura.addEventListener('blur', () => {
            const valor = converterParaNumero(inputAltura.value);
            if (!isNaN(valor) && valor > 0) {
                inputAltura.value = formatarDecimal(valor, 1);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAltura);
            }
        });
    }
    
    if (inputPessoas) {
        inputPessoas.addEventListener('focus', (e) => e.target.select());
        inputPessoas.addEventListener('input', () => {
            const valor = parseInt(inputPessoas.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderPessoas');
                if (valor >= parseInt(slider.min) && valor <= parseInt(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    if (inputEquipamentos) {
        inputEquipamentos.addEventListener('focus', (e) => e.target.select());
        inputEquipamentos.addEventListener('input', () => {
            const valor = parseInt(inputEquipamentos.value);
            if (!isNaN(valor) && valor >= 0) {
                const slider = document.getElementById('sliderEquipamentos');
                if (valor >= parseInt(slider.min) && valor <= parseInt(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    // Configurar inputs editáveis do sistema multi-split
    const inputNumAmbientes = document.getElementById('inputNumAmbientes');
    const inputAreaTotal = document.getElementById('inputAreaTotal');
    
    if (inputNumAmbientes) {
        inputNumAmbientes.addEventListener('focus', (e) => e.target.select());
        inputNumAmbientes.addEventListener('input', () => {
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputNumAmbientes);
            const valor = parseInt(inputNumAmbientes.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderNumAmbientes');
                if (slider && valor >= parseInt(slider.min) && valor <= parseInt(slider.max)) {
                    slider.value = valor;
                }
                
                // Controla visibilidade do input de área individual
                const grupoAreaIndividual = document.getElementById('grupoAreaIndividual');
                if (grupoAreaIndividual) {
                    if (valor > 1) {
                        grupoAreaIndividual.style.display = 'none';
                    } else {
                        grupoAreaIndividual.style.display = 'block';
                        // Quando volta para 1 ambiente, sincroniza área total com área individual
                        const inputArea = document.getElementById('inputArea');
                        const sliderArea = document.getElementById('sliderArea');
                        if (inputArea && sliderArea) {
                            const areaIndividual = parseFloat(sliderArea.value);
                            const inputAreaTotal = document.getElementById('inputAreaTotal');
                            const sliderAreaTotal = document.getElementById('sliderAreaTotal');
                            if (inputAreaTotal) inputAreaTotal.value = Math.round(areaIndividual);
                            if (sliderAreaTotal) sliderAreaTotal.value = areaIndividual;
                        }
                    }
                }
                
                atualizarResultados();
            }
        });
    }
    
    if (inputAreaTotal) {
        inputAreaTotal.addEventListener('focus', (e) => e.target.select());
        inputAreaTotal.addEventListener('input', () => {
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAreaTotal);
            const valor = converterParaNumero(inputAreaTotal.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderAreaTotal');
                if (slider && valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    // Configurar radio buttons
    document.querySelectorAll('input[name="insolacao"]').forEach(radio => {
        radio.addEventListener('change', atualizarResultados);
    });
    
    document.querySelectorAll('input[name="isolamento"]').forEach(radio => {
        radio.addEventListener('change', atualizarResultados);
    });
    
    // Configurar botões de seta - usa função global com aceleração exponencial
    if (typeof configurarBotoesSliderComAceleracao === 'function') {
        // Usa função de ajuste local que atualiza inputs correspondentes
        function ajustarValorArCondicionado(targetId, step) {
            ajustarValor(targetId, step);
        }
        configurarBotoesSliderComAceleracao(SITE_SEL.ARROW_BTN, ajustarValorArCondicionado);
    } else {
        // Fallback para código antigo se a função global não estiver disponível
        document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            btn.addEventListener('click', () => ajustarValor(targetId, step));
        });
    }
    
    // Formatar valor inicial da altura com vírgula
    const inputAlturaInicial = document.getElementById('inputAltura');
    if (inputAlturaInicial) {
        const valorInicial = converterParaNumero(inputAlturaInicial.value);
        if (!isNaN(valorInicial)) {
            inputAlturaInicial.value = formatarDecimal(valorInicial, 1);
        }
    }
    
    // Ajustar tamanho inicial de todos os inputs
    if (typeof ajustarTamanhoInput === 'function') {
        if (inputArea) ajustarTamanhoInput(inputArea);
        if (inputAltura) ajustarTamanhoInput(inputAltura);
        if (inputPessoas) ajustarTamanhoInput(inputPessoas);
        if (inputEquipamentos) ajustarTamanhoInput(inputEquipamentos);
        if (inputNumAmbientes) ajustarTamanhoInput(inputNumAmbientes);
        if (inputAreaTotal) ajustarTamanhoInput(inputAreaTotal);
    }
    
    // Configurar memorial de cálculo
    const btnMemorial = document.getElementById('btnMemorial');
    const btnFecharMemorial = document.getElementById('btnFecharMemorial');
    const btnVoltarMemorial = document.querySelectorAll('.btn-voltar-memorial');
    
    if (btnMemorial) {
        btnMemorial.addEventListener('click', toggleMemorial);
    }
    
    if (btnFecharMemorial) {
        btnFecharMemorial.addEventListener('click', toggleMemorial);
    }
    
    btnVoltarMemorial.forEach(btn => {
        btn.addEventListener('click', toggleMemorial);
    });
    
    // Configurar visibilidade inicial dos inputs de área
    const numAmbientesInicial = parseInt(sliderNumAmbientes?.value || 1);
    const grupoAreaIndividual = document.getElementById('grupoAreaIndividual');
    const grupoAreaTotal = document.getElementById('grupoAreaTotal');
    
    if (grupoAreaIndividual) {
        if (numAmbientesInicial > 1) {
            grupoAreaIndividual.style.display = 'none';
        } else {
            grupoAreaIndividual.style.display = 'block';
        }
    }
    
    if (grupoAreaTotal) {
        if (numAmbientesInicial > 1) {
            grupoAreaTotal.style.display = 'block';
        } else {
            grupoAreaTotal.style.display = 'none';
        }
    }
    
    // Calcular resultados iniciais
    atualizarResultados();
});

/**
 * Alterna a exibição do memorial de cálculo
 * Esconde a seção de resultados e mostra o memorial, ou vice-versa
 */
function toggleMemorial() {
    const memorialSection = document.getElementById('memorialSection');
    const resultadosSection = document.getElementById('resultadosSection');
    
    if (!memorialSection) {
        console.error('memorialSection não encontrado');
        return;
    }
    
    if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
        // Atualizar memorial com valores atuais
        if (typeof atualizarMemorialComValores === 'function') {
            atualizarMemorialComValores();
        }
        memorialSection.style.display = 'block';
        if (resultadosSection) resultadosSection.style.display = 'none';
        // Rolar para o topo da seção do memorial
        setTimeout(() => {
            memorialSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}

/**
 * Atualiza o memorial de cálculo com os valores atuais dos cálculos
 */
function atualizarMemorialComValores() {
    // Lê valores do sistema multi-split
    const numAmbientes = parseInt(document.getElementById('sliderNumAmbientes')?.value || 1);
    const areaTotal = parseFloat(document.getElementById('sliderAreaTotal')?.value || 20);
    const altura = parseFloat(document.getElementById('sliderAltura').value);
    const pessoas = parseInt(document.getElementById('sliderPessoas').value);
    const equipamentos = parseInt(document.getElementById('sliderEquipamentos').value);
    const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
    const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
    
    // Calcula o sistema multi-split
    const resultadoMultisplit = calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento);
    
    // Calcula valores para o memorial
    const volumeTotal = areaTotal * altura;
    const fatorAltura = altura / 2.7; // Normaliza para pé direito padrão de 2.7m
    const btuAreaTotal = areaTotal * BTU_POR_M2 * fatorAltura;
    const btuPessoasTotal = pessoas * BTU_POR_PESSOA;
    const btuEquipamentosTotal = equipamentos * BTU_POR_EQUIPAMENTO;
    const btuBaseTotal = btuAreaTotal + btuPessoasTotal + btuEquipamentosTotal;
    
    const fatorInsolacao = FATORES_INSOLACAO[insolacao] || 1.0;
    const fatorIsolamento = FATORES_ISOLAMENTO[isolamento] || 1.0;
    const btuFinalTotal = btuBaseTotal * fatorInsolacao * fatorIsolamento;
    
    const btuPorAmbienteCalculado = btuFinalTotal / numAmbientes;
    const unidadesInternasPorAmbiente = resultadoMultisplit.unidadesInternasPorAmbiente;
    const combinacaoInterna = resultadoMultisplit.combinacaoInterna;
    const unidadesInternas = resultadoMultisplit.unidadesInternas;
    const btuTotalReal = resultadoMultisplit.btuTotal;
    const numUnidadesExternas = resultadoMultisplit.numUnidadesExternas;
    const combinacaoExterna = resultadoMultisplit.combinacaoExterna;
    const btuTotalExterno = resultadoMultisplit.btuTotalExterno;
    
    // Traduzir nomes dos fatores para exibição
    const nomesInsolacao = {
        'baixa': traducoes[idiomaAtual]?.['fator-insolacao-baixa'] || 'Baixa',
        'media': traducoes[idiomaAtual]?.['fator-insolacao-media'] || 'Média',
        'alta': traducoes[idiomaAtual]?.['fator-insolacao-alta'] || 'Alta'
    };
    const nomesIsolamento = {
        'bom': traducoes[idiomaAtual]?.['fator-isolamento-bom'] || 'Bom',
        'medio': traducoes[idiomaAtual]?.['fator-isolamento-medio'] || 'Médio',
        'ruim': traducoes[idiomaAtual]?.['fator-isolamento-ruim'] || 'Ruim'
    };
    
    const textoPessoas = idiomaAtual === 'pt-BR' ? 'pessoas' : 'persone';
    const textoEquipamentos = idiomaAtual === 'pt-BR' ? 'equipamentos' : 'apparecchi';
    const textoInsolacao = idiomaAtual === 'pt-BR' ? 'insolação' : 'insolazione';
    const textoIsolamento = idiomaAtual === 'pt-BR' ? 'isolamento' : 'isolamento';
    const textoAmbientes = idiomaAtual === 'pt-BR' ? 'ambientes' : 'ambienti';
    
    // Atualizar exemplos
    const memorialExemploVolume = document.getElementById('memorial-exemplo-volume');
    if (memorialExemploVolume) {
        memorialExemploVolume.textContent = 
            `${formatarNumero(areaTotal, 0)} m² × ${formatarDecimal(altura, 1)} m = ${formatarNumero(volumeTotal, 1)} m³`;
    }
    
    const memorialExemploBtuBase = document.getElementById('memorial-exemplo-btu-base');
    if (memorialExemploBtuBase) {
        memorialExemploBtuBase.textContent = 
            `${formatarNumero(areaTotal, 1)} m² × ${formatarNumero(BTU_POR_M2, 0)} × ${formatarDecimal(fatorAltura, 2)} (fator altura) = ${formatarBTU(btuAreaTotal)} + ${pessoas} ${textoPessoas} × 600 = ${formatarBTU(btuPessoasTotal)} + ${equipamentos} ${textoEquipamentos} × 600 = ${formatarBTU(btuEquipamentosTotal)} = ${formatarBTU(btuBaseTotal)}`;
    }
    
    const memorialExemploFatores = document.getElementById('memorial-exemplo-fatores');
    if (memorialExemploFatores) {
        memorialExemploFatores.textContent = 
            `${formatarBTU(btuBaseTotal)} × ${formatarDecimal(fatorInsolacao, 2)} (${textoInsolacao} ${nomesInsolacao[insolacao] || insolacao}) × ${formatarDecimal(fatorIsolamento, 2)} (${textoIsolamento} ${nomesIsolamento[isolamento] || isolamento}) = ${formatarBTU(btuFinalTotal)}`;
    }
    
    const elementoBtuPorAmbiente = document.getElementById('memorial-exemplo-btu-por-ambiente');
    if (elementoBtuPorAmbiente) {
        elementoBtuPorAmbiente.textContent = 
            `${formatarBTU(btuFinalTotal)} ÷ ${numAmbientes} ${textoAmbientes} = ${formatarBTU(btuPorAmbienteCalculado)} por ambiente`;
    }
    
    const elementoModelo = document.getElementById('memorial-exemplo-modelo');
    if (elementoModelo) {
        let textoModelo = `${formatarBTU(btuPorAmbienteCalculado)} → `;
        if (unidadesInternasPorAmbiente > 1) {
            const partesCombinacao = combinacaoInterna.map(m => formatarBTU(m));
            textoModelo += `Combinação por ambiente: ${partesCombinacao.join(' + ')}. `;
        } else {
            textoModelo += `Modelo comercial por ambiente: ${formatarBTU(combinacaoInterna[0])}. `;
        }
        textoModelo += `BTU Total Real: ${formatarBTU(btuTotalReal)}. `;
        if (numUnidadesExternas > 1) {
            const partesExterna = combinacaoExterna.map(m => formatarBTU(m));
            textoModelo += `Combinação Externa: ${partesExterna.join(' + ')}`;
        } else {
            textoModelo += `Unidade Externa: ${formatarBTU(combinacaoExterna[0])}`;
        }
        elementoModelo.textContent = textoModelo;
    }
    
    const elementoCusto = document.getElementById('memorial-exemplo-custo');
    if (elementoCusto) {
        let textoCusto = '';
        if (numUnidadesExternas > 1) {
            const partesExterna = combinacaoExterna.map(m => formatarBTU(m));
            textoCusto += `Unidades Externas (${partesExterna.join(' + ')}): ${formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotalUnidadesExternas, idiomaAtual)}. `;
        } else {
            textoCusto += `Unidade Externa ${formatarBTU(combinacaoExterna[0])}: ${formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotalUnidadesExternas, idiomaAtual)}. `;
        }
        
        // Formata unidades internas
        const partesInternas = [];
        Object.keys(resultadoMultisplit.unidadesInternasPorModelo).forEach(modelo => {
            const qtd = resultadoMultisplit.unidadesInternasPorModelo[modelo];
            partesInternas.push(`${qtd} × ${formatarBTU(parseInt(modelo))}`);
        });
        textoCusto += `Unidades Internas (${partesInternas.join(' + ')}): ${formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotalUnidadesInternas, idiomaAtual)}. `;
        textoCusto += `Custo Total: ${formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotal, idiomaAtual)}`;
        elementoCusto.textContent = textoCusto;
    }
    
    // Atualizar resumo
    const resumoVolume = document.getElementById('resumo-volume');
    if (resumoVolume) resumoVolume.textContent = formatarNumero(volumeTotal, 1) + ' m³';
    const resumoBtuBase = document.getElementById('resumo-btu-base');
    if (resumoBtuBase) resumoBtuBase.textContent = formatarBTU(btuBaseTotal);
    const resumoBtuFinalCalc = document.getElementById('resumo-btu-final-calc');
    if (resumoBtuFinalCalc) resumoBtuFinalCalc.textContent = formatarBTU(btuFinalTotal);
    const resumoBtuPorAmbiente = document.getElementById('resumo-btu-por-ambiente');
    if (resumoBtuPorAmbiente) resumoBtuPorAmbiente.textContent = formatarBTU(btuPorAmbienteCalculado);
    const resumoUnidadeInterna = document.getElementById('resumo-unidade-interna');
    if (resumoUnidadeInterna) {
        if (unidadesInternasPorAmbiente > 1) {
            const partesCombinacao = combinacaoInterna.map(m => formatarBTU(m));
            resumoUnidadeInterna.textContent = `${unidadesInternas} unidades (${unidadesInternasPorAmbiente} por ambiente: ${partesCombinacao.join(' + ')})`;
        } else {
            const partesInternas = [];
            Object.keys(resultadoMultisplit.unidadesInternasPorModelo).forEach(modelo => {
                const qtd = resultadoMultisplit.unidadesInternasPorModelo[modelo];
                if (qtd > 1) {
                    partesInternas.push(`${qtd} × ${formatarBTU(parseInt(modelo))}`);
                } else {
                    partesInternas.push(formatarBTU(parseInt(modelo)));
                }
            });
            resumoUnidadeInterna.textContent = partesInternas.join(' + ');
        }
    }
    const resumoBtuTotalReal = document.getElementById('resumo-btu-total-real');
    if (resumoBtuTotalReal) resumoBtuTotalReal.textContent = formatarBTU(btuTotalReal);
    const resumoUnidadeExterna = document.getElementById('resumo-unidade-externa');
    if (resumoUnidadeExterna) {
        if (numUnidadesExternas > 1) {
            const partesExterna = [];
            const modelosAgrupados = {};
            combinacaoExterna.forEach(modelo => {
                modelosAgrupados[modelo] = (modelosAgrupados[modelo] || 0) + 1;
            });
            Object.keys(modelosAgrupados).forEach(modelo => {
                const qtd = modelosAgrupados[modelo];
                if (qtd > 1) {
                    partesExterna.push(`${qtd} × ${formatarBTU(parseInt(modelo))}`);
                } else {
                    partesExterna.push(formatarBTU(parseInt(modelo)));
                }
            });
            resumoUnidadeExterna.textContent = partesExterna.join(' + ');
        } else {
            resumoUnidadeExterna.textContent = formatarBTU(combinacaoExterna[0]);
        }
    }
    const resumoCustoTotal = document.getElementById('resumo-custo-total');
    if (resumoCustoTotal) resumoCustoTotal.textContent = formatarMoedaSemDecimalComConversao(resultadoMultisplit.custoTotal, idiomaAtual);
}

