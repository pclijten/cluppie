/* ==================== SPEELWIJZE: DE RODE DRAAD — logica (zonder DOM en zonder Firestore) ====================
   [20261116h] De speelstijl van de club (speelstijl-logica.js: acht onderdelen met een kant A of B) werd
   vastgelegd en getoond, maar stuurde niets. Deze module maakt er een speelwijze van die je overal terugziet:

     speelstijl (acht standen)
       → SPEELWIJZE: spelprincipes per moment van het spel (wij hebben de bal, wij verliezen hem,
         zij hebben de bal, wij winnen hem), met per principe wat je ziet als het lukt, drie coachwoorden,
         wat het op elke leeftijd betekent, een regel voor het partijspel en een vraag voor na de wedstrijd
       → SEIZOEN: thema's die bij de principes horen komen vaker terug; bij elk blok staat het principe
       → TRAINING: vormen die het principe trainen krijgen voorrang; de training heeft één leerdoel,
         dezelfde coachwoorden in elke vorm en de regel van het principe in het partijspel
       → WEDSTRIJD: de vraag van het principe bij de evaluatie; het antwoord stuurt het seizoen bij.

   Alles hier is een eigen ontwerp op basis van ervaring van trainers, geen gevalideerd model. De koppeling
   van vormen aan principes (tags) is met regels afgeleid uit soort, thema en tekst van elke vorm
   (tools/trainingsbibliotheek/principes.mjs) en per vorm te verbeteren.
   Voorrang (zoals vastgelegd in het coachmodel): veiligheid en leeftijd, dan afspraken van de club,
   dan de speelwijze, dan de trainer. Een principe waarvoor een team te jong is, stuurt dus niets.

   Zonder imports uit de app: scherm, planner en tests gebruiken deze module los van elkaar. */
import { DIMS, DIM_IDS, REFS, FASEN, statusVan } from './speelstijl-logica.js?v=20261127p';

/* ---------- de vier momenten van het spel ---------- */
export const MOMENTEN = [
  { id: 'ab', naam: 'Wij hebben de bal', kort: 'Aanvallen', kleur: '#35c47a', uitleg: 'Opbouwen, kansen maken en scoren.' },
  { id: 'ov', naam: 'Wij verliezen de bal', kort: 'Omschakelen na balverlies', kleur: '#f5b13d', uitleg: 'De eerste tellen nadat de bal weg is.' },
  { id: 'vb', naam: 'Zij hebben de bal', kort: 'Verdedigen', kleur: '#4a8fe0', uitleg: 'Storen, de bal veroveren en doelpunten voorkomen.' },
  { id: 'ow', naam: 'Wij winnen de bal', kort: 'Omschakelen na balwinst', kleur: '#e2342f', uitleg: 'De eerste tellen nadat de bal van ons is.' },
];
export const momentVan = id => MOMENTEN.find(m => m.id === id) || null;

/* Leeftijden waarop een principe als team begint, als de club dat niet zelf koos (speelstijl-logica FASEN). */
export const POORT_STANDAARD = { l1: 10, l2: 12, l3: 8 };

/* ---------- de principes ----------
   id = onderdeel + kant (d1A). Twee principes voor het moment "wij winnen de bal" volgen uit het onderdeel Tempo (w2A, w2B).
   themas: thema's van de leercurve die dit principe trainen, het belangrijkste eerst.
   poort: leeftijdsfase uit de vragenlijst; een jonger team krijgt het principe nog niet. */
