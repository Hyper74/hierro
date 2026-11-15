// ─────────────────────────────────────────────────────────────
// Entreno activo (y edición de entrenos pasados).
//
// · Se muestra en una capa a pantalla completa (#workoutLayer) que se
//   puede minimizar para consultar otras pantallas.
// · Cada cambio se guarda en IndexedDB (clave "active"): si la app se
//   cierra o se recarga, el entreno se recupera tal cual, incluido el
//   temporizador de descanso (basado en la hora de finalización).
// ─────────────────────────────────────────────────────────────
import {
  html, str, el, uid, debounce, parseNum, inputNum, toDisp, fromDisp, fmtW, fmtNum, fmtClock, fmtSecs,
  getUnit, fmtDay, fmtTime, fmtShort, toLocalInput, round,
} from '../util.js';
import { S, getEx, exName, kindOf, restOf, saveActive, saveWorkout, getWorkout } from '../store.js';
import { lastSession, topSet } from '../core/stats.js';
import { computeRecords, PR_LABEL } from '../core/prs.js';
import { icon } from '../ui/icons.js';
import { actionSheet, confirmSheet, toast, openSheet } from '../ui/sheet.js';
import { pickExercises, REST_OPTIONS, restLabel } from '../ui/picker.js';
import { plateInfoHTML } from '../ui/plateInfo.js';
import { unlockAudio, beep, startBackgroundBeep, stopBackgroundBeep } from '../sound.js';
import { enableWake, disableWake, wakeSupported } from '../wakelock.js';
import { defaultTitle } from '../actions.js';
import { showSummary } from './summary.js';
import { go, refresh } from '../router.js';

let W = null;            // entreno mostrado (S.active en modo "live" o borrador en modo "edit")
let mode = 'live';
let activeKey = null;    // "ei:si" de la serie activa
let flags = new Map();   // PRs de las series del entreno mostrado
let tickT = null;
let finishedUntil = 0;   // para mostrar "descanso terminado" unos segundos

const layer = () => document.getElementById('workoutLayer');
const mini = () => document.getElementById('miniWorkout');
const persist = debounce(() => { if (mode === 'live' && W) saveActive(W); }, 250);

// ── Construcción ────────────────────────────────────────────

/** Crea un bloque de ejercicio con los valores de la última vez. */
function buildBlock(exId, { sets: n = null, repsMin = null, repsMax = null, rest = null, supersetId = null, excludeWid = null } = {}) {
  const last = lastSession(exId, S.workouts, excludeWid);
  const lastSets = last ? last.sets : [];
  const count = n ?? (lastSets.length || 3);
  const sets = Array.from({ length: count }, (_, i) => {
    const p = lastSets[i] || null;
    const fill = p || lastSets[lastSets.length - 1] || null;
    return {
      type: p?.type || 'normal',
      weight: fill?.weight ?? null,
      reps: fill?.reps ?? null,
      time: fill?.time ?? null,
      done: false,
      prev: p ? { weight: p.weight ?? null, reps: p.reps ?? null, time: p.time ?? null } : null,
    };
  });
  return { exId, notes: '', supersetId, rest, repsMin, repsMax, sets };
}

/** Empieza un entreno: vacío, desde una rutina o repitiendo uno anterior. */
export async function startWorkout({ routine = null, from = null } = {}) {
  if (S.active) {
    const r = await actionSheet([
      { id: 'resume', label: 'Continuar el entreno en curso', bold: true },
      { id: 'discard', label: 'Descartarlo y empezar otro', danger: true },
    ], { title: 'Ya tienes un entreno en curso' });
    if (r === 'resume') return openLayer();
    if (r !== 'discard') return;
    await discard(true);
  }
  unlockAudio();
  const now = Date.now();
  let exercises = [];
  let title = defaultTitle(now);
  if (routine) {
    title = routine.name;
    exercises = routine.items.filter((it) => getEx(it.exId)).map((it) => buildBlock(it.exId, { sets: it.sets, repsMin: it.repsMin, repsMax: it.repsMax, rest: it.rest, supersetId: it.supersetId }));
  } else if (from) {
    title = from.title;
    exercises = from.exercises.filter((e) => getEx(e.exId)).map((e) => buildBlock(e.exId, { sets: e.sets.length, rest: e.rest, supersetId: e.supersetId }));
  }
  W = { id: 'live-' + uid(), title, start: now, notes: '', routineId: routine?.id || null, exercises, rest: null };
  normalizeSupersets(W.exercises);
  mode = 'live';
  activeKey = null;
  await saveActive(W);
  if (S.settings.wakeLock) enableWake();
  openLayer(true);
}

/** Abre un entreno pasado para editarlo. */
export function editWorkout(wid) {
  const w = getWorkout(wid);
  if (!w) return;
  if (S.active && mode === 'live' && !layer().hidden) minimize();
  W = structuredClone(w);
  W.editingId = w.id;
  W.exercises.forEach((e) => e.sets.forEach((s) => { s.done = s.done !== false; }));
  mode = 'edit';
  activeKey = null;
  openLayer(true);
}

