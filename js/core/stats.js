// Estadísticas derivadas del historial (funciones puras).
import { epley } from './oneRM.js';
import { isWorking } from './prs.js';

/** Resumen de un entreno: volumen, series, duración. */
export function workoutStats(w) {
  let volume = 0, sets = 0, reps = 0;
  for (const e of w.exercises) for (const s of e.sets) {
    if (!isWorking(s)) continue;
    sets++;
    if (s.reps > 0) reps += s.reps;
    if (s.weight > 0 && s.reps > 0) volume += s.weight * s.reps;
  }
  return { volume, sets, reps, duration: Math.max(0, (w.end || w.start) - w.start) };
}

/**
 * Sesiones de un ejercicio en orden cronológico ascendente.
 * Cada sesión: { wid, date, title, sets (todas), working, maxWeight, e1rm, volume, maxReps, totalReps, maxTime }
 */
export function sessionsFor(exId, workouts) {
  const out = [];
  for (const w of workouts) {
    const blocks = w.exercises.filter((e) => e.exId === exId);
    if (!blocks.length) continue;
    const sets = blocks.flatMap((b) => b.sets.filter((s) => s.done !== false));
    if (!sets.length) continue;
    const working = sets.filter(isWorking);
    const s = { wid: w.id, date: w.start, title: w.title, sets, working, maxWeight: 0, e1rm: 0, volume: 0, maxReps: 0, totalReps: 0, maxTime: 0, best: null };
    for (const x of working) {
      const wt = x.weight > 0 ? x.weight : 0, r = x.reps > 0 ? x.reps : 0;
      if (wt > s.maxWeight) s.maxWeight = wt;
      if (r > s.maxReps) s.maxReps = r;
      s.totalReps += r;
      if (x.time > s.maxTime) s.maxTime = x.time;
      if (wt && r) {
        s.volume += wt * r;
        const e = epley(wt, r);
        if (e > s.e1rm) { s.e1rm = e; s.best = x; }
      }
    }
    if (!s.best) s.best = working.reduce((a, b) => ((b.reps || 0) > (a?.reps || 0) ? b : a), null);
    out.push(s);
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Última sesión de un ejercicio (opcionalmente excluyendo un entreno). */
export function lastSession(exId, workouts, excludeWid = null) {
  let best = null;
  for (const w of workouts) {
    if (w.id === excludeWid) continue;
    if (best && w.start <= best.date) continue;
    const blocks = w.exercises.filter((e) => e.exId === exId);
    const sets = blocks.flatMap((b) => b.sets.filter((s) => s.done !== false));
    if (sets.length) best = { date: w.start, wid: w.id, sets };
  }
  return best;
}

/** Mejor serie (para "Última vez: 80 kg × 8"): la de mayor 1RM; si no hay peso, la de más reps. */
export function topSet(sets) {
  const ws = sets.filter(isWorking);
  const pool = ws.length ? ws : sets;
  let best = null, score = -1;
  for (const s of pool) {
    const sc = s.weight > 0 && s.reps > 0 ? epley(s.weight, s.reps) * 1000 : (s.reps || 0) + (s.time || 0);
    if (sc > score) { score = sc; best = s; }
  }
  return best;
}
