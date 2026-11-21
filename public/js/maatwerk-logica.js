/* ==================== MAATWERK PER CLUB [20261121a] ====================
   PURE module (geen DOM, geen Firebase, geen imports) voor het Platformcentrum van de eindbaas:
     - Maatwerk (platform-centrum.js): één tabel met alle clubs en alle onderdelen, schakelen in de tabel,
       zien welke club afwijkt van de standaard, de inrichting van een andere club overnemen;
     - clubdetail › Overzicht: "Maatwerk voor deze club" (wat is hier anders) en de eigen notities en wensen.
   Getest in tests/maatwerk.test.mjs.

   De onderdelen staan in clubs/{id}.platformModules; de standaard voor nieuwe clubs in
   platform/instellingen.standaard (modulesVoorNieuweClub in onderdelen.js). Notities en wensen staan in
   clubprofielen/{clubId}.maatwerk: alleen de platformbeheerder kan dat document lezen (firestore.rules). */

/* Schakelaars en limieten per club, in de volgorde van de tabel. `beheerd`: volgt platformToegestaan()
   (clubs van vóór 13-10-2026 hebben het onderdeel zonder dat er iets is opgeslagen). */
export const ONDERDELEN = [
  { id: 'trainingsmodule', naam: 'Training maken',   kort: 'Training',  soort: 'schakel', beheerd: true, uitleg: 'Trainingen samenstellen uit de bibliotheek.' },
  { id: 'seizoensplan',    naam: 'Seizoensplanning', kort: 'Seizoen',   soort: 'schakel', beheerd: true, uitleg: 'Jaarplan per team en per club.' },
  { id: 'ai',              naam: 'AI-functies',      kort: 'AI',        soort: 'schakel', uitleg: 'Chat, verslagen en trainingsuitleg. Kost per aanroep.' },
  { id: 'scouting',        naam: 'Scouting',         kort: 'Scouting',  soort: 'schakel', uitleg: 'AI-rapport over de tegenstander van het eerste elftal.' },
  { id: 'teamkamer',       naam: 'Teamkamer',        kort: 'Teamkamer', soort: 'schakel', uitleg: 'Ouders en spelers kijken mee bij hun team.' },
  { id: 'leren',           naam: 'Leren van gebruik', kort: 'Leren',    soort: 'schakel', uitleg: 'Cluppie leert van hoe trainers de app gebruiken.' },
  { id: 'pdfOmzetten',     naam: 'PDF omzetten',     kort: 'PDF',       soort: 'schakel', uitleg: 'Oefenstof-PDF omzetten zonder de AI-module.' },
  { id: 'aiLimiet',        naam: 'AI per maand',     kort: 'AI-limiet', soort: 'getal', min: 0, max: 100000, leeg: 'onbeperkt' },
  { id: 'maxVideoMB',      naam: 'Video max (MB)',   kort: 'Video MB',  soort: 'getal', min: 5, max: 300 },
];
export const SCHAKELAARS = ONDERDELEN.filter(o => o.soort === 'schakel');
export const onderdeelOpId = id => ONDERDELEN.find(o => o.id === id) || null;

const getal = (v, terug) => { const n = Math.round(Number(v)); return v === null || v === undefined || v === '' || !Number.isFinite(n) || n < 0 ? terug : n; };

/* De waarden van één club. `toegestaan(club, sleutel)` = platformToegestaan uit onderdelen.js (voor de beheerde onderdelen). */
export function waardenVan(club, toegestaan){
  const pm = (club && club.platformModules) || {}, uit = {};
  for (const o of SCHAKELAARS) uit[o.id] = o.beheerd && typeof toegestaan === 'function' ? toegestaan(club, o.id) === true : pm[o.id] === true;
  uit.aiLimiet = getal(pm.aiLimiet, null);
  const v = getal(pm.maxVideoMB, 0);
  uit.maxVideoMB = v >= 5 && v <= 300 ? v : 100;
  return uit;
}
/* De standaard als dezelfde vorm. `standaard` = uitkomst van modulesVoorNieuweClub(platform.standaard). */
export function standaardWaarden(standaard){
  const s = standaard || {}, uit = {};
  for (const o of SCHAKELAARS) uit[o.id] = s[o.id] === true;
  uit.aiLimiet = getal(s.aiLimiet, null);
  const v = getal(s.maxVideoMB, 0);
  uit.maxVideoMB = v >= 5 && v <= 300 ? v : 100;
  return uit;
}

