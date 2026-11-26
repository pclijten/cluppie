/* ==================== DRAAIBOEK PER ONDERWERP [20261126z] ====================
   PURE module (geen DOM, geen Firebase). Paul (26-11-2026): het draaiboek was één lange takenlijst en wat je
   moest invullen stond verspreid over twaalf tabbladen. Nu is het draaiboek ingedeeld in onderwerpen
   (Kantine en inkoop, Vrijwilligers, Communicatie …). Elk onderwerp heeft een eigenaar, zijn taken, vragen om
   in te vullen (afspraken) en de lijsten die erbij horen (spullen, kosten, diensten, berichten …).
   Mockups en keuzes: /mnt/project-files/draaiboek/ en de thread "Maak draaiboek en evenementenplanner overzichtelijker".

   Opslag (in de activiteit, alleen wat afwijkt van de standaard, zodat oude activiteiten gewoon werken):
     onderwerpen:{ [id]: { naam?, icoon?, eigenaar?, volg?, eigen?, weg?,
                           vragen:{ [vid]: { antwoord } | { vraag, ph, antwoord, volg } | { weg:true } } } }
     taken.<id>.onderwerp     (anders afgeleid uit rol, titel en fase)
     taken.<id>.antw.<sleutel> antwoorden op de vragen van één taak (zie TAAK_VRAGEN)
     materiaal/budget.<id>.onderwerp  bij welk onderwerp een regel hoort (anders het standaardonderwerp)
   Daarnaast: draaiboekDoc() maakt het hele draaiboek als document (leesweergave, PDF en Word).
   Getest in tests/draaiboek.test.mjs. */
import * as L from './activiteiten-logica.js?v=20261126y';

/* ---------- onderwerpen ---------- */
/* blokken: wat er onder de afspraken staat. Elk blok hoort bij een tabblad dat in 'Onderdelen' uit kan. */
export const BLOK_TAB = { gegevens: '', comite: 'mensen', documenten: 'documenten', deelnemers: 'deelnemers', toernooi: 'toernooi', programma: 'programma',
  vrijwilligers: 'vrijwilligers', communicatie: 'communicatie', spullen: 'locatie', veiligheid: 'locatie', kosten: 'budget', budget: 'budget', evaluatie: 'evaluatie' };

