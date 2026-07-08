const CACHE_NAME = 'opera-formacao-v2.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;900&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não interceptar Firebase, API, ou ambiente de desenvolvimento local/online
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('firebase') || 
      url.hostname.includes('localhost') ||
      url.hostname.includes('127.0.0.1') ||
      url.hostname.includes('ais-dev') ||
      url.hostname.includes('ais-pre') ||
      url.pathname.includes('@vite') ||
      url.pathname.includes('node_modules') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.jsx') ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  // Estratégia especial para o index.html: Sempre tentar rede primeiro (Network-First)
  // Isso resolve o problema de "tela branca" ao atualizar o app.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Para outros assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Opera Formação', body: 'Nova atualização!' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data = { title: 'Opera Formação', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://cdn-icons-png.flaticon.com/512/10542/10542521.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/10542/10542521.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'opera-form-notif',
      renotify: true,
      data: { url: data.url || '/', targetTab: data.targetTab || 'resumo' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  const targetTab = event.notification.data?.targetTab;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          if (targetTab) client.postMessage({ type: 'SET_TAB', tab: targetTab });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});
