/* ====================================================================
   TOEGANG & ONBOARDING — uitnodigingen, aanvragen met goedkeuring, rollen,
   toegangslog, uitschrijven, kennisname privacyregels, rate limiting.

   Collecties (top-level, alleen via deze functions beschreven):
     uitnodigingen/{id}   { clubId, teamId?, teamNaam?, code, gemaaktDoor, gemaaktDoorNaam, gemaakt,
                            verlooptOp, maxGebruik, gebruikt, ingetrokken }
     aanvragen/{clubId_uid} { clubId, uid, naam, teamId?, teamNaam?, via, uitnodigingId?, gemaakt }
     toegangslog/{auto}   { clubId, gebeurtenis, uid, naam, door, doorNaam, teamId?, details, tijd }
     privacyKennisname/{uid} { versie, tijd }
     rateLimit/{sleutel}  { n, tot }
   Clubinstelling: clubs/{id}.instellingen.toegang =
     { goedkeuring (default true), standaardRol ('assistent'|'coach', default 'assistent'),
       vasteCodes (default true: oude team-/clubcodes blijven werken) }
   Teamrol: teams/{id}.rollen[uid] = 'assistent' | 'coach' (ontbreekt = coach, zoals oude data).
==================================================================== */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const crypto = require('crypto');
const { schoonNaam, verwijderQuery } = require('./avg');

const REGIO = 'europe-west1';
const PRIVACY_VERSIE = '2026-10';
const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';      // geen 0/O/1/I/L
const DAG = 86400000;

const nieuweCode = (n = 10) => Array.from(crypto.randomBytes(n), b => ALFABET[b % ALFABET.length]).join('');

/* ---------- rate limiting (per sleutel, vaste venster) ---------- */
async function rateLimit(db, sleutel, max, vensterSec){
  const id = crypto.createHash('sha256').update(sleutel).digest('hex').slice(0, 40);
  const ref = db.doc(`rateLimit/${id}`);
  await db.runTransaction(async tx => {
    const nu = Date.now(), d = (await tx.get(ref)).data();
    if (d && d.tot > nu){
      if (d.n >= max) throw new HttpsError('resource-exhausted', 'Te veel pogingen. Probeer het later opnieuw.');
      tx.update(ref, { n: d.n + 1 });
    } else {
      tx.set(ref, { n: 1, tot: nu + vensterSec * 1000 });
    }
  });
}
const ipVan = (request) => request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || request.rawRequest?.ip || 'onbekend';

/* ---------- hulpfuncties ---------- */
const clubRef = (db, c) => db.doc(`clubs/${c}`);
const toegangInst = (club) => {
  const t = club?.instellingen?.toegang || {};
  return {
    goedkeuring: t.goedkeuring !== false,
    standaardRol: t.standaardRol === 'coach' ? 'coach' : 'assistent',
    vasteCodes: t.vasteCodes !== false,
  };
};
async function log(db, clubId, gebeurtenis, o = {}){
  await db.collection('toegangslog').add({
    clubId, gebeurtenis, uid: o.uid || null, naam: o.naam || null, door: o.door || null, doorNaam: o.doorNaam || null,
    teamId: o.teamId || null, details: o.details || null, tijd: FieldValue.serverTimestamp(),
  });
}
function vereisIngelogd(request){
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  if (request.auth.token.firebase?.sign_in_provider === 'anonymous')
    throw new HttpsError('permission-denied', 'Dit kan alleen met een coach-account.');
}
async function naamVan(db, clubId, uid){
  const c = (await clubRef(db, clubId).get()).data() || {};
  return c.ledenInfo?.[uid]?.naam || c.adminsInfo?.[uid]?.naam || null;
}
const isClubAdminDoc = (club, uid) => !!club?.admins?.[uid];
const isVolCoach = (team, uid) => team?.leden?.[uid] === true && (team.rollen?.[uid] || 'coach') !== 'assistent';

