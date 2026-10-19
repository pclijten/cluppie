// Test van het anonieme leren van gebruik (functions/leren.js, fase 1h).
// Draaien: node --no-warnings tests/leren.test.mjs  (na `cd functions && npm install`)
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fake = require('./fake-firestore.js');
const orig = Module._load;
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError: class extends Error { constructor(c, m){ super(m); this.code = c; } } };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue };
  return orig.call(this, r, ...a);
};
const L = require('../functions/leren.js');
const { store, db, FieldValue } = fake;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

/* ---- schoonSignaal: alleen de whitelist komt door ---- */
const basis = { actie: 'vorm_bewaard', leeftijd: 10, vormId: 'pos-vierhoek-1', slot: 'kern1' };
const s1 = L.schoonSignaal({ ...basis, naam: 'Jan', teamnaam: 'JO11-1', tekst: 'vrije tekst', uid: 'u1' });
ok(JSON.stringify(s1) === JSON.stringify({ actie: 'vorm_bewaard', groep: 'O9-O11', vormId: 'pos-vierhoek-1', slot: 'kern1' }), 'onbekende velden (naam, teamnaam, tekst, uid) vallen weg; exacte leeftijd wordt een band');
ok(L.schoonSignaal({ ...basis, leeftijd: 5 }) === null && L.schoonSignaal({ ...basis, leeftijd: 'x' }) === null && L.schoonSignaal({ ...basis, leeftijd: 10.5 }) === null, 'ongeldige leeftijd geweigerd');
ok(L.schoonSignaal({ ...basis, actie: 'iets_anders' }) === null, 'onbekende actie geweigerd');
ok(L.schoonSignaal({ ...basis, vormId: 'Jan de Vries' }) === null && L.schoonSignaal({ ...basis, vormId: 'a' }) === null, 'vorm-id met spaties/hoofdletters of te kort geweigerd');
ok(L.schoonSignaal({ ...basis, slot: 'rest' }) === null, 'onbekend slot geweigerd');
ok(L.leeftijdsgroep(6) === 'O6-O8' && L.leeftijdsgroep(8) === 'O6-O8' && L.leeftijdsgroep(12) === 'O12-O14' && L.leeftijdsgroep(19) === 'O15+' && L.leeftijdsgroep(20) === null, 'leeftijdsbanden');
const tb = L.schoonSignaal({ actie: 'terugblik', leeftijd: 13, vormIds: ['a1', 'b2', 'a1'], thema: 'Positiespel opbouw', antwoord: { natuurlijk: 'ja', energie: 'veel', opnieuw: 'nee', extra: 'x' } });
ok(JSON.stringify(tb.antwoord) === JSON.stringify({ natuurlijk: 'ja', opnieuw: 'nee' }) && tb.vormIds.length === 2 && tb.thema === 'Positiespel opbouw', 'terugblik: ongeldig antwoord valt weg, dubbele vorm-id eruit');
ok(L.schoonSignaal({ actie: 'terugblik', leeftijd: 13, vormIds: ['a1'], antwoord: {} }) === null, 'terugblik zonder antwoord geweigerd');
ok(L.schoonSignaal({ actie: 'terugblik', leeftijd: 13, vormIds: ['a1'], antwoord: { natuurlijk: 'ja' }, thema: 'Jan zei: <script>' }) === null, 'thema met vreemde tekens geweigerd');
ok(L.schoonSignaal({ actie: 'materiaal_gekozen', leeftijd: 9, preset: 'ruim' }).preset === 'ruim' && L.schoonSignaal({ actie: 'materiaal_gekozen', leeftijd: 9, preset: 'duur' }) === null, 'materiaalkeuze');
ok(L.schoonSignaal({ actie: 'plan_gat', leeftijd: 9, reden: 'ruimte' }).reden === 'ruimte' && L.schoonSignaal({ actie: 'plan_gat', leeftijd: 9, reden: 'geld' }) === null, 'plan_gat: reden');

/* ---- pseudoniemen ---- */
ok(L.pseud('z1', 'team', 't1') === L.pseud('z1', 'team', 't1'), 'pseudoniem is stabiel');
ok(L.pseud('z1', 'team', 't1') !== L.pseud('z2', 'team', 't1') && L.pseud('z1', 'team', 't1') !== L.pseud('z1', 'club', 't1'), 'ander geheim of andere soort = ander pseudoniem');
ok(!L.pseud('z1', 'team', 't1').includes('t1'), 'pseudoniem bevat het id niet');

