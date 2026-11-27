/* ==================== TRAINER VERWIJDEREN (eindbaas) ====================
   [20261129m] Platform › Trainers zonder club › Verwijderen. Alleen de platformbeheerder.
   Zelfde opzet als club-verwijderen.js:
     1. droog: true   laat zien wat er weg zou gaan, verandert niets
     2. droog: false  verwijdert; alleen als bevestig precies het e-mailadres is (of de naam, zonder e-mail)

   Alleen voor LOSSE trainers. Hoort het account bij een club (lid, beheerder, coördinator) of bij een
   clubteam, dan weigert de functie: dat gaat via de club (Leden › verwijderen). Daarmee kunnen trainers
   van ASV'33 en andere echte clubs hier nooit per ongeluk weg. Platformbeheerders en je eigen account ook niet.

   Wat weggaat:
     - eigen teams zonder club waar deze trainer de enige coach is, met alles eronder en alle losse
       documenten die bij het team horen (teamkamer, deellinks enz.; zelfde zoekregel als club verwijderen)
     - uit eigen teams met nog een andere coach gaat alleen deze trainer weg; het team blijft
     - het account zelf, net als "Verwijder mijn account" (avg.js wisAccount): inlog, profiel, logins,
       gebruik, navigatiepaden, teamkamer-toegang, aanvragen, privacykennisname
     - de regel in platformstats/overzicht
   Weg is weg: er is geen prullenbak.                                                              */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const BESCHERMD = ['pclijten@gmail.com', 'paul@cluppie.io'];
const klein = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/* ---------- puur (getest in tests/trainer-verwijderen.test.js) ---------- */
function magTrainerWeg({ account, aanroeper, beheerders = [], clubs = [], clubTeams = [] }){
  if (!account) return 'Dit account bestaat niet (meer).';
  if (account.uid === aanroeper) return 'Je eigen account kun je hier niet verwijderen.';
  const mail = klein(account.email);
  if (mail && [...BESCHERMD, ...beheerders].map(klein).includes(mail)) return 'Dit is een platformbeheerder; dat account kan hier niet weg.';
  if (clubs.length) return `Deze trainer hoort bij ${clubs.map(c => c.naam || c.id).join(', ')}. Haal de trainer eerst bij de club weg; daarna kan het account hier weg.`;
  if (clubTeams.length) return `Deze trainer staat bij een clubteam (${clubTeams.map(t => t.naam || t.id).join(', ')}). Dat gaat via de club.`;
  return '';
}
/* Wat er te typen valt: het e-mailadres, of zonder e-mail de naam. */
function bevestigTekst(account){ return account ? (account.email || account.naam || '') : ''; }
function bevestigKlopt(account, invoer){
  const v = klein(bevestigTekst(account));
  return !!v && v === klein(invoer);
}
/* Eigen teams (zonder club) splitsen: waar de trainer de enige coach is gaat het team weg, anders alleen de trainer. */
function verdeelTeams(teams, uid){
  const weg = [], blijft = [];
  for (const t of teams){
    if (t.club) continue;
    const anderen = Object.keys(t.leden || {}).filter(u => u !== uid && t.leden[u]);
    (anderen.length ? blijft : weg).push(t);
  }
  return { weg, blijft };
}
/* De trainer uit de momentopname halen, met de tellers erbij. */
function zonderTrainer(ind, uid){
  if (!ind || !Array.isArray(ind.lijst)) return ind;
  const t = ind.lijst.find(x => x.uid === uid); if (!t) return ind;
  const veld = { 'eigen-team': 'eigenTeam', 'wacht-op-club': 'wachtOpClub', 'nog-geen-team': 'nogGeenTeam' }[t.status];
  const uit = { ...ind, lijst: ind.lijst.filter(x => x.uid !== uid), totaal: Math.max(0, (ind.totaal || 1) - 1) };
  if (veld) uit[veld] = Math.max(0, (ind[veld] || 1) - 1);
  if (t.nieuw) uit.nieuw7 = Math.max(0, (ind.nieuw7 || 1) - 1);
  return uit;
}