const V = (id, vraag, ph = '') => ({ id, vraag, ph });
export const ONDERWERPEN = [
  { id: 'basis', naam: 'Datum, plek en comité', icoon: 'match-location', blokken: ['gegevens', 'comite', 'documenten'],
    vragen: [V('contact', 'Contactpersoon van de locatie', 'Naam en telefoonnummer'), V('afspraken', 'Afspraken met de locatie', 'Tijden, sleutel, huur, parkeren')] },
  { id: 'wedstrijd', naam: 'Programma en deelnemers', naamToernooi: 'Wedstrijdzaken', icoon: 'planning-day', icoonToernooi: 'football-tournament',
    blokken: ['deelnemers', 'spullen', 'toernooi', 'programma'],
    vragen: [V('opzet', 'Opzet', 'Voor wie, welke onderdelen of speelvorm, hoe lang'), V('groepen', 'Groepen of teams', 'Hoeveel, hoe ingedeeld')] },
  { id: 'kantine', naam: 'Kantine en inkoop', icoon: 'activiteit-kantine', blokken: ['spullen', 'kosten'],
    vragen: [V('leverancier', 'Leverancier eten en drinken', 'Winkel of groothandel'), V('contact', 'Contact leverancier', 'Telefoon of mail'),
      V('levering', 'Bezorgen of ophalen', 'Wanneer en door wie'), V('bijzonder', 'Bijzonderheden', 'Allergieën, koelruimte, kassa, pinautomaat')] },
  { id: 'vrijwilligers', naam: 'Vrijwilligers', icoon: 'tag-handshake', blokken: ['vrijwilligers'],
    vragen: [V('aanspreek', 'Aanspreekpunt op de dag', 'Naam en telefoonnummer'), V('bedankje', 'Bedankje voor de vrijwilligers', 'Consumptiebon, attentie')] },
  { id: 'communicatie', naam: 'Communicatie', icoon: 'tag-megaphone', blokken: ['communicatie'],
    vragen: [V('kanalen', 'Via welke kanalen', 'WhatsApp, website, social media, nieuwsbrief'), V('foto', 'Foto en video op de dag', 'Wie maakt ze, waar komen ze te staan')] },
  { id: 'veiligheid', naam: 'Veiligheid', icoon: 'activiteit-veiligheid', blokken: ['veiligheid'],
    vragen: [V('ehbo', 'EHBO op de dag', 'Naam en telefoonnummer'), V('nood', 'Noodnummer en verzamelplek', '')] },
  { id: 'budget', naam: 'Budget', icoon: 'activiteit-budget', blokken: ['budget'],
    vragen: [V('betaling', 'Hoe wordt er betaald', 'Clubpas, voorschieten en declareren, factuur'), V('bijdragen', 'Sponsoren en bijdragen', '')] },
  { id: 'na', naam: 'Na afloop', icoon: 'activiteit-afronding', blokken: ['evaluatie'],
    vragen: [V('opruimen', 'Wie ruimt op', 'Namen, hoe laat klaar'), V('bedanken', 'Wie bedankt wie', 'Vrijwilligers, sponsoren, locatie')] },
];
export const EIGEN_ICOON = 'planning-activity';
export const MAX_ONDERWERPEN = 20, MAX_VRAGEN = 15, ANTWOORD_MAX = 1000;

/* Welke comitérol hoort bij welk onderwerp (rollen uit de sjablonen, maar ook vrij gekozen rollen). */
const ROL_ONDERWERP = [
  [/vrijwillig/i, 'vrijwilligers'], [/communicatie|\bpr\b|media|ledenwerving/i, 'communicatie'], [/veilig|ehbo/i, 'veiligheid'],
  [/penning|sponsor|budget|financ/i, 'budget'], [/kantine|inkoop|eten|drink|catering/i, 'kantine'],
  [/wedstrijd|programma|oefening|clinic|spreker|sint|piet|gastclub|scholen|kraam|vervoer/i, 'wedstrijd'],
  [/voorzitter|kampleiding|ontvangst|locatie/i, 'basis'],
];
/* Trefwoorden in de titel van een taak, als de rol niets zegt. Volgorde telt. */
const TITEL_ONDERWERP = [
  [/evalu|opruim|bedank|afronden|terugkijk/i, 'na'],
  [/vrijwillig|dienst|rooster/i, 'vrijwilligers'],
  [/bericht|aankondig|informeer|informeren|uitnodig|poster|flyer|social|nieuwsbrief|website|persbericht/i, 'communicatie'],
  [/ehbo|\baed\b|veilig|vergunning|verzekering|\bvog\b|nood/i, 'veiligheid'],
  [/begroting|budget|sponsor|betaal|factuur|kosten/i, 'budget'],
  [/kantine|inkoop|boodschap|bestel|eten|drinken|catering|versiering|prijzen|bekers|medaille|traktatie/i, 'kantine'],
  [/speel|wedstrijd|poule|schema|teams? indel|inschrijving|programma|oefening|clinic|spreker|deelnemer|scheidsrechter/i, 'wedstrijd'],
  [/datum|locatie|zaal|veld|comit[eé]|huur|reserve/i, 'basis'],
];
export function rolNaarOnderwerp(rol){ for (const [re, id] of ROL_ONDERWERP) if (re.test(String(rol || ''))) return id; return ''; }
export function titelNaarOnderwerp(titel){ for (const [re, id] of TITEL_ONDERWERP) if (re.test(String(titel || ''))) return id; return ''; }

