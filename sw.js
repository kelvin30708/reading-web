// Reading Web service worker: offline reading + install (analysis-3 P5).
// Bump CACHE on every release so the new files replace the old ones (old caches are deleted on activate).
const CACHE = 'rw-v12';
const RUNTIME = 'rw-runtime-v3';   // pdf.js cmaps / standard fonts, filled on first use
const FONTS = 'rw-gfonts-v1';      // Google Fonts CSS + files, stale-while-revalidate
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/anchor.js', 'js/tapselect.js', 'js/toc.js', 'js/links.js', 'js/dialogue.js',
  'texts/meta.js', 'texts/diamond-zh.js', 'texts/diamond-xz.js', 'texts/diamond-en.js', 'texts/medicine-zh.js', 'texts/medicine-en.js',
  'vendor/fonts/NotoSerifTC-400-sutra-subset.woff2', 'vendor/fonts/NotoSerifTC-600-sutra-subset.woff2',
  'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs',
  'icons/icon-192.png', 'icons/icon-512.png',
  // ink art for the sutra readers (see CREDITS.txt)
  'img/art/pines-wide.webp', 'img/art/pines-tall.webp', 'img/art/enso.webp'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  const keep = new Set([CACHE, RUNTIME, FONTS]);
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const stale = keys.filter(k => k.startsWith('rw-') && !keep.has(k));
    await Promise.all(stale.map(k => caches.delete(k)));
    await self.clients.claim();
    // Old tabs still have the previous JS in memory (and may lack the client reload hook).
    // When we replace a stale cache, navigate those windows so the new shell loads once.
    if (!stale.length) return;
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const go = Promise.all(pages.map(c => {
      if (typeof c.navigate !== 'function') { c.postMessage({ type: 'rw-sw-updated' }); return Promise.resolve(); }
      // Same-URL navigate can be a no-op (and hang); bump a query so the tab actually reloads and keeps the hash.
      const u = new URL(c.url);
      if (u.searchParams.get('rwsw') === CACHE) { c.postMessage({ type: 'rw-sw-updated' }); return Promise.resolve(); }
      u.searchParams.set('rwsw', CACHE);
      return c.navigate(u.href);
    }));
    await Promise.race([go, new Promise(r => setTimeout(r, 4000))]);
  })());
});

const cacheFirst = async (req, name) => {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(name)).put(req, res.clone());
  return res;
};
const staleWhileRevalidate = async req => {
  const c = await caches.open(FONTS); const hit = await c.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
};

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: serve the cached copy, refresh in the background
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(staleWhileRevalidate(req)); return; }
  // everything else cross-origin (dictionaryapi.dev, source links) goes straight to the network
  if (url.origin !== location.origin) return;
  // page loads: the cached app shell (the hash router does the rest)
  if (req.mode === 'navigate') { e.respondWith(caches.match('index.html').then(hit => hit || fetch(req)).catch(() => caches.match('index.html'))); return; }
  e.respondWith(cacheFirst(req, url.pathname.includes('/vendor/pdfjs/') ? RUNTIME : CACHE));
});
