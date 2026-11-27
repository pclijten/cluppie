/* Hoe tools/gidsen-schermen.mjs bij elk schermbeeld komt. Sleutel = `b` van een stap in public/js/gidsen-data.js.
   rol     de demo-rol (index.html?demo=<rol>): coach, los, admin, bouw, trainco, hjo
   laptop  true/false wijkt af van het apparaat van de handleiding
   pad     stappen: ['klik', selector, wacht?] ['js', code] ['vul', selector, tekst] ['rol', selector] ['wacht', ms] ['muis', x, y] ['toets', toets]
   punten  eigen selector voor een label uit `m`, als de tekst alleen niet genoeg is
   vast    true = niet naar het eerste label scrollen
   vp      eigen schermmaat, bijvoorbeeld bij klikken op vaste plekken op de kaart */
const IMP = (mod, code) => ['js', `(async () => { const bron = await (await fetch('js/main.js')).text(); const v = (bron.match(/teams\\.js\\?v=([\\w]+)/) || [])[1]; const m = await import('./js/${mod}.js?v=' + v); ${code} })()`, 900];
const TAB = t => IMP('teams', `m.zetTeamTab('${t}');`);
const TOP = ['js', 'window.scrollTo(0, 0)', 200];
const NAAR = tekst => ['js', `(() => { const eigen = x => [...x.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim(); const e = [...document.querySelectorAll('body *')].find(x => eigen(x) === ${JSON.stringify(tekst)} && x.getClientRects().length); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); })()`, 400];
const EIND = ['js', 'window.scrollTo(0, document.body.scrollHeight)', 400];
const ALLES = ['klik', 'text=Alles', 900];
const CLUB = ['klik', 'text=/^CLUPPIE\\.IO/i', 1500];
const CK = t => ['js', `document.querySelector('#view-club [data-club-open="${t}"]').click()`, 1800];
const BOUW = (scherm = 'dash') => IMP('desktop-bouw', `await m.openBouw('demo-cluppie-io', 'midden', '${scherm}');`);
/* de uitleg "Zo beoordelen we" die de eerste keer over het scherm valt, wegklikken */
const UITLEGWEG = ['js', "(() => { const k = [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && (/^[✕×]$/.test(b.textContent.trim()) || /sluit/i.test(b.getAttribute('aria-label') || ''))).pop(); if (k) k.click(); })()", 700];
const TRAINING = [TAB('trainingen'), ['klik', 'text=Scoren >> nth=0', 1500]];
const SPELER = [TAB('spelers'), ['klik', 'text=Luuk', 1200]];

/* ---- clubbeheer 18 tot 22: activiteiten, kantine-tv, sportpark, veldplanner, toernooi ---- */
const DAG = n => `[data-dkz-dag="${n}"]`;
const ACT = [CLUB, ['klik', '[data-ac-open]', 1500]];
const NIEUW = [...ACT, ['klik', 'text=Nieuwe activiteit'], ['klik', 'text=Toernooi met gastclubs'], ['vul', '[data-kies=naam]', 'Zomertoernooi'], ['klik', 'text=Kies een datum'],
  ...Array(7).fill(['klik', '[data-dkz-maand="1"]', 200]), ['klik', DAG('2027-06-12')], ['klik', '[data-ac=nieuw-maak]', 2000], ['vul', '[data-veld=locatie]', 'Sportpark Cluppie'], ['toets', 'Tab'], ['wacht', 600]];
