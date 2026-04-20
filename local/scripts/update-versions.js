import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const localRoot = resolve(__dirname, '..');
const writeStdout = message => process.stdout.write(`${message}\n`);
const writeStderr = message => process.stderr.write(`${message}\n`);

const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
    writeStderr(`Invalid bump type: ${bumpType}. Use patch, minor, or major.`);
    process.exit(1);
}

function bumpVersion(version, type) {
    const [major, minor, patch] = version.split('.').map(Number);
    if (type === 'major') {
        return `${major + 1}.0.0`;
    }
    if (type === 'minor') {
        return `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
}

// Bump local/package.json version
const pkgPath = resolve(localRoot, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const oldVersion = pkg.version;
pkg.version = bumpVersion(oldVersion, bumpType);
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Update lastUpdate in config/versions.json
const versionsPath = resolve(projectRoot, 'config', 'versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));
versions.lastUpdate = new Date().toISOString();
writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');

writeStdout(`Version bumped: ${oldVersion} -> ${pkg.version}`);
