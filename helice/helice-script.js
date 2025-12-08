// ============================================
// CALCULADORA DE PASSO DE HÉLICE PARA BARCOS
// ============================================

/**
 * Idioma atual - carrega do localStorage ou usa português como padrão
 */
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

/**
 * ============================================
 * CONSTANTES E EXPLICAÇÃO DO MÉTODO
 * ============================================
 * 
 * CONSTANTE DE CONVERSÃO (1056):
 * A constante 1056 é amplamente utilizada na indústria náutica para converter
 * velocidade em nós para polegadas por minuto, permitindo o cálculo do passo da hélice.
 * 
 * Derivação da constante:
 * - 1 nó = 1,852 km/h (definição internacional)
 * - 1 nó = 1,852 × 1000 m/h = 1,852,000 m/h
 * - 1 nó = 1,852,000 × 100 cm/h = 185,200,000 cm/h
 * - 1 nó = 185,200,000 ÷ 60 min/h = 3,086,666.67 cm/min
 * - 1 nó = 3,086,666.67 ÷ 2.54 cm/pol = 1,215,222.31 pol/min
 * 
 * A constante 1056 é uma aproximação prática e amplamente aceita na indústria,
 * que simplifica os cálculos mantendo precisão suficiente para aplicações práticas.
 * 
 * FÓRMULA PRINCIPAL:
 *  Passo (polegadas) = (Velocidade_nós × 1056 × Redução) / (RPM_motor × (1 - Slip))
 *
 * Onde:
 *  - Velocidade_nós: velocidade desejada da embarcação em nós (1 nó = 1,852 km/h)
 *  - Redução: relação de redução da rabeta (ex: 2.0 = redução 2:1)
 *    → Se redução = 2.0, o motor gira 2 vezes para a hélice girar 1 vez
 *  - RPM_motor: rotação máxima do motor em rotações por minuto
 *  - Slip: percentual de deslizamento (0.10 = 10%, 0.15 = 15%, etc.)
 *    → Representa a perda de eficiência entre a hélice e a água
 *    → Valores típicos: 10-20% para barcos de lazer
 *
 * INTERPRETAÇÃO FÍSICA:
 *  - O passo é a distância teórica (em polegadas) que a hélice avançaria
 *    em uma rotação completa, sem considerar o deslizamento
 *  - O slip reduz a eficiência: se slip = 15%, apenas 85% da eficiência teórica é alcançada
 *  - A fórmula usa (1 - Slip) no denominador para compensar essa perda
 *  - Exemplo: slip de 15% (0.15) → usa 85% (0.85) da eficiência teórica
 * 
 * FONTE:
 * Esta fórmula é baseada em métodos padrão da indústria náutica para dimensionamento
 * de hélices para embarcações de lazer e comerciais.
 */
const CONSTANTE_CONVERSAO = 1056; // Constante de conversão: nós → polegadas/minuto (padrão da indústria náutica)

// Fatores de conversão de velocidade
const CONVERSAO_VELOCIDADE = {
    knots: 1,           // Nós (unidade base)
    mph: 0.868976,      // Milhas por hora para nós
    kmh: 0.539957       // Quilômetros por hora para nós
};

// Fatores de conversão de passo
const CONVERSAO_PASSO = {
    inches: 1,          // Polegadas (unidade base)
    mm: 25.4            // Milímetros por polegada
};

/**
 * Converte uma velocidade de qualquer unidade para nós (unidade base para cálculos)
 * 
 * Nós (knots) é a unidade padrão usada em navegação marítima e é a unidade base
 * para todos os cálculos nesta calculadora. Esta função converte outras unidades
 * (mph, km/h) para nós antes de fazer os cálculos.
 * 
 * @param {number} valor - O valor da velocidade na unidade original
 * @param {string} unidade - A unidade original ('knots', 'mph' ou 'kmh')
 * @returns {number} O valor convertido para nós
 * 
 * Exemplos:
 * - converterVelocidadeParaKnots(30, 'mph') → ~26.07 nós (30 × 0.868976)
 * - converterVelocidadeParaKnots(50, 'kmh') → ~27.00 nós (50 × 0.539957)
 * - converterVelocidadeParaKnots(25, 'knots') → 25 nós (sem conversão)
 */
function converterVelocidadeParaKnots(valor, unidade) {
    // Multiplica o valor pelo fator de conversão correspondente à unidade
    // O objeto CONVERSAO_VELOCIDADE contém os fatores:
    // - 'knots': 1 (sem conversão, já está em nós)
    // - 'mph': 0.868976 (1 mph = 0.868976 nós)
    // - 'kmh': 0.539957 (1 km/h = 0.539957 nós)
    return valor * CONVERSAO_VELOCIDADE[unidade];
}

/**
 * Converte uma velocidade de nós para outra unidade (mph ou km/h)
 * 
 * Esta é a função inversa de `converterVelocidadeParaKnots`. Ela converte
 * valores calculados em nós de volta para a unidade que o usuário escolheu
 * para exibição na interface.
 * 
 * @param {number} valor - O valor da velocidade em nós
 * @param {string} unidade - A unidade de destino ('knots', 'mph' ou 'kmh')
 * @returns {number} O valor convertido para a unidade desejada
 * 
 * Exemplos:
 * - converterKnotsParaUnidade(25, 'mph') → ~28.78 mph (25 ÷ 0.868976)
 * - converterKnotsParaUnidade(25, 'kmh') → ~46.30 km/h (25 ÷ 0.539957)
 * - converterKnotsParaUnidade(25, 'knots') → 25 nós (sem conversão)
 */
function converterKnotsParaUnidade(valor, unidade) {
    // Divide o valor pelo fator de conversão para obter a unidade desejada
    // Como os fatores são menores que 1, dividir por eles aumenta o valor
    // Exemplo: 25 nós ÷ 0.868976 = ~28.78 mph
    return valor / CONVERSAO_VELOCIDADE[unidade];
}

/**
 * Formata número com vírgula como separador decimal e ponto como separador de milhares
 * Sempre usa formatação brasileira (pt-BR) independente do idioma da interface
 * @param {number} valor - Valor numérico a formatar
 * @param {number} casasDecimais - Número de casas decimais (padrão: 0)
 * @returns {string} Valor formatado (ex: "1.234,56" ou "12,5")
 */
// Funções de formatação agora estão em assets/js/site-config.js
// formatarNumero -> formatarNumero (global)
// converterValorFormatadoParaNumero -> converterValorFormatadoParaNumero (global)

/**
 * Converte o passo da hélice de polegadas para outra unidade (milímetros)
 * 
 * O passo é calculado internamente em polegadas (unidade padrão na indústria náutica),
 * mas o usuário pode escolher ver o resultado em milímetros. Esta função faz essa conversão.
 * 
 * @param {number} valor - O valor do passo em polegadas
 * @param {string} unidade - A unidade de destino ('inches' ou 'mm')
 * @returns {number} O valor do passo na unidade desejada
 * 
 * Exemplos:
 * - converterPassoParaUnidade(12.5, 'inches') → 12.5 polegadas (sem conversão)
 * - converterPassoParaUnidade(12.5, 'mm') → 317.5 mm (12.5 × 25.4)
 */
function converterPassoParaUnidade(valor, unidade) {
    // Se a unidade já é polegadas, retorna o valor sem conversão
    if (unidade === 'inches') return valor;
    
    // Converte polegadas para milímetros multiplicando por 25.4
    // 1 polegada = 25.4 milímetros (conversão padrão do sistema métrico)
    return valor * CONVERSAO_PASSO.mm; // Converte para mm
}

/**
 * Variáveis globais para gráfico
 */
let graficoHelice = null;

/**
 * Dicionário de traduções PT-BR ↔ IT-IT
 */
