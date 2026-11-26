/* ==================== TEAMKAMER — pushmeldingen voor ouders [20261126m] ====================
   Een ouder zet in de teamkamer (kamer.html) meldingen aan op een toestel. Dat toestel krijgt een FCM-token,
   dat de pagina zelf bewaart onder gebruikers/{uid}/push/{id} (rules: alleen de eigen gebruiker, met eigen
   account; spelers met een code hebben dat niet en krijgen dus geen meldingen).
   De trainer kiest per poll en per mededeling of er een melding uitgaat (veld melding: true), en kan bij
   een lopende poll de gezinnen die nog niet stemden herinneren (veld herinnerMs). De triggers staan in
   teamkamer.js; hier staan de teksten, de keuze van de ontvangers en het versturen.
   De melding zelf toont public/sw.js (data-bericht, geen "notification"-blok): zo ziet hij er op elk toestel
   hetzelfde uit en opent een tik de juiste poll. */
'use strict';
const logger = require('firebase-functions/logger');

const KAMER_URL = 'https://www.cluppie.io/kamer.html';
/* hooguit één herinnering per poll per zes uur */
const HERINNER_MIN_MS = 6 * 3600000;
/* tokens die FCM niet meer kent: weg uit de database */
const DOOD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : Number(v) || 0);
const kort = (s, n) => {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

/* PURE (getest): de tekst van een melding. soort: 'poll' | 'herinnering' | 'bericht' */
function melding(soort, o = {}){
  const team = kort(o.teamNaam, 40) || 'je team';
  const enc = encodeURIComponent;
  if (soort === 'bericht') return { titel: `Mededeling · ${team}`, tekst: kort(o.tekst, 160) || 'Er staat een nieuwe mededeling klaar.',
    url: `${KAMER_URL}?team=${enc(o.teamId || '')}`, tag: 'bericht-' + (o.id || '') };
  const url = `${KAMER_URL}?team=${enc(o.teamId || '')}&poll=${enc(o.id || '')}`;
  if (soort === 'herinnering') return { titel: `Je stem is nodig · ${team}`, tekst: kort(o.vraag, 140) || 'Er staat een poll voor je klaar.', url, tag: 'poll-' + (o.id || '') };
  return { titel: `Nieuwe poll · ${team}`, tekst: kort(o.vraag, 140) || 'Er staat een nieuwe poll klaar.', url, tag: 'poll-' + (o.id || '') };
}

/* PURE (getest): wie krijgt de melding. leden = kamerleden [{ id (uid), rol, spelerIds, vervaltOp }].
   Alleen ouders met geldige toegang, niet de schrijver zelf. Met `gestemd` (Set van spelerIds): alleen
   gezinnen met minstens één kind dat nog niet stemde. */
function ontvangers(leden, { nu = Date.now(), behalve = '', gestemd = null } = {}){
  const uit = new Set();
  for (const l of leden || []){
    if (!l || l.rol !== 'ouder' || !l.id || l.id === behalve || ms(l.vervaltOp) <= nu) continue;
    if (gestemd && !(l.spelerIds || []).some(s => !gestemd.has(s))) continue;
    uit.add(l.id);
  }
  return [...uit];
}

/* PURE (getest): mag deze wijziging van een poll een herinnering geven? */
function herinnerMag(voor, na, nu = Date.now()){
  if (!voor || !na || na.status !== 'open') return false;
  const nieuw = Number(na.herinnerMs) || 0, oud = Number(voor.herinnerMs) || 0;
  if (!nieuw || nieuw === oud) return false;
  if (nieuw - oud < HERINNER_MIN_MS) return false;
  if (na.sluitOp && ms(na.sluitOp) <= nu) return false;
  return true;
}

/* Verstuur één melding naar de toestellen van deze ouders. Geeft { ouders, toestellen } terug: hoeveel er echt aankwamen
   bij FCM. Een fout bij het versturen gooit niet: de poll of mededeling zelf moet altijd blijven staan. */
async function stuur(db, uids, m){
  const tokens = [];
  for (const uid of uids){
    try {
      const s = await db.collection(`gebruikers/${uid}/push`).get();
      s.docs.forEach(d => { const t = d.data() && d.data().token; if (typeof t === 'string' && t) tokens.push({ t, ref: d.ref, uid }); });
    } catch (e){ logger.warn('[kamerPush] tokens lezen', e.message || e); }
  }
  if (!tokens.length) return { ouders: 0, toestellen: 0 };
  const data = { titel: String(m.titel), tekst: String(m.tekst), url: String(m.url), tag: String(m.tag || '') };
  let goed = 0; const bereikt = new Set();
  try {
    const messaging = require('firebase-admin/messaging').getMessaging();
    for (let i = 0; i < tokens.length; i += 500){
      const deel = tokens.slice(i, i + 500);
      const r = await messaging.sendEachForMulticast({ tokens: deel.map(x => x.t), data,
        webpush: { headers: { Urgency: 'high', TTL: String(2 * 86400) } } });
      r.responses.forEach((x, n) => {
        if (x.success){ goed++; bereikt.add(deel[n].uid); }
        else if (DOOD.includes(x.error && x.error.code)) deel[n].ref.delete().catch(() => {});
        else logger.warn('[kamerPush] niet verstuurd', x.error && (x.error.code || x.error.message));
      });
    }
  } catch (e){ logger.error('[kamerPush] versturen mislukt', e.message || e); }
  return { ouders: bereikt.size, toestellen: goed };
}

module.exports = { melding, ontvangers, herinnerMag, stuur, KAMER_URL, HERINNER_MIN_MS };
