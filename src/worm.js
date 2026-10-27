// The giant worm. It tunnels just under the city, the street caving in along its
// path in a long furrow of broken ground, then bursts up out of the ground in a
// great arc, swallowing whatever was where it broke out, and dives back in
// further on. Every breach leaves a pit where it came out and another where it
// went back in. A ringed, banded body a hundred metres long, and a round maw full
// of teeth. In Be The Disaster you steer it from below and say when it breaks out.
import * as THREE from 'three';
import { Hole, swallow } from './impact.js';
import { cutGround } from './holes.js';

const SEG = 40, GAP = 3.3, R0 = 5.4, SHALLOW = -9, ARC_H = 38, SPEED = 13, MAXP = 3000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let P = null;
function parts() {
  if (P) return P;
  const ring = [[0.9, -0.5], [0.98, -0.42], [1, -0.2], [1, 0.2], [0.98, 0.42], [0.9, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)); // one ridged ring of the body
  // the maw: a thick lip round a dark throat, three rows of teeth pointing in
  const lip = new THREE.TorusGeometry(1, 0.22, 10, 28).rotateX(Math.PI / 2);
  const throat = new THREE.CylinderGeometry(0.95, 0.6, 1.6, 24, 1, true).translate(0, -0.8, 0);
  const tooth = new THREE.ConeGeometry(0.07, 0.42, 5).rotateX(Math.PI / 2).translate(0, 0, -0.2);
  // the furrow it leaves: broken, sunken ground with a ragged edge
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  for (let py = 0; py < 128; py += 2) for (let px = 0; px < 64; px += 2) {
    const u = Math.abs(px / 63 - 0.5) * 2, edge = 0.78 + Math.sin(py * 0.45) * 0.07 + Math.sin(py * 1.7 + px) * 0.05 + Math.random() * 0.06;
    if (u > edge) continue;
    const d = 0.35 + 0.4 * u + Math.random() * 0.25, chunk = Math.random() < 0.08 ? 1.6 : 1;
    x.fillStyle = 'rgba(' + Math.round(70 * d * chunk) + ',' + Math.round(56 * d * chunk) + ',' + Math.round(42 * d * chunk) + ',' + (u > edge - 0.12 ? 0.75 : 1) + ')'; x.fillRect(px, py, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  P = {
    seg: new THREE.LatheGeometry(ring, 18), lip, throat, tooth,
    skin: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }), // banded by instance colour
    lipMat: new THREE.MeshStandardMaterial({ color: '#8a6a52', roughness: 0.6 }),
    throatMat: new THREE.MeshStandardMaterial({ color: '#2a0e0c', roughness: 0.4, side: THREE.BackSide }),
    toothMat: new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.5 }),
    furrowMat: cutGround(new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
  };
  return P;
}
const BAND = [new THREE.Color('#c9b48e'), new THREE.Color('#c9b48e'), new THREE.Color('#3e3026')]; // two sandy rings, one dark: the stripes

// the head: maw facing +y
function headMesh() {
  const p = parts(), g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  add(p.lip, p.lipMat); add(p.throat, p.throatMat);
  const teeth = new THREE.InstancedMesh(p.tooth, p.toothMat, 3 * 22), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let row = 0; row < 3; row++) for (let i = 0; i < 22; i++) {
    const a = (i + row * 0.5) / 22 * Math.PI * 2, r = 0.9 - row * 0.12, y = -0.05 - row * 0.32;
    e.set(0.7 + row * 0.25, -a + Math.PI / 2, 0, 'YXZ'); q.setFromEuler(e);
    m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1)); teeth.setMatrixAt(row * 22 + i, m);
  }
  g.add(teeth);
  return g;
}

// a static worm for the roster: an arc out of one pit and down into another
export function wormModel() {
  const p = parts(), g = new THREE.Group(), body = new THREE.InstancedMesh(p.seg, p.skin, SEG), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const at = (s) => new THREE.Vector3(-34 + s * 68, -4 + 26 * Math.sin(Math.PI * s), 0);
  for (let i = 0; i < SEG; i++) {
    const s = 1 - i / (SEG - 1), a = at(s), b = at(Math.max(0, s - 0.01)), r = R0 * (1 - 0.5 * i / SEG) * 0.55;
    q.setFromUnitVectors(up, a.clone().sub(b).normalize()); m.compose(a, q, new THREE.Vector3(r, GAP * 0.62, r)); body.setMatrixAt(i, m); body.setColorAt(i, BAND[i % 3]);
  }
  g.add(body);
  const h = headMesh(); h.scale.setScalar(R0 * 0.62); h.position.copy(at(1)); h.quaternion.setFromUnitVectors(up, at(1).sub(at(0.99)).normalize()); g.add(h);
  return g;
}

