// The killer plant (Sean): a seed takes root in a street and the plant grows out of control. Thick veined vines run
// out along the streets and branch at the crossings, thinner tendrils creep off them and out of the heart in every
// direction, forking smaller and smaller like veins, climb the walls of the buildings beside them (a building wrapped
// by four is crushed and comes down), flowers pop open along them, and car-sized flytraps rise out of the vines and
// snap up the people and cars that come near. Fire kills it: the vines on a burning building burn with it, fire runs
// along the vines, and so does whatever an airstrike's blast, a flame team (FlameTeam below: soldiers with
// flamethrowers torching everything in reach) or a napalm run (aircraft.js) reaches. Burn out its heart, the bulb where
// it took root, and the rest withers away; left alone it grows for some minutes, then goes dormant.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Splash } from './water.js';
import { ST, KIND } from './people.js';
import { RW, HALF } from './city.js';
import { sfx } from './audio.js';

const MAXSEG = 3200, MAXFLOWER = 420, MAXTRAP = 20, MAXTIP = 26, MAXVEIN = 40, MAXCLIMB = 12, STEP = 3.6, GROW = 4.4; // vine pieces, flowers, flytraps, street tips, tendrils, vines up walls; metres a piece; metres a second a tip grows
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const UP = new THREE.Vector3(0, 1, 0);
const paint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };

// a length of vine: a unit tube along +y, green with dark red veins running down it
function vineGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0), p = g.attributes.position, c = new Float32Array(p.count * 3);
  const body = new THREE.Color('#3d6e30'), vein = new THREE.Color('#6e1a36');
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), v = Math.abs(Math.sin(a * 1.5)) > 0.93 ? vein : body; c.set([v.r, v.g, v.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// a flower: five petals round a yellow heart (tinted per flower)
function flowerGeometry() {
  const parts = [];
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, p = new THREE.SphereGeometry(0.5, 7, 5).scale(1, 0.25, 0.55).translate(0.55, 0, 0).rotateY(a); parts.push(paint(p, '#ffffff')); }
  parts.push(paint(new THREE.SphereGeometry(0.28, 8, 6), '#ffe23a'));
  return mergeGeometries(parts);
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
// a flytrap the size of a car: a thick stalk in a ruff of leaves, two jaws hinged at the back (green outside, red
// inside), spiked along their rims; userData.upper / lower are the jaws (rotate x to open), userData.head turns
// the shapes, made once and shared by every flytrap (userData.shared: never disposed)
let TRAP = null;
function trapShapes() {
  if (TRAP) return TRAP;
  const leaves = [], teeth = (up) => { const t = []; for (let k = 0; k < 11; k++) { const a = -Math.PI * 0.9 + k / 10 * Math.PI * 1.8, c = new THREE.ConeGeometry(0.1, 0.55, 5); if (up) c.rotateX(Math.PI); t.push(c.translate(Math.sin(a) * 1.6, up ? -0.18 : 0.18, 1.25 + Math.cos(a) * 1.31)); } return mergeGeometries(t); };
  for (let k = 0; k < 5; k++) leaves.push(new THREE.SphereGeometry(1, 8, 6).scale(1.4, 0.18, 0.55).translate(1.2, 0.25, 0).rotateZ(0.25).rotateY(k / 5 * Math.PI * 2 + 0.3));
  const bowl = (up) => { const b = new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 0.82).translate(0, 0, 1.25); if (!up) b.rotateX(Math.PI).translate(0, 0, 2.5); return b; };
  TRAP = { stalk: new THREE.CylinderGeometry(0.35, 0.6, 2.3, 8).translate(0, 1.15, 0), leaves: mergeGeometries(leaves), bowlUp: bowl(true), bowlDown: bowl(false), teethUp: teeth(true), teethDown: teeth(false) };
  for (const g of Object.values(TRAP)) g.userData.shared = true;
  return TRAP;
}
// a flytrap's own materials and any shapes of its own, freed (the shared ones stay)
export function freeModel(root) {
  const seen = new Set();
  root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); for (const m of [].concat(o.material || [])) if (!seen.has(m)) { seen.add(m); m.dispose(); } });
}
export function flytrapModel() {
  const S = trapShapes(), g = new THREE.Group(), green = mat('#4f8a34'), red = mat('#c42a44', { side: THREE.BackSide, roughness: 0.4 }), tooth = mat('#ece6c4'), stalk = mat('#365f27'), leaf = mat('#3f7a2c');
  const st = new THREE.Mesh(S.stalk, stalk); st.castShadow = true; g.add(st);
  const lv = new THREE.Mesh(S.leaves, leaf); lv.castShadow = true; g.add(lv); // a ruff of five leaves
  const head = new THREE.Group(); head.position.set(0, 2.35, 0); g.add(head);
  const jaw = (up) => {
    const pv = new THREE.Group(); pv.position.set(0, 0, -1.25); head.add(pv);
    for (const m of [green, red]) { const o = new THREE.Mesh(up ? S.bowlUp : S.bowlDown, m); o.castShadow = m === green; pv.add(o); }
    pv.add(new THREE.Mesh(up ? S.teethUp : S.teethDown, tooth)); // teeth round the front of the rim
    return pv;
  };
  const upper = jaw(true), lower = jaw(false);
  upper.rotation.x = -0.9; lower.rotation.x = 0.2;
  g.userData = { head, upper, lower, mats: [green, stalk, leaf] };
  return g;
}

