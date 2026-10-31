import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProperty, filterResearchRows, DEFAULT_FILTERS } from './research-model.mjs';
const row = { id: 'a', town: 'Horw', rent: 2758.2, totalConfirmed: true, bedrooms: 2, bathrooms: 1, garden: 'Privativo com área verde', pets: 'Sim', commute: { minutes: 45, confirmed: true }, availabilityStatus: 'observado' };
test('EUR 3000 converts to CHF 2758.20; both exact limits are inclusive', () => assert.equal(evaluateProperty(row).confirmed, true));
test('CHF 2758.21 exceeds the EUR limit', () => assert.ok(evaluateProperty({ ...row, rent: 2758.21 }).excluded.includes('Acima do preço máximo')));
test('CHF filter does not apply currency conversion', () => assert.equal(evaluateProperty({ ...row, rent: 3000 }, { ...DEFAULT_FILTERS, currency: 'CHF' }).confirmed, true));
test('unknown bedroom count is pending, not zero or inferred from Zimmer', () => {
    const x = evaluateProperty({ ...row, bedrooms: null, rooms: 4.5 }); assert.equal(x.excluded.length, 0); assert.equal(x.confirmed, false);
});
test('two complete bathrooms excludes a one-bathroom plus guest WC home', () => assert.ok(evaluateProperty({ ...row, guestWC: 1 }, { ...DEFAULT_FILTERS, minBathrooms: 2 }).excluded.length));
test('shared garden is excluded even with a private terrace', () => assert.ok(evaluateProperty({ ...row, garden: 'Compartilhado' }).excluded.length));
test('no pet permission is excluded', () => assert.ok(evaluateProperty({ ...row, pets: 'Não' }).excluded.length));
test('46 minute commute exceeds radius', () => assert.ok(evaluateProperty({ ...row, commute: { minutes: 46, confirmed: true } }).excluded.length));
test('station-only commute cannot confirm a property', () => assert.equal(evaluateProperty({ ...row, commute: { minutes: 30, confirmed: false } }).confirmed, false));
test('mandatory charges are counted through the total, not headline base rent', () => assert.ok(evaluateProperty({ ...row, rent: 3330, net: 2680, charges: 300, mandatoryExtras: 350 }).excluded.length));
test('expired listings remain in archive but not candidate list', () => {
    const r = { ...row, availabilityStatus: 'expirado' }; assert.equal(filterResearchRows([r]).length, 0); assert.equal(filterResearchRows([r], { ...DEFAULT_FILTERS, mode: 'archive' }).length, 1);
});
test('unknown toggle removes pending rows without deleting archive', () => {
    const rows = [row, { ...row, id: 'b', bedrooms: null }]; assert.equal(filterResearchRows(rows).length, 2); assert.equal(filterResearchRows(rows, { ...DEFAULT_FILTERS, includeUnknown: false }).length, 1); assert.equal(rows.length, 2);
});
