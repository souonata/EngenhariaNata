// ============================================
// CALCULADORA DE BITOLA DE FIOS
// ============================================
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: calcular a área de seção mínima de fios elétricos para
// circuitos de corrente contínua (CC) ou alternada (CA), considerando:
//  - potência máxima nominal das cargas
//  - comprimento total do circuito (soma dos condutores)
//  - tensão de operação
//  - queda de tensão máxima permitida
//
// Entrada (UI):
//  - tipo de corrente (CC ou CA)
//  - potência máxima nominal (W)
//  - comprimento total do circuito (m)
//  - tensão (V) - para CA: 110V ou 220V; para CC: slider com valores típicos
//  - queda de tensão máxima permitida (%)
//
// Passo-a-passo do cálculo:
// 1) Calcular corrente do circuito: I = P / V
//    Onde: P = potência (W), V = tensão (V)
// 2) Calcular área de seção mínima: S = (2 × ρ × L × I) / ΔV
//    Onde: ρ = resistividade do cobre (0.0175 Ω·mm²/m)
//          L = distância (m) - apenas a distância entre fonte e carga
//          I = corrente (A)
//          ΔV = queda de tensão máxima (V) = (queda% / 100) × V
//    IMPORTANTE: O fator 2 considera ida e volta (dois condutores)
//                L é a distância, não a soma dos condutores
// 3) Selecionar bitola comercial padrão brasileiro que atenda ao requisito
//    Bitolas disponíveis: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm²
// 4) Recalcular queda de tensão real com a bitola escolhida para verificação
//
// Observações:
// - A fórmula considera apenas a resistência ôhmica do condutor
// - Para CA, assume-se fator de potência unitário (cos φ = 1) para simplificação
// - A queda de tensão recomendada para projetos residenciais no Brasil é 4%
// - Bitolas comerciais seguem a norma brasileira (NBR 5410)

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
 * CONSTANTE: RESISTIVIDADE DO COBRE
 * ============================================
 * 
 * Resistividade do cobre a 20°C: 0.0175 Ω·mm²/m
 * 
 * Esta constante representa a resistência elétrica específica do cobre puro
 * a uma temperatura de 20°C. É usada para calcular a resistência de condutores
 * elétricos baseado em sua área de seção transversal e comprimento.
 * 
 * Fórmula da resistência: R = ρ × L / S
 * Onde:
 *   R = resistência elétrica (Ω)
 *   ρ = resistividade (Ω·mm²/m) = 0.0175 para cobre a 20°C
 *   L = comprimento do condutor (m)
 *   S = área de seção transversal (mm²)
 * 
 * NOTA: A resistividade varia com a temperatura. Para cálculos mais precisos
 * em temperaturas diferentes, seria necessário aplicar um fator de correção.
 * Para aplicações práticas em instalações elétricas residenciais, 0.0175 é
 * um valor padrão amplamente aceito.
 * 
 * FONTE: Valores baseados em normas técnicas (NBR 5410 no Brasil, CEI na Itália)
 */
const RESISTIVIDADE_COBRE = 0.0175; // Ω·mm²/m (cobre a 20°C)

// Bitolas comerciais padrão brasileiro (mm²)
// Ordenadas do menor para o maior
// Estas são as bitolas disponíveis no mercado brasileiro conforme norma NBR 5410
const BITOLAS_COMERCIAIS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

// Disjuntores comerciais padrão (A)
// Valores típicos disponíveis no mercado brasileiro e italiano
const DISJUNTORES_COMERCIAIS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

// Fator de segurança para dimensionamento de bitola
// Usado no Brasil e Itália: 1.25 (25% de margem de segurança)
const FATOR_SEGURANCA = 1.25;

// Valores típicos de tensão para corrente contínua (V)
// Usados no slider quando o tipo de corrente é CC
// Índice do array corresponde ao valor do slider (0-10)
// Limite máximo: 96V
const TENSOES_CC_TIPICAS = [3.3, 5, 9, 12, 24, 36, 48, 60, 72, 84, 96];

// ============================================
// ELEMENTOS HTML (inicializados no DOMContentLoaded)
// ============================================
let sliderPotencia, inputPotencia;
let sliderComprimento, inputComprimento;
let sliderTensaoCC, inputTensaoCC;
let sliderQuedaTensao, inputQuedaTensao;
let radioTipoCorrente;
let radioTensaoCA;
let secaoTensaoCC;
let areaMinima, bitolaComercial, correnteCircuito, quedaReal;

// Flag para rastrear se a tensão CC foi digitada manualmente (fora dos steps)
// Quando true, usa o valor do input diretamente; quando false, usa o valor do slider
let tensaoCCManual = false;

// Controle para botões de seta (repetição ao segurar)
let intervalId = null;
let timeoutId = null;

// ============================================
// FUNÇÕES DE AJUSTE DE VALORES (Botões de Seta)
// ============================================

/**
 * Calcula o step dinâmico para o slider de potência baseado no valor atual
 * @param {number} valor - Valor atual do slider
 * @returns {number} - Step apropriado (1, 10, 50 ou 100)
 * 
 * Regras:
 * - Entre 1 e 10: step de 1
 * - Entre 100 e 1000: step de 10
 * - Entre 1000 e 3000: step de 50
 * - Entre 3000 e 10000: step de 100
 * - Entre 10 e 100: usa step de 1 (transição suave)
 */
function obterStepPotencia(valor) {
    if (valor <= 10) {
        // Entre 1 e 10: step de 1
        return 1;
    } else if (valor < 100) {
        // Entre 10 e 99: step de 1 (transição suave até 100)
        return 1;
    } else if (valor < 1000) {
        // Entre 100 e 999: step de 10
        return 10;
    } else if (valor < 3000) {
        // Entre 1000 e 2999: step de 50
        return 50;
    } else {
        // Entre 3000 e 10000: step de 100
        return 100;
    }
}

/**
 * Aumenta ou diminui o valor de um slider
 * @param {string} targetId - ID do slider a ser ajustado
 * @param {number|string} step - Quanto adicionar ou subtrair (pode ser negativo ou "dynamic" para steps dinâmicos)
 */
