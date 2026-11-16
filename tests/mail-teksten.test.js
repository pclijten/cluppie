// Teksten van alle mails (functions/mail-teksten.js, mail-beheer.js).  Draaien: node tests/mail-teksten.test.js
const fs = require('fs'), path = require('path');
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } }
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError };
  if (r === 'firebase-functions/v2/scheduler') return { onSchedule: (o, f) => f };
  if (r === 'firebase-functions/v2/firestore') return { onDocumentCreated: (o, f) => f };
  if (r === 'firebase-functions/params') return { defineString: (n, o) => ({ value: () => (o && o.default) || '' }), defineSecret: () => ({ value: () => 'geheim' }) };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue };
  return orig.call(this, r, ...a);
};
const T = require('../functions/mail-teksten.js');
const B = require('../functions/mail-beheer.js');
const M = require('../functions/mail.js');
const { maakMail } = require('../functions/mail-sjabloon.js');
const { store, db } = fake;
let n = 0;
const ok = (c, m) => { n++; if (!c){ console.log('FAIL ' + m); process.exitCode = 1; } };
const gelijk = (a, b, m) => ok(a.text === b.text && a.html === b.html, m + ' (tekst en html teken voor teken gelijk)');
const URL = 'https://www.cluppie.io/';

/* ---------- vulIn ---------- */
ok(T.vulIn('Hoi {naam},', { naam: 'Jan' }) === 'Hoi Jan,', 'invulveld wordt ingevuld');
ok(T.vulIn('Hoi[ {naam}],', { naam: '' }) === 'Hoi,' && T.vulIn('Hoi[ {naam}],', { naam: 'Jan' }) === 'Hoi Jan,', 'haken vallen weg bij een leeg veld');
ok(T.vulIn('a[ tot {x}][ bij {y}].', { x: 'O11', y: '' }) === 'a tot O11.', 'meer haken na elkaar, elk apart');
ok(T.vulIn('Zie [1] en {onbekend}', {}) === 'Zie [1] en {onbekend}', 'haken zonder veld en onbekende velden blijven staan');
ok(T.vulIn('{club}', { club: '{naam} [x {naam}]', naam: 'Jan' }) === '{naam} [x {naam}]', 'een ingevulde waarde wordt niet opnieuw ingevuld');
ok(T.alineas('a\n\n\n\nb\n \nc\nd').join('|') === 'a|b|c\nd', 'lege regel = nieuwe alinea, lege alinea weg');

/* ---------- zonder aanpassing is elke mail gelijk aan de tekst die vóór 20261116p in de functies stond ---------- */
const data = { clubNaam: 'RKVV Voorbeeld', plaats: 'Dorp', contactNaam: 'Jan Jansen', rol: 'voorzitter', contactEmail: 'jan@club.nl', aantalTeams: 14, bericht: 'Hallo' };
const gegevens = [['Club', data.clubNaam], ['Plaats', data.plaats], ['Contact', data.contactNaam], ['Rol', data.rol], ['E-mail', data.contactEmail], ['Aantal teams', data.aantalTeams || 'onbekend'], ['Sportlink', ''], ['Bericht', data.bericht]];
let nieuw = T.stelOp('nieuweAanmelding', { naam: data.contactNaam, rol: data.rol, club: data.clubNaam, plaats: data.plaats }, { vast: { knopUrl: URL, gegevens } });
gelijk(nieuw, maakMail({ voorkop: 'Nieuwe aanmelding', titel: `${data.clubNaam} wil met Cluppie starten`,
  alineas: [`${data.contactNaam} (${data.rol}) meldde ${data.clubNaam} uit ${data.plaats} aan.`], gegevens,
  knop: { tekst: 'Aanmelding bekijken', url: URL }, slot: ['Goedkeuren of afwijzen kan in het platformscherm.'] }), 'nieuwe aanmelding');
ok(nieuw.onderwerp === 'Cluppie: nieuwe club aangemeld — RKVV Voorbeeld', 'nieuwe aanmelding: onderwerp');
nieuw = T.stelOp('nieuweAanmelding', { naam: 'Jan', rol: '', club: 'RKVV', plaats: '' }, { vast: { knopUrl: URL } });
ok(nieuw.text.includes('Jan meldde RKVV aan.'), 'nieuwe aanmelding zonder rol en plaats: geen lege haakjes');

