import { S } from './state.js?v=20261128a';
import { sportProfiel, STANDAARD_SPORT, zonderKeeper, periodeNaamVoor, periodeKortVoor } from './sporten.js?v=20261126g';

/* [20261124a] De standaardwaarden die bij de sport horen komen uit het sportprofiel
   (sport-voetbal.js). Hier een losse kopie, zodat clubconfig.js ze in plaats kan
   aanpassen zonder het profiel te raken. */
const SPORT = sportProfiel(STANDAARD_SPORT);
const kopie = x => JSON.parse(JSON.stringify(x));

/* ==================== CLUB-CONFIGURATIE (actieve laag) ====================
   [20260929c] Alles in dit bestand is de STANDAARD. Per club kan een beheerder
   afwijken via clubs/{id}.instellingen (schermen: club-instellingen.js).
   js/clubconfig.js leest dat document en past het hier toe:
   - de exports hieronder (arrays/objecten zoals SKILLS, CATEGORIEEN, BOUWEN,
     SNEL_TAGS, KNVB_KALENDER …) worden IN PLAATS aangepast, zodat alle
     importerende modules de live-binding houden zonder zelf te veranderen;
   - ACTIEF bevat de losse regels (drempels, grenzen, formatie …);
   - ALLE_LIJSTEN bevat de volledige lijsten INCLUSIEF uitgezette items, zodat
     lookups van oude data (een opgeslagen tag-id, een oude categorie) blijven
     werken ook als een club het item niet meer aanbiedt.
   Dit bestand importeert clubconfig.js bewust NIET (dan een cirkel): clubconfig
   importeert dit bestand en schrijft erin. */
export const ACTIEF_STANDAARD = Object.freeze({
  tijdstraf: Object.freeze({ ...SPORT.tijdstraf }),                            // uit het sportprofiel
  bouwGrenzen: Object.freeze({ ...SPORT.bouwGrenzen }),                        // uit het sportprofiel
  formatie11: '',                    // leeg = geen club-uitgangspunt tonen (bijv. '4-3-3')
  kalender: Object.freeze({ district: 'zuid', seizoen: "2026/'27", bron: 'standaard' }),
  dashboard: Object.freeze({ dagenInactief: 14, opkomstLaag: 50 }),
  maxVideoMB: 100,
});
export const ACTIEF = {
  tijdstraf: { ...ACTIEF_STANDAARD.tijdstraf },
  bouwGrenzen: { ...ACTIEF_STANDAARD.bouwGrenzen },
  formatie11: ACTIEF_STANDAARD.formatie11,
  kalender: { ...ACTIEF_STANDAARD.kalender },
  dashboard: { ...ACTIEF_STANDAARD.dashboard },
  maxVideoMB: ACTIEF_STANDAARD.maxVideoMB,
};
/* volledige lijsten incl. uitgezette items; door clubconfig.js gevuld */
export const ALLE_LIJSTEN = {};

/* ==================== KNVB-CATEGORIEËN ====================
   Bron: KNVB wedstrijdvormen & speeltijden (knvb.nl)
   Pupillen spelen officieel 2 helften met een time-out halverwege
   elke helft — in de praktijk dus 4 kwarten. Junioren/senioren: 2 helften. */
export const CATEGORIEEN = kopie(SPORT.categorieen);
export const CATEGORIEEN_MEIDEN = kopie(SPORT.categorieenMeiden);
/* Ook een categorie die de club inmiddels uit het aanbod heeft gehaald blijft
   opzoekbaar (bestaande teams en wedstrijden verwijzen ernaar). */
export function catInfo(naam){
  return CATEGORIEEN[naam] || CATEGORIEEN_MEIDEN[naam] || (ALLE_LIJSTEN.categorieen && ALLE_LIJSTEN.categorieen[naam]) || null;
}

/* Weergavenaam: jongenscategorieën heten tegenwoordig O17 (KNVB), meidenteams houden de M (MO20).
   Intern blijft de sleutel JO17, zodat bestaande teams, rules en instellingen ongewijzigd werken. */
export function catLabel(c){
  const s = String(c || '');
  return /^JO\d/.test(s) ? s.slice(1) : s;
}

export function isToernooi(w){ return w.type === 'toernooi'; }

/* tijdstraf in seconden — KNVB: 5 min pupillen (t/m JO/MO15), 10 min junioren+/senioren.
   Waarden en de leeftijdsgrens komen uit ACTIEF.tijdstraf (per club instelbaar). */
