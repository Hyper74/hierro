// Pestaña "Ajustes": unidades, descanso, sonido, discos, datos y copias.
import { html, str, fmtDate, daysAgo, todayStamp, getUnit } from '../util.js';
import {
  S, saveSettings, snapshot, restore, wipeAll, exName, exList, getEx,
  removeSample, addRoutines, saveWorkouts,
} from '../store.js';
import { workoutsToHevyCSV } from '../core/hevy.js';
import { validateBackup } from '../core/backup.js';
import { generateSample } from '../../data/sample.js';
import { EQUIPMENT } from '../../data/exercises.js';
import { icon } from '../ui/icons.js';
import { navBar, switchRow, seg } from '../ui/components.js';
import { confirmSheet, toast, actionSheet } from '../ui/sheet.js';
import { REST_OPTIONS, restLabel, editExercise } from '../ui/picker.js';
import { saveFile, pickFile } from '../files.js';
import { unlockAudio, beep } from '../sound.js';
import { enableWake, disableWake, wakeSupported } from '../wakelock.js';
import { refresh } from '../router.js';

export const APP_VERSION = '1.0.0';
export const storageState = { persisted: null };

/** Activa o desactiva los datos de ejemplo. */
export async function loadSampleData(on) {
  await removeSample();
  if (on) {
    const { routines, workouts } = generateSample((id) => !!getEx(id));
    await addRoutines(routines);
    await saveWorkouts(workouts);
  }
  await saveSettings({ sampleData: on });
}

export async function exportBackup() {
  const ok = await saveFile(`hierro-copia-${todayStamp()}.json`, JSON.stringify(snapshot()), 'application/json');
  if (ok) { await saveSettings({ lastBackup: Date.now() }); toast('Copia de seguridad creada'); }
}

