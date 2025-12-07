// ============================================
// ACCORDION - SISTEMA DE EXPANSÃO/RETRAÇÃO DE SEÇÕES
// Permite que o usuário clique nos títulos dos cards para mostrar/ocultar conteúdo
// ============================================

/* ========================================== */
/* SISTEMA DE INTERNACIONALIZAÇÃO (i18n) */
/* Tradução PT-BR ↔ IT-IT */
/* ========================================== */

// Idioma atual - carrega do localStorage ou usa português como padrão
let idiomaAtual = localStorage.getItem('idiomaPreferido') || 'pt-BR';

// Dicionário de traduções
const traducoes = {
    'pt-BR': {
        'page-title': '📱 Sobre o Projeto',
        'page-subtitle': 'Portfólio de apps web',
        'overview-title': 'Visão Geral',
            'overview-description': 'Pequeno portfólio com apps educativos que demonstram conceitos práticos de forma simples.',
        'app-mutuo-desc': 'Calculadora de amortização bilíngue',
        'app-helice-desc': 'Calculadora de passo de hélice',
        'app-solar-desc': 'Dimensionamento fotovoltaico off-grid',
        'app-about-desc': 'Informações do projeto',
        'calculator-title': 'Calculadora de Empréstimos BR/IT',
        'what-it-does': 'O que faz:',
        'calculator-description': 'Compara 3 sistemas de amortização de empréstimos: SAC, Price e Americano. Ajuda pessoas a entenderem qual sistema é melhor para sua situação financeira.',
            'calculator-description': 'Compara sistemas de amortização e mostra parcelas e gráficos para facilitar comparações.',
        'helice-title': 'Calculadora de Hélice',
        'helice-description': 'Calcula o passo ideal da hélice para barcos de lazer, considerando RPM, redução e slip.',
        'solar-title': 'Dimensionamento Solar',
        'solar-description': 'Dimensiona sistemas fotovoltaicos off-grid, calculando painéis, baterias e inversor necessários.',
            'solar-description': 'Ajuda a estimar painéis, baterias e inversor para sistemas off-grid de forma simplificada.',
        'feature-pitch-title': 'Cálculo de Passo',
        'feature-pitch-desc': 'Determina o passo correto para atingir o RPM máximo',
        'feature-slip-title': 'Análise de Slip',
        'feature-slip-desc': 'Considera a eficiência e o deslizamento na água',
        'feature-battery-title': 'Baterias AGM/Lítio',
        'feature-battery-desc': 'Compara chumbo-ácido e LiFePO₄ com tabelas de vida útil',
        'feature-battery-note': 'As configurações permitem ajustar kWh/Ah, tensão, preço e peso (sliders até 180 kg).',
        'feature-config-title': 'Configurável',
        'feature-config-desc': 'Customize preços, potências e especificações das baterias — mudanças salvas em localStorage (chave configSolar)',
        'feature-bilingual-title': 'Bilíngue',
        'feature-bilingual-desc': 'Português e Italiano com troca instantânea',
            'feature-bilingual-desc': 'Troca entre Português e Italiano e exibe moeda correspondente.',
        'feature-charts-title': 'Gráficos',
        'feature-charts-desc': 'Visualização da evolução dos juros e amortização',
        'feature-responsive-title': 'Responsivo',
        'feature-responsive-desc': 'Funciona perfeitamente em celular, tablet e desktop',
        'feature-fast-title': 'Rápido',
        'feature-fast-desc': 'Cálculos instantâneos ao mudar valores',
        'stat-html': 'linhas HTML',
        'stat-js': 'linhas JavaScript',
        'stat-css': 'linhas CSS',
        'features-title': 'Recursos Principais',
        'resource-bilingual-title': '🌍 Bilíngue',
        'resource-bilingual-desc': 'Troca entre Português e Italiano em 1 clique. Moeda muda automaticamente (R$ ↔ €).',
        'resource-charts-title': '📊 Gráficos Interativos',
        'resource-charts-desc': 'Visualize a evolução dos juros e amortização ao longo do tempo.',
        'resource-mobile-title': '📱 Mobile-First',
        'resource-mobile-desc': 'Funciona perfeitamente em celulares, tablets e computadores.',
        'tech-title': 'Tecnologias Usadas',
        'tech-html': 'Estrutura das páginas',
        'tech-css': 'Estilos e animações',
        'tech-js': 'Sem frameworks',
        'tech-chart': 'Gráficos interativos',
        'footer-text': '💻 Portfólio Engenharia NATA'
        , 'aria-home': 'Voltar para a tela inicial'
            'feature-responsive-desc': 'Desenvolvido para funcionar bem em dispositivos móveis e desktops',
    },
    'it-IT': {
        'page-title': '📱 Sul Progetto',
        'page-subtitle': 'Portfolio di app web',
        'overview-title': 'Panoramica',
            'overview-description': 'Portfolio con app educativi che mostrano concetti pratici in modo semplice.',
        'app-mutuo-desc': 'Calcolatrice di ammortamento bilingue',
        // Dicionário de traduções (limpo e consistente)
        const traducoes = {
            'pt-BR': {
                'page-title': '📱 Sobre o Projeto',
                'page-subtitle': 'Portfólio de apps web',
                'overview-title': 'Visão Geral',
                'overview-description': 'Pequeno portfólio com apps educativos que demonstram conceitos práticos de forma simples.',

                'app-mutuo-desc': 'Calculadora de amortização',
                'app-helice-desc': 'Calculadora de passo de hélice',
                'app-solar-desc': 'Dimensionamento fotovoltaico off-grid',
                'app-about-desc': 'Informações do projeto',

                'calculator-title': 'Calculadora de Empréstimos',
                'what-it-does': 'O que faz:',
                'calculator-description': 'Compara sistemas de amortização e mostra parcelas e gráficos para facilitar comparações.',

                'helice-title': 'Calculadora de Hélice',
                'helice-description': 'Calcula o passo estimado da hélice para ajudar na escolha.',

                'solar-title': 'Dimensionamento Solar',
                'solar-description': 'Ajuda a estimar painéis, baterias e inversor para sistemas off-grid de forma simplificada.',

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
                'app-solar-desc': 'Dimensionamento fotovoltaico off-grid',
                'app-about-desc': 'Informazioni sul progetto',

                'calculator-title': 'Calcolatrice Prestiti',
                'what-it-does': 'Cosa fa:',
                'calculator-description': 'Confronta sistemi di ammortamento e mostra rate e grafici per facilitare i confronti.',

                'helice-title': 'Calcolatore Elica',
                'helice-description': "Calcola il passo stimato dell'elica per aiutare nella scelta.",

                'solar-title': 'Dimensionamento Solare',
                'solar-description': 'Aiuta a stimare pannelli, batterie e inverter per sistemi off-grid in modo semplificato.',

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
        // Gira a seta para cima (180 graus)
        if (seta) {
            seta.style.transform = 'rotate(180deg)';
        }
    } else {
        // Retrai: esconde o conteúdo
        conteudo.style.maxHeight = '0';
        
        // Volta a seta para baixo (0 graus)
        if (seta) {
            seta.style.transform = 'rotate(0deg)';
        }
    }
}

/**
 * Inicializa todas as seções como retraídas ao carregar a página
 * Define altura inicial como 0 para todos os conteúdos expansíveis
 */
document.addEventListener('DOMContentLoaded', function() {
    // Inicializa com o idioma salvo no localStorage ou português como padrão
    trocarIdioma(idiomaAtual);
    
    // Adiciona event listeners nos botões de idioma
    document.getElementById('btnPortugues').addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano').addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Pega todos os conteúdos expansíveis
    const conteudos = document.querySelectorAll('.conteudo-expansivel');
    
    // Define altura inicial como 0 (retraído)
    conteudos.forEach(conteudo => {
        conteudo.style.maxHeight = '0';
        conteudo.style.overflow = 'hidden';
        conteudo.style.transition = 'max-height 0.4s ease';
    });
});

/**
 * Adiciona funcionalidade de teclado (acessibilidade)
 * Permite expandir/retrair seções usando Enter ou Espaço
 */
document.addEventListener('keydown', function(e) {
    // Verifica se o elemento focado é um cabeçalho clicável
    if (e.target.classList.contains('card-header-clicavel')) {
        // Enter ou Espaço expandem/retraem
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            alternarSecao(e.target);
        }
    }
});
