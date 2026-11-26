// Tests voor de controle en het proefdraaien van de toernooiplanner (public/js/toernooi-controle.js).
// Draai: node tests/toernooi-controle.test.mjs
import * as T from '../public/js/toernooi-logica.js';
import * as C from '../public/js/toernooi-controle.js';
let n = 0;
const ok = (v, m) => { if (!v) { console.error('MIS: ' + m); process.exit(1); } n++; };
const heeft = (lijst, id, m) => ok(lijst.some(p => p.id === id || p.id.startsWith(id + '|')), `${m} (verwacht ${id}, kreeg: ${lijst.map(p => p.id).join(', ')})`);
const niet = (lijst, id, m) => ok(!lijst.some(p => p.id === id || p.id.startsWith(id + '|')), `${m} (${id} hoort er niet bij)`);

/* een goed toernooi via automatisch indelen */
const teams = {}; for (let i = 0; i < 10; i++) teams['t' + i] = { naam: 'Team ' + i, club: 'c' + (i % 4), volg: i };
const basis = { start: '09:00', eind: '13:00', duur: 12, wissel: 3, prijs: 15, rust: true, velden: { v1: { naam: 'Veld 1', delen: 2, volg: 1 } }, teams,
  clubs: { c0: { naam: 'A' }, c1: { naam: 'B' }, c2: { naam: 'C' }, c3: { naam: 'D' } }, kk: { k1: { naam: 'KK1', plekken: 6, volg: 1 }, k2: { naam: 'KK2', plekken: 6, volg: 2 } } };
const r = T.autoIndeling(basis);
ok(r.past, 'automatisch indelen past');
const goed = { ...basis, poules: r.poules, ko: r.ko, duur: r.duur, schema: r.schema, uitslag: {}, teams: Object.fromEntries(Object.entries(teams).map(([id, x]) => [id, { ...x, poule: r.teamPoule[id] }])) };
const c0 = C.controleer(goed);
ok(!c0.some(p => p.niveau === 'fout'), 'goed toernooi: geen fouten, kreeg ' + c0.filter(p => p.niveau === 'fout').map(p => p.tekst).join(' | '));

/* leeg toernooi */
heeft(C.controleer({}), 'weinig-teams', 'leeg: nog geen teams');

/* teams en poules */
{
  const t = { ...goed, teams: { ...goed.teams, x: { naam: 'Team 1', volg: 99 } } };
  const c = C.controleer(t);
  heeft(c, 'zonder-poule', 'team zonder poule');
  heeft(c, 'dubbele-naam', 'twee teams met dezelfde naam');
  niet(c, 'schema-oud', 'team zonder poule maakt het schema niet ongeldig');
  const p1 = Object.keys(goed.poules)[0];
  heeft(C.controleer({ ...goed, teams: { ...goed.teams, x: { naam: 'Nieuw', poule: p1, volg: 99 } } }), 'schema-oud', 'nieuw team in een poule: schema past niet meer');
}
{
  const t = { ...goed, poules: { ...goed.poules, leeg: { naam: 'Poule Z', volg: 9 } } };
  heeft(C.controleer(t), 'poule-leeg', 'lege poule');
}
{ /* ongelijke poules */
  const ids = Object.keys(goed.teams), [p1, p2] = Object.keys(goed.poules);
  const tm = Object.fromEntries(ids.map((id, i) => [id, { ...goed.teams[id], poule: i < 7 ? p1 : p2 }]));
  heeft(C.controleer({ ...goed, teams: tm, schema: [] }), 'ongelijke-poules', 'ongelijke poules');
}

/* schema: dubbel geboekt veld, team tegelijk, finale te vroeg, te laat */
{
  const s = goed.schema.map(w => ({ ...w })), poule = s.filter(w => !w.ko);
  poule[1].t = poule[0].t; poule[1].v = poule[0].v;
  const c = C.controleer({ ...goed, schema: s });
  heeft(c, 'veld-dubbel', 'veld dubbel geboekt');
  ok(c.find(p => p.id.startsWith('veld-dubbel')).wed.length === 2, 'dubbel: beide wedstrijden genoemd');
}
{
  const s = goed.schema.map(w => ({ ...w })), poule = s.filter(w => !w.ko);
  const a = poule[0], b = poule.find(w => w.t !== a.t && (w.a === a.a || w.b === a.a));
  b.t = a.t; b.v = a.v === 'v1~A' ? 'v1~B' : 'v1~A';
  const bezet = s.find(w => w !== b && w.t === b.t && w.v === b.v); if (bezet){ bezet.t = '08:00'; }
  heeft(C.controleer({ ...goed, schema: s }), 'team-tegelijk', 'team speelt twee wedstrijden tegelijk');
}
{
  const s = goed.schema.map(w => ({ ...w })), f = s.find(w => w.fase === 'finale'); f.t = '09:15';
  const c = C.controleer({ ...goed, schema: s });
  heeft(c, 'ko-voor-bron', 'finale vóór de halve finale');
}
{
  const s = goed.schema.map(w => ({ ...w })), k = s.find(w => w.ko && w.ka?.p); k.t = '09:00';
  heeft(C.controleer({ ...goed, schema: s }), 'ko-te-vroeg', 'kruisfinale vóór het einde van de poule');
}
heeft(C.controleer({ ...goed, eind: '10:00' }), 'te-laat', 'over de eindtijd');
heeft(C.controleer({ ...goed, eind: '08:00' }), 'eind-voor-start', 'eindtijd voor begintijd');
heeft(C.controleer({ ...goed, velden: { v9: { naam: 'Ander veld', volg: 1 } } }), 'veld-weg', 'veld bestaat niet meer');
heeft(C.controleer({ ...goed, duur: 25 }), 'speeltijd-veranderd', 'speeltijd langer gemaakt na plannen');

