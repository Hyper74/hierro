// ─────────────────────────────────────────────────────────────
// Estado de la app en memoria + persistencia en IndexedDB.
// Los datos de una persona caben de sobra en memoria (miles de
// entrenos), así que se cargan al arrancar y se guardan al cambiar.
// ─────────────────────────────────────────────────────────────

import * as db from './db.js';
import { LIBRARY, LIBRARY_VERSION } from '../data/exercises.js';
import { DEFAULT_PLATES } from './core/plates.js';
import { computeRecords } from './core/prs.js';
import { setUnit, uid } from './util.js';

export const DEFAULT_SETTINGS = {
  units: 'kg',
  bar: { kg: 20, lb: 45 },
  plates: DEFAULT_PLATES,
  wakeLock: true,
  defaultRest: 90,
  incKg: 2.5,
  incLb: 5,
  soundMode: 'mix',          // mix = se mezcla con tu música · loud = suena aunque esté en silencio
  bgSound: false,            // experimental: intentar sonar con la pantalla bloqueada
  backupEvery: 14,           // días; 0 = nunca recordar
  lastBackup: null,
  sampleData: false,
  installHintDismissed: false,
};

export const S = {
  exercises: new Map(),
  routines: [],
  workouts: [],      // orden: más reciente primero
  settings: { ...DEFAULT_SETTINGS },
  active: null,      // entreno en curso
  version: 0,        // cambia con cada modificación (para cachés)
};

export const bus = new EventTarget();
function changed() {
  S.version++;
  recCache = null;
  bus.dispatchEvent(new Event('change'));
}

export async function loadAll() {
  const [exercises, routines, workouts, settings, active, libVer] = await Promise.all([
    db.getAll('exercises'), db.getAll('routines'), db.getAll('workouts'),
    db.kvGet('settings'), db.kvGet('active'), db.kvGet('libVersion'),
  ]);
  // Biblioteca precargada: se añaden los ejercicios que falten sin tocar los editados
  if (libVer !== LIBRARY_VERSION) {
    const have = new Set(exercises.map((e) => e.id));
    const missing = LIBRARY.filter((e) => !have.has(e.id));
    if (missing.length) { await db.putMany('exercises', missing); exercises.push(...missing); }
    await db.kvSet('libVersion', LIBRARY_VERSION);
  }
  S.exercises = new Map(exercises.map((e) => [e.id, e]));
  S.routines = routines.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  S.workouts = workouts.sort((a, b) => b.start - a.start);
  S.settings = mergeSettings(settings);
  S.active = active || null;
  setUnit(S.settings.units);
  changed();
}

function mergeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s || {}) };
  out.bar = { ...DEFAULT_SETTINGS.bar, ...(s?.bar || {}) };
  out.plates = { ...DEFAULT_SETTINGS.plates, ...(s?.plates || {}) };
  return out;
}

