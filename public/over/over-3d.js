/* ==================== OVER-PAGINA: OEFENVORMEN IN 3D ====================
   Maakt van elke oefenvorm uit de Cluppie-bibliotheek een 3D-veld, met dezelfde gegevens
   als de tekening in de app (x en y in procenten van het vak, veld.b × veld.l in meters).
   De lijnen worden één voor één gespeeld: bij een pass of schot gaat de bal mee, bij een
   loopactie of dribbel loopt de speler mee. De SVG-tekening blijft eronder staan voor
   schermlezers en als terugval zonder WebGL.

   Klassiek script (geen module), zodat het ook werkt als je over.html als bestand opent.
   Nodig: window.THREE (vendor/over/three.min.js) en window.gsap.
   Gebruik: Veld3D.maak(box, vorm, { kantelBijScroll }) → { speel(), stop() } */
(function(){
  const THREE = window.THREE;
  if (!THREE) return;
  const KLEUR = { rand: 0x1d5a33, krijt: 0xf2f8f2, eigen: 0xd4302b, tegen: 0x4a8fe0, joker: 0xf2b23c, pion: 0xf08a24, geel: 0xffd23f, huid: 0xf1c7a3 };
  const HEX = { eigen: '#d4302b', tegen: '#4a8fe0', joker: '#f2b23c' };

  /* gedeelde texturen en geometrie: één keer maken, voor alle velden */
  const canvasTex = (w, h, teken) => { const c = document.createElement('canvas'); c.width = w; c.height = h; teken(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const grasTex = canvasTex(64, 512, g => { for (let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#2f8249' : '#2a7843'; g.fillRect(0, i * 64, 64, 64); } });
  const balTex = canvasTex(512, 256, g => {
    g.fillStyle = '#f7f7f3'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#1b1f24';
    const vijfhoek = (x, y, r) => { g.beginPath(); for (let k = 0; k < 5; k++){ const a = -Math.PI / 2 + k * Math.PI * 2 / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.0); } g.closePath(); g.fill(); };
    [[64, 64], [192, 64], [320, 64], [448, 64], [0, 192], [128, 192], [256, 192], [384, 192], [512, 192]].forEach(([x, y]) => vijfhoek(x, y, 30));
    vijfhoek(256, 6, 60); vijfhoek(256, 250, 60);
  });
  const nrTex = {};
  const nummer = (nr, kant) => {
    const k = `${kant}-${nr}`;
    return nrTex[k] || (nrTex[k] = canvasTex(128, 128, g => {
      g.fillStyle = HEX[kant] || HEX.eigen; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = kant === 'joker' ? '#1b1f24' : '#ffffff'; g.font = '800 72px "Barlow Condensed", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(nr), 64, 70);
    }));
  };
  const GEO = {
    lijf: new THREE.CapsuleGeometry(0.34, 0.75, 6, 16), hoofd: new THREE.SphereGeometry(0.24, 20, 16),
    pion: new THREE.ConeGeometry(0.26, 0.6, 18), bal: new THREE.SphereGeometry(0.22, 32, 24), paal: new THREE.CylinderGeometry(0.06, 0.06, 1, 10),
  };
  const MAT = {
    huid: new THREE.MeshStandardMaterial({ color: KLEUR.huid, roughness: 0.7 }),
    eigen: new THREE.MeshStandardMaterial({ color: KLEUR.eigen, roughness: 0.55 }),
    tegen: new THREE.MeshStandardMaterial({ color: KLEUR.tegen, roughness: 0.55 }),
    joker: new THREE.MeshStandardMaterial({ color: KLEUR.joker, roughness: 0.55 }),
    pion: new THREE.MeshStandardMaterial({ color: KLEUR.pion, roughness: 0.6 }),
    wit: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
    bal: new THREE.MeshStandardMaterial({ map: balTex, roughness: 0.45 }),
    krijt: new THREE.MeshBasicMaterial({ color: KLEUR.krijt }),
  };

  function maak(box, vorm, opts = {}){
    const gsap = window.gsap;
    const t = vorm.tekening || {}, B = vorm.veld?.b || 20, L = vorm.veld?.l || 25;
    const pos = (x, y) => new THREE.Vector3((x / 100 - 0.5) * B, 0, (y / 100 - 0.5) * L);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement; canvas.className = 'veld3d'; canvas.setAttribute('aria-hidden', 'true');
    box.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 300);
    const S = Math.max(B, L);
    scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x23402c, 1.25));
    const zon = new THREE.DirectionalLight(0xfff1dc, 2.4);
    zon.position.set(-S * 0.6, S, S * 0.5); zon.castShadow = true; zon.shadow.mapSize.set(1024, 1024);
    Object.assign(zon.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: S * 4 });
    scene.add(zon);

    /* gras, rand, krijtlijnen */
    const grond = new THREE.Mesh(new THREE.PlaneGeometry(B + 8, L + 8), new THREE.MeshStandardMaterial({ color: KLEUR.rand, roughness: 1 }));
    grond.rotation.x = -Math.PI / 2; grond.position.y = -0.02; grond.receiveShadow = true; scene.add(grond);
    const veld = new THREE.Mesh(new THREE.PlaneGeometry(B, L), new THREE.MeshStandardMaterial({ map: grasTex, roughness: 0.95 }));
    veld.rotation.x = -Math.PI / 2; veld.receiveShadow = true; scene.add(veld);
    const lijn = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), MAT.krijt); m.position.set(x, 0.01, z); scene.add(m); };
    lijn(B, 0.12, 0, -L / 2); lijn(B, 0.12, 0, L / 2); lijn(0.12, L, -B / 2, 0); lijn(0.12, L, B / 2, 0);
    const kanten = new Set((t.doeltjes || []).map(d => d.kant));
    if (kanten.has('boven') && kanten.has('onder')){
      lijn(B, 0.1, 0, 0);
      const cirkel = new THREE.Mesh(new THREE.RingGeometry(Math.min(B, L) * 0.11 - 0.06, Math.min(B, L) * 0.11 + 0.06, 48), MAT.krijt);
      cirkel.rotation.x = -Math.PI / 2; cirkel.position.y = 0.012; scene.add(cirkel);
    }
    /* zones: doorschijnend vlak met gestippelde rand */
    for (const z of t.zones || []){
      const w = z.b / 100 * B, d = z.h / 100 * L, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }));
      m.rotation.x = -Math.PI / 2; m.position.copy(pos(z.x + z.b / 2, z.y + z.h / 2)).setY(0.015); scene.add(m);
    }

    /* doeltjes met net */
    const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
    const doelen = (t.doeltjes || []).map(d => {
      const g = new THREE.Group(), w = d.breed / 100 * B, h = Math.min(2, Math.max(1, w * 0.28)), diep = h * 0.9;
      [-w / 2, w / 2].forEach(x => { const p = new THREE.Mesh(GEO.paal, MAT.wit); p.scale.y = h; p.position.set(x, h / 2, 0); p.castShadow = true; g.add(p); });
      const lat = new THREE.Mesh(GEO.paal, MAT.wit); lat.scale.y = w; lat.rotation.z = Math.PI / 2; lat.position.y = h; lat.castShadow = true; g.add(lat);
      const pts = [];
      for (let i = 0; i <= 10; i++){ const x = -w / 2 + i * w / 10; pts.push(x, h, 0, x, 0, -diep); }
      for (let j = 0; j <= 4; j++){ const f = j / 4; pts.push(-w / 2, h * (1 - f), -diep * f, w / 2, h * (1 - f), -diep * f); }
      const net = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), netMat);
      g.add(net); g.userData.net = net;
      const onder = d.kant === 'onder';
      g.position.copy(pos(d.x, onder ? 100 : 0)); if (onder) g.rotation.y = Math.PI;
      scene.add(g); return g;
    });

    /* pionnen */
    const pionnen = (t.pionnen || []).map(p => {
      const m = new THREE.Mesh(GEO.pion, p[2] ? new THREE.MeshStandardMaterial({ color: p[2], roughness: 0.6 }) : MAT.pion);
      m.position.copy(pos(p[0], p[1])).setY(0.3); m.castShadow = true; scene.add(m); return m;
    });

    /* spelers */
    const soortVan = k => (k === 'tegen' ? 'tegen' : k === 'keeper' || k === 'joker' ? 'joker' : 'eigen');
    const spelers = (t.spelers || []).map(s => {
      const g = new THREE.Group(), soort = soortVan(s.kant);
      const lijf = new THREE.Mesh(GEO.lijf, MAT[soort]); lijf.position.y = 0.72; lijf.castShadow = true; g.add(lijf);
      const hoofd = new THREE.Mesh(GEO.hoofd, MAT.huid); hoofd.position.y = 1.5; hoofd.castShadow = true; g.add(hoofd);
      const bord = new THREE.Sprite(new THREE.SpriteMaterial({ map: nummer(s.kant === 'keeper' ? 'K' : s.nr, soort), depthTest: false }));
      bord.scale.set(1, 1, 1); bord.position.y = 2.4; g.add(bord);
      const thuis = pos(s.x, s.y);
      g.userData = { thuis, xy: [s.x, s.y] };
      g.position.copy(thuis);
      g.lookAt(pos(50, soort === 'tegen' ? 100 : 0));
      scene.add(g); return g;
    });

    /* ballen: de spelbal, en bij "iedereen een bal" een bal bij elke eigen speler */
    const ballen = [];
    const maakBal = (x, z) => { const m = new THREE.Mesh(GEO.bal, MAT.bal); m.castShadow = true; m.userData.thuis = new THREE.Vector3(x, 0.22, z); scene.add(m); ballen.push(m); return m; };
    let spelbal = null;
    if (t.bal){ const p = pos(t.bal[0], t.bal[1]); const op = spelers.find(s => s.userData.thuis.distanceTo(p) < 1.2); spelbal = maakBal(p.x + (op ? 0.55 : 0), p.z + (op ? -0.35 : 0)); }
    if (t.iedereenBal) spelers.forEach((s, i) => { if (soortVan((t.spelers[i] || {}).kant) === 'eigen') maakBal(s.userData.thuis.x + 0.5, s.userData.thuis.z - 0.3); });

    /* lijnen: een plat lint per stuk, dat vanaf het begin uitgroeit */
    const lijnen = (t.lijnen || []).map(l => {
      const punten = l.punten.map(p => pos(p[0], p[1]));
      const kleur = l.soort === 'schot' ? KLEUR.geel : KLEUR.krijt, breed = l.soort === 'schot' ? 0.2 : 0.12, streep = l.soort === 'loopweg';
      const mat = new THREE.MeshBasicMaterial({ color: kleur, transparent: true, opacity: 0.95 });
      const stukken = [];
      for (let i = 1; i < punten.length; i++){
        const a = punten[i - 1], b = punten[i], len = a.distanceTo(b), laatste = i === punten.length - 1;
        const g = new THREE.Group(); g.position.copy(a).setY(0.025); g.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
        const binnen = new THREE.Group(); g.add(binnen);
        const eind = laatste ? Math.max(0.3, len - 0.7) : len;
        if (streep){ for (let d = 0; d < eind - 0.3; d += 0.9){ const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, breed), mat); m.rotation.x = -Math.PI / 2; m.position.x = d + 0.25; binnen.add(m); } }
        else if (l.soort === 'dribbel'){ for (let d = 0; d < eind; d += 0.25){ const m = new THREE.Mesh(new THREE.PlaneGeometry(0.27, breed), mat); m.rotation.x = -Math.PI / 2; m.position.set(d + 0.12, 0, Math.sin(d * 2.4) * 0.22); binnen.add(m); } }
        else { const m = new THREE.Mesh(new THREE.PlaneGeometry(eind, breed), mat); m.rotation.x = -Math.PI / 2; m.position.x = eind / 2; binnen.add(m); }
        if (laatste){ const punt = new THREE.Mesh(new THREE.CircleGeometry(0.34, 3), mat); punt.rotation.x = -Math.PI / 2; punt.position.x = eind + 0.1; binnen.add(punt); }
        scene.add(g); stukken.push(binnen);
      }
      return { soort: l.soort, punten, stukken };
    });

    /* camera: van bovenaanzicht (de tekening) naar een schuine blik langs het veld */
    const boven = { pos: new THREE.Vector3(0, 40, 0.01), kijk: new THREE.Vector3() };
    const schuin = { pos: new THREE.Vector3(S * 0.32, S * 0.78, S * 1.02), kijk: new THREE.Vector3(0, 0, -S * 0.05) };
    const stand = { intro: 0, kantel: 0 }, kijk = new THREE.Vector3();
    const zetCamera = () => {
      const f = stand.intro * (1 - stand.kantel);
      camera.position.lerpVectors(boven.pos, schuin.pos, f); kijk.lerpVectors(boven.kijk, schuin.kijk, f); camera.lookAt(kijk);
    };
    const formaat = () => {
      const r = box.getBoundingClientRect(); if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height;
      const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      boven.pos.y = Math.max((L + 5) / 2 / halfV, (B + 5) / 2 / (halfV * camera.aspect));
      camera.updateProjectionMatrix();
      /* schuin: zoek de afstand waarop het hele vak (met de spelers erop) net in beeld past */
      const richting = new THREE.Vector3(0.14, 0.78, 1).normalize(), v = new THREE.Vector3();
      const hoeken = [];
      for (const x of [-B / 2 - 0.3, B / 2 + 0.3]) for (const z of [-L / 2 - 1.2, L / 2 + 0.3]) for (const y of [0, 2.2]) hoeken.push(new THREE.Vector3(x, y, z));
      let d = S * 0.5;
      for (let i = 0; i < 120; i++, d *= 1.02){
        camera.position.copy(richting).multiplyScalar(d); camera.lookAt(schuin.kijk); camera.updateMatrixWorld();
        if (hoeken.every(h => { v.copy(h).project(camera); return Math.abs(v.x) <= 0.98 && Math.abs(v.y) <= 0.95; })) break;
      }
      schuin.pos.copy(richting).multiplyScalar(d);
      zetCamera();
    };
    formaat(); new ResizeObserver(formaat).observe(box);

    /* tijdlijn: opbouw, dan elke lijn op volgorde */
    const vindSpeler = p => spelers.reduce((best, s) => { const d = s.position.distanceTo(p); return d < best.d ? { s, d } : best; }, { s: null, d: 2.2 }).s;
    const vindBal = p => ballen.reduce((best, b) => { const d = b.position.distanceTo(p.clone().setY(0.22)); return d < best.d ? { b, d } : best; }, { b: null, d: 2.5 }).b;
    const zetBegin = () => {
      stand.intro = 0;
      spelers.forEach(s => { s.position.copy(s.userData.thuis).setY(6); s.scale.setScalar(0.001); });
      pionnen.forEach(p => p.scale.setScalar(0.001));
      ballen.forEach(b => { b.position.copy(b.userData.thuis); b.scale.setScalar(0.001); b.rotation.set(0, 0, 0); });
      lijnen.forEach(l => l.stukken.forEach(s => (s.scale.x = 0.0001)));
      doelen.forEach(d => d.userData.net.scale.set(1, 1, 1));
      zetCamera();
    };
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    tl.call(zetBegin)
      .to(stand, { intro: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: zetCamera }, 0)
      .to(pionnen.map(p => p.scale), { x: 1, y: 1, z: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(2)' }, 0.2)
      .to(spelers.map(s => s.scale), { x: 1, y: 1, z: 1, duration: 0.45, stagger: 0.07 }, 0.45)
      .to(spelers.map(s => s.position), { y: 0, duration: 0.7, stagger: 0.07, ease: 'bounce.out' }, 0.45)
      .to(ballen.map(b => b.scale), { x: 1, y: 1, z: 1, duration: 0.4, stagger: 0.03, ease: 'back.out(2)' }, 1.2);
    /* de spelers en bal "volgen" tijdens de animatie een virtuele positie per lijn */
    let tijd = 2.2;
    const plek = new Map();   // object → huidige plek in de tijdlijn (bij het bouwen)
    const plekVan = o => plek.get(o) || o.userData.thuis;
    lijnen.forEach(l => {
      const start = l.punten[0], eind = l.punten[l.punten.length - 1];
      const ld = l.soort === 'schot' ? 0.5 : l.soort === 'pass' ? 0.75 : 1.1;
      const perStuk = ld / l.stukken.length;
      l.stukken.forEach((s, i) => tl.to(s.scale, { x: 1, duration: perStuk, ease: 'none' }, tijd + i * perStuk));
      const route = [...l.punten.slice(1)];
      const bal = [...ballen].sort((a, b) => plekVan(a).distanceTo(start) - plekVan(b).distanceTo(start))[0];
      const balDichtbij = bal && plekVan(bal).distanceTo(start.clone().setY(0.22)) < 2.6;
      if ((l.soort === 'pass' || l.soort === 'schot') && balDichtbij){
        route.forEach((p, i) => {
          const naar = p.clone(); naar.y = l.soort === 'schot' && i === route.length - 1 ? 0.5 : 0.22;
          tl.to(bal.position, { x: naar.x, y: naar.y, z: naar.z, duration: perStuk, ease: l.soort === 'schot' ? 'power3.in' : 'power2.out' }, tijd + i * perStuk)
            .to(bal.rotation, { x: `-=${l.soort === 'schot' ? 14 : 8}`, duration: perStuk, ease: 'power2.out' }, tijd + i * perStuk);
        });
        plek.set(bal, eind.clone().setY(0.22));
        if (l.soort === 'schot'){
          const doel = doelen.find(d => d.position.distanceTo(eind) < 4);
          if (doel) tl.to(doel.userData.net.scale, { z: 1.35, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, tijd + ld - 0.05);
          tl.to(bal.position, { y: 0.22, duration: 0.4, ease: 'bounce.out' }, tijd + ld + 0.05);
        }
      } else if (l.soort === 'loopweg' || l.soort === 'dribbel'){
        const speler = spelers.reduce((best, s) => { const d = plekVan(s).distanceTo(start); return d < best.d ? { s, d } : best; }, { s: null, d: 2.4 }).s;
        if (speler){
          route.forEach((p, i) => tl.to(speler.position, { x: p.x, z: p.z, duration: perStuk, ease: 'power1.inOut' }, tijd + 0.05 + i * perStuk));
          plek.set(speler, eind.clone());
          if (l.soort === 'dribbel' && balDichtbij){
            route.forEach((p, i) => tl.to(bal.position, { x: p.x + 0.45, z: p.z - 0.3, duration: perStuk, ease: 'power1.inOut' }, tijd + 0.05 + i * perStuk)
              .to(bal.rotation, { x: '-=6', duration: perStuk }, tijd + 0.05 + i * perStuk));
            plek.set(bal, eind.clone().setY(0.22));
          }
        }
      }
      tijd += ld * 0.85;
    });
    void vindSpeler; void vindBal;

    /* hero: bij wegscrollen kantelt de camera terug naar de tekening */
    if (opts.kantelBijScroll && window.ScrollTrigger){
      window.ScrollTrigger.create({ trigger: opts.kantelBijScroll, start: 'top top', end: 'bottom top', scrub: 0.6,
        onUpdate: st => { stand.kantel = st.progress; zetCamera(); } });
    }

    /* alleen tekenen als het veld zichtbaar is */
    let zichtbaar = false;
    new IntersectionObserver(([e]) => { zichtbaar = e.isIntersecting; }).observe(box);
    const teken = () => { if (zichtbaar && box.offsetParent !== null) renderer.render(scene, camera); };
    gsap.ticker.add(teken);
    zetBegin();
    return { speel: () => { formaat(); tl.restart(); }, stop: () => tl.pause() };
  }

  window.Veld3D = { maak };
})();