const P = (id, dim, kant, moment, o) => ({ id, dim, kant, moment, poort: null, ...o });
export const PRINCIPES = [
  P('d1A', 'd1', 'A', 'ab', {
    titel: 'Wij bouwen op vanaf de keeper', kort: 'Opbouwen vanaf de keeper', poort: 'l3',
    zie: ['De keeper speelt de bal kort naar een vrije verdediger.', 'Verdedigers staan breed en open, met zicht op het veld.', 'De bal gaat via een middenvelder naar voren, niet er overheen.'],
    woorden: ['Maak het veld groot', 'Sta open', 'Zoek de vrije man'],
    bouw: { onder: 'De keeper rolt of passt de bal naar een vrije medespeler in plaats van hem weg te trappen.', midden: 'Twee verdedigers bieden zich breed aan naast de keeper; een middenvelder vraagt de bal ertussen.', boven: 'Opbouwen in een vaste structuur onder druk, met de keeper als extra veldspeler en de derde man als uitweg.' },
    themas: ['Positiespel opbouw', 'Dieptespel opbouw', 'Technische vaardigheden'],
    regel: 'Een aanval die bij de eigen keeper begint en zonder lange bal over de middenlijn komt, levert een extra punt op.',
    vraag: 'Bouwden we op vanaf de keeper, ook toen de tegenstander druk zette?',
  }),
  P('d1B', 'd1', 'B', 'ab', {
    titel: 'Wij spelen snel over de druk heen', kort: 'Over de druk heen spelen',
    zie: ['De bal gaat vroeg naar een speler voorin die hem vasthoudt.', 'Twee of drie spelers sluiten direct aan voor de tweede bal.', 'Het team schuift als blok mee omhoog.'],
    woorden: ['Diep kijken', 'Aansluiten', 'Tweede bal is van ons'],
    bouw: { onder: 'Kijk eerst of een medespeler voorin vrij staat en speel hem aan.', midden: 'Een diepe bal op de aanvaller, en de dichtstbijzijnde spelers lopen mee voor de kaats.', boven: 'Bewust de lange bal op het aanspeelpunt, met afspraken wie de tweede bal pakt en wie dekt.' },
    themas: ['Dieptespel opbouw', 'Scoren', 'Omschakelen balwinst'],
    regel: 'Een bal die in één keer bij de spits aankomt en daarna in de ploeg blijft, levert een extra punt op.',
    vraag: 'Kwam de diepe bal aan en waren we er snel bij voor de tweede bal?',
  }),
  P('d2A', 'd2', 'A', 'ab', {
    titel: 'Wij houden de bal tot er ruimte komt', kort: 'Geduldig de vrije man zoeken',
    zie: ['Spelers staan steeds in een driehoek rond de bal.', 'De bal gaat terug of opzij als vooruit dicht zit.', 'Na een paar passes komt er een vrije man aan de andere kant.'],
    woorden: ['Driehoekje', 'Terug mag', 'Andere kant'],
    bouw: { onder: 'Samen overspelen: kijk wie vrij staat voordat je de bal krijgt.', midden: 'Rondspelen in overtal en kantelen naar de vrije kant.', boven: 'De tegenstander laten schuiven met tempo in de bal en dan de open ruimte aanvallen.' },
    themas: ['Positiespel opbouw', 'Technische vaardigheden', 'Teamsport en plezier'],
    regel: 'Vijf passes achter elkaar in de eigen ploeg is een punt; een doelpunt daarna telt dubbel.',
    vraag: 'Hielden we de bal lang genoeg om de vrije man te vinden?',
  }),
  P('d2B', 'd2', 'B', 'ab', {
    titel: 'Wij spelen snel vooruit', kort: 'Snel vooruit spelen',
    zie: ['De eerste gedachte na het aannemen is vooruit.', 'Aanvallers lopen diep voordat de bal komt.', 'Een aanval duurt kort en eindigt met een doelpoging.'],
    woorden: ['Vooruit kijken', 'Diep lopen', 'Afmaken'],
    bouw: { onder: 'Durf zelf naar het doel te gaan of speel de bal naar voren.', midden: 'Neem de bal vooruit aan en speel hem in de loop van een medespeler.', boven: 'Binnen een paar passes de laatste linie aanvallen, met loopacties in de rug van de verdediging.' },
    themas: ['Dieptespel opbouw', 'Scoren', 'Uitspelen 1:1'],
    regel: 'Een doelpunt binnen tien tellen nadat de aanval begon, telt dubbel.',
    vraag: 'Speelden we vooruit zodra het kon, of bleven we te lang rondspelen?',
  }),
  P('d3A', 'd3', 'A', 'vb', {
    titel: 'Wij zetten hoog druk', kort: 'Hoog druk zetten', poort: 'l2',
    zie: ['De dichtstbijzijnde speler jaagt meteen op de bal.', 'De spelers erachter sluiten aan en dekken de korte opties af.', 'De bal wordt op de helft van de tegenstander veroverd.'],
    woorden: ['Samen jagen', 'Dichtbij dicht', 'Stuur naar de zijkant'],
    bouw: { onder: 'Probeer de bal zelf af te pakken zodra je dichtbij bent.', midden: 'Eén speler zet druk, de anderen pakken ieder een tegenstander vlakbij.', boven: 'Druk op een afgesproken moment, de tegenstander naar één kant sturen en daar met overtal veroveren.' },
    themas: ['Storen en veroveren', 'Verdedigen 1:1', 'Omschakelen balverlies'],
    regel: 'De bal veroveren op de helft van de tegenstander is een punt; scoor je daarna, dan telt het dubbel.',
    vraag: 'Zetten we samen druk, of ging er één speler alleen?',
  }),
  P('d3B', 'd3', 'B', 'vb', {
    titel: 'Wij staan compact en wachten op de fout', kort: 'Compact verdedigen',
    zie: ['De linies staan dicht bij elkaar, tussen bal en eigen doel.', 'Niemand laat zich uit zijn positie lokken.', 'De bal wordt veroverd bij een slechte pass of aanname.'],
    woorden: ['Dicht bij elkaar', 'Blijf tussen bal en doel', 'Geduld'],
    bouw: { onder: 'Ga terug naar je eigen doel als de tegenstander de bal heeft.', midden: 'Samen de ruimte voor het doel klein maken en het midden dichthouden.', boven: 'Als blok schuiven op een vaste hoogte en de tegenstander naar buiten dwingen.' },
    themas: ['Voorkomen van doelpunten', 'Verdedigen dieptespel', 'Verdedigen van voorzet'],
    regel: 'Elke aanval van de tegenstander die niet tot een doelpoging komt, is een punt voor de verdedigers.',
    vraag: 'Stonden we dicht bij elkaar toen de tegenstander de bal had?',
  }),
  P('d4A', 'd4', 'A', 'ov', {
    titel: 'Wij pakken de bal binnen vijf tellen terug', kort: 'Direct terugpakken', poort: 'l2',
    zie: ['De speler die de bal verliest, gaat er meteen achteraan.', 'De spelers rond de bal stappen naar voren in plaats van terug.', 'Binnen een paar tellen is de bal terug of ligt het spel stil.'],
    woorden: ['Vijf tellen', 'Naar de bal toe', 'Niet balen, jagen'],
    bouw: { onder: 'Bal kwijt? Probeer hem meteen zelf terug te pakken.', midden: 'De drie dichtstbijzijnde spelers jagen samen op de bal.', boven: 'Tegendruk met de dichtste spelers, terwijl de rest de diepe bal eruit haalt.' },
    themas: ['Omschakelen balverlies', 'Storen en veroveren', 'Verdedigen 1:1'],
    regel: 'Verlies je de bal en heb je hem binnen vijf tellen terug, dan krijgt je team een punt.',
    vraag: 'Gingen we na balverlies meteen achter de bal aan?',
  }),
  P('d4B', 'd4', 'B', 'ov', {
    titel: 'Wij komen snel terug achter de bal', kort: 'Terug en organiseren',
    zie: ['Na balverlies sprinten spelers terug naar hun eigen helft.', 'Het midden voor het doel is als eerste dicht.', 'Pas als het team staat, wordt er weer druk gezet.'],
    woorden: ['Terug achter de bal', 'Eerst het midden', 'Dan pas storen'],
    bouw: { onder: 'Bal kwijt? Ren terug naar je eigen doel.', midden: 'Iedereen komt achter de bal en pakt een plek tussen bal en doel.', boven: 'Terugvallen in de organisatie op een afgesproken hoogte en de counter vertragen.' },
    themas: ['Omschakelen balverlies', 'Voorkomen van doelpunten', 'Verdedigen dieptespel'],
    regel: 'Staat het hele team binnen acht tellen na balverlies achter de bal, dan is dat een punt.',
    vraag: 'Waren we na balverlies snel terug achter de bal?',
  }),
  P('d5A', 'd5', 'A', 'ab', {
    titel: 'Wij wisselen vrij van positie', kort: 'Vrij wisselen van positie',
    zie: ['Een speler die vrijkomt, loopt door naar een andere plek.', 'Een medespeler vult de plek op die leeg is geraakt.', 'Spelers spelen op meerdere posities.'],
    woorden: ['Loop door', 'Vul de plek', 'Overal mogen spelen'],
    bouw: { onder: 'Iedereen speelt overal: aanvallen en verdedigen doen we samen.', midden: 'Wissel van plek met een medespeler als dat ruimte geeft.', boven: 'Positiewisselingen binnen een structuur: de plek blijft bezet, de speler wisselt.' },
    themas: ['Teamsport en plezier', 'Positiespel opbouw', 'Uitspelen 1:1'],
    regel: 'Een doelpunt van een speler die op dat moment niet op zijn eigen plek stond, telt dubbel.',
    vraag: 'Durfden spelers van plek te wisselen en vulde iemand de open plek op?',
  }),
  P('d5B', 'd5', 'B', 'ab', {
    titel: 'Iedereen kent zijn plek en taak', kort: 'Vaste posities en taken', poort: 'l1',
    zie: ['Elke speler staat op zijn positie als de bal in de ploeg is.', 'Het veld is in de breedte en diepte bezet.', 'Spelers weten wat ze doen met en zonder bal.'],
    woorden: ['Houd je plek', 'Breed en diep', 'Ken je taak'],
    bouw: { onder: 'Nog niet: jonge spelers spelen overal en leren alle rollen.', midden: 'Een vaste plek per helft, met één taak met bal en één zonder bal.', boven: 'Taken per positie in de opstelling van het team, en die in de training terug laten komen.' },
    themas: ['Positiespel opbouw', 'Verdedigen dieptespel', 'Voorkomen van doelpunten'],
    regel: 'Een doelpunt telt alleen als alle zones van het veld bezet waren toen de aanval begon.',
    vraag: 'Bleef het veld bezet, of liep iedereen naar de bal?',
  }),
  P('d6A', 'd6', 'A', 'ab', {
    titel: 'Wij vallen aan door het midden', kort: 'Door het midden combineren',
    zie: ['Korte combinaties tussen de linies van de tegenstander.', 'Een speler kaatst en een derde loopt door.', 'Kansen komen uit een steekbal of een één-twee.'],
    woorden: ['Kaats', 'Derde man', 'Tussen de linies'],
    bouw: { onder: 'Speel samen: geef de bal en loop door om hem terug te krijgen.', midden: 'Kaatsen en doorlopen: de één-twee om een tegenstander uit te spelen.', boven: 'Tussen de linies aanspeelbaar zijn, opendraaien en de steekbal op de derde man.' },
    themas: ['Scoren', 'Positiespel opbouw', 'Dieptespel opbouw'],
    regel: 'Een doelpunt na een één-twee of een kaats telt dubbel.',
    vraag: 'Kwamen we met combinaties door het midden tot kansen?',
  }),
  P('d6B', 'd6', 'B', 'ab', {
    titel: 'Wij vallen aan via de flanken', kort: 'Via de flank met een voorzet',
    zie: ['De buitenspelers staan breed, tegen de zijlijn.', 'De bal gaat naar de vrije flank en daar komt een actie of voorzet.', 'Voor het doel lopen minstens twee spelers in.'],
    woorden: ['Breed staan', 'Achterlijn halen', 'Twee man voor het doel'],
    bouw: { onder: 'Gebruik het hele veld: ook aan de zijkant is ruimte om te dribbelen.', midden: 'Via de zijkant naar de achterlijn en de bal voor het doel leggen.', boven: 'De flank vrijspelen met een overlap, voorzetten op afgesproken zones en inlopen bij eerste en tweede paal.' },
    themas: ['Aanvallen met voorzet', 'Scoren', 'Uitspelen 1:1'],
    regel: 'Een doelpunt uit een voorzet telt dubbel.',
    vraag: 'Kwamen we via de zijkanten tot voorzetten met spelers voor het doel?',
  }),
  P('d7A', 'd7', 'A', 'vb', {
    titel: 'Wij verdedigen de ruimte', kort: 'Samen de ruimte bewaken',
    zie: ['Spelers schuiven mee met de bal, niet met een tegenstander.', 'De afstand tussen de verdedigers blijft klein.', 'Wie uitstapt, krijgt rugdekking van de speler ernaast.'],
    woorden: ['Schuif mee', 'Dek je buurman', 'Kijk naar de bal'],
    bouw: { onder: 'Nog niet als team: eerst leren verdedigen in het duel.', midden: 'Samen opschuiven naar de kant van de bal en elkaar rugdekking geven.', boven: 'Kantelen en knijpen als linie, doorgeven van tegenstanders en de ruimte achter de verdediging bewaken.' },
    themas: ['Verdedigen dieptespel', 'Voorkomen van doelpunten', 'Verdedigen van voorzet'],
    regel: 'Onderschept de verdediging een pass door het midden, dan is dat een punt.',
    vraag: 'Schoven we samen mee met de bal en gaven we elkaar rugdekking?',
  }),
  P('d7B', 'd7', 'B', 'vb', {
    titel: 'Wij winnen ons duel', kort: 'Man tegen man verdedigen',
    zie: ['Iedere speler weet wie zijn tegenstander is.', 'De verdediger staat tussen zijn tegenstander en het doel.', 'Duels worden gewonnen zonder overtreding.'],
    woorden: ['Wie heb jij?', 'Tussen man en doel', 'Blijf staan, hap niet'],
    bouw: { onder: 'Blijf bij de speler met de bal en probeer de bal af te pakken.', midden: 'Kies een tegenstander, blijf aan de goede kant en stuur hem naar buiten.', boven: 'Kort dekken in de eigen zone, het duel winnen en doordekken als een medespeler wordt uitgespeeld.' },
    themas: ['Verdedigen 1:1', 'Voorkomen van doelpunten', 'Verdedigen van voorzet'],
    regel: 'Een gewonnen duel waarna de bal in de ploeg blijft, is een punt.',
    vraag: 'Wonnen we onze duels en stonden we aan de goede kant van de tegenstander?',
  }),
  P('d8A', 'd8', 'A', 'ab', {
    titel: 'Wij durven een actie te maken', kort: 'Een actie durven maken',
    zie: ['Spelers zoeken het duel op in plaats van de bal weg te spelen.', 'Na een mislukte actie probeert een speler het opnieuw.', 'De bank en de trainer moedigen de poging aan.'],
    woorden: ['Probeer het', 'Fout mag', 'Nog een keer'],
    bouw: { onder: 'Dribbelen en passeren zoveel je wilt: zo leer je de bal de baas te worden.', midden: 'Zoek de 1 tegen 1 op de helft van de tegenstander.', boven: 'Risico nemen op de goede plek: acties voorin, zekerheid achterin.' },
    themas: ['Uitspelen 1:1', 'Technische vaardigheden', 'Scoren'],
    regel: 'Wie een tegenstander uitspeelt en daarna scoort of een assist geeft, levert een extra punt op.',
    vraag: 'Durfden spelers acties te maken, ook na een fout?',
  }),
  P('d8B', 'd8', 'B', 'ab', {
    titel: 'Wij spelen zeker', kort: 'Zeker spelen',
    zie: ['De bal wordt gespeeld naar de voet van een vrije medespeler.', 'Op de eigen helft neemt niemand risico.', 'Balverlies komt weinig voor op gevaarlijke plekken.'],
    woorden: ['Zuiver passen', 'Simpel is goed', 'Geen risico achterin'],
    bouw: { onder: 'Let op: jonge spelers leren het meest van proberen. Vraag zekerheid alleen vlak voor het eigen doel.', midden: 'Zuiver passen en aannemen; achterin de simpele oplossing kiezen.', boven: 'Balverlies vermijden in de opbouw en het risico bewaren voor het laatste deel van het veld.' },
    themas: ['Technische vaardigheden', 'Positiespel opbouw', 'Voorkomen van doelpunten'],
    regel: 'Balverlies op de eigen helft is een punt voor de tegenstander.',
    vraag: 'Hielden we de bal veilig in de ploeg op onze eigen helft?',
  }),
  P('w2A', 'd2', 'A', 'ow', {
    titel: 'Na balwinst eerst de bal veilig', kort: 'Na balwinst eerst de bal veilig', poort: 'l2',
    zie: ['De eerste pass na de verovering gaat weg uit de drukte.', 'Het team maakt het veld groot.', 'Daarna begint een nieuwe aanval.'],
    woorden: ['Eerste pass veilig', 'Uit de drukte', 'Veld groot'],
    bouw: { onder: 'Bal afgepakt? Kijk op en speel naar een vrije medespeler.', midden: 'De eerste pass naar een vrije speler aan de open kant.', boven: 'Uit de druk spelen, de bal vastzetten en de organisatie in balbezit innemen.' },
    themas: ['Omschakelen balwinst', 'Positiespel opbouw'],
    regel: 'Na het veroveren van de bal eerst drie passes in de eigen ploeg: dat is een punt.',
    vraag: 'Bleef de bal na een verovering in de ploeg?',
  }),
  P('w2B', 'd2', 'B', 'ow', {
    titel: 'Na balwinst meteen diep', kort: 'Na balwinst meteen naar voren', poort: 'l2',
    zie: ['De eerste blik na de verovering is vooruit.', 'Twee of drie spelers sprinten mee naar voren.', 'Binnen een paar tellen is er een doelpoging.'],
    woorden: ['Kijk diep', 'Sprint mee', 'Binnen tien tellen'],
    bouw: { onder: 'Bal afgepakt? Ga meteen naar het doel.', midden: 'Na balwinst de bal vooruit en met drie spelers mee.', boven: 'De counter: diepte in de eerste pass, breedte in de looplijnen en afronden voor de tegenstander staat.' },
    themas: ['Omschakelen balwinst', 'Dieptespel opbouw', 'Scoren'],
    regel: 'Verover je de bal en scoor je binnen tien tellen, dan telt het doelpunt dubbel.',
    vraag: 'Gingen we na een verovering meteen naar voren?',
  }),
];
export const PRINCIPE_IDS = PRINCIPES.map(p => p.id);
export const principe = id => PRINCIPES.find(p => p.id === id) || null;
/* Het principe aan de andere kant van hetzelfde onderdeel in hetzelfde moment (d1A ↔ d1B). */
export const tegenhanger = id => { const p = principe(id); return p ? PRINCIPES.find(x => x.dim === p.dim && x.moment === p.moment && x.kant !== p.kant)?.id || null : null; };

