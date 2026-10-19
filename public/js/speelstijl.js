/* ==================== SPEELSTIJL VAN DE CLUB — scherm onder Club [20261019d] ====================
   Een ronde = een vragenlijst (kort of volledig) die maximaal 5 mensen invullen: clubadmin, hoofd jeugd en
   bouwcoördinatoren. Antwoorden staan per rol, niet met naam in het overzicht. Daarna legt de clubadmin of
   hoofd jeugd de uitkomst vast. Deze versie legt vast en toont; de planner gebruikt de stijl nog niet.

   Datamodel (alle writes merge:true):
     clubs/{id}/speelstijl/huidig                         vastgelegde uitkomst (speelstijl-logica huidigDoc)
     clubs/{id}/speelstijlRondes/{rondeId}                { naam, modus:'kort'|'volledig', status:'open'|'dicht', door, gemaaktMs }
     clubs/{id}/speelstijlRondes/{rondeId}/antwoorden/{uid} { rol, antwoorden, bijgewerktMs } */
import { S, esc, meld } from './state.js?v=20261011g';
import { db, doc, collection, getDocs, setDoc } from './firebase.js?v=20261011g';
import { rechtenVoor } from './seizoensplan-club.js?v=20261019a';
import * as L from './speelstijl-logica.js?v=20261019d';

const uidNu = () => S.user?.uid || '';
const isPlanner = () => rechtenVoor(S.club, uidNu()).alles;
const chip = (attr, w, t, aan) => `<button class="tm-chip${aan ? ' aan' : ''}" ${attr}="${esc(String(w))}">${esc(t)}</button>`;
const dk = ms => ms ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';

function C(){
  if (!S._ss) S._ss = { huidig: undefined, rondes: null, sel: null, antw: {}, nieuw: false, laadt: false, opnieuw: null };
  return S._ss;
}
function rolNaam(uid){
  const c = S.club || {};
  if (c.admins?.[uid]) return 'Clubadmin';
  if (c.hoofdJeugd?.[uid]) return c.instellingen?.jeugdRolNaam || 'Hoofd jeugdopleiding';
  const b = L_BOUWEN.find(x => c.bouwCoordinatoren?.[x]?.[uid]);
  return b ? `Coördinator ${b}` : 'Deelnemer';
}
const L_BOUWEN = ['onder', 'midden', 'boven'];

/* ---------- laden ---------- */
async function laad(){
  const c = C(); if (c.laadt) return; c.laadt = true;
  try {
    const snap = await getDocs(collection(db, 'clubs', S.clubId, 'speelstijl'));
    c.huidig = snap.docs.find(d => d.id === 'huidig')?.data() || null;
  } catch (e){ c.huidig = null; }
  try {
    if (rechtenVoor(S.club, uidNu()).magPlan){
      const snap = await getDocs(collection(db, 'clubs', S.clubId, 'speelstijlRondes'));
      c.rondes = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.gemaaktMs || 0) - (a.gemaaktMs || 0));
    } else c.rondes = [];
  } catch (e){ c.rondes = []; meld('Rondes laden mislukt: ' + (e.code || e.message)); }
  c.laadt = false; c.opnieuw?.();
}
async function laadAntwoorden(id){
  const c = C();
  try {
    const snap = await getDocs(collection(db, 'clubs', S.clubId, 'speelstijlRondes', id, 'antwoorden'));
    c.antw[id] = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
  } catch (e){ c.antw[id] = {}; meld('Antwoorden laden mislukt: ' + (e.code || e.message)); }
  c.opnieuw?.();
}

/* ---------- HTML ---------- */
export function htmlClubSpeelstijl(){
  const c = C();
  if (c.huidig === undefined || c.rondes === null){ laad(); return `<div class="kaart"><div class="tm-info">Laden…</div></div>`; }
  const ronde = c.sel && c.rondes.find(r => r.id === c.sel);
  return `<div id="ssRoot" class="tm">${ronde ? htmlRonde(ronde) : c.nieuw ? htmlNieuw() : htmlOverzicht()}</div>`;
}

