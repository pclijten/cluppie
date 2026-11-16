/* Teksten van alle uitgaande mails op één plek (20261116p).
   De platformbeheerder past ze aan in Platform › Mails; aanpassingen staan in `platformMails/teksten`
   (alleen functies lezen en schrijven dat document, de rules laten de app er niet bij).

   ELKE mail van Cluppie gaat via `verstuur()` hieronder. Nieuwe mail nodig? Voeg een soort toe aan SOORTEN:
   dan staat hij vanzelf in het scherm. `tests/mail-teksten.test.js` faalt als een functie buiten dit
   bestand zelf naar `mail` schrijft of `maakMail` aanroept.

   Een tekst mag invulvelden bevatten: {naam}, {club} … (per soort vastgelegd in `velden`).
   Tekst tussen [vierkante haken] valt weg als een invulveld daarbinnen leeg is: "Hoi[ {naam}],".
   Vast (niet aan te passen): opmaak, voorkop, links, de stappen- en gegevenslijst. */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { maakMail } = require('./mail-sjabloon');

const DOC = 'platformMails/teksten';
const TEKSTVELDEN = ['onderwerp', 'titel', 'tekst', 'knop', 'slot', 'voet'];
const MAX = { onderwerp: 150, titel: 120, tekst: 4000, knop: 40, slot: 1500, voet: 300 };
const VELDNAAM = { onderwerp: 'Onderwerp', titel: 'Kop', tekst: 'Tekst', knop: 'Tekst op de knop', slot: 'Afsluiting', voet: 'Kleine regel onderaan' };
const ALGEMEEN_STD = { afzender: 'Cluppie', merkregel: 'Cluppie · de trainersapp voor jeugdvoetbalclubs' };
/* zelfde zeven stappen als STAPPEN in public/js/startlijst.js */
const STAPPEN_AAN_DE_SLAG = ['Logo en clubkleur', 'Sportlink koppelen', 'Teams aanmaken', 'Trainingsdagen invullen', 'Eerste coach uitnodigen', 'Privacycontact invullen', 'Verwerkersovereenkomst'];

