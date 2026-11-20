// Clubprofiel: hoofdstukken en bestemmingen, bevindingen met voorstel, stand, manco's, uitvoer, instellen, rolnamen.
// Draaien: node --no-warnings tests/clubprofiel.test.mjs
import assert from 'node:assert/strict';
import { HOOFDSTUKKEN, GROEPEN, alleVelden, veldOpId, veldenVoorAI, bestemmingen, documentId, docxTekst, alinea, regelsUit, schoonBevinding, schoonVoorstel, voorstelLeeg,
  opTeRuimen, nieuweBevindingen, veldStand, overzicht, pastInFilter, mancos, vragenTekst, profielTekst, titelVan, contentDocs,
  INSTELLEN, instelVelden, instelWaarde, controleerInstelling, instelWijzigingen, instelVeldenVoorAI, schoonRondes, seizoenVan, rondesSamenvoegen } from '../public/js/clubprofiel-logica.js';
import { rolNaam, eigenRolNaam, ROLLEN } from '../public/js/rolnamen.js';

/* hoofdstukken: unieke id's, elk veld hoort bij zijn hoofdstuk en heeft een vraag */
const ids = alleVelden().map(v => v.id);
assert.equal(new Set(ids).size, ids.length, 'veld-id is uniek');
assert.equal(new Set(HOOFDSTUKKEN.map(h => h.id)).size, HOOFDSTUKKEN.length);
for (const h of HOOFDSTUKKEN){
  assert.match(h.id, /^[a-z]+$/);
  for (const v of h.velden){
    assert.match(v.id, /^[a-z]+\.[a-z]+$/);
    assert.ok(v.label && v.vraag.endsWith('?'), v.id);
    assert.equal(v.hoofdstuk, h.id);
    assert.notEqual(v.id, h.id + '.overig');
    /* elk veld heeft een bestemming in Cluppie: niets blijft handwerk */
    assert.ok(bestemmingen(v).length >= 1, v.id + ' heeft een bestemming');
    assert.ok(v.tekst || instelVelden(v.id), v.id + ': zonder tekst moet er een instelling zijn');
  }
}
assert.equal(veldOpId('bouw.indeling').label, 'Bouwen en hun namen');
assert.equal(veldOpId('rollen.overig').hoofdstuk, 'rollen');
assert.equal(veldOpId('bestaatniet.overig'), null);
assert.equal(veldOpId('rollen.verzonnen'), null);
assert.deepEqual(alleVelden().filter(v => !v.tekst).map(v => v.id), ['id.naam', 'id.kleur', 'id.plannaam']);
assert.deepEqual(alleVelden().filter(v => v.regels).map(v => v.id), ['gedrag.regels', 'gedrag.ouders']);
assert.deepEqual(bestemmingen(veldOpId('bouw.grenzen')).map(b => b.soort), ['instelling', 'instelling', 'clubwijzer']);
assert.deepEqual(bestemmingen(veldOpId('gedrag.regels')).map(b => b.soort), ['clubwijzer', 'regels']);
assert.deepEqual(bestemmingen(veldOpId('id.kleur')).map(b => b.soort), ['instelling']);

/* groepen: elk hoofdstuk precies één keer; de AI krijgt per veld wat er gevraagd wordt */
assert.deepEqual([...GROEPEN.flat()].sort(), HOOFDSTUKKEN.map(h => h.id).sort());
const g1 = veldenVoorAI(GROEPEN[0]);
assert.deepEqual(g1.map(h => h.id), GROEPEN[0]);
const bg = g1.find(h => h.id === 'bouwen').velden.find(v => v.id === 'bouw.grenzen');
assert.deepEqual([bg.tekst, bg.regels, bg.instellingen.length, bg.instellingen[0].type], [true, false, 2, 'getal']);
assert.equal(veldenVoorAI().length, HOOFDSTUKKEN.length);
assert.ok(GROEPEN.every(g => JSON.stringify(veldenVoorAI(g)).length < 12000), 'de veldenlijst per groep blijft klein');

