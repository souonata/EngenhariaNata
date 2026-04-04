// Bugs / Feedback Reporter — V2.0
// Armazenamento local (localStorage). Sem dependência de Google Forms.

import { App, i18n, loading } from '../src/core/app.js';
import { domCache } from '../src/utils/dom.js';

const STORAGE_KEY = 'engnata_feedbacks';
const MAX_FEEDBACKS = 100;

// ───────────────────────────────────────────────
//  Utilitários de armazenamento
// ───────────────────────────────────────────────

function carregarFeedbacks() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function salvarFeedbacks(lista) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function adicionarFeedback(novo) {
    const lista = carregarFeedbacks();
    lista.unshift(novo); // mais recente primeiro
    if (lista.length > MAX_FEEDBACKS) lista.length = MAX_FEEDBACKS;
    salvarFeedbacks(lista);
}

function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ───────────────────────────────────────────────
//  App principal
// ───────────────────────────────────────────────

class BugsApp extends App {
    constructor() {
        super({
            appName: 'bugs',
            callbacks: {
                aoInicializar: () => this.configurar(),
                aoTrocarIdioma: () => this.atualizarInterface()
            }
        });
        this.categoriaAtual = 'bug';
        this.historicoAberto = false;
    }

    configurar() {
        this.configurarChips();
        this.configurarFormulario();
        this.configurarHistorico();
        this.atualizarInterface();
    }

    // ── Chips de Categoria ──────────────────────

    configurarChips() {
        const container = document.getElementById('categoriaChips');
        if (!container) return;
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('.v2-chip[data-cat]');
            if (!chip) return;
            this.selecionarCategoria(chip.dataset.cat);
        });
    }

    selecionarCategoria(cat) {
        this.categoriaAtual = cat;
        const input = document.getElementById('categoriaInput');
        if (input) input.value = cat;

        document.querySelectorAll('#categoriaChips .v2-chip').forEach(c => {
            c.classList.toggle('ativo', c.dataset.cat === cat);
        });
    }

    // ── Formulário ──────────────────────────────

    configurarFormulario() {
        const form = domCache.get('#bugForm');
        if (!form) return;
        form.addEventListener('submit', (e) => this.enviar(e));
    }

    enviar(e) {
        e.preventDefault();

        const descricao = (domCache.get('#bugDescription')?.value || '').trim();
        const contato   = (domCache.get('#bugContact')?.value || '').trim();

        if (!descricao) {
            this.mostrarStatus(i18n.t('mensagens.camposObrigatorios'), 'erro');
            domCache.get('#bugDescription')?.focus();
            return;
        }

        loading.mostrar();

        const novo = {
            id:        gerarId(),
            timestamp: new Date().toISOString(),
            categoria: this.categoriaAtual,
            mensagem:  descricao,
            contato:   contato || null
        };

        adicionarFeedback(novo);
        this.limparFormulario();
        this.mostrarStatus(i18n.t('mensagens.sucesso'), 'sucesso');
        this.atualizarHistoricoUI();

        loading.ocultar();
    }

    limparFormulario() {
        domCache.get('#bugDescription').value = '';
        domCache.get('#bugContact').value = '';
        this.selecionarCategoria('bug');
    }

    mostrarStatus(msg, tipo) {
        const el = document.getElementById('statusMessage');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        el.className = `status-message status-${tipo}`;
        setTimeout(() => { el.style.display = 'none'; }, 4000);
    }

    // ── Histórico ───────────────────────────────

    configurarHistorico() {
        const toggle = document.getElementById('historicoToggle');
        if (toggle) toggle.addEventListener('click', () => this.toggleHistorico());

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportarJSON());

        this.atualizarHistoricoUI();
    }

    toggleHistorico() {
        this.historicoAberto = !this.historicoAberto;
        const lista = document.getElementById('historicoLista');
        const icon  = document.getElementById('historicoToggleIcon');
        if (lista) lista.classList.toggle('escondido', !this.historicoAberto);
        if (icon)  icon.textContent = this.historicoAberto ? '▴' : '▾';
    }

    atualizarHistoricoUI() {
        const feedbacks = carregarFeedbacks();
        const contador  = document.getElementById('historicoContador');
        const lista     = document.getElementById('historicoLista');
        const vazio     = document.getElementById('historicoVazio');
        const exportBtn = document.getElementById('exportBtn');

        if (contador) contador.textContent = feedbacks.length;
        if (exportBtn) exportBtn.style.display = feedbacks.length ? 'block' : 'none';

        if (!lista) return;

        // Remove itens antigos, mantém mensagem vazia
        lista.querySelectorAll('.v2-feedback-item').forEach(el => el.remove());

        if (feedbacks.length === 0) {
            if (vazio) vazio.style.display = 'block';
            return;
        }

        if (vazio) vazio.style.display = 'none';

        feedbacks.forEach(fb => {
            lista.appendChild(this.criarItemHistorico(fb));
        });
    }

    criarItemHistorico(fb) {
        const item = document.createElement('div');
        item.className = 'v2-feedback-item';

        const catLabels = {
            bug:      { classe: 'v2-cat-bug',      label: i18n.t('categorias.bug') },
            sugestao: { classe: 'v2-cat-sugestao', label: i18n.t('categorias.sugestao') },
            elogio:   { classe: 'v2-cat-elogio',   label: i18n.t('categorias.elogio') }
        };
        const cat = catLabels[fb.categoria] || catLabels.bug;

        const data = new Date(fb.timestamp);
        const dataStr = data.toLocaleDateString() + ' ' + data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        item.innerHTML = `
            <div class="v2-feedback-item-meta">
                <span class="v2-feedback-item-cat ${cat.classe}">${cat.label}</span>
                <span class="v2-feedback-item-data">${dataStr}</span>
            </div>
            <div class="v2-feedback-item-msg">${this.escapar(fb.mensagem)}</div>
        `;
        return item;
    }

    escapar(texto) {
        return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Exportar ────────────────────────────────

    exportarJSON() {
        const feedbacks = carregarFeedbacks();
        const blob = new Blob([JSON.stringify(feedbacks, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `engnata-feedbacks-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Interface ───────────────────────────────

    atualizarInterface() {
        document.title = i18n.t('titulo') + ' - Engenharia NATA';
        // Atualiza os textos dos chips via data-i18n (já tratado pelo i18n global)
        // mas atualiza também o histórico pois os rótulos de categoria mudam
        this.atualizarHistoricoUI();
    }
}

const app = new BugsApp();
app.inicializar();

