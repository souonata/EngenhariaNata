#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }

console.log('Running site-config verification...');

// 1) Verify site-config.js exists
const configPath = path.join(root, 'assets', 'js', 'site-config.js');
if (!fs.existsSync(configPath)) {
  console.error('✖ site-config.js not found at assets/js/site-config.js');
  process.exit(2);
}

// 2) Validate that SiteConfig defines expected keys
const sc = fs.readFileSync(configPath, 'utf8');
if (!/LOCAL_STORAGE\s*:\s*\{/.test(sc) || !/DEFAULTS\s*:\s*\{/.test(sc)) {
  console.error('✖ site-config.js does not appear to export expected structure (LOCAL_STORAGE, DEFAULTS)');
  process.exit(3);
}

// 3) Check that main pages include shared-styles and site-config.js
const mainPages = ['index.html', 'mutuo/mutuo.html', 'helice/helice.html', 'solar/solar.html', 'solar/config.html', 'sobre/sobre.html'];
const missing = [];
for (const p of mainPages) {
  const txt = read(p);
  if (!txt.includes('assets/css/shared-styles.css')) missing.push(p + ' (missing shared-styles)');
  if (!txt.includes('assets/js/site-config.js') && !txt.includes('../assets/js/site-config.js')) missing.push(p + ' (missing site-config.js)');
}

if (missing.length) {
  console.error('✖ Some main pages are missing shared assets:\n' + missing.join('\n'));
  process.exit(4);
}

console.log('✔ site-config.js looks present and main pages include shared-styles and site-config.js');
process.exit(0);
