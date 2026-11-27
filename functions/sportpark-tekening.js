/* [20261127t] Sportpark als tekening: AI tekent de omgeving (water, bomen, gebouwen, paden, parkeerplaatsen,
   andere sportbanen) uit de luchtfoto, als eenvoudige vlakken. De voetbalvelden zelf tekent de app al exact uit
   wat de club heeft ingetekend; dit is alleen de sierlijke omgeving eromheen.

   Aanroep: sportparkTekeningAI({ clubId }) door clubbeheer, alleen als AI aan staat voor de club.
   De server haalt de luchtfototegels van PDOK, Claude geeft vormen in pixels terug, wij rekenen ze om
   naar lat/lon, maken ze schoon en zetten ze op clubs/{id}/sportparken/eigen.omgeving.
   Er gaan geen persoonsgegevens naar de AI: alleen luchtfoto's en de omtrek van de velden. */

const TS = 256;
const TEGEL = (laag, z, x, y) => `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/${laag}/EPSG:3857/${z}/${x}/${y}.jpeg`;
const SOORTEN = ['water', 'bos', 'gebouw', 'verharding', 'parkeren', 'zand', 'baan', 'gras', 'boom'];
const MAX_VORMEN = 160, MAX_PUNTEN = 32, RAND_M = 70, MAX_TEGELS = 12;

