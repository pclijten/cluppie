// Rollen in de club: wie doet wat, en het vervolg op "Aan de slag". Draaien: node tests/rollen-bezetting.test.mjs
import assert from 'node:assert/strict';
const R = await import('../public/js/rollen-bezetting.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const team = (naam, leden = {}, extra = {}) => ({ id: naam, naam, categorie: (naam.startsWith('M') ? 'MO' : 'JO') + naam.replace(/\D+(\d+).*/, '$1'), leden, ledenInfo: {}, ...extra });
const club = o => ({ admins: { a1: true }, adminsInfo: { a1: { naam: 'Anne' } }, ...o });

/* bouw van een team: opgeslagen veld gaat voor, anders de categorie */
gelijk(R.bouwVanTeamKaal(team('O9-1')), 'onder');
gelijk(R.bouwVanTeamKaal(team('O11-1')), 'onder', 'O11 hoort standaard bij de onderbouw (t/m 11)');
gelijk(R.bouwVanTeamKaal(team('O13-1')), 'midden');
gelijk(R.bouwVanTeamKaal(team('MO17-1')), 'boven');
gelijk(R.bouwVanTeamKaal(team('O13-1', {}, { bouw: 'boven' })), 'boven', 'handmatig ingedeeld');
gelijk(R.bouwVanTeamKaal(team('O10-1'), { onderTm: 9, middenTm: 13 }), 'midden', 'eigen grenzen van de club');
gelijk(R.bouwVanTeamKaal({ naam: 'Senioren 1' }), 'boven', 'zonder leeftijd: bovenbouw');

/* lege club: alleen de beheerder is bezet; zonder teams zijn er geen bouwrollen */
{
  const b = R.rolBezetting(club({}), []);
  gelijk(b.rollen.map(r => r.id), ['admin', 'hoofdJeugd', 'trainco', 'coach']);
  gelijk(b.open, ['hoofdJeugd', 'coach']);
  gelijk([b.bezet, b.totaal, b.klaar], [1, 3, false], 'trainingscoördinator telt niet mee');
  ok(b.rollen[0].advies.includes('tweede'), 'één beheerder: advies');
  gelijk(b.rollen.find(r => r.id === 'coach').stand, 'Nog geen teams');
}
/* club met teams in twee bouwen */
{
  const teams = [team('O9-1', { c1: true }), team('O10-1', { c2: true }), team('O13-1', {}), team('O13-2', { c1: true, c3: false })];
  const c = club({ admins: { a1: true, a2: true }, adminsInfo: { a1: { naam: 'Anne' }, a2: { naam: 'Bram' } },
    hoofdJeugd: { h1: true }, hoofdJeugdInfo: { h1: { naam: 'Carla' } },
    bouwCoordinatoren: { onder: { b1: true }, midden: {}, boven: {} }, bouwCoordinatorenInfo: { b1: { naam: 'Daan' } } });
  const b = R.rolBezetting(c, teams, { wachtend: 2 });
  gelijk(b.rollen.map(r => r.id), ['admin', 'hoofdJeugd', 'bouw:onder', 'bouw:midden', 'trainco', 'coach'], 'bovenbouw zonder teams doet niet mee');
  gelijk(b.rollen[0].mensen, ['Anne', 'Bram']); gelijk(b.rollen[0].advies, '');
  gelijk(b.rollen.find(r => r.id === 'bouw:onder').stand, 'Daan');
  gelijk(b.rollen.find(r => r.id === 'bouw:onder').teams, 2);
  gelijk(b.rollen.find(r => r.id === 'bouw:midden').bezet, false);
  const co = b.rollen.find(r => r.id === 'coach');
  gelijk([co.aantal, co.teamsMet, co.teamsZonder, co.wachtend, co.bezet], [2, 3, ['O13-1'], 2, false], 'een lid met false telt niet als coach');
  gelijk(co.stand, '3 van 4 teams hebben een coach');
  gelijk(b.open, ['bouw:midden', 'coach']);
  gelijk([b.bezet, b.totaal], [3, 5]);
  gelijk(R.bezettingRegel(b), '3 van 5 rollen bezet · nog open: bouwcoördinator middenbouw, coaches');
}
/* alles bezet, eigen rolnamen, eigen bouw, info per bouw (oude vorm), trainingscoördinator */
{
  const teams = [team('O9-1', { c1: true }), team('O13-1', { c2: true })];
  const c = club({ hoofdJeugd: { h1: true }, hoofdJeugdInfo: { h1: { naam: 'Carla' } },
    bouwCoordinatoren: { onder: { b1: true }, midden: { b2: true } }, bouwCoordinatorenInfo: { onder: { b1: { naam: 'Daan' } }, b2: { naam: 'Eva' } },
    trainingscoordinatoren: { t1: true }, trainingscoordinatorenInfo: { t1: { naam: 'Gijs' } },
    eigenBouwen: [{ id: 'eb1', naam: 'Meiden', teams: ['O13-1'], coaches: { e1: true } }], eigenBouwCoachesInfo: { e1: { naam: 'Hanna' } } });
  const b = R.rolBezetting(c, teams, { rolNamen: { coordinator: 'TC-lid', hoofdJeugd: 'Hoofd opleidingen', trainco: '', coach: 'Trainer' } });
  ok(b.klaar, 'alles bezet'); gelijk(R.bezettingRegel(b), 'Alle 5 rollen bezet');
  gelijk(b.rollen.map(r => r.naam), ['Clubbeheerder', 'Hoofd opleidingen', 'TC-lid onderbouw', 'TC-lid middenbouw', 'Coach bij Meiden', 'Trainingscoördinator', 'Trainers']);
  gelijk(b.rollen.find(r => r.id === 'bouw:onder').mensen, ['Daan'], 'info per bouw wordt ook gelezen');
  gelijk(b.rollen.find(r => r.id === 'eigen:eb1').mensen, ['Hanna']);
  gelijk(b.rollen.find(r => r.id === 'trainco').stand, 'Gijs');
  for (const r of b.rollen){ ok(r.doet && r.ziet, r.id + ': uitleg aanwezig'); }
}
/* een eigen functie voor de bouw (zoals bouw-indeling.js) wordt gebruikt */
{
  const b = R.rolBezetting(club({}), [team('O9-1', { c: true })], { bouwVan: () => 'boven' });
  ok(b.rollen.some(r => r.id === 'bouw:boven') && !b.rollen.some(r => r.id === 'bouw:onder'));
}
/* rol zonder naam in de info: aantal in plaats van namen */
gelijk(R.rolBezetting({ admins: { a: true, b: true } }, []).rollen[0].stand, '2 personen');
gelijk(R.bezettingRegel(null), '');

/* vervolg op Aan de slag */
{
  const leeg = R.vervolgStatus(club({}), [team('O9-1')]);
  gelijk(leeg.stappen.map(s => s.id), ['werkwijze', 'hoofdJeugd', 'bouwen', 'coaches', 'speelwijze']);
  gelijk([leeg.gedaan, leeg.totaal, leeg.compleet], [0, 5, false]);
  const vol = R.vervolgStatus(club({ instellingen: { werkwijze: 'vrij' }, hoofdJeugd: { h: true }, bouwCoordinatoren: { onder: { b: true } } }), [team('O9-1', { c: true })], { speelwijzeVast: true });
  ok(vol.compleet, 'alles gedaan');
  const half = R.vervolgStatus(club({ instellingen: { werkwijze: 'club' }, bouwCoordinatoren: { onder: { b: true } } }), [team('O9-1', { c: true }), team('O13-1', { c: true })]);
  gelijk(half.stappen.filter(s => s.klaar).map(s => s.id), ['werkwijze', 'coaches'], 'één bouw zonder coördinator: stap nog open');
  for (const s of R.VERVOLG_STAPPEN) ok(s.titel && s.uitleg && s.actie, s.id);
}
console.log(`rollen-bezetting: ${n} controles geslaagd`);
