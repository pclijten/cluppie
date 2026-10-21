/* ==================== DATUMVELDEN: TYPEN WERKT WEER (20261021) ====================
   Een <input type="date"> meldt een wijziging zodra de datum geldig is. Typ je "15-05-2" dan is jaar 0002 al
   geldig: de app tekende het scherm opnieuw, het veld sprong naar 15-05-0002 en typen lukte niet meer.
   Deze bewaker houdt change/input-gebeurtenissen van datumvelden tegen zolang het jaar nog niet vier cijfers
   heeft (1990–2199) en laat ze door bij een leeg veld of een volledige datum. Geen imports, geen afhankelijkheden;
   werkt voor alle datumvelden in de app, nu en later. */

export const jaarGeldig = w => !w || /^(199\d|20\d\d|21\d\d)-\d\d-\d\d$/.test(String(w));

function bewaak(e){
  const t = e.target;
  if (t && t.tagName === 'INPUT' && t.type === 'date' && !jaarGeldig(t.value)) e.stopImmediatePropagation();
}
if (typeof document !== 'undefined' && !window.__datumBewaker){
  window.__datumBewaker = true;
  document.addEventListener('change', bewaak, true);
  document.addEventListener('input', bewaak, true);
}
