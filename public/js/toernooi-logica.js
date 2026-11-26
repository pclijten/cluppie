/* ==================== TOERNOOIPLANNER: REKENWERK [20261125n] ====================
   Puur rekenwerk voor de toernooiplanner in Activiteiten (tab Toernooi). Geen Firebase, geen DOM;
   getest in tests/toernooi.test.mjs.

   Datamodel (veld `toernooi` in clubs/{clubId}/activiteiten/{actId}; maps met ids zodat twee
   comitéleden tegelijk kunnen werken):
     { start:'09:00', duur:12, wissel:3, rust:true, groepOp:['team'], grootte:7,
       velden:  { vId: { naam, clubVeld, delen:1|2|4, volg } },
       kk:      { kId: { naam, plekken, delen:1|2, volg } },               delen 2 = linker- en rechterhelft
       ko:      { gId: { naam, poules:[pId], ronde:2|4|8, plaats3, overige, start, volg } },  knock-out na de poules
       poules:  { pId: { naam, kleur, volg, velden:[veldjeId], start, dubbel, finale } },
       clubs:   { cId: { naam, volg } },                                verenigingen (ook de eigen club)
       mededelingen: { mId: { tekst, ms } }, liveId, live:true|false,
       teams:   { tId: { naam, poule, club, volg, gast, kk, eisen:{ geslacht:''|'m'|'v', van, tot, bron:[eigen teamnaam] } } },
       spelers: { sId: { naam, jaar, geslacht, bron, tt } },          tt = toernooiteam
       schema:  [{ id, p, a, b, v, t, r, fase, ko, ka, kb, nr, plaats }],  gegenereerd; knock-out: a/b leeg, ka/kb = bron
       uitslag: { wedId: { a, b, w } } }                              w = 'a'|'b': winnaar na strafschoppen (knock-out)
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
    eind: naarMin(t.eind) != null ? t.eind : '', prijs: getal(t.prijs, 15, 0, 120), duurVast: t.duurVast === true, autoKo: t.autoKo !== false,
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
   streng [20261127s]: met rust aan nooit twee keer achter elkaar; dan blijft een veldje of een hele ronde liever leeg
   (een rustronde). Alleen als na een lege ronde nog steeds niets past, mag het toch. Duurt langer; autoIndeling
   probeert het eerst zo en neemt het als het binnen de tijd past.
   Geeft { schema, eind, waarschuwingen }. */
