// Neither the length of a manual nor the number of pages one job may paint is capped. The
// notation still needs a ceiling: "1-999999999" would expand into a list that exhausts memory
// before the file ever reaches the API.
export const MAX_PAGE_NUMBER = 100000;

export function parsePageSelection(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 400) {
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
        if (first < 1 || last < first || last > MAX_PAGE_NUMBER) {
            throw new Error('range');
        }
        for (let page = first; page <= last; page += 1) {
            if (!seen.has(page)) {
                seen.add(page);
                pages.push(page);
            }
        }
    }
    return pages;
}
