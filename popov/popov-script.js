/**
 * popov-script.js
 * App Popov IA (privado via Tailscale)
 *
 * Objetivo:
 * - Embutir (iframe) o site Popov IA rodando na sua tailnet
 * - Permitir configurar a URL (salva no localStorage) sem rebuild
 * - Exibir fallback (abrir em nova aba + instruções) quando não carregar
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { carregarDados, salvarDados, removerDados } from '../src/utils/storage.js';

// ============================================
// CONFIGURAÇÕES
// ============================================

// URL padrão (opcional). Se vazio, o app pede para configurar.
// Exemplo: https://popov-ia.<sua_tailnet>.ts.net
const DEFAULT_POPOV_URL = '';

// Chave de storage (será prefixada por engnata_)
const STORAGE_KEY_POPOV_URL = 'popov_url';

// Timeout para sinalizar que pode ter falhado (ms)
const IFRAME_TIMEOUT_MS = 6000;

// ============================================
// APP
// ============================================

class PopovApp extends App {
    constructor() {
        super({
            appName: 'popov',
            callbacks: {
                aoInicializar: () => this.inicializarPopov(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });

        this.timeoutHandle = null;
        this.urlAtual = '';
    }

    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual] || this.config.traducoes['pt-BR'] || {};
    }

    inicializarPopov() {
        this.elementos = this.obterElementos();
        this.configurarEventos();

        const url = this.obterUrlConfigurada();
        this.aplicarUrl(url);
    }

    atualizarAposTrocaIdioma() {
        // Atualiza apenas textos de status (se estiverem visíveis)
        // O restante é coberto pelo i18n via data-i18n.
        this.atualizarStatusAtual();
    }

    obterElementos() {
        return {
            frame: document.getElementById('popovFrame'),
            btnAbrirNovaAba: document.getElementById('btnAbrirNovaAba'),
            btnConfigurarUrl: document.getElementById('btnConfigurarUrl'),
            statusBox: document.getElementById('statusBox'),
            statusTitle: document.getElementById('statusTitle'),
            statusText: document.getElementById('statusText'),
            iframeLoading: document.getElementById('iframeLoading')
        };
    }

    configurarEventos() {
        const { frame, btnConfigurarUrl } = this.elementos;

        if (btnConfigurarUrl) {
            btnConfigurarUrl.addEventListener('click', () => this.abrirDialogoConfigUrl());
        }

        if (frame) {
            frame.addEventListener('load', () => {
                this.ocultarLoading();
                this.limparTimeout();

                // Observação: mesmo com X-Frame-Options/CSP bloqueando, o evento load pode disparar.
                // Por isso, tratamos como “carregou” e mantemos a instrução de abrir em nova aba visível.
                this.definirStatus('success', 'status.loadedTitle', 'status.loadedText');
            });
        }
    }

    obterUrlConfigurada() {
        const urlSalva = carregarDados(STORAGE_KEY_POPOV_URL, '');
        return (urlSalva || DEFAULT_POPOV_URL || '').toString().trim();
    }

    validarUrl(url) {
        if (!url) return false;
        try {
            const u = new URL(url);
            return u.protocol === 'https:' || u.protocol === 'http:';
        } catch {
            return false;
        }
    }

    aplicarUrl(url) {
        const { frame, btnAbrirNovaAba } = this.elementos;

        this.urlAtual = url || '';
        this.atualizarLinks(url);

        if (!this.validarUrl(url)) {
            if (frame) frame.removeAttribute('src');
            this.ocultarLoading();
            this.limparTimeout();
            this.definirStatus('warning', 'status.waitingTitle', 'status.waitingText');
            if (btnAbrirNovaAba) btnAbrirNovaAba.classList.add('is-disabled');
            return;
        }

        if (btnAbrirNovaAba) btnAbrirNovaAba.classList.remove('is-disabled');

        this.definirStatus('warning', 'status.loadingTitle', 'status.loadingText');
        this.mostrarLoading();

        if (frame) {
            frame.src = url;
        }

        this.limparTimeout();
        this.timeoutHandle = window.setTimeout(() => {
            this.ocultarLoading();
            // Sem garantia de detectar bloqueio de iframe. Apenas orienta o usuário.
            this.definirStatus('warning', 'status.timeoutTitle', 'status.timeoutText');
        }, IFRAME_TIMEOUT_MS);
    }

    atualizarLinks(url) {
        const { btnAbrirNovaAba } = this.elementos;
        if (!btnAbrirNovaAba) return;

        if (this.validarUrl(url)) {
            btnAbrirNovaAba.href = url;
            btnAbrirNovaAba.setAttribute('aria-disabled', 'false');
        } else {
            btnAbrirNovaAba.href = '#';
            btnAbrirNovaAba.setAttribute('aria-disabled', 'true');
        }
    }

    abrirDialogoConfigUrl() {
        const urlAtual = this.obterUrlConfigurada();
        const titulo = this.traducoes?.dialogs?.urlTitle || 'Configurar URL';
        const texto = this.traducoes?.dialogs?.urlPrompt || 'Cole a URL do Popov IA (Tailscale Serve):';
        const placeholder = this.traducoes?.dialogs?.urlPlaceholder || 'https://popov-ia.<sua_tailnet>.ts.net';

        // Prompt simples (sem bibliotecas); mantém o projeto leve.
        // Comentário: prompt não permite placeholder real, então incluímos no texto.
        const entrada = window.prompt(`${titulo}\n\n${texto}\n${placeholder}`, urlAtual);

        // Cancelado
        if (entrada === null) return;

        const urlLimpa = (entrada || '').trim();

        // Permite “limpar” a configuração
        if (!urlLimpa) {
            removerDados(STORAGE_KEY_POPOV_URL);
            this.aplicarUrl('');
            return;
        }

        if (!this.validarUrl(urlLimpa)) {
            window.alert(this.traducoes?.status?.invalidUrl || 'URL inválida. Use http(s)://...');
            return;
        }

        salvarDados(STORAGE_KEY_POPOV_URL, urlLimpa);
        this.aplicarUrl(urlLimpa);
    }

    definirStatus(tipo, chaveTitulo, chaveTexto) {
        const { statusBox, statusTitle, statusText } = this.elementos;
        if (!statusBox || !statusTitle || !statusText) return;

        statusBox.classList.remove('is-success', 'is-warning', 'is-error');
        if (tipo === 'success') statusBox.classList.add('is-success');
        if (tipo === 'warning') statusBox.classList.add('is-warning');
        if (tipo === 'error') statusBox.classList.add('is-error');

        statusTitle.textContent = i18n.t(chaveTitulo);
        statusText.textContent = i18n.t(chaveTexto);
    }

    atualizarStatusAtual() {
        // Re-renderiza o texto atual do status reaplicando o mesmo estado,
        // usando as strings já presentes nos data-i18n (ou as chaves usadas aqui).
        // Como guardamos o texto final no DOM, apenas garantimos que não fique “desalinhado”.
        // Neste app, as mudanças de idioma já cobrem praticamente tudo.
    }

    mostrarLoading() {
        const { iframeLoading } = this.elementos;
        if (!iframeLoading) return;
        iframeLoading.classList.add('is-visible');
        iframeLoading.setAttribute('aria-hidden', 'false');
    }

    ocultarLoading() {
        const { iframeLoading } = this.elementos;
        if (!iframeLoading) return;
        iframeLoading.classList.remove('is-visible');
        iframeLoading.setAttribute('aria-hidden', 'true');
    }

    limparTimeout() {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new PopovApp();
        app.inicializar();
    });
} else {
    const app = new PopovApp();
    app.inicializar();
}

