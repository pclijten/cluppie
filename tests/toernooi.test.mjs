// Tests voor de toernooiplanner (public/js/toernooi-logica.js). Draai: node tests/toernooi.test.mjs
import * as T from '../public/js/toernooi-logica.js';
let n = 0;
const ok = (v, m) => { if (!v) { console.error('MIS: ' + m); process.exit(1); } n++; };
const gelijk = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

// rondes
for (const k of [2, 3, 4, 5, 6, 7, 8]){
  const ids = Array.from({ length: k }, (_, i) => 't' + i), r = T.rondes(ids);
  const paren = r.flat().map(([a, b]) => [a, b].sort().join('-'));
  ok(paren.length === k * (k - 1) / 2 && new Set(paren).size === paren.length, `rondes ${k}: iedereen één keer tegen iedereen`);
  ok(r.every(ronde => new Set(ronde.flat()).size === ronde.length * 2), `rondes ${k}: niemand twee keer per ronde`);
}
ok(T.rondes(['a', 'b', 'c'], true).flat().length === 6, 'dubbel');
gelijk(T.rondes(['a']), [], 'één team');

// veldjes
const t0 = { velden: { v1: { naam: 'Veld 1', delen: 2, volg: 1 }, v2: { naam: 'Veld 2', delen: 1, volg: 2 }, v3: { naam: 'Veld 3', delen: 4, volg: 3 } } };
gelijk(T.veldjes(t0).map(v => v.naam), ['Veld 1 A', 'Veld 1 B', 'Veld 2', 'Veld 3 A', 'Veld 3 B', 'Veld 3 C', 'Veld 3 D'], 'veldjes');

// schema
const teams = {}; for (let i = 0; i < 5; i++) teams['a' + i] = { naam: 'A' + i, poule: 'pa', volg: i }; for (let i = 0; i < 4; i++) teams['b' + i] = { naam: 'B' + i, poule: 'pb', volg: i };
const t = { start: '09:00', duur: 10, wissel: 2, velden: { v1: { naam: 'Veld 1', delen: 2, volg: 1 } }, poules: { pa: { naam: 'A', volg: 1 }, pb: { naam: 'B', volg: 2 } }, teams };
const { schema, eind, waarschuwingen } = T.planSchema(t);
ok(schema.length === 10 + 6, 'alle wedstrijden gepland: ' + schema.length);
gelijk(waarschuwingen, [], 'geen waarschuwingen');
const perTijd = {}; for (const w of schema){ (perTijd[w.t] ||= []).push(w); }
ok(Object.values(perTijd).every(l => l.length <= 2 && new Set(l.flatMap(w => [w.a, w.b])).size === l.length * 2), 'niemand dubbel per tijd, max 2 veldjes');
ok(Object.values(perTijd).every(l => new Set(l.map(w => w.v)).size === l.length), 'één wedstrijd per veldje');
ok(/^\d\d:\d\d$/.test(eind) && T.naarMin(eind) > T.naarMin('09:00'), 'eindtijd ' + eind);
ok(schema.every(w => w.t.endsWith('0') || w.t.endsWith('2') || w.t.endsWith('4') || w.t.endsWith('6') || w.t.endsWith('8')), 'tijden in stappen van 12');
const rooster = T.teamRooster({ ...t, schema });
ok(rooster.a0.wedstrijden.length === 4 && rooster.b0.wedstrijden.length === 3, 'teamrooster');
// poule op eigen veld
const t2 = { ...t, velden: { v1: { naam: '1', volg: 1 }, v2: { naam: '2', volg: 2 } }, poules: { pa: { naam: 'A', velden: ['v1'] }, pb: { naam: 'B', velden: ['v2'] } } };
const s2 = T.planSchema(t2).schema;
ok(s2.filter(w => w.p === 'pa').every(w => w.v === 'v1') && s2.filter(w => w.p === 'pb').every(w => w.v === 'v2'), 'poule blijft op eigen veld');
ok(T.planSchema({ ...t, velden: {} }).waarschuwingen.length === 1, 'zonder velden');
ok(T.planSchema({ ...t, poules: { pa: { naam: 'A', start: '10:00' } }, teams: { x: { poule: 'pa' }, y: { poule: 'pa' } } }).schema[0].t === '10:00', 'starttijd poule');

