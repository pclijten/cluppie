/* ==================== COACHMODEL — scherm voor de trainer [20261019h] ====================
   Ontdekken in plaats van invullen: 12 korte situaties → een schets met zes balken en één zin → per onderdeel zelf
   bevestigen of corrigeren → accent van de week (een kleine proef) → terugblik na vier trainingen.
   Persoonlijk: alleen de trainer ziet dit. Geen spelersgegevens, geen label, geen persoonlijkheidsprofiel.

   Datamodel (alle writes merge:true; valt onder het bestaande eigenaar-recht op gebruikers/{uid}/…, geen rules-wijziging):
     gebruikers/{uid}/coachmodel/huidig  { versie, antwoorden, waarden, onderdelen:{c1:{stand,bevestigd,wil}}, accent, logboek, afgerond, bijgewerktMs } */
import { S, esc, meld } from './state.js?v=20261011g';
import { db, doc, getDoc, setDoc, deleteField } from './firebase.js?v=20261011g';
import * as M from './coachmodel-logica.js?v=20261019h';

const chip = (attr, w, t, aan) => `<button class="tm-chip${aan ? ' aan' : ''}" ${attr}="${esc(String(w))}">${esc(t)}</button>`;
const uidNu = () => S.user?.uid || '';
function C(){
  if (!S._cm) S._cm = { model: undefined, laadt: false, bewerk: null, concept: null, opnieuw: null };
  return S._cm;
}
const pad = () => doc(db, 'gebruikers', uidNu(), 'coachmodel', 'huidig');

async function laad(){
  const c = C(); if (c.laadt) return; c.laadt = true;
  try {
    const sn = await getDoc(pad());
    c.model = sn.exists() ? { ...M.nieuwModel(), ...sn.data() } : M.nieuwModel();
  } catch (e){ c.model = M.nieuwModel(); meld('Coachmodel laden mislukt: ' + (e.code || e.message)); }
  c.laadt = false; c.opnieuw?.();
}
async function bewaar(velden){
  const c = C();
  try { await setDoc(pad(), { ...velden, versie: M.VERSIE, bijgewerktMs: Date.now() }, { merge: true }); }
  catch (e){ meld('Coachmodel niet bewaard: ' + (e.code || e.message)); }
  void c;
}
/* Het model voor andere schermen (Training maken): geladen of null. */
export async function laadCoachmodel(){
  const c = C();
  if (c.model === undefined){
    try { const sn = await getDoc(pad()); c.model = sn.exists() ? { ...M.nieuwModel(), ...sn.data() } : M.nieuwModel(); }
    catch (e){ c.model = M.nieuwModel(); }
  }
  return c.model;
}
export const coachmodelNu = () => C().model || null;

/* ---------- HTML ---------- */
const balk = (stand, bevestigd) => {
  const pos = stand === null || stand === undefined ? 50 : 50 - stand * 22;      /* A links (+), B rechts (−) */
  return `<div style="position:relative;height:8px;border-radius:4px;background:var(--hair);margin:6px 0 2px">
    <div style="position:absolute;left:50%;top:-2px;width:2px;height:12px;background:var(--hair)"></div>
    <div style="position:absolute;left:calc(${pos}% - 7px);top:-3px;width:14px;height:14px;border-radius:50%;background:${bevestigd ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, transparent)'};border:2px solid var(--surface, #fff)"></div></div>`;
};
export function htmlCoachmodel(){
  const c = C();
  if (c.model === undefined){ laad(); return `<div class="kaart"><div class="tm-info">Laden…</div></div>`; }
  const m = c.model;
  const a = M.voortgang(m.antwoorden);
  const situatiesKlaar = M.VRAGEN.filter(q => q.k === 'ab').every(q => M.beantwoord(m.antwoorden, q));
  let inhoud;
  if (!situatiesKlaar) inhoud = htmlVragen(m, a);
  else if (!M.alleBevestigd(m) || c.bewerk) inhoud = htmlSchets(m);
  else inhoud = htmlModel(m);
  return `<div id="cmRoot" class="tm">${inhoud}</div>`;
}

