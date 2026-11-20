/* ==================== CLUBPROFIEL — logica (zonder DOM en zonder Firestore) ====================
   De eindbaas leest de documenten van een club in (beleidsplan, jeugdplan, reglement …). De AI zet
   wat erin staat in een VASTE set hoofdstukken; de inhoud verschilt per club. Elk hoofdstuk heeft
   velden: een onderwerp en de vraag die je de club stelt als het nergens staat.
   Scherm: platform-clubprofiel.js. Functies: functions/clubprofiel.js.

   [20261120d] Elk veld heeft een VASTE bestemming in Cluppie, en de AI levert het voorstel er meteen bij:
     - instellingen   (INSTELLEN hieronder: bouwen, grenzen, rolnamen, werkwijze, formatie, identiteit)
     - Clubwijzer     een tekst voor trainers: clubs/{id}/content, categorie 'afspraak' (clubwijzer.js)
     - gouden regels  bij velden met regels: clubs/{id}/content, categorie 'gouden-regel'
     - evaluatierondes  [20261120e] de beoordelingsmomenten: clubs/{id}.evaluatieRondes (evaluatierondes.js)
   De eindbaas keurt goed (of past de tekst aan) en het scherm zet alles in één keer.

   Datamodel (clubprofielen/{clubId}, alleen de platformbeheerder leest en schrijft):
     v: 2, clubId, bijgewerkt, tekstStatus: 'concept' | 'gepubliceerd'
     documenten:  { <docId>: { naam, tekens, paginas, toegevoegdMs, geanalyseerdMs, gevonden } }
     bevindingen: { <id>: { veld, waarde, citaat, pagina, zeker, citaatOk, docId, bron, status: 'volledig'|'deels',
                            ontbreekt, voorstel: { tekst, regels, rondes, instellingen }, oordeel: 'open'|'akkoord'|'afgewezen',
                            verwerkt, gezet: { ms, tekst, regels, instellingen, status, ids } | null, handmatig, gemaaktMs } }
   De tekst van een document wordt NIET bewaard: alleen de bevinding met een kort citaat.

   Zonder imports: scherm en tests gebruiken deze module los van elkaar. */

export const VERSIE = 2;
export const MAX_DOCUMENT = 400000;     // tekens per document (ongeveer 150 pagina's)

/* [veld-id, onderwerp, vraag aan de club als het nergens staat, waar het in Cluppie bij hoort, { tekst: false | regels: true }]
   tekst: false = geen tekst voor de Clubwijzer (alleen een instelling); regels: true = ook losse gouden regels;
   rondes: true = ook evaluatierondes (de beoordelingsmomenten van het seizoen). */
const H = (id, naam, uitleg, velden) => ({ id, naam, uitleg, velden: velden.map(([vid, label, vraag, doel, opt]) =>
  ({ id: vid, hoofdstuk: id, label, vraag, doel, tekst: !(opt && opt.tekst === false), regels: !!(opt && opt.regels), rondes: !!(opt && opt.rondes) })) });
