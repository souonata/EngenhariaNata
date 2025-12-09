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
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculada a capacidade necessária de ar condicionado (em BTU) para um ambiente residencial, considerando volume, pessoas, equipamentos, insolação e isolamento térmico.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Volume do Ambiente',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'O volume determina a quantidade de ar que precisa ser resfriado no ambiente.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular BTU Base',
        'memorial-passo2-explicacao': 'Cada pessoa e equipamento elétrico gera calor que precisa ser removido pelo ar condicionado.',
        'memorial-passo3-title': '3️⃣ Passo 3: Aplicar Fatores de Ajuste (Insolação e Isolamento)',
        'memorial-passo3-explicacao': 'Os fatores de insolação e isolamento ajustam a capacidade necessária baseado nas condições do ambiente. Estes são fatores multiplicadores que refletem o impacto real das condições ambientais na carga térmica.',
        'memorial-fatores-title': 'Fatores utilizados:',
        'memorial-fatores-insolacao': 'Insolação: Baixa (1.0), Média (1.15), Alta (1.3)',
        'memorial-fatores-isolamento': 'Isolamento: Bom (0.8), Médio (1.0), Ruim (1.2)',
        'fator-insolacao-baixa': 'Baixa',
        'fator-insolacao-media': 'Média',
        'fator-insolacao-alta': 'Alta',
        'fator-isolamento-bom': 'Bom',
        'fator-isolamento-medio': 'Médio',
        'fator-isolamento-ruim': 'Ruim',
        'memorial-passo4-title': '4️⃣ Passo 4: Selecionar Modelo Comercial',
        'memorial-passo4-explicacao': 'O BTU calculado é arredondado para cima para o modelo comercial mais próximo disponível no mercado.',
        'memorial-modelos-title': 'Modelos comerciais disponíveis:',
        'memorial-modelos-lista': '5.000, 7.000, 9.000, 12.000, 18.000, 24.000, 30.000, 36.000, 48.000, 60.000 BTU',
        'memorial-passo5-title': '5️⃣ Passo 5: Converter para Potência (kW)',
        'memorial-passo5-explicacao': 'A conversão para kW é útil para comparar com outros equipamentos elétricos e estimar consumo de energia.',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-volume': 'Volume do Ambiente:',
        'memorial-resumo-btu-base': 'BTU Base:',
        'memorial-resumo-btu-final-calc': 'BTU Final (após fatores):',
        'memorial-resumo-btu-final': 'BTU Recomendado (modelo comercial):',
        'memorial-resumo-potencia': 'Potência (kW):',
        'memorial-passo6-title': '6️⃣ Passo 6: Calcular Custo Estimado',
        'memorial-passo6-explicacao': 'O custo é estimado com base em faixas de preço de mercado (2024-2025) para unidades externas e internas vendidas separadamente. Os valores são médias das faixas de preço pesquisadas.',
        'memorial-resumo-btu-por-ambiente': 'BTU por Ambiente:',
        'memorial-resumo-unidade-interna': 'Unidade Interna (Modelo):',
        'memorial-resumo-btu-total-real': 'BTU Total Real:',
        'memorial-resumo-unidade-externa': 'Unidade Externa (Modelo):',
        'memorial-resumo-custo-total': 'Custo Total Estimado:'
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
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolata la capacità necessaria del climatizzatore (in BTU) per un ambiente residenziale, considerando volume, persone, apparecchi, insolazione e isolamento termico.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Volume Ambiente',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'Il volume determina la quantità di aria che deve essere raffreddata nell\'ambiente.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare BTU Base',
        'memorial-passo2-explicacao': 'Ogni persona e apparecchio elettrico genera calore che deve essere rimosso dal climatizzatore.',
        'memorial-passo3-title': '3️⃣ Passo 3: Applicare Fattori di Aggiustamento (Insolazione e Isolamento)',
        'memorial-passo3-explicacao': 'I fattori di insolazione e isolamento aggiustano la capacità necessaria in base alle condizioni dell\'ambiente. Questi sono fattori moltiplicatori che riflettono l\'impatto reale delle condizioni ambientali sul carico termico.',
        'memorial-fatores-title': 'Fattori utilizzati:',
        'memorial-fatores-insolacao': 'Insolazione: Bassa (1.0), Media (1.15), Alta (1.3)',
        'memorial-fatores-isolamento': 'Isolamento: Buono (0.8), Medio (1.0), Scarso (1.2)',
        'fator-insolacao-baixa': 'Bassa',
        'fator-insolacao-media': 'Media',
        'fator-insolacao-alta': 'Alta',
        'fator-isolamento-bom': 'Buono',
        'fator-isolamento-medio': 'Medio',
        'fator-isolamento-ruim': 'Scarso',
        'memorial-passo4-title': '4️⃣ Passo 4: Selezionare Modello Commerciale',
        'memorial-passo4-explicacao': 'Il BTU calcolato viene arrotondato per eccesso al modello commerciale più vicino disponibile sul mercato.',
        'memorial-modelos-title': 'Modelli commerciali disponibili:',
        'memorial-modelos-lista': '5.000, 7.000, 9.000, 12.000, 18.000, 24.000, 30.000, 36.000, 48.000, 60.000 BTU',
        'memorial-passo5-title': '5️⃣ Passo 5: Convertire in Potenza (kW)',
        'memorial-passo5-explicacao': 'La conversione in kW è utile per confrontare con altri apparecchi elettrici e stimare il consumo di energia.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-volume': 'Volume Ambiente:',
        'memorial-resumo-btu-base': 'BTU Base:',
        'memorial-resumo-btu-final-calc': 'BTU Finale (dopo fattori):',
        'memorial-resumo-btu-final': 'BTU Consigliato (modello commerciale):',
        'memorial-resumo-potencia': 'Potenza (kW):',
        'memorial-passo6-title': '6️⃣ Passo 6: Calcolare Costo Stimato',
        'memorial-passo6-explicacao': 'Il costo è stimato sulla base di fasce di prezzo di mercato (2024-2025) per unità esterne e interne vendute separatamente. I valori sono medie delle fasce di prezzo ricercate.',
        'memorial-resumo-btu-por-ambiente': 'BTU per Ambiente:',
        'memorial-resumo-unidade-interna': 'Unità Interna (Modello):',
        'memorial-resumo-btu-total-real': 'BTU Totali Reali:',
        'memorial-resumo-unidade-externa': 'Unità Esterna (Modello):',
        'memorial-resumo-custo-total': 'Costo Totale Stimato:'
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
    
    // Se multi-split está ativo (numAmbientes > 1), usa apenas área total
    // Caso contrário, usa área individual
    let area;
    if (numAmbientes > 1) {
        // Multi-split: usa apenas área total
        area = areaTotal;
    } else {
        // Split simples: usa área individual
        area = parseFloat(sliderArea.value);
        if (inputArea && inputArea.value) {
            const valorConvertido = converterParaNumero(inputArea.value);
            if (!isNaN(valorConvertido) && valorConvertido > 0) {
                area = valorConvertido;
            }
        }
        // Sincroniza área total com área individual quando não é multi-split
        if (areaTotal !== area) {
            areaTotal = area;
            if (sliderAreaTotal) sliderAreaTotal.value = area;
            if (inputAreaTotal) inputAreaTotal.value = Math.round(area);
        }
    }
    
    let altura = parseFloat(sliderAltura.value);
    if (inputAltura && inputAltura.value) {
        const valorConvertido = converterParaNumero(inputAltura.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            altura = valorConvertido;
        }
    }
    
    let pessoas = parseInt(sliderPessoas.value);
    if (inputPessoas && inputPessoas.value && !isNaN(parseInt(inputPessoas.value))) {
        pessoas = parseInt(inputPessoas.value);
    }
    
    let equipamentos = parseInt(sliderEquipamentos.value);
    if (inputEquipamentos && inputEquipamentos.value && !isNaN(parseInt(inputEquipamentos.value))) {
        equipamentos = parseInt(inputEquipamentos.value);
    }
    
    // Obtém valores dos radio buttons
    const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
    const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
    
    // Calcula e atualiza sistema multi-split (sempre, mesmo para 1 ambiente)
    const resultadoMultisplit = calcularSistemaMultisplit(numAmbientes, areaTotal, altura, pessoas, equipamentos, insolacao, isolamento);
    
    // Custo total em destaque
    document.getElementById('custoSistemaMultisplit').textContent = formatarMoedaSemDecimal(resultadoMultisplit.custoTotal, idiomaAtual);
    
    // Detalhamento dos custos
    const textoUnidadesExternas = resultadoMultisplit.numUnidadesExternas > 1 
        ? `${resultadoMultisplit.numUnidadesExternas} × ${formatarMoedaSemDecimal(resultadoMultisplit.custoPorUnidadeExterna, idiomaAtual)}`
        : formatarMoedaSemDecimal(resultadoMultisplit.custoTotalUnidadesExternas, idiomaAtual);
    document.getElementById('custoUnidadeExternaMultisplit').textContent = textoUnidadesExternas;
    document.getElementById('custoUnidadesInternasMultisplit').textContent = formatarMoedaSemDecimal(resultadoMultisplit.custoTotalUnidadesInternas, idiomaAtual);
    
    // Dados técnicos
    document.getElementById('btuTotalMultisplit').textContent = formatarBTU(Math.round(resultadoMultisplit.btuTotal));
    
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
    document.getElementById('unidadeExternaMultisplit').textContent = textoUnidadeExterna;
    
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
    document.getElementById('unidadesInternasMultisplit').textContent = textoUnidadesInternas;
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
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
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    let valor = parseFloat(slider.value) || 0;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const stepAttr = parseFloat(slider.step) || 1;
    
    valor += step;
    valor = Math.round(valor / stepAttr) * stepAttr;
    valor = Math.max(min, Math.min(max, valor));
    
    slider.value = valor;
    slider.dispatchEvent(new Event('input'));
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
    
    // Aplica throttle nos sliders para melhorar performance durante o arraste
    sliderArea.addEventListener('input', throttle(() => {
        const valor = parseFloat(sliderArea.value);
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputArea);
        }
        atualizarResultados();
    }, 100));
    
    sliderAltura.addEventListener('input', throttle(() => {
        const valor = parseFloat(sliderAltura.value);
        const inputAltura = document.getElementById('inputAltura');
        if (inputAltura) {
            // Formata com vírgula usando formatarDecimal
            inputAltura.value = formatarDecimal(valor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAltura);
        }
        atualizarResultados();
    }, 100));
    
    sliderPessoas.addEventListener('input', throttle(() => {
        const valor = parseInt(sliderPessoas.value);
        const inputPessoas = document.getElementById('inputPessoas');
        if (inputPessoas) {
            inputPessoas.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        }
        atualizarResultados();
    }, 100));
    
    sliderEquipamentos.addEventListener('input', throttle(() => {
        const valor = parseInt(sliderEquipamentos.value);
        const inputEquipamentos = document.getElementById('inputEquipamentos');
        if (inputEquipamentos) {
            inputEquipamentos.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputEquipamentos);
        }
        atualizarResultados();
    }, 100));
    
    // Configurar sliders do sistema multi-split
    const sliderNumAmbientes = document.getElementById('sliderNumAmbientes');
    const sliderAreaTotal = document.getElementById('sliderAreaTotal');
    
    if (sliderNumAmbientes) {
        sliderNumAmbientes.addEventListener('input', throttle(() => {
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
        }, 100));
    }
    
    if (sliderAreaTotal) {
        sliderAreaTotal.addEventListener('input', throttle(() => {
            const valor = parseFloat(sliderAreaTotal.value);
            const inputAreaTotal = document.getElementById('inputAreaTotal');
            if (inputAreaTotal) {
                inputAreaTotal.value = Math.round(valor);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAreaTotal);
            }
            atualizarResultados();
        }, 100));
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
    
    // Configurar botões de seta
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));
        
        const startRepeating = () => {
            ajustarValor(targetId, step);
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100);
            }, 500);
        };
        
        const stopRepeating = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
        
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);
        
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
    });
    
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
    document.getElementById('memorial-exemplo-volume').textContent = 
        `${formatarNumero(areaTotal, 0)} m² × ${formatarDecimal(altura, 1)} m = ${formatarNumero(volumeTotal, 1)} m³`;
    
    document.getElementById('memorial-exemplo-btu-base').textContent = 
        `${formatarNumero(areaTotal, 1)} m² × ${formatarNumero(BTU_POR_M2, 0)} × ${formatarDecimal(fatorAltura, 2)} (fator altura) = ${formatarBTU(btuAreaTotal)} + ${pessoas} ${textoPessoas} × 600 = ${formatarBTU(btuPessoasTotal)} + ${equipamentos} ${textoEquipamentos} × 600 = ${formatarBTU(btuEquipamentosTotal)} = ${formatarBTU(btuBaseTotal)}`;
    
    document.getElementById('memorial-exemplo-fatores').textContent = 
        `${formatarBTU(btuBaseTotal)} × ${formatarDecimal(fatorInsolacao, 2)} (${textoInsolacao} ${nomesInsolacao[insolacao] || insolacao}) × ${formatarDecimal(fatorIsolamento, 2)} (${textoIsolamento} ${nomesIsolamento[isolamento] || isolamento}) = ${formatarBTU(btuFinalTotal)}`;
    
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
            textoCusto += `Unidades Externas (${partesExterna.join(' + ')}): ${formatarMoedaSemDecimal(resultadoMultisplit.custoTotalUnidadesExternas, idiomaAtual)}. `;
        } else {
            textoCusto += `Unidade Externa ${formatarBTU(combinacaoExterna[0])}: ${formatarMoedaSemDecimal(resultadoMultisplit.custoTotalUnidadesExternas, idiomaAtual)}. `;
        }
        
        // Formata unidades internas
        const partesInternas = [];
        Object.keys(resultadoMultisplit.unidadesInternasPorModelo).forEach(modelo => {
            const qtd = resultadoMultisplit.unidadesInternasPorModelo[modelo];
            partesInternas.push(`${qtd} × ${formatarBTU(parseInt(modelo))}`);
        });
        textoCusto += `Unidades Internas (${partesInternas.join(' + ')}): ${formatarMoedaSemDecimal(resultadoMultisplit.custoTotalUnidadesInternas, idiomaAtual)}. `;
        textoCusto += `Custo Total: ${formatarMoedaSemDecimal(resultadoMultisplit.custoTotal, idiomaAtual)}`;
        elementoCusto.textContent = textoCusto;
    }
    
    // Atualizar resumo
    document.getElementById('resumo-volume').textContent = formatarNumero(volumeTotal, 1) + ' m³';
    document.getElementById('resumo-btu-base').textContent = formatarBTU(btuBaseTotal);
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
    if (resumoCustoTotal) resumoCustoTotal.textContent = formatarMoedaSemDecimal(resultadoMultisplit.custoTotal, idiomaAtual);
}

