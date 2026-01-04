// ============================================
// SERVICE WORKER - DESINSTALAÇÃO
// ============================================
// Este service worker remove todos os caches e se auto-desregistra
// para garantir que o site sempre carregue do servidor

// Remove todos os caches na instalação
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('[SW] Removendo cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('[SW] Todos os caches removidos');
            return self.skipWaiting();
        })
    );
});

// Desregistra o service worker na ativação
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('[SW] Service Worker será desregistrado');
            return self.registration.unregister();
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Não intercepta nenhuma requisição - deixa tudo ir direto para o servidor
self.addEventListener('fetch', (event) => {
    // Não faz nada - requisições vão direto para a rede
    return;
});

