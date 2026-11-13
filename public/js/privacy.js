/* ====================================================================
   PRIVACY & MIJN GEGEVENS (AVG art. 15, 17 en 20)
   - inzage/export: alles wat Cluppie over jouw account heeft, als JSON
   - verwijderen: haalt je uit teams en clubs, wist je gebruiksgegevens en je account
   Dit draait via Cloud Functions (exporteerMijnGegevens, verwijderMijnAccount).
==================================================================== */
import { auth, functions, httpsCallable, signOut } from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261111d';
import { klikgedragAan, zetKlikgedrag } from './tracker.js?v=20261111d';

/* [20261113b] Opt-out klikgedrag (privacyverklaring 2026-10). Ook gebruikt in Instellingen › Mijn account. */
export function htmlKlikgedragKeuze(prefix){
  return `<label class="ci-schakel" style="margin:4px 0 12px"><input type="checkbox" id="${prefix}Klik" ${klikgedragAan() ? 'checked' : ''}>
    <span>Klikgedrag delen om Cluppie te verbeteren<br><small>Per sessie welke schermen je opent en in welke volgorde (geen namen, geen spelersgegevens). Uitzetten kan altijd; je keuze geldt voor je hele account.</small></span></label>`;
}
export function koppelKlikgedragKeuze(root, prefix){
  const cb = root.querySelector('#' + prefix + 'Klik');
  if (!cb) return;
  cb.onchange = async () => {
    try { await zetKlikgedrag(cb.checked); meld(cb.checked ? 'Klikgedrag delen staat aan' : 'Klikgedrag delen staat uit'); }
    catch(e){ meld('Bewaren mislukt: ' + (e.code || e.message)); }
  };
}

export function openPrivacy(){
  openModal(`
    <h2>Privacy &amp; mijn gegevens</h2>
    <p style="font-size:calc(13px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:12px">
      Je club bepaalt wat er over spelers wordt vastgelegd; Cluppie verwerkt dat in opdracht van je club.
      Van jou als coach bewaren we je naam, de teams en club waaraan je gekoppeld bent en wanneer je de app gebruikte.
      Zet geen medische gegevens of contactgegevens van kinderen in Cluppie.</p>
    ${htmlKlikgedragKeuze('pv')}
    <a class="knop licht vol" href="privacy.html" target="_blank" rel="noopener" style="display:block;text-align:center;margin-bottom:8px">Privacyverklaring lezen</a>
    <button class="knop licht vol" id="pvExport">Download mijn gegevens (JSON)</button>
    <button class="knop licht vol" id="pvWis" style="margin-top:8px;color:var(--accent)">Verwijder mijn account</button>
    <button class="knop licht vol" id="pvSluit" style="margin-top:8px">Sluiten</button>`);
  document.getElementById('pvSluit').onclick = sluitModal;
  koppelKlikgedragKeuze(document, 'pv');

  document.getElementById('pvExport').onclick = async (e) => {
    const knop = e.currentTarget; knop.disabled = true; knop.textContent = 'Bezig…';
    try {
      const { data } = await httpsCallable(functions, 'exporteerMijnGegevens')({});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cluppie-mijn-gegevens-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      meld('Je gegevens zijn gedownload');
    } catch(err){ meld('Downloaden mislukt: ' + (err.message || err.code)); }
    knop.disabled = false; knop.textContent = 'Download mijn gegevens (JSON)';
  };

  document.getElementById('pvWis').onclick = () => {
    openModal(`
      <h2>Account verwijderen?</h2>
      <p style="font-size:calc(13px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:12px">
        Je wordt uit al je teams en clubs gehaald en je account en gebruiksgegevens worden gewist. Dit kan niet ongedaan worden gemaakt.
        Wat je voor het team schreef (trainingen, opmerkingen, wedstrijden) blijft bij de club.
        Ben je de enige beheerder van een club, draag dan eerst het beheer over.</p>
      <button class="knop vol" id="pvWisOk" style="background:var(--accent)">Ja, verwijder mijn account</button>
      <button class="knop licht vol" id="pvWisNee" style="margin-top:8px">Annuleren</button>`);
    document.getElementById('pvWisNee').onclick = sluitModal;
    document.getElementById('pvWisOk').onclick = async (e) => {
      const knop = e.currentTarget; knop.disabled = true; knop.textContent = 'Bezig…';
      try {
        await httpsCallable(functions, 'verwijderMijnAccount')({ bevestig: true });
        sluitModal(); meld('Je account is verwijderd');
        try { await signOut(auth); } catch(_) {}
        location.reload();
      } catch(err){
        knop.disabled = false; knop.textContent = 'Ja, verwijder mijn account';
        meld(err.message || 'Verwijderen mislukt');
      }
    };
  };
}
