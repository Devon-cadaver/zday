// Cars: lane following with braking, right of way at intersections, U-turns
// when blocked. Near zombies drivers panic: faster, late braking, they run
// people and zombies over and crash. Crashes become sliding, spinning wrecks
// that can catch fire. Parked cars are static.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANE, RW } from './city.js';
import { rng } from './textures.js';

const IN = RW / 2;        // lanes stop this far before an intersection centre
const ACC = 3.5, BRAKE = 8, BRAKE_PANIC = 4.5;
const LEN = 4.3, HALF_L = 2.2, HALF_W = 0.95;
const CELL = 10;
const DRIVE = 0, WRECK = 1, REST = 2;
const STOPLINE = 3.4; // car centre stops this far before the lane end

function colorize(g, hex) {
  const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export function carGeometry() {
  return mergeGeometries([
    colorize(new THREE.BoxGeometry(3.7, 0.42, 1.62).translate(0, 0.33, 0), '#1c1c1c'),
    colorize(new THREE.BoxGeometry(4.3, 0.56, 1.8).translate(0, 0.78, 0), '#ffffff'),
    colorize(new THREE.BoxGeometry(2.3, 0.5, 1.62).translate(-0.25, 1.3, 0), '#262b31'),
    colorize(new THREE.BoxGeometry(2.0, 0.08, 1.5).translate(-0.3, 1.58, 0), '#ffffff'),
  ]);
}

export function personGeometry() {
  return mergeGeometries([
    colorize(new THREE.CylinderGeometry(0.2, 0.24, 1.2, 6).translate(0, 0.78, 0), '#ffffff'),
    colorize(new THREE.SphereGeometry(0.17, 6, 4).translate(0, 1.55, 0), '#ffffff'),
  ]);
}

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
      this.nodes.push({ x: sx[i], z: sz[j], nb, occ: -1 });
    }
    const B = city.bounds;
    this.gx0 = B.x0 - 20; this.gz0 = B.z0 - 20;
    this.gw = Math.ceil((B.x1 - B.x0 + 40) / CELL) + 1; this.gh = Math.ceil((B.z1 - B.z0 + 40) / CELL) + 1;
    this.head = new Int32Array(this.gw * this.gh);

    const carGeo = carGeometry();
    const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    this.nCars = opts.cars ?? 260;
    this.next = new Int32Array(this.nCars);
    this.carMesh = new THREE.InstancedMesh(carGeo, carMat, this.nCars);
    this.carMesh.castShadow = this.carMesh.receiveShadow = true;
    this.carMesh.frustumCulled = false;
    parent.add(this.carMesh);

    // parked cars (static)
    const r = rng(1234);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const pk = city.parked;
    this.parkedMesh = new THREE.InstancedMesh(carGeo, carMat, Math.max(1, pk.length));
    pk.forEach((c, k) => {
      e.set(0, c.rot, 0); q.setFromEuler(e);
      m4.compose(p.set(c.x, c.y, c.z), q, one);
      this.parkedMesh.setMatrixAt(k, m4);
      this.parkedMesh.setColorAt(k, col.set(CAR_COLS[Math.floor(r() * CAR_COLS.length)]));
    });
    this.parkedMesh.castShadow = this.parkedMesh.receiveShadow = true;
    this.parkedMesh.computeBoundingSphere();
    parent.add(this.parkedMesh);

    this._m4 = m4; this._q = q; this._e = e; this._p = p; this._one = one; this._c = col;
    this.reset();
  }

  reset() {
    const r = this.r = rng(this.opts.seed ?? 99);
    for (const n of this.nodes) n.occ = -1;
    this.cars = [];
    for (let k = 0; k < this.nCars; k++) {
      const a = Math.floor(r() * this.nodes.length);
      const nb = this.nodes[a].nb, b = nb[Math.floor(r() * nb.length)];
      const car = { id: k, mode: DRIVE, cruise: 8 + r() * 2.5, v: 0, panic: 0, think: r() * 0.5, pedGap: 99, blocked: 0, resume: -1,
        x: 0, z: 0, hx: 1, hz: 0, yaw: 0, vx: 0, vz: 0, w: 0, ignite: false, burning: false, hits: 0, zx: 0, zz: 0,
        colHex: CAR_COLS[Math.floor(r() * CAR_COLS.length)] };
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
      this.carMesh.setColorAt(k, this._c.set(car.colHex));
    }
    this.carMesh.instanceColor.needsUpdate = true;
    this.events = [];
    this.stats = { crashes: 0, wrecks: 0 };
    this.sync();
  }

  // ---------- paths
  startSeg(car, a, b) {
    const A = this.nodes[a], Bn = this.nodes[b];
    let dx = Bn.x - A.x, dz = Bn.z - A.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    car.a = a; car.b = b; car.dx = dx; car.dz = dz;
    car.p0x = A.x + dx * IN - dz * LANE; car.p0z = A.z + dz * IN + dx * LANE;
    car.len = L - 2 * IN; car.s = 0; car.turn = false; car.held = false;
  }

  startTurn(car) {
    const Bn = this.nodes[car.b];
    const opts = Bn.nb.filter(n => n !== car.a);
    let c;
    if (!opts.length) c = car.a;
    else if (car.panic > 0) {
      // drive away from the zombies
      let best = -1e9;
      for (const o of opts) {
        const C = this.nodes[o];
        const sc = (C.x - Bn.x) * (Bn.x - car.zx) + (C.z - Bn.z) * (Bn.z - car.zz) + this.r() * 40;
        if (sc > best) { best = sc; c = o; }
      }
    } else c = opts[Math.floor(this.r() * opts.length)];
    const C = this.nodes[c];
    let ex = C.x - Bn.x, ez = C.z - Bn.z; const L = Math.hypot(ex, ez); ex /= L; ez /= L;
    const rx = -car.dz, rz = car.dx, r2x = -ez, r2z = ex;
    const q0x = car.p0x + car.dx * car.len, q0z = car.p0z + car.dz * car.len;
    const q2x = Bn.x + ex * IN + r2x * LANE, q2z = Bn.z + ez * IN + r2z * LANE;
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
    const nb = this.nodes[car.b]; if (nb.occ === car.id) nb.occ = -1;
    this.startSeg(car, car.b, car.a);
    const sNew = Math.min(car.len, Math.max(0, car.len - sOld));
    const tx = car.p0x + car.dx * sNew, tz = car.p0z + car.dz * sNew;
    car.q = [cx, cz, cx + odx * 3 + (tx - cx) * 0.5, cz + odz * 3 + (tz - cz) * 0.5, tx, tz];
    car.tlen = 8; car.turn = true; car.t = 0; car.resume = sNew; car.blocked = 0;
  }

  pose(car) {
    if (!car.turn) {
      car.x = car.p0x + car.dx * car.s; car.z = car.p0z + car.dz * car.s; car.hx = car.dx; car.hz = car.dz;
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
      const node = this.nodes[car.b];
      if (node.occ >= 0) { const o = this.cars[node.occ]; if (!o || o.mode !== DRIVE || o.b !== car.b || !(o.held || o.turn)) node.occ = -1; }
      if (car.s >= car.len - STOPLINE && !car.held) {
        if (node.occ < 0) { node.occ = car.id; car.held = true; }
        else if (node.occ === car.id) car.held = true;
        else if (car.panic <= 0) { car.s = Math.max(before, car.len - STOPLINE); car.v = 0; return; }
      }
      if (car.s >= car.len) {
        const over = car.s - car.len; this.startTurn(car); car.t = over / car.tlen;
      }
    } else {
      car.t += d / car.tlen;
      if (car.t >= 1) {
        const over = (car.t - 1) * car.tlen;
        if (car.resume >= 0) { car.turn = false; car.s = car.resume + over; car.resume = -1; }
        else {
          const node = this.nodes[car.b]; if (node.occ === car.id) node.occ = -1;
          this.startSeg(car, car.b, car.next); car.s = over;
        }
      }
    }
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
      else if (car.mode === WRECK) this.wreckStep(car, h, P);
    }
    this.collisions(P);
  }

  driveStep(car, h, P) {
    // zombies nearby? panic. Pedestrians ahead? (calm drivers only)
    if ((car.think -= h) <= 0) {
      car.think = 0.25 + this.r() * 0.15;
      if (P) {
        let zd = 1e9, zn = 0;
        P.around(car.x, car.z, 22, (j, d2) => { if (P.st[j] === 6) { zn++; if (d2 < zd) { zd = d2; car.zx = P.x[j]; car.zz = P.z[j]; } } });
        if (zn >= 2) car.panic = 25;
        car.pedGap = 99;
        if (car.panic <= 0) {
          P.around(car.x + car.hx * 5, car.z + car.hz * 5, 6, (j) => {
            if (!P.hittable(j)) return;
            const dx = P.x[j] - car.x, dz = P.z[j] - car.z;
            const lx = dx * car.hx + dz * car.hz, lz = -dx * car.hz + dz * car.hx;
            if (lx > 1 && lx < 11 && Math.abs(lz) < 1.5) car.pedGap = Math.min(car.pedGap, lx - HALF_L);
          });
        }
      }
    }
    if (car.panic > 0) car.panic -= h;
    const panic = car.panic > 0;
    let vDes = panic ? car.cruise * 1.6 : car.cruise;
    const brake = panic ? BRAKE_PANIC : BRAKE;
    if (car.resume < 0) {
      const gap = this.gapAhead(car, panic ? 12 : 20);
      const stop = panic ? 0.6 : 2.5;
      if (gap < 99) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * brake * (gap - stop))));
      if (!panic && car.pedGap < 99) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * BRAKE * (car.pedGap - 1.5))));
      if (!panic && !car.turn) {
        const node = this.nodes[car.b], toEnd = car.len - car.s;
        if (node.occ >= 0 && node.occ !== car.id && !car.held && toEnd < 18) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * BRAKE * (toEnd - STOPLINE))));
      }
    } else vDes = 3;
    if (car.v < vDes) car.v = Math.min(vDes, car.v + ACC * (panic ? 1.6 : 1) * h);
    else car.v = Math.max(vDes, car.v - brake * h);
    this.advance(car, car.v * h);
    this.pose(car);
    if (car.v < 0.3) car.blocked += h; else car.blocked = 0;
    if (car.blocked > 6 && !car.turn && car.s > 8 && car.s < car.len - 9 && this.oppositeClear(car)) this.uturn(car);
  }

  wreckStep(car, h, P) {
    const nx = car.x + car.vx * h, nz = car.z + car.vz * h;
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
        this.carMesh.setColorAt(car.id, this._c.set('#1a1714')); this.carMesh.instanceColor.needsUpdate = true;
        this.events.push({ type: 'carfire', x: car.x, z: car.z });
      }
    }
  }

  crash(car, other, impact) {
    const avx = car.hx * car.v, avz = car.hz * car.v;
    const bvx = other ? other.hx * other.v : 0, bvz = other ? other.hz * other.v : 0;
    for (const c of [car, other]) {
      if (!c || c.mode !== DRIVE) continue;
      c.mode = WRECK;
      { const node = this.nodes[c.b]; if (node.occ === c.id) node.occ = -1; }
      c.ignite = this.r() < 0.28 + Math.min(0.35, impact / 40);
      this._c.set(c.colHex).multiplyScalar(0.6);
      this.carMesh.setColorAt(c.id, this._c); this.carMesh.instanceColor.needsUpdate = true;
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
    this.events.push({ type: 'crash', x: car.x, z: car.z });
    if (this.people) this.people.scare(car.x, car.z, 16, 0.7);
    this.near(car.x, car.z, 18, (o) => { if (o.mode === DRIVE && Math.hypot(o.x - car.x, o.z - car.z) < 18) { o.panic = Math.max(o.panic, 10); o.zx = car.x; o.zz = car.z; } });
  }

  collisions(P) {
    for (const car of this.cars) {
      if (car.mode === REST) continue;
      // run over anyone in the footprint
      if (P && car.v > 2) {
        P.around(car.x, car.z, 2.7, (j) => {
          if (!P.hittable(j)) return;
          const dx = P.x[j] - car.x, dz = P.z[j] - car.z;
          const lx = dx * car.hx + dz * car.hz, lz = -dx * car.hz + dz * car.hx;
          if (Math.abs(lx) < HALF_L + 0.1 && Math.abs(lz) < HALF_W + 0.1) {
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
        if (o === car) return;
        if (o.id < car.id && o.mode !== REST) return; // pair handled from the other side
        if (!this.overlap(car, o)) return;
        const rvx = car.hx * car.v - o.hx * o.v, rvz = car.hz * car.v - o.hz * o.v;
        const rel = Math.hypot(rvx, rvz);
        if (rel > 5 && (car.mode === DRIVE || o.mode === DRIVE)) this.crash(car, o.mode === REST ? null : o, rel);
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
    if (a.mode === WRECK && b.mode === REST) { a.vx *= -0.3; a.vz *= -0.3; }
  }

  sync() {
    const { _m4: m4, _q: q, _e: e, _p: p, _one: one } = this;
    for (const car of this.cars) {
      e.set(0, car.yaw, 0); q.setFromEuler(e);
      m4.compose(p.set(car.x, 0, car.z), q, one);
      this.carMesh.setMatrixAt(car.id, m4);
    }
    this.carMesh.instanceMatrix.needsUpdate = true;
  }
}