/* Bouw bij een leeftijd (alleen voor de tekst "op deze leeftijd"; los van de bouwindeling van een club). */
export const bouwVanLeeftijd = lv => (lv <= 9 ? 'onder' : lv <= 12 ? 'midden' : 'boven');

/* ---------- van speelstijl naar speelwijze ----------
   huidig = clubs/{id}/speelstijl/huidig of teams/{id}/speelstijl/huidig (speelstijl-logica huidigDoc).
   Geeft { actief:[…], later:[…], open:[onderdeel-id's], zin, bron } of null zonder vastgelegde stijl.
   actief[i] = { ...principe, stand (0,5 … 2), status ('duidelijk'|'neigt'), belangrijk, kracht } */
export function speelwijzeVan(huidig, leeftijd = 99){
  if (!huidig || !huidig.standen) return null;
  const actief = [], later = [], open = [];
  for (const d of DIMS){
    const s = huidig.standen[d.id]?.stand;
    const status = statusVan(s);
    if (status === 'open'){ open.push(d.id); continue; }
    const kant = s > 0 ? 'A' : 'B';
    const belangrijk = (huidig.gewichten?.[d.id] || 1) >= 2;
    for (const p of PRINCIPES.filter(x => x.dim === d.id && x.kant === kant)){
      const item = { ...p, stand: Math.abs(s), status, belangrijk, kracht: Math.min(2, Math.abs(s)) * (belangrijk ? 2 : 1) };
      const vanaf = p.poort ? (huidig.fasen?.[p.poort] ?? POORT_STANDAARD[p.poort] ?? 0) : 0;
      if (p.poort && leeftijd < vanaf){ later.push({ ...item, vanaf }); continue; }
      actief.push(item);
    }
  }
  actief.sort((a, b) => b.kracht - a.kracht || PRINCIPE_IDS.indexOf(a.id) - PRINCIPE_IDS.indexOf(b.id));
  return { actief, later, open, zin: huidig.zin || '', bron: huidig.bron || 'club', leeftijd, willenNiet: huidig.willenNiet || [], herkenning: huidig.herkenning || null };
}
export const actieveIds = sw => (sw?.actief || []).map(p => p.id);
export const perMoment = sw => MOMENTEN.map(m => ({ moment: m, principes: (sw?.actief || []).filter(p => p.moment === m.id), later: (sw?.later || []).filter(p => p.moment === m.id) }));

