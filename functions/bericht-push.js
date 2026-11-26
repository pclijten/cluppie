/* ==================== BERICHTEN van de club — pushmelding naar trainers [20261126m] ====================
   De clubbeheerder plaatst een bericht voor een of meer teams (public/js/club.js, collectie berichten).
   Met het vinkje "Stuur een pushmelding" (melding: true) gaat er een melding naar de trainers van die teams
   die meldingen aanzetten in de app (Instellingen › Mijn account; tokens onder gebruikers/{uid}/push,
   dezelfde opslag als de teamkamer). Versturen gaat via teamkamer-push.js. */
'use strict';
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const P = require('./teamkamer-push');

const REGIO = 'europe-west1';
const APP_URL = 'https://www.cluppie.io/index.html?app=1';
const MAX_TEAMS = 200;

/* PURE (getest): de trainers van de gekozen teams. teams = [{ id, club, leden }]. Alleen teams van dezelfde club,
   alleen leden die op true staan, niet de schrijver zelf, iedereen één keer. */
function trainers(teams, club, behalve = ''){
  const uit = new Set();
  for (const t of teams || []){
    if (!t || !club || t.club !== club) continue;
    for (const [uid, aan] of Object.entries(t.leden || {})) if (aan === true && uid !== behalve) uit.add(uid);
  }
  return [...uit];
}
function melding(b, id){
  const club = String(b.clubNaam || '').trim() || 'de club';
  const titel = String(b.titel || '').trim();
  const body = String(b.body || '').replace(/\s+/g, ' ').trim();
  return { titel: `${titel || 'Nieuw bericht'} · ${club}`.slice(0, 90), tekst: (body.length > 160 ? body.slice(0, 159).trimEnd() + '…' : body) || 'Er staat een nieuw bericht van de club voor je klaar.',
    url: APP_URL, tag: 'clubbericht-' + id, badge: false };
}

const clubBericht = onDocumentCreated({ document: 'berichten/{berichtId}', region: REGIO }, async (event) => {
  const b = event.data && event.data.data();
  if (!b || b.melding !== true || !b.club || !Array.isArray(b.teams) || !b.teams.length) return;
  const db = getFirestore();
  try {
    const ids = [...new Set(b.teams.filter(x => typeof x === 'string' && x && !x.includes('/')))].slice(0, MAX_TEAMS);
    const teams = [];
    for (const id of ids){ const d = (await db.doc(`teams/${id}`).get()).data(); if (d) teams.push({ id, club: d.club, leden: d.leden }); }
    const uids = trainers(teams, b.club, b.doorUid || '');
    const r = await P.stuur(db, uids, melding(b, event.params.berichtId));
    await event.data.ref.update({ meldingBereik: r.ouders });
  } catch (e){ logger.warn('[clubBericht] ' + event.params.berichtId, e.message || e); }
});

module.exports = { clubBericht, trainers, melding };