export class Plant {
  constructor(D, x, z, opts = {}) {
    this.type = 'plant'; this.D = D; this.alive = true; this.t = 0; this.life = opts.life ?? 300; this.hp = 100; this.withering = -1;
    const { scene, city } = D.ctx;
    // take root on the street nearest the spot (where the vines can run)
    const near = (lines, v) => lines.reduce((b, L) => (Math.abs(L - v) < Math.abs(b - v) ? L : b), lines[0]), lx = near(city.sx, x), lz = near(city.sz, z);
    if (Math.abs(lx - x) < Math.abs(lz - z)) x = lx; else z = lz;
    this.x = x; this.z = z;
    this.segs = []; this.tips = []; this.traps = []; this.flowers = []; this.wraps = {}; this.trapT = 4; this.anim = new Set();
    this.g = new THREE.Group(); scene.add(this.g);
    this.vines = new THREE.InstancedMesh(vineGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), MAXSEG); this.vines.count = 0; this.vines.castShadow = true; this.vines.receiveShadow = true; this.vines.frustumCulled = false;
    this.vines.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXSEG * 3).fill(1), 3);
    this.blooms = new THREE.InstancedMesh(flowerGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: '#3a0a22' }), MAXFLOWER); this.blooms.count = 0; this.blooms.frustumCulled = false;
    this.blooms.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXFLOWER * 3).fill(1), 3);
    this.g.add(this.vines, this.blooms);
    // the heart: a fat veined bulb in a crown of leaves
    this.heart = new THREE.Group(); this.heart.position.set(x, 0, z); this.g.add(this.heart);
    this.heartMat = mat('#4a0a1e', { emissive: '#2a0412', roughness: 0.65 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14).scale(5, 4.2, 5).translate(0, 3, 0), this.heartMat); bulb.castShadow = true; this.heart.add(bulb); this.bulb = bulb;
    const spike = mat('#2c1a12', { roughness: 0.5 });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.2, 6), spike); s.position.set(Math.cos(a) * 4.2, 4.6, Math.sin(a) * 4.2); s.lookAt(Math.cos(a) * 9, 9, Math.sin(a) * 9); s.rotateX(Math.PI / 2); this.heart.add(s); } // a crown of thorns
    for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6).scale(4.5, 0.4, 1.6).translate(4.2, 0.6, 0), mat('#3d7a2c')); l.rotation.y = k / 7 * Math.PI * 2; l.rotation.z = 0.3; l.castShadow = true; this.heart.add(l); }
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
    // out from the root both ways along its street, and along the cross street if it is at a crossing
    const onX = city.sz.includes(z);
    for (const d of [-1, 1]) this.tips.push(onX ? { axis: 'x', line: z, x, z, dx: d, dz: 0, off: 0, acc: 0, len: 0, r: 1.35 } : { axis: 'z', line: x, x, z, dx: 0, dz: d, off: 0, acc: 0, len: 0, r: 1.35 });
    for (let k = 0; k < 8; k++) this.vein(x, z, (k + Math.random() * 0.6) / 8 * Math.PI * 2, 0.95, 0); // and tendrils out of it every way
    D.emit({ type: 'plant', text: 'A strange plant has taken root in the ' + D.district(x, z) + ' district. It is spreading fast!' });
    sfx('collapse', x, 2, z, { gain: 0.5, rate: 0.7 });
  }
  // a piece of vine from a to b, r thick, on building k (-1: the street)
  seg(ax, ay, az, bx, by, bz, r, k) {
    if (this.segs.length >= MAXSEG) return null;
    const s = { ax, ay, az, bx, by, bz, r, k, g: 0, burn: 0, dead: false, i: this.segs.length, tint: 0.85 + Math.random() * 0.3 };
    this.segs.push(s); this.vines.count = this.segs.length; this.anim.add(s);
    return s;
  }
  flower(x, y, z, wall) {
    if (this.flowers.length >= MAXFLOWER) return;
    const f = { x, y, z, s: 1.3 + Math.random() * 1.1, g: 0, burn: 0, dead: false, i: this.flowers.length, wall, rot: Math.random() * 6.28 };
    this.flowers.push(f); this.blooms.count = this.flowers.length;
    this.c.set(['#ff4fa3', '#e83ccf', '#b14dff', '#ff6f6f', '#ff9ad5'][Math.floor(Math.random() * 5)]); this.blooms.setColorAt(f.i, this.c); this.blooms.instanceColor.needsUpdate = true;
    this.anim.add(f);
  }
  // a tendril off in any direction (gen 0: out of the heart; each fork thinner and shorter), wandering like a vein
  vein(x, z, a, r, gen) {
    if (gen > 3 || this.withering >= 0 || this.tips.filter(q => !q.dead && q.axis === 'v').length >= MAXVEIN) return;
    this.tips.push({ axis: 'v', x, z, a, r, gen, acc: 0, len: 0, max: [32, 13, 7, 4][gen] * (1 + Math.random()) });
  }
  // a car-sized flytrap rising out of the vines at (x, z)
  trap(x, z, yaw) {
    const m = flytrapModel(); m.position.set(x, 0, z); m.scale.setScalar(0.01); m.userData.size = 1.25; this.g.add(m);
    this.traps.push({ m, x, z, yaw, t: 0, state: 'rise', hp: 100, look: 1, open: 0.9, ph: Math.random() * 6 });
    sfx('thud', x, 1, z, { gain: 0.5, rate: 0.6 });
  }

  update(h) {
    if (!this.alive) return;
    this.t += h;
    const { city, people, fire } = this.D.ctx;
    if (this.withering < 0 && this.t > this.life) this.wither('dormant');
    if (this.withering >= 0) { this.withering += h; if (this.withering > 6) this.alive = false; for (const tr of this.traps) this.trapStep(tr, h); this.burnStep(h); return; }
    // the tips grow
    for (const T of this.tips) { if (T.dead) continue; T.acc += GROW * h * (T.axis === 'y' ? 0.55 : T.axis === 'v' ? 0.62 : 1); while (T.acc >= STEP && !T.dead) { T.acc -= STEP; this.grow(T); } }
    if (this.tips.length > 90) this.tips = this.tips.filter(T => !T.dead);
    // and it keeps creeping: a new tendril now and then out of the heart, or off a vine already grown
    if ((this.veinT = (this.veinT ?? 2) - h) <= 0) {
      this.veinT = 0.9 + Math.random() * 0.8; const s = Math.random() < 0.3 ? null : this.segs[Math.floor(Math.random() * this.segs.length)];
      if (!s) this.vein(this.x, this.z, Math.random() * 6.283, 0.95, 0); else if (!s.dead && s.burn === 0 && s.k < 0) this.vein(s.bx, s.bz, Math.random() * 6.283, Math.max(0.4, s.r * 0.6), 1);
    }
    // a flytrap now and then, out of the vines, away from the others
    if ((this.trapT -= h) <= 0 && this.traps.filter(tr => !tr.dead).length < MAXTRAP) {
      this.trapT = 4 + Math.random() * 3;
      for (let n = 0; n < 12; n++) {
        const s = this.segs[this.segs.length - 1 - Math.floor(Math.random() * Math.min(80, this.segs.length))]; if (!s || s.dead || s.k >= 0) continue;
        if (Math.hypot(s.bx - this.x, s.bz - this.z) < 18 || this.traps.some(tr => !tr.dead && Math.hypot(tr.x - s.bx, tr.z - s.bz) < 20)) continue;
        this.trap(s.bx, s.bz, Math.atan2(s.bx - s.ax, s.bz - s.az) + (Math.random() < 0.5 ? 1.57 : -1.57)); break;
      }
    }
    for (const tr of this.traps) this.trapStep(tr, h);
    if (this.traps.length > 30) this.traps = this.traps.filter(tr => !tr.dead);
    this.burnStep(h);
    // fire on a building burns the vines on it; vines on a building that came down come down with it
    if ((this.chkT = (this.chkT || 0) - h) <= 0) {
      this.chkT = 1;
      for (const s of this.segs) if (!s.dead && s.k >= 0 && s.burn === 0) { if (city.dead[s.k]) this.kill(s); else if (fire.bFire[s.k] === 1) s.burn = 0.01; }
      for (const cf of fire.carFires) if (cf.on) this.burnAt(cf.x, cf.z, 3, 0.3, true);
      if (this.traps.length) people.scare(this.x, this.z, 40, 0.6);
    }
  }
  // a tip grows one piece: along its street (wandering across the road, branching at the crossings, tendrils off it, now
  // and then up a wall beside it), a tendril its own way, or up its wall
  grow(T) {
    const D = this.D, city = D.ctx.city, B = city.bounds;
    if (T.axis === 'v') { // a tendril: wandering off over the pavements, lots and roads, thinning, forking smaller ones
      const st = STEP * 0.75; T.a += (Math.random() - 0.5) * 0.7;
      const x2 = T.x + Math.sin(T.a) * st, z2 = T.z + Math.cos(T.a) * st;
      if (x2 < B.x0 || x2 > B.x1 || z2 < B.z0 || z2 > B.z1) { T.dead = true; return; }
      let k = -1; city.buildingsNear(x2, z2, 0.4, (kk) => { if (k < 0) k = kk; });
      if (k >= 0) { // a wall: up it (one too tall, or too many climbing already: along it)
        const b = city.buildings[k];
        if (b.landmark || b.roofY >= 70 || this.tips.filter(q => !q.dead && q.axis === 'y').length >= MAXCLIMB) { T.a += Math.random() < 0.5 ? 1.6 : -1.6; T.len += st; if (T.len > T.max) T.dead = true; return; }
        const inx = T.x < b.x0 ? 1 : T.x > b.x1 ? -1 : 0, inz = inx ? 0 : T.z < b.z0 ? 1 : -1, wx = clamp(T.x, b.x0, b.x1) - inx * 0.3, wz = clamp(T.z, b.z0, b.z1) - inz * 0.3;
        T.dead = true; if (!this.seg(T.x, 0.15, T.z, wx, 0.4, wz, T.r, -1)) return;
        this.tips.push({ axis: 'y', k, x: wx, y: 0.4, z: wz, wx: inz, wz: inx, nx: -inx, nz: -inz, acc: 0, r: Math.max(0.4, T.r * 0.8) });
        return;
      }
      if (!this.seg(T.x, 0.15, T.z, x2, 0.15, z2, T.r, -1)) { T.dead = true; return; }
      T.x = x2; T.z = z2; T.len += st; T.r = Math.max(0.25, T.r * 0.97);
      if (Math.random() < 0.07) this.flower(x2, 0.25, z2, false);
      if (Math.random() < (T.gen < 2 ? 0.22 : 0.12)) this.vein(x2, z2, T.a + (Math.random() < 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.7), T.r * 0.7, T.gen + 1);
      if (T.len > T.max) T.dead = true;
      return;
    }
    if (T.axis === 'y') {
      const b = city.buildings[T.k]; if (!b || city.dead[T.k]) { T.dead = true; return; }
      const y2 = Math.min(b.roofY + 0.2, T.y + STEP * 0.9), w = (Math.random() - 0.5) * 1.6, x2 = T.x + T.wx * w, z2 = T.z + T.wz * w;
      if (!this.seg(T.x, T.y, T.z, x2, y2, z2, T.r, T.k)) { T.dead = true; return; }
      if (Math.random() < 0.3) this.flower(x2 + T.nx * 0.3, y2, z2 + T.nz * 0.3, true);
      T.x = x2; T.y = y2; T.z = z2;
      if (y2 >= b.roofY) { T.dead = true; this.wrapped(T.k); }
      return;
    }
    const x2 = T.x + T.dx * STEP, z2 = T.z + T.dz * STEP;
    if (x2 < B.x0 - 25 || x2 > B.x1 + 25 || z2 < B.z0 - 25 || z2 > B.z1 + 25) { T.dead = true; return; }
    T.off = clamp(T.off + (Math.random() - 0.5) * 1.5, -RW / 2 + 0.7, RW / 2 - 0.7);
    const px = T.axis === 'x' ? x2 : T.line + T.off, pz = T.axis === 'x' ? T.line + T.off : z2;
    if (!this.seg(T.x, 0.2, T.z, px, 0.2, pz, T.r, -1)) { T.dead = true; return; }
    T.x = px; T.z = pz; T.len += STEP;
    if (Math.random() < 0.16) this.flower(px + (Math.random() - 0.5) * 1.6, 0.3, pz + (Math.random() - 0.5) * 1.6, false);
    if (Math.random() < 0.3) this.vein(px, pz, Math.atan2(T.dx, T.dz) + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.9), T.r * 0.5, 1); // a tendril off to one side
    // a crossing: a branch off along the cross street
    const a = T.axis === 'x' ? px : pz, live = this.tips.filter(q => !q.dead).length;
    for (const L of T.axis === 'x' ? city.sx : city.sz) {
      if (Math.abs(a - L) > STEP / 2 || T.cross === L) continue;
      T.cross = L;
      if (live < MAXTIP && Math.random() < 0.85) { const r = Math.max(0.7, T.r * 0.85), d0 = Math.random() < 0.5 ? 1 : -1; for (const d of Math.random() < 0.4 ? [d0, -d0] : [d0]) this.tips.push(T.axis === 'x' ? { axis: 'z', line: L, x: px, z: pz, dx: 0, dz: d, off: 0, acc: 0, len: 0, r } : { axis: 'x', line: L, x: px, z: pz, dx: d, dz: 0, off: 0, acc: 0, len: 0, r }); }
    }
    if (Math.random() < 0.14) this.climb(T, px, pz);
    if (T.len > 60 && Math.random() < 0.006 * T.len / 40) T.dead = true; // some peter out
  }
  // off the street and up the wall of the building beside it
  climb(T, px, pz) {
    const city = this.D.ctx.city, sd = Math.random() < 0.5 ? 1 : -1, nx = T.axis === 'x' ? 0 : sd, nz = T.axis === 'x' ? sd : 0;
    if (this.tips.filter(q => !q.dead && q.axis === 'y').length >= MAXCLIMB) return;
    let k = -1; city.buildingsNear(px + nx * (HALF + 2), pz + nz * (HALF + 2), 4, (kk, d, b) => { if (k < 0 && !b.landmark && b.roofY < 70) k = kk; });
    if (k < 0) return;
    const b = city.buildings[k], wx = clamp(px, b.x0, b.x1) - nx * 0.3, wz = clamp(pz, b.z0, b.z1) - nz * 0.3;
    if (!this.seg(px, 0.2, pz, wx, 0.4, wz, T.r * 0.6, -1)) return;
    this.tips.push({ axis: 'y', k, x: wx, y: 0.4, z: wz, wx: nz, wz: nx, nx: -nx, nz: -nz, acc: 0, r: Math.max(0.5, T.r * 0.55) });
  }
  // a building with four vines up it is crushed (a small one; a tall one only gets its windows burst)
  wrapped(k) {
    const D = this.D, city = D.ctx.city, b = city.buildings[k];
    this.wraps[k] = (this.wraps[k] || 0) + 1;
    if (this.wraps[k] < 4 || city.dead[k]) return;
    if (b.roofY < 50) { D.destroyBuilding(k, 'collapse'); if (!this.saidCrush) { this.saidCrush = true; D.emit({ type: 'plantcrush', text: 'The vines have crushed a building!' }); } }
    else D.blowWindows(k, 1, 0, 0.8);
  }

  // a flytrap: rises, gapes and sways, snaps up whoever comes near (a person, a car, a parked car), chews, gapes again
  trapStep(tr, h) {
    if (tr.dead) return;
    const D = this.D, { people, traffic } = D.ctx; tr.t += h;
    if (tr.state === 'burn') { if (tr.t > 1.8) { tr.dead = true; this.g.remove(tr.m); freeModel(tr.m); } return; }
    if (this.withering >= 0 && tr.state !== 'burn') { tr.state = 'burn'; tr.t = 0; return; }
    if (tr.state === 'rise') { if (tr.t > 1.6) { tr.state = 'open'; tr.t = 0; } return; }
    if (tr.state === 'open' && (tr.look -= h) <= 0) {
      tr.look = 0.3; let vic = null;
      people.around(tr.x, tr.z, 7.5, (j) => { if (!vic && people.hittable(j) && people.kind[j] !== KIND.SOLDIER && people.st[j] !== ST.ZOMBIE) vic = { j, x: people.x[j], z: people.z[j] }; });
      if (!vic) traffic.near(tr.x, tr.z, 9, (c) => { if (!vic && !c.gone && !c.mission && (c.mode === 0 || c.mode === 4) && Math.hypot(c.x - tr.x, c.z - tr.z) < 8) vic = { car: c, x: c.x, z: c.z }; });
      if (!vic) { const pc = traffic.parkedNear(tr.x, tr.z, 7.5)[0]; if (pc) vic = { pc, x: pc.x, z: pc.z }; }
      if (vic) { tr.state = 'snap'; tr.t = 0; tr.vic = vic; tr.yaw = Math.atan2(vic.x - tr.x, vic.z - tr.z); }
    }
    if (tr.state === 'snap' && tr.t > 0.15 && tr.vic) { // gone
      const v = tr.vic; tr.vic = null;
      if (v.j != null) { const j = v.j; if (people.hittable(j)) { people.st[j] = ST.EVAC; people.lvl[j] = -1; people.stats.dead++; if (people.kind[j] === KIND.CIVILIAN) people.stats.disasterCiv++; } if (!this.saidEat) { this.saidEat = true; D.emit({ type: 'planteat', text: 'A giant flytrap is eating people!' }); } }
      else { if (v.car) { traffic.grab(v.car); traffic.remove(v.car); } else traffic.takeParked(v.pc); if (!this.saidCar) { this.saidCar = true; D.emit({ type: 'plantcar', text: 'A flytrap just ate a car!' }); } }
      sfx('crash', tr.x, 2, tr.z, { gain: 0.5, rate: 0.6 }); D.shake(0.15);
    }
    if (tr.state === 'snap' && tr.t > 0.25) { tr.state = 'chew'; tr.t = 0; }
    if (tr.state === 'chew' && tr.t > 2.6) { tr.state = 'reopen'; tr.t = 0; }
    if (tr.state === 'reopen' && tr.t > 1) { tr.state = 'open'; tr.t = 0; tr.look = 1.2; }
  }
  // burning pieces char and shrink away, setting light to the pieces next to them now and then (fire runs along the vines)
  burnStep(h) {
    for (const s of this.segs) {
      if (s.dead || s.burn === 0) continue;
      s.burn += h / 1.5; this.anim.add(s);
      if (s.burn > 0.4 && !s.spread) { s.spread = true; for (const o of this.segs) if (!o.dead && o.burn === 0 && Math.random() < 0.38 && Math.min(Math.hypot(o.ax - s.bx, o.az - s.bz) + Math.abs(o.ay - s.by), Math.hypot(o.bx - s.ax, o.bz - s.az) + Math.abs(o.by - s.ay)) < 1.5) o.burn = 0.01; }
      if (s.burn >= 1) this.kill(s);
    }
    for (const f of this.flowers) { if (f.dead) continue; if (this.withering >= 0 && f.burn === 0) f.burn = 0.01; if (f.burn > 0) { f.burn += h / 1.2; this.anim.add(f); if (f.burn >= 1) f.dead = true; } }
    if (this.withering >= 0) for (const s of this.segs) if (!s.dead && s.burn === 0 && Math.random() < h * 0.9) s.burn = 0.01; // all of it dies back
  }
  kill(s) { s.dead = true; this.anim.add(s); }
  // fire at (x, z) out to R: vines, flowers and flytraps there catch; the heart takes damage (power: how fierce)
  burnAt(x, z, R, power = 1, quiet = false) {
    let n = 0; const R2 = R * R;
    for (const s of this.segs) {
      if (s.dead || s.burn > 0) continue;
      const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez, u = L2 > 0 ? clamp(((x - s.ax) * ex + (z - s.az) * ez) / L2, 0, 1) : 0, dx = s.ax + ex * u - x, dz = s.az + ez * u - z;
      if (dx * dx + dz * dz < R2) { s.burn = 0.01; n++; }
    }
    for (const f of this.flowers) if (!f.dead && f.burn === 0 && Math.hypot(f.x - x, f.z - z) < R) f.burn = 0.01;
    for (const tr of this.traps) if (!tr.dead && tr.state !== 'burn' && Math.hypot(tr.x - x, tr.z - z) < R + 2.5) { tr.hp -= 45 * power; if (tr.hp <= 0) { tr.state = 'burn'; tr.t = 0; n++; } }
    if (this.withering < 0 && Math.hypot(this.x - x, this.z - z) < R + 5) { this.hp -= 1.6 * power; this.hurt = 0.5; if (this.hp <= 0) this.wither('burnt'); }
    if (n && !quiet) this.D.ctx.fire.burst(x, 1, z, Math.min(16, 5 + n), 1.9);
    return n;
  }
  wither(why) {
    if (this.withering >= 0) return;
    this.withering = 0; for (const T of this.tips) T.dead = true;
    this.D.emit({ type: 'plantdead', text: why === 'burnt' ? 'The plant\'s heart has burned out. The vines are dying' : 'The plant has stopped growing and is dying back' });
  }
  // the nearest living part of it within R of (x, z): [x, z] (for a flame team to aim at)
  nearest(x, z, R) {
    let best = null, bd = R;
    for (const tr of this.traps) if (!tr.dead && tr.state !== 'burn') { const d = Math.hypot(tr.x - x, tr.z - z); if (d < bd) { bd = d; best = [tr.x, tr.z]; } }
    if (this.withering < 0) { const d = Math.hypot(this.x - x, this.z - z); if (d < bd) { bd = d; best = [this.x, this.z]; } }
    for (const s of this.segs) if (!s.dead && s.burn === 0) { const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, d = Math.hypot(mx - x, mz - z); if (d < bd - 3) { bd = d + 3; best = [mx, mz]; } } // the flytraps and the heart first
    return best;
  }
  onEvent(e) {
    if (e.type === 'blast' && e.x != null) this.burnAt(e.x, e.z, 30, 3);
    if ((e.type === 'nuked' || e.type === 'nukeflash') && e.x != null) this.burnAt(e.x, e.z, 400, 30);
  }
  poi() { if (this.withering >= 0) return null; const tr = this.traps.find(q => !q.dead && q.state === 'chew'); return tr ? { x: tr.x, z: tr.z, danger: 12, range: 260 } : { x: this.x, z: this.z, danger: 22, range: 300 }; }

  sync(dt, t) {
    const { m4, q, v, s, c } = this, moved = this.anim.size > 0; // nothing growing or burning: nothing to send to the screen
    for (const o of this.anim) {
      if (o.ax !== undefined) { // a piece of vine growing in, burning away
        o.g = Math.min(1, o.g + dt * 2.2);
        const L = Math.hypot(o.bx - o.ax, o.by - o.ay, o.bz - o.az) + 0.25, sh = o.dead ? 0 : 1 - Math.max(0, o.burn - 0.5) * 2;
        v.set(o.bx - o.ax, o.by - o.ay, o.bz - o.az).normalize(); q.setFromUnitVectors(UP, v);
        m4.compose(this._p || (this._p = new THREE.Vector3()), q, s.set(o.r * sh, L * o.g, o.r * sh)); m4.setPosition(o.ax, o.ay, o.az);
        this.vines.setMatrixAt(o.i, m4);
        const b = o.burn; if (b > 0) c.setRGB(1.8 * (1 - b) + 0.12, 0.7 * (1 - b) + 0.08, 0.15 * (1 - b) + 0.06); else c.setScalar(o.tint);
        this.vines.setColorAt(o.i, c);
        if (o.g >= 1 && (b === 0 || o.dead)) this.anim.delete(o);
      } else { // a flower popping open, burning away
        o.g = Math.min(1, o.g + dt * 2.5); const pop = o.g < 1 ? Math.sin(o.g * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1, sc = o.dead ? 0 : o.s * pop * (1 - o.burn);
        q.setFromAxisAngle(o.wall ? this._ax || (this._ax = new THREE.Vector3(1, 0, 0)) : UP, o.wall ? 1.4 : o.rot);
        m4.compose(v.set(o.x, o.y, o.z), q, s.set(sc, sc, sc)); this.blooms.setMatrixAt(o.i, m4);
        if (o.g >= 1 && (o.burn === 0 || o.dead)) this.anim.delete(o);
      }
    }
    if (moved) { this.vines.instanceMatrix.needsUpdate = true; if (this.vines.instanceColor) this.vines.instanceColor.needsUpdate = true; this.blooms.instanceMatrix.needsUpdate = true; }
    // the heart throbs (faster when burnt); withering, it blackens and sinks
    const w = this.withering >= 0 ? Math.min(1, this.withering / 5) : 0, beat = 1 + Math.sin(t * (this.hurt > 0 ? 9 : 3)) * 0.04;
    this.hurt = Math.max(0, (this.hurt || 0) - dt);
    this.heart.scale.set(beat * (1 - w * 0.6), beat * (1 - w * 0.8), beat * (1 - w * 0.6));
    this.heartMat.color.setRGB(0.26 * (1 - w) + 0.05, 0.03 * (1 - w) + 0.03, 0.09 * (1 - w) + 0.03); this.heartMat.emissive.setRGB(this.hurt > 0 ? 0.6 : (0.16 + 0.06 * Math.sin(t * 3)) * (1 - w), 0.01, 0.07 * (1 - w)); // it glows a little with each beat
    for (const tr of this.traps) {
      if (tr.dead) continue;
      const m = tr.m, u = m.userData, k = tr.state === 'rise' ? Math.min(1, tr.t / 1.6) : 1, burn = tr.state === 'burn' ? Math.min(1, tr.t / 1.6) : 0;
      m.scale.setScalar(Math.max(0.01, (u.size || 1) * (k < 1 ? 1 - Math.pow(1 - k, 3) : 1) * (1 - burn * 0.8)));
      let open = 0.9 + Math.sin(t * 1.4 + tr.ph) * 0.07;
      if (tr.state === 'snap') open = Math.max(0, 0.9 - tr.t / 0.15 * 0.9); else if (tr.state === 'chew') open = 0.04 + Math.abs(Math.sin(tr.t * 13)) * 0.09; else if (tr.state === 'reopen') open = Math.min(0.9, tr.t * 0.9); else if (tr.state === 'burn') open = 0.5 * (1 - burn);
      u.upper.rotation.x = -open; u.lower.rotation.x = open * 0.22;
      u.head.rotation.y = (tr.state === 'open' ? Math.sin(t * 0.7 + tr.ph) * 0.5 : 0); m.rotation.y = tr.yaw;
      u.head.position.y = 2.35 + (tr.state === 'chew' ? Math.sin(tr.t * 13) * 0.08 : 0);
      if (burn > 0) for (const mm of u.mats) mm.color.lerp(this._blk || (this._blk = new THREE.Color('#141008')), Math.min(1, dt * 3));
    }
  }
  dispose() {
    this.D.ctx.scene.remove(this.g);
    freeModel(this.g); // the vines, the flowers, the heart, the flytraps still standing
  }
}