// verplaatsen
const v1 = T.verplaats(schema, schema[0].id, { t: schema[1].t, v: schema[1].v });
ok(v1.schema.find(w => w.id === schema[0].id).v === schema[1].v, 'verplaatst');
const bot = schema.find(w => w.t !== schema[0].t && [w.a, w.b].some(id => id === schema[0].a));
if (bot){ const tegelijk = schema.find(w => w.t === bot.t && w.id !== bot.id); if (tegelijk) ok(T.verplaats(schema, schema[0].id, { t: bot.t, v: tegelijk.v === bot.v ? 'v1~A' : tegelijk.v }).fout !== undefined, 'verplaats geeft resultaat'); }

// stand
const uitslag = { [schema[0].id]: { a: 2, b: 1 }, [schema[1].id]: { a: 0, b: 0 } };
const st = T.stand({ ...t, schema, uitslag }, schema[0].p);
const win = st.find(r => r.id === schema[0].a);
ok(win.pnt === 3 && win.w === 1 && win.saldo === 1, 'stand winst');
ok(st[0].pnt >= st[st.length - 1].pnt, 'stand gesorteerd');
ok(T.gespeeld({ schema, uitslag }) === 2, 'gespeeld');
ok(T.stand({ ...t, schema, uitslag: { [schema[0].id]: { a: '', b: 1 } } }, schema[0].p).every(r => r.g === 0), 'lege uitslag telt niet');

// kleedkamers
const kkPlan = T.planKleedkamers({ ...t, schema, kk: { k1: { naam: 'K1', plekken: 2, volg: 1 }, k2: { naam: 'K2', plekken: 2, volg: 2 } } });
ok(Object.keys(kkPlan.kk).length + kkPlan.tekort.length === 9, 'iedereen een kleedkamer of tekort');
ok(Object.values(kkPlan.drukte).every(d => d <= 2), 'niet meer dan plekken');
ok(kkPlan.tekort.length > 0, 'te weinig kleedkamers gemeld');
const vast = T.planKleedkamers({ ...t, schema, teams: { ...teams, a0: { ...teams.a0, kk: 'k2' } }, kk: { k1: { naam: 'K1', plekken: 9 }, k2: { naam: 'K2', plekken: 9 } } });
ok(vast.kk.a0 === 'k2' && vast.tekort.length === 0, 'handmatige kleedkamer blijft');

// spelers inlezen
const r1 = T.spelersUitRijen([['Voornaam', 'Achternaam', 'Geboortedatum', 'Geslacht', 'Team'], ['Anna', 'de Vries', '12-03-2015', 'V', 'O11-2'], ['Bram', 'Jansen', '2014-05-01', 'Man', 'O11-1'], ['', '', '', '', '']]);
gelijk(r1.spelers, [{ naam: 'Anna de Vries', jaar: 2015, geslacht: 'v', bron: 'O11-2', tt: '' }, { naam: 'Bram Jansen', jaar: 2014, geslacht: 'm', bron: 'O11-1', tt: '' }], 'csv met kop');
const r2 = T.spelersUitRijen([['Naam', 'Leeftijd', 'Gender'], ['Cas', '9', 'jongen'], ['', '8', 'm']], { datum: '2026-12-19' });
ok(r2.spelers.length === 1 && r2.spelers[0].jaar === 2017 && r2.fouten.length === 1, 'leeftijd en fout zonder naam');
const r3 = T.spelersUitRijen([['Dirk', '2016', 'm', 'O9-1']]);
ok(r3.spelers[0].bron === 'O9-1' && r3.spelers[0].jaar === 2016, 'zonder kop: vaste volgorde');
gelijk(['meisje', 'Jongen', 'V', 'm', 'x'].map(T.geslachtUit), ['v', 'm', 'v', 'm', ''], 'geslacht');
ok(T.nieuweSpelers({ s1: { naam: 'Anna de Vries', jaar: 2015 } }, r1.spelers).length === 1, 'dubbelen eruit');

