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
    const saved = w.localStorage.getItem('casa-suica-v1'); dom.window.close();
    const reopened = create(saved);
    assert.equal(reopened.window.document.getElementById('research-price').value, '2000');
    assert.equal(reopened.window.document.getElementById('research-bathrooms').value, '2');
    assert.equal(JSON.parse(reopened.window.localStorage.getItem('casa-suica-v1')).researchCatalog.rows.length, data.rows.length);
    const mode = reopened.window.document.getElementById('research-mode'); mode.value = 'archive'; mode.dispatchEvent(new reopened.window.Event('change'));
    assert.equal(reopened.window.document.querySelectorAll('#research-rows > tr').length, data.rows.length);
    reopened.window.close();
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