/* wie mag uitnodigen/beoordelen voor deze club(+team)? club-admin, of volledige coach van het team */
async function vereisBeheerVan(db, request, clubId, teamId){
  vereisIngelogd(request);
  const uid = request.auth.uid;
  const club = (await clubRef(db, clubId).get()).data();
  if (!club) throw new HttpsError('not-found', 'Club bestaat niet.');
  if (isClubAdminDoc(club, uid)) return { club, rol: 'club_admin' };
  if (teamId){
    const t = (await db.doc(`teams/${teamId}`).get()).data();
    if (t && t.club === clubId && isVolCoach(t, uid)) return { club, rol: 'coach', team: t };
  }
  throw new HttpsError('permission-denied', 'Alleen clubbeheerders of coaches van dit team mogen dit.');
}

/* lidmaatschap daadwerkelijk toepassen */
async function pasLidmaatschapToe(db, { clubId, teamId, uid, naam, rol }){
  const info = { naam };
  if (teamId){
    await db.doc(`teams/${teamId}`).update({
      [`leden.${uid}`]: true, [`ledenInfo.${uid}`]: info, [`rollen.${uid}`]: rol,
    });
  }
  if (clubId){
    await clubRef(db, clubId).update({ [`leden.${uid}`]: true, [`ledenInfo.${uid}`]: info });
  }
}

/* ---------- uitnodigingInfo (openbaar, beperkt) ---------- */
exports.uitnodigingInfo = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  await rateLimit(db, `info|${ipVan(request)}`, 30, 600);
  const code = String(request.data?.code || request.data?.teamCode || '').trim().toUpperCase().slice(0, 40);
  if (code.length < 4) throw new HttpsError('not-found', 'Onbekende code.');

  const u = await db.collection('uitnodigingen').where('code', '==', code).limit(1).get();
  if (!u.empty){
    const d = u.docs[0].data();
    if (d.ingetrokken || d.verlooptOp.toMillis() < Date.now() || d.gebruikt >= d.maxGebruik)
      throw new HttpsError('not-found', 'Uitnodiging niet meer geldig.');
    const club = (await clubRef(db, d.clubId).get()).data() || {};
    return { naam: d.teamNaam || club.naam || '', clubNaam: club.naam || '' };
  }
  const t = await db.collection('teams').where('code', '==', code).limit(1).get();
  if (!t.empty){
    const td = t.docs[0].data();
    if (td.club){
      const club = (await clubRef(db, td.club).get()).data() || {};
      if (!toegangInst(club).vasteCodes) throw new HttpsError('not-found', 'Onbekende code.');
    }
    return { naam: td.naam || '', clubNaam: td.clubNaam || '' };
  }
  throw new HttpsError('not-found', 'Onbekende code.');
});

/* ---------- uitnodiging maken / intrekken ---------- */
exports.maakUitnodiging = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  const clubId = String(request.data?.clubId || '');
  const teamId = request.data?.teamId ? String(request.data.teamId) : null;
  const { club, team } = await vereisBeheerVan(db, request, clubId, teamId);
  if (!teamId && !isClubAdminDoc(club, request.auth.uid)) throw new HttpsError('permission-denied', 'Alleen een clubbeheerder.');
  const geldigDagen = Math.min(60, Math.max(1, Number(request.data?.geldigDagen) || 14));
  const maxGebruik = Math.min(50, Math.max(1, Number(request.data?.maxGebruik) || 5));
  const teamDoc = teamId ? (team || (await db.doc(`teams/${teamId}`).get()).data()) : null;
  if (teamId && (!teamDoc || teamDoc.club !== clubId)) throw new HttpsError('not-found', 'Team niet gevonden in deze club.');
  const door = request.auth.uid;
  const doorNaam = await naamVan(db, clubId, door);
  const code = nieuweCode();
  const ref = await db.collection('uitnodigingen').add({
    clubId, teamId, teamNaam: teamDoc?.naam || null, code, gemaaktDoor: door, gemaaktDoorNaam: doorNaam,
    gemaakt: FieldValue.serverTimestamp(), verlooptOp: Timestamp.fromMillis(Date.now() + geldigDagen * DAG),
    maxGebruik, gebruikt: 0, ingetrokken: false,
  });
  await log(db, clubId, 'uitnodiging_gemaakt', { door, doorNaam, teamId, details: `${geldigDagen} dagen, max ${maxGebruik}x` });
  return { id: ref.id, code, geldigDagen, maxGebruik };
});