function htmlStijl(h){
  const rijen = L.DIMS.map(d => {
    const s = h.standen?.[d.id]; if (!s) return '';
    const kant = s.stand > 0 ? d.A : s.stand < 0 ? d.B : 'Weten we nog niet / allebei';
    const st = L.statusVan(s.stand);
    return `<div class="tm-rij"><span class="tm-l">${esc(d.n)}</span><span><b>${esc(st === 'open' ? 'Open' : kant)}</b>${st === 'neigt' ? ' <span class="tm-info" style="display:inline">(neigt)</span>' : ''}${h.verschil?.includes(d.id) ? ' <span class="tm-info" style="display:inline">· verschil van mening</span>' : ''}</span></div>`;
  }).join('');
  const fasen = L.FASEN.filter(f => h.fasen?.[f.id] !== undefined).map(f => `<div class="tm-rij"><span class="tm-l">${esc(f.n)}</span><b>${esc(L.leeftijdTekst(h.fasen[f.id]))}</b></div>`).join('');
  const niet = (h.willenNiet || []).map(id => L.NEE_OPTIES.find(o => o[0] === id)?.[1]).filter(Boolean);
  const st = h.herkenning && L.REFS[h.herkenning.sleutel];
  return `${h.zin ? `<div class="tm-info" style="font-size:calc(15px * var(--fs));color:var(--ink)">${esc(h.zin)}</div>` : ''}
    ${rijen}${fasen ? `<div class="tm-sub">Per leeftijd</div>${fasen}` : ''}
    ${niet.length ? `<div class="tm-sub">Dit willen wij niet</div><div class="tm-info">${niet.map(esc).join('<br>')}</div>` : ''}
    ${st ? `<div class="tm-info">Lijkt het meest op: ${esc(st.n)} (${h.herkenning.pct}%). Dit is alleen ter oriëntatie.</div>` : ''}`;
}

function htmlOverzicht(){
  const c = C(), h = c.huidig, mag = rechtenVoor(S.club, uidNu());
  return `<div class="kaart">
      <div class="tm-sub" style="margin-top:0">Speelstijl van de club</div>
      ${h ? htmlStijl(h) + `<div class="tm-info">Vastgelegd op ${esc(dk(h.vastgelegdMs))}, ${h.invullers} ${h.invullers === 1 ? 'invuller' : 'invullers'}. De planner gebruikt dit nog niet; dat komt later.</div>`
          : `<div class="tm-info">Nog niet vastgelegd. Met een korte vragenlijst (8 vragen) of de volledige lijst (26 vragen) leggen de clubadmin, hoofd jeugd en bouwcoördinatoren samen vast hoe de club wil voetballen. Dit is een eigen ontwerp, geen gevalideerde test.</div>`}
    </div>
    ${mag.magPlan ? `<div class="kaart"><div class="tm-sub" style="margin-top:0">Rondes</div>
      ${c.rondes.length ? c.rondes.map(r => `<div class="tm-rij"><span class="tm-l">${esc(r.naam || 'Ronde')}</span><button class="tm-chip" data-ss-open="${esc(r.id)}">${r.status === 'dicht' ? 'Bekijken' : 'Openen'} · ${r.modus === 'kort' ? 'kort' : 'volledig'}</button></div>`).join('') : `<div class="tm-info">Nog geen rondes.</div>`}
      ${mag.alles ? `<button class="tm-chip aan" data-ss-nieuw="1" style="margin-top:8px">Nieuwe ronde</button>` : ''}
    </div>` : ''}`;
}

function htmlNieuw(){
  return `<div class="kaart"><div class="tm-sub" style="margin-top:0">Nieuwe ronde</div>
    <div class="tm-info">Kies hoe uitgebreid. Een ronde heeft maximaal ${L.MAX_INVULLERS} invullers. Iedereen die meedoet vult zelf de vragen in.</div>
    <div class="tm-chips">${chip('data-ss-maak', 'kort', 'Kort · 8 vragen', false)}${chip('data-ss-maak', 'volledig', 'Volledig · 26 vragen', false)}</div>
    <button class="tm-chip" data-ss-terug="1" style="margin-top:10px">Terug</button></div>`;
}

