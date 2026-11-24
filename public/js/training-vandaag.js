/* ==================== TRAINING AANPASSEN VOOR VANDAAG — BALK EN OPSLAG ====================
   [20261116l] Bovenaan elke training staat de balk "Vandaag": Spelers (− +) en Weer (Gewoon, Koud, Regen, Warm), met
   voorstellen uit de presentie en het weerbericht. De training past zich meteen aan (training-vandaag-logica.js).
   Mockup "Cluppie: training aanpassen voor vandaag" en beslispunten: akkoord Paul 16-11-2026.

   Opslag: teams/{teamId}/trainingVandaag/{trainingId} = { spelers, weer, vervangen:{index: vormId}, datum, door, bijgewerkt }.
   Alleen aantallen en keuzes, nooit namen. Valt onder de bestaande team-rule /teams/{teamId}/{sub=**}: geen rules-wijziging.
   Het trainingsdocument zelf verandert niet: het plan van de club blijft heel en "Terug naar het plan" haalt alleen dit
   document weg. De aanpassing is per team, dus een clubtraining voor drie teams heeft per team een eigen aantal.

   Besluiten: de presentie is een voorstel (één tik), nooit automatisch; een coach mag dit ook als de club de trainingen
   stuurt, want de inhoud blijft van de club en een oefening wordt alleen vervangen als hij met dat aantal niet kan.

   Twee schermen gebruiken dit: de trainingsweergave (training-weergave.js, laadt deze module pas als hij nodig is) en het
   trainingsscherm op desktop (desktop-schermen.js). Beide vragen vandaagVan(t) op bij het tekenen en luisteren met
   opWijziging() om opnieuw te tekenen. Klikken in de balk worden hier één keer voor het hele document afgehandeld. */