// ── Ejercicios ──────────────────────────────────────────────
export const getEx = (id) => S.exercises.get(id);
export const exName = (id) => S.exercises.get(id)?.name ?? 'Ejercicio eliminado';
export const kindOf = (id) => S.exercises.get(id)?.kind ?? 'weight';
export function exList() {
  return [...S.exercises.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export async function saveExercise(ex) {
  if (!ex.id) ex.id = 'ex-' + uid();
  await db.put('exercises', ex);
  S.exercises.set(ex.id, ex);
  changed();
  return ex;
}
export async function saveExercises(list) {
  await db.putMany('exercises', list);
  for (const e of list) S.exercises.set(e.id, e);
  changed();
}
export function exerciseUsed(id) {
  return S.workouts.some((w) => w.exercises.some((e) => e.exId === id)) || S.routines.some((r) => r.items.some((i) => i.exId === id));
}
export async function deleteExercise(id) {
  await db.del('exercises', id);
  S.exercises.delete(id);
  changed();
}
/** Descanso efectivo de un ejercicio. */
export const restOf = (exId) => S.exercises.get(exId)?.rest || S.settings.defaultRest;

// ── Rutinas ─────────────────────────────────────────────────
export async function saveRoutine(r) {
  if (!r.id) { r.id = 'r-' + uid(); r.order = S.routines.length ? Math.max(...S.routines.map((x) => x.order ?? 0)) + 1 : 0; }
  await db.put('routines', r);
  const i = S.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) S.routines[i] = r; else S.routines.push(r);
  S.routines.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  changed();
  return r;
}
export async function deleteRoutine(id) {
  await db.del('routines', id);
  S.routines = S.routines.filter((r) => r.id !== id);
  changed();
}
export async function reorderRoutines(ids) {
  ids.forEach((id, i) => { const r = S.routines.find((x) => x.id === id); if (r) r.order = i; });
  S.routines.sort((a, b) => a.order - b.order);
  await db.putMany('routines', S.routines);
  changed();
}

// ── Entrenos ────────────────────────────────────────────────
export async function saveWorkout(w) {
  if (!w.id) w.id = 'w-' + uid();
  await db.put('workouts', w);
  const i = S.workouts.findIndex((x) => x.id === w.id);
  if (i >= 0) S.workouts[i] = w; else S.workouts.push(w);
  S.workouts.sort((a, b) => b.start - a.start);
  changed();
  return w;
}
export async function saveWorkouts(list) {
  await db.putMany('workouts', list);
  const byId = new Map(S.workouts.map((w) => [w.id, w]));
  for (const w of list) byId.set(w.id, w);
  S.workouts = [...byId.values()].sort((a, b) => b.start - a.start);
  changed();
}
export async function deleteWorkout(id) {
  await db.del('workouts', id);
  S.workouts = S.workouts.filter((w) => w.id !== id);
  changed();
}
export const getWorkout = (id) => S.workouts.find((w) => w.id === id);

// ── Ajustes ─────────────────────────────────────────────────
export async function saveSettings(patch) {
  S.settings = mergeSettings({ ...S.settings, ...patch });
  setUnit(S.settings.units);
  await db.kvSet('settings', S.settings);
  changed();
}

// ── Entreno en curso (se guarda en cada cambio) ─────────────
export async function saveActive(a) {
  S.active = a;
  if (a) await db.kvSet('active', a); else await db.kvDel('active');
}

// ── Récords (con caché) ─────────────────────────────────────
let recCache = null;
export function records() {
  if (!recCache) recCache = computeRecords(S.workouts, kindOf);
  return recCache;
}

// ── Datos de ejemplo ────────────────────────────────────────
export async function removeSample() {
  const wids = S.workouts.filter((w) => w.sample).map((w) => w.id);
  const rids = S.routines.filter((r) => r.sample).map((r) => r.id);
  await db.delMany('workouts', wids);
  await db.delMany('routines', rids);
  S.workouts = S.workouts.filter((w) => !w.sample);
  S.routines = S.routines.filter((r) => !r.sample);
  changed();
}
export async function addRoutines(list) {
  await db.putMany('routines', list);
  const byId = new Map(S.routines.map((r) => [r.id, r]));
  for (const r of list) byId.set(r.id, r);
  S.routines = [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  changed();
}

// ── Copia completa (para backup / restaurar / borrar) ───────
export function snapshot() {
  return {
    app: 'hierro', format: 1, exportedAt: new Date().toISOString(),
    exercises: [...S.exercises.values()], routines: S.routines, workouts: S.workouts,
    settings: { ...S.settings, lastBackup: null },
  };
}
export async function restore(data) {
  await db.replaceAll({ exercises: data.exercises, routines: data.routines, workouts: data.workouts });
  await db.kvSet('settings', mergeSettings({ ...data.settings, lastBackup: S.settings.lastBackup }));
  await db.kvDel('active');
  await loadAll();
}
export async function wipeAll() {
  await db.replaceAll({ exercises: [], routines: [], workouts: [] });
  await db.kvDel('active'); await db.kvDel('settings'); await db.kvDel('libVersion');
  await loadAll();
}
