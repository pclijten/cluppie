/* ==================== SEIZOENSPLAN JEUGD — CLUBSCHERM [20261017a] ====================
   Clubbreed seizoensplan voor de jeugd: de hoofd jeugdopleiding (of de clubadmin) maakt het plan,
   een bouwcoördinator maakt het voor zijn eigen bouw. Toewijzen zet de trainingen van het hele
   seizoen op het tabblad Oefenstof van elk team (zie seizoensplan-club.js).

   Datamodel:
     clubs/{id}.hoofdJeugd {uid:true}, hoofdJeugdInfo {uid:{naam}}, instellingen.jeugdRolNaam
     clubs/{id}/seizoensplannen/{planId}   { naam, bouw, model, params, bibliotheekVersie, planVersie, door, gemaaktMs, bijgewerktMs }
     clubs/{id}/seizoensplannen/{planId}/toewijzingen/{teamId}  { planVersie, aantal, overgeslagen, status, door, toegewezenMs }
     trainingen/{id}  — gegenereerd door toewijzen (bron 'seizoensplan', seizoensplanId, teams:[teamId])
   Alle writes merge:true. Rechten zelf staan in de rules; dit scherm toont alleen wat mag. */
import { S, esc, meld } from './state.js?v=20261011g';
import { db, doc, collection, getDocs, setDoc, updateDoc, deleteField, query, where, writeBatch, serverTimestamp } from './firebase.js?v=20261011g';
import { bouwNaam, catLabel, SEIZOEN_FALLBACK } from './config.js?v=20261011g';
import { BIBLIOTHEEK } from './trainingsbibliotheek.js?v=20261019h';
import { MODELLEN, ACCENTEN, beschikbareThemas, maandagVan, standaardVrij, weekKalender } from './seizoensplan-logica.js?v=20261019h';
import { rechtenVoor, magVoorBouw, teamsVoorPlan, planVoorTeam, trainingDocs, bezetteWeken, JEUGDBOUWEN } from './seizoensplan-club.js?v=20261019h';

const VORMEN = BIBLIOTHEEK.vormen;
const vandaagIso = () => new Date().toISOString().slice(0, 10);
const dk = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
const chip = (attr, w, t, aan) => `<button class="tm-chip${aan ? ' aan' : ''}" ${attr}="${esc(String(w))}">${esc(t)}</button>`;
const uidNu = () => S.user?.uid || '';
const isAdmin = () => !!S.club?.admins?.[uidNu()];

function C(){
  if (!S._cjp) S._cjp = { plannen: null, toew: {}, teams: [], sel: null, nieuw: false, bewerk: null, form: null, laadt: false, bezig: false, opnieuw: null };
  return S._cjp;
}
function formStandaard(){
  const y = Number((String(S.huidigSeizoen || SEIZOEN_FALLBACK).match(/(\d{4})/) || [0, new Date().getFullYear()])[1]);
  const start = maandagVan(vandaagIso() > `${y}-08-24` ? vandaagIso() : `${y}-08-24`), eind = `${y + 1}-06-06`;
  return { naam: `Seizoensplan ${S.huidigSeizoen || SEIZOEN_FALLBACK}`, bouw: isAdmin() ? 'club' : (rechtenVoor(S.club, uidNu()).bouwen[0] || 'onder'),
    model: 'leercurve', start, eind, vrij: standaardVrij(start, eind), accent: [], tpw: 2, duur: 60, niveau: 2 };
}
function formVan(plan){
  const p = plan.params || {};
  return { naam: plan.naam, bouw: plan.bouw, model: plan.model, start: p.start, eind: p.eind, vrij: p.vrij || [], accent: p.accent || [], tpw: p.tpw || 2, duur: p.duur || 60, niveau: p.niveau || 2 };
}

/* ---------- laden ---------- */
async function laadPlannen(){
  const c = C(); if (c.laadt) return; c.laadt = true;
  try {
    const snap = await getDocs(collection(db, 'clubs', S.clubId, 'seizoensplannen'));
    c.plannen = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.gemaaktMs || 0) - (a.gemaaktMs || 0));
  } catch (e){ c.plannen = []; meld('Seizoensplannen laden mislukt: ' + (e.code || e.message)); }
  c.laadt = false; c.opnieuw?.();
}
async function laadToewijzingen(planId){
  const c = C();
  try {
    const snap = await getDocs(collection(db, 'clubs', S.clubId, 'seizoensplannen', planId, 'toewijzingen'));
    c.toew[planId] = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
  } catch (e){ c.toew[planId] = {}; meld('Toewijzingen laden mislukt: ' + (e.code || e.message)); }
  c.opnieuw?.();
}

