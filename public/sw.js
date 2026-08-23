// Service Worker ultra liviano para instalación PWA sin interferir con la red ni con Supabase
const CACHE_NAME = 'perla-verde-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar todas las cachés anteriores para evitar bloqueos tras nuevos deploys
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Solo manejar peticiones GET del mismo origen (no tocar Supabase ni APIs externas)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Estrategia Network-First: Siempre pedir a la red primero
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
