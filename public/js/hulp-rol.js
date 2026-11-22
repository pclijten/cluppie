/* ==================== HULP PER ROL [20261122a] ====================
   PURE module (geen DOM, geen Firebase, geen imports). Eén bron voor wat de handleiding en de hulpchat
   per rol laten zien: het hoofdstuk "Jouw rol" in de handleiding (teams-handleiding.js) en de
   startvragen in de hulpchat (chatbot.js). Getest in tests/hulp-rol.test.mjs.

   De rollen zijn die van rolkaart.js (admin, bouw, eigenbouw, hjo, trainco) plus 'coach' (coach van
   een clubteam) en 'solo' (trainer zonder club). De teksten volgen de schermen zoals ze nu zijn;
   dezelfde uitleg staat voor de hulpchat in functions/kennis.js. Verander je een scherm, pas dan beide aan. */

export const ROL_NAMEN = {
  admin: 'Clubbeheerder', hjo: 'Hoofd jeugdopleiding', bouw: 'Bouwcoördinator', eigenbouw: 'Coach gekoppeld aan een bouw',
  trainco: 'Trainingscoördinator', coach: 'Coach', solo: 'Trainer zonder club',
};
/* wie het meest stuurt, staat vooraan */
export const ROL_VOLGORDE = ['admin', 'hjo', 'bouw', 'eigenbouw', 'trainco', 'coach', 'solo'];

export function schoonRollen(rollen){
  const set = new Set((Array.isArray(rollen) ? rollen : []).map(String));
  return ROL_VOLGORDE.filter(r => set.has(r));
}

/* ---------- startvragen in de hulpchat ---------- */
export const START_VRAGEN = {
  admin: ['Hoe zet ik teams klaar uit Sportlink?', 'Hoe nodig ik een coach uit?', 'Waar geef ik iemand een rol?', 'Hoe ruim ik oude gegevens op?'],
  hjo: ['Hoe maak ik het seizoensplan van de club?', 'Hoe leg ik de speelwijze vast?', 'Hoe volg ik een evaluatieronde?', 'Hoe maak ik een training voor meer teams?'],
  bouw: ['Waar zie ik wat elk team deze week traint?', 'Hoe leen ik een speler uit?', 'Hoe wijs ik het seizoensplan toe aan mijn bouw?', 'Waar staan de evaluaties van mijn teams?'],
  trainco: ['Waar zie ik wat elk team traint?', 'Wat staat er in het weekrooster?', 'Kan ik een training aanpassen?'],
  coach: ['Hoe maak ik een opstelling?', 'Hoe nodig ik een coach uit?', 'Waar staan de trainingen?', 'Hoe beoordeel ik een speler?'],
  solo: ['Hoe maak ik een opstelling?', 'Hoe maak ik een training?', 'Hoe breng ik mijn team bij mijn club onder?', 'Hoe maak ik een jaaroverzicht?'],
};
START_VRAGEN.eigenbouw = START_VRAGEN.bouw;

/* In een team stel je vragen als coach (of als trainer zonder club); daarbuiten telt je sturende rol. */
export function startVragen(rollen, { inTeam = false } = {}){
  const r = schoonRollen(rollen);
  if (inTeam) return START_VRAGEN[r.includes('solo') ? 'solo' : 'coach'];
  return START_VRAGEN[r[0] || 'coach'];
}

/* ---------- hoofdstuk "Jouw rol" in de handleiding ----------
   punten = [vet begin, rest van de zin]. `niet` = wat deze rol niet kan en wie dan wel. */