/* Een speelstijl-document uit een herkenningsstijl (snelle start: "wij lijken het meest op …"). */
export function huidigUitStijl(sleutel, uid = null, nu = Date.now()){
  const r = REFS[sleutel]; if (!r) return null;
  const standen = Object.fromEntries(DIM_IDS.map(id => [id, { stand: r.st[id], status: statusVan(r.st[id]) }]));
  const top = DIM_IDS.filter(id => Math.abs(r.st[id]) >= 2).slice(0, 3);
  const gewichten = Object.fromEntries(DIM_IDS.map(id => [id, top.includes(id) ? 2 : 1]));
  const delen = DIMS.filter(d => Math.abs(r.st[d.id]) >= 2).slice(0, 4).map(d => (r.st[d.id] > 0 ? d.A : d.B).toLowerCase());
  const zin = delen.length ? (delen.length === 1 ? delen[0] : delen.slice(0, -1).join(', ') + ' en ' + delen[delen.length - 1]) : '';
  return { versie: 1, modus: 'stijl', invullers: 1, standen, gewichten, fasen: {}, willenNiet: [], verschil: [],
    herkenning: { sleutel, pct: 100 }, zin: zin ? zin.charAt(0).toUpperCase() + zin.slice(1) + '.' : '', doel: [], opleiding: null, vastgelegdDoor: uid, vastgelegdMs: nu };
}

