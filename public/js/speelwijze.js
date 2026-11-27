/* ==================== SPEELWIJZE — scherm voor het team en de gedeelde lader [20261116h] ====================
   De speelwijze is de rode draad door Seizoen, Training maken, Trainingen en de wedstrijdevaluatie.
   Dit bestand laadt hem voor het team dat open staat en toont het teamscherm (tabblad 'speelwijze').

   Waar komt de speelwijze vandaan?
     1. clubs/{clubId}/speelstijl/huidig     vastgelegd door de club (scherm Club › Speelwijze, speelstijl.js);
     2. teams/{teamId}/speelstijl/huidig     van het team zelf: voor een trainer zonder club, of zolang de club
                                             nog niets heeft vastgelegd. Valt onder de bestaande team-rule.
   De club gaat altijd voor. Beide documenten hebben dezelfde vorm (speelstijl-logica huidigDoc): alleen standen,
   geen namen. Runtime op S._sw en S._swT; state.js blijft ongemoeid. Alle writes merge:true.

   Importeert NIET uit teams.js of teams-seizoensplan.js (geen kringimport): het plan van het team leest hij uit
   S._spPlan, en teams.js geeft zetTeamTab mee. */
import { S, esc, meld, modAan } from './state.js?v=20261129b';
import { db, doc, getDoc, setDoc, deleteDoc } from './firebase.js?v=20261011g';
import { leeftijdVanCategorie, catLabel } from './config.js?v=20261129b';
import { onderdeelAan, werkwijzeToestaat } from './onderdelen.js?v=20261129b';
import { vormen, vormOpId, laadBibliotheek, bibliotheekGeladen } from './bibliotheek.js?v=20261127y';
import { positieOp, positieWeek } from './seizoensplan-logica.js?v=20261129b';
import { rechtenVoor } from './seizoensplan-club.js?v=20261129b';
import { maak3DBlok } from './scene3d.js?v=20261126p';
import * as L from './speelstijl-logica.js?v=20261127p';
import { speelwijzeVan, perMoment, rodeDraad, dekking, vormenPerPrincipe, principeVoorThema, huidigUitStijl, MOMENTEN } from './speelwijze-logica.js?v=20261127p';
import { htmlDraadKaart, htmlWiel, htmlPrincipe, htmlLater, htmlSchuiven } from './speelwijze-html.js?v=20261127p';

const vandaagIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
const leeftijd = () => leeftijdVanCategorie(S.team?.categorie);
const FASEN_LEEG = Object.fromEntries(L.FASEN.map(f => [f.id, null]));

/* ---------- laden (één keer per team) ---------- */
function lader(){
  if (!S._sw || S._sw.teamId !== S.teamId) S._sw = { teamId: S.teamId, huidig: null, bron: null, geladen: false, belofte: null };
  return S._sw;
}
/* [20261127s] De speelwijze is een module die de club (Instellingen › AI & modules) of het team (Teams beheren)
   aan en uit zet, zoals Evaluaties en Leerlijn. Staat er niets, dan staat hij aan. Uit = het tabblad verdwijnt en
   de rest van de app doet alsof er geen speelwijze is: geen rode draad, geen principe bij trainingen en blokken. */
export const speelwijzeAan = (team = S.team) => modAan('speelwijze', team);
export function laadSpeelwijze(opnieuw = false){
  if (!speelwijzeAan()) return Promise.resolve(null);
  const c = lader();
  if (c.belofte && !opnieuw) return c.belofte;
  const teamId = S.teamId, club = S.team?.club || null;
  c.belofte = (async () => {
    let huidig = null, bron = null;
    if (club){
      try { const sn = await getDoc(doc(db, 'clubs', club, 'speelstijl', 'huidig')); if (sn.exists() && sn.data()?.standen){ huidig = sn.data(); bron = 'club'; } }
      catch (e){ console.warn('[speelwijze] club lezen mislukt', e.code || e); }
    }
    if (!huidig){
      try { const sn = await getDoc(doc(db, 'teams', teamId, 'speelstijl', 'huidig')); if (sn.exists() && sn.data()?.standen){ huidig = sn.data(); bron = 'team'; } }
      catch (e){ console.warn('[speelwijze] team lezen mislukt', e.code || e); }
    }
    if (S._sw?.teamId === teamId){ S._sw.huidig = huidig; S._sw.bron = bron; S._sw.geladen = true; }
    return huidig;
  })();
  return c.belofte;
}
export const speelwijzeGeladen = () => speelwijzeAan() && !!(S._sw && S._sw.teamId === S.teamId && S._sw.geladen);
/* Het speelstijl-document van dit team (van de club of van het team zelf), of null. */
export function speelstijlNu(){ return speelwijzeGeladen() ? S._sw.huidig : null; }
export function speelwijzeBron(){ return speelwijzeGeladen() ? S._sw.bron : null; }
/* De speelwijze voor de leeftijd van dit team, of null. */
export function speelwijzeNu(){ const h = speelstijlNu(); return h ? speelwijzeVan({ ...h, bron: S._sw.bron }, leeftijd()) : null; }

