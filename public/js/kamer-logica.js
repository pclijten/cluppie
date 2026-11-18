/* ==================== TEAMKAMER — pure logica voor de browser [20261116m] ====================
   Gedeeld door de pagina van ouders en spelers (kamer-app.js) en het beheerscherm van de trainer
   (kamer-beheer.js). Zonder imports, dus los te testen (tests/teamkamer.test.mjs) en zonder
   versie-cascade. De server heeft zijn eigen logica (functions/teamkamer-logica.js): die bepaalt wat
   een ouder mag zien; dit bestand bepaalt alleen hoe het wordt getoond. */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const d12 = (iso) => new Date(iso + 'T12:00:00');
export const vandaagIso = (nu = new Date()) => `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
export const datumLang = (iso) => { const d = d12(iso); return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`; };
export const datumKort = (iso) => { const d = d12(iso); return `${DAGEN[d.getDay()].slice(0, 2)} ${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)}`; };
export const datumDelen = (iso) => { const d = d12(iso); return { dag: DAGEN[d.getDay()].slice(0, 2), nr: String(d.getDate()), maand: MAANDEN[d.getMonth()].slice(0, 3) }; };
export const hoofdletter = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/* ---------- spelers ---------- */
/* spelers: { id: { n, nr } | { v: true } } uit teamkamer/{teamId}. Verborgen of onbekend = "Speler". */
export function spelerNaam(spelers, id){ const p = spelers && spelers[id]; return p && p.n ? p.n : 'Speler'; }
export function namenLijst(spelers, ids){
  const zichtbaar = [], verborgen = [];
  (ids || []).forEach(id => { const p = spelers && spelers[id]; (p && p.n ? zichtbaar : verborgen).push(p && p.n ? p.n : id); });
  zichtbaar.sort((a, b) => a.localeCompare(b, 'nl'));
  if (verborgen.length) zichtbaar.push(verborgen.length === 1 ? '1 speler' : `${verborgen.length} spelers`);
  return zichtbaar.join(', ');
}

/* ---------- agenda ---------- */
export function sorteerAgenda(items){
  return [...items].sort((a, b) => (a.datum + (a.tijd || '99')).localeCompare(b.datum + (b.tijd || '99')));
}
export const komend = (items, vandaag) => sorteerAgenda(items).filter(i => i.datum >= vandaag);
export const geweest = (items, vandaag) => sorteerAgenda(items).filter(i => i.datum < vandaag).reverse();
export function itemTitel(i){
  if (i.soort === 'training') return 'Training';
  const t = i.tegenstander || 'tegenstander nog onbekend';
  return i.thuis ? `Wedstrijd, thuis tegen ${t}` : `Wedstrijd, uit bij ${t}`;
}
export function itemSub(i){
  if (i.afgelast) return 'Afgelast';
  if (i.soort === 'training') return i.tijd ? (i.eind ? `${i.tijd} tot ${i.eind}` : i.tijd) : 'Tijd volgt';
  return [i.verzamel && `Verzamelen ${i.verzamel}`, i.tijd && `aftrap ${i.tijd}`].filter(Boolean).join(', ') || 'Tijd volgt';
}
/* "12 van 14" als de selectie bekend is, anders alleen hoeveel er afwezig zijn */
export function itemTelling(i, aantal){
  const af = (i.afwezig || []).length;
  if (i.erbij) return `${i.erbij} erbij`;
  if (aantal) return `${Math.max(0, aantal - af)} van ${aantal}`;
  return af ? `${af} afwezig` : '';
}
/* [20261116r] nietMee = de wedstrijden waarvoor de trainer dit kind niet selecteerde (alleen het eigen gezin krijgt die lijst) */
export const eigenStatus = (i, spelerId, nietMee) => ((i.afwezig || []).includes(spelerId) ? 'Afwezig' : (nietMee || []).includes(i.id) ? 'Niet in de selectie' : 'Erbij');

