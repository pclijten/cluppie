/* ==================== OVER-PAGINA: 3D-VELD IN DE HERO ====================
   De oefenvorm "Pass en ga: doorlopen na de pass" uit de Cluppie-bibliotheek, als
   3D-veld. Dezelfde coördinaten als de tekening in de app (x en y in procenten van
   het vak, 20 × 30 meter). Speler 1 passt naar 2, loopt door (pass en ga), en 2 schiet.
   Als je wegscrolt kantelt de camera terug naar bovenaanzicht: dan is het weer de
   tekening uit de app. De SVG-tekening blijft eronder staan voor schermlezers en als
   terugval zonder WebGL. */
import * as THREE from '../vendor/over/three.module.min.js';

const VORM = {
  veld: { b: 20, l: 30 },
  doeltjes: [{ x: 30, breed: 22 }, { x: 70, breed: 22 }],
  spelers: [
    { nr: 1, x: 30, y: 86 }, { nr: 2, x: 50, y: 75 }, { nr: 3, x: 70, y: 86 },
    { nr: 4, x: 35, y: 45, tegen: true }, { nr: 5, x: 50, y: 35, tegen: true }, { nr: 6, x: 65, y: 45, tegen: true },
  ],
  pass: [[30, 86], [50, 75]], loop: [[30, 86], [28, 50]], schot: [[50, 75], [40, 6]],
};

/* kleuren van de pagina (zelfde waarden als de tokens in over/tokens.css) */
const KLEUR = { gras: 0x2b7a45, gras2: 0x2f8249, rand: 0x1d5a33, krijt: 0xf2f8f2, rood: 0xd4302b, blauw: 0x4a8fe0, pion: 0xf08a24, geel: 0xffd23f, huid: 0xf1c7a3, nacht: 0x0e1116 };

