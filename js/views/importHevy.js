// Importar desde Hevy: elegir archivo → vista previa → tabla de emparejamientos → confirmar.
import { html, str, uid, fmtDate } from '../util.js';
import { S, exList, getEx, saveExercises, saveWorkouts, records } from '../store.js';
import { parseHevyCSV, matchExercises, buildWorkouts, workoutKey, normalizeName } from '../core/hevy.js';
import { EQUIPMENT, KINDS } from '../../data/exercises.js';
import { icon } from '../ui/icons.js';
import { navBar } from '../ui/components.js';
import { toast } from '../ui/sheet.js';
import { pickFile } from '../files.js';
import { go, refresh } from '../router.js';

let st = null; // {file, parsed, mapping: Map<name, exId|'__new'>, quality: Map, skipDup, result}

/** Claves de los entrenos ya guardados (para detectar duplicados). */
function existingKeys() {
  const set = new Set();
  for (const w of S.workouts) { if (w.importKey) set.add(w.importKey); set.add(workoutKey(w.title, w.start)); }
  return set;
}

export const importView = {
  render(page) {
    if (!st) return paintStart(page);
    if (st.result) return paintDone(page);
    paintPreview(page);
  },
};

function paintStart(page, error = '') {
  page.innerHTML = str(html`
    ${navBar({ title: 'Importar desde Hevy', back: true, always: true })}
    <div class="scroll">
      <div class="card" style="margin-top:14px">
        <div class="empty" style="padding:16px 6px 6px">
          <div class="medal" style="width:84px;height:84px;margin:0 auto 14px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center">${icon('download', 'style="width:40px;height:40px"')}</div>
          <h3>Trae tu historial de Hevy</h3>
          <p>En Hevy: Perfil → Ajustes → Exportar e importar datos → Exportar entrenos. Guarda el CSV en Archivos y elígelo aquí.</p>
          ${error ? html`<div class="banner warn" style="text-align:left">${icon('info')}<div class="grow">${error}</div></div>` : ''}
          <button class="btn btn-primary btn-lg btn-block" data-act="pick">${icon('file')}Elegir archivo CSV</button>
        </div>
      </div>
      <p class="footnote">Nada sale de tu iPhone: el archivo se lee aquí mismo. Antes de guardar verás una vista previa y podrás corregir los ejercicios. Si importas el mismo archivo dos veces, los entrenos repetidos se detectan y se omiten.</p>
    </div>`);
  page.onclick = async (e) => {
    if (!e.target.closest('[data-act=pick]')) return;
    const f = await pickFile('.csv,text/csv,text/comma-separated-values,text/plain');
    if (!f) return;
    const parsed = parseHevyCSV(f.text);
    if (!parsed.workouts.length) return paintStart(page, parsed.errors[0] || 'No se ha encontrado ningún entreno en el archivo.');
    const m = matchExercises([...parsed.names.keys()], exList());
    st = {
      file: f.name, parsed, skipDup: true, result: null,
      mapping: new Map([...m].map(([n, r]) => [n, r.exId || '__new'])),
      quality: new Map([...m].map(([n, r]) => [n, r.quality])),
    };
    paintPreview(page);
  };
}

function paintPreview(page) {
  const { parsed } = st;
  const keys = existingKeys();
  const dups = parsed.workouts.filter((w) => keys.has(w.key));
  const fresh = parsed.workouts.length - dups.length;
  const sets = parsed.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  const starts = parsed.workouts.map((w) => w.start);
  const names = [...parsed.names.values()].sort((a, b) => {
    const o = { new: 0, fuzzy: 1, exact: 2 };
    return o[st.quality.get(a.name)] - o[st.quality.get(b.name)] || a.name.localeCompare(b.name, 'es');
  });
  const nNew = [...st.mapping.values()].filter((v) => v === '__new').length;
  const all = exList();
  const willImport = st.skipDup ? fresh : parsed.workouts.length;
  const qLabel = { exact: 'Coincide', fuzzy: 'Parecido', new: 'Nuevo' };

  page.innerHTML = str(html`
    ${navBar({ title: 'Vista previa', always: true, left: html`<button class="nav-btn" data-act="cancel">Cancelar</button>` })}
    <div class="scroll">
      <p class="muted small" style="margin:14px 4px 10px">${icon('file', 'style="width:15px;height:15px;vertical-align:-2px"')} ${st.file}</p>
      <div class="stat-grid">
        <div class="card"><b>${parsed.workouts.length}</b><span>Entrenos</span></div>
        <div class="card"><b>${parsed.names.size}</b><span>Ejercicios distintos</span></div>
        <div class="card"><b>${sets}</b><span>Series</span></div>
        <div class="card"><b style="font-size:1.05rem;line-height:1.5">${fmtDate(Math.min(...starts))}<br>${fmtDate(Math.max(...starts))}</b><span>Rango de fechas</span></div>
      </div>
      ${dups.length ? html`<div class="banner warn" style="margin-top:12px">${icon('info')}<div class="grow"><b>${dups.length} entreno${dups.length > 1 ? 's' : ''} ya ${dups.length > 1 ? 'están' : 'está'} en la app</b>
        ${fresh ? `Solo se importarán los ${fresh} nuevos.` : 'No hay nada nuevo que importar.'}
        <label style="display:flex;align-items:center;gap:10px;margin-top:10px"><span class="switch"><input type="checkbox" data-f="skip" ${st.skipDup ? 'checked' : ''} aria-label="Omitir duplicados"><span></span></span> Omitir duplicados</label></div></div>` : ''}
      ${parsed.errors.length ? html`<div class="banner warn" style="margin-top:12px">${icon('info')}<div class="grow"><b>${parsed.errors.length} fila${parsed.errors.length > 1 ? 's' : ''} no se ha${parsed.errors.length > 1 ? 'n' : ''} podido leer</b>${parsed.errors.slice(0, 3).join(' · ')}</div></div>` : ''}

      <div class="section-head"><h2>Ejercicios</h2></div>
      <p class="footnote" style="margin:-4px 4px 10px">Cada ejercicio de Hevy se guarda como el ejercicio que elijas. ${nNew ? `${nNew} se crearán como nuevos.` : 'Todos coinciden con la biblioteca.'} Revisa los marcados como «Parecido» o «Nuevo».</p>
      <div class="list">${names.map((info) => {
        const cur = st.mapping.get(info.name);
        const q = cur === '__new' ? 'new' : st.quality.get(info.name) === 'new' ? 'fuzzy' : st.quality.get(info.name);
        return html`<div class="map-row">
          <div class="hevy"><span>${info.name}</span><span class="q ${q}">${qLabel[q]}</span></div>
          <div class="small muted" style="margin-top:2px">${info.sets} series${cur === '__new' ? ` · se creará como ${info.muscle} · ${EQUIPMENT[info.equipment]} · ${KINDS[info.kind].toLowerCase()}` : ''}</div>
          <select class="input" data-name="${info.name}" aria-label="Guardar ${info.name} como">
            <option value="__new" ${cur === '__new' ? 'selected' : ''}>➕ Crear como ejercicio nuevo</option>
            ${all.map((e) => html`<option value="${e.id}" ${cur === e.id ? 'selected' : ''}>${e.name}</option>`)}
          </select></div>`;
      })}</div>
      <button class="btn btn-primary btn-lg btn-block" style="margin-top:20px" data-act="go" ${willImport ? '' : 'disabled'}>Importar ${willImport} entreno${willImport === 1 ? '' : 's'}</button>
      <p class="footnote" style="text-align:center">Al importar se recalculan los récords y los gráficos con todo el historial.</p>
    </div>`);

  page.onchange = (e) => {
    if (e.target.dataset.name) { st.mapping.set(e.target.dataset.name, e.target.value); keepScroll(page, () => paintPreview(page)); }
    if (e.target.dataset.f === 'skip') { st.skipDup = e.target.checked; keepScroll(page, () => paintPreview(page)); }
  };
  page.onclick = async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'cancel') { st = null; go('#/ajustes', { replace: true }); }
    if (a === 'go') { e.target.closest('button').disabled = true; await doImport(); refresh(); }
  };
}