/* Momentopname van de speelstijl voor in een seizoensplan (params.speelstijl): alleen wat de speelwijze nodig heeft.
   Zo blijft een plan hetzelfde als de club of de trainer de speelwijze later wijzigt. */
export function stijlVoorPlan(huidig){
  if (!huidig?.standen) return null;
  return {
    standen: Object.fromEntries(DIM_IDS.map(id => [id, { stand: huidig.standen[id]?.stand ?? null }])),
    gewichten: Object.fromEntries(DIM_IDS.map(id => [id, huidig.gewichten?.[id] || 1])),
    fasen: Object.fromEntries(FASEN.map(f => [f.id, huidig.fasen?.[f.id] ?? null])),
    zin: huidig.zin || '', bron: huidig.bron || 'club', vastgelegdMs: huidig.vastgelegdMs || null,
  };
}

/* ---------- speelwijze → seizoen ---------- */
/* Gewicht per leercurve-thema: het eerste thema van een principe telt het zwaarst, het tweede half. Het derde thema
   van een principe is alleen verwant (voor de vormen in de bibliotheek) en stuurt het seizoen niet. Alleen actieve principes. */
export function themaGewichten(sw){
  const uit = {};
  for (const p of sw?.actief || []) p.themas.slice(0, 2).forEach((t, i) => { uit[t] = (uit[t] || 0) + p.kracht * (i === 0 ? 1 : 0.5); });
  return uit;
}
/* De thema's die door de speelwijze extra vaak terugkomen in het seizoen (maximaal n, alleen uit toegestaan). */
export function speelwijzeThemas(sw, toegestaan = null, n = 2){
  const g = themaGewichten(sw);
  return Object.keys(g).filter(t => !toegestaan || toegestaan.has(t)).sort((a, b) => g[b] - g[a]).filter(t => g[t] >= 1).slice(0, n);
}
/* Het principe dat het best bij een thema past (voor de regel "Speelwijze: …" bij een blok of training), of null. */
export function principeVoorThema(sw, thema){
  let beste = null;
  for (const p of sw?.actief || []){
    const i = p.themas.indexOf(thema); if (i < 0 || i > 1) continue;                 /* alleen het eerste en tweede thema van een principe */
    const s = p.kracht * (i === 0 ? 1 : 0.5);
    if (!beste || s > beste.s) beste = { p, s };
  }
  return beste ? beste.p : null;
}
/* Dekking: hoeveel trainingsweken van het plan werken aan elk principe en elk moment.
   plan.blokken[i] = { thema, weken }. Geeft { perPrincipe:[{id, weken, blokken}], perMoment:{ab,ov,vb,ow}, basis, totaal, gaten:[principes] }.
   kanThema(thema): kan dit thema op deze leeftijd in een plan? Een principe zonder weken is alleen een gat als dat kan. */