const traducoes = {
    'pt-BR': {
        'app-title': '🚤 Calculadora de Passo de Hélice',
        'app-subtitle': 'Para barcos de lazer',
        'label-unidade-velocidade': 'Unidade de Velocidade',
        'label-velocidade': 'Velocidade Desejada',
        'label-reducao': 'Redução da Rabeta',
        'label-rpm': 'RPM Máximo do Motor',
        'label-slip': 'Slip Estimado',
        'unidade-mph': 'mph',
        'unidade-kmh': 'km/h',
        'unidade-mm': 'mm',
        'info-slip': 'Valor típico para barcos de lazer: 10-20%. Representa a perda de eficiência da hélice.',
        'resultado-titulo': 'Resultados',
        'unidade-polegadas': 'polegadas',
        'unidade-polegadas-compacto': 'pol',
        'unidade-nos': 'nós',
        'rpm-helice': 'RPM na Hélice:',
        'velocidade-teorica': 'Velocidade Teórica:',
        'grafico-titulo': '📊 Relação Passo × Velocidade',
        'info-titulo': 'ℹ️ Como Funciona',
        'info-passo-titulo': 'O que é Passo?',
        'info-passo-texto': 'O passo é a distância teórica (em polegadas) que a hélice avançaria em uma rotação completa, sem considerar o deslizamento (slip).',
        'info-reducao-titulo': 'Redução da Rabeta',
        'info-reducao-texto': 'Relação entre a rotação do motor e a rotação da hélice. Ex: 2:1 significa que o motor gira 2 vezes para a hélice girar 1 vez.',
        'info-slip-titulo': 'O que é Slip?',
        'info-slip-texto': 'Deslizamento entre a hélice e a água. Barcos de lazer típicos têm 10-20% de slip. Quanto menor o slip, mais eficiente a hélice.',
        'formula-titulo': '📐 Fórmula Utilizada',
        'formula-explicacao': 'Onde 1056 é a constante de conversão de nós para polegadas/minuto',
        'footer': 'Calculadora de Hélice - Engenharia Nata @ 2025',
        'grafico-label': 'Passo (polegadas)',
        'grafico-eixo-x': 'Velocidade (nós)',
        'grafico-eixo-y': 'Passo Recomendado (pol)',
        'aria-home': 'Voltar para a tela inicial',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'memorial-title': '📚 Memorial de Cálculo - Passo de Hélice',
        'memorial-intro-title': '🎯 Objetivo do Cálculo',
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculado o passo ideal da hélice para barcos de lazer, considerando velocidade desejada, RPM do motor, redução da rabeta e slip.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular RPM Efetivo na Hélice',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'A rabeta reduz a rotação do motor. Se a redução é 2:1, a hélice gira 2 vezes mais devagar que o motor.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular Passo da Hélice',
        'memorial-passo2-explicacao': 'O passo é a distância teórica que a hélice avançaria em uma rotação completa. O slip reduz a eficiência, então usamos (1 - Slip) para compensar.',
        'memorial-constants': 'Constantes usadas:',
        'memorial-constante-1056': '1056 = constante de conversão de nós para polegadas/minuto',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcular Velocidade Teórica',
        'memorial-passo3-explicacao': 'A velocidade teórica mostra qual velocidade seria obtida se não houvesse slip. É útil para comparar com a velocidade desejada.',
        'memorial-conceitos-title': '📖 Conceitos Importantes',
        'memorial-slip-title': 'Slip (Deslizamento):',
        'memorial-slip-text': 'O slip é a perda de eficiência entre a hélice e a água. Barcos de lazer típicos têm 10-20% de slip. Quanto menor o slip, mais eficiente a hélice.',
        'memorial-reducao-title': 'Redução da Rabeta:',
        'memorial-reducao-text': 'Relação entre a rotação do motor e a rotação da hélice. Ex: 2:1 significa que o motor gira 2 vezes para a hélice girar 1 vez. Isso aumenta o torque disponível na hélice.',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-rpm': 'RPM na Hélice:',
        'memorial-resumo-passo': 'Passo Recomendado:',
        'memorial-resumo-velocidade': 'Velocidade Teórica:'
    },
    'it-IT': {
        'app-title': '🚤 Calcolatore Passo Elica',
        'app-subtitle': 'Per barche da diporto',
        'label-unidade-velocidade': 'Unità di Velocità',
        'label-velocidade': 'Velocità Desiderata',
        'label-reducao': 'Riduzione Piede Poppiero',
        'label-rpm': 'RPM Massimo Motore',
        'label-slip': 'Slip Stimato',
        'unidade-mph': 'mph',
        'unidade-kmh': 'km/h',
        'unidade-mm': 'mm',
        'info-slip': 'Valore tipico per barche da diporto: 10-20%. Rappresenta la perdita di efficienza dell\'elica.',
        'resultado-titulo': 'Risultati',
        'unidade-polegadas': 'pollici',
        'unidade-polegadas-compacto': 'pol',
        'unidade-nos': 'nodi',
        'rpm-helice': 'RPM Elica:',
        'velocidade-teorica': 'Velocità Teorica:',
        'grafico-titulo': '📊 Relazione Passo × Velocità',
        'info-titulo': 'ℹ️ Come Funziona',
        'info-passo-titulo': "Cos'è il Passo?",
        'info-passo-texto': "Il passo è la distanza teorica (in pollici) che l'elica avanzerebbe in una rotazione completa, senza considerare lo scivolamento (slip).",
        'info-reducao-titulo': 'Riduzione Piede Poppiero',
        'info-reducao-texto': "Rapporto tra la rotazione del motore e la rotazione dell'elica. Es: 2:1 significa che il motore gira 2 volte per 1 giro dell'elica.",
        'info-slip-titulo': "Cos'è lo Slip?",
        'info-slip-texto': "Scivolamento tra l'elica e l'acqua. Barche da diporto tipiche hanno 10-20% di slip. Minore è lo slip, più efficiente è l'elica.",
        'formula-titulo': '📐 Formula Utilizzata',
        'formula-explicacao': 'Dove 1056 è la costante di conversione da nodi a pollici/minuto',
        'footer': 'Calcolatore Elica - Engenharia Nata @ 2025',
        'grafico-label': 'Passo (pollici)',
        'grafico-eixo-x': 'Velocità (nodi)',
        'grafico-eixo-y': 'Passo Consigliato (pol)',
        'aria-home': 'Torna alla schermata iniziale',
        'learn-more': 'SCOPRI DI PIÙ!',
        'back': '← Indietro',
        'btn-memorial': 'Vedi Memoriale di Calcolo',
        'memorial-title': '📚 Memoriale di Calcolo - Passo Elica',
        'memorial-intro-title': '🎯 Obiettivo del Calcolo',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolato il passo ideale dell\'elica per barche da diporto, considerando velocità desiderata, RPM del motore, riduzione del piede poppiero e slip.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare RPM Effettivo nell\'Elica',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'Il piede poppiero riduce la rotazione del motore. Se la riduzione è 2:1, l\'elica gira 2 volte più lenta del motore.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare Passo dell\'Elica',
        'memorial-passo2-explicacao': 'Il passo è la distanza teorica che l\'elica avanzerebbe in una rotazione completa. Lo slip riduce l\'efficienza, quindi usiamo (1 - Slip) per compensare.',
        'memorial-constants': 'Costanti utilizzate:',
        'memorial-constante-1056': '1056 = costante di conversione da nodi a pollici/minuto',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcolare Velocità Teorica',
        'memorial-passo3-explicacao': 'La velocità teorica mostra quale velocità sarebbe ottenuta se non ci fosse slip. È utile per confrontare con la velocità desiderata.',
        'memorial-conceitos-title': '📖 Concetti Importanti',
        'memorial-slip-title': 'Slip (Scivolamento):',
        'memorial-slip-text': 'Lo slip è la perdita di efficienza tra l\'elica e l\'acqua. Barche da diporto tipiche hanno 10-20% di slip. Minore è lo slip, più efficiente è l\'elica.',
        'memorial-reducao-title': 'Riduzione Piede Poppiero:',
        'memorial-reducao-text': 'Rapporto tra la rotazione del motore e la rotazione dell\'elica. Es: 2:1 significa che il motore gira 2 volte per 1 giro dell\'elica. Questo aumenta la coppia disponibile nell\'elica.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-rpm': 'RPM nell\'Elica:',
        'memorial-resumo-passo': 'Passo Consigliato:',
        'memorial-resumo-velocidade': 'Velocità Teorica:'
    }
};

