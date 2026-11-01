export const DASHBOARD_LOCALES = ['pt-BR', 'it-IT', 'sv-SE'];

export function buildDashboardDocument({ template, research, model, localization, translations, locale }) {
    const language = DASHBOARD_LOCALES.includes(locale) ? locale : 'it-IT';
    const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
    return template.replace('lang="pt-BR"', `lang="${language}"`)
        .replace('/*DASHBOARD_LOCALE*/', () => json(language))
        .replace('/*DASHBOARD_TRANSLATIONS*/', () => json(translations[language] || {}))
        .replace('/*DASHBOARD_LOCALIZATION*/', () => localization.replaceAll('export ', ''))
        .replace('/*RESEARCH_DATA*/', () => json(research))
        .replace('/*RESEARCH_MODEL*/', () => model.replaceAll('export ', ''));
}
