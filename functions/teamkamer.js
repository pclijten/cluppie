/* ==================== TEAMKAMER — Cloud Functions [20261116m] ====================
   Ouders en spelers in Cluppie, zonder dat zij bij de gegevens van de coach kunnen.
   - De kopie voor ouders (teamkamer/{teamId}, /agenda, /gezin) wordt ALLEEN hier geschreven, met de
     toegestane velden uit teamkamer-logica.js.
   - Toegang (kamerLeden) wordt alleen hier gemaakt: een ouder via de teamlink plus goedkeuring van
     de coach, een speler via een code van de eigen ouder (geen e-mail, geen wachtwoord).
   - Polls: de coach schrijft de poll, een gezin schrijft alleen de eigen stem; tellen gebeurt hier.
   Rules: firestore.rules, blok "teamkamer". Uitleg en keuzes: PORTEREN.md en het projectdocument
   claude/teamkamer-ouders-spelers-polls-impactanalyse.md. */
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const crypto = require('crypto');
const L = require('./teamkamer-logica');

const REGIO = 'europe-west1';
const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';      // geen 0/O/1/I/L
const DAG = 86400000;
const APP_URL = 'https://www.cluppie.io/kamer.html';
const nieuweCode = (n) => Array.from(crypto.randomBytes(n), b => ALFABET[b % ALFABET.length]).join('');
const ipVan = (request) => request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || request.rawRequest?.ip || 'onbekend';
const rateLimit = (...a) => require('./toegang').rateLimit(...a);
const isAnoniem = (request) => request.auth?.token?.firebase?.sign_in_provider === 'anonymous';

function vereisEcht(request){
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  if (isAnoniem(request)) throw new HttpsError('permission-denied', 'Dit kan alleen met een eigen account.');
}
async function log(db, clubId, gebeurtenis, o = {}){
  if (!clubId) return;
  try {
    await db.collection('toegangslog').add({ clubId, gebeurtenis, uid: o.uid || null, naam: null, door: o.door || null, doorNaam: null,
      teamId: o.teamId || null, details: o.details || null, tijd: FieldValue.serverTimestamp() });
  } catch (e){ logger.warn('[teamkamer] log mislukt', e.message || e); }
}
async function laad(db, teamId){
  if (!teamId || typeof teamId !== 'string' || teamId.includes('/')) throw new HttpsError('invalid-argument', 'Team ontbreekt.');
  const team = (await db.doc(`teams/${teamId}`).get()).data();
  if (!team) throw new HttpsError('not-found', 'Team bestaat niet.');
  const club = team.club ? (await db.doc(`clubs/${team.club}`).get()).data() || null : null;
  const platform = team.club ? null : (await db.doc('platform/instellingen').get()).data() || null;
  return { team, club, platform };
}
/* zelfde kring als magSchrijven in de rules: volle coach, clubadmin, coördinator of gekoppelde coach van de bouw */
function magBeheren(team, club, uid, teamId){
  if (team.leden?.[uid] === true && (team.rollen?.[uid] || 'coach') !== 'assistent') return true;
  if (!club) return false;
  return club.admins?.[uid] === true || club.bouwCoordinatoren?.[team.bouw || '_']?.[uid] === true
    || club.eigenBouwToegang?.[teamId]?.[uid] === true;
}
async function vereisCoach(db, request, teamId){
  vereisEcht(request);
  const x = await laad(db, teamId);
  if (!magBeheren(x.team, x.club, request.auth.uid, teamId)) throw new HttpsError('permission-denied', 'Alleen de trainers van dit team mogen dit.');
  return x;
}
function vereisAan(x){
  if (!L.toegestaan(x.team, x.club, x.platform)) throw new HttpsError('failed-precondition', 'De teamkamer staat niet aan voor deze club.');
  if (!L.inst(x.team).aan) throw new HttpsError('failed-precondition', 'Zet de teamkamer eerst aan voor dit team.');
}
async function lidVan(db, teamId, uid){
  const d = (await lidRef(db, teamId, uid).get()).data();
  return d && d.vervaltOp && d.vervaltOp.toMillis() > Date.now() ? d : null;
}
/* Lidmaatschap staat onder de teamkamer zelf (teamkamer/{teamId}/kamerleden/{uid}); de rules lezen dat pad
   rechtstreeks. Een wijzer onder gebruikers/{uid}/kamers/{teamId} laat een ouder zijn teams terugvinden. */
const lidRef = (db, teamId, uid) => db.doc(`teamkamer/${teamId}/kamerleden/${uid}`);
const wijzerRef = (db, teamId, uid) => db.doc(`gebruikers/${uid}/kamers/${teamId}`);
const ledenVanTeam = async (db, teamId) => (await db.collection(`teamkamer/${teamId}/kamerleden`).get()).docs;

async function schrijfInDelen(db, acties){
  for (let i = 0; i < acties.length; i += 400){
    const b = db.batch();
    acties.slice(i, i + 400).forEach(a => a(b));
    await b.commit();
  }
}