const SOORTEN = {
  nieuweAanmelding: {
    groep: 'Naar jou', naam: 'Nieuwe club aangemeld', aan: 'jou (het contactadres van Cluppie)', wanneer: 'Zodra een club zich aanmeldt',
    velden: { naam: 'Naam', rol: 'Rol', club: 'Club', plaats: 'Plaats' }, kanUit: true,
    vast: 'de gegevens van de aanmelding (club, plaats, contact, aantal teams, bericht).',
    voorkop: 'Nieuwe aanmelding',
    std: { onderwerp: 'Cluppie: nieuwe club aangemeld — {club}', titel: '{club} wil met Cluppie starten',
      tekst: '{naam}[ ({rol})] meldde {club}[ uit {plaats}] aan.', knop: 'Aanmelding bekijken',
      slot: 'Goedkeuren of afwijzen kan in het platformscherm.', voet: '' },
    voorbeeld: { naam: 'Sanne de Vries', rol: 'jeugdcoördinator', club: 'VV Voorbeeld', plaats: 'Voorbeelddorp' },
    voorbeeldVast: { gegevens: [['Club', 'VV Voorbeeld'], ['Plaats', 'Voorbeelddorp'], ['Contact', 'Sanne de Vries'], ['Rol', 'jeugdcoördinator'], ['E-mail', 'sanne@voorbeeld.nl'], ['Aantal teams', 14]] },
  },
  welkomClub: {
    groep: 'Clubs', naam: 'Welkom, de club staat klaar', aan: 'de contactpersoon van de club', wanneer: 'Als je een aanmelding goedkeurt',
    velden: { naam: 'Naam', club: 'Club', eigenTeams: 'Zin over meegenomen teams' }, kanUit: true, magEerstTonen: true, eerstTonen: true,
    vast: 'de zeven stappen van Aan de slag, zoals ze in de app staan.',
    voorkop: 'Welkom', stappen: STAPPEN_AAN_DE_SLAG,
    std: { onderwerp: 'Welkom bij Cluppie, {club}!', titel: '{club} staat klaar',
      tekst: 'Hoi {naam},\n\nGoed nieuws: {club} staat klaar in Cluppie en jij bent clubbeheerder.\n\n[{eigenTeams}]\n\nLog in met hetzelfde account waarmee je je aanmeldde. Op de clubpagina vind je "Aan de slag": zeven korte stappen om de club in te richten. Meestal ben je in een kwartier klaar.',
      knop: 'Naar Cluppie', slot: 'Loop je ergens op vast? Antwoord gerust op deze mail.\n\nVeel plezier!\nCluppie', voet: '' },
    voorbeeld: { naam: 'Sanne', club: 'VV Voorbeeld', eigenTeams: '' },
  },
  afwijzing: {
    groep: 'Clubs', naam: 'Aanmelding afgewezen', aan: 'de contactpersoon van de club', wanneer: 'Als je een aanmelding afwijst',
    velden: { naam: 'Naam', club: 'Club', reden: 'Reden' }, kanUit: true, magEerstTonen: true, eerstTonen: false,
    voorkop: 'Je aanmelding',
    std: { onderwerp: 'Je aanmelding bij Cluppie', titel: 'Bedankt voor je aanmelding',
      tekst: 'Hoi {naam},\n\nBedankt voor je aanmelding van {club}. We kunnen de club op dit moment nog niet toelaten tot Cluppie.\n\n[{reden}]',
      knop: '', slot: 'Vragen? Antwoord gerust op deze mail.\n\nGroet,\nCluppie', voet: '' },
    voorbeeld: { naam: 'Sanne', club: 'VV Voorbeeld', reden: 'We starten in januari met een nieuwe groep clubs en nemen dan contact op.' },
  },
  coachAanvraag: {
    groep: 'Clubbeheerders', naam: 'Coach wil aansluiten', aan: 'de clubbeheerders van die club', wanneer: 'Bij een nieuwe aanvraag, hooguit één per club per dag',
    velden: { coach: 'Coach', team: 'Team', club: 'Club' }, kanUit: true,
    voorkop: 'Nieuwe aanvraag',
    std: { onderwerp: 'Cluppie: {coach} wil aansluiten bij {club}', titel: '{coach} wil aansluiten',
      tekst: '{coach} vroeg toegang[ tot {team}][ bij {club}].', knop: 'Aanvraag beoordelen',
      slot: 'Je vindt de aanvraag onder Club → Instellingen → Toegang & privacy.',
      voet: 'Je krijgt hooguit één zo\'n mail per dag; nieuwe aanvragen van vandaag staan er ook.' },
    voorbeeld: { coach: 'Daan Bakker', team: 'O11-2', club: 'VV Voorbeeld' },
  },
  bevestig: {
    groep: 'Account', naam: 'E-mailadres bevestigen', aan: 'een nieuwe gebruiker', wanneer: 'Direct na het aanmaken van een account',
    velden: { naam: 'Voornaam' }, kanUit: false, wisInhoud: true,
    vast: 'de link zelf en de regel "Werkt de knop niet?".',
    voorkop: 'Bevestigen',
    std: { onderwerp: 'Bevestig je e-mailadres voor Cluppie', titel: 'Bevestig je e-mailadres',
      tekst: 'Hoi[ {naam}],\n\nWelkom bij Cluppie! Bevestig je e-mailadres met de knop hieronder. Dat is nodig om je aan te sluiten bij een team of club.',
      knop: 'E-mailadres bevestigen', slot: 'Heb je je niet aangemeld bij Cluppie? Dan kun je deze mail negeren.', voet: 'Deze link werkt één keer.' },
    voorbeeld: { naam: 'Sanne' },
    voorbeeldVast: { slotVooraf: ['Werkt de knop niet? Kopieer dan deze link in je browser:\nhttps://www.cluppie.io/voorbeeldlink'] },
  },
  wachtwoord: {
    groep: 'Account', naam: 'Nieuw wachtwoord kiezen', aan: 'een gebruiker die zijn wachtwoord vergat', wanneer: 'Direct na "Wachtwoord vergeten"',
    velden: { naam: 'Voornaam' }, kanUit: false, wisInhoud: true,
    vast: 'de link zelf en de regel "Werkt de knop niet?".',
    voorkop: 'Wachtwoord',
    std: { onderwerp: 'Kies een nieuw wachtwoord voor Cluppie', titel: 'Kies een nieuw wachtwoord',
      tekst: 'Hoi[ {naam}],\n\nJe vroeg om een nieuw wachtwoord voor Cluppie. Klik op de knop hieronder en kies een nieuw wachtwoord. Daarna kun je meteen weer inloggen.',
      knop: 'Nieuw wachtwoord kiezen', slot: 'Heb je dit niet aangevraagd? Dan hoef je niets te doen: je wachtwoord blijft zoals het was.',
      voet: 'Deze link werkt één keer en maar een beperkte tijd.' },
    voorbeeld: { naam: 'Sanne' },
    voorbeeldVast: { slotVooraf: ['Werkt de knop niet? Kopieer dan deze link in je browser:\nhttps://www.cluppie.io/voorbeeldlink'] },
  },
  teamkamer: {
    groep: 'Ouders en spelers', naam: 'Toegang tot de teamkamer', aan: 'een ouder of speler', wanneer: 'Als de trainer de aanvraag goedkeurt',
    velden: { team: 'Team' }, kanUit: true,
    voorkop: '',
    std: { onderwerp: 'Cluppie: je kunt de teamkamer in', titel: 'Je kunt de teamkamer in',
      tekst: 'De trainer van {team} heeft je aanvraag goedgekeurd. Je ziet nu de agenda, wie erbij is, mededelingen en polls.\n\nAfmelden blijft via de groepsapp gaan. In de teamkamer staat een knop die het bericht voor je klaarzet.',
      knop: 'Open de teamkamer', slot: '', voet: '' },
    voorbeeld: { team: 'O11-2' },
  },
};
const VOLGORDE = Object.keys(SOORTEN);

