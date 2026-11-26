/* ==================== OEFENVORM IN 3D (TRAINING MAKEN) ====================
   [20261115b] Elke oefenvorm uit de bibliotheek kan als geanimeerd 3D-veld worden bekeken,
   stap voor stap zoals in de goedgekeurde mockup "Passen en lopen (3D)":
   Vorige · Afspelen/Pauze · Volgende · Opnieuw, de tekst van de stap en een voortgangsbalk.
   [20261116k] 3D is de standaardweergave van een oefening (de keuze Tekening/3D is weg); de schuifjes
   voor kijkhoek en draai zijn weg, het veld staat in één vaste kijkhoek.

   De stappen komen uit de tekening die elke vorm al heeft (tekening.lijnen): elke lijn is één actie.
   Er hoeft dus niets per oefening te worden ingevoerd. De 3D-motor is dezelfde als op de over-pagina
   (over/over-3d.js met vendor/over/three.min.js en gsap.min.js, lokaal, geen CDN); die wordt pas
   geladen als iemand voor het eerst op "3D" tikt.

   [20261116h] Het hele spelverloop in plaats van één of twee pijlen:
     • een lijn kan `vervolg: true` hebben: die staat niet in de tekening (anders wordt die onleesbaar),
       maar wordt in 3D wel gespeeld; `samen: true` speelt tegelijk met de lijn ervoor (pass en loopactie
       in één stap); `tekst` is de eigen tekst van de stap en `fase` de naam van het deel van de oefening
       (bijv. Opbouw, Doorbreken, Afronden, Omschakelen);
     • heeft een vorm minder dan MIN_STAPPEN eigen stappen, dan maakt vervolgVan() er een voorbeeld van
       het vervolg bij: druk van de dichtstbijzijnde tegenstander, de pass naar de vrije medespeler,
       doorlopen na de pass en de afronding op het doel. Dat is een voorbeeld op basis van de opstelling,
       geen vaste afspraak van de oefening; het staat er in 3D bij als "voorbeeld van het vervolg".
       Zelf vijf of meer stappen tekenen (Platform › Bibliotheek › Tekening en 3D) zet het uit.

   stappenVan(), vervolgVan() en stappen3D() zijn puur (testbaar in node). In de stap staan rolnamen
   ("speler 1", "tegenstander 6"), nooit spelersnamen. */

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
    return { soort: l.soort, tekst: l.tekst ? String(l.tekst) : hoofdletter(tekst), ...(l.vervolg ? { vervolg: true } : {}), ...(l.samen ? { samen: true } : {}), ...(l.fase ? { fase: l.fase } : {}), ...(l.auto ? { auto: true } : {}) };
  });
}

/* ---------- [20261116h] voorbeeld van het vervolg ---------- */
export const MIN_STAPPEN = 5;      /* vanaf zoveel eigen stappen komt er geen automatisch vervolg bij */
const MAX_VERVOLG = 5;
const klem = (x, a = 4, b = 96) => Math.max(a, Math.min(b, Math.round(x)));
const zijde = s => (s.kant === 'tegen' ? 'tegen' : s.kant === 'keeper' ? 'keeper' : 'eigen');   /* joker speelt met het team in balbezit */

/* Stand na de getekende lijnen, met dezelfde regels als de 3D-motor (over/over-3d.js): een loopactie of dribbel
   verplaatst de speler die binnen 2,4 meter van het begin staat; een pass, schot of dribbel neemt de bal mee
   als die binnen 4,5 meter van het begin ligt. m = afstand in meters. */
function standNa(t, m){
  const spelers = (t.spelers || []).map((s, i) => ({ ...s, i, plek: [s.x, s.y] }));
  let bal = t.bal ? [...t.bal] : null, schot = false, passer = null;
  const bij = (p, max) => spelers.reduce((b, s) => { const d = m(s.plek, p); return d < max && (!b || d < b.d) ? { s, d } : b; }, null)?.s || null;
  for (const l of t.lijnen || []){
    const a = l.punten[0], b = l.punten[l.punten.length - 1];
    const balMee = bal && m(bal, a) < 4.5;
    if (l.soort === 'pass' || l.soort === 'schot'){
      if (balMee){ passer = bij(a, 4.5); bal = [...b]; if (l.soort === 'schot') schot = true; }
    } else {
      const s = bij(a, 2.4);
      if (s){ s.plek = [...b]; if (l.soort === 'dribbel' && balMee) bal = [...b]; }
    }
  }
  const houder = bal && !schot ? bij(bal, 2.2) : null;
  return { spelers, bal, houder, passer, schot };
}

