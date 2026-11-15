// Selector de ejercicios (buscador + filtro por músculo) y formulario de ejercicio.
import { html, str, norm, parseNum, inputNum, getUnit, fmtClock } from '../util.js';
import { S, exList, saveExercise, deleteExercise, exerciseUsed } from '../store.js';
import { MUSCLES, EQUIPMENT, KINDS } from '../../data/exercises.js';
import { openSheet, toast, confirmSheet } from './sheet.js';
import { icon } from './icons.js';

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];
export const restLabel = (s) => (s === 0 ? 'Sin descanso' : s < 60 ? `${s} s` : fmtClock(s));

/** Abre el selector. Devuelve los ids elegidos (en orden de selección). */
export function pickExercises({ title = 'Añadir ejercicios', multi = true } = {}) {
  return new Promise((resolve) => {
    const chosen = [];
    let q = '', muscle = '';
    let result = [];
    const usage = new Map();
    for (const w of S.workouts) for (const e of w.exercises) if (!usage.has(e.exId)) usage.set(e.exId, w.start);

    const s = openSheet({
      title, full: true,
      left: html`<button class="nav-btn" data-sheet-close>Cancelar</button>`,
      right: html`<button class="nav-btn strong" data-act="new">Nuevo</button>`,
      body: html`
        <div style="position:sticky;top:0;background:var(--surface);padding:2px 0 10px;z-index:2">
          <div class="search">${icon('search')}<input type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" enterkeyhint="search"></div>
          <div class="chips" style="margin-top:10px">${['', ...MUSCLES].map((m) => html`<button class="chip" data-m="${m}" aria-pressed="${m === ''}">${m || 'Todos'}</button>`)}</div>
        </div>
        <div class="picker-list"></div>`,
      onClose: () => resolve(result),
    });
    const foot = document.createElement('div');
    foot.className = 'picker-foot';
    foot.innerHTML = `<button class="btn btn-primary btn-block btn-lg" data-act="add" disabled>Añadir</button>`;
    if (multi) s.root.append(foot);
    const listEl = s.body.querySelector('.picker-list');
    const addBtn = foot.querySelector('[data-act=add]');

    const paint = () => {
      const words = norm(q).split(/\s+/).filter(Boolean);
      const matches = (e) => { const hay = norm(e.name + ' ' + (e.aliases || []).join(' ')); return words.every((w) => hay.includes(w)); };
      let items = exList().filter((e) => (!muscle || e.muscle === muscle) && matches(e));
      let out = '';
      if (!q && !muscle) {
        const recent = [...items].filter((e) => usage.has(e.id)).sort((a, b) => usage.get(b.id) - usage.get(a.id)).slice(0, 8);
        if (recent.length) out += str(html`<div class="muscle-head">Recientes</div><div class="list">${recent.map(row)}</div>`);
        const groups = MUSCLES.map((m) => [m, items.filter((e) => e.muscle === m)]).filter(([, a]) => a.length);
        out += groups.map(([m, a]) => str(html`<div class="muscle-head">${m}</div><div class="list">${a.map(row)}</div>`)).join('');
      } else {
        out = items.length ? str(html`<div class="list" style="margin-top:6px">${items.map(row)}</div>`)
          : str(html`<div class="empty"><p>No hay resultados para “${q}”.</p><button class="btn" data-act="new">${icon('plus')}Crear “${q}”</button></div>`);
      }
      listEl.innerHTML = out;
      addBtn.textContent = chosen.length ? `Añadir ${chosen.length} ejercicio${chosen.length > 1 ? 's' : ''}` : 'Añadir';
      addBtn.disabled = !chosen.length;
    };
    const row = (e) => html`<button class="row" data-id="${e.id}" aria-pressed="${chosen.includes(e.id)}">
        <div class="grow"><div class="title">${e.name}</div><div class="sub">${e.muscle} · ${EQUIPMENT[e.equipment] || ''}${e.custom ? ' · propio' : ''}</div></div>
        ${multi ? html`<span class="check">${icon('check')}</span>` : icon('chev', 'class="chev"')}
      </button>`;

    s.body.querySelector('input[type=search]').addEventListener('input', (e) => { q = e.target.value; paint(); });
    s.root.addEventListener('click', async (e) => {
      const chip = e.target.closest('[data-m]');
      if (chip) { muscle = chip.dataset.m; s.body.querySelectorAll('[data-m]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip))); paint(); return; }
      const r = e.target.closest('[data-id]');
      if (r) {
        const id = r.dataset.id;
        if (!multi) { result = [id]; s.close(); return; }
        const i = chosen.indexOf(id);
        if (i >= 0) chosen.splice(i, 1); else chosen.push(id);
        r.setAttribute('aria-pressed', String(i < 0));
        addBtn.textContent = chosen.length ? `Añadir ${chosen.length} ejercicio${chosen.length > 1 ? 's' : ''}` : 'Añadir';
        addBtn.disabled = !chosen.length;
        return;
      }
      if (e.target.closest('[data-act=add]')) { result = [...chosen]; s.close(); return; }
      if (e.target.closest('[data-act=new]')) {
        const ex = await editExercise(null, q);
        if (ex) {
          if (!multi) { result = [ex.id]; s.close(); return; }
          chosen.push(ex.id); q = ''; s.body.querySelector('input[type=search]').value = ''; paint();
        }
      }
    });
    paint();
  });
}

/** Formulario para crear o editar un ejercicio. Devuelve el ejercicio guardado o null. */
export function editExercise(ex, presetName = '') {
  return new Promise((resolve) => {
    const isNew = !ex;
    const d = ex ? { ...ex } : { name: presetName, muscle: 'Pecho', equipment: 'maquina', kind: 'weight', rest: null, inc: null, perSide: false, aliases: [], custom: true };
    let saved = null;
    const unit = getUnit();
    const s = openSheet({
      title: isNew ? 'Nuevo ejercicio' : 'Editar ejercicio',
      left: html`<button class="nav-btn" data-sheet-close>Cancelar</button>`,
      right: html`<button class="nav-btn strong" data-act="save">Guardar</button>`,
      body: html`
        <label class="field"><span>Nombre</span><input class="input" name="name" value="${d.name}" autocomplete="off" ${isNew ? 'autofocus' : ''}></label>
        <label class="field"><span>Grupo muscular</span><select class="input" name="muscle">${MUSCLES.map((m) => html`<option ${m === d.muscle ? 'selected' : ''}>${m}</option>`)}</select></label>
        <label class="field"><span>Material</span><select class="input" name="equipment">${Object.entries(EQUIPMENT).map(([k, v]) => html`<option value="${k}" ${k === d.equipment ? 'selected' : ''}>${v}</option>`)}</select></label>
        <label class="field"><span>Qué se registra</span><select class="input" name="kind">${Object.entries(KINDS).map(([k, v]) => html`<option value="${k}" ${k === d.kind ? 'selected' : ''}>${v}</option>`)}</select></label>
        <label class="field"><span>Descanso</span><select class="input" name="rest">
          <option value="">Por defecto (${restLabel(S.settings.defaultRest)})</option>
          ${REST_OPTIONS.map((r) => html`<option value="${r}" ${d.rest === r ? 'selected' : ''}>${restLabel(r)}</option>`)}</select></label>
        <label class="field"><span>Incremento de los botones +/− (${unit})</span>
          <input class="input" name="inc" inputmode="decimal" placeholder="Por defecto (${inputNum(unit === 'lb' ? S.settings.incLb : S.settings.incKg)})" value="${d.inc != null ? inputNum(unit === 'lb' ? d.inc / 0.45359237 : d.inc) : ''}"></label>
        <div class="list" style="margin-bottom:6px"><label class="row"><div class="grow"><div class="title">Mostrar peso por lado (÷ 2)</div><div class="sub">Para máquinas de discos: si apuntas 27,5 te dice 13,75 por lado.</div></div>
          <span class="switch"><input type="checkbox" name="perSide" ${d.perSide ? 'checked' : ''}><span></span></span></label></div>
        <p class="footnote">En los ejercicios con barra se muestra siempre la calculadora de discos completa.</p>
        ${!isNew && d.custom ? html`<button class="btn btn-danger btn-block" style="margin-top:18px" data-act="delete">${icon('trash')}Eliminar ejercicio</button>` : ''}
      `,
      onClose: () => resolve(saved),
    });
    const f = (n) => s.body.querySelector(`[name=${n}]`);
    s.root.addEventListener('click', async (e) => {
      if (e.target.closest('[data-act=save]')) {
        const name = f('name').value.trim();
        if (!name) { toast('Escribe un nombre'); f('name').focus(); return; }
        const dup = exList().find((x) => x.id !== d.id && norm(x.name) === norm(name));
        if (dup) { toast('Ya existe un ejercicio con ese nombre'); return; }
        const incV = parseNum(f('inc').value);
        Object.assign(d, {
          name, muscle: f('muscle').value, equipment: f('equipment').value, kind: f('kind').value,
          rest: f('rest').value === '' ? null : Number(f('rest').value),
          inc: incV && incV > 0 ? (unit === 'lb' ? incV * 0.45359237 : incV) : null,
          perSide: f('perSide').checked,
        });
        saved = await saveExercise(d);
        s.close();
      }
      if (e.target.closest('[data-act=delete]')) {
        if (exerciseUsed(d.id)) { toast('Tiene historial o está en una rutina: no se puede eliminar'); return; }
        if (await confirmSheet(`Se eliminará “${d.name}”.`, { ok: 'Eliminar', danger: true })) { await deleteExercise(d.id); s.close(); }
      }
    });
  });
}

