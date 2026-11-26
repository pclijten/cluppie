/* ==================== DRAAIBOEK ALS WORD (.docx) [20261126z] ====================
   PURE module (geen DOM): zet het documentmodel uit draaiboek-logica.js (draaiboekDoc) om in de
   bestanden van een .docx. Het inpakken (zip) gebeurt in de browser met JSZip (public/vendor/jszip.min.js).
   Bewust alleen export: een Word-bestand weer inlezen is foutgevoelig (een verschoven tabel of kop en de
   import raakt de weg kwijt), zie de thread "Maak draaiboek en evenementenplanner overzichtelijker".
   Getest in tests/draaiboek.test.mjs. */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const BREED = 9638;                       // A4 min 2 cm marge links en rechts, in twips

export const xmlEsc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function run(tekst, { vet = false, kleur = '', grootte = 0 } = {}){
  const rPr = (vet || kleur || grootte) ? `<w:rPr>${vet ? '<w:b/>' : ''}${kleur ? `<w:color w:val="${kleur}"/>` : ''}${grootte ? `<w:sz w:val="${grootte}"/>` : ''}</w:rPr>` : '';
  return String(tekst ?? '').split('\n').map((d, i) => `${i ? `<w:r>${rPr}<w:br/></w:r>` : ''}<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(d)}</w:t></w:r>`).join('');
}
const alinea = (tekst, { stijl = '', vet = false, kleur = '', grootte = 0, na = null } = {}) =>
  `<w:p>${stijl || na !== null ? `<w:pPr>${stijl ? `<w:pStyle w:val="${stijl}"/>` : ''}${na !== null ? `<w:spacing w:after="${na}"/>` : ''}</w:pPr>` : ''}${run(tekst, { vet, kleur, grootte })}</w:p>`;

const VAST = { 'klaar vóór': 1300, tijd: 1500, wanneer: 1300, aantal: 1000, begroot: 1400, werkelijk: 1400, via: 2000, rol: 2600, wie: 2300, plek: 1600 };
function breedtes(kop, vink){
  const w = kop.map((k, i) => (vink && i === 0 ? 420 : VAST[String(k).trim().toLowerCase()] || 0));
  const rest = BREED - w.reduce((s, x) => s + x, 0), vrij = w.filter(x => !x).length || 1;
  return w.map(x => x || Math.max(1200, Math.floor(rest / vrij)));
}
function cel(tekst, breedte, { vet = false, kop = false, midden = false } = {}){
  return `<w:tc><w:tcPr><w:tcW w:w="${breedte}" w:type="dxa"/>${kop ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F3F6"/>' : ''}</w:tcPr>`
    + `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${midden ? '<w:jc w:val="center"/>' : ''}</w:pPr>`
    + String(tekst ?? '').split('\n').map((d, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${vet || kop || i ? `<w:rPr>${vet || kop ? '<w:b/>' : ''}${i ? '<w:color w:val="555B63"/><w:sz w:val="18"/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(d)}</w:t></w:r>`).join('')
    + '</w:p></w:tc>';
}
function tabel(kop, rijen, { vink = false, stijl = 'CluppieTabel', metKop = true } = {}){
  const b = breedtes(kop, vink);
  const rij = (cellen, isKop) => `<w:tr>${isKop ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cellen.map((c, i) => cel(c, b[i], { kop: isKop, midden: vink && i === 0 })).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblStyle w:val="${stijl}"/><w:tblW w:w="${BREED}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>`
    + `<w:tblGrid>${b.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
    + (metKop ? rij(kop, true) : '') + rijen.map(r => rij(kop.map((_, i) => r[i] ?? ''), false)).join('') + '</w:tbl>' + alinea('', { na: 60 });
}
function gegevens(rijen){
  const b = [2900, BREED - 2900];
  return `<w:tbl><w:tblPr><w:tblStyle w:val="CluppieGegevens"/><w:tblW w:w="${BREED}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${b.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
    + rijen.map(([k, v]) => `<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${b[0]}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>${run(k, { kleur: '555B63' })}</w:p></w:tc>`
      + `<w:tc><w:tcPr><w:tcW w:w="${b[1]}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>${run(v, { kleur: v === '…' ? '9AA0A8' : '' })}</w:p></w:tc></w:tr>`).join('')
    + '</w:tbl>' + alinea('', { na: 60 });
}

export function documentXml(model){
  const m = model || { titel: '', secties: [] };
  let body = alinea(m.titel, { stijl: 'Title' });
  if (m.sub) body += alinea(m.sub, { stijl: 'Subtitle' });
  if (m.versie) body += alinea(m.versie, { kleur: '777777', grootte: 18 });
  (m.secties || []).forEach((s, i) => {
    body += alinea(`${i + 1}. ${s.kop}`, { stijl: 'Heading1' });
    if (s.eigenaar) body += alinea(`Eigenaar: ${s.eigenaar}`, { kleur: '555B63', na: 80 });
    for (const d of s.delen || []){
      if (d.soort === 'kop') body += alinea(d.tekst, { stijl: 'Heading2' });
      else if (d.soort === 'tekst') body += alinea(d.tekst);
      else if (d.soort === 'dl') body += gegevens(d.rijen || []);
      else if (d.soort === 'tabel') body += tabel(d.kop || [], d.rijen || [], { vink: !!d.vink });
    }
  });
  body += alinea('Gemaakt met Cluppie', { kleur: '9AA0A8', grootte: 16 });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}`
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="nl-NL"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:color w:val="555B63"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="D42A20"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="40"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="CluppieTabel"><w:name w:val="Cluppie tabel"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D6DAE0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D6DAE0"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E5EA"/></w:tblBorders></w:tblPr></w:style>
<w:style w:type="table" w:styleId="CluppieGegevens"><w:name w:val="Cluppie gegevens"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
</w:styles>`;

/* Alle bestanden van de .docx: { pad: inhoud }. */
export function docxBestanden(model){
  return {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    'docProps/core.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'
      + `<dc:title>${xmlEsc(model?.titel || 'Draaiboek')}</dc:title><dc:creator>Cluppie</dc:creator></cp:coreProperties>`,
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': STYLES,
    'word/document.xml': documentXml(model),
  };
}
