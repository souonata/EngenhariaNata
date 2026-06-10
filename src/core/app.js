// Core da aplicação - inicialização comum a todos os apps

import { i18n, configurarBotoesIdioma } from './i18n.js';
import { loading } from '../components/loading.js';
import { inicializarTema } from './theme.js';

export class App {
    constructor(config = {}) {
        this.config = {
            appName: config.appName || 'app',
            traducoes: config.traducoes || {},
            idiomaInicial: config.idiomaInicial || null,
            callbacks: config.callbacks || {}
        };
    }

    async inicializar() {
        try {
            inicializarTema();
            loading.mostrar();

            await this.carregarTraducoes();

            // Registra callback de idioma ANTES de inicializar app
            if (this.config.callbacks.aoTrocarIdioma) {
                i18n.registrarCallback(this.config.callbacks.aoTrocarIdioma);
            }

            i18n.inicializar(this.config.traducoes, this.config.idiomaInicial);
            configurarBotoesIdioma();

            this.configurarBotaoHome();
            this.configurarFadeBotaoHome();
            this.configurarEventosComuns();
            this.configurarInputsNumericosMoveis();

            if (this.config.callbacks.aoInicializar) {
                await this.config.callbacks.aoInicializar();
            }

            this.configurarFeedbackVisualSliders();
            loading.ocultar();
        } catch (erro) {
            console.error('Erro ao inicializar app:', erro);
            // A página fica inutilizável quando a init falha (ex.: 404 em
            // src/i18n/<app>.json). Sem isto o congelamento é mudo. O overlay
            // global (assets/js/error-overlay.js) transforma em aviso visível.
            if (window.__engnataReportError) {
                window.__engnataReportError('Falha ao inicializar "' + this.config.appName + '": ' + ((erro && erro.message) || erro));
            }
            loading.ocultar();
        } finally {
            // Derruba a cortina de boot (anti-piscada do index.html) só depois de
            // tema + i18n + aoInicializar prontos — o site aparece já traduzido e
            // ordenado, num único paint. Remoção direta (sem requestAnimationFrame:
            // rAF não dispara em aba em segundo plano). No-op sem a cortina.
            document.documentElement.classList.remove('boot');
        }
    }

    async carregarTraducoes() {
        if (this.config.traducoes && Object.keys(this.config.traducoes).length > 0) {
            return;
        }

        try {
            const response = await fetch(`../src/i18n/${this.config.appName}.json`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config.traducoes = await response.json();
        } catch (erro) {
            console.error(`Erro ao carregar traduções de ${this.config.appName}:`, erro);
            throw erro;
        }
    }

    configurarBotaoHome() {
        const btnHome = document.getElementById('btnHome');
        if (btnHome) {
            btnHome.addEventListener('click', () => {
                window.location.href = '../index.html';
            });
        }
    }

    // Botão home some quando o conteúdo está em foco e só aparece (em degradê de
    // transparência) quando a página rola até perto do rodapé, deixando o uso do
    // app mais limpo. Se a página não rola, fica sempre visível (fail-safe).
    configurarFadeBotaoHome() {
        const btn = document.querySelector('.home-button-fixed');
        if (!btn) return;

        const FAIXA = 150; // px de transição da aparição perto do fundo
        const atualizar = () => {
            const doc = document.documentElement;
            const rolavel = doc.scrollHeight - window.innerHeight;
            let op;
            if (rolavel <= 4) {
                op = 1;                                   // não rola → sempre visível
            } else {
                const distFundo = rolavel - window.scrollY;
                op = Math.min(1, Math.max(0, 1 - distFundo / FAIXA));
            }
            btn.style.opacity = op.toFixed(3);
            btn.style.pointerEvents = op > 0.05 ? 'auto' : 'none';
        };

        atualizar();
        window.addEventListener('scroll', atualizar, { passive: true });
        window.addEventListener('resize', atualizar);
    }

    configurarEventosComuns() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharModais();
            }
        });
    }

    configurarInputsNumericosMoveis() {
        const inputs = document.querySelectorAll('input.valor-input, input[type="number"]');

        inputs.forEach(input => {
            if (input.dataset.mobileInputConfigured === 'true') {
                return;
            }

            const step = (input.getAttribute('step') || '').replace(',', '.');
            const value = (input.value || '').trim();
            const ehDecimal =
                (step && !Number.isInteger(parseFloat(step))) ||
                /[,.]/.test(value);

            if (!input.hasAttribute('inputmode')) {
                input.setAttribute('inputmode', ehDecimal ? 'decimal' : 'numeric');
            }

            if (!input.hasAttribute('pattern')) {
                input.setAttribute('pattern', ehDecimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*');
            }

            if (!input.hasAttribute('enterkeyhint')) {
                input.setAttribute('enterkeyhint', 'done');
            }

            if (!input.hasAttribute('autocomplete')) {
                input.setAttribute('autocomplete', 'off');
            }

            const selecionarConteudo = () => {
                if (!input.disabled && !input.readOnly) {
                    input.select();
                }
            };

            input.addEventListener('focus', selecionarConteudo);
            input.addEventListener('click', selecionarConteudo);
            input.addEventListener('touchend', selecionarConteudo);

            input.dataset.mobileInputConfigured = 'true';
        });
    }

    fecharModais() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Quando o input text conectado a um slider contém valor fora do range do slider,
    // deixa o slider cinza e na extremidade mais próxima para sinalizar que o input
    // está no comando. Quando o slider é arrastado diretamente, volta ao azul.
    configurarFeedbackVisualSliders() {
        // Slider arrastado diretamente → sempre dentro do range → remove estado cinza
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="range"]')) {
                e.target.classList.remove('slider-fora-faixa');
            }
        });

        // inputX muda → checa se excede o range do sliderX correspondente
        document.querySelectorAll('input[type="range"][id^="slider"]').forEach(slider => {
            const suffix = slider.id.slice(6); // "sliderPotencia" → "Potencia"
            const input = document.getElementById('input' + suffix);
            if (!input) return;

            input.addEventListener('input', () => {
                const valor = parseFloat((input.value || '').replace(',', '.'));
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                if (!isNaN(valor) && (valor < min || valor > max)) {
                    slider.classList.add('slider-fora-faixa');
                } else {
                    slider.classList.remove('slider-fora-faixa');
                }
            });
        });
    }
}

export { i18n, loading };
