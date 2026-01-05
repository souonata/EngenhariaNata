// Gerenciador de tema claro/escuro

import { salvarDados, carregarDados } from '../utils/storage.js';

class ThemeManager {
    constructor() {
        this.temaAtual = 'light';
    }

    inicializar() {
        const temaSalvo = carregarDados('tema', 'light');
        this.aplicarTema(temaSalvo);
        this.configurarBotao();
    }

    aplicarTema(tema) {
        this.temaAtual = tema;
        document.body.setAttribute('data-theme', tema);
        salvarDados('tema', tema);
        this.atualizarBotao();
    }

    alternarTema() {
        const novoTema = this.temaAtual === 'light' ? 'dark' : 'light';
        this.aplicarTema(novoTema);
    }

    configurarBotao() {
        const btnTema = document.getElementById('btnTema');
        if (btnTema) {
            btnTema.addEventListener('click', () => this.alternarTema());
        }
    }

    atualizarBotao() {
        const btnTema = document.getElementById('btnTema');
        if (btnTema) {
            const icone = this.temaAtual === 'light' ? '🌙' : '☀️';
            const titulo = this.temaAtual === 'light' ? 'Modo escuro' : 'Modo claro';
            btnTema.textContent = icone;
            btnTema.setAttribute('title', titulo);
            btnTema.setAttribute('aria-label', titulo);
        }
    }

    obterTema() {
        return this.temaAtual;
    }
}

export const theme = new ThemeManager();
