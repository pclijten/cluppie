/* app-icoon.js — [20261127a] het clublogo als app-icoon op de telefoon
   ================================================================
   cluppie.io is één app voor alle clubs. Wie de app op het beginscherm zet, krijgt het logo
   (en de naam) van de eigen club, niet het Cluppie-logo. Er is geen server voor nodig:
   • Android/Chrome: deze module tekent de iconen (PNG) uit het clublogo en legt ze samen met
     een manifest per club in Cache Storage ('appicoon-club'). sw.js geeft die terug op
     manifest.webmanifest en icons/club-*.png. Zonder club (niet ingelogd, geen logo, oude
     browser) geeft de worker de gewone bestanden van de site: het Cluppie-logo.
   • iPhone/iPad: Safari leest bij "Zet op beginscherm" de <link rel="apple-touch-icon"> van
     dat moment; die zetten we hier op het clublogo, met de clubnaam als titel.
   De club is pas bekend na het inloggen; daarna onthoudt clubconfig.js het merk (cluppieMerk),
   dus ook bij de volgende opstart staat het clublogo er direct.
   ================================================================ */

export const APP_CACHE = 'appicoon-club';          // geen 'cluppie-'-voorvoegsel: sw.js ruimt die op bij een release
const LS_IOS = 'cluppieAppIcoonIos';               // { sig, url } — het iOS-icoon, zodat het bij opstart direct klopt
const LS_SIG = 'cluppieAppIcoonSig';               // handtekening van wat er nu in de cache staat

/* [20261127b] Twee apps op dezelfde site: de trainersapp (index.html) en de teamkamer voor ouders
   (kamer.html). Elk een eigen manifest en eigen iconen, zodat ze naast elkaar kunnen staan. */
export const SOORTEN = {
  app:   { manifest: 'manifest.webmanifest', icoon: 'club',  ls: '' },
  kamer: { manifest: 'kamer.webmanifest',    icoon: 'kamer', ls: 'Kamer' },
};

/* ---------- pure logica (getest in tests/app-icoon.test.mjs) ---------- */

/* Naam onder het icoon: de afkorting van de club (bv. ASV'33), anders de clubnaam als die kort
   genoeg is, anders "Cluppie". */
const schoon = s => String(s || '').replace(/\s+/g, ' ').trim();
export function korteNaam(naam, afkorting){
  const a = schoon(afkorting), n = schoon(naam);
  if (a && a.length <= 14) return a;
  return n && n.length <= 14 ? n : 'Cluppie';
}

/* Het manifest per club. Zelfde start_url/scope als public/manifest.webmanifest (en geen eigen id),
   zodat het dezelfde app blijft: Chrome kan een bestaande installatie dan bijwerken. */
export function maakManifest(naam, afkorting, soort = 'app', icoon = null){
  const n = schoon(naam), kort = korteNaam(n, afkorting), srv = serverIconen(icoon);
  if (soort === 'kamer') return maakKamerManifest(n, kort, srv);
  const ic = (s, p) => ({ src: srv ? srv[(p === 'maskable' ? 'm' : 'a') + s] : `icons/club-${s}${p === 'maskable' ? '-maskable' : ''}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: p });
  return {
    name: n ? `${n} · Cluppie` : 'Cluppie — Coach je team',
    short_name: korteNaam(n, afkorting),
    description: 'Coach je team: opstelling per kwart, wissels, presentie en speeltijd eerlijk verdeeld.',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0e1116',
    theme_color: '#0e1116',
    icons: [ic(192, 'any'), ic(512, 'any'), ic(192, 'maskable'), ic(512, 'maskable')],
  };
}
/* De teamkamer: zelfde id/start_url/scope als public/kamer.webmanifest. Onder het icoon "ASV'33 Team",
   zodat een trainer met beide apps ze uit elkaar houdt (te lang: alleen de clubnaam). */
function maakKamerManifest(n, kort, srv){
  const ic = (s, p) => ({ src: srv ? srv[(p === 'maskable' ? 'm' : 'a') + s] : `icons/kamer-${s}${p === 'maskable' ? '-maskable' : ''}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: p });
  const team = kort !== 'Cluppie' && (kort + ' Team').length <= 14 ? kort + ' Team' : (kort === 'Cluppie' ? 'Teamkamer' : kort);
  return {
    id: 'kamer.html',
    name: n ? `Teamkamer · ${n}` : 'Teamkamer · Cluppie',
    short_name: team,
    description: 'De teamkamer van je team: trainingen, wedstrijden, mededelingen en polls.',
    start_url: 'kamer.html',
    scope: 'kamer.html',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e1116',
    theme_color: '#0e1116',
    icons: [ic(192, 'any'), ic(512, 'any'), ic(192, 'maskable'), ic(512, 'maskable')],
  };
}

