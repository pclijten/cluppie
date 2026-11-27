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
export let KK_VOOR = 15;                         // kleedkamer open vóór de training (standaard, instelbaar per club)
export let KK_NA = 20;                           // en na de training
/* [20261127t] De club stelt zelf in hoe lang de kleedkamer voor en na de training van het team is
   (veldplanner/instellingen.kkVoor en kkNa). Alles hieronder rekent met deze waarden. */
export const schoonMinuten = (v, std) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 60 ? n : std; };
export function zetKleedTijden(voor, na){ KK_VOOR = schoonMinuten(voor, 15); KK_NA = schoonMinuten(na, 20); }
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
  const voeg = (soort, dag, ids, tekst, fix, sleutel, wie) => { uit.push({ soort, dag, ids, tekst, fix, sleutel, wie }); };
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
      if (a.team === b.team) voeg('warn', d, [a.id, b.id], `${T(a.team).naam} traint twee keer op dezelfde dag.`, undefined, `twee:${d}:${a.team}`);
      else if (tijd){
        const ca = T(a.team).coaches || [], cb = T(b.team).coaches || [];
        const wie = ca.find(u => cb.includes(u));
        if (wie) voeg('warn', d, [a.id, b.id], `${T(a.team).coachNamen?.[wie] || 'Een trainer'} traint ${T(a.team).naam} en ${T(b.team).naam} tegelijk.`, undefined,
          `coach:${d}:${[a.team, b.team].sort().join('+')}:${wie}`, { uid: wie, naam: T(a.team).coachNamen?.[wie] || 'Een trainer' });
      }
    }
    for (const b of dag){
      const t = T(b.team), v = V(b.veld), k = vakUit(vakken(b.veld), b.vak);
      if (t.bouw === 'onder' && b.eind > ONDER_TOT) voeg('warn', d, [b.id], `${t.naam} (onderbouw) traint tot ${naarTijd(b.eind)}. Advies: uiterlijk ${naarTijd(ONDER_TOT)} klaar.`, undefined, `onder:${d}:${b.team}`);
      if (v.licht === false && b.eind > DONKER) voeg('warn', d, [b.id], `${v.naam} heeft geen licht en ${t.naam} traint tot ${naarTijd(b.eind)}. In de winter is het om 17:00 donker.`, { soort: 'licht', id: b.id }, `licht:${d}:${b.team}`);
      const nodig = NODIG[t.maat] || .25;
      if (deelVan(k) < nodig - EPS) voeg('warn', d, [b.id], `${t.naam} heeft een ${MAAT_NAAM[t.maat]} nodig en staat op ${k.naam.toLowerCase()} (${deelTekst(deelVan(k))}).`, { soort: 'vak', id: b.id }, `vak:${d}:${b.team}`);
      if ((ctx.kleedkamers || []).length && !(b.kk || []).length) voeg('warn', d, [b.id], `${t.naam} heeft nog geen kleedkamer.`, { soort: 'kk', id: b.id }, `geenkk:${d}:${b.team}`);
    }
  }
  /* [20261127u] weggeklikte waarschuwingen (per melding of alle 'tegelijk'-meldingen van één trainer); botsingen blijven altijd staan */
  const trainers = new Set(ctx.negeer?.trainers || []), meldingen = new Set(ctx.negeer?.meldingen || []);
  const lijst = uit.filter(x => x.soort === 'fout' || !((x.wie && trainers.has(x.wie.uid)) || (x.sleutel && meldingen.has(x.sleutel))));
  lijst.forEach(x => x.ids.forEach(id => { if (x.soort === 'fout' || !status[id]) status[id] = x.soort === 'fout' ? 'botsing' : 'waarsch'; }));
  return { lijst, status, genegeerd: uit.length - lijst.length };
}

/* Wat de club heeft weggeklikt: { trainers: [uid], meldingen: [sleutel] } */
export function schoonNegeer(n){
  const lijst = (a, max, lang) => [...new Set((Array.isArray(a) ? a : []).map(String).filter(x => x && x.length <= lang && !/[\s<>]/.test(x)))].slice(0, max);
  return { trainers: lijst(n?.trainers, 100, 128), meldingen: lijst(n?.meldingen, 1000, 200) };
}

