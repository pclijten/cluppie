# Rollenkaart cluppie.io

Opgesteld 15-11-2026 uit de code op `main` (commit 1d44083, release 20261115c). Bronnen: `firestore.rules`, `storage.rules`, `functions/index.js`, `functions/toegang.js`, `functions/overdracht.js`, `functions/platform.js`, en in de client `state.js`, `coordinatoren.js`, `onderdelen.js`, `uitleen-rechten.js`, `seizoensplan-club.js`, `eigen-bouwen.js`, `trainco*.js`, `teams.js`.

Alles hieronder is gelezen uit de code, niet gedraaid in de emulator of tegen echte Firebase. Wat nog bewezen moet worden staat onder "Kandidaat-bevindingen"; dat is de invoer voor WP1.

Let op: de regel over privé-rondebeoordelingen (`beoordelingenPrive`) hoort bij release 20261114a. Die staat alleen in de lokale werkmap van Paul (branch `asv33-14nov`, niet gecommit) en nog niet op `main`.

## 1. Waar een rol vandaan komt

| Gebruikerstype | Rechtenbron (Firestore) | Herkenning in de client | Rol op de server |
|---|---|---|---|
| Losse trainer | `teams/{id}.leden.<uid>` op een team zonder `club` (wel `eigenClub`) | `S.teams` zonder club | geen clubrol; AI via `solo-ai.js` als de eindbaas dat aanzet |
| Coach | `teams/{id}.leden.<uid>` + `clubs/{id}.leden.<uid>`; `rollen.<uid>` = `coach` (ontbreekt = coach, `assistent` is oude data) | `S.teams`, `S.club.leden` | `coach` (`clubRol`) |
| Gekoppelde coach bouw | `clubs/{id}.eigenBouwen[].coaches`, afgeleid `eigenBouwCoaches[]` en `eigenBouwToegang{teamId:{uid}}` | `S.coordinatorBouwen`, `isSturend`, `magUitlenen` | geen eigen rol (telt als `coach` als hij ook lid is) |
| Bouwcoördinator | `clubs/{id}.bouwCoordinatoren.<onder/midden/boven>.<uid>` | `isBouwCoordinator`, `S.coordinatorBouwen` | `coordinator` |
| Trainingscoördinator | `clubs/{id}.trainingscoordinatoren.<uid>` (geen clublid) | `S.traincoClubs`, `?trainco=1` | geen (`clubRol` kent hem niet) |
| Hoofd jeugdopleiding | `clubs/{id}.hoofdJeugd.<uid>` | `rechtenVoor().alles`, `isSturend` | geen eigen rol (telt als `coach` of `coordinator`) |
| Clubadmin | `clubs/{id}.admins.<uid>` | `isClubBeheerder`, `S.clubs` | `club_admin` |
| Eindbaas | e-mail `pclijten@gmail.com` (bevestigd) of `platform/instellingen.beheerders[]` | `isPlatformBeheerder` | `isPlatformBeheerder` / `eindbaasVan` |

Een persoon kan meerdere rollen tegelijk hebben (coach én coördinator, admin én coach). De rollen tellen los van elkaar.

### Aanvulling 16-11-2026 (release 20261116m): ouder en speler

Twee gebruikerstypen erbij, buiten de acht hierboven. Ze staan niet in `teams.leden` of `clubs.leden` en hebben in geen enkele bestaande regel rechten.

| Gebruikerstype | Rechtenbron (Firestore) | Herkenning in de client | Rol op de server |
|---|---|---|---|
| Ouder | `teamkamer/{teamId}/kamerleden/<uid>` met `rol: 'ouder'`, `spelerIds`, `vervaltOp` (alleen door Cloud Functions gemaakt, na goedkeuring door de trainer) | eigen pagina `kamer.html` (`kamer-app.js`), niet de trainersapp | geen clubrol; `lidVan` in `functions/teamkamer.js` |
| Speler | zelfde pad met `rol: 'speler'`, anoniem account, `door: <uid van de ouder>` | `kamer.html` | idem; telt alleen als de eindbaas "Spelers zelf" aan heeft |

