// ============================================
// CONFIGURAÇÃO GLOBAL DO SITE
// ============================================
// Este arquivo centraliza todas as configurações e funções utilitárias
// que são usadas por várias páginas do portfólio. Isso evita repetir o mesmo
// código em cada arquivo e facilita manutenção.
//
// Por que centralizar?
// - Se precisar mudar o nome de uma chave do localStorage, muda só aqui
// - Se precisar ajustar valores padrão, muda só aqui
// - Todos os arquivos usam as mesmas configurações, evitando erros
// - Funções de formatação e conversão padronizadas em todo o site
// ============================================

// Função que cria um objeto isolado (IIFE - Immediately Invoked Function Expression)
// Isso evita que as variáveis dentro poluam o escopo global
(function(global){
    'use strict';

    // ============================================
    // CONFIGURAÇÕES PRINCIPAIS
    // ============================================
    
    const SiteConfig = {
        // LOCAL_STORAGE: Chaves usadas no localStorage (armazenamento do navegador)
        // Essas são as "gavetas" onde guardamos informações do usuário
        LOCAL_STORAGE: {
            LANGUAGE_KEY: 'idiomaPreferido',      // Guarda o idioma escolhido (pt-BR ou it-IT)
            SOLAR_CONFIG_KEY: 'configSolar'       // Guarda as configurações do app Solar
        },

        // DEFAULTS: Valores padrão usados quando não há nada salvo
        DEFAULTS: {
            language: 'pt-BR',                    // Idioma padrão: Português do Brasil
            TAXA_BRL_EUR: 6.19,                   // Taxa de conversão: 1 Euro = 6.19 Reais (aproximado)
            BATTERY: {
                LFP_MAX_KG: 180,                  // Peso máximo de bateria de lítio (LiFePO4): 180 kg
                AGM_MAX_KG: 180,                  // Peso máximo de bateria AGM: 180 kg
                DEFAULT_LFP_KWH: 4.8,             // Capacidade padrão lítio: 4.8 kWh
                DEFAULT_AGM_KWH: 1.2              // Capacidade padrão AGM: 1.2 kWh
            },
            INVERTER_MIN_KW: 1                    // Potência mínima do inversor: 1 kW
        },

        // SELECTORS: Seletores CSS usados para encontrar elementos na página
        // Em vez de escrever '.home-button-fixed' em vários lugares,
        // escrevemos SELECTORS.HOME_BUTTON e se precisar mudar, muda só aqui
        SELECTORS: {
            HOME_BUTTON: '.home-button-fixed',    // Botão fixo para voltar ao início
            LANG_BTN: '.lang-btn',                // Botões de seleção de idioma
            APP_ICON: '.app-icon',                // Ícones dos aplicativos na tela inicial
            ARROW_BTN: '.arrow-btn',              // Botões de seta (+ e -) nos sliders
            BUTTON_ACTION: '.btn-acao',           // Botões de ação genéricos
            LANGUAGE_SELECTOR: '.language-selector' // Container do seletor de idioma
        },

        // ASSETS: Caminhos e URLs de recursos externos
        ASSETS: {
            CSS_BASE: 'assets/css/',              // Pasta onde ficam os arquivos CSS
            JS_BASE: 'assets/js/',                // Pasta onde ficam os arquivos JavaScript
            CHARTJS_CDN: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'  // URL da biblioteca de gráficos Chart.js (versão específica sem source maps)
        },

        // UI: Configurações da interface do usuário
        UI: {
            INPUT_PADDING_CHARS: 2,               // Caracteres de folga para inputs dinâmicos
            INPUT_MIN_WIDTH: 50,                  // Largura mínima de inputs em pixels
            SCROLL_BEHAVIOR: 'smooth',            // Comportamento de scroll (smooth ou auto)
            ANIMATION_DURATION: 300,              // Duração padrão de animações em ms
            DEBOUNCE_DELAY: 300,                  // Delay para debounce de inputs (ms)
            THROTTLE_DELAY: 100                   // Delay para throttle de sliders (ms)
        },

        // FORMATTING: Configurações de formatação de números
        FORMATTING: {
            LOCALE_PT: 'pt-BR',                   // Locale para formatação brasileira
            LOCALE_IT: 'it-IT',                   // Locale para formatação italiana
            DECIMAL_SEPARATOR_PT: ',',            // Separador decimal em português
            THOUSANDS_SEPARATOR_PT: '.',          // Separador de milhares em português
            DECIMAL_SEPARATOR_IT: ',',            // Separador decimal em italiano
            THOUSANDS_SEPARATOR_IT: '.'           // Separador de milhares em italiano
        },

        // CURRENCY: Configurações de moeda
        CURRENCY: {
            BRL: 'BRL',                           // Real brasileiro
            EUR: 'EUR',                           // Euro
            BRL_SYMBOL: 'R$',                     // Símbolo do Real
            EUR_SYMBOL: '€'                       // Símbolo do Euro
        }
    };

    // Tenta tornar o objeto somente leitura (não pode ser modificado depois)
    // Se der erro (navegadores antigos), usa o objeto normal
    try { 
        global.SiteConfig = Object.freeze(SiteConfig); 
    } catch(erro){ 
        global.SiteConfig = SiteConfig; 
    }
    
    // Agora o objeto está disponível globalmente como window.SiteConfig
    // Outros arquivos podem usar: SiteConfig.DEFAULTS.language, etc.
})(window);

// ============================================
// FUNÇÕES GLOBAIS DE FORMATAÇÃO DE NÚMEROS
// ============================================

/**
 * Formata número com casas decimais usando formatação brasileira
 * Sempre usa vírgula como separador decimal e ponto como separador de milhares
 * @param {number} valor - Valor numérico
 * @param {number} casasDecimais - Número de casas decimais (padrão: 0)
 * @returns {string} Valor formatado (ex: "12" ou "1.234,56")
 */
function formatarNumero(valor, casasDecimais = 0) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    return valor.toLocaleString(SiteConfig.FORMATTING.LOCALE_PT, {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais,
        useGrouping: true
    });
}

/**
 * Formata número com casas decimais usando formatação brasileira
 * Sempre usa vírgula como separador decimal e ponto como separador de milhares
 * @param {number} valor - Valor numérico
 * @param {number} casasDecimais - Número de casas decimais (padrão: 1)
 * @returns {string} Valor formatado (ex: "12,5" ou "1.234,56")
 */
function formatarNumeroDecimal(valor, casasDecimais = 1) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    return valor.toLocaleString(SiteConfig.FORMATTING.LOCALE_PT, {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais,
        useGrouping: true
    });
}

/**
 * Formata número com casas decimais usando formatação brasileira (alias para formatarNumeroDecimal)
 * Mantida para compatibilidade com código existente
 * @param {number} valor - Valor numérico
 * @param {number} casasDecimais - Número de casas decimais (padrão: 0)
 * @returns {string} Valor formatado (ex: "12" ou "1.234,56")
 */
