/* ==================== OEFENKAART: 7 VASTE VELDEN ====================
   [20261115a] Elke oefening wordt op dezelfde manier getoond, in deze volgorde:
     1 Doel · 2 Tijdbestek (5/10/15/20) · 3 Benodigdheden · 4 Uitleg · 5 Differentiatie · 6 Coachmomenten · 7 Spelvormen
   Puur: geen DOM, geen Firestore, geen state.js (testbaar in node, zie tests/zeven-velden.test.mjs).
   zevenVelden() levert per veld een korte samenvatting (voor de dichte regel) en de HTML (voor het open veld). */
import { MATERIAAL_NAAM } from './trainingscontext-logica.js?v=20261019a';
import { stappen3D } from './scene3d.js?v=20261126p';

export const TIJDEN = [5, 10, 15, 20];
export const STANDAARD_OPEN = 'uitleg';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ul = (a) => a?.length ? `<ul class="ok-ul">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
const ol = (a) => a?.length ? `<ol class="ok-ul">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
const sub = (t) => `<div class="ok-sub">${esc(t)}</div>`;
/* "Zeg: "…"" uit de bibliotheek zonder het voorvoegsel en de buitenste aanhalingstekens */
const zegTekst = (u) => String(u || '').replace(/^Zeg:\s*/i, '').replace(/^["“]|["”]$/g, '');

/* [20261116h] Het spelverloop in stappen, voor vormen waarvan het hele verloop is uitgeschreven (elke lijn van de
   tekening heeft een eigen tekst). Zelfde stappen als de 3D-weergave. Geeft [{ fase, stappen:[tekst] }] of []. */
export function spelverloop(v){
  const lijnen = v?.tekening?.lijnen || [];
  if (lijnen.length < 4 || !lijnen.every(l => l.tekst)) return [];
  const uit = [];
  for (const s of stappen3D(v)){
    if (!uit.length || s.fase !== uit[uit.length - 1].fase) uit.push({ fase: s.fase || '', stappen: [] });
    uit[uit.length - 1].stappen.push(s.tekst);
  }
  return uit;
}
/* Het spelverloop als platte regels ("Opbouw: De keeper …"), voor bewaarde trainingen en delen. */
export function spelverloopRegels(v){
  return spelverloop(v).flatMap(f => f.stappen.map((t, i) => (i === 0 && f.fase ? `${f.fase}: ${t}` : t)));
}

/* Tekst voor de tijdsindeling binnen het blok, bijv. "2 rondes van 7 minuten, 1 minuut rust". */
export function tijdUitleg(od){
  if (!od || !od.rondes) return '';
  const r = od.rondes, rd = od.ronde, rust = od.rust || 0;
  if (r <= 1) return `Eén ronde van ${rd} minuten.`;
  return `${r} rondes van ${rd} minuten${rust ? `, ${rust} ${rust === 1 ? 'minuut' : 'minuten'} rust ertussen` : ''}.`;
}

/* Benodigdheden met aantallen. Met groepen: totaal voor de hele training (materiaal per groep × groepen). */
export function benodigdheden(v, groepen = 1){
  const m = v?.materiaal || {}, g = Math.max(1, groepen || 1);
  const regels = Object.entries(m).filter(([, n]) => n > 0).map(([k, n]) => [n * g, (MATERIAAL_NAAM[k] || k).toLowerCase()]);
  for (const x of (v?.materiaalExtra || [])) regels.push(['', x]);
  return regels;
}

/* o: { minuten, rondes, ronde, rust, groepen, coaching, aanpassingen, themaregel, ai:{intro,tip}, stijl, extraMateriaal (html),
        [20261116h] principe (speelwijze-principe van deze vorm), woorden (coachwoorden van de training), speelwijzeRegel, stap (LESOPBOUW) } */
