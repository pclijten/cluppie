/* ==================== ACTIVITEITEN: REKENWERK [20261125x] ====================
   PURE module (geen DOM, geen Firebase): alles wat Activiteiten (activiteiten.js) en de open
   vrijwilligerslink (activiteit-boot.js) uitrekenen. Getest in tests/activiteiten.test.mjs.

   Datamodel van één activiteit (clubs/{clubId}/activiteiten/{id}). Lijsten waar meerdere mensen
   tegelijk in werken zijn maps met een id, zodat de app per regel schrijft (taken.<id>.status) en
   twee comitéleden elkaars werk niet overschrijven (zelfde aanpak als Lijstjes en Toernooitje).
     { naam, type, sjabloon, datum 'JJJJ-MM-DD', start, eind, locatie, omschrijving,
       status 'concept'|'gepland'|'geweest'|'geannuleerd', tabs:{ <tab>: bool },
       comite:{ [lidId]: { naam, rol, uid? } }, comiteUids:[uid], rollen:[naam],
       fasen:[{ id, naam }],
       taken:{ [id]: { titel, fase, eigenaar, d (dagen vooraf) | null, datum '' , status 'open'|'bezig'|'klaar', notitie, tip, volg } },
       programma:{ [id]: { tijd, duur, wat, waar, wie, volg } }, programmaB:{ … }, vertraging, planB:{ tekst, actief },
       materiaal:{ [id]: { naam, aantal, wie, klaar, volg } },
       berichten:{ [id]: { d, titel, tekst, kanaal, geplaatstMs, volg } },
       budget:{ [id]: { naam, soort 'uit'|'in', begroot, werkelijk, volg } },
       documenten:{ [id]: { naam, url, volg } },
       checks:{ [id]: { titel, klaar, volg } },
       teams:[teamId], agenda (bool: zichtbaar bij de teams), kamer (bool: ook in de Teamkamer),
       deelnemers:{ verwacht, notitie }, deelId, evaluatie:{ goed, beter, tips:{ [taakId]: tekst } },
       seizoen, gemaaktDoor, gemaaktMs, bijgewerktMs }
   De vrijwilligersdiensten staan in activiteitDeel/{deelId} (open link): { club, clubNaam, actId, titel,
   datum, open, diensten:{ [id]: { naam, start, eind, plek, nodig, volg } } } met de aanmeldingen eronder. */

export const TABS = [
  ['overzicht', 'Overzicht'], ['taken', 'Draaiboek'], ['programma', 'Dagprogramma'], ['toernooi', 'Toernooi'], ['mensen', 'Comité'],
  ['vrijwilligers', 'Vrijwilligers'], ['deelnemers', 'Deelnemers'], ['locatie', 'Locatie en spullen'],
  ['communicatie', 'Communicatie'], ['budget', 'Budget'], ['documenten', 'Documenten'], ['evaluatie', 'Evaluatie'],
];
export const VASTE_TABS = ['overzicht', 'taken'];
export const FASEN = [
  { id: 'voor', naam: 'Voorbereiding' }, { id: 'week', naam: 'Laatste week' },
  { id: 'dag', naam: 'De dag zelf' }, { id: 'na', naam: 'Afronding' },
];
export const STATUS_TAAK = { open: 'Te doen', bezig: 'Bezig', klaar: 'Klaar' };
export const STATUS_ACT = { concept: 'Concept', gepland: 'Gepland', geweest: 'Geweest', geannuleerd: 'Geannuleerd' };
export const KANALEN = { teams: 'Berichten aan coaches', ouders: 'Teamkamer en ouders', whatsapp: 'WhatsApp' };
export const MAX = { taken: 300, programma: 80, materiaal: 150, berichten: 40, budget: 80, documenten: 40, checks: 40, diensten: 60, comite: 40, teams: 120 };
export const NAAM_MAX = 24;

const DAG = 86400000;
export const nieuwId = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const tekst = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lang = (v, max = 2000) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const getal = (v, min = -9999, max = 99999) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
export const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s + 'T12:00:00Z'));
export const isTijd = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

