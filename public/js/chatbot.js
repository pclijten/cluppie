/* ==================== CLUPPIE HULP-CHATBOT (client) ====================
   Zwevende hulp-knop + chat-bottomsheet. Beantwoordt ALLEEN vragen over het
   gebruik van de app; de eigenlijke afhandeling (en de Anthropic API-key) zit
   veilig in de Cloud Function 'chatHulp' (europe-west1). Deze module stuurt
   enkel de sessie-berichten door en toont het antwoord.

   Kenmerken (afgestemd op de gemaakte keuzes):
   - Zwevende knop, altijd zichtbaar zodra je in een team/wedstrijd zit.
   - Onthoudt het gesprek PER SESSIE: de hele berichtenlijst gaat mee, zodat
     vervolgvragen ("en hoe wissel ik dan?") context hebben. Bij het sluiten
     van de app is de sessie weg (geen opslag = AVG-vriendelijk).
   - Kan de interactieve rondleiding aanbieden als iemand vastloopt.
   - [20261130a] Antwoordt in stappen en verwijst: naar de stap in de handleiding (met het schermbeeld erbij,
     uit gidsen-data.js), naar het scherm zelf ("Open …") en naar een rondleiding. De app stuurt mee op welk
     scherm je staat en wat bij de club uit staat. Staat AI uit, is het maximum bereikt of is er een storing,
     dan zoekt de chat zelf in de handleidingen. Het ontleden van het antwoord staat in chat-antwoord.js.

   Publieke API:
     initChatbot()   -> bouwt de chat-bottomsheet klaar (één keer, vanuit main.js)
     openChatbot()   -> opent de chat (aangeroepen vanuit de "Hulpchat"-tegel
                        onder Meer). Er is bewust GEEN zwevende knop meer:
                        die stond te veel in beeld op mobiel.
   ============================================================================ */

import { functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, terugLaag, terugLaagWeg } from './state.js?v=20261130m';
import { telGebruik } from './tracker.js?v=20261130m';
import { aiAan } from './clubconfig.js?v=20261130m';
import { startOnboarding, startOnboardingHoofdstuk, heeftOnboardingHoofdstuk } from './onboarding.js?v=20261130m';
import { mijnRollen } from './rolkaart.js?v=20261130m';
import { startVragen } from './hulp-rol.js?v=20261122a';
import { ico } from './icons.js?v=20261127b';
import { gidsMet, SCHERMEN } from './gidsen-data.js?v=20261130c';
import { ontleedAntwoord, antwoordHtml, lokaalAntwoord, vragenBijGids } from './chat-antwoord.js?v=20261130c';
import { gidsOnderdeelAan, schermMag, naarScherm, openGids, htmlStapKaart, pdfUrl, videoUrl, videoKlaar, speelVideo, toonGroot } from './gidsen.js?v=20261130m';

/* Sessiegeschiedenis — leeft alleen zolang de app open is. */
let berichten = [];   // [{role:'user'|'assistant', content:'...'}]
let bezig = false;
let gidsNu = null;     // de handleiding van waaruit de chat geopend is (Kom je er niet uit?)

const chatHulp = () => httpsCallable(functions, 'chatHulp');

/* [20261122a] Startvragen (chips) per rol: een coördinator of beheerder krijgt vragen over zijn eigen
   schermen, niet die van een coach. De lijsten staan in hulp-rol.js. */
const isLos = () => !!(S.team && S.teamId && !S.team.club);
const rollenNu = () => isLos() ? ['solo'] : mijnRollen();

