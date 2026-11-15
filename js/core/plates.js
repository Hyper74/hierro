// ─────────────────────────────────────────────────────────────
// Calculadora de discos por lado.
// Usa programación dinámica (mochila acotada) en centésimas para:
//   1. respetar cuántos pares de cada disco hay en el gimnasio,
//   2. encontrar el peso posible más cercano si el exacto no existe,
//   3. usar el menor número de discos (y los más grandes en empate).
// ─────────────────────────────────────────────────────────────

const SCALE = 100; // trabajamos en centésimas para evitar errores de coma flotante

/**
 * @param {number} target   peso total deseado (barra incluida)
 * @param {number} bar      peso de la barra
 * @param {{w:number, pairs:number}[]} inventory discos disponibles (pares)
 * @returns {{
 *   target:number, bar:number, exact:boolean, belowBar:boolean,
 *   total:number, perSide:number[], perSideWeight:number, diff:number
 * }}
 */
export function computePlates(target, bar, inventory) {
  const base = { target, bar, perSide: [], perSideWeight: 0 };
  if (!(target > 0)) return { ...base, exact: false, belowBar: true, total: bar, diff: bar - (target || 0) };
  if (target < bar - 1e-9) return { ...base, exact: false, belowBar: true, total: bar, diff: bar - target };

  // Lista de discos individuales por lado (un par = un disco por lado)
  const plates = [];
  for (const { w, pairs } of [...inventory].sort((a, b) => b.w - a.w)) {
    for (let i = 0; i < (pairs || 0); i++) if (w > 0) plates.push(Math.round(w * SCALE));
  }
  const goal = Math.round(((target - bar) / 2) * SCALE);
  const maxSum = plates.reduce((a, b) => a + b, 0);
  const limit = Math.min(maxSum, goal + (plates[0] || 0)); // no hace falta ir más allá del objetivo + el disco mayor

  // best[s] = número mínimo de discos para sumar s; prev para reconstruir
  const INF = 1e9;
  const best = new Array(limit + 1).fill(INF);
  const choice = new Array(limit + 1).fill(null);
  best[0] = 0;
  choice[0] = [];
  for (const p of plates) {
    for (let s = limit; s >= p; s--) {
      if (best[s - p] === INF) continue;
      const cand = best[s - p] + 1;
      const candList = [...choice[s - p], p];
      if (cand < best[s] || (cand === best[s] && lexBigger(candList, choice[s]))) {
        best[s] = cand;
        choice[s] = candList;
      }
    }
  }

  // Suma alcanzable más cercana al objetivo (en empate, la de abajo)
  let bestSum = 0, bestDiff = Infinity;
  for (let s = 0; s <= limit; s++) {
    if (best[s] === INF) continue;
    const d = Math.abs(s - goal);
    if (d < bestDiff || (d === bestDiff && s < bestSum)) { bestDiff = d; bestSum = s; }
  }
  const perSide = [...choice[bestSum]].sort((a, b) => b - a).map((x) => x / SCALE);
  const perSideWeight = bestSum / SCALE;
  const total = round2(bar + perSideWeight * 2);
  return { ...base, exact: bestSum === goal, belowBar: false, total, perSide, perSideWeight, diff: round2(total - target) };
}

function lexBigger(a, b) {
  if (!b) return true;
  const x = [...a].sort((p, q) => q - p), y = [...b].sort((p, q) => q - p);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
const round2 = (v) => Math.round(v * 100) / 100;

/** Modo simple (máquinas de discos): el peso apuntado dividido entre dos. */
export const perSideSimple = (total) => (total > 0 ? total / 2 : 0);

/** Valores por defecto (pares de cada disco). */
export const DEFAULT_PLATES = {
  kg: [{ w: 25, pairs: 4 }, { w: 20, pairs: 2 }, { w: 15, pairs: 2 }, { w: 10, pairs: 2 }, { w: 5, pairs: 2 }, { w: 2.5, pairs: 2 }, { w: 1.25, pairs: 2 }],
  lb: [{ w: 45, pairs: 4 }, { w: 35, pairs: 2 }, { w: 25, pairs: 2 }, { w: 10, pairs: 2 }, { w: 5, pairs: 2 }, { w: 2.5, pairs: 2 }],
};
export const BAR_OPTIONS = { kg: [20, 15, 10], lb: [45, 35, 25] };