function formatarNumeroBR(valor, casasDecimais = 0) {
    return formatarNumero(valor, casasDecimais);
}

/**
 * Converte valor formatado (com vírgula decimal) de volta para número
 * Aceita tanto formato brasileiro (1.234,56) quanto formato internacional (1234.56)
 * @param {string} valorFormatado - Valor formatado como string
 * @returns {number} Valor numérico
 */
function converterValorFormatadoParaNumero(valorFormatado) {
    if (!valorFormatado) return 0;
    let valorTexto = String(valorFormatado).trim();
    
    // Se tem vírgula e ponto, assume formato brasileiro (1.234,56)
    if (valorTexto.indexOf('.') !== -1 && valorTexto.indexOf(',') !== -1) {
        valorTexto = valorTexto.replace(/\./g, ''); // Remove pontos (milhares)
        valorTexto = valorTexto.replace(',', '.');   // Troca vírgula por ponto
    }
    // Se tem apenas vírgula, assume formato brasileiro (12,5)
    else if (valorTexto.indexOf(',') !== -1) {
        valorTexto = valorTexto.replace(/\./g, ''); // Remove pontos se houver
        valorTexto = valorTexto.replace(',', '.');   // Troca vírgula por ponto
    }
    // Se tem apenas um ponto, verifica se é decimal ou milhares
    else if (valorTexto.indexOf('.') !== -1) {
        const partes = valorTexto.split('.');
        // Se há mais de 2 partes, é formato com milhares (ex: 1.234.567)
        if (partes.length > 2) {
            valorTexto = valorTexto.replace(/\./g, ''); // Remove todos os pontos (milhares)
        }
        // Se há 2 partes
        else if (partes.length === 2) {
            // Se a segunda parte tem exatamente 3 dígitos, provavelmente é milhares (ex: 5.800, 1.234)
            if (partes[1].length === 3) {
                valorTexto = valorTexto.replace(/\./g, ''); // Remove o ponto (milhares)
            }
            // Se a segunda parte tem 1-2 dígitos, provavelmente é decimal (ex: 2.32, 12.5)
            else if (partes[1].length <= 2) {
                // Mantém o ponto como separador decimal (já está no formato correto)
                // Não precisa fazer nada, parseFloat já entende
            }
            // Caso contrário (mais de 3 dígitos na segunda parte), remove o ponto
            else {
                valorTexto = valorTexto.replace(/\./g, '');
            }
        }
    }
    // Se não tem nem vírgula nem ponto, já está no formato correto
    
    return parseFloat(valorTexto) || 0;
}

/**
 * Converte valor formatado para número (versão simplificada)
 * Remove pontos (separadores de milhares) e substitui vírgula por ponto
 * Detecta quando ponto é separador decimal (ex: 1.5 → 1.5) vs separador de milhares (ex: 1.500 → 1500)
 * @param {string} valorFormatado - Valor formatado como string
 * @returns {number} Valor numérico
 */
function obterValorNumericoFormatado(valorFormatado) {
    if (!valorFormatado) return 0;
    
    let valor = valorFormatado.toString().trim();
    
    // Se tem vírgula, trata como separador decimal brasileiro
    if (valor.indexOf(',') !== -1) {
        // Remove pontos (separadores de milhares) e substitui vírgula por ponto
        valor = valor.replace(/\./g, ''); // Remove pontos de milhares
        valor = valor.replace(',', '.');   // Substitui vírgula por ponto
        return parseFloat(valor) || 0;
    }
    
    // Se tem apenas ponto(s), precisa determinar se é decimal ou milhares
    if (valor.indexOf('.') !== -1) {
        const partes = valor.split('.');
        
        // Se há mais de 2 partes, é formato com milhares (ex: 1.234.567)
        if (partes.length > 2) {
            // Remove todos os pontos (milhares)
            valor = valor.replace(/\./g, '');
            return parseFloat(valor) || 0;
        }
        
        // Se há exatamente 2 partes
        if (partes.length === 2) {
            // Se a segunda parte tem 1-2 dígitos, é separador decimal (ex: 1.5, 12.34, 1.50)
            if (partes[1].length <= 2 && partes[1].match(/^\d+$/)) {
                // Mantém o ponto como separador decimal (já está no formato correto para parseFloat)
                return parseFloat(valor) || 0;
            }
            // Se a segunda parte tem 3 dígitos, precisa analisar melhor
            if (partes[1].length === 3) {
                // Se a primeira parte tem 1-3 dígitos e o valor total é pequeno (< 100), 
                // provavelmente é decimal (ex: 1.500 = 1.5, 12.500 = 12.5)
                const valorTeste = parseFloat(valor);
                if (partes[0].length <= 3 && valorTeste < 100) {
                    // Trata como decimal
                    return valorTeste || 0;
                }
                // Se a primeira parte tem mais de 3 dígitos ou valor >= 100, 
                // provavelmente é milhares (ex: 1500.000 = 1500000)
                // Remove o ponto (milhares)
                valor = valor.replace(/\./g, '');
                return parseFloat(valor) || 0;
            }
            // Se a segunda parte tem mais de 3 dígitos, remove o ponto (milhares)
            valor = valor.replace(/\./g, '');
            return parseFloat(valor) || 0;
        }
    }
    
    // Se não tem nem vírgula nem ponto, já está no formato correto
    return parseFloat(valor) || 0;
}

/**
 * Formata potência para exibição com abreviação "k" para valores >= 1000
 * Exemplos: 999 → "999", 1000 → "1k", 2500 → "2,5k", 10000 → "10k"
 * @param {number} valor - Valor da potência em watts
 * @returns {string} Valor formatado com "k" quando apropriado
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
    return formatarNumeroDecimal(valorK, 1) + 'k';
}

/**
 * Formata potência para exibição convertendo para kW quando >= 1000W
 * Exemplos: 999 → "999 W", 1000 → "1,0 kW", 2500 → "2,5 kW"
 * @param {number} valor_W - Valor da potência em watts
 * @returns {string} Valor formatado com "W" ou "kW"
 */
function formatarPotenciaWkW(valor_W) {
    if (isNaN(valor_W) || valor_W === null || valor_W === undefined) return '-';
    if (valor_W >= 1000) {
        return formatarNumeroDecimal(valor_W / 1000, 1) + ' kW';
    }
    return formatarNumero(Math.round(valor_W)) + ' W';
}

/**
 * Formata números com sufixos k (kilo), M (mega) ou m (mili) quando apropriado
 * Usa abreviações para números grandes e pequenos:
 * - >= 1.000.000 → "M" (mega): 1.500.000 → "1,5M"
 * - >= 1.000 → "k" (kilo): 1.500 → "1,5k", 7.500 → "7,5k"
 * - < 1 e >= 0.001 → "m" (mili): 0.005 → "5m", 0.5 → "500m"
 * - < 0.001 → mantém formato decimal: 0.0005 → "0,0005"
 * - Entre 1 e 999 → sem sufixo: 500 → "500"
 * @param {number} valor - Número a ser formatado
 * @param {number} casasDecimais - Número de casas decimais (padrão: 1 para k/M, 0 para m)
 * @returns {string} Número formatado com sufixo quando apropriado
 */
