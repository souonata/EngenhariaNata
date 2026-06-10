/**
 * sobre-script.js
 * Página Sobre - Versão Modular ES6
 */

import { App, i18n } from '../src/core/app.js';

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

    inicializarSobre() {
        this.configurarAccordion();
        this.reordenarCardsApps();
        this.atualizarAcessibilidadeAccordions();
    }

    atualizarAposTrocaIdioma() {
        this.reordenarCardsApps();
        this.atualizarAcessibilidadeAccordions();
        document.title = i18n.t('page.titleFull');
    }

    /**
     * Reordena os cards de apps alfabeticamente pelo h2 traduzido,
     * mantendo o card de bugs sempre no final.
     */
    reordenarCardsApps() {
        const container = document.getElementById('apps-cards-container');
        if (!container) return;

        const cards = Array.from(container.querySelectorAll('[data-app-key]'));
        const bugsCard = cards.find(c => c.dataset.appKey === 'bugs');
        const appCards = cards.filter(c => c.dataset.appKey !== 'bugs');

        appCards.sort((a, b) => {
            const tA = (a.querySelector('h2')?.textContent || '').trim();
            const tB = (b.querySelector('h2')?.textContent || '').trim();
            return tA.localeCompare(tB, undefined, { sensitivity: 'base' });
        });

        [...appCards, bugsCard].filter(Boolean).forEach(card => container.appendChild(card));
    }

    configurarAccordion() {
        const headers = document.querySelectorAll('.card-header-clicavel');

        headers.forEach(header => {
            header.setAttribute('tabindex', '0');

            header.addEventListener('click', () => {
                this.alternarCard(header);
            });

            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.alternarCard(header);
                }
            });
        });
    }

    alternarCard(header) {
        const card = header.closest('.card-expansivel');
        if (!card) return;

        card.classList.toggle('expandido');
        this.atualizarHeaderAccordion(header, card.classList.contains('expandido'));
    }

    atualizarAcessibilidadeAccordions() {
        document.querySelectorAll('.card-header-clicavel').forEach(header => {
            const card = header.closest('.card-expansivel');
            this.atualizarHeaderAccordion(header, Boolean(card?.classList.contains('expandido')));
        });
    }

    atualizarHeaderAccordion(header, expandido) {
        header.setAttribute('aria-expanded', expandido ? 'true' : 'false');
        header.setAttribute('aria-label', i18n.t(expandido ? 'aria.collapseCard' : 'aria.expandCard'));
    }
}

const app = new SobreApp();
app.inicializar();
