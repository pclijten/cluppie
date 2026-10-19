/* Eén plek voor de hulptekst bij (PDF-)uploads: lukt het blijvend niet, dan mailen naar Paul. */
export const UPLOAD_CONTACT = 'paul@cluppie.io';
export const UPLOAD_HULP = `Lukt uploaden steeds niet? Neem dan contact op met Paul: ${UPLOAD_CONTACT}`;

/* Kleine melding onder een uploadknop/-venster. */
export function uploadHulpHtml(stijl = ''){
  return `<p class="upload-hulp" style="${stijl}">Lukt uploaden steeds niet? Neem dan contact op met Paul: <a href="mailto:${UPLOAD_CONTACT}">${UPLOAD_CONTACT}</a></p>`;
}

/* Tekst voor een foutmelding (toast). */
export function uploadFout(basis = 'Upload mislukt'){
  return `${basis}. ${UPLOAD_HULP}`;
}
