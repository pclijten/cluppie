/* ==================== PDF-PROFIEL PER CLUB [20261114a] ====================
   Hoe de PDF's van een club eruitzien: clubs/{id}.platformModules.pdfProfiel (alleen de
   platformbeheerder schrijft, in Platform › Clubs › club › PDF-trainingen). Zonder profiel
   geldt STANDAARD, precies het gedrag van vóór deze release.
   Zelfde schoonProfiel/pdfBeleid als functions/pdf-profiel.js (tests/pdf-profiel.test.mjs).
   Pure module: geen imports, dus overal te gebruiken en in Node te testen. */
export const STANDAARD = Object.freeze({
  indeling: 'pagina', plaatjes: 'afbeeldingen', overslaanEerste: false,
  overslaanWoorden: [], naam: 'auto', aanwijzing: '',
});
export const INDELINGEN = ['pagina', 'geheel', 'auto'];
export const PLAATJES = ['afbeeldingen', 'pagina', 'geen'];
export const NAMEN = ['auto', 'geen'];
export const PDF_LIMIET_STANDAARD = 40;
export const AANWIJZING_MAX = 500;

/* Teksten voor het platformcentrum */
export const KEUZES = {
  indeling: [['pagina', 'Eén oefening per pagina', 'Zoals de meeste oefenstof.'],
    ['geheel', 'Hele training op één pagina', 'Meerdere oefeningen per pagina.'],
    ['auto', 'Wisselt', 'Oefeningen lopen over pagina’s heen; de AI kijkt naar de titels.']],
  plaatjes: [['afbeeldingen', 'Veldjes als afbeelding', 'Het veldje is een plaatje in de PDF (standaard).'],
    ['pagina', 'Hele pagina als plaatje', 'Voor getekende velden (Word, tekenprogramma’s).'],
    ['geen', 'Geen plaatjes', 'Alleen tekst.']],
  naam: [['auto', 'Planning uit de bestandsnaam', 'Zoals “Blok 2 - Week 1 - Training 1”.'],
    ['geen', 'Altijd zelf kiezen', 'Bestandsnamen zeggen niets over de week.']],
};

const kaal = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, n);

export function schoonProfiel(p){
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

export function pdfBeleid(club, aiBeleid){
  if (aiBeleid && aiBeleid.aan) return { aan: true, viaAI: true, limiet: aiBeleid.limiet };
  const pm = (club && club.platformModules) || {};
  if (pm.pdfOmzetten !== true) return { aan: false, viaAI: false, limiet: 0 };
  const l = pm.pdfLimiet;
  const limiet = (l === null || l === undefined || l === '' || !Number.isFinite(Number(l)) || Number(l) < 0) ? PDF_LIMIET_STANDAARD : Math.round(Number(l));
  return { aan: true, viaAI: false, limiet };
}

export const isStandaard = p => JSON.stringify(schoonProfiel(p)) === JSON.stringify(schoonProfiel(STANDAARD));

/* Welke pagina's slaan we over? De eerste (voorblad), en pagina's waar een overslaanwoord
   in de eerste drie regels staat (kop van een overzicht- of legendablad). Lege pagina's
   gaan er altijd uit. Geeft een Set paginanummers. Nooit alle pagina's: dan blijft alles staan. */
export function overTeSlaan(paginas, profiel){
  const p = schoonProfiel(profiel), weg = new Set();
  const lijst = Array.isArray(paginas) ? paginas : [];
  for (const [i, pg] of lijst.entries()){
    const tekst = String(pg?.tekst || '');
    if (p.overslaanEerste && i === 0 && lijst.length > 1){ weg.add(pg.pagina); continue; }
    const kop = tekst.split('\n').slice(0, 3).join(' ').toLowerCase();
    if (p.overslaanWoorden.some(w => kop.includes(w.toLowerCase()))) weg.add(pg.pagina);
  }
  return weg.size >= lijst.length ? new Set() : weg;
}

/* Plaatjes aan oefeningen koppelen. Bij 'afbeeldingen' en 'geen' verandert er niets: de
   weergave koppelt op volgorde (training-weergave.js, diagramVoorOefening). Bij 'pagina' zijn
   de plaatjes per paginanummer opgeslagen; dan krijgt de EERSTE oefening van elke pagina het
   paginaplaatje, met de vlag _perOefening zodat de weergave op nummer koppelt en niet opschuift. */
export function koppelDiagrammen(diagramUrls, oefeningen, profiel){
  const D = diagramUrls || {};
  if (schoonProfiel(profiel).plaatjes !== 'pagina') return D;
  const uit = { _perOefening: true }, gehad = new Set();
  (oefeningen || []).forEach((o, i) => {
    const pg = Number(o?.diagramPagina);
    if (!Number.isFinite(pg) || gehad.has(pg)) return;
    const url = D[pg] || D[String(pg)];
    if (url){ uit[i + 1] = url; gehad.add(pg); }
  });
  return uit;
}
