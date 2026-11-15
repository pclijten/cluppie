# Totaalplan cluppie.io: van app tot beheer tot marketing

Status: 15 november 2026 (bijgewerkt). Uitvoeren met het Max-abonnement in Claude Code, in de repo `pclijten/cluppie`. **Besluit Paul: Fable 5.2 doet alles, van begin tot eind.** Fable mag ook zelf toevoegingen voorstellen en bouwen als die de visie van Cluppie aanvullen (zie "Eigen toevoegingen"). Geschrapt en niet in dit plan: ASM, beschikbaarheid/push, ontwikkelingsboom/AI-verslag, krachttraining (Fable stelt deze niet opnieuw voor).

## Hoe je dit start

1. Neem Max en zet usage credits aan met een maandlimiet die je acceptabel vindt. Fable mag maximaal de helft van de weeklimiet gebruiken; daarna draait Fable op usage credits (API-tarief: $8 input / $40 output per miljoen tokens).
2. Update Claude Code naar 2.1.321 of later (nodig voor Fable 5.2).
3. Zet dit bestand in de repo als `docs/totaalplan.md`.
4. Open de repo in Claude Code en kies Fable als model (`/model`, kies Fable 5.2).
5. Plak de **startopdracht uit de bijlage**.

Fable werkt daarna zelfstandig door tot elke **poort**. Daar stopt hij en vraagt jouw akkoord. Een kort "goed" of "top" = door.

## Visie (kompas voor Fable)

