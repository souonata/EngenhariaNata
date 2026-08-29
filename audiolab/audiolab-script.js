// AudioLab para Jellyfin — pagina de apresentacao e guia de instalacao.
//
// Nao ha calculo aqui: o app e informativo. A unica interacao e copiar o
// endereco do manifest, que e o passo em que o usuario mais erra ao digitar.

import { App, i18n } from '../src/core/app.js';

class AudioLabApp extends App {
    constructor() {
        super({
            appName: 'audiolab',
            callbacks: {
                aoInicializar: () => this.configurar()
            }
        });
        this.timeoutCopiar = null;
    }

    configurar() {
        const botao = document.getElementById('btnCopiar');
        const url = document.getElementById('manifestUrl');
        if (!botao || !url) return;

        botao.addEventListener('click', () => this.copiarManifest(botao, url.textContent.trim()));
    }

    async copiarManifest(botao, texto) {
        const rotuloOriginal = i18n.t('instalar.copiar');
        let ok = false;

        try {
            await navigator.clipboard.writeText(texto);
            ok = true;
        } catch {
            // Clipboard API exige contexto seguro e permissao; em http:// ou
            // navegador antigo ela falha. A selecao manual continua possivel,
            // entao o texto fica selecionado para o usuario copiar no teclado.
            ok = this.selecionarTexto();
        }

        botao.textContent = ok ? i18n.t('instalar.copiado') : i18n.t('instalar.copiarFalhou');
        botao.classList.toggle('al-copiado', ok);

        clearTimeout(this.timeoutCopiar);
        this.timeoutCopiar = setTimeout(() => {
            botao.textContent = rotuloOriginal;
            botao.classList.remove('al-copiado');
        }, 2500);
    }

    selecionarTexto() {
        const url = document.getElementById('manifestUrl');
        if (!url || !window.getSelection) return false;
        const range = document.createRange();
        range.selectNodeContents(url);
        const selecao = window.getSelection();
        selecao.removeAllRanges();
        selecao.addRange(range);
        return false;
    }
}

new AudioLabApp().inicializar();
