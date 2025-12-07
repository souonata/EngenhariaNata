#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readAllFiles(dir, extensions) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...readAllFiles(full, extensions));
    } else if (extensions.includes(path.extname(e.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function findMatches(regex, files) {
  const hits = [];
  files.forEach(f => {
    const txt = fs.readFileSync(f, 'utf8');
    if (regex.test(txt)) hits.push(f);
  });
  return hits;
}

const root = path.join(__dirname, '..');

const cssFiles = readAllFiles(root, ['.css']);
const htmlFiles = readAllFiles(root, ['.html']);

const rippleRegex = /(^|\s|\.|\{|\})\.ripple\s*\{/m;
const keyframesRegex = /@keyframes\s+ripple/m;

const rippleHits = cssFiles.filter(f => {
  const txt = fs.readFileSync(f, 'utf8');
  return rippleRegex.test(txt) || keyframesRegex.test(txt);
});

console.log('Checking .ripple / @keyframes ripple occurrences in CSS files...');
if (rippleHits.length === 0) {
  console.error('✖ No .ripple/@keyframes occurrences found in any CSS file — expected in assets/css/ripple-styles.css');
  process.exit(2);
}

const expected = path.join(root, 'assets', 'css', 'ripple-styles.css');
const unexpected = rippleHits.filter(f => path.resolve(f) !== path.resolve(expected));

if (unexpected.length > 0) {
  console.error('✖ Found duplicate ripple rules outside of assets/css/ripple-styles.css:');
  unexpected.forEach(f => console.error('  -', path.relative(root, f)));
  process.exit(3);
} else {
  console.log('✔ All ripple rules found only in assets/css/ripple-styles.css');
}

// Check HTML includes for expected hrefs
const expectedHref = 'assets/css/ripple-styles.css';
const missing = htmlFiles.filter(f => {
  const txt = fs.readFileSync(f, 'utf8');
  return !txt.includes(expectedHref);
});

// Filter out any non-site HTML (like tests helper) - require that main site pages include it
const mainPages = [
  'index.html',
  path.join('mutuo', 'mutuo.html'),
  path.join('helice', 'helice.html'),
  path.join('solar', 'solar.html'),
  path.join('solar', 'config.html'),
  path.join('sobre', 'sobre.html')
].map(p => path.join(root, p));

const missingMain = mainPages.filter(p => {
  try { return !fs.readFileSync(p, 'utf8').includes(expectedHref); }
  catch(e){ return true; }
});

if (missingMain.length > 0) {
  console.error('✖ The following expected main pages do NOT reference', expectedHref);
  missingMain.forEach(p => console.error('  -', path.relative(root, p)));
  process.exit(4);
} else {
  console.log('✔ All main pages reference', expectedHref);
}

console.log('\nAll ripple checks passed.');
process.exit(0);
