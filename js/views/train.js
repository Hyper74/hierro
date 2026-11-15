// Pestaña "Entrenar": entreno en curso, rutinas y herramientas.
import { html, str, fmtClock, daysAgo } from '../util.js';
import { S, exName, saveRoutine, deleteRoutine, reorderRoutines, saveSettings } from '../store.js';
import { icon } from '../ui/icons.js';
import { emptyState } from '../ui/components.js';
import { actionSheet, confirmSheet, toast } from '../ui/sheet.js';
import { startWorkout, openLayer } from './workout.js';
import { go, refresh } from '../router.js';
import { loadSampleData } from './settings.js';

let reorder = false;

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const trainView = {
  render(page) {
    const st = S.settings;
    const routines = S.routines;
    const needBackup = st.backupEvery > 0 && S.workouts.length > 0 && (!st.lastBackup || Date.now() - st.lastBackup > st.backupEvery * 86400000);
    page.innerHTML = str(html`
      <header class="nav"><div class="nav-left"></div><div class="nav-title">Entrenar</div><div class="nav-right"></div></header>
      <div class="scroll">
        <h1 class="large-title">Entrenar</h1>

        ${isIOS && !standalone() && !st.installHintDismissed ? html`<div class="banner">
          ${icon('phone')}<div class="grow"><b>Instálala en tu iPhone</b>En Safari: botón Compartir → «Añadir a pantalla de inicio». Así se abre a pantalla completa y tus datos quedan más protegidos.</div>
          <button class="icon-btn" data-act="hideHint" aria-label="Ocultar aviso" style="margin:-8px -8px 0 0">${icon('x')}</button></div>` : ''}

        ${needBackup ? html`<div class="banner warn">${icon('shield')}<div class="grow"><b>Haz una copia de seguridad</b>
          Tus datos solo están en este iPhone. ${st.lastBackup ? `Última copia: ${daysAgo(st.lastBackup)}.` : 'Aún no has hecho ninguna.'}
          <div style="margin-top:8px"><a href="#/ajustes" class="small" style="font-weight:700">Ir a Ajustes → Copia de seguridad</a></div></div></div>` : ''}

        ${S.active ? html`<button class="resume-card" data-act="resume">
            ${icon('play')}<div class="grow"><b>Continuar entreno</b><span class="num">${S.active.title} · ${fmtClock((Date.now() - S.active.start) / 1000)}</span></div>${icon('chev')}
          </button>`
          : html`<button class="btn btn-primary btn-lg btn-block" data-act="empty">${icon('plus')}Empezar entreno vacío</button>`}

        <div class="section-head"><h2>Rutinas</h2>
          <div style="display:flex;gap:4px">
            ${routines.length > 1 ? html`<button class="btn btn-sm btn-ghost" data-act="reorder" aria-pressed="${reorder}">${reorder ? 'Hecho' : 'Ordenar'}</button>` : ''}
            ${reorder ? '' : html`<button class="btn btn-sm" data-act="new">${icon('plus')}Nueva</button>`}
          </div></div>

        ${routines.length ? routines.map((r, i) => html`
          <div class="card routine" data-id="${r.id}">
            <div class="routine-top">
              <div class="grow"><h3>${r.name}</h3>
                <div class="ex-list">${r.items.length ? r.items.map((it) => exName(it.exId)).join(' · ') : 'Sin ejercicios'}</div></div>
              ${reorder
                ? html`<div style="display:flex;gap:2px">
                    <button class="icon-btn" data-act="up" aria-label="Subir ${r.name}" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${icon('arrowUp')}</button>
                    <button class="icon-btn" data-act="down" aria-label="Bajar ${r.name}" ${i === routines.length - 1 ? 'disabled style="opacity:.3"' : ''}>${icon('arrowDown')}</button></div>`
                : html`<button class="icon-btn" data-act="rmenu" aria-label="Opciones de ${r.name}">${icon('more')}</button>`}
            </div>
            ${reorder ? '' : html`<button class="btn btn-primary btn-block" data-act="start" ${r.items.length ? '' : 'disabled'}>${icon('play')}Empezar</button>`}
          </div>`)
        : html`<div class="card">${emptyState({
            art: 'routines',
            title: 'Aún no tienes rutinas',
            text: 'Crea tu primera rutina (por ejemplo “Upper A” o “Pierna”) o importa tu historial de Hevy.',
            actions: html`<button class="btn btn-primary btn-block" data-act="new">${icon('plus')}Crear rutina</button>
              <button class="btn btn-block" data-act="import">${icon('download')}Importar desde Hevy</button>
              ${S.workouts.length ? '' : html`<button class="btn btn-ghost btn-block" data-act="sample">${icon('sparkle')}Ver la app con datos de ejemplo</button>`}`,
          })}</div>`}

        <div class="section-head"><h2>Herramientas</h2></div>
        <a class="card card-tap tool-card" href="#/entrenar/discos">
          <span class="ico">${icon('plates')}</span>
          <div class="grow"><b>Calculadora de discos</b><div class="muted small">Qué discos poner a cada lado de la barra</div></div>
          ${icon('chev', 'class="chev" style="width:18px;height:18px;color:var(--text-3)"')}
        </a>
      </div>`);

    page.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const card = a.closest('[data-id]');
      const r = card ? S.routines.find((x) => x.id === card.dataset.id) : null;
      switch (a.dataset.act) {
        case 'empty': return startWorkout();
        case 'resume': return openLayer(true);
        case 'new': return go('#/entrenar/rutina/nueva');
        case 'import': return go('#/ajustes/importar');
        case 'sample': await loadSampleData(true); toast('Datos de ejemplo cargados'); return;
        case 'hideHint': return saveSettings({ installHintDismissed: true });
        case 'start': return startWorkout({ routine: r });
        case 'reorder': reorder = !reorder; return refresh();
        case 'up': case 'down': {
          const ids = S.routines.map((x) => x.id);
          const i = ids.indexOf(r.id), j = a.dataset.act === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= ids.length) return;
          [ids[i], ids[j]] = [ids[j], ids[i]];
          await reorderRoutines(ids);
          return refresh();
        }
        case 'rmenu': {
          const c = await actionSheet([
            { id: 'start', label: 'Empezar entreno', icon: 'play' },
            { id: 'edit', label: 'Editar', icon: 'edit' },
            { id: 'dup', label: 'Duplicar', icon: 'copy' },
            { id: 'del', label: 'Borrar rutina', icon: 'trash', danger: true },
          ], { title: r.name });
          if (c === 'start') startWorkout({ routine: r });
          if (c === 'edit') go(`#/entrenar/rutina/${r.id}`);
          if (c === 'dup') { const copy = structuredClone(r); delete copy.id; copy.name = `${r.name} (copia)`; delete copy.sample; await saveRoutine(copy); toast('Rutina duplicada'); }
          if (c === 'del' && (await confirmSheet(`Se borrará la rutina “${r.name}”. Tu historial no se toca.`, { ok: 'Borrar', danger: true }))) await deleteRoutine(r.id);
        }
      }
    });
  },
};
