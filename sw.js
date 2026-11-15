// ─────────────────────────────────────────────────────────────
// Service worker: guarda todos los archivos de la app en el iPhone
// para que funcione 100 % sin conexión.
//
// PARA PUBLICAR UNA ACTUALIZACIÓN: cambia VERSION (cualquier texto
// distinto vale). Safari detecta que este archivo ha cambiado, descarga
// la app nueva y la activa. Los datos (IndexedDB) no se tocan nunca.
// ─────────────────────────────────────────────────────────────
const VERSION = '1.0.0';
const CACHE = 'hierro-' + VERSION;

const FILES = [
  './',
  'css/app.css',
  'data/exercises.js',
  'data/sample.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/actions.js',
  'js/app.js',
  'js/core/backup.js',
  'js/core/csv.js',
  'js/core/hevy.js',
  'js/core/oneRM.js',
  'js/core/plates.js',
  'js/core/prs.js',
  'js/core/stats.js',
  'js/db.js',
  'js/files.js',
  'js/router.js',
  'js/sound.js',
  'js/store.js',
  'js/ui/chart.js',
  'js/ui/components.js',
  'js/ui/icons.js',
  'js/ui/picker.js',
  'js/ui/plateBar.js',
  'js/ui/plateInfo.js',
  'js/ui/sheet.js',
  'js/util.js',
  'js/views/exercise.js',
  'js/views/history.js',
  'js/views/importHevy.js',
  'js/views/plates.js',
  'js/views/progress.js',
  'js/views/records.js',
  'js/views/routineEdit.js',
  'js/views/settings.js',
  'js/views/summary.js',
  'js/views/train.js',
  'js/views/workout.js',
  'js/wakelock.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' evita quedarnos con copias viejas de la caché HTTP
    await Promise.all(FILES.map(async (f) => {
      const res = await fetch(new Request(f, { cache: 'reload' }));
      if (!res.ok) throw new Error('No se pudo descargar ' + f);
      await cache.put(f, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('hierro-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Primero la copia guardada (rápido y sin conexión)
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      // Sin conexión y sin copia: para navegaciones devolvemos la app
      if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
      return Response.error();
    }
  })());
});
