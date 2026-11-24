/* ==================== VELDPLANNER: REKENWERK [20261124v] ====================
   PURE module (geen DOM, geen Firebase, geen imports): vakken op een veld, botsingen,
   controles en een vrij vak zoeken. Gebruikt door veldplanner.js, getest in
   tests/veldplanner.test.mjs. Zie docs/veldplanner-impactanalyse.md.

   Tijden zijn minuten na middernacht, dagen 1 (maandag) t/m 7 (zondag), zoals
   trainingsmomenten.js. Een vak is een rechthoek op het veld als fractie (0–1):
   x langs de lengte (a = linkerhelft, b = rechterhelft), y langs de breedte
   (voor = bovenste helft, achter = onderste). Heel, half en kwart staan altijd
   klaar; de club tekent er eigen vakken bij (keepershoek, pannaveldje). */

export const STANDAARD_VAKKEN = [
  { id: 'h',  naam: 'Heel veld',     kort: '',          x: 0,  y: 0,  w: 1,  h: 1 },
  { id: 'a',  naam: 'Half a',        kort: 'a',         x: 0,  y: 0,  w: .5, h: 1 },
  { id: 'b',  naam: 'Half b',        kort: 'b',         x: .5, y: 0,  w: .5, h: 1 },
  { id: 'av', naam: 'Kwart a voor',  kort: 'a voor',    x: 0,  y: 0,  w: .5, h: .5 },
  { id: 'aa', naam: 'Kwart a achter', kort: 'a achter', x: 0,  y: .5, w: .5, h: .5 },
  { id: 'bv', naam: 'Kwart b voor',  kort: 'b voor',    x: .5, y: 0,  w: .5, h: .5 },
  { id: 'ba', naam: 'Kwart b achter', kort: 'b achter', x: .5, y: .5, w: .5, h: .5 },
];
export const NODIG = { kwart: .25, half: .5, heel: 1 };
export const MAAT_NAAM = { kwart: 'kwart veld', half: 'half veld', heel: 'heel veld' };
export const KK_VOOR = 15;                       // kleedkamer open vóór de training
export const KK_NA = 20;                         // en na de training
export const ONDER_TOT = 19 * 60 + 30;           // onderbouw liefst om 19:30 klaar
export const DONKER = 17 * 60;                   // in de winter om 17:00 donker
export const MAX_EIGEN = 12;                     // eigen vakken per veld
const EPS = 1e-6;

/* ---------- tijd ---------- */
export const naarMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };
export const naarTijd = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const overlapt = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
export const rondKwartier = n => Math.round(n / 15) * 15;

