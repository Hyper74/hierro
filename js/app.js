// Arranque de la app: datos, rutas, service worker y almacenamiento persistente.
import { loadAll, S } from './store.js';
import { addRoute, startRouter } from './router.js';
import { trainView } from './views/train.js';
import { routineEditView } from './views/routineEdit.js';
import { platesView, platesSettingsView } from './views/plates.js';
import { historyView, workoutDetailView } from './views/history.js';
import { progressView } from './views/progress.js';
import { exerciseView } from './views/exercise.js';
import { settingsView, libraryView, storageState } from './views/settings.js';
import { importView } from './views/importHevy.js';
import { restoreActive } from './views/workout.js';
import { unlockAudio } from './sound.js';
import { toast } from './ui/sheet.js';

addRoute('/entrenar', trainView, { tab: 'entrenar', live: true });
addRoute('/entrenar/discos', platesView, { tab: 'entrenar', parent: '#/entrenar' });
addRoute('/entrenar/rutina/:id', routineEditView, { tab: 'entrenar', parent: '#/entrenar', hideTabs: true });
addRoute('/historial', historyView, { tab: 'historial', live: true });
addRoute('/historial/:id', workoutDetailView, { tab: 'historial', parent: '#/historial', live: true });
addRoute('/progreso', progressView, { tab: 'progreso', live: true });
addRoute('/progreso/:exId', exerciseView, { tab: 'progreso', parent: '#/progreso' });
addRoute('/ajustes', settingsView, { tab: 'ajustes' });
addRoute('/ajustes/discos', platesSettingsView, { tab: 'ajustes', parent: '#/ajustes' });
addRoute('/ajustes/ejercicios', libraryView, { tab: 'ajustes', parent: '#/ajustes' });
addRoute('/ajustes/importar', importView, { tab: 'ajustes', parent: '#/ajustes', hideTabs: true });

async function boot() {
  try {
    await loadAll();
  } catch (err) {
    document.getElementById('splash').innerHTML = '<p style="padding:24px;text-align:center;color:#f5f5f7">No se ha podido abrir la base de datos del iPhone.<br>Cierra la app y vuelve a abrirla.</p>';
    console.error(err);
    return;
  }
  await startRouter();
  restoreActive();
  document.getElementById('splash').classList.add('out');
  setTimeout(() => document.getElementById('splash').remove(), 400);

  // El audio en iOS necesita un toque: lo dejamos listo en cuanto haya uno.
  document.addEventListener('pointerdown', unlockAudio, { passive: true });

  // Pedimos a iOS que no borre los datos. En iOS se concede a las apps
  // instaladas en la pantalla de inicio.
  try {
    if (navigator.storage?.persist) {
      storageState.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
  } catch { /* no disponible */ }

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Buscar versión nueva cada vez que se vuelve a la app
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  // Cuando una versión nueva toma el control, recargamos (los datos no se tocan;
  // si hay un entreno en curso está guardado y se recupera solo).
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    if (S.active) toast('App actualizada: se aplicará al volver a abrirla', { ms: 4000 });
    else location.reload();
  });
}

boot();
