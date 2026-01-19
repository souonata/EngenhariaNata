#!/usr/bin/env node

/**
 * check-all-migrations.js
 * Verifica o status de migração de todos os apps
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Lista de todos os apps
const apps = [
    'index',
    'sobre',
    'bitola',
    'arcondicionado',
    'aquecimento',
    'helice',
    'mutuo',
    'bugs',
    'fazenda',
    'solar'
];

log('\n' + '='.repeat(70), 'bold');
log('STATUS DE MIGRAÇÃO - TODOS OS APPS', 'bold');
log('='.repeat(70) + '\n', 'bold');

const results = {
    migrated: [],
    notMigrated: [],
    errors: []
};

apps.forEach(appName => {
    const appDir = path.join(__dirname, '..', appName);
    const scriptOld = path.join(appDir, `${appName}-script.js`);
    const scriptNew = path.join(appDir, `${appName}-script-new.js`);

    // Verificar se existe
    const hasOld = fs.existsSync(scriptOld);
    const hasNew = fs.existsSync(scriptNew);

    if (hasNew) {
        try {
            // Executar verificação
            execSync(`node ${path.join(__dirname, 'migration-checker.js')} ${appName}`, {
                stdio: 'ignore'
            });
            results.migrated.push(appName);
        } catch (error) {
            results.errors.push(appName);
        }
    } else if (hasOld) {
        results.notMigrated.push(appName);
    }
});

// Exibir resultados
log('✅ APPS MIGRADOS COM SUCESSO:', 'green');
if (results.migrated.length > 0) {
    results.migrated.forEach(app => log(`   • ${app}`, 'green'));
} else {
    log('   Nenhum', 'yellow');
}

log('\n❌ APPS MIGRADOS COM ERROS:', 'red');
if (results.errors.length > 0) {
    results.errors.forEach(app => log(`   • ${app}`, 'red'));
} else {
    log('   Nenhum', 'green');
}

log('\n⏳ APPS PENDENTES DE MIGRAÇÃO:', 'yellow');
if (results.notMigrated.length > 0) {
    results.notMigrated.forEach(app => log(`   • ${app}`, 'yellow'));
} else {
    log('   Nenhum', 'green');
}

log('\n' + '─'.repeat(70), 'blue');
log(`TOTAIS: ${results.migrated.length} ✅  ${results.errors.length} ❌  ${results.notMigrated.length} ⏳`, 'bold');
log('─'.repeat(70) + '\n', 'blue');

// Progresso
const total = apps.length;
const completed = results.migrated.length;
const percentage = Math.round((completed / total) * 100);

log(`PROGRESSO DE MIGRAÇÃO: ${percentage}% (${completed}/${total})`, 'cyan');

// Exibir barra de progresso
const barLength = 50;
const filledLength = Math.round((completed / total) * barLength);
const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
log(`[${bar}]`, 'cyan');

log('');
