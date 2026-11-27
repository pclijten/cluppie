/* ==================== DATUMKIEZER [20261125n] ====================
   Een eigen kalender in plaats van het datumvenster van de browser (dat er op Windows grijs en
   klein uitziet). Gebruikt in Activiteiten; bruikbaar voor elk scherm.

   Gebruik:
     datumVeld('data-veld="datum"', '2026-12-19')   → knop + verborgen <input> met dat attribuut
     koppelDatumkiezer(rootEl, { stip: iso => 'Kersttoernooi' })   één keer per root
   Kiezen zet de waarde in de verborgen input en stuurt een bubbelende 'change', zodat de
   bestaande change-afhandeling (data-veld, data-kies …) gewoon werkt.
   Zonder afhankelijkheden: alleen esc uit state.js. */
import { esc } from './state.js?v=20261129e';

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vandaag = () => iso(new Date());
export const datumTekst = s => isIso(s) ? new Date(s + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '';
const SVG_KAL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';

export function datumVeld(attr, waarde = '', { leeg = 'Kies een datum', klasse = '' } = {}){
  const w = isIso(waarde) ? waarde : '';
  return `<span class="dkz ${esc(klasse)}"><button type="button" class="dkz-knop" data-dkz aria-haspopup="dialog">${SVG_KAL}<span>${esc(w ? datumTekst(w) : leeg)}</span></button><input type="hidden" ${attr} value="${esc(w)}"></span>`;
}

let open = null;   /* { el, input, knop, maand: 'JJJJ-MM', opts } */
function sluit(){ if (!open) return; open.el.remove(); open.knop?.setAttribute('aria-expanded', 'false'); open = null; }

function teken(){
  const { el, input, opts } = open;
  const [j, m] = open.maand.split('-').map(Number);
  const eerste = new Date(j, m - 1, 1), start = new Date(eerste); start.setDate(1 - ((eerste.getDay() + 6) % 7));
  const gekozen = input.value, nu = vandaag();
  const cellen = [];
  for (let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate() + i);
    const s = iso(d), anders = d.getMonth() !== m - 1, stip = opts.stip?.(s) || '';
    if (i === 35 && anders) break;
    cellen.push(`<button type="button" class="dkz-dag${anders ? ' anders' : ''}${s === nu ? ' nu' : ''}${s === gekozen ? ' aan' : ''}${d.getDay() % 6 === 0 ? ' weekend' : ''}" data-dkz-dag="${s}" aria-label="${esc(datumTekst(s) + (stip ? ', ' + stip : ''))}"${s === gekozen ? ' aria-pressed="true"' : ''}>${d.getDate()}${stip ? `<i title="${esc(stip)}"></i>` : ''}</button>`);
  }
  const markeringen = [];
  for (let d = 1; d <= 31; d++){
    const s = `${open.maand}-${String(d).padStart(2, '0')}`; if (!isIso(s) || new Date(s + 'T12:00').getMonth() !== m - 1) continue;
    const t = opts.stip?.(s); if (t) markeringen.push(`<li><b>${d} ${MAANDEN[m - 1].slice(0, 3)}</b> ${esc(t)}</li>`);
  }
  el.innerHTML = `<div class="dkz-kop"><button type="button" class="dkz-pijl" data-dkz-maand="-1" aria-label="Vorige maand">‹</button>
      <b>${MAANDEN[m - 1]} ${j}</b><button type="button" class="dkz-pijl" data-dkz-maand="1" aria-label="Volgende maand">›</button></div>
    <div class="dkz-grid">${DAGEN.map(d => `<span class="dkz-wd">${d}</span>`).join('')}${cellen.join('')}</div>
    ${markeringen.length ? `<ul class="dkz-lijst">${markeringen.slice(0, 4).join('')}</ul>` : ''}
    <div class="dkz-voet"><button type="button" data-dkz-snel="nu">Vandaag</button>${opts.wissen !== false ? '<button type="button" data-dkz-snel="wis">Wissen</button>' : ''}<button type="button" data-dkz-snel="dicht">Sluiten</button></div>`;
}

function plaats(){
  const { el, knop } = open;
  if (innerWidth < 600){ el.classList.add('blad'); return; }
  const r = knop.getBoundingClientRect(), h = el.offsetHeight || 380, w = el.offsetWidth || 320;
  const boven = r.bottom + h + 8 > innerHeight && r.top - h - 8 > 0;
  el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
  el.style.top = (boven ? r.top - h - 6 : Math.min(innerHeight - h - 8, r.bottom + 6)) + 'px';
}

function kies(waarde){
  const { input, knop } = open;
  input.value = waarde;
  const sp = knop.querySelector('span'); if (sp) sp.textContent = waarde ? datumTekst(waarde) : 'Kies een datum';
  sluit();
  input.dispatchEvent(new Event('change', { bubbles: true }));
  knop.focus();
}

