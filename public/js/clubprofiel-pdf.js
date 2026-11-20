/* ==================== CLUBPROFIEL: de inrichting als PDF ====================
   [20261120f] "Zo is Cluppie ingericht voor <club>": het document dat de eindbaas met de club deelt.
   Per hoofdstuk een tabel: het onderwerp, waar het in Cluppie staat (instelling, evaluatieronde, Clubwijzer,
   gouden regels) en hoe het is ingericht. Daarna wat nog niet is ingericht, met de vraag aan de club.
   De inhoud komt uit inrichtingOverzicht() (clubprofiel-logica.js): alleen wat echt in Cluppie is gezet.

   jsPDF + jspdf-autotable, lokaal meegeleverd (zelfde aanpak als trainingsgebruik-export.js). De standaardfonts
   van jsPDF kennen alleen Latin-1; pdfTekst() vervangt wat daarbuiten valt. Geen namen van personen: het
   clubprofiel bevat ze niet. */
const JSPDF_URL = 'vendor/jspdf.umd.min.js';
const AUTOTABLE_URL = 'vendor/jspdf.plugin.autotable.min.js';
const beloftes = {};
function laadScript(url, klaar){
  if (klaar()) return Promise.resolve();
  return (beloftes[url] ||= new Promise((ok, nok) => {
    const s = document.createElement('script'); s.src = url;
    s.onload = () => klaar() ? ok() : nok(new Error('PDF maken lukt nu niet'));
    s.onerror = () => { delete beloftes[url]; nok(new Error('PDF maken lukt nu niet')); };
    document.head.appendChild(s);
  }));
}
const rgb = hex => { const h = String(hex).replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
export const pdfTekst = s => String(s ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/›/g, '>').replace(/…/g, '...').replace(/•/g, '-').replace(/[^\x00-\xFF]/g, '');
const INKT = '1A1F26', ZACHT = '5A6572', LIJN = 'D9DEE4', VLAK = 'F2F4F7';

/* De rijen van één hoofdstuk voor de tabel: het onderwerp beslaat al zijn regels. Puur, ook los te testen. */
export function tabelRijen(hoofdstuk){
  const rijen = [];
  for (const o of hoofdstuk.onderwerpen) o.regels.forEach((r, i) => {
    const plek = r.plek + (r.concept ? ' (concept)' : ''), hoe = r.label ? `${r.label}: ${r.waarde}` : r.waarde;
    rijen.push([...(i === 0 ? [{ content: pdfTekst(o.label), rowSpan: o.regels.length, styles: { fontStyle: 'bold' } }] : []), pdfTekst(plek), pdfTekst(hoe)]);
  });
  return rijen;
}

export async function maakInrichtingPdf(ov){
  await laadScript(JSPDF_URL, () => !!window.jspdf?.jsPDF);
  await laadScript(AUTOTABLE_URL, () => !!window.jspdf?.jsPDF?.API?.autoTable);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marge = 16, breed = pdf.internal.pageSize.getWidth(), hoog = pdf.internal.pageSize.getHeight(), binnen = breed - 2 * marge;
  const kleur = rgb(ov.kleur);
  const zet = (stijl, grootte, hex) => { pdf.setFont('helvetica', stijl); pdf.setFontSize(grootte); pdf.setTextColor(...rgb(hex)); };

  /* kop */
  pdf.setFillColor(...kleur); pdf.rect(0, 0, breed, 7, 'F');
  let y = 26;
  zet('bold', 22, INKT); pdf.text(pdfTekst('Zo is Cluppie ingericht'), marge, y); y += 9;
  zet('bold', 14, INKT); pdf.text(pdfTekst(ov.clubNaam), marge, y); y += 7;
  zet('normal', 10, ZACHT); pdf.text(pdfTekst(`Stand van ${ov.datum}. ${ov.aantal} van de ${ov.totaal} onderwerpen ingericht.`), marge, y); y += 8;
  const intro = pdf.splitTextToSize(pdfTekst('Dit overzicht laat per onderwerp zien wat wij uit jullie eigen documenten hebben overgenomen en waar dat in Cluppie staat. Instellingen bepalen hoe de app werkt. Teksten in de Clubwijzer lezen jullie trainers in de app, onder Documenten. Klopt iets niet of is iets veranderd, geef het door: dan passen we het aan.'), binnen);
  zet('normal', 10, INKT); pdf.text(intro, marge, y); y += intro.length * 4.8 + 2;
  if (ov.heeftConcept){
    const c = pdf.splitTextToSize(pdfTekst('Teksten met "(concept)" staan klaar maar zijn nog niet zichtbaar voor trainers. De clubbeheerder publiceert ze in Cluppie onder Club > Content.'), binnen);
    zet('normal', 9, ZACHT); pdf.text(c, marge, y); y += c.length * 4.4 + 2;
  }

  const tabel = (kop, body, kolommen) => pdf.autoTable({
    startY: y, margin: { left: marge, right: marge, bottom: 16 }, head: [kop], body, theme: 'grid', rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, valign: 'top', textColor: rgb(INKT), lineColor: rgb(LIJN), lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: rgb(VLAK), textColor: rgb(ZACHT), fontStyle: 'bold', fontSize: 8 },
    columnStyles: kolommen,
  });
  const hoofdstukKop = (titel) => {
    if (y > hoog - 45){ pdf.addPage(); y = 20; }
    y += 6; zet('bold', 13, INKT); pdf.text(pdfTekst(titel), marge, y);
    pdf.setDrawColor(...kleur); pdf.setLineWidth(0.8); pdf.line(marge, y + 1.8, marge + 18, y + 1.8); y += 5;
  };

  if (!ov.hoofdstukken.length){ zet('normal', 10, ZACHT); pdf.text(pdfTekst('Er is nog niets in Cluppie gezet.'), marge, y + 6); y += 12; }
  for (const h of ov.hoofdstukken){
    hoofdstukKop(h.naam);
    tabel(['Onderwerp', 'Waar in Cluppie', 'Zo is het ingericht'], tabelRijen(h), { 0: { cellWidth: 44 }, 1: { cellWidth: 34, textColor: rgb(ZACHT) }, 2: { cellWidth: 'auto' } });
    y = pdf.lastAutoTable.finalY;
  }
  if (ov.open.length){
    hoofdstukKop('Nog niet ingericht');
    const uitleg = pdf.splitTextToSize(pdfTekst('Deze onderwerpen staan niet, maar half of tegenstrijdig in de documenten. Met jullie antwoord richten we ze in.'), binnen);
    zet('normal', 9, ZACHT); pdf.text(uitleg, marge, y + 1); y += uitleg.length * 4.4 + 2;
    tabel(['Hoofdstuk', 'Onderwerp', 'Vraag aan de club'], ov.open.map(m => [pdfTekst(m.hoofdstuk), { content: pdfTekst(m.label), styles: { fontStyle: 'bold' } }, pdfTekst(m.vraag)]),
      { 0: { cellWidth: 38, textColor: rgb(ZACHT) }, 1: { cellWidth: 44 }, 2: { cellWidth: 'auto' } });
    y = pdf.lastAutoTable.finalY;
  }

  /* voetregel op elke pagina */
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++){
    pdf.setPage(i); zet('normal', 8, '8B95A1');
    pdf.text(pdfTekst(`Cluppie, ingericht voor ${ov.clubNaam}`), marge, hoog - 8);
    pdf.text(`${i} / ${n}`, breed - marge, hoog - 8, { align: 'right' });
  }
  return pdf.output('blob');
}