/* ---------- HTML ---------- */
export function htmlClubJeugdplan(teams){
  const c = C(); c.teams = teams || [];
  const rechten = rechtenVoor(S.club, uidNu());
  if (!rechten.magPlan) return `<div class="kaart"><div class="tm-info">Alleen de clubadmin, de hoofd jeugdopleiding en de bouwcoördinatoren kunnen het seizoensplan voor de jeugd beheren.</div></div>`;
  if (c.plannen === null){ laadPlannen(); return `<div class="kaart"><div class="tm-info">Laden…</div></div>`; }
  return `<div id="cjpRoot" class="tm sp">${rolBlok(teams)}${c.nieuw || c.bewerk ? htmlForm(rechten) : c.sel ? htmlDetail(rechten) : htmlLijst(rechten)}</div>`;
}

function rolBlok(teams){
  const rolNaam = S.club?.instellingen?.jeugdRolNaam || 'Hoofd jeugdopleiding';
  const hj = S.club?.hoofdJeugd || {};
  const info = S.club?.hoofdJeugdInfo || {};
  if (!isAdmin()){
    const namen = Object.keys(hj).map(u => info[u]?.naam || 'onbekend').join(', ');
    return `<div class="kaart"><div class="tm-rij"><span class="tm-l">${esc(rolNaam)}</span><b>${esc(namen || 'nog niet aangewezen')}</b></div></div>`;
  }
  const kandidaten = new Map();
  for (const t of C().teams) for (const [u, i] of Object.entries(t.ledenInfo || {})) if (!kandidaten.has(u)) kandidaten.set(u, i?.naam || 'coach');
  return `<div class="kaart">
    <div class="tm-sub" style="margin-top:0">Rol: ${esc(rolNaam)}</div>
    <div class="tm-info">Deze coach maakt het seizoensplan voor de jeugd en wijst het toe aan alle bouwen. Tik een coach aan om de rol te geven of in te trekken.</div>
    <div class="tm-chips" style="margin:8px 0">${[...kandidaten].map(([u, n]) => chip('data-cjp-hj', u, n, !!hj[u])).join('') || '<span class="tm-info">Nog geen coaches bij de teams.</span>'}</div>
    <div class="tm-rij"><span class="tm-l">Naam van de rol</span><input class="tm-select" id="cjpRolNaam" maxlength="40" value="${esc(rolNaam)}" aria-label="Naam van de rol"></div>
    <button class="knop klein licht" data-cjp="rolnaam" style="margin-top:6px">Naam opslaan</button>
  </div>`;
}

function htmlLijst(rechten){
  const c = C();
  const zichtbaar = c.plannen;
  return `<div class="kaart"><div class="tm-rij"><span class="tm-sub" style="margin:0">Seizoensplannen</span>
      ${rechten.magPlan ? `<button class="knop klein fluo" data-cjp="nieuw">+ Nieuw plan</button>` : ''}</div></div>
    ${zichtbaar.length ? zichtbaar.map(p => {
      const n = weekKalender(p.params.start, p.params.eind, p.params.vrij || []).filter(w => !w.vrij).length;
      return `<button class="kaart cjp-plan" data-cjp-open="${esc(p.id)}" style="text-align:left;width:100%"><b>${esc(p.naam)}</b><div class="tm-info">${esc(p.bouw === 'club' ? 'Hele club' : bouwNaam(p.bouw))} · ${esc(MODELLEN[p.model]?.naam || '')} · ${n} trainingsweken · plan v${p.planVersie || 1}</div></button>`;
    }).join('') : `<div class="kaart"><div class="tm-info">Nog geen seizoensplan. Maak er een met “+ Nieuw plan”.</div></div>`}`;
}

