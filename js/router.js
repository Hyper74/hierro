// ─────────────────────────────────────────────────────────────
// Enrutador por hash con transiciones tipo iOS (push / pop / fade).
// Cada ruta tiene una vista: { render(page, params) }.
// ─────────────────────────────────────────────────────────────
import { bus } from './store.js';
import { debounce } from './util.js';

const routes = [];
let current = null;
const stack = [];          // historial propio para saber si vamos atrás
const scrollMem = new Map();

/**
 * @param {string} pattern  p. ej. "/historial/:id"
 * @param {{render:Function}} view
 * @param {{tab:string, parent?:string, live?:boolean, hideTabs?:boolean}} opts
 */
export function addRoute(pattern, view, opts) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/?]+)'; }) + '$');
  routes.push({ pattern, re, keys, view, ...opts, depth: pattern.split('/').length - 2 });
}

export const currentHash = () => current?.hash;

export function go(hash, { replace = false } = {}) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (replace) { history.replaceState(null, '', hash); onHash(true); } else location.hash = hash;
}

/** Atrás: usa el historial del navegador si podemos, si no la ruta padre. */
export function back() {
  if (stack.length > 1) history.back();
  else if (current?.route.parent) go(current.route.parent, { replace: true });
}

function match(hash) {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = Object.fromEntries(new URLSearchParams(query));
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
  }
  return null;
}

async function onHash(replaced = false) {
  const hash = location.hash || '#/entrenar';
  const m = match(hash) || match('#/entrenar');
  if (!m) return;
  const prev = current;
  if (prev) {
    const sc = prev.page.querySelector('.scroll');
    if (sc) scrollMem.set(prev.hash, sc.scrollTop);
  }

  // Dirección de la transición
  let dir = 'fade'; // cambio de pestaña o reemplazo
  if (prev && !replaced) {
    if (stack.length > 1 && stack[stack.length - 2] === hash) { dir = 'pop'; stack.pop(); }
    else if (m.route.tab === prev.route.tab && m.route.depth > prev.route.depth) { dir = 'push'; stack.push(hash); }
    else { stack.length = 0; stack.push(hash); }
  } else if (replaced && stack.length && m.route.depth > 0) stack[stack.length - 1] = hash;
  else { stack.length = 0; stack.push(hash); }

  const page = document.createElement('section');
  page.className = 'page';
  if (m.route.hideTabs) page.classList.add('no-tabbar');
  const container = document.getElementById('pages');
  container.append(page);
  current = { hash, page, ...m };
  await renderPage(current);
  if (dir === 'pop') {
    const sc = page.querySelector('.scroll');
    if (sc && scrollMem.has(hash)) sc.scrollTop = scrollMem.get(hash);
  }

  // Pestañas
  document.querySelectorAll('#tabbar .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === m.route.tab)));
  document.getElementById('tabbar').classList.toggle('hide', !!m.route.hideTabs);

  // Animación
  if (prev) {
    const old = prev.page;
    if (dir === 'push') { page.classList.add('push-in'); old.classList.add('push-out'); }
    else if (dir === 'pop') { page.classList.add('pop-in'); old.classList.add('pop-out'); }
    else page.classList.add('fade-in');
    setTimeout(() => old.remove(), dir === 'fade' ? 0 : 380);
  }
  page.querySelector('.large-title, h1, .nav-title')?.setAttribute('tabindex', '-1');
}

async function renderPage(c) {
  await c.route.view.render(c.page, c.params);
  wire(c.page);
}

/** Comportamientos comunes: botón atrás y borde de la barra al desplazar. */
function wire(page) {
  const nav = page.querySelector('.nav');
  const sc = page.querySelector('.scroll');
  if (nav && sc) {
    const upd = () => nav.classList.toggle('scrolled', sc.scrollTop > 30);
    sc.addEventListener('scroll', upd, { passive: true });
    upd();
  }
  page.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="back"]')) { e.preventDefault(); back(); }
  });
}

/** Vuelve a pintar la pantalla actual conservando el desplazamiento. */
export async function refresh() {
  if (!current) return;
  const sc = current.page.querySelector('.scroll');
  const top = sc ? sc.scrollTop : 0;
  const fresh = document.createElement('section');
  fresh.className = current.page.className.replace(/\b(push|pop|fade)-(in|out)\b/g, '');
  const old = current.page;
  old.replaceWith(fresh);
  current.page = fresh;
  await renderPage(current);
  const sc2 = fresh.querySelector('.scroll');
  if (sc2) sc2.scrollTop = top;
}

export function startRouter() {
  window.addEventListener('hashchange', () => onHash(false));
  // Las vistas "live" se repintan solas cuando cambian los datos
  const live = debounce(() => {
    if (!current?.route.live) return;
    const a = document.activeElement;
    if (a && current.page.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    refresh();
  }, 60);
  bus.addEventListener('change', live);
  return onHash(true);
}