const isToernooi = act => act?.tabs?.toernooi === true || (act?.tabs?.toernooi === undefined && /toernooi/i.test(`${act?.type || ''} ${act?.sjabloon || ''}`));
/* Voor de naam en het icoon: is dit echt een toernooi (sjabloon of type), niet alleen 'tab toernooi staat aan'? */
const heetToernooi = act => /toernooi/i.test(`${act?.type || ''} ${act?.sjabloon || ''} ${act?.naam || ''}`) || Object.keys(act?.toernooi?.teams || {}).length > 0;
export const blokAan = (act, blok) => { const tab = BLOK_TAB[blok]; if (!tab) return true; if (tab === 'toernooi') return isToernooi(act); return act?.tabs?.[tab] !== false; };

/* De onderwerpen van een activiteit: de standaard, aangevuld en overschreven met wat er is opgeslagen.
   Een standaardonderwerp zonder taken en zonder blokken die aan staan, laten we weg (een informatieavond
   zonder budget krijgt geen leeg onderwerp Budget). */
export function onderwerpen(act, { ookLeeg = false } = {}){
  const opgeslagen = act?.onderwerpen && typeof act.onderwerpen === 'object' ? act.onderwerpen : {};
  const toern = heetToernooi(act);
  const lijst = [];
  ONDERWERPEN.forEach((o, i) => {
    const s = opgeslagen[o.id] || {};
    if (s.weg === true) return;
    lijst.push({ id: o.id, naam: String(s.naam || (toern && o.naamToernooi) || o.naam), icoon: s.icoon || (toern && o.icoonToernooi) || o.icoon,
      eigenaar: s.eigenaar || '', volg: Number.isFinite(Number(s.volg)) ? Number(s.volg) : i * 10, standaard: true,
      blokken: o.blokken.filter(b => blokAan(act, b)), vragen: vragenVan(o.vragen, s.vragen) });
  });
  for (const [id, s] of Object.entries(opgeslagen)){
    if (!s || typeof s !== 'object' || s.weg === true || ONDERWERPEN.some(o => o.id === id) || !String(s.naam || '').trim()) continue;
    lijst.push({ id, naam: String(s.naam), icoon: s.icoon || EIGEN_ICOON, eigenaar: s.eigenaar || '', volg: Number(s.volg) || 100, standaard: false, eigen: true,
      blokken: [], vragen: vragenVan([], s.vragen) });
  }
  lijst.sort((a, b) => a.volg - b.volg || a.naam.localeCompare(b.naam, 'nl'));
  if (ookLeeg) return lijst;
  const ids = new Set(lijst.map(o => o.id));
  const metTaken = new Set(L.gesorteerd(act?.taken).map(t => taakOnderwerpRuw(t, ids)));
  return lijst.filter(o => !o.standaard || o.id === 'basis' || o.blokken.length || metTaken.has(o.id) || o.vragen.some(v => v.antwoord));
}
function vragenVan(standaard, opgeslagen){
  const s = opgeslagen && typeof opgeslagen === 'object' ? opgeslagen : {};
  const uit = standaard.filter(v => s[v.id]?.weg !== true).map((v, i) => ({ id: v.id, vraag: v.vraag, ph: v.ph, antwoord: String(s[v.id]?.antwoord || ''), volg: i, standaard: true }));
  for (const [id, v] of Object.entries(s)){
    if (!v || typeof v !== 'object' || v.weg === true || standaard.some(x => x.id === id) || !String(v.vraag || '').trim()) continue;
    uit.push({ id, vraag: String(v.vraag), ph: String(v.ph || ''), antwoord: String(v.antwoord || ''), volg: Number(v.volg) || 100, standaard: false });
  }
  return uit.sort((a, b) => a.volg - b.volg);
}
/* Bij welk onderwerp hoort een taak? Eigen keuze, dan na afloop, dan de rol, dan de titel, dan 'basis'. */
function taakOnderwerpRuw(t, ids){
  if (t?.onderwerp && ids.has(t.onderwerp)) return t.onderwerp;
  const kies = id => (id && ids.has(id) ? id : '');
  const na = t?.fase === 'na' || (t?.fase === undefined && Number(t?.d) < 0) ? kies('na') : '';
  const rol = rolNaarOnderwerp(t?.rol);
  return na || (rol !== 'basis' && kies(rol)) || kies(titelNaarOnderwerp(t?.titel)) || kies(rol) || kies('basis') || [...ids][0] || '';
}
export function taakOnderwerp(t, act, lijst = onderwerpen(act)){ return taakOnderwerpRuw(t, new Set(lijst.map(o => o.id))); }