/** Al arrancar la app: recupera el entreno en curso. */
export function restoreActive() {
  if (!S.active) return;
  W = S.active;
  mode = 'live';
  if (S.settings.wakeLock) enableWake();
  openLayer(false);
  if (W.rest && W.rest.endAt < Date.now() - 60000) { W.rest = null; persist(); }
  toast('Entreno recuperado');
}

// ── Capa ────────────────────────────────────────────────────

export function openLayer(animate = false) {
  if (mode === 'live') W = S.active || W;
  if (!W) return;
  const L = layer();
  L.hidden = false;
  L.classList.remove('min');
  if (animate) { L.classList.remove('enter'); void L.offsetWidth; L.classList.add('enter'); }
  mini().hidden = true;
  render();
  startTick();
}

export function minimize() {
  if (mode !== 'live') return;
  persist.flush();
  layer().classList.add('min');
  setTimeout(() => { if (layer().classList.contains('min')) layer().hidden = true; }, 400);
  paintMini();
}

function closeLayer() {
  const L = layer();
  L.classList.add('min');
  setTimeout(() => { L.hidden = true; L.innerHTML = ''; L.classList.remove('min'); }, 400);
  stopTick();
  mini().hidden = true;
}

function paintMini() {
  const m = mini();
  if (!S.active) { m.hidden = true; return; }
  m.hidden = false;
  const el2 = Math.floor((Date.now() - S.active.start) / 1000);
  const rest = S.active.rest ? Math.ceil((S.active.rest.endAt - Date.now()) / 1000) : null;
  m.innerHTML = str(html`<span class="dot" aria-hidden="true"></span>
    <div class="grow"><b class="ellipsis">${S.active.title}</b><span class="muted small num">${fmtClock(el2)}${rest > 0 ? ` · descanso ${fmtClock(rest)}` : ''}</span></div>
    ${icon('up')}`);
  m.setAttribute('aria-label', `Volver al entreno en curso: ${S.active.title}`);
}

// ── Tiempo: reloj del entreno y descanso ────────────────────

function startTick() {
  stopTick();
  tick();
  tickT = setInterval(tick, 250);
}
function stopTick() { clearInterval(tickT); tickT = null; }

function tick() {
  if (!W) return;
  const L = layer();
  if (mode === 'live') {
    const clock = L.querySelector('[data-clock]');
    if (clock) clock.textContent = fmtClock((Date.now() - W.start) / 1000);
    if (L.hidden || L.classList.contains('min')) paintMini();
  }
  paintRest();
}

function paintRest() {
  const bar = layer().querySelector('.rest-bar');
  if (!bar || mode !== 'live') return;
  const now = Date.now();
  if (W.rest) {
    const left = (W.rest.endAt - now) / 1000;
    if (left <= 0) { restFinished(); return; }
    bar.classList.add('show'); bar.classList.remove('finished');
    bar.querySelector('.fill').style.transform = `scaleX(${Math.max(0, Math.min(1, left / W.rest.total))})`;
    bar.querySelector('.time').innerHTML = `${fmtClock(Math.ceil(left))}<small>DESCANSO · ${str(html`${W.rest.label || ''}`)}</small>`;
    bar.setAttribute('aria-label', `Descanso: quedan ${Math.ceil(left)} segundos`);
  } else if (finishedUntil > now) {
    bar.classList.add('show', 'finished');
    bar.querySelector('.time').innerHTML = '¡A por la siguiente!<small>DESCANSO TERMINADO</small>';
  } else {
    bar.classList.remove('show', 'finished');
  }
}

function restFinished() {
  const late = Date.now() - W.rest.endAt;
  W.rest = null;
  stopBackgroundBeep();
  persist();
  if (late < 60000) {
    finishedUntil = Date.now() + 6000;
    beep();
    const f = el('<div class="flash" aria-hidden="true"></div>');
    document.body.append(f);
    setTimeout(() => f.remove(), 1700);
    const bar = layer().querySelector('.rest-bar');
    bar?.setAttribute('aria-label', 'Descanso terminado');
  }
  paintRest();
}

function startRest(seconds, label) {
  if (!(seconds > 0)) return;
  W.rest = { endAt: Date.now() + seconds * 1000, total: seconds, label };
  finishedUntil = 0;
  startBackgroundBeep(seconds, `Descanso · ${label}`);
  persist();
  paintRest();
}

function adjustRest(delta) {
  if (!W.rest) return;
  unlockAudio();
  W.rest.endAt += delta * 1000;
  if (delta > 0) W.rest.total += delta;
  const left = (W.rest.endAt - Date.now()) / 1000;
  if (left <= 0) { W.rest = null; stopBackgroundBeep(); finishedUntil = 0; persist(); paintRest(); return; }
  startBackgroundBeep(left, 'Descanso');
  persist();
  paintRest();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist.flush?.();
  else if (W) tick();
});

// ── PRs en directo ──────────────────────────────────────────

