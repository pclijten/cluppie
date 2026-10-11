/* ==================== GEBRUIKSSTATISTIEKEN (aggregeerGebruik) ====================
   Vult gebruikstats/{clubId} voor het Inzicht-dashboard (public/js/club-inzicht.js).
   Bron: navpaden/{uid}_{sessie} (schermovergangen per sessie, tracker.js) van de
   laatste VENSTER_DAGEN dagen, alleen van leden/admins van deze club.

   AVG: het resultaat bevat alleen schermnamen, tellingen en tijden. Coachnamen staan
   in `coaches` (de client toont die lijst alleen aan beheerders; de rules laten het
   document alleen door clubadmins en de platformbeheerder lezen). Nooit spelerdata.

   Aanroep:
     • aggregeerGebruik (callable, club-admin of coördinator) — knop "Synchroniseer"
     • aggregeerGebruikNacht (schema, 04:15 NL) — alle clubs, zodat cijfers altijd vers zijn

   Vorm van het document: zie bouwStats() — gelijk aan wat club-inzicht.js leest. */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const VENSTER_DAGEN = 90;
const MAX_VERBLIJF_SEC = 10 * 60;   // langer op één scherm = app open laten liggen; afkappen

const CATEGORIEEN = ['Trainingen', 'Wedstrijden', 'Spelers', 'Media', 'Clubbeheer', 'Overig', 'Navigatie'];
const PROFIEL = { Trainingen: 'trainingsgericht', Wedstrijden: 'wedstrijdgericht', Spelers: 'spelersgericht',
  Media: 'media', Clubbeheer: 'beheer', Overig: 'breed', Navigatie: 'verkennend' };

/* Scherm → categorie. Bewust op voorvoegsels, zodat nieuwe schermen vanzelf ergens landen. */
function categorie(s){
  s = String(s || '');
  if (/^(team|club|desk):?hub$|^teams$|^desk:?$/.test(s)) return 'Navigatie';
  if (/training|oefen|leerplein|tactiek:leerplein|sjabloon|presentietraining/.test(s)) return 'Trainingen';
  if (/^wedstrijd|wedstrijden|poule|preswedstrijd|tactiek/.test(s)) return 'Wedstrijden';
  if (/speler|evaluatie|leerlijn|beoordel|stats|historie/.test(s)) return 'Spelers';
  if (/video|documenten|media/.test(s)) return 'Media';
  if (/^club:|^desk:bouw|instellingen|bouw/.test(s)) return 'Clubbeheer';
  return 'Overig';
}