function htmlVraag(q, mijn){
  const w = mijn[q.id];
  let opt = '';
  if (q.k === 'ab') opt = `<div class="tm-chips">${chip('data-ss-a', q.id + '|A', q.A, w === 'A')}${chip('data-ss-a', q.id + '|B', q.B, w === 'B')}${chip('data-ss-a', q.id + '|?', 'Weten we nog niet', w === '?')}</div>`;
  else if (q.k === 'age') opt = `<div class="tm-chips">${L.LEEFTIJDEN.map(l => chip('data-ss-a', q.id + '|' + l, l === 99 ? 'Nooit' : 'O' + l, w === l)).join('')}</div>`;
  else opt = `<div class="tm-chips">${q.o.map(o => chip('data-ss-a', q.id + '|' + o[0], q.k === 'one' ? o[1] : o[1], q.k === 'one' ? w === o[0] : (w || []).includes(o[0]))).join('')}</div>`;
  return `<div style="margin:10px 0"><div style="font-weight:600;margin-bottom:6px">${esc(q.q)}</div>${opt}</div>`;
}

function htmlRonde(r){
  const c = C();
  if (!c.antw[r.id]){ laadAntwoorden(r.id); return `<div class="kaart"><div class="tm-info">Laden…</div></div>`; }
  const alle = c.antw[r.id], mijn = alle[uidNu()]?.antwoorden || {};
  const open = r.status !== 'dicht', mag = isPlanner();
  const vr = L.vragenVoor(r.modus), vg = L.voortgang(mijn, r.modus);
  const lijst = Object.entries(alle).map(([u, d]) => ({ u, ...d }));
  const uit = L.clubUitkomst(lijst.map(x => x.antwoorden || {}), r.modus);
  const dimNaam = id => L.DIMS.find(d => d.id === id)?.n;
  let vragen = '', deel = 0;
  for (const q of vr){ if (q.deel !== deel){ deel = q.deel; vragen += `<div class="tm-sub">${esc(L.DEELN[deel])}</div>`; } vragen += htmlVraag(q, mijn); }
  const kanMeedoen = open && (alle[uidNu()] || lijst.length < L.MAX_INVULLERS);
  return `<div class="kaart">
      <div class="tm-sub" style="margin-top:0">${esc(r.naam || 'Ronde')} · ${r.modus === 'kort' ? 'kort' : 'volledig'}${open ? '' : ' · gesloten'}</div>
      <div class="tm-info">${lijst.length} van max ${L.MAX_INVULLERS} invullers: ${lijst.map(x => `${esc(x.rol || 'Deelnemer')} (${L.voortgang(x.antwoorden || {}, r.modus).gedaan}/${vg.totaal})`).join(', ') || 'nog niemand'}.</div>
      <button class="tm-chip" data-ss-terug="1">Terug</button>
      ${mag && open ? `<button class="tm-chip" data-ss-sluit="${esc(r.id)}">Ronde sluiten</button>` : ''}
    </div>
    <div class="kaart"><div class="tm-sub" style="margin-top:0">Tussenstand</div>
      ${lijst.length ? htmlStijl(L.huidigDoc(uit, null, Date.now())) : `<div class="tm-info">Zodra iemand antwoordt, verschijnt hier de uitkomst.</div>`}
      ${uit.verschil.length ? `<div class="tm-sub">Om over te praten</div>${uit.verschil.map(id => `<div class="tm-info">${esc(L.gespreksvraag(id))}</div>`).join('')}` : ''}
      ${uit.kruisverschil ? `<div class="tm-info">De gekozen herkenningsstijl (${esc(L.REFS[uit.gekozenStijl]?.n || '')}) wijkt af van wat de antwoorden zeggen. Bespreek dat even.</div>` : ''}
      ${mag && lijst.length ? `<button class="tm-chip aan" data-ss-vast="${esc(r.id)}" style="margin-top:8px">${S._ss.huidig ? 'Vervang de vastgelegde stijl door deze' : 'Leg deze stijl vast'}</button>` : ''}
    </div>
    ${kanMeedoen ? `<div class="kaart"><div class="tm-sub" style="margin-top:0">Jouw antwoorden (${vg.gedaan}/${vg.totaal})</div>
      <div class="tm-info">Je antwoorden worden direct bewaard. Bij het overzicht staat alleen je rol, niet je naam. "Weten we nog niet" mag altijd.</div>${vragen}</div>`
      : `<div class="kaart"><div class="tm-info">${open ? `Deze ronde heeft al ${L.MAX_INVULLERS} invullers.` : 'Deze ronde is gesloten.'}</div></div>`}`;
}