export const settingsView = {
  render(page) {
    const st = S.settings;
    const u = getUnit();
    const nSample = S.workouts.filter((w) => w.sample).length;
    const real = S.workouts.length - nSample;
    page.innerHTML = str(html`
      ${navBar({ title: 'Ajustes' })}
      <div class="scroll">
        <h1 class="large-title">Ajustes</h1>

        <div class="section-label">Unidades</div>
        ${seg('units', [['kg', 'Kilos (kg)'], ['lb', 'Libras (lb)']], st.units, 'Unidades de peso')}

        <div class="section-label">Entreno</div>
        <div class="list">
          <label class="row"><div class="grow title">Descanso por defecto</div>
            <select data-setting="defaultRest" aria-label="Descanso por defecto">${REST_OPTIONS.filter((r) => r > 0).map((r) => html`<option value="${r}" ${r === st.defaultRest ? 'selected' : ''}>${restLabel(r)}</option>`)}</select></label>
          ${switchRow('wakeLock', 'Mantener la pantalla encendida', st.wakeLock, wakeSupported() ? 'Durante el entreno, para que no se bloquee el iPhone.' : 'Este navegador no lo permite.')}
          <a class="row" href="#/ajustes/discos"><div class="grow title">Barra y discos</div><span class="value">Barra ${st.bar[u]} ${u}</span>${icon('chev', 'class="chev"')}</a>
          <a class="row" href="#/ajustes/ejercicios"><div class="grow title">Biblioteca de ejercicios</div><span class="value">${S.exercises.size}</span>${icon('chev', 'class="chev"')}</a>
        </div>

        <div class="section-label">Sonido del descanso</div>
        ${seg('soundMode', [['mix', 'Mezclar con mi música'], ['loud', 'Sonar siempre']], st.soundMode, 'Modo de sonido')}
        <p class="footnote">${st.soundMode === 'mix'
          ? '«Mezclar»: el pitido suena por encima de tu música sin pararla, pero NO suena si el iPhone está en modo silencio.'
          : '«Sonar siempre»: suena aunque el iPhone esté en silencio, pero iOS puede pausar la música de otra app al pitar.'}</p>
        <div class="list" style="margin-top:10px">
          <button class="row" data-act="testSound"><span class="trophy">${icon('sound')}</span><div class="grow title">Probar el sonido</div></button>
          ${switchRow('bgSound', 'Sonar con la pantalla bloqueada (experimental)', st.bgSound, 'Reproduce silencio durante el descanso y pita al final. Pausa tu música y depende de que iOS no congele la app.')}
        </div>
        <p class="footnote">Con la app abierta y la pantalla encendida el aviso es fiable. Con el iPhone bloqueado o en otra app, iOS congela las web apps y no permite programar avisos sin un servidor; el temporizador sigue siendo exacto y verás el resultado al volver.</p>

        <div class="section-label">Importar y exportar</div>
        <div class="list">
          <a class="row" href="#/ajustes/importar"><span class="trophy">${icon('download')}</span><div class="grow"><div class="title">Importar desde Hevy</div><div class="sub">Archivo CSV exportado de Hevy</div></div>${icon('chev', 'class="chev"')}</a>
          <button class="row" data-act="csv"><span class="trophy">${icon('file')}</span><div class="grow"><div class="title">Exportar entrenos a CSV</div><div class="sub">Mismo formato que Hevy, para Excel u otras apps</div></div></button>
        </div>

        <div class="section-label">Copia de seguridad</div>
        <div class="list">
          <button class="row" data-act="backup"><span class="trophy">${icon('shield')}</span><div class="grow"><div class="title">Crear copia de seguridad</div>
            <div class="sub">${st.lastBackup ? `Última: ${fmtDate(st.lastBackup)} (${daysAgo(st.lastBackup)})` : 'Aún no has hecho ninguna'}</div></div></button>
          <button class="row" data-act="restore"><span class="trophy">${icon('upload')}</span><div class="grow"><div class="title">Restaurar una copia</div><div class="sub">Sustituye todos los datos por los del archivo</div></div></button>
          <label class="row"><div class="grow title">Recordármelo</div>
            <select data-setting="backupEvery" aria-label="Frecuencia del recordatorio de copia">${[[7, 'Cada semana'], [14, 'Cada 2 semanas'], [30, 'Cada mes'], [0, 'Nunca']].map(([v, t]) => html`<option value="${v}" ${v === st.backupEvery ? 'selected' : ''}>${t}</option>`)}</select></label>
        </div>
        <p class="footnote">Tus datos solo viven en este iPhone. Guarda la copia en Archivos o iCloud Drive: si borras la app o los datos de Safari, es la única forma de recuperarlos.
          ${storageState.persisted === true ? ' Almacenamiento persistente: activado.' : storageState.persisted === false ? ' Almacenamiento persistente: iOS aún no lo ha concedido (instala la app en la pantalla de inicio).' : ''}</p>

        <div class="section-label">Datos</div>
        <div class="list">
          ${switchRow('sampleData', 'Datos de ejemplo', st.sampleData, nSample ? `${nSample} entrenos de ejemplo cargados. Desactívalo para borrarlos.` : 'Rutinas y entrenos ficticios para ver la app con contenido.')}
          <button class="row" data-act="wipe"><div class="grow title danger">Borrar todos los datos</div></button>
        </div>
        <p class="footnote" style="text-align:center;margin-top:26px">Hierro ${APP_VERSION} · ${real} entreno${real === 1 ? '' : 's'} · <a href="tests/">tests</a></p>
      </div>`);

    page.onchange = async (e) => {
      const k = e.target.dataset.setting;
      if (!k) return;
      if (k === 'defaultRest' || k === 'backupEvery') return saveSettings({ [k]: Number(e.target.value) });
      const on = e.target.checked;
      if (k === 'sampleData') { await loadSampleData(on); toast(on ? 'Datos de ejemplo cargados' : 'Datos de ejemplo eliminados'); return refresh(); }
      if (k === 'wakeLock') { await saveSettings({ wakeLock: on }); if (S.active && on) enableWake(); else disableWake(); return; }
      if (k === 'bgSound') { await saveSettings({ bgSound: on }); return refresh(); }
    };
    page.onclick = async (e) => {
      const sg = e.target.closest('[data-seg]');
      if (sg) { await saveSettings({ [sg.dataset.seg]: sg.dataset.v }); if (sg.dataset.seg === 'soundMode') unlockAudio(); return refresh(); }
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'testSound') { unlockAudio(); setTimeout(beep, 80); }
      if (a === 'csv') {
        if (!S.workouts.length) return toast('No hay entrenos que exportar');
        if (await saveFile(`hierro-entrenos-${todayStamp()}.csv`, workoutsToHevyCSV(S.workouts, exName), 'text/csv')) toast('CSV exportado');
      }
      if (a === 'backup') { await exportBackup(); refresh(); }
      if (a === 'restore') {
        const f = await pickFile('.json,application/json');
        if (!f) return;
        const v = validateBackup(f.text);
        if (!v.ok) return toast(v.error, { ms: 4000 });
        const s = v.summary;
        if (await confirmSheet(`El archivo contiene ${s.workouts} entreno(s), ${s.routines} rutina(s) y ${s.exercises} ejercicios${s.exportedAt ? ` (copia del ${fmtDate(new Date(s.exportedAt).getTime())})` : ''}. Se sustituirán TODOS los datos actuales.`, { title: '¿Restaurar esta copia?', ok: 'Restaurar', danger: true })) {
          await restore(v.data);
          toast('Copia restaurada');
          refresh();
        }
      }
      if (a === 'wipe') {
        const r = await actionSheet([{ id: 'backup', label: 'Hacer copia antes', bold: true }, { id: 'wipe', label: 'Borrar todo', danger: true }], { title: '¿Borrar todos los datos?', message: 'Se eliminarán entrenos, rutinas, ejercicios propios y ajustes. No se puede deshacer.' });
        if (r === 'backup') return exportBackup();
        if (r === 'wipe') { await wipeAll(); toast('Datos borrados'); refresh(); }
      }
    };
  },
};

/** Biblioteca de ejercicios: ver, editar y crear. */
export const libraryView = {
  render(page) {
    const groups = new Map();
    for (const e of exList()) { if (!groups.has(e.muscle)) groups.set(e.muscle, []); groups.get(e.muscle).push(e); }
    page.innerHTML = str(html`
      ${navBar({ title: 'Ejercicios', back: true, always: true, right: html`<button class="nav-btn" data-act="new" aria-label="Nuevo ejercicio">${icon('plus')}</button>` })}
      <div class="scroll">
        ${[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([m, list]) => html`<div class="muscle-head">${m}</div>
          <div class="list">${list.map((e) => html`<button class="row" data-id="${e.id}"><div class="grow"><div class="title">${e.name}</div>
            <div class="sub">${EQUIPMENT[e.equipment] || ''} · descanso ${restLabel(e.rest || S.settings.defaultRest)}${e.custom ? ' · propio' : ''}</div></div>${icon('chev', 'class="chev"')}</button>`)}</div>`)}
      </div>`);
    page.onclick = async (e) => {
      if (e.target.closest('[data-act=new]')) { if (await editExercise(null)) refresh(); return; }
      const r = e.target.closest('[data-id]');
      if (r) { await editExercise(getEx(r.dataset.id)); refresh(); }
    };
  },
};
