// Cars: lane following with braking, right of way at intersections, U-turns
// when blocked. Near zombies drivers panic: faster, late braking, they run
// people and zombies over and crash. Crashes become sliding, spinning wrecks
// that can catch fire. Parked cars are static.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANE, RW } from './city.js';
import { rng } from './textures.js';
import { CAR_TYPES, TRAFFIC_MIX, cruiserGeometry, VEHICLES } from './vehicles.js';

const IN = RW / 2;        // lanes stop this far before an intersection centre
const ACC = 3.5, BRAKE = 8, BRAKE_PANIC = 4.5;
const LEN = 4.3, HALF_L = 2.2, HALF_W = 0.95;
const CELL = 10;
const DRIVE = 0, WRECK = 1, REST = 2, PARKED = 3, EXT = 4, AIR = 5, FLOAT = 6; // FLOAT: adrift in flood water
export const CAR_MODE = { DRIVE, WRECK, REST, PARKED, EXT, AIR };
const MISSION_CAP = 72; // emergency vehicles out at once (Sean: as many police cars as the points will buy)
const MISSION_KINDS = { police: { geo: () => cruiserGeometry(), cap: 48, cruise: 14 }, fire: { geo: () => VEHICLES.fire_truck.build(), cap: 14, cruise: 11 }, apc: { geo: () => VEHICLES.stryker.build(), cap: 6, cruise: 12, tough: true }, bus: { geo: () => VEHICLES.bus.build(), cap: 8, cruise: 10 },
  chaser: { geo: () => VEHICLES.storm_chaser.build(), cap: 6, cruise: 15 }, tank: { geo: () => VEHICLES.abrams.build(), cap: 6, cruise: 9, tough: true },
  build: { geo: () => VEHICLES.crane_truck.build(), cap: 8, cruise: 10 }, hazmat: { geo: () => VEHICLES.hazmat_truck.build(), cap: 4, cruise: 11 }, medic: { geo: () => VEHICLES.ambulance.build(), cap: 6, cruise: 13 }, jail: { geo: () => VEHICLES.police_bus.build(), cap: 4, cruise: 11 } };
const tough = (car) => car.kind === 'apc' || car.kind === 'tank' || car.kind === 'build' || car.kind === 'hazmat'; // drive through traffic and wrecks, park right at the crossing
const STOPLINE = 3.4; // car centre stops this far before the lane end
const HALF_LEN = { police: 2.4, fire: 5.2, apc: 3.8, bus: 6, chaser: 3, tank: 4.6, build: 5.6, hazmat: 4.2, medic: 3.2, jail: 6 }; // half a rescue vehicle's length, for parking in a line

const CAR_COLS = ['#f2efe8', '#f2efe8', '#f2efe8', '#e8e6e0', '#b8b8b4', '#9a9a98', '#2a2a2c', '#8c2a22', '#2f4566', '#d8c9a8', '#e0b030', '#5b6b4a'];

export class Traffic {
  constructor(city, parent, opts = {}) {
    this.opts = opts; this.city = city;
    this.people = null; this.fire = null;
    const { sx, sz } = city;
    const NX = sx.length, NZ = sz.length;
    this.nodes = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const nb = [];
      if (i > 0) nb.push((i - 1) * NZ + j);
      if (i < NX - 1) nb.push((i + 1) * NZ + j);
      if (j > 0) nb.push(i * NZ + j - 1);
      if (j < NZ - 1) nb.push(i * NZ + j + 1);
      this.nodes.push({ id: this.nodes.length, x: sx[i], z: sz[j], nb, occ: -1, inset: IN });
    }
    const L = city.layout;
    if (L) {
      this.nodes.forEach((n, a) => { n.nb = n.nb.filter(b => !L.removed.has(a < b ? a + '-' + b : b + '-' + a)); });
      for (const sg of L.diags) { this.nodes[sg.a].nb.push(sg.b); this.nodes[sg.b].nb.push(sg.a); this.nodes[sg.a].inset = this.nodes[sg.b].inset = IN + 5; }
      for (const rd of L.rounds) { const n = this.nodes[rd.id]; n.round = rd; n.inset = rd.ro + 1.5; }
    }
    const B = city.bounds;
    this.gx0 = B.x0 - 20; this.gz0 = B.z0 - 20;
    this.gw = Math.ceil((B.x1 - B.x0 + 40) / CELL) + 1; this.gh = Math.ceil((B.z1 - B.z0 + 40) / CELL) + 1;
    this.head = new Int32Array(this.gw * this.gh).fill(-1); // empty: zeros would point every cell at car 0 forever (Bayview froze on its first errand)