function openKiezer(knop, opts){
  sluit();
  const input = knop.parentElement.querySelector('input[type="hidden"]'); if (!input) return;
  stijl();
  const el = document.createElement('div'); el.className = 'dkz-paneel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Kies een datum');
  document.body.appendChild(el);
  open = { el, input, knop, opts, maand: (isIso(input.value) ? input.value : vandaag()).slice(0, 7) };
  knop.setAttribute('aria-expanded', 'true');
  teken(); plaats();
  el.querySelector('.aan, .nu, .dkz-dag:not(.anders)')?.focus();
  el.addEventListener('click', e => {
    e.stopPropagation();
    const t = e.target.closest('button'); if (!t || !open) return;
    if (t.dataset.dkzDag) return kies(t.dataset.dkzDag);
    if (t.dataset.dkzMaand){ const [j, m] = open.maand.split('-').map(Number), d = new Date(j, m - 1 + Number(t.dataset.dkzMaand), 1); open.maand = iso(d).slice(0, 7); teken(); return; }
    if (t.dataset.dkzSnel === 'nu') return kies(vandaag());
    if (t.dataset.dkzSnel === 'wis') return kies('');
    if (t.dataset.dkzSnel === 'dicht') return sluit();
  });
  el.addEventListener('keydown', e => {
    const d = e.target.closest?.('[data-dkz-dag]');
    if (e.key === 'Escape'){ e.stopPropagation(); const k = open.knop; sluit(); k.focus(); return; }
    if (!d) return;
    const stap = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!stap) return;
    e.preventDefault();
    const n = new Date(d.dataset.dkzDag + 'T12:00'); n.setDate(n.getDate() + stap); const s = iso(n);
    if (s.slice(0, 7) !== open.maand){ open.maand = s.slice(0, 7); teken(); }
    open.el.querySelector(`[data-dkz-dag="${s}"]`)?.focus();
  }, true);
}

const gekoppeld = new WeakSet();
export function koppelDatumkiezer(root, opts = {}){
  if (!root || gekoppeld.has(root)) return;
  gekoppeld.add(root);
  root.addEventListener('click', e => {
    const k = e.target.closest?.('[data-dkz]'); if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (open?.knop === k) return sluit();
    openKiezer(k, typeof opts === 'function' ? opts() : opts);
  });
}
document.addEventListener('click', e => { if (open && !open.el.contains(e.target)) sluit(); });
addEventListener('resize', () => sluit());
export const sluitDatumkiezer = sluit;

function stijl(){
  if (document.getElementById('dkzStijl')) return;
  const s = document.createElement('style'); s.id = 'dkzStijl';
  s.textContent = `
.dkz{display:block}
.dkz-knop{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:8px 10px;border-radius:var(--r-s);border:1.5px solid var(--hair);background:var(--surface,var(--card));color:var(--ink);font:inherit;font-size:16px;text-align:left;cursor:pointer}
.dkz-knop svg{color:var(--accent);flex-shrink:0}
.dkz-knop:hover,.dkz-knop[aria-expanded="true"]{border-color:var(--accent)}
.dkz-paneel{position:fixed;z-index:200;width:312px;background:var(--card);color:var(--ink);border-radius:var(--r-m,14px);box-shadow:0 18px 48px rgba(0,0,0,.28);padding:12px;border:1px solid var(--hair)}
.dkz-paneel.blad{left:0!important;right:0;bottom:0;top:auto!important;width:auto;border-radius:18px 18px 0 0;padding:14px 16px calc(14px + env(safe-area-inset-bottom))}
.dkz-kop{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.dkz-kop b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg,18px);letter-spacing:.02em}
.dkz-pijl{width:36px;height:36px;border-radius:50%;background:var(--surface-2,var(--hair));color:var(--ink);font-size:22px;line-height:1}
.dkz-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.dkz-wd{text-align:center;font-size:var(--t-xs,12px);color:var(--ink-2);padding:4px 0;text-transform:uppercase}
.dkz-dag{position:relative;aspect-ratio:1;min-height:36px;border-radius:50%;background:none;color:var(--ink);font-size:15px;font-variant-numeric:tabular-nums;cursor:pointer}
.dkz-dag:hover{background:color-mix(in srgb,var(--accent) 14%,transparent)}
.dkz-dag.weekend{color:var(--accent)}
.dkz-dag.anders{opacity:.35}
.dkz-dag.nu{box-shadow:inset 0 0 0 1.5px var(--accent)}
.dkz-dag.aan{background:var(--accent);color:var(--accent-ink,#fff);font-weight:700}
.dkz-dag i{position:absolute;left:50%;bottom:4px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--warn,#f59e0b)}
.dkz-dag.aan i{background:currentColor}
.dkz-dag:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.dkz-lijst{list-style:none;margin:8px 0 0;padding:8px 0 0;border-top:1px solid var(--hair);font-size:var(--t-sm,14px);display:flex;flex-direction:column;gap:2px}
.dkz-lijst b{display:inline-block;min-width:52px}
.dkz-voet{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}
.dkz-voet button{padding:6px 12px;border-radius:var(--r-pill,999px);background:var(--surface-2,var(--hair));color:var(--ink);font-size:var(--t-sm,14px);min-height:36px}
.dkz-voet button:first-child{margin-right:auto;color:var(--accent);background:none;font-weight:600}`;
  document.head.appendChild(s);
}
