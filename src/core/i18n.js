// Sistema de internacionalização centralizado

import { salvarDados, carregarDados } from '../utils/storage.js';

class I18nManager {
    constructor() {
        this.idiomaAtual = 'pt-BR';
        this.traducoes = {};
        this.callbacks = [];
    }

    inicializar(traducoes, idiomaInicial = null) {
        this.traducoes = traducoes;
        
        const idiomaSalvo = idiomaInicial || carregarDados('idioma', 'pt-BR');
        this.trocarIdioma(idiomaSalvo);
    }

    trocarIdioma(novoIdioma) {
        if (!this.traducoes[novoIdioma]) {
            console.error(`Idioma ${novoIdioma} não encontrado`);
            return;
        }

        this.idiomaAtual = novoIdioma;
        salvarDados('idioma', novoIdioma);
        
        this.atualizarDocumento();
        this.executarCallbacks();
        this.atualizarBotoesIdioma();
    }

    atualizarDocumento() {
        document.documentElement.lang = this.idiomaAtual;
        
        document.querySelectorAll('[data-i18n]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n');
            const texto = this.obterTraducao(chave);
            
            if (texto) {
                if (elemento.tagName === 'INPUT' || elemento.tagName === 'TEXTAREA') {
                    if (elemento.type === 'submit' || elemento.type === 'button') {
                        elemento.value = texto;
                    } else {
                        elemento.placeholder = texto;
                    }
                } else {
                    elemento.textContent = texto;
                }
            }
        });

        document.querySelectorAll('[data-i18n-html]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n-html');
            const html = this.obterTraducao(chave);
            if (html) {
                elemento.innerHTML = html;
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n-title');
            const titulo = this.obterTraducao(chave);
            if (titulo) {
                elemento.setAttribute('title', titulo);
            }
        });

        document.querySelectorAll('[data-i18n-aria]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n-aria');
            const aria = this.obterTraducao(chave);
            if (aria) {
                elemento.setAttribute('aria-label', aria);
            }
        });
    }

    atualizarBotoesIdioma() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            const lang = btn.getAttribute('data-lang');
            if (lang === this.idiomaAtual) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    obterTraducao(chave) {
        const partes = chave.split('.');
        let valor = this.traducoes[this.idiomaAtual];
        
        for (const parte of partes) {
            if (valor && typeof valor === 'object') {
                valor = valor[parte];
            } else {
                return null;
            }
        }
        
        return valor;
    }

    t(chave, valores = {}) {
        let texto = this.obterTraducao(chave) || chave;
        
        Object.keys(valores).forEach(key => {
            texto = texto.replace(new RegExp(`{${key}}`, 'g'), valores[key]);
        });
        
        return texto;
    }

    registrarCallback(callback) {
        this.callbacks.push(callback);
    }

    executarCallbacks() {
        this.callbacks.forEach(callback => callback(this.idiomaAtual));
    }

    obterIdiomaAtual() {
        return this.idiomaAtual;
    }

    obterMoeda() {
        return this.idiomaAtual === 'it-IT' ? 'EUR' : 'BRL';
    }
}

export const i18n = new I18nManager();

export function configurarBotoesIdioma() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idioma = btn.getAttribute('data-lang');
            i18n.trocarIdioma(idioma);
        });
    });
}