function htmlVragen(m, a){
  const wd = M.VRAGEN.find(q => q.id === 'wd');
  let h = `<div class="kaart"><div class="tm-sub" style="margin-top:0">Ontdek hoe jij coacht</div>
    <div class="tm-info">Twaalf korte situaties, ongeveer 4 minuten. Kies wat het best bij jou past, of "weet ik nog niet". Er is geen goed of fout. Dit blijft van jou: alleen jij ziet het, niemand anders in de club. Het is een schets die je daarna zelf bevestigt, geen persoonlijkheidstest.</div>
    <div class="tm-info">Voortgang: ${a.gedaan} van ${a.totaal}</div></div>`;
  for (const d of M.DIMS){
    h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">${esc(d.n)}</div>`;
    for (const q of M.VRAGEN.filter(x => x.dim === d.id)){
      const w = m.antwoorden[q.id];
      h += `<div style="margin:10px 0"><div style="font-weight:600;margin-bottom:6px">${esc(q.q)}</div>
        <div class="tm-chips">${chip('data-cm-a', q.id + '|A', q.A, w === 'A')}${chip('data-cm-a', q.id + '|B', q.B, w === 'B')}${chip('data-cm-a', q.id + '|?', 'Weet ik nog niet', w === '?')}</div></div>`;
    }
    h += `</div>`;
  }
  h += `<div class="kaart"><div style="font-weight:600;margin-bottom:6px">${esc(wd.q)}</div><div class="tm-chips">${wd.o.map(o => chip('data-cm-w', o[0], o[1], (m.antwoorden.wd || []).includes(o[0]))).join('')}</div></div>`;
  return h;
}

