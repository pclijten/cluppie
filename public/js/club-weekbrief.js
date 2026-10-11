/* ==================== WEEKBRIEF VOOR DE COÖRDINATOR (20261011d) ====================
   Eén scherm per bouw (of de hele club): welke teams vragen deze week aandacht?
   Per team, uit data die Cluppie al heeft:
     • trainingen zonder aanwezigheid    trainingsdagen van de afgelopen 7 dagen zonder presentie
     • niet geëvalueerd                  laatste beoordeling langer dan 4 weken geleden
     • speeltijdbalans                   aantal spelers (≥3 wedstrijden) ruim onder het teamgemiddelde
     • opkomst laatste 4 weken           onder de drempel van de club
     • beleidsplan in de praktijk        % van de leerthema's voor deze leeftijd waar spelers aan werken
   AVG: alleen aantallen per team, geen spelernamen; delen via WhatsApp gaat ook zonder namen.
   weekbriefTeam() is PUUR (getest in tests/weekbrief.test.mjs). */

import { db, collection, getDocs, query, where } from './firebase.js?v=20261011e';
import { S, esc, meld, openModal } from './state.js?v=20261011f';
import { LEERCURVE, leercurveRelevant, ACTIEF } from './config.js?v=20261011f';
import { speeltijdReserve } from './analyse.js?v=20261011f';
import { teltMee } from './opkomst.js?v=20260922c';

