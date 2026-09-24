const CACHE_NAME = "beyinx-v1";

const APP_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {

  const url = new URL(event.request.url);

  // AI API'sini cacheleme
  if(url.pathname.includes("/.netlify/functions/")){
    return;
  }

  if(event.request.method !== "GET"){
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, copy));

        return response;

      })
      .catch(() => caches.match(event.request))
  );

});
