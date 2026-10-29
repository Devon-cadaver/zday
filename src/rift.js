// Dimensional rifts (Sean): reality tears open over the town - a standing ring of crackling blue and pink energy
// round a swirling dark void, lightning arcing off it and striking about it. Near it the buildings bend and twist out
// of true, the ground cracks and pieces of the street are torn up and drawn in. Bright orb beings drift out of it and
// disintegrate cars and buildings; tentacles reach out of the void and drag buildings and people in. It is closed by
// force: the heroes (riftStep below: they smash the orbs and pour their power into it), the army (soldiers shoot the
// orbs down and fire into it) and airstrikes on it wear down its hold until it implodes in a flash; left alone it
// closes by itself after a few minutes.
import * as THREE from 'three';
import { Splash } from './water.js';
import { ST, KIND } from './people.js';
import { sfx } from './audio.js';

const RX = 34, RY = 40, ARCS = 14, ASEG = 6, TENT = 3, TSEG = 12, MAXORB = 6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const UP = new THREE.Vector3(0, 1, 0);

// the void: black at the middle, blue and pink swirling towards the rim, a white-hot edge
const VOID_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const VOID_FS = `uniform float uTime, uK; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float a = atan(p.y, p.x), s1 = 0.5 + 0.5 * sin(a * 5.0 + r * 14.0 - uTime * 2.2), s2 = 0.5 + 0.5 * sin(a * 9.0 - r * 22.0 + uTime * 3.1), e = smoothstep(0.3, 1.0, r);
  vec3 c = vec3(0.01, 0.0, 0.035) + (vec3(0.15, 0.38, 1.0) * s1 + vec3(0.9, 0.2, 0.8) * s2 * 0.6) * e * 0.85 + vec3(0.6, 0.85, 1.0) * pow(e, 7.0) * 1.4;
  gl_FragColor = vec4(c * uK, 1.0);
}`;
// the rim: crackling energy, blue running into pink, flickering
const RIM_FS = `uniform float uTime, uK; varying vec2 vUv;
void main() {
  float f = 0.5 + 0.5 * sin(vUv.x * 60.0 + uTime * 7.0) * sin(vUv.x * 23.0 - uTime * 4.0), m = 0.5 + 0.5 * sin(vUv.x * 18.85 + uTime * 1.3);
  gl_FragColor = vec4(mix(vec3(0.25, 0.5, 1.6), vec3(1.4, 0.3, 1.3), m) * (0.6 + f * 0.9) * uK, 1.0);
}`;
// a soft glow round the rim (a flat ring: brightest at the rim, fading both ways)
const HALO_FS = `uniform float uK; varying vec2 vUv;
void main() { float d = abs(length(vUv * 2.0 - 1.0) - 0.74) / 0.26; gl_FragColor = vec4(vec3(0.3, 0.45, 1.5) * pow(max(0.0, 1.0 - d), 2.0) * 0.38 * uK, 1.0); }`;

// for the roster: the rift in little, still
export function riftModel() {
  const g = new THREE.Group(), u = { uTime: { value: 0 }, uK: { value: 1 } };
  const v = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShaderMaterial({ vertexShader: VOID_VS, fragmentShader: VOID_FS, uniforms: u, side: THREE.DoubleSide })); v.scale.set(RX * 0.1, RY * 0.1, 1);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 80), new THREE.ShaderMaterial({ vertexShader: VOID_VS, fragmentShader: RIM_FS, uniforms: u, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); rim.scale.set(RX * 0.1, RY * 0.1, RX * 0.1);
  g.add(v, rim); g.position.y = RY * 0.1; g.userData.tick = (dt) => { u.uTime.value += dt; };
  return g;
}

