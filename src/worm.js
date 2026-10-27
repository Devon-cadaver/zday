// The giant worm. It tunnels just under the city, the street caving in along its
// path in a long furrow of broken ground, then bursts up out of the ground in a
// great arc, swallowing whatever was where it broke out, and dives back in
// further on. Every breach leaves a pit where it came out and another where it
// went back in. A ringed, banded body a hundred metres long, and a round maw full
// of teeth. In Be The Disaster you steer it from below and say when it breaks out.
import * as THREE from 'three';
import { Hole, swallow } from './impact.js';
import { cutGround } from './holes.js';
import { scaly } from './skins.js';
import { hideMaterial, sstep as ss } from './flesh.js';
import { heroesWin } from './heroes.js';
// the worm's hide: pale, so the sand and dark bands painted on it in vertex colour show through; creased pale flesh on the belly
const SANDHIDE = { key: 'worm', dry: 0.28, scales: [[226, 214, 192], [212, 198, 174], [234, 224, 204], [200, 186, 160], [220, 206, 182]], gap: [120, 96, 72], base: [214, 190, 160], light: [232, 214, 188], bruise: [176, 146, 120], vein: [168, 128, 110], small: [222, 208, 184] };

const LEN = 132, STEP = 1.2, NS = 112, RING = 22, R0 = 5.4, SHALLOW = -9, ARC_H = 38, SPEED = 13, MAXP = 3000; // a ring of RING vertices every STEP m along LEN m of body
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const SAND = new THREE.Color('#cdb894'), DARK = new THREE.Color('#54402f'), BELLY = new THREE.Color('#e4d6b8');

