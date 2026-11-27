/* ==================== HANDLEIDING (help-tab) ====================
   Onderdeel van de teams.js-modulaire split. Puur statische help-tekst —
   geen Firestore/state-afhankelijkheden, dus geen imports nodig behalve
   wat hierboven al in dit bestand staat. De zoekfunctionaliteit
   (#helpZoek) wordt door de hub (teams.js/koppelTeamTab) aangesloten,
   want die werkt direct op het gerenderde DOM-element. */
import { esc } from './state.js?v=20261129y';
import { beleidsplanNaam } from './clubconfig.js?v=20261129y';
import { ROLKAARTEN, mijnRollen } from './rolkaart.js?v=20261129y';
import { uitlegVoor, zoekTekst } from './hulp-rol.js?v=20261122a';

/* [20261122a] Hoofdstuk "Jouw rol": uitleg per rol, de eigen rol bovenaan en gemarkeerd. Een coördinator
   of beheerder vond tot nu toe vooral uitleg voor coaches. De teksten staan in hulp-rol.js. */
function htmlJouwRol(){
  return `<h4 class="hl-hoofdstuk" id="hlh-rol">Jouw rol</h4>
    ${uitlegVoor(mijnRollen()).map(u => `<section class="hl-sec" data-zoek="${esc(zoekTekst(u))}">
    <h3>${esc(u.titel)}${u.eigen ? ' <span class="hl-eigen">jouw rol</span>' : ''}</h3>
    <p>${esc(u.intro)}</p>
    <ul>${u.punten.map(([kop, tekst]) => `<li><b>${esc(kop)}</b> ${esc(tekst)}</li>`).join('')}</ul>
    <div class="tip"><b>Niet:</b> ${esc(u.niet)}</div>
    </section>`).join('\n    ')}`;
}
import { onboardingHerstartBlok } from './onboarding.js?v=20261129y';

