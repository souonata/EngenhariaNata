const { spawnSync } = require('child_process');

console.log('Running tests...');

const tests = [
  'mutuo_parsing_test.js',
  'home_button_i18n_test.js',
  'solar_gargalos_test.js',
  'solar_locale_test.js',
  'solar_battery_sizing_test.js'
];

let exitCode = 0;

tests.forEach(t => {
  console.log('\n--- ' + t);
  const res = spawnSync(process.execPath, [require('path').join(__dirname, t)], { encoding: 'utf8' });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status !== 0) exitCode = res.status || 1;
});

process.exit(exitCode);