const ATAB = t => ['klik', `.ac-app >> text=/^${t}/`, 1200];
const ONDERWERP = n => ['klik', `.ac-app button:has-text("${n}") >> nth=0`, 1200];
/* het adres van de proefserver in links vervangen door cluppie.io */
const LINK = ['js', String.raw`(() => { const f = t => t.replace(/https?:\/\/127\.0\.0\.1:\d+/g, 'https://cluppie.io').replace(/127\.0\.0\.1:\d+/g, 'cluppie.io'); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/127\.0\.0\.1/.test(n.nodeValue)) n.nodeValue = f(n.nodeValue); document.querySelectorAll('input,textarea').forEach(e => { if (/127\.0\.0\.1/.test(e.value)) e.value = f(e.value); }); })()`, 200];
const AROL = t => ['js', `(() => { const e = [...document.querySelectorAll('.ac-app h2,.ac-app h3,.ac-app b,.ac-app label,.ac-app p,.ac-app button')].find(x => x.textContent.trim().startsWith(${JSON.stringify(t)})); if (e){ e.style.scrollMarginTop = '80px'; e.scrollIntoView({ block: 'start' }); } })()`, 400];
const TV = [CLUB, ['js', "document.documentElement.classList.remove('demo')", 100], ['klik', '[data-tv-open]', 2500]];
const TVAAN = [...TV, ['klik', 'text=Kantine-tv aanzetten', 3500], LINK];
const PARKWEG = ['js', "window.__cluppieDemo.store.delete('clubs/demo-cluppie-io/sportparken/eigen')", 200];
const PARK = [PARKWEG, CLUB, ['klik', '[data-vk-sportpark]', 2500], ['vul', '[data-vk-zoekvak] input', 'Sportpark Cluppie'], ['klik', '[data-vk-zoekvak] button', 2500]];
const VELDEN = [...PARK, ['klik', '[data-vk-res="0"]', 3500], ['klik', '[data-vk-osm]', 5000], ['muis', 690, 610], ['muis', 520, 559], ['muis', 722, 508], ['muis', 551, 457], ['muis', 412, 488]];
const TEAMIN = ['js', `(() => { const k = document.querySelectorAll('[data-team]')[0]; if (k){ k.focus(); k.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); } })()`, 250];
const VP = [CLUB, ['klik', '[data-vp-open]', 3500], ['klik', '[data-dag="1"]', 800]];
const VPVOL = [...VP, ...Array(16).fill(TEAMIN), ['klik', '[data-dag="1"]', 1500]];
const SUBT = id => ['klik', `[data-tn=sub][data-id=${id}]`, 1200];
const TN = [...NIEUW, ['klik', '.ac-app >> text=/^Toernooi$/', 1500]];
const WIJZIG = ['js', "document.activeElement.dispatchEvent(new Event('change', { bubbles: true })); document.activeElement.blur()", 1200];
const TNTEAMS = [...TN, SUBT('teams'), ['klik', '[data-tn=teams-plak]', 1000], ['vul', '[data-tn-plak]', 'cluppie.io;JO11-1;Poule A\nvv De Meern;JO11-1;Poule A\nSV Houten;JO11-2;Poule A\nKampong;JO11-3;Poule A\ncluppie.io;JO11-2;Poule B\nUSV Hercules;JO11-1;Poule B\nFC Maarssen;JO11-1;Poule B\nDOS Utrecht;JO11-2;Poule B'], ['klik', '[data-tn=teams-plak-lees]', 1500]];
const TNSCHEMA = [...TNTEAMS, SUBT('opzet'), ['klik', '[data-tn=velden-club]', 1200], ['vul', '[data-veld="toernooi.eind"]', '12:00'], WIJZIG, TOP, ['klik', '[data-tn=auto]', 2000], ['klik', '[data-tn=auto-ja]', 2000]];

const GROOT = { width: 1440, height: 900 };

