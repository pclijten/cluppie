# AVG / privacy — Cluppie

Status: technische maatregelen doorgevoerd (okt 2026). **Niet getest** tegen de emulator en niet gedeployed. Juridisch is "AVG-proof" geen toestand van de code alleen; onderaan staat wat Paul/de clubs nog zelf moeten regelen.

## Rollen
- **Club** = verwerkingsverantwoordelijke voor spelergegevens. **Cluppie (Paul)** = verwerker → per club een verwerkersovereenkomst nodig.
- Cluppie is zelf verantwoordelijke voor coach-accounts en gebruiksgegevens.
- Kinderen: bijzondere zorg (overweging 38 AVG). Gezondheid wordt in de app expliciet afgeraden (teams-lijsten.js); technisch niet afgedwongen.

## Wat de code nu doet
| Onderwerp | Maatregel |
|---|---|
| Tenant-isolatie | `clubs`, `teams`, `trainingen`, `videos`, `documenten`, `berichten` alleen leesbaar voor leden van de club. Aansluiten via code loopt via Cloud Function `sluitAan` (niet-leden kunnen teams/clubs niet meer opzoeken); `uitnodigingInfo` toont vóór inloggen alleen team- en clubnaam. |
| Spelerdata | beoordelingen, aanwezigheid, wedstrijden, evaluaties: alleen teamstaf, clubadmin, coördinator van de bouw. Spelerslijst (naam/nummer/positie) ook voor clubleden (nodig voor uitlenen). |
| Dataminimalisatie | `logins` en `gebruikers`: geen naam/e-mail meer. E-mail wordt niet meer in team-/clubdocumenten bewaard (`ledenInfo` = alleen naam). Geen e-mailadres als weergavenaam. Dashboard leest alleen de eigen club (`clubId`-filter + rules), toont geen e-mails. |
| Statistiek | `gebruik`/`navpaden` alleen leesbaar voor beheerders van de eigen club; `logins` alleen voor platformbeheerder. |
| AI | `scrubPII` (functions/avg.js) vervangt namen van spelers/coaches/clubleden, e-mail, telefoon, postcode, lange cijferreeksen vóór elke Anthropic-aanroep (chat, hotspot, verslag, trainings-PDF). Verslag gebruikt alleen labels "Speler n". `instellingen.ai.aan` + `maandLimiet` per club. |
| Rechten van betrokkenen | In-app (schild-icoon): `exporteerMijnGegevens` (inzage/dataportabiliteit) en `verwijderMijnAccount` (wissen; weigert als je enige clubbeheerder bent). |
| Bewaartermijnen | `bewaartermijnen` (dagelijks 03:30): logins/gebruik/navpaden > 400 dagen, verlopen deel-links en toegangsbewijzen > 30 dagen. |
| Externe verbindingen | Lettertypen, ExcelJS en PDF.js zelf gehost (`public/fonts`, `public/vendor`); Google Analytics-ID verwijderd (was nooit geïnitialiseerd). Resterend: Firebase-SDK (gstatic), Open-Meteo (club-locatie), YouTube-miniaturen (alleen bij geplakte links). |
| Opslag | `storage.rules`: bestanden alleen voor clubleden, groottes/typen begrensd, rest dicht. |
| Transparantie | `public/privacy.html` (+ link op loginscherm, schild-knop in de app). |