function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    // Obtém o valor atual do slider
    let valor = parseFloat(slider.value) || 0;
    
    // Se o step for "dynamic", calcula o step apropriado baseado no valor atual
    let stepEfetivo = step;
    if (step === 'dynamic' || step === '-dynamic') {
        const stepCalculado = obterStepPotencia(valor);
        stepEfetivo = step === 'dynamic' ? stepCalculado : -stepCalculado;
    }
    
    // Calcula o novo valor
    let novoValor = valor + stepEfetivo;
    
    // Limita ao mínimo e máximo do slider
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    novoValor = Math.max(min, Math.min(max, novoValor));
    
    // Para o slider de potência, ajusta o valor para o step apropriado
    if (targetId === 'sliderPotencia') {
        const stepApropriado = obterStepPotencia(novoValor);
        // Arredonda para o múltiplo mais próximo do step
        novoValor = Math.round(novoValor / stepApropriado) * stepApropriado;
        // Garante que não ultrapasse os limites
        novoValor = Math.max(min, Math.min(max, novoValor));
    }
    
    // Atualiza o slider
    slider.value = novoValor;
    
    // Dispara evento de input para atualizar a interface
    slider.dispatchEvent(new Event('input'));
}

/**
 * Inicia a repetição contínua ao segurar um botão de seta
 * @param {string} targetId - ID do slider alvo
 * @param {number} step - Passo a ser aplicado
 */
function iniciarRepeticao(targetId, step) {
    // Primeiro ajuste imediato
    ajustarValor(targetId, step);
    
    // Atraso inicial de 500ms antes de começar a repetir
    timeoutId = setTimeout(() => {
        // Repete a cada 100ms enquanto o botão estiver pressionado
        intervalId = setInterval(() => {
            ajustarValor(targetId, step);
        }, 100);
    }, 500);
}

/**
 * Para a repetição contínua quando o botão é solto
 */
function pararRepeticao() {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Obtém o valor numérico de um input formatado
 * Remove pontos (milhares) e substitui vírgula (decimal) por ponto
 * @param {string} valorFormatado - Valor formatado (ex: "1.000,50")
 * @returns {number} - Valor numérico (ex: 1000.50)
 */
function obterValorNumericoFormatado(valorFormatado) {
    if (!valorFormatado) return 0;
    // Remove pontos (separadores de milhares)
    let valor = valorFormatado.toString().replace(/\./g, '');
    // Substitui vírgula (separador decimal) por ponto
    valor = valor.replace(',', '.');
    return parseFloat(valor) || 0;
}

/**
 * Formata um número para exibição
 * Usa ponto para milhares e vírgula para decimais (padrão brasileiro)
 * @param {number} valor - Valor numérico
 * @param {number} casasDecimais - Número de casas decimais (padrão: 2)
 * @returns {string} - Valor formatado
 */
function formatarNumero(valor, casasDecimais = 2) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    // Sempre usa formatação brasileira (vírgula decimal, ponto milhares)
    return valor.toLocaleString('pt-BR', {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais,
        useGrouping: true
    });
}

/**
 * Formata potência para exibição com abreviação "k" para valores >= 1000
 * Exemplos: 999 → "999", 1000 → "1k", 2500 → "2,5k", 10000 → "10k"
 * @param {number} valor - Valor da potência em watts
 * @returns {string} - Valor formatado com "k" quando apropriado
 */
function formatarPotencia(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    
    // Se o valor for menor que 1000, formata normalmente
    if (valor < 1000) {
        return formatarNumero(valor, 0);
    }
    
    // Se for >= 1000, divide por 1000 e adiciona "k"
    const valorK = valor / 1000;
    
    // Se for um número inteiro (ex: 1k, 2k, 10k), não mostra decimais
    if (valorK % 1 === 0) {
        return valorK + 'k';
    }
    
    // Caso contrário, mostra uma casa decimal (ex: 1,5k, 2,5k)
    return formatarNumero(valorK, 1) + 'k';
}

/**
 * ============================================
 * FUNÇÃO: CALCULAR CORRENTE DO CIRCUITO
 * ============================================
 * 
 * Calcula a corrente elétrica necessária para alimentar uma carga
 * com determinada potência em uma tensão específica.
 * 
 * @param {number} potencia - Potência elétrica em watts (W)
 * @param {number} tensao - Tensão de operação em volts (V)
 * @returns {number} Corrente elétrica em amperes (A)
 * 
 * FÓRMULA:
 *   I = P / V
 * 
 * Onde:
 *   I = corrente (A)
 *   P = potência (W)
 *   V = tensão (V)
 * 
 * OBSERVAÇÕES:
 * - Para corrente contínua (CC): a fórmula é direta
 * - Para corrente alternada (CA): assume-se fator de potência unitário (cos φ = 1)
 *   para simplificação. Em circuitos com cargas reativas (motores, etc.),
 *   seria necessário considerar: I = P / (V × cos φ)
 * 
 * EXEMPLO:
 *   Potência: 2200 W
 *   Tensão: 220 V
 *   Corrente: 2200 / 220 = 10 A
 * 
 * VALIDAÇÃO:
 * - Se tensão = 0, retorna 0 para evitar divisão por zero
 */
function calcularCorrente(potencia, tensao) {
    // Proteção contra divisão por zero
    if (tensao === 0) return 0;
    
    // Fórmula básica: I = P / V
    // Para CA com fator de potência unitário (cos φ = 1), a fórmula é a mesma
    // Para cargas reativas, seria necessário: I = P / (V × cos φ)
    return potencia / tensao;
}

