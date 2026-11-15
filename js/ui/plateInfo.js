// Línea de "por lado" que aparece bajo la serie activa.
import { S } from '../store.js';
import { computePlates, perSideSimple } from '../core/plates.js';
import { toDisp, fmtNum, getUnit } from '../util.js';
import { plateBarSVG, platesText } from './plateBar.js';

/** HTML con la información de discos para un ejercicio y un peso (kg). */
export function plateInfoHTML(ex, weightKg) {
  if (!ex || !(weightKg > 0)) return '';
  const u = getUnit();
  const w = toDisp(weightKg);
  if (ex.equipment === 'barra') {
    const bar = S.settings.bar[u];
    const r = computePlates(w, bar, S.settings.plates[u]);
    if (r.belowBar) return `Menos que la barra (${fmtNum(bar)} ${u})`;
    let t = `Por lado: <b>${platesText(r.perSide)}</b>`;
    if (!r.exact) t += ` · <span class="accent">más cercano: ${fmtNum(r.total)} ${u}</span>`;
    return t + plateBarSVG(r.perSide, { height: 56 });
  }
  if (ex.perSide) return `Por lado: <b>${fmtNum(perSideSimple(w))} ${u}</b>`;
  return '';
}