let P = null;
function parts() {
  if (P) return P;
  // the furrow it leaves: broken, sunken ground with a ragged edge
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  for (let py = 0; py < 128; py += 2) for (let px = 0; px < 64; px += 2) {
    const u = Math.abs(px / 63 - 0.5) * 2, edge = 0.78 + Math.sin(py * 0.45) * 0.07 + Math.sin(py * 1.7 + px) * 0.05 + Math.random() * 0.06;
    if (u > edge) continue;
    const d = 0.35 + 0.4 * u + Math.random() * 0.25, chunk = Math.random() < 0.08 ? 1.6 : 1;
    x.fillStyle = 'rgba(' + Math.round(70 * d * chunk) + ',' + Math.round(56 * d * chunk) + ',' + Math.round(42 * d * chunk) + ',' + (u > edge - 0.12 ? 0.75 : 1) + ')'; x.fillRect(px, py, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  const skin = hideMaterial({ palette: SANDHIDE, normal: 1.5, rim: [0.035, 0.026, 0.016] }); // banded by vertex colour
  P = {
    skin, scales: hideMaterial({ palette: SANDHIDE, mask: 1, vertexColors: false, color: '#cdb894', repeat: 3, normal: 1.5, rim: [0.035, 0.026, 0.016] }), // the head in the same hide as the body inner: new THREE.MeshStandardMaterial({ color: '#5a1a14', roughness: 0.45, side: THREE.BackSide }),
    throatMat: new THREE.MeshStandardMaterial({ color: '#2a0e0c', roughness: 0.4, side: THREE.BackSide }),
    toothMat: new THREE.MeshStandardMaterial({ color: '#ece2c8', roughness: 0.45 }),
    petal: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2 / 3 - 0.05, 0, Math.PI / 2), // a third of a dome: three close over the mouth
    tooth: new THREE.ConeGeometry(0.06, 0.38, 6),
    furrowMat: cutGround(new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
  };
  return P;
}

// the body: one continuous tube, rebuilt along the spine every frame (no separate pieces, so no seams)
function tubeGeometry() {
  const g = new THREE.BufferGeometry(), V = NS * (RING + 1);
  for (const [k, n] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3], ['aMask', 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(V * n), n));
  const idx = []; for (let i = 0; i < NS - 1; i++) for (let j = 0; j < RING; j++) { const a = i * (RING + 1) + j, b = a + RING + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); } // wound to face outwards
  g.setIndex(idx); g.setDrawRange(0, 0);
  return g;
}
// S: spine samples from the head back, each { x, y, z, d (distance from the head) }; t: time, for the ripple
function fillTube(g, S, t) {
  const n = S.length; if (n < 2) { g.setDrawRange(0, 0); return; }
  const Pp = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, C = g.attributes.color.array, Mk = g.attributes.aMask.array;
  let nx = 0, ny = 1, nz = 0;
  for (let i = 0; i < n; i++) {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)], s = S[i];
    let tx = a.x - b.x, ty = a.y - b.y, tz = a.z - b.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    if (i === 0 && Math.abs(ty) > 0.9) { nx = 1; ny = 0; nz = 0; } // the frame is carried down the body, kept square to it, so the skin never twists
    const dt = nx * tx + ny * ty + nz * tz; nx -= tx * dt; ny -= ty * dt; nz -= tz * dt; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    const u = s.d / LEN, tip = u > 0.86 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.86) / 0.14, 2))) : 1, neck = 1 + 0.08 * Math.exp(-Math.pow((s.d - 9) / 6, 2));
    const ring = 1 + 0.055 * Math.pow(0.5 + 0.5 * Math.cos(s.d * Math.PI * 2 / 2.6), 4); // a crisp raised ring every 2.6 m, like a real worm's segments
    const r = R0 * (1 - 0.42 * Math.pow(u, 1.2)) * tip * neck * (tip > 0.2 ? ring : 1) * (1 + 0.045 * Math.sin(t * 3 - s.d * 0.25)); // down to a closed tail tip, a slow ripple running down it
    const ph = (s.d % 12) / 12, dark = sstep(0.58, 0.7, ph) * (1 - sstep(0.9, 1, ph)); // the dark bands, soft-edged
    for (let j = 0; j <= RING; j++) {
      const th = j / RING * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), ox = nx * c + bx * sn, oy = ny * c + by * sn, oz = nz * c + bz * sn, k = i * (RING + 1) + j;
      Pp[k * 3] = s.x + ox * r; Pp[k * 3 + 1] = s.y + oy * r; Pp[k * 3 + 2] = s.z + oz * r;
      N[k * 3] = ox; N[k * 3 + 1] = oy; N[k * 3 + 2] = oz; U[k * 2] = j / RING * 4; U[k * 2 + 1] = s.d / 8.5; Mk[k] = 1 - ss(0.25, 0.7, -oy); // scales over the back and sides, bare creased flesh underneath
      const belly = sstep(0.2, 0.75, -oy) * (1 - dark) * 0.7, back = sstep(0.55, 0.95, oy) * 0.45 * (1 - dark), groove = 0.14 * Math.pow(0.5 - 0.5 * Math.cos(s.d * Math.PI * 2 / 2.6), 6);
      const dk = Math.min(1, dark + back), sh = 1 - groove;
      C[k * 3] = (SAND.r + (DARK.r - SAND.r) * dk + (BELLY.r - SAND.r) * belly) * sh; C[k * 3 + 1] = (SAND.g + (DARK.g - SAND.g) * dk + (BELLY.g - SAND.g) * belly) * sh; C[k * 3 + 2] = (SAND.b + (DARK.b - SAND.b) * dk + (BELLY.b - SAND.b) * belly) * sh;
    }
  }
  g.setDrawRange(0, (n - 1) * RING * 6);
  for (const k of ['position', 'normal', 'uv', 'color', 'aMask']) g.attributes[k].needsUpdate = true;
}
// points every STEP m back along a path (newest point last), up to LEN m
function spine(path, out) {
  out.length = 0; let i = path.length - 1, acc = 0, want = 0;
  if (i < 0) return out;
  out.push({ x: path[i].x, y: path[i].y, z: path[i].z, d: 0 }); want = STEP;
  while (i > 0 && want <= LEN + 1e-6) {
    const a = path[i], b = path[i - 1], L = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (acc + L >= want) { const f = (want - acc) / (L || 1); out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, d: want }); want += STEP; continue; }
    acc += L; i--;
  }
  return out;
}