function computeFlags() {
  const ids = new Set(W.exercises.map((e) => e.exId));
  const others = S.workouts.filter((w) => w.id !== W.editingId && w.exercises.some((e) => ids.has(e.exId)));
  const pseudo = { id: '__w', start: W.start, exercises: W.exercises };
  const rec = computeRecords([...others, pseudo], kindOf);
  const out = new Map();
  for (const [k, v] of rec.setFlags) if (k.startsWith('__w:')) out.set(k.slice(4), v);
  return out;
}

// ── Pintado ─────────────────────────────────────────────────

const SET_LABEL = { warmup: 'C', drop: 'D', failure: 'F' };
const SET_NAME = { normal: 'Normal', warmup: 'Calentamiento', drop: 'Drop set', failure: 'Al fallo' };

function render() {
  const L = layer();
  const sc = L.querySelector('.scroll');
  const top = sc ? sc.scrollTop : 0;
  flags = computeFlags();
  if (!activeKey) activeKey = firstUndone();
  const letters = supersetLetters(W.exercises);
  const live = mode === 'live';

  L.innerHTML = str(html`
    <header class="wk-head">
      ${live
        ? html`<button class="icon-btn" data-act="min" aria-label="Minimizar entreno">${icon('down')}</button>
               <div class="clock"><b data-clock>${fmtClock((Date.now() - W.start) / 1000)}</b><small>${fmtDay(W.start)}</small></div>
               <button class="icon-btn" data-act="menu" aria-label="Opciones del entreno">${icon('more')}</button>
               <button class="btn btn-primary btn-sm" data-act="finish">Terminar</button>`
        : html`<button class="nav-btn" data-act="cancelEdit">Cancelar</button>
               <div class="clock"><b>Editar entreno</b></div>
               <button class="btn btn-primary btn-sm" data-act="saveEdit">Guardar</button>`}
    </header>
    <div class="scroll wk-body">
      <label class="sr-only" for="wkTitle">Nombre del entreno</label>
      <input id="wkTitle" class="wk-title" data-f="title" value="${W.title}" autocomplete="off" enterkeyhint="done">
      ${live
        ? html`<div class="wk-meta">${fmtDay(W.start)} · ${fmtTime(W.start)}${W.routineId ? ' · rutina' : ''}</div>`
        : html`<div class="wk-edit-times">
            <label class="field" style="margin:0"><span>Inicio</span><input class="input" type="datetime-local" data-f="start" value="${toLocalInput(W.start)}"></label>
            <label class="field" style="margin:0"><span>Duración (min)</span><input class="input" inputmode="numeric" pattern="[0-9]*" data-f="dur" value="${Math.round(((W.end || W.start) - W.start) / 60000)}"></label>
          </div>`}
      ${W.exercises.length ? '' : html`<div class="empty" style="padding:30px 10px 10px"><p>Añade el primer ejercicio para empezar a registrar series.</p></div>`}
      ${W.exercises.map((e, ei) => exerciseHTML(e, ei, letters))}
      <button class="btn btn-block" style="margin-top:6px" data-act="addEx">${icon('plus')}Añadir ejercicios</button>
      <label class="field" style="margin-top:18px"><span>Notas del entreno</span>
        <textarea class="input" data-f="notes" rows="2" placeholder="Cómo te has sentido, molestias…">${W.notes || ''}</textarea></label>
      ${live ? html`<button class="btn btn-ghost btn-block danger" style="color:var(--danger)" data-act="discard">Descartar entreno</button>` : ''}
    </div>
    ${live ? html`<div class="rest-bar" role="timer" aria-live="off">
      <div class="fill"></div>
      <button data-act="rest-" aria-label="Restar 15 segundos">−15</button>
      <div class="time num"></div>
      <button data-act="rest+" aria-label="Sumar 15 segundos">+15</button>
      <button class="skip" data-act="skip" aria-label="Saltar o cerrar el descanso">Saltar</button>
    </div>` : ''}
  `);
  const sc2 = L.querySelector('.scroll');
  sc2.scrollTop = top;
  bind(L);
  paintRest();
}

