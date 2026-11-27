/* ==================== HULPCHAT: HET ANTWOORD ONTLEDEN [20261130a] ====================
   PURE module (geen DOM, geen Firebase). De hulpchat (functions/index.js, chatHulp) sluit een antwoord af
   met verwijzingen als [[GIDS:05#2]], [[SCHERM:team:stats]], [[TOUR:opstelling]] en [[VERVOLG:vraag|vraag]].
   Deze module haalt ze uit de tekst en controleert ze tegen wat er echt bestaat, zodat de app er knoppen
   van kan maken. Wat niet klopt, valt stil weg. Getest in tests/gidsen.test.mjs. */
import { GIDSEN, SCHERMEN, gidsMet, zoekGidsen, platTekst } from './gidsen-data.js?v=20261130c';

const MARKER = /\[\[\s*(GIDS|SCHERM|TOUR|VERVOLG)\s*:\s*([^\]]*)\]\]/gi;

/* → { tekst, gidsen: [{ id, stap }], scherm, tour, vervolg: [..] } (stap telt vanaf 0) */
export function ontleedAntwoord(ruw){
  const uit = { tekst: '', gidsen: [], scherm: null, tour: null, vervolg: [] };
  const tekst = String(ruw || '').replace(MARKER, (_, soort, waarde) => {
    const w = String(waarde).trim();
    switch (soort.toUpperCase()){
      case 'GIDS': {
        const m = w.match(/^(\d{1,2})\s*(?:#\s*(\d{1,2}))?$/); const g = m && gidsMet(m[1]);
        if (g && uit.gidsen.length < 2){
          const stap = m[2] ? Math.min(g.stappen.length, Math.max(1, Number(m[2]))) - 1 : 0;
          if (!uit.gidsen.some(x => x.id === g.id && x.stap === stap)) uit.gidsen.push({ id: g.id, stap });
        }
        break;
      }
      case 'SCHERM': if (!uit.scherm && Object.prototype.hasOwnProperty.call(SCHERMEN, w.toLowerCase())) uit.scherm = w.toLowerCase(); break;
      case 'TOUR': if (!uit.tour && /^[a-z]{2,20}$/i.test(w)) uit.tour = w.toLowerCase(); break;
      case 'VERVOLG': for (const v of w.split('|').map(x => x.trim()).filter(x => x.length > 3 && x.length <= 70)) if (uit.vervolg.length < 3) uit.vervolg.push(v); break;
    }
    return '';
  });
  /* een marker die halverwege is afgebroken (te lang antwoord) ook weghalen */
  uit.tekst = tekst.replace(/\[\[[^\]]*$/, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return uit;
}

/* Tekst naar veilige HTML: **vet**, genummerde stappen als lijst, streepjes als opsomming. `esc` komt van de app. */
export function antwoordHtml(tekst, esc){
  const vet = t => String(t).split(/(\*\*[^*]+\*\*)/g).map(d => { const m = d.match(/^\*\*([^*]+)\*\*$/); return m ? '<b>' + esc(m[1]) + '</b>' : esc(d); }).join('');
  const blokken = []; let lijst = null;
  for (const regel of String(tekst || '').split('\n')){
    const r = regel.trim();
    const nr = r.match(/^(\d{1,2})[.)]\s+(.*)$/), punt = r.match(/^[-•*]\s+(.*)$/);
    const soort = nr ? 'ol' : punt ? 'ul' : null;
    if (!soort){ lijst = null; if (r) blokken.push({ p: r }); continue; }
    if (!lijst || lijst.soort !== soort){ lijst = { soort, items: [] }; blokken.push(lijst); }
    lijst.items.push(nr ? nr[2] : punt[1]);
  }
  return blokken.map(b => b.p ? `<p>${vet(b.p)}</p>` : `<${b.soort} class="cb-stappen">${b.items.map(i => `<li><span>${vet(i)}</span></li>`).join('')}</${b.soort}>`).join('');
}

/* Zonder AI (uit bij de club, maximum bereikt of storing): zoek zelf in de handleidingen. */
export function lokaalAntwoord(vraag){
  const treffers = zoekGidsen(vraag, { max: 3 });
  const gidsen = []; for (const t of treffers) if (!gidsen.some(x => x.id === t.gids.id && x.stap === t.stap)) gidsen.push({ id: t.gids.id, stap: t.stap });
  return { gidsen, eerste: treffers[0] ? platTekst(treffers[0].gids.stappen[treffers[0].stap].x) : '' };
}

/* Startvragen bij een handleiding: de titels van de eerste stappen met een schermbeeld. */
export function vragenBijGids(id){
  const g = gidsMet(id); if (!g) return [];
  return g.stappen.filter(s => s.b).slice(0, 3).map(s => s.t.replace(/[?.!]+$/, ''));
}
export { GIDSEN };
