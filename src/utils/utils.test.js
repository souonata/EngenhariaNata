import { describe, expect, it } from 'vitest';

import { parsearNumero } from './formatters.js';
import { validarURL } from './sanitize.js';
import { validarNumero } from './validators.js';

describe('parsearNumero', () => {
    it('aceita numero ja normalizado', () => {
        expect(parsearNumero(12.5)).toBe(12.5);
    });

    it('interpreta formato pt-BR/it-IT com separador de milhar', () => {
        expect(parsearNumero('1.234,56')).toBe(1234.56);
    });

    it('mantem ponto decimal quando nao ha virgula', () => {
        expect(parsearNumero('1234.56')).toBe(1234.56);
    });

    it('retorna zero para entrada vazia ou invalida', () => {
        expect(parsearNumero('')).toBe(0);
        expect(parsearNumero('abc')).toBe(0);
    });
});

describe('validarNumero', () => {
    it('valida numeros com virgula decimal e milhar', () => {
        expect(validarNumero('1.234,56', 1000, 2000)).toBe(true);
    });

    it('nao trata campo vazio como zero valido', () => {
        expect(validarNumero('', 0, 10)).toBe(false);
    });

    it('rejeita valores fora do intervalo', () => {
        expect(validarNumero('11', 0, 10)).toBe(false);
    });
});

describe('validarURL', () => {
    it('aceita rotas relativas usadas em site estatico', () => {
        expect(validarURL('../index.html')).toBe('../index.html');
        expect(validarURL('./app.html')).toBe('./app.html');
        expect(validarURL('sobre/sobre.html')).toBe('sobre/sobre.html');
        expect(validarURL('#topo')).toBe('#topo');
    });

    it('bloqueia protocolos executaveis e URLs protocol-relative', () => {
        expect(validarURL('javascript:alert(1)')).toBe('#');
        expect(validarURL('//evil.example/script.js')).toBe('#');
    });
});