/* ---------- vakken ---------- */
const getal = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
/* Een eigen vak schoonmaken: binnen het veld, minstens 3 × 3 meter, naam van hooguit 30 tekens. */
export function schoonVak(k, i = 0){
  if (!k || typeof k !== 'object') return null;
  let x = getal(k.x, 0, 1), y = getal(k.y, 0, 1), w = getal(k.w, 0, 1), h = getal(k.h, 0, 1);
  if ([x, y, w, h].some(v => v === null)) return null;
  w = Math.min(w, 1 - x); h = Math.min(h, 1 - y);
  if (w < 3 / 105 - EPS || h < 3 / 68 - EPS) return null;
  const id = /^[a-z0-9-]{1,20}$/i.test(String(k.id || '')) && !STANDAARD_VAKKEN.some(s => s.id === k.id) ? String(k.id) : `e${i + 1}`;
  const naam = String(k.naam || '').trim().slice(0, 30) || 'Eigen vak';
  const r = v => Math.round(v * 1e4) / 1e4;
  return { id, naam, x: r(x), y: r(y), w: r(w), h: r(h) };
}
/* Alle vakken van een veld: eerst de vaste, dan de eigen. `inst` = instellingen.velden[veldId]. */
export function vakkenVan(inst){
  const eigen = [], ids = new Set();
  for (const [i, k] of (Array.isArray(inst?.vakken) ? inst.vakken : []).entries()){
    const s = schoonVak(k, i);
    if (s && !ids.has(s.id) && eigen.length < MAX_EIGEN){ ids.add(s.id); eigen.push({ ...s, kort: s.naam.toLowerCase(), eigen: true }); }
  }
  return [...STANDAARD_VAKKEN.map(k => ({ ...k })), ...eigen];
}
export const vakUit = (vakken, id) => vakken.find(k => k.id === id) || vakken[0];
export const deelVan = k => Math.round(k.w * k.h * 1000) / 1000;
export const vakkenOverlap = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
export const meters = (k, lengte = 105, breedte = 68) => `${Math.round(k.w * lengte)} × ${Math.round(k.h * breedte)} m`;
export const deelTekst = f => f >= 1 - EPS ? 'heel veld' : Math.abs(f - .5) < EPS ? 'half veld' : Math.abs(f - .25) < EPS ? 'kwart veld' : `${Math.max(1, Math.round(f * 100))}% van het veld`;
/* Banen in de tijdlijn: de vier kwarten (0 a voor, 1 a achter, 2 b voor, 3 b achter). Een vak vult de kwarten die het raakt. */
export function banenVan(k){
  const uit = [];
  [[0, 0], [0, .5], [.5, 0], [.5, .5]].forEach(([qx, qy], i) => {
    if (k.x < qx + .5 - EPS && k.x + k.w > qx + EPS && k.y < qy + .5 - EPS && k.y + k.h > qy + EPS) uit.push(i);
  });
  return uit;
}
/* Aaneengesloten stukken banen, bijv. [0, 2] → [[0,0],[2,2]]. */
export function stukken(banen){
  const uit = [];
  for (const l of [...banen].sort((a, b) => a - b)){
    const laatste = uit[uit.length - 1];
    if (laatste && l === laatste[1] + 1) laatste[1] = l; else uit.push([l, l]);
  }
  return uit;
}

/* ---------- teams ---------- */
/* Welk deel van het veld heeft een team nodig? 6 tegen 6 en kleiner: kwart, 8 tegen 8: half, ouder: half
   (op de training deelt de bovenbouw meestal), het eerste team van de oudste jeugd: heel. Te overschrijven per team. */
export function maatVanCategorie(cat, naam = ''){
  const m = /^[JM]?O(\d+)/i.exec(String(cat || '').trim()) || /[JM]?O(\d+)/i.exec(String(naam || ''));
  const lft = m ? +m[1] : 19;
  if (lft <= 9) return 'kwart';
  if (lft <= 14) return 'half';
  return /-1\b/.test(String(naam || '')) ? 'heel' : 'half';
}
export function duurVanCategorie(cat, naam = ''){
  const m = /^[JM]?O(\d+)/i.exec(String(cat || '').trim()) || /[JM]?O(\d+)/i.exec(String(naam || ''));
  const lft = m ? +m[1] : 19;
  return lft <= 9 ? 60 : lft <= 13 ? 75 : 90;
}

/* ---------- vrij vak ---------- */
export function vakVrij(rooster, inst, { dag, veld, vak, start, eind }, behalve){
  const vakken = vakkenVan(inst), k = vakUit(vakken, vak);
  return !rooster.some(b => b.id !== behalve && b.dag === dag && b.veld === veld && overlapt(start, eind, b.start, b.eind)
    && vakkenOverlap(vakUit(vakken, b.vak), k));
}
/* Kleinste vrije vak dat groot genoeg is. Voorkeur: het gevraagde vak (als het past en vrij is). Anders null. */
export function zoekVrijVak(rooster, inst, { dag, veld, start, eind, nodig = .25, voorkeur }, behalve){
  const vakken = vakkenVan(inst);
  const groot = k => deelVan(k) >= nodig - EPS;
  const vrij = k => vakVrij(rooster, inst, { dag, veld, vak: k.id, start, eind }, behalve);
  const v = vakken.find(k => k.id === voorkeur);
  if (v && groot(v) && vrij(v)) return v.id;
  const kandidaten = vakken.filter(groot).sort((a, b) => deelVan(a) - deelVan(b) || (a.eigen ? 1 : 0) - (b.eigen ? 1 : 0));
  return kandidaten.find(vrij)?.id || null;
}
export function vrijeKleedkamers(rooster, kleedkamers, { dag, start, eind }, behalve){
  const bezet = new Set(rooster.filter(b => b.id !== behalve && b.dag === dag
    && overlapt(start - KK_VOOR, eind + KK_NA, b.start - KK_VOOR, b.eind + KK_NA)).flatMap(b => b.kk || []));
  return kleedkamers.filter(k => !bezet.has(k.id)).map(k => k.id);
}

