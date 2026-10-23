/* ==================== SEIZOENSPLAN (teams/{teamId}/seizoensplan/{seizoen}) ====================
   [20261012e] Concept-jaarlijn voor een team: de trainer kiest een opbouwmodel en parameters, de
   app maakt blokken van 4–6 weken (met uitleg waarom). De eerste weken zijn uitgewerkt met
   trainingen uit de bibliotheek; de rest wordt wekelijks aangevuld. Op basis van de
   wedstrijdevaluaties stelt de app (nooit automatisch) wijzigingen voor, met de feiten erbij.

   Alle keuzes en rekenwerk staan in seizoensplan-logica.js (puur, getest). De AI is optioneel:
   functie seizoensVoorstel doet een jaarvoorstel dat hier eerst gevalideerd wordt (anders
   deterministische terugval) en kan een voorstel-uitleg verduidelijken. Zonder AI werkt alles.

   Datamodel:
     teams/{teamId}/seizoensplan/{seizoenSleutel}
       { model, params:{categorie, bouw, start, eind, vrij[], accent[], tpw, duur, niveau, bijsturen},
         blokken:[{nr, thema, domein, weken, soort:'basis'|'herhaling', verlengd?, waarom, reden?}],
         bibliotheekVersie, gemaaktMs, bijgewerktMs }
     teams/{teamId}/seizoensplan/{seizoenSleutel}/voorstellen/{id}
       { thema, soort, weekNr, feiten, uitleg, besluit:'toegepast'|'genegeerd', gemaaktMs, door }
   Beide vallen onder de bestaande /teams/{teamId}/{sub=**}-rule. Geen spelersnamen of -scores.

   Tabblad: 'seizoensplan'. Importeert NIET uit teams.js; teams.js geeft zetTeamTab mee. */
import { db, doc, collection, getDoc, getDocs, setDoc, addDoc, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261023a';
import { SEIZOEN_FALLBACK, leeftijdVanCategorie, bouwVanCategorie, catLabel, TEAM_CATEGORIEEN, teamCategorie } from './config.js?v=20261023a';
import { aiAan } from './clubconfig.js?v=20261023a';
import { zetSeizoenTrainingen } from './seizoensplan-trainingen.js?v=20261023a';
import { trainingenVanPlan } from './seizoensplan-club.js?v=20261023a';
import { onderdeelAan } from './onderdelen.js?v=20261023a';
import { BIBLIOTHEEK } from './trainingsbibliotheek.js?v=20261019f';
import { maakPlan, FASE_UITLEG, LEERCURVE, kiesDuur } from './trainingsplanner.js?v=20261023a';
import {
  MODELLEN, ACCENTEN, maakSeizoensplan, weekKalender, herreken, standaardVrij, maandagVan, beschikbareThemas, themaVolgorde,
  valideerBlokken, positieOp, positieWeek, teamSignalen, stelBijsturingVoor, pasVoorstelToe,
} from './seizoensplan-logica.js?v=20261023a';

const VORMEN = BIBLIOTHEEK.vormen;
const KLEUREN = ['var(--accent)', '#4a8fe0', '#e0a526', '#3fb27f', '#a855f7', '#f08a24', '#14b8a6', '#ec4899'];
const vandaagIso = () => new Date().toISOString().slice(0, 10);
const dk = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
const seizoenSleutel = () => String(S.huidigSeizoen || SEIZOEN_FALLBACK).replace(/[^0-9a-z]+/gi, '-').replace(/^-|-$/g, '');
const planRef = () => doc(db, 'teams', S.teamId, 'seizoensplan', seizoenSleutel());

function bouwKey(){ const b = S.team?.bouw; return ['onder', 'midden', 'boven'].includes(b) ? b : bouwVanCategorie(S.team?.categorie); }
function seizoenStartJaar(){ const m = String(S.huidigSeizoen || SEIZOEN_FALLBACK).match(/(\d{4})/); return m ? Number(m[1]) : new Date().getFullYear(); }
function aanwezigeSpelers(){ const n = (S.spelers || []).filter(p => p && !p.gast && !p._ingeleend).length; return Math.max(6, Math.min(24, n || 12)); }

function standaardForm(){
  const y = seizoenStartJaar(), lv = leeftijdVanCategorie(S.team?.categorie);
  const start = maandagVan(vandaagIso() > `${y}-08-24` ? vandaagIso() : `${y}-08-24`), eind = `${y + 1}-06-06`;
  return { model: 'leercurve', start, eind, vrij: standaardVrij(start, eind), accent: [], tpw: 2, duur: lv <= 8 ? 45 : lv <= 11 ? 60 : 75, niveau: 2, bijsturen: 'voorstel' };
}
function staat(){
  if (!S._sp || S._sp.teamId !== S.teamId){
    S._sp = { teamId: S.teamId, tab: 'opzet', plan: null, geladen: false, form: standaardForm(), log: [], aiBezig: false, besluit: {} };
  }
  return S._sp;
}
const planVan = () => staat().plan;

/* Document → plan in het geheugen (kalender afgeleid uit de parameters). */
function uitDoc(d){
  const p = d.params;
  const kal = weekKalender(p.start, p.eind, p.vrij || []);
  const blokken = (d.blokken || []).map(b => ({ ...b })); herreken(blokken, kal);
  return { teamId: S.teamId, model: d.model, params: p, kal, blokken, trainingsweken: kal.filter(w => !w.vrij).length, bibliotheekVersie: d.bibliotheekVersie };
}
function naarDoc(plan){
  return { model: plan.model, params: plan.params, blokken: plan.blokken.map(b => { const { van, tot, vanafWeek, totWeek, fasen, ...rest } = b; return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)); }),
    bibliotheekVersie: BIBLIOTHEEK.versie, bijgewerktMs: Date.now() };
}
function deelS(){ S._spPlan = planVan() ? { teamId: S.teamId, plan: planVan() } : null; }