/* ---------- opstelling op een veld [20261116p] ----------
   De kopie bevat de plekken van de eerste periode ({ K: id, V1: id, M2: id … }) en de formatie ("3-3-1").
   Zelfde verdeling als parseFormatie in config.js (die module hoort bij de trainersapp en laden we hier niet):
   linies van achter naar voren, spelers per linie van links naar rechts. Geeft [] als er niets te tekenen is. */
function spreidX(aantal){
  const marge = { 1: 0, 2: 32, 3: 22, 4: 14, 5: 10, 6: 8 }[aantal] ?? 12;
  if (aantal === 1) return [50];
  return Array.from({ length: aantal }, (_, i) => Math.round(marge + (100 - 2 * marge) * i / (aantal - 1)));
}
export function veldPlekken(op){
  const plekken = (op && op.plekken) || {}, ids = Object.keys(plekken);
  if (!ids.length) return [];
  let lijnen = String((op && op.formatie) || '').trim().split(/[-\s.]+/).filter(d => /^\d+$/.test(d)).map(Number);
  const tel = (l) => ids.filter(k => k[0] === l).reduce((m, k) => Math.max(m, Number(k.slice(1)) || 0), 0);
  const som = lijnen.reduce((a, b) => a + b, 0), nodig = tel('V') + tel('M') + tel('A');
  if (lijnen.length < 2 || lijnen.some(x => x < 1 || x > 6) || som < nodig) lijnen = [tel('V'), tel('M'), tel('A')].filter(Boolean);   /* onbekende formatie: de linies die er zijn */
  const uit = [], n = lijnen.length, nr = { V: 0, M: 0, A: 0 };
  if (plekken.K) uit.push({ plek: 'K', x: 50, y: 90, spelerId: plekken.K });
  lijnen.forEach((aantal, idx) => {
    const rol = n === 1 ? 'M' : idx === 0 ? 'V' : idx === n - 1 ? 'A' : 'M';
    const y = n === 1 ? 49 : Math.round(74 - (74 - 20) * idx / (n - 1));
    spreidX(aantal).forEach(x => { nr[rol]++; const plek = rol + nr[rol]; if (plekken[plek]) uit.push({ plek, x, y, spelerId: plekken[plek] }); });
  });
  return uit;
}

/* ---------- afmelden via WhatsApp: Cluppie verstuurt en bewaart niets ---------- */
export function afmeldTekst(naam, i){
  const wat = i.soort === 'training' ? 'training' : `wedstrijd${i.tegenstander ? ' tegen ' + i.tegenstander : ''}`;
  return `${naam} is er ${datumLang(i.datum)} niet bij (${wat}).`;
}
export const waUrl = (tekst) => 'https://wa.me/?text=' + encodeURIComponent(tekst);

/* ---------- agenda-bestand (.ics), zonder namen van kinderen ---------- */
const icsTekst = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTijd = (datum, tijd) => datum.replace(/-/g, '') + 'T' + (tijd || '00:00').replace(':', '') + '00';
function plusMinuten(datum, tijd, min){
  const d = new Date(`${datum}T${tijd}:00`); d.setMinutes(d.getMinutes() + min);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}
export function maakIcs(items, teamNaam, nu = new Date()){
  const stempel = nu.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cluppie//Teamkamer//NL', 'CALSCALE:GREGORIAN'];
  for (const i of items){
    if (i.afgelast || !i.datum) continue;
    const start = i.soort === 'wedstrijd' ? (i.verzamel || i.tijd) : i.tijd;
    r.push('BEGIN:VEVENT', `UID:${i.id}@teamkamer.cluppie.io`, `DTSTAMP:${stempel}`);
    if (start){
      r.push(`DTSTART;TZID=Europe/Amsterdam:${icsTijd(i.datum, start)}`);
      const eind = i.soort === 'training' && i.eind ? icsTijd(i.datum, i.eind) : plusMinuten(i.datum, i.soort === 'wedstrijd' && i.tijd ? i.tijd : start, i.soort === 'wedstrijd' ? 90 : 60);
      r.push(`DTEND;TZID=Europe/Amsterdam:${eind}`);
    } else {
      const morgen = new Date(i.datum + 'T12:00:00'); morgen.setDate(morgen.getDate() + 1);
      r.push(`DTSTART;VALUE=DATE:${i.datum.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${vandaagIso(morgen).replace(/-/g, '')}`);
    }
    r.push(`SUMMARY:${icsTekst((teamNaam ? teamNaam + ': ' : '') + itemTitel(i))}`);
    const plek = [i.plek, i.veld, i.adres, i.plaats].filter(Boolean).join(', ');
    if (plek) r.push(`LOCATION:${icsTekst(plek)}`);
    if (i.soort === 'wedstrijd' && i.tijd) r.push(`DESCRIPTION:${icsTekst('Aftrap ' + i.tijd + (i.vertrek ? ', vertrek ' + i.vertrek : ''))}`);
    r.push('END:VEVENT');
  }
  r.push('END:VCALENDAR');
  return r.join('\r\n');
}

