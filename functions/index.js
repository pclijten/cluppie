/* ==================== CLUPPIE.IO — CLOUD FUNCTIONS ====================
   Multi-tenant versie. Regio: europe-west1 (AVG: data blijft in de EU).
   Alles is 2nd gen (firebase-functions v2-API).

   Functies:
     Club & leden
       (clubs aanmaken en leden uitnodigen gebeurt in de client — uitnodigings-
       link/teamcode — en wordt door de Firestore-rules afgedwongen; de oude
       callables createClub/addClubMember hoorden bij een ander datamodel en
       zijn vervallen)
     AI (Claude Haiku; alleen voor leden van de club, feature 'ai' aan)
       • chatHulp            – hulp-chatbot over het gebruik van de app
       • genereerVerslagAI   – wedstrijdverslag uit GEANONIMISEERDE data
       • structureerTraining – layout van oefenstof-PDF's
       • samenvatHotspot     – samenvatting coach-opmerkingen (admin/coördinator)
     Sportlink (Club.Dataservice)
       • sportlinkSyncNu     – handmatige sync of alleen de teamlijst (club-admin)
       • syncSportlink       – nachtelijke sync, alle clubs (03:30 NL)
       • checkAfgelastingen  – weekend: elke 30 min afgelaste wedstrijden markeren (vr 16–22, za/zo 7–14)
       • sportlinkClubInfo   – club opzoeken met een Client ID (aanmelden, wizard, koppeling testen)
       • sportlinkTeamSpelers – namen van zichtbare spelers uit de teamindeling (op verzoek van de coach)
     Spelers
       • zetSpelerOver       – definitief overzetten en seizoensovergang, alles-of-niets
     Gebruik
       • aggregeerGebruik    – Inzicht-cijfers van één club (admin/coördinator)
       • aggregeerGebruikNacht – idem voor alle clubs (04:15 NL)
     Onderhoud
       • cleanupDeletedItems – maandelijks opruimen (nog TODO)

   DATAMODEL: dat van de app (zie PADEN hieronder):
     clubs/{id}: naam, admins{uid:true}, leden{uid:true}, bouwCoordinatoren,
                 sportlinkClientId, instellingen{ai{aan,maandLimiet}, …}
     teams/{id}: club, naam, leden{uid:true}, sportlinkNaam?, sportlinkTeamcode?
     [20261008] Eerder stond hier een ander model (clubs/{id}/teams,
     memberRoles); de functies zijn daarop aangepast zodat client, functions
     en rules één model delen.

   CONTRACT MET DE CLIENT (let op):
     Alle callables verwachten `clubId` in de data. Daarmee checkt de server of
     de aanroeper lid (of admin) is van díe club. Region bij de client:
     getFunctions(app, 'europe-west1'). De client roept de handmatige sync aan
     als 'sportlinkSyncNu' (niet 'syncNu').

   Secret (in het cluppie.io-Firebase-project):
     firebase functions:secrets:set ANTHROPIC_API_KEY

   Herkomst: AI-functies overgenomen uit de eerste versie (28-09-2026), met
   lidmaatschapscheck. Sportlink-sync herschreven voor multi-tenant: matcht op
   Sportlink-TEAMCODE (thuisteamid/uitteamid), niet op clubnaam — zie
   porteren/2026-09-28-sportlink-koppeling-per-team.md.
   ====================================================================== */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { KENNIS_TEKST } = require('./kennis');
const avg = require('./avg');
const toegang = require('./toegang');
const { scrubPII, namenVoorScrub } = avg;
const slh = require('./sportlink-hulp');
Object.assign(exports, { uitnodigingInfo: toegang.uitnodigingInfo, sluitAan: toegang.sluitAan, maakUitnodiging: toegang.maakUitnodiging,
  trekUitnodigingIn: toegang.trekUitnodigingIn, beoordeelAanvraag: toegang.beoordeelAanvraag, wijzigRol: toegang.wijzigRol,
  verwijderLid: toegang.verwijderLid, bevestigPrivacy: toegang.bevestigPrivacy, privacyOverzicht: toegang.privacyOverzicht, codeBezet: avg.codeBezet,
  exporteerMijnGegevens: avg.exporteerMijnGegevens, verwijderMijnAccount: avg.verwijderMijnAccount, bewaartermijnen: avg.bewaartermijnen });

if (!admin.apps.length) admin.initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const REGIO = 'europe-west1';

/* ==================== DATAMODEL-PADEN ====================
   Eén plek om aan te passen als het datamodel verandert. */
const PADEN = {
  club:        (c)    => `clubs/${c}`,
  teamsCol:    ()     => 'teams',                              // top-level; filter: where('club','==',clubId)
  wedstrijden: (t)    => `teams/${t}/wedstrijden`,
  poule:       (t)    => `teams/${t}/poule`,                   // docs: stand · uitslagen · programma
  teamlijst:   (c)    => `clubs/${c}/geheim/_sportlink`,       // { teams[], voorvoegsel, updatedAt }
  teamStatus:  (c, t) => `clubs/${c}/geheim/${t}`,             // { gematcht, laatsteSync, laatsteAantal, laatsteFout, … }
  aiGebruik:   (c, m) => `clubs/${c}/aiGebruik/${m}`,          // { aantal } per maand (YYYY-MM)
  afgelast:    (c)    => `clubs/${c}/geheim/_afgelast`,        // [20261012a] { rijen[] } afgelaste wedstrijden, voor het clubscherm
  accommodatie:(k)    => `accommodaties/${k}`,                 // [20261012a] gedeelde adres-cache (alleen functions)
  clubgids:    'clubgids',                                     // [20261012h] gedeelde gids van clubs (lezen: ingelogd)
};

const ADMIN_ROLLEN = ['club_admin'];
const BEHEER_ROLLEN = ['club_admin', 'coordinator'];

/* ==================== TOEGANG ====================
   Rol van een gebruiker binnen een club, afgeleid uit het clubdocument:
     admins[uid]                       → club_admin
     bouwCoordinatoren.<bouw>[uid]     → coordinator
     leden[uid] of coach van een team  → coach
   (Een coach kan via een teamcode zijn aangesloten zonder clubs.leden: dan
   telt zijn lidmaatschap van een team van deze club.) */
async function clubRol(db, clubId, uid){
  if (!clubId || !uid) return null;
  const clubSnap = await db.doc(PADEN.club(clubId)).get();
  if (!clubSnap.exists) return null;
  const c = clubSnap.data() || {};
  if (c.admins?.[uid]) return 'club_admin';
  if (Object.values(c.bouwCoordinatoren || {}).some(m => m && m[uid])) return 'coordinator';
  if (c.leden?.[uid]) return 'coach';
  const t = await db.collection(PADEN.teamsCol())
    .where('club', '==', clubId).where(`leden.${uid}`, '==', true).limit(1).get();
  return t.empty ? null : 'coach';
}

/* Gooit tenzij de aanroeper ingelogd is én (minstens) lid van de club.
   `rollen` beperkt optioneel tot bepaalde rollen. Geeft { clubId, rol } terug. */
async function vereisLid(request, rollen = null){
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const clubId = String(request.data?.clubId || '').trim();
  if (!clubId) throw new HttpsError('invalid-argument', 'clubId ontbreekt.');
  const rol = await clubRol(getFirestore(), clubId, request.auth.uid);
  if (!rol) throw new HttpsError('permission-denied', 'Je bent geen lid van deze club.');
  if (rollen && !rollen.includes(rol)) throw new HttpsError('permission-denied', 'Daar heb je geen rechten voor.');
  return { clubId, rol };
}

/* AI-instellingen van de club: clubs/{id}.instellingen.ai = { aan, maandLimiet }.
   Ontbreekt het (bestaande club zonder instellingen) → AI aan, geen limiet. */
async function vereisAI(request, rollen = null, onderdeel = null){
  const r = await vereisLid(request, rollen);
  const db = getFirestore();
  const club = (await db.doc(PADEN.club(r.clubId)).get()).data() || {};
  /* [20261013b] eindbaas heeft dit onderdeel voor de club uitgezet: weigeren vóórdat er AI-gebruik geteld wordt */
  if (onderdeel && !require('./onderdelen').platformToegestaan(club, onderdeel)) throw new HttpsError('failed-precondition', 'Dit onderdeel staat niet aan voor deze club.');
  const ai = club.instellingen?.ai || {};
  if (ai.aan === false) throw new HttpsError('failed-precondition', 'AI staat uit voor deze club.');
  const limiet = Number(ai.maandLimiet);
  if (Number.isFinite(limiet) && limiet >= 0 && ai.maandLimiet !== null && ai.maandLimiet !== ''){
    const maand = new Date().toISOString().slice(0, 7);
    const ref = db.doc(PADEN.aiGebruik(r.clubId, maand));
    await db.runTransaction(async tx => {
      const aantal = (await tx.get(ref)).data()?.aantal || 0;
      if (aantal >= limiet) throw new HttpsError('resource-exhausted', 'De maandlimiet voor AI-aanroepen van deze club is bereikt.');
      tx.set(ref, { aantal: aantal + 1, bijgewerkt: FieldValue.serverTimestamp() }, { merge: true });
    });
  }
  return r;
}

