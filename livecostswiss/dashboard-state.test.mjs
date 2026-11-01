import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from '../local/node_modules/jsdom/lib/api.js';

import { renderDashboard } from './dashboard-language.mjs';
const translations = JSON.parse(readFileSync(new URL('../src/i18n/livecostswiss-dashboard.json', import.meta.url), 'utf8'));
const template = readFileSync(new URL('./dashboard-source.txt', import.meta.url), 'utf8');
function dashboard(saved) {
    return new JSDOM(renderDashboard(template, translations, 'it-IT'), {
        url: 'https://engnata.eu/livecostswiss/',
        runScripts: 'dangerously',
        beforeParse(window) {
            window.structuredClone = structuredClone;
            if (saved) window.localStorage.setItem('livecost-swiss-v1', saved);
        }
    });
}
function change(w, id, value, event = 'input') {
    const field = w.document.getElementById(id);
    field.value = value;
    field.dispatchEvent(new w.Event(event));
}
test('dashboard renders costs, pie and salary scenarios without remote dependencies', () => {
    const dom = dashboard(), w = dom.window, doc = w.document;
    assert.match(doc.getElementById('kb-net').textContent, /6.689/);
    assert.match(doc.getElementById('kb-cost-total').textContent, /5.846/);
    assert.ok(doc.querySelectorAll('#kb-cost-table tr').length >= 20);
    assert.match(doc.getElementById('kb-pie').getAttribute('aria-label'), /Abitazione/);
    assert.ok(doc.getElementById('kb-legend').children.length >= 6);
    assert.equal(doc.querySelectorAll('script[src]').length, 0);
    change(w, 'kb-salary', '80000');
    assert.match(doc.getElementById('kb-net').textContent, /5.456/);
    assert.match(doc.getElementById('kb-save').textContent, /-/);
    dom.window.close();
});
test('theme, rent, family and custom costs survive reopening without touching Casa Suica', () => {
    const dom = dashboard(), w = dom.window;
    w.localStorage.setItem('casa-suica-v1', 'keep');
    change(w, 'kb-theme', 'dark', 'change');
    change(w, 'kb-rent', '2100');
    change(w, 'kb-child', '1');
    const cost = w.document.querySelector('[data-expense="Waste bags / fees"]');
    cost.value = '42'; cost.dispatchEvent(new w.Event('input'));
    assert.equal(w.localStorage.getItem('casa-suica-v1'), 'keep');
    const saved = w.localStorage.getItem('livecost-swiss-v1'); dom.window.close();
    const reopened = dashboard(saved), d = reopened.window.document;
    assert.equal(d.documentElement.dataset.kbTheme, 'dark');
    assert.equal(d.getElementById('kb-rent').value, '2100');
    assert.equal(d.getElementById('kb-child').value, '1');
    assert.equal(d.querySelector('[data-expense="Waste bags / fees"]').value, '42');
    assert.match(d.getElementById('kb-cost-table').textContent, /Assicurazione sanitaria neonato/);
    change(reopened.window, 'kb-theme', 'light', 'change');
    assert.equal(d.documentElement.dataset.kbTheme, 'light');
    change(reopened.window, 'kb-theme', 'auto', 'change');
    assert.equal(d.documentElement.hasAttribute('data-kb-theme'), false);
    reopened.window.close();
});
test('malformed stored JSON falls back to usable defaults', () => {
    const dom = dashboard('{bad');
    assert.match(dom.window.document.getElementById('kb-net').textContent, /6.689/);
    dom.window.close();
});
test('gate blocks wrong password, opens locally, then relocks on click and navigation', () => {
    const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./livecostswiss-script.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '');
    const dom = new JSDOM(html, { url: 'https://engnata.eu/livecostswiss/', runScripts: 'outside-only' });
    const w = dom.window, d = w.document;
    w.App = class {
        constructor(config) { this.config = config; }
        inicializar() { this.config.callbacks.aoInicializar(); }
    };
    w.dashboardTemplate = '<p>Budget ready</p>';
    w.traducoes = {};
    w.dashboardTranslations = translations;
    w.renderDashboard = renderDashboard;
    w.i18n = { idiomaAtual: 'it-IT', trocarIdioma() {} };
    w.eval(source);
    const submit = value => {
        d.getElementById('swiss-password').value = value;
        d.getElementById('swiss-gate').dispatchEvent(new w.Event('submit', { cancelable: true }));
    };
    const frame = d.getElementById('swiss-frame');
    assert.equal(frame.hasAttribute('srcdoc'), false);
    submit('wrong');
    assert.equal(d.getElementById('swiss-error').hidden, false);
    assert.equal(frame.hasAttribute('srcdoc'), false);
    submit('swiss');
    assert.match(frame.srcdoc, /Budget ready/);
    assert.equal(d.getElementById('swiss-dashboard').hidden, false);
    d.getElementById('swiss-lock').click();
    assert.equal(frame.hasAttribute('srcdoc'), false);
    submit('swiss');
    w.dispatchEvent(new w.Event('pagehide'));
    assert.equal(frame.hasAttribute('srcdoc'), false);
    assert.equal(d.getElementById('swiss-shell').hidden, false);
    dom.window.close();
});
test('launcher stays hidden, noindex and omitted from public sitemap', () => {
    const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const dom = new JSDOM(index), launcher = dom.window.document.getElementById('appLivecostSwiss');
    assert.ok(launcher.hasAttribute('data-app-secreto'));
    assert.equal(launcher.style.display, 'none');
    assert.equal(launcher.getAttribute('aria-hidden'), 'true');
    assert.equal(launcher.getAttribute('tabindex'), '-1');
    assert.doesNotMatch(readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8'), /livecostswiss/);
    assert.match(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), /noindex, nofollow/);
    assert.doesNotMatch(template, /Italy baseline from your figures|Volvo Penta|Turbigo/);
    dom.window.close();
});

