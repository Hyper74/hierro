// Crear / editar una rutina: ejercicios, series, repeticiones objetivo, descanso y superseries.
import { html, str, uid, parseNum } from '../util.js';
import { S, getEx, restOf, saveRoutine } from '../store.js';
import { icon } from '../ui/icons.js';
import { navBar } from '../ui/components.js';
import { actionSheet, toast, confirmSheet } from '../ui/sheet.js';
import { pickExercises, REST_OPTIONS, restLabel } from '../ui/picker.js';
import { back } from '../router.js';
import { normalizeSupersets } from './workout.js';

let draft = null;
let draftFor = null;
let dirty = false;

export const routineEditView = {
  render(page, params) {
    if (draftFor !== params.id || !draft) {
      const r = params.id === 'nueva' ? null : S.routines.find((x) => x.id === params.id);
      draft = r ? structuredClone(r) : { name: '', items: [] };
      draftFor = params.id;
      dirty = false;
    }
    paint(page);
  },
};

function paint(page) {
  const letters = new Map();
  draft.items.forEach((it) => { if (it.supersetId && !letters.has(it.supersetId)) letters.set(it.supersetId, String.fromCharCode(65 + letters.size)); });
  page.innerHTML = str(html`
    ${navBar({
      title: draftFor === 'nueva' ? 'Nueva rutina' : 'Editar rutina', always: true,
      left: html`<button class="nav-btn" data-act="cancel">Cancelar</button>`,
      right: html`<button class="nav-btn strong" data-act="save">Guardar</button>`,
    })}
    <div class="scroll">
      <label class="field" style="margin-top:14px"><span>Nombre</span>
        <input class="input" data-f="name" value="${draft.name}" placeholder="Ej.: Push, Pull, Pierna…" autocomplete="off" enterkeyhint="done" style="font-size:max(16px,1.2rem);font-weight:700"></label>
      ${draft.items.length ? '' : html`<p class="muted" style="text-align:center;margin:28px 0">Añade ejercicios a la rutina.</p>`}
      ${draft.items.map((it, i) => {
        const ex = getEx(it.exId);
        const prevSame = it.supersetId && draft.items[i - 1]?.supersetId === it.supersetId;
        const nextSame = it.supersetId && draft.items[i + 1]?.supersetId === it.supersetId;
        return html`
        <div class="wk-ex ${it.supersetId ? 'ss' : ''} ${nextSame ? 'ss-mid' : ''} ${prevSame ? 'ss-next' : ''}" data-i="${i}">
          ${it.supersetId && !prevSame ? html`<div class="ss-tag">Superserie ${letters.get(it.supersetId)}</div>` : ''}
          <div class="wk-ex-head"><div class="wk-ex-name" style="color:var(--text)">${ex?.name || 'Ejercicio eliminado'}</div>
            <button class="icon-btn" data-act="menu" aria-label="Opciones de ${ex?.name || ''}">${icon('more')}</button></div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:10px 14px;align-items:center;padding:6px 4px 4px">
            <span class="muted small">Series</span>
            <div class="stepper" style="justify-self:start"><button data-act="sets-" aria-label="Menos series">${icon('minus')}</button>
              <output aria-live="polite">${it.sets}</output><button data-act="sets+" aria-label="Más series">${icon('plus')}</button></div>
            ${ex?.kind === 'time' ? '' : html`<span class="muted small">Reps objetivo</span>
            <div style="display:flex;align-items:center;gap:8px">
              <input class="input num" style="width:76px;text-align:center" inputmode="numeric" pattern="[0-9]*" data-f="repsMin" value="${it.repsMin ?? ''}" placeholder="8" aria-label="Repeticiones mínimas">
              <span class="muted">–</span>
              <input class="input num" style="width:76px;text-align:center" inputmode="numeric" pattern="[0-9]*" data-f="repsMax" value="${it.repsMax ?? ''}" placeholder="12" aria-label="Repeticiones máximas"></div>`}
            <span class="muted small">Descanso</span>
            <select class="input" data-f="rest" style="max-width:220px">
              <option value="">Del ejercicio (${restLabel(restOf(it.exId))})</option>
              ${REST_OPTIONS.map((r) => html`<option value="${r}" ${it.rest === r ? 'selected' : ''}>${restLabel(r)}</option>`)}
            </select>
          </div>
        </div>`;
      })}
      <button class="btn btn-block" style="margin-top:6px" data-act="add">${icon('plus')}Añadir ejercicios</button>
    </div>`);

  page.oninput = (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    dirty = true;
    if (f === 'name') { draft.name = e.target.value; return; }
    const it = draft.items[+e.target.closest('[data-i]').dataset.i];
    if (f === 'repsMin' || f === 'repsMax') { const v = parseNum(e.target.value); it[f] = v > 0 ? Math.round(v) : null; }
    if (f === 'rest') it.rest = e.target.value === '' ? null : Number(e.target.value);
  };
  page.onchange = page.oninput;
  page.onclick = async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const box = a.closest('[data-i]');
    const i = box ? +box.dataset.i : -1;
    const it = draft.items[i];
    switch (a.dataset.act) {
      case 'cancel':
        if (!dirty || (await confirmSheet('Los cambios no se guardarán.', { title: '¿Salir sin guardar?', ok: 'Salir', danger: true }))) { draft = null; back(); }
        return;
      case 'save': {
        if (!draft.name.trim()) { toast('Ponle un nombre a la rutina'); page.querySelector('[data-f=name]').focus(); return; }
        draft.name = draft.name.trim();
        normalizeSupersets(draft.items);
        await saveRoutine(draft);
        toast('Rutina guardada');
        draft = null;
        back();
        return;
      }
      case 'add': {
        const ids = await pickExercises();
        if (ids.length) { dirty = true; ids.forEach((id) => draft.items.push({ exId: id, sets: 3, repsMin: null, repsMax: null, rest: null, supersetId: null })); paint(page); }
        return;
      }
      case 'sets-': case 'sets+':
        it.sets = Math.max(1, Math.min(20, it.sets + (a.dataset.act === 'sets+' ? 1 : -1)));
        a.parentElement.querySelector('output').textContent = it.sets;
        dirty = true;
        return;
      case 'menu': {
        const L = draft.items;
        const items = [];
        if (i < L.length - 1) items.push({ id: 'link', label: it.supersetId && L[i + 1].supersetId === it.supersetId ? 'Separar del siguiente' : 'Superserie con el siguiente', icon: 'link' });
        if (it.supersetId) items.push({ id: 'unlink', label: 'Sacar de la superserie', icon: 'unlink' });
        if (i > 0) items.push({ id: 'up', label: 'Mover arriba', icon: 'arrowUp' });
        if (i < L.length - 1) items.push({ id: 'down', label: 'Mover abajo', icon: 'arrowDown' });
        items.push({ id: 'replace', label: 'Sustituir ejercicio', icon: 'swap' });
        items.push({ id: 'del', label: 'Quitar de la rutina', icon: 'trash', danger: true });
        const r = await actionSheet(items, { title: getEx(it.exId)?.name });
        if (!r) return;
        dirty = true;
        if (r === 'link') {
          if (it.supersetId && L[i + 1].supersetId === it.supersetId) {
            const nid = 'ss' + uid();
            for (let j = i + 1; j < L.length && L[j].supersetId === it.supersetId; j++) L[j].supersetId = nid;
          } else {
            const id = it.supersetId || L[i + 1].supersetId || 'ss' + uid();
            const old = L[i + 1].supersetId;
            it.supersetId = id;
            for (let j = i + 1; j < L.length && (j === i + 1 || (old && L[j].supersetId === old)); j++) L[j].supersetId = id;
          }
        }
        if (r === 'unlink') {
          const id = it.supersetId, nid = 'ss' + uid();
          it.supersetId = null;
          for (let j = i + 1; j < L.length && L[j].supersetId === id; j++) L[j].supersetId = nid;
        }
        if (r === 'up' || r === 'down') { const j = r === 'up' ? i - 1 : i + 1; [L[i], L[j]] = [L[j], L[i]]; }
        if (r === 'replace') { const [id] = await pickExercises({ title: 'Sustituir por…', multi: false }); if (id) it.exId = id; }
        if (r === 'del') L.splice(i, 1);
        normalizeSupersets(L);
        paint(page);
      }
    }
  };
}
