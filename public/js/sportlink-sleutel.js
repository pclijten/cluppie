/* sportlink-sleutel.js — teamsleutel voor het koppelen van een Cluppie-team aan een Sportlink-team.
   [20261008] Generiek: het voorvoegsel komt van de eigen clubnaam (en afkorting) van de actieve club.

   PURE module (geen DOM, geen Firebase): bedoeld om ongewijzigd ook in de Cloud Function
   (functions/index.js → syncClub / schrijfTeamlijst) te gebruiken, zodat client en server
   altijd dezelfde sleutel berekenen. Kopieer/require dit bestand daar; pas niets aan één kant aan.

   Voorbeeld (club "SV Brandevoort", afkorting "SVB"):
     "SV Brandevoort JO11-1" → "o11-1"      "Selectie" → "selectie"      "SVB 1" → "sen1"
   Bug (release 20260928d) is meegenomen: een senioren-sleutel "sen#" ontstaat alleen als
   er na de clubnaam enkel een nummer staat; "VR30+1" wordt dus niet "sen1". */

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Regexen die de eigen clubnaam in een teamnaam herkennen: volledige naam, eerste twee woorden,
   eerste woord en de afkorting. Tekens ertussen (apostrof, spatie, streepje) zijn optioneel,
   zodat "FC Voorbeeld '33", "fc voorbeeld 33" en "FCVoorbeeld33" hetzelfde zijn. Langste variant eerst. */
export function eigenClubPatronen(clubNaam, afkorting){
  const woorden = String(clubNaam || '').toLowerCase().split(/\s+/).filter(Boolean);
  const varianten = new Set();
  const voeg = tekst => {
    const tekens = [...String(tekst).toLowerCase().replace(/[^a-z0-9]+/g, '')];
    if (tekens.length >= 2) varianten.add(tekens.map(esc).join("[^a-z0-9]*"));
  };
  voeg(woorden.join(''));
  voeg(woorden.slice(0, 2).join(''));
  voeg(woorden.slice(0, 1).join(''));
  voeg(afkorting || '');
  return [...varianten]
    .sort((a, b) => b.length - a.length)
    .map(p => new RegExp('(^|[^a-z0-9])' + p, 'g'));
}

export function teamSleutel(naam, clubNaam, afkorting){
  let s = String(naam || '').toLowerCase();
  for (const re of eigenClubPatronen(clubNaam, afkorting)) s = s.replace(re, '$1 ');
  const m = s.match(/\b(m)?j?o\s*(\d{1,2})\s*[-\s]\s*(\d+)\s*(?:jm|j|m)?\b/i);
  if (m) return (m[1] ? 'm' : '') + 'o' + m[2] + '-' + m[3];
  const sr = s.trim().match(/^(\d{1,2})\s*(?:\(?\s*(?:zon|zat)[a-z]*\s*\)?)?$/);
  if (sr) return 'sen' + sr[1];
  return s.replace(/[^a-z0-9+]+/g, '');
}