## Onboarding (okt 2026)
| Onderdeel | Hoe |
|---|---|
| Uitnodigingen | `maakUitnodiging`: willekeurige code (10 tekens, geen 0/O/1/I/L), standaard 14 dagen en 5 keer, intrekbaar (`trekUitnodigingIn`). Link: `?uitn=CODE`. Opgeslagen in `uitnodigingen/`. |
| Aanvraag + goedkeuring | Standaard aan per club (`instellingen.toegang.goedkeuring`). `sluitAan` maakt een aanvraag (`aanvragen/`); een clubbeheerder of volledige coach van het team keurt goed/af (`beoordeelAanvraag`). De wachtende coach ziet "Wacht op goedkeuring". |
| Rollen | Teamrol `rollen[uid]`: `assistent` (alleen lezen: rooster, spelerslijst, poule) of `coach` (volledig). Afgedwongen in de rules (`isVolCoach`). Wijzigen via `wijzigRol`. Ontbrekende rol = coach (oude data). |
| Oude codes | Vaste team-/clubcodes werken nog en lopen óók via goedkeuring; per club uit te zetten (`vasteCodes`). Nieuwe clubs: uit. |
| Toegangslog | `toegangslog/`: aanvraag, aangesloten, goedgekeurd, afgewezen, rol gewijzigd, uitgeschreven, uitnodiging gemaakt/ingetrokken. Alleen lezen voor clubbeheerder. |
| Melding | In-app: melding bij het openen van de club als er aanvragen wachten. Daarnaast een e-mail aan de clubbeheerders (hooguit één per club per dag) via de eigen mailfunctie `verstuurMail` (`functions/mail.js`, SMTP-mailbox van cluppie.io). De mail bevat alleen de naam van de coach en de teamnaam, geen spelersgegevens. |
| Uitgaande mail | [20261116p] Elke mail gaat via `functions/mail-teksten.js` naar `mail/{id}`; de app kan die collectie niet lezen. De platformbeheerder beheert de teksten (Platform › Mails, `platformMails/teksten`, alleen via functies) en ziet 30 dagen wat er is verstuurd, met afgekort adres. Bewaartermijn: `mailOpruimen` wist elke nacht documenten ouder dan 30 dagen; van inlogmails (bevestigen, wachtwoord) wordt de inhoud met de link direct na het versturen gewist. Invulwaarden zijn alleen naam, clubnaam, teamnaam en de reden van een afwijzing; geen spelersgegevens. |
| Misbruik | Rate limiting op `sluitAan` (10 per 10 min per account, 40 per IP) en `uitnodigingInfo` (30 per IP); e-mail moet geverifieerd zijn om aan te sluiten; App Check met reCAPTCHA Enterprise staat aan in `firebase.js` (sinds 2026-10-11, eerst alleen meten; Enforce volgt in de console). |
| Kennisname | Eerste gebruik: privacyafspraken bevestigen (`bevestigPrivacy` → `privacyKennisname/{uid}`, versie `2026-10`). |
| Nieuwe club (wizard) | AI uit, achternamen uit, aanvragen goedkeuren aan, vaste codes uit, privacycontactpersoon + verwerkersovereenkomst vastleggen. Nooit gekopieerd uit een bronclub. |
| Uitschrijven | `verwijderLid` (clubbeheerder), met voorstel voor coaches zonder activiteit in 9 maanden. |

## Speler-overdracht (okt 2026)
- Bij definitief overzetten komt een **bevroren dossier** (wedstrijden, presentie, beoordelingen, leerpunten van die ene speler) onder `teams/{nieuw}/spelers/{id}/vorigeTeams`. Alleen eigen data van de speler; dekking door de bestaande `/{sub=**}`-regel (teamstaf, clubadmin, bouwcoördinator).
- Het origineel bij het oude team blijft **gearchiveerd** bewaard (niet verwijderd) en valt onder dezelfde bewaartermijn als restpunt 3.
- Overzetten kan alleen binnen dezelfde club (tenant-controle in `definitiefOverzetten`).
- Speler verwijderen wist ook `vorigeTeams` van die speler. Het gearchiveerde origineel bij het oude team moet je daar apart verwijderen (verzoek tot wissen: beide kanten doen).
- `scrubPII` leest alle spelersdocumenten van het team, dus ook gearchiveerde namen worden uit AI-invoer gehaald.

