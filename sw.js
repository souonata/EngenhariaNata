// Remove todos os caches e desregistra o service worker
// Garante que o site sempre carregue do servidor
// Evento de instalação - remove caches existentes
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            return self.skipWaiting();
        })
    );
});
// Evento de ativação - desregistra o service worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            return self.registration.unregister();
        })
    );
});
// Evento de fetch - não intercepta requisições
self.addEventListener('fetch', (event) => {
    return;
});

