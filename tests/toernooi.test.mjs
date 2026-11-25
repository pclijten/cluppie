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

console.log(`toernooi: ${n} controles geslaagd`);
