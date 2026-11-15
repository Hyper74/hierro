// Textos de récords compartidos por Progreso, detalle de ejercicio y resumen.
import { fmtW, fmtVol, fmtSecs, fmtNum } from '../util.js';

/** Valor legible de un récord / evento de récord. */
export function prValueText(p, kind) {
  switch (p.type) {
    case 'weight': return kind === 'weighted' ? `+${fmtW(p.value)}` : fmtW(p.value) + (p.reps ? ` × ${p.reps}` : '');
    case 'e1rm': return fmtW(p.value);
    case 'repsAtWeight': return `${p.value} reps · ${fmtW(p.weight)}`;
    case 'volume': return fmtVol(p.value);
    case 'reps': return `${p.value} reps${p.weight ? ` · +${fmtW(p.weight)}` : ''}`;
    case 'sessionReps': return `${fmtNum(p.value)} reps`;
    case 'time': return fmtSecs(p.value);
    default: return String(p.value);
  }
}

/** Récords "principales" según el tipo de ejercicio, en orden de importancia. */
export const MAIN_PRS = {
  weight: ['weight', 'e1rm', 'volume'],
  reps: ['reps', 'sessionReps'],
  weighted: ['reps', 'weight', 'sessionReps'],
  time: ['time'],
};
