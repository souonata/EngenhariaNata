// Test behavior for valorRapido adjust/blur snapping
// This file is executed by tests/run-tests.js using `node`.

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

function computeStep(value, step) {
  // Determine step size depending on current value
  // - if value < 10k then baseStep = 1k
  // - else baseStep = 10k
  const baseStep = (value < 10000) ? 1000 : 10000;
  if (typeof step !== 'number' || isNaN(step)) return baseStep;
  const sign = Math.sign(step) || 1;
  return sign * baseStep;
}

function applyAdjust(valueStr, step) {
  const MAX_VALOR = 100000000;
  let value = Math.round(obterValorNumericoFormatado(valueStr) || 0);
  const stepVal = computeStep(value, step);
  value = Math.max(1000, Math.min(MAX_VALOR, value + stepVal));
  return value;
}

function blurSnap(valueStr) {
  let num = parseInt(String(valueStr).replace(/\D/g, '') || '0', 10);
  if (num < 1000) num = 1000;
  if (num < 10000) {
    num = Math.round(num / 1000) * 1000;
  } else {
    num = Math.round(num / 10000) * 10000;
  }
  return num;
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    console.error(`FAIL: ${msg} (expected=${expected}, actual=${actual})`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK: ${msg} -> ${actual}`);
  return true;
}

function runTests() {
  // Parsing tests (sanity)
  assertEqual(obterValorNumericoFormatado('100.000'), 100000, "parse '100.000'");
  assertEqual(obterValorNumericoFormatado('1.234,56'), 1234.56, "parse '1.234,56'");

  // Adjust tests
  assertEqual(applyAdjust('100.000', 10000), 110000, '100k + 10k');
  assertEqual(applyAdjust('100.000', -10000), 90000, '100k - 10k');
  // special case: 10.000 - (user clicked -) should decrease by 1k → 9000
  assertEqual(applyAdjust('10.000', -10000), 9000, '10k - click minus -> 9k');
  // behavior for values < 10k uses 1k steps and minimum 1k
  assertEqual(applyAdjust('5.000', -10000), 4000, '5000 - 10k (effectively -1k) -> 4000');
  assertEqual(applyAdjust('1.000', -10000), 1000, '1000 - 10k -> clamp to 1000');
  assertEqual(applyAdjust('9.500', 10000), 10500, '9500 + 10k (effectively +1k) -> 10500');
  assertEqual(applyAdjust('10.000', 10000), 20000, '10000 + 10k -> 20000');

  // Blur snapping
  assertEqual(blurSnap('115000'), 120000, '115000 -> snap to nearest 10k');
  assertEqual(blurSnap('10100'), 10000, '10100 -> snap to 10k (min)');
  assertEqual(blurSnap('1500'), 2000, '1500 -> snap to 1k nearest');

  if (process.exitCode === 0 || typeof process.exitCode === 'undefined') {
    console.log('mutuo_valorrapido_test: all OK');
  }
}

if (require.main === module) runTests();
module.exports = { obterValorNumericoFormatado, computeStep, applyAdjust, blurSnap };