/**
 * Troca o idioma da interface do usuário
 * 
 * Esta função atualiza todos os textos da página para o idioma selecionado,
 * salva a preferência do usuário e atualiza elementos visuais relacionados.
 * 
 * @param {string} novoIdioma - Código do idioma ('pt-BR' para português ou 'it-IT' para italiano)
 */
function trocarIdioma(novoIdioma) {
    // PASSO 1: Atualiza a variável global que armazena o idioma atual
    idiomaAtual = novoIdioma;
    
    // PASSO 2: Salva a preferência de idioma no localStorage do navegador
    // Isso garante que o idioma seja mantido quando o usuário navegar entre páginas
    // ou revisitar o site. Usa a chave padronizada do SiteConfig.
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // PASSO 3: Atualiza o atributo 'lang' da tag <html>
    // Isso é uma boa prática de acessibilidade e SEO, informando ao navegador
    // e leitores de tela qual o idioma principal do conteúdo da página.
    document.documentElement.lang = novoIdioma;
    
    // PASSO 4: Atualiza todos os elementos na página que possuem o atributo `data-i18n`
    // `querySelectorAll('[data-i18n]')` busca todos os elementos que precisam ser traduzidos.
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        // Pega a "chave" de tradução do atributo `data-i18n` (ex: "app-title", "label-velocidade")
        const chave = elemento.getAttribute('data-i18n');
        
        // Verifica se existe uma tradução para a chave no idioma selecionado
        // Se existir, substitui o texto interno do elemento pela tradução
        if (traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // PASSO 5: Atualiza o estilo dos botões de idioma para destacar o idioma ativo
    // Remove a classe 'active' de todos os botões e adiciona-a apenas ao botão do idioma atual
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');   // Adiciona 'active' se for o idioma selecionado
        } else {
            btn.classList.remove('active'); // Remove 'active' dos outros
        }
    });
    
    // PASSO 6: Atualiza o gráfico com os labels traduzidos
    // Isso garante que os títulos dos eixos e legendas do gráfico também sejam traduzidos
    atualizarGrafico();

    // PASSO 7: Atualiza os atributos `aria-label` para botões de navegação (ex: botão "Home")
    // Isso melhora a acessibilidade para usuários de leitores de tela
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home'; // Pega a tradução ou usa 'Home' como fallback
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Ajusta o valor de um slider usando botões de seta (↑ ↓)
 * 
 * Esta função é chamada quando o usuário clica nos botões de seta ao lado dos sliders.
 * Ela incrementa ou decrementa o valor do slider respeitando os limites mínimo/máximo
 * e o passo (step) definido no slider.
 * 
 * @param {string} targetId - ID do elemento slider a ser ajustado (ex: 'sliderVelocidade')
 * @param {number} step - Valor do incremento/decremento (positivo para aumentar, negativo para diminuir)
 */
function ajustarValor(targetId, step) {
    // PASSO 1: Obtém a referência do elemento slider no DOM
    const slider = document.getElementById(targetId);
    
    // Se o slider não existir, interrompe a execução (proteção contra erros)
    if (!slider) return;
    
    // PASSO 2: Obtém os valores atuais e limites do slider
    const valorAtual = parseFloat(slider.value) || 0;  // Valor atual do slider (ou 0 se inválido)
    const min = parseFloat(slider.min) || 0;           // Valor mínimo permitido (ou 0 se não definido)
    const max = parseFloat(slider.max) || 100;         // Valor máximo permitido (ou 100 se não definido)
    const stepAttr = parseFloat(slider.step) || 1;     // Passo do slider (ou 1 se não definido)
    
    // PASSO 3: Calcula o novo valor somando o step ao valor atual
    let novoValor = valorAtual + step;
    
    // PASSO 4: Arredonda o novo valor para o múltiplo mais próximo do step do slider
    // Isso garante que o valor sempre fique alinhado com os passos definidos
    // Exemplo: se stepAttr = 0.1 e novoValor = 12.37, arredonda para 12.4
    novoValor = Math.round(novoValor / stepAttr) * stepAttr;
    
    // PASSO 5: Garante que o novo valor esteja dentro dos limites (min e max)
    // Math.max(min, ...) garante que não seja menor que o mínimo
    // Math.min(max, ...) garante que não seja maior que o máximo
    novoValor = Math.max(min, Math.min(max, novoValor));
    
    // PASSO 6: Atualiza o valor do slider no DOM
    slider.value = novoValor;
    
    // PASSO 7: Dispara o evento 'input' para que os listeners sejam notificados
    // Isso faz com que a função `atualizarResultado()` seja chamada automaticamente
    // para recalcular e atualizar a interface com o novo valor
    slider.dispatchEvent(new Event('input'));
}

// Controle para os botões de seta
let intervalId = null;
let timeoutId = null;

/**
 * ============================================
 * FUNÇÃO PRINCIPAL: CALCULAR PASSO DA HÉLICE
 * ============================================
 * 
 * Calcula o passo ideal da hélice para uma embarcação baseado em:
 * - Velocidade desejada
 * - RPM do motor
 * - Redução da rabeta
 * - Slip estimado
 * 
 * @param {number} velocidade - Velocidade desejada em nós (já convertida)
 * @param {number} reducao - Relação de redução da rabeta (ex: 2.0 = 2:1)
 * @param {number} rpmMotor - Rotação máxima do motor em RPM
 * @param {number} slip - Percentual de slip como decimal (ex: 0.15 = 15%)
 * @returns {Object} Objeto contendo:
 *   - passo: Passo recomendado em polegadas (1 casa decimal)
 *   - rpmHelice: RPM efetivo na hélice (inteiro)
 *   - velocidadeTeorica: Velocidade teórica sem slip em nós (1 casa decimal)
 * 
 * EXEMPLO DE USO:
 *   const resultado = calcularPasso(25, 2.0, 5000, 0.15);
 *   // resultado = { passo: 12.4, rpmHelice: 2500, velocidadeTeorica: 29.4 }
 */
