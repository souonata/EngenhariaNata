// Configuração global do site
// Centraliza constantes, seletores e funções utilitárias

(function(global){
    'use strict';

    const SiteConfig = {
        // Chaves do localStorage
        LOCAL_STORAGE: {
            LANGUAGE_KEY: 'idiomaPreferido',
            SOLAR_CONFIG_KEY: 'configSolar'
        },

        // Valores padrão
        DEFAULTS: {
            language: 'pt-BR',
            TAXA_BRL_EUR: 6.19,
            BATTERY: {
                LFP_MAX_KG: 180,
                AGM_MAX_KG: 180,
                DEFAULT_LFP_KWH: 4.8,
                DEFAULT_AGM_KWH: 1.2
            },
            INVERTER_MIN_KW: 1
        },

        // Seletores CSS
        SELECTORS: {
            HOME_BUTTON: '.home-button-fixed',
            LANG_BTN: '.lang-btn',
            APP_ICON: '.app-icon',
            ARROW_BTN: '.arrow-btn',
            BUTTON_ACTION: '.btn-acao',
            LANGUAGE_SELECTOR: '.language-selector'
        },

        // Caminhos de recursos
        ASSETS: {
            CSS_BASE: 'assets/css/',
            JS_BASE: 'assets/js/',
            CHARTJS_CDN: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
        },

        // Configurações de interface
        UI: {
            INPUT_PADDING_CHARS: 2,
            INPUT_MIN_WIDTH: 50,
            SCROLL_BEHAVIOR: 'smooth',
            ANIMATION_DURATION: 300,
            DEBOUNCE_DELAY: 300,
            THROTTLE_DELAY: 100
        },

        // Configurações de formatação
        FORMATTING: {
            LOCALE_PT: 'pt-BR',
            LOCALE_IT: 'it-IT',
            DECIMAL_SEPARATOR_PT: ',',
            THOUSANDS_SEPARATOR_PT: '.',
            DECIMAL_SEPARATOR_IT: ',',
            THOUSANDS_SEPARATOR_IT: '.'
        },

        // Moedas
        CURRENCY: {
            BRL: 'BRL',
            EUR: 'EUR',
            BRL_SYMBOL: 'R$',
            EUR_SYMBOL: '€'
        }
    };

    // Torna objeto imutável
    try { 
        global.SiteConfig = Object.freeze(SiteConfig); 
    } catch(erro){ 
        global.SiteConfig = SiteConfig; 
    }
    
    // Agora o objeto está disponível globalmente como window.SiteConfig
    // Outros arquivos podem usar: SiteConfig.DEFAULTS.language, etc.
})(window);
// FUNÇÕES GLOBAIS DE FORMATAÇÃO DE NÚMEROS
// Formata número com casas decimais usando formatação brasileira
function formatarNumero(valor, casasDecimais = 0) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    return valor.toLocaleString(SiteConfig.FORMATTING.LOCALE_PT, {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais,
        useGrouping: true
    });
}
// Formata número com casas decimais (formato brasileiro)
function formatarNumeroDecimal(valor, casasDecimais = 1) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    return valor.toLocaleString(SiteConfig.FORMATTING.LOCALE_PT, {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais,
        useGrouping: true
    });
}
// Alias para formatarNumero (compatibilidade)
function formatarNumeroBR(valor, casasDecimais = 0) {
    return formatarNumero(valor, casasDecimais);
}
// Converte string formatada para número (aceita BR e internacional)
function converterValorFormatadoParaNumero(valorFormatado) {
    if (!valorFormatado) return 0;
    let valorTexto = String(valorFormatado).trim();
    
    // Formato brasileiro com ambos separadores
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
        if (partes.length > 2) {
            valorTexto = valorTexto.replace(/\./g, '');
        }
        else if (partes.length === 2) {
            if (partes[1].length === 3) {
                valorTexto = valorTexto.replace(/\./g, '');
            }
            else if (partes[1].length <= 2) {
                // Mantém como decimal
            }
            else {
                valorTexto = valorTexto.replace(/\./g, '');
            }
        }
    }
    
    return parseFloat(valorTexto) || 0;
}
// Converte string formatada para número (detecta decimal vs milhares)
function obterValorNumericoFormatado(valorFormatado) {
    if (!valorFormatado) return 0;
    
    let valor = valorFormatado.toString().trim();
    
    // Vírgula = separador decimal BR
    if (valor.indexOf(',') !== -1) {
        valor = valor.replace(/\./g, '');
        valor = valor.replace(',', '.');
        return parseFloat(valor) || 0;
    }
    
    // Ponto - determina se é decimal ou milhares
    if (valor.indexOf('.') !== -1) {
        const partes = valor.split('.');
        
        // Se há mais de 2 partes, é formato com milhares
        if (partes.length > 2) { // Remove todos os pontos (milhares)
            valor = valor.replace(/\./g, '');
            return parseFloat(valor) || 0;
        }
        
        // Se há exatamente 2 partes
        if (partes.length === 2) { // Se segunda parte tem 1-2 dígitos, é separador decimal
            if (partes[1].length <= 2 && partes[1].match(/^\d+$/)) {
                // Mantém o ponto como separador decimal (já está no formato correto para parseFloat)
                return parseFloat(valor) || 0;
            } // Se segunda parte tem 3 dígitos, precisa analisar melhor
            if (partes[1].length === 3) { // Se primeira parte tem 1-3 dígitos e o valor total é pequeno (< 100), 
                // provavelmente é decimal
                const valorTeste = parseFloat(valor);
                if (partes[0].length <= 3 && valorTeste < 100) {
                    // Trata como decimal
                    return valorTeste || 0;
                } // Se primeira parte tem mais de 3 dígitos ou valor >= 100, 
                // provavelmente é milhares // Remove o ponto (milhares)
                valor = valor.replace(/\./g, '');
                return parseFloat(valor) || 0;
            } // Se segunda parte tem mais de 3 dígitos, remove o ponto (milhares)
            valor = valor.replace(/\./g, '');
            return parseFloat(valor) || 0;
        }
    }
    
    // Se não tem nem vírgula nem ponto, já está no formato correto
    return parseFloat(valor) || 0;
}
// Formata potência com sufixo "k" para valores >= 1000
function formatarPotencia(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-'; // Se valor for menor que 1000, formata normalmente
    if (valor < 1000) {
        return formatarNumero(valor, 0);
    }
    
    // Se for >= 1000, divide por 1000 e adiciona "k"
    const valorK = valor / 1000;
    
    // Se for um número inteiro, não mostra decimais
    if (valorK % 1 === 0) {
        return valorK + 'k';
    }
    
    // Caso contrário, mostra uma casa decimal
    return formatarNumeroDecimal(valorK, 1) + 'k';
}
// Formata potência em W ou kW conforme o valor
function formatarPotenciaWkW(valor_W) {
    if (isNaN(valor_W) || valor_W === null || valor_W === undefined) return '-';
    if (valor_W >= 1000) {
        return formatarNumeroDecimal(valor_W / 1000, 1) + ' kW';
    }
    return formatarNumero(Math.round(valor_W)) + ' W';
}
// Formata números com sufixos k, M ou m
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
// Converte valor formatado com sufixos (k/M/m) de volta para número
function obterValorNumericoComSufixo(valorFormatado) {
    if (!valorFormatado || typeof valorFormatado !== 'string') return 0;
    
    const valor = valorFormatado.toString().trim();
    if (valor === '' || valor === '-') return 0; // Remove espaços e converte para minúsculo para verificar sufixos
    const valorLower = valor.toLowerCase(); // Verifica termina com sufixo
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
        const valorNum = parseFloat(valorTesteNormalizado); // Se valor antes do sufixo for >= 1, provavelmente é mega (M maiúsculo)
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
    const valorNormalizado = valorSemSufixo.replace(',', '.'); // Remove qualquer caractere que não seja número, ponto ou sinal negativo
    const valorLimpo = valorNormalizado.replace(/[^\d.-]/g, '');
    
    // Converte para número
    const valorNumerico = parseFloat(valorLimpo);
    
    // Se não conseguiu converter, retorna 0
    if (isNaN(valorNumerico)) return 0;
    
    return valorNumerico * multiplicador;
}
// Formata números de forma compacta para gráficos
function formatarNumeroCompacto(valor) { // Se valor é maior ou igual a 1 milhão
    if (valor >= 1000000) {
        const valorEmMilhoes = (valor / 1000000).toFixed(1);
        return valorEmMilhoes.replace('.', ',') + 'M';
    } // Se valor é maior ou igual a 1 mil (mas menor que 1 milhão)
    else if (valor >= 1000) {
        const valorEmMilhares = (valor / 1000).toFixed(0);
        return valorEmMilhares + 'k';
    } // Se valor é menor que 1 mil, retorna como está (sem abreviação)
    return valor.toString();
}
// Formata valores monetários com 2 casas decimais
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
// Formata valores monetários sem casas decimais
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
// FUNÇÃO GLOBAL: AJUSTAR TAMANHO DINÂMICO DE INPUTS
// Ajusta dinamicamente a largura de um input baseado no seu conteúdo
function ajustarTamanhoInput(input, folgaCaracteres) {
    // Usa valor padrão do SiteConfig se não especificado
    if (folgaCaracteres === undefined) {
        folgaCaracteres = SiteConfig.UI.INPUT_PADDING_CHARS;
    }
    
    // Se recebeu string (ID), busca o elemento
    if (typeof input === 'string') {
        input = document.getElementById(input);
    } // elemento existe e é um input
    if (!input || input.tagName !== 'INPUT') {
        return;
    }
    
    // Cria um elemento temporário para medir o texto
    const medida = document.createElement('span');
    const inputStyle = window.getComputedStyle(input);
    medida.style.visibility = 'hidden';
    medida.style.position = 'absolute';
    medida.style.whiteSpace = 'pre';
    // Copia propriedades individuais de fonte ao invés da propriedade 'font' completa // problemas com CSP e fontes externas
    medida.style.fontFamily = inputStyle.fontFamily;
    medida.style.fontSize = inputStyle.fontSize;
    medida.style.fontWeight = inputStyle.fontWeight;
    medida.style.fontStyle = inputStyle.fontStyle;
    medida.style.fontVariant = inputStyle.fontVariant;
    medida.style.letterSpacing = inputStyle.letterSpacing;
    medida.style.padding = inputStyle.padding;
    medida.style.border = inputStyle.border;
    medida.style.boxSizing = inputStyle.boxSizing; // Adiciona o texto atual + caracteres de folga
    const textoAtual = input.value || input.placeholder || '';
    const caracteresFolga = 'M'.repeat(folgaCaracteres); // 'M' é geralmente o caractere mais largo
    medida.textContent = textoAtual + caracteresFolga; // Adiciona temporariamente ao DOM para medir
    document.body.appendChild(medida); // largura necessária
    const larguraNecessaria = medida.offsetWidth; // Remove o elemento temporário
    document.body.removeChild(medida);
    
    // Aplica a largura ao input (com mínimo configurado)
    const larguraMinima = SiteConfig.UI.INPUT_MIN_WIDTH;
    input.style.width = Math.max(larguraNecessaria, larguraMinima) + 'px';
}
// FUNÇÕES UTILITÁRIAS DE IDIOMA // idioma atual do localStorage ou usa o padrão
function obterIdiomaAtual() {
    const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
    return localStorage.getItem(SITE_LS.LANGUAGE_KEY) || SiteConfig.DEFAULTS.language;
} // moeda correspondente ao idioma atual
function obterMoedaPorIdioma(idioma) {
    if (!idioma) {
        idioma = obterIdiomaAtual();
    }
    return idioma === 'pt-BR' ? SiteConfig.CURRENCY.BRL : SiteConfig.CURRENCY.EUR;
} // símbolo da moeda correspondente ao idioma atual
function obterSimboloMoeda(idioma) {
    if (!idioma) {
        idioma = obterIdiomaAtual();
    }
    return idioma === 'pt-BR' ? SiteConfig.CURRENCY.BRL_SYMBOL : SiteConfig.CURRENCY.EUR_SYMBOL;
}
// FUNÇÕES DE PERFORMANCE: DEBOUNCE E THROTTLE
// Debounce: Executa a função apenas após um período de inatividade
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
// Throttle: Executa a função no máximo uma vez por período
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
// Configura um slider com eventos input (throttled) e change (sem throttle)
function configurarSliderComThrottle(slider, callback, throttleDelay = 100) {
    if (!slider || typeof callback !== 'function') return;
    
    // Evento input com throttle (durante o movimento)
    slider.addEventListener('input', throttle(callback, throttleDelay));
    
    // Evento change sem throttle (quando o usuário solta o slider)
    // Garante que o valor final seja sempre atualizado
    slider.addEventListener('change', callback);
}
// CACHE DE SELETORES DOM
// Cache simples de seletores DOM para evitar múltiplas consultas
const DOMCache = {
    _cache: new Map(),
    
    // Obtém elemento do cache ou busca e armazena
    get(selector, useQuerySelector = false) {
        const key = useQuerySelector ? `qs:${selector}` : `id:${selector}`;
        
        if (this._cache.has(key)) {
            const cached = this._cache.get(key); // elemento ainda existe no DOM
            if (cached && document.contains(cached)) {
                return cached;
            } else { // Remove do cache se não existe mais
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
    
    // Limpa o cache (útil quando elementos são removidos do DOM)
    clear() {
        this._cache.clear();
    },
    
    // Remove um elemento específico do cache
    remove(selector, useQuerySelector = false) {
        const key = useQuerySelector ? `qs:${selector}` : `id:${selector}`;
        this._cache.delete(key);
    }
};
// FUNÇÃO GLOBAL DE INTERNACIONALIZAÇÃO (i18n)
// Função global para trocar idioma e atualizar elementos com data
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
// INICIALIZAÇÃO PADRÃO DE EVENT LISTENERS
// Inicializa event listeners padrão (botões de idioma e home)
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
// LAZY LOADING DE BIBLIOTECAS EXTERNAS
// Carrega Chart.js dinamicamente apenas quando necessário
function carregarChartJS(callback, plugins = []) {
    return new Promise((resolve, reject) => {
        // Se Chart.js já está carregado, executa callback imediatamente
        if (typeof Chart !== 'undefined') {
            if (callback) callback();
            resolve();
            return;
        }
        
        // Prevenir carregamento automático de source maps // erros de CSP quando o Chart.js tenta carregar .map files
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
// FUNÇÃO GLOBAL MELHORADA: AJUSTAR VALOR DE SLIDER COM ACELERAÇÃO
// Ajusta o valor de um slider usando botões de seta com aceleração variável
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
    
    // Se step for string, precisa ser tratado pela função customizada
    // Aqui assumimos que step já foi convertido para número
    if (typeof step === 'string') {
        console.warn('ajustarValorSlider: step deve ser número. Use função customizada para steps dinâmicos.');
        return;
    } // novo valor
    let novoValor = valorAtual + step;
    
    // Arredonda para o múltiplo mais próximo do step
    novoValor = Math.round(novoValor / stepAttr) * stepAttr;
    
    // Garante que está dentro dos limites (mas permite movimento mesmo próximo dos limites)
    novoValor = Math.max(min, Math.min(max, novoValor));
    
    // NÃO força valores min/max quando próximo do fim do curso // que o usuário continue ajustando mesmo quando próximo dos limites
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
// Configura botões de seta com aceleração variável para sliders
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
        if (!slider) return; // step do atributo (pode ser número ou string como "dynamic")
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
        
        // Função de ajuste (usa customizada se fornecida ou usa a padrão)
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
                } // valor antes do ajuste
                let valorAntes = parseFloat(slider.value);
                if (isNaN(valorAntes)) valorAntes = min;
                
                // Ajusta o valor
                adjustFn(targetId, step);
                lastAdjustTime = now; // valor depois do ajuste
                let valorDepois = parseFloat(slider.value);
                if (isNaN(valorDepois)) valorDepois = min;
                
                // Para apenas se o valor não mudou E está no limite // movimento mesmo quando próximo dos limites
                if (valorAntes === valorDepois) { // Verifica step é positivo (aumentar) ou negativo (diminuir)
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
// DETECÇÃO DE GESTOS TOUCH GLOBAL
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
                    isScrolling = true; // Se target é um botão ou slider, prevenir ação padrão
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
// VALIDAÇÃO DE DEPENDÊNCIAS
// Valida se dependências necessárias estão disponíveis
function validarDependencias(dependencias, opcoes = {}) {
    const config = {
        mostrarErros: opcoes.mostrarErros !== false,
        lancarErro: opcoes.lancarErro === true
    };
    
    const faltando = [];
    const tipoIncorreto = [];
    
    for (const [nome, tipoEsperado] of Object.entries(dependencias)) { // Verifica existe no escopo global
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
// INICIALIZAÇÃO DE ÍCONES DE INFORMAÇÃO
// Inicializa um ícone de informação com descrição toggle
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