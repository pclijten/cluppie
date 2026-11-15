/* ==================== SPEELWIJZE — bouwstenen voor het scherm (puur: geen DOM, geen Firestore, geen state.js) ====================
   [20261116h] Dezelfde blokken op elk scherm waar de speelwijze terugkomt, zodat de koppeling zichtbaar is:
     htmlDraad()      de rode draad in vier haltes: Speelwijze → Seizoen → Training → Wedstrijd
     htmlWiel()       de vier momenten van het spel als wiel; een moment kiezen toont de principes
     htmlPrincipe()   één principe: wat je ziet als het lukt, coachwoorden, de regel, de wedstrijdvraag
                      en waar het terugkomt (weken in het seizoen, vormen in de bibliotheek)
     htmlSchuiven()   de acht keuzes van de speelstijl als schuiven tussen kant A en kant B
   Klikken regelt het scherm zelf via data-attributen (data-sw-moment, data-sw-principe, data-draad, data-sw-drie).
   Kleuren van de momenten komen uit speelwijze-logica (MOMENTEN) en zijn nooit de enige aanwijzing: er staat altijd tekst bij. */
import { DIMS, statusVan } from './speelstijl-logica.js?v=20261019e';
import { MOMENTEN, perMoment, bouwVanLeeftijd, laterTekst, momentVan } from './speelwijze-logica.js?v=20261116i';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BOUW_NAAM = { onder: 'Onderbouw', midden: 'Middenbouw', boven: 'Bovenbouw' };

/* ---------- de rode draad ----------
   d = rodeDraad() uit speelwijze-logica. nu = de halte waar de trainer nu is ('speelwijze'|'seizoen'|'training'|'wedstrijd').
   o: { zonder (tekst als er geen speelwijze is), datum (tekst bij Training), links (false = haltes zijn geen knoppen) } */
export function htmlDraad(d, nu = 'training', o = {}){
  const p = d?.principe || null;
  const haltes = [
    ['speelwijze', 'Speelwijze', p ? p.kort : d?.heeftSpeelwijze ? 'Basis: techniek en plezier' : (o.zonder || 'Nog niet vastgelegd')],
    ['seizoen', 'Seizoen', d?.thema ? `${d.blok ? 'Blok ' + d.blok + ' · ' : ''}${d.thema}` : 'Nog geen plan'],
    ['training', 'Training', d?.fase ? `${d.fase}${d.weekInBlok && d.weken ? ' · week ' + d.weekInBlok + ' van ' + d.weken : ''}${o.datum ? ' · ' + o.datum : ''}` : (o.datum || 'Deze week')],
    ['wedstrijd', 'Wedstrijd', p ? 'Eén vraag na afloop' : 'Kwam het thema terug?'],
  ];
  const kleur = p ? momentVan(p.moment)?.kleur : null;
  return `<nav class="sw-draad" aria-label="De rode draad: van speelwijze naar wedstrijd"${kleur ? ` style="--mk:${kleur}"` : ''}>
    ${haltes.map(([k, naam, tekst], i) => {
      const actief = k === nu, tag = o.links === false ? 'div' : 'button';
      return `<${tag} class="sw-halte${actief ? ' nu' : ''}${k === 'speelwijze' && !p && !d?.heeftSpeelwijze ? ' leeg' : ''}"${tag === 'button' ? ` type="button" data-draad="${k}"` : ''}${actief ? ' aria-current="step"' : ''}>
        <span class="sw-stip" aria-hidden="true">${i + 1}</span><span class="sw-hn">${naam}</span><span class="sw-ht">${esc(tekst)}</span></${tag}>`;
    }).join('')}
  </nav>`;
}