export function tijdstrafSec(){
  const t = ACTIEF.tijdstraf;
  const cat = S.team?.categorie || '';
  const m = cat.match(/^[JM]O(\d+)$/);
  if (m && Number(m[1]) >= t.jeugdVanaf) return t.jeugdSec;
  if (cat === 'Senioren' || cat === 'Vrouwen') return t.jeugdSec;
  return t.pupilSec;
}
export const KAART_ICOON = {groen:'<span class="kaartje groen" aria-hidden="true"></span>', geel:'<span class="kaartje geel" aria-hidden="true"></span>', rood:'<span class="kaartje rood" aria-hidden="true"></span>', tijd:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2.2"/></svg>'};
export const KAART_NAAM  = {groen:'groene kaart', geel:'gele kaart', rood:'rode kaart', tijd:'tijdstraf'};   /* [20261126a] groen: hockey */

export function periodeNaam(w){
  if (isToernooi(w)) return w.toernooi.helften === 1 ? 'Wedstrijd' : 'Helft';
  return periodeNaamVoor(w.periodes||4);   /* [20261126a] uit het sportprofiel */
}
export function periodeNrs(w){ return Array.from({length: w.periodes||4}, (_,i) => String(i+1)); }
export function periodeLabel(w, nr){
  if (isToernooi(w)){
    const h = w.toernooi.helften;
    return h === 1 ? 'W'+nr : 'W'+Math.ceil(nr/h)+'.'+(((nr-1)%h)+1);
  }
  return periodeKortVoor(w.periodes||4) + nr;   /* [20261126a] uit het sportprofiel */
}
export function toernooiWnr(w, nr = S.kwart){ return Math.ceil(Number(nr) / w.toernooi.helften); }
export function periodeOmschrijving(w, nr = S.kwart){
  if (isToernooi(w)){
    const wnr = toernooiWnr(w, nr);
    return w.toernooi.helften === 1 ? 'wedstrijd '+wnr : `wedstrijd ${wnr}, helft ${((Number(nr)-1)%w.toernooi.helften)+1}`;
  }
  return periodeNaam(w).toLowerCase()+' '+nr;
}

/* ==================== FORMATIES ==================== */
/* [x%, y%, lijn]  — keeper wordt automatisch toegevoegd op (50, 90),
   behalve bij 4 tegen 4 (JO7): daar speelt niemand op doel. */
export const FORMATIES = kopie(SPORT.formaties);
export const LIJN_NAAM = kopie(SPORT.lijnNaam);

/* ---- Eigen (zelfgemaakte) formaties ----------------------------------------
   Een coach kan per team een eigen linieverdeling opgeven, bv. '4-2-1-3'.
   parseFormatie() genereert daaruit dezelfde symmetrische spreiding als de
   vaste formaties hierboven: linies gelijkmatig van achter (V) naar voren (A),
   spelers per linie horizontaal verdeeld. Zo hoeft niemand te slepen.
   aantalVeld = aantal veldspelers voor het format (format zonder keeper voor
   '4', anders format-1). Retourneert null als de invoer niet klopt. */
export function aantalVeldspelers(format){
  return zonderKeeper(format) ? Number(format) : (Number(format) - 1);   /* [20261126a] keeper uit het sportprofiel */
}
/* Horizontale spreiding per linie — zelfde randmarges als de vaste formaties:
   1→midden, 2→32/68, 3→22/50/78, 4→14/38/62/86, 5→10..90, 6→8..92. */
function spreidX(aantal){
  const marge = {1:0, 2:32, 3:22, 4:14, 5:10, 6:8}[aantal] ?? 12;
  if (aantal === 1) return [50];
  const links = marge, rechts = 100 - marge;
  const xs = [];
  for (let i = 0; i < aantal; i++) xs.push(Math.round(links + (rechts - links) * i / (aantal - 1)));
  return xs;
}
export function parseFormatie(naam, format){
  if (typeof naam !== 'string') return null;
  const delen = naam.trim().split(/[-\s.]+/).filter(Boolean);
  if (delen.length < 2) return null;
  if (!delen.every(d => /^\d+$/.test(d))) return null;
  const lijnen = delen.map(Number);
  if (lijnen.some(x => x < 1 || x > 6)) return null;
  const som = lijnen.reduce((a,b) => a+b, 0);
  if (som !== aantalVeldspelers(format)) return null;

  // Dieptebanden (achter → voor). We verdelen de linies over de band tussen
  // 'achter' (verdediging) en 'voor' (aanval), net als de vaste formaties.
  const band = zonderKeeper(format)
    ? { achter: 70, voor: 26 }
    : { achter: 76, voor: 22 };
  const n = lijnen.length;
  const coords = [];
  lijnen.forEach((aantal, idx) => {
    // basisdiepte van deze linie
    const yBasis = n === 1 ? 49
      : Math.round(band.achter - (band.achter - band.voor) * idx / (n - 1));
    const rol = idx === 0 ? 'V' : idx === n - 1 ? 'A' : 'M';
    const xs = spreidX(aantal);
    xs.forEach((x, i) => {
      // lichte boog: middelste speler(s) van een linie iets dieper (V) of
      // hoger (A), zoals de handgemaakte formaties, voor een natuurlijker beeld.
      let y = yBasis;
      if (aantal >= 3){
        const midden = (aantal - 1) / 2;
        const afstand = Math.abs(i - midden) / midden;      // 0 in het midden, 1 aan de rand
        // Middelste speler van de verdediging staat iets dieper (hogere y);
        // middelste aanvaller iets verder naar voren (lagere y) — net als de
        // handgemaakte formaties, wat een natuurlijke boog geeft.
        const boog = idx === 0 ? 3 : idx === n - 1 ? -3 : 0;
        y = Math.round(yBasis + boog * (1 - afstand));
      }
      coords.push([x, y, rol]);
    });
  });
  return coords;
}
/* Geldig als naam? (vaste formatie óf parsebare eigen formatie) */
export function formatieBestaat(format, naam, eigen){
  if (FORMATIES[format] && FORMATIES[format][naam]) return true;
  if (eigen && eigen[format] && eigen[format].includes(naam)) return true;
  return false;
}
/* Alle formatienamen voor een format: vaste eerst, daarna de eigen van het team.
   'eigen' = object { '11': ['4-2-1-3', ...], ... } zoals opgeslagen op het team. */
export function formatieNamen(format, eigen){
  const vast = Object.keys(FORMATIES[format] || {});
  const extra = (eigen && eigen[format] || []).filter(n => !vast.includes(n));
  return vast.concat(extra);
}

export function bouwSlots(format, formatie){
  const def = (FORMATIES[format] && FORMATIES[format][formatie])
           || parseFormatie(formatie, format)
           || Object.values(FORMATIES[format])[0];
  const slots = zonderKeeper(format) ? [] : [{id:'K', x:50, y:90, lijn:'K'}];
  const tel = {V:0, M:0, A:0};
  for (const [x,y,l] of def){ tel[l]++; slots.push({id:l+tel[l], x, y, lijn:l}); }
  return slots;
}
export const slotLijn = id => id[0];

/* ==================== EXACTE POSITIENAMEN (KNVB) ====================
   Leidt uit lijn (K/V/M/A) + horizontale positie (x%) de meest gebruikelijke
   KNVB-benaming af: links (<35%), midden (35–65%), rechts (>65%). Werkt
   generiek voor elke formatie/format, zonder per formatie te hoeven hardcoden. */
const ZONE_NAAM = kopie(SPORT.zoneNaam);
function zone(x){ return x < 35 ? 'links' : x > 65 ? 'rechts' : 'midden'; }
export function positieNaam(lijn, x){
  if (lijn === 'K') return LIJN_NAAM.K || 'Keeper';
  return (ZONE_NAAM[lijn] && ZONE_NAAM[lijn][zone(x)]) || LIJN_NAAM[lijn] || '';
}
export function slotPositieNaam(format, formatie, slotId){
  const slot = bouwSlots(format, formatie).find(s => s.id === slotId);
  return slot ? positieNaam(slot.lijn, slot.x) : null;
}
/* Volledige, gegroepeerde lijst voor de voorkeurspositie-kiezer in het spelerprofiel. */
export const POSITIE_GROEPEN = kopie(SPORT.positieGroepen);

/* ==================== BOUW-INDELING (voor trainingen) ====================
   Standaard (per club aan te passen via ACTIEF.bouwGrenzen en de bouwnamen):
   Onderbouw  : JO7–JO11  / MO7–MO11
   Middenbouw : JO12–JO15 / MO12–MO15
   Bovenbouw  : JO16–JO19 / MO17–MO20, plus Senioren/Vrouwen en onbekend. */
export const BOUWEN = [
  {id:'onder',  naam:'Onderbouw',  kort:'Onder'},
  {id:'midden', naam:'Middenbouw', kort:'Midden'},
  {id:'boven',  naam:'Bovenbouw',  kort:'Boven'},
];
export function bouwVanCategorie(categorie){
  const m = String(categorie||'').toUpperCase().match(/^[JM]O(\d+)/);
  if (m){
    const lft = Number(m[1]);
    if (lft <= ACTIEF.bouwGrenzen.onderTm) return 'onder';
    if (lft <= ACTIEF.bouwGrenzen.middenTm) return 'midden';
    return 'boven';
  }
  // Senioren, Vrouwen of niets ingesteld → bovenbouw
  return 'boven';
}
export function bouwNaam(id){ return (BOUWEN.find(b => b.id === id)?.naam) || 'Overig'; }

/* ==================== DOCUMENTCATEGORIEËN ====================
   Indeling van de documenten die een club deelt (clubscherm + teamweergave).
   Standaard; per club aan te passen (instellingen → Lijsten). 'overig' blijft altijd. */
export const DOC_CATEGORIEEN = [
  {id:'knvb',   naam:'KNVB'},
  {id:'beleid', naam:'Beleid'},
  {id:'overig', naam:'Overig'},
];
/* Alle categorieën incl. uitgezette, voor het tonen van bestaande documenten. */
export function docCategorieenAlle(){ return ALLE_LIJSTEN.docCategorieen || DOC_CATEGORIEEN; }

/* ==================== YOUTUBE-HELPERS ==================== */
/* haalt de video-id uit allerlei YouTube-URL-vormen; null als het geen YouTube is */
export function youtubeId(url){
  if (!url) return null;
  const s = String(url).trim();
  const patronen = [
    /(?:youtube\.com\/watch\?[^ ]*\bv=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patronen){ const m = s.match(p); if (m) return m[1]; }
  // kale 11-teken id
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}
export function youtubeThumb(id){ return `https://img.youtube.com/vi/${id}/mqdefault.jpg`; }
export function youtubeWatch(id){ return `https://www.youtube.com/watch?v=${id}`; }

/* ==================== KNVB SPEELDAGENKALENDER 2026/'27 ====================
   Districten Zuid I en II. Zaterdagdatum per speelweek (ISO).
   t: wd=wedstrijddag, beker, inhaal, vrij. l=label, n=opmerking (optioneel).
   pup=O7-O12, jun=O13-O19, sen=Senioren/Vrouwen, mei=Meiden MO13-MO20. */
export let KNVB_SEIZOEN = SPORT.kalenderSeizoen;   /* let: laadSportStandaard() zet hem per sport */
/* Label van de kalender die de club gebruikt (kan een eigen import zijn). */
export function knvbSeizoenLabel(){ return ACTIEF.kalender?.seizoen || KNVB_SEIZOEN; }

/* LEGACY-terugval voor clubs/{clubId}.huidigSeizoen zolang een club-document het
   veld nog niet heeft (en voor een team zonder club). Nieuwe clubs krijgen hun
   seizoen bij het aanmaken expliciet (club-instellingen.js, wizard), dus deze
   waarde speelt daar nooit mee. Bewust NIET dynamisch uit de datum afgeleid:
   dan zou een bestaande club zonder veld stilzwijgend een nieuw seizoenlabel
   krijgen. In Instellingen → Algemeen staat een waarschuwing + knop om het
   seizoen van zo'n club vast te leggen. Los van KNVB_SEIZOEN hierboven, dat
   alleen de KNVB-speeldagenkalender labelt. */
export const SEIZOEN_FALLBACK = "2025/'26";
export const KNVB_KALENDER = kopie(SPORT.kalender);

/* map een team-categorie naar de juiste KNVB-kolom */
export function kalenderKolomVoorCategorie(categorie){
  const c = String(categorie||'').toUpperCase();
  if (c === 'SENIOREN' || c === 'VROUWEN') return 'sen';
  const m = c.match(/^([JM])O(\d+)/);
  if (m){
    const meiden = m[1] === 'M';
    const lft = Number(m[2]);
    if (lft <= 12) return 'pup';
    return meiden ? 'mei' : 'jun';
  }
  return 'jun';
}
export function knvbKalenderVoorTeam(team){
  const kol = kalenderKolomVoorCategorie(team?.categorie);
  return KNVB_KALENDER[kol] || KNVB_KALENDER.jun;
}
/* [20261117a] De KNVB-kalender noemt een speelweekend bij de zondag. Jeugdteams
   (JO/MO) spelen op zaterdag: voor hen hoort een zondag-speeldag op de zaterdag
   ervoor. Senioren en Vrouwen houden de datum uit de kalender. Dagen die al op
   een andere weekdag staan (Paaszaterdag, 2e Paasdag, Hemelvaart, of een eigen
   kalender die al zaterdagen noemt) blijven ongemoeid. Rekent in UTC, dus los
   van de tijdzone. Gepoort uit ASV'33 (daar in teams.js). */
export function speeldagDatum(team, iso){
  if (kalenderKolomVoorCategorie(team?.categorie) === 'sen') return iso;
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d) || d.getUTCDay() !== 0) return iso;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ==================== ONTWIKKELDOMEINEN (hybride model) ====================
   De 4 voetbal-skills (Technisch/Tactisch/Fysiek/Mentaal) + een pedagogische laag
   (Gedrag & beleving), zoals 4-Skills en een jeugdbeleidsplan voorstaan:
   "Leren voetballen, met plezier als basis en groei als doel."
   De pedagogische laag komt uit §5 (normen & waarden, teamgevoel, inzet, plezier). */
export const SKILLS = [
  {id:'TE', naam:'Technisch', kort:'Techniek', emoji:'⚽', ico:'football-ball', kleur:'#3b82f6', omschrijving:'Balbeheersing, traptechniek, 1v1: elke 1v1 durven aangaan'},
  {id:'TA', naam:'Tactisch',  kort:'Tactiek',  emoji:'🧠', ico:'tag-insight', kleur:'#a855f7', omschrijving:'Inzicht, positiespel, keuzes maken, omschakelen'},
  {id:'FY', naam:'Fysiek',    kort:'Fysiek',   emoji:'💪', ico:'tag-effort', kleur:'#f59e0b', omschrijving:'Snelheid, actiesnelheid, duelkracht, fitheid'},
  {id:'ME', naam:'Mentaal',   kort:'Mentaal',  emoji:'🔥', ico:'tag-strong-second', kleur:'#10b981', omschrijving:'Zelfvertrouwen, durven kiezen, spelen onder weerstand'},
  {id:'GE', naam:'Gedrag & beleving', kort:'Gedrag', emoji:'🤝', ico:'tag-handshake', kleur:'#ef4444', omschrijving:'Inzet, teamgevoel, normen & waarden, plezier'},
];
export function skillDomein(id){
  return SKILLS.find(s => s.id === id) || (ALLE_LIJSTEN.skills || []).find(s => s.id === id) || null;
}
export function tipsDomein(id){ return skillDomein(id); }

/* ==================== LEERCURVE (Jeugdbeleidsplan §3.3) ====================
   De 14 leerthema's met de leeftijd waarop ze "aan" gaan. Per thema geven we
   de minimale leeftijd (O-getal) en het bijbehorende skill-domein, zodat de app
   leerpunten kan voorstellen die passen bij de leeftijdscategorie van het team.
   Alle thema's blijven altijd kiesbaar; de leeftijdsrelevante worden gemarkeerd. */
/* ==================== LEERCURVE (Jeugdbeleidsplan §3.3) ====================
   De 14 leerthema's met de leeftijd waarop ze "aan" gaan. Per thema: minimale
   leeftijd (O-getal) en het bijbehorende skill-domein, zodat de app leerpunten
   kan voorstellen die passen bij de leeftijdscategorie van het team.
   De bewerkbare tekst (achtergrond + tips per thema) staat NIET meer hier,
   maar in de Firestore-collectie 'content' — zie content.js:contentVoorThema().
   Alle thema's blijven altijd kiesbaar; de leeftijdsrelevante worden gemarkeerd. */
export const LEERCURVE = kopie(SPORT.leercurve);

/* Vind een leercurve-thema op naam, bijv. voor het openen van het infoscherm
   vanuit een string (adviesCat.leercurve, een gekozen leerpunt-tekst, etc). */
export function leercurveThema(naam){
  return LEERCURVE.find(t => t.thema === naam) || (ALLE_LIJSTEN.leercurve || []).find(t => t.thema === naam) || null;
}

/* haal het leeftijdsgetal uit een categorie: 'JO11' → 11, 'MO13' → 13, 'Senioren' → 99 */
export function leeftijdVanCategorie(categorie){
  const m = String(categorie||'').match(/O(\d+)/);
  if (m) return Number(m[1]);
  return 99; // Senioren / Vrouwen → alles relevant
}
/* is een leercurve-thema relevant voor deze categorie? */
export function leercurveRelevant(thema, categorie){
  const lft = leeftijdVanCategorie(categorie);
  return lft >= thema.vanaf;
}

/* Gouden regels en kompas-tips (§3.1/§3.4) zijn verplaatst naar de
   Firestore-collectie 'content' (zie content.js) — daar zijn ze te bewerken
   via het clubdashboard-tabblad "Content", zonder JS aan te passen.
   isoWeek()/kompasIndexVoorWeek() blijven hier staan: dit is pure logica
   (weeknummerberekening), geen bewerkbare tekst. */

/* ISO-weeknummer van vandaag, gebruikt om de kompas-tip per week te bepalen. */
export function isoWeek(d = new Date()){
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dagNr = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dagNr + 3);
  const eersteDonderdag = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const weekNr = 1 + Math.round(((dt - eersteDonderdag) / 86400000 - 3 + ((eersteDonderdag.getUTCDay() + 6) % 7)) / 7);
  return weekNr;
}
/* aantal: KOMPAS_TIPS.length van de dag zelf (content.kompasTips().length) —
   als parameter meegeven i.p.v. hardcoded, want de lijst leeft nu in content.js. */
