// Simple test for battery sizing using kWh-based capacities
function requiredBatteries({consumoMensal, autonomiaDias, dod, batteryKwh}){
    const energiaDiaria = consumoMensal / 30;
    const capVidaUtil = energiaDiaria / dod;
    const capAutonomia = (energiaDiaria * autonomiaDias) / dod;
    const capacidadeNecessariaKWh = Math.max(capVidaUtil, capAutonomia);
    let qtd = Math.ceil(capacidadeNecessariaKWh / batteryKwh);
    if (qtd % 2 !== 0 && qtd > 1) qtd++;
    return {capacidadeNecessariaKWh, qtd};
}

function runTests(){
    const input = {consumoMensal:150, autonomiaDias:2, dod:0.5, batteryKwh:4.8};
    const r = requiredBatteries(input);
    console.log('Computed:', r);
    const expectedQtd = 6; // calculation: diária=5, necessidade nom=20kWh -> 20/4.8=4.166 -> ceil=5 -> make even -> 6
    if (r.qtd !== expectedQtd){
        console.error(`FAIL: expected qtd=${expectedQtd} got ${r.qtd}`);
        process.exitCode = 1;
    } else {
        console.log('OK: solar_battery_sizing_test');
    }
}

if (require.main === module) runTests();
module.exports = { requiredBatteries };
