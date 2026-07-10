const CACHE_NAME = "paradas-v2";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      // skipWaiting: faz este Service Worker novo ativar imediatamente, sem
      // esperar todas as abas antigas do app serem fechadas. Isso reduz bastante
      // o cenário de duas versões do app coexistindo e brigando pela mesma
      // conexão do IndexedDB (o que causava o login offline travar silenciosamente).
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      // Remove caches de versões antigas do app
      caches.keys().then(nomes =>
        Promise.all(
          nomes
            .filter(nome => nome !== CACHE_NAME)
            .map(nome => caches.delete(nome))
        )
      ),
      // Assume controle imediato das abas já abertas, em vez de esperar reload
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  self.registration.showNotification(
    data.title || "Controle de Paradas",
    {
      body: data.body || "Nova notificação",
      icon: "/icon-192.png"
    }
  );
});
