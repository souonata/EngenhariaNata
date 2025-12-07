// Tests for tax period conversions used in the mutuo UI

function toMonthlyDecimal(taxaPercent, periodo) {
  if (periodo === 'ano') return Math.pow(1 + taxaPercent / 100, 1 / 12) - 1;
  if (periodo === 'mes') return taxaPercent / 100;
  if (periodo === 'dia') return Math.pow(1 + taxaPercent / 100, 30) - 1;
  return taxaPercent / 100;
}

function convertBetween(taxaPercent, from, to) {
  const mensal = toMonthlyDecimal(taxaPercent, from);
  let target;
  if (to === 'mes') target = mensal;
  else if (to === 'ano') target = Math.pow(1 + mensal, 12) - 1;
  else if (to === 'dia') target = Math.pow(1 + mensal, 1 / 30) - 1;
  else target = mensal;
  return target * 100;
}

function nearlyEqual(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

function runTests() {
  // annual -> monthly
  const m = convertBetween(12, 'ano', 'mes');
  if (!nearlyEqual(m, (Math.pow(1 + 0.12, 1 / 12) - 1) * 100)) {
    console.error('FAIL: ano -> mes'); process.exitCode = 1; return; }
  console.log('OK: ano -> mes');

  // monthly -> annual
  const a = convertBetween(1, 'mes', 'ano');
  if (!nearlyEqual(a, (Math.pow(1 + 0.01, 12) - 1) * 100)) {
    console.error('FAIL: mes -> ano'); process.exitCode = 1; return; }
  console.log('OK: mes -> ano');

  // monthly -> daily
  const d = convertBetween(1, 'mes', 'dia');
  if (!nearlyEqual(d, (Math.pow(1 + 0.01, 1 / 30) - 1) * 100)) {
    console.error('FAIL: mes -> dia'); process.exitCode = 1; return; }
  console.log('OK: mes -> dia');

  console.log('mutuo_tax_conversion_test: all OK');
}

if (require.main === module) runTests();
module.exports = { convertBetween };
