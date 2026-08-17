#!/usr/bin/env node
/**
 * Paridade de chaves entre os idiomas de src/i18n/*.json.
 *
 * Por que existe: uma chave ausente não some da tela — ela cai na cadeia de
 * fallback do core (sv-SE → it-IT → pt-BR). A página parece traduzida e mostra
 * o idioma errado, sem erro nenhum no console. Este validador transforma esse
 * silêncio em falha de build.
 *
 * Regra: comparamos apenas os idiomas PRESENTES em cada arquivo. Um idioma
 * ainda não iniciado não quebra a validação (a tradução entra app por app),
 * mas um idioma começado precisa estar completo.
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR_I18N = resolve(AQUI, '..', 'src', 'i18n');

// Não são arquivos de tradução de app.
const IGNORAR = new Set(['schema.json', 'TEMPLATE_APP.json']);

const IDIOMAS = ['pt-BR', 'it-IT', 'sv-SE'];

// Achata o objeto em caminhos pontilhados. Arrays contam como folha: o que
// importa é a chave existir, não o comprimento (dias da semana, por exemplo).
function coletarChaves(valor, prefixo = '', acc = new Set()) {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
        if (prefixo) acc.add(prefixo);
        return acc;
    }

    for (const [chave, sub] of Object.entries(valor)) {
        coletarChaves(sub, prefixo ? `${prefixo}.${chave}` : chave, acc);
    }

    return acc;
}

function analisarArquivo(nome) {
    const caminho = join(DIR_I18N, nome);
    let dados;

    try {
        dados = JSON.parse(readFileSync(caminho, 'utf8'));
    } catch (erro) {
        return { nome, erroLeitura: erro.message };
    }

    const presentes = IDIOMAS.filter(idioma => dados[idioma]);
    if (presentes.length < 2) {
        return { nome, presentes, faltantes: [] };
    }

    const porIdioma = new Map(presentes.map(idioma => [idioma, coletarChaves(dados[idioma])]));

    // União de todas as chaves vistas em qualquer idioma presente.
    const uniao = new Set();
    porIdioma.forEach(chaves => chaves.forEach(chave => uniao.add(chave)));

    const faltantes = [];
    for (const idioma of presentes) {
        const chaves = porIdioma.get(idioma);
        for (const chave of uniao) {
            if (!chaves.has(chave)) {
                faltantes.push({ idioma, chave });
            }
        }
    }

    return { nome, presentes, faltantes };
}

const arquivos = readdirSync(DIR_I18N)
    .filter(nome => nome.endsWith('.json') && !IGNORAR.has(nome))
    .sort();

let totalFaltantes = 0;
let arquivosComFalha = 0;
const resumo = [];

for (const nome of arquivos) {
    const r = analisarArquivo(nome);

    if (r.erroLeitura) {
        console.error(`✖ ${nome}: JSON inválido — ${r.erroLeitura}`);
        arquivosComFalha++;
        continue;
    }

    resumo.push(`${nome}: ${r.presentes.join(', ') || '(nenhum idioma)'}`);

    if (r.faltantes.length > 0) {
        arquivosComFalha++;
        totalFaltantes += r.faltantes.length;
        console.error(`\n✖ ${nome} — ${r.faltantes.length} chave(s) sem paridade:`);
        // Agrupa por idioma para a saída ficar legível.
        for (const idioma of IDIOMAS) {
            const doIdioma = r.faltantes.filter(f => f.idioma === idioma);
            if (doIdioma.length === 0) continue;
            console.error(`   faltando em ${idioma}:`);
            doIdioma.slice(0, 20).forEach(f => console.error(`     - ${f.chave}`));
            if (doIdioma.length > 20) {
                console.error(`     … e mais ${doIdioma.length - 20}`);
            }
        }
    }
}

console.log('\nParidade de i18n por arquivo:');
resumo.forEach(linha => console.log(`  ${linha}`));

if (arquivosComFalha > 0) {
    console.error(
        `\n✖ Paridade de i18n falhou: ${totalFaltantes} chave(s) em ${arquivosComFalha} arquivo(s).`
    );
    console.error(
        '  Uma chave ausente cai no idioma de fallback e passa despercebida — complete a tradução.'
    );
    process.exit(1);
}

console.log(`\n✓ Paridade de i18n OK em ${arquivos.length} arquivo(s).`);
