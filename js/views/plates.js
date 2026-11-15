// Calculadora de discos (herramienta independiente) y configuración de barra/discos.
import { html, str, parseNum, inputNum, fmtNum, getUnit, round } from '../util.js';
import { S, saveSettings } from '../store.js';
import { computePlates, BAR_OPTIONS } from '../core/plates.js';
import { icon } from '../ui/icons.js';
import { navBar, seg } from '../ui/components.js';
import { plateBarSVG, platesText } from '../ui/plateBar.js';
import { refresh } from '../router.js';

let weight = null; // en la unidad visible

function resultHTML() {
  const u = getUnit();
  const bar = S.settings.bar[u];
  const w = weight ?? (u === 'lb' ? 135 : 60);
  const r = computePlates(w, bar, S.settings.plates[u]);
  if (r.belowBar) {
    return str(html`<div class="plates-big">${{ __raw: plateBarSVG([]) }}</div>
      <div class="plates-text">Solo la barra</div>
      <div class="plates-sub">${fmtNum(w)} ${u} es menos que la barra (${fmtNum(bar)} ${u}).</div>`);
  }
  return str(html`<div class="plates-big">${{ __raw: plateBarSVG(r.perSide) }}</div>
    <div class="plates-text" aria-live="polite">Por lado: ${platesText(r.perSide)}</div>
    <div class="plates-sub">${r.perSide.length ? `${fmtNum(r.perSideWeight)} ${u} por lado + barra de ${fmtNum(bar)} ${u}` : `Barra de ${fmtNum(bar)} ${u}`}</div>
    ${r.exact ? '' : html`<div class="banner warn" style="margin-top:14px">${icon('info')}<div class="grow"><b>${fmtNum(w)} ${u} no se puede formar con tus discos</b>
      El peso posible más cercano es <b style="display:inline">${fmtNum(r.total)} ${u}</b> (${r.diff > 0 ? '+' : '−'}${fmtNum(Math.abs(r.diff))} ${u}), que es lo que se muestra arriba.</div></div>`}`);
}

export const platesView = {
  render(page) {
    const u = getUnit();
    const inc = u === 'lb' ? 5 : 2.5;
    if (weight == null) weight = u === 'lb' ? 135 : 60;
    page.innerHTML = str(html`
      ${navBar({ title: 'Calculadora de discos', back: 'Entrenar', always: true })}
      <div class="scroll">
        <div class="section-label" style="text-align:center;margin-top:18px">Peso total en la barra</div>
        <div class="weight-entry">
          <button class="round" data-step="-1" aria-label="Restar ${fmtNum(inc)} ${u}">−${fmtNum(inc)}</button>
          <input data-f="w" inputmode="decimal" value="${inputNum(weight)}" aria-label="Peso total en ${u}" enterkeyhint="done">
          <button class="round" data-step="1" aria-label="Sumar ${fmtNum(inc)} ${u}">+${fmtNum(inc)}</button>
        </div>
        <div class="plates-sub" style="margin-top:6px">${u}</div>
        <div data-result>${{ __raw: resultHTML() }}</div>
        <div class="section-label">Barra</div>
        ${seg('bar', BAR_OPTIONS[u].map((b) => [b, `${fmtNum(b)} ${u}`]), S.settings.bar[u], 'Peso de la barra')}
        <div class="list" style="margin-top:18px"><a class="row" href="#/ajustes/discos"><div class="grow title">Mis discos disponibles</div>${icon('chev', 'class="chev"')}</a></div>
      </div>`);
    const upd = () => { page.querySelector('[data-result]').innerHTML = resultHTML(); };
    page.oninput = (e) => { if (e.target.dataset.f === 'w') { weight = parseNum(e.target.value) ?? 0; upd(); } };
    page.onclick = async (e) => {
      const s = e.target.closest('[data-step]');
      if (s) { weight = Math.max(0, round((weight || 0) + inc * Number(s.dataset.step), 2)); page.querySelector('[data-f=w]').value = inputNum(weight); upd(); return; }
      const b = e.target.closest('[data-seg=bar]');
      if (b) { await saveSettings({ bar: { ...S.settings.bar, [u]: Number(b.dataset.v) } }); refresh(); }
    };
  },
};

export const platesSettingsView = {
  render(page) {
    const u = getUnit();
    const inv = S.settings.plates[u];
    page.innerHTML = str(html`
      ${navBar({ title: 'Barra y discos', back: true, always: true })}
      <div class="scroll">
        <div class="section-label">Peso de la barra</div>
        ${seg('bar', BAR_OPTIONS[u].map((b) => [b, `${fmtNum(b)} ${u}`]), S.settings.bar[u], 'Peso de la barra')}
        <div class="section-label">Discos de mi gimnasio (pares)</div>
        <div class="list">${inv.map((p, i) => html`<div class="row" data-i="${i}">
          <div class="grow title num">${fmtNum(p.w)} ${u}</div>
          <div class="stepper"><button data-d="-1" aria-label="Menos pares de ${fmtNum(p.w)}">${icon('minus')}</button>
            <output aria-live="polite">${p.pairs}</output><button data-d="1" aria-label="Más pares de ${fmtNum(p.w)}">${icon('plus')}</button></div></div>`)}</div>
        <p class="footnote">Un par = un disco para cada lado. Pon 0 en los discos que no tengas. La calculadora nunca usará más discos de los que indiques.</p>
      </div>`);
    page.onclick = async (e) => {
      const b = e.target.closest('[data-seg=bar]');
      if (b) { await saveSettings({ bar: { ...S.settings.bar, [u]: Number(b.dataset.v) } }); return refresh(); }
      const d = e.target.closest('[data-d]');
      if (d) {
        const i = +d.closest('[data-i]').dataset.i;
        const next = inv.map((p, k) => (k === i ? { ...p, pairs: Math.max(0, Math.min(20, p.pairs + Number(d.dataset.d))) } : p));
        d.parentElement.querySelector('output').textContent = next[i].pairs;
        inv[i] = next[i];
        await saveSettings({ plates: { ...S.settings.plates, [u]: next } });
      }
    };
  },
};