/* ---- tellen met drempel ---- */
const rij = (team, club, extra = {}) => ({ actie: 'vorm_gewisseld', groep: 'O9-O11', vormId: 'v1', slot: 'kern1', team, club, ...extra });
let rijen = [];
for (let i = 1; i <= 5; i++) rijen.push(rij('t' + i, i <= 2 ? 'c1' : i === 3 ? 'c2' : 'c3'));
let r = L.telSignalen(rijen);
ok(r.cellen.length === 1 && r.cellen[0].teams === 5 && r.cellen[0].clubs === 3 && r.cellen[0].vorm === 'v1', '5 teams van 3 clubs: cel komt erin');
r = L.telSignalen(rijen.slice(0, 4));
ok(r.cellen.length === 0 && r.weggelaten === 1, '4 teams: onder de drempel, niets getoond');
rijen = []; for (let i = 1; i <= 6; i++) rijen.push(rij('t' + i, i <= 3 ? 'c1' : 'c2'));
ok(L.telSignalen(rijen).cellen.length === 0, '6 teams maar 2 clubs: onder de drempel');
rijen = [...Array(50)].map(() => rij('t1', 'c1')); for (let i = 2; i <= 5; i++) rijen.push(rij('t' + i, 'c' + (i % 3 + 1)));
r = L.telSignalen(rijen);
ok(r.cellen.length === 1 && r.cellen[0].signalen === 3 + 4, 'één team kan maximaal 3 keer meetellen (50 signalen → 3)');
ok(L.telSignalen([rij('t1', 'c1'), ...[2, 3, 4, 5].map(i => rij('t' + i, 'c' + (i % 3 + 1), { groep: 'O12-O14' }))]).cellen.length === 0, 'verschillende leeftijdsgroepen tellen niet samen');
/* terugblik telt mee per vorm, met verdeling van de antwoorden */
const tbRij = (i, nat) => ({ actie: 'terugblik', groep: 'O9-O11', vormIds: ['v1', 'v2'], antwoord: { natuurlijk: nat, energie: 'meer' }, team: 't' + i, club: 'c' + (i % 3 + 1) });
r = L.telSignalen([1, 2, 3, 4, 5].map(i => tbRij(i, i <= 4 ? 'ja' : 'nee')));
const cV1 = r.cellen.find(c => c.vorm === 'v1');
ok(r.cellen.length === 2 && cV1.antwoorden.natuurlijk.ja === 4 && cV1.antwoorden.natuurlijk.nee === 1 && cV1.antwoorden.energie.meer === 5 && cV1.antwoorden.opnieuw.ja === 0, 'terugblik: per vorm een cel met verdeling');
ok(!JSON.stringify(r).includes('"t1"') && !JSON.stringify(r).includes('"c1"'), 'in de samenvatting staan geen team- of club-pseudoniemen');

/* ---- toestemming ---- */
ok(!L.lerenToegestaan({}) && !L.lerenToegestaan({ platformModules: { leren: true } }) && !L.lerenToegestaan({ instellingen: { leren: { meedoen: true } } }), 'beide schakelaars nodig');
ok(!L.lerenToegestaan({ platformModules: { leren: 'ja' }, instellingen: { leren: { meedoen: true } } }), 'alleen echte true telt (strikt)');
ok(L.lerenToegestaan({ platformModules: { leren: true }, instellingen: { leren: { meedoen: true } } }), 'beide aan: toegestaan');

