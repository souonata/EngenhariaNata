// ============================================
// SERVICE WORKER - Cache Offline
// ============================================
// Este Service Worker permite que o site funcione parcialmente offline
// e carregue mais rápido em visitas subsequentes através de cache.
//
// Versão do cache - incrementar quando atualizar recursos
// IMPORTANTE: Atualizar também em config/versions.json
const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `engenharia-nata-${CACHE_VERSION}`;

// Recursos estáticos para cachear (CSS, JS, imagens)
// NOTA: Caminhos relativos ao root do site
// IMPORTANTE: Manter sincronizado com estrutura do projeto
const STATIC_ASSETS = [
    './',
    './index.html',
    './assets/css/shared-styles.css',
    './assets/css/controls-styles.css',
    './assets/js/site-config.js',
    './assets/js/ajustarValorUtil.js',
    './favicon.svg',
    // Apps principais (cachear apenas HTML inicial, assets são carregados sob demanda)
    './solar/solar.html',
    './bitola/bitola.html',
    './helice/helice.html',
    './mutuo/mutuo.html',
    './arcondicionado/arcondicionado.html',
    './aquecimento/aquecimento.html',
    './fazenda/fazenda.html',
    './bugs/bugs.html',
    './sobre/sobre.html'
];

// Estratégia: Cache First (para recursos estáticos)
// Se estiver no cache, usa do cache. Senão, busca da rede e cacheia.
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('Erro ao buscar recurso:', error);
        // Retorna página offline se disponível
        const offlinePage = await caches.match('./index.html');
        if (offlinePage) {
            return offlinePage;
        }
        throw error;
    }
}

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
        }).then(() => {
            // Força ativação imediata do novo Service Worker
            return self.skipWaiting();
        })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Remove caches antigos
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Assume controle de todas as páginas imediatamente
            return self.clients.claim();
        })
    );
});

// Intercepta requisições de rede
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Não intercepta requisições para recursos externos (CDNs, APIs)
    // Deixa o navegador processar diretamente para respeitar CSP
    if (url.origin !== self.location.origin) {
        // Para CDNs e APIs externas, não intercepta - permite que o navegador faça a requisição diretamente
        // Isso evita problemas com Content Security Policy
        return;
    }
    
    // Para recursos do próprio site, usa Cache First
    if (event.request.method === 'GET') {
        event.respondWith(cacheFirst(event.request));
    }
});

