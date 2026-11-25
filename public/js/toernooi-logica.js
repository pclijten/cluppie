/* ==================== TOERNOOIPLANNER: REKENWERK [20261125n] ====================
   Puur rekenwerk voor de toernooiplanner in Activiteiten (tab Toernooi). Geen Firebase, geen DOM;
   getest in tests/toernooi.test.mjs.

   Datamodel (veld `toernooi` in clubs/{clubId}/activiteiten/{actId}; maps met ids zodat twee
   comitéleden tegelijk kunnen werken):
     { start:'09:00', duur:12, wissel:3, rust:true, groepOp:['team'], grootte:7,
       velden:  { vId: { naam, clubVeld, delen:1|2|4, volg } },
       kk:      { kId: { naam, plekken, volg } },
       poules:  { pId: { naam, kleur, volg, velden:[veldjeId], start, dubbel, finale } },
       clubs:   { cId: { naam, volg } },                                verenigingen (ook de eigen club)
       mededelingen: { mId: { tekst, ms } }, liveId, live:true|false,
       teams:   { tId: { naam, poule, club, volg, gast, kk, eisen:{ geslacht:''|'m'|'v', van, tot, bron:[eigen teamnaam] } } },
       spelers: { sId: { naam, jaar, geslacht, bron, tt } },          tt = toernooiteam
       schema:  [{ id, p, a, b, v, t, r, fase }],                    gegenereerd, in één keer geschreven
       uitslag: { wedId: { a, b } } }
   Spelers: alleen naam, geboortejaar, geslacht en eigen team. Geen adressen of telefoonnummers. */