function formatarNumeroComSufixo(valor, casasDecimais = 1) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    
    const absValor = Math.abs(valor);
    const sinal = valor < 0 ? '-' : '';
    
    // Mega (M) - valores >= 1.000.000
    if (absValor >= 1000000) {
        const valorM = absValor / 1000000;
        // Se for inteiro, não mostra decimais
        if (valorM % 1 === 0) {
            return sinal + valorM + 'M';
        }
        return sinal + formatarNumeroDecimal(valorM, casasDecimais) + 'M';
    }
    
    // Kilo (k) - valores >= 1.000
    if (absValor >= 1000) {
        const valorK = absValor / 1000;
        // Se for inteiro, não mostra decimais
        if (valorK % 1 === 0) {
            return sinal + valorK + 'k';
        }
        return sinal + formatarNumeroDecimal(valorK, casasDecimais) + 'k';
    }
    
    // Mili (m) - valores < 1 e >= 0.001
    if (absValor < 1 && absValor >= 0.001) {
        const valorM = absValor * 1000;
        // Para mili, geralmente não precisa de decimais, mas permite se especificado
        if (casasDecimais === 0 || valorM % 1 === 0) {
            return sinal + Math.round(valorM) + 'm';
        }
        return sinal + formatarNumeroDecimal(valorM, casasDecimais) + 'm';
    }
    
    // Valores entre 1 e 999 - sem sufixo
    if (absValor >= 1) {
        return sinal + formatarNumero(absValor, casasDecimais);
    }
    
    // Valores < 0.001 - mantém formato decimal
    return sinal + formatarNumeroDecimal(absValor, Math.max(casasDecimais, 3));
}

/**
 * Converte valor formatado com sufixos (k/M/m) de volta para número
 * Aceita tanto ponto quanto vírgula como separador decimal
 * Aceita números puros (sem sufixo) que serão interpretados como valores diretos
 * Exemplos: "1,5k" → 1500, "7.5k" → 7500, "2M" → 2000000, "500m" → 0.5, "10000" → 10000
 * @param {string} valorFormatado - Valor formatado com possível sufixo
 * @returns {number} Valor numérico convertido
 */
function obterValorNumericoComSufixo(valorFormatado) {
    if (!valorFormatado || typeof valorFormatado !== 'string') return 0;
    
    const valor = valorFormatado.toString().trim();
    if (valor === '' || valor === '-') return 0;
    
    // Remove espaços e converte para minúsculo para verificar sufixos
    const valorLower = valor.toLowerCase();
    
    // Verifica se termina com sufixo
    let multiplicador = 1;
    let valorSemSufixo = valor;
    let temSufixo = false;
    
    // Verifica sufixos na ordem: M (mega), k (kilo), m (mili)
    // M (mega) - maiúsculo
    if (valor.endsWith('M')) {
        multiplicador = 1000000;
        valorSemSufixo = valor.slice(0, -1).trim();
        temSufixo = true;
    } 
    // k (kilo) - minúsculo
    else if (valorLower.endsWith('k')) {
        multiplicador = 1000;
        valorSemSufixo = valor.slice(0, -1).trim();
        temSufixo = true;
    } 
    // m (mili) - minúsculo (só se não for mega)
    else if (valorLower.endsWith('m') && valor.length > 1) {
        // Para distinguir M (mega) de m (mili), verifica o valor numérico antes do sufixo
        const valorTeste = valor.slice(0, -1).trim();
        // Normaliza separador decimal para verificar o valor
        const valorTesteNormalizado = valorTeste.replace(',', '.');
        const valorNum = parseFloat(valorTesteNormalizado);
        
        // Se o valor antes do sufixo for >= 1, provavelmente é mega (M maiúsculo)
        // Mas se termina com 'm' minúsculo e valor >= 1, pode ser erro, mas tratamos como mili
        // Se valor < 1, é definitivamente mili
        if (!isNaN(valorNum) && valorNum < 1) {
            multiplicador = 0.001;
            valorSemSufixo = valorTeste;
            temSufixo = true;
        } else if (!isNaN(valorNum) && valorNum >= 1) {
            // Se valor >= 1 e termina com 'm', pode ser erro de digitação, mas tratamos como mili
            // Ou pode ser que o usuário quis dizer mega mas digitou 'm' minúsculo
            // Por segurança, assumimos mili se termina com 'm' minúsculo
            multiplicador = 0.001;
            valorSemSufixo = valorTeste;
            temSufixo = true;
        }
    }
    
    // Se não tem sufixo, é um número puro
    if (!temSufixo) {
        // Normaliza separador decimal (aceita tanto ponto quanto vírgula)
        valorSemSufixo = valor;
    }
    
    // Normaliza separador decimal: converte vírgula para ponto
    const valorNormalizado = valorSemSufixo.replace(',', '.');
    
    // Remove qualquer caractere que não seja número, ponto ou sinal negativo
    const valorLimpo = valorNormalizado.replace(/[^\d.-]/g, '');
    
    // Converte para número
    const valorNumerico = parseFloat(valorLimpo);
    
    // Se não conseguiu converter, retorna 0
    if (isNaN(valorNumerico)) return 0;
    
    return valorNumerico * multiplicador;
}

/**
 * Formata números de forma compacta para gráficos
 * Usa abreviações para números grandes:
 * - 1.500.000 → "1,5M" (milhões)
 * - 150.000 → "150k" (milhares)
 * - 500 → "500" (sem abreviação)
 * @param {number} valor - Número a ser formatado
 * @returns {string} Número formatado de forma compacta
 */
function formatarNumeroCompacto(valor) {
    // Se o valor é maior ou igual a 1 milhão
    if (valor >= 1000000) {
        const valorEmMilhoes = (valor / 1000000).toFixed(1);
        return valorEmMilhoes.replace('.', ',') + 'M';
    } 
    // Se o valor é maior ou igual a 1 mil (mas menor que 1 milhão)
    else if (valor >= 1000) {
        const valorEmMilhares = (valor / 1000).toFixed(0);
        return valorEmMilhares + 'k';
    }
    // Se o valor é menor que 1 mil, retorna como está (sem abreviação)
    return valor.toString();
}

/**
 * Formata valores monetários com 2 casas decimais
 * Formata números como moeda (R$ ou €) com centavos.
 * Exemplo: 1234.56 → "R$ 1.234,56" (pt-BR) ou "€ 1.234,56" (it-IT)
 * @param {number} valor - Valor a ser formatado
 * @param {string} idioma - Idioma atual ('pt-BR' ou 'it-IT')
 * @returns {string} Valor formatado como moeda
 */
