// Core da aplicação - inicialização comum a todos os apps

import { i18n, configurarBotoesIdioma } from './i18n.js';
import { theme } from '../components/theme.js';
import { loading } from '../components/loading.js';

export class App {
    constructor(config = {}) {
        this.config = {
            appName: config.appName || 'app',
            traducoes: config.traducoes || {},
            idiomaInicial: config.idiomaInicial || null,
            callbacks: config.callbacks || {}
        };
    }

    async inicializar() {
        try {
            loading.mostrar();

            await this.carregarTraducoes();
            
            i18n.inicializar(this.config.traducoes, this.config.idiomaInicial);
            theme.inicializar();
            configurarBotoesIdioma();

            this.configurarBotaoHome();
            this.configurarEventosComuns();

            if (this.config.callbacks.aoInicializar) {
                await this.config.callbacks.aoInicializar();
            }

            if (this.config.callbacks.aoTrocarIdioma) {
                i18n.registrarCallback(this.config.callbacks.aoTrocarIdioma);
            }

            loading.ocultar();
        } catch (erro) {
            console.error('Erro ao inicializar app:', erro);
            loading.ocultar();
        }
    }

    async carregarTraducoes() {
        if (this.config.traducoes && Object.keys(this.config.traducoes).length > 0) {
            return;
        }

        try {
            const response = await fetch(`../src/i18n/${this.config.appName}.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config.traducoes = await response.json();
        } catch (erro) {
            console.error(`Erro ao carregar traduções de ${this.config.appName}:`, erro);
            throw erro;
        }
    }

    configurarBotaoHome() {
        const btnHome = document.getElementById('btnHome');
        if (btnHome) {
            btnHome.addEventListener('click', () => {
                window.location.href = '../index.html';
            });
        }
    }

    configurarEventosComuns() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharModais();
            }
        });
    }

    fecharModais() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
}

export { i18n, theme, loading };