// regels en voorstel
const sp = {}; ['m', 'v'].forEach(g => [2015, 2016].forEach(j => { for (let i = 0; i < 7; i++) sp[`${g}${j}${i}`] = { naam: `${g}${j}${i}`, jaar: j, geslacht: g, bron: j === 2015 ? 'O11-1' : 'O10-1' }; }));
const vs = T.voorstelTeams(sp, { groepOp: ['team'], grootte: 7 });
ok(vs.length === 4 && vs.every(x => x.spelers.length === 7), 'voorstel per team: ' + vs.map(x => x.spelers.length));
ok(vs.every(x => x.eisen.bron.length === 1), 'eis eigen team');
const vg = T.voorstelTeams(sp, { groepOp: ['geslacht', 'jaar'], grootte: 7 });
ok(vg.length === 4 && vg.every(x => x.eisen.geslacht && x.eisen.van === x.eisen.tot), 'voorstel op geslacht en jaar');
const vl = T.voorstelTeams(sp, { groepOp: ['leeftijd'], grootte: 6 });
ok(vl.length === 1 ? false : vl.reduce((s, x) => s + x.spelers.length, 0) === 28, 'leeftijdsgroep alle spelers');
const team = { eisen: { geslacht: 'v', van: 2015, tot: 2016, bron: ['O11-1'] } };
gelijk(T.magInTeam({ geslacht: 'v', jaar: 2015, bron: 'O11-1' }, team), [], 'mag');
gelijk(T.magInTeam({ geslacht: 'm', jaar: 2014, bron: 'O10-1' }, team), ['alleen meisjes', 'te oud (vanaf 2015)', 'ander team'], 'mag niet');
ok(T.eisTekst(team.eisen) === 'Meisjes · 2015–2016 · O11-1' && T.eisTekst({}) === 'Iedereen', 'eistekst');
ok(T.controleerTeams({ teams: { t: team }, spelers: { a: { geslacht: 'm', jaar: 2015, bron: 'O11-1', tt: 't' }, b: { geslacht: 'v', jaar: 2015, bron: 'O11-1', tt: 't' } } }).length === 1, 'controle teams');
ok(T.groepSleutel({ jaar: 2015, geslacht: 'v' }, ['leeftijd', 'geslacht']) === '2014/2015 · Meisjes', 'sleutel');

// velden van de club
const blokken = [{ dag: 6, veld: 'v1', start: '08:30', eind: '09:30', team: 'x' }, { dag: 6, veld: 'v2', start: '08:30', eind: '09:30' }, { dag: 2, veld: 'v1', start: '18:00', eind: '19:00' }];
ok(T.veldConflicten(blokken, { datum: '2026-12-19', van: '09:00', tot: '13:00', velden: ['v1'] }).length === 1, 'conflict op zaterdag');
ok(T.veldConflicten(blokken, { datum: '', van: '09:00', tot: '13:00', velden: ['v1'] }).length === 0, 'zonder datum');

// export
const c = T.csvSchema({ ...t, schema, uitslag });
ok(c.startsWith('\ufeffTijd;Veld;Poule;Thuis;Uit;Uitslag') && c.includes('2-1'), 'csv schema');
ok(T.csvStand({ ...t, schema, uitslag }).split('\r\n').length === 10, 'csv stand');
ok(T.csvTeams({ ...t, schema, spelers: { s: { naam: 'Anna', tt: 'a0', jaar: 2015 } } }).includes('Anna'), 'csv teams');
ok(T.schoonSpeler({ naam: 'x'.repeat(80), jaar: '1800', geslacht: 'q' }).naam.length === 48, 'schoon speler');