function htmlForm(rechten){
  const c = C(), f = c.form || (c.form = c.bewerk ? formVan(c.plannen.find(p => p.id === c.bewerk)) : formStandaard());
  const bouwen = [...(rechten.alles ? [['club', 'Hele club']] : []), ...JEUGDBOUWEN.filter(b => magVoorBouw(rechten, b)).map(b => [b, bouwNaam(b)])];
  const kal = weekKalender(f.start, f.eind, f.vrij || []);
  return `<div class="kaart"><div class="tm-sub" style="margin-top:0">${c.bewerk ? 'Plan wijzigen' : 'Nieuw seizoensplan'}</div>
    <div class="tm-rij"><span class="tm-l">Naam</span><input class="tm-select" id="cjpNaam" maxlength="60" value="${esc(f.naam)}"></div>
    <div class="tm-rij" style="align-items:flex-start"><span class="tm-l">Voor</span><div class="tm-chips">${bouwen.map(([w, t]) => chip('data-cjp-bouw', w, t, f.bouw === w)).join('')}</div></div>
    <div class="tm-sub">Kies je opbouw</div>
    ${Object.entries(MODELLEN).map(([k, m]) => `<button class="tm-model${k === f.model ? ' aan' : ''}" data-cjp-model="${k}"><b>${esc(m.naam)}</b><span>${esc(m.tekst)}</span></button>`).join('')}
    <div class="tm-rij"><span class="tm-l">Start</span><input type="date" class="tm-select" id="cjpStart" value="${esc(f.start)}"></div>
    <div class="tm-rij"><span class="tm-l">Einde</span><input type="date" class="tm-select" id="cjpEind" value="${esc(f.eind)}"></div>
    <div class="tm-rij"><span class="tm-l">Trainingen per week</span><div class="tm-stap"><button data-cjp-tpw="-1" aria-label="Minder">−</button><b>${f.tpw}</b><button data-cjp-tpw="1" aria-label="Meer">+</button></div></div>
    <div class="tm-rij"><span class="tm-l">Duur</span><div class="tm-chips">${[45, 60, 75].map(d => chip('data-cjp-duur', d, d + '′', f.duur === d)).join('')}</div></div>
    <div class="tm-rij"><span class="tm-l">Niveau</span><div class="tm-chips">${['Basis', 'Midden', 'Hoog'].map((x, i) => chip('data-cjp-niv', i + 1, x, f.niveau === i + 1)).join('')}</div></div>
    <div class="tm-rij" style="align-items:flex-start"><span class="tm-l">Vrije weken</span><div class="tm-chips">${(f.vrij || []).map(m => `<button class="tm-chip aan" data-cjp-vrijweg="${esc(m)}" title="Weer meetellen">wk ${dk(m)} ✕</button>`).join('') || '<span class="tm-info">geen</span>'}</div></div>
    <div class="tm-rij"><span class="tm-l">Week vrij maken</span><input type="date" class="tm-select" id="cjpVrijNieuw" aria-label="Vrije week toevoegen"></div>
    <div class="tm-rij" style="align-items:flex-start"><span class="tm-l">Accent (max 2)</span><div class="tm-chips">${Object.keys(ACCENTEN).map(a => chip('data-cjp-acc', a, a, (f.accent || []).includes(a))).join('')}</div></div>
    <div class="tm-info">${kal.filter(w => !w.vrij).length} trainingsweken. Per team wordt de volgorde van de thema's berekend op de leeftijd van dat team.</div>
    <button class="knop vol fluo" data-cjp="bewaar" style="margin-top:12px"${c.bezig ? ' disabled' : ''}>${c.bewerk ? 'Wijzigingen opslaan' : 'Plan opslaan'}</button>
    <button class="knop vol licht" data-cjp="annuleer" style="margin-top:8px">Annuleren</button>
  </div>`;
}

