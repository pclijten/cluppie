/* ==================== SPELER OVERZETTEN (alles-of-niets) ====================
   [20261011h] Definitief overzetten (na uitlening) en de seizoensovergang schreven eerst vanuit
   de app, in 4 à 6 losse stappen. Viel de verbinding halverwege weg, dan stond een speler half
   over: dossier wel, spelerdocument niet, of het origineel nog niet gearchiveerd.
   Nu doet de app alleen het lezen en rekenen (het bevroren dossier, zie teams-spelers.js) en
   schrijft deze functie alles in één Firestore-transactie:
     1. eerdere dossiers van de speler (keten A→B→C) naar het nieuwe team
     2. het nieuwe dossier  teams/{naar}/spelers/{id}/vorigeTeams/{van}_{datum}
     3. het spelerdocument bij het nieuwe team (kopie van het origineel, gelezen door de server)
     4. het origineel archiveren (niet verwijderen)
     5. bij een uitlening: het leen-record opruimen
   Lukt één stap niet, dan gebeurt er niets. Opnieuw aanroepen is veilig: een speler die al is
   overgezet naar hetzelfde team wordt herkend (alGedaan).

   Rechten (gelijk aan de Firestore-rules + de knoppen in de app):
     • uitleen: clubbeheerder, of bouwcoördinator van het ontvangende team
     • seizoen: mag schrijven in het bronteam én (als er een doelteam is) in het doelteam
       (volwaardige coach van het team, clubbeheerder of coördinator van de bouw).
   Beide teams moeten bij de club van de aanroep horen.

   AVG: de functie logt geen namen; het dossier bevat alleen gegevens van deze ene speler. */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DOSSIER = 900 * 1024;           // Firestore-limiet per document is 1 MiB
const MAX_STINTEN = 200;

const vandaagIso = () => new Date().toISOString().slice(0, 10);

/* ---------- controle van de aanvraag (los te testen) ---------- */
function controleer(d = {}){
  const fout = t => ({ fout: t });
  const soort = d.soort === 'uitleen' ? 'uitleen' : d.soort === 'seizoen' ? 'seizoen' : null;
  if (!soort) return fout('Onbekende soort overzetting.');
  for (const k of ['clubId', 'vanTeam', 'spelerId']) if (!ID.test(String(d[k] || ''))) return fout(`${k} ontbreekt of is ongeldig.`);
  const naarTeam = d.naarTeam == null || d.naarTeam === '' ? null : String(d.naarTeam);
  if (naarTeam !== null && !ID.test(naarTeam)) return fout('naarTeam is ongeldig.');
  if (naarTeam === d.vanTeam) return fout('Bron- en doelteam zijn hetzelfde.');
  if (soort === 'uitleen' && (!naarTeam || !ID.test(String(d.uitleenId || '')))) return fout('Uitlening ontbreekt.');
  const datum = DATUM.test(String(d.datum || '')) ? String(d.datum) : null;
  if (!datum) return fout('Datum ontbreekt.');
  const mee = Object.fromEntries(['wed', 'beo', 'tr', 'lp', 'not'].map(k => [k, d.mee?.[k] !== false]));
  let dossier = null;
  if (naarTeam){
    if (!d.dossier || typeof d.dossier !== 'object' || Array.isArray(d.dossier)) return fout('Dossier ontbreekt.');
    if (Buffer.byteLength(JSON.stringify(d.dossier)) > MAX_DOSSIER) return fout('Dossier is te groot.');
    if (d.dossier.spelerId !== d.spelerId || d.dossier.teamId !== d.vanTeam) return fout('Dossier hoort niet bij deze speler.');
    dossier = herstelTijden(d.dossier);
  }
  return { data: {
    soort, clubId: d.clubId, vanTeam: d.vanTeam, spelerId: d.spelerId, naarTeam,
    naarTeamNaam: typeof d.naarTeamNaam === 'string' ? d.naarTeamNaam.slice(0, 120) : null,
    uitleenId: soort === 'uitleen' ? String(d.uitleenId) : null, datum, mee, dossier,
  } };
}

