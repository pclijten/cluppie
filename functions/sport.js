/* [20261126b] Sportprofiel stap 6: de sport in de AI-opdrachten. De systeemteksten zijn voor voetbal
   geschreven; voor een andere sport vervangen we de sportwoorden en zeggen we er expliciet bij welke
   sport het is. Voor voetbal (en een club of team zonder sport) blijft de tekst precies gelijk, zodat
   ook de prompt-cache gelijk blijft. Moet gelijk lopen met public/js/sporten.js en firestore.rules. */
const SPORTEN = {
  voetbal: { naam: 'voetbal', bond: 'KNVB' },
  hockey: { naam: 'hockey', bond: 'KNHB' },
  volleybal: { naam: 'volleybal', bond: 'Nevobo' },
  korfbal: { naam: 'korfbal', bond: 'KNKV' },
};
const sportVan = id => (SPORTEN[id] ? id : 'voetbal');

function voorSport(tekst, sport){
  const id = sportVan(sport);
  if (id === 'voetbal') return tekst;
  const s = SPORTEN[id];
  const t = String(tekst)
    .replace(/Voetbal/g, s.naam.charAt(0).toUpperCase() + s.naam.slice(1))
    .replace(/voetbal/g, s.naam)
    .replace(/KNVB/g, s.bond);
  return `${t}\n\nSPORT: ${s.naam} (bond: ${s.bond}). Alles wat je schrijft gaat over ${s.naam}: gebruik alleen de spelvormen, posities, regels en termen van ${s.naam}. Gebruik geen voetbaltermen (zoals buitenspel, zestien, corner of spits), tenzij ${s.naam} ze zelf kent.`;
}

module.exports = { SPORTEN, sportVan, voorSport };