/**
 * ============================================
 * FUNÇÃO: CALCULAR ÁREA DE SEÇÃO MÍNIMA
 * ============================================
 * 
 * Calcula a área de seção transversal mínima necessária para um condutor
 * elétrico que atenda aos requisitos de queda de tensão máxima permitida.
 * 
 * @param {number} comprimento - Distância do circuito em metros (m)
 *   IMPORTANTE: Este é o comprimento de UM condutor (distância entre fonte e carga),
 *   não a soma dos dois condutores. A fórmula já multiplica por 2 para considerar
 *   ida e volta.
 * @param {number} corrente - Corrente do circuito em amperes (A)
 * @param {number} tensao - Tensão de operação em volts (V)
 * @param {number} quedaPercentual - Queda de tensão máxima permitida em percentual (%)
 *   Valores típicos: 4% para instalações residenciais (Brasil), 3-5% para outros usos
 * @returns {number} Área de seção mínima em milímetros quadrados (mm²)
 * 
 * DEDUÇÃO DA FÓRMULA:
 * 
 * 1. Queda de tensão em um circuito com dois condutores (ida e volta):
 *    ΔV = 2 × R × I
 * 
 * 2. Resistência de um condutor: R = ρ × L / S
 *    Onde:
 *      R = resistência (Ω)
 *      ρ = resistividade do cobre (0.0175 Ω·mm²/m)
 *      L = comprimento do condutor (m)
 *      S = área de seção transversal (mm²)
 * 
 * 3. Substituindo R na fórmula de queda de tensão:
 *    ΔV = 2 × (ρ × L / S) × I
 *    ΔV = (2 × ρ × L × I) / S
 * 
 * 4. Isolando S (área de seção):
 *    S = (2 × ρ × L × I) / ΔV
 * 
 * Onde:
 *   S = área de seção mínima (mm²)
 *   ρ = resistividade do cobre = 0.0175 Ω·mm²/m
 *   L = distância entre fonte e carga (m) - apenas um condutor
 *   I = corrente do circuito (A)
 *   ΔV = queda de tensão máxima em volts = (queda% / 100) × V
 * 
 * EXEMPLO PRÁTICO:
 *   Potência: 2200 W
 *   Tensão: 220 V
 *   Corrente: 10 A (calculada como 2200 / 220)
 *   Distância: 30 m
 *   Queda máxima: 4%
 *   
 *   ΔV = (4 / 100) × 220 = 8.8 V
 *   S = (2 × 0.0175 × 30 × 10) / 8.8
 *   S = 10.5 / 8.8
 *   S = 1.19 mm²
 *   
 *   Bitola comercial mínima: 2.5 mm² (com fator de segurança)
 * 
 * VALIDAÇÃO:
 * - Se quedaVolts = 0, retorna Infinity (evita divisão por zero)
 */
function calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual) {
    // ============================================
    // PASSO 1: CONVERTER QUEDA PERCENTUAL PARA VOLTS
    // ============================================
    // A queda de tensão é especificada em percentual (ex: 4%),
    // mas a fórmula precisa do valor em volts.
    // Exemplo: 4% de 220V = 8.8V
    const quedaVolts = (quedaPercentual / 100) * tensao;
    
    // Proteção contra divisão por zero
    // Se a queda permitida for zero, nenhuma bitola seria suficiente
    if (quedaVolts === 0) return Infinity;
    
    // ============================================
    // PASSO 2: CALCULAR ÁREA MÍNIMA
    // ============================================
    // Fórmula: S = (2 × ρ × L × I) / ΔV
    // 
    // O fator 2 considera que a queda de tensão ocorre em ambos os condutores:
    // - Condutor de ida (fase/positivo): perde ΔV/2
    // - Condutor de volta (neutro/negativo): perde ΔV/2
    // - Total: ΔV = 2 × (queda em um condutor)
    // 
    // O comprimento L é a distância entre fonte e carga (não a soma dos dois condutores),
    // pois a fórmula já multiplica por 2 para considerar ida e volta.
    const areaMinima = (2 * RESISTIVIDADE_COBRE * comprimento * corrente) / quedaVolts;
    
    return areaMinima;
}

/**
 * Seleciona a bitola comercial que atende ao requisito mínimo com fator de segurança
 * @param {number} areaMinima - Área de seção mínima necessária (mm²)
 * @returns {number} - Bitola comercial em milímetros quadrados (mm²)
 * 
 * Aplica fator de segurança de 1.25 (25% de margem) conforme prática no Brasil e Itália
 */
function selecionarBitolaComercial(areaMinima) {
    // Aplica fator de segurança (1.25 = 25% de margem)
    // Isso garante que a bitola escolhida tenha capacidade superior à necessária
    const areaComSeguranca = areaMinima * FATOR_SEGURANCA;
    
    // Percorre as bitolas comerciais do menor para o maior
    // Retorna a primeira que seja maior ou igual à área mínima com segurança
    for (let i = 0; i < BITOLAS_COMERCIAIS.length; i++) {
        if (BITOLAS_COMERCIAIS[i] >= areaComSeguranca) {
            return BITOLAS_COMERCIAIS[i];
        }
    }
    
    // Se nenhuma bitola atender, retorna a maior disponível
    return BITOLAS_COMERCIAIS[BITOLAS_COMERCIAIS.length - 1];
}

/**
 * Seleciona o disjuntor comercial mais próximo para proteger o circuito
 * @param {number} corrente - Corrente do circuito em amperes (A)
 * @returns {number} - Disjuntor comercial em amperes (A)
 * 
 * O disjuntor deve ser maior que a corrente do circuito para permitir funcionamento normal,
 * mas próximo o suficiente para proteger adequadamente
 */
function selecionarDisjuntorComercial(corrente) {
    // Aplica fator de segurança de 1.25 para dimensionar o disjuntor
    // O disjuntor deve suportar 25% a mais que a corrente nominal
    const correnteComSeguranca = corrente * FATOR_SEGURANCA;
    
    // Percorre os disjuntores comerciais do menor para o maior
    // Retorna o primeiro que seja maior ou igual à corrente com segurança
    for (let i = 0; i < DISJUNTORES_COMERCIAIS.length; i++) {
        if (DISJUNTORES_COMERCIAIS[i] >= correnteComSeguranca) {
            return DISJUNTORES_COMERCIAIS[i];
        }
    }
    
    // Se nenhum disjuntor atender, retorna o maior disponível
    return DISJUNTORES_COMERCIAIS[DISJUNTORES_COMERCIAIS.length - 1];
}