function formatarMoeda(valor, idioma) {
    if (!idioma) {
        // Tenta obter do localStorage ou usa padrão
        const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
        idioma = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || SiteConfig.DEFAULTS.language;
    }
    
    const moeda = idioma === 'pt-BR' ? SiteConfig.CURRENCY.BRL : SiteConfig.CURRENCY.EUR;
    
    return new Intl.NumberFormat(idioma, {
        style: 'currency',
        currency: moeda,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

/**
 * Formata valores monetários sem casas decimais
 * Formata números como moeda (R$ ou €) sem centavos.
 * Exemplo: 1234.56 → "R$ 1.235" (arredondado, pt-BR)
 * @param {number} valor - Valor a ser formatado
 * @param {string} idioma - Idioma atual ('pt-BR' ou 'it-IT')
 * @returns {string} Valor formatado como moeda sem decimais
 */
function formatarMoedaSemDecimal(valor, idioma) {
    if (!idioma) {
        const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
        idioma = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || SiteConfig.DEFAULTS.language;
    }
    
    const moeda = idioma === 'pt-BR' ? SiteConfig.CURRENCY.BRL : SiteConfig.CURRENCY.EUR;
    
    return new Intl.NumberFormat(idioma, {
        style: 'currency',
        currency: moeda,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
}

// ============================================
// FUNÇÃO GLOBAL: AJUSTAR TAMANHO DINÂMICO DE INPUTS
// ============================================
/**
 * Ajusta dinamicamente a largura de um input baseado no seu conteúdo
 * Adiciona caracteres de folga ao tamanho atual do texto
 * @param {HTMLElement|string} input - Elemento input ou ID do input
 * @param {number} folgaCaracteres - Número de caracteres de folga (padrão: 2)
 */
function ajustarTamanhoInput(input, folgaCaracteres) {
    // Usa valor padrão do SiteConfig se não especificado
    if (folgaCaracteres === undefined) {
        folgaCaracteres = SiteConfig.UI.INPUT_PADDING_CHARS;
    }
    
    // Se recebeu string (ID), busca o elemento
    if (typeof input === 'string') {
        input = document.getElementById(input);
    }
    
    // Verifica se o elemento existe e é um input
    if (!input || input.tagName !== 'INPUT') {
        return;
    }
    
    // Cria um elemento temporário para medir o texto
    const medida = document.createElement('span');
    const inputStyle = window.getComputedStyle(input);
    medida.style.visibility = 'hidden';
    medida.style.position = 'absolute';
    medida.style.whiteSpace = 'pre';
    // Copia propriedades individuais de fonte ao invés da propriedade 'font' completa
    // Isso evita problemas com CSP e fontes externas
    medida.style.fontFamily = inputStyle.fontFamily;
    medida.style.fontSize = inputStyle.fontSize;
    medida.style.fontWeight = inputStyle.fontWeight;
    medida.style.fontStyle = inputStyle.fontStyle;
    medida.style.fontVariant = inputStyle.fontVariant;
    medida.style.letterSpacing = inputStyle.letterSpacing;
    medida.style.padding = inputStyle.padding;
    medida.style.border = inputStyle.border;
    medida.style.boxSizing = inputStyle.boxSizing;
    
    // Adiciona o texto atual + caracteres de folga
    const textoAtual = input.value || input.placeholder || '';
    const caracteresFolga = 'M'.repeat(folgaCaracteres); // 'M' é geralmente o caractere mais largo
    medida.textContent = textoAtual + caracteresFolga;
    
    // Adiciona temporariamente ao DOM para medir
    document.body.appendChild(medida);
    
    // Calcula a largura necessária
    const larguraNecessaria = medida.offsetWidth;
    
    // Remove o elemento temporário
    document.body.removeChild(medida);
    
    // Aplica a largura ao input (com mínimo configurado)
    const larguraMinima = SiteConfig.UI.INPUT_MIN_WIDTH;
    input.style.width = Math.max(larguraNecessaria, larguraMinima) + 'px';
}

// ============================================
// FUNÇÕES UTILITÁRIAS DE IDIOMA
// ============================================

/**
 * Obtém o idioma atual do localStorage ou usa o padrão
 * @returns {string} Idioma atual ('pt-BR' ou 'it-IT')
 */
function obterIdiomaAtual() {
    const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
    return localStorage.getItem(SITE_LS.LANGUAGE_KEY) || SiteConfig.DEFAULTS.language;
}

/**
 * Obtém a moeda correspondente ao idioma atual
 * @param {string} idioma - Idioma ('pt-BR' ou 'it-IT')
 * @returns {string} Código da moeda ('BRL' ou 'EUR')
 */
function obterMoedaPorIdioma(idioma) {
    if (!idioma) {
        idioma = obterIdiomaAtual();
    }
    return idioma === 'pt-BR' ? SiteConfig.CURRENCY.BRL : SiteConfig.CURRENCY.EUR;
}

/**
 * Obtém o símbolo da moeda correspondente ao idioma atual
 * @param {string} idioma - Idioma ('pt-BR' ou 'it-IT')
 * @returns {string} Símbolo da moeda ('R$' ou '€')
 */
function obterSimboloMoeda(idioma) {
    if (!idioma) {
        idioma = obterIdiomaAtual();
    }
    return idioma === 'pt-BR' ? SiteConfig.CURRENCY.BRL_SYMBOL : SiteConfig.CURRENCY.EUR_SYMBOL;
}

// ============================================
// FUNÇÕES DE PERFORMANCE: DEBOUNCE E THROTTLE
// ============================================

/**
 * Debounce: Executa a função apenas após um período de inatividade
 * Útil para inputs de texto que disparam cálculos pesados
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em milissegundos (padrão: 300ms)
 * @returns {Function} Função com debounce aplicado
 */
function debounce(func, wait) {
    if (wait === undefined) {
        wait = SiteConfig.UI.DEBOUNCE_DELAY;
    }
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle: Executa a função no máximo uma vez por período
 * Útil para sliders que disparam cálculos a cada movimento
 * Versão melhorada que garante que o último evento seja sempre processado (trailing edge)
 * @param {Function} func - Função a ser executada
 * @param {number} limit - Intervalo mínimo entre execuções em ms (padrão: 100ms)
 * @returns {Function} Função com throttle aplicado
 */
function throttle(func, limit) {
    if (limit === undefined) {
        limit = SiteConfig.UI.THROTTLE_DELAY;
    }
    let inThrottle;
    let lastArgs = null;
    let timeoutId = null;
    
    return function executedFunction(...args) {
        // Salva os argumentos do último evento
        lastArgs = args;
        
        if (!inThrottle) {
            // Executa imediatamente o primeiro evento
            func.apply(this, args);
            inThrottle = true;
            
            // Limpa timeout anterior se existir
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Configura timeout para executar o último evento após o período de throttle
            timeoutId = setTimeout(() => {
                inThrottle = false;
                // Se há um último evento pendente, executa agora
                if (lastArgs !== null) {
                    const argsToExecute = lastArgs;
                    lastArgs = null;
                    func.apply(this, argsToExecute);
                }
                timeoutId = null;
            }, limit);
        }
    };
}

/**
 * Configura um slider com eventos input (throttled) e change (sem throttle)
 * Garante que o valor final seja sempre atualizado, mesmo quando o usuário move rapidamente
 * @param {HTMLElement} slider - Elemento slider
 * @param {Function} callback - Função a ser chamada quando o valor muda
 * @param {number} throttleDelay - Delay do throttle em ms (padrão: 100ms)
 */
function configurarSliderComThrottle(slider, callback, throttleDelay = 100) {
    if (!slider || typeof callback !== 'function') return;
    
    // Evento input com throttle (durante o movimento)
    slider.addEventListener('input', throttle(callback, throttleDelay));
    
    // Evento change sem throttle (quando o usuário solta o slider)
    // Garante que o valor final seja sempre atualizado
    slider.addEventListener('change', callback);
}

// ============================================
// CACHE DE SELETORES DOM
// ============================================

/**
 * Cache simples de seletores DOM para evitar múltiplas consultas
 * Armazena elementos já buscados para reutilização
 */
const DOMCache = {
    _cache: new Map(),
    
    /**
     * Obtém elemento do cache ou busca e armazena
     * @param {string} selector - Seletor CSS ou ID
     * @param {boolean} useQuerySelector - Se true, usa querySelector; senão, getElementById
     * @returns {HTMLElement|null} Elemento encontrado ou null
     */
    get(selector, useQuerySelector = false) {
        const key = useQuerySelector ? `qs:${selector}` : `id:${selector}`;
        
        if (this._cache.has(key)) {
            const cached = this._cache.get(key);
            // Verifica se o elemento ainda existe no DOM
            if (cached && document.contains(cached)) {
                return cached;
            } else {
                // Remove do cache se não existe mais
                this._cache.delete(key);
            }
        }
        
        const element = useQuerySelector 
            ? document.querySelector(selector)
            : document.getElementById(selector);
        
        if (element) {
            this._cache.set(key, element);
        }
        
        return element;
    },
    
    /**
     * Limpa o cache (útil quando elementos são removidos do DOM)
     */
    clear() {
        this._cache.clear();
    },
    
    /**
     * Remove um elemento específico do cache
     * @param {string} selector - Seletor usado para armazenar
     * @param {boolean} useQuerySelector - Se true, usa querySelector; senão, getElementById
     */
    remove(selector, useQuerySelector = false) {
        const key = useQuerySelector ? `qs:${selector}` : `id:${selector}`;
        this._cache.delete(key);
    }
};

// ============================================
// FUNÇÃO GLOBAL DE INTERNACIONALIZAÇÃO (i18n)
// ============================================

/**
 * Função global para trocar idioma e atualizar elementos com data-i18n
 * Centraliza a lógica de i18n que estava duplicada em cada app
 * @param {string} novoIdioma - Novo idioma ('pt-BR' ou 'it-IT')
 * @param {Object} traducoes - Objeto com traduções { 'pt-BR': {...}, 'it-IT': {...} }
 * @param {Function} callback - Função opcional chamada após trocar idioma
 */
function trocarIdiomaGlobal(novoIdioma, traducoes, callback) {
    if (!novoIdioma || !traducoes || !traducoes[novoIdioma]) {
        console.warn('⚠️ Idioma ou traduções inválidos:', novoIdioma);
        return;
    }
    
    // Salva o idioma no localStorage
    const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) 
        ? SiteConfig.LOCAL_STORAGE 
        : { LANGUAGE_KEY: 'idiomaPreferido' };
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // Atualiza elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza placeholders com data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n-placeholder');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.placeholder = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza botões de idioma (adiciona classe 'active' ao botão do idioma atual)
    document.querySelectorAll(SiteConfig.SELECTORS.LANG_BTN).forEach(btn => {
        const langBtn = btn.getAttribute('data-lang');
        if (langBtn === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Voltar para a tela inicial';
    document.querySelectorAll(SiteConfig.SELECTORS.HOME_BUTTON).forEach(el => {
        el.setAttribute('aria-label', homeLabel);
    });
    
    // Chama callback se fornecido (para atualizações específicas do app)
    if (typeof callback === 'function') {
        callback(novoIdioma);
    }
}

// ============================================
// INICIALIZAÇÃO PADRÃO DE EVENT LISTENERS
// ============================================

/**
 * Inicializa event listeners padrão (botões de idioma e home)
 * Centraliza código repetido em cada app
 * @param {Object} traducoes - Objeto com traduções
 * @param {Function} trocarIdiomaCallback - Função para trocar idioma (pode usar trocarIdiomaGlobal)
 */
function inicializarEventListenersPadrao(traducoes, trocarIdiomaCallback) {
    // Botão Português
    const btnPT = DOMCache.get('btnPortugues');
    if (btnPT) {
        btnPT.addEventListener('click', () => {
            if (trocarIdiomaCallback) {
                trocarIdiomaCallback('pt-BR');
            } else if (traducoes) {
                trocarIdiomaGlobal('pt-BR', traducoes);
            }
        });
    }
    
    // Botão Italiano
    const btnIT = DOMCache.get('btnItaliano');
    if (btnIT) {
        btnIT.addEventListener('click', () => {
            if (trocarIdiomaCallback) {
                trocarIdiomaCallback('it-IT');
            } else if (traducoes) {
                trocarIdiomaGlobal('it-IT', traducoes);
            }
        });
    }
}

// ============================================
// LAZY LOADING DE BIBLIOTECAS EXTERNAS
// ============================================

/**
 * Carrega Chart.js dinamicamente apenas quando necessário
 * Melhora o tempo de carregamento inicial da página
 * @param {Function} callback - Função chamada após Chart.js ser carregado
 * @param {Array<string>} plugins - Array opcional de plugins do Chart.js para carregar
 * @returns {Promise} Promise que resolve quando Chart.js está carregado
 */
function carregarChartJS(callback, plugins = []) {
    return new Promise((resolve, reject) => {
        // Se Chart.js já está carregado, executa callback imediatamente
        if (typeof Chart !== 'undefined') {
            if (callback) callback();
            resolve();
            return;
        }
        
        // Prevenir carregamento automático de source maps
        // Isso evita erros de CSP quando o Chart.js tenta carregar .map files
        const originalSourceMapSupport = window.SourceMapSupport;
        if (typeof window.SourceMapSupport !== 'undefined') {
            window.SourceMapSupport = undefined;
        }
        
        // Carrega Chart.js
        const script = document.createElement('script');
        script.src = SiteConfig.ASSETS.CHARTJS_CDN;
        script.async = true;
        script.crossOrigin = 'anonymous'; // Permite CORS para evitar problemas
        
        script.onload = () => {
            // Carrega plugins se especificados
            if (plugins.length > 0) {
                let pluginsLoaded = 0;
                plugins.forEach(pluginUrl => {
                    const pluginScript = document.createElement('script');
                    pluginScript.src = pluginUrl;
                    pluginScript.async = true;
                    pluginScript.onload = () => {
                        pluginsLoaded++;
                        if (pluginsLoaded === plugins.length) {
                            if (callback) callback();
                            resolve();
                        }
                    };
                    pluginScript.onerror = () => {
                        console.warn('⚠️ Erro ao carregar plugin do Chart.js:', pluginUrl);
                        pluginsLoaded++;
                        if (pluginsLoaded === plugins.length) {
                            if (callback) callback();
                            resolve();
                        }
                    };
                    document.head.appendChild(pluginScript);
                });
            } else {
                if (callback) callback();
                resolve();
            }
        };
        
        script.onerror = () => {
            console.error('❌ Erro ao carregar Chart.js');
            reject(new Error('Falha ao carregar Chart.js'));
        };
        
        document.head.appendChild(script);
    });
}

// ============================================
// FUNÇÃO GLOBAL MELHORADA: AJUSTAR VALOR DE SLIDER COM ACELERAÇÃO
// ============================================

/**
 * Ajusta o valor de um slider usando botões de seta com aceleração variável
 * 
 * Esta função melhora a experiência do usuário ao:
 * - Forçar valores min/max quando o slider está no fim do curso
 * - Atualizar valores com maior frequência (reduz lag)
 * - Implementar aceleração variável: lento no primeiro segundo, rápido nos outros dois
 * - Percorrer todo o range do slider em 3 segundos quando o botão é pressionado
 * 
 * @param {string} targetId - ID do elemento slider a ser ajustado
 * @param {number} step - Valor do incremento/decremento (positivo para aumentar, negativo para diminuir)
 * @param {Object} options - Opções adicionais (opcional)
 * @param {Function} options.onUpdate - Função chamada a cada atualização (opcional)
 */
function ajustarValorSlider(targetId, step, options = {}) {
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    // Usa 0 como mínimo se slider.min for 0 (importante para sliders que começam em 0)
    const minRaw = parseFloat(slider.min);
    const min = isNaN(minRaw) ? 1 : minRaw; // Permite 0 como mínimo válido
    const max = parseFloat(slider.max) || 100;
    const stepAttr = parseFloat(slider.step) || 1;
    
    let valorAtual = parseFloat(slider.value);
    // Se valorAtual for NaN, usa o mínimo (pode ser 0)
    if (isNaN(valorAtual)) {
        valorAtual = min;
    }
    
    // Se step for string (ex: "dynamic", "-dynamic"), precisa ser tratado pela função customizada
    // Aqui assumimos que step já foi convertido para número
    if (typeof step === 'string') {
        console.warn('ajustarValorSlider: step deve ser número. Use função customizada para steps dinâmicos.');
        return;
    }
    
    // Calcula o novo valor
    let novoValor = valorAtual + step;
    
    // Arredonda para o múltiplo mais próximo do step
    novoValor = Math.round(novoValor / stepAttr) * stepAttr;
    
    // Garante que está dentro dos limites (mas permite movimento mesmo próximo dos limites)
    novoValor = Math.max(min, Math.min(max, novoValor));
    
    // NÃO força valores min/max quando próximo do fim do curso
    // Isso permite que o usuário continue ajustando mesmo quando próximo dos limites
    // A detecção de limite é feita na função de repetição, não aqui
    
    // Atualiza o valor do slider
    slider.value = novoValor;
    
    // Dispara evento input imediatamente (sem throttle para reduzir lag)
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Chama callback se fornecido
    if (typeof options.onUpdate === 'function') {
        options.onUpdate(novoValor);
    }
}

/**
 * Configura botões de seta com aceleração variável para sliders
 * 
 * Quando o botão é pressionado e mantido:
 * - Primeiro segundo: ajusta lentamente (a cada 200ms)
 * - Segundos 2-3: ajusta rapidamente (a cada 50ms, depois 30ms)
 * - Percorre todo o range do slider em aproximadamente 3 segundos
 * 
 * @param {string} buttonSelector - Seletor CSS dos botões de seta (ex: '.arrow-btn')
 * @param {Function} customAdjustFn - Função customizada de ajuste (opcional, usa ajustarValorSlider por padrão)
 */
function configurarBotoesSliderComAceleracao(buttonSelector, customAdjustFn = null) {
    const buttons = document.querySelectorAll(buttonSelector);
    
    buttons.forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;
        
        let intervalId = null;
        let timeoutId = null;
        let startTime = null;
        let isActive = false;
        
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        // Obtém o step do atributo (pode ser número ou string como "dynamic")
        let step = btn.getAttribute('data-step');
        // Se não for "dynamic" ou "-dynamic", converte para número
        if (step !== 'dynamic' && step !== '-dynamic') {
            step = parseFloat(step) || 1;
        }
        
        // Usa 0 como mínimo se slider.min for 0 (importante para sliders que começam em 0)
        const minRaw = parseFloat(slider.min);
        const min = isNaN(minRaw) ? 1 : minRaw; // Permite 0 como mínimo válido
        const max = parseFloat(slider.max) || 100;
        const range = max - min;
        
        // Função de ajuste (usa customizada se fornecida, senão usa a padrão)
        const adjustFn = customAdjustFn || ((targetId, step) => {
            ajustarValorSlider(targetId, step);
        });
        
        // Função que calcula o intervalo baseado no tempo decorrido
        // Dobra a velocidade a cada segundo (reduz o intervalo pela metade)
        const getInterval = (elapsed) => {
            // Intervalo inicial: 200ms (lento)
            const intervaloInicial = 200;
            
            // Calcula quantos segundos se passaram
            const segundos = Math.floor(elapsed / 1000);
            
            // Dobra a velocidade a cada segundo (divide o intervalo por 2^segundos)
            // Exemplo:
            // 0-1s: 200ms / 2^0 = 200ms
            // 1-2s: 200ms / 2^1 = 100ms
            // 2-3s: 200ms / 2^2 = 50ms
            // 3-4s: 200ms / 2^3 = 25ms
            // 4-5s: 200ms / 2^4 = 12.5ms (arredondado para 13ms)
            // E assim por diante...
            const intervalo = intervaloInicial / Math.pow(2, segundos);
            
            // Limita o intervalo mínimo a 10ms para não sobrecarregar o navegador
            return Math.max(10, Math.round(intervalo));
        };
        
        // Função que inicia o ajuste repetitivo
        const startRepeating = () => {
            if (isActive) return;
            isActive = true;
            startTime = Date.now();
            
            // Ajusta imediatamente (primeira vez)
            adjustFn(targetId, step);
            
            // Variáveis para controle de aceleração dinâmica
            let lastInterval = 200;
            let lastAdjustTime = Date.now();
            let lastSecond = 0;
            
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
                let valorAntes = parseFloat(slider.value);
                if (isNaN(valorAntes)) valorAntes = min;
                
                // Ajusta o valor
                adjustFn(targetId, step);
                lastAdjustTime = now;
                
                // Verifica o valor depois do ajuste
                let valorDepois = parseFloat(slider.value);
                if (isNaN(valorDepois)) valorDepois = min;
                
                // Para apenas se o valor não mudou E está no limite
                // Isso permite movimento mesmo quando próximo dos limites
                if (valorAntes === valorDepois) {
                    // Verifica se step é positivo (aumentar) ou negativo (diminuir)
                    const stepNum = (step === 'dynamic') ? 1 : (step === '-dynamic') ? -1 : parseFloat(step) || 1;
                    if ((stepNum > 0 && valorDepois >= max) || (stepNum < 0 && valorDepois <= min)) {
                        stopRepeating();
                        return;
                    }
                }
            };
            
            // Inicia o intervalo com o intervalo inicial (200ms)
            intervalId = setInterval(doAdjust, 200);
        };
        
        // Função que para o ajuste repetitivo
        const stopRepeating = () => {
            isActive = false;
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            startTime = null;
        };
        
        // Event listeners para mouse
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startRepeating();
        });
        
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);
        
        // Event listeners para touch (mobile)
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRepeating();
        });
        
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
        
        // Previne contexto menu em long press (mobile)
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    });
}

