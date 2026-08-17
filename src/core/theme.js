import { carregarDados, salvarDados } from '../utils/storage.js';

const THEME_KEY = 'theme_mode';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_ATTR = 'data-theme';
const TOGGLE_ID = 'themeToggleGlobal';

function normalizarTema(valor) {
    return valor === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

// Ícones em SVG inline (não emoji): o portfólio já apanhou de PCs Windows sem
// Twemoji, onde os emojis das bandeiras caíam para texto puro.
const ICONE_SOL = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="12" y1="1.5" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22.5" y2="12" />
        <line x1="4.2" y1="4.2" x2="6" y2="6" />
        <line x1="18" y1="18" x2="19.8" y2="19.8" />
        <line x1="19.8" y1="4.2" x2="18" y2="6" />
        <line x1="6" y1="18" x2="4.2" y2="19.8" />
    </g>
</svg>`;

const ICONE_LUA = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path d="M21 13.2A9.2 9.2 0 0 1 10.8 3a9 9 0 1 0 10.2 10.2Z" fill="currentColor" />
</svg>`;

const TEXTOS_TOGGLE = {
    'pt-BR': { escuro: 'Ativar tema escuro', claro: 'Ativar tema claro' },
    'it-IT': { escuro: 'Attiva tema scuro', claro: 'Attiva tema chiaro' },
    'sv-SE': { escuro: 'Aktivera mörkt tema', claro: 'Aktivera ljust tema' }
};

function obterIdiomaAtual() {
    const idiomaStorage = sessionStorage.getItem('engnata_idioma');
    if (typeof idiomaStorage === 'string' && TEXTOS_TOGGLE[idiomaStorage]) {
        return idiomaStorage;
    }

    const idiomaHtml = document.documentElement.lang || 'it-IT';
    if (TEXTOS_TOGGLE[idiomaHtml]) {
        return idiomaHtml;
    }

    // `<html lang>` pode trazer só o código curto ("it", "sv", "pt").
    const curto = idiomaHtml.slice(0, 2).toLowerCase();
    const porPrefixo = { pt: 'pt-BR', it: 'it-IT', sv: 'sv-SE' };
    return porPrefixo[curto] || 'it-IT';
}

function obterTextoToggle(theme) {
    const textos = TEXTOS_TOGGLE[obterIdiomaAtual()] || TEXTOS_TOGGLE['it-IT'];
    return theme !== THEME_DARK ? textos.escuro : textos.claro;
}

function obterTemaSalvo() {
    return normalizarTema(carregarDados(THEME_KEY, THEME_LIGHT));
}

function atualizarBotaoTheme(theme) {
    const btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;

    const isDark = theme === THEME_DARK;
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.setAttribute('aria-label', obterTextoToggle(theme));
    btn.title = obterTextoToggle(theme);
    // Mostra o ícone da ação-alvo: no escuro exibe o sol (clicar → claro).
    btn.innerHTML = isDark ? ICONE_SOL : ICONE_LUA;
}

// Reaplica rótulos do botão quando o idioma muda (o dock chama isto).
export function atualizarIdiomaTema() {
    atualizarBotaoTheme(document.documentElement.getAttribute(THEME_ATTR) || THEME_LIGHT);
}

export function aplicarTema(theme) {
    const temaFinal = normalizarTema(theme);
    document.documentElement.setAttribute(THEME_ATTR, temaFinal);
    salvarDados(THEME_KEY, temaFinal);
    atualizarBotaoTheme(temaFinal);
    document.dispatchEvent(new CustomEvent('engnata:themechange', { detail: { theme: temaFinal } }));
}

export function alternarTema() {
    const atual = document.documentElement.getAttribute(THEME_ATTR) || THEME_LIGHT;
    const proximo = atual === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    aplicarTema(proximo);
}

function garantirBotaoTema() {
    // O dock global é o host preferencial; os seletores legados seguem valendo
    // enquanto houver páginas ainda não migradas.
    // Consultas separadas de propósito: querySelector com lista ('.a, .b')
    // devolve o primeiro nó em ordem de DOCUMENTO, não na ordem dos seletores —
    // e o dock é anexado no fim do body, então perderia para o seletor legado.
    const host =
        document.querySelector('.engnata-dock__grupo--tema') ||
        document.querySelector('.language-selector, .seletor-idioma') ||
        document.body;
    let btn = document.getElementById(TOGGLE_ID);

    if (!btn) {
        btn = document.createElement('button');
        btn.id = TOGGLE_ID;
        btn.type = 'button';
        btn.className = 'theme-toggle-btn';
    }

    if (btn.dataset.themeBound !== 'true') {
        btn.addEventListener('click', alternarTema);
        btn.dataset.themeBound = 'true';
    }

    if (btn.parentElement !== host) {
        host.appendChild(btn);
    }

    atualizarBotaoTheme(document.documentElement.getAttribute(THEME_ATTR) || THEME_LIGHT);
}

export function inicializarTema() {
    const tema = obterTemaSalvo();
    document.documentElement.setAttribute(THEME_ATTR, tema);
    garantirBotaoTema();
    atualizarBotaoTheme(tema);
}
