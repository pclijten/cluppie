/* ==================== SPEELWIJZE VAN DE CLUB — scherm onder Club [20261019d] ====================
   Een ronde = een vragenlijst (kort of volledig) die maximaal 5 mensen invullen: clubadmin, hoofd jeugd en
   bouwcoördinatoren. Antwoorden staan per rol, niet met naam in het overzicht. Daarna legt de clubadmin of
   hoofd jeugd de uitkomst vast.
   [20261116h] De vastgelegde stijl is nu de speelwijze van de club en stuurt echt: de vier momenten van het spel
   met de principes per leeftijd (speelwijze-logica.js), en die komen terug in het seizoensplan, in Training maken,
   op Trainingen en in de wedstrijdevaluatie van elk team. Iedereen van de club kan de speelwijze bekijken;
   vastleggen blijft bij de clubadmin en het hoofd jeugdopleiding. Snel beginnen kan met een herkenningsstijl.

   Datamodel (alle writes merge:true):
     clubs/{id}/speelstijl/huidig                         vastgelegde uitkomst (speelstijl-logica huidigDoc)
     clubs/{id}/speelstijlRondes/{rondeId}                { naam, modus:'kort'|'volledig', status:'open'|'dicht', door, gemaaktMs }
     clubs/{id}/speelstijlRondes/{rondeId}/antwoorden/{uid} { rol, antwoorden, bijgewerktMs } */
import { S, esc, meld } from './state.js?v=20261129n';
import { rolNaam as clubRolNaam } from './rolnamen.js?v=20261120c';   /* [20261120c] eigen rolnamen van de club */
import { db, doc, collection, getDocs, setDoc } from './firebase.js?v=20261011g';
import { rechtenVoor } from './seizoensplan-club.js?v=20261129n';
import * as L from './speelstijl-logica.js?v=20261127p';
import { speelwijzeVan, perMoment, huidigUitStijl, vormenPerPrincipe } from './speelwijze-logica.js?v=20261127p';
import { htmlWiel, htmlPrincipe, htmlLater, htmlSchuiven } from './speelwijze-html.js?v=20261127p';
import { vormen, laadBibliotheek, bibliotheekGeladen } from './bibliotheek.js?v=20261127y';

const uidNu = () => S.user?.uid || '';
const isPlanner = () => rechtenVoor(S.club, uidNu()).alles;
const chip = (attr, w, t, aan) => `<button class="tm-chip${aan ? ' aan' : ''}" ${attr}="${esc(String(w))}">${esc(t)}</button>`;
const dk = ms => ms ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';

