#!/usr/bin/env node

/**
 * migration-checker.js
 * Script para verificar se um app foi migrado corretamente
 */

const fs = require('fs');
const path = require('path');

// Cores para terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

class MigrationChecker {
    constructor(appName) {
        this.appName = appName;
        this.appDir = path.join(__dirname, '..', appName);
        this.scriptNewFile = path.join(this.appDir, `${appName}-script-new.js`);
        this.errors = [];
        this.warnings = [];
        this.success = [];
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    check() {
        this.log(`\n${'='.repeat(60)}`, 'bold');
        this.log(`Verificando migração do app: ${this.appName}`, 'bold');
        this.log('='.repeat(60), 'bold');

        if (!fs.existsSync(this.scriptNewFile)) {
            this.log(`\n❌ Arquivo ${this.appName}-script-new.js não encontrado`, 'red');
            return false;
        }

        const content = fs.readFileSync(this.scriptNewFile, 'utf8');

        // Verificar imports obrigatórios
        this.checkImports(content);

        // Verificar estrutura da classe
        this.checkClassStructure(content);

        // Verificar uso dos utilitários de input
        this.checkInputUtilities(content);

        // Verificar obtenção de valores
        this.checkValueRetrieval(content);

        // Verificar limpeza de valorReal
        this.checkValorRealCleanup(content);

        // Exibir resultados
        this.displayResults();

        return this.errors.length === 0;
    }

    checkImports(content) {
        const requiredImports = [
            { pattern: /from ['"]\.\.\/src\/core\/app\.js['"]/, name: 'App' },
            { pattern: /from ['"]\.\.\/src\/core\/i18n\.js['"]/, name: 'i18n' },
            { pattern: /from ['"]\.\.\/src\/utils\/formatters\.js['"]/, name: 'formatters' },
            { pattern: /from ['"]\.\.\/src\/utils\/input-handlers\.js['"]/, name: 'input-handlers' }
        ];

        requiredImports.forEach(({ pattern, name }) => {
            if (pattern.test(content)) {
                this.success.push(`✅ Import de ${name} encontrado`);
            } else {
                this.errors.push(`❌ Import de ${name} não encontrado`);
            }
        });

        // Verificar imports específicos de input-handlers
        const inputHandlerImports = ['configurarInputComSlider', 'obterValorReal', 'limparValorReal'];
        inputHandlerImports.forEach(importName => {
            if (content.includes(importName)) {
                this.success.push(`✅ Import de ${importName} encontrado`);
            } else {
                this.warnings.push(`⚠️  Import de ${importName} não encontrado`);
            }
        });
    }

    checkClassStructure(content) {
        const capitalizedName = this.appName.charAt(0).toUpperCase() + this.appName.slice(1);
        const className = `${capitalizedName}App`;

        if (content.includes(`class ${className} extends App`)) {
            this.success.push(`✅ Classe ${className} estende App corretamente`);
        } else {
            this.errors.push(`❌ Classe ${className} não encontrada ou não estende App`);
        }

        // Verificar callbacks
        if (content.includes('aoInicializar:') && content.includes('aoTrocarIdioma:')) {
            this.success.push('✅ Callbacks aoInicializar e aoTrocarIdioma configurados');
        } else {
            this.errors.push('❌ Callbacks não configurados corretamente');
        }
    }

    checkInputUtilities(content) {
        // Verificar se configurarInputComSlider está sendo usado
        const configurarInputMatches = content.match(/configurarInputComSlider/g);
        if (configurarInputMatches && configurarInputMatches.length > 0) {
            this.success.push(`✅ configurarInputComSlider usado ${configurarInputMatches.length} vez(es)`);
        } else {
            this.errors.push('❌ configurarInputComSlider não está sendo usado');
        }

        // Verificar se há função configurarInputsTexto
        if (content.includes('configurarInputsTexto()')) {
            this.success.push('✅ Função configurarInputsTexto() encontrada');
        } else {
            this.warnings.push('⚠️  Função configurarInputsTexto() não encontrada');
        }
    }

    checkValueRetrieval(content) {
        // Verificar se obterValorReal está sendo usado
        const obterValorRealMatches = content.match(/obterValorReal/g);
        if (obterValorRealMatches && obterValorRealMatches.length > 0) {
            this.success.push(`✅ obterValorReal usado ${obterValorRealMatches.length} vez(es)`);
        } else {
            this.warnings.push('⚠️  obterValorReal não está sendo usado');
        }

        // Verificar se ainda há leituras diretas problemáticas do slider
        const directSliderReads = content.match(/parseFloat\(slider\w+\?\.value/g);
        if (directSliderReads && directSliderReads.length > 0) {
            this.warnings.push(`⚠️  ${directSliderReads.length} leitura(s) direta(s) de slider encontrada(s) - considere usar obterValorReal`);
        }
    }

    checkValorRealCleanup(content) {
        // Verificar se limparValorReal está sendo usado
        const limparValorRealMatches = content.match(/limparValorReal/g);
        if (limparValorRealMatches && limparValorRealMatches.length > 0) {
            this.success.push(`✅ limparValorReal usado ${limparValorRealMatches.length} vez(es)`);
        } else {
            this.warnings.push('⚠️  limparValorReal não está sendo usado');
        }

        // Verificar se há listeners de slider
        const sliderListeners = content.match(/slider\.addEventListener\(['"]input['"]/g);
        if (sliderListeners && sliderListeners.length > 0) {
            this.success.push(`✅ ${sliderListeners.length} listener(s) de slider encontrado(s)`);
        }
    }

    displayResults() {
        this.log('\n' + '─'.repeat(60), 'blue');
        this.log('RESULTADOS:', 'bold');
        this.log('─'.repeat(60), 'blue');

        if (this.success.length > 0) {
            this.log('\nSUCESSOS:', 'green');
            this.success.forEach(msg => this.log(msg, 'green'));
        }

        if (this.warnings.length > 0) {
            this.log('\nAVISOS:', 'yellow');
            this.warnings.forEach(msg => this.log(msg, 'yellow'));
        }

        if (this.errors.length > 0) {
            this.log('\nERROS:', 'red');
            this.errors.forEach(msg => this.log(msg, 'red'));
        }

        this.log('\n' + '─'.repeat(60), 'blue');
        this.log(`RESUMO: ${this.success.length} ✅  ${this.warnings.length} ⚠️  ${this.errors.length} ❌`, 'bold');
        this.log('─'.repeat(60) + '\n', 'blue');

        if (this.errors.length === 0) {
            this.log('🎉 Migração concluída com sucesso!', 'green');
        } else {
            this.log('❌ Migração incompleta. Corrija os erros acima.', 'red');
        }
    }
}

// Uso do script
const appName = process.argv[2];

if (!appName) {
    console.log(`${colors.red}Uso: node migration-checker.js <nome-do-app>${colors.reset}`);
    console.log(`Exemplo: node migration-checker.js bitola`);
    process.exit(1);
}

const checker = new MigrationChecker(appName);
const success = checker.check();

process.exit(success ? 0 : 1);
