// Bugs Reporter - App refatorado com arquitetura modular

import { App, i18n, loading } from '../src/core/app.js';
import { domCache } from '../src/utils/dom.js';
import { validarCampoObrigatorio } from '../src/utils/validators.js';

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeSKJ5E_YEgX5tCRtCOYVXkc82_hqhqBjPO8n3k82c_3EXAMPLE/formResponse';

const ENTRY_IDS = {
    descricao: 'entry.456456456',
    contato: 'entry.987654321'
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
    }

    configurar() {
        this.configurarFormulario();
        this.atualizarInterface();
    }

    configurarFormulario() {
        const form = domCache.get('#bugForm');
        if (!form) return;

        form.addEventListener('submit', (e) => this.enviarFormulario(e));
    }

    async enviarFormulario(e) {
        e.preventDefault();

        const dados = this.coletarDados();
        
        if (!this.validarDados(dados)) {
            this.mostrarMensagem(i18n.t('mensagens.camposObrigatorios'), 'erro');
            return;
        }

        loading.mostrar();
        this.desabilitarBotao(true);

        try {
            await this.enviarParaGoogleForms(dados);
            this.mostrarMensagem(i18n.t('mensagens.sucesso'), 'sucesso');
            this.limparFormulario();
        } catch (erro) {
            console.error('Erro ao enviar:', erro);
            this.mostrarMensagem(i18n.t('mensagens.erro'), 'erro');
        } finally {
            loading.ocultar();
            this.desabilitarBotao(false);
        }
    }

    coletarDados() {
        return {
            descricao: domCache.get('#bugDescription')?.value || '',
            contato: domCache.get('#bugContact')?.value || ''
        };
    }

    validarDados(dados) {
        // Apenas a descrição é obrigatória, contato é opcional
        return validarCampoObrigatorio(dados.descricao);
    }

    async enviarParaGoogleForms(dados) {
        const formData = new FormData();
        
        formData.append(ENTRY_IDS.descricao, dados.descricao);
        if (dados.contato) {
            formData.append(ENTRY_IDS.contato, dados.contato);
        }

        const response = await fetch(GOOGLE_FORM_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });

        return response;
    }

    limparFormulario() {
        domCache.get('#bugForm')?.reset();
    }

    desabilitarBotao(desabilitar) {
        const btn = document.querySelector('button[type="submit"]');
        if (!btn) return;

        btn.disabled = desabilitar;
        btn.textContent = desabilitar 
            ? `⏳ ${i18n.t('formulario.enviando')}`
            : i18n.t('formulario.enviar');
    }

    mostrarMensagem(mensagem, tipo) {
        const div = document.createElement('div');
        div.className = `mensagem mensagem-${tipo}`;
        div.textContent = mensagem;
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${tipo === 'sucesso' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(div);

        setTimeout(() => {
            div.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }

    atualizarInterface() {
        document.title = i18n.t('titulo') + ' - Engenharia NATA';
    }
}

const app = new BugsApp();
app.inicializar();
