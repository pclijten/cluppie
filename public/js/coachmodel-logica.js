/* ==================== COACHMODEL — logica (zonder DOM en zonder Firestore) ====================
   [20261019h] Een trainer ontdekt hoe hij of zij coacht: 12 korte situaties (twee per onderdeel), een schets met zes balken
   en één zin, en per onderdeel zelf bevestigen of corrigeren ("Klopt dit?"). Daarna kiest de trainer een accent van de week
   (een kleine proef) en kijkt na vier trainingen terug. Het model is een door de trainer bevestigde schets, geen
   persoonlijkheidsprofiel en geen label. Het is persoonlijk: alleen de trainer ziet het (gebruikers/{uid}/coachmodel/huidig).

   Wat het model doet in de training:
     - de coachkaart bij elke vorm krijgt een verpakking die past (A of B), met kernpunt, vraag en keuze uit de VORM;
     - de enige invloed op de selectie: wie "laten lopen" bevestigt, krijgt bij gelijke score vormen met doorlopend spel (+1).
   Alle teksten zijn sjablonen, geen AI. Geen spelersgegevens in het model.
   Zonder imports: scherm, trainingsmodule en tests gebruiken dit los van elkaar. */

export const VERSIE = 1;

/* c = hoe goed onderbouwd: 'redelijk' (onderzoek bij sport en onderwijs), 'beginnend' (weinig onderzoek bij kinderen),
   'ervaring' (gewoonte onder trainers), 'keuze' (geen goed of fout) */
export const CERT = { redelijk: 'Redelijk onderbouwd', beginnend: 'Nog weinig onderzoek bij kinderen', ervaring: 'Ervaring van trainers', keuze: 'Een keuze, geen goed of fout' };
export const DIMS = [
  { id: 'c1', n: 'Sturing', A: 'Ik bepaal', B: 'We bepalen samen', kort: ['Ik bepaal', 'We bepalen samen'], c: 'redelijk', why: 'Bepaal je zelf alles, of mogen spelers meebepalen? Spelers die mee mogen kiezen zijn vaak meer gemotiveerd. Een duidelijke leider blijft belangrijk. Leg ook als jij bepaalt kort uit waarom.', exp: 'Laat de spelers bij één partijspel zelf de regel kiezen.' },
  { id: 'c2', n: 'Uitleg', A: 'Vertellen', B: 'Vragen stellen', kort: ['vertellen', 'vragen stellen'], c: 'beginnend', why: 'Vertellen is snel en duidelijk. Vragen stellen laat spelers zelf nadenken. Goede coaches doen beide. Er is nog weinig onderzoek bij kinderen.', exp: 'Stel bij elke oefening één vraag in plaats van een aanwijzing.' },
  { id: 'c3', n: 'Ingrijpen', A: 'Vaak stoppen en bijsturen', B: 'Laten lopen', kort: ['vaak stoppen', 'laten lopen'], c: 'ervaring', why: 'Vaak stoppen geeft veel uitleg maar weinig spel. Laten lopen geeft meer speeltijd. Beide komen voor.', exp: 'Laat één oefening 4 minuten lopen zonder te stoppen.' },
  { id: 'c4', n: 'Feedback', A: 'Verbeterpunten', B: 'Eerst wat goed ging', kort: ['verbeterpunten', 'eerst wat goed ging'], c: 'redelijk', why: 'Hoeveel aandacht geef je aan wat beter kan en hoeveel aan wat goed gaat? Kinderen blijven vaak meer gemotiveerd als ze ook horen wat goed gaat.', exp: 'Noem bij elke tip eerst één ding dat goed ging.' },
  { id: 'c5', n: 'Uitstraling', A: 'Rustig', B: 'Energiek', kort: ['rustig', 'energiek'], c: 'keuze', why: 'Rustig of energiek zegt iets over hoe je overkomt, niet over hoe goed je coacht. Het bepaalt vooral de toon van je tips.', exp: 'Probeer één training de andere toon: kort, snel en luid of juist rustig.' },
  { id: 'c6', n: 'Plan', A: 'Vast plan', B: 'Flexibel', kort: ['vast plan', 'flexibel'], c: 'keuze', why: 'Een vast plan geeft rust. Flexibel past zich aan de groep aan. Trainers met weinig tijd kiezen vaak een vast plan.', exp: 'Verander één onderdeel van je plan halverwege, op basis van wat je ziet.' },
];
export const DIM_IDS = DIMS.map(d => d.id);