exports.trekUitnodigingIn = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  const ref = db.doc(`uitnodigingen/${String(request.data?.id || '')}`);
  const d = (await ref.get()).data();
  if (!d) throw new HttpsError('not-found', 'Uitnodiging bestaat niet.');
  await vereisBeheerVan(db, request, d.clubId, d.teamId);
  await ref.update({ ingetrokken: true });
  await log(db, d.clubId, 'uitnodiging_ingetrokken', { door: request.auth.uid, doorNaam: await naamVan(db, d.clubId, request.auth.uid), teamId: d.teamId });
  return { ok: true };
});

/* ---------- aansluiten ---------- */
exports.sluitAan = onCall({ region: REGIO, cors: true }, async (request) => {
  vereisIngelogd(request);
  const db = getFirestore(), uid = request.auth.uid;
  await rateLimit(db, `aansluiten|${uid}`, 10, 600);
  await rateLimit(db, `aansluiten-ip|${ipVan(request)}`, 40, 600);
  const naam = schoonNaam(request.data?.naam);
  const code = String(request.data?.code || request.data?.teamCode || request.data?.clubCode || '').trim().toUpperCase().slice(0, 40);
  const clubIdHerstel = String(request.data?.clubId || '').trim();

  /* zelfherstel (bestaande coach mist club-vermelding): geen goedkeuring nodig */
  if (!code && clubIdHerstel){
    const t = await db.collection('teams').where('club', '==', clubIdHerstel).where(`leden.${uid}`, '==', true).limit(1).get();
    if (t.empty) throw new HttpsError('permission-denied', 'Je bent geen coach in deze club.');
    await clubRef(db, clubIdHerstel).update({ [`leden.${uid}`]: true, [`ledenInfo.${uid}`]: { naam } });
    return { status: 'lid', clubId: clubIdHerstel };
  }
  if (code.length < 4) throw new HttpsError('not-found', 'Onbekende code.');

  /* e-mailaccounts moeten geverifieerd zijn (Google-accounts zijn dat altijd) */
  if (request.auth.token.email_verified !== true)
    throw new HttpsError('failed-precondition', 'Bevestig eerst je e-mailadres (kijk in je mail) en probeer het opnieuw.');

  /* 1. code opzoeken: uitnodiging → oude teamcode → oude clubcode */
  let doel = null, uitnodigingRef = null, via = 'uitnodiging';
  const u = await db.collection('uitnodigingen').where('code', '==', code).limit(1).get();
  if (!u.empty){
    const d = u.docs[0].data();
    if (d.ingetrokken || d.verlooptOp.toMillis() < Date.now() || d.gebruikt >= d.maxGebruik)
      throw new HttpsError('not-found', 'Deze uitnodiging is verlopen of ingetrokken. Vraag een nieuwe aan.');
    uitnodigingRef = u.docs[0].ref;
    doel = { clubId: d.clubId, teamId: d.teamId || null };
  } else {
    const t = await db.collection('teams').where('code', '==', code).limit(1).get();
    if (!t.empty){
      doel = { clubId: t.docs[0].data().club || null, teamId: t.docs[0].id }; via = 'teamcode';
    } else {
      const c = await db.collection('clubs').where('code', '==', code).limit(1).get();
      if (!c.empty){ doel = { clubId: c.docs[0].id, teamId: null }; via = 'clubcode'; }
    }
  }
  if (!doel) throw new HttpsError('not-found', 'Onbekende code.');

  const club = doel.clubId ? (await clubRef(db, doel.clubId).get()).data() : null;
  const inst = toegangInst(club);
  if (via !== 'uitnodiging' && club && !inst.vasteCodes)
    throw new HttpsError('not-found', 'Deze club gebruikt alleen persoonlijke uitnodigingen. Vraag een uitnodiging aan.');

  const teamDoc = doel.teamId ? (await db.doc(`teams/${doel.teamId}`).get()).data() : null;
  const clubNaam = club?.naam || teamDoc?.clubNaam || '';
  const teamNaam = teamDoc?.naam || '';

  /* al lid? */
  if ((doel.teamId && teamDoc?.leden?.[uid]) || (!doel.teamId && club?.leden?.[uid]))
    return { status: 'lid', teamId: doel.teamId, club: doel.clubId, clubNaam, naam: teamNaam };

  if (uitnodigingRef) await uitnodigingRef.update({ gebruikt: FieldValue.increment(1) });

  /* team zonder club (privé team): oud gedrag, direct lid */
  if (!doel.clubId){
    await pasLidmaatschapToe(db, { clubId: null, teamId: doel.teamId, uid, naam, rol: 'coach' });
    return { status: 'lid', teamId: doel.teamId, club: null, clubNaam: '', naam: teamNaam };
  }

  if (inst.goedkeuring){
    await db.doc(`aanvragen/${doel.clubId}_${uid}`).set({
      clubId: doel.clubId, uid, naam, teamId: doel.teamId, teamNaam, via,
      uitnodigingId: uitnodigingRef?.id || null, gemaakt: FieldValue.serverTimestamp(),
    });
    await log(db, doel.clubId, 'aanvraag', { uid, naam, teamId: doel.teamId, details: via });
    return { status: 'aanvraag', teamId: doel.teamId, club: doel.clubId, clubNaam, naam: teamNaam };
  }

  await pasLidmaatschapToe(db, { clubId: doel.clubId, teamId: doel.teamId, uid, naam, rol: inst.standaardRol });
  await log(db, doel.clubId, 'aangesloten', { uid, naam, teamId: doel.teamId, details: `${via}, rol ${inst.standaardRol}` });
  return { status: 'lid', teamId: doel.teamId, club: doel.clubId, clubNaam, naam: teamNaam, rol: inst.standaardRol };
});

