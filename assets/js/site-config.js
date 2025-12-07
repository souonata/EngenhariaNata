(/*
 assets/js/site-config.js — Configuração global do site (explicação didática)
 ------------------------------------------------------------------------
 Este arquivo centraliza constantes e referências que são usadas por várias
 páginas e scripts do portfólio. Ele é projetado para carregar cedo e ser
 independente de outras dependências (pequeno e livre de frameworks).

 Componentes principais:
 - LOCAL_STORAGE: chaves padronizadas para persistência (ex.: idioma e config solar).
 - DEFAULTS: valores padrão usados quando não há configuração salva — útil para
     demonstrar e testar o comportamento do site sem precisar alterar múltiplos arquivos.
 - SELECTORS: seletores CSS compartilhados (botões de idioma, home button, etc.)
     para evitar repetição de strings em cada script de página.
 - ASSETS: caminhos base para CSS/JS e CDNs (por exemplo Chart.js).
 - UI: parâmetros sensíveis à interface, como comportamento do efeito ripple.

 Exemplo de uso (em outro script):
     const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
     const idioma = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || SiteConfig.DEFAULTS.language;

 Manter essas constantes em um único arquivo facilita alterar políticas do
 site sem tocar múltiplas páginas — por exemplo mudar a taxa de conversão
 de BRL↔EUR ou ajustar limites de peso para baterias.
*/)
(function(global){
    'use strict';

    const SiteConfig = {
        LOCAL_STORAGE: {
            LANGUAGE_KEY: 'idiomaPreferido',
            SOLAR_CONFIG_KEY: 'configSolar'
        },

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

        SELECTORS: {
            HOME_BUTTON: '.home-button-fixed',
            LANG_BTN: '.lang-btn',
            APP_ICON: '.app-icon',
            ARROW_BTN: '.arrow-btn',
            BUTTON_ACTION: '.btn-acao'
        },

        ASSETS: {
            CSS_BASE: 'assets/css/',
            JS_BASE: 'assets/js/',
            CHARTJS_CDN: 'https://cdn.jsdelivr.net/npm/chart.js'
        },

        UI: {
            RIPPLE: { durationMs: 700, sizePct: 0.9 }
        }
    };

    // Expose read-only property on window
    try { global.SiteConfig = Object.freeze(SiteConfig); } catch(e){ global.SiteConfig = SiteConfig; }
})(window);
