import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from '../local/node_modules/jsdom/lib/api.js';
const data = JSON.parse(readFileSync(new URL('./research-data.json', import.meta.url)));
const template = readFileSync(new URL('./dashboard-source.txt', import.meta.url), 'utf8');
const model = readFileSync(new URL('./research-model.mjs', import.meta.url), 'utf8').replaceAll('export ', '');
function create(saved) {
    const html = template.replace('/*RESEARCH_DATA*/', () => JSON.stringify(data)).replace('/*RESEARCH_MODEL*/', () => model);
    return new JSDOM(html, { url: 'https://engnata.eu/casasuica/', runScripts: 'dangerously', beforeParse(window) {
        if (saved) {
            window.localStorage.setItem('casa-suica-v1', saved);
        }
    } });
}
test('all source rows are cached even when filters hide them; filters survive reopening', () => {
    const dom = create(), w = dom.window;
    assert.equal(JSON.parse(w.localStorage.getItem('casa-suica-v1')).researchCatalog.rows.length, data.rows.length);
    const price = w.document.getElementById('research-price'); price.value = '2000'; price.dispatchEvent(new w.Event('input'));
    const baths = w.document.getElementById('research-bathrooms'); baths.value = '2'; baths.dispatchEvent(new w.Event('input'));
    const garden = w.document.getElementById('research-garden'); garden.value = 'private'; garden.dispatchEvent(new w.Event('change'));
    const ground = w.document.getElementById('research-ground-floor'); ground.checked = true; ground.dispatchEvent(new w.Event('change'));
    const travel = w.document.getElementById('research-travel-mode'); travel.value = 'either'; travel.dispatchEvent(new w.Event('change'));
    const saved = w.localStorage.getItem('casa-suica-v1'); dom.window.close();
    const reopened = create(saved);
    assert.equal(reopened.window.document.getElementById('research-price').value, '2000');
    assert.equal(reopened.window.document.getElementById('research-bathrooms').value, '2');
    assert.equal(reopened.window.document.getElementById('research-garden').value, 'private');
    assert.equal(reopened.window.document.getElementById('research-ground-floor').checked, true);
    assert.equal(reopened.window.document.getElementById('research-travel-mode').value, 'either');
    assert.equal(JSON.parse(reopened.window.localStorage.getItem('casa-suica-v1')).researchCatalog.rows.length, data.rows.length);
    const mode = reopened.window.document.getElementById('research-mode'); mode.value = 'archive'; mode.dispatchEvent(new reopened.window.Event('change'));
    assert.equal(reopened.window.document.querySelectorAll('#research-rows > tr').length, data.rows.length);
    reopened.window.close();
});
test('optional defaults migrate old filters; separate index listings can both be shortlisted', () => {
    const dom = create(JSON.stringify({ list: [], prefs: { garden: true }, researchFilters: { maxPrice: 3000 } }));
    const w = dom.window;
    assert.equal(w.document.getElementById('research-garden').value, 'any');
    assert.equal(w.document.getElementById('research-ground-floor').checked, false);
    assert.equal(w.document.getElementById('garden').checked, false);
    const rows = data.rows.filter(r => r.sourceIndex && r.town === 'Kriens').slice(0, 2);
    rows.forEach(r => w.saveResearch(r.id));
    assert.equal(JSON.parse(w.localStorage.getItem('casa-suica-v1')).list.length, 2);
    w.resetResearchFilters();
    assert.equal(w.document.getElementById('research-garden').value, 'any');
    assert.equal(w.document.getElementById('research-ground-floor').checked, false);
    dom.window.close();
});
test('every archived home has both minute values; town-centre approximations stay unconfirmed', () => {
    for (const row of data.rows) {
        assert.ok(Number.isFinite(row.commute.minutes), row.id);
        assert.ok(Number.isFinite(row.bike.minutes), row.id);
        const origin = row.commute.originCoordinates;
        assert.ok(origin.latitude > 46.75 && origin.latitude < 47.35 && origin.longitude > 7.85 && origin.longitude < 8.55, row.id + ': reject a resolved place outside the search region');
        if (row.commute.originBasis === 'city-center') {
            assert.equal(row.commute.approximate, true);
            assert.equal(row.commute.confirmed, false);
        }
        assert.equal(row.bike.approximate, true);
    }
    const dom = create();
    const w = dom.window;
    const mode = w.document.getElementById('research-mode'); mode.value = 'archive'; mode.dispatchEvent(new w.Event('change'));
    for (const tr of w.document.querySelectorAll('#research-rows > tr')) {
        assert.match(tr.children[4].textContent, /^TP: (≈ )?\d+ minBicicleta: ≈ \d+ min$/);
        assert.equal(tr.children[4].querySelectorAll('a, small, details').length, 0);
    }
    dom.window.close();
});
test('HTML download includes dataset and current state and has no runtime template markers', async () => {
    const dom = create(), w = dom.window; let captured;
    w.Blob = Blob; w.URL.createObjectURL = blob => {
        captured = blob; return 'blob:test';
    }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = () => {};
    w.downloadOffline(); const html = await captured.text();
    assert.ok(html.includes('wolhusen-tutti83780261'));
    assert.ok(html.includes('state.researchCatalog'));
    assert.ok(!html.includes('/*RESEARCH_DATA*/'));
    assert.ok(!html.includes('/*RESEARCH_MODEL*/'));
    const reopened = new JSDOM(html, { url: 'https://offline.example/', runScripts: 'dangerously' });
    assert.equal(JSON.parse(reopened.window.localStorage.getItem('casa-suica-v1')).researchCatalog.rows.length, data.rows.length);
    dom.window.close(); reopened.window.close();
});