export function zevenVelden(v, o = {}){
  const min = o.minuten || v.tijd;
  const mat = benodigdheden(v, o.groepen);
  const vragenEerst = o.stijl === 'ontdekkend' || o.stijl === 'vragen';
  const punten = `${sub('Let op')}${ul(o.coachpunten || v.coachpunten)}`;
  const vragen = (v.coachvragen || []).length ? `${sub('Vraag aan de spelers')}${ul(v.coachvragen)}` : '';
  const spel = v.varianten || [];
  const verloop = spelverloop(v);
  let stapNr = 0;
  const verloopHtml = verloop.length ? sub('Spelverloop stap voor stap') + `<div class="ok-verloop">${verloop.map(f => `${f.fase ? `<div class="ok-fase">${esc(f.fase)}</div>` : ''}<ol class="ok-ul" start="${stapNr + 1}">${f.stappen.map(t => { stapNr++; return `<li>${esc(t)}</li>`; }).join('')}</ol>`).join('')}</div><p class="ok-klein">Bekijk het verloop in 3D met de knop boven de tekening.</p>` : '';
  const sw = o.principe ? `<div class="ok-speelwijze"><b>Speelwijze:</b> ${esc(o.principe.titel)}</div>` : '';
  /* [20261116i] Uitwerking per oefening: zo zie je dat het lukt, waarom het werkt, kijk en grijp in, tel mee, spelers aan zet. */
  const lukt = (v.lukt || []).length ? `${sub('Zo zie je dat het lukt')}${ul(v.lukt)}` : '';
  const waarom = v.inzicht ? `<p class="ok-waarom"><b>Waarom dit werkt:</b> ${esc(v.inzicht)}</p>` : '';
  const alsDan = (v.alsDan || []).length ? `${sub('Kijk en grijp in')}<div class="ok-alsdan">${v.alsDan.map(x => `<div><span class="zie">${esc(x.zie)}</span><span class="doe">${esc(x.doe)}</span></div>`).join('')}</div>` : '';
  const meet = v.meet ? `${sub('Tel mee')}<p class="ok-meet">${esc(v.meet)}</p>` : '';
  const regie = v.regie ? `${sub('Spelers aan zet')}<p>${esc(v.regie)}</p>` : '';
  const woorden = o.woorden?.length ? `${sub('Coachwoorden van deze training')}<div class="ok-woorden">${o.woorden.map(w => `<span>${esc(w)}</span>`).join('')}</div>` : '';
  return [
    { id: 'doel', label: 'Doel', kort: v.doel || '', html: `<p>${esc(v.doel)}</p>${sw}${o.stap ? `<p class="ok-klein"><b>${esc(o.stap.stap)}:</b> ${esc(o.stap.tekst)}</p>` : ''}${lukt}${waarom}` },
    { id: 'tijd', label: 'Tijdbestek', kort: `${min} min`,
      html: `<div class="ok-tijden">${TIJDEN.map(t => `<span class="${t === min ? 'aan' : ''}">${t}′</span>`).join('')}</div>${o.rondes ? `<p>${esc(tijdUitleg(o))}</p>` : ''}` },
    { id: 'mat', label: 'Benodigdheden', kort: mat.map(([n, x]) => `${n} ${x}`.trim()).join(' · ') || 'geen',
      html: `${mat.length ? `<dl class="ok-mat">${mat.map(([n, x]) => `<dt>${n === '' ? '+' : n}</dt><dd>${esc(x)}</dd>`).join('')}</dl>` : '<p>Geen materiaal nodig.</p>'}${o.groepen > 1 ? `<p class="ok-klein">Voor ${o.groepen} groepen samen.</p>` : ''}${o.extraMateriaal || ''}` },
    { id: 'uitleg', label: 'Uitleg', kort: (v.organisatie || [])[0] || zegTekst(v.uitleg),
      html: `${o.ai?.intro ? `<div class="ok-ai"><b>Voor jouw team:</b> ${esc(o.ai.intro)}</div>` : ''}${v.uitleg ? `<div class="ok-zeg">“${esc(zegTekst(v.uitleg))}”</div>` : ''}${o.themaregel ? `<div class="ok-themaregel"><b>Themaregel:</b> ${esc(o.themaregel)}</div>` : ''}${o.speelwijzeRegel ? `<div class="ok-themaregel sw"><b>Regel van de speelwijze:</b> ${esc(o.speelwijzeRegel)}</div>` : ''}${(v.organisatie || []).length ? sub(verloop.length ? 'Opstelling' : 'Opstelling en verloop') + ol(v.organisatie) : ''}${verloopHtml}${(v.regels || []).length ? sub('Regels') + ul(v.regels) : ''}${(o.aanpassingen || []).length ? sub('Aangepast door jouw knoppen') + ul(o.aanpassingen) : ''}${(v.letOp || []).length ? sub('Veiligheid') + ul(v.letOp) : ''}` },
    { id: 'diff', label: 'Differentiatie', kort: `${(v.makkelijker || []).length} makkelijker · ${(v.moeilijker || []).length} moeilijker`,
      html: `<div class="ok-diff"><div class="mk"><b>Makkelijker</b>${ul(v.makkelijker)}</div><div class="md"><b>Moeilijker</b>${ul(v.moeilijker)}</div></div>${alsDan}` },
    { id: 'coach', label: 'Coachmomenten', kort: (v.coachpunten || [])[0] || '',
      html: `${o.ai?.tip ? `<div class="ok-ai"><b>Tip:</b> ${esc(o.ai.tip)}</div>` : ''}${woorden}${vragenEerst ? vragen + punten : punten + vragen}${meet}${regie}` },
    { id: 'spel', label: 'Spelvormen', kort: spel.map(x => x.naam).join(' · ') || 'geen',
      html: spel.map(x => `<div class="ok-sv"><b>${esc(x.naam)}</b>${esc(x.uitleg)}</div>`).join('') || '<p>Geen spelvormen.</p>' },
  ];
}

/* Hoeveel van de 7 velden gevuld zijn (voor de controleregel boven de velden). */
export function aantalGevuld(v){
  return zevenVelden(v).filter(x => x.kort && x.kort !== 'geen' && !/^0 makkelijker/.test(x.kort)).length;
}

/* De 7 velden als openklapbare regels. attr: het data-attribuut voor de klik (bijv. 'data-tm-veld'), sleutel: prefix ervoor. */
export function htmlZevenVelden(v, o = {}, { open = STANDAARD_OPEN, attr = 'data-ok-veld', sleutel = '' } = {}){
  const velden = zevenVelden(v, o), n = aantalGevuld(v), min = o.minuten || v.tijd;
  return `<div class="ok-controle"><span class="ok-stip${n === 7 ? '' : ' half'}">${n === 7 ? '✓' : '!'}</span>${n === 7 ? 'Alle 7 velden ingevuld' : `${n} van 7 velden ingevuld`} · tijd ${min} min</div>
    ${velden.map((x, i) => { const aan = x.id === open; return `<div class="ok-veld${aan ? ' open' : ''}">
      <button type="button" ${attr}="${esc(sleutel + x.id)}" aria-expanded="${aan}"><span class="ok-nr">${i + 1}</span><span class="ok-lbl">${x.label}</span><span class="ok-kort">${esc(x.kort)}</span><span class="ok-pijl" aria-hidden="true">›</span></button>
      ${aan ? `<div class="ok-inhoud">${x.html}</div>` : ''}</div>`; }).join('')}`;
}
