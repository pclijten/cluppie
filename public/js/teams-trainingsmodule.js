/* ==================== TRAINING MAKEN (teams/{teamId}/trainingsplannen) ====================
   [20261012e] Genereert een complete training uit de eigen bibliotheek (trainingsbibliotheek.js)
   met de regelgebaseerde planner (trainingsplanner.js): opbouw met warming-up, twee kernvormen,
   partijspel en afsluiting, elk met tekening, uitleg, coachpunten en een themaregel. De
   keuze en de controle zijn code; de AI mag alleen de uitleg afstemmen op het team
   (functie personaliseerTraining) en de module werkt volledig zonder AI.

   Leerlijn: staat er een seizoensplan (teams-seizoensplan.js), dan volgt het thema en de blokfase
   (Ontdek / Verdiep / Pas toe / Wedstrijd) daaruit; anders uit de standaard jaarlijn van de bouw.

   Opslag: één document per bewaarde training, alleen vorm-id's en minuten (geen spelersdata,
   geen namen):
     { profiel:{categorie, aantalSpelers, niveau, duur, thema, blokFase, week},
       onderdelen:[{slot, minuten, vormId}], knop:{druk,complexiteit,stijl},
       bibliotheekVersie, seizoen, door:uid, gemaaktMs }
   De bestaande /teams/{teamId}/{sub=**}-rule dekt deze subcollectie; geen rules-wijziging.

   Tabblad: 'trainingsmodule'. Importeert NIET uit teams.js (geen kringimport); teams.js geeft
   zetTeamTab mee aan koppelTrainingsmodule(). */