function calcularPasso(velocidade, reducao, rpmMotor, slip) {
    // ============================================
    // PASSO 1: CALCULAR RPM EFETIVO NA HÉLICE
    // ============================================
    // A rabeta (lower unit) reduz a rotação do motor antes de chegar à hélice.
    // Se a redução é 2:1, significa que o motor gira 2 vezes para a hélice girar 1 vez.
    // Isso aumenta o torque disponível na hélice, permitindo hélices maiores e mais eficientes.
    // 
    // Fórmula: RPM_hélice = RPM_motor / Redução
    // 
    // Exemplo prático:
    // - Motor: 5000 RPM
    // - Redução: 2.0 (2:1)
    // - RPM na hélice: 5000 / 2.0 = 2500 RPM
    const rpmHelice = rpmMotor / reducao;
    
    // ============================================
    // PASSO 2: CALCULAR PASSO RECOMENDADO
    // ============================================
    // Fórmula principal: Passo = (Velocidade × 1056 × Redução) / (RPM × (1 - Slip))
    //
    // Explicação detalhada de cada termo:
    // 
    // 1. Velocidade × 1056:
    //    - Converte velocidade em nós para polegadas por minuto
    //    - 1056 é a constante padrão da indústria náutica
    //    - Exemplo: 25 nós × 1056 = 26,400 pol/min
    //
    // 2. × Redução:
    //    - Ajusta pela redução da rabeta
    //    - A redução afeta tanto o RPM quanto a relação de transmissão
    //    - Exemplo: 26,400 × 2.0 = 52,800
    //
    // 3. ÷ (RPM × (1 - Slip)):
    //    - Divide pelo RPM do motor (não da hélice, pois a redução já foi considerada)
    //    - (1 - Slip) compensa a perda de eficiência devido ao deslizamento
    //    - Se slip = 15% (0.15), então (1 - 0.15) = 0.85 = 85% de eficiência
    //    - Exemplo: 5000 × 0.85 = 4,250
    //
    // Cálculo completo do exemplo:
    // Passo = (25 × 1056 × 2.0) / (5000 × (1 - 0.15))
    //       = 52,800 / 4,250
    //       = 12.423... polegadas
    //       ≈ 12.4 polegadas (arredondado)
    const passo = (velocidade * CONSTANTE_CONVERSAO * reducao) / (rpmMotor * (1 - slip));
    
    // ============================================
    // PASSO 3: CALCULAR VELOCIDADE TEÓRICA
    // ============================================
    // A velocidade teórica mostra qual velocidade seria obtida se não houvesse slip.
    // É calculada usando a fórmula inversa, assumindo slip = 0.
    // 
    // Fórmula inversa: Velocidade = (Passo × RPM) / (1056 × Redução)
    // 
    // Esta velocidade é útil para:
    // - Comparar com a velocidade desejada
    // - Verificar se o passo calculado é razoável
    // - Entender a eficiência do sistema (diferença entre teórica e real)
    //
    // Exemplo:
    // Velocidade Teórica = (12.4 × 5000) / (1056 × 2.0)
    //                    = 62,000 / 2,112
    //                    = 29.36 nós
    //                    ≈ 29.4 nós (arredondado)
    const velocidadeTeorica = (passo * rpmMotor) / (CONSTANTE_CONVERSAO * reducao);
    
    // ============================================
    // RETORNAR RESULTADOS
    // ============================================
    return {
        // Passo arredondado para 1 casa decimal
        // Precisão de 0.1 polegadas é suficiente para seleção de hélices comerciais
        // Exemplo: 12.423 → 12.4 polegadas
        passo: Math.round(passo * 10) / 10,
        
        // RPM da hélice arredondado para número inteiro
        // RPM é sempre um valor inteiro na prática
        // Exemplo: 2500.3 → 2500 RPM
        rpmHelice: Math.round(rpmHelice),
        
        // Velocidade teórica arredondada para 1 casa decimal
        // Precisão de 0.1 nós é suficiente para comparações práticas
        // Exemplo: 29.36 → 29.4 nós
        velocidadeTeorica: Math.round(velocidadeTeorica * 10) / 10
    };
}

/**
 * Atualiza os limites mínimo e máximo do slider de velocidade baseado na unidade selecionada
 * 
 * Quando o usuário muda a unidade de velocidade (nós, mph, km/h), os limites do slider
 * precisam ser ajustados para refletir valores equivalentes na nova unidade. Esta função
 * também converte o valor atual do slider para a nova unidade, mantendo a velocidade
 * equivalente.
 * 
 * @param {string} unidadeAnterior - Unidade anterior (para conversão correta do valor atual)
 *                                    Se for null, assume que o valor já está na unidade atual
 */
function atualizarLimitesVelocidade(unidadeAnterior = null) {
    // PASSO 1: Obtém a unidade de velocidade selecionada pelo usuário
    // Busca o radio button marcado com name="unidadeVelocidade" e pega seu valor
    const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
    
    // PASSO 2: Obtém referências ao slider e input, e pega o valor atual
    const slider = document.getElementById('sliderVelocidade');
    const inputVelocidadeEl = document.getElementById('inputVelocidade');
    
    // Prioriza o valor do input (o que o usuário vê), senão usa o slider
    let valorAtual;
    if (inputVelocidadeEl && inputVelocidadeEl.value) {
        const valorInput = converterValorFormatadoParaNumero(inputVelocidadeEl.value);
        if (!isNaN(valorInput) && valorInput > 0) {
            valorAtual = valorInput; // Usa o valor do input (na unidade anterior)
        } else {
            valorAtual = parseFloat(slider.value); // Fallback para o slider
        }
    } else {
        valorAtual = parseFloat(slider.value); // Fallback para o slider
    }
    
    // PASSO 3: Converte o valor atual para nós (unidade base) para manter a equivalência
    // Se houver uma unidade anterior, converte dela. Caso contrário, assume que já está na unidade atual.
    let valorEmKnots;
    if (unidadeAnterior) {
        // Converte da unidade anterior para nós
        valorEmKnots = converterVelocidadeParaKnots(valorAtual, unidadeAnterior);
    } else {
        // Assume que o valor já está na unidade atual
        valorEmKnots = converterVelocidadeParaKnots(valorAtual, unidadeVelocidade);
    }
    
    // PASSO 4: Define os limites mínimo e máximo do slider baseado na nova unidade
    // Os limites são equivalentes a 5-60 nós, mas ajustados para cada unidade:
    let min, max;
    if (unidadeVelocidade === 'knots') {
        // Nós: limites diretos (5-60 nós)
        min = 5;
        max = 60;
    } else if (unidadeVelocidade === 'mph') {
        // Milhas por hora: limites equivalentes a 5-60 nós
        // 5 nós ≈ 5.8 mph, 60 nós ≈ 60.5 mph
        min = 6;  // ~5.8 nós (arredondado para cima)
        max = 70; // ~60.5 nós (arredondado para cima)
    } else { // kmh
        // Quilômetros por hora: limites equivalentes a 5-60 nós
        // 5 nós ≈ 9.3 km/h, 60 nós ≈ 111.1 km/h
        min = 9;  // ~5.4 nós (arredondado para cima)
        max = 112; // ~60.5 nós (arredondado para cima)
    }
    
    // PASSO 5: Atualiza os atributos min e max do slider no DOM
    slider.min = min;
    slider.max = max;
    
    // PASSO 6: Atualiza os labels de range (valores mínimo e máximo exibidos) se existirem
    // Esses labels mostram ao usuário os limites do slider
    const rangeMin = document.getElementById('rangeMinVelocidade');
    const rangeMax = document.getElementById('rangeMaxVelocidade');
    if (rangeMin) rangeMin.textContent = min; // Atualiza o label do mínimo
    if (rangeMax) rangeMax.textContent = max; // Atualiza o label do máximo
    
    // PASSO 7: Converte o valor em nós de volta para a nova unidade e atualiza o slider
    // Isso mantém a velocidade equivalente quando o usuário muda a unidade
    const novoValor = converterKnotsParaUnidade(valorEmKnots, unidadeVelocidade);
    
    // Formata o valor: nós sem decimais, outras unidades com 1 decimal
        const valorFormatado = formatarNumero(novoValor, unidadeVelocidade === 'knots' ? 0 : 1);
    // O slider usa o valor numérico original (sem formatação)
    // A formatação é apenas para exibição no input
    
    // Atualiza o valor do slider (usa o valor numérico original)
    slider.value = novoValor;
    
    // PASSO 8: Atualiza o display do valor (input ao lado do slider)
    if (inputVelocidadeEl) {
        inputVelocidadeEl.value = valorFormatado;
    }
}

/**
 * Atualiza a interface com os resultados calculados
 * 
 * Esta é a função principal que orquestra a atualização da interface. Ela:
 * 1. Coleta os valores dos sliders
 * 2. Converte unidades quando necessário
 * 3. Calcula o passo da hélice
 * 4. Atualiza todos os elementos de exibição na tela
 * 5. Atualiza o gráfico
 * 
 * Esta função é chamada sempre que o usuário altera qualquer parâmetro (velocidade,
 * redução, RPM, slip) ou muda as unidades de medida.
 */