const DAG = 86400000;
const iso = d => new Date(d).toISOString().slice(0, 10);
const weekdag = isoStr => { const d = new Date(isoStr + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };   // 1 = ma … 7 = zo

export function weekbriefTeam({ team, spelers = [], presentie = [], wedstrijden = [], beoordelingen = [], vandaag = iso(Date.now()),
  leercurve = LEERCURVE, opkomstLaag = 50 }){
  const signalen = [];
  const nuMs = Date.parse(vandaag + 'T12:00:00Z');
  const actief = spelers.filter(p => !p.gearchiveerd && !p.gast);

  /* 1. trainingen van de afgelopen 7 dagen (t/m gisteren) zonder aanwezigheid */
  const dagen = (team.trainingsdagen || []).map(Number);
  const geregistreerd = new Set(presentie.map(p => p.datum));
  let gemist = 0, gepland = 0;
  for (let i = 1; i <= 7; i++){
    const d = iso(nuMs - i * DAG);
    if (dagen.includes(weekdag(d))){ gepland++; if (!geregistreerd.has(d)) gemist++; }
  }
  if (gemist) signalen.push({ soort: 'presentie', ernst: gemist === gepland ? 2 : 1, tekst: `${gemist} van ${gepland} training${gepland === 1 ? '' : 'en'} zonder aanwezigheid` });

  /* 2. evaluatie */
  const laatsteBeo = beoordelingen.map(b => b.datum).filter(Boolean).sort().at(-1) || null;
  const dagenBeo = laatsteBeo ? Math.floor((nuMs - Date.parse(laatsteBeo + 'T12:00:00Z')) / DAG) : null;
  if (actief.length && (dagenBeo == null || dagenBeo > 28)) signalen.push({ soort: 'evaluatie', ernst: dagenBeo == null || dagenBeo > 56 ? 2 : 1,
    tekst: dagenBeo == null ? 'nog niemand beoordeeld dit seizoen' : `${Math.floor(dagenBeo / 7)} weken geen beoordeling` });

  /* 3. speeltijdbalans */
  let scheef = 0;
  try {
    const sr = speeltijdReserve(wedstrijden);
    const pct = Object.entries(sr).filter(([pid, r]) => r.wedstrijden >= 3 && r.speelbaar > 0 && actief.some(p => p.id === pid)).map(([, r]) => r.speeltijd / r.speelbaar);
    if (pct.length >= 4){
      const gem = pct.reduce((a, b) => a + b, 0) / pct.length;
      scheef = pct.filter(p => p < gem - 0.15).length;
    }
  } catch (e) { /* beschadigde wedstrijd: sla dit signaal over */ }
  if (scheef) signalen.push({ soort: 'speeltijd', ernst: scheef >= 3 ? 2 : 1, tekst: `${scheef} speler${scheef === 1 ? '' : 's'} ruim onder de gemiddelde speeltijd` });

  /* 4. opkomst laatste 4 weken */
  const grens = iso(nuMs - 28 * DAG);
  let aanw = 0, mogelijk = 0;
  for (const s of presentie.filter(p => p.datum && p.datum >= grens)) for (const sp of actief){
    if (!teltMee(s, sp)) continue; mogelijk++; if (!(s.afwezig || []).includes(sp.id)) aanw++;
  }
  const opkomst = mogelijk ? Math.round(100 * aanw / mogelijk) : null;
  if (opkomst != null && opkomst < opkomstLaag) signalen.push({ soort: 'opkomst', ernst: 1, tekst: `opkomst ${opkomst}% (laatste 4 weken)` });

  /* 5. leerthema's voor deze leeftijd waar minstens één speler een leerpunt op heeft */
  const themas = leercurve.filter(t => { try { return leercurveRelevant(t, team.categorie); } catch (e) { return false; } });
  const bezig = themas.filter(t => actief.some(p => (p.leerpunten || []).some(l => l.tekst === t.thema)));
  const dekking = themas.length ? Math.round(100 * bezig.length / themas.length) : null;

  signalen.sort((a, b) => b.ernst - a.ernst);
  return { team, spelers: actief.length, opkomst, dekking, laatsteBeo, signalen, ernst: signalen.reduce((s, x) => s + x.ernst, 0) };
}

async function leesTeam(t, seizoen){
  const sz = seizoen ? [where('seizoen', '==', seizoen)] : [];
  const vanaf = iso(Date.now() - 120 * DAG);
  const [sp, pr, wd, beo] = await Promise.all([
    getDocs(collection(db, 'teams', t.id, 'spelers')),
    getDocs(query(collection(db, 'teams', t.id, 'presentie'), ...sz)),
    getDocs(query(collection(db, 'teams', t.id, 'wedstrijden'), ...sz)),
    getDocs(query(collection(db, 'teams', t.id, 'beoordelingen'), where('datum', '>=', vanaf))).catch(() => ({ docs: [] })),
  ]);
  const d = s => s.docs.map(x => ({ id: x.id, ...x.data() }));
  return weekbriefTeam({ team: t, spelers: d(sp), presentie: d(pr), wedstrijden: d(wd), beoordelingen: d(beo),
    opkomstLaag: ACTIEF?.dashboard?.opkomstLaag ?? 50 });
}

/* teams: de teams waarover de brief gaat; titel: bv. "Onderbouw" of de clubnaam. */
export async function openWeekbrief(teams, titel){
  openModal(`<h2>Weekbrief · ${esc(titel)}</h2><div class="kaart leeg">Teams doorlopen…</div>`);
  const seizoen = S.huidigSeizoen || S.club?.huidigSeizoen || null;
  const rijen = [];
  for (const t of teams){
    try { rijen.push(await leesTeam(t, seizoen)); }
    catch (e){ rijen.push({ team: t, signalen: [{ soort: 'fout', ernst: 0, tekst: 'niet te lezen (' + (e.code || e.message) + ')' }], ernst: 0 }); }
  }
  rijen.sort((a, b) => b.ernst - a.ernst || a.team.naam.localeCompare(b.team.naam, 'nl', { numeric: true }));
  const aandacht = rijen.filter(r => r.signalen.length);
  const dekkingen = rijen.map(r => r.dekking).filter(x => x != null);
  const gemDekking = dekkingen.length ? Math.round(dekkingen.reduce((a, b) => a + b, 0) / dekkingen.length) : null;
  const week = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - j) / DAG - 3 + ((j.getDay() + 6) % 7)) / 7); })();

  const tekstVoorDelen = [`Weekbrief ${titel} · week ${week}`, '',
    ...aandacht.map(r => `${r.team.naam}: ${r.signalen.map(s => s.tekst).join('; ')}`),
    aandacht.length ? '' : 'Alle teams in orde.', `${rijen.length - aandacht.length} van ${rijen.length} teams zonder aandachtspunten.`].join('\n');

  openModal(`<h2>Weekbrief · ${esc(titel)}</h2>
    <p class="cb-uitleg" style="margin:0 0 10px">Week ${week}. Alleen aantallen per team, geen namen.</p>
    <div class="pf-kpis">
      <div class="pf-kpi ${aandacht.length ? 'let' : ''}"><div class="g">${aandacht.length}<small>/${rijen.length}</small></div><div class="l">teams met aandachtspunt</div></div>
      <div class="pf-kpi"><div class="g">${gemDekking != null ? gemDekking + '%' : '—'}</div><div class="l">leerthema's in gebruik</div><div class="s">gemiddeld per team, voor hun leeftijd</div></div>
    </div>
    ${rijen.map(r => `<div class="wb-team ${r.signalen.length ? '' : 'ok'}">
      <div class="wb-kop"><b>${esc(r.team.naam)}</b><span>${r.spelers ?? '–'} spelers${r.opkomst != null ? ` · opkomst ${r.opkomst}%` : ''}${r.dekking != null ? ` · ${r.dekking}% thema's` : ''}</span></div>
      ${r.signalen.length ? `<ul>${r.signalen.map(s => `<li class="e${s.ernst}">${esc(s.tekst)}</li>`).join('')}</ul>` : '<div class="wb-ok">Niets bijzonders deze week</div>'}
    </div>`).join('')}
    <button class="knop licht vol" id="wbDeel" style="margin-top:12px">Delen (zonder namen)</button>`);
  document.getElementById('wbDeel').onclick = async () => {
    if (navigator.share){ try { await navigator.share({ text: tekstVoorDelen }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    window.open('https://wa.me/?text=' + encodeURIComponent(tekstVoorDelen), '_blank', 'noopener');
  };
}
