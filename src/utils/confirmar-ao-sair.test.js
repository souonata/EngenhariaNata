import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { configurarConfirmacaoAoSair, ehCampoNumerico } from './confirmar-ao-sair.js';

const HTML = `
    <input id="campoA" class="valor-input" value="10">
    <input id="campoB" class="valor-input" value="20">
    <input id="numero" type="number" value="5">
    <input id="texto" type="text" value="abc">
    <input type="range" id="sliderA" min="0" max="100" value="10">
    <h1 id="fora">Título</h1>
`;

let dom;
let desligar;

function montar({ toque = false } = {}) {
    dom = new JSDOM(`<!doctype html><body>${HTML}</body>`, { pretendToBeVisual: true });
    dom.window.matchMedia = (consulta) => ({
        matches: toque && consulta.includes('coarse'),
        media: consulta,
        addEventListener() {},
        removeEventListener() {}
    });
    desligar = configurarConfirmacaoAoSair(dom.window.document, dom.window);
    return dom.window.document;
}

/** Conta quantas vezes cada campo perdeu o foco. */
function espionarBlur(doc, id) {
    const registro = { vezes: 0 };
    doc.getElementById(id).addEventListener('blur', () => registro.vezes++);
    return registro;
}

beforeEach(() => { dom = null; desligar = null; });
afterEach(() => { if (desligar) desligar(); });

describe('ehCampoNumerico', () => {
    it('aceita .valor-input e input[type=number]', () => {
        const doc = montar();
        expect(ehCampoNumerico(doc.getElementById('campoA'))).toBe(true);
        expect(ehCampoNumerico(doc.getElementById('numero'))).toBe(true);
    });

    it('recusa texto comum, slider e nulo', () => {
        const doc = montar();
        expect(ehCampoNumerico(doc.getElementById('texto'))).toBe(false);
        expect(ehCampoNumerico(doc.getElementById('sliderA'))).toBe(false);
        expect(ehCampoNumerico(null)).toBe(false);
    });
});

describe('confirmação ao sair do campo', () => {
    it('toque fora confirma o campo em edição', () => {
        const doc = montar();
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        doc.getElementById('fora').dispatchEvent(
            new dom.window.Event('pointerdown', { bubbles: true })
        );

        expect(blur.vezes).toBe(1);
        expect(doc.activeElement).not.toBe(campo);
    });

    it('toque no slider também confirma — é o caso do dia a dia', () => {
        const doc = montar();
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        doc.getElementById('sliderA').dispatchEvent(
            new dom.window.Event('pointerdown', { bubbles: true })
        );

        expect(blur.vezes).toBe(1);
    });

    it('toque no próprio campo não interrompe a digitação', () => {
        const doc = montar();
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        campo.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));

        expect(blur.vezes).toBe(0);
        expect(doc.activeElement).toBe(campo);
    });

    it('Enter confirma o campo', () => {
        const doc = montar();
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        campo.dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        expect(blur.vezes).toBe(1);
    });

    it('Enter não desfaz o foco que o app já moveu (Enter cíclico)', () => {
        const doc = montar();
        const campoA = doc.getElementById('campoA');
        const campoB = doc.getElementById('campoB');
        const blurB = espionarBlur(doc, 'campoB');

        // App move o foco no próprio handler, antes de o listener global rodar.
        campoA.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') campoB.focus();
        });

        campoA.focus();
        campoA.dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        expect(blurB.vezes).toBe(0);
        expect(doc.activeElement).toBe(campoB);
    });

    it('outras teclas não confirmam', () => {
        const doc = montar();
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        campo.dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: '7', bubbles: true })
        );

        expect(blur.vezes).toBe(0);
    });

    it('campo de texto comum em foco é ignorado', () => {
        const doc = montar();
        const texto = doc.getElementById('texto');
        const blur = espionarBlur(doc, 'texto');

        texto.focus();
        doc.getElementById('fora').dispatchEvent(
            new dom.window.Event('pointerdown', { bubbles: true })
        );

        expect(blur.vezes).toBe(0);
    });

    it('rolagem confirma em tela de toque', () => {
        const doc = montar({ toque: true });
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        dom.window.dispatchEvent(new dom.window.Event('scroll'));

        expect(blur.vezes).toBe(1);
    });

    it('rolagem NÃO confirma no desktop: a roda do mouse não encerra a edição', () => {
        const doc = montar({ toque: false });
        const campo = doc.getElementById('campoA');
        const blur = espionarBlur(doc, 'campoA');

        campo.focus();
        dom.window.dispatchEvent(new dom.window.Event('scroll'));

        expect(blur.vezes).toBe(0);
    });
});