// ============================================
// DETECÇÃO DE GESTOS TOUCH GLOBAL
// ============================================
// Esta funcionalidade diferencia scroll de interações com botões e sliders
// em dispositivos touch, melhorando a experiência do usuário

function setupGlobalTouchGestures() {
    // Verificar se já foi inicializado
    if (document.getElementById('global-touch-gestures-initialized')) return;
    
    // Verificar se o body existe
    if (!document.body) {
        // Tentar novamente após um pequeno delay
        setTimeout(setupGlobalTouchGestures, 50);
        return;
    }
    
    // Marcar como inicializado
    const marker = document.createElement('div');
    marker.id = 'global-touch-gestures-initialized';
    marker.style.display = 'none';
    document.body.appendChild(marker);
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchTarget = null;
    let isScrolling = false;
    let touchMoved = false;
    let touchMoveThreshold = 10; // pixels
    let tapMaxDuration = 300; // ms
    let scrollThreshold = 0.6; // 60% do movimento deve ser vertical para ser considerado scroll
    let buttonClickTimeout = null;
    
    document.addEventListener('touchstart', function(e) {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        touchTarget = e.target;
        touchMoved = false;
        isScrolling = false;
        
        // Limpar timeout anterior se houver
        if (buttonClickTimeout) {
            clearTimeout(buttonClickTimeout);
            buttonClickTimeout = null;
        }
        
        // Se tocou em um botão e ficou parado, preparar para acionar
        const isButton = touchTarget.tagName === 'BUTTON' || 
                       touchTarget.classList.contains('arrow-btn') ||
                       (touchTarget.onclick !== null && touchTarget.onclick !== undefined);
        
        if (isButton) {
            // Aguardar um pouco para ver se vai mover (para scroll) ou ficar parado (para click)
            buttonClickTimeout = setTimeout(function() {
                if (!touchMoved && touchTarget === e.target) {
                    // Toque parado sobre botão - acionar
                    touchTarget.click();
                }
            }, 150); // Aguarda 150ms para ver se move
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        const totalDelta = deltaX + deltaY;
        
        // Se moveu mais que o threshold, considera movimento
        if (totalDelta > touchMoveThreshold) {
            touchMoved = true;
            
            // Cancelar click de botão se moveu
            if (buttonClickTimeout) {
                clearTimeout(buttonClickTimeout);
                buttonClickTimeout = null;
            }
            
            // Determinar se é scroll (movimento majoritariamente vertical)
            if (totalDelta > 0) {
                const verticalRatio = deltaY / totalDelta;
                
                if (verticalRatio > scrollThreshold) {
                    // Movimento majoritariamente vertical = SCROLL
                    isScrolling = true;
                    
                    // Se o target é um botão ou slider, prevenir ação padrão
                    if (touchTarget) {
                        const isButton = touchTarget.tagName === 'BUTTON' || 
                                       touchTarget.classList.contains('arrow-btn') ||
                                       (touchTarget.onclick !== null && touchTarget.onclick !== undefined);
                        const isSlider = touchTarget.tagName === 'INPUT' && 
                                       touchTarget.type === 'range';
                        
                        if (isButton || isSlider) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                } else {
                    // Movimento majoritariamente horizontal
                    isScrolling = false;
                    
                    // Se for slider, permitir movimento horizontal
                    if (touchTarget && touchTarget.tagName === 'INPUT' && touchTarget.type === 'range') {
                        // Calcular posição do slider baseado na posição X do toque
                        const slider = touchTarget;
                        const rect = slider.getBoundingClientRect();
                        const sliderWidth = rect.width;
                        const touchX = touch.clientX - rect.left;
                        const min = parseFloat(slider.min) || 0;
                        const max = parseFloat(slider.max) || 100;
                        const percentage = Math.max(0, Math.min(1, touchX / sliderWidth));
                        const newValue = min + (max - min) * percentage;
                        
                        // Atualizar valor do slider
                        slider.value = newValue;
                        
                        // Disparar evento input
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                        slider.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // Prevenir scroll durante movimento do slider
                        e.preventDefault();
                        e.stopPropagation();
                    } else {
                        // Para outros elementos, prevenir se for botão
                        if (touchTarget && (touchTarget.tagName === 'BUTTON' || touchTarget.classList.contains('arrow-btn'))) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                }
            }
        }
    }, { passive: false });
    
    document.addEventListener('touchend', function(e) {
        // Cancelar timeout de click de botão
        if (buttonClickTimeout) {
            clearTimeout(buttonClickTimeout);
            buttonClickTimeout = null;
        }
        
        const touchDuration = Date.now() - touchStartTime;
        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        const totalDelta = deltaX + deltaY;
        
        // Determinar tipo de gesto
        if (!touchMoved || totalDelta < touchMoveThreshold) {
            // TAP RÁPIDO - sempre acionar (botões, sliders, etc)
            if (touchDuration < tapMaxDuration) {
                // Para sliders, mover para posição do toque
                if (touchTarget && touchTarget.tagName === 'INPUT' && touchTarget.type === 'range') {
                    const slider = touchTarget;
                    const rect = slider.getBoundingClientRect();
                    const sliderWidth = rect.width;
                    const touchX = touch.clientX - rect.left;
                    const min = parseFloat(slider.min) || 0;
                    const max = parseFloat(slider.max) || 100;
                    const percentage = Math.max(0, Math.min(1, touchX / sliderWidth));
                    const newValue = min + (max - min) * percentage;
                    
                    slider.value = newValue;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    e.preventDefault();
                    e.stopPropagation();
                }
                // Para outros elementos, permitir ação padrão (click)
                return;
            }
        } else if (touchMoved && !isScrolling) {
            // Movimento horizontal - ação já foi tratada no touchmove
            if (touchTarget && touchTarget.tagName === 'INPUT' && touchTarget.type === 'range') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        } else if (isScrolling) {
            // SCROLL - prevenir ações de botões/sliders
            if (touchTarget) {
                const isButton = touchTarget.tagName === 'BUTTON' || 
                               touchTarget.classList.contains('arrow-btn');
                const isSlider = touchTarget.tagName === 'INPUT' && 
                               touchTarget.type === 'range';
                
                if (isButton || isSlider) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }
        }
        
        // Reset
        touchStartX = 0;
        touchStartY = 0;
        touchStartTime = 0;
        touchTarget = null;
        touchMoved = false;
        isScrolling = false;
    }, { passive: false });
    
    document.addEventListener('touchcancel', function(e) {
        // Reset em caso de cancelamento
        if (buttonClickTimeout) {
            clearTimeout(buttonClickTimeout);
            buttonClickTimeout = null;
        }
        touchStartX = 0;
        touchStartY = 0;
        touchStartTime = 0;
        touchTarget = null;
        touchMoved = false;
        isScrolling = false;
    });
}

// Inicializar gestos touch globalmente
(function() {
    'use strict';
    try {
        // Verificar se não está em iframe
        if (typeof window === 'undefined' || window.self !== window.top) {
            return; // Está em iframe, não executar
        }
        // Função para inicializar gestos
        var initGestures = function() {
            try {
                if (typeof setupGlobalTouchGestures === 'function') {
                    setupGlobalTouchGestures();
                }
            } catch (e) {
                // Silenciosamente ignorar erros
            }
        };
        // Inicializar quando o DOM estiver pronto
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initGestures);
            } else {
                // DOM já está pronto
                initGestures();
            }
            // Também tentar inicializar após um pequeno delay
            setTimeout(function() {
                try {
                    if (document.body && typeof document.getElementById === 'function' && 
                        !document.getElementById('global-touch-gestures-initialized')) {
                        initGestures();
                    }
                } catch (e) {
                    // Silenciosamente ignorar erros
                }
            }, 100);
        }
    } catch (e) {
        // Silenciosamente ignorar todos os erros para não quebrar o carregamento
    }
})();

