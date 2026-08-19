#!/usr/bin/env node
/**
 * Todo CSS/JS local citado num HTML tem de existir e NÃO estar vazio.
 *
 * Por que existe: um script de edição truncou `assets/css/shared-styles.css`
 * para zero bytes e nada acusou. O stylelint roda com `--allow-empty-input`,
 * o Vite empacota um arquivo vazio sem reclamar e os testes não olham CSS —
 * o site foi para a tela sem a folha de estilo compartilhada, com o HTML
 * inteiro presente e sem um único erro no console.
 *
 * É o mesmo padrão de falha do GUIA_FALHA_CONGELAMENTO.md: página viva,
 * recurso morto. Este validador transforma o silêncio em falha de build.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

// Diretórios que não são o site (build, dependências, backend de terceiros).
// `template-app` fica de fora de propósito: referencia `NOME-APP-*` como
// marcador de posição, para ser copiado e renomeado.
const IGNORAR_DIR = new Set([
    'node_modules',
    'dist',
    '.git',
    'local',
    '.claude',
    'template-app'
]);

function listarHtml(dir, acc = []) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
        if (item.name.startsWith('.') && item.name !== '.htaccess') continue;
        if (item.isDirectory()) {
            if (IGNORAR_DIR.has(item.name)) continue;
            listarHtml(join(dir, item.name), acc);
        } else if (item.name.endsWith('.html')) {
            acc.push(join(dir, item.name));
        }
    }
    return acc;
}

// href/src de <link rel=stylesheet> e <script src>, só caminhos locais.
const PADRAO = /(?:href|src)\s*=\s*["']([^"']+\.(?:css|js))(?:\?[^"']*)?["']/gi;

const problemas = [];
let conferidos = 0;

for (const html of listarHtml(RAIZ)) {
    const conteudo = readFileSync(html, 'utf8');
    const base = dirname(html);

    for (const [, referencia] of conteudo.matchAll(PADRAO)) {
        if (/^(https?:)?\/\//.test(referencia) || referencia.startsWith('data:')) continue;

        const alvo = resolve(base, referencia);
        const relativo = alvo.replace(RAIZ + '\\', '').replace(RAIZ + '/', '');
        const origem = html.replace(RAIZ + '\\', '').replace(RAIZ + '/', '');

        if (!existsSync(alvo)) {
            problemas.push(`${origem} → ${relativo}: NÃO EXISTE`);
            continue;
        }
        if (statSync(alvo).size === 0) {
            problemas.push(`${origem} → ${relativo}: ARQUIVO VAZIO (0 bytes)`);
            continue;
        }
        conferidos++;
    }
}

if (problemas.length > 0) {
    console.error('\n✖ Recursos referenciados com problema:\n');
    for (const problema of problemas) console.error(`  - ${problema}`);
    console.error('');
    process.exit(1);
}

console.log(`✓ ${conferidos} referências de CSS/JS conferidas: todas existem e têm conteúdo.`);
