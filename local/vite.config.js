import { defineConfig } from 'vite';
import { resolve } from 'path';

const projectRoot = resolve(__dirname, '..');

export default defineConfig({
  // Diretório raiz do projeto
  root: projectRoot,
  
  // Diretório público (assets não processados)
  publicDir: resolve(projectRoot, 'public'),
  
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
        main: resolve(projectRoot, 'index.html'),
        bombaagua: resolve(projectRoot, 'bombaagua/bombaagua.html'),
        aquecimento: resolve(projectRoot, 'aquecimento/aquecimento.html'),
        arcondicionado: resolve(projectRoot, 'arcondicionado/arcondicionado.html'),
        bitola: resolve(projectRoot, 'bitola/bitola.html'),
        bugs: resolve(projectRoot, 'bugs/bugs.html'),
        chuva: resolve(projectRoot, 'chuva/chuva.html'),
        fazenda: resolve(projectRoot, 'fazenda/fazenda.html'),
        helice: resolve(projectRoot, 'helice/helice.html'),
        mutuo: resolve(projectRoot, 'mutuo/mutuo.html'),
        solar: resolve(projectRoot, 'solar/solar.html'),
        solarConfig: resolve(projectRoot, 'solar/config.html'),
        sobre: resolve(projectRoot, 'sobre/sobre.html')
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
      '@': projectRoot,
      '@assets': resolve(projectRoot, 'assets'),
      '@config': resolve(projectRoot, 'config')
    }
  },
  
  // CSS
  css: {
    devSourcemap: true
  }
});