/* Eigenaar van een onderwerp: zelf gekozen, anders het comitélid met een rol die erbij hoort. */
export function eigenaarVan(o, act){
  if (o.eigenaar && act?.comite?.[o.eigenaar]) return { id: o.eigenaar, naam: act.comite[o.eigenaar].naam, gekozen: true };
  const l = L.gesorteerd(act?.comite).find(x => x.rol && rolNaarOnderwerp(x.rol) === o.id);
  return l ? { id: l.id, naam: l.naam, gekozen: false } : null;
}

/* Per onderwerp: taken (op datum), klaar, te laat, ingevuld. */
export function perOnderwerp(act, vandaag){
  const lijst = onderwerpen(act), ids = new Set(lijst.map(o => o.id));
  const taken = L.takenOpDatum(act || {});
  return lijst.map(o => {
    const eigen = taken.filter(t => taakOnderwerpRuw(t, ids) === o.id);
    const staat = eigen.map(t => L.taakStaat(t, act?.datum, vandaag));
    return { ...o, taken: eigen, klaar: staat.filter(s => s === 'klaar').length, telaat: staat.filter(s => s === 'telaat').length,
      ingevuld: o.vragen.filter(v => v.antwoord.trim()).length, eigenaarInfo: eigenaarVan(o, act) };
  });
}

/* Regels (spullen, kosten) die bij een onderwerp horen. Een regel zonder onderwerp gaat op naam ('Bekers' hoort
   bij Kantine en inkoop); lukt dat niet, dan staan spullen bij het eerste onderwerp met spullen en staan kosten
   alleen in het onderwerp Budget. Inkomsten horen niet bij de kosten van een onderwerp. */
export function regelsVan(map, onderwerpId, act, blok){
  const lijst = onderwerpen(act, { ookLeeg: true }), ids = new Set(lijst.map(o => o.id));
  const metBlok = lijst.filter(o => o.blokken.includes(blok)).map(o => o.id);
  const standaard = blok === 'kosten' ? '' : (metBlok[0] || '');
  return L.gesorteerd(map).filter(r => {
    if (blok === 'kosten' && r.soort === 'in') return false;
    if (r.onderwerp && ids.has(r.onderwerp)) return r.onderwerp === onderwerpId;
    const kw = titelNaarOnderwerp(r.naam);
    return (metBlok.includes(kw) ? kw : standaard) === onderwerpId;
  });
}

/* ---------- vragen bij één taak ---------- */
/* Wat je bij een taak invult, afhankelijk van wat voor taak het is, en welke lijsten van het onderwerp je er
   meteen bij ziet (blokken). Kosten vul je in de kostenregels van het onderwerp in, die tellen mee in het budget.
   naar: het onderwerp waar het echte werk staat (diensten, berichten). */
