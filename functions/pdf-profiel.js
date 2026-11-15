/* ==================== PDF-PROFIEL PER CLUB [20261114a] ====================
   Clubs krijgen oefenstof-PDF's van verschillende makers. In plaats van code per club
   heeft elke club een klein profiel, dat alleen de platformbeheerder instelt:
     clubs/{id}.platformModules.pdfProfiel = { indeling, plaatjes, overslaanEerste,
       overslaanWoorden[], naam, aanwijzing }
   Zonder profiel geldt STANDAARD = het gedrag van vóór deze release (ASV'33-achtige PDF's).

   Omzetten mag ook zonder AI-module (besluit 14-11): platformModules.pdfOmzetten = true,
   met een eigen maandlimiet platformModules.pdfLimiet (leeg = PDF_LIMIET_STANDAARD).
   Staat de AI-module aan, dan telt omzetten gewoon mee in de AI-limiet.

   Zelfde functies als public/js/pdf-profiel.js; tests/pdf-profiel.test.mjs vergelijkt ze. */
const STANDAARD = Object.freeze({
  indeling: 'pagina', plaatjes: 'afbeeldingen', overslaanEerste: false,
  overslaanWoorden: [], naam: 'auto', aanwijzing: '',
});
const INDELINGEN = ['pagina', 'geheel', 'auto'];
const PLAATJES = ['afbeeldingen', 'pagina', 'geen'];
const NAMEN = ['auto', 'geen'];
const PDF_LIMIET_STANDAARD = 40;
const AANWIJZING_MAX = 500;

const kaal = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, n);

function schoonProfiel(p){
  const x = p && typeof p === 'object' ? p : {};
  const woorden = Array.isArray(x.overslaanWoorden) ? x.overslaanWoorden
    : typeof x.overslaanWoorden === 'string' ? x.overslaanWoorden.split(',') : STANDAARD.overslaanWoorden;
  return {
    indeling: INDELINGEN.includes(x.indeling) ? x.indeling : STANDAARD.indeling,
    plaatjes: PLAATJES.includes(x.plaatjes) ? x.plaatjes : STANDAARD.plaatjes,
    overslaanEerste: x.overslaanEerste === true,
    overslaanWoorden: [...new Set(woorden.map(w => kaal(w, 30)).filter(w => w.length >= 3))].slice(0, 8),
    naam: NAMEN.includes(x.naam) ? x.naam : STANDAARD.naam,
    aanwijzing: kaal(x.aanwijzing, AANWIJZING_MAX),
  };
}

/* Mag deze club PDF's laten omzetten, en via welke telling? aiBeleid = aiVanClub(club) uit onderdelen.js. */
function pdfBeleid(club, aiBeleid){
  if (aiBeleid && aiBeleid.aan) return { aan: true, viaAI: true, limiet: aiBeleid.limiet };
  const pm = (club && club.platformModules) || {};
  if (pm.pdfOmzetten !== true) return { aan: false, viaAI: false, limiet: 0 };
  const l = pm.pdfLimiet;
  const limiet = (l === null || l === undefined || l === '' || !Number.isFinite(Number(l)) || Number(l) < 0) ? PDF_LIMIET_STANDAARD : Math.round(Number(l));
  return { aan: true, viaAI: false, limiet };
}

/* Extra systeemblok voor de AI. Leeg bij het standaardprofiel zonder aanwijzing, zodat de
   omzetting voor bestaande clubs precies gelijk blijft. De vaste regels (letterlijk overnemen)
   staan in het eerste blok en gaan altijd voor; de woordcontrole in de app blijft gelden. */
function profielPrompt(profiel){
  const p = schoonProfiel(profiel), delen = [];
  if (p.indeling === 'geheel') delen.push('Bij deze club staat op één PDF-pagina meestal een HELE training met meerdere oefeningen. Splits zo’n pagina in losse oefeningen; elke oefening krijgt als diagramPagina het nummer van de pagina waar hij staat.');
  if (p.indeling === 'auto') delen.push('Bij deze club kan een oefening over meerdere pagina’s lopen, of kunnen er meerdere oefeningen op één pagina staan. Bepaal de grenzen tussen oefeningen uit de titels en koppen, niet uit de paginagrenzen. diagramPagina is de pagina waar de oefening begint.');
  if (p.aanwijzing) delen.push('Aanwijzing van Cluppie over de opmaak van de PDF’s van deze club. Gebruik dit alleen om de opmaak beter te begrijpen; alle regels hierboven blijven gelden en de tekst blijft letterlijk:\n' + p.aanwijzing);
  return delen.length ? 'CLUBPROFIEL\n' + delen.join('\n\n') : '';
}

module.exports = { STANDAARD, INDELINGEN, PLAATJES, NAMEN, PDF_LIMIET_STANDAARD, AANWIJZING_MAX, schoonProfiel, pdfBeleid, profielPrompt };