/* ==================== 1b. GEBRUIKSSTATISTIEKEN ==================== */
const gebruik = require('./gebruik');
exports.aggregeerGebruik = gebruik.maakCallable(vereisLid);
exports.aggregeerGebruikNacht = gebruik.aggregeerGebruikNacht;
exports.platformOverzichtNu = require('./platform').platformOverzichtNu;
const aanmelding = require('./aanmelding');
/* [20261012a] na goedkeuren meteen de Sportlink-teamlijst ophalen, zodat "Teams uit Sportlink" klaarstaat */
aanmelding.zetNaGoedkeuring(clubId => syncClubSportlink(clubId, { alleenTeamlijst: true }));
exports.meldClubAan = aanmelding.meldClubAan;
exports.beoordeelClubAanmelding = aanmelding.beoordeelClubAanmelding;
exports.meldNieuweAanvraag = aanmelding.meldNieuweAanvraag;
/* [20261011h] speler overzetten / seizoensovergang in één transactie (functions/overdracht.js) */
exports.zetSpelerOver = require('./overdracht').zetSpelerOver;

/* ==================== 2. AI-FUNCTIES ==================== */

/* Geldige rondleiding-hoofdstukken waar de chatbot naar mag verwijzen.
   Moet gelijk lopen met de hfd-waarden in onboarding.js. */
const TOUR_HOOFDSTUKKEN = [
  'team', 'wedstrijden', 'opstelling', 'spelers', 'training',
  'video', 'planning', 'documenten', 'stats', 'instellingen', 'meer',
];

/* Kleine helper: roept de Anthropic-API aan en geeft de platte tekst terug.
   `system` mag een array van blokken zijn (voor cache_control). */
async function claude({ apiKey, system, messages, maxTokens = 700, temperature = 0.4, metaTerug = false }){
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature, system, messages }),
  });

  if (!res.ok){
    const tekst = await res.text().catch(() => '');
    console.error('[claude] API-fout', res.status, tekst.slice(0, 500));
    throw new HttpsError('unavailable', 'Het taalmodel is even niet bereikbaar.');
  }
  const data = await res.json();
  const tekst = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
  return metaTerug ? { tekst, stopReason: data.stop_reason } : tekst;
}

/* ---------- 2a. HULP-CHATBOT ==================== */

const HULP_SYSTEEM = `Je bent "Cluppie-hulp", de vriendelijke ingebouwde assistent van Cluppie —
een web-app waarmee jeugdvoetbalcoaches de opstelling maken, wissels en speeltijd bijhouden,
de wedstrijd loggen, spelers beoordelen en trainingen delen.

Je BEANTWOORDT ALLEEN vragen over het GEBRUIK van de app. Gebruik uitsluitend de
onderstaande kennisbank. Verzin geen knoppen, schermen of functies die er niet in staan.
Weet je iets niet zeker op basis van de kennisbank, zeg dat dan eerlijk en verwijs naar
"Meer → Handleiding".

Stijl:
- Schrijf in het Nederlands, warm en to-the-point. Tutoyeer ("je").
- Kort: meestal 2–5 zinnen. Noem concrete tabbladen/knoppen ("het tabblad 📋", "Wijzig opzet").
- Geen medische, juridische of voetbaltechnische/pedagogische adviezen — alleen app-gebruik.
- Vraag NOOIT om namen van spelers of andere persoonsgegevens, en herhaal die ook niet.

Rondleiding-verwijzing (belangrijk):
Als jouw antwoord over één specifiek onderdeel van de app gaat én een korte interactieve
rondleiding de coach zou helpen, sluit je af met EXACT één marker op een eigen regel:
[[TOUR:x]]
waarbij x precies één van deze hoofdstukken is:
${TOUR_HOOFDSTUKKEN.join(', ')}.
Kies het hoofdstuk dat het beste bij de vraag past (bv. een vraag over de opstelling → [[TOUR:opstelling]],
over het uitnodigen van een coach of teaminstellingen → [[TOUR:instellingen]]).
Voeg de marker alleen toe als hij echt past; laat hem anders weg. Schrijf zelf NOOIT letterlijk
"[[TOUR:..." in je zichtbare zin — de marker staat los, onderaan.

KENNISBANK:
${KENNIS_TEKST}`;

exports.chatHulp = onCall(
  { region: REGIO, secrets: [ANTHROPIC_API_KEY], cors: true },
  async (request) => {
    const { clubId, rol } = await vereisAI(request);
    const namen = await namenVoorScrub(clubId, request.auth.uid, rol);

    const berichten = Array.isArray(request.data?.berichten) ? request.data.berichten : [];
    if (!berichten.length){
      throw new HttpsError('invalid-argument', 'Geen vraag ontvangen.');
    }

    // Alleen rol + tekst doorlaten, lengte begrenzen, laatste ~10 beurten houden.
    const messages = berichten
      .filter(b => b && (b.role === 'user' || b.role === 'assistant') && typeof b.content === 'string')
      .slice(-10)
      .map(b => ({ role: b.role, content: scrubPII(String(b.content).slice(0, 2000), namen) }));

    if (!messages.length || messages[messages.length - 1].role !== 'user'){
      throw new HttpsError('invalid-argument', 'Laatste bericht moet een vraag zijn.');
    }

    // Systeemblok met cache_control → wordt hergebruikt over vragen heen (goedkoper).
    const system = [
      { type: 'text', text: HULP_SYSTEEM, cache_control: { type: 'ephemeral' } },
    ];

    const antwoord = await claude({
      apiKey: ANTHROPIC_API_KEY.value(),
      system,
      messages,
      maxTokens: 600,
      temperature: 0.3,
    });

    return { antwoord: antwoord || 'Sorry, ik heb hier geen antwoord op.' };
  }
);

/* ---------- 2b. AI-WEDSTRIJDVERSLAG ==================== */

const VERSLAG_SYSTEEM = `Je schrijft korte, levendige wedstrijdverslagen voor een jeugdvoetbalteam,
bedoeld om te delen met ouders en spelers (bv. via WhatsApp). Toon: enthousiast, warm,
positief en sportief — het gaat om kinderen, dus nooit afkraken, altijd de inzet vieren.

Regels:
- Schrijf in het Nederlands, in vloeiende alinea's (geen opsomming, geen kopjes).
- Lengte: ongeveer 120–200 woorden.
- Gebruik ALLEEN de aangeleverde gegevens. Verzin geen doelpunten, namen, minuten of gebeurtenissen.
- De spelers heten in de data neutraal "Speler 1", "Speler 2", enzovoort. Neem die labels
  LETTERLIJK over zoals ze zijn — verander ze niet en verzin er geen echte namen bij.
- Noem de eindstand en of er gewonnen, verloren of gelijkgespeeld is. Bij verlies of gelijkspel:
  blijf positief en opbouwend.
- Als er een wedstrijddoel is meegegeven, verwijs daar kort naar.
- Benoem doelpuntenmakers als die er zijn. Speeltijd hoef je niet uitputtend op te sommen;
  gebruik het hooguit voor een sfeerzin.
- Geen emoji-overdaad (een enkele mag), geen hashtags, geen aanhalingstekens rond de tekst.
- Lever alleen de verslagtekst zelf — geen inleiding als "Hier is het verslag".`;

exports.genereerVerslagAI = onCall(
  { region: REGIO, secrets: [ANTHROPIC_API_KEY], cors: true },
  async (request) => {
    const { clubId: vClub, rol: vRol } = await vereisAI(request);
    const vNamen = await namenVoorScrub(vClub, request.auth.uid, vRol);

    const d = request.data?.data;
    if (!d || typeof d !== 'object'){
      throw new HttpsError('invalid-argument', 'Geen wedstrijdgegevens ontvangen.');
    }

    // Veiligheidsnet: controleer dat er geen echte namen in de payload zitten.
    // Spelers horen labels als "Speler 1" te zijn; alles behalve tegenstander/team/doel
    // wordt hieronder als neutrale data doorgegeven.
    const veiligLabel = (v) => (typeof v === 'string' && /^Speler \d+$/.test(v)) ? v : null;

    const doelpunten = Array.isArray(d.doelpunten)
      ? d.doelpunten
          .map(g => ({ speler: veiligLabel(g?.speler), aantal: Number(g?.aantal) || 1 }))
          .filter(g => g.speler)
      : [];

    const speeltijd = Array.isArray(d.speeltijd)
      ? d.speeltijd
          .map(s => ({ speler: veiligLabel(s?.speler), minuten: Number(s?.minuten) || 0 }))
          .filter(s => s.speler)
      : [];

    // Bouw een compacte, neutrale feitenlijst voor het model.
    const feiten = {
      team: String(d.team || 'ons team').slice(0, 60),
      tegenstander: String(d.tegenstander || 'de tegenstander').slice(0, 60),
      thuisOfUit: d.thuis ? 'thuis' : 'uit',
      soort: d.toernooi ? 'toernooiwedstrijd' : 'wedstrijd',
      doelpuntenVoor: Number(d.doelBin) || 0,
      doelpuntenTegen: Number(d.doelTegen) || 0,
      resultaat: ['gewonnen', 'verloren', 'gelijkgespeeld'].includes(d.resultaat) ? d.resultaat : null,
      wedstrijddoel: d.doel ? scrubPII(String(d.doel).slice(0, 200), vNamen) : null,
      aanvoerder: veiligLabel(d.aanvoerder),
      doelpuntenmakers: doelpunten,
      aantalSpelers: speeltijd.length,
    };

    const vraag = `Schrijf het wedstrijdverslag op basis van deze gegevens (JSON):\n\n` +
      JSON.stringify(feiten, null, 2);

    const system = [
      { type: 'text', text: VERSLAG_SYSTEEM, cache_control: { type: 'ephemeral' } },
    ];

    const verslag = await claude({
      apiKey: ANTHROPIC_API_KEY.value(),
      system,
      messages: [{ role: 'user', content: vraag }],
      maxTokens: 700,
      temperature: 0.7,
    });

    if (!verslag){
      throw new HttpsError('internal', 'Kon geen verslag genereren.');
    }
    return { verslag };
  }
);

