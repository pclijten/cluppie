/* ==================== Pushmeldingen in de trainersapp [20261126m] ====================
   Instellingen › Mijn account: een trainer zet meldingen aan op dit toestel en krijgt dan een melding als
   de clubbeheerder een bericht plaatst met het vinkje "Stuur een pushmelding" (functions/bericht-push.js).
   Zelfde opslag en dezelfde worker als de teamkamer (js/kamer-push.js, sw.js). */
import { staat, zetAan, zetUit, vernieuw } from './kamer-push.js?v=20261126z';
import { esc } from './state.js?v=20261128d';

const TEKST = {
  beginscherm: 'Op de iPhone kan dit pas als Cluppie op je beginscherm staat. Tik in Safari op <b>Deel</b> (het vierkantje met de pijl omhoog) en kies <b>Zet op beginscherm</b>. Open Cluppie daarna vanaf je beginscherm en zet hier meldingen aan.',
  geweigerd: 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon of browser (bij Cluppie of www.cluppie.io) en kom dan hier terug.',
};

export function toonPushKeuze(plek, uid, meld = () => {}){
  if (!plek || !uid) return;
  const st = staat();
  if (st === 'kan-niet'){ plek.innerHTML = ''; return; }
  const kop = '<div class="veldlabel">Meldingen op dit toestel</div>';
  if (TEKST[st]){ plek.innerHTML = `${kop}<p class="u-t-sm u-zacht u-mb-sm">${TEKST[st]}</p>`; return; }
  const aan = st === 'aan';
  plek.innerHTML = `${kop}<p class="u-t-sm u-zacht u-mb-sm">${aan ? 'Je krijgt een melding als de club een bericht voor je team plaatst.' : 'Krijg een melding als de club een bericht voor je team plaatst.'}</p>
    <button class="knop ${aan ? 'licht' : 'fluo'} vol u-mb-sm" id="iPush">${esc(aan ? 'Meldingen uitzetten' : 'Meldingen aanzetten')}</button>`;
  const knop = plek.querySelector('#iPush');
  knop.onclick = async () => {
    knop.disabled = true;
    try {
      if (aan){ await zetUit(uid); meld('Meldingen staan uit op dit toestel'); }
      else { await zetAan(uid); meld('Meldingen staan aan op dit toestel'); }
    } catch (e){ meld(e && e.message ? e.message : 'Dat lukte niet. Probeer het later opnieuw.'); }
    toonPushKeuze(plek, uid, meld);
  };
}
/* bij het openen van de app: een vernieuwd token bewaren */
export function vernieuwPush(uid){ return vernieuw(uid); }
