/* ==================== SPORTLINK — PURE HULPFUNCTIES (20261012a) ====================
   Geen Firestore, geen netwerk: alles hier is getest in tests/sportlink-meer.test.mjs.
   Gebruikt door functions/index.js (sync, clubinfo, afgelastingen).

   Velden zoals Sportlinks Club.Dataservice ze levert (live gecontroleerd 12-10-2026):
     clubgegevens          → { gegevens: { clubnaam, clubcode, plaats, website, logo (base64 PNG),
                               thuisshirtkleur, … ook banknummer, kvknummer, naamsecretaris,
                               telefoonnummer, email — die laten we bewust weg } }
     teams                 → één regel per team PER POULE: teamcode, poulecode, competitiesoort
                               (regulier | beker), klassepoule, …
     programma             → + competitiesoort (regulier | beker | Oefenwedstrijd), accommodatie, veld,
                               plaats, verzameltijd, vertrektijd, kleedkamerthuisteam, kleedkameruitteam,
                               scheidsrechter(s) — die laatste slaan we NIET op (vaak minderjarig)
     afgelastingen         → wedstrijdcode, thuisteamid, uitteamid, status "Afgelast", wedstrijddatum
     wedstrijd-accommodatie→ { wedstrijd: { accommodatienaam, adres, plaats ("5708DW HELMOND"), telefoonnummer } }
   ================================================================================== */