Wat ze mogen: lezen van `teamkamer/{teamId}` (hoofddocument, `agenda`, `berichten`, `polls`), het eigen `gezin/{spelerId}`, het eigen `kamerleden`-document en de eigen stem; schrijven van alleen de eigen stem in een open poll. De trainer (zelfde kring als `magSchrijven`) leest alles onder `teamkamer/{teamId}` en schrijft mededelingen en polls, voor zover de eindbaas die mogelijkheid aan heeft (`mag` in het hoofddocument). De kopie zelf, het lidmaatschap en de gezinsdocumenten schrijft alleen de server. Getest in `tests/rules.test.mjs` (zeven scenario's, nog te draaien in de emulator) en `tests/teamkamer.test.mjs`.

## 2. Wat elke rol mag volgens de rules

L = lezen, S = schrijven, – = geen toegang. "eigen" = alleen eigen team of eigen bouw.

| Gegevens | Losse trainer | Coach | Gekoppelde coach bouw | Bouwcoördinator | Trainingscoördinator | Hoofd jeugd | Clubadmin | Eindbaas |
|---|---|---|---|---|---|---|---|---|
| Teamdocument | L/S eigen (niet `leden`, `club`, `werkwijzeVrij`) | L alle clubteams, S eigen (zelfde uitzondering) | als coach | L alle, S eigen bouw (ook `leden`) | L alle clubteams | als coach | L/S alle | L alle teams van alle clubs |
| Team verwijderen | ja, eigen | ja, eigen | als coach | nee | nee | als coach | ja | nee (wel in ondersteuning) |
| Spelers (naam, nummer, positie) | L/S eigen | L hele club, S eigen | als coach | L hele club, S eigen bouw | – | als coach | L/S alle | alleen in ondersteuning |
| Presentie, beoordelingen, evaluaties, lijsten (`teams/{id}/**`) | L/S eigen | L/S eigen | als coach | L/S eigen bouw | – | als coach | L/S alle | alleen in ondersteuning |
| Privé-rondebeoordelingen (`beoordelingenPrive`, nog niet op `main`) | – (vereist club) | S eigen, L eigen | L als hij in `zichtbaarVoor` staat | L als in `zichtbaarVoor` | – | L als in `zichtbaarVoor` | L als in `zichtbaarVoor` | – |
| Clubtrainingen (`trainingen`) | – (eigen onder `teams/{id}/trainingen`) | L club, S voor precies één eigen team | als coach | L club, S voor één team in eigen bouw | L club | L/S alle | L/S alle | L alle, S alleen `oefeningen`, `vormIds`, `bibliotheekBijgewerktMs` |
| Video's | – | L, toevoegen | als coach | als coach | L | als coach | L/S | L/S |
| Documenten, berichten | – | L | L | L | – | L | L/S | L/S |
| Clubdocument | – | L, S alleen `teams` | L | L (als hij ook lid is) | L | L | S alles behalve `platformModules` | L/S |
| Clubseizoensplan | – | L | L | L, S eigen bouw + toewijzen eigen bouw | – | L/S | L/S | – (wel in ondersteuning) |
| Speelstijl (rondes, antwoorden) | – | L uitkomst | L uitkomst | deelnemer | – | L/S | L/S | – |
| Uitleningen | – | L/S | L/S | L/S | – | L/S | L/S | – |
| Sportlink-geheim, AI-verbruik, toegangslog, uitnodigingen, aanvragen | – | uitnodigingen en aanvragen van eigen team | als coach | als coach | – | als coach | L (geheim ook S) | L log/uitnodigingen/aanvragen |
| Gebruikscijfers (`gebruikstats`) | – | – | – | L (via `lezers`) | – | – | L | L |
| Platform: instellingen, bibliotheek, kalenders, platformstats, clubaanmeldingen | L instellingen, bibliotheek, kalenders | idem | idem | idem | idem | idem | idem | L/S (instellingen via function) |
| Bestanden (Storage) | – (alles staat onder `clubs/{id}/`) | L, uploaden video/training, wissen training(svideo) | als coach | als coach | L trainingen en video's | als coach | + documenten en video's wissen | – |

Cloud Functions per rol (kern): uitnodigen en aanvragen beoordelen = clubadmin of volledige coach van dat team; trainingscoördinator uitnodigen, lid verwijderen, team koppelen, privacy-overzicht, beleidsplan-AI = alleen clubadmin; `samenvatHotspot` en `aggregeerGebruik` = admin of bouwcoördinator; speler overzetten = schrijfrecht op beide teams, uitlening afronden = admin of coördinator van de ontvangende bouw; alle `platform*`, `beoordeelClubAanmelding`, `start/stopOndersteuning`, `stelKoppelingVoor`, `leerSamenvattingNu` = alleen eindbaas.

## 3. Lagen bovenop de rol (organisatie, geen beveiliging)

- Eindbaas per club: `platformModules` (Training maken, Seizoensplanning, AI, AI-limiet, video-MB, scouting). De server dwingt AI en de twee onderdelen af (`vereisAI`).
- Club: standaard onderdelen, werkwijze `vrij` of `club`. Bij `club` bouwen alleen sturende rollen (admin, hoofd jeugd, bouwcoördinator, gekoppelde coach bouw) een training of plan, tenzij het team `werkwijzeVrij` heeft. Dit zit alleen in de interface.
- Team: eigen modules.
- Ondersteuningsmodus: de eindbaas is maximaal 2 uur clubadmin in één club (`ondersteuning/{uid}`), gelogd, uit te zetten door de club.

## 4. Kandidaat-bevindingen uit het lezen van de rules

Nog niet bewezen in de emulator. Ik stel voor ze in de beveiligingsaudit van het plan als eerste te toetsen.

1. **Gekoppelde coach bouw heeft in de rules geen extra rechten.** De interface belooft "dezelfde rechten als een bouwcoördinator" en `eigen-bouwen.js` schrijft `eigenBouwToegang` "gelezen door de Firestore-rules", maar `firestore.rules` gebruikt dat veld nergens. Gevolg: knoppen zijn zichtbaar, schrijven op teams van de eigen bouw wordt geweigerd. Faalt dicht, dus geen lek, wel een kapotte rol.
2. **Uitleningen: elk clublid mag aanmaken, wijzigen en verwijderen.** De client beperkt uitlenen tot admin en coördinator; de rules niet.
3. **Coach kan zijn clubteam verwijderen** en op het eigen teamdocument `rollen` en `bouw` wijzigen. Via `rollen` zet hij een medecoach op assistent zonder log (naast `wijzigRol`); via `bouw` bepaalt hij welke coördinator schrijfrecht krijgt.
4. **Elk clublid mag de lijst `clubs/{id}.teams` herschrijven**, ook leegmaken.
5. **(release 20261114a, nog niet op `main`) `beoordelingenPrive.zichtbaarVoor` komt van de client.** De schrijver kan elk uid toevoegen, en de lijst wordt niet bijgewerkt als iemand zijn rol verliest (oud-coördinator blijft lezen).
6. **Storage-rules zijn ongetest.** Verder: elk clublid mag trainingsbestanden en trainingsvideo's wissen; uploads onder `trainingen/` hebben geen typecontrole; de ondersteuningsmodus werkt niet voor bestanden.
7. **Trainingscoördinator leest alle subcollecties van een training** (`trainingen/{id}/**`), dus ook notities en aantekeningen van coaches. Nagaan of daar persoonsgegevens in staan.
8. **Eindbaas leest zonder ondersteuningsmodus elk teamdocument** (namen van coaches in `ledenInfo`, `vasteAfmeldingen`). Bewust zo gebouwd; toetsen aan AVG.md.
9. **Bouwcoördinator die geen clublid is** kan het clubdocument niet lezen (de leesregel kent `bouwCoordinatoren` niet). Coördinatoren worden uit de coaches gekozen, dus meestal geen probleem; wel na "coach verwijderen uit team".
10. **Eindbaas-adres staat hard op vier plekken** (`firestore.rules`, `state.js`, `functions/toegang.js`, `functions/platform.js`).

## 5. Vaste fictieve testaccounts (voorstel, nog niet aangemaakt)

Eén fictieve club "FC Testdorp" (id `test-fc`) met teams O9-1 (onder), O11-1 (midden), O13-1 (boven) en eigen bouw "Meiden" (MO11-1). Spelers heten "Speler 1" t/m "Speler 12"; nooit echte namen. Adressen op `.test`, alleen voor emulator en nep-Firestore.

| Rol | Account | Plek |
|---|---|---|
| Losse trainer | `los@cluppie.test` | eigen team "Buurtteam O10", geen club |
| Coach | `coach@cluppie.test` | O11-1 |
| Gekoppelde coach bouw | `meiden@cluppie.test` | coach MO11-1, gekoppeld aan bouw Meiden |
| Bouwcoördinator | `bouw@cluppie.test` | middenbouw, ook coach O11-1 |
| Trainingscoördinator | `trainco@cluppie.test` | alleen `trainingscoordinatoren` |
| Hoofd jeugdopleiding | `hjo@cluppie.test` | clublid + `hoofdJeugd` |
| Clubadmin | `admin@cluppie.test` | `admins` |
| Eindbaas | `eindbaas@cluppie.test` | in de emulator via `platform/instellingen.beheerders` |

Extra voor tenant-toetsen: `ander@cluppie.test`, admin van een tweede club "SV Elders".