/* ---------- 2c. AI-TRAININGSLAYOUT ====================
   Zet de RUWE tekst van een oefenstof-PDF om naar een gestructureerde,
   scrolbare weergave (JSON). De AI mag UITSLUITEND de layout bepalen —
   groeperen in oefeningen + blokken (kop + tekst/bullets) en aangeven welk
   diagram bij welke oefening hoort. De tekst zelf wordt LETTERLIJK
   overgenomen: niets herschrijven, samenvatten, vertalen of verzinnen.

   De client (training-ai.js) rendert per pagina de diagrammen zelf naar PNG
   en uploadt die naar Storage; hier gaat alleen platte tekst heen en weer.

   AVG: oefenstof bevat geen spelersnamen. Toch checkt de client vooraf en
   sturen we hier enkel neutrale oefentekst.

   Overeenkomst-score: NIET door de AI. De client vergelijkt woord-voor-woord
   hoeveel van de originele tekst behouden bleef en hoeveel woorden de AI
   toevoegde. Deze functie levert alleen de gestructureerde JSON. */

const TRAINING_SYSTEEM = `Je bent een layout-assistent voor een jeugdvoetbal-app. Je krijgt de RUWE,
platte tekst van een trainings-PDF (oefenstof). Jouw ENIGE taak is die tekst omzetten naar een
nette, leesbare structuur — je bent een OPMAKER, geen schrijver.

ABSOLUUT VERBODEN:
- Tekst herschrijven, herformuleren, samenvatten, inkorten of uitbreiden.
- Woorden, zinnen, tips of uitleg toevoegen die niet letterlijk in de bron staan.
- Vertalen, corrigeren of "mooier" maken.
- Informatie weglaten. Alle inhoudelijke tekst moet terugkomen.

WEL toegestaan (dit is je werk):
- De tekst opsplitsen in losse OEFENINGEN (meestal 1 per PDF-pagina).
- Binnen een oefening BLOKKEN maken met een korte kop (bv. "Doel", "Benodigdheden",
  "Uitleg", "Coachmomenten", "Spelvorm"). Gebruik koppen die LETTERLIJK in de brontekst
  staan; verzin geen nieuwe koppen. Staat er geen kop, gebruik dan "Uitleg".
- Een blok tonen als losse regels (bullets) of als doorlopende tekst — kies wat past.
- Losse woorden mogen samengevoegd worden als de PDF ze verkeerd afbrak
  (bv. "door ontwikkelen" -> "doorontwikkelen"), en dubbele spaties/rare tekens opschonen.
  Dit is opmaak, geen herschrijven.
- Per oefening aangeven welk diagram erbij hoort via het paginanummer (diagramPagina).

TWEEDE, APARTE TAAK — TRAININGSDOELEN:
Naast het opmaken van de oefeningen leid je 2 tot 4 korte TRAININGSDOELEN af: waar draait
deze training als geheel om? Dit is de ENIGE plek waar je WEL mag samenvatten en in eigen
woorden formuleren — dit is geen letterlijke overname. Regels voor de doelen:
- Kort en concreet, elk max ~6 woorden, als een leerdoel/thema (bv. "Opbouwen van achteruit",
  "Snel omschakelen na balverlies", "Vrijlopen in de ruimte").
- Voetbaltechnisch/tactisch van aard; iets waar een coach een team in een wedstrijd op kan laten letten.
- NOOIT namen van spelers, coaches of andere personen in een doel opnemen — puur het thema.
- Geen dubbele doelen; als de PDF maar één duidelijk thema heeft, geef dan gewoon 1 doel.
- Staat er geen enkel bruikbaar thema in, geef dan een lege lijst: "doelen": [].

UITVOER — geef UITSLUITEND geldige JSON terug, geen uitleg eromheen, geen markdown-hekjes:
{
  "oefeningen": [
    {
      "titel": "<korte titel, letterlijk uit de tekst; anders 'Oefening N'>",
      "diagramPagina": <paginanummer 1-based waar deze oefening vandaan komt>,
      "blokken": [
        { "kop": "Doel", "type": "tekst", "tekst": "<letterlijke tekst>" },
        { "kop": "Benodigdheden", "type": "lijst", "items": ["<regel>", "<regel>"] }
      ]
    }
  ],
  "doelen": ["<kort trainingsdoel>", "<kort trainingsdoel>"]
}
"type" is "tekst" (dan veld "tekst") of "lijst" (dan veld "items": array van strings).
"doelen" is een array van korte strings (mag leeg zijn). Geef niets anders terug dan dit JSON-object.`;

exports.structureerTraining = onCall(
  { region: REGIO, secrets: [ANTHROPIC_API_KEY], cors: true },
  async (request) => {
    await vereisAI(request);

    // Client stuurt per pagina de ruwe tekst: [{ pagina: 1, tekst: "..." }, ...]
    const paginas = Array.isArray(request.data?.paginas) ? request.data.paginas : [];
    if (!paginas.length){
      throw new HttpsError('invalid-argument', 'Geen PDF-tekst ontvangen.');
    }

    // Normaliseren + begrenzen (kosten/veiligheid). Max ~20 pagina's, ~8000 tekens p.p.
    const schoon = paginas
      .slice(0, 20)
      .map((p, i) => ({
        pagina: Number(p?.pagina) || (i + 1),
        tekst: String(p?.tekst || '').slice(0, 8000),
      }))
      .filter(p => p.tekst.trim().length > 0);

    if (!schoon.length){
      throw new HttpsError('invalid-argument', 'PDF bevatte geen leesbare tekst.');
    }

    const totaalTekens = schoon.reduce((n, p) => n + p.tekst.length, 0);
    if (totaalTekens > 60000){
      throw new HttpsError('invalid-argument', 'PDF is te groot om automatisch op te maken.');
    }

    const vraag = `Hier is de ruwe tekst per pagina van de trainings-PDF. Zet om naar de ` +
      `JSON-structuur zoals beschreven. Neem de tekst LETTERLIJK over.\n\n` +
      schoon.map(p => `--- PAGINA ${p.pagina} ---\n${scrubPII(p.tekst)}`).join('\n\n');

    const system = [
      { type: 'text', text: TRAINING_SYSTEEM, cache_control: { type: 'ephemeral' } },
    ];

    const { tekst: rauw, stopReason } = await claude({
      apiKey: ANTHROPIC_API_KEY.value(),
      system,
      messages: [{ role: 'user', content: vraag }],
      maxTokens: 8192,
      temperature: 0,          // deterministisch: we willen letterlijke overname
      metaTerug: true,
    });

    // Output afgekapt door tokenlimiet → JSON is per definitie incompleet.
    if (stopReason === 'max_tokens'){
      console.error('[structureerTraining] output afgekapt (max_tokens)');
      throw new HttpsError('resource-exhausted',
        'De training is te lang om in één keer op te maken. Splits de PDF of verwijder een oefening.');
    }

    // Robuust JSON parsen: strip eventuele markdown-hekjes of tekst eromheen.
    let json = null;
    try {
      let t = rauw.trim();
      if (t.startsWith('```')){
        t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
      }
      // pak het eerste { ... laatste } als er toch tekst omheen staat
      const eerste = t.indexOf('{');
      const laatste = t.lastIndexOf('}');
      if (eerste > 0 || laatste < t.length - 1){
        t = t.slice(eerste, laatste + 1);
      }
      json = JSON.parse(t);
    } catch (e){
      console.error('[structureerTraining] JSON-parse mislukt:', e, rauw.slice(0, 300));
      throw new HttpsError('internal', 'De AI-opmaak kon niet gelezen worden. Probeer opnieuw.');
    }

    if (!json || !Array.isArray(json.oefeningen) || !json.oefeningen.length){
      throw new HttpsError('internal', 'De AI-opmaak leverde geen oefeningen op. Probeer opnieuw.');
    }

    // Doelen zijn optioneel en apart van de (letterlijke) oefeningen. Defensief
    // opschonen: alleen strings, getrimd, ontdubbeld (case-insensitief), max 4.
    let doelen = [];
    if (Array.isArray(json.doelen)){
      const gezien = new Set();
      for (const d of json.doelen){
        const t = String(d || '').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        const sleutel = t.toLowerCase();
        if (gezien.has(sleutel)) continue;
        gezien.add(sleutel);
        doelen.push(t);
        if (doelen.length >= 4) break;
      }
    }

    return { oefeningen: json.oefeningen, doelen };
  }
);

/* ---------- 2c. TRAININGSMODULE + SEIZOENSPLANNING ====================
   personaliseerTraining en seizoensVoorstel (zie trainingsai.js). Zelfde toegang en
   AI-limiet als de andere AI-functies; de app werkt ook zonder deze functies. */
