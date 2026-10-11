/* ==================== PLATFORMDASHBOARD ====================
   Schrijft platformstats/overzicht: per club de kerncijfers voor het platformscherm
   (public/js/platform.js). Eén document, zodat het scherm met één read opent.

   Bronnen per club: clubs/{id}, teams (club==id), navpaden laatste 30 dagen,
   aanvragen, clubs/{id}/geheim/* (Sportlink-status per team), clubs/{id}/aiGebruik/{maand},
   privacyKennisname/{uid}.

   AVG: alleen tellingen en datums per club; geen namen van coaches of spelers.

   Aanroep:
     • platformOverzichtNu  (callable, alleen platformbeheerder) — knop "Vernieuwen"
     • na aggregeerGebruikNacht (gebruik.js) elke nacht                                    */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const PRIVACY_VERSIE = '2026-10';     // gelijk aan functions/toegang.js
const PLATFORM_EMAIL = 'pclijten@gmail.com';

/* ---- kopie van public/js/startlijst.js (tests/startlijst.test.mjs bewaakt gelijkheid) ---- */
const STARTLIJST_IDS = ['uiterlijk', 'sportlink', 'teams', 'trainingen', 'coaches', 'privacy', 'vo'];
function startlijstKlaar(club = {}, teams = []){
  const inst = club.instellingen || {}, id = inst.identiteit || {}, pv = inst.privacy || {}, admins = club.admins || {};
  return {
    uiterlijk: !!id.logo || (!!id.kleur && String(id.kleur).toLowerCase() !== '#e2342f'),
    sportlink: !!String(club.sportlinkClientId || '').trim(),
    teams: teams.length > 0,
    trainingen: teams.length > 0 && teams.every(t => Array.isArray(t.trainingsdagen) && t.trainingsdagen.length > 0),
    coaches: teams.some(t => Object.keys(t.leden || {}).some(u => !admins[u])),
    privacy: !!String(pv.contactEmail || '').trim(),
    vo: !!(pv.verwerkersovereenkomst && pv.verwerkersovereenkomst.geaccepteerd),
  };
}

async function isPlatformBeheerder(request){
  const t = request.auth && request.auth.token;
  if (!t || !t.email || t.email_verified !== true) return false;
  if (t.email === PLATFORM_EMAIL) return true;
  const p = (await getFirestore().doc('platform/instellingen').get()).data() || {};
  return (p.beheerders || []).includes(t.email);
}

const dagStr = ms => new Date(ms).toISOString().slice(0, 10);
const tsMs = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : null);

/* PURE: stoplicht + signalen uit de kerncijfers (getest). */
function beoordeelClub(k, nuMs = Date.now()){
  const signalen = [];
  const dagenStil = k.laatsteGebruik ? Math.floor((nuMs - Date.parse(k.laatsteGebruik)) / 86400000) : null;
  if (k.teams > 0 && (dagenStil == null || dagenStil >= 21)) signalen.push({ niveau: 'rood', tekst: dagenStil == null ? 'nog nooit gebruikt' : `${dagenStil} dagen geen activiteit` });
  else if (dagenStil != null && dagenStil >= 10) signalen.push({ niveau: 'oranje', tekst: `${dagenStil} dagen geen activiteit` });
  if (k.wachtend > 0) signalen.push({ niveau: k.wachtend >= 3 ? 'rood' : 'oranje', tekst: `${k.wachtend} coach${k.wachtend === 1 ? '' : 'es'} wacht${k.wachtend === 1 ? '' : 'en'} op goedkeuring` });
  if (k.sportlink.gekoppeld && k.sportlink.fouten > 0) signalen.push({ niveau: 'oranje', tekst: `Sportlink: ${k.sportlink.fouten} team${k.sportlink.fouten === 1 ? '' : 's'} met fout` });
  if (k.sportlink.gekoppeld && k.sportlink.laatsteSync){
    const d = Math.floor((nuMs - k.sportlink.laatsteSync) / 86400000);
    if (d >= 3) signalen.push({ niveau: 'rood', tekst: `Sportlink: ${d} dagen geen sync` });
  }
  if (!k.privacy.vo) signalen.push({ niveau: 'oranje', tekst: 'geen verwerkersovereenkomst' });
  if (k.ai.limiet > 0 && k.ai.maand >= k.ai.limiet * 0.9) signalen.push({ niveau: 'oranje', tekst: `AI-limiet bijna op (${k.ai.maand}/${k.ai.limiet})` });
  const status = signalen.some(s => s.niveau === 'rood') ? 'rood' : signalen.length ? 'oranje' : 'groen';
  return { status, signalen };
}

