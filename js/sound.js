// ─────────────────────────────────────────────────────────────
// Sonido del fin de descanso.
//
// Lo que permite Safari en iOS (comprobado para iOS 26–27):
//  · Una web app solo puede reproducir audio si antes ha habido un
//    toque del usuario. Por eso "desbloqueamos" el audio en cada toque
//    (marcar una serie como hecha es un toque, justo antes del descanso).
//  · Con la app en primer plano (pantalla encendida) el pitido es fiable.
//  · Con la pantalla bloqueada o en otra app, iOS congela la web app:
//    no hay temporizadores ni notificaciones locales programables.
//    Las notificaciones push exigirían un servidor (descartado).
//  · Modo experimental: reproducir una pista de audio con silencio +
//    pitido final. Si iOS mantiene vivo el audio de la web app con la
//    pantalla bloqueada, sonará. Pausa tu música mientras dura.
//  · El tipo de sesión de audio (navigator.audioSession) decide si el
//    pitido se mezcla con tu música ("ambient", respeta el modo silencio)
//    o suena siempre ("playback", puede pausar la música).
// ─────────────────────────────────────────────────────────────
import { S } from './store.js';

let ctx = null;
let stale = false;
let fallbackEl = null, fallbackPrimed = false, beepUrl = null;
let bgEl = null, bgUrl = null;

function sessionType(t) {
  try { if ('audioSession' in navigator) navigator.audioSession.type = t; } catch { /* no soportado */ }
}
function wantedType() {
  if (S.settings.bgSound) return 'playback';
  return S.settings.soundMode === 'loud' ? 'playback' : 'ambient';
}

/** Llamar dentro de un toque del usuario. */
export function unlockAudio() {
  sessionType(wantedType());
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && (!ctx || stale || ctx.state === 'closed')) {
      try { ctx?.close(); } catch { /* ya cerrado */ }
      ctx = new AC();
      stale = false;
    }
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    if (ctx) {
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    }
  } catch { /* sin Web Audio */ }
  primeFallback();
}

// Al volver de segundo plano, iOS a veces deja el AudioContext inservible:
// lo recreamos en el siguiente toque.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { stale = true; fallbackPrimed = false; }
});

function primeFallback() {
  if (fallbackPrimed) return;
  if (!beepUrl) beepUrl = URL.createObjectURL(new Blob([makeWav(0)], { type: 'audio/wav' }));
  if (!fallbackEl) { fallbackEl = new Audio(beepUrl); fallbackEl.preload = 'auto'; }
  fallbackEl.muted = true;
  const p = fallbackEl.play();
  if (p) p.then(() => { fallbackEl.pause(); fallbackEl.currentTime = 0; fallbackEl.muted = false; fallbackPrimed = true; }).catch(() => {});
}

/** Pitido de fin de descanso: tres tonos cortos y uno más agudo. */
export function beep() {
  if (bgEl && !bgEl.paused) return; // la pista de fondo ya pita sola
  try {
    if (ctx && ctx.state === 'running') {
      const t0 = ctx.currentTime + 0.02;
      [[0, 880, 0.12], [0.22, 880, 0.12], [0.44, 880, 0.12], [0.7, 1320, 0.38]].forEach(([d, f, len]) => tone(t0 + d, f, len));
      return;
    }
  } catch { /* probamos el plan B */ }
  if (fallbackEl) { fallbackEl.muted = false; fallbackEl.currentTime = 0; fallbackEl.play().catch(() => {}); }
}
function tone(at, freq, len) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.9, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ctx.destination);
  o.start(at); o.stop(at + len + 0.05);
}

// ── Modo experimental con pantalla bloqueada ────────────────
/** Arranca una pista de silencio que termina en pitido. Llamar en un toque. */
export function startBackgroundBeep(seconds, label = 'Descanso') {
  if (!S.settings.bgSound) return;
  stopBackgroundBeep();
  try {
    bgUrl = URL.createObjectURL(new Blob([makeWav(Math.max(0, seconds))], { type: 'audio/wav' }));
    bgEl = bgEl || new Audio();
    bgEl.src = bgUrl;
    bgEl.play().catch(() => {});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: 'Hierro', album: 'Temporizador de descanso' });
    }
  } catch { /* sin soporte */ }
}
export function stopBackgroundBeep() {
  if (bgEl) { try { bgEl.pause(); } catch { /* nada */ } bgEl.removeAttribute('src'); }
  if (bgUrl) { URL.revokeObjectURL(bgUrl); bgUrl = null; }
}

/**
 * WAV mono de 8 kHz y 8 bits: `silence` segundos de silencio + el pitido.
 * 90 s ≈ 730 KB, se genera al momento en memoria.
 */
export function makeWav(silence) {
  const rate = 8000;
  const pattern = [[0, 880, 0.12], [0.22, 880, 0.12], [0.44, 880, 0.12], [0.7, 1320, 0.38]];
  const tail = 1.2;
  const n = Math.round((silence + tail) * rate);
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  wr(36, 'data'); dv.setUint32(40, n, true);
  buf.fill(128, 44);
  const start = Math.round(silence * rate);
  for (const [d, f, len] of pattern) {
    const s0 = start + Math.round(d * rate), s1 = s0 + Math.round(len * rate);
    for (let i = s0; i < s1 && i < n; i++) {
      const t = (i - s0) / rate;
      const env = Math.min(1, t / 0.01, (len - t) / 0.03);
      buf[44 + i] = 128 + Math.round(110 * env * Math.sin(2 * Math.PI * f * t));
    }
  }
  return buf;
}