Object.assign(exports, require('./trainingsai').maak({
  onCall, HttpsError, secrets: [ANTHROPIC_API_KEY], REGIO, vereisAI, claude, apiKey: () => ANTHROPIC_API_KEY.value(), scrubPII,
}));

/* ---------- 2d. HOTSPOT-SAMENVATTING ====================
   Vat de opmerkingen die coaches bij één regel (hotspot) van een training
   hebben gemaakt anoniem samen tot één of twee zinnen voor de beheerder.
   Hergebruikt de helper claude() en de secret ANTHROPIC_API_KEY hierboven.
   AVG: de frontend stuurt uitsluitend de kale opmerkingteksten + de regeltekst;
   geen namen van coaches of spelers. */

const HOTSPOT_SYSTEEM = `Je bent een assistent voor Cluppie, een app voor jeugdvoetbalcoaches. Je krijgt de tekst van één onderdeel van een training, plus een aantal losse opmerkingen die verschillende coaches daarbij hebben geplaatst. Vat de rode draad in die opmerkingen samen in één of twee korte Nederlandse zinnen, gericht aan de clubbeheerder die overweegt de oefenstof te verbeteren. Noem concrete, terugkerende punten. Verzin niets bij wat er niet staat. Gebruik geen namen. Schrijf nuchter en bondig.`;

exports.samenvatHotspot = onCall(
  { region: REGIO, secrets: [ANTHROPIC_API_KEY], cors: true },
  async (request) => {
    // Alleen beheerders/coördinatoren van de club (was: vast e-mailadres).
    const { clubId, rol } = await vereisAI(request, BEHEER_ROLLEN);
    const namen = await namenVoorScrub(clubId, request.auth.uid, rol);

    const regelTekst = scrubPII(String(request.data?.regelTekst || '').slice(0, 500), namen);
    const opmerkingen = Array.isArray(request.data?.opmerkingen)
      ? request.data.opmerkingen.map(o => scrubPII(String(o || '').slice(0, 500), namen)).filter(Boolean).slice(0, 40)
      : [];

    // Onder de 2 opmerkingen heeft samenvatten geen zin.
    if (opmerkingen.length < 2){
      return { samenvatting: '' };
    }

    const inhoud =
      `Onderdeel van de training:\n"${regelTekst}"\n\n` +
      `Opmerkingen van coaches:\n` +
      opmerkingen.map((o, i) => `${i + 1}. ${o}`).join('\n');

    // Systeemblok met cache_control → hergebruikt over aanroepen heen (goedkoper).
    const system = [
      { type: 'text', text: HOTSPOT_SYSTEEM, cache_control: { type: 'ephemeral' } },
    ];

    const samenvatting = await claude({
      apiKey: ANTHROPIC_API_KEY.value(),
      system,
      messages: [{ role: 'user', content: inhoud }],
      maxTokens: 200,
      temperature: 0.3,
    });

    return { samenvatting };
  }
);

/* ---------- 2e. BELEIDSPLAN ANALYSEREN ====================
   Een clubbeheerder importeert het eigen (jeugd)beleidsplan. De client stuurt de tekst in stukken
   (max ~12.000 tekens); deze functie haalt er voorstellen voor clubcontent uit: leerlijn-thema's,
   kompas-tips en gouden regels. Het resultaat wordt in de app ALTIJD als concept opgeslagen en door
   de beheerder gecontroleerd. Alleen de plantekst gaat mee (geen spelers- of ledengegevens). */
const BELEIDSPLAN_SYSTEEM = `Je helpt een voetbalclub haar jeugdbeleidsplan om te zetten naar teksten voor een coachapp. Je krijgt een stuk uit dat plan. Haal er uitsluitend uit wat er staat; verzin niets en voeg geen eigen adviezen toe.

Maak voorstellen in drie categorieën:
1. "leercurve": een leerthema met een korte achtergrond (1-3 zinnen, dicht bij de brontekst) en 2-5 praktische tips voor coaches. "thema" moet EXACT een van de toegestane thema's zijn die je krijgt; past een passage bij geen enkel thema, gebruik dan categorie "kompas".
2. "kompas": een korte, losse coachtip of kernzin uit het plan (max ~200 tekens).
3. "gouden-regel": een afspraak/gedragsregel van de club, kort (max ~120 tekens).
Domein-tags (optioneel, uit TE, TA, FY, ME, GE): TE techniek, TA tactiek, FY fysiek, ME mentaal, GE gedrag/groepsdynamiek.

Regels:
- Neem formuleringen zoveel mogelijk over; herschrijf alleen om een tekst op zichzelf leesbaar te maken.
- Geen namen van personen. Laat passages weg die alleen organisatie, financiën of contactgegevens betreffen.
- Staat er niets bruikbaars in het stuk, geef een lege lijst.

UITVOER — uitsluitend geldige JSON, geen uitleg of markdown:
{"items":[{"categorie":"leercurve","thema":"<exact toegestaan thema>","achtergrond":"...","tips":["..."],"tags":["TE"]},
{"categorie":"kompas","titel":"<korte tip>","tags":[]},
{"categorie":"gouden-regel","titel":"<korte regel>","tags":[]}]}`;

exports.analyseerBeleidsplan = onCall(
  { region: REGIO, secrets: [ANTHROPIC_API_KEY], cors: true },
  async (request) => {
    const { clubId } = await vereisAI(request, ['club_admin']);
    const tekst = String(request.data?.tekst || '').replace(/\s+\n/g, '\n').trim().slice(0, 14000);
    if (tekst.length < 80) throw new HttpsError('invalid-argument', 'Te weinig tekst om te analyseren.');
    const themas = Array.isArray(request.data?.themas)
      ? request.data.themas.map(t => String(t).slice(0, 60)).filter(Boolean).slice(0, 40) : [];
    const vraag = `Toegestane thema's voor "leercurve": ${themas.join(' | ') || '(geen opgegeven)'}\n\n--- STUK UIT HET BELEIDSPLAN ---\n${tekst}`;
    const { tekst: rauw, stopReason } = await claude({
      apiKey: ANTHROPIC_API_KEY.value(),
      system: [{ type: 'text', text: BELEIDSPLAN_SYSTEEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: vraag }],
      maxTokens: 4096, temperature: 0.2, metaTerug: true,
    });
    if (stopReason === 'max_tokens') throw new HttpsError('resource-exhausted', 'Dit stuk levert te veel op in één keer; probeer een kleiner stuk.');
    let json;
    try {
      let t = rauw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      json = JSON.parse(a >= 0 ? t.slice(a, b + 1) : t);
    } catch (e) {
      console.error('[analyseerBeleidsplan] JSON-parse mislukt:', e.message, rauw.slice(0, 200));
      throw new HttpsError('internal', 'De analyse kon niet gelezen worden. Probeer opnieuw.');
    }
    const toegestaan = new Set(themas);
    const items = (Array.isArray(json.items) ? json.items : []).slice(0, 60).map(i => {
      const categorie = ['leercurve', 'kompas', 'gouden-regel'].includes(i?.categorie) ? i.categorie : null;
      if (!categorie) return null;
      const tags = (Array.isArray(i.tags) ? i.tags : []).map(String).filter(t => ['TE', 'TA', 'FY', 'ME', 'GE'].includes(t));
      if (categorie === 'leercurve'){
        if (!toegestaan.has(i.thema)) return null;
        return { categorie, thema: i.thema, titel: i.thema, achtergrond: String(i.achtergrond || '').slice(0, 1200),
          tips: (Array.isArray(i.tips) ? i.tips : []).map(x => String(x).slice(0, 300)).filter(Boolean).slice(0, 6), tags };
      }
      const titel = String(i.titel || '').trim().slice(0, 300);
      return titel ? { categorie, titel, achtergrond: '', tips: [], tags } : null;
    }).filter(Boolean);
    return { items };
  }
);

/* ==================== 3. SPORTLINK CLUB.DATASERVICE-SYNC ====================
   Per club één client_id (clubs/{c}.sportlinkClientId, in de app in te stellen
   onder Club → Instellingen → Sportlink).

   Koppeling team ↔ Sportlink: op TEAMCODE.
     • teams/{t}.sportlinkTeamcode gezet → die wordt gebruikt.
     • anders automatisch op naam: het clubvoorvoegsel ("FC Voorbeeld ") wordt uit de
       Sportlink-teamlijst afgeleid, dus werkt voor elke club. Alleen een
       UNIEKE naam-match telt; bij twijfel geen koppeling.
   In programma/uitslagen staat het team in thuisteamid/uitteamid (= teamcode,
   live geverifieerd 28-09-2026). De reguliere poulecode staat in de teamlijst,
   dus geen extra 'wedstrijd-informatie'-call nodig.

   Schrijft (in het formaat dat de app leest):
     clubs/{c}/geheim/_sportlink           → keuzelijst voor de client
     clubs/{c}/geheim/{teamId}             → status: gematcht, laatsteSync, laatsteAantal, laatsteFout, …
     teams/{t}/wedstrijden/sl_{code}       → merge, dus handmatige velden blijven
     teams/{t}/poule/{stand|uitslagen|programma}  → { rijen:[…] } (Nederlandse veldnamen)
   AVG: alleen club-/wedstrijd-/standdata, geen spelersgegevens.
   =========================================================================== */

const SPORTLINK_BASIS = 'https://data.sportlink.com';
const PROGRAMMA_DAGEN = 120;