function atualizarResultado() {
    // ============================================
    // PASSO 1: OBTER UNIDADES SELECIONADAS
    // ============================================
    // Obtém as unidades de velocidade e passo selecionadas pelo usuário
    const unidadeVelocidadeRadio = document.querySelector('input[name="unidadeVelocidade"]:checked');
    const unidadePassoRadio = document.querySelector('input[name="unidadePasso"]:checked');
    
    // Verifica se os elementos existem antes de acessar .value
    if (!unidadeVelocidadeRadio || !unidadePassoRadio) {
        console.error('Erro: Unidades não encontradas');
        return;
    }
    
    const unidadeVelocidade = unidadeVelocidadeRadio.value;
    const unidadePasso = unidadePassoRadio.value;
    
    // ============================================
    // PASSO 2: OBTER VALORES DOS INPUTS OU SLIDERS
    // ============================================
    // Lê os valores dos inputs editáveis (se existirem e tiverem valores válidos) ou dos sliders
    // Isso permite valores fora dos limites do slider quando digitados manualmente
    const inputVelocidade = document.getElementById('inputVelocidade');
    const inputReducao = document.getElementById('inputReducao');
    const inputRPM = document.getElementById('inputRPM');
    const inputSlip = document.getElementById('inputSlip');
    const sliderVelocidade = document.getElementById('sliderVelocidade');
    const sliderReducao = document.getElementById('sliderReducao');
    const sliderRPM = document.getElementById('sliderRPM');
    const sliderSlip = document.getElementById('sliderSlip');
    
    // Obtém valores dos inputs ou sliders (inputs têm prioridade se existirem e tiverem valores válidos)
    // Se o input tiver um valor válido (número > 0), usa ele; caso contrário, usa o slider
    let velocidadeInput = parseFloat(sliderVelocidade.value);
    if (inputVelocidade && inputVelocidade.value) {
        const valorInput = converterValorFormatadoParaNumero(inputVelocidade.value);
        if (!isNaN(valorInput) && valorInput > 0) {
            velocidadeInput = valorInput;
        }
    }
    
    let reducao = parseFloat(sliderReducao.value);
    if (inputReducao && inputReducao.value) {
        const valorInput = converterValorFormatadoParaNumero(inputReducao.value);
        if (!isNaN(valorInput) && valorInput > 0) {
            reducao = valorInput;
        }
    }
    
    let rpmMotor = parseFloat(sliderRPM.value);
    if (inputRPM && inputRPM.value) {
        const valorInput = converterValorFormatadoParaNumero(inputRPM.value);
        if (!isNaN(valorInput) && valorInput > 0) {
            rpmMotor = valorInput;
        }
    }
    
    let slipPercent = parseFloat(sliderSlip.value);
    if (inputSlip && inputSlip.value) {
        const valorInput = converterValorFormatadoParaNumero(inputSlip.value);
        if (!isNaN(valorInput) && valorInput > 0) {
            slipPercent = valorInput;
        }
    }
    
    // ============================================
    // PASSO 3: CONVERTER VELOCIDADE PARA NÓS
    // ============================================
    // Converte a velocidade para nós (unidade base para cálculos)
    // velocidadeInput já está na unidade selecionada (do slider ou input)
    const velocidadeKnots = converterVelocidadeParaKnots(velocidadeInput, unidadeVelocidade);
    
    // ============================================
    // PASSO 4: ATUALIZAR DISPLAYS DOS VALORES DE ENTRADA
    // ============================================
    // Atualiza os inputs ao lado dos sliders para mostrar os valores atuais
    // Formata velocidade: nós sem decimais, outras unidades com 1 decimal
    if (inputVelocidade) {
        inputVelocidade.value = formatarNumero(velocidadeInput, unidadeVelocidade === 'knots' ? 0 : 1);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputVelocidade);
    }
    if (inputReducao) {
        inputReducao.value = formatarNumero(reducao, 2);     // Redução com 2 decimais (ex: 2,32)
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputReducao);
    }
    if (inputRPM) {
        inputRPM.value = formatarNumero(Math.round(rpmMotor), 0);           // RPM como número inteiro
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputRPM);
    }
    if (inputSlip) {
        inputSlip.value = formatarNumero(Math.round(slipPercent), 0);      // Slip como número inteiro (percentual)
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputSlip);
    }
    
    // ============================================
    // PASSO 5: CALCULAR O PASSO DA HÉLICE
    // ============================================
    // Chama a função principal de cálculo, convertendo slip de percentual para decimal
    // Exemplo: slipPercent = 15 → slip = 0.15 (15%)
    const resultado = calcularPasso(velocidadeKnots, reducao, rpmMotor, slipPercent / 100);
    
    // ============================================
    // PASSO 6: CONVERTER E EXIBIR RESULTADOS
    // ============================================
    // Converte o passo para a unidade selecionada (polegadas ou milímetros)
    const passoConvertido = converterPassoParaUnidade(resultado.passo, unidadePasso);
    // Formata: milímetros sem decimais, polegadas com 1 decimal
    document.getElementById('resultadoPasso').textContent = formatarNumero(passoConvertido, unidadePasso === 'mm' ? 0 : 1);
    
    // Exibe o RPM efetivo na hélice (já é um número inteiro)
    document.getElementById('rpmHelice').textContent = formatarNumero(resultado.rpmHelice, 0);
    
    // Converte a velocidade teórica de nós para a unidade selecionada
    const velocidadeTeoricaConvertida = converterKnotsParaUnidade(resultado.velocidadeTeorica, unidadeVelocidade);
    // Exibe com 1 casa decimal
    document.getElementById('velocidadeTeorica').textContent = formatarNumero(velocidadeTeoricaConvertida, 1);
    
    // ============================================
    // PASSO 7: ATUALIZAR UNIDADE DE VELOCIDADE NO DISPLAY
    // ============================================
    // Obtém o texto da unidade de velocidade traduzido (nós, mph, km/h)
    const unidadeVelocidadeText = {
        'knots': traducoes[idiomaAtual]['unidade-nos'],  // "nós" em português, "nodi" em italiano
        'mph': traducoes[idiomaAtual]['unidade-mph'],    // "mph" (igual em ambos)
        'kmh': traducoes[idiomaAtual]['unidade-kmh']     // "km/h" (igual em ambos)
    }[unidadeVelocidade];
    // Atualiza o texto da unidade ao lado da velocidade teórica
    document.getElementById('unidadeVelocidadeTeorica').textContent = unidadeVelocidadeText;
    
    // ============================================
    // PASSO 8: ATUALIZAR O GRÁFICO
    // ============================================
    // Atualiza o gráfico de relação Passo × Velocidade com os novos dados
    atualizarGrafico();
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
}

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
        // Rolar para o topo da página
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}

/**
 * Atualiza o memorial de cálculo com os valores atuais dos cálculos
 */
