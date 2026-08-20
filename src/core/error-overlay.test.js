import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';

const overlaySource = readFileSync(
    fileURLToPath(new URL('../../assets/js/error-overlay.js', import.meta.url)),
    'utf8'
);

function createPage() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        runScripts: 'outside-only',
        url: 'https://engnata.eu/pintor/'
    });
    dom.window.eval(overlaySource);
    return dom;
}

function overlay(dom) {
    return dom.window.document.querySelector('[role="alert"]');
}

describe('global error overlay', () => {
    let dom;

    beforeEach(() => {
        dom = createPage();
    });

    it('ignores failed non-critical resources and empty browser error events', () => {
        const image = dom.window.document.createElement('img');
        dom.window.document.body.appendChild(image);
        image.dispatchEvent(new dom.window.Event('error'));
        dom.window.dispatchEvent(new dom.window.ErrorEvent('error'));

        expect(overlay(dom)).toBeNull();
    });

    it('ignores blocked third-party scripts', () => {
        const script = dom.window.document.createElement('script');
        script.src = 'https://gc.zgo.at/count.js';
        dom.window.document.body.appendChild(script);
        script.dispatchEvent(new dom.window.Event('error'));

        expect(overlay(dom)).toBeNull();
    });

    it('reports same-origin script failures and runtime exceptions', () => {
        const script = dom.window.document.createElement('script');
        script.src = '/assets/js/app.js';
        dom.window.document.body.appendChild(script);
        script.dispatchEvent(new dom.window.Event('error'));

        expect(overlay(dom)?.textContent).toContain('Falha ao carregar: /assets/js/app.js');

        dom.window.dispatchEvent(
            new dom.window.ErrorEvent('error', {
                message: 'boom',
                filename: 'https://engnata.eu/assets/js/app.js',
                lineno: 12,
                colno: 4
            })
        );

        expect(overlay(dom)?.textContent).toContain('boom  [/assets/js/app.js:12:4]');
    });

    it('keeps the explicit fatal-error reporter available', () => {
        dom.window.__engnataReportError('initialization failed');

        expect(overlay(dom)?.textContent).toContain('initialization failed');
    });
});