/* ---------- polls ---------- */
export const SJABLONEN = [
  { id: 'rijden', naam: 'Wie rijdt', vraag: (w) => `Wie rijdt ${w ? datumLang(w.datum).split(' ')[0] : 'zaterdag'}${w && w.tegenstander ? ' naar ' + w.tegenstander : ''}?`, opties: ['Wij rijden', 'Deze keer niet'], wedstrijd: true, nodig: 4 },
  { id: 'wassen', naam: 'Wie wast', vraag: () => 'Wie wast de shirts na de wedstrijd?', opties: ['Wij wassen', 'Deze keer niet'], wedstrijd: true },
  { id: 'fruit', naam: 'Fruit', vraag: () => 'Wie neemt fruit mee voor de rust?', opties: ['Wij nemen fruit mee', 'Deze keer niet'], wedstrijd: true },
  { id: 'vlaggen', naam: 'Vlaggen', vraag: () => 'Wie vlagt bij de wedstrijd?', opties: ['Ik vlag', 'Deze keer niet'], wedstrijd: true },
  { id: 'uitje', naam: 'Teamuitje', vraag: () => 'Welke datum past voor het teamuitje?', opties: ['Datum 1', 'Datum 2', 'Datum 3'], wedstrijd: false, meer: true },
  { id: 'vrij', naam: 'Eigen vraag', vraag: () => '', opties: ['', ''], wedstrijd: false },
];
export const BEURT_SOORTEN = ['rijden', 'wassen', 'fruit', 'vlaggen'];
export const BEURT_NAMEN = { rijden: 'Rijden', wassen: 'Wassen', fruit: 'Fruit', vlaggen: 'Vlaggen' };
/* Het document dat de trainer plaatst. Geeft { fout } of { poll }. */
export function maakPoll(f){
  const vraag = String(f.vraag || '').trim().slice(0, 140);
  const teksten = (f.opties || []).map(t => String(t || '').trim().slice(0, 80)).filter(Boolean);
  if (!vraag) return { fout: 'Typ een vraag.' };
  if (teksten.length < 2) return { fout: 'Geef minstens twee antwoorden.' };
  if (teksten.length > 12) return { fout: 'Maximaal 12 antwoorden.' };
  if (new Set(teksten.map(t => t.toLowerCase())).size !== teksten.length) return { fout: 'Twee antwoorden zijn hetzelfde.' };
  const soort = BEURT_SOORTEN.includes(f.soort) || f.soort === 'uitje' ? f.soort : 'vrij';
  const poll = { vraag, opties: teksten.map((tekst, n) => ({ id: 'o' + (n + 1), tekst })), soort,
    meer: f.meer === true, namen: f.namen !== false, spelers: f.spelers === true, status: 'open',
    wedstrijdId: f.wedstrijdId || null, wedstrijdDatum: f.wedstrijdId ? (f.wedstrijdDatum || null) : null,
    nodig: soort === 'rijden' && Number(f.nodig) > 0 ? Math.min(9, Math.round(Number(f.nodig))) : null };
  return { poll };
}
/* Hoe een poll eruitziet voor wie kijkt. keuzes = de eigen stem (lijst van optie-id's). */
export function pollWeergave(poll, spelers, keuzes, aantalGezinnen){
  const telling = poll.telling || {}, eigen = new Set(keuzes || []);
  const max = Math.max(1, aantalGezinnen || 0, ...Object.values(telling).map(Number));
  const opties = (poll.opties || []).map(o => {
    const n = Number(telling[o.id]) || 0;
    return { id: o.id, tekst: o.tekst, aantal: n, pct: Math.round((n / max) * 100), gekozen: eigen.has(o.id),
      namen: poll.wie && poll.wie[o.id] ? namenLijst(spelers, poll.wie[o.id]) : '' };
  });
  const ja = opties[0] ? opties[0].aantal : 0;
  return { opties, gestemd: Number(poll.gestemd) || 0, open: poll.status === 'open',
    nodig: poll.nodig ? `${ja} van ${poll.nodig} auto\u2019s` : '' };
}
/* [20261116p] De eigen stem meteen meetellen. De server telt (kamerStem) en dat duurt een paar tellen; tot die
   tijd liet de pagina wel "Jouw stem" zien maar nog het oude aantal. geteld = de eigen keuzes die al in
   poll.telling zitten, nu = wat het gezin net koos. Geeft een kopie van de poll met telling, gestemd en wie
   alsof de server al geteld had. */