/* tekst */
assert.equal(docxTekst('<w:body><w:p><w:r><w:t>Onderbouw &amp; middenbouw</w:t></w:r></w:p><w:p><w:r><w:t>O8</w:t><w:tab/><w:t>O9</w:t></w:r></w:p></w:body>'), 'Onderbouw & middenbouw\nO8\tO9');
assert.notEqual(documentId('Plan.pdf', 100), documentId('Plan.pdf', 101));
assert.equal(documentId('Plan.pdf', 100), documentId('plan  PDF', 100));
assert.equal(alinea('  Wij  trainen\n\n\n\n twee keer.  ', 100), 'Wij trainen\n\ntwee keer.');
assert.deepEqual(regelsUit('- Op tijd\n\n• Respect \n* Samen'), ['Op tijd', 'Respect', 'Samen']);

/* bevindingen en voorstel */
assert.equal(schoonBevinding({ veld: 'onbekend', waarde: 'x' }), null);
assert.equal(schoonBevinding({ veld: 'bouw.indeling', waarde: '  ' }), null);
const s = schoonBevinding({ veld: 'bouw.grenzen', waarde: 'Onderbouw  t/m O10', pagina: '4', zeker: 'raar', oordeel: 'x', status: 'deels', ontbreekt: 'De grens van de middenbouw.',
  voorstel: { tekst: 'Onze onderbouw loopt t/m O10.', regels: ['hoort hier niet'], instellingen: { 'regels.bouwGrenzen.onderTm': '10', 'regels.bouwGrenzen.middenTm': 99, 'platformModules.ai': true } } });
assert.deepEqual([s.waarde, s.pagina, s.zeker, s.oordeel, s.verwerkt, s.status, s.ontbreekt, s.gezet], ['Onderbouw t/m O10', 4, 'middel', 'open', false, 'deels', 'De grens van de middenbouw.', null]);
assert.deepEqual(s.voorstel, { tekst: 'Onze onderbouw loopt t/m O10.', regels: [], rondes: [], instellingen: { 'regels.bouwGrenzen.onderTm': 10 } }, 'alleen wat bij het veld hoort en geldig is');
assert.equal(schoonBevinding({ veld: 'id.kleur', waarde: 'Rood', voorstel: { tekst: 'hoort hier niet', instellingen: { 'identiteit.kleur': '#CC0000' } } }).voorstel.tekst, '');
assert.equal(schoonBevinding({ veld: 'bouw.indeling', waarde: 'Drie bouwen' }).voorstel, null, 'een oude bevinding heeft geen voorstel');
assert.equal(voorstelLeeg(null) && voorstelLeeg({ tekst: '', regels: [], instellingen: {} }) && !voorstelLeeg({ tekst: 'x' }) && !voorstelLeeg({ rondes: [{ naam: 'Winter' }] }), true);
assert.deepEqual(schoonVoorstel({ tekst: 'Zo doen wij het.', regels: '- Op tijd\n- Respect' }, 'gedrag.regels').regels, ['Op tijd', 'Respect']);

