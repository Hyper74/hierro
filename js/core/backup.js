// Validación de copias de seguridad (JSON) — función pura para poder probarla.

/** Devuelve {ok, error?, data?, summary?}. */
export function validateBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'El archivo no es un JSON válido.' }; }
  if (!data || data.app !== 'hierro') return { ok: false, error: 'No es una copia de seguridad de esta app.' };
  for (const k of ['exercises', 'routines', 'workouts']) {
    if (!Array.isArray(data[k])) return { ok: false, error: `Copia incompleta: falta "${k}".` };
  }
  const bad = data.workouts.find((w) => !w.id || !Number.isFinite(w.start) || !Array.isArray(w.exercises));
  if (bad) return { ok: false, error: 'La copia contiene entrenos dañados.' };
  if (data.exercises.some((e) => !e.id || !e.name)) return { ok: false, error: 'La copia contiene ejercicios dañados.' };
  const sets = data.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + (e.sets?.length || 0), 0), 0);
  return {
    ok: true, data,
    summary: { workouts: data.workouts.length, routines: data.routines.length, exercises: data.exercises.length, sets, exportedAt: data.exportedAt || null },
  };
}