export function initChatbot(){
  if (document.getElementById('cbAchter')) return;

  const achter = document.createElement('div');
  achter.id = 'cbAchter'; achter.className = 'cb-achter';
  achter.innerHTML = `
    <div class="cb-paneel">
      <div class="cb-kop">
        <div class="cb-avatar"></div>
        <div><div class="cb-naam">Cluppie-hulp</div>
          <div class="cb-sub">Vragen over de app</div></div>
        <button class="cb-help" id="cbHelp" title="Alle handleidingen">${ico('navigation-help', 18)}<span>Handleidingen</span></button>
        <button class="cb-x" id="cbX" aria-label="Sluiten">✕</button>
      </div>
      <div class="cb-lijf" id="cbLijf"></div>
      <div class="cb-chips" id="cbChips"></div>
      <div class="cb-invoer">
        <input id="cbInput" placeholder="Typ je vraag over de app…" autocomplete="off"
          autocapitalize="sentences" enterkeyhint="send">
        <button class="cb-stuur" id="cbStuur" aria-label="Versturen">➤</button>
      </div>
    </div>`;
  document.body.appendChild(achter);

  document.getElementById('cbX').onclick = sluitChat;
  document.getElementById('cbHelp').onclick = () => naarHelp(null, null);
  /* knoppen onder een antwoord: handleiding uitklappen, scherm openen, video, beeld vergroten */
  document.getElementById('cbLijf').addEventListener('click', e => {
    const k = e.target.closest('[data-cb]'); if (!k) return;
    const d = k.dataset;
    if (d.cb === 'gids'){ const uit = k.parentElement.querySelector('.cb-gids-uit'); const open = uit.hidden; uit.hidden = !open; k.setAttribute('aria-expanded', String(open)); if (open) telGebruik('chat_gids'); }
    else if (d.cb === 'heel') naarHelp(d.id, Number(d.stap));
    else if (d.cb === 'scherm'){ sluitChat(); naarScherm(d.code); telGebruik('chat_scherm'); }
    else if (d.cb === 'video') speelVideo(gidsMet(d.id));
    else if (d.cb === 'tour'){ sluitChat(); if (d.hfd) startOnboardingHoofdstuk(d.hfd); else startOnboarding(true); }
    else if (d.cb === 'groot') toonGroot(k);
  });
  achter.addEventListener('click', e => { if (e.target === achter) sluitChat(); });

  const stuur = () => {
    const inp = document.getElementById('cbInput');
    const v = (inp.value || '').trim();
    if (!v || bezig) return;
    inp.value = '';
    verstuur(v);
  };
  document.getElementById('cbStuur').onclick = stuur;
  document.getElementById('cbInput').addEventListener('keydown', e => { if (e.key === 'Enter') stuur(); });
  document.getElementById('cbChips').addEventListener('click', e => {
    const b = e.target.closest('.cb-chip'); if (!b || bezig) return;
    verstuur(b.textContent);
  });
}

/* Opent de hulpchat. Bouwt de bottomsheet lui op als dat nog niet gebeurd is
   (zodat een tik op de tegel altijd werkt, ook vóór de eerste init). */
export function openChatbot(opties = {}){
  if (!document.getElementById('cbAchter')) initChatbot();
  openChat(opties);
}

function openChat({ gids = null } = {}){
  const achter = document.getElementById('cbAchter');
  const lijf = document.getElementById('cbLijf');
  const g = gids ? gidsMet(gids) : null;
  document.getElementById('cbHelp').hidden = !S.teamId;
  if (g && g.id !== gidsNu){
    /* geopend vanuit een handleiding: de chat weet waar je vandaan komt */
    gidsNu = g.id;
    bot(`Je kijkt naar handleiding ${esc(g.id)}, <b>${esc(g.titel)}</b>. Waar loop je vast?`);
    toonChips(vragenBijGids(g.id));
  } else if (!berichten.length && !lijf.children.length){
    // eerste keer: welkom + startchips
    bot(aiAan()
      ? 'Hoi! Stel je vraag over <b>Cluppie</b> in je eigen woorden. Ik leg het uit in stappen en wijs je het scherm en de handleiding aan.'
      : 'Hoi! De AI-hulp staat bij jouw club uit. Typ waar je naar zoekt, dan zoek ik het voor je op in de <b>handleidingen</b>.');
    toonChips(startVragen(rollenNu(), { inTeam: !!S.teamId }));
  }
  achter.classList.add('open');
  /* Hardware-terug sluit de hulpchat (z-index 5000, boven alles). */
  terugLaag('chat', { z:5000, open: () => achter.classList.contains('open'), sluit: sluitChat });
  setTimeout(() => document.getElementById('cbInput')?.focus(), 300);
}
/* Naar Help: het overzicht, of één handleiding op een stap. Help is een tabblad van je team. */
function naarHelp(id, stap){
  if (!S.teamId) return;
  sluitChat();
  if (id) openGids(id, stap); else { S._gids = null; S._gidsStap = null; }
  import('./teams.js?v=20261130m').then(m => m.zetTeamTab('help'));
}
function sluitChat(){ document.getElementById('cbAchter')?.classList.remove('open'); terugLaagWeg('chat'); }

function toonChips(lijst){
  const c = document.getElementById('cbChips');
  c.innerHTML = (lijst || []).map(t => `<button class="cb-chip">${esc(t)}</button>`).join('');
}