import { db, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261124v';
import { vormen, laadBibliotheek, bibliotheekGeladen } from './bibliotheek.js?v=20261121b';
import { speelwijzeNu } from './speelwijze.js?v=20261124v';
import { weerLocatie } from './clubconfig.js?v=20261124v';
import { vastePrefill } from './vaste-afmeldingen.js?v=20261013a';
import { momentenVanTeam } from './trainingsmomenten.js?v=20261124v';
import { pasAan, schoonKeuze, isAangepast, weerVoorstel, WEERKEUZES, MIN_SPELERS, MAX_SPELERS } from './training-vandaag-logica.js?v=20261124v';

const K = new Map();            /* 'team|training' → { keuze (of null), geladen } */
const W = new Map();            /* 'lat,lon|datum|uur' → { voorstel } of 'bezig' */
const luisteraars = new Set();
const timers = new Map();
const sleutel = (teamId, trainingId) => `${teamId}|${trainingId}`;
const meldAan = () => { for (const f of [...luisteraars]){ try { f(); } catch (e){ console.warn('[vandaag] opnieuw tekenen mislukt', e); } } };

/* Aanmelden om opnieuw te tekenen na een wijziging. Geeft de afmeldfunctie terug. */
export function opWijziging(fn){ luisteraars.add(fn); return () => luisteraars.delete(fn); }

/* ---------- laden en bewaren ---------- */
async function laad(teamId, trainingId){
  const sl = sleutel(teamId, trainingId);
  if (K.has(sl)) return;
  K.set(sl, { keuze: null, geladen: false });
  try {
    const sn = await getDoc(doc(db, 'teams', teamId, 'trainingVandaag', trainingId));
    const d = sn?.exists?.() ? sn.data() : null;
    const st = K.get(sl);
    if (st && !st.gewijzigd) st.keuze = d ? schoonKeuze(d) : null;          /* een tik tijdens het laden gaat voor */
    if (st) st.geladen = true;
    if (d) meldAan();
  } catch (e){
    const st = K.get(sl); if (st) st.geladen = true;                         /* geen recht of geen verbinding: de training staat er zoals gepland */
  }
}
function bewaar(teamId, t, keuze){
  const sl = sleutel(teamId, t.id);
  clearTimeout(timers.get(sl));
  timers.set(sl, setTimeout(async () => {
    const ref = doc(db, 'teams', teamId, 'trainingVandaag', t.id);
    try {
      if (!keuze) await deleteDoc(ref);
      else await setDoc(ref, { spelers: keuze.spelers, weer: keuze.weer, vervangen: keuze.vervangen || {}, datum: t.datum || null, door: S.user?.uid || null, bijgewerkt: serverTimestamp() }, { merge: true });
    } catch (e){ meld('De aanpassing is niet bewaard: ' + (e.code === 'permission-denied' ? 'je mag dit voor dit team niet wijzigen' : 'geen verbinding') + '. Hij geldt nu alleen op dit scherm.'); }
  }, 500));
}

/* ---------- context van het team ---------- */
const team = (teamId) => (S.teamId === teamId ? S.team : (S.teams || []).find(x => x.id === teamId)) || null;
function bereken(t, keuze, teamId){
  return pasAan({ oefeningen: t.oefeningen, thema: t.thema, duur: t.duur }, keuze,
    { vormen: vormen(), categorie: team(teamId)?.categorie, speelwijze: S.teamId === teamId ? speelwijzeNu() : null, seed: t.id });
}
/* Verwacht aantal spelers op de datum van de training: de vastgelegde presentie telt het zwaarst, dan de vaste
   afmeldingen, anders de hele selectie. Alleen aantallen. */
function verwacht(datum, teamId){
  if (S.teamId !== teamId) return null;
  const ids = (S.spelers || []).filter(p => p && !p.gast && !p._ingeleend).map(p => p.id);
  if (!ids.length) return null;
  const sessie = datum ? (S.presentie || []).find(x => x.datum === datum) : null;
  let afw = [], bron = 'selectie';
  if (sessie){ afw = sessie.afwezig || []; bron = 'presentie'; }
  else if (datum){ try { afw = vastePrefill(S.team, datum, ids).afwezig; if (afw.length) bron = 'vast'; } catch (e){ afw = []; } }
  const weg = afw.filter(id => ids.includes(id)).length;
  return { n: Math.max(MIN_SPELERS, Math.min(MAX_SPELERS, ids.length - weg)), selectie: ids.length, afwezig: weg, bron };
}

/* ---------- weerbericht op het trainingsmoment (Open-Meteo; alleen coördinaten en datum gaan naar buiten) ---------- */
function trainingsUur(t, teamId){
  if (!t.datum) return { uur: 18, tekst: '18:00' };
  const dag = (new Date(t.datum + 'T12:00').getDay() + 6) % 7 + 1;
  const m = momentenVanTeam(team(teamId)).find(x => x.dag === dag && x.start);
  return m ? { uur: Number(m.start.slice(0, 2)), tekst: m.start } : { uur: 18, tekst: '18:00' };
}
/* [20261120k] Begintijd van de training ("18:30") uit de trainingsmomenten van het team, of null als die niet bekend is.
   Voor de tijdlijn in de trainingsweergave. */
export function startTijd(t, teamId = S.teamId){
  if (!t?.datum || !team(teamId)) return null;
  const dag = (new Date(t.datum + 'T12:00').getDay() + 6) % 7 + 1;
  return momentenVanTeam(team(teamId)).find(x => x.dag === dag && x.start)?.start || null;
}
function weerbericht(t, teamId){
  if (!t.datum || typeof fetch !== 'function') return null;
  const dagen = Math.round((new Date(t.datum + 'T12:00') - new Date(new Date().toDateString())) / 864e5);
  if (!(dagen >= 0 && dagen <= 7)) return null;                              /* alleen binnen een week is een weerbericht iets waard */
  const loc = weerLocatie(); if (!loc) return null;
  const { uur, tekst } = trainingsUur(t, teamId), sl = `${loc.lat},${loc.lon}|${t.datum}|${uur}`;
  const w = W.get(sl);
  if (w && w !== 'bezig') return w.voorstel ? { ...w.voorstel, tijd: tekst } : null;
  if (w === 'bezig') return null;
  W.set(sl, 'bezig');
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code&timezone=Europe%2FAmsterdam&start_date=${t.datum}&end_date=${t.datum}`)
    .then(r => r.json()).then(f => {
      const i = (f?.hourly?.time || []).findIndex(x => Number(x.slice(11, 13)) === uur);
      const voorstel = i >= 0 ? weerVoorstel({ temp: f.hourly.temperature_2m[i], gevoel: f.hourly.apparent_temperature?.[i], mm: f.hourly.precipitation?.[i], kans: f.hourly.precipitation_probability?.[i], code: f.hourly.weather_code?.[i] }) : null;
      W.set(sl, { voorstel });
      if (voorstel) meldAan();
    }).catch(() => { W.set(sl, { voorstel: null }); });
  return null;
}

/* ---------- de balk ---------- */
const WEERNAAM = Object.fromEntries(WEERKEUZES);
const vinkje = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/></svg>';

/* Html van de balk en de kaart eronder. res = uitkomst van pasAan, voorstellen = { presentie, weer }. PUUR (voor de test).
   [20261124a] Een training zonder één oefening uit de bibliotheek (eigen PDF of eigen tekst) kan Cluppie niet aanpassen:
   dan geen balk en geen tipskaart, de training staat er gewoon zoals hij is (wens Paul 24-11-2026). */
export function htmlVandaag(t, teamId, res, keuze, voorstellen = {}){
  if (!res.kan) return '';
  const k = schoonKeuze(keuze), n = res.spelers, weer = res.weer || '';
  const aangepast = isAangepast(k, res.gepland);
  const vp = voorstellen.presentie, vw = voorstellen.weer;
  const regels = [];
  /* de hele selectie is alleen een voorstel als het plan voor een ander aantal is gemaakt */
  if (vp && vp.n !== n && (vp.bron !== 'selectie' || vp.n !== res.gepland)) regels.push(`<div class="tv-voorstel"><span><b>${vp.bron === 'presentie' ? 'Presentie' : vp.bron === 'vast' ? 'Vaste afmeldingen' : 'Selectie'}:</b> ${vp.bron === 'selectie' ? `${vp.selectie} spelers` : `${vp.selectie - vp.afwezig} van ${vp.selectie} aanwezig`}</span><button type="button" class="knop klein licht" data-tv="neem-n" data-n="${vp.n}">Neem over</button></div>`);
  if (vw && vw.onweer) regels.push(`<div class="tv-voorstel let-op"><span><b>Let op:</b> om ${esc(vw.tijd)} wordt onweer verwacht. Train dan niet buiten.</span></div>`);
  if (vw && vw.weer && vw.weer !== weer) regels.push(`<div class="tv-voorstel"><span><b>Weerbericht ${esc(vw.tijd)}:</b> ${esc(vw.tekst)}. Voorstel: ${esc(WEERNAAM[vw.weer])}</span><button type="button" class="knop klein licht" data-tv="neem-weer" data-w="${esc(vw.weer)}">Neem over</button></div>`);
  const balk = `<div class="tv-kaart${aangepast ? ' aan' : ''}">
      <div class="tv-kop"><b>Vandaag</b><span>Gepland voor ${res.gepland} spelers, gewoon weer</span></div>
      <div class="tv-rij"><span class="tv-l">Spelers</span><div class="tv-stap"><button type="button" data-tv="min" aria-label="Eén speler minder"${n <= MIN_SPELERS ? ' disabled' : ''}>−</button><b aria-live="polite">${n}</b><button type="button" data-tv="plus" aria-label="Eén speler meer"${n >= MAX_SPELERS ? ' disabled' : ''}>+</button></div></div>
      <div class="tv-rij tv-rij-weer"><span class="tv-l">Weer</span><div class="tv-weer" role="group" aria-label="Weer">${WEERKEUZES.map(([w, naam]) => `<button type="button" data-tv="weer" data-w="${esc(w)}" aria-pressed="${weer === w}">${esc(naam)}</button>`).join('')}</div></div>
      ${regels.length ? `<div class="tv-voorstellen">${regels.join('')}</div>` : ''}
    </div>`;
  let onder = '';
  if (res.aangepast){
    const delen = [...(n !== res.gepland ? [`${n} spelers`] : []), ...(weer ? [WEERNAAM[weer].toLowerCase()] : [])];
    const w = res.wijzigingen;
    onder = `<div class="tv-kaart tv-aangepast"><div class="tv-status"><span class="tv-vink">${vinkje}</span><div><div class="tv-titel">Aangepast voor vandaag</div><div class="tv-sub">${esc(delen.join(' · '))} · ${w.length} ${w.length === 1 ? 'wijziging' : 'wijzigingen'}</div></div></div>
      ${w.map(x => `<div class="tv-wijz"><span class="tv-label ${esc(x.soort)}">${esc(x.label)}</span><span><b>${esc(x.kop)}:</b> ${esc(x.tekst)}</span></div>`).join('')}
      ${res.weerMelding ? `<div class="tv-wijz"><span class="tv-label weer">${esc(WEERNAAM[weer])}</span><span>${esc(res.weerMelding.replace(/^[^:]+:\s*/, '').replace(/^./, c => c.toUpperCase()))}</span></div>` : ''}
      <p class="tv-noot">Thema, leerdoel en coachwoorden blijven gelijk${res.eigen ? `. ${res.eigen} ${res.eigen === 1 ? 'oefening komt' : 'oefeningen komen'} niet uit de bibliotheek en ${res.eigen === 1 ? 'blijft' : 'blijven'} zoals ${res.eigen === 1 ? 'hij is' : 'ze zijn'}` : ''}. De totale duur blijft gelijk.</p>
      <button type="button" class="knop vol licht" data-tv="terug">Terug naar het plan</button></div>`;
  } else {
    onder = '<p class="tv-uitleg">Zo staat de training in het plan. Verander het aantal spelers of het weer en de training past zich meteen aan.</p>';
  }
  return `<div class="tv" data-tv-team="${esc(teamId)}" data-tv-training="${esc(t.id)}">${balk}${onder}</div>`;
}

/* Wat een scherm nodig heeft om een training te tekenen: { html (de balk), oefeningen (voor vandaag), aangepast }.
   Zonder team of zonder oefeningen: geen balk en de oefeningen zoals ze zijn. */
export function vandaagVan(t, teamId = S.teamId){
  const basis = Array.isArray(t?.oefeningen) ? t.oefeningen : [];
  if (!t?.id || !teamId || !basis.length || !team(teamId)) return { html: '', oefeningen: basis, aangepast: false };
  const sl = sleutel(teamId, t.id);
  if (!K.has(sl)) laad(teamId, t.id);
  if (!bibliotheekGeladen()) laadBibliotheek().then(meldAan).catch(() => {});
  const keuze = K.get(sl)?.keuze || null;
  const res = bereken(t, keuze, teamId);
  return { html: htmlVandaag(t, teamId, res, keuze, { presentie: verwacht(t.datum, teamId), weer: weerbericht(t, teamId) }), oefeningen: res.oefeningen, aangepast: res.aangepast };
}

/* ---------- klikken in de balk ---------- */
function zet(teamId, t, wijzig){
  const sl = sleutel(teamId, t.id), st = K.get(sl) || { keuze: null, geladen: true };
  const nu = bereken(t, st.keuze, teamId);
  let k = schoonKeuze({ spelers: nu.spelers, weer: nu.weer, vervangen: st.keuze?.vervangen || {}, ...wijzig });
  const res = bereken(t, k, teamId);
  k.vervangen = { ...k.vervangen, ...res.vervangen };
  if (!isAangepast(k, res.gepland)) k = null;
  K.set(sl, { ...st, keuze: k, gewijzigd: true });
  meldAan();
  bewaar(teamId, t, k);
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const b = e.target?.closest?.('[data-tv]'); if (!b) return;
  const wrap = b.closest('.tv[data-tv-training]'); if (!wrap) return;
  const teamId = wrap.dataset.tvTeam, t = (S.trainingen || []).find(x => x.id === wrap.dataset.tvTraining);
  if (!t || !teamId) return;
  const a = b.dataset.tv, nu = bereken(t, K.get(sleutel(teamId, t.id))?.keuze || null, teamId);
  if (a === 'min') zet(teamId, t, { spelers: Math.max(MIN_SPELERS, nu.spelers - 1) });
  else if (a === 'plus') zet(teamId, t, { spelers: Math.min(MAX_SPELERS, nu.spelers + 1) });
  else if (a === 'neem-n') zet(teamId, t, { spelers: Number(b.dataset.n) });
  else if (a === 'weer' || a === 'neem-weer') zet(teamId, t, { weer: b.dataset.w || null });
  else if (a === 'terug') zet(teamId, t, { spelers: nu.gepland, weer: null, vervangen: {} });
});