export function pollMetEigen(poll, spelerId, geteld, nu){
  const oud = new Set(geteld || []), nieuw = new Set(nu || []);
  if (!spelerId || (oud.size === nieuw.size && [...oud].every(k => nieuw.has(k)))) return poll;
  const telling = { ...(poll.telling || {}) }, wie = poll.wie ? Object.fromEntries(Object.entries(poll.wie).map(([k, v]) => [k, [...v]])) : null;
  for (const o of (poll.opties || [])){
    const d = (nieuw.has(o.id) ? 1 : 0) - (oud.has(o.id) ? 1 : 0);
    if (!d) continue;
    telling[o.id] = Math.max(0, (Number(telling[o.id]) || 0) + d);
    if (wie){ const rij = (wie[o.id] || []).filter(x => x !== spelerId); if (d > 0) rij.push(spelerId); wie[o.id] = rij; }
  }
  const gestemd = Math.max(0, (Number(poll.gestemd) || 0) + (nieuw.size ? 1 : 0) - (oud.size ? 1 : 0));
  return { ...poll, telling, gestemd, ...(wie ? { wie } : {}) };
}
/* Heeft de server de stem van `ms` al meegeteld? Met geteldMs (nieuwe server) weten we het zeker; zonder
   dat veld nemen we aan van wel zodra de telling is veranderd sinds de tik. */
export function stemGeteld(poll, ms, tellingBijTik){
  if (Number(poll.geteldMs) > 0) return Number(poll.geteldMs) >= ms;
  return JSON.stringify(poll.telling || {}) !== tellingBijTik;
}
/* nieuwe eigen keuze na een tik op een antwoord */
export function kiesOptie(poll, keuzes, optieId){
  const nu = new Set(keuzes || []);
  if (nu.has(optieId)) nu.delete(optieId);
  else { if (poll.meer !== true) nu.clear(); nu.add(optieId); }
  return (poll.opties || []).map(o => o.id).filter(id => nu.has(id));
}
export const magStemmen = (poll, rol) => poll.status === 'open' && (rol === 'ouder' || poll.spelers === true);
export function sorteerPolls(polls){
  return [...polls].sort((a, b) => (a.status === b.status ? (b.gemaaktMs || 0) - (a.gemaaktMs || 0) : a.status === 'open' ? -1 : 1));
}
/* wie stemde nog niet (alleen voor de trainer): spelers zonder stem */
export function nogNiet(spelerIds, stemIds){ const s = new Set(stemIds); return spelerIds.filter(id => !s.has(id)); }

