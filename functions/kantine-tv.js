/* ==================== KANTINE-TV [20261125w] ====================
   Houdt het programma op de kantine-tv van een club bij (clubTv/{id}, zie public/js/scherm-boot.js).
   De tv is een openbare pagina zonder account en mag de wedstrijden van de teams niet zelf lezen.
   Deze functie zet daarom elke tien minuten (07:00–23:00) per club met een open tv de wedstrijden
   van vandaag in dat document: tijd, teams, veld, kleedkamer en stand. Geen spelersnamen.

   Zelfde regels als public/js/clubscherm-logica.js (programmaRij, bouwProgramma); getest in
   tests/kantine-tv.test.js. Sponsoren en eigen schermen zet het bestuur zelf (clubschermen.js). */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');

const MAX_PROGRAMMA = 120;
const tekst = (v, max = 60) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isTijd = s => /^\d{1,2}:\d{2}$/.test(String(s || ''));
const min = t => isTijd(t) ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : 9999;

/* De stand van een wedstrijd, altijd thuis – uit. Komt uit de uitslag (Sportlink) of, tijdens de wedstrijd,
   uit de doelpunten die de coach in de app bijhoudt (w.goals). eind: de wedstrijd is afgelopen;
   bezig: de klok van een periode loopt of heeft gelopen en er is nog geen einde. Geen spelersnamen. */
function standVan(w = {}){
  const thuis = w.thuis !== false, zet = (v, t) => thuis ? `${v} - ${t}` : `${t} - ${v}`;
  const voor = Number(w.doelBin), tg = Number(w.doelTegen);
  if (w.resultaat && Number.isFinite(voor) && Number.isFinite(tg)) return { stand: zet(voor, tg), eind: true, bezig: false };
  if (/^\d+\s*-\s*\d+$/.test(String(w.uitslag || ''))) return { stand: String(w.uitslag).replace(/\s*-\s*/, ' - '), eind: true, bezig: false };
  const goals = Array.isArray(w.goals) ? w.goals : [], kw = w.kwarten && typeof w.kwarten === 'object' ? w.kwarten : {};
  const nrs = Object.keys(kw).sort((a, b) => Number(a) - Number(b)), klok = k => (kw[k] && kw[k].klok) || {};
  const loopt = nrs.some(k => klok(k).running), gestart = loopt || nrs.some(k => Number(klok(k).base) > 0);
  const laatste = nrs[nrs.length - 1], eind = !!laatste && !loopt && Number(klok(laatste).base) > 0;
  if (!goals.length && !gestart) return { stand: '', eind: false, bezig: false };
  return { stand: zet(goals.filter(g => g && g.type === 'voor').length, goals.filter(g => g && g.type === 'tegen').length), eind, bezig: !eind };
}

/* [20261126v] De doelpunten van een wedstrijd voor de tv: minuut (m) en kant (k: a = thuis, b = uit), op volgorde.
   namen: { spelerId: naam } of null. Alleen als de club dat aanzet (clubTv.namen) komt de voornaam van de maker (n) en de
   assist (as) mee, en alleen bij het eigen team. klokGelopen: de coach houdt de wedstrijd met de klok bij. */