export function dekking(plan, sw, kanThema = () => true){
  const blokken = plan?.blokken || [];
  const totaal = blokken.reduce((a, b) => a + (b.weken || 0), 0);
  const per = new Map((sw?.actief || []).map(p => [p.id, { id: p.id, weken: 0, blokken: 0 }]));
  const perMomentUit = Object.fromEntries(MOMENTEN.map(m => [m.id, 0]));
  let basis = 0;
  for (const b of blokken){
    const p = principeVoorThema(sw, b.thema);
    if (!p){ basis += b.weken || 0; continue; }
    const r = per.get(p.id); r.weken += b.weken || 0; r.blokken += 1;
    perMomentUit[p.moment] += b.weken || 0;
  }
  const perPrincipe = [...per.values()];
  const gaten = (sw?.actief || []).filter(p => p.belangrijk && !per.get(p.id).weken && p.themas.slice(0, 2).some(kanThema));
  return { perPrincipe, perMoment: perMomentUit, basis, totaal, gaten };
}

/* ---------- speelwijze → training ---------- */
/* Extra punten voor een vorm in de planner. vorm.principes = tags uit de bibliotheek (['d1A', …]).
   Past de vorm bij een actief principe: + kracht (maximaal 4 samen). Traint hij juist de andere kant: − de helft.
   Is het principe van de training bekend (hoofd), dan telt een vorm met precies dat principe 2 extra. */
