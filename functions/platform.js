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
const { getAuth } = require('firebase-admin/auth');

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

/* ---- anonieme clubvergelijking (opt-in: instellingen.benchmark === true) ----
   Per club, laatste 30 dagen, per team: hoe vaak wordt er geëvalueerd, presentie bijgehouden,
   een wedstrijd live gevolgd en aan leerpunten gewerkt; plus % actieve coaches. Alleen tellingen. */
const BENCH_EVENTS = {
  evaluaties: ['snel_beoordeling', 'volledige_beoordeling', 'snel_ronde', 'ronde_beoordeling', 'team_evaluatie'],
  presentie: ['presentie'], wedstrijden: ['wedstrijd_start'], leerpunten: ['leerpunt_nieuw', 'leerpunt_klaar'],
};
const MIN_DEELNEMERS = 3;
function benchmarkWaarden(gebruikDocs, teams, coaches30, leden){
  const som = {}; for (const g of gebruikDocs) for (const [ev, n] of Object.entries(g.tellingen || {})) som[ev] = (som[ev] || 0) + (Number(n) || 0);
  const perTeam = evs => teams > 0 ? Math.round(10 * evs.reduce((s, e) => s + (som[e] || 0), 0) / teams) / 10 : 0;
  return { evaluaties: perTeam(BENCH_EVENTS.evaluaties), presentie: perTeam(BENCH_EVENTS.presentie), wedstrijden: perTeam(BENCH_EVENTS.wedstrijden),
    leerpunten: perTeam(BENCH_EVENTS.leerpunten), actiefPct: leden > 0 ? Math.round(100 * coaches30 / leden) : 0 };
}
function kwantiel(a, q){ if (!a.length) return null; const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, l = Math.floor(p); return Math.round(10 * (s[l] + (s[Math.ceil(p)] - s[l]) * (p - l))) / 10; }
function benchmarkOverzicht(waardenLijst){
  if (waardenLijst.length < MIN_DEELNEMERS) return { aantal: waardenLijst.length, metrics: null };
  const metrics = {};
  for (const k of Object.keys(waardenLijst[0])){ const a = waardenLijst.map(w => w[k]); metrics[k] = { mediaan: kwantiel(a, 0.5), p75: kwantiel(a, 0.75) }; }
  return { aantal: waardenLijst.length, metrics };
}
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

/* ---- individuele coaches: wie heeft zich aangemeld zonder bij een club te horen ----
   PURE (getest). Een account telt als individueel als de uid in geen enkele club zit (clubs.leden/admins)
   en niet in een team dat bij een club hoort. Status:
     'eigen-team'   heeft een team zonder club (Begin met mijn eigen team)
     'wacht-op-club' heeft een aanvraag open bij een club
     'nog-geen-team' account aangemaakt, nog niets gestart
   Alleen naam, e-mail, datums en teamnaam/categorie/aantal spelers; geen spelernamen. */
function bepaalIndividueleCoaches({ gebruikers = [], teams = [], clubs = [], aanvragen = [], uitsluiten = [], nuMs = Date.now(), max = 300 }){
  const inClub = new Set();
  for (const c of clubs){ Object.keys(c.leden || {}).forEach(u => inClub.add(u)); Object.keys(c.admins || {}).forEach(u => inClub.add(u)); }
  for (const t of teams) if (t.club) Object.keys(t.leden || {}).forEach(u => inClub.add(u));
  const eigen = {};
  for (const t of teams){
    if (t.club) continue;
    for (const u of Object.keys(t.leden || {})) (eigen[u] ||= []).push({ id: t.id, naam: t.naam || '', categorie: t.categorie || '', spelers: Number(t.spelers) || 0 });
  }
  const wacht = new Set(aanvragen.map(a => a.uid).filter(Boolean));
  const weg = new Set(uitsluiten.map(e => String(e || '').toLowerCase()));
  const lijst = [];
  for (const g of gebruikers){
    if (!g || !g.uid || inClub.has(g.uid)) continue;
    if (g.email && weg.has(String(g.email).toLowerCase())) continue;
    const status = eigen[g.uid] ? 'eigen-team' : wacht.has(g.uid) ? 'wacht-op-club' : 'nog-geen-team';
    const teamNaam = (eigen[g.uid] && eigen[g.uid][0]?.naam) || '';
    lijst.push({
      uid: g.uid, naam: g.naam || (g.email ? String(g.email).split('@')[0] : 'Coach'), email: g.email || '',
      aangemeld: g.aangemeld || null, laatsteLogin: g.laatsteLogin || null, status,
      nieuw: !!g.aangemeld && (nuMs - g.aangemeld) < 7 * 86400000,
      teams: eigen[g.uid] || [], teamNaam,
    });
  }
  lijst.sort((a, b) => (b.aangemeld || 0) - (a.aangemeld || 0));
  const tel = st => lijst.filter(x => x.status === st).length;
  return {
    totaal: lijst.length, nieuw7: lijst.filter(x => x.nieuw).length,
    eigenTeam: tel('eigen-team'), wachtOpClub: tel('wacht-op-club'), nogGeenTeam: tel('nog-geen-team'),
    lijst: lijst.slice(0, max), afgekapt: lijst.length > max,
  };
}