/* [20261127u] Een dag kopiëren naar andere dagen. modus 'vervang' maakt de doeldag eerst leeg, 'erbij' voegt toe.
   Uit: nieuw rooster + aantal gekopieerde blokken. */
export function kopieerDag(rooster, van, naar, modus, maakId){
  const bron = rooster.filter(b => b.dag === van), doelen = [...new Set(naar)].filter(d => d >= 1 && d <= 7 && d !== van);
  let uit = modus === 'vervang' ? rooster.filter(b => !doelen.includes(b.dag)) : [...rooster];
  let n = 0;
  for (const d of doelen) for (const b of bron){
    if (uit.length >= MAX_BLOKKEN) break;
    uit.push({ ...b, kk: [...(b.kk || [])], id: maakId(), dag: d }); n++;
  }
  return { rooster: uit, n };
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

/* ---------- tijd typen [20261127v] ----------
   Wat iemand in het Van/Tot-vakje typt: "17:30", "17.30", "17u30", "1730", "930", "9" of "17".
   Uit: minuten na middernacht, of null als het geen tijd is. */
export function leesTijd(s){
  const t = String(s ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/uur$/, '');
  let u, m;
  let r = /^(\d{1,2})[:.,hu](\d{1,2})?$/.exec(t);
  if (r){ u = +r[1]; m = r[2] === undefined ? 0 : r[2].length === 1 ? +r[2] * 10 : +r[2]; }
  else if (/^\d{1,4}$/.test(t)){
    if (t.length <= 2){ u = +t; m = 0; }
    else { u = +t.slice(0, t.length - 2); m = +t.slice(-2); }
  } else return null;
  if (!(u >= 0 && u <= 24 && m >= 0 && m < 60) || (u === 24 && m > 0)) return null;
  return u * 60 + m;
}

/* ---------- overzicht: wie is waar op een moment [20261127v] ---------- */
/* Trainingen die op dag `dag` om minuut `t` bezig zijn. */
export const opMoment = (rooster, dag, t) => rooster.filter(b => b.dag === dag && b.start <= t && t < b.eind);
/* In welke fase zit een team in de kleedkamer om minuut t? 'voor' (omkleden), 'training' (spullen liggen er),
   'na' (douchen), of null (kleedkamer niet van dit team). */
export function kleedFase(b, t){
  if (t < b.start - KK_VOOR || t >= b.eind + KK_NA) return null;
  return t < b.start ? 'voor' : t < b.eind ? 'training' : 'na';
}
/* Per kleedkamer wie hem om minuut t heeft. Uit: { kkId: { blok, fase } } (bij dubbel: de eerste). */
export function kleedkamersOpMoment(rooster, dag, t){
  const uit = {};
  for (const b of [...rooster].filter(x => x.dag === dag).sort((a, c) => a.start - c.start)){
    const f = kleedFase(b, t); if (!f) continue;
    for (const k of b.kk || []) if (!uit[k]) uit[k] = { blok: b, fase: f };
  }
  return uit;
}
/* Drukte door de dag, voor de balk onder het overzicht: per stap het deel van alle velden dat
   bezet is (0–1) en het aantal kleedkamers in gebruik. */
export function drukte(rooster, inst, { dag, van, tot, stap = 5, velden = 1 }){
  const dagB = rooster.filter(b => b.dag === dag), uit = [];
  for (let t = van; t < tot; t += stap){
    let veld = 0; const kk = new Set();
    for (const b of dagB){
      if (b.start <= t && t < b.eind) veld += deelVan(vakUit(vakkenVan(inst?.[b.veld]), b.vak));
      if (kleedFase(b, t)) (b.kk || []).forEach(k => kk.add(k));
    }
    uit.push({ t, veld: Math.min(1, veld / Math.max(1, velden)), kk: kk.size });
  }
  return uit;
}
/* Welke van de vier kwarten van een veld zijn om minuut t (en het kwartier erna) vrij? Uit: vak-ids. */
export function vrijeKwarten(rooster, inst, { dag, veld, t, duur = 15 }){
  return ['av', 'aa', 'bv', 'ba'].filter(id => vakVrij(rooster, inst, { dag, veld, vak: id, start: t, eind: t + duur }));
}
/* Het bereik van de tijdlijnbalk voor een dag: van een kwartier voor de eerste training tot 20 minuten
   na de laatste, op hele uren. Zonder trainingen 16:00–22:00. */
export function dagBereik(rooster, dag){
  const d = rooster.filter(b => b.dag === dag);
  if (!d.length) return [16 * 60, 22 * 60];
  const van = Math.min(...d.map(b => b.start - KK_VOOR)), tot = Math.max(...d.map(b => b.eind + KK_NA));
  return [Math.max(0, Math.floor(van / 60) * 60), Math.min(24 * 60, Math.ceil(tot / 60) * 60)];
}
/* Ligt punt (fx, fy) (fractie van het veld) in vak k? */
export const inVak = (k, fx, fy) => fx >= k.x - EPS && fx <= k.x + k.w + EPS && fy >= k.y - EPS && fy <= k.y + k.h + EPS;

/* ---------- per team: veldmaat, duur en aantal trainingen [20261127t] ----------
   veldplanner/instellingen.teams = { teamId: { maat: 'heel'|'half'|'kwart', duur: minuten, per: keer per week } }.
   Alleen wat de club zelf instelt; zonder instelling rekent de planner het uit de categorie. */
export function schoonTeamInstellingen(obj){
  const uit = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return uit;
  for (const [id, v] of Object.entries(obj).slice(0, 400)){
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(id) || !v || typeof v !== 'object') continue;
    const x = {};
    if (NODIG[v.maat]) x.maat = v.maat;
    const d = Math.round(Number(v.duur) / 5) * 5; if (d >= 30 && d <= 180) x.duur = d;
    const p = Math.round(Number(v.per)); if (Number.isFinite(p) && p >= 0 && p <= 7 && v.per !== '' && v.per != null) x.per = p;
    if (Object.keys(x).length) uit[id] = x;
  }
  return uit;
}

