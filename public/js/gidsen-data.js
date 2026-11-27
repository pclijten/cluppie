/* ==================== HANDLEIDINGEN PER ONDERDEEL [20261127] ====================
   PURE module (geen DOM, geen Firebase, geen imports). De enige bron voor alle uitleg over de app:
     • Help in de app (gidsen.js) toont elke handleiding stap voor stap met het schermbeeld;
     • tools/gidsen-schermen.mjs maakt de schermbeelden uit de demo en controleert de labels;
     • tools/gidsen-pdf.mjs maakt er per handleiding een PDF van (public/hulp/pdf/);
     • tools/gidsen-kennis.mjs schrijft functions/gidsen-kennis.js, de kennis van de hulpchat.
   Verander je een scherm in de app? Pas hier de stap aan en draai de drie tools opnieuw.

   Per handleiding:
     id, slug, titel, kort       nummer (gelijk aan de video uit de serie Cluppie uitleg), naam, één regel
     voor                        rollen uit hulp-rol.js voor wie hij bedoeld is ('allen' = iedereen)
     apparaat                    'telefoon' of 'laptop': waarop de schermbeelden gemaakt zijn
     onderdeel                   optioneel: staat dit bij de club uit, dan toont Help dat erbij
     plek                        waar "Open dit scherm" heen gaat: een code uit SCHERMEN hieronder, of null
     video                       bestandsnaam van de video (zonder .mp4), of null
     stappen[]                   t = titel, x = tekst (**vet** voor knoppen), b = naam van het schermbeeld,
                                 m = labels die op dat scherm staan en een genummerde stip krijgen
     tips[]                      losse weetjes onderaan
   Schrijf zoals de app het zegt: dezelfde woorden als op de knoppen. Geen namen van echte clubs of spelers. */

export const GIDS_ROLLEN = {
  allen: 'Iedereen', coach: 'Trainer', admin: 'Clubbeheer', hjo: 'Hoofd jeugdopleiding', bouw: 'Coördinator', trainco: 'Trainingscoördinator', solo: 'Trainer zonder club',
};

/* Schermen waar Help en de hulpchat je heen kunnen brengen ("Open …"). team: = tabblad van je team,
   club: = onderdeel van het clubbeheer, actie: = een eigen venster van de club. De hulpchat krijgt deze lijst mee. */
export const SCHERMEN = {
  'team:hub': 'Startscherm', 'team:trainingen': 'Trainingen', 'team:trainingsmodule': 'Training maken', 'team:seizoensplan': 'Seizoen',
  'team:speelwijze': 'Speelwijze', 'team:presentietraining': 'Aanwezig training', 'team:preswedstrijd': 'Aanwezig wedstrijd', 'team:stats': 'Stats',
  'team:wedstrijden': 'Wedstrijden', 'team:evaluatie': 'Evaluatie', 'team:poule': 'Poule', 'team:spelers': 'Spelers', 'team:leerlijnoverzicht': 'Leerlijn',
  'team:historie': 'Historie', 'team:planning': 'Kalender', 'team:documenten': 'Documenten', 'team:lijstjes': 'Lijstjes', 'team:teamkamer': 'Teamkamer',
  'team:videos': 'Video’s', 'team:berichten': 'Berichten', 'team:instellingen': 'Instellingen', 'team:updates': 'Wat is er nieuw',
  'club:hub': 'Club', 'club:teams': 'Club › Teams', 'club:coaches': 'Club › Mensen', 'club:bouwen': 'Club › Bouwen', 'club:evals': 'Club › Evaluaties',
  'club:speelstijl': 'Club › Speelwijze', 'club:jeugdplan': 'Club › Seizoensplan maken', 'club:trainingen': 'Club › Trainingen', 'club:videos': 'Club › Video’s',
  'club:content': 'Club › Clubteksten', 'club:berichten': 'Club › Berichten', 'club:afgelasten': 'Club › Afgelasten', 'club:documenten': 'Club › Documenten',
  'club:inzicht': 'Club › Inzicht', 'club:instel': 'Club › Instellingen',
  'actie:activiteiten': 'Activiteiten', 'actie:tv': 'Kantine-tv', 'actie:sportparken': 'Sportparken', 'actie:veldplanner': 'Veldplanner',
};

