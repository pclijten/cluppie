// Bevestigingsmail (functions/verificatie-mail.js).  Draaien: node tests/verificatie-mail.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError: class extends Error { constructor(c, m){ super(m); this.code = c; } } };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue };
  if (r === 'firebase-admin') return { auth: () => ({}) };
  return orig.call(this, r, ...a);
};
const V = require('../functions/verificatie-mail.js');
const { store } = fake;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

const LINK = 'https://cluppie-ad329.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=XYZ789&apiKey=KEY&lang=en';
const m = V.maakVerificatieMail(LINK.replace('lang=en', 'lang=nl'), 'Jan');
ok(/Hoi Jan,/.test(m.text) && /E-mailadres bevestigen/.test(m.html), 'Nederlandse tekst en knop');
ok(!/Follow this link|Thanks|Verify your email|Your Cluppie team/.test(m.text + m.html), 'geen Engelse standaardtekst');
ok(m.text.includes('oobCode=XYZ789') && /lang=nl/.test(m.html), 'link bevat code en lang=nl');
ok(/Hoi,/.test(V.maakVerificatieMail(LINK, '').text), 'zonder naam: "Hoi,"');

const gemaakt = [];
const auth = { generateEmailVerificationLink: async e => { gemaakt.push(e); return LINK; } };
const nu = new Date('2026-10-20T21:30:00Z');
const mails = () => [...store.keys()].filter(k => k.startsWith('mail/'));
(async () => {
  store.clear();
  ok(await V.verwerkVerificatie({ uid: 'u1', email: 'Jan@Club.NL', naam: 'Jan Jansen', bevestigd: false }, { auth, nu }) === 'verstuurd', 'onbevestigd account: verstuurd');
  const d = store.get(mails()[0]);
  ok(d.to === 'jan@club.nl' && d.message.subject === 'Bevestig je e-mailadres voor Cluppie' && /lang=nl/.test(d.message.html) && /Hoi Jan,/.test(d.message.text), 'ontvanger, Nederlands onderwerp, voornaam, lang=nl');

  const voor = mails().length;
  ok(await V.verwerkVerificatie({ uid: 'u2', email: 'a@b.nl', bevestigd: true }, { auth, nu }) === 'al-bevestigd' && mails().length === voor, 'al bevestigd: geen mail');
  ok(await V.verwerkVerificatie({ uid: 'u3', email: '', bevestigd: false }, { auth, nu }) === 'geen-adres', 'zonder e-mailadres: geweigerd');

  store.clear(); gemaakt.length = 0;
  const r = [];
  for (let i = 0; i < 5; i++) r.push(await V.verwerkVerificatie({ uid: 'u1', email: 'jan@club.nl', bevestigd: false }, { auth, nu }));
  ok(r.join() === 'verstuurd,verstuurd,verstuurd,limiet,limiet' && gemaakt.length === 3, 'maximaal 3 per uur per account, daarna geen link meer');
  ok(await V.verwerkVerificatie({ uid: 'u1', email: 'jan@club.nl', bevestigd: false }, { auth, nu: new Date('2026-10-20T22:05:00Z') }) === 'verstuurd', 'volgend uur weer mogelijk');
  ok(await V.verwerkVerificatie({ uid: 'u9', email: 'x@y.nl', bevestigd: false }, { auth, nu }) === 'verstuurd', 'limiet geldt per account, niet voor iedereen');

  /* callable */
  let f = null; try { await V.verificatieMail({ auth: null }); } catch (e){ f = e; }
  ok(f && f.code === 'unauthenticated', 'zonder inloggen geweigerd');
  f = null; try { await V.verificatieMail({ auth: { uid: 'a', token: { firebase: { sign_in_provider: 'anonymous' } } } }); } catch (e){ f = e; }
  ok(f && f.code === 'unauthenticated', 'anonieme gebruiker geweigerd');
  const res = await V.verificatieMail({ auth: { uid: 'a', token: { email: 'a@b.nl', email_verified: true, firebase: { sign_in_provider: 'password' } } } });
  ok(res.ok === true && res.alBevestigd === true, 'callable: al bevestigd geeft ok zonder mail');
})();
