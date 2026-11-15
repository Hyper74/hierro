// ─────────────────────────────────────────────────────────────
// Importador / exportador en formato CSV de Hevy.
//
// Formato real analizado (export de Hevy en español):
//   "title","start_time","end_time","description","exercise_title",
//   "superset_id","exercise_notes","set_index","set_type","weight_kg",
//   "reps","distance_km","duration_seconds","rpe"
//   · Fechas: "13 nov 2026, 13:09" (mes abreviado según idioma, hora local)
//   · Decimales con punto: 54.3, 6.95
//   · Campos vacíos = sin dato (peso corporal, series por tiempo…)
//   · Cadenas entre comillas, números sin comillas, emojis en títulos
//   · Filas ordenadas del entreno más reciente al más antiguo
// También se aceptan weight_lbs / distance_miles y fechas en inglés.
// El RPE se ignora (decisión del usuario).
// ─────────────────────────────────────────────────────────────

import { parseCSVObjects, toCSV } from './csv.js';

const MONTHS = {
  // español
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, set: 8, oct: 9, nov: 10, dic: 11,
  // inglés
  jan: 0, apr: 3, aug: 7, dec: 11,
  // otros idiomas habituales de Hevy
  janv: 0, fevr: 1, fev: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, aout: 7, dez: 11, okt: 9, marz: 2, gen: 0, giu: 5, lug: 6, ott: 9, out: 9,
};
const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const strip = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Convierte una fecha de Hevy a milisegundos (hora local). null si no se entiende. */
export function parseHevyDate(str) {
  const s = String(str ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\s+([^\s\d,]+?)\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?/i);
  if (m) {
    const mon = MONTHS[strip(m[2]).replace(/\./g, '').slice(0, 4)] ?? MONTHS[strip(m[2]).slice(0, 3)];
    if (mon == null) return null;
    return build(+m[3], mon, +m[1], +m[4], +m[5], m[7]);
  }
  // "Nov 13, 2026, 1:09 PM" (formato EE. UU.)
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap]\.?\s?m\.?)?/i);
  if (m) {
    const mon = MONTHS[strip(m[1]).slice(0, 3)];
    if (mon == null) return null;
    return build(+m[3], mon, +m[2], +m[4], +m[5], m[6]);
  }
  // ISO "2026-11-13 13:09" o "2026-11-13T13:09:00"
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return build(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return null;
}
function build(y, mo, d, h, mi, ampm) {
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  const t = new Date(y, mo, d, h, mi, 0, 0).getTime();
  return Number.isFinite(t) ? t : null;
}

