/* global LOCALE, MESSAGES, RESEARCH */
// The language comes from the host at unlock time, never from saved housing preferences.
export function tr(source, values = {}) {
    const text = String(source ?? '');
    const normalized = text.trim().replace(/\s+/g, ' ');
    const translated = Object.hasOwn(MESSAGES, text) ? MESSAGES[text] : Object.hasOwn(MESSAGES, normalized) ? MESSAGES[normalized] : text;
    return translated.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

export function numberLabel(value, options = {}) {
    return Number(value).toLocaleString(LOCALE, options);
}

export function dateLabel(value) {
    const text = String(value ?? '');
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    const parts = iso ? [iso[1], iso[2], iso[3]] : dayFirst ? [dayFirst[3], dayFirst[2], dayFirst[1]] : null;
    return parts ? new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC' }).format(new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))) : tr(text);
}

export function addressLabel(value) {
    return String(value ?? '').replace('endereço não divulgado', tr('endereço não divulgado'))
        .replace('número não informado', tr('número não informado'));
}

export function localizeStaticContent() {
    document.documentElement.lang = LOCALE;
    document.title = tr(document.title);
    // Keep canonical option values before changing visible labels: filters/backups stay compatible.
    for (const option of document.querySelectorAll('option:not([value])')) {
        option.value = option.textContent;
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement?.closest('script, style')) {
            continue;
        }
        const source = node.textContent.trim();
        if (source) {
            node.textContent = node.textContent.replace(source, tr(source));
        }
    }
    for (const el of document.querySelectorAll('[placeholder], [title], [aria-label]')) {
        for (const name of ['placeholder', 'title', 'aria-label']) {
            if (el.hasAttribute(name)) {
                el.setAttribute(name, tr(el.getAttribute(name)));
            }
        }
    }
}

export function savedNotesLabel(listing) {
    const row = RESEARCH.rows.find(item => item.id === listing.researchId);
    const prefix = 'Pesquisa de ' + RESEARCH.checkedAt + '. ';
    const suffix = '. ' + (row?.notes || '');
    if (row && listing.notes?.startsWith(prefix) && listing.notes.endsWith(suffix)) {
        const reasons = listing.notes.slice(prefix.length, -suffix.length).split('; ').filter(Boolean).map(reason => tr(reason)).join('; ');
        return tr('Pesquisa de {date}. {reasons}. {notes}', { date: dateLabel(RESEARCH.checkedAt), reasons, notes: tr(row.notes) });
    }
    // Personal titles and notes are never sent to a service or automatically translated.
    return listing.notes || '';
}

export function savedTitleLabel(listing) {
    return listing.researchId && !listing.customTitle ? tr(listing.title) : listing.title;
}