export const HOOFDSTUKKEN = [
  H('identiteit', 'Identiteit en taal', 'Wie de club is en welke woorden ze zelf gebruikt.', [
    ['id.naam', 'Clubnaam en afkorting', 'Hoe heet de club voluit en welke afkorting gebruiken jullie?', 'Clubinstellingen › Identiteit', { tekst: false }],
    ['id.kleur', 'Clubkleuren', 'Wat zijn de clubkleuren?', 'Clubinstellingen › Identiteit › kleur', { tekst: false }],
    ['id.plannaam', 'Naam van het beleidsplan', 'Hoe noemen jullie het plan voor de jeugd (jeugdbeleidsplan, opleidingsplan …)?', 'Clubinstellingen › Identiteit › naam beleidsplan', { tekst: false }],
    ['id.kernwaarden', 'Missie en kernwaarden', 'Waar staat de club voor, en wat zijn de kernwaarden of de missie?', 'Content › Club-kompas'],
    ['id.termen', 'Eigen woorden van de club', 'Welke woorden gebruiken jullie die elders anders heten (leider, TC, kabouters …)?', 'Wens: eigen termen'],
  ]),
  H('rollen', 'Organisatie en rollen', 'Welke functies er zijn, hoe ze heten en wie wat beslist.', [
    ['rol.lijst', 'Functies in de jeugdopleiding', 'Welke functies kent de jeugdopleiding en hoe heten ze bij jullie?', 'Rollen in Cluppie (namen)'],
    ['rol.hoofd', 'Eindverantwoordelijke voor de jeugd', 'Wie is eindverantwoordelijk voor de jeugdopleiding en hoe heet die functie?', 'Clubinstellingen › naam hoofd jeugdopleiding'],
    ['rol.coordinatoren', 'Coördinatoren per bouw of leeftijd', 'Zijn er coördinatoren per bouw of leeftijdsgroep, en wat is hun taak?', 'Club › Bouwen › coördinatoren'],
    ['rol.team', 'Staf rond een team', 'Wie staan er rond een team (trainer, leider, assistent) en wat doet ieder?', 'Team › coaches en rollen'],
    ['rol.besluit', 'Wie beslist wat', 'Wie beslist over teamindeling, oefenstof en doorschuiven van spelers?', 'Clubinstellingen › werkwijze (trainers vrij of club stuurt)'],
    ['rol.overig', 'Andere functies', 'Zijn er functies zoals keeperstrainer, scout of vertrouwenscontactpersoon?', 'Wens: rollen die Cluppie niet kent'],
  ]),
  H('bouwen', 'Bouwen en leeftijdsgroepen', 'Hoe de club de jeugd in groepen verdeelt.', [
    ['bouw.indeling', 'Bouwen en hun namen', 'In welke bouwen is de jeugd verdeeld en hoe heten ze?', 'Clubinstellingen › Lijsten › Standaardbouwen'],
    ['bouw.grenzen', 'Leeftijden per bouw', 'Welke leeftijden horen bij welke bouw?', 'Clubinstellingen › Regels › bouwgrenzen'],
    ['bouw.eigen', 'Aparte groepen', 'Zijn er aparte groepen, zoals meiden, selectie, keepers of G-voetbal?', 'Club › Bouwen › eigen bouwen'],
  ]),
  H('teams', 'Teams en indeling', 'Welke teams er zijn en hoe spelers worden ingedeeld.', [
    ['team.aanbod', 'Aanbod van teams', 'Voor welke leeftijden hebben jullie teams, en zijn er meidenteams?', 'Teams (via Sportlink of handmatig)'],
    ['team.selectie', 'Selectie of breedte', 'Werken jullie met selectieteams, en vanaf welke leeftijd?', 'Club › Bouwen › selectie'],
    ['team.indeling', 'Hoe de indeling tot stand komt', 'Hoe en wanneer worden de teams ingedeeld, en op welke gronden?', 'Seizoensovergang'],
    ['team.doorstroom', 'Doorschuiven en dispensatie', 'Wanneer speelt een speler hoger of lager dan zijn leeftijd?', 'Seizoensovergang en uitlenen'],
    ['team.lenen', 'Meetrainen en uitlenen', 'Wat zijn de afspraken over meetrainen of meespelen bij een ander team?', 'Uitlenen'],
  ]),
  H('speelwijze', 'Visie en speelwijze', 'Hoe de club wil voetballen.', [
    ['spel.visie', 'Voetbalvisie', 'Wat is in een paar zinnen de voetbalvisie van de club?', 'Speelstijl van de club'],
    ['spel.formatie', 'Formatie per spelvorm', 'Met welke formatie spelen jullie (6 tegen 6, 8 tegen 8, 11 tegen 11)?', 'Clubinstellingen › formatie'],
    ['spel.balbezit', 'Als wij de bal hebben', 'Hoe willen jullie spelen als je de bal hebt (opbouwen, tempo, over de flank)?', 'Speelstijl › opbouw, tempo, aanval'],
    ['spel.balverlies', 'Als wij de bal niet hebben', 'Hoe verdedigen jullie en wat gebeurt er direct na balverlies?', 'Speelstijl › druk zetten, omschakelen'],
    ['spel.principes', 'Spelprincipes', 'Welke vaste spelprincipes of afspraken gelden voor alle teams?', 'Speelwijze › principes'],
  ]),
  H('leerlijn', 'Leerlijn per leeftijd', 'Wat een speler op welke leeftijd leert.', [
    ['leer.themas', 'Thema’s per leeftijd', 'Welke onderwerpen staan per leeftijdsgroep centraal?', 'Clubinstellingen › Lijsten › Leercurve'],
    ['leer.doelen', 'Doelen per leeftijdsgroep', 'Wat moet een speler aan het eind van elke leeftijdsgroep kunnen?', 'Clubinstellingen › doelsuggesties'],
    ['leer.domeinen', 'Ontwikkeldomeinen', 'Op welke gebieden volgen jullie een speler (techniek, inzicht, fysiek, mentaal, gedrag)?', 'Clubinstellingen › Lijsten › Ontwikkeldomeinen'],
    ['leer.keepers', 'Keepers', 'Is er een eigen leerlijn of training voor keepers?', 'Wens: keepersleerlijn'],
  ]),
  H('trainen', 'Trainen', 'Hoe vaak, hoe lang en volgens welke opbouw er getraind wordt.', [
    ['train.frequentie', 'Aantal en duur van trainingen', 'Hoe vaak en hoe lang traint elke leeftijdsgroep?', 'Team › trainingsmomenten'],
    ['train.opbouw', 'Opbouw van een training', 'Heeft een training een vaste opbouw (warming-up, kern, partijspel)?', 'Training maken › opbouw'],
    ['train.oefenstof', 'Wie de oefenstof bepaalt', 'Maakt de trainer zijn eigen training of schrijft de club de oefenstof voor?', 'Clubinstellingen › werkwijze'],
    ['train.periodes', 'Jaarplanning', 'Werken jullie met periodes of thema’s per aantal weken?', 'Seizoensplan › opbouwmodel'],
    ['train.extra', 'Extra trainingen', 'Zijn er techniek-, keepers- of andere extra trainingen?', 'Trainingen en trainingscoördinator'],
  ]),
  H('wedstrijd', 'Wedstrijd', 'Speeltijd, wisselen en coachen op zaterdag.', [
    ['wed.speeltijd', 'Speeltijd', 'Wat is de afspraak over speeltijd per speler?', 'Wedstrijd › speeltijd'],
    ['wed.wissels', 'Wisselen en rouleren', 'Hoe wordt er gewisseld, en rouleren spelers over posities en op doel?', 'Wedstrijd › wissels en opstelling'],
    ['wed.coachen', 'Coachen langs de lijn', 'Hoe coacht een trainer tijdens de wedstrijd, en wat juist niet?', 'Content › Club-kompas'],
    ['wed.doelen', 'Resultaat of ontwikkeling', 'Wat telt zwaarder per leeftijd: winnen of ontwikkelen?', 'Wedstrijddoelen'],
    ['wed.toernooi', 'Toernooien en oefenwedstrijden', 'Zijn er afspraken over toernooien en oefenwedstrijden?', 'Toernooi en planning'],
  ]),
  H('evalueren', 'Evalueren en volgen', 'Hoe en hoe vaak spelers en teams beoordeeld worden.', [
    ['eval.momenten', 'Momenten in het jaar', 'Hoe vaak per seizoen worden spelers beoordeeld, en in welke maanden?', 'Club › Evaluatierondes', { rondes: true }],
    ['eval.vorm', 'Schaal en formulier', 'Met welke schaal en welk formulier worden spelers beoordeeld, en wat betekent elk niveau?', 'Clubinstellingen › Beoordelingsniveaus'],
    ['eval.criteria', 'Waarop spelers beoordeeld worden', 'Op welke onderdelen wordt een speler beoordeeld, en verschilt dat per leeftijd?', 'Clubinstellingen › Ontwikkeldomeinen'],
    ['eval.wie', 'Wie beoordeelt', 'Wie vult de beoordeling in, en kijkt er iemand mee (coördinator, tweede trainer, de speler zelf)?', 'Clubwijzer'],
    ['eval.gebruik', 'Wat er met de beoordeling gebeurt', 'Waarvoor gebruikt de club de beoordeling (teamindeling, selectie, een ontwikkelplan)?', 'Clubwijzer'],
    ['eval.gesprekken', 'Gesprekken', 'Zijn er gesprekken met de speler of de ouders over de beoordeling?', 'Wens: gespreksverslag'],
    ['eval.team', 'Teamevaluatie', 'Wordt het team als geheel geëvalueerd, en waarop?', 'Clubinstellingen › Lijsten › Teamevaluatie'],
    ['eval.inzage', 'Wie de beoordeling ziet', 'Wie mag een beoordeling lezen (trainer, coördinator, ouders, speler)?', 'Rechten en privé-beoordelingen'],
    ['eval.trainers', 'Evaluatie van trainers', 'Worden trainers zelf ook geëvalueerd of begeleid?', 'Wens: trainersevaluatie'],
  ]),
  H('gedrag', 'Gedrag en normen', 'De afspraken waar iedereen zich aan houdt.', [
    ['gedrag.regels', 'Gedragsregels', 'Welke gedragsregels gelden voor spelers en trainers?', 'Content › Gouden regels', { regels: true }],
    ['gedrag.afmelden', 'Afmelden en aanwezigheid', 'Hoe meld je je af en wat is de afspraak over aanwezigheid?', 'Clubinstellingen › Lijsten › Afwezigheidsredenen'],
    ['gedrag.ouders', 'Ouders langs de lijn', 'Wat verwachten jullie van ouders tijdens wedstrijd en training?', 'Content › Gouden regels', { regels: true }],
    ['gedrag.sancties', 'Als het misgaat', 'Wat gebeurt er als iemand zich niet aan de regels houdt?', 'Documenten'],
    ['gedrag.veilig', 'Veilig sportklimaat', 'Is er een VOG-plicht en een vertrouwenscontactpersoon?', 'Documenten en privacy'],
  ]),
  H('ouders', 'Ouders en communicatie', 'Hoe de club met ouders en spelers praat.', [
    ['comm.kanalen', 'Kanalen', 'Via welke kanalen communiceren trainers met ouders en spelers?', 'Teamkamer en berichten'],
    ['comm.ouders', 'Wat ouders te horen krijgen', 'Wat delen jullie met ouders, en hoe vaak?', 'Teamkamer › mogelijkheden'],
    ['comm.taken', 'Taken van ouders', 'Welke taken draaien ouders (rijden, wassen, vlaggen, kantine)?', 'Lijstjes'],
  ]),
  H('trainers', 'Trainers opleiden', 'Wat de club van trainers vraagt en wat ze ervoor terugkrijgen.', [
    ['opl.eisen', 'Eisen aan trainers', 'Welke diploma’s of ervaring vragen jullie per leeftijdsgroep?', 'Leerplein'],
    ['opl.begeleiding', 'Begeleiding van nieuwe trainers', 'Hoe wordt een nieuwe trainer ingewerkt en begeleid?', 'Leerplein en rondleiding'],
    ['opl.overleg', 'Overleg', 'Hoe vaak komen trainers bij elkaar, en met wie?', 'Planning'],
    ['opl.stof', 'Naslag voor trainers', 'Welke documenten of filmpjes krijgen trainers?', 'Documenten en video’s'],
  ]),
  H('kalender', 'Jaarkalender', 'De vaste momenten in het seizoen.', [
    ['kal.seizoen', 'Vaste momenten', 'Wat zijn de vaste momenten in het seizoen (start, indeling bekend, toernooi, afsluiting)?', 'Planning en evaluatierondes'],
    ['kal.overgang', 'Overgang naar het nieuwe seizoen', 'Wanneer worden de nieuwe teams bekend en wanneer starten ze?', 'Seizoensovergang'],
    ['kal.pauzes', 'Pauzes', 'Wanneer wordt er niet getraind (winterstop, vakanties)?', 'Seizoensplan › vrije weken'],
  ]),
  H('privacy', 'Privacy en toegang', 'Wat de club vastlegt en wie erbij mag.', [
    ['priv.contact', 'Aanspreekpunt privacy', 'Wie is het aanspreekpunt voor privacy?', 'Clubinstellingen › Toegang en privacy'],
    ['priv.gegevens', 'Gegevens, foto en video', 'Welke gegevens legt de club vast, en wat is de afspraak over foto en video?', 'Clubinstellingen › Toegang en privacy'],
    ['priv.toegang', 'Wie toegang krijgt', 'Wie krijgt toegang tot spelersgegevens, en wie beslist daarover?', 'Clubinstellingen › Toegang (goedkeuring)'],
  ]),
];

