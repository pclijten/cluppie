/* ==================== OEFENVORM IN 3D (TRAINING MAKEN) ====================
   [20261115b] Elke oefenvorm uit de bibliotheek kan als geanimeerd 3D-veld worden bekeken,
   stap voor stap zoals in de goedgekeurde mockup "Passen en lopen (3D)":
   Vorige · Afspelen/Pauze · Volgende · Opnieuw, de tekst van de stap, een voortgangsbalk,
   en schuifjes voor de kijkhoek en de draai.

   De stappen komen uit de tekening die elke vorm al heeft (tekening.lijnen): elke lijn is één stap.
   Er hoeft dus niets per oefening te worden ingevoerd. De 3D-motor is dezelfde als op de over-pagina
   (over/over-3d.js met vendor/over/three.min.js en gsap.min.js, lokaal, geen CDN); die wordt pas
   geladen als iemand voor het eerst op "3D" tikt.

   stappenVan() is puur (testbaar in node). In de stap staan rolnamen ("speler 1", "tegenstander 6"),
   nooit spelersnamen. */

const NAAM_KANT = { tegen: 'tegenstander', joker: 'joker', keeper: 'de keeper' };
const afstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const hoofdletter = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Naam van een speler in een stap. */
function wie(s){
  if (!s) return 'de speler met de bal';
  if (s.kant === 'keeper') return 'de keeper';
  return `${NAAM_KANT[s.kant] || 'speler'} ${s.nr}`;
}

/* Tekst per lijn, met de spelers op hun plek op dat moment (wie loopt, schuift mee). */
export function stappenVan(vorm){
  const t = vorm?.tekening || {};
  const spelers = (t.spelers || []).map(s => ({ ...s, plek: [s.x, s.y] }));
  const doelen = (t.doeltjes || []).map(d => [d.x, d.kant === 'onder' ? 100 : 0]);
  const zones = t.zones || [];
  let balBij = t.bal ? spelers.reduce((b, s) => (afstand(s.plek, t.bal) < (b ? afstand(b.plek, t.bal) : 9) ? s : b), null) : null;
  const dichtst = (p, max = 12, zonder = null) => spelers.reduce((b, s) => {
    if (s === zonder) return b;
    const d = afstand(s.plek, p); return d < max && (!b || d < b.d) ? { s, d } : b;
  }, null)?.s || null;
  const zoneBij = (p) => zones.find(z => p[0] >= z.x && p[0] <= z.x + z.b && p[1] >= z.y && p[1] <= z.y + z.h);
  const naarZone = (p) => { const z = zoneBij(p); return z?.label ? ` naar de ${z.label}` : ''; };

  return (t.lijnen || []).map(l => {
    const a = l.punten[0], b = l.punten[l.punten.length - 1];
    let tekst;
    if (l.soort === 'pass' || l.soort === 'schot'){
      const van = dichtst(a, 12) || balBij || dichtst(a, 30);
      const opDoel = l.soort === 'schot' || doelen.some(d => afstand(d, b) < 8);
      let naar = opDoel ? null : dichtst(b, 14, van);
      const voorzet = !opDoel && naar?.kant === 'keeper' && doelen.some(d => afstand(d, b) < 28);
      if (voorzet) naar = null;
      if (opDoel) tekst = `${wie(van)} schiet op doel.`;
      else if (voorzet) tekst = `${wie(van)} geeft de voorzet voor het doel.`;
      else if (naar) tekst = `${wie(van)} speelt de bal naar ${wie(naar)}.`;
      else {
        /* bal in de ruimte: wie het dichtst bij die plek staat, loopt erop in (bijv. een kaats in de loop) */
        const loper = opDoel || voorzet ? null : dichtst(b, 24, van);
        if (loper){ tekst = `${wie(van)} speelt de bal in de loop van ${wie(loper)}${naarZone(b)}.`; loper.plek = b; naar = loper; }
        else tekst = `${wie(van)} speelt de bal in de ruimte${naarZone(b)}.`;
      }
      balBij = naar || null;
    } else if (l.soort === 'dribbel'){
      const s = dichtst(a, 12) || balBij || dichtst(a, 30);
      tekst = `${wie(s)} dribbelt met de bal${naarZone(b)}.`;
      if (s){ s.plek = b; balBij = s; }
    } else {
      const s = dichtst(a, 12);
      const krijgtBal = spelers.length && (t.lijnen || []).some(x => x !== l && x.soort === 'pass' && afstand(x.punten[x.punten.length - 1], b) < 10);
      const naarBal = balBij && s && afstand(b, balBij.plek) < afstand(a, balBij.plek) - 3;
      const doet = s?.kant === 'tegen' ? (naarBal ? 'zet druk op de bal' : 'schuift mee')
        : s?.kant === 'keeper' ? 'stapt uit zijn doel'
        : krijgtBal ? 'loopt vrij om de bal te vragen' : naarBal ? 'gaat op de bal af' : 'loopt mee';
      tekst = `${wie(s)} ${doet}${naarZone(b)}.`;
      if (s) s.plek = b;
    }
    return { soort: l.soort, tekst: hoofdletter(tekst) };
  });
}