/* Mag de trainer voor dit team zelf een speelwijze kiezen? Niet als de club er één heeft vastgelegd, en bij
   een club die de trainingen stuurt alleen de sturende rollen (zelfde regel als het seizoensplan). */
export function magTeamSpeelwijze(){
  if (speelwijzeBron() === 'club') return false;
  if (!S.team?.club) return true;
  return werkwijzeToestaat('seizoensplan', S.team);
}

/* ---------- de rode draad van dit moment ----------
   Thema en fase volgen uit het seizoensplan van het team (S._spPlan, gezet door teams-seizoensplan.js). */
export function planPositieNu(datum = vandaagIso()){
  const plan = onderdeelAan('seizoensplan') && S._spPlan && S._spPlan.teamId === S.teamId ? S._spPlan.plan : null;
  if (!plan?.blokken?.length || !plan.kal?.length) return null;
  const p = positieOp(plan, datum) || (datum < plan.params?.start ? positieWeek(plan, 1) : null);
  return p ? { plan, thema: p.blok.thema, fase: p.fase, blok: p.blok.nr, weekInBlok: p.weekInBlok, weken: p.blok.weken, bronPlan: plan.bron === 'club' ? 'club' : 'seizoensplan' } : { plan };
}
export function draadNu(o = null){
  const pos = o || planPositieNu() || {};
  return rodeDraad(speelwijzeNu(), { ...pos, leeftijd: leeftijd() });
}
/* Een halte van de draad openen. */
export function gaNaarDraad(k, zetTeamTab){
  if (k === 'speelwijze') return zetTeamTab('speelwijze');
  if (k === 'seizoen') return zetTeamTab(onderdeelAan('seizoensplan') ? 'seizoensplan' : 'trainingen');
  if (k === 'training') return zetTeamTab(onderdeelAan('trainingsmodule') ? 'trainingsmodule' : 'trainingen');
  if (k === 'wedstrijd') return zetTeamTab('wedstrijden');
}

/* ---------- 3D-voorbeeld per principe ---------- */
function voorbeeldVorm(principeId){
  const lv = leeftijd(), past = v => lv >= 99 || (lv >= v.leeftijd[0] && lv <= v.leeftijd[1]);
  const lijst = vormen().filter(v => (v.principes || []).includes(principeId) && (v.tekening?.lijnen || []).length);
  return (lijst.find(v => v.id.startsWith('sw-') && past(v)) || lijst.find(v => past(v) && v.tekening.lijnen.length >= 3) || lijst.find(v => v.id.startsWith('sw-')) || lijst[0] || null)?.id || null;
}

/* ---------- scherm ---------- */
function staat(){
  if (!S._swT || S._swT.teamId !== S.teamId) S._swT = { teamId: S.teamId, moment: null, open: null, drie: null, kies: false, vragen: null, schuiven: false };
  return S._swT;
}
export function htmlTeamSpeelwijze(){
  if (!speelwijzeGeladen()) laadSpeelwijze().then(() => teken()).catch(() => {});
  if (!bibliotheekGeladen()) laadBibliotheek().then(() => teken()).catch(() => {});
  return `<div id="swRoot" class="tm sw">${htmlInhoud()}</div>`;
}
function htmlInhoud(){
  const t = staat();
  if (!speelwijzeGeladen()) return `<div class="kaart"><div class="tm-info">Laden…</div></div>`;
  if (t.vragen) return htmlVragen();
  const sw = speelwijzeNu();
  if (!sw || t.kies) return htmlStart(!!sw);
  return htmlSpeelwijze(sw);
}

