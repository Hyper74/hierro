// Acciones compartidas entre pantallas.
import { saveRoutine, S } from './store.js';
import { promptSheet, toast } from './ui/sheet.js';

/** Crea una rutina a partir de un entreno (series hechas como objetivo). */
export async function saveAsRoutine(w) {
  const name = await promptSheet({ title: 'Guardar como rutina', label: 'Nombre de la rutina', value: w.title || '', ok: 'Crear' });
  if (name == null) return null;
  const items = w.exercises.map((e) => {
    const work = e.sets.filter((s) => s.type !== 'warmup');
    const reps = work.map((s) => s.reps).filter((r) => r > 0);
    return {
      exId: e.exId,
      sets: Math.max(1, e.sets.length),
      repsMin: reps.length ? Math.min(...reps) : null,
      repsMax: reps.length ? Math.max(...reps) : null,
      rest: e.rest ?? null,
      supersetId: e.supersetId || null,
    };
  });
  const r = await saveRoutine({ name: name.trim() || 'Rutina', items });
  toast(`Rutina “${r.name}” creada`);
  return r;
}

/** Título por defecto según la hora. */
export function defaultTitle(ts = Date.now()) {
  const h = new Date(ts).getHours();
  return h < 12 ? 'Entreno de mañana' : h < 20 ? 'Entreno de tarde' : 'Entreno de noche';
}

export const hasData = () => S.workouts.length > 0;
