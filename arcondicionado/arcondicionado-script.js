// ============================================
// DIMENSIONADOR DE AR CONDICIONADO RESIDENCIAL
// ============================================
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: calcular a capacidade necessária de ar condicionado (em BTU)
// para um ambiente residencial baseado em vários fatores:
//  - Volume do ambiente (área × altura)
//  - Número de pessoas
//  - Equipamentos elétricos
//  - Insolação (exposição ao sol)
//  - Isolamento térmico
//
// Fórmula base:
// BTU = (Volume × 600) + (Pessoas × 600) + (Equipamentos × 600)
// BTU Final = BTU Base × Fator Insolação × Fator Isolamento
//
// Fatores:
// - Insolação: Baixa (1.0), Média (1.15), Alta (1.3)
// - Isolamento: Bom (0.8), Médio (1.0), Ruim (1.2)

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
 * BTU_POR_M3 - BTU necessário por metro cúbico de volume
 * 
 * Representa a capacidade de refrigeração necessária para resfriar
 * 1 metro cúbico de ar em um ambiente residencial típico.
 * 
 * Este valor considera:
 * - Remoção de calor sensível (temperatura do ar)
 * - Remoção de calor latente (umidade)
 * - Renovação de ar necessária
 * - Perdas térmicas através de paredes, teto e piso
 * 
 * O valor de 600 BTU/m³ é um padrão amplamente aceito na indústria
 * para dimensionamento de ar condicionado residencial.
 * 
 * FÓRMULA: BTU_Volume = Volume (m³) × 600
 * 
 * FONTE: Normas técnicas e práticas da indústria de refrigeração
 */
const BTU_POR_M3 = 600; // BTU por metro cúbico

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
const MODELOS_COMERCIAIS = [5000, 7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];

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
        'memorial-resumo-potencia': 'Potência (kW):'
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
        'memorial-resumo-potencia': 'Potenza (kW):'
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
    // PASSO 1: Calcular volume do ambiente
    const volume = area * altura; // m³
    
    // PASSO 2: Calcular BTU base (volume × 600 BTU/m³)
    const btuVolume = volume * BTU_POR_M3;
    
    // PASSO 3: Adicionar BTU por pessoas
    const btuPessoas = pessoas * BTU_POR_PESSOA;
    
    // PASSO 4: Adicionar BTU por equipamentos
    const btuEquipamentos = equipamentos * BTU_POR_EQUIPAMENTO;
    
    // PASSO 5: Calcular BTU base total (antes dos fatores)
    const btuBase = btuVolume + btuPessoas + btuEquipamentos;
    
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
    
    // Se o valor for menor que 1000, formata normalmente
    if (valor < 1000) {
        return formatarNumero(valor) + ' BTU';
    }
    
    // Se for >= 1000, divide por 1000 e adiciona "k"
    const valorK = valor / 1000;
    
    // Se for um número inteiro (ex: 5k, 12k, 24k), não mostra decimais
    if (valorK % 1 === 0) {
        return valorK + 'k BTU';
    }
    
    // Caso contrário, mostra uma casa decimal (ex: 1,5k, 2,5k)
    return formatarNumeroDecimal(valorK, 1) + 'k BTU';
}

/**
 * Formata número com casas decimais
 * Usa a função global formatarNumeroDecimal do site-config.js
 * Sempre usa vírgula como separador decimal (padrão brasileiro)
 * @param {number} valor - Valor numérico
 * @param {number} decimais - Número de casas decimais
 * @returns {string} Valor formatado com vírgula
 */
