/* ==================== BEVESTIGINGSMAIL (20261020e) ====================
   Eigen Nederlandse mail via de callable verificatieMail (functions/verificatie-mail.js).
   Zolang die functie nog niet gedeployed is, valt hij terug op de standaardmail van Firebase.
   Geeft true als er een mail is verstuurd (of het adres al bevestigd was); gooit een Error met een leesbare melding bij te vaak vragen. */

import { auth, functions, httpsCallable, sendEmailVerification } from './firebase.js?v=20261011g';

export async function stuurVerificatieMail(){
  const gebruiker = auth.currentUser;
  if (!gebruiker) throw new Error('Log eerst in.');
  try {
    await httpsCallable(functions, 'verificatieMail')();
    return true;
  } catch (e){
    if (e.code === 'functions/resource-exhausted') throw new Error(e.message || 'Je hebt al een paar keer een mail gevraagd. Probeer het later opnieuw.');
    if (e.code === 'functions/not-found' || e.code === 'functions/unavailable' || e.code === 'functions/internal'){
      await sendEmailVerification(gebruiker);   // terugval: standaardmail van Firebase
      return true;
    }
    throw e;
  }
}