export function planSchema(t = {}, { streng = false } = {}){
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
  let s = 0, leegVorige = false;
  const nogIets = () => [...rij.values()].some(x => x.wachtrij.length);
  while (nogIets() && s < 400 && schema.length < MAX.schema){
    const tijd = begin + s * stap, bezig = new Set(), voor = schema.length;
    for (const fase of streng && o.rust ? ['streng', 'los'] : ['gewoon']){
    if (fase === 'los' && (schema.length > voor || !leegVorige)) break;
    for (const v of vj){
      if (schema.some(w => w.t === naarTijd(tijd) && w.v === v.id)) continue;
      const kandidaten = [...rij.values()].filter(x => x.wachtrij.length && x.mag.has(v.id) && x.startMin <= tijd)
        .sort((x, y) => y.wachtrij.length / y.mag.size - x.wachtrij.length / x.mag.size);
      let gekozen = null;
      for (const strikt of fase === 'streng' ? [true] : fase === 'los' ? [false] : o.rust ? [true, false] : [false]){
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
    }
    leegVorige = schema.length === voor;
    s++;
  }
  if (nogIets()) waarschuwingen.push('Niet alles past: te veel wedstrijden voor de velden.');
  planKo(t, schema, { begin, stap, vj, waarschuwingen, rust: o.rust });
  const eind = schema.length ? naarTijd(Math.max(...schema.map(w => naarMin(w.t))) + o.duur) : o.start;
  return { schema, eind, waarschuwingen };
}

/* Achter elkaar spelen en wachttijden per team, voor een eerlijk schema. */
export function teamRooster(t = {}){
  const o = opzet(t), uit = {};
  for (const w of t.schema || []){
    for (const id of [w.a, w.b]) if (id) (uit[id] ||= []).push(w);
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
    const tegelijk = lijst.filter(y => y.id !== x.id && y.t === x.t && [y.a, y.b].some(id => id && (id === x.a || id === x.b)));
    if (tegelijk.length) return { schema: lijst, fout: 'Dan speelt een team twee wedstrijden tegelijk.' };
  }
  return { schema: lijst, fout: '' };
}

/* ---------- kleedkamers ---------- */
/* Teams krijgen een kleedkamer van `voor` minuten vóór hun eerste tot `na` minuten na hun laatste wedstrijd.
   Een kleedkamer heeft `plekken` teams tegelijk. Handmatig gekozen (team.kk) blijft staan.
   Geeft { kk: { teamId: kkId }, tekort: [teamId], drukte: { kkId: max } }. */
export function planKleedkamers(t = {}, { voor = 30, na = 20 } = {}){
  const kks = kkDelen(t), rooster = teamRooster(t), o = opzet(t);
  const venster = id => { const r = rooster[id]; return r ? [naarMin(r.eerste) - voor, naarMin(r.laatste) + na] : null; };
  const bezet = Object.fromEntries(kks.map(k => [k.id, []]));
  const uit = {}, tekort = [];
  const past = (kId, [b, e]) => bezet[kId] && bezet[kId].filter(([x, y]) => x < e && b < y).length < Math.max(1, Number(kks.find(k => k.id === kId)?.plekken) || 2);
  const teams = Object.entries(t.teams || {}).filter(([id]) => rooster[id]);
  for (const [id, tm] of teams){ const vs = venster(id), k = tm.kk && !bezet[tm.kk] && bezet[`${tm.kk}~L`] ? `${tm.kk}~L` : tm.kk; if (k && bezet[k] && vs){ bezet[k].push(vs); uit[id] = k; } }
  for (const [id] of teams.filter(([id, tm]) => !uit[id]).sort((a, b) => naarMin(rooster[a[0]].eerste) - naarMin(rooster[b[0]].eerste))){
    const vs = venster(id);
    const k = kks.find(k => past(k.id, vs));
    if (k){ bezet[k.id].push(vs); uit[id] = k.id; } else tekort.push(id);
  }
  const drukte = Object.fromEntries(Object.entries(bezet).map(([k, l]) => [k, l.reduce((m, [b]) => Math.max(m, l.filter(([x, y]) => x <= b && b < y).length), 0)]));
  for (const k of gesorteerd(t.kk)) if (drukte[k.id] == null) drukte[k.id] = Math.max(0, ...kks.filter(x => x.kk === k.id).map(x => drukte[x.id] || 0));
  return { kk: uit, tekort, drukte, duur: o.duur };
}

/* Een kleedkamer kan in een linker- en rechterhelft (delen: 2). Elke helft is dan een eigen plek in de indeling,
   met `plekken` teams per helft. Id van een helft: `${kkId}~L` of `${kkId}~R`. */
export function kkDelen(t = {}){
  const uit = [];
  for (const k of gesorteerd(t.kk)){
    if (Number(k.delen) === 2) for (const [z, n] of [['L', 'links'], ['R', 'rechts']]) uit.push({ id: `${k.id}~${z}`, kk: k.id, naam: `${k.naam || 'Kleedkamer'} ${n}`, plekken: k.plekken });
    else uit.push({ id: k.id, kk: k.id, naam: k.naam || 'Kleedkamer', plekken: k.plekken });
  }
  return uit;
}
/* Naam van een kleedkamer of helft (team.kk mag een helft zijn; staat de kleedkamer niet meer in helften, dan de hele). */
export function kkNaam(t = {}, id){
  if (!id) return '';
  const [k, z] = String(id).split('~'), x = t.kk?.[k]; if (!x) return '';
  return z && Number(x.delen) === 2 ? `${x.naam || 'Kleedkamer'} ${z === 'L' ? 'links' : 'rechts'}` : String(x.naam || 'Kleedkamer');
}
/* De kleedkamer van een team: zelf gekozen, anders de automatische. */
export const kkVanTeam = (t, teamId, plan) => {
  const eigen = t.teams?.[teamId]?.kk, ok = eigen && kkDelen(t).some(x => x.id === eigen);
  return ok ? eigen : (plan || planKleedkamers(t)).kk[teamId] || '';
};

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
  const ko = Object.fromEntries(metKo(t).filter(w => w.ko).map(w => [w.id, w]));
  return csv(['Tijd', 'Veld', 'Poule', 'Thuis', 'Uit', 'Uitslag'], [...(t.schema || [])].sort((a, b) => naarMin(a.t) - naarMin(b.t) || String(vn[a.v]).localeCompare(String(vn[b.v]), 'nl', { numeric: true }))
    .map(w => { const u = t.uitslag?.[w.id], k = ko[w.id] || w; return [w.t, vn[w.v] || '', w.ko ? koTitel(t, w) : pn(w.p), w.ko ? (tn(k.a) !== '?' ? tn(k.a) : k.la) : tn(w.a), w.ko ? (tn(k.b) !== '?' ? tn(k.b) : k.lb) : tn(w.b), u && u.a != null && u.b != null && u.a !== '' ? `${u.a}-${u.b}${u.w ? ' (' + (u.w === 'a' ? 'thuis' : 'uit') + ' wint na strafschoppen)' : ''}` : '']; }));
}
export function csvTeams(t = {}){
  const plan = planKleedkamers(t);
  return csv(['Team', soortTekst(t).Een, 'Poule', 'Kleedkamer', 'Speler', 'Geboortejaar', 'Geslacht', 'Eigen team'],
    gesorteerd(t.teams).flatMap(tm => {
      const sp = Object.values(t.spelers || {}).filter(s => s.tt === tm.id);
      const basis = [tm.naam, t.clubs?.[tm.club]?.naam || '', t.poules?.[tm.poule]?.naam || '', kkNaam(t, kkVanTeam(t, tm.id, plan))];
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
export const MAX_SCHERMEN = 12;
export const MAX_PLAATJE = 70000;
export const plaatjeOk = v => typeof v === 'string' && v.length <= MAX_PLAATJE && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
export const veiligeLink = v => { const u = String(v ?? '').trim().slice(0, 200); if (!u) return ''; const m = /^https?:\/\//i.test(u) ? u : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) ? 'https://' + u : ''; return /["'<>\s]/.test(m) ? '' : m; };
export function schermen(t, { leeg = false } = {}){
  return gesorteerd(t?.schermen).map(x => ({ id: x.id, soort: x.soort === 'sponsor' ? 'sponsor' : 'scherm', titel: tekst(x.titel, 60), tekst: tekst(x.tekst, 240), link: veiligeLink(x.link), img: plaatjeOk(x.img) ? x.img : '', tv: x.tv !== false, tel: x.tel !== false }))
    .filter(x => leeg || x.titel || x.tekst || x.img).slice(0, MAX_SCHERMEN);
}
export const liveId = () => Array.from({ length: 20 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
/* Wat iedereen met de link ziet: schema, uitslagen, stand, kleedkamers en mededelingen. Geen spelers. */
/* Hoeveel teams per poule door gaan naar de finales (voor de streep in de stand op de live pagina): { pouleId: n } */
export function koDoor(t = {}){
  const uit = {};
  for (const w of t.schema || []) if (w.ko && w.fase !== 'plaats') for (const b of [w.ka, w.kb]) if (b?.p && t.poules?.[b.p]) uit[b.p] = Math.max(uit[b.p] || 0, Number(b.r) || 0);
  return uit;
}
/* logo en clubkleur voor de openbare pagina's (live, tv, inschrijven) */
export const clubUiterlijk = (logo, kleur) => ({ logo: plaatjeOk(logo) ? logo : '', kleur: /^#[0-9a-f]{6}$/i.test(kleur || '') ? kleur : '' });
export function liveKopie(act = {}, { clubNaam = '', logo = '', kleur = '' } = {}){
  const t = act.toernooi || {}, o = opzet(t), plan = planKleedkamers(t);
  return {
    naam: tekst(act.naam, 80), datum: act.datum || '', locatie: tekst(act.locatie, 80), clubNaam: tekst(clubNaam, 80), ...clubUiterlijk(logo, kleur),
    start: o.start, duur: o.duur, wissel: o.wissel,
    veldjes: veldjes(t).map(v => ({ id: v.id, naam: v.naam })),
    poules: Object.fromEntries(gesorteerd(t.poules).map(p => [p.id, { naam: tekst(p.naam, 40), kleur: /^#[0-9a-f]{6}$/i.test(p.kleur || '') ? p.kleur : '#999999', volg: p.volg ?? 0 }])),
    teams: Object.fromEntries(gesorteerd(t.teams).map(tm => [tm.id, { naam: tekst(tm.naam, 40), poule: tm.poule || '', club: tekst(clubVanTeam(t, tm.id), 40), kk: tekst(kkNaam(t, kkVanTeam(t, tm.id, plan)), 40), volg: tm.volg ?? 0 }])),
    schema: metKo(t).slice(0, MAX.schema).map(w => ({ id: w.id, p: w.p, a: w.a || '', b: w.b || '', v: w.v, t: w.t, fase: w.fase || 'poule',
      ...(w.ko ? { ko: w.ko, titel: tekst(koTitel(t, w), 60), la: tekst(w.la, 40), lb: tekst(w.lb, 40) } : {}) })),
    uitslag: Object.fromEntries(Object.entries(t.uitslag || {}).filter(([, u]) => heeftUitslag(u)).map(([id, u]) => [id, { a: Number(u.a), b: Number(u.b), ...(u.w === 'a' || u.w === 'b' ? { w: u.w } : {}) }])),
    mededelingen: mededelingen(t),
    schermen: schermen(t),
    planB: act.planB?.actief === true ? tekst(act.planB.tekst, 300) : '',
    prijs: prijsuitreiking(t),
    door: koDoor(t),
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

/* ---------- wie doen er mee: verenigingen, scholen, bedrijven of vrije teams [20261125w] ---------- */
export const SOORTEN = {
  vereniging: { naam: 'Verenigingen', een: 'vereniging', Een: 'Vereniging', meer: 'verenigingen', team: 'team', vb: 'bv. SV Voorbeeld', teamVb: 'bv. JO11-1' },
  school: { naam: 'Scholen', een: 'school', Een: 'School', meer: 'scholen', team: 'groep of klas', vb: 'bv. De Regenboog', teamVb: 'bv. groep 7a' },
  bedrijf: { naam: 'Bedrijven', een: 'bedrijf', Een: 'Bedrijf', meer: 'bedrijven', team: 'team', vb: 'bv. Bakkerij Jansen', teamVb: 'bv. Team Magazijn' },
  vrij: { naam: 'Vrije teams (straat, buurt, vrienden)', een: 'groep', Een: 'Groep', meer: 'groepen', team: 'team', vb: 'bv. Kerkstraat', teamVb: 'bv. De Kanjers' },
};
export const soort = t => SOORTEN[t?.deelnemers] ? t.deelnemers : 'vereniging';
export const soortTekst = t => SOORTEN[soort(t)];

/* ---------- online inschrijven [20261125w] ----------
   Het comité zet per categorie (leeftijd of niveau) het maximum en het inschrijfgeld. Gastclubs, scholen of bedrijven
   schrijven zelf een team in via de open link (?inschrijf=<id>, inschrijf-boot.js). De openbare kopie bevat geen
   contactgegevens; die staan alleen in de aanmeldingen, die alleen het comité en de inschrijver zelf lezen. */
export const MAX_CATS = 24, MAX_INSCHRIJF = 400;
export const INSCHRIJF_STATUS = { nieuw: 'Nieuw', toegelaten: 'Toegelaten', wachtlijst: 'Wachtlijst', afgewezen: 'Afgewezen' };
export const bedrag = v => { const n = Math.round(Number(String(v ?? '').replace(',', '.')) * 100) / 100; return Number.isFinite(n) && n > 0 && n < 10000 ? n : 0; };
export const euro = n => '€ ' + Number(n || 0).toFixed(2).replace('.', ',').replace(/,00$/, ',-');
export function inschrijfCats(t){
  return gesorteerd(t?.inschrijf?.cats).map(c => ({ id: c.id, naam: tekst(c.naam, 40) || 'Categorie', max: getal(c.max, 0, 0, 200), prijs: bedrag(c.prijs), poule: t?.poules?.[c.poule] ? c.poule : '', volg: c.volg ?? 0 })).slice(0, MAX_CATS);
}
/* bezet per categorie: iedereen behalve afgewezen en wachtlijst telt mee */
export function bezetPerCat(aanmeldingen = []){
  const uit = {};
  for (const a of aanmeldingen) if (a && a.cat && !['afgewezen', 'wachtlijst'].includes(a.status)) uit[a.cat] = (uit[a.cat] || 0) + 1;
  return uit;
}
export function inschrijfKopie(act = {}, { clubNaam = '', bezet = {}, logo = '', kleur = '' } = {}){
  const t = act.toernooi || {}, i = t.inschrijf || {};
  return {
    naam: tekst(act.naam, 80), datum: act.datum || '', start: act.start || '', locatie: tekst(act.locatie, 80), clubNaam: tekst(clubNaam, 80), ...clubUiterlijk(logo, kleur), soort: soort(t),
    tekst: String(i.tekst ?? '').trim().slice(0, 600), tot: /^\d{4}-\d{2}-\d{2}$/.test(i.tot || '') ? i.tot : '',
    contact: tekst(i.contact, 60), contactMail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(i.contactMail || '').trim()) ? String(i.contactMail).trim().slice(0, 120) : '',
    betaal: String(i.betaal ?? '').trim().slice(0, 400), betaalLink: veiligeLink(i.betaalLink),
    cats: Object.fromEntries(inschrijfCats(t).map(c => [c.id, { naam: c.naam, max: c.max, prijs: c.prijs, bezet: Math.max(0, Number(bezet[c.id]) || 0), volg: c.volg }])),
  };
}
export const inschrijvingDicht = (d, vandaag) => !!(d?.tot && vandaag && vandaag > d.tot);
export const catVol = c => !!(c && c.max > 0 && (c.bezet || 0) >= c.max);
/* Wat iemand op de inschrijfpagina invult: opschonen en controleren. Geeft { ok, data } of { fout, veld }. */
export function schoneInschrijving(v = {}, cats = {}){
  const d = { club: tekst(v.club, 60), team: tekst(v.team, 40), cat: String(v.cat || ''), contact: tekst(v.contact, 60), email: String(v.email || '').trim().slice(0, 120), tel: String(v.tel || '').replace(/[^\d+ ()-]/g, '').trim().slice(0, 20), opm: String(v.opm ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) };
  if (!d.club) return { fout: 'Vul de naam in.', veld: 'club' };
  if (!cats[d.cat]) return { fout: 'Kies een categorie.', veld: 'cat' };
  if (!d.contact) return { fout: 'Vul in wie de contactpersoon is.', veld: 'contact' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { fout: 'Vul een geldig e-mailadres in.', veld: 'email' };
  if (!d.team) d.team = d.club.slice(0, 40);
  return { ok: true, data: d };
}
export function csvInschrijvingen(lijst = [], t = {}){
  const cats = Object.fromEntries(inschrijfCats(t).map(c => [c.id, c])), S = soortTekst(t);
  return csv([S.Een, 'Team', 'Categorie', 'Contactpersoon', 'E-mail', 'Telefoon', 'Opmerking', 'Status', 'Inschrijfgeld', 'Betaald', 'Ingeschreven op'],
    [...lijst].sort((a, b) => (a.ms || 0) - (b.ms || 0)).map(a => [a.club, a.team, cats[a.cat]?.naam || '', a.contact, a.email, a.tel || '', a.opm || '', INSCHRIJF_STATUS[a.status] || 'Nieuw', cats[a.cat]?.prijs || 0, a.betaald ? 'ja' : 'nee', a.ms ? new Date(a.ms).toISOString().slice(0, 10) : '']));
}
export function inschrijfTotaal(lijst = [], t = {}){
  const cats = Object.fromEntries(inschrijfCats(t).map(c => [c.id, c])), mee = lijst.filter(a => a.status === 'toegelaten');
  return { n: lijst.length, nieuw: lijst.filter(a => !a.status || a.status === 'nieuw').length, toegelaten: mee.length,
    verwacht: mee.reduce((s, a) => s + (cats[a.cat]?.prijs || 0), 0), betaald: mee.filter(a => a.betaald).reduce((s, a) => s + (cats[a.cat]?.prijs || 0), 0) };
}

/* ---------- knock-out: kruisfinales, finale en plaatsingswedstrijden [20261127f] ----------
   Een knock-outgroep hoort bij een of meer poules (bv. Poule A en B samen). Na de poules spelen de besten
   kruislings: 2 teams = finale, 4 = halve finales (A1–B2, B1–A2) en finale, 8 = kwartfinales erbij.
   plaats3: wedstrijd om plaats 3. overige: de rest speelt om de plaatsen (A3–B3, A4–B4, …).
   De wedstrijden staan in het schema met lege a/b en een bron (ka/kb): { p, r } = plaats r in poule p,
   { w, win } = winnaar (win:true) of verliezer van wedstrijd w. metKo() vult de teams in zodra het kan. */
export const KO_RONDES = { 2: 'Finale (nummers 1)', 4: 'Halve finales en finale', 8: 'Kwartfinales, halve finales en finale' };
export const MAX_KO = 12;
export const heeftUitslag = u => !!u && u.a !== '' && u.b !== '' && u.a != null && u.b != null && Number.isFinite(Number(u.a)) && Number.isFinite(Number(u.b));
const nTeams = (t, pid) => Object.values(t.teams || {}).filter(x => x?.poule === pid).length;
export function koGroepen(t = {}){
  return gesorteerd(t.ko).slice(0, MAX_KO).map(g => ({ ...g, poules: (Array.isArray(g.poules) ? g.poules : []).filter(p => t.poules?.[p]) }));
}
export function koOpzet(t = {}, g = {}){
  const ps = gesorteerd(t.poules).filter(p => (g.poules || []).includes(p.id) && nTeams(t, p.id) >= 2);
  if (!ps.length) return [];
  const totaal = ps.reduce((n, p) => n + nTeams(t, p.id), 0), maxR = Math.max(...ps.map(p => nTeams(t, p.id)));
  let n = [2, 4, 8].includes(Number(g.ronde)) ? Number(g.ronde) : 4;
  while (n > totaal) n /= 2;
  if (n < 2) return [];
  const seeds = [];
  for (let r = 1; r <= maxR && seeds.length < n; r++) for (const p of ps) if (r <= nTeams(t, p.id) && seeds.length < n) seeds.push({ p: p.id, r });
  const paren = { 2: [[0, 1]], 4: [[0, 3], [1, 2]], 8: [[0, 7], [3, 4], [1, 6], [2, 5]] }[n].map(([i, j]) => [seeds[i], seeds[j]]);
  /* niet tegen een team uit de eigen poule in de eerste ronde, als dat kan */
  for (let i = 0; i < paren.length; i++) if (paren[i][0].p === paren[i][1].p) for (let j = 0; j < paren.length; j++){
    if (j !== i && paren[j][1].p !== paren[i][0].p && paren[i][1].p !== paren[j][0].p){ [paren[i][1], paren[j][1]] = [paren[j][1], paren[i][1]]; break; }
  }
  const id = s => `${g.id}-${s}`, uit = [], eerste = { 2: 'finale', 4: 'halve', 8: 'kwart' }[n];
  paren.forEach(([a, b], i) => uit.push({ id: id(eerste === 'finale' ? 'f' : `${eerste[0]}${i + 1}`), fase: eerste, nr: i + 1, ronde: 1, ka: a, kb: b }));
  if (n === 8) for (let i = 0; i < 2; i++) uit.push({ id: id(`h${i + 1}`), fase: 'halve', nr: i + 1, ronde: 2, ka: { w: id(`k${2 * i + 1}`), win: true }, kb: { w: id(`k${2 * i + 2}`), win: true } });
  if (n >= 4){
    const r = n === 8 ? 3 : 2;
    if (g.plaats3 !== false) uit.push({ id: id('b'), fase: 'brons', nr: 1, ronde: r, ka: { w: id('h1'), win: false }, kb: { w: id('h2'), win: false } });
    uit.push({ id: id('f'), fase: 'finale', nr: 1, ronde: r, ka: { w: id('h1'), win: true }, kb: { w: id('h2'), win: true } });
  }
  if (g.overige){
    const rest = [];
    for (let r = 1; r <= maxR; r++) for (const p of ps) if (r <= nTeams(t, p.id) && !seeds.some(s => s.p === p.id && s.r === r)) rest.push({ p: p.id, r });
    let plaats = n + 1;
    for (let i = 0, k = 1; i + 1 < rest.length; i += 2, k++, plaats += 2) uit.push({ id: id(`p${k}`), fase: 'plaats', nr: k, ronde: 1, plaats, ka: rest[i], kb: rest[i + 1] });
  }
  return uit;
}
/* Knock-out inplannen na de poules: elke ronde na de vorige, op de velden van die poules.
   [20261127s] Met rust aan blijft er één ronde tussen: wie de laatste poulewedstrijd of de vorige finaleronde speelde,
   hoeft dan niet meteen weer (dat bleek bij het proefdraaien, zie toernooi-controle.js). */
function planKo(t, schema, { begin, stap, vj, waarschuwingen, rust = false }){
  const tussen = rust ? 2 : 1;
  const slotVan = w => Math.round((naarMin(w.t) - begin) / stap), bezet = new Set(schema.map(w => `${slotVan(w)}|${w.v}`));
  for (const g of koGroepen(t)){
    const lijst = koOpzet(t, g); if (!lijst.length) continue;
    const pouleW = schema.filter(w => g.poules.includes(w.p) && w.fase === 'poule');
    if (!pouleW.length){ waarschuwingen.push(`${g.naam || 'Knock-out'}: de poules hebben nog geen wedstrijden.`); continue; }
    const mag = [...new Set(g.poules.flatMap(pid => { const v = t.poules[pid]?.velden; return Array.isArray(v) && v.length ? v : vj.map(x => x.id); }))].filter(id => vj.some(v => v.id === id));
    const velden = vj.filter(v => mag.includes(v.id));
    let vanaf = Math.max(...pouleW.map(slotVan)) + tussen;
    const eigenStart = naarMin(g.start); if (eigenStart != null) vanaf = Math.max(vanaf, Math.ceil((eigenStart - begin) / stap));
    const kleur = g.poules[0] || '', rondes = [...new Set(lijst.map(w => w.ronde))].sort((a, b) => a - b);
    for (const r of rondes){
      let hoogste = vanaf;
      for (const w of lijst.filter(x => x.ronde === r)){
        let geplaatst = false;
        for (let s = vanaf; s < vanaf + 200 && !geplaatst; s++) for (const v of velden){
          if (bezet.has(`${s}|${v.id}`)) continue;
          bezet.add(`${s}|${v.id}`); hoogste = Math.max(hoogste, s); geplaatst = true;
          schema.push({ id: w.id, p: kleur, a: '', b: '', v: v.id, t: naarTijd(begin + s * stap), r: 100 + r, fase: w.fase, ko: g.id, nr: w.nr, ka: w.ka, kb: w.kb, ...(w.plaats ? { plaats: w.plaats } : {}) });
          break;
        }
      }
      vanaf = hoogste + tussen;
    }
  }
}
export const pouleKlaar = (t, pid) => { const ws = (t.schema || []).filter(w => w.p === pid && (w.fase || 'poule') === 'poule'); return ws.length > 0 && ws.every(w => heeftUitslag(t.uitslag?.[w.id])); };
/* 'a', 'b' of '' (nog geen uitslag, of gelijk zonder winnaar na strafschoppen) */
export function winnaar(u){
  if (!heeftUitslag(u)) return '';
  const a = Number(u.a), b = Number(u.b);
  return a > b ? 'a' : b > a ? 'b' : u.w === 'a' || u.w === 'b' ? u.w : '';
}
const KORT = { k: 'KF', h: 'HF' };
export function bronTekst(t = {}, bron){
  if (!bron) return '';
  if (bron.p) return `${bron.r}e ${t.poules?.[bron.p]?.naam || 'poule'}`;
  const s = String(bron.w || '').split('-').pop();
  return `${bron.win ? 'Winnaar' : 'Verliezer'} ${KORT[s[0]] ? KORT[s[0]] + s.slice(1) : 'finale'}`;
}
export function koTitel(t = {}, w = {}){
  const g = t.ko?.[w.ko], meer = Object.keys(t.ko || {}).length > 1 && g?.naam ? ` · ${g.naam}` : '';
  const n = { kwart: `Kwartfinale ${w.nr || ''}`, halve: `Halve finale ${w.nr || ''}`, finale: 'Finale', brons: 'Om plaats 3', plaats: `Om plaats ${w.plaats || ''} en ${(w.plaats || 0) + 1}` }[w.fase] || '';
  return (n.trim() || 'Knock-out') + meer;
}
/* Het schema met de teams van de knock-out ingevuld (a/b) zodra de poule klaar is of de vorige wedstrijd een winnaar heeft,
   en met la/lb: wat er staat zolang het team nog niet bekend is ("1e Poule A", "Winnaar HF1"). */
export function metKo(t = {}){
  const schema = (t.schema || []).map(w => ({ ...w })), op = Object.fromEntries(schema.map(w => [w.id, w])), standen = {};
  const los = (bron, diepte = 0) => {
    if (!bron || diepte > 8) return '';
    if (bron.p){ if (!pouleKlaar(t, bron.p)) return ''; return (standen[bron.p] ||= stand(t, bron.p))[(Number(bron.r) || 0) - 1]?.id || ''; }
    const w = op[bron.w]; if (!w) return '';
    const a = w.ka ? los(w.ka, diepte + 1) : w.a, b = w.kb ? los(w.kb, diepte + 1) : w.b, z = winnaar(t.uitslag?.[w.id]);
    if (!a || !b || !z) return '';
    return (z === 'a') === !!bron.win ? a : b;
  };
  for (const w of schema) if (w.ko){ w.a = los(w.ka); w.b = los(w.kb); w.la = bronTekst(t, w.ka); w.lb = bronTekst(t, w.kb); }
  return schema;
}
/* Eindklassering van een knock-outgroep, voor zover bekend: [{ plaats, id }] */
export function koUitslag(t = {}, gid){
  const ws = metKo(t).filter(w => w.ko === gid), uit = [];
  const zet = (w, p) => { const z = winnaar(t.uitslag?.[w?.id]); if (!w || !z || !w.a || !w.b) return; uit.push({ plaats: p, id: z === 'a' ? w.a : w.b }, { plaats: p + 1, id: z === 'a' ? w.b : w.a }); };
  zet(ws.find(w => w.fase === 'finale'), 1); zet(ws.find(w => w.fase === 'brons'), 3);
  for (const w of ws.filter(x => x.fase === 'plaats')) zet(w, w.plaats);
  return uit.sort((a, b) => a.plaats - b.plaats);
}

/* ---------- toernooi uit een bestand van een andere club [20261127m] ----------
   Een geëxporteerde activiteit (JSON) kan een andere club inlezen. Wat erin staat komt van buiten: alleen bekende
   velden gaan mee, met dezelfde grenzen als in de app, en ids die als veldnaam in Firestore kunnen staan.
   Nooit mee: spelers (namen van kinderen), uitslagen, mededelingen, de live- en inschrijflink en koppelingen
   met velden of kleedkamers van de andere club (clubVeld, clubKk). indeling: teams en speelschema ook mee. */
const goedId = id => /^[\w-]{1,40}$/.test(String(id || ''));
const isTijd = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const map = (m, max, maak) => Object.fromEntries(Object.entries(m && typeof m === 'object' && !Array.isArray(m) ? m : {})
  .filter(([id, x]) => goedId(id) && x && typeof x === 'object' && !Array.isArray(x)).slice(0, max).map(([id, x], i) => [id, { ...maak(x, id), volg: getal(x.volg, i, 0, 9999) }]));
const bron = b => !b || typeof b !== 'object' ? null : goedId(b.p) ? { p: b.p, r: getal(b.r, 1, 1, 99) } : goedId(b.w) ? { w: b.w, win: !!b.win } : null;
export function schoonToernooi(t = {}, { indeling = true } = {}){
  if (!t || typeof t !== 'object' || Array.isArray(t)) return {};
  const o = opzet(t);
  const uit = { start: o.start, duur: o.duur, wissel: o.wissel, rust: o.rust, groepOp: o.groepOp, grootte: o.grootte };
  if (SOORTEN[t.deelnemers]) uit.deelnemers = t.deelnemers;
  uit.velden = map(t.velden, MAX.velden, v => ({ naam: tekst(v.naam, 40) || 'Veld', delen: [1, 2, 4].includes(Number(v.delen)) ? Number(v.delen) : 1 }));
  const vj = new Set(veldjes(uit).map(v => v.id));
  uit.kk = map(t.kk, MAX.kk, k => ({ naam: tekst(k.naam, 40) || 'Kleedkamer', plekken: getal(k.plekken, 2, 1, 12), ...(Number(k.delen) === 2 ? { delen: 2 } : {}) }));
  uit.poules = map(t.poules, MAX.poules, p => ({ naam: tekst(p.naam, 40) || 'Poule', kleur: /^#[0-9a-f]{6}$/i.test(p.kleur || '') ? p.kleur : KLEUREN[0],
    velden: (Array.isArray(p.velden) ? p.velden : []).filter(v => vj.has(v)).slice(0, 64), ...(isTijd(p.start) ? { start: p.start } : {}), ...(p.dubbel ? { dubbel: true } : {}) }));
  uit.ko = map(t.ko, MAX_KO, g => ({ naam: tekst(g.naam, 40) || 'Finales', poules: (Array.isArray(g.poules) ? g.poules : []).filter(p => uit.poules[p]).slice(0, MAX.poules),
    ronde: [2, 4, 8].includes(Number(g.ronde)) ? Number(g.ronde) : 4, plaats3: g.plaats3 !== false, overige: !!g.overige, ...(isTijd(g.start) ? { start: g.start } : {}) }));
  uit.clubs = map(t.clubs, MAX.teams, c => ({ naam: tekst(c.naam, 60) || 'Club' }));
  const kks = new Set(kkDelen(uit).map(k => k.id));
  if (t.inschrijf && typeof t.inschrijf === 'object'){
    const i = t.inschrijf;
    uit.inschrijf = { open: false, tot: '', tekst: String(i.tekst ?? '').trim().slice(0, 600),
      cats: map(i.cats, MAX_CATS, c => ({ naam: tekst(c.naam, 40) || 'Categorie', max: getal(c.max, 0, 0, 200), prijs: bedrag(c.prijs), poule: uit.poules[c.poule] ? c.poule : '' })) };
  }
  uit.schermen = map(t.schermen, MAX_SCHERMEN, x => ({ soort: x.soort === 'sponsor' ? 'sponsor' : 'scherm', titel: tekst(x.titel, 60), tekst: String(x.tekst ?? '').trim().slice(0, 300),
    link: veiligeLink(x.link), ...(plaatjeOk(x.img) ? { img: x.img } : {}), tv: x.tv !== false, tel: x.tel !== false }));
  if (!indeling) return uit;
  uit.uitslag = {};
  uit.teams = map(t.teams, MAX.teams, (x) => {
    const e = x.eisen && typeof x.eisen === 'object' ? x.eisen : {};
    const eisen = { ...(['m', 'v'].includes(e.geslacht) ? { geslacht: e.geslacht } : {}), ...(jaarUit(e.van) ? { van: jaarUit(e.van) } : {}), ...(jaarUit(e.tot) ? { tot: jaarUit(e.tot) } : {}) };
    return { naam: tekst(x.naam, 40) || 'Team', poule: uit.poules[x.poule] ? x.poule : '', club: uit.clubs[x.club] ? x.club : '', gast: !!x.gast, kk: kks.has(x.kk) ? x.kk : '', eisen };
  });
  const ids = new Set();
  uit.schema = (Array.isArray(t.schema) ? t.schema : []).filter(w => w && typeof w === 'object' && goedId(w.id) && vj.has(w.v) && isTijd(w.t) && !ids.has(w.id) && ids.add(w.id))
    .slice(0, MAX.schema).map(w => {
      const ko = goedId(w.ko) && uit.ko[w.ko] ? w.ko : '';
      const team = id => (!ko && uit.teams[id] ? id : '');
      return { id: w.id, p: uit.poules[w.p] ? w.p : '', a: team(w.a), b: team(w.b), v: w.v, t: w.t, r: getal(w.r, 1, 1, 999),
        fase: ['poule', 'kwart', 'halve', 'brons', 'finale', 'plaats'].includes(w.fase) ? w.fase : 'poule',
        ...(ko ? { ko, nr: getal(w.nr, 1, 1, 99), ka: bron(w.ka), kb: bron(w.kb), ...(w.plaats ? { plaats: getal(w.plaats, 5, 1, 999) } : {}) } : {}) };
    }).filter(w => w.ko || (w.a && w.b));
  return uit;
}

/* ---------- automatisch indelen: poules, speeltijd en prijsuitreiking [20261127p] ----------
   Alleen teams opgeven, plus begin- en eindtijd: Cluppie kiest het aantal poules en de speeltijd zo dat alles
   (met finales als dat aan staat) en de prijsuitreiking binnen de tijd past. Zo min mogelijk poules, dan
   spelen teams het meest. Teams van dezelfde club komen zoveel mogelijk in verschillende poules. */
export const PAUZE_PRIJS = 5;  /* minuten tussen de laatste wedstrijd en de prijsuitreiking */
export function prijsuitreiking(t = {}){
  const o = opzet(t), schema = t.schema || [];
  if (!o.prijs || !schema.length) return null;
  const van = Math.max(...schema.map(w => naarMin(w.t))) + o.duur + PAUZE_PRIJS;
  return { van: naarTijd(van), tot: naarTijd(van + o.prijs) };
}
/* Verdeel de teams over `aantal` poules: even groot, clubs zoveel mogelijk gespreid. Geeft { teamId: index }. */
export function verdeelPoules(teams = {}, aantal = 2){
  const lijst = Object.entries(teams).filter(([, x]) => x && typeof x === 'object').sort((a, b) => (a[1].volg ?? 0) - (b[1].volg ?? 0));
  const n = Math.max(1, Math.min(aantal, lijst.length)), vak = Array.from({ length: n }, () => []), uit = {};
  const perClub = new Map(); for (const [id, x] of lijst){ const k = x.club || `los-${id}`; if (!perClub.has(k)) perClub.set(k, []); perClub.get(k).push(id); }
  const groepen = [...perClub.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [k, ids] of groepen) for (const id of ids){
    const min = Math.min(...vak.map(v => v.length));
    const kies = vak.map((v, i) => ({ i, n: v.length, zelf: v.filter(x => (teams[x].club || `los-${x}`) === k).length }))
      .filter(x => x.n === min || x.n < min + 1).sort((a, b) => a.zelf - b.zelf || a.n - b.n || a.i - b.i)[0];
    vak[kies.i].push(id); uit[id] = kies.i;
  }
  return uit;
}
const pouleNaam = i => `Poule ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) + 1 : ''}`;
/* Probeer aantallen poules en speeltijden; geeft het beste plan, of het minst slechte met een waarschuwing.
   { poules: { pId: {naam,kleur,volg,velden:[]} }, teamPoule: { teamId: pId }, duur, ko, schema, eind, prijs, past, waarschuwingen } */
export function autoIndeling(t = {}, { maxDuur = 20, minDuur = 6 } = {}){
  const o = opzet(t), teams = t.teams || {}, n = Object.keys(teams).length, vj = veldjes(t);
  const fout = w => ({ past: false, waarschuwingen: [w] });
  if (n < 2) return fout('Voeg eerst minstens twee teams toe.');
  if (!vj.length) return fout('Kies eerst de velden.');
  const grens = naarMin(o.eind), begin = naarMin(o.start);
  if (grens == null) return fout('Vul in hoe laat het toernooi klaar moet zijn.');
  if (grens <= begin) return fout('De eindtijd moet na de begintijd liggen.');
  const duren = o.duurVast ? [o.duur] : Array.from({ length: maxDuur - minDuur + 1 }, (_, i) => maxDuur - i);
  let beste = null, passend = null;
  for (let p = 1; p <= Math.max(1, Math.floor(n / 2)); p++){
    if (p > 1 && n / p < 2) break;
    const verdeling = verdeelPoules(teams, p), pids = Array.from({ length: p }, (_, i) => `ap${i + 1}`);
    const poules = Object.fromEntries(pids.map((id, i) => [id, { naam: p === 1 ? 'Poule' : pouleNaam(i), kleur: KLEUREN[i % KLEUREN.length], volg: i + 1, velden: [] }]));
    const teamPoule = Object.fromEntries(Object.entries(verdeling).map(([tid, i]) => [tid, pids[i]]));
    const ko = o.autoKo ? { ak: { naam: 'Finales', poules: pids, ronde: p === 1 ? 2 : p === 2 ? 4 : 8, plaats3: p > 1, overige: false, volg: 1 } } : {};
    let gevonden = false;
    for (const duur of duren){
      const t2 = { ...t, duur, poules, ko, teams: Object.fromEntries(Object.entries(teams).map(([id, x]) => [id, { ...x, poule: teamPoule[id] }])) };
      /* met rust aan eerst zonder achter elkaar spelen; past dat niet, dan zoals altijd */
      let r = o.rust ? planSchema(t2, { streng: true }) : null;
      if (r){ const pr0 = prijsuitreiking({ ...t2, schema: r.schema }); if (r.waarschuwingen.some(w => /past/.test(w)) || naarMin(pr0 ? pr0.tot : r.eind) > grens) r = null; }
      r ||= planSchema(t2); if (!r.schema.length) continue;
      const pr = prijsuitreiking({ ...t2, schema: r.schema }), klaar = naarMin(pr ? pr.tot : r.eind), alles = !r.waarschuwingen.some(w => /past/.test(w));
      const plan = { poules, teamPoule, duur, ko, schema: r.schema, eind: r.eind, prijs: pr, klaar: naarTijd(klaar), past: alles && klaar <= grens, over: klaar - grens, waarschuwingen: r.waarschuwingen };
      plan.speelmin = Math.round(r.schema.length * 2 * duur / n);
      plan.zonderRust = o.rust ? Object.values(teamRooster({ ...t2, schema: r.schema })).reduce((m, x) => m + x.achterElkaar, 0) : 0;
      /* langste speeltijd die past voor dit aantal poules; met rust aan zoeken we daarna nog door naar de langste die
         zonder achter elkaar spelen past (die kan korter zijn) */
      if (plan.past){ if (!plan.zonderRust || !gevonden){ (passend ||= []).push(plan); gevonden = true; } if (!plan.zonderRust) break; continue; }
      if (!beste || plan.over < beste.over) beste = plan;
    }
  }
  /* Van wat past: de meeste speelminuten per team, met liefst wedstrijden van 10 minuten of langer en poules van 3 of meer. */
  if (passend){
    const goed = x => (x.duur >= Math.min(10, o.duurVast ? o.duur : 10) ? 2 : 0) + (n / Object.keys(x.poules).length >= Math.min(3, n) ? 1 : 0);
    /* [20261127s] met rust aan: liever een plan waarin teams niet vaak achter elkaar spelen (minder dan één keer per team) */
    const rust = x => x.zonderRust >= n ? 1 : 0;
    const plan = passend.sort((a, b) => goed(b) - goed(a) || rust(a) - rust(b) || b.speelmin - a.speelmin || Object.keys(a.poules).length - Object.keys(b.poules).length)[0];
    return { ...plan, waarschuwingen: [] };
  }
  if (!beste) return fout('Er past niets. Voeg velden toe of kies een latere eindtijd.');
  return { ...beste, past: false, waarschuwingen: [`Het past niet helemaal: klaar om ${beste.klaar}, ${beste.over} minuten te laat. Voeg een veld toe, splits een veld in helften, kies een latere eindtijd of zet de finales uit.`] };
}

/* ---------- wedstrijdboom van de knock-out [20261127] ----------
   De finales als boom: links en rechts de kwart- en halve finales, in het midden de finale. Eén functie voor de
   planner, de live pagina en de PDF; wie hem gebruikt geeft zelf door hoe een naam, veld en uitslag te vinden zijn. */
const boomNr = w => Number(String(w.id || '').split('-').pop().slice(1)) || 1;
export function koBoom(ws = []){
  const op = f => ws.filter(w => w.fase === f).sort((a, b) => boomNr(a) - boomNr(b));
  const kw = op('kwart'), hv = op('halve'), finale = op('finale')[0] || null, half = Math.ceil(kw.length / 2);
  return { links: [kw.slice(0, half), hv.slice(0, 1)].filter(l => l.length), rechts: [hv.slice(1, 2), kw.slice(half)].filter(l => l.length),
    finale, brons: op('brons')[0] || null, plaats: ws.filter(w => w.fase === 'plaats').sort((a, b) => boomNr(a) - boomNr(b)) };
}
const BOOM_TITEL = { kwart: 'Kwartfinale', halve: 'Halve finale' };
export function boomHtml(ws, { esc, naam, veld = () => '', uitslag = () => null, mijn = '', kop = '', podium = '' }){
  const b = koBoom(ws); if (!b.finale) return '';
  const kaart = (w, klasse = '', titel = '') => { const u = uitslag(w), heeft = heeftUitslag(u), z = winnaar(u);
    const rij = k => `<div class="bm-t${z === k ? ' bm-wint' : ''}${w[k] ? '' : ' bm-leeg'}${mijn && w[k] === mijn ? ' bm-mijn' : ''}"><span>${esc(naam(w, k))}</span><b>${heeft ? esc(u[k]) : ''}</b></div>`;
    return `<div class="bm-w ${klasse}">${titel ? `<i>${esc(titel)}</i>` : ''}<small>${esc([w.t, veld(w)].filter(Boolean).join(' · '))}${u?.w ? ' · na strafschoppen' : ''}</small>${rij('a')}${rij('b')}</div>`; };
  const kol = (lijst, kant, i, n) => `<div class="bm-kol ${kant}${lijst.length > 1 ? ' bm-paar' : ''}"><h4>${BOOM_TITEL[lijst[0].fase] || ''}</h4><div class="bm-lijst">${lijst.map(w => kaart(w, (kant === 'bm-links' ? i > 0 : i < n - 1) ? 'bm-in' : '')).join('')}</div></div>`;
  const onder = [b.brons ? kaart(b.brons, 'bm-los', 'Om plaats 3') : '', ...b.plaats.map(w => kaart(w, 'bm-los', `Om plaats ${w.plaats || ''}${w.plaats ? ' en ' + (w.plaats + 1) : ''}`.trim()))].filter(Boolean);
  return `<div class="bm-blok">${kop ? `<h3 class="bm-kop">🏆 ${esc(kop)}</h3>` : ''}<div class="bm-rol"><div class="bm" style="--bmk:${b.links.length + b.rechts.length + 1}">
      ${b.links.map((l, i) => kol(l, 'bm-links', i, b.links.length)).join('')}
      <div class="bm-kol bm-midden"><h4>🏆 Finale</h4><div class="bm-lijst">${kaart(b.finale, `bm-finale${b.links.length ? ' bm-in' : ''}`)}</div></div>
      ${b.rechts.map((l, i) => kol(l, 'bm-rechts', i, b.rechts.length)).join('')}</div></div>
    ${onder.length ? `<div class="bm-onder">${onder.join('')}</div>` : ''}${podium}</div>`;
}
export const BOOM_CSS = `
.bm-blok{display:flex;flex-direction:column;gap:10px;--bml:var(--bmc,var(--accent,#E20613))}
.bm-kop{margin:0;font-size:15px;font-weight:800}
.bm-rol{overflow-x:auto;padding-bottom:2px}
.bm{display:flex;gap:20px;align-items:stretch;min-width:calc(var(--bmk,3)*128px + (var(--bmk,3) - 1)*20px)}
.bm-kol{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px}
.bm-kol h4{margin:0;text-align:center;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-2,#666);min-height:14px}
.bm-kol.bm-midden h4{color:var(--bml)}
.bm-lijst{flex:1;position:relative;display:flex;flex-direction:column;justify-content:space-around;gap:10px}
.bm-w{position:relative;background:var(--bg,#f6f7f9);border:1.5px solid var(--hair,#d9dce1);border-radius:10px;padding:5px 8px 6px;display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:1.25;color:var(--ink,#14161a);break-inside:avoid}
.bm-w small{font-size:10px;color:var(--ink-2,#666);font-variant-numeric:tabular-nums}
.bm-w i{font-style:normal;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--bml)}
.bm-t{display:flex;justify-content:space-between;gap:6px;align-items:baseline}
.bm-t span{min-width:0;overflow-wrap:anywhere;font-weight:600}.bm-t b{font-variant-numeric:tabular-nums;min-width:14px;text-align:right}
.bm-t.bm-wint span,.bm-t.bm-wint b{font-weight:800}.bm-t.bm-wint b{color:var(--bml)}
.bm-t.bm-leeg span{font-weight:400;font-style:italic;color:var(--ink-2,#666)}
.bm-t.bm-mijn span{text-decoration:underline;text-decoration-color:var(--bml);text-decoration-thickness:2px}
.bm-w.bm-finale{border:2px solid var(--bml);background:color-mix(in srgb,var(--bml) 9%,var(--card,#fff));padding:8px 10px;font-size:14px}
.bm-w::before,.bm-w::after,.bm-kol.bm-paar .bm-lijst::after{content:'';position:absolute;background:var(--bml);opacity:.55}
.bm-w::before,.bm-w::after{top:50%;height:2px;width:0;margin-top:-1px}
.bm-kol.bm-links .bm-w::after{right:-11.5px;width:10px}.bm-kol.bm-rechts .bm-w::before{left:-11.5px;width:10px}
.bm-kol.bm-links .bm-w.bm-in::before,.bm-w.bm-finale.bm-in::before{left:-11.5px;width:10px}
.bm-kol.bm-rechts .bm-w.bm-in::after,.bm-w.bm-finale.bm-in::after{right:-11.5px;width:10px}
.bm-kol.bm-paar .bm-lijst::after{top:25%;bottom:25%;width:2px}
.bm-kol.bm-links.bm-paar .bm-lijst::after{right:-11px}.bm-kol.bm-rechts.bm-paar .bm-lijst::after{left:-11px}
.bm-onder{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.bm-onder .bm-w{flex:0 1 220px}
.bm-podium{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;margin:0;font-weight:800}`;