function formatarDecimal(valor, decimais = 1) {
    return formatarNumeroDecimal(valor, decimais);
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
    
    const sliderArea = document.getElementById('sliderArea');
    const sliderAltura = document.getElementById('sliderAltura');
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderEquipamentos = document.getElementById('sliderEquipamentos');
    
    // Lê valores dos inputs ou sliders (inputs têm prioridade se válidos)
    let area = parseFloat(sliderArea.value);
    if (inputArea && inputArea.value) {
        const valorConvertido = converterParaNumero(inputArea.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            area = valorConvertido;
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
    
    // Calcula o BTU
    const resultado = calcularBTU(area, altura, pessoas, equipamentos, insolacao, isolamento);
    
    // Atualiza os displays
    document.getElementById('btuRecomendado').textContent = formatarBTU(resultado.btuRecomendado);
    document.getElementById('potenciaKw').textContent = formatarDecimal(resultado.potenciaKw, 2) + ' kW';
    document.getElementById('volumeAmbiente').textContent = formatarDecimal(resultado.volume, 1) + ' m³';
    document.getElementById('btuBase').textContent = formatarBTU(Math.round(resultado.btuBase));
    
    // Mostrar BTU final (após aplicar fatores de insolação e isolamento)
    const btuFinalElement = document.getElementById('btuFinal');
    if (btuFinalElement && resultado.btuFinal) {
        btuFinalElement.textContent = formatarBTU(Math.round(resultado.btuFinal));
    }
    
    // Atualiza lista de modelos comerciais com destaque para o recomendado
    atualizarModelosComerciais(resultado.btuRecomendado);
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
}

/**
 * Atualiza a lista de modelos comerciais destacando o recomendado
 * @param {number} btuRecomendado - BTU do modelo recomendado
 */
function atualizarModelosComerciais(btuRecomendado) {
    const lista = document.getElementById('modelosComerciais');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    const modelosTexto = {
        'pt-BR': {
            5000: '5k BTU - até 8 m²',
            7000: '7k BTU - até 10 m²',
            9000: '9k BTU - até 15 m²',
            12000: '12k BTU - até 20 m²',
            18000: '18k BTU - até 30 m²',
            24000: '24k BTU - até 40 m²',
            30000: '30k BTU - até 50 m²',
            36000: '36k BTU - até 60 m²',
            48000: '48k BTU - até 80 m²',
            60000: '60k BTU - até 100 m²'
        },
        'it-IT': {
            5000: '5k BTU - fino a 8 m²',
            7000: '7k BTU - fino a 10 m²',
            9000: '9k BTU - fino a 15 m²',
            12000: '12k BTU - fino a 20 m²',
            18000: '18k BTU - fino a 30 m²',
            24000: '24k BTU - fino a 40 m²',
            30000: '30k BTU - fino a 50 m²',
            36000: '36k BTU - fino a 60 m²',
            48000: '48k BTU - fino a 80 m²',
            60000: '60k BTU - fino a 100 m²'
        }
    };
    
    const textos = modelosTexto[idiomaAtual] || modelosTexto['pt-BR'];
    
    MODELOS_COMERCIAIS.forEach(modelo => {
        const li = document.createElement('li');
        const texto = textos[modelo] || formatarBTU(modelo);
        
        if (modelo === btuRecomendado) {
            li.innerHTML = `<strong style="color: #1976D2;">${texto} ✅ Recomendado</strong>`;
        } else {
            li.textContent = texto;
        }
        
        lista.appendChild(li);
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
    
    // Atualiza modelos comerciais
    const inputArea = document.getElementById('inputArea');
    const area = inputArea ? (converterParaNumero(inputArea.value) || parseFloat(document.getElementById('sliderArea').value)) : parseFloat(document.getElementById('sliderArea').value);
    const altura = parseFloat(document.getElementById('sliderAltura').value);
    const pessoas = parseInt(document.getElementById('sliderPessoas').value);
    const equipamentos = parseInt(document.getElementById('sliderEquipamentos').value);
    const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
    const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
    const resultado = calcularBTU(area, altura, pessoas, equipamentos, insolacao, isolamento);
    atualizarModelosComerciais(resultado.btuRecomendado);
    
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
    
    sliderArea.addEventListener('input', () => {
        const valor = parseFloat(sliderArea.value);
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputArea);
        }
        atualizarResultados();
    });
    
    sliderAltura.addEventListener('input', () => {
        const valor = parseFloat(sliderAltura.value);
        const inputAltura = document.getElementById('inputAltura');
        if (inputAltura) {
            // Formata com vírgula usando formatarDecimal
            inputAltura.value = formatarDecimal(valor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAltura);
        }
        atualizarResultados();
    });
    
    sliderPessoas.addEventListener('input', () => {
        const valor = parseInt(sliderPessoas.value);
        const inputPessoas = document.getElementById('inputPessoas');
        if (inputPessoas) {
            inputPessoas.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        }
        atualizarResultados();
    });
    
    sliderEquipamentos.addEventListener('input', () => {
        const valor = parseInt(sliderEquipamentos.value);
        const inputEquipamentos = document.getElementById('inputEquipamentos');
        if (inputEquipamentos) {
            inputEquipamentos.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputEquipamentos);
        }
        atualizarResultados();
    });
    
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
    const area = parseFloat(document.getElementById('sliderArea').value);
    const altura = parseFloat(document.getElementById('sliderAltura').value);
    const pessoas = parseInt(document.getElementById('sliderPessoas').value);
    const equipamentos = parseInt(document.getElementById('sliderEquipamentos').value);
    const insolacao = document.querySelector('input[name="insolacao"]:checked')?.value || 'media';
    const isolamento = document.querySelector('input[name="isolamento"]:checked')?.value || 'medio';
    
    const resultado = calcularBTU(area, altura, pessoas, equipamentos, insolacao, isolamento);
    
    const volume = area * altura;
    const btuBase = resultado.btuBase;
    
    // Usar btuFinal retornado pela função calcularBTU
    const fatorInsolacao = FATORES_INSOLACAO[insolacao] || 1.0;
    const fatorIsolamento = FATORES_ISOLAMENTO[isolamento] || 1.0;
    const btuFinal = resultado.btuFinal || (btuBase * fatorInsolacao * fatorIsolamento);
    
    const potenciaKw = resultado.potenciaKw;
    
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
    
    document.getElementById('memorial-exemplo-volume').textContent = 
        `${formatarNumero(area, 0)} m² × ${formatarDecimal(altura, 1)} m = ${formatarNumero(volume, 0)} m³`;
    
    document.getElementById('memorial-exemplo-btu-base').textContent = 
        `${formatarNumero(volume, 0)} m³ × 600 = ${formatarBTU(volume * 600)} + ${pessoas} ${textoPessoas} × 600 = ${formatarBTU(pessoas * 600)} + ${equipamentos} ${textoEquipamentos} × 600 = ${formatarBTU(equipamentos * 600)} = ${formatarBTU(btuBase)}`;
    
    document.getElementById('memorial-exemplo-fatores').textContent = 
        `${formatarBTU(btuBase)} × ${formatarDecimal(fatorInsolacao, 2)} (${textoInsolacao} ${nomesInsolacao[insolacao] || insolacao}) × ${formatarDecimal(fatorIsolamento, 2)} (${textoIsolamento} ${nomesIsolamento[isolamento] || isolamento}) = ${formatarBTU(btuFinal)}`;
    
    const modelos = MODELOS_COMERCIAIS;
    const modeloComercial = selecionarModeloComercial(btuFinal);
    const potenciaKwModelo = modeloComercial * BTU_PARA_KW;
    
    document.getElementById('memorial-exemplo-modelo').textContent = 
        `${formatarBTU(btuFinal)} → Modelo comercial: ${formatarBTU(modeloComercial)}`;
    
    document.getElementById('memorial-exemplo-potencia').textContent = 
        `${formatarBTU(modeloComercial)} × 0.000293 = ${formatarDecimal(potenciaKwModelo, 2)} kW`;
    
    // Atualizar resumo
    document.getElementById('resumo-volume').textContent = formatarNumero(volume, 0) + ' m³';
    document.getElementById('resumo-btu-base').textContent = formatarBTU(btuBase);
    const resumoBtuFinalCalc = document.getElementById('resumo-btu-final-calc');
    if (resumoBtuFinalCalc) resumoBtuFinalCalc.textContent = formatarBTU(btuFinal);
    document.getElementById('resumo-btu-final').textContent = formatarBTU(modeloComercial);
    document.getElementById('resumo-potencia').textContent = formatarDecimal(potenciaKwModelo, 2) + ' kW';
}

