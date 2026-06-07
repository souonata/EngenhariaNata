// Service Worker do guia BR 12C Niobium — escopo /hp12c/.
// Objetivo: o app e o PDF do guia funcionarem offline depois do 1º acesso online.
// Estratégia:
//   - PDF/fontes/imagens (estáticos): cache-first (servem offline; não rebaixam).
//   - HTML/JS/CSS (casca do app): network-first (atualizam online; caem para o
//     cache quando offline).
// Não intercepta nada fora de /hp12c/ nem outras origens (ex.: GoatCounter).

const CACHE = 'br12c-guide-v1';
const ESTATICO = /\.(?:pdf|woff2?|png|jpe?g|gif|svg|webp)$/i;

// Casca do app pré-cacheada já na instalação (o PDF não entra aqui: é grande e
// só é cacheado quando o usuário abre o guia). allSettled = instala mesmo que
// algum item falhe.
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './guide.js',
  './panels.js',
  './imagem calculadora.png',
  './assets/fonts/DSEG7ClassicMini-Regular.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((k) => k.startsWith('br12c-guide-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function guardarNoCache(req, resp) {
  if (resp && resp.ok) {
    const copia = resp.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return resp;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Só o próprio escopo (mesma origem, dentro de /hp12c/).
  if (url.origin !== self.location.origin || !url.pathname.includes('/hp12c/')) {
    return;
  }

  if (ESTATICO.test(url.pathname)) {
    // cache-first
    event.respondWith(
      caches.match(req).then((cacheado) => cacheado || fetch(req).then((r) => guardarNoCache(req, r)))
    );
  } else {
    // network-first (casca do app)
    event.respondWith(
      fetch(req)
        .then((r) => guardarNoCache(req, r))
        .catch(() => caches.match(req))
    );
  }
});