/* Twee situaties per onderdeel: [vraag, tekst A, tekst B]. Beide antwoorden zijn even redelijk geformuleerd. */
export const SITUATIES = {
  c1: [['Je hebt een positiespel gepland, maar de spelers willen liever een partijtje. Wat doe je?', 'Ik doe wat ik gepland heb. Daar heb ik over nagedacht.', 'We stemmen af en ik pas aan als het kan.'], ['Wie bepaalt de regels van het partijspel?', 'Ik.', 'De spelers mogen meebepalen.']],
  c2: [['Een speler weet niet waar hij moet staan.', 'Ik vertel waar hij moet staan.', 'Ik vraag: wat zie je en wat kun je doen?'], ['Het begin van een nieuwe oefening.', 'Eerst uitleggen, dan doen.', 'Eerst proberen, dan bespreken.']],
  c3: [['Na een minuut loopt de oefening niet zoals bedoeld.', 'Ik stop en leg opnieuw uit.', 'Ik laat het even lopen en kijk wat er gebeurt.'], ['Tijdens het partijspel zie je fouten.', 'Ik grijp vaak in, anders leren ze het niet.', 'Ik houd me in, ze moeten het zelf ervaren.']],
  c4: [['Een speler geeft een slechte pass.', 'Ik zeg wat beter kan.', 'Ik noem eerst wat goed was en geef dan een tip.'], ['Het einde van de training.', 'Ik benoem wat beter moet.', 'Ik benoem wat goed ging.']],
  c5: [['Het team is slap tijdens de training.', 'Ik blijf rustig en wacht even af.', 'Ik zet er energie in en praat luider.'], ['Het team staat met 3-0 achter.', 'Ik blijf kalm en praat rustig.', 'Ik probeer ze op te peppen.']],
  c6: [['De training loopt 10 minuten uit.', 'Het plan blijft staan, ik kap af.', 'Ik pas aan zodat het bij het moment past.'], ['Hoe bereid je een training voor?', 'Op de minuut gepland.', 'Een idee, en kijken wat de groep nodig heeft.']],
};
export const WAARDEN = [['plezier', 'Plezier'], ['leren', 'Leren'], ['winnen', 'Winnen'], ['saam', 'Saamhorigheid'], ['disc', 'Discipline'], ['eerlijk', 'Eerlijke speeltijd'], ['door', 'Doorzetten'], ['creatief', 'Creativiteit']];

/* 13 vragen: 12 situaties + de drie waarden */
export const VRAGEN = [
  ...DIMS.flatMap(d => SITUATIES[d.id].map((x, i) => ({ id: d.id + 'ab'[i], k: 'ab', dim: d.id, q: x[0], A: x[1], B: x[2] }))),
  { id: 'wd', k: 'multi', max: 3, q: 'Wat vind jij het belangrijkst bij kinderen? Kies er drie.', o: WAARDEN },
];
const vraagVan = Object.fromEntries(VRAGEN.map(q => [q.id, q]));

export function schoonAntwoord(id, w){
  const q = vraagVan[id]; if (!q) return undefined;
  if (q.k === 'ab') return ['A', 'B', '?'].includes(w) ? w : undefined;
  if (!Array.isArray(w)) return undefined;
  const ok = q.o.map(o => o[0]);
  return [...new Set(w.filter(x => ok.includes(x)))].slice(0, q.max);
}
export function schoonAntwoorden(a){
  const uit = {};
  for (const id of Object.keys(a || {})){ const w = schoonAntwoord(id, a[id]); if (w !== undefined) uit[id] = w; }
  return uit;
}
export const beantwoord = (a, q) => { const w = a && a[q.id]; return Array.isArray(w) ? w.length > 0 : w !== undefined && w !== null; };
export const voortgang = a => ({ gedaan: VRAGEN.filter(q => beantwoord(a, q)).length, totaal: VRAGEN.length });

