// Sportlink-sync met nep-Sportlink en nep-Firestore (20261012a): beker, wedstrijdinfo, afgelast,
// verdwenen wedstrijden, weekendcontrole en clubinfo. Draaien: node tests/sportlink-sync.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } }
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, onRequest: (o, f) => f, HttpsError };
  if (r === 'firebase-functions/v2/scheduler') return { onSchedule: (o, f) => f };
  if (r === 'firebase-functions/v2/firestore') return { onDocumentCreated: (o, f) => f, onDocumentWritten: (o, f) => f };
  if (r === 'firebase-functions/params') return { defineSecret: () => ({ value: () => '' }) };
  if (r === 'firebase-functions') return { logger: console };
  if (r === 'firebase-functions/logger') return console;
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp };
  if (r === 'firebase-admin') return { apps: [1], initializeApp(){}, auth: () => ({ getUser: async () => null }), firestore: () => fake.db };
  return orig.call(this, r, ...a);
};

const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const plus = n => { const d = new Date(vandaag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const T = (n, t = '10:30') => `${plus(n)}T${t}:00+0200`;

/* ---- nep-Sportlink ---- */
let SL = {}; const aanroepen = [], params = [];
/* Zoals de echte Club.Dataservice: clubbreed (zonder teamcode) wordt programma/uitslagen afgekapt
   (hier na 1 regel); met teamcode komen alle wedstrijden van dat team. */
const perTeam = lijst => q => {
  const code = q.get('teamcode');
  if (!code) return lijst.slice(0, 1);
  return lijst.filter(r => String(r.thuisteamid) === code || String(r.uitteamid) === code);
};
global.fetch = async (url) => {
  const u = new URL(url); const ep = u.pathname.slice(1); aanroepen.push(ep); params.push([ep, u.searchParams]);
  const data = typeof SL[ep] === 'function' ? SL[ep](u.searchParams) : SL[ep];
  if (data === undefined) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
};
function standaardSL(){
  SL = {
    teams: [
      { teamcode: 501, teamnaam: 'VV Voorbeeld O11-1', poulecode: 801, competitiesoort: 'regulier', klassepoule: '3e klasse 14' },
      { teamcode: 501, teamnaam: 'VV Voorbeeld O11-1', poulecode: 905, competitiesoort: 'beker', klassepoule: 'Beker groep C' },
      { teamcode: 502, teamnaam: 'VV Voorbeeld O13-1', poulecode: 802, competitiesoort: 'regulier', klassepoule: '2e klasse 3' },
    ],
    programma: [
      { wedstrijdcode: 1001, wedstrijddatum: T(6), aanvangstijd: '10:30', thuisteamid: 777, thuisteam: 'FC Kempen O11-1', uitteamid: 501, uitteam: 'VV Voorbeeld O11-1',
        competitiesoort: 'beker', accommodatie: 'Sportpark De Kempen', veld: 'veld 3', plaats: 'REUSEL', vertrektijd: '9:30', kleedkamerthuisteam: '1', kleedkameruitteam: '4', scheidsrechter: 'P. Pupil' },
      { wedstrijdcode: 1002, wedstrijddatum: T(13, '09:00'), aanvangstijd: '09:00', thuisteamid: 501, thuisteam: 'VV Voorbeeld O11-1', uitteamid: 778, uitteam: 'SV Molenbroek O11-2',
        competitiesoort: 'regulier', accommodatie: 'Sportpark De Hoef', veld: 'veld 2', plaats: 'RIXTEL', verzameltijd: '08:15', kleedkamerthuisteam: '2' },
      { wedstrijdcode: 1003, wedstrijddatum: T(16, '18:30'), aanvangstijd: '18:30', thuisteamid: 501, thuisteam: 'VV Voorbeeld O11-1', uitteamid: 779, uitteam: 'FC Oefen O11-3',
        competitiesoort: 'Oefenwedstrijd' },
    ],
    uitslagen: [
      { wedstrijdcode: 1010, wedstrijddatum: T(-2, '10:00'), aanvangstijd: '10:00', thuisteamid: 501, thuisteam: 'VV Voorbeeld O11-1', uitteamid: 781, uitteam: 'Laat FC O11-1', uitslag: '7 - 4', competitiesoort: 'regulier' },
      { wedstrijdcode: 1301, wedstrijddatum: T(-9, '09:00'), aanvangstijd: '09:00', thuisteamid: 502, thuisteam: 'VV Voorbeeld O13-1', uitteamid: 790, uitteam: 'Ander O13-1', uitslag: '2 - 2', competitiesoort: 'regulier' },
    ],
    afgelastingen: [
      { wedstrijdcode: 1001, wedstrijddatum: T(6), aanvangstijd: '10:30', thuisteamid: '777', uitteamid: '501', status: 'Afgelast', wedstrijd: 'FC Kempen O11-1 - VV Voorbeeld O11-1' },
    ],
    poulestand: q => [{ positie: 1, teamnaam: q.get('poulecode') === '905' ? 'VV Voorbeeld O11-1' : 'Ander', gespeeldewedstrijden: 2, punten: 6 }],
    pouleuitslagen: [], 'poule-programma': [],
    'wedstrijd-accommodatie': [{ wedstrijd: { accommodatienaam: 'Sportpark De Kempen', adres: 'Kempenweg 12', plaats: '5541AB REUSEL', telefoonnummer: '0497-123456' } }],
    clubgegevens: [{ gegevens: { clubnaam: 'VV Voorbeeld', clubcode: 'XXTT12Z', plaats: 'RIXTEL', thuisshirtkleur: 'Groen / Wit', logo: 'iVBORw0KGgo' + 'A'.repeat(300),
      banknummer: 'NL00BANK0123456789', naamsecretaris: 'J. Jansen' } }],
  };
}

const F = require('../functions/index.js');
const { store } = fake;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const doc = p => store.get(p);

function zetKlaar(){
  store.clear(); aanroepen.length = 0; params.length = 0; standaardSL();
  SL._prog = SL.programma; SL.programma = perTeam(SL._prog); SL.uitslagen = perTeam(SL.uitslagen);
  store.set('clubs/c1', { naam: 'VV Voorbeeld', admins: { adm: true }, sportlinkClientId: 'k7Rq2pX9aW' });
  store.set('teams/t11', { club: 'c1', naam: 'O11-1', leden: {} });
  store.set('teams/t13', { club: 'c1', naam: 'O13-1', leden: {} });
  // al bestaande wedstrijd die niet meer in Sportlink staat, en een met opstelling + eigen verzameltijd
  store.set('teams/t11/wedstrijden/sl_1009', { datum: plus(9), bron: 'sportlink', sportlinkCode: '1009', tegenstander: 'Weg FC' });
  store.set('teams/t11/wedstrijden/sl_1002', { datum: plus(13), bron: 'sportlink', sportlinkCode: '1002', infoEigen: { verzamel: '08:00' }, formatie: '1-3-3' });
}

(async () => {
  const sync = r => F.sportlinkSyncNu({ auth: { uid: 'adm' }, data: { clubId: 'c1' } });

  zetKlaar();
  const r = await sync();
  ok(r.gematcht === 2 && r.wedstrijden === 5, `sync: 2 teams gekoppeld, 5 wedstrijden (${JSON.stringify(r)})`);

  // [20261012d] per team opgevraagd: ook wat clubbreed zou wegvallen komt binnen
  ok(doc('teams/t11/wedstrijden/sl_1010')?.tegenstander === 'Laat FC O11-1', 'late uitslag binnen (clubbrede lijst zou afgekapt zijn)');
  ok(doc('teams/t13/wedstrijden/sl_1301') && !doc('teams/t11/wedstrijden/sl_1301'), 'uitslag bij het juiste team');
  ok(params.filter(([ep]) => ep === 'programma' || ep === 'uitslagen').every(([, q]) => q.get('teamcode') && q.get('lokaleteamcode') === '-1'),
    'programma en uitslagen altijd met teamcode');
  const w1 = doc('teams/t11/wedstrijden/sl_1001');
  ok(w1.competitiesoort === 'beker', 'bekerwedstrijd herkend');
  ok(w1.status === 'afgelast' && w1.afgelastOp, 'afgelaste wedstrijd gemarkeerd');
  ok(w1.info.kleedkamer === '4' && w1.info.vertrek === '09:30' && w1.info.plaats === 'Reusel', 'info: eigen kleedkamer, tijden, plaats');
  ok(!JSON.stringify(w1).includes('Pupil'), 'geen scheidsrechternaam opgeslagen');
  ok(w1.info.adres === 'Kempenweg 12' && w1.info.plaatsAdres === '5541 AB Reusel' && /maps/.test(w1.info.route), 'uitwedstrijd: adres en route');
  ok(doc('accommodaties/sportparkdekempen_reusel')?.adres === 'Kempenweg 12', 'accommodatie gecachet');

  const w2 = doc('teams/t11/wedstrijden/sl_1002');
  ok(w2.infoEigen.verzamel === '08:00' && w2.formatie === '1-3-3', 'eigen verzameltijd en opstelling blijven staan');
  ok(w2.info.verzamel === '08:15' && !w2.info.adres, 'thuis: Sportlink-verzameltijd, geen adres opgehaald');
  ok(doc('teams/t11/wedstrijden/sl_1003').competitiesoort === 'oefen', 'oefenwedstrijd herkend');

  const weg = doc('teams/t11/wedstrijden/sl_1009');
  ok(weg && weg.sportlinkWeg === true, 'verdwenen wedstrijd gemarkeerd, niet verwijderd');

  const beker = doc('teams/t11/poule/beker');
  ok(beker && beker.poulecode === '905' && beker.stand[0].eigen === true, 'bekerstand geschreven met eigen team gemarkeerd');
  ok(!doc('teams/t13/poule/beker'), 'team zonder beker: geen bekerdocument');

  const lijst = doc('clubs/c1/geheim/_sportlink');
  ok(lijst.koppelingen['501'] === 't11' && lijst.teams[0].poules.length === 2, 'teamlijst met poules en koppelingen');
  const ov = doc('clubs/c1/geheim/_afgelast');
  ok(ov.rijen.length === 1 && ov.rijen[0].teamId === 't11' && ov.rijen[0].teamNaam === 'O11-1', 'clubscherm-overzicht afgelast');
  ok(doc('clubs/c1').sportlinkClubcode === 'XXTT12Z', 'clubcode vastgelegd');

  /* afgelasting ingetrokken + wedstrijd weer terug */
  SL.afgelastingen = [];
  SL._prog.push({ wedstrijdcode: 1009, wedstrijddatum: T(9), aanvangstijd: '10:00', thuisteamid: 501, uitteamid: 780, uitteam: 'Weg FC' });
  aanroepen.length = 0;
  await sync();
  ok(!doc('teams/t11/wedstrijden/sl_1001').status && !doc('teams/t11/wedstrijden/sl_1001').afgelastOp, 'afgelasting ingetrokken → status weg');
  ok(!doc('teams/t11/wedstrijden/sl_1009').sportlinkWeg, 'wedstrijd weer in Sportlink → markering weg');
  ok(!aanroepen.includes('wedstrijd-accommodatie'), 'accommodatie niet opnieuw opgevraagd (cache)');
  ok(doc('clubs/c1/geheim/_afgelast').rijen.length === 0, 'overzicht leeg');

  /* programma faalt → niets als verdwenen markeren */
  SL.programma = undefined;
  await sync();
  ok(!doc('teams/t11/wedstrijden/sl_1002').sportlinkWeg, 'programma-fout: niets gemarkeerd');
  standaardSL();

  /* weekendcontrole: alleen afgelastingen, via koppelingen */
  zetKlaar(); await sync();
  store.set('teams/t11/wedstrijden/sl_1002', { ...doc('teams/t11/wedstrijden/sl_1002'), status: undefined });
  SL.afgelastingen.push({ wedstrijdcode: 1002, wedstrijddatum: T(13, '09:00'), thuisteamid: '501', uitteamid: '778', status: 'Afgelast', wedstrijd: 'x - y' });
  aanroepen.length = 0;
  const { checkAfgelastingenClub } = F._intern || {};
  if (checkAfgelastingenClub){
    const c = await checkAfgelastingenClub(fake.db, 'c1', 'k7Rq2pX9aW');
    ok(c.gemarkeerd === 1 && doc('teams/t11/wedstrijden/sl_1002').status === 'afgelast', `weekendcontrole markeert (${JSON.stringify(c)})`);
    ok(aanroepen.join() === 'afgelastingen', 'weekendcontrole: één Sportlink-call');
    ok(doc('clubs/c1/geheim/_afgelast').rijen.length === 2, 'overzicht bijgewerkt');
  } else ok(false, 'checkAfgelastingenClub niet bereikbaar');

  /* clubinfo */
  zetKlaar();
  const info = await F.sportlinkClubInfo({ auth: { uid: 'u9', token: { firebase: { sign_in_provider: 'password' } } }, data: { clientId: 'k7Rq2pX9aW' } });
  ok(info.gevonden && info.clubnaam === 'VV Voorbeeld' && info.kleur === '#1f8f4e' && info.aantalTeams === 2 && info.metBeker === 1, 'clubinfo: gevonden met teams');
  ok(!JSON.stringify(info).includes('NL00BANK') && !JSON.stringify(info).includes('Jansen'), 'clubinfo: geen bank of secretaris');
  ok(info.bestaatAl === false, 'clubinfo: nog niet op Cluppie');
  store.set('clubs/c1', { ...doc('clubs/c1'), sportlinkClubcode: 'XXTT12Z' });
  const info2 = await F.sportlinkClubInfo({ auth: { uid: 'u9', token: { firebase: {} } }, data: { clientId: 'k7Rq2pX9aW' } });
  ok(info2.bestaatAl === true, 'clubinfo: dubbele club herkend');
  const info3 = await F.sportlinkClubInfo({ auth: { uid: 'adm', token: { firebase: {} } }, data: { clientId: 'k7Rq2pX9aW', clubId: 'c1' } });
  ok(info3.bestaatAl === false, 'clubinfo: eigen club telt niet als dubbel (koppeling testen)');
  SL.clubgegevens = [];
  ok((await F.sportlinkClubInfo({ auth: { uid: 'u8', token: { firebase: {} } }, data: { clientId: 'onbekend123' } })).gevonden === false, 'clubinfo: onbekende ID');
  let fout = null;
  for (let i = 0; i < 11; i++){ try { await F.sportlinkClubInfo({ auth: { uid: 'spam', token: { firebase: {} } }, data: { clientId: 'k7Rq2pX9aW' } }); } catch (e){ fout = e; } }
  ok(fout && fout.code === 'resource-exhausted', 'clubinfo: max 10 per uur');
  try { await F.sportlinkClubInfo({ auth: { uid: 'x', token: { firebase: { sign_in_provider: 'anonymous' } } }, data: { clientId: 'k7Rq2pX9aW' } }); ok(false, 'anoniem geweigerd'); }
  catch (e){ ok(e.code === 'unauthenticated', 'clubinfo: anoniem geweigerd'); }

  /* [20261012e] spelers uit de teamindeling */
  zetKlaar(); await sync();
  store.set('clubs/c1', { ...doc('clubs/c1'), instellingen: { privacy: { achternamen: false } } });
  store.set('teams/t11', { ...doc('teams/t11'), leden: { coach1: true } });
  SL['team-indeling'] = q => q.get('teamcode') === '501' ? [
    { relatiecode: 'AB12CD3', naam: 'Luuk Bakker', voornaam: 'Luuk', achternaam: 'Bakker', rol: 'Teamspeler', email: 'x@y.nl' },
    { naam: 'Afgeschermd', voornaam: 'Afgeschermd', achternaam: 'Afgeschermd', rol: 'Teamspeler' },
    { naam: 'Thijs Trainer', voornaam: 'Thijs', rol: 'Technische staf' },
  ] : [];
  const req = (uid, data) => ({ auth: { uid, token: { firebase: { sign_in_provider: 'password' } } }, data });
  const sp = await F.sportlinkTeamSpelers(req('coach1', { clubId: 'c1', teamId: 't11' }));
  ok(sp.gekoppeld && sp.totaal === 2 && sp.afgeschermd === 1 && JSON.stringify(sp.zichtbaar) === '[{"voornaam":"Luuk"}]', `spelers: alleen zichtbare voornaam (${JSON.stringify(sp)})`);
  ok(!JSON.stringify(sp).includes('Bakker') && !JSON.stringify(sp).includes('AB12CD3') && !JSON.stringify(sp).includes('Thijs'), 'spelers: geen achternaam (club uit), lidnummer of staf');
  store.set('clubs/c1', { ...doc('clubs/c1'), instellingen: { privacy: { achternamen: true } } });
  ok((await F.sportlinkTeamSpelers(req('coach1', { clubId: 'c1', teamId: 't11' }))).zichtbaar[0].achternaam === 'Bakker', 'spelers: achternaam als de club dat vastlegt');
  try { await F.sportlinkTeamSpelers(req('vreemde', { clubId: 'c1', teamId: 't11' })); ok(false, 'niet-lid geweigerd'); }
  catch (e){ ok(e.code === 'permission-denied', 'spelers: niet-lid van de club geweigerd'); }
  store.set('clubs/c1', { ...doc('clubs/c1'), leden: { ...(doc('clubs/c1').leden || {}), andereCoach: true } });
  try { await F.sportlinkTeamSpelers(req('andereCoach', { clubId: 'c1', teamId: 't11' })); ok(false, 'coach van ander team geweigerd'); }
  catch (e){ ok(e.code === 'permission-denied', 'spelers: coach van een ander team geweigerd'); }
  ok((await F.sportlinkTeamSpelers(req('adm', { clubId: 'c1', teamId: 't11' }))).gekoppeld, 'spelers: clubbeheerder mag');
  store.delete('clubs/c1/geheim/t13');
  ok((await F.sportlinkTeamSpelers(req('adm', { clubId: 'c1', teamId: 't13' }))).gekoppeld === false, 'spelers: niet gekoppeld team → gekoppeld:false');

  console.log(process.exitCode ? 'sportlink-sync: FOUTEN' : 'sportlink-sync: alle controles geslaagd');
})().catch(e => { console.error(e); process.exitCode = 1; });