export function htmlHandleiding(){
  return `<div class="hl">
    ${onboardingHerstartBlok()}
    <div class="hl-zoekbalk">
      <span class="hl-zoek-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3 20 20"/></svg></span>
      <input type="search" id="helpZoek" class="hl-zoek-input" placeholder="Zoek in de handleiding…" autocomplete="off" autocapitalize="none" spellcheck="false">
      <button class="hl-zoek-wis" id="helpZoekWis" title="Wissen" aria-label="Wissen">✕</button>
    </div>
    <div class="hl-geen" id="helpGeen" hidden>Geen onderdeel gevonden voor <b id="helpGeenTerm"></b>. Probeer een ander woord.</div>

    <div class="hl-hoofdstukken" id="helpHoofdstukken">
      ${[['starten','Starten'],['rol','Jouw rol'],['plannen','Trainen & plannen'],['wedstrijddag','Op de wedstrijddag'],['club','Club & team beheren'],['beoordelen','Beoordelen & evalueren'],['tips','Tips & privacy']]
        .map(([id,naam]) => `<button data-hlh="${id}">${naam}</button>`).join('')}
    </div>

    <h4 class="hl-hoofdstuk" id="hlh-starten">Starten</h4>
    <section class="hl-sec" data-zoek="welkom bij cluppie een app om voor je voetbalteam de opstelling te maken, wissels te beheren, speeltijd eerlijk te verdelen en de wedstrijd te loggen. alles werkt realtime, dus collega-coaches zien direct dezelfde informatie.">
    <h3>Welkom bij Cluppie</h3>
    <p>Een app om voor je voetbalteam de opstelling te maken, wissels te beheren, speeltijd eerlijk te verdelen en de wedstrijd te loggen. Alles werkt realtime, dus collega-coaches zien direct dezelfde informatie.</p>
    </section>

    <section class="hl-sec" data-zoek="de eerste keer inloggen je hoeft niets te installeren. je opent de app gewoon in je browser en logt in op de manier die jij prettig vindt: met google: één tik en je bent binnen. met e-mail en wachtwoord: vul je e-mailadres en een zelfgekozen wachtwoord in. bestaat je account nog niet? dan wordt het automatisch aangemaakt. de volgende keer kom je met diezelfde gegevens direct terug als dezelfde coach. wachtwoord vergeten? tik op "wachtwoord vergeten?" onder de inlogknop, je krijgt dan een mailtje om een nieuw wachtwoord in te stellen.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.4"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4"/><circle cx="12" cy="15.2" r="1.4" fill="currentColor" stroke="none"/></svg> De eerste keer inloggen</h3>
    <p>Je hoeft niets te installeren. Je opent de app gewoon in je browser en logt in op de manier die jij prettig vindt:</p>
    <ul>
      <li><b>Met Google</b>: één tik en je bent binnen.</li>
      <li><b>Met e-mail en wachtwoord</b>: vul je e-mailadres en een zelfgekozen wachtwoord in. Bestaat je account nog niet? Dan wordt het automatisch aangemaakt. De volgende keer kom je met diezelfde gegevens direct terug als dezelfde coach.</li>
    </ul>
    <div class="tip"><b>Wachtwoord vergeten?</b> Tik op "Wachtwoord vergeten?" onder de inlogknop, je krijgt dan een mailtje om een nieuw wachtwoord in te stellen.</div>
    </section>

    <section class="hl-sec" data-zoek="zelf beginnen als trainer zonder club begin met mijn eigen team club plaats weer eerste stappen">
    <h3>Zelf beginnen als trainer</h3>
    <p>Train je een team en heeft je club Cluppie nog niet? Tik op <b>Begin met mijn eigen team</b>. Je doorloopt drie korte stappen:</p>
    <ul>
      <li><b>Uitleg.</b> Wat Cluppie voor je doet, en eerlijk wat je zonder club niet hebt (Sportlink en AI-hulp).</li>
      <li><b>Club en plaats.</b> Vul je club en de plaats of het dorp in en kies je plaats in de lijst. Dan staat het weer op je teamscherm. Categorie, teamnaam en speelduur staan alvast goed; je past ze aan als dat nodig is.</li>
      <li><b>Klaar.</b> Bevestig de privacyafspraak (voornamen, geen gezondheidsgegevens) en je team staat er.</li>
    </ul>
    <p>Op je teamscherm staat daarna de kaart <b>Eerste stappen</b>: spelers toevoegen, een wedstrijd maken, een training maken en een collega uitnodigen. Zijn ze klaar, dan verdwijnt de kaart. Je kunt hem ook verbergen. Club of plaats later wijzigen? Dat kan onder Instellingen → Club en plaats.</p>
    </section>

    <section class="hl-sec" data-zoek="aansluiten bij je team je coach of de clubbeheerder stuurt je een persoonlijke uitnodigingslink (vaak via whatsapp). zo werkt het: tik op de link. je ziet een welkomstscherm met de naam van je team. log in (google of e-mail), en je zit meteen in het juiste team. geen link gekregen, of is hij verlopen? vraag je coach of de clubbeheerder om een nieuwe. een link is 14 dagen geldig.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="17.8" cy="6" r="2.6"/><circle cx="6.2" cy="12" r="2.6"/><circle cx="17.8" cy="18" r="2.6"/><path d="M15.4 7.2 8.6 10.8"/><path d="M8.6 13.2 15.4 16.8"/></svg> Aansluiten bij je team</h3>
    <p>Je coach of de clubbeheerder stuurt je een <b>persoonlijke uitnodigingslink</b> (vaak via WhatsApp). Zo werkt het:</p>
    <ul>
      <li>Tik op de link. Je ziet een welkomstscherm met de naam van je team.</li>
      <li>Log in (Google of e-mail), en je zit meteen in het juiste team.</li>
      <li>Geen link gekregen, of is hij verlopen? Vraag je coach of de clubbeheerder om een nieuwe. Een link is 14 dagen geldig.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="rollen in de club coach bouwcoördinator gekoppelde coach bouw hoofd jeugdopleiding trainingscoördinator clubbeheerder wat zie ik wat kan ik rechten">
    <h3>Rollen in de club</h3>
    <p>Wat je ziet en kunt, hangt af van je rol. De clubbeheerder wijst rollen toe; je kunt er meer dan één hebben.</p>
    <ul>
      <li><b>Coach.</b> Je ziet en beheert je eigen team: spelers, wedstrijden, aanwezigheid, beoordelingen en trainingen. Spelers van andere teams zie je niet.</li>
      ${[['bouw', 'Bouwcoördinator'], ['eigenbouw', 'Coach gekoppeld aan een bouw'], ['hjo', 'Hoofd jeugdopleiding'], ['trainco', 'Trainingscoördinator']].map(([k, naam]) =>
        `<li><b>${naam}.</b> ${esc(ROLKAARTEN[k].ziet)} ${esc(ROLKAARTEN[k].kan)} Niet: ${esc(ROLKAARTEN[k].kanNiet.charAt(0).toLowerCase() + ROLKAARTEN[k].kanNiet.slice(1))}</li>`).join('\n      ')}
      <li><b>Clubbeheerder.</b> Richt de club in: teams, bouwen, coaches en rollen, Sportlink, instellingen en privacy. Ziet alle teams. Onder <b>Club › Mensen</b> staat per rol wie hem heeft en wijs je iemand aan.</li>
    </ul>
    <p>Krijg je een nieuwe rol, dan zie je één keer een korte kaart met wat er voor jou verandert.</p>
    </section>

    <section class="hl-sec" data-zoek="zet de app op je beginscherm voor een echt app-gevoel: open het menu van je browser en kies "toevoegen aan beginscherm" . dan staat cluppie als icoontje tussen je apps en open je hem met één tik, geen browser meer nodig.">
    <h3>Zet de app op je beginscherm</h3>
    <p>Voor een echt app-gevoel: open het menu van je browser en kies <b>"Toevoegen aan beginscherm"</b>. Dan staat Cluppie als icoontje tussen je apps en open je hem met één tik, geen browser meer nodig.</p>
    </section>

    ${htmlJouwRol()}

    <h4 class="hl-hoofdstuk" id="hlh-plannen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none"/></svg> Trainen &amp; plannen</h4>
    <section class="hl-sec" data-zoek="trainingen & video's onder het tabblad training vind je de oefenstof voor je team, gedeeld als pdf. onder video staan youtube-links met oefeningen of beelden. elke zondag worden hier de trainingen voor de komende week en eventuele video's klaargezet, kijk er dus aan het begin van de week even in. een rood stipje op het tabblad laat zien dat er iets nieuws is.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6.6 3.4h7L18.6 8.4v12.2h-12z"/><path d="M13.6 3.4V8.4h5"/></svg> Trainingen & <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="6" width="13" height="12" rx="2.2"/><path d="M16 10l5-3v10l-5-3z"/></svg> video's</h3>
    <p>Onder de tegel <b>Trainingen</b> staan de trainingen van je team: deze week en volgende week bovenaan, eerdere weken samen onder <b>Eerder</b>. Onder <b>Video's</b> staan YouTube-links met oefeningen of beelden.</p>
    <div class="tip">Trainingen uit een seizoensplan verschijnen op de <b>maandag van de week ervoor</b>. Het hele seizoen zie je onder <b>Seizoen</b>. Een <b>rood stipje</b> op de tegel laat zien dat er iets nieuws is.</div>
    </section>

    <section class="hl-sec" data-zoek="training maken onder trainingen staat de tegel training maken. aanpassen geplande training vervangen seizoensplan spelers presentie weer koud regen warm veld materiaal duur 45 60 75 niveau thema maak training wissel vorm bewaar extra training whatsapp">
    <h3>Training maken</h3>
    <p>Onder <b>Trainingen</b> staat de tegel <b>Training maken</b>. Heeft je team een seizoensplan, dan opent hij op de eerstvolgende geplande training, met het thema en de fase van die week. Op Trainingen kun je ook bij een training op <b>Aanpassen</b> tikken.</p>
    <ul>
      <li>Het aantal spelers komt uit de presentie. Duur (45, 60 of 75 minuten), weer, veld en materiaal stel je zelf in; de training past zich meteen aan.</li>
      <li>Een training heeft maximaal vier vormen: warming-up, twee kernvormen en een partijspel. Elke vorm heeft een tekening, regels, coachpunten en een makkelijkere en moeilijkere variant. Met <b>Wissel vorm</b> vervang je één onderdeel.</li>
      <li><b>Bewaar</b> vervangt de geplande training op Trainingen; er komt er geen tweede naast. Wil je juist een extra training, tik dan op <b>Maak er een extra training van</b>.</li>
      <li>Een aangepaste training blijft staan, ook als het seizoensplan later verandert.</li>
    </ul>
    <div class="tip">Training maken werkt <b>zonder AI</b> en bewaart geen spelersnamen. Veldmaten en ruimte per speler zijn richtwaarden, geen KNVB-normen: laat het weten als iets in de praktijk anders werkt.</div>
    </section>

    <section class="hl-sec" data-zoek="speelwijze rode draad hoe willen wij voetballen onder trainingen staat de tegel speelwijze. de speelwijze is de rode draad van het seizoen: de vier momenten van het spel (wij hebben de bal, wij verliezen de bal, zij hebben de bal, wij winnen de bal) met per moment de principes voor de leeftijd van je team. per principe zie je wat je ziet als het lukt, drie coachwoorden, een regel voor het partijspel, de vraag voor na de wedstrijd en een oefening in 3d. de club legt de speelwijze vast onder club › speelwijze (clubbeheerder of hoofd jeugdopleiding, met een stijl als startpunt of een vragenlijst). een trainer zonder club, of een team van een club die nog niets heeft vastgelegd, kiest zelf een stijl of beantwoordt 8 vragen. de speelwijze komt terug in seizoen (thema's die erbij horen komen een keer extra, bij elk blok staat het principe), in training maken (leerdoel, vormen die het principe trainen, coachwoorden, regel in het partijspel), op trainingen en in de wedstrijdevaluatie (de vraag van het principe). leeftijd gaat voor: druk zetten en omschakelen als team komt standaard vanaf o12, vaste posities vanaf o10. zonder speelwijze werkt alles zoals altijd op het thema.">
    <h3>Speelwijze: de rode draad</h3>
    <p>Onder <b>Trainingen</b> staat de tegel <b>Speelwijze</b>. Daar staat hoe jullie willen voetballen, in de vier momenten van het spel: wij hebben de bal, wij verliezen de bal, zij hebben de bal en wij winnen de bal. Per moment zie je de principes voor de leeftijd van je team.</p>
    <ul>
      <li><b>Een principe</b> heeft: wat je ziet als het lukt, drie coachwoorden, een regel voor het partijspel, een vraag voor na de wedstrijd en een oefening die je in 3D kunt bekijken.</li>
      <li><b>Wie legt hem vast?</b> De club, onder Club › Speelwijze (clubbeheerder of hoofd jeugdopleiding). Train je zonder club, of heeft je club nog niets vastgelegd, dan kies je zelf een stijl of beantwoord je acht korte vragen.</li>
      <li><b>Seizoen</b>: thema’s die bij de speelwijze horen komen een keer extra, en bij elk blok staat het principe dat je traint. Onder “De speelwijze in dit seizoen” zie je hoeveel weken elk moment krijgt.</li>
      <li><b>Training maken</b>: bovenaan staat de rode draad (Speelwijze → Seizoen → Training → Wedstrijd) met het leerdoel van vandaag. Vormen die het principe trainen krijgen voorrang en het partijspel krijgt de regel van het principe.</li>
      <li><b>Wedstrijd</b>: in de evaluatie staat de vraag van het principe van die weken. Je antwoord stuurt het seizoensplan bij.</li>
    </ul>
    <div class="tip">Leeftijd gaat voor de speelwijze: druk zetten en omschakelen als team komt standaard vanaf O12, vaste posities vanaf O10. Zonder speelwijze werkt alles zoals altijd, op het thema van de week. De speelwijze is een eigen ontwerp op basis van ervaring van trainers, geen gevalideerde test.</div>
    </section>

    <section class="hl-sec" data-zoek="oefening in 3d spelverloop stappen elke oefening uit de bibliotheek staat in 3d, je hoeft niets te kiezen. je ziet het hele spelverloop stap voor stap: vorige, afspelen, volgende, opnieuw. de tekening zie je nog in de kleine schets, bij afdrukken en op een apparaat zonder 3d. stappen die tegelijk gebeuren (pass en loopactie) spelen samen. elke oefening heeft een uitgeschreven verloop in fases (opbouw, doorbreken, afronden, omschakelen): de reactie van de tegenstander, de afronding en wat er daarna gebeurt. eigen vorm van de club zonder stappen voorbeeld van het vervolg">
    <h3>Oefening in 3D: het hele spelverloop</h3>
    <p>Elke oefening uit de bibliotheek staat in <b>3D</b>: je hoeft niets te kiezen. Je ziet het spelverloop stap voor stap, met Vorige, Afspelen, Volgende en Opnieuw. Stappen die tegelijk gebeuren (een pass en een loopactie) spelen samen.</p>
    <ul>
      <li>Elke oefening uit de bibliotheek heeft een uitgeschreven verloop in fases (bijvoorbeeld Opbouw, Doorbreken, Afronden, Omschakelen). Je ziet ook wat de tegenstander doet en wat er na de afronding gebeurt. Hetzelfde verloop staat in het veld <b>Uitleg</b>.</li>
      <li>De tekening zie je nog in de kleine schets in de tijdlijn, bij afdrukken, en op een apparaat dat geen 3D kan tonen. Een training uit een eigen PDF houdt zijn eigen plaatjes.</li>
      <li>Heeft een eigen vorm van je club maar één of twee pijlen, dan laat 3D daarna een <b>voorbeeld van het vervolg</b> zien. Dat is een voorbeeld op basis van de opstelling, geen vaste afspraak van de oefening.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="teamkamer ouders spelers kinderen meekijken toegang teamlink aanvraag goedkeuren code poll polls wie rijdt wie wast fruit vlaggen stemmen mededeling afmelden whatsapp beurten thuis oefenen live stand opstelling delen privacy verbergen">
    <h3>Teamkamer: ouders en spelers kijken mee</h3>
    <p>In de <b>Teamkamer</b> zien ouders en spelers de agenda, wie erbij is, je mededelingen en polls. Ze zien geen beoordelingen, leerpunten, notities of de reden van een afmelding. Afmelden blijft via de groepsapp gaan: jij zet het in Cluppie.</p>
    <ul>
      <li><b>Zelf aan en uit (Teamkamer, Instellingen):</b> Trainingen (ouders zien de komende trainingen met thema, oefeningen en 3D, zonder jouw aantekeningen), Opstelling altijd delen (vanaf de dag voor de wedstrijd) en Cijfers van het eigen kind. Bij cijfers vink je aan wat mee mag: wedstrijden, speeltijd, doelpunten en assists, opkomst, kaarten. Een ouder ziet alleen het eigen kind, nooit een ranglijst; het kind zelf ziet het niet. Alles staat uit tot jij het aanzet. De cijfers en trainingen lopen bij als een trainer het team opent.</li>
      <li><b>Niet geselecteerd en afgelast:</b> staat een kind niet in de selectie van een wedstrijd, dan zien alleen de eigen ouders "Niet in de selectie". Een afgelaste training staat als afgelast in de agenda van ouders, zonder de reden die jij erbij typte.</li>
      <li><b>Aanzetten:</b> tegel <b>Teamkamer</b> onder Meer (op de computer onder Team). Zie je de tegel niet, dan staat de teamkamer nog niet aan voor je club.</li>
      <li><b>Wat je ziet hangt af van je club:</b> Cluppie zet elke mogelijkheid per club aan (voornamen, spelers zelf, polls, mededelingen, uitslag, live stand, opstelling, thuis oefenen en meer). Wat uit staat, zie je hier niet. Met alleen de teamkamer aan zien ouders de agenda en hoeveel spelers erbij zijn.</li>
      <li><b>Ouders binnenlaten:</b> deel de <b>teamlink</b> in de groepsapp. Een ouder maakt een account en vult de voornaam van het kind in. Jij ziet de aanvraag met het e-mailadres, kiest de speler en tikt op <b>Goedkeuren</b>. Ken je iemand niet, wijs dan af.</li>
      <li><b>Spelers:</b> een ouder maakt in de teamkamer een code. Het kind vult die in en heeft geen e-mailadres of wachtwoord nodig. De ouder kan de toegang altijd stoppen.</li>
      <li><b>Polls:</b> kies een sjabloon (Wie rijdt, Wie wast, Fruit, Vlaggen, Teamuitje) of typ een eigen vraag. Een poll kan bij een wedstrijd horen of los staan. Elk gezin heeft één stem. Jij ziet wie nog niet stemde en deelt de link in WhatsApp.</li>
      <li><b>Namen bij een poll:</b> jij kiest per poll of ouders zien wie wat koos, of alleen de aantallen.</li>
      <li><b>Mededelingen:</b> korte berichten van jou. Ouders en spelers kunnen niet reageren. Zet er geen namen of gezondheid van spelers in.</li>
      <li><b>Instellingen:</b> voornamen van teamgenoten, uitslag, live stand, de opstelling per wedstrijd, een oefening voor thuis en drie afspraken voor langs de lijn. Alles staat uit tot jij het aanzet, behalve de voornamen.</li>
      <li><b>Toegang stopt</b> vanzelf op 30 juni en meteen als een speler het team verlaat. Bij <b>Wie kijkt mee</b> trek je iemands toegang in.</li>
    </ul>
    <p>Ouders en spelers openen <b>www.cluppie.io/kamer.html</b>. Dat is een eigen pagina, los van deze app.</p>
    </section>
    <section class="hl-sec" data-zoek="vandaag spelers en weer training aanpassen aantal spelers minder spelers afmeldingen regen koud warm weerbericht presentie neem over terug naar het plan vervangen groepen veld aangepast voor vandaag andere training maken">
    <h3>Vandaag: de training aanpassen aan spelers en weer</h3>
    <p>Bovenaan elke training staat de balk <b>Vandaag</b>. Kies hoeveel <b>spelers</b> er zijn (− en +) en wat voor <b>weer</b> het is (Gewoon, Koud, Regen of Warm). De training past zich meteen aan, met dezelfde oefeningen.</p>
    <ul>
      <li><b>Voorstellen:</b> staat de presentie van die dag erin, of heeft iemand een vaste afmelding, dan zie je "11 van 14 aanwezig" met de knop <b>Neem over</b>. Binnen een week voor de training staat er ook het weerbericht op het trainingsmoment. Er verandert nooit iets vanzelf: jij tikt.</li>
      <li><b>Wat er verandert:</b> de groepen, de wissels, de maat van het veld, het materiaal en bij ander weer de tijdsindeling (bij kou en regen een korte ontvangst en korte drinkpauzes, bij warmte juist langere).</li>
      <li><b>Vervangen:</b> kan een oefening niet met dit aantal, dan komt er een andere uit de bibliotheek die bij het thema past. Bij de oefening staat wat het was en waarom.</li>
      <li><b>Wat blijft:</b> het thema, het leerdoel, de coachwoorden en de totale duur.</li>
      <li><b>Terug naar het plan</b> zet de training weer zoals hij gepland was. Het plan zelf wordt nooit overschreven, ook niet dat van de club.</li>
      <li>Je medecoaches van het team zien dezelfde aanpassing. Er worden alleen aantallen bewaard, geen namen.</li>
    </ul>
    <div class="tip">Een training uit een eigen PDF (zonder oefeningen uit de bibliotheek) past Cluppie niet zelf aan: daar staat de balk Vandaag dus niet bij. Wil je een heel andere training voor die dag, gebruik dan <b>Andere training maken</b> (als Training maken voor jou aan staat).</div>
    </section>

    <section class="hl-sec" data-zoek="oefenkaart lezen zo zie je dat het lukt waarom dit werkt kijk en grijp in zie je doe dan tel mee richtpunt spelers aan zet regie differentiatie coachmomenten doel succes ingrijpen aanpassen te makkelijk te moeilijk tellen meten kopballen koppen knvb advies">
    <h3>Zo lees je een oefening</h3>
    <p>Elke oefening heeft dezelfde zeven velden. In drie daarvan staat extra hulp voor langs de lijn:</p>
    <ul>
      <li><b>Doel</b>: <i>Zo zie je dat het lukt</i> (twee dingen die je kunt zien, zonder te hoeven raden) en <i>Waarom dit werkt</i> (één zin over het idee achter de oefening).</li>
      <li><b>Differentiatie</b>: <i>Kijk en grijp in</i>. Per oefening twee situaties die vaak voorkomen: wat je ziet, en wat je dan verandert aan het vak, de regels of de telling. Je past de oefening aan in plaats van hem stil te leggen.</li>
      <li><b>Coachmomenten</b>: <i>Tel mee</i> (één ding om te tellen, met een richtpunt) en <i>Spelers aan zet</i> (één manier om de spelers zelf iets te laten kiezen of bedenken).</li>
    </ul>
    <p>De richtpunten zijn een houvast, geen norm. Haalt je groep het makkelijk, maak het dan moeilijker; lukt het bijna nooit, maak het dan makkelijker. Bij oefeningen met koppen staat onder Veiligheid het advies van de KNVB over het aantal kopballen en de hersteltijd.</p>
    </section>

    <section class="hl-sec" data-zoek="voetbaltaal woordenlijst begrippen betekenis wat betekent aannemen afronden back blok compact dekken derde man diep spelen druk zetten joker kaatsen kantelen kappen knijpen linie nummer 10 omschakelen opendraaien overlap overtal positiespel restverdediging rondo rugdekking schijnbeweging spits steekpass tegendruk tweede bal uitstappen vleugelspeler zestien aanname kaatser diepte ondertal linies vaktaal jargon">
    <h3>Voetbaltaal in het kort</h3>
    <p>De oefeningen zijn in gewone taal geschreven. Een paar voetbalwoorden blijven staan, omdat je ze op elk veld hoort. Dit is wat ze betekenen:</p>
    <ul>
      <li><b>Aannemen</b>: de bal met je eerste aanraking onder controle brengen. Dat heet ook de aanname.</li>
      <li><b>Afronden</b>: een aanval afmaken met een schot of kopbal op doel.</li>
      <li><b>Back</b>: de verdediger aan de zijkant.</li>
      <li><b>Blok</b>: het hele team dat dicht bij elkaar verdedigt.</li>
      <li><b>Compact</b>: dicht bij elkaar staan, zodat er weinig ruimte tussen de spelers is.</li>
      <li><b>Dekken</b>: dicht bij een tegenstander blijven, zodat die de bal niet vrij krijgt.</li>
      <li><b>Derde man</b>: de speler die al loopt terwijl twee anderen de bal naar elkaar spelen, en hem daarna krijgt.</li>
      <li><b>Diep spelen</b>: de bal naar voren spelen, achter de verdedigers. Die ruimte heet de diepte.</li>
      <li><b>Druk zetten</b>: snel op de speler met de bal af gaan, zodat die weinig tijd heeft.</li>
      <li><b>Joker</b>: een speler die altijd meedoet met het team dat de bal heeft.</li>
      <li><b>Kaatsen</b>: de bal in één keer terugspelen. Wie dat doet, is de kaatser.</li>
      <li><b>Kantelen</b>: de bal snel naar de andere kant van het veld spelen.</li>
      <li><b>Kappen</b>: de bal met je voet van richting veranderen.</li>
      <li><b>Knijpen</b>: als verdediger naar binnen schuiven, dichter naar het midden.</li>
      <li><b>Linie</b>: een rij spelers: de verdediging, het middenveld of de aanval. Tussen de linies is de ruimte daartussen.</li>
      <li><b>Nummer 10</b>: de aanvallende middenvelder, tussen het middenveld en de spits.</li>
      <li><b>Omschakelen</b>: het moment dat de bal van team wisselt: van aanvallen naar verdedigen of andersom.</li>
      <li><b>Opendraaien</b>: de bal zo aannemen dat je daarna naar voren kijkt.</li>
      <li><b>Overlap</b>: aan de buitenkant achter een medespeler langs lopen om de bal verderop te krijgen.</li>
      <li><b>Overtal</b>: met meer spelers zijn dan de tegenstander op een deel van het veld. Ondertal is het omgekeerde.</li>
      <li><b>Positiespel</b>: de bal in het team houden door goed te staan en te bewegen.</li>
      <li><b>Restverdediging</b>: de spelers die tijdens de aanval achter de bal blijven.</li>
      <li><b>Rondo</b>: spelers in een kring houden de bal weg bij een of meer jagers in het midden.</li>
      <li><b>Rugdekking</b>: schuin achter een medespeler staan om te helpen als die wordt gepasseerd.</li>
      <li><b>Schijnbeweging</b>: doen alsof je de ene kant op gaat en dan de andere kant op gaan.</li>
      <li><b>Spits</b>: de voorste aanvaller.</li>
      <li><b>Steekpass</b>: een pass tussen de verdedigers door, voor een speler die diep loopt.</li>
      <li><b>Tegendruk</b>: direct na balverlies samen druk zetten om de bal terug te winnen.</li>
      <li><b>Tweede bal</b>: de bal die vrij komt na een duel, een kopbal of een gekeerd schot.</li>
      <li><b>Uitstappen</b>: als verdediger naar voren stappen, naar de speler met de bal.</li>
      <li><b>Vleugelspeler</b>: de aanvaller aan de zijkant.</li>
      <li><b>Zestien</b>: het strafschopgebied.</li>
    </ul>
    <p>Tegen de jongste spelers gebruik je deze woorden nog niet. In het veld <b>Uitleg</b> staat steeds een zin die je zo kunt zeggen.</p>
    </section>

    <section class="hl-sec" data-zoek="seizoen jaarlijn blokken bijsturing seizoensplan club eigen plan alleen lezen coördinator opzet opbouwmodel leercurve vrije weken trainingen per week duur accent signalen thema-check evaluatie">
    <h3>Seizoen: jaarlijn en bijsturing</h3>
    <p>Onder <b>Trainingen</b> staat ook de tegel <b>Seizoen</b>. Een team heeft één seizoensplan: van de club of je eigen plan.</p>
    <ul>
      <li><b>Van de club</b>: je coördinator of hoofd jeugd heeft het plan aan je team toegewezen. Je ziet de blokken en de komende weken, maar wijzigt niets. Signalen uit je evaluaties bespreek je met je coördinator.</li>
      <li><b>Eigen plan</b> (als je club je vrij laat, of zonder club): kies onder <b>1 Opzet</b> een opbouwmodel, de datums, vrije weken, trainingen per week en duur. Cluppie maakt een jaarlijn in blokken van 4 tot 6 weken, met uitleg waarom.</li>
      <li><b>Bijsturing</b>: na minstens 3 wedstrijdevaluaties doet de app hooguit één voorstel per week. Jij kiest <b>Toepassen</b> of <b>Negeren</b>. Toepassen verandert alleen trainingen die nog niet zichtbaar zijn.</li>
    </ul>
    <div class="tip">De trainingen van het plan komen per week op Trainingen, op de maandag van de week ervoor. Heeft je team een seizoensplan, dan vraagt de evaluatie na een wedstrijd ook of het thema van die week terugkwam. Dat is het beste signaal om bij te sturen.</div>
    </section>

    <section class="hl-sec" data-zoek="vaste afmelding kan een speler een tijd lang op een vaste trainingsdag niet, bijvoorbeeld elke maandag gedurende 10 weken? tik op het tabblad presentie → training op vaste afmelding en kies speler, trainingsdag, startdatum, aantal weken en eventueel een reden. op die datums staat hij alvast op afwezig zodra je de presentie opent, met het label vast. is hij er toch, tik dan op zijn naam. de afwezigheid telt pas mee in de opkomst als je de presentie die dag echt invult; gaat een training niet door, dan telt hij dus ook niet als gemist. onder de knoppen staan de lopende vaste afmeldingen. met stoppen haal je er een weg; toekomstige afmeldingen die uit die regel kwamen verdwijnen dan ook.">
    <h3>Vaste afmelding</h3>
    <p>Kan een speler een tijd lang op een vaste trainingsdag niet, bijvoorbeeld elke maandag gedurende 10 weken? Tik op het tabblad <b>Presentie → Training</b> op <b>Vaste afmelding</b> en kies speler, trainingsdag, startdatum, aantal weken en eventueel een reden.</p>
    <ul>
      <li>Op die datums staat hij alvast op afwezig zodra je de presentie opent, met het label <b>vast</b>. Is hij er toch, tik dan op zijn naam.</li>
      <li>De afwezigheid telt pas mee in de opkomst als je de presentie die dag echt invult. Gaat een training niet door, dan telt hij dus ook niet als gemist.</li>
      <li>Onder de knoppen staan de lopende vaste afmeldingen. Met <b>Stoppen</b> haal je er een weg; toekomstige afmeldingen die uit die regel kwamen verdwijnen dan ook.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="seizoensplanning het tabblad planning toont de hele seizoenskalender van je team in één lijst, per maand gegroepeerd. verleden maanden staan ingeklapt; de huidige en komende maanden staan open. echte wedstrijden uit voetbal.nl verschijnen hier automatisch met een-stip. de app haalt ze 's nachts op uit de officiële knvb-kalender, dus zodra de competitie-indeling bekend is staat alles klaar, thuis/uit, datum en tegenstander. op een dag met een echte wedstrijd wordt de algemene wd (wedstrijddag) onderdrukt, zodat je geen dubbele regels ziet. tik op een wedstrijd-regel om die wedstrijd direct te openen en de opstelling klaar te zetten. met de filterknoppen bovenaan ( alles , wedstrijden , speeldagen , beker , vrij ) bekijk je gericht één soort dag. + eigen dag : voeg zelf een toernooi, vriendschappelijke wedstrijd of vrije dag toe. die staat dan met een eigen markering tussen de officiële dagen. tip: verschijnen er nog geen wedstrijden? dan is de knvb-kalender voor jouw team nog niet gepubliceerd. zodra dat gebeurt, vullen ze zichzelf aan, je hoeft niets te doen.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none"/></svg> Seizoensplanning</h3>
    <p>Het tabblad <b>Kalender</b> (heette Planning) toont de hele seizoenskalender van je team in één lijst, per maand gegroepeerd. Verleden maanden staan ingeklapt; de huidige en komende maanden staan open.</p>
    <ul>
      <li><b>Echte wedstrijden uit voetbal.nl</b> verschijnen hier automatisch met een <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg>-stip. De app haalt ze 's nachts op uit de officiële KNVB-kalender, dus zodra de competitie-indeling bekend is staat alles klaar, thuis/uit, datum en tegenstander.</li>
      <li>Op een dag met een echte wedstrijd wordt de algemene <kbd>WD</kbd> (wedstrijddag) onderdrukt, zodat je geen dubbele regels ziet.</li>
      <li>Tik op een wedstrijd-regel om die wedstrijd direct te openen en de opstelling klaar te zetten.</li>
      <li>Met de filterknoppen bovenaan (<kbd>Alles</kbd>, <kbd>Wedstrijden</kbd>, <kbd>Speeldagen</kbd>, <kbd>Beker</kbd>, <kbd>Vrij</kbd>) bekijk je gericht één soort dag.</li>
      <li><b>+ Eigen dag</b>: voeg zelf een toernooi, vriendschappelijke wedstrijd of vrije dag toe. Die staat dan met een eigen markering tussen de officiële dagen.</li>
    </ul>
    <div class="tip"><b>Tip:</b> verschijnen er nog geen wedstrijden? Dan is de KNVB-kalender voor jouw team nog niet gepubliceerd. Zodra dat gebeurt, vullen ze zichzelf aan, je hoeft niets te doen.</div>
    </section>

    <section class="hl-sec" data-zoek="je eigen naam instellen onder team kun je via "mijn weergavenaam wijzigen" instellen hoe je in de coachlijst verschijnt. handig zodat je teamgenoten zien wie wie is.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15.4 4.8 19.2 8.6 9 18.8l-4 1.2 1.2-4z"/><path d="M13.4 6.8 17.2 10.6"/></svg> Je eigen naam instellen</h3>
    <p>Onder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.1"/><path d="M12 3.2 13.6 5.4l2.6-.6 1 2.5 2.6.7-.5 2.6L21 12l-1.7 1.4.5 2.6-2.6.7-1 2.5-2.6-.6L12 20.8l-1.6-2.2-2.6.6-1-2.5-2.6-.7.5-2.6L3 12l1.7-1.4-.5-2.6 2.6-.7 1-2.5 2.6.6z"/></svg> <b>Team</b> kun je via <b>"Mijn weergavenaam wijzigen"</b> instellen hoe je in de coachlijst verschijnt. Handig zodat je teamgenoten zien wie wie is.</p>
    </section>

    <section class="hl-sec" data-zoek="toernooitje onderling toernooi mini toernooi klok timer score stand veldjes gastspelers husselen wijzigen aanpassen teamnaam teamnamen andere spelers met toernooitje (tegel onder alles, bij meer) speel je een onderling toernooitje met je eigen spelers en gastspelers. handig aan het eind van een training of op een vrije zaterdag. opzet in drie stappen. vink aan wie er meedoet en voeg gastspelers toe met alleen een voornaam. kies daarna het aantal veldjes en geef de totale tijd of de wedstrijdduur op: cluppie rekent de rondes, de duur en de eindtijd uit. bij vaste teams maak je als laatste de teams met husselen of eerlijk verdelen. twee vormen. bij vaste teams speelt iedereen tegen iedereen, met een stand per team en als je wilt een finale. bij wisselende teams wordt er elke ronde opnieuw gehusseld en spaart elke speler zijn eigen punten. tijdens het spelen. eén klok voor alle veldjes, met een piep en trilsignaal aan het eind van de ronde. tik op de rode plus om een doelpunt te tellen. een collega-coach kan op zijn eigen telefoon een ander veldje bijhouden. onder schema verbeter je een uitslag, onder stand zie je de tussenstand en onder teams verplaats je een speler. na afloop zie je de eindstand en deel je de uitslag via whatsapp, met alleen voornamen. de uitslagen van een toernooitje tellen niet mee in de speelminuten, stats of presentie. eerlijk verdelen gebruikt alleen de beoordelingen die het hele team ziet; de niveaus komen nergens in beeld.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8.4 4h7.2v3.6a3.6 3.6 0 0 1-7.2 0z"/><path d="M8.4 5.4H5.8a2.4 2.4 0 0 0 2.6 3.2"/><path d="M15.6 5.4h2.6a2.4 2.4 0 0 1-2.6 3.2"/><path d="M12 11.2v3"/><path d="M9.2 19.8h5.6l-.7-3.6h-4.2z"/></svg> Toernooitje</h3>
    <p>Met <b>Toernooitje</b> (tegel onder <b>Alles</b>, bij Meer) speel je een onderling toernooitje met je eigen spelers en gastspelers. Handig aan het eind van een training of op een vrije zaterdag.</p>
    <p><b>Opzet in drie stappen.</b> Vink aan wie er meedoet en voeg gastspelers toe met alleen een voornaam. Kies daarna het aantal veldjes en geef de totale tijd of de wedstrijdduur op: Cluppie rekent de rondes, de duur en de eindtijd uit. Bij vaste teams maak je als laatste de teams met Husselen of Eerlijk verdelen.</p>
    <p><b>Twee vormen.</b> Bij <b>vaste teams</b> speelt iedereen tegen iedereen, met een stand per team en als je wilt een finale. Bij <b>wisselende teams</b> wordt er elke ronde opnieuw gehusseld en spaart elke speler zijn eigen punten.</p>
    <p><b>Tijdens het spelen.</b> Eén klok voor alle veldjes, met een piep en trilsignaal aan het eind van de ronde. Tik op de rode plus om een doelpunt te tellen. Een collega-coach kan op zijn eigen telefoon een ander veldje bijhouden. Onder Schema verbeter je een uitslag, onder Stand zie je de tussenstand en onder Teams verplaats je een speler.</p>
    <p><b>Wijzigen.</b> Met het potloodje rechtsboven pas je een gemaakt toernooitje aan: andere spelers, veldjes, tijd of rondes. Gespeelde wedstrijden blijven staan en de rest wordt opnieuw ingedeeld. Een ander aantal teams of een andere vorm kan na de eerste wedstrijd alleen door opnieuw te beginnen. Tik op een teamnaam om het team een eigen naam te geven.</p>
    <p><b>Na afloop</b> zie je de eindstand en deel je de uitslag via WhatsApp, met alleen voornamen.</p>
    <div class="tip">De uitslagen van een toernooitje tellen <b>niet</b> mee in de speelminuten, Stats of presentie. Eerlijk verdelen gebruikt alleen de beoordelingen die het hele team ziet; de niveaus komen nergens in beeld.</div>
    </section>

    <h4 class="hl-hoofdstuk" id="hlh-wedstrijddag"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg> Op de wedstrijddag</h4>
    <section class="hl-sec" data-zoek="snel beginnen voeg je spelers toe onder het tabblad: naam en rugnummer is genoeg. maak een nieuwe wedstrijd aan onder. kies competitie of toernooi. sleep spelers van de bank naar het veld of tik ze aan en tik daarna een positie. start de klok ▶ zodra de wedstrijd begint. wissels tijdens het spel worden automatisch gelogd met tijdstip.">
    <h3>Snel beginnen</h3>
    <ul>
      <li>Voeg je <b>spelers</b> toe onder het tabblad <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9.2 4.5 6 6.2v4l2.2-.7v10h7.6v-10l2.2.7v-4l-3.2-1.7a2.9 2.9 0 0 1-5.6 0z"/></svg>: naam en rugnummer is genoeg.</li>
      <li>Maak een <b>nieuwe wedstrijd</b> aan onder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="4.5" width="14" height="16" rx="2.2"/><path d="M9 3.2h6v3H9z"/><path d="M8.8 11.4h6.4"/><path d="M8.8 15.4h4"/></svg>. Kies competitie of toernooi.</li>
      <li>Sleep spelers van de bank naar het veld of tik ze aan en tik daarna een positie.</li>
      <li>Start de klok ▶ zodra de wedstrijd begint. Wissels tijdens het spel worden automatisch gelogd met tijdstip.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="wedstrijd opzetten bij een gloednieuwe wedstrijd doorloop je automatisch vier korte stappen: aanvoerder, aantal spelers, speelwijze en wedstrijddoel. geen tijd of zin? tik op overslaan: alles is later nog aan te passen via wijzig opzet rechtsboven in het wedstrijdscherm.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/></svg> Wedstrijd opzetten</h3>
    <p>Bij een gloednieuwe wedstrijd doorloop je automatisch vier korte stappen: <b>aanvoerder</b>, <b>aantal spelers</b>, <b>speelwijze</b> en <b>wedstrijddoel</b>. Geen tijd of zin? Tik op <b>Overslaan</b>: alles is later nog aan te passen via <b>Wijzig opzet</b> rechtsboven in het wedstrijdscherm.</p>
    </section>

    <section class="hl-sec" data-zoek="spelers slepen & wisselen op het veld werk je met spelersbolletjes (de chips ): slepen : houd een speler vast en sleep hem naar een andere positie, een lege plek, of naar de bank. tikken : één tik selecteert (gele rand). tik daarna een doel om de speler daar neer te zetten. positie ruilen : sleep een veldspeler naar een andere veldspeler, ze wisselen van positie. loopt de klok? dan wordt elke bank→veld of veld→bank actie geregistreerd als wissel met tijdstip in het log. tip: de bank is gesorteerd op minste speeltijd, wie aan de beurt is, staat vooraan.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg> Spelers slepen & wisselen</h3>
    <p>Op het veld werk je met spelersbolletjes (de <b>chips</b>):</p>
    <ul>
      <li><b>Slepen</b>: houd een speler vast en sleep hem naar een andere positie, een lege plek, of naar de bank.</li>
      <li><b>Tikken</b>: één tik selecteert (gele rand). Tik daarna een doel om de speler daar neer te zetten.</li>
      <li><b>Positie ruilen</b>: sleep een veldspeler naar een andere veldspeler, ze wisselen van positie.</li>
      <li><b>Loopt de klok?</b> Dan wordt elke bank→veld of veld→bank actie geregistreerd als wissel met tijdstip in het log.</li>
    </ul>
    <div class="tip"><b>Tip:</b> de bank is gesorteerd op minste speeltijd, wie aan de beurt is, staat vooraan.</div>
    </section>

    <section class="hl-sec" data-zoek="stippen onder spelers onder elke chip verschijnen vanaf het tweede kwart kleine stippen, één per eerder kwart: groen = die periode gespeeld. rood = die periode op de bank. zo zie je in één oogopslag wie er nu echt aan de beurt is.">
    <h3>Stippen onder spelers</h3>
    <p>Onder elke chip verschijnen vanaf het tweede kwart kleine stippen, één per eerder kwart:</p>
    <ul>
      <li><b>Groen</b> = die periode gespeeld.</li>
      <li><b>Rood</b> = die periode op de bank.</li>
    </ul>
    <p>Zo zie je in één oogopslag wie er nu echt aan de beurt is.</p>
    </section>

    <section class="hl-sec" data-zoek="kwarten, helften & klok de app stelt het juiste aantal periodes en de speeltijd in op basis van de knvb-categorie van je team. tik op een periode-tab ( k1 , k2 ... of h1 , h2 ) om eraan te werken. de klok stopt automatisch op de maximale speeltijd, je kunt hem dus niet vergeten. open je een leeg kwart, dan wordt de eindopstelling van het vorige kwart automatisch overgenomen. met ↺ zet je de klok terug op nul; wissels blijven staan.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2.2"/></svg> Kwarten, helften & klok</h3>
    <ul>
      <li>De app stelt het juiste aantal periodes en de speeltijd in op basis van de KNVB-categorie van je team.</li>
      <li>Tik op een periode-tab (<kbd>K1</kbd>, <kbd>K2</kbd> ... of <kbd>H1</kbd>, <kbd>H2</kbd>) om eraan te werken.</li>
      <li>De klok stopt <b>automatisch</b> op de maximale speeltijd: je kunt hem dus niet vergeten.</li>
      <li>Open je een leeg kwart, dan wordt de eindopstelling van het vorige kwart automatisch overgenomen.</li>
      <li>Met ↺ zet je de klok terug op nul; wissels blijven staan.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="opstelling van vorige wedstrijd bij een nieuwe wedstrijd kun je de optie "begin met opstelling van vorige wedstrijd" aanvinken. het eerste kwart wordt dan gevuld met de startopstelling van je laatste wedstrijd in hetzelfde format, zo hoef je niet elke keer opnieuw te beginnen, en pas je alleen aan wie er deze keer ontbreekt.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="4.5" width="14" height="16" rx="2.2"/><path d="M9 3.2h6v3H9z"/><path d="M8.8 11.4h6.4"/><path d="M8.8 15.4h4"/></svg> Opstelling van vorige wedstrijd</h3>
    <p>Bij een nieuwe wedstrijd kun je de optie <b>"Begin met opstelling van vorige wedstrijd"</b> aanvinken. Het eerste kwart wordt dan gevuld met de startopstelling van je laatste wedstrijd in hetzelfde format, zo hoef je niet elke keer opnieuw te beginnen, en pas je alleen aan wie er deze keer ontbreekt.</p>
    </section>

    <section class="hl-sec" data-zoek="↩︎ vorige confrontatie open je een wedstrijd tegen een tegenstander waar je dit seizoen al eens tegen speelde, dan verschijnt bovenin een regeltje "vorige keer:" met datum, thuis/uit en de uitslag (groen = gewonnen, rood = verloren, grijs = gelijk). tik erop om het paneel uit te klappen: je ziet de volledige uitslag en, als je die had ingevuld, het wedstrijddoel en je notitie van toen. met → bekijk deze wedstrijd spring je direct naar de oude wedstrijd om de opstelling van destijds terug te zien. slim: de naamvergelijking negeert hoofdletters, spaties en het eigen clubvoorvoegsel, zodat dezelfde tegenstander altijd herkend wordt, ook als de schrijfwijze net iets verschilt.">
    <h3>↩︎ Vorige confrontatie</h3>
    <p>Open je een wedstrijd tegen een tegenstander waar je dit seizoen al eens tegen speelde, dan verschijnt bovenin een regeltje <b>"Vorige keer:"</b> met datum, thuis/uit en de uitslag (groen = gewonnen, rood = verloren, grijs = gelijk).</p>
    <ul>
      <li>Tik erop om het paneel uit te klappen: je ziet de volledige uitslag en, als je die had ingevuld, het wedstrijddoel en je notitie van toen.</li>
      <li>Met <b>→ Bekijk deze wedstrijd</b> spring je direct naar de oude wedstrijd om de opstelling van destijds terug te zien.</li>
    </ul>
    <div class="tip"><b>Slim:</b> de naamvergelijking negeert hoofdletters, spaties en het eigen clubvoorvoegsel, zodat dezelfde tegenstander altijd herkend wordt, ook als de schrijfwijze net iets verschilt.</div>
    </section>

    <section class="hl-sec" data-zoek="wissels vooraf plannen onder het wisselvak staat + wissel plannen : kies wie erin, wie eruit en na hoeveel minuten. zodra de klok dat moment passeert, knippert de geplande wissel en trilt je telefoon. tik op ✓ om hem door te voeren. wie aan de beurt is minst gespeeld: in plaats van een vaste speler kun je bij erin kiezen voor wie aan de beurt is. de app brengt dan op het wisselmoment automatisch de speler met de minste speeltijd van de bank in, zodat de speeltijd eerlijk verdeeld blijft. verwachte speeltijd: onder speeltijd deze wedstrijd staat bij geplande wissels de verwachte speeltijd met een ~, met uit- en in-labels in één kleur per wissel. dit telt niet mee in statistieken, profielen of verslag. met de schakelaar verwachte speeltijd tonen zet je het uit. bij wie aan de beurt is telt alleen de speler die eruit gaat.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none"/></svg> Wissels vooraf plannen</h3>
    <p>Onder het wisselvak staat <b>+ Wissel plannen</b>: kies wie erin, wie eruit en na hoeveel minuten. Zodra de klok dat moment passeert, knippert de geplande wissel en trilt je telefoon. Tik op <kbd>✓</kbd> om hem door te voeren.</p>
    <div class="tip"><b>★ Wie aan de beurt is:</b> in plaats van een vaste speler kies je bij <b>Erin</b> voor <b>“wie aan de beurt is (minst gespeeld)”</b>. De app brengt dan op het wisselmoment automatisch de bankspeler met de minste speeltijd in, zo verdeel je de speeltijd eerlijk zonder vooraf te rekenen.</div>
    <p><b>Verwachte speeltijd:</b> onder <b>Speeltijd deze wedstrijd</b> zie je bij geplande wissels hoeveel minuten iemand naar verwachting speelt. Die tijden staan schuin met een <b>~</b>, met een label <b>uit</b> of <b>in</b> in één kleur per wissel. Dit telt niet mee in de statistieken, spelersprofielen of het verslag. Met de schakelaar <b>Verwachte speeltijd tonen</b> zet je het uit. Bij <b>wie aan de beurt is</b> telt alleen de speler die eruit gaat; de invaller telt pas mee zodra de wissel is doorgevoerd.</p>
    </section>

    <section class="hl-sec" data-zoek="doelpunten registreren & corrigeren tik op de-knop aan jouw kant van het scorebord en kies de speler die scoorde. tegendoelpunt: één tik op de andere-knop. verkeerd getikt? tik op het doelpunt in het gebeurtenissen-log. je kunt dan de juiste scorer kiezen, de kant omdraaien (voor ↔ tegen) of het doelpunt verwijderen. doelpunten verschijnen in het log en in de seizoenstatistieken (topscorer).">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg> Doelpunten registreren & corrigeren</h3>
    <ul>
      <li>Tik op de <b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg>-knop</b> aan jouw kant van het scorebord en kies de speler die scoorde.</li>
      <li>Tegendoelpunt: één tik op de andere <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg>-knop.</li>
      <li><b>Verkeerd getikt?</b> Tik op het doelpunt in het gebeurtenissen-log. Je kunt dan de juiste scorer kiezen, de kant omdraaien (voor ↔ tegen) of het doelpunt verwijderen.</li>
      <li>Doelpunten verschijnen in het log en in de seizoenstatistieken (topscorer).</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="kaarten & straffen de gele knop bij de klok opent het kaartenmenu. kies de speler en het type: geel: waarschuwing. een tweede gele in dezelfde wedstrijd geeft automatisch rood . tijdstraf: 5 minuten voor pupillen (t/m jo/mo15), 10 minuten voor jo/mo16+ en senioren. rood: de speler wordt direct van het veld gehaald. verkeerde kaart? tik erop in het log om de speler te wijzigen of de kaart te verwijderen.">
    <h3><span class="kaartje geel" aria-hidden="true"></span> Kaarten & straffen</h3>
    <p>De gele knop bij de klok opent het kaartenmenu. Kies de speler en het type:</p>
    <ul>
      <li><b><span class="kaartje geel" aria-hidden="true"></span> Geel</b>: waarschuwing. Een tweede gele in dezelfde wedstrijd geeft <b>automatisch rood</b>.</li>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2.2"/></svg> Tijdstraf</b>: 5 minuten voor pupillen (t/m JO/MO15), 10 minuten voor JO/MO16+ en senioren.</li>
      <li><b><span class="kaartje rood" aria-hidden="true"></span> Rood</b>: de speler wordt direct van het veld gehaald.</li>
      <li>Verkeerde kaart? Tik erop in het log om de speler te wijzigen of de kaart te verwijderen.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="aanvoerder onder wijzig opzet in de wedstrijd kies je per wedstrijd de aanvoerder. hij krijgt een geel c -bandje op zijn shirt. in de statistieken zie je hoe vaak iemand aanvoerder is geweest, handig om te rouleren.">
    <h3>Aanvoerder</h3>
    <p>Onder <b>Wijzig opzet</b> in de wedstrijd kies je per wedstrijd de aanvoerder. Hij krijgt een geel <b>C</b>-bandje op zijn shirt. In de statistieken zie je hoe vaak iemand aanvoerder is geweest, handig om te rouleren.</p>
    </section>

    <section class="hl-sec" data-zoek="toernooien bij een nieuwe wedstrijd kies je toernooi . geef het aantal wedstrijden op en het aantal helften per wedstrijd. de tabs worden dan w1 , w2 ... de tegenstander per wedstrijd vul je in door op de naam in het scorebord te tikken (gestippeld onderstreept). op één scherm: alle wissels en speeltijden lopen over het hele toernooi door, zodat je in wedstrijd 4 ziet wie er bij wedstrijd 1, 2 en 3 al heeft gespeeld.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8.4 4h7.2v3.6a3.6 3.6 0 0 1-7.2 0z"/><path d="M8.4 5.4H5.8a2.4 2.4 0 0 0 2.6 3.2"/><path d="M15.6 5.4h2.6a2.4 2.4 0 0 1-2.6 3.2"/><path d="M12 11.2v3"/><path d="M9.2 19.8h5.6l-.7-3.6h-4.2z"/></svg> Toernooien</h3>
    <p>Bij een nieuwe wedstrijd kies je <b>Toernooi</b>. Geef het aantal wedstrijden op en het aantal helften per wedstrijd. De tabs worden dan <kbd>W1</kbd>, <kbd>W2</kbd> ... De tegenstander per wedstrijd vul je in door op de naam in het scorebord te tikken (gestippeld onderstreept).</p>
    <div class="tip"><b>Op één scherm:</b> alle wissels en speeltijden lopen over het hele toernooi door, zodat je in wedstrijd 4 ziet wie er bij wedstrijd 1, 2 en 3 al heeft gespeeld.</div>
    </section>

    <h4 class="hl-hoofdstuk" id="hlh-club"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3 20 6.5V11c0 4.5-3.1 8.7-8 10-4.9-1.3-8-5.5-8-10V6.5z"/><circle cx="12" cy="10.4" r="2.1"/><path d="M8.8 16.2a3.6 3.6 0 0 1 6.4 0"/></svg> Club &amp; team beheren</h4>
    <section class="hl-sec" data-zoek="clubs & trainingen delen werk je als hoofdtrainer voor meerdere teams? maak op het startscherm een club aan. daarmee kun je: teams aanmaken die bij jouw club horen (de coaches ervan komen direct in het juiste team). pdf importeren : upload een pdf met de teamindeling en de app leest de teams en spelers automatisch uit. controleer in de preview, klik "aanmaken" en alle teams + spelers staan klaar. coaches uitnodigen met een persoonlijke link (via whatsapp). met alle uitnodigingen krijg je in één overzicht alle links voor alle teams. pdf-trainingen uploaden en aangeven voor welke teams ze beschikbaar zijn. de trainers zien ze in het training-tabblad van hun team. met pas je de titel, week of de gekoppelde teams later aan, zonder het bestand opnieuw te uploaden. een stip op het training-tabblad waarschuwt coaches voor nieuwe, ongelezen trainingen.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3 20 6.5V11c0 4.5-3.1 8.7-8 10-4.9-1.3-8-5.5-8-10V6.5z"/><circle cx="12" cy="10.4" r="2.1"/><path d="M8.8 16.2a3.6 3.6 0 0 1 6.4 0"/></svg> Clubs & trainingen delen</h3>
    <p>Werk je als hoofdtrainer voor meerdere teams? Maak op het startscherm een <b>club</b> aan. Daarmee kun je:</p>
    <ul>
      <li>Teams aanmaken die bij jouw club horen (de coaches ervan komen direct in het juiste team).</li>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg> PDF importeren</b>: upload een PDF met de teamindeling en de app leest de teams en spelers automatisch uit. Controleer in de preview, klik "Aanmaken" en alle teams + spelers staan klaar.</li>
      <li>Coaches uitnodigen met een persoonlijke link (via WhatsApp). Met <b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="17.8" cy="6" r="2.6"/><circle cx="6.2" cy="12" r="2.6"/><circle cx="17.8" cy="18" r="2.6"/><path d="M15.4 7.2 8.6 10.8"/><path d="M8.6 13.2 15.4 16.8"/></svg> Alle uitnodigingen</b> krijg je in één overzicht alle links voor alle teams.</li>
      <li>PDF-trainingen uploaden en aangeven voor welke teams ze beschikbaar zijn. De trainers zien ze in het <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6.6 3.4h7L18.6 8.4v12.2h-12z"/><path d="M13.6 3.4V8.4h5"/></svg> Training-tabblad van hun team. Met <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15.4 4.8 19.2 8.6 9 18.8l-4 1.2 1.2-4z"/><path d="M13.4 6.8 17.2 10.6"/></svg> pas je de titel, week of de gekoppelde teams later aan, zonder het bestand opnieuw te uploaden.</li>
      <li>Een stip op het training-tabblad waarschuwt coaches voor nieuwe, ongelezen trainingen.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="meerdere coaches & rommel opruimen onder team vind je de lijst coaches en de knop coach uitnodigen. een collega-coach krijgt een persoonlijke link (14 dagen geldig): ze openen de link en loggen in met hun e-mailadres of google. daarna zitten ze direct in het team, en komen ze later met dezelfde login terug als dezelfde coach. staat er iemand verkeerd of dubbel in de lijst? tik op het naast een coach om die te verwijderen uit het team. wijzigingen lopen realtime door: handig als de assistent-coach langs de lijn de wissels bijhoudt en de hoofdcoach de score.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="2.8"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="8.5" r="2.3"/><path d="M15.5 13.4A4.8 4.8 0 0 1 20.5 18"/></svg> Meerdere coaches & rommel opruimen</h3>
    <p>Onder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.1"/><path d="M12 3.2 13.6 5.4l2.6-.6 1 2.5 2.6.7-.5 2.6L21 12l-1.7 1.4.5 2.6-2.6.7-1 2.5-2.6-.6L12 20.8l-1.6-2.2-2.6.6-1-2.5-2.6-.7.5-2.6L3 12l1.7-1.4-.5-2.6 2.6-.7 1-2.5 2.6.6z"/></svg> <b>Team</b> vind je de lijst <b>coaches</b> en de knop <b>Coach uitnodigen</b>. Een collega-coach krijgt een persoonlijke link die 14 dagen geldig is:</p>
    <ul>
      <li>Ze openen de link en loggen in met hun e-mailadres of Google. Daarna zitten ze direct in het team, en komen ze later met dezelfde login terug als dezelfde coach.</li>
      <li>Staat er iemand verkeerd of dubbel in de lijst? Tik op het <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5.4 7.4h13.2"/><path d="M7.4 7.4 8.3 20h7.4l.9-12.6"/><path d="M9.6 4.4h4.8l.6 3H9z"/><path d="M10.6 11v5.4M13.4 11v5.4"/></svg> naast een coach om die te verwijderen uit het team.</li>
      <li>Wijzigingen lopen realtime door: handig als de assistent-coach langs de lijn de wissels bijhoudt en de hoofdcoach de score.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="format en formatie wijzigen onder wijzig opzet in een wedstrijd pas je het format (6×6, 8×8, 9×9, 11×11, 4×4) en de formatie aan. spelers blijven zoveel mogelijk op hun plek staan; slots die wegvallen worden netjes opgeschoond.">
    <h3>Format en formatie wijzigen</h3>
    <p>Onder <b>Wijzig opzet</b> in een wedstrijd pas je het format (6×6, 8×8, 9×9, 11×11, 4×4) en de formatie aan. Spelers blijven zoveel mogelijk op hun plek staan; slots die wegvallen worden netjes opgeschoond.</p>
    </section>

    <section class="hl-sec" data-zoek="statistieken onder vind je het seizoensoverzicht: speeltijd, doelpunten, aanvoerdersbeurten, keeperbeurten en kaarten per speler. sorteert vanzelf op meeste speeltijd. jaaroverzicht seizoen in cijfers team speler afdrukken pdf delen met de club samenvatting">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 19V10"/><path d="M11 19V5"/><path d="M18 19v-7"/></svg> Statistieken</h3>
    <p>Onder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2.2"/></svg> vind je het seizoensoverzicht: speeltijd, doelpunten, aanvoerdersbeurten, keeperbeurten en kaarten per speler. Sorteert vanzelf op meeste speeltijd.</p>
    <p><b>Jaaroverzicht.</b> Onderaan Stats (op de laptop rechtsboven) staat de knop Jaaroverzicht. Je krijgt het seizoen van je team op één blad: wedstrijden, doelpunten, trainingen en opkomst, hoe eerlijk de speeltijd verdeeld is en hoeveel er geëvalueerd is. Er staan geen namen van spelers in. Met <b>Afdrukken of pdf</b> bewaar je het, met <b>Deel samenvatting</b> stuur je een korte tekst naar je club. Onder <b>Speler</b> maak je hetzelfde voor één speler, zonder notities; deel dat alleen binnen de club.</p>
    </section>

    <h4 class="hl-hoofdstuk" id="hlh-beoordelen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> Beoordelen &amp; evalueren</h4>
    <section class="hl-sec" data-zoek="spelers beoordelen per speler leg je de ontwikkeling vast. open een speler (tab spelers → tik op de speler) en je vindt daar het ontwikkelprofiel met twee manieren om te beoordelen: snel beoordelen: een paar tikken na een wedstrijd of training: een algemeen niveau plus optionele "opvallend"-tags. ideaal om er een gewoonte van te maken. volledige beoordeling: een periodieke, diepere meting op de vijf ontwikkeldomeinen. hieruit komt het ontwikkelprofiel met balkjes. de vijf domeinen (gebaseerd op het ${esc(beleidsplanNaam()).toLowerCase()}): techniek : balbeheersing, traptechniek, 1v1. tactiek : inzicht, positiespel, keuzes maken. fysiek : snelheid, actiesnelheid, duelkracht. mentaal : zelfvertrouwen, spelen onder weerstand. gedrag & beleving : inzet, teamgevoel, plezier. een score loopt van 1 (aandacht) via 3 (prima) tot 5 (uitblinker) . leerpunten (tab leerlijn in het profiel): concrete, observeerbare ontwikkeldoelen die over meerdere wedstrijden doorlopen. kies een domein (techniek, tactiek, fysiek, mentaal of gedrag) en eventueel een thema uit de leerlijn. vink ze af zodra ze beheerst zijn. de app stelt leerpunten voor die passen bij de leeftijd van het team. historie : een tijdlijn met al je eerdere beoordelingen. tik een item aan om het te bekijken of bij te werken. privacy: beoordelingen en leerpunten zijn coach-only . spelers en ouders zien deze nooit. verwijder je een speler, dan gaan zijn beoordelingen mee weg.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="4.5" width="14" height="16" rx="2.2"/><path d="M9 3.2h6v3H9z"/><path d="M8.8 11.4h6.4"/><path d="M8.8 15.4h4"/></svg> Spelers beoordelen</h3>
    <p>Per speler leg je de ontwikkeling vast. Open een speler (tab <b>Spelers</b> → tik op de speler) en je vindt daar het ontwikkelprofiel met twee manieren om te beoordelen:</p>
    <ul>
      <li><b>Snel beoordelen</b>: een paar tikken na een wedstrijd of training: een algemeen niveau plus optionele "opvallend"-tags. Ideaal om er een gewoonte van te maken.</li>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="4.5" width="14" height="16" rx="2.2"/><path d="M9 3.2h6v3H9z"/><path d="M8.8 11.4h6.4"/><path d="M8.8 15.4h4"/></svg> Volledige beoordeling</b>: een periodieke, diepere meting op de vijf ontwikkeldomeinen. Hieruit komt het ontwikkelprofiel met balkjes.</li>
    </ul>
    <p>De vijf domeinen (gebaseerd op het ${esc(beleidsplanNaam())}):</p>
    <ul>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg> Techniek</b>: balbeheersing, traptechniek, 1v1.</li>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.2"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5"/></svg> Tactiek</b>: inzicht, positiespel, keuzes maken.</li>
      <li><b>Fysiek</b>: snelheid, actiesnelheid, duelkracht.</li>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z"/></svg> Mentaal</b>: zelfvertrouwen, spelen onder weerstand.</li>
      <li><b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m11 6-5 4v5l3 2.5 3-2.5"/><path d="M13 7.5 16 6l4 4v4l-2.5 2"/><path d="M12 12.5 14 14M10 14l1.5 1.4M8.5 15.5l1.3 1.2"/></svg> Gedrag &amp; beleving</b>: inzet, teamgevoel, plezier.</li>
    </ul>
    <p>Een score loopt van <b>1 (Aandacht)</b> via <b>3 (Prima)</b> tot <b>5 (Uitblinker)</b>.</p>
    <ul>
      <li><b>Leerpunten</b> (tab Leerlijn in het profiel): concrete, observeerbare ontwikkeldoelen die over meerdere wedstrijden doorlopen. Kies bij het toevoegen een <b>domein</b> (Techniek, Tactiek, Fysiek, Mentaal of Gedrag) en eventueel een thema uit de leerlijn. Vink ze af zodra ze beheerst zijn. De app stelt leerpunten voor die passen bij de leeftijd van het team.</li>
      <li><b>Historie</b>: een tijdlijn met al je eerdere beoordelingen. Tik een item aan om het te bekijken of bij te werken.</li>
    </ul>
    <div class="tip"><b>Privacy:</b> beoordelingen en leerpunten zijn <b>coach-only</b>. Spelers en ouders zien deze nooit. Verwijder je een speler, dan gaan zijn beoordelingen mee weg.</div>
    </section>

    <section class="hl-sec" data-zoek="team evalueren na de wedstrijd wedstrijddoel blokdoel zagen we het terug moment bewijs per moment wij hebben de bal zij hebben de bal omschakelen snel weer meedoen team en beleving opbouwen kansen creëren en scoren storen en veroveren doelpunten voorkomen na balverlies na balwinst inzet en weerbaarheid samenspel en communicatie afspraken uitvoeren plezier en sportiviteit spelers ja deels nee opvallend zo evalueren we uitslag oude evaluaties">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> Team evalueren na de wedstrijd</h3>
    <p>Naast de beoordeling per speler kun je na elke wedstrijd ook het <b>hele team</b> evalueren. Onderaan het wedstrijdscherm, onder het wedstrijdverslag, staat de knop <b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> Team evalueren</b>. Al ingevuld? Dan heet hij <b>✓ Teamevaluatie bijwerken</b>.</p>
    <p>Sinds 20 november evalueer je zo:</p>
    <ol>
      <li><b>Waar werkten we aan?</b> Het wedstrijddoel dat je de wedstrijd meegaf. Geen wedstrijddoel? Dan kies je het blokdoel: de paar doelen die in de trainingen van het blok terugkomen.</li>
      <li><b>Zagen we het terug?</b> Een kleur met een vaste zin (van “niet teruggezien” tot “ging vanzelf”) en één moment dat je zag.</li>
      <li><b>Wat zag je per moment?</b> Vier groepen: <i>wij hebben de bal</i>, <i>zij hebben de bal</i>, <i>omschakelen</i> en <i>team en beleving</i>. Onder elke kleur staat een zin die zegt wat je ziet. Welke onderdelen je krijgt, hangt af van de leeftijd: omschakelen is er bij elke leeftijd (tot en met O13 als “snel weer meedoen”), vanaf O14 apart na balverlies en na balwinst.</li>
      <li><b>Wat vonden de spelers?</b> Optioneel: laat ze kiezen tussen ja, deels of nee en tel mee.</li>
    </ol>
    <p>Onderaan staat één vrij veld <b>Opvallend</b> voor wat je verder opviel. De uitslag staat bewust niet op het scherm: je beoordeelt het spel, niet de stand. Achtergrond en bronnen staan onder <b>Zo evalueren we</b> bovenaan het venster.</p>
    <div class="tip"><b>Oude evaluaties</b> blijven bewaard. Ze tellen mee in radars en trends, vertaald naar de nieuwe onderdelen. Overslaan mag nog steeds: alleen één kleur is nodig, bij het doel of bij een onderdeel.</div>
    </section>

    <section class="hl-sec" data-zoek="teamevaluatie dashboard blokspiegel per moment historie onderdelen terugkerende aandachtspunten voorgesteld trainingsthema radar coördinator">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 19V10"/><path d="M11 19V5"/><path d="M18 19v-7"/></svg> Teamevaluaties terugkijken</h3>
    <p>Onder <b>Wedstrijden → Evaluatie</b> komen alle teamevaluaties samen:</p>
    <ul>
      <li><b>Blokspiegel</b>: per doel een vakje per week van het blok, in de kleur die je gaf. Zo zie je of het doel erin komt.</li>
      <li><b>Per moment</b>: de vier groepen over de laatste vijf wedstrijden, met een pijltje voor de trend. Er is bewust geen totaalcijfer: verdedigen en plezier zijn geen optelsom.</li>
      <li><b>Historie</b>: elke wedstrijd met de kleur van het doel en een strookje per onderdeel.</li>
      <li><b>Onderdelen, aandachtspunten en trainingsthema</b>: het gemiddelde per onderdeel, terugkerende zwakke plekken en een leercurve-thema voor de volgende training.</li>
    </ul>
    <div class="tip"><b>Radar:</b> op de computer en voor coördinatoren laat de radar de onderdelen bij de leeftijd zien, tegenover het gemiddelde van het blok (of anders het seizoen).</div>
    </section>

    <h4 class="hl-hoofdstuk" id="hlh-tips"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.2"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5"/></svg> Tips &amp; privacy</h4>
    <section class="hl-sec" data-zoek="praktische tips voeg de app als snelkoppeling op je startscherm toe (browsermenu → "toevoegen aan beginscherm") voor app-gevoel. werkt zonder problemen als de telefoon op slot gaat, de klok loopt door op de juiste tijd. slecht bereik langs de lijn? geen probleem: de app werkt offline door en synchroniseert je wijzigingen automatisch zodra er weer verbinding is. met een powerbank langs de lijn ben je verzekerd van een hele wedstrijd.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.2"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5"/></svg> Praktische tips</h3>
    <ul>
      <li>Voeg de app als <b>snelkoppeling op je startscherm</b> toe (browsermenu → "Toevoegen aan beginscherm") voor app-gevoel.</li>
      <li>Werkt zonder problemen als de telefoon op slot gaat, de klok loopt door op de juiste tijd.</li>
      <li><b>Slecht bereik langs de lijn?</b> Geen probleem: de app werkt offline door en synchroniseert je wijzigingen automatisch zodra er weer verbinding is.</li>
      <li>Met een powerbank langs de lijn ben je verzekerd van een hele wedstrijd.</li>
    </ul>
    </section>


    <section class="hl-sec" data-zoek="⇄ spelers uitlenen een speler laten meespelen of meetrainen bij een ander team van de club regelt de coördinator van de bouw. twee tabbladen: wedstrijden (één wedstrijd, aangevinkte wedstrijden, een aantal, tot een datum of geen einddatum) en meetrainen (eigen periode, per trainingsdag bij welk team). beide op ja is allebei. twee wedstrijden op één dag: de coördinator kiest allebei of één team. na de einddatum is de uitlening vanzelf voorbij. presentie: op dagen bij het eigen team vult de eigen trainer de presentie in, op dagen bij het andere team staat de speler grijs en telt hij niet mee. een uitgeleende speler staat meteen in de selectie van de wedstrijd. wijzigen, verlengen en beëindigen via bouw uitleningen.">
    <h3>⇄ Spelers uitlenen</h3>
    <p>Een speler laten meespelen of meetrainen bij een ander team van de club regelt de <b>coördinator van de bouw</b>, via Bouw › Uitleningen of het spelersprofiel.</p>
    <ul>
      <li>Het formulier heeft twee tabbladen, elk met een eigen <b>Ja/Nee</b> en een eigen periode. Zet je beide op Ja, dan speelt en traint de speler mee.</li>
      <li><b>Wedstrijden</b>: één wedstrijd, wedstrijden aanvinken, een aantal wedstrijden, tot en met een datum of geen einddatum.</li>
      <li><b>Meetrainen</b>: vanaf en tot een datum (los van de wedstrijden) en per trainingsdag bij welk team de speler traint.</li>
      <li>Na de laatste wedstrijd of einddatum is de uitlening vanzelf voorbij, terugzetten is niet nodig.</li>
      <li>Spelen beide teams op dezelfde dag (bijv. 9:00 en 15:00)? Dan kiest de coördinator: allebei of één van de twee.</li>
      <li><b>Presentie</b>: op dagen bij het eigen team vult de eigen trainer de presentie gewoon in. Op dagen bij het andere team staat de speler grijs met dat team erbij en telt hij niet mee in de opkomst.</li>
      <li>Een uitgeleende speler staat meteen in de selectie van de wedstrijd, ook op het startscherm.</li>
      <li>De ontvangende coach ziet alleen <b>voornaam + voorletter</b>, de voorkeurspositie en de open leerpunten.</li>
    </ul>
    </section>

    <section class="hl-sec" data-zoek="privacy & namen cluppie gaat zorgvuldig om met de gegevens van (vaak minderjarige) spelers: in de app zie je standaard alleen voornamen . de achternaam wordt wél opgeslagen, maar nergens in de app getoond. de achternaam blijft binnen je eigen team en is alleen zichtbaar voor de coaches van dat team. leen je een speler uit, dan ziet de andere coach alleen de voorletter. beoordelingen en leerpunten zijn coach-only : spelers en ouders zien deze niet. verwijder je een speler, dan worden zijn gegevens (inclusief beoordelingen en leerpunten) verwijderd. deel gegevens uit spelersprofielen niet buiten het technisch kader. heb je vragen over privacy binnen de club? stem af met je hoofdcoach of clubbeheerder.">
    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.4"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4"/><circle cx="12" cy="15.2" r="1.4" fill="currentColor" stroke="none"/></svg> Privacy &amp; namen</h3>
    <p>Cluppie gaat zorgvuldig om met de gegevens van (vaak minderjarige) spelers:</p>
    <ul>
      <li>In de app zie je standaard alleen <b>voornamen</b>. De achternaam wordt wél opgeslagen, maar nergens in de app getoond.</li>
      <li>De achternaam blijft <b>binnen je eigen team</b> en is alleen zichtbaar voor de coaches van dat team. Leen je een speler uit, dan ziet de andere coach alleen de voorletter.</li>
      <li>Beoordelingen en leerpunten zijn <b>coach-only</b>: spelers en ouders zien deze niet.</li>
      <li>Verwijder je een speler, dan worden zijn gegevens (inclusief beoordelingen en leerpunten) verwijderd.</li>
    </ul>
    <p><b>Video’s:</b> de clubbeheerder kan zien welke trainers een video hebben geopend en wanneer, bijvoorbeeld om te weten of de uitleg van een nieuw blok is aangekomen. Er wordt niet bijgehouden of je de video uitkijkt.</p>
    <div class="tip">Deel gegevens uit spelersprofielen niet buiten het technisch kader. Heb je vragen over privacy binnen de club? Stem af met je hoofdcoach of clubbeheerder.</div>

    
    </section>

    <section class="hl-sec" data-zoek="↩︎ navigeren & de terugknop de terugknop van je telefoon gaat binnen de app steeds één stap terug: van een sub-tabblad (planning, stand, documenten, stats, help) terug naar meer, en van de hoofdtabbladen terug naar de teamkeuze. een open venster of de wedstrijd sluit je er ook mee. je springt dus niet meer in één keer helemaal terug naar het teamkeuzescherm.">
    <h3>↩︎ Navigeren &amp; de terugknop</h3>
    <p>De <b>terugknop van je telefoon</b> gaat binnen de app steeds <b>één stap terug</b>:</p>
    <ul>
      <li>Vanuit een onderdeel onder <b>Meer</b> (Kalender, Stand &amp; Poule, Documenten, Stats, Help) terug naar het <b>Meer</b>-menu.</li>
      <li>Een geopend venster of de wedstrijd sluit je er ook mee.</li>
      <li>Pas vanaf een hoofdtabblad ga je terug naar de <b>teamkeuze</b>, je springt dus niet meer in één keer helemaal terug.</li>
    </ul>
    </section>

    <p class="u-t-sm u-zacht u-tc" style="margin-top:20px;padding-top:var(--space-md);border-top:1px solid var(--hair)">
      Vragen of ideeën? Geef ze door aan je hoofdcoach.<br>Veel succes langs de lijn! <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.4"/><path d="M12 4.6v14.8"/><circle cx="12" cy="12" r="2.8"/></svg>
    </p>
  </div>`;
}