## Sportlink-gegevens (okt 2026)
- **Clubgegevens** (`sportlinkClubInfo`): alleen clubnaam, clubcode, plaats, website, logo en tenuekleur. Banknummer, KvK-nummer, naam secretaris, telefoon en e-mail die Sportlink ook teruggeeft, filtert de server weg (`functions/sportlink-hulp.js`, getest).
- **Wedstrijden**: geen scheidsrechternamen (bij de jeugd vaak minderjarig). Wel sportpark, veld, kleedkamer, tijden en het adres van het sportpark.
- **Spelers uit de teamindeling** (`sportlinkTeamSpelers`, release 20261012g): alleen op verzoek van een coach van het team, nooit automatisch of 's nachts. De server geeft alleen de **voornaam** terug, en de achternaam alleen als de club achternamen vastlegt (`instellingen.privacy.achternamen`). Alleen rol "Teamspeler": geen staf. Nooit: lidnummer (relatiecode), geslacht, functie, e-mail, telefoon, foto, einddatum. Leden die in Sportlink **afgeschermd** zijn, worden alleen geteld en nooit overgenomen. De coach kiest zelf wie er in de selectie komt; Cluppie bewaart geen Sportlink-sleutel bij de speler (alleen `bron: 'sportlink'`).

## Teamkamer: ouders en spelers (nov 2026, release 20261116m)
- **Nieuwe betrokkenen:** ouders (account met e-mailadres) en spelers (anoniem account via een code van de ouder; geen e-mail, naam of wachtwoord van het kind). Standaard uit; de eindbaas zet de teamkamer en elke mogelijkheid per club aan.
- **Dataminimalisatie:** ouders en spelers lezen alleen de kopie `teamkamer/{teamId}`, die de Cloud Functions vullen met een vaste lijst van velden. Niet in de kopie: reden van afwezigheid (gezondheid), notities, beoordelingen, leerpunten, achternamen, geboortedata, selectie. Van een ouder bewaren we uid, e-mailadres (alleen leesbaar voor de trainers van het team en de ouder zelf), rol, gekoppelde speler en einddatum. Geen telefoonnummer.
- **Toegang:** via de teamlink plus goedkeuring en koppeling door de trainer; verloopt op 30 juni en bij vertrek van de speler; intrekbaar door trainer, ouder en (voor het kind) de ouder. Gelogd in `toegangslog`.
- **Geen inhoud van ouders of kinderen:** geen chat, vrije tekst of foto's. Een stem op een poll is het enige. Bij een poll met namen zien andere gezinnen de voornaam van het kind; de trainer kan namen uitzetten, de ouder kan het kind verbergen.
- **Kinderen onder 16:** toegang loopt altijd via de ouder (toestemming). Laat een jurist dit en de tekst in `privacy.html` (stuk Teamkamer) beoordelen.
- **Externe verbinding:** weerbericht bij een wedstrijd via Open-Meteo (alleen coördinaten van de club en de datum), alleen als de eindbaas "Weerbericht" aanzet. De WhatsApp-knoppen openen `wa.me` met een tekst; Cluppie stuurt zelf niets naar WhatsApp.
- **Geen AI** op gegevens uit de teamkamer. De eindbaas ziet geen namen (alleen in de ondersteuningsmodus, zoals nu).
- **Bewaartermijn:** verlopen toegang, aanvragen, links en codes verdwijnen elke nacht (`kamerNacht`). Polls, stemmen en mededelingen blijven bij het team tot de trainer ze verwijdert: neem ze mee in de seizoensopruiming (restpunt 3).
- **DPIA:** deze uitbreiding (accounts van ouders, toegang voor minderjarigen) maakt restpunt 2 dringender. Doe de DPIA vóór je de teamkamer bij clubs aanzet.

