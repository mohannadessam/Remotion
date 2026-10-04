// Service worker بسيط عمدًا: الصفحات والبيانات تنجاب من الخادم دائمًا (فيها بيانات المستخدم وجلسته)،
// والمخزّن فقط صفحة "ما فيه اتصال" وأيقوناتها. غيّر VERSION لو عدّلت offline.html.
const VERSION = 'fayed-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
  );
});
