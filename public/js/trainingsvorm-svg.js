/* ==================== TRAININGSVORM-TEKENING (SVG) ====================
   Tekent een trainingsvorm uit de bibliotheek als SVG. Alle coördinaten in de vorm
   zijn percentages van het speelvak (x: 0 links … 100 rechts, y: 0 boven … 100 onder),
   dezelfde indeling als het tactiekbord. De hoogte volgt de verhouding van het echte
   veld (veld.b × veld.l in meters), zodat een lang vak ook lang getekend wordt.
   Kleuren komen uit CSS-klassen (.tv-…) in styles.css, dus donker én licht thema werken.
   Pure functie: geeft een HTML-string, raakt de DOM niet aan. */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let teller = 0;
export function vormSvg(vorm, veld, opts = {}){
  const t = vorm.tekening || {};
  const v = veld || vorm.veld;
  const B = 340;
  const H = Math.max(150, Math.min(300, Math.round(B * v.l / v.b)));
  const X = x => +(x / 100 * B).toFixed(1), Y = y => +(y / 100 * H).toFixed(1);
  const uid = 'tv' + (++teller);
  const klas = k => k === 'tegen' ? 'tv-tegen' : (k === 'joker' || k === 'keeper') ? 'tv-joker' : 'tv-eigen';
  let s = `<svg class="tv-veld" viewBox="-6 -6 ${B + 12} ${H + 12}" role="img" aria-label="${esc(opts.label || 'Tekening van ' + vorm.naam)}">`;
  s += `<defs><marker id="${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1 L9 5 L0 9z" class="tv-pijl"/></marker></defs>`;
  s += `<rect x="0" y="0" width="${B}" height="${H}" rx="3" class="tv-rand"/>`;
  for (const z of t.zones || []){
    s += `<rect x="${X(z.x)}" y="${Y(z.y)}" width="${X(z.b)}" height="${Y(z.h)}" class="tv-zone"/>`;
    if (z.label) s += `<text x="${X(z.x + z.b / 2)}" y="${Y(z.y + z.h / 2)}" class="tv-zonetekst" text-anchor="middle" dominant-baseline="middle">${esc(z.label)}</text>`;
  }
  for (const d of t.doeltjes || []){
    const w = d.breed / 100 * B, y = d.kant === 'boven' ? 0 : H;
    s += `<rect x="${+(d.x / 100 * B - w / 2).toFixed(1)}" y="${y - 3}" width="${+w.toFixed(1)}" height="6" rx="1" class="tv-doel"/>`;
  }
  for (const p of t.pionnen || []){
    const x = X(p[0]), y = Y(p[1]);
    s += `<polygon points="${x},${y - 5} ${x - 4},${y + 3} ${x + 4},${y + 3}" class="tv-pion"${p[2] ? ` style="fill:${esc(p[2])}"` : ''}/>`;
  }
  for (const l of t.lijnen || []){
    const pts = l.punten.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
    s += `<polyline points="${pts}" class="tv-lijn tv-${l.soort}" marker-end="url(#${uid})"/>`;
  }
  for (const p of t.spelers || []){
    s += `<g><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="9.5" class="tv-speler ${klas(p.kant)}"/><text x="${X(p.x)}" y="${Y(p.y)}" class="tv-nr ${klas(p.kant)}" text-anchor="middle" dominant-baseline="central">${p.kant === 'keeper' ? 'K' : esc(p.nr)}</text></g>`;
  }
  if (t.bal) s += `<circle cx="${X(t.bal[0])}" cy="${Y(t.bal[1])}" r="4.5" class="tv-bal"/>`;
  return s + '</svg>';
}

export const TEKENING_LEGENDA = `<div class="tv-leg"><span class="tv-leg-eigen">eigen team</span><span class="tv-leg-tegen">tegenstander</span><span class="tv-leg-joker">joker / keeper</span></div>`;
