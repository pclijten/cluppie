// Verhuis-login: wanneer geeft de server een inlogbewijs voor cluppie.io af, en wanneer niet.
// Draaien: node tests/verhuis-login.test.js   (eerst één keer: cd functions && npm install)
const assert = require('node:assert/strict');
process.env.GCLOUD_PROJECT ||= 'cluppie-test'; process.env.FIREBASE_CONFIG ||= '{}';
const { verwerkVerhuisLogin, EINDE, OUD_PROJECT } = require('../functions/verhuizing.js');

const geenAccount = () => { const e = new Error('geen'); e.code = 'auth/user-not-found'; throw e; };
const TOKEN = 'x'.repeat(200);
/* authOud: het token "is" wat er in `claims` staat; authNieuw: de accounts in cluppie.io */
const maak = (claims, accounts) => ({
  authOud: { verifyIdToken: async t => { if (t !== TOKEN || !claims) throw new Error('ongeldig token'); return claims; } },
  authNieuw: {
    getUser: async uid => accounts.find(a => a.uid === uid) || geenAccount(),
    getUserByEmail: async email => accounts.find(a => a.email === email) || geenAccount(),
    createCustomToken: async uid => 'bewijs-voor-' + uid,
  },
  nu: new Date('2026-12-01T12:00:00Z'),
});
const ww = { firebase: { sign_in_provider: 'password' } };
let n = 0;
const proef = async (naam, claims, accounts, verwacht, opt = {}) => {
  const r = await verwerkVerhuisLogin(opt.token === undefined ? TOKEN : opt.token, { ...maak(claims, accounts), ...(opt.nu ? { nu: opt.nu } : {}) });
  assert.deepEqual([r.token, r.uitkomst], verwacht, naam); n++;
};

(async () => {
  assert.equal(OUD_PROJECT, 'cluppieasv33');
  await proef('overgezet account: zelfde id en adres', { uid: 'u1', email: 'Trainer@x.test', ...ww }, [{ uid: 'u1', email: 'trainer@x.test' }], ['bewijs-voor-u1', 'zelfde']);
  await proef('ook als het adres in het oude project niet bevestigd is', { uid: 'u1', email: 'trainer@x.test', email_verified: false, ...ww }, [{ uid: 'u1', email: 'trainer@x.test' }], ['bewijs-voor-u1', 'zelfde']);
  await proef('had al een cluppie.io-account, adres bevestigd', { uid: 'oud', email: 'a@x.test', email_verified: true, ...ww }, [{ uid: 'nieuw', email: 'a@x.test' }], ['bewijs-voor-nieuw', 'gekoppeld']);
  await proef('zelfde adres maar NIET bevestigd in het oude project: geen bewijs', { uid: 'oud', email: 'a@x.test', email_verified: false, ...ww }, [{ uid: 'nieuw', email: 'a@x.test' }], [null, 'onbekend']);
  await proef('zelfde id maar ander adres en niets bevestigd', { uid: 'u1', email: 'a@x.test', ...ww }, [{ uid: 'u1', email: 'iemandanders@x.test' }], [null, 'onbekend']);
  await proef('account dat na de verhuizing in het oude project is gemaakt', { uid: 'later', email: 'later@x.test', ...ww }, [{ uid: 'u1', email: 'trainer@x.test' }], [null, 'onbekend']);
  await proef('anonieme sessie (ouder op een deellink)', { uid: 'anon', firebase: { sign_in_provider: 'anonymous' } }, [{ uid: 'anon', email: '' }], [null, 'anoniem']);
  await proef('geblokkeerd account', { uid: 'u1', email: 'trainer@x.test', ...ww }, [{ uid: 'u1', email: 'trainer@x.test', disabled: true }], [null, 'geblokkeerd']);
  await proef('vervalst of verlopen token', null, [{ uid: 'u1', email: 'trainer@x.test' }], [null, 'ongeldig']);
  await proef('geen token', { uid: 'u1', email: 'trainer@x.test', ...ww }, [{ uid: 'u1', email: 'trainer@x.test' }], [null, 'ongeldig'], { token: '' });
  await proef('iets anders dan tekst', { uid: 'u1', email: 'trainer@x.test', ...ww }, [{ uid: 'u1', email: 'trainer@x.test' }], [null, 'ongeldig'], { token: { a: 1 } });
  await proef('na de einddatum doet de functie niets meer', { uid: 'u1', email: 'trainer@x.test', ...ww }, [{ uid: 'u1', email: 'trainer@x.test' }], [null, 'voorbij'], { nu: new Date(EINDE + 'T00:00:00Z') });
  /* een onverwachte fout bij het opzoeken (geen "niet gevonden") mag niet stil een ander account opleveren */
  const stuk = maak({ uid: 'u1', email: 'a@x.test', email_verified: true, ...ww }, [{ uid: 'nieuw', email: 'a@x.test' }]);
  stuk.authNieuw.getUser = async () => { throw new Error('storing'); };
  await assert.rejects(verwerkVerhuisLogin(TOKEN, stuk)); n++;

  console.log(`verhuis-login: ${n} controles geslaagd`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
