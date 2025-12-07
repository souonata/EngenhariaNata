// ============================================
// ACCORDION - SISTEMA DE EXPANSÃO/RETRAÇÃO DE SEÇÕES
// Permite que o usuário clique nos títulos dos cards para mostrar/ocultar conteúdo
// ============================================

/* ========================================== */
/* SISTEMA DE INTERNACIONALIZAÇÃO (i18n) */
/* Tradução PT-BR ↔ IT-IT */
/* ========================================== */

// Prefer site-wide config keys when available
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// Replaced file content: cleaned translations and minimal accordion logic
// This file sets up translations (pt-BR / it-IT) and enables a simple accordion
// behavior so card headers expand/collapse on click and keyboard (Enter / Space).

const traducoes = {
    'pt-BR': {
        'page-title': '📱 Sobre o Projeto',
        'page-subtitle': 'Portfólio de apps web',
        'overview-title': 'Visão Geral',
        'overview-description': 'Pequeno portfólio com apps educativos que demonstram conceitos práticos de forma simples.',

        'app-mutuo-desc': 'Calculadora de amortização',
        'app-helice-desc': 'Calculadora de passo de hélice',
        'app-solar-desc': 'Dimensionamento fotovoltaico',
        'app-about-desc': 'Informações do projeto',

        'calculator-title': 'Calculadora de Empréstimos',
        'what-it-does': 'O que faz:',
        'calculator-description': 'Compara sistemas de amortização e mostra parcelas e gráficos para facilitar comparações.',

        'helice-title': 'Calculadora de Hélice',
        'helice-description': 'Calcula o passo estimado da hélice para ajudar na escolha.',

        'solar-title': 'Dimensionamento Solar',
        'solar-description': 'Ajuda a estimar painéis, baterias e inversor para sistemas fotovoltaicos de forma simplificada.',

        'feature-pitch-title': 'Cálculo de Passo',
        'feature-pitch-desc': 'Determina o passo aproximado para a hélice',
        'feature-slip-title': 'Análise de Slip',
        'feature-slip-desc': 'Considera eficiência e deslizamento',

        'feature-battery-title': 'Baterias AGM / LiFePO₄',
        'feature-battery-desc': 'Compara tecnologias e vida útil de baterias',
        'feature-battery-note': 'Ajuste kWh/Ah, tensão, preço e peso (sliders até 180 kg).',

        'feature-config-title': 'Configurável',
        'feature-config-desc': 'Customize preços e especificações; mudanças salvas em localStorage (configSolar).',

        'feature-bilingual-title': 'Bilíngue',
        'feature-bilingual-desc': 'Troca entre Português e Italiano e exibe a moeda correspondente.',

        'feature-charts-title': 'Gráficos',
        'feature-charts-desc': 'Gráficos simples para visualizar valores ao longo do tempo',

        'feature-responsive-title': 'Responsivo',
        'feature-responsive-desc': 'Projetado para funcionar bem em dispositivos móveis e desktop',

        'feature-fast-title': 'Rápido',
        'feature-fast-desc': 'Cálculos instantâneos ao ajustar valores',

        'stat-html': 'linhas HTML',
        'stat-js': 'linhas JavaScript',
        'stat-css': 'linhas CSS',
        'code-commented-note': '💡 Todo o código JavaScript está completamente comentado em português para facilitar o aprendizado!',

        'features-title': 'Recursos Principais',
        'resource-bilingual-title': '🌍 Bilíngue',
        'resource-bilingual-desc': 'Troca de idioma e moeda associada',
        'resource-charts-title': '📊 Gráficos Interativos',
        'resource-charts-desc': 'Visualização simples dos dados',
        'resource-mobile-title': '📱 Mobile-First',
        'resource-mobile-desc': 'Compatível com celulares e computadores',

        'tech-title': 'Tecnologias Usadas',
        'tech-html': 'Estrutura das páginas',
        'tech-css': 'Estilos e animações',
        'tech-js': 'JavaScript puro',
        'tech-chart': 'Gráficos (Chart.js)',

        'footer-text': '💻 Portfólio Engenharia NATA',
        'aria-home': 'Voltar para a tela inicial'
    },

    'it-IT': {
        'page-title': '📱 Sul Progetto',
        'page-subtitle': 'Portfolio di app web',
        'overview-title': 'Panoramica',
        'overview-description': 'Piccolo portfolio con app didattiche che mostrano concetti pratici in modo semplice.',

        'app-mutuo-desc': 'Calcolatrice di ammortamento',
        'app-helice-desc': 'Calcolatrice passo elica',
        'app-solar-desc': 'Dimensionamento fotovoltaico',
        'app-about-desc': 'Informazioni sul progetto',

        'calculator-title': 'Calcolatrice Prestiti',
        'what-it-does': 'Cosa fa:',
        'calculator-description': 'Confronta sistemi di ammortamento e mostra rate e grafici per facilitare i confronti.',

        'helice-title': 'Calcolatore Elica',
        'helice-description': "Calcola il passo stimato dell'elica per aiutare nella scelta.",

        'solar-title': 'Dimensionamento Solare',
        'solar-description': 'Aiuta a stimare pannelli, batterie e inverter per sistemi fotovoltaici in modo semplificato.',

        'feature-pitch-title': 'Calcolo del Passo',
        'feature-pitch-desc': 'Stima il passo dell\'elica',
        'feature-slip-title': 'Analisi dello Slip',
        'feature-slip-desc': 'Considera efficienza e scivolamento',

        'feature-battery-title': 'Batterie AGM / LiFePO₄',
        'feature-battery-desc': 'Confronta tecnologie e vita utile delle batterie',
        'feature-battery-note': 'Regola kWh/Ah, tensione, prezzo e peso (slider fino a 180 kg).',

        'feature-config-title': 'Configurabile',
        'feature-config-desc': 'Personalizza prezzi e specifiche; impostazioni salvate in localStorage (configSolar).',

        'feature-bilingual-title': 'Bilingue',
        'feature-bilingual-desc': 'Cambia tra Portoghese e Italiano e mostra la valuta corrispondente.',

        'feature-charts-title': 'Grafici',
        'feature-charts-desc': 'Grafici semplici per visualizzare i dati nel tempo',

        'feature-responsive-title': 'Responsive',
        'feature-responsive-desc': 'Progettato per dispositivi mobili e desktop',

        'feature-fast-title': 'Veloce',
        'feature-fast-desc': 'Calcoli istantanei al cambiare dei valori',

        'stat-html': 'righe HTML',
        'stat-js': 'righe JavaScript',
        'stat-css': 'righe CSS',
        'code-commented-note': '💡 Tutto il codice JavaScript è completamente commentato in portoghese per facilitare l\'apprendimento!',

        'features-title': 'Caratteristiche Principali',
        'resource-bilingual-title': '🌍 Bilingue',
        'resource-bilingual-desc': 'Cambio lingua e valuta',
        'resource-charts-title': '📊 Grafici Interattivi',
        'resource-charts-desc': 'Visualizzazione semplice dei dati',
        'resource-mobile-title': '📱 Mobile-First',
        'resource-mobile-desc': 'Compatibile con dispositivi mobili e computer',

        'tech-title': 'Tecnologie Utilizzate',
        'tech-html': 'Struttura delle pagine',
        'tech-css': 'Stili e animazioni',
        'tech-js': 'JavaScript puro',
        'tech-chart': 'Grafici (Chart.js)',

        'footer-text': '💻 Portfolio Ingegneria NATA',
        'aria-home': 'Torna alla schermata iniziale'
    }
};