const VELD = new Map();
for (const h of HOOFDSTUKKEN) for (const v of h.velden) VELD.set(v.id, v);
export const alleVelden = () => [...VELD.values()];
export const hoofdstukOpId = id => HOOFDSTUKKEN.find(h => h.id === id) || null;
/* Een veld-id uit de AI: een bekend veld, of "<hoofdstuk>.overig" (iets dat in geen enkel veld past). */
export function veldOpId(id){
  if (VELD.has(id)) return VELD.get(id);
  const m = /^([a-z]+)\.overig$/.exec(String(id || ''));
  const h = m && hoofdstukOpId(m[1]);
  return h ? { id: h.id + '.overig', hoofdstuk: h.id, label: 'Overig', vraag: '', doel: '', tekst: true, regels: false, rondes: false, overig: true } : null;
}
/* De analyse loopt per groep hoofdstukken: zo krijgt elk onderwerp aandacht en blijft één antwoord klein. */
export const GROEPEN = [['identiteit', 'rollen', 'bouwen', 'teams'], ['speelwijze', 'leerlijn', 'trainen'], ['wedstrijd', 'evalueren', 'gedrag'], ['ouders', 'trainers', 'kalender', 'privacy']];

/* ---------- instellen: welke velden rechtstreeks een instelling van Cluppie zijn ----------
   [20261120c] Per veld de instellingen (pad onder clubs/{id}.instellingen) die erbij horen. Het scherm
   toont ze als formulier bij een goedgekeurd antwoord; de AI vult een voorstel in en de eindbaas past toe.
   type: tekst | getal | kleur | keuze | formatie. standaard = wat Cluppie doet als de club niets instelt. */
const T = (pad, label, max, standaard, uitleg = '') => ({ pad, label, type: 'tekst', max, standaard, uitleg });
const WERKWIJZE = { pad: 'werkwijze', label: 'Wie de trainingen en het seizoensplan maakt', type: 'keuze', standaard: 'vrij',
  opties: [['vrij', 'Trainers vrij: elke trainer maakt zijn eigen training'], ['club', 'Club stuurt: hoofd jeugd en coördinatoren maken het plan']] };
