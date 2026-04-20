/**
 * NOME-APP-script.js
 * DESCRIÇÃO EM UMA LINHA
 *
 * Referência técnica: NORMA/FONTE
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero } from '../src/utils/formatters.js';

// ============================================
// CONSTANTES
// ============================================

const SLIDER_TO_INPUT = {
    sliderExemplo: 'inputExemplo'
};

// ============================================
// CLASSE PRINCIPAL
// ============================================

class NomeApp extends App {
    constructor() {
        super({
            appName: 'NOME-APP',
            callbacks: {
                aoInicializar: () => this.inicializar(),
                aoTrocarIdioma: () => this.atualizarResultados()
            }
        });
        this.valores = {
            exemplo: 10
        };
    }

    inicializar() {
        this.configurarSliders();
        this.atualizarResultados();
    }

    configurarSliders() {
        Object.entries(SLIDER_TO_INPUT).forEach(([sliderId, inputId]) => {
            const slider = document.getElementById(sliderId);
            const input  = document.getElementById(inputId);
            if (!slider || !input) { return; }

            slider.addEventListener('input', () => {
                input.value = slider.value;
                this.lerValores();
                this.atualizarResultados();
            });
            input.addEventListener('change', () => {
                slider.value = input.value;
                this.lerValores();
                this.atualizarResultados();
            });
        });
    }

    lerValores() {
        this.valores.exemplo = Number(document.getElementById('inputExemplo').value);
    }

    calcular() {
        const { exemplo } = this.valores;
        // TODO: implementar cálculo
        return { resultado: exemplo * 2 };
    }

    atualizarResultados() {
        this.lerValores();
        const res = this.calcular();
        const el = document.getElementById('resultadoValor');
        if (el) {
            el.textContent = formatarNumero(res.resultado, 2);
        }
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = new NomeApp();
app.inicializar();