function htmlDetail(rechten){
  const c = C(), p = c.plannen.find(x => x.id === c.sel);
  if (!p){ c.sel = null; return htmlLijst(rechten); }
  if (c.toew[p.id] === undefined){ c.toew[p.id] = null; laadToewijzingen(p.id); }
  if (c.toew[p.id] === null) return `<div class="kaart"><div class="tm-info">Toewijzingen laden…</div></div>`;
  const scope = teamsVoorPlan(p, c.teams);
  const toew = c.toew[p.id];
  const mag = magVoorBouw(rechten, p.bouw);
  const voorbeeld = scope[0] ? planVoorTeam(p, scope[0], beschikbareThemas(VORMEN)) : null;
  const band = voorbeeld ? voorbeeld.blokken.map((b, i) => `<i style="flex:${b.weken};background:var(--c${i % 6})" title="${esc(b.thema)}"></i>`).join('') : '';
  return `<div class="kaart">
      <div class="tm-rij"><button class="knop klein licht" data-cjp="terug">← Plannen</button>${mag ? `<button class="knop klein licht" data-cjp="bewerk">Wijzig plan</button>` : ''}</div>
      <div class="tm-kop2" style="margin-top:8px">${esc(p.naam)}</div>
      <div class="tm-info">${esc(p.bouw === 'club' ? 'Hele club' : bouwNaam(p.bouw))} · ${esc(MODELLEN[p.model]?.naam || '')} · plan v${p.planVersie || 1}</div>
      ${voorbeeld ? `<div class="tm-band" style="margin-top:8px">${band}</div>
        <div class="tm-info">Voorbeeld voor ${esc(scope[0].naam)}: ${voorbeeld.blokken.map(b => `${esc(b.thema)} (${b.weken} wk)`).join(' → ')}</div>` : ''}
    </div>
    <div class="kaart"><div class="tm-sub" style="margin-top:0">Teams (${scope.length})</div>
      ${scope.length ? scope.map(t => {
        const rij = toew[t.id];
        const achter = rij && (rij.planVersie || 0) < (p.planVersie || 1);
        const status = !rij ? `<span class="tm-badge">nog niet toegewezen</span>` : achter ? `<span class="tm-badge" style="color:var(--accent)">bijwerken (v${rij.planVersie})</span>` : `<span class="tm-badge">actief · ${rij.aantal || 0} trainingen</span>`;
        return `<div class="tm-rij" style="padding:8px 0;border-bottom:1px solid var(--hair)"><div><b>${esc(t.naam)}</b><div class="tm-info">${esc(catLabel(t.categorie))} · ${esc(bouwNaam(bouwVanTeamUi(t)))}</div></div>
          <div style="display:flex;gap:6px;align-items:center">${status}${mag ? `<button class="knop klein ${!rij || achter ? 'fluo' : 'licht'}" data-cjp="toewijs" data-team="${esc(t.id)}">${!rij ? 'Toewijzen' : achter ? 'Bijwerken' : 'Opnieuw'}</button>` : ''}</div></div>`;
      }).join('') : `<div class="tm-info">Geen teams in deze bouw.</div>`}
      ${mag && scope.length ? `<button class="knop vol fluo" data-cjp="toewijs-alles" style="margin-top:12px">Wijs toe aan alle ${scope.length} teams</button>` : ''}
      ${!mag ? `<div class="tm-info" style="margin-top:8px">Je kunt dit plan bekijken; toewijzen doet de hoofd jeugdopleiding, de clubadmin of de bouwcoördinator van deze bouw.</div>` : ''}
    </div>`;
}
const bouwVanTeamUi = t => (t.bouw && JEUGDBOUWEN.includes(t.bouw)) ? t.bouw : (t.categorie ? (Number(String(t.categorie).match(/O(\d+)/)?.[1]) <= 9 ? 'onder' : Number(String(t.categorie).match(/O(\d+)/)?.[1]) <= 11 ? 'midden' : 'boven') : 'boven');

/* ---------- acties ---------- */
async function bewaarPlan(){
  const c = C(); const f = c.form; if (!f) return;
  const naam = String(document.getElementById('cjpNaam')?.value || f.naam).trim();
  if (!naam) return meld('Geef het plan een naam');
  if (!f.start || !f.eind || f.start >= f.eind) return meld('De einddatum moet na de startdatum liggen');
  const rechten = rechtenVoor(S.club, uidNu());
  if (!magVoorBouw(rechten, f.bouw)) return meld('Je mag voor deze bouw geen plan maken');
  const bestaand = c.bewerk ? c.plannen.find(p => p.id === c.bewerk) : null;
  const id = bestaand?.id || `p${Date.now().toString(36)}`;
  c.bezig = true;
  const data = {
    naam, bouw: f.bouw, model: f.model,
    params: { start: f.start, eind: f.eind, vrij: f.vrij || [], accent: f.accent || [], tpw: f.tpw, duur: f.duur, niveau: f.niveau },
    bibliotheekVersie: BIBLIOTHEEK.versie, planVersie: bestaand ? (bestaand.planVersie || 1) + 1 : 1, door: uidNu(), bijgewerktMs: Date.now(),
    ...(bestaand ? {} : { gemaaktMs: Date.now() }),
  };
  try {
    await setDoc(doc(db, 'clubs', S.clubId, 'seizoensplannen', id), data, { merge: true });
    c.nieuw = false; c.bewerk = null; c.form = null; c.sel = id;
    c.plannen = null; delete c.toew[id];
    meld('Seizoensplan opgeslagen');
    laadPlannen();
  } catch (e){ meld('Opslaan mislukt: ' + (e.code || e.message)); }
  c.bezig = false; c.opnieuw?.();
}