/* ---------- nieuw voor dit toestel [20261116p]: mededelingen na de laatste keer "Gelezen" en polls waar nog op gestemd moet worden ---------- */
export const nieuweBerichten = (berichten, gelezenMs) => (berichten || []).filter(b => (Number(b.ms) || 0) > (Number(gelezenMs) || 0));
export const nogStemmen = (polls, stemmen, rol) => (polls || []).filter(p => magStemmen(p, rol) && Array.isArray(stemmen[p.id]) && !stemmen[p.id].length);

/* ---------- weer bij de club (Open-Meteo; alleen coördinaten en datum gaan naar buiten) ---------- */
export function weerUrl(plek, datum){
  if (!plek || !Number.isFinite(plek.lat) || !Number.isFinite(plek.lon)) return '';
  return `https://api.open-meteo.com/v1/forecast?latitude=${plek.lat.toFixed(2)}&longitude=${plek.lon.toFixed(2)}&hourly=temperature_2m,precipitation_probability,weathercode&timezone=Europe%2FAmsterdam&start_date=${datum}&end_date=${datum}`;
}
export function weerTekst(json, tijd){
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time)) return '';
  const uur = (tijd || '10:00').slice(0, 2);
  const n = h.time.findIndex(t => t.slice(11, 13) === uur);
  if (n < 0 || h.temperature_2m[n] == null) return '';
  const kans = Number(h.precipitation_probability && h.precipitation_probability[n]) || 0;
  return `${Math.round(h.temperature_2m[n])} °C, ${kans >= 60 ? 'grote kans op regen' : kans >= 30 ? 'kans op regen' : 'waarschijnlijk droog'}`;
}
export const binnenDagen = (datum, vandaag, n) => { const a = d12(vandaag), b = d12(datum); return (b - a) / 864e5 >= 0 && (b - a) / 864e5 <= n; };

/* ---------- thuis oefenen: video's (YouTube of een video die de club in Cluppie zette) ----------
   Zelfde regels als functions/teamkamer-logica.js: van YouTube bewaren we alleen de video-id, een eigen
   video moet in de opslag van Cluppie staan. Iets anders komt niet in de teamkamer. */
export const MAX_THUIS_VIDEOS = 6;
export function youtubeId(url){
  const m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^ #]*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
export const isCluppieVideo = (url) => /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[a-z0-9.-]+\/o\/clubs%2F/.test(String(url || ''));
/* Maakt van een link of een clubvideo het stukje dat op het teamdocument komt. null = niet bruikbaar. */
export function thuisVideo(v){
  const titel = String((v && v.titel) || '').trim().slice(0, 80);
  const yt = v && v.bron !== 'upload' ? youtubeId(v.yt ? 'https://youtu.be/' + v.yt : v.url) : '';
  if (yt) return { titel: titel || 'Video', yt };
  if (v && isCluppieVideo(v.url)) return { titel: titel || 'Video', url: String(v.url) };
  return null;
}
export const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;
export const ytThumb = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

/* ---------- codes ---------- */
export const schoonCode = (v, n) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n);
export const toonCode = (c) => (c && c.length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c || '');
/* voorstel bij een aanvraag: welke speler bedoelt de ouder? (voornaam, hoofdletterongevoelig) */
export function raadSpeler(spelers, kind){
  const k = String(kind || '').trim().toLowerCase().split(/\s+/)[0];
  if (!k) return '';
  const hits = spelers.filter(p => String(p.naam || '').trim().toLowerCase().split(/\s+/)[0] === k);
  return hits.length === 1 ? hits[0].id : '';
}

