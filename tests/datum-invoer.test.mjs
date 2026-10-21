// Datumvelden: tussenjaren worden tegengehouden (public/js/datum-invoer.js).  Draaien: node tests/datum-invoer.test.mjs
import { jaarGeldig } from '../public/js/datum-invoer.js';
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
ok(jaarGeldig('2027-05-15'), 'volledige datum 2027 gaat door');
ok(jaarGeldig(''), 'leeg veld gaat door (wissen moet kunnen)');
ok(jaarGeldig(null) && jaarGeldig(undefined), 'null/undefined gaan door');
ok(!jaarGeldig('0002-05-15'), 'jaar 0002 (eerste cijfer getypt) wordt tegengehouden');
ok(!jaarGeldig('0020-05-15'), 'jaar 0020 wordt tegengehouden');
ok(!jaarGeldig('0202-05-15'), 'jaar 0202 wordt tegengehouden');
ok(jaarGeldig('2026-10-21') && jaarGeldig('1999-01-01') && jaarGeldig('2199-12-31'), 'jaren 1990–2199 zijn geldig');
ok(!jaarGeldig('1989-12-31') && !jaarGeldig('2200-01-01'), 'buiten 1990–2199 wordt tegengehouden');
ok(!jaarGeldig('20270-05-15'), 'vijfcijferig jaar wordt tegengehouden');