function htmlStart(wijzigen){
  const t = staat(), mag = magTeamSpeelwijze(), club = !!S.team?.club;
  const planner = club && rechtenVoor(S.club, S.user?.uid).magPlan;
  const uitleg = `<div class="kaart sw-intro">
      <div class="tm-kop2">Hoe willen wij voetballen?</div>
      <p class="sw-lead">De speelwijze is de rode draad van het seizoen. Leg hem één keer vast en je ziet hem overal terug.</p>
      <ol class="sw-stappen">
        <li><b>Seizoen</b><span>Thema’s die bij jullie speelwijze horen komen vaker terug. Bij elk blok staat het principe.</span></li>
        <li><b>Training</b><span>Elke training heeft één leerdoel, vormen die het principe trainen en drie coachwoorden.</span></li>
        <li><b>Wedstrijd</b><span>Na afloop één vraag: zagen we het terug? Het antwoord stuurt het seizoen bij.</span></li>
      </ol>
    </div>`;
  if (!mag) return `${uitleg}<div class="kaart"><div class="tm-info">${club ? 'Jullie club heeft de speelwijze nog niet vastgelegd. Dat doet de clubbeheerder of het hoofd jeugdopleiding onder Club › Speelwijze. Tot die tijd volgen de trainingen het thema van het seizoensplan.' : 'Voor dit team kan nog geen speelwijze worden gekozen.'}</div></div>`;
  return `${wijzigen ? '' : uitleg}
    <div class="kaart"><div class="tm-sub" style="margin-top:0">${wijzigen ? 'Kies een andere speelwijze' : 'Kies wat het meest op jullie lijkt'}</div>
      ${club ? `<div class="tm-info" style="margin-bottom:8px">Jullie club heeft nog geen speelwijze vastgelegd${planner ? ' (dat kan onder Club › Speelwijze)' : ''}. Wat je hier kiest geldt voor dit team, tot de club het vastlegt.</div>` : ''}
      <div class="sw-stijlen">${Object.entries(L.REFS).map(([k, r]) => `<button type="button" class="sw-stijl" data-sw-stijl="${k}"><b>${esc(r.n)}</b><span>${esc(r.t)}</span></button>`).join('')}</div>
      <div class="tm-info" style="margin:10px 0 8px">Een stijl is een startpunt. Wil je het preciezer, beantwoord dan acht korte vragen: één per onderdeel van het spel.</div>
      <button type="button" class="knop vol licht" data-sw-vragen="1">Beantwoord 8 vragen (2 minuten)</button>
      ${wijzigen ? `<button type="button" class="knop vol licht" data-sw-kies="0" style="margin-top:8px">Terug</button>` : ''}
    </div>
    <div class="tm-info" style="margin:0 2px 12px">Eigen ontwerp op basis van ervaring van trainers, geen gevalideerde test. Leeftijd gaat altijd voor: waar een team te jong voor is, komt later.</div>`;
}