/* ---------- datums ---------- */
export const plusDagen = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DAG).toISOString().slice(0, 10);
export const dagenTussen = (van, tot) => Math.round((Date.parse(tot + 'T12:00:00Z') - Date.parse(van + 'T12:00:00Z')) / DAG);
export const naarMin = t => isTijd(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null;
export const naarTijd = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAANDEN_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
export function datumKort(iso){ if (!isIso(iso)) return ''; const [, m, d] = iso.split('-').map(Number); return `${d} ${MAANDEN[m - 1]}`; }
export function datumLang(iso){ if (!isIso(iso)) return ''; const dt = new Date(iso + 'T12:00:00Z'); return `${WEEKDAG[dt.getUTCDay()]} ${dt.getUTCDate()} ${MAANDEN_LANG[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`; }
/* seizoen loopt van juli tot en met juni: 2026-11-25 → '2026-2027' */
export function seizoenVan(iso){ if (!isIso(iso)) return ''; const j = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m >= 7 ? `${j}-${j + 1}` : `${j - 1}-${j}`; }

/* "6 weken vooraf", "3 dagen vooraf", "de dag zelf", "2 dagen erna" */
export function dTekst(d){
  if (d === null || d === undefined || !Number.isFinite(Number(d))) return 'vaste datum';
  d = Number(d);
  if (d === 0) return 'de dag zelf';
  if (d < 0) return `${-d} ${-d === 1 ? 'dag' : 'dagen'} erna`;
  if (d >= 14 && d % 7 === 0) return `${d / 7} weken vooraf`;
  return `${d} ${d === 1 ? 'dag' : 'dagen'} vooraf`;
}
export function faseVan(d){
  if (d === null || d === undefined || !Number.isFinite(Number(d))) return 'voor';
  d = Number(d);
  return d > 7 ? 'voor' : d > 0 ? 'week' : d === 0 ? 'dag' : 'na';
}

/* ---------- taken: terugplannen ---------- */
/* Datum waarop een taak klaar moet zijn: vaste datum, of de activiteitdatum min d dagen. */
export function taakDatum(taak, datum){
  if (taak && isIso(taak.datum)) return taak.datum;
  if (!isIso(datum) || !taak || !Number.isFinite(Number(taak.d))) return '';
  return plusDagen(datum, -Number(taak.d));
}
/* 'klaar' | 'telaat' | 'week' (binnen 7 dagen) | 'later' | 'zonder' (geen datum) */
export function taakStaat(taak, datum, vandaag){
  if (taak?.status === 'klaar') return 'klaar';
  const t = taakDatum(taak, datum);
  if (!t) return 'zonder';
  const n = dagenTussen(vandaag, t);
  return n < 0 ? 'telaat' : n <= 7 ? 'week' : 'later';
}
export const gesorteerd = (map, sleutel) => Object.entries(map || {}).filter(([, v]) => v && typeof v === 'object')
  .map(([id, v]) => ({ id, ...v })).sort(sleutel || ((a, b) => (a.volg ?? 0) - (b.volg ?? 0) || String(a.id).localeCompare(String(b.id))));
/* taken op volgorde van datum (vroegste eerst), dan volg */
export function takenOpDatum(act){
  return gesorteerd(act.taken, (a, b) => {
    const da = taakDatum(a, act.datum) || '9999', db = taakDatum(b, act.datum) || '9999';
    return da.localeCompare(db) || (a.volg ?? 0) - (b.volg ?? 0);
  });
}
/* Een taak met d ≥ 0 van een activiteit die nog moet komen: verschuift mee met de datum. */
export function verschuifDatum(act, nieuweDatum){
  const oud = act.datum, uit = { ...act, datum: nieuweDatum };
  if (isIso(oud) && isIso(nieuweDatum)){
    const n = dagenTussen(oud, nieuweDatum);
    uit.taken = Object.fromEntries(Object.entries(act.taken || {}).map(([id, t]) => [id, isIso(t?.datum) ? { ...t, datum: plusDagen(t.datum, n) } : t]));
  }
  return uit;
}

/* ---------- overzicht en stoplicht ---------- */
export function telDiensten(diensten, aanmeldingen){
  const per = {};
  for (const a of aanmeldingen || []) if (a && a.dienst) per[a.dienst] = (per[a.dienst] || 0) + 1;
  const lijst = gesorteerd(diensten, (a, b) => String(a.start || '').localeCompare(String(b.start || '')) || (a.volg ?? 0) - (b.volg ?? 0))
    .map(d => ({ ...d, nodig: Math.max(0, Number(d.nodig) || 0), aantal: per[d.id] || 0 }))
    .map(d => ({ ...d, tekort: Math.max(0, d.nodig - d.aantal) }));
  const nodig = lijst.reduce((s, d) => s + d.nodig, 0), gevuld = lijst.reduce((s, d) => s + Math.min(d.nodig, d.aantal), 0);
  return { lijst, nodig, gevuld, tekort: nodig - gevuld, leeg: lijst.filter(d => d.nodig > 0 && d.aantal === 0).length };
}
export function budgetTotaal(budget){
  const r = { uitBegroot: 0, uitWerkelijk: 0, inBegroot: 0, inWerkelijk: 0 };
  for (const p of Object.values(budget || {})){
    if (!p || typeof p !== 'object') continue;
    const b = Number(p.begroot) || 0, w = Number(p.werkelijk) || 0;
    if (p.soort === 'in'){ r.inBegroot += b; r.inWerkelijk += w; } else { r.uitBegroot += b; r.uitWerkelijk += w; }
  }
  r.saldoBegroot = r.inBegroot - r.uitBegroot;
  r.saldoWerkelijk = r.inWerkelijk - r.uitWerkelijk;
  r.verschil = r.uitWerkelijk - r.uitBegroot;            // > 0: meer uitgegeven dan begroot
  return r;
}
export const euro = n => '€ ' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/* Kern van het overzicht: aftellen, taken, diensten, budget en een stoplicht per onderdeel.
   kleur: 'groen' | 'oranje' | 'rood' | 'grijs' (niet van toepassing). */
export function overzicht(act, vandaag, aanmeldingen = [], diensten = null){
  const dagenTot = isIso(act.datum) ? dagenTussen(vandaag, act.datum) : null;
  const taken = gesorteerd(act.taken);
  const staten = taken.map(t => ({ t, s: taakStaat(t, act.datum, vandaag) }));
  const klaar = staten.filter(x => x.s === 'klaar').length, telaat = staten.filter(x => x.s === 'telaat').map(x => x.t);
  const week = staten.filter(x => x.s === 'week').map(x => x.t).sort((a, b) => taakDatum(a, act.datum).localeCompare(taakDatum(b, act.datum)));
  const zonderEigenaar = taken.filter(t => t.status !== 'klaar' && !t.eigenaar).length;
  const ds = telDiensten(diensten || {}, aanmeldingen);
  const bud = budgetTotaal(act.budget);
  const kleurTaken = !taken.length ? 'grijs' : telaat.length > 2 ? 'rood' : telaat.length ? 'oranje' : 'groen';
  let kleurDiensten = 'grijs';
  if (ds.nodig > 0){
    const pct = ds.gevuld / ds.nodig;
    const dichtbij = dagenTot !== null && dagenTot <= 7;
    kleurDiensten = pct >= 1 ? 'groen' : (dichtbij && pct < 0.8) || pct < 0.3 && dagenTot !== null && dagenTot <= 14 ? 'rood' : 'oranje';
  }
  const kleurBudget = !bud.uitBegroot && !bud.inBegroot ? 'grijs' : bud.uitWerkelijk > bud.uitBegroot * 1.1 ? 'rood' : bud.uitWerkelijk > bud.uitBegroot ? 'oranje' : 'groen';
  const checks = gesorteerd(act.checks), checksOpen = checks.filter(c => !c.klaar).length;
  const kleurChecks = !checks.length ? 'grijs' : !checksOpen ? 'groen' : dagenTot !== null && dagenTot <= 7 ? 'rood' : 'oranje';
  return {
    dagenTot, taken: { totaal: taken.length, klaar, telaat, week, zonderEigenaar, pct: taken.length ? Math.round(klaar / taken.length * 100) : 0 },
    diensten: ds, budget: bud, checks: { totaal: checks.length, open: checksOpen },
    kleur: { taken: kleurTaken, diensten: kleurDiensten, budget: kleurBudget, checks: kleurChecks },
  };
}
export function aftelTekst(n){
  if (n === null || n === undefined) return 'Nog geen datum';
  if (n === 0) return 'Vandaag';
  if (n === 1) return 'Morgen';
  if (n === -1) return 'Gisteren';
  return n > 0 ? `Nog ${n} dagen` : `${-n} dagen geleden`;
}

/* ---------- dagprogramma (run of show) ---------- */
/* Programmapunten op tijd, met de vertraging erbij opgeteld. nuMin (minuten na middernacht) bepaalt
   wat nu bezig is en wat straks komt. */
export function programmaLijst(programma, vertraging = 0, nuMin = null){
  const v = Number(vertraging) || 0;
  const lijst = gesorteerd(programma, (a, b) => (naarMin(a.tijd) ?? 9999) - (naarMin(b.tijd) ?? 9999) || (a.volg ?? 0) - (b.volg ?? 0))
    .map(p => {
      const start = naarMin(p.tijd), duur = Math.max(0, Number(p.duur) || 0);
      const s = start === null ? null : start + v;
      return { ...p, start: s, eindMin: s === null ? null : s + duur, tijdNu: s === null ? '' : naarTijd(s), eindNu: s === null ? '' : naarTijd(s + duur) };
    });
  let nu = null, straks = null;
  if (nuMin !== null){
    nu = lijst.find(p => p.start !== null && p.start <= nuMin && nuMin < p.eindMin) || null;
    straks = lijst.find(p => p.start !== null && p.start > nuMin) || null;
  }
  return { lijst, nu, straks };
}

/* ---------- aanmaken: van sjabloon, kopie, als sjabloon ---------- */
const naarMap = (lijst, prefix, maak) => Object.fromEntries((lijst || []).map((x, i) => [prefix + String(i + 1).padStart(3, '0'), { ...maak(x), volg: i }]));
const STD_TABS = Object.fromEntries(TABS.map(([id]) => [id, true]));

/* sj = sjabloon (activiteit-sjablonen.js of een clubsjabloon); opts = { naam, datum, start, eind, locatie, door } */
export function vanSjabloon(sj, opts = {}){
  const datum = isIso(opts.datum) ? opts.datum : '';
  const taken = naarMap(sj.taken, 't', t => ({ titel: tekst(t.t ?? t.titel), fase: t.fase || faseVan(t.d), eigenaar: '', d: Number.isFinite(Number(t.d)) ? Number(t.d) : null,
    datum: '', status: 'open', notitie: '', tip: tekst(t.tip || '', 300), rol: tekst(t.rol || '', 40) }));
  return {
    naam: tekst(opts.naam || sj.naam, 80), type: sj.type || sj.id || 'eigen', sjabloon: sj.id || '', datum,
    start: isTijd(opts.start) ? opts.start : (isTijd(sj.start) ? sj.start : ''), eind: isTijd(opts.eind) ? opts.eind : (isTijd(sj.eind) ? sj.eind : ''),
    locatie: tekst(opts.locatie || '', 80), omschrijving: lang(sj.omschrijving || '', 600), status: 'concept',
    tabs: { ...STD_TABS, ...(sj.tabs || {}) },
    comite: {}, comiteUids: [], rollen: (sj.rollen || []).map(r => tekst(r, 40)).filter(Boolean),
    fasen: FASEN.map(f => ({ ...f })),
    taken,
    programma: naarMap(sj.programma, 'p', p => ({ tijd: isTijd(p.tijd) ? p.tijd : '', duur: Math.max(0, Number(p.duur) || 0), wat: tekst(p.wat, 120), waar: tekst(p.waar || '', 60), wie: tekst(p.wie || '', 60) })),
    programmaB: naarMap(sj.planB?.programma, 'q', p => ({ tijd: isTijd(p.tijd) ? p.tijd : '', duur: Math.max(0, Number(p.duur) || 0), wat: tekst(p.wat, 120), waar: tekst(p.waar || '', 60), wie: tekst(p.wie || '', 60) })),
    planB: { tekst: lang(sj.planB?.tekst || '', 600), actief: false }, vertraging: 0,
    materiaal: naarMap(sj.materiaal, 'm', m => ({ naam: tekst(m.naam, 80), aantal: Number(m.aantal) > 0 ? Number(m.aantal) : null, wie: '', klaar: false })),
    berichten: naarMap(sj.berichten, 'b', b => ({ d: Number.isFinite(Number(b.d)) ? Number(b.d) : 0, titel: tekst(b.titel, 80), tekst: lang(b.tekst, 1000), kanaal: KANALEN[b.kanaal] ? b.kanaal : 'whatsapp', geplaatstMs: null })),
    budget: naarMap(sj.budget, 'u', p => ({ naam: tekst(p.naam, 60), soort: p.soort === 'in' ? 'in' : 'uit', begroot: Number(p.begroot) || 0, werkelijk: null })),
    documenten: {},
    checks: naarMap(sj.checks, 'c', c => ({ titel: tekst(typeof c === 'string' ? c : c.titel, 160), klaar: false })),
    dienstenSjabloon: (sj.diensten || []).map(d => ({ naam: tekst(d.naam, 40), start: isTijd(d.start) ? d.start : '', eind: isTijd(d.eind) ? d.eind : '', plek: tekst(d.plek || '', 40), nodig: Math.max(0, Number(d.nodig) || 0), ...(d.wat ? { wat: dienstWat(d.wat) } : {}) })),
    teams: [], agenda: false, kamer: false, deelnemers: { verwacht: null, notitie: '' },
    ...(['school', 'bedrijf', 'vrij'].includes(sj.deelnemers) ? { toernooi: { deelnemers: sj.deelnemers } } : {}),
    deelId: '', evaluatie: { goed: '', beter: '', tips: {} },
    seizoen: seizoenVan(datum), gemaaktDoor: opts.door || '', gemaaktMs: opts.nu || Date.now(), bijgewerktMs: opts.nu || Date.now(),
  };
}
export function dienstenNaarMap(lijst){ return naarMap(lijst, 'd', d => ({ naam: tekst(d.naam, 40), start: d.start || '', eind: d.eind || '', plek: tekst(d.plek || '', 40), nodig: Math.max(0, Number(d.nodig) || 0), ...(d.wat ? { wat: dienstWat(d.wat) } : {}) })); }

/* ---------- [20261126y] wat wordt er van de vrijwilliger verwacht? ----------
   Elke dienst kan een korte omschrijving hebben (dienst.wat). Die staat op de inschrijfpagina (?act=),
   in het rooster en het draaiboek. Een voorzet komt uit de vrijwilligersbank van de club (taak met dezelfde
   naam) of anders uit de standaardteksten hieronder. */
export const WAT_MAX = 500;
export const dienstWat = v => lang(v, WAT_MAX);
export const STANDAARD_WAT = [
  [/opbouw|klaarzetten/i, 'Je helpt het terrein klaarzetten: doelen en pionnen op de velden, tafels, tenten en banners neerzetten. Meld je bij aankomst bij het comité, die vertelt wat waar moet. Trek kleding aan die vies mag worden.'],
  [/afbouw|opruim/i, 'Na afloop ruim je samen op: doelen en materiaal terug naar het hok, tafels en tenten afbreken, afval rapen. Meestal ben je binnen een uur klaar.'],
  [/kantine|bar|koffie|catering/i, 'Je staat achter de bar of in de keuken: koffie, thee en fris schenken, broodjes of patat klaarmaken en afrekenen. Je hoeft het niet te kunnen, iemand van de kantine legt het uit. Handen wassen en haren vast.'],
  [/scheids|arbit|spelleid/i, 'Je fluit of leidt een of meer wedstrijden. Je krijgt het schema, een fluitje en een hesje bij de wedstrijdtafel. Bij de jongste teams help je vooral het spel op gang te houden; niemand verwacht dat je de spelregels uit je hoofd kent.'],
  [/wedstrijdtafel|jury|uitslag|tafel/i, 'Je zit aan de wedstrijdtafel: je houdt de tijd bij, geeft het begin- en eindsignaal en verwerkt de uitslagen. Je werkt met een laptop of telefoon en een schema op papier.'],
  [/ehbo|bhv|eerste hulp/i, 'Je bent aanspreekpunt bij kleine ongelukjes: koelen, pleisters, tape. Neem je EHBO- of BHV-diploma mee als je dat hebt. De EHBO-koffer staat in de kantine. Bel 112 bij iets ernstigs en waarschuw het comité.'],
  [/parkeer|verkeer|ontvangst|welkom|kassa|entree/i, 'Je vangt bezoekers en teams op bij de ingang: je wijst de weg naar de kleedkamers en velden, en houdt de parkeerplaats en de toegang vrij. Je krijgt een hesje.'],
  [/kleedkamer|schoonma/i, 'Je houdt de kleedkamers bij: deuren openen en sluiten volgens het schema, tussendoor even vegen en kijken of er niets is blijven liggen.'],
  [/foto|video|media/i, 'Je maakt foto’s of korte filmpjes van de dag voor de clubsite en social media. Fotografeer alleen kinderen die op de lijst mogen staan; het comité geeft je die lijst.'],
];
export function standaardWat(naam){ const n = String(naam || ''); const r = STANDAARD_WAT.find(([re]) => re.test(n)); return r ? r[1] : ''; }
/* Taak uit de vrijwilligersbank die bij de dienstnaam past (gelijke of bevattende titel) */
export function bankTaakVoor(naam, taken){
  const n = String(naam || '').trim().toLowerCase(); if (!n) return null;
  const lijst = Object.values(taken || {}).filter(t => t && typeof t === 'object' && t.titel && (t.wat || (t.stappen || []).length));
  const t = (x) => String(x.titel).trim().toLowerCase();
  return lijst.find(x => t(x) === n) || lijst.find(x => t(x).includes(n) || n.includes(t(x))) || null;
}
export function bankWat(taak){
  if (!taak) return '';
  const stappen = (Array.isArray(taak.stappen) ? taak.stappen : []).filter(Boolean).map(s => `- ${s}`).join('\n');
  return dienstWat([taak.wat || '', stappen, taak.contact ? `Vragen? ${taak.contact}.` : ''].filter(Boolean).join('\n'));
}
/* De voorzet voor een dienst: eerst de clubbank, dan de standaardtekst. { tekst, bron: 'bank'|'standaard'|'' } */
export function voorzetWat(naam, bankTaken){
  const b = bankWat(bankTaakVoor(naam, bankTaken)); if (b) return { tekst: b, bron: 'bank' };
  const s = standaardWat(naam); return s ? { tekst: s, bron: 'standaard' } : { tekst: '', bron: '' };
}

/* Kopie van een eerdere activiteit (bv. vorig jaar) op een nieuwe datum. Taken staan weer open,
   vaste datums schuiven mee, en de tips uit de evaluatie komen bij de taak te staan: het clubgeheugen. */
export function kopie(act, opts = {}){
  const datum = isIso(opts.datum) ? opts.datum : '';
  const n = isIso(act.datum) && datum ? dagenTussen(act.datum, datum) : 0;
  const tips = act.evaluatie?.tips || {};
  const taken = Object.fromEntries(Object.entries(act.taken || {}).filter(([, t]) => t && typeof t === 'object').map(([id, t]) => [id, {
    ...t, status: 'open', notitie: '', datum: isIso(t.datum) ? plusDagen(t.datum, n) : '',
    tip: [t.tip, tips[id]].map(x => tekst(x || '', 300)).filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ').slice(0, 400),
  }]));
  const uit = {
    ...JSON.parse(JSON.stringify(act)), naam: tekst(opts.naam || act.naam, 80), datum, status: 'concept', taken,
    vertraging: 0, planB: { tekst: act.planB?.tekst || '', actief: false },
    materiaal: Object.fromEntries(Object.entries(act.materiaal || {}).map(([id, m]) => [id, { ...m, klaar: false }])),
    berichten: Object.fromEntries(Object.entries(act.berichten || {}).map(([id, b]) => [id, { ...b, geplaatstMs: null }])),
    budget: Object.fromEntries(Object.entries(act.budget || {}).map(([id, p]) => [id, { ...p, begroot: Number(p.werkelijk) > 0 ? Number(p.werkelijk) : (Number(p.begroot) || 0), werkelijk: null }])),
    checks: Object.fromEntries(Object.entries(act.checks || {}).map(([id, c]) => [id, { ...c, klaar: false }])),
    evaluatie: { goed: '', beter: '', tips: {} }, deelId: '', agenda: false,
    vorige: { naam: act.naam, datum: act.datum, goed: tekst(act.evaluatie?.goed || '', 600), beter: tekst(act.evaluatie?.beter || '', 600) },
    seizoen: seizoenVan(datum), gemaaktDoor: opts.door || '', gemaaktMs: opts.nu || Date.now(), bijgewerktMs: opts.nu || Date.now(),
  };
  delete uit.id;
  uit.vraag = false; uit.vraagTot = '';
  /* toernooi: de opzet (tijden, velden, kleedkamers, poules, verenigingen) gaat mee; spelers, teams, schema, uitslagen en de live-link niet */
  if (uit.toernooi){ const { spelers, teams, schema, uitslag, mededelingen, liveId, live, gepland, inschrijfId, ...opzet } = uit.toernooi; uit.toernooi = opzet; if (opzet.inschrijf) uit.toernooi.inschrijf = { ...opzet.inschrijf, open: false, tot: '' }; }
  if (opts.zonderMensen){ uit.comite = {}; uit.comiteUids = []; uit.taken = Object.fromEntries(Object.entries(uit.taken).map(([id, t]) => [id, { ...t, eigenaar: '' }])); }
  return uit;
}
/* Een activiteit als (club)sjabloon: zonder datums, mensen en bedragen; tips uit de evaluatie gaan mee. */
export function alsSjabloon(act, { naam, diensten } = {}){
  const tips = act.evaluatie?.tips || {};
  const rolVan = uid => act.comite?.[uid]?.rol || '';
  return {
    naam: tekst(naam || act.naam, 80), type: act.type || 'eigen', omschrijving: lang(act.omschrijving || '', 600), start: act.start || '', eind: act.eind || '',
    rollen: [...(act.rollen || [])],
    taken: takenOpDatum(act).map(t => ({
      t: t.titel, d: isIso(t.datum) && isIso(act.datum) ? dagenTussen(t.datum, act.datum) : (Number.isFinite(Number(t.d)) ? Number(t.d) : null),
      fase: t.fase || undefined, rol: t.rol || rolVan(t.eigenaar) || undefined,
      tip: [t.tip, tips[t.id]].map(x => tekst(x || '', 300)).filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ').slice(0, 400) || undefined,
    })),
    programma: gesorteerd(act.programma).map(({ tijd, duur, wat, waar, wie }) => ({ tijd, duur, wat, waar, wie })),
    planB: { tekst: act.planB?.tekst || '', programma: gesorteerd(act.programmaB).map(({ tijd, duur, wat, waar, wie }) => ({ tijd, duur, wat, waar, wie })) },
    diensten: (diensten ? gesorteerd(diensten) : act.dienstenSjabloon || []).map(({ naam, start, eind, plek, nodig, wat }) => ({ naam, start, eind, plek, nodig, ...(wat ? { wat } : {}) })),
    materiaal: gesorteerd(act.materiaal).map(({ naam, aantal }) => ({ naam, aantal })),
    berichten: gesorteerd(act.berichten).map(({ d, titel, tekst: t, kanaal }) => ({ d, titel, tekst: t, kanaal })),
    budget: gesorteerd(act.budget).map(({ naam, soort, begroot, werkelijk }) => ({ naam, soort, begroot: Number(werkelijk) > 0 ? Number(werkelijk) : Number(begroot) || 0 })),
    checks: gesorteerd(act.checks).map(c => c.titel),
    tabs: act.tabs ? { ...act.tabs } : undefined,
  };
}
/* Is dit een bruikbaar sjabloon? (JSON-import, clubsjablonen) */
export function sjabloonFouten(sj){
  const f = [];
  if (!sj || typeof sj !== 'object') return ['Geen sjabloon.'];
  if (!tekst(sj.naam)) f.push('Naam ontbreekt.');
  for (const k of ['taken', 'programma', 'diensten', 'materiaal', 'berichten', 'budget', 'checks']) if (sj[k] !== undefined && !Array.isArray(sj[k])) f.push(`${k} is geen lijst.`);
  if ((sj.taken || []).some(t => !tekst(t?.t ?? t?.titel))) f.push('Een taak heeft geen titel.');
  if ((sj.taken || []).length > MAX.taken) f.push('Te veel taken.');
  return f;
}

/* ---------- teksten invullen ---------- */
export function vulIn(t, act, link = ''){
  return String(t || '')
    .replaceAll('{naam}', act.naam || 'de activiteit').replaceAll('{datum}', datumLang(act.datum) || 'de datum')
    .replaceAll('{tijd}', act.start || '').replaceAll('{locatie}', act.locatie || 'de club').replaceAll('{link}', link || '');
}
/* Takenlijst per comitélid als tekst (WhatsApp), alleen open taken */
export function takenTekst(act, lidId, vandaag){
  const lid = act.comite?.[lidId];
  const eigen = takenOpDatum(act).filter(t => t.eigenaar === lidId && t.status !== 'klaar');
  const regels = eigen.map(t => { const d = taakDatum(t, act.datum); const s = taakStaat(t, act.datum, vandaag); return `• ${t.titel}${d ? ` (vóór ${datumKort(d)}${s === 'telaat' ? ', te laat' : ''})` : ''}`; });
  return `${act.naam}${act.datum ? ` – ${datumLang(act.datum)}` : ''}\nTaken voor ${String(lid?.naam || '').split(' ')[0] || 'jou'}:\n${regels.join('\n') || 'Geen open taken. Top!'}`;
}
export function oproepTekst(act, ds, link){
  const open = ds.lijst.filter(d => d.tekort > 0);
  const regels = open.map(d => `• ${d.naam} ${d.start && d.eind ? `${d.start}–${d.eind}` : ''}: nog ${d.tekort} nodig`.replace(/\s+:/, ':'));
  return `${act.naam}${act.datum ? ` op ${datumLang(act.datum)}` : ''}: we zoeken nog vrijwilligers!\n${regels.join('\n')}\nSchrijf je in: ${link}`;
}

/* ---------- export ---------- */
const csvCel = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/* Excel (NL) leest puntkomma-CSV met een BOM als UTF-8 */
export const csv = (kop, rijen) => '\ufeff' + [kop, ...rijen].map(r => r.map(csvCel).join(';')).join('\r\n');
export function csvTaken(act, vandaag){
  const fase = Object.fromEntries((act.fasen || FASEN).map(f => [f.id, f.naam]));
  return csv(['Fase', 'Taak', 'Eigenaar', 'Rol', 'Klaar vóór', 'Dagen vooraf', 'Status', 'Notitie', 'Tip'],
    takenOpDatum(act).map(t => [fase[t.fase] || '', t.titel, act.comite?.[t.eigenaar]?.naam || '', t.rol || act.comite?.[t.eigenaar]?.rol || '',
      taakDatum(t, act.datum), isIso(t.datum) ? '' : (t.d ?? ''), taakStaat(t, act.datum, vandaag) === 'telaat' ? 'Te laat' : STATUS_TAAK[t.status] || 'Te doen', t.notitie || '', t.tip || '']));
}
export function csvProgramma(act){
  const { lijst } = programmaLijst(act.planB?.actief ? act.programmaB : act.programma, act.vertraging);
  return csv(['Van', 'Tot', 'Wat', 'Waar', 'Wie'], lijst.map(p => [p.tijdNu, p.eindNu, p.wat, p.waar || '', p.wie || '']));
}
export function csvDiensten(diensten, aanmeldingen){
  const ds = telDiensten(diensten, aanmeldingen);
  const rijen = [];
  for (const d of ds.lijst){
    const namen = (aanmeldingen || []).filter(a => a.dienst === d.id).map(a => a.naam);
    rijen.push([d.naam, d.start || '', d.eind || '', d.plek || '', d.nodig, d.aantal, namen.join(', '), d.wat || '']);
  }
  return csv(['Dienst', 'Van', 'Tot', 'Plek', 'Nodig', 'Ingeschreven', 'Wie (voornaam)', 'Wat je doet'], rijen);
}
export function csvBudget(act){
  const r = gesorteerd(act.budget).map(p => [p.soort === 'in' ? 'Inkomsten' : 'Uitgaven', p.naam, p.begroot ?? '', p.werkelijk ?? '']);
  const t = budgetTotaal(act.budget);
  r.push(['Saldo', '', t.saldoBegroot, t.saldoWerkelijk]);
  return csv(['Soort', 'Post', 'Begroot', 'Werkelijk'], r);
}
export function csvMateriaal(act){
  return csv(['Wat', 'Aantal', 'Wie neemt mee', 'Klaar'], gesorteerd(act.materiaal).map(m => [m.naam, m.aantal ?? '', act.comite?.[m.wie]?.naam || m.wie || '', m.klaar ? 'ja' : 'nee']));
}
/* Agenda-bestand: de activiteit zelf, plus (optioneel) de programmapunten als losse items. */
const icsTekst = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDT = (iso, tijd) => iso.replace(/-/g, '') + (tijd ? 'T' + tijd.replace(':', '') + '00' : '');
function icsVouw(regel){ const uit = []; let r = regel; while (r.length > 74){ uit.push(r.slice(0, 74)); r = ' ' + r.slice(74); } uit.push(r); return uit.join('\r\n'); }
export function ics(act, { id = 'act', programma = false, url = '', nu = Date.now() } = {}){
  if (!isIso(act.datum)) return '';
  const stamp = new Date(nu).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ev = [];
  const hele = !isTijd(act.start);
  ev.push(['BEGIN:VEVENT', `UID:${id}@cluppie.io`, `DTSTAMP:${stamp}`,
    hele ? `DTSTART;VALUE=DATE:${icsDT(act.datum)}` : `DTSTART;TZID=Europe/Amsterdam:${icsDT(act.datum, act.start)}`,
    hele ? `DTEND;VALUE=DATE:${icsDT(plusDagen(act.datum, 1))}` : `DTEND;TZID=Europe/Amsterdam:${icsDT(act.datum, isTijd(act.eind) ? act.eind : naarTijd(naarMin(act.start) + 120))}`,
    `SUMMARY:${icsTekst(act.naam)}`, act.locatie ? `LOCATION:${icsTekst(act.locatie)}` : '', `DESCRIPTION:${icsTekst([act.omschrijving, url].filter(Boolean).join('\n'))}`, 'END:VEVENT']);
  if (programma){
    for (const p of programmaLijst(act.programma, act.vertraging).lijst){
      if (!p.tijdNu) continue;
      ev.push(['BEGIN:VEVENT', `UID:${id}-${p.id}@cluppie.io`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Amsterdam:${icsDT(act.datum, p.tijdNu)}`,
        `DTEND;TZID=Europe/Amsterdam:${icsDT(act.datum, p.eindNu || p.tijdNu)}`, `SUMMARY:${icsTekst(p.wat)}`, p.waar ? `LOCATION:${icsTekst(p.waar)}` : '', 'END:VEVENT']);
    }
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cluppie//Activiteiten//NL', 'CALSCALE:GREGORIAN', ...ev.flat().filter(Boolean), 'END:VCALENDAR'].map(icsVouw).join('\r\n') + '\r\n';
}
/* Volledige back-up van één activiteit (JSON). Persoonsgegevens: alleen namen van het comité en voornamen van vrijwilligers. */
export function jsonExport(act, { diensten = null, aanmeldingen = [] } = {}){
  const a = JSON.parse(JSON.stringify(act));
  delete a.comiteUids;
  if (a.toernooi){ delete a.toernooi.liveId; delete a.toernooi.live; delete a.toernooi.inschrijfId; }
  for (const l of Object.values(a.comite || {})) delete l.uid;
  return JSON.stringify({ soort: 'cluppie-activiteit', versie: 1, activiteit: a, diensten: diensten || {}, aanmeldingen: (aanmeldingen || []).map(x => ({ dienst: x.dienst, naam: x.naam })) }, null, 2);
}
/* JSON terug: een export van een activiteit of een sjabloon. Geeft { soort:'activiteit'|'sjabloon', data } of een fout. */
export function jsonLees(tekstIn){
  let o;
  try { o = JSON.parse(String(tekstIn || '').replace(/^\ufeff/, '')); } catch { return { fout: 'Dit is geen geldig JSON-bestand.' }; }
  if (o?.soort === 'cluppie-activiteit'){
    if (Number(o.versie) > 1) return { fout: 'Dit bestand komt uit een nieuwere versie van Cluppie. Ververs de app en probeer het opnieuw.' };
    const a = o.activiteit;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return { fout: 'In dit bestand staat geen activiteit.' };
    if (!tekst(a.naam)) return { fout: 'De activiteit heeft geen naam.' };
    const diensten = o.diensten && typeof o.diensten === 'object' && !Array.isArray(o.diensten) ? o.diensten : {};
    return { soort: 'activiteit', data: a, diensten, inhoud: importInhoud(a, diensten) };
  }
  const sj = o?.soort === 'cluppie-sjabloon' ? o.sjabloon : o;
  const f = sjabloonFouten(sj);
  return f.length ? { fout: f.join(' ') } : { soort: 'sjabloon', data: sj };
}

/* ---------- [20261127m] activiteit uit een bestand (bv. van een andere club) ----------
   Het bestand komt van buiten. Alleen bekende velden gaan mee, met de grenzen van de app, en alleen ids die als
   veldnaam in Firestore kunnen (geen punten). Nooit mee: comiteUids en uid's (die geven toegang), teams van de
   andere club, de deellink, wie het maakte, aanmeldingen. Het toernooi schoont toernooi-logica.js (schoonToernooi). */
const num = (v, min, max) => (v === null || v === undefined || v === '' || typeof v === 'boolean' ? null : getal(v, min, max));
const goedId = id => /^[\w-]{1,40}$/.test(String(id || ''));
const isMap = m => !!m && typeof m === 'object' && !Array.isArray(m);
const schoonMap = (m, max, maak) => Object.fromEntries(Object.entries(isMap(m) ? m : {}).filter(([id, x]) => goedId(id) && isMap(x)).slice(0, max)
  .map(([id, x], i) => [id, { ...maak(x, id), volg: num(x.volg, 0, 9999) ?? i }]));
const prog = p => ({ tijd: isTijd(p.tijd) ? p.tijd : '', duur: num(p.duur, 0, 1440) ?? 0, wat: tekst(p.wat, 120), waar: tekst(p.waar, 60), wie: tekst(p.wie, 60) });
const naarOnderwerp = x => (goedId(x.onderwerp) ? { onderwerp: x.onderwerp } : {});
const veiligUrl = v => { const u = String(v ?? '').trim().slice(0, 500); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };
export function importInhoud(a = {}, diensten = {}){
  const n = m => Object.keys(isMap(m) ? m : {}).length, t = isMap(a.toernooi) ? a.toernooi : {};
  return { taken: n(a.taken), comite: n(a.comite), programma: n(a.programma), diensten: n(diensten) || (Array.isArray(a.dienstenSjabloon) ? a.dienstenSjabloon.length : 0),
    clubs: n(t.clubs), teams: n(t.teams), poules: n(t.poules), wedstrijden: Array.isArray(t.schema) ? t.schema.length : 0 };
}
export function schoonImport(a = {}, diensten = null){
  const fasen = Array.isArray(a.fasen) && a.fasen.length && a.fasen.every(f => isMap(f) && goedId(f.id)) ? a.fasen.slice(0, 10).map(f => ({ id: f.id, naam: tekst(f.naam, 40) || f.id })) : FASEN.map(f => ({ ...f }));
  const comite = schoonMap(a.comite, MAX.comite, l => ({ naam: tekst(l.naam, 60), rol: tekst(l.rol, 40) }));
  for (const [id, l] of Object.entries(comite)) if (!l.naam) delete comite[id];
  const lid = v => (comite[v] ? v : '');
  const tabs = Object.fromEntries(TABS.filter(([id]) => typeof a.tabs?.[id] === 'boolean').map(([id]) => [id, a.tabs[id]]));
  const antw = m => Object.fromEntries(Object.entries(isMap(m) ? m : {}).filter(([k, v]) => goedId(k) && typeof v === 'string').slice(0, 12).map(([k, v]) => [k, lang(v, 1000)]));
  const uit = {
    naam: tekst(a.naam, 80) || 'Activiteit', type: tekst(a.type, 40) || 'eigen', sjabloon: tekst(a.sjabloon, 40), datum: isIso(a.datum) ? a.datum : '',
    start: isTijd(a.start) ? a.start : '', eind: isTijd(a.eind) ? a.eind : '', locatie: tekst(a.locatie, 80), omschrijving: lang(a.omschrijving, 600), status: 'concept',
    tabs: { ...STD_TABS, ...tabs }, comite, comiteUids: [], rollen: (Array.isArray(a.rollen) ? a.rollen : []).map(r => tekst(r, 40)).filter(Boolean).slice(0, 20), fasen,
    taken: schoonMap(a.taken, MAX.taken, t => ({ titel: tekst(t.titel, 200) || 'Taak', fase: fasen.some(f => f.id === t.fase) ? t.fase : faseVan(Number(t.d)),
      eigenaar: lid(t.eigenaar), d: num(t.d, -365, 730), datum: isIso(t.datum) ? t.datum : '',
      status: STATUS_TAAK[t.status] ? t.status : 'open', notitie: lang(t.notitie, 1000), tip: tekst(t.tip, 400), rol: tekst(t.rol, 40), ...naarOnderwerp(t), ...(isMap(t.antw) ? { antw: antw(t.antw) } : {}) })),
    programma: schoonMap(a.programma, MAX.programma, prog), programmaB: schoonMap(a.programmaB, MAX.programma, prog),
    planB: { tekst: lang(a.planB?.tekst, 600), actief: false }, vertraging: 0,
    materiaal: schoonMap(a.materiaal, MAX.materiaal, m => ({ naam: tekst(m.naam, 80) || 'Spullen', aantal: Number(m.aantal) > 0 ? num(m.aantal, 1, 99999) : null, wie: comite[m.wie] ? m.wie : tekst(m.wie, 60), klaar: !!m.klaar, ...naarOnderwerp(m) })),
    berichten: schoonMap(a.berichten, MAX.berichten, b => ({ d: num(b.d, -365, 730) ?? 0, titel: tekst(b.titel, 80), tekst: lang(b.tekst, 1000), kanaal: KANALEN[b.kanaal] ? b.kanaal : 'whatsapp', geplaatstMs: null })),
    budget: schoonMap(a.budget, MAX.budget, p => ({ naam: tekst(p.naam, 60) || 'Post', soort: p.soort === 'in' ? 'in' : 'uit', begroot: num(p.begroot, 0, 1e7) ?? 0, werkelijk: num(p.werkelijk, 0, 1e7), ...naarOnderwerp(p) })),
    documenten: schoonMap(a.documenten, MAX.documenten, d => ({ naam: tekst(d.naam, 80) || 'Document', url: veiligUrl(d.url) })),
    checks: schoonMap(a.checks, MAX.checks, c => ({ titel: tekst(c.titel, 160), klaar: !!c.klaar })),
    deelnemers: { verwacht: num(a.deelnemers?.verwacht, 0, 100000), notitie: lang(a.deelnemers?.notitie, 600) },
    evaluatie: { goed: lang(a.evaluatie?.goed, 600), beter: lang(a.evaluatie?.beter, 600), tips: Object.fromEntries(Object.entries(isMap(a.evaluatie?.tips) ? a.evaluatie.tips : {}).filter(([k, v]) => goedId(k) && typeof v === 'string').slice(0, MAX.taken).map(([k, v]) => [k, tekst(v, 300)])) },
    teams: [], agenda: false, kamer: false, deelId: '',
  };
  for (const id of Object.keys(uit.documenten)) if (!uit.documenten[id].url) delete uit.documenten[id];
  for (const id of Object.keys(uit.checks)) if (!uit.checks[id].titel) delete uit.checks[id];
  if (isMap(a.onderwerpen)) uit.onderwerpen = Object.fromEntries(Object.entries(a.onderwerpen).filter(([id, o]) => goedId(id) && isMap(o)).slice(0, 20).map(([id, o]) => [id, {
    ...(o.naam ? { naam: tekst(o.naam, 60) } : {}), ...(o.icoon && goedId(o.icoon) ? { icoon: o.icoon } : {}), ...(lid(o.eigenaar) ? { eigenaar: o.eigenaar } : {}),
    ...(Number.isFinite(Number(o.volg)) ? { volg: num(o.volg, 0, 9999) } : {}), ...(o.eigen ? { eigen: true } : {}), ...(o.weg === true ? { weg: true } : {}),
    vragen: Object.fromEntries(Object.entries(isMap(o.vragen) ? o.vragen : {}).filter(([vid, v]) => goedId(vid) && isMap(v)).slice(0, 15).map(([vid, v]) => [vid,
      v.weg === true ? { weg: true } : { ...(v.vraag ? { vraag: tekst(v.vraag, 120), ph: tekst(v.ph, 120), volg: num(v.volg, 0, 9999) ?? 100 } : {}), antwoord: lang(v.antwoord, 1000) }])),
  }]));
  const bronDiensten = isMap(diensten) && Object.keys(diensten).length ? gesorteerd(diensten) : (Array.isArray(a.dienstenSjabloon) ? a.dienstenSjabloon : []);
  uit.dienstenSjabloon = bronDiensten.filter(isMap).slice(0, MAX.diensten).map(d => ({ naam: tekst(d.naam, 40) || 'Dienst', start: isTijd(d.start) ? d.start : '', eind: isTijd(d.eind) ? d.eind : '',
    plek: tekst(d.plek, 40), nodig: num(d.nodig, 0, 99) ?? 0, ...(d.wat ? { wat: dienstWat(d.wat) } : {}) }));
  return uit;
}
export const jsonSjabloon = sj => JSON.stringify({ soort: 'cluppie-sjabloon', versie: 1, sjabloon: sj }, null, 2);

/* ---------- import: taken uit CSV of Excel (opgeslagen als CSV) ---------- */
export function csvLees(invoer){
  const s = String(invoer || '').replace(/^\ufeff/, '');
  const eerste = s.split(/\r?\n/)[0] || '';
  const tel = t => eerste.split(t).length - 1;
  const sep = tel('\t') > Math.max(tel(';'), tel(',')) ? '\t' : tel(';') >= tel(',') ? ';' : ',';
  const rijen = []; let rij = [], cel = '', q = false;
  for (let i = 0; i < s.length; i++){
    const c = s[i];
    if (q){ if (c === '"'){ if (s[i + 1] === '"'){ cel += '"'; i++; } else q = false; } else cel += c; continue; }
    if (c === '"') q = true;
    else if (c === sep){ rij.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r'){ if (c === '\r' && s[i + 1] === '\n') i++; rij.push(cel); rijen.push(rij); rij = []; cel = ''; }
    else cel += c;
  }
  if (cel !== '' || rij.length){ rij.push(cel); rijen.push(rij); }
  return rijen.filter(r => r.some(c => String(c).trim() !== ''));
}
/* Herkent kolommen op hun kop (Taak/Titel, Dagen vooraf, Klaar vóór/Datum, Fase, Rol, Notitie, Tip, Status).
   Zonder herkenbare kop: eerste kolom = taak, tweede = dagen vooraf. */
export function takenUitCsv(invoer, datum = ''){
  const rijen = csvLees(invoer);
  if (!rijen.length) return { taken: [], fout: 'Het bestand is leeg.' };
  const kop = rijen[0].map(c => String(c).toLowerCase().trim());
  const zoek = (...w) => kop.findIndex(k => w.some(x => k.includes(x)));
  let iT = zoek('taak', 'titel', 'wat', 'actie'), iD = zoek('dagen'), iDat = zoek('klaar v', 'datum', 'deadline'), iF = zoek('fase'), iR = zoek('rol', 'wie', 'eigenaar'),
    iN = zoek('notitie', 'opmerking'), iTip = zoek('tip'), iS = zoek('status');
  let start = 1;
  if (iT < 0){ iT = 0; iD = rijen[0].length > 1 ? 1 : -1; start = isNaN(Number(String(rijen[0][1] || '').replace(',', '.'))) ? 1 : 0; }
  const fasen = Object.fromEntries(FASEN.map(f => [f.naam.toLowerCase(), f.id]));
  const taken = [];
  for (const r of rijen.slice(start)){
    const titel = tekst(r[iT], 200);
    if (!titel) continue;
    let d = iD >= 0 ? getal(r[iD], -365, 730) : null, vast = '';
    const dat = iDat >= 0 ? String(r[iDat] || '').trim() : '';
    const nl = dat.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    const iso = isIso(dat) ? dat : nl ? `${nl[3]}-${nl[2].padStart(2, '0')}-${nl[1].padStart(2, '0')}` : '';
    if (d === null && isIso(iso)){ if (isIso(datum)) d = dagenTussen(iso, datum); else vast = iso; }
    const st = iS >= 0 ? String(r[iS] || '').toLowerCase() : '';
    taken.push({ titel, d: d === null ? null : Math.round(d), datum: vast, fase: fasen[String(r[iF] || '').toLowerCase().trim()] || faseVan(d), rol: iR >= 0 ? tekst(r[iR], 40) : '',
      notitie: iN >= 0 ? tekst(r[iN], 500) : '', tip: iTip >= 0 ? tekst(r[iTip], 300) : '', status: st.startsWith('klaar') ? 'klaar' : st.startsWith('bezig') ? 'bezig' : 'open', eigenaar: '' });
    if (taken.length >= MAX.taken) break;
  }
  return { taken, fout: taken.length ? '' : 'Geen taken gevonden. Zet in de eerste kolom de taak.' };
}

/* ---------- voor de teams (agenda) en de open link ---------- */
/* Wat een coach of ouder over de activiteit mag zien (clubs/{id}/activiteitenAgenda/{actId}): geen budget, geen comité. */
export function agendaKopie(act, { clubNaam = '', link = '' } = {}){
  return { naam: tekst(act.naam, 80), datum: act.datum || '', start: act.start || '', eind: act.eind || '', locatie: tekst(act.locatie || '', 80),
    omschrijving: lang(act.omschrijving || '', 600), teams: (act.teams || []).slice(0, MAX.teams), kamer: act.kamer === true,
    status: act.status || 'gepland', planB: act.planB?.actief === true ? lang(act.planB.tekst || '', 600) : '', deelId: act.deelId || '', link, clubNaam: tekst(clubNaam, 80),
    vraag: act.vraag === true, vraagTot: isIso(act.vraagTot) ? act.vraagTot : '', seizoen: act.seizoen || '' };
}
export function schoneNaam(v){ return String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAAM_MAX).trim(); }
/* De dienst die iemand al heeft op het moment van deze dienst (geen dubbele inschrijving tegelijk) */
export function botstMet(diensten, mijn, dienstId){
  const d = diensten?.[dienstId];
  if (!d) return null;
  const s = naarMin(d.start), e = naarMin(d.eind);
  if (s === null || e === null) return null;
  for (const id of mijn || []){
    if (id === dienstId) continue;
    const x = diensten[id]; const xs = naarMin(x?.start), xe = naarMin(x?.eind);
    if (xs !== null && xe !== null && xs < e && s < xe) return id;
  }
  return null;
}

/* ---------- AI-concept: schoonmaken wat terugkomt ---------- */
/* De Cloud Function activiteitConceptAI geeft een sjabloon in JSON terug; hier wordt het veilig gemaakt. */
export function schoonConcept(o){
  if (!o || typeof o !== 'object') return null;
  const lijst = (x, n) => (Array.isArray(x) ? x : []).slice(0, n);
  const sj = {
    id: '', naam: tekst(o.naam || 'Nieuwe activiteit', 80), type: 'eigen', omschrijving: lang(o.omschrijving || '', 600),
    start: isTijd(o.start) ? o.start : '', eind: isTijd(o.eind) ? o.eind : '',
    rollen: lijst(o.rollen, 12).map(r => tekst(r, 40)).filter(Boolean),
    taken: lijst(o.taken, 80).map(t => ({ t: tekst(t?.t ?? t?.titel, 200), d: Number.isFinite(Number(t?.d)) ? Math.max(-60, Math.min(365, Math.round(Number(t.d)))) : null, rol: tekst(t?.rol || '', 40), tip: tekst(t?.tip || '', 300) })).filter(t => t.t),
    programma: lijst(o.programma, 40).map(p => ({ tijd: isTijd(p?.tijd) ? p.tijd : '', duur: Math.max(0, Math.min(600, Number(p?.duur) || 0)), wat: tekst(p?.wat, 120), waar: tekst(p?.waar || '', 60), wie: tekst(p?.wie || '', 60) })).filter(p => p.wat),
    planB: { tekst: lang(o.planB?.tekst ?? o.planB ?? '', 600) },
    diensten: lijst(o.diensten, 30).map(d => ({ naam: tekst(d?.naam, 40), start: isTijd(d?.start) ? d.start : '', eind: isTijd(d?.eind) ? d.eind : '', plek: tekst(d?.plek || '', 40), nodig: Math.max(0, Math.min(50, Number(d?.nodig) || 0)) })).filter(d => d.naam),
    materiaal: lijst(o.materiaal, 60).map(m => ({ naam: tekst(m?.naam ?? m, 80), aantal: Number(m?.aantal) > 0 ? Math.round(Number(m.aantal)) : null })).filter(m => m.naam),
    berichten: lijst(o.berichten, 10).map(b => ({ d: Number.isFinite(Number(b?.d)) ? Math.round(Number(b.d)) : 0, titel: tekst(b?.titel, 80), tekst: lang(b?.tekst, 1000), kanaal: KANALEN[b?.kanaal] ? b.kanaal : 'whatsapp' })).filter(b => b.titel && b.tekst),
    budget: lijst(o.budget, 30).map(p => ({ naam: tekst(p?.naam, 60), soort: p?.soort === 'in' ? 'in' : 'uit', begroot: Math.max(0, Number(p?.begroot) || 0) })).filter(p => p.naam),
    checks: lijst(o.checks, 20).map(c => tekst(c, 160)).filter(Boolean),
  };
  return sj.taken.length || sj.programma.length ? sj : null;
}