export function kompasIndexVoorWeek(aantal, week = isoWeek()){
  if (!aantal) return 0;
  return ((week % aantal) + aantal) % aantal;
}

/* Formatie-uitgangspunt van de club (§3.2): 1:4:3:3, omschakelend naar 1:3:4:3 bij balbezit.
   Dit is de oorspronkelijke standaardwaarde. Nieuwe code gebruikt clubFormatie11():
   die geeft de instelling van de actieve club, of '' als die er geen heeft. */
export let CLUB_FORMATIE_11 = SPORT.formatie11;
export function clubFormatie11(){ return ACTIEF.formatie11 || ''; }

/* ==================== WEDSTRIJDDOEL-SUGGESTIES (§3.1 t/m §3.4) ====================
   Korte, concrete voorbeelden per leeftijdsband, aansluitend op de leercurve (§3.3),
   de gouden regels (§3.1) en de gewenste speelwijze (§3.2). Puur als inspiratie bij
   het invullen van het vrije 🎯 Wedstrijddoel-veld — nooit verplicht, altijd overschrijfbaar. */
export const DOEL_SUGGESTIES_BANDEN = kopie(SPORT.doelSuggesties);
/* geeft 3 roterende suggesties terug, passend bij de categorie van het team. */
export function doelSuggesties(categorie, n = 3){
  const lft = leeftijdVanCategorie(categorie);
  const band = DOEL_SUGGESTIES_BANDEN.find(b => lft <= b.tot) || DOEL_SUGGESTIES_BANDEN[DOEL_SUGGESTIES_BANDEN.length-1];
  const start = isoWeek() % band.teksten.length;
  const uit = [];
  for (let i = 0; i < Math.min(n, band.teksten.length); i++) uit.push(band.teksten[(start+i) % band.teksten.length]);
  return uit;
}

