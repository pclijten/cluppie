// Vrijwilligersbank: vast omlijnde taken, wat openbaar zichtbaar is, en aanmelden zonder account.
// Draaien: node tests/vrijwilligers.test.mjs
import * as V from '../public/js/vrijwilligers-logica.js';
let n = 0, mis = 0;
const ok = (v, wat) => { n++; if (!v){ mis++; console.log('MIS: ' + wat); } };

/* een taak opschonen */
const t = V.schoneTaak({ titel: '  Bardienst   zaterdag ', cat: 'kantine', wat: 'Je staat achter de bar.\n\n\n\nMet z\'n tweeën.', stappen: '1. Kwartier vooraf aanwezig\n- Koffie zetten\n\n• Kassa tellen', freq: 'tweewekelijks', moment: 'za 8:00-12:30', duur: '4 uur', nodig: '6', geplaatst: 2, contact: 'Kantinecommissie', status: 'raar', vreemd: 'x' });
ok(t.titel === 'Bardienst zaterdag' && t.cat === 'kantine' && t.freq === 'tweewekelijks' && t.status === 'open' && !('vreemd' in t), 'taak opgeschoond, onbekende velden weg');
ok(t.stappen.length === 3 && t.stappen[0] === 'Kwartier vooraf aanwezig' && t.stappen[2] === 'Kassa tellen', 'stappen: één per regel, zonder nummers en streepjes');
ok(!/\n{3}/.test(t.wat), 'witregels in de omschrijving beperkt');
ok(V.schoneTaak({ cat: 'onbekend', freq: 'x', nodig: -4 }).cat === 'overig' && V.schoneTaak({ freq: 'x' }).freq === 'seizoen' && V.schoneTaak({ nodig: -4 }).nodig === 0 && V.schoneTaak({ nodig: 500 }).nodig === 99, 'standaardwaarden en grenzen');
ok(V.stappenUit(Array.from({ length: 20 }, (_, i) => 'stap ' + i)).length === V.MAX_STAPPEN, 'hooguit acht stappen');

/* vast omlijnd: wat ontbreekt er nog */
ok(V.ontbreekt(t).length === 0, 'volledige taak: niets ontbreekt');
const kaal = V.ontbreekt({ titel: 'Scheidsrechter' });
ok(kaal.length === 5 && kaal.includes('de stappen') && kaal.includes('wanneer') && kaal.includes('bij wie je terecht kunt'), 'kale taak: alles wat nog moet');
ok(V.ontbreekt({ ...t, stappen: ['één stap'] }).join() === 'de stappen', 'minstens twee stappen');

/* aantallen */
ok(V.nogNodig(t) === 4 && V.nogNodig({ nodig: 0, geplaatst: 3 }) === null && V.nogNodig({ nodig: 2, geplaatst: 5 }) === 0, 'nog gezocht');

/* lijst en zichtbaarheid */
const map = { b: { titel: 'B-taak', volg: 2 }, a: { titel: 'A-taak', volg: 1, status: 'vervuld' }, c: { titel: 'Verborgen', volg: 3, status: 'verborgen' }, d: { titel: '', volg: 4 }, e: null };
const lijst = V.takenLijst(map);
ok(lijst.length === 4 && lijst[0].id === 'a' && lijst[1].id === 'b', 'taken op volgorde, lege waarden overgeslagen');
const z = V.zichtbaar(lijst);
ok(z.length === 2 && z.every(x => x.status !== 'verborgen' && x.titel), 'bezoekers zien geen verborgen of naamloze taken');
ok(V.takenLijst(Object.fromEntries(Array.from({ length: 80 }, (_, i) => ['t' + i, { titel: 'T' + i, volg: i }]))).length === V.MAX_TAKEN, 'hooguit zestig taken');

/* openbare kop */
const k = V.bankKopie({ clubNaam: ' VV  Voorbeeld ', logo: 'javascript:alert(1)', kleur: 'rood', intro: 'Help mee!', contact: 'Sandra', contactMail: 'geen mail', geheim: 1 });
ok(k.clubNaam === 'VV Voorbeeld' && k.logo === '' && k.kleur === '' && k.contactMail === '' && !('geheim' in k), 'kop: alleen veilige waarden');
ok(V.bankKopie({ logo: 'data:image/png;base64,iVBORw0KGgo=', kleur: '#0A7F3F', contactMail: 'vrijwilligers@club.nl' }).kleur === '#0A7F3F', 'logo, kleur en mail blijven staan als ze kloppen');

/* aanmelden */
ok(V.schoneAanmelding({ naam: '', contact: 'a@b.nl' }).veld === 'naam', 'naam verplicht');
ok(V.schoneAanmelding({ naam: 'Kim', contact: 'kim' }).veld === 'contact' && V.schoneAanmelding({ naam: 'Kim', contact: '0612' }).veld === 'contact', 'e-mail of telefoon verplicht');
const a1 = V.schoneAanmelding({ naam: ' Kim  de Vries ', contact: '06 12 34 56 78', opm: 'x'.repeat(400), uid: 'hack', status: 'geplaatst' });
ok(a1.ok && a1.data.naam === 'Kim de Vries' && a1.data.opm.length === 300 && Object.keys(a1.data).join() === 'naam,contact,opm', 'aanmelding: alleen naam, contact en opmerking');
ok(V.schoneAanmelding({ naam: 'Kim', contact: 'kim@voorbeeld.nl' }).ok, 'e-mailadres is genoeg');

/* tellen en csv */
const aanm = [{ taak: 'a', naam: 'Kim', contact: 'kim@x.nl', ms: 2, status: 'nieuw' }, { taak: 'a', naam: 'Bo', contact: '0612345678', ms: 1, status: 'geplaatst', opm: 'kan; alleen "zaterdag"' }, { taak: 'a', naam: 'Sam', contact: 's@x.nl', status: 'afgewezen' }, { taak: 'b', naam: 'Jip', contact: 'j@x.nl' }, { naam: 'zonder taak' }];
const tel = V.telAanmeldingen(aanm);
ok(tel.a.n === 2 && tel.a.nieuw === 1 && tel.a.geplaatst === 1 && tel.b.n === 1 && tel.b.nieuw === 1, 'tellen per taak, afgewezen telt niet mee');
const csv = V.csvAanmeldingen(aanm.slice(0, 2), { a: { titel: 'A-taak' } });
ok(csv.charCodeAt(0) === 0xFEFF && csv.includes('Taak;Naam;Contact') && csv.includes('\r\nA-taak;Bo;0612345678;"kan; alleen ""zaterdag""";Geplaatst;') && csv.indexOf('Bo') < csv.indexOf('Kim'), 'csv: op volgorde van aanmelden, met aanhalingstekens');

/* voorbeelden: elk voorbeeld is zelf een vast omlijnde taak */
ok(V.VOORBEELDEN.length >= 8, 'genoeg voorbeeldtaken');
for (const v of V.VOORBEELDEN){ const mis2 = V.ontbreekt({ ...v, contact: v.contact || 'x' }); ok(mis2.length === 0 && V.CATS[v.cat] && V.FREQ[v.freq], `voorbeeld "${v.titel}" is compleet${mis2.length ? ' (mist ' + mis2.join(', ') + ')' : ''}`); }

console.log(mis ? `vrijwilligers: ${mis} van ${n} MIS` : `vrijwilligers: ${n} controles geslaagd`);
process.exit(mis ? 1 : 0);
