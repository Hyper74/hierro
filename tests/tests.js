// ─────────────────────────────────────────────────────────────
// Tests sin herramientas: abre  tests/  en el navegador
// (p. ej. https://TU-USUARIO.github.io/hierro/tests/).
// También se pueden ejecutar con Node:  node tests/run-node.mjs
// ─────────────────────────────────────────────────────────────
import { epley } from '../js/core/oneRM.js';
import { computePlates, perSideSimple, DEFAULT_PLATES } from '../js/core/plates.js';
import { computeRecords } from '../js/core/prs.js';
import { parseCSV, toCSV } from '../js/core/csv.js';
import { parseHevyCSV, parseHevyDate, matchExercises, buildWorkouts, workoutsToHevyCSV, workoutKey } from '../js/core/hevy.js';
import { validateBackup } from '../js/core/backup.js';
import { LIBRARY } from '../data/exercises.js';

const results = [];
let group = '';
const suite = (name) => { group = name; };
function test(name, fn) {
  try { fn(); results.push({ group, name, ok: true }); } catch (e) { results.push({ group, name, ok: false, error: e.message }); }
}
function eq(a, b, msg = '') {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} esperado ${B}, obtenido ${A}`);
}
function near(a, b, tol = 0.01) { if (Math.abs(a - b) > tol) throw new Error(`esperado ≈${b}, obtenido ${a}`); }
function ok(v, msg = 'condición falsa') { if (!v) throw new Error(msg); }

export async function runAll(csvText) {
  results.length = 0;

  // ── 1RM ───────────────────────────────────────────────────
  suite('1RM estimado (Epley)');
  test('100 kg × 10 = 133,33', () => near(epley(100, 10), 133.33));
  test('80 kg × 8 = 101,33', () => near(epley(80, 8), 101.33));
  test('1 repetición = el propio peso', () => eq(epley(120, 1), 120));
  test('54,3 kg × 10 (dato real del CSV) = 72,4', () => near(epley(54.3, 10), 72.4));
  test('sin peso o sin reps = 0', () => { eq(epley(0, 10), 0); eq(epley(50, 0), 0); eq(epley(null, 5), 0); });
  test('más reps con el mismo peso → más 1RM', () => ok(epley(60, 9) > epley(60, 8)));

  // ── Discos ────────────────────────────────────────────────
  suite('Calculadora de discos');
  const inv = DEFAULT_PLATES.kg;
  test('85 kg con barra de 20 → 25 + 5 + 2,5 (menos discos, los grandes primero)', () => { const r = computePlates(85, 20, inv); eq(r.perSide, [25, 5, 2.5]); ok(r.exact); });
  test('85 kg sin discos de 25 → 20 + 10 + 2,5', () => eq(computePlates(85, 20, inv.filter((p) => p.w !== 25)).perSide, [20, 10, 2.5]));
  test('100 kg → 25 + 15', () => eq(computePlates(100, 20, inv).perSide, [25, 15]));
  test('60 kg → 20 por lado', () => eq(computePlates(60, 20, inv).perSide, [20]));
  test('solo la barra (20 kg)', () => { const r = computePlates(20, 20, inv); eq(r.perSide, []); ok(r.exact); });
  test('menos que la barra', () => ok(computePlates(15, 20, inv).belowBar));
  test('barra de 15 kg: 50 kg → 15 + 2,5', () => eq(computePlates(50, 15, inv).perSide, [15, 2.5]));
  test('barra de 10 kg: 30 kg → 10', () => eq(computePlates(30, 10, inv).perSide, [10]));
  test('22,5 kg → 1,25 por lado', () => eq(computePlates(22.5, 20, inv).perSide, [1.25]));
  test('peso imposible (61 kg) → el más cercano', () => { const r = computePlates(61, 20, inv); ok(!r.exact); ok(Math.abs(r.total - 61) <= 1.25 + 1e-9); });
  test('86 kg → 85 (empate: hacia abajo) o 87,5: diferencia ≤ 1,5', () => { const r = computePlates(86, 20, inv); ok(!r.exact); near(Math.abs(r.diff), 1, 0.51); });
  test('respeta los pares disponibles', () => {
    const r = computePlates(100, 20, [{ w: 20, pairs: 1 }, { w: 10, pairs: 1 }, { w: 5, pairs: 2 }]);
    eq(r.perSide, [20, 10, 5, 5]); ok(r.exact);
  });
  test('sin discos de 25: 120 kg → 20 + 20 + 10', () => eq(computePlates(120, 20, inv.map((p) => (p.w === 25 ? { ...p, pairs: 0 } : p))).perSide, [20, 20, 10]));
  test('si no llega, da lo máximo posible', () => { const r = computePlates(500, 20, [{ w: 20, pairs: 1 }]); eq(r.total, 60); ok(!r.exact); });
  test('nunca usa más discos de los que hay', () => {
    for (let t = 20; t <= 300; t += 0.5) {
      const r = computePlates(t, 20, inv);
      for (const p of inv) ok(r.perSide.filter((w) => w === p.w).length <= p.pairs, `demasiados discos de ${p.w} para ${t}`);
      near(r.total, 20 + 2 * r.perSide.reduce((a, b) => a + b, 0), 1e-6);
    }
  });
  test('modo simple (máquina de discos): 27,5 → 13,75 por lado', () => eq(perSideSimple(27.5), 13.75));

  // ── PRs ───────────────────────────────────────────────────
  suite('Detección de récords');
  const D = 86400000;
  const mk = (id, day, sets, exId = 'a') => ({ id, start: day * D, exercises: [{ exId, sets: sets.map(([weight, reps, type = 'normal']) => ({ weight, reps, type, done: true })) }] });
  const kindW = () => 'weight';
  test('el primer día fija marcas pero no marca PR', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8], [50, 7]])], kindW);
    eq(r.setFlags.size, 0); eq(r.exFlags.size, 0);
    eq(r.byEx.get('a').best.weight.value, 50);
  });
  test('más peso → PR de peso y de 1RM', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[55, 8]])], kindW);
    eq(r.setFlags.get('w2:0:0'), ['weight', 'e1rm']);
  });
  test('mismo peso con más reps → PR de reps con ese peso y de 1RM, no de peso', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[50, 10]])], kindW);
    eq(r.setFlags.get('w2:0:0'), ['e1rm', 'repsAtWeight']);
  });
  test('peso nuevo más bajo no es PR de reps con ese peso', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[40, 9]])], kindW);
    eq(r.setFlags.get('w2:0:0'), undefined);
  });
  test('las series de calentamiento no cuentan', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[100, 5, 'warmup'], [50, 8]])], kindW);
    eq(r.setFlags.size, 0); eq(r.byEx.get('a').best.weight.value, 50);
  });
  test('drop set y al fallo sí cuentan', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[60, 5, 'failure']])], kindW);
    ok(r.setFlags.get('w2:0:0').includes('weight'));
  });
  test('PR de volumen por sesión', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8], [50, 8]]), mk('w2', 2, [[50, 8], [50, 8], [50, 8]])], kindW);
    eq(r.exFlags.get('w2:0'), ['volume']); eq(r.byEx.get('a').best.volume.value, 1200);
  });
  test('dos PRs seguidos el mismo día: cada serie supera a la anterior', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[55, 8], [60, 8]])], kindW);
    ok(r.setFlags.get('w2:0:0').includes('weight')); ok(r.setFlags.get('w2:0:1').includes('weight'));
  });
  test('el orden de entrada no importa (se ordena por fecha)', () => {
    const r = computeRecords([mk('w2', 2, [[55, 8]]), mk('w1', 1, [[50, 8]])], kindW);
    ok(r.setFlags.has('w2:0:0')); ok(!r.setFlags.has('w1:0:0'));
  });
  test('peso corporal: PR de repeticiones', () => {
    const r = computeRecords([mk('w1', 1, [[null, 10]]), mk('w2', 2, [[null, 12]])], () => 'reps');
    eq(r.setFlags.get('w2:0:0'), ['reps']);
  });
  test('historial de récords guarda fecha y valor anterior', () => {
    const r = computeRecords([mk('w1', 1, [[50, 8]]), mk('w2', 2, [[55, 8]])], kindW);
    const h = r.byEx.get('a').history.filter((x) => x.type === 'weight');
    eq(h.map((x) => [x.value, x.prev, x.date]), [[50, null, D], [55, 50, 2 * D]]);
  });

  // ── CSV ───────────────────────────────────────────────────
  suite('Lector de CSV');
  test('comillas, comas y saltos de línea dentro de campos', () => eq(parseCSV('"a","b"\n"x, y","dijo ""hola"""\n"l1\nl2",3\n'), [['a', 'b'], ['x, y', 'dijo "hola"'], ['l1\nl2', '3']]));
  test('campos vacíos y CRLF', () => eq(parseCSV('a,b,c\r\n1,,\r\n'), [['a', 'b', 'c'], ['1', '', '']]));
  test('ida y vuelta toCSV → parseCSV', () => eq(parseCSV(toCSV(['t', 'n'], [['Entreno "A", 💪', 5.5], ['x', null]])), [['t', 'n'], ['Entreno "A", 💪', '5.5'], ['x', '']]));

  suite('Fechas de Hevy');
  test('"13 nov 2026, 13:09"', () => eq(parseHevyDate('13 nov 2026, 13:09'), new Date(2026, 10, 13, 13, 9).getTime()));
  test('"8 sep 2026, 07:41" y "31 ago 2026, 22:16"', () => { eq(parseHevyDate('8 sep 2026, 07:41'), new Date(2026, 8, 8, 7, 41).getTime()); eq(parseHevyDate('31 ago 2026, 22:16'), new Date(2026, 7, 31, 22, 16).getTime()); });
  test('variantes: "sept.", inglés "13 Nov 2026, 13:09" y "Nov 13, 2026, 1:09 PM"', () => {
    eq(parseHevyDate('8 sept. 2026, 07:41'), new Date(2026, 8, 8, 7, 41).getTime());
    eq(parseHevyDate('13 Nov 2026, 13:09'), new Date(2026, 10, 13, 13, 9).getTime());
    eq(parseHevyDate('Nov 13, 2026, 1:09 PM'), new Date(2026, 10, 13, 13, 9).getTime());
  });
  test('todos los meses en español', () => 'ene feb mar abr may jun jul ago sep oct nov dic'.split(' ').forEach((m, i) => eq(new Date(parseHevyDate(`1 ${m} 2026, 10:00`)).getMonth(), i)));
  test('fecha inválida → null', () => eq(parseHevyDate('mañana'), null));

  // ── Importador con el CSV real ────────────────────────────
  suite('Importador de Hevy (tu CSV real)');
  if (!csvText) {
    results.push({ group, name: 'No se ha podido cargar tests/workout_data.csv', ok: false, error: 'archivo no disponible' });
    return results;
  }
  const p = parseHevyCSV(csvText);
  const allSets = p.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets));
  test('sin errores de lectura', () => eq(p.errors, []));
  test('418 series', () => { eq(p.rows, 418); eq(allSets.length, 418); });
  test('34 entrenos', () => eq(p.workouts.length, 34));
  test('43 ejercicios distintos', () => eq(p.names.size, 43));
  test('rango de fechas: 24 ago 2026 → 13 nov 2026', () => {
    const s = p.workouts.map((w) => w.start);
    eq(Math.min(...s), new Date(2026, 7, 24, 20, 3).getTime()); eq(Math.max(...s), new Date(2026, 10, 13, 13, 9).getTime());
  });
  const first = p.workouts[0];
  test('primer entreno del archivo: "Upper B", 81 min, 9 ejercicios, 17 series', () => {
    eq(first.title, 'Upper B'); eq((first.end - first.start) / 60000, 81); eq(first.exercises.length, 9); eq(first.exercises.reduce((n, e) => n + e.sets.length, 0), 17);
  });
  test('conserva el orden de los ejercicios', () => eq(first.exercises.slice(0, 3).map((e) => e.name), ['Press de Pecho Iso-Lateral (Máquina)', 'Remo Iso-Lateral', 'Press de Hombros Sentado (Máquina)']));
  test('decimales con punto: 54.3 y 6.95', () => { eq(first.exercises[1].sets[0], { type: 'normal', weight: 54.3, reps: 10, time: null, dist: null, done: true }); ok(allSets.some((s) => s.weight === 6.95)); });
  test('títulos con emoji', () => ok(p.workouts.some((w) => w.title === 'Entrenamiento por la tarde 💪')));
  test('superseries: Halo + Flexión Lateral agrupados', () => { const [a, b] = first.exercises.slice(-2); eq([a.name, a.supersetId, b.supersetId], ['Halo con pesa rusa', 'ss1', 'ss1']); eq(first.exercises[0].supersetId, null); });
  test('notas de ejercicio', () => {
    const w = p.workouts.find((x) => x.title === 'Lower B' && new Date(x.start).getDate() === 1);
    eq(w.exercises[0].notes, 'empezar izq y bajar a 17.5');
    ok(p.workouts.some((x) => x.exercises.some((e) => e.notes === 'Leg to face -> Leg Raise')));
  });
  test('series sin peso (peso corporal): 78', () => eq(allSets.filter((s) => s.weight == null).length, 78));
  test('series por tiempo: plank de 10 s sin reps', () => {
    const e = p.workouts.flatMap((w) => w.exercises).find((x) => x.name === 'Reverse Copenhagen Plank');
    eq(e.sets[0], { type: 'normal', weight: null, reps: null, time: 10, dist: null, done: true });
  });
  test('tipos de ejercicio deducidos', () => {
    eq(p.names.get('Reverse Copenhagen Plank').kind, 'time');
    eq(p.names.get('Dominada (Con Peso Añadido)').kind, 'weighted');
    eq(p.names.get('Tibiales Raise').kind, 'reps');
    eq(p.names.get('Curl Martillo (Cable)').kind, 'weight');
  });
  test('material deducido', () => {
    eq(p.names.get('Press de Hombros (Máquina de Discos)').equipment, 'discos');
    eq(p.names.get('Katana Extension').equipment, 'otro');
    eq(p.names.get('Single Arm High to Low').muscle, 'Pecho');
  });
  test('tipos de serie de Hevy: warmup, dropset, failure', () => {
    const t = parseHevyCSV('"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"\n' +
      ['warmup', 'normal', 'dropset', 'failure'].map((ty, i) => `"T","1 ene 2026, 10:00","1 ene 2026, 11:00","","Bench Press (Barbell)",,"",${i},"${ty}",60,5,,,`).join('\n'));
    eq(t.workouts[0].exercises[0].sets.map((s) => s.type), ['warmup', 'normal', 'drop', 'failure']);
  });
  test('CSV en libras (weight_lbs) se convierte a kg', () => {
    const t = parseHevyCSV('"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"\n"T","Jan 1, 2026, 10:00 AM","Jan 1, 2026, 11:00 AM","","Squat (Barbell)",,"",0,"normal",225,5,,,');
    near(t.workouts[0].exercises[0].sets[0].weight, 102.058, 0.001);
  });
  test('archivo que no es de Hevy → error claro', () => ok(parseHevyCSV('a,b\n1,2').errors[0].includes('No parece un CSV de Hevy')));

  const m = matchExercises([...p.names.keys()], LIBRARY);
  const newOnes = [...m].filter(([, r]) => r.quality === 'new').map(([n]) => n).sort();
  test('emparejamiento: 36 coinciden con la biblioteca, 7 son nuevos', () => {
    eq([...m.values()].filter((r) => r.quality === 'exact').length, 36);
    eq(newOnes, ['Katana Extension', 'Kettlebell Around the World', 'Reverse Copenhagen Plank', 'Single Arm High to Low', 'Single Leg Seated Squat', 'Tibiales Raise', 'Windshield Wiper']);
  });
  test('ignora mayúsculas, tildes y paréntesis: "Curl predicador (máquina)", "Press declinado máquina"', () => {
    eq(m.get('Curl predicador (máquina)').exId, 'lib-curl-predicador-maquina'); eq(m.get('Press declinado máquina').exId, 'lib-press-declinado-maquina');
  });
  test('nombres de Hevy en inglés se emparejan por alias', () => {
    const r = matchExercises(['Bench Press (Barbell)', 'Hammer Curl (Cable)', 'Lat Pulldown (Cable)'], LIBRARY);
    eq([...r.values()].map((x) => x.exId), ['lib-press-de-banca-barra', 'lib-curl-martillo-cable', 'lib-jalon-al-pecho-cable']);
  });
  test('no confunde ejercicios parecidos de distinto material', () => eq(matchExercises(['Curl Martillo (Barra)'], LIBRARY).get('Curl Martillo (Barra)').quality, 'new'));

  const idOf = new Map([...p.names.keys()].map((n) => [n, m.get(n).exId || 'new-' + n]));
  let c = 0;
  const built = buildWorkouts(p.workouts, idOf, () => 'w' + c++);
  test('construye 34 entrenos con todas las series', () => { eq(built.length, 34); eq(built.flatMap((w) => w.exercises.flatMap((e) => e.sets)).length, 418); ok(built.every((w) => w.exercises.every((e) => e.exId))); });
  test('detección de duplicados: reimportar el mismo archivo no añade nada', () => {
    const keys = new Set(built.map((w) => w.importKey));
    eq(parseHevyCSV(csvText).workouts.filter((w) => !keys.has(w.key)).length, 0);
    eq(built[0].importKey, workoutKey('Upper B', new Date(2026, 10, 13, 13, 9).getTime()));
  });
  test('exportar a CSV y volver a importar da los mismos datos', () => {
    const nameOf = (id) => [...idOf].find(([, v]) => v === id)[0];
    const again = parseHevyCSV(workoutsToHevyCSV(built, nameOf));
    eq(again.errors, []); eq(again.workouts.length, 34);
    eq(again.workouts.map((w) => [w.title, w.start, w.exercises.map((e) => [e.name, e.notes, e.sets])]), p.workouts.map((w) => [w.title, w.start, w.exercises.map((e) => [e.name, e.notes, e.sets])]));
  });
  test('PRs con todo el historial: Press de Pecho Inclinado máx 65 kg, 1RM ≈ 82,33', () => {
    const kind = (id) => (id.startsWith('new-') ? p.names.get(id.slice(4)).kind : LIBRARY.find((e) => e.id === id).kind);
    const rec = computeRecords(built, kind);
    const b = rec.byEx.get('lib-press-de-pecho-inclinado-maquina').best;
    eq(b.weight.value, 65); near(b.e1rm.value, 82.33); eq(new Date(b.weight.date).getDate(), 26);
    eq(rec.byEx.get('lib-dominada-con-peso-anadido').best.reps.value, 11);
    ok(rec.setFlags.size > 20, 'debería haber PRs en el historial');
  });

  suite('Copia de seguridad');
  test('copia válida', () => { const v = validateBackup(JSON.stringify({ app: 'hierro', exercises: [{ id: 'a', name: 'A' }], routines: [], workouts: built })); ok(v.ok); eq(v.summary.workouts, 34); eq(v.summary.sets, 418); });
  test('archivo ajeno o dañado se rechaza', () => { ok(!validateBackup('{"foo":1}').ok); ok(!validateBackup('no es json').ok); ok(!validateBackup(JSON.stringify({ app: 'hierro', exercises: [], routines: [] })).ok); });

  return results;
}