/* ---------- uitvoering ---------- */
async function clubsVan(db, uid){
  const uit = new Map();
  for (const k of ['leden', 'admins', 'trainingscoordinatoren'])
    (await db.collection('clubs').where(`${k}.${uid}`, '==', true).get()).docs.forEach(d => uit.set(d.id, { id: d.id, naam: d.data().naam || '' }));
  (await db.collection('clubs').where('eigenBouwCoaches', 'array-contains', uid).get()).docs.forEach(d => uit.set(d.id, { id: d.id, naam: d.data().naam || '' }));
  return [...uit.values()];
}

function maak({ isPlatformBeheerder }){
  return onCall({ region: REGIO, timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
    if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
    const uid = String(request.data?.uid || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new HttpsError('invalid-argument', 'Geen geldig account.');
    const db = getFirestore();
    const { getAuth } = require('firebase-admin/auth');
    const u = await getAuth().getUser(uid).catch(() => null);

    /* al weg maar nog in het overzicht: alleen die regel opruimen */
    if (!u && request.data?.droog === false){ await haalUitOverzicht(db, uid); return { klaar: true, alleenOverzicht: true }; }

    const teamDocs = (await db.collection('teams').where(`leden.${uid}`, '==', true).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const account = u ? { uid, email: u.email || '', naam: u.displayName || teamDocs.map(t => t.ledenInfo?.[uid]?.naam).find(Boolean) || '' } : null;
    const beheerders = (await db.doc('platform/instellingen').get()).data()?.beheerders || [];
    const nee = magTrainerWeg({ account, aanroeper: request.auth?.uid, beheerders,
      clubs: u ? await clubsVan(db, uid) : [], clubTeams: teamDocs.filter(t => t.club) });
    if (nee) throw new HttpsError('failed-precondition', nee);

    const { weg, blijft } = verdeelTeams(teamDocs, uid);
    const { weg: losse, tel } = await require('./club-verwijderen').scanBij(db, new Set(weg.map(t => t.id)));
    const spelers = {};
    for (const t of weg){ try { spelers[t.id] = (await db.collection(`teams/${t.id}/spelers`).count().get()).data().count; } catch (e){ spelers[t.id] = 0; } }
    const telling = {
      naam: account.naam, email: account.email, bevestig: bevestigTekst(account),
      aangemeld: u.metadata?.creationTime ? Date.parse(u.metadata.creationTime) : null,
      teamsWeg: weg.map(t => ({ naam: t.naam || 'Team zonder naam', spelers: spelers[t.id] || 0 })),
      teamsBlijft: blijft.map(t => ({ naam: t.naam || 'Team zonder naam' })),
      documenten: tel, losseDocumenten: losse.length,
    };
    if (request.data?.droog !== false) return { droog: true, ...telling };

    if (!bevestigKlopt(account, request.data?.bevestig)) throw new HttpsError('failed-precondition', 'Het e-mailadres klopt niet; er is niets verwijderd.');
    console.log('[verwijderTrainerPlatform] start', uid, account.email, 'door', request.auth?.uid, JSON.stringify({ ...telling, email: undefined }));
    for (const t of weg) await db.recursiveDelete(db.doc(`teams/${t.id}`));
    for (const r of losse) await db.recursiveDelete(r);
    await require('./avg').wisAccount(db, uid);   /* haalt de trainer ook uit de teams die blijven */
    await haalUitOverzicht(db, uid);
    console.log('[verwijderTrainerPlatform] klaar', uid);
    return { klaar: true, ...telling };
  });
}
async function haalUitOverzicht(db, uid){
  try {
    const st = db.doc('platformstats/overzicht'), o = (await st.get()).data();
    if (o && o.individueel && (o.individueel.lijst || []).some(t => t.uid === uid)){
      const ind = zonderTrainer(o.individueel, uid);
      await st.update({ individueel: ind, 'totalen.individueel': ind.totaal, 'totalen.individueelNieuw': ind.nieuw7 || 0 });
    }
  } catch (e){ console.warn('[verwijderTrainerPlatform] overzicht', e.message || e); }
}

module.exports = { maak, magTrainerWeg, bevestigKlopt, bevestigTekst, verdeelTeams, zonderTrainer, BESCHERMD };
