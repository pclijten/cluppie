// Uitgaande e-mail (functions/mail.js).  Draaien: node tests/mail.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/firestore') return { onDocumentCreated: (o, f) => f };
  if (r === 'firebase-functions/params') return { defineString: (n, o) => ({ value: () => (o && o.default) || '' }), defineSecret: () => ({ value: () => 'geheim' }) };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue };
  return orig.call(this, r, ...a);
};
const M = require('../functions/mail.js');
const { store } = fake;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const VAN = 'Cluppie <paul@cluppie.io>';

(async () => {
  /* maakBericht (puur) */
  let r = M.maakBericht({ to: 'Beheer@Club.NL', message: { subject: 'Hoi', text: 'Tekst' } }, VAN);
  ok(r.bericht && r.bericht.to.length === 1 && r.bericht.to[0] === 'beheer@club.nl', 'enkel adres wordt klein gemaakt');
  ok(r.bericht.from === VAN, 'afzender komt uit de instelling');
  r = M.maakBericht({ to: ['a@b.nl', 'A@B.nl', 'c@d.nl'], message: { subject: 's', text: 't' } }, VAN);
  ok(r.bericht.to.length === 2, 'dubbele adressen verdwijnen');
  r = M.maakBericht({ to: 'a@b.nl', from: 'boef@evil.nl', message: { subject: 's', text: 't' } }, VAN);
  ok(r.bericht.from === VAN, 'from in het document wordt genegeerd');
  r = M.maakBericht({ to: 'a@b.nl', message: { subject: 'Onderwerp\r\nBcc: boef@evil.nl', text: 't' } }, VAN);
  ok(r.bericht && !/[\r\n]/.test(r.bericht.subject), 'regeleinden in onderwerp weg (geen header-injectie)');
  ok(!!M.maakBericht({ to: 'geen-adres', message: { subject: 's', text: 't' } }, VAN).fout, 'ongeldig adres geweigerd');
  ok(!!M.maakBericht({ to: 'a@b.nl, c@d.nl', message: { subject: 's', text: 't' } }, VAN).fout, 'komma-lijst in één veld geweigerd');
  ok(!!M.maakBericht({ to: [], message: { subject: 's', text: 't' } }, VAN).fout, 'geen ontvanger geweigerd');
  ok(!!M.maakBericht({ to: Array.from({ length: 11 }, (_, i) => `u${i}@b.nl`), message: { subject: 's', text: 't' } }, VAN).fout, 'meer dan 10 ontvangers geweigerd');
  ok(!!M.maakBericht({ to: 'a@b.nl', message: { text: 't' } }, VAN).fout, 'geen onderwerp geweigerd');
  ok(!!M.maakBericht({ to: 'a@b.nl', message: { subject: 's', text: '  ' } }, VAN).fout, 'lege tekst geweigerd');
  ok(M.maakBericht({ to: 'a@b.nl', message: { subject: 's', text: 'x'.repeat(30000) } }, VAN).bericht.text.length === 20000, 'tekst afgekapt op 20.000 tekens');
  ok(!!M.maakBericht(null, VAN).fout, 'leeg document geweigerd');

  /* html-versie (20261020c) */
  r = M.maakBericht({ to: 'a@b.nl', message: { subject: 's', text: 't', html: '<p>Hoi</p>' } }, VAN);
  ok(r.bericht.html === '<p>Hoi</p>' && r.bericht.text === 't', 'html wordt meegestuurd naast de tekst');
  r = M.maakBericht({ to: 'a@b.nl', message: { subject: 's', text: 't' } }, VAN);
  ok(!('html' in r.bericht), 'zonder html blijft het een tekstmail');
  r = M.maakBericht({ to: 'a@b.nl', message: { subject: 's', text: 't', html: 'x'.repeat(150000) } }, VAN);
  ok(r.bericht.html.length === 100000, 'html afgekapt op 100.000 tekens');
  ok(!!M.maakBericht({ to: 'a@b.nl', message: { subject: 's', html: '<p>Hoi</p>' } }, VAN).fout, 'html zonder tekstversie geweigerd');

  /* verwerk (met nep-transporter) */
  const verstuurd = [];
  const goed = () => ({ sendMail: async b => { verstuurd.push(b); return { messageId: '<id1>', accepted: b.to, rejected: [] }; } });
  const kapot = () => ({ sendMail: async () => { throw new Error('535 Authentication failed'); } });
  const snapVan = pad => ({ ref: fake.db.doc(pad), data: () => store.get(pad) });
  const opties = t => ({ transporterFn: t, van: () => VAN });

  store.clear();
  store.set('mail/m1', { to: ['x@y.nl'], message: { subject: 'Welkom', text: 'Hoi' } });
  let res = await M.verwerk(snapVan('mail/m1'), opties(goed));
  ok(res === 'verstuurd' && verstuurd.length === 1, 'geldig document wordt verstuurd');
  ok(store.get('mail/m1').delivery.state === 'SUCCESS', 'delivery.state = SUCCESS');
  ok(store.get('mail/m1').delivery.info.messageId === '<id1>', 'messageId bewaard');
  res = await M.verwerk(snapVan('mail/m1'), opties(goed));
  ok(res === 'overgeslagen' && verstuurd.length === 1, 'dubbele gebeurtenis verstuurt niet nog een keer');

  store.set('mail/m2', { to: 'geen-adres', message: { subject: 's', text: 't' } });
  const voor = verstuurd.length;
  res = await M.verwerk(snapVan('mail/m2'), opties(goed));
  ok(res === 'ongeldig' && verstuurd.length === voor && store.get('mail/m2').delivery.state === 'ERROR', 'ongeldig document: ERROR, niets verstuurd');

  store.set('mail/m3', { to: 'x@y.nl', message: { subject: 's', text: 't' } });
  res = await M.verwerk(snapVan('mail/m3'), opties(kapot));
  ok(res === 'mislukt' && store.get('mail/m3').delivery.state === 'ERROR', 'SMTP-fout: ERROR in het document');
  ok(/Authentication failed/.test(store.get('mail/m3').delivery.error), 'foutmelding bewaard');
  ok(!JSON.stringify(store.get('mail/m3')).includes('geheim'), 'wachtwoord komt nergens in het document');
  ok((await M.verwerk(null, opties(goed))) === 'leeg', 'zonder document gebeurt er niets');
})();