/* ---------- de kopie voor ouders en spelers ---------- */
async function bouwKamer(db, teamId, opties = {}){
  const tRef = db.doc(`teams/${teamId}`), kRef = db.doc(`teamkamer/${teamId}`);
  const team = (await tRef.get()).data();
  const club = team && team.club ? (await db.doc(`clubs/${team.club}`).get()).data() || null : null;
  const platform = team && !team.club ? (await db.doc('platform/instellingen').get()).data() || null : null;
  if (!team || !L.toegestaan(team, club, platform) || !L.inst(team).aan){
    const k = await kRef.get();
    if (k.exists && k.data().aan !== false) await kRef.set({ aan: false, bijgewerkt: FieldValue.serverTimestamp() }, { merge: true });
    return { aan: false };
  }
  const i = L.inst(team, L.opties(team, club, platform)), vandaag = L.vandaagNL();
  const spelers = (await tRef.collection('spelers').get()).docs.map(d => ({ ...d.data(), id: d.id }));
  const verborgen = (await tRef.collection('kamerBeheer').doc('verborgen').get()).data() || {};
  const hoofd = { ...L.kamerDoc(team, club, spelers, verborgen, platform), bijgewerkt: FieldValue.serverTimestamp() };
  const acties = [(b) => b.set(kRef, hoofd, { mergeFields: Object.keys(hoofd) })];
  /* [20261116r] wat de app van de trainer aanlevert: trainingen per datum en cijfers per speler (zie kamer-beheer.js, syncTeamkamer) */
  const beheer = tRef.collection('kamerBeheer');
  const plannen = i.trainingen ? ((await beheer.doc('trainingen').get()).data() || {}).items || {} : null;
  const cijfers = i.stats ? ((await beheer.doc('stats').get()).data() || {}) : null;
  const actief = spelers.filter(L.spelerActief), actiefIds = actief.map(p => p.id);
  const ws = await tRef.collection('wedstrijden').where('datum', '>=', L.plusDagen(vandaag, -14)).get();
  for (const p of actief){
    /* niet geselecteerd: alleen komende wedstrijden, en alleen in het document van het eigen gezin */
    const niet = ws.docs.filter(d => String(d.data().datum || '').slice(0, 10) >= vandaag && L.nietMee(d.data(), [p.id]).length).map(d => 'w_' + d.id).sort();
    acties.push((b) => b.set(kRef.collection('gezin').doc(p.id), { voornaam: L.voornaam(p.naam), nietMee: niet,
      nr: hoofd.spelers[p.id]?.nr ?? (Number.isFinite(Number(p.nummer)) && p.nummer != null && p.nummer !== '' ? Number(p.nummer) : null) }, { merge: true }));
    /* cijfers: eigen document dat alleen ouders lezen (rules), niet de speler zelf */
    const sRef = kRef.collection('gezin').doc(p.id).collection('ouder').doc('stats');
    const st = cijfers ? L.schoonStats((cijfers.spelers || {})[p.id], i.stats) : null;
    if (st) acties.push((b) => b.set(sRef, { ...st, tm: typeof cijfers.tm === 'string' ? cijfers.tm.slice(0, 10) : vandaag }));
    else acties.push((b) => b.delete(sRef));
  }
  let agenda = 0;
  if (opties.agenda !== false){
    const pres = await tRef.collection('presentie').where('datum', '>=', vandaag).get();
    const presentie = {};
    pres.docs.forEach(d => { const x = d.data(); if (typeof x.datum === 'string') presentie[x.datum.slice(0, 10)] = Array.isArray(x.afwezig) ? x.afwezig.filter(y => typeof y === 'string') : []; });
    const nieuw = L.projectTrainingen(team, presentie, vandaag, 28, plannen);
    ws.docs.forEach(d => { const p = L.projectWedstrijd(d.data(), i, vandaag); if (p) nieuw['w_' + d.id] = p; });
    const oud = await kRef.collection('agenda').get();
    /* [20261125x] a_<id> = clubactiviteit; die schrijft kamerActiviteit, niet deze herbouw */
    oud.docs.filter(d => !nieuw[d.id] && !d.id.startsWith('a_')).forEach(d => acties.push((b) => b.delete(d.ref)));
    Object.entries(nieuw).forEach(([id, doc]) => acties.push((b) => b.set(kRef.collection('agenda').doc(id), doc)));
    agenda = Object.keys(nieuw).length;
  }
  await schrijfInDelen(db, acties);
  return { aan: true, agenda };
}
const kamerAan = async (db, teamId) => { const k = (await db.doc(`teamkamer/${teamId}`).get()).data(); return k && k.aan === true ? k : null; };