function exerciseHTML(e, ei, letters) {
  const ex = getEx(e.exId) || { name: 'Ejercicio eliminado', kind: 'weight', equipment: 'otro' };
  const kind = ex.kind;
  const last = lastSession(e.exId, S.workouts, W.editingId);
  const ts = last ? topSet(last.sets) : null;
  const ss = e.supersetId;
  const prevSame = ss && W.exercises[ei - 1]?.supersetId === ss;
  const nextSame = ss && W.exercises[ei + 1]?.supersetId === ss;
  const u = getUnit();
  const colW = kind === 'reps' ? '' : kind === 'weighted' ? `+${u}` : u;
  const colR = kind === 'time' ? 'Seg' : 'Reps';
  const rest = e.rest ?? restOf(e.exId);
  let n = 0;
  return html`
  <section class="wk-ex ${ss ? 'ss' : ''} ${nextSame ? 'ss-mid' : ''} ${prevSame ? 'ss-next' : ''}" data-ei="${ei}" aria-label="${ex.name}">
    ${ss && !prevSame ? html`<div class="ss-tag">${icon('link', 'style="width:12px;height:12px;vertical-align:-1px"')} Superserie ${letters.get(ss)}</div>` : ''}
    <div class="wk-ex-head">
      <button class="wk-ex-name" data-act="exmenu">${ex.name}</button>
      <button class="icon-btn" data-act="exmenu" aria-label="Opciones de ${ex.name}">${icon('more')}</button>
    </div>
    ${ts ? html`<div class="wk-last">Última vez · ${fmtShort(last.date)}: <b>${setText(ts, kind)}</b></div>` : html`<div class="wk-last">Primera vez con este ejercicio</div>`}
    ${mode === 'live' && !(ss && nextSame) ? html`<button class="wk-rest-chip" data-act="rest">${icon('timer')} Descanso: ${restLabel(rest)}</button>` : ''}
    ${e.notes || e.showNotes ? html`<div class="wk-note"><textarea class="input" rows="1" data-f="exnotes" placeholder="Nota del ejercicio" aria-label="Nota de ${ex.name}">${e.notes || ''}</textarea></div>` : ''}
    <div class="sets-head" aria-hidden="true"><span>Serie</span><span>Anterior</span><span>${colW || '—'}</span><span>${colR}</span><span>${icon('check', 'style="width:14px;height:14px"')}</span></div>
    ${e.sets.map((s, si) => {
      if (s.type === 'normal') n++;
      return setHTML(e, ex, s, ei, si, s.type === 'normal' ? n : null);
    })}
    <button class="add-set" data-act="addSet">${icon('plus')}Añadir serie</button>
  </section>`;
}

function setHTML(e, ex, s, ei, si, num) {
  const key = `${ei}:${si}`;
  const kind = ex.kind;
  const pr = flags.get(key);
  const active = key === activeKey;
  const u = getUnit();
  const placeholderReps = e.repsMin ? (e.repsMax && e.repsMax !== e.repsMin ? `${e.repsMin}-${e.repsMax}` : String(e.repsMin)) : '0';
  const prevTxt = s.prev ? setText(s.prev, kind, false) : '–';
  const inc = incDisp(ex);
  const wInput = kind === 'reps'
    ? html`<span class="set-in na" aria-hidden="true">—</span>`
    : html`<input class="set-in" data-f="w" inputmode="decimal" enterkeyhint="next" autocomplete="off"
        value="${inputNum(toDisp(s.weight))}" placeholder="${kind === 'weighted' ? '0' : kind === 'time' ? '–' : '0'}"
        aria-label="Peso serie ${si + 1} en ${u}${kind === 'weighted' ? ' (lastre)' : ''}">`;
  const rInput = kind === 'time'
    ? html`<input class="set-in" data-f="t" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" value="${s.time ?? ''}" placeholder="0" aria-label="Segundos serie ${si + 1}">`
    : html`<input class="set-in" data-f="r" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" value="${s.reps ?? ''}" placeholder="${placeholderReps}" aria-label="Repeticiones serie ${si + 1}">`;
  const steps = [];
  if (kind !== 'reps') steps.push([`w-`, `−${fmtNum(inc)}`, `Restar ${fmtNum(inc)} ${u}`], [`w+`, `+${fmtNum(inc)}`, `Sumar ${fmtNum(inc)} ${u}`]);
  if (kind === 'time') steps.push(['t-', '−5 s', 'Restar 5 segundos'], ['t+', '+5 s', 'Sumar 5 segundos']);
  else steps.push(['r-', '−1 rep', 'Restar una repetición'], ['r+', '+1 rep', 'Sumar una repetición']);
  return html`
  <div class="set-row ${s.done ? 'done' : ''} ${active ? 'active' : ''}" data-si="${si}">
    <div class="cells">
      <button class="set-type ${s.type}" data-act="settype" aria-label="Serie ${si + 1}: ${SET_NAME[s.type]}. Cambiar tipo">${SET_LABEL[s.type] || num}</button>
      <span class="prev" aria-label="Anterior: ${prevTxt}">${prevTxt}</span>
      ${wInput}
      ${rInput}
      <button class="chk" data-act="done" aria-pressed="${!!s.done}" aria-label="Serie ${si + 1} completada">${icon('check')}</button>
    </div>
    ${pr ? html`<div class="pr-line"><span class="pr-badge">${icon('trophy')}PR</span> ${pr.map((t) => PR_LABEL[t]).join(' · ')}</div>` : ''}
    <div class="steppers">${steps.map(([a, t, l]) => html`<button data-step="${a}" aria-label="${l}">${t}</button>`)}</div>
    <div class="plate-info">${{ __raw: active ? plateInfoHTML(ex, s.weight) : '' }}</div>
  </div>`;
}

