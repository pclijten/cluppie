# WP5 — Design: doorlichting

16-11-2026. **Bijgewerkt:** sinds release 20261116f meet `npm run test:rook` dit automatisch voor zeven rollen op telefoon en laptop (109 schermen). De eerste meting hieronder was met de hand, alleen voor de coach. De actuele lijst met wat nog open staat, staat bovenaan PORTEREN.md.

Eerste meting: in de demo (`index.html?demo`) op 375×812 met aanraakbediening, licht thema.

## Hoe gemeten

Een script in de browser telt per scherm de tikdoelen kleiner dan 44×44 px en de teksten met een contrast onder de WCAG-norm (4,5:1; 3:1 voor grote tekst), en kijkt of het scherm horizontaal schuift.

## Uitkomsten

| Scherm | Horizontaal schuiven | Tikdoelen onder 44 px | Contrast onder de norm |
|---|---|---|---|
| Startscherm (team-hub) | Nee | Privacy 38×38, Uitloggen 38×38, teamnaam 77×28, updates-link 341×42 | "Nog geen afmeldingen" 4,45:1 (13 px, kleur `--warn`) |
| Trainingen | Nee | Terug 38×38, bladerknoppen leerlijn 28×28, open-pijltjes 34×34 | Domeinlabel in de leerlijnkaart 3,89:1 bij 9 px |

Andere schermen zijn niet gemeten: het doorklikken per script lukte niet betrouwbaar en ik heb het niet met de hand afgemaakt.

## Gefixt (release 20261116a)

**Tikdoelen.** De kleine icoonknoppen (terug, privacy, uitloggen, teamnaam, bladeren, openen) krijgen op een aanraakscherm een onzichtbaar raakvlak van minstens 44 px. De opmaak verandert niet. Gecontroleerd in de browser: de knoppen meten nog 38 px, het raakvlak 44 px, en een tik 2 px boven de knop raakt de knop.

## Niet gefixt, met reden

| Bevinding | Waarom niet |
|---|---|
| `--warn` als tekstkleur haalt 4,45:1 in het lichte thema | Het is een token; aanpassen verandert de kleur overal waar hij gebruikt wordt. Voorstel: een aparte token `--warn-ink` voor tekst, donkerder dan `--warn`. Vraagt een blik op alle plekken. |
| Domeinlabel van 9 px | Tekst van 9 px is te klein, los van het contrast. Voorstel: minimaal 11 px. Verandert de kaart, dus eerst bekijken. |
| Donker thema | Niet gemeten. |
| Desktop (1440) | Niet gemeten. |

## Per gebruikerstype: startscherm, navigatie, lege toestanden

Alleen de coach is in de demo te zien. Voor de andere rollen is uit de code af te leiden wat ze te zien krijgen, niet hoe het eruitziet:

| Gebruikerstype | Startscherm volgens de code | Te controleren |
|---|---|---|
| Losse trainer | Team-hub met kaart Eerste stappen; zonder team drie paden (zelf een team, uitnodiging of code, club aanmelden) | Lege toestand van Trainingen als er nog geen training is |
| Coach | Team-hub met Nu-kaart | Gemeten (hierboven) |
| Gekoppelde coach bouw | Team-hub plus bouwoverzicht | Sinds 20261115d werken de schrijfknoppen in de eigen bouw ook echt; nalopen of er nog knoppen staan die niets doen |
| Bouwcoördinator | Bouwoverzicht; andere teams alleen lezen | Of "alleen lezen" overal zichtbaar is (nu worden schrijfacties geweigerd door de rules; de knop hoort er dan niet te staan) |
| Trainingscoördinator | Eigen scherm met trainingen per team | Of het verschil met de bouwcoördinator duidelijk is |
| Hoofd jeugdopleiding | Als coach, met Club › Seizoen en Speelstijl | Of de aanpasbare rolnaam overal doorwerkt (`instellingen.jeugdRolNaam`) |
| Clubadmin | Club-hub met startlijst "Aan de slag" | Lege club: is de eerste stap duidelijk zonder hulp van Paul |
| Eindbaas | Platformcentrum | Geen spelersnamen zichtbaar (in de rules geborgd) |

## Vervolg

1. Demo-data per rol (zie WP8). Daarmee kan dezelfde meting voor alle acht rollen draaien, op 414×896 en 1440, licht en donker.
2. De meting als script in de repo zetten en bij elke release draaien.
3. `--warn-ink` en de minimale tekstgrootte, na een blik van Paul.
