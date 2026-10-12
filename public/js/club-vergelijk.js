/* ==================== ANONIEME CLUBVERGELIJKING (20261011d) ====================
   Opt-in per club (instellingen.benchmark). Cluppie vergelijkt elke nacht deelnemende clubs op
   hoe intensief ze de app gebruiken, per team over de laatste 30 dagen. Je ziet alleen je eigen
   waarden naast de mediaan en de beste kwart van alle deelnemers; nooit namen van andere clubs.
   Pas bij minimaal 3 deelnemers verschijnen er cijfers. Server: functions/platform.js. */

import { db, doc, getDoc } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261011g';
import { bewaar } from './club-instellingen.js?v=20261012h';

const METRICS = [
  ['evaluaties', 'Beoordelingen', 'per team, 30 dagen'],
  ['presentie', 'Aanwezigheid bijgehouden', 'keer per team, 30 dagen'],
  ['wedstrijden', 'Wedstrijden live gevolgd', 'per team, 30 dagen'],
  ['leerpunten', 'Leerpunten', 'gezet of afgerond, per team'],
  ['actiefPct', 'Actieve coaches', '% van alle coaches, 30 dagen'],
];

export function htmlVergelijkPlek(){ return '<div id="inzVergelijk"><div class="kaart leeg">Laden…</div></div>'; }

export async function vulVergelijk(root, herteken){
  const el = root.querySelector('#inzVergelijk'); if (!el) return;
  const aan = S.club?.instellingen?.benchmark === true;
  let ov = null, eigen = null;
  try { const s = await getDoc(doc(db, 'benchmark', 'overzicht')); ov = s.exists() ? s.data() : null; } catch (e) {}
  if (aan) try { const s = await getDoc(doc(db, 'benchmark', S.clubId)); eigen = s.exists() ? s.data().waarden : null; } catch (e) {}
  const schakel = `<label class="ci-schakel"><input type="checkbox" id="vgAan" ${aan ? 'checked' : ''}><span><b>Meedoen met de vergelijking</b><br><small>Alleen tellingen per team gaan mee, nooit namen of spelergegevens. Andere clubs zien jullie naam niet.</small></span></label>`;
  let inhoud;
  if (!aan) inhoud = '<p class="cb-uitleg">Zet de vergelijking aan om te zien hoe jullie club ervoor staat ten opzichte van andere clubs op Cluppie.</p>';
  else if (!ov || !ov.metrics) inhoud = `<p class="cb-uitleg">Nog te weinig deelnemende clubs (${ov?.aantal || 0} van minimaal 3). Zodra er genoeg zijn, verschijnen hier de cijfers, de nacht erna bijgewerkt.</p>`;
  else if (!eigen) inhoud = '<p class="cb-uitleg">Jullie cijfers worden vannacht voor het eerst berekend.</p>';
  else inhoud = METRICS.map(([k, label, sub]) => {
    const m = ov.metrics[k] || {}, w = eigen[k] ?? 0, max = Math.max(1, w, m.p75 || 0) * 1.15;
    const pos = v => Math.min(100, Math.round(100 * (v || 0) / max));
    const oordeel = m.p75 != null && w >= m.p75 ? 'top' : m.mediaan != null && w >= m.mediaan ? 'boven' : 'onder';
    return `<div class="vg-rij"><div class="vg-kop"><b>${esc(label)}</b><small>${esc(sub)}</small><span class="vg-w ${oordeel}">${w}${k === 'actiefPct' ? '%' : ''}</span></div>
      <div class="vg-balk"><i class="vg-eigen" style="width:${pos(w)}%"></i><em class="vg-med" style="left:${pos(m.mediaan)}%" title="mediaan ${m.mediaan}"></em><em class="vg-p75" style="left:${pos(m.p75)}%" title="beste kwart vanaf ${m.p75}"></em></div></div>`;
  }).join('') + `<div class="vg-leg"><span><i class="vg-eigen"></i>jullie club</span><span><em class="vg-med"></em>mediaan</span><span><em class="vg-p75"></em>beste kwart</span><span>${ov.aantal} clubs doen mee</span></div>`;
  el.innerHTML = `<div class="kaart">${schakel}<div style="margin-top:10px">${inhoud}</div></div>`;
  el.querySelector('#vgAan').onchange = async e => {
    try { await bewaar([['benchmark', e.target.checked]]); meld(e.target.checked ? 'Je doet mee; cijfers volgen vannacht' : 'Je doet niet meer mee'); vulVergelijk(root, herteken); }
    catch (x){ e.target.checked = !e.target.checked; meld('Opslaan mislukt: ' + (x.code || x.message)); }
  };
}