/* De draad met de inhoud van vandaag eronder: leerdoel, succescriteria, coachwoorden, regel en wedstrijdvraag. */
export function htmlDraadKaart(d, nu = 'training', o = {}){
  const p = d?.principe || null;
  if (!p) return `<div class="kaart sw-dk">${htmlDraad(d, nu, o)}
      <div class="sw-leerdoel"><span class="sw-etiket">Leerdoel</span>${esc(d?.leerdoel || '')}</div>
      ${o.geenTekst ? `<div class="tm-info">${esc(o.geenTekst)}</div>` : ''}</div>`;
  const m = momentVan(p.moment);
  return `<div class="kaart sw-dk" style="--mk:${m.kleur}">${htmlDraad(d, nu, o)}
    <div class="sw-moment"><i aria-hidden="true"></i>${esc(m.naam)}</div>
    <div class="sw-leerdoel"><span class="sw-etiket">Leerdoel van deze training</span>${esc(d.leerdoel)}</div>
    <details class="sw-meer"${o.open ? ' open' : ''}><summary>Zo zie je dat het lukt, en wat je zegt</summary>
      <div class="sw-etiket">Het is gelukt als je dit ziet</div><ul class="sw-zie">${d.succes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="sw-etiket">Drie coachwoorden, in elke vorm dezelfde</div><div class="sw-woorden">${d.woorden.map(w => `<span>${esc(w)}</span>`).join('')}</div>
      ${d.regel ? `<div class="sw-etiket">Regel in het partijspel</div><p class="sw-regel">${esc(d.regel)}</p>` : ''}
      ${d.wedstrijdvraag ? `<div class="sw-etiket">Na de wedstrijd vraagt de app</div><p class="sw-regel">${esc(d.wedstrijdvraag)}</p>` : ''}
    </details></div>`;
}

/* ---------- het wiel: de vier momenten van het spel ----------
   Vier kwarten met de klok mee: bal hebben → bal verliezen → zij hebben de bal → bal winnen. */
export function htmlWiel(sw, gekozen = null){
  const pm = perMoment(sw);
  const R = 146, r = 74, C = 150, rad = g => (g - 90) * Math.PI / 180;
  const punt = (straal, g) => `${(C + straal * Math.cos(rad(g))).toFixed(1)},${(C + straal * Math.sin(rad(g))).toFixed(1)}`;
  const kwart = i => { const a = i * 90 - 43, b = i * 90 + 43; return `M${punt(R, a)} A${R},${R} 0 0 1 ${punt(R, b)} L${punt(r, b)} A${r},${r} 0 0 0 ${punt(r, a)} Z`; };
  /* boven en onder is er breedte voor twee regels; links en rechts is het kwart smal, daar drie korte regels */
  const REGELS = { ab: ['Wij hebben', 'de bal'], ov: ['Wij', 'verliezen', 'de bal'], vb: ['Zij hebben', 'de bal'], ow: ['Wij', 'winnen', 'de bal'] };
  const delen = pm.map(({ moment, principes, later }, i) => {
    const [x, y] = punt((R + r) / 2, i * 90).split(',').map(Number), aan = gekozen === moment.id, n = principes.length;
    const [pijlX, pijlY] = punt((R + r) / 2, i * 90 + 45).split(',').map(Number);
    return `<g class="sw-kw${aan ? ' aan' : ''}${n ? '' : ' leeg'}" role="button" tabindex="0" data-sw-moment="${moment.id}" aria-pressed="${aan}" aria-label="${esc(moment.naam)}: ${n} ${n === 1 ? 'principe' : 'principes'}${later.length ? ', ' + later.length + ' later' : ''}" style="--mk:${moment.kleur}">
        <path d="${kwart(i)}"/>
        ${REGELS[moment.id].map((r, k, a) => `<text x="${x}" y="${(y + 3 - (a.length - 1) * 15 + k * 15).toFixed(1)}" text-anchor="middle" class="sw-kw-n">${r}</text>`).join('')}
        <text x="${x}" y="${y + 20}" text-anchor="middle" class="sw-kw-t">${n ? n + (n === 1 ? ' principe' : ' principes') : later.length ? 'komt later' : 'nog open'}</text>
      </g>
      <path class="sw-pijl" d="M-5,-4 L3,0 L-5,4" transform="translate(${pijlX},${pijlY}) rotate(${i * 90 + 45})"/>`;
  }).join('');
  const m = gekozen ? momentVan(gekozen) : null;
  return `<div class="sw-wiel"><svg viewBox="0 0 300 300" role="group" aria-label="De vier momenten van het spel">
      ${delen}
      <circle cx="150" cy="150" r="58" class="sw-kern"/>
      <text x="150" y="${m ? 140 : 144}" text-anchor="middle" class="sw-kern-k">${m ? esc(m.kort.split(' ')[0]) : 'Vier'}</text>
      <text x="150" y="${m ? 158 : 162}" text-anchor="middle" class="sw-kern-s">${m ? esc(m.kort.split(' ').slice(1).join(' ') || 'het moment') : 'momenten'}</text>
      ${m ? '' : '<text x="150" y="178" text-anchor="middle" class="sw-kern-s">tik een moment</text>'}
    </svg></div>`;
}

