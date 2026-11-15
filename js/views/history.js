// Pestaña "Historial" y detalle de un entreno.
import { html, str, fmtDur, fmtVol, fmtDay, fmtTime, fmtMonth, fmtDate } from '../util.js';
import { S, getWorkout, exName, kindOf, records, deleteWorkout, getEx } from '../store.js';
import { workoutStats } from '../core/stats.js';
import { countPRs, PR_LABEL, isWorking } from '../core/prs.js';
import { epley } from '../core/oneRM.js';
import { icon } from '../ui/icons.js';
import { navBar, emptyState, prBadge } from '../ui/components.js';
import { actionSheet, confirmSheet, toast } from '../ui/sheet.js';
import { editWorkout, startWorkout, setText } from './workout.js';
import { saveAsRoutine } from '../actions.js';
import { back } from '../router.js';

const PAGE = 40;
let shown = PAGE;

export const historyView = {
  render(page) {
    const rec = records();
    const list = S.workouts.slice(0, shown);
    let lastMonth = '';
    page.innerHTML = str(html`
      ${navBar({ title: 'Historial' })}
      <div class="scroll">
        <h1 class="large-title">Historial</h1>
        ${S.workouts.length ? html`<p class="subtitle">${S.workouts.length} entreno${S.workouts.length > 1 ? 's' : ''} · desde ${fmtDate(S.workouts.at(-1).start)}</p>` : ''}
        ${!S.workouts.length ? html`<div class="card">${emptyState({
          art: 'history', title: 'Sin entrenos todavía',
          text: 'Cuando termines tu primer entreno aparecerá aquí. También puedes traer tu historial de Hevy.',
          actions: html`<a class="btn btn-primary btn-block" href="#/ajustes/importar">${icon('download')}Importar desde Hevy</a>`,
        })}</div>` : ''}
        ${list.map((w) => {
          const m = fmtMonth(w.start);
          const head = m !== lastMonth ? html`<div class="month">${m}</div>` : '';
          lastMonth = m;
          const st = workoutStats(w);
          const n = countPRs(rec, w.id);
          const lines = w.exercises.slice(0, 4).map((e) => `${e.sets.length} × ${exName(e.exId)}`);
          return html`${head}
          <a class="card card-tap wcard" href="#/historial/${w.id}">
            <h3><span class="grow ellipsis" style="flex:1">${w.title}</span>${n ? html`<span class="pr-badge">${icon('trophy')}${n}</span>` : ''}</h3>
            <div class="date">${fmtDay(w.start)} · ${fmtTime(w.start)}</div>
            <div class="stats-row">
              <div class="stat"><b>${fmtDur(st.duration)}</b><span>Duración</span></div>
              <div class="stat"><b>${fmtVol(st.volume)}</b><span>Volumen</span></div>
              <div class="stat"><b>${st.sets}</b><span>Series</span></div>
            </div>
            <div class="lines">${lines.map((l) => html`<div>${l}</div>`)}${w.exercises.length > 4 ? html`<div>y ${w.exercises.length - 4} más…</div>` : ''}</div>
          </a>`;
        })}
        ${S.workouts.length > shown ? html`<button class="btn btn-block" style="margin-top:14px" data-act="more">Ver más</button>` : ''}
      </div>`);
    page.onclick = (e) => {
      if (e.target.closest('[data-act=more]')) { shown += PAGE; historyView.render(page); }
    };
  },
};

const T_LABEL = { warmup: 'C', drop: 'D', failure: 'F' };

