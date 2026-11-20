// Clubprofiel: hoofdstukken, document splitsen, bevindingen samenvoegen, stand en uitvoer.
// Draaien: node --no-warnings tests/clubprofiel.test.mjs
import assert from 'node:assert/strict';
import { HOOFDSTUKKEN, alleVelden, veldOpId, veldenVoorAI, documentId, splitsDocument, halveer, docxTekst, schoonBevinding,
  opTeRuimen, nieuweBevindingen, veldStand, overzicht, pastInFilter, vragenTekst, profielTekst, werklijstTekst } from '../public/js/clubprofiel-logica.js';

/* hoofdstukken: unieke id's, elk veld hoort bij zijn hoofdstuk en heeft een vraag en een plek in Cluppie */
const ids = alleVelden().map(v => v.id);
assert.equal(new Set(ids).size, ids.length, 'veld-id is uniek');
assert.equal(new Set(HOOFDSTUKKEN.map(h => h.id)).size, HOOFDSTUKKEN.length);
for (const h of HOOFDSTUKKEN){
  assert.match(h.id, /^[a-z]+$/);
  for (const v of h.velden){
    assert.match(v.id, /^[a-z]+\.[a-z]+$/);
    assert.ok(v.label && v.vraag.endsWith('?') && v.doel, v.id);
    assert.equal(v.hoofdstuk, h.id);
    assert.notEqual(v.id, h.id + '.overig');
  }
}
assert.equal(veldOpId('bouw.indeling').label, 'Bouwen en hun namen');
assert.equal(veldOpId('rollen.overig').hoofdstuk, 'rollen');
assert.equal(veldOpId('bestaatniet.overig'), null);
assert.equal(veldOpId('rollen.verzonnen'), null);
assert.equal(veldenVoorAI().length, HOOFDSTUKKEN.length);
assert.ok(JSON.stringify(veldenVoorAI()).length < 12000, 'de veldenlijst blijft klein');

/* splitsen: op paginagrenzen, elk stuk binnen de maat, niets kwijt */
const pag = n => `[pagina ${n}]\n` + 'woord '.repeat(150) + '\n\n';
const doc = Array.from({ length: 10 }, (_, i) => pag(i + 1)).join('');
const stukken = splitsDocument(doc, 2000);
assert.ok(stukken.length >= 5 && stukken.every(s => s.length <= 2000));
assert.ok(stukken.every(s => s.startsWith('[pagina ')));
assert.equal(stukken.join(''), doc);
const lang = '[pagina 7]\n' + Array.from({ length: 40 }, (_, i) => `Alinea ${i} ` + 'x'.repeat(200)).join('\n\n');
const delen = splitsDocument(lang, 1500);
assert.ok(delen.length > 3 && delen.every(s => s.length <= 1500 && s.startsWith('[pagina 7]\n')), 'een lange pagina houdt zijn paginanummer');
assert.deepEqual(splitsDocument('  '), []);
const [a, b] = halveer('[pagina 3]\n' + 'regel een\n'.repeat(60));
assert.ok(a.length > 200 && b.startsWith('[pagina 3]\n'), 'de tweede helft weet nog welke pagina het is');

/* docx */
assert.equal(docxTekst('<w:body><w:p><w:r><w:t>Onderbouw &amp; middenbouw</w:t></w:r></w:p><w:p><w:r><w:t>O8</w:t><w:tab/><w:t>O9</w:t></w:r></w:p></w:body>'), 'Onderbouw & middenbouw\nO8\tO9');
assert.notEqual(documentId('Plan.pdf', 100), documentId('Plan.pdf', 101));
assert.equal(documentId('Plan.pdf', 100), documentId('plan  PDF', 100));

/* bevindingen */
assert.equal(schoonBevinding({ veld: 'onbekend', waarde: 'x' }), null);
assert.equal(schoonBevinding({ veld: 'bouw.indeling', waarde: '  ' }), null);
const s = schoonBevinding({ veld: 'bouw.indeling', waarde: 'Drie  bouwen', pagina: '4', zeker: 'raar', oordeel: 'x' });
assert.deepEqual([s.waarde, s.pagina, s.zeker, s.oordeel, s.verwerkt], ['Drie bouwen', 4, 'middel', 'open', false]);