/* ---------- laden van de 3D-motor (eenmalig) ---------- */
let laden = null;
function script(src){
  return new Promise((ok, fout) => {
    if (document.querySelector(`script[data-s3d="${src}"]`)) return ok();
    const s = document.createElement('script'); s.src = src; s.async = false; s.dataset.s3d = src;
    s.onload = () => ok(); s.onerror = () => fout(new Error('Kon ' + src + ' niet laden'));
    document.head.appendChild(s);
  });
}
export function laad3D(){
  if (window.Veld3D) return Promise.resolve(window.Veld3D);
  if (!laden) laden = (async () => {
    if (!window.THREE) await script('vendor/over/three.min.js');
    if (!window.gsap) await script('vendor/over/gsap.min.js');
    await script('over/over-3d.js?v=20261115b');   /* versie mee, anders kan de cache een oude motor zonder stappen geven */
    if (!window.Veld3D) throw new Error('3D niet beschikbaar');
    return window.Veld3D;
  })().catch(e => { laden = null; throw e; });
  return laden;
}
export function heeftWebGL(){
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- het 3D-blok met bediening ----------
   Geeft een DOM-element terug dat de aanroeper in de pagina zet en bij opnieuw tekenen weer
   terugplaatst (zodat de animatie niet opnieuw begint als je een veld van de oefenkaart opent). */
export function maak3DBlok(vorm, veld){
  const stappen = stappenVan(vorm);
  const el = document.createElement('div');
  el.className = 's3d';
  el.innerHTML = `
    <div class="s3d-stage" role="img" aria-label="${esc('3D-weergave van ' + vorm.naam)}"><div class="s3d-wacht">3D laden…</div></div>
    <div class="s3d-knoppen">
      <button type="button" class="knop klein licht" data-s3d-k="vorige" aria-label="Vorige stap">← Vorige</button>
      <button type="button" class="knop klein" data-s3d-k="speel">Afspelen</button>
      <button type="button" class="knop klein licht" data-s3d-k="volgende" aria-label="Volgende stap">Volgende →</button>
      <button type="button" class="knop klein licht" data-s3d-k="opnieuw">Opnieuw</button>
    </div>
    <div class="s3d-stap" aria-live="polite"></div>
    <div class="s3d-voortgang">${stappen.map(() => '<span></span>').join('')}</div>
    <div class="s3d-kijk">
      <label>Hoek <input type="range" min="15" max="85" value="40" data-s3d-r="hoek"></label>
      <label>Draai <input type="range" min="-60" max="60" value="8" data-s3d-r="draai"></label>
    </div>`;
  const stage = el.querySelector('.s3d-stage'), stapEl = el.querySelector('.s3d-stap'), balkjes = [...el.querySelectorAll('.s3d-voortgang span')];
  const speelKnop = el.querySelector('[data-s3d-k="speel"]');
  let veld3d = null, k = 0, speelt = false;

  const toon = () => {
    stapEl.innerHTML = !stappen.length ? 'Deze oefening heeft geen looplijnen om af te spelen.'
      : k < stappen.length ? `<b>Stap ${k + 1} van ${stappen.length}:</b> ${esc(stappen[k].tekst)}`
      : '<b>Klaar.</b> Tik op Opnieuw om de oefening nog eens te zien.';
    balkjes.forEach((b, i) => b.classList.toggle('klaar', i < k));
    speelKnop.textContent = speelt ? 'Pauze' : 'Afspelen';
  };
  toon();

  /* stap = aantal afgeronde stappen; klaar = de animatie is gestopt aan het eind van een stap */
  const opStap = (stap, klaar) => {
    k = Math.min(stap, stappen.length);
    if (klaar) speelt = false;
    toon();
  };

  (async () => {
    if (!heeftWebGL()){ stage.innerHTML = '<div class="s3d-wacht">3D werkt niet op dit apparaat. De tekening blijft gewoon beschikbaar.</div>'; return; }
    try {
      const V = await laad3D();
      stage.innerHTML = '';
      veld3d = V.maak(stage, { naam: vorm.naam, veld: veld || vorm.veld, tekening: vorm.tekening }, { opStap });
      veld3d.kijk(40, 8);
      const rustig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (rustig) veld3d.naarStap(0); else veld3d.opbouw();
    } catch {
      stage.innerHTML = '<div class="s3d-wacht">3D kon niet laden. Controleer je verbinding en probeer het opnieuw.</div>';
    }
  })();

  el.addEventListener('click', e => {
    const b = e.target.closest('[data-s3d-k]'); if (!b || !veld3d) return;
    const w = b.dataset.s3dK;
    if (w === 'speel'){
      if (speelt){ veld3d.stop(); speelt = false; }
      else {
        if (k >= stappen.length){ k = 0; veld3d.naarStap(0); }
        speelt = true; veld3d.speelVanaf(k);
      }
    } else if (w === 'volgende'){ if (k < stappen.length){ speelt = false; veld3d.speelStap(k); } }
    else if (w === 'vorige'){ speelt = false; k = Math.max(0, k - 1); veld3d.naarStap(k); }
    else if (w === 'opnieuw'){ speelt = false; k = 0; veld3d.naarStap(0); }
    toon();
  });
  el.addEventListener('input', () => {
    if (!veld3d) return;
    veld3d.kijk(Number(el.querySelector('[data-s3d-r="hoek"]').value), Number(el.querySelector('[data-s3d-r="draai"]').value));
  });
  el.weg = () => veld3d?.weg();
  return el;
}