/* ---------- stapelen in de tijdlijn ----------
   Twee blokken die dezelfde baan raken maar niet echt botsen (bijv. kwart a voor en een keepershoek links)
   komen boven elkaar in die baan: i = rij, n = aantal rijen. */
export function stapel(lijst, vakken){
  const uit = {}, gezet = [];
  const k = b => vakUit(vakken, b.vak);
  [...lijst].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).forEach(b => {
    const buren = gezet.filter(x => overlapt(b.start, b.eind, x.start, x.eind)
      && banenVan(k(b)).some(l => banenVan(k(x)).includes(l)) && !vakkenOverlap(k(b), k(x)));
    let i = 0; while (buren.some(x => uit[x.id].i === i)) i++;
    uit[b.id] = { i, n: 1 }; gezet.push(b);
    const groep = [b, ...buren], n = Math.max(...groep.map(x => uit[x.id].i)) + 1;
    groep.forEach(x => { uit[x.id].n = Math.max(uit[x.id].n, n); });
  });
  return uit;
}

/* ---------- controles ----------
   ctx: { teams: {id: {naam, bouw, maat, coaches:[uid], coachNamen:{uid: naam}}},
          velden: {id: {naam, licht}}, inst: {veldId: {vakken}}, kleedkamers: [{id, naam}] }
   Uit: { lijst: [{ soort: 'fout'|'warn', dag, ids, tekst, fix? }], status: { blokId: 'botsing'|'waarsch' } } */
export function controleer(rooster, ctx, dagen = [1, 2, 3, 4, 5, 6, 7]){
  const uit = [], status = {};
  const T = id => ctx.teams?.[id] || { naam: 'Onbekend team' };
  const V = id => ctx.velden?.[id] || { naam: 'Onbekend veld', licht: true };
  const vakken = id => vakkenVan(ctx.inst?.[id]);
  const kkNaam = id => (ctx.kleedkamers || []).find(k => k.id === id)?.naam || 'Kleedkamer';
  const voeg = (soort, dag, ids, tekst, fix) => {
    uit.push({ soort, dag, ids, tekst, fix });
    ids.forEach(id => { if (soort === 'fout' || !status[id]) status[id] = soort === 'fout' ? 'botsing' : 'waarsch'; });
  };
  for (const d of dagen){
    const dag = rooster.filter(b => b.dag === d);
    for (let i = 0; i < dag.length; i++) for (let j = i + 1; j < dag.length; j++){
      const a = dag[i], b = dag[j];
      const tijd = overlapt(a.start, a.eind, b.start, b.eind);
      if (tijd && a.veld === b.veld && vakkenOverlap(vakUit(vakken(a.veld), a.vak), vakUit(vakken(b.veld), b.vak)))
        voeg('fout', d, [a.id, b.id], `${T(a.team).naam} en ${T(b.team).naam} staan tegelijk op ${V(a.veld).naam} (${naarTijd(Math.max(a.start, b.start))}).`, { soort: 'veld', id: b.id });
      const samen = (a.kk || []).filter(k => (b.kk || []).includes(k));
      if (samen.length && overlapt(a.start - KK_VOOR, a.eind + KK_NA, b.start - KK_VOOR, b.eind + KK_NA))
        voeg('fout', d, [a.id, b.id], `${kkNaam(samen[0])} is dubbel: ${T(a.team).naam} en ${T(b.team).naam}.`, { soort: 'kk', id: b.id });
      if (a.team === b.team) voeg('warn', d, [a.id, b.id], `${T(a.team).naam} traint twee keer op dezelfde dag.`);
      else if (tijd){
        const ca = T(a.team).coaches || [], cb = T(b.team).coaches || [];
        const wie = ca.find(u => cb.includes(u));
        if (wie) voeg('warn', d, [a.id, b.id], `${T(a.team).coachNamen?.[wie] || 'Een trainer'} traint ${T(a.team).naam} en ${T(b.team).naam} tegelijk.`);
      }
    }
    for (const b of dag){
      const t = T(b.team), v = V(b.veld), k = vakUit(vakken(b.veld), b.vak);
      if (t.bouw === 'onder' && b.eind > ONDER_TOT) voeg('warn', d, [b.id], `${t.naam} (onderbouw) traint tot ${naarTijd(b.eind)}. Advies: uiterlijk ${naarTijd(ONDER_TOT)} klaar.`);
      if (v.licht === false && b.eind > DONKER) voeg('warn', d, [b.id], `${v.naam} heeft geen licht en ${t.naam} traint tot ${naarTijd(b.eind)}. In de winter is het om 17:00 donker.`, { soort: 'licht', id: b.id });
      const nodig = NODIG[t.maat] || .25;
      if (deelVan(k) < nodig - EPS) voeg('warn', d, [b.id], `${t.naam} heeft een ${MAAT_NAAM[t.maat]} nodig en staat op ${k.naam.toLowerCase()} (${deelTekst(deelVan(k))}).`, { soort: 'vak', id: b.id });
      if ((ctx.kleedkamers || []).length && !(b.kk || []).length) voeg('warn', d, [b.id], `${t.naam} heeft nog geen kleedkamer.`, { soort: 'kk', id: b.id });
    }
  }
  return { lijst: uit, status };
}