/** Texto de una serie: "80 kg × 8", "× 12", "45 s". */
export function setText(s, kind, unit = true) {
  if (kind === 'time') return (s.weight > 0 ? fmtW(s.weight, unit) + ' · ' : '') + fmtSecs(s.time);
  if (kind === 'reps') return `${s.reps ?? '–'} reps`;
  if (kind === 'weighted') return s.weight > 0 ? `+${fmtW(s.weight, unit)} × ${s.reps ?? '–'}` : `${s.reps ?? '–'} reps`;
  return `${s.weight != null ? fmtW(s.weight, unit) : '–'} × ${s.reps ?? '–'}`;
}

function incDisp(ex) {
  if (ex.inc) return getUnit() === 'lb' ? round(ex.inc / 0.45359237, 2) : ex.inc;
  return getUnit() === 'lb' ? S.settings.incLb : S.settings.incKg;
}

function supersetLetters(list) {
  const m = new Map();
  for (const e of list) if (e.supersetId && !m.has(e.supersetId)) m.set(e.supersetId, String.fromCharCode(65 + m.size));
  return m;
}

/** Deja las superseries coherentes: solo bloques contiguos con ≥2 ejercicios. */
export function normalizeSupersets(list) {
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const id = list[i].supersetId;
    if (!id) continue;
    if (seen.has(id) && list[i - 1]?.supersetId !== id) {
      // grupo partido: el trozo nuevo recibe otro id
      const nid = 'ss' + uid();
      for (let j = i; j < list.length && list[j].supersetId === id; j++) list[j].supersetId = nid;
    }
    seen.add(list[i].supersetId);
  }
  for (let i = 0; i < list.length; i++) {
    const id = list[i].supersetId;
    if (id && list[i - 1]?.supersetId !== id && list[i + 1]?.supersetId !== id) list[i].supersetId = null;
  }
}

function firstUndone() {
  for (let ei = 0; ei < W.exercises.length; ei++) {
    const si = W.exercises[ei].sets.findIndex((s) => !s.done);
    if (si >= 0) return `${ei}:${si}`;
  }
  return null;
}

/** Siguiente serie tras completar una (respetando superseries). */
function nextAfter(ei, si) {
  const ex = W.exercises;
  const id = ex[ei].supersetId;
  if (id) {
    const group = ex.map((e, i) => (e.supersetId === id ? i : -1)).filter((i) => i >= 0);
    const pos = group.indexOf(ei);
    for (let round = si; round < si + 50; round++) {
      for (let g = round === si ? pos + 1 : 0; g < group.length; g++) {
        const s = ex[group[g]].sets[round];
        if (s && !s.done) return `${group[g]}:${round}`;
      }
      if (group.every((gi) => round + 1 >= ex[gi].sets.length)) break;
    }
  }
  const same = ex[ei].sets.findIndex((s, i) => i > si && !s.done);
  if (same >= 0) return `${ei}:${same}`;
  for (let i = ei + 1; i < ex.length; i++) {
    const k = ex[i].sets.findIndex((s) => !s.done);
    if (k >= 0) return `${i}:${k}`;
  }
  return firstUndone();
}

function setActive(key) {
  if (key === activeKey) return;
  activeKey = key;
  const L = layer();
  L.querySelectorAll('.set-row.active').forEach((r) => { r.classList.remove('active'); r.querySelector('.plate-info').innerHTML = ''; });
  if (!key) return;
  const [ei, si] = key.split(':').map(Number);
  const row = L.querySelector(`.wk-ex[data-ei="${ei}"] .set-row[data-si="${si}"]`);
  if (row) { row.classList.add('active'); updatePlateInfo(ei, si, row); }
}

function updatePlateInfo(ei, si, row) {
  const e = W.exercises[ei];
  row.querySelector('.plate-info').innerHTML = plateInfoHTML(getEx(e.exId), e.sets[si].weight);
}

// ── Eventos ─────────────────────────────────────────────────

function bind(L) {
  L.oninput = (ev) => {
    const t = ev.target;
    const f = t.dataset.f;
    if (!f) return;
    if (f === 'title') W.title = t.value;
    else if (f === 'notes') W.notes = t.value;
    else if (f === 'start') { const v = new Date(t.value).getTime(); if (Number.isFinite(v)) { const d = (W.end || W.start) - W.start; W.start = v; W.end = v + d; } }
    else if (f === 'dur') { const m = parseInt(t.value, 10); if (m >= 0) W.end = W.start + m * 60000; }
    else {
      const sec = t.closest('.wk-ex'); if (!sec) return;
      const ei = +sec.dataset.ei;
      const e = W.exercises[ei];
      if (f === 'exnotes') e.notes = t.value;
      else {
        const si = +t.closest('.set-row').dataset.si;
        const s = e.sets[si];
        if (f === 'w') { const v = parseNum(t.value); s.weight = v == null ? null : fromDisp(v); updatePlateInfo(ei, si, t.closest('.set-row')); }
        if (f === 'r') { const v = parseNum(t.value); s.reps = v == null ? null : Math.max(0, Math.round(v)); }
        if (f === 't') { const v = parseNum(t.value); s.time = v == null ? null : Math.max(0, Math.round(v)); }
      }
    }
    persist();
  };
  L.onfocusin = (ev) => {
    const row = ev.target.closest('.set-row');
    if (row && ev.target.matches('.set-in')) {
      setActive(`${row.closest('.wk-ex').dataset.ei}:${row.dataset.si}`);
      // Seleccionar el contenido facilita sobrescribir con el teclado numérico
      setTimeout(() => { try { ev.target.select(); } catch { /* nada */ } }, 0);
    }
  };
  L.onclick = onClick;
}

