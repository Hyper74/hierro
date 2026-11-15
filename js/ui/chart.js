// ─────────────────────────────────────────────────────────────
// Gráfico de líneas en SVG propio (sin librerías, funciona offline).
// Tocar o arrastrar sobre el gráfico muestra fecha y valor exactos.
// ─────────────────────────────────────────────────────────────
import { fmtShort, fmtDate, esc } from '../util.js';

/**
 * @param {HTMLElement} wrap  contenedor (.chart-wrap)
 * @param {{x:number, y:number}[]} pts  x = fecha (ms), y = valor
 * @param {{fmt:(v:number)=>string, label:string}} opts
 */
export function mountChart(wrap, pts, opts) {
  wrap.innerHTML = '';
  if (!pts.length) {
    wrap.innerHTML = '<div class="chart-empty">Sin datos en este periodo</div>';
    return;
  }
  const W = Math.max(280, wrap.clientWidth || 340), H = 220;
  const padL = 44, padR = 14, padT = 46, padB = 26;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = y1 - y0 || Math.max(1, y1 * 0.1);
  y0 = Math.max(0, y0 - span * 0.15); y1 = y1 + span * 0.15;
  const ticks = niceTicks(y0, y1, 4);
  y0 = Math.min(y0, ticks[0]); y1 = Math.max(y1, ticks.at(-1));
  const X = (x) => padL + ((x - x0) / (x1 - x0)) * (W - padL - padR);
  const Y = (y) => padT + (1 - (y - y0) / (y1 - y0)) * (H - padT - padB);

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${path}L${X(pts.at(-1).x).toFixed(1)},${H - padB}L${X(pts[0].x).toFixed(1)},${H - padB}Z`;
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  const xlabels = pts.length === 1 ? [pts[0].x] : [x0, (x0 + x1) / 2, x1];
  const showDots = pts.length <= 40;

  const maxP = pts.reduce((a, b) => (b.y > a.y ? b : a));
  const aria = `${opts.label}: ${pts.length} sesiones, del ${fmtDate(pts[0].x)} al ${fmtDate(pts.at(-1).x)}. Máximo ${opts.fmt(maxP.y)} el ${fmtDate(maxP.x)}. Último ${opts.fmt(pts.at(-1).y)}.`;

  wrap.innerHTML = `
  <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(aria)}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c6f432" stop-opacity=".28"/><stop offset="1" stop-color="#c6f432" stop-opacity="0"/></linearGradient></defs>
    <g class="grid">${ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${Y(t)}" y2="${Y(t)}"/>`).join('')}</g>
    ${ticks.map((t) => `<text x="${padL - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(opts.fmt(t, true))}</text>`).join('')}
    ${xlabels.map((x, i) => `<text x="${X(x)}" y="${H - 6}" text-anchor="${xlabels.length === 1 ? 'middle' : i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${esc(fmtShort(x))}</text>`).join('')}
    <path d="${area}" fill="url(#${gid})"/>
    <path class="line" d="${path}"/>
    ${showDots ? pts.map((p) => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5"/>`).join('') : ''}
    <line class="cursor" y1="${padT - 6}" y2="${H - padB}" visibility="hidden"/>
    <circle class="hl" r="6" visibility="hidden"/>
  </svg>
  <div class="chart-tip" hidden></div>`;

  const svgEl = wrap.querySelector('svg');
  const tip = wrap.querySelector('.chart-tip');
  const hl = svgEl.querySelector('.hl');
  const cur = svgEl.querySelector('.cursor');

  const pick = (clientX) => {
    const r = svgEl.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const d = Math.abs(X(p.x) - vx); if (d < bd) { bd = d; best = p; } }
    const cx = X(best.x), cy = Y(best.y);
    hl.setAttribute('cx', cx); hl.setAttribute('cy', cy); hl.setAttribute('visibility', 'visible');
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(opts.fmt(best.y))}</b>${esc(fmtDate(best.x))}${best.sub ? `<br><span class="muted">${esc(best.sub)}</span>` : ''}`;
    const px = (cx / W) * r.width;
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(r.width - tw / 2 - 2, Math.max(tw / 2 + 2, px)) + 'px';
  };
  svgEl.addEventListener('pointerdown', (e) => { pick(e.clientX); svgEl.setPointerCapture?.(e.pointerId); });
  svgEl.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') pick(e.clientX); });
  // Mostrar por defecto el último punto
  requestAnimationFrame(() => { const r = svgEl.getBoundingClientRect(); if (r.width) pick(r.left + (X(pts.at(-1).x) / W) * r.width); });
}

function niceTicks(min, max, count) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const start = Math.floor(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}