    const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    this.nCars = opts.cars ?? 260;
    this.next = new Int32Array(this.nCars + MISSION_CAP);
    this.typeMeshes = {};
    for (const t of TRAFFIC_MIX) {
      const im = new THREE.InstancedMesh(CAR_TYPES[t.id].build(), carMat, this.nCars);
      im.count = 0; im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
      this.typeMeshes[t.id] = im; parent.add(im);
    }
    // mission vehicles (police cruisers, fire trucks), one mesh per kind
    this.missionMeshes = {}; this.missionMats = {};
    for (const [kind, def] of Object.entries(MISSION_KINDS)) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1, emissive: '#000000' });
      const im = new THREE.InstancedMesh(def.geo(), mat, def.cap);
      im.count = 0; im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
      this.missionMeshes[kind] = im; this.missionMats[kind] = mat; parent.add(im);
    }

    // parked cars (static), a mix of types
    const r = rng(1234);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const pk = city.parked;
    const byType = {}; for (const t of TRAFFIC_MIX) byType[t.id] = [];
    this.parkedList = []; this.parkedMeshes = [];
    for (const c of pk) byType[this.rollType(r)].push(c);
    for (const t of TRAFFIC_MIX) {
      const list = byType[t.id];
      const im = new THREE.InstancedMesh(this.typeMeshes[t.id].geometry, carMat, Math.max(1, list.length));
      list.forEach((c, k) => {
        e.set(0, c.rot, 0); q.setFromEuler(e);
        m4.compose(p.set(c.x, c.y, c.z), q, one);
        im.setMatrixAt(k, m4);
        const hex = t.id === 'taxi' ? '#f2c300' : CAR_COLS[Math.floor(r() * CAR_COLS.length)];
        im.setColorAt(k, col.set(hex));
        this.parkedList.push({ im, k, type: t.id, x: c.x, z: c.z, rot: c.rot, hex, alive: true });
      });
      im.count = list.length; im.castShadow = im.receiveShadow = true; im.computeBoundingSphere();
      im.userData.orig = im.instanceMatrix.array.slice(); im.userData.origCol = im.instanceColor ? im.instanceColor.array.slice() : null; this.parkedMeshes.push(im);
      parent.add(im);
    }

    // their shadows: a block per car in the shadow map instead of the whole car (cars were a third of the shadow pass), on
    // the shadow-only layer and moving with it (the same instance matrices; the count matched as the shadow is drawn)
    const shMat = new THREE.MeshBasicMaterial(), blocks = new Map();
    for (const im of [...Object.values(this.typeMeshes), ...Object.values(this.missionMeshes), ...this.parkedMeshes]) {
      let bg = blocks.get(im.geometry);
      if (!bg) { im.geometry.computeBoundingBox(); const bb = im.geometry.boundingBox, sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()); bg = new THREE.BoxGeometry(sz.x, sz.y * 0.9, sz.z * 0.92).translate(c.x, c.y - sz.y * 0.05, c.z); blocks.set(im.geometry, bg); }
      const sh = new THREE.InstancedMesh(bg, shMat, im.instanceMatrix.count); sh.instanceMatrix = im.instanceMatrix; sh.count = im.count;
      sh.castShadow = true; sh.receiveShadow = false; sh.layers.set(1); sh.frustumCulled = im.frustumCulled; sh.boundingSphere = im.boundingSphere;
      sh.onBeforeShadow = () => { sh.count = im.count; }; im.castShadow = false; parent.add(sh);
    }
    // zoomed out (lod): each car a body and a cabin block in its own colour with dark glass, 24 triangles instead of ~400
    const low = new Map(), lowCar = (geo) => {
      geo.computeBoundingBox(); const bb = geo.boundingBox, s = bb.getSize(new THREE.Vector3()), y0 = bb.min.y, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      const tall = s.y > 2.4, paint = (g, v) => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
      const body = paint(new THREE.BoxGeometry(s.x, s.y * (tall ? 0.62 : 0.42), s.z).translate(cx, y0 + s.y * (tall ? 0.39 : 0.33), cz), 1);
      const cab = paint(new THREE.BoxGeometry(s.x * (tall ? 0.96 : 0.5), s.y * (tall ? 0.3 : 0.36), s.z * 0.88).translate(cx - (tall ? 0 : s.x * 0.06), y0 + s.y * (tall ? 0.84 : 0.72), cz), 0.32);
      cab.attributes.color.array.fill(1, 24, 36); // its roof in the car's colour, glass round the sides
      const g = mergeGeometries([body, cab]); g.computeBoundingSphere(); return g;
    };
    this.lodMeshes = [...Object.values(this.typeMeshes), ...this.parkedMeshes];
    for (const im of this.lodMeshes) { let g = low.get(im.geometry); if (!g) low.set(im.geometry, (g = lowCar(im.geometry))); im.userData.geoNear = im.geometry; im.userData.geoFar = g; }
    this._m4 = m4; this._q = q; this._e = e; this._p = p; this._one = one; this._c = col;
    this.reset();
  }

  // parked cars within R (alive ones); take() hides one
  parkedNear(x, z, R) { const out = []; for (const pc of this.parkedList) if (pc.alive && Math.abs(pc.x - x) < R && Math.abs(pc.z - z) < R && Math.hypot(pc.x - x, pc.z - z) < R) out.push(pc); return out; }
  takeParked(pc) { pc.alive = false; this._zero = this._zero || new THREE.Matrix4().makeScale(0, 0, 0); pc.im.setMatrixAt(pc.k, this._zero); pc.im.instanceMatrix.needsUpdate = true; }
  // someone running from danger takes a parked car: it pulls out from where it stood and races off away from (fx, fz)
  // (a moving car of the same model, from well away where nobody is looking, takes its place on the street)
  hotwire(pc, fx, fz) {
    if (!pc.alive) return null;
    let car = null, far = 150;
    for (const c of this.cars) { if (c.mission || c.gone || c.mode !== DRIVE || c.type !== pc.type || c.frozen || c.webbed) continue; const d = Math.hypot(c.x - pc.x, c.z - pc.z); if (d > far) { far = d; car = c; } }
    if (!car) return null;
    let best = 14, sa = -1, sb = -1, st = 0; // the street it is parked on
    this.nodes.forEach((A, a) => { for (const b of A.nb) { const B = this.nodes[b], dx = B.x - A.x, dz = B.z - A.z, L2 = dx * dx + dz * dz; const t = Math.max(0.15, Math.min(0.85, ((pc.x - A.x) * dx + (pc.z - A.z) * dz) / L2)); const d = Math.hypot(A.x + dx * t - pc.x, A.z + dz * t - pc.z); if (d < best) { best = d; sa = a; sb = b; st = t; } } });
    if (sa < 0) return null;
    const A = this.nodes[sa], B = this.nodes[sb];
    if ((B.x - A.x) * (fx - pc.x) + (B.z - A.z) * (fz - pc.z) > 0) { const k = sa; sa = sb; sb = k; st = 1 - st; } // pull away from the danger
    const node = this.nodes[car.b]; if (node) this.release(node, car); if (car.clearing >= 0) { this.release(this.nodes[car.clearing], car); car.clearing = -1; }
    this.takeParked(pc);
    this.startSeg(car, sa, sb); car.s = Math.max(0, Math.min(car.len - 1, st * Math.hypot(B.x - A.x, B.z - A.z) - this.nodes[sa].inset));
    car.v = 6; car.resume = -1; car.blocked = 0; car.panic = 0; car.zx = fx; car.zz = fz; car.colHex = pc.hex; car.burning = false; // away at once, but still braking for people in the road (a panicked driver does not)
    this.tint(car, pc.hex); this.pose(car);
    return car;
  }
  burnParked(pc) { pc.im.setColorAt(pc.k, this._c.set('#1a1714')); pc.im.instanceColor.needsUpdate = true; pc.burnt = true; }
  geometryOf(type) { const im = this.typeMeshes[type]; return im.userData.geoNear || im.geometry; } // the whole car (not the far-off block)

  // ---------- disasters: cars can be taken over (tornado, wave), thrown, and stalled by flood water
  grab(car) {
    if (car.gone || car.mode === EXT || car.mode === AIR) return false;
    const node = this.nodes[car.b]; if (node) this.release(node, car);
    if (car.mission && (car.mode === DRIVE || car.mode === PARKED)) { if (car.onLost) car.onLost(car); }
    car.mode = EXT; car.v = 0; car.leaving = false;
    return true;
  }
  fling(car, vx, vy, vz) {
    if (car.mode !== EXT && !this.grab(car)) return;
    car.mode = AIR; car.vx = vx; car.vy = vy; car.vz = vz; car.w = (this.r() - 0.5) * 6; car.rw = (this.r() - 0.5) * 8; car.pw = (this.r() - 0.5) * 6;
  }
  airStep(car, h) {
    if (this.slowAt) h *= this.slowAt(car.x, car.y, car.z); // a time bubble
    car.vy -= 9.8 * h; car.x += car.vx * h; car.y += car.vy * h; car.z += car.vz * h;
    car.yaw += car.w * h; car.roll += car.rw * h; car.pitch += car.pw * h;
    const w = this.waterAt ? this.waterAt(car.x, car.z) : -99, gy = this.groundAt ? this.groundAt(car.x, car.z) : 0;
    if (car.y > Math.max(gy, w > 0.5 ? w - 0.8 : -99)) return;
    car.y = Math.max(gy, w > 0.5 ? w - 0.9 : gy);
    car.mode = REST; car.vx = car.vz = car.vy = 0; car.v = 0;
    if (gy < -1) car.pitch = Math.max(-1.4, Math.min(1.4, car.pitch)); // nose first at the bottom of a pit
    else { car.roll = this.r() < 0.45 ? Math.PI : 0; car.pitch = (this.r() - 0.5) * 0.2; }
    if (!car.mission) this.tint(car, '#2a2622');
    if (this.people && !car.soft) this.people.crushNear(car.x, car.z, 2.6); // soft: thrown by a super villain, people get out of the way
    if (this.fire && this.r() < 0.35) { this.fire.carFire(car.x, car.z); car.burning = true; if (!car.mission) this.tint(car, '#1a1714'); }
    this.events.push({ type: 'carland', x: car.x, z: car.z, car });
  }
  // over the edge of a pit: it keeps its speed and the nose drops as it falls
  driveOff(car) {
    const v = Math.max(car.v, 4), hx = car.hx, hz = car.hz;
    if (!this.grab(car)) return;
    car.mode = AIR; car.vx = hx * v; car.vz = hz * v; car.vy = 0.4; car.w = (this.r() - 0.5) * 0.3; car.rw = (this.r() - 0.5) * 0.5; car.pw = -0.9 - this.r() * 0.5;
  }
  // a cold front: the car freezes where it stands under a coat of frost (the people inside wait it out)
  freezeCar(car) {
    if (car.frozen || car.gone || car.mode !== DRIVE || car.mission) return false;
    car.frozen = true; car.v = 0;
    if (!car.burning) { this._c.set(car.colHex).lerp(this._ice || (this._ice = new THREE.Color('#eef4f9')), 0.85); this.tint(car, '#' + this._c.getHexString()); }
    return true;
  }
  frostParked(pc) { if (!pc.alive || pc.burnt || pc.frost) return; pc.frost = true; pc.im.setColorAt(pc.k, this._c.set(pc.hex).lerp(this._ice || (this._ice = new THREE.Color('#eef4f9')), 0.85)); pc.im.instanceColor.needsUpdate = true; }
  // the thaw: frost melts off and everyone drives on
  thawAll() {
    for (const car of this.cars) if (car.frozen) { car.frozen = false; car.blocked = 0; if (!car.burning && car.mode === DRIVE) this.tint(car, car.colHex); }
    for (const pc of this.parkedList) if (pc.frost) { pc.frost = false; if (pc.alive && !pc.burnt) { pc.im.setColorAt(pc.k, this._c.set(pc.hex)); pc.im.instanceColor.needsUpdate = true; } }
  }
  burn(car) { // molotov or laser on a moving car
    if (car.mode === DRIVE) this.crash(car, null, 9);
    car.ignite = true;
    if (car.mode === REST && !car.burning) { this.fire && this.fire.carFire(car.x, car.z); car.burning = true; if (!car.mission) this.tint(car, '#1a1714'); }
  }

  rollType(r) {
    let t = r(); for (const m of TRAFFIC_MIX) { if ((t -= m.w) <= 0) return m.id; }
    return 'sedan';
  }

  tint(car, hex) {
    const im = car.mission ? null : this.typeMeshes[car.type];
    if (!im) return;
    im.setColorAt(car.slot, this._c.set(hex)); im.instanceColor.needsUpdate = true;
  }

  lod(far) { for (const im of this.lodMeshes) im.geometry = far ? im.userData.geoFar : im.userData.geoNear; }
  reset() {
    this.head.fill(-1); // nobody in the hash until the next step builds it
    const r = this.r = rng(this.opts.seed ?? 99);
    for (const n of this.nodes) n.occ = -1;
    this.cars = [];
    const counts = {}; for (const t of TRAFFIC_MIX) counts[t.id] = 0;
    for (let k = 0; k < this.nCars; k++) {
      const a = Math.floor(r() * this.nodes.length);
      const nb = this.nodes[a].nb, b = nb[Math.floor(r() * nb.length)];
      const car = { id: k, mode: DRIVE, cruise: 8 + r() * 2.5, v: 0, panic: 0, think: r() * 0.5, pedGap: 99, blocked: 0, resume: -1,
        x: 0, z: 0, y: 0, roll: 0, pitch: 0, hx: 1, hz: 0, yaw: 0, vx: 0, vz: 0, vy: 0, w: 0, ignite: false, burning: false, hits: 0, zx: 0, zz: 0,
        colHex: CAR_COLS[Math.floor(r() * CAR_COLS.length)] };
      car.type = this.rollType(r); car.slot = counts[car.type]++;
      if (car.type === 'taxi') car.colHex = '#f2c300';
      // spawn spaced out from every car already placed
      for (let tries = 0; tries < 30; tries++) {
        const a2 = tries === 0 ? a : Math.floor(r() * this.nodes.length);
        const nb2 = this.nodes[a2].nb, b2 = tries === 0 ? b : nb2[Math.floor(r() * nb2.length)];
        this.startSeg(car, a2, b2);
        car.s = 2 + r() * Math.max(0, car.len - STOPLINE - 4);
        this.pose(car);
        if (!this.cars.some(o => Math.hypot(o.x - car.x, o.z - car.z) < 10)) break;
      }
      car.v = car.cruise;
      this.cars.push(car);
      this.typeMeshes[car.type].setColorAt(car.slot, this._c.set(car.colHex));
    }
    this.speedK = 1; this.gripK = 1; this.waterAt = null; this.closed = new Set();
    for (const pc of this.parkedList || []) { pc.alive = true; pc.burnt = false; pc.frost = false; }
    for (const im of this.parkedMeshes || []) { im.instanceMatrix.array.set(im.userData.orig); im.instanceMatrix.needsUpdate = true; if (im.userData.origCol) { im.instanceColor.array.set(im.userData.origCol); im.instanceColor.needsUpdate = true; } }
    for (const t of TRAFFIC_MIX) { const im = this.typeMeshes[t.id]; im.count = counts[t.id]; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.missions = []; for (const im of Object.values(this.missionMeshes)) im.count = 0;
    this.events = [];
    this.stats = { crashes: 0, wrecks: 0 };
    this.sync(0);
  }

  // ---------- paths
  startSeg(car, a, b) {
    const A = this.nodes[a], Bn = this.nodes[b];
    let dx = Bn.x - A.x, dz = Bn.z - A.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    car.a = a; car.b = b; car.dx = dx; car.dz = dz;
    car.p0x = A.x + dx * A.inset - dz * LANE; car.p0z = A.z + dz * A.inset + dx * LANE;
    car.len = L - A.inset - Bn.inset; car.s = 0; car.turn = false; car.held = false; car.poly = null; car.plan = null;
  }

  // which way to leave the junction ahead
  pickNext(car) {
    const Bn = this.nodes[car.b];
    const opts = Bn.nb.filter(n => n !== car.a && !this.isClosed(car.b, n));
    let c;
    if (car.mission) c = car.route[car.ri + 2];
    else if (!opts.length) c = car.a;
    else if (car.panic > 0) {
      // drive away from the zombies
      let best = -1e9;
      for (const o of opts) {
        const C = this.nodes[o];
        const sc = (C.x - Bn.x) * (Bn.x - car.zx) + (C.z - Bn.z) * (Bn.z - car.zz) + this.r() * 40;
        if (sc > best) { best = sc; c = o; }
      }
    } else {
      // most drivers carry straight on
      const ahead = opts.find(o => { const C = this.nodes[o], L = Math.hypot(C.x - Bn.x, C.z - Bn.z); return ((C.x - Bn.x) * car.dx + (C.z - Bn.z) * car.dz) / L > 0.9; });
      c = ahead != null && this.r() < 0.6 ? ahead : opts[Math.floor(this.r() * opts.length)];
    }
    return c;
  }
  isClosed(a, b) { return this.closed.size > 0 && this.closed.has(a < b ? a + '-' + b : b + '-' + a); }
  // close every road that passes within R of (x, z)
  closeNear(x, z, R) {
    this.nodes.forEach((A, a) => { for (const b of A.nb) { if (b < a) continue; const Bn = this.nodes[b], dx = Bn.x - A.x, dz = Bn.z - A.z, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / L2)); if (Math.hypot(A.x + dx * t - x, A.z + dz * t - z) < R) this.closed.add(a + '-' + b); } });
  }
  // leave a junction
  release(node, car) { if (node.occ === car.id) node.occ = -1; }
  // room to get out the other side? (don't block the box)
  exitClear(b, c) {
    if (c == null) return true;
    for (const o of this.cars) if (o.mode === DRIVE && o.a === b && o.b === c && !o.turn && o.s < 9 && o.v < 2) return false;
    return true;
  }

  startTurn(car) {
    const Bn = this.nodes[car.b];
    const c = car.plan ?? this.pickNext(car); car.plan = null;
    const C = this.nodes[c];
    let ex = C.x - Bn.x, ez = C.z - Bn.z; const L = Math.hypot(ex, ez); ex /= L; ez /= L;
    const rx = -car.dz, rz = car.dx, r2x = -ez, r2z = ex;
    const q0x = car.p0x + car.dx * car.len, q0z = car.p0z + car.dz * car.len;
    const q2x = Bn.x + ex * Bn.inset + r2x * LANE, q2z = Bn.z + ez * Bn.inset + r2z * LANE;
    if (Bn.round) { this.roundTurn(car, Bn, q0x, q0z, q2x, q2z, c); return; }
    const dot = car.dx * ex + car.dz * ez;
    let cx, cz;
    if (dot > 0.5) { cx = (q0x + q2x) / 2; cz = (q0z + q2z) / 2; }
    else if (dot < -0.5) { cx = Bn.x + car.dx * 2; cz = Bn.z + car.dz * 2; }
    else { cx = Bn.x + (rx + r2x) * LANE; cz = Bn.z + (rz + r2z) * LANE; }
    car.q = [q0x, q0z, cx, cz, q2x, q2z];
    car.tlen = (Math.hypot(cx - q0x, cz - q0z) + Math.hypot(q2x - cx, q2z - cz) + Math.hypot(q2x - q0x, q2z - q0z)) / 2;
    car.next = c; car.turn = true; car.t = 0; car.resume = -1;
    if (Bn.occ < 0) Bn.occ = car.id;
    car.held = false;
  }

  // around a roundabout: in, round the ring with the island on the driver's left, out
  roundTurn(car, Bn, q0x, q0z, q2x, q2z, c) {
    const R = Bn.round.rc, a0 = Math.atan2(q0z - Bn.z, q0x - Bn.x) - 0.3, a1 = Math.atan2(q2z - Bn.z, q2x - Bn.x) + 0.3;
    let span = a0 - a1; span = ((span % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (span < 0.25) span += Math.PI * 2;
    const pts = [q0x, q0z], n = Math.max(3, Math.ceil(span / 0.18));
    for (let k = 0; k <= n; k++) { const a = a0 - span * k / n; pts.push(Bn.x + Math.cos(a) * R, Bn.z + Math.sin(a) * R); }
    pts.push(q2x, q2z);
    const cum = [0]; for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
    car.poly = pts; car.pcum = cum; car.tlen = cum[cum.length - 1];
    car.next = c; car.turn = true; car.t = 0; car.resume = -1;
    if (Bn.occ < 0) Bn.occ = car.id;
    car.held = false;
  }

  oppositeClear(car) {
    let ok = true;
    this.near(car.x, car.z, 35, (o) => {
      if (o === car || o.mode !== DRIVE) return;
      if (o.hx * car.hx + o.hz * car.hz < 0.3 && Math.hypot(o.x - car.x, o.z - car.z) < 35) ok = false;
    });
    return ok;
  }

  // drivers who see an attack floor it
  panicNear(x, z, R) {
    this.near(x, z, R, (o) => { if (o.mode === DRIVE && Math.hypot(o.x - x, o.z - z) < R) { o.panic = 25; o.zx = x; o.zz = z; } });
  }

  // turn around in place onto the opposite lane (used when stuck)
  uturn(car) {
    const cx = car.x, cz = car.z, odx = car.dx, odz = car.dz, sOld = car.s;
    this.release(this.nodes[car.b], car);
    this.startSeg(car, car.b, car.a);
    const sNew = Math.min(car.len, Math.max(0, car.len - sOld));
    const tx = car.p0x + car.dx * sNew, tz = car.p0z + car.dz * sNew;
    car.q = [cx, cz, cx + odx * 3 + (tx - cx) * 0.5, cz + odz * 3 + (tz - cz) * 0.5, tx, tz];
    car.tlen = 8; car.turn = true; car.t = 0; car.resume = sNew; car.blocked = 0; car.poly = null;
  }

  pose(car) {
    if (!car.turn) {
      car.x = car.p0x + car.dx * car.s; car.z = car.p0z + car.dz * car.s; car.hx = car.dx; car.hz = car.dz;
    } else if (car.poly) {
      const P = car.poly, C = car.pcum, d = Math.min(1, car.t) * car.tlen;
      let k = 1; while (k < C.length - 1 && C[k] < d) k++;
      const f = (d - C[k - 1]) / Math.max(1e-6, C[k] - C[k - 1]), ax = P[(k - 1) * 2], az = P[(k - 1) * 2 + 1], bx = P[k * 2], bz = P[k * 2 + 1];
      car.x = ax + (bx - ax) * f; car.z = az + (bz - az) * f;
      const n = Math.hypot(bx - ax, bz - az) || 1; car.hx = (bx - ax) / n; car.hz = (bz - az) / n;
    } else {
      const t = Math.min(1, car.t), u = 1 - t, Q = car.q;
      car.x = u * u * Q[0] + 2 * u * t * Q[2] + t * t * Q[4];
      car.z = u * u * Q[1] + 2 * u * t * Q[3] + t * t * Q[5];
      const hx = 2 * u * (Q[2] - Q[0]) + 2 * t * (Q[4] - Q[2]), hz = 2 * u * (Q[3] - Q[1]) + 2 * t * (Q[5] - Q[3]);
      const n = Math.hypot(hx, hz) || 1; car.hx = hx / n; car.hz = hz / n;
    }
    car.yaw = Math.atan2(-car.hz, car.hx);
  }

  advance(car, d) {
    if (!car.turn) {
      const before = car.s;
      car.s += d;
      if (car.clearing >= 0 && car.s > HALF_L + 1.5) { this.release(this.nodes[car.clearing], car); car.clearing = -1; } // our tail is out of the last junction
      const node = this.nodes[car.b];
      if (node.occ >= 0) { const o = this.cars[node.occ]; if (!o || o.mode !== DRIVE || ((o.b !== car.b || !(o.held || o.turn)) && o.clearing !== car.b)) this.release(node, o || { id: node.occ }); }
      if (car.s >= car.len - STOPLINE && !car.held) {
        if (!car.mission && car.panic <= 0 && this.sirenNear(node)) { car.s = Math.max(before, car.len - STOPLINE); car.v = 0; return; }
        if (car.panic <= 0) {
          if (car.plan == null) car.plan = this.pickNext(car);
          if (!this.exitClear(car.b, car.plan)) { car.s = Math.max(before, car.len - STOPLINE); car.v = 0; return; }
        }
        if (node.occ < 0) { node.occ = car.id; car.held = true; }
        else if (node.occ === car.id) car.held = true;
        else if (car.panic <= 0 && !car.mission) { car.s = Math.max(before, car.len - STOPLINE); car.v = 0; return; }
      }
      if (car.mission && car.leaving && car.ri + 2 >= car.route.length && car.s >= car.len - 2) { this.remove(car); if (car.onGone) car.onGone(car); return; }
      if (car.mission && !car.leaving && car.ri + 2 >= car.route.length && car.s >= this.stopAt(car)) { car.s = this.stopAt(car); this.park(car); return; }
      if (car.mission && !car.leaving && tough(car) && car.ri + 2 >= car.route.length && car.s >= car.len - 1) { car.s = car.len - 1; this.park(car); return; }
      if (car.s >= car.len) {
        const over = car.s - car.len; this.startTurn(car); car.t = over / car.tlen;
      }
    } else {
      car.t += d / car.tlen;
      if (car.t >= 1) {
        const over = (car.t - 1) * car.tlen;
        if (car.resume >= 0) { car.turn = false; car.s = car.resume + over; car.resume = -1; }
        else {
          const from = car.b; // keep the junction until the tail has cleared it (a car stopped half out of the box used to get T-boned)
          if (car.mission) car.ri++;
          this.startSeg(car, car.b, car.next); car.s = over; car.clearing = from;
        }
      }
    }
  }

  sirenNear(node) {
    for (const m of this.missions) if (m.mode === DRIVE && Math.hypot(m.x - node.x, m.z - node.z) < 22) return true;
    return false;
  }

  // ---------- spatial hash of cars
  buildHash() {
    this.head.fill(-1);
    for (const c of this.cars) {
      const i = Math.floor((c.x - this.gx0) / CELL), j = Math.floor((c.z - this.gz0) / CELL);
      if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) { this.next[c.id] = -1; continue; }
      const k = j * this.gw + i; this.next[c.id] = this.head[k]; this.head[k] = c.id;
    }
  }
  near(x, z, R, fn) {
    const c0 = Math.max(0, Math.floor((x - R - this.gx0) / CELL)), c1 = Math.min(this.gw - 1, Math.floor((x + R - this.gx0) / CELL));
    const r0 = Math.max(0, Math.floor((z - R - this.gz0) / CELL)), r1 = Math.min(this.gh - 1, Math.floor((z + R - this.gz0) / CELL));
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) for (let k = this.head[j * this.gw + i]; k >= 0; k = this.next[k]) fn(this.cars[k]);
  }

  // distance to the nearest car or wreck ahead in our lane (bumper to bumper)
  gapAhead(car, look) {
    let gap = 99;
    this.near(car.x, car.z, look, (o) => {
      if (o === car) return;
      // in a junction only cars in the same junction or on the way out count (not the queues at the other entries)
      if (car.turn && o.mode === DRIVE && !(o.turn && o.b === car.b) && !(!o.turn && o.a === car.b)) return;
      const dx = o.x - car.x, dz = o.z - car.z;
      const lx = dx * car.hx + dz * car.hz, lz = -dx * car.hz + dz * car.hx;
      const wide = o.mode === DRIVE ? 1.8 : 3.2;
      if (lx > 0 && lx < look && Math.abs(lz) < wide) gap = Math.min(gap, lx - (o.mode === DRIVE ? LEN : 3.2));
    });
    return gap;
  }

  // ---------- simulation
  step(h) {
    const P = this.people;
    this.buildHash();
    for (const car of this.cars) {
      if (car.mode === DRIVE) this.driveStep(car, h, P);
      else if (car.mode === AIR) this.airStep(car, h);
      else if (car.mode === WRECK) this.wreckStep(car, h, P);
      else if (car.mode === FLOAT) this.floatStep(car, h);
    }
    // water deep enough to lift a car: stalled, wrecked and abandoned cars float off (not the emergency vehicles)
    if (this.waterAt && (this.floatT = (this.floatT || 0) - h) <= 0) {
      this.floatT = 0.5;
      for (const car of this.cars) {
        if (car.mission || car.gone || tough(car) || (car.mode !== DRIVE && car.mode !== REST && car.mode !== WRECK)) continue;
        if (this.waterAt(car.x, car.z) - (this.groundAt ? this.groundAt(car.x, car.z) : 0) > 1.1 && this.grab(car)) { car.mode = FLOAT; car.vx = car.vx || 0; car.vz = car.vz || 0; car.w = (this.r() - 0.5) * 0.5; car.ft = this.r() * 9; }
      }
    }
    this.collisions(P);
  }

  // adrift: it turns slowly and bobs on the flood's eddies (and a whirlpool's pull: flowAt), knocking off walls; aground again where the water is shallow
  floatStep(car, h) {
    const w = this.waterAt ? this.waterAt(car.x, car.z) : -99, gy = this.groundAt ? this.groundAt(car.x, car.z) : 0;
    if (w - gy < 0.7) { car.mode = REST; car.y = gy; car.vx = car.vz = 0; car.roll = 0; car.pitch = 0; return; }
    car.ft += h;
    const f = this.flowAt ? this.flowAt(car.x, car.z) : null;
    if (f && f[2]) { if (f[2](car)) return; } // swallowed by a whirlpool
    const ex = Math.sin(car.z * 0.013 + car.ft * 0.05 + car.id) * 0.7, ez = Math.cos(car.x * 0.011 + car.ft * 0.04 + car.id * 1.7) * 0.7; // the flood's slow eddies
    if (f) { const k = Math.min(1, h * 1.2); car.vx += (f[0] * 5 - car.vx) * k; car.vz += (f[1] * 5 - car.vz) * k; } // carried round with the swirl (it would otherwise orbit like a moon)
    else { car.vx += ex * h; car.vz += ez * h; const k = Math.exp(-0.4 * h); car.vx *= k; car.vz *= k; }
    const nx = car.x + car.vx * h, nz = car.z + car.vz * h;
    if (this.people && !(f && f[4]) && !this.people.walkable(nx, nz)) { car.vx *= -0.4; car.vz *= -0.4; car.w = -car.w; } else { car.x = nx; car.z = nz; } // a wall: it knocks off it and turns
    car.yaw += (car.w + (f ? Math.hypot(f[0], f[1]) * 0.05 : 0)) * h;
    car.y += (w - 0.95 + Math.sin(car.ft * 1.6 + car.id) * 0.12 - car.y) * Math.min(1, h * 3);
    car.roll = Math.sin(car.ft * 1.3 + car.id) * 0.09; car.pitch = Math.cos(car.ft * 1.1 + car.id * 0.7) * 0.06;
  }

  driveStep(car, h, P) {
    if (car.grace > 0) car.grace -= h;
    if (this.waterAt && !tough(car) && this.waterAt(car.x, car.z) > 0.55) { car.v = 0; car.stalled = true; return; } // stalled in flood water
    car.stalled = false;
    if (car.frozen) { car.v = 0; return; } // iced in until the thaw
    // zombies nearby? panic. Pedestrians ahead? (calm drivers only)
    if ((car.think -= h) <= 0) {
      car.think = 0.25 + this.r() * 0.15;
      if (P) {
        let zd = 1e9, zn = 0;
        P.around(car.x, car.z, 22, (j, d2) => { if (P.st[j] === 6) { zn++; if (d2 < zd) { zd = d2; car.zx = P.x[j]; car.zz = P.z[j]; } } });
        if (zn >= 2 && !car.mission) car.panic = 25;
        car.pedGap = 99;
        if (car.panic <= 0) {
          P.around(car.x + car.hx * 5, car.z + car.hz * 5, 6, (j) => {
            if (!P.hittable(j) || (car.mission && P.st[j] === 6) || tough(car)) return;
            const dx = P.x[j] - car.x, dz = P.z[j] - car.z;
            const lx = dx * car.hx + dz * car.hz, lz = -dx * car.hz + dz * car.hx;
            if (lx > 1 && lx < 11 && Math.abs(lz) < 1.5) car.pedGap = Math.min(car.pedGap, lx - HALF_L);
          });
        }
      }
    }
    if (car.panic > 0) car.panic -= h;
    const panic = car.panic > 0;
    let vDes = (panic ? car.cruise * 1.6 : car.cruise) * this.speedK;
    const brake = (panic ? BRAKE_PANIC : BRAKE) * this.gripK;
    if (car.resume < 0) {
      const gap = this.gapAhead(car, panic ? 12 : 20);
      const stop = panic ? 0.6 : 2.5;
      if (gap < 99) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * brake * (gap - stop))));
      if (!panic && car.pedGap < 99) {
        if ((car.pedWait || 0) < 3) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * BRAKE * (car.pedGap - 1.5))));
        else vDes = Math.min(vDes, 1.6); // after a wait, edge through the crowd (they step aside, see collisions)
      }
      if (!panic && !car.turn && !car.mission) {
        const node = this.nodes[car.b], toEnd = car.len - car.s;
        if (!car.held && toEnd < 18) {
          // brake for the line if we will have to wait there (instead of stopping dead and being rear-ended)
          if (car.plan == null) car.plan = this.pickNext(car);
          if ((node.occ >= 0 && node.occ !== car.id) || this.sirenNear(node) || !this.exitClear(car.b, car.plan)) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * BRAKE * (toEnd - STOPLINE))));
        }
      }
      if (car.mission && !car.turn) {
        // ease through a busy crossing
        const node = this.nodes[car.b], toEnd = car.len - car.s;
        if (toEnd < 14) { let busy = false; this.near(node.x, node.z, 16, (o) => { if (o !== car && o.mode === DRIVE && o.v > 1 && Math.hypot(o.x - node.x, o.z - node.z) < 16) busy = true; }); if (busy) vDes = Math.min(vDes, 6); }
      }
    } else vDes = 3;
    if (car.v < vDes) car.v = Math.min(vDes, car.v + ACC * (panic ? 1.6 : 1) * h);
    else car.v = Math.max(vDes, car.v - brake * h);
    this.advance(car, car.v * h);
    this.pose(car);
    if (car.v < 0.3) car.blocked += h; else car.blocked = 0;
    car.pedWait = car.pedGap < 99 && car.v < 2 ? (car.pedWait || 0) + h : Math.max(0, (car.pedWait || 0) - h * 2);
    if (car.mission && car.leaving && car.blocked > 8) { this.remove(car); if (car.onGone) car.onGone(car); return; } // held up on the way out of town: count it as gone so its place is free
    if (car.mission && car.blocked > 4 && !car.leaving) {
      const last = car.ri + 2 >= car.route.length;
      const dToStop = last && !car.turn ? Math.abs(this.stopAt(car) - car.s) : 99;
      if (dToStop < 30 || car.blocked > 15) { this.park(car); return; } // stuck in traffic: officers walk from here
    }
    if (car.blocked > 6 && !car.turn && !car.mission && car.s > 8 && car.s < car.len - 9 && this.oppositeClear(car)) this.uturn(car);
  }

  wreckStep(car, h, P) {
    const nx = car.x + car.vx * h, nz = car.z + car.vz * h;
    if (car.v > 1.5) for (const pc of this.parkedNear(nx, nz, 2.3)) { // into a parked car: it stops against it, and dents it
      car.vx *= -0.3; car.vz *= -0.3; car.w *= 0.5; this.events.push({ type: 'crash', x: pc.x, z: pc.z });
      if (!pc.dented) { pc.dented = true; pc.im.setColorAt(pc.k, this._c.set(pc.hex).multiplyScalar(0.55)); pc.im.instanceColor.needsUpdate = true; }
      return;
    }
    if (P && !P.walkable(nx, nz)) { car.vx *= -0.25; car.vz *= -0.25; car.w *= 0.5; }
    else { car.x = nx; car.z = nz; }
    car.yaw += car.w * h;
    const f = Math.exp(-2.4 * h); car.vx *= f; car.vz *= f; car.w *= Math.exp(-2.8 * h);
    car.hx = Math.cos(car.yaw); car.hz = -Math.sin(car.yaw);
    car.v = Math.hypot(car.vx, car.vz);
    if (car.v < 0.15 && Math.abs(car.w) < 0.08) {
      car.mode = REST; car.v = 0; car.vx = car.vz = car.w = 0;
      if (car.ignite && this.fire) {
        this.fire.carFire(car.x, car.z); car.burning = true;
        if (!car.mission) this.tint(car, '#1a1714');
        this.events.push({ type: 'carfire', x: car.x, z: car.z, car });
      }
    }
  }

  crash(car, other, impact) {
    const avx = car.hx * car.v, avz = car.hz * car.v;
    const bvx = other ? other.hx * other.v : 0, bvz = other ? other.hz * other.v : 0;
    for (const c of [car, other]) {
      if (!c || c.mode !== DRIVE) continue;
      c.mode = WRECK;
      this.release(this.nodes[c.b], c);
      c.ignite = this.r() < 0.28 + Math.min(0.35, impact / 40);
      if (c.mission) { if (c.onLost) c.onLost(c); }
      else { this._c.set(c.colHex).multiplyScalar(0.6); this.tint(c, '#' + this._c.getHexString()); }
      this.stats.wrecks++;
    }
    if (other) {
      let nx = car.x - other.x, nz = car.z - other.z; const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
      const mx = (avx + bvx) / 2, mz = (avz + bvz) / 2, k = impact * 0.35;
      if (car.mode === WRECK) { car.vx = mx + nx * k; car.vz = mz + nz * k; car.w = (this.r() - 0.5) * (2 + impact * 0.4); }
      if (other.mode === WRECK) { other.vx = mx - nx * k; other.vz = mz - nz * k; other.w = (this.r() - 0.5) * (2 + impact * 0.4); }
    } else if (car.mode === WRECK) {
      // lost control on its own, or hit a resting wreck
      car.vx = avx * 0.7 - car.hz * (this.r() - 0.5) * 6; car.vz = avz * 0.7 + car.hx * (this.r() - 0.5) * 6; car.w = (this.r() - 0.5) * 7;
    }
    this.stats.crashes++;
    this.events.push({ type: 'crash', x: car.x, z: car.z, car, other });
    if (this.people) this.people.scare(car.x, car.z, 16, 0.7);
    this.near(car.x, car.z, 18, (o) => { if (o.mode === DRIVE && Math.hypot(o.x - car.x, o.z - car.z) < 18) { o.panic = Math.max(o.panic, 10); o.zx = car.x; o.zz = car.z; } });
  }

  collisions(P) {
    for (const car of this.cars) {
      if (car.mode === REST || car.mode === PARKED || car.mode === EXT || car.mode === AIR || car.mode === FLOAT) continue;
      // run over anyone in the footprint
      if (P && car.mode === DRIVE && car.v > 0.2 && car.v <= 2) { // creeping through a crowd: people step out of the way
        P.around(car.x, car.z, 3.2, (j) => {
          if (!P.hittable(j) || P.st[j] === 6) return;
          const dx = P.x[j] - car.x, dz = P.z[j] - car.z;
          const lx = dx * car.hx + dz * car.hz, lz = -dx * car.hz + dz * car.hx;
          if (lx < -HALF_L || lx > HALF_L + 1.2 || Math.abs(lz) > HALF_W + 0.35) return;
          const side = lz >= 0 ? 1 : -1, push = (HALF_W + 0.4 - Math.abs(lz)) * side;
          const nx = P.x[j] - car.hz * push, nz = P.z[j] + car.hx * push;
          if (P.walkable(nx, nz)) { P.x[j] = nx; P.z[j] = nz; }
        });
      }
      if (P && car.v > 2) {
        P.around(car.x, car.z, 2.7, (j) => {
          if (!P.hittable(j)) return;
          const dx = P.x[j] - car.x, dz = P.z[j] - car.z;
          const lx = dx * car.hx + dz * car.hz, lz = -dx * car.hz + dz * car.hx;
          if (Math.abs(lx) < HALF_L + 0.1 && Math.abs(lz) < HALF_W + 0.1) {
            if (P.st[j] !== 6 && car.panic <= 0) { car.v = Math.min(car.v, 0.4); return; } // a calm driver stands on the brakes for a person
            P.kill(j, car.hx * car.v, car.hz * car.v, 'car');
            car.hits++;
            if (car.mode === DRIVE) {
              car.v *= 0.88;
              if (car.panic > 0 && this.r() < 0.05) this.crash(car, null, car.v);
            }
          }
        });
      }
      // car against car (circle pairs along each body)
      this.near(car.x, car.z, 6, (o) => {
        if (o === car || car.grace > 0 || o.grace > 0 || o.mode === EXT || o.mode === AIR) return; // fresh mission car: let traffic flow round it
        if (o.id < car.id && o.mode !== REST && o.mode !== PARKED) return; // pair handled from the other side
        if (!this.overlap(car, o)) return;
        const rvx = car.hx * car.v - o.hx * o.v, rvz = car.hz * car.v - o.hz * o.v;
        const rel = Math.hypot(rvx, rvz);
        if (rel > 5 && (car.mode === DRIVE || o.mode === DRIVE)) {
          if (tough(car) || tough(o)) { const soft = tough(car) ? o : car; if (soft.mode === DRIVE && !tough(soft)) this.crash(soft, null, rel); }
          else this.crash(car, (o.mode === REST || o.mode === PARKED) ? null : o, rel);
        }
        else this.separate(car, o);
      });
    }
  }

  overlap(a, b) {
    if (Math.abs(a.x - b.x) > 5 || Math.abs(a.z - b.z) > 5) return false;
    for (const sa of [-1.2, 1.2]) for (const sb of [-1.2, 1.2]) {
      const ax = a.x + a.hx * sa, az = a.z + a.hz * sa, bx = b.x + b.hx * sb, bz = b.z + b.hz * sb;
      if ((ax - bx) ** 2 + (az - bz) ** 2 < 1.85 * 1.85) return true;
    }
    return false;
  }

  separate(a, b) {
    if (a.mode === DRIVE && (b.mode !== DRIVE || a.v >= b.v)) a.v = Math.min(a.v, 0.5);
    else if (b.mode === DRIVE) b.v = Math.min(b.v, 0.5);
    if (a.mode === WRECK && (b.mode === REST || b.mode === PARKED)) { a.vx *= -0.3; a.vz *= -0.3; }
  }

  sync(realT = 0) {
    const { _m4: m4, _q: q, _e: e, _p: p, _one: one } = this;
    for (const car of this.cars) {
      e.set(car.roll || 0, car.yaw, car.pitch || 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(p.set(car.x, car.y || 0, car.z), q, one);
      if (car.mission) this.missionMeshes[car.kind].setMatrixAt(car.slot, m4); else this.typeMeshes[car.type].setMatrixAt(car.slot, m4);
    }
    for (const t of TRAFFIC_MIX) this.typeMeshes[t.id].instanceMatrix.needsUpdate = true;
    for (const kind in this.missionMeshes) {
      const im = this.missionMeshes[kind]; if (!im.count) continue;
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- mission vehicles
  nearestNode(x, z) {
    let best = 1e18, bi = 0;
    this.nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < best) { best = d; bi = i; } });
    return bi;
  }

  // shortest road route from the city edge to the intersection nearest (x,z)
  routeTo(x, z, exclude = null) {
    const target = this.nearestNode(x, z), N = this.nodes.length;
    const dist = new Int32Array(N).fill(-1), par = new Int32Array(N).fill(-1);
    const qn = [target]; dist[target] = 0;
    for (let qi = 0; qi < qn.length; qi++) {
      const u = qn[qi];
      for (const v of this.nodes[u].nb) if (dist[v] < 0 && !this.isClosed(u, v)) { dist[v] = dist[u] + 1; par[v] = u; qn.push(v); }
    }
    const NZ = this.city.sz.length, NX = this.city.sx.length;
    let best = 1e9, start = -1;
    for (let i = 0; i < N; i++) {
      const gx = Math.floor(i / NZ), gz = i % NZ;
      const edge = gx === 0 || gz === 0 || gx === NX - 1 || gz === NZ - 1;
      if (!edge || i === target || dist[i] < 0 || (exclude && exclude.has(i))) continue;
      const sc = dist[i] + this.r() * 0.5;
      if (sc < best) { best = sc; start = i; }
    }
    if (start < 0) return null;
    const route = [start];
    for (let u = start; u !== target; u = par[u]) route.push(par[u]);
    return route;
  }

  // the nuke: every car within R is a burnt-out wreck
  nuke(x, z, R) {
    for (const car of this.cars) {
      if (car.gone || Math.hypot(car.x - x, car.z - z) > R) continue;
      if (car.mission) { if (car.mode === DRIVE || car.mode === PARKED) { if (car.onLost) car.onLost(car); } }
      car.mode = REST; car.v = 0; car.vx = car.vz = car.w = 0; car.burning = true; car.leaving = false;
      const node = this.nodes[car.b]; if (node) this.release(node, car);
      if (!car.mission) this.tint(car, '#141210');
      if (this.fire && Math.random() < 0.3) this.fire.carFire(car.x, car.z);
    }
    this.stats.wrecks += 0;
  }

  // a parked bus leaves: new route back to the edge, then it vanishes
  depart(car) {
    const route = this.routeTo(car.x, car.z); // edge -> here
    if (!route) { this.remove(car); return; }
    route.reverse(); // here -> edge
    car.route = route; car.ri = 0; car.leaving = true; car.mode = DRIVE; car.held = false; car.grace = 1.5;
    this.startSeg(car, route[0], route[1]);
    car.s = 0; this.pose(car);
  }

  remove(car) {
    car.mode = REST; car.gone = true;
    car.x = 1e5; car.z = 1e5; this.pose(car);
  }

  // pull over where it is and deploy (behind any unit already parked there, not inside it)
  park(car) {
    car.mode = PARKED; car.v = 0; car.turn = false; car.s = this.clearOf(car, car.s); this.pose(car);
    this.release(this.nodes[car.b], car);
    if (car.onArrive) car.onArrive(car.x, car.z, car);
  }

  // where on its final segment a mission car pulls over: beside the tap point (the heavy ones right at the crossing),
  // behind whatever is already parked in its lane
  stopAt(car) {
    if (tough(car)) return this.clearOf(car, car.len - 1);
    if (!car.to) return this.clearOf(car, car.len - 7);
    const s = (car.to[0] - car.p0x) * car.dx + (car.to[1] - car.p0z) * car.dz;
    return this.clearOf(car, Math.min(car.len - 7, Math.max(3, s)));
  }
  // the nearest place at or behind s on this lane clear of the rescue vehicles parked on it (Sean: they parked inside each other)
  clearOf(car, s) {
    const h = HALF_LEN[car.kind] || HALF_L;
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const o of this.missions) {
        if (o === car || o.gone || o.mode !== PARKED || o.a !== car.a || o.b !== car.b) continue;
        const gap = (HALF_LEN[o.kind] || HALF_L) + h + 1.5;
        if (Math.abs(o.s - s) < gap) { s = o.s - gap; moved = true; }
      }
      if (!moved) break;
    }
    return Math.max(1, s);
  }

  // route from a clear stretch of the city edge to (x,z) and send a cruiser
  // no room for another of this kind (all its places taken, or the city's limit on vehicles out)
  full(kind) { const out = this.missions.filter(m => !m.gone); return out.filter(m => m.mode === DRIVE || m.mode === PARKED).length >= MISSION_CAP || out.filter(m => m.kind === kind).length >= MISSION_KINDS[kind].cap; }
  dispatchTo(x, z, opts = {}) {
    const tried = new Set();
    let route = null;
    for (let k = 0; k < 6; k++) {
      const r = this.routeTo(x, z, tried);
      if (!r) break;
      route = route || r;
      tried.add(r[0]);
      const A = this.nodes[r[0]], B = this.nodes[r[1]];
      const L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
      const sx = A.x + dx * A.inset - dz * LANE, sz = A.z + dz * A.inset + dx * LANE;
      let clear = true;
      this.near(sx, sz, 14, (o) => { if (Math.hypot(o.x - sx, o.z - sz) < 14) clear = false; });
      if (clear) { route = r; break; }
    }
    return this.dispatch(route, { ...opts, to: [x, z] });
  }

  dispatch(route, opts = {}) {
    const kind = opts.kind || 'police', def = MISSION_KINDS[kind];
    if (!route || route.length < 2 || this.missions.filter(m => !m.gone && (m.mode === DRIVE || m.mode === PARKED)).length >= MISSION_CAP) return null;
    // the first free place in this kind's mesh: a vehicle that has left the city gives its place back (a wreck keeps its own)
    let slot = 0; while (this.missions.some(m => m.kind === kind && m.slot === slot && !m.gone)) slot++;
    if (slot >= def.cap) return null;
    const old = this.missions.findIndex(m => m.kind === kind && m.slot === slot); if (old >= 0) this.missions.splice(old, 1);
    const id = this.cars.length;
    const car = { id, mission: true, kind, slot, route, ri: 0, mode: DRIVE, cruise: opts.cruise ?? def.cruise, v: 0, panic: 0, think: 0,
      pedGap: 99, blocked: 0, resume: -1, x: 0, z: 0, y: 0, roll: 0, pitch: 0, vy: 0, hx: 1, hz: 0, yaw: 0, vx: 0, vz: 0, w: 0, ignite: false, burning: false, hits: 0, zx: 0, zz: 0,
      colHex: '#f4f4f0', held: false, to: opts.to || null, onArrive: opts.onArrive, onLost: opts.onLost, onGone: opts.onGone, grace: 2.5, leaving: false, gone: false };
    this.startSeg(car, route[0], route[1]);
    car.s = 0; this.pose(car);
    this.cars.push(car); this.missions.push(car);
    this.missionMeshes[kind].count = Math.max(this.missionMeshes[kind].count, slot + 1);
    let len = 0;
    for (let k = 1; k < route.length; k++) len += Math.hypot(this.nodes[route[k]].x - this.nodes[route[k - 1]].x, this.nodes[route[k]].z - this.nodes[route[k - 1]].z);
    car.eta = len / car.cruise;
    return car;
  }
}