function uitslagVenster(){
  const nu = new Date();
  const jaar = nu.getMonth() >= 6 ? nu.getFullYear() : nu.getFullYear() - 1;   // seizoen start 1 juli
  const weken = Math.min(52, Math.ceil((nu - new Date(Date.UTC(jaar, 6, 1))) / (7 * 864e5)) + 1);
  return { weekoffset: -weken, dagenPoule: Math.min(250, weken * 7 + 7), dagenClub: Math.min(365, weken * 7 + 7) };
}
function seizoenVan(datum){
  const d = new Date(datum + 'T12:00:00Z');
  if (isNaN(d)) return null;
  const j = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${j}/'${String(j + 1).slice(2)}`;
}

async function sportlinkCall(clientId, endpoint, params = {}){
  const qs = new URLSearchParams({ client_id: clientId, ...params }).toString();
  const resp = await fetch(`${SPORTLINK_BASIS}/${endpoint}?${qs}`, {
    headers: { 'User-Agent': 'Cluppie/2.0', 'Accept': 'application/json' },
  });
  if (!resp.ok) throw new Error(`Sportlink gaf status ${resp.status} op ${endpoint}`);
  const tekst = await resp.text();
  if (!tekst.trim()) return [];
  let data;
  try { data = JSON.parse(tekst); } catch { throw new Error(`Sportlink gaf geen geldige JSON op ${endpoint}`); }
  return Array.isArray(data) ? data : (data ? [data] : []);
}