function htmlVragen(){
  const t = staat(), q = L.KORT[t.vragen.stap], n = L.KORT.length;
  if (!q){
    const gedaan = L.KORT.filter(x => t.vragen.antw[x.id]).length;
    return `<div class="ss-invul"><div class="ss-klaar"><div class="ss-klaar-icoon" aria-hidden="true">✓</div>
      <h2 class="ss-vraag">Dat was het</h2><p class="ss-hulp">${gedaan} van ${n} vragen beantwoord. Kies nog welke onderdelen het zwaarst wegen (maximaal drie), of sla dit over.</p>
      <div class="tm-chips" style="justify-content:center;margin-bottom:14px">${L.DIMS.map(d => `<button type="button" class="tm-chip${(t.vragen.antw.t3 || []).includes(d.id) ? ' aan' : ''}" data-sw-top="${d.id}">${esc(d.n)}</button>`).join('')}</div>
      <div class="ss-voet"><button type="button" class="ss-link" data-sw-vstap="-1">Vorige</button><button type="button" class="ss-knop" data-sw-vklaar="1">Leg vast</button></div></div></div>`;
  }
  const w = t.vragen.antw[q.id];
  const optie = (kant, tekst, zacht) => `<button type="button" class="ss-optie${w === kant ? ' aan' : ''}${zacht ? ' ss-zacht' : ''}" data-sw-antw="${q.id}|${kant}"><span class="ss-vink" aria-hidden="true"></span><span>${esc(tekst)}</span></button>`;
  return `<div class="ss-invul">
    <div class="ss-top"><button type="button" class="ss-link" data-sw-vstop="1">Sluiten</button><span class="ss-teller">${t.vragen.stap + 1} van ${n}</span></div>
    <div class="ss-balk" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${t.vragen.stap + 1}"><i style="width:${Math.round((t.vragen.stap + 1) / n * 100)}%"></i></div>
    <div class="ss-deel">${esc(L.DIMS.find(d => d.id === q.dim)?.n || '')}</div>
    <h2 class="ss-vraag">${esc(q.q)}</h2><p class="ss-hulp">Kies wat het beste bij jullie past. Er is geen goed of fout.</p>
    <div class="ss-opties">${optie('A', q.A)}${optie('B', q.B)}${optie('?', 'Weten we nog niet', true)}</div>
    <div class="ss-voet">${t.vragen.stap > 0 ? '<button type="button" class="ss-link" data-sw-vstap="-1">Vorige</button>' : '<span></span>'}<button type="button" class="ss-knop${w ? '' : ' zacht'}" data-sw-vstap="1">${w ? 'Volgende' : 'Overslaan'}</button></div>
  </div>`;
}