/* Teams die nog niet vaak genoeg ingepland staan. `per` = gewenst aantal trainingen per week. */
export function nogInTePlannen(teams, rooster){
  return teams.map(t => ({ t, n: rooster.filter(b => b.team === t.id).length }))
    .filter(x => x.n < (x.t.per || 0));
}

/* ---------- opslag schoonmaken (wat naar Firestore gaat) ---------- */
export const MAX_BLOKKEN = 400;
export function schoonBlok(b){
  if (!b || typeof b !== 'object') return null;
  const dag = Math.round(Number(b.dag)), start = Math.round(Number(b.start)), eind = Math.round(Number(b.eind));
  if (!(dag >= 1 && dag <= 7) || !(start >= 6 * 60 && start < eind && eind <= 24 * 60)) return null;
  const id = String(b.id || ''), team = String(b.team || ''), veld = String(b.veld || ''), vak = String(b.vak || 'h');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !team || team.length > 60 || !veld || veld.length > 60 || vak.length > 20) return null;
  const kk = [...new Set((Array.isArray(b.kk) ? b.kk : []).map(String).filter(k => k && k.length <= 20))].slice(0, 4);
  return { id, team, dag, start, eind, veld, vak, kk };
}
export function schoonRooster(blokken){
  const ids = new Set(), uit = [];
  for (const b of Array.isArray(blokken) ? blokken : []){
    const s = schoonBlok(b);
    if (s && !ids.has(s.id) && uit.length < MAX_BLOKKEN){ ids.add(s.id); uit.push(s); }
  }
  return uit;
}
export function schoonKleedkamers(lijst){
  const ids = new Set(), uit = [];
  for (const k of Array.isArray(lijst) ? lijst : []){
    const id = String(k?.id || ''), naam = String(k?.naam || '').trim().slice(0, 30);
    if (/^[A-Za-z0-9_-]{1,20}$/.test(id) && naam && !ids.has(id) && uit.length < 40){ ids.add(id); uit.push({ id, naam }); }
  }
  return uit;
}
/* Kleedkamers uit de plekken van de veldkaart ("Kleedkamers 1–4" → 1, 2, 3, 4), anders 1 t/m `standaard`. */
export function kleedkamersVoorstel(plekken, standaard = 6){
  const nrs = new Set();
  for (const p of Array.isArray(plekken) ? plekken : []){
    if (p?.soort !== 'kleedkamer') continue;
    const s = String(p.naam || '').toLowerCase().replace(/t\/m|tot en met|tot|[–—]/g, '-');
    for (const m of s.match(/\d+\s*-\s*\d+|\d+/g) || []){
      const r = m.split('-').map(x => parseInt(x, 10));
      if (r.length === 2 && r[1] >= r[0] && r[1] - r[0] < 40) for (let n = r[0]; n <= r[1]; n++) nrs.add(n); else nrs.add(r[0]);
    }
  }
  const lijst = nrs.size ? [...nrs].sort((a, b) => a - b).slice(0, 40) : Array.from({ length: standaard }, (_, i) => i + 1);
  return lijst.map(n => ({ id: `k${n}`, naam: `Kleedkamer ${n}` }));
}

