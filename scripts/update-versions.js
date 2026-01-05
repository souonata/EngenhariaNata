// Script para atualizar versões automaticamente
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Lê a versão do package.json
function getPackageVersion() {
    const packagePath = join(rootDir, 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version;
}

// Atualiza arquivos HTML com nova versão nos links de CSS e JS
function updateHtmlFiles(version) {
    const htmlFiles = findHtmlFiles(rootDir);
    let updatedCount = 0;

    htmlFiles.forEach(filePath => {
        let content = readFileSync(filePath, 'utf-8');
        const originalContent = content;

        // Regex para encontrar links com ?v=X.Y.Z
        content = content.replace(
            /(<link[^>]+href=["']([^"']+\.css))\?v=[\d.]+/g,
            `$1?v=${version}`
        );
        content = content.replace(
            /(<script[^>]+src=["']([^"']+\.js))\?v=[\d.]+/g,
            `$1?v=${version}`
        );

        // Adiciona ?v= se não existir
        content = content.replace(
            /(<link[^>]+href=["']([^"']+\.css)["'])/g,
            (match, p1, p2) => {
                if (!match.includes('?v=')) {
                    return `${p1}?v=${version}"`;
                }
                return match;
            }
        );
        content = content.replace(
            /(<script[^>]+src=["']([^"']+\.js)["'])/g,
            (match, p1, p2) => {
                if (!match.includes('?v=')) {
                    return `${p1}?v=${version}"`;
                }
                return match;
            }
        );

        if (content !== originalContent) {
            writeFileSync(filePath, content, 'utf-8');
            updatedCount++;
            console.log(`✓ Atualizado: ${filePath}`);
        }
    });

    return updatedCount;
}

// Atualiza versions.json
function updateVersionsJson(version) {
    const versionsPath = join(rootDir, 'config', 'versions.json');
    let versions = {};

    try {
        versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));
    } catch (error) {
        console.log('⚠ versions.json não encontrado, criando novo...');
    }

    // Atualiza todas as versões dos apps
    const apps = ['index', 'solar', 'bitola', 'helice', 'mutuo', 'arcondicionado', 
                  'aquecimento', 'fazenda', 'bugs', 'sobre'];
    
    apps.forEach(app => {
        versions[app] = version;
    });

    versions.lastUpdate = new Date().toISOString();

    writeFileSync(versionsPath, JSON.stringify(versions, null, 2), 'utf-8');
    console.log(`✓ Atualizado: config/versions.json`);
}

// Encontra todos os arquivos HTML recursivamente
function findHtmlFiles(dir, fileList = []) {
    const files = readdirSync(dir);

    files.forEach(file => {
        const filePath = join(dir, file);
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
            if (!filePath.includes('node_modules') && !filePath.includes('dist')) {
                findHtmlFiles(filePath, fileList);
            }
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Incrementa versão (patch por padrão)
function incrementVersion(version, type = 'patch') {
    const [major, minor, patch] = version.split('.').map(Number);

    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
        default:
            return `${major}.${minor}.${patch + 1}`;
    }
}

// Atualiza package.json com nova versão
function updatePackageVersion(newVersion) {
    const packagePath = join(rootDir, 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    packageJson.version = newVersion;
    writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
    console.log(`✓ package.json atualizado para v${newVersion}`);
}

// Função principal
function main() {
    const args = process.argv.slice(2);
    const versionType = args[0] || 'patch'; // major, minor, patch

    console.log('🔄 Atualizando versões...\n');

    const currentVersion = getPackageVersion();
    const newVersion = incrementVersion(currentVersion, versionType);

    console.log(`📦 Versão atual: ${currentVersion}`);
    console.log(`📦 Nova versão: ${newVersion}\n`);

    // Atualiza package.json
    updatePackageVersion(newVersion);

    // Atualiza arquivos HTML
    const htmlCount = updateHtmlFiles(newVersion);
    console.log(`\n✓ ${htmlCount} arquivos HTML atualizados`);

    // Atualiza versions.json
    updateVersionsJson(newVersion);

    console.log(`\n✅ Versionamento concluído! Nova versão: ${newVersion}`);
}

main();
