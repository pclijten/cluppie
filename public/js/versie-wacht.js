/* [20261126r] Nieuwe versie op de server terwijl de app al open staat.
   Waarom: alle modules hebben een ?v=<versie>, maar de server (GitHub Pages) kijkt niet naar die ?v=.
   Een tabblad of beginscherm-app die al open stond vóór een release, laadt bij de eerstvolgende klik
   een module die nog niet geladen was (bijv. club.js) dus in de NIEUWE versie. Die importeert zelf weer
   state.js met de nieuwe ?v=, en dan draaien er twee losse kopieën van state.js naast elkaar, elk met
   een eigen S. Het nieuwe scherm ziet dan geen team of club en blijft leeg of reageert niet: de app
   "hangt" tot je herlaadt. Bij meerdere releases per dag gebeurt dat vaak.
   Oplossing: de app kijkt bij terugkeer naar het tabblad (en elke tien minuten) of index.html een
   andere versie van main.js noemt. Zo ja: was de app even weg en is er niets open (geen wedstrijd,
   geen venster, niet aan het typen), dan herlaadt hij meteen; anders verschijnt een balk met een
   herlaadknop. Per versie hooguit één automatische herlaadbeurt, zodat er nooit een lus ontstaat. */

const ELKE_MS = 10 * 60 * 1000;          // terwijl de app zichtbaar is
const WEG_MIN_MS = 30 * 1000;            // zo lang weg geweest telt als "terugkomen"
const SLEUTEL = 'cluppieVersieHerladen';

function eigenVersie(){
  const s = document.querySelector('script[src*="main.js?v="]');
  return (s?.getAttribute('src') || '').match(/main\.js\?v=([0-9a-z]+)/)?.[1] || '';
}

async function serverVersie(){
  try {
    const r = await fetch('index.html', { cache: 'no-store' });
    if (!r.ok) return '';
    return (await r.text()).match(/js\/main\.js\?v=([0-9a-z]+)/)?.[1] || '';
  } catch { return ''; }       // offline of trage lijn: niets doen
}

function toonBalk(){
  if (document.getElementById('versieHerlaad')) return;
  const b = document.createElement('div');
  b.id = 'versieHerlaad';
  b.setAttribute('role', 'status');
  b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9998;display:flex;gap:12px;align-items:center;justify-content:space-between;'
    + 'padding:12px max(16px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));'
    + 'background:var(--surface,#181d24);color:var(--ink,#f5f6f8);border-top:2px solid var(--accent,#e2342f);font-size:14px;line-height:1.4';
  b.innerHTML = '<span>Er staat een nieuwe versie van Cluppie klaar. Herlaad om verder te gaan zonder haperingen.</span>'
    + '<button class="knop klein" type="button">Herlaad</button>';
  b.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(b);
}

/* magHerladen(): door main.js meegegeven; true als er niets open staat dat verloren kan gaan. */
export function bewaakVersie(magHerladen = () => false){
  const eigen = eigenVersie();
  if (!eigen || bewaakVersie._aan) return;
  bewaakVersie._aan = true;
  let bezig = false, wegSinds = 0, laatste = Date.now();

  async function kijk(terug){
    if (bezig || document.getElementById('versieHerlaad')) return;
    bezig = true; laatste = Date.now();
    try {
      const nieuw = await serverVersie();
      if (!nieuw || nieuw === eigen) return;
      let al = '';
      try { al = sessionStorage.getItem(SLEUTEL) || ''; } catch {}
      let mag = false;
      try { mag = !!magHerladen(); } catch {}
      if (terug && mag && al !== nieuw){
        try { sessionStorage.setItem(SLEUTEL, nieuw); } catch {}
        location.reload();
        return;
      }
      toonBalk();
    } finally { bezig = false; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ wegSinds = Date.now(); return; }
    const terug = wegSinds && Date.now() - wegSinds >= WEG_MIN_MS;
    wegSinds = 0;
    if (terug || Date.now() - laatste >= ELKE_MS) kijk(terug);
  });
  setInterval(() => { if (!document.hidden && Date.now() - laatste >= ELKE_MS) kijk(false); }, 60 * 1000);
  /* een module die niet (meer) te laden is, is bijna altijd een nieuwe release: meteen kijken */
  window.addEventListener('unhandledrejection', e => {
    const t = String(e?.reason?.message || e?.reason || '');
    if (/dynamically imported module|Importing a module script failed|does not provide an export/i.test(t)) kijk(false);
  });
}
