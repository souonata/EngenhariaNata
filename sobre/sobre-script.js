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
        'app-bitola-desc': 'Calculadora de bitola de fios',
        'app-arcondicionado-desc': 'Dimensionamento de ar condicionado',
        'app-aquecimento-desc': 'Dimensionamento solar térmico',
        'app-fazenda-desc': 'Planejamento de fazenda auto-sustentável',
        'app-about-desc': 'Informações do projeto',

        'calculator-title': 'Calculadora de Empréstimos',
        'what-it-does': 'O que faz:',
        'calculator-description': 'Compara sistemas de amortização e mostra parcelas e gráficos para facilitar comparações.',

        'helice-title': 'Calculadora de Hélice',
        'helice-description': 'Calcula o passo estimado da hélice para ajudar na escolha.',

        'solar-title': 'Dimensionamento Solar',
        'solar-description': 'Ajuda a estimar painéis, baterias e inversor para sistemas fotovoltaicos de forma simplificada.',

        'bitola-title': 'Calculadora de Bitola de Fios',
        'bitola-description': 'Calcula a área de seção mínima de fios elétricos para circuitos CC e CA, considerando queda de tensão e selecionando a bitola comercial adequada.',

        'arcondicionado-title': 'Dimensionador de Ar Condicionado',
        'arcondicionado-description': 'Calculadora para dimensionamento de ar condicionado. Determina a capacidade necessária (BTU) baseada em área, altura, número de pessoas, equipamentos e condições ambientais.',

        'aquecimento-title': 'Dimensionador de Aquecedor Solar',
        'aquecimento-description': 'Dimensionador completo de sistemas de aquecimento solar térmico. Calcula área de coletores, volume do boiler, número de painéis e potência necessária. Suporta água de consumo e aquecimento ambiente.',

        'fazenda-title': 'Dimensionador de Fazenda Auto-Sustentável',
        'fazenda-description': 'Planejador completo de fazenda auto-sustentável. Calcula espaço necessário, quantidade de plantas (frutas, verduras, legumes) e animais necessários para alimentar uma família. Inclui calendário de plantio/colheita e frequência de reprodução dos animais para manter produção contínua.',
        'feature-plantas-title': 'Plantas e Animais',
        'feature-plantas-desc': 'Seleção de frutas, verduras, legumes e animais com cálculo proporcional de produção mínima',
        'feature-producao-minima-title': 'Produção Mínima',
        'feature-producao-minima-desc': 'Sliders ajustáveis para definir produção mínima diária de plantas e proteínas por pessoa',
        'feature-calendario-title': 'Calendário',
        'feature-calendario-desc': 'Calendário completo de plantio, colheita e reprodução animal para manter produção contínua',
        'feature-espaco-title': 'Dimensionamento',
        'feature-espaco-desc': 'Calcula área necessária, quantidade de plantas/animais e consumo diário por pessoa',

        'feature-pitch-title': 'Cálculo de Passo',
        'feature-pitch-desc': 'Determina o passo aproximado para a hélice',
        'feature-slip-title': 'Análise de Slip',
        'feature-slip-desc': 'Considera eficiência e deslizamento',

        'feature-battery-title': 'Baterias AGM / LiFePO₄',
        'feature-battery-desc': 'Compara tecnologias e vida útil de baterias',
        'feature-battery-note': 'Ajuste kWh/Ah, tensão, preço e peso (sliders até 180 kg).',

        'feature-config-title': 'Configurável',
        'feature-config-desc': 'Customize preços e especificações; mudanças salvas em localStorage (configSolar).',
        'feature-memorial-title': 'Memorial de Cálculo',
        'feature-memorial-desc': 'Memorial didático completo que explica passo a passo todos os cálculos realizados, com fórmulas, exemplos práticos e resumo dos valores calculados.',

        'feature-cc-ca-title': 'CC e CA',
        'feature-cc-ca-desc': 'Suporta corrente contínua (CC) e alternada (CA) com tensões típicas e valores personalizados.',
        'feature-bitola-comercial-title': 'Bitola Comercial',
        'feature-bitola-comercial-desc': 'Seleciona automaticamente a bitola comercial padrão brasileiro (NBR 5410) que atende aos requisitos.',
        'feature-queda-tensao-title': 'Queda de Tensão',
        'feature-queda-tensao-desc': 'Recomenda 4% de queda de tensão para projetos residenciais no Brasil (padrão mais utilizado).',
        'feature-potencia-title': 'Potência Flexível',
        'feature-potencia-desc': 'Steps dinâmicos: 1W (1-10W), 10W (100-1000W), 50W (1000-3000W) com formatação automática em "k" para valores >= 1000W.',

        'feature-btu-title': 'Cálculo de BTU',
        'feature-btu-desc': 'Determina a capacidade necessária em BTU baseada em múltiplos fatores ambientais',
        'feature-fatores-title': 'Múltiplos Fatores',
        'feature-fatores-desc': 'Considera área, altura, número de pessoas, equipamentos e condições climáticas',

        'feature-agua-casa-title': 'Água e Casa',
        'feature-agua-casa-desc': 'Suporta aquecimento de água de consumo e aquecimento ambiente separadamente ou combinados',
        'feature-classe-energetica-title': 'Classe Energética',
        'feature-classe-energetica-desc': 'Considera classes energéticas (A4 a G) com consumo específico real em kWh/m²·ano',
        'feature-autonomia-title': 'Dias de Autonomia',
        'feature-autonomia-desc': 'Configura dias de autonomia para água e casa, dimensionando o boiler adequadamente',
        'feature-memorial-title': 'Memorial de Cálculo',
        'feature-memorial-desc': 'Exibe detalhamento completo de todos os cálculos realizados para transparência',

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
        'app-bitola-desc': 'Calcolatrice sezione cavi',
        'app-arcondicionado-desc': 'Dimensionamento climatizzatore',
        'app-aquecimento-desc': 'Dimensionamento riscaldatore solare',
        'app-fazenda-desc': 'Pianificazione fattoria auto-sostenibile',
        'app-about-desc': 'Informazioni sul progetto',

        'calculator-title': 'Calcolatrice Prestiti',
        'what-it-does': 'Cosa fa:',
        'calculator-description': 'Confronta sistemi di ammortamento e mostra rate e grafici per facilitare i confronti.',

        'helice-title': 'Calcolatore Elica',
        'helice-description': "Calcola il passo stimato dell'elica per aiutare nella scelta.",

        'solar-title': 'Dimensionamento Solare',
        'solar-description': 'Aiuta a stimare pannelli, batterie e inverter per sistemi fotovoltaici in modo semplificato.',

        'bitola-title': 'Calcolatrice Sezione Cavi',
        'bitola-description': 'Calcola l\'area di sezione minima dei cavi elettrici per circuiti CC e CA, considerando la caduta di tensione e selezionando la sezione commerciale adeguata.',

        'arcondicionado-title': 'Dimensionatore Climatizzatore',
        'arcondicionado-description': 'Calcolatrice per il dimensionamento del climatizzatore. Determina la capacità necessaria (BTU) basata su area, altezza, numero di persone, apparecchiature e condizioni ambientali.',

        'aquecimento-title': 'Dimensionatore Riscaldatore Solare',
        'aquecimento-description': 'Dimensionatore completo di sistemi di riscaldamento solare termico. Calcola l\'area dei collettori, volume del boiler, numero di pannelli e potenza necessaria. Supporta riscaldamento dell\'acqua sanitaria e riscaldamento ambiente.',

        'fazenda-title': 'Dimensionatore Fattoria Auto-Sostenibile',
        'fazenda-description': 'Pianificatore completo di fattoria auto-sostenibile. Calcola lo spazio necessario, quantità di piante (frutta, verdura, legumi) e animali necessari per nutrire una famiglia. Include calendario di semina/raccolto e frequenza di riproduzione degli animali per mantenere produzione continua.',
        'feature-plantas-title': 'Piante e Animali',
        'feature-plantas-desc': 'Selezione di frutta, verdura, legumi e animali con calcolo proporzionale di produzione minima',
        'feature-producao-minima-title': 'Produzione Minima',
        'feature-producao-minima-desc': 'Slider regolabili per definire produzione minima giornaliera di piante e proteine per persona',
        'feature-calendario-title': 'Calendario',
        'feature-calendario-desc': 'Calendario completo di semina, raccolto e riproduzione animale per mantenere produzione continua',
        'feature-espaco-title': 'Dimensionamento',
        'feature-espaco-desc': 'Calcola area necessaria, quantità di piante/animali e consumo giornaliero per persona',

        'feature-pitch-title': 'Calcolo del Passo',
        'feature-pitch-desc': 'Stima il passo dell\'elica',
        'feature-slip-title': 'Analisi dello Slip',
        'feature-slip-desc': 'Considera efficienza e scivolamento',

        'feature-battery-title': 'Batterie AGM / LiFePO₄',
        'feature-battery-desc': 'Confronta tecnologie e vita utile delle batterie',
        'feature-battery-note': 'Regola kWh/Ah, tensione, prezzo e peso (slider fino a 180 kg).',

        'feature-config-title': 'Configurabile',
        'feature-config-desc': 'Personalizza prezzi e specifiche; impostazioni salvate in localStorage (configSolar).',
        'feature-memorial-title': 'Memoriale di Calcolo',
        'feature-memorial-desc': 'Memoriale didattico completo che spiega passo dopo passo tutti i calcoli eseguiti, con formule, esempi pratici e riepilogo dei valori calcolati.',

        'feature-cc-ca-title': 'CC e CA',
        'feature-cc-ca-desc': 'Supporta corrente continua (CC) e alternata (CA) con tensioni tipiche e valori personalizzati.',
        'feature-bitola-comercial-title': 'Sezione Commerciale',
        'feature-bitola-comercial-desc': 'Seleziona automaticamente la sezione commerciale standard brasiliana (NBR 5410) che soddisfa i requisiti.',
        'feature-queda-tensao-title': 'Caduta di Tensione',
        'feature-queda-tensao-desc': 'Raccomanda 4% di caduta di tensione per progetti residenziali in Brasile (standard più utilizzato).',
        'feature-potencia-title': 'Potenza Flessibile',
        'feature-potencia-desc': 'Step dinamici: 1W (1-10W), 10W (100-1000W), 50W (1000-3000W) con formattazione automatica in "k" per valori >= 1000W.',

        'feature-btu-title': 'Calcolo BTU',
        'feature-btu-desc': 'Determina la capacità necessaria in BTU basata su multipli fattori ambientali',
        'feature-fatores-title': 'Multipli Fattori',
        'feature-fatores-desc': 'Considera area, altezza, numero di persone, apparecchiature e condizioni climatiche',

        'feature-agua-casa-title': 'Acqua e Casa',
        'feature-agua-casa-desc': 'Supporta riscaldamento dell\'acqua sanitaria e riscaldamento ambiente separatamente o combinati',
        'feature-classe-energetica-title': 'Classe Energetica',
        'feature-classe-energetica-desc': 'Considera classi energetiche (A4 a G) con consumo specifico reale in kWh/m²·anno',
        'feature-autonomia-title': 'Giorni di Autonomia',
        'feature-autonomia-desc': 'Configura giorni di autonomia per acqua e casa, dimensionando il boiler adeguatamente',
        'feature-memorial-title': 'Memoriale di Calcolo',
        'feature-memorial-desc': 'Mostra dettaglio completo di tutti i calcoli eseguiti per trasparenza',

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
});
// end of file - accordion and i18n logic implemented above
