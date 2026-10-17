// Sportlink-uitbreidingen 20261012a: clubgegevens, poules, wedstrijdinfo, afgelastingen.
// Voorbeelden zijn de echte veldvormen van de Club.Dataservice (12-10-2026), met verzonnen waarden.
// Draaien: node tests/sportlink-meer.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const h = require('../functions/sportlink-hulp.js');
const { controleerAanmelding } = require('../functions/aanmelding.js');

let n = 0; const ok = (naam, fn) => { fn(); n++; console.log('OK  ', naam); };

/* ---------- 1. clubgegevens ---------- */
const LOGO = 'iVBORw0KGgo' + 'A'.repeat(400) + '==';
const clubgegevens = [{ gegevens: {
  thuisshirtkleur: 'Groen / Wit, verticaal gestreept', clubcode: 'XXTT12Z', clubnaam: 'VV Voorbeeld',
  plaats: "'S-HERTOGENBOSCH", website: 'http://www.voorbeeld.nl', logo: LOGO,
  banknummer: 'NL00BANK0123456789', kvknummer: '12345678', naamsecretaris: 'J. Jansen',
  telefoonnummer: '0612345678', email: 'secretariaat@voorbeeld.nl', straatnaam: 'Postbus',
} }];

ok('clubgegevens: alleen toegestane velden', () => {
  const c = h.filterClubgegevens(clubgegevens);
  assert.deepEqual(Object.keys(c).sort(), ['clubcode', 'clubnaam', 'kleur', 'kleurTekst', 'logo', 'plaats', 'website']);
  const tekst = JSON.stringify(c);
  for (const geheim of ['NL00BANK', '12345678', 'Jansen', '0612345678', 'secretariaat@', 'Postbus']) assert.ok(!tekst.includes(geheim), geheim);
});
ok('clubgegevens: waarden netjes', () => {
  const c = h.filterClubgegevens(clubgegevens);
  assert.equal(c.clubnaam, 'VV Voorbeeld'); assert.equal(c.clubcode, 'XXTT12Z');
  assert.equal(c.plaats, "'s-Hertogenbosch"); assert.equal(c.kleur, '#1f8f4e');
  assert.ok(c.logo.startsWith('data:image/png;base64,iVBOR'));
});
ok('clubgegevens: leeg of onbekend → null', () => {
  assert.equal(h.filterClubgegevens([]), null);
  assert.equal(h.filterClubgegevens([{ gegevens: { clubnaam: 'X' } }]), null);
  assert.equal(h.filterClubgegevens({ gegevens: { clubnaam: 'X', clubcode: 'ab1', logo: '<script>' } }).logo, '');
});
ok('kleur uit tenuetekst', () => {
  assert.equal(h.kleurUitTekst('Rood / Wit, verticaal gestreept'), '#d32f2f');
  assert.equal(h.kleurUitTekst('Wit / Blauw'), '#1f5fbf');          // wit telt alleen als er niets anders is
  assert.equal(h.kleurUitTekst('Wit'), '#ffffff');
  assert.equal(h.kleurUitTekst('Lichtblauw/Wit'), '#3d9be0');       // niet "blauw"
  assert.equal(h.kleurUitTekst('Geel en Zwart'), '#f2c200');
  assert.equal(h.kleurUitTekst('Ruitjes'), null);
  assert.equal(h.kleurUitTekst(''), null);
});
ok('plaats netjes', () => {
  assert.equal(h.netjesPlaats('AARLE-RIXTEL'), 'Aarle-Rixtel');
  assert.equal(h.netjesPlaats('5708DW HELMOND'), '5708 DW Helmond');
  assert.equal(h.netjesPlaats("'T ZANDT"), "'t Zandt");
});
ok('aanmelding: Sportlink-velden mee, rommel eruit', () => {
  const goed = { clubNaam: 'VV Voorbeeld', contactNaam: 'Jan', contactEmail: 'jan@club.nl', akkoord: true };
  const d = controleerAanmelding({ ...goed, sportlinkClientId: 'k7Rq2pX9aW', sportlinkClubcode: 'xxtt12z', kleur: '#1F8F4E', logo: 'data:image/png;base64,iVBOR==' }).data;
  assert.equal(d.sportlinkClientId, 'k7Rq2pX9aW'); assert.equal(d.sportlinkClubcode, 'XXTT12Z'); assert.equal(d.kleur, '#1f8f4e');
  assert.ok(d.logo);
  const r = controleerAanmelding({ ...goed, sportlinkClientId: 'a b', kleur: 'red', logo: 'javascript:x', sportlinkClubcode: '!' }).data;
  for (const k of ['sportlinkClientId', 'sportlinkClubcode', 'kleur', 'logo']) assert.equal(r[k], undefined, k);
  assert.equal(controleerAanmelding({ ...goed, logo: 'data:image/png;base64,' + 'A'.repeat(200000) }).data.logo, undefined);
});