// -------------------------------------------------------------
// Funções de UI (idioma, accordion) — explicação didática
// -------------------------------------------------------------
// Este arquivo combina duas responsabilidades simples:
// 1) Internacionalização: troca do idioma mostrando textos armazenados
//    no dicionário `traducoes` para elementos marcados com data-i18n.
// 2) Accordion: lógica de expansão/retração de seções.
//
// A estratégia do accordion é baseada em animação CSS manipulando
// `max-height` para permitir transições suaves e também atualizando
// atributos de acessibilidade `aria-expanded`. Click ou teclas (Enter/Space)
// disparam alternarSecao, que configura o estilo e o estado.

function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            el.textContent = traducoes[novoIdioma][chave];
        }
    });

    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === novoIdioma);
    });

    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

function alternarSecao(cabecalho) {
    const card = cabecalho.closest('.card-expansivel');
    if (!card) return;
    const conteudo = card.querySelector('.conteudo-expansivel');
    const seta = cabecalho.querySelector('.seta-expansao');

    card.classList.toggle('expandido');

    if (card.classList.contains('expandido')) {
        conteudo.style.maxHeight = conteudo.scrollHeight + 'px';
        if (seta) seta.style.transform = 'rotate(180deg)';
        // accessibility state
        cabecalho.setAttribute('aria-expanded', 'true');
    } else {
        conteudo.style.maxHeight = '0';
        if (seta) seta.style.transform = 'rotate(0deg)';
        cabecalho.setAttribute('aria-expanded', 'false');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    trocarIdioma(idiomaAtual);

    const btnP = document.getElementById('btnPortugues');
    const btnI = document.getElementById('btnItaliano');
    if (btnP) btnP.addEventListener('click', () => trocarIdioma('pt-BR'));
    if (btnI) btnI.addEventListener('click', () => trocarIdioma('it-IT'));

    // ensure all accordions start collapsed
    document.querySelectorAll('.conteudo-expansivel').forEach(el => {
        el.style.maxHeight = '0';
        el.style.overflow = 'hidden';
        el.style.transition = 'max-height 0.4s ease';
    });

    // attach touch/click-friendly handlers to headers
    document.querySelectorAll('.card-header-clicavel').forEach(h => {
            // We use the shared attachRippleTo helper (ripple.js) to provide
            // consistent tap highlight behavior across the site. The visual
            // effect is still removed after a short timeout by the shared helper.

        // click toggles the accordion
        h.addEventListener('click', () => alternarSecao(h));
        // ensure keyboard access
        h.setAttribute('tabindex', '0');
        h.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                alternarSecao(h);
            }
        });
    });

    // ripple attachments centralized in ripple-init.js
});
// end of file - accordion and i18n logic implemented above
