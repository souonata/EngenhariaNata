const supported = ['pt-BR', 'it-IT', 'sv-SE'];

export function renderDashboard(template, translations, locale) {
    const language = supported.includes(locale) ? locale : 'it-IT';
    return template
        .replace('/*LIVECOST_LOCALE*/', JSON.stringify(language))
        .replace('/*LIVECOST_TRANSLATIONS*/', JSON.stringify(translations).replaceAll('<', '\\u003c'));
}