/* [20261127c] Android haalt het icoon bij het installeren buiten de service worker om op (de
   WebAPK-server van Google, of Chrome zelf). Daarom zet een clubbeheerder de iconen ook als echte
   bestanden in Firebase Storage (clubs/{id}/trainingen/app-icoon/, daar mogen leden PNG's zetten,
   dus geen nieuwe rules nodig); de openbare download-links staan in instellingen.identiteit.appIcoon.
   Die gaan in het manifest; zonder die links blijven de iconen uit de cache van de app. */
const STORAGE_URL = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[A-Za-z0-9._-]+\/o\/[^\s"'<>]+$/;
export const ICOON_SLEUTELS = ['a192', 'a512', 'm192', 'm512'];
export function serverIconen(icoon){
  if (!icoon || typeof icoon !== 'object') return null;
  return ICOON_SLEUTELS.every(k => typeof icoon[k] === 'string' && STORAGE_URL.test(icoon[k])) ? icoon : null;
}
/* Handtekening van alleen het logo: horen de iconen in Storage nog bij het huidige logo? */
export const logoSig = (logo) => handtekening('', '', logo, '');
export function serverIcoonNodig(logo, icoon){
  if (!logo || /^icons\/icon-/.test(logo)) return false;
  return !serverIconen(icoon) || icoon.sig !== logoSig(logo);
}

/* Korte handtekening van club + logo + naam, om niet bij elke opstart opnieuw te tekenen. */
export function handtekening(clubId, naam, logo, afkorting){
  const s = `${clubId}|${naam || ''}|${afkorting || ''}|${logo || ''}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '-' + s.length.toString(36);
}

/* Hoe groot het logo op het vlak staat (deel van de zijde). Maskable: Android knipt er een cirkel
   of druppel uit; alleen de middelste cirkel (80%) blijft altijd zichtbaar, dus het logo kleiner. */
export const VULLING = { any: 0.84, maskable: 0.66, ios: 0.80 };

/* ---------- tekenen ---------- */

function laadPlaatje(src){
  return new Promise((ok, fout) => {
    const img = new Image();
    if (/^https:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => fout(new Error('logo niet te laden'));
    img.src = src;
  });
}
/* Vierkant wit vlak met het logo in het midden (logo's zijn bijna altijd voor wit gemaakt). */
function teken(img, maat, vulling, rond){
  const cv = document.createElement('canvas'); cv.width = cv.height = maat;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff';
  if (rond){
    const r = maat * 0.22;
    c.beginPath(); c.moveTo(r, 0); c.arcTo(maat, 0, maat, maat, r); c.arcTo(maat, maat, 0, maat, r);
    c.arcTo(0, maat, 0, 0, r); c.arcTo(0, 0, maat, 0, r); c.closePath(); c.fill();
  } else c.fillRect(0, 0, maat, maat);
  const w = img.naturalWidth || img.width || maat, h = img.naturalHeight || img.height || maat;
  const vak = maat * vulling, s = vak / Math.max(w, h);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(img, (maat - w * s) / 2, (maat - h * s) / 2, w * s, h * s);
  return cv;
}
const alsBlob = cv => new Promise((ok, fout) => cv.toBlob(b => b ? ok(b) : fout(new Error('toBlob')), 'image/png'));

/* ---------- in de pagina zetten ---------- */

function manifestLink(soort){
  const l = document.querySelector('link[rel="manifest"]');
  /* alleen op de pagina van die app (index.html of kamer.html) */
  if (!l || !SOORTEN[soort]) return null;
  try { return new URL(l.href, location.href).pathname.endsWith('/' + SOORTEN[soort].manifest) ? l : null; } catch { return null; }
}
function zetIos(url, titel){
  let l = document.querySelector('link[rel="apple-touch-icon"]');
  if (!l){ l = document.createElement('link'); l.rel = 'apple-touch-icon'; document.head.appendChild(l); }
  if (!l.dataset.cluppie) l.dataset.cluppie = l.getAttribute('href') || 'icons/apple-touch-icon.png';
  l.setAttribute('href', url || l.dataset.cluppie);
  let m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!m){ m = document.createElement('meta'); m.name = 'apple-mobile-web-app-title'; document.head.appendChild(m); }
  m.setAttribute('content', titel || 'Cluppie');
}
/* Laat Chrome het manifest opnieuw ophalen (een andere href; sw.js kijkt alleen naar het pad). */
function herlaadManifest(l, sig, soort){
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  l.setAttribute('href', SOORTEN[soort].manifest + (sig ? '?c=' + sig : ''));
}

let _bezig = null;
/* Zet het app-icoon op het logo van deze club; zonder logo terug naar Cluppie. Faalt stil. */
export function zetAppIcoon(merk, soort = 'app'){
  const l = manifestLink(soort);
  if (!l) return Promise.resolve(false);
  const klaar = (_bezig || Promise.resolve()).then(() => doe(l, merk || {}, soort)).catch(e => { console.warn('[app-icoon]', e); return false; });
  _bezig = klaar;
  return klaar;
}
async function doe(l, { clubId, naam, logo, afkorting, icoon }, soort){
  const S = SOORTEN[soort], lsIos = LS_IOS + S.ls, lsSig = LS_SIG + S.ls;
  /* geen eigen logo (of het Cluppie-logo zelf): het gewone Cluppie-icoon */
  if (!clubId || !logo || /^icons\/icon-/.test(logo)) return wis(l, soort);
  /* iconen in Storage alleen als ze bij dit logo horen */
  const srv = serverIconen(icoon) && icoon.sig === logoSig(logo) ? icoon : null;
  const sig = handtekening(clubId, naam, logo, afkorting + '|' + (srv ? srv.a512 : ''));
  const titel = maakManifest(naam, afkorting, soort).short_name;
  let ios = null;
  try { ios = JSON.parse(localStorage.getItem(lsIos) || 'null'); } catch {}
  if (ios && ios.sig === sig) zetIos(ios.url, titel);
  let inCache = false;
  try { inCache = localStorage.getItem(lsSig) === sig; } catch {}
  if (inCache && ios && ios.sig === sig){ herlaadManifest(l, sig, soort); return true; }

  const img = await laadPlaatje(logo);
  const iosUrl = teken(img, 180, VULLING.ios, false).toDataURL('image/png');
  zetIos(iosUrl, titel);
  try { localStorage.setItem(lsIos, JSON.stringify({ sig, url: iosUrl })); } catch {}

  if ('caches' in self){
    const c = await caches.open(APP_CACHE);
    const png = { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' };
    for (const maat of [192, 512]){
      await c.put(`icons/${S.icoon}-${maat}.png`, new Response(await alsBlob(teken(img, maat, VULLING.any, true)), { headers: png }));
      await c.put(`icons/${S.icoon}-${maat}-maskable.png`, new Response(await alsBlob(teken(img, maat, VULLING.maskable, false)), { headers: png }));
    }
    await c.put(S.manifest, new Response(JSON.stringify(maakManifest(naam, afkorting, soort, srv)), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' } }));
    try { localStorage.setItem(lsSig, sig); } catch {}
    herlaadManifest(l, sig, soort);
  }
  return true;
}
async function wis(l, soort){
  const S = SOORTEN[soort];
  zetIos('', soort === 'kamer' ? 'Teamkamer' : 'Cluppie');
  let had = false;
  try { had = !!localStorage.getItem(LS_SIG + S.ls); localStorage.removeItem(LS_SIG + S.ls); localStorage.removeItem(LS_IOS + S.ls); } catch {}
  if ('caches' in self){
    try {
      const c = await caches.open(APP_CACHE);
      for (const k of [S.manifest, ...[192, 512].flatMap(m => [`icons/${S.icoon}-${m}.png`, `icons/${S.icoon}-${m}-maskable.png`])]) had = (await c.delete(k)) || had;
    } catch {}
  }
  if (had) herlaadManifest(l, '0', soort);
  return false;
}

/* [20261127c] Clubbeheerder: de iconen als echte bestanden in Storage zetten en de links in het
   clubdocument bewaren. fb = { storage, sRef, uploadBytes, getDownloadURL, db, doc, updateDoc }. */
const _gemaakt = new Set();
export async function maakServerIcoon(clubId, logo, fb){
  const sig = logoSig(logo);
  if (!clubId || _gemaakt.has(clubId + sig)) return null;
  _gemaakt.add(clubId + sig);
  const img = await laadPlaatje(logo);
  const uit = { sig };
  for (const maat of [192, 512]){
    for (const [k, vul, rond] of [['a', VULLING.any, true], ['m', VULLING.maskable, false]]){
      const r = fb.sRef(fb.storage, `clubs/${clubId}/trainingen/app-icoon/${sig}-${k}${maat}.png`);
      await fb.uploadBytes(r, await alsBlob(teken(img, maat, vul, rond)), { contentType: 'image/png', cacheControl: 'public, max-age=31536000' });
      uit[k + maat] = await fb.getDownloadURL(r);
    }
  }
  if (!serverIconen(uit)) throw new Error('onverwachte download-link');
  await fb.updateDoc(fb.doc(fb.db, 'clubs', clubId), { 'instellingen.identiteit.appIcoon': uit });
  return uit;
}
