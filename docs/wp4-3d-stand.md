# WP4 — 3D-trainingen en spelvormen: stand en vervolg

16-11-2026. Analyse; er is in dit werkpakket niets gebouwd.

## Wat er al is (releases 20261115b en 20261115c)

- `scene3d.js`: elke oefening uit de bibliotheek is in 3D te bekijken, stap voor stap (wie loopt, wie passt, waar de bal heen gaat), met Vorige, Afspelen en Volgende en schuifjes voor hoek en draai. De test `tests/scene3d.test.mjs` dekt 299 vormen met 658 stappen.
- In Training maken en in de trainingsweergave kiest de coach per oefening tussen Tekening en 3D.
- De scène wordt afgeleid uit de vorm in de bibliotheek. Er wordt per training niets extra opgeslagen.

## Wat het plan nog vraagt

| Onderdeel | Stand | Opmerking |
|---|---|---|
| Passenoefening stap voor stap, draaibaar veld | Klaar | Bal met boog: nagaan of de boog uit de mockup erin zit; dat heb ik niet in een browser bekeken. |
| Spelvormen 4-3-3, 4-4-2, 3-5-2, 4-2-3-1 | Niet gebouwd | De formaties bestaan als opstellingen (`config.js`), niet als 3D-spelvorm. |
| Editor voor coaches | Niet gebouwd | De grootste post van dit werkpakket. |
| Scène opslaan met `merge: true` | Nog niet nodig | Pas bij de editor. |
| Rechten per rol | Nog niet nodig | Pas bij de editor. |

## Impactanalyse voor de editor

**Wat:** een coach past de 3D-scène van een oefening aan (spelers verplaatsen, een looplijn of pass toevoegen, stappen ordenen) of maakt er zelf een.

**Datamodel (voorstel):** veld `scene` op de oefening binnen de training, opgeslagen met `merge: true`, alleen als de coach iets wijzigt. Zonder `scene` geldt de afgeleide scène uit de bibliotheek. Vorm: `{ versie, veld, spelers:[{id, x, y, rol}], stappen:[{type:'loop'|'pass'|'dribbel', van, naar, boog}] }`. Geen namen van spelers in de scène; alleen rollen als "A" en "B".

**Module:** nieuw bestand `scene3d-editor.js`, los van `state.js`; runtime-toestand op `S`.

**Rechten per rol:**

| Gebruikerstype | Bekijken | Bewerken |
|---|---|---|
| Losse trainer | Eigen trainingen | Eigen trainingen |
| Coach | Trainingen van de club | Eigen trainingen voor het eigen team; bij "Club stuurt" niet, tenzij het team is vrijgegeven |
| Gekoppelde coach bouw, bouwcoördinator | Trainingen van de club | Trainingen voor teams in de eigen bouw |
| Trainingscoördinator | Trainingen van de club | Nee |
| Hoofd jeugd, clubadmin | Alles van de club | Alles van de club |
| Eindbaas | Bibliotheek | De bibliotheek zelf (basisscène per vorm, via Platform › Bibliotheek) |

De rules hoeven hiervoor niet te veranderen: de scène is een veld van de training, en wie een training mag schrijven is al geregeld en getest.

**Risico's:** bediening op een telefoon (slepen op een draaibaar veld is lastig; voorstel: bewerken in bovenaanzicht, bekijken in 3D); omvang van de scène in het trainingsdocument (ruim onder de limiet bij tientallen stappen).

**Volgorde:** eerst een mockup van de editor in bovenaanzicht op 414×896, dan de spelvormen (die hergebruiken de editor: een formatie is een scène met elf rollen).

## Beslissingen voor Paul

1. Editor eerst op de telefoon of eerst op de laptop?
2. Mag een gewone coach een eigen scène maken, of alleen aanpassen wat de bibliotheek biedt?