// the head: a scaly collar the width of the body, and three jaw flaps that fold back to open the maw (it faces +y)
function headMesh() {
  const p = parts(), g = new THREE.Group();
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  const flare = [[1.0, -1.6], [1.0, -1.1], [1.06, -0.6], [1.14, -0.2], [1.17, 0.05], [1.1, 0.16], [0.98, 0.12]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(flare, RING * 2), p.scales); // the collar flares from the body out to a thick lip
  add(new THREE.CylinderGeometry(0.93, 0.45, 2.4, 22, 1, true).translate(0, -1.2, 0), p.throatMat);
  const ring = new THREE.InstancedMesh(p.tooth, p.toothMat, 2 * 20), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 20; i++) { // rings of teeth down the throat, pointing in
    const a = (i + row * 0.5) / 20 * Math.PI * 2, r = 0.86 - row * 0.12; e.set(0, -a, Math.PI / 2 + 0.5, 'YXZ'); q.setFromEuler(e);
    m.compose(new THREE.Vector3(Math.cos(a) * r, -0.15 - row * 0.45, Math.sin(a) * r), q, one); ring.setMatrixAt(row * 20 + i, m);
  }
  g.add(ring);
  const mid = (Math.PI * 2 / 3 - 0.05) / 2, hinges = [];
  for (let i = 0; i < 3; i++) {
    const turn = new THREE.Group(); turn.rotation.y = i * Math.PI * 2 / 3; g.add(turn);
    const rim = new THREE.Vector3(-Math.cos(mid), 0, Math.sin(mid)), axis = new THREE.Vector3(Math.sin(mid), 0, Math.cos(mid));
    const hinge = new THREE.Group(); hinge.position.copy(rim); turn.add(hinge);
    const shell = new THREE.Group(); shell.position.copy(rim).multiplyScalar(-1); hinge.add(shell);
    add(p.petal, p.scales, shell); add(p.petal, p.inner, shell);
    const teeth = new THREE.InstancedMesh(p.tooth, p.toothMat, 8); // along the inside of each flap
    for (let k = 0; k < 8; k++) { const ph = 0.12 + k * 0.24, th = 1.15 + (k % 2) * 0.22, dir = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)); q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); m.compose(dir.clone().multiplyScalar(0.93), q, one); teeth.setMatrixAt(k, m); }
    shell.add(teeth);
    hinges.push({ hinge, axis });
  }
  g.userData.setOpen = (k) => { for (const H of hinges) H.hinge.quaternion.setFromAxisAngle(H.axis, k * 1.9); }; // 0 shut, 1 folded right back
  g.userData.setOpen(0.2);
  return g;
}

// a static worm for the roster: an arc out of one pit and down into another, maw open
export function wormModel() {
  const g = new THREE.Group(), path = [];
  for (let u = 0; u <= 0.82; u += 0.004) path.push({ x: (u - 0.41) * 140, y: -12 + 48 * Math.sin(Math.PI * u), z: 0 }); // out of the ground on the left, head coming down on the right
  const geo = tubeGeometry(); fillTube(geo, spine(path, []).map(q => ({ ...q, d: q.d })), 0);
  const body = new THREE.Mesh(geo, parts().skin); body.castShadow = true; g.add(body);
  const h = headMesh(), a = path[path.length - 1], b = path[path.length - 4]; h.scale.setScalar(R0); h.position.set(a.x, a.y, a.z);
  h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z).normalize()); h.userData.setOpen(0.85); g.add(h);
  g.scale.setScalar(0.55);
  return g;
}