export class Rift {
  constructor(D, x, z, opts = {}) {
    this.type = 'rift'; this.D = D; this.alive = true; this.t = 0; this.life = opts.life ?? 240; this.hp = 100; this.phase = 'open'; this.closeT = 0;
    this.x = x; this.z = z; this.yaw = Math.random() * Math.PI * 2; this.n = [Math.sin(this.yaw), Math.cos(this.yaw)]; this.cy = RY * 0.9; // n: the way the void faces
    const { scene } = D.ctx;
    this.u = { uTime: { value: 0 }, uK: { value: 0 } };
    const g = this.g = new THREE.Group(); g.position.set(x, this.cy, z); g.rotation.y = this.yaw; scene.add(g);
    this.void = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({ vertexShader: VOID_VS, fragmentShader: VOID_FS, uniforms: this.u, side: THREE.DoubleSide })); this.void.scale.set(RX, RY, 1);
    const add = (fs) => new THREE.ShaderMaterial({ vertexShader: VOID_VS, fragmentShader: fs, uniforms: this.u, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.055, 10, 120), add(RIM_FS)); this.rim.scale.set(RX, RY, RX);
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), add(HALO_FS)); this.halo.scale.set(RX, RY, 1);
    for (const m of [this.rim, this.halo]) { m.renderOrder = 7; m.frustumCulled = false; }
    g.add(this.void, this.rim, this.halo); g.scale.setScalar(0.01);
    // the lightning off the rim: ribbons in the ring's plane, redrawn a dozen times a second
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARCS * ASEG * 4 * 3), 3)); ag.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ARCS * ASEG * 4 * 3), 3));
    const idx = []; for (let q = 0; q < ARCS * ASEG; q++) { const o = q * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); } ag.setIndex(idx);
    this.arcs = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); this.arcs.frustumCulled = false; this.arcs.renderOrder = 8; g.add(this.arcs);
    // orbs, their sparkle, the tentacles, the beams and tracers
    this.orbs = []; this.orbT = 6; this.orbGeo = new THREE.SphereGeometry(1.6, 14, 10); this.orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.2, 3.6), fog: false });
    this.haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x2 = c.getContext('2d'), gr = x2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(220,240,255,1)'); gr.addColorStop(0.35, 'rgba(120,190,255,.55)'); gr.addColorStop(1, 'rgba(80,120,255,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.spark = new Splash(scene, 600); this.spark.mat.blending = THREE.AdditiveBlending; this.spark.mat.uniforms.uColor.value.setRGB(1.6, 2.6, 3.4);
    this.tents = []; this.tentT = 9;
    this.tentMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#2a0f3a', emissive: '#3a0a5a', roughness: 0.4 }), TENT * TSEG); this.tentMesh.count = 0; this.tentMesh.frustumCulled = false; this.tentMesh.castShadow = true; scene.add(this.tentMesh);
    this.tips = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 2.6), fog: false }), TENT); this.tips.count = 0; this.tips.frustumCulled = false; scene.add(this.tips);
    this.beamMeshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 8, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.2, 0.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
    this.beams = []; this.tracers = [];
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 6), 3)); tg.setDrawRange(0, 0);
    this.tracerLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 2.6, 1.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); this.tracerLines.frustumCulled = false; scene.add(this.tracerLines);
    this.warped = new Set(); this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
    D.emit({ type: 'rift', text: 'Reality is tearing open in the ' + D.district(x, z) + ' district!' });
    sfx('warp', x, 30, z, { gain: 1.2 }); D.shake(0.8);
  }
  update(h) {
    if (!this.alive) return;
    const D = this.D, { people, city, traffic } = D.ctx;
    this.t += h; this.spark.update(h);
    if (this.phase === 'closing') {
      this.closeT += h;
      if (this.closeT > 2.4 && !this.flashed) { this.flashed = true; D.flash(0.9); D.shake(1.2); sfx('boomBig', this.x, 30, this.z, { gain: 1.2 }); this.spark.emit(this.x, this.cy, this.z, 120, { up: [-12, 18], spread: 40, life: 1.6, size: 3 }); }
      if (this.closeT > 3) { this.alive = false; for (const k of this.warped) if (!city.dead[k]) city.restoreBuilding(k); }
      return;
    }
    if (this.phase === 'open' && this.t > 4) this.phase = 'live';
    if (this.t > this.life) this.close('fades');
    if (this.hp <= 0) this.close('sealed');
    if (this.phase === 'closing') return;
    // the ground about it cracks as it opens
    if (this.t > 0.6 && !this.cracked) { this.cracked = true; for (let k = 0; k < 9; k++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 40; D.decals.add('crack', this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, 10 + Math.random() * 12, 4 + Math.random() * 4); } }
    // lightning striking about it now and then
    if ((this.boltT = (this.boltT || 3) - h) <= 0) { this.boltT = 4.5 + Math.random() * 4; const a = Math.random() * 6.28, r = 20 + Math.random() * 60; D.strike(this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, { from: 70, mild: true }); }
    // the street torn up and drawn in
    if ((this.pullT = (this.pullT || 0) - h) <= 0) {
      this.pullT = 0.5; const a = Math.random() * 6.28, r = 25 + Math.random() * 50, px = this.x + Math.cos(a) * r, pz = this.z + Math.sin(a) * r;
      for (const it of city.takeStreetNear(px, pz, 4)) { const dx = this.x - it.x, dz = this.z - it.z, d = Math.hypot(dx, dz) || 1; D.debris.add(it.x, it.y + 1, it.z, it.s * 0.8, it.s * 0.6, it.s * 0.8, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v: [dx / d * 16, 9, dz / d * 16] }); }
      people.scare(this.x, this.z, 130, 0.5);
    }
    // the buildings near it bend out of true (more as it grows), a few times a second
    if ((this.warpT = (this.warpT || 0) - h) <= 0) { this.warpT = 0.18; this.warp(); }
    // orbs drift out; tentacles reach out
    if ((this.orbT -= h) <= 0 && this.orbs.filter(o => !o.dead).length < MAXORB) { this.orbT = 6 + Math.random() * 5; this.newOrb(); }
    for (const o of this.orbs) this.orbStep(o, h);
    if (this.orbs.length > 20) this.orbs = this.orbs.filter(o => !o.dead);
    if ((this.tentT -= h) <= 0 && this.tents.filter(q => !q.done).length < TENT) { this.tentT = 5 + Math.random() * 4; this.newTent(); }
    for (const q of this.tents) this.tentStep(q, h);
    this.tents = this.tents.filter(q => !q.done);
    // the army: soldiers in range shoot the orbs down and fire into the rift
    if ((this.armyT = (this.armyT || 0) - h) <= 0) { this.armyT = 0.4; this.army(); }
  }
  close(why) {
    if (this.phase === 'closing') return;
    this.phase = 'closing'; this.closeT = 0;
    for (const o of this.orbs) if (!o.dead) this.popOrb(o);
    for (const q of this.tents) q.done = true;
    this.D.emit({ type: 'riftclosed', text: why === 'sealed' ? 'The rift has been forced shut!' : 'The rift is closing by itself' });
    sfx('warp', this.x, 30, this.z, { gain: 1, rate: 0.6 });
  }
  // the buildings within reach lean towards it and twist, more the nearer and the longer it has been open
  warp() {
    const D = this.D, city = D.ctx.city, grow = Math.min(1, this.t / 25), x0 = this.x, z0 = this.z, t = this.t, near = [];
    city.buildingsNear(x0, z0, 95, (k, d, b) => { if (b.landmark !== 'Stadium') near.push([k, d, b]); });
    near.sort((p, q) => p[1] - q[1]); // the twenty nearest only (on a phone a hundred bent at once costs frames)
    for (const [k, d, b] of near.slice(0, 20)) {
      const s = Math.pow(1 - d / 95, 1.6) * grow; if (s < 0.04) continue;
      this.warped.add(k);
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, H = Math.max(4, b.top - b.baseY), dd = Math.hypot(x0 - cx, z0 - cz) || 1, ux = (x0 - cx) / dd, uz = (z0 - cz) / dd, ph = k * 0.7;
      city.warpBuilding(k, (x, y, z, o) => {
        const hy = Math.max(0, (y - b.baseY) / H), tw = s * 0.55 * hy * Math.sin(t * 0.8 + ph), c = Math.cos(tw), sn = Math.sin(tw), rx = x - cx, rz = z - cz;
        const lean = s * 9 * hy * hy * (1 + 0.25 * Math.sin(t * 1.3 + ph)), wob = s * 0.8 * Math.sin(y * 0.35 + t * 3 + ph);
        o[0] = cx + rx * c - rz * sn + ux * lean + wob; o[1] = y * (1 + s * 0.08 * Math.sin(t * 1.1 + ph)); o[2] = cz + rx * sn + rz * c + uz * lean - wob;
      });
    }
  }
  // an orb being out of the void
  newOrb() {
    const D = this.D, m = new THREE.Mesh(this.orbGeo, this.orbMat), hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    hl.scale.setScalar(11); m.add(hl); m.frustumCulled = false; D.ctx.scene.add(m);
    const sd = Math.random() < 0.5 ? 1 : -1;
    this.orbs.push({ m, x: this.x, y: this.cy + (Math.random() - 0.5) * 20, z: this.z, vx: this.n[0] * sd * 10, vz: this.n[1] * sd * 10, state: 'out', t: 0, hp: 40, ph: Math.random() * 6 });
    sfx('zap', this.x, this.cy, this.z, { gain: 0.6, rate: 0.7 });
    if (!this.saidOrb) { this.saidOrb = true; D.emit({ type: 'riftorb', text: 'Glowing beings are coming out of the rift!' }); }
  }
  // out a little way, then off after the nearest car or building, a long look, and it is gone in a burst of light
  orbStep(o, h) {
    if (o.dead) return;
    const D = this.D, { traffic, city } = D.ctx; o.t += h;
    if (o.state === 'out') { o.x += o.vx * h; o.z += o.vz * h; o.y += (16 - o.y) * Math.min(1, h * 0.8); if (o.t > 2.2) { o.state = 'hunt'; o.t = 0; } }
    if (o.state === 'hunt') {
      if (!o.tg || (o.lookT = (o.lookT || 0) - h) <= 0) { o.lookT = 2; o.tg = this.orbTarget(o); }
      const T = o.tg; if (!T) { o.x += Math.sin(o.t * 0.5 + o.ph) * 4 * h; return; }
      const tx = T.car ? T.car.x : T.pc ? T.pc.x : T.x, tz = T.car ? T.car.z : T.pc ? T.pc.z : T.z, ty = T.k != null ? Math.min(14, T.y) : 4;
      const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(d, 13 * h);
      o.x += dx / d * sp; o.z += dz / d * sp; o.y += (ty + Math.sin(o.t * 2 + o.ph) * 1.2 - o.y) * Math.min(1, h * 1.5);
      if (d < (T.k != null ? 4 : 3)) { o.state = 'zap'; o.t = 0; }
      if ((T.car && T.car.gone) || (T.k != null && city.dead[T.k])) o.tg = null;
    }
    if (o.state === 'zap') {
      if ((o.spT = (o.spT || 0) - h) <= 0) { o.spT = 0.1; this.spark.emit(o.x, o.y - 1, o.z, 4, { up: [1, 6], spread: 6, life: 0.7, size: 1.4 }); }
      if (o.t > 1.5) {
        const T = o.tg; o.tg = null; o.state = 'hunt'; o.t = 0;
        if (T && T.car && !T.car.gone) { traffic.grab(T.car); traffic.remove(T.car); }
        else if (T && T.pc && T.pc.alive) traffic.takeParked(T.pc);
        else if (T && T.k != null && !city.dead[T.k]) { D.destroyBuilding(T.k, 'collapse'); D.ctx.fire.dustCloud(T.x, T.z, 10, 20); }
        this.spark.emit(o.x, o.y - 2, o.z, 40, { up: [2, 14], spread: 12, life: 1.1, size: 2 }); sfx('zap', o.x, o.y, o.z, { gain: 0.9 });
        if (!this.saidZap) { this.saidZap = true; D.emit({ type: 'riftzap', text: 'The orbs are disintegrating everything they touch!' }); }
      }
    }
  }
  orbTarget(o) {
    const { traffic, city } = this.D.ctx; let best = null, bd = 170;
    traffic.near(o.x, o.z, 120, (c) => { if (c.gone || c.mission || this.orbs.some(q => q !== o && q.tg && q.tg.car === c)) return; const d = Math.hypot(c.x - o.x, c.z - o.z); if (d < bd) { bd = d; best = { car: c }; } });
    if (best && Math.random() < 0.55) return best;
    city.buildingsNear(o.x, o.z, 140, (k, d, b) => { if (b.landmark || city.dead[k] || this.orbs.some(q => q !== o && q.tg && q.tg.k === k)) return; if (d + 30 < bd) { bd = d + 30; best = { k, x: Math.max(b.x0, Math.min(b.x1, o.x)), z: Math.max(b.z0, Math.min(b.z1, o.z)), y: b.top - b.baseY }; } });
    return best;
  }
  popOrb(o, by) {
    if (o.dead) return; o.dead = true; this.D.ctx.scene.remove(o.m); o.m.children[0].material.dispose();
    this.spark.emit(o.x, o.y, o.z, 30, { up: [-6, 10], spread: 14, life: 0.8, size: 1.8 }); sfx('zap', o.x, o.y, o.z, { gain: 0.8, rate: 1.4 });
    if (by && !this.saidPop) { this.saidPop = true; this.D.emit({ type: 'riftpop', text: by + ' destroyed one of the orbs!' }); }
  }
  // a tentacle out of the void for a building or a person within reach
  newTent() {
    const { city, people } = this.D.ctx; let tg = null;
    if (Math.random() < 0.6) { let bd = 110; city.buildingsNear(this.x, this.z, 110, (k, d, b) => { if (!b.landmark && !city.dead[k] && b.top - b.baseY < 60 && d > 15 && d < bd && !this.tents.some(q => q.k === k)) { bd = d; tg = { k, x: Math.max(b.x0, Math.min(b.x1, this.x)), y: Math.min(b.top - b.baseY, 18) * 0.6, z: Math.max(b.z0, Math.min(b.z1, this.z)) }; } }); }
    if (!tg) people.around(this.x, this.z, 90, (j) => { if (!tg && people.hittable(j) && Math.random() < 0.08) tg = { j, x: people.x[j], y: 1, z: people.z[j] }; });
    if (!tg) return;
    const a = Math.random() * 6.28, r = 0.55 + Math.random() * 0.3, bx = this.x + Math.cos(a) * RX * r * Math.cos(this.yaw), bz = this.z - Math.cos(a) * RX * r * Math.sin(this.yaw), by = this.cy + Math.sin(a) * RY * r;
    const sd = Math.sign((tg.x - this.x) * this.n[0] + (tg.z - this.z) * this.n[1]) || 1; // out of the side facing it
    this.tents.push({ ...tg, bx, by, bz, sd, e: 0, phase: 'reach', t: 0, ph: Math.random() * 6 });
    if (!this.saidTent) { this.saidTent = true; this.D.emit({ type: 'rifttent', text: 'Tentacles are reaching out of the rift!' }); }
  }
  tentStep(q, h) {
    const D = this.D, { city, people } = D.ctx; q.t += h;
    if (q.j != null && q.phase === 'reach') { q.x = people.x[q.j]; q.z = people.z[q.j]; if (!people.hittable(q.j)) { q.phase = 'pull'; } }
    if (q.phase === 'reach') { q.e = Math.min(1, q.t / 2.6); if (q.e >= 1) { q.phase = 'grab'; q.t = 0; } }
    else if (q.phase === 'grab') {
      if (!q.got) {
        q.got = true; const dx = this.x - q.x, dz = this.z - q.z, d = Math.hypot(dx, dz) || 1;
        if (q.k != null && !city.dead[q.k]) { D.destroyBuilding(q.k, 'collapse', { dir: Math.atan2(dz, dx) }); for (let i = 0; i < 10; i++) D.debris.add(q.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 10, q.z + (Math.random() - 0.5) * 8, 2 + Math.random() * 2, 1.5 + Math.random(), 2 + Math.random() * 2, '#8a7a6a', 'fly', { v: [dx / d * 22, 14, dz / d * 22] }); }
        if (q.j != null && people.hittable(q.j)) { const j = q.j; people.fling(j, dx / d * 18, 12, dz / d * 18); D.later(1.3, () => { if (people.st[j] !== ST.DEAD && people.st[j] !== ST.EVAC) { people.st[j] = ST.EVAC; people.lvl[j] = -1; people.stats.dead++; if (people.kind[j] === KIND.CIVILIAN) people.stats.disasterCiv++; } }); }
        sfx('roarDeep', q.x, 10, q.z, { gain: 0.5, rate: 1.4 });
      }
      if (q.t > 0.5) { q.phase = 'pull'; q.t = 0; }
    } else if (q.phase === 'pull') { q.e = Math.max(0, 1 - q.t / 2.2); if (q.e <= 0) q.done = true; }
  }
  // soldiers within range of an orb shoot at it (tracers), and those near enough fire into the rift
  army() {
    const { people } = this.D.ctx, soldier = (j) => people.kind[j] === KIND.SOLDIER && people.lvl[j] === -1 && people.st[j] !== ST.DEAD && people.st[j] !== ST.EVAC;
    this.tracers.length = 0; let shots = 0;
    for (const o of this.orbs) {
      if (o.dead || o.state === 'out') continue; let n = 0;
      people.around(o.x, o.z, 75, (j) => { if (soldier(j)) { n++; if (this.tracers.length < 60) this.tracers.push([people.x[j], 1.5, people.z[j], o.x, o.y, o.z]); } });
      if (n) { o.hp -= n * 4; shots += n; if (o.hp <= 0) this.popOrb(o, 'The army'); }
    }
    let n = 0; people.around(this.x, this.z, 110, (j) => { if (soldier(j)) { n++; if (this.tracers.length < 60 && Math.random() < 0.3) this.tracers.push([people.x[j], 1.5, people.z[j], this.x + (Math.random() - 0.5) * RX, this.cy + (Math.random() - 0.5) * RY, this.z]); } });
    if (n) { this.hp -= n * 0.1; shots += n; }
    if (shots) sfx('rifle', this.x, 5, this.z, { gain: 0.35 });
  }
  // a hero pouring power into it (riftStep): the beam this frame
  beam(hero) { if (this.beams.length < 3) this.beams.push([hero.x, hero.y, hero.z]); }
  onEvent(e) {
    if (this.phase === 'closing' || e.x == null) return;
    if (e.type === 'blast' && Math.hypot(e.x - this.x, e.z - this.z) < 75) this.hp -= 16;
    if ((e.type === 'nuked' || e.type === 'nukeflash') && Math.hypot(e.x - this.x, e.z - this.z) < 300) this.hp -= 200;
  }
  poi() { return this.phase === 'closing' ? null : { x: this.x, z: this.z, danger: 60, range: 420 }; }

  sync(dt, realT) {
    const D = this.D, lk = Math.max(0.6, D.lightK || 1), sc = D.ctx.fire.uniforms.uScale.value; this.spark.sync(lk, sc);
    this.u.uTime.value += dt;
    const open = this.phase === 'closing' ? Math.max(0, 1 - this.closeT / 2.4) : Math.min(1, this.t / 4), k = 1 - Math.pow(1 - open, 3);
    this.g.scale.set(Math.max(0.01, k * (1 + 0.02 * Math.sin(this.t * 7))), Math.max(0.01, k), 1); this.u.uK.value = Math.max(0.05, k);
    // the lightning off the rim
    if ((this.arcT = (this.arcT || 0) - dt) <= 0) {
      this.arcT = 0.08; const P = this.arcs.geometry.attributes.position, C = this.arcs.geometry.attributes.color, pa = P.array, ca = C.array;
      for (let a = 0; a < ARCS; a++) {
        const ang = Math.random() * 6.28, L = (8 + Math.random() * 30) * (0.4 + 0.6 * k), cx = Math.cos(ang), cy = Math.sin(ang), pink = Math.random() < 0.4;
        let x = cx * RX, y = cy * RY, w = 0.9;
        for (let s = 0; s < ASEG; s++) {
          const nx = x + (cx + (Math.random() - 0.5) * 1.4) * L / ASEG, ny = y + (cy + (Math.random() - 0.5) * 1.4) * L / ASEG, w2 = w * 0.72, o = ((a * ASEG + s) * 4) * 3, px = -(ny - y), py = nx - x, pl = Math.hypot(px, py) || 1;
          const q = [[x - px / pl * w, y - py / pl * w], [x + px / pl * w, y + py / pl * w], [nx + px / pl * w2, ny + py / pl * w2], [nx - px / pl * w2, ny - py / pl * w2]];
          for (let i = 0; i < 4; i++) { pa[o + i * 3] = q[i][0]; pa[o + i * 3 + 1] = q[i][1]; pa[o + i * 3 + 2] = (Math.random() - 0.5) * 2; const b = (1 - s / ASEG) * 2.2 * k; ca[o + i * 3] = (pink ? 1.6 : 0.6) * b; ca[o + i * 3 + 1] = (pink ? 0.4 : 0.9) * b; ca[o + i * 3 + 2] = 2 * b; }
          x = nx; y = ny; w = w2;
        }
      }
      P.needsUpdate = true; C.needsUpdate = true;
    }
    // the orbs
    for (const o of this.orbs) { if (o.dead) continue; o.m.position.set(o.x, o.y, o.z); const p = 1 + Math.sin(this.t * 6 + o.ph) * 0.12 + (o.state === 'zap' ? 0.4 * Math.abs(Math.sin(o.t * 18)) : 0); o.m.scale.setScalar(p); }
    // the tentacles: out of the void along a bending curve, as far as they have reached, thick at the root
    const { m4, q, v, s, p } = this; let n = 0, tn = 0;
    for (const T of this.tents) {
      if (T.e <= 0.01) continue;
      const cx = (T.bx + T.x) / 2 + this.n[0] * 14 * T.sd, cyy = Math.max(T.by, T.y) + 18, cz = (T.bz + T.z) / 2 + this.n[1] * 14 * T.sd; let px = T.bx, py = T.by, pz = T.bz;
      for (let i = 1; i <= TSEG && n < TENT * TSEG; i++) {
        const u = i / TSEG * T.e, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, wig = Math.sin(u * 9 + this.t * 3 + T.ph) * 2.2 * (1 - u);
        const nx = a * T.bx + b * cx + c * T.x + wig * this.n[1], ny = a * T.by + b * cyy + c * T.y, nz = a * T.bz + b * cz + c * T.z - wig * this.n[0];
        const L = Math.hypot(nx - px, ny - py, nz - pz) || 0.01, r = 1.8 * (1 - i / TSEG * 0.75);
        v.set(nx - px, ny - py, nz - pz).normalize(); q.setFromUnitVectors(UP, v); m4.compose(p.set(px, py, pz), q, s.set(r, L, r)); this.tentMesh.setMatrixAt(n++, m4);
        px = nx; py = ny; pz = nz;
      }
      m4.compose(p.set(px, py, pz), q.identity(), s.setScalar(1.1)); this.tips.setMatrixAt(tn++, m4);
    }
    this.tentMesh.count = n; this.tips.count = tn; this.tentMesh.instanceMatrix.needsUpdate = true; this.tips.instanceMatrix.needsUpdate = true;
    // the heroes' beams into it
    this.beamMeshes.forEach((m, i) => { const b = this.beams[i]; m.visible = !!b; if (!b) return; const dx = this.x - b[0], dy = this.cy - b[1], dz = this.z - b[2], L = Math.hypot(dx, dy, dz); v.set(dx, dy, dz).normalize(); m.quaternion.setFromUnitVectors(UP, v); m.position.set(b[0], b[1], b[2]); m.scale.set(1 + Math.sin(this.t * 30) * 0.2, L, 1 + Math.sin(this.t * 30) * 0.2); });
    this.beams.length = 0;
    // the soldiers' tracers
    const ta = this.tracerLines.geometry.attributes.position, tb = ta.array; let tc = 0;
    if (Math.random() < 0.6) for (const tr of this.tracers) { tb.set(tr, tc * 6); tc++; }
    this.tracerLines.geometry.setDrawRange(0, tc * 2); ta.needsUpdate = true;
  }
  dispose() {
    const { scene } = this.D.ctx;
    for (const o of this.orbs) if (!o.dead) scene.remove(o.m);
    for (const m of [this.g, this.tentMesh, this.tips, this.tracerLines, ...this.beamMeshes]) scene.remove(m);
    scene.remove(this.spark.points); this.spark.points.geometry.dispose(); this.spark.mat.dispose();
    this.arcs.geometry.dispose(); this.tentMesh.geometry.dispose(); this.tips.geometry.dispose(); this.tracerLines.geometry.dispose(); this.haloTex.dispose();
  }
}

