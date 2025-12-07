// Simple tests for obterValorNumericoFormatado behavior
function obterValorNumericoFormatado(valorFormatado) {
    if (!valorFormatado) return 0;

    let v = String(valorFormatado).trim();
    if (v.indexOf('.') !== -1 && v.indexOf(',') !== -1) {
        v = v.replace(/\./g, '');
        v = v.replace(',', '.');
    } else {
        if (v.indexOf(',') !== -1) {
            v = v.replace(/\./g, '');
            v = v.replace(',', '.');
        } else {
            v = v.replace(/\./g, '');
        }
    }
    v = v.replace(/[^0-9.\-]/g, '');
    return parseFloat(v) || 0;
}

function runTests() {
    const cases = [
        { input: '100.000', expected: 100000 },
        { input: '10,5', expected: 10.5 },
        { input: '1.234,56', expected: 1234.56 },
        { input: '1234.56', expected: 1234.56 },
        { input: '', expected: 0 },
        { input: 'abc', expected: 0 },
        { input: '-1.234,5', expected: -1234.5 }
    ];

    let failed = 0;
    cases.forEach(c => {
        const out = obterValorNumericoFormatado(c.input);
        const ok = Object.is(out, c.expected);
        if (!ok) {
            console.error(`FAIL: input='${c.input}' expected=${c.expected} got=${out}`);
            failed++;
        } else {
            console.log(`OK: input='${c.input}' => ${out}`);
        }
    });

    if (failed > 0) {
        console.error(`mutuo_parsing_test: ${failed} failed`);
        process.exitCode = 1;
    } else {
        console.log('mutuo_parsing_test: all OK');
    }
}

if (require.main === module) runTests();
module.exports = { obterValorNumericoFormatado };
