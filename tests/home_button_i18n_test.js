const fs = require('fs');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function runTests() {
    const files = [
        'index-script.js',
        'mutuo/mutuo-script.js',
        'helice/helice-script.js',
        'solar/solar-script.js',
        'solar/config-script.js',
        'sobre/sobre-script.js'
    ];

    let failed = 0;

    files.forEach(f => {
        const txt = read(f);
        const hasKey = txt.includes("'aria-home'") || txt.includes('"aria-home"');
        const setsAttr = txt.includes("setAttribute('aria-label'") || txt.includes('setAttribute(\"aria-label\"") || txt.includes(".setAttribute('aria-label'") || txt.includes('.setAttribute("aria-label"');

        console.log(`Checking ${f}: aria-home=${hasKey}, sets-aria-label=${setsAttr}`);

        if (!hasKey) {
            console.error(`FAIL: ${f} is missing 'aria-home' translation key`);
            failed++;
        }
        if (!setsAttr) {
            console.error(`FAIL: ${f} does not set aria-label on .home-button-fixed`);
            failed++;
        }
    });

    if (failed > 0) {
        console.error(`home_button_i18n_test: ${failed} checks failed`);
        process.exitCode = 1;
    } else {
        console.log('home_button_i18n_test: all OK');
    }
}

if (require.main === module) runTests();
module.exports = {};