/* ---------- 2. poules ---------- */
const teamregels = [
  { teamcode: 134095, poulecode: 801, competitiesoort: 'regulier', klassepoule: '4e klasse B' },
  { teamcode: 134095, poulecode: 905, competitiesoort: 'beker', klassepoule: 'Groep 1 ronde 1' },
  { teamcode: 134095, poulecode: 912, competitiesoort: 'beker', klassepoule: 'Groep 3 ronde 2' },
  { teamcode: 134096, poulecode: 802, competitiesoort: 'regulier', klassepoule: '5e klasse A' },
  { teamcode: 134097, poulecode: null, competitiesoort: 'regulier' },
];
ok('poules per team, beker = nieuwste ronde', () => {
  const p = h.poulesPerTeam(teamregels);
  assert.equal(p.get('134095').length, 3);
  assert.equal(h.bekerPoule(p.get('134095')).poulecode, '912');
  assert.equal(h.bekerPoule(p.get('134096')), null);
  assert.equal(p.has('134097'), false);
});
ok('soort van competitiesoort', () => {
  assert.equal(h.soortVan('regulier'), 'regulier'); assert.equal(h.soortVan('beker'), 'beker');
  assert.equal(h.soortVan('Oefenwedstrijd'), 'oefen'); assert.equal(h.soortVan(''), null);
});

/* ---------- 4. wedstrijdinfo ---------- */
const prog = {
  accommodatie: 'Sportpark De Kempen ', veld: 'veld 3', plaats: 'REUSEL', verzameltijd: '', vertrektijd: '9:45',
  kleedkamerthuisteam: '2', kleedkameruitteam: '4', scheidsrechter: 'P. Pupil', scheidsrechters: 'P. Pupil',
};
ok('wedstrijdinfo: eigen kleedkamer, geen scheidsrechter, geen lege velden', () => {
  const uit = h.infoUitRegel(prog, false);
  assert.deepEqual(uit, { accommodatie: 'Sportpark De Kempen', veld: 'veld 3', plaats: 'Reusel', vertrek: '09:45', kleedkamer: '4' });
  assert.equal(h.infoUitRegel(prog, true).kleedkamer, '2');
  assert.ok(!JSON.stringify(uit).includes('Pupil'));
  assert.deepEqual(h.infoUitRegel({}, true), {});
});
ok('accommodatie: adres en route', () => {
  const a = h.accommodatieUit([{ wedstrijd: { accommodatienaam: 'Sportpark Molenven', adres: 'Molenven 7', plaats: '5708DW HELMOND', telefoonnummer: '0492-555005', route: 'http://x' } }]);
  assert.equal(a.adres, 'Molenven 7'); assert.equal(a.plaats, '5708 DW Helmond');
  assert.equal(a.route, 'https://www.google.com/maps/search/?api=1&query=Molenven%207%2C%205708%20DW%20Helmond');
  assert.equal(h.accommodatieUit([{ wedstrijd: {} }]), null);
  assert.equal(h.accommodatieSleutel('Sportpark Molenven', 'HELMOND'), 'sportparkmolenven_helmond');
});

