// ─────────────────────────────────────────────────────────────
// Detección de récords personales (PRs).
//
// Se recorre todo el historial en orden cronológico y, para cada
// ejercicio, se guarda la mejor marca de cada tipo. Cada vez que una
// marca mejora se registra un evento en el historial de récords.
//
// Reglas:
//  · Las series de calentamiento y las no completadas no cuentan.
//  · La primera vez que haces un ejercicio se fija la marca de partida
//    (aparece en el historial como "primera marca") pero NO se marca
//    la serie como PR: no tendría sentido celebrar todo el primer día.
//  · "Más reps con un peso" solo cuenta si ya habías hecho ese peso.
//
// Tipos de PR según el tipo de ejercicio:
//   weight   → weight (peso máx), e1rm, repsAtWeight, volume (sesión)
//   reps     → reps (máx en una serie), sessionReps (total sesión)
//   weighted → reps, sessionReps, weight (lastre máx), repsAtWeight
//   time     → time (máx)
// ─────────────────────────────────────────────────────────────

import { epley } from './oneRM.js';

export const PR_LABEL = {
  weight: 'Peso máximo',
  e1rm: '1RM estimado',
  repsAtWeight: 'Más reps con ese peso',
  volume: 'Volumen en una sesión',
  reps: 'Más repeticiones',
  sessionReps: 'Reps totales en una sesión',
  time: 'Mayor tiempo',
};
export const PR_SHORT = { weight: 'Peso', e1rm: '1RM', repsAtWeight: 'Reps', volume: 'Volumen', reps: 'Reps', sessionReps: 'Reps sesión', time: 'Tiempo' };

const EPS = 1e-6;
const wkey = (w) => (Math.round(w * 100) / 100).toFixed(2);

/** ¿La serie cuenta para estadísticas y PRs? */
export function isWorking(s) {
  return !!s && s.done !== false && s.type !== 'warmup';
}

/**
 * @param {Array} workouts  entrenos (cualquier orden)
 * @param {(exId:string)=>string} kindOf  tipo de ejercicio
 * @returns {{
 *   byEx: Map<string,{best:object, history:Array}>,
 *   setFlags: Map<string,string[]>,   // "wid:ei:si" → tipos de PR de esa serie
 *   exFlags: Map<string,string[]>,    // "wid:ei"    → PRs de sesión (volumen, reps totales)
 * }}
 */
export function computeRecords(workouts, kindOf) {
  const sorted = [...workouts].sort((a, b) => a.start - b.start);
  const byEx = new Map();
  const setFlags = new Map();
  const exFlags = new Map();
  const push = (map, k, t) => { const a = map.get(k); if (a) a.push(t); else map.set(k, [t]); };

  for (const w of sorted) {
    // Acumulados de la sesión por ejercicio (por si aparece dos veces)
    const session = new Map();

    w.exercises.forEach((ex, ei) => {
      const kind = kindOf(ex.exId) || 'weight';
      let rec = byEx.get(ex.exId);
      if (!rec) { rec = { best: { repsAtWeight: {} }, history: [] }; byEx.set(ex.exId, rec); }
      const b = rec.best;
      let ss = session.get(ex.exId);
      if (!ss) { ss = { kind, vol: 0, reps: 0, any: false, ei }; session.set(ex.exId, ss); }

      const event = (type, value, prev, si, extra = {}) => {
        rec.history.push({ type, value, prev, date: w.start, wid: w.id, ...extra });
        if (prev != null) push(setFlags, `${w.id}:${ei}:${si}`, type);
      };
      const mark = (si, extra) => ({ value: extra.value, date: w.start, wid: w.id, ei, si, ...extra });

      ex.sets.forEach((s, si) => {
        if (!isWorking(s)) return;
        const wt = s.weight > 0 ? s.weight : 0;
        const r = s.reps > 0 ? s.reps : 0;

        if (kind === 'weight') {
          if (!(wt > 0 && r > 0)) return;
          ss.any = true; ss.vol += wt * r;
          if (!b.weight || wt > b.weight.value + EPS) {
            event('weight', wt, b.weight?.value ?? null, si, { reps: r });
            b.weight = mark(si, { value: wt, reps: r });
          }
          const e = epley(wt, r);
          if (!b.e1rm || e > b.e1rm.value + EPS) {
            event('e1rm', e, b.e1rm?.value ?? null, si, { weight: wt, reps: r });
            b.e1rm = mark(si, { value: e, weight: wt, reps: r });
          }
          repsAtWeight(b, wt, r, si, event, mark);
        } else if (kind === 'reps' || kind === 'weighted') {
          if (!(r > 0)) return;
          ss.any = true; ss.reps += r;
          if (!b.reps || r > b.reps.value) {
            event('reps', r, b.reps?.value ?? null, si, { weight: wt || null });
            b.reps = mark(si, { value: r, weight: wt || null });
          }
          if (kind === 'weighted' && wt > 0) {
            if (!b.weight || wt > b.weight.value + EPS) {
              event('weight', wt, b.weight?.value ?? null, si, { reps: r });
              b.weight = mark(si, { value: wt, reps: r });
            }
            repsAtWeight(b, wt, r, si, event, mark);
          }
        } else if (kind === 'time') {
          const t = s.time > 0 ? s.time : 0;
          if (!(t > 0)) return;
          ss.any = true;
          if (!b.time || t > b.time.value) {
            event('time', t, b.time?.value ?? null, si, { weight: wt || null });
            b.time = mark(si, { value: t, weight: wt || null });
          }
        }
      });
    });

    // PRs de sesión
    for (const [exId, ss] of session) {
      if (!ss.any) continue;
      const rec = byEx.get(exId), b = rec.best;
      const sessionEvent = (type, value) => {
        const prev = b[type]?.value ?? null;
        rec.history.push({ type, value, prev, date: w.start, wid: w.id });
        if (prev != null) push(exFlags, `${w.id}:${ss.ei}`, type);
        b[type] = { value, date: w.start, wid: w.id, ei: ss.ei };
      };
      if (ss.kind === 'weight' && ss.vol > 0 && (!b.volume || ss.vol > b.volume.value + EPS)) sessionEvent('volume', ss.vol);
      if ((ss.kind === 'reps' || ss.kind === 'weighted') && ss.reps > 0 && (!b.sessionReps || ss.reps > b.sessionReps.value)) sessionEvent('sessionReps', ss.reps);
    }
  }
  return { byEx, setFlags, exFlags };
}

function repsAtWeight(b, wt, r, si, event, mark) {
  const k = wkey(wt);
  const prev = b.repsAtWeight[k];
  if (!prev) b.repsAtWeight[k] = mark(si, { value: r, weight: wt });
  else if (r > prev.value) {
    event('repsAtWeight', r, prev.value, si, { weight: wt });
    b.repsAtWeight[k] = mark(si, { value: r, weight: wt });
  }
}

/** Número de PRs (series + sesión) de un entreno. */
export function countPRs(records, wid) {
  let n = 0;
  for (const [k, v] of records.setFlags) if (k.startsWith(wid + ':')) n += v.length;
  for (const [k, v] of records.exFlags) if (k.startsWith(wid + ':')) n += v.length;
  return n;
}

/** Lista legible de los PRs conseguidos en un entreno. */
export function prsOfWorkout(records, w) {
  const out = [];
  for (const [exId, rec] of records.byEx) {
    for (const h of rec.history) if (h.wid === w.id && h.prev != null) out.push({ exId, ...h });
  }
  return out;
}
