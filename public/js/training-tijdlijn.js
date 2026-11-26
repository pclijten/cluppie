/* ==================== TRAINING ALS TIJDLIJN ====================
   [20261120k] De trainingsweergave als tijdlijn: verloop van de training, per onderdeel een kaart (fase, duur,
   groepen, veld, inspanning), één onderdeel tegelijk open met 3D, "Uitzetten" (alle vakken in één plaatje) en
   "Start training" (wat is nu aan de beurt, zonder klok). Mockup "Cluppie · Training als tijdlijn (testvoorstel)",
   telefoon en computer akkoord Paul 20-11-2026; besluiten in projectdocument claude/training-tijdlijn-ontwerp.md.

   Dit bestand is puur (html uit gegevens), behalve openUitzet() dat een blad of paneel opent.
   De bibliotheek wordt niet zelf geladen: de aanroeper geeft vormVan(id) mee, zodat de deelpagina licht blijft.
   Alleen aantallen en vormen; nooit namen van spelers. */
import { esc, terugLaag } from './state.js?v=20261127v';

export const FASE = {
  'warming-up': { naam: 'Warming-up', kl: 'var(--info)' },
  positiespel: { naam: 'Positiespel', kl: 'var(--warn)' },
  spelvorm: { naam: 'Spelvorm', kl: 'var(--accent)' },
  partijspel: { naam: 'Partijspel', kl: 'var(--ok)' },
  afsluiting: { naam: 'Afsluiting', kl: 'var(--ink-2)' },
};
const FASE_BIJ_SLOT = { 'warming-up': 'warming-up', kern1: 'positiespel', kern2: 'spelvorm', partij: 'partijspel', afsluiting: 'afsluiting' };
const INSPANNING = ['', 'Rustig', 'Middel', 'Intensief'];