export async function laadSeizoensplan(){
  const s = staat(); if (s.geladen) return;
  s.geladen = true;
  try {
    const snap = await getDoc(planRef());
    if (snap.exists()){ s.plan = uitDoc(snap.data()); s.form = { ...s.form, ...snap.data().params, model: snap.data().model }; s.tab = s.tab === 'opzet' ? 'jaarlijn' : s.tab; deelS(); }
    const lg = await getDocs(collection(db, 'teams', S.teamId, 'seizoensplan', seizoenSleutel(), 'voorstellen')).catch(() => ({ docs: [] }));
    s.log = lg.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e){ console.warn('[seizoensplan] laden mislukt', e); }
  teken();
}
export { laadSeizoensplan as laadSeizoensplanVoorTeam };
export function huidigPlan(){ return planVan(); }

/* ---------- HTML ---------- */
export function htmlSeizoensplan(){
  const s = staat();
  if (!s.geladen) laadSeizoensplan();
  return `<div id="spRoot" class="tm sp">${htmlInhoud()}</div>`;
}
function htmlInhoud(){
  const s = staat();
  const tabs = [['opzet', '1 Opzet'], ['jaarlijn', '2 Jaarlijn'], ['bijsturing', '3 Bijsturing']];
  return `<div class="tm-tabs">${tabs.map(([k, t]) => `<button class="${s.tab === k ? 'aan' : ''}" data-sp-tab="${k}">${t}</button>`).join('')}</div>
    ${s.tab === 'opzet' ? htmlOpzet() : s.tab === 'jaarlijn' ? htmlJaarlijn() : htmlBijsturing()}`;
}
const chip = (attr, w, t, aan) => `<button class="tm-chip${aan ? ' aan' : ''}" ${attr}="${esc(w)}">${esc(t)}</button>`;