/* Voeg een bericht toe aan de UI (en optioneel aan de sessiegeschiedenis). */
function bericht(html, wie){
  const lijf = document.getElementById('cbLijf');
  const m = document.createElement('div');
  m.className = 'cb-msg ' + wie;
  m.innerHTML = html;
  lijf.appendChild(m);
  lijf.scrollTop = lijf.scrollHeight;
  return m;
}
function ik(tekst){ bericht(esc(tekst), 'ik'); }
function bot(html){ bericht(html, 'bot'); }

function tik(aan){
  const lijf = document.getElementById('cbLijf');
  let t = document.getElementById('cbTik');
  if (aan && !t){
    t = document.createElement('div'); t.id = 'cbTik'; t.className = 'cb-msg bot cb-tik';
    t.innerHTML = '<span></span><span></span><span></span>';
    lijf.appendChild(t); lijf.scrollTop = lijf.scrollHeight;
  }
  if (!aan && t) t.remove();
}

/* Wat de server mag weten over waar je bent: het open scherm, je toestel en wat bij de club uit staat.
   Alleen codes van vaste lijsten; de server controleert ze nog eens (functions/kennis.js, contextRegel). */
function contextNu(){
  const actief = (document.querySelector('.view.actief')?.id || '').replace('view-', '');
  let scherm = '';
  if (S.teamId && S.teamTab) scherm = 'team:' + S.teamTab;
  else if (actief === 'club' && S.clubTab) scherm = 'club:' + S.clubTab;
  const uit = ['trainingsmodule', 'speelwijze', 'evaluaties', 'teamkamer', 'activiteiten', 'veldplanner'].filter(o => !gidsOnderdeelAan({ onderdeel: o }));
  return { scherm: SCHERMEN[scherm] ? scherm : '', apparaat: document.documentElement.classList.contains('desk') ? 'laptop' : 'telefoon', uit, gids: gidsNu || '' };
}

/* De verwijzingen onder een antwoord: handleiding (klapt uit met het schermbeeld), scherm openen, rondleiding. */
function htmlVerwijzingen({ gidsen = [], scherm = null, tour = null }, tekst = ''){
  const delen = [];
  for (const { id, stap } of gidsen){
    const g = gidsMet(id); if (!g) continue;
    const s = g.stappen[stap];
    delen.push(`<div class="cb-gids">
      <button class="cb-gids-kop" data-cb="gids" aria-expanded="false">
        <span class="cb-gids-nr">${esc(g.id)}</span>
        <span class="cb-gids-t"><b>${esc(s.t)}</b><small>Handleiding ${esc(g.titel)} · stap ${stap + 1} van ${g.stappen.length}</small></span>
        <span class="cb-gids-pijl">⌄</span>
      </button>
      <div class="cb-gids-uit gd" hidden>
        ${htmlStapKaart(id, stap).replace('data-gd-groot=', 'data-cb="groot" data-gd-groot=')}
        <div class="cb-gids-acties">
          ${S.teamId ? `<button class="cb-actie-knop" data-cb="heel" data-id="${esc(g.id)}" data-stap="${stap}">Open de hele handleiding</button>` : ''}
          ${g.video && videoKlaar() ? `<button class="cb-actie-knop licht" data-cb="video" data-id="${esc(g.id)}">Bekijk de video</button>` : ''}
          <a class="cb-actie-knop licht" href="${pdfUrl(g)}" target="_blank" rel="noopener" download>PDF</a>
        </div>
      </div>
    </div>`);
  }
  const knoppen = [];
  if (scherm && schermMag(scherm)) knoppen.push(`<button class="cb-actie-knop" data-cb="scherm" data-code="${esc(scherm)}">${ico('navigation-forward', 16)}Open ${esc(SCHERMEN[scherm])}</button>`);
  const hfd = tour && heeftOnboardingHoofdstuk(tour) ? tour : null;
  if (hfd) knoppen.push(`<button class="cb-actie-knop licht" data-cb="tour" data-hfd="${esc(hfd)}">Laat me ${esc(HFD_LABEL[hfd] || 'dit onderdeel')} zien</button>`);
  else if (/rondleiding/i.test(tekst)) knoppen.push('<button class="cb-actie-knop licht" data-cb="tour">Start de rondleiding</button>');
  if (knoppen.length) delen.push(`<div class="cb-knoppen">${knoppen.join('')}</div>`);
  return delen.join('');
}
function toonVerwijzingen(v, tekst){
  const html = htmlVerwijzingen(v, tekst); if (!html) return;
  const lijf = document.getElementById('cbLijf');
  const wrap = document.createElement('div'); wrap.className = 'cb-verwijs'; wrap.innerHTML = html;
  lijf.appendChild(wrap); lijf.scrollTop = lijf.scrollHeight;
}

