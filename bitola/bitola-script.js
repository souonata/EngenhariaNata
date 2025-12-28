// ajustarValorPadrao é carregado via script tag no HTML
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
//    Bitolas disponíveis: 0.25, 0.5, 0.75, 1.0, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm²
//    (inclui bitolas finas para cabos: 0.25, 0.5, 0.75, 1.0 mm²)
// 4) Recalcular queda de tensão real com a bitola escolhida para verificação
//
// Observações:
// - A fórmula considera apenas a resistência ôhmica do condutor
// - Para CA, assume-se fator de potência unitário (cos φ = 1) para simplificação
// - A queda de tensão máxima permitida para projetos residenciais no Brasil é 4% (NBR 5410)
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
 * Resistividade do cobre a 20°C: 0.0178 Ω·mm²/m (cobre duro)
 * 
 * Esta constante representa a resistência elétrica específica do cobre duro
 * a uma temperatura de 20°C. É usada para calcular a resistência de condutores
 * elétricos baseado em sua área de seção transversal e comprimento.
 * 
 * Fórmula da resistência: R = ρ × L / S
 * Onde:
 *   R = resistência elétrica (Ω)
 *   ρ = resistividade (Ω·mm²/m) = 0.0178 para cobre duro a 20°C
 *   L = comprimento do condutor (m)
 *   S = área de seção transversal (mm²)
 * 
 * NOTA: A resistividade varia com a temperatura e com a têmpera do cobre:
 *   - Cobre recozido (mole): 0.017241 Ω·mm²/m (NBR NM 280)
 *   - Cobre duro: 0.0178 Ω·mm²/m (NBR 5410)
 * 
 * Para aplicações práticas em instalações elétricas residenciais, utilizamos
 * o valor de 0.0178 Ω·mm²/m conforme especificado na NBR 5410, que é o valor
 * mais conservador e amplamente utilizado em projetos elétricos no Brasil.
 * 
 * REFERÊNCIAS:
 * - NBR 5410:2004 - Instalações elétricas de baixa tensão
 * - NBR NM 280:2003 - Condutores elétricos de cobre
 * - CEI 64-8 - Norma italiana para instalações elétricas
 */
const RESISTIVIDADE_COBRE = 0.0178; // Ω·mm²/m (cobre duro a 20°C, conforme NBR 5410)

// Bitolas comerciais padrão brasileiro (mm²)
// Ordenadas do menor para o maior
// Estas são as bitolas disponíveis no mercado brasileiro conforme norma NBR 5410
// Inclui bitolas finas para cabos de carregadores (0.25, 0.5, 0.75, 1.0 mm²)
const BITOLAS_COMERCIAIS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

// Disjuntores comerciais padrão (A)
// Valores típicos disponíveis no mercado brasileiro e italiano
const DISJUNTORES_COMERCIAIS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

// Fator de segurança para dimensionamento de bitola
// Usado no Brasil e Itália: 1.25 (25% de margem de segurança)
// 
// NOTA: Embora a NBR 5410 não especifique diretamente uma margem de segurança
// de 25%, é uma prática comum entre profissionais da área adotar margens adicionais
// para compensar possíveis variações nas condições operacionais e garantir maior
// segurança. Este fator também é aplicado no dimensionamento de disjuntores.
const FATOR_SEGURANCA = 1.25;

// Valores típicos de tensão para corrente contínua (V)
// Usados no slider quando o tipo de corrente é CC
// Inclui tensões padrão: 5V, 9V, 12V, 15V, 20V
// Índice do array corresponde ao valor do slider (0-13)
// Limite máximo: 96V
const TENSOES_CC_TIPICAS = [3.3, 5, 9, 12, 15, 20, 24, 36, 48, 60, 72, 84, 96];

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
    // Ajusta o step baseado no valor para manter velocidade consistente
    // Steps maiores para valores baixos também, para evitar travamento
    // A aceleração exponencial compensa steps maiores, mantendo velocidade consistente
    if (valor <= 10) {
        // Entre 1 e 10: step de 1 (mantém precisão para valores muito baixos)
        return 1;
    } else if (valor < 50) {
        // Entre 10 e 49: step de 2 (aumenta velocidade sem perder muito controle)
        return 2;
    } else if (valor < 100) {
        // Entre 50 e 99: step de 5 (transição suave até 100)
        return 5;
    } else if (valor < 500) {
        // Entre 100 e 499: step de 10
        return 10;
    } else if (valor < 1000) {
        // Entre 500 e 999: step de 25 (aumenta velocidade)
        return 25;
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
    // Bitola tem step dinâmico para sliderPotencia, manter lógica customizada nesse caso
    if (targetId === 'sliderPotencia' && (step === 'dynamic' || step === '-dynamic')) {
        const slider = document.getElementById(targetId);
        if (!slider) return;
        let valor = parseFloat(slider.value) || 0;
        const stepCalculado = obterStepPotencia(valor);
        const stepEfetivo = step === 'dynamic' ? stepCalculado : -stepCalculado;
        let novoValor = valor + stepEfetivo;
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        novoValor = Math.max(min, Math.min(max, novoValor));
        const stepApropriado = obterStepPotencia(novoValor);
        novoValor = Math.round(novoValor / stepApropriado) * stepApropriado;
        novoValor = Math.max(min, Math.min(max, novoValor));
        slider.value = novoValor;
        slider.dispatchEvent(new Event('input'));
    } else {
        ajustarValorPadrao(targetId, step);
    }
}

/**
 * Função de ajuste customizada para o Bitola que suporta steps dinâmicos
 * Esta função recalcula o step a cada ajuste baseado no valor atual
 * @param {string} targetId - ID do slider
 * @param {number|string} step - Step inicial (pode ser 'dynamic' ou número)
 */
