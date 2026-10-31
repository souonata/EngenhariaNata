import { readFileSync, writeFileSync } from 'node:fs';
import { estimateBicycleMinutes } from './research-model.mjs';

const path = new URL('./research-data.json', import.meta.url);
const data = JSON.parse(readFileSync(path, 'utf8'));
data.bicycleAssumptions = { speedKmh: 15, distanceMultiplier: 1.35, bufferMinutes: 3, method: 'Distância geográfica × 1,35, velocidade assumida de 15 km/h + 3 min. Não inclui relevo, infraestrutura cicloviária ou trânsito; não é rota calculada por navegador.' };
for (const row of data.rows) {
    row.bike = {
        minutes: estimateBicycleMinutes(row.commute?.originCoordinates, row.commute?.destinationCoordinates),
        approximate: true,
        confirmed: false,
        originBasis: row.commute?.originBasis || 'unknown',
        method: 'geographic-estimate-v1'
    };
}
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