/* geen rust */
{
  const tm = { a: { naam: 'A', poule: 'p', volg: 1 }, b: { naam: 'B', poule: 'p', volg: 2 }, c: { naam: 'C', poule: 'p', volg: 3 } };
  const t = { start: '09:00', duur: 10, wissel: 2, rust: true, velden: { v: { naam: 'V', volg: 1 } }, poules: { p: { naam: 'P', volg: 1 } }, teams: tm,
    schema: [{ id: 'w1', p: 'p', a: 'a', b: 'b', v: 'v', t: '09:00', fase: 'poule' }, { id: 'w2', p: 'p', a: 'a', b: 'c', v: 'v', t: '09:12', fase: 'poule' }, { id: 'w3', p: 'p', a: 'b', b: 'c', v: 'v', t: '09:24', fase: 'poule' }] };
  heeft(C.controleer(t), 'geen-rust', 'achter elkaar spelen');
  niet(C.controleer({ ...t, rust: false }), 'geen-rust', 'zonder rust-instelling geen melding');
}

/* knock-out */
{
  const [p1, p2] = Object.keys(goed.poules);
  const t = { ...goed, ko: { ...goed.ko, extra: { naam: 'Ook finales', poules: [p1], ronde: 2, volg: 2 } } };
  heeft(C.controleer(t), 'ko-dubbel', 'poule in twee knock-outs');
  heeft(C.controleer({ ...goed, ko: {} }), 'ko-wees', 'finales in schema zonder knock-out');
  heeft(C.controleer({ ...goed, ko: { ak: { ...goed.ko.ak, plaats3: false } } }), 'ko-oud', 'knock-out veranderd na plannen');
  const s = goed.schema.map(w => ({ ...w })), f = s.find(w => w.fase === 'finale');
  const u = { [f.id]: { a: 1, b: 1 } };
  heeft(C.controleer({ ...goed, uitslag: u }), 'ko-gelijk', 'gelijk in de finale zonder winnaar');
  ok(p2, 'twee poules');
}

/* kleedkamers */
{
  const krap = { ...goed, kk: { k1: { naam: 'KK1', plekken: 1, volg: 1 } } };
  heeft(C.controleer(krap), 'kk-tekort', 'te weinig kleedkamers');
  const ids = Object.keys(goed.teams);
  const vol = { ...goed, kk: { k1: { naam: 'KK1', plekken: 1, volg: 1 }, k2: { naam: 'KK2', plekken: 9, volg: 2 } }, teams: Object.fromEntries(ids.map(id => [id, { ...goed.teams[id], kk: 'k1' }])) };
  heeft(C.controleer(vol), 'kk-vol', 'handmatig te vol');
  const g = { ...goed, teams: Object.fromEntries(ids.map((id, i) => [id, { ...goed.teams[id], eisen: { geslacht: i % 2 ? 'v' : 'm' } }])) };
  heeft(C.controleer(g), 'kk-gemengd', 'jongens en meisjes samen');
}

