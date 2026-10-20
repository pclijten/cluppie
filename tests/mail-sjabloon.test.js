// Opmaak van uitgaande e-mail (functions/mail-sjabloon.js).  Draaien: node tests/mail-sjabloon.test.js
const { maakMail, esc, veiligeUrl } = require('../functions/mail-sjabloon.js');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

const m = maakMail({
  voorkop: 'Welkom', titel: 'RKVV Voorbeeld staat klaar',
  alineas: ['Hoi Jan,', 'Regel een\nregel twee'],
  stappen: ['Logo kiezen', 'Teams ophalen'],
  gegevens: [['Club', 'RKVV Voorbeeld'], ['Leeg', ''], ['Teams', 14]],
  knop: { tekst: 'Naar Cluppie', url: 'https://www.cluppie.io/' },
  slot: ['Veel plezier!'], voet: 'Kleine regel',
});
ok(typeof m.text === 'string' && typeof m.html === 'string', 'levert tekst én html');
ok(/^<!doctype html>/.test(m.html) && /<html lang="nl"/.test(m.html), 'html is een volledig Nederlands document');
ok(/RKVV Voorbeeld staat klaar/.test(m.html) && /RKVV Voorbeeld staat klaar/.test(m.text), 'titel in beide versies');
ok(/1\. Logo kiezen/.test(m.text) && /2\. Teams ophalen/.test(m.text), 'stappen genummerd in de tekstversie');
ok(/Club: RKVV Voorbeeld/.test(m.text) && /Teams: 14/.test(m.text), 'gegevens als "Label: waarde" in de tekstversie');
ok(!/Leeg:/.test(m.text) && !/>Leeg</.test(m.html), 'lege gegevensregels verdwijnen');
ok(/Naar Cluppie: https:\/\/www\.cluppie\.io\//.test(m.text), 'knop als gewone link in de tekstversie');
ok(/<a href="https:\/\/www\.cluppie\.io\/"[^>]*>Naar Cluppie<\/a>/.test(m.html), 'knop is een link in de html');
ok(/Regel een<br>regel twee/.test(m.html), 'regeleinde in een alinea wordt <br>');
ok(/Kleine regel/.test(m.html) && /Kleine regel/.test(m.text), 'voetregel in beide versies');
ok(!/<script|javascript:/i.test(m.html), 'geen script in de html');

/* veiligheid: invoer van gebruikers (clubnaam, bericht) mag nooit als html doorkomen */
const boos = maakMail({ titel: '<img src=x onerror=alert(1)>', alineas: ['<script>alert(1)</script>'], gegevens: [['Bericht', '"><b>vet</b>']],
  knop: { tekst: '<b>klik</b>', url: 'javascript:alert(1)' } });
ok(!/<script>alert/.test(boos.html) && !/<img src=x/.test(boos.html) && !/"><b>vet/.test(boos.html), 'html in invoer wordt ge-escaped');
ok(!/href="javascript:/i.test(boos.html), 'javascript:-link in de knop wordt geweigerd');
ok(/href="https:\/\/www\.cluppie\.io\/"/.test(boos.html), 'ongeldige knop-url valt terug op de startpagina');
ok(veiligeUrl('http://onveilig.nl') === 'https://www.cluppie.io/', 'alleen https-links toegestaan');
ok(esc('a&b<c>"d') === 'a&amp;b&lt;c&gt;&quot;d', 'esc() vervangt & < > "');

/* minimaal: alleen een titel */
const min = maakMail({ titel: 'Hallo' });
ok(/Hallo/.test(min.text) && /Hallo/.test(min.html), 'werkt met alleen een titel');
ok(min.html.length < 100000, 'html blijft ruim onder de limiet van mail.js (100.000 tekens)');
