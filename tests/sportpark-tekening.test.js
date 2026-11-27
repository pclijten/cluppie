// Sportpark als tekening: tegelraster, omrekenen en schoonmaken van wat de AI teruggeeft. Draaien: node tests/sportpark-tekening.test.js
const assert = require('node:assert/strict');
const T = require('../functions/sportpark-tekening.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; };
const park = { lat: 52.075, lon: 5.063, velden: [
  { id: 'v1', lat: 52.0747, lon: 5.0646, lengte: 100, breedte: 63, hoek: 17 },
  { id: 'v2', lat: 52.0755, lon: 5.0616, lengte: 120, breedte: 69, hoek: -73 } ] };
const r = T.tegelRaster(park);
ok(r && r.kol * r.rij <= 12 && r.z >= 15 && r.z <= 18, 'raster past in 12 tegels');
ok(T.tegelRaster({ velden: [] }) === null, 'zonder plek geen raster');
// omrekenen heen en terug
const p = T.naarPx(52.075, 5.063, 18), q = T.naarLL(p.x, p.y, 18);
ok(Math.abs(q.lat - 52.075) < 1e-9 && Math.abs(q.lon - 5.063) < 1e-9, 'pixel en lat/lon heen en terug');
// hoeken van een veld: diagonaal klopt
const h = T.hoekenVan({ lat: 52, lon: 5, lengte: 100, breedte: 60, hoek: 30 });
const m = (a, b) => Math.hypot((b.lon - a.lon) * 111320 * Math.cos(52 * Math.PI / 180), (b.lat - a.lat) * 110540);
ok(Math.abs(m(h[0], h[2]) - Math.hypot(100, 60)) < .5, 'diagonaal van het veld');
// schoonmaken
const W = r.kol * 256, H = r.rij * 256;
const v = T.schoonVormen([
  { soort: 'water', punten: [[0, 0], [100, 0], [100, 50]] },
  { soort: 'raket', punten: [[0, 0], [1, 1], [2, 2]] },
  { soort: 'gebouw', punten: [[1, 1], [2, 2]] },
  { soort: 'verharding', lijn: true, punten: [[0, 0], [W + 500, H + 500]] },
  { soort: 'boom', x: 10, y: 10, r: 4 },
  { soort: 'boom', x: -5, y: 10 },
  { soort: 'bos', punten: Array.from({ length: 80 }, (_, i) => [i, i % 7]) },
  { soort: 'gras', punten: [['a', 1], [2, 2], [3, 3], [4, 4]] },
], r);
ok(v.map(x => x.soort).join() === 'water,verharding,boom,bos,gras', 'onbekend, te klein en buiten beeld eruit: ' + v.map(x => x.soort).join());
ok(v[1].lijn === true && v[1].punten.length === 2, 'pad als lijn');
const rand = T.naarLL((r.x0 + r.kol) * 256, (r.y0 + r.rij) * 256, r.z);
ok(Math.abs(v[1].punten[1][0] - rand.lat) < 1e-6 && Math.abs(v[1].punten[1][1] - rand.lon) < 1e-6, 'punt buiten beeld naar de rand');
ok(v[3].punten.length === 32, 'hoogstens 32 punten');
ok(v[2].r >= 1.5 && v[2].r <= 12, 'boomstraal in meters');
ok(T.schoonVormen(Array.from({ length: 400 }, () => ({ soort: 'boom', x: 5, y: 5 })), r).length === T.MAX_VORMEN, 'hoogstens MAX_VORMEN');
ok(T.schoonVormen('rommel', r).length === 0);
console.log(`sportpark-tekening: ${n} controles geslaagd`);
