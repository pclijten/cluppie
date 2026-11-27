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
export function maakManifest(naam, afkorting){
  const n = schoon(naam);
  const ic = (s, p) => ({ src: `icons/club-${s}${p === 'maskable' ? '-maskable' : ''}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: p });
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

function manifestLink(){
  const l = document.querySelector('link[rel="manifest"]');
  /* alleen de trainersapp (index.html); de teamkamer heeft een eigen manifest */
  if (!l) return null;
  try { return new URL(l.href, location.href).pathname.endsWith('/manifest.webmanifest') ? l : null; } catch { return null; }
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
function herlaadManifest(l, sig){
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  l.setAttribute('href', 'manifest.webmanifest' + (sig ? '?c=' + sig : ''));
}

let _bezig = null;
/* Zet het app-icoon op het logo van deze club; zonder logo terug naar Cluppie. Faalt stil. */
export function zetAppIcoon(merk){
  const l = manifestLink();
  if (!l) return Promise.resolve(false);
  const klaar = (_bezig || Promise.resolve()).then(() => doe(l, merk || {})).catch(e => { console.warn('[app-icoon]', e); return false; });
  _bezig = klaar;
  return klaar;
}
async function doe(l, { clubId, naam, logo, afkorting }){
  /* geen eigen logo (of het Cluppie-logo zelf): het gewone Cluppie-icoon */
  if (!clubId || !logo || /^icons\/icon-/.test(logo)) return wis(l);
  const sig = handtekening(clubId, naam, logo, afkorting);
  const titel = korteNaam(naam, afkorting);
  let ios = null;
  try { ios = JSON.parse(localStorage.getItem(LS_IOS) || 'null'); } catch {}
  if (ios && ios.sig === sig) zetIos(ios.url, titel);
  let inCache = false;
  try { inCache = localStorage.getItem(LS_SIG) === sig; } catch {}
  if (inCache && ios && ios.sig === sig){ herlaadManifest(l, sig); return true; }

  const img = await laadPlaatje(logo);
  const iosUrl = teken(img, 180, VULLING.ios, false).toDataURL('image/png');
  zetIos(iosUrl, titel);
  try { localStorage.setItem(LS_IOS, JSON.stringify({ sig, url: iosUrl })); } catch {}

  if ('caches' in self){
    const c = await caches.open(APP_CACHE);
    const png = { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' };
    for (const maat of [192, 512]){
      await c.put(`icons/club-${maat}.png`, new Response(await alsBlob(teken(img, maat, VULLING.any, true)), { headers: png }));
      await c.put(`icons/club-${maat}-maskable.png`, new Response(await alsBlob(teken(img, maat, VULLING.maskable, false)), { headers: png }));
    }
    await c.put('manifest.webmanifest', new Response(JSON.stringify(maakManifest(naam, afkorting)), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' } }));
    try { localStorage.setItem(LS_SIG, sig); } catch {}
    herlaadManifest(l, sig);
  }
  return true;
}
async function wis(l){
  zetIos('', 'Cluppie');
  let had = false;
  try { had = !!localStorage.getItem(LS_SIG); localStorage.removeItem(LS_SIG); localStorage.removeItem(LS_IOS); } catch {}
  if ('caches' in self){ try { had = (await caches.delete(APP_CACHE)) || had; } catch {} }
  if (had) herlaadManifest(l, '0');
  return false;
}
