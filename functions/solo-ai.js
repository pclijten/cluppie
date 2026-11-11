/* ==================== AI VOOR TRAINERS ZONDER CLUB ====================
   [20261111b] Een losse trainer (team zonder club) mag AI gebruiken bij Training maken,
   Seizoensplanning en de doelregel op de Nu-kaart, als de eindbaas dat aanzet:
     platform/instellingen.soloAI = { aan: true|false, limiet: <aanroepen per trainer per maand> }
   Standaard uit. Telling per trainer per maand in aiGebruikSolo/{uid}_{JJJJ-MM}
   (alleen via de Admin SDK; geen client-regels nodig).

   Alleen voor functies die geen clubgegevens nodig hebben. Chat en wedstrijdverslag blijven
   bij een club horen.                                                                     */

const STANDAARD_LIMIET = 20;

function soloBeleid(platform){
  const s = (platform && platform.soloAI) || {};
  const l = Number(s.limiet);
  return { aan: s.aan === true, limiet: Number.isFinite(l) && l >= 0 ? Math.round(l) : STANDAARD_LIMIET };
}

/* Controleert team, lidmaatschap, schakelaar en maandlimiet; telt de aanroep.
   Geeft { clubId: null, teamId, rol: 'coach', solo: true } terug, zoals vereisAI. */
async function vereisSoloAI({ db, request, HttpsError, FieldValue, nu = new Date() }){
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const uid = request.auth.uid;
  const teamId = String(request.data?.teamId || '').trim();
  if (!teamId) throw new HttpsError('invalid-argument', 'teamId ontbreekt.');
  const team = (await db.doc(`teams/${teamId}`).get()).data();
  if (!team) throw new HttpsError('not-found', 'Team bestaat niet.');
  if (team.club) throw new HttpsError('failed-precondition', 'Dit team hoort bij een club; AI loopt via de club.');
  if (team.leden?.[uid] !== true) throw new HttpsError('permission-denied', 'Je bent geen coach van dit team.');
  const beleid = soloBeleid((await db.doc('platform/instellingen').get()).data());
  if (!beleid.aan) throw new HttpsError('failed-precondition', 'AI staat uit voor trainers zonder club.');
  const maand = nu.toISOString().slice(0, 7);
  const ref = db.doc(`aiGebruikSolo/${uid}_${maand}`);
  await db.runTransaction(async tx => {
    const aantal = (await tx.get(ref)).data()?.aantal || 0;
    if (aantal >= beleid.limiet) throw new HttpsError('resource-exhausted', 'Je maandlimiet voor AI is bereikt. Volgende maand kan het weer.');
    tx.set(ref, { uid, maand, aantal: aantal + 1, bijgewerkt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { clubId: null, teamId, rol: 'coach', solo: true };
}

/* Namen om uit AI-invoer te halen voor een los team: voornaam/achternaam van de spelers en de coaches. */
async function namenVanTeam(db, teamId){
  const namen = new Set();
  const t = (await db.doc(`teams/${teamId}`).get()).data() || {};
  for (const i of Object.values(t.ledenInfo || {})){ namen.add(i?.naam); String(i?.naam || '').split(/\s+/).forEach(d => namen.add(d)); }
  const sp = await db.collection(`teams/${teamId}/spelers`).get();
  sp.docs.forEach(d => { const p = d.data(); [p.naam, p.achternaam, `${p.naam || ''} ${p.achternaam || ''}`].forEach(n => namen.add(n)); });
  return [...namen].filter(n => n && String(n).trim().length > 1);
}

module.exports = { soloBeleid, vereisSoloAI, namenVanTeam, STANDAARD_LIMIET };