/* ---------- acties ---------- */
export function koppelClubSpeelstijl(v, opnieuw){
  const c = C(); c.opnieuw = opnieuw;
  const root = v.querySelector('#ssRoot'); if (!root) return;
  root.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.ssOpen){ c.sel = d.ssOpen; return opnieuw(); }
    if (d.ssNieuw){ c.nieuw = true; return opnieuw(); }
    if (d.ssTerug){ c.sel = null; c.nieuw = false; return opnieuw(); }
    try {
      if (d.ssMaak){
        const id = 'r' + Date.now().toString(36);
        const r = { naam: `Ronde ${(c.rondes.length || 0) + 1}`, modus: d.ssMaak === 'kort' ? 'kort' : 'volledig', status: 'open', door: uidNu(), gemaaktMs: Date.now() };
        await setDoc(doc(db, 'clubs', S.clubId, 'speelstijlRondes', id), r, { merge: true });
        c.rondes.unshift({ id, ...r }); c.antw[id] = {}; c.sel = id; c.nieuw = false; return opnieuw();
      }
      if (d.ssSluit){
        await setDoc(doc(db, 'clubs', S.clubId, 'speelstijlRondes', d.ssSluit), { status: 'dicht' }, { merge: true });
        const r = c.rondes.find(x => x.id === d.ssSluit); if (r) r.status = 'dicht'; return opnieuw();
      }
      if (d.ssVast){
        const r = c.rondes.find(x => x.id === d.ssVast);
        const uit = L.clubUitkomst(Object.values(c.antw[d.ssVast] || {}).map(x => x.antwoorden || {}), r?.modus);
        const docData = L.huidigDoc(uit, uidNu());
        await setDoc(doc(db, 'clubs', S.clubId, 'speelstijl', 'huidig'), docData, { merge: true });
        c.huidig = docData; meld('Speelstijl vastgelegd'); c.sel = null; return opnieuw();
      }
      if (d.ssA){
        const r = c.rondes.find(x => x.id === c.sel); if (!r || r.status === 'dicht') return;
        const [id, ruw] = d.ssA.split('|');
        const q = L.VRAGEN.find(x => x.id === id); if (!q) return;
        const mijnDoc = c.antw[r.id][uidNu()] || { rol: rolNaam(uidNu()), antwoorden: {} };
        const nu = mijnDoc.antwoorden[id];
        let nieuw = q.k === 'age' ? Number(ruw) : ruw;
        if (q.k === 'multi'){
          const lijst = Array.isArray(nu) ? [...nu] : [];
          const i = lijst.indexOf(ruw);
          if (i >= 0) lijst.splice(i, 1); else lijst.push(ruw);
          nieuw = L.schoonAntwoord(id, lijst.slice(-q.max));
        }
        const schoon = L.schoonAntwoord(id, nieuw); if (schoon === undefined) return;
        mijnDoc.antwoorden = { ...mijnDoc.antwoorden, [id]: schoon };
        c.antw[r.id][uidNu()] = { ...mijnDoc, rol: mijnDoc.rol || rolNaam(uidNu()), bijgewerktMs: Date.now() };
        opnieuw();
        await setDoc(doc(db, 'clubs', S.clubId, 'speelstijlRondes', r.id, 'antwoorden', uidNu()), { rol: c.antw[r.id][uidNu()].rol, antwoorden: { [id]: schoon }, bijgewerktMs: Date.now() }, { merge: true });
      }
    } catch (err){ meld('Opslaan mislukt: ' + (err.code || err.message)); }
  };
}