export const OPNAMES = {
  '01-1': { rol: 'coach', vast: true, punten: { 'O11-2': 'text=/^O11-2/ >> nth=0', 'Daarna': 'text=DAARNA' } },
  '01-2': { rol: 'coach', pad: [['rol', 'text=Liever een rondleiding?']] },
  '01-3': { rol: 'coach', pad: [ALLES], vast: true, punten: { 'Trainingen': '.hub-tegel >> text=Trainingen', 'Wedstrijden': '.hub-tegel >> text=Wedstrijden' } },
  '01-4': { rol: 'coach', pad: [TAB('instellingen')] },
  '01-5': { rol: 'coach', pad: [TAB('instellingen'), ['rol', 'text=Weergave']] },

  '02-1': { rol: 'coach', pad: [TAB('trainingen')], vast: true, punten: { '2 nieuw': 'text=2 nieuw >> nth=0', 'Eerder': 'text=EERDER' } },
  '02-2': { rol: 'coach', pad: [...TRAINING], vast: true },
  '02-3': { rol: 'coach', pad: [...TRAINING, NAAR('VANDAAG')], vast: true, punten: { 'Vandaag': 'text=VANDAAG' } },
  '02-4': { rol: 'coach', pad: [...TRAINING, NAAR('VERLOOP')], vast: true, punten: { 'Verloop': 'text=VERLOOP' } },
  '02-5': { rol: 'coach', pad: [...TRAINING, NAAR('Doel')], vast: true },

  '05-1': { rol: 'coach', pad: [TAB('presentietraining')], vast: true },
  '05-2': { rol: 'coach', pad: [TAB('preswedstrijd')], vast: true },
  '05-3': { rol: 'coach', pad: [TAB('preswedstrijd'), NAAR('Max')], vast: true, punten: { 'Erbij': 'text=Erbij >> nth=0' } },
  '05-4': { rol: 'coach', pad: [TAB('stats')], vast: true },
  '05-5': { rol: 'coach', pad: [TAB('stats'), NAAR('Speler')], vast: true },

  '06-1': { rol: 'coach', pad: [TAB('wedstrijden'), ['klik', 'text=4 wedstrijden', 800]], vast: true, punten: { 'Afgelopen': 'text=AFGELOPEN' } },
  '06-2': { rol: 'coach', pad: [TAB('wedstrijden')], vast: true },
  '06-3': { rol: 'coach', pad: [TAB('evaluatie')], vast: true },
  '06-4': { rol: 'coach', pad: [TAB('evaluatie'), NAAR('Onderdelen')], vast: true },
  '06-5': { rol: 'coach', pad: [TAB('poule')], vast: true },

  '07-1': { rol: 'coach', pad: [TAB('spelers')], vast: true },
  '07-2': { rol: 'coach', pad: [TAB('spelers'), NAAR('⇄ Ingeleend')], vast: true },
  '07-3': { rol: 'coach', pad: [...SPELER], vast: true },
  '07-4': { rol: 'coach', pad: [...SPELER, EIND], vast: true },
  '07-5': { rol: 'coach', pad: [...SPELER, ['klik', 'text=Leerlijn', 800]], vast: true },
  '07-6': { rol: 'coach', pad: [...SPELER, ['klik', 'text=Historie', 800]], vast: true },

  '08-1': { rol: 'coach', pad: [TAB('planning')], vast: true },
  '08-2': { rol: 'coach', pad: [TAB('planning'), ['klik', 'text=Eigen dag', 900]], vast: true },
  '08-3': { rol: 'coach', pad: [TAB('documenten')], vast: true },
  '08-4': { rol: 'coach', pad: [TAB('lijstjes')], vast: true, punten: { 'Trainingshulp': 'text=TRAININGSHULP' } },

  '09-1': { rol: 'coach', pad: [TAB('teamkamer')], vast: true },
  '09-2': { rol: 'coach', pad: [TAB('teamkamer'), NAAR('Aanvragen')], vast: true },
  '09-3': { rol: 'coach', pad: [TAB('teamkamer'), ['klik', 'text=Polls', 800]], vast: true },
  '09-4': { rol: 'coach', pad: [TAB('teamkamer'), ['klik', 'text=Mededelingen', 800]], vast: true },
  '09-5': { rol: 'coach', pad: [TAB('teamkamer'), ['klik', "text=Video's", 800]], vast: true },
  '09-6': { rol: 'coach', pad: [TAB('teamkamer'), ['klik', 'text=Instellingen >> nth=-1', 800]], vast: true },
  '03-1': { rol: 'los', pad: [TAB('trainingsmodule')], vast: true },
  '03-2': { rol: 'los', pad: [TAB('trainingsmodule'), NAAR('Weer')], vast: true },
  '03-3': { rol: 'los', pad: [TAB('trainingsmodule'), NAAR('↻ Andere vormen kiezen')], vast: true },
  '03-4': { rol: 'los', pad: [TAB('seizoensplan')], vast: true },

  '04-1': { rol: 'coach', pad: [TAB('speelwijze')], vast: true },
  '04-2': { rol: 'coach', pad: [TAB('speelwijze'), NAAR('De vier momenten van het spel')], vast: true, punten: { 'Wij hebben de bal': 'text=WIJ HEBBEN DE BAL >> nth=0' } },
  '04-3': { rol: 'coach', pad: [ALLES, ['klik', 'text=Tactiek', 1200]], vast: true },
  '04-4': { rol: 'coach', pad: [ALLES, ['klik', 'text=Tactiek', 1200], ['klik', 'text=Nieuw tactiekbord', 1500]], vast: true },

  '15-1': { rol: 'coach', pad: [['klik', 'text=Voorbereiding', 1500]], vast: true },
  '15-2': { rol: 'coach', pad: [['klik', 'text=Voorbereiding', 1500], ['klik', 'text=Praktisch', 2500], NAAR('Waar en wanneer')], vast: true },
  '15-3': { rol: 'coach', pad: [['klik', '.vk-pil', 3500]], vast: true },
  '15-4': { rol: 'coach', pad: [['klik', 'button:has-text("Opstelling"):visible', 2000]], vast: true },
  '15-5': { rol: 'coach', pad: [['klik', 'button:has-text("Opstelling"):visible', 2000], ['klik', 'text=K2 >> nth=0', 1200]], vast: true },
  '15-6': { rol: 'coach', pad: [TAB('wedstrijden'), ['klik', 'text=SV Vleuten O11-2 >> nth=0', 1800]], vast: true },
  '15-7': { rol: 'coach', pad: [TAB('wedstrijden'), ['klik', 'text=SV Vleuten O11-2 >> nth=0', 1800], NAAR('Wissels')], vast: true },
  '15-8': { rol: 'coach', pad: [TAB('wedstrijden'), ['klik', 'text=4 wedstrijden', 800], ['klik', 'text=SV HOUTEN O11-3', 1800], NAAR('Na de wedstrijd')], vast: true },

  '16-1': { rol: 'coach', pad: [...SPELER, EIND], vast: true },
  '16-2': { rol: 'coach', pad: [...SPELER, EIND, ['klik', 'text=Snel beoordelen', 1200], UITLEGWEG], vast: true },
  '16-3': { rol: 'coach', pad: [...SPELER, EIND, ['klik', 'text=Volledige beoordeling', 1500], UITLEGWEG], vast: true },
  '16-4': { rol: 'coach', pad: [...SPELER, EIND, ['klik', 'text=Volledige beoordeling', 1500]], vast: true },

  '17-1': { rol: 'coach', pad: [['klik', '#hubPrivacy', 1200]], vast: true },
  '10-1': { rol: 'admin', pad: [CLUB], vast: true },
  '10-2': { rol: 'admin', pad: [CLUB, CK('teams')], vast: true },
  '10-3': { rol: 'admin', pad: [CLUB, CK('coaches')], vast: true },
  '10-4': { rol: 'admin', pad: [CLUB, CK('bouwen')], vast: true, punten: { 'Indelen': 'button:has-text("Indelen") >> nth=0' } },

  '11-1': { rol: 'admin', pad: [CLUB, CK('jeugdplan')], vast: true },
  '11-2': { rol: 'admin', pad: [CLUB, CK('speelstijl')], vast: true },
  '11-3': { rol: 'admin', pad: [CLUB, CK('trainingen')], vast: true },
  '11-4': { rol: 'admin', pad: [CLUB, CK('videos')], vast: true },
  '11-5': { rol: 'admin', pad: [CLUB, CK('content')], vast: true },

  '12-1': { rol: 'admin', pad: [CLUB, CK('berichten')], vast: true },
  '12-2': { rol: 'admin', pad: [CLUB, CK('afgelasten')], vast: true },
  '12-3': { rol: 'admin', pad: [CLUB, CK('weekbrief'), ['klik', '[data-wb="__club"]', 2500]], vast: true },

  '13-1': { rol: 'admin', pad: [CLUB, CK('evals')], vast: true },
  '13-2': { rol: 'bouw', pad: [BOUW('ev'), ['wacht', 1500]], vast: true },
  '13-3': { rol: 'admin', pad: [CLUB, CK('inzicht')], vast: true, punten: { 'Synchroniseer': 'button:has-text("Synchroniseer")' } },
  '13-4': { rol: 'admin', pad: [CLUB, CK('instel')], vast: true },

  '14-1': { rol: 'coach', pad: [], vast: true },
  '14-2': { rol: 'coach', pad: [['klik', '[data-actie="zoek"]', 900], ['vul', 'input:focus', 'stats']], vast: true },
  '14-3': { rol: 'bouw', pad: [BOUW('dash'), ['wacht', 2500]], vast: true },
  '14-4': { rol: 'bouw', pad: [BOUW('tr'), ['wacht', 2500]], vast: true },
  '14-5': { rol: 'trainco', pad: [['klik', 'text=Weekrooster', 2000]], vast: true },
  '18-1': { rol: 'admin', pad: [...ACT, ['klik', 'text=Nieuwe activiteit', 1200]], vast: true },
  '18-2': { rol: 'admin', pad: [...NIEUW], vast: true },
  '18-3': { rol: 'admin', pad: [...NIEUW, ATAB('Draaiboek')], vast: true },
  '18-4': { rol: 'admin', pad: [...NIEUW, ATAB('Draaiboek'), ONDERWERP('Wedstrijdzaken'), ['klik', 'text=Scheidsrechters regelen', 1200]], vast: true },
  '18-5': { rol: 'admin', pad: [...NIEUW, ATAB('Draaiboek'), ONDERWERP('Vrijwilligers'), ['klik', '[data-ac=deel-aan]', 1800], LINK, AROL('Diensten')], vast: true },
  '18-6': { rol: 'admin', pad: [...NIEUW, ATAB('Evaluatie')], vast: true },

  '19-1': { rol: 'admin', pad: [...TV], vast: true },
  '19-2': { rol: 'admin', pad: [...TVAAN, ['klik', '[data-cs=sjabloon][data-id] >> text=Wedstrijdavond', 3500], AROL('1. Kies een sjabloon'), LINK], vast: true },
  '19-3': { rol: 'admin', pad: [...TVAAN], vast: true },
  '19-4': { rol: 'admin', pad: [...TVAAN, AROL('2. Wat er op komt')], vast: true },
  '19-5': { rol: 'admin', pad: [...TVAAN, ['klik', '[data-cs=nieuw][data-id=sponsor]', 1500], ['vul', '[data-cs-veld$=".titel"]', 'Bakkerij Jansen'], ['toets', 'Tab'], ['wacht', 1500], AROL('3. Sponsoren')], vast: true },

  '20-1': { rol: 'admin', vp: GROOT, pad: [...PARK], vast: true },
  '20-2': { rol: 'admin', vp: GROOT, pad: [...VELDEN], vast: true },
  '20-3': { rol: 'admin', vp: GROOT, pad: [...VELDEN, ['muis', 690, 610], ['klik', '[data-vk-split=half]', 600]], vast: true },
  '20-4': { rol: 'admin', vp: GROOT, pad: [...VELDEN, ['js', "document.querySelector('[data-vk-plek]').scrollIntoView({block:'center'})", 300], ['klik', '[data-vk-plek]', 600], ['klik', '[data-vk-nieuweplek=kantine]', 600], ['muis', 746, 438], ['wacht', 600]], vast: true },
  '20-5': { rol: 'coach', laptop: false, pad: [['klik', '.vk-pil', 3500]], vast: true },

  '21-1': { rol: 'admin', pad: [...VP], vast: true },
  '21-2': { rol: 'admin', pad: [...VPVOL], vast: true },
  '21-3': { rol: 'admin', pad: [...VPVOL, ['klik', '.vp-blok >> nth=1', 1200]], vast: true },
  '21-4': { rol: 'admin', pad: [...VPVOL, ['klik', '[data-weergave=kaart]', 3500]], vast: true },

  '22-1': { rol: 'admin', pad: [...TNTEAMS], vast: true },
  '22-2': { rol: 'admin', pad: [...TNSCHEMA, SUBT('schema')], vast: true },
  '22-3': { rol: 'admin', pad: [...TNSCHEMA, SUBT('schema'), ['klik', '[data-tn=proef] >> nth=0', 2500]], vast: true },
  '22-4': { rol: 'admin', pad: [...TNSCHEMA, SUBT('live'), ['klik', '[data-tn=live-aan]', 2500], LINK], vast: true },
};
