import { App } from '../src/core/app.js';
import traducoes from '../src/i18n/livecostswiss.json';
import dashboardTemplate from './dashboard-source.txt?raw';
import dashboardTranslations from '../src/i18n/livecostswiss-dashboard.json';
import { i18n } from '../src/core/i18n.js';
import { renderDashboard } from './dashboard-language.mjs';

// Convenience gate for a static app. Passwords and browser data are not sent to a server.
class LivecostSwissApp extends App {
    constructor() {
        super({
            appName: 'livecostswiss',
            traducoes,
            callbacks: {
                aoInicializar: () => this.configurar(),
                aoTrocarIdioma: () => this.atualizarIdioma()
            }
        });
    }

    atualizarIdioma() {
        const language = document.getElementById('swiss-language');
        if (language) {
            language.value = i18n.idiomaAtual;
        }
        const frame = document.getElementById('swiss-frame');
        if (frame && frame.hasAttribute('srcdoc')) {
            frame.contentWindow.postMessage({ type: 'livecost-language', locale: i18n.idiomaAtual }, window.location.origin);
        }
    }

    configurar() {
        const form = document.getElementById('swiss-gate');
        const password = document.getElementById('swiss-password');
        const error = document.getElementById('swiss-error');
        const shell = document.getElementById('swiss-shell');
        const dashboard = document.getElementById('swiss-dashboard');
        const frame = document.getElementById('swiss-frame');
        const lock = () => {
            form.reset();
            password.removeAttribute('aria-invalid');
            error.hidden = true;
            frame.removeAttribute('srcdoc');
            dashboard.hidden = true;
            shell.hidden = false;
            document.body.classList.remove('swiss-dashboard-open');
            document.documentElement.classList.remove('swiss-dashboard-open');
        };

        lock();
        form.addEventListener('submit', event => {
            event.preventDefault();
            const valid = password.value === 'swiss';
            password.value = '';
            if (!valid) {
                error.hidden = false;
                password.setAttribute('aria-invalid', 'true');
                password.focus();
                return;
            }
            password.removeAttribute('aria-invalid');
            error.hidden = true;
            frame.srcdoc = renderDashboard(dashboardTemplate, dashboardTranslations, i18n.idiomaAtual);
            shell.hidden = true;
            dashboard.hidden = false;
            document.body.classList.add('swiss-dashboard-open');
            document.documentElement.classList.add('swiss-dashboard-open');
            document.getElementById('swiss-lock').focus();
        });
        password.addEventListener('input', () => {
            error.hidden = true;
            password.removeAttribute('aria-invalid');
        });
        const language = document.getElementById('swiss-language');
        language.value = i18n.idiomaAtual;
        language.addEventListener('change', () => i18n.trocarIdioma(language.value));
        frame.addEventListener('load', () => this.atualizarIdioma());
        document.getElementById('swiss-lock').addEventListener('click', () => {
            lock();
            password.focus();
        });
        window.addEventListener('pagehide', lock);
        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                lock();
            }
        });
    }
}

new LivecostSwissApp().inicializar();
