/* start.js — eerste module van index.html [20261127w]
   ================================================================
   De openbare pagina's (live toernooi, kantine-tv, inschrijven, vrijwilligers, gedeelde training,
   trainingshulp) hebben de coach-app niet nodig. Voorheen laadde main.js eerst de hele app
   (~90 modules, ~1 MB gezipt) en pas daarna de losse pagina. Nu kiest dit bestand eerst: een
   openbare link laadt alleen zijn eigen boot-module, al het andere laadt main.js zoals altijd.
   main.js kent dezelfde takken nog; die blijven als vangnet staan.
   ================================================================ */
import './datum-invoer.js?v=20261021a';

const zoek = new URLSearchParams(location.search);
const PAGINAS = [
  ['deel', () => import('./deel-boot.js?v=20261129h').then(m => m.bootDeelPagina(zoek.get('deel')))],
  ['hulp', () => import('./hulp-boot.js?v=20261118b').then(m => m.bootHulpPagina(zoek.get('hulp')))],
  ['act', () => import('./activiteit-boot.js?v=20261127n').then(m => m.bootActiviteitPagina(zoek.get('act')))],
  ['live', () => import('./live-boot.js?v=20261127x').then(m => m.bootLivePagina(zoek.get('live'), { tv: zoek.get('tv') === '1' }))],
  ['inschrijf', () => import('./inschrijf-boot.js?v=20261127v').then(m => m.bootInschrijfPagina(zoek.get('inschrijf')))],
  ['scherm', () => import('./scherm-boot.js?v=20261127x').then(m => m.bootSchermPagina(zoek.get('scherm')))],
  ['kantine', () => import('./scherm-boot.js?v=20261127x').then(m => m.bootSchermNaam(zoek.get('kantine')))],
  ['taken', () => import('./taken-boot.js?v=20261127v').then(m => m.bootTakenPagina(zoek.get('taken')))],
];
const pagina = PAGINAS.find(([p]) => zoek.get(p));
if (pagina){
  document.getElementById('opstart')?.remove();
  pagina[1]().catch(e => {
    console.error('[Cluppie] pagina laden', e);
    const el = document.getElementById('deel');
    if (el){ el.style.display = 'block'; el.innerHTML = '<div style="padding:40px 20px;text-align:center;font-family:system-ui"><h1>Laden is niet gelukt</h1><p>Controleer je verbinding en ververs de pagina.</p></div>'; }
  });
} else {
  import('./main.js?v=20261129h');
}
