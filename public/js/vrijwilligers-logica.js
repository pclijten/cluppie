/* ==================== VRIJWILLIGERSBANK-LOGICA [20261125w] ====================
   Pure logica (geen DOM, geen Firebase) voor de vrijwilligersbank van de club.
   De club zet taken op een openbare pagina (?taken=<id>) met een vaste omschrijving: wat je precies
   doet (in stappen), wanneer, hoe lang, waar, voor wie het geschikt is en wat je ervoor terugkrijgt.
   Zo weet een vrijwilliger vooraf waar die ja tegen zegt. Getest in tests/vrijwilligers.test.mjs. */
import { plaatjeOk } from './toernooi-logica.js?v=20261130n';

export const MAX_TAKEN = 60, MAX_STAPPEN = 8;
export const CATS = { kantine: 'Kantine', wedstrijd: 'Wedstrijddag', jeugd: 'Jeugd en trainingen', onderhoud: 'Onderhoud en terrein', evenement: 'Activiteiten', bestuur: 'Bestuur en commissies', overig: 'Overig' };
export const FREQ = { eenmalig: 'Eenmalig', wekelijks: 'Elke week', tweewekelijks: 'Om de week', maandelijks: 'Eén keer per maand', seizoen: 'Een paar keer per seizoen', doorlopend: 'In je eigen tijd' };
export const STATUS_TAAK = { open: 'Open', vervuld: 'Vervuld', verborgen: 'Verborgen' };
export const STATUS_AANM = { nieuw: 'Nieuw', gesproken: 'Gesproken', geplaatst: 'Geplaatst', afgewezen: 'Niet geplaatst' };

const tekst = (v, max = 60) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lang = (v, max = 600) => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
export const nieuwId = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const stappenUit = v => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map(s => tekst(String(s).replace(/^\s*(?:[-•*]|\d+[.)])\s*/, ''), 100)).filter(Boolean).slice(0, MAX_STAPPEN);

export function schoneTaak(x = {}){
  return { titel: tekst(x.titel, 60), cat: CATS[x.cat] ? x.cat : 'overig', wat: lang(x.wat, 500), stappen: stappenUit(x.stappen),
    freq: FREQ[x.freq] ? x.freq : 'seizoen', moment: tekst(x.moment, 80), duur: tekst(x.duur, 40), waar: tekst(x.waar, 60),
    voorWie: tekst(x.voorWie, 140), krijgt: tekst(x.krijgt, 140), contact: tekst(x.contact, 60),
    nodig: Math.max(0, Math.min(99, Math.round(Number(x.nodig) || 0))), geplaatst: Math.max(0, Math.min(999, Math.round(Number(x.geplaatst) || 0))),
    status: STATUS_TAAK[x.status] ? x.status : 'open', volg: Number(x.volg) || 0 };
}
export const takenLijst = map => Object.entries(map || {}).filter(([, x]) => x && typeof x === 'object').map(([id, x]) => ({ id, ...schoneTaak(x) }))
  .sort((a, b) => a.volg - b.volg || a.titel.localeCompare(b.titel, 'nl')).slice(0, MAX_TAKEN);
/* Hoe compleet is de omschrijving? Een vast omlijnde taak heeft minstens: wat, stappen, moment, duur en contact. */
export function ontbreekt(t){
  const s = schoneTaak(t), mis = [];
  if (!s.wat) mis.push('wat je doet');
  if (s.stappen.length < 2) mis.push('de stappen');
  if (!s.moment) mis.push('wanneer');
  if (!s.duur) mis.push('hoe lang');
  if (!s.contact) mis.push('bij wie je terecht kunt');
  return mis;
}
export const nogNodig = t => t.nodig > 0 ? Math.max(0, t.nodig - (t.geplaatst || 0)) : null;
/* Wat bezoekers zien: open taken, en vervulde met een vinkje. Verborgen taken niet. */
export const zichtbaar = lijst => lijst.filter(t => t.status !== 'verborgen' && t.titel);

export function bankKopie({ clubNaam = '', logo = '', kleur = '', intro = '', contact = '', contactMail = '' } = {}){
  return { clubNaam: tekst(clubNaam, 80), logo: plaatjeOk(logo) ? logo : '', kleur: /^#[0-9a-f]{6}$/i.test(kleur || '') ? kleur : '', intro: lang(intro, 500),
    contact: tekst(contact, 60), contactMail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactMail || '').trim()) ? String(contactMail).trim().slice(0, 120) : '' };
}
export function schoneAanmelding(v = {}){
  const d = { naam: tekst(v.naam, 60), contact: tekst(v.contact, 120), opm: tekst(v.opm, 300) };
  if (!d.naam) return { fout: 'Vul je naam in.', veld: 'naam' };
  const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact), tel = d.contact.replace(/\D/g, '').length >= 9 && /^[\d+ ()-]+$/.test(d.contact);
  if (!mail && !tel) return { fout: 'Vul een e-mailadres of telefoonnummer in, zodat we je kunnen bereiken.', veld: 'contact' };
  return { ok: true, data: d };
}
export function telAanmeldingen(lijst = []){
  const uit = {};
  for (const a of lijst){ if (!a?.taak) continue; const r = (uit[a.taak] ||= { n: 0, nieuw: 0, geplaatst: 0 }); if (a.status !== 'afgewezen') r.n++; if (!a.status || a.status === 'nieuw') r.nieuw++; if (a.status === 'geplaatst') r.geplaatst++; }
  return uit;
}
const csvCel = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvAanmeldingen(lijst = [], taken = {}){
  const rijen = [...lijst].sort((a, b) => (a.ms || 0) - (b.ms || 0)).map(a => [taken[a.taak]?.titel || '', a.naam, a.contact, a.opm || '', STATUS_AANM[a.status] || 'Nieuw', a.ms ? new Date(a.ms).toISOString().slice(0, 10) : '']);
  return '﻿' + [['Taak', 'Naam', 'Contact', 'Opmerking', 'Status', 'Aangemeld op'], ...rijen].map(r => r.map(csvCel).join(';')).join('\r\n');
}