/* "18:30" + 15 → "18:45" */
export function plusMinuten(hhmm, min){
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const t = (h * 60 + m + min + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/* Materiaal uit het blok Benodigdheden ("8 pionnen", "2 doeltjes"). PUUR. */
export function materiaalVan(oef){
  const uit = { pionnen: 0, ballen: 0, hesjes: 0, doeltjes: 0 };
  for (const b of oef?.blokken || []){
    if (b.veld !== 'mat' || b.type !== 'lijst') continue;
    for (const r of b.items || []){
      const m = String(r).match(/^(\d+)\s+(.*)$/); if (!m) continue;
      const n = Number(m[1]), w = m[2].toLowerCase();
      const k = /pion|hoedje/.test(w) ? 'pionnen' : /doel/.test(w) ? 'doeltjes' : /hesje/.test(w) ? 'hesjes' : /bal/.test(w) ? 'ballen' : null;
      if (k) uit[k] = Math.max(uit[k], n);
    }
  }
  return uit;
}

/* Per onderdeel wat de tijdlijn nodig heeft. lijst = oefeningen zoals ze vandaag zijn; vormVan(id) → vorm of null;
   start = "18:30" of null. Geeft { items, totaal, tijden, start }. PUUR. */
export function tijdlijnInfo(lijst, vormVan = () => null, start = null){
  const items = (lijst || []).map((oef, i) => {
    const vorm = oef?.bron?.vormId ? (vormVan(oef.bron.vormId) || null) : null;
    const tijdTekst = (oef?.blokken || []).find(b => b.veld === 'tijd' && b.type !== 'lijst' && /minu/.test(b.tekst || ''))?.tekst || '';
    const min = Number(oef?.bron?.minuten) || Number((tijdTekst.match(/(\d+)\s*minu/) || [])[1]) || Number(vorm?.tijd) || null;
    const groepen = Number((tijdTekst.match(/(\d+)\s*groep/) || [])[1]) || null;
    const fase = vorm?.fase || FASE_BIJ_SLOT[oef?.bron?.slot] || null;
    return { i, oef, vorm, fase, min, groepen, veld: vorm?.veld || null, intensiteit: Number(vorm?.intensiteit) || null,
      titel: oef?.titel || `Oefening ${i + 1}`, doel: vorm?.doel || '', materiaal: materiaalVan(oef) };
  });
  const tijden = items.length && items.every(x => x.min);
  let t = 0;
  for (const x of items){ x.vanaf = t; t += x.min || 0; x.tijd = tijden ? (start ? plusMinuten(start, x.vanaf) : `${x.vanaf}′`) : ''; }
  return { items, totaal: t, tijden, start: tijden && start ? start : null, eind: tijden ? (start ? plusMinuten(start, t) : `${t}′`) : '' };
}
const kleur = x => (FASE[x.fase]?.kl || 'var(--accent)');

/* Kop van een onderdeel in de tijdlijn (fase, duur, chips). Komt bovenin de sectie van oefHtml. PUUR. */
export function htmlMeta(x){
  const chips = [
    x.groepen ? `<span class="tl-chip sterk">${x.groepen} ${x.groepen === 1 ? 'groep' : 'groepen'}</span>` : '',
    x.veld ? `<span class="tl-chip">${x.veld.b}×${x.veld.l} m</span>` : '',
    x.intensiteit ? `<span class="tl-chip"><span class="tl-intens">${[1, 2, 3].map(k => `<i${k <= x.intensiteit ? ' class="aan"' : ''}></i>`).join('')}</span>${INSPANNING[x.intensiteit] || ''}</span>` : '',
  ].join('');
  return `<div class="tl-meta">${x.fase ? `<span class="tl-fase">${esc(FASE[x.fase]?.naam || '')}</span>` : ''}${x.min ? `<span class="tl-duur"><b>${x.min}</b>min</span>` : ''}${chips ? `<div class="tl-chips">${chips}</div>` : ''}</div>`;
}

/* Compacte kaart (computer: de lijst links; de open oefening staat rechts). PUUR. */
export function htmlKaart(x, open){
  return `<button type="button" class="tl-kaart${open ? ' open' : ''}" data-tl-open="${x.i}" style="--fc:${kleur(x)}" aria-pressed="${open}">
    ${x.tijd ? `<span class="tl-tijd">${esc(x.tijd)}</span>` : ''}<span class="tl-knoop"></span>
    <span class="tl-kaart-fase">${x.i + 1}${x.fase ? ' · ' + esc(FASE[x.fase]?.naam || '') : ''}</span>
    <span class="tl-kaart-naam">${esc(x.titel)}</span>
    ${x.min ? `<span class="tl-duur"><b>${x.min}</b>min</span>` : ''}
    <span class="tl-chips">${x.groepen ? `<span class="tl-chip sterk">${x.groepen} ${x.groepen === 1 ? 'groep' : 'groepen'}</span>` : ''}${x.veld ? `<span class="tl-chip">${x.veld.b}×${x.veld.l} m</span>` : ''}</span>
  </button>`;
}

/* Sectie van oefHtml omzetten naar een onderdeel van de tijdlijn: tijd en knoop op de lijn, fasekleur, meta. PUUR. */
export function alsOnderdeel(sectieHtml, x, open){
  const kop = `<section class="trw-oef tl-oef${open ? ' tl-open' : ''}" data-tl="${x.i}" style="--fc:${kleur(x)}">${x.tijd ? `<span class="tl-tijd">${esc(x.tijd)}</span>` : ''}<span class="tl-knoop"></span>`;
  return sectieHtml.replace('<section class="trw-oef">', kop).replace(/(<div class="trw-oef-kop">[\s\S]*?<\/h2>\s*<\/div>)/, `$1${htmlMeta(x)}`);
}

/* Overgang tussen twee onderdelen. PUUR. */
export function htmlOvergang(volgende){
  return `<div class="tl-overgang">Ombouwen · ${esc((FASE[volgende.fase]?.naam || 'volgende oefening').toLowerCase())} klaarzetten</div>`;
}

/* Verloop: een balk per onderdeel, breedte = minuten, hoogte = inspanning, kleur = fase. PUUR. */
export function htmlVerloop(info, open = null){
  const xs = info.items;
  if (!info.tijden || xs.length < 2) return '';
  const W = 340, top = 8, bas = 84, H = 104;
  let x = 0, g = '';
  for (const it of xs){
    const w = it.min / info.totaal * W;
    const lvl = Math.max(.8, Math.min(3.4, (it.intensiteit || 2) + (it.fase === 'partijspel' ? .5 : 0)));
    const y = bas - lvl / 3.5 * (bas - top);
    g += `<g class="tl-balk" data-tl-ga="${it.i}" role="button" tabindex="0" aria-label="${esc(`${it.i + 1}. ${it.titel}, ${it.min} minuten`)}">
      <rect x="${x + 1}" y="${y}" width="${Math.max(2, w - 2)}" height="${bas - y}" rx="5" style="fill:${kleur(it)}" fill-opacity="${open === it.i ? .6 : .3}"/>
      <rect x="${x + 1}" y="${y}" width="${Math.max(2, w - 2)}" height="3" rx="1.5" style="fill:${kleur(it)}"/>
      <text x="${x + w / 2}" y="${bas - 8}" text-anchor="middle" class="tl-balk-nr">${it.i + 1}</text></g>`;
    g += `<text x="${x}" y="${H - 4}" class="tl-as">${esc(it.tijd)}</text>`;
    x += w;
  }
  g += `<text x="${W}" y="${H - 4}" text-anchor="end" class="tl-as">${esc(info.eind)}</text>`;
  const fases = [...new Set(xs.map(it => it.fase).filter(Boolean))];
  return `<section class="tl-verloop" aria-label="Verloop van de training">
    <div class="tl-verloop-kop"><b>Verloop</b><span>${info.totaal} min · ${xs.length} onderdelen</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="group"><line x1="0" x2="${W}" y1="${bas}" y2="${bas}" class="tl-as-lijn"/>${g}</svg>
    <div class="tl-legenda">${fases.map(f => `<span><i style="background:${FASE[f].kl}"></i>${esc(FASE[f].naam)}</span>`).join('')}<span class="tl-legenda-r">hoogte = inspanning</span></div>
  </section>`;
}

/* ---------- Uitzetten: alle vakken op een half veld (of een heel veld als het niet past) ---------- */
const HALF = { b: 68, l: 52.5 }, HEEL = { b: 68, l: 105 };
const r1 = x => Math.round(x * 10) / 10;

/* Vakken plaatsen: grootste eerst; een vak dat ≤ 4 m verschilt van een geplaatst vak (van een ander onderdeel)
   hergebruikt dat vak; de rest op de hoogste vrije plek, links eerst, 2 m ertussen, zo nodig een kwartslag gedraaid.
   Past het niet op een half veld, dan op een heel veld. Geeft vakken met { i, x, y, b, l, gedraaid, deelt } en .veld. PUUR. */
export function vakkenPlan(info){
  const lijst = [];
  for (const x of info.items){
    if (!x.veld || !x.vorm?.tekening) continue;
    const k = Math.max(1, Math.min(4, x.groepen || 1));
    for (let j = 0; j < k; j++) lijst.push({ i: x.i, j, k, b: x.veld.b, l: x.veld.l });
  }
  lijst.sort((a, b) => b.b * b.l - a.b * a.l || a.i - b.i);
  const probeer = (V) => {
    const gap = 2, geplaatst = [];
    const vrij = (x, y, b, l) => x >= 1 && y >= 1 && x + b <= V.b - .5 && y + l <= V.l - .5
      && geplaatst.every(p => p.deelt != null || x + b + gap <= p.x || p.x + p.b + gap <= x || y + l + gap <= p.y || p.y + p.l + gap <= y);
    for (const v of lijst){
      const zelfde = v.k === 1 && geplaatst.find(p => p.deelt == null && p.k === 1 && p.i !== v.i && !p.gedraaid && Math.abs(p.b - v.b) <= 4 && Math.abs(p.l - v.l) <= 4);
      if (zelfde){ geplaatst.push({ ...v, x: zelfde.x + (zelfde.b - v.b) / 2, y: zelfde.y + (zelfde.l - v.l) / 2, deelt: zelfde.i, gedraaid: false }); continue; }
      const eigen = geplaatst.filter(p => p.deelt == null);
      const xs = [1, ...eigen.map(p => p.x + p.b + gap)], ys = [1, ...eigen.map(p => p.y + p.l + gap)];
      const kand = xs.flatMap(x => ys.map(y => [x, y])).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      let plek = null;
      for (const [x, y] of kand){
        if (vrij(x, y, v.b, v.l)){ plek = { x, y, b: v.b, l: v.l, gedraaid: false }; break; }
        if (v.b !== v.l && vrij(x, y, v.l, v.b)){ plek = { x, y, b: v.l, l: v.b, gedraaid: true }; break; }
      }
      if (!plek) return null;
      geplaatst.push({ ...v, ...plek, deelt: null });
    }
    return geplaatst;
  };
  const half = probeer(HALF);
  const uit = half || probeer(HEEL) || [];
  uit.veld = half || !uit.length ? HALF : HEEL;
  return uit;
}

function veldSvg(V){
  const B = V.b, L = V.l, heel = V.l > 60, n = heel ? 14 : 7;
  const strafschop = (y, onder) => `<rect x="${r1((B - 40.3) / 2)}" y="${onder ? L - 16.5 : y}" width="40.3" height="16.5"/><rect x="${r1((B - 18.3) / 2)}" y="${onder ? L - 5.5 : y}" width="18.3" height="5.5"/>`
    + (onder ? `<path d="M ${B / 2 - 7.3} ${L - 16.5} A 9.15 9.15 0 0 1 ${B / 2 + 7.3} ${L - 16.5}"/>` : `<path d="M ${B / 2 - 7.3} 16.5 A 9.15 9.15 0 0 0 ${B / 2 + 7.3} 16.5"/>`);
  return `${Array.from({ length: n }, (_, k) => `<rect x="0" y="${r1(k * L / n)}" width="${B}" height="${r1(L / n) + .05}" class="${k % 2 ? 'tlz-gras2' : 'tlz-gras'}"/>`).join('')}
    <g class="tlz-kalk"><rect x="0" y="0" width="${B}" height="${L}"/>${heel
      ? `<path d="M 0 ${L / 2} H ${B}"/><circle cx="${B / 2}" cy="${L / 2}" r="9.15"/>${strafschop(0, false)}${strafschop(0, true)}`
      : `<path d="M ${B / 2 - 9.15} 0 A 9.15 9.15 0 0 0 ${B / 2 + 9.15} 0"/>${strafschop(0, true)}`}</g>
    <rect x="${B / 2 - 3.66}" y="${L}" width="7.32" height=".8" class="tlz-doel"/>${heel ? `<rect x="${B / 2 - 3.66}" y="-.8" width="7.32" height=".8" class="tlz-doel"/>` : ''}`;
}
const pion = (x, y, r = .55) => `<path d="M ${r1(x)} ${r1(y - r)} L ${r1(x + r * .9)} ${r1(y + r * .6)} L ${r1(x - r * .9)} ${r1(y + r * .6)} Z" class="tlz-pion"/>`;
function doeltjes(x, p){
  return (x.vorm?.tekening?.doeltjes || []).map(d => {
    const w = d.breed / 100 * x.veld.b, h = Math.max(.7, w * .12), langs = d.x / 100 * x.veld.b, onder = d.kant === 'onder';
    if (p.gedraaid){   /* een kwartslag gedraaid: boven wordt links, onder wordt rechts */
      const cy = p.y + langs;
      return `<rect x="${r1(onder ? p.x + p.b : p.x - h)}" y="${r1(cy - w / 2)}" width="${r1(h)}" height="${r1(w)}" rx=".2" class="tlz-doel"/>`;
    }
    const cx = p.x + langs;
    return `<rect x="${r1(cx - w / 2)}" y="${r1(onder ? p.y + p.l : p.y - h)}" width="${r1(w)}" height="${r1(h)}" rx=".2" class="tlz-doel"/>`;
  }).join('');
}

/* Het plaatje: half veld met alle vakken. mini = alleen de vakken (voor de knop). PUUR. */
export function htmlPlan(info, mini = false){
  const vakken = vakkenPlan(info), V = vakken.veld;
  let g = '';
  for (const p of vakken){
    const x = info.items[p.i], kl = kleur(x), deelt = p.deelt != null;
    g += `<rect x="${r1(p.x)}" y="${r1(p.y)}" width="${p.b}" height="${p.l}" rx=".3" style="stroke:${kl};fill:${kl}" class="tlz-vak${deelt ? ' deelt' : ''}${mini ? ' mini' : ''}"/>`;
    if (mini) continue;
    if (!deelt) g += [[p.x, p.y], [p.x + p.b, p.y], [p.x, p.y + p.l], [p.x + p.b, p.y + p.l]].map(([a, b]) => pion(a, b)).join('') + doeltjes(x, p);
    const lx = deelt ? p.x + p.b - 2.6 : p.x + 2.6, ly = deelt ? p.y + p.l - 2.6 : p.y + 2.6;
    g += `<circle cx="${r1(lx)}" cy="${r1(ly)}" r="2" style="fill:${kl}"/><text x="${r1(lx)}" y="${r1(ly + .8)}" text-anchor="middle" class="tlz-nr">${p.i + 1}</text>`;
    if (!deelt) g += `<text x="${r1(p.x + p.b / 2)}" y="${r1(p.y + p.l / 2 + .8)}" text-anchor="middle" class="tlz-maat">${p.b} × ${p.l} m</text>`;
  }
  return `<svg viewBox="-1 -1.5 ${V.b + 2} ${V.l + 3}" role="img" aria-label="Uitzetplan: alle vakken op een ${V.l > 60 ? 'heel' : 'half'} veld">${veldSvg(V)}${g}</svg>`;
}

/* Wat er klaar moet staan: per soort het meeste dat tegelijk nodig is; pionnen minstens vier per vak. PUUR. */
export function klaarzetten(info){
  const m = { pionnen: 0, ballen: 0, hesjes: 0, doeltjes: 0 };
  for (const x of info.items) for (const k of Object.keys(m)) m[k] = Math.max(m[k], x.materiaal[k] || 0);
  const eigenVakken = vakkenPlan(info).filter(p => p.deelt == null).length;
  m.pionnen = Math.max(m.pionnen, eigenVakken * 4);
  return m;
}

/* Tekst bij een gedeeld vak: "1 m per zijlijn naar buiten, 2 m per kant korter". PUUR. */
export function verzetTekst(van, naar){
  const db = naar.b - van.b, dl = naar.l - van.l, d = [];
  if (db) d.push(`${r1(Math.abs(db) / 2)} m per zijlijn ${db > 0 ? 'naar buiten' : 'naar binnen'}`);
  if (dl) d.push(`${r1(Math.abs(dl) / 2)} m per kant ${dl > 0 ? 'langer' : 'korter'}`);
  return d.join(', ');
}

export function heeftUitzet(info){ return vakkenPlan(info).length > 0; }

/* De knop met het mini-veld. PUUR. */
export function htmlUitzetKnop(info){
  if (!heeftUitzet(info)) return '';
  const plan = vakkenPlan(info), vakken = plan.filter(p => p.deelt == null).length;
  return `<button type="button" class="tl-uitzetknop" data-tl-uitzet>
    <span class="tl-mini">${htmlPlan(info, true)}</span>
    <span class="tl-uitzet-t"><b>Uitzetten</b><span>${vakken} ${vakken === 1 ? 'vak' : 'vakken'} op een ${plan.veld.l > 60 ? 'heel' : 'half'} veld · ${klaarzetten(info).pionnen} pionnen</span></span>
    <svg class="tl-pijl" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
  </button>`;
}

/* Inhoud van het blad. weergave: 'veld' | 'oef' | 'alles' (computer). PUUR. */
export function htmlUitzet(info, weergave = 'veld'){
  const vakken = vakkenPlan(info), m = klaarzetten(info);
  const tegels = `<h4>Klaarzetten</h4><div class="tlz-mat">${[[m.pionnen, 'pionnen'], [m.ballen, 'ballen'], [m.hesjes, 'hesjes'], [m.doeltjes, 'doeltjes']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>`;
  const metVak = info.items.filter(x => vakken.some(p => p.i === x.i));
  const lijst = `<div class="tlz-vakken">${metVak.map(x => {
    const eigen = vakken.filter(p => p.i === x.i), deelt = eigen.find(p => p.deelt != null);
    const ander = deelt ? info.items[deelt.deelt] : null;
    return `<div class="tlz-vakrij" style="--fc:${kleur(x)}"><span class="tlz-vaknr">${x.i + 1}</span>
      <span><b>${esc(x.titel)}</b><small>${esc([eigen.length > 1 ? `${eigen.length} vakken naast elkaar` : x.groepen ? `${x.groepen} ${x.groepen === 1 ? 'groep' : 'groepen'}` : '', (n => n ? `${n} ${n === 1 ? 'doeltje' : 'doeltjes'}` : '')((x.vorm?.tekening?.doeltjes || []).length), eigen.some(p => p.gedraaid) ? 'gedraaid' : ''].filter(Boolean).join(' · '))}</small>
      ${ander ? `<small class="tlz-hergebruik">Gebruikt vak ${ander.i + 1}${verzetTekst(ander.veld, x.veld) ? ': ' + esc(verzetTekst(ander.veld, x.veld)) : ''}</small>` : ''}</span>
      <span class="tlz-maatlbl">${x.veld.b}×${x.veld.l}</span></div>`;
  }).join('')}</div>`;
  const veld = `<div class="tlz-plan">${htmlPlan(info)}</div>
    <p class="tlz-noot">${vakken.veld.l > 60 ? 'Heel veld 68 × 105 m' : 'Half veld 68 × 52,5 m, middenlijn boven'}. Een pion op elke hoek; een stippellijn is hetzelfde vak, iets verzet.</p>`;
  const oef = `<div class="tlz-raster">${info.items.filter(x => x.oef?.svg).map(x => `<figure class="tlz-oef" style="--fc:${kleur(x)}"><div class="tlz-oef-svg">${x.oef.svg}</div>
      <figcaption><b>${x.i + 1}. ${esc(x.titel)}</b><small>${[x.veld ? `${x.veld.b}×${x.veld.l} m` : '', x.groepen ? `${x.groepen} ${x.groepen === 1 ? 'groep' : 'groepen'}` : ''].filter(Boolean).join(' · ')}</small></figcaption></figure>`).join('')}</div>`;
  if (weergave === 'alles') return `<div class="tlz-twee"><div>${veld}</div><div>${lijst}${tegels}</div></div><h4>Per oefening</h4>${oef}`;
  return weergave === 'oef' ? `${oef}${tegels}` : `${veld}${lijst}${tegels}`;
}

/* Blad (telefoon) of paneel van rechts (computer, het zijmenu blijft zichtbaar). */
let _uz = null;
export function openUitzet(info){
  const desk = typeof document !== 'undefined' && document.documentElement.classList.contains('desk') && matchMedia('(min-width:1100px)').matches;
  if (!_uz){
    _uz = document.createElement('div');
    _uz.className = 'tlz-waas';
    _uz.setAttribute('role', 'dialog'); _uz.setAttribute('aria-modal', 'true'); _uz.setAttribute('aria-label', 'Uitzetten');
    _uz.innerHTML = `<div class="tlz-blad"><div class="tlz-greep" aria-hidden="true"></div>
      <div class="tlz-kop"><h3>Uitzetten</h3><button type="button" class="tlz-sluit" aria-label="Sluiten">✕</button></div>
      <div class="tlz-wissel" role="tablist"><button type="button" role="tab" data-tlz="veld">Op het veld</button><button type="button" role="tab" data-tlz="oef">Per oefening</button></div>
      <div class="tlz-inhoud"></div></div>`;
    document.body.appendChild(_uz);
    _uz.addEventListener('click', e => {
      if (e.target === _uz || e.target.closest('.tlz-sluit')) return sluitUitzet();
      const b = e.target.closest('[data-tlz]'); if (!b) return;
      _uz._weergave = b.dataset.tlz; tekenUitzet();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && _uz?.classList.contains('open')) sluitUitzet(); });
    terugLaag('tlz', { z: 70, vast: true, open: () => _uz.classList.contains('open'), sluit: sluitUitzet });
  }
  _uz._info = info; _uz._desk = desk; _uz._weergave = _uz._weergave || 'veld';
  tekenUitzet();
  _uz.classList.add('open');
  _uz.querySelector('.tlz-sluit').focus({ preventScroll: true });
}
function tekenUitzet(){
  if (!_uz?._info) return;
  _uz.classList.toggle('desk', !!_uz._desk);
  _uz.querySelectorAll('[data-tlz]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tlz === _uz._weergave)));
  _uz.querySelector('.tlz-inhoud').innerHTML = htmlUitzet(_uz._info, _uz._desk ? 'alles' : _uz._weergave);
}
export function sluitUitzet(){ _uz?.classList.remove('open'); }
