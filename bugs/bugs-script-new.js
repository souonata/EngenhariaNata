// Bugs Reporter - App refatorado com arquitetura modular

import { App, i18n, loading } from '../src/core/app.js';
import { domCache } from '../src/utils/dom.js';
import { validarCampoObrigatorio, validarEmail } from '../src/utils/validators.js';

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeSKJ5E_YEgX5tCRtCOYVXkc82_hqhqBjPO8n3k82c_3EXAMPLE/formResponse';

const ENTRY_IDS = {
    nome: 'entry.123456789',
    email: 'entry.987654321',
    tipo: 'entry.111222333',
    app: 'entry.444555666',
    prioridade: 'entry.777888999',
    titulo: 'entry.123123123',
    descricao: 'entry.456456456'
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
            nome: domCache.get('#nome')?.value || '',
            email: domCache.get('#email')?.value || '',
            tipo: domCache.get('#tipo')?.value || '',
            app: domCache.get('#app')?.value || '',
            prioridade: domCache.get('#prioridade')?.value || '',
            titulo: domCache.get('#titulo')?.value || '',
            descricao: domCache.get('#descricao')?.value || ''
        };
    }

    validarDados(dados) {
        return (
            validarCampoObrigatorio(dados.nome) &&
            validarEmail(dados.email) &&
            validarCampoObrigatorio(dados.tipo) &&
            validarCampoObrigatorio(dados.app) &&
            validarCampoObrigatorio(dados.titulo) &&
            validarCampoObrigatorio(dados.descricao)
        );
    }

    async enviarParaGoogleForms(dados) {
        const formData = new FormData();
        
        formData.append(ENTRY_IDS.nome, dados.nome);
        formData.append(ENTRY_IDS.email, dados.email);
        formData.append(ENTRY_IDS.tipo, dados.tipo);
        formData.append(ENTRY_IDS.app, dados.app);
        formData.append(ENTRY_IDS.prioridade, dados.prioridade);
        formData.append(ENTRY_IDS.titulo, dados.titulo);
        formData.append(ENTRY_IDS.descricao, dados.descricao);

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
        const btn = domCache.get('#btnEnviar');
        if (!btn) return;

        btn.disabled = desabilitar;
        btn.textContent = desabilitar 
            ? i18n.t('formulario.enviando')
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
