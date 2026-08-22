import { describe, expect, it } from 'vitest';

import { MAX_PAGE_NUMBER, parsePageSelection } from './pintor-pages.js';

describe('Pintor page selection', () => {
    it.each([
        ['1', [1]],
        ['12', [12]],
        ['92', [92]],
        ['1, 5, 9, 95', [1, 5, 9, 95]],
        ['1-5', [1, 2, 3, 4, 5]],
        ['2-7', [2, 3, 4, 5, 6, 7]],
        ['12-50', Array.from({ length: 39 }, (_, index) => index + 12)],
        ['1, 3-5, 9-11, 15', [1, 3, 4, 5, 9, 10, 11, 15]]
    ])('accepts the supported page notation %s', (notation, pages) => {
        expect(parsePageSelection(notation)).toEqual(pages);
    });

    it('accepts comma-separated pages and inclusive ranges', () => {
        expect(parsePageSelection('40, 42, 44-46')).toEqual([40, 42, 44, 45, 46]);
    });

    it('deduplicates pages while preserving the requested order', () => {
        expect(parsePageSelection('44, 40-42, 41, 46')).toEqual([44, 40, 41, 42, 46]);
    });

    it('accepts a whole manual, because the page count is no longer capped', () => {
        expect(parsePageSelection('1-4000')).toHaveLength(4000);
    });

    it('rejects empty, descending, and out-of-bound selections', () => {
        expect(() => parsePageSelection('')).toThrow();
        expect(() => parsePageSelection('46-40')).toThrow();
        expect(() => parsePageSelection('0')).toThrow();
        expect(() => parsePageSelection(`1,${MAX_PAGE_NUMBER + 1}`)).toThrow();
    });
});
