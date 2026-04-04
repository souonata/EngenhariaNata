import { carregarDados, salvarDados } from '../utils/storage.js';

const THEME_KEY = 'theme_mode';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_ATTR = 'data-theme';
const TOGGLE_ID = 'themeToggleGlobal';

function normalizarTema(valor) {
    return valor === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

function obterIdiomaAtual() {
    const idiomaStorage = carregarDados('idioma', null);
    if (typeof idiomaStorage === 'string' && idiomaStorage.startsWith('it')) {
        return 'it';
    }

    const idiomaHtml = document.documentElement.lang || 'pt-BR';
    return idiomaHtml.startsWith('it') ? 'it' : 'pt';
}

function obterTextoToggle(theme) {
    const idioma = obterIdiomaAtual();
    const paraEscuro = theme !== THEME_DARK;

    if (idioma === 'it') {
        return paraEscuro ? 'Attiva tema scuro' : 'Attiva tema chiaro';
    }

    return paraEscuro ? 'Ativar tema escuro' : 'Ativar tema claro';
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
    btn.textContent = isDark ? 'Light' : 'Dark';
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
    const host = document.querySelector('.language-selector, .seletor-idioma') || document.body;
    let btn = document.getElementById(TOGGLE_ID);

    if (!btn) {
        btn = document.createElement('button');
        btn.id = TOGGLE_ID;
        btn.type = 'button';
        btn.className = 'theme-toggle-btn';
        btn.addEventListener('click', alternarTema);
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
