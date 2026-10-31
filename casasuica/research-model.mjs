export const DEFAULT_FILTERS = Object.freeze({ currency: 'EUR', maxPrice: 3000, chfPerEur: 0.9194, minBedrooms: 2, minBathrooms: 0, minArea: 0, maxFloor: null, maxTransitMinutes: null, maxBikeMinutes: null, maxMinutes: 45, travelMode: 'transit', garden: 'any', groundFloorOnly: false, includeUnknown: true, mode: 'candidates', town: '', sort: 'rent', sortDirection: 'asc' });

export const SORT_LABELS = Object.freeze({ town: 'Cidade', rent: 'Preço', area: 'Área', bedrooms: 'Quartos', bathrooms: 'Banheiros', floor: 'Andar', garden: 'Jardim', pets: 'Cão', transit: 'Transporte público', bike: 'Bicicleta', status: 'Situação' });

export function estimateBicycleMinutes(origin, destination) {
    if (![origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude].every(Number.isFinite)) {
        return null;
    }
    if ([origin, destination].some(p => Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) {
        return null;
    }
    const rad = x => x * Math.PI / 180;
    const a = Math.sin(rad(destination.latitude - origin.latitude) / 2) ** 2 + Math.cos(rad(origin.latitude)) * Math.cos(rad(destination.latitude)) * Math.sin(rad(destination.longitude - origin.longitude) / 2) ** 2;
    const directKm = 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
    // Planning assumptions, not a routed cycling itinerary: 35% detour, 15 km/h, 3 min buffer.
    return Math.max(1, Math.ceil(directKm * 1.35 / 15 * 60 + 3));
}

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
    if (Number(filters.minArea) > 0) {
        if (!Number.isFinite(row.area)) {
            pending.push('Área não informada');
        } else if (row.area < Number(filters.minArea)) {
            excluded.push('Área abaixo do mínimo');
        }
    }
    for (const [maximum, value, label, approximate] of [
        [filters.maxFloor, row.floor, 'Andar'],
        [filters.maxTransitMinutes, row.commute?.minutes, 'Transporte público', row.commute?.approximate || !row.commute?.confirmed],
        [filters.maxBikeMinutes, row.bike?.minutes, 'Bicicleta', row.bike?.approximate || !row.bike?.confirmed]
    ]) {
        if (maximum !== null && maximum !== undefined && maximum !== '') {
            if (!Number.isFinite(value)) {
                pending.push(label + ' não informado');
            } else if (value > Number(maximum)) {
                excluded.push(label + ' acima do máximo da coluna');
            } else if (approximate) {
                pending.push('Tempo de ' + label.toLocaleLowerCase('pt-BR') + ' aproximado');
            }
        }
    }
    if (filters.garden === 'private') {
        if (['Compartilhado', 'Não'].includes(row.garden)) {
            excluded.push('Sem jardim privativo com área verde');
        } else if (row.garden !== 'Privativo com área verde') {
            pending.push('Jardim privativo com área verde a confirmar');
        }
    }
    if (filters.groundFloorOnly) {
        if (row.floor === null || row.floor === undefined || row.floor === '') {
            pending.push('Andar não informado');
        } else if (Number(row.floor) !== 0) {
            excluded.push('Não é térreo');
        }
    }
    if (row.pets === 'Não') {
        excluded.push('Animais proibidos');
    } else if (!String(row.pets || '').startsWith('Sim')) {
        pending.push('Permissão para cão a confirmar');
    }
    const travelMode = filters.travelMode || 'transit';
    const choices = travelMode === 'bike' ? [row.bike] : travelMode === 'either' ? [row.commute, row.bike] : [row.commute];
    const known = choices.filter(c => Number.isFinite(c?.minutes));
    const within = known.filter(c => c.minutes <= Number(filters.maxMinutes));
    if (within.length) {
        if (!within.some(c => c.confirmed && !c.approximate)) {
            pending.push(travelMode === 'bike' ? 'Tempo de bicicleta aproximado' : 'Tempo aproximado / trecho desde a porta não verificado');
        }
    } else if (known.length === choices.length) {
        excluded.push('Trajeto consultado acima do limite');
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
    }).sort((a, b) => {
        const field = Object.hasOwn(SORT_LABELS, filters.sort) ? filters.sort : 'rent';
        const value = result => {
            if (field === 'status') {
                return result.excluded.length ? 2 : result.confirmed ? 0 : 1;
            }
            if (field === 'transit') {
                return result.row.commute?.minutes;
            }
            if (field === 'bike') {
                return result.row.bike?.minutes;
            }
            return result.row[field];
        };
        const left = value(a), right = value(b);
        const missing = v => v === null || v === undefined || v === '' || v === 'A confirmar' || (typeof v === 'number' && !Number.isFinite(v));
        // Unknown values stay last in either direction; known zero (ground floor) remains sortable.
        if (missing(left) || missing(right)) {
            return Number(missing(left)) - Number(missing(right));
        }
        const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'pt-BR', { numeric: true, sensitivity: 'base' });
        return comparison * (filters.sortDirection === 'desc' ? -1 : 1);
    });
}