export function vormBonus(vorm, sw, hoofdId = null){
  const tags = vorm?.principes || [];
  if (!tags.length || !sw?.actief?.length) return 0;
  const kracht = new Map(sw.actief.map(p => [p.id, p.kracht]));
  let plus = 0, min = 0;
  for (const t of tags){
    if (kracht.has(t)) plus += kracht.get(t);
    else { const th = tegenhanger(t); if (th && kracht.has(th)) min += kracht.get(th) / 2; }
  }
  return Math.min(4, plus) - Math.min(2, min) + (hoofdId && tags.includes(hoofdId) ? 2 : 0);
}
/* Past deze vorm bij de speelwijze? Geeft het sterkste actieve principe van de vorm, of null. */
export function principeVanVorm(vorm, sw, hoofdId = null){
  const tags = vorm?.principes || [];
  if (hoofdId && tags.includes(hoofdId)) return (sw?.actief || []).find(p => p.id === hoofdId) || null;
  return (sw?.actief || []).find(p => tags.includes(p.id)) || null;
}

/* De vier stappen van een training: wat elke vorm bijdraagt aan het leerdoel. */
export const LESOPBOUW = {
  'warming-up': { stap: 'Voorbereiden', tekst: 'De beweging en de techniek die je straks nodig hebt, in een speelse vorm.' },
  kern1: { stap: 'Leren', tekst: 'Het principe in het klein: weinig spelers, veel herhalingen.' },
  kern2: { stap: 'Verdiepen', tekst: 'Hetzelfde principe met richting, tegenstanders en keuzes.' },
  partij: { stap: 'Toepassen', tekst: 'In de wedstrijdvorm, met de regel van de speelwijze.' },
  afsluiting: { stap: 'Terugblikken', tekst: 'Eén vraag aan de spelers over het leerdoel.' },
};
/* Wat de trainer in elke fase van een blok doet met het principe. */
const FASE_DOEL = {
  Ontdek: 'kennismaken met', Verdiep: 'beter worden in', 'Pas toe': 'toepassen in het partijspel van', Wedstrijd: 'vasthouden voor de wedstrijd van',
};

