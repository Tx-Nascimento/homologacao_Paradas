const CACHE_NAME = "paradas-v4";

const ARQUIVOS_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/modelo.css?v=4",
  "/js/config.js?v=4",
  "/js/utils.js?v=4",
  "/js/offline.js?v=4",
  "/js/auth.js?v=4",
  "/js/paradas.js?v=4",
  "/js/manutencao.js?v=4",
  "/js/dashboard.js?v=4",
  "/js/admin.js?v=4",
  "/js/app.js?v=4"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(ARQUIVOS_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(nomes =>
        Promise.all(
          nomes
            .filter(nome => nome !== CACHE_NAME)
            .map(nome => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const requisicao = event.request;

  if (requisicao.method !== "GET") {
    return;
  }

  const aceitaHTML =
    requisicao.mode === "navigate" ||
    requisicao.headers.get("accept")?.includes("text/html");

  if (aceitaHTML) {
    event.respondWith(
      fetch(requisicao)
        .then(resposta => {
          const copia = resposta.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(requisicao, copia);
          });

          return resposta;
        })
        .catch(() =>
          caches.match(requisicao)
            .then(cache => cache || caches.match("/index.html"))
        )
    );

    return;
  }

  event.respondWith(
    caches.match(requisicao).then(cache => {
      return (
        cache ||
        fetch(requisicao).then(resposta => {
          const copia = resposta.clone();

          caches.open(CACHE_NAME).then(cacheAtual => {
            cacheAtual.put(requisicao, copia);
          });

          return resposta;
        })
      );
    })
  );
});

self.addEventListener("push", event => {
  let dados = {};

  try {
    dados = event.data?.json() || {};
  } catch {
    dados = {
      body: event.data?.text() || "Nova notificação"
    };
  }

  event.waitUntil(
    self.registration.showNotification(
      dados.title || "Controle Industrial",
      {
        body: dados.body || "Nova notificação",
        icon: "/icon-192.png",
        badge: "/icon-192.png"
      }
    )
  );
});
