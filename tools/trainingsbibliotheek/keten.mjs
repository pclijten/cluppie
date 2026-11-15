/* Controle van een spelverloop met de regels van de 3D-motor (public/over/over-3d.js):
   een loopactie of dribbel begint binnen 2,4 meter van een speler (waar die op dat moment staat);
   een pass of schot begint binnen 4,5 meter van de bal. Geeft een lijst met fouten (leeg = klopt). */
export function controleerKeten(v){
  const t = v.tekening || {}, B = v.veld.b, L = v.veld.l, fouten = [];
  const m = (a, b) => Math.hypot((a[0] - b[0]) * B / 100, (a[1] - b[1]) * L / 100);
  const spelers = (t.spelers || []).map(s => ({ nr: s.nr, plek: [s.x, s.y] }));
  /* alle ballen: de spelbal, losse ballen (t.ballen) en bij "iedereen een bal" een bal bij elke eigen speler */
  const ballen = [...(t.bal ? [[...t.bal]] : []), ...(t.ballen || []).map(q => [...q]), ...(t.iedereenBal ? (t.spelers || []).filter(x => !x.kant || x.kant === 'eigen').map(x => [x.x, x.y]) : [])];
  const balBij = (q) => ballen.reduce((best, bl) => { const a = m(bl, q); return a < 4.5 && (!best || a < best.a) ? { bl, a } : best; }, null)?.bl;
  (t.lijnen || []).forEach((l, i) => {
    const a = l.punten[0], b = l.punten[l.punten.length - 1];
    for (const p of l.punten) if (!(p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100)) fouten.push(`stap ${i + 1}: punt buiten het vak`);
    if (l.samen && i === 0) fouten.push('stap 1 kan niet "samen" zijn');
    if (l.soort === 'pass' || l.soort === 'schot'){
      const bl = balBij(a);
      if (!bl) fouten.push(`stap ${i + 1} (${l.soort}): de bal ligt niet bij het begin`);
      else { bl[0] = b[0]; bl[1] = b[1]; }
    } else {
      const s = spelers.reduce((best, x) => { const d = m(x.plek, a); return d < 2.4 && (!best || d < best.d) ? { x, d } : best; }, null)?.x;
      if (!s) fouten.push(`stap ${i + 1} (${l.soort}): geen speler bij het begin`);
      else { s.plek = [...b]; if (l.soort === 'dribbel'){ const bl = balBij(a); if (bl){ bl[0] = b[0]; bl[1] = b[1]; } else if (!t.iedereenBal) fouten.push(`stap ${i + 1} (dribbel): de bal ligt niet bij de speler`); } }
    }
  });
  return fouten;
}
