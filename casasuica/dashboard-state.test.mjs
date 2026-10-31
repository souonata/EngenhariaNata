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
        assert.match(tr.querySelector('[data-column="transit"]').textContent, /^(≈ )?\d+ min$/);
        assert.match(tr.querySelector('[data-column="bike"]').textContent, /^≈ \d+ min$/);
        assert.equal(tr.querySelectorAll('[data-column] a, [data-column] small, [data-column] details').length, 0);
    }
    dom.window.close();
});
test('header clicks reverse sort, expose accessible direction and persist through filtering/reopening', () => {
    const dom = create(), w = dom.window, doc = w.document;
    const mode = doc.getElementById('research-mode'); mode.value = 'archive'; mode.dispatchEvent(new w.Event('change'));
    const button = doc.querySelector('[data-sort="rent"]'); button.focus(); button.click();
    assert.equal(doc.activeElement, button);
    assert.equal(button.closest('th').getAttribute('aria-sort'), 'descending');
    assert.equal(button.querySelector('.sort-icon').textContent, '↓');
    const displayed = () => [...doc.querySelectorAll('#research-rows > tr')].map(tr => data.rows.find(row => row.id === tr.dataset.propertyId));
    assert.equal(displayed()[0].rent, Math.max(...data.rows.map(row => row.rent ?? 0)));
    assert.equal(displayed().at(-1).rent, null);
    button.click();
    assert.equal(button.closest('th').getAttribute('aria-sort'), 'ascending');
    assert.equal(displayed()[0].rent, Math.min(...data.rows.filter(row => row.rent !== null).map(row => row.rent)));
    for (const field of ['transit', 'bike']) {
        const sort = doc.querySelector('[data-sort="' + field + '"]'); sort.click(); sort.click();
        assert.equal(sort.closest('th').getAttribute('aria-sort'), 'descending');
        assert.equal(button.closest('th').getAttribute('aria-sort'), 'none');
    }
    const price = doc.getElementById('research-price'); price.value = '2500'; price.dispatchEvent(new w.Event('input'));
    const saved = w.localStorage.getItem('casa-suica-v1'); dom.window.close();
    const reopened = create(saved), restored = reopened.window.document;
    assert.equal(restored.querySelector('[data-sort="bike"]').closest('th').getAttribute('aria-sort'), 'descending');
    assert.equal(restored.getElementById('column-price').value, '2500');
    assert.equal(restored.querySelectorAll('th[aria-sort="descending"]').length, 1);
    reopened.window.close();
});
test('quantity filters above columns synchronize with top controls and can be cleared/reset', () => {
    const dom = create(), w = dom.window, doc = w.document;
    const change = (id, value) => {
        const el = doc.getElementById(id); el.value = value; el.dispatchEvent(new w.Event('input'));
    };
    change('column-price', '2300'); assert.equal(doc.getElementById('research-price').value, '2300');
    change('research-price', '10000'); assert.equal(doc.getElementById('column-price').value, '10000');
    change('column-bedrooms', '3'); assert.equal(doc.getElementById('research-bedrooms').value, '3');
    change('research-bedrooms', '0'); assert.equal(doc.getElementById('column-bedrooms').value, '0');
    change('column-bathrooms', '2'); assert.equal(doc.getElementById('research-bathrooms').value, '2');
    change('research-bathrooms', '0'); assert.equal(doc.getElementById('column-bathrooms').value, '0');
    change('research-minutes', '200'); change('column-area', '100'); change('column-floor', '0'); change('column-transit', '20'); change('column-bike', '35');
    const visible = [...doc.querySelectorAll('#research-rows > tr[data-property-id]')].map(tr => data.rows.find(row => row.id === tr.dataset.propertyId));
    assert.ok(visible.length > 0);
    assert.ok(visible.every(row => row.area === null || row.area >= 100));
    assert.ok(visible.every(row => row.floor === null || row.floor <= 0));
    assert.ok(visible.every(row => row.commute.minutes <= 20 && row.bike.minutes <= 35));
    const saved = w.localStorage.getItem('casa-suica-v1');
    const reopened = create(saved);
    assert.equal(reopened.window.document.getElementById('column-area').value, '100');
    assert.equal(reopened.window.document.getElementById('column-floor').value, '0');
    reopened.window.close();
    change('column-transit', '');
    assert.equal(JSON.parse(w.localStorage.getItem('casa-suica-v1')).researchFilters.maxTransitMinutes, null);
    w.resetResearchFilters();
    assert.equal(doc.getElementById('column-price').value, '3000');
    assert.equal(doc.getElementById('column-area').value, '0');
    for (const id of ['column-floor', 'column-transit', 'column-bike']) {
        assert.equal(doc.getElementById(id).value, '');
    }
    dom.window.close();
});
test('HTML download includes dataset and current state and has no runtime template markers', async () => {
    const dom = create(), w = dom.window; let captured;
    w.Blob = Blob; w.URL.createObjectURL = blob => {
        captured = blob; return 'blob:test';
    }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = () => {};
    const area = w.document.getElementById('column-area'); area.value = '100'; area.dispatchEvent(new w.Event('input'));
    const bedrooms = w.document.querySelector('[data-sort="bedrooms"]'); bedrooms.click(); bedrooms.click();
    w.downloadOffline(); const html = await captured.text();
    assert.ok(html.includes('wolhusen-tutti83780261'));
    assert.ok(html.includes('state.researchCatalog'));
    assert.ok(!html.includes('/*RESEARCH_DATA*/'));
    assert.ok(!html.includes('/*RESEARCH_MODEL*/'));
    const reopened = new JSDOM(html, { url: 'https://offline.example/', runScripts: 'dangerously' });
    assert.equal(JSON.parse(reopened.window.localStorage.getItem('casa-suica-v1')).researchCatalog.rows.length, data.rows.length);
    assert.equal(reopened.window.document.getElementById('column-area').value, '100');
    assert.equal(reopened.window.document.querySelector('[data-sort="bedrooms"]').closest('th').getAttribute('aria-sort'), 'descending');
    dom.window.close(); reopened.window.close();
});