/* Zonder AI: zelf zoeken in de handleidingen en de beste stappen laten zien. */
function antwoordLokaal(vraag, reden){
  const { gidsen, eerste } = lokaalAntwoord(vraag);
  if (!gidsen.length){
    bot(`${esc(reden)} In de handleidingen vond ik hier niets over. Probeer het met andere woorden${S.teamId ? ', of kijk onder <b>Help</b>' : ''}.`);
    return;
  }
  bot(`<p>${esc(reden)} Dit vond ik in de handleidingen:</p><p>${antwoordHtml(eerste, esc).replace(/^<p>|<\/p>$/g, '')}</p>`);
  toonVerwijzingen({ gidsen }, '');
  telGebruik('chat_lokaal');
}

async function verstuur(vraag){
  if (bezig) return;
  bezig = true;
  document.getElementById('cbChips').innerHTML = '';
  ik(vraag);
  telGebruik('chatbot');
  berichten.push({ role: 'user', content: vraag });

  if (!aiAan()){
    /* AI staat uit bij deze club: geen aanroep, wel een antwoord uit de handleidingen */
    berichten.pop();
    antwoordLokaal(vraag, '');
    bezig = false;
    return;
  }
  tik(true);
  try {
    /* een team zonder club vraagt via het team (eigen plafond per maand), de rest via de club */
    const doel = isLos() ? { teamId: S.teamId } : { clubId: S.clubId || S.team?.club || null };
    const res = await chatHulp()({ ...doel, berichten, rollen: rollenNu(), context: contextNu() });
    tik(false);
    const ruw = res?.data?.antwoord || 'Sorry, ik heb hier geen antwoord op.';
    /* De server sluit af met verwijzingen ([[GIDS:05#2]], [[SCHERM:…]], [[TOUR:…]], [[VERVOLG:…]]). Die gaan
       uit de zichtbare tekst en worden knoppen. In de geschiedenis staat alleen de schone tekst. */
    const a = ontleedAntwoord(ruw);
    const tekst = a.tekst || 'Sorry, ik heb hier geen antwoord op.';
    berichten.push({ role: 'assistant', content: tekst });
    bericht(antwoordHtml(tekst, esc), 'bot cb-rijk');
    toonVerwijzingen(a, tekst);
    toonChips(a.vervolg);
  } catch (err){
    tik(false);
    berichten.pop();   // de vraag is niet beantwoord: niet nog eens meesturen
    /* [20261115d] de foutcode komt van Firebase als 'functions/…'. Staat AI uit, is de limiet bereikt of
       is de vraag ongeldig, dan zegt de server waarom; alleen bij een echte storing 'even niet bereikbaar'.
       [20261130a] In al die gevallen (behalve opnieuw inloggen) zoekt de chat zelf in de handleidingen. */
    const code = String(err?.code || '').replace('functions/', '');
    console.error('[chatbot] fout:', err?.code, err?.message);
    if (code === 'unauthenticated') bot('Log opnieuw in om de hulp te gebruiken.');
    else if (code === 'invalid-argument' && err?.message) bot(esc(err.message));
    else if (code === 'demo/niet-beschikbaar') antwoordLokaal(vraag, 'In de demo zoekt de hulpchat in de handleidingen. In de echte app antwoordt de AI-hulp in je eigen woorden.');
    else antwoordLokaal(vraag, ['failed-precondition', 'resource-exhausted', 'permission-denied'].includes(code) && err?.message
      ? err.message : 'De AI-hulp is even niet bereikbaar.');
  } finally {
    bezig = false;
  }
}

/* Leesbare labels per rondleiding-hoofdstuk, voor de knoptekst. */
const HFD_LABEL = {
  team:'je team', wedstrijden:'de wedstrijden', opstelling:'de opstelling',
  spelers:'de spelers', training:'de trainingen', video:'de video’s',
  planning:'de planning', documenten:'de documenten', stats:'de statistieken',
  instellingen:'de instellingen', meer:'het Meer-menu',
};
