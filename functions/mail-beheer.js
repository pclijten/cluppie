/* Platform › Mails (20261116p): de platformbeheerder leest en bewaart de teksten van alle mails,
   stuurt zichzelf een proef en ziet wat er de laatste 30 dagen is verstuurd.
     • leesMailteksten   (callable, platformbeheerder)  → alle soorten met standaard- en eigen tekst + verzonden
     • zetMailtekst      (callable, platformbeheerder)  → { soort, tekst?, uit?, eerstTonen? } | { soort, herstel: true } | { algemeen }
     • stuurProefmail    (callable, platformbeheerder)  → { soort, tekst? }  alleen naar het eigen adres
     • mailOpruimen      (dagelijks)                    → `mail/{id}` ouder dan 30 dagen weg
   De afhandeling staat los van onCall (db als argument), zodat hij getest kan worden. */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const T = require('./mail-teksten');

const REGIO = 'europe-west1';
const APP_URL = 'https://www.cluppie.io/';
const BEWAAR_DAGEN = 30;
const MAX_REGELS = 500;       // zoveel recente mails telt en toont het overzicht hooguit
const DAG = 86400000;

const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : 0)));
/* PURE (getest): adres afkorten voor het overzicht */
function kortAdres(to){
  const lijst = (Array.isArray(to) ? to : [to]).filter(Boolean).map(String);
  if (!lijst.length) return '';
  if (lijst.length > 1) return `${lijst.length} ontvangers`;
  const [voor, domein] = lijst[0].split('@');
  return domein ? `${voor.slice(0, 1)}•••@${domein}` : '•••';
}

/* licht: zonder het verzonden-overzicht (voor "eerst laten zien" bij goedkeuren en afwijzen) */
async function overzicht(db, nu = new Date(), { licht = false } = {}){
  const inst = await T.leesInstellingen(db, { vers: true });
  let docs = [];
  if (!licht) try {
    docs = (await db.collection('mail').where('gemaakt', '>=', new Date(nu.getTime() - BEWAAR_DAGEN * DAG)).orderBy('gemaakt', 'desc').limit(MAX_REGELS).get()).docs;
  } catch (e){ console.warn('[mail] overzicht lezen mislukt', e && e.message || e); }
  const aantal = {};
  const verzonden = docs.map(d => {
    const m = d.data() || {}, soort = m.soort || '';
    if (T.SOORTEN[soort]) aantal[soort] = (aantal[soort] || 0) + 1;
    const staat = (m.delivery && m.delivery.state) || '';
    return { tijd: ms(m.gemaakt), soort,
      naam: soort === 'proef' ? `Proef: ${(T.SOORTEN[m.proefVan] || {}).naam || 'mail'}` : ((T.SOORTEN[soort] || {}).naam || (m.message && m.message.subject) || 'Mail'),
      naar: kortAdres(m.to), status: staat === 'SUCCESS' ? 'aangekomen' : staat === 'ERROR' ? 'mislukt' : 'bezig',
      fout: staat === 'ERROR' ? String((m.delivery && m.delivery.error) || '').slice(0, 200) : '' };
  });
  const soorten = T.VOLGORDE.map(id => {
    const S = T.SOORTEN[id], tekst = T.tekstVan(id, inst);
    return { id, groep: S.groep, naam: S.naam, aan: S.aan, wanneer: S.wanneer,
      velden: Object.entries(S.velden).map(([vid, naam]) => ({ id: vid, naam })),
      kanUit: !!S.kanUit, magEerstTonen: !!S.magEerstTonen, vast: S.vast || '', voorkop: S.voorkop || '',
      heeftKnop: !!S.std.knop, stappen: S.stappen || [], std: { ...S.std }, tekst,
      aangepast: T.TEKSTVELDEN.some(k => tekst[k] !== S.std[k]),
      uit: T.staatUit(id, inst), eerstTonen: T.eerstTonen(id, inst),
      voorbeeld: { ...S.voorbeeld }, voorbeeldVast: S.voorbeeldVast || {}, aantal: aantal[id] || 0 };
  });
  return { soorten, algemeen: T.algemeenVan(inst), algemeenStd: { ...T.ALGEMEEN_STD }, verzonden: verzonden.slice(0, 100),
    bewaarDagen: BEWAAR_DAGEN, vol: docs.length >= MAX_REGELS, max: T.MAX };
}

