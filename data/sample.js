// Datos de ejemplo (desactivables en Ajustes). Todo lo generado lleva sample:true.
// Generador determinista para que siempre salga lo mismo.

function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

const R = (n) => 'lib-' + n;
const ROUTINES = [
  { name: 'Torso A (ejemplo)', items: [
    ['press-de-banca-barra', 4, 6, 8, 150, 60], ['remo-con-barra', 3, 8, 10, 120, 50],
    ['press-de-hombros-mancuerna', 3, 8, 12, 90, 18], ['jalon-al-pecho-cable', 3, 10, 12, 90, 50],
    ['curl-martillo-cable', 3, 10, 12, 60, 18, 'a'], ['jalon-de-triceps-en-polea', 3, 10, 12, 60, 20, 'a'],
  ] },
  { name: 'Pierna (ejemplo)', items: [
    ['sentadilla-barra', 4, 5, 8, 180, 80], ['peso-muerto-rumano-barra', 3, 8, 10, 150, 70],
    ['prensa-de-piernas-maquina', 3, 10, 12, 120, 140], ['curl-de-pierna-sentado', 3, 10, 12, 75, 45],
    ['elevacion-de-gemelos-de-pie-maquina', 3, 12, 15, 60, 50], ['plancha', 3, null, null, 60, 45],
  ] },
  { name: 'Torso B (ejemplo)', items: [
    ['press-militar-barra', 4, 6, 8, 150, 42.5], ['dominada', 3, 6, 10, 120, 0],
    ['press-de-banca-inclinado-mancuerna', 3, 8, 10, 120, 26], ['remo-sentado-cable', 3, 10, 12, 90, 55],
    ['elevacion-lateral-mancuerna', 3, 12, 15, 60, 10], ['fondos', 3, 8, 12, 90, 0],
  ] },
];

export function generateSample(exists) {
  const rand = rng(42);
  const routines = ROUTINES.map((r, i) => ({
    id: 'sample-r' + i, name: r.name, order: 100 + i, sample: true,
    items: r.items.filter(([id]) => exists(R(id))).map(([id, sets, mn, mx, rest, , ss]) => ({
      exId: R(id), sets, repsMin: mn, repsMax: mx, rest: null, supersetId: ss ? 'ss-' + ss : null,
    })),
  }));
  const workouts = [];
  const now = new Date(); now.setHours(18, 0, 0, 0);
  const weeks = 10;
  let k = 0;
  for (let wk = weeks; wk >= 0; wk--) {
    for (const [di, ri] of [[0, 0], [2, 1], [4, 2]]) {
      const day = new Date(now.getTime() - (wk * 7 + (6 - di) - 1) * 86400000);
      if (day.getTime() > Date.now() - 86400000) continue;
      const start = day.getTime() + Math.floor(rand() * 90) * 60000;
      const r = ROUTINES[ri];
      const progress = (weeks - wk) / weeks;
      const exs = r.items.filter(([id]) => exists(R(id))).map(([id, sets, mn, mx, , base, ss]) => {
        const out = [];
        if (base > 40 && id.includes('barra')) out.push({ type: 'warmup', weight: Math.round(base * 0.5 / 2.5) * 2.5, reps: 10, time: null, done: true });
        for (let s = 0; s < sets; s++) {
          if (mn == null) { out.push({ type: 'normal', weight: null, reps: null, time: 30 + Math.round(progress * 30) + Math.floor(rand() * 6) * 5, done: true }); continue; }
          const w = base ? Math.round((base * (1 + progress * 0.14) + (rand() - 0.5) * 2) / 2.5) * 2.5 : null;
          const reps = Math.max(mn - 1, Math.min(mx + 1, Math.round(mx - s - rand() * 2 + progress * 2)));
          out.push({ type: 'normal', weight: w, reps, time: null, done: true });
        }
        return { exId: R(id), notes: '', supersetId: ss ? 'ss-' + ss : null, sets: out };
      });
      workouts.push({ id: 'sample-w' + k++, title: r.name.replace(' (ejemplo)', ''), start, end: start + (50 + Math.floor(rand() * 30)) * 60000, notes: '', source: 'sample', sample: true, exercises: exs });
    }
  }
  return { routines, workouts };
}