/* Toewijzen: per team de trainingen van het seizoen op Oefenstof zetten. Vraagt één keer vooraf
   als er al handmatige trainingen in dezelfde week staan (beide blijven, of die weken overslaan). */
async function toewijs(planId, teamIds){
  const c = C(); const p = c.plannen.find(x => x.id === planId); if (!p) return;
  if (!magVoorBouw(rechtenVoor(S.club, uidNu()), p.bouw)) return meld('Je mag dit plan niet toewijzen');
  const beschikbaar = beschikbareThemas(VORMEN);
  const teams = teamsVoorPlan(p, c.teams).filter(t => teamIds.includes(t.id));
  if (!teams.length) return meld('Geen teams om toe te wijzen');
  c.bezig = true; c.opnieuw?.();
  try {
    /* 1. berekenen en botsingen zoeken */
    const werk = [];
    for (const t of teams){
      const snap = await getDocs(query(collection(db, 'trainingen'), where('club', '==', S.clubId), where('teams', 'array-contains', t.id)));
      const bestaande = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const planT = planVoorTeam(p, t, beschikbaar);
      const { docs } = trainingDocs({ plan: planT, team: t, clubId: S.clubId, planId: p.id, planVersie: p.planVersie || 1, vormen: VORMEN, aantalSpelers: 12 });
      const bezet = bezetteWeken(bestaande);
      const botsend = docs.filter(d => bezet.has(Number(String(d.week).match(/\d+/)?.[0])));
      werk.push({ t, bestaande, docs, bezet, botsend });
    }
    /* 2. één keer vragen bij botsingen */
    const botsTeams = werk.filter(w => w.botsend.length);
    let overslaan = false;
    if (botsTeams.length){
      const regels = botsTeams.map(w => `${w.t.naam}: week ${[...new Set(w.botsend.map(d => d.seizoensWeek))].length} seizoensweken`).join('\n');
      const ok = confirm(`Bij ${botsTeams.length} team(s) staan al handmatige trainingen in dezelfde week:\n${regels}\n\nOK = seizoenstrainingen erbij (beide blijven).\nAnnuleren = die weken overslaan.`);
      overslaan = !ok;
    }
    /* 3. wegschrijven in batches van max 400 */
    let geschreven = 0, overgeslagen = 0, verwijderd = 0;
    for (const w of werk){
      const nieuweIds = new Set(w.docs.map(d => d.id));
      const teVerwijderen = w.bestaande.filter(d => d.bron === 'seizoensplan' && d.seizoensplanId === p.id && !nieuweIds.has(d.id));
      const schrijf = w.docs.filter(d => !(overslaan && w.bezet.has(Number(String(d.week).match(/\d+/)?.[0]))));
      overgeslagen += w.docs.length - schrijf.length;
      const ops = [
        ...schrijf.map(d => ({ soort: 'set', ref: doc(db, 'trainingen', d.id), data: { ...d, gemaakt: serverTimestamp() } })),
        ...teVerwijderen.map(d => ({ soort: 'del', ref: doc(db, 'trainingen', d.id) })),
      ];
      for (let i = 0; i < ops.length; i += 400){
        const batch = writeBatch(db);
        ops.slice(i, i + 400).forEach(o => o.soort === 'set' ? batch.set(o.ref, o.data, { merge: true }) : batch.delete(o.ref));
        await batch.commit();
      }
      geschreven += schrijf.length; verwijderd += teVerwijderen.length;
      await setDoc(doc(db, 'clubs', S.clubId, 'seizoensplannen', p.id, 'toewijzingen', w.t.id), {
        teamId: w.t.id, planVersie: p.planVersie || 1, aantal: schrijf.length, overgeslagen: w.docs.length - schrijf.length,
        status: 'actief', door: uidNu(), toegewezenMs: Date.now(),
      }, { merge: true });
    }
    meld(`Toegewezen aan ${teams.length} team(s): ${geschreven} trainingen${overgeslagen ? `, ${overgeslagen} overgeslagen` : ''}${verwijderd ? `, ${verwijderd} vervallen` : ''}`);
    await laadToewijzingen(p.id);
  } catch (e){ meld('Toewijzen mislukt: ' + (e.code || e.message)); }
  c.bezig = false; c.opnieuw?.();
}