/**
 * ============================================
 * FUNÇÃO: CALCULAR QUEDA DE TENSÃO REAL
 * ============================================
 * 
 * Calcula a queda de tensão real que ocorrerá em um circuito usando
 * uma bitola comercial específica. Esta função é usada para verificar
 * se a bitola selecionada atende aos requisitos de queda de tensão.
 * 
 * @param {number} comprimento - Distância do circuito em metros (m)
 *   IMPORTANTE: Este é o comprimento de UM condutor (distância entre fonte e carga),
 *   não a soma dos dois condutores. A fórmula já multiplica por 2 para considerar
 *   ida e volta.
 * @param {number} corrente - Corrente do circuito em amperes (A)
 * @param {number} tensao - Tensão de operação em volts (V)
 * @param {number} bitola - Bitola comercial em milímetros quadrados (mm²)
 *   Exemplos: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240
 * @returns {number} Queda de tensão real em percentual (%)
 * 
 * DEDUÇÃO DA FÓRMULA:
 * 
 * 1. Resistência de um condutor: R = ρ × L / S
 * 
 * 2. Queda de tensão em um circuito com dois condutores:
 *    ΔV = 2 × R × I
 * 
 * 3. Substituindo R:
 *    ΔV = 2 × (ρ × L / S) × I
 *    ΔV = (2 × ρ × L × I) / S
 * 
 * 4. Convertendo para percentual:
 *    ΔV% = (ΔV / V) × 100
 * 
 * Onde:
 *   ΔV = queda de tensão em volts
 *   ρ = resistividade do cobre = 0.0175 Ω·mm²/m
 *   L = distância entre fonte e carga (m) - apenas um condutor
 *   I = corrente do circuito (A)
 *   S = área de seção do condutor (mm²) = bitola
 *   V = tensão de operação (V)
 * 
 * EXEMPLO PRÁTICO:
 *   Corrente: 10 A
 *   Tensão: 220 V
 *   Distância: 30 m
 *   Bitola: 2.5 mm²
 *   
 *   ΔV = (2 × 0.0175 × 30 × 10) / 2.5
 *   ΔV = 10.5 / 2.5
 *   ΔV = 4.2 V
 *   
 *   ΔV% = (4.2 / 220) × 100 = 1.91%
 *   
 *   Resultado: 1.91% (dentro do limite de 4% recomendado)
 * 
 * VALIDAÇÃO:
 * - Se tensão = 0 ou bitola = 0, retorna 0 para evitar divisão por zero
 */
function calcularQuedaReal(comprimento, corrente, tensao, bitola) {
    // Proteção contra divisão por zero
    if (tensao === 0 || bitola === 0) return 0;
    
    // ============================================
    // PASSO 1: CALCULAR QUEDA DE TENSÃO EM VOLTS
    // ============================================
    // Fórmula: ΔV = (2 × ρ × L × I) / S
    // 
    // O fator 2 considera que a queda ocorre em ambos os condutores (ida e volta).
    // O comprimento L é a distância entre fonte e carga (não a soma dos condutores).
    const quedaVolts = (2 * RESISTIVIDADE_COBRE * comprimento * corrente) / bitola;
    
    // ============================================
    // PASSO 2: CONVERTER PARA PERCENTUAL
    // ============================================
    // A queda de tensão é expressa como percentual da tensão nominal
    // para facilitar a comparação com limites recomendados (ex: 4%)
    const quedaPercentual = (quedaVolts / tensao) * 100;
    
    return quedaPercentual;
}

/**
 * Obtém a tensão atual baseada no tipo de corrente selecionado
 * @returns {number} - Tensão em volts (V)
 */
function obterTensaoAtual() {
    const tipoCorrente = document.querySelector('input[name="tipoCorrente"]:checked')?.value;
    
    if (tipoCorrente === 'ca') {
        // Para CA, obtém o valor do radio button (110 ou 220)
        const tensaoCA = document.querySelector('input[name="tensaoCA"]:checked')?.value;
        return parseFloat(tensaoCA) || 110;
    } else {
        // Para CC, verifica se há um valor manual digitado
        if (tensaoCCManual && inputTensaoCC) {
            const valorManual = obterValorNumericoFormatado(inputTensaoCC.value);
            // Valida que está dentro do limite (0 a 96V)
            if (valorManual > 0 && valorManual <= 96) {
                return valorManual;
            }
        }
        // Caso contrário, usa o valor do slider (steps)
        const indice = parseInt(sliderTensaoCC.value) || 0;
        return TENSOES_CC_TIPICAS[indice] || 12;
    }
}

/**
 * Atualiza a interface com os resultados do cálculo
 */
function atualizarResultados() {
    // Obtém os valores dos inputs
    // Para potência, precisa tratar o "k" se presente
    let valorPotenciaTexto = inputPotencia.value.toString().trim();
    let multiplicadorPotencia = 1;
    if (valorPotenciaTexto.toLowerCase().endsWith('k')) {
        valorPotenciaTexto = valorPotenciaTexto.slice(0, -1).trim();
        multiplicadorPotencia = 1000;
    }
    const potencia = obterValorNumericoFormatado(valorPotenciaTexto) * multiplicadorPotencia;
    
    const comprimento = obterValorNumericoFormatado(inputComprimento.value);
    const tensao = obterTensaoAtual();
    const quedaPercentual = obterValorNumericoFormatado(inputQuedaTensao.value);
    
    // Validação básica - permite qualquer valor positivo (não limita aos limites do slider)
    if (potencia <= 0 || comprimento <= 0 || tensao <= 0 || quedaPercentual <= 0) {
        areaMinima.textContent = '-';
        bitolaComercial.textContent = '-';
        correnteCircuito.textContent = '-';
        quedaReal.textContent = '-';
        if (disjuntorComercial) disjuntorComercial.textContent = '-';
        return;
    }
    
    // Calcula a corrente do circuito
    const corrente = calcularCorrente(potencia, tensao);
    
    // Calcula a área de seção mínima
    const areaMin = calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual);
    
    // Seleciona a bitola comercial (já aplica fator de segurança internamente)
    const bitola = selecionarBitolaComercial(areaMin);
    
    // Calcula a queda de tensão real com a bitola escolhida
    const quedaRealPercentual = calcularQuedaReal(comprimento, corrente, tensao, bitola);
    
    // Seleciona o disjuntor comercial recomendado
    const disjuntor = selecionarDisjuntorComercial(corrente);
    
    // Atualiza a interface
    areaMinima.textContent = formatarNumero(areaMin, 2) + ' mm²';
    bitolaComercial.textContent = formatarNumero(bitola, 1) + ' mm²';
    correnteCircuito.textContent = formatarNumero(corrente, 2) + ' A';
    quedaReal.textContent = formatarNumero(quedaRealPercentual, 2) + ' %';
    disjuntorComercial.textContent = formatarNumero(disjuntor, 0) + ' A';
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
}

