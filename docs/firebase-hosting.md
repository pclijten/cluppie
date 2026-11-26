# Overstap van GitHub Pages naar Firebase Hosting

**Waarom.** GitHub Pages is niet bedoeld voor een commerciële app, heeft een zachte grens van 100 GB verkeer per
maand en negeert onze cache-instellingen. Firebase Hosting (project `cluppie-ad329`) heeft een wereldwijd CDN,
brotli-compressie en de headers uit `firebase.json`.

**Hoe het nu staat (27-11-2026).**
- Elke push naar `main` die `public/` of `firebase.json` raakt, publiceert de site via
  `.github/workflows/deploy-hosting.yml` op **https://cluppie-ad329.web.app**. GitHub Pages blijft tegelijk draaien.
- `www.cluppie.io` wijst in de DNS nog naar GitHub Pages. Pas na stap 2 hieronder gaat het verkeer naar Firebase.
- `firebase.json` doet hetzelfde als Pages: geen catch-all naar index.html, onbekende adressen krijgen `404.html`
  (die stuurt `/tv/<naam>` door naar `/?kantine=<naam>`). `X-Frame-Options` is `SAMEORIGIN`, omdat het
  tv-ontwerpscherm de tv-pagina in een iframe van de eigen site toont.
- Cache: `index.html`, alle `.html`, `sw.js` en de manifesten altijd vers; app-modules en css 10 minuten (zoals Pages);
  `vendor/` en de lettertypen een jaar.

## Stappen voor Paul

1. **Testen op het tweede adres.** Open https://cluppie-ad329.web.app/index.html?x en log in. Werkt Google-inloggen
   daar niet, voeg dan in de Firebase-console › Authentication › Settings › Authorized domains `cluppie-ad329.web.app`
   toe (meestal staat hij er al).
2. **Domein koppelen.** Firebase-console › Hosting › *Add custom domain* › `www.cluppie.io`. Firebase toont een
   TXT-record (eigendom) en daarna de A-records. Zet die bij je domeinprovider in plaats van het huidige
   CNAME-record `www → pclijten.github.io`. Doe hetzelfde voor `cluppie.io` en kies daar *Redirect to www.cluppie.io*.
3. **Wachten op het certificaat.** Firebase maakt zelf een HTTPS-certificaat; dat duurt meestal minder dan een uur,
   soms tot 24 uur. In die tijd kan de site even een certificaatmelding geven.
4. **GitHub Pages uitzetten** zodra www.cluppie.io via Firebase komt (controle: `curl -sI https://www.cluppie.io`
   toont `x-served-by` *niet* meer met `cache-...` van GitHub, of de Firebase-console meldt "Connected"):
   repo › Settings › Pages › custom domain leegmaken en de workflow `pages.yml` uitzetten of verwijderen.

**Terug naar GitHub Pages** kan altijd: zet het CNAME-record weer op `pclijten.github.io`.