export function maakVeld(box, gsap, ScrollTrigger) {
  const B = VORM.veld.b, L = VORM.veld.l;
  const pos = (x, y) => new THREE.Vector3((x / 100 - 0.5) * B, 0, (y / 100 - 0.5) * L);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'veld3d';
  canvas.setAttribute('aria-hidden', 'true');
  box.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);

  /* licht: zachte lucht + een avondzon die lange schaduwen geeft */
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x23402c, 1.25));
  const zon = new THREE.DirectionalLight(0xfff1dc, 2.4);
  zon.position.set(-12, 22, 10);
  zon.castShadow = true;
  zon.shadow.mapSize.set(1024, 1024);
  Object.assign(zon.shadow.camera, { left: -20, right: 20, top: 22, bottom: -22, near: 1, far: 70 });
  zon.shadow.radius = 4;
  scene.add(zon);

  /* gras met maaibanen */
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2f8249' : '#2a7843'; g.fillRect(0, i * 64, 64, 64); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const grond = new THREE.Mesh(new THREE.PlaneGeometry(B + 8, L + 8), new THREE.MeshStandardMaterial({ color: KLEUR.rand, roughness: 1 }));
  grond.rotation.x = -Math.PI / 2; grond.position.y = -0.02; grond.receiveShadow = true; scene.add(grond);
  const veld = new THREE.Mesh(new THREE.PlaneGeometry(B, L), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  veld.rotation.x = -Math.PI / 2; veld.receiveShadow = true; scene.add(veld);

  /* krijtlijnen langs de rand */
  const krijt = new THREE.MeshBasicMaterial({ color: KLEUR.krijt });
  const lijn = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), krijt); m.position.set(x, 0.01, z); scene.add(m); };
  lijn(B, 0.12, 0, -L / 2); lijn(B, 0.12, 0, L / 2); lijn(0.12, L, -B / 2, 0); lijn(0.12, L, B / 2, 0);

  /* doeltjes met net */
  const wit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
  const doelen = VORM.doeltjes.map(d => {
    const g = new THREE.Group(); const w = d.breed / 100 * B, h = 1.2, diep = 1.1;
    const paal = new THREE.CylinderGeometry(0.06, 0.06, h, 10);
    [-w / 2, w / 2].forEach(x => { const p = new THREE.Mesh(paal, wit); p.position.set(x, h / 2, 0); p.castShadow = true; g.add(p); });
    const lat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, w, 10), wit); lat.rotation.z = Math.PI / 2; lat.position.y = h; lat.castShadow = true; g.add(lat);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const x = -w / 2 + i * w / 10; pts.push(x, h, 0, x, 0, -diep); }
    for (let j = 0; j <= 4; j++) { const t = j / 4; pts.push(-w / 2, h * (1 - t), -diep * t, w / 2, h * (1 - t), -diep * t); }
    const net = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), netMat);
    g.add(net); g.userData.net = net;
    g.position.copy(pos(d.x, 0)); scene.add(g); return g;
  });

  /* pionnen op de hoeken van het vak */
  const pionGeo = new THREE.ConeGeometry(0.26, 0.6, 18), pionMat = new THREE.MeshStandardMaterial({ color: KLEUR.pion, roughness: 0.6 });
  const pionnen = [[0, 100], [100, 100], [0, 0], [100, 0]].map(([x, y]) => {
    const p = new THREE.Mesh(pionGeo, pionMat); p.position.copy(pos(x, y)); p.position.y = 0.3; p.castShadow = true; scene.add(p); return p;
  });

  /* spelers: een poppetje in clubkleur met het rugnummer op een schijf erboven */
  const nummer = (nr, bg, fg) => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = fg; g.font = '800 70px "Barlow Condensed", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(nr), 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const lijfGeo = new THREE.CapsuleGeometry(0.34, 0.75, 6, 16), hoofdGeo = new THREE.SphereGeometry(0.24, 20, 16);
  const huid = new THREE.MeshStandardMaterial({ color: KLEUR.huid, roughness: 0.7 });
  const spelers = VORM.spelers.map(s => {
    const g = new THREE.Group();
    const kleur = s.tegen ? KLEUR.blauw : KLEUR.rood;
    const lijf = new THREE.Mesh(lijfGeo, new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.55 })); lijf.position.y = 0.72; lijf.castShadow = true; g.add(lijf);
    const hoofd = new THREE.Mesh(hoofdGeo, huid); hoofd.position.y = 1.5; hoofd.castShadow = true; g.add(hoofd);
    const bord = new THREE.Sprite(new THREE.SpriteMaterial({ map: nummer(s.nr, s.tegen ? '#4a8fe0' : '#d4302b', '#ffffff'), depthTest: false }));
    bord.scale.set(0.9, 0.9, 1); bord.position.y = 2.35; g.add(bord);
    g.position.copy(pos(s.x, s.y));
    g.lookAt(pos(50, s.tegen ? 100 : 0).setY(0));
    scene.add(g); return g;
  });

  /* bal: wit met rode vlakken, zoals de bal op de foto verderop */
  const balTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#d4302b';
    for (let i = 0; i < 8; i++) { g.beginPath(); const x = (i * 64) % 256 + (i > 3 ? 32 : 0), y = i > 3 ? 92 : 36; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); } g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), new THREE.MeshStandardMaterial({ map: balTex, roughness: 0.45 }));
  bal.castShadow = true; scene.add(bal);

  /* krijtlijnen die zich tekenen: een plat lint dat vanaf het begin uitgroeit */
  const lint = (van, naar, kleur, breed, streep) => {
    const a = pos(...van), b = pos(...naar), len = a.distanceTo(b);
    const g = new THREE.Group(); g.position.copy(a).setY(0.025); g.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    const mat = new THREE.MeshBasicMaterial({ color: kleur, transparent: true, opacity: 0.95 });
    const binnen = new THREE.Group(); g.add(binnen);
    if (streep) {
      for (let d = 0; d < len - 0.6; d += 0.9) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, breed), mat); m.rotation.x = -Math.PI / 2; m.position.x = d + 0.25; binnen.add(m); }
    } else {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.6, breed), mat); m.rotation.x = -Math.PI / 2; m.position.x = (len - 0.6) / 2; binnen.add(m);
    }
    const punt = new THREE.Mesh(new THREE.CircleGeometry(0.32, 3), mat); punt.rotation.x = -Math.PI / 2; punt.rotation.z = 0; punt.position.x = len - 0.45; binnen.add(punt);
    binnen.scale.x = 0.0001; scene.add(g); return binnen;
  };
  const lPass = lint(VORM.pass[0], VORM.pass[1], KLEUR.krijt, 0.12, false);
  const lLoop = lint(VORM.loop[0], VORM.loop[1], KLEUR.krijt, 0.1, true);
  const lSchot = lint(VORM.schot[0], VORM.schot[1], KLEUR.geel, 0.18, false);

  /* camera: van bovenaanzicht (de tekening) naar een lage hoek langs de lijn */
  const boven = { pos: new THREE.Vector3(0, 46, 0.01), kijk: new THREE.Vector3(0, 0, 0) };
  const schuin = { pos: new THREE.Vector3(9, 23, 31), kijk: new THREE.Vector3(0, 0, -1.2) };
  const stand = { intro: 0, scroll: 0 };
  const kijk = new THREE.Vector3();
  const zetCamera = () => {
    const t = stand.intro * (1 - stand.scroll);
    camera.position.lerpVectors(boven.pos, schuin.pos, t);
    kijk.lerpVectors(boven.kijk, schuin.kijk, t);
    camera.lookAt(kijk);
  };

  const formaat = () => {
    const r = box.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    /* bovenaanzicht: het hele vak moet passen */
    boven.pos.y = Math.max(40, (L + 6) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
  };
  formaat();
  new ResizeObserver(formaat).observe(box);

  /* begin- en eindstand van alles wat beweegt */
  const start = pos(...VORM.pass[0]);
  const zetBegin = () => {
    stand.intro = 0;
    spelers.forEach((s, i) => { s.position.copy(pos(VORM.spelers[i].x, VORM.spelers[i].y)); s.position.y = 6; s.scale.setScalar(0.001); });
    pionnen.forEach(p => p.scale.setScalar(0.001));
    bal.position.copy(start).add(new THREE.Vector3(0.5, 0.22, -0.3)); bal.scale.setScalar(0.001); bal.rotation.set(0, 0, 0);
    [lPass, lLoop, lSchot].forEach(l => (l.scale.x = 0.0001));
    doelen.forEach(d => d.userData.net.scale.set(1, 1, 1));
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const p1 = pos(...VORM.pass[1]).add(new THREE.Vector3(0.45, 0.22, 0.3));
  const doel = pos(...VORM.schot[1]).add(new THREE.Vector3(0, 0.5, -0.6));
  tl.call(zetBegin)
    .to(stand, { intro: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: zetCamera }, 0)
    .to(pionnen.map(p => p.scale), { x: 1, y: 1, z: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(2)' }, 0.2)
    .to(spelers.map(s => s.scale), { x: 1, y: 1, z: 1, duration: 0.45, stagger: 0.09 }, 0.5)
    .to(spelers.map(s => s.position), { y: 0, duration: 0.7, stagger: 0.09, ease: 'bounce.out' }, 0.5)
    .to(bal.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' }, 1.3)
    /* pass: de bal rolt naar speler 2, de lijn tekent mee */
    .to(lPass.scale, { x: 1, duration: 0.7, ease: 'power2.inOut' }, 2.2)
    .to(bal.position, { x: p1.x, z: p1.z, duration: 0.7, ease: 'power2.out' }, 2.25)
    .to(bal.rotation, { x: '-=9', duration: 0.7, ease: 'power2.out' }, 2.25)
    /* en ga: speler 1 loopt door */
    .to(lLoop.scale, { x: 1, duration: 0.9, ease: 'power1.inOut' }, 2.7)
    .to(spelers[0].position, { x: pos(...VORM.loop[1]).x, z: pos(...VORM.loop[1]).z, duration: 1.1, ease: 'power1.inOut' }, 2.75)
    /* schot op het doeltje */
    .to(lSchot.scale, { x: 1, duration: 0.45, ease: 'power3.in' }, 3.6)
    .to(bal.position, { x: doel.x, y: 0.5, z: doel.z, duration: 0.5, ease: 'power3.in' }, 3.65)
    .to(bal.rotation, { x: '-=14', duration: 0.5, ease: 'power3.in' }, 3.65)
    .to(doelen[0].userData.net.scale, { z: 1.35, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 4.15)
    .to(bal.position, { y: 0.22, duration: 0.4, ease: 'bounce.out' }, 4.2);

  /* bij wegscrollen kantelt de camera terug naar de tekening */
  ScrollTrigger.create({
    trigger: box.closest('.hero'), start: 'top top', end: 'bottom top', scrub: 0.6,
    onUpdate: s => { stand.scroll = s.progress; zetCamera(); },
  });

  /* alleen tekenen als het veld in beeld is */
  let zichtbaar = true;
  new IntersectionObserver(([e]) => { zichtbaar = e.isIntersecting; }).observe(box);
  gsap.ticker.add(() => { if (zichtbaar) renderer.render(scene, camera); });

  zetBegin(); zetCamera();
  return { speel: () => tl.restart() };
}