/* niveau 1..5 → kleur + label. Index 0 blijft leeg (scores beginnen bij 1). */
export const NIVEAUS = [
  null,
  {n:1, kleur:'#E5484D', label:'Aandacht',  kort:'AAND'},
  {n:2, kleur:'#F2913C', label:'Op weg',    kort:'OPW'},
  {n:3, kleur:'#F2C94C', label:'Prima',     kort:'PRIMA'},
  {n:4, kleur:'#7DCB6A', label:'Sterk',     kort:'STERK'},
  {n:5, kleur:'#2EA043', label:'Uitblinker',kort:'UITBL'},
];
export function niveau(n){ return NIVEAUS[n] || null; }
export function niveauKleur(n){ return NIVEAUS[n]?.kleur || '#EFEFED'; }

/* Snelle 'opvallend'-tags (optioneel aan te tikken na een wedstrijd/training). */
export const SNEL_TAGS = [
  {id:'inzet',    emoji:'💪', ico:'tag-effort', label:'Goede inzet'},
  {id:'duel',     emoji:'🎯', ico:'tag-duel', label:'Sterk in 1v1'},
  {id:'team',     emoji:'🤝', ico:'tag-handshake', label:'Teamspeler'},
  {id:'snel',     emoji:'⚡', ico:'tag-speed', label:'Snel'},
  {id:'inzicht',  emoji:'🧠', ico:'tag-insight', label:'Goed inzicht'},
  {id:'coach',    emoji:'📣', ico:'tag-megaphone', label:'Coachbaar'},
  {id:'plezier',  emoji:'😄', ico:'tag-fun', label:'Veel plezier'},
  {id:'leider',   emoji:'👑', ico:'tag-leader', label:'Neemt leiding'},
];
export function snelTag(id){
  return SNEL_TAGS.find(t => t.id === id) || (ALLE_LIJSTEN.snelTags || []).find(t => t.id === id) || null;
}

