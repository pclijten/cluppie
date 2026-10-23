/* ====================================================================
   ONDERSTEUNINGSMODUS — de eindbaas werkt tijdelijk als clubbeheerder in één club.
   Server: startOndersteuning / stopOndersteuning (functions/toegang.js); het document
   ondersteuning/{uid} = { clubId, start, tot } bepaalt in firestore.rules (ondersteuningActief)
   of de eindbaas in die club mag schrijven. Deze module toont de balk "Je werkt als eindbaas
   in [club]" met een stopknop en de resterende tijd. Bewust een eigen bestand, niet in state.js.
==================================================================== */
import { db, doc, getDoc, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261023a';

const roep = (naam, data) => httpsCallable(functions, naam)(data).then(r => r.data);
let _tot = 0, _clubId = null, _timer = null;

function balk(){
  let b = document.getElementById('ondBalk');
  if (!b){
    b = document.createElement('div');
    b.id = 'ondBalk';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2500;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;'
      + 'padding:calc(6px + env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) 6px max(12px,env(safe-area-inset-left,0px));'
      + 'background:var(--accent);color:#fff;font-size:13px;font-weight:600;line-height:1.3';
    document.body.appendChild(b);
  }
  return b;
}
function verwijderBalk(){
  document.getElementById('ondBalk')?.remove();
  document.body.style.removeProperty('padding-top');
  clearInterval(_timer); _timer = null; _tot = 0; _clubId = null;
}
function teken(){
  const rest = _tot - Date.now();
  if (rest <= 0){ verwijderBalk(); meld('Ondersteuning is verlopen. Start opnieuw vanuit het platform.'); return; }
  const min = Math.ceil(rest / 60000), naam = S.club && S.club.id === _clubId ? S.club.naam : 'deze club';
  const b = balk();
  b.innerHTML = `<span>Je werkt als eindbaas in ${esc(naam || 'deze club')} · nog ${min >= 60 ? Math.floor(min / 60) + ' u ' + (min % 60) + ' min' : min + ' min'}</span>
    <button type="button" id="ondStop" style="background:#fff;color:var(--accent);border:0;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer">Stoppen</button>`;
  document.body.style.paddingTop = (b.offsetHeight || 40) + 'px';
  document.getElementById('ondStop').onclick = () => stopOndersteuning(true);
}
function toon(clubId, tot){
  _clubId = clubId; _tot = tot;
  teken();
  clearInterval(_timer); _timer = setInterval(teken, 30000);
}

/* Start de modus voor een club (server controleert eindbaas en clubinstelling). true = gelukt. */
export async function startOndersteuning(clubId){
  try {
    const r = await roep('startOndersteuning', { clubId });
    toon(r.clubId, r.tot);
    return true;
  } catch (e){
    meld(e.code === 'functions/failed-precondition' ? (e.message || 'Deze club heeft ondersteuning uitgezet.')
      : e.code === 'functions/not-found' ? 'Functie nog niet gedeployed (startOndersteuning)' : 'Starten mislukt: ' + (e.message || e.code));
    return false;
  }
}

export async function stopOndersteuning(terugNaarPlatform){
  try { await roep('stopOndersteuning', {}); } catch (e){ console.warn('[Cluppie] stopOndersteuning', e.code); }
  verwijderBalk();
  meld('Ondersteuning gestopt');
  if (terugNaarPlatform){
    try {
      const c = await import('./club.js?v=20261023a'); c.verlaatClubView();
      const p = await import('./platform.js?v=20261023a'); p.openPlatform();
    } catch (e){}
  }
}

/* Na een herlaad: staat de modus nog aan, dan komt de balk terug. */
export async function herstelBalk(){
  if (!S.user || _tot) return;
  try {
    const sn = await getDoc(doc(db, 'ondersteuning', S.user.uid));
    const d = sn.exists() ? sn.data() : null;
    const tot = d && d.tot && d.tot.toMillis ? d.tot.toMillis() : 0;
    if (tot > Date.now()) toon(d.clubId, tot);
  } catch (e){ /* geen modus of geen rechten: geen balk */ }
}
