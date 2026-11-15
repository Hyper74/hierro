// Dibujo de la barra con los discos (colores y tamaños aproximados a los reales).
import { fmtNum, getUnit } from '../util.js';

// Altura relativa (diámetro), grosor y color por disco en kg
const KG = {
  25: { h: 1, t: 15, c: '#e5484d' },
  20: { h: 1, t: 13, c: '#3b82f6' },
  15: { h: .92, t: 11, c: '#f5c518' },
  10: { h: .8, t: 9, c: '#30a46c' },
  5: { h: .62, t: 8, c: '#ececec' },
  2.5: { h: .5, t: 7, c: '#e5484d' },
  1.25: { h: .42, t: 6, c: '#a0a0a8' },
};
// Discos en libras: se dibujan como su equivalente aproximado en kg
const LB = { 45: 20, 35: 15, 25: 10, 10: 5, 5: 2.5, 2.5: 1.25 };
function style(w) {
  const k = getUnit() === 'lb' ? (LB[w] ?? nearest(w * 0.4536)) : (KG[w] ? w : nearest(w));
  return KG[k];
}
function nearest(w) {
  return Object.keys(KG).map(Number).reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));
}

/** SVG de la barra completa (ambos lados). */
export function plateBarSVG(perSide, { height = 110 } = {}) {
  const W = 340, H = height, mid = H / 2, maxH = H - 10;
  const sleeve = 118; // longitud de cada manga
  const center = W / 2;
  const collar = 70;   // distancia del centro al tope interior
  let parts = '';
  // Barra central y mangas
  parts += `<rect x="${center - collar}" y="${mid - 3}" width="${collar * 2}" height="6" rx="3" fill="#6b6b72"/>`;
  parts += `<rect x="${center - collar - 4}" y="${mid - 9}" width="5" height="18" rx="1.5" fill="#8a8a92"/>`;
  parts += `<rect x="${center + collar - 1}" y="${mid - 9}" width="5" height="18" rx="1.5" fill="#8a8a92"/>`;
  parts += `<rect x="${center - collar - 4 - sleeve}" y="${mid - 5}" width="${sleeve}" height="10" rx="3" fill="#8a8a92"/>`;
  parts += `<rect x="${center + collar + 4}" y="${mid - 5}" width="${sleeve}" height="10" rx="3" fill="#8a8a92"/>`;
  let off = 0;
  for (const w of perSide) {
    const s = style(w);
    const h = maxH * s.h, t = s.t;
    const xr = center + collar + 4 + off, xl = center - collar - 4 - off - t;
    const txt = fmtNum(w);
    for (const x of [xl, xr]) {
      parts += `<rect x="${x}" y="${mid - h / 2}" width="${t}" height="${h}" rx="2.5" fill="${s.c}"/>`;
    }
    if (t >= 9) parts += `<text x="${xr + t / 2}" y="${mid + 4}" text-anchor="middle" font-size="9" font-weight="700" fill="${s.c === '#ececec' || s.c === '#f5c518' ? '#000' : '#fff'}" transform="rotate(-90 ${xr + t / 2} ${mid})">${txt}</text>`;
    off += t + 1.5;
  }
  return `<svg class="platebar" viewBox="0 0 ${W} ${H}" role="img" aria-label="Por lado: ${perSide.map((w) => fmtNum(w)).join(' + ') || 'sin discos'}">${parts}</svg>`;
}

/** "20 + 10 + 2,5" */
export const platesText = (perSide) => (perSide.length ? perSide.map((w) => fmtNum(w)).join(' + ') : 'Solo la barra');