function atualizarMemorialComValores() {
    // Obter valores atuais
    const reducao = parseFloat(document.getElementById('sliderReducao').value);
    const rpmMotor = parseFloat(document.getElementById('sliderRPM').value);
    const slipPercent = parseFloat(document.getElementById('sliderSlip').value);
    const inputVelocidade = document.getElementById('inputVelocidade');
    const sliderVelocidade = document.getElementById('sliderVelocidade');
    const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked')?.value || 'knots';
    
    let velocidadeInput = parseFloat(sliderVelocidade.value);
    if (inputVelocidade && inputVelocidade.value) {
        const valorInput = converterValorFormatadoParaNumero(inputVelocidade.value);
        if (!isNaN(valorInput) && valorInput > 0) {
            velocidadeInput = valorInput;
        }
    }
    
    const velocidadeKnots = converterVelocidadeParaKnots(velocidadeInput, unidadeVelocidade);
    const resultado = calcularPasso(velocidadeKnots, reducao, rpmMotor, slipPercent / 100);
    
    // Atualizar exemplos
    const rpmHelice = resultado.rpmHelice;
    const passo = resultado.passo;
    const velocidadeTeorica = resultado.velocidadeTeorica;
    
    document.getElementById('memorial-exemplo-rpm').textContent = 
        `Motor ${formatarNumero(rpmMotor, 0)} RPM, redução ${formatarNumero(reducao, 2)}:1 → ${formatarNumero(rpmMotor, 0)} ÷ ${formatarNumero(reducao, 2)} = ${formatarNumero(rpmHelice, 0)} RPM na hélice`;
    
    document.getElementById('memorial-exemplo-passo').textContent = 
        `${formatarNumero(velocidadeKnots, 0)} nós, redução ${formatarNumero(reducao, 2)}:1, ${formatarNumero(rpmMotor, 0)} RPM, slip ${formatarNumero(slipPercent, 0)}% → (${formatarNumero(velocidadeKnots, 0)} × 1056 × ${formatarNumero(reducao, 2)}) ÷ (${formatarNumero(rpmMotor, 0)} × ${formatarNumero(1 - slipPercent/100, 2)}) = ${formatarNumero(passo, 1)} polegadas`;
    
    document.getElementById('memorial-exemplo-velocidade').textContent = 
        `Passo ${formatarNumero(passo, 1)}", ${formatarNumero(rpmMotor, 0)} RPM, redução ${formatarNumero(reducao, 2)}:1 → (${formatarNumero(passo, 1)} × ${formatarNumero(rpmMotor, 0)}) ÷ (1056 × ${formatarNumero(reducao, 2)}) = ${formatarNumero(velocidadeTeorica, 1)} nós`;
    
    // Atualizar resumo
    document.getElementById('resumo-rpm-helice').textContent = formatarNumero(rpmHelice, 0) + ' rpm';
    document.getElementById('resumo-passo').textContent = formatarNumero(passo, 1) + '"';
    document.getElementById('resumo-velocidade-teorica').textContent = formatarNumero(velocidadeTeorica, 1) + ' nós';
}

/**
 * Cria ou atualiza o gráfico de relação Passo × Velocidade
 * 
 * Esta função gera um gráfico de linha mostrando como o passo da hélice varia
 * conforme a velocidade desejada. O gráfico ajuda a visualizar a relação entre
 * esses dois parâmetros e permite ao usuário entender melhor o comportamento
 * da hélice em diferentes velocidades.
 * 
 * O gráfico é criado usando a biblioteca Chart.js e mostra:
 * - Eixo X: Velocidade (na unidade selecionada pelo usuário)
 * - Eixo Y: Passo recomendado (na unidade selecionada pelo usuário)
 * - Linha: Relação entre velocidade e passo para os parâmetros atuais (redução, RPM, slip)
 */