function doelpuntenVan(w = {}, namen = null){
  const thuis = w.thuis !== false, duur = Number(w.kwartduur) || 0;
  const naam = pid => namen && pid && namen[pid] ? tekst(String(namen[pid]).trim().split(/\s+/)[0], 20) : '';
  return (Array.isArray(w.goals) ? w.goals : []).filter(g => g && (g.type === 'voor' || g.type === 'tegen')).slice(0, 40).map(g => {
    const d = { m: Number.isFinite(Number(g.sec)) ? Math.max(1, Math.round((Math.max(1, Number(g.kwart) || 1) - 1) * duur + Math.floor(Number(g.sec) / 60) + 1)) : 0, k: (g.type === 'voor') === thuis ? 'a' : 'b' };
    const n = g.type === 'voor' ? naam(g.pid) : '', as = g.type === 'voor' ? naam(g.assist) : '';
    if (n) d.n = n;
    if (n && as) d.as = as;
    return d;
  }).sort((x, y) => x.m - y.m);
}
function klokGelopen(w = {}){
  const kw = w.kwarten && typeof w.kwarten === 'object' ? Object.values(w.kwarten) : [];
  return kw.some(k => k && k.klok && (k.klok.running || Number(k.klok.base) > 0));
}
function programmaRij(team = {}, w = {}, namen = null){
  if (!w || !isIso(w.datum)) return null;
  const thuis = w.thuis !== false, eigen = tekst(team.naam, 40) || 'Team', tegen = tekst(w.tegenstander, 60) || 'Tegenstander';
  const { stand, eind, bezig } = standVan(w);
  const rij = { datum: w.datum, tijd: isTijd(w.aftrap) ? w.aftrap.padStart(5, '0') : '', thuis, a: thuis ? eigen : tegen, b: thuis ? tegen : eigen,
    veld: tekst(w.info && w.info.veld, 30), kk: tekst(w.info && w.info.kleedkamer, 30), stand, eind, bezig, afgelast: w.status === 'afgelast', soort: tekst(w.competitiesoort, 20) };
  const goals = bezig || (eind && Array.isArray(w.goals) && w.goals.length) ? doelpuntenVan(w, namen) : [];
  if (goals.length){ rij.goals = goals; rij.klok = klokGelopen(w); }
  return rij;
}
function bouwProgramma(teams = [], perTeam = {}, datum = '', namen = null){
  const uit = [];
  for (const t of teams) for (const w of perTeam[t.id] || []){ const r = programmaRij(t, w, namen && namen[t.id]); if (r && r.datum === datum){ delete r.datum; uit.push(r); } }
  return uit.sort((x, y) => min(x.tijd) - min(y.tijd) || x.a.localeCompare(y.a, 'nl', { numeric: true })).slice(0, MAX_PROGRAMMA);
}
const vandaagNL = (nu = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(nu);

/* Eén club bijwerken. Geeft het aantal wedstrijden terug. */
async function werkBij(db, tvDoc, datum){
  const clubId = String(tvDoc.data().club || '');
  if (!clubId) return 0;
  const teams = await db.collection('teams').where('club', '==', clubId).limit(120).get();
  const lijst = [], perTeam = {};
  await Promise.all(teams.docs.map(async t => {
    lijst.push({ id: t.id, naam: t.data().naam || '' });
    const w = await t.ref.collection('wedstrijden').where('datum', '==', datum).get();
    perTeam[t.id] = w.docs.map(d => d.data());
  }));
  /* Namen bij doelpunten: alleen als de club dat heeft aangezet, en alleen de spelers die vandaag scoorden of aangaven. */
  let namen = null;
  if (tvDoc.data().namen === true){
    namen = {};
    await Promise.all(lijst.map(async t => {
      const ids = [...new Set((perTeam[t.id] || []).flatMap(w => (Array.isArray(w.goals) ? w.goals : []).flatMap(g => g && g.type === 'voor' ? [g.pid, g.assist] : [])).filter(x => typeof x === 'string' && x))].slice(0, 40);
      if (!ids.length) return;
      const docs = await db.getAll(...ids.map(id => db.doc(`teams/${t.id}/spelers/${id}`)));
      namen[t.id] = Object.fromEntries(docs.filter(d => d.exists).map(d => [d.id, String((d.data() || {}).naam || '')]));
    }));
  }
  const programma = bouwProgramma(lijst, perTeam, datum, namen);
  const oud = tvDoc.data();
  if (oud.datum === datum && JSON.stringify(oud.programma || []) === JSON.stringify(programma)) return programma.length;   // niets veranderd: niet schrijven
  await tvDoc.ref.update({ datum, programma, programmaMs: Date.now() });
  return programma.length;
}

const kantineTv = onSchedule(
  { region: 'europe-west1', schedule: '*/10 7-22 * * *', timeZone: 'Europe/Amsterdam', timeoutSeconds: 240, memory: '256MiB' },
  async () => {
    const db = getFirestore(), datum = vandaagNL();
    const open = await db.collection('clubTv').where('open', '==', true).limit(300).get();
    for (const d of open.docs){
      try { await werkBij(db, d, datum); }
      catch (e){ console.error(`[kantineTv] ${d.id} mislukt:`, e.message || e); }
    }
  }
);

/* [20261126q] Doelpunten direct op de tv. De coach houdt de stand bij in de app (teams/{t}/wedstrijden/{w}.goals);
   wachten op de ronde van tien minuten is te traag voor een goal-melding. Verandert de regel van een wedstrijd
   van vandaag (stand, tijd, veld, kleedkamer, afgelast), dan werken we de open tv's van die club meteen bij.
   Elke andere wijziging (opstelling, wissels) verandert de regel niet en stopt hier zonder iets te lezen. */
const regelVan = (d, datum) => { const r = d ? programmaRij({ naam: '' }, d) : null; return r && r.datum === datum ? JSON.stringify(r) : ''; };
const regelAnders = (voor, na, datum) => regelVan(voor, datum) !== regelVan(na, datum);
const kantineTvWedstrijd = onDocumentWritten(
  { document: 'teams/{teamId}/wedstrijden/{wedstrijdId}', region: 'europe-west1', memory: '256MiB' },
  async (event) => {
    const datum = vandaagNL(), voor = event.data && event.data.before.exists ? event.data.before.data() : null, na = event.data && event.data.after.exists ? event.data.after.data() : null;
    if (!regelAnders(voor, na, datum)) return;
    const db = getFirestore(), team = await db.doc(`teams/${event.params.teamId}`).get(), clubId = String((team.data() || {}).club || '');
    if (!clubId) return;
    const open = await db.collection('clubTv').where('club', '==', clubId).where('open', '==', true).limit(5).get();
    for (const d of open.docs){
      try { await werkBij(db, d, datum); }
      catch (e){ console.error(`[kantineTvWedstrijd] ${d.id} mislukt:`, e.message || e); }
    }
  }
);

module.exports = { kantineTv, kantineTvWedstrijd, programmaRij, bouwProgramma, standVan, doelpuntenVan, klokGelopen, regelAnders, vandaagNL, werkBij };