function htmlSpeelwijze(sw){
  const t = staat(), h = speelstijlNu(), lv = leeftijd(), pos = planPositieNu();
  const draad = draadNu();
  const moment = t.moment || draad.principe?.moment || (perMoment(sw).find(x => x.principes.length)?.moment.id) || 'ab';
  const dek = pos?.plan ? dekking(pos.plan, sw) : null;
  const telling = vormenPerPrincipe(vormen(), sw, lv);
  const pm = perMoment(sw).find(x => x.moment.id === moment);
  const stijl = h.herkenning && L.REFS[h.herkenning.sleutel];
  const kop = `<div class="kaart sw-kop">
      <div class="tm-kopregel"><div class="tm-kop2">Onze speelwijze</div><span class="tm-badge">${speelwijzeBron() === 'club' ? 'Van de club' : 'Van jouw team'}</span></div>
      ${sw.zin ? `<p class="sw-lead">${esc(sw.zin)}</p>` : ''}
      <div class="tm-info">${esc(S.team?.naam || '')} · ${esc(catLabel(S.team?.categorie))} · ${sw.actief.length} ${sw.actief.length === 1 ? 'principe' : 'principes'} voor deze leeftijd${sw.later.length ? `, ${sw.later.length} later` : ''}${stijl ? ` · lijkt op ${esc(stijl.n.toLowerCase())}` : ''}</div>
    </div>`;
  const draadKaart = pos?.thema
    ? htmlDraadKaart(draad, 'speelwijze', { open: false })
    : `<div class="kaart sw-dk">${''}<div class="tm-info">${onderdeelAan('seizoensplan') ? 'Nog geen seizoensplan voor dit team. Maak er een onder Seizoen: dan zie je hier per week welk principe aan de beurt is.' : (onderdeelAan('trainingsmodule') ? 'De speelwijze stuurt Training maken. Kies daar een thema en je ziet welk principe erbij hoort.' : 'De trainingen van je team volgen de speelwijze. Bij een training op Trainingen staat het principe dat erbij hoort.')}</div>${onderdeelAan('seizoensplan') ? `<button type="button" class="knop klein licht" data-draad="seizoen" style="margin-top:8px">Naar Seizoen</button>` : ''}</div>`;
  const principes = pm.principes.map(p => {
    const d = dek?.perPrincipe.find(x => x.id === p.id), vb = voorbeeldVorm(p.id);
    return htmlPrincipe(p, { leeftijd: lv, open: t.open === p.id, weken: dek ? d?.weken || 0 : null, blokken: d?.blokken || 0, vormen: telling[p.id] ?? 0, voorbeeld: vb, drieOpen: t.drie === vb && t.open === p.id, nu: draad.principe?.id === p.id });
  }).join('');
  const leeg = !pm.principes.length ? `<div class="tm-info" style="margin:6px 2px 10px">${pm.later.length ? 'Voor dit moment zijn er op deze leeftijd nog geen afspraken als team.' : `Bij dit moment is nog niets gekozen. ${magTeamSpeelwijze() ? 'Dat kan via “Wijzig de speelwijze”.' : 'De club kan dat vastleggen onder Club › Speelwijze.'}`}</div>` : '';
  return `${kop}${draadKaart}
    <div class="kaart sw-momenten">
      <div class="tm-sub" style="margin-top:0">De vier momenten van het spel</div>
      ${htmlWiel(sw, moment)}
      <div class="sw-momentkop" style="--mk:${pm.moment.kleur}"><i aria-hidden="true"></i><b>${esc(pm.moment.naam)}</b><span>${esc(pm.moment.uitleg)}</span></div>
      ${principes}${leeg}${pm.later.map(htmlLater).join('')}
    </div>
    <div class="kaart"><button type="button" class="sw-uitklap" data-sw-schuiven="1" aria-expanded="${t.schuiven}">De acht keuzes achter de speelwijze <span aria-hidden="true">${t.schuiven ? '−' : '+'}</span></button>
      ${t.schuiven ? `${htmlSchuiven(h)}${(h.willenNiet || []).length ? `<div class="tm-sub">Dit willen wij niet</div><div class="tm-info">${h.willenNiet.map(id => esc(L.NEE_OPTIES.find(o => o[0] === id)?.[1] || '')).filter(Boolean).join('<br>')}</div>` : ''}` : ''}
    </div>
    ${magTeamSpeelwijze() ? `<div class="kaart"><div class="tm-rij"><button type="button" class="knop klein licht" data-sw-kies="1">Wijzig de speelwijze</button><button type="button" class="knop klein licht" data-sw-weg="1">Verwijder</button></div>
      <div class="tm-info" style="margin-top:8px">Wijzig je de speelwijze, dan volgen Training maken en dit scherm meteen. Een bestaand seizoensplan houdt de speelwijze van het moment waarop het gemaakt is; maak het opnieuw om de nieuwe mee te nemen.</div></div>`
      : `<div class="tm-info" style="margin:0 2px 12px">Vastgelegd door de club. Wijzigen kan de clubbeheerder of het hoofd jeugdopleiding onder Club › Speelwijze.</div>`}
    <div class="tm-info" style="margin:0 2px 12px">Eigen ontwerp op basis van ervaring van trainers, geen gevalideerde test. Leeftijd gaat altijd voor de speelwijze.</div>`;
}

/* ---------- opslaan ---------- */
async function bewaar(huidig){
  const data = { ...huidig, fasen: { ...FASEN_LEEG, ...(huidig.fasen || {}) }, bron: 'team', vastgelegdDoor: S.user?.uid || null, vastgelegdMs: Date.now() };
  try {
    await setDoc(doc(db, 'teams', S.teamId, 'speelstijl', 'huidig'), data, { merge: true });
    Object.assign(lader(), { huidig: data, bron: 'team', geladen: true });
    const t = staat(); t.kies = false; t.vragen = null; t.moment = null; t.open = null;
    meld('Speelwijze vastgelegd');
  } catch (e){ meld('Opslaan mislukt: ' + (e.code || e.message)); }
  teken();
}
async function verwijder(){
  if (!confirm('De speelwijze van dit team verwijderen? Trainingen volgen daarna alleen nog het thema.')) return;
  try {
    await deleteDoc(doc(db, 'teams', S.teamId, 'speelstijl', 'huidig'));
    Object.assign(lader(), { huidig: null, bron: null, geladen: true });
    Object.assign(staat(), { kies: false, vragen: null, moment: null, open: null });
    meld('Speelwijze verwijderd');
  } catch (e){ meld('Verwijderen mislukt: ' + (e.code || e.message)); }
  teken();
}