/* proefdraaien */
{
  const p = C.proefdraaien(goed, { keer: 40, zaad: 5 });
  ok(p.keer === 40 && p.voorbeeld, 'proef: gespeeld');
  ok(!p.problemen.some(x => x.niveau === 'fout'), 'proef: goed toernooi geen fouten: ' + p.problemen.map(x => x.tekst).join(' | '));
  ok(p.voorbeeld.podia.length === 1 && p.voorbeeld.podia[0].plaatsen.some(x => x.plaats === 1), 'proef: er is een winnaar');
  ok(goed.schema.filter(w => !w.ko).every(w => T.heeftUitslag(p.voorbeeld.uitslag[w.id])), 'proef: alle poulewedstrijden een uitslag');
  ok(p.voorbeeld.schema.filter(w => w.ko).every(w => w.a && w.b), 'proef: alle finales hebben teams');
  ok(JSON.stringify(goed.uitslag) === '{}', 'proef: niets aan het toernooi veranderd');
  const zelfde = C.proefdraaien(goed, { keer: 5, zaad: 5 }), ander = C.proefdraaien(goed, { keer: 5, zaad: 5 });
  ok(JSON.stringify(zelfde.voorbeeld.uitslag) === JSON.stringify(ander.voorbeeld.uitslag), 'proef: zelfde zaad, zelfde uitslagen');
  /* finale verschoven naar het begin: teams nog onbekend */
  const s = goed.schema.map(w => ({ ...w })); s.find(w => w.fase === 'finale').t = '09:00';
  const kapot = C.proefdraaien({ ...goed, schema: s }, { keer: 10, zaad: 1 });
  heeft(kapot.problemen, 'sim-onbekend', 'proef: finale waarvan de teams nog niet bekend zijn');
  heeft(kapot.problemen, 'sim-geen-winnaar', 'proef: geen winnaar');
  ok(kapot.problemen.find(x => x.id.startsWith('sim-onbekend')).hoeVaak === 10, 'proef: telt hoe vaak');
  ok(C.proefdraaien({ ...goed, schema: [] }).keer === 0, 'proef: zonder schema niets');
}

/* knock-out met rust: één ronde tussen poule en finales */
{
  const ws = goed.schema, stap = goed.duur + goed.wissel, eindPoule = Math.max(...ws.filter(w => !w.ko).map(w => T.naarMin(w.t)));
  ok(Math.min(...ws.filter(w => w.ko).map(w => T.naarMin(w.t))) >= eindPoule + 2 * stap, 'rust: finales niet direct na de laatste poulewedstrijd');
  const zonder = T.planSchema({ ...goed, rust: false }).schema, eind2 = Math.max(...zonder.filter(w => !w.ko).map(w => T.naarMin(w.t)));
  ok(Math.min(...zonder.filter(w => w.ko).map(w => T.naarMin(w.t))) === eind2 + stap, 'zonder rust: finales direct erna');
}

/* automatisch indelen met rust: liever een indeling waarin niemand twee keer achter elkaar speelt */
{
  const tm = {}; for (let i = 0; i < 10; i++) tm['t' + i] = { naam: 'T' + i, club: 'c' + (i % 4), volg: i };
  const t = { start: '09:00', eind: '13:00', wissel: 3, prijs: 15, rust: true, velden: { v1: { naam: 'Veld 1', delen: 2, volg: 1 }, v2: { naam: 'Veld 2', delen: 2, volg: 2 } }, teams: tm };
  const r = T.autoIndeling(t);
  ok(r.past && r.zonderRust === 0, `auto met rust: niemand achter elkaar (${r.zonderRust})`);
  const t2 = { ...t, poules: r.poules, ko: r.ko, duur: r.duur, schema: r.schema, teams: Object.fromEntries(Object.entries(tm).map(([id, x]) => [id, { ...x, poule: r.teamPoule[id] }])) };
  niet(C.controleer(t2), 'geen-rust', 'auto met rust: controle vindt geen achter-elkaar');
  const zonder = T.autoIndeling({ ...t, rust: false });
  ok(zonder.past, 'auto zonder rust past ook');
  const s = T.planSchema(t2, { streng: true }).schema;
  ok(Object.values(T.teamRooster({ ...t2, schema: s })).every(x => x.achterElkaar === 0), 'streng plannen: nooit achter elkaar');
}

/* AI: samenvatting zonder spelers, antwoord schoonmaken */
{
  const t = { ...goed, spelers: { s1: { naam: 'Jan Jansen', jaar: 2015, tt: 't1' } } };
  const s = JSON.stringify(C.aiSamenvatting(t, C.controleer(t), { naam: 'Kersttoernooi', datum: '2026-12-20' }));
  ok(!s.includes('Jan Jansen'), 'AI: geen spelersnamen');
  ok(s.includes('Team 3') && s.includes('Kersttoernooi'), 'AI: teams en naam mee');
  const [p1, p2] = Object.keys(goed.poules), een = Object.keys(goed.teams).find(id => goed.teams[id].poule === p1);
  const a = C.schoonAiAntwoord({ punten: [{ niveau: 'fout', tekst: 'Te lang voor O8.' }, { tekst: '' }], indeling: [{ team: goed.teams[een].naam, naar: goed.poules[p2].naam, waarom: 'eerlijker' }, { team: 'Bestaat niet', naar: goed.poules[p2].naam }, { team: goed.teams[een].naam, naar: goed.poules[p1].naam }] }, goed);
  ok(a.punten.length === 1 && a.punten[0].niveau === 'tip', 'AI: punten opgeschoond, geen fout-niveau van de AI');
  ok(a.indeling.length === 1 && a.indeling[0].team === een && a.indeling[0].poule === p2, 'AI: alleen bestaande teams en poules, niet naar de eigen poule');
}

console.log(`toernooi-controle: ${n} controles geslaagd`);
