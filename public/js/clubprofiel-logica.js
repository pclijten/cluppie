/* ==================== CLUBPROFIEL — logica (zonder DOM en zonder Firestore) ====================
   De eindbaas leest de documenten van een club in (beleidsplan, jeugdplan, reglement …). De AI zet
   wat erin staat in een VASTE set hoofdstukken; de inhoud verschilt per club. Elk hoofdstuk heeft
   velden: een onderwerp, de vraag die je de club stelt als het nergens staat, en waar het in
   Cluppie landt. Scherm: platform-clubprofiel.js. Functie: functions/clubprofiel.js.

   Datamodel (clubprofielen/{clubId}, alleen de platformbeheerder leest en schrijft):
     v: 1, clubId, bijgewerkt,
     documenten:  { <docId>: { naam, tekens, paginas, stukken, toegevoegdMs, geanalyseerdMs, gevonden } }
     bevindingen: { <id>: { veld, waarde, citaat, pagina, zeker, citaatOk, docId, bron,
                            oordeel: 'open'|'akkoord'|'afgewezen', verwerkt, handmatig, gemaaktMs } }
   De tekst van een document wordt NIET bewaard: alleen de bevinding met een kort citaat.

   Zonder imports: scherm en tests gebruiken deze module los van elkaar. */

export const VERSIE = 1;
export const MAX_STUK = 24000;          // tekens per aanroep van de AI
export const MAX_DOCUMENT = 600000;     // tekens per document (ongeveer 250 pagina's)