for (const meegenomen of [[], ['O11-1'], ['O11-1', 'O9-2']]){
  const eigenTeams = meegenomen.length ? `Je eigen ${meegenomen.length === 1 ? 'team' : 'teams'} (${meegenomen.join(', ')}) ${meegenomen.length === 1 ? 'staat' : 'staan'} nu ook bij de club, met alle spelers en wedstrijden.` : '';
  nieuw = T.stelOp('welkomClub', { naam: 'Jan', club: 'RKVV Voorbeeld', eigenTeams }, { vast: { knopUrl: URL } });
  gelijk(nieuw, maakMail({ voorkop: 'Welkom', titel: 'RKVV Voorbeeld staat klaar',
    alineas: ['Hoi Jan,', 'Goed nieuws: RKVV Voorbeeld staat klaar in Cluppie en jij bent clubbeheerder.', ...(eigenTeams ? [eigenTeams] : []),
      'Log in met hetzelfde account waarmee je je aanmeldde. Op de clubpagina vind je "Aan de slag": zeven korte stappen om de club in te richten. Meestal ben je in een kwartier klaar.'],
    stappen: ['Logo en clubkleur', 'Sportlink koppelen', 'Teams aanmaken', 'Trainingsdagen invullen', 'Eerste coach uitnodigen', 'Privacycontact invullen', 'Verwerkersovereenkomst'],
    knop: { tekst: 'Naar Cluppie', url: URL }, slot: ['Loop je ergens op vast? Antwoord gerust op deze mail.', 'Veel plezier!\nCluppie'] }), `welkom met ${meegenomen.length} eigen teams`);
  ok(nieuw.onderwerp === 'Welkom bij Cluppie, RKVV Voorbeeld!', 'welkom: onderwerp');
}
for (const reden of ['', 'Nog even geduld.']){
  nieuw = T.stelOp('afwijzing', { naam: 'Jan', club: 'RKVV', reden });
  gelijk(nieuw, maakMail({ voorkop: 'Je aanmelding', titel: 'Bedankt voor je aanmelding',
    alineas: ['Hoi Jan,', 'Bedankt voor je aanmelding van RKVV. We kunnen de club op dit moment nog niet toelaten tot Cluppie.', ...(reden ? [reden] : [])],
    slot: ['Vragen? Antwoord gerust op deze mail.', 'Groet,\nCluppie'] }), `afwijzing ${reden ? 'met' : 'zonder'} reden`);
  ok(!/<a href[^>]*>\s*<\/a>/.test(nieuw.html) && !/border-radius:10px;">\s*<a/.test(nieuw.html), 'afwijzing heeft geen knop');
}
nieuw = T.stelOp('coachAanvraag', { coach: 'Piet', team: 'O11-2', club: 'RKVV' }, { vast: { knopUrl: URL } });
gelijk(nieuw, maakMail({ voorkop: 'Nieuwe aanvraag', titel: 'Piet wil aansluiten', alineas: ['Piet vroeg toegang tot O11-2 bij RKVV.'],
  knop: { tekst: 'Aanvraag beoordelen', url: URL }, slot: ['Je vindt de aanvraag onder Club → Instellingen → Toegang & privacy.'],
  voet: 'Je krijgt hooguit één zo\'n mail per dag; nieuwe aanvragen van vandaag staan er ook.' }), 'coach wil aansluiten');
ok(nieuw.onderwerp === 'Cluppie: Piet wil aansluiten bij RKVV', 'coach wil aansluiten: onderwerp');
ok(T.stelOp('coachAanvraag', { coach: 'Piet', team: '', club: 'RKVV' }, { vast: { knopUrl: URL } }).text.includes('Piet vroeg toegang bij RKVV.'), 'coach zonder team: geen "tot"');

const LINK = 'https://cluppie-ad329.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=X[1]{naam}&lang=nl';
const vastLink = { knopUrl: LINK, slotVooraf: ['Werkt de knop niet? Kopieer dan deze link in je browser:\n' + LINK] };
for (const naam of ['Jan', '']){
  gelijk(T.stelOp('bevestig', { naam }, { vast: vastLink }), maakMail({ voorkop: 'Bevestigen', titel: 'Bevestig je e-mailadres',
    alineas: [naam ? `Hoi ${naam},` : 'Hoi,', 'Welkom bij Cluppie! Bevestig je e-mailadres met de knop hieronder. Dat is nodig om je aan te sluiten bij een team of club.'],
    knop: { tekst: 'E-mailadres bevestigen', url: LINK },
    slot: ['Werkt de knop niet? Kopieer dan deze link in je browser:\n' + LINK, 'Heb je je niet aangemeld bij Cluppie? Dan kun je deze mail negeren.'],
    voet: 'Deze link werkt één keer.' }), `bevestigen ${naam ? 'met' : 'zonder'} naam`);
  gelijk(T.stelOp('wachtwoord', { naam }, { vast: vastLink }), maakMail({ voorkop: 'Wachtwoord', titel: 'Kies een nieuw wachtwoord',
    alineas: [naam ? `Hoi ${naam},` : 'Hoi,', 'Je vroeg om een nieuw wachtwoord voor Cluppie. Klik op de knop hieronder en kies een nieuw wachtwoord. Daarna kun je meteen weer inloggen.'],
    knop: { tekst: 'Nieuw wachtwoord kiezen', url: LINK },
    slot: ['Werkt de knop niet? Kopieer dan deze link in je browser:\n' + LINK, 'Heb je dit niet aangevraagd? Dan hoef je niets te doen: je wachtwoord blijft zoals het was.'],
    voet: 'Deze link werkt één keer en maar een beperkte tijd.' }), `wachtwoord ${naam ? 'met' : 'zonder'} naam`);
}
ok(T.stelOp('bevestig', { naam: 'Jan' }, { vast: vastLink }).onderwerp === 'Bevestig je e-mailadres voor Cluppie' && T.stelOp('wachtwoord', {}, { vast: vastLink }).onderwerp === 'Kies een nieuw wachtwoord voor Cluppie', 'inlogmails: onderwerp');
gelijk(T.stelOp('teamkamer', { team: 'O11-2' }, { vast: { knopUrl: URL } }), maakMail({ titel: 'Je kunt de teamkamer in',
  alineas: ['De trainer van O11-2 heeft je aanvraag goedgekeurd. Je ziet nu de agenda, wie erbij is, mededelingen en polls.',
    'Afmelden blijft via de groepsapp gaan. In de teamkamer staat een knop die het bericht voor je klaarzet.'],
  knop: { tekst: 'Open de teamkamer', url: URL } }), 'teamkamer');

/* ---------- elke soort is compleet ---------- */
for (const id of T.VOLGORDE){
  const S = T.SOORTEN[id];
  ok(S.groep && S.naam && S.aan && S.wanneer && S.voorbeeld, `${id}: beschrijving compleet`);
  ok(!T.controleer(id, S.std).fout, `${id}: de standaardtekst komt door de eigen controle`);
  ok(Object.keys(S.voorbeeld).every(k => S.velden[k]) && Object.keys(S.velden).every(k => k in S.voorbeeld), `${id}: voorbeeld heeft precies de invulvelden`);
  const m = T.stelOp(id, S.voorbeeld, { vast: { knopUrl: URL, ...(S.voorbeeldVast || {}) } });
  ok(!/\{[a-zA-Z]+\}/.test(m.text + m.onderwerp), `${id}: geen oningevuld veld in het voorbeeld`);
  ok(!S.magEerstTonen || S.kanUit, `${id}: eerst tonen alleen bij een mail die je zelf verstuurt`);
}
ok(!T.SOORTEN.bevestig.kanUit && !T.SOORTEN.wachtwoord.kanUit, 'inlogmails kunnen niet uit');
ok(M.WIS_INHOUD.join() === 'bevestig,wachtwoord', 'alleen van inlogmails wordt de inhoud gewist');

/* ---------- controle van aangepaste tekst ---------- */
ok(/\{team\}/.test(T.controleer('welkomClub', { tekst: 'Hoi {team}' }).fout), 'onbekend invulveld geweigerd');
ok(/leeg/.test(T.controleer('welkomClub', { titel: '  ' }).fout), 'lege kop geweigerd');
ok(/knop/.test(T.controleer('welkomClub', { knop: '' }).fout), 'lege knoptekst geweigerd als de mail een knop heeft');
ok(T.controleer('afwijzing', { knop: 'Klik' }).tekst.knop === '', 'mail zonder knop krijgt er geen');
ok(/te lang/.test(T.controleer('welkomClub', { onderwerp: 'x'.repeat(151) }).fout), 'te lang onderwerp geweigerd');
ok(T.controleer('welkomClub', { onderwerp: 'Hoi\nBcc: boef@evil.nl' }).tekst.onderwerp === 'Hoi Bcc: boef@evil.nl', 'regeleinde in onderwerp wordt een spatie');
ok(!!T.controleer('bestaatniet', {}).fout, 'onbekende soort geweigerd');
const boos = T.stelOp('welkomClub', { naam: '<script>alert(1)</script>', club: '"><img src=x>', eigenTeams: '' }, { vast: { knopUrl: 'javascript:alert(1)' }, eenmalig: { tekst: 'Hoi {naam} <b>vet</b>' } });
ok(!/<script>alert|<img src=x|<b>vet/.test(boos.html) && !/href="javascript:/.test(boos.html), 'html in tekst of invulwaarde wordt ge-escaped, link blijft veilig');

/* ---------- bewaren, uitzetten, herstellen, versturen ---------- */
const mails = () => [...store.keys()].filter(k => k.startsWith('mail/')).map(k => store.get(k));
(async () => {
  store.clear(); T.vergeetInstellingen();
  ok(await T.verstuur(db, 'welkomClub', 'jan@club.nl', { naam: 'Jan', club: 'RKVV', eigenTeams: '' }, { vast: { knopUrl: URL } }) === 'gemaakt', 'zonder instellingen: verstuurd');
  ok(mails()[0].soort === 'welkomClub' && mails()[0].message.subject === 'Welkom bij Cluppie, RKVV!' && !('vanNaam' in mails()[0]), 'document heeft soort en standaardonderwerp, geen afzendernaam');
  ok(await T.verstuur(db, 'welkomClub', '', {}) === 'geen-ontvanger' && await T.verstuur(db, 'welkomClub', [], {}) === 'geen-ontvanger', 'zonder ontvanger gebeurt er niets');

  await B.bewaar(db, { soort: 'welkomClub', tekst: { ...T.SOORTEN.welkomClub.std, titel: 'Welkom {naam}', slot: 'Tot snel,\nPaul' } }, 'uidPaul');
  let opgeslagen = store.get(T.DOC).mails.welkomClub;
  ok(opgeslagen.titel === 'Welkom {naam}' && opgeslagen.slot === 'Tot snel,\nPaul' && !('tekst' in opgeslagen) && !('onderwerp' in opgeslagen), 'alleen wat afwijkt van de standaard wordt bewaard');
  store.clear = store.clear; const voor = mails().length;
  await T.verstuur(db, 'welkomClub', 'jan@club.nl', { naam: 'Jan', club: 'RKVV', eigenTeams: '' }, { vast: { knopUrl: URL } });
  let laatste = mails()[voor];
  ok(/Welkom Jan/.test(laatste.message.html) && /Tot snel,<br>Paul/.test(laatste.message.html) && /Goed nieuws: RKVV/.test(laatste.message.text), 'aangepaste tekst gaat mee, de rest blijft standaard');

  let f = null; try { await B.bewaar(db, { soort: 'welkomClub', tekst: { tekst: 'Hoi {team}' } }, 'u'); } catch (e){ f = e; }
  ok(f && f.code === 'invalid-argument', 'bewaren met onbekend invulveld geweigerd');
  f = null; try { await B.bewaar(db, { soort: 'bevestig', uit: true }, 'u'); } catch (e){ f = e; }
  ok(f && f.code === 'invalid-argument', 'een inlogmail uitzetten geweigerd');
  f = null; try { await B.bewaar(db, { soort: 'coachAanvraag', eerstTonen: true }, 'u'); } catch (e){ f = e; }
  ok(f && f.code === 'invalid-argument', 'eerst tonen alleen bij goedkeuren en afwijzen');

  await B.bewaar(db, { soort: 'welkomClub', uit: true }, 'u');
  ok(await T.verstuur(db, 'welkomClub', 'jan@club.nl', { naam: 'Jan', club: 'RKVV', eigenTeams: '' }) === 'uit', 'uitgezette mail wordt niet verstuurd');
  ok(store.get(T.DOC).mails.welkomClub.titel === 'Welkom {naam}', 'uitzetten laat de tekst staan');
  const n0 = mails().length;
  await B.proef(db, { soort: 'welkomClub', tekst: { ...T.SOORTEN.welkomClub.std, titel: 'Concept' } }, 'paul@cluppie.io');
  laatste = mails()[n0];
  ok(laatste && laatste.to === 'paul@cluppie.io' && laatste.soort === 'proef' && laatste.proefVan === 'welkomClub' && /^\[Proef\] /.test(laatste.message.subject) && /Concept/.test(laatste.message.html), 'proef gaat naar het eigen adres, ook van een uitgezette mail, met de tekst die nog niet is bewaard');
  f = null; try { await B.proef(db, { soort: 'welkomClub' }, ''); } catch (e){ f = e; }
  ok(f && f.code === 'invalid-argument', 'proef zonder eigen adres geweigerd');

  await B.bewaar(db, { soort: 'welkomClub', uit: false }, 'u');
  await B.bewaar(db, { soort: 'afwijzing', eerstTonen: true }, 'u');
  await B.bewaar(db, { algemeen: { afzender: 'Paul van Cluppie', merkregel: 'Cluppie · samen maken we het mooi' } }, 'u');
  let o = await B.overzicht(db);
  const w = o.soorten.find(s => s.id === 'welkomClub'), af = o.soorten.find(s => s.id === 'afwijzing');
  ok(o.soorten.length === T.VOLGORDE.length && w.aangepast && !w.uit && w.eerstTonen && af.eerstTonen && !af.aangepast, 'overzicht: aangepast, aan/uit en eerst tonen per soort');
  ok(w.aantal >= 2 && o.verzonden.length >= 3 && o.verzonden.every(v => !/jan@club\.nl/.test(v.naar)), 'overzicht telt per soort en toont geen volledig adres');
  ok(o.algemeen.afzender === 'Paul van Cluppie', 'overzicht: algemene instellingen');
  const n1 = mails().length;
  await T.verstuur(db, 'afwijzing', 'jan@club.nl', { naam: 'Jan', club: 'RKVV', reden: '' });
  laatste = mails()[n1];
  ok(laatste.vanNaam === 'Paul van Cluppie' && /samen maken we het mooi/.test(laatste.message.html) && /— Cluppie · samen maken we het mooi · www\.cluppie\.io/.test(laatste.message.text), 'afzendernaam en regel onderaan gaan mee');
  ok(M.maakBericht(laatste, 'Cluppie <paul@cluppie.io>').bericht.from === 'Paul van Cluppie <paul@cluppie.io>', 'afzender: eigen naam, vast adres');
  ok(M.maakBericht({ ...laatste, vanNaam: 'Boef <boef@evil.nl>' }, 'Cluppie <paul@cluppie.io>').bericht.from === 'Boef boef evil.nl <paul@cluppie.io>', 'een adres in de afzendernaam komt er niet door');
  f = null; try { await B.bewaar(db, { algemeen: { afzender: ' ', merkregel: 'x' } }, 'u'); } catch (e){ f = e; }
  ok(f && f.code === 'invalid-argument', 'lege afzendernaam geweigerd');

  await B.bewaar(db, { soort: 'welkomClub', herstel: true }, 'u');
  o = await B.overzicht(db);
  ok(!o.soorten.find(s => s.id === 'welkomClub').aangepast && !store.get(T.DOC).mails.welkomClub, 'terug naar standaard wist de eigen tekst');

  /* inhoud van inlogmails wissen na het versturen; andere mails houden hun tekst */
  store.clear(); T.vergeetInstellingen();
  await T.verstuur(db, 'wachtwoord', 'jan@club.nl', { naam: 'Jan' }, { vast: vastLink });
  await T.verstuur(db, 'teamkamer', 'ouder@club.nl', { team: 'O11-2' }, { vast: { knopUrl: URL } });
  const sleutels = [...store.keys()].filter(k => k.startsWith('mail/'));
  const verzonden = [];
  for (const k of sleutels) await M.verwerk({ ref: db.doc(k), data: () => store.get(k) }, { transporterFn: () => ({ sendMail: async b => { verzonden.push(b); return { messageId: 'x', accepted: [1] }; } }), van: () => 'Cluppie <paul@cluppie.io>' });
  const ww = sleutels.map(k => store.get(k)).find(d => d.soort === 'wachtwoord'), tk = sleutels.map(k => store.get(k)).find(d => d.soort === 'teamkamer');
  ok(verzonden.length === 2 && verzonden.some(b => b.text.includes('oobCode')), 'beide verstuurd, de link zat in de mail zelf');
  ok(ww.delivery.state === 'SUCCESS' && !('text' in ww.message) && !('html' in ww.message) && ww.message.subject, 'wachtwoordmail: link uit het document gewist, onderwerp blijft');
  ok(tk.message.text && tk.message.html, 'andere mail houdt zijn tekst');

  /* opruimen na 30 dagen */
  store.clear();
  const nu = new Date('2026-12-20T04:20:00Z'), dag = 86400000;
  for (let i = 0; i < 5; i++) store.set(`mail/oud${i}`, { to: 'a@b.nl', gemaakt: new Date(nu.getTime() - 31 * dag - i) });
  store.set('mail/vers', { to: 'a@b.nl', gemaakt: new Date(nu.getTime() - 29 * dag) });
  ok(await B.ruimOp(db, nu) === 5 && store.has('mail/vers') && !store.has('mail/oud0'), 'mails ouder dan 30 dagen weg, jongere blijven');
  ok(B.kortAdres('sanne@voorbeeld.nl') === 's•••@voorbeeld.nl' && B.kortAdres(['a@b.nl', 'c@d.nl']) === '2 ontvangers', 'adres afgekort');

  /* callables: alleen de platformbeheerder */
  const F = B.maakFuncties({ isPlatformBeheerder: async r => !!(r.auth && r.auth.uid === 'paul') });
  f = null; try { await F.leesMailteksten({ auth: { uid: 'coach', token: {} } }); } catch (e){ f = e; }
  ok(f && f.code === 'permission-denied', 'een coach mag de teksten niet lezen');
  f = null; try { await F.zetMailtekst({ auth: { uid: 'coach', token: {} }, data: { soort: 'welkomClub', uit: true } }); } catch (e){ f = e; }
  ok(f && f.code === 'permission-denied', 'een coach mag de teksten niet wijzigen');
  f = null; try { await F.stuurProefmail({ auth: null, data: { soort: 'welkomClub' } }); } catch (e){ f = e; }
  ok(f && f.code === 'permission-denied', 'zonder inloggen geen proefmail');
  ok((await F.leesMailteksten({ auth: { uid: 'paul', token: { email: 'paul@cluppie.io' } } })).soorten.length === 7, 'de platformbeheerder leest alle zeven');
  f = null; try { await F.zetMailtekst({ auth: { uid: 'paul', token: {} }, data: { soort: 'welkomClub', tekst: { tekst: '{x}' } } }); } catch (e){ f = e; }
  ok(f && f.code === 'invalid-argument' && /\{x\}/.test(f.message), 'foutmelding van de controle komt bij het scherm aan');

  /* ---------- het scherm rekent hetzelfde als de server (public/js/platform-mails-logica.js) ---------- */
  const L = await import('../public/js/platform-mails-logica.js');
  const proeven = [['Hoi[ {naam}],', { naam: '' }], ['Hoi[ {naam}],', { naam: 'Jan' }], ['a[ tot {x}][ bij {y}].', { x: 'O11', y: '' }], ['Zie [1] en {onbekend}', {}],
    ['{club}', { club: '{naam} [x {naam}]', naam: 'Jan' }], ['[{a}{b}]', { a: 'x' }], ['{a}\n\n[{b}]\n\n{a}', { a: '1', b: ' ' }]];
  ok(proeven.every(([t, w]) => L.vulIn(t, w) === T.vulIn(t, w)), 'vulIn: scherm en server geven hetzelfde');
  ok(['a\n\n\n\nb\n \nc\nd', '', ' x '].every(t => L.alineas(t).join('|') === T.alineas(t).join('|')), 'alineas: scherm en server geven hetzelfde');
  ok(L.TEKSTVELDEN.join() === T.TEKSTVELDEN.join() && JSON.stringify(L.VELDNAAM) === JSON.stringify(T.VELDNAAM), 'zelfde velden en veldnamen');
  const scherm = (await B.overzicht(db, new Date(), { licht: true })).soorten;
  for (const s of scherm){
    ok(L.controleer(s, s.std, T.MAX) === '', `${s.id}: het scherm keurt de standaardtekst goed`);
    const v = L.voorbeeldVan(s, s.tekst, T.ALGEMEEN_STD), m = T.stelOp(s.id, T.SOORTEN[s.id].voorbeeld, { vast: { knopUrl: URL, ...(T.SOORTEN[s.id].voorbeeldVast || {}) } });
    ok(v.onderwerp === m.onderwerp && [v.titel, ...v.alineas, ...v.slot].every(x => m.text.includes(x)) && (!v.knop || m.text.includes(v.knop + ': ')), `${s.id}: het voorbeeld toont wat de server verstuurt`);
  }
  const fouten = [{ tekst: 'Hoi {team}' }, { titel: ' ' }, { knop: '' }, { onderwerp: 'x'.repeat(151) }];
  ok(fouten.every(f => { const t = { ...T.SOORTEN.welkomClub.std, ...f }; return !!L.controleer(scherm.find(s => s.id === 'welkomClub'), t, T.MAX) === !!T.controleer('welkomClub', t).fout; }), 'het scherm weigert wat de server weigert');
  const deels = L.voorAanmelding(scherm.find(s => s.id === 'welkomClub'), { naam: 'Jan', club: 'RKVV' });
  ok(deels.titel === 'RKVV staat klaar' && deels.tekst.includes('Hoi Jan,') && deels.tekst.includes('[{eigenTeams}]'), 'eerst laten zien: bekende velden ingevuld, de rest blijft staan');
  ok(!T.controleer('welkomClub', deels).fout && T.stelOp('welkomClub', { naam: 'Jan', club: 'RKVV', eigenTeams: '' }, { eenmalig: deels, vast: { knopUrl: URL } }).text.includes('Hoi Jan,'), 'die tekst komt door de controle van de server');
  const nuMs = new Date(2026, 10, 16, 13, 0).getTime();
  ok(L.tijdTekst(nuMs - 3600000, nuMs) === 'vandaag 12:00' && L.tijdTekst(nuMs - 20 * 3600000, nuMs) === 'gisteren 17:00' && L.tijdTekst(new Date(2026, 10, 3, 8, 5).getTime(), nuMs) === '3 nov 08:05' && L.tijdTekst(0) === '', 'tijd in gewone woorden');
  ok(L.statusVan({ uit: true, tekst: {} }) === 'Uit' && L.statusVan({ aangepast: true, tekst: { titel: 'a' } }, { titel: 'b' }) === 'Niet bewaard' && L.statusVan({ aangepast: true, tekst: {} }) === 'Aangepast' && L.statusVan({ tekst: {} }) === 'Standaard', 'status in de lijst');

  /* ---------- bewaker: geen mail buiten mail-teksten.js om ---------- */
  const map = path.join(__dirname, '..', 'functions');
  for (const b of fs.readdirSync(map).filter(x => x.endsWith('.js'))){
    if (b === 'mail-teksten.js' || b === 'mail-sjabloon.js') continue;
    const bron = fs.readFileSync(path.join(map, b), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    ok(!/collection\(\s*['"`]mail['"`]\s*\)\s*\.\s*(add|doc)\b/.test(bron) && !/\.doc\(\s*[`'"]mail\//.test(bron), `${b}: maakt niet zelf een mail aan (gebruik verstuur() uit mail-teksten.js)`);
    ok(!/\bmaakMail\s*\(/.test(bron), `${b}: stelt niet zelf een mail op (voeg een soort toe aan mail-teksten.js)`);
  }
  console.log(process.exitCode ? 'mail-teksten: FOUTEN' : `mail-teksten: ${n} controles geslaagd`);
})();
