import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(scriptDirectory, '../local/dist');

function listFiles(directory, files = []) {
    for (const name of readdirSync(directory)) {
        const path = resolve(directory, name);
        if (statSync(path).isDirectory()) {
            listFiles(path, files);
        } else {
            files.push(relative(root, path).replaceAll('\\', '/'));
        }
    }
    return files;
}

const files = listFiles(root);
const privateSegments = /(^|\/)(workspaces|library|markups|original_wiring_diagram|legacy)(\/|$)/;
const forbidden = files.filter(path => privateSegments.test(path));
const unexpectedPintorFiles = files.filter(
    path => path.startsWith('pintor/') && path !== 'pintor/index.html'
);

if (forbidden.length || unexpectedPintorFiles.length) {
    const leaked = [...new Set([...forbidden, ...unexpectedPintorFiles])];
    throw new Error(`Private Pintor build artifacts detected:\n${leaked.join('\n')}`);
}

process.stdout.write(`✓ Build privacy gate passed across ${files.length} emitted files.\n`);