/**
 * Atualiza a exibição da tensão CC baseada no slider
 */
function atualizarTensaoCC() {
    // Quando o slider é movido, desativa o modo manual
    tensaoCCManual = false;
    const indice = parseInt(sliderTensaoCC.value) || 0;
    const tensao = TENSOES_CC_TIPICAS[indice] || 12;
    inputTensaoCC.value = formatarNumero(tensao, 1);
    if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputTensaoCC);
    atualizarResultados();
}

/**
 * Alterna entre os controles de tensão CA e CC
 */
function alternarTipoCorrente() {
    const tipoCorrente = document.querySelector('input[name="tipoCorrente"]:checked')?.value;
    const tensaoCAInline = document.getElementById('tensaoCAInline');
    
    if (tipoCorrente === 'ca') {
        // Mostra controles de CA inline (ao lado da tomada) e esconde de CC
        if (tensaoCAInline) {
            tensaoCAInline.style.display = 'flex';
        }
        if (secaoTensaoCC) {
            secaoTensaoCC.style.display = 'none';
        }
    } else {
        // Esconde controles de CA inline e mostra controles de CC
        if (tensaoCAInline) {
            tensaoCAInline.style.display = 'none';
        }
        if (secaoTensaoCC) {
            secaoTensaoCC.style.display = 'block';
        }
    }
    
    // Recalcula os resultados
    atualizarResultados();
}

// ============================================
// SISTEMA DE INTERNACIONALIZAÇÃO (i18n)
// ============================================

/**
 * Dicionário de traduções
 */