// verenigingen en live
gelijk(T.teamsUitRijen([['Vereniging', 'Team', 'Poule'], ['SV Venray', 'JO11-1', 'A'], ['Volharding', '', ''], ['', 'x', '']]), [{ club: 'SV Venray', team: 'JO11-1', poule: 'A' }, { club: 'Volharding', team: 'Volharding', poule: '' }], 'teams plakken');
const act = { naam: 'Kerst', datum: '2026-12-19', locatie: 'Sportpark', toernooi: { ...t, schema, uitslag: { ...uitslag, w9: { a: '', b: 2 } }, clubs: { c1: { naam: 'SV Venray' } }, teams: { ...teams, a0: { ...teams.a0, club: 'c1' } },
  kk: { k1: { naam: 'K1', plekken: 9 } }, spelers: { s: { naam: 'Geheim Kind', tt: 'a0' } }, mededelingen: { m1: { tekst: 'Pauze', ms: 1 }, m2: { tekst: 'Finale op veld 1', ms: 2 }, m3: { tekst: '' } } } };
const lv = T.liveKopie(act, { clubNaam: 'Club' });
ok(!JSON.stringify(lv).includes('Geheim'), 'live: geen spelers');
ok(lv.teams.a0.club === 'SV Venray' && lv.teams.a0.kk === 'K1' && lv.veldjes.length === 2 && lv.schema.length === schema.length, 'live: teams, veldjes, schema');
ok(Object.keys(lv.uitslag).length === 2 && lv.mededelingen[0].tekst === 'Finale op veld 1' && lv.mededelingen.length === 2, 'live: uitslagen en mededelingen nieuwste eerst');
ok(T.stand(lv, schema[0].p).find(r => r.id === schema[0].a).pnt === 3, 'stand werkt op de live-kopie');
const ns = T.nuEnStraks(lv, T.naarMin('09:05'));
ok(ns.nuT === '09:00' && ns.straksT === '09:12' && ns.nu.length === 2 && ns.begonnen && !ns.klaar, 'nu en straks');
ok(T.nuEnStraks(lv, T.naarMin('08:00')).nuT === '' && T.nuEnStraks(lv, T.naarMin('08:00')).straksT === '09:00' && T.nuEnStraks(lv, T.naarMin('23:00')).klaar, 'voor en na');
ok(/^[a-z2-9]{20}$/.test(T.liveId()) && T.liveId() !== T.liveId(), 'live-id');
ok(T.csvTeams(act.toernooi).includes('SV Venray'), 'csv met vereniging');

/* sponsoren en eigen schermen */
const png = 'data:image/png;base64,iVBORw0KGgo=';
const sch = T.schermen({ schermen: { a: { soort: 'sponsor', titel: 'Bakker Jan', link: 'bakkerjan.nl', img: png, volg: 2 }, b: { soort: 'scherm', titel: 'Menu', tekst: 'Friet 2,50', volg: 1, tv: false }, c: { soort: 'scherm', titel: '', volg: 3 }, d: { soort: 'sponsor', titel: 'Fout', link: 'javascript:alert(1)', img: 'data:text/html;base64,AAAA', volg: 4 } } });
ok(sch.length === 3 && sch[0].titel === 'Menu' && sch[0].tv === false && sch[0].tel === true, 'schermen: volgorde, lege weg, tv uit');
ok(sch[1].link === 'https://bakkerjan.nl' && sch[1].img === png, 'sponsor: link en logo');
ok(sch[2].link === '' && sch[2].img === '', 'onveilige link en plaatje geweigerd');
ok(!T.plaatjeOk('data:image/png;base64,' + 'A'.repeat(T.MAX_PLAATJE)) && T.veiligeLink('http://x.nl/a b') === '', 'te groot plaatje en link met spatie');
ok(T.liveKopie({ toernooi: { schermen: { a: { soort: 'sponsor', titel: 'Bakker Jan' } } } }).schermen[0].soort === 'sponsor' && T.schermen({ schermen: { c: { titel: '' } } }, { leeg: true }).length === 1, 'schermen in de live-kopie');