function atualizarGrafico() {
    // ============================================
    // PASSO 1: OBTER CONFIGURAÇÕES ATUAIS
    // ============================================
    // Obtém as unidades selecionadas e os valores dos parâmetros fixos
    const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
    const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
    const reducao = parseFloat(document.getElementById('sliderReducao').value);      // Redução da rabeta
    const rpmMotor = parseFloat(document.getElementById('sliderRPM').value);         // RPM do motor
    const slipPercent = parseFloat(document.getElementById('sliderSlip').value);     // Slip em percentual
    
    // ============================================
    // PASSO 2: GERAR DADOS PARA O GRÁFICO
    // ============================================
    // Cria arrays vazios para armazenar os valores de velocidade e passo
    const velocidades = []; // Valores do eixo X (velocidades)
    const passos = [];      // Valores do eixo Y (passos)
    
    // Loop que gera pontos do gráfico: de 5 a 60 nós, de 5 em 5 nós
    // Isso cria 12 pontos no gráfico (5, 10, 15, 20, ..., 60 nós)
    for (let vKnots = 5; vKnots <= 60; vKnots += 5) {
        // Converte a velocidade de nós para a unidade selecionada pelo usuário
        const vConvertida = converterKnotsParaUnidade(vKnots, unidadeVelocidade);
        // Arredonda para número inteiro e adiciona ao array de velocidades
        velocidades.push(Math.round(vConvertida));
        
        // Calcula o passo necessário para essa velocidade usando os parâmetros atuais
        // Converte slip de percentual para decimal (ex: 15% → 0.15)
        const resultado = calcularPasso(vKnots, reducao, rpmMotor, slipPercent / 100);
        
        // Converte o passo de polegadas para a unidade selecionada pelo usuário
        const passoConvertido = converterPassoParaUnidade(resultado.passo, unidadePasso);
        // Adiciona o passo ao array de passos
        passos.push(passoConvertido);
    }
    
    // ============================================
    // PASSO 3: OBTER O CONTEXTO DO CANVAS
    // ============================================
    // Obtém o elemento canvas do HTML e seu contexto 2D
    // O contexto é necessário para desenhar o gráfico
    const ctx = document.getElementById('graficoHelice').getContext('2d');
    
    // ============================================
    // PASSO 4: DESTRUIR GRÁFICO ANTERIOR (SE EXISTIR)
    // ============================================
    // Se já existe um gráfico criado anteriormente, destroi-o antes de criar um novo
    // Isso evita vazamentos de memória e garante que apenas um gráfico exista por vez
    if (graficoHelice) {
        graficoHelice.destroy();
    }
    
    // ============================================
    // PASSO 5: CRIAR NOVO GRÁFICO COM CHART.JS
    // ============================================
    // Cria um novo gráfico de linha usando a biblioteca Chart.js
    graficoHelice = new Chart(ctx, {
        // Tipo de gráfico: linha (line chart)
        type: 'line',
        
        // Dados do gráfico
        data: {
            // Labels do eixo X: valores de velocidade (na unidade selecionada)
            labels: velocidades,
            
            // Conjunto de dados (dataset) - neste caso, apenas um conjunto (o passo)
            datasets: [{
                // Label da legenda: texto que aparece na legenda do gráfico
                // Usa uma função imediatamente invocada (IIFE) para gerar o texto traduzido
                label: (() => {
                    // Obtém a unidade de passo selecionada
                    const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
                    // Obtém o texto da unidade traduzido (polegadas ou milímetros)
                    const unidadeText = unidadePasso === 'inches' 
                        ? traducoes[idiomaAtual]['unidade-polegadas'] 
                        : traducoes[idiomaAtual]['unidade-mm'];
                    // Retorna o label traduzido: "Passo (polegadas)" ou "Passo (mm)"
                    return `${idiomaAtual === 'pt-BR' ? 'Passo' : 'Passo'} (${unidadeText})`;
                })(),
                
                // Valores do eixo Y: valores de passo calculados
                data: passos,
                
                // Cor da linha do gráfico (azul-turquesa)
                borderColor: '#2d9fa3ff',
                // Cor de fundo da área sob a linha (azul-turquesa com 10% de opacidade)
                backgroundColor: 'rgba(45, 159, 163, 0.1)',
                // Largura da linha em pixels
                borderWidth: 3,
                // Não preencher a área sob a linha (apenas mostrar a linha)
                fill: false,
                // Curvatura da linha (0 = reta, 1 = muito curva) - 0.4 = suavemente curva
                tension: 0.4,
                // Raio dos pontos no gráfico (em pixels)
                pointRadius: 6,
                // Raio dos pontos quando o mouse passa sobre eles (em pixels)
                pointHoverRadius: 8,
                // Cor de fundo dos pontos
                pointBackgroundColor: '#2d9fa3ff',
                // Cor da borda dos pontos
                pointBorderColor: '#fff',
                // Largura da borda dos pontos (em pixels)
                pointBorderWidth: 2
            }]
        },
        
        // Opções de configuração do gráfico
        options: {
            // Desabilita animações (melhor performance e atualização instantânea)
            animation: false,
            // Faz o gráfico se adaptar ao tamanho do container
            responsive: true,
            // Não mantém a proporção de aspecto (permite que o gráfico se ajuste ao container)
            maintainAspectRatio: false,
            // Plugins do Chart.js (legenda, tooltips, etc.)
            plugins: {
                // Configuração da legenda (texto que identifica a linha no gráfico)
                legend: {
                    display: true,        // Mostra a legenda
                    position: 'top',      // Posiciona a legenda no topo do gráfico
                    labels: {
                        font: {
                            size: 14,     // Tamanho da fonte da legenda
                            weight: 'bold' // Peso da fonte (negrito)
                        }
                    }
                },
                
                // Configuração dos tooltips (dicas que aparecem ao passar o mouse sobre os pontos)
                tooltip: {
                    // Cor de fundo do tooltip (preto com 80% de opacidade)
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    // Configuração da fonte do título do tooltip
                    titleFont: {
                        size: 14  // Tamanho da fonte do título
                    },
                    // Configuração da fonte do corpo do tooltip
                    bodyFont: {
                        size: 13  // Tamanho da fonte do corpo
                    },
                    // Espaçamento interno do tooltip (em pixels)
                    padding: 12,
                    // Funções de callback para personalizar o conteúdo do tooltip
                    callbacks: {
                        // Personaliza o texto do label (valor) no tooltip
                        label: function(context) {
                            // Obtém a unidade de passo selecionada
                            const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
                            // Obtém o texto da unidade traduzido
                            const unidadeText = unidadePasso === 'inches' 
                                ? traducoes[idiomaAtual]['unidade-polegadas'] 
                                : traducoes[idiomaAtual]['unidade-mm'];
                            // Formata o valor: milímetros sem decimais, polegadas com 1 decimal
                            const valor = unidadePasso === 'mm' 
                                ? formatarNumero(Math.round(context.parsed.y), 0)  // Arredonda para inteiro
                                : formatarNumero(context.parsed.y, 1);  // 1 casa decimal
                            // Retorna o texto formatado: "12,5 polegadas" ou "317 mm"
                            return `${valor} ${unidadeText}`;
                        }
                    }
                }
            },
            // Configuração dos eixos (scales)
            scales: {
                // Eixo X (horizontal) - Velocidade
                x: {
                    // Título do eixo X
                    title: {
                        display: true,  // Mostra o título
                        // Texto do título: gera dinamicamente com a unidade traduzida
                        text: (() => {
                            // Obtém a unidade de velocidade selecionada
                            const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
                            // Obtém o texto da unidade traduzido
                            const unidadeText = {
                                'knots': traducoes[idiomaAtual]['unidade-nos'],  // "nós" ou "nodi"
                                'mph': traducoes[idiomaAtual]['unidade-mph'],    // "mph"
                                'kmh': traducoes[idiomaAtual]['unidade-kmh']     // "km/h"
                            }[unidadeVelocidade];
                            // Retorna o título traduzido: "Velocidade (nós)" ou "Velocità (nodi)"
                            return `${idiomaAtual === 'pt-BR' ? 'Velocidade' : 'Velocità'} (${unidadeText})`;
                        })(),
                        // Configuração da fonte do título
                        font: {
                            size: 14,     // Tamanho da fonte
                            weight: 'bold' // Peso da fonte (negrito)
                        }
                    },
                    // Configuração da grade (linhas de referência) do eixo X
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'  // Cor das linhas (preto com 5% de opacidade - muito suave)
                    }
                },
                
                // Eixo Y (vertical) - Passo
                y: {
                    // Título do eixo Y
                    title: {
                        display: true,  // Mostra o título
                        // Texto do título: gera dinamicamente com a unidade traduzida
                        text: (() => {
                            // Obtém a unidade de passo selecionada
                            const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
                            // Obtém o texto da unidade traduzido
                            const unidadeText = unidadePasso === 'inches' 
                                ? traducoes[idiomaAtual]['unidade-polegadas']  // "polegadas" ou "pollici"
                                : traducoes[idiomaAtual]['unidade-mm'];        // "mm"
                            // Retorna o título traduzido: "Passo (polegadas)" ou "Passo (mm)"
                            return `${idiomaAtual === 'pt-BR' ? 'Passo' : 'Passo'} (${unidadeText})`;
                        })(),
                        // Configuração da fonte do título
                        font: {
                            size: 14,     // Tamanho da fonte
                            weight: 'bold' // Peso da fonte (negrito)
                        }
                    },
                    // Faz o eixo Y começar em zero (melhor visualização)
                    beginAtZero: true,
                    // Configuração da grade (linhas de referência) do eixo Y
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'  // Cor das linhas (preto com 5% de opacidade - muito suave)
                    }
                }
            }
        }
    });
}

/**
 * CÓDIGO DE INICIALIZAÇÃO
 * =======================
 * Este código é executado quando a página termina de carregar (evento DOMContentLoaded).
 * Ele configura todos os event listeners (ouvintes de eventos) e inicializa a interface.
 */
