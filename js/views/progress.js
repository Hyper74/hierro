// Pestaña "Progreso": lista de ejercicios con historial y pantalla de récords.
import { html, str, norm, fmtShort, daysAgo } from '../util.js';
import { S, getEx, records, kindOf } from '../store.js';
import { PR_SHORT } from '../core/prs.js';
import { icon } from '../ui/icons.js';
import { navBar, emptyState, seg } from '../ui/components.js';
import { go } from '../router.js';
import { prValueText, MAIN_PRS } from './records.js';

let query = '';

function exerciseStats() {
  // exId → {sessions, last}
  const m = new Map();
  for (const w of S.workouts) {
    const seen = new Set();
    for (const e of w.exercises) {
      if (seen.has(e.exId) || !e.sets.length) continue;
      seen.add(e.exId);
      const s = m.get(e.exId) || { sessions: 0, last: 0 };
      s.sessions++; s.last = Math.max(s.last, w.start);
      m.set(e.exId, s);
    }
  }
  return m;
}

export const progressView = {
  render(page, params) {
    const tab = params.tab === 'records' ? 'records' : 'exercises';
    const rec = records();
    const stats = exerciseStats();
    const empty = !S.workouts.length;

    let body;
    if (empty) {
      body = html`<div class="card">${emptyState({ art: tab === 'records' ? 'records' : 'progress', title: 'Aún no hay progreso que mostrar', text: 'Registra entrenos o importa tu historial de Hevy para ver gráficos y récords.', actions: html`<a class="btn btn-primary btn-block" href="#/ajustes/importar">${icon('download')}Importar desde Hevy</a>` })}</div>`;
    } else if (tab === 'exercises') {
      const nq = norm(query);
      const list = [...stats.entries()].map(([id, s]) => ({ id, ex: getEx(id), ...s }))
        .filter((x) => x.ex && (!nq || norm(x.ex.name).includes(nq)))
        .sort((a, b) => b.last - a.last);
      body = html`
        <div class="search" style="margin-bottom:12px">${icon('search')}<input type="search" data-f="q" value="${query}" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio"></div>
        <div class="list">${list.map((x) => {
          const b = rec.byEx.get(x.id)?.best || {};
          const main = MAIN_PRS[x.ex.kind] || MAIN_PRS.weight;
          const k = main.find((t) => b[t]);
          return html`<a class="row" href="#/progreso/${x.id}">
            <div class="grow"><div class="title ellipsis">${x.ex.name}</div>
              <div class="sub">${x.ex.muscle} · ${x.sessions} sesi${x.sessions === 1 ? 'ón' : 'ones'} · ${daysAgo(x.last)}</div></div>
            ${k ? html`<span class="value num small">${prValueText({ type: k, ...b[k] }, x.ex.kind)}</span>` : ''}
            ${icon('chev', 'class="chev"')}</a>`;
        })}</div>
        ${list.length ? '' : html`<p class="muted" style="text-align:center">Sin resultados.</p>`}`;
    } else {
      const items = [...rec.byEx.entries()].map(([id, r]) => {
        const lastPR = r.history.filter((h) => h.prev != null).at(-1);
        return { id, ex: getEx(id), r, lastPR, last: lastPR?.date || r.history.at(-1)?.date || 0 };
      }).filter((x) => x.ex).sort((a, b) => b.last - a.last);
      body = html`<p class="footnote" style="margin:0 4px 12px">Mejores marcas actuales de cada ejercicio. Las series de calentamiento no cuentan.</p>
        ${items.map((x) => {
          const kind = x.ex.kind;
          const main = MAIN_PRS[kind] || MAIN_PRS.weight;
          return html`<a class="card card-tap" style="display:block" href="#/progreso/${x.id}?sec=records">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
              <b class="ellipsis">${x.ex.name}</b>
              <span class="small muted" style="white-space:nowrap">${x.lastPR ? `PR ${fmtShort(x.lastPR.date)}` : ''}</span></div>
            <div class="rec-grid" style="margin-top:10px;grid-template-columns:repeat(${Math.min(3, main.filter((t) => x.r.best[t]).length) || 1},1fr)">
              ${main.filter((t) => x.r.best[t]).map((t) => html`<div class="rec" style="background:var(--surface-2);padding:10px"><span>${PR_SHORT[t]}</span><b style="font-size:.98rem">${prValueText({ type: t, ...x.r.best[t] }, kind)}</b></div>`)}
            </div></a>`;
        })}`;
    }

    page.innerHTML = str(html`
      ${navBar({ title: 'Progreso' })}
      <div class="scroll">
        <h1 class="large-title">Progreso</h1>
        <div style="margin-bottom:14px">${seg('tab', [['exercises', 'Ejercicios'], ['records', 'Récords']], tab, 'Sección')}</div>
        ${body}
      </div>`);

    page.onclick = (e) => {
      const b = e.target.closest('[data-seg=tab]');
      if (b) go(b.dataset.v === 'records' ? '#/progreso?tab=records' : '#/progreso', { replace: true });
    };
    page.oninput = (e) => {
      if (e.target.dataset.f !== 'q') return;
      query = e.target.value;
      const nq = norm(query);
      page.querySelectorAll('.list .row').forEach((r) => { r.hidden = !!nq && !norm(r.querySelector('.title').textContent).includes(nq); });
    };
    void kindOf;
  },
};