test('all dashboard text has PT/IT/SV translations and switching preserves values', () => {
    const parsed = new JSDOM(template);
    const walker = parsed.window.document.createTreeWalker(
        parsed.window.document.getElementById('kriens-budget'), 4
    );
    let text;
    while ((text = walker.nextNode())) {
        const key = text.nodeValue.trim();
        if (!key || key === '·' || /^CHF \d+k$/.test(key)) continue;
        for (const locale of ['pt-BR', 'it-IT', 'sv-SE']) {
            assert.ok(translations[locale][key], locale + ': ' + key);
        }
    }
    parsed.window.close();
    const dom = dashboard(), w = dom.window, doc = w.document;
    change(w, 'kb-rent', '2200');
    change(w, 'kb-child', '1');
    const expected = {
        'pt-BR': ['Custos mensais', 'Seguro-saúde do bebê', 'Líquido estimado'],
        'sv-SE': ['Månadskostnader', 'Barnets sjukförsäkring', 'Beräknat netto'],
        'it-IT': ['Costi mensili', 'Assicurazione sanitaria neonato', 'Netto stimato']
    };
    for (const [locale, words] of Object.entries(expected)) {
        const saved = w.localStorage.getItem('livecost-swiss-v1');
        w.dispatchEvent(new w.MessageEvent('message', {
            data: { type: 'livecost-language', locale },
            source: w,
            origin: 'https://engnata.eu'
        }));
        assert.equal(doc.documentElement.lang, locale);
        for (const word of words) assert.ok(doc.getElementById('kriens-budget').textContent.includes(word), word);
        assert.equal(doc.getElementById('kb-rent').value, '2200');
        assert.equal(doc.getElementById('kb-child').value, '1');
        assert.equal(w.localStorage.getItem('livecost-swiss-v1'), saved);
        change(w, 'kb-salary', '90000');
        assert.ok(doc.getElementById('kb-compare').textContent.includes(words[2]));
    }
    w.dispatchEvent(new w.MessageEvent('message', {
        data: { type: 'livecost-language', locale: 'pt-BR' }, source: w, origin: 'https://other.example'
    }));
    assert.equal(doc.documentElement.lang, 'it-IT');
    dom.window.close();
});

test('site session language initializes the app and toolbar selection updates that session', () => {
    const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
    const core = readFileSync(new URL('../src/core/i18n.js', import.meta.url), 'utf8').replaceAll('export ', '');
    const controller = readFileSync(new URL('./livecostswiss-script.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
    const shellTranslations = JSON.parse(readFileSync(new URL('../src/i18n/livecostswiss.json', import.meta.url), 'utf8'));
    for (const locale of ['pt-BR', 'it-IT', 'sv-SE']) {
        const dom = new JSDOM(html, { url: 'https://engnata.eu/livecostswiss/', runScripts: 'outside-only' });
        const w = dom.window, doc = w.document;
        w.sessionStorage.setItem('engnata_idioma', locale);
        w.eval(core + '\nwindow.i18n = i18n;');
        w.App = class {
            constructor(config) { this.config = config; }
            inicializar() {
                w.i18n.registrarCallback(this.config.callbacks.aoTrocarIdioma);
                w.i18n.inicializar(this.config.traducoes);
                this.config.callbacks.aoInicializar();
            }
        };
        w.dashboardTemplate = template;
        w.dashboardTranslations = translations;
        w.renderDashboard = renderDashboard;
        w.traducoes = shellTranslations;
        w.eval(controller);
        assert.equal(doc.getElementById('swiss-language').value, locale);
        doc.getElementById('swiss-password').value = 'swiss';
        doc.getElementById('swiss-gate').dispatchEvent(new w.Event('submit', { cancelable: true }));
        const frame = doc.getElementById('swiss-frame');
        assert.ok(frame.srcdoc.includes('window.livecostLocale = ' + JSON.stringify(locale)));
        let message;
        frame.contentWindow.postMessage = data => { message = data; };
        change(w, 'swiss-language', 'pt-BR', 'change');
        assert.equal(w.sessionStorage.getItem('engnata_idioma'), 'pt-BR');
        assert.equal(message.locale, 'pt-BR');
        assert.equal(frame.srcdoc.includes('/*LIVECOST_TRANSLATIONS*/'), false);
        dom.window.close();
    }
});
