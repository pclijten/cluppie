/* ==================== AI VOOR TRAINERS ZONDER CLUB ====================
   [20261111b] Een losse trainer (team zonder club) mag AI gebruiken bij Training maken,
   Seizoensplanning en de doelregel op de Nu-kaart, als de eindbaas dat aanzet:
     platform/instellingen.soloAI = { aan: true|false, limiet: <aanroepen per trainer per maand> }
   Standaard uit. Telling per trainer per maand in aiGebruikSolo/{uid}_{JJJJ-MM}
   (alleen via de Admin SDK; geen client-regels nodig).

   Alleen voor functies die geen clubgegevens nodig hebben. Het wedstrijdverslag blijft bij een
   club horen.

   [20261122a] Ook de hulpchat, met een eigen plafond: soloAI.chatLimiet (vragen per trainer per
   maand, standaard 30), geteld in het veld `chat` van hetzelfde document. Zo eet een gesprek het
   maximum voor Training maken niet op, en andersom.                                        */

const STANDAARD_LIMIET = 20;
const STANDAARD_CHAT = 30;

function soloBeleid(platform){
  const s = (platform && platform.soloAI) || {};
  const l = Number(s.limiet), c = Number(s.chatLimiet);
  const chatGezet = s.chatLimiet !== undefined && s.chatLimiet !== null && s.chatLimiet !== '' && Number.isFinite(c) && c >= 0;
  return { aan: s.aan === true, limiet: Number.isFinite(l) && l >= 0 ? Math.round(l) : STANDAARD_LIMIET, chatLimiet: chatGezet ? Math.round(c) : STANDAARD_CHAT };
}

/* Controleert team, lidmaatschap, schakelaar en maandlimiet; telt de aanroep.
   Geeft { clubId: null, teamId, rol: 'coach', solo: true } terug, zoals vereisAI. */
async function vereisSoloAI({ db, request, HttpsError, FieldValue, nu = new Date(), soort = 'ai' }){
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  /* [20261115d] alleen met een bevestigd e-mailadres: anders is de limiet per trainer met wegwerpaccounts te omzeilen */
  if (request.auth.token?.email_verified !== true) throw new HttpsError('failed-precondition', 'Bevestig eerst je e-mailadres; daarna kun je AI gebruiken.');
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
  const chat = soort === 'chat', veld = chat ? 'chat' : 'aantal', max = chat ? beleid.chatLimiet : beleid.limiet;
  await db.runTransaction(async tx => {
    const aantal = (await tx.get(ref)).data()?.[veld] || 0;
    if (aantal >= max) throw new HttpsError('resource-exhausted', chat
      ? 'Je hebt deze maand het maximum aantal vragen aan de hulpchat bereikt. Volgende maand kan het weer; de handleiding staat onder Help.'
      : 'Je maandlimiet voor AI is bereikt. Volgende maand kan het weer.');
    tx.set(ref, { uid, maand, [veld]: aantal + 1, bijgewerkt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { clubId: null, teamId, rol: 'coach', solo: true, sport: require('./sport').sportVan(team.sport) };   /* [20261126b] */
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

module.exports = { soloBeleid, vereisSoloAI, namenVanTeam, STANDAARD_LIMIET, STANDAARD_CHAT };