/* Bewaren. Alleen wat afwijkt van de standaard komt in het document: verandert de standaard later, dan volgt de rest vanzelf. */
async function bewaar(db, d = {}, door = ''){
  const fout = t => { throw Object.assign(new Error(t), { code: 'invalid-argument' }); };
  const ref = db.doc(T.DOC), stempel = { bijgewerkt: FieldValue.serverTimestamp(), door };
  if (d.algemeen){
    const r = T.schoonAlgemeen(d.algemeen);
    if (r.fout) fout(r.fout);
    await ref.set({ algemeen: r.algemeen, ...stempel }, { merge: true });
  } else {
    const S = T.SOORTEN[d.soort];
    if (!S) fout('Onbekende mail.');
    if (d.herstel === true){
      await ref.set({ mails: { [d.soort]: FieldValue.delete() }, ...stempel }, { merge: true });
    } else {
      const eigen = {};
      if (d.tekst){
        const r = T.controleer(d.soort, d.tekst);
        if (r.fout) fout(r.fout);
        for (const k of T.TEKSTVELDEN) eigen[k] = r.tekst[k] === S.std[k] ? FieldValue.delete() : r.tekst[k];
      }
      if (typeof d.uit === 'boolean'){
        if (d.uit && !S.kanUit) fout('Deze mail kan niet uit: zonder kan iemand niet inloggen.');
        eigen.uit = d.uit ? true : FieldValue.delete();
      }
      if (typeof d.eerstTonen === 'boolean'){
        if (!S.magEerstTonen) fout('Deze mail wordt niet door jou zelf verstuurd.');
        eigen.eerstTonen = d.eerstTonen === !!S.eerstTonen ? FieldValue.delete() : d.eerstTonen;
      }
      if (!Object.keys(eigen).length) fout('Niets om op te slaan.');
      await ref.set({ mails: { [d.soort]: eigen }, ...stempel }, { merge: true });
    }
  }
  T.vergeetInstellingen();
  return { ok: true };
}

/* Proef naar het eigen adres, met voorbeeldgegevens en (als meegegeven) de tekst die nog niet is bewaard. */
async function proef(db, d = {}, adres = ''){
  const fout = t => { throw Object.assign(new Error(t), { code: 'invalid-argument' }); };
  const S = T.SOORTEN[d.soort];
  if (!S) fout('Onbekende mail.');
  if (!adres) fout('Aan je account hangt geen e-mailadres.');
  let eenmalig = null;
  if (d.tekst){ const r = T.controleer(d.soort, d.tekst); if (r.fout) fout(r.fout); eenmalig = r.tekst; }
  T.vergeetInstellingen();
  await T.verstuur(db, d.soort, adres, S.voorbeeld, { eenmalig, proef: true, vast: { knopUrl: APP_URL, ...(S.voorbeeldVast || {}) } });
  return { ok: true, naar: adres };
}

/* Oude mails weg: adressen en teksten blijven hooguit 30 dagen staan. */
async function ruimOp(db, nu = new Date()){
  const grens = new Date(nu.getTime() - BEWAAR_DAGEN * DAG);
  let weg = 0;
  for (let ronde = 0; ronde < 20; ronde++){
    const docs = (await db.collection('mail').where('gemaakt', '<', grens).limit(300).get()).docs;
    if (!docs.length) break;
    await Promise.all(docs.map(x => x.ref.delete()));
    weg += docs.length;
    if (docs.length < 300) break;
  }
  return weg;
}

function maakFuncties({ isPlatformBeheerder }){
  const alleenBeheerder = async request => {
    if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
  };
  const netjes = async fn => {
    try { return await fn(); }
    catch (e){
      if (e && e.code === 'invalid-argument') throw new HttpsError('invalid-argument', e.message);
      console.error('[mailbeheer]', e && e.message || e);
      throw new HttpsError('internal', 'Dat lukte niet. Probeer het zo opnieuw.');
    }
  };
  return {
    leesMailteksten: onCall({ region: REGIO }, async (request) => { await alleenBeheerder(request); return netjes(() => overzicht(getFirestore(), new Date(), { licht: !!(request.data && request.data.licht) })); }),
    zetMailtekst: onCall({ region: REGIO }, async (request) => { await alleenBeheerder(request); return netjes(() => bewaar(getFirestore(), request.data || {}, request.auth.uid)); }),
    stuurProefmail: onCall({ region: REGIO }, async (request) => { await alleenBeheerder(request); return netjes(() => proef(getFirestore(), request.data || {}, String(request.auth.token.email || '').toLowerCase())); }),
    mailOpruimen: onSchedule({ schedule: '20 4 * * *', timeZone: 'Europe/Amsterdam', region: REGIO }, async () => {
      const weg = await ruimOp(getFirestore());
      if (weg) console.log(`[mail] ${weg} oude mails opgeruimd`);
    }),
  };
}

module.exports = { maakFuncties, overzicht, bewaar, proef, ruimOp, kortAdres, BEWAAR_DAGEN };