const kamerTeam = onDocumentWritten({ document: 'teams/{teamId}', region: REGIO }, async (event) => {
  const voor = event.data.before.data(), na = event.data.after.data();
  if (L.teamSleutel(voor) === L.teamSleutel(na)) return;
  if (!L.inst(voor).aan && !L.inst(na).aan) return;
  await bouwKamer(getFirestore(), event.params.teamId);
});
const kamerSpeler = onDocumentWritten({ document: 'teams/{teamId}/spelers/{spelerId}', region: REGIO }, async (event) => {
  const voor = event.data.before.data(), na = event.data.after.data();
  if (L.spelerSleutel(voor) === L.spelerSleutel(na)) return;
  const db = getFirestore(), { teamId, spelerId } = event.params;
  if (!(await kamerAan(db, teamId))) return;
  if (!L.spelerActief(na)){
    /* speler weg uit het team: de toegang van zijn gezin stopt meteen */
    const weg = (await ledenVanTeam(db, teamId)).filter(d => (d.data().spelerIds || []).includes(spelerId));
    await schrijfInDelen(db, weg.map(d => (b) => {
      const rest = (d.data().spelerIds || []).filter(x => x !== spelerId);
      if (rest.length) b.update(d.ref, { spelerIds: rest }); else { b.delete(d.ref); b.delete(wijzerRef(db, teamId, d.id)); }
    }));
    await db.doc(`teamkamer/${teamId}/gezin/${spelerId}`).delete().catch(() => {});
  }
  await bouwKamer(db, teamId, { agenda: false });
});
const ALLES = { uitslag: true, live: true, opstelling: true, opstellingAltijd: true };
/* [eindbaas] de eindbaas zet een mogelijkheid aan of uit, of de club verandert van naam of plaats: alle teamkamers van die club opnieuw */
const clubSleutel = (c) => JSON.stringify(c ? [c.platformModules?.teamkamer === true, c.platformModules?.teamkamerOpties || null, c.naam || '', c.instellingen?.locatie || null] : 'geen');
const kamerClub = onDocumentWritten({ document: 'clubs/{clubId}', region: REGIO }, async (event) => {
  const voor = event.data.before.data(), na = event.data.after.data();
  if (clubSleutel(voor) === clubSleutel(na)) return;
  const db = getFirestore();
  const kamers = await db.collection('teamkamer').where('club', '==', event.params.clubId).get();
  for (const k of kamers.docs){ try { await bouwKamer(db, k.id); } catch (e){ logger.warn('[kamerClub] team ' + k.id, e.message || e); } }
});
const platformSleutel = (p) => JSON.stringify(p ? [p.teamkamerLos === true, p.teamkamerLosOpties || null] : 'geen');
const kamerPlatform = onDocumentWritten({ document: 'platform/{docId}', region: REGIO }, async (event) => {
  if (event.params.docId !== 'instellingen') return;
  if (platformSleutel(event.data.before.data()) === platformSleutel(event.data.after.data())) return;
  const db = getFirestore();
  const kamers = await db.collection('teamkamer').where('club', '==', null).get();
  for (const k of kamers.docs){ try { await bouwKamer(db, k.id); } catch (e){ logger.warn('[kamerPlatform] team ' + k.id, e.message || e); } }
});
const kamerWedstrijd = onDocumentWritten({ document: 'teams/{teamId}/wedstrijden/{wedstrijdId}', region: REGIO }, async (event) => {
  const vandaag = L.vandaagNL(), voor = event.data.before.data(), na = event.data.after.data();
  /* de live wedstrijd schrijft vaak (klok, wissels): zolang niets voor ouders verandert, lezen we niets */
  const selectieAnders = L.selectieSleutel(voor) !== L.selectieSleutel(na);
  if (!selectieAnders && JSON.stringify(L.projectWedstrijd(voor, ALLES, vandaag)) === JSON.stringify(L.projectWedstrijd(na, ALLES, vandaag))) return;
  const db = getFirestore(), { teamId, wedstrijdId } = event.params;
  const k = await kamerAan(db, teamId);
  if (!k) return;
  /* [20261116r] niet geselecteerd: per gezin bijwerken als de selectie van deze wedstrijd verandert */
  if (selectieAnders){
    const ids = Object.keys(k.spelers || {}), komend = na && String(na.datum || '').slice(0, 10) >= vandaag;
    const niet = new Set(komend ? L.nietMee(na, ids) : []), sleutel = 'w_' + wedstrijdId;
    await schrijfInDelen(db, ids.map(id => (b) => b.set(db.doc(`teamkamer/${teamId}/gezin/${id}`),
      { nietMee: niet.has(id) ? FieldValue.arrayUnion(sleutel) : FieldValue.arrayRemove(sleutel) }, { merge: true })));
  }
  const doc = L.projectWedstrijd(na, { uitslag: k.uitslag === true, live: k.live === true, opstelling: k.mag?.opstelling === true, opstellingAltijd: k.opstellingAltijd === true }, vandaag);
  const ref = db.doc(`teamkamer/${teamId}/agenda/w_${wedstrijdId}`);
  if (doc) await ref.set(doc); else await ref.delete();
});
const presSleutel = (p) => (p ? JSON.stringify([p.datum || '', Array.isArray(p.afwezig) ? [...p.afwezig].sort() : []]) : 'geen');
const kamerPresentie = onDocumentWritten({ document: 'teams/{teamId}/presentie/{presentieId}', region: REGIO }, async (event) => {
  const voor = event.data.before.data(), na = event.data.after.data();
  if (presSleutel(voor) === presSleutel(na)) return;
  const datum = String((na || voor).datum || '').slice(0, 10), vandaag = L.vandaagNL();
  if (!datum || datum < vandaag) return;
  const db = getFirestore(), { teamId } = event.params;
  if (!(await kamerAan(db, teamId))) return;
  if (!na || (voor && voor.datum !== na.datum)) { await bouwKamer(db, teamId); return; }
  await db.doc(`teamkamer/${teamId}/agenda/t_${datum}`).set(
    { soort: 'training', datum, erbij: null, afwezig: (Array.isArray(na.afwezig) ? [...new Set(na.afwezig.filter(x => typeof x === 'string'))] : []).sort() }, { merge: true });
});

/* [20261116r] de app van de trainer leverde trainingen of cijfers aan: kopie opnieuw (alleen toegestane velden komen erin) */
const kamerAanlevering = onDocumentWritten({ document: 'teams/{teamId}/kamerBeheer/{docId}', region: REGIO }, async (event) => {
  if (!['trainingen', 'stats'].includes(event.params.docId)) return;
  const db = getFirestore();
  if (!(await kamerAan(db, event.params.teamId))) return;
  await bouwKamer(db, event.params.teamId, { agenda: event.params.docId === 'trainingen' });
});

/* [20261125x] Activiteiten van de club in de agenda van ouders (clubs/{clubId}/activiteitenAgenda/{actId}).
   Alleen bij teams van deze club waar de teamkamer aan staat, en alleen als het comité "ook in de Teamkamer"
   aanzette. Wat erin staat: naam, datum, tijd, plek, plan B en de vrijwilligerslink. Geen namen. */
