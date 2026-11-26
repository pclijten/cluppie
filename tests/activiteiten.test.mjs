// Activiteiten: terugplannen, overzicht, sjablonen, kopie, export en import. Draaien: node tests/activiteiten.test.mjs
import assert from 'node:assert/strict';
const A = await import('../public/js/activiteiten-logica.js');
const { SJABLONEN, sjabloonVan } = await import('../public/js/activiteit-sjablonen.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* datums en terugplannen */
gelijk(A.plusDagen('2026-12-20', -42), '2026-11-08');
gelijk(A.dagenTussen('2026-11-25', '2026-12-20'), 25);
gelijk(A.dTekst(42), '6 weken vooraf'); gelijk(A.dTekst(3), '3 dagen vooraf'); gelijk(A.dTekst(0), 'de dag zelf'); gelijk(A.dTekst(-2), '2 dagen erna'); gelijk(A.dTekst(null), 'vaste datum');
gelijk(A.faseVan(30), 'voor'); gelijk(A.faseVan(7), 'week'); gelijk(A.faseVan(0), 'dag'); gelijk(A.faseVan(-1), 'na');
gelijk(A.taakDatum({ d: 14 }, '2026-12-20'), '2026-12-06');
gelijk(A.taakDatum({ d: 14, datum: '2026-12-01' }, '2026-12-20'), '2026-12-01', 'vaste datum wint');
gelijk(A.taakDatum({ d: 14 }, ''), '');
gelijk(A.taakStaat({ d: 30, status: 'open' }, '2026-12-20', '2026-11-25'), 'telaat');
gelijk(A.taakStaat({ d: 30, status: 'klaar' }, '2026-12-20', '2026-11-25'), 'klaar');
gelijk(A.taakStaat({ d: 21 }, '2026-12-20', '2026-11-25'), 'week');
gelijk(A.taakStaat({ d: 7 }, '2026-12-20', '2026-11-25'), 'later');
gelijk(A.seizoenVan('2026-11-25'), '2026-2027'); gelijk(A.seizoenVan('2027-03-01'), '2026-2027');
gelijk(A.datumLang('2026-12-19'), 'zaterdag 19 december 2026');

/* alle sjablonen zijn geldig en leveren een activiteit op */
ok(SJABLONEN.length >= 8, 'minstens acht sjablonen');
for (const sj of SJABLONEN){
  gelijk(A.sjabloonFouten(sj), [], `sjabloon ${sj.id} geldig`);
  const act = A.vanSjabloon(sj, { datum: '2026-12-19', door: 'u1', nu: 1 });
  gelijk(Object.keys(act.taken).length, sj.taken.length, `${sj.id}: alle taken`);
  ok(Object.values(act.taken).every(t => ['voor', 'week', 'dag', 'na'].includes(t.fase)), `${sj.id}: fasen`);
  ok((sj.programma || []).every(p => A.isTijd(p.tijd)), `${sj.id}: programmatijden`);
  ok((sj.diensten || []).every(d => A.isTijd(d.start) && A.isTijd(d.eind) && d.nodig > 0), `${sj.id}: diensten`);
}
const kerst = A.vanSjabloon(sjabloonVan('kersttoernooi'), { naam: 'Kersttoernooi 2026', datum: '2026-12-19', door: 'u1', nu: 5 });
gelijk(kerst.naam, 'Kersttoernooi 2026'); gelijk(kerst.seizoen, '2026-2027'); gelijk(kerst.status, 'concept'); gelijk(kerst.start, '09:00');
ok(kerst.tabs.budget && kerst.tabs.vrijwilligers);
gelijk(A.vanSjabloon(sjabloonVan('infoavond'), {}).tabs.deelnemers, false, 'infoavond zonder deelnemers-tab');
gelijk(A.dienstenNaarMap(kerst.dienstenSjabloon).d001.naam, 'Opbouw');

/* overzicht en stoplicht */
const act = { datum: '2026-12-19', taken: {
  a: { titel: 'Zaal', d: 56, status: 'klaar' }, b: { titel: 'Prijzen', d: 28, status: 'open' }, c: { titel: 'Schema', d: 21, status: 'open', eigenaar: 'u1' },
  e: { titel: 'Opbouw', d: 1, status: 'open' } },
  budget: { x: { naam: 'Prijzen', soort: 'uit', begroot: 200, werkelijk: 230 }, y: { naam: 'Kantine', soort: 'in', begroot: 300, werkelijk: 280 } },
  checks: { k: { titel: 'EHBO', klaar: false } } };
const diensten = { d1: { naam: 'Kantine', start: '09:00', eind: '11:00', nodig: 3 }, d2: { naam: 'Scheids', start: '09:00', eind: '12:00', nodig: 2 } };
const aanm = [{ dienst: 'd1', naam: 'Anna' }, { dienst: 'd1', naam: 'Bas' }, { dienst: 'd1', naam: 'Cor' }, { dienst: 'd1', naam: 'Dirk' }];
const o = A.overzicht(act, '2026-11-25', aanm, diensten);
gelijk(o.dagenTot, 24); gelijk(o.taken.klaar, 1); gelijk(o.taken.telaat.map(t => t.id), ['b']); gelijk(o.taken.week.map(t => t.id), ['c']);
gelijk(o.taken.zonderEigenaar, 2); gelijk(o.kleur.taken, 'oranje');
gelijk(o.diensten.nodig, 5); gelijk(o.diensten.gevuld, 3, 'teveel in één dienst vult geen andere'); gelijk(o.diensten.leeg, 1);
gelijk(o.budget.uitWerkelijk, 230); gelijk(o.budget.saldoWerkelijk, 50); gelijk(o.kleur.budget, 'rood', 'meer dan 10% over de begroting');
gelijk(A.budgetTotaal({ p: { soort: 'uit', begroot: 100, werkelijk: 200 } }).verschil, 100);
gelijk(A.aftelTekst(0), 'Vandaag'); gelijk(A.aftelTekst(5), 'Nog 5 dagen');

/* dagprogramma met vertraging: nu en straks */
const pr = { p1: { tijd: '09:00', duur: 15, wat: 'Ontvangst' }, p2: { tijd: '09:15', duur: 60, wat: 'Rondes' }, p3: { tijd: '10:15', duur: 15, wat: 'Pauze' } };
let pl = A.programmaLijst(pr, 0, 9 * 60 + 20);
gelijk(pl.nu.wat, 'Rondes'); gelijk(pl.straks.wat, 'Pauze');
pl = A.programmaLijst(pr, 10, 9 * 60 + 20);
gelijk(pl.lijst.map(p => p.tijdNu), ['09:10', '09:25', '10:25']); gelijk(pl.nu.wat, 'Ontvangst', 'vertraging schuift mee');

/* kopie van vorig jaar: open, datums schuiven, tips uit de evaluatie gaan mee (clubgeheugen) */
const vorig = { ...kerst, taken: { t001: { ...kerst.taken.t001, status: 'klaar', tip: '' }, t002: { titel: 'Vast', d: null, datum: '2026-11-01', status: 'klaar' } },
  evaluatie: { goed: 'Sfeer', beter: 'Eerder beginnen', tips: { t001: 'Zaal was al bezet: bel in oktober' } },
  budget: { u1: { naam: 'Prijzen', soort: 'uit', begroot: 200, werkelijk: 240 } }, comite: { u1: { naam: 'Piet', rol: 'Voorzitter', uid: 'u1' } }, comiteUids: ['u1'], deelId: 'oud' };
const nieuw = A.kopie(vorig, { datum: '2027-12-18', door: 'u2', nu: 9 });
gelijk(nieuw.taken.t001.status, 'open'); gelijk(nieuw.taken.t001.tip, 'Zaal was al bezet: bel in oktober');
gelijk(nieuw.taken.t002.datum, '2027-10-31', 'vaste datum schuift 364 dagen mee');
gelijk(nieuw.budget.u1.begroot, 240, 'werkelijk van vorig jaar wordt de nieuwe begroting'); gelijk(nieuw.budget.u1.werkelijk, null);
gelijk(nieuw.deelId, ''); gelijk(nieuw.vorige.beter, 'Eerder beginnen'); gelijk(nieuw.seizoen, '2027-2028');
gelijk(A.kopie(vorig, { datum: '2027-12-18', zonderMensen: true }).comiteUids, []);
const sj = A.alsSjabloon(vorig, { naam: 'Ons kersttoernooi' });
gelijk(sj.naam, 'Ons kersttoernooi'); gelijk(sj.taken.find(t => t.t === 'Vast').d, 48, 'vaste datum wordt dagen vooraf');
ok(sj.taken.some(t => t.tip === 'Zaal was al bezet: bel in oktober')); gelijk(sj.budget[0].begroot, 240); gelijk(A.sjabloonFouten(sj), []);
ok(!JSON.stringify(sj).includes('Piet'), 'geen namen in een sjabloon');

/* verschuiven van de datum */
gelijk(A.verschuifDatum({ datum: '2026-12-19', taken: { a: { datum: '2026-12-01' }, b: { d: 5 } } }, '2026-12-26').taken, { a: { datum: '2026-12-08' }, b: { d: 5 } });

/* teksten */
gelijk(A.vulIn('Op {datum} is het {naam} om {tijd}: {link}', { naam: 'Kersttoernooi', datum: '2026-12-19', start: '09:00' }, 'https://x'), 'Op zaterdag 19 december 2026 is het Kersttoernooi om 09:00: https://x');
ok(A.takenTekst({ naam: 'K', datum: '2026-12-19', comite: { u1: { naam: 'Piet Jansen' } }, taken: act.taken }, 'u1', '2026-11-25').includes('Taken voor Piet'));
ok(A.oproepTekst({ naam: 'K', datum: '2026-12-19' }, A.telDiensten(diensten, aanm), 'L').includes('Scheids 09:00–12:00: nog 2 nodig'));

/* export */
const c = A.csvTaken({ ...act, comite: { u1: { naam: 'Piet' } } }, '2026-11-25');
ok(c.startsWith('﻿Fase;Taak;'), 'CSV met BOM en puntkomma'); ok(c.includes('Prijzen;;;2026-11-21;28;Te laat'));
ok(A.csvDiensten(diensten, aanm).includes('Kantine;09:00;11:00;;3;4;Anna, Bas, Cor, Dirk'));
ok(A.csvBudget(act).includes('Saldo;;100;50'));
const i = A.ics({ naam: 'Kerst, toernooi', datum: '2026-12-19', start: '09:00', eind: '13:00', locatie: 'Sportpark', programma: pr }, { id: 'k1', programma: true, nu: 0 });
ok(i.includes('DTSTART;TZID=Europe/Amsterdam:20261219T090000')); ok(i.includes('SUMMARY:Kerst\\, toernooi')); ok(i.includes('UID:k1-p2@cluppie.io'));
ok(A.ics({ naam: 'x', datum: '2026-12-19' }).includes('DTSTART;VALUE=DATE:20261219'));
gelijk(A.ics({ naam: 'x' }), '');
const j = A.jsonExport({ ...vorig }, { diensten, aanmeldingen: [{ dienst: 'd1', naam: 'Anna', uid: 'geheim' }] });
ok(!j.includes('geheim') && !j.includes('comiteUids'), 'geen uid in de export');
const terug = A.jsonLees(j); gelijk(terug.soort, 'activiteit'); gelijk(terug.data.naam, vorig.naam); gelijk(terug.diensten.d1.naam, 'Kantine');
gelijk(A.jsonLees(A.jsonSjabloon(sj)).soort, 'sjabloon'); ok(A.jsonLees('{kapot').fout); ok(A.jsonLees('{"naam":""}').fout);

/* import uit CSV/Excel */
let r = A.takenUitCsv('Taak;Dagen vooraf;Rol\nZaal huren;56;Voorzitter\n"Prijzen; medailles";28;\n;;\n', '2026-12-19');
gelijk(r.taken.length, 2); gelijk(r.taken[1].titel, 'Prijzen; medailles'); gelijk(r.taken[0].fase, 'voor'); gelijk(r.taken[0].rol, 'Voorzitter');
r = A.takenUitCsv('Wat,Datum,Status\nOpbouw,18-12-2026,klaar\n', '2026-12-19');
gelijk(r.taken[0].d, 1); gelijk(r.taken[0].status, 'klaar'); gelijk(r.taken[0].fase, 'week');
r = A.takenUitCsv('Opbouw;1\nAfbouw;-1\n'); gelijk(r.taken.map(t => t.d), [1, -1], 'zonder kop');
ok(A.takenUitCsv('').fout);
/* de eigen export leest weer in */
gelijk(A.takenUitCsv(A.csvTaken(kerst, '2026-11-25'), '2026-12-19').taken.length, Object.keys(kerst.taken).length);

/* open link: dubbel tegelijk, namen */
gelijk(A.botstMet(diensten, ['d1'], 'd2'), 'd1'); gelijk(A.botstMet(diensten, [], 'd2'), null);
gelijk(A.schoneNaam('  <b>Anna</b>  de   Vries-van der Heijden '), 'bAnna/b de Vries-van der');

/* kopie met toernooi: opzet mee, spelers en live-link niet */
const kt = A.kopie({ ...vorig, vraag: true, toernooi: { duur: 10, velden: { v: { naam: 'Veld 1' } }, spelers: { s: { naam: 'Kind' } }, teams: { t: {} }, schema: [{ id: 'w1' }], uitslag: { w1: { a: 1, b: 0 } }, liveId: 'abc', live: true, mededelingen: { m: { tekst: 'x' } } } }, { datum: '2027-12-18' });
gelijk(Object.keys(kt.toernooi).sort(), ['duur', 'velden'], 'kopie toernooi'); ok(kt.vraag === false);
ok(!A.jsonExport({ naam: 'x', toernooi: { liveId: 'abc', live: true, duur: 9 } }).includes('abc'), 'export zonder live-link');
/* agenda-kopie: geen budget of comité */
const ak = A.agendaKopie({ ...vorig, teams: ['t1'], kamer: true, deelId: 'dd' }, { clubNaam: 'Club', link: 'L' });
gelijk(Object.keys(ak).sort(), ['clubNaam', 'datum', 'deelId', 'eind', 'kamer', 'link', 'locatie', 'naam', 'omschrijving', 'planB', 'seizoen', 'start', 'status', 'teams', 'vraag', 'vraagTot']);

/* AI-concept schoonmaken */
gelijk(A.schoonConcept({ naam: 'X', taken: [] }), null);
const sc = A.schoonConcept({ naam: 'Disco', taken: [{ t: 'DJ boeken', d: 400 }, { titel: '' }], programma: [{ tijd: '25:00', wat: 'Start' }], diensten: [{ naam: 'Bar', nodig: 999 }], berichten: [{ titel: 'a', tekst: 'b', kanaal: 'sms' }] });
gelijk(sc.taken, [{ t: 'DJ boeken', d: 365, rol: '', tip: '' }]); gelijk(sc.programma[0].tijd, ''); gelijk(sc.diensten[0].nodig, 50); gelijk(sc.berichten[0].kanaal, 'whatsapp');
gelijk(A.sjabloonFouten(sc), []);

/* [20261126y] wat wordt er van de vrijwilliger verwacht */
gelijk(A.voorzetWat('Kantine').bron, 'standaard'); ok(A.voorzetWat('Scheidsrechter').tekst.includes('fluit'));
gelijk(A.voorzetWat('Iets heel anders'), { tekst: '', bron: '' });
const bank = { v1: { titel: 'Kantinedienst', wat: 'Bardienst draaien.', stappen: ['Kassa openen', 'Koffie zetten'], contact: 'Els' }, v2: { titel: 'Leeg' } };
const vb = A.voorzetWat('kantine', bank); gelijk(vb.bron, 'bank'); gelijk(vb.tekst, 'Bardienst draaien.\n- Kassa openen\n- Koffie zetten\nVragen? Els.');
gelijk(A.bankTaakVoor('Leeg', bank), null);
gelijk(A.dienstWat('x'.repeat(900)).length, A.WAT_MAX);
const dm = Object.values(A.dienstenNaarMap([{ naam: 'Opbouw', nodig: 2, wat: 'Doelen neerzetten' }, { naam: 'Bar', nodig: 1 }]));
gelijk(dm[0].wat, 'Doelen neerzetten'); ok(!('wat' in dm[1]));
gelijk(A.alsSjabloon({ naam: 'X' }, { diensten: { d1: { naam: 'Opbouw', start: '08:00', eind: '09:00', plek: '', nodig: 2, wat: 'Tenten' } } }).diensten[0].wat, 'Tenten');
ok(A.csvDiensten({ d1: { naam: 'Opbouw', nodig: 1, wat: 'Tenten opzetten' } }, []).includes('Tenten opzetten'));

console.log(`activiteiten: ${n} controles geslaagd`);