/* ---------- schets ---------- */
const PUNT = { A: 1, B: -1, '?': 0 };
/* Per onderdeel een stand van −2 … +2 (A +1, B −1, "weet ik nog niet" 0) en het aantal echte antwoorden. Zonder antwoord: null. */
export function standenVan(a){
  const uit = {};
  for (const d of DIMS){
    const ws = ['a', 'b'].map(s => a && a[d.id + s]).filter(w => w !== undefined && w !== null);
    uit[d.id] = ws.length ? { stand: ws.reduce((s, w) => s + (PUNT[w] || 0), 0), n: ws.filter(w => w === 'A' || w === 'B').length } : { stand: null, n: 0 };
  }
  return uit;
}
export function statusVan(stand){
  if (stand === null || stand === undefined) return 'open';
  const m = Math.abs(stand);
  return m >= 1.5 ? 'duidelijk' : m >= 0.5 ? 'neigt' : 'open';
}
/* De schets-zin: de duidelijke en neigende kanten achter elkaar ("We bepalen samen, vragen stellen en laten lopen."). */
export function schetsZin(stand){
  const delen = DIMS.filter(d => Math.abs(stand[d.id] ?? 0) >= 0.5).map(d => (stand[d.id] > 0 ? d.kort[0] : d.kort[1]));
  if (!delen.length) return '';
  const t = delen.length === 1 ? delen[0] : delen.slice(0, -1).join(', ') + ' en ' + delen[delen.length - 1];
  return t.charAt(0).toUpperCase() + t.slice(1) + '.';
}

/* ---------- model: schets → bevestigd ---------- */
/* model = { versie, antwoorden, waarden, onderdelen: { c1: { stand, bevestigd, wil } }, accent, logboek, bijgewerktMs } */
export function nieuwModel(){ return { versie: VERSIE, antwoorden: {}, waarden: [], onderdelen: {}, accent: null, logboek: [], afgerond: [] }; }

/* Zet de antwoorden in het model en maak per onderdeel een schets (nog niet bevestigd). Bevestigde onderdelen blijven staan. */
export function metAntwoorden(model, antwoorden){
  const m = { ...nieuwModel(), ...(model || {}) };
  m.antwoorden = schoonAntwoorden(antwoorden);
  m.waarden = Array.isArray(m.antwoorden.wd) ? m.antwoorden.wd : [];
  const st = standenVan(m.antwoorden);
  m.onderdelen = { ...m.onderdelen };
  for (const d of DIMS){
    const oud = m.onderdelen[d.id];
    if (oud && oud.bevestigd) continue;
    m.onderdelen[d.id] = { stand: st[d.id].stand, bevestigd: false, wil: oud?.wil || null };
  }
  return m;
}
/* De trainer bevestigt of corrigeert een onderdeel. stand mag aangepast zijn (schuif −2 … +2); wil = 'ja' | 'nee' | 'nog niet'. */
export function bevestig(model, dim, { stand, wil } = {}){
  if (!DIM_IDS.includes(dim)) return model;
  const m = { ...model, onderdelen: { ...model.onderdelen } };
  const huidig = m.onderdelen[dim] || { stand: null, bevestigd: false, wil: null };
  const s = stand === undefined ? huidig.stand : Math.max(-2, Math.min(2, Math.round(Number(stand))));
  m.onderdelen[dim] = { stand: Number.isFinite(s) ? s : null, bevestigd: true, wil: ['ja', 'nee', 'nog niet'].includes(wil) ? wil : huidig.wil };
  return m;
}
export const bevestigdStand = (model, dim) => { const o = model?.onderdelen?.[dim]; return o && o.bevestigd && o.stand !== null ? o.stand : null; };
export const alleBevestigd = model => DIM_IDS.every(id => model?.onderdelen?.[id]?.bevestigd);
export function modelStanden(model){ return Object.fromEntries(DIM_IDS.map(id => [id, model?.onderdelen?.[id]?.stand ?? null])); }