/* ---------- PURE (getest; public/js/platform-mails-logica.js heeft dezelfde vulIn voor het voorbeeld) ---------- */
const VELD_RE = /\{([A-Za-z]\w*)\}/g;
const heeftWaarde = v => v != null && String(v).trim() !== '';

/* Waarden worden in één doorgang ingevuld en daarna niet opnieuw bekeken: een clubnaam met { of [ blijft tekst. */
function vulIn(sjabloon, waarden = {}){
  const vulVelden = t => t.replace(VELD_RE, (heel, k) => (Object.prototype.hasOwnProperty.call(waarden, k) ? String(waarden[k] == null ? '' : waarden[k]) : heel));
  let uit = '', rest = String(sjabloon == null ? '' : sjabloon);
  const HAAK = /\[([^\[\]]*)\]/;
  for (let m = HAAK.exec(rest); m; m = HAAK.exec(rest)){
    uit += vulVelden(rest.slice(0, m.index));
    const namen = [...m[1].matchAll(VELD_RE)].map(x => x[1]);
    if (!namen.length) uit += m[0];                                           // gewone haken zonder invulveld blijven staan
    else if (namen.every(k => heeftWaarde(waarden[k]))) uit += vulVelden(m[1]);
    rest = rest.slice(m.index + m[0].length);
  }
  return uit + vulVelden(rest);
}
/* Een lege regel begint een nieuwe alinea; lege alinea's (weggevallen haken) verdwijnen. */
const alineas = t => String(t || '').split(/\r?\n[ \t]*\r?\n/).map(a => a.replace(/^\s+|\s+$/g, '')).filter(Boolean);
const veldenIn = t => [...String(t || '').matchAll(VELD_RE)].map(x => x[1]);

/* Invoer van het scherm → { fout } of { tekst } (alleen de zes tekstvelden, opgeschoond). */
function controleer(soort, invoer = {}){
  const S = SOORTEN[soort];
  if (!S) return { fout: 'Onbekende mail.' };
  const tekst = {};
  for (const k of TEKSTVELDEN){
    let v = String(invoer[k] == null ? S.std[k] : invoer[k]).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ');
    if (k !== 'tekst' && k !== 'slot') v = v.replace(/\n/g, ' ');
    v = v.trim();
    if (v.length > MAX[k]) return { fout: `${VELDNAAM[k]} is te lang (hooguit ${MAX[k]} tekens).` };
    tekst[k] = v;
  }
  if (!S.std.knop) tekst.knop = '';
  for (const k of ['onderwerp', 'titel', 'tekst']) if (!tekst[k]) return { fout: `${VELDNAAM[k]} mag niet leeg zijn.` };
  if (S.std.knop && !tekst.knop) return { fout: 'De knop heeft tekst nodig.' };
  const onbekend = [...new Set(TEKSTVELDEN.flatMap(k => veldenIn(tekst[k])).filter(k => !S.velden[k]))];
  if (onbekend.length) return { fout: `Het invulveld {${onbekend.join('}, {')}} bestaat niet bij deze mail.` };
  return { tekst };
}
function schoonAlgemeen(d = {}){
  const lijn = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const afzender = lijn(d.afzender, 40), merkregel = lijn(d.merkregel, 120);
  if (!afzender) return { fout: 'Vul de naam van de afzender in.' };
  if (!merkregel) return { fout: 'Vul de regel onderaan in.' };
  return { algemeen: { afzender, merkregel } };
}

