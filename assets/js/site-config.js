// ============================================
// CONFIGURAÇÃO GLOBAL DO SITE
// ============================================
// Este arquivo centraliza todas as configurações que são usadas
// por várias páginas do portfólio. Isso evita repetir o mesmo
// código em cada arquivo e facilita manutenção.
//
// Por que centralizar?
// - Se precisar mudar o nome de uma chave do localStorage, muda só aqui
// - Se precisar ajustar valores padrão, muda só aqui
// - Todos os arquivos usam as mesmas configurações, evitando erros
// ============================================

// Função que cria um objeto isolado (IIFE - Immediately Invoked Function Expression)
// Isso evita que as variáveis dentro poluam o escopo global
(function(global){
    // 'use strict' força o JavaScript a ser mais rigoroso
    // e ajuda a evitar erros comuns
    'use strict';

    // Objeto principal com todas as configurações
    // Mantemos os nomes em inglês para compatibilidade com o código existente
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
            BUTTON_ACTION: '.btn-acao'            // Botões de ação genéricos
        },

        // ASSETS: Caminhos e URLs de recursos externos
        ASSETS: {
            CSS_BASE: 'assets/css/',              // Pasta onde ficam os arquivos CSS
            JS_BASE: 'assets/js/',                // Pasta onde ficam os arquivos JavaScript
            CHARTJS_CDN: 'https://cdn.jsdelivr.net/npm/chart.js'  // URL da biblioteca de gráficos Chart.js
        },

        // UI: Configurações da interface do usuário
        UI: {
        }
    };

    // Tenta tornar o objeto somente leitura (não pode ser modificado depois)
    // Se der erro (navegadores antigos), usa o objeto normal
    try { 
        // Object.freeze() impede que o objeto seja modificado
        global.SiteConfig = Object.freeze(SiteConfig); 
    } catch(erro){ 
        // Se der erro, usa o objeto sem proteção (compatibilidade)
        global.SiteConfig = SiteConfig; 
    }
    
    // Agora o objeto está disponível globalmente como window.SiteConfig
    // Outros arquivos podem usar: SiteConfig.PADROES.idioma, etc.
})(window);

// ============================================
// FUNÇÃO GLOBAL: AJUSTAR TAMANHO DINÂMICO DE INPUTS
// ============================================
/**
 * Ajusta dinamicamente a largura de um input baseado no seu conteúdo
 * Adiciona 2 caracteres de folga ao tamanho atual do texto
 * @param {HTMLElement|string} input - Elemento input ou ID do input
 * @param {number} folgaCaracteres - Número de caracteres de folga (padrão: 2)
 */
function ajustarTamanhoInput(input, folgaCaracteres = 2) {
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
    
    // Aplica a largura ao input (com mínimo de 50px para não ficar muito pequeno)
    const larguraMinima = 50;
    input.style.width = Math.max(larguraNecessaria, larguraMinima) + 'px';
}
