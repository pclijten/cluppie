# Tests

| Opdracht | Wat |
|---|---|
| `npm test` | Pure logica: teamsleutel client = server, aggregeerGebruik, startlijst + stoplicht + clubvergelijking, clubaanmelding, seizoensovergang, kleurcontrast, weekbrief, Sportlink-import. Browsermodules laden via `tests/hulp/stub-loader.mjs` (Firebase vervangen door stubs). |
| `npm run test:rules` | Firestore-rules in de emulator (`tests/rules.test.mjs`). Java nodig; start en stopt de emulator zelf. |
| `node tests/toegang.test.js` (zit in `npm test`) | Onboarding-functies (uitnodigen, aansluiten) tegen een in-memory Firestore-mock. |
| `npm run test:storage` | Storage-rules in de emulator (`tests/storage-rules.test.mjs`). |
| `npm run test:rook` | Rooktest in een echte browser op de demo, elke rol op telefoon en laptop (`tools/rooktest.mjs`; puppeteer-core en Chrome nodig). |
| `node tools/pariteit.mjs ../cluppieasv33` | Ontbreekt er iets uit ASV'33? Moet "Gelijk" geven. |