const kamerActiviteit = onDocumentWritten({ document: 'clubs/{clubId}/activiteitenAgenda/{actId}', region: REGIO }, async (event) => {
  const { clubId, actId } = event.params, db = getFirestore();
  const voor = event.data.before.data(), na = event.data.after.data();
  const teamsNa = na && na.kamer === true && na.status !== 'geannuleerd' && /^\d{4}-\d{2}-\d{2}$/.test(String(na.datum || '')) ? (Array.isArray(na.teams) ? na.teams : []) : [];
  const alle = [...new Set([...(Array.isArray(voor?.teams) ? voor.teams : []), ...teamsNa])].filter(t => typeof t === 'string' && t).slice(0, 150);
  const tekst = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const link = /^https:\/\/(www\.)?cluppie\.io\/[^\s]*$/.test(String(na?.link || '')) ? na.link : '';
  for (const teamId of alle){
    const ref = db.doc(`teamkamer/${teamId}/agenda/a_${actId}`);
    const team = (await db.doc(`teams/${teamId}`).get()).data();
    const hoort = team && team.club === clubId && teamsNa.includes(teamId) && await kamerAan(db, teamId);
    if (hoort) await ref.set({ soort: 'activiteit', datum: na.datum, titel: tekst(na.naam, 80), tijd: tekst(na.start, 5), eind: tekst(na.eind, 5), plek: tekst(na.locatie, 80),
      tekst: String(na.omschrijving || '').slice(0, 600), planB: tekst(na.planB, 600), link });
    else await ref.delete().catch(() => {});
  }
  await vraagDeelnemers(db, clubId, actId, voor, na);
});

/* [20261125n] Activiteiten › Deelnemers › "Vraag wie meedoet": per meedoend team een deelnemerslijstje
   (teams/{teamId}/lijsten/act_{actId}) en, als de Teamkamer en polls aan staan, een poll voor ouders
   (teamkamer/{teamId}/polls/act_{actId}). Antwoorden uit de poll komen in het lijstje (kamerStem).
   Een bestaand lijstje wordt nooit overschreven (de coach kan al hebben ingevuld); valt een team af of gaat
   de vraag uit, dan sluiten we de poll en blijft het lijstje staan. */
const DAG_MS = 86400000;
async function vraagDeelnemers(db, clubId, actId, voor, na){
  const geldig = na && na.vraag === true && na.status !== 'geannuleerd' && /^\d{4}-\d{2}-\d{2}$/.test(String(na.datum || ''));
  const teamsNa = geldig && Array.isArray(na.teams) ? na.teams : [];
  const alle = [...new Set([...(voor?.vraag === true && Array.isArray(voor?.teams) ? voor.teams : []), ...teamsNa])].filter(t => typeof t === 'string' && t).slice(0, 150);
  const tekst = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  for (const teamId of alle){
    const lijstRef = db.doc(`teams/${teamId}/lijsten/act_${actId}`), pollRef = db.doc(`teamkamer/${teamId}/polls/act_${actId}`);
    const team = (await db.doc(`teams/${teamId}`).get()).data();
    const doe = team && team.club === clubId && teamsNa.includes(teamId);
    if (!doe){
      const p = await pollRef.get();
      if (p.exists && p.data().status === 'open') await pollRef.update({ status: 'gesloten' }).catch(() => {});
      continue;
    }
    const naam = tekst(na.naam, 60) || 'Clubactiviteit', datum = na.datum, tijd = tekst(na.start, 5);
    const l = await lijstRef.get();
    if (!l.exists) await lijstRef.set({ naam, sjabloon: 'aanwezig', rijen: 'spelers',
      kolommen: [{ id: 'mee', naam: 'Doet mee', type: 'check' }, { id: 'opm', naam: 'Opmerking', type: 'tekst', optioneel: true }],
      waarden: {}, inPlanning: false, gearchiveerd: false, datum, ...(tijd ? { tijd } : {}), activiteit: actId, seizoen: tekst(na.seizoen, 12),
      gemaaktDoor: 'activiteit', gemaaktMs: Date.now(), bijgewerktMs: Date.now() });
    else if (l.data().naam !== naam || l.data().datum !== datum) await lijstRef.update({ naam, datum, bijgewerktMs: Date.now() });
    const kamer = await kamerAan(db, teamId);
    if (!kamer || kamer.mag?.polls !== true) continue;
    const tot = /^\d{4}-\d{2}-\d{2}$/.test(String(na.vraagTot || '')) && na.vraagTot <= datum ? na.vraagTot : new Date(Date.parse(datum + 'T12:00:00Z') - 3 * DAG_MS).toISOString().slice(0, 10);
    const dag = new Date(datum + 'T12:00:00Z').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
    const vraag = `Doet je kind mee aan ${naam} op ${dag}${tijd ? ' (' + tijd + ')' : ''}?`.slice(0, 140);
    const p = await pollRef.get();
    if (!p.exists) await pollRef.set({ vraag, opties: [{ id: 'o1', tekst: 'Ja, doet mee' }, { id: 'o2', tekst: 'Nee, deze keer niet' }], soort: 'vrij', meer: false, namen: true, spelers: false,
      status: 'open', wedstrijdId: null, wedstrijdDatum: null, nodig: null, sluitDatum: tot, sluitOp: Timestamp.fromDate(new Date(tot + 'T19:00:00Z')),
      activiteitId: actId, gemaaktDoor: 'activiteit', gemaaktMs: Date.now() });
    else if (p.data().vraag !== vraag || p.data().sluitDatum !== tot || p.data().status !== 'open')
      await pollRef.update({ vraag, sluitDatum: tot, sluitOp: Timestamp.fromDate(new Date(tot + 'T19:00:00Z')), status: 'open' });
  }
}
/* Een stem op een activiteit-poll komt als Doet mee ✓/✗ in het deelnemerslijstje van de coach. */
async function stemNaarLijst(db, teamId, pollId, spelerId, stem){
  if (!/^act_/.test(pollId)) return;
  const lijstRef = db.doc(`teams/${teamId}/lijsten/${pollId}`);
  if (!(await lijstRef.get()).exists) return;
  const k = Array.isArray(stem?.keuzes) ? stem.keuzes : [];
  const w = k.includes('o1') ? true : k.includes('o2') ? false : null;
  await lijstRef.update({ [`waarden.${spelerId}.mee`]: w === null ? FieldValue.delete() : w, bijgewerktMs: Date.now() }).catch(() => {});
}

