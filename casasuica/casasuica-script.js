import { App } from '../src/core/app.js';
import traducoes from '../src/i18n/casasuica.json';

// Convenience gate on a public static site, not server authentication.
// The destination retains its independent, owner-private ChatGPT access checks.
const dashboardUrl = 'https://casa-suica-kriens-ale.cleverdate1.chatgpt.site/';

class CasaSuicaApp extends App {
    constructor() {
        super({
            appName: 'casasuica',
            traducoes,
            callbacks: { aoInicializar: () => this.configurar() }
        });
    }

    configurar() {
        const form = document.getElementById('swiss-gate');
        const password = document.getElementById('swiss-password');
        const error = document.getElementById('swiss-error');
        const unlocked = document.getElementById('swiss-unlocked');
        const open = document.getElementById('swiss-open');
        const lock = () => {
            form.reset();
            form.hidden = false;
            error.hidden = true;
            unlocked.hidden = true;
            open.removeAttribute('href');
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
            form.hidden = true;
            unlocked.hidden = false;
            open.href = dashboardUrl;
            open.focus();
        });
        password.addEventListener('input', () => {
            error.hidden = true;
            password.removeAttribute('aria-invalid');
        });
        document.getElementById('swiss-lock').addEventListener('click', () => {
            lock();
            password.focus();
        });
        // Returning through browser history must ask for the password again.
        window.addEventListener('pagehide', lock);
        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                lock();
            }
        });
    }
}

new CasaSuicaApp().inicializar();