/* Dag (0 = maandag) en uur in Nederlandse tijd. */
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' });
const WD = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function nlTijd(ms){
  const p = Object.fromEntries(FMT.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { dag: WD[p.weekday], uur: Number(p.hour) % 24, datum: `${p.year}-${p.month}-${p.day}` };
}

function mediaan(a){
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

/* Dagen tussen het openen van het trainingsscherm en de eerstvolgende trainingsdag
   (trainingsdagen: 1 = ma … 7 = zo). null als het team geen trainingsdagen heeft. */
function dagenTotTraining(dag0, trainingsdagen){
  const d = (trainingsdagen || []).map(Number).filter(n => n >= 1 && n <= 7).map(n => n - 1);
  if (!d.length) return null;
  return Math.min(...d.map(t => (t - dag0 + 7) % 7));
}

/* PURE aggregatie (getest in tests/gebruik.test.mjs).
   sessies: [{uid, teamId, start, stappen:[{s,t,h}]}]
   teams:   {teamId: {naam, trainingsdagen}}
   namen:   {uid: naam} */
function bouwStats({ sessies, teams = {}, namen = {}, vanaf, tot }){
  const paginas = {}, perTeam = {}, perCoach = {};
  const dag = new Array(7).fill(0), dagTeamSets = Array.from({ length: 7 }, () => new Set());
  const heatmap = new Array(168).fill(0);
  const voorbereiding = { zelf: 0, dag1: 0, dag2: 0, dag3: 0, dag4plus: 0 };
  const wedstrijd = { opstelling_n: 0, live_n: 0, aanwezigheid_n: 0, liveDag: new Array(7).fill(0) };
  const coachesSet = new Set(), teamsSet = new Set();

  for (const ses of sessies){
    const stappen = Array.isArray(ses.stappen) ? ses.stappen.filter(x => x && x.s) : [];
    if (!stappen.length || !Number.isFinite(ses.start)) continue;
    stappen.sort((a, b) => (a.t || 0) - (b.t || 0));
    const teamId = ses.teamId || null;
    coachesSet.add(ses.uid);
    if (teamId) teamsSet.add(teamId);

    const tm = teamId ? (perTeam[teamId] ||= { teamId, naam: teams[teamId]?.naam || '(geen team)', ses: 0, uids: new Set(), cat: {} }) : null;
    if (tm){ tm.ses++; tm.uids.add(ses.uid); }
    const co = (perCoach[ses.uid] ||= { uid: ses.uid, naam: namen[ses.uid] || '', ses: 0, tot: 0 });
    co.ses++;
    let liveInSessie = false;

    stappen.forEach((st, i) => {
      const volgende = stappen[i + 1];
      const verblijf = volgende ? Math.max(0, Math.min(MAX_VERBLIJF_SEC, Math.round(((volgende.t || 0) - (st.t || 0)) / 1000))) : 0;
      const p = (paginas[st.s] ||= { s: st.s, n: 0, tijden: [], tot: 0 });
      p.n++; p.tot += verblijf; if (verblijf > 0) p.tijden.push(verblijf);
      co.tot += verblijf;
      const cat = categorie(st.s);
      if (tm) tm.cat[cat] = (tm.cat[cat] || 0) + verblijf;

      const nl = nlTijd(ses.start + (st.t || 0));
      dag[nl.dag]++;
      if (teamId) dagTeamSets[nl.dag].add(teamId);
      heatmap[nl.dag * 24 + nl.uur]++;

      if (st.s === 'wedstrijd:opstelling') wedstrijd.opstelling_n++;
      if (st.s === 'team:preswedstrijd') wedstrijd.aanwezigheid_n++;
      if (/^wedstrijd:kwart/.test(st.s) && !liveInSessie){ liveInSessie = true; wedstrijd.live_n++; wedstrijd.liveDag[nl.dag]++; }
      if (st.s === 'team:trainingen' && teamId){
        const n = dagenTotTraining(nl.dag, teams[teamId]?.trainingsdagen);
        if (n != null) voorbereiding[n === 0 ? 'zelf' : n === 1 ? 'dag1' : n === 2 ? 'dag2' : n === 3 ? 'dag3' : 'dag4plus']++;
      }
    });
  }

  const teamLijst = Object.values(perTeam).map(t => {
    const top = Object.entries(t.cat).filter(([k]) => k !== 'Navigatie').sort((a, b) => b[1] - a[1])[0];
    return { teamId: t.teamId, naam: t.naam, ses: t.ses, coaches: t.uids.size, cat: t.cat, profiel: top && top[1] > 0 ? PROFIEL[top[0]] : '' };
  }).sort((a, b) => b.ses - a.ses);

  return {
    v: 1,
    bron: { teams: teamsSet.size, sessies: sessies.length, coaches: coachesSet.size },
    periodeVan: vanaf, periodeTot: tot,
    dagenGemeten: Math.max(1, Math.round((Date.parse(tot) - Date.parse(vanaf)) / 86400000) + 1),
    teams: teamLijst,
    paginas: Object.values(paginas).map(p => ({ s: p.s, n: p.n, med: mediaan(p.tijden), tot: p.tot })).sort((a, b) => b.n - a.n).slice(0, 80),
    coaches: Object.values(perCoach).sort((a, b) => b.ses - a.ses).slice(0, 40),
    dag, dagTeams: dagTeamSets.map(s => s.size),
    heatmap, voorbereiding, wedstrijd,
    categorieen: CATEGORIEEN,
  };
}

/* Leest alles voor één club en schrijft gebruikstats/{clubId}. Geeft het aantal sessies terug. */
async function aggregeerClub(db, clubId){
  const clubSnap = await db.doc(`clubs/${clubId}`).get();
  if (!clubSnap.exists) throw new HttpsError('not-found', 'Club bestaat niet.');
  const club = clubSnap.data() || {};
  const teamSnap = await db.collection('teams').where('club', '==', clubId).get();

  const teams = {}, namen = {}, relevant = new Set(Object.keys(club.admins || {}));
  const info = { ...(club.ledenInfo || {}), ...(club.adminsInfo || {}), ...(club.bouwCoordinatorenInfo || {}) };
  for (const d of teamSnap.docs){
    const t = d.data() || {};
    teams[d.id] = { naam: t.naam || d.id, trainingsdagen: t.trainingsdagen || [] };
    for (const uid of Object.keys(t.leden || {})) relevant.add(uid);
    for (const [uid, i] of Object.entries(t.ledenInfo || {})) if (!info[uid]) info[uid] = i;
  }
  for (const uid of Object.keys(club.leden || {})) relevant.add(uid);
  for (const uid of relevant) namen[uid] = info[uid]?.naam || '';

  const totD = new Date(), vanD = new Date(Date.now() - (VENSTER_DAGEN - 1) * 86400000);
  const vanaf = vanD.toISOString().slice(0, 10), tot = totD.toISOString().slice(0, 10);
  const navSnap = await db.collection('navpaden').where('clubId', '==', clubId).where('datum', '>=', vanaf).get();
  const sessies = navSnap.docs.map(d => d.data()).filter(n => relevant.has(n.uid))
    .map(n => ({ uid: n.uid, teamId: n.teamId && teams[n.teamId] ? n.teamId : null, start: Number(n.start), stappen: n.stappen }));

  const stats = bouwStats({ sessies, teams, namen, vanaf, tot });
  await db.doc(`gebruikstats/${clubId}`).set({ ...stats, bijgewerkt: FieldValue.serverTimestamp() });
  return sessies.length;
}

/* Callable: club-admin, coördinator of platformbeheerder. `vereisLid` komt uit index.js. */
function maakCallable(vereisLid){
  return onCall({ region: REGIO, timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
    const { clubId } = await vereisLid(request, ['club_admin', 'coordinator']);
    try {
      return { sessies: await aggregeerClub(getFirestore(), clubId) };
    } catch (e){
      if (e instanceof HttpsError) throw e;
      console.error('[aggregeerGebruik]', clubId, e);
      throw new HttpsError('internal', 'Statistieken bijwerken mislukt.');
    }
  });
}

const aggregeerGebruikNacht = onSchedule(
  { region: REGIO, schedule: '15 4 * * *', timeZone: 'Europe/Amsterdam', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore();
    const clubs = await db.collection('clubs').get();
    for (const c of clubs.docs){
      try { const n = await aggregeerClub(db, c.id); console.log('[aggregeerGebruikNacht]', c.id, n, 'sessies'); }
      catch (e){ console.error('[aggregeerGebruikNacht]', c.id, e.message || e); }
    }
  }
);

module.exports = { bouwStats, categorie, aggregeerClub, maakCallable, aggregeerGebruikNacht };
