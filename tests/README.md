# Tests

| Opdracht | Wat |
|---|---|
| `npm test` | Pure logica: teamsleutel client = server, aggregeerGebruik, startlijst + stoplicht + clubvergelijking, clubaanmelding, seizoensovergang, kleurcontrast, weekbrief, Sportlink-import. Browsermodules laden via `tests/hulp/stub-loader.mjs` (Firebase vervangen door stubs). |
| `npm run test:rules` | Firestore-rules in de emulator (`tests/rules.test.mjs`). Java nodig; start en stopt de emulator zelf. |
| `NODE_PATH=../functions/node_modules node toegang.test.js` (vanuit `tests/`) | Onboarding-functies tegen een in-memory Firestore-mock. |
| `node tools/pariteit.mjs ../cluppieasv33` | Ontbreekt er iets uit ASV'33? Moet "Gelijk" geven. |