/* Geldende tekst van één soort: standaard, daaroverheen wat de beheerder bewaarde, daaroverheen een eenmalige tekst. */
function tekstVan(soort, instellingen, eenmalig){
  const S = SOORTEN[soort], eigen = (instellingen && instellingen.mails && instellingen.mails[soort]) || {};
  const t = {};
  for (const k of TEKSTVELDEN) t[k] = typeof (eenmalig || {})[k] === 'string' ? eenmalig[k] : (typeof eigen[k] === 'string' ? eigen[k] : S.std[k]);
  return t;
}
const algemeenVan = instellingen => ({ ...ALGEMEEN_STD, ...((instellingen && instellingen.algemeen) || {}) });
const staatUit = (soort, instellingen) => !!(SOORTEN[soort].kanUit && instellingen && instellingen.mails && instellingen.mails[soort] && instellingen.mails[soort].uit === true);
function eerstTonen(soort, instellingen){
  const S = SOORTEN[soort], eigen = (instellingen && instellingen.mails && instellingen.mails[soort]) || {};
  return !!S.magEerstTonen && (typeof eigen.eerstTonen === 'boolean' ? eigen.eerstTonen : !!S.eerstTonen);
}

/* De mail zelf. `vast` = wat de aanroeper aanlevert en de beheerder niet aanpast:
     { knopUrl, gegevens: [[label, waarde]], slotVooraf: [alinea's vóór de afsluiting] } */
function stelOp(soort, waarden = {}, { instellingen = null, eenmalig = null, vast = {} } = {}){
  const S = SOORTEN[soort];
  if (!S) throw new Error('Onbekende mailsoort: ' + soort);
  const t = tekstVan(soort, instellingen, eenmalig), alg = algemeenVan(instellingen);
  const v = x => vulIn(x, waarden);
  const knop = v(t.knop).trim();
  const inhoud = maakMail({
    voorkop: S.voorkop || undefined,
    titel: v(t.titel),
    alineas: alineas(v(t.tekst)),
    stappen: S.stappen,
    gegevens: vast.gegevens,
    knop: knop ? { tekst: knop, url: vast.knopUrl } : undefined,
    slot: [...(vast.slotVooraf || []), ...alineas(v(t.slot))],
    voet: v(t.voet) || undefined,
    merkregel: alg.merkregel === ALGEMEEN_STD.merkregel ? undefined : alg.merkregel,
  });
  return { onderwerp: v(t.onderwerp).replace(/\s+/g, ' ').trim(), text: inhoud.text, html: inhoud.html,
    vanNaam: alg.afzender === ALGEMEEN_STD.afzender ? '' : alg.afzender };
}

/* ---------- instellingen lezen (kort onthouden, zodat niet elke mail een extra leesactie kost) ---------- */
let onthouden = null;
async function leesInstellingen(db = getFirestore(), { vers = false, nu = Date.now() } = {}){
  if (!vers && onthouden && nu - onthouden.om < 60000) return onthouden.data;
  let data = {};
  try { data = (await db.doc(DOC).get()).data() || {}; }
  catch (e){ console.warn('[mail] teksten lezen mislukt, standaard gebruikt', e && e.message || e); }
  onthouden = { om: nu, data };
  return data;
}
const vergeetInstellingen = () => { onthouden = null; };

/* ---------- DE uitgang: elke mail van Cluppie ----------
   Geeft 'gemaakt', 'uit' (door de beheerder uitgezet) of 'geen-ontvanger'. Gooit niet bij een schrijffout als `stil` aan staat. */
async function verstuur(db, soort, aan, waarden, { vast, eenmalig, stil = false, proef = false } = {}){
  if (!aan || (Array.isArray(aan) && !aan.length)) return 'geen-ontvanger';
  const instellingen = await leesInstellingen(db);
  if (!proef && staatUit(soort, instellingen)) return 'uit';
  const m = stelOp(soort, waarden, { instellingen, eenmalig, vast });
  const document = { to: aan, soort: proef ? 'proef' : soort, ...(proef ? { proefVan: soort } : {}),
    message: { subject: (proef ? '[Proef] ' : '') + m.onderwerp, text: m.text, html: m.html },
    ...(m.vanNaam ? { vanNaam: m.vanNaam } : {}), gemaakt: FieldValue.serverTimestamp() };
  try { await db.collection('mail').add(document); }
  catch (e){
    if (!stil) throw e;
    console.warn('[mail] wegschrijven mislukt', e && e.message || e);
    return 'mislukt';
  }
  return 'gemaakt';
}

module.exports = { DOC, SOORTEN, VOLGORDE, TEKSTVELDEN, MAX, VELDNAAM, ALGEMEEN_STD, STAPPEN_AAN_DE_SLAG,
  vulIn, alineas, veldenIn, controleer, schoonAlgemeen, tekstVan, algemeenVan, staatUit, eerstTonen, stelOp,
  leesInstellingen, vergeetInstellingen, verstuur };