/* ---------- kleine helpers ---------- */
const schoon = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const normSleutel = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* "AARLE-RIXTEL" → "Aarle-Rixtel", "'S-HERTOGENBOSCH" → "'s-Hertogenbosch", "5708DW HELMOND" → "5708 DW Helmond" */
function netjesPlaats(p){
  let s = schoon(p, 80);
  if (!s) return '';
  let postcode = '';
  const m = /^(\d{4})\s?([A-Za-z]{2})\s+(.+)$/.exec(s);
  if (m){ postcode = `${m[1]} ${m[2].toUpperCase()} `; s = m[3]; }
  s = s.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
  s = s.replace(/^'S-/i, "'s-").replace(/^'T /i, "'t ");
  return postcode + s;
}

/* ---------- 1. clubgegevens ---------- */

/* Tenuekleur als tekst → hex. Eerste kleur die geen wit is; wit alleen als er niets anders staat.
   "Rood / Wit, verticaal gestreept" → rood. Onbekend → null (de app houdt dan zijn standaard). */
const KLEUREN = [
  ['donkerblauw', '#1d3a8a'], ['marineblauw', '#1b2a5c'], ['marine', '#1b2a5c'], ['navy', '#1b2a5c'],
  ['lichtblauw', '#3d9be0'], ['hemelsblauw', '#3d9be0'], ['koningsblauw', '#2a4fc8'], ['blauw', '#1f5fbf'],
  ['donkergroen', '#17663a'], ['lichtgroen', '#4caf50'], ['groen', '#1f8f4e'],
  ['donkerrood', '#a31d24'], ['bordeaux', '#7d1d2c'], ['wijnrood', '#7d1d2c'], ['rood', '#d32f2f'],
  ['oranje', '#ef7d00'], ['geel', '#f2c200'], ['goud', '#c9a227'], ['zwart', '#1d1e1e'],
  ['paars', '#6a2c91'], ['lila', '#9b6cc4'], ['roze', '#e05a9b'], ['grijs', '#6e6e6c'], ['zilver', '#9ea3a8'],
  ['bruin', '#7a4b2a'], ['turquoise', '#1aa6a6'], ['turkoois', '#1aa6a6'], ['wit', '#ffffff'],
];
function kleurUitTekst(tekst){
  const delen = String(tekst || '').toLowerCase().split(/[\/,;&+]|\s-\s|\sen\s/).map(s => s.trim()).filter(Boolean);
  let wit = null;
  for (const deel of delen){
    for (const [naam, hex] of KLEUREN){
      if (!new RegExp(`(^|[^a-z])${naam}([^a-z]|$)`).test(deel)) continue;
      if (naam === 'wit'){ wit = wit || hex; break; }
      return hex;
    }
  }
  return wit;
}

/* Alleen wat de app nodig heeft. Banknummer, KvK, secretaris, telefoon en e-mail gaan nooit mee. */
function filterClubgegevens(antwoord){
  const g = (Array.isArray(antwoord) ? antwoord[0] : antwoord)?.gegevens || {};
  const clubnaam = schoon(g.clubnaam, 60), clubcode = schoon(g.clubcode, 20).toUpperCase();
  if (!clubnaam || !clubcode) return null;
  const ruweLogo = String(g.logo || '').replace(/\s+/g, '');
  const logo = /^[A-Za-z0-9+/]+=*$/.test(ruweLogo) && ruweLogo.length > 100 && ruweLogo.length < 2_000_000
    ? 'data:image/png;base64,' + ruweLogo : '';
  const website = /^https?:\/\/[^\s]+$/i.test(schoon(g.website, 200)) ? schoon(g.website, 200) : '';
  const kleurTekst = schoon(g.thuisshirtkleur, 80);
  return { clubnaam, clubcode, plaats: netjesPlaats(g.plaats), website, logo, kleurTekst, kleur: kleurUitTekst(kleurTekst) };
}

/* ---------- 2. poules en soort ---------- */

function soortVan(competitiesoort){
  const s = String(competitiesoort || '').toLowerCase();
  if (s === 'regulier') return 'regulier';
  if (s.includes('beker')) return 'beker';
  if (s.includes('oefen')) return 'oefen';
  return s ? 'overig' : null;
}

/* Alle poules per teamcode uit de teamlijst (één regel per poule). */
function poulesPerTeam(regels){
  const per = new Map();
  for (const r of regels || []){
    const teamcode = r?.teamcode != null ? String(r.teamcode) : '';
    const poulecode = r?.poulecode != null && String(r.poulecode).trim() ? String(r.poulecode).trim() : '';
    if (!teamcode || !poulecode) continue;
    const lijst = per.get(teamcode) || [];
    if (!lijst.some(p => p.poulecode === poulecode))
      lijst.push({ poulecode, soort: soortVan(r.competitiesoort) || 'overig', klassepoule: schoon(r.klassepoule, 120) || null });
    per.set(teamcode, lijst);
  }
  return per;
}

/* De bekerpoule die we tonen: de nieuwste (hoogste poulecode) — bij meerdere bekerrondes is dat
   de ronde waar het team nu in zit. */
function bekerPoule(poules){
  const b = (poules || []).filter(p => p.soort === 'beker');
  if (!b.length) return null;
  return b.slice().sort((x, y) => (Number(y.poulecode) || 0) - (Number(x.poulecode) || 0))[0];
}

/* ---------- 4. wedstrijdinfo ---------- */

function tijd(t){
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}
/* Alleen gevulde velden: de sync schrijft met merge, dus een lege waarde mag niets overschrijven. */
function infoUitRegel(r, thuis){
  const info = {
    accommodatie: schoon(r?.accommodatie, 80),
    veld: schoon(r?.veld, 30),
    plaats: netjesPlaats(r?.plaats),
    verzamel: tijd(r?.verzameltijd),
    vertrek: tijd(r?.vertrektijd),
    kleedkamer: schoon(thuis ? r?.kleedkamerthuisteam : r?.kleedkameruitteam, 30),
  };
  for (const k of Object.keys(info)) if (!info[k]) delete info[k];
  return info;
}

function accommodatieSleutel(naam, plaats){
  const k = normSleutel(naam) + '_' + normSleutel(plaats);
  return k.length > 1 ? k.slice(0, 120) : '';
}
function accommodatieUit(antwoord){
  const w = (Array.isArray(antwoord) ? antwoord[0] : antwoord)?.wedstrijd || {};
  const adres = schoon(w.adres, 80), plaats = netjesPlaats(w.plaats);
  if (!adres && !plaats) return null;
  const tel = schoon(w.telefoonnummer, 20).replace(/[^\d+ -]/g, '');
  return {
    adres, plaats, telefoon: tel,
    route: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([adres, plaats].filter(Boolean).join(', ')),
  };
}

/* ---------- 3. afgelastingen ---------- */

/* Wat moet er veranderen aan de Sportlink-wedstrijden van één team?
     bestaand:  [{ id, sportlinkCode, datum, status, sportlinkWeg }]
     inProgramma: Set van wedstrijdcodes die Sportlink nu nog kent (programma + uitslagen), of null
                  als programma niet (goed) is opgehaald — dan doen we niets met "verdwenen".
     afgelast:  Map wedstrijdcode → { gemeld? }
     vanaf/tot: alleen wedstrijden met datum > vanaf (morgen en later) en < tot vallen onder "verdwenen".
   Geeft [[id, patch]] terug; patch-waarde null = veld weghalen. Er wordt nooit iets verwijderd. */
function afgelastPlan({ bestaand = [], inProgramma = null, afgelast = new Map(), vanaf, tot }){
  const uit = [];
  for (const w of bestaand){
    const code = String(w.sportlinkCode || '');
    if (!code) continue;
    const patch = {};
    if (afgelast.has(code)){
      if (w.status !== 'afgelast') patch.status = 'afgelast';
      if (w.sportlinkWeg) patch.sportlinkWeg = null;
    } else if (inProgramma){
      const kent = inProgramma.has(code);
      if (w.status === 'afgelast' && kent) patch.status = null;            // afgelasting ingetrokken
      const telt = w.datum && w.datum > vanaf && w.datum < tot;
      if (telt && !kent && w.status !== 'afgelast' && !w.sportlinkWeg) patch.sportlinkWeg = true;
      if (kent && w.sportlinkWeg) patch.sportlinkWeg = null;
    }
    if (Object.keys(patch).length) uit.push([w.id, patch]);
  }
  return uit;
}

/* Regel uit het afgelastingen-endpoint → { code, datum, tijd, thuisCode, uitCode, wedstrijd } */
function afgelastRegel(r){
  const code = schoon(r?.wedstrijdcode, 20);
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(r?.wedstrijddatum || ''));
  if (!code || !m) return null;
  if (r.status && !/afgelast/i.test(String(r.status))) return null;
  return {
    code, datum: m[1], tijd: tijd(r.aanvangstijd) || m[2] || '',
    thuisCode: r.thuisteamid != null ? String(r.thuisteamid) : '', uitCode: r.uitteamid != null ? String(r.uitteamid) : '',
    wedstrijd: schoon(r.wedstrijd || `${r.thuisteam || ''} - ${r.uitteam || ''}`, 140),
  };
}

/* Venster voor de weekendcontrole (Amsterdam-tijd): vrijdag 16–22, zaterdag en zondag 7–14. */
function inAfgelastVenster(dag, uur){
  if (dag === 5) return uur >= 16 && uur < 23;
  if (dag === 6 || dag === 0) return uur >= 7 && uur < 15;
  return false;
}

module.exports = {
  schoon, netjesPlaats, kleurUitTekst, filterClubgegevens, soortVan, poulesPerTeam, bekerPoule,
  infoUitRegel, accommodatieSleutel, accommodatieUit, afgelastPlan, afgelastRegel, inAfgelastVenster,
};