/* De rode draad van één training: van speelwijze via seizoen naar vandaag en de wedstrijd.
   o = { thema, fase, blok, weekInBlok, weken, bronPlan ('seizoensplan'|'club'|'standaard'), leeftijd }
   Zonder speelwijze of zonder passend principe: draad zonder principe (dan stuurt alleen het thema). */
export function rodeDraad(sw, o = {}){
  const p = principeVoorThema(sw, o.thema);
  const bouw = bouwVanLeeftijd(o.leeftijd ?? sw?.leeftijd ?? 99);
  const faseTekst = FASE_DOEL[o.fase] || 'werken aan';
  return {
    principe: p, heeftSpeelwijze: !!sw,
    moment: p ? momentVan(p.moment) : null,
    thema: o.thema || '', fase: o.fase || '', blok: o.blok || null, weekInBlok: o.weekInBlok || null, weken: o.weken || null, bronPlan: o.bronPlan || 'standaard',
    leerdoel: p ? `${hoofdletter(faseTekst)} “${p.kort.toLowerCase()}”: ${kleineLetter(p.bouw[bouw])}` : `${hoofdletter(faseTekst)} het thema ${o.thema || ''}.`,
    succes: p ? p.zie : [],
    woorden: p ? p.woorden : [],
    regel: p ? p.regel : null,
    wedstrijdvraag: p ? p.vraag : null,
    opLeeftijd: p ? p.bouw[bouw] : '',
  };
}
const hoofdletter = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const kleineLetter = s => String(s).charAt(0).toLowerCase() + String(s).slice(1);

/* ---------- waar komt de speelwijze terug? (voor het scherm Speelwijze) ---------- */
/* Telt per actief principe de vormen in de bibliotheek die passen bij de leeftijd. */
export function vormenPerPrincipe(vormen, sw, leeftijd = null){
  const uit = Object.fromEntries(actieveIds(sw).map(id => [id, 0]));
  for (const v of vormen || []){
    if (leeftijd !== null && leeftijd < 99 && !(leeftijd >= v.leeftijd?.[0] && leeftijd <= v.leeftijd?.[1])) continue;
    for (const t of v.principes || []) if (t in uit) uit[t]++;
  }
  return uit;
}

/* Tekst van de leeftijdspoort bij een principe dat later komt. */
export const laterTekst = p => (p.vanaf >= 99 ? `Niet bij de jeugd: ${p.kort.toLowerCase()}.` : `Komt vanaf O${p.vanaf}: ${p.kort.toLowerCase()}.`);
export { FASEN };