export const MAX = { velden: 16, kk: 30, poules: 24, teams: 160, spelers: 1200, schema: 900 };
export const KLEUREN = ['#E20613', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d'];
export const GESLACHT = { m: 'Jongens', v: 'Meisjes', '': 'Gemengd' };
export const GROEP_OP = { team: 'Eigen team', jaar: 'Geboortejaar', leeftijd: 'Leeftijdsgroep (2 jaar)', geslacht: 'Geslacht' };
const LETTERS = 'ABCD';

export const nieuwId = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const naarMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };
export const naarTijd = n => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(Math.round(n) % 60).padStart(2, '0')}`;
const tekst = (v, max = 60) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const getal = (v, d, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d; };
export const gesorteerd = map => Object.entries(map || {}).filter(([, x]) => x && typeof x === 'object')
  .map(([id, x]) => ({ ...x, id })).sort((a, b) => (a.volg ?? 0) - (b.volg ?? 0) || String(a.naam || '').localeCompare(String(b.naam || ''), 'nl', { numeric: true }));
export const volgende = map => Object.values(map || {}).reduce((m, x) => Math.max(m, Number(x?.volg) || 0), 0) + 1;

/* ---------- instellingen ---------- */
export function opzet(t = {}){
  return {
    start: naarMin(t.start) != null ? t.start : '09:00',
    duur: getal(t.duur, 12, 4, 90), wissel: getal(t.wissel, 3, 0, 30), rust: t.rust !== false,
    groepOp: Array.isArray(t.groepOp) ? t.groepOp.filter(g => GROEP_OP[g]) : ['team'],
    grootte: getal(t.grootte, 7, 2, 18),
  };
}
export const slot = t => { const o = opzet(t); return o.duur + o.wissel; };

/* Elk veld kan in 1, 2 of 4 veldjes (A, B, C, D). */
export function veldjes(t = {}){
  const uit = [];
  for (const v of gesorteerd(t.velden)){
    const n = [1, 2, 4].includes(Number(v.delen)) ? Number(v.delen) : 1;
    for (let i = 0; i < n; i++) uit.push({ id: n === 1 ? v.id : `${v.id}~${LETTERS[i]}`, naam: n === 1 ? (v.naam || 'Veld') : `${v.naam || 'Veld'} ${LETTERS[i]}`, veld: v.id, clubVeld: v.clubVeld || '' });
  }
  return uit;
}

/* ---------- spelers ---------- */
export function geslachtUit(v){
  const s = String(v || '').trim().toLowerCase();
  if (/^(v|f|meisje|meisjes|meid|meiden|vrouw|female|girl|dame)\b/.test(s)) return 'v';
  if (/^(m|j|jongen|jongens|man|male|boy|heer)\b/.test(s)) return 'm';
  return '';
}
export function jaarUit(v){
  const s = String(v ?? '').trim();
  let m = /^(\d{4})$/.exec(s); if (m) return Number(m[1]);
  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s); if (m) return Number(m[3]);
  m = /^(\d{4})-\d{2}-\d{2}/.exec(s); if (m) return Number(m[1]);
  return null;
}
export function schoonSpeler(x = {}){
  const jaar = jaarUit(x.jaar);
  return { naam: tekst(x.naam, 48), jaar: jaar && jaar > 1940 && jaar < 2100 ? jaar : null, geslacht: ['m', 'v'].includes(x.geslacht) ? x.geslacht : '', bron: tekst(x.bron, 40), tt: tekst(x.tt, 40) };
}

/* CSV of geplakt uit Excel. Kolommen worden herkend op naam (Naam / Voornaam + Achternaam, Geboortedatum /
   Geboortejaar / Leeftijd, Geslacht, Team / Elftal / Categorie). Geeft { spelers, fouten, kolommen }. */
export function spelersUitRijen(rijen, { datum = '' } = {}){
  rijen = (rijen || []).filter(r => r.some(c => String(c).trim()));
  if (!rijen.length) return { spelers: [], fouten: ['Geen regels gevonden.'], kolommen: {} };
  const kop = rijen[0].map(c => String(c).trim().toLowerCase());
  const zoek = (...namen) => kop.findIndex(k => namen.some(n => k === n || k.startsWith(n)));
  const k = {
    naam: zoek('naam', 'name', 'speler', 'volledige naam', 'roepnaam'), voor: zoek('voornaam', 'roepnaam', 'first'), tussen: zoek('tussenvoegsel', 'tussenv'),
    achter: zoek('achternaam', 'last', 'familienaam'), jaar: zoek('geboortedatum', 'geboortejaar', 'geb', 'jaar', 'birth'), leeftijd: zoek('leeftijd', 'age'),
    geslacht: zoek('geslacht', 'gender', 'm/v', 'sekse'), bron: zoek('team', 'elftal', 'categorie', 'groep', 'klas'),
  };
  if (k.voor >= 0 && k.naam === k.voor) k.naam = -1;
  const heeftKop = Object.values(k).some(i => i >= 0);
  const data = heeftKop ? rijen.slice(1) : rijen;
  if (!heeftKop){ k.naam = 0; k.jaar = 1; k.geslacht = 2; k.bron = 3; }
  const ref = Number(String(datum).slice(0, 4)) || new Date().getFullYear();
  const spelers = [], fouten = [];
  data.forEach((r, i) => {
    const cel = j => j >= 0 ? String(r[j] ?? '').trim() : '';
    const naam = cel(k.naam) || [cel(k.voor), cel(k.tussen), cel(k.achter)].filter(Boolean).join(' ');
    if (!naam){ fouten.push(`Regel ${i + (heeftKop ? 2 : 1)}: geen naam`); return; }
    let jaar = jaarUit(cel(k.jaar));
    if (!jaar && cel(k.leeftijd) && /^\d{1,2}$/.test(cel(k.leeftijd))) jaar = ref - Number(cel(k.leeftijd));
    spelers.push(schoonSpeler({ naam, jaar, geslacht: geslachtUit(cel(k.geslacht)), bron: cel(k.bron) }));
  });
  return { spelers, fouten, kolommen: Object.fromEntries(Object.entries(k).filter(([, i]) => i >= 0).map(([n, i]) => [n, rijen[0][i] ?? `kolom ${i + 1}`])) };
}

/* Dubbelen (zelfde naam en jaar) niet nog eens toevoegen. */
export function nieuweSpelers(bestaand, lijst){
  const al = new Set(Object.values(bestaand || {}).map(s => `${String(s.naam).toLowerCase()}|${s.jaar || ''}`));
  return lijst.filter(s => { const k = `${String(s.naam).toLowerCase()}|${s.jaar || ''}`; if (al.has(k)) return false; al.add(k); return true; });
}

/* ---------- wie mag bij welk team ---------- */
export function magInTeam(sp, team){
  const e = team?.eisen || {}, r = [];
  if (e.geslacht && sp.geslacht && sp.geslacht !== e.geslacht) r.push(e.geslacht === 'v' ? 'alleen meisjes' : 'alleen jongens');
  if (e.geslacht && !sp.geslacht) r.push('geslacht onbekend');
  if (e.van && sp.jaar && sp.jaar < e.van) r.push(`te oud (vanaf ${e.van})`);
  if (e.tot && sp.jaar && sp.jaar > e.tot) r.push(`te jong (tot en met ${e.tot})`);
  if ((e.van || e.tot) && !sp.jaar) r.push('geboortejaar onbekend');
  if (Array.isArray(e.bron) && e.bron.length && !e.bron.includes(sp.bron)) r.push('ander team');
  return r;
}
export function eisTekst(e = {}){
  return [e.geslacht ? GESLACHT[e.geslacht] : '', e.van && e.tot ? (e.van === e.tot ? `${e.van}` : `${e.van}–${e.tot}`) : e.van ? `vanaf ${e.van}` : e.tot ? `t/m ${e.tot}` : '',
    Array.isArray(e.bron) && e.bron.length ? e.bron.join(', ') : ''].filter(Boolean).join(' · ') || 'Iedereen';
}
export function controleerTeams(t = {}){
  const teams = t.teams || {}, uit = [];
  for (const [sid, sp] of Object.entries(t.spelers || {})){
    if (!sp?.tt) continue;
    const team = teams[sp.tt];
    if (!team){ uit.push({ speler: sid, team: sp.tt, reden: ['team bestaat niet meer'] }); continue; }
    const r = magInTeam(sp, team); if (r.length) uit.push({ speler: sid, team: sp.tt, reden: r });
  }
  return uit;
}

/* Sleutel om spelers te groeperen voor het voorstel. */
export function groepSleutel(sp, groepOp = ['team']){
  return groepOp.map(g => g === 'team' ? (sp.bron || 'Zonder team') : g === 'jaar' ? (sp.jaar || '?') : g === 'leeftijd' ? (sp.jaar ? `${sp.jaar - (sp.jaar % 2)}/${sp.jaar - (sp.jaar % 2) + 1}` : '?') : g === 'geslacht' ? (GESLACHT[sp.geslacht] || 'Onbekend') : '').join(' · ') || 'Alle spelers';
}

/* Voorstel: groepeer de spelers (die nog geen team hebben, of allemaal) en verdeel elke groep in teams van
   ongeveer `grootte`. Binnen een groep om en om (gesorteerd op jaar), zodat de teams even sterk/oud zijn.
   Geeft [{ naam, sleutel, spelers:[id], eisen }]. */
export function voorstelTeams(spelers, { groepOp = ['team'], grootte = 7, alleenVrij = true } = {}){
  const lijst = Object.entries(spelers || {}).map(([id, s]) => ({ id, ...s })).filter(s => !alleenVrij || !s.tt);
  const groepen = new Map();
  for (const s of lijst){ const k = groepSleutel(s, groepOp); if (!groepen.has(k)) groepen.set(k, []); groepen.get(k).push(s); }
  const uit = [];
  for (const [k, sp] of [...groepen.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'nl', { numeric: true }))){
    const n = Math.max(1, Math.round(sp.length / Math.max(2, grootte)));
    const teams = Array.from({ length: n }, () => []);
    sp.sort((a, b) => (a.jaar || 0) - (b.jaar || 0) || String(a.naam).localeCompare(String(b.naam), 'nl'))
      .forEach((s, i) => { const ronde = Math.floor(i / n), p = i % n; teams[ronde % 2 ? n - 1 - p : p].push(s); });
    teams.forEach((tm, i) => {
      const jaren = tm.map(s => s.jaar).filter(Boolean), gs = new Set(tm.map(s => s.geslacht));
      const bron = groepOp.includes('team') ? [...new Set(tm.map(s => s.bron).filter(Boolean))] : [];
      uit.push({ naam: n > 1 ? `${k} ${i + 1}` : k, sleutel: k, spelers: tm.map(s => s.id),
        eisen: { geslacht: groepOp.includes('geslacht') && gs.size === 1 ? [...gs][0] : '', van: groepOp.some(g => g === 'jaar' || g === 'leeftijd') && jaren.length ? Math.min(...jaren) : null, tot: groepOp.some(g => g === 'jaar' || g === 'leeftijd') && jaren.length ? Math.max(...jaren) : null, bron } });
    });
  }
  return uit;
}

/* ---------- schema ---------- */
/* Iedereen tegen iedereen (cirkelmethode). Geeft rondes: [[ [a,b], … ], …]. */
export function rondes(teamIds, dubbel = false){
  const ids = [...teamIds]; if (ids.length < 2) return [];
  if (ids.length % 2) ids.push(null);
  const n = ids.length, uit = [];
  for (let r = 0; r < n - 1; r++){
    const ronde = [];
    for (let i = 0; i < n / 2; i++){
      const a = ids[i], b = ids[n - 1 - i];
      if (a && b) ronde.push(r % 2 ? [b, a] : [a, b]);
    }
    uit.push(ronde);
    ids.splice(1, 0, ids.pop());
  }
  return dubbel ? [...uit, ...uit.map(r => r.map(([a, b]) => [b, a]))] : uit;
}

/* Plan alle poules over de veldjes. Elke tijdstap (duur + wissel) krijgt elk veldje één wedstrijd uit een
   poule die dat veldje mag gebruiken. Een team speelt nooit twee keer tegelijk en (als rust aan staat) liefst
   niet twee keer achter elkaar. Poules met de meeste wedstrijden over gaan voor.
   Geeft { schema, eind, waarschuwingen }. */
export function planSchema(t = {}){
  const o = opzet(t), stap = o.duur + o.wissel, begin = naarMin(o.start);
  const vj = veldjes(t), poules = gesorteerd(t.poules), teams = t.teams || {};
  const waarschuwingen = [];
  if (!vj.length) return { schema: [], eind: o.start, waarschuwingen: ['Kies eerst de velden.'] };
  const rij = new Map();
  for (const p of poules){
    const ids = Object.entries(teams).filter(([, x]) => x?.poule === p.id).sort((a, b) => (a[1].volg ?? 0) - (b[1].volg ?? 0)).map(([id]) => id);
    if (ids.length < 2){ if (ids.length) waarschuwingen.push(`${p.naam}: minstens twee teams nodig.`); continue; }
    const r = rondes(ids, !!p.dubbel);
    const mag = (Array.isArray(p.velden) && p.velden.length ? p.velden : vj.map(v => v.id)).filter(id => vj.some(v => v.id === id));
    if (!mag.length){ waarschuwingen.push(`${p.naam}: geen velden gekozen.`); continue; }
    rij.set(p.id, { p, mag: new Set(mag), wachtrij: r.flatMap((ronde, ri) => ronde.map(([a, b]) => ({ a, b, r: ri + 1 }))), startMin: naarMin(p.start) ?? begin });
  }
  const schema = [], laatst = new Map();
  let s = 0;
  const nogIets = () => [...rij.values()].some(x => x.wachtrij.length);
  while (nogIets() && s < 400 && schema.length < MAX.schema){
    const tijd = begin + s * stap, bezig = new Set();
    for (const v of vj){
      const kandidaten = [...rij.values()].filter(x => x.wachtrij.length && x.mag.has(v.id) && x.startMin <= tijd)
        .sort((x, y) => y.wachtrij.length / y.mag.size - x.wachtrij.length / x.mag.size);
      let gekozen = null;
      for (const strikt of o.rust ? [true, false] : [false]){
        for (const x of kandidaten){
          const i = x.wachtrij.findIndex(w => !bezig.has(w.a) && !bezig.has(w.b) && (!strikt || (laatst.get(w.a) !== s - 1 && laatst.get(w.b) !== s - 1)));
          if (i >= 0){ gekozen = { x, w: x.wachtrij.splice(i, 1)[0] }; break; }
        }
        if (gekozen) break;
      }
      if (!gekozen) continue;
      const { x, w } = gekozen;
      bezig.add(w.a); bezig.add(w.b); laatst.set(w.a, s); laatst.set(w.b, s);
      schema.push({ id: `w${schema.length + 1}`, p: x.p.id, a: w.a, b: w.b, v: v.id, t: naarTijd(tijd), r: w.r, fase: 'poule' });
    }
    s++;
  }
  if (nogIets()) waarschuwingen.push('Niet alles past: te veel wedstrijden voor de velden.');
  const eind = schema.length ? naarTijd(Math.max(...schema.map(w => naarMin(w.t))) + o.duur) : o.start;
  return { schema, eind, waarschuwingen };
}

/* Achter elkaar spelen en wachttijden per team, voor een eerlijk schema. */
export function teamRooster(t = {}){
  const o = opzet(t), uit = {};
  for (const w of t.schema || []){
    for (const id of [w.a, w.b]){ (uit[id] ||= []).push(w); }
  }
  return Object.fromEntries(Object.entries(uit).map(([id, ws]) => {
    ws.sort((x, y) => naarMin(x.t) - naarMin(y.t));
    const tijden = ws.map(w => naarMin(w.t)), stap = o.duur + o.wissel;
    let achterElkaar = 0, langsteWacht = 0;
    for (let i = 1; i < tijden.length; i++){ const g = tijden[i] - tijden[i - 1]; if (g <= stap) achterElkaar++; langsteWacht = Math.max(langsteWacht, g - o.duur); }
    return [id, { wedstrijden: ws, eerste: ws[0]?.t || '', laatste: ws.length ? naarTijd(tijden[tijden.length - 1] + o.duur) : '', achterElkaar, langsteWacht }];
  }));
}

/* Wissel twee wedstrijden van plek (tijd + veld), of zet er één op een vrije plek. Controleert dubbel spelen. */
export function verplaats(schema, wedId, { t, v }){
  const lijst = (schema || []).map(w => ({ ...w })), w = lijst.find(x => x.id === wedId);
  if (!w) return { schema: lijst, fout: 'Wedstrijd niet gevonden' };
  const ander = lijst.find(x => x.id !== wedId && x.t === t && x.v === v);
  const oud = { t: w.t, v: w.v };
  w.t = t; w.v = v; if (ander){ ander.t = oud.t; ander.v = oud.v; }
  for (const x of [w, ander].filter(Boolean)){
    const tegelijk = lijst.filter(y => y.id !== x.id && y.t === x.t && [y.a, y.b].some(id => id === x.a || id === x.b));
    if (tegelijk.length) return { schema: lijst, fout: 'Dan speelt een team twee wedstrijden tegelijk.' };
  }
  return { schema: lijst, fout: '' };
}

/* ---------- kleedkamers ---------- */
/* Teams krijgen een kleedkamer van `voor` minuten vóór hun eerste tot `na` minuten na hun laatste wedstrijd.
   Een kleedkamer heeft `plekken` teams tegelijk. Handmatig gekozen (team.kk) blijft staan.
   Geeft { kk: { teamId: kkId }, tekort: [teamId], drukte: { kkId: max } }. */
export function planKleedkamers(t = {}, { voor = 30, na = 20 } = {}){
  const kks = gesorteerd(t.kk), rooster = teamRooster(t), o = opzet(t);
  const venster = id => { const r = rooster[id]; return r ? [naarMin(r.eerste) - voor, naarMin(r.laatste) + na] : null; };
  const bezet = Object.fromEntries(kks.map(k => [k.id, []]));
  const uit = {}, tekort = [];
  const past = (kId, [b, e]) => bezet[kId] && bezet[kId].filter(([x, y]) => x < e && b < y).length < Math.max(1, Number(kks.find(k => k.id === kId)?.plekken) || 2);
  const teams = Object.entries(t.teams || {}).filter(([id]) => rooster[id]);
  for (const [id, tm] of teams){ const vs = venster(id); if (tm.kk && bezet[tm.kk] && vs){ bezet[tm.kk].push(vs); uit[id] = tm.kk; } }
  for (const [id] of teams.filter(([id, tm]) => !uit[id]).sort((a, b) => naarMin(rooster[a[0]].eerste) - naarMin(rooster[b[0]].eerste))){
    const vs = venster(id);
    const k = kks.find(k => past(k.id, vs));
    if (k){ bezet[k.id].push(vs); uit[id] = k.id; } else tekort.push(id);
  }
  const drukte = Object.fromEntries(Object.entries(bezet).map(([k, l]) => [k, l.reduce((m, [b]) => Math.max(m, l.filter(([x, y]) => x <= b && b < y).length), 0)]));
  return { kk: uit, tekort, drukte, duur: o.duur };
}

/* ---------- velden van de club ---------- */
/* Trainingen of andere blokken uit de Veldplanner die op die dag en tijd op een gekozen veld staan. */
export function veldConflicten(blokken, { datum, van, tot, velden }){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum || ''))) return [];
  const dag = ((new Date(datum + 'T12:00').getDay() + 6) % 7) + 1, b1 = naarMin(van), e1 = naarMin(tot);
  const set = new Set(velden || []);
  return (blokken || []).filter(b => b && Number(b.dag) === dag && set.has(String(b.veld)) && naarMin(b.start) < e1 && b1 < naarMin(b.eind));
}

/* ---------- uitslagen en stand ---------- */
export function stand(t = {}, pouleId){
  const rijen = {};
  for (const [id, tm] of Object.entries(t.teams || {})) if (tm?.poule === pouleId) rijen[id] = { id, naam: tm.naam, g: 0, w: 0, gl: 0, v: 0, voor: 0, tegen: 0, pnt: 0 };
  for (const w of t.schema || []){
    if (w.p !== pouleId || w.fase !== 'poule') continue;
    const u = t.uitslag?.[w.id]; if (!u || !Number.isFinite(Number(u.a)) || !Number.isFinite(Number(u.b)) || u.a === '' || u.b === '' || u.a == null || u.b == null) continue;
    const a = rijen[w.a], b = rijen[w.b]; if (!a || !b) continue;
    const sa = Number(u.a), sb = Number(u.b);
    a.g++; b.g++; a.voor += sa; a.tegen += sb; b.voor += sb; b.tegen += sa;
    if (sa > sb){ a.w++; b.v++; a.pnt += 3; } else if (sb > sa){ b.w++; a.v++; b.pnt += 3; } else { a.gl++; b.gl++; a.pnt++; b.pnt++; }
  }
  return Object.values(rijen).map(r => ({ ...r, saldo: r.voor - r.tegen }))
    .sort((x, y) => y.pnt - x.pnt || y.saldo - x.saldo || y.voor - x.voor || String(x.naam).localeCompare(String(y.naam), 'nl', { numeric: true }));
}
export const gespeeld = t => (t.schema || []).filter(w => { const u = t.uitslag?.[w.id]; return u && u.a !== '' && u.b !== '' && u.a != null && u.b != null; }).length;

/* ---------- export ---------- */
const csvCel = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (kop, rijen) => '﻿' + [kop, ...rijen].map(r => r.map(csvCel).join(';')).join('\r\n');
export function csvSchema(t = {}){
  const vn = Object.fromEntries(veldjes(t).map(v => [v.id, v.naam])), tn = id => t.teams?.[id]?.naam || '?', pn = id => t.poules?.[id]?.naam || '';
  return csv(['Tijd', 'Veld', 'Poule', 'Thuis', 'Uit', 'Uitslag'], [...(t.schema || [])].sort((a, b) => naarMin(a.t) - naarMin(b.t) || String(vn[a.v]).localeCompare(String(vn[b.v]), 'nl', { numeric: true }))
    .map(w => { const u = t.uitslag?.[w.id]; return [w.t, vn[w.v] || '', pn(w.p), tn(w.a), tn(w.b), u && u.a != null && u.b != null && u.a !== '' ? `${u.a}-${u.b}` : '']; }));
}
export function csvTeams(t = {}){
  const kk = planKleedkamers(t).kk, kn = id => t.kk?.[id]?.naam || '';
  return csv(['Team', 'Vereniging', 'Poule', 'Kleedkamer', 'Speler', 'Geboortejaar', 'Geslacht', 'Eigen team'],
    gesorteerd(t.teams).flatMap(tm => {
      const sp = Object.values(t.spelers || {}).filter(s => s.tt === tm.id);
      const basis = [tm.naam, t.clubs?.[tm.club]?.naam || '', t.poules?.[tm.poule]?.naam || '', kn(tm.kk || kk[tm.id])];
      return sp.length ? sp.map(s => [...basis, s.naam, s.jaar || '', s.geslacht ? GESLACHT[s.geslacht] : '', s.bron || '']) : [[...basis, '', '', '', '']];
    }));
}
export function csvStand(t = {}){
  return csv(['Poule', 'Plaats', 'Team', 'Gespeeld', 'Winst', 'Gelijk', 'Verlies', 'Voor', 'Tegen', 'Saldo', 'Punten'],
    gesorteerd(t.poules).flatMap(p => stand(t, p.id).map((r, i) => [p.naam, i + 1, r.naam, r.g, r.w, r.gl, r.v, r.voor, r.tegen, r.saldo, r.pnt])));
}

/* ---------- verenigingen ---------- */
/* Geplakte regels "Vereniging · Team · Poule" (tab, puntkomma of komma). Team mag leeg: dan heet het team als de club.
   Geeft [{ club, team, poule }]. */
export function teamsUitRijen(rijen){
  rijen = (rijen || []).map(r => r.map(c => String(c ?? '').trim())).filter(r => r.some(Boolean));
  if (rijen.length && /^(vereniging|club|naam)/i.test(rijen[0][0]) && /^(team|elftal|poule)?/i.test(rijen[0][1] || '') && /team|elftal|vereniging|club/i.test(rijen[0].join(' '))) rijen = rijen.slice(1);
  return rijen.map(r => ({ club: tekst(r[0], 40), team: tekst(r[1] || r[0], 40), poule: tekst(r[2] || '', 40) })).filter(x => x.club);
}
export const clubVanTeam = (t, teamId) => t.clubs?.[t.teams?.[teamId]?.club]?.naam || '';

/* ---------- live pagina ---------- */
export const MAX_MEDEDELINGEN = 30;
/* Sponsoren en eigen schermen voor de live pagina en de tv. Het plaatje is een klein gemaakte
   data-URL (zie activiteit-toernooi.js), zodat het in het document past en zonder account te zien is. */
export const MAX_SCHERMEN = 12, MAX_PLAATJE = 70000;
export const plaatjeOk = v => typeof v === 'string' && v.length <= MAX_PLAATJE && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
export const veiligeLink = v => { const u = String(v ?? '').trim().slice(0, 200); if (!u) return ''; const m = /^https?:\/\//i.test(u) ? u : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) ? 'https://' + u : ''; return /["'<>\s]/.test(m) ? '' : m; };
export function schermen(t, { leeg = false } = {}){
  return gesorteerd(t?.schermen).map(x => ({ id: x.id, soort: x.soort === 'sponsor' ? 'sponsor' : 'scherm', titel: tekst(x.titel, 60), tekst: tekst(x.tekst, 240), link: veiligeLink(x.link), img: plaatjeOk(x.img) ? x.img : '', tv: x.tv !== false, tel: x.tel !== false }))
    .filter(x => leeg || x.titel || x.tekst || x.img).slice(0, MAX_SCHERMEN);
}
export const liveId = () => Array.from({ length: 20 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
/* Wat iedereen met de link ziet: schema, uitslagen, stand, kleedkamers en mededelingen. Geen spelers. */
export function liveKopie(act = {}, { clubNaam = '' } = {}){
  const t = act.toernooi || {}, o = opzet(t), kk = planKleedkamers(t).kk;
  return {
    naam: tekst(act.naam, 80), datum: act.datum || '', locatie: tekst(act.locatie, 80), clubNaam: tekst(clubNaam, 80),
    start: o.start, duur: o.duur, wissel: o.wissel,
    veldjes: veldjes(t).map(v => ({ id: v.id, naam: v.naam })),
    poules: Object.fromEntries(gesorteerd(t.poules).map(p => [p.id, { naam: tekst(p.naam, 40), kleur: /^#[0-9a-f]{6}$/i.test(p.kleur || '') ? p.kleur : '#999999', volg: p.volg ?? 0 }])),
    teams: Object.fromEntries(gesorteerd(t.teams).map(tm => [tm.id, { naam: tekst(tm.naam, 40), poule: tm.poule || '', club: tekst(clubVanTeam(t, tm.id), 40), kk: tekst(t.kk?.[tm.kk || kk[tm.id]]?.naam || '', 40), volg: tm.volg ?? 0 }])),
    schema: (t.schema || []).slice(0, MAX.schema).map(w => ({ id: w.id, p: w.p, a: w.a, b: w.b, v: w.v, t: w.t, fase: w.fase || 'poule' })),
    uitslag: Object.fromEntries(Object.entries(t.uitslag || {}).filter(([, u]) => u && u.a != null && u.b != null && u.a !== '' && u.b !== '').map(([id, u]) => [id, { a: Number(u.a), b: Number(u.b) }])),
    mededelingen: mededelingen(t),
    schermen: schermen(t),
    planB: act.planB?.actief === true ? tekst(act.planB.tekst, 300) : '',
  };
}
export const mededelingen = t => Object.entries(t?.mededelingen || {}).filter(([, m]) => m && m.tekst).map(([id, m]) => ({ id, tekst: String(m.tekst).slice(0, 280), ms: Number(m.ms) || 0 }))
  .sort((a, b) => b.ms - a.ms).slice(0, MAX_MEDEDELINGEN);
/* Welke wedstrijden lopen nu, welke komen hierna? nuMin = minuten sinds middernacht. */
export function nuEnStraks(live = {}, nuMin){
  const duur = Number(live.duur) || 12, tijden = [...new Set((live.schema || []).map(w => w.t))].sort((a, b) => naarMin(a) - naarMin(b));
  const nuT = [...tijden].reverse().find(x => naarMin(x) <= nuMin && nuMin < naarMin(x) + duur + (Number(live.wissel) || 0)) || '';
  const straksT = tijden.find(x => naarMin(x) > nuMin) || '';
  const van = x => (live.schema || []).filter(w => w.t === x);
  return { nuT, straksT, nu: nuT ? van(nuT) : [], straks: straksT ? van(straksT) : [], klaar: tijden.length > 0 && nuMin >= naarMin(tijden[tijden.length - 1]) + duur, begonnen: tijden.length > 0 && nuMin >= naarMin(tijden[0]) };
}
