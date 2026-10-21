// AI en videogrootte: alleen de eindbaas (functions/onderdelen.js aiVanClub).  Draaien: node tests/ai-platform.test.js
const { aiVanClub } = require('../functions/onderdelen.js');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

ok(aiVanClub({}).aan === false, 'club zonder keuze: AI uit (standaard)');
ok(aiVanClub(null).aan === false, 'geen club: AI uit');
ok(aiVanClub({ instellingen: { ai: { aan: true } } }).aan === false, 'de club zelf kan AI niet aanzetten (instellingen.ai.aan telt niet)');
ok(aiVanClub({ platformModules: { ai: true } }).aan === true, 'eindbaas zet AI aan: aan');
ok(aiVanClub({ platformModules: { ai: false } }).aan === false, 'eindbaas zet AI uit: uit');
ok(aiVanClub({ platformModules: { ai: true }, instellingen: { ai: { aan: false } } }).aan === false, 'oude club-eigen uit-stand blijft gelden');
ok(aiVanClub({ platformModules: { ai: 'ja' } }).aan === false, 'alleen echt true telt');
ok(aiVanClub({ platformModules: { ai: true }, instellingen: { ai: { maandLimiet: 5 } } }).limiet === null, 'limiet van de club zelf telt niet meer');
ok(aiVanClub({ platformModules: { ai: true, aiLimiet: 250 } }).limiet === 250, 'limiet van de eindbaas');
ok(aiVanClub({ platformModules: { ai: true, aiLimiet: 0 } }).limiet === 0, 'limiet 0 = geen aanroepen');
ok(aiVanClub({ platformModules: { ai: true, aiLimiet: null } }).limiet === null, 'null = onbeperkt');
ok(aiVanClub({ platformModules: { ai: true, aiLimiet: '' } }).limiet === null, 'leeg = onbeperkt');
ok(aiVanClub({ platformModules: { ai: true, aiLimiet: -3 } }).limiet === null, 'negatieve limiet wordt genegeerd');
ok(aiVanClub({ platformModules: { ai: true, aiLimiet: 'abc' } }).limiet === null, 'onzin als limiet wordt genegeerd');
