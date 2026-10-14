/* Hulpfuncties voor het opschrijven van trainingsvormen.
   Tekening-coördinaten: % van het speelvak (x: 0 links … 100 rechts, y: 0 boven … 100 onder),
   hetzelfde systeem als leerinhoud.js / het tactiekbord. De echte afmetingen staan in `veld` (meters). */

/* speler: kant ontbreekt = eigen team (rood), 'tegen' = tegenstander (blauw),
   'joker' = neutrale/steunspeler (amber), 'keeper' = keeper (amber, K) */
export const P = (nr, x, y, kant) => (kant ? { nr, x, y, kant } : { nr, x, y });
export const loop  = (...punten) => ({ soort: 'loopweg', punten });
export const pass  = (...punten) => ({ soort: 'pass', punten });
export const drib  = (...punten) => ({ soort: 'dribbel', punten });
export const schot = (...punten) => ({ soort: 'schot', punten });

export const doel   = (x, y, breed, kant) => ({ x, y, breed, kant });
export const zone   = (x, y, b, h, label = '') => ({ x, y, b, h, label });
export const pion   = (x, y, kleur) => (kleur ? [x, y, kleur] : [x, y]);

/* Ruimte per speler in m² (voor de validator). */
export const ruimtePerSpeler = (v) => (v.veld.b * v.veld.l) / v.spelers.ideaal;

/* ───────────── Tekenhulpen (nieuwe vormen) ───────────── */
/* Verdeel n spelers netjes in rijen binnen een vlak (% van het speelvak). */
export const ploeg = (n, nr0, { y0 = 55, y1 = 90, x0 = 15, x1 = 85, kant } = {}) => {
  const rijen = n <= 3 ? 1 : n <= 7 ? 2 : 3;
  const perRij = []; let rest = n;
  for (let r = 0; r < rijen; r++){ const k = Math.ceil(rest / (rijen - r)); perRij.push(k); rest -= k; }
  const uit = []; let nr = nr0;
  perRij.forEach((k, r) => {
    const y = rijen === 1 ? (y0 + y1) / 2 : y0 + (y1 - y0) * r / (rijen - 1);
    for (let i = 0; i < k; i++){
      const x = k === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (k - 1);
      uit.push(P(nr++, Math.round(x), Math.round(y), kant));
    }
  });
  return uit;
};
/* Spelers op een cirkel (rondo). */
export const ring = (n, nr0, { cx = 50, cy = 50, rx = 38, ry = 38, kant } = {}) =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + 2 * Math.PI * i / n;
    return P(nr0 + i, Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)), kant);
  });
/* Lijnen langs bestaande spelers: passen(sp, [0,2],[2,4]) */
export const passen = (sp, ...paren) => paren.map(([a, b]) => pass([sp[a].x, sp[a].y], [sp[b].x, sp[b].y]));
export const lopen  = (sp, a, [x, y]) => loop([sp[a].x, sp[a].y], [x, y]);
export const dribbel = (sp, a, [x, y]) => drib([sp[a].x, sp[a].y], [x, y]);
export const schieten = (sp, a, [x, y]) => schot([sp[a].x, sp[a].y], [x, y]);

/* Compacte beschrijving → volledige vorm (schema van de bibliotheek). */
export const T = {
  tp: 'Teamsport en plezier', tv: 'Technische vaardigheden', u1: 'Uitspelen 1:1', sc: 'Scoren',
  po: 'Positiespel opbouw', do: 'Dieptespel opbouw', sv: 'Storen en veroveren', vd: 'Verdedigen dieptespel',
  v1: 'Verdedigen 1:1', vg: 'Voorkomen van doelpunten', av: 'Aanvallen met voorzet', vv: 'Verdedigen van voorzet',
  ob: 'Omschakelen balwinst', ol: 'Omschakelen balverlies',
};
export function vorm(o){
  const [min, ideaal, max] = o.n;
  const [ronde, rmin, rmax, rust] = o.duur;
  const v = {
    id: o.id, naam: o.naam, fase: o.fase,
    leeftijd: o.lft, spelers: { min, ideaal, max },
    veld: o.aanname ? { b: o.veld[0], l: o.veld[1], aanname: true } : { b: o.veld[0], l: o.veld[1] },
    duur: { ronde, rondes: [rmin, rmax], rust },
    thema: (o.thema || []).map(k => T[k] || k), domeinen: o.dom.split(','),
    complexiteit: o.c, intensiteit: o.i, voetbalecht: !!o.ve,
    materiaal: { pionnen: o.mat[0], ballen: o.mat[1], hesjes: o.mat[2], doeltjes: o.mat[3] },
    doel: o.doel, uitleg: o.uitleg,
    organisatie: o.org, regels: o.regels, coachpunten: o.punten, coachvragen: o.vragen,
    makkelijker: o.makk, moeilijker: o.moei,
    varianten: o.var.map(([naam, uitleg]) => ({ naam, uitleg })),
    letOp: o.letOp, soort: o.soort, tekening: o.tek,
  };
  if (o.themaregel) v.themaregelVorm = true;
  return v;
}