/* ---------- koppelen ---------- */
const blokken3D = new Map();
function plaats3D(root){
  const nu = new Set();
  root.querySelectorAll('[data-sw-drieplek]').forEach(plek => {
    const id = plek.dataset.swDrieplek; nu.add(id);
    let blok = blokken3D.get(id);
    if (!blok){ const v = vormOpId(id); if (!v) return; blok = document.createElement('div'); blok.className = 'sw-3dblok'; blok.innerHTML = `<div class="sw-3dnaam">${esc(v.naam)}</div>`; const b = maak3DBlok(v, v.veld); blok.appendChild(b); blok.weg = () => b.weg?.(); blokken3D.set(id, blok); }
    plek.replaceWith(blok);
  });
  for (const [k, b] of blokken3D) if (!nu.has(k)){ b.weg?.(); blokken3D.delete(k); }
}
function teken(){
  const root = document.getElementById('swRoot'); if (!root) return;
  const y = window.scrollY; root.innerHTML = htmlInhoud(); plaats3D(root); window.scrollTo({ top: y });
}
export function koppelTeamSpeelwijze(v, { zetTeamTab }){
  const root = v.querySelector('#swRoot'); if (!root) return;
  plaats3D(root);
  const t = staat();
  const klik = e => {
    const kw = e.target.closest('[data-sw-moment]');
    if (kw){ t.moment = kw.dataset.swMoment; t.open = null; t.drie = null; return teken(); }
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.draad) return gaNaarDraad(d.draad, zetTeamTab);
    if (d.swPrincipe){ t.open = t.open === d.swPrincipe ? null : d.swPrincipe; t.drie = null; return teken(); }
    if (d.swDrie){ t.drie = t.drie === d.swDrie ? null : d.swDrie; return teken(); }
    if (d.swSchuiven){ t.schuiven = !t.schuiven; return teken(); }
    if (d.swKies){ t.kies = d.swKies === '1'; return teken(); }
    if (d.swWeg) return verwijder();
    if (d.swStijl){ const h = huidigUitStijl(d.swStijl, S.user?.uid || null); if (h) bewaar(h); return; }
    if (d.swVragen){ t.vragen = { stap: 0, antw: {} }; teken(); return document.getElementById('swRoot')?.scrollIntoView({ block: 'start' }); }
    if (d.swVstop){ t.vragen = null; return teken(); }
    if (d.swVstap){ t.vragen.stap = Math.max(0, Math.min(L.KORT.length, t.vragen.stap + Number(d.swVstap))); return teken(); }
    if (d.swAntw){ const [id, w] = d.swAntw.split('|'); t.vragen.antw[id] = w; t.vragen.stap += 1; return teken(); }
    if (d.swTop){ const a = new Set(t.vragen.antw.t3 || []); if (a.has(d.swTop)) a.delete(d.swTop); else if (a.size < 3) a.add(d.swTop); t.vragen.antw.t3 = [...a]; return teken(); }
    if (d.swVklaar){
      const uit = L.clubUitkomst([t.vragen.antw], 'kort');
      if (!Object.values(uit.perDim).some(x => x.status !== 'open')){ meld('Beantwoord minstens één vraag met een keuze'); return; }
      return bewaar(L.huidigDoc(uit, S.user?.uid || null));
    }
  };
  root.addEventListener('click', klik);
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-sw-moment]')){ e.preventDefault(); klik(e); } });
}

/* De rode draad bij een training op Trainingen (document met thema en fase). Zonder thema: leeg. */
export function htmlDraadVoorTraining(t){
  if (!t?.thema || !speelwijzeGeladen() || !speelwijzeNu()) return '';
  const d = rodeDraad(speelwijzeNu(), { thema: t.thema, fase: t.fase || '', blok: t.blokNr || null, leeftijd: leeftijd() });
  return d.principe ? htmlDraadKaart(d, 'training', { links: false, open: false }) : '';
}
/* De vraag voor na de wedstrijd bij het thema van die week: de vraag van het principe, of null. */
export function wedstrijdvraagNu(thema){
  const p = principeVoorThema(speelwijzeNu(), thema);
  return p ? { vraag: p.vraag, principe: p } : null;
}

export { MOMENTEN };