async function clubKerncijfers(db, clubDoc, aanvragenPerClub, nuMs){
  const id = clubDoc.id, c = clubDoc.data() || {};
  const teamSnap = await db.collection('teams').where('club', '==', id).get();
  const teams = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const vanaf = dagStr(nuMs - 29 * 86400000);
  const nav = (await db.collection('navpaden').where('clubId', '==', id).where('datum', '>=', vanaf).get()).docs.map(d => d.data());
  const uids = new Set(nav.map(n => n.uid));
  const laatsteGebruik = nav.reduce((m, n) => (n.datum > m ? n.datum : m), '') || null;

  let fouten = 0, laatsteSync = null;
  if (c.sportlinkClientId){
    const geheim = await db.collection(`clubs/${id}/geheim`).get();
    for (const g of geheim.docs){
      if (g.id.startsWith('_')) continue;
      const s = g.data() || {};
      if (s.laatsteFout) fouten++;
      const ms = tsMs(s.laatsteSync);
      if (ms && (!laatsteSync || ms > laatsteSync)) laatsteSync = ms;
    }
  }

  const maand = new Date(nuMs).toISOString().slice(0, 7);
  const aiDoc = (await db.doc(`clubs/${id}/aiGebruik/${maand}`).get()).data() || {};
  const ai = c.instellingen?.ai || {};

  const personen = [...new Set([...Object.keys(c.leden || {}), ...Object.keys(c.admins || {}), ...teams.flatMap(t => Object.keys(t.leden || {}))])];
  let akkoord = 0;
  for (let i = 0; i < personen.length; i += 100){
    const refs = personen.slice(i, i + 100).map(u => db.doc(`privacyKennisname/${u}`));
    if (refs.length) for (const s of await db.getAll(...refs)) if (s.exists && s.data().versie === PRIVACY_VERSIE) akkoord++;
  }

  const pv = c.instellingen?.privacy || {};
  const sl = startlijstKlaar(c, teams);
  const k = {
    id, naam: c.naam || 'Club zonder naam', plaats: c.instellingen?.locatie?.plaats || '', district: c.instellingen?.locatie?.district || '',
    gemaakt: tsMs(c.gemaakt),
    teams: teams.length, leden: personen.length, admins: Object.keys(c.admins || {}).length,
    wachtend: aanvragenPerClub[id] || 0,
    sessies30: nav.length, coaches30: uids.size, laatsteGebruik,
    sportlink: { gekoppeld: !!c.sportlinkClientId, fouten, laatsteSync },
    ai: { aan: ai.aan === true, maand: aiDoc.aantal || 0, limiet: Number(ai.maandLimiet) > 0 ? Number(ai.maandLimiet) : 0 },
    privacy: { vo: !!pv.verwerkersovereenkomst?.geaccepteerd, contact: !!pv.contactEmail, akkoord, totaal: personen.length },
    startlijst: { gedaan: STARTLIJST_IDS.filter(s => sl[s]).length, totaal: STARTLIJST_IDS.length, open: STARTLIJST_IDS.filter(s => !sl[s]) },
  };
  return { ...k, ...beoordeelClub(k, nuMs) };
}

async function bouwPlatformOverzicht(db = getFirestore(), nuMs = Date.now()){
  const [clubs, aanvragen, aanmeldingen] = await Promise.all([
    db.collection('clubs').get(), db.collection('aanvragen').get(),
    db.collection('clubAanmeldingen').where('status', '==', 'nieuw').get(),
  ]);
  const perClub = {};
  aanvragen.docs.forEach(d => { const c = d.data().clubId; if (c) perClub[c] = (perClub[c] || 0) + 1; });
  const lijst = [];
  for (const c of clubs.docs){
    try { lijst.push(await clubKerncijfers(db, c, perClub, nuMs)); }
    catch (e){ console.error('[platformOverzicht]', c.id, e.message || e); lijst.push({ id: c.id, naam: c.data().naam || c.id, status: 'rood', signalen: [{ niveau: 'rood', tekst: 'cijfers ophalen mislukt' }] }); }
  }
  const volgorde = { rood: 0, oranje: 1, groen: 2 };
  lijst.sort((a, b) => (volgorde[a.status] - volgorde[b.status]) || String(a.naam).localeCompare(String(b.naam)));
  const som = f => lijst.reduce((n, k) => n + (f(k) || 0), 0);
  const overzicht = {
    clubs: lijst,
    totalen: {
      clubs: lijst.length,
      actieveClubs: lijst.filter(k => k.laatsteGebruik && (nuMs - Date.parse(k.laatsteGebruik)) < 14 * 86400000).length,
      coaches30: som(k => k.coaches30), teams: som(k => k.teams), wachtend: som(k => k.wachtend),
      aanmeldingen: aanmeldingen.size, aiMaand: som(k => k.ai && k.ai.maand),
    },
    bijgewerkt: FieldValue.serverTimestamp(),
  };
  await db.doc('platformstats/overzicht').set(overzicht);
  return overzicht;
}

const platformOverzichtNu = onCall({ region: REGIO, timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
  const o = await bouwPlatformOverzicht();
  return { clubs: o.clubs.length };
});

module.exports = { bouwPlatformOverzicht, platformOverzichtNu, beoordeelClub, startlijstKlaar, STARTLIJST_IDS, isPlatformBeheerder };