export const GIDSEN = [
  { id: '01', slug: 'aan-de-slag', titel: 'Aan de slag', kort: 'Inloggen, het startscherm en waar je alles vindt',
    voor: ['allen'], apparaat: 'telefoon', plek: 'team:hub', video: '01-aan-de-slag',
    stappen: [
      { t: 'Log in', x: 'Je hoeft niets te installeren. Open **cluppie.io** in je browser en log in met Google, of met je e-mailadres en een eigen wachtwoord. Heeft een collega of de club je uitgenodigd? Open dan die link, log in en je staat meteen in het juiste team. Een uitnodiging is 14 dagen geldig.' },
      { t: 'Het startscherm', x: 'Na het inloggen zie je wat er nu gebeurt of als eerste komt: de volgende wedstrijd of training, met hoeveel spelers er zijn. Bovenaan staat je team. Train je meer teams? Tik op de teamnaam en wissel. Onder **Daarna** staan de trainingen en wedstrijden van de komende dagen.', b: '01-1', m: ['O11-2', 'Voorbereiding', 'Opstelling', 'Daarna'] },
      { t: 'De eerste stappen', x: 'De eerste keer staat er een korte lijst: bekijk de training van deze week, vul de aanwezigheid in en maak de opstelling voor je volgende wedstrijd. Tik een stap aan en je gaat er meteen heen. Met **Liever een rondleiding?** loop je alles één keer door terwijl je het zelf doet.', b: '01-2', m: ['Bekijk de training van deze week', 'Liever een rondleiding?'] },
      { t: 'Alles', x: 'Al het andere staat onder **Alles**, onderaan het scherm. De tegels staan in groepen: Trainingen, Presentie, Wedstrijden, Spelers en Meer. Welke tegels je ziet, hangt af van wat je club heeft aangezet.', b: '01-3', m: ['Trainingen', 'Tactiek', 'Wedstrijden'] },
      { t: 'Instellingen van je team', x: 'Onder **Instellingen** zie je wie er nog meer coach is. Met **Coach uitnodigen** maak je een persoonlijke link voor een collega. Je kiest hier ook de categorie van je team, zodat nieuwe wedstrijden vanzelf de juiste speeltijd en spelvorm krijgen.', b: '01-4', m: ['Coach uitnodigen', 'Categorie & speelregels'] },
      { t: 'Thema en lettergrootte', x: 'Onderaan Instellingen kies je bij **Weergave** een donker of licht thema en een grotere letter, handig langs de lijn. Die keuze geldt voor dit toestel.', b: '01-5', m: ['Weergave', 'Groot'] },
      { t: 'Hulp nodig?', x: 'Onder **Help** staan deze handleidingen. De **Hulpchat** beantwoordt je vraag in gewone woorden en wijst je naar het juiste scherm. Onder **Berichten** lees je wat de club met je team deelt, en bij **Wat is er nieuw?** staan de laatste verbeteringen.' },
    ],
    tips: ['Zet Cluppie op je beginscherm: open het menu van je browser en kies Toevoegen aan beginscherm. Het icoon krijgt het logo van je club.',
      'Wachtwoord vergeten? Tik onder de inlogknop op Wachtwoord vergeten? en je krijgt een mail om een nieuw wachtwoord in te stellen.'] },

  { id: '02', slug: 'trainingen', titel: 'Trainingen', kort: 'De trainingen van je team vinden, lezen en voorbereiden',
    voor: ['coach', 'solo'], apparaat: 'telefoon', plek: 'team:trainingen', video: '02-trainingen',
    stappen: [
      { t: 'Open Trainingen', x: 'Open **Alles** en tik op **Trainingen**. Bovenaan staat het thema waaraan je team werkt en een tip van de club; met de pijltjes blader je verder. Daaronder staan de trainingen per week: deze week bovenaan, de volgende week eronder. Wat je nog niet opende, is gemarkeerd als nieuw. Oudere weken staan onder **Eerder**.', b: '02-1', m: ['Deze week', '2 nieuw', 'Eerder'] },
      { t: 'Open een training', x: 'Tik op een training. Bovenaan zie je wat je moet uitzetten en hoe de training past bij de speelwijze en het seizoen. Daaronder staat het **leerdoel van deze training**.', b: '02-2', m: ['Uitzetten', 'Leerdoel van deze training'] },
      { t: 'Pas aan op vandaag', x: 'Bij **Vandaag** geef je aan hoeveel spelers er zijn en wat voor weer het is. De training past zich meteen aan: minder spelers, regen of kou geven andere veldmaten en soms een andere vorm.', b: '02-3', m: ['Vandaag', 'Spelers', 'Weer'] },
      { t: 'Het verloop', x: 'Onder **Verloop** staan de onderdelen op een tijdlijn, van warming-up tot afsluiting. Tik een onderdeel aan en je springt ernaartoe.', b: '02-4', m: ['Verloop'] },
      { t: 'Lees een oefenvorm', x: 'Bij elke vorm staat een tekening van het veld en daaronder het doel, de tijd, wat je nodig hebt en de uitleg in woorden die je zo tegen de spelers kunt zeggen. Onder **Differentiatie** staat een makkelijkere en een moeilijkere versie, onder **Coachmomenten** waar je op let.', b: '02-5', m: ['Doel', 'Benodigdheden', 'Uitleg'] },
      { t: 'Voorbereiden vanaf het startscherm', x: 'Staat er een training aan te komen, dan staat op het startscherm de knop **Training voorbereiden**. Daar zie je in één keer de vormen, het aantal spelers en de aanwezigheid.' },
      { t: "Video's van de club", x: "Onder **Video's** staan de filmpjes die de club met je team deelt, zoals oefenstof of uitleg. Een nieuwe video die de club uitlicht, staat één keer groot op je startscherm." },
    ],
    tips: ['Een rood stipje op de tegel Trainingen betekent dat er iets nieuws klaarstaat.', 'Met de deelknop stuur je een training door naar je collega-trainer.'] },

  { id: '03', slug: 'training-maken-en-seizoen', titel: 'Training maken en seizoen', kort: 'Zelf een training samenstellen en het seizoen plannen',
    voor: ['coach', 'solo'], apparaat: 'telefoon', onderdeel: 'trainingsmodule', plek: 'team:trainingsmodule', video: '03-training-maken-en-seizoen',
    stappen: [
      { t: 'Voor wie is dit?', x: 'Training maken en Seizoen zie je als je club met vrije trainers werkt, of als je zonder club bent begonnen. Stuurt de club met één plan, dan staan de trainingen al voor je klaar onder Trainingen.' },
      { t: 'Open Training maken', x: 'Open **Alles** en tik op **Training maken**. Vul in hoeveel spelers er zijn, kies de duur en het thema.', b: '03-1', m: ['Spelers vandaag', 'Duur', 'Thema'] },
      { t: 'Weer en materiaal', x: 'Geef aan hoe het weer is en hoeveel materiaal je hebt. Weinig spelers, weinig materiaal of regen? De training past zich aan en je ziet elke wijziging meteen.', b: '03-2', m: ['Weer', 'Materiaal'] },
      { t: 'De training', x: 'Cluppie stelt een complete training samen: een warming-up, kernvormen, een partijspel en een afsluiting. Je ziet hoe lang elk onderdeel duurt. Bevalt een vorm niet? Kies een andere.', b: '03-3', m: ['Andere vormen kiezen', 'controles gehaald'] },
      { t: 'Gecontroleerd', x: 'Elke training wordt gecontroleerd op leeftijd, aantal spelers en opbouw. Heeft je club een speelwijze vastgelegd, dan krijgt de training ook coachwoorden en een regel voor het partijspel.' },
      { t: 'Het seizoen plannen', x: 'Onder **Seizoen** plan je het hele seizoen in drie stappen: opzet, jaarlijn en bijsturing. Kies je opbouw, vul de start en het einde in, hoe vaak je traint en het niveau van je team. Vrije weken haal je eruit. Daarna staat elke week de training klaar.', b: '03-4', m: ['Opzet', 'Jaarlijn', 'Bijsturing'] },
    ],
    tips: ['Een training die je maakt, kun je daarna nog aanpassen aan de spelers en het weer van die dag.'] },

  { id: '04', slug: 'speelwijze-en-tactiekbord', titel: 'Speelwijze en tactiekbord', kort: 'Hoe de club wil voetballen, en zelf een situatie tekenen',
    voor: ['coach', 'solo'], apparaat: 'telefoon', onderdeel: 'speelwijze', plek: 'team:speelwijze', video: '04-speelwijze-en-tactiekbord',
    stappen: [
      { t: 'Open Speelwijze', x: 'Open **Alles** en tik op **Speelwijze**. Bovenaan staat in één zin hoe de club wil voetballen. Je ziet alleen de principes die passen bij de leeftijd van jouw team; de rest komt later.', b: '04-1', m: ['Onze speelwijze', 'De vier momenten van het spel'] },
      { t: 'De vier momenten', x: 'De speelwijze is ingedeeld in vier momenten: wij hebben de bal, wij verliezen de bal, zij hebben de bal en wij winnen de bal. Tik een moment aan. Per moment zie je de principes en welke het zwaarst wegen. Tik op een principe voor de uitleg.', b: '04-2', m: ['Wij hebben de bal', 'weegt het zwaarst'] },
      { t: 'Terug in de training', x: 'De trainingen van je team volgen de speelwijze. Bij een training staat het principe dat erbij hoort. De speelwijze leggen de clubbeheerder of het hoofd jeugdopleiding vast; als trainer bekijk je hem hier.' },
      { t: 'Het tactiekbord', x: 'Open **Alles** en tik op **Tactiek**. Tik op **Nieuw tactiekbord** en je krijgt een leeg veld.', b: '04-3', m: ['Nieuw tactiekbord'] },
      { t: 'Tekenen', x: 'Zet spelers van je eigen team en van de tegenstander op het veld, sleep ze naar hun plek en teken looplijnen of een pass. Een verkeerde lijn haal je weg met de gum, of je maakt de laatste stap ongedaan. Tevreden? Bewaar het bord; je vindt het terug onder Tactiek.', b: '04-4', m: ['Verplaats', 'Potlood', 'Gum', 'Bewaren'] },
    ],
    tips: ['Staat Speelwijze bij jouw club uit? Dan zie je de tegel niet. Cluppie zet dit onderdeel per club aan of uit; vraag het je clubbeheerder.'] },

  { id: '05', slug: 'presentie-en-stats', titel: 'Presentie en stats', kort: 'Bijhouden wie er is, en de speeltijd eerlijk verdelen',
    voor: ['coach', 'solo'], apparaat: 'telefoon', plek: 'team:presentietraining', video: '05-presentie-en-stats',
    stappen: [
      { t: 'Aanwezig bij de training', x: 'Open **Alles** en tik op **Aanwezig training**. Bovenaan staat de eerstvolgende training. Tik erop en je ziet de spelerslijst. Iedereen staat al op aanwezig: je tikt alleen wie er niet is. Elke wijziging wordt meteen bewaard.', b: '05-1', m: ['Eerstvolgende training', 'Andere datum invullen'] },
      { t: 'Een andere dag of een vaste afmelding', x: 'Met **Andere datum invullen** vul je een eerdere training in. Kan een speler een tijd lang niet, bijvoorbeeld door een blessure of elke maandag? Zet dan een **vaste afmelding**.' },
      { t: 'Aanwezig bij de wedstrijd', x: 'Onder **Aanwezig wedstrijd** staat eerst de wedstrijdinfo: verzamelen, vertrek, aftrap en het sportpark. De aftrap komt uit Sportlink, de andere tijden vul je zelf in. Met **Deel met ouders** stuur je alles in één keer naar de groepsapp, zonder spelersnamen.', b: '05-2', m: ['Wedstrijdinfo', 'Tijden zelf invullen', 'Deel met ouders'] },
      { t: 'Wie doet er mee?', x: 'Daaronder tik je wie er niet bij is. Komt iemand later? Zet hem op afwezig, kies **Komt later** en vul eventueel de minuut in. De tijd daarvoor telt niet mee in zijn speeltijd.', b: '05-3', m: ['Erbij'] },
      { t: 'Stats: eerlijke speeltijd', x: 'Onder **Stats** zie je hoe eerlijk de speeltijd verdeeld is, als een score van 0 tot 100, met het gemiddelde en de spreiding. Daaronder het aantal wedstrijden, de doelpunten en de opkomst.', b: '05-4', m: ['Eerlijke speeltijd', 'Wedstrijden', 'Doelpunten'] },
      { t: 'Per speler', x: 'In de tabel staat per speler hoeveel procent hij speelde en reserve stond, met doelpunten, assists en de periodes als keeper. Met de tabbladen bovenaan kijk je naar spelers die aandacht vragen of naar de opkomst bij trainingen. Onderaan maak je een **Jaaroverzicht** of neem je de cijfers mee met **Exporteer naar Excel**.', b: '05-5', m: ['Speeltijd', 'Res.'] },
    ],
    tips: ['Een afgelaste wedstrijd telt niet mee in de stats.'] },

  { id: '06', slug: 'wedstrijden-evaluatie-poule', titel: 'Wedstrijden, evaluatie en poule', kort: 'Je programma, terugkijken op het team en de stand',
    voor: ['coach', 'solo'], apparaat: 'telefoon', plek: 'team:wedstrijden', video: '06-wedstrijden-evaluatie-poule',
    stappen: [
      { t: 'Je wedstrijden', x: 'Open **Alles** en tik op **Wedstrijden**. Bovenaan staat je eerstvolgende wedstrijd, met datum, tijd, spelvorm, formatie en sportpark. Tik erop om de opstelling te maken of het wedstrijdscherm te openen. Onder **Afgelopen** staan de gespeelde wedstrijden met de uitslag.', b: '06-1', m: ['Eerstvolgend', 'Afgelopen'] },
      { t: 'Zelf een wedstrijd toevoegen', x: 'Competitiewedstrijden komen uit Sportlink. Speel je een oefenwedstrijd of een toernooi? Tik op **Nieuwe wedstrijd**. Gebruik je vaak dezelfde opstelling? Bewaar hem onder **Opstelling-sjablonen**.', b: '06-2', m: ['Nieuwe wedstrijd', 'Opstelling-sjablonen'] },
      { t: 'Afgelast', x: 'Is een wedstrijd afgelast, dan blijft hij gewoon staan, met een streep erdoor en de melding Afgelast. Zo zie je dat het programma klopt en mis je niets. Krijgt hij een nieuwe datum, dan past Cluppie dat aan zodra Sportlink het weet.' },
      { t: 'Evaluatie van het team', x: 'Onder **Evaluatie** staat na elke gespeelde wedstrijd de teamevaluatie die je nog moet invullen. Daaronder zie je per moment van het spel hoe het team zich ontwikkelt over de laatste vier wedstrijden.', b: '06-3', m: ['Teamevaluatie', 'Per moment'] },
      { t: 'Onderdelen en aandachtspunten', x: 'Bij **Onderdelen** staat per onderdeel het gemiddelde, van opbouwen tot plezier. Scoort een onderdeel steeds het laagst, dan staat het bij **Terugkerende aandachtspunten**, en stelt Cluppie een trainingsthema voor dat erop aansluit.', b: '06-4', m: ['Onderdelen', 'Terugkerende aandachtspunten', 'Voorgesteld trainingsthema'] },
      { t: 'De poule', x: 'Onder **Poule** staat de stand van je competitie, met je eigen team gemarkeerd. Bij **Programma** staan alle wedstrijden van de poule. Alles komt uit Sportlink en wordt elke nacht bijgewerkt.', b: '06-5', m: ['Stand', 'Programma'] },
    ],
    tips: ['Hoe je een wedstrijd voorbereidt en langs de lijn bijhoudt, staat in handleiding 15, De wedstrijddag.'] },

  { id: '07', slug: 'spelers', titel: 'Spelers', kort: 'Je selectie beheren en het spelersprofiel lezen',
    voor: ['coach', 'solo'], apparaat: 'telefoon', plek: 'team:spelers', video: '07-spelers',
    stappen: [
      { t: 'Je selectie', x: 'Open **Alles** en tik op **Overzicht**. Je ziet je selectie met rugnummer en positie. Wat je hier vastlegt, zien alleen de coaches van je team. Spelers en ouders zien het niet.', b: '07-1', m: ['Selectie', 'Speler toevoegen'] },
      { t: 'Spelers toevoegen', x: 'Met **Speler toevoegen** zet je er iemand bij; een voornaam en rugnummer is genoeg. Bij een club haalt de clubbeheerder de selectie in één keer uit Sportlink. Leen je een speler van een ander team, dan staat hij onder **Ingeleend**. Speelt er één keer iemand mee? Maak dan een **gastspeler** aan.', b: '07-2', m: ['Ingeleend', 'Gastspeler aanmaken'] },
      { t: 'Het profiel', x: 'Tik op een speler. Onder **Overzicht** staan het aantal wedstrijden, de speeltijd en hoe vaak hij reserve stond, met doelpunten en assists.', b: '07-3', m: ['Overzicht', 'Speeltijd', 'Reserve'] },
      { t: 'Notitie en ontwikkeling', x: 'Daaronder maak je een **notitie**, bijvoorbeeld een afspraak of iets om op te letten, en zie je het ontwikkelprofiel op de vijf onderdelen. Onderaan beoordeel je de speler, bewerk je hem of leen je hem uit.', b: '07-4', m: ['Snel beoordelen', 'Volledige beoordeling', 'Speler bewerken'] },
      { t: 'Leerlijn', x: 'Onder **Leerlijn** leg je per speler leerpunten vast, zoals beter leren kappen of meer coachen. Op de tegel Leerlijn zie je de leerpunten van het hele team bij elkaar.', b: '07-5', m: ['Leerlijn'] },
      { t: 'Historie', x: 'Onder **Historie** zie je hoe een speler zich ontwikkelt: een tijdlijn van zijn beoordelingen, zijn wedstrijden met speeltijd en zijn opkomst bij trainingen. Zo heeft ook een nieuwe trainer meteen een goed beeld.', b: '07-6', m: ['Historie'] },
    ],
    tips: ['Leg geen medische gegevens, adressen of telefoonnummers vast. Dat hoort niet in Cluppie, en de app waarschuwt ervoor.'] },

  { id: '08', slug: 'kalender-documenten-lijstjes', titel: 'Kalender, documenten en lijstjes', kort: 'Het seizoen in één oogopslag en handige lijstjes voor de staf',
    voor: ['coach', 'solo'], apparaat: 'telefoon', plek: 'team:planning', video: '08-kalender-documenten-lijstjes',
    stappen: [
      { t: 'De kalender', x: 'Open **Alles** en tik op **Kalender**. Je ziet het hele seizoen per maand: je wedstrijden, de speeldagen van de competitie, bekerrondes en de vrije weekenden, zoals schoolvakanties en feestdagen.', b: '08-1', m: ['Wedstrijden', 'Speeldagen', 'Vrij'] },
      { t: 'Filteren en een eigen dag', x: 'Met de knoppen bovenaan filter je op wedstrijden, speeldagen, beker of vrij. Heb je zelf iets op de planning, zoals een toernooi of een teamuitje? Voeg het toe met **Eigen dag**.', b: '08-2', m: ['Eigen dag'] },
      { t: 'Documenten', x: 'Onder **Documenten** staat wat de club met je team deelt, zoals het jeugdbeleidsplan of een protocol. Je opent ze in de app. Staat er niets? Dan heeft de club nog geen documenten voor jouw team klaargezet.', b: '08-3' },
      { t: 'Lijstjes', x: 'Onder **Lijstjes** houd je met de staf bij wat je wilt: een toernooi, een kledingbestelling of een rijschema. Tik op **Nieuwe lijst**, geef hem een naam en zet erin wat je nodig hebt. Lijstjes zijn alleen zichtbaar voor de staf van je team.', b: '08-4', m: ['Nieuwe lijst', 'Trainingshulp'] },
      { t: 'Trainingshulp', x: 'Met de lijst **Trainingshulp** vraag je ouders om te helpen bij een training. Je deelt een link in de groepsapp; ouders schrijven zich in met alleen hun voornaam, zonder account.' },
    ] },

  { id: '09', slug: 'teamkamer', titel: 'Teamkamer', kort: 'Ouders en spelers kijken mee, binnen jouw grenzen',
    voor: ['coach', 'solo'], apparaat: 'telefoon', onderdeel: 'teamkamer', plek: 'team:teamkamer', video: '09-teamkamer',
    stappen: [
      { t: 'De teamlink', x: 'Open **Alles** en tik op **Teamkamer**. Onder **Toegang** staat de teamlink. Deel hem in de groepsapp; ouders vragen er zelf toegang mee aan. Wie de link opent, ziet alleen de teamnaam. Je ziet tot wanneer de link geldig is en je kunt altijd een nieuwe maken.', b: '09-1', m: ['Teamlink voor de groepsapp', 'Deel in WhatsApp'] },
      { t: 'Aanvragen goedkeuren', x: 'Een aanvraag keur jij goed. Koppel de ouder aan de juiste speler en tik op **Goedkeuren**. Onder **Wie kijkt mee** zie je per speler wie toegang heeft. Alle toegang stopt vanzelf aan het eind van het seizoen.', b: '09-2', m: ['Aanvragen', 'Goedkeuren', 'Wie kijkt mee'] },
      { t: 'Polls', x: 'Onder **Polls** zet je snel een vraag uit: wie rijdt er zaterdag, wie wast de shirts. Je ziet direct wie wat koos en wie nog niet stemde. Dat laatste zie alleen jij.', b: '09-3', m: ['Polls'] },
      { t: 'Mededelingen', x: 'Onder **Mededelingen** plaats je een kort bericht, bijvoorbeeld dat jullie donderdag op een ander veld trainen. Ouders en spelers kunnen niet reageren. Zet er nooit namen of gezondheid van spelers in.', b: '09-4', m: ['Mededelingen'] },
      { t: "Video's delen", x: "Onder **Video's** deel je een filmpje met ouders en spelers, in een eigen categorie. Ze krijgen er een melding van als ze meldingen aan hebben staan.", b: '09-5', m: ["Video's"] },
      { t: 'Wat ouders zien', x: 'Onder **Instellingen** bepaal je wat ouders en spelers zien: de uitslag, de live stand, de trainingen en de opstelling. Een ouder ziet alleen de cijfers van het eigen kind, nooit een ranglijst. Redenen van afwezigheid, beoordelingen en leerpunten zijn nooit zichtbaar.', b: '09-6', m: ['Uitslag', 'Live stand', 'Trainingen'] },
    ],
    tips: ['Afmelden voor een training of wedstrijd gaat gewoon via de groepsapp; de Teamkamer is om mee te kijken.'] },

  { id: '10', slug: 'club-inrichten', titel: 'Club inrichten', kort: 'Teams, bouwen en mensen: wie doet wat',
    voor: ['admin'], apparaat: 'laptop', plek: 'club:hub', video: '10-clubbeheer-organisatie',
    stappen: [
      { t: 'Open de club', x: 'Klik in het zijmenu op je club. Bovenaan staat wat nog moet gebeuren: eerst **Aan de slag**, daarna **En daarna**. Daaronder staat alles in groepen: Teams & mensen, Voetbal, Communicatie en Sportpark & activiteiten.', b: '10-1', m: ['En daarna', 'Teams & mensen', 'Voetbal'] },
      { t: 'Teams', x: 'Onder **Teams** staan alle teams per bouw, met de spelvorm, de trainer en de trainingstijden. Teams zet je in één keer klaar uit Sportlink, of je maakt ze zelf. Per team nodig je een coach uit met een persoonlijke link.', b: '10-2', m: ['Team', 'Uit Sportlink', 'Onderbouw'] },
      { t: 'Mensen', x: 'Onder **Mensen** staat per rol wie hem heeft en welke nog open is. Hier geef je iemand een rol, keur je aanvragen goed en schrijf je iemand uit. Een trainer komt pas binnen nadat jij hem hebt geaccepteerd.', b: '10-3', m: ['Wie doet wat', 'Aanwijzen'] },
      { t: 'Bouwen', x: 'Onder **Bouwen** zie je welke teams in welke bouw zitten. Cluppie deelt standaard in op leeftijd; je kunt daarvan afwijken. Per bouw voeg je een coördinator toe, die alle teams van de bouw ziet. Je maakt ook eigen bouwen, zoals een meidenbouw of een selectie.', b: '10-4', m: ['Indelen', 'Toevoegen'] },
      { t: 'Rollen', x: 'Een trainingscoördinator ziet de trainingen van alle teams, maar geen spelersnamen. Het hoofd jeugdopleiding maakt het seizoensplan en legt de speelwijze vast. Elke rol krijgt bij de eerste keer een korte uitleg van wat hij wel en niet kan.' },
    ],
    tips: ['Onderdelen als AI, Training maken, de Teamkamer en Speelwijze zet Cluppie per club aan. Dat doe je niet zelf: vraag het aan Cluppie.'] },

  { id: '11', slug: 'opleiding-vastleggen', titel: 'Opleiding vastleggen', kort: "Seizoensplan, speelwijze, trainingen, video's en documenten",
    voor: ['admin', 'hjo'], apparaat: 'laptop', plek: 'club:hub', video: '11-clubbeheer-opleiding',
    stappen: [
      { t: 'Seizoensplan', x: 'Onder **Seizoensplan maken** leg je de lijn voor het seizoen vast: welke thema’s wanneer aan bod komen. Je wijst het plan toe aan een bouw of aan de hele club. De trainingen staan daarna klaar bij alle teams.', b: '11-1', m: ['Nieuw plan', 'Wie maakt het plan'] },
      { t: 'Speelwijze', x: 'Onder **Speelwijze** leg je vast hoe de club wil voetballen. Begin met een stijl als startpunt, of laat een paar mensen een korte vragenlijst invullen. Je ziet waar jullie het eens zijn en waar nog een gesprek nodig is.', b: '11-2', m: ['Onze speelwijze', 'De vier momenten van het spel'] },
      { t: 'Waar de speelwijze terugkomt', x: 'In het seizoensplan komen de thema’s die erbij horen vaker terug. Elke training krijgt een leerdoel, coachwoorden en een regel voor het partijspel. In de wedstrijdevaluatie staat de vraag van dat moment. Elk team ziet alleen de principes voor zijn eigen leeftijd.' },
      { t: 'Trainingen', x: 'Onder **Trainingen** zie je de trainingen van alle teams per week. Heb je eigen trainingen als PDF? Upload ze, ook meerdere tegelijk. Je bepaalt welke teams dezelfde training krijgen en zet ze klaar.', b: '11-3', m: ['PDF-training(en) toevoegen', 'Trainingsgroepen instellen', 'Plannen'] },
      { t: "Video's", x: "Onder **Video's** deel je filmpjes met één of meer teams. Plak een YouTube-link of upload een eigen clip en verdeel ze in groepen. Elke video heeft een eigen voorbeeldplaatje. Met **Uitlichten op het startscherm** zien trainers hem één keer groot bovenaan.", b: '11-4', m: ['YouTube-video toevoegen', 'Eigen video\'s uploaden', 'Categorie'] },
      { t: 'Clubteksten en documenten', x: 'Onder **Clubteksten** pas je de uitleg bij de leerlijn, de tips en de gouden regels aan. Onder **Documenten** upload je een PDF, zoals het jeugdbeleidsplan, en koppel je hem aan de teams die hem nodig hebben.', b: '11-5', m: ['Nieuwe tekst', 'Begin met een kopie van de standaard'] },
    ],
    tips: ['Staat Speelwijze uit voor jullie club, dan zie je de tegel niet en krijgen trainingen geen coachwoorden uit de speelwijze. Cluppie zet dit per club aan of uit.'] },

  { id: '12', slug: 'communicatie', titel: 'Communicatie', kort: 'Berichten, afgelasten en de weekbrief',
    voor: ['admin'], apparaat: 'laptop', plek: 'club:berichten', video: '12-clubbeheer-communicatie',
    stappen: [
      { t: 'Berichten', x: 'Onder **Berichten** plaats je een bericht voor één of meer teams. Coaches zien het als balk zodra ze hun team openen, en krijgen een melding als ze meldingen aan hebben staan. Wegklikken verbergt de balk alleen op hun eigen toestel; het bericht blijft terug te lezen.', b: '12-1', m: ['Nieuw bericht'] },
      { t: 'Training afgelasten', x: 'Valt de training uit, bijvoorbeeld door het weer? Onder **Afgelasten** gelast je de training voor de hele club in één keer af. Alle trainers zien het meteen. Gaat het toch door, dan hef je het net zo makkelijk weer op.', b: '12-2', m: ['Training afgelasten (clubbreed)'] },
      { t: 'Afgelaste wedstrijden', x: 'Wedstrijden die de bond afgelast, staan hier ook. Bij de teams blijft zo’n wedstrijd gewoon in het programma staan, met een streep erdoor en de melding Afgelast.' },
      { t: 'Weekbrief', x: 'De **Weekbrief** geeft elke week een overzicht van de hele club of per bouw: hoeveel teams een aandachtspunt hebben en waar de aanwezigheid nog niet is ingevuld. Alleen aantallen per team, geen namen.', b: '12-3', m: ['teams met aandachtspunt', 'Delen'] },
    ] },

  { id: '13', slug: 'evaluatierondes-inzicht-instellingen', titel: 'Evaluatierondes, inzicht en instellingen', kort: 'Rondes klaarzetten, de club volgen en de club beheren',
    voor: ['admin', 'hjo'], apparaat: 'laptop', plek: 'club:evals', video: '13-clubbeheer-evaluaties-inzicht-instellingen',
    stappen: [
      { t: 'Een evaluatieronde klaarzetten', x: 'Onder **Evaluaties** zet je een ronde klaar, bijvoorbeeld in het najaar en het voorjaar. Je kiest de teams en de startdatum. Coaches zien de ronde bovenaan hun team en beoordelen per speler.', b: '13-1', m: ['Nieuwe evaluatieronde', 'Loopt nu'] },
      { t: 'De ronde volgen', x: 'Jij en de coördinatoren volgen hoe ver elke trainer is. Coördinatoren hebben daarvoor een eigen scherm **Evaluatieronde** bij hun bouw, met de voortgang per trainer, de scores en wat opvalt.', b: '13-2' },
      { t: 'Inzicht', x: 'Onder **Inzicht** zie je het gebruik van de app in de hele club. Klik de eerste keer op **Synchroniseer**. Daarna zie je per team wat er getraind is en waar aandacht nodig is, in aantallen.', b: '13-3', m: ['Synchroniseer', 'Aandacht', 'Evaluaties'] },
      { t: 'Instellingen', x: 'Onder **Instellingen** beheer je de club zelf: het seizoen, het logo en de kleur, de koppeling met Sportlink, toegang en privacy, en de werkwijze en onderdelen. Het logo van de club wordt ook het icoon van de app op de telefoon van je trainers.', b: '13-4', m: ['Identiteit', 'Sportlink', 'Toegang & privacy', 'Nieuw seizoen'] },
      { t: 'Nieuw seizoen', x: 'Met **Nieuw seizoen** begin je opnieuw te tellen; de oude gegevens blijven bewaard. Met **Seizoensovergang** schuif je de spelers in één keer door naar hun nieuwe team. Onder **Bewaartermijnen en opruimen** bepaal je hoe lang gegevens blijven staan.' },
    ] },

  { id: '14', slug: 'coordinatoren-en-laptop', titel: 'Coördinatoren en de laptop', kort: 'Wat elke rol ziet, en Cluppie op een groot scherm',
    voor: ['bouw', 'trainco', 'hjo', 'coach'], apparaat: 'laptop', plek: 'team:hub', video: '14-coordinatoren-en-laptop',
    stappen: [
      { t: 'Het dashboard van je team', x: 'Op de laptop heeft Cluppie meer overzicht. Het dashboard van je team toont de volgende wedstrijd met de opstelling, de speeltijd tot nu toe, de opkomst, de trainingen van de week en wat er nog te doen is.', b: '14-1', m: ['Dashboard', 'Speeltijd tot nu toe', 'Te doen'] },
      { t: 'Het zijmenu en zoeken', x: 'Links kies je een team of de club, en spring je naar elk onderdeel. Met **Ctrl K** zoek je een team, speler of scherm en ga je er direct heen. Linksonder staan Help, de Hulpchat en je instellingen.', b: '14-2' },
      { t: 'Bouwcoördinator', x: 'Als bouwcoördinator open je je bouw in het zijmenu. Het **Dashboard** van de bouw toont de uitslagen, de komende wedstrijden, elk team en de uitleningen in één scherm. In elk team kun je alles wat een coach kan.', b: '14-3', m: ['Deze week op het trainingsveld', 'Komende wedstrijden', 'Nieuwe uitlening'] },
      { t: 'Trainingen en evaluatieronde van de bouw', x: 'Onder **Trainingen** zie je wat de teams van je bouw deze week trainen. Onder **Evaluatieronde** volg je de ronde: de voortgang per trainer, de scores en de inzichten. Onder **Uitleningen** leen je een speler uit aan een ander team.', b: '14-4', m: ['Per dag', 'Per team'] },
      { t: 'Trainingscoördinator', x: 'Als trainingscoördinator zie je de trainingen van alle teams per week. Bij **Weekrooster** zie je per dag wie wanneer traint en welke teams nog een training missen. Je kijkt alleen mee: spelers, wedstrijden en beoordelingen zie je niet.', b: '14-5', m: ['Weekrooster', 'Per team', 'Per dag'] },
      { t: 'Hoofd jeugdopleiding', x: 'Het hoofd jeugdopleiding ziet alle bouwen, legt het seizoensplan en de speelwijze vast, maakt trainingen voor meer teams tegelijk en volgt de evaluatierondes.' },
    ] },

  { id: '15', slug: 'de-wedstrijddag', titel: 'De wedstrijddag', kort: 'Van voorbereiding en opstelling tot wissels en evaluatie',
    voor: ['coach', 'solo'], apparaat: 'telefoon', plek: 'team:wedstrijden', video: '15-de-wedstrijddag',
    stappen: [
      { t: 'De voorbereiding', x: 'Op het startscherm staat je eerstvolgende wedstrijd. Tik op **Voorbereiding**. Je krijgt drie tabbladen: **Tegenstander**, **Praktisch** en **Plan**. Bij Tegenstander zie je hun plek in de poule, hun vorm en hoeveel ze scoren en tegenkrijgen. Alles komt uit Sportlink.', b: '15-1', m: ['Tegenstander', 'Praktisch', 'Plan'] },
      { t: 'Praktisch en plan', x: 'Bij **Praktisch** staan het weer rond de aftrap, de plek, het veld en de kleedkamer. Met één tik deel je dit met de ouders, zonder spelersnamen. Bij **Plan** schrijf je een paar aandachtspunten op en zie je of de opstelling klaarstaat.', b: '15-2', m: ['Waar en wanneer', 'Deel in de groepsapp'] },
      { t: 'Veld en kleedkamer', x: 'Speel je thuis en heeft de club het sportpark op de kaart gezet? Dan staan het veld en de kleedkamer op het startscherm. Tik erop en je ziet op de luchtfoto waar je moet zijn.', b: '15-3', m: ['Veld 3', 'Kleedkamer 3'] },
      { t: 'De opstelling', x: 'Tik op **Opstelling**. Tik een speler aan en daarna zijn plek op het veld, of sleep hem erheen. De bank staat op minste speeltijd, zodat je ziet wie aan de beurt is.', b: '15-4', m: ['3-3-1'] },
      { t: 'Elk kwart klaarzetten', x: 'Je zet elk kwart of elke helft apart klaar, en neemt met één tik de opstelling van de vorige periode over. Onder de spelers zie je stippen: één per eerdere periode, zodat je ziet wie al speelde en wie reserve stond.', b: '15-5', m: ['K1', 'K2', 'K3', 'K4'] },
      { t: 'Het wedstrijdscherm', x: 'Op de wedstrijddag open je de wedstrijd. Bovenaan staan de klok, de periodes en de stand. Start de klok bij de aftrap. Scoort je team? Tik op de plusknop aan jouw kant en kies de maker en de assist.', b: '15-6', m: ['Doelpunt', 'Wissel', 'K1'] },
      { t: 'Wisselen', x: 'Tik eerst wie eruit gaat en dan wie erin komt, of sleep een bankspeler op een veldspeler. Wissels kun je vooraf plannen; je telefoon trilt zodra het moment er is. Alles komt in de tijdlijn met de minuut erbij, en een vergissing maak je ongedaan.', b: '15-7', m: ['Wissels', 'Wissel plannen', 'Tijdlijn'] },
      { t: 'Na afloop', x: 'Na het laatste fluitsignaal maak je het verslag en evalueer je het team in een paar korte vragen. Na een paar wedstrijden zie je onder Evaluatie hoe je team zich ontwikkelt, en stelt Cluppie een trainingsthema voor.', b: '15-8', m: ['Wedstrijdverslag', 'Teamevaluatie bijwerken'] },
    ],
    tips: ['Houd je de wedstrijd bij en heeft de club een kantine-tv? Dan loopt de stand daar live mee.', 'Een goed wedstrijddoel is klein en zichtbaar op het veld. Niet: we moeten winnen. Wel: na balverlies binnen vijf seconden druk zetten.'] },

  { id: '16', slug: 'spelers-beoordelen', titel: 'Spelers beoordelen', kort: 'Eerlijk en eenduidig beoordelen, door de bril van de leeftijd',
    voor: ['coach', 'solo'], apparaat: 'telefoon', onderdeel: 'evaluaties', plek: 'team:spelers', video: '16-spelers-beoordelen',
    stappen: [
      { t: 'Vijf vaste onderdelen', x: 'Cluppie kijkt naar vijf onderdelen: technisch, tactisch, fysiek, mentaal en gedrag en beleving. Elk onderdeel gaat pas aan vanaf de leeftijd waarop een speler eraan toe is. Zo loopt er één lijn van de jongste jeugd tot de oudste.' },
      { t: 'Open de speler', x: 'Open **Alles**, tik op **Overzicht** en kies je speler. Een beoordeling is alleen voor het technisch kader: de trainers van je team en de coördinatoren. Ouders en spelers zien hem nooit. Kijk eerst naar de cijfers bovenaan: speeltijd, reservebeurten en het ontwikkelprofiel tot nu toe.', b: '16-1', m: ['Snel beoordelen', 'Volledige beoordeling'] },
      { t: 'Snel beoordelen', x: 'Met **Snel beoordelen** geef je met één tik per speler een indruk. Dat kan ook voor het hele team achter elkaar, vanaf de spelerslijst.', b: '16-2', m: ['Hoe ging het?', 'Opslaan'] },
      { t: 'Volledige beoordeling', x: 'Bij de **Volledige beoordeling** kies je per onderdeel één van vijf niveaus: aandachtspunt, op weg, prima, sterk of uitblinker. Dat zijn geen losse cijfers maar leerladders: eerst nadoen, dan zelfstandig, en uiteindelijk zelf oplossingen bedenken.', b: '16-3', m: ['Zo beoordelen we', 'Hoort bij'] },
      { t: 'Wat betekent elk niveau?', x: 'Bij elk onderdeel zie je wat je op het veld ziet per niveau. Twijfel je? Tik op het informatie-icoontje voor extra uitleg. Onderaan is ruimte voor een eigen notitie. Alles wordt vanzelf opgeslagen.', b: '16-4', m: ['Kort', 'Verdieping', 'De drie ladders'] },
      { t: 'Een evaluatieronde van de club', x: 'Werkt je club met evaluatierondes? Dan zie je bovenaan je team welke ronde openstaat en voor welke spelers je nog een beoordeling moet maken.' },
    ],
    tips: ['Kijk altijd door de bril van de leeftijd. Scoort een speler van acht of negen op tactisch nog op weg? Dat is heel normaal en geen zwakte.'] },

  { id: '17', slug: 'privacy-en-veiligheid', titel: 'Privacy en veiligheid', kort: 'Hoe Cluppie omgaat met gegevens van kinderen',
    voor: ['allen'], apparaat: 'telefoon', plek: null, video: '17-privacy-en-veiligheid',
    stappen: [
      { t: 'Wie is waarvoor verantwoordelijk?', x: 'De club bepaalt welke gegevens van spelers in Cluppie komen en waarom. Cluppie verwerkt die gegevens alleen in opdracht van de club, met een verwerkersovereenkomst.' },
      { t: 'Zo weinig mogelijk', x: 'Van een speler staat er de voornaam, eventueel de achternaam, het rugnummer en de positie, en verder alleen wat je voor het voetbal nodig hebt: aanwezigheid, speeltijd en beoordelingen. Medische gegevens, adressen, telefoonnummers en foto’s van kinderen horen niet in Cluppie.' },
      { t: 'Wie ziet wat?', x: 'Elke club is afgeschermd. Beoordelingen, aanwezigheid en wedstrijdgegevens zien alleen de trainers van het team, de clubbeheerder en de coördinator van de bouw. Een nieuwe trainer komt alleen binnen met een persoonlijke uitnodiging die verloopt.' },
      { t: 'Ouders en spelers', x: 'Ouders en spelers kijken mee in de Teamkamer, alleen als de trainer die aanzet. Ze zien nooit beoordelingen, leerpunten, notities of de reden van een afmelding. Een ouder ziet alleen de cijfers van het eigen kind. De toegang stopt vanzelf aan het eind van het seizoen.' },
      { t: 'AI', x: 'Gebruikt Cluppie AI, bijvoorbeeld voor de hulpchat? Dan worden namen, e-mailadressen en telefoonnummers eerst automatisch weggehaald. Het gesprek met de hulpchat wordt niet bewaard. De club kan AI ook helemaal uit laten zetten.' },
      { t: 'Je eigen gegevens', x: 'Via het **schild** rechtsboven op het startscherm download je je gegevens, zet je het meten van klikgedrag uit of verwijder je je account. Daar staat ook de privacyverklaring.', b: '17-1' },
    ],
    tips: ['De gegevens staan in Europa, verbindingen zijn versleuteld, en er is geen advertentie-tracking.', 'Vragen over privacy? Mail naar paul@cluppie.io.'] },

  { id: '18', slug: 'activiteiten', titel: 'Activiteiten', kort: 'Een toernooi of open dag organiseren met een draaiboek',
    voor: ['admin'], apparaat: 'laptop', onderdeel: 'activiteiten', plek: 'actie:activiteiten', video: '18-activiteiten',
    stappen: [
      { t: 'Een activiteit beginnen', x: 'Klik op je club en kies **Activiteiten**. Klik op **Nieuwe activiteit** en kies een draaiboek, bijvoorbeeld een toernooi met gastclubs. Geef de activiteit een naam en een datum. Alle taken worden vanaf die datum teruggerekend.', b: '18-1', m: ['Toernooi met gastclubs', 'Leeg beginnen'] },
      { t: 'Het overzicht', x: 'Bovenaan staat hoeveel dagen je nog hebt. Vier lampjes laten zien hoe het draaiboek, de vrijwilligers, het budget en de veiligheid ervoor staan. Daaronder staat wat er deze week moet gebeuren.', b: '18-2', m: ['Draaiboek', 'Vrijwilligers', 'Budget', 'Veiligheid'] },
      { t: 'Het draaiboek', x: 'Onder **Draaiboek** is alles verdeeld in onderwerpen, zoals wedstrijdzaken, kantine en vrijwilligers. Begin bij Datum, plek en comité en voeg de mensen van het comité toe. Geef elk onderwerp een eigenaar.', b: '18-3', m: ['Datum, plek en comité', 'Leesweergave en Word'] },
      { t: 'Taken', x: 'Klik op een onderwerp en je ziet de taken, met de datum waarop ze klaar moeten zijn. Zet een taak op Bezig of Klaar, kies wie hem doet en schrijf er een notitie bij. Mis je iets? Voeg zelf een taak toe.', b: '18-4', m: ['Bezig', 'Klaar'] },
      { t: 'Vrijwilligers', x: 'Bij het onderwerp Vrijwilligers staan de diensten klaar, met de tijden en het aantal mensen. Zet de inschrijflink open en deel hem in de groepsapp. Vrijwilligers schrijven zich in zonder account.', b: '18-5', m: ['Diensten', 'Kopiëren'] },
      { t: 'Na afloop', x: 'Vul bij **Evaluatie** in wat goed ging en wat beter kan. Bewaar de activiteit als draaiboek van de club, dan begin je volgend jaar niet opnieuw. Met de **Leesweergave** download je het draaiboek als Word of PDF.', b: '18-6', m: ['Wat ging goed?'] },
    ],
    tips: ['Organiseer je een toernooi? Zie handleiding 22, Toernooiplanner.'] },

  { id: '19', slug: 'kantine-tv', titel: 'Kantine-tv', kort: 'Het programma, de standen en je sponsoren op de tv',
    voor: ['admin'], apparaat: 'laptop', onderdeel: 'activiteiten', plek: 'actie:tv', video: '19-kantine-tv',
    stappen: [
      { t: 'Open Kantine-tv', x: 'Klik op je club en kies **Kantine-tv**. Links staan de instellingen, rechts het beeld zoals het op de tv komt. Zolang de tv uit staat, zie je proefwedstrijden, zodat je rustig kunt uitproberen.', b: '19-1', m: ['Kantine-tv aanzetten', 'Proefwedstrijden'] },
      { t: 'Kies een sjabloon', x: 'Het sjabloon bepaalt hoe de tv eruitziet: van een rustig tactisch bord tot een echte wedstrijdavond. Klik er een aan en je ziet het meteen. De naam, het logo en de kleur van je club komen er vanzelf in.', b: '19-2', m: ['Wedstrijdavond', 'Tactisch bord'] },
      { t: 'De tv aanzetten', x: 'Klik op **Kantine-tv aanzetten**. Je krijgt een link en een QR-code. Open de link in de browser van de tv. Met de korte link maak je een adres dat je makkelijk overtypt.', b: '19-3', m: ['Link kopiëren', 'Korte link'] },
      { t: 'Wat komt erop?', x: 'Elke wedstrijd van een team van de club staat op de dag zelf vanzelf op de tv, met de tijd, het veld en de kleedkamer. Houdt een trainer de wedstrijd bij, dan loopt de stand live mee en komt een doelpunt groot in beeld.' },
      { t: 'Namen bij doelpunten', x: 'De voornaam van de doelpuntenmaker staat uit, tot je dat zelf aanzet. De tv is openbaar en het gaat vaak om kinderen, dus stem dat af binnen de club.', b: '19-4', m: ['Voornaam van de doelpuntenmaker'] },
      { t: 'Sponsoren en eigen schermen', x: 'Voeg een sponsor toe met naam, logo en pakket. Elke sponsor krijgt een eigen dia en staat in de sponsorbalk. Met een eigen scherm laat je iets anders zien, zoals het kantinemenu. Onder **Wie beheert de tv** geef je de kantinecommissie toegang.', b: '19-5', m: ['Sponsor', 'Eigen scherm'] },
    ] },

  { id: '20', slug: 'sportparken', titel: 'Sportparken', kort: 'Velden en kleedkamers op de luchtfoto',
    voor: ['admin'], apparaat: 'laptop', plek: 'actie:sportparken', video: '20-sportparken',
    stappen: [
      { t: 'Zoek je sportpark', x: 'Klik op je club en kies **Sportparken**. Zoek de eerste keer je sportpark op naam of adres en kies het juiste resultaat. Je krijgt de luchtfoto te zien.', b: '20-1', m: ['Zoek'] },
      { t: 'Velden ophalen en nummeren', x: 'Klik op **Velden ophalen**. Cluppie tekent de velden voor je in. Geef ze daarna een nummer: klik eerst het veld aan dat veld 1 is, dan veld 2, enzovoort. Gebruik dezelfde nummers als in Sportlink.', b: '20-2', m: ['Velden ophalen', 'Nummers aantikken'] },
      { t: 'Bijwerken', x: 'Ligt een veld niet goed? Klik het aan, sleep het, draai het en pas de maat aan. Speelt de jeugd op een half of kwart veld, zet dat dan per veld aan. De helften en kwarten krijgen een eigen naam, zoals 1a en 1b.', b: '20-3', m: ['Half veld', 'Kwart veld'] },
      { t: 'Plekken', x: 'Zet ook de kantine, de kleedkamers, de ingang en het parkeren op de kaart met **Plek toevoegen**. Noem de kleedkamers zoals ze in Sportlink heten. Klik daarna op **Sportpark opslaan**.', b: '20-4', m: ['Plek toevoegen'] },
      { t: 'Wat de trainer ziet', x: 'Bij een thuiswedstrijd staan het veld en de kleedkamer op het startscherm van de trainer. Eén tik, en hij ziet op de luchtfoto waar hij moet zijn. Klopt er iets niet, dan meldt hij dat; die meldingen staan onder het tabblad **Meldingen**.', b: '20-5', m: ['Veld 3', 'Kleedkamer 3'] },
    ] },

  { id: '21', slug: 'veldplanner', titel: 'Veldplanner', kort: 'Trainingen verdelen over velden, tijden en kleedkamers',
    voor: ['admin'], apparaat: 'laptop', onderdeel: 'veldplanner', plek: 'actie:veldplanner', video: '21-veldplanner',
    stappen: [
      { t: 'Open de Veldplanner', x: 'Klik op je club en kies **Veldplanner**. De velden komen uit Sportparken, dus zet eerst je sportpark op de kaart. Bovenaan staan de dagen van de week. Links staan de teams die je nog moet inplannen. Heb je al een rooster in PDF, Word of Excel? Met **Inlezen** zet Cluppie het voor je klaar en loop je het alleen nog na.', b: '21-1', m: ['Maandag', 'Nog in te plannen'] },
      { t: 'Teams inplannen', x: 'Sleep een team naar een veld en een tijd. De jongste teams krijgen een kwart veld, de oudere een half of heel veld. Elk veld heeft vier banen, zodat je precies ziet welk deel bezet is.', b: '21-2', m: ['Controle'] },
      { t: 'Een blok aanpassen', x: 'Klik op een blok. Je kiest de dag, het veld, de tijden, het deel van het veld en de kleedkamer. Je kunt een blok ook verslepen of langer en korter maken. Is een dag klaar en is een andere dag hetzelfde? Met **Dag kopiëren** zet je hem in één keer over. Foutje? Klik op **Ongedaan**.', b: '21-3', m: ['Kleedkamer'] },
      { t: 'De controle', x: 'Rechts waarschuwt Cluppie bij een botsing op het veld, een dubbele kleedkamer, een trainer op twee plekken tegelijk of een jong team dat te laat traint. Vaak staat er een knop bij waarmee je het meteen oplost. Een melding die voor jouw club geen probleem is, zoals een trainer die bewust twee teams tegelijk heeft, klik je weg met **Wegklikken**. Botsingen op het veld blijven altijd staan.' },
      { t: 'De kaart', x: 'Schakel naar **Kaart** en je ziet het sportpark op de luchtfoto, of als getekende kaart als je dat rustiger vindt. Met **Tekenen** zet je er zelf dingen op, zoals het materiaalhok of de AED.', b: '21-4', m: ['Tekenen', 'Kaart'] },
    ],
    tips: ['Het rooster is nu nog een concept: er gaat niets automatisch naar de teams. Je legt hier de puzzel en deelt het rooster voorlopig zelf.'] },

  { id: '22', slug: 'toernooiplanner', titel: 'Toernooiplanner', kort: 'Poules, speelschema, finales en uitslagen voor je toernooi',
    voor: ['admin'], apparaat: 'laptop', onderdeel: 'activiteiten', plek: 'actie:activiteiten', video: null,
    stappen: [
      { t: 'Open het tabblad Toernooi', x: 'Maak onder Activiteiten een activiteit met een toernooi-draaiboek en open het tabblad **Toernooi**. Geef de teams, de velden en de begintijd op.', b: '22-1', m: ['Teams', 'Verenigingen'] },
      { t: 'Een voorstel maken', x: 'Cluppie maakt de poules, de wedstrijden en de finales voor je. Je kiest of er een knock-out volgt en hoe lang een wedstrijd duurt. Het voorstel pas je daarna zelf aan door wedstrijden te verslepen.', b: '22-2', m: ['Schema', 'Opnieuw plannen', 'Proefdraaien'] },
      { t: 'Controle en proefdraaien', x: 'De controlebalk laat zien of het schema klopt: geen team dat dubbel speelt, genoeg rust, geen veld dat dubbel bezet is. Met **Proefdraaien** vult Cluppie proefuitslagen in, zodat je ziet of de finales goed doorlopen.', b: '22-3', m: ['Uit de controle', 'Finales'] },
      { t: 'Op de dag zelf', x: 'Vul de uitslagen in; de stand en de finales werken zich vanzelf bij. Deelnemers volgen het schema op hun telefoon via de live pagina, en op de kantine-tv kies je het toernooi als evenement.', b: '22-4', m: ['Live pagina', 'Link kopiëren', 'Tv-weergave openen'] },
      { t: 'Op papier', x: 'Download het speelschema als PDF, met per team een eigen overzicht, de velden en de kleedkamers.' },
    ],
    tips: ['Met een voorbeeldtoernooi kun je de planner uitproberen zonder iets te delen.'] },
];