function keepScroll(page, fn) {
  const top = page.querySelector('.scroll')?.scrollTop || 0;
  fn();
  const sc = page.querySelector('.scroll');
  if (sc) sc.scrollTop = top;
}

async function doImport() {
  const { parsed, mapping } = st;
  const before = countPRs();
  // 1. Ejercicios: crear los nuevos y guardar el nombre de Hevy como alias de los emparejados
  const idOf = new Map();
  const toSave = [];
  let created = 0;
  for (const [name, target] of mapping) {
    const info = parsed.names.get(name);
    if (target === '__new') {
      const ex = { id: 'ex-' + uid(), name, muscle: info.muscle, equipment: info.equipment, kind: info.kind, rest: null, inc: null, perSide: info.equipment === 'discos', aliases: [], custom: true };
      toSave.push(ex); idOf.set(name, ex.id); created++;
    } else {
      idOf.set(name, target);
      const ex = getEx(target);
      if (ex && normalizeName(ex.name) !== normalizeName(name) && !(ex.aliases || []).some((a) => normalizeName(a) === normalizeName(name))) {
        toSave.push({ ...ex, aliases: [...(ex.aliases || []), name] });
      }
    }
  }
  if (toSave.length) await saveExercises(toSave);
  // 2. Entrenos (omitiendo duplicados si procede)
  const keys = existingKeys();
  const list = st.skipDup ? parsed.workouts.filter((w) => !keys.has(w.key)) : parsed.workouts;
  const workouts = buildWorkouts(list, idOf, () => 'w-' + uid());
  await saveWorkouts(workouts);
  st.result = {
    workouts: workouts.length, skipped: parsed.workouts.length - list.length, created,
    sets: workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    prs: countPRs() - before,
  };
  toast('Importación completada');
}

function countPRs() {
  let n = 0;
  for (const r of records().byEx.values()) n += r.history.filter((h) => h.prev != null).length;
  return n;
}

function paintDone(page) {
  const r = st.result;
  page.innerHTML = str(html`
    ${navBar({ title: 'Importación completada', always: true })}
    <div class="scroll">
      <div class="summary-hero"><div class="medal">${icon('check')}</div><h1>¡Historial importado!</h1></div>
      <div class="stat-grid">
        <div class="card"><b>${r.workouts}</b><span>Entrenos importados</span></div>
        <div class="card"><b>${r.sets}</b><span>Series</span></div>
        <div class="card"><b>${r.created}</b><span>Ejercicios nuevos</span></div>
        <div class="card"><b class="accent">${r.prs}</b><span>Récords detectados</span></div>
      </div>
      ${r.skipped ? html`<p class="footnote" style="text-align:center">${r.skipped} entreno${r.skipped > 1 ? 's' : ''} duplicado${r.skipped > 1 ? 's' : ''} omitido${r.skipped > 1 ? 's' : ''}.</p>` : ''}
      <div style="display:grid;gap:10px;margin-top:22px">
        <a class="btn btn-primary btn-lg btn-block" href="#/historial" data-act="done">Ver el historial</a>
        <a class="btn btn-block" href="#/progreso?tab=records" data-act="done">${icon('trophy')}Ver mis récords</a>
      </div>
    </div>`);
  page.onclick = (e) => { if (e.target.closest('[data-act=done]')) st = null; };
}