// ============================================
// VALIDAÇÃO DE DEPENDÊNCIAS
// ============================================
/**
 * Valida se dependências necessárias estão disponíveis
 * Útil para verificar se funções/objetos globais necessários foram carregados
 * 
 * @param {Object} dependencias - Objeto com nomes das dependências e tipos esperados
 * @param {Object} opcoes - Opções de validação
 * @param {boolean} opcoes.mostrarErros - Se true, mostra erros no console (padrão: true)
 * @param {boolean} opcoes.lancarErro - Se true, lança exceção quando dependência não encontrada (padrão: false)
 * @returns {Object} Objeto com resultado da validação { valido: boolean, faltando: Array<string> }
 * 
 * @example
 * // Validar dependências básicas
 * const resultado = validarDependencias({
 *     'formatarNumero': 'function',
 *     'SiteConfig': 'object',
 *     'Chart': 'object' // Chart.js
 * });
 * 
 * if (!resultado.valido) {
 *     console.error('Dependências faltando:', resultado.faltando);
 * }
 * 
 * @example
 * // Validar com tratamento de erro
 * const resultado = validarDependencias({
 *     'formatarNumero': 'function',
 *     'FAZENDA_DATABASE': 'object'
 * }, { lancarErro: true });
 */
function validarDependencias(dependencias, opcoes = {}) {
    const config = {
        mostrarErros: opcoes.mostrarErros !== false,
        lancarErro: opcoes.lancarErro === true
    };
    
    const faltando = [];
    const tipoIncorreto = [];
    
    for (const [nome, tipoEsperado] of Object.entries(dependencias)) {
        // Verifica se existe no escopo global
        const existe = typeof window !== 'undefined' && nome in window;
        
        if (!existe) {
            faltando.push(nome);
            continue;
        }
        
        // Verifica tipo
        const tipoReal = typeof window[nome];
        if (tipoReal !== tipoEsperado) {
            tipoIncorreto.push({ nome, esperado: tipoEsperado, real: tipoReal });
        }
    }
    
    const valido = faltando.length === 0 && tipoIncorreto.length === 0;
    
    if (!valido && config.mostrarErros) {
        if (faltando.length > 0) {
            console.error(`[Validação] Dependências não encontradas: ${faltando.join(', ')}`);
        }
        if (tipoIncorreto.length > 0) {
            tipoIncorreto.forEach(({ nome, esperado, real }) => {
                console.error(`[Validação] Tipo incorreto para '${nome}': esperado '${esperado}', encontrado '${real}'`);
            });
        }
    }
    
    if (!valido && config.lancarErro) {
        const mensagem = [
            faltando.length > 0 ? `Dependências não encontradas: ${faltando.join(', ')}` : '',
            tipoIncorreto.length > 0 ? `Tipos incorretos: ${tipoIncorreto.map(t => `${t.nome} (esperado: ${t.esperado}, real: ${t.real})`).join(', ')}` : ''
        ].filter(Boolean).join(' | ');
        
        throw new Error(`Validação de dependências falhou: ${mensagem}`);
    }
    
    return {
        valido,
        faltando,
        tipoIncorreto: tipoIncorreto.map(t => t.nome),
        todas: Object.keys(dependencias)
    };
}