/* ==================== TEAMEVALUATIE (na de wedstrijd) ====================
   8 categorieën voor de teambeoordeling na een wedstrijd. Waar een categorie
   overeenkomt met een leercurve-thema (§3.3), leggen we dat verband vast —
   dat is de schakel voor het automatische trainingsadvies. */
export const TEAM_CATEGORIEEN = [
  {id:'inzet',        naam:'Inzet & concentratie'},
  {id:'samenwerking', naam:'Samenwerking & communicatie'},
  {id:'taken',         naam:'Taakuitvoering per linie'},
  {id:'opbouw',        naam:'Opbouw van achteruit',              leercurve:'Positiespel opbouw'},
  {id:'omschakeling',  naam:'Omschakeling bij balverlies/-winst', leercurve:'Omschakelen balverlies'},
  {id:'druk',          naam:'Druk zetten & veroveren',            leercurve:'Storen en veroveren'},
  {id:'plezier',       naam:'Spelplezier'},
  {id:'coachbaar',     naam:'Coachbaarheid'},
];
export function teamCategorie(id){
  return TEAM_CATEGORIEEN.find(c => c.id === id) || (ALLE_LIJSTEN.teamCategorieen || []).find(c => c.id === id) || null;
}

/* Snelle 'opvallend'-tags voor de teamevaluatie (los van de speler-tags hierboven). */
export const TEAM_TAGS = [
  {id:'samenwerking', emoji:'🤝', ico:'tag-handshake', label:'Goede samenwerking'},
  {id:'geluisterd',   emoji:'📣', ico:'tag-megaphone', label:'Goed geluisterd'},
  {id:'plezier',      emoji:'😄', ico:'tag-fun', label:'Veel plezier'},
  {id:'afspraken',    emoji:'⚠️', ico:'tag-agreement-warn', label:'Afspraken niet nagekomen'},
  {id:'sterke2e',     emoji:'🔥', ico:'tag-strong-second', label:'Sterke 2e helft'},
  {id:'terugval',     emoji:'📉', ico:'tag-decline', label:'Terugval na rust'},
];