/* ---------- hulpjes (ook gebruikt door de tools en de tests) ---------- */
export function gidsMet(id){ return GIDSEN.find(g => g.id === String(id).padStart(2, '0')) || null; }

/* Past bij de rollen van de vrager? 'allen' past altijd; eigenbouw telt als bouw. */
export function gidsVoor(g, rollen){
  const r = new Set((rollen || []).map(x => x === 'eigenbouw' ? 'bouw' : x));
  return g.voor.includes('allen') || g.voor.some(v => r.has(v));
}

/* Platte tekst van een stap, zonder **vet**. */
export const platTekst = s => String(s || '').replace(/\*\*/g, '');

/* Zoekt in titels en stappen. Geeft [{gids, stap (index of -1), score}] terug, beste eerst. */
export function zoekGidsen(vraag, { max = 6 } = {}){
  const woorden = String(vraag || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
  if (!woorden.length) return [];
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const uit = [];
  for (const g of GIDSEN){
    const kop = norm(g.titel + ' ' + g.kort);
    g.stappen.forEach((s, i) => {
      const t = norm(s.t), x = norm(platTekst(s.x) + ' ' + (s.m || []).join(' '));
      let score = 0, raak = 0;
      for (const w of woorden){
        const voor = score, stam = w.length >= 6 ? w.slice(0, -2) : w;   /* uitlenen vindt ook uitleningen */
        if (t.includes(stam)) score += 4; if (x.includes(stam)) score += 2; if (kop.includes(stam)) score += 1; if (score > voor) raak++;
      }
      if (raak === woorden.length && raak > 1) score *= 1.5;   /* alle woorden gevonden weegt zwaarder */
      if (score > 0) uit.push({ gids: g, stap: i, score });
    });
  }
  uit.sort((a, b) => b.score - a.score);
  /* wat ver onder de beste treffer blijft, is ruis */
  return uit.filter(u => u.score >= uit[0].score * 0.6).slice(0, max);
}
const STOP = new Set(['hoe', 'wat', 'waar', 'kan', 'een', 'het', 'voor', 'van', 'met', 'mijn', 'ik', 'doe', 'maak', 'naar', 'als', 'dan', 'die', 'dat', 'zijn', 'wordt', 'moet', 'wil', 'niet', 'wel', 'ook', 'nog', 'bij', 'aan', 'uit', 'der', 'den', 'iets', 'zie', 'vind', 'staat', 'staan', 'werkt', 'dit', 'deze']);
