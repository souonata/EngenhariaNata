export const MAX_SELECTED_PAGES = 50;
export const MAX_DOCUMENT_PAGES = 2000;

export function parsePageSelection(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 200) {
        throw new Error('empty');
    }
    const pages = [];
    const seen = new Set();
    for (const rawPart of text.split(',')) {
        const match = rawPart.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!match) {
            throw new Error('syntax');
        }
        const first = Number(match[1]);
        const last = Number(match[2] || match[1]);
        if (first < 1 || last < first || last > MAX_DOCUMENT_PAGES) {
            throw new Error('range');
        }
        for (let page = first; page <= last; page += 1) {
            if (!seen.has(page)) {
                seen.add(page);
                pages.push(page);
            }
            if (pages.length > MAX_SELECTED_PAGES) {
                throw new Error('too-many');
            }
        }
    }
    return pages;
}