/* ---------- koppelen ---------- */
export function koppelClubJeugdplan(v, teams, opnieuw){
  const c = C(); c.opnieuw = opnieuw;
  const root = v.querySelector('#cjpRoot'); if (!root) return;
  root.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.cjpOpen){ c.sel = d.cjpOpen; c.nieuw = false; return opnieuw(); }
    if (d.cjpHj){
      const uid = d.cjpHj, naam = b.textContent.trim();
      const aan = !S.club?.hoofdJeugd?.[uid];
      try {
        await updateDoc(doc(db, 'clubs', S.clubId), aan ? { [`hoofdJeugd.${uid}`]: true, [`hoofdJeugdInfo.${uid}`]: { naam } } : { [`hoofdJeugd.${uid}`]: deleteField() });
        meld(aan ? `${naam} is hoofd jeugdopleiding` : `${naam} is geen hoofd jeugdopleiding meer`);
      } catch (err){ meld('Wijzigen mislukt: ' + (err.code || err.message)); }
      return;
    }
    if (d.cjpBouw){ c.form.bouw = d.cjpBouw; return opnieuw(); }
    if (d.cjpModel){ c.form.model = d.cjpModel; return opnieuw(); }
    if (d.cjpDuur){ c.form.duur = Number(d.cjpDuur); return opnieuw(); }
    if (d.cjpNiv){ c.form.niveau = Number(d.cjpNiv); return opnieuw(); }
    if (d.cjpTpw){ c.form.tpw = Math.max(1, Math.min(3, c.form.tpw + Number(d.cjpTpw))); return opnieuw(); }
    if (d.cjpVrijweg){ c.form.vrij = (c.form.vrij || []).filter(m => m !== d.cjpVrijweg); return opnieuw(); }
    if (d.cjpAcc){ const a = new Set(c.form.accent || []); if (a.has(d.cjpAcc)) a.delete(d.cjpAcc); else if (a.size < 2) a.add(d.cjpAcc); c.form.accent = [...a]; return opnieuw(); }
    switch (d.cjp){
      case 'rolnaam': {
        const naam = String(document.getElementById('cjpRolNaam')?.value || '').trim();
        if (!naam) return meld('Geef de rol een naam');
        try { await updateDoc(doc(db, 'clubs', S.clubId), { 'instellingen.jeugdRolNaam': naam }); meld('Naam van de rol opgeslagen'); }
        catch (err){ meld('Opslaan mislukt: ' + (err.code || err.message)); }
        return;
      }
      case 'nieuw': c.nieuw = true; c.bewerk = null; c.form = null; c.sel = null; return opnieuw();
      case 'bewerk': c.bewerk = c.sel; c.form = null; c.nieuw = false; return opnieuw();
      case 'annuleer': c.nieuw = false; c.bewerk = null; c.form = null; return opnieuw();
      case 'terug': c.sel = null; c.nieuw = false; c.bewerk = null; return opnieuw();
      case 'bewaar': return bewaarPlan();
      case 'toewijs': return toewijs(c.sel, [b.dataset.team]);
      case 'toewijs-alles': {
        const p = c.plannen.find(x => x.id === c.sel);
        return toewijs(c.sel, teamsVoorPlan(p, c.teams).map(t => t.id));
      }
    }
  };
  root.onchange = e => {
    if (e.target.id === 'cjpStart' && c.form){ c.form.start = maandagVan(e.target.value || c.form.start); c.form.vrij = (c.form.vrij || []).filter(m => m >= c.form.start && m <= c.form.eind); if (!c.form.vrij.length) c.form.vrij = standaardVrij(c.form.start, c.form.eind); return opnieuw(); }
    if (e.target.id === 'cjpEind' && c.form){ c.form.eind = e.target.value || c.form.eind; return opnieuw(); }
    if (e.target.id === 'cjpVrijNieuw' && e.target.value && c.form){ c.form.vrij = [...new Set([...(c.form.vrij || []), maandagVan(e.target.value)])].sort(); return opnieuw(); }
  };
}
