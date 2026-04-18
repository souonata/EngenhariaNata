/**
 * sobre-script.js
 * Página Sobre - Versão Modular ES6
 * 
 * Exibe informações sobre o projeto e os apps disponíveis
 */

import { App } from '../src/core/app.js';

class SobreApp extends App {
    constructor() {
        super({
            appName: 'sobre',
            callbacks: {
                aoInicializar: () => this.inicializarSobre(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
    }

    /**
     * Callback executado após inicialização
     */
    inicializarSobre() {
        this.configurarAccordion();
    }

    /**
     * Callback executado após troca de idioma
     */
    atualizarAposTrocaIdioma() {
        // Nenhuma ação especial necessária
        // As traduções são aplicadas automaticamente pelo i18n
    }

    /**
     * Configura o sistema de accordion (expansão/retração de cards)
     */
    configurarAccordion() {
        const headers = document.querySelectorAll('.card-header-clicavel');
        
        headers.forEach(header => {
            // Evento de clique
            header.addEventListener('click', () => {
                const card = header.closest('.card-expansivel');
                if (card) {
                    card.classList.toggle('expandido');
                    // Atualiza aria-expanded
                    const isExpanded = card.classList.contains('expandido');
                    header.setAttribute('aria-expanded', isExpanded);
                }
            });

            // Suporte a teclado (Enter/Space)
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const card = header.closest('.card-expansivel');
                    if (card) {
                        card.classList.toggle('expandido');
                        // Atualiza aria-expanded
                        const isExpanded = card.classList.contains('expandido');
                        header.setAttribute('aria-expanded', isExpanded);
                    }
                }
            });
        });
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new SobreApp();
app.inicializar();