document.addEventListener('DOMContentLoaded', function() {
    // ============================================
    // PASSO 1: OBTER REFERÊNCIAS AOS ELEMENTOS DO DOM
    // ============================================
    // Cria um objeto com referências a todos os elementos importantes da página
    // Isso facilita o acesso posterior e melhora a organização do código
    // Referências aos elementos (mantidas para compatibilidade, mas não mais usadas diretamente)
    const elementos = {
        sliderVelocidade: document.getElementById('sliderVelocidade'),  // Slider de velocidade
        sliderReducao: document.getElementById('sliderReducao'),        // Slider de redução
        sliderRPM: document.getElementById('sliderRPM'),                // Slider de RPM
        sliderSlip: document.getElementById('sliderSlip')               // Slider de slip
    };
    
    // ============================================
    // PASSO 2: INICIALIZAR IDIOMA
    // ============================================
    // Aplica o idioma salvo no localStorage (ou o padrão) à interface
    // Isso garante que a página seja exibida no idioma preferido do usuário
    trocarIdioma(idiomaAtual);
    
    // ============================================
    // PASSO 3: CONFIGURAR BOTÕES DE IDIOMA
    // ============================================
    // Adiciona event listeners aos botões de seleção de idioma
    // Quando clicados, trocam o idioma da interface
    document.getElementById('btnPortugues').addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano').addEventListener('click', () => trocarIdioma('it-IT'));
    
    // ============================================
    // PASSO 4: CONFIGURAR EVENT LISTENERS DOS SLIDERS
    // ============================================
    // Adiciona event listeners ao evento 'input' de cada slider
    // O evento 'input' é disparado sempre que o valor do slider muda
    // Quando isso acontece, a função `atualizarResultado()` é chamada para recalcular tudo
    const sliderVelocidade = document.getElementById('sliderVelocidade');
    const sliderReducao = document.getElementById('sliderReducao');
    const sliderRPM = document.getElementById('sliderRPM');
    const sliderSlip = document.getElementById('sliderSlip');
    
    sliderVelocidade.addEventListener('input', () => {
        const valorSlider = parseFloat(sliderVelocidade.value);
        const inputVelocidade = document.getElementById('inputVelocidade');
        if (inputVelocidade) {
            const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked')?.value || 'knots';
            // O slider já está na unidade selecionada (após atualizarLimitesVelocidade)
            // Então apenas atualiza o input com o valor do slider
            inputVelocidade.value = formatarNumero(valorSlider, unidadeVelocidade === 'knots' ? 0 : 1);
        }
        // Chama atualizarResultado que vai ler do slider (já que o input foi atualizado)
        atualizarResultado();
    });
    
    sliderReducao.addEventListener('input', () => {
        const valor = parseFloat(sliderReducao.value);
        const inputReducao = document.getElementById('inputReducao');
        if (inputReducao) {
            // Atualiza o input para corresponder ao slider
            inputReducao.value = formatarNumero(valor, 2);
        }
        atualizarResultado();
    });
    
    sliderRPM.addEventListener('input', () => {
        const valor = parseFloat(sliderRPM.value);
        const inputRPM = document.getElementById('inputRPM');
        if (inputRPM) {
            // Atualiza o input para corresponder ao slider
            inputRPM.value = formatarNumero(Math.round(valor), 0);
        }
        atualizarResultado();
    });
    
    sliderSlip.addEventListener('input', () => {
        const valor = parseFloat(sliderSlip.value);
        const inputSlip = document.getElementById('inputSlip');
        if (inputSlip) {
            // Atualiza o input para corresponder ao slider
            inputSlip.value = formatarNumero(Math.round(valor), 0);
        }
        atualizarResultado();
    });
    
    // ============================================
    // PASSO 4B: CONFIGURAR EVENT LISTENERS DOS INPUTS EDITÁVEIS
    // ============================================
    // Permite edição manual dos valores, inclusive fora dos limites do slider
    const inputVelocidadeEl = document.getElementById('inputVelocidade');
    const inputReducaoEl = document.getElementById('inputReducao');
    const inputRPMEl = document.getElementById('inputRPM');
    const inputSlipEl = document.getElementById('inputSlip');
    
    if (inputVelocidadeEl) {
        inputVelocidadeEl.addEventListener('focus', (e) => e.target.select());
        inputVelocidadeEl.addEventListener('input', () => {
            const valor = converterValorFormatadoParaNumero(inputVelocidadeEl.value);
            if (!isNaN(valor) && valor > 0) {
                // Atualiza o slider apenas se estiver dentro dos limites
                const slider = document.getElementById('sliderVelocidade');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                // Sempre recalcula, mesmo se estiver fora dos limites
                atualizarResultado();
            }
        });
    }
    
    if (inputReducaoEl) {
        inputReducaoEl.addEventListener('focus', (e) => e.target.select());
        inputReducaoEl.addEventListener('input', () => {
            const valor = converterValorFormatadoParaNumero(inputReducaoEl.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderReducao');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultado();
            }
        });
    }
    
    if (inputRPMEl) {
        inputRPMEl.addEventListener('focus', (e) => e.target.select());
        inputRPMEl.addEventListener('input', () => {
            const valor = converterValorFormatadoParaNumero(inputRPMEl.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderRPM');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultado();
            }
        });
    }
    
    if (inputSlipEl) {
        inputSlipEl.addEventListener('focus', (e) => e.target.select());
        inputSlipEl.addEventListener('input', () => {
            const valor = converterValorFormatadoParaNumero(inputSlipEl.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderSlip');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultado();
            }
        });
    }
    
    // ============================================
    // PASSO 5: CONFIGURAR BOTÕES DE SETA (↑ ↓)
    // ============================================
    // Adiciona funcionalidade aos botões de seta ao lado dos sliders
    // Esses botões permitem ajustar os valores dos sliders de forma incremental
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        // Obtém o ID do slider alvo e o valor do incremento/decremento do atributo data-*
        const targetId = btn.getAttribute('data-target');  // ID do slider a ser ajustado
        const step = parseFloat(btn.getAttribute('data-step')); // Valor do passo (positivo ou negativo)
        
        // Função que inicia o ajuste repetitivo do valor
        // Quando o usuário segura o botão, primeiro ajusta uma vez, depois de 500ms
        // começa a ajustar repetidamente a cada 100ms
        const startRepeating = () => {
            // Ajusta o valor imediatamente (primeira vez)
            ajustarValor(targetId, step);
            
            // Após 500ms, inicia o ajuste repetitivo a cada 100ms
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100);  // Ajusta a cada 100 milissegundos
            }, 500);  // Espera 500ms antes de começar a repetir
        };
        
        // Função que para o ajuste repetitivo
        // Limpa o timeout e o interval para interromper os ajustes
        const stopRepeating = () => {
            clearTimeout(timeoutId);   // Cancela o timeout que inicia a repetição
            clearInterval(intervalId); // Cancela o interval que faz os ajustes repetitivos
        };
        
        // Event listeners para mouse (desktop)
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();  // Previne comportamento padrão (ex: seleção de texto)
            startRepeating();    // Inicia o ajuste quando o botão é pressionado
        });
        btn.addEventListener('mouseup', stopRepeating);      // Para quando solta o botão
        btn.addEventListener('mouseleave', stopRepeating);   // Para quando o mouse sai do botão
        
        // Event listeners para toque (mobile/tablet)
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();  // Previne comportamento padrão (ex: scroll)
            startRepeating();    // Inicia o ajuste quando o botão é tocado
        });
        btn.addEventListener('touchend', stopRepeating);     // Para quando o toque termina
        btn.addEventListener('touchcancel', stopRepeating);  // Para quando o toque é cancelado
    });
    
    // ============================================
    // PASSO 6: CONFIGURAR RADIO BUTTONS DE UNIDADE DE VELOCIDADE
    // ============================================
    // Rastreia a unidade anterior para fazer a conversão correta quando o usuário muda
    let unidadeVelocidadeAnterior = 'knots';
    
    // Encontra qual radio button está marcado inicialmente
    document.querySelectorAll('input[name="unidadeVelocidade"]').forEach(radio => {
        if (radio.checked) {
            unidadeVelocidadeAnterior = radio.value;  // Salva a unidade inicial
        }
    });
    
    // Adiciona event listeners para quando o usuário muda a unidade de velocidade
    document.querySelectorAll('input[name="unidadeVelocidade"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // Salva a unidade anterior antes de atualizar
            const unidadeAnterior = unidadeVelocidadeAnterior;
            // Atualiza a unidade anterior para a próxima mudança
            unidadeVelocidadeAnterior = radio.value;
            // Atualiza os limites do slider e converte o valor atual
            atualizarLimitesVelocidade(unidadeAnterior);
            // Recalcula e atualiza todos os resultados
            atualizarResultado();
        });
    });
    
    // ============================================
    // PASSO 7: CONFIGURAR RADIO BUTTONS DE UNIDADE DE PASSO
    // ============================================
    // Adiciona event listeners para quando o usuário muda a unidade de passo
    document.querySelectorAll('input[name="unidadePasso"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // Quando a unidade de passo muda, apenas recalcula os resultados
            // (não precisa atualizar limites, pois o passo não tem slider)
            atualizarResultado();
        });
    });
    
    // ============================================
    // PASSO 8: CONFIGURAR MEMORIAL DE CÁLCULO
    // ============================================
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
    
    // ============================================
    // PASSO 9: INICIALIZAR A INTERFACE
    // ============================================
    // Formata os valores iniciais dos inputs para o formato brasileiro
    const inputReducaoInicial = document.getElementById('inputReducao');
    if (inputReducaoInicial && inputReducaoInicial.value) {
        const valorNumerico = parseFloat(inputReducaoInicial.value);
        if (!isNaN(valorNumerico)) {
            inputReducaoInicial.value = formatarNumero(valorNumerico, 2);
        }
    }
    const inputRPMInicial = document.getElementById('inputRPM');
    if (inputRPMInicial && inputRPMInicial.value) {
        const valorNumerico = parseFloat(inputRPMInicial.value);
        if (!isNaN(valorNumerico)) {
            inputRPMInicial.value = formatarNumero(Math.round(valorNumerico), 0);
        }
    }
    
    // Atualiza os limites do slider de velocidade com os valores padrão
    atualizarLimitesVelocidade();
    // Calcula e exibe os resultados iniciais
    atualizarResultado();
});