const traducoes = {
    'pt-BR': {
        'app-title': '🔌 Calculadora de Bitola de Fios',
        'app-subtitle': 'Área de Seção Mínima para Circuitos CC e CA',
        'label-tipo-corrente': 'Tipo de Corrente',
        'label-potencia': 'Potência Máxima Nominal',
        'label-comprimento': 'Distância do Circuito',
        'label-tensao': 'Tensão',
        'label-queda-tensao': 'Queda de Tensão Máxima',
        'unit-watt': 'W',
        'unit-meter': 'm',
        'unit-volt': 'V',
        'dica-comprimento': '💡 Distância entre a fonte e a carga<br>(o cálculo considera automaticamente ida e volta)',
        'dica-tensao-cc': '💡 Valores típicos: 3.3V, 5V, 9V, 12V, 24V, 36V, 48V, 60V, 72V, 96V',
        'dica-queda-tensao': '✅ Recomendado para projetos residenciais no Brasil: 4% (padrão mais utilizado)',
        'resultados-title': '📊 Resultados',
        'resultado-area-minima': 'Área de Seção Mínima:',
        'resultado-bitola-comercial': 'Bitola Comercial Recomendada:',
        'resultado-corrente': 'Corrente do Circuito:',
        'resultado-queda-real': 'Queda de Tensão Real:',
        'resultado-disjuntor': 'Disjuntor Comercial Recomendado:',
        'footer': 'Calculadora de Bitola de Fios - Engenharia Nata @ 2025',
        'aria-home': 'Voltar para a tela inicial',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'memorial-title': '📚 Memorial de Cálculo - Bitola de Fios',
        'memorial-intro-title': '🎯 Objetivo do Cálculo',
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculada a bitola mínima de fios elétricos para circuitos CC e CA, considerando potência, distância, tensão e queda de tensão máxima permitida.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Corrente do Circuito',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'A corrente é calculada dividindo a potência pela tensão. Esta é a corrente que o circuito precisa transportar.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular Área de Seção Mínima',
        'memorial-passo2-explicacao': 'A área mínima é calculada considerando a resistividade do cobre, a distância (multiplicada por 2 para ida e volta), a corrente e a queda de tensão máxima permitida.',
        'memorial-constants': 'Constantes usadas:',
        'memorial-resistividade': 'ρ (resistividade do cobre) = 0.0175 Ω·mm²/m a 20°C',
        'memorial-fator-2': 'Fator 2 = considera ida e volta do circuito (dois condutores)',
        'memorial-passo3-title': '3️⃣ Passo 3: Selecionar Bitola Comercial',
        'memorial-passo3-explicacao': 'A área mínima calculada é multiplicada por um fator de segurança de 1.25 (25% de margem) e então selecionamos a bitola comercial padrão brasileiro (NBR 5410) que atende ao requisito.',
        'memorial-bitolas': 'Bitolas comerciais disponíveis:',
        'memorial-bitolas-lista': '1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm²',
        'memorial-passo4-title': '4️⃣ Passo 4: Verificar Queda de Tensão Real',
        'memorial-passo4-explicacao': 'Recalculamos a queda de tensão com a bitola comercial escolhida para verificar se está dentro do limite permitido.',
        'memorial-passo5-title': '5️⃣ Passo 5: Selecionar Disjuntor Comercial',
        'memorial-passo5-explicacao': 'O disjuntor é selecionado com base na corrente do circuito, aplicando um fator de segurança de 1.25 e escolhendo o disjuntor comercial padrão que atende ao requisito.',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-corrente': 'Corrente do Circuito:',
        'memorial-resumo-area': 'Área Mínima:',
        'memorial-resumo-bitola': 'Bitola Comercial:',
        'memorial-resumo-queda': 'Queda Real:',
        'memorial-resumo-disjuntor': 'Disjuntor:'
    },
    'it-IT': {
        'app-title': '🔌 Calcolatrice Sezione Cavi',
        'app-subtitle': 'Area di Sezione Minima per Circuiti CC e CA',
        'label-tipo-corrente': 'Tipo di Corrente',
        'label-potencia': 'Potenza Massima Nominale',
        'label-comprimento': 'Distanza del Circuito',
        'label-tensao': 'Tensione',
        'label-queda-tensao': 'Caduta di Tensione Massima',
        'unit-watt': 'W',
        'unit-meter': 'm',
        'unit-volt': 'V',
        'dica-comprimento': '💡 Distanza tra la sorgente e il carico<br>(il calcolo considera automaticamente andata e ritorno)',
        'dica-tensao-cc': '💡 Valori tipici: 3.3V, 5V, 9V, 12V, 24V, 36V, 48V, 60V, 72V, 96V',
        'dica-queda-tensao': '✅ Consigliato per progetti residenziali in Brasile: 4% (standard più utilizzato)',
        'resultados-title': '📊 Risultati',
        'resultado-area-minima': 'Area di Sezione Minima:',
        'resultado-bitola-comercial': 'Sezione Commerciale Consigliata:',
        'resultado-corrente': 'Corrente del Circuito:',
        'resultado-queda-real': 'Caduta di Tensione Reale:',
        'resultado-disjuntor': 'Interruttore Commerciale Consigliato:',
        'footer': 'Calcolatrice Sezione Cavi - Engenharia Nata @ 2025',
        'aria-home': 'Torna alla schermata iniziale',
        'learn-more': 'SCOPRI DI PIÙ!',
        'back': '← Indietro',
        'btn-memorial': 'Vedi Memoriale di Calcolo',
        'memorial-title': '📚 Memoriale di Calcolo - Sezione Cavi',
        'memorial-intro-title': '🎯 Obiettivo del Calcolo',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolata la sezione minima dei cavi elettrici per circuiti CC e CA, considerando potenza, distanza, tensione e caduta di tensione massima consentita.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Corrente del Circuito',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'La corrente viene calcolata dividendo la potenza per la tensione. Questa è la corrente che il circuito deve trasportare.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare Area di Sezione Minima',
        'memorial-passo2-explicacao': 'L\'area minima viene calcolata considerando la resistività del rame, la distanza (moltiplicata per 2 per andata e ritorno), la corrente e la caduta di tensione massima consentita.',
        'memorial-constants': 'Costanti utilizzate:',
        'memorial-resistividade': 'ρ (resistività del rame) = 0.0175 Ω·mm²/m a 20°C',
        'memorial-fator-2': 'Fattore 2 = considera andata e ritorno del circuito (due conduttori)',
        'memorial-passo3-title': '3️⃣ Passo 3: Selezionare Sezione Commerciale',
        'memorial-passo3-explicacao': 'L\'area minima calcolata viene moltiplicata per un fattore di sicurezza di 1.25 (25% di margine) e quindi selezioniamo la sezione commerciale standard brasiliana (NBR 5410) che soddisfa il requisito.',
        'memorial-bitolas': 'Sezioni commerciali disponibili:',
        'memorial-bitolas-lista': '1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm²',
        'memorial-passo4-title': '4️⃣ Passo 4: Verificare Caduta di Tensione Reale',
        'memorial-passo4-explicacao': 'Ricalcoliamo la caduta di tensione con la sezione commerciale scelta per verificare se è entro il limite consentito.',
        'memorial-passo5-title': '5️⃣ Passo 5: Selezionare Interruttore Commerciale',
        'memorial-passo5-explicacao': 'L\'interruttore viene selezionato in base alla corrente del circuito, applicando un fattore di sicurezza di 1.25 e scegliendo l\'interruttore commerciale standard che soddisfa il requisito.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-corrente': 'Corrente del Circuito:',
        'memorial-resumo-area': 'Area Minima:',
        'memorial-resumo-bitola': 'Sezione Commerciale:',
        'memorial-resumo-queda': 'Caduta Reale:',
        'memorial-resumo-disjuntor': 'Interruttore:'
    }
};

// ============================================
// FUNÇÕES DO MEMORIAL DE CÁLCULO
// ============================================

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
        atualizarMemorialComValores();
        memorialSection.style.display = 'block';
        if (resultadosSection) resultadosSection.style.display = 'none';
        // Não rolar - manter posição atual
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}

/**
 * Atualiza o memorial de cálculo com os valores atuais dos cálculos
 * Preenche os exemplos e o resumo com os valores reais calculados
 */