let n = 0; const id = () => 'b' + (++n);
const profiel = { documenten: {}, bevindingen: {} };
const d1 = { id: 'd1', naam: 'Jeugdplan.pdf' }, d2 = { id: 'd2', naam: 'Reglement.docx' };
Object.assign(profiel.bevindingen, nieuweBevindingen(profiel, [
  { veld: 'bouw.indeling', waarde: 'Onderbouw, middenbouw en bovenbouw', citaat: 'drie bouwen', pagina: 2, zeker: 'hoog', citaatOk: true, voorstel: { tekst: 'Wij hebben drie bouwen.', instellingen: { 'lijsten.bouwen.items.onder.naam': 'Onderbouw' } } },
  { veld: 'bouw.indeling', waarde: 'Onderbouw, middenbouw en bovenbouw' },
  { veld: 'verzonnen.veld', waarde: 'x' },
  { veld: 'rollen.overig', waarde: 'Materiaalman: beheert de ballen', voorstel: { tekst: 'De materiaalman beheert de ballen.' } },
  { veld: 'eval.momenten', waarde: 'Spelers worden beoordeeld', status: 'deels', ontbreekt: 'Wanneer en hoe vaak.' },
], d1, 1000, id));
assert.equal(Object.keys(profiel.bevindingen).length, 3, 'dubbel en onbekend veld vallen af');
Object.assign(profiel.bevindingen, nieuweBevindingen(profiel, [{ veld: 'bouw.indeling', waarde: 'Minis, pupillen en junioren' }], d2, 2000, id));
let o = overzicht(profiel);
const bouwen = o.hoofdstukken.find(h => h.id === 'bouwen');
assert.equal(bouwen.velden[0].stand.stand, 'open');
assert.equal(bouwen.velden[0].stand.meerdere, true);
assert.deepEqual([bouwen.tel.velden, bouwen.tel.open, bouwen.tel.leeg, bouwen.tel.meerdere, bouwen.tel.manco], [3, 1, 2, 1, 3]);
const rollen = o.hoofdstukken.find(h => h.id === 'rollen');
assert.equal(rollen.velden.at(-1).overig, true, 'overig verschijnt alleen als er iets in staat');
assert.equal(o.hoofdstukken.find(h => h.id === 'teams').velden.some(v => v.overig), false);
assert.equal(o.totaal.velden, alleVelden().length + 1);
assert.equal(o.hoofdstukken.find(h => h.id === 'evalueren').velden[0].stand.deels, true);
assert.equal(o.totaal.manco, alleVelden().length - 2 + 2, 'alles wat leeg is, plus het halve en het tegenstrijdige antwoord');

/* manco's: niet gevonden, half en tegenstrijdig, elk met de vraag voor de club */
const mc = mancos(profiel);
assert.equal(mc.length, o.totaal.manco);
assert.deepEqual([mc.find(m => m.veld === 'eval.momenten').soort, mc.find(m => m.veld === 'eval.momenten').vraag], ['deels', 'Wanneer en hoe vaak.']);
assert.equal(mc.find(m => m.veld === 'bouw.indeling').soort, 'meerdere');
assert.equal(mc.find(m => m.veld === 'bouw.indeling').antwoorden.length, 2);
assert.equal(mc.find(m => m.veld === 'bouw.grenzen').vraag, 'Welke leeftijden horen bij welke bouw?');
assert.ok(!mc.some(m => veldOpId(m.veld).overig), 'een losse vondst (overig) is nooit een manco');

/* opnieuw inlezen: alleen wat nog open is van dat document gaat weg; beoordeeld blijft en komt niet dubbel */
const vind = (veld, docId) => Object.keys(profiel.bevindingen).find(k => profiel.bevindingen[k].veld === veld && profiel.bevindingen[k].docId === docId);
const eersteBouw = vind('bouw.indeling', 'd1');
Object.assign(profiel.bevindingen[eersteBouw], { oordeel: 'akkoord', verwerkt: true, gezet: { ms: 1, tekst: 'Wij hebben drie bouwen.', ids: ['afspraak-bouw-indeling'] } });
assert.deepEqual(opTeRuimen(profiel, 'd1').sort(), [vind('rollen.overig', 'd1'), vind('eval.momenten', 'd1')].sort());
assert.deepEqual(nieuweBevindingen(profiel, [{ veld: 'bouw.indeling', waarde: 'onderbouw, middenbouw en bovenbouw.' }], d1, 3000, id), {});
assert.deepEqual(schoonBevinding(profiel.bevindingen[eersteBouw]).gezet.ids, ['afspraak-bouw-indeling'], 'wat gezet is blijft bewaard');

/* stand van een veld */
const st = (...x) => veldStand(x.map((bev, i) => ({ id: 'x' + i, waarde: 'w' + i, oordeel: 'open', verwerkt: false, ...bev })));
assert.equal(st().stand, 'leeg');
assert.equal(st({ oordeel: 'afgewezen' }).stand, 'leeg');
assert.equal(st({ oordeel: 'akkoord' }, {}).stand, 'open');
assert.equal(st({ oordeel: 'akkoord' }, { oordeel: 'akkoord', verwerkt: true }).stand, 'akkoord');
assert.equal(st({ oordeel: 'akkoord', verwerkt: true }, { oordeel: 'afgewezen' }).stand, 'verwerkt');
assert.equal(st({ status: 'deels' }, { status: 'volledig' }).deels, false);
const f = (stand, extra = {}) => ({ stand: { stand, deels: false, meerdere: false, ...extra } });
assert.equal(pastInFilter(f('leeg'), 'manco') && pastInFilter(f('open'), 'alles') && pastInFilter(f('akkoord'), 'open') && pastInFilter(f('verwerkt', { deels: true }), 'manco') && !pastInFilter(f('open'), 'verwerkt'), true);

