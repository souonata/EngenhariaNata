// Script auxiliar para extrair traduções do solar-script.js
// Executar: node solar/extract-translations.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler o arquivo original
const scriptPath = path.join(__dirname, 'solar-script.js');
const content = fs.readFileSync(scriptPath, 'utf-8');

// Extrair o objeto traducoes usando regex
const match = content.match(/const traducoes = ({[\s\S]*?});[\s\S]*?let intervalId/);

if (!match) {
    console.error('❌ Não foi possível encontrar o objeto traducoes');
    process.exit(1);
}

try {
    // Avaliar o objeto JavaScript
    const traducoesStr = match[1];
    const traducoes = eval(`(${traducoesStr})`);
    
    // Estruturar melhor o JSON
    const jsonStructured = {
        "pt-BR": traducoes['pt-BR'],
        "it-IT": traducoes['it-IT']
    };
    
    // Salvar no arquivo src/i18n/solar.json
    const outputPath = path.join(__dirname, '../src/i18n/solar.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonStructured, null, 2), 'utf-8');
    
    console.log('✅ Traduções extraídas com sucesso!');
    console.log(`📁 Arquivo salvo em: ${outputPath}`);
    console.log(`📊 Total de chaves PT: ${Object.keys(traducoes['pt-BR']).length}`);
    console.log(`📊 Total de chaves IT: ${Object.keys(traducoes['it-IT']).length}`);
    
} catch (error) {
    console.error('❌ Erro ao processar traduções:', error.message);
    process.exit(1);
}