/* ---------- polls: tellen en beurten ---------- */
async function telPoll(db, teamId, pollId){
  const ref = db.doc(`teamkamer/${teamId}/polls/${pollId}`);
  const poll = (await ref.get()).data();
  if (!poll) return;
  const docs = (await ref.collection('stemmen').get()).docs;
  const stemmen = docs.map(d => ({ spelerId: d.id, keuzes: d.data().keuzes }));
  const t = L.telStemmen(poll, stemmen);
  /* [20261116p] geteldMs = de nieuwste stem die in deze telling zit. De pagina van ouders telt de eigen stem
     zelf alvast mee en laat dat los zodra geteldMs die stem heeft ingehaald. */
  const geteldMs = docs.reduce((m, d) => Math.max(m, Number(d.data().ms) || 0), 0);
  await ref.update({ telling: t.telling, gestemd: t.gestemd, wie: t.wie || FieldValue.delete(), geteldMs });
}
const kamerStem = onDocumentWritten({ document: 'teamkamer/{teamId}/polls/{pollId}/stemmen/{spelerId}', region: REGIO }, async (event) => {
  const db = getFirestore();
  await telPoll(db, event.params.teamId, event.params.pollId);
  await stemNaarLijst(db, event.params.teamId, event.params.pollId, event.params.spelerId, event.data.after.data());
});
const pollSleutel = (p) => (p ? JSON.stringify([p.namen === true, p.meer === true, (p.opties || []).map(o => o && o.id)]) : 'geen');
const kamerPoll = onDocumentWritten({ document: 'teamkamer/{teamId}/polls/{pollId}', region: REGIO }, async (event) => {
  const voor = event.data.before.data(), na = event.data.after.data();
  const db = getFirestore(), { teamId, pollId } = event.params;
  if (!na){
    /* poll verwijderd: stemmen opruimen */
    await db.recursiveDelete(db.collection(`teamkamer/${teamId}/polls/${pollId}/stemmen`)).catch(() => {});
    return;
  }
  if (voor && pollSleutel(voor) !== pollSleutel(na)) await telPoll(db, teamId, pollId);
  if (na.status === 'gesloten' && na.beurtenGeteld !== true && L.BEURT_SOORTEN.includes(na.soort)){
    const kamer = await kamerAan(db, teamId);
    if (!kamer || kamer.mag?.beurten !== true) return;            /* beurtenteller staat uit (eindbaas) */
    const ref = event.data.after.ref;
    /* de vlag eerst, in een transactie: twee gelijktijdige starts tellen niet dubbel */
    const mag = await db.runTransaction(async tx => {
      const p = (await tx.get(ref)).data();
      if (!p || p.beurtenGeteld === true) return false;
      tx.update(ref, { beurtenGeteld: true });
      return true;
    });
    if (!mag) return;
    const stemmen = (await ref.collection('stemmen').get()).docs.map(d => ({ spelerId: d.id, keuzes: d.data().keuzes }));
    const ids = L.beurtenVan(na, stemmen), kRef = db.doc(`teamkamer/${teamId}`);
    await schrijfInDelen(db, ids.map(id => (b) => b.set(kRef.collection('gezin').doc(id), { beurten: { [na.soort]: FieldValue.increment(1) } }, { merge: true })));
    const gezinnen = (await kRef.collection('gezin').get()).docs.map(d => d.data());
    const gem = {};
    for (const s of L.BEURT_SOORTEN) gem[s] = gezinnen.length ? Math.round((gezinnen.reduce((n, g) => n + (Number(g.beurten?.[s]) || 0), 0) / gezinnen.length) * 10) / 10 : 0;
    await kRef.set({ beurtenGem: gem }, { merge: true });
  }
});

/* ---------- teamlink ---------- */
const kamerLinkInfo = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  await rateLimit(db, `kamerinfo-ip|${ipVan(request)}`, 30, 600);
  const code = String(request.data?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const l = code ? (await db.doc(`kamerLinks/${code}`).get()).data() : null;
  if (!l || l.ingetrokken || l.verlooptOp.toMillis() < Date.now() || l.gebruikt >= l.maxGebruik) return { geldig: false };
  const uit = { geldig: true, teamNaam: l.teamNaam || '', clubNaam: l.clubNaam || '' };
  /* [20261116p] Wie al toegang heeft (of al wacht op de trainer) en de link opnieuw aantikt, hoort niet opnieuw het
     aanmeldformulier te krijgen. Alleen diegene krijgt het team erbij; voor ieder ander blijft het bij de twee namen. */
  if (request.auth && !isAnoniem(request)){
    const uid = request.auth.uid;
    if (await lidVan(db, l.teamId, uid)) return { ...uit, teamId: l.teamId, status: 'lid' };
    if ((await db.doc(`kamerAanvragen/${L.lidId(l.teamId, uid)}`).get()).exists) return { ...uit, teamId: l.teamId, status: 'wacht' };
  }
  return uit;
});
const maakKamerLink = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore(), teamId = String(request.data?.teamId || '');
  const x = await vereisCoach(db, request, teamId);
  vereisAan(x);
  const spiegel = db.doc(`teams/${teamId}/kamerBeheer/link`);
  const oud = (await spiegel.get()).data();
  if (oud?.code) await db.doc(`kamerLinks/${oud.code}`).set({ ingetrokken: true }, { merge: true });
  const code = nieuweCode(10), verlooptOp = Timestamp.fromMillis(Date.now() + 30 * DAG), maxGebruik = 40;
  await db.doc(`kamerLinks/${code}`).set({ teamId, club: x.team.club || null, teamNaam: x.team.naam || '',
    clubNaam: x.club?.naam || x.team.eigenClub?.naam || '', gemaaktDoor: request.auth.uid, gemaakt: FieldValue.serverTimestamp(),
    verlooptOp, maxGebruik, gebruikt: 0, ingetrokken: false });
  await spiegel.set({ code, verlooptOp, maxGebruik, gebruikt: 0 });
  await log(db, x.team.club, 'teamkamer_link_gemaakt', { door: request.auth.uid, teamId });
  return { code };
});

