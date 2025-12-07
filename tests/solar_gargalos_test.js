const fs = require('fs');

function read(path){ return fs.readFileSync(path,'utf8'); }

function runTests(){
    const txt = read('solar/solar-script.js');
    let failed = 0;

    // Check that all three motivo blocks include explicit 'gargalo' or 'limite' and include numeric hints
    const checks = [
        {name: 'BATERIAS', key: 'resMotivoBaterias', expect: ['gargalo', 'kWh']},
        {name: 'PAINÉIS', key: 'resMotivoPaineis', expect: ['gargalo', 'kWh', 'W']},
        {name: 'INVERSOR', key: 'resMotivoInversor', expect: ['gargalo', 'kW']}
    ];

    checks.forEach(c => {
        // Find the assignment for the element text content using the id
        const re = new RegExp("document.getElementById\\('"+c.key+"'\\).textContent = (.+);","s");
        const m = txt.match(re);
        console.log('Checking', c.name, '...');
        if (!m) {
            console.error('FAIL: cannot find assignment for', c.key);
            failed++;
            return;
        }

        const message = m[1];
        const msgLower = message.toLowerCase();
        c.expect.forEach(e => {
            if (!msgLower.includes(e.toLowerCase())) {
                console.error(`FAIL: ${c.name} message does not include expected token: ${e}`);
                failed++;
            }
        });
    });

    if (failed > 0) {
        console.error(`solar_gargalos_test: ${failed} checks failed`);
        process.exitCode = 1;
    } else {
        console.log('solar_gargalos_test: all OK');
    }
}

if (require.main === module) runTests();
module.exports = {};