/* ---------- accent van de week ---------- */
/* Een kleine proef bij een onderdeel dat de trainer wil veranderen ('ja'), of anders een onderdeel dat nog open is. */
export function kiesAccent(model){
  const kans = DIMS.filter(d => model?.onderdelen?.[d.id]?.bevestigd);
  const wil = kans.find(d => model.onderdelen[d.id].wil === 'ja' && !(model.afgerond || []).includes(d.id));
  const open = kans.find(d => statusVan(model.onderdelen[d.id].stand) === 'open' && model.onderdelen[d.id].wil !== 'nee' && !(model.afgerond || []).includes(d.id));
  const d = wil || open; if (!d) return null;
  /* de proef gaat de kant op die de trainer nog niet doet: bij A-neiging de B-proef en andersom (bij open: B) */
  const s = model.onderdelen[d.id].stand;
  return { dim: d.id, richting: s !== null && s < 0 ? 'A' : 'B', tekst: d.exp };
}
export function startAccent(model, accent, nu = Date.now()){
  if (!accent) return model;
  return { ...model, accent: { dim: accent.dim, richting: accent.richting, tekst: accent.tekst, gestartMs: nu, uit: false }, logboek: [] };
}
export const zetAccentUit = (model, uit = true) => (model?.accent ? { ...model, accent: { ...model.accent, uit } } : model);

/* Na een training drie tikken: hoe voelde het, hoe reageerden de spelers, volgende week weer? */
export const LOG_VRAGEN = [
  { id: 'voelde', q: 'Hoe voelde het?', o: [['goed', 'Goed'], ['ok', 'Gaat wel'], ['lastig', 'Lastig']] },
  { id: 'spelers', q: 'Hoe reageerden de spelers?', o: [['positief', 'Positief'], ['neutraal', 'Neutraal'], ['negatief', 'Minder goed']] },
  { id: 'weer', q: 'Volgende week weer?', o: [['ja', 'Ja'], ['nee', 'Nee']] },
];
export function schoonLog(l){
  if (!l || typeof l !== 'object') return null;
  const uit = {};
  for (const q of LOG_VRAGEN){ const w = l[q.id]; if (q.o.some(o => o[0] === w)) uit[q.id] = w; }
  return Object.keys(uit).length === LOG_VRAGEN.length ? uit : null;
}
export function logAccent(model, l, nu = Date.now()){
  const s = schoonLog(l); if (!s || !model?.accent) return model;
  return { ...model, logboek: [...(model.logboek || []), { ...s, ms: nu }].slice(-12) };
}
export const TERUGBLIK_NA = 4;
export const terugblikKlaar = model => !!(model?.accent && !model.accent.uit && (model.logboek || []).length >= TERUGBLIK_NA);

/* Samenvatting van de proef: wat je koos, hoe het voelde, wat de spelers deden. Geen oordeel. */
export function terugblikTekst(model){
  const a = model?.accent; if (!a) return null;
  const d = DIMS.find(x => x.id === a.dim); const lg = model.logboek || [];
  const tel = (id, w) => lg.filter(x => x[id] === w).length;
  const n = lg.length;
  return {
    dim: d.n, proef: a.tekst, n,
    voelde: `${tel('voelde', 'goed')} keer goed, ${tel('voelde', 'ok')} keer gaat wel, ${tel('voelde', 'lastig')} keer lastig`,
    spelers: `${tel('spelers', 'positief')} keer positief, ${tel('spelers', 'neutraal')} keer neutraal, ${tel('spelers', 'negatief')} keer minder goed`,
    weer: tel('weer', 'ja') >= Math.ceil(n / 2) ? 'Je wilde vaker weer wel dan niet' : 'Je wilde vaker niet dan wel',
    kant: a.richting === 'A' ? d.A : d.B,
  };
}
/* "Wil je dit in je model opnemen?" ja: de stand schuift één stap naar de kant van de proef; nee: alleen afronden. */
export function rondAccentAf(model, opnemen){
  const a = model?.accent; if (!a) return model;
  const m = { ...model, onderdelen: { ...model.onderdelen }, accent: null, logboek: [], afgerond: [...new Set([...(model.afgerond || []), a.dim])] };
  if (opnemen){
    const o = m.onderdelen[a.dim] || { stand: 0, bevestigd: true, wil: 'nee' };
    const stap = a.richting === 'A' ? 1 : -1;
    m.onderdelen[a.dim] = { stand: Math.max(-2, Math.min(2, (o.stand ?? 0) + stap)), bevestigd: true, wil: 'nee' };
  } else if (m.onderdelen[a.dim]) m.onderdelen[a.dim] = { ...m.onderdelen[a.dim], wil: 'nee' };
  return m;
}

