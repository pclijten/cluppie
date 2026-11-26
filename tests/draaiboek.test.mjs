// Draaiboek per onderwerp en Word-export. Draaien: node tests/draaiboek.test.mjs
import assert from 'node:assert/strict';
const L = await import('../public/js/activiteiten-logica.js');
const D = await import('../public/js/draaiboek-logica.js');
const X = await import('../public/js/draaiboek-docx.js');
const { sjabloonVan, SJABLONEN } = await import('../public/js/activiteit-sjablonen.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* rol en titel bepalen het onderwerp */
gelijk(D.rolNaarOnderwerp('Kantine en inkoop'), 'kantine');
gelijk(D.rolNaarOnderwerp('Wedstrijdzaken'), 'wedstrijd');
gelijk(D.rolNaarOnderwerp('Voorzitter'), 'basis');
gelijk(D.titelNaarOnderwerp('Vrijwilligersdiensten openzetten (scheidsrechters, kantine)'), 'vrijwilligers', 'eerste trefwoord wint');
gelijk(D.titelNaarOnderwerp('Ouders informeren'), 'communicatie');
gelijk(D.titelNaarOnderwerp('Bekers'), 'kantine');

const kerst = L.vanSjabloon(sjabloonVan('kersttoernooi'), { naam: 'Kersttoernooi', datum: '2026-12-20', door: 'u1', nu: 1 });
const lijst = D.onderwerpen(kerst);
gelijk(lijst.map(o => o.id), ['basis', 'wedstrijd', 'kantine', 'vrijwilligers', 'communicatie', 'veiligheid', 'budget', 'na'], 'kersttoernooi: alle standaardonderwerpen');
gelijk(lijst[1].naam, 'Wedstrijdzaken', 'toernooi heet Wedstrijdzaken');
const naar = titel => D.taakOnderwerp(Object.values(kerst.taken).find(t => t.titel.startsWith(titel)), kerst, lijst);
gelijk(naar('Begroting maken'), 'kantine', 'rol Kantine en inkoop wint van titel');
gelijk(naar('Plan B'), 'basis', 'voorzitter zonder trefwoord: basis');
gelijk(naar('Aankondiging'), 'communicatie');
ok(D.perOnderwerp(kerst, '2026-11-26').reduce((s, o) => s + o.taken.length, 0) === Object.keys(kerst.taken).length, 'elke taak bij precies één onderwerp');

/* voor elk sjabloon: elke taak landt in een onderwerp dat bestaat */
for (const sj of SJABLONEN){
  const act = L.vanSjabloon(sj, { datum: '2026-12-20' });
  const po = D.perOnderwerp(act, '2026-11-26');
  gelijk(po.reduce((s, o) => s + o.taken.length, 0), Object.keys(act.taken).length, `${sj.id}: alle taken verdeeld`);
}

/* een eigen keuze wint, een onbekend onderwerp valt terug */
gelijk(D.taakOnderwerp({ titel: 'Ouders informeren', onderwerp: 'budget' }, kerst), 'budget');
gelijk(D.taakOnderwerp({ titel: 'Ouders informeren', onderwerp: 'bestaatniet' }, kerst), 'communicatie');

/* opgeslagen afwijkingen: naam, weg, eigen onderwerp, antwoorden en eigen vragen */
const met = { ...kerst, onderwerpen: {
  budget: { weg: true },
  kantine: { naam: 'Kantine', eigenaar: 'c1', vragen: { leverancier: { antwoord: 'Sligro' }, bijzonder: { weg: true }, v9: { vraag: 'Wie heeft de sleutel?', antwoord: '', volg: 100 } } },
  o1: { naam: 'Muziek', icoon: 'planning-activity', volg: 105, eigen: true },
}, comite: { c1: { naam: 'Carla', rol: 'Kantine en inkoop' }, c2: { naam: 'Eva', rol: 'Communicatie' } } };
const l2 = D.onderwerpen(met);
ok(!l2.some(o => o.id === 'budget'), 'weggehaald onderwerp is weg');
ok(l2.some(o => o.id === 'o1' && o.naam === 'Muziek'), 'eigen onderwerp');
const kan = l2.find(o => o.id === 'kantine');
gelijk(kan.naam, 'Kantine');
gelijk(kan.vragen.map(v => v.id), ['leverancier', 'contact', 'levering', 'v9']);
gelijk(kan.vragen[0].antwoord, 'Sligro');
gelijk(D.eigenaarVan(kan, met), { id: 'c1', naam: 'Carla', gekozen: true });
gelijk(D.eigenaarVan(l2.find(o => o.id === 'communicatie'), met), { id: 'c2', naam: 'Eva', gekozen: false }, 'eigenaar op rol');
gelijk(D.taakOnderwerp(Object.values(kerst.taken).find(t => t.titel.startsWith('Begroting')), met), 'kantine');

/* zonder budget-tab en zonder taken: geen leeg onderwerp Budget */
const info = L.vanSjabloon(sjabloonVan('infoavond'), { datum: '2026-12-20' });
const zonder = { ...info, tabs: { ...info.tabs, budget: false } };
ok(!D.onderwerpen(zonder).some(o => o.id === 'budget') || D.perOnderwerp(zonder, '2026-11-26').find(o => o.id === 'budget').taken.length > 0, 'budget alleen met taken of aan');
gelijk(D.onderwerpen(info)[1].naam, 'Programma en deelnemers', 'geen toernooi: Programma en deelnemers');

/* spullen en kosten per onderwerp */
const regels = { m1: { naam: 'Bekers', volg: 1 }, m2: { naam: 'Ballen', volg: 2 }, m3: { naam: 'Pionnen', onderwerp: 'kantine', volg: 3 } };
gelijk(D.regelsVan(regels, 'kantine', kerst, 'spullen').map(r => r.id), ['m1', 'm3']);
gelijk(D.regelsVan(regels, 'wedstrijd', kerst, 'spullen').map(r => r.id), ['m2'], 'zonder trefwoord: eerste onderwerp met spullen');
const kosten = { b1: { naam: 'Prijzen en medailles', soort: 'uit' }, b2: { naam: 'Zaalhuur', soort: 'uit' }, b3: { naam: 'Omzet kantine', soort: 'in' } };
gelijk(D.regelsVan(kosten, 'kantine', kerst, 'kosten').map(r => r.id), ['b1'], 'zaalhuur en inkomsten niet bij kantine');

/* vragen per taak */
gelijk(D.taakVragen({ titel: 'Prijzen en versiering bestellen' }).blokken, ['spullen', 'kosten']);
gelijk(D.taakVragen({ titel: 'Vrijwilligersdiensten openzetten' }).naar, 'vrijwilligers');
gelijk(D.taakVragen({ titel: 'Iets heel anders' }), { vragen: [], blokken: [], naar: '' });

/* het document */
const act = { ...met, taken: { ...kerst.taken, t001: { ...kerst.taken.t001, status: 'klaar', antw: { contact: 'Henk 0612' }, notitie: 'sleutel bij Henk' } },
  materiaal: regels, budget: kosten, locatie: 'Sporthal' };
const doc = D.draaiboekDoc(act, { vandaag: '2026-11-26' });
gelijk(doc.titel, 'Draaiboek Kersttoernooi');
ok(doc.sub.includes('Sporthal'));
ok(doc.secties[0].kop === 'Datum, plek en comité');
const basis = doc.secties[0], takenTabel = basis.delen.find(d => d.soort === 'tabel' && d.vink);
ok(takenTabel.rijen.some(r => r[0] === '☑' && r[2].includes('Henk 0612') && r[2].includes('sleutel bij Henk')), 'antwoorden en notitie bij de taak');
ok(doc.secties.find(s => s.id === 'kantine').delen.some(d => d.soort === 'dl' && d.rijen.some(r => r[0] === 'Leverancier eten en drinken' && r[1] === 'Sligro')), 'afspraken in het document');
gelijk(D.draaiboekDoc(act, { alleen: 'kantine' }).secties.map(s => s.id), ['kantine'], 'alleen één onderwerp');

/* Word */
const delen = X.docxBestanden(doc);
gelijk(Object.keys(delen).sort(), ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml']);
const xml = delen['word/document.xml'];
ok(xml.startsWith('<?xml') && xml.includes('<w:body>') && xml.includes('</w:document>'));
ok(xml.includes('Heading1') && xml.includes('<w:tbl>'), 'koppen en tabellen');
ok(xml.includes('Sligro'));
gelijk(X.xmlEsc('a<b>&"c"\u0001'), 'a&lt;b&gt;&amp;&quot;c&quot;');
{ const x = X.documentXml({ titel: 'A & B <c>', secties: [{ kop: 'x', delen: [{ soort: 'tekst', tekst: '1 < 2' }] }] }); ok(x.includes('1 &lt; 2') && !x.includes('1 < 2') && x.includes('A &amp; B &lt;c&gt;'), 'tekens ontsnapt'); }
/* aantal open en dichte tags klopt grofweg */
for (const tag of ['w:p', 'w:tbl', 'w:tr', 'w:tc']){
  const open = (xml.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, dicht = (xml.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  gelijk(open, dicht, `${tag} open = dicht`);
}
console.log(`draaiboek: ${n} controles in orde`);
