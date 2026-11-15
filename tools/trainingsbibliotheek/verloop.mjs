/* Spelverloop schrijven op spelernummer in plaats van op coördinaten. [20261116i]
   Elke stap noemt een speler (het nummer in de tekening) en een doelpunt. De omzetter houdt bij waar elke speler
   en de bal op dat moment zijn, zodat de keten altijd klopt met de regels van de 3D-motor (zie keten.mjs).

   Stappen:  p(a, T, tekst, fase)  pass van speler a naar T
             l(a, T, tekst, fase)  loopactie zonder bal
             d(a, T, tekst, fase)  dribbel
             s(a, T, tekst, fase)  schot
             met(stap)             speelt tegelijk met de stap ervoor
             pin(a, b, T, tekstPass, tekstLoop, fase)   pass in de loop: a speelt naar T, b loopt er tegelijk heen
   Doelpunten (T):  7            waar speler 7 nu staat
                    [x, y]       vast punt in % van het speelvak
                    r(7, dx, dy) dx meter naar rechts en dy meter naar beneden vanaf speler 7 (min = links, omhoog)
                    dr(7, m)     op m meter van speler 7, aan de kant van de speler die loopt (druk zetten)
                    g(i, dx)     het midden van doel i uit de tekening (dx in % opzij)
                    tus(a, b, f) punt tussen speler a en b (f = 0 bij a … 1 bij b)
                    bal()        waar de bal nu ligt
   De eerste stappen staan in de tekening (standaard 4, hooguit 6); de rest is alleen in 3D te zien. */
const stap = (soort) => (a, T, tekst, fase) => ({ soort, a, T, tekst, ...(fase ? { fase } : {}) });
export const p = stap('pass'), l = stap('loopweg'), d = stap('dribbel'), s = stap('schot');
export const met = (x) => (Array.isArray(x) ? x.map((y, i) => (i === 0 ? { ...y, samen: true } : y)) : { ...x, samen: true });
export const pin = (a, b, T, tekstPass, tekstLoop, fase) => [p(a, T, tekstPass, fase), { soort: 'loopweg', a: b, T: 'vorige', tekst: tekstLoop, samen: true }];
export const r = (n, dx = 0, dy = 0) => ({ n, dx, dy });
export const dr = (n, m = 2) => ({ druk: n, m });
export const g = (i = 0, dx = 0) => ({ doel: i, dx });
export const tus = (a, b, f = 0.5) => ({ tus: [a, b], f });
export const bal = () => ({ bal: true });

const rond = (x) => Math.round(Math.max(0, Math.min(100, x)) * 10) / 10;

/* Zet de stappen om naar lijnen voor de tekening. Geeft { lijnen, fouten }. */
export function compileer(v, t, stappen, { tek } = {}){
  const B = v.veld.b, L = v.veld.l, fouten = [];
  const m = (a, b) => Math.hypot((a[0] - b[0]) * B / 100, (a[1] - b[1]) * L / 100);
  const plek = new Map();
  for (const sp of (t.spelers || [])){ if (plek.has(sp.nr)) fouten.push(`nummer ${sp.nr} staat twee keer in de tekening`); plek.set(sp.nr, [sp.x, sp.y]); }
  let balPlek = t.bal ? [...t.bal] : null, vorige = null;
  const waar = (n, i) => { const q = plek.get(n); if (!q){ fouten.push(`stap ${i + 1}: speler ${n} bestaat niet`); return [50, 50]; } return q; };
  const punt = (T, van, i) => {
    if (T === 'vorige') return vorige ? [...vorige] : [50, 50];
    if (typeof T === 'number') return [...waar(T, i)];
    if (Array.isArray(T)) return [T[0], T[1]];
    if (T.n !== undefined){ const q = waar(T.n, i); return [q[0] + T.dx * 100 / B, q[1] + T.dy * 100 / L]; }
    if (T.druk !== undefined){ const q = waar(T.druk, i), a = m(q, van) || 1, f = Math.min(1, T.m / a); return [q[0] + (van[0] - q[0]) * f, q[1] + (van[1] - q[1]) * f]; }
    if (T.doel !== undefined){ const dl = (t.doeltjes || [])[T.doel]; if (!dl){ fouten.push(`stap ${i + 1}: doel ${T.doel} bestaat niet`); return [50, 0]; } return [dl.x + (T.dx || 0), dl.y]; }
    if (T.tus){ const a = waar(T.tus[0], i), b = waar(T.tus[1], i); return [a[0] + (b[0] - a[0]) * T.f, a[1] + (b[1] - a[1]) * T.f]; }
    if (T.bal) return balPlek ? [...balPlek] : [50, 50];
    fouten.push(`stap ${i + 1}: onbekend doelpunt`); return [50, 50];
  };
  const plat = stappen.flat();
  const lijnen = plat.map((x, i) => {
    const van = [...waar(x.a, i)], naar = punt(x.T, van, i).map(rond);
    if (!x.tekst) fouten.push(`stap ${i + 1}: geen tekst`);
    else if (!/^[A-ZÉ0-9].{8,}[.!?]$/.test(x.tekst)) fouten.push(`stap ${i + 1}: tekst is geen volledige zin ("${x.tekst}")`);
    if (m(van, naar) < 0.8) fouten.push(`stap ${i + 1}: lijn is te kort`);
    if (x.samen && i === 0) fouten.push('stap 1 kan niet tegelijk met een vorige');
    const metBal = x.soort === 'pass' || x.soort === 'schot' || (x.soort === 'dribbel' && !t.iedereenBal);
    if (metBal){
      if (!balPlek || m(balPlek, van) >= 4.5) fouten.push(`stap ${i + 1} (${x.soort}, speler ${x.a}): de bal ligt niet bij deze speler`);
      balPlek = [...naar];
    }
    if (x.soort === 'loopweg' || x.soort === 'dribbel') plek.set(x.a, [...naar]);
    vorige = naar;
    const uit = { soort: x.soort, punten: [van.map(rond), naar], tekst: x.tekst };
    if (x.fase) uit.fase = x.fase;
    if (x.samen) uit.samen = true;
    return uit;
  });
  /* de eerste stappen staan in de tekening; een stap die tegelijk speelt hoort bij de stap ervoor */
  let n = Math.min(lijnen.length, tek ?? 4);
  while (n < lijnen.length && n < 6 && lijnen[n].samen) n++;
  if (n > 6) n = 6;
  lijnen.forEach((x, i) => { if (i >= n) x.vervolg = true; });
  if (lijnen.filter(x => !x.samen).length < 5) fouten.push(`maar ${lijnen.filter(x => !x.samen).length} stappen (minimaal 5)`);
  return { lijnen, fouten };
}
