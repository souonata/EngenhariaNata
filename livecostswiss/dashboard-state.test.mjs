import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from '../local/node_modules/jsdom/lib/api.js';

const template = readFileSync(new URL('./dashboard-source.txt', import.meta.url), 'utf8');
function dashboard(saved) {
    return new JSDOM(template, {
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
    assert.match(doc.getElementById('kb-pie').getAttribute('aria-label'), /Housing/);
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
    assert.match(d.getElementById('kb-cost-table').textContent, /Baby health insurance/);
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
