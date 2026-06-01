/**
 * sobre-script.js
 * Página Sobre - Versão Modular ES6
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

    inicializarSobre() {
        this.configurarAccordion();
        this.reordenarCardsApps();
    }

    atualizarAposTrocaIdioma() {
        this.reordenarCardsApps();
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

        [...appCards, bugsCard].forEach(card => container.appendChild(card));
    }

    configurarAccordion() {
        const headers = document.querySelectorAll('.card-header-clicavel');

        headers.forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.card-expansivel');
                if (card) {
                    card.classList.toggle('expandido');
                    header.setAttribute('aria-expanded', card.classList.contains('expandido'));
                }
            });

            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const card = header.closest('.card-expansivel');
                    if (card) {
                        card.classList.toggle('expandido');
                        header.setAttribute('aria-expanded', card.classList.contains('expandido'));
                    }
                }
            });
        });
    }
}

const app = new SobreApp();
app.inicializar();
