/**
 * popov-script.js
 * App Popov IA local com backend FastAPI + Ollama.
 */

import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { carregarDados, removerDados, salvarDados } from '../src/utils/storage.js';

const DEFAULT_API_BASE = '';
const STORAGE_KEY_API_BASE = 'popov_api_base';
const STORAGE_KEY_API_TOKEN = 'popov_api_token';
const STORAGE_KEY_CONVERSATION_ID = 'popov_conversation_id';
const STORAGE_KEY_MODEL_PREFERENCE = 'popov_model_preference';

const ROLE_USER = 'user';
const ROLE_ASSISTANT = 'assistant';
const ROLE_SYSTEM = 'system';

class PopovApp extends App {
    constructor() {
        super({
            appName: 'popov',
            callbacks: {
                aoInicializar: () => this.inicializarPopov(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });

        this.abortController = null;
        this.elementos = null;
        this.estaPronto = false;
        this.conversationId = carregarDados(STORAGE_KEY_CONVERSATION_ID, this.criarConversationId());
        this.apiBase = '';
        this.apiToken = '';
        this.modelPreference = '';
    }

    inicializarPopov() {
        this.elementos = this.obterElementos();
        this.configurarEventos();
        this.apiBase = this.obterApiBase();
        this.apiToken = this.obterToken();
        this.modelPreference = this.obterPreferenciaModelo();
        this.aplicarPreferenciaModeloNoUI();
        this.estaPronto = true;

        this.aplicarPlaceholderInput();
        this.atualizarStatusInicial();
        this.renderMensagemSistema(i18n.t('chat.welcome'));
    }

    atualizarAposTrocaIdioma() {
        if (!this.estaPronto || !this.elementos) {
            return;
        }

        this.aplicarPlaceholderInput();
        this.atualizarStatusInicial();
    }

    obterElementos() {
        return {
            chatContainer: document.getElementById('chatContainer'),
            chatForm: document.getElementById('chatForm'),
            chatInput: document.getElementById('chatInput'),
            btnEnviar: document.getElementById('btnEnviar'),
            btnParar: document.getElementById('btnParar'),
            btnConfigurarApi: document.getElementById('btnConfigurarApi'),
            btnLimparConversa: document.getElementById('btnLimparConversa'),
            modelSelect: document.getElementById('modelSelect'),
            statusBox: document.getElementById('statusBox'),
            statusTitle: document.getElementById('statusTitle'),
            statusText: document.getElementById('statusText')
        };
    }

    configurarEventos() {
        const { btnConfigurarApi, btnLimparConversa, chatForm, chatInput, btnParar, modelSelect } = this.elementos;

        if (btnConfigurarApi) {
            btnConfigurarApi.addEventListener('click', () => this.abrirDialogoConfiguracao());
        }

        if (btnLimparConversa) {
            btnLimparConversa.addEventListener('click', () => this.limparConversa());
        }

        if (chatForm) {
            chatForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.enviarMensagem();
            });
        }

        if (chatInput) {
            chatInput.addEventListener('keydown', async (event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    await this.enviarMensagem();
                }
            });
        }

        if (btnParar) {
            btnParar.addEventListener('click', () => this.pararStreaming());
        }