/* ---------- 3. afgelastingen ---------- */
ok('afgelast-regel uit het endpoint', () => {
  const a = h.afgelastRegel({ wedstrijdcode: 20789183, thuisteamid: '134099', uitteamid: '362153', status: 'Afgelast',
    wedstrijddatum: '2026-10-25T11:00:00+0100', aanvangstijd: '11:00', wedstrijd: "Club 5 - Andere club 6" });
  assert.deepEqual(a, { code: '20789183', datum: '2026-10-25', tijd: '11:00', thuisCode: '134099', uitCode: '362153', wedstrijd: 'Club 5 - Andere club 6' });
  assert.equal(h.afgelastRegel({ wedstrijdcode: 1, status: 'Te spelen', wedstrijddatum: '2026-10-25T11:00' }), null);
});
const basis = { vanaf: '2026-10-12', tot: '2027-02-08' };
const w = (id, datum, extra = {}) => ({ id, sportlinkCode: id.replace('sl_', ''), datum, ...extra });
ok('afgelast: markeren', () => {
  const plan = h.afgelastPlan({ ...basis, bestaand: [w('sl_1', '2026-10-18')], inProgramma: new Set(), afgelast: new Map([['1', {}]]) });
  assert.deepEqual(plan, [['sl_1', { status: 'afgelast' }]]);
});
ok('afgelast: al gemarkeerd → niets', () => {
  assert.deepEqual(h.afgelastPlan({ ...basis, bestaand: [w('sl_1', '2026-10-18', { status: 'afgelast' })], inProgramma: new Set(), afgelast: new Map([['1', {}]]) }), []);
});
ok('afgelasting ingetrokken → status weg', () => {
  assert.deepEqual(h.afgelastPlan({ ...basis, bestaand: [w('sl_1', '2026-10-18', { status: 'afgelast' })], inProgramma: new Set(['1']), afgelast: new Map() }),
    [['sl_1', { status: null }]]);
});
ok('verdwenen uit programma → sportlinkWeg, terug → weg eraf', () => {
  assert.deepEqual(h.afgelastPlan({ ...basis, bestaand: [w('sl_2', '2026-10-25')], inProgramma: new Set(['9']), afgelast: new Map() }),
    [['sl_2', { sportlinkWeg: true }]]);
  assert.deepEqual(h.afgelastPlan({ ...basis, bestaand: [w('sl_2', '2026-10-25', { sportlinkWeg: true })], inProgramma: new Set(['2']), afgelast: new Map() }),
    [['sl_2', { sportlinkWeg: null }]]);
});
ok('vandaag en buiten het venster: nooit "verdwenen"', () => {
  const bestaand = [w('sl_3', '2026-10-12'), w('sl_4', '2027-03-01')];
  assert.deepEqual(h.afgelastPlan({ ...basis, bestaand, inProgramma: new Set(['9']), afgelast: new Map() }), []);
});
ok('programma niet opgehaald → niets als verdwenen markeren', () => {
  assert.deepEqual(h.afgelastPlan({ ...basis, bestaand: [w('sl_2', '2026-10-25')], inProgramma: null, afgelast: new Map() }), []);
});
ok('weekendvenster', () => {
  assert.equal(h.inAfgelastVenster(5, 15), false); assert.equal(h.inAfgelastVenster(5, 16), true);
  assert.equal(h.inAfgelastVenster(6, 7), true); assert.equal(h.inAfgelastVenster(6, 15), false);
  assert.equal(h.inAfgelastVenster(0, 14), true); assert.equal(h.inAfgelastVenster(3, 10), false);
});

/* ---------- 6. clubgids (20261012h) ---------- */
ok('clubgids: clubnaam uit teamnamen', () => {
  assert.equal(h.clubNaamUitTeams(['SV de Middenpeel O12-1JM']), 'SV de Middenpeel');
  assert.equal(h.clubNaamUitTeams(['Gemert O12-3', 'Gemert 1']), 'Gemert');
  assert.equal(h.clubNaamUitTeams(["SSA/SJO VBC'25 O12-1"]), "SSA/SJO VBC'25");
  assert.equal(h.clubNaamUitTeams(['Stiphout Vooruit MO20-1 (9-tal)']), 'Stiphout Vooruit');
  assert.equal(h.clubNaamUitTeams(['Mifano 3']), 'Mifano');
  assert.equal(h.clubNaamUitTeams([]), '');
});
ok('clubgids: uit wedstrijdregels, meest gebruikte sportpark', () => {
  const per = h.gidsUitRegels([
    { thuisteamclubrelatiecode: 'tmkg482', thuisteam: 'SV de Middenpeel O12-1JM', uitteamclubrelatiecode: 'BBHT73Z', uitteam: "ASV'33 O12-1", accommodatie: 'Sportpark De Blaarpeel' },
    { thuisteamclubrelatiecode: 'TMKG482', thuisteam: 'SV de Middenpeel 1', accommodatie: 'Sportpark De Blaarpeel', plaats: 'MILHEEZE' },
    { thuisteamclubrelatiecode: 'TMKG482', thuisteam: 'SV de Middenpeel VR1', accommodatie: 'Sporthal' },
    { thuisteamclubrelatiecode: '!!', thuisteam: 'Rommel' },
  ]);
  assert.deepEqual([...per.keys()].sort(), ['BBHT73Z', 'TMKG482']);
  const g = per.get('TMKG482');
  assert.equal(g.teams.size, 3); assert.equal(g.plaats, 'Milheeze');
  const doc = h.gidsSamenvoegen(null, g);
  assert.equal(doc.naam, 'SV de Middenpeel'); assert.equal(doc.accommodatie, 'Sportpark De Blaarpeel');
  assert.match(doc.route, /Sportpark%20De%20Blaarpeel/); assert.equal(doc.adres, undefined);
  assert.equal(h.gidsSamenvoegen(doc, g), null, 'niets veranderd → niet schrijven');
  const metAdres = h.gidsSamenvoegen(doc, g, { adres: 'Blaarpeel 2', plaats: '5763 AA Milheeze', route: 'https://www.google.com/maps/search/?api=1&query=z' });
  assert.equal(metAdres.adres, 'Blaarpeel 2'); assert.equal(metAdres.route, 'https://www.google.com/maps/search/?api=1&query=z');
  assert.equal(h.gidsSamenvoegen(metAdres, g), null, 'zonder nieuw adres verandert er niets: het bekende adres blijft');
});

