// Piezas de interfaz reutilizables.
import { html, raw } from '../util.js';
import { icon } from './icons.js';

/**
 * Barra superior de una pantalla.
 * @param {{title:string, back?:boolean|string, left?:any, right?:any, always?:boolean}} o
 */
export function navBar(o) {
  const left = o.back
    ? html`<button class="nav-btn" data-act="back" aria-label="Atrás">${icon('back')}<span>${typeof o.back === 'string' ? o.back : ''}</span></button>`
    : o.left ?? '';
  return html`<header class="nav ${o.always ? 'always' : ''}">
    <div class="nav-left">${left}</div>
    <div class="nav-title" aria-hidden="${o.always ? 'false' : 'true'}">${o.title}</div>
    <div class="nav-right">${o.right ?? ''}</div>
  </header>`;
}

/** Fila con interruptor. */
export const switchRow = (id, label, checked, sub = '') => html`
  <label class="row">
    <div class="grow"><div class="title">${label}</div>${sub ? html`<div class="sub">${sub}</div>` : ''}</div>
    <span class="switch"><input type="checkbox" role="switch" data-setting="${id}" ${checked ? 'checked' : ''} aria-label="${label}"><span></span></span>
  </label>`;

/** Fila navegable con chevron. */
export const linkRow = (href, label, value = '', ic = '') => html`
  <a class="row" href="${href}">
    ${ic ? html`<span class="trophy" style="background:var(--surface-2);color:var(--text-2)">${icon(ic)}</span>` : ''}
    <div class="grow title">${label}</div>
    ${value !== '' ? html`<span class="value">${value}</span>` : ''}
    ${icon('chev', 'class="chev"')}
  </a>`;

/** Control segmentado. */
export const seg = (name, options, value, label = '') => html`
  <div class="seg" role="group" aria-label="${label}">
    ${options.map(([v, t]) => html`<button data-seg="${name}" data-v="${v}" aria-pressed="${String(v) === String(value)}">${t}</button>`)}
  </div>`;

/** Etiqueta PR. */
export const prBadge = (title = '') => html`<span class="pr-badge" title="${title}">${icon('trophy')}PR</span>`;

// Ilustraciones de estados vacíos (SVG propio, tonos de la app)
const ART = {
  routines: `<svg class="art" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="62" fill="#161618"/>
    <rect x="22" y="62" width="10" height="16" rx="3" fill="#2e2e32"/><rect x="32" y="48" width="12" height="44" rx="4" fill="#c6f432"/>
    <rect x="44" y="66" width="52" height="8" rx="4" fill="#5a5a60"/><rect x="96" y="48" width="12" height="44" rx="4" fill="#c6f432"/>
    <rect x="108" y="62" width="10" height="16" rx="3" fill="#2e2e32"/><circle cx="104" cy="36" r="10" fill="#232326"/><path d="M104 31v10M99 36h10" stroke="#c6f432" stroke-width="3" stroke-linecap="round"/></svg>`,
  history: `<svg class="art" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="62" fill="#161618"/>
    <rect x="36" y="34" width="68" height="76" rx="10" fill="#232326"/><rect x="36" y="34" width="68" height="18" rx="9" fill="#2e2e32"/>
    <path d="M48 66h44M48 80h30M48 94h38" stroke="#5a5a60" stroke-width="6" stroke-linecap="round"/><circle cx="98" cy="98" r="16" fill="#c6f432"/><path d="M98 90v9l5 3" stroke="#0c1300" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  progress: `<svg class="art" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="62" fill="#161618"/>
    <path d="M30 100h80" stroke="#2e2e32" stroke-width="3"/><path d="M32 92l20-14 18 8 18-24 20-12" stroke="#c6f432" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="108" cy="50" r="7" fill="#c6f432"/><circle cx="52" cy="78" r="5" fill="#5a5a60"/><circle cx="70" cy="86" r="5" fill="#5a5a60"/><circle cx="88" cy="62" r="5" fill="#5a5a60"/></svg>`,
  records: `<svg class="art" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="62" fill="#161618"/>
    <path d="M50 38h40v22a20 20 0 0 1-40 0z" fill="#c6f432"/><path d="M90 44h12v6a12 12 0 0 1-12 12M50 44H38v6a12 12 0 0 0 12 12" stroke="#c6f432" stroke-width="5" fill="none"/>
    <rect x="64" y="78" width="12" height="16" fill="#5a5a60"/><rect x="50" y="94" width="40" height="10" rx="4" fill="#2e2e32"/></svg>`,
};

export const emptyState = ({ art, title, text, actions = '' }) => html`
  <div class="empty">${raw(ART[art] || '')}<h3>${title}</h3><p>${text}</p>${actions}</div>`;
