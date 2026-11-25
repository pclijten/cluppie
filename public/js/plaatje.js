/* ==================== PLAATJE [20261125w] ====================
   Een logo of foto in de browser klein maken (wit vlak eronder, jpg) tot het als data-URL in een
   Firestore-document past. Gebruikt voor sponsoren en eigen schermen (toernooi en kantine-tv). */
import { MAX_PLAATJE } from './toernooi-logica.js?v=20261125w';

export async function kleinPlaatje(bestand){
  const url = URL.createObjectURL(bestand);
  try {
    const img = await new Promise((ok, mis) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mis; i.src = url; });
    for (const [maat, kw] of [[640, .82], [520, .78], [420, .72], [320, .68], [240, .6]]){
      const f = Math.min(1, maat / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const uit = c.toDataURL('image/jpeg', kw); if (uit.length <= MAX_PLAATJE) return uit;
    }
    return '';
  } finally { URL.revokeObjectURL(url); }
}