/* uitvoer */
const vragen = vragenTekst(profiel, 'FC Testdorp');
assert.match(vragen, /^Vragen voor FC Testdorp/);
assert.match(vragen, /Welke leeftijden horen bij welke bouw\?/);
assert.match(vragen, /Momenten in het jaar: Wanneer en hoe vaak\./);
assert.match(vragen, /verschillende antwoorden[\s\S]*Jeugdplan\.pdf[\s\S]*Reglement\.docx/);
assert.ok(!/In welke bouwen is de jeugd verdeeld/.test(vragen), 'een gevonden onderwerp is geen losse vraag meer');
const md = profielTekst(profiel, 'FC Testdorp');
assert.match(md, /^# Clubprofiel FC Testdorp/);
assert.match(md, /## Bouwen en leeftijdsgroepen[\s\S]*- Onderbouw, middenbouw en bovenbouw _\[Jeugdplan\.pdf, p\. 2\]_/);
assert.match(md, /nog niet beoordeeld/);
assert.match(md, /ontbreekt: Wanneer en hoe vaak\./);
assert.ok(!/nog niet beoordeeld|niet gevonden/.test(profielTekst(profiel, 'FC Testdorp', true)), 'alleen goedgekeurd');
assert.match(vragenTekst({}, ''), /Vragen voor de club/);

/* naar Cluppie: teksten als clubcontent */
assert.equal(titelVan(veldOpId('wed.speeltijd'), 'x'), 'Speeltijd');
assert.equal(titelVan(veldOpId('rollen.overig'), 'Materiaalman: beheert de ballen'), 'Materiaalman');
const cd = contentDocs({ veldId: 'gedrag.regels', bevId: 'b9', titel: 'Gedragsregels', tekst: 'Wij zijn op tijd.\nWij tonen respect.', regels: 'Op tijd\nRespect', status: 'gepubliceerd' });
assert.deepEqual(cd.map(d => d.id), ['afspraak-gedrag-regels', 'gouden-regel-cp-gedrag-regels-1', 'gouden-regel-cp-gedrag-regels-2']);
assert.deepEqual([cd[0].data.categorie, cd[0].data.hoofdstuk, cd[0].data.hoofdstukNaam, cd[0].data.status, cd[0].data.bron, cd[0].data.achtergrond], ['afspraak', 'gedrag', 'Gedrag en normen', 'gepubliceerd', 'clubprofiel', 'Wij zijn op tijd.\nWij tonen respect.']);
assert.deepEqual([cd[1].data.categorie, cd[1].data.titel, cd[2].data.titel], ['gouden-regel', 'Op tijd', 'Respect']);
assert.equal(contentDocs({ veldId: 'id.kleur', bevId: 'b1', tekst: 'tekst die er niet hoort', status: 'x' }).length, 0, 'een veld zonder tekst krijgt geen Clubwijzer-item');
assert.equal(contentDocs({ veldId: 'wed.speeltijd', bevId: 'b1', tekst: 'Iedereen speelt.', status: 'raar' })[0].data.status, 'concept', 'onbekende status is concept');
assert.equal(contentDocs({ veldId: 'rollen.overig', bevId: 'bAb1', titel: 'Materiaalman', tekst: 'Hij beheert de ballen.' })[0].id, 'afspraak-rollen-overig-bab1');
const volg = HOOFDSTUKKEN.flatMap(h => h.velden).map(v => contentDocs({ veldId: v.id, bevId: 'b', tekst: 'x' })[0]).filter(Boolean).map(d => d.data.volgorde);
assert.deepEqual(volg, [...volg].sort((a, b) => a - b), 'de Clubwijzer houdt de volgorde van de hoofdstukken');

/* instellen: elk veld met instellingen bestaat, paden zijn geldig, waarden worden gecontroleerd */
for (const [veldId, defs] of Object.entries(INSTELLEN)){
  assert.ok(veldOpId(veldId), veldId + ' is een bestaand veld');
  for (const d of defs){
    assert.match(d.pad, /^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/);
    assert.ok(d.label && ['tekst', 'getal', 'kleur', 'keuze', 'formatie'].includes(d.type), d.pad);
    assert.ok(!/^platformModules|^admins|^leden/.test(d.pad), 'alleen instellingen, geen rechten');
    assert.equal(controleerInstelling(d, d.standaard).ok, true, d.pad + ': de standaard is zelf geldig');
  }
}
assert.equal(instelVelden('gedrag.regels'), null);
const inst = { regels: { bouwGrenzen: { onderTm: 10 } }, rolNamen: { coach: 'Trainer' } };
const [gOnder, gMidden] = INSTELLEN['bouw.grenzen'];
assert.deepEqual([instelWaarde(inst, gOnder), instelWaarde(inst, gMidden), instelWaarde({}, gOnder)], [10, 15, 11]);
assert.equal(controleerInstelling(gOnder, '5').ok, false);
assert.equal(controleerInstelling(gOnder, '').ok, false);
assert.deepEqual(controleerInstelling(INSTELLEN['id.kleur'][0], '#CC0000'), { ok: true, waarde: '#cc0000' });
assert.equal(controleerInstelling(INSTELLEN['id.kleur'][0], 'rood').ok, false);
assert.equal(controleerInstelling(INSTELLEN['spel.formatie'][0], '4-3-3').ok && controleerInstelling(INSTELLEN['spel.formatie'][0], '').ok, true);
assert.equal(controleerInstelling(INSTELLEN['spel.formatie'][0], '1-4-3-3 aanvallend').ok, false);
assert.equal(controleerInstelling(INSTELLEN['rol.besluit'][0], 'club').ok && !controleerInstelling(INSTELLEN['rol.besluit'][0], 'iets').ok, true);
assert.equal(controleerInstelling(INSTELLEN['id.naam'][0], 'veel te lange afkorting').ok, false);
/* alleen wat verandert wordt geschreven; de grenzen moeten oplopen */
assert.deepEqual(instelWijzigingen('bouw.grenzen', inst, { 'regels.bouwGrenzen.onderTm': '10', 'regels.bouwGrenzen.middenTm': '13' }), { wijzigingen: [['regels.bouwGrenzen.middenTm', 13]] });
assert.match(instelWijzigingen('bouw.grenzen', inst, { 'regels.bouwGrenzen.onderTm': '13', 'regels.bouwGrenzen.middenTm': '13' }).fout, /eerder ophouden/);
assert.deepEqual(instelWijzigingen('rol.lijst', inst, { 'rolNamen.coach': 'Trainer', 'rolNamen.coordinator': ' TC-lid ', 'rolNamen.trainco': 'Trainingscoördinator' }), { wijzigingen: [['rolNamen.coordinator', 'TC-lid']] });
assert.deepEqual(instelWijzigingen('rol.team', inst, { 'rolNamen.coach': '' }), { wijzigingen: [['rolNamen.coach', '']] }, 'leegmaken zet de naam van Cluppie terug');
assert.equal(instelVeldenVoorAI('rol.besluit')[0].opties.length, 2);

/* [20261120e] beoordelen: momenten worden evaluatierondes, de schaal en de domeinen worden instellingen */
const evalueren = HOOFDSTUKKEN.find(h => h.id === 'evalueren').velden;
assert.deepEqual(evalueren.map(v => v.id), ['eval.momenten', 'eval.vorm', 'eval.criteria', 'eval.wie', 'eval.gebruik', 'eval.gesprekken', 'eval.team', 'eval.inzage', 'eval.trainers']);
assert.deepEqual(alleVelden().filter(v => v.rondes).map(v => v.id), ['eval.momenten']);
assert.deepEqual(bestemmingen(veldOpId('eval.momenten')).map(b => b.soort), ['clubwijzer', 'rondes']);
assert.equal(veldenVoorAI(['evalueren'])[0].velden[0].rondes, true);
assert.deepEqual(INSTELLEN['eval.vorm'].map(d => d.pad).slice(0, 2), ['lijsten.niveaus.items.1.label', 'lijsten.niveaus.items.1.kort']);
assert.equal(INSTELLEN['eval.vorm'].length, 10);
assert.deepEqual(INSTELLEN['eval.criteria'].filter(d => d.pad.endsWith('.naam')).map(d => d.pad.split('.')[3]), ['TE', 'TA', 'FY', 'ME', 'GE']);
assert.equal(INSTELLEN['leer.domeinen'], INSTELLEN['eval.criteria']);
/* een niveau of domein zonder naam mag niet: dat geeft een leeg label in de beoordeling */
assert.match(controleerInstelling(INSTELLEN['eval.vorm'][0], '  ').fout, /vul een naam in/);
assert.match(instelWijzigingen('eval.vorm', {}, Object.fromEntries(INSTELLEN['eval.vorm'].map(d => [d.pad, d.pad.endsWith('3.label') ? '' : d.standaard]))).fout, /Niveau 3: vul een naam in/);
assert.deepEqual(instelWijzigingen('eval.vorm', {}, Object.fromEntries(INSTELLEN['eval.vorm'].map(d => [d.pad, d.pad.endsWith('1.label') ? 'Onvoldoende' : d.pad.endsWith('1.kort') ? 'ONV' : d.standaard]))),
  { wijzigingen: [['lijsten.niveaus.items.1.label', 'Onvoldoende'], ['lijsten.niveaus.items.1.kort', 'ONV']] });
assert.equal(instelWaarde({ lijsten: { skills: { items: { TA: { naam: 'Inzicht' } } } } }, INSTELLEN['eval.criteria'][2]), 'Inzicht');
/* rondes: geldige datums, einde na begin, geen dubbele naam, hoogstens zes */
assert.deepEqual(schoonRondes([{ naam: ' Winterevaluatie ', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }, { naam: 'winterevaluatie', tot: '2027-01-01' }, { naam: 'Fout', tot: 'mei' },
  { naam: 'Omgekeerd', van: '2027-06-01', tot: '2027-05-01' }, { naam: 'Zonder begin', soort: 'raar', tot: '2027-05-31' }, { naam: '', tot: '2027-05-31' }, { naam: 'Bestaat niet', tot: '2027-13-45' }]),
  [{ naam: 'Winterevaluatie', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }, { naam: 'Zonder begin', soort: 'volledig', van: null, tot: '2027-05-31' }]);
assert.equal(schoonRondes(Array.from({ length: 9 }, (_, i) => ({ naam: 'R' + i, tot: '2027-01-0' + (i + 1) }))).length, 6);
assert.deepEqual(seizoenVan("2026/'27"), { start: 2026, label: "2026/'27", tekst: 'augustus 2026 tot en met juni 2027' });
assert.equal(seizoenVan('', Date.UTC(2026, 10, 20)).label, "2026/'27");
assert.equal(seizoenVan(null, Date.UTC(2027, 2, 1)).label, "2026/'27");
const rv = schoonVoorstel({ tekst: 'Wij beoordelen twee keer.', rondes: [{ naam: 'Winter', tot: '2026-12-31' }] }, 'eval.momenten');
assert.deepEqual(rv.rondes, [{ naam: 'Winter', soort: 'volledig', van: null, tot: '2026-12-31' }]);
assert.deepEqual(schoonVoorstel({ tekst: 'x', rondes: [{ naam: 'Winter', tot: '2026-12-31' }] }, 'eval.wie').rondes, [], 'rondes alleen bij het veld dat ze vraagt');
/* samenvoegen met wat de club al heeft: zelfde naam wordt bijgewerkt, niets verdwijnt, nieuwe rondes gelden voor alle teams */
const sm = rondesSamenvoegen([{ id: 'r1', naam: 'Winter', soort: 'snel', tot: '2026-12-15', teams: ['t1'], status: 'gesloten', seizoen: "2026/'27" }, { id: 'r0', naam: 'Eigen ronde van de club', tot: '2026-10-01', teams: ['t2'] }],
  [{ naam: 'winter', van: '2026-12-01', tot: '2026-12-31' }, { naam: 'Voorjaar', van: '2027-05-01', tot: '2027-05-31' }], { teams: ['t1', 't2'], seizoen: "2026/'27", nuMs: 1000 });
assert.deepEqual(sm.lijst.map(r => [r.id, r.naam, r.tot, r.teams.join('+'), r.status]), [['r1', 'Winter', '2026-12-31', 't1', 'gesloten'], ['r0', 'Eigen ronde van de club', '2026-10-01', 't2', undefined], [sm.ids[1], 'Voorjaar', '2027-05-31', 't1+t2', 'open']]);
assert.deepEqual([sm.ids[0], sm.lijst[2].seizoen, sm.lijst[2].gemaaktMs, sm.lijst[0].soort], ['r1', "2026/'27", 1000, 'volledig']);
assert.deepEqual(rondesSamenvoegen(null, [], {}).lijst, []);

/* eigen rolnamen van de club */
const clubR = { instellingen: { jeugdRolNaam: 'Hoofd opleidingen', rolNamen: { coordinator: '  TC-lid  ', coach: '', trainco: 7 } } };
assert.equal(rolNaam('coordinator', clubR, 'Coördinator'), 'TC-lid');
assert.equal(rolNaam('coach', clubR, 'Coach'), 'Coach');
assert.equal(rolNaam('trainco', clubR), 'Trainingscoördinator');
assert.equal(rolNaam('hoofdJeugd', clubR), 'Hoofd opleidingen');
assert.equal(rolNaam('coordinator', null), 'Bouwcoördinator');
assert.equal(rolNaam('coordinator', {}, 'Coördinatoren'), 'Coördinatoren');
assert.equal(eigenRolNaam('coach', clubR), '');
assert.equal(eigenRolNaam('coach', { instellingen: { rolNamen: { coach: 'x'.repeat(80) } } }).length, 40);
assert.deepEqual(ROLLEN.map(r => r[0]), ['coach', 'coordinator', 'trainco', 'hoofdJeugd']);
for (const d of [...INSTELLEN['rol.lijst'], ...INSTELLEN['rol.hoofd']]) assert.ok(d.pad === 'jeugdRolNaam' || ROLLEN.some(r => 'rolNamen.' + r[0] === d.pad), d.pad + ' is een rol die rolnamen.js kent');

/* [20261120f] het overzicht voor de club: alleen wat in Cluppie is gezet, met de plek waar het staat */
const { inrichtingOverzicht, datumVoluit } = await import('../public/js/clubprofiel-logica.js');
const { tabelRijen, pdfTekst } = await import('../public/js/clubprofiel-pdf.js');
assert.equal(datumVoluit('2026-12-01'), '1 december 2026');
assert.equal(datumVoluit('onzin'), 'onzin');
const pf = { bevindingen: {
  a: { veld: 'bouw.grenzen', waarde: 'Onderbouw t/m O10', oordeel: 'akkoord', verwerkt: true, gemaaktMs: 1, gezet: { ms: 5, tekst: 'Onze onderbouw loopt t/m O10.', regels: [], instellingen: { 'regels.bouwGrenzen.onderTm': 10, 'regels.bouwGrenzen.middenTm': 13 }, status: 'gepubliceerd', ids: [] } },
  b: { veld: 'eval.momenten', waarde: 'Twee keer per jaar', oordeel: 'akkoord', verwerkt: true, gemaaktMs: 2, gezet: { ms: 5, tekst: 'Wij beoordelen twee keer.', rondes: [{ naam: 'Winterevaluatie', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }], instellingen: {}, status: 'concept' } },
  c: { veld: 'gedrag.regels', waarde: 'Op tijd', oordeel: 'akkoord', verwerkt: true, gemaaktMs: 3, gezet: { ms: 5, tekst: '', regels: ['We zijn op tijd', 'Respect'], instellingen: {}, status: 'concept' } },
  d: { veld: 'rol.besluit', waarde: 'De club stuurt', oordeel: 'akkoord', verwerkt: true, gemaaktMs: 4, gezet: { ms: 5, tekst: '', instellingen: { werkwijze: 'club' }, status: 'concept' } },
  e: { veld: 'rollen.overig', waarde: 'Materiaalman: beheert de ballen', oordeel: 'akkoord', verwerkt: true, gemaaktMs: 5, gezet: { ms: 5, titel: 'Materiaalman', tekst: 'Hij beheert de ballen.', status: 'gepubliceerd' } },
  f: { veld: 'wed.speeltijd', waarde: 'Iedereen speelt', oordeel: 'open', gemaaktMs: 6 },
  g: { veld: 'spel.visie', waarde: 'Aanvallend', oordeel: 'afgewezen', gemaaktMs: 7, gezet: { ms: 1, tekst: 'Vervallen tekst' } },
} };
const ov = inrichtingOverzicht(pf, { naam: 'FC Testdorp', instellingen: { identiteit: { kleur: '#0A5CFF' } } }, new Date(2026, 10, 20).getTime());
assert.deepEqual([ov.clubNaam, ov.datum, ov.aantal, ov.totaal, ov.kleur, ov.heeftConcept], ['FC Testdorp', '20 november 2026', 5, alleVelden().length, '#0a5cff', true]);
assert.deepEqual(ov.hoofdstukken.map(h => h.naam), ['Organisatie en rollen', 'Bouwen en leeftijdsgroepen', 'Evalueren en volgen', 'Gedrag en normen'], 'in de volgorde van de hoofdstukken, zonder wat open of afgewezen is');
const bouwOv = ov.hoofdstukken[1].onderwerpen[0];
assert.deepEqual(bouwOv.regels.map(r => [r.plek, r.label, r.waarde]), [['Instelling', 'Jongste bouw tot en met O-leeftijd', '10'], ['Instelling', 'Middelste bouw tot en met O-leeftijd', '13'], ['Clubwijzer', '', 'Onze onderbouw loopt t/m O10.']]);
assert.deepEqual(ov.hoofdstukken[2].onderwerpen[0].regels[0], { soort: 'ronde', plek: 'Evaluatieronde', label: 'Winterevaluatie', waarde: 'Snelle beoordeling, 1 december 2026 tot en met 31 december 2026' });
assert.equal(ov.hoofdstukken[2].onderwerpen[0].regels[1].concept, true);
assert.equal(ov.hoofdstukken[3].onderwerpen[0].regels[0].waarde, '- We zijn op tijd\n- Respect');
assert.deepEqual(ov.hoofdstukken[0].onderwerpen.map(x => [x.label, x.regels[0].waarde]), [['Wie beslist wat', 'Club stuurt'], ['Materiaalman', 'Hij beheert de ballen.']]);
assert.ok(ov.open.some(m => m.label === 'Speeltijd') === false && ov.open.some(m => m.label === 'Voetbalvisie'), 'wat open staat is geen manco, wat is afgewezen wel');
assert.equal(inrichtingOverzicht({}, null).aantal, 0);
assert.equal(inrichtingOverzicht({}, { instellingen: { identiteit: { kleur: 'rood' } } }).kleur, '#e2342f');
/* de tabel van de PDF: het onderwerp beslaat al zijn regels; alleen tekens die het PDF-font kent */
const rijen = tabelRijen(ov.hoofdstukken[2]);
assert.deepEqual([rijen.length, rijen[0].length, rijen[1].length, rijen[0][0].rowSpan, rijen[0][0].content], [2, 3, 2, 2, 'Momenten in het jaar']);
assert.deepEqual(rijen[1], ['Clubwijzer (concept)', 'Wij beoordelen twee keer.']);
assert.equal(rijen[0][2], 'Winterevaluatie: Snelle beoordeling, 1 december 2026 tot en met 31 december 2026');
assert.equal(pdfTekst('Clubwijzer › “Zo’n” afspraak – klaar… ✓ coördinator'), 'Clubwijzer > "Zo\'n" afspraak - klaar...  coördinator');

console.log('clubprofiel: ok');