/* ---------- mag dit team een teamkamer hebben? (de eindbaas zet het aan; de server controleert het ook) ---------- */
export function teamkamerMag(team, clubPlatform, losAan){
  if (!team) return false;
  if (team.club) return !!(clubPlatform && clubPlatform.platformModules && clubPlatform.platformModules.teamkamer === true);
  return losAan === true;
}
/* met www: het certificaat van de site geldt alleen voor www.cluppie.io, zonder www meldt de browser "niet beveiligd" */
export const KAMER_URL = 'https://www.cluppie.io/kamer.html';
export const linkTekst = (teamNaam, code) => `Meld je aan voor de teamkamer van ${teamNaam || 'ons team'} in Cluppie: ${KAMER_URL}?k=${code}\nJe ziet de agenda, wie erbij is en de polls. Afmelden blijft via deze groep.`;
export const pollTekst = (vraag, id) => `Nieuwe poll in de teamkamer: ${vraag}\n${KAMER_URL}?poll=${id}`;
/* de ouder stuurt de code door naar het eigen kind; de code werkt 15 minuten en één keer */
export const kindCodeTekst = (naam, code) => `${naam ? naam + ', dit' : 'Dit'} is je code voor de teamkamer in Cluppie: ${toonCode(code)}
Open ${KAMER_URL} en vul hem in bij "Ik ben speler". De code werkt 15 minuten.`;
export const berichtTekst = () => `Er staat een nieuwe mededeling in de teamkamer: ${KAMER_URL}`;

/* ---------- mogelijkheden die de eindbaas per club (of voor trainers zonder club) aan- en uitzet ----------
   Zelfde sleutels als functions/teamkamer-logica.js (tests/teamkamer.test.mjs vergelijkt ze). Alles staat
   standaard uit: met alleen de hoofdschakelaar aan zien ouders de agenda en hoeveel spelers erbij zijn. */
export const OPTIES = [
  ['namen', 'Voornamen van teamgenoten', 'Ouders zien wie erbij is en wie niet, met voornaam. Uit: alleen aantallen.'],
  ['spelers', 'Spelers zelf', 'Een kind komt binnen met een code van de eigen ouder, zonder e-mailadres.'],
  ['polls', 'Polls', 'Wie rijdt, wie wast, teamuitje of een eigen vraag. Los of bij een wedstrijd.'],
  ['beurten', 'Beurtenteller', 'Telt bij het sluiten van een poll wie reed, waste, fruit meenam of vlagde.'],
  ['berichten', 'Mededelingen', 'Korte berichten van de trainer. Ouders kunnen niet reageren.'],
  ['afmelden', 'Afmelden via WhatsApp', 'Knop die het afmeldbericht klaarzet. In Cluppie verandert niets.'],
  ['uitslag', 'Uitslag', 'De trainer mag de uitslag tonen, de dag na de wedstrijd.'],
  ['live', 'Live stand', 'De trainer mag de stand tijdens de wedstrijd tonen, zonder namen.'],
  ['opstelling', 'Opstelling delen', 'De trainer mag per wedstrijd de opstelling delen.'],
  ['thuis', 'Thuis oefenen', 'De trainer kiest een oefening die spelers thuis in 3D bekijken.'],
  ['lijn', 'Zo moedigen wij aan', 'Drie afspraken voor langs de lijn, rond een wedstrijd.'],
  ['agenda', 'Agenda-bestand', 'Ouders zetten trainingen en wedstrijden in hun eigen agenda.'],
  ['weer', 'Weerbericht', 'Het weer bij de club op de wedstrijddag (via Open-Meteo).'],
  ['trainingen', 'Trainingen bekijken', 'De trainer mag de komende trainingen tonen: thema, oefeningen en 3D. Alleen kijken.'],
  ['stats', 'Cijfers van het eigen kind', 'De trainer mag ouders de cijfers van hun eigen kind tonen. Nooit van anderen, nooit een ranglijst.'],
  ['hulp', 'Trainingshulp', 'Ouders schrijven zich in de teamkamer in als helper bij een training (Lijstjes). Andere ouders zien hun voornaam.'],
];
/* [20261116r] welke cijfers de trainer per team aanzet (zelfde sleutels als STATS_SOORTEN op de server) */
export const STATS_SOORTEN = [
  ['wedstrijden', 'Wedstrijden', 'Hoeveel wedstrijden het kind meedeed'],
  ['speeltijd', 'Speeltijd', 'Percentage en minuten per wedstrijd'],
  ['doelpunten', 'Doelpunten en assists', ''],
  ['opkomst', 'Opkomst bij trainingen', ''],
  ['kaarten', 'Kaarten', ''],
];
/* Wat de app van de trainer van één training aanlevert voor ouders. De server laat er nog een keer alleen de
   toegestane velden van door (schoonTraining). Aantekeningen, coachpunten, differentiatie en video's gaan niet mee. */