const toon = (o, w) => o.soort === 'schakel' ? (w ? 'aan' : 'uit') : (w === null || w === undefined ? (o.leeg || '–') : String(w));
/* Waar wijkt deze club af van de standaard? Een AI-limiet telt alleen als AI aan staat. */
export function afwijkingen(waarden, standaard){
  const uit = [];
  for (const o of ONDERDELEN){
    const w = waarden[o.id], s = standaard[o.id];
    if (w === s) continue;
    if (o.id === 'aiLimiet' && !waarden.ai) continue;
    if (o.id === 'pdfOmzetten' && waarden.ai) continue;      /* met AI aan telt omzetten mee in de AI-limiet */
    uit.push({ id: o.id, naam: o.naam, kort: o.kort, waarde: w, standaard: s, tekst: `${o.naam} ${toon(o, w)}`, meer: o.soort === 'schakel' ? w === true : null });
  }
  return uit;
}

/* Wat er naar clubs/{id}.platformModules moet om `doel` te bereiken (alleen wat verschilt). */
export function patchNaar(huidig, doel){
  const patch = {};
  for (const o of ONDERDELEN) if (huidig[o.id] !== doel[o.id]) patch[o.id] = doel[o.id];
  return patch;
}
export function patchTekst(patch){
  return Object.keys(patch).map(id => { const o = onderdeelOpId(id); return o ? `${o.naam} ${toon(o, patch[id])}` : ''; }).filter(Boolean).join(', ');
}

/* Controle van een getal uit de tabel. Geeft { ok, waarde } of { ok:false, fout }. */
export function controleerGetal(id, ruw){
  const o = onderdeelOpId(id); if (!o || o.soort !== 'getal') return { ok: false, fout: 'Onbekend veld' };
  const s = String(ruw ?? '').trim();
  if (s === '' && o.leeg) return { ok: true, waarde: null };
  const n = Math.round(Number(s));
  if (!Number.isFinite(n) || n < o.min || n > o.max) return { ok: false, fout: `Vul een getal tussen ${o.min} en ${o.max.toLocaleString('nl-NL')} in${o.leeg ? ', of laat het leeg' : ''}` };
  return { ok: true, waarde: n };
}

/* ---------- Tabel: rijen, filter, telling ---------- */
/* clubs = [{ id, naam, plaats, fase, … }] uit het overzicht; docs = { id: clubdocument }. */
export function maatwerkRijen(clubs, docs, { toegestaan, standaard } = {}){
  const std = standaardWaarden(standaard);
  return (clubs || []).map(k => {
    const c = (docs || {})[k.id] || { id: k.id }, w = waardenVan(c, toegestaan), afw = afwijkingen(w, std);
    return { id: k.id, naam: k.naam || c.naam || 'Club zonder naam', plaats: k.plaats || '', fase: k.fase || '', waarden: w, afwijkingen: afw, afwijkend: afw.length > 0,
      ai: k.ai || null, werkwijze: (c.instellingen && c.instellingen.werkwijze) === 'club' ? 'club' : 'vrij' };
  });
}
export function filterMaatwerk(rijen, { filter = 'alle', zoek = '' } = {}){
  const z = String(zoek || '').trim().toLowerCase();
  return (rijen || []).filter(r => (filter !== 'afwijkend' || r.afwijkend) && (filter !== 'standaard' || !r.afwijkend)
    && (!z || [r.naam, r.plaats].some(x => String(x || '').toLowerCase().includes(z))));
}
/* Per onderdeel: bij hoeveel clubs staat het aan? Voor de kop van de tabel. */
export function tellingPerOnderdeel(rijen){
  const uit = {};
  for (const o of SCHAKELAARS) uit[o.id] = (rijen || []).filter(r => r.waarden[o.id]).length;
  return uit;
}

/* ---------- Clubdetail: "Maatwerk voor deze club" ----------
   Alles wat deze club anders heeft dan een club die net begint, in gewone taal, met het tabblad waar je het aanpast.
   profiel = clubprofielen/{id} (mag ontbreken). Elke regel: { id, titel, tekst, tab, eigen }. */