const ROL_COACH = T('rolNamen.coach', 'Naam voor de coach van een team', 40, 'Coach', 'Hoe de club de persoon noemt die een team traint, in enkelvoud');
const ROL_COORD = T('rolNamen.coordinator', 'Naam voor de bouwcoördinator', 40, 'Bouwcoördinator', 'Hoe de club de persoon noemt die een bouw of leeftijdsgroep aanstuurt, in enkelvoud');
const ROL_TRAINCO = T('rolNamen.trainco', 'Naam voor de trainingscoördinator', 40, 'Trainingscoördinator', 'Hoe de club de persoon noemt die de trainingen van alle teams overziet, in enkelvoud');
const TV = (...a) => ({ ...T(...a), verplicht: true });
const VIJF = 'Alleen invullen als de club een schaal van precies vijf niveaus gebruikt; anders laat je alle niveaus weg';
const NIVEAUS = [['Aandacht', 'AAND'], ['Op weg', 'OPW'], ['Prima', 'PRIMA'], ['Sterk', 'STERK'], ['Uitblinker', 'UITBL']].flatMap(([label, kort], i) => [
  TV(`lijsten.niveaus.items.${i + 1}.label`, `Niveau ${i + 1}${i === 0 ? ' (laagste)' : i === 4 ? ' (hoogste)' : ''}`, 16, label, VIJF),
  TV(`lijsten.niveaus.items.${i + 1}.kort`, `Niveau ${i + 1} kort`, 6, kort, 'Afkorting van hoogstens zes letters, in hoofdletters'),
]);
const EIGEN = 'Alleen invullen als de club voor precies dit gebied een eigen naam gebruikt';
const DOMEINEN = [['TE', 'Technisch', 'Techniek', 'techniek: balbeheersing, traptechniek, 1 tegen 1'], ['TA', 'Tactisch', 'Tactiek', 'tactiek: inzicht, positiespel, keuzes maken'],
  ['FY', 'Fysiek', 'Fysiek', 'fysiek: snelheid, duelkracht, fitheid'], ['ME', 'Mentaal', 'Mentaal', 'mentaal: zelfvertrouwen, durven, spelen onder weerstand'],
  ['GE', 'Gedrag & beleving', 'Gedrag', 'gedrag: inzet, teamgevoel, normen en waarden, plezier']].flatMap(([id, naam, kort, wat]) => [
  TV(`lijsten.skills.items.${id}.naam`, `Domein ${wat}`, 24, naam, EIGEN),
  TV(`lijsten.skills.items.${id}.kort`, `Korte naam`, 12, kort, 'Eén woord'),
]);
export const INSTELLEN = {
  'id.naam': [T('identiteit.afkorting', 'Afkorting van de club', 8, '', 'De afkorting zoals de club hem zelf schrijft')],
  'id.kleur': [{ pad: 'identiteit.kleur', label: 'Clubkleur', type: 'kleur', standaard: '#e2342f', uitleg: 'De hoofdkleur van de club' }],
  'id.plannaam': [T('identiteit.beleidsplanNaam', 'Naam van het beleidsplan', 40, 'jeugdbeleidsplan', 'Zonder lidwoord en met kleine letters, zoals "jeugdopleidingsplan"')],
  'rol.lijst': [ROL_COACH, ROL_COORD, ROL_TRAINCO],
  'rol.hoofd': [T('jeugdRolNaam', 'Naam voor het hoofd jeugdopleiding', 40, 'Hoofd jeugdopleiding', 'De naam van de functie, niet van de persoon')],
  'rol.coordinatoren': [ROL_COORD],
  'rol.team': [ROL_COACH],
  'rol.besluit': [WERKWIJZE],
  'train.oefenstof': [WERKWIJZE],
  'bouw.indeling': [
    T('lijsten.bouwen.items.onder.naam', 'Naam van de jongste bouw', 24, 'Onderbouw'), T('lijsten.bouwen.items.onder.kort', 'Korte naam', 12, 'Onder'),
    T('lijsten.bouwen.items.midden.naam', 'Naam van de middelste bouw', 24, 'Middenbouw'), T('lijsten.bouwen.items.midden.kort', 'Korte naam', 12, 'Midden'),
    T('lijsten.bouwen.items.boven.naam', 'Naam van de oudste bouw', 24, 'Bovenbouw'), T('lijsten.bouwen.items.boven.kort', 'Korte naam', 12, 'Boven'),
  ],
  'bouw.grenzen': [
    { pad: 'regels.bouwGrenzen.onderTm', label: 'Jongste bouw tot en met O-leeftijd', type: 'getal', min: 6, max: 17, standaard: 11, uitleg: 'De hoogste leeftijd die nog bij de jongste bouw hoort' },
    { pad: 'regels.bouwGrenzen.middenTm', label: 'Middelste bouw tot en met O-leeftijd', type: 'getal', min: 7, max: 19, standaard: 15, uitleg: 'De hoogste leeftijd die nog bij de middelste bouw hoort' },
  ],
  'eval.vorm': NIVEAUS,
  'eval.criteria': DOMEINEN,
  'leer.domeinen': DOMEINEN,
  'spel.formatie': [{ pad: 'pedagogiek.formatie11', label: 'Formatie op een heel veld', type: 'formatie', standaard: '', uitleg: 'De formatie bij 11 tegen 11, zonder keeper' }],
};
export const instelVelden = veldId => INSTELLEN[veldId] || null;
const lees = (o, pad) => pad.split('.').reduce((x, k) => (x && typeof x === 'object' ? x[k] : undefined), o);
/* Wat er nu in Cluppie staat voor dit veld (de instelling van de club, of anders de standaard). */
export function instelWaarde(instellingen, def){
  const w = lees(instellingen || {}, def.pad);
  return w === undefined || w === null || w === '' ? def.standaard : w;
}
/* Een ingevulde waarde controleren. Geeft { ok, waarde } of { ok: false, fout }. Leeg mag: dan geldt de standaard. */
export function controleerInstelling(def, ruw){
  const t = String(ruw ?? '').replace(/\s+/g, ' ').trim();
  if (def.type === 'getal'){
    const n = Math.round(Number(t));
    return t !== '' && Number.isFinite(n) && n >= def.min && n <= def.max ? { ok: true, waarde: n } : { ok: false, fout: `${def.label}: vul een getal van ${def.min} tot en met ${def.max} in` };
  }
  if (def.type === 'kleur') return /^#[0-9a-fA-F]{6}$/.test(t) ? { ok: true, waarde: t.toLowerCase() } : { ok: false, fout: `${def.label}: kies een kleur` };
  if (def.type === 'keuze') return def.opties.some(([id]) => id === t) ? { ok: true, waarde: t } : { ok: false, fout: `${def.label}: maak een keuze` };
  if (def.type === 'formatie') return t === '' || /^\d(-\d){1,4}$/.test(t) ? { ok: true, waarde: t } : { ok: false, fout: `${def.label}: schrijf de formatie als 4-3-3` };
  if (def.verplicht && !t) return { ok: false, fout: `${def.label}: vul een naam in` };
  return t.length <= def.max ? { ok: true, waarde: t } : { ok: false, fout: `${def.label}: hoogstens ${def.max} tekens` };
}
/* Alle velden van één onderwerp controleren. Geeft { fout } of { wijzigingen: [[pad, waarde], …] } met alleen wat verandert. */
export function instelWijzigingen(veldId, instellingen, ingevuld){
  const defs = instelVelden(veldId) || [], uit = [], nieuw = {};
  for (const d of defs){
    const r = controleerInstelling(d, ingevuld[d.pad]);
    if (!r.ok) return { fout: r.fout };
    nieuw[d.pad] = r.waarde;
    if (String(r.waarde) !== String(instelWaarde(instellingen, d))) uit.push([d.pad, r.waarde]);
  }
  if (veldId === 'bouw.grenzen' && !(nieuw['regels.bouwGrenzen.onderTm'] < nieuw['regels.bouwGrenzen.middenTm'])) return { fout: 'De jongste bouw moet eerder ophouden dan de middelste' };
  return { wijzigingen: uit };
}
/* Wat de functie stelClubinstellingenVoor nodig heeft. */
export const instelVeldenVoorAI = veldId => (instelVelden(veldId) || []).map(d => ({ pad: d.pad, label: d.label, type: d.type, uitleg: d.uitleg || '', min: d.min, max: d.max, opties: d.opties }));

/* Wat de functie analyseerClubdocument nodig heeft: de hoofdstukken van één groep met per veld het onderwerp,
   of er een tekst en regels gevraagd worden, en de instellingen die erbij horen. */
export function veldenVoorAI(ids){
  return HOOFDSTUKKEN.filter(h => !ids || ids.includes(h.id)).map(h => ({ id: h.id, naam: h.naam,
    velden: h.velden.map(v => ({ id: v.id, label: v.label, vraag: v.vraag, tekst: v.tekst, regels: v.regels, rondes: v.rondes, instellingen: instelVeldenVoorAI(v.id) })) }));
}
/* Waar een veld in Cluppie terechtkomt, voor het scherm: [{ soort: 'instelling'|'clubwijzer'|'regels', label }]. */
export function bestemmingen(veld){
  const h = hoofdstukOpId(veld.hoofdstuk), uit = (instelVelden(veld.id) || []).map(d => ({ soort: 'instelling', label: d.label, pad: d.pad }));
  if (veld.tekst !== false) uit.push({ soort: 'clubwijzer', label: `Clubwijzer › ${h ? h.naam : ''}` });
  if (veld.regels) uit.push({ soort: 'regels', label: 'Gouden regels' });
  if (veld.rondes) uit.push({ soort: 'rondes', label: 'Evaluatierondes' });
  return uit;
}