/* Een Firestore-Timestamp komt via een callable binnen als { seconds, nanoseconds }:
   terugzetten, zodat het dossier hetzelfde blijft als toen de app het zelf schreef. */
function herstelTijden(v){
  if (Array.isArray(v)) return v.map(herstelTijden);
  if (v && typeof v === 'object'){
    const k = Object.keys(v).filter(x => x !== 'type');
    if (k.length === 2 && Number.isFinite(v.seconds) && Number.isFinite(v.nanoseconds)) return new Timestamp(v.seconds, v.nanoseconds);
    const uit = {};
    for (const [x, y] of Object.entries(v)) if (y !== undefined) uit[x] = herstelTijden(y);
    return uit;
  }
  return v;
}

/* ---------- rechten ---------- */
const isAdmin = (club, uid) => !!club.admins?.[uid];
const isCoordVan = (club, bouw, uid) => !!(bouw && club.bouwCoordinatoren?.[bouw]?.[uid]);
function magSchrijven(team, club, uid){
  if (team.leden?.[uid] === true && (team.rollen?.[uid] || 'coach') !== 'assistent') return true;
  return isAdmin(club, uid) || isCoordVan(club, team.bouw, uid);
}

/* Spelerdocument voor het nieuwe team: kopie van het origineel, overlay van de uitlening als nieuwe
   basiswaarde, gast- en archiefvelden weg. Een gekoppelde gast wordt samengevoegd. */
function nieuwSpelerDoc(bron, { mee, datum, overlay, gast }){
  const data = { ...bron };
  if (overlay?.nummer !== undefined && overlay?.nummer !== null) data.nummer = overlay.nummer;
  if (overlay?.positie) data.positie = overlay.positie;
  data.meetelVanaf = datum;
  data.heeftVorigeTeams = true;
  if (!mee.not) delete data.notitie;
  if (!mee.lp) data.leerpunten = [];
  if (gast){
    const lp = [...(Array.isArray(data.leerpunten) ? data.leerpunten : [])];
    const ids = new Set(lp.map(l => l && l.id));
    for (const l of (Array.isArray(gast.leerpunten) ? gast.leerpunten : [])) if (!ids.has(l && l.id)) lp.push(l);
    data.leerpunten = lp;
    if (gast.notitie && data.notitie && gast.notitie !== data.notitie) data.notitie = `${data.notitie}\n\n${gast.notitie}`;
    else if (gast.notitie && !data.notitie) data.notitie = gast.notitie;
  }
  for (const k of ['gast', 'gearchiveerd', 'naarTeam', 'naarTeamNaam', 'gearchiveerdOp']) data[k] = FieldValue.delete();
  return data;
}