/* ---------- ouder: aanvragen, coach: beoordelen ---------- */
const vraagKamerToegang = onCall({ region: REGIO, cors: true }, async (request) => {
  vereisEcht(request);
  if (request.auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Bevestig eerst je e-mailadres.');
  const db = getFirestore(), uid = request.auth.uid;
  await rateLimit(db, `kamervraag|${uid}`, 6, 600);
  await rateLimit(db, `kamervraag-ip|${ipVan(request)}`, 30, 600);
  const code = String(request.data?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const kind = L.schoonKind(request.data?.kind);
  if (!code || !kind) throw new HttpsError('invalid-argument', 'Vul de voornaam van je kind in.');
  const lRef = db.doc(`kamerLinks/${code}`);
  const teamId = await db.runTransaction(async tx => {
    const l = (await tx.get(lRef)).data();
    if (!l || l.ingetrokken || l.verlooptOp.toMillis() < Date.now() || l.gebruikt >= l.maxGebruik)
      throw new HttpsError('not-found', 'Deze link werkt niet meer. Vraag de trainer om een nieuwe.');
    const aRef = db.doc(`kamerAanvragen/${L.lidId(l.teamId, uid)}`);
    const bestaat = (await tx.get(aRef)).exists;
    if (!bestaat) tx.update(lRef, { gebruikt: l.gebruikt + 1 });
    tx.set(aRef, { teamId: l.teamId, club: l.club || null, uid, email: request.auth.token.email || '', kind,
      gemaakt: FieldValue.serverTimestamp(), verlooptOp: Timestamp.fromMillis(Date.now() + 30 * DAG) });
    if (!bestaat) tx.set(db.doc(`teams/${l.teamId}/kamerBeheer/link`), { gebruikt: l.gebruikt + 1 }, { merge: true });
    return l.teamId;
  });
  return { status: 'wacht', teamId };
});
const beoordeelKamerAanvraag = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore(), id = String(request.data?.id || '');
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', 'Aanvraag ontbreekt.');
  const aRef = db.doc(`kamerAanvragen/${id}`), a = (await aRef.get()).data();
  if (!a) throw new HttpsError('not-found', 'Deze aanvraag bestaat niet meer.');
  const x = await vereisCoach(db, request, a.teamId);
  if (request.data?.goed !== true){
    await aRef.delete();
    await log(db, a.club, 'teamkamer_afgewezen', { door: request.auth.uid, uid: a.uid, teamId: a.teamId });
    return { ok: true };
  }
  vereisAan(x);
  const spelerId = String(request.data?.spelerId || '');
  const speler = spelerId && !spelerId.includes('/') ? (await db.doc(`teams/${a.teamId}/spelers/${spelerId}`).get()).data() : null;
  if (!L.spelerActief(speler)) throw new HttpsError('invalid-argument', 'Kies de speler bij wie deze ouder hoort.');
  const lRef = lidRef(db, a.teamId, a.uid);
  const volwassenen = (await ledenVanTeam(db, a.teamId)).filter(d => d.id !== lRef.id && d.data().rol === 'ouder' && (d.data().spelerIds || []).includes(spelerId));
  if (volwassenen.length >= L.MAX_VOLWASSENEN) throw new HttpsError('failed-precondition', `Bij deze speler kijken al ${L.MAX_VOLWASSENEN} volwassenen mee.`);
  await lRef.set({ teamId: a.teamId, club: a.club || null, uid: a.uid, email: a.email || '', rol: 'ouder', spelerIds: FieldValue.arrayUnion(spelerId),
    sinds: FieldValue.serverTimestamp(), vervaltOp: Timestamp.fromMillis(L.seizoenEindeMs(L.vandaagNL())), door: request.auth.uid }, { merge: true });
  await wijzerRef(db, a.teamId, a.uid).set({ teamId: a.teamId, rol: 'ouder' }, { merge: true });
  await aRef.delete();
  await log(db, a.club, 'teamkamer_goedgekeurd', { door: request.auth.uid, uid: a.uid, teamId: a.teamId });
  /* mail zonder namen van spelers */
  if (a.email){
    try {
      await require('./mail-teksten').verstuur(db, 'teamkamer', a.email, { team: x.team.naam || 'het team' }, { vast: { knopUrl: APP_URL } });
    } catch (e){ logger.warn('[teamkamer] mail mislukt', e.message || e); }
  }
  return { ok: true };
});
const trekKamerToegangIn = onCall({ region: REGIO, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const db = getFirestore(), teamId = String(request.data?.teamId || ''), uid = request.auth.uid;
  const doel = String(request.data?.uid || uid);
  if (!teamId || teamId.includes('/') || doel.includes('/')) throw new HttpsError('invalid-argument', 'Team ontbreekt.');
  const ref = lidRef(db, teamId, doel), lid = (await ref.get()).data();
  if (!lid) return { ok: true };
  let mag = doel === uid || (lid.rol === 'speler' && lid.door === uid);
  if (!mag && !isAnoniem(request)){ const x = await laad(db, teamId); mag = magBeheren(x.team, x.club, uid, teamId); }
  if (!mag) throw new HttpsError('permission-denied', 'Dat mag je niet.');
  await ref.delete();
  await wijzerRef(db, teamId, doel).delete().catch(() => {});
  await log(db, lid.club, 'teamkamer_ingetrokken', { door: uid, uid: doel, teamId });
  return { ok: true };
});

