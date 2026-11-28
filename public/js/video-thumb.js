/* [20261127] Voorbeeldplaatjes en nette titels voor video's (Team › Video's en Club › Video's).

   - YouTube: het plaatje van YouTube zelf.
   - Eigen upload met opgeslagen poster (veld `thumb`, gemaakt bij het uploaden): dat plaatje.
   - Eigen upload zonder poster (alle video's van vóór deze versie): de browser haalt alleen het
     begin van het bestand op en toont een beeld van ±2 seconden in. Dat gebeurt pas als de kaart
     in beeld komt (IntersectionObserver), zodat een lange lijst niet alles tegelijk laadt.
   - De duur komt uit het veld `duur` (seconden) of uit de metadata die de browser toch al leest.

   Er wordt niets in de database aangepast voor bestaande video's. */
import { youtubeId, youtubeThumb } from './config.js?v=20261130o';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* "01-aan-de-slag" → "Aan de slag", "13-clubbeheer-evaluaties-inzicht-instellingen" →
   "Clubbeheer evaluaties inzicht instellingen". Alleen als de titel er uitziet als een kale
   bestandsnaam (geen spaties, wel - of _). Een titel die iemand zelf heeft getypt blijft staan. */
export function netteVideoTitel(titel){
  const t = String(titel || '').trim();
  if (!t || /\s/.test(t) || !/[-_]/.test(t)) return t || 'Video';
  const kaal = t.replace(/\.(mp4|mov|webm|m4v)$/i, '')
    .replace(/^\d{1,3}[-_.]+(?=\D)/, '')
    .replace(/[-_]+/g, ' ').trim();
  if (!kaal) return t;
  return kaal.charAt(0).toUpperCase() + kaal.slice(1);
}

export function duurTekst(sec){
  const s = Math.round(Number(sec));
  if (!Number.isFinite(s) || s <= 0) return '';
  const u = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (u ? u + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(r).padStart(2, '0');
}

const PLAY = '<span class="vt-play" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg></span>';

/* De binnenkant van een .thumb-vak. */
export function videoThumbHtml(vid){
  const upload = vid.bron === 'upload';
  const yid = upload ? null : youtubeId(vid.url);
  const duur = duurTekst(vid.duur);
  const duurEl = `<span class="vt-duur"${duur ? '' : ' hidden'}>${esc(duur)}</span>`;
  let beeld = '';
  if (yid) beeld = `<img src="${esc(youtubeThumb(yid))}" alt="" loading="lazy" draggable="false">`;
  else if (vid.thumb) beeld = `<img src="${esc(vid.thumb)}" alt="" loading="lazy" draggable="false">`;
  else if (upload && vid.url) beeld = `<video class="vt-live" data-vt-src="${esc(vid.url)}" muted playsinline preload="none" disablepictureinpicture tabindex="-1" aria-hidden="true"></video>`;
  return `<span class="vt-vlak${beeld ? '' : ' leeg'}">${beeld}</span>${PLAY}${duurEl}`;
}

/* Live voorbeeldbeelden en ontbrekende duur invullen voor alles binnen `root`. */
let waarnemer = null;
function laad(v){
  if (v.dataset.vtKlaar) return;
  v.dataset.vtKlaar = '1';
  const duurEl = v.closest('.thumb')?.querySelector('.vt-duur');
  v.addEventListener('loadedmetadata', () => {
    if (duurEl && duurEl.hidden){ const t = duurTekst(v.duration); if (t){ duurEl.textContent = t; duurEl.hidden = false; } }
  }, { once: true });
  v.addEventListener('loadeddata', () => v.classList.add('klaar'), { once: true });
  v.addEventListener('error', () => v.remove(), { once: true });
  v.preload = 'metadata';
  /* #t= laat de browser het beeld op dat moment tonen in plaats van een (vaak zwart) eerste beeld */
  v.src = v.dataset.vtSrc + '#t=2';
}
export function activeerVideoThumbs(root){
  const lijst = [...(root || document).querySelectorAll('video.vt-live:not([data-vt-klaar])')];
  if (!lijst.length) return;
  if (!('IntersectionObserver' in window)){ lijst.forEach(laad); return; }
  if (!waarnemer) waarnemer = new IntersectionObserver((items) => {
    for (const it of items) if (it.isIntersecting){ waarnemer.unobserve(it.target); laad(it.target); }
  }, { rootMargin: '200px 0px' });
  lijst.forEach(v => waarnemer.observe(v));
}

/* Bij het uploaden: poster (JPEG) en duur uit het lokale bestand halen. Geeft null als het
   niet lukt (bv. een formaat dat de browser niet kan afspelen); het uploaden gaat dan gewoon door. */
export function maakPoster(file, breedte = 640){
  return new Promise((klaar) => {
    let url = '';
    let gedaan = false;
    const stop = (res) => { if (gedaan) return; gedaan = true; clearTimeout(timer); try { URL.revokeObjectURL(url); } catch {} klaar(res); };
    const timer = setTimeout(() => stop(null), 15000);
    try {
      url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onerror = () => stop(null);
      v.onloadedmetadata = () => {
        const d = Number.isFinite(v.duration) ? v.duration : 0;
        v.currentTime = Math.min(1, d ? d / 10 : 0.1);
      };
      v.onseeked = () => {
        try {
          const w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) return stop(null);
          const sc = Math.min(1, breedte / w);
          const c = document.createElement('canvas');
          c.width = Math.round(w * sc); c.height = Math.round(h * sc);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          const duur = Number.isFinite(v.duration) ? Math.round(v.duration) : null;
          c.toBlob(b => stop(b ? { blob: b, duur } : (duur ? { blob: null, duur } : null)), 'image/jpeg', 0.78);
        } catch { stop(null); }
      };
      v.src = url;
    } catch { stop(null); }
  });
}
