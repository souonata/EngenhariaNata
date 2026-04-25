/**
 * Papel no projeto:
 * - Configuração do Vitest para a suíte de testes unitários dos cálculos puros.
 * - Cada app expõe lógica numérica em `<app>/<app>-calc.js` e os testes ficam em
 *   `<app>/<app>-calc.test.js` (ESM puro, sem DOM).
 *
 * Pontos seguros para IA editar:
 * - novos padrões em `include`/`exclude`;
 * - thresholds de coverage à medida que mais apps forem cobertos.
 *
 * Cuidados antes de mexer:
 * - root aponta para o diretório acima de local/ (raiz real do site);
 * - não estender vite.config.js para evitar arrastar o build multipage para os testes.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const projectRoot = resolve(__dirname, '..');

export default defineConfig({
    root: projectRoot,
    test: {
        environment: 'node',
        globals: false,
        include: ['**/*-calc.test.js'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/local/**'
        ],
        reporters: ['default'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['**/*-calc.js'],
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/local/**',
                '**/*-calc.test.js'
            ]
        }
    }
});