/* ---------- aanvraag beoordelen ---------- */
exports.beoordeelAanvraag = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  const clubId = String(request.data?.clubId || ''), uid = String(request.data?.uid || '');
  const ref = db.doc(`aanvragen/${clubId}_${uid}`);
  const a = (await ref.get()).data();
  if (!a) throw new HttpsError('not-found', 'Aanvraag bestaat niet (meer).');
  const { club } = await vereisBeheerVan(db, request, clubId, a.teamId);
  const door = request.auth.uid, doorNaam = await naamVan(db, clubId, door);
  if (request.data?.besluit === 'goed'){
    const rol = request.data?.rol === 'coach' ? 'coach' : (request.data?.rol === 'assistent' ? 'assistent' : toegangInst(club).standaardRol);
    await pasLidmaatschapToe(db, { clubId, teamId: a.teamId, uid, naam: a.naam, rol });
    await ref.delete();
    await log(db, clubId, 'goedgekeurd', { uid, naam: a.naam, door, doorNaam, teamId: a.teamId, details: `rol ${rol}` });
    return { ok: true, rol };
  }
  await ref.delete();
  await log(db, clubId, 'afgewezen', { uid, naam: a.naam, door, doorNaam, teamId: a.teamId });
  return { ok: true };
});

/* ---------- rol wijzigen / lid verwijderen ---------- */
exports.wijzigRol = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  const clubId = String(request.data?.clubId || ''), teamId = String(request.data?.teamId || ''), uid = String(request.data?.uid || '');
  const rol = request.data?.rol === 'coach' ? 'coach' : 'assistent';
  await vereisBeheerVan(db, request, clubId, teamId);
  const t = (await db.doc(`teams/${teamId}`).get()).data();
  if (!t || t.club !== clubId || !t.leden?.[uid]) throw new HttpsError('not-found', 'Geen lid van dit team.');
  await db.doc(`teams/${teamId}`).update({ [`rollen.${uid}`]: rol });
  await log(db, clubId, 'rol_gewijzigd', { uid, naam: t.ledenInfo?.[uid]?.naam, door: request.auth.uid, doorNaam: await naamVan(db, clubId, request.auth.uid), teamId, details: rol });
  return { ok: true };
});