/* ==================== WISSELREDENEN (facultatief) ====================
   Optioneel aan te geven bij een directe of geplande wissel. Nooit verplicht.
   De id wordt bij het wissel-event bewaard; de UI toont label + emoji. */
export const WISSEL_REDENEN = [
  {id:'blessure',   emoji:'🩹', ico:'reason-injury', label:'Blessure'},
  {id:'tactisch',   emoji:'🔄', ico:'football-substitution', label:'Tactisch'},
  {id:'gedrag',     emoji:'💬', ico:'tag-behavior', label:'Gedrag'},
  {id:'training',   emoji:'📋', ico:'admin-protocol', label:'Trainingsopkomst'},
];
export function wisselReden(id){
  return WISSEL_REDENEN.find(r => r.id === id) || (ALLE_LIJSTEN.wisselRedenen || []).find(r => r.id === id) || null;
}

/* ==================== AFWEZIGHEIDSREDENEN ====================
   Vaste redenset voor afwezigheid, gedeeld door wedstrijd-selectie én
   training-presentie zodat het overal gelijk voelt en in de stats telbaar is.
   Opgeslagen als afwezigRedenen{pid:{type, notitie}}. Oude training-registraties
   met {type:'blessure'} of {type:'reden',notitie} blijven werken: 'blessure' mapt
   op 'blessure', en 'reden' tonen we onder 'anders' (zie afwezigRedenLabel). */