/* [veld-id, onderwerp, vraag aan de club als het nergens staat, waar het in Cluppie landt] */
const H = (id, naam, uitleg, velden) => ({ id, naam, uitleg, velden: velden.map(([vid, label, vraag, doel]) => ({ id: vid, hoofdstuk: id, label, vraag, doel })) });
export const HOOFDSTUKKEN = [
  H('identiteit', 'Identiteit en taal', 'Wie de club is en welke woorden ze zelf gebruikt.', [
    ['id.naam', 'Clubnaam en afkorting', 'Hoe heet de club voluit en welke afkorting gebruiken jullie?', 'Clubinstellingen › Identiteit'],
    ['id.kleur', 'Clubkleuren', 'Wat zijn de clubkleuren?', 'Clubinstellingen › Identiteit › kleur'],
    ['id.plannaam', 'Naam van het beleidsplan', 'Hoe noemen jullie het plan voor de jeugd (jeugdbeleidsplan, opleidingsplan …)?', 'Clubinstellingen › Identiteit › naam beleidsplan'],
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
    ['eval.momenten', 'Momenten in het jaar', 'Hoe vaak per seizoen worden spelers beoordeeld, en wanneer?', 'Club › Evaluatierondes'],
    ['eval.vorm', 'Formulier en schaal', 'Met welk formulier of welke schaal wordt beoordeeld?', 'Clubinstellingen › niveaus en domeinen'],
    ['eval.gesprekken', 'Gesprekken', 'Zijn er gesprekken met de speler of de ouders over de beoordeling?', 'Wens: gespreksverslag'],
    ['eval.team', 'Teamevaluatie', 'Wordt het team als geheel geëvalueerd, en waarop?', 'Clubinstellingen › Lijsten › Teamevaluatie'],
    ['eval.inzage', 'Wie de beoordeling ziet', 'Wie mag een beoordeling lezen (trainer, coördinator, ouders, speler)?', 'Rechten en privé-beoordelingen'],
    ['eval.trainers', 'Evaluatie van trainers', 'Worden trainers zelf ook geëvalueerd of begeleid?', 'Wens: trainersevaluatie'],
  ]),
  H('gedrag', 'Gedrag en normen', 'De afspraken waar iedereen zich aan houdt.', [
    ['gedrag.regels', 'Gedragsregels', 'Welke gedragsregels gelden voor spelers en trainers?', 'Content › Gouden regels'],
    ['gedrag.afmelden', 'Afmelden en aanwezigheid', 'Hoe meld je je af en wat is de afspraak over aanwezigheid?', 'Clubinstellingen › Lijsten › Afwezigheidsredenen'],
    ['gedrag.ouders', 'Ouders langs de lijn', 'Wat verwachten jullie van ouders tijdens wedstrijd en training?', 'Content › Gouden regels'],
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
  return h ? { id: h.id + '.overig', hoofdstuk: h.id, label: 'Overig', vraag: '', doel: 'Nog niet in Cluppie: bekijk of dit een wens is', overig: true } : null;
}
/* Wat de functie nodig heeft: per hoofdstuk de velden met hun onderwerp. */
export function veldenVoorAI(){
  return HOOFDSTUKKEN.map(h => ({ id: h.id, naam: h.naam, velden: h.velden.map(v => ({ id: v.id, label: v.label, vraag: v.vraag })) }));
}

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

/* ---------- tekst ---------- */
export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* Vaste id van een document: zelfde naam en lengte = hetzelfde document (opnieuw inlezen vervangt). */
export function documentId(naam, tekens){
  let h = 0; const s = norm(naam) + '|' + tekens;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 'd' + h.toString(36);
}
/* Een document in stukken van ten hoogste `max` tekens, bij voorkeur op een paginagrens ([pagina N])
   en anders op een lege regel. Elk stuk begint met de paginamarkering die erbij hoort. */
export function splitsDocument(tekst, max = MAX_STUK){
  const delen = String(tekst || '').split(/(?=\[pagina \d+\]\n)/).flatMap(p => {
    if (p.length <= max) return [p];
    const kop = (/^\[pagina \d+\]\n/.exec(p) || [''])[0];
    const uit = []; let huidig = '';
    for (const al of p.slice(kop.length).split(/\n\s*\n/)){
      if (huidig && (huidig + '\n\n' + al).length > max - kop.length){ uit.push(kop + huidig); huidig = ''; }
      huidig = huidig ? huidig + '\n\n' + al : al;
      while (huidig.length > max - kop.length){ uit.push(kop + huidig.slice(0, max - kop.length)); huidig = huidig.slice(max - kop.length); }
    }
    if (huidig.trim()) uit.push(kop + huidig);
    return uit;
  });
  const stukken = []; let huidig = '';
  for (const d of delen){
    if (huidig && (huidig.length + d.length) > max){ stukken.push(huidig); huidig = ''; }
    huidig += d;
  }
  if (huidig.trim()) stukken.push(huidig);
  return stukken;
}
/* Een stuk dat te veel opleverde in tweeën, op een regelgrens rond het midden. */
export function halveer(stuk){
  const midden = Math.floor(stuk.length / 2);
  let knip = stuk.indexOf('\n', midden);
  if (knip < 0 || knip > stuk.length - 200) knip = midden;
  const kop = [...stuk.slice(0, knip).matchAll(/\[pagina \d+\]\n/g)].pop();
  return [stuk.slice(0, knip), (kop && !/^\s*\[pagina \d+\]/.test(stuk.slice(knip)) ? kop[0] : '') + stuk.slice(knip).replace(/^\n+/, '')].filter(s => s.trim());
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
export function schoonBevinding(b){
  const veld = veldOpId(b && b.veld);
  const waarde = kort(b && b.waarde, 600);
  if (!veld || !waarde) return null;
  const pagina = Math.round(Number(b.pagina));
  return {
    veld: veld.id, waarde, citaat: kort(b.citaat, 400), pagina: pagina > 0 && pagina < 5000 ? pagina : null,
    zeker: ['hoog', 'middel', 'laag'].includes(b.zeker) ? b.zeker : 'middel', citaatOk: b.citaatOk !== false,
    docId: kort(b.docId, 40), bron: kort(b.bron, 120),
    oordeel: ['open', 'akkoord', 'afgewezen'].includes(b.oordeel) ? b.oordeel : 'open',
    verwerkt: b.verwerkt === true, handmatig: b.handmatig === true, gemaaktMs: Number(b.gemaaktMs) || 0,
  };
}
export const bevLijst = profiel => Object.entries((profiel && profiel.bevindingen) || {}).map(([id, b]) => ({ id, ...b })).filter(b => b.veld && b.waarde);
/* Opnieuw inlezen: de bevindingen van dit document die nog niemand beoordeeld heeft gaan weg. */
export function opTeRuimen(profiel, docId){
  return bevLijst(profiel).filter(b => b.docId === docId && b.oordeel === 'open' && !b.handmatig).map(b => b.id);
}
/* Nieuwe bevindingen van één stuk: geschoond, en zonder wat er al staat (zelfde veld en zelfde uitkomst
   uit hetzelfde document), zodat opnieuw inlezen een beoordeeld antwoord niet verdubbelt. */
export function nieuweBevindingen(profiel, items, doc, nuMs, maakId){
  const bestaand = new Set(bevLijst(profiel).map(b => b.veld + '|' + b.docId + '|' + norm(b.waarde)));
  const uit = {};
  for (const ruw of Array.isArray(items) ? items : []){
    const b = schoonBevinding({ ...ruw, docId: doc.id, bron: doc.naam, oordeel: 'open', verwerkt: false, handmatig: false, gemaaktMs: nuMs });
    if (!b) continue;
    const sleutel = b.veld + '|' + b.docId + '|' + norm(b.waarde);
    if (bestaand.has(sleutel)) continue;
    bestaand.add(sleutel); uit[maakId()] = b;
  }
  return uit;
}

/* ---------- stand ---------- */
/* Stand van één veld: 'leeg' (vraag voor de club), 'open' (nog beoordelen), 'akkoord' (klopt, nog in
   Cluppie zetten) of 'verwerkt'. meerdere = twee verschillende uitkomsten die allebei nog meedoen. */
export function veldStand(bevs){
  const mee = bevs.filter(b => b.oordeel !== 'afgewezen');
  const stand = !mee.length ? 'leeg' : mee.some(b => b.oordeel === 'open') ? 'open' : mee.every(b => b.verwerkt) ? 'verwerkt' : 'akkoord';
  return { stand, meerdere: new Set(mee.map(b => norm(b.waarde))).size > 1, mee, afgewezen: bevs.length - mee.length };
}
export function overzicht(profiel){
  const perVeld = new Map();
  for (const b of bevLijst(profiel)){ if (!perVeld.has(b.veld)) perVeld.set(b.veld, []); perVeld.get(b.veld).push(b); }
  const tel = () => ({ velden: 0, leeg: 0, open: 0, akkoord: 0, verwerkt: 0, meerdere: 0 });
  const totaal = tel();
  const hoofdstukken = HOOFDSTUKKEN.map(h => {
    const t = tel();
    const velden = h.velden.map(v => ({ ...v, bevindingen: (perVeld.get(v.id) || []).sort((a, b) => a.gemaaktMs - b.gemaaktMs) }));
    const ov = perVeld.get(h.id + '.overig');
    if (ov && ov.length) velden.push({ ...veldOpId(h.id + '.overig'), bevindingen: ov });
    for (const v of velden){
      v.stand = veldStand(v.bevindingen);
      if (v.overig && v.stand.stand === 'leeg') continue;
      t.velden++; t[v.stand.stand]++; if (v.stand.meerdere) t.meerdere++;
    }
    for (const k of Object.keys(t)) totaal[k] += t[k];
    return { ...h, velden: velden.filter(v => !(v.overig && !v.bevindingen.length)), tel: t };
  });
  return { hoofdstukken, totaal, documenten: Object.keys((profiel && profiel.documenten) || {}).length };
}
export const FILTERS = [['alles', 'Alles'], ['open', 'Te beoordelen'], ['leeg', 'Niet gevonden'], ['akkoord', 'Akkoord, nog verwerken'], ['verwerkt', 'Verwerkt']];
export const pastInFilter = (veld, filter) => filter === 'alles' || veld.stand.stand === filter;

/* ---------- uitvoer ---------- */
/* De vragen voor het gesprek met de club: wat nergens staat, en waar de documenten elkaar tegenspreken. */
export function vragenTekst(profiel, clubNaam){
  const o = overzicht(profiel), regels = [`Vragen voor ${clubNaam || 'de club'}`, ''];
  let n = 0;
  for (const h of o.hoofdstukken){
    const r = [];
    for (const v of h.velden){
      if (v.overig) continue;
      if (v.stand.stand === 'leeg'){ r.push(`${++n}. ${v.vraag}`); continue; }
      if (v.stand.meerdere) r.push(`${++n}. ${v.label}: in de documenten staan verschillende antwoorden. Welke klopt?\n` + [...new Set(v.stand.mee.map(b => `   - ${b.waarde}${b.bron ? ` (${b.bron})` : ''}`))].join('\n'));
    }
    if (r.length) regels.push(h.naam, ...r, '');
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
      for (const b of bevs) r.push(`- ${b.waarde}${b.oordeel === 'open' ? ' (nog niet beoordeeld)' : ''}${b.bron ? ` _[${b.bron}${b.pagina ? ', p. ' + b.pagina : ''}]_` : ''}`);
      r.push('');
    }
    if (r.length) regels.push(`## ${h.naam}`, '', ...r);
  }
  return regels.join('\n').trim() + '\n';
}
/* Wat nog in Cluppie gezet moet worden: goedgekeurd en nog niet verwerkt, per plek in de app. */
export function werklijstTekst(profiel, clubNaam){
  const o = overzicht(profiel), regels = [`Te verwerken in Cluppie voor ${clubNaam || 'de club'}`, ''];
  let n = 0;
  for (const h of o.hoofdstukken) for (const v of h.velden){
    const bevs = v.stand.mee.filter(b => b.oordeel === 'akkoord' && !b.verwerkt);
    if (!bevs.length) continue;
    regels.push(`${v.doel}: ${v.label}`, ...bevs.map(b => `   - ${b.waarde}`), ''); n += bevs.length;
  }
  if (!n) regels.push('Niets: alles wat is goedgekeurd is verwerkt.');
  return regels.join('\n').trim() + '\n';
}