/* ---------- één principe ----------
   p = actief principe (uit speelwijzeVan). o: { leeftijd (team) of null (club: alle drie de bouwen), open,
   weken (uit dekking), blokken, vormen (aantal in de bibliotheek), voorbeeld (vorm-id voor 3D of null), nu (traint het team dit nu?) } */
export function htmlPrincipe(p, o = {}){
  const open = !!o.open, bouw = o.leeftijd != null && o.leeftijd < 99 ? bouwVanLeeftijd(o.leeftijd) : null;
  const m = momentVan(p.moment);
  const badges = `${p.belangrijk ? '<span class="sw-badge zwaar">weegt het zwaarst</span>' : ''}${p.status === 'neigt' ? '<span class="sw-badge">neigt</span>' : ''}${o.nu ? '<span class="sw-badge nu">nu in training</span>' : ''}`;
  const terug = [];
  if (o.weken != null) terug.push(`<button type="button" class="sw-terug" data-draad="seizoen"><b>${o.weken ? o.weken + (o.weken === 1 ? ' week' : ' weken') : 'Niet gepland'}</b><span>in het seizoen${o.blokken ? ` · ${o.blokken} ${o.blokken === 1 ? 'blok' : 'blokken'}` : ''}</span></button>`);
  if (o.vormen != null) terug.push(`<div class="sw-terug"><b>${o.vormen} ${o.vormen === 1 ? 'vorm' : 'vormen'}</b><span>in de bibliotheek${bouw ? ' voor deze leeftijd' : ''}</span></div>`);
  terug.push(`<div class="sw-terug"><b>1 vraag</b><span>na elke wedstrijd in dit blok</span></div>`);
  return `<article class="sw-pr${open ? ' open' : ''}" style="--mk:${m.kleur}">
    <button type="button" class="sw-pr-kop" data-sw-principe="${p.id}" aria-expanded="${open}">
      <span class="sw-pr-t">${esc(p.titel)}</span><span class="sw-pr-b">${badges}</span><span class="sw-pr-pijl" aria-hidden="true">›</span></button>
    ${open ? `<div class="sw-pr-in">
      ${bouw ? `<p class="sw-opleeftijd"><span class="sw-etiket">Op deze leeftijd</span>${esc(p.bouw[bouw])}</p>`
        : `<dl class="sw-bouwen">${['onder', 'midden', 'boven'].map(b => `<dt>${BOUW_NAAM[b]}</dt><dd>${esc(p.bouw[b])}</dd>`).join('')}</dl>`}
      <div class="sw-etiket">Je ziet het als</div><ul class="sw-zie">${p.zie.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="sw-etiket">Coachwoorden</div><div class="sw-woorden">${p.woorden.map(w => `<span>${esc(w)}</span>`).join('')}</div>
      <div class="sw-etiket">Regel in het partijspel</div><p class="sw-regel">${esc(p.regel)}</p>
      <div class="sw-etiket">Vraag na de wedstrijd</div><p class="sw-regel">${esc(p.vraag)}</p>
      <div class="sw-etiket">Hier komt het terug</div><div class="sw-terugrij">${terug.join('')}</div>
      ${o.voorbeeld ? `<button type="button" class="knop klein licht" data-sw-drie="${esc(o.voorbeeld)}" style="margin-top:10px">${o.drieOpen ? 'Verberg het voorbeeld' : 'Bekijk een oefening in 3D'}</button>${o.drieOpen ? `<div class="sw-3d" data-sw-drieplek="${esc(o.voorbeeld)}"></div>` : ''}` : ''}
    </div>` : ''}
  </article>`;
}
/* Een principe waarvoor het team nog te jong is. */
export const htmlLater = p => `<div class="sw-later">${esc(laterTekst(p))}</div>`;

/* ---------- de acht keuzes als schuiven ---------- */
export function htmlSchuiven(huidig){
  return `<div class="sw-schuiven">${DIMS.map(d => {
    const s = huidig?.standen?.[d.id]?.stand, st = statusVan(s), open = st === 'open';
    const pct = open ? 50 : 50 - (Math.max(-2, Math.min(2, s)) / 2) * 42;            /* A links (+2), B rechts (−2) */
    const zwaar = (huidig?.gewichten?.[d.id] || 1) >= 2, verschil = (huidig?.verschil || []).includes(d.id);
    return `<div class="sw-schuif${open ? ' open' : ''}">
      <div class="sw-schuif-kop"><b>${esc(d.n)}</b>${zwaar ? '<span class="sw-badge zwaar">zwaarst</span>' : ''}${verschil ? '<span class="sw-badge">verschil van mening</span>' : ''}${open ? '<span class="sw-badge">nog open</span>' : ''}</div>
      <div class="sw-baan" role="img" aria-label="${esc(d.n)}: ${open ? 'nog open' : (s > 0 ? d.A : d.B) + (st === 'neigt' ? ' (neigt)' : '')}"><i style="left:${pct.toFixed(0)}%"></i></div>
      <div class="sw-kanten"><span class="${!open && s > 0 ? 'aan' : ''}">${esc(d.A)}</span><span class="${!open && s < 0 ? 'aan' : ''}">${esc(d.B)}</span></div>
    </div>`;
  }).join('')}</div>`;
}

/* ---------- dekking: de speelwijze in het seizoen ----------
   dek = dekking() uit speelwijze-logica; sw = speelwijze. Balk per moment plus de principes zonder weken. */
export function htmlDekking(dek, sw){
  if (!sw || !dek.totaal) return '';
  const delen = [...MOMENTEN.map(m => [m.kort, dek.perMoment[m.id], m.kleur]), ['Basis: techniek, plezier en overige thema’s', dek.basis, 'var(--hair-2, #8a94a3)']].filter(x => x[1] > 0);
  return `<div class="sw-dekking">
    <div class="sw-dekband" role="img" aria-label="Verdeling van de trainingsweken over de momenten van het spel">${delen.map(([, w, k]) => `<i style="flex:${w};background:${k}"></i>`).join('')}</div>
    <ul class="sw-dekleg">${delen.map(([n, w, k]) => `<li><i style="background:${k}" aria-hidden="true"></i>${esc(n)} <b>${w} ${w === 1 ? 'week' : 'weken'}</b></li>`).join('')}</ul>
    ${dek.gaten.length ? `<div class="tm-melding">Niet in dit plan, terwijl het zwaar weegt in de speelwijze: ${dek.gaten.map(p => esc(p.kort.toLowerCase())).join(', ')}. Maak het plan opnieuw met de speelwijze aan, of kies een ander opbouwmodel.</div>` : ''}
  </div>`;
}

/* Kleine regel bij een blok of een vorm: "Speelwijze: …". */
export const htmlPrincipeChip = (p, tekst = 'Speelwijze') => (p ? `<span class="sw-chip" style="--mk:${momentVan(p.moment)?.kleur || 'var(--accent)'}"><i aria-hidden="true"></i>${esc(tekst)}: ${esc(p.kort)}</span>` : '');
