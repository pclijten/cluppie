# Cloud Functions — deploy

Datamodel: sluit aan op de app (`teams/{id}` met `club` + `leden{uid}`; `clubs/{id}` met
`naam`, `admins`, `leden`, `bouwCoordinatoren`, `sportlinkClientId`, `instellingen`).
Alle callables vereisen `clubId` in de payload; de server controleert lidmaatschap.

## Functies
| Functie | Rol | Opmerking |
|---|---|---|
| `chatHulp`, `structureerTraining`, `genereerVerslagAI`, `samenvatHotspot` | club-lid | respecteert `instellingen.ai.aan` en `instellingen.ai.maandLimiet` (teller in `clubs/{id}/aiGebruik/{YYYY-MM}`) |
| `personaliseerTraining`, `seizoensVoorstel` | club-lid | AI-uitleg bij Training maken en AI-jaarvoorstel bij Seizoensplanning; zelfde AI-limiet; invoer zonder namen; de app werkt ook zonder (nieuwe callables: invoker `allUsers` openzetten na eerste deploy) |
| `sportlinkSyncNu` | club-admin | callable; leest `clubs/{id}.sportlinkClientId` |
| `syncSportlink` | schema | nachtelijk, alle clubs met `sportlinkClientId` |
| `checkAfgelastingen` | schema | vr–zo elke 30 min (actief vr 16–22, za/zo 7–14): afgelaste wedstrijden markeren |
| `sportlinkClubInfo` | ingelogd | callable; club opzoeken met een Client ID (geen bank-/contactgegevens), max 10/uur |
| `sportlinkTeamSpelers` | coach van het team / beheer | callable; alleen namen van zichtbare spelers uit de teamindeling, max 10/uur |
| `cleanupDeletedItems` | schema | opruimen |

| `sluitAan`, `uitnodigingInfo`, `codeBezet` | coach / (uitnodigingInfo: openbaar) | aansluiten via team- of clubcode; vervangt client-queries op `code==` |
| `maakUitnodiging`, `trekUitnodigingIn`, `beoordeelAanvraag`, `wijzigRol`, `verwijderLid`, `bevestigPrivacy` | club-admin / volledige coach / ingelogd | onboarding en toegang, zie `AVG.md` |
| `exporteerMijnGegevens`, `verwijderMijnAccount` | ingelogd | AVG inzage/wissen, zie `AVG.md` |
| `bewaartermijnen` | schema | dagelijks 03:30, wist oude logins/gebruik/navpaden en verlopen deel-links |

AI-functies pseudonimiseren invoer (`avg.js` → `scrubPII`). Deploy **eerst** deze functies, pas daarna de rules (zie `AVG.md`).

`createClub` en `addClubMember` bestaan niet meer: clubs worden door de platformbeheerder
in de app aangemaakt (Firestore-regels dwingen dat af), leden sluiten aan via code.
Stonden ze al gedeployed? `firebase functions:delete createClub addClubMember --region europe-west1`.

## Eenmalig
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
cd functions && npm install
```
Runtime: Node 22. Deploy per functie, niet in één keer.

| `aggregeerGebruik` | club-admin / coördinator | callable achter de knop Synchroniseer; vult `gebruikstats/{clubId}` (`gebruik.js`) |
| `aggregeerGebruikNacht` | schema | 04:15 NL, alle clubs; daarna platformoverzicht en clubvergelijking |
| `platformOverzichtNu` | platformbeheerder | vult `platformstats/overzicht`, `benchmark/*` (`platform.js`) |
| `verstuurMail` | trigger `mail/{id}` | verstuurt elk nieuw mail-document via SMTP (nodemailer); schrijft `delivery.state`; geheim `SMTP_WACHTWOORD` (`firebase functions:secrets:set SMTP_WACHTWOORD`); instellingen `SMTP_HOST`, `SMTP_PORT`, `SMTP_GEBRUIKER`, `MAIL_VAN` worden bij de deploy gevraagd; geen invoker nodig |
| `meldClubAan` | ingelogd | clubaanmelding → `clubAanmeldingen/{uid}` + mail aan platform (`aanmelding.js`) |
| `beoordeelClubAanmelding` | platformbeheerder | maakt de club aan (aanvrager = clubbeheerder) of wijst af |
| `meldNieuweAanvraag` | trigger `aanvragen/{id}` | mail aan clubbeheerders, max. 1 per club per dag (via `verstuurMail`, collectie `mail`) |

| `analyseerBeleidsplan` | club-admin | zelfde AI-regels; analyseert een beleidsplan-stuk tot content-voorstellen |