import { db, collection, addDoc, getDocs, deleteDoc, doc, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261011g';
import { SEIZOEN_FALLBACK, leeftijdVanCategorie, bouwVanCategorie, catLabel } from './config.js?v=20261011g';
import { aiAan } from './clubconfig.js?v=20261013b';
import { ico } from './icons.js?v=20260922c';
import { BIBLIOTHEEK } from './trainingsbibliotheek.js?v=20261014a';
import { maakPlan, rangschik, bouwOnderdeel, valideer, pasKnoppenToe, jaarlijn, blokVoorWeek, FASE_UITLEG, DUREN, OPBOUW, kiesDuur, SLOT_NAAM } from './trainingsplanner.js?v=20261014a';
import { vormSvg, TEKENING_LEGENDA } from './trainingsvorm-svg.js?v=20261012e';
import { positieWeek } from './seizoensplan-logica.js?v=20261014a';
import { onderdeelAan } from './onderdelen.js?v=20261013b';

const VORMEN = BIBLIOTHEEK.vormen;
const THEMAS_BESCHIKBAAR = () => new Set(VORMEN.flatMap(v => v.thema));
const vandaagIso = () => new Date().toISOString().slice(0, 10);
const NIVEAU = ['Basis', 'Midden', 'Hoog'];

/* ---------- context van het team ---------- */
function bouwKey(){
  const b = S.team?.bouw;
  return ['onder', 'midden', 'boven'].includes(b) ? b : bouwVanCategorie(S.team?.categorie);
}
function seizoenStartJaar(){
  const m = String(S.huidigSeizoen || SEIZOEN_FALLBACK).match(/(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}
/* Weeknummer in de standaard jaarlijn als er (nog) geen seizoensplan is: weken sinds de eerste maandag van september. */
function standaardWeek(){
  const d = new Date(seizoenStartJaar(), 8, 1, 12); d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  const w = Math.floor((Date.now() - d.getTime()) / (7 * 864e5)) + 1;
  return Math.max(1, Math.min(36, w));
}
function aanwezigeSpelers(){
  const n = (S.spelers || []).filter(p => p && !p.gast && !p._ingeleend).length;
  return Math.max(6, Math.min(24, n || 12));
}
function standaardDuur(lv){ return lv <= 8 ? 45 : lv <= 11 ? 60 : 75; }

function staat(){
  if (!S._tm || S._tm.teamId !== S.teamId){
    const lv = leeftijdVanCategorie(S.team?.categorie);
    S._tm = { teamId: S.teamId, n: aanwezigeSpelers(), duur: standaardDuur(lv), niv: 2, week: standaardWeek(), thema: null, themaHand: false,
      seed: 1, knop: { druk: 0, complexiteit: 0, stijl: 'punten' }, open: null, tab: {}, pas: false, ckOpen: false, plan: null, bewaardId: null, lijst: null, ai: {}, aiBezig: false };
  }
  return S._tm;
}

/* Thema en blokfase van de leerlijn voor week t.w. */
function leerlijnNu(){
  const t = staat(), lv = leeftijdVanCategorie(S.team?.categorie);
  const plan = onderdeelAan('seizoensplan') && S._spPlan && S._spPlan.teamId === S.teamId ? S._spPlan.plan : null;
  if (plan?.blokken?.length){
    const p = positieWeek(plan, Math.max(1, Math.min(plan.trainingsweken || 36, t.week)));
    return { blok: p.blok.nr, thema: p.blok.thema, fase: p.fase, weekInBlok: p.weekInBlok, weken: p.blok.weken, bron: 'seizoensplan' };
  }
  const lijn = jaarlijn({ bouw: bouwKey(), leeftijd: lv, weken: 36, beschikbaar: THEMAS_BESCHIKBAAR() });
  const p = blokVoorWeek(lijn, t.week);
  return { blok: p.blok.nr, thema: p.blok.thema, fase: p.fase, weekInBlok: p.weekInBlok, weken: p.blok.weken, bron: 'standaard' };
}
function themaOpties(){
  const lv = leeftijdVanCategorie(S.team?.categorie);
  const bes = THEMAS_BESCHIKBAAR();
  return [...new Set(VORMEN.flatMap(v => v.thema))].filter(t => bes.has(t))
    .filter(t => VORMEN.some(v => v.thema.includes(t) && lv >= v.leeftijd[0] && lv <= v.leeftijd[1]));
}

/* ---------- plan maken ---------- */
function maak(){
  const t = staat(), ll = leerlijnNu(), lv = leeftijdVanCategorie(S.team?.categorie);
  if (!t.themaHand) t.thema = ll.thema;
  if (!themaOpties().includes(t.thema)) t.thema = themaOpties()[0] || ll.thema;
  t.plan = maakPlan(VORMEN, { categorie: S.team?.categorie, leeftijd: lv, aantalSpelers: t.n, niveau: t.niv, duur: t.duur, thema: t.thema,
    blokFase: ll.fase, seed: `${S.teamId}:${t.week}:${t.seed}`, recent: [] });
  t.plan.profiel.week = t.week;
  t.bewaardId = null; t.ai = {}; t.open = null; t.tab = {};
}

/* ---------- HTML ---------- */
export function htmlTrainingsmodule(){
  const t = staat();
  if (S._tmVoorinvul){ Object.assign(t, S._tmVoorinvul); t.duur = kiesDuur(t.duur); S._tmVoorinvul = null; maak(); }
  if (!t.plan) maak();
  if (!t.lijst) laadBewaard();
  return `<div id="tmRoot" class="tm">${htmlInhoud()}</div>`;
}
function htmlInhoud(){
  return htmlFormulier() + htmlResultaat() + htmlBewaard();
}
function chip(attr, waarde, tekst, actief){ return `<button class="tm-chip${actief ? ' aan' : ''}" ${attr}="${esc(waarde)}">${esc(tekst)}</button>`; }

function htmlFormulier(){
  const t = staat(), ll = leerlijnNu();
  const themas = themaOpties();
  return `<div class="kaart tm-form">
    <div class="tm-rij"><span class="tm-l">Aanwezig</span><div class="tm-stap"><button data-tm-n="-1" aria-label="Eén minder">−</button><b>${t.n}</b><button data-tm-n="1" aria-label="Eén meer">+</button></div></div>
    <div class="tm-rij"><span class="tm-l">Duur</span><div class="tm-chips">${DUREN.map(d => chip('data-tm-duur', d, d + ' min', kiesDuur(t.duur) === d)).join('')}</div></div>
    <div class="tm-rij"><span class="tm-l">Thema</span><select id="tmThema" class="tm-select">${themas.map(x => `<option${x === t.thema ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
    <details class="tm-meer"><summary>Meer opties</summary>
      <div class="tm-rij"><span class="tm-l">Niveau van het team</span><div class="tm-chips">${NIVEAU.map((x, i) => chip('data-tm-niv', i + 1, x, t.niv === i + 1)).join('')}</div></div>
      <div class="tm-rij"><span class="tm-l">Week in seizoen</span><div class="tm-stap"><button data-tm-week="-1" aria-label="Vorige week">−</button><b>${t.week}</b><button data-tm-week="1" aria-label="Volgende week">+</button></div></div>
    </details>
    <div class="tm-info">Leerlijn${ll.bron === 'seizoensplan' ? ' (jouw seizoensplan)' : ''}: blok ${ll.blok} · <b>${esc(ll.thema)}</b> · week ${ll.weekInBlok} van ${ll.weken} · fase <b>${esc(ll.fase)}</b></div>
    <button class="knop vol fluo" data-tm-maak="1" style="margin-top:12px">Maak training</button>
  </div>`;
}

const SLOT_KLEUR = { ontvangst: '#5b6573', 'warming-up': '#4a8fe0', kern1: '#35c47a', kern2: '#f5b13d', partij: '#e2342f', afsluiting: '#8a6fe0' };
const CHECK_NAAM = { duur: 'Duur', opbouw: 'Opbouw', vormduur: 'Vormduur', warmingup: 'Warming-up', voetbalecht: 'Voetbalecht', thema: 'Thema', wachtrij: 'Geen wachtrij', ruimte: 'Ruimte', veld: 'Veld', intensiteit: 'Belasting', rust: 'Drinkpauze', groepen: 'Groepen', coach: 'Coachinfo', variatie: 'Variatie' };

function htmlResultaat(){
  const t = staat(), p = t.plan;
  if (!p) return '';
  const ov = p.overgang || OPBOUW[kiesDuur(p.profiel.duur)].overgang;
  const tussen = Math.round((ov.tussen / 3) * 10) / 10;
  const fouten = p.controle.checks.filter(c => !c.ok);
  const segs = [['ontvangst', ov.ontvangst, 'Ontvangst'], ...p.onderdelen.map(o => [o.slot, o.minuten, SLOT_NAAM[o.slot].replace(' spelvorm', '')]), ...(p.afsluiting ? [['afsluiting', p.afsluiting.minuten, 'Afsluiting']] : [])];
  let h = `<div class="kaart"><div class="tm-kopregel"><div class="tm-kop2">${esc(p.profiel.thema)}</div>
      <span class="tm-info">${esc(catLabel(S.team?.categorie))} · ${p.profiel.aantalSpelers} sp. · ${p.profiel.duur} min</span></div>
    <div class="tm-band">${segs.map(([k, m]) => `<i class="${k === 'ontvangst' ? 's' : ''}" style="flex:${m};background:${SLOT_KLEUR[k]}">${m >= 3 ? m + '′' : ''}</i>`).join('')}</div>
    <div class="tm-leg2">${segs.map(([k, m, n]) => `<span style="--c:${SLOT_KLEUR[k]}">${esc(n)} ${m}′</span>`).join('')}</div>
    <div class="tm-uitleg">${esc(FASE_UITLEG[p.profiel.blokFase] || '')}</div>
    <div class="tm-ck1">${fouten.length ? `<span class="tm-wrn">! ${fouten.length} aandachtspunt${fouten.length > 1 ? 'en' : ''}</span>` : `<b>✓</b> Alle ${p.controle.checks.length} controles gehaald`}
      <button class="tm-chip tm-mini" data-tm-ck="1">${t.ckOpen || fouten.length ? 'verberg' : 'details'}</button></div>
    ${(t.ckOpen || fouten.length) ? `<div class="tm-checks">${p.controle.checks.filter(c => c.id !== 'avg').map(c => `<span class="tm-ck ${c.ok ? 'ok' : 'fout'}" title="${esc(c.tekst)}">${esc(CHECK_NAAM[c.id] || c.id)}${c.id === 'voetbalecht' ? ' ' + p.controle.voetbalechtPct + '%' : c.id === 'thema' ? ' ' + p.controle.themaPct + '%' : ''}</span>`).join('')}</div>${fouten.map(f => `<div class="tm-info">${esc(f.tekst)}</div>`).join('')}` : ''}
  </div>`;
  p.meldingen.forEach(m => { h += `<div class="tm-melding">${esc(m)}</div>`; });
  h += `<div class="tm-pauze">Ontvangst · ${ov.ontvangst}′ — spelers verzamelen, uitleg warming-up</div>`;
  p.onderdelen.forEach((od, i) => {
    h += htmlOnderdeel(od, i);
    if (i < p.onderdelen.length - 1) h += `<div class="tm-pauze">${tussen}′ ombouwen + drinken</div>`;
  });
  if (p.afsluiting){ h += `<div class="tm-pauze">Naar de afsluiting</div>` + htmlOnderdeel(p.afsluiting, p.onderdelen.length); }
  h += `<div class="tm-acties"><button class="knop klein licht" data-tm-pas="1">⚙ Aanpassen</button><button class="knop klein licht" data-tm-bewaar="1">${t.bewaardId ? 'Bewaard ✓' : 'Bewaar bij team'}</button><button class="knop klein licht" data-tm-wa="1">${ico('action-whatsapp', 16)} WhatsApp</button></div>`;
  if (t.pas) h += `<div class="kaart tm-knoppen">
    <div class="tm-rij"><span class="tm-l">Druk</span><div class="tm-chips">${[[-1, 'Rustiger'], [0, 'Normaal'], [1, 'Hoger']].map(([v, x]) => chip('data-tm-druk', v, x, t.knop.druk === v)).join('')}</div></div>
    <div class="tm-rij"><span class="tm-l">Moeilijkheid</span><div class="tm-chips">${[[-1, 'Lichter'], [0, 'Normaal'], [1, 'Zwaarder']].map(([v, x]) => chip('data-tm-cx', v, x, t.knop.complexiteit === v)).join('')}</div></div>
    ${aiAan() ? `<div class="tm-rij"><span class="tm-l">AI-uitleg</span><button class="knop klein licht" data-tm-ai="1"${t.aiBezig ? ' disabled' : ''}>${t.aiBezig ? 'Bezig…' : (Object.keys(t.ai).length ? 'Opnieuw afstemmen' : 'Afstemmen op mijn team')}</button></div>`
      : `<div class="tm-info">AI-uitleg staat uit voor deze club; je ziet de standaardtekst uit de bibliotheek.</div>`}
  </div>`;
  h += `<div class="tm-info" style="margin:10px 2px">Na de training: kwam het thema terug in het partijspel? Een bewaarde training bevat alleen de gekozen vormen, geen namen of spelersgegevens.</div>`;
  return h;
}

const TABS = [['uitv', 'Uitvoering'], ['coach', 'Coach'], ['diff', 'Differentiatie'], ['var', 'Spelvormen']];
function htmlOnderdeel(od, i){
  const t = staat(), v = od.vorm, kn = pasKnoppenToe(od, t.knop), ai = t.ai[od.slot];
  const open = t.open === i, tab = t.tab[i] || 'uitv', m = v.materiaal || {};
  const lijst = (a, kop) => a?.length ? `<div class="tm-sub">${kop}</div><ul class="tm-ul">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const naam = od.slot === 'afsluiting' ? `Afsluiting · ${od.minuten} min` : od.slotNaam;
  const knoppen = od.slot === 'afsluiting' ? '' : `<button class="knop klein licht" data-tm-wissel="${i}">↻ Andere vorm</button>`;
  return `<div class="tm-vorm${open ? ' open' : ''}" style="--c:${SLOT_KLEUR[od.slot]}">
    <button class="tm-vk" data-tm-open-vorm="${i}" aria-expanded="${open}"><span class="tm-min">${od.minuten}′</span>
      <span class="tm-mid"><span class="tm-slot">${esc(naam)}</span><span class="tm-nm">${esc(v.naam)}</span><span class="tm-vsub">${od.groepen}×${od.groepGrootte} · ${kn.veld.b}×${kn.veld.l} m · ${esc(v.doel)}</span></span><span class="tm-pij">⌄</span></button>
    ${open ? `<div class="tm-vb">${vormSvg(v, kn.veld)}${TEKENING_LEGENDA}
      <div class="tm-feiten4"><div><b>Groepen</b>${od.groepen}×${od.groepGrootte}${od.wissel ? '+' + od.wissel : ''}</div><div><b>Veld</b>${kn.veld.b}×${kn.veld.l}</div><div><b>Tijd</b>${od.rondes ? od.rondes + '×' : ''}${od.ronde}′${od.rust ? '/' + od.rust + '′' : ''}</div><div><b>Materiaal</b>${m.pionnen || 0}p ${m.ballen || 0}b${m.doeltjes ? ' ' + m.doeltjes + 'd' : ''}</div></div>
      <div class="tm-tabs">${TABS.map(([k, x]) => `<button class="${k === tab ? 'aan' : ''}" data-tm-tab="${i}:${k}">${x}</button>`).join('')}</div>
      ${tab === 'uitv' ? `${ai?.intro ? `<div class="tm-ai"><b>Voor jouw team:</b> ${esc(ai.intro)}</div>` : ''}${v.uitleg ? `<div class="tm-sub" style="margin-top:0">Wat zeg je tegen de spelers</div><div class="tm-zeg">“${esc(v.uitleg)}”</div>` : ''}${od.themaregel ? `<div class="tm-themaregel"><b>Themaregel:</b> ${esc(od.themaregel)}</div>` : ''}${lijst(v.organisatie, 'Zo zet je het uit')}${lijst(v.regels, 'Regels')}${lijst(kn.aanpassingen, 'Aangepast door jouw knoppen')}${lijst(v.letOp, 'Let op')}` : ''}
      ${tab === 'coach' ? `${ai?.tip ? `<div class="tm-ai"><b>Tip:</b> ${esc(ai.tip)}</div>` : ''}<div class="tm-chips" style="margin-bottom:8px">${chip('data-tm-stijl', 'punten', 'Coachpunten', t.knop.stijl === 'punten')}${chip('data-tm-stijl', 'ontdekkend', 'Vragen stellen', t.knop.stijl === 'ontdekkend')}</div><ul class="tm-ul">${kn.coaching.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${tab === 'diff' ? `<div class="tm-diff"><div class="mak"><h4>Makkelijker</h4><ul class="tm-ul">${(v.makkelijker || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="moe"><h4>Moeilijker</h4><ul class="tm-ul">${(v.moeilijker || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
      ${tab === 'var' ? ((v.varianten || []).map(x => `<div class="tm-var"><b>${esc(x.naam)}</b><span>${esc(x.uitleg)}</span></div>`).join('') || '<div class="tm-info">Geen varianten.</div>') : ''}
      <div class="tm-rij" style="margin-top:12px">${knoppen}<span class="tm-info">${esc((v.domeinen || []).join(' · '))} · niveau ${v.complexiteit}/3</span></div>
    </div>` : ''}
  </div>`;
}

function htmlBewaard(){
  const t = staat();
  if (!t.lijst || !t.lijst.length) return '';
  return `<div class="kaart"><div class="tm-sub" style="margin-top:0">Bewaarde trainingen</div>
    ${t.lijst.map(x => `<div class="tm-bw"><button class="tm-bw-open" data-tm-open="${esc(x.id)}"><b>${esc(x.profiel?.thema || 'Training')}</b><span class="tm-info">week ${esc(x.profiel?.week ?? '')} · ${esc(x.profiel?.duur || '')} min · ${new Date(x.gemaaktMs || 0).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span></button><button class="tm-bw-weg" data-tm-weg="${esc(x.id)}" aria-label="Verwijder">${ico('admin-delete', 16)}</button></div>`).join('')}</div>`;
}

/* ---------- Firestore ---------- */
async function laadBewaard(){
  const t = staat(); t.lijst = [];
  try {
    const s = await getDocs(collection(db, 'teams', S.teamId, 'trainingsplannen'));
    t.lijst = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.gemaaktMs || 0) - (a.gemaaktMs || 0)).slice(0, 12);
    teken();
  } catch (e){ console.warn('[trainingsmodule] bewaarde trainingen laden mislukt', e); }
}
async function bewaar(){
  const t = staat(), p = t.plan; if (!p || t.bewaardId) return;
  try {
    const ref = await addDoc(collection(db, 'teams', S.teamId, 'trainingsplannen'), {
      profiel: { ...p.profiel }, knop: { ...t.knop }, bibliotheekVersie: BIBLIOTHEEK.versie,
      onderdelen: p.onderdelen.map(o => ({ slot: o.slot, minuten: o.minuten, vormId: o.vormId })), afsluitingId: p.afsluiting?.vormId || null,
      seizoen: S.huidigSeizoen || SEIZOEN_FALLBACK, door: S.user?.uid || null, gemaaktMs: Date.now(),
    });
    t.bewaardId = ref.id; meld('Training bewaard'); await laadBewaard();
  } catch (e){ meld('Opslaan mislukt: ' + (e.code || e.message)); }
}
function openBewaarde(id){
  const t = staat(), d = (t.lijst || []).find(x => x.id === id); if (!d) return;
  const pr = d.profiel || {};
  const duur = kiesDuur(pr.duur), N = pr.aantalSpelers || t.n;
  const nieuw = ['warming-up', 'kern1', 'kern2', 'partij'];
  const nieuweOpbouw = (d.onderdelen || []).length === 4 && nieuw.every((sl, i) => d.onderdelen[i].slot === sl);
  let plan;
  if (!nieuweOpbouw){
    /* training uit de oude opbouw (5 onderdelen, 90 min): opnieuw samengesteld met dezelfde instellingen */
    plan = maakPlan(VORMEN, { categorie: pr.categorie || S.team?.categorie, aantalSpelers: N, niveau: pr.niveau || 2, duur, thema: pr.thema, blokFase: pr.blokFase, seed: id, recent: [] });
    plan.meldingen.unshift('Deze training is gemaakt met de oude opbouw. Hij is opnieuw samengesteld met maximaal 4 vormen.');
  } else {
    const onderdelen = [];
    for (const o of d.onderdelen){
      const v = VORMEN.find(x => x.id === o.vormId);
      if (!v){ meld('Een vorm uit deze training bestaat niet meer in de bibliotheek'); continue; }
      onderdelen.push(bouwOnderdeel(v, { slot: o.slot, minuten: o.minuten }, { N, thema: pr.thema }));
    }
    const ov = { ...OPBOUW[duur].overgang };
    const av = d.afsluitingId ? VORMEN.find(x => x.id === d.afsluitingId) : null;
    const afsluiting = av ? bouwOnderdeel(av, { slot: 'afsluiting', minuten: ov.afsluiting }, { N, thema: pr.thema })
      : maakPlan(VORMEN, { categorie: pr.categorie || S.team?.categorie, aantalSpelers: N, niveau: pr.niveau || 2, duur, thema: pr.thema, blokFase: pr.blokFase, seed: id, recent: [] }).afsluiting;
    plan = { profiel: { ...pr, duur }, onderdelen, afsluiting, overgang: ov, meldingen: [], ruimteM2: leeftijdVanCategorie(pr.categorie) >= 13 ? 6000 : 3500 };
    plan.controle = valideer(plan);
  }
  Object.assign(t, { n: N, duur, niv: pr.niveau || t.niv, week: pr.week || t.week, thema: pr.thema, themaHand: true, knop: d.knop || t.knop, plan, bewaardId: id, ai: {}, open: null, tab: {} });
  plan.profiel.week = pr.week;
  teken(); window.scrollTo({ top: 0 });
}

/* ---------- delen ---------- */
function deelTekst(){
  const t = staat(), p = t.plan;
  const regels = [`*Training ${catLabel(S.team?.categorie)} — ${p.profiel.thema}*`, `${p.profiel.duur} min · ${p.profiel.aantalSpelers} spelers`, ''];
  p.onderdelen.forEach(o => { regels.push(`${o.minuten}′ ${o.vorm.naam} (${o.slotNaam.toLowerCase()})`); if (o.themaregel) regels.push(`   Themaregel: ${o.themaregel}`); });
  if (p.afsluiting) regels.push(`${p.afsluiting.minuten}′ ${p.afsluiting.vorm.naam} (afsluiting)`);
  regels.push('', '_Gemaakt met Cluppie_');
  return regels.join('\n');
}

/* ---------- AI-uitleg (optioneel) ---------- */
async function vraagAI(){
  const t = staat(), p = t.plan; if (!p || t.aiBezig) return;
  t.aiBezig = true; teken();
  try {
    const res = await httpsCallable(functions, 'personaliseerTraining')({
      clubId: S.team?.club || S.clubId,
      profiel: { categorie: catLabel(S.team?.categorie), aantalSpelers: p.profiel.aantalSpelers, niveau: p.profiel.niveau, duur: p.profiel.duur, thema: p.profiel.thema, blokFase: p.profiel.blokFase },
      stijl: t.knop.stijl,
      onderdelen: p.onderdelen.map(o => ({ slot: o.slot, minuten: o.minuten, vormId: o.vormId, naam: o.vorm.naam, doel: o.vorm.doel })),
    });
    t.ai = res?.data?.teksten || {};
    if (!Object.keys(t.ai).length) meld('Geen aanpassing ontvangen; de standaardtekst blijft staan');
  } catch (e){
    t.ai = {}; meld(e?.code === 'functions/failed-precondition' ? 'AI staat uit voor deze club' : 'AI is nu niet bereikbaar; de standaardtekst blijft staan');
  }
  t.aiBezig = false; teken();
}

/* ---------- koppelen ---------- */
function teken(){
  const root = document.getElementById('tmRoot'); if (!root) return;
  const y = window.scrollY;
  root.innerHTML = htmlInhoud();
  window.scrollTo({ top: y });
}
export function koppelTrainingsmodule(v){
  const root = v.querySelector('#tmRoot'); if (!root) return;
  const t = staat();
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.tmN){ t.n = Math.max(6, Math.min(24, t.n + Number(d.tmN))); teken(); }
    else if (d.tmDuur){ t.duur = Number(d.tmDuur); teken(); }
    else if (d.tmNiv){ t.niv = Number(d.tmNiv); teken(); }
    else if (d.tmWeek){ t.week = Math.max(1, Math.min(36, t.week + Number(d.tmWeek))); t.themaHand = false; teken(); }
    else if (d.tmMaak){ t.seed++; maak(); teken(); const r = root.querySelector('.tm-kop2'); if (r) window.scrollTo({ top: r.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); }
    else if (d.tmOpenVorm !== undefined){ const i = Number(d.tmOpenVorm); t.open = t.open === i ? null : i; teken(); }
    else if (d.tmTab){ const [i, k] = d.tmTab.split(':'); t.tab[Number(i)] = k; teken(); }
    else if (d.tmPas){ t.pas = !t.pas; teken(); }
    else if (d.tmCk){ t.ckOpen = !t.ckOpen; teken(); }
    else if (d.tmDruk !== undefined){ t.knop.druk = Number(d.tmDruk); teken(); }
    else if (d.tmCx !== undefined){ t.knop.complexiteit = Number(d.tmCx); teken(); }
    else if (d.tmStijl){ t.knop.stijl = d.tmStijl; teken(); }
    else if (d.tmWissel !== undefined){
      const i = Number(d.tmWissel), od = t.plan.onderdelen[i];
      const lst = rangschik(VORMEN, od.slot, { categorie: S.team?.categorie, aantalSpelers: t.n, niveau: t.niv, thema: t.thema, doelC: t.plan.profiel.doelComplexiteit,
        uitsluiten: t.plan.onderdelen.map(o => o.vormId), seed: t.seed });
      if (!lst[0]){ meld('Geen andere passende vorm gevonden'); return; }
      t.plan.onderdelen[i] = bouwOnderdeel(lst[0], { slot: od.slot, minuten: od.minuten }, { N: t.n, thema: t.thema });
      t.plan.controle = valideer(t.plan); t.bewaardId = null; delete t.ai[od.slot]; teken();
    }
    else if (d.tmBewaar) bewaar();
    else if (d.tmWa){ window.open('https://wa.me/?text=' + encodeURIComponent(deelTekst()), '_blank'); }
    else if (d.tmAi) vraagAI();
    else if (d.tmOpen) openBewaarde(d.tmOpen);
    else if (d.tmWeg){
      if (!confirm('Deze bewaarde training verwijderen?')) return;
      try { await deleteDoc(doc(db, 'teams', S.teamId, 'trainingsplannen', d.tmWeg)); await laadBewaard(); } catch (err){ meld('Verwijderen mislukt: ' + (err.code || err.message)); }
    }
  });
  root.addEventListener('change', e => {
    if (e.target.id === 'tmThema'){ t.thema = e.target.value; t.themaHand = true; maak(); teken(); }
  });
}