        if (modelSelect) {
            modelSelect.addEventListener('change', () => {
                this.modelPreference = (modelSelect.value || '').trim();
                salvarDados(STORAGE_KEY_MODEL_PREFERENCE, this.modelPreference);
            });
        }
    }

    obterApiBase() {
        const base = carregarDados(STORAGE_KEY_API_BASE, DEFAULT_API_BASE);
        return (base || '').toString().trim().replace(/\/+$/, '');
    }

    obterToken() {
        return (carregarDados(STORAGE_KEY_API_TOKEN, '') || '').toString().trim();
    }

    obterPreferenciaModelo() {
        const saved = (carregarDados(STORAGE_KEY_MODEL_PREFERENCE, '') || '').toString().trim();
        return this.normalizarModelo(saved);
    }

    aplicarPreferenciaModeloNoUI() {
        const { modelSelect } = this.elementos || {};
        if (!modelSelect) {
            return;
        }
        modelSelect.value = this.normalizarModelo(this.modelPreference);
    }

    normalizarModelo(modelo) {
        const value = (modelo || '').trim().toLowerCase();
        if (value === 'hunter-alpha' || value === 'healer-alpha') {
            return value;
        }
        return '';
    }

    validarUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
            return false;
        }
    }

    atualizarStatusInicial() {
        if (!this.elementos) {
            return;
        }

        if (!this.validarUrl(this.apiBase)) {
            this.definirStatus('warning', 'status.waitingTitle', 'status.waitingText');
            return;
        }

        if (!this.apiToken) {
            this.definirStatus('warning', 'status.tokenTitle', 'status.tokenText');
            return;
        }

        this.definirStatus('success', 'status.readyTitle', 'status.readyText');
        this.verificarSaude();
    }

    async verificarSaude() {
        try {
            const response = await fetch(`${this.apiBase}/health`, {
                method: 'GET',
                headers: this.montarHeaders(false)
            });

            if (!response.ok) {
                this.definirStatus('warning', 'status.offlineTitle', 'status.offlineText');
                return;
            }

            this.definirStatus('success', 'status.onlineTitle', 'status.onlineText');
        } catch {
            this.definirStatus('warning', 'status.offlineTitle', 'status.offlineText');
        }
    }

    montarHeaders(comJson = true) {
        const headers = {};

        if (comJson) {
            headers['Content-Type'] = 'application/json';
        }

        if (this.apiToken) {
            headers.Authorization = `Bearer ${this.apiToken}`;
        }

        return headers;
    }

    async enviarMensagem() {
        const { chatInput, btnEnviar, btnParar } = this.elementos;

        if (!chatInput || !btnEnviar || !btnParar) return;

        if (!this.validarUrl(this.apiBase)) {
            this.definirStatus('warning', 'status.waitingTitle', 'status.waitingText');
            this.renderMensagemSistema(i18n.t('chat.missingConfig'));
            return;
        }

        if (!this.apiToken) {
            this.definirStatus('warning', 'status.tokenTitle', 'status.tokenText');
            this.renderMensagemSistema(i18n.t('chat.missingToken'));
            return;
        }

        const mensagemOriginal = (chatInput.value || '').trim();
        if (!mensagemOriginal) return;

        const comandoModelo = this.extrairComandoModelo(mensagemOriginal);
        const mensagem = comandoModelo.mensagem;
        const modeloSelecionado = comandoModelo.modelo || this.modelPreference;

        if (!mensagem) {
            this.renderMensagemSistema('Use @hunter ou @healer seguido da pergunta. Exemplo: @hunter explique o teorema de Bernoulli.');
            return;
        }

        chatInput.value = '';
        this.renderMensagem(ROLE_USER, mensagem);
        const assistantMessage = this.renderMensagem(ROLE_ASSISTANT, '');

        this.abortController = new AbortController();
        btnEnviar.setAttribute('disabled', 'true');
        btnParar.removeAttribute('disabled');
        this.definirStatus('warning', 'status.streamingTitle', 'status.streamingText');

        try {
            const response = await fetch(`${this.apiBase}/chat/stream`, {
                method: 'POST',
                headers: this.montarHeaders(true),
                body: JSON.stringify({
                    message: mensagem,
                    conversation_id: this.conversationId,
                    model: modeloSelecionado || undefined
                }),
                signal: this.abortController.signal
            });

            if (!response.ok || !response.body) {
                const erro = await this.extrairErroResposta(response);
                throw new Error(erro || i18n.t('chat.genericError'));
            }

            await this.processarStream(response.body, assistantMessage);
            this.definirStatus('success', 'status.onlineTitle', 'status.onlineText');
        } catch (erro) {
            this.removerMensagemSeVazia(assistantMessage);

            if (erro && erro.name === 'AbortError') {
                this.renderMensagemSistema(i18n.t('chat.stopped'));
                this.definirStatus('warning', 'status.stoppedTitle', 'status.stoppedText');
            } else {
                const mensagemErro = erro && erro.message ? erro.message : i18n.t('chat.genericError');
                this.renderMensagemSistema(`${i18n.t('chat.errorPrefix')}: ${mensagemErro}`);
                this.definirStatus('error', 'status.errorTitle', 'status.errorText');
            }
        } finally {
            this.abortController = null;
            btnParar.setAttribute('disabled', 'true');
            btnEnviar.removeAttribute('disabled');
            chatInput.focus();
        }
    }

    async extrairErroResposta(response) {
        try {
            const data = await response.json();
            return data.detail || data.error || JSON.stringify(data);
        } catch {
            return `${response.status} ${response.statusText}`;
        }
    }

    async processarStream(streamBody, messageElement) {
        const reader = streamBody.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let textoFinal = '';

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const eventos = this.extrairEventosSSE(buffer);
            buffer = eventos.restante;

            for (const eventoRaw of eventos.lista) {
                const dataLine = eventoRaw
                    .split(/\r?\n/)
                    .find((linha) => linha.startsWith('data:'));

                if (!dataLine) continue;

                const jsonText = dataLine.replace(/^data:\s?/, '').trim();
                if (!jsonText) continue;

                const evento = JSON.parse(jsonText);
                if (evento.type === 'token') {
                    textoFinal += evento.content || '';
                    messageElement.textContent = textoFinal;
                    this.scrollChatParaFim();
                }

                if (evento.type === 'done' && evento.conversation_id) {
                    this.conversationId = evento.conversation_id;
                    salvarDados(STORAGE_KEY_CONVERSATION_ID, this.conversationId);
                }

                if (evento.type === 'error') {
                    throw new Error(evento.message || i18n.t('chat.genericError'));
                }
            }

            if (done) {
                break;
            }
        }

        if (!textoFinal) {
            messageElement.textContent = i18n.t('chat.emptyAnswer');
        }
    }

    extrairEventosSSE(buffer) {
        const lista = [];
        let restante = buffer;

        const separadores = ['\r\n\r\n', '\n\n'];

        while (true) {
            let menorIndex = -1;
            let separadorUsado = '';

            for (const separador of separadores) {
                const idx = restante.indexOf(separador);
                if (idx !== -1 && (menorIndex === -1 || idx < menorIndex)) {
                    menorIndex = idx;
                    separadorUsado = separador;
                }
            }

            if (menorIndex === -1) {
                break;
            }

            const eventoRaw = restante.slice(0, menorIndex);
            restante = restante.slice(menorIndex + separadorUsado.length);
            if (eventoRaw.trim()) {
                lista.push(eventoRaw);
            }
        }

        return { lista, restante };
    }

    removerMensagemSeVazia(messageElement) {
        if (!messageElement) return;
        if ((messageElement.textContent || '').trim()) return;

        const wrapper = messageElement.closest('.chat-message');
        if (wrapper && wrapper.parentElement) {
            wrapper.parentElement.removeChild(wrapper);
        }
    }

    pararStreaming() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    limparConversa() {
        const { chatContainer } = this.elementos;
        if (!chatContainer) return;

        chatContainer.innerHTML = '';
        this.conversationId = this.criarConversationId();
        salvarDados(STORAGE_KEY_CONVERSATION_ID, this.conversationId);
        this.renderMensagemSistema(i18n.t('chat.cleared'));
    }

    abrirDialogoConfiguracao() {
        const atualBase = this.apiBase || '';
        const atualToken = this.apiToken || '';

        const base = window.prompt(
            `${i18n.t('dialogs.apiTitle')}\n\n${i18n.t('dialogs.apiPrompt')}`,
            atualBase
        );

        if (base === null) {
            return;
        }

        const baseLimpa = (base || '').trim().replace(/\/+$/, '');
        if (!this.validarUrl(baseLimpa)) {
            window.alert(i18n.t('status.invalidUrl'));
            return;
        }

        const token = window.prompt(
            `${i18n.t('dialogs.tokenTitle')}\n\n${i18n.t('dialogs.tokenPrompt')}`,
            atualToken
        );

        if (token === null) {
            return;
        }

        const tokenLimpo = (token || '').trim();
        if (!tokenLimpo) {
            window.alert(i18n.t('status.invalidToken'));
            return;
        }

        this.apiBase = baseLimpa;
        this.apiToken = tokenLimpo;

        salvarDados(STORAGE_KEY_API_BASE, this.apiBase);
        salvarDados(STORAGE_KEY_API_TOKEN, this.apiToken);

        this.renderMensagemSistema(i18n.t('chat.configSaved'));
        this.atualizarStatusInicial();
    }

    renderMensagem(role, content) {
        const { chatContainer } = this.elementos;
        if (!chatContainer) return document.createElement('div');

        const wrapper = document.createElement('div');
        wrapper.className = `chat-message chat-message-${role}`;

        const roleLabel = document.createElement('div');
        roleLabel.className = 'chat-message-role';
        roleLabel.textContent = this.obterNomeRole(role);

        const body = document.createElement('div');
        body.className = 'chat-message-content';
        body.textContent = content;

        wrapper.appendChild(roleLabel);
        wrapper.appendChild(body);
        chatContainer.appendChild(wrapper);
        this.scrollChatParaFim();

        return body;
    }

    renderMensagemSistema(content) {
        this.renderMensagem(ROLE_SYSTEM, content);
    }

    obterNomeRole(role) {
        if (role === ROLE_USER) return i18n.t('chat.roleUser');
        if (role === ROLE_ASSISTANT) return i18n.t('chat.roleAssistant');
        return i18n.t('chat.roleSystem');
    }

    scrollChatParaFim() {
        const { chatContainer } = this.elementos;
        if (!chatContainer) return;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    aplicarPlaceholderInput() {
        if (!this.elementos) {
            return;
        }

        const { chatInput } = this.elementos;
        if (!chatInput) return;
        chatInput.placeholder = i18n.t('chat.inputPlaceholder');
    }

    criarConversationId() {
        const rand = Math.random().toString(36).slice(2, 10);
        return `conv_${Date.now()}_${rand}`;
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

    resetarConfiguracao() {
        removerDados(STORAGE_KEY_API_BASE);
        removerDados(STORAGE_KEY_API_TOKEN);
        this.apiBase = '';
        this.apiToken = '';
        this.atualizarStatusInicial();
    }

    extrairComandoModelo(texto) {
        const entrada = (texto || '').trim();
        const match = entrada.match(/^(@|\/)(hunter(?:-alpha)?|healer(?:-alpha)?)\b\s*:?[\s\n]*/i);

        if (!match) {
            return { mensagem: entrada, modelo: '' };
        }

        const alias = match[2].toLowerCase().startsWith('hunter') ? 'hunter-alpha' : 'healer-alpha';
        const mensagem = entrada.slice(match[0].length).trim();
        return { mensagem, modelo: alias };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new PopovApp();
        app.inicializar();
    });
} else {
    const app = new PopovApp();
    app.inicializar();
}
