const fs = require('fs');

function checkFile(path) {
    const txt = fs.readFileSync(path, 'utf8');
    return txt;
}

function runTests() {
    const files = [
        'solar/solar-script.js',
        'solar/config-script.js'
    ];

    let failed = 0;

    files.forEach(f => {
        const txt = checkFile(f);
        const hasPreferido = txt.includes("idiomaPreferido");
        const hasSolar = txt.includes("idiomaSolar");

        console.log(`Checking ${f}: idiomaPreferido=${hasPreferido}, idiomaSolar=${hasSolar}`);

        if (!hasPreferido) {
            console.error(`FAIL: ${f} does not include 'idiomaPreferido'`);
            failed++;
        }
        if (hasSolar) {
            console.error(`FAIL: ${f} still contains 'idiomaSolar'`);
            failed++;
        }
    });

    if (failed > 0) {
        console.error(`solar_locale_test: ${failed} checks failed`);
        process.exitCode = 1;
    } else {
        console.log('solar_locale_test: all OK');
    }
}

if (require.main === module) runTests();
module.exports = {};