function htmlOpzet(){
  const s = staat(), f = s.form;
  const lv = leeftijdVanCategorie(S.team?.categorie);
  const kal = weekKalender(f.start, f.eind, f.vrij || []);
  return `<div class="kaart"><div class="tm-sub" style="margin-top:0">Kies je opbouw</div>
      ${Object.entries(MODELLEN).map(([k, m]) => `<button class="tm-model${k === f.model ? ' aan' : ''}" data-sp-model="${k}"><b>${esc(m.naam)}</b><span>${esc(m.tekst)}</span>${m.opm ? `<em>${esc(m.opm)}</em>` : ''}</button>`).join('')}
    </div>
    <div class="kaart">
      <div class="tm-rij"><span class="tm-l">Team</span><b>${esc(S.team?.naam || '')} · ${esc(catLabel(S.team?.categorie))}</b></div>
      <div class="tm-rij"><span class="tm-l">Start</span><input type="date" class="tm-select" id="spStart" value="${esc(f.start)}"></div>
      <div class="tm-rij"><span class="tm-l">Einde</span><input type="date" class="tm-select" id="spEind" value="${esc(f.eind)}"></div>
      <div class="tm-rij"><span class="tm-l">Trainingen per week</span><div class="tm-stap"><button data-sp-tpw="-1" aria-label="Minder">−</button><b>${f.tpw}</b><button data-sp-tpw="1" aria-label="Meer">+</button></div></div>
      <div class="tm-rij"><span class="tm-l">Duur</span><div class="tm-chips">${[45, 60, 75].map(d => chip('data-sp-duur', d, d + '′', kiesDuur(f.duur) === d)).join('')}</div></div>
      <div class="tm-rij"><span class="tm-l">Niveau van het team</span><div class="tm-chips">${['Basis', 'Midden', 'Hoog'].map((x, i) => chip('data-sp-niv', i + 1, x, f.niveau === i + 1)).join('')}</div></div>
      <div class="tm-rij" style="align-items:flex-start"><span class="tm-l">Vrije weken</span>
        <div class="tm-chips">${(f.vrij || []).map(m => `<button class="tm-chip aan" data-sp-vrijweg="${esc(m)}" title="Weer meetellen">wk ${dk(m)} ✕</button>`).join('') || '<span class="tm-info">geen</span>'}</div></div>
      <div class="tm-rij"><span class="tm-l">Week toevoegen</span><input type="date" class="tm-select" id="spVrijNieuw" aria-label="Vrije week toevoegen"></div>
      <div class="tm-rij" style="align-items:flex-start"><span class="tm-l">Accent (max 2)</span><div class="tm-chips">${Object.keys(ACCENTEN).map(a => chip('data-sp-acc', a, a, (f.accent || []).includes(a))).join('')}</div></div>
      <div class="tm-rij"><span class="tm-l">Bijsturen op evaluaties</span><div class="tm-chips">${[['voorstel', 'Voorstel doen'], ['uit', 'Uit']].map(([v, t]) => chip('data-sp-bijst', v, t, f.bijsturen === v)).join('')}</div></div>
      <div class="tm-info">${kal.filter(w => !w.vrij).length} trainingsweken. Dit zijn voorgestelde waarden; pas aan wat niet klopt.</div>
      <button class="knop vol fluo" data-sp-maak="1" style="margin-top:12px">${s.plan ? 'Maak opnieuw (vervangt de huidige jaarlijn)' : 'Maak concept-jaarlijn'}</button>
      ${aiAan() ? `<button class="knop vol licht" data-sp-maak-ai="1" style="margin-top:8px"${s.aiBezig ? ' disabled' : ''}>${s.aiBezig ? 'Bezig…' : 'Laat AI een jaarvoorstel doen'}</button>
        <div class="tm-info" style="margin-top:6px">De AI stelt voor; de app controleert het (4–6 weken per blok, alleen thema's die bij ${esc(catLabel(S.team?.categorie))} horen) en valt anders terug op de standaardopbouw.</div>` : ''}
    </div>`;
}

function weekHtml(plan, weekNr, blok, alle){
  const pos = positieWeek(plan, weekNr);
  const w = plan.kal.filter(x => !x.vrij)[weekNr - 1];
  /* zelfde trainingen als op Trainingen komen (trainingenVanPlan), dus geen eigen rotatie of seed hier */
  const trainingen = alle.filter(x => x.w.nr === weekNr).map(x => `<div class="tm-sub">Training ${x.t}</div><ul class="tm-ul">${x.p.onderdelen.map(o => `<li>${o.minuten}′ ${esc(o.vorm.naam)}</li>`).join('')}</ul>
      <button class="knop klein licht" data-sp-open="${weekNr}:${x.t}">Open in Training maken</button>`);
  return `<div class="tm-week"><div class="tm-wk-kop"><b>Week ${weekNr}</b><span class="tm-info">${dk(w?.iso)} · ${esc(pos.fase)}</span></div>${trainingen.join('')}<div class="tm-info" style="margin-top:6px">${esc(FASE_UITLEG[pos.fase] || '')}</div></div>`;
}

function huidigeWeekNr(plan){
  const p = positieOp(plan, vandaagIso());
  if (p) return p.weekNr;
  return vandaagIso() < plan.params.start ? 1 : plan.trainingsweken;
}

function htmlJaarlijn(){
  const s = staat(), plan = s.plan;
  if (!plan) return `<div class="kaart"><div class="tm-info">Er is nog geen seizoensplan. Maak er eerst een onder “1 Opzet”.</div><button class="knop klein licht" data-sp-tab="opzet" style="margin-top:8px">Naar opzet</button></div>`;
  const nu = huidigeWeekNr(plan), vanaf = nu, tot = Math.min(plan.trainingsweken, nu + 3);
  const alle = onderdeelAan('trainingsmodule') ? trainingenVanPlan({ plan, team: { id: S.teamId, categorie: S.team?.categorie }, vormen: VORMEN, planId: `team_${S.teamId}_${seizoenSleutel()}`, aantalSpelers: aanwezigeSpelers() }) : [];
  let h = `<div class="kaart"><div class="tm-kop2">Seizoensplan ${esc(catLabel(S.team?.categorie))}</div>
    <div class="tm-info">${esc(MODELLEN[plan.model]?.naam || '')} · ${plan.trainingsweken} trainingsweken · ${plan.blokken.length} blokken · ${plan.params.tpw}× per week${plan.params.accent?.length ? ' · accent ' + esc(plan.params.accent.join(', ')) : ''}</div>
    <div class="tm-band">${plan.blokken.map((b, i) => `<i style="flex:${b.weken};background:${KLEUREN[i % KLEUREN.length]}" title="${esc(b.thema)}"></i>`).join('')}</div>
    <div class="tm-info">Nu: week ${nu}. De komende vier weken zijn uitgewerkt; elke week komt de volgende erbij.</div></div>`;
  plan.blokken.forEach((b, i) => {
    h += `<div class="tm-blok" style="--c:${KLEUREN[i % KLEUREN.length]}"><h3>${esc(b.thema)} <span class="tm-badge">${esc(b.domein || '')}</span> <span class="tm-badge">${b.weken} wk · ${dk(b.van)} – ${dk(b.tot)}</span>${b.soort === 'herhaling' ? ' <span class="tm-badge">herhaling</span>' : ''}</h3>
      <div class="tm-info">${esc(b.fasen.join(' → '))}</div><div class="tm-waarom"><b>Waarom:</b> ${esc(b.waarom || '')}</div>`;
    for (let w = b.vanafWeek; w <= b.totWeek; w++) if (w >= vanaf && w <= tot) h += weekHtml(plan, w, b, alle);
    if (b.totWeek > tot && b.vanafWeek <= tot + 1 && b.totWeek > nu) h += `<div class="tm-info">Week ${Math.max(tot + 1, b.vanafWeek)}–${b.totWeek}: worden wekelijks aangevuld.</div>`;
    h += '</div>';
  });
  return h;
}

/* ---------- bijsturing ---------- */
function catThemaMap(evals){
  const m = {};
  TEAM_CATEGORIEEN.forEach(c => { if (c.leercurve) m[c.id] = c.leercurve; });
  for (const e of evals) for (const id of Object.keys(e.scores || {})){ const c = teamCategorie(id); if (c?.leercurve) m[id] = c.leercurve; }
  return m;
}
function voorstellen(){
  const s = staat(), plan = s.plan; if (!plan) return null;
  const evals = (S.teamEvaluaties || []).filter(e => e.wedstrijdId || e.scores);
  const weekNr = huidigeWeekNr(plan);
  const signalen = teamSignalen(evals, { start: plan.params.start, catThema: catThemaMap(evals) });
  const besloten = s.log.filter(x => x.besluit).map(x => ({ thema: x.thema, soort: x.soort, weekNr: x.weekNr }));
  return { weekNr, signalen, ...stelBijsturingVoor({ plan, weekNr, signalen, besloten }) };
}
function htmlBijsturing(){
  const s = staat(), plan = s.plan;
  if (!plan) return `<div class="kaart"><div class="tm-info">Maak eerst een seizoensplan.</div></div>`;
  if (plan.params.bijsturen === 'uit') return `<div class="kaart"><div class="tm-info">Bijsturen staat uit. De jaarlijn blijft zoals gepland. Je kunt dit aanzetten onder “1 Opzet”.</div></div>`;
  const r = voorstellen(), pos = positieWeek(plan, r.weekNr);
  let h = `<div class="kaart"><div class="tm-info">Nu in blok ${pos.blok.nr}: <b>${esc(pos.blok.thema)}</b>, week ${pos.weekInBlok}. Gebaseerd op ${r.signalen.metingen} wedstrijdevaluatie${r.signalen.metingen === 1 ? '' : 's'} van dit seizoen.</div></div>`;
  if (r.opm) h += `<div class="tm-melding">${esc(r.opm)} Er verandert niets aan je jaarlijn.</div>`;
  r.voorstellen.forEach(v => {
    const b = s.besluit[v.id];
    h += `<div class="kaart tm-voorstel"><div class="tm-sub" style="margin-top:0">Wijzigingsvoorstel</div><h3 class="tm-kop2">${esc(v.titel)}</h3>
      <div class="tm-waarom"><b>Waarom:</b> ${esc(s.besluit[v.id + ':uitleg'] || v.uitleg)}${s.besluit[v.id + ':uitleg'] ? ' <span class="tm-aitag">AI</span>' : ''}</div>
      <div class="tm-sub">De feiten erachter</div>
      <div class="tm-feit"><span>${v.feiten.bron === 'categorie' ? 'Gemiddelde score laatste ' + v.feiten.metingen + ' wedstrijden' : 'Thema niet teruggekomen'}</span><b>${v.feiten.bron === 'categorie' ? String(v.feiten.gemiddelde).replace('.', ',') + ' / ' + v.feiten.schaal : v.feiten.nee + ' van ' + v.feiten.metingen}</b></div>
      ${v.feiten.bron === 'categorie' ? `<div class="tm-feit"><span>Wedstrijden met een lage score</span><b>${v.feiten.laag} van ${v.feiten.metingen}</b></div>` : ''}
      <div class="tm-info" style="margin-top:6px">Gevolg: ${esc(v.gevolg)}</div>
      <div class="tm-rij" style="margin-top:10px">${b ? `<span class="tm-info">${b === 'ja' ? '✓ Toegepast' : 'Genegeerd — blijft gelogd'}</span>`
        : `${v.toepasbaar ? `<button class="knop klein fluo" data-sp-besluit="ja" data-id="${esc(v.id)}">Toepassen</button>` : ''}<button class="knop klein licht" data-sp-besluit="nee" data-id="${esc(v.id)}">Negeren</button>${aiAan() ? `<button class="knop klein licht" data-sp-uitleg="${esc(v.id)}">Verduidelijk (AI)</button>` : ''}`}</div></div>`;
  });
  if (r.uitgesteld.length) h += `<div class="tm-info" style="margin:0 0 10px">Ook laag: ${r.uitgesteld.map(esc).join(', ')}. Dat bekijken we volgende week; er verandert maximaal één ding per week.</div>`;
  if (!r.voorstellen.length && !r.opm) h += `<div class="kaart"><div class="tm-info">Geen aanleiding om te wijzigen: de evaluaties wijzen niet op een thema dat extra aandacht vraagt.</div></div>`;
  h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">Wat telt mee, en wat niet</div><ul class="tm-ul tm-info"><li>Alleen teamgemiddelden uit de wedstrijdevaluaties; geen namen, geen uitslagen.</li><li>Pas vanaf 3 metingen, maximaal één wijziging per week, nooit automatisch.</li><li>De wedstrijdevaluatie meet nu alleen opbouw en druk zetten rechtstreeks per thema. Beantwoord daarom bij een evaluatie ook “kwam het thema terug?”: dan kan de app voor elk thema bijsturen.</li></ul></div>`;
  if (s.log.length) h += `<div class="kaart"><div class="tm-sub" style="margin-top:0">Eerdere voorstellen</div>${s.log.sort((a, b) => (b.gemaaktMs || 0) - (a.gemaaktMs || 0)).slice(0, 8).map(x => `<div class="tm-feit"><span>${esc(x.thema)} · week ${esc(x.weekNr)} · ${x.soort === 'verleng' ? 'verlengd' : 'herhaalblok'}</span><b>${x.besluit === 'toegepast' ? 'toegepast' : 'genegeerd'}</b></div>`).join('')}</div>`;
  return h;
}

/* ---------- opslaan en genereren ---------- */
function maakVanForm(blokkenUitAI){
  const s = staat(), f = s.form;
  const lv = leeftijdVanCategorie(S.team?.categorie), bes = beschikbareThemas(VORMEN);
  const p = { categorie: S.team?.categorie, leeftijd: lv, bouw: bouwKey(), model: f.model, start: f.start, eind: f.eind, vrij: f.vrij || [], accent: f.accent || [], tpw: f.tpw, duur: f.duur, niveau: f.niveau, beschikbaar: bes };
  const det = maakSeizoensplan(p);
  const params = { categorie: p.categorie, bouw: p.bouw, start: f.start, eind: f.eind, vrij: p.vrij, accent: p.accent, tpw: f.tpw, duur: f.duur, niveau: f.niveau, bijsturen: f.bijsturen };
  let blokken = det.blokken;
  if (blokkenUitAI){
    blokken = blokkenUitAI.map(b => ({ thema: b.thema, domein: LEERCURVE.find(t => t.thema === b.thema)?.domein, weken: b.weken, soort: 'basis', waarom: String(b.waarom || '').slice(0, 400) }));
    herreken(blokken, det.kal);
    blokken.forEach(b => { if (!b.waarom) b.waarom = `Voorgesteld door de AI binnen model “${MODELLEN[f.model].naam}” en gecontroleerd door de app.`; });
  }
  return { teamId: S.teamId, model: f.model, params, kal: det.kal, blokken, trainingsweken: det.trainingsweken, bibliotheekVersie: BIBLIOTHEEK.versie };
}
async function bewaarPlan(plan){
  const s = staat();
  try {
    const d = naarDoc(plan);
    await setDoc(planRef(), { ...d, ...(s.plan ? {} : { gemaaktMs: Date.now() }) }, { merge: true });
    s.plan = plan; deelS();
  } catch (e){ meld('Opslaan mislukt: ' + (e.code || e.message)); return false; }
  /* de seizoenstrainingen naar het tabblad Trainingen; een mislukking hier houdt het plan wel bewaard */
  try {
    const r = await zetSeizoenTrainingen({ plan, team: { id: S.teamId, categorie: S.team?.categorie }, clubId: S.team?.club || S.clubId,
      planId: `team_${S.teamId}_${seizoenSleutel()}`, planVersie: 1, vormen: VORMEN, aantalSpelers: aanwezigeSpelers() });
    if (r.meldingen?.length) console.warn('[seizoensplan] trainingen:', r.meldingen.slice(0, 5));
  } catch (e){ meld('Plan bewaard, maar de trainingen zijn niet op Trainingen gezet: ' + (e.code || e.message)); return false; }
  return true;
}
async function maakConcept(metAI){
  const s = staat();
  if (s.plan && !confirm('Het bestaande seizoensplan vervangen? Eerdere bijsturingen vervallen.')) return;
  let blokkenAI = null;
  if (metAI){
    s.aiBezig = true; teken();
    try {
      const f = s.form, lv = leeftijdVanCategorie(S.team?.categorie), bes = beschikbareThemas(VORMEN);
      const kal = weekKalender(f.start, f.eind, f.vrij || []), weken = kal.filter(w => !w.vrij).length;
      const toegestaan = themaVolgorde({ model: f.model, bouw: bouwKey(), leeftijd: lv, accent: f.accent || [], beschikbaar: bes });
      const alle = new Set(LEERCURVE_THEMAS(lv, bes));
      const res = await httpsCallable(functions, 'seizoensVoorstel')({ clubId: S.team?.club || S.clubId, modus: 'jaarplan', categorie: catLabel(S.team?.categorie), bouw: bouwKey(), model: MODELLEN[f.model].naam,
        accent: f.accent || [], weken, toegestaneThemas: [...alle], voorkeursvolgorde: toegestaan, niveau: f.niveau });
      const bl = res?.data?.blokken;
      const ok = valideerBlokken(bl, { weken, toegestaan: alle });
      if (ok.ok) blokkenAI = bl; else meld('Het AI-voorstel voldeed niet aan de controles; de standaardopbouw is gebruikt');
    } catch (e){ meld('AI is nu niet bereikbaar; de standaardopbouw is gebruikt'); }
    s.aiBezig = false;
  }
  const plan = maakVanForm(blokkenAI);
  if (await bewaarPlan(plan)){ s.tab = 'jaarlijn'; s.log = []; s.besluit = {}; meld('Seizoensplan gemaakt'); }
  teken();
}
function LEERCURVE_THEMAS(lv, bes){
  return [...bes].filter(t => VORMEN.some(v => v.thema.includes(t) && lv >= v.leeftijd[0] && lv <= v.leeftijd[1]));
}
async function beslis(id, besluit){
  const s = staat(), r = voorstellen(); const v = r?.voorstellen.find(x => x.id === id); if (!v) return;
  if (besluit === 'ja'){
    const nieuw = pasVoorstelToe(s.plan, v);
    if (!nieuw){ meld('Dit voorstel kan niet worden toegepast zonder blokken te kort te maken'); return; }
    if (!await bewaarPlan(nieuw)) return;
  }
  const rij = { thema: v.thema, soort: v.soort, weekNr: v.weekNr, feiten: v.feiten, uitleg: v.uitleg, besluit: besluit === 'ja' ? 'toegepast' : 'genegeerd', gemaaktMs: Date.now(), door: S.user?.uid || null };
  try { const ref = await addDoc(collection(db, 'teams', S.teamId, 'seizoensplan', seizoenSleutel(), 'voorstellen'), rij); s.log.push({ id: ref.id, ...rij }); } catch (e){ console.warn('[seizoensplan] log mislukt', e); }
  s.besluit[id] = besluit; meld(besluit === 'ja' ? 'Seizoensplan aangepast' : 'Voorstel genegeerd'); teken();
}
async function verduidelijk(id){
  const s = staat(), r = voorstellen(); const v = r?.voorstellen.find(x => x.id === id); if (!v) return;
  try {
    const res = await httpsCallable(functions, 'seizoensVoorstel')({ clubId: S.team?.club || S.clubId, modus: 'uitleg', categorie: catLabel(S.team?.categorie),
      voorstel: { titel: v.titel, thema: v.thema, soort: v.soort, feiten: v.feiten, gevolg: v.gevolg } });
    if (res?.data?.uitleg) s.besluit[id + ':uitleg'] = res.data.uitleg; else meld('Geen verduidelijking ontvangen');
  } catch (e){ meld('AI is nu niet bereikbaar'); }
  teken();
}

/* ---------- koppelen ---------- */
function teken(){
  const root = document.getElementById('spRoot'); if (!root) return;
  const y = window.scrollY; root.innerHTML = htmlInhoud(); window.scrollTo({ top: y });
}
export function koppelSeizoensplan(v, { zetTeamTab }){
  const root = v.querySelector('#spRoot'); if (!root) return;
  const s = staat(), f = () => s.form;
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.spTab){ s.tab = d.spTab; teken(); }
    else if (d.spModel){ f().model = d.spModel; teken(); }
    else if (d.spTpw){ f().tpw = Math.max(1, Math.min(3, f().tpw + Number(d.spTpw))); teken(); }
    else if (d.spDuur){ f().duur = Number(d.spDuur); teken(); }
    else if (d.spNiv){ f().niveau = Number(d.spNiv); teken(); }
    else if (d.spVrijweg){ f().vrij = (f().vrij || []).filter(m => m !== d.spVrijweg); teken(); }
    else if (d.spAcc){ const a = new Set(f().accent || []); if (a.has(d.spAcc)) a.delete(d.spAcc); else if (a.size < 2) a.add(d.spAcc); f().accent = [...a]; teken(); }
    else if (d.spBijst){ f().bijsturen = d.spBijst; if (s.plan){ s.plan.params.bijsturen = d.spBijst; bewaarPlan(s.plan); } teken(); }
    else if (d.spMaak) maakConcept(false);
    else if (d.spMaakAi) maakConcept(true);
    else if (d.spBesluit) beslis(d.id, d.spBesluit);
    else if (d.spUitleg) verduidelijk(d.spUitleg);
    else if (d.spOpen){
      const [wk, t] = d.spOpen.split(':').map(Number), pos = positieWeek(s.plan, wk);
      S._tmVoorinvul = { week: wk, thema: pos.blok.thema, themaHand: true, duur: s.plan.params.duur, niv: s.plan.params.niveau, seed: t, n: aanwezigeSpelers() };
      zetTeamTab('trainingsmodule');
    }
  });
  root.addEventListener('change', e => {
    const bijwerken = () => { const m = (f().vrij || []).filter(x => x >= maandagVan(f().start) && x <= f().eind); f().vrij = m.length ? m : standaardVrij(f().start, f().eind); teken(); };
    if (e.target.id === 'spStart'){ f().start = maandagVan(e.target.value || f().start); bijwerken(); }
    else if (e.target.id === 'spEind'){ f().eind = e.target.value || f().eind; bijwerken(); }
    else if (e.target.id === 'spVrijNieuw' && e.target.value){ const m = maandagVan(e.target.value); f().vrij = [...new Set([...(f().vrij || []), m])].sort(); teken(); }
  });
}