export const TAAK_VRAGEN = [
  { re: /begroting|budget/i, vragen: [], blokken: ['budget'] },
  { re: /bestel|inkoop|boodschap|prijzen|medaille|beker|versiering|catering|traktatie|kantine/i, blokken: ['spullen', 'kosten'],
    vragen: [{ k: 'waar', v: 'Waar of bij wie?', ph: 'Winkel, leverancier, webshop' }, { k: 'wanneer', v: 'Besteld of geregeld op', ph: 'Bijvoorbeeld 18 nov, bestelnummer' }] },
  { re: /reserve|huur|zaal|velden|locatie|datum/i, blokken: ['gegevens'],
    vragen: [{ k: 'contact', v: 'Contactpersoon en telefoon', ph: '' }, { k: 'afspraak', v: 'Wat is afgesproken', ph: 'Tijden, sleutel, kosten' }] },
  { re: /sponsor/i, blokken: ['budget'], vragen: [{ k: 'wie', v: 'Wie is benaderd?', ph: '' }, { k: 'toezegging', v: 'Wat is toegezegd?', ph: '' }] },
  { re: /spreker|clinic|workshop|\bdj\b|muziek|fotograaf|sint|piet|springkussen|gast/i, blokken: ['kosten'],
    vragen: [{ k: 'wie', v: 'Wie komt er?', ph: '' }, { k: 'contact', v: 'Contact', ph: 'Telefoon of mail' }, { k: 'afspraak', v: 'Afspraken', ph: 'Tijd, vergoeding, wat nodig' }] },
  { re: /materiaal|spullen|klaarzetten|opbouw/i, blokken: ['spullen'], vragen: [] },
  { re: /vervoer|\bbus\b|rijden|chauffeur/i, vragen: [{ k: 'hoe', v: 'Hoe gaan we?', ph: 'Auto’s, bus, fiets' }, { k: 'wie', v: 'Wie rijden er?', ph: '' }] },
  { re: /ehbo|\baed\b|veilig|vergunning|verzekering/i, blokken: ['veiligheid'], vragen: [{ k: 'wie', v: 'Wie regelt het of is er?', ph: '' }] },
  { re: /vrijwillig|dienst|rooster/i, naar: 'vrijwilligers', vragen: [] },
  { re: /bericht|aankondig|informeer|informeren|uitnodig|poster|flyer|nieuwsbrief/i, naar: 'communicatie', vragen: [] },
  { re: /speelschema|poule|indelen|inschrijving|deelnemer/i, naar: 'wedstrijd', vragen: [] },
  { re: /comit[eé]|rollen/i, blokken: ['comite'], vragen: [] },
];
export function taakVragen(t){
  const r = TAAK_VRAGEN.find(x => x.re.test(String(t?.titel || '')));
  return { vragen: r?.vragen || [], blokken: r?.blokken || [], naar: r?.naar || '' };
}

/* ---------- het draaiboek als document ---------- */
/* Eén model voor de leesweergave, de PDF en Word.
   { titel, sub, secties:[{ id, kop, eigenaar, delen:[ {soort:'dl', rijen:[[k,v]]} | {soort:'tabel', kop:[], rijen:[[]], vink?} | {soort:'tekst', tekst} | {soort:'kop', tekst} ] }] }
   opts: { deel, aanm, vandaag, alleen: onderwerpId, teams: [{id,naam}], euro } */