function C(){
  if (!S._ss) S._ss = { huidig: undefined, rondes: null, sel: null, antw: {}, nieuw: false, laadt: false, opnieuw: null, invullen: false, stap: 0, moment: null, open: null, lv: 12, kies: false };
  return S._ss;
}
function rolNaam(uid){
  const c = S.club || {};
  if (c.admins?.[uid]) return 'Clubadmin';
  if (c.hoofdJeugd?.[uid]) return c.instellingen?.jeugdRolNaam || 'Hoofd jeugdopleiding';
  const b = L_BOUWEN.find(x => c.bouwCoordinatoren?.[x]?.[uid]);
  return b ? `${clubRolNaam('coordinator', c, 'Coördinator')} ${b}` : 'Deelnemer';
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

/* [20261116h] De speelwijze van de club: wiel met de vier momenten, principes per leeftijd, de acht keuzes. */
const LEEFTIJD_KEUZE = [8, 10, 12, 15, 18];
function htmlSpeelwijzeClub(h){
  const c = C(), sw = speelwijzeVan(h, c.lv), mag = rechtenVoor(S.club, uidNu());
  if (!bibliotheekGeladen()) laadBibliotheek().then(() => c.opnieuw?.()).catch(() => {});
  const moment = c.moment || perMoment(sw).find(x => x.principes.length)?.moment.id || 'ab';
  const pm = perMoment(sw).find(x => x.moment.id === moment), telling = vormenPerPrincipe(vormen(), sw, c.lv);
  const stijl = h.herkenning && L.REFS[h.herkenning.sleutel];
  const fasenRijen = L.FASEN.filter(f => h.fasen?.[f.id] != null).map(f => `<dt>${esc(L.leeftijdTekst(h.fasen[f.id]))}</dt><dd>${esc(f.n)}</dd>`).join('');
  const fasen = fasenRijen ? `<dl class="sw-bouwen">${fasenRijen}</dl>` : '';
  const niet = (h.willenNiet || []).map(id => L.NEE_OPTIES.find(o => o[0] === id)?.[1]).filter(Boolean);
  return `<div class="kaart sw-kop">
      <div class="tm-kopregel"><div class="tm-kop2">Onze speelwijze</div><span class="tm-badge">vastgelegd ${esc(dk(h.vastgelegdMs))}</span></div>
      ${h.zin ? `<p class="sw-lead">${esc(h.zin)}</p>` : ''}
      <div class="tm-info">${h.modus === 'stijl' ? 'Gekozen als startpunt' : `${h.invullers} ${h.invullers === 1 ? 'invuller' : 'invullers'}`}${stijl ? ` · lijkt het meest op ${esc(stijl.n.toLowerCase())}${h.herkenning.pct < 100 ? ` (${h.herkenning.pct}%)` : ''}` : ''}</div>
    </div>
    <div class="kaart sw-waar">
      <div class="tm-sub" style="margin-top:0">Hier zien trainers de speelwijze terug</div>
      <ol class="sw-stappen">
        <li><b>Seizoen</b><span>Een seizoensplan weegt de speelwijze mee: thema’s die erbij horen komen vaker terug en bij elk blok staat het principe. Zet dat aan bij het plan onder Club › Seizoensplan.</span></li>
        <li><b>Training</b><span>Training maken en de trainingen uit het plan kiezen vormen die het principe trainen. Elke training heeft één leerdoel, drie coachwoorden en de regel van het principe in het partijspel.</span></li>
        <li><b>Wedstrijd</b><span>In de wedstrijdevaluatie staat de vraag van het principe van die weken. Het antwoord stuurt het seizoensplan bij.</span></li>
      </ol>
      <div class="tm-info">Elk team vindt dit onder de tegel Speelwijze, met alleen de principes voor zijn eigen leeftijd.</div>
    </div>
    <div class="kaart sw-momenten">
      <div class="tm-sub" style="margin-top:0">De vier momenten van het spel</div>
      <div class="tm-rij" style="align-items:flex-start"><span class="tm-l">Bekijk voor</span><div class="tm-chips">${LEEFTIJD_KEUZE.map(l => chip('data-ss-lv', l, 'O' + l, c.lv === l)).join('')}</div></div>
      ${htmlWiel(sw, moment)}
      <div class="sw-momentkop" style="--mk:${pm.moment.kleur}"><i aria-hidden="true"></i><b>${esc(pm.moment.naam)}</b><span>${esc(pm.moment.uitleg)}</span></div>
      ${pm.principes.map(p => htmlPrincipe(p, { leeftijd: null, open: c.open === p.id, vormen: telling[p.id] ?? 0 })).join('')}
      ${!pm.principes.length ? `<div class="tm-info" style="margin:6px 2px 10px">${pm.later.length ? `Voor O${c.lv} zijn er bij dit moment nog geen afspraken als team.` : 'Bij dit moment is nog niets gekozen: de onderdelen staan op “nog open”.'}</div>` : ''}
      ${pm.later.map(htmlLater).join('')}
    </div>
    <div class="kaart"><div class="tm-sub" style="margin-top:0">De acht keuzes</div>${htmlSchuiven(h)}
      ${fasen ? `<div class="tm-sub">Per leeftijd</div>${fasen}` : `<div class="tm-info" style="margin-top:8px">Leeftijden niet zelf gekozen: druk zetten en omschakelen als team vanaf O12, vaste posities vanaf O10, de keeper in de opbouw vanaf O8. De volledige vragenlijst laat de club dit zelf bepalen.</div>`}
      ${niet.length ? `<div class="tm-sub">Dit willen wij niet</div><div class="tm-info">${niet.map(esc).join('<br>')}</div>` : ''}
      <div class="tm-info" style="margin-top:8px">Eigen ontwerp op basis van ervaring van trainers, geen gevalideerde test. Leeftijd gaat altijd voor de speelwijze.</div>
    </div>
    ${mag.alles ? `<div class="kaart"><button class="tm-chip" data-ss-kies="1">Kies een andere stijl als startpunt</button><div class="tm-info" style="margin-top:8px">Of leg hem samen vast met een ronde hieronder. Bestaande seizoensplannen houden de speelwijze van het moment waarop ze gemaakt zijn.</div></div>` : ''}`;
}
function htmlSnelStart(wijzigen){
  return `<div class="kaart"><div class="tm-sub" style="margin-top:0">${wijzigen ? 'Kies een andere stijl' : 'Snel beginnen: kies wat het meest op jullie lijkt'}</div>
    <div class="sw-stijlen">${Object.entries(L.REFS).map(([k, r]) => `<button type="button" class="sw-stijl" data-ss-stijl="${k}"><b>${esc(r.n)}</b><span>${esc(r.t)}</span></button>`).join('')}</div>
    <div class="tm-info" style="margin-top:10px">Een stijl is een startpunt voor de hele club. Preciezer en met draagvlak: start hieronder een ronde, dan vullen maximaal ${L.MAX_INVULLERS} mensen de vragen in en leg je de uitkomst vast.</div>
    ${wijzigen ? `<button class="tm-chip" data-ss-kies="0" style="margin-top:8px">Terug</button>` : ''}</div>`;
}

function htmlOverzicht(){
  const c = C(), h = c.huidig, mag = rechtenVoor(S.club, uidNu());
  return `${h && !c.kies ? htmlSpeelwijzeClub(h) : `<div class="kaart sw-intro">
      <div class="tm-kop2">Hoe willen wij voetballen?</div>
      <p class="sw-lead">De speelwijze van de club is de rode draad voor elk team: van het seizoensplan via de training naar de wedstrijd.</p>
      ${h ? '' : `<div class="tm-info">Nog niet vastgelegd. ${mag.alles ? 'Kies hieronder een stijl als startpunt, of leg hem samen vast met een korte (8 vragen) of volledige vragenlijst (26 vragen).' : 'De clubadmin of het hoofd jeugdopleiding legt hem vast.'} Dit is een eigen ontwerp, geen gevalideerde test.</div>`}
    </div>${mag.alles ? htmlSnelStart(!!h) : ''}`}
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

/* ---------- invullen: één vraag per scherm ---------- */
const SS_MIN = { kort: 'ongeveer 2 minuten', volledig: 'ongeveer 7 minuten' };
const ssBeantwoord = (q, w) => q.k === 'multi' ? Array.isArray(w) && w.length > 0 : w !== undefined && w !== null;
const optie = (attr, w, t, aan, extra = '') => `<button class="ss-optie${aan ? ' aan' : ''}${extra}" ${attr}="${esc(String(w))}"><span class="ss-vink" aria-hidden="true"></span><span>${esc(t)}</span></button>`;

function htmlVraag(q, mijn){
  const w = mijn[q.id];
  if (q.k === 'ab') return `<div class="ss-opties">${optie('data-ss-a', q.id + '|A', q.A, w === 'A')}${optie('data-ss-a', q.id + '|B', q.B, w === 'B')}${optie('data-ss-a', q.id + '|?', 'Weten we nog niet', w === '?', ' ss-zacht')}</div>`;
  if (q.k === 'age') return `<div class="ss-leeftijden">${L.LEEFTIJDEN.map(l => `<button class="ss-pil${w === l ? ' aan' : ''}" data-ss-a="${esc(q.id + '|' + l)}">${l === 99 ? 'Nooit' : 'O' + l}</button>`).join('')}</div>`;
  return `<div class="ss-opties">${q.o.map(o => optie('data-ss-a', q.id + '|' + o[0], o[1], q.k === 'one' ? w === o[0] : (w || []).includes(o[0]))).join('')}</div>`;
}

function htmlInvul(r, mijn){
  const c = C(), vr = L.vragenVoor(r.modus), n = vr.length;
  if (c.stap >= n){
    const gedaan = vr.filter(q => ssBeantwoord(q, mijn[q.id])).length;
    return `<div class="ss-invul"><div class="ss-klaar">
      <div class="ss-klaar-icoon" aria-hidden="true">✓</div>
      <h2 class="ss-vraag">Dat was het</h2>
      <p class="ss-hulp">${gedaan} van ${n} vragen beantwoord. Je antwoorden zijn bewaard. Je kunt ze later nog aanpassen zolang de ronde open is.</p>
      <div class="ss-voet"><button class="ss-knop" data-ss-stop="1">Bekijk de tussenstand</button><button class="ss-link" data-ss-nalopen="1">Antwoorden nalopen</button></div></div></div>`;
  }
  const q = vr[c.stap], w = mijn[q.id];
  const multi = q.k === 'multi', aantal = multi ? (Array.isArray(w) ? w.length : 0) : 0;
  const hulp = q.k === 'ab' ? 'Kies wat het beste bij jullie past. Er is geen goed of fout.' : multi ? `Kies er maximaal ${q.max}. Je gekozen aantal: ${aantal} van ${q.max}.` : '';
  const volgende = multi ? (aantal ? 'Volgende' : 'Overslaan') : (ssBeantwoord(q, w) ? 'Volgende' : 'Overslaan');
  return `<div class="ss-invul">
    <div class="ss-top"><button class="ss-link" data-ss-stop="1">Sluiten</button><span class="ss-teller">${c.stap + 1} van ${n}</span></div>
    <div class="ss-balk" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${c.stap + 1}"><i style="width:${Math.round((c.stap + 1) / n * 100)}%"></i></div>
    <div class="ss-deel">${esc(L.DEELN[q.deel] || '')}</div>
    <h2 class="ss-vraag">${esc(q.q)}</h2>
    ${hulp ? `<p class="ss-hulp">${esc(hulp)}</p>` : ''}
    ${htmlVraag(q, mijn)}
    <div class="ss-voet">${c.stap > 0 ? '<button class="ss-link" data-ss-vorige="1">Vorige</button>' : '<span></span>'}<button class="ss-knop${ssBeantwoord(q, w) ? '' : ' zacht'}" data-ss-volgende="1">${volgende}</button></div>
  </div>`;
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
  const kanMeedoen = open && (alle[uidNu()] || lijst.length < L.MAX_INVULLERS);
  if (c.invullen && kanMeedoen) return htmlInvul(r, mijn);
  const pct = vg.totaal ? Math.round(vg.gedaan / vg.totaal * 100) : 0;
  const meedoen = kanMeedoen ? `<div class="kaart ss-uitnodiging"><div class="tm-sub" style="margin-top:0">Jouw antwoorden</div>
      <div class="ss-uit-kop">${vg.gedaan === 0 ? 'Vul jouw kant in' : vg.gedaan >= vg.totaal ? 'Je hebt alles ingevuld' : 'Ga verder waar je bleef'}</div>
      <div class="ss-balk"><i style="width:${pct}%"></i></div>
      <div class="tm-info">${vg.gedaan} van ${vg.totaal} beantwoord · ${SS_MIN[r.modus === 'kort' ? 'kort' : 'volledig']} · één vraag per scherm. Je antwoorden worden direct bewaard, bij het overzicht staat alleen je rol. "Weten we nog niet" mag altijd.</div>
      <button class="ss-knop" data-ss-begin="1" style="margin-top:12px">${vg.gedaan === 0 ? 'Begin' : vg.gedaan >= vg.totaal ? 'Antwoorden aanpassen' : 'Ga verder'}</button></div>`
    : `<div class="kaart"><div class="tm-info">${open ? `Deze ronde heeft al ${L.MAX_INVULLERS} invullers.` : 'Deze ronde is gesloten.'}</div></div>`;
  return `<div class="kaart">
      <div class="tm-sub" style="margin-top:0">${esc(r.naam || 'Ronde')} · ${r.modus === 'kort' ? 'kort' : 'volledig'}${open ? '' : ' · gesloten'}</div>
      <div class="tm-info">${lijst.length} van max ${L.MAX_INVULLERS} invullers: ${lijst.map(x => `${esc(x.rol || 'Deelnemer')} (${L.voortgang(x.antwoorden || {}, r.modus).gedaan}/${vg.totaal})`).join(', ') || 'nog niemand'}.</div>
      <button class="tm-chip" data-ss-terug="1">Terug</button>
      ${mag && open ? `<button class="tm-chip" data-ss-sluit="${esc(r.id)}">Ronde sluiten</button>` : ''}
    </div>
    ${meedoen}
    <div class="kaart"><div class="tm-sub" style="margin-top:0">Tussenstand</div>
      ${lijst.length ? htmlStijl(L.huidigDoc(uit, null, Date.now())) : `<div class="tm-info">Zodra iemand antwoordt, verschijnt hier de uitkomst.</div>`}
      ${uit.verschil.length ? `<div class="tm-sub">Om over te praten</div>${uit.verschil.map(id => `<div class="tm-info">${esc(L.gespreksvraag(id))}</div>`).join('')}` : ''}
      ${uit.kruisverschil ? `<div class="tm-info">De gekozen herkenningsstijl (${esc(L.REFS[uit.gekozenStijl]?.n || '')}) wijkt af van wat de antwoorden zeggen. Bespreek dat even.</div>` : ''}
      ${mag && lijst.length ? `<button class="tm-chip aan" data-ss-vast="${esc(r.id)}" style="margin-top:8px">${S._ss.huidig ? 'Vervang de vastgelegde speelwijze door deze' : 'Leg deze speelwijze vast'}</button>` : ''}
    </div>`;
}

/* ---------- acties ---------- */
export function koppelClubSpeelstijl(v, opnieuw){
  const c = C(); c.opnieuw = opnieuw;
  const root = v.querySelector('#ssRoot'); if (!root) return;
  root.onkeydown = e => { const kw = (e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-sw-moment]'); if (kw){ e.preventDefault(); c.moment = kw.dataset.swMoment; c.open = null; opnieuw(); } };
  const nieuweStap = () => { opnieuw(); document.getElementById('ssRoot')?.scrollIntoView({ block: 'start' }); };
  root.onclick = async e => {
    const kw = e.target.closest('[data-sw-moment]');
    if (kw){ c.moment = kw.dataset.swMoment; c.open = null; return opnieuw(); }
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.swPrincipe){ c.open = c.open === d.swPrincipe ? null : d.swPrincipe; return opnieuw(); }
    if (d.ssLv){ c.lv = Number(d.ssLv); c.open = null; return opnieuw(); }
    if (d.ssKies){ c.kies = d.ssKies === '1'; return opnieuw(); }
    if (d.ssStijl){
      if (c.huidig && !confirm('De vastgelegde speelwijze vervangen door deze stijl?')) return;
      const docData = huidigUitStijl(d.ssStijl, uidNu());
      try { await setDoc(doc(db, 'clubs', S.clubId, 'speelstijl', 'huidig'), { ...docData, fasen: Object.fromEntries(L.FASEN.map(f => [f.id, null])) }, { merge: true }); c.huidig = docData; c.kies = false; c.moment = null; meld('Speelwijze vastgelegd'); }
      catch (err){ meld('Opslaan mislukt: ' + (err.code || err.message)); }
      return opnieuw();
    }
    if (d.ssOpen){ c.sel = d.ssOpen; return opnieuw(); }
    if (d.ssNieuw){ c.nieuw = true; return opnieuw(); }
    if (d.ssTerug){ c.sel = null; c.nieuw = false; c.invullen = false; return opnieuw(); }
    if (d.ssBegin){
      const r = c.rondes.find(x => x.id === c.sel), mijn = c.antw[r?.id]?.[uidNu()]?.antwoorden || {};
      const vr = L.vragenVoor(r?.modus), eerste = vr.findIndex(q => !ssBeantwoord(q, mijn));
      c.invullen = true; c.stap = eerste < 0 ? 0 : eerste; return nieuweStap();
    }
    if (d.ssStop){ c.invullen = false; return nieuweStap(); }
    if (d.ssNalopen){ c.stap = 0; return nieuweStap(); }
    if (d.ssVorige){ c.stap = Math.max(0, c.stap - 1); return nieuweStap(); }
    if (d.ssVolgende){ c.stap += 1; return nieuweStap(); }
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
        c.huidig = docData; c.moment = null; meld('Speelwijze vastgelegd'); c.sel = null; return opnieuw();
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
        if (c.invullen && q.k !== 'multi') c.stap += 1;      /* één keuze: meteen naar de volgende vraag */
        nieuweStap();
        await setDoc(doc(db, 'clubs', S.clubId, 'speelstijlRondes', r.id, 'antwoorden', uidNu()), { rol: c.antw[r.id][uidNu()].rol, antwoorden: { [id]: schoon }, bijgewerktMs: Date.now() }, { merge: true });
      }
    } catch (err){ meld('Opslaan mislukt: ' + (err.code || err.message)); }
  };
}