function htmlSchets(m){
  const c = C();
  const dims = c.bewerk ? M.DIMS.filter(d => d.id === c.bewerk) : M.DIMS;
  const stand = M.modelStanden(m);
  let h = `<div class="kaart"><div class="tm-sub" style="margin-top:0">Jouw schets</div>
    ${M.schetsZin(stand) ? `<div class="tm-info" style="font-size:calc(15px * var(--fs));color:var(--ink)">${esc(M.schetsZin(stand))}</div>` : ''}
    <div class="tm-info">Dit is wat de situaties laten zien. Jij weet het beste of het klopt: bevestig elk onderdeel of corrigeer het. Een stand is pas van jou als je dat zegt.</div></div>`;
  for (const d of dims){
    const o = m.onderdelen[d.id] || { stand: null, bevestigd: false, wil: null };
    const cs = c.concept?.[d.id] || {};
    const s = cs.stand !== undefined ? cs.stand : o.stand, wil = cs.wil !== undefined ? cs.wil : o.wil;
    h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">${esc(d.n)}${o.bevestigd ? ' · bevestigd' : ''}</div>
      <div style="display:flex;justify-content:space-between;font-size:calc(12px * var(--fs))"><span>${esc(d.A)}</span><span>${esc(d.B)}</span></div>${balk(s, o.bevestigd)}
      <div class="tm-info">${esc(d.why)} <i>(${esc(M.CERT[d.c])})</i></div>
      <div class="tm-rij"><span class="tm-l">Klopt dit?</span><div class="tm-chips">${[[2, 'Duidelijk A'], [1, 'Neigt naar A'], [0, 'Open'], [-1, 'Neigt naar B'], [-2, 'Duidelijk B']].map(([v, t]) => chip('data-cm-s', d.id + '|' + v, t, s === v)).join('')}</div></div>
      <div class="tm-rij"><span class="tm-l">Wil je hier iets aan veranderen?</span><div class="tm-chips">${[['ja', 'Ja'], ['nee', 'Nee'], ['nog niet', 'Nog niet']].map(([v, t]) => chip('data-cm-wil', d.id + '|' + v, t, wil === v)).join('')}</div></div>
      <button class="tm-chip aan" data-cm-ok="${d.id}" style="margin-top:8px">Bevestig</button></div>`;
  }
  if (c.bewerk) h += `<button class="tm-chip" data-cm-klaar="1">Terug naar mijn model</button>`;
  return h;
}

function htmlModel(m){
  const c = C(), stand = M.modelStanden(m);
  const acc = m.accent, voorstel = acc ? null : M.kiesAccent(m);
  const wdn = (m.waarden || []).map(id => M.WAARDEN.find(w => w[0] === id)?.[1]).filter(Boolean);
  let h = `<div class="kaart"><div class="tm-sub" style="margin-top:0">Mijn coachmodel</div>
    ${M.schetsZin(stand) ? `<div class="tm-info" style="font-size:calc(15px * var(--fs));color:var(--ink)">${esc(M.schetsZin(stand))}</div>` : `<div class="tm-info">Bij jou is nog niets duidelijk, en dat is prima.</div>`}
    ${M.DIMS.map(d => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:calc(12px * var(--fs))"><b>${esc(d.n)}</b><span>${esc(stand[d.id] === null || Math.abs(stand[d.id]) < 0.5 ? 'Open' : stand[d.id] > 0 ? d.A : d.B)}</span></div>${balk(stand[d.id], true)}</div>`).join('')}
    ${wdn.length ? `<div class="tm-info">Belangrijk voor jou bij kinderen: ${esc(wdn.join(', '))}.</div>` : ''}
    <div class="tm-info">Alleen jij ziet dit. Het model bepaalt niet welke vormen je krijgt (op één kleine voorkeur na); het past vooral de coachkaart bij elke vorm aan jouw manier aan.</div></div>`;
  /* accent van de week */
  if (acc && !acc.uit){
    const d = M.DIMS.find(x => x.id === acc.dim);
    h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">Accent van de week · ${esc(d.n)}</div>
      <div class="tm-info" style="color:var(--ink)">${esc(acc.tekst)}</div>
      <div class="tm-info">Na elke training drie tikken. Na ${M.TERUGBLIK_NA} trainingen kijk je terug (nu ${(m.logboek || []).length}).</div>
      ${M.LOG_VRAGEN.map(q => `<div class="tm-rij"><span class="tm-l">${esc(q.q)}</span><div class="tm-chips">${q.o.map(o => chip('data-cm-log', q.id + '|' + o[0], o[1], c.log?.[q.id] === o[0])).join('')}</div></div>`).join('')}
      <button class="tm-chip aan" data-cm-logok="1" style="margin-top:8px">Training bewaren</button>
      <button class="tm-chip" data-cm-uit="1" style="margin-top:8px">Accent uitzetten</button></div>`;
    if (M.terugblikKlaar(m)){
      const tb = M.terugblikTekst(m);
      h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">Terugblik na ${tb.n} trainingen</div>
        <div class="tm-info">Proef: ${esc(tb.proef)}</div><div class="tm-info">Hoe het voelde: ${esc(tb.voelde)}.</div><div class="tm-info">Spelers: ${esc(tb.spelers)}.</div><div class="tm-info">${esc(tb.weer)}.</div>
        <div class="tm-info" style="color:var(--ink)">Wil je dit in je model opnemen? Dan schuift ${esc(tb.dim.toLowerCase())} een stap naar "${esc(tb.kant.toLowerCase())}".</div>
        <div class="tm-chips"><button class="tm-chip aan" data-cm-tb="ja">Ja, opnemen</button><button class="tm-chip" data-cm-tb="nee">Nee, laten zoals het was</button></div></div>`;
    }
  } else if (voorstel){
    const d = M.DIMS.find(x => x.id === voorstel.dim);
    h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">Accent van de week</div>
      <div class="tm-info">Eén kleine proef bij ${esc(d.n.toLowerCase())}: ${esc(voorstel.tekst)}</div>
      <div class="tm-chips"><button class="tm-chip aan" data-cm-start="1">Probeer ik</button></div></div>`;
  } else if (acc && acc.uit){
    h += `<div class="kaart"><div class="tm-info">Het accent van de week staat uit.</div><button class="tm-chip" data-cm-aan="1">Weer aanzetten</button></div>`;
  }
  h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">Aanpassen</div>
    <div class="tm-chips">${M.DIMS.map(d => chip('data-cm-edit', d.id, d.n, false)).join('')}</div>
    <button class="tm-chip" data-cm-opnieuw="1" style="margin-top:8px">De situaties opnieuw doen</button></div>`;
  return h;
}

/* ---------- acties ---------- */
export function koppelCoachmodel(v, opnieuw){
  const c = C(); c.opnieuw = opnieuw;
  const root = v.querySelector('#cmRoot'); if (!root) return;
  root.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    const m = c.model; if (!m) return;
    if (d.cmA){
      const [id, w] = d.cmA.split('|');
      const s = M.schoonAntwoord(id, w); if (s === undefined) return;
      c.model = M.metAntwoorden(m, { ...m.antwoorden, [id]: s });
      opnieuw();
      return bewaar({ antwoorden: { [id]: s }, onderdelen: c.model.onderdelen });
    }
    if (d.cmW){
      const lijst = new Set(m.antwoorden.wd || []);
      if (lijst.has(d.cmW)) lijst.delete(d.cmW); else lijst.add(d.cmW);
      const s = M.schoonAntwoord('wd', [...lijst]);
      c.model = M.metAntwoorden(m, { ...m.antwoorden, wd: s });
      opnieuw();
      return bewaar({ antwoorden: { wd: s }, waarden: c.model.waarden });
    }
    if (d.cmS){ const [id, w] = d.cmS.split('|'); c.concept = { ...(c.concept || {}), [id]: { ...(c.concept?.[id] || {}), stand: Number(w) } }; return opnieuw(); }
    if (d.cmWil){ const [id, w] = d.cmWil.split('|'); c.concept = { ...(c.concept || {}), [id]: { ...(c.concept?.[id] || {}), wil: w } }; return opnieuw(); }
    if (d.cmOk){
      const cs = c.concept?.[d.cmOk] || {};
      c.model = M.bevestig(m, d.cmOk, { stand: cs.stand, wil: cs.wil });
      if (c.concept) delete c.concept[d.cmOk];
      if (c.bewerk === d.cmOk) c.bewerk = null;
      opnieuw();
      return bewaar({ onderdelen: { [d.cmOk]: c.model.onderdelen[d.cmOk] } });
    }
    if (d.cmKlaar){ c.bewerk = null; return opnieuw(); }
    if (d.cmEdit){ c.bewerk = d.cmEdit; return opnieuw(); }
    if (d.cmOpnieuw){
      /* merge laat geneste velden staan: daarom elk antwoord en onderdeel apart leegmaken */
      c.model = { ...m, onderdelen: {}, antwoorden: {}, waarden: [] }; c.concept = null; c.bewerk = null;
      opnieuw();
      return bewaar({ antwoorden: Object.fromEntries(M.VRAGEN.map(q => [q.id, deleteField()])), waarden: [],
        onderdelen: Object.fromEntries(M.DIM_IDS.map(id => [id, { stand: null, bevestigd: false, wil: null }])) });
    }
    if (d.cmStart){
      c.model = M.startAccent(m, M.kiesAccent(m)); c.log = {};
      opnieuw();
      return bewaar({ accent: c.model.accent, logboek: [] });
    }
    if (d.cmUit || d.cmAan){
      c.model = M.zetAccentUit(m, !!d.cmUit); opnieuw();
      return bewaar({ accent: c.model.accent });
    }
    if (d.cmLog){ const [id, w] = d.cmLog.split('|'); c.log = { ...(c.log || {}), [id]: w }; return opnieuw(); }
    if (d.cmLogok){
      if (!M.schoonLog(c.log)) return meld('Beantwoord alle drie de vragen');
      c.model = M.logAccent(m, c.log); c.log = {};
      opnieuw();
      return bewaar({ logboek: c.model.logboek });
    }
    if (d.cmTb){
      c.model = M.rondAccentAf(m, d.cmTb === 'ja'); c.log = {};
      opnieuw();
      return bewaar({ accent: null, logboek: [], afgerond: c.model.afgerond, onderdelen: c.model.onderdelen });
    }
  };
}
