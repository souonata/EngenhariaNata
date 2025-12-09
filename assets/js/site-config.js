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
            CHARTJS_CDN: 'https://cdn.jsdelivr.net/npm/chart.js'  // URL da biblioteca de gráficos Chart.js
        },

        // UI: Configurações da interface do usuário
        UI: {
            INPUT_PADDING_CHARS: 2,               // Caracteres de folga para inputs dinâmicos
            INPUT_MIN_WIDTH: 50,                  // Largura mínima de inputs em pixels
            SCROLL_BEHAVIOR: 'smooth',            // Comportamento de scroll (smooth ou auto)
            ANIMATION_DURATION: 300               // Duração padrão de animações em ms
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
 * @param {string} valorFormatado - Valor formatado como string
 * @returns {number} Valor numérico
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
    medida.style.visibility = 'hidden';
    medida.style.position = 'absolute';
    medida.style.whiteSpace = 'pre';
    medida.style.font = window.getComputedStyle(input).font;
    medida.style.padding = window.getComputedStyle(input).padding;
    medida.style.border = window.getComputedStyle(input).border;
    medida.style.boxSizing = window.getComputedStyle(input).boxSizing;
    
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