/* wie doen er mee en online inschrijven */
ok(T.soort({}) === 'vereniging' && T.soort({ deelnemers: 'school' }) === 'school' && T.soort({ deelnemers: 'x' }) === 'vereniging' && T.soortTekst({ deelnemers: 'bedrijf' }).meer === 'bedrijven', 'soort deelnemers');
const tIns = { deelnemers: 'school', poules: { p1: { naam: 'A' } }, inschrijf: { open: true, tot: '2026-12-01', tekst: ' Welkom ', contactMail: 'geen-mail', betaalLink: 'tikkie.me/x', cats: { a: { naam: 'Groep 7/8', max: 2, prijs: '12,5', poule: 'p1', volg: 2 }, b: { naam: '', max: -3, prijs: 'x', poule: 'weg', volg: 1 } } } };
const cats = T.inschrijfCats(tIns);
ok(cats.length === 2 && cats[0].id === 'b' && cats[0].naam === 'Categorie' && cats[0].max === 0 && cats[0].prijs === 0 && cats[0].poule === '' && cats[1].prijs === 12.5 && cats[1].poule === 'p1', 'categorieën opgeschoond');
const ik = T.inschrijfKopie({ naam: 'Schooltoernooi', datum: '2026-12-16', toernooi: tIns }, { clubNaam: 'SV Demo', bezet: { a: 2 } });
ok(ik.soort === 'school' && ik.tekst === 'Welkom' && ik.contactMail === '' && ik.betaalLink === 'https://tikkie.me/x' && ik.cats.a.bezet === 2 && !('email' in ik), 'openbare kopie zonder contactgegevens');
ok(T.catVol(ik.cats.a) && !T.catVol(ik.cats.b) && T.inschrijvingDicht(ik, '2026-12-02') && !T.inschrijvingDicht(ik, '2026-12-01'), 'vol en gesloten');
ok(T.schoneInschrijving({ club: '', cat: 'a' }, ik.cats).veld === 'club' && T.schoneInschrijving({ club: 'X', cat: 'z' }, ik.cats).veld === 'cat' && T.schoneInschrijving({ club: 'X', cat: 'a', contact: 'Jan', email: 'jan' }, ik.cats).veld === 'email', 'inschrijving: verplichte velden');
const si = T.schoneInschrijving({ club: ' De  Regenboog ', cat: 'a', contact: 'Tom', email: 'tom@school.nl', tel: '06-12 34<script>', opm: 'x'.repeat(400) }, ik.cats);
ok(si.ok && si.data.club === 'De Regenboog' && si.data.team === 'De Regenboog' && si.data.tel === '06-12 34' && si.data.opm.length === 300, 'inschrijving opgeschoond');
const lijstIns = [{ cat: 'a', status: 'toegelaten', betaald: true, club: 'A', email: 'a@a.nl', ms: 2 }, { cat: 'a', status: 'toegelaten', club: 'B', ms: 1 }, { cat: 'a', status: 'afgewezen', club: 'C' }, { cat: 'b', status: 'nieuw', club: 'D' }, { cat: 'a', status: 'wachtlijst', club: 'E' }];
ok(T.bezetPerCat(lijstIns).a === 2 && T.bezetPerCat(lijstIns).b === 1, 'bezet per categorie');
const tot = T.inschrijfTotaal(lijstIns, tIns);
ok(tot.n === 5 && tot.nieuw === 1 && tot.toegelaten === 2 && tot.verwacht === 25 && tot.betaald === 12.5, 'totaal inschrijfgeld');
ok(T.csvInschrijvingen(lijstIns, tIns).split('\r\n')[0].includes('School;Team;Categorie') && T.csvInschrijvingen(lijstIns, tIns).includes('\r\nB;'), 'csv inschrijvingen');
ok(T.liveKopie({}, { logo: png, kleur: '#0055aa' }).logo === png && T.liveKopie({}, { logo: 'http://x/y.png', kleur: 'rood' }).logo === '' && T.inschrijfKopie({}, { kleur: '#0055AA' }).kleur === '#0055AA', 'clublogo en kleur');
ok(T.euro(15) === '€ 15,-' && T.euro(12.5) === '€ 12,50' && T.bedrag('1e9') === 0, 'bedragen');