export function maatwerkOverzicht(club = {}, { toegestaan, standaard, profiel = null, pdfStandaard = true, eigenRolNamen = [] } = {}){
  const i = club.instellingen || {}, id = i.identiteit || {}, pm = club.platformModules || {};
  const w = waardenVan(club, toegestaan), afw = afwijkingen(w, standaardWaarden(standaard));
  const regels = [];
  regels.push({ id: 'onderdelen', titel: 'Onderdelen en limieten', tab: 'onderdelen', eigen: afw.length > 0,
    tekst: afw.length ? afw.map(a => a.tekst).join(' · ') : 'Zoals de standaard voor nieuwe clubs' });
  const tk = Object.keys(pm.teamkamerOpties || {}).filter(k => pm.teamkamerOpties[k] === true).length;
  if (pm.teamkamer === true) regels.push({ id: 'teamkamer', titel: 'Teamkamer', tab: 'onderdelen', eigen: true,
    tekst: tk ? `${tk} mogelijkhe${tk === 1 ? 'id' : 'den'} aan` : 'Aan, alleen agenda en aantallen' });
  regels.push({ id: 'pdf', titel: 'PDF-trainingen', tab: 'pdf', eigen: !pdfStandaard,
    tekst: pdfStandaard ? 'Standaardprofiel' : 'Eigen profiel voor de oefenstof van deze club' });
  const docs = Object.keys((profiel && profiel.documenten) || {}).length;
  const gezet = Object.values((profiel && profiel.bevindingen) || {}).filter(b => b && b.gezet).length;
  regels.push({ id: 'profiel', titel: 'Clubprofiel', tab: 'profiel', eigen: docs > 0 || gezet > 0,
    tekst: docs || gezet ? `${docs} document${docs === 1 ? '' : 'en'} ingelezen · ${gezet} onderwerp${gezet === 1 ? '' : 'en'} in Cluppie gezet` : 'Nog geen documenten van de club ingelezen' });
  /* wat de club zelf heeft ingericht (aanpassen via Meehelpen of het Clubprofiel) */
  const eigenKleur = !!id.logo || (!!id.kleur && String(id.kleur).toLowerCase() !== '#e2342f');
  const huis = [id.logo ? 'eigen logo' : '', id.kleur && String(id.kleur).toLowerCase() !== '#e2342f' ? `clubkleur ${id.kleur}` : ''].filter(Boolean);
  regels.push({ id: 'huisstijl', titel: 'Huisstijl', tab: 'meehelpen', eigen: eigenKleur, tekst: huis.join(' · ') || 'Cluppie-standaard (rood, geen logo)' });
  regels.push({ id: 'werkwijze', titel: 'Werkwijze', tab: 'meehelpen', eigen: i.werkwijze === 'club',
    tekst: i.werkwijze === 'club' ? 'Club stuurt: hoofd jeugd en coördinatoren maken het plan' : 'Trainers vrij: elke trainer maakt zijn eigen trainingen' });
  if (eigenRolNamen.length) regels.push({ id: 'rolnamen', titel: 'Eigen rolnamen', tab: 'profiel', eigen: true, tekst: eigenRolNamen.join(' · ') });
  const eb = (Array.isArray(club.eigenBouwen) ? club.eigenBouwen : []).filter(x => x && x.id);
  if (eb.length) regels.push({ id: 'eigenbouwen', titel: 'Eigen bouwen', tab: 'mensen', eigen: true, tekst: eb.map(b => b.naam || 'Eigen bouw').join(' · ') });
  const lijsten = Object.keys(i.lijsten || {}).length;
  if (lijsten) regels.push({ id: 'lijsten', titel: 'Eigen lijsten', tab: 'meehelpen', eigen: true, tekst: `${lijsten} lijst${lijsten === 1 ? '' : 'en'} aangepast (domeinen, tags, redenen)` });
  if (i.toegang && i.toegang.ondersteuning === false) regels.push({ id: 'ondersteuning', titel: 'Meehelpen', tab: 'meehelpen', eigen: true, tekst: 'Door de club uitgezet' });
  return { regels, eigen: regels.filter(r => r.eigen).length };
}

/* ---------- Notities en wensen van de eindbaas ---------- */
export const NOTITIE_MAX = 4000;
export const WENS_MAX = 200;
export const WENSEN_MAX = 40;
export function schoonMaatwerk(m){
  const b = m && typeof m === 'object' ? m : {};
  const wensen = (Array.isArray(b.wensen) ? b.wensen : []).map(x => ({
    id: String((x && x.id) || '').slice(0, 24), tekst: String((x && x.tekst) || '').replace(/\s+/g, ' ').trim().slice(0, WENS_MAX),
    klaar: !!(x && x.klaar), ms: Number(x && x.ms) || 0,
  })).filter(x => x.id && x.tekst).slice(0, WENSEN_MAX);
  return { notitie: String(b.notitie || '').replace(/\r/g, '').slice(0, NOTITIE_MAX), wensen, contact: String(b.contact || '').replace(/\s+/g, ' ').trim().slice(0, 120) };
}
export function wensErbij(m, tekst, nuMs = Date.now(), id = 'w' + nuMs.toString(36)){
  const s = schoonMaatwerk(m), t = String(tekst || '').replace(/\s+/g, ' ').trim().slice(0, WENS_MAX);
  if (!t) return s;
  return { ...s, wensen: [...s.wensen, { id, tekst: t, klaar: false, ms: nuMs }].slice(-WENSEN_MAX) };
}
export function wensZet(m, id, klaar){
  const s = schoonMaatwerk(m);
  return { ...s, wensen: s.wensen.map(w => w.id === id ? { ...w, klaar: !!klaar } : w) };
}
export function wensWeg(m, id){
  const s = schoonMaatwerk(m);
  return { ...s, wensen: s.wensen.filter(w => w.id !== id) };
}
/* open wensen eerst, daarna de afgeronde; binnen een groep de nieuwste bovenaan */
export function wensenGesorteerd(m){
  return [...schoonMaatwerk(m).wensen].sort((a, b) => (a.klaar - b.klaar) || (b.ms - a.ms));
}
