import { describe, expect, it } from 'vitest';

import { localizedFetchError } from './pintor-network.js';

describe('Pintor network errors', () => {
    const localized = "L'API protetta di Pintor non è disponibile in questo momento.";

    it('substitui o TypeError nativo do fetch pela mensagem localizada', () => {
        expect(localizedFetchError(new TypeError('Failed to fetch'), localized)).toBe(localized);
    });

    it('cobre as variantes de erro de transporte dos navegadores', () => {
        expect(
            localizedFetchError(new Error('NetworkError when attempting to fetch'), localized)
        ).toBe(localized);
        expect(localizedFetchError(new Error('Load failed'), localized)).toBe(localized);
    });

    it('preserva erros de validação já traduzidos', () => {
        expect(localizedFetchError(new Error('Codice di accesso non valido.'), localized)).toBe(
            'Codice di accesso non valido.'
        );
    });
});