/** "13 nov 2026, 13:09" */
export function formatHevyDate(ts) {
  const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTH_ES[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const num = (v) => {
  const t = String(v ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const SET_TYPES = { normal: 'normal', warmup: 'warmup', dropset: 'drop', drop: 'drop', failure: 'failure' };
const LB = 0.45359237;

/** Clave estable de un entreno para detectar duplicados. */
export const workoutKey = (title, start) => `${Math.floor(start / 60000)}|${String(title ?? '').trim()}`;

/**
 * Lee el CSV de Hevy.
 * @returns {{workouts:Array, names:Map<string,object>, errors:string[], rows:number}}
 */
export function parseHevyCSV(text) {
  const { header, records } = parseCSVObjects(text);
  const errors = [];
  const need = ['title', 'start_time', 'exercise_title'];
  const missing = need.filter((h) => !header.includes(h));
  if (missing.length) {
    return { workouts: [], names: new Map(), errors: [`No parece un CSV de Hevy: faltan las columnas ${missing.join(', ')}.`], rows: 0 };
  }
  const wCol = header.includes('weight_kg') ? 'weight_kg' : header.includes('weight_lbs') ? 'weight_lbs' : null;
  const dCol = header.includes('distance_km') ? 'distance_km' : header.includes('distance_miles') ? 'distance_miles' : null;

  const byKey = new Map();
  const order = [];
  const names = new Map();
  let line = 1;

  for (const r of records) {
    line++;
    const start = parseHevyDate(r.start_time);
    if (start == null) { errors.push(`Fila ${line}: fecha no reconocida "${r.start_time}"`); continue; }
    const title = (r.title || 'Entreno').trim();
    const name = (r.exercise_title || '').trim();
    if (!name) { errors.push(`Fila ${line}: sin nombre de ejercicio`); continue; }
    const key = workoutKey(title, start);

    let w = byKey.get(key);
    if (!w) {
      const end = parseHevyDate(r.end_time);
      w = { key, title, start, end: end && end >= start ? end : null, description: (r.description || '').trim(), exercises: [] };
      byKey.set(key, w);
      order.push(w);
    }

    let weight = wCol ? num(r[wCol]) : null;
    if (weight != null && wCol === 'weight_lbs') weight *= LB;
    let dist = dCol ? num(r[dCol]) : null;
    if (dist != null && dCol === 'distance_miles') dist *= 1.609344;
    const reps = num(r.reps);
    const time = num(r.duration_seconds);
    const setIndex = num(r.set_index);
    const ssRaw = String(r.superset_id ?? '').trim();
    const set = {
      type: SET_TYPES[strip(r.set_type).trim()] || 'normal',
      weight: weight != null && weight > 0 ? Math.round(weight * 1000) / 1000 : null,
      reps: reps != null ? Math.round(reps) : null,
      time: time != null ? Math.round(time) : null,
      dist: dist != null && dist > 0 ? dist : null,
      done: true,
    };

    // Nuevo bloque si cambia el ejercicio o el índice de serie vuelve a empezar
    const last = w.exercises.at(-1);
    const ss = ssRaw === '' ? null : 'ss' + ssRaw;
    if (!last || last.name !== name || last.supersetId !== ss || (setIndex != null && last._lastIdx != null && setIndex <= last._lastIdx)) {
      w.exercises.push({ name, notes: (r.exercise_notes || '').trim(), supersetId: ss, sets: [], _lastIdx: null });
    }
    const block = w.exercises.at(-1);
    block.sets.push(set);
    block._lastIdx = setIndex;

    let info = names.get(name);
    if (!info) { info = { name, sets: 0, withWeight: 0, withReps: 0, withTime: 0 }; names.set(name, info); }
    info.sets++;
    if (set.weight != null) info.withWeight++;
    if (set.reps != null) info.withReps++;
    if (set.time != null) info.withTime++;
  }

  for (const w of order) for (const e of w.exercises) delete e._lastIdx;
  for (const info of names.values()) {
    info.kind = inferKind(info);
    info.equipment = inferEquipment(info.name, info.kind);
    info.muscle = inferMuscle(info.name);
  }
  return { workouts: order, names, errors, rows: records.length };
}

/** Deduce el tipo de registro a partir de los datos. */
export function inferKind(info) {
  if (info.withTime > 0 && info.withReps === 0) return 'time';
  if (/peso anadido|lastre|weighted/.test(strip(info.name))) return 'weighted';
  if (info.withWeight === 0) return 'reps';
  return 'weight';
}

/** Deduce el material por el nombre. */
export function inferEquipment(name, kind) {
  const n = strip(name);
  if (/discos|plate/.test(n)) return 'discos';
  if (/\(barra( z)?\)|barbell|con barra\b|ez bar/.test(n)) return 'barra';
  if (/mancuerna|dumbbell/.test(n)) return 'mancuernas';
  if (/cable|polea/.test(n)) return 'polea';
  if (/maquina|machine|smith/.test(n)) return 'maquina';
  if (/pesa rusa|kettlebell/.test(n)) return 'kettlebell';
  if (kind === 'reps' || kind === 'weighted' || kind === 'time') return 'corporal';
  return 'otro';
}

/** Deduce el grupo muscular por palabras clave (el orden importa). */
export function inferMuscle(name) {
  const n = strip(name);
  const rules = [
    ['Core', /plancha|plank|abdominal|crunch|rueda|levantamiento de (piernas|rodillas)|leg raise|knee raise|flexion lateral|side bend|windshield|halo|around the world|copenhagen|oblicu|russian twist|dead bug/],
    ['Tríceps', /tricep|katana|press frances|skull|pushdown/],
    ['Bíceps', /biceps|bicep|curl (martillo|predicador|de biceps|concentrado|araña)|hammer curl|preacher|(^|\s)curl(?! de pierna| femoral|.*leg)/],
    ['Glúteos', /gluteo|hip thrust|puente|aduccion|abduccion|adduction|abduction|patada/],
    ['Piernas', /sentadilla|squat|prensa|leg press|zancada|lunge|peso muerto|deadlift|pierna|leg|gemelo|calf|tibial|femoral|cuadriceps|step/],
    ['Hombros', /hombro|shoulder|militar|overhead press|elevacion lateral|lateral raise|vuelos|rear delt|face pull|deltoid|arnold/],
    ['Pecho', /pecho|banca|bench|chest|aperturas|fly|cruce|pec |flexiones|push ?up|fondos|dip|declinado|high to low/],
    ['Espalda', /remo|row|jalon|pulldown|dominada|pull ?up|chin ?up|espalda|back|pullover|lumbar|hiperextension/],
  ];
  for (const [m, re] of rules) if (re.test(n)) return m;
  return 'Otros';
}

// ── Emparejamiento de nombres con la biblioteca ─────────────

const STOP = new Set(['de', 'a', 'la', 'el', 'con', 'en', 'un', 'una', 'al', 'del', 'y', 'the', 'with', 'to', 'of']);
export const normalizeName = (s) => strip(s).replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => normalizeName(s).split(' ').filter((t) => t && !STOP.has(t));
function dice(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/**
 * Empareja nombres de Hevy con ejercicios existentes.
 * @returns {Map<string,{exId:string|null, quality:'exact'|'fuzzy'|'new', score:number}>}
 */
export function matchExercises(names, exercises) {
  const exact = new Map();
  for (const ex of exercises) {
    for (const n of [ex.name, ...(ex.aliases || [])]) {
      const k = normalizeName(n);
      if (k && !exact.has(k)) exact.set(k, ex.id);
    }
  }
  const out = new Map();
  for (const name of names) {
    const k = normalizeName(name);
    if (exact.has(k)) { out.set(name, { exId: exact.get(k), quality: 'exact', score: 1 }); continue; }
    let best = null, bestScore = 0;
    const eq = inferEquipment(name);
    for (const ex of exercises) {
      for (const n of [ex.name, ...(ex.aliases || [])]) {
        const sc = dice(name, n);
        if (sc > bestScore && inferEquipment(n) === eq) { bestScore = sc; best = ex.id; }
      }
    }
    out.set(name, bestScore >= 0.8 ? { exId: best, quality: 'fuzzy', score: bestScore } : { exId: null, quality: 'new', score: bestScore });
  }
  return out;
}

/**
 * Convierte los entrenos leídos en entrenos de la app.
 * @param {Array} parsed     workouts de parseHevyCSV
 * @param {Map<string,string>} idOf  nombre Hevy → id de ejercicio
 * @param {()=>string} newId generador de ids
 */
export function buildWorkouts(parsed, idOf, newId) {
  return parsed.map((w) => {
    const ssMap = new Map();
    return {
      id: newId(),
      title: w.title,
      start: w.start,
      end: w.end ?? w.start + 60 * 60000,
      notes: w.description || '',
      source: 'hevy',
      importKey: w.key,
      exercises: w.exercises.map((e) => {
        let ss = null;
        if (e.supersetId) {
          if (!ssMap.has(e.supersetId)) ssMap.set(e.supersetId, 'ss' + (ssMap.size + 1));
          ss = ssMap.get(e.supersetId);
        }
        return { exId: idOf.get(e.name), notes: e.notes, supersetId: ss, sets: e.sets.map((s) => ({ ...s })) };
      }),
    };
  });
}

// ── Exportación (mismo formato que Hevy, sin RPE) ───────────

export const HEVY_HEADER = ['title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index', 'set_type', 'weight_kg', 'reps', 'distance_km', 'duration_seconds', 'rpe'];
const TYPE_OUT = { normal: 'normal', warmup: 'warmup', drop: 'dropset', failure: 'failure' };

export function workoutsToHevyCSV(workouts, nameOf) {
  const rows = [];
  const sorted = [...workouts].sort((a, b) => b.start - a.start); // como Hevy: lo más reciente primero
  for (const w of sorted) {
    const ssIdx = new Map();
    for (const e of w.exercises) {
      let ss = null;
      if (e.supersetId) {
        if (!ssIdx.has(e.supersetId)) ssIdx.set(e.supersetId, ssIdx.size);
        ss = ssIdx.get(e.supersetId);
      }
      e.sets.filter((s) => s.done !== false).forEach((s, i) => {
        rows.push([
          w.title, formatHevyDate(w.start), formatHevyDate(w.end || w.start), w.notes || '',
          nameOf(e.exId), ss, e.notes || '', i, TYPE_OUT[s.type] || 'normal',
          s.weight != null ? Math.round(s.weight * 1000) / 1000 : null, s.reps ?? null, s.dist ?? null, s.time ?? null, null,
        ]);
      });
    }
  }
  return toCSV(HEVY_HEADER, rows);
}