/* verwijdert een uid uit teams (van deze club of alle) en uit de club(s) */
async function verwijderUidUitClubs(db, uid, clubId = null){
  const del = FieldValue.delete();
  let teamsQ = db.collection('teams').where(`leden.${uid}`, '==', true);
  if (clubId) teamsQ = teamsQ.where('club', '==', clubId);
  for (const d of (await teamsQ.get()).docs)
    await d.ref.update({ [`leden.${uid}`]: del, [`ledenInfo.${uid}`]: del, [`rollen.${uid}`]: del });

  const ids = new Set();
  if (clubId) ids.add(clubId);
  else {
    for (const k of ['leden', 'admins'])
      (await db.collection('clubs').where(`${k}.${uid}`, '==', true).get()).docs.forEach(d => ids.add(d.id));
    (await db.collection('clubs').where('eigenBouwCoaches', 'array-contains', uid).get()).docs.forEach(d => ids.add(d.id));
  }
  for (const id of ids){
    const ref = clubRef(db, id), c = (await ref.get()).data() || {};
    const upd = { [`leden.${uid}`]: del, [`ledenInfo.${uid}`]: del, [`admins.${uid}`]: del, [`adminsInfo.${uid}`]: del, [`bouwCoordinatorenInfo.${uid}`]: del };
    for (const bouw of Object.keys(c.bouwCoordinatoren || {})) upd[`bouwCoordinatoren.${bouw}.${uid}`] = del;
    if (Array.isArray(c.eigenBouwCoaches)) upd.eigenBouwCoaches = FieldValue.arrayRemove(uid);
    await ref.update(upd);
  }
}
async function verwijderUidUitAlles(db, uid){ await verwijderUidUitClubs(db, uid, null); }

exports.verwijderLid = onCall({ region: REGIO, cors: true }, async (request) => {
  const db = getFirestore();
  const clubId = String(request.data?.clubId || ''), uid = String(request.data?.uid || '');
  vereisIngelogd(request);
  const club = (await clubRef(db, clubId).get()).data();
  if (!club) throw new HttpsError('not-found', 'Club bestaat niet.');
  if (!isClubAdminDoc(club, request.auth.uid)) throw new HttpsError('permission-denied', 'Alleen een clubbeheerder.');
  if (club.admins?.[uid] && Object.keys(club.admins).length <= 1) throw new HttpsError('failed-precondition', 'Dit is de enige beheerder van de club.');
  const naam = club.ledenInfo?.[uid]?.naam || club.adminsInfo?.[uid]?.naam || null;
  await verwijderUidUitClubs(db, uid, clubId);
  await log(db, clubId, 'verwijderd', { uid, naam, door: request.auth.uid, doorNaam: await naamVan(db, clubId, request.auth.uid) });
  return { ok: true };
});

/* ---------- kennisname privacyregels ---------- */
exports.bevestigPrivacy = onCall({ region: REGIO, cors: true }, async (request) => {
  vereisIngelogd(request);
  try {
    await getFirestore().doc(`privacyKennisname/${request.auth.uid}`).set({ versie: PRIVACY_VERSIE, tijd: FieldValue.serverTimestamp() });
  } catch (e) {
    /* zonder dit ziet de gebruiker alleen "internal"; nu staat de echte oorzaak in de Functions-logs */
    logger.error('bevestigPrivacy mislukt', { code: e.code, message: e.message });
    throw new HttpsError('failed-precondition', 'Opslaan mislukt (' + (e.code || e.message || 'onbekend') + '). Controleer of de database (Firestore) bestaat en of de functions opnieuw zijn gedeployed.');
  }
  return { versie: PRIVACY_VERSIE };
});

/* ---------- voorstel: inactieve leden (alleen lezen, voor de beheerder) ---------- */
exports.PRIVACY_VERSIE = PRIVACY_VERSIE;
module.exports.verwijderUidUitAlles = verwijderUidUitAlles;
module.exports.rateLimit = rateLimit;