function atualizarMemorialComValores() {
    // Obter valores atuais
    let valorPotenciaTexto = inputPotencia.value.toString().trim();
    let multiplicadorPotencia = 1;
    if (valorPotenciaTexto.toLowerCase().endsWith('k')) {
        valorPotenciaTexto = valorPotenciaTexto.slice(0, -1).trim();
        multiplicadorPotencia = 1000;
    }
    const potencia = obterValorNumericoFormatado(valorPotenciaTexto) * multiplicadorPotencia;
    const comprimento = obterValorNumericoFormatado(inputComprimento.value);
    const tensao = obterTensaoAtual();
    const quedaPercentual = obterValorNumericoFormatado(inputQuedaTensao.value);
    
    // Validação básica
    if (potencia <= 0 || comprimento <= 0 || tensao <= 0 || quedaPercentual <= 0) {
        return;
    }
    
    // Calcula os valores
    const corrente = calcularCorrente(potencia, tensao);
    const areaMin = calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual);
    const bitola = selecionarBitolaComercial(areaMin);
    const quedaRealPercentual = calcularQuedaReal(comprimento, corrente, tensao, bitola);
    const disjuntor = selecionarDisjuntorComercial(corrente);
    
    // Atualiza exemplos no memorial
    const exemploCorrente = document.getElementById('memorial-exemplo-corrente');
    if (exemploCorrente) {
        exemploCorrente.textContent = `${formatarNumero(potencia, 0)}W ÷ ${formatarNumero(tensao, 0)}V = ${formatarNumero(corrente, 2)}A`;
    }
    
    const exemploArea = document.getElementById('memorial-exemplo-area');
    if (exemploArea) {
        const quedaVolts = (quedaPercentual / 100) * tensao;
        exemploArea.textContent = `(2 × 0.0175 × ${formatarNumero(comprimento, 0)}m × ${formatarNumero(corrente, 2)}A) ÷ ${formatarNumero(quedaVolts, 2)}V = ${formatarNumero(areaMin, 2)} mm²`;
    }
    
    const exemploBitola = document.getElementById('memorial-exemplo-bitola');
    if (exemploBitola) {
        const areaComSeguranca = areaMin * 1.25;
        exemploBitola.textContent = `Área mínima ${formatarNumero(areaMin, 2)} mm² × 1.25 = ${formatarNumero(areaComSeguranca, 2)} mm² → Bitola comercial: ${formatarNumero(bitola, 1)} mm²`;
    }
    
    const exemploQueda = document.getElementById('memorial-exemplo-queda');
    if (exemploQueda) {
        exemploQueda.textContent = `Com bitola ${formatarNumero(bitola, 1)} mm² → queda real = ${formatarNumero(quedaRealPercentual, 2)}% (dentro do limite de ${formatarNumero(quedaPercentual, 1)}%)`;
    }
    
    const exemploDisjuntor = document.getElementById('memorial-exemplo-disjuntor');
    if (exemploDisjuntor) {
        const correnteComSeguranca = corrente * 1.25;
        exemploDisjuntor.textContent = `Corrente ${formatarNumero(corrente, 2)}A × 1.25 = ${formatarNumero(correnteComSeguranca, 2)}A → Disjuntor comercial: ${formatarNumero(disjuntor, 0)}A`;
    }
    
    // Atualiza resumo calculado
    const resumoCorrente = document.getElementById('resumo-corrente');
    if (resumoCorrente) resumoCorrente.textContent = `${formatarNumero(corrente, 2)} A`;
    
    const resumoArea = document.getElementById('resumo-area');
    if (resumoArea) resumoArea.textContent = `${formatarNumero(areaMin, 2)} mm²`;
    
    const resumoBitola = document.getElementById('resumo-bitola');
    if (resumoBitola) resumoBitola.textContent = `${formatarNumero(bitola, 1)} mm²`;
    
    const resumoQueda = document.getElementById('resumo-queda');
    if (resumoQueda) resumoQueda.textContent = `${formatarNumero(quedaRealPercentual, 2)}%`;
    
    const resumoDisjuntor = document.getElementById('resumo-disjuntor');
    if (resumoDisjuntor) resumoDisjuntor.textContent = `${formatarNumero(disjuntor, 0)} A`;
}

/**
 * Troca o idioma da interface
 * @param {string} novoIdioma - Código do idioma ('pt-BR' ou 'it-IT')
 */
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    
    // Salva a preferência no localStorage
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // Atualiza todos os elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            // Usa innerHTML para permitir tags HTML como <br> nas traduções
            elemento.innerHTML = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza atributos title e aria-label
    document.querySelectorAll('[data-i18n-title]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n-title');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.setAttribute('title', traducoes[novoIdioma][chave]);
            elemento.setAttribute('aria-label', traducoes[novoIdioma][chave]);
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
    
    // Recalcula resultados para atualizar formatação numérica
    atualizarResultados();
}