async function onClick(ev) {
  unlockAudio(); // cada toque mantiene el audio desbloqueado en iOS
  const stepB = ev.target.closest('[data-step]');
  if (stepB) return step(stepB);
  const a = ev.target.closest('[data-act]');
  const row = ev.target.closest('.set-row');
  if (!a) {
    if (row) setActive(`${row.closest('.wk-ex').dataset.ei}:${row.dataset.si}`);
    return;
  }
  const sec = a.closest('.wk-ex');
  const ei = sec ? +sec.dataset.ei : -1;
  const si = row ? +row.dataset.si : -1;
  switch (a.dataset.act) {
    case 'min': return minimize();
    case 'finish': return finish();
    case 'menu': return workoutMenu();
    case 'discard': return discard();
    case 'cancelEdit': return cancelEdit();
    case 'saveEdit': return saveEdit();
    case 'addEx': return addExercises();
    case 'exmenu': return exerciseMenu(ei);
    case 'rest': return chooseRest(ei);
    case 'addSet': return addSet(ei);
    case 'settype': return setTypeMenu(ei, si);
    case 'done': return toggleDone(ei, si, row);
    case 'rest-': return adjustRest(-15);
    case 'rest+': return adjustRest(15);
    case 'skip': W.rest = null; finishedUntil = 0; stopBackgroundBeep(); persist(); return paintRest();
  }
}

function step(b) {
  const row = b.closest('.set-row');
  const ei = +row.closest('.wk-ex').dataset.ei, si = +row.dataset.si;
  const e = W.exercises[ei], s = e.sets[si], ex = getEx(e.exId);
  const a = b.dataset.step;
  if (a[0] === 'w') {
    const inc = incDisp(ex) * (a[1] === '+' ? 1 : -1);
    const cur = toDisp(s.weight) || 0;
    const nv = Math.max(0, round(cur + inc, 2));
    s.weight = nv === 0 ? (ex.kind === 'weight' ? 0 : null) : fromDisp(nv);
    row.querySelector('[data-f=w]').value = inputNum(nv);
    updatePlateInfo(ei, si, row);
  } else if (a[0] === 'r') {
    // Sin valor todavía: el primer toque coloca el objetivo de la rutina
    s.reps = s.reps == null && e.repsMin ? e.repsMin : Math.max(0, (s.reps || 0) + (a[1] === '+' ? 1 : -1));
    row.querySelector('[data-f=r]').value = s.reps;
  } else if (a[0] === 't') {
    s.time = Math.max(0, (s.time || 0) + (a[1] === '+' ? 5 : -5));
    row.querySelector('[data-f=t]').value = s.time;
  }
  persist();
}

function toggleDone(ei, si, row) {
  const e = W.exercises[ei], s = e.sets[si], ex = getEx(e.exId) || { kind: 'weight', name: '' };
  if (!s.done) {
    // Valores que faltan: se toman del objetivo de la rutina o se pide al usuario
    if (ex.kind === 'time') {
      if (!(s.time > 0)) { toast('Indica los segundos'); row.querySelector('[data-f=t]')?.focus(); return; }
    } else if (s.reps == null) {
      if (e.repsMin) s.reps = e.repsMin;
      else { toast('Indica las repeticiones'); row.querySelector('[data-f=r]')?.focus(); return; }
    }
    if (ex.kind === 'weight' && s.weight == null) s.weight = 0;
    s.done = true;
    const before = flags;
    const after = computeFlags();
    const key = `${ei}:${si}`;
    const newPR = after.get(key) && !before.get(key);
    // Descanso (en superseries, solo tras el último ejercicio del grupo)
    if (mode === 'live') {
      const id = e.supersetId;
      const lastOfGroup = !id || W.exercises[ei + 1]?.supersetId !== id;
      if (lastOfGroup) startRest(e.rest ?? restOf(e.exId), ex.name);
      else toast(`Superserie → ${exName(W.exercises[ei + 1].exId)}`, { ms: 1500 });
    }
    activeKey = nextAfter(ei, si);
    persist();
    render();
    if (newPR) celebrate(ei, si, after.get(key), ex.name);
  } else {
    s.done = false;
    persist();
    render();
  }
}

function celebrate(ei, si, types, name) {
  const row = layer().querySelector(`.wk-ex[data-ei="${ei}"] .set-row[data-si="${si}"]`);
  row?.classList.add('pop');
  toast(`🏆 PR · ${name}: ${types.map((t) => PR_LABEL[t]).join(', ')}`, { pr: true, ms: 3000 });
}

