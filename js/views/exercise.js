// Detalle de un ejercicio: gráficos (peso máx, 1RM, volumen), récords e historial de series.
import { html, str, fmtW, fmtVol, fmtSecs, fmtNum, fmtDay, fmtDate, toDisp, getUnit } from '../util.js';
import { S, getEx, records } from '../store.js';
import { sessionsFor, topSet } from '../core/stats.js';
import { PR_LABEL } from '../core/prs.js';
import { icon } from '../ui/icons.js';
import { navBar, seg, prBadge } from '../ui/components.js';
import { mountChart } from '../ui/chart.js';
import { editExercise } from '../ui/picker.js';
import { EQUIPMENT } from '../../data/exercises.js';
import { setText } from './workout.js';
import { prValueText } from './records.js';
import { refresh } from '../router.js';

const RANGES = [['1m', '1 mes', 30], ['3m', '3 meses', 91], ['6m', '6 meses', 182], ['1a', '1 año', 365], ['all', 'Todo', Infinity]];
const state = new Map(); // exId → {metric, range}

function metricsFor(kind) {
  const w = (v, short) => (short ? fmtNum(toDisp(v), 1) : fmtW(v));
  const vol = (v, short) => (short ? fmtNum(Math.round(toDisp(v)), 0) : fmtVol(v));
  const reps = (v) => `${fmtNum(v, 0)}${''}`;
  if (kind === 'reps') return [['maxReps', 'Reps máx', reps], ['totalReps', 'Reps totales', reps]];
  if (kind === 'weighted') return [['maxReps', 'Reps máx', reps], ['maxWeight', 'Lastre máx', w], ['totalReps', 'Reps totales', reps]];
  if (kind === 'time') return [['maxTime', 'Tiempo máx', (v, s) => (s ? fmtNum(v, 0) : fmtSecs(v))]];
  return [['maxWeight', 'Peso máx', w], ['e1rm', '1RM estimado', w], ['volume', 'Volumen', vol]];
}