/* ---------- client: wedstrijd-status.js (geen imports, dus direct te laden) ---------- */
const ws = await import('../public/js/wedstrijd-status.js');
const wUit = { id: 'sl_1', datum: '2026-10-25', aftrap: '11:00', thuis: false, tegenstander: 'FC Kempen O11-1', bron: 'sportlink',
  competitiesoort: 'beker', selectie: ['p1'], afwezigRedenen: { p2: { id: 'ziek' } },
  info: { accommodatie: 'Sportpark De Kempen', veld: 'veld 3', vertrek: '10:00', verzamel: '09:30', kleedkamer: '4',
    adres: 'Kempenweg 12', plaatsAdres: '5541 AB Reusel', route: 'https://www.google.com/maps/search/?api=1&query=x' },
  infoEigen: { verzamel: '09:45' } };
ok('client: eigen plek gaat voor, zonder oude Sportlink-adres', () => {
  const w = { thuis: false, info: { accommodatie: 'SL-park', adres: 'SL-straat 1', route: 'https://www.google.com/maps/search/?api=1&query=sl' },
    infoEigen: { accommodatie: 'Sportpark De Kluis', route: 'https://www.google.com/maps/search/?api=1&query=kluis' } };
  const i = ws.wedstrijdInfo(w);
  assert.equal(i.accommodatie, 'Sportpark De Kluis'); assert.equal(i.adres, ''); assert.match(i.route, /kluis/);
  const t = ws.deelTekst({ ...w, datum: '2026-10-13', tegenstander: 'Mifano', aftrap: '18:30' }, 'O12-1');
  assert.match(t, /Route: https/); assert.ok(!/SL-straat/.test(t));
  assert.match(ws.deelTekst({ type: 'toernooi', tegenstander: 'Pinkstertoernooi', datum: '2026-10-13', thuis: true, infoEigen: {} }, 'O12-1'), /— Pinkstertoernooi/);
});
ok('client: coachtijd gaat voor Sportlink', () => {
  const i = ws.wedstrijdInfo(wUit);
  assert.deepEqual(i.verzamel, { t: '09:45', bron: 'eigen' }); assert.deepEqual(i.vertrek, { t: '10:00', bron: 'sportlink' });
  assert.equal(ws.wedstrijdInfo({ info: { route: 'javascript:alert(1)' } }).route, '');
});
ok('client: deelbericht zonder spelers, met plek en route', () => {
  const t = ws.deelTekst(wUit, 'VV Voorbeeld O11-1');
  assert.match(t, /^Zo 25 okt — FC Kempen O11-1 – VV Voorbeeld O11-1/);
  assert.match(t, /Verzamelen 09:45, vertrek 10:00/); assert.match(t, /Aftrap 11:00, Sportpark De Kempen, veld 3/);
  assert.match(t, /Kleedkamer 4/); assert.match(t, /Adres: Kempenweg 12, 5541 AB Reusel/); assert.match(t, /Route: https/);
  assert.ok(!/p1|p2|ziek/.test(t));
  assert.match(ws.deelTekst({ ...wUit, status: 'afgelast' }, 'X'), /afgelast/);
});
ok('client: pills, badges en wat meetelt', () => {
  assert.match(ws.soortPill(wUit), /Beker/); assert.equal(ws.soortPill({ competitiesoort: 'regulier' }), '');
  assert.equal(ws.telMee({ status: 'afgelast' }), false); assert.equal(ws.telMee(wUit), true);
  assert.match(ws.statusBadge({ status: 'afgelast', sportlinkWeg: true }), /Afgelast/);
  assert.match(ws.statusBadge({ sportlinkWeg: true }), /Niet in Sportlink/);
  assert.equal(ws.statusBadge(wUit), '');
  assert.equal(ws.plekKort(wUit), 'Sportpark De Kempen · veld 3');
});
ok('client: melding alleen voor afgelast binnen 7 dagen', () => {
  const lijst = [{ id: 'a', status: 'afgelast', datum: '2026-10-18' }, { id: 'b', status: 'afgelast', datum: '2026-10-30' },
    { id: 'c', datum: '2026-10-18' }, { id: 'd', status: 'afgelast', datum: '2026-10-11' }];
  assert.deepEqual(ws.afgelastMeldingen(lijst, '2026-10-12').map(w => w.id), ['a']);
  assert.match(ws.htmlAfgelastBanner(lijst, 'O11-1', '2026-10-12'), /afgelast/);
  assert.equal(ws.htmlAfgelastBanner([], 'O11-1', '2026-10-12'), '');
});