export const workoutDetailView = {
  render(page, { id }) {
    const w = getWorkout(id);
    if (!w) {
      page.innerHTML = str(html`${navBar({ title: 'Entreno', back: true, always: true })}<div class="scroll"><p class="muted" style="text-align:center;margin-top:40px">Este entreno ya no existe.</p></div>`);
      return;
    }
    const rec = records();
    const st = workoutStats(w);
    const nPR = countPRs(rec, w.id);
    const letters = new Map();
    w.exercises.forEach((e) => { if (e.supersetId && !letters.has(e.supersetId)) letters.set(e.supersetId, String.fromCharCode(65 + letters.size)); });

    page.innerHTML = str(html`
      ${navBar({ title: w.title, back: 'Historial', right: html`<button class="nav-btn" data-act="menu" aria-label="Opciones">${icon('more')}</button>` })}
      <div class="scroll">
        <h1 class="large-title" style="margin-bottom:4px">${w.title}</h1>
        <p class="muted" style="margin:0 0 14px">${fmtDay(w.start)} · ${fmtTime(w.start)}–${fmtTime(w.end || w.start)}${w.source === 'hevy' ? ' · importado de Hevy' : ''}</p>
        <div class="stat-grid">
          <div class="card"><b>${fmtDur(st.duration)}</b><span>Duración</span></div>
          <div class="card"><b>${fmtVol(st.volume)}</b><span>Volumen</span></div>
          <div class="card"><b>${st.sets}</b><span>Series</span></div>
          <div class="card"><b class="${nPR ? 'accent' : ''}">${nPR}</b><span>PRs</span></div>
        </div>
        ${w.notes ? html`<div class="card" style="margin-top:10px">${icon('note', 'style="width:18px;height:18px;vertical-align:-3px;color:var(--text-2)"')} ${w.notes}</div>` : ''}
        ${w.exercises.map((e, ei) => {
          const kind = kindOf(e.exId);
          const exFl = rec.exFlags.get(`${w.id}:${ei}`) || [];
          let n = 0;
          return html`<div class="card detail-ex ${e.supersetId ? 'ss' : ''}" style="${e.supersetId ? 'border-left:4px solid var(--accent)' : ''}">
            ${e.supersetId && w.exercises[ei - 1]?.supersetId !== e.supersetId ? html`<div class="ss-tag">Superserie ${letters.get(e.supersetId)}</div>` : ''}
            <a href="#/progreso/${e.exId}"><h3>${getEx(e.exId)?.name || 'Ejercicio eliminado'} ${icon('chev', 'style="width:14px;height:14px;vertical-align:-2px"')}</h3></a>
            ${e.notes ? html`<div class="note">${e.notes}</div>` : ''}
            ${exFl.length ? html`<div style="margin-bottom:6px">${prBadge()} <span class="small accent">${exFl.map((t) => PR_LABEL[t]).join(' · ')}</span></div>` : ''}
            ${e.sets.map((s, si) => {
              if (s.type === 'normal') n++;
              const fl = rec.setFlags.get(`${w.id}:${ei}:${si}`);
              const e1 = kind === 'weight' && isWorking(s) && s.weight > 0 && s.reps > 0 ? epley(s.weight, s.reps) : 0;
              return html`<div class="dset"><span class="t ${s.type}">${T_LABEL[s.type] || n}</span>
                <span>${setText(s, kind)} ${fl ? prBadge(fl.map((t) => PR_LABEL[t]).join(', ')) : ''}</span>
                <span class="e">${e1 ? `1RM ${Math.round(e1)}` : ''}</span></div>`;
            })}
          </div>`;
        })}
      </div>`);

    page.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-act=menu]')) return;
      const r = await actionSheet([
        { id: 'edit', label: 'Editar entreno', icon: 'edit' },
        { id: 'repeat', label: 'Repetir este entreno', icon: 'play' },
        { id: 'routine', label: 'Guardar como rutina', icon: 'copy' },
        { id: 'del', label: 'Borrar entreno', icon: 'trash', danger: true },
      ], { title: w.title });
      if (r === 'edit') editWorkout(w.id);
      if (r === 'repeat') startWorkout({ from: w });
      if (r === 'routine') saveAsRoutine(w);
      if (r === 'del' && (await confirmSheet('Esta acción no se puede deshacer.', { title: '¿Borrar este entreno?', ok: 'Borrar', danger: true }))) {
        await deleteWorkout(w.id);
        toast('Entreno borrado');
        back();
      }
    });
  },
};