export function draaiboekDoc(act, opts = {}){
  const a = act || {}, v = opts.vandaag || '';
  const lid = id => a.comite?.[id]?.naam || '';
  const lijst = perOnderwerp(a, v);
  const sub = [L.datumLang(a.datum), a.start ? `${a.start}${a.eind ? '–' + a.eind : ''}` : '', a.locatie].filter(Boolean).join(' · ');
  const vink = b => (b ? '☑' : '☐');
  const secties = [];
  for (const o of lijst){
    if (opts.alleen && o.id !== opts.alleen) continue;
    const delen = [];
    if (o.vragen.length) delen.push({ soort: 'dl', rijen: o.vragen.map(x => [x.vraag, x.antwoord.trim() || '…']) });
    if (o.taken.length) delen.push({ soort: 'tabel', vink: true, kop: ['', 'Klaar vóór', 'Taak', 'Wie'], rijen: o.taken.map(t => {
      const tv = taakVragen(t).vragen.filter(q => String(t.antw?.[q.k] || '').trim()).map(q => `${q.v} ${t.antw[q.k]}`);
      const extra = [...tv, t.notitie ? t.notitie : ''].filter(Boolean).join('\n');
      return [vink(t.status === 'klaar'), L.datumKort(L.taakDatum(t, a.datum)), t.titel + (extra ? '\n' + extra : ''), lid(t.eigenaar) || t.rol || ''];
    }) });
    for (const blok of o.blokken) delen.push(...blokDelen(a, o, blok, opts));
    if (!delen.length) continue;
    secties.push({ id: o.id, kop: o.naam, eigenaar: o.eigenaarInfo?.naam || '', delen });
  }
  if (!opts.alleen){
    const prog = L.programmaLijst(a.planB?.actief && Object.keys(a.programmaB || {}).length ? a.programmaB : a.programma, a.vertraging).lijst;
    if (prog.length && !lijst.some(o => o.blokken.includes('programma')))
      secties.push({ id: 'programma', kop: 'Dagprogramma', eigenaar: '', delen: programmaDelen(a, prog) });
  }
  return { titel: `Draaiboek ${a.naam || ''}`.trim(), sub, versie: v ? `Stand op ${L.datumLang(v)}` : '', secties };
}
function programmaDelen(a, prog){
  return [{ soort: 'tabel', kop: ['Tijd', 'Wat', 'Waar', 'Wie'], rijen: prog.map(p => [`${p.tijdNu}–${p.eindNu}`, p.wat || '', p.waar || '', p.wie || '']) },
    ...(a.planB?.tekst ? [{ soort: 'kop', tekst: 'Plan B' }, { soort: 'tekst', tekst: a.planB.tekst }] : [])];
}
function blokDelen(a, o, blok, opts){
  const lid = id => a.comite?.[id]?.naam || '';
  const euro = L.euro;
  switch (blok){
    case 'gegevens': return [{ soort: 'dl', rijen: [['Datum', L.datumLang(a.datum) || '…'], ['Tijd', a.start ? `${a.start}${a.eind ? '–' + a.eind : ''}` : '…'], ['Locatie', a.locatie || '…'],
      ...(a.omschrijving ? [['Omschrijving', a.omschrijving]] : [])] }];
    case 'comite': { const c = L.gesorteerd(a.comite); return c.length ? [{ soort: 'kop', tekst: 'Comité' }, { soort: 'tabel', kop: ['Naam', 'Rol'], rijen: c.map(l => [l.naam || '', l.rol || '']) }] : []; }
    case 'documenten': { const d = L.gesorteerd(a.documenten).filter(x => x.naam || x.url); return d.length ? [{ soort: 'kop', tekst: 'Documenten' }, { soort: 'tabel', kop: ['Naam', 'Link'], rijen: d.map(x => [x.naam || '', x.url || '']) }] : []; }
    case 'deelnemers': {
      const namen = (a.teams || []).map(id => (opts.teams || []).find(t => t.id === id)?.naam || '').filter(Boolean);
      const rijen = [...(namen.length ? [['Teams', namen.join(', ')]] : []), ...(a.deelnemers?.verwacht ? [['Verwacht aantal', String(a.deelnemers.verwacht)]] : []), ...(a.deelnemers?.notitie ? [['Notitie', a.deelnemers.notitie]] : [])];
      return rijen.length ? [{ soort: 'kop', tekst: 'Deelnemers' }, { soort: 'dl', rijen }] : [];
    }
    case 'programma': { const prog = L.programmaLijst(a.planB?.actief && Object.keys(a.programmaB || {}).length ? a.programmaB : a.programma, a.vertraging).lijst;
      return prog.length ? [{ soort: 'kop', tekst: 'Dagprogramma' }, ...programmaDelen(a, prog)] : []; }
    case 'toernooi': return [];
    case 'vrijwilligers': {
      if (!opts.deel) return [];
      const ds = L.telDiensten(opts.deel.diensten, opts.aanm || []);
      return ds.lijst.length ? [{ soort: 'kop', tekst: 'Diensten' }, { soort: 'tabel', kop: ['Dienst', 'Tijd', 'Plek', 'Wie'], rijen: ds.lijst.map(d => [d.naam + (d.wat ? '\n' + d.wat : ''), `${d.start || ''}–${d.eind || ''}`, d.plek || '',
        [(opts.aanm || []).filter(x => x.dienst === d.id).map(x => x.naam).join(', '), d.tekort ? `nog ${d.tekort} nodig` : ''].filter(Boolean).join(', ')]) }] : [];
    }
    case 'communicatie': {
      const b = L.gesorteerd(a.berichten, (x, y) => (Number(y.d) || 0) - (Number(x.d) || 0));
      return b.length ? [{ soort: 'kop', tekst: 'Berichten' }, { soort: 'tabel', vink: true, kop: ['', 'Wanneer', 'Bericht', 'Via'], rijen: b.map(x => [x.geplaatstMs ? '☑' : '☐',
        L.isIso(a.datum) ? L.datumKort(L.plusDagen(a.datum, -(Number(x.d) || 0))) : L.dTekst(x.d), x.titel || '', L.KANALEN[x.kanaal] || '']) }] : [];
    }
    case 'spullen': { const m = regelsVan(a.materiaal, o.id, a, 'spullen');
      return m.length ? [{ soort: 'kop', tekst: o.id === 'kantine' ? 'Inkooplijst' : 'Spullen' }, { soort: 'tabel', vink: true, kop: ['', 'Wat', 'Aantal', 'Wie'], rijen: m.map(x => [x.klaar ? '☑' : '☐', x.naam || '', x.aantal ?? '', lid(x.wie)]) }] : []; }
    case 'veiligheid': { const c = L.gesorteerd(a.checks);
      return c.length ? [{ soort: 'kop', tekst: 'Checklist' }, { soort: 'tabel', vink: true, kop: ['', 'Punt'], rijen: c.map(x => [x.klaar ? '☑' : '☐', x.titel || '']) }] : []; }
    case 'kosten': { const r = regelsVan(a.budget, o.id, a, 'kosten');
      return r.length ? [{ soort: 'kop', tekst: 'Kosten' }, { soort: 'tabel', kop: ['Post', 'Begroot', 'Werkelijk'], rijen: [...r.map(p => [(p.soort === 'in' ? '+ ' : '') + (p.naam || ''), euro(p.begroot), p.werkelijk != null ? euro(p.werkelijk) : '']),
        ['Totaal', euro(r.reduce((s, p) => s + (p.soort === 'in' ? -1 : 1) * (Number(p.begroot) || 0), 0)), euro(r.reduce((s, p) => s + (p.soort === 'in' ? -1 : 1) * (Number(p.werkelijk) || 0), 0))]] }] : []; }
    case 'budget': { const t = L.budgetTotaal(a.budget), r = L.gesorteerd(a.budget);
      return r.length ? [{ soort: 'kop', tekst: 'Begroting' }, { soort: 'tabel', kop: ['Post', 'Begroot', 'Werkelijk'], rijen: [...r.map(p => [(p.soort === 'in' ? '+ ' : '− ') + (p.naam || ''), euro(p.begroot), p.werkelijk != null ? euro(p.werkelijk) : '']),
        ['Saldo', euro(t.saldoBegroot), euro(t.saldoWerkelijk)]] }] : []; }
    case 'evaluatie': { const e = a.evaluatie || {}; const rijen = [...(e.goed ? [['Ging goed', e.goed]] : []), ...(e.beter ? [['Kan beter', e.beter]] : [])];
      return rijen.length ? [{ soort: 'kop', tekst: 'Evaluatie' }, { soort: 'dl', rijen }] : []; }
  }
  return [];
}