/* Alle Auth-accounts (paginagewijs), alleen de velden die we nodig hebben. */
async function leesAuthGebruikers(auth = getAuth(), maxTotaal = 5000){
  const uit = []; let token;
  do {
    const r = await auth.listUsers(1000, token);
    for (const u of r.users){
      uit.push({ uid: u.uid, email: u.email || '', naam: u.displayName || '',
        aangemeld: u.metadata && u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
        laatsteLogin: u.metadata && u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null });
    }
    token = r.pageToken;
  } while (token && uit.length < maxTotaal);
  return uit;
}

async function individueleCoaches(db, clubs, aanvragen, nuMs){
  const [gebruikers, teamSnap, platformDoc] = await Promise.all([
    leesAuthGebruikers(),
    db.collection('teams').select('club', 'leden', 'naam', 'categorie', 'ledenInfo').get(),
    db.doc('platform/instellingen').get(),
  ]);
  const teams = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  /* aantal spelers alleen voor teams zonder club (klein getal); alleen een telling */
  const solo = teams.filter(t => !t.club);
  for (const t of solo){
    try { t.spelers = (await db.collection(`teams/${t.id}/spelers`).count().get()).data().count; } catch (e) { t.spelers = 0; }
  }
  /* de naam die de coach zelf gaf (ledenInfo) gaat voor op het Auth-profiel */
  const naamUit = {};
  for (const t of teams) for (const [u, i] of Object.entries(t.ledenInfo || {})) if (i && i.naam && !naamUit[u]) naamUit[u] = i.naam;
  for (const g of gebruikers) if (!g.naam && naamUit[g.uid]) g.naam = naamUit[g.uid];
  const beheerders = ((platformDoc.data() || {}).beheerders || []);
  return bepaalIndividueleCoaches({ gebruikers, teams, clubs, aanvragen, uitsluiten: [PLATFORM_EMAIL, 'paul@cluppie.io', ...beheerders], nuMs });
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

  const gebruikDocs = (await db.collection('gebruik').where('clubId', '==', id).where('datum', '>=', vanaf).get()).docs.map(d => d.data());
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
    benchmarkAan: c.instellingen?.benchmark === true,
  };
  k._bench = benchmarkWaarden(gebruikDocs, teams.length, uids.size, personen.length);
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
  /* individuele coaches (zonder club): mag het overzicht nooit laten mislukken */
  let individueel = null;
  try {
    individueel = await individueleCoaches(db, clubs.docs.map(c => ({ id: c.id, ...c.data() })), aanvragen.docs.map(d => d.data()), nuMs);
  } catch (e){ console.error('[platformOverzicht] individuele coaches', e.message || e); }
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
      ...(individueel ? { individueel: individueel.totaal, individueelNieuw: individueel.nieuw7 } : {}),
    },
    ...(individueel ? { individueel } : {}),
    bijgewerkt: FieldValue.serverTimestamp(),
  };
  /* vergelijking: alleen deelnemende clubs, per club de eigen waarden apart (alleen voor die club leesbaar) */
  const deelnemers = lijst.filter(k => k.benchmarkAan && k._bench);
  const bo = benchmarkOverzicht(deelnemers.map(k => k._bench));
  await db.doc('benchmark/overzicht').set({ ...bo, bijgewerkt: FieldValue.serverTimestamp() });
  for (const k of deelnemers) await db.doc(`benchmark/${k.id}`).set({ waarden: k._bench, bijgewerkt: FieldValue.serverTimestamp() });
  for (const k of lijst) delete k._bench;
  await db.doc('platformstats/overzicht').set(overzicht);
  return overzicht;
}

const platformOverzichtNu = onCall({ region: REGIO, timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
  const o = await bouwPlatformOverzicht();
  return { clubs: o.clubs.length };
});

module.exports = { bepaalIndividueleCoaches, benchmarkWaarden, benchmarkOverzicht, bouwPlatformOverzicht, platformOverzichtNu, beoordeelClub, startlijstKlaar, STARTLIJST_IDS, isPlatformBeheerder };