/* ---------- bestaande planning inlezen [20261127t] ----------
   Tekst uit een PDF, Word- of Excelbestand (of geplakt) → trainingen. Eén training per regel of tabelrij:
   een dag (of een kopregel met alleen de dag), een tijd ("18:00-19:15", of alleen het begin), een team, een veld,
   eventueel een deel ("half a", "kwart b voor", "a voor") en kleedkamers ("kk 3", "kleedkamer 2 en 4").
   ctx: { teams: [{id, naam, duur}], velden: [{id, naam}], kleedkamers: [{id, naam}] }
   Uit: { gevonden: [{ team, dag, start, eind, veld, vak|null, kk: [], regel }], overgeslagen: [regel] } */
const DAGWOORD = { maandag: 1, ma: 1, dinsdag: 2, di: 2, woensdag: 3, wo: 3, donderdag: 4, do: 4, vrijdag: 5, vr: 5, zaterdag: 6, za: 6, zondag: 7, zo: 7 };
const teamSleutel = s => String(s || '').toLowerCase().replace(/[\s_.]+/g, '').replace(/^jo(?=\d)/, 'o').replace(/–/g, '-');
const kolomSoort = c => { const l = c.toLowerCase();
  return /^(kleedkamers?|kleedk\.?|kk|kl\.?)$/.test(l) ? 'kk' : /^(veld|velden|veldnr\.?)$/.test(l) ? 'veld' : /^(dag|weekdag)$/.test(l) ? 'dag'
    : /^(team|teams|elftal)$/.test(l) ? 'team' : /^(tijd|van|tot|begin|eind|start)$/.test(l) ? 'tijd' : /^(deel|veldeel|veldmaat|vak)$/.test(l) ? 'deel' : null; };