Cluppie is dé Nederlandstalige app voor jeugdvoetbalcoaches en clubs: pedagogisch onderbouwd (4Skills, 5 domeinen, 14 leercurvethema's), simpel voor vrijwilligers, sterk op mobiel, privacy-vriendelijk voor jeugddata, en schaalbaar naar 30+ amateurclubs. Elke toevoeging moet coaches tijd besparen of spelers beter laten ontwikkelen, zonder de app ingewikkelder te maken. Cluppie werkt voor **elk type gebruiker**: van de losse trainer zonder club tot een hele club, de clubadmin en de eindbaas.

## Gebruikerstypen (vast toetsingskader)

Elke impactanalyse, mockup, audit en test wordt per gebruikerstype doorlopen. Bestaande rollen (te verifiëren in de code; namen per club soms aanpasbaar):

| Gebruikerstype | Wie | Scope | Kernvraag voor Fable |
|---|---|---|---|
| Losse trainer (individuele coach) | Trainer zonder club in Cluppie | Eigen team(s) | Werkt alles ook zonder club? (bekend gat: Oefenstof leeg, rules eisen een `club`) Hoe stapt hij later over naar een club zonder dataverlies? |
| Coach van een team | Trainer binnen een club | Eigen team | Is het simpel genoeg voor een vrijwilliger met 10 minuten voor de training? |
| Gekoppelde coach bouw | Coach gekoppeld aan een bouw | Eigen bouw | Kloppen de rechten (zelfde als bouwcoördinator)? |
| Bouwcoördinator | Coördinator van een bouw | Eigen bouw; andere teams read-only | Ziet hij precies zijn bouw, niet meer en niet minder? |
| Trainingscoördinator | Overzicht trainingen club | Hele club (trainingen) | Overlapt dit niet verwarrend met andere rollen? |
| Hoofd jeugdopleiding | Rol met per club aanpasbare naam | Alle bouwen | Werkt de aanpasbare naam overal door? |
| Clubadmin | Beheerder van een club | Hele club | Kan hij de club zelfstandig inrichten (teams, bouwen, Sportlink, onderdelen) zonder hulp van Paul? |
| Eindbaas (Paul) | Platformbeheerder | Alle clubs + losse trainers | Heeft Paul overzicht, schakelaars, limieten en ondersteuning via "Meehelpen", zonder spelersnamen te zien? |

Verplicht per gebruikerstype:
- **Beveiliging:** rules en Cloud Functions per rol testen (mag wat moet, mag niet wat niet moet), inclusief rolwissels, een coach in twee teams, een losse trainer die aan een club wordt gekoppeld, en de ondersteuningsmodus van de eindbaas.
- **Applogica:** de belangrijkste stromen per rol doorlopen; tegenstrijdige weergaven tussen rollen opsporen (bijv. twee schermen die allebei "seizoensplan" heten).
- **Design:** per rol controleren dat het startscherm, de navigatie en de lege toestanden kloppen (mobiel 414×896 en desktop).
- **Onboarding:** per rol een eerste-keer-ervaring: losse trainer, nieuwe club (clubadmin), coach die wordt uitgenodigd, en de eindbaas die een club goedkeurt.
- **Marketing:** aparte boodschap voor de losse trainer (instap) en voor de club (bestuur/clubadmin).
- **Testaccounts:** een vaste set fictieve testgebruikers per rol in de emulator/demo, zonder echte kindgegevens.

## Poorten (hier stopt Fable altijd)

- P1: na de beveiligingsaudit, vóór fixes aan de security rules.
- P2: na elke impactanalyse, vóór de mockup.
- P3: na elke mockup, vóór productiecode.
- P4: vóór elke deploy (Functions, rules, hosting) en elke push naar `main`.
- P5: vóór iets dat naar buiten gaat (website live, mail naar clubs, juridische teksten).

## Eigen toevoegingen

Fable mag zelf gaten en verbeteringen signaleren en toevoegingen doen, onder deze voorwaarden:
- Past bij de visie hierboven en de productprincipes van Cluppie.
- Valt niet onder de geschrapte onderdelen.
- Volgt dezelfde route: impactanalyse → mockup → akkoord (P2/P3).
- Kleine fixes zonder UX- of datamodelwijziging (bugs, beveiligingsgaten, toegankelijkheid, foutafhandeling) mag Fable direct oplossen en bundelen in de eerstvolgende release (P4).
- Elke toevoeging komt in `docs/voortgang.md` onder "Eigen toevoegingen", met de reden en de gebruikerstypen die het raakt.

## Werkpakketten (alles door Fable 5.2)

### WP0 — Opruimen
- PORTEREN.md lezen en openstaande punten afwerken.
- Cloud Functions van Node 20 naar een ondersteunde Node-versie.
- AI-functies controleren na het spendlimiet (`structureerTraining`, `chatHulp`).
- Foutafhandeling: 400 niet meer als 503 doorgeven.
- Prompt caching voor de vaste kennisbank van `chatHulp`.
- Rollenkaart opstellen uit de code: welke rollen bestaan echt, waar worden ze opgeslagen en gecontroleerd. Resultaat: `docs/rollenkaart.md`.

### WP1 — Beveiligingsaudit
- Firestore- en Storage-rules doorlichten op lekken tussen clubs, teams en **alle gebruikerstypen** (rollenmatrix: per rol lezen/schrijven per collectie).
- Geheimen aan de clientkant; Anthropic-key alleen als Firebase-secret.
- AVG: geen namen of minderjarigendata in AI-prompts, pushpayloads of exports; eindbaas ziet geen spelersnamen.
- Cloud Functions: invoervalidatie, auth-checks per rol, misbruik van AI-endpoints (ook door losse trainers).
- Resultaat: `docs/beveiligingsaudit.md`, op ernst gesorteerd. **P1.** Daarna fixes, getest in de emulator met testaccounts per rol.

### WP2 — Applogica en kwaliteit
- Doorlichting op logicafouten per view **en per gebruikerstype** (training, wedstrijd, speeltijd, evaluaties, bouwen, uitleningen, seizoensplan, Sportlink-sync).
- Bekend: losse trainer krijgt niets op Oefenstof; dubbele seizoensplannen tussen club en team.
- `teams.js` splitsen (pure refactor, `node --check` per stap).
- Bekende bug: wissel zonder lopende klok.
- Tests voor pure functies; Playwright 414×896 en 1440, per rol.
- Dode code opruimen na controle.

### WP3 — Multi-tenant fundament
- Club-ID-first Firestore, rules, per-club Sportlink client ID, config-laag evaluatiedomeinen, ASV'33 als standaard. **P2.**
- Plek van de losse trainer in het model, en de overstap losse trainer → club.
- Migratieplan met terugrolpad. Bouw in kleine releases (**P4**).

### WP4 — 3D-trainingen en spelvormen
- Uitgangspunt: goedgekeurde mockups (passenoefening: speler A loopt, B passt, bal met boog, stap voor stap, draaibaar veld; spelvormen 4-3-3, 4-4-2, 3-5-2, 4-2-3-1).
- Nieuwe module, geen wijziging in `state.js`, scène-veld met `merge: true`, editor voor coaches. Rechten per rol (wie maakt, wie ziet). **P2/P3.**

### WP5 — Design
- Consistentie dark theme en tokens; toegankelijkheid (contrast, tikdoelen ≥44 px, niet alleen kleur); desktop en mobiel.
- Startscherm, navigatie en lege toestanden per gebruikerstype.

### WP6 — Beheer en onboarding
- Onboarding per gebruikerstype: losse trainer, nieuwe club (clubadmin), uitgenodigde coach, bouwcoördinator.
- Eindbaas-platformcentrum: clubs, losse trainers, schakelaars, limieten, Meehelpen.
- Handleiding en kennisbank per rol.

### WP7 — Juridisch en AVG (concepten)
- Verwerkersovereenkomst (club), voorwaarden voor losse trainers, privacyverklaring, verwerkingsregister, datalekprocedure. **P5** + controle door een jurist.

### WP8 — Marketing en verkoop
- Prijsmodel per type klant (losse trainer, club), landingspagina cluppie.io met aparte instap voor trainer en club, demo-omgeving met fictieve data per rol, verkoopmateriaal, concurrentiepositie (KNVB Rinus, Spond, TeamSnap, Touchline Studio). **P5.**

### WP9 — Uitrol
- Pilot met één club (alle rollen bezet), dan 5, dan 30. Losse trainers parallel. Fable ondersteunt; contact met clubs doet Paul.

## Wat Fable niet vervangt
- Onafhankelijke pentest vóór uitrol naar 30 clubs.
- Juridische eindcontrole (jeugddata).
- Gebruikerstests met echte mensen in elke rol.
- Contact en relaties met clubs.

## Volgorde
WP0 → WP1 → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 → WP8 → WP9. WP7 en WP8 mogen parallel aan WP4/WP5.

## Fable-limiet
Fable gebruikt veel van de weeklimiet. Als de Fable-limiet op is: Fable meldt het en het werk gaat door op usage credits (tot jouw maandlimiet), of pauzeert tot de reset. Fable schakelt niet zelf over naar een ander model.

---

## Bijlage — startopdracht (plakken in Claude Code, model Fable 5.2)

```
Lees eerst PORTEREN.md in de repo en daarna docs/totaalplan.md. Jij (Fable 5.2) voert het totaalplan van begin tot eind uit, werkpakket voor werkpakket in de volgorde die daar staat. Gebruik geen andere modellen.

Doel: cluppie.io naar het hoogste niveau brengen. Spoor zelf gaten op in beveiliging, applogica en design en los ze op. Je mag eigen toevoegingen doen die de visie uit het plan aanvullen, volgens de regels onder "Eigen toevoegingen". Stel geen geschrapte onderdelen opnieuw voor.

Gebruikerstypen zijn een vast toetsingskader: losse trainer, coach, gekoppelde coach bouw, bouwcoördinator, trainingscoördinator, hoofd jeugdopleiding, clubadmin en eindbaas (ik). Begin met een rollenkaart uit de code (docs/rollenkaart.md) en toets elke impactanalyse, mockup, audit en test per gebruikerstype, zoals beschreven in het plan. Gebruik vaste fictieve testaccounts per rol, nooit echte kindgegevens.

Werkwijze: impactanalyse → mockup → mijn akkoord → productiecode. Volg de codeconventies (merge:true, runtime op S in plaats van state.js, tokens --ink/--surface/--accent en color-mix(), root sw.js, UPDATES in teams.js, node --check, Playwright 414×896). Stop altijd bij de poorten P1 t/m P5 en vraag mijn akkoord. Push of deploy nooit zonder akkoord.

Houd een takenlijst bij en werk na elk werkpakket docs/voortgang.md bij: wat af is, wat open staat, eigen toevoegingen met reden en geraakte gebruikerstypen, en het Fable-verbruik als je dat kunt zien. Meld het als de Fable-limiet bijna op is.

Begin met WP0.
```