/* ---------- in de training ---------- */
/* Doorlopend spel: genoeg speeltijd per ronde zonder stilstaan (spel-, positie- en partijvormen). */
export const doorlopend = v => !!v && ['spelvorm', 'positiespel', 'partijspel'].includes(v.fase) && (v.duur?.ronde || 0) >= 4;
/* Alleen wie "laten lopen" bevestigd heeft (stand −1 of −2) krijgt de kleine voorkeur voor doorlopend spel. */
export const wilLatenLopen = model => { const s = bevestigdStand(model, 'c3'); return s !== null && s <= -1; };
export const coachScore = (v, model) => (wilLatenLopen(model) && doorlopend(v) ? 1 : 0);

const stap = (s, a, b, neutraal) => (s === null || Math.abs(s) < 0.5 ? neutraal : s > 0 ? a : b);
const kort = t => String(t || '').replace(/[.!?]+$/, '');
/* Coachkaart bij een vorm: korte regels in de verpakking van de trainer. Kernpunt, vraag en keuze komen uit de vorm. */
export function coachkaart(v, model){
  if (!v) return [];
  const punt = kort(v.coachpunten?.[0]), vraag = kort(v.coachvragen?.[0]);
  const keuze = kort(v.varianten?.[0]?.naam || v.makkelijker?.[0] || 'de grootte van het veld');
  const m = bevestigdStand;
  const min = (v.duur?.ronde || 4);
  const uit = [];
  uit.push({ moment: 'Start', tekst: stap(m(model, 'c2'),
    `Leg in drie zinnen uit: ${punt || 'wat de bedoeling is'}.`,
    `Laat twee minuten proberen. Vraag daarna: ${vraag || 'wat zie je?'}?`,
    `Leg kort uit: ${punt || 'wat de bedoeling is'}. Stel daarna één vraag.`) });
  uit.push({ moment: 'Start', tekst: stap(m(model, 'c1'),
    'Jij bepaalt de regels. Zeg kort waarom.',
    `Laat de spelers kiezen: ${keuze}.`,
    `Bepaal de regels en vraag de spelers één ding te kiezen: ${keuze}.`) });
  uit.push({ moment: 'Tijdens', tekst: stap(m(model, 'c3'),
    'Stop hooguit twee keer, ongeveer twintig seconden, met één punt.',
    `Laat ${min} minuten lopen. Noteer één ding. Stop alleen voor veiligheid.`,
    'Stop alleen als het echt nodig is en houd het kort.') });
  uit.push({ moment: 'Feedback', tekst: stap(m(model, 'c4'),
    'Noem het verbeterpunt kort en laat het meteen opnieuw proberen.',
    'Noem eerst wat goed ging en geef dan één tip.',
    'Geef één tip en noem ook één ding dat goed ging.') });
  uit.push({ moment: 'Toon', tekst: stap(m(model, 'c5'),
    'Praat rustig, één zin per aanwijzing.',
    'Houd tempo en stem hoog, korte kreten.',
    'Kies zelf je toon; houd de aanwijzingen kort.') });
  uit.push({ moment: 'Tijd', tekst: stap(m(model, 'c6'),
    `Houd ${min} minuten aan.`,
    `${min} tot ${min + 3} minuten. Stop zodra er wachtrijen ontstaan.`,
    `Reken op ${min} minuten en kijk of de groep het aankan.`) });
  return uit;
}
