// Wachtwoord vergeten (functions/wachtwoord-reset.js).  Draaien: node tests/wachtwoord-reset.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError: class extends Error { constructor(c, m){ super(m); this.code = c; } } };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue };
  if (r === 'firebase-admin') return { auth: () => ({}) };
  return orig.call(this, r, ...a);
};
const W = require('../functions/wachtwoord-reset.js');
const { store } = fake;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

const LINK = 'https://cluppie-ad329.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123&apiKey=KEY&lang=en';

/* pure delen */
ok(/lang=nl/.test(W.nederlandseLink(LINK)) && !/lang=en/.test(W.nederlandseLink(LINK)), 'lang=en wordt lang=nl');
ok(/&lang=nl$/.test(W.nederlandseLink('https://x.nl/a?mode=r')), 'ontbrekende lang wordt toegevoegd');
ok(W.nederlandseLink('https://x.nl/a') === 'https://x.nl/a?lang=nl', 'link zonder query krijgt ?lang=nl');

const m = W.maakResetMail(W.nederlandseLink(LINK), 'Paul');
ok(/Hoi Paul,/.test(m.text) && /Nieuw wachtwoord kiezen/.test(m.html), 'Nederlandse tekst en knop');
ok(!/Follow this link|Thanks|Your Cluppie team/.test(m.text + m.html), 'geen Engelse standaardtekst meer');
ok(/Hoi,/.test(W.maakResetMail(LINK, '').text), 'zonder naam: "Hoi,"');
ok(/href="https:\/\/cluppie-ad329\.firebaseapp\.com\/__\/auth\/action\?mode=resetPassword&amp;oobCode=ABC123/.test(m.html), 'knoplink bevat de resetcode (& als &amp;)');
ok(m.text.includes('oobCode=ABC123'), 'tekstversie bevat de volledige link');

/* verwerkReset */
const gebruikers = { 'paul@club.nl': { displayName: 'Paul Lijten' }, 'zonder@club.nl': {} };
const gemaakt = [];
const auth = {
  getUserByEmail: async e => { if (!gebruikers[e]) { const x = new Error('nee'); x.code = 'auth/user-not-found'; throw x; } return gebruikers[e]; },
  generatePasswordResetLink: async e => { gemaakt.push(e); return LINK; },
};
const nu = new Date('2026-10-20T20:30:00Z');
const mails = () => [...store.keys()].filter(k => k.startsWith('mail/'));
(async () => {
  store.clear();
  ok(await W.verwerkReset('Paul@Club.NL ', { auth, nu }) === 'verstuurd', 'bekend adres: verstuurd (hoofdletters/spaties genegeerd)');
  ok(mails().length === 1, 'één mail-document geschreven');
  const d = store.get(mails()[0]);
  ok(d.to === 'paul@club.nl' && d.message.subject === 'Kies een nieuw wachtwoord voor Cluppie', 'ontvanger en Nederlands onderwerp');
  ok(/Hoi Paul,/.test(d.message.text) && d.message.html.includes('lang=nl'), 'voornaam in de mail en link in het Nederlands');

  const voor = mails().length;
  ok(await W.verwerkReset('onbekend@club.nl', { auth, nu }) === 'onbekend' && mails().length === voor, 'onbekend adres: geen mail, wel dezelfde uitkomst voor de app');
  ok(await W.verwerkReset('geen-adres', { auth, nu }) === 'ongeldig', 'ongeldig adres geweigerd');
  ok(await W.verwerkReset('zonder@club.nl', { auth, nu }) === 'verstuurd' && /Hoi,/.test(store.get(mails().pop()).message.text), 'account zonder naam: gewone aanhef');

  /* ratelimiet: 3 per uur per adres */
  store.clear(); gemaakt.length = 0;
  const uitkomsten = [];
  for (let i = 0; i < 5; i++) uitkomsten.push(await W.verwerkReset('paul@club.nl', { auth, nu }));
  ok(uitkomsten.join() === 'verstuurd,verstuurd,verstuurd,limiet,limiet', 'maximaal 3 mails per uur per adres');
  ok(gemaakt.length === 3, 'bij de limiet wordt geen link meer gemaakt');
  const later = new Date('2026-10-20T21:05:00Z');
  ok(await W.verwerkReset('paul@club.nl', { auth, nu: later }) === 'verstuurd', 'in het volgende uur weer mogelijk');
  ok(![...store.keys()].some(k => k.startsWith('ratelimiet/') && k.includes('paul')), 'het e-mailadres staat niet leesbaar in de limiet-sleutel');

  /* fout bij het maken van de link: geen mail, geen crash */
  store.clear();
  const kapot = { getUserByEmail: async () => ({}), generatePasswordResetLink: async () => { throw new Error('boem'); } };
  ok(await W.verwerkReset('paul@club.nl', { auth: kapot, nu }) === 'mislukt' && mails().length === 0, 'Admin-fout: geen mail');

  /* de callable antwoordt altijd hetzelfde en lekt niets */
  ok((await W.wachtwoordReset({ data: { email: 'onbekend@ergens.nl' } })).ok === true, 'callable geeft ok:true, ook als er intern iets misgaat');
  let fout = null; try { await W.wachtwoordReset({ data: { email: 'kaput' } }); } catch (e){ fout = e; }
  ok(fout && fout.code === 'invalid-argument', 'ongeldig adres: invalid-argument');
})();
