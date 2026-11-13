/**
 * FinFlow - Service Worker para Suporte PWA Offline Completo
 * Estratégia de Caching Inteligente com Stale-While-Revalidate para CDNs
 */

const CACHE_NAME = 'finflow-v1.0.6';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png',
  './icon-192.png'
];

// Instalação: Pré-cache dos ativos estáticos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cacheando arquivos da aplicação');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação: Limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Busca (Fetch): Stale-While-Revalidate com Fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Apenas intercepta requisições HTTP/HTTPS tipo GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Atualiza o cache se a resposta for válida
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Se falhar e não houver cache para páginas html, retorna index.html em cache
          if (request.mode === 'navigate') {
            return cache.match('./index.html');
          }
          return cachedResponse;
        });

      // Retorna a resposta em cache imediatamente se existir, caso contrário aguarda a rede
      return cachedResponse || fetchPromise;
    })
  );
});