const normSleutel = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function normDatum(d){
  const s = String(d || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);     if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
function normTijd(t){
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}
function parseUitslag(u){
  const m = /(\d+)\s*[-–]\s*(\d+)/.exec(String(u || ''));
  return m ? { thuis: Number(m[1]), uit: Number(m[2]) } : null;
}
const num = (v) => Number(String(v ?? '').replace(/[^\d-]/g, '')) || 0;

/* --- teamlijst ------------------------------------------------------------- */

/* Eén regel per teamcode; de reguliere competitie levert poulecode + klasse. */
async function haalTeamlijst(clientId){
  const regels = await sportlinkCall(clientId, 'teams', {});
  const perCode = new Map();
  for (const r of regels){
    const teamcode = r.teamcode != null ? String(r.teamcode) : '';
    const teamnaam = String(r.teamnaam || '').trim();
    if (!teamcode || !teamnaam) continue;
    const regulier = String(r.competitiesoort || '').toLowerCase() === 'regulier';
    const b = perCode.get(teamcode);
    if (b && (b._regulier || !regulier)) continue;
    perCode.set(teamcode, {
      teamcode, teamnaam,
      lokaleteamcode: r.lokaleteamcode != null ? String(r.lokaleteamcode) : '-1',
      poulecode: regulier && r.poulecode != null ? String(r.poulecode) : null,
      klassepoule: regulier ? (String(r.klassepoule || '').trim() || null) : null,
      leeftijdscategorie: String(r.leeftijdscategorie || '').trim() || null,
      geslacht: String(r.geslacht || '').trim() || null,
      speeldag: String(r.speeldag || '').trim() || null,
      _regulier: regulier,
    });
  }
  // [20261012a] alle poules per team (regulier, beker, …); poulecode/klassepoule blijven de reguliere
  const poules = slh.poulesPerTeam(regels);
  return [...perCode.values()].map(({ _regulier, ...t }) => ({ ...t, poules: poules.get(t.teamcode) || [] }));
}

/* Gemeenschappelijk voorvoegsel van alle teamnamen, afgekapt op een spatie:
   ["Club 1","Club O11-2",…] → "FC Voorbeeld ". Zo is geen clubnaam-regex nodig. */
function clubVoorvoegsel(lijst){
  const namen = lijst.map(t => t.teamnaam);
  if (namen.length < 2) return '';
  let p = namen[0];
  for (const n of namen) while (!n.startsWith(p)) p = p.slice(0, -1);
  const sp = p.lastIndexOf(' ');
  return sp >= 0 ? p.slice(0, sp + 1) : '';
}

/* Vergelijkbare sleutel voor een teamnaam, zonder clubvoorvoegsel.
   "Club O8-1JM" / "JO8-1" → "o8-1"; "MO15-1" → "mo15-1"; "Club 1" / "1" →
   "sen1"; "VR30+1" → "vr30+1" (botst dus niet met "sen1"). */
function naamSleutel(naam, voorvoegsel){
  let s = String(naam || '').trim();
  if (voorvoegsel && s.toLowerCase().startsWith(voorvoegsel.toLowerCase())) s = s.slice(voorvoegsel.length);
  s = s.toLowerCase().trim();
  const m = s.match(/^(m)?j?o\s*(\d{1,2})\s*[-\s]\s*(\d+)\s*(?:jm|j|m)?(?:\s*\(.*\))?$/i);
  if (m) return (m[1] ? 'm' : '') + 'o' + m[2] + '-' + m[3];
  const sr = s.match(/^(\d{1,2})\s*(?:\(?\s*(?:zon|zat)[a-z]*\s*\)?)?$/);
  if (sr) return 'sen' + sr[1];
  return s.replace(/[^a-z0-9+]+/g, '');
}

/* Welk Sportlink-team hoort bij dit Cluppie-team? */
function koppeling(team, lijst, voorvoegsel){
  const vast = String(team.sportlinkTeamcode || '').trim();
  if (vast){
    const t = lijst.find(x => x.teamcode === vast);
    return t ? { ...t, automatisch: false } : { teamcode: vast, teamnaam: null, poulecode: null, automatisch: false };
  }
  const k = naamSleutel(team.sportlinkNaam || team.naam, voorvoegsel);
  if (!k) return null;
  const kandidaten = lijst.filter(x => naamSleutel(x.teamnaam, voorvoegsel) === k);
  // Veld gaat vóór futsal e.d.: kies bij meerdere de variant mét poule.
  const metPoule = kandidaten.filter(x => x.poulecode);
  const keuze = metPoule.length === 1 ? metPoule[0] : (kandidaten.length === 1 ? kandidaten[0] : null);
  return keuze ? { ...keuze, automatisch: true } : null;
}

/* --- schrijven ------------------------------------------------------------- */

async function schrijfInBatches(db, schrijfacties){
  for (let i = 0; i < schrijfacties.length; i += 450){
    const batch = db.batch();
    for (const [ref, data] of schrijfacties.slice(i, i + 450)) batch.set(ref, data, { merge: true });
    await batch.commit();
  }
}

/* Eigen wedstrijden van één teamcode uit de club-brede programma+uitslagen.
   Schrijft alleen de velden die Sportlink kent (datum, aftrap, tegenstander,
   thuis); alles wat de coach in de app invult (opstelling, wissels, …) blijft
   staan, want er wordt met merge geschreven. */
function eigenWedstrijden(regels, teamcode){
  const perCode = new Map();
  for (const r of regels){
    const thuis = String(r.thuisteamid ?? '') === teamcode;
    const uit   = String(r.uitteamid ?? '') === teamcode;
    if (!thuis && !uit) continue;
    const code = String(r.wedstrijdcode || '').trim();
    const datum = normDatum(r.wedstrijddatum || r.datum);
    if (!code || !datum) continue;
    const u = parseUitslag(r.uitslag);
    const vorige = perCode.get(code);
    if (vorige && vorige.heeftUitslag && !u) continue;   // regel mét uitslag wint
    perCode.set(code, {
      heeftUitslag: !!u,
      doc: {
        datum,
        aftrap: normTijd(r.aanvangstijd),
        tegenstander: String((thuis ? r.uitteam : r.thuisteam) || 'Tegenstander').trim(),
        thuis,
        type: 'normaal',
        bron: 'sportlink',
        sportlinkCode: code,
        competitie: String(r.competitie || r.competitienaam || '').trim() || null,
        // [20261012a] beker/oefen herkenbaar + waar en hoe laat (alleen gevulde velden, merge)
        ...(slh.soortVan(r.competitiesoort) ? { competitiesoort: slh.soortVan(r.competitiesoort) } : {}),
        ...(() => { const i = slh.infoUitRegel(r, thuis); return Object.keys(i).length ? { info: i } : {}; })(),
        sportlinkSync: FieldValue.serverTimestamp(),
      },
    });
  }
  return [...perCode.values()].map(x => x.doc);
}

/* Rij in de poulestand, in de veldnamen van de app. `eigen` wordt per team
   ingevuld (zie markeerEigen). */
function standRij(s){
  return {
    positie: num(s.positie),
    team: String(s.teamnaam || s.team || '').trim(),
    clubEigen: String(s.eigenteam) === 'true',
    gespeeld: num(s.gespeeldewedstrijden),
    gewonnen: num(s.gewonnen), gelijk: num(s.gelijk), verloren: num(s.verloren),
    doelpuntenVoor: num(s.doelpuntenvoor), doelpuntenTegen: num(s.doelpuntentegen),
    saldo: num(s.doelsaldo),
    punten: num(s.punten), verliespunten: num(s.verliespunten),
  };
}
function pouleRij(r){
  const u = parseUitslag(r.uitslag);
  return {
    datum: normDatum(r.wedstrijddatum || r.datum),
    tijd: normTijd(r.aanvangstijd),
    thuis: String(r.thuisteam || '').trim(),
    uit: String(r.uitteam || '').trim(),
    thuisCode: String(r.thuisteamid ?? '') || null,
    uitCode: String(r.uitteamid ?? '') || null,
    uitslag: u ? `${u.thuis}-${u.uit}` : null,
    code: String(r.wedstrijdcode || '').trim() || null,
  };
}

/* Maakt van de gedeelde poule-data de documenten voor ÉÉN team: markeert de
   eigen regels (stand: op teamnaam, valt terug op Sportlinks eigenteam-vlag;
   wedstrijden: op teamcode). */
function pouleVoorTeam(p, k){
  const naam = normSleutel(k.teamnaam);
  const opNaam = p.stand.rijen.some(r => normSleutel(r.team) === naam);
  const stand = {
    ...p.stand,
    rijen: p.stand.rijen.map(({ clubEigen, ...r }) => ({ ...r, eigen: opNaam ? normSleutel(r.team) === naam : clubEigen })),
  };
  const markeer = d => ({ ...d, rijen: d.rijen.map(r => ({ ...r, eigenErin: r.thuisCode === k.teamcode || r.uitCode === k.teamcode })) });
  return { stand, uitslagen: markeer(p.uitslagen), programma: markeer(p.programma) };
}

/* Poule-data één keer per poulecode per run ophalen (meerdere teams kunnen in
   dezelfde poule zitten, bv. na een koppeling-dubbeling). */
async function haalPoule(clientId, poulecode, venster){
  const [stand, uitslagen, programma] = await Promise.all([
    sportlinkCall(clientId, 'poulestand', { poulecode }).catch(e => { console.warn(`[sl] stand ${poulecode}: ${e.message}`); return []; }),
    sportlinkCall(clientId, 'pouleuitslagen', {
      poulecode, eigenwedstrijden: 'NEE', aantaldagen: venster.dagenPoule, weekoffset: venster.weekoffset,
    }).catch(e => { console.warn(`[sl] pouleuitslagen ${poulecode}: ${e.message}`); return []; }),
    sportlinkCall(clientId, 'poule-programma', {
      poulecode, eigenwedstrijden: 'NEE', aantaldagen: 400,
    }).catch(e => { console.warn(`[sl] poule-programma ${poulecode}: ${e.message}`); return []; }),
  ]);
  const rows = stand.map(standRij).sort((a, b) => a.positie - b.positie);
  const pouleTeams = new Set(rows.map(r => normSleutel(r.team)).filter(Boolean));
  // poule-programma/-uitslagen kunnen breder zijn dan één poule: houd alleen
  // wedstrijden waarvan BEIDE teams in de stand staan (geen stand → alles).
  const inPoule = (r) => !pouleTeams.size || (pouleTeams.has(normSleutel(r.thuis)) && pouleTeams.has(normSleutel(r.uit)));
  const uitslagRijen = uitslagen.map(pouleRij).filter(r => r.datum && r.uitslag).filter(inPoule)
    .sort((a, b) => (b.datum + (b.tijd || '')).localeCompare(a.datum + (a.tijd || '')));
  // programma + scores samenvoegen op datum + teams
  const sleutel = (r) => `${r.datum}__${normSleutel(r.thuis)}__${normSleutel(r.uit)}`;
  const samen = new Map();
  for (const r of programma.map(pouleRij).filter(r => r.datum).filter(inPoule)) samen.set(sleutel(r), r);
  for (const r of uitslagRijen){
    const b = samen.get(sleutel(r));
    if (b) b.uitslag = r.uitslag; else samen.set(sleutel(r), { ...r });
  }
  const programmaRijen = [...samen.values()]
    .sort((a, b) => (a.datum + (a.tijd || '')).localeCompare(b.datum + (b.tijd || '')));
  return {
    ruw: [...uitslagen, ...programma],   // [20261012h] voor de clubgids (clubcode + sportpark)
    stand: { rijen: rows, poulecode, klassepoule: String(stand[0]?.klassepoule || '').trim() || null },
    uitslagen: { rijen: uitslagRijen, poulecode },
    programma: { rijen: programmaRijen, poulecode },
  };
}

/* --- club-sync ------------------------------------------------------------- */

async function syncClubSportlink(clubId, { alleenTeamlijst = false } = {}){
  const db = getFirestore();
  const club = (await db.doc(PADEN.club(clubId)).get()).data() || {};
  const clientId = String(club.sportlinkClientId || '').trim();
  if (!clientId) return { geenClientId: true, teams: 0, gematcht: 0, wedstrijden: 0, totaalWedstrijden: 0 };

  const lijst = await haalTeamlijst(clientId);
  const voorvoegsel = clubVoorvoegsel(lijst);
  if (alleenTeamlijst){
    await db.doc(PADEN.teamlijst(clubId)).set({ teams: lijst, voorvoegsel, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { teamlijst: lijst.length };
  }

  const venster = uitslagVenster();
  /* [20261012d] Programma en uitslagen PER TEAM (parameter teamcode). Clubbreed kapt Sportlink de
     lijst af: bij ASV stopte het seizoensoverzicht half september, zodat latere uitslagen en
     wedstrijden nooit binnenkwamen (live vastgesteld 12-10-2026 met O12-1). Alleen afgelastingen
     blijft clubbreed: dat is een korte lijst. */
  const afgelastRuw = await sportlinkCall(clientId, 'afgelastingen', {})
    .catch(e => { console.warn(`[sl] afgelastingen ${clubId}: ${e.message}`); return null; });
  const afgelast = afgelastRuw ? afgelastingenMap(afgelastRuw) : null;
  const teamWedstrijden = async (k) => {
    const t = { teamcode: k.teamcode, lokaleteamcode: k.lokaleteamcode || '-1' };
    const [programma, uitslagen] = await Promise.all([
      sportlinkCall(clientId, 'programma', {
        ...t, aantaldagen: PROGRAMMA_DAGEN, eigenwedstrijden: 'ja', sorteervolgorde: 'datum-team-tijd', weekoffset: 0,
      }).catch(e => { console.warn(`[sl] programma ${clubId}/${k.teamcode}: ${e.message}`); return null; }),
      sportlinkCall(clientId, 'uitslagen', {
        ...t, aantaldagen: venster.dagenClub, weekoffset: venster.weekoffset, eigenwedstrijden: 'ja', sorteervolgorde: 'datum-team-tijd',
      }).catch(e => { console.warn(`[sl] uitslagen ${clubId}/${k.teamcode}: ${e.message}`); return []; }),
    ]);
    const bron = [...(programma || []), ...uitslagen];
    // null = programma niet (goed) opgehaald of leeg; dan markeren we niets als "verdwenen"
    const inProgramma = programma && programma.length ? new Set(bron.map(r => String(r.wedstrijdcode || '').trim()).filter(Boolean)) : null;
    return { bron, inProgramma };
  };

  const teamsSnap = await db.collection(PADEN.teamsCol()).where('club', '==', clubId).get();
  const pouleCache = new Map();
  const koppelingen = {};
  const accCache = new Map();
  const gidsRegels = [];   // [20261012h] rauwe wedstrijdregels voor de clubgids
  let wedstrijden = 0, gematcht = 0;

  for (const teamDoc of teamsSnap.docs){
    const team = teamDoc.data() || {};
    if (team.archief === true || team.active === false) continue;
    const statusRef = db.doc(PADEN.teamStatus(clubId, teamDoc.id));
    try {
      const k = koppeling(team, lijst, voorvoegsel);
      if (!k){
        await statusRef.set({
          gematcht: false, teamcode: null, teamnaam: null, laatsteAantal: 0,
          laatsteSync: FieldValue.serverTimestamp(), laatsteFout: null,
        });
        continue;
      }
      koppelingen[k.teamcode] = teamDoc.id;
      const { bron, inProgramma } = await teamWedstrijden(k);
      gidsRegels.push(...bron);
      const eigen = eigenWedstrijden(bron, k.teamcode);
      await vulAccommodaties(db, clientId, eigen, accCache);
      await schrijfInBatches(db, eigen.map(w => [
        db.collection(PADEN.wedstrijden(teamDoc.id)).doc('sl_' + w.sportlinkCode.replace(/[^A-Za-z0-9]/g, '')), w,
      ]));
      wedstrijden += eigen.length;

      // [20261012a] afgelast / niet meer in Sportlink (nooit verwijderen)
      if (afgelast || inProgramma) await pasAfgelastToe(db, teamDoc.id, { inProgramma, afgelast: afgelast || new Map() });

      const col = db.collection(PADEN.poule(teamDoc.id));
      const ts = { bijgewerkt: FieldValue.serverTimestamp() };
      if (k.poulecode){
        if (!pouleCache.has(k.poulecode)) pouleCache.set(k.poulecode, await haalPoule(clientId, k.poulecode, venster));
        const p = pouleVoorTeam(pouleCache.get(k.poulecode), k);
        await Promise.all([
          col.doc('stand').set({ ...p.stand, ...ts }),
          col.doc('uitslagen').set({ ...p.uitslagen, ...ts }),
          col.doc('programma').set({ ...p.programma, ...ts }),
        ]);
      }
      // [20261012a] bekerpoule: één document met stand + uitslagen + programma
      const beker = slh.bekerPoule(k.poules);
      if (beker){
        if (!pouleCache.has(beker.poulecode)) pouleCache.set(beker.poulecode, await haalPoule(clientId, beker.poulecode, venster));
        const p = pouleVoorTeam(pouleCache.get(beker.poulecode), k);
        await col.doc('beker').set({
          poulecode: beker.poulecode, klassepoule: p.stand.klassepoule || beker.klassepoule || null,
          stand: p.stand.rijen, uitslagen: p.uitslagen.rijen, programma: p.programma.rijen, ...ts,
        });
      } else {
        await col.doc('beker').delete().catch(() => {});
      }
      await statusRef.set({
        gematcht: true, automatisch: k.automatisch, teamcode: k.teamcode, teamnaam: k.teamnaam,
        poulecode: k.poulecode || null, klassepoule: k.klassepoule || null, bekerPoulecode: beker?.poulecode || null,
        laatsteAantal: eigen.length, laatsteSync: FieldValue.serverTimestamp(), laatsteFout: null,
      });
      gematcht++;
    } catch (e){
      console.error(`[sl] club ${clubId} team ${teamDoc.id}:`, e);
      await statusRef.set({
        laatsteSync: FieldValue.serverTimestamp(), laatsteFout: String(e.message || e).slice(0, 200),
      }, { merge: true });
    }
  }

  for (const p of pouleCache.values()) gidsRegels.push(...(p.ruw || []));
  try { await schrijfClubgids(db, gidsRegels, accCache); }
  catch (e){ console.warn(`[sl] clubgids ${clubId}: ${e.message || e}`); }   // gids mag de sync nooit laten mislukken
  // koppelingen teamcode → teamId: nodig voor de snelle weekendcontrole (checkAfgelastingen)
  await db.doc(PADEN.teamlijst(clubId)).set({ teams: lijst, voorvoegsel, koppelingen, updatedAt: FieldValue.serverTimestamp() });
  if (afgelast) await schrijfAfgelastOverzicht(db, clubId, afgelast, koppelingen, teamsSnap);
  // clubcode één keer vastleggen (bestaande clubs): daarmee herkent "Club aanmelden" een dubbele club
  let clubcode = club.sportlinkClubcode || null;
  if (!clubcode){
    try { clubcode = slh.filterClubgegevens(await sportlinkCall(clientId, 'clubgegevens', {}))?.clubcode || null; }
    catch (e){ console.warn(`[sl] clubgegevens ${clubId}: ${e.message}`); }
  }
  await db.doc(PADEN.club(clubId)).set({ sportlinkLaatsteSync: FieldValue.serverTimestamp(), ...(clubcode ? { sportlinkClubcode: clubcode } : {}) }, { merge: true });
  return { teams: teamsSnap.size, gematcht, wedstrijden, totaalWedstrijden: wedstrijden };
}

/* --- afgelastingen (20261012a) -------------------------------------------- */

function afgelastingenMap(regels){
  const m = new Map();
  for (const r of regels || []){ const a = slh.afgelastRegel(r); if (a) m.set(a.code, a); }
  return m;
}
const vandaagNL = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
function plusDagen(iso, n){ const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* Past afgelastPlan toe op de komende Sportlink-wedstrijden van één team. Leest alleen
   wedstrijden vanaf vandaag (enkelvoudige range-query, geen samengestelde index nodig). */
async function pasAfgelastToe(db, teamId, { inProgramma, afgelast }){
  const vandaag = vandaagNL();
  const snap = await db.collection(PADEN.wedstrijden(teamId)).where('datum', '>=', vandaag).get();
  const bestaand = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(w => w.bron === 'sportlink' && w.sportlinkCode);
  const plan = slh.afgelastPlan({ bestaand, inProgramma, afgelast, vanaf: vandaag, tot: plusDagen(vandaag, PROGRAMMA_DAGEN - 1) });
  if (!plan.length) return 0;
  const batch = db.batch();
  for (const [id, patch] of plan){
    const data = {};
    for (const [k, v] of Object.entries(patch)) data[k] = v === null ? FieldValue.delete() : v;
    if (patch.status === 'afgelast') data.afgelastOp = FieldValue.serverTimestamp();
    if (patch.status === null) data.afgelastOp = FieldValue.delete();
    batch.update(db.collection(PADEN.wedstrijden(teamId)).doc(id), data);
  }
  await batch.commit();
  return plan.length;
}

/* Clubscherm "Afgelasten": de komende afgelaste wedstrijden van eigen teams. Alleen clubnamen en tijden. */
async function schrijfAfgelastOverzicht(db, clubId, afgelast, koppelingen, teamsSnap = null){
  const vandaag = vandaagNL();
  const namen = {};
  if (teamsSnap) for (const d of teamsSnap.docs) namen[d.id] = (d.data() || {}).naam || '';
  const rijen = [];
  for (const a of afgelast.values()){
    if (a.datum < vandaag) continue;
    const teamId = koppelingen[a.thuisCode] || koppelingen[a.uitCode];
    if (!teamId) continue;
    rijen.push({ teamId, teamNaam: namen[teamId] || '', datum: a.datum, tijd: a.tijd, wedstrijd: a.wedstrijd, code: a.code });
  }
  rijen.sort((x, y) => (x.datum + x.tijd).localeCompare(y.datum + y.tijd));
  const ref = db.doc(PADEN.afgelast(clubId));
  const oud = (await ref.get()).data();
  const sleutel = r => r.map(x => x.code).join(',');
  if (oud && sleutel(oud.rijen || []) === sleutel(rijen)) return;
  await ref.set({ rijen, bijgewerkt: FieldValue.serverTimestamp() });
}

/* Uitwedstrijden in de komende 21 dagen: adres + route, één keer per sportpark (gedeelde cache). */
async function vulAccommodaties(db, clientId, eigen, cache){
  const grens = plusDagen(vandaagNL(), 21), vandaag = vandaagNL();
  for (const w of eigen){
    if (w.thuis || !w.info?.accommodatie || w.datum < vandaag || w.datum > grens) continue;
    const sleutel = slh.accommodatieSleutel(w.info.accommodatie, w.info.plaats);
    if (!sleutel) continue;
    if (!cache.has(sleutel)){
      let acc = null;
      try {
        const ref = db.doc(PADEN.accommodatie(sleutel));
        const d = (await ref.get()).data();
        const vers = d && d.opgehaald && (Date.now() - d.opgehaald.toMillis()) < 180 * 864e5;
        if (vers) acc = d;
        else {
          acc = slh.accommodatieUit(await sportlinkCall(clientId, 'wedstrijd-accommodatie', { wedstrijdcode: w.sportlinkCode }));
          if (acc) await ref.set({ ...acc, naam: w.info.accommodatie, opgehaald: FieldValue.serverTimestamp() });
        }
      } catch (e){ console.warn(`[sl] accommodatie ${sleutel}: ${e.message}`); }
      cache.set(sleutel, acc);
    }
    const acc = cache.get(sleutel);
    if (acc) Object.assign(w.info, { adres: acc.adres || undefined, plaatsAdres: acc.plaats || undefined, telefoon: acc.telefoon || undefined, route: acc.route || undefined });
    for (const k of Object.keys(w.info)) if (w.info[k] === undefined) delete w.info[k];
  }
}

/* [20261012h] Clubgids bijwerken: platformbreed clubgids/{clubcode}. Leest de bestaande documenten
   in één keer en schrijft alleen wat verandert. Adres uit de accommodatie-cache (deze run of eerder). */
async function schrijfClubgids(db, regels, accCache = new Map()){
  const per = slh.gidsUitRegels(regels);
  if (!per.size) return 0;
  const codes = [...per.keys()];
  const refs = codes.map(c => db.doc(`${PADEN.clubgids}/${c}`));
  const oud = new Map();
  for (let i = 0; i < refs.length; i += 300){
    const snaps = await db.getAll(...refs.slice(i, i + 300));
    snaps.forEach((d, j) => oud.set(codes[i + j], d.exists ? d.data() : null));
  }
  const schrijf = [];
  for (const code of codes){
    const g = per.get(code);
    const sportpark = [...g.sportparken.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    let adres = null;
    const sleutel = sportpark && g.plaats ? slh.accommodatieSleutel(sportpark, g.plaats) : '';
    if (sleutel && !oud.get(code)?.adres){
      if (accCache.has(sleutel)) adres = accCache.get(sleutel);
      else { const d = (await db.doc(PADEN.accommodatie(sleutel)).get()).data(); adres = d || null; accCache.set(sleutel, adres); }
    }
    const nieuw = slh.gidsSamenvoegen(oud.get(code), g, adres);
    if (nieuw) schrijf.push([refs[codes.indexOf(code)], { ...nieuw, bijgewerkt: FieldValue.serverTimestamp() }]);
  }
  for (let i = 0; i < schrijf.length; i += 450){
    const batch = db.batch();
    for (const [ref, data] of schrijf.slice(i, i + 450)) batch.set(ref, data);
    await batch.commit();
  }
  return schrijf.length;
}

/* Weekendcontrole: alleen het afgelastingen-endpoint, één call per club. */
async function checkAfgelastingenClub(db, clubId, clientId){
  const lijstDoc = (await db.doc(PADEN.teamlijst(clubId)).get()).data() || {};
  const koppelingen = lijstDoc.koppelingen || {};
  if (!Object.keys(koppelingen).length) return { overgeslagen: 'geen koppelingen' };
  const afgelast = afgelastingenMap(await sportlinkCall(clientId, 'afgelastingen', {}));
  const vandaag = vandaagNL();
  let gemarkeerd = 0;
  for (const a of afgelast.values()){
    if (a.datum < vandaag) continue;
    const teamId = koppelingen[a.thuisCode] || koppelingen[a.uitCode];
    if (!teamId) continue;
    const ref = db.collection(PADEN.wedstrijden(teamId)).doc('sl_' + a.code.replace(/[^A-Za-z0-9]/g, ''));
    const d = (await ref.get()).data();
    if (!d || d.status === 'afgelast') continue;
    await ref.update({ status: 'afgelast', afgelastOp: FieldValue.serverTimestamp(), sportlinkWeg: FieldValue.delete() });
    gemarkeerd++;
  }
  const teamsSnap = await db.collection(PADEN.teamsCol()).where('club', '==', clubId).get();
  await schrijfAfgelastOverzicht(db, clubId, afgelast, koppelingen, teamsSnap);
  return { afgelast: afgelast.size, gemarkeerd };
}

/* Handmatig — alleen club-admins. { clubId, alleenTeamlijst? } */
exports.sportlinkSyncNu = onCall(
  { region: REGIO, cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    const { clubId } = await vereisLid(request, ADMIN_ROLLEN);
    try {
      return await syncClubSportlink(clubId, { alleenTeamlijst: !!request.data?.alleenTeamlijst });
    } catch (e){
      console.error('[sportlinkSyncNu]', e);
      throw new HttpsError('internal', String(e.message || e));
    }
  }
);

/* Nachtelijk — alle clubs met een Sportlink client_id. */
exports.syncSportlink = onSchedule(
  { region: REGIO, schedule: '30 3 * * *', timeZone: 'Europe/Amsterdam', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore();
    const clubs = await db.collection('clubs').get();
    for (const c of clubs.docs){
      const d = c.data() || {};
      if (d.status && d.status !== 'active') continue;
      if (!String(d.sportlinkClientId || '').trim()) continue;
      try {
        const r = await syncClubSportlink(c.id);
        console.log(`[syncSportlink] ${c.id}:`, JSON.stringify(r));
      } catch (e){
        console.error(`[syncSportlink] ${c.id} mislukt:`, e);
      }
    }
  }
);

/* [20261012a] Weekend: afgelastingen vallen vaak op zaterdagochtend, de nachtsync is dan te laat.
   Draait vr–zo elke 30 minuten en doet alleen iets binnen het venster (vr 16–22, za/zo 7–14 NL).
   Eén Sportlink-call per club. */
exports.checkAfgelastingen = onSchedule(
  { region: REGIO, schedule: '*/30 * * * 5,6,0', timeZone: 'Europe/Amsterdam', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    if (!slh.inAfgelastVenster(nu.getDay(), nu.getHours())) return;
    const db = getFirestore();
    const clubs = await db.collection('clubs').get();
    for (const c of clubs.docs){
      const d = c.data() || {};
      if (d.status && d.status !== 'active') continue;
      const clientId = String(d.sportlinkClientId || '').trim();
      if (!clientId) continue;
      try { console.log(`[checkAfgelastingen] ${c.id}:`, JSON.stringify(await checkAfgelastingenClub(db, c.id, clientId))); }
      catch (e){ console.error(`[checkAfgelastingen] ${c.id} mislukt:`, e.message || e); }
    }
  }
);

/* [20261012a] Club opzoeken met een Sportlink Client ID. Voor "Club aanmelden", de wizard en
   "Koppeling testen". Geeft alleen naam, plaats, logo, kleur en aantallen terug — nooit bank-,
   KvK- of contactgegevens. Max 10 opzoekingen per gebruiker per uur. { clientId } */
exports.sportlinkClubInfo = onCall({ region: REGIO, cors: true, timeoutSeconds: 30 }, async (request) => {
  const a = request.auth;
  if (!a || a.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Log eerst in met je eigen account.');
  const clientId = String(request.data?.clientId || '').trim();
  if (!/^[A-Za-z0-9]{6,40}$/.test(clientId)) throw new HttpsError('invalid-argument', 'Dat lijkt geen geldige Client ID.');
  const db = getFirestore();
  const limietRef = db.doc(`ratelimiet/${a.uid}`);
  const uur = new Date().toISOString().slice(0, 13);
  const mag = await db.runTransaction(async tx => {
    const r = (await tx.get(limietRef)).data() || {};
    const n = r.clubInfoUur === uur ? (r.clubInfoAantal || 0) : 0;
    if (n >= 10) return false;
    tx.set(limietRef, { clubInfoUur: uur, clubInfoAantal: n + 1 }, { merge: true });
    return true;
  });
  if (!mag) throw new HttpsError('resource-exhausted', 'Je hebt dit uur al vaak gezocht. Probeer het later opnieuw.');

  let club;
  try { club = slh.filterClubgegevens(await sportlinkCall(clientId, 'clubgegevens', {})); }
  catch (e){ console.warn('[sportlinkClubInfo]', e.message || e); club = null; }
  if (!club) return { gevonden: false };
  let teams = [];
  try { teams = await haalTeamlijst(clientId); } catch (e){ console.warn('[sportlinkClubInfo] teams', e.message || e); }
  const eigenClubId = String(request.data?.clubId || '').trim();
  const dubbel = await db.collection('clubs').where('sportlinkClubcode', '==', club.clubcode).limit(2).get();
  const bestaatAl = dubbel.docs.some(d => d.id !== eigenClubId);
  return {
    gevonden: true, bestaatAl, ...club,
    aantalTeams: teams.length,
    metCompetitie: teams.filter(t => t.poulecode).length,
    metBeker: teams.filter(t => (t.poules || []).some(p => p.soort === 'beker')).length,
  };
});

/* [20261012g] Spelers van één team uit de Sportlink-teamindeling, op verzoek van de coach.
   Geen nachtelijke sync: alleen deze aanroep, en alleen namen van zichtbare spelers (zie
   spelersUitIndeling). Toegang: coach van het team, of clubbeheerder/coördinator. Max 10/uur.
   { clubId, teamId } → { gekoppeld, zichtbaar[], afgeschermd, totaal } */
exports.sportlinkTeamSpelers = onCall({ region: REGIO, cors: true, timeoutSeconds: 30 }, async (request) => {
  const a = request.auth;
  if (!a || a.token?.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Log eerst in met je eigen account.');
  const { clubId, rol } = await vereisLid(request);
  const teamId = String(request.data?.teamId || '').trim();
  if (!teamId) throw new HttpsError('invalid-argument', 'teamId ontbreekt.');
  const db = getFirestore();
  const team = (await db.doc(`${PADEN.teamsCol()}/${teamId}`).get()).data();
  if (!team || team.club !== clubId) throw new HttpsError('not-found', 'Dit team hoort niet bij deze club.');
  if (!team.leden?.[a.uid] && !BEHEER_ROLLEN.includes(rol)) throw new HttpsError('permission-denied', 'Alleen coaches van dit team kunnen spelers ophalen.');

  const limietRef = db.doc(`ratelimiet/${a.uid}`);
  const uur = new Date().toISOString().slice(0, 13);
  const mag = await db.runTransaction(async tx => {
    const r = (await tx.get(limietRef)).data() || {};
    const n = r.spelersUur === uur ? (r.spelersAantal || 0) : 0;
    if (n >= 10) return false;
    tx.set(limietRef, { spelersUur: uur, spelersAantal: n + 1 }, { merge: true });
    return true;
  });
  if (!mag) throw new HttpsError('resource-exhausted', 'Je hebt dit uur al vaak opgehaald. Probeer het later opnieuw.');

  const club = (await db.doc(PADEN.club(clubId)).get()).data() || {};
  const clientId = String(club.sportlinkClientId || '').trim();
  const status = (await db.doc(PADEN.teamStatus(clubId, teamId)).get()).data() || {};
  const teamcode = String(team.sportlinkTeamcode || status.teamcode || '').trim();
  if (!clientId || !teamcode) return { gekoppeld: false, zichtbaar: [], afgeschermd: 0, totaal: 0 };
  const lijst = (await db.doc(PADEN.teamlijst(clubId)).get()).data()?.teams || [];
  const lokaleteamcode = lijst.find(t => t.teamcode === teamcode)?.lokaleteamcode || '-1';

  let regels;
  try { regels = await sportlinkCall(clientId, 'team-indeling', { teamcode, lokaleteamcode }); }
  catch (e){ console.warn('[sportlinkTeamSpelers]', e.message || e); throw new HttpsError('unavailable', 'Sportlink is nu niet bereikbaar. Probeer het later opnieuw.'); }
  const achternamen = club.instellingen?.privacy?.achternamen !== false;
  return { gekoppeld: true, ...slh.spelersUitIndeling(regels, { achternamen }) };
});

/* Alleen voor tests (niet-enumerable, dus de Firebase-CLI ziet het niet als functie). */
Object.defineProperty(exports, '_intern', { value: { checkAfgelastingenClub, syncClubSportlink }, enumerable: false });

/* ==================== 4. ONDERHOUD ==================== */

exports.cleanupDeletedItems = onSchedule(
  { region: REGIO, schedule: '0 4 1 * *', timeZone: 'Europe/Amsterdam' },
  async () => {
    // TODO: soft-deleted items ouder dan 30 dagen definitief verwijderen.
    console.log('[cleanupDeletedItems] nog niet geïmplementeerd');
  }
);