function ajustarValorBitolaComAceleracao(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    // Obtém o valor atual do slider
    let valor = parseFloat(slider.value) || 0;
    
    // Se o step for "dynamic", calcula o step apropriado baseado no valor ATUAL
    // Isso garante que o step seja recalculado a cada ajuste, mantendo a velocidade consistente
    let stepEfetivo = step;
    if (step === 'dynamic' || step === '-dynamic') {
        const stepCalculado = obterStepPotencia(valor);
        stepEfetivo = step === 'dynamic' ? stepCalculado : -stepCalculado;
    }
    
    // Calcula o novo valor
    let novoValor = valor + stepEfetivo;
    
    // Limita ao mínimo e máximo do slider
    // Usa 0 como mínimo se slider.min for 0 (importante para sliders que começam em 0)
    const minRaw = parseFloat(slider.min);
    const min = isNaN(minRaw) ? 1 : minRaw; // Permite 0 como mínimo válido
    const max = parseFloat(slider.max) || 10000;
    
    // Para o slider de potência, ajusta o valor para o step apropriado do NOVO valor
    if (targetId === 'sliderPotencia') {
        // Recalcula o step baseado no novo valor (não no valor antigo)
        const stepApropriado = obterStepPotencia(novoValor);
        // Arredonda para o múltiplo mais próximo do step
        novoValor = Math.round(novoValor / stepApropriado) * stepApropriado;
    }
    
    // Garante que não ultrapasse os limites (mas permite movimento mesmo próximo dos limites)
    novoValor = Math.max(min, Math.min(max, novoValor));
    
    // NÃO força valores min/max quando próximo do fim do curso
    // Isso permite que o usuário continue ajustando mesmo quando próximo dos limites
    // A detecção de limite é feita na função iniciarRepeticao, não aqui
    
    // Atualiza o slider
    slider.value = novoValor;
    
    // Dispara evento de input para atualizar a interface (sem throttle para reduzir lag)
    slider.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Inicia a repetição contínua ao segurar um botão de seta com aceleração exponencial
 * @param {string} targetId - ID do slider alvo
 * @param {number|string} step - Passo a ser aplicado (pode ser 'dynamic')
 */
function iniciarRepeticao(targetId, step) {
    // Para qualquer repetição anterior
    pararRepeticao();
    
    // Ajusta imediatamente (primeira vez)
    ajustarValorBitolaComAceleracao(targetId, step);
    
    // Variáveis para controle de aceleração exponencial
    let startTime = Date.now();
    let lastInterval = 200;
    let lastSecond = 0;
    let isActive = true;
    
    // Função que calcula o intervalo baseado no tempo decorrido (dobra a velocidade a cada segundo)
    const getInterval = (elapsed) => {
        const intervaloInicial = 200;
        const segundos = Math.floor(elapsed / 1000);
        const intervalo = intervaloInicial / Math.pow(2, segundos);
        return Math.max(10, Math.round(intervalo)); // Mínimo 10ms
    };
    
    const doAdjust = () => {
        if (!isActive) return;
        
        const now = Date.now();
        const elapsed = now - startTime;
        const currentSecond = Math.floor(elapsed / 1000);
        const currentInterval = getInterval(elapsed);
        
        // Se mudou o segundo (e portanto o intervalo), reinicia o timer com novo intervalo
        if (currentSecond !== lastSecond || currentInterval !== lastInterval) {
            clearInterval(intervalId);
            lastInterval = currentInterval;
            lastSecond = currentSecond;
            // Reinicia o intervalo com a nova velocidade
            intervalId = setInterval(doAdjust, currentInterval);
        }
        
        // Verifica o valor antes do ajuste
        const slider = document.getElementById(targetId);
        if (slider) {
            const valorAntes = parseFloat(slider.value) || 0;
            // Usa 0 como mínimo se slider.min for 0 (importante para sliders que começam em 0)
            const minRaw = parseFloat(slider.min);
            const min = isNaN(minRaw) ? 1 : minRaw; // Permite 0 como mínimo válido
            const max = parseFloat(slider.max) || 10000;
            
            // Ajusta o valor (recalcula step dinâmico a cada ajuste)
            ajustarValorBitolaComAceleracao(targetId, step);
            
            // Verifica o valor depois do ajuste
            const valorDepois = parseFloat(slider.value) || 0;
            
            // Para apenas se o valor não mudou E está no limite
            // Isso permite movimento mesmo quando próximo dos limites
            if (valorAntes === valorDepois) {
                if ((step === 'dynamic' || (typeof step === 'number' && step > 0)) && valorDepois >= max) {
                    // Se está no máximo e tentando aumentar, mas o valor não mudou, para
                    pararRepeticao();
                    return;
                }
                if ((step === '-dynamic' || (typeof step === 'number' && step < 0)) && valorDepois <= min) {
                    // Se está no mínimo e tentando diminuir, mas o valor não mudou, para
                    pararRepeticao();
                    return;
                }
            }
        } else {
            // Se não encontrou o slider, ajusta normalmente
            ajustarValorBitolaComAceleracao(targetId, step);
        }
    };
    
    // Inicia o intervalo com o intervalo inicial (200ms)
    intervalId = setInterval(doAdjust, 200);
    
    // Armazena referência para poder parar
    window._bitolaRepeticao = { isActive: () => isActive, stop: () => { isActive = false; } };
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
    if (window._bitolaRepeticao) {
        window._bitolaRepeticao.stop();
        delete window._bitolaRepeticao;
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
// Funções de formatação agora estão em assets/js/site-config.js
// obterValorNumericoFormatado -> obterValorNumericoFormatado (global)
// formatarNumero -> formatarNumero (global)
// formatarPotencia -> formatarPotencia (global)

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
 *   Valores típicos: 3% para instalações residenciais (Brasil), 3-5% para outros usos
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
 *   Queda máxima: 4% (conforme NBR 5410)
 *   
 *   ΔV = (3 / 100) × 220 = 6.6 V
 *   S = (2 × 0.0175 × 30 × 10) / 6.6
 *   S = 10.5 / 6.6
 *   S = 1.59 mm²
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
    // Exemplo: 3% de 220V = 6.6V
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
    // Validação: se área mínima é inválida, retorna a menor bitola disponível
    if (!isFinite(areaMinima) || areaMinima <= 0) {
        return BITOLAS_COMERCIAIS[0];
    }
    
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
    
    // Se nenhuma bitola atender (área muito grande), retorna a maior disponível
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
 *   Resultado: 1.91% (dentro do limite de 4% estabelecido pela NBR 5410)
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
    // para facilitar a comparação com limites recomendados (ex: 3%)
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
    // Verifica se os elementos necessários existem
    if (!inputPotencia || !inputComprimento || !inputQuedaTensao) {
        return;
    }
    
    // Obtém os valores dos inputs
    // Para potência, converte valor com sufixos (k/M/m) para número
    const potencia = obterValorNumericoComSufixo(inputPotencia.value);
    
    const comprimento = obterValorNumericoFormatado(inputComprimento.value);
    const tensao = obterTensaoAtual();
    const quedaPercentual = obterValorNumericoFormatado(inputQuedaTensao.value);
    
    // Validação básica - permite qualquer valor positivo (não limita aos limites do slider)
    if (potencia <= 0 || comprimento <= 0 || tensao <= 0 || quedaPercentual <= 0) {
        if (areaMinima) areaMinima.textContent = '-';
        if (bitolaComercial) bitolaComercial.textContent = '-';
        if (correnteCircuito) correnteCircuito.textContent = '-';
        if (quedaReal) quedaReal.textContent = '-';
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
    
    // Atualiza a interface (verificando se os elementos existem)
    // Para área mínima e bitola comercial, usar formatarNumeroSemZerosDesnecessarios
    // para remover zeros desnecessários (ex: 12,00 → 12, 16,20 → 16,2)
    if (areaMinima) {
        if (isFinite(areaMin) && areaMin > 0) {
            areaMinima.textContent = formatarNumeroSemZerosDesnecessarios(areaMin, 2) + ' mm²';
        } else {
            areaMinima.textContent = '-';
        }
    }
    if (bitolaComercial) {
        if (isFinite(bitola) && bitola > 0) {
            bitolaComercial.textContent = formatarNumeroSemZerosDesnecessarios(bitola, 2) + ' mm²';
        } else {
            bitolaComercial.textContent = '-';
        }
    }
    if (correnteCircuito) correnteCircuito.textContent = formatarNumeroComSufixo(corrente, 2) + ' A';
    if (quedaReal) quedaReal.textContent = formatarNumero(quedaRealPercentual, 2) + ' %';
    if (disjuntorComercial) disjuntorComercial.textContent = formatarNumeroComSufixo(disjuntor, 0) + ' A';
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
}

/**
 * Formata número removendo zeros desnecessários
 * Se o número for inteiro, mostra sem decimais
 * Se tiver decimais significativos, mostra até 2 casas decimais
 * @param {number} valor - Valor numérico
 * @param {number} maxDecimais - Número máximo de casas decimais (padrão: 2)
 * @returns {string} Valor formatado sem zeros desnecessários
 */
function formatarNumeroSemZerosDesnecessarios(valor, maxDecimais = 2) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    
    // Se for inteiro, mostra sem decimais
    if (valor % 1 === 0) {
        return formatarNumero(valor, 0);
    }
    
    // Se tiver decimais, formata com até maxDecimais casas, removendo zeros à direita
    // Usa a mesma abordagem de formatarNumero mas com minimumFractionDigits: 0
    const locale = (typeof SiteConfig !== 'undefined' && SiteConfig.FORMATTING) 
        ? SiteConfig.FORMATTING.LOCALE_PT 
        : 'pt-BR';
    
    const valorFormatado = valor.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimais,
        useGrouping: true
    });
    
    return valorFormatado;
}