// knock-out: kruisfinales, finale, om plaats 3 en plaatsingswedstrijden [20261127f]
{
  const t = { start: '09:00', duur: 10, wissel: 5, velden: { v1: { naam: 'Veld 1', volg: 1 }, v2: { naam: 'Veld 2', volg: 2 } },
    poules: { pA: { naam: 'Poule A', volg: 1 }, pB: { naam: 'Poule B', volg: 2 } },
    teams: Object.fromEntries(['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id, i) => [id, { naam: id.toUpperCase(), poule: id[0] === 'a' ? 'pA' : 'pB', volg: i }])),
    ko: { g1: { naam: 'Finales', poules: ['pA', 'pB'], ronde: 4, plaats3: true, overige: true, volg: 1 } } };
  const r = T.planSchema(t); t.schema = r.schema;
  const ko = r.schema.filter(w => w.ko), laatstePoule = Math.max(...r.schema.filter(w => w.fase === 'poule').map(w => T.naarMin(w.t)));
  gelijk(ko.map(w => w.fase).sort(), ['brons', 'finale', 'halve', 'halve', 'plaats'], 'ko: wedstrijden');
  ok(ko.every(w => T.naarMin(w.t) > laatstePoule), 'ko: na de poules');
  const hf = Math.max(...ko.filter(w => w.fase === 'halve').map(w => T.naarMin(w.t)));
  ok(ko.filter(w => w.fase === 'finale' || w.fase === 'brons').every(w => T.naarMin(w.t) > hf), 'ko: finale na de halve finales');
  gelijk(ko.filter(w => w.fase === 'halve').map(w => [w.ka, w.kb]), [[{ p: 'pA', r: 1 }, { p: 'pB', r: 2 }], [{ p: 'pB', r: 1 }, { p: 'pA', r: 2 }]], 'ko: kruislings');
  ok(T.metKo(t).filter(w => w.ko).every(w => !w.a && w.la), 'ko: nog onbekend zolang de poule loopt');
  t.uitslag = {}; for (const w of r.schema.filter(w => w.fase === 'poule')) t.uitslag[w.id] = { a: 1, b: 0 };
  const m = Object.fromEntries(T.metKo(t).map(w => [w.id, w]));
  ok(m['g1-h1'].a && m['g1-h1'].b && m['g1-p1'].a, 'ko: teams ingevuld als de poule klaar is');
  ok(!m['g1-f'].a && m['g1-f'].la === 'Winnaar HF1', 'ko: finale wacht op de halve finale');
  t.uitslag['g1-h1'] = { a: 1, b: 1, w: 'b' }; t.uitslag['g1-h2'] = { a: 3, b: 0 }; t.uitslag['g1-f'] = { a: 0, b: 2 };
  const m2 = Object.fromEntries(T.metKo(t).map(w => [w.id, w]));
  ok(m2['g1-f'].a === m2['g1-h1'].b && m2['g1-f'].b === m2['g1-h2'].a, 'ko: winnaar na strafschoppen gaat door');
  ok(m2['g1-b'].a === m2['g1-h1'].a, 'ko: verliezer naar om plaats 3');
  ok(T.koUitslag(t, 'g1')[0].id === m2['g1-f'].b, 'ko: kampioen');
  ok(T.stand(t, 'pA').every(x => x.g === 2), 'ko telt niet mee in de poulestand');
  ok(T.liveKopie({ toernooi: t }).schema.find(w => w.id === 'g1-f').titel === 'Finale', 'ko: titel op de live pagina');
  gelijk(T.koOpzet({ ...t, ko: {} }, { id: 'x', poules: ['pA'], ronde: 2 }).map(w => [w.ka, w.kb]), [[{ p: 'pA', r: 1 }, { p: 'pA', r: 2 }]], 'ko: één poule, finale 1 tegen 2');
  ok(T.koOpzet(t, { id: 'x', poules: ['pA', 'pB'], ronde: 8 }).filter(w => w.ronde === 1).length === 2, 'ko: 8 bij 6 teams wordt 4');
}
// kleedkamer met linker- en rechterhelft
{
  const t = { kk: { k1: { naam: 'Kleedkamer 1', plekken: 1, delen: 2, volg: 1 } }, start: '09:00', duur: 10, wissel: 0,
    teams: { a: { naam: 'A' }, b: { naam: 'B' }, c: { naam: 'C' } }, schema: [{ id: 'w1', a: 'a', b: 'b', t: '09:00', v: 'v' }, { id: 'w2', a: 'c', b: 'a', t: '09:10', v: 'v' }] };
  gelijk(T.kkDelen(t).map(k => k.naam), ['Kleedkamer 1 links', 'Kleedkamer 1 rechts'], 'kk: helften');
  const p = T.planKleedkamers(t);
  ok(new Set(Object.values(p.kk)).size === 2 && p.tekort.length === 1, 'kk: één team per helft');
  ok(T.kkNaam(t, 'k1~R') === 'Kleedkamer 1 rechts' && T.kkNaam({ kk: { k1: { naam: 'K' } } }, 'k1~R') === 'K', 'kk: naam van een helft');
}
// [20261127m] toernooi uit een bestand van een andere club
{
  const t = { start: '09:00', duur: 10, wissel: 2, velden: { v1: { naam: 'Veld 1', delen: 2, clubVeld: 'cv' }, 'v.x': { naam: 'Punt' } }, kk: { k1: { naam: 'KK 1', plekken: 2, delen: 2, clubKk: 'ck' } },
    poules: { pA: { naam: 'A', kleur: '#E20613', velden: ['v1~A', 'v9'] } }, ko: { g1: { naam: 'Finale', poules: ['pA', 'pZ'], ronde: 2 } },
    clubs: { c1: { naam: 'SV Een' }, c2: { naam: 'SV Twee' } }, teams: { t1: { naam: 'Een', poule: 'pA', club: 'c1', kk: 'k1~L', eisen: { bron: ['JO11-1'] } }, t2: { naam: 'Twee', poule: 'pA', club: 'c2' }, t3: { naam: 'Drie', poule: 'pA', club: 'c9' } },
    spelers: { s1: { naam: 'Kind', jaar: 2016 } }, uitslag: { w1: { a: 1, b: 0 } }, liveId: 'geheim', inschrijfId: 'geheim2', mededelingen: { m1: { tekst: 'x' } },
    inschrijf: { open: true, tot: '2027-01-01', contactMail: 'a@b.nl', cats: { g: { naam: 'JO11', prijs: 25, poule: 'pA' } } }, schermen: { x1: { soort: 'sponsor', titel: 'Bakker', link: 'javascript:x', img: 'data:text/html,x' } } };
  t.schema = [...T.planSchema(t).schema, { id: 'kapot', a: 't1', b: 't2', v: 'v9', t: '09:00' }];
  const s = T.schoonToernooi(t);
  ok(!s.spelers && !s.liveId && !s.inschrijfId && !s.mededelingen, 'toernooi-import: geen spelers, links of mededelingen');
  gelijk(s.uitslag, {}, 'toernooi-import: geen uitslagen'); ok(!s.velden['v.x'] && !('clubVeld' in s.velden.v1) && !('clubKk' in s.kk.k1), 'toernooi-import: geen koppeling met de andere club');
  gelijk(s.poules.pA.velden, ['v1~A'], 'toernooi-import: alleen bestaande veldjes'); gelijk(s.ko.g1.poules, ['pA'], 'toernooi-import: alleen bestaande poules');
  gelijk(s.teams.t1.kk, 'k1~L', 'toernooi-import: kleedkamerhelft'); gelijk(s.teams.t3.club, '', 'toernooi-import: onbekende club'); gelijk(s.teams.t1.eisen, {}, 'toernooi-import: eigen teamnamen weg');
  gelijk(s.inschrijf.open, false, 'toernooi-import: inschrijven dicht'); ok(!('contactMail' in s.inschrijf), 'toernooi-import: geen contact van de andere club');
  gelijk(s.schermen.x1.link, '', 'toernooi-import: onveilige link weg'); ok(!s.schermen.x1.img, 'toernooi-import: alleen plaatjes');
  ok(s.schema.length === t.schema.length - 1 && !s.schema.some(w => w.id === 'kapot'), 'toernooi-import: schema zonder kapotte wedstrijd');
  ok(s.schema.filter(w => w.ko).every(w => !w.a && !w.b && w.ka && w.kb), 'toernooi-import: knock-out met bron');
  const z = T.schoonToernooi(t, { indeling: false }); ok(!z.teams && !z.schema && z.clubs.c1, 'toernooi-import: zonder indeling');
  gelijk(T.schoonToernooi(null), {}, 'toernooi-import: leeg');
}


// automatisch indelen: poules, speeltijd en prijsuitreiking [20261127p]
{
  const teams = {}; let i = 0; for (const c of ['c1', 'c2', 'c3', 'c4']) for (let k = 0; k < 3; k++){ teams['t' + i] = { naam: c + '-' + k, club: c, volg: i }; i++; }
  const t = { start: '09:00', eind: '13:00', wissel: 3, prijs: 15, velden: { v1: { naam: 'V1', volg: 1 }, v2: { naam: 'V2', volg: 2 }, v3: { naam: 'V3', volg: 3 } }, teams };
  const r = T.autoIndeling(t);
  ok(r.past && T.naarMin(r.klaar) <= 13 * 60 && r.prijs.tot === r.klaar, 'auto: past binnen de tijd, met prijsuitreiking');
  ok(Object.keys(r.teamPoule).length === 12 && Object.keys(r.poules).length >= 2, 'auto: alle teams in een poule');
  const per = {}; for (const [tid, p] of Object.entries(r.teamPoule)) (per[p] ||= []).push(teams[tid].club);
  ok(Object.values(per).every(l => Math.max(...['c1', 'c2', 'c3', 'c4'].map(c => l.filter(x => x === c).length)) <= 2), 'auto: clubs gespreid over de poules');
  ok(Math.max(...Object.values(per).map(l => l.length)) - Math.min(...Object.values(per).map(l => l.length)) <= 1, 'auto: poules even groot');
  ok(r.schema.some(w => w.fase === 'finale'), 'auto: met finale');
  const kort = T.autoIndeling({ ...t, eind: '10:30' });
  ok(kort.past && kort.duur < r.duur, 'auto: minder tijd geeft kortere wedstrijden');
  const krap = T.autoIndeling({ ...t, eind: '09:20' });
  ok(!krap.past && krap.waarschuwingen.length === 1, 'auto: past niet, met uitleg');
  ok(T.autoIndeling({ ...t, duur: 8, duurVast: true }).duur === 8, 'auto: vaste speeltijd');
  ok(!T.autoIndeling({ ...t, autoKo: false }).schema.some(w => w.ko), 'auto: zonder finales');
  ok(T.autoIndeling({ ...t, eind: '' }).schema === undefined, 'auto: eindtijd nodig');
  ok(T.prijsuitreiking({ ...t, prijs: 0, schema: r.schema }) === null && T.liveKopie({ toernooi: { ...t, duur: r.duur, schema: r.schema } }).prijs.van === r.prijs.van, 'prijsuitreiking op de live pagina');
}
console.log(`toernooi: ${n} controles geslaagd`);
