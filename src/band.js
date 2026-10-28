// The house band (Sean): four punks dressed head to toe in black, black hair
// down over their faces - a singer, two guitars, drums - playing the theme song
// on a stage: on the pitch of the stadium where the town has one, otherwise in a
// park near the middle, or on a big flat roof. An audience of the town's people
// (more in a bigger town) stands in front holding their phones up, flashes going
// off; fireworks go up and flame jets fire along the front of the stage. Near it,
// or with it in view, you hear the song (not loud; the game's music drops back);
// when the stage is wrecked - its building down, a disaster on it, fire, water,
// a pit, the undead in the crowd - the music stops dead and everyone runs for it.
// A reset of the world puts the show back on.
import * as THREE from 'three';
import { rig, relax, detail } from './villains.js';
import { figureGeometry, figureMaterial, figureAttributes, ARCHETYPES } from './figures.js';
import { Splash } from './water.js';
import { CURB } from './city.js';
import { sfx } from './audio.js';

const BPS = 172 / 60; // the beat
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FW = [[3, 0.35, 0.25], [0.5, 3, 0.6], [3, 2.2, 0.5], [1.8, 2.2, 3.2], [3, 0.6, 2.6]]; // firework colours

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
  MATS = {
    band: { skin: std('#e9e1d6'), suit: std('#111111', { roughness: 0.4, metalness: 0.1 }), cape: std('#0b0b0b'), hair: std('#050505', { roughness: 0.3 }), boot: std('#0a0a0a'), glove: std('#e9e1d6') },
    deck: std('#141414'), truss: std('#5a5a5e', { metalness: 0.6, roughness: 0.35 }), cab: std('#1c1c1c'), grille: std('#2a2a2a'), drum: std('#7a0d12'), chrome: std('#cfcfd4', { metalness: 0.9, roughness: 0.2 }),
    gtrA: std('#e8e2d6'), gtrB: std('#8a0f14'), gtrC: std('#0d0d0d'), neck: std('#3a2a1c'),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2), fog: false }),
    rocket: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.5), fog: false }),
    flash: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 4.5), fog: false }),
  };
  return MATS;
}
// the banner over the stage
function banner() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 512, 128);
  x.font = '900 62px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#7a0d12'; x.fillText('MY LITTLE DISASTER', 259, 68);
  x.fillStyle = '#efe9df'; x.fillText('MY LITTLE DISASTER', 256, 64);
  for (let i = 0; i < 26; i++) { const px = 30 + Math.random() * 452, w = 2 + Math.random() * 3; x.fillStyle = '#efe9df'; x.fillRect(px, 80 + Math.random() * 6, w, 6 + Math.random() * 22); } // dripping
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Band {
  constructor(ctx) {
    this.ctx = ctx; // { scene, game, city, people, traffic, fire, disasters, camera, controls, music }
    this.v = new THREE.Vector3(); this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s1 = new THREE.Vector3(1, 1, 1);
    this.venue = this.find();
    if (!this.venue) return;
    this.build();
    this.reset();
  }

  // where the show is: the stadium's pitch; a park or square near the middle; a big flat roof
  find() {
    const { city } = this.ctx, B = city.buildings, Bd = city.bounds, cx = (Bd.x0 + Bd.x1) / 2, cz = (Bd.z0 + Bd.z1) / 2, half = Math.min(Bd.x1 - Bd.x0, Bd.z1 - Bd.z0) / 2;
    const st = B.findIndex(b => b.landmark === 'Stadium');
    if (st >= 0) {
      const b = B[st], f = b.roof, hw = (f.x1 - f.x0) / 2, x = (f.x0 + f.x1) / 2;
      return { kind: 'stadium', k: st, x, z: f.z0 + 7, y: b.roofY, W: Math.min(24, hw * 1.3), D: 9, H: 1.6, crowd: { x0: x - hw * 0.8, x1: x + hw * 0.8, z0: f.z0 + 17, z1: f.z0 + 17 + hw * 1.2 }, n: 150 };
    }
    const n = Math.round(Math.min(70, Math.max(18, B.length / 18))); // a smaller crowd in a smaller town
    let best = null, bs = 1e9;
    for (const L of city.open) {
      const w = L.x1 - L.x0, d = L.z1 - L.z0; if (w < 22 || d < 22) continue;
      const lx = (L.x0 + L.x1) / 2, lz = (L.z0 + L.z1) / 2, dd = Math.hypot(lx - cx, lz - cz); if (dd > half * 0.95) continue; // anywhere in town: a roof is a last resort (its huts and tanks are part of the building)
      const s = dd - Math.min(w, d) * 1.5; if (s < bs) { bs = s; best = L; }
    }
    if (best) {
      const x = (best.x0 + best.x1) / 2, w = best.x1 - best.x0, d = best.z1 - best.z0;
      return { kind: 'park', k: -1, x, z: best.z0 + 5, y: CURB + 0.05, W: Math.min(14, w * 0.6), D: 7, H: 1.2, crowd: { x0: x - w * 0.38, x1: x + w * 0.38, z0: best.z0 + 12, z1: best.z0 + Math.min(d - 3, 12 + n * 0.45) }, n };
    }
    let rb = -1, rs = -1e9; // a roof
    B.forEach((b, k) => {
      if (b.landmark || !b.roof) return; const r = b.roof, w = r.x1 - r.x0, d = r.z1 - r.z0, h = b.roofY - b.baseY; if (w < 14 || d < 14 || h < 6 || h > 30) return;
      const s = w * d - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz) * 2; if (s > rs) { rs = s; rb = k; }
    });
    if (rb < 0) return null;
    const b = B[rb], r = b.roof, x = (r.x0 + r.x1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0, hut = b.hut, flip = hut && (hut.z0 + hut.z1) / 2 < (r.z0 + r.z1) / 2; // the stage at the end away from the stair hut
    // the crowd on the side of the roof away from the stair hut (it and the huts' rooftop clutter are part of the building)
    const hx = hut ? (hut.x0 + hut.x1) / 2 : x, cx0 = hut && hx < x ? Math.max(r.x0 + 1, hut.x1 + 1) : r.x0 + 1, cx1 = hut && hx >= x ? Math.min(r.x1 - 1, hut.x0 - 1) : r.x1 - 1;
    if (flip) return { kind: 'roof', k: rb, x, z: r.z1 - 4, y: b.roofY, W: Math.min(11, w * 0.7), D: 6, H: 0.8, flip: true, crowd: { x0: cx0, x1: cx1, z0: r.z0 + 1.5, z1: r.z1 - 9 }, n: Math.min(n, Math.round((cx1 - cx0) * (d - 10) / 4)) };
    return { kind: 'roof', k: rb, x, z: r.z0 + 4, y: b.roofY, W: Math.min(11, w * 0.7), D: 6, H: 0.8, crowd: { x0: cx0, x1: cx1, z0: r.z0 + 9, z1: r.z1 - 1.5 }, n: Math.min(n, Math.round((cx1 - cx0) * (d - 10) / 4)) };
  }

  build() {
    const { scene } = this.ctx, V = this.venue, M = mats(), g = this.g = new THREE.Group(); g.position.set(V.x, V.y, V.z); if (V.flip) g.rotation.y = Math.PI; scene.add(g); // flip: facing the other way down the roof
    const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    const W = V.W, D = V.D, H = V.H;
    box(W, H, D, 0, H / 2, 0, M.deck); // the stage
    for (const sx of [-1, 1]) { // the truss, speaker stacks
      box(0.4, 9, 0.4, sx * (W / 2 - 0.3), H + 4.5, -D / 2 + 0.4, M.truss); box(0.4, 9, 0.4, sx * (W / 2 - 0.3), H + 4.5, D / 2 - 0.6, M.truss);
      box(2.2, 3.2, 1.8, sx * (W / 2 + 1.4), 1.6, D / 2 - 1.4, M.cab); box(1.8, 1.4, 1.5, sx * (W / 2 + 1.4), 3.9, D / 2 - 1.4, M.cab);
      box(1.6, 1.1, 1.4, sx * W * 0.28, H + 0.55, -D / 2 + 1.2, M.cab); // the amps
    }
    box(W, 0.4, 0.4, 0, H + 9, -D / 2 + 0.4, M.truss); box(W, 0.4, 0.4, 0, H + 9, D / 2 - 0.6, M.truss);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, W * 0.86 / 4), new THREE.MeshBasicMaterial({ map: banner(), fog: false })); ban.position.set(0, H + 6.2, -D / 2 + 0.25); g.add(ban);
    // the drum kit, up at the back on a riser
    const dk = new THREE.Group(); dk.position.set(0, H, -D / 2 + 2.4); g.add(dk);
    const cyl = (r, h, x, y, z, m, rx = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; dk.add(o); return o; };
    cyl(0.45, 0.5, 0, 0.5, 0.55, M.drum, Math.PI / 2); cyl(0.22, 0.25, -0.5, 0.75, 0.3, M.drum); cyl(0.2, 0.25, 0.5, 0.95, 0.4, M.drum); cyl(0.25, 0.3, 0.75, 0.6, 0.0, M.drum);
    this.cymbals = [cyl(0.38, 0.02, -0.75, 1.45, 0.45, M.chrome), cyl(0.42, 0.02, 0.85, 1.6, 0.35, M.chrome)];
    // the band: singer front and centre, guitars either side, drums behind
    const parts = [['vox', 0, D / 2 - 1.6], ['gtr', -W * 0.3, D / 2 - 2.2], ['bass', W * 0.3, D / 2 - 2.2], ['drums', 0, -D / 2 + 1.6]];
    this.members = parts.map(([role, x, z], i) => {
      const r = rig({ mats: M.band, slim: role === 'vox', longHair: role === 'gtr' }); r.cape.mesh.visible = false;
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.035), M.band.hair); lock.position.set(0.012, -0.02, 0.112); lock.rotation.z = 0.25; lock.userData.keep = true; r.head.add(lock); // the devilock down over the face
      if (role === 'gtr' || role === 'bass') { // the guitar slung across the body
        const gt = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.07), role === 'gtr' ? M.gtrA : M.gtrB), neck = new THREE.Mesh(new THREE.BoxGeometry(0.045, role === 'bass' ? 0.62 : 0.52, 0.03), M.neck);
        neck.position.set(0, 0.42, 0); gt.add(body, neck); gt.position.set(0.02, 0.12, 0.15); gt.rotation.z = 1.05; for (const m of [body, neck]) { m.userData.keep = true; m.castShadow = true; } r.torso.add(gt);
      }
      r.root.scale.setScalar(0.85); r.root.position.set(x, H, z); g.add(r.root); // a touch larger than life, to read from the stands
      return { role, r, x, z, ph: i * 1.3 };
    });
    { const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), M.chrome); mic.position.set(0, H + 0.75, D / 2 - 1.05); g.add(mic); }
    // coloured lamps on the truss and the beams they throw
    this.lamps = [];
    const cone = new THREE.CylinderGeometry(0.15, 2.4, 9, 14, 1, true).translate(0, -4.5, 0);
    for (let i = 0; i < 4; i++) {
      const x = -W * 0.36 + i * W * 0.24, lamp = box(0.5, 0.5, 0.5, x, H + 8.6, D / 2 - 0.6, M.lamp);
      const beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: new THREE.Color(...FW[i % FW.length]).multiplyScalar(0.12), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.position.set(x, H + 8.6, D / 2 - 0.6); beam.renderOrder = 7; g.add(beam); this.lamps.push({ lamp, beam, i });
    }
    // the audience: the town's people, phones up, bouncing to it
    const c = V.crowd, n = Math.max(6, V.n), geo = figureGeometry(), fm = figureMaterial(); this.fm = fm;
    const fa = figureAttributes(geo, n), r = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    this.crowd = new THREE.InstancedMesh(geo, fm.mat, n); this.crowd.castShadow = true; this.crowd.frustumCulled = false; scene.add(this.crowd);
    this.fans = [];
    for (let i = 0; i < n; i++) {
      let a = r(), A = ARCHETYPES[0]; for (const t of ARCHETYPES) { if ((a -= t.w) <= 0) { A = t; break; } }
      fa.write(i, A.roll(r)); const phone = r() < 0.6; fa.arrays.anim[i] = phone ? 6 : 0;
      const x = c.x0 + r() * (c.x1 - c.x0), z = c.z0 + Math.pow(r(), 0.8) * (c.z1 - c.z0); // packed in thicker near the front
      this.fans.push({ x, z, x0: x, z0: z, phone, jump: r() < 0.35, ph: r() * 6.28, vx: 0, vz: 0 });
    }
    fa.dirty(); this.fa = fa;
    // the show: fireworks, flame jets, phone flashes
    this.fw = FW.map(col => { const s = new Splash(scene, 500); s.mat.blending = THREE.AdditiveBlending; s.mat.uniforms.uColor.value.setRGB(...col); return s; });
    this.pyro = new Splash(scene, 600); this.pyro.mat.blending = THREE.AdditiveBlending; this.pyro.mat.uniforms.uColor.value.setRGB(3, 1.1, 0.2);
    this.rockets = [];
    this.flashes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), M.flash, 14); this.flashes.frustumCulled = false; this.flashes.count = 0; scene.add(this.flashes); this.flashL = [];
  }

  // the show back on (a new run, a new round)
  reset() {
    if (!this.venue) return;
    const { city, traffic } = this.ctx, V = this.venue, c = V.crowd;
    this.on = true; this.t = 0; this.endT = 0; this.checkT = 1; this.fwT = 2; this.pyroT = 1.5; this.rockets.length = 0; this.flashL.length = 0;
    for (const f of this.fans) { f.x = f.x0; f.z = f.z0; f.vx = f.vz = 0; f.run = false; }
    this.g.visible = true; this.crowd.visible = true; this.crowd.count = this.fans.length;
    for (const mb of this.members) mb.r.root.visible = true;
    for (const s of [...this.fw, this.pyro]) s.reset();
    if (V.kind === 'park') { // clear the park where the stage and the crowd go: no trees through the stage, no parked cars in the crowd
      const mx = (c.x0 + c.x1) / 2, R = Math.hypot(c.x1 - c.x0, c.z1 - V.z) / 2 + 6, mz = (V.z + c.z1) / 2;
      city.takeStreetNear(mx, mz, R); for (const pc of traffic.parkedNear(mx, mz, R)) traffic.takeParked(pc);
    }
  }
  dispose() { if (!this.venue) return; this.ctx.music && this.ctx.music.setBand(0, true); }

  // the stage wrecked, or the show broken up: the music stops dead, everyone runs
  stop(why, vanish) {
    if (!this.on) return;
    this.on = false; this.endT = 0; this.vanish = vanish;
    if (this.ctx.music) this.ctx.music.setBand(0, true);
    const V = this.venue, sx = V.x, sz = V.z;
    for (const f of this.fans) { const dx = f.x - sx, dz = f.z - sz, d = Math.hypot(dx, dz) || 1; f.vx = dx / d * (5 + Math.random() * 3); f.vz = dz / d * (5 + Math.random() * 3); f.run = true; }
    this.fa.arrays.anim.fill(2); this.fa.attrs.anim.needsUpdate = true;
    if (vanish) { this.g.visible = false; this.crowd.visible = false; }
    this.ctx.disasters.emit({ type: 'bandstop', x: sx, z: sz, text: why });
  }

  // is the show still on? the stage's building, a disaster on it, fire, water, a pit, the undead in the crowd
  check() {
    const { city, disasters: D, fire, people } = this.ctx, V = this.venue, x = V.x, z = V.z + V.D;
    if (V.k >= 0 && city.dead[V.k]) return this.stop('The ' + (V.kind === 'stadium' ? 'stadium' : 'roof') + ' came down mid-song: the concert is over', true);
    const p = D.poiAt(x, z); if (p && p.danger > 0 && Math.hypot(p.x - x, p.z - z) < p.danger + 12) return this.stop('The band has run for it: the concert is over');
    if (V.k >= 0 && fire.bFire[V.k] === 1) return this.stop('The ' + (V.kind === 'stadium' ? 'stadium' : 'building') + ' is on fire: the concert is over');
    if (V.kind === 'park' && fire.firesWithin(x, z, 22).length) return this.stop('Fire next to the stage: the concert is over');
    if (D.holeFloor(x, z) != null) return this.stop('The stage fell into the ground: the concert is over', true);
    if (D.water.active && D.water.levelAt(x, z) - V.y > 0.4) return this.stop('The water is over the stage: the concert is over');
    if (people.zombiesNear && people.zombiesNear(x, z, 35) > 0) return this.stop('The undead got into the crowd: the concert is over');
  }

  update(dt) {
    if (!this.venue) return;
    const { game, camera, controls, music, fire, disasters: D } = this.ctx; if (!game || game.paused) dt = 0;
    this.t += dt; this.fm.uTime.value += dt;
    if (this.on && (this.checkT -= dt) <= 0) { this.checkT = 0.5; this.check(); }
    const V = this.venue, beat = this.t * BPS, ph = beat * Math.PI * 2;
    // how loud: close by, or in view (further off quieter)
    if (this.on && music) {
      const v = this.v.set(V.x, V.y + 3, V.z).project(camera), inView = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      const d = camera.position.distanceTo(this.v.set(V.x, V.y + 3, V.z)), near = 1 - ss(110, 420, d), seen = inView ? 1 - ss(200, 900, d) : 0;
      music.setBand(Math.max(near, seen * 0.75));
    }
    // the band
    for (const mb of this.members) {
      const r = mb.r; if (!this.on) { if (this.endT > 0.4) r.root.visible = false; continue; } // off the stage the moment it stops
      relax(r); const A = r.arms, L = r.legs, s = Math.sin(ph + mb.ph), hb = Math.sin(ph * 0.5 + mb.ph);
      if (mb.role === 'drums') {
        r.hips.position.y = 0.55; for (const l of L) { l.hip.rotation.x = -1.45; l.knee.rotation.x = 1.4; }
        A[0].sh.rotation.set(-0.7 + 0.35 * Math.max(0, s), 0, -0.35); A[1].sh.rotation.set(-0.7 + 0.35 * Math.max(0, -s), 0, 0.35); for (const a of A) a.el.rotation.set(-1.0, 0, 0);
        r.head.rotation.x = 0.2 + 0.25 * Math.max(0, hb); r.root.rotation.y = 0;
      } else if (mb.role === 'vox') {
        A[0].sh.rotation.set(-1.25, 0, -0.25); A[0].el.rotation.set(-2.0, 0, 0); // the mic at his mouth
        A[1].sh.rotation.set(-2.4 + 0.4 * Math.max(0, hb), 0, 0.45); A[1].el.rotation.set(-0.3, 0, 0); // a fist up
        r.torso.rotation.x = 0.15 + 0.12 * Math.max(0, s); r.head.rotation.x = -0.1; L[0].hip.rotation.set(-0.3, 0, -0.15); L[1].hip.rotation.set(0.25, 0, 0.15);
        r.root.position.y = V.H + Math.max(0, Math.sin(ph * 0.25)) * 0.25; r.root.rotation.y = Math.sin(this.t * 0.4) * 0.35;
      } else {
        A[0].sh.rotation.set(-0.95, 0, -0.55); A[0].el.rotation.set(-1.3, 0, 0); // the fretting hand up the neck
        A[1].sh.rotation.set(-0.45, 0, 0.25); A[1].el.rotation.set(-1.35 + 0.35 * Math.sin(ph * 2), 0, 0); // strumming
        r.torso.rotation.x = 0.25 + 0.2 * Math.max(0, hb); r.head.rotation.x = 0.35 + 0.45 * Math.max(0, hb); // headbanging
        L[0].hip.rotation.z = -0.22; L[1].hip.rotation.z = 0.22; for (const l of L) l.knee.rotation.x = 0.25;
        const jump = Math.sin(this.t * BPS * Math.PI / 16 + mb.ph); r.root.position.y = V.H + (jump > 0.92 ? (jump - 0.92) * 12 : 0); // a leap every few bars
        r.root.rotation.y = (mb.x < 0 ? 0.35 : -0.35);
      }
      detail(r, D);
    }
    for (const cy of this.cymbals) cy.rotation.z = Math.sin(ph * 2) * 0.08;
    // the lights sweep
    const nightK = 0.18 + 0.82 * Math.min(1, (this.ctx.game.daylight ? this.ctx.game.daylight.night : 0) * 1.5);
    for (const lp of this.lamps) { const a = this.t * 0.9 + lp.i * 1.7; lp.beam.rotation.set(Math.sin(a) * 0.45 - 0.35, 0, Math.cos(a * 0.8) * 0.45); lp.beam.visible = this.on; lp.beam.material.opacity = nightK; } // faint by day, bright at night
    // the crowd
    const c = this.crowd, m4 = this.m4, q = this.q, e = this.e, sx = V.x, sz = V.z, cam = camera.position;
    if (!this.on) this.endT += dt;
    if (this.on || this.endT < 4) {
      this.fans.forEach((f, i) => {
        let y = V.y; if (f.run) { f.x += f.vx * dt; f.z += f.vz * dt; } else if (f.jump) y += Math.max(0, Math.sin(ph + f.ph)) * 0.35;
        const hx = f.run ? f.vx : sx - f.x, hz = f.run ? f.vz : sz - f.z; e.set(0, Math.atan2(-hz, hx), 0); q.setFromEuler(e);
        m4.compose(this.v.set(f.x, y, f.z), q, this.s1); c.setMatrixAt(i, m4);
      });
      c.instanceMatrix.needsUpdate = true;
      if (!this.on && this.endT > 3.5) c.visible = false;
    }
    if (!this.on) { if (this.endT > 0.4 && !this.vanish) for (const lp of this.lamps) lp.beam.visible = false; this.syncFx(dt); return; }
    // phone flashes
    if (Math.random() < dt * 9) { const f = this.fans[Math.floor(Math.random() * this.fans.length)]; if (f.phone && this.flashL.length < 14) { const dx = sx - f.x, dz = sz - f.z, d = Math.hypot(dx, dz) || 1; this.flashL.push({ x: f.x + dx / d * 0.45, y: V.y + 1.75, z: f.z + dz / d * 0.45, t: 0.07 }); } }
    // flame jets along the front of the stage, every couple of bars
    if ((this.pyroT -= dt) <= 0) {
      this.pyroT = 4 * 2 / BPS * (Math.random() < 0.3 ? 0.5 : 1);
      for (const s of [-1, -0.33, 0.33, 1]) this.pyro.emit(sx + s * V.W * 0.45, V.y + V.H + 0.3, sz + V.D / 2 - 0.4, 22, { up: [12, 19], spread: 1.2, life: 0.75, size: 2.4 });
      if (cam.distanceTo(this.v.set(sx, V.y, sz)) < 320) sfx('whoomph', sx, V.y + 3, sz, { gain: 0.6 });
    }
    // fireworks, from behind the stage
    if ((this.fwT -= dt) <= 0) {
      this.fwT = 1.2 + Math.random() * 2.8;
      const m = new THREE.Mesh(this.flashes.geometry, mats().rocket); m.scale.setScalar(1.6); m.position.set(sx + (Math.random() - 0.5) * V.W * 1.2, V.y + V.H + 2, sz - V.D / 2 - 1); this.ctx.scene.add(m);
      this.rockets.push({ m, vx: (Math.random() - 0.5) * 6, vy: 34 + Math.random() * 14, vz: (Math.random() - 0.5) * 6, t: 0, T: 1.4 + Math.random() * 0.5, c: Math.floor(Math.random() * this.fw.length) });
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const rk = this.rockets[i], p = rk.m.position; rk.t += dt; rk.vy -= 9.8 * dt; p.x += rk.vx * dt; p.y += rk.vy * dt; p.z += rk.vz * dt;
      if (Math.random() < 0.7) this.pyro.emit(p.x, p.y - 0.5, p.z, 1, { up: [-2, 0], spread: 0.5, life: 0.4, size: 0.9 });
      if (rk.t >= rk.T) { // the burst: a ball of coloured sparks, a crackle of a second colour
        this.fw[rk.c].emit(p.x, p.y, p.z, 70, { up: [-9, 11], spread: 20, life: 1.9, size: 1.5 });
        this.fw[(rk.c + 2) % this.fw.length].emit(p.x, p.y, p.z, 25, { up: [-5, 6], spread: 11, life: 1.2, size: 1.1 });
        if (cam.distanceTo(p) < 600) sfx('boom', p.x, p.y, p.z, { gain: 0.35, rate: 1.4 });
        this.ctx.scene.remove(rk.m); this.rockets.splice(i, 1);
      }
    }
    this.syncFx(dt);
  }
  syncFx(dt) {
    const { disasters: D, fire } = this.ctx, sc = fire.uniforms.uScale.value, lk = Math.max(0.6, D.lightK || 1);
    for (const s of [...this.fw, this.pyro]) { s.update(dt); s.sync(lk, sc); }
    const fl = this.flashes; let n = 0;
    for (let k = this.flashL.length - 1; k >= 0; k--) { const f = this.flashL[k]; if ((f.t -= dt) <= 0) { this.flashL.splice(k, 1); continue; } this.m4.makeTranslation(f.x, f.y, f.z); fl.setMatrixAt(n++, this.m4); }
    fl.count = n; fl.instanceMatrix.needsUpdate = true;
  }
}