/* ---------- tekst ---------- */
export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* Vaste id van een document: zelfde naam en lengte = hetzelfde document (opnieuw inlezen vervangt). */
export function documentId(naam, tekens){
  let h = 0; const s = norm(naam) + '|' + tekens;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 'd' + h.toString(36);
}
/* Tekst uit word/document.xml van een .docx: alinea's worden regels, tabellen krijgen een tab per cel. */
export function docxTekst(xml){
  const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return String(xml || '')
    .replace(/<w:tab\b[^>]*\/>/g, '\t').replace(/<w:br\b[^>]*\/>/g, '\n').replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m, n) => ent[n])
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- bevindingen ---------- */
const kort = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
/* als kort(), maar regeleinden blijven (opsommingen in de Clubwijzer) */
export const alinea = (s, n) => String(s ?? '').replace(/\r/g, '').split('\n').map(x => x.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
export const regelsUit = s => (Array.isArray(s) ? s : String(s ?? '').split('\n')).map(x => kort(String(x).replace(/^[-•*]\s*/, ''), 160)).filter(Boolean).slice(0, 10);
/* ---------- evaluatierondes: de beoordelingsmomenten van het seizoen ----------
   Een ronde: { naam, soort: 'volledig'|'snel', van, tot } met datums als JJJJ-MM-DD. Trainers zien een ronde
   vanaf de startdatum bovenaan hun team (evaluatierondes.js); vooruit klaarzetten kan dus zonder dat iemand iets ziet. */
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
export function schoonRondes(lijst){
  const uit = [], namen = new Set();
  for (const r of (Array.isArray(lijst) ? lijst : [])){
    const naam = kort(r && r.naam, 60), van = String((r && r.van) || ''), tot = String((r && r.tot) || '');
    if (!naam || !DATUM.test(tot) || (van && !DATUM.test(van)) || (van && tot < van) || isNaN(Date.parse(tot)) || namen.has(naam.toLowerCase())) continue;
    namen.add(naam.toLowerCase());
    uit.push({ naam, soort: r.soort === 'snel' ? 'snel' : 'volledig', van: van || null, tot });
    if (uit.length >= 6) break;
  }
  return uit;
}
/* Het seizoen van de club ("2026/'27"), of anders het seizoen van vandaag: voor de AI en voor nieuwe rondes. */
export function seizoenVan(label, nuMs = Date.now()){
  const m = /^(\d{4})/.exec(String(label || ''));
  const d = new Date(nuMs), start = m ? Number(m[1]) : (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);
  return { start, label: m ? String(label) : `${start}/'${String(start + 1).slice(-2)}`, tekst: `augustus ${start} tot en met juni ${start + 1}` };
}
/* Rondes bij de bestaande rondes van de club voegen. Een ronde met dezelfde naam wordt bijgewerkt (datums en soort),
   niet verdubbeld; er wordt nooit een ronde weggehaald, want er kunnen al beoordelingen aan hangen. */
export function rondesSamenvoegen(bestaand, nieuw, { teams = [], seizoen = '', nuMs = Date.now() } = {}){
  const lijst = (Array.isArray(bestaand) ? bestaand : []).filter(r => r && r.id).map(r => ({ ...r })), ids = [];
  schoonRondes(nieuw).forEach((r, i) => {
    const oud = lijst.find(x => String(x.naam || '').toLowerCase() === r.naam.toLowerCase());
    if (oud){ Object.assign(oud, { soort: r.soort, van: r.van, tot: r.tot }); if (!(oud.teams || []).length) oud.teams = [...teams]; ids.push(oud.id); return; }
    const id = 'r' + nuMs.toString(36) + i;
    lijst.push({ id, naam: r.naam, soort: r.soort, van: r.van, tot: r.tot, teams: [...teams], status: 'open', seizoen, gemaaktMs: nuMs });
    ids.push(id);
  });
  return { lijst, ids };
}

/* Het voorstel voor Cluppie bij een veld: alleen wat bij dat veld hoort, instellingen gecontroleerd. */
export function schoonVoorstel(v, veldId){
  const veld = veldOpId(veldId);
  if (!veld || !v || typeof v !== 'object') return null;
  const inst = {};
  for (const d of (instelVelden(veldId) || [])){
    const w = (v.instellingen || {})[d.pad];
    if (w === undefined || w === null || w === '') continue;
    const c = controleerInstelling(d, w);
    if (c.ok) inst[d.pad] = c.waarde;
  }
  return { tekst: veld.tekst === false ? '' : alinea(v.tekst, 1500), regels: veld.regels ? regelsUit(v.regels) : [], rondes: veld.rondes ? schoonRondes(v.rondes) : [], instellingen: inst };
}
export const voorstelLeeg = v => !v || (!v.tekst && !(v.regels || []).length && !(v.rondes || []).length && !Object.keys(v.instellingen || {}).length);
export function schoonBevinding(b){
  const veld = veldOpId(b && b.veld);
  const waarde = alinea(b && b.waarde, 1500);
  if (!veld || !waarde) return null;
  const pagina = Math.round(Number(b.pagina));
  const g = b.gezet && typeof b.gezet === 'object' ? b.gezet : null;
  return {
    veld: veld.id, waarde, citaat: kort(b.citaat, 400), pagina: pagina > 0 && pagina < 5000 ? pagina : null,
    zeker: ['hoog', 'middel', 'laag'].includes(b.zeker) ? b.zeker : 'middel', citaatOk: b.citaatOk !== false,
    status: b.status === 'deels' ? 'deels' : 'volledig', ontbreekt: b.status === 'deels' ? kort(b.ontbreekt, 300) : '',
    voorstel: schoonVoorstel(b.voorstel, veld.id),
    docId: kort(b.docId, 40), bron: kort(b.bron, 120),
    oordeel: ['open', 'akkoord', 'afgewezen'].includes(b.oordeel) ? b.oordeel : 'open',
    verwerkt: b.verwerkt === true, gezet: g, handmatig: b.handmatig === true, gemaaktMs: Number(b.gemaaktMs) || 0,
  };
}
export const bevLijst = profiel => Object.entries((profiel && profiel.bevindingen) || {}).map(([id, b]) => ({ id, ...b })).filter(b => b.veld && b.waarde);
/* Opnieuw inlezen: de bevindingen van dit document die nog niemand beoordeeld heeft gaan weg. */
export function opTeRuimen(profiel, docId){
  return bevLijst(profiel).filter(b => b.docId === docId && b.oordeel === 'open' && !b.handmatig).map(b => b.id);
}
/* Nieuwe bevindingen van één aanroep: geschoond, en zonder wat er al staat (zelfde veld en zelfde uitkomst
   uit hetzelfde document), zodat opnieuw inlezen een beoordeeld antwoord niet verdubbelt. */
export function nieuweBevindingen(profiel, items, doc, nuMs, maakId){
  const bestaand = new Set(bevLijst(profiel).map(b => b.veld + '|' + b.docId + '|' + norm(b.waarde)));
  const uit = {};
  for (const ruw of Array.isArray(items) ? items : []){
    const b = schoonBevinding({ ...ruw, docId: doc.id, bron: doc.naam, oordeel: 'open', verwerkt: false, gezet: null, handmatig: false, gemaaktMs: nuMs });
    if (!b) continue;
    const sleutel = b.veld + '|' + b.docId + '|' + norm(b.waarde);
    if (bestaand.has(sleutel)) continue;
    bestaand.add(sleutel); uit[maakId()] = b;
  }
  return uit;
}

/* ---------- stand ---------- */
/* Stand van één veld: 'leeg' (nergens gevonden), 'open' (nog beoordelen), 'akkoord' (goedgekeurd maar nog niet in
   Cluppie: alleen bij oude bevindingen) of 'verwerkt' (staat in Cluppie).
   deels = alles wat meedoet beantwoordt de vraag maar half; meerdere = verschillende antwoorden die nog meedoen. */
export function veldStand(bevs){
  const mee = bevs.filter(b => b.oordeel !== 'afgewezen');
  const stand = !mee.length ? 'leeg' : mee.some(b => b.oordeel === 'open') ? 'open' : mee.every(b => b.verwerkt) ? 'verwerkt' : 'akkoord';
  return { stand, deels: mee.length > 0 && mee.every(b => b.status === 'deels'), meerdere: new Set(mee.map(b => norm(b.waarde))).size > 1, mee, afgewezen: bevs.length - mee.length };
}
export const isManco = veld => !veld.overig && (veld.stand.stand === 'leeg' || veld.stand.deels || veld.stand.meerdere);
export function overzicht(profiel){
  const perVeld = new Map();
  for (const b of bevLijst(profiel)){ if (!perVeld.has(b.veld)) perVeld.set(b.veld, []); perVeld.get(b.veld).push(b); }
  const tel = () => ({ velden: 0, leeg: 0, open: 0, akkoord: 0, verwerkt: 0, deels: 0, meerdere: 0, manco: 0 });
  const totaal = tel();
  const hoofdstukken = HOOFDSTUKKEN.map(h => {
    const t = tel();
    const velden = h.velden.map(v => ({ ...v, bevindingen: (perVeld.get(v.id) || []).sort((a, b) => a.gemaaktMs - b.gemaaktMs) }));
    const ov = perVeld.get(h.id + '.overig');
    if (ov && ov.length) velden.push({ ...veldOpId(h.id + '.overig'), bevindingen: ov.sort((a, b) => a.gemaaktMs - b.gemaaktMs) });
    for (const v of velden){
      v.stand = veldStand(v.bevindingen);
      if (v.overig && v.stand.stand === 'leeg') continue;
      t.velden++; t[v.stand.stand]++; if (v.stand.deels) t.deels++; if (v.stand.meerdere) t.meerdere++; if (isManco(v)) t.manco++;
    }
    for (const k of Object.keys(t)) totaal[k] += t[k];
    return { ...h, velden: velden.filter(v => !(v.overig && !v.bevindingen.length)), tel: t };
  });
  return { hoofdstukken, totaal, documenten: Object.keys((profiel && profiel.documenten) || {}).length };
}
export const FILTERS = [['alles', 'Alles'], ['open', 'Te beoordelen'], ['manco', 'Manco’s'], ['verwerkt', 'Staat in Cluppie']];
export function pastInFilter(veld, filter){
  const s = veld.stand.stand;
  return filter === 'alles' || (filter === 'open' && (s === 'open' || s === 'akkoord')) || (filter === 'verwerkt' && s === 'verwerkt') || (filter === 'manco' && isManco(veld));
}
/* De manco's: wat nergens staat, wat maar half staat en waar de documenten elkaar tegenspreken.
   Per veld één regel met de vraag die je de club stelt. */
export function mancos(profiel){
  const uit = [];
  for (const h of overzicht(profiel).hoofdstukken) for (const v of h.velden){
    if (!isManco(v)) continue;
    const s = v.stand, soort = s.stand === 'leeg' ? 'leeg' : s.meerdere ? 'meerdere' : 'deels';
    const ontbreekt = s.mee.map(b => b.ontbreekt).find(Boolean);
    uit.push({ hoofdstuk: h.id, hoofdstukNaam: h.naam, veld: v.id, label: v.label, soort,
      vraag: soort === 'leeg' ? v.vraag : soort === 'meerdere' ? 'In de documenten staan verschillende antwoorden. Welke klopt?' : (ontbreekt || v.vraag),
      antwoorden: soort === 'meerdere' ? [...new Set(s.mee.map(b => `${b.waarde}${b.bron ? ` (${b.bron})` : ''}`))] : [] });
  }
  return uit;
}

/* ---------- uitvoer ---------- */
/* De vragen voor het gesprek met de club: de manco's, per hoofdstuk. */
export function vragenTekst(profiel, clubNaam){
  const lijst = mancos(profiel), regels = [`Vragen voor ${clubNaam || 'de club'}`, ''];
  let n = 0, vorig = '';
  for (const m of lijst){
    if (m.hoofdstuk !== vorig){ if (vorig) regels.push(''); regels.push(m.hoofdstukNaam); vorig = m.hoofdstuk; }
    regels.push(`${++n}. ${m.soort === 'leeg' ? m.vraag : m.label + ': ' + m.vraag}`, ...m.antwoorden.map(a => `   - ${a}`));
  }
  if (!n) regels.push('Geen open vragen: alles staat in de documenten.');
  return regels.join('\n').trim() + '\n';
}
/* Het clubprofiel als leesbare tekst (Markdown). alleenAkkoord: alleen wat is goedgekeurd. */
export function profielTekst(profiel, clubNaam, alleenAkkoord = false){
  const o = overzicht(profiel), regels = [`# Clubprofiel ${clubNaam || ''}`.trim(), ''];
  for (const h of o.hoofdstukken){
    const r = [];
    for (const v of h.velden){
      const bevs = v.stand.mee.filter(b => !alleenAkkoord || b.oordeel === 'akkoord');
      if (!bevs.length){ if (!alleenAkkoord && !v.overig) r.push(`**${v.label}**: niet gevonden`, ''); continue; }
      r.push(`**${v.label}**`);
      for (const b of bevs) r.push(`- ${b.waarde.replace(/\n+/g, ' ')}${b.oordeel === 'open' ? ' (nog niet beoordeeld)' : ''}${b.status === 'deels' && b.ontbreekt ? ` (ontbreekt: ${b.ontbreekt})` : ''}${b.bron ? ` _[${b.bron}${b.pagina ? ', p. ' + b.pagina : ''}]_` : ''}`);
      r.push('');
    }
    if (r.length) regels.push(`## ${h.naam}`, '', ...r);
  }
  return regels.join('\n').trim() + '\n';
}

/* ---------- voorbeeld op de telefoon: waar een trainer een onderwerp ziet ----------
   [20261120g] Per onderwerp het scherm in de app (bekeken als trainer) en een zin uitleg voor de eindbaas.
   scherm: 'clubwijzer' (tabblad Documenten, Clubwijzer open op dit onderwerp) | 'hub' | 'spelers'.
   Instellingen die een trainer niet ziet (bouwnamen, rolnamen, formatie) worden eerlijk zo benoemd. */
const VB = {
  'id.naam': ['hub', 'De afkorting van de club staat bij de teamnamen en in de teamcode.'],
  'id.kleur': ['hub', 'De clubkleur kleurt de knoppen, kopjes en accenten in de hele app.'],
  'id.plannaam': ['hub', 'De naam van het beleidsplan gebruikt de clubbeheerder; een trainer ziet hem niet los.'],
  'eval.momenten': ['hub', 'Een lopende evaluatieronde staat bovenaan het team. In dit voorbeeld lopen alle rondes al; in het echt verschijnen ze op hun startdatum.'],
  'eval.vorm': ['spelers', 'De niveaus zie je bij het beoordelen van een speler. Tik op een speler en kies Beoordelen.'],
  'eval.criteria': ['spelers', 'De domeinen zie je in de beoordeling en de radar van een speler. Tik op een speler.'],
  'leer.domeinen': ['spelers', 'De domeinen zie je in de beoordeling en de radar van een speler. Tik op een speler.'],
  'rol.besluit': ['hub', 'Bij "Club stuurt" heeft een trainer geen tegel Training maken; bij "Trainers vrij" wel.'],
  'train.oefenstof': ['hub', 'Bij "Club stuurt" heeft een trainer geen tegel Training maken; bij "Trainers vrij" wel.'],
};
const NIET_ZICHTBAAR = {
  'rol.lijst': 'De rolnamen zien coördinatoren en de clubbeheerder in hun eigen schermen.', 'rol.hoofd': 'De naam van het hoofd jeugdopleiding staat in zijn eigen scherm.',
  'rol.coordinatoren': 'De naam van de coördinator zien coördinatoren en de clubbeheerder.', 'rol.team': 'De rolnaam van de coach staat op de computer onder de eigen naam.',
  'bouw.indeling': 'De namen van de bouwen zien coördinatoren en de clubbeheerder.', 'bouw.grenzen': 'De leeftijdsgrenzen bepalen welke teams bij welke coördinator horen.',
  'spel.formatie': 'De formatie staat bij de clubbeheerder in de instellingen.',
};
export function voorbeeldVoor(veld){
  const h = hoofdstukOpId(veld.hoofdstuk), vast = VB[veld.id];
  if (vast) return { scherm: vast[0], uitleg: vast[1], clubwijzer: veld.tekst !== false };
  if (veld.tekst !== false) return { scherm: 'clubwijzer', clubwijzer: true,
    uitleg: (veld.regels ? 'De gouden regels staan bovenaan de Clubwijzer, de tekst bij het onderwerp. ' : `De tekst staat in de Clubwijzer, onder ${h ? h.naam : 'het hoofdstuk'}. `)
      + 'Trainers openen de Clubwijzer op het tabblad Documenten.' + (NIET_ZICHTBAAR[veld.id] ? ' ' + NIET_ZICHTBAAR[veld.id] : '') };
  return { scherm: 'hub', clubwijzer: false, uitleg: NIET_ZICHTBAAR[veld.id] || 'Dit onderwerp ziet een trainer niet los in de app.' };
}
/* De hele inrichting zoals hij zou worden als je alles goedkeurt: per onderwerp het antwoord dat in Cluppie staat,
   of anders het eerste antwoord dat nog open is, met het concept van het scherm (of het voorstel).
   conceptVan(veld, bevinding) geeft { titel, tekst, regels, rondes, inst } (zie platform-clubprofiel.js). Puur. */
/* [20261120h] Waar komt een tekst in de telefoon vandaan? Alle teksten die het voorbeeld uit het Clubprofiel haalt,
   elk met zijn herkomst: { soort: 'tekst'|'titel'|'regel'|'ronde'|'instelling'|'club', tekst, veld, bevId, i?, pad?, label? }.
   conceptVan(veld, bevinding) zoals bij voorbeeldInrichting. Puur. */
export function bronnenVoorbeeld(profiel, conceptVan, clubNaam){
  const uit = [];
  if (clubNaam) uit.push({ soort: 'club', tekst: String(clubNaam), veld: null, bevId: null, label: 'Clubnaam' });
  for (const h of overzicht(profiel).hoofdstukken) for (const v of h.velden) for (const b of actieveBevindingen(v)){
    const c = conceptVan(v, b);
    if (!c) continue;
    const bron = (soort, tekst, extra = {}) => { if (String(tekst || '').trim()) uit.push({ soort, tekst: String(tekst), veld: v.id, bevId: b.id, ...extra }); };
    bron('tekst', c.tekst);
    if (v.overig) bron('titel', c.titel);
    regelsUit(c.regels).forEach((r, i) => bron('regel', r, { i }));
    (c.rondes || []).forEach((r, i) => bron('ronde', r.naam, { i }));
    for (const d of (instelVelden(v.id) || [])) if (d.type === 'tekst') bron('instelling', c.inst ? c.inst[d.pad] : '', { pad: d.pad, label: d.label });
  }
  return uit;
}
/* De bron bij een aangetikte tekst: eerst een exacte overeenkomst, dan de langste bron die in de tekst staat
   (een knop "Winterevaluatie" in "Winterevaluatie t/m 31 dec"), dan een tekst van minstens vier woorden die in een bron staat (een stuk
   van een lange tekst). Korte bronnen (minder dan 3 tekens) tellen alleen exact. */
export function zoekBron(bronnen, tekst){
  const t = norm(tekst);
  if (!t) return null;
  /* [20261120i] een titel ("Speelwijze") is vaak ook een kop van de app: die herkennen we alleen in de Clubwijzer zelf */
  const lijst = (bronnen || []).filter(b => b.soort !== 'titel').map(b => ({ b, n: norm(b.tekst) })).filter(x => x.n);
  const exact = lijst.find(x => x.n === t);
  if (exact) return exact.b;
  const erin = lijst.filter(x => x.n.length >= 3 && t.includes(x.n)).sort((a, b) => b.n.length - a.n.length)[0];
  if (erin) return erin.b;
  const deel = t.length >= 12 && t.split(' ').length >= 4 ? lijst.filter(x => x.n.includes(t)).sort((a, b) => a.n.length - b.n.length)[0] : null;
  return deel ? deel.b : null;
}
/* Een aangepaste tekst in het concept van een onderwerp zetten (zelfde vorm als het formulier van het scherm). */
export function zetInConcept(c, bron, waarde){
  if (!c || !bron) return false;
  const w = String(waarde ?? '');
  if (bron.soort === 'tekst') c.tekst = w;
  else if (bron.soort === 'titel') c.titel = w;
  else if (bron.soort === 'regel'){ const r = regelsUit(c.regels); if (bron.i >= r.length) return false; r[bron.i] = w.replace(/\s+/g, ' ').trim(); c.regels = r.filter(Boolean).join('\n'); }
  else if (bron.soort === 'ronde'){ if (!c.rondes || !c.rondes[bron.i]) return false; c.rondes[bron.i].naam = w.replace(/\s+/g, ' ').trim(); }
  else if (bron.soort === 'instelling'){ if (!c.inst) c.inst = {}; c.inst[bron.pad] = w.replace(/\s+/g, ' ').trim(); }
  else return false;
  return true;
}
/* Welke antwoorden van een onderwerp in het voorbeeld staan: wat in Cluppie staat gaat voor, anders het eerste dat
   meedoet. Bij "overig" allemaal (elk is een eigen tekst). */
export const actieveBevindingen = v => v.overig ? v.stand.mee : [v.stand.mee.find(b => b.gezet) || v.stand.mee.find(b => b.oordeel !== 'afgewezen')].filter(Boolean);
export function voorbeeldInrichting(profiel, instellingen, conceptVan){
  const inst = JSON.parse(JSON.stringify(instellingen || {})), content = [], rondes = [];
  const zet = (pad, w) => { const k = pad.split('.'); let o = inst; for (const d of k.slice(0, -1)) o = (o[d] && typeof o[d] === 'object') ? o[d] : (o[d] = {}); o[k.at(-1)] = w; };
  for (const h of overzicht(profiel).hoofdstukken) for (const v of h.velden){
    for (const b of actieveBevindingen(v)){
      const c = conceptVan(v, b);
      if (!c) continue;
      for (const d of (instelVelden(v.id) || [])){ const r = controleerInstelling(d, c.inst ? c.inst[d.pad] : undefined); if (r.ok && c.inst && c.inst[d.pad] !== undefined) zet(d.pad, r.waarde); }
      content.push(...contentDocs({ veldId: v.id, bevId: b.id, titel: c.titel, tekst: c.tekst, regels: c.regels, status: 'gepubliceerd' }));
      if (v.rondes) rondes.push(...schoonRondes(c.rondes));
    }
  }
  if (!inst.v) inst.v = 1;
  return { instellingen: inst, content, rondes };
}

/* ---------- het overzicht voor de club: zo is Cluppie ingericht ----------
   [20261120f] Alles wat in Cluppie is gezet, per hoofdstuk en per onderwerp, met de plek waar het staat.
   Basis voor de PDF die de eindbaas met de club deelt (clubprofiel-pdf.js). Puur: alleen wat in "gezet" staat. */
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export function datumVoluit(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m && MAANDEN[Number(m[2]) - 1] ? `${Number(m[3])} ${MAANDEN[Number(m[2]) - 1]} ${m[1]}` : String(iso || '');
}
const isoVan = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const instelLeesbaar = (d, w) => d.type === 'keuze' ? ((d.opties.find(([id]) => id === String(w)) || [])[1] || String(w)).split(':')[0] : (w === '' || w == null ? 'niets ingesteld' : String(w));
export function inrichtingOverzicht(profiel, club, nuMs = Date.now()){
  const o = overzicht(profiel), hoofdstukken = [];
  let aantal = 0, concept = false;
  for (const h of o.hoofdstukken){
    const onderwerpen = [];
    for (const v of h.velden) for (const b of v.bevindingen){
      const g = b.oordeel !== 'afgewezen' && b.gezet;
      if (!g) continue;
      const regels = [], ookConcept = g.status !== 'gepubliceerd';
      for (const d of (instelVelden(v.id) || [])){
        const w = (g.instellingen || {})[d.pad];
        if (w !== undefined && w !== null) regels.push({ soort: 'instelling', plek: 'Instelling', label: d.label, waarde: instelLeesbaar(d, w) });
      }
      for (const r of (g.rondes || [])) regels.push({ soort: 'ronde', plek: 'Evaluatieronde', label: r.naam,
        waarde: `${r.soort === 'snel' ? 'Snelle' : 'Volledige'} beoordeling, ${r.van ? datumVoluit(r.van) + ' tot en met ' : 'tot en met '}${datumVoluit(r.tot)}` });
      if (g.tekst){ regels.push({ soort: 'tekst', plek: 'Clubwijzer', label: '', waarde: g.tekst, concept: ookConcept }); concept = concept || ookConcept; }
      if ((g.regels || []).length){ regels.push({ soort: 'regels', plek: 'Gouden regels', label: '', waarde: g.regels.map(r => '- ' + r).join('\n'), concept: ookConcept }); concept = concept || ookConcept; }
      if (!regels.length) continue;
      onderwerpen.push({ veld: v.id, label: v.overig ? (g.titel || titelVan(v, b.waarde)) : v.label, regels }); aantal++;
    }
    if (onderwerpen.length) hoofdstukken.push({ id: h.id, naam: h.naam, onderwerpen });
  }
  const kleur = String((((club && club.instellingen) || {}).identiteit || {}).kleur || '');
  return { clubNaam: (club && club.naam) || 'de club', datum: datumVoluit(isoVan(nuMs)), hoofdstukken, aantal, totaal: alleVelden().length, heeftConcept: concept,
    kleur: /^#[0-9a-fA-F]{6}$/.test(kleur) ? kleur.toLowerCase() : '#e2342f',
    open: mancos(profiel).map(m => ({ hoofdstuk: m.hoofdstukNaam, label: m.label, vraag: m.vraag })) };
}

/* ---------- naar Cluppie: de teksten als clubcontent ----------
   Eén Clubwijzer-tekst per veld (vaste id, dus opnieuw zetten vervangt), en de gouden regels van een veld
   als losse items. status: 'concept' (de clubbeheerder publiceert) of 'gepubliceerd' (trainers zien het meteen). */
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
/* De titel in de Clubwijzer: het onderwerp van het veld; bij "overig" het begin van het antwoord. */
export function titelVan(veld, waarde){
  if (!veld.overig) return veld.label;
  const t = kort(waarde, 200), i = t.indexOf(':');
  return (i > 2 && i < 70 ? t.slice(0, i) : t.slice(0, 60)).trim() || 'Overig';
}
export function contentDocs({ veldId, bevId, titel, tekst, regels, status }){
  const veld = veldOpId(veldId), h = veld && hoofdstukOpId(veld.hoofdstuk);
  if (!veld || !h) return [];
  const st = status === 'gepubliceerd' ? 'gepubliceerd' : 'concept';
  const hi = HOOFDSTUKKEN.indexOf(h), vi = veld.overig ? 90 : h.velden.findIndex(v => v.id === veld.id);
  const uit = [], t = veld.tekst === false ? '' : alinea(tekst, 1500);
  if (t) uit.push({ id: veld.overig ? `afspraak-${h.id}-overig-${slug(bevId)}` : `afspraak-${slug(veld.id)}`, data: {
    categorie: 'afspraak', hoofdstuk: h.id, hoofdstukNaam: h.naam, veld: veld.id, bevinding: String(bevId || ''), titel: kort(titel, 80) || veld.label, achtergrond: t, tips: [], tags: [],
    volgorde: (hi + 1) * 100 + vi, status: st, bron: 'clubprofiel' } });
  if (veld.regels) regelsUit(regels).forEach((regel, i) => uit.push({ id: `gouden-regel-cp-${slug(veld.id)}-${i + 1}`, data: {
    categorie: 'gouden-regel', veld: veld.id, titel: regel, achtergrond: '', tips: [], tags: [], volgorde: (hi + 1) * 100 + vi * 10 + i, status: st, bron: 'clubprofiel' } }));
  return uit;
}
