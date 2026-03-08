// Core da aplicação - inicialização comum a todos os apps

import { i18n, configurarBotoesIdioma } from './i18n.js';
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

            // Registra callback de idioma ANTES de inicializar app
            if (this.config.callbacks.aoTrocarIdioma) {
                i18n.registrarCallback(this.config.callbacks.aoTrocarIdioma);
            }

            i18n.inicializar(this.config.traducoes, this.config.idiomaInicial);
            configurarBotoesIdioma();

            this.configurarBotaoHome();
            this.configurarEventosComuns();
            this.configurarInputsNumericosMoveis();

            if (this.config.callbacks.aoInicializar) {
                await this.config.callbacks.aoInicializar();
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

    configurarInputsNumericosMoveis() {
        const inputs = document.querySelectorAll('input.valor-input, input[type="number"]');

        inputs.forEach(input => {
            if (input.dataset.mobileInputConfigured === 'true') {
                return;
            }

            const step = (input.getAttribute('step') || '').replace(',', '.');
            const value = (input.value || '').trim();
            const ehDecimal =
                (step && !Number.isInteger(parseFloat(step))) ||
                /[,.]/.test(value);

            if (!input.hasAttribute('inputmode')) {
                input.setAttribute('inputmode', ehDecimal ? 'decimal' : 'numeric');
            }

            if (!input.hasAttribute('pattern')) {
                input.setAttribute('pattern', ehDecimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*');
            }

            if (!input.hasAttribute('enterkeyhint')) {
                input.setAttribute('enterkeyhint', 'done');
            }

            if (!input.hasAttribute('autocomplete')) {
                input.setAttribute('autocomplete', 'off');
            }

            const selecionarConteudo = () => {
                if (!input.disabled && !input.readOnly) {
                    input.select();
                }
            };

            input.addEventListener('focus', selecionarConteudo);
            input.addEventListener('click', selecionarConteudo);
            input.addEventListener('touchend', selecionarConteudo);

            input.dataset.mobileInputConfigured = 'true';
        });
    }

    fecharModais() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
}

export { i18n, loading };
