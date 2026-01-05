// Sobre - App refatorado com arquitetura modular

import { App, i18n } from '../src/core/app.js';
import { domCache } from '../src/utils/dom.js';

class SobreApp extends App {
    constructor() {
        super({
            appName: 'sobre',
            callbacks: {
                aoInicializar: () => this.configurar(),
                aoTrocarIdioma: () => this.atualizarInterface()
            }
        });
    }

    configurar() {
        this.configurarAccordion();
        this.atualizarInterface();
    }

    configurarAccordion() {
        const conteudos = document.querySelectorAll('.conteudo-expansivel');
        conteudos.forEach(conteudo => {
            conteudo.style.maxHeight = '0';
            conteudo.style.overflow = 'hidden';
            conteudo.style.transition = 'max-height 0.4s ease';
        });

        const cabecalhos = document.querySelectorAll('.card-header-clicavel');
        cabecalhos.forEach(cabecalho => {
            cabecalho.setAttribute('tabindex', '0');
            cabecalho.setAttribute('role', 'button');
            cabecalho.setAttribute('aria-expanded', 'false');
            
            cabecalho.addEventListener('click', (e) => this.alternarSecao(cabecalho, e));
            
            cabecalho.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.alternarSecao(cabecalho, e);
                }
            });
        });
    }

    alternarSecao(cabecalho, evento) {
        if (evento) {
            evento.preventDefault();
            evento.stopPropagation();
        }

        const scrollAtual = window.pageYOffset || document.documentElement.scrollTop;
        const card = cabecalho.closest('.card-expansivel');
        
        if (!card) return;

        const conteudo = card.querySelector('.conteudo-expansivel');
        const seta = cabecalho.querySelector('.seta-expansao');
        const expandido = card.classList.toggle('expandido');

        if (expandido) {
            conteudo.style.maxHeight = conteudo.scrollHeight + 'px';
            if (seta) seta.style.transform = 'rotate(180deg)';
            cabecalho.setAttribute('aria-expanded', 'true');
            cabecalho.setAttribute('aria-label', i18n.t('aria.collapseCard'));
        } else {
            conteudo.style.maxHeight = '0';
            if (seta) seta.style.transform = 'rotate(0deg)';
            cabecalho.setAttribute('aria-expanded', 'false');
            cabecalho.setAttribute('aria-label', i18n.t('aria.expandCard'));
            
            setTimeout(() => {
                window.scrollTo({
                    top: scrollAtual,
                    behavior: 'instant'
                });
            }, 0);
        }
    }

    atualizarInterface() {
        document.title = i18n.t('page.titleFull');
        
        document.querySelectorAll('.card-header-clicavel').forEach(cabecalho => {
            const expandido = cabecalho.getAttribute('aria-expanded') === 'true';
            cabecalho.setAttribute('aria-label', expandido ? i18n.t('aria.collapseCard') : i18n.t('aria.expandCard'));
        });
    }
}

const app = new SobreApp();
app.inicializar();