function addSet(ei) {
  const e = W.exercises[ei];
  const last = e.sets[e.sets.length - 1];
  e.sets.push({ type: 'normal', weight: last?.weight ?? null, reps: last?.reps ?? null, time: last?.time ?? null, done: false, prev: null });
  activeKey = `${ei}:${e.sets.length - 1}`;
  persist();
  render();
}

async function setTypeMenu(ei, si) {
  const e = W.exercises[ei];
  const r = await actionSheet([
    { id: 'normal', label: 'Normal' }, { id: 'warmup', label: 'Calentamiento (C)' },
    { id: 'drop', label: 'Drop set (D)' }, { id: 'failure', label: 'Al fallo (F)' },
    { id: 'del', label: 'Eliminar serie', danger: true, icon: 'trash' },
  ], { title: `Serie ${si + 1}`, message: 'Las series de calentamiento no cuentan para récords ni volumen.' });
  if (!r) return;
  if (r === 'del') { e.sets.splice(si, 1); activeKey = null; }
  else e.sets[si].type = r;
  persist();
  render();
}

async function exerciseMenu(ei) {
  const e = W.exercises[ei];
  const ex = getEx(e.exId);
  const inSS = !!e.supersetId;
  const items = [
    { id: 'note', label: e.notes || e.showNotes ? 'Quitar nota' : 'Añadir nota', icon: 'note' },
  ];
  if (ei < W.exercises.length - 1) items.push({ id: 'link', label: inSS && W.exercises[ei + 1]?.supersetId === e.supersetId ? 'Separar del siguiente' : 'Superserie con el siguiente', icon: 'link' });
  if (inSS) items.push({ id: 'unlink', label: 'Sacar de la superserie', icon: 'unlink' });
  if (ei > 0) items.push({ id: 'up', label: 'Mover arriba', icon: 'arrowUp' });
  if (ei < W.exercises.length - 1) items.push({ id: 'down', label: 'Mover abajo', icon: 'arrowDown' });
  items.push({ id: 'replace', label: 'Sustituir ejercicio', icon: 'swap' });
  if (mode === 'live') items.push({ id: 'progress', label: 'Ver progreso', icon: 'chart' });
  items.push({ id: 'remove', label: 'Quitar ejercicio', danger: true, icon: 'trash' });
  const r = await actionSheet(items, { title: ex?.name });
  if (!r) return;
  const list = W.exercises;
  if (r === 'note') { if (e.notes || e.showNotes) { e.notes = ''; e.showNotes = false; } else e.showNotes = true; }
  if (r === 'link') {
    const nx = list[ei + 1];
    if (inSS && nx.supersetId === e.supersetId) {
      // separar: todo lo que sigue recibe un id nuevo
      const nid = 'ss' + uid();
      for (let j = ei + 1; j < list.length && list[j].supersetId === e.supersetId; j++) list[j].supersetId = nid;
    } else {
      const id = e.supersetId || nx.supersetId || 'ss' + uid();
      const old = nx.supersetId;
      e.supersetId = id;
      for (let j = ei + 1; j < list.length && (j === ei + 1 || (old && list[j].supersetId === old)); j++) list[j].supersetId = id;
    }
  }
  if (r === 'unlink') {
    const id = e.supersetId;
    e.supersetId = null;
    const nid = 'ss' + uid();
    for (let j = ei + 1; j < list.length && list[j].supersetId === id; j++) list[j].supersetId = nid;
  }
  if (r === 'up' || r === 'down') {
    const j = r === 'up' ? ei - 1 : ei + 1;
    [list[ei], list[j]] = [list[j], list[ei]];
    activeKey = null;
  }
  if (r === 'replace') {
    const [id] = await pickExercises({ title: 'Sustituir por…', multi: false });
    if (!id) return;
    const nb = buildBlock(id, { sets: e.sets.length, supersetId: e.supersetId, excludeWid: W.editingId });
    list[ei] = { ...nb, notes: e.notes };
  }
  if (r === 'progress') { minimize(); go(`#/progreso/${e.exId}`); return; }
  if (r === 'remove') {
    if (e.sets.some((s) => s.done) && !(await confirmSheet('Tiene series completadas que se perderán.', { title: `¿Quitar ${ex?.name || 'ejercicio'}?`, ok: 'Quitar', danger: true }))) return;
    list.splice(ei, 1);
    activeKey = null;
  }
  normalizeSupersets(list);
  persist();
  render();
}

async function chooseRest(ei) {
  const e = W.exercises[ei];
  const cur = e.rest ?? restOf(e.exId);
  const r = await actionSheet(REST_OPTIONS.map((s) => ({ id: String(s), label: restLabel(s) + (s === cur ? '  ✓' : ''), bold: s === cur })), { title: 'Descanso tras cada serie', message: 'Solo para este entreno. El descanso por defecto se cambia en el ejercicio.' });
  if (r == null) return;
  e.rest = Number(r);
  persist();
  render();
}

