// ─────────────────────────────────────────────────────────────
// Utilidades generales: HTML seguro, números, unidades y fechas.
// No depende del DOM salvo las funciones de creación de nodos.
// ─────────────────────────────────────────────────────────────

/** Escapa texto para insertarlo en HTML. */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Marca un fragmento como HTML ya seguro (no se escapa). */
export const raw = (s) => ({ __raw: String(s ?? '') });

/**
 * Plantilla etiquetada: escapa automáticamente los valores interpolados.
 * Los arrays se concatenan y los objetos raw() se insertan tal cual.
 */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += toHtml(vals[i]);
  });
  return raw(out);
}
function toHtml(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(toHtml).join('');
  if (typeof v === 'object' && '__raw' in v) return v.__raw;
  return esc(v);
}
/** Convierte el resultado de html`` en texto. */
export const str = (v) => toHtml(v);

/** Crea un elemento a partir de HTML (primer nodo). */
export function el(markup) {
  const t = document.createElement('template');
  t.innerHTML = (typeof markup === 'string' ? markup : str(markup)).trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = (v, dec = 2) => Math.round(v * 10 ** dec) / 10 ** dec;

// ── Números ──────────────────────────────────────────────────

/** Lee un número escrito con coma o punto. Vacío o inválido → null. */
export function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const nfCache = new Map();
/** Formatea un número en español (coma decimal). */
export function fmtNum(n, maxDec = 2) {
  if (n == null || !Number.isFinite(n)) return '–';
  let nf = nfCache.get(maxDec);
  if (!nf) { nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: maxDec }); nfCache.set(maxDec, nf); }
  return nf.format(n);
}
/** Valor para un <input>: con coma decimal, sin separador de miles. */
export function inputNum(n, maxDec = 2) {
  if (n == null || !Number.isFinite(n)) return '';
  return String(round(n, maxDec)).replace('.', ',');
}

// ── Unidades (se guardan siempre en kg) ──────────────────────

export const KG_PER_LB = 0.45359237;
let unit = 'kg';
export const setUnit = (u) => { unit = u === 'lb' ? 'lb' : 'kg'; };
export const getUnit = () => unit;
/** kg → unidad visible. */
export const toDisp = (kg) => (kg == null ? null : unit === 'lb' ? round(kg / KG_PER_LB, 1) : round(kg, 2));
/** unidad visible → kg. */
export const fromDisp = (v) => (v == null ? null : unit === 'lb' ? v * KG_PER_LB : v);
/** "82,5 kg" */
export const fmtW = (kg, withUnit = true) => (kg == null ? '–' : fmtNum(toDisp(kg)) + (withUnit ? ' ' + unit : ''));
/** Volumen grande: sin decimales. */
export const fmtVol = (kg) => fmtNum(Math.round(toDisp(kg) || 0), 0) + ' ' + unit;

/** "1:05" a partir de segundos */
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/** "1 h 21 min" */
export function fmtDur(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
/** Segundos de una serie por tiempo: "45 s" o "1:30" */
export const fmtSecs = (s) => (s == null ? '–' : s < 60 ? `${s} s` : fmtClock(s));

// ── Fechas ───────────────────────────────────────────────────

const dfDay = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const dfDayY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const dfShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const dfTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const dfMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const clean = (s) => s.replace(/\./g, '');

export const fmtDay = (ts) => clean(dfDay.format(ts));        // "vie, 13 nov"
export const fmtDate = (ts) => clean(dfDayY.format(ts));      // "13 nov 2026"
export const fmtShort = (ts) => clean(dfShort.format(ts));    // "13 nov"
export const fmtTime = (ts) => dfTime.format(ts);             // "13:09"
export const fmtMonth = (ts) => { const s = dfMonth.format(ts); return s[0].toUpperCase() + s.slice(1); };
export function daysAgo(ts) {
  const d = Math.floor((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
}
export function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
/** Fecha local para <input type="datetime-local"> */
export function toLocalInput(ts) {
  const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const todayStamp = () => new Date().toISOString().slice(0, 10);

/** Normaliza texto para búsquedas: minúsculas y sin tildes. */
export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Vibración/haptic no existe en iOS web; dejamos el gancho por si acaso. */
export function haptic() { try { navigator.vibrate?.(10); } catch { /* iOS no lo soporta */ } }