/* ---------- rekenwerk (getest in tests/sportpark-tekening.test.js) ---------- */
const naarPx = (lat, lon, z) => {
  const n = TS * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return { x: (lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
};
const naarLL = (x, y, z) => {
  const n = TS * 2 ** z, lon = x / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  return { lat, lon };
};
const verschuif = (p, dx, dy) => ({ lat: p.lat - dy / 110540, lon: p.lon + dx / (111320 * Math.cos(p.lat * Math.PI / 180)) });

/* Hoeken van een veld (lat/lon), uit midden, lengte, breedte en hoek (graden, met de klok mee). */
function hoekenVan(v){
  const h = (v.hoek || 0) * Math.PI / 180, L = (v.lengte || 0) / 2, B = (v.breedte || 0) / 2;
  return [[-L, -B], [L, -B], [L, B], [-L, B]].map(([x, y]) => verschuif(v, x * Math.cos(h) - y * Math.sin(h), x * Math.sin(h) + y * Math.cos(h)));
}

/* Welke tegels dekken het park (met een rand), op het grootste zoomniveau waarop het in MAX_TEGELS past. */
function tegelRaster(park){
  const punten = [];
  for (const v of park.velden || []){
    if (!Number.isFinite(v?.lat) || !Number.isFinite(v?.lon)) continue;
    const r = Math.max(v.lengte || 0, v.breedte || 0) / 2 + RAND_M;
    punten.push(verschuif(v, -r, -r), verschuif(v, r, r));
  }
  if (!punten.length && Number.isFinite(park.lat)) punten.push(verschuif(park, -150, -150), verschuif(park, 150, 150));
  if (!punten.length) return null;
  for (let z = 18; z >= 15; z--){
    const ps = punten.map(p => naarPx(p.lat, p.lon, z));
    const x0 = Math.floor(Math.min(...ps.map(p => p.x)) / TS), x1 = Math.floor(Math.max(...ps.map(p => p.x)) / TS);
    const y0 = Math.floor(Math.min(...ps.map(p => p.y)) / TS), y1 = Math.floor(Math.max(...ps.map(p => p.y)) / TS);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TEGELS || z === 15) return { z, x0, y0, kol: x1 - x0 + 1, rij: y1 - y0 + 1 };
  }
}

/* Wat de AI teruggeeft schoonmaken en omrekenen naar lat/lon. */
function schoonVormen(ruw, raster){
  const W = raster.kol * TS, H = raster.rij * TS, uit = [];
  const ll = (x, y) => { const p = naarLL(raster.x0 * TS + x, raster.y0 * TS + y, raster.z); return [Math.round(p.lat * 1e7) / 1e7, Math.round(p.lon * 1e7) / 1e7]; };
  const getal = v => Number.isFinite(Number(v)) ? Number(v) : null;
  for (const v of Array.isArray(ruw) ? ruw : []){
    if (uit.length >= MAX_VORMEN) break;
    if (!v || !SOORTEN.includes(v.soort)) continue;
    if (v.soort === 'boom'){
      const x = getal(v.x), y = getal(v.y), r = getal(v.r);
      if (x === null || y === null || x < 0 || y < 0 || x > W || y > H) continue;
      const [lat, lon] = ll(x, y), m = Math.max(1.5, Math.min(12, (r || 6) * mPerPx(raster)));
      uit.push({ soort: 'boom', lat, lon, r: Math.round(m * 10) / 10 });
      continue;
    }
    const pts = (Array.isArray(v.punten) ? v.punten : []).slice(0, MAX_PUNTEN)
      .map(p => Array.isArray(p) ? [getal(p[0]), getal(p[1])] : [null, null])
      .filter(([x, y]) => x !== null && y !== null)
      .map(([x, y]) => [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    if (pts.length < (v.soort === 'verharding' ? 2 : 3)) continue;
    const vorm = { soort: v.soort, punten: pts.map(([x, y]) => ll(x, y)) };
    if (v.soort === 'verharding' && v.lijn === true) vorm.lijn = true;
    uit.push(vorm);
  }
  return uit;
}
const mPerPx = r => 156543.03392 * Math.cos(naarLL((r.x0 + r.kol / 2) * TS, (r.y0 + r.rij / 2) * TS, r.z).lat * Math.PI / 180) / 2 ** r.z;

const SYSTEEM = `Je maakt een kaart in illustratiestijl van een sportpark. Je krijgt een luchtfoto in tegels van 256 × 256 pixels.
Samen vormen ze één beeld; elke tegel staat erbij met de pixels die hij in het hele beeld beslaat.

Geef de omgeving van de voetbalvelden als eenvoudige vlakken, in pixels van het HELE beeld:
- water (sloten, vijvers, plassen), bos (groepen bomen, bosjes), gebouw (kantine, kleedkamers, huizen, schuren),
  verharding (wegen, paden, pleinen; een smal pad mag als lijn met "lijn": true), parkeren (parkeerplaatsen),
  zand (zand, strand, atletiekbaan), baan (andere sportbanen: tennis, korfbal, hockey, padel, kunstgras zonder voetballijnen), gras (losse grasvelden zonder lijnen).
- losse bomen als {"soort":"boom","x":..,"y":..,"r":straal in pixels}.
De voetbalvelden die de club al heeft ingetekend (hieronder als hoekpunten) teken je NIET.
Houd het overzichtelijk: liever 30–100 goede vormen dan veel kleine. Polygonen met 3–24 punten, met de klok mee.

Antwoord ALLEEN met JSON, zonder uitleg: {"vormen":[{"soort":"water","punten":[[x,y],[x,y],[x,y]]}, …]}`;

function maak({ onCall, HttpsError, getFirestore, FieldValue, vereisAI, claude, ANTHROPIC_API_KEY, REGIO }){
  return onCall({ region: REGIO, secrets: [ANTHROPIC_API_KEY], cors: true, timeoutSeconds: 180, memory: '512MiB' }, async request => {
    const { clubId } = await vereisAI(request, ['club_admin']);
    const db = getFirestore(), ref = db.doc(`clubs/${clubId}/sportparken/eigen`);
    const park = (await ref.get()).data();
    if (!park || !(park.velden || []).length) throw new HttpsError('failed-precondition', 'Teken eerst de velden van het eigen sportpark in.');
    const vorig = park.omgeving?.ms || 0;
    if (Date.now() - vorig < 2 * 60 * 1000) throw new HttpsError('resource-exhausted', 'Net al getekend. Probeer het over een paar minuten opnieuw.');
    const raster = tegelRaster(park);
    if (!raster) throw new HttpsError('failed-precondition', 'Het sportpark staat nog niet op de kaart.');

    /* luchtfoto-tegels ophalen (HR, anders 25 cm) */
    const tegels = [];
    for (let r = 0; r < raster.rij; r++) for (let k = 0; k < raster.kol; k++){
      const x = raster.x0 + k, y = raster.y0 + r;
      let buf = null;
      for (const laag of ['Actueel_orthoHR', 'Actueel_ortho25']){
        try { const res = await fetch(TEGEL(laag, raster.z, x, y)); if (res.ok){ buf = Buffer.from(await res.arrayBuffer()); break; } } catch { /* volgende laag */ }
      }
      if (buf) tegels.push({ k, r, data: buf.toString('base64') });
    }
    if (!tegels.length) throw new HttpsError('unavailable', 'De luchtfoto is nu niet te halen. Probeer het later opnieuw.');

    const px = (lat, lon) => { const p = naarPx(lat, lon, raster.z); return [Math.round(p.x - raster.x0 * TS), Math.round(p.y - raster.y0 * TS)]; };
    const velden = (park.velden || []).filter(v => Number.isFinite(v.lat) && v.lengte).map(v => hoekenVan(v).map(h => px(h.lat, h.lon)));
    const inhoud = [];
    for (const t of tegels){
      inhoud.push({ type: 'text', text: `Tegel kolom ${t.k + 1}, rij ${t.r + 1}: pixels x ${t.k * TS}–${t.k * TS + TS}, y ${t.r * TS}–${t.r * TS + TS}.` });
      inhoud.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: t.data } });
    }
    inhoud.push({ type: 'text', text: `Het hele beeld is ${raster.kol * TS} × ${raster.rij * TS} pixels. De ingetekende voetbalvelden (niet tekenen):\n${JSON.stringify(velden)}` });

    const { tekst } = await claude({ apiKey: ANTHROPIC_API_KEY.value(), system: SYSTEEM, messages: [{ role: 'user', content: inhoud }],
      maxTokens: 8000, temperature: 0.2, metaTerug: true });
    const begin = tekst.indexOf('{'), eind = tekst.lastIndexOf('}');
    let a = null;
    try { a = JSON.parse(tekst.slice(begin, eind + 1)); } catch { a = null; }
    const vormen = schoonVormen(a?.vormen, raster);
    if (!vormen.length) throw new HttpsError('internal', 'Er kwam geen bruikbare tekening terug. Probeer het opnieuw.');
    await ref.set({ omgeving: { vormen, ms: Date.now(), door: request.auth.uid } }, { merge: true });
    return { aantal: vormen.length };
  });
}

module.exports = { maak, tegelRaster, schoonVormen, hoekenVan, naarPx, naarLL, SOORTEN, MAX_VORMEN };