/* Voorbeeldtaken: volledig uitgeschreven, de club past ze aan. */
export const VOORBEELDEN = [
  { titel: 'Bardienst op zaterdag', cat: 'kantine', freq: 'maandelijks', moment: 'Zaterdag, ochtend (8:00–12:30) of middag (12:30–17:00)', duur: '4,5 uur per keer', waar: 'Kantine', nodig: 12,
    wat: 'Je staat met zijn tweeën achter de bar op een wedstrijddag. Je schenkt koffie, thee en fris, maakt tosti\'s en rekent af met de pin.',
    stappen: ['Een kwartier voor je dienst aanwezig, de vorige dienst draagt over', 'Koffie zetten, koeling bijvullen', 'Bestellingen opnemen en afrekenen (alleen pin)', 'Tafels schoonhouden, vaatwasser aanzetten', 'Aan het eind overdragen of afsluiten volgens de lijst bij de kassa'],
    voorWie: 'Iedereen vanaf 18 jaar. Ervaring is niet nodig, de eerste keer sta je met iemand die het kent.', krijgt: 'Inwerken, koffie en een tosti van de club', contact: 'Kantinecommissie' },
  { titel: 'Scheidsrechter bij de pupillen', cat: 'wedstrijd', freq: 'tweewekelijks', moment: 'Zaterdagochtend, thuiswedstrijden', duur: '1,5 uur per wedstrijd', waar: 'Onze velden', nodig: 8,
    wat: 'Je begeleidt een wedstrijd van de jongste jeugd (O8 tot en met O12). Bij de kleintjes ben je vooral spelbegeleider: je legt uit en houdt het leuk.',
    stappen: ['Een kwartier voor de aftrap melden bij het wedstrijdsecretariaat', 'Fluit en bal ophalen', 'De wedstrijd leiden volgens de spelregelkaart die je van ons krijgt', 'Na afloop de uitslag doorgeven'],
    voorWie: 'Ouders, oudere jeugdspelers (vanaf 14 jaar) en senioren. Je hoeft de regels niet uit je hoofd te kennen.', krijgt: 'Korte uitleg vooraf, spelregelkaart en een consumptie', contact: 'Wedstrijdsecretariaat' },
  { titel: 'Gastheer of gastvrouw op zaterdag', cat: 'wedstrijd', freq: 'maandelijks', moment: 'Zaterdag 8:00–12:00', duur: '4 uur per keer', waar: 'Ingang en wedstrijdsecretariaat', nodig: 6,
    wat: 'Je bent het aanspreekpunt op de wedstrijddag. Je ontvangt de tegenstanders, wijst kleedkamers en velden en zorgt dat iedereen weet waar hij moet zijn.',
    stappen: ['Het programma van de dag bekijken (staat op de kantine-tv en in Cluppie)', 'Tegenstanders en scheidsrechters ontvangen en de kleedkamer wijzen', 'Ranja klaarzetten voor de rust', 'Uitslagen noteren en doorgeven', 'Bij problemen de dienstdoende bestuurder bellen'],
    voorWie: 'Iemand die het leuk vindt om mensen te ontvangen en het overzicht te houden.', krijgt: 'Inwerken door een ervaren collega', contact: 'Wedstrijdsecretariaat' },
  { titel: 'Velden en lijnen', cat: 'onderhoud', freq: 'wekelijks', moment: 'Vrijdag overdag of vrijdagavond', duur: '2 uur per keer', waar: 'Sportpark', nodig: 3,
    wat: 'Je zorgt dat de velden er op zaterdag goed bij liggen: lijnen trekken, doelen controleren en hoekvlaggen klaarzetten.',
    stappen: ['Lijnen trekken met de belijningswagen op de grasvelden', 'Doelnetten en verankering van de doelen controleren', 'Hoekvlaggen en pupillendoeltjes klaarzetten', 'Kapotte spullen melden bij de terreincommissie'],
    voorWie: 'Iemand die graag buiten bezig is.', krijgt: 'Uitleg over de belijningswagen, koffie in de bestuurskamer', contact: 'Terreincommissie' },
  { titel: 'Kleedkamers schoonmaken', cat: 'onderhoud', freq: 'maandelijks', moment: 'Maandagochtend of zaterdag na de laatste wedstrijd', duur: '1,5 uur per keer', waar: 'Kleedkamers', nodig: 6,
    wat: 'Met een vast groepje maak je de kleedkamers en douches schoon na het weekend.',
    stappen: ['Vuilniszakken wisselen', 'Vloeren aanvegen en dweilen', 'Douches en toiletten schoonmaken', 'Verloren voorwerpen in de bak bij de ingang leggen'],
    voorWie: 'Iedereen. Schoonmaakspullen zijn aanwezig.', krijgt: 'Samen koffie na afloop', contact: 'Terreincommissie' },
  { titel: 'Materiaalbeheer jeugd', cat: 'jeugd', freq: 'seizoen', moment: 'Begin en eind van het seizoen, en af en toe tussendoor', duur: 'Ongeveer 10 uur per seizoen', waar: 'Ballenhok', nodig: 2,
    wat: 'Je zorgt dat elk team ballen, hesjes en pionnen heeft en dat het aan het eind van het seizoen terugkomt.',
    stappen: ['Bij de start per team een tas uitgeven en noteren in Cluppie (Uitleningen)', 'Ballen oppompen en kapot materiaal vervangen', 'Aan het eind alles innemen en tellen', 'Een bestellijst maken voor het nieuwe seizoen'],
    voorWie: 'Iemand die van orde houdt.', krijgt: 'Sleutel van het ballenhok en een vast budget', contact: 'Jeugdcoördinator' },
  { titel: 'Trainer of leider van een jeugdteam', cat: 'jeugd', freq: 'wekelijks', moment: 'Twee trainingen door de week en de wedstrijd op zaterdag', duur: '4 tot 6 uur per week', waar: 'Onze velden', nodig: 4,
    wat: 'Je traint of begeleidt een jeugdteam. De trainingen staan per week voor je klaar in Cluppie, met uitleg en tekeningen.',
    stappen: ['De training van de week bekijken in Cluppie', 'Training geven met een collega-trainer', 'Op zaterdag de opstelling maken en het team begeleiden', 'Twee keer per seizoen een korte evaluatie invullen'],
    voorWie: 'Ouders en oud-spelers. Geen diploma nodig; je krijgt begeleiding van de jeugdcoördinator.', krijgt: 'Kant-en-klare trainingen, trainerspak, begeleiding en een cursus als je dat wilt', contact: 'Jeugdcoördinator' },
  { titel: 'EHBO op de wedstrijddag', cat: 'wedstrijd', freq: 'maandelijks', moment: 'Zaterdag 8:30–13:00', duur: '4,5 uur per keer', waar: 'EHBO-ruimte', nodig: 4,
    wat: 'Je bent op de wedstrijddag aanwezig voor eerste hulp bij blessures.',
    stappen: ['EHBO-koffer en ijs controleren aan het begin van de dag', 'Bereikbaar zijn via de portofoon of telefoon', 'Eerste hulp geven en zo nodig doorverwijzen', 'Gebruikte spullen noteren zodat ze worden aangevuld'],
    voorWie: 'Iemand met een geldig EHBO- of BHV-diploma.', krijgt: 'De club betaalt je herhalingscursus', contact: 'Bestuur' },
  { titel: 'Activiteitencommissie', cat: 'evenement', freq: 'seizoen', moment: 'Vier tot zes activiteiten per seizoen, één keer per maand overleg', duur: 'Ongeveer 3 uur per maand', waar: 'Clubhuis', nodig: 3,
    wat: 'Je organiseert met een klein team de activiteiten voor de jeugd: het kersttoernooi, de pietentraining en de seizoensafsluiting. De draaiboeken staan klaar in Cluppie.',
    stappen: ['Aan het begin van het seizoen de kalender maken', 'Per activiteit een rol kiezen in het draaiboek', 'Vrijwilligers vragen voor de dag zelf', 'Na afloop kort evalueren'],
    voorWie: 'Ouders die graag iets organiseren.', krijgt: 'Draaiboeken per activiteit en een budget', contact: 'Bestuur' },
  { titel: 'Sponsorcommissie', cat: 'bestuur', freq: 'doorlopend', moment: 'In je eigen tijd, één keer per zes weken overleg', duur: 'Ongeveer 2 uur per week', waar: 'Thuis en bij ondernemers', nodig: 2,
    wat: 'Je houdt contact met de sponsoren van de club en zoekt nieuwe. Je regelt dat hun logo op de borden en op de kantine-tv staat.',
    stappen: ['Bestaande sponsoren benaderen voordat hun afspraak afloopt', 'Nieuwe ondernemers uit de buurt benaderen met het sponsorpakket', 'Logo en einddatum bijhouden in Cluppie (Kantine-tv en sponsoren)', 'Twee keer per jaar een sponsoravond helpen organiseren'],
    voorWie: 'Iemand met een netwerk in de buurt of gevoel voor verkoop.', krijgt: 'Een vast pakket met prijzen en voorbeelden', contact: 'Penningmeester' },
];
