/* Controle van een spelverloop met de regels van de 3D-motor (public/over/over-3d.js):
   een loopactie of dribbel begint binnen 2,4 meter van een speler (waar die op dat moment staat);
   een pass of schot begint binnen 4,5 meter van de bal. Geeft een lijst met fouten (leeg = klopt). */
export function controleerKeten(v){
  const t = v.tekening || {}, B = v.veld.b, L = v.veld.l, fouten = [];
  const m = (a, b) => Math.hypot((a[0] - b[0]) * B / 100, (a[1] - b[1]) * L / 100);
  const spelers = (t.spelers || []).map(s => ({ nr: s.nr, plek: [s.x, s.y] }));
  let bal = t.bal ? [...t.bal] : null;
  (t.lijnen || []).forEach((l, i) => {
    const a = l.punten[0], b = l.punten[l.punten.length - 1];
    for (const p of l.punten) if (!(p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100)) fouten.push(`stap ${i + 1}: punt buiten het vak`);
    if (l.samen && i === 0) fouten.push('stap 1 kan niet "samen" zijn');
    if (l.soort === 'pass' || l.soort === 'schot'){
      if (!bal || m(bal, a) >= 4.5) fouten.push(`stap ${i + 1} (${l.soort}): de bal ligt niet bij het begin (${bal ? m(bal, a).toFixed(1) + ' m' : 'geen bal'})`);
      else bal = [...b];
    } else {
      const s = spelers.reduce((best, x) => { const d = m(x.plek, a); return d < 2.4 && (!best || d < best.d) ? { x, d } : best; }, null)?.x;
      if (!s) fouten.push(`stap ${i + 1} (${l.soort}): geen speler bij het begin`);
      else { s.plek = [...b]; if (l.soort === 'dribbel' && !t.iedereenBal){ if (!bal || m(bal, a) >= 4.5) fouten.push(`stap ${i + 1} (dribbel): de bal ligt niet bij de speler`); else bal = [...b]; } }
    }
  });
  return fouten;
}
