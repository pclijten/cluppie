/* [20261113a] Herstel na een vastgelopen Firestore-client.
   Firestore 10.x kan intern vastlopen ("INTERNAL ASSERTION FAILED: Unexpected state", bekende fout in de
   bibliotheek, o.a. na slaapstand of op iOS na de achtergrond). Daarna mislukt elke lees- en schrijfactie
   tot de pagina opnieuw laadt. We tonen dan één vaste balk met een herlaadknop in plaats van losse
   foutmeldingen. Geen automatisch herladen: dat kan een lus geven. */
export function isFirestoreVastgelopen(e){
  const t = String(e?.message || e?.reason?.message || e || '');
  return /FIRESTORE .*INTERNAL ASSERTION FAILED/i.test(t) || /AsyncQueue is already failed/i.test(t);
}
export function toonHerlaadBalk(){
  if (document.getElementById('fsHerlaad')) return;
  const b = document.createElement('div');
  b.id = 'fsHerlaad';
  b.setAttribute('role', 'alert');
  b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;gap:12px;align-items:center;justify-content:space-between;'
    + 'padding:12px max(16px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));'
    + 'background:var(--surface,#181d24);color:var(--ink,#f5f6f8);border-top:2px solid var(--accent,#e2342f);font-size:14px;line-height:1.4';
  b.innerHTML = '<span>De verbinding met de database is vastgelopen. Herlaad de app om verder te gaan; je gegevens blijven bewaard.</span>'
    + '<button class="knop klein" type="button">Herlaad</button>';
  b.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(b);
}
/* Eén keer bij het laden van de app: vangt de eerste interne fout op. */
export function bewaakFirestore(){
  if (bewaakFirestore._aan) return; bewaakFirestore._aan = true;
  const kijk = e => { if (isFirestoreVastgelopen(e?.reason ?? e?.error ?? e?.message)) toonHerlaadBalk(); };
  window.addEventListener('unhandledrejection', kijk);
  window.addEventListener('error', kijk);
}
