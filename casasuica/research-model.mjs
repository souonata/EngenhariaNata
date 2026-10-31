export const DEFAULT_FILTERS = Object.freeze({ currency: 'EUR', maxPrice: 3000, chfPerEur: 0.9194, minBedrooms: 2, minBathrooms: 0, maxMinutes: 45, includeUnknown: true, mode: 'candidates', town: '', sort: 'rent' });

export function evaluateProperty(row, filters = DEFAULT_FILTERS) {
    const excluded = [], pending = [];
    const limit = Number(filters.maxPrice) * (filters.currency === 'EUR' ? Number(filters.chfPerEur) : 1);
    if (!Number.isFinite(limit) || limit < 0 || !Number.isFinite(Number(filters.chfPerEur)) || Number(filters.chfPerEur) <= 0) {
        return { excluded: ['Informe preço e câmbio válidos.'], pending, confirmed: false };
    }
    if (['expirado', 'removido'].includes(row.availabilityStatus)) {
        excluded.push('Anúncio expirado/removido na consulta');
    } else if (row.availabilityStatus === 'incerto') {
        pending.push('Disponibilidade incerta');
    }
    if ((row.rent === null || row.rent === undefined)) {
        pending.push('Preço total desconhecido');
    } else if (Number(row.rent) > limit + 0.005) {
        excluded.push('Acima do preço máximo');
    }
    if (row.totalConfirmed === false) {
        pending.push('Encargos/total precisam de confirmação');
    }
    for (const [field, min, label] of [['bedrooms', filters.minBedrooms, 'Quartos'], ['bathrooms', filters.minBathrooms, 'Banheiros completos']]) {
        if (Number(min) > 0) {
            if ((row[field] === null || row[field] === undefined) || row[field] === '') {
                pending.push(label + ' não informados');
            } else if (Number(row[field]) < Number(min)) {
                excluded.push(label + ' abaixo do mínimo');
            }
        }
    }
    if (['Compartilhado', 'Não'].includes(row.garden)) {
        excluded.push('Sem jardim privativo com área verde');
    } else if (row.garden !== 'Privativo com área verde') {
        pending.push('Jardim privativo com área verde a confirmar');
    }
    if (row.pets === 'Não') {
        excluded.push('Animais proibidos');
    } else if (!String(row.pets || '').startsWith('Sim')) {
        pending.push('Permissão para cão a confirmar');
    }
    if ((row.commute?.minutes !== null && row.commute?.minutes !== undefined)) {
        if (Number(row.commute.minutes) > Number(filters.maxMinutes)) {
            excluded.push('Trajeto consultado acima do limite');
        }
        if (!row.commute.confirmed) {
            pending.push('Trecho desde a porta não verificado');
        }
    } else {
        pending.push('Trajeto não verificado');
    }
    return { excluded, pending, confirmed: !excluded.length && !pending.length };
}

export function filterResearchRows(rows, filters = DEFAULT_FILTERS) {
    return rows.map(row => ({ row, ...evaluateProperty(row, filters) })).filter(result => {
        if (filters.mode === 'archive') {
            return !filters.town || result.row.town === filters.town;
        }
        if (result.excluded.length || (filters.town && result.row.town !== filters.town)) {
            return false;
        }
        return filters.mode === 'confirmed' || !filters.includeUnknown ? result.confirmed : true;
    }).sort((a, b) => filters.sort === 'town' ? a.row.town.localeCompare(b.row.town) : (a.row.rent ?? Infinity) - (b.row.rent ?? Infinity));
}
