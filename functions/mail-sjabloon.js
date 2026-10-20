/* Opmaak van uitgaande e-mail (20261020c). Puur en zonder afhankelijkheden, dus eenvoudig te testen.
   Eén beschrijving → { text, html }: de tekstversie blijft als terugval (en voor mailprogramma's zonder HTML),
   de HTML-versie is tabelgebaseerd met inline stijlen, zodat Gmail, Outlook en Apple Mail hem gelijk tonen.

     maakMail({
       voorkop:  'Welkom',                       // klein label boven de titel (optioneel)
       titel:    'Jullie club staat klaar',
       alineas:  ['Hoi Jan,', 'Tekst …'],         // gewone alinea's
       stappen:  ['Logo kiezen', 'Teams …'],      // genummerde lijst (optioneel)
       gegevens: [['Club', 'RKVV Voorbeeld']],    // label/waarde-kaart (optioneel)
       knop:     { tekst: 'Naar Cluppie', url: 'https://www.cluppie.io/' },   // optioneel
       slot:     ['Veel plezier!'],               // alinea's na knop (optioneel)
       voet:     'Je ontvangt deze mail omdat …', // kleine grijze regel (optioneel)
     }) */

const KLEUR = { accent: '#e2342f', inkt: '#0e1013', tekst: '#1f2430', zacht: '#5b6472', rand: '#e6e8ec', vlak: '#f4f5f7', wit: '#ffffff' };
const LETTER = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
const KOP = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* alleen http(s)-links in knoppen; alles anders valt terug op de startpagina */
const veiligeUrl = u => /^https:\/\/[^\s"<>]+$/i.test(String(u || '')) ? String(u) : 'https://www.cluppie.io/';
/* regeleinden in een alinea worden <br> */
const alinea = (t, stijl = '') => `<p style="margin:0 0 16px;font-family:${LETTER};font-size:16px;line-height:1.6;color:${KLEUR.tekst};${stijl}">${esc(t).replace(/\r?\n/g, '<br>')}</p>`;

function maakMail(o = {}){
  const alineas = (o.alineas || []).filter(Boolean), slot = (o.slot || []).filter(Boolean);
  const stappen = (o.stappen || []).filter(Boolean), gegevens = (o.gegevens || []).filter(g => g && g[1] != null && String(g[1]).trim() !== '');
  const knop = o.knop && o.knop.tekst ? { tekst: String(o.knop.tekst), url: veiligeUrl(o.knop.url) } : null;

  /* ---- tekstversie ---- */
  const t = [];
  t.push(o.titel);
  alineas.forEach(a => t.push('', a));
  if (stappen.length) t.push('', ...stappen.map((s, i) => `${i + 1}. ${s}`));
  if (gegevens.length) t.push('', ...gegevens.map(([l, w]) => `${l}: ${w}`));
  if (knop) t.push('', `${knop.tekst}: ${knop.url}`);
  slot.forEach(a => t.push('', a));
  t.push('', '— Cluppie · www.cluppie.io');
  if (o.voet) t.push(o.voet);
  const text = t.join('\n');

  /* ---- HTML-versie ---- */
  const stappenHtml = stappen.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
      ${stappen.map((s, i) => `<tr>
        <td width="36" valign="top" style="padding:6px 0;"><div style="width:26px;height:26px;border-radius:13px;background:${KLEUR.accent};color:#ffffff;font-family:${KOP};font-size:16px;font-weight:700;line-height:26px;text-align:center;">${i + 1}</div></td>
        <td valign="top" style="padding:6px 0 6px 4px;font-family:${LETTER};font-size:16px;line-height:1.5;color:${KLEUR.tekst};">${esc(s)}</td>
      </tr>`).join('')}
    </table>` : '';

  const gegevensHtml = gegevens.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${KLEUR.vlak};border:1px solid ${KLEUR.rand};border-radius:10px;">
      ${gegevens.map(([l, w], i) => `<tr>
        <td width="120" valign="top" style="padding:${i === 0 ? '14px' : '4px'} 8px ${i === gegevens.length - 1 ? '14px' : '4px'} 16px;font-family:${LETTER};font-size:13px;line-height:1.5;color:${KLEUR.zacht};">${esc(l)}</td>
        <td valign="top" style="padding:${i === 0 ? '14px' : '4px'} 16px ${i === gegevens.length - 1 ? '14px' : '4px'} 0;font-family:${LETTER};font-size:15px;line-height:1.5;color:${KLEUR.tekst};">${esc(w).replace(/\r?\n/g, '<br>')}</td>
      </tr>`).join('')}
    </table>` : '';

  const knopHtml = knop ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr><td align="center" bgcolor="${KLEUR.accent}" style="border-radius:10px;">
        <a href="${esc(knop.url)}" style="display:inline-block;padding:14px 28px;font-family:${LETTER};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(knop.tekst)}</a>
      </td></tr>
    </table>` : '';

  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.titel)}</title></head>
<body style="margin:0;padding:0;background:${KLEUR.vlak};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(alineas[0] || o.titel || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KLEUR.vlak};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${KLEUR.wit};border-radius:14px;overflow:hidden;border:1px solid ${KLEUR.rand};">
    <tr><td style="background:${KLEUR.inkt};padding:20px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" width="40" height="40" align="center" bgcolor="${KLEUR.accent}" style="width:40px;height:40px;border-radius:10px;font-family:${KOP};font-size:30px;font-weight:700;line-height:40px;color:#ffffff;">C</td>
        <td valign="middle" style="padding-left:12px;font-family:${KOP};font-size:28px;font-weight:700;letter-spacing:.5px;color:#ffffff;">Cluppie</td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${KLEUR.accent};">&nbsp;</td></tr>
    <tr><td style="padding:32px 28px 12px;">
      ${o.voorkop ? `<div style="margin:0 0 6px;font-family:${LETTER};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${KLEUR.accent};">${esc(o.voorkop)}</div>` : ''}
      <h1 style="margin:0 0 20px;font-family:${KOP};font-size:32px;line-height:1.15;font-weight:700;color:${KLEUR.inkt};">${esc(o.titel)}</h1>
      ${alineas.map(a => alinea(a)).join('')}
      ${stappenHtml}${gegevensHtml}${knopHtml}
      ${slot.map(a => alinea(a)).join('')}
    </td></tr>
    <tr><td style="padding:16px 28px 28px;border-top:1px solid ${KLEUR.rand};">
      <p style="margin:0;font-family:${LETTER};font-size:12px;line-height:1.6;color:${KLEUR.zacht};">Cluppie · de trainersapp voor jeugdvoetbalclubs · <a href="https://www.cluppie.io/" style="color:${KLEUR.zacht};">www.cluppie.io</a>${o.voet ? `<br>${esc(o.voet)}` : ''}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { text, html };
}

module.exports = { maakMail, esc, veiligeUrl };