export function trainingVoorOuders(t){
  const doel = (o) => { const b = (o.blokken || []).find(x => x && x.veld === 'doel' && x.type === 'tekst' && x.tekst); return b ? String(b.tekst).slice(0, 300) : ''; };
  return { titel: String(t.titel || '').slice(0, 80), thema: String(t.thema || (t.plan && t.plan.thema) || '').slice(0, 80),
    vormen: (Array.isArray(t.oefeningen) ? t.oefeningen : []).filter(o => o && o.titel).slice(0, 8)
      .map(o => ({ naam: String(o.titel).slice(0, 80), slot: String((o.bron && o.bron.slot) || '').slice(0, 30), min: Number(o.bron && o.bron.minuten) || 0, vormId: String((o.bron && o.bron.vormId) || ''), doel: doel(o) })) };
}
/* Cijfers per speler uit wat de trainersapp al berekent. analyse = analyseWedstrijd, reserve = speeltijdReserve
   (analyse.js), opkomst = opkomstVoor (opkomst.js): meegegeven, zodat dit bestand zonder imports blijft. */
export function statsVoorOuders(spelers, wedstrijden, presentie, { analyse, reserve, opkomst }){
  const gespeeld = wedstrijden.map(w => ({ w, a: analyse(w) })).filter(x => x.a.kwarten && x.a.matchduur).sort((x, y) => String(y.w.datum).localeCompare(String(x.w.datum)));
  const sr = reserve(wedstrijden), uit = {};
  for (const p of spelers){
    const mee = gespeeld.filter(x => (x.w.selectie || []).includes(p.id)), r = sr[p.id], o = opkomst(p, presentie);
    const tel = (lijst, f) => lijst.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
    uit[p.id] = {
      gespeeld: mee.filter(x => x.a.tijd[p.id] > 0).length, totaal: gespeeld.length,
      pct: r && r.speelbaar > 0 ? Math.round((r.speeltijd / r.speelbaar) * 100) : null,
      laatste: mee.slice(0, 5).map(x => ({ datum: String(x.w.datum).slice(0, 10), min: Math.round((x.a.tijd[p.id] || 0) / 60), van: Math.round(x.a.matchduur / 60) })),
      doelpunten: wedstrijden.reduce((n, w) => n + tel(w.goals || [], g => g.type === 'voor' && g.pid === p.id), 0),
      assists: wedstrijden.reduce((n, w) => n + tel(w.goals || [], g => g.type === 'voor' && g.assist === p.id), 0),
      geel: wedstrijden.reduce((n, w) => n + tel(w.kaarten || [], c => !c.auto && c.type === 'geel' && c.pid === p.id), 0),
      rood: wedstrijden.reduce((n, w) => n + tel(w.kaarten || [], c => !c.auto && c.type === 'rood' && c.pid === p.id), 0),
      trErbij: o.aanwezig || 0, trTotaal: o.totaal || 0,
    };
  }
  return uit;
}
/* de cijfers van één ouder als tegels: [getal, bijschrift] */
export function statsTegels(s){
  const uit = [];
  if (!s) return uit;
  if (s.wedstrijden) uit.push([`${s.wedstrijden.gespeeld} van ${s.wedstrijden.totaal}`, 'wedstrijden']);
  if (s.speeltijd && s.speeltijd.pct != null) uit.push([`${s.speeltijd.pct}%`, 'speeltijd']);
  if (s.trainingen && s.trainingen.totaal) uit.push([`${s.trainingen.erbij} van ${s.trainingen.totaal}`, 'trainingen']);
  if (s.doelpunten != null) uit.push([String(s.doelpunten), s.doelpunten === 1 ? 'doelpunt' : 'doelpunten'], [String(s.assists || 0), s.assists === 1 ? 'assist' : 'assists']);
  if (s.kaarten) uit.push([String((s.kaarten.geel || 0) + (s.kaarten.rood || 0)), 'kaarten']);
  return uit;
}
export function opties(bron){ const uit = {}; for (const [k] of OPTIES) uit[k] = !!(bron && bron[k] === true); return uit; }
export const optiesVan = (team, clubPlatform, losOpties) => opties(team && team.club ? (clubPlatform && clubPlatform.platformModules && clubPlatform.platformModules.teamkamerOpties) : losOpties);