## Bewuste restpunten (kies/regel zelf)
1. **Verwerkersovereenkomst** per club + verwerkersovereenkomsten/DPA met Google (Firebase DPA; Firestore stond in nam5 en de standaard-bucket in de VS: overstap naar europe-west1 volgens MIGRATIE-EU.md) en Anthropic (DPA + zero-data-retention overwegen; VS-doorgifte via SCC/DPF).
2. **DPIA**: verwerking van gegevens van minderjarigen op schaal (30 clubs) → doe een DPIA vóór uitrol; dit document is de basis. Verwerkingsregister: gebruik de tabel hierboven.
3. **Bewaartermijn spelers**: er is nog geen automatische opruiming van vertrokken spelers/oude seizoenen. Advies: einde seizoen + 1 jaar; bouw een "seizoen archiveren/wissen"-actie voor clubadmins.
4. **Clubadmin kan geen spelerverzoeken afhandelen vanuit de app** (inzage/wissen van één speler): nu handmatig via de speler verwijderen. Doorloop dit met een club als proef.
5. **Vrije tekst met namen** (`door`-velden, trainingsaantekeningen, lijsten) blijft bij de club na accountverwijdering; auteursnaam wordt niet geanonimiseerd.
6. **Spelerslijst clubbreed leesbaar** (voor uitlenen). Strakker kan door uitleningen een kopie van naam/nummer te laten dragen (dan kan `spelers` teamgebonden worden).
7. **Foto's/video's van kinderen**: video-uploads bestaan; toestemming van ouders is de verantwoordelijkheid van de club. Overweeg een waarschuwing bij uploaden.
8. **Beveiliging**: App Check inschakelen (brute-force op teamcodes in `sluitAan`), 2FA voor platform- en clubbeheerders, CSP-header (staat als *Report-Only* in firebase.json), Storage in dezelfde EU-regio.
9. **Datalekprocedure**: afspraak met clubs (informeren zo snel mogelijk; club meldt binnen 72 uur bij AP indien nodig). Zet contactgegevens/KvK in `privacy.html`.
10. **Bestaande data**: documenten zonder `club`-veld (oud) zijn na deze rules alleen voor de platformbeheerder bereikbaar → eenmalig `club` vullen. Zie PORTEREN.md.

## Deploy-volgorde (belangrijk)
**Let op:** de app gebruikt één Firebase-project (`cluppieasv33`) voor alle clubs, dus rules en functions gelden óók voor de live ASV'33-app. Die oude client kent `sluitAan` niet en leest zonder `club`-filter. Breng dezelfde client-wijzigingen eerst naar ASV'33 (of test alles in een apart testproject) vóórdat je de rules uitrolt.

1. `firebase deploy --only functions:sluitAan,functions:uitnodigingInfo,functions:codeBezet,functions:exporteerMijnGegevens,functions:verwijderMijnAccount,functions:bewaartermijnen,...` (eerst functions, anders kan niemand meer aansluiten).
2. `firebase deploy --only firestore:indexes` (inclusief de nieuwe) en wacht tot de indexen klaar zijn (club+teams-queries).
3. Hosting (nieuwe client).
4. **Als laatste** `firestore:rules` en `storage`. Test eerst in de emulator met een tweede testclub: coach A mag niets van club B lezen.

## Trainingshulp: ouders schrijven zich in als helper (nov 2026, release 20261118a)
- **Wat het is:** een lijst in Lijstjes waarop ouders zich per training inschrijven als helper. De trainer kiest per lijst de route: in de teamkamer (ouders met toegang), via een open link (zonder account), of allebei. De teamkamer-route staat standaard uit; de eindbaas zet hem per club aan (`teamkamerOpties.hulp`).
- **Dataminimalisatie:** een aanmelding is `{ uid, rij, naam, ms, door }`: een zelf ingevulde voornaam (maximaal 24 tekens), de training en het moment. Geen achternaam, e-mailadres of telefoonnummer, en geen verwijzing naar het kind. De trainer ziet "ouder van" door de kamerleden van het eigen team te lezen; dat staat niet in de aanmelding. De rules weigeren elk extra veld.
- **Wie leest wat:** de staf van het team (dezelfde kring als de lijstjes: `magSchrijven`) altijd. Ouders en spelers in de teamkamer van dat team als de lijst daarvoor aan staat. Iedereen met de link als de open link aan staat. Via de open link is niets van het team te lezen, ook de teamnaam niet buiten dit ene document.
- **Open link:** wie de link heeft kan elke voornaam invullen; er is geen controle dat het een ouder van het team is. De trainer haalt een aanmelding weg en zet de link uit (ook bij archiveren gaat alles uit).
- **Minderjarigen:** een speler in de teamkamer leest wie er helpt, maar kan zich niet inschrijven.
- **Bewaartermijn (open punt):** een lijst en de aanmeldingen blijven staan tot de trainer de lijst verwijdert. Er is nog geen automatische opruiming; kandidaat: meenemen in `bewaartermijnen` (lijsten van een vorig seizoen). Meenemen in de DPIA en de jurist-check van `privacy.html` (stuk Teamkamer, "Helpen bij de training").
