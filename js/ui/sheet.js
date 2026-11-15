// Hojas modales al estilo iOS, menús de acciones, confirmaciones y avisos.
import { el, html, str } from '../util.js';
import { icon } from './icons.js';

const layer = () => document.getElementById('sheetLayer');
let openCount = 0;

/**
 * Abre una hoja inferior.
 * @param {{title?:string, body:any, full?:boolean, left?:any, right?:any, onClose?:Function, label?:string}} o
 * @returns {{root:HTMLElement, body:HTMLElement, close:()=>void}}
 */
export function openSheet(o) {
  const backdrop = el('<div class="backdrop"></div>');
  const sheet = el(html`
    <div class="sheet ${o.full ? 'full' : ''}" role="dialog" aria-modal="true" aria-label="${o.label || o.title || 'Diálogo'}">
      <div class="sheet-grab" aria-hidden="true"></div>
      ${o.title != null ? html`<div class="sheet-head">
        <div>${o.left ?? html`<button class="nav-btn" data-sheet-close>Cerrar</button>`}</div>
        <h2>${o.title}</h2>
        <div style="justify-self:end">${o.right ?? ''}</div>
      </div>` : ''}
      <div class="sheet-body"></div>
    </div>`);
  const body = sheet.querySelector('.sheet-body');
  if (o.body instanceof Node) body.append(o.body); else body.innerHTML = str(o.body ?? '');
  const L = layer();
  L.append(backdrop, sheet);
  openCount++;
  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; openCount--;
    backdrop.classList.remove('show'); sheet.classList.remove('show');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 380);
    document.removeEventListener('keydown', onKey);
    o.onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) close(); });

  // Arrastrar hacia abajo desde el asa para cerrar
  const grab = sheet.querySelector('.sheet-grab');
  let y0 = null;
  const head = sheet.querySelector('.sheet-head') || grab;
  [grab, head].forEach((h) => {
    h.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
    h.addEventListener('touchmove', (e) => { if (y0 == null) return; const dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    h.addEventListener('touchend', (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0; y0 = null;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 110) close();
    });
  });
  setTimeout(() => sheet.querySelector('[autofocus]')?.focus(), 400);
  return { root: sheet, body, close };
}

export const sheetOpen = () => openCount > 0;

/**
 * Menú de acciones. items: [{id, label, icon?, danger?, bold?}] · devuelve el id elegido o null.
 */
export function actionSheet(items, { title, message } = {}) {
  return new Promise((resolve) => {
    let picked = null;
    const s = openSheet({
      label: title || 'Acciones',
      body: html`<div class="actions" style="padding:0">
        <div class="group">
          ${title || message ? html`<div class="msg">${title ? html`<b>${title}</b>` : ''}${message || ''}</div>` : ''}
          ${items.map((it) => html`<button data-id="${it.id}" class="${it.danger ? 'danger' : ''} ${it.bold ? 'bold' : ''}">${it.icon ? icon(it.icon) : ''}${it.label}</button>`)}
        </div>
        <div class="group"><button data-sheet-close class="bold">Cancelar</button></div>
      </div>`,
      onClose: () => resolve(picked),
    });
    s.body.style.padding = '6px 10px 12px';
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (b) { picked = b.dataset.id; s.close(); }
    });
  });
}

/** Confirmación. Devuelve true/false. */
export async function confirmSheet(message, { title, ok = 'Aceptar', danger = false } = {}) {
  const r = await actionSheet([{ id: 'ok', label: ok, danger, bold: !danger }], { title, message });
  return r === 'ok';
}

/** Pide un texto o número. Devuelve el valor o null. */
export function promptSheet({ title, label, value = '', inputmode = 'text', placeholder = '', ok = 'Guardar' }) {
  return new Promise((resolve) => {
    let result = null;
    const s = openSheet({
      title,
      right: html`<button class="nav-btn strong" data-ok>${ok}</button>`,
      body: html`<label class="field"><span>${label}</span>
        <input class="input" autofocus inputmode="${inputmode}" value="${value}" placeholder="${placeholder}" enterkeyhint="done"></label>`,
      onClose: () => resolve(result),
    });
    const input = s.body.querySelector('input');
    const done = () => { result = input.value; s.close(); };
    s.root.querySelector('[data-ok]').addEventListener('click', done);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  });
}

let toastT;
/** Aviso breve en la parte superior. */
export function toast(msg, { pr = false, ms = 2400 } = {}) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('pr', pr);
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}
