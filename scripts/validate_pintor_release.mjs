/**
 * The Pintor release number lives in three places that must agree.
 *
 * The site publishes `config/versions.json` from `main` automatically, but the API image is built
 * by hand on its VM. Twice now `main` moved while the VM stayed behind, and the second time the
 * site announced 0.6.7 for four days with 0.6.6 actually answering requests — the engine change
 * everyone was told about was not in production.
 *
 * This catches the half-bump before it is committed. It cannot catch a stale VM; for that the API
 * reports its own release at /api/health and `pintor/deploy/check-release-drift.sh` compares the
 * two live numbers.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(scriptDirectory, '..');

const compose = readFileSync(resolve(root, 'pintor/compose.yml'), 'utf8');
const versions = JSON.parse(readFileSync(resolve(root, 'config/versions.json'), 'utf8'));

const imageMatch = compose.match(/^\s*image:\s*engnata\/pintor-api:(\S+)\s*$/m);
const releaseMatch = compose.match(/^\s*PINTOR_RELEASE:\s*['"]?([^'"\s]+)['"]?\s*$/m);

const problems = [];
if (!imageMatch) {
    problems.push('pintor/compose.yml has no `image: engnata/pintor-api:<version>` line');
}
if (!releaseMatch) {
    problems.push('pintor/compose.yml has no `PINTOR_RELEASE` environment entry');
}

const imageTag = imageMatch?.[1];
const declaredRelease = releaseMatch?.[1];
const siteVersion = versions.pintor;

if (imageTag && declaredRelease && imageTag !== declaredRelease) {
    problems.push(
        `image tag ${imageTag} != PINTOR_RELEASE ${declaredRelease} in pintor/compose.yml — ` +
            'the API would report a version it is not'
    );
}
if (imageTag && siteVersion && imageTag !== siteVersion) {
    problems.push(
        `image tag ${imageTag} != config/versions.json pintor ${siteVersion} — ` +
            'the site would announce a version the API does not carry'
    );
}

if (problems.length) {
    throw new Error(`Pintor release numbers disagree:\n  ${problems.join('\n  ')}`);
}

process.stdout.write(`✓ Pintor release ${imageTag} agrees across compose, env and site config.\n`);
