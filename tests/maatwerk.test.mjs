// Maatwerk per club (Platformcentrum): waarden, afwijkingen, overnemen, overzicht per club, notities. Draaien: node tests/maatwerk.test.mjs
import assert from 'node:assert/strict';
const M = await import('../public/js/maatwerk-logica.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* zelfde regel als platformToegestaan in onderdelen.js: zonder opgeslagen waarde heeft een oude club het onderdeel */
const toegestaan = (club, sl) => { const v = club?.platformModules?.[sl]; return v === true || v === false ? v : club?.oud === true; };
const STD = { trainingsmodule: true, seizoensplan: true, ai: false, aiLimiet: 100, maxVideoMB: 100 };
const std = M.standaardWaarden(STD);
gelijk(std, { trainingsmodule: true, seizoensplan: true, ai: false, scouting: false, teamkamer: false, leren: false, veldplanner: false, activiteiten: false, pdfOmzetten: false, aiLimiet: 100, maxVideoMB: 100 });
gelijk(M.standaardWaarden(null).maxVideoMB, 100, 'zonder standaard: video 100 MB');
gelijk(M.standaardWaarden({ aiLimiet: '' }).aiLimiet, null);

/* waarden van een club */
const club = pm => ({ id: 'c', naam: 'VV Test', platformModules: pm });
gelijk(M.waardenVan(club({ trainingsmodule: true, ai: true, aiLimiet: 300, maxVideoMB: 200 }), toegestaan),
  { trainingsmodule: true, seizoensplan: false, ai: true, scouting: false, teamkamer: false, leren: false, veldplanner: false, activiteiten: false, pdfOmzetten: false, aiLimiet: 300, maxVideoMB: 200 });
gelijk(M.waardenVan({ oud: true }, toegestaan).trainingsmodule, true, 'oude club zonder opgeslagen waarde');
gelijk(M.waardenVan(club({ maxVideoMB: 900 }), toegestaan).maxVideoMB, 100, 'ongeldige videogrootte valt terug');
gelijk(M.waardenVan(null, toegestaan).aiLimiet, null);

/* afwijkingen */
gelijk(M.afwijkingen(std, std), []);
{
  const a = M.afwijkingen(M.waardenVan(club({ trainingsmodule: true, seizoensplan: true, ai: true, aiLimiet: 300, scouting: true, maxVideoMB: 100 }), toegestaan), std);
  gelijk(a.map(x => x.id), ['ai', 'scouting', 'aiLimiet']);
  gelijk(a.map(x => x.tekst), ['AI-functies aan', 'Scouting aan', 'AI per maand 300']);
  gelijk(a[0].meer, true);
}
gelijk(M.afwijkingen(M.waardenVan(club({ trainingsmodule: true, seizoensplan: true, aiLimiet: 300 }), toegestaan), std), [], 'AI-limiet telt niet als AI uit staat');
gelijk(M.afwijkingen(M.waardenVan(club({ trainingsmodule: false, seizoensplan: true, aiLimiet: 100 }), toegestaan), std).map(x => [x.tekst, x.meer]), [['Training maken uit', false]]);
gelijk(M.afwijkingen(M.waardenVan(club({ trainingsmodule: true, seizoensplan: true, ai: true, aiLimiet: null, pdfOmzetten: true }), toegestaan), std).map(x => x.tekst), ['AI-functies aan', 'AI per maand onbeperkt'], 'PDF omzetten telt niet naast AI');

/* overnemen */
{
  const van = M.waardenVan(club({ trainingsmodule: true, seizoensplan: false, ai: true, aiLimiet: 50 }), toegestaan);
  const patch = M.patchNaar(van, std);
  gelijk(patch, { seizoensplan: true, ai: false, aiLimiet: 100 });
  gelijk(M.patchTekst(patch), 'Seizoensplanning aan, AI-functies uit, AI per maand 100');
  gelijk(M.patchNaar(std, std), {});
  gelijk(M.patchTekst({ aiLimiet: null }), 'AI per maand onbeperkt');
}

/* getallen uit de tabel */
gelijk(M.controleerGetal('aiLimiet', ''), { ok: true, waarde: null });
gelijk(M.controleerGetal('aiLimiet', '250'), { ok: true, waarde: 250 });
gelijk(M.controleerGetal('aiLimiet', '-1').ok, false);
gelijk(M.controleerGetal('maxVideoMB', '').ok, false, 'video mag niet leeg');
gelijk(M.controleerGetal('maxVideoMB', '4').ok, false);
gelijk(M.controleerGetal('maxVideoMB', '300'), { ok: true, waarde: 300 });
gelijk(M.controleerGetal('ai', '1').ok, false, 'een schakelaar is geen getal');

/* tabel */
{
  const clubs = [{ id: 'a', naam: 'FC Aaa', plaats: 'Adorp', fase: 'actief' }, { id: 'b', naam: 'SV Bbb', plaats: 'Bdorp', fase: 'proef' }, { id: 'x', naam: 'Zonder doc' }];
  const docs = { a: club({ trainingsmodule: true, seizoensplan: true, ai: true, aiLimiet: 100 }), b: { ...club({ trainingsmodule: true, seizoensplan: true, aiLimiet: 100 }), instellingen: { werkwijze: 'club' } } };
  const rijen = M.maatwerkRijen(clubs, docs, { toegestaan, standaard: STD });
  gelijk(rijen.map(r => [r.id, r.afwijkend, r.werkwijze]), [['a', true, 'vrij'], ['b', false, 'club'], ['x', true, 'vrij']]);
  gelijk(M.filterMaatwerk(rijen, { filter: 'afwijkend' }).map(r => r.id), ['a', 'x']);
  gelijk(M.filterMaatwerk(rijen, { filter: 'standaard' }).map(r => r.id), ['b']);
  gelijk(M.filterMaatwerk(rijen, { zoek: 'bdorp' }).map(r => r.id), ['b']);
  gelijk(M.filterMaatwerk(rijen, {}).length, 3);
  const tel = M.tellingPerOnderdeel(rijen);
  gelijk([tel.trainingsmodule, tel.ai, tel.scouting], [2, 1, 0]);
  gelijk(M.maatwerkRijen(null, null).length, 0);
}

/* overzicht per club */
{
  const kaal = M.maatwerkOverzicht(club({ trainingsmodule: true, seizoensplan: true, aiLimiet: 100 }), { toegestaan, standaard: STD });
  gelijk(kaal.eigen, 0, 'niets op maat');
  gelijk(kaal.regels.map(r => r.id), ['onderdelen', 'pdf', 'profiel', 'huisstijl', 'werkwijze']);
  ok(kaal.regels.every(r => r.titel && r.tekst && r.tab), 'elke regel heeft tekst en een tabblad');
  const vol = M.maatwerkOverzicht({ ...club({ trainingsmodule: true, seizoensplan: true, ai: true, aiLimiet: 300, teamkamer: true, teamkamerOpties: { polls: true, namen: true, live: false } }),
    instellingen: { werkwijze: 'club', identiteit: { kleur: '#1d4ed8', logo: 'icons/x.png' }, lijsten: { tags: [] }, toegang: { ondersteuning: false } }, eigenBouwen: [{ id: 'e', naam: 'Meiden' }] },
    { toegestaan, standaard: STD, pdfStandaard: false, eigenRolNamen: ['TC-lid (bouwcoördinator)'], profiel: { documenten: { d1: {}, d2: {} }, bevindingen: { b1: { gezet: { ms: 1 } }, b2: {} } } });
  gelijk(vol.regels.map(r => r.id), ['onderdelen', 'teamkamer', 'pdf', 'profiel', 'huisstijl', 'werkwijze', 'rolnamen', 'eigenbouwen', 'lijsten', 'ondersteuning']);
  gelijk(vol.eigen, 10);
  const r = id => vol.regels.find(x => x.id === id).tekst;
  gelijk(r('teamkamer'), '2 mogelijkheden aan');
  gelijk(r('profiel'), '2 documenten ingelezen · 1 onderwerp in Cluppie gezet');
  gelijk(r('huisstijl'), 'eigen logo · clubkleur #1d4ed8');
  ok(r('onderdelen').includes('AI-functies aan') && r('onderdelen').includes('Teamkamer aan'));
  gelijk(M.maatwerkOverzicht(undefined, {}).regels.length, 5, 'zonder club geen fout');
}

/* notities en wensen */
{
  gelijk(M.schoonMaatwerk(null), { notitie: '', wensen: [], contact: '' });
  let m = M.wensErbij(null, '  Scouting   aanzetten ', 1000, 'w1');
  gelijk(m.wensen, [{ id: 'w1', tekst: 'Scouting aanzetten', klaar: false, ms: 1000 }]);
  m = M.wensErbij(m, '', 2000, 'w2'); gelijk(m.wensen.length, 1, 'lege wens komt er niet bij');
  m = M.wensErbij({ ...m, notitie: 'x'.repeat(5000), contact: 'Anne' }, 'Eigen logo', 3000, 'w3');
  gelijk(m.notitie.length, M.NOTITIE_MAX); gelijk(m.contact, 'Anne');
  m = M.wensZet(m, 'w1', true);
  gelijk(M.wensenGesorteerd(m).map(w => w.id), ['w3', 'w1'], 'open wensen eerst');
  gelijk(M.wensWeg(m, 'w3').wensen.map(w => w.id), ['w1']);
  gelijk(M.schoonMaatwerk({ wensen: [{ id: '', tekst: 'x' }, { id: 'a', tekst: '' }, 'kapot', { id: 'b', tekst: 'y'.repeat(300) }] }).wensen.map(w => [w.id, w.tekst.length]), [['b', M.WENS_MAX]]);
  let veel = null; for (let i = 0; i < 50; i++) veel = M.wensErbij(veel, 'wens ' + i, i, 'w' + i);
  gelijk(veel.wensen.length, M.WENSEN_MAX); gelijk(veel.wensen.at(-1).id, 'w49', 'de nieuwste blijft');
}
console.log(`maatwerk: ${n} controles geslaagd`);