/* ==================== trainingshulp [20261118a] ====================
   Ouders schrijven zich in als helper bij een training. De lijst maakt de trainer in Lijstjes
   (lijst-hulp.js); de gegevens staan in hulpDeel/{id} en hulpDeel/{id}/aanmeldingen. Hier alleen
   het rekenwerk voor de pagina van ouders, zonder Firebase (tests/teamkamer.test.mjs).
   lijsten = [{ id, deel:{ momenten:{ d20261123:{ datum, start, eind, nodig } } }, aanm:[{ id, uid, rij, naam, ms, door }] }] */
export const HULP_NAAM_MAX = 24;
export const hulpRijId = (datum) => 'd' + String(datum || '').replace(/-/g, '');
export const hulpNaam = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, HULP_NAAM_MAX);
/* een aanmelding uit de teamkamer staat onder <uid>_<rij>: één per ouder per training */
export const hulpEigenId = (uid, rij) => `${uid}_${rij}`;
function hulpMoment(l, rij, uid){
  const m = l && l.deel && l.deel.momenten && l.deel.momenten[rij];
  if (!m || !m.datum) return null;
  const helpers = ((l && l.aanm) || []).filter(a => a && a.rij === rij && a.naam).sort((a, b) => (a.ms || 0) - (b.ms || 0));
  const nodig = Math.max(0, Number(m.nodig) || 0);
  if (!nodig && !helpers.length) return null;
  const eigen = helpers.find(a => a.uid === uid && a.door === 'kamer');
  return { deelId: l.id, rij, datum: String(m.datum), start: m.start || '', eind: m.eind || '', nodig, helpers,
    vrij: Math.max(0, nodig - helpers.length), ik: !!eigen, ikNaam: eigen ? eigen.naam : '' };
}
/* de trainingshulp op één datum: de eerste lijst (op id) waarin die training staat */
export function hulpOpDatum(lijsten, datum, uid){
  const rij = hulpRijId(datum);
  for (const l of [...(lijsten || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))){
    const h = hulpMoment(l, rij, uid);
    if (h) return h;
  }
  return null;
}
/* komende trainingen waar nog hulp nodig is en waar deze ouder niet al helpt, binnen `dagen` */
export function hulpGezocht(lijsten, vandaag, uid, dagen = 14){
  const data = new Set();
  for (const l of lijsten || []) for (const m of Object.values((l && l.deel && l.deel.momenten) || {})) if (m && m.datum) data.add(String(m.datum));
  return [...data].filter(d => binnenDagen(d, vandaag, dagen)).sort()
    .map(d => hulpOpDatum(lijsten, d, uid)).filter(h => h && h.vrij > 0 && !h.ik);
}
export const hulpPlekken = (n) => (n === 1 ? '1 plek' : `${n} plekken`);
/* "Sandra (jij), Mark, nog 1 plek" of "Nog niemand, 2 plekken" */
export function hulpRegel(h, uid){
  const namen = [...h.helpers.filter(a => a.uid === uid && a.door === 'kamer').map(a => `${a.naam} (jij)`),
    ...h.helpers.filter(a => !(a.uid === uid && a.door === 'kamer')).map(a => a.naam)];
  if (!namen.length) return `Nog niemand, ${hulpPlekken(h.vrij)}`;
  return namen.join(', ') + (h.vrij ? `, nog ${hulpPlekken(h.vrij)}` : '');
}
export const hulpTijd = (h) => (h.start && h.eind ? `${h.start} tot ${h.eind}` : h.start || '');