/* ---- verwerken en samenvatten ---- */
const nu = Date.UTC(2026, 9, 19, 12);
function klaar(club = {}){
  store.clear();
  store.set('clubs/c1', { admins: { adm: true }, platformModules: { leren: true }, instellingen: { leren: { meedoen: true } }, ...club });
  store.set('clubs/c2', { admins: {}, platformModules: {}, instellingen: {} });
  store.set('teams/t1', { club: 'c1', naam: 'JO11-1', leden: { coach: true } });
  store.set('teams/t9', { club: 'c2', naam: 'Elders', leden: { coach: true } });
}
const stuur = (o) => L.verwerkSignalen({ db, FieldValue, clubId: 'c1', teamId: 't1', uid: 'coach', rol: 'coach', signalen: [{ ...basis }], nu, ...o });
klaar();
let res = await stuur({});
const rauw = [...store.entries()].filter(([p]) => p.startsWith('leersignalen/'));
ok(res.opgeslagen === 1 && rauw.length === 1, 'signaal opgeslagen');
const opgeslagen = rauw[0][1], json = JSON.stringify(opgeslagen);
ok(opgeslagen.maand === '2026-10' && opgeslagen.team.length === 20 && opgeslagen.club.length === 20, 'maand + pseudoniemen');
ok(!json.includes('"t1"') && !json.includes('c1"') && !json.includes('coach') && !json.includes('JO11'), 'geen team-id, club-id, gebruiker of teamnaam in het signaal');
ok(Object.keys(opgeslagen).sort().join() === 'actie,club,gemaakt,groep,maand,slot,team,vormId', 'precies de verwachte velden');
ok(store.has('leren_geheim/zout'), 'geheim aangemaakt op de server');
res = await stuur({}); ok(res.opgeslagen === 1 && [...store.keys()].filter(p => p.startsWith('leersignalen/')).length === 2, 'tweede signaal: zelfde geheim, zelfde team-pseudoniem');
ok([...store.values()].filter(v => v.actie === 'vorm_bewaard').every((v, _, a) => v.team === a[0].team), 'zelfde team = zelfde pseudoniem');

klaar({ instellingen: { leren: { meedoen: false } } });
res = await stuur({}); ok(res.opgeslagen === 0 && res.reden === 'uit' && ![...store.keys()].some(p => p.startsWith('leersignalen/')), 'club doet niet mee: niets opgeslagen');
klaar({ platformModules: {} });
res = await stuur({}); ok(res.opgeslagen === 0 && res.reden === 'uit', 'eindbaas heeft het niet aangezet: niets opgeslagen');
klaar(); res = await stuur({ teamId: 't9' }); ok(res.opgeslagen === 0 && res.reden === 'team', 'team van een andere club geweigerd');
klaar(); res = await stuur({ uid: 'vreemde', rol: 'coach' }); ok(res.opgeslagen === 0 && res.reden === 'team', 'geen lid van het team geweigerd');
klaar(); res = await stuur({ uid: 'adm', rol: 'club_admin' }); ok(res.opgeslagen === 1, 'clubadmin mag wel');
klaar(); res = await stuur({ signalen: [{ actie: 'x' }, { naam: 'Jan' }, null] }); ok(res.opgeslagen === 0 && res.reden === 'leeg', 'alleen ongeldige signalen: niets opgeslagen');
klaar(); res = await stuur({ signalen: Array(25).fill(basis) }); ok(res.opgeslagen === L.MAX_BATCH, `batch afgekapt op ${L.MAX_BATCH}`);
klaar(); for (let i = 0; i < 20; i++) await stuur({ signalen: Array(10).fill(basis) });
res = await stuur({}); ok(res.opgeslagen === 0 && res.reden === 'limiet', 'daglimiet per team');
res = await stuur({ nu: nu + 86400000 }); ok(res.opgeslagen === 1, 'volgende dag weer toegestaan');

/* samenvatten: ruwe signalen van 5 teams uit 3 clubs → één cel; oude signalen worden opgeruimd */
store.clear();
for (let i = 1; i <= 5; i++) store.set(`leersignalen/a${i}`, { ...rij('t' + i, 'c' + (i % 3 + 1)), maand: '2026-09' });
store.set('leersignalen/oud', { ...rij('t1', 'c1'), maand: '2025-03' });
store.set('leersignalen/net', { ...rij('t1', 'c1'), maand: '2025-10' });
const sam = await L.samenvatten({ db, FieldValue, nu });
const st = store.get('leerstatistiek/2026-10');
ok(sam.cellen === 1 && st.cellen.length === 1 && st.periode.van === '2025-11' && st.periode.tot === '2026-10', 'samenvatting over de laatste 12 maanden');
ok(st.drempel.teams === 5 && st.drempel.clubs === 3, 'drempel in het document');
ok(!store.has('leersignalen/oud') && store.has('leersignalen/net') && sam.opgeruimd === 1, 'signalen ouder dan 13 maanden verwijderd');
ok(!JSON.stringify(st).includes('"c1"') && !JSON.stringify(st).includes('"t1"'), 'samenvatting zonder pseudoniemen');

console.log(process.exitCode ? '\nFOUTEN' : '\nleren: alle controles geslaagd');