let n = 0; const id = () => 'b' + (++n);
const profiel = { documenten: {}, bevindingen: {} };
const d1 = { id: 'd1', naam: 'Jeugdplan.pdf' }, d2 = { id: 'd2', naam: 'Reglement.docx' };
Object.assign(profiel.bevindingen, nieuweBevindingen(profiel, [
  { veld: 'bouw.indeling', waarde: 'Onderbouw, middenbouw en bovenbouw', citaat: 'drie bouwen', pagina: 2, zeker: 'hoog', citaatOk: true },
  { veld: 'bouw.indeling', waarde: 'Onderbouw, middenbouw en bovenbouw' },
  { veld: 'verzonnen.veld', waarde: 'x' },
  { veld: 'rollen.overig', waarde: 'Er is een materiaalman' },
], d1, 1000, id));
assert.equal(Object.keys(profiel.bevindingen).length, 2, 'dubbel en onbekend veld vallen af');
Object.assign(profiel.bevindingen, nieuweBevindingen(profiel, [{ veld: 'bouw.indeling', waarde: 'Minis, pupillen en junioren' }], d2, 2000, id));
const o = overzicht(profiel);
const bouwen = o.hoofdstukken.find(h => h.id === 'bouwen');
assert.equal(bouwen.velden[0].stand.stand, 'open');
assert.equal(bouwen.velden[0].stand.meerdere, true);
assert.deepEqual([bouwen.tel.velden, bouwen.tel.open, bouwen.tel.leeg, bouwen.tel.meerdere], [3, 1, 2, 1]);
const rollen = o.hoofdstukken.find(h => h.id === 'rollen');
assert.equal(rollen.velden.at(-1).overig, true, 'overig verschijnt alleen als er iets in staat');
assert.equal(o.hoofdstukken.find(h => h.id === 'teams').velden.some(v => v.overig), false);
assert.equal(o.totaal.velden, alleVelden().length + 1);

/* opnieuw inlezen: alleen wat nog open is van dat document gaat weg; beoordeeld blijft en komt niet dubbel */
const eersteBouw = Object.keys(profiel.bevindingen).find(k => profiel.bevindingen[k].veld === 'bouw.indeling' && profiel.bevindingen[k].docId === 'd1');
const overig = Object.keys(profiel.bevindingen).find(k => profiel.bevindingen[k].veld === 'rollen.overig');
profiel.bevindingen[eersteBouw].oordeel = 'akkoord';
assert.deepEqual(opTeRuimen(profiel, 'd1'), [overig]);
assert.deepEqual(nieuweBevindingen(profiel, [{ veld: 'bouw.indeling', waarde: 'onderbouw, middenbouw en bovenbouw.' }], d1, 3000, id), {});

/* stand van een veld */
const st = (...x) => veldStand(x.map((bev, i) => ({ id: 'x' + i, waarde: 'w' + i, oordeel: 'open', verwerkt: false, ...bev }))).stand;
assert.equal(st(), 'leeg');
assert.equal(st({ oordeel: 'afgewezen' }), 'leeg');
assert.equal(st({ oordeel: 'akkoord' }, {}), 'open');
assert.equal(st({ oordeel: 'akkoord' }, { oordeel: 'akkoord', verwerkt: true }), 'akkoord');
assert.equal(st({ oordeel: 'akkoord', verwerkt: true }, { oordeel: 'afgewezen' }), 'verwerkt');
assert.equal(pastInFilter({ stand: { stand: 'leeg' } }, 'leeg') && pastInFilter({ stand: { stand: 'open' } }, 'alles') && !pastInFilter({ stand: { stand: 'open' } }, 'leeg'), true);

/* uitvoer */
const vragen = vragenTekst(profiel, 'FC Testdorp');
assert.match(vragen, /^Vragen voor FC Testdorp/);
assert.match(vragen, /Welke leeftijden horen bij welke bouw\?/);
assert.match(vragen, /verschillende antwoorden[\s\S]*Jeugdplan\.pdf[\s\S]*Reglement\.docx/);
assert.ok(!/In welke bouwen is de jeugd verdeeld/.test(vragen), 'een gevonden onderwerp is geen vraag meer');
const md = profielTekst(profiel, 'FC Testdorp');
assert.match(md, /^# Clubprofiel FC Testdorp/);
assert.match(md, /## Bouwen en leeftijdsgroepen[\s\S]*- Onderbouw, middenbouw en bovenbouw _\[Jeugdplan\.pdf, p\. 2\]_/);
assert.match(md, /nog niet beoordeeld/);
assert.ok(!/nog niet beoordeeld|niet gevonden/.test(profielTekst(profiel, 'FC Testdorp', true)), 'alleen goedgekeurd');
assert.match(werklijstTekst(profiel, 'FC Testdorp'), /Standaardbouwen: Bouwen en hun namen\n {3}- Onderbouw, middenbouw en bovenbouw/);
profiel.bevindingen[eersteBouw].verwerkt = true;
assert.match(werklijstTekst(profiel, 'FC Testdorp'), /Niets: alles wat is goedgekeurd is verwerkt/);
assert.match(vragenTekst({}, ''), /Vragen voor de club/);

/* [20261120c] instellen: elk veld met instellingen bestaat, paden zijn geldig, waarden worden gecontroleerd */
const { INSTELLEN, instelVelden, instelWaarde, controleerInstelling, instelWijzigingen, instelVeldenVoorAI } = await import('../public/js/clubprofiel-logica.js');
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

/* [20261120c] eigen rolnamen van de club */
const { rolNaam, eigenRolNaam, ROLLEN } = await import('../public/js/rolnamen.js');
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

console.log('clubprofiel: ok');