/* ---------- speler: code van de ouder ---------- */
const maakKindCode = onCall({ region: REGIO, cors: true }, async (request) => {
  vereisEcht(request);
  const db = getFirestore(), uid = request.auth.uid, teamId = String(request.data?.teamId || ''), spelerId = String(request.data?.spelerId || '');
  await rateLimit(db, `kindcode|${uid}`, 10, 3600);
  const lid = teamId && !teamId.includes('/') ? await lidVan(db, teamId, uid) : null;
  if (!lid || lid.rol !== 'ouder' || !(lid.spelerIds || []).includes(spelerId)) throw new HttpsError('permission-denied', 'Je kunt alleen een code maken voor je eigen kind.');
  const kamer = await kamerAan(db, teamId);
  if (!kamer) throw new HttpsError('failed-precondition', 'De teamkamer staat uit.');
  if (kamer.mag?.spelers !== true) throw new HttpsError('failed-precondition', 'Toegang voor spelers staat niet aan voor dit team.');
  const code = nieuweCode(6);
  await db.doc(`kindCodes/${code}`).set({ teamId, club: lid.club || null, spelerId, door: uid, gebruikt: false,
    vervaltOp: Timestamp.fromMillis(Date.now() + L.KINDCODE_MINUTEN * 60000) });
  await log(db, lid.club, 'teamkamer_kindcode', { door: uid, teamId });
  return { code, minuten: L.KINDCODE_MINUTEN };
});
const wisselKindCode = onCall({ region: REGIO, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const db = getFirestore(), uid = request.auth.uid;
  await rateLimit(db, `kindwissel|${uid}`, 8, 600);
  await rateLimit(db, `kindwissel-ip|${ipVan(request)}`, 20, 600);
  const code = String(request.data?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length !== 6) throw new HttpsError('invalid-argument', 'De code heeft 6 tekens.');
  const cRef = db.doc(`kindCodes/${code}`);
  const fout = () => new HttpsError('not-found', 'Deze code klopt niet of is verlopen. Vraag je ouder om een nieuwe.');
  const c0 = (await cRef.get()).data();
  if (!c0 || c0.gebruikt || c0.vervaltOp.toMillis() < Date.now()) throw fout();
  if (!(await lidVan(db, c0.teamId, c0.door))) throw fout();                    /* de ouder kijkt zelf niet meer mee */
  if ((await kamerAan(db, c0.teamId))?.mag?.spelers !== true) throw fout();      /* toegang voor spelers staat uit */
  const eigen = await lidVan(db, c0.teamId, uid);
  if (eigen && eigen.rol === 'ouder') throw new HttpsError('failed-precondition', 'Deze code is voor je kind. Jij kijkt al mee als ouder.');
  const toestellen = (await ledenVanTeam(db, c0.teamId)).filter(d => d.data().rol === 'speler' && d.data().uid !== uid && (d.data().spelerIds || []).includes(c0.spelerId));
  if (toestellen.length >= L.MAX_TOESTELLEN) throw new HttpsError('failed-precondition', 'Deze speler is al op 3 toestellen ingelogd. Je ouder kan er een weghalen.');
  await db.runTransaction(async tx => {
    const c = (await tx.get(cRef)).data();
    if (!c || c.gebruikt || c.vervaltOp.toMillis() < Date.now()) throw fout();
    tx.update(cRef, { gebruikt: true });
    tx.set(lidRef(db, c.teamId, uid), { teamId: c.teamId, club: c.club || null, uid, rol: 'speler', spelerIds: [c.spelerId],
      door: c.door, sinds: FieldValue.serverTimestamp(), vervaltOp: Timestamp.fromMillis(L.seizoenEindeMs(L.vandaagNL())) });
  });
  return { teamId: c0.teamId };
});

/* ouder: de toegang van het eigen kind stoppen, op alle toestellen */
const stopKindToegang = onCall({ region: REGIO, cors: true }, async (request) => {
  vereisEcht(request);
  const db = getFirestore(), uid = request.auth.uid, teamId = String(request.data?.teamId || ''), spelerId = String(request.data?.spelerId || '');
  const lid = teamId && !teamId.includes('/') ? await lidVan(db, teamId, uid) : null;
  if (!lid || lid.rol !== 'ouder' || !(lid.spelerIds || []).includes(spelerId)) throw new HttpsError('permission-denied', 'Dit kan alleen voor je eigen kind.');
  const weg = (await ledenVanTeam(db, teamId)).filter(d => d.data().rol === 'speler' && (d.data().spelerIds || []).includes(spelerId));
  await schrijfInDelen(db, weg.map(d => (b) => b.delete(d.ref)));
  await verwijderCodes(db, teamId, spelerId);
  await log(db, lid.club, 'teamkamer_kind_gestopt', { door: uid, teamId });
  return { aantal: weg.length };
});
async function verwijderCodes(db, teamId, spelerId){
  const codes = await db.collection('kindCodes').where('teamId', '==', teamId).get();
  await schrijfInDelen(db, codes.docs.filter(d => d.data().spelerId === spelerId).map(d => (b) => b.delete(d.ref)));
}