// ============================================
// INICIALIZAÇÃO (quando a página carrega)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Obtém referências aos elementos HTML
    sliderPotencia = document.getElementById('sliderPotencia');
    inputPotencia = document.getElementById('inputPotencia');
    sliderComprimento = document.getElementById('sliderComprimento');
    inputComprimento = document.getElementById('inputComprimento');
    sliderTensaoCC = document.getElementById('sliderTensaoCC');
    inputTensaoCC = document.getElementById('inputTensaoCC');
    sliderQuedaTensao = document.getElementById('sliderQuedaTensao');
    inputQuedaTensao = document.getElementById('inputQuedaTensao');
    radioTipoCorrente = document.querySelectorAll('input[name="tipoCorrente"]');
    radioTensaoCA = document.querySelectorAll('input[name="tensaoCA"]');
    secaoTensaoCC = document.getElementById('secaoTensaoCC');
    areaMinima = document.getElementById('areaMinima');
    bitolaComercial = document.getElementById('bitolaComercial');
    correnteCircuito = document.getElementById('correnteCircuito');
    quedaReal = document.getElementById('quedaReal');
    disjuntorComercial = document.getElementById('disjuntorComercial');
    
    // Event listeners para sliders
    sliderPotencia.addEventListener('input', () => {
        let valor = parseFloat(sliderPotencia.value);
        
        // Para o slider de potência, ajusta o valor para o step apropriado
        const stepApropriado = obterStepPotencia(valor);
        valor = Math.round(valor / stepApropriado) * stepApropriado;
        
        // Garante que está dentro dos limites
        const min = parseFloat(sliderPotencia.min) || 1;
        const max = parseFloat(sliderPotencia.max) || 10000;
        valor = Math.max(min, Math.min(max, valor));
        
        // Atualiza o slider com o valor ajustado
        sliderPotencia.value = valor;
        inputPotencia.value = formatarPotencia(valor);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPotencia);
        atualizarResultados();
    });
    
    sliderComprimento.addEventListener('input', () => {
        inputComprimento.value = formatarNumero(parseFloat(sliderComprimento.value), 0);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputComprimento);
        atualizarResultados();
    });
    
    sliderTensaoCC.addEventListener('input', atualizarTensaoCC);
    
    sliderQuedaTensao.addEventListener('input', () => {
        inputQuedaTensao.value = formatarNumero(parseFloat(sliderQuedaTensao.value), 1);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputQuedaTensao);
        atualizarResultados();
    });
    
    // Event listeners para inputs editáveis
    // Seleciona todo o texto quando o campo recebe foco
    inputPotencia.addEventListener('focus', (e) => {
        e.target.select();
    });
    
    inputPotencia.addEventListener('input', () => {
        // Remove "k" se presente e converte para número
        let valorTexto = inputPotencia.value.toString().trim();
        let multiplicador = 1;
        
        // Se terminar com "k", remove e multiplica por 1000
        if (valorTexto.toLowerCase().endsWith('k')) {
            valorTexto = valorTexto.slice(0, -1).trim();
            multiplicador = 1000;
        }
        
        // Converte o valor numérico
        const valor = obterValorNumericoFormatado(valorTexto) * multiplicador;
        
        // Permite qualquer valor positivo (não limita aos limites do slider)
        if (valor > 0) {
            // Atualiza o slider apenas se estiver dentro dos limites
            if (valor >= parseFloat(sliderPotencia.min) && valor <= parseFloat(sliderPotencia.max)) {
                sliderPotencia.value = valor;
            }
            // Sempre atualiza o input com a formatação correta, mesmo se estiver fora dos limites
            inputPotencia.value = formatarPotencia(valor);
        }
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPotencia);
        atualizarResultados();
    });
    
    inputComprimento.addEventListener('focus', (e) => {
        e.target.select();
    });
    
    inputComprimento.addEventListener('input', () => {
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputComprimento);
        const valor = obterValorNumericoFormatado(inputComprimento.value);
        // Permite qualquer valor positivo
        if (valor > 0) {
            if (valor >= parseFloat(sliderComprimento.min) && valor <= parseFloat(sliderComprimento.max)) {
                sliderComprimento.value = valor;
            }
        }
        atualizarResultados();
    });
    
    inputTensaoCC.addEventListener('focus', (e) => {
        e.target.select();
    });
    
    inputTensaoCC.addEventListener('input', () => {
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputTensaoCC);
        const valor = obterValorNumericoFormatado(inputTensaoCC.value);
        
        // Valida que o valor está dentro do limite permitido (0 a 96V)
        if (valor > 0 && valor <= 96) {
            // Ativa o modo manual para usar o valor digitado diretamente
            tensaoCCManual = true;
            
            // Opcionalmente, ajusta o slider para o valor mais próximo (visual apenas)
            // mas não força o uso desse valor no cálculo
            let indiceMaisProximo = 0;
            let diferencaMinima = Infinity;
            for (let i = 0; i < TENSOES_CC_TIPICAS.length; i++) {
                const diferenca = Math.abs(TENSOES_CC_TIPICAS[i] - valor);
                if (diferenca < diferencaMinima) {
                    diferencaMinima = diferenca;
                    indiceMaisProximo = i;
                }
            }
            // Atualiza o slider visualmente, mas o cálculo usará o valor manual
            sliderTensaoCC.value = indiceMaisProximo;
        } else if (valor > 96) {
            // Se exceder 96V, limita a 96V
            inputTensaoCC.value = '96';
            tensaoCCManual = true;
            sliderTensaoCC.value = TENSOES_CC_TIPICAS.length - 1; // último índice (96V)
        } else if (valor <= 0) {
            // Se for 0 ou negativo, limita ao mínimo (3.3V)
            inputTensaoCC.value = '3,3';
            tensaoCCManual = true;
            sliderTensaoCC.value = 0;
        }
        
        // Recalcula os resultados usando o valor digitado (ou o valor limitado)
        atualizarResultados();
    });
    
    inputQuedaTensao.addEventListener('focus', (e) => {
        e.target.select();
    });
    
    inputQuedaTensao.addEventListener('input', () => {
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputQuedaTensao);
        const valor = obterValorNumericoFormatado(inputQuedaTensao.value);
        // Permite qualquer valor positivo
        if (valor > 0) {
            if (valor >= parseFloat(sliderQuedaTensao.min) && valor <= parseFloat(sliderQuedaTensao.max)) {
                sliderQuedaTensao.value = valor;
            }
        }
        atualizarResultados();
    });
    
    // Event listeners para botões de seta
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            const targetId = btn.getAttribute('data-target');
            let step = btn.getAttribute('data-step');
            
            // Se for "dynamic", mantém como string; caso contrário, converte para número
            if (step !== 'dynamic' && step !== '-dynamic') {
                step = parseFloat(step) || 1;
            } else if (step === '-dynamic') {
                // Para botão de diminuir com step dinâmico
                step = '-dynamic';
            }
            
            iniciarRepeticao(targetId, step);
        });
        
        btn.addEventListener('mouseup', pararRepeticao);
        btn.addEventListener('mouseleave', pararRepeticao);
        
        // Suporte para touch (mobile)
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            let step = btn.getAttribute('data-step');
            
            // Se for "dynamic", mantém como string; caso contrário, converte para número
            if (step !== 'dynamic' && step !== '-dynamic') {
                step = parseFloat(step) || 1;
            } else if (step === '-dynamic') {
                // Para botão de diminuir com step dinâmico
                step = '-dynamic';
            }
            
            iniciarRepeticao(targetId, step);
        });
        
        btn.addEventListener('touchend', pararRepeticao);
        btn.addEventListener('touchcancel', pararRepeticao);
    });
    
    // Event listeners para tipo de corrente
    radioTipoCorrente.forEach(radio => {
        radio.addEventListener('change', () => {
            // Quando muda o tipo de corrente, reseta o modo manual
            tensaoCCManual = false;
            alternarTipoCorrente();
        });
    });
    
    // Event listeners para tensão CA
    radioTensaoCA.forEach(radio => {
        radio.addEventListener('change', atualizarResultados);
    });
    
    // Event listeners para botões de idioma
    document.getElementById('btnPortugues')?.addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano')?.addEventListener('click', () => trocarIdioma('it-IT'));
    
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
    
    // Inicializa o idioma
    trocarIdioma(idiomaAtual);
    
    // Inicializa a exibição da tensão CC
    atualizarTensaoCC();
    
    // Inicializa a formatação da potência
    inputPotencia.value = formatarPotencia(parseFloat(sliderPotencia.value));
    
    // Calcula resultados iniciais
    atualizarResultados();
});

