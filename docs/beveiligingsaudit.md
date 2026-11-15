# Beveiligingsaudit cluppie.io (WP1)

15-11-2026, op `main` (commit 1d44083, release 20261115c). Poort P1: er is nog niets aan de rules gewijzigd.

## Hoe getoetst

- **Firestore-rules in de emulator:** 47 proeven met vaste fictieve accounts per gebruikerstype (club "FC Testdorp", tweede club "SV Elders", los team "Buurtteam O10", spelers "Speler 1"). Elke proef draait op een verse database. Bestand: `tests/audit-rules.test.mjs`, draaien met `npm run audit:rules`. Uitkomst: 29 in orde, 18 afwijkingen.
- **Cloud Functions, geheimen en AI-prompts:** gelezen in de code, niet uitgevoerd.
- **Niet getoetst:** Storage-rules (geen emulatortest), functions van begin tot eind, rolwissels (iemand die een rol verliest), de ondersteuningsmodus (daar bestaan al 4 scenario's voor in `tests/rules.test.mjs`), release 20261114a (staat niet op `main`).

Bij elke bevinding staat het proefnummer, of "gelezen" als het uit de code komt.

## Kritiek

### K1. Elke coach kan het hele teamdocument schrijven, ook `leden` en `club`

De regel `match /teams/{teamId} { match /{sub=**} { allow read, write: if magSchrijven(teamId) } }` is bedoeld voor subcollecties. In rules-versie 2 past `{sub=**}` ook op nul segmenten, dus op het teamdocument zelf. De beperking erboven ("een coach mag `leden`, `club` en `werkwijzeVrij` niet wijzigen") werkt daardoor niet.

Bewezen in de emulator:
- Coach voegt een willekeurig account toe als coach van zijn team, zonder uitnodiging en zonder log (proef 42). Dat account leest daarna alle spelers, beoordelingen en presentie van het team.
- Losse trainer zet zelf `club` op zijn team (proef 35); coach verplaatst zijn clubteam naar een andere club (proef 44).
- Coach zet `werkwijzeVrij` en omzeilt "Club stuurt" (proef 43).

Gevolg op de server (gelezen, niet uitgevoerd): `clubRol` in `functions/index.js` rekent iemand tot coach van een club als hij lid is van een team met dat `club`-veld. Een willekeurig account kan dus:
1. een eigen team maken en er `club: <andere club>` en `sportlinkTeamcode: <code>` op zetten;
2. `sportlinkTeamSpelers` aanroepen. Die gebruikt het Sportlink-ID van die club en de teamcode van het teamdocument, en geeft de voornamen (en achternamen, als de club die vastlegt) van de kinderen in dat Sportlink-team terug. Tien keer per uur.
3. het AI-tegoed van die club gebruiken (`chatHulp`, `structureerTraining`, `genereerVerslagAI`).

Raakt: alle clubs met Sportlink; elk account kan het, ook een losse trainer.

Voorstel:
- Rules: de wildcard minstens één segment laten eisen (`match /{col}/{rest=**}`), en de coach daarnaast `rollen`, `bouw`, `koppelVoorstel` en `sportlinkTeamcode` ontzeggen.
- Server: `clubRol` telt een team alleen mee als het ook in `clubs/{id}.teams` staat; `sportlinkTeamSpelers` neemt de teamcode alleen uit de koppeling die de clubadmin beheert.
- Controle vooraf: welke schermen schrijven nu als coach naar `leden`, `rollen` of `bouw` op het teamdocument (bijvoorbeeld "coach verwijderen")? Die moeten dan via een function.

## Hoog

### H1. Ouder met een deel-link leest notities en leerpunten van alle spelers

De anonieme deel-link (training delen met ouders) mag `teams/{id}/spelers` lezen. Notitie en leerpunten van de coach staan op hetzelfde spelerdocument. De deel-pagina haalt de hele collectie op (`deel-boot.js`), dus die gegevens staan in de browser van elke ouder met de link (proef 1). De ouder leest ook het teamdocument met de namen van de coaches en de vaste afmeldingen (proef 45).

Raakt: coach, losse trainer (ouders van hun teams).

### H2. Elke coach van de club leest notities en leerpunten van alle spelers van de club

Zelfde oorzaak: de spelerslijst is clubbreed leesbaar voor de uitleen-flow, maar het document bevat meer dan naam, nummer en positie (proef 3). Beoordelingen en presentie zijn wel afgeschermd (proef 4).

Voorstel voor H1 en H2 (datamodel, dus impactanalyse en akkoord nodig): notitie en leerpunten naar `teams/{id}/spelers/{sid}/prive/…` of een eigen collectie die alleen het team leest, met een migratie die bestaande velden verplaatst. De deel-pagina leest dan alleen namen. Het teamdocument niet meer leesbaar maken voor de deel-link; wat de pagina nodig heeft (teamnaam) staat al op de deel-link.

### H3. Coach plaatst een training in een andere club

`isTrainingCoach` controleert alleen dat de training precies één team heeft waarvan hij coach is, niet dat het `club`-veld van de training de club van dat team is. Een coach van club A kan een training met `club: B` aanmaken; die verschijnt bij alle coaches van club B (proef 6). Bestaande trainingen van B wijzigen of wissen kan niet.

Voorstel: in `isTrainingCoach` eisen dat `teamClub(team) == d.club` (zoals `isTrainingCoordinator` al doet).

## Middel

| Nr | Bevinding | Proef | Raakt | Voorstel |
|---|---|---|---|---|
| M1 | Elk clublid maakt, wijzigt en verwijdert uitleningen. De interface staat dit alleen admin en coördinator toe. | 12, 13 | Coach | Schrijven beperken tot admin en coördinator van de betrokken bouw (ook eigen bouw). |
| M2 | Coach verwijdert zijn clubteam; zet een medecoach op assistent buiten `wijzigRol` en het log om; verplaatst het team naar een andere bouw. | 7, 8, 9 | Coach | Verwijderen van een clubteam alleen door de admin; `rollen` en `bouw` vallen onder K1. Losse trainer mag zijn eigen team wel verwijderen. |
| M3 | Elk clublid mag de lijst `clubs/{id}.teams` vervangen, ook leegmaken. | 11 | Coach | Alleen het eigen nieuwe team toevoegen. |
| M4 | Gekoppelde coach bouw heeft geen schrijfrechten in de eigen bouw. De interface belooft rechten als een bouwcoördinator; de rules gebruiken `eigenBouwToegang` niet. Faalt dicht. | 15 | Gekoppelde coach bouw | Besluit nodig: rechten echt toekennen via `eigenBouwToegang`, of de belofte uit de interface halen. |
| M5 | Trainingscoördinator leest alle subcollecties van een training, dus ook aantekeningen van coaches. | 22 | Trainingscoördinator | Nagaan welke subcollecties bestaan en of er namen in staan; zo ja, uitsluiten. |
| M6 | Storage-rules zijn nooit getest. Elk clublid mag trainingsbestanden en trainingsvideo's wissen; uploads onder `trainingen/` hebben geen typecontrole; de ondersteuningsmodus werkt niet voor bestanden. | gelezen | Coach, eindbaas | Emulatortest per rol schrijven, daarna aanscherpen. |
| M7 | AI voor losse trainers vraagt geen bevestigd e-mailadres. Met wegwerpaccounts is de limiet per trainer te omzeilen. Staat nu standaard uit. | gelezen | Losse trainer, eindbaas (kosten) | Bevestigd adres eisen en een plafond voor alle losse trainers samen. |

## Laag

| Nr | Bevinding | Proef | Voorstel |
|---|---|---|---|
| L1 | Bouwcoördinator die geen clublid is kan het clubdocument niet lezen. | 20 | Leesregel uitbreiden, of coördinator altijd lid maken. |
| L2 | Losse trainer zet zelf een koppelvoorstel naar een willekeurige club en kan zo een aanvraag bij die clubadmin laten verschijnen. | 36 | Vervalt met K1. |
| L3 | `structureerTraining` haalt e-mail en telefoon uit de PDF-tekst, maar geen spelersnamen (geen namenlijst meegegeven). In `genereerVerslagAI` gaan teamnaam en tegenstander ongefilterd mee. | gelezen | Namenlijst meegeven; teamnaam en tegenstander door dezelfde filter. |
| L4 | Het eindbaas-adres staat hard op vier plekken (rules, `state.js`, `toegang.js`, `platform.js`). | gelezen | Eén bron: `platform/instellingen.beheerders`, het vaste adres als noodtoegang in de rules. |
| L5 | Clubadmin kan `sportlinkClubcode` van zijn club wijzigen (stond al in PORTEREN.md). | gelezen | Alleen functions of eindbaas. |
| L6 | `zetSpelerOver` neemt het dossier over dat de app heeft berekend. Wie op beide teams mag schrijven kan de inhoud bepalen. | gelezen | Dossier op de server opbouwen. |
| L7 | App Check meet alleen (Enforce uit). | PORTEREN.md | Aanzetten na controle van de cijfers. |

## In orde bevonden

- Een coach of clubadmin leest geen spelers, teams of clubdocument van een andere club (proeven 5, 30, 31, 37); een clubadmin kan geen team van een andere club of een los team naar zich toe halen (31, 32).
- De eindbaas leest zonder ondersteuningsmodus geen spelers, ook niet van losse teams (38, 40). Het eindbaas-adres werkt alleen met bevestigd e-mailadres (41). Wel leest hij elk teamdocument met de namen van coaches (39); dat is zo bedoeld.
- Clubadmin kan zijn eigen `platformModules` niet zetten (29). Trainingscoördinator leest geen spelers en schrijft niets (23, 24). Hoofd jeugdopleiding leest geen beoordelingen van teams waar hij geen coach is en wijzigt geen clubinstellingen (27, 28).
- Losse trainer leest geen clubtrainingen of clubdocument en schrijft trainingen onder zijn eigen team (33, 34, 37).
- Geen geheimen in de client (alleen de openbare Firebase-webkey). De Anthropic-sleutel is een Firebase-secret.
- Elke callable controleert de aanroeper. AI-prompts: vrije tekst gaat door de naamfilter, spelers gaan als "Speler N" naar het model, de trainings-AI krijgt geen spelerdata.

## Voorgestelde volgorde van de fixes (na akkoord P1)

1. **K1 en H3** samen: rules plus twee functions, met emulatortests per rol. Geen datamodelwijziging. Vooraf nalopen welke schermen als coach naar het teamdocument schrijven.
2. **M1, M2, M3, L1**: rules, zelfde release als 1 als de schermcontrole meevalt.
3. **H1 en H2**: datamodel (notitie en leerpunten verplaatsen), dus eerst een impactanalyse (P2) en een migratie met terugrolpad.
4. **M4**: jouw besluit.
5. **M5, M6, M7, L3 t/m L6**: daarna, met een Storage-emulatortest.

De proeven uit `tests/audit-rules.test.mjs` worden na elke fix harde tests in `tests/rules.test.mjs`.