/* ---------- 20261012e: spelers uit de teamindeling ---------- */
const indeling = [
  { relatiecode: 'AB12CD3', naam: 'Luuk Bakker', voornaam: 'Luuk', achternaam: 'Bakker', tussenvoegsel: '', geslacht: 'Man', rol: 'Teamspeler', functie: '', email: 'x@y.nl', mobiel: '0612345678', foto: 'iVBOR' },
  { relatiecode: '', naam: 'Sem de Vries', voornaam: 'Sem', achternaam: 'Vries', tussenvoegsel: 'de', rol: 'Teamspeler' },
  { naam: 'Afgeschermd', voornaam: 'Afgeschermd', achternaam: 'Afgeschermd', tussenvoegsel: 'Afgeschermd', rol: 'Teamspeler' },
  { naam: 'Afgeschermd', voornaam: 'Afgeschermd', achternaam: 'Afgeschermd', rol: 'Teamspeler' },
  { naam: 'Trainer Thijs', voornaam: 'Thijs', achternaam: 'Trainer', rol: 'Technische staf', functie: 'Trainer/coach' },
  { naam: 'Luuk Bakker', voornaam: 'Luuk', achternaam: 'Bakker', rol: 'Teamspeler' },
];
ok('spelers: alleen voornaam als de club geen achternamen vastlegt', () => {
  const r = h.spelersUitIndeling(indeling, { achternamen: false });
  assert.deepEqual(r, { zichtbaar: [{ voornaam: 'Luuk' }, { voornaam: 'Sem' }], afgeschermd: 2, totaal: 5 });
});
ok('spelers: achternaam (met tussenvoegsel) alleen als de club dat aan heeft', () => {
  const r = h.spelersUitIndeling(indeling, { achternamen: true });
  assert.deepEqual(r.zichtbaar, [{ voornaam: 'Luuk', achternaam: 'Bakker' }, { voornaam: 'Sem', achternaam: 'de Vries' }]);
});
ok('spelers: nooit staf, lidnummer, contact, foto of geslacht', () => {
  const t = JSON.stringify(h.spelersUitIndeling(indeling, { achternamen: true }));
  for (const verboden of ['Thijs', 'AB12CD3', 'x@y.nl', '0612345678', 'iVBOR', 'Man', 'Afgeschermd']) assert.ok(!t.includes(verboden), verboden);
});
ok('spelers: lege of rare invoer', () => {
  assert.deepEqual(h.spelersUitIndeling(null), { zichtbaar: [], afgeschermd: 0, totaal: 0 });
  assert.deepEqual(h.spelersUitIndeling([{ rol: 'Teamspeler', naam: '' }]), { zichtbaar: [], afgeschermd: 1, totaal: 1 });
  assert.deepEqual(h.spelersUitIndeling([{ rol: 'Teamspeler', naam: 'Noor Jansen' }]).zichtbaar, [{ voornaam: 'Noor' }]);
});

console.log(`sportlink-meer: alle ${n} controles geslaagd`);