/* ---------- tekenen op de luchtfoto [20261124v] ----------
   Wat de club zelf op de kaart van het sportpark zet. Een vlak heeft een midden (lat, lon) en een maat
   in meters (b oost-west, h noord-zuid); een punt alleen een plek. */
export const SOORTEN = {
  parkeren:    { naam: 'Parkeren',         kort: 'P',  vlak: true,  kleur: '#3b82c4' },
  fietsen:     { naam: 'Fietsenstalling',  kort: 'F',  vlak: true,  kleur: '#16a3a3' },
  kantine:     { naam: 'Kantine',          kort: 'K',  vlak: true,  kleur: '#d08a1e' },
  kleedkamers: { naam: 'Kleedkamers',      kort: 'KK', vlak: true,  kleur: '#8e5cc4' },
  materiaal:   { naam: 'Materiaalhok',     kort: 'M',  vlak: true,  kleur: '#6b7280' },
  tribune:     { naam: 'Tribune',          kort: 'T',  vlak: true,  kleur: '#c0532b' },
  ingang:      { naam: 'Ingang',           kort: 'I',  vlak: false, kleur: '#2f9e63' },
  aed:         { naam: 'AED',              kort: '+',  vlak: false, kleur: '#d63a32' },
  overig:      { naam: 'Overig',           kort: '•',  vlak: false, kleur: '#4b5563' },
};
export const MAX_OBJECTEN = 60;
export function schoonObject(o, i = 0){
  if (!o || typeof o !== 'object' || !SOORTEN[o.soort]) return null;
  const lat = Number(o.lat), lon = Number(o.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const id = /^[A-Za-z0-9_-]{1,20}$/.test(String(o.id || '')) ? String(o.id) : `o${i + 1}`;
  const naam = String(o.naam || '').trim().slice(0, 40) || SOORTEN[o.soort].naam;
  const r = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
  const uit = { id, soort: o.soort, naam, lat: r(lat, 7), lon: r(lon, 7) };
  if (SOORTEN[o.soort].vlak){
    const b = Number(o.b), h = Number(o.h);
    if (!(b >= 2 && b <= 500 && h >= 2 && h <= 500)) return null;
    uit.b = r(b, 1); uit.h = r(h, 1);
  }
  return uit;
}
export function schoonObjecten(lijst){
  const ids = new Set(), uit = [];
  for (const [i, o] of (Array.isArray(lijst) ? lijst : []).entries()){
    const s = schoonObject(o, i);
    if (s && !ids.has(s.id) && uit.length < MAX_OBJECTEN){ ids.add(s.id); uit.push(s); }
  }
  return uit;
}
/* Meters tussen twee punten (x oost, y zuid) en terug: genoeg voor een sportpark. */
export const meterTussen = (a, b) => ({ x: (b.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180), y: -(b.lat - a.lat) * 110540 });
export const verschuif = (p, dx, dy) => ({ lat: p.lat - dy / 110540, lon: p.lon + dx / (111320 * Math.cos(p.lat * Math.PI / 180)) });
/* Een vlak uit twee hoeken (zoals je het op de kaart trekt). */
export function vlakUitHoeken(a, b){
  const d = meterTussen(a, b);
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2, b: Math.abs(d.x), h: Math.abs(d.y) };
}