// a flame team (Commander's unit, the Sandbox's responders): soldiers at (x, z) torching the nearest of the plant within
// reach - jets of flame from each of them, everything there catching - until their fuel runs out
export class FlameTeam {
  constructor(D, x, z, o = {}) {
    this.D = D; this.x = x; this.z = z; this.t = 0; this.life = o.life ?? 45; this.alive = true; this.target = null;
    const { people, scene } = D.ctx;
    this.men = people.spawnOfficers(x, z, 4, KIND.SOLDIER) || [];
    this.fl = new Splash(scene, 700); this.fl.mat.blending = THREE.AdditiveBlending; this.fl.mat.uniforms.uColor.value.setRGB(3.2, 1.2, 0.25);
    this.core = new Splash(scene, 300); this.core.mat.blending = THREE.AdditiveBlending; this.core.mat.uniforms.uColor.value.setRGB(3.6, 2.6, 1.2);
  }
  update(h) {
    this.t += h; this.fl.update(h); this.core.update(h);
    if (this.t > this.life) { if (this.t > this.life + 1.5) this.alive = false; return; } // out of fuel (the last flames burn out)
    const D = this.D, { people } = D.ctx;
    if ((this.aimT = (this.aimT || 0) - h) <= 0) { this.aimT = 0.5; this.target = D.plantNear(this.x, this.z, 32); }
    const T = this.target; if (!T) return;
    for (let i = 0; i < 4; i++) {
      const j = this.men[i], ok = j != null && people.kind[j] === KIND.SOLDIER && people.lvl[j] === -1 && people.st[j] !== ST.DEAD;
      const px = ok ? people.x[j] : this.x + Math.cos(i * 1.6) * 3, pz = ok ? people.z[j] : this.z + Math.sin(i * 1.6) * 3, dx = T[0] - px, dz = T[1] - pz, d = Math.hypot(dx, dz) || 1, sp = Math.min(26, 8 + d * 1.1);
      this.fl.emit(px, 1.3, pz, 3, { v: [dx / d * sp, 2.5, dz / d * sp], spread: 2.2, life: Math.min(1.1, d / sp + 0.3), size: 2.4 });
      this.core.emit(px, 1.3, pz, 1, { v: [dx / d * sp * 0.9, 2.2, dz / d * sp * 0.9], spread: 1.2, life: 0.5, size: 1.4 });
    }
    if ((this.burnT = (this.burnT || 0) - h) <= 0) { this.burnT = 0.25; D.burnPlants(T[0], T[1], 5, 1); }
    if ((this.sndT = (this.sndT || 0) - h) <= 0) { this.sndT = 1.1; sfx('whoomph', this.x, 1.5, this.z, { gain: 0.35, rate: 1.3 }); }
  }
  sync() { const D = this.D, lk = Math.max(0.6, D.lightK || 1), sc = D.ctx.fire.uniforms.uScale.value; this.fl.sync(lk, sc); this.core.sync(lk, sc); }
  dispose() { for (const s of [this.fl, this.core]) { this.D.ctx.scene.remove(s.points); s.points.geometry.dispose(); s.mat.dispose(); } }
}
