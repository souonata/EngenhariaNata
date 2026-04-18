// Bugs / Feedback Reporter — V2.0
// Formulario customizado com envio direto para Google Forms.

import { App, i18n, loading } from '../src/core/app.js';
import { domCache } from '../src/utils/dom.js';

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc3Qo7Otct-L7mN2qS9r967oBol6n6gnsEJz2nfkz89sSpBcQ/formResponse';
const GOOGLE_FORM_FIELDS = {
    descricao: 'entry.1073025523',
    contato: 'entry.1357011976'
};

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
        this.enviando = false;
    }

    configurar() {
        this.configurarChips();
        this.configurarFormulario();
        this.atualizarInterface();
    }

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

        document.querySelectorAll('#categoriaChips .v2-chip').forEach((chip) => {
            chip.classList.toggle('ativo', chip.dataset.cat === cat);
        });
    }

    configurarFormulario() {
        const form = domCache.get('#bugForm');
        if (!form) return;
        form.addEventListener('submit', (e) => this.enviar(e));
    }

    async enviar(e) {
        e.preventDefault();

        if (this.enviando) return;

        const descricao = (domCache.get('#bugDescription')?.value || '').trim();
        const contato = (domCache.get('#bugContact')?.value || '').trim();

        if (!descricao) {
            this.mostrarStatus(i18n.t('mensagens.camposObrigatorios'), 'erro');
            domCache.get('#bugDescription')?.focus();
            return;
        }

        const novo = {
            categoria: this.categoriaAtual,
            mensagem: descricao,
            contato: contato || null
        };

        loading.mostrar();
        this.definirEstadoEnvio(true);

        try {
            await this.enviarParaGoogleForms(novo);
            this.limparFormulario();
            this.mostrarStatus(i18n.t('mensagens.sucesso'), 'sucesso');
        } catch (erro) {
            console.error('Erro ao enviar relatório:', erro);
            this.mostrarStatus(i18n.t('mensagens.erro'), 'erro');
        } finally {
            this.definirEstadoEnvio(false);
            loading.ocultar();
        }
    }

    async enviarParaGoogleForms(feedback) {
        const formData = new FormData();
        formData.append(GOOGLE_FORM_FIELDS.descricao, this.montarDescricao(feedback));
        formData.append(GOOGLE_FORM_FIELDS.contato, feedback.contato || '');

        await fetch(GOOGLE_FORM_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
    }

    montarDescricao(feedback) {
        const categoria = i18n.t(`categorias.${feedback.categoria}`) || feedback.categoria;
        return `[${categoria}]\n${feedback.mensagem}`;
    }

    definirEstadoEnvio(ativo) {
        this.enviando = ativo;
        const submitBtn = domCache.get('#submitBtn');
        if (!submitBtn) return;

        submitBtn.disabled = ativo;
        submitBtn.textContent = ativo ? i18n.t('formulario.enviando') : i18n.t('formulario.enviar');
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
        setTimeout(() => {
            el.style.display = 'none';
        }, 4000);
    }

    atualizarInterface() {
        document.title = i18n.t('titulo') + ' - Engenharia NATA';
        this.definirEstadoEnvio(this.enviando);
    }
}

const app = new BugsApp();
app.inicializar();