export const exerciseView = {
  render(page, params) {
    const ex = getEx(params.exId);
    if (!ex) { page.innerHTML = str(html`${navBar({ title: 'Ejercicio', back: true, always: true })}<div class="scroll"><p class="muted" style="text-align:center;margin-top:40px">Ejercicio no encontrado.</p></div>`); return; }
    const kind = ex.kind;
    const metrics = metricsFor(kind);
    const st = state.get(ex.id) || { metric: metrics[0][0], range: 'all' };
    if (!metrics.some((m) => m[0] === st.metric)) st.metric = metrics[0][0];
    state.set(ex.id, st);
    const [, mLabel, mFmt] = metrics.find((m) => m[0] === st.metric);

    const sessions = sessionsFor(ex.id, S.workouts);
    const days = RANGES.find((r) => r[0] === st.range)[2];
    const from = days === Infinity ? 0 : Date.now() - days * 86400000;
    const inRange = sessions.filter((s) => s.date >= from && s[st.metric] > 0);
    const pts = inRange.map((s) => ({ x: s.date, y: s[st.metric], sub: s.best ? setText(s.best, kind) : '' }));
    const lastV = pts.at(-1)?.y, firstV = pts[0]?.y;
    const delta = pts.length > 1 ? lastV - firstV : null;

    const rec = records().byEx.get(ex.id);
    const best = rec?.best || {};
    const recTypes = ['weight', 'e1rm', 'volume', 'reps', 'sessionReps', 'time'].filter((t) => best[t]);
    const history = rec ? [...rec.history].filter((h) => h.type !== 'repsAtWeight' || h.prev != null).reverse() : [];
    const rawRec = records();

    page.innerHTML = str(html`
      ${navBar({ title: ex.name, back: true, right: html`<button class="nav-btn" data-act="edit" aria-label="Editar ejercicio">${icon('edit')}</button>` })}
      <div class="scroll">
        <h1 class="large-title" style="font-size:1.7rem;margin-bottom:4px">${ex.name}</h1>
        <p class="muted" style="margin:0 0 16px">${ex.muscle} · ${EQUIPMENT[ex.equipment] || ''} · ${sessions.length} sesi${sessions.length === 1 ? 'ón' : 'ones'}</p>

        ${sessions.length ? html`
        <div>${seg('metric', metrics.map((m) => [m[0], m[1]]), st.metric, 'Métrica')}</div>
        <div style="margin:16px 4px 0">
          <div class="big-value">${lastV != null ? mFmt(lastV) : '–'}</div>
          <div class="big-label">${mLabel} · última sesión${delta != null ? html` · <span class="${delta >= 0 ? 'accent' : 'danger'}">${delta >= 0 ? '+' : '−'}${mFmt(Math.abs(delta))}${firstV ? ` (${delta >= 0 ? '+' : '−'}${fmtNum(Math.abs(delta / firstV) * 100, 0)} %)` : ''}</span> en el periodo` : ''}</div>
        </div>
        <div class="chart-wrap" data-chart></div>
        <div class="chips fit">${RANGES.map(([k, t]) => html`<button class="chip" data-range="${k}" aria-pressed="${k === st.range}">${t}</button>`)}</div>
        <p class="footnote">Toca o arrastra sobre el gráfico para ver la fecha y el valor de cada sesión.${st.metric === 'e1rm' ? ' 1RM estimado con la fórmula de Epley: peso × (1 + reps/30).' : ''}</p>` : html`<div class="card"><p class="muted" style="margin:0;text-align:center">Todavía no has hecho este ejercicio.</p></div>`}

        ${recTypes.length ? html`
        <div class="section-head" id="records"><h2>Récords</h2></div>
        <div class="rec-grid">${recTypes.map((t) => html`<div class="rec"><span>${PR_LABEL[t]}</span><b>${prValueText({ type: t, ...best[t] }, kind)}</b><small>${fmtDate(best[t].date)}</small></div>`)}</div>
        <div class="section-label">Historial de récords</div>
        <div class="list timeline">${history.slice(0, 60).map((h) => html`<div class="row">
          <span class="trophy">${icon(h.prev == null ? 'flag' : 'trophy')}</span>
          <div class="grow"><div class="title">${PR_LABEL[h.type]}</div><div class="sub">${fmtDay(h.date)}${h.prev == null ? ' · primera marca' : h.type === 'repsAtWeight' ? '' : ` · antes ${prValueText({ ...h, value: h.prev }, kind)}`}</div></div>
          <b class="num small">${prValueText(h, kind)}</b></div>`)}</div>` : ''}

        ${sessions.length ? html`
        <div class="section-head"><h2>Todas las series</h2></div>
        ${[...sessions].reverse().slice(0, 120).map((s) => html`
          <div class="card" style="padding:12px 14px">
            <a href="#/historial/${s.wid}" style="color:var(--text);display:flex;justify-content:space-between;gap:8px">
              <b>${fmtDay(s.date)}</b><span class="muted small ellipsis">${s.title} ${icon('chev', 'style="width:12px;height:12px"')}</span></a>
            ${s.sets.map((x, i) => {
              const w = S.workouts.find((ww) => ww.id === s.wid);
              let fl = null;
              if (w) { // localizar la serie para saber si fue PR
                let k = 0;
                outer: for (let ei = 0; ei < w.exercises.length; ei++) {
                  if (w.exercises[ei].exId !== ex.id) continue;
                  for (let si = 0; si < w.exercises[ei].sets.length; si++) { if (k === i) { fl = rawRec.setFlags.get(`${w.id}:${ei}:${si}`); break outer; } k++; }
                }
              }
              return html`<div class="dset"><span class="t ${x.type}">${{ warmup: 'C', drop: 'D', failure: 'F' }[x.type] || i + 1}</span><span>${setText(x, kind)} ${fl ? prBadge() : ''}</span><span class="e"></span></div>`;
            })}
          </div>`)}` : ''}
      </div>`);

    if (sessions.length) mountChart(page.querySelector('[data-chart]'), pts, { label: mLabel, fmt: (v, short) => mFmt(v, short) });
    if (params.sec === 'records') requestAnimationFrame(() => page.querySelector('#records')?.scrollIntoView());

    page.onclick = async (e) => {
      const m = e.target.closest('[data-seg=metric]');
      if (m) { st.metric = m.dataset.v; return refresh(); }
      const r = e.target.closest('[data-range]');
      if (r) { st.range = r.dataset.range; return refresh(); }
      if (e.target.closest('[data-act=edit]')) { await editExercise(ex); refresh(); }
    };
    void topSet; void getUnit;
  },
};
