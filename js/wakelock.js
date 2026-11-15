// Mantener la pantalla encendida durante el entreno (Screen Wake Lock API,
// disponible en Safari/iOS desde 16.4 y en apps de pantalla de inicio desde 18.4).
let lock = null;
let want = false;

export const wakeSupported = () => 'wakeLock' in navigator;
export const wakeActive = () => !!lock;

async function request() {
  if (!want || !wakeSupported() || lock || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch { lock = null; }
}

export function enableWake() { want = true; return request(); }
export function disableWake() {
  want = false;
  try { lock?.release(); } catch { /* ya liberado */ }
  lock = null;
}
// iOS libera el bloqueo al pasar a segundo plano: lo pedimos de nuevo al volver.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') request(); });