async function addExercises() {
  const ids = await pickExercises();
  if (!ids.length) return;
  for (const id of ids) W.exercises.push(buildBlock(id, { excludeWid: W.editingId, sets: mode === 'edit' ? 1 : null }));
  if (mode === 'edit') W.exercises.slice(-ids.length).forEach((e) => e.sets.forEach((s) => { s.done = true; }));
  activeKey = null;
  persist();
  render();
  const sc = layer().querySelector('.scroll');
  const lastSec = layer().querySelectorAll('.wk-ex');
  lastSec[W.exercises.length - ids.length]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (sc) void sc;
}

async function workoutMenu() {
  const items = [];
  if (wakeSupported()) items.push({ id: 'wake', label: S.settings.wakeLock ? 'Permitir que la pantalla se apague' : 'Mantener la pantalla encendida', icon: 'sun' });
  items.push({ id: 'discard', label: 'Descartar entreno', danger: true, icon: 'trash' });
  const r = await actionSheet(items, { title: W.title });
  if (r === 'wake') {
    const { saveSettings } = await import('../store.js');
    await saveSettings({ wakeLock: !S.settings.wakeLock });
    if (S.settings.wakeLock) { enableWake(); toast('La pantalla se mantendrá encendida'); } else { disableWake(); toast('La pantalla podrá apagarse'); }
  }
  if (r === 'discard') discard();
}

async function discard(silent = false) {
  if (!silent && !(await confirmSheet('Se perderán todas las series de este entreno.', { title: '¿Descartar entreno?', ok: 'Descartar', danger: true }))) return;
  W = null;
  stopBackgroundBeep();
  disableWake();
  await saveActive(null);
  closeLayer();
}

/** Convierte el borrador en un entreno guardable (solo series completadas). */
function toWorkout(src) {
  const w = {
    id: src.editingId || 'w-' + uid(),
    title: (src.title || '').trim() || defaultTitle(src.start),
    start: src.start,
    end: src.end,
    notes: (src.notes || '').trim(),
    routineId: src.routineId || null,
    source: src.source || 'app',
    exercises: src.exercises.map((e) => ({
      exId: e.exId,
      notes: (e.notes || '').trim(),
      supersetId: e.supersetId || null,
      rest: e.rest ?? null,
      sets: e.sets.filter((s) => s.done).map((s) => ({ type: s.type, weight: s.weight ?? null, reps: s.reps ?? null, time: s.time ?? null, dist: s.dist ?? null, done: true })),
    })).filter((e) => e.sets.length),
  };
  if (src.importKey) w.importKey = src.importKey;
  if (src.sample) w.sample = true;
  normalizeSupersets(w.exercises);
  return w;
}

async function finish() {
  persist.flush();
  const all = W.exercises.flatMap((e) => e.sets);
  const done = all.filter((s) => s.done).length;
  const undone = all.length - done;
  if (!done) {
    if (await confirmSheet('No has marcado ninguna serie como completada.', { title: '¿Descartar el entreno?', ok: 'Descartar', danger: true })) discard(true);
    return;
  }
  if (undone && !(await confirmSheet(`Hay ${undone} serie${undone > 1 ? 's' : ''} sin marcar: no se guardará${undone > 1 ? 'n' : ''}.`, { title: '¿Terminar el entreno?', ok: 'Terminar' }))) return;
  const w = toWorkout({ ...W, end: Date.now() });
  await saveWorkout(w);
  W = null;
  stopBackgroundBeep();
  disableWake();
  await saveActive(null);
  closeLayer();
  showSummary(w);
}

async function cancelEdit() {
  if (await confirmSheet('Los cambios no se guardarán.', { title: '¿Salir sin guardar?', ok: 'Salir', danger: true })) {
    W = null; closeLayer(); restoreLiveRef();
  }
}

async function saveEdit() {
  const undone = W.exercises.flatMap((e) => e.sets).filter((s) => !s.done).length;
  if (undone && !(await confirmSheet(`Hay ${undone} serie${undone > 1 ? 's' : ''} sin marcar que se eliminará${undone > 1 ? 'n' : ''}.`, { title: '¿Guardar cambios?', ok: 'Guardar' }))) return;
  const w = toWorkout(W);
  if (!w.exercises.length) { toast('El entreno no tiene ninguna serie'); return; }
  await saveWorkout(w);
  W = null;
  closeLayer();
  restoreLiveRef();
  toast('Entreno actualizado');
  refresh();
}

/** Tras editar, si había un entreno en curso, vuelve a ser el de referencia. */
function restoreLiveRef() {
  mode = 'live';
  W = S.active || null;
  if (S.active) { startTick(); paintMini(); }
}

// Mini-barra: tocar para volver al entreno
document.addEventListener('click', (ev) => {
  if (ev.target.closest('#miniWorkout')) { mode = 'live'; W = S.active; openLayer(); }
});

// Atajo para la vista de resumen ("Ver series" desde la hoja)
export function quickSheet(titleText, bodyHTML) { return openSheet({ title: titleText, body: bodyHTML }); }
