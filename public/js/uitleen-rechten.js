/* ==================== UITLEEN-RECHTEN ====================
   [20261111] Wie mag een speler uitlenen? Alleen de clubadmin en de
   coördinatoren van de bouw (ook een eigen bouw) waar het team in zit.
   Zichtbaarheidscheck voor knoppen; los bestand zodat teams-spelers.js,
   desktop-schermen.js en uitleen-form.js hem delen zonder importkringloop. */
import { S, isBeheerder, isPlatformBeheerder } from './state.js?v=20261111d';
import { isBouwCoordinator } from './coordinatoren.js?v=20261111d';

export function magUitlenen(team){
  if (!team) return false;
  /* cluppie.io: beheerder van DEZE club (of platformbeheerder); bouwcoördinator alleen binnen de eigen club */
  if (isPlatformBeheerder()) return true;
  if (isBeheerder() && (!team.club || (S.clubs || []).some(c => c.id === team.club))) return true;
  if (team.bouw && (!team.club || S.club?.id === team.club) && isBouwCoordinator(team.bouw)) return true;
  const mijn = new Set((S.coordinatorBouwen || []).filter(x => !team.club || x.clubId === team.club).map(x => x.bouw));
  if (team.bouw && mijn.has(team.bouw)) return true;
  const club = (S.clubs || []).find(c => c.id === team.club) || (S.club?.id === team.club ? S.club : null);
  return (Array.isArray(club?.eigenBouwen) ? club.eigenBouwen : [])
    .some(eb => mijn.has(eb.id) && (eb.teams || []).includes(team.id));
}