export class Worm {
  constructor(D, x, z, o = {}) {
    this.type = 'worm'; this.D = D; this.alive = true; this.t = 0; this.life = o.life ?? 240; this.player = !!o.player;
    const B = D.ctx.city.bounds, a = Math.random() * 6.28;
    this.goal = [clamp(x, B.x0 + 40, B.x1 - 40), clamp(z, B.z0 + 40, B.z1 - 40)];
    this.x = clamp(this.goal[0] - Math.cos(a) * 70, B.x0 + 20, B.x1 - 20); this.z = clamp(this.goal[1] - Math.sin(a) * 70, B.z0 + 20, B.z1 - 20); this.y = SHALLOW;
    this.yaw = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x); this.phase = 'tunnel'; this.arcT = 0; this.vy = 0; this.hp = o.hp ?? 900;
    this.path = []; for (let k = LEN + 18; k >= 0; k--) this.path.push({ x: this.x - Math.cos(this.yaw) * k, y: this.y - Math.min(6, k * 0.05), z: this.z - Math.sin(this.yaw) * k }); // the whole body from the start, trailing back underground
    this.shook = new Set(); this.holes = 0;
    const p = parts(), scene = D.ctx.scene;
    this.body = new THREE.Mesh(tubeGeometry(), p.skin); this.body.castShadow = true; this.body.frustumCulled = false; this.spine = [];
    this.head = headMesh(); this.head.scale.setScalar(R0); this.open = 0.2; scene.add(this.body, this.head);
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
  // hurt (by the heroes): enough and it dives deep and leaves once it is back underground
  damage(n, by) {
    if (this.phase === 'leave' || this.phase === 'gone' || (by && this.heroLost)) return;
    if (by && this.hp - n <= 0 && !heroesWin(this)) { this.heroLost = true; this.hp = Math.max(this.hp, 250); this.D.emit({ type: 'herolost', x: this.x, z: this.z, text: 'The worm is too much for the heroes! They are falling back' }); return; }
    this.hp -= n; if (by && !this.saidHero) { this.saidHero = true; this.D.emit({ type: 'wormhero', text: by + ' is fighting the worm!' }); } }
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
    h *= D.slowAt(this.x, Math.max(4, this.y), this.z); // a time bubble holds it
    this.t += h;
    if (this.phase === 'gone') { if ((this.goneT += h) > 4) this.alive = false; return; }
    // heading: round towards the goal
    if (this.phase !== 'arc') { let da = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x) - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += clamp(da, -0.7 * h, 0.7 * h); }
    const px = this.x, pz = this.z, py = this.y;
    this.x += Math.cos(this.yaw) * SPEED * h; this.z += Math.sin(this.yaw) * SPEED * h;
    if (this.x < B.x0 + 15 || this.x > B.x1 - 15 || this.z < B.z0 + 15 || this.z > B.z1 - 15) { this.yaw += Math.PI * h; this.x = clamp(this.x, B.x0 + 15, B.x1 - 15); this.z = clamp(this.z, B.z0 + 15, B.z1 - 15); }
    if (this.phase === 'tunnel') {
      this.y += (SHALLOW - this.y) * Math.min(1, h * 2);
      if (this.t > this.life || this.hp <= 0) { this.phase = 'leave'; D.emit({ type: 'wormleave', text: this.hp <= 0 ? 'The heroes drove the worm off! It has gone deep' : 'The worm has gone deep. The ground is still' }); }
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
    if (d >= 1) { this.path.push({ x: this.x, y: this.y, z: this.z }); if (this.path.length > LEN + 20) this.path.shift(); }
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
    const S = spine(this.path, this.spine); fillTube(this.body.geometry, S, realT);
    const a = S[0], b = S[Math.min(S.length - 1, 2)], v = this._v;
    v.set(a.x - b.x, a.y - b.y, a.z - b.z); if (v.lengthSq() < 1e-6) v.set(Math.cos(this.yaw), 0, Math.sin(this.yaw)); v.normalize();
    this.head.position.set(this.x, this.y, this.z); this.head.quaternion.setFromUnitVectors(this._up, v);
    // the jaws: open wide as it breaks out, shut again before it goes back in, barely parted underground
    const want = this.phase === 'arc' ? (this.arcT < 4.6 ? 1 : 0.15) : 0.12 + 0.06 * Math.sin(realT * 1.5);
    this.open += (want - this.open) * (dt > 0 ? 1 - Math.exp(-dt * 3) : 1); this.head.userData.setOpen(this.open);
    this.head.visible = this.body.visible = this.phase !== 'gone';
  }
  dispose() {
    const D = this.D, sc = D.ctx.scene, fu = this.furrow; sc.remove(this.body, this.head); this.body.geometry.dispose();
    D.leftovers.push({ update() {}, sync() {}, dispose() { sc.remove(fu); fu.geometry.dispose(); } }); // the caved-in furrow stays until the city is reset, like the pits
  }
}