export const ROL_UITLEG = [
  { id: 'admin', voor: ['admin'], titel: 'Clubbeheerder: de club inrichten',
    intro: 'Je richt de club in en houdt hem bij. Open de club op de telefoon via het teamoverzicht, op de laptop via Club, beheer in het zijmenu. Bovenaan staat wat nog moet gebeuren: eerst Aan de slag, daarna En daarna.',
    punten: [
      ['Teams.', 'Onder Club › Teams zet je de teams klaar uit Sportlink of maak je ze zelf. Per team nodig je een coach uit met een persoonlijke link.'],
      ['Mensen.', 'Onder Club › Mensen staat per rol wie hem heeft en welke nog open is. Hier geef je iemand een rol, keur je aanvragen goed en schrijf je iemand uit.'],
      ['Bouwen.', 'Onder Club › Bouwen bepaal je welke teams bij welke bouw horen en wie de coördinator is.'],
      ['Instellingen.', 'Onder Club › Instellingen staan het seizoen (Nieuw seizoen, Seizoensovergang, Bewaartermijnen en opruimen), logo en kleur, Sportlink, Toegang en privacy, en Werkwijze en onderdelen.'],
      ['Berichten en afgelasten.', 'Een bericht voor één of meer teams, of de training voor de hele club afgelasten.'],
      ['Inzicht en Weekbrief.', 'Per team wat er getraind is en waar aandacht nodig is, in aantallen.'],
    ],
    niet: 'Onderdelen die Cluppie per club aanzet, zoals AI, Training maken en de Teamkamer, zet je niet zelf aan. Vraag dat aan Cluppie.' },
  { id: 'hjo', voor: ['hjo'], titel: 'Hoofd jeugdopleiding: plan en speelwijze',
    intro: 'Je legt vast hoe de club wil voetballen en wat er wanneer getraind wordt. Je begint bij de club: Seizoensplan.',
    punten: [
      ['Seizoensplan.', 'Onder Club › Seizoensplan maak je het plan en wijs je het toe aan een bouw of aan de hele club. Trainers zien het daarna bij Seizoen.'],
      ['Speelwijze.', 'Onder Club › Speelwijze leg je de speelwijze vast, met een stijl als startpunt of met een vragenlijst voor een paar mensen.'],
      ['Trainingen.', 'Onder Club › Trainingen zie je de trainingen van alle teams per week en maak je een training voor meer teams tegelijk.'],
      ['Evaluaties.', 'Onder Club › Evaluaties zet je een ronde klaar (najaar, voorjaar) en volg je hoe ver elk team is.'],
    ],
    niet: 'Clubinstellingen wijzigen en rollen geven doet de clubbeheerder.' },
  { id: 'bouw', voor: ['bouw', 'eigenbouw'], titel: 'Bouwcoördinator: de teams van je bouw',
    intro: 'Je volgt de teams van je bouw en helpt hun trainers. Op de telefoon tik je op het startscherm op je bouw; op de laptop kies je Club, beheer en dan je bouw. Ben je als coach aan een bouw gekoppeld, dan heb je hetzelfde voor die bouw.',
    punten: [
      ['Dashboard.', 'Per team in één oogopslag hoe het loopt.'],
      ['Trainingen.', 'Wat elk team deze week traint en of er getraind is.'],
      ['Uitleningen.', 'Een speler laten meespelen of meetrainen bij een ander team: je kiest het team en de dag.'],
      ['Per team.', 'Onder elk team staan Selectie, Evaluatie spelers, Evaluatie wedstrijden en Stats. In de teams van je bouw kun je alles wat een coach kan.'],
      ['Seizoensplan.', 'Onder Club › Seizoensplan wijs je het plan toe aan je eigen bouw.'],
      ['Evaluaties, Inzicht en Weekbrief.', 'Onder Club volg je de evaluatierondes en zie je per week de aandachtspunten van je bouw.'],
    ],
    niet: 'Beoordelingen en aanwezigheid van teams buiten je bouw zie je niet. Clubinstellingen wijzigt de clubbeheerder.' },
  { id: 'trainco', voor: ['trainco'], titel: 'Trainingscoördinator: meekijken wat er getraind wordt',
    intro: 'Je hebt een eigen scherm: op de telefoon als tegel bij je teams, op de laptop onder Club, beheer.',
    punten: [
      ['Trainingen.', 'De trainingen van alle teams per week, met een filter op leeftijd.'],
      ['Weekrooster.', 'Wie wanneer traint, en welk team een training mist.'],
      ['Video’s.', 'De filmpjes die de club met de teams deelt.'],
    ],
    niet: 'Je kijkt mee en wijzigt niets. Spelers, wedstrijden en beoordelingen zie je niet.' },
  { id: 'solo', voor: ['solo'], titel: 'Trainer zonder club: wat je hebt en hoe je club erbij komt',
    intro: 'Je gebruikt Cluppie voor je eigen team. Alles wat geen club nodig heeft staat open: opstelling, speeltijd, trainingen, aanwezigheid en evaluaties.',
    punten: [
      ['Doet je club al mee?', 'Cluppie kijkt of de club die je invulde al meedoet. Dan staat op je teamscherm een kaart met Vraag aan. De clubbeheerder keurt het goed en je spelers, wedstrijden en trainingen gaan mee.'],
      ['Doet je club nog niet mee?', 'Op je teamscherm staat de kaart Bevalt het? Vertel het je club. Daarmee stuur je je jeugdcoördinator een bericht dat al klaarstaat. Of meld de club zelf aan via Club aanmelden op het startscherm.'],
      ['Hulpchat en AI-hulp.', 'Die heb je als Cluppie dat voor trainers zonder club heeft aangezet, met een maximum per maand. Is het maximum bereikt, dan werkt alles gewoon door zonder AI.'],
      ['Jaaroverzicht.', 'Onder Stats maak je een overzicht van het seizoen om aan je club te laten zien.'],
    ],
    niet: 'Sportlink, en plannen, trainingen en video’s die een club deelt, lopen via een club.' },
];

/* De uitleg in de volgorde voor deze gebruiker: eerst de eigen rollen (eigen: true), dan de rest. */
export function uitlegVoor(rollen){
  const mijn = new Set(schoonRollen(rollen));
  const eigen = ROL_UITLEG.filter(u => u.voor.some(r => mijn.has(r))), rest = ROL_UITLEG.filter(u => !u.voor.some(r => mijn.has(r)));
  return [...eigen.map(u => ({ ...u, eigen: true })), ...rest.map(u => ({ ...u, eigen: false }))];
}
/* zoektekst voor de handleiding (data-zoek): alles in kleine letters */
export function zoekTekst(u){
  return [u.titel, u.intro, ...u.punten.map(p => p.join(' ')), u.niet].join(' ').toLowerCase().replace(/"/g, '');
}
