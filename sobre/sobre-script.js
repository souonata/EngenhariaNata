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
        'overview-description': 'Portfólio com 2 apps web usando HTML5, CSS3 e JavaScript puro.',
        'app-mutuo-desc': 'Calculadora de amortização bilíngue',
        'app-about-desc': 'Informações do projeto',
        'calculator-title': 'Calculadora de Empréstimos BR/IT',
        'what-it-does': 'O que faz:',
        'calculator-description': 'Compara 3 sistemas de amortização de empréstimos: SAC, Price e Americano. Ajuda pessoas a entenderem qual sistema é melhor para sua situação financeira.',
        'feature-bilingual-title': 'Bilíngue',
        'feature-bilingual-desc': 'Português e Italiano com troca instantânea',
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
    },
    'it-IT': {
        'page-title': '📱 Sul Progetto',
        'page-subtitle': 'Portfolio di app web',
        'overview-title': 'Panoramica',
        'overview-description': 'Portfolio con 2 app web utilizzando HTML5, CSS3 e JavaScript puro.',
        'app-mutuo-desc': 'Calcolatrice di ammortamento bilingue',
        'app-about-desc': 'Informazioni sul progetto',
        'calculator-title': 'Calcolatrice Prestiti BR/IT',
        'what-it-does': 'Cosa fa:',
        'calculator-description': 'Confronta 3 sistemi di ammortamento dei prestiti: SAC, alla Francese e Americano. Aiuta le persone a capire quale sistema è migliore per la loro situazione finanziaria.',
        'feature-bilingual-title': 'Bilingue',
        'feature-bilingual-desc': 'Portoghese e Italiano con cambio istantaneo',
        'feature-charts-title': 'Grafici',
        'feature-charts-desc': "Visualizzazione dell'evoluzione degli interessi e ammortamento",
        'feature-responsive-title': 'Responsive',
        'feature-responsive-desc': 'Funziona perfettamente su cellulare, tablet e desktop',
        'feature-fast-title': 'Veloce',
        'feature-fast-desc': 'Calcoli istantanei al cambio dei valori',
        'stat-html': 'righe HTML',
        'stat-js': 'righe JavaScript',
        'stat-css': 'righe CSS',
        'features-title': 'Caratteristiche Principali',
        'resource-bilingual-title': '🌍 Bilingue',
        'resource-bilingual-desc': 'Cambia tra Portoghese e Italiano con 1 clic. La valuta cambia automaticamente (R$ ↔ €).',
        'resource-charts-title': '📊 Grafici Interattivi',
        'resource-charts-desc': "Visualizza l'evoluzione degli interessi e ammortamento nel tempo.",
        'resource-mobile-title': '📱 Mobile-First',
        'resource-mobile-desc': 'Funziona perfettamente su cellulari, tablet e computer.',
        'tech-title': 'Tecnologie Utilizzate',
        'tech-html': 'Struttura delle pagine',
        'tech-css': 'Stili e animazioni',
        'tech-js': 'Senza frameworks',
        'tech-chart': 'Grafici interattivi',
        'footer-text': '💻 Portfolio Ingegneria NATA'
    }
};

/**
 * Troca o idioma da interface
 * @param {string} novoIdioma - Código do idioma ('pt-BR' ou 'it-IT')
 */
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    
    // Salva no localStorage para manter entre páginas
    localStorage.setItem('idiomaPreferido', novoIdioma);
    
    // Atualiza o atributo lang do HTML
    document.documentElement.lang = novoIdioma;
    
    // Atualiza todos os elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza botões ativos/inativos
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    console.log(`🌍 Idioma alterado para: ${novoIdioma}`);
}

/**
 * Alterna a expansão/retração de uma seção do accordion
 * Quando clica no cabeçalho, o conteúdo expande ou retrai com animação suave
 * @param {HTMLElement} cabecalho - Elemento do cabeçalho clicado
 */
function alternarSecao(cabecalho) {
    // Pega o card pai (elemento .card-expansivel)
    const card = cabecalho.closest('.card-expansivel');
    
    // Se não encontrar o card pai, sai da função
    if (!card) return;
    
    // Pega o conteúdo que será expandido/retraído
    const conteudo = card.querySelector('.conteudo-expansivel');
    
    // Pega a seta indicadora
    const seta = cabecalho.querySelector('.seta-expansao');
    
    // Alterna a classe 'expandido' no card
    card.classList.toggle('expandido');
    
    // Anima a altura do conteúdo
    if (card.classList.contains('expandido')) {
        // Expande: mostra o conteúdo
        conteudo.style.maxHeight = conteudo.scrollHeight + 'px';
        
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
    
    // Mensagem no console para debug
    console.log('🎭 Sistema de accordion inicializado! Clique nos títulos para expandir/retrair.');
    console.log(`📦 Total de seções expansíveis: ${conteudos.length}`);
    console.log('🌍 Sistema i18n inicializado! Use os botões para trocar idioma.');
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