/* ---------- ouder: eigen kind verbergen voor andere gezinnen ---------- */
const kamerVerberg = onCall({ region: REGIO, cors: true }, async (request) => {
  vereisEcht(request);
  const db = getFirestore(), uid = request.auth.uid, teamId = String(request.data?.teamId || ''), spelerId = String(request.data?.spelerId || '');
  const lid = teamId && !teamId.includes('/') ? await lidVan(db, teamId, uid) : null;
  if (!lid || lid.rol !== 'ouder' || !(lid.spelerIds || []).includes(spelerId)) throw new HttpsError('permission-denied', 'Dit kan alleen voor je eigen kind.');
  await db.doc(`teams/${teamId}/kamerBeheer/verborgen`).set({ [spelerId]: request.data?.verborgen === true }, { merge: true });
  await bouwKamer(db, teamId, { agenda: false });
  return { ok: true };
});
/* coach: alle toegang van het team verlengen tot het einde van het (nieuwe) seizoen */
const kamerVerleng = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore(), teamId = String(request.data?.teamId || '');
  const x = await vereisCoach(db, request, teamId);
  vereisAan(x);
  const tot = Timestamp.fromMillis(L.seizoenEindeMs(L.vandaagNL()));
  const leden = await ledenVanTeam(db, teamId);
  await schrijfInDelen(db, leden.map(d => (b) => b.update(d.ref, { vervaltOp: tot })));
  return { aantal: leden.length };
});
/* coach: kopie nu opnieuw opbouwen (knop "Ververs" in het beheerscherm, en na het aanzetten) */
const kamerVervers = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore(), teamId = String(request.data?.teamId || '');
  await vereisCoach(db, request, teamId);
  return bouwKamer(db, teamId);
});

/* ---------- elke nacht: venster opschuiven, polls sluiten, verlopen toegang weg ---------- */
async function nacht(db){
  const uit = { kamers: 0, pollsGesloten: 0, weg: 0 }, nu = Timestamp.now();
  const kamers = await db.collection('teamkamer').get();
  for (const k of kamers.docs){
    try {
      if (k.data().aan === true){
        await bouwKamer(db, k.id); uit.kamers++;
        const open = await k.ref.collection('polls').where('status', '==', 'open').get();
        for (const p of open.docs){
          const s = p.data().sluitOp;
          if (s && s.toMillis() <= nu.toMillis()){ await p.ref.update({ status: 'gesloten' }); uit.pollsGesloten++; }
        }
      }
      /* verlopen toegang weg (ook als de teamkamer uit staat) */
      const oud = await k.ref.collection('kamerleden').where('vervaltOp', '<', nu).get();
      await schrijfInDelen(db, oud.docs.map(d => (b) => { b.delete(d.ref); b.delete(wijzerRef(db, k.id, d.id)); }));
      uit.weg += oud.size;
    } catch (e){ logger.warn('[kamerNacht] team ' + k.id, e.message || e); }
  }
  const { verwijderQuery } = require('./avg');
  uit.weg += await verwijderQuery(db.collection('kindCodes').where('vervaltOp', '<', Timestamp.fromMillis(nu.toMillis() - DAG)));
  uit.weg += await verwijderQuery(db.collection('kamerAanvragen').where('verlooptOp', '<', nu));
  uit.weg += await verwijderQuery(db.collection('kamerLinks').where('verlooptOp', '<', Timestamp.fromMillis(nu.toMillis() - 30 * DAG)));
  return uit;
}
const kamerNacht = onSchedule({ schedule: '10 4 * * *', timeZone: 'Europe/Amsterdam', region: REGIO, timeoutSeconds: 540 }, async () => {
  logger.info('[kamerNacht]', JSON.stringify(await nacht(getFirestore())));
});

/* alles van één account weg (verwijderMijnAccount): eigen toegang, aanvragen en de toegang van kinderen die via dit account binnenkwamen */
async function verwijderUid(db, uid){
  const { verwijderQuery } = require('./avg');
  const wijzers = await db.collection(`gebruikers/${uid}/kamers`).get();
  for (const w of wijzers.docs){
    await lidRef(db, w.id, uid).delete().catch(() => {});
    await verwijderQuery(db.collection(`teamkamer/${w.id}/kamerleden`).where('door', '==', uid).where('rol', '==', 'speler'));
  }
  await verwijderQuery(db.collection('kamerAanvragen').where('uid', '==', uid));
  await verwijderQuery(db.collection('kindCodes').where('door', '==', uid));
}
async function exportUid(db, uid){
  const wijzers = await db.collection(`gebruikers/${uid}/kamers`).get(), uit = [];
  for (const w of wijzers.docs){
    const d = (await lidRef(db, w.id, uid).get()).data();
    if (d) uit.push({ teamId: w.id, rol: d.rol, spelers: (d.spelerIds || []).length, sinds: d.sinds || null, tot: d.vervaltOp || null });
  }
  return uit;
}

module.exports = {
  functies: { kamerAanlevering, kamerActiviteit, kamerTeam, kamerClub, kamerPlatform, kamerSpeler, kamerWedstrijd, kamerPresentie, kamerStem, kamerPoll, kamerLinkInfo, maakKamerLink, vraagKamerToegang,
    beoordeelKamerAanvraag, trekKamerToegangIn, maakKindCode, wisselKindCode, stopKindToegang, kamerVerberg, kamerVerleng, kamerVervers, kamerNacht },
  bouwKamer, telPoll, nacht, magBeheren, verwijderUid, exportUid,
};