// Exportar para uso global (se necessário)
if (typeof window !== 'undefined') {
    window.validarDependencias = validarDependencias;
}

// ============================================
// INICIALIZAÇÃO DE ÍCONES DE INFORMAÇÃO
// ============================================
/**
 * Inicializa um ícone de informação com descrição toggle
 * Padroniza o comportamento de mostrar/esconder descrições em todos os apps
 *
 * @param {string} iconId - ID do elemento do ícone de informação
 * @param {string} descricaoId - ID do elemento da descrição
 * @param {Object} opcoes - Opções de configuração
 * @param {boolean} opcoes.inicialmenteVisivel - Se true, descrição começa visível (padrão: false)
 *
 * @example
 * // Inicializar ícone de informação padrão
 * inicializarIconeInfo('infoIconAutonomia', 'descricaoAutonomia');
 *
 * @example
 * // Inicializar com descrição inicialmente visível
 * inicializarIconeInfo('infoIconConsumo', 'descricaoConsumo', { inicialmenteVisivel: true });
 */
function inicializarIconeInfo(iconId, descricaoId, opcoes = {}) {
    const config = {
        inicialmenteVisivel: opcoes.inicialmenteVisivel === true
    };

    const infoIcon = document.getElementById(iconId);
    const descricao = document.getElementById(descricaoId);

    if (!infoIcon || !descricao) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[inicializarIconeInfo] Elementos não encontrados: iconId="${iconId}", descricaoId="${descricaoId}"`);
        }
        return;
    }

    // Configurar estado inicial
    if (!config.inicialmenteVisivel) {
        descricao.style.display = 'none';
    }

    const toggleDescricao = () => {
        const estaVisivel = descricao.style.display !== 'none';
        if (estaVisivel) {
            descricao.style.display = 'none';
        } else {
            descricao.style.display = 'block';
        }
    };

    // Toggle ao clicar
    infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDescricao();
    });

    // Toggle ao pressionar Enter ou Espaço (acessibilidade)
    infoIcon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleDescricao();
        }
    });
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.inicializarIconeInfo = inicializarIconeInfo;
}