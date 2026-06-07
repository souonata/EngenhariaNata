import { defineConfig } from 'vite';
import { resolve, relative } from 'path';
import { readdirSync, statSync } from 'fs';

const projectRoot = resolve(__dirname, '..');

// Descobre automaticamente todas as páginas .html para as entradas multipage do
// build. Evita o esquecimento de apps novos na lista de inputs (foi o que deixou
// o hp12c de fora). Pastas em IGNORAR ficam sempre fora do build.
const IGNORAR = new Set([
    'node_modules',
    'dist',
    '.vite',
    '.git',
    'local',
    'public',
    'dalie',
    'template-app',
    // hp12c é standalone (scripts clássicos próprios). Não passa pelo bundle:
    // é copiado verbatim para o dist pelo workflow de deploy.
    'hp12c'
]);

function descobrirPaginasHtml(dir, acc = {}) {
    for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome) || nome.startsWith('.')) {
            continue;
        }
        const full = resolve(dir, nome);
        if (statSync(full).isDirectory()) {
            descobrirPaginasHtml(full, acc);
        } else if (nome.endsWith('.html')) {
            const rel = relative(projectRoot, full).replace(/\\/g, '/');
            const chave = rel === 'index.html' ? 'main' : rel.replace(/\.html$/, '').replace(/\//g, '-');
            acc[chave] = full;
        }
    }
    return acc;
}

export default defineConfig(({ command }) => ({
    // Diretório raiz do projeto
    root: projectRoot,

    // Diretório público (assets não processados, copiados como estão)
    publicDir: resolve(projectRoot, 'public'),

    // Produção: GitHub Pages de projeto em https://souonata.github.io/EngenhariaNata/.
    // Em dev/preview mantém a raiz ('/') para não quebrar o fluxo local.
    base: command === 'build' ? '/EngenhariaNata/' : '/',

    // Configurações do servidor de desenvolvimento
    server: {
        port: Number(process.env.VITE_PORT || 5173),
        open: true,
        cors: true,
        strictPort: true
    },

    // Configurações de build
    build: {
        outDir: resolve(__dirname, 'dist'),
        assetsDir: 'assets',
        emptyOutDir: true,
        sourcemap: true,
        minify: 'terser',

        // Opções do Terser para minificação
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            },
            format: {
                comments: false
            }
        },

        // Entradas multipage descobertas automaticamente
        rollupOptions: {
            input: descobrirPaginasHtml(projectRoot),
            output: {
                // Nome dos chunks com hash para cache-busting
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
            }
        },

        // Limite de aviso de tamanho (em KB)
        chunkSizeWarningLimit: 500
    },

    // Otimizações
    optimizeDeps: {
        include: []
    },

    // Resolve aliases para imports mais limpos
    resolve: {
        alias: {
            '@': projectRoot,
            '@assets': resolve(projectRoot, 'assets'),
            '@config': resolve(projectRoot, 'config')
        }
    },

    // CSS
    css: {
        devSourcemap: true
    }
}));
