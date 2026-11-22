# Openstaande deploys: één route

21-11-2026. In `PORTEREN.md` staan per release losse deploy-opdrachten open, sommige weken oud (Teamkamer, Trainingshulp, Platform › Mails, Clubprofiel, kennisbank van de hulp-chat). Vanuit de werkomgeving van Claude is niet te zien wat er echt live staat, en deployen kan daar niet. Dit document vervangt het zoeken in PORTEREN.md door één route.

> **Bijgewerkt 22-11-2026.** De functions hoeven niet meer via dit script: de workflow `.github/workflows/deploy-functions.yml` deployt ze bij elke push naar `main` die `functions/` raakt, en de laatste run (22-11, na PR #95) zette alle functies op de stand van `main`, inclusief de nieuwe `herkenClub` en `bewaarOpruimen`. Waar de tabel hieronder zegt dat iets niet werkt zonder functions, is dat deel al live. Wat dit script nog echt nodig maakt: de invoker `allUsers` voor nieuwe callables (stap 4) en de rules en indexen (stap 5). Stap 3 doet geen kwaad: het deployt dezelfde code nog een keer.

## De route

Op je pc, in de map Cluppie, op `main` met een schone werkmap:

```
powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1 -Proef
```

Dat toont wat er gaat gebeuren en voert niets uit. Klopt het, dan zonder `-Proef`.

Het script doet, in deze volgorde:

1. `npm test`, daarna `npm run test:rules` en `npm run test:storage` in de emulator. Bij rood stopt het vóór de eerste deploy.
2. Leest uit de code welke functies er horen te zijn (`tools/functies-lijst.mjs`: nu 78, waarvan 59 callables).
3. Deployt alle functions, acht per keer. Een functie waarvan de code niet veranderd is, slaat de Firebase-CLI in de regel over; dat is niet nagegaan voor deze versie van de CLI.
4. Zet voor elke callable de invoker `allUsers` (de functie zelf controleert wie je bent). Zonder dit geeft de app een CORS-fout.
5. Deployt de rules en indexen van Firestore en de rules van Storage.

Functions gaan vóór de rules, zoals `AVG.md` voorschrijft. Er wordt nooit een functie verwijderd. Hosting loopt via GitHub Pages en zit hier niet in.

**De proef (`-Proef`) is op 21-11-2026 op de pc van Paul gedraaid; de echte deploy nog niet.** Losse mappen die niet in git staan zitten niet in de weg; gewijzigde bestanden die git volgt wel. Stopt het halverwege, dan blijft staan wat al gedeployed is en kun je het opnieuw starten.

## Wat dit oplost

| Onderdeel | Wat nu niet werkt zonder deploy | Bron in PORTEREN.md |
|---|---|---|
| Teamkamer (ronde 1, 2 en 2b) | Ouders en spelers kunnen niet binnenkomen; cijfers van het eigen kind zijn voor niemand leesbaar | releases 20261116m, p, r |
| Trainingshulp | Lijstjes › Trainingshulp en de open link worden door de rules geweigerd | release 20261118a |
| Platform › Mails | Het scherm geeft een fout; mails gaan met de oude vaste teksten | release 20261116q |
| Clubprofiel | Documenten inlezen, scans en voorstellen werken alleen als de drie functies live staan; de verbetering van 21-11 (citaat bij de speelwijze) zit in `vulSpeelstijlIn` | releases 20261120c t/m j, 20261121c |
| Hulp-chat | Kent de nieuwste schermen niet (kennisbank in `functions/kennis.js`) | meerdere releases |
| App Check voor callables | Zie `docs/appcheck-afdwingen.md`: de schakelaar staat in de code en gaat pas gelden na een deploy | release 20261121c |
| Kansen in het product | Zonder `herkenClub` ziet een trainer zonder club niet dat zijn club al meedoet; zonder `bewaarOpruimen` meldt het derde blok van het opruimscherm dat het nog niet beschikbaar is; zonder de nieuwe `chatHulp` krijgt de hulpchat de rol van de vrager niet mee en werkt hij niet voor trainers zonder club. Twee nieuwe callables: het script telt ze vanzelf mee en zet de invoker | release 20261122a |

## Daarna nalopen

1. Platform › Mails opent en toont de teksten; stuur jezelf een proefmail.
2. Platform › een proefclub › Onderdelen en limieten: Teamkamer aan, daarna als ouder binnenkomen met een link van de trainer.
3. Lijstjes › Trainingshulp: een lijst maken en de open link in een privévenster openen.
4. Platform › een club › Clubprofiel: één document inlezen en één onderwerp goedkeuren.
5. In de Firebase-console bij Functions: geen functie met een rode status.

Vink daarna in `PORTEREN.md` de blokken af die hiermee klaar zijn, of laat Claude dat doen met de uitvoer van het script.

## Wat het script niet doet

- Geheimen zetten (`ANTHROPIC_API_KEY`, `SMTP_WACHTWOORD`). Vraagt een functie om een instelling die er niet is, dan stopt de deploy met die melding.
- App Check op afdwingen zetten in de console, de tijdelijke database en de oude bucket verwijderen, SPF/DKIM: dat blijft handwerk (zie `docs/voortgang.md`).
- Functies verwijderen die niet meer in de code staan.
