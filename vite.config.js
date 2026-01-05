import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Diretório raiz do projeto
  root: '.',
  
  // Diretório público (assets não processados)
  publicDir: 'public',
  
  // Configurações do servidor de desenvolvimento
  server: {
    port: 3000,
    open: true,
    cors: true,
    strictPort: false
  },
  
  // Configurações de build
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
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
    
    // Configurações do Rollup
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        aquecimento: resolve(__dirname, 'aquecimento/aquecimento.html'),
        arcondicionado: resolve(__dirname, 'arcondicionado/arcondicionado.html'),
        bitola: resolve(__dirname, 'bitola/bitola.html'),
        bugs: resolve(__dirname, 'bugs/bugs.html'),
        fazenda: resolve(__dirname, 'fazenda/fazenda.html'),
        helice: resolve(__dirname, 'helice/helice.html'),
        mutuo: resolve(__dirname, 'mutuo/mutuo.html'),
        solar: resolve(__dirname, 'solar/solar.html'),
        solarConfig: resolve(__dirname, 'solar/config.html'),
        sobre: resolve(__dirname, 'sobre/sobre.html')
      },
      output: {
        // Code splitting para otimização
        manualChunks: {
          'site-config': ['./assets/js/site-config.js'],
          'ajustar-valor': ['./assets/js/ajustarValorUtil.js']
        },
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
      '@': resolve(__dirname, './'),
      '@assets': resolve(__dirname, './assets'),
      '@config': resolve(__dirname, './config')
    }
  },
  
  // CSS
  css: {
    devSourcemap: true
  }
});
