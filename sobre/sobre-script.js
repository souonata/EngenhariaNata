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
        'overview-description': 'Portfólio de ferramentas práticas para o dia a dia: calculadoras de engenharia e finanças que você pode usar diretamente no navegador, sem precisar instalar nada.',

        'app-about': 'Sobre mim',
        'app-arcondicionado': 'Ar Condicionado',
        'app-aquecimento': 'Aquecedor Solar',
        'app-bitola': 'Bitola',
        'app-solar': 'Energia Solar',
        'app-fazenda': 'Fazenda',
        'app-helice': 'Hélice',
        'app-mutuo': 'Financiamento',
        'app-mutuo-desc': 'Confronta prestiti e mostra rate per risparmiare',
        'app-helice-desc': 'Ajuda a escolher a hélice perfeita para seu barco',
        'app-solar-desc': 'Dimensione painéis solares para gerar sua própria energia',
        'app-bitola-desc': 'Calcula o fio elétrico ideal para sua instalação de forma segura',
        'app-arcondicionado-desc': 'Calcula o ar condicionado ideal para seus ambientes',
        'app-aquecimento-desc': 'Planeja seu sistema de aquecimento solar economizando energia',
        'app-fazenda-desc': 'Planeje sua fazenda auto-sustentável para produção própria',
        'app-about-desc': 'Informações do projeto',
        'app-bugs': 'Reportar Bug',
        'app-bugs-desc': 'Ajude a melhorar os apps reportando problemas',

        'calculator-title': 'Calculadora de Empréstimos',
        'what-it-does': 'O que faz:',
        'calculator-description': 'Compara empréstimos e mostra parcelas para você economizar.',

        'helice-description': 'Ajuda a escolher a hélice perfeita para seu barco.',

        'solar-description': 'Dimensione painéis solares para gerar sua própria energia.',

        'bitola-description': 'Calcula o fio elétrico correto para sua instalação, evitando aquecimento e garantindo segurança.',

        'arcondicionado-description': 'Calcula o ar condicionado ideal para seus ambientes.',

        'aquecimento-description': 'Planeje seu sistema de aquecimento solar economizando energia.',

        'fazenda-description': 'Planeje sua fazenda auto-sustentável para produção própria.',
        
        'bugs-description': 'Ajude a melhorar os apps reportando problemas.',
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
        'feature-inverter-mppt-title': 'Inversor e MPPT',
        'feature-inverter-mppt-desc': 'Dimensiona inversor baseado no consumo típico de pico e controlador MPPT com capacidade para carregar todo o banco de baterias e suportar o pico de todos os painéis.',

        'feature-cc-ca-title': 'CC e CA',
        'feature-cc-ca-desc': 'Suporta corrente contínua (CC) e alternada (CA) com tensões típicas e valores personalizados.',
        'feature-bitola-comercial-title': 'Bitola Comercial',
        'feature-bitola-comercial-desc': 'Seleciona automaticamente a bitola comercial padrão brasileiro (NBR 5410) que atende aos requisitos.',
        'feature-queda-tensao-title': 'Queda de Tensão',
        'feature-queda-tensao-desc': 'Recomenda 3% de queda de tensão para projetos residenciais no Brasil (padrão mais utilizado).',
        'feature-potencia-title': 'Potência Flexível',
        'feature-potencia-desc': 'Steps dinâmicos: 1W (1-10W), 10W (100-1000W), 50W (1000-3000W) com formatação automática em "k" para valores >= 1000W.',

        'feature-btu-title': 'Cálculo de BTU',
        'feature-btu-desc': 'Determina a capacidade necessária em BTU baseada em múltiplos fatores ambientais',
        'feature-fatores-title': 'Múltiplos Fatores',
        'feature-fatores-desc': 'Considera área (2-100 m²), altura, número de pessoas, equipamentos e condições climáticas',
        'feature-modelos-title': 'Modelos Comerciais',
        'feature-modelos-desc': 'Seleciona automaticamente o modelo comercial adequado: 5.000, 7.000, 9.000, 12.000, 18.000, 24.000, 30.000, 36.000, 48.000 ou 60.000 BTU',

        'feature-agua-casa-title': 'Água e Casa',
        'feature-agua-casa-desc': 'Suporta aquecimento de água de consumo e aquecimento ambiente separadamente ou combinados',
        'feature-classe-energetica-title': 'Classe Energética',
        'feature-classe-energetica-desc': 'Considera classes energéticas (A4 a G) com consumo específico real em kWh/m²·ano',
        'feature-autonomia-title': 'Dias de Autonomia',
        'feature-autonomia-desc': 'Configura dias de autonomia para água e casa, dimensionando o boiler adequadamente',
        'feature-memorial-title': 'Memorial de Cálculo',
        'feature-memorial-desc': 'Exibe detalhamento completo de todos os cálculos realizados para transparência e aprendizado',

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

        'features-title': 'Recursos Principais',
        'resource-bilingual-title': '🌍 Bilíngue',
        'resource-bilingual-desc': 'Troca entre Português e Italiano',
        'resource-charts-title': '📊 Gráficos',
        'resource-charts-desc': 'Visualização clara dos dados',
        'resource-mobile-title': '📱 Mobile-First',
        'resource-mobile-desc': 'Funciona bem em celular e computador',
        'resource-code-commented-title': '💡 Código Comentado',
        'resource-code-commented-desc': 'Código explicado para facilitar aprendizado',

        'tech-title': 'Tecnologias Usadas',
        'tech-html': 'Estrutura das páginas',
        'tech-css': 'Estilos e animações',
        'tech-js': 'JavaScript puro e rápido',
        'tech-chart': 'Gráficos interativos',
        'tech-mobile-desc': 'Funciona bem em celular e computador',

        'footer-text': '💻 Portfólio Engenharia NATA',
        'aria-home': 'Voltar para a tela inicial'
    },

    'it-IT': {
        'page-title': '📱 Sul Progetto',
        'page-subtitle': 'Portfolio di app web',
        'overview-title': 'Panoramica',
        'overview-description': 'Portfolio di strumenti pratici per la vita quotidiana: calcolatrici di ingegneria e finanza che puoi usare direttamente nel browser, senza bisogno di installare nulla.',

        'app-about': 'Su di me',
        'app-arcondicionado': 'Climatizzatore',
        'app-aquecimento': 'Riscaldatore Solare',
        'app-bitola': 'Sezione Cavi',
        'app-solar': 'Energia Solare',
        'app-fazenda': 'Fattoria',
        'app-helice': 'Elica',
        'app-mutuo': 'Mutuo',
        'app-mutuo-desc': 'Confronta prestiti e mostra rate per risparmiare',
        'app-helice-desc': 'Aiuta a scegliere l\'elica perfetta per la tua barca',
        'app-solar-desc': 'Dimensiona pannelli solari per generare la tua energia',
        'app-bitola-desc': 'Calcola il cavo elettrico ideale per la tua installazione in modo sicuro',
        'app-arcondicionado-desc': 'Calcola il climatizzatore ideale per i tuoi ambienti',
        'app-aquecimento-desc': 'Pianifica il tuo sistema di riscaldamento solare risparmiando energia',
        'app-fazenda-desc': 'Pianifica la tua fattoria auto-sostenibile per produzione propria',
        'app-about-desc': 'Informazioni sul progetto',
        'app-bugs': 'Segnala Bug',
        'app-bugs-desc': 'Aiuta a migliorare le app segnalando problemi',

        'calculator-title': 'Calcolatrice Prestiti',
        'what-it-does': 'Cosa fa:',
        'calculator-description': 'Confronta prestiti e mostra rate per risparmiare.',

        'helice-description': 'Aiuta a scegliere l\'elica perfetta per la tua barca.',

        'solar-description': 'Dimensiona pannelli solari per generare la tua energia.',

        'bitola-description': 'Calcola il cavo elettrico ideale per la tua installazione in modo sicuro.',

        'arcondicionado-description': 'Calcola il climatizzatore ideale per i tuoi ambienti.',

        'aquecimento-description': 'Pianifica il tuo sistema di riscaldamento solare risparmiando energia.',

        'fazenda-description': 'Pianifica la tua fattoria auto-sostenibile per produzione propria.',
        
        'bugs-description': 'Aiuta a migliorare le app segnalando problemi.',
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
        'feature-inverter-mppt-title': 'Inverter e MPPT',
        'feature-inverter-mppt-desc': 'Dimensiona inverter basato sul consumo tipico di picco e controller MPPT con capacità di caricare l\'intero banco batterie e supportare il picco di tutti i pannelli.',

        'feature-cc-ca-title': 'CC e CA',
        'feature-cc-ca-desc': 'Supporta corrente continua (CC) e alternata (CA) con tensioni tipiche e valori personalizzati.',
        'feature-bitola-comercial-title': 'Sezione Commerciale',
        'feature-bitola-comercial-desc': 'Seleziona automaticamente la sezione commerciale standard brasiliana (NBR 5410) che soddisfa i requisiti.',
        'feature-queda-tensao-title': 'Caduta di Tensione',
        'feature-queda-tensao-desc': 'Raccomanda 3% di caduta di tensione per progetti residenziali in Brasile (standard più utilizzato).',
        'feature-potencia-title': 'Potenza Flessibile',
        'feature-potencia-desc': 'Step dinamici: 1W (1-10W), 10W (100-1000W), 50W (1000-3000W) con formattazione automatica in "k" per valori >= 1000W.',

        'feature-btu-title': 'Calcolo BTU',
        'feature-btu-desc': 'Determina la capacità necessaria in BTU basata su multipli fattori ambientali',
        'feature-fatores-title': 'Multipli Fattori',
        'feature-fatores-desc': 'Considera area (2-100 m²), altezza, numero di persone, apparecchiature e condizioni climatiche',
        'feature-modelos-title': 'Modelli Commerciali',
        'feature-modelos-desc': 'Seleziona automaticamente il modello commerciale adeguato: 5.000, 7.000, 9.000, 12.000, 18.000, 24.000, 30.000, 36.000, 48.000 o 60.000 BTU',

        'feature-agua-casa-title': 'Acqua e Casa',
        'feature-agua-casa-desc': 'Supporta riscaldamento dell\'acqua sanitaria e riscaldamento ambiente separatamente o combinati',
        'feature-classe-energetica-title': 'Classe Energetica',
        'feature-classe-energetica-desc': 'Considera classi energetiche (A4 a G) con consumo specifico reale in kWh/m²·anno',
        'feature-autonomia-title': 'Giorni di Autonomia',
        'feature-autonomia-desc': 'Configura giorni di autonomia per acqua e casa, dimensionando il boiler adeguatamente',
        'feature-memorial-title': 'Memoriale di Calcolo',
        'feature-memorial-desc': 'Mostra dettaglio completo di tutti i calcoli eseguiti per trasparenza e apprendimento',

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

        'features-title': 'Caratteristiche Principali',
        'resource-bilingual-title': '🌍 Bilingue',
        'resource-bilingual-desc': 'Cambio tra Portoghese e Italiano',
        'resource-charts-title': '📊 Grafici',
        'resource-charts-desc': 'Visualizzazione chiara dei dati',
        'resource-mobile-title': '📱 Mobile-First',
        'resource-mobile-desc': 'Funziona bene su cellulare e computer',
        'resource-code-commented-title': '💡 Codice Commentato',
        'resource-code-commented-desc': 'Codice spiegato per facilitare l\'apprendimento',

        'tech-title': 'Tecnologie Utilizzate',
        'tech-html': 'Struttura delle pagine',
        'tech-css': 'Stili e animazioni',
        'tech-js': 'JavaScript puro e veloce',
        'tech-chart': 'Grafici interattivi',
        'tech-mobile-desc': 'Funziona bene su cellulare e computer',

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

    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

function alternarSecao(cabecalho, evento) {
    // Prevenir comportamento padrão que pode causar scroll
    if (evento) {
        evento.preventDefault();
        evento.stopPropagation();
    }
    
    // Salvar posição atual do scroll antes de alterar o conteúdo
    const scrollAtual = window.pageYOffset || document.documentElement.scrollTop;
    
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
        
        // Restaurar posição do scroll após recolher (usar setTimeout para garantir que o DOM foi atualizado)
        setTimeout(() => {
            window.scrollTo({
                top: scrollAtual,
                behavior: 'instant' // 'instant' para não ter animação de scroll
            });
        }, 0);
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
        // click toggles the accordion - passar evento para prevenir scroll
        h.addEventListener('click', (e) => alternarSecao(h, e));
        // ensure keyboard access
        h.setAttribute('tabindex', '0');
        h.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                alternarSecao(h, e);
            }
        });
    });
});
// end of file - accordion and i18n logic implemented above