export const AFWEZIG_REDENEN = [
  {id:'blessure', emoji:'🩹', ico:'reason-injury', label:'Blessure'},
  {id:'ziek',     emoji:'🤒', ico:'reason-sick', label:'Ziek'},
  {id:'school',   emoji:'🎒', ico:'reason-school', label:'School'},
  {id:'werk',     emoji:'💼', ico:'reason-work', label:'Werk'},
  {id:'vakantie', emoji:'🏖', ico:'reason-holiday', label:'Vakantie'},
  {id:'nietAfgemeld', emoji:'🚫', ico:'reason-noshow', label:'Niet afgemeld'},
  {id:'anders',   emoji:'❓', ico:'reason-other', label:'Anders'},
];
/* Normaliseert een opgeslagen reden-record naar een {emoji,label,notitie}-weergave.
   Vangt ook het oude training-formaat ('reden' met vrije notitie) op. */
export function afwezigRedenInfo(record){
  if (!record) return null;
  let type = record.type;
  if (type === 'reden') type = 'anders'; // oud training-formaat
  const r = AFWEZIG_REDENEN.find(x => x.id === type)
         || (ALLE_LIJSTEN.afwezigRedenen || []).find(x => x.id === type)
         || AFWEZIG_REDENEN.find(x => x.id === 'anders')
         || (ALLE_LIJSTEN.afwezigRedenen || []).find(x => x.id === 'anders')
         || { id:'anders', emoji:'❓', label:'Anders' };
  return { id:r.id, emoji:r.emoji, ico:r.ico, label:r.label, notitie: record.notitie || '' };
}

/* ==================== FUNCTIEGEBRUIK — EVENT-CATALOGUS ====================
   Alle telbare functies, gegroepeerd per categorie. De 'ev'-sleutel is de
   stabiele event-naam die naar Firestore gaat (nooit hernoemen — dat breekt
   de historie); 'label' is de weergavenaam in het admin-overzicht.
   Puur telwerk: er gaan NOOIT speler- of persoonsgegevens mee, alleen tellingen. */
