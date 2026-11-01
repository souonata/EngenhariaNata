import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from '../local/node_modules/jsdom/lib/api.js';
import { i18n } from '../src/core/i18n.js';
import { buildDashboardDocument } from './dashboard-document.mjs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const template = read('./dashboard-source.txt');
const research = JSON.parse(read('./research-data.json'));
const model = read('./research-model.mjs');
const localization = read('./dashboard-localization.mjs');
const translations = JSON.parse(read('./dashboard-translations.json'));
const gateTranslations = JSON.parse(read('../src/i18n/casasuica.json'));
const expected = {
    'pt-BR': { heading: 'Mais perto de casa.', bedrooms: 'Quartos mínimos', saved: 'Salvo', rent: 'Preço', reason: 'Acima do preço máximo' },
    'it-IT': { heading: 'Più vicini a casa.', bedrooms: 'Minimo camere da letto', saved: 'Salvato', rent: 'Prezzo', reason: 'Oltre il prezzo massimo' },
    'sv-SE': { heading: 'Närmare ett nytt hem.', bedrooms: 'Minsta antal sovrum', saved: 'Sparad', rent: 'Pris', reason: 'Över högsta priset' }
};
function create(locale, saved) {
    const html = buildDashboardDocument({ template, research, model, localization, translations, locale });
    return new JSDOM(html, { url: 'https://engnata.eu/casasuica/', runScripts: 'dangerously', beforeParse(window) {
        if (saved) {
            window.localStorage.setItem('casa-suica-v1', saved);
        }
    } });
}
function fromHost(language, switchBeforeUnlock) {
    const host = new JSDOM(read('./index.html'), { url: 'https://engnata.eu/casasuica/', runScripts: 'outside-only' });
    const descriptors = Object.fromEntries(['window', 'document', 'sessionStorage'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    try {
        Object.assign(globalThis, { window: host.window, document: host.window.document, sessionStorage: host.window.sessionStorage });
        host.window.sessionStorage.setItem('engnata_idioma', language);
        Object.assign(host.window, {
            App: class {
                constructor(config) {
                    this.config = config;
                }
                inicializar() {
                    i18n.inicializar(this.config.traducoes); this.config.callbacks.aoInicializar();
                }
            },
            i18n, traducoes: gateTranslations, dashboardTemplate: template, research, researchModel: model, localization, translations, buildDashboardDocument
        });
        // Run the actual gate code; only shared boot/theme/network setup is replaced.
        host.window.eval(read('./casasuica-script.js').replace(/^import .*;\n/gm, ''));
        if (switchBeforeUnlock) {
            i18n.trocarIdioma(switchBeforeUnlock);
        }
        host.window.document.getElementById('swiss-password').value = 'swiss';
        host.window.document.getElementById('swiss-gate').dispatchEvent(new host.window.Event('submit', { cancelable: true }));
        const source = host.window.document.getElementById('swiss-frame').srcdoc;
        return { host, dashboard: new JSDOM(source, { url: 'https://engnata.eu/casasuica/', runScripts: 'dangerously' }) };
    } finally {
        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }
}
for (const locale of Object.keys(expected)) {
    test('inherits engnata.eu session language through the real unlock code: ' + locale, () => {
        const { host, dashboard } = fromHost(locale), doc = dashboard.window.document;
        assert.equal(host.window.document.documentElement.lang, locale);
        assert.equal(host.window.document.title, gateTranslations[locale].documentTitle);
        assert.equal(doc.documentElement.lang, locale);
        assert.equal(doc.querySelector('h1').textContent, expected[locale].heading);
        assert.equal(doc.getElementById('column-bedrooms').parentElement.textContent, expected[locale].bedrooms);
        assert.equal(doc.querySelector('#filter option[value="Salvo"]').textContent, expected[locale].saved);
        assert.ok(doc.querySelector('[data-sort="rent"]').getAttribute('aria-label').includes(expected[locale].rent));
        assert.equal(doc.querySelectorAll('#quick-portals a').length, 4);
        assert.equal(doc.getElementById('budgetstat').textContent, 'EUR ' + new Intl.NumberFormat(locale).format(3000));
        assert.ok(doc.getElementById('research-caption').textContent.includes('CHF'));
        assert.equal(JSON.parse(dashboard.window.localStorage.getItem('casa-suica-v1')).researchCatalog.rows.length, research.rows.length);
        host.window.close(); dashboard.window.close();
    });
}
test('reads the latest host selection at unlock, including a gate language change', () => {
    const { host, dashboard } = fromHost('it-IT', 'sv-SE');
    assert.equal(dashboard.window.document.documentElement.lang, 'sv-SE');
    assert.equal(dashboard.window.document.querySelector('h1').textContent, expected['sv-SE'].heading);
    host.window.close(); dashboard.window.close();
});
test('catalogs cover research summaries, metadata and runtime reasons without changing canonical values', () => {
    assert.deepEqual(Object.keys(translations['it-IT']).sort(), Object.keys(translations['sv-SE']).sort());
    for (const locale of ['it-IT', 'sv-SE']) {
        for (const row of research.rows) {
            for (const field of ['title', 'notes', 'garden', 'pets', 'available', 'source']) {
                const value = row[field];
                if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value) && !['Homegate · BETTERHOMES', 'Homegate · XS AG'].includes(value)) {
                    assert.ok(Object.hasOwn(translations[locale], value), locale + ': ' + field + ': ' + value);
                }
            }
        }
        const dom = create(locale), w = dom.window, doc = w.document;
        const mode = doc.getElementById('research-mode'); mode.value = 'archive'; mode.dispatchEvent(new w.Event('change'));
        for (const value of ['Salvo', 'Visita marcada', 'Descartado']) {
            assert.ok(doc.querySelector('#filter option[value="' + value + '"]'));
        }
        assert.equal(JSON.stringify(JSON.parse(w.localStorage.getItem('casa-suica-v1')).researchCatalog.rows), JSON.stringify(research.rows));
        assert.ok(doc.getElementById('research-rows').textContent.includes(expected[locale].reason));
        assert.ok(!doc.getElementById('research-rows').textContent.includes('endereço não divulgado'));
        assert.ok(!doc.getElementById('research-rows').textContent.includes('número não informado'));
        const walker = doc.createTreeWalker(doc.body, w.NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.parentElement.closest('script,style')) {
                continue;
            }
            const source = node.textContent.trim();
            if (Object.hasOwn(translations[locale], source)) {
                assert.equal(translations[locale][source], source, locale + ': untranslated visible UI: ' + source);
            }
        }
        dom.window.close();
    }
});
test('language changes retain saved filters, research links and personal notes; exports reopen in that language', async () => {
    const dom = create('pt-BR'), w = dom.window;
    w.saveResearch(research.rows[0].id);
    const saved = JSON.parse(w.localStorage.getItem('casa-suica-v1'));
    saved.list.push({ id: 'personal', title: 'Pesquisa de imóveis', town: 'Kriens', rent: '2000', status: 'Salvo', garden: 'A confirmar', pets: 'Sim', notes: 'Não traduzir <em>minhas notas</em> 🐶' });
    saved.researchFilters.minBathrooms = 2;
    saved.researchFilters.sort = 'rent'; saved.researchFilters.sortDirection = 'desc';
    saved.checks = [1, 4];
    dom.window.close();
    const localized = create('sv-SE', JSON.stringify(saved)), v = localized.window, doc = v.document;
    assert.equal(doc.querySelector('h1').textContent, expected['sv-SE'].heading);
    assert.equal(doc.getElementById('research-bathrooms').value, '2');
    assert.equal(doc.querySelector('[data-sort="rent"]').closest('th').getAttribute('aria-sort'), 'descending');
    assert.deepEqual([...doc.querySelectorAll('[data-check]:checked')].map(el => Number(el.dataset.check)), [1, 4]);
    assert.ok(doc.getElementById('allentries').textContent.includes('Pesquisa de imóveis'));
    assert.ok(doc.getElementById('allentries').textContent.includes('Não traduzir <em>minhas notas</em> 🐶'));
    assert.equal(doc.querySelectorAll('#allentries em').length, 0);
    assert.ok(doc.getElementById('allentries').textContent.includes(translations['sv-SE'][research.rows[0].title]));
    assert.ok(doc.getElementById('allentries').textContent.includes(translations['sv-SE'][research.rows[0].notes]));
    const modal = doc.getElementById('modal'); modal.showModal = () => {}; modal.close = () => {};
    v.openForm(saved.list[0].id);
    const form = doc.getElementById('listingform');
    assert.equal(form.elements.title.value, translations['sv-SE'][research.rows[0].title]);
    assert.ok(form.elements.notes.value.includes(translations['sv-SE'][research.rows[0].notes]));
    form.dispatchEvent(new v.Event('submit', { cancelable: true }));
    const edited = JSON.parse(v.localStorage.getItem('casa-suica-v1')).list[0];
    assert.equal(edited.title, saved.list[0].title);
    assert.equal(edited.notes, saved.list[0].notes);
    assert.equal(edited.researchId, saved.list[0].researchId);
    let captured; v.Blob = Blob; v.URL.createObjectURL = blob => {
        captured = blob; return 'blob:test';
    }; v.URL.revokeObjectURL = () => {}; v.HTMLAnchorElement.prototype.click = () => {};
    v.downloadOffline(); const html = await captured.text();
    assert.ok(!html.includes('/*DASHBOARD_'));
    const reopened = new JSDOM(html, { url: 'https://offline.example/', runScripts: 'dangerously' });
    assert.equal(reopened.window.document.documentElement.lang, 'sv-SE');
    assert.equal(reopened.window.document.querySelector('h1').textContent, expected['sv-SE'].heading);
    assert.equal(JSON.parse(reopened.window.localStorage.getItem('casa-suica-v1')).list.find(row => row.id === 'personal').notes, saved.list[1].notes);
    localized.window.close(); reopened.window.close();
});
test('unsupported locale falls back to site default and embedded translations/data cannot close the script', () => {
    const payload = '</script><script>window.untrustedExecuted=true</script>';
    const data = { ...research, rows: [{ ...research.rows[0], notes: payload }] };
    const html = buildDashboardDocument({ template, research: data, model, localization, translations, locale: payload });
    const dom = new JSDOM(html, { url: 'https://engnata.eu/casasuica/', runScripts: 'dangerously' });
    assert.equal(dom.window.document.documentElement.lang, 'it-IT');
    assert.equal(dom.window.untrustedExecuted, undefined);
    assert.equal(JSON.parse(dom.window.localStorage.getItem('casa-suica-v1')).researchCatalog.rows[0].notes, payload);
    assert.ok(dom.window.document.getElementById('research-rows').textContent.includes(payload));
    dom.window.close();
});
