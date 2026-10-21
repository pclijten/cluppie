/* ==================== CLUB AANMELDEN (20261011d) ====================
   Iedereen met een account kan zijn club aanmelden. De platformbeheerder keurt goed in het
   platformscherm; daarna is de aanvrager clubbeheerder en leidt de startlijst hem verder.
   Server: functions/aanmelding.js (meldClubAan). Link om te delen: https://www.cluppie.io/?aanmelden */

import { db, doc, getDoc, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261011g';
import { DISTRICTEN } from './clubconfig.js?v=20261021a';
import { zoekClubInSportlink, verkleinSportlinkLogo, leesbareKleur, htmlClubVondst } from './sportlink-clubinfo.js?v=20261021a';

export async function laadMijnAanmelding(el){
  if (!el || !S.user) return;
  let a = null;
  try { const s = await getDoc(doc(db, 'clubAanmeldingen', S.user.uid)); a = s.exists() ? s.data() : null; } catch (e) {}
  if (a && a.status === 'nieuw'){
    el.innerHTML = `<div class="kaart"><b>Aanmelding van ${esc(a.clubNaam)} is binnen</b>
      <p class="cb-uitleg" style="margin:4px 0 0">We bekijken hem zo snel mogelijk. Je krijgt een mail op ${esc(a.contactEmail)} zodra de club klaarstaat.</p></div>`;
    return;
  }
  if (a && a.status === 'afgewezen'){
    el.innerHTML = `<div class="kaart"><b>Aanmelding van ${esc(a.clubNaam)}</b><p class="cb-uitleg" style="margin:4px 0 0">Deze aanmelding is niet goedgekeurd.${a.reden ? ' ' + esc(a.reden) : ''}</p></div>`;
    return;
  }
  el.innerHTML = `<div class="kaart ca-uitnodiging">
    <b>Heeft jouw club nog geen Cluppie?</b>
    <p class="cb-uitleg" style="margin:4px 0 10px">Meld je club aan. Na goedkeuring ben jij clubbeheerder en zet je in een kwartier alle teams klaar, rechtstreeks uit Sportlink.</p>
    <button class="knop vol" id="caOpen">Club aanmelden</button></div>`;
  el.querySelector('#caOpen').onclick = () => modalClubAanmelden(() => laadMijnAanmelding(el));
}

export function modalClubAanmelden(naVersturen){
  const naam = S.user?.displayName || '';
  const mail = S.user?.email || '';
  /* [20261012a] eerst (optioneel) de Sportlink Client ID: dan vullen we naam, plaats, logo en kleur in */
  const SL = { clientId: '', clubcode: '', logo: '', kleur: '', bestaatAl: false };
  openModal(`<h2>Club aanmelden</h2>
    <p class="cb-uitleg" style="margin:0 0 12px">Heb je de Sportlink Client ID van je club? Dan vullen we de rest voor je in. Zonder ID vul je in wat je weet; de rest regel je later in de app.</p>
    <div class="cb-kaart sl-zoek">
      <div class="veldgroep" style="margin:0"><label for="caClient">Sportlink Client ID (optioneel)</label>
        <div class="rij sl-zoek-rij"><input class="invoer" id="caClient" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Bijv. k7Rq2pX9aW">
          <button class="knop fluo" id="caZoek">Zoek club</button></div>
        <p class="cb-uitleg" style="margin:6px 0 0">Te vinden in Sportlink Club → Koppelingen → Club.Dataservice.</p></div>
      <div id="caVondst" aria-live="polite"></div>
    </div>
    <div class="veldgroep"><label>Naam van de club</label><input class="invoer" id="caClub" maxlength="60" autocomplete="organization" placeholder="Bijv. RKVV Voorbeeld"></div>
    <div class="rij">
      <div class="veldgroep" style="flex:1"><label>Plaats</label><input class="invoer" id="caPlaats" maxlength="60" autocomplete="address-level2"></div>
      <div class="veldgroep" style="flex:1"><label>KNVB-district</label><select class="invoer" id="caDistrict"><option value="">Weet ik niet</option>${DISTRICTEN.map(d => `<option value="${d.id}">${esc(d.naam)}</option>`).join('')}</select></div>
    </div>
    <div class="rij">
      <div class="veldgroep" style="flex:2"><label>Jouw naam</label><input class="invoer" id="caNaam" maxlength="80" value="${esc(naam)}" autocomplete="name"></div>
      <div class="veldgroep" style="flex:1"><label>Aantal teams</label><input class="invoer" id="caTeams" type="number" min="0" max="200" inputmode="numeric"></div>
    </div>
    <div class="veldgroep" id="caKleurRij" hidden><label>Clubkleur</label><div class="invoer sl-auto" id="caKleur"></div></div>
    <div class="veldgroep"><label>Jouw rol bij de club</label><input class="invoer" id="caRol" maxlength="60" placeholder="Bijv. jeugdcoördinator, bestuurslid"></div>
    <div class="veldgroep"><label>Hoe werkt jullie jeugdopleiding?</label>
      <label class="ci-schakel"><input type="radio" name="caWerk" value="club" checked><span><b>Coördinatoren sturen de lijn</b> · er zijn bouwen of een hoofd jeugd. Trainers ontvangen het plan.</span></label>
      <label class="ci-schakel"><input type="radio" name="caWerk" value="vrij"><span><b>Iedere trainer werkt zelfstandig</b> · trainers maken hun eigen trainingen en plan.</span></label>
      <p class="cb-uitleg">Je kunt dit later aanpassen onder Instellingen. Weet je het nog niet? Laat het dan staan.</p></div>
    <div class="veldgroep"><label>E-mailadres</label><input class="invoer" id="caMail" type="email" maxlength="120" value="${esc(mail)}" autocomplete="email"></div>
    <div class="veldgroep"><label>Nog iets dat we moeten weten? (optioneel)</label><textarea class="invoer" id="caBericht" rows="3" maxlength="1000"></textarea></div>
    <label class="ci-schakel"><input type="checkbox" id="caAkkoord"><span>Ik meld deze club aan namens de club en ga akkoord met de <a href="privacy.html" target="_blank" rel="noopener">privacyverklaring</a>. De club sluit later digitaal de verwerkersovereenkomst af.</span></label>
    <button class="knop vol" id="caVerstuur" style="margin-top:12px">Aanmelding versturen</button>`);
  const $m = id => document.getElementById(id);
  const vul = (id, waarde) => { const el = $m(id); if (el && waarde){ el.value = waarde; el.classList.add('sl-auto'); } };
  $m('caZoek').onclick = async e => {
    const k = e.currentTarget, uit = $m('caVondst');
    k.disabled = true; uit.innerHTML = '<div class="sl-laden"><span class="sl-spin"></span>Club opzoeken in Sportlink…</div>';
    try {
      const info = await zoekClubInSportlink($m('caClient').value);
      Object.assign(SL, { clientId: '', clubcode: '', logo: '', kleur: '', bestaatAl: !!info.bestaatAl });
      if (info.gevonden && !info.bestaatAl){
        const [logo, kleur] = await Promise.all([verkleinSportlinkLogo(info.logo), leesbareKleur(info.kleur)]);
        Object.assign(SL, { clientId: $m('caClient').value.trim(), clubcode: info.clubcode, logo, kleur: kleur || '' });
        vul('caClub', info.clubnaam); vul('caPlaats', info.plaats); if (info.aantalTeams) vul('caTeams', String(info.aantalTeams));
        if (kleur){ $m('caKleur').innerHTML = `<span class="sl-kleurstip" style="background:${esc(kleur)}"></span>${esc(info.kleurTekst || kleur)}`; $m('caKleurRij').hidden = false; }
        uit.innerHTML = htmlClubVondst(info, { logo, kleur });
      } else {
        $m('caKleurRij').hidden = true;
        uit.innerHTML = htmlClubVondst(info);
      }
      $m('caVerstuur').disabled = SL.bestaatAl;
    } catch (x){ uit.innerHTML = htmlClubVondst(null, { fout: x }); }
    finally { k.disabled = false; }
  };
  $m('caClient').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $m('caZoek').click(); } });
  $m('caVerstuur').onclick = async e => {
    const k = e.currentTarget;
    const data = {
      clubNaam: $m('caClub').value.trim(), plaats: $m('caPlaats').value.trim(), district: $m('caDistrict').value,
      contactNaam: $m('caNaam').value.trim(), aantalTeams: $m('caTeams').value, rol: $m('caRol').value.trim(), werkwijze: document.querySelector('input[name="caWerk"]:checked')?.value === 'vrij' ? 'vrij' : 'club',
      contactEmail: $m('caMail').value.trim(), bericht: $m('caBericht').value.trim(), akkoord: $m('caAkkoord').checked,
      ...(SL.clientId ? { sportlinkClientId: SL.clientId, sportlinkClubcode: SL.clubcode } : {}),
      ...(SL.logo ? { logo: SL.logo } : {}), ...(SL.kleur ? { kleur: SL.kleur } : {}),
    };
    if (SL.bestaatAl) return meld('Deze club staat al op Cluppie. Vraag je clubbeheerder om een uitnodiging.');
    if (data.clubNaam.length < 2) return meld('Vul de naam van de club in');
    if (!data.contactNaam) return meld('Vul je naam in');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contactEmail)) return meld('Vul een geldig e-mailadres in');
    if (!data.akkoord) return meld('Vink het akkoord aan');
    k.disabled = true; k.textContent = 'Versturen…';
    try {
      await httpsCallable(functions, 'meldClubAan')(data);
      sluitModal(); meld('Aanmelding verstuurd ✓ Je krijgt een mail zodra je club klaarstaat.');
      if (naVersturen) naVersturen();
    } catch (x){
      k.disabled = false; k.textContent = 'Aanmelding versturen';
      meld(x.code === 'functions/not-found' ? 'Aanmelden is nog niet beschikbaar. Mail ons via de over-pagina.' : (x.message || 'Versturen mislukt'));
    }
  };
}