/* Voorbeeld van het vervolg voor een vorm met weinig eigen stappen. Geeft extra lijnen
   ({ soort, punten, vervolg:true, auto:true, tekst, samen?, fase }), of [] als er niets zinnigs te maken is. PUUR. */
export function vervolgVan(vorm){
  const t = vorm?.tekening || {}, eigenStappen = (t.lijnen || []).filter(l => !l.samen).length;
  if (vorm?.fase === 'afsluiting' || (t.spelers || []).length < 2 || eigenStappen >= MIN_STAPPEN) return [];
  const B = vorm.veld?.b || 20, L = vorm.veld?.l || 25;
  const m = (a, b) => Math.hypot((a[0] - b[0]) * B / 100, (a[1] - b[1]) * L / 100);          /* afstand in meters */
  const naar = (a, b, meters) => { const d = m(a, b) || 1, f = Math.min(1, meters / d); return [klem(a[0] + (b[0] - a[0]) * f), klem(a[1] + (b[1] - a[1]) * f)]; };
  const st = standNa(t, m), uit = [];
  const max = Math.max(2, Math.min(MAX_VERVOLG, MIN_STAPPEN + 1 - eigenStappen));
  const lijn = (soort, van, tot, tekst, extra = {}) => { uit.push({ soort, punten: [[...van], [...tot]], vervolg: true, auto: true, tekst: hoofdletter(tekst), fase: 'Voorbeeld van het vervolg', ...extra }); };
  const stappen = () => uit.filter(l => !l.samen).length;
  const veld = st.spelers.filter(s => zijde(s) !== 'keeper');

  /* iedereen een bal of een vorm zonder bal (tikspel, dribbelspel): twee rondes bewegen naar een vrije plek */
  if (t.iedereenBal || !t.bal){
    const lopers = veld.filter(s => zijde(s) === 'eigen').slice(0, 6), jagers = veld.filter(s => zijde(s) === 'tegen').slice(0, 2);
    if (!lopers.length) return [];
    const soort = t.iedereenBal ? 'dribbel' : 'loopweg';
    for (const [ronde, hoek, tekst] of [[0, 1.2, t.iedereenBal ? 'Iedereen dribbelt naar een plek waar niemand staat.' : 'Iedereen zoekt een plek waar niemand staat.'], [1, -1.9, 'En weer verder: kijk op en kies steeds de vrije ruimte.']]){
      lopers.forEach((s, k) => {
        const dx = s.plek[0] - 50, dy = s.plek[1] - 50, h = hoek + k * 0.35, r = 0.85 - ronde * 0.2;
        const doel = [klem(50 + (dx * Math.cos(h) - dy * Math.sin(h)) * r, 8, 92), klem(50 + (dx * Math.sin(h) + dy * Math.cos(h)) * r, 8, 92)];
        if (m(s.plek, doel) < 2) doel[0] = klem(doel[0] + (k % 2 ? 14 : -14), 8, 92);
        lijn(soort, s.plek, doel, tekst, k ? { samen: true } : {});
        s.plek = doel;
      });
      jagers.forEach(j => {
        const prooi = lopers.reduce((b, s) => (!b || m(s.plek, j.plek) < m(b.plek, j.plek) ? s : b), null);
        const doel = naar(j.plek, prooi.plek, Math.max(2, m(j.plek, prooi.plek) - 2));
        lijn('loopweg', j.plek, doel, ronde ? '' : `${wie(j)} jaagt op de dichtstbijzijnde speler.`, { samen: true }); j.plek = doel;
      });
    }
    return uit;
  }

  const doelen = (t.doeltjes || []).map(d => ({ p: [d.x, d.kant === 'onder' ? 100 : 0], kant: d.kant }));
  const midden = lijst => lijst.length ? [lijst.reduce((a, s) => a + s.plek[0], 0) / lijst.length, lijst.reduce((a, s) => a + s.plek[1], 0) / lijst.length] : [50, 50];
  /* op welk doel valt deze ploeg aan? één doel: dat doel; twee doelen: het doel het verst van het midden van de ploeg */
  const aanvalsdoel = z => {
    if (!doelen.length) return null;
    if (doelen.length === 1) return doelen[0].p;
    const c = midden(veld.filter(s => zijde(s) === z));
    return doelen.reduce((b, d) => (!b || m(d.p, c) > m(b.p, c) ? d : b), null).p;
  };
  const schietAfstand = Math.max(5, Math.min(12, L * 0.33));
  const ploeg = z => veld.filter(s => zijde(s) === z || (z !== 'tegen' && s.kant === 'joker'));
  const andere = z => veld.filter(s => zijde(s) !== z && s.kant !== 'joker');
  const dichtste = (lijst, p) => lijst.reduce((b, s) => (!b || m(s.plek, p) < m(b.plek, p) ? s : b), null);
  /* kleinste afstand (meters) van een tegenstander tot de passlijn a → b */
  const vrij = (tegen, a, b) => tegen.reduce((min, s) => {
    const ax = a[0] * B / 100, ay = a[1] * L / 100, bx = b[0] * B / 100, by = b[1] * L / 100, px = s.plek[0] * B / 100, py = s.plek[1] * L / 100;
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1, u = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2));
    return Math.min(min, Math.hypot(px - (ax + u * (bx - ax)), py - (ay + u * (by - ay))));
  }, 99);

  /* Eén aanval uitspelen vanaf de speler met de bal. Geeft 'schot' als de aanval met een doelpoging eindigt. */
  function speel(houder, vorige, tot){
    let drukGezet = (t.lijnen || []).some(l => l.soort === 'loopweg') && !uit.length;      /* druk stond al in de tekening */
    while (stappen() < tot){
      const z = zijde(houder), mee = ploeg(z).filter(s => s !== houder), tegen = andere(z), doel = aanvalsdoel(z);
      const jager = dichtste(tegen, houder.plek);
      const druk = () => {
        if (!jager || m(jager.plek, houder.plek) <= 3.5) return;
        const plek = naar(jager.plek, houder.plek, m(jager.plek, houder.plek) - 2.5);
        lijn('loopweg', jager.plek, plek, `${wie(jager)} zet druk op de bal.`); jager.plek = plek;
      };
      /* alleen tegen een verdediger (1 tegen 1): schijnbeweging, versnellen en afmaken */
      if (!mee.length){
        if (!drukGezet) druk();
        const eind = doel || [houder.plek[0], houder.plek[1] > 50 ? 3 : 97];
        const opzij = [klem(houder.plek[0] + (jager && jager.plek[0] >= houder.plek[0] ? -1 : 1) * Math.max(10, 300 / B), 6, 94), klem(houder.plek[1] + (eind[1] - houder.plek[1]) * 0.25)];
        const rest = m(opzij, eind) - (doel ? schietAfstand - 1 : 0);
        const verder = rest > 2 ? naar(opzij, eind, rest) : opzij;
        uit.push({ soort: 'dribbel', punten: [[...houder.plek], opzij, verder], vervolg: true, auto: true, fase: 'Voorbeeld van het vervolg',
          tekst: `${hoofdletter(wie(houder))} maakt een schijnbeweging en versnelt ${jager ? 'langs ' + wie(jager) : 'naar voren'}${doel ? '' : ': over de lijn is een punt'}.` });
        houder.plek = verder;
        if (doel){ lijn('schot', houder.plek, doel, `${wie(houder)} rondt af op doel.`); return 'schot'; }
        return 'klaar';
      }
      /* dichtbij het doel: eerst nog druk van de verdediger, dan afronden */
      if (doel && m(houder.plek, doel) <= schietAfstand){
        if (!drukGezet && stappen() < tot - 1) druk();
        lijn('schot', houder.plek, doel, `${wie(houder)} schiet op doel.`); return 'schot';
      }
      if (!drukGezet && jager && m(jager.plek, houder.plek) > 3.5){ druk(); drukGezet = true; if (stappen() >= tot) break; }
      else drukGezet = false;
      /* de beste afspeelmogelijkheid: vrij, vooruit en niet te ver */
      const opties = mee.map(s => {
        const d = m(houder.plek, s.plek);
        if (d < 3 || d > Math.max(28, L * 0.7)) return null;
        const vooruit = doel ? m(houder.plek, doel) - m(s.plek, doel) : 0;
        return { s, open: vrij(tegen, houder.plek, s.plek), score: vooruit * 0.8 + Math.min(8, vrij(tegen, houder.plek, s.plek)) * 1.6 - (s === vorige ? 6 : 0) - (s.kant === 'joker' ? 1 : 0) - Math.max(0, d - 20) * 0.4 };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      const keuze = opties[0];
      if (!keuze || keuze.open < 1.2){
        /* niemand vrij: zelf dribbelen, naar het doel of weg van de druk */
        const richting = doel || (jager ? [klem(2 * houder.plek[0] - jager.plek[0]), klem(2 * houder.plek[1] - jager.plek[1])] : [50, 50]);
        const plek = naar(houder.plek, richting, Math.min(8, Math.max(4, L * 0.2)));
        if (m(plek, houder.plek) < 2) break;
        lijn('dribbel', houder.plek, plek, `${wie(houder)} dribbelt ${doel ? 'richting het doel' : 'weg van de druk'}.`); houder.plek = plek; drukGezet = false;
        continue;
      }
      const ontvanger = keuze.s;
      lijn('pass', houder.plek, ontvanger.plek, `${wie(houder)} speelt ${wie(ontvanger)} aan${keuze.open > 5 && tegen.length ? ': die staat vrij' : ''}.`);
      /* na de pass doorlopen: aanspeelbaar blijven (tegelijk met de pass) */
      const weg = doel || (jager ? [klem(2 * houder.plek[0] - jager.plek[0]), klem(2 * houder.plek[1] - jager.plek[1])] : [100 - houder.plek[0], 100 - houder.plek[1]]);
      let plek = naar(houder.plek, weg, Math.min(7, Math.max(3, L * 0.18)));
      if (veld.some(s => s !== houder && m(s.plek, plek) < 2.5)) plek = [klem(plek[0] + (plek[0] < 50 ? 12 : -12)), plek[1]];
      if (m(plek, houder.plek) >= 2){ lijn('loopweg', houder.plek, plek, `${wie(houder)} loopt door en biedt zich opnieuw aan.`, { samen: true }); houder.plek = plek; }
      vorige = houder; houder = ontvanger;
    }
    /* slot: is er een doel, dan rondt de speler met de bal af */
    const doel = aanvalsdoel(zijde(houder));
    if (doel){
      if (m(houder.plek, doel) > schietAfstand){
        const plek = naar(houder.plek, doel, m(houder.plek, doel) - schietAfstand + 1);
        const laatste = uit[uit.length - 1];
        if (laatste && laatste.soort === 'dribbel' && afstand(laatste.punten[laatste.punten.length - 1], houder.plek) < 0.5) laatste.punten[laatste.punten.length - 1] = [...plek];   /* dribbelde hij al: dezelfde actie doortrekken */
        else lijn('dribbel', houder.plek, plek, `${wie(houder)} neemt de bal mee richting het doel.`);
        houder.plek = plek;
      }
      lijn('schot', houder.plek, doel, `${wie(houder)} rondt af op doel.`); return 'schot';
    }
    return 'klaar';
  }

  /* Na een doelpoging gaat het spel verder: de bal komt opnieuw in het spel bij de andere ploeg (twee doelen),
     of terug bij de start (één doel). Zo is ook de omschakeling te zien. */
  function opnieuw(balPlek, vorigeZijde){
    const tweeDoelen = doelen.length >= 2 && andere(vorigeZijde).length >= 2;
    const z = tweeDoelen ? (vorigeZijde === 'tegen' ? 'eigen' : 'tegen') : vorigeZijde;
    const lijst = ploeg(z).filter(s => s.kant !== 'joker');
    if (lijst.length < 2 && !tweeDoelen && lijst.length < 1) return;
    const start = tweeDoelen ? dichtste(lijst, balPlek) : lijst.reduce((b, s) => (!b || m(s.plek, balPlek) > m(b.plek, balPlek) ? s : b), null);
    if (!start) return;
    uit.push({ soort: 'pass', punten: [[...balPlek], [...start.plek]], vervolg: true, auto: true, fase: 'Voorbeeld van het vervolg',
      tekst: tweeDoelen ? `De bal komt opnieuw in het spel bij ${wie(start)}: de andere ploeg valt nu aan.` : `Nieuwe bal bij ${wie(start)}: de volgende aanval begint.` });
    if (ploeg(z).length >= 2) speel(start, null, Math.min(stappen() + 2, max + 2));
  }

  if (st.schot){
    if (veld.length >= 4) opnieuw(st.bal, 'eigen');
    else {
      const starter = veld.filter(s => zijde(s) === 'eigen').reduce((b, s) => (!b || m(s.plek, [s.x, s.y]) > m(b.plek, [b.x, b.y]) ? s : b), null);
      if (starter && m(starter.plek, [starter.x, starter.y]) > 2) lijn('loopweg', starter.plek, [starter.x, starter.y], `${wie(starter)} sluit weer aan. De volgende speler begint.`);
    }
    return uit;
  }
  let houder = st.houder;
  if (!houder && st.bal){
    houder = dichtste(veld, st.bal);
    if (!houder) return [];
    lijn('loopweg', houder.plek, st.bal, `${wie(houder)} loopt in op de bal en neemt hem aan.`); houder.plek = [...st.bal];
  }
  if (!houder) return [];
  const z0 = zijde(houder);
  const einde = speel(houder, st.passer, max);
  if (einde === 'schot' && stappen() < max + 1 && veld.length >= 4) opnieuw(uit[uit.length - 1].punten[1], z0);
  return uit;
}

/* De vorm zoals 3D hem speelt: de eigen lijnen plus, bij weinig stappen, het voorbeeld van het vervolg. PUUR. */
export function metVervolg(vorm){
  const extra = vervolgVan(vorm);
  if (!extra.length) return vorm;
  return { ...vorm, tekening: { ...vorm.tekening, lijnen: [...(vorm.tekening?.lijnen || []), ...extra] } };
}

/* De stappen zoals 3D ze toont: lijnen met `samen` horen bij de stap ervoor. Elke stap:
   { tekst, fase (de fase waar de stap in valt, of ''), lijnen:[index…], auto }. PUUR. */
export function stappen3D(vorm){
  const per = stappenVan(vorm), uit = [];
  let fase = '';                                    /* de fase loopt door tot een stap een nieuwe noemt */
  per.forEach((x, i) => {
    if (x.samen && uit.length){
      const vorig = uit[uit.length - 1]; vorig.lijnen.push(i);
      if (x.tekst && !vorig.tekst.includes(x.tekst)) vorig.tekst += ' ' + x.tekst;
      return;
    }
    if (x.fase) fase = x.fase; else if (x.vervolg && !fase) fase = 'Vervolg';
    uit.push({ tekst: x.tekst, fase, lijnen: [i], auto: !!x.auto });
  });
  return uit;
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
    await script('over/over-3d.js?v=20261126p');   /* versie mee, anders kan de cache een oude motor zonder stappen geven */
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
export function maak3DBlok(vorm0, veld){
  const vorm = metVervolg(vorm0);                 /* [20261116h] eigen stappen plus, bij weinig stappen, een voorbeeld van het vervolg */
  const stappen = stappen3D(vorm);
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
    <div class="s3d-voortgang">${stappen.map(x => `<span${x.auto ? ' class="auto"' : ''}></span>`).join('')}</div>`;
  const stage = el.querySelector('.s3d-stage'), stapEl = el.querySelector('.s3d-stap'), balkjes = [...el.querySelectorAll('.s3d-voortgang span')];
  const speelKnop = el.querySelector('[data-s3d-k="speel"]');
  let veld3d = null, k = 0, speelt = false, weg = false;

  const toon = () => {
    stapEl.innerHTML = !stappen.length ? 'Deze oefening heeft geen looplijnen om af te spelen.'
      : k < stappen.length ? `${stappen[k].fase ? `<span class="s3d-fase${stappen[k].auto ? ' auto' : ''}">${esc(stappen[k].fase)}</span>` : ''}<b>Stap ${k + 1} van ${stappen.length}:</b> ${esc(stappen[k].tekst)}`
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
      if (weg) return;                              /* al weggehaald terwijl de 3D-motor nog laadde */
      stage.innerHTML = '';
      veld3d = V.maak(stage, { naam: vorm.naam, veld: veld || vorm.veld, tekening: vorm.tekening }, { opStap, vervaag: true });
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
  /* [20261116k] de schuifjes Hoek en Draai zijn weg: het veld staat altijd in dezelfde vaste kijkhoek (40°, draai 8°) */
  el.weg = () => { weg = true; veld3d?.weg(); veld3d = null; };
  return el;
}