// a hero against a rift (heroes.js job 'rift'): after the nearest loose orb to smash it, else hovering before the void
// pouring power into it (its hold weakens), the heroes spread out side by side
export function riftStep(hero, h, J) {
  const R = J.R; if (!R.alive || R.phase === 'closing') { hero.job = null; return; }
  let o = J.orb && !J.orb.dead ? J.orb : null;
  if (!o && (J.findT = (J.findT || 0) - h) <= 0) { J.findT = 1; let bd = 240; for (const q of R.orbs) if (!q.dead && q.state !== 'out') { const d = Math.hypot(q.x - hero.x, q.z - hero.z); if (d < bd) { bd = d; o = q; } } J.orb = o; }
  if (o) { const d = hero.fly(o.x, o.y, o.z, h, 50); if (d < 5) { R.popOrb(o, hero.name); J.orb = null; } return; }
  const sd = hero.name === 'Nova' ? -1 : hero.name === 'Tempo' ? 1 : 0, px = R.x + R.n[0] * 60 + R.n[1] * sd * 22, pz = R.z + R.n[1] * 60 - R.n[0] * sd * 22;
  const d = hero.fly(px, R.cy + 4 + sd * 6, pz, h, 70);
  if (d < 14) { R.beam(hero); R.hp -= 1.3 * h; }
}
