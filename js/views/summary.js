// Resumen al terminar un entreno: duración, volumen, series y PRs.
import { html, fmtDur, fmtVol, fmtDay, fmtTime } from '../util.js';
import { records, exName, kindOf, getEx } from '../store.js';
import { workoutStats } from '../core/stats.js';
import { prsOfWorkout, PR_LABEL } from '../core/prs.js';
import { icon } from '../ui/icons.js';
import { openSheet } from '../ui/sheet.js';
import { saveAsRoutine } from '../actions.js';
import { go } from '../router.js';
import { prValueText } from './records.js';
import { topSet } from '../core/stats.js';
import { setText } from './workout.js';

export function showSummary(w) {
  const st = workoutStats(w);
  const prs = prsOfWorkout(records(), w);
  const s = openSheet({
    full: true,
    label: 'Resumen del entreno',
    body: html`
      <div class="summary-hero">
        <div class="medal">${icon(prs.length ? 'trophy' : 'check')}</div>
        <h1>${prs.length ? '¡Entreno con récords!' : '¡Entreno completado!'}</h1>
        <p class="muted" style="margin:6px 0 0">${w.title} · ${fmtDay(w.start)}, ${fmtTime(w.start)}</p>
      </div>
      <div class="stat-grid">
        <div class="card"><b>${fmtDur(st.duration)}</b><span>Duración</span></div>
        <div class="card"><b>${fmtVol(st.volume)}</b><span>Volumen total</span></div>
        <div class="card"><b>${st.sets}</b><span>Series hechas</span></div>
        <div class="card"><b class="${prs.length ? 'accent' : ''}">${prs.length}</b><span>Récords (PRs)</span></div>
      </div>
      ${prs.length ? html`<div class="section-label">Récords conseguidos</div>
        <div class="list">${prs.map((p) => html`<div class="row"><span class="trophy">${icon('trophy')}</span>
          <div class="grow"><div class="title">${exName(p.exId)}</div><div class="sub">${PR_LABEL[p.type]}</div></div>
          <b class="num accent">${prValueText(p, kindOf(p.exId))}</b></div>`)}</div>` : ''}
      <div class="section-label">Ejercicios</div>
      <div class="list">${w.exercises.map((e) => {
        const ts = topSet(e.sets);
        return html`<div class="row"><div class="grow"><div class="title">${getEx(e.exId)?.name || 'Ejercicio'}</div>
          <div class="sub">${e.sets.length} serie${e.sets.length > 1 ? 's' : ''}${ts ? ' · mejor: ' + setText(ts, kindOf(e.exId)) : ''}</div></div></div>`;
      })}</div>
      <div style="margin-top:22px;display:grid;gap:10px">
        <button class="btn btn-primary btn-lg btn-block" data-act="ok">Hecho</button>
        <button class="btn btn-block" data-act="detail">${icon('history')}Ver en el historial</button>
        ${w.routineId ? '' : html`<button class="btn btn-ghost btn-block" data-act="routine">${icon('copy')}Guardar como rutina</button>`}
      </div>`,
  });
  s.body.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'ok') s.close();
    if (a === 'detail') { s.close(); go(`#/historial/${w.id}`); }
    if (a === 'routine') { const r = await saveAsRoutine(w); if (r) e.target.closest('[data-act]').remove(); }
  });
  if (prs.length) confetti();
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('div');
  c.className = 'confetti';
  c.setAttribute('aria-hidden', 'true');
  const colors = ['#c6f432', '#e8ff9a', '#ffffff', '#8fbf1a'];
  c.innerHTML = Array.from({ length: 36 }, () => {
    const l = Math.random() * 100, d = 1.6 + Math.random() * 1.6, dl = Math.random() * 0.5;
    return `<i style="left:${l}%;background:${colors[Math.floor(Math.random() * 4)]};animation-duration:${d}s;animation-delay:${dl}s"></i>`;
  }).join('');
  document.body.append(c);
  setTimeout(() => c.remove(), 3800);
}
