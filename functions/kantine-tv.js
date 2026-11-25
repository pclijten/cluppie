/* ==================== KANTINE-TV [20261125w] ====================
   Houdt het programma op de kantine-tv van een club bij (clubTv/{id}, zie public/js/scherm-boot.js).
   De tv is een openbare pagina zonder account en mag de wedstrijden van de teams niet zelf lezen.
   Deze functie zet daarom elke tien minuten (07:00–23:00) per club met een open tv de wedstrijden
   van vandaag in dat document: tijd, teams, veld, kleedkamer en stand. Geen spelersnamen.

   Zelfde regels als public/js/clubscherm-logica.js (programmaRij, bouwProgramma); getest in
   tests/kantine-tv.test.js. Sponsoren en eigen schermen zet het bestuur zelf (clubschermen.js). */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');

const MAX_PROGRAMMA = 120;
const tekst = (v, max = 60) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isTijd = s => /^\d{1,2}:\d{2}$/.test(String(s || ''));
const min = t => isTijd(t) ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : 9999;

function programmaRij(team = {}, w = {}){
  if (!w || !isIso(w.datum)) return null;
  const thuis = w.thuis !== false, eigen = tekst(team.naam, 40) || 'Team', tegen = tekst(w.tegenstander, 60) || 'Tegenstander';
  let stand = '';
  const voor = Number(w.doelBin), tg = Number(w.doelTegen);
  if (w.resultaat && Number.isFinite(voor) && Number.isFinite(tg)) stand = thuis ? `${voor} - ${tg}` : `${tg} - ${voor}`;
  else if (/^\d+\s*-\s*\d+$/.test(String(w.uitslag || ''))) stand = String(w.uitslag).replace(/\s*-\s*/, ' - ');
  return { datum: w.datum, tijd: isTijd(w.aftrap) ? w.aftrap.padStart(5, '0') : '', thuis, a: thuis ? eigen : tegen, b: thuis ? tegen : eigen,
    veld: tekst(w.info && w.info.veld, 30), kk: tekst(w.info && w.info.kleedkamer, 30), stand, afgelast: w.status === 'afgelast', soort: tekst(w.competitiesoort, 20) };
}
function bouwProgramma(teams = [], perTeam = {}, datum = ''){
  const uit = [];
  for (const t of teams) for (const w of perTeam[t.id] || []){ const r = programmaRij(t, w); if (r && r.datum === datum){ delete r.datum; uit.push(r); } }
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
  const programma = bouwProgramma(lijst, perTeam, datum);
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

module.exports = { kantineTv, programmaRij, bouwProgramma, vandaagNL, werkBij };