export const GEBRUIK_CATEGORIEEN = [
  { id:'wedstrijd', naam:'Wedstrijd', events:[
    {ev:'wedstrijd_start',      label:'Wedstrijd starten'},
    {ev:'opstelling_maken',     label:'Opstelling maken'},
    {ev:'wissel_direct',        label:'Wissel doorgevoerd'},
    {ev:'wissel_gepland',       label:'Wissel gepland'},
    {ev:'doelpunt',             label:'Doelpunt geregistreerd'},
    {ev:'kaart',                label:'Kaart geregistreerd'},
    {ev:'verslag_ai',           label:'Verslag gegenereerd'},
    {ev:'speeltijd_correctie',  label:'Speeltijd gecorrigeerd'},
  ]},
  { id:'zijlijn', naam:'Nieuw wedstrijdscherm (proef)', events:[
    {ev:'zijlijn_proberen',     label:'Nieuw scherm aangezet'},
    {ev:'zijlijn_terug',        label:'Terug naar oude scherm'},
    {ev:'zijlijn_ongedaan',     label:'Ongedaan maken gebruikt'},
    {ev:'zijlijn_cijfer_5',     label:'Beoordeeld met 5'},
    {ev:'zijlijn_cijfer_4',     label:'Beoordeeld met 4'},
    {ev:'zijlijn_cijfer_3',     label:'Beoordeeld met 3'},
    {ev:'zijlijn_cijfer_2',     label:'Beoordeeld met 2'},
    {ev:'zijlijn_cijfer_1',     label:'Beoordeeld met 1'},
  ]},
  { id:'beoordelen', naam:'Beoordelen', events:[
    {ev:'snel_beoordeling',     label:'Snel beoordelen'},
    {ev:'snel_ronde',           label:'Snelle ronde'},
    {ev:'volledige_beoordeling',label:'Volledige beoordeling'},
    {ev:'team_evaluatie',       label:'Team evalueren'},
    {ev:'leerpunt_nieuw',       label:'Leerpunt toegevoegd'},
    {ev:'leerpunt_klaar',       label:'Leerpunt afgevinkt'},
  ]},
  { id:'training', naam:'Training', events:[
    {ev:'presentie',            label:'Presentie invullen'},
    {ev:'training_upload',      label:'Training uploaden (AI)'},
    {ev:'training_bewerken',    label:'Training bewerken'},
    {ev:'afgelasting',          label:'Afgelasting gemeld'},
  ]},
  { id:'beheer', naam:'Spelers & beheer', events:[
    {ev:'speler_nieuw',         label:'Speler toevoegen'},
    {ev:'speler_bewerken',      label:'Speler bewerken'},
    {ev:'selectie_kiezen',      label:'Selectie kiezen'},
    {ev:'uitlenen',             label:'Speler uitlenen'},
    {ev:'uitlenen_intrek',      label:'Uitlenen ingetrokken'},
  ]},
  { id:'overig', naam:'Overig', events:[
    {ev:'stats_bekeken',        label:'Stats bekeken'},
    {ev:'chatbot',              label:'Chatbot gebruikt'},
    {ev:'handleiding',          label:'Handleiding geopend'},
    {ev:'leerlijn',             label:'Leerlijn geopend'},
    {ev:'video_open',           label:'Video geopend'},
    {ev:'document_open',        label:'Document geopend'},
  ]},
];
/* platte map ev → {label, categorie} voor snelle opzoeking in het admin-overzicht */
export const GEBRUIK_EVENTS = (() => {
  const m = {};
  for (const c of GEBRUIK_CATEGORIEEN)
    for (const e of c.events) m[e.ev] = {label:e.label, cat:c.id, catNaam:c.naam};
  return m;
})();

/* ==================== SPORT WISSELEN ====================
   [20261126a] Sportprofiel stap 5: zet de standaardwaarden van een andere sport IN PLAATS in de
   exports hierboven, zodat alle importerende modules ze via de live-binding zien. clubconfig.js
   roept dit aan vóór het toepassen van de clubinstellingen (eerst sport, dan club). Voor voetbal,
   de standaard bij het laden, gebeurt er niets tot er een andere sport langskomt. */
const vervang = (doel, bron) => {
  const k = kopie(bron);
  if (Array.isArray(doel)){ doel.length = 0; doel.push(...k); return; }
  for (const x of Object.keys(doel)) delete doel[x];
  Object.assign(doel, k);
};
export function laadSportStandaard(id){
  const P = sportProfiel(id);
  vervang(CATEGORIEEN, P.categorieen); vervang(CATEGORIEEN_MEIDEN, P.categorieenMeiden);
  vervang(FORMATIES, P.formaties); vervang(LIJN_NAAM, P.lijnNaam); vervang(ZONE_NAAM, P.zoneNaam);
  vervang(POSITIE_GROEPEN, P.positieGroepen); vervang(KNVB_KALENDER, P.kalender);
  vervang(LEERCURVE, P.leercurve); vervang(DOEL_SUGGESTIES_BANDEN, P.doelSuggesties);
  KNVB_SEIZOEN = P.kalenderSeizoen; CLUB_FORMATIE_11 = P.formatie11;
  Object.assign(ACTIEF.tijdstraf, P.tijdstraf); Object.assign(ACTIEF.bouwGrenzen, P.bouwGrenzen);
}