export function leesPlanning(tekst, ctx){
  const gevonden = [], overgeslagen = [];
  const teams = (ctx.teams || []).map(t => ({ ...t, sl: teamSleutel(t.naam) })).filter(t => t.sl).sort((a, b) => b.sl.length - a.sl.length);
  const velden = ctx.velden || [], kks = ctx.kleedkamers || [];
  let dagNu = null, kolommen = null;
  for (let ruw of String(tekst || '').replace(/\r/g, '').split('\n')){
    /* tabel met kopregel (Excel/Word/CSV): losse getallen onder "Kleedkamer" of "Veld" krijgen dat woord erbij */
    if (ruw.includes('\t')){
      const cellen = ruw.split('\t').map(c => c.trim()), soorten = cellen.map(kolomSoort);
      if (soorten.filter(Boolean).length >= 2 && !/\d[:.]\d{2}/.test(ruw)){ kolommen = soorten; continue; }
      if (kolommen) ruw = cellen.map((c, i) => kolommen[i] === 'kk' && /^\d/.test(c) ? `kk ${c}` : kolommen[i] === 'veld' && /^\d{1,2}\s*[ab]?$/i.test(c) ? `veld ${c}` : kolommen[i] === 'dag' && !c ? '' : c).join('\t');
    } else kolommen = null;
    const regel = ruw.replace(/\s+/g, ' ').trim();
    if (!regel) continue;
    const laag = regel.toLowerCase();
    const dagM = laag.match(/\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo)\b\.?/);
    const tijd = laag.match(/\b(\d{1,2})[:.](\d{2})\s*(?:u(?:ur)?\s*)?(?:-|–|—|tot|t\/m)\s*(\d{1,2})[:.](\d{2})\b/) || laag.match(/\b(\d{1,2})[:.](\d{2})\b/);
    /* team: woorden van de regel tegen de teamnamen (JO11-2 = O11-2) */
    const woorden = laag.split(/[\s|,;\t()/]+/).map(teamSleutel).filter(Boolean);
    const team = teams.find(t => woorden.includes(t.sl)) || teams.find(t => t.sl.length >= 3 && teamSleutel(laag).includes(t.sl));
    if (dagM && !tijd && !team){ dagNu = DAGWOORD[dagM[1]]; continue; }      // kopregel "Maandag"
    if (!tijd || !team){ if (tijd || team) overgeslagen.push(regel); continue; }
    const dag = dagM ? DAGWOORD[dagM[1]] : dagNu;
    if (!dag){ overgeslagen.push(regel); continue; }
    const start = +tijd[1] * 60 + +tijd[2];
    let eind = tijd[3] !== undefined ? +tijd[3] * 60 + +tijd[4] : start + (team.duur || 75);
    if (!(start >= 6 * 60 && eind > start && eind <= 24 * 60)){ overgeslagen.push(regel); continue; }
    /* veld: "veld 2", "v2", of de naam van een veld */
    const vnr = laag.match(/\b(?:veld|v)\s*(\d{1,2})\b/);
    const veld = (vnr && velden.find(v => (String(v.naam).match(/\d+/) || [])[0] === vnr[1]))
      || velden.find(v => v.naam && laag.includes(String(v.naam).toLowerCase()));
    if (!veld){ overgeslagen.push(regel); continue; }
    /* deel van het veld */
    let vak = null;
    const kw = laag.match(/\b(?:kwart\s*)?([ab])\s*[-.]?\s*(voor|achter)\b/);
    const kw2 = !kw && laag.match(/\bkwart\s*([ab])\b/);
    if (kw) vak = kw[1] + (kw[2] === 'voor' ? 'v' : 'a');
    else if (kw2) vak = kw2[1] + 'v';
    else if (/\bheel\b|\bhele veld\b|\bheel veld\b/.test(laag)) vak = 'h';
    else { const h = laag.match(/\b(?:half|helft)\s*([ab])\b/) || laag.match(/\b(?:veld|v)\s*\d{1,2}\s*([ab])\b/) || laag.match(/\b\d{1,2}([ab])\b/); if (h) vak = h[1]; }
    /* kleedkamers: "kk 3", "kleedkamer 2 en 4", "kl. 1" */
    const kk = [];
    for (const m of laag.matchAll(/\b(?:kk|kleedkamers?|kleedk\.?|kl\.?)\s*((?:\d{1,2}\s*(?:,|en|&|\/|\+)?\s*)+)/g))
      for (const n of m[1].match(/\d{1,2}/g) || []){ const k = kks.find(x => (String(x.naam).match(/\d+/) || [])[0] === n); if (k && !kk.includes(k.id)) kk.push(k.id); }
    gevonden.push({ team: team.id, dag, start, eind, veld: veld.id, vak, kk: kk.slice(0, 4), regel });
  }
  return { gevonden, overgeslagen };
}