export class Worm {
  constructor(D, x, z, o = {}) {
    this.type = 'worm'; this.D = D; this.alive = true; this.t = 0; this.life = o.life ?? 140; this.player = !!o.player;
    const B = D.ctx.city.bounds, a = Math.random() * 6.28;
    this.goal = [clamp(x, B.x0 + 40, B.x1 - 40), clamp(z, B.z0 + 40, B.z1 - 40)];
    this.x = clamp(this.goal[0] - Math.cos(a) * 70, B.x0 + 20, B.x1 - 20); this.z = clamp(this.goal[1] - Math.sin(a) * 70, B.z0 + 20, B.z1 - 20); this.y = SHALLOW;
    this.yaw = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x); this.phase = 'tunnel'; this.arcT = 0; this.vy = 0;
    this.path = [{ x: this.x, y: this.y, z: this.z }]; this.shook = new Set(); this.holes = 0;
    const p = parts(), scene = D.ctx.scene;
    this.body = new THREE.InstancedMesh(p.seg, p.skin, SEG); this.body.castShadow = true; this.body.frustumCulled = false;
    for (let i = 0; i < SEG; i++) this.body.setColorAt(i, BAND[i % 3]);
    this.head = headMesh(); this.head.scale.setScalar(R0 * 1.15); scene.add(this.body, this.head);
    // the furrow: a ribbon along the tunnel, grown as it goes
    const g = new THREE.BufferGeometry(); this.fp = new Float32Array(MAXP * 6); this.fu = new Float32Array(MAXP * 4); const idx = [];
    for (let i = 0; i < MAXP - 1; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    g.setAttribute('position', new THREE.BufferAttribute(this.fp, 3)); g.setAttribute('uv', new THREE.BufferAttribute(this.fu, 2)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(MAXP * 6).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx); g.setDrawRange(0, 0);
    this.furrow = new THREE.Mesh(g, p.furrowMat); this.furrow.frustumCulled = false; this.furrow.receiveShadow = true; this.furrow.renderOrder = 1; scene.add(this.furrow);
    this.fn = 0; this.fd = 0; this.lastF = null; this.cutFrom = null;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'worm', x: this.goal[0], z: this.goal[1], r: 30, exact: true, text: 'The ground is shaking in the ' + D.district(x, z) + ' district. Something huge is moving underneath!' });
  }
  get surfaced() { return this.phase === 'arc'; }
  steer(x, z) { const B = this.D.ctx.city.bounds; this.goal = [clamp(x, B.x0 + 30, B.x1 - 30), clamp(z, B.z0 + 30, B.z1 - 30)]; }
  // up out of the ground now
  breach() { if (this.phase !== 'tunnel') return false; this.phase = 'arc'; this.arcT = 0; return true; }
  newGoal() {
    const { people, city } = this.D.ctx, B = city.bounds; let best = -1;
    for (let n = 0; n < 10; n++) {
      const i = Math.floor(Math.random() * people.active); if (!people.hittable(i)) continue;
      const d = Math.hypot(people.x[i] - this.x, people.z[i] - this.z); if (d < 90 || d > 260) continue;
      let c = 0; people.around(people.x[i], people.z[i], 12, () => { c++; }); if (c > best) { best = c; this.goal = [people.x[i], people.z[i]]; }
    }
    if (best < 0) this.goal = [clamp(this.x + (Math.random() - 0.5) * 300, B.x0 + 40, B.x1 - 40), clamp(this.z + (Math.random() - 0.5) * 300, B.z0 + 40, B.z1 - 40)];
  }
  update(h) {
    const D = this.D, { city } = D.ctx, B = city.bounds;
    this.t += h;
    if (this.phase === 'gone') { if ((this.goneT += h) > 4) this.alive = false; return; }
    // heading: round towards the goal
    if (this.phase !== 'arc') { let da = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x) - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += clamp(da, -0.7 * h, 0.7 * h); }
    const px = this.x, pz = this.z, py = this.y;
    this.x += Math.cos(this.yaw) * SPEED * h; this.z += Math.sin(this.yaw) * SPEED * h;
    if (this.x < B.x0 + 15 || this.x > B.x1 - 15 || this.z < B.z0 + 15 || this.z > B.z1 - 15) { this.yaw += Math.PI * h; this.x = clamp(this.x, B.x0 + 15, B.x1 - 15); this.z = clamp(this.z, B.z0 + 15, B.z1 - 15); }
    if (this.phase === 'tunnel') {
      this.y += (SHALLOW - this.y) * Math.min(1, h * 2);
      if (this.t > this.life) { this.phase = 'leave'; D.emit({ type: 'wormleave', text: 'The worm has gone deep. The ground is still' }); }
      else if (!this.player && Math.hypot(this.goal[0] - this.x, this.goal[1] - this.z) < 10) this.breach();
      else if (this.player && Math.hypot(this.goal[0] - this.x, this.goal[1] - this.z) < 4) this.yaw += h * 1.2; // circles under your finger
    } else if (this.phase === 'arc') {
      this.arcT += h; const u = Math.min(1, this.arcT / 7);
      this.y = SHALLOW + (ARC_H - SHALLOW) * Math.sin(Math.PI * u);
      if (u >= 1) { this.phase = 'tunnel'; this.y = SHALLOW; if (!this.player) this.newGoal(); }
    } else if (this.phase === 'leave') { this.y -= h * 6; if (this.path.every(q => q.y < -R0 - 2)) { this.phase = 'gone'; this.goneT = 0; } }
    // breaking the surface: a pit, everything there swallowed; and back in again
    if (py < 0 && this.y >= 0) this.burst(true); else if (py >= 0 && this.y < 0) this.burst(false);
    const d = Math.hypot(this.x - (this.path[this.path.length - 1].x), this.z - this.path[this.path.length - 1].z);
    if (d >= 1) { this.path.push({ x: this.x, y: this.y, z: this.z }); if (this.path.length > SEG * GAP + 20) this.path.shift(); }
    if (this.y < 0) this.underground(px, pz); else this.airborne();
  }
  // tunnelling: the ground caves in along the way, shaking what stands above
  underground(px, pz) {
    const D = this.D, { city, people, traffic, fire } = D.ctx, x = this.x, z = this.z;
    if (this.y > -14 && this.phase !== 'leave') this.furrowTo(x, z);
    city.buildingsNear(x, z, R0 + 1, (k, dd, b) => {
      if (this.shook.has(k)) return; this.shook.add(k);
      const hgt = b.top - b.baseY; if (hgt < 24 && Math.random() < 0.55) D.destroyBuilding(k, 'collapse', { dir: this.yaw }); else city.char(k, 0.9);
    });
    if ((this.tremT = (this.tremT || 0) - 1) <= 0) {
      this.tremT = 6;
      people.around(x, z, R0 + 2, (j) => { if (!people.hittable(j)) return; const dx = people.x[j] - x, dz = people.z[j] - z, dl = Math.hypot(dx, dz) || 1; people.move(j, dx / dl, dz / dl, 2.5); people.panic(j, x, z, -1); });
      people.scare(x, z, 30, 0.5);
      traffic.near(x, z, R0 + 1, (c) => { if (c.gone || c.mode === 4 || c.mode === 5 || Math.hypot(c.x - x, c.z - z) > R0) return; traffic.fling(c, (Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3); });
      if (Math.random() < 0.5) fire.dustCloud(x, z, R0, 3);
      if (this.near(x, z)) D.shake(0.15);
    }
  }
  // in the air: what the head goes through comes down
  airborne() {
    const D = this.D, { city } = D.ctx;
    city.buildingsNear(this.x, this.z, R0 * 0.8, (k, d, b) => { if (this.y < b.top + R0 && !this.shook.has(k)) { this.shook.add(k); if (b.top - b.baseY < 70) D.destroyBuilding(k, 'collapse', { dir: this.yaw }); else D.blowWindows(k, Math.cos(this.yaw), Math.sin(this.yaw), 1.2); } });
  }
  burst(up) {
    const D = this.D, { fire, people, traffic } = D.ctx, x = this.x, z = this.z, R = R0 * 1.7;
    new Hole(D, x, z, { R, depth: 45, rim: 1.4, shape: 'shaft', wall: '#6e5a46', floor: '#22180f', rimCol: '#7a6650' });
    swallow(D, x, z, R);
    D.ctx.city.buildingsNear(x, z, R, (k) => D.destroyBuilding(k, 'collapse', { dir: this.yaw }));
    people.block(x, z, R + 0.3); traffic.closeNear(x, z, R + 3);
    fire.dustCloud(x, z, R * 1.6, 14);
    for (let n = 0; n < 50; n++) { const a = Math.random() * 6.28, sp = 6 + Math.random() * 16, s = 0.6 + Math.random() * 2; D.debris.add(x + Math.cos(a) * R * 0.5, 1, z + Math.sin(a) * R * 0.5, s, s * 0.7, s, Math.random() < 0.6 ? 0x6e5a46 : 0x8a7a62, 'fly', { v: [Math.cos(a) * sp, 10 + Math.random() * 18, Math.sin(a) * sp] }); }
    people.scare(x, z, 80, 0.9);
    if (this.near(x, z)) D.shake(up ? 1.4 : 0.9);
    if (up && !this.saidUp) { this.saidUp = true; D.emit({ type: 'wormup', x, z, text: 'A giant worm burst out of the ground in the ' + D.district(x, z) + ' district!' }); }
    this.lastF = null; this.cutFrom = [x, z, R]; // the furrow starts again clear of the pit
  }
  furrowTo(x, z) {
    if (this.cutFrom && Math.hypot(x - this.cutFrom[0], z - this.cutFrom[1]) < this.cutFrom[2] + 2) return;
    const L = this.lastF; if (L && Math.hypot(x - L[0], z - L[1]) < 3) return;
    if (this.fn >= MAXP - 3) return;
    const ax = Math.cos(this.yaw), az = Math.sin(this.yaw), w = R0 * 1.25;
    if (!L && this.lastC) { this.put(this.fn++, this.lastC[0], this.lastC[1], ax, az, 0); this.put(this.fn++, x, z, ax, az, 0); } // a new stretch after a breach: zero-width joins, so it does not connect to the last one
    if (L) this.fd += Math.hypot(x - L[0], z - L[1]);
    this.put(this.fn++, x, z, ax, az, w); this.lastF = this.lastC = [x, z];
    const g = this.furrow.geometry; g.setDrawRange(0, Math.max(0, this.fn - 1) * 6); g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
  put(k, x, z, ax, az, w) { this.fp.set([x + az * w, 0.27, z - ax * w, x - az * w, 0.27, z + ax * w], k * 6); this.fu.set([0, this.fd / 14, 1, this.fd / 14], k * 4); }
  near(x, z) { const { camera, controls } = this.D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.2; }
  poi() { return this.phase === 'arc' ? { x: this.x, z: this.z, danger: 30, range: 320 } : null; }
  sync(dt, realT) {
    // the body follows the path the head has been along
    const P = this.path, m = this._m, q = this._q, v = this._v; let n = 0, i = P.length - 1, acc = 0, prev = P[i];
    for (let s = 0; s < SEG && i > 0; s++) {
      const want = s * GAP; while (i > 0 && acc < want) { const a = P[i], b = P[i - 1]; acc += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); i--; }
      const a = P[i], b = P[Math.min(P.length - 1, i + 1)];
      v.set(b.x - a.x, b.y - a.y, b.z - a.z); if (v.lengthSq() < 1e-6) v.set(Math.cos(this.yaw), 0, Math.sin(this.yaw)); v.normalize();
      q.setFromUnitVectors(this._up, v); const r = R0 * (1 - 0.55 * s / SEG) * (1 + 0.04 * Math.sin(realT * 4 - s * 0.6));
      m.compose(this._p.set(a.x, a.y, a.z), q, this._s.set(r, GAP * 1.12, r)); this.body.setMatrixAt(n++, m); prev = a;
    }
    this.body.count = n; this.body.instanceMatrix.needsUpdate = true;
    const h0 = P[P.length - 1], h1 = P[Math.max(0, P.length - 3)];
    v.set(h0.x - h1.x, h0.y - h1.y, h0.z - h1.z); if (v.lengthSq() < 1e-6) v.set(Math.cos(this.yaw), 0, Math.sin(this.yaw)); v.normalize();
    this.head.position.set(this.x, this.y, this.z); this.head.quaternion.setFromUnitVectors(this._up, v);
    this.head.scale.setScalar(R0 * 1.15 * (1 + 0.06 * Math.sin(realT * 3))); // the maw working
    this.head.visible = this.body.visible = this.phase !== 'gone';
  }
  dispose() {
    const D = this.D, sc = D.ctx.scene, fu = this.furrow; sc.remove(this.body, this.head); this.body.dispose();
    D.leftovers.push({ update() {}, sync() {}, dispose() { sc.remove(fu); fu.geometry.dispose(); } }); // the caved-in furrow stays until the city is reset, like the pits
  }
}