/**
 * Atualiza a exibição da tensão CC baseada no slider
 */
function atualizarTensaoCC() {
    // Quando o slider é movido, desativa o modo manual
    tensaoCCManual = false;
    const indice = parseInt(sliderTensaoCC.value) || 0;
    const tensao = TENSOES_CC_TIPICAS[indice] || 12;
    inputTensaoCC.value = formatarNumeroSemZerosDesnecessarios(tensao, 2);
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
        'dica-tensao-cc': '💡 Valores típicos: 3.3V, 5V, 9V, 12V, 15V, 20V, 24V, 36V, 48V, 60V, 72V, 96V',
        'dica-queda-tensao': '✅ Máximo permitido para projetos residenciais no Brasil: 4% (NBR 5410)',
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
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculada a bitola mínima de fios elétricos para circuitos CC e CA, considerando potência, distância, tensão e queda de tensão máxima permitida. As fórmulas e a lógica de cálculo foram validadas por testes automatizados.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Corrente do Circuito',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'A corrente é calculada dividindo a potência pela tensão. Esta é a corrente que o circuito precisa transportar.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular Área de Seção Mínima',
        'memorial-passo2-explicacao': 'A área mínima é calculada usando a fórmula S = (2 × ρ × L × I) / ΔV, onde ρ é a resistividade do cobre (0.0178 Ω·mm²/m para cobre duro conforme NBR 5410), L é a distância (multiplicada por 2 para ida e volta), I é a corrente e ΔV é a queda de tensão máxima permitida em volts (calculada como (queda% / 100) × V).',
        'memorial-constants': 'Constantes usadas:',
        'memorial-resistividade': 'ρ (resistividade do cobre) = 0.0178 Ω·mm²/m a 20°C (cobre duro, conforme NBR 5410). Para cobre recozido (mole), o valor é 0.017241 Ω·mm²/m (NBR NM 280).',
        'memorial-fator-2': 'Fator 2 = considera ida e volta do circuito (dois condutores)',
        'memorial-passo3-title': '3️⃣ Passo 3: Selecionar Bitola Comercial',
        'memorial-passo3-explicacao': 'A área mínima calculada é multiplicada por um fator de segurança de 1.25 (25% de margem) e então selecionamos a bitola comercial padrão brasileiro (NBR 5410) que atende ao requisito.',
        'memorial-bitolas': 'Bitolas comerciais disponíveis:',
        'memorial-bitolas-lista': '0.25, 0.5, 0.75, 1.0, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm²',
        'memorial-passo4-title': '4️⃣ Passo 4: Verificar Queda de Tensão Real',
        'memorial-passo4-explicacao': 'Recalculamos a queda de tensão com a bitola comercial escolhida usando a fórmula ΔV% = ((2 × ρ × L × I) / S) / V × 100, onde S é a bitola comercial selecionada. Isso verifica se a queda real está dentro do limite permitido.',
        'memorial-passo5-title': '5️⃣ Passo 5: Selecionar Disjuntor Comercial',
        'memorial-passo5-explicacao': 'O disjuntor é selecionado com base na corrente do circuito, aplicando um fator de segurança de 1.25 e escolhendo o disjuntor comercial padrão que atende ao requisito.',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-corrente': 'Corrente do Circuito:',
        'memorial-resumo-area': 'Área Mínima:',
        'memorial-resumo-bitola': 'Bitola Comercial:',
        'memorial-resumo-queda': 'Queda Real:',
        'memorial-resumo-disjuntor': 'Disjuntor:',
        'memorial-formula-corrente': 'Corrente (A) = Potência (W) ÷ Tensão (V)',
        'memorial-formula-queda': 'Queda Real (%) = ((2 × ρ × L × I) ÷ S) ÷ Tensão × 100',
        'memorial-exemplo-area-minima': 'Área mínima',
        'memorial-exemplo-bitola-comercial': 'Bitola comercial',
        'memorial-exemplo-com-bitola': 'Com bitola',
        'memorial-exemplo-queda-real': 'queda real',
        'memorial-exemplo-dentro-limite': 'dentro do limite de',
        'memorial-exemplo-corrente-texto': 'Corrente',
        'memorial-exemplo-disjuntor-comercial': 'Disjuntor comercial',
        'memorial-queda-recomendada': 'Queda de tensão recomendada:',
        'memorial-queda-recomendada-texto': '4% — Limite máximo estabelecido pela NBR 5410 para circuitos terminais em regime permanente. Este é o padrão técnico brasileiro.',
        'memorial-lei-ohm-titulo': '⚛️ Lei Física Aplicada — Lei de Ohm:',
        'memorial-lei-ohm-texto': 'A Lei de Ohm relaciona tensão (V), corrente (I) e resistência (R): V = I × R. No cálculo de bitola, usamos esta lei para determinar a queda de tensão: quanto maior a corrente e a resistência do fio, maior a queda de tensão. A resistência do fio depende da resistividade do material (cobre), do comprimento e da área da seção transversal (bitola).',
        'memorial-referencias-title': '📚 Referências Bibliográficas e Fontes Técnicas',
        'memorial-referencias-normas-title': 'Normas Técnicas:',
        'memorial-referencias-nbr-5410': '<strong>NBR 5410:2004</strong> - Instalações elétricas de baixa tensão. Associação Brasileira de Normas Técnicas (ABNT). Estabelece o limite máximo de 4% para queda de tensão em circuitos terminais e especifica a resistividade do cobre duro como 0.0178 Ω·mm²/m a 20°C.',
        'memorial-referencias-nbr-nm-280': '<strong>NBR NM 280:2003</strong> - Condutores elétricos de cobre. Especifica a resistividade do cobre recozido (mole) como 0.017241 Ω·mm²/m a 20°C.',
        'memorial-referencias-cei-64-8': '<strong>CEI 64-8</strong> - Norma italiana para instalações elétricas de baixa tensão. Estabelece limite máximo de 4% para queda de tensão e fornece fórmulas para cálculo considerando fator de potência.',
        'memorial-referencias-guias-title': 'Guias e Padrões Internacionais:',
        'memorial-referencias-ieee-525': '<strong>IEEE Std 525-2007</strong> - IEEE Guide for the Design and Installation of Cable Systems in Substations. Fornece diretrizes para cálculo de queda de tensão em condutores elétricos, incluindo fórmulas exatas e aproximadas para diferentes condições de carga.',
        'memorial-referencias-formulas-title': 'Fórmulas e Fundamentos Físicos:',
        'memorial-referencias-lei-ohm': '<strong>Lei de Ohm:</strong> V = I × R, onde V é a tensão, I é a corrente e R é a resistência.',
        'memorial-referencias-resistencia': '<strong>Resistência de condutores:</strong> R = ρ × L / S, onde ρ é a resistividade, L é o comprimento e S é a área da seção transversal.',
        'memorial-referencias-queda-monofasico': '<strong>Queda de tensão em circuitos monofásicos:</strong> ΔV = K × ρ × (L × I) / S, onde K = 2 para circuitos monofásicos (F+N).',
        'memorial-referencias-fontes-title': 'Fontes de Consulta:',
        'memorial-referencias-fontes-lista': 'Qualyflex Fios - Dados Técnicos: <a href="https://qualyflexfios.com.br/dados-tecnicos/" target="_blank" rel="noopener">qualyflexfios.com.br</a><br>Construfios - Tabelas Técnicas: <a href="https://www.construfios.com.br/area-tecnica/tabelastecnicas.pdf" target="_blank" rel="noopener">construfios.com.br</a><br>IEEE Standards Association: <a href="https://ewh.ieee.org/cmte/substations/scd0/wgd2/IEEE%20525%20-%20standard/IEEE%20525-2007_accepted.pdf" target="_blank" rel="noopener">IEEE Std 525-2007</a>',
        'tooltip-potencia-texto': 'A potência máxima nominal representa a quantidade total de energia elétrica que será consumida pelo circuito, medida em watts (W). Este valor é usado para calcular a corrente elétrica necessária. Você pode encontrar este valor nas especificações dos equipamentos que serão conectados ao circuito.',
        'tooltip-comprimento-texto': 'A distância do circuito é a distância entre a fonte de energia (disjuntor, transformador, etc.) e a carga (equipamento que consome energia). O cálculo considera automaticamente a ida e volta do circuito (dois condutores), então você deve informar apenas a distância simples entre os pontos.',
        'tooltip-tensao-cc-texto': 'A tensão é a diferença de potencial elétrico entre dois pontos do circuito, medida em volts (V). Para corrente contínua (CC), valores típicos incluem 3.3V, 5V, 9V, 12V, 15V, 20V, 24V, 36V, 48V, 60V, 72V e 96V. Este valor afeta diretamente o cálculo da corrente e da bitola necessária.',
        'tooltip-queda-tensao-texto': 'A queda de tensão máxima é o percentual de redução de tensão permitido ao longo do circuito. Valores menores garantem melhor desempenho dos equipamentos, mas exigem fios mais grossos. Para projetos residenciais no Brasil, recomenda-se 3% a 4% conforme a NBR 5410. Valores maiores podem causar problemas de funcionamento dos equipamentos.'
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
        'dica-tensao-cc': '💡 Valori tipici: 3.3V, 5V, 9V, 12V, 15V, 20V, 24V, 36V, 48V, 60V, 72V, 96V',
        'dica-queda-tensao': '✅ Massimo consentito per progetti residenziali in Brasile: 4% (NBR 5410)',
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
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolata la sezione minima dei cavi elettrici per circuiti CC e CA, considerando potenza, distanza, tensione e caduta di tensione massima consentita. Le formule e la logica di calcolo sono state validate da test automatizzati.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Corrente del Circuito',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'La corrente viene calcolata dividendo la potenza per la tensione. Questa è la corrente che il circuito deve trasportare.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare Area di Sezione Minima',
        'memorial-passo2-explicacao': 'L\'area minima viene calcolata utilizzando la formula S = (2 × ρ × L × I) / ΔV, dove ρ è la resistività del rame (0.0178 Ω·mm²/m per rame duro secondo NBR 5410), L è la distanza (moltiplicata per 2 per andata e ritorno), I è la corrente e ΔV è la caduta di tensione massima consentita in volt (calcolata come (caduta% / 100) × V).',
        'memorial-constants': 'Costanti utilizzate:',
        'memorial-resistividade': 'ρ (resistività del rame) = 0.0178 Ω·mm²/m a 20°C (rame duro, secondo NBR 5410). Per rame ricotto (morbido), il valore è 0.017241 Ω·mm²/m (NBR NM 280).',
        'memorial-fator-2': 'Fattore 2 = considera andata e ritorno del circuito (due conduttori)',
        'memorial-passo3-title': '3️⃣ Passo 3: Selezionare Sezione Commerciale',
        'memorial-passo3-explicacao': 'L\'area minima calcolata viene moltiplicata per un fattore di sicurezza di 1.25 (25% di margine) e quindi selezioniamo la sezione commerciale standard brasiliana (NBR 5410) che soddisfa il requisito.',
        'memorial-bitolas': 'Sezioni commerciali disponibili:',
        'memorial-bitolas-lista': '0.25, 0.5, 0.75, 1.0, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm²',
        'memorial-passo4-title': '4️⃣ Passo 4: Verificare Caduta di Tensione Reale',
        'memorial-passo4-explicacao': 'Ricalcoliamo la caduta di tensione con la sezione commerciale scelta utilizzando la formula ΔV% = ((2 × ρ × L × I) / S) / V × 100, dove S è la sezione commerciale selezionata. Questo verifica se la caduta reale è entro il limite consentito.',
        'memorial-passo5-title': '5️⃣ Passo 5: Selezionare Interruttore Commerciale',
        'memorial-passo5-explicacao': 'L\'interruttore viene selezionato in base alla corrente del circuito, applicando un fattore di sicurezza di 1.25 e scegliendo l\'interruttore commerciale standard che soddisfa il requisito.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-corrente': 'Corrente del Circuito:',
        'memorial-resumo-area': 'Area Minima:',
        'memorial-resumo-bitola': 'Sezione Commerciale:',
        'memorial-resumo-queda': 'Caduta Reale:',
        'memorial-resumo-disjuntor': 'Interruttore:',
        'memorial-formula-corrente': 'Corrente (A) = Potenza (W) ÷ Tensione (V)',
        'memorial-formula-queda': 'Caduta Reale (%) = ((2 × ρ × L × I) ÷ S) ÷ Tensione × 100',
        'memorial-exemplo-area-minima': 'Area minima',
        'memorial-exemplo-bitola-comercial': 'Sezione commerciale',
        'memorial-exemplo-com-bitola': 'Con sezione',
        'memorial-exemplo-queda-real': 'caduta reale',
        'memorial-exemplo-dentro-limite': 'entro il limite di',
        'memorial-exemplo-corrente-texto': 'Corrente',
        'memorial-exemplo-disjuntor-comercial': 'Interruttore commerciale',
        'memorial-queda-recomendada': 'Caduta di tensione raccomandata:',
        'memorial-queda-recomendada-texto': '4% — Limite massimo stabilito dalla NBR 5410 per circuiti terminali in regime permanente. Questo è lo standard tecnico brasiliano.',
        'memorial-lei-ohm-titulo': '⚛️ Legge Fisica Applicata — Legge di Ohm:',
        'memorial-lei-ohm-texto': 'La Legge di Ohm mette in relazione tensione (V), corrente (I) e resistenza (R): V = I × R. Nel calcolo della sezione, usiamo questa legge per determinare la caduta di tensione: maggiore è la corrente e la resistenza del filo, maggiore è la caduta di tensione. La resistenza del filo dipende dalla resistività del materiale (rame), dalla lunghezza e dall\'area della sezione trasversale (sezione).',
        'memorial-referencias-title': '📚 Riferimenti Bibliografici e Fonti Tecniche',
        'memorial-referencias-normas-title': 'Norme Tecniche:',
        'memorial-referencias-nbr-5410': '<strong>CEI 64-8 (9ª edizione, 2024)</strong> - "Impianti elettrici a tensione nominale non superiore a 1 000 V in corrente alternata e a 1 500 V in corrente continua". Comitato Elettrotecnico Italiano (CEI). Stabilisce il limite massimo del 4% per la caduta di tensione nei circuiti terminali e fornisce formule per il calcolo considerando il fattore di potenza. Norma ufficiale italiana di riferimento per le installazioni elettriche di bassa tensione.',
        'memorial-referencias-nbr-nm-280': '<strong>CEI 20-29</strong> - Conduttori elettrici di rame. Norma italiana equivalente alla IEC 60228. Specifica la resistività del rame ricotto (morbido) come 0,017241 Ω·mm²/m a 20°C (100% IACS - International Annealed Copper Standard) e del rame semi-duro come 0,017837 Ω·mm²/m a 20°C (96,66% IACS). Comitato Elettrotecnico Italiano (CEI).',
        'memorial-referencias-cei-64-8': '<strong>IEC 60228</strong> - International Electrotechnical Commission standard per conduttori elettrici. Specifica le caratteristiche dei conduttori di rame, inclusa la resistività. Adottata come riferimento internazionale e base per le norme nazionali italiane (CEI 20-29).',
        'memorial-referencias-guias-title': 'Guide e Standard Internazionali:',
        'memorial-referencias-ieee-525': '<strong>IEEE Std 525-2007</strong> - IEEE Guide for the Design and Installation of Cable Systems in Substations. Fornisce linee guida per il calcolo della caduta di tensione nei conduttori elettrici, incluse formule esatte e approssimate per diverse condizioni di carico.',
        'memorial-referencias-formulas-title': 'Formule e Fondamenti Fisici:',
        'memorial-referencias-lei-ohm': '<strong>Legge di Ohm:</strong> V = I × R, dove V è la tensione, I è la corrente e R è la resistenza.',
        'memorial-referencias-resistencia': '<strong>Resistenza dei conduttori:</strong> R = ρ × L / S, dove ρ è la resistività, L è la lunghezza e S è l\'area della sezione trasversale.',
        'memorial-referencias-queda-monofasico': '<strong>Caduta di tensione nei circuiti monofase:</strong> ΔV = K × ρ × (L × I) / S, dove K = 2 per circuiti monofase (F+N).',
        'memorial-referencias-fontes-title': 'Fonti di Consultazione:',
        'memorial-referencias-fontes-lista': 'Comitato Elettrotecnico Italiano (CEI): <a href="https://www.ceinorme.it" target="_blank" rel="noopener">ceinorme.it</a><br>Ente Nazionale Italiano di Unificazione (UNI): <a href="https://www.uni.com" target="_blank" rel="noopener">uni.com</a><br>IEEE Standards Association: <a href="https://ewh.ieee.org/cmte/substations/scd0/wgd2/IEEE%20525%20-%20standard/IEEE%20525-2007_accepted.pdf" target="_blank" rel="noopener">IEEE Std 525-2007</a>',
        'tooltip-potencia-texto': 'La potenza massima nominale rappresenta la quantità totale di energia elettrica che sarà consumata dal circuito, misurata in watt (W). Questo valore viene utilizzato per calcolare la corrente elettrica necessaria. Puoi trovare questo valore nelle specifiche degli apparecchi che saranno collegati al circuito.',
        'tooltip-comprimento-texto': 'La distanza del circuito è la distanza tra la fonte di energia (interruttore, trasformatore, ecc.) e il carico (apparecchio che consuma energia). Il calcolo considera automaticamente andata e ritorno del circuito (due conduttori), quindi devi inserire solo la distanza semplice tra i punti.',
        'tooltip-tensao-cc-texto': 'La tensione è la differenza di potenziale elettrico tra due punti del circuito, misurata in volt (V). Per corrente continua (CC), valori tipici includono 3.3V, 5V, 9V, 12V, 15V, 20V, 24V, 36V, 48V, 60V, 72V e 96V. Questo valore influisce direttamente sul calcolo della corrente e della sezione necessaria.',
        'tooltip-queda-tensao-texto': 'La caduta di tensione massima è la percentuale di riduzione di tensione consentita lungo il circuito. Valori minori garantiscono migliori prestazioni degli apparecchi, ma richiedono fili più spessi. Per impianti elettrici residenziali in Italia, la norma CEI 64-8 (9ª edizione, 2024) stabilisce il limite massimo del 4% per la caduta di tensione nei circuiti terminali. Valori maggiori possono causare problemi di funzionamento degli apparecchi e non sono conformi alle normative italiane.'
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
    const potencia = obterValorNumericoComSufixo(inputPotencia.value);
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
        exemploCorrente.textContent = `${formatarNumeroComSufixo(potencia, 0)}W ÷ ${formatarNumeroComSufixo(tensao, 0)}V = ${formatarNumeroComSufixo(corrente, 2)}A`;
    }
    
    const exemploArea = document.getElementById('memorial-exemplo-area');
    if (exemploArea) {
        const quedaVolts = (quedaPercentual / 100) * tensao;
        exemploArea.textContent = `(2 × 0.0178 × ${formatarNumeroComSufixo(comprimento, 0)}m × ${formatarNumeroComSufixo(corrente, 2)}A) ÷ ${formatarNumeroComSufixo(quedaVolts, 2)}V = ${formatarNumeroComSufixo(areaMin, 2)} mm²`;
    }
    
    const exemploBitola = document.getElementById('memorial-exemplo-bitola');
    if (exemploBitola) {
        const areaComSeguranca = areaMin * 1.25;
        const textoAreaMinima = traducoes[idiomaAtual]?.['memorial-exemplo-area-minima'] || 'Área mínima';
        const textoBitolaComercial = traducoes[idiomaAtual]?.['memorial-exemplo-bitola-comercial'] || 'Bitola comercial';
        exemploBitola.textContent = `${textoAreaMinima} ${formatarNumeroComSufixo(areaMin, 2)} mm² × 1.25 = ${formatarNumeroComSufixo(areaComSeguranca, 2)} mm² → ${textoBitolaComercial}: ${formatarNumeroComSufixo(bitola, 2)} mm²`;
    }
    
    const exemploQueda = document.getElementById('memorial-exemplo-queda');
    if (exemploQueda) {
        const textoComBitola = traducoes[idiomaAtual]?.['memorial-exemplo-com-bitola'] || 'Com bitola';
        const textoQuedaReal = traducoes[idiomaAtual]?.['memorial-exemplo-queda-real'] || 'queda real';
        const textoDentroLimite = traducoes[idiomaAtual]?.['memorial-exemplo-dentro-limite'] || 'dentro do limite de';
        exemploQueda.textContent = `${textoComBitola} ${formatarNumeroComSufixo(bitola, 2)} mm² → ${textoQuedaReal} = ${formatarNumero(quedaRealPercentual, 2)}% (${textoDentroLimite} ${formatarNumero(quedaPercentual, 2)}%)`;
    }
    
    const exemploDisjuntor = document.getElementById('memorial-exemplo-disjuntor');
    if (exemploDisjuntor) {
        const correnteComSeguranca = corrente * 1.25;
        const textoCorrente = traducoes[idiomaAtual]?.['memorial-exemplo-corrente-texto'] || 'Corrente';
        const textoDisjuntorComercial = traducoes[idiomaAtual]?.['memorial-exemplo-disjuntor-comercial'] || 'Disjuntor comercial';
        exemploDisjuntor.textContent = `${textoCorrente} ${formatarNumeroComSufixo(corrente, 2)}A × 1.25 = ${formatarNumeroComSufixo(correnteComSeguranca, 2)}A → ${textoDisjuntorComercial}: ${formatarNumeroComSufixo(disjuntor, 0)}A`;
    }
    
    // Atualiza resumo calculado
    const resumoCorrente = document.getElementById('resumo-corrente');
    if (resumoCorrente) resumoCorrente.textContent = `${formatarNumeroComSufixo(corrente, 2)} A`;
    
    const resumoArea = document.getElementById('resumo-area');
    if (resumoArea) resumoArea.textContent = `${formatarNumeroComSufixo(areaMin, 2)} mm²`;
    
    const resumoBitola = document.getElementById('resumo-bitola');
    if (resumoBitola) resumoBitola.textContent = `${formatarNumeroComSufixo(bitola, 2)} mm²`;
    
    const resumoQueda = document.getElementById('resumo-queda');
    if (resumoQueda) resumoQueda.textContent = `${formatarNumero(quedaRealPercentual, 2)}%`;
    
    const resumoDisjuntor = document.getElementById('resumo-disjuntor');
    if (resumoDisjuntor) resumoDisjuntor.textContent = `${formatarNumeroComSufixo(disjuntor, 0)} A`;
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
            // Usa innerHTML para permitir tags HTML como <br> e <a> nas traduções
            // Especialmente importante para referências bibliográficas que contêm links
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
    
    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
    
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
    
    // Event listeners para sliders com throttle reduzido para melhor responsividade
    if (sliderPotencia) {
    sliderPotencia.addEventListener('input', throttle(() => {
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
        if (inputPotencia) {
            if (valor >= 1000) {
                inputPotencia.value = formatarNumeroComSufixo(valor, 1);
            } else {
                inputPotencia.value = formatarNumeroSemZerosDesnecessarios(valor, 1);
            }
        }
        if (typeof ajustarTamanhoInput === 'function' && inputPotencia) ajustarTamanhoInput(inputPotencia);
        atualizarResultados();
    }, 50)); // Reduzido de 100ms para 50ms para melhor responsividade
    }
    
    if (sliderComprimento) {
    sliderComprimento.addEventListener('input', throttle(() => {
        if (inputComprimento) inputComprimento.value = formatarNumeroSemZerosDesnecessarios(parseFloat(sliderComprimento.value), 2);
        if (typeof ajustarTamanhoInput === 'function' && inputComprimento) ajustarTamanhoInput(inputComprimento);
        atualizarResultados();
    }, 100));
    }
    
    if (sliderTensaoCC) {
    sliderTensaoCC.addEventListener('input', throttle(atualizarTensaoCC, 100));
    }
    
    if (sliderQuedaTensao) {
    sliderQuedaTensao.addEventListener('input', throttle(() => {
        if (inputQuedaTensao) inputQuedaTensao.value = formatarNumeroSemZerosDesnecessarios(parseFloat(sliderQuedaTensao.value), 2);
        if (typeof ajustarTamanhoInput === 'function' && inputQuedaTensao) ajustarTamanhoInput(inputQuedaTensao);
        atualizarResultados();
    }, 100));
    }
    
    // Event listeners para inputs editáveis
    // Seleciona todo o texto quando o campo recebe foco
    inputPotencia.addEventListener('focus', (e) => {
        e.target.select();
    });
    
    // Função para formatar o valor de potência (usada em blur, Enter e Tab)
    function formatarValorPotencia() {
        // Converte valor com sufixos (k/M/m) ou número puro para número
        // Aceita: "7,5k", "7.5k", "7500", "10000", etc.
        const valor = obterValorNumericoComSufixo(inputPotencia.value);
        
        // Permite qualquer valor positivo (não limita aos limites do slider)
        if (valor > 0) {
            // Atualiza o slider apenas se estiver dentro dos limites
            if (valor >= parseFloat(sliderPotencia.min) && valor <= parseFloat(sliderPotencia.max)) {
                sliderPotencia.value = valor;
            }
            // Aplica a formatação com sufixos (k/M) quando >= 1000
            // Para valores < 1000, remove zeros desnecessários
            if (valor >= 1000) {
            inputPotencia.value = formatarNumeroComSufixo(valor, 1);
            } else {
                inputPotencia.value = formatarNumeroSemZerosDesnecessarios(valor, 1);
            }
        } else if (inputPotencia.value.trim() === '') {
            // Se o campo estiver vazio, mantém vazio
            inputPotencia.value = '';
        }
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPotencia);
        atualizarResultados();
    }
    
    // Durante a digitação, não formata - apenas atualiza slider e recalcula
    // Permite digitar: números puros, números com ponto/vírgula, números com sufixos k/M/m
    inputPotencia.addEventListener('input', () => {
        // Converte valor com sufixos (k/M/m) ou número puro para número
        const valor = obterValorNumericoComSufixo(inputPotencia.value);
        
        // Permite qualquer valor positivo (não limita aos limites do slider)
        if (valor > 0) {
            // Atualiza o slider apenas se estiver dentro dos limites
            if (valor >= parseFloat(sliderPotencia.min) && valor <= parseFloat(sliderPotencia.max)) {
                sliderPotencia.value = valor;
            }
            // NÃO formata durante a digitação - mantém o que o usuário digitou
            // Permite digitar: "7500", "7,5k", "7.5k", "10k", etc.
            // A formatação será aplicada em blur, Enter ou Tab
        }
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPotencia);
        atualizarResultados();
    });
    
    // Formata quando o campo perde o foco (blur)
    inputPotencia.addEventListener('blur', formatarValorPotencia);
    
    // Formata quando pressiona Enter ou Tab
    inputPotencia.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            formatarValorPotencia();
        }
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
    
    // Formata quando o campo de comprimento perde o foco (blur)
    inputComprimento.addEventListener('blur', () => {
        const valor = obterValorNumericoFormatado(inputComprimento.value);
        if (valor > 0) {
            // Formata o valor removendo zeros desnecessários
            inputComprimento.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputComprimento);
        }
    });
    
    // Formata quando pressiona Enter ou Tab no campo de comprimento
    inputComprimento.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            const valor = obterValorNumericoFormatado(inputComprimento.value);
            if (valor > 0) {
                inputComprimento.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputComprimento);
            }
        }
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
            // Formata o valor removendo zeros desnecessários
            inputTensaoCC.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
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
    
    // Formata quando o campo de tensão perde o foco (blur)
    inputTensaoCC.addEventListener('blur', () => {
        const valor = obterValorNumericoFormatado(inputTensaoCC.value);
        if (valor > 0 && valor <= 96) {
            inputTensaoCC.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputTensaoCC);
        }
    });
    
    // Formata quando pressiona Enter ou Tab no campo de tensão
    inputTensaoCC.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            const valor = obterValorNumericoFormatado(inputTensaoCC.value);
            if (valor > 0 && valor <= 96) {
                inputTensaoCC.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputTensaoCC);
            }
        }
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
    
    // Formata quando o campo de queda de tensão perde o foco (blur)
    inputQuedaTensao.addEventListener('blur', () => {
        const valor = obterValorNumericoFormatado(inputQuedaTensao.value);
        if (valor > 0) {
            // Formata o valor removendo zeros desnecessários
            inputQuedaTensao.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputQuedaTensao);
        }
    });
    
    // Formata quando pressiona Enter ou Tab no campo de queda de tensão
    inputQuedaTensao.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            const valor = obterValorNumericoFormatado(inputQuedaTensao.value);
            if (valor > 0) {
                inputQuedaTensao.value = formatarNumeroSemZerosDesnecessarios(valor, 2);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputQuedaTensao);
            }
        }
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
    const valorInicialPotencia = parseFloat(sliderPotencia.value);
    if (valorInicialPotencia >= 1000) {
        inputPotencia.value = formatarNumeroComSufixo(valorInicialPotencia, 1);
    } else {
        inputPotencia.value = formatarNumeroSemZerosDesnecessarios(valorInicialPotencia, 1);
    }
    
    // Formata o valor inicial do campo de queda de tensão removendo zeros desnecessários
    if (inputQuedaTensao) {
        const valorInicialQueda = obterValorNumericoFormatado(inputQuedaTensao.value);
        if (valorInicialQueda > 0) {
            inputQuedaTensao.value = formatarNumeroSemZerosDesnecessarios(valorInicialQueda, 2);
        }
    }
    
    // Ajustar tamanho inicial de todos os inputs
    if (typeof ajustarTamanhoInput === 'function') {
        if (inputPotencia) ajustarTamanhoInput(inputPotencia);
        if (inputComprimento) ajustarTamanhoInput(inputComprimento);
        if (inputTensaoCC) ajustarTamanhoInput(inputTensaoCC);
        if (inputQuedaTensao) ajustarTamanhoInput(inputQuedaTensao);
    }
    
    // Calcula resultados iniciais
    atualizarResultados();
    
    // Inicializar ícones de informação usando função padronizada
    if (typeof inicializarIconeInfo === 'function') {
        inicializarIconeInfo('infoIconPotencia', 'descricaoPotencia');
        inicializarIconeInfo('infoIconComprimento', 'descricaoComprimento');
        inicializarIconeInfo('infoIconTensaoCC', 'descricaoTensaoCC');
        inicializarIconeInfo('infoIconQuedaTensao', 'descricaoQuedaTensao');
    }
});