/* ---------- de transactie ---------- */
async function voerUit(db, uid, a){
  return db.runTransaction(async tx => {
    const clubRef = db.doc(`clubs/${a.clubId}`);
    const vanRef = db.doc(`teams/${a.vanTeam}`);
    const naarRef = a.naarTeam ? db.doc(`teams/${a.naarTeam}`) : null;
    const bronRef = db.doc(`teams/${a.vanTeam}/spelers/${a.spelerId}`);
    const leenRef = a.uitleenId ? db.doc(`clubs/${a.clubId}/uitleningen/${a.uitleenId}`) : null;

    const [clubS, vanS, naarS, bronS, leenS] = await Promise.all([
      tx.get(clubRef), tx.get(vanRef), naarRef ? tx.get(naarRef) : null, tx.get(bronRef), leenRef ? tx.get(leenRef) : null]);
    if (!clubS.exists) throw new HttpsError('not-found', 'Club niet gevonden.');
    const club = clubS.data() || {};
    if (!vanS.exists || vanS.data().club !== a.clubId) throw new HttpsError('failed-precondition', 'Het oude team hoort niet bij deze club.');
    if (naarRef && (!naarS.exists || naarS.data().club !== a.clubId)) throw new HttpsError('failed-precondition', 'Overzetten kan alleen tussen teams van dezelfde club.');
    const naar = naarS ? naarS.data() : null;

    if (a.soort === 'uitleen'){
      if (!isAdmin(club, uid) && !isCoordVan(club, naar.bouw, uid))
        throw new HttpsError('permission-denied', 'Alleen de clubbeheerder of de bouwcoördinator kan een speler definitief overzetten.');
    } else if (!magSchrijven(vanS.data(), club, uid) || (naar && !magSchrijven(naar, club, uid))){
      throw new HttpsError('permission-denied', 'Je hebt niet over beide teams genoeg rechten.');
    }

    if (!bronS.exists) throw new HttpsError('not-found', 'De speler staat niet (meer) bij het oude team.');
    const bron = bronS.data();
    if (bron.gearchiveerd){
      if ((bron.naarTeam || null) === a.naarTeam) return { alGedaan: true };
      throw new HttpsError('failed-precondition', 'Deze speler is al naar een ander team overgezet.');
    }

    let overlay = null, naarId = a.spelerId, gast = null;
    if (a.soort === 'uitleen'){
      if (!leenS.exists) throw new HttpsError('not-found', 'Uitlening niet gevonden.');
      const u = leenS.data();
      if (u.vanTeam !== a.vanTeam || u.naarTeam !== a.naarTeam || u.spelerId !== a.spelerId)
        throw new HttpsError('failed-precondition', 'De uitlening hoort niet bij deze speler en teams.');
      overlay = u.overlay || null;
      if (u.adopteertGast && ID.test(String(u.adopteertGast))){
        naarId = String(u.adopteertGast);
        const g = await tx.get(db.doc(`teams/${a.naarTeam}/spelers/${naarId}`));
        if (g.exists) gast = g.data();
      }
    }

    let eerdere = [];
    if (naarRef){
      const s = await tx.get(db.collection(`teams/${a.vanTeam}/spelers/${a.spelerId}/vorigeTeams`).limit(MAX_STINTEN));
      eerdere = s.docs;
    }

    /* ---- alleen nog schrijven ---- */
    if (naarRef){
      const stinten = `teams/${a.naarTeam}/spelers/${naarId}/vorigeTeams`;
      for (const d of eerdere) tx.set(db.doc(`${stinten}/${d.id}`), d.data(), { merge: true });
      tx.set(db.doc(`${stinten}/${a.vanTeam}_${a.datum}`), { ...a.dossier, bevroren: vandaagIso() });
      tx.set(db.doc(`teams/${a.naarTeam}/spelers/${naarId}`), nieuwSpelerDoc(bron, { mee: a.mee, datum: a.datum, overlay, gast }), { merge: true });
    }
    const naarNaam = a.naarTeamNaam || naar?.naam || null;
    tx.update(bronRef, {
      gearchiveerd: true, naarTeam: a.naarTeam, naarTeamNaam: a.naarTeam ? naarNaam : 'Verlaat de club',
      gearchiveerdOp: a.soort === 'seizoen' ? a.datum : vandaagIso(),
    });
    if (leenRef) tx.delete(leenRef);
    return { alGedaan: false, naarId };
  });
}

const zetSpelerOver = onCall({ region: REGIO, memory: '512MiB', timeoutSeconds: 60 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const c = controleer(request.data || {});
  if (c.fout) throw new HttpsError('invalid-argument', c.fout);
  const r = await voerUit(getFirestore(), request.auth.uid, c.data);
  return { ok: true, ...r };
});

module.exports = { zetSpelerOver, controleer, herstelTijden, nieuwSpelerDoc, voerUit, magSchrijven };
