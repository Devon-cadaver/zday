// Tiny cars driving the street grid and pedestrians walking the sidewalks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALF, LANE, RW, CURB } from './city.js';
import { rng } from './textures.js';

const IN = RW / 2; // where lanes stop before an intersection centre

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
const PPL_COLS = ['#2b2522', '#3a3530', '#1f2630', '#26221f', '#e8e2d6', '#d9d0bf', '#8c2f25', '#33476b', '#b59a73', '#5a4a3a', '#6e2a3c', '#3d5a45'];

export class Traffic {
  constructor(city, parent, opts = {}) {
    const r = this.r = rng(opts.seed ?? 99);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const { sx, sz } = city;
    const NX = sx.length, NZ = sz.length;
    this.nodes = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const nb = [];
      if (i > 0) nb.push((i - 1) * NZ + j);
      if (i < NX - 1) nb.push((i + 1) * NZ + j);
      if (j > 0) nb.push(i * NZ + j - 1);
      if (j < NZ - 1) nb.push(i * NZ + j + 1);
      this.nodes.push({ x: sx[i], z: sz[j], nb });
    }

    const carGeo = carGeometry();
    const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    const col = new THREE.Color();

    // moving cars
    const nCars = opts.cars ?? 260;
    this.cars = [];
    this.carMesh = new THREE.InstancedMesh(carGeo, carMat, nCars);
    for (let k = 0; k < nCars; k++) {
      const a = Math.floor(r() * this.nodes.length);
      const b = pick(this.nodes[a].nb);
      const car = { v: 8 + r() * 2.5 };
      this.startSeg(car, a, b);
      car.s = r() * car.len;
      this.cars.push(car);
      this.carMesh.setColorAt(k, col.set(pick(CAR_COLS)));
    }
    this.carMesh.castShadow = this.carMesh.receiveShadow = true;
    this.carMesh.frustumCulled = false;
    parent.add(this.carMesh);

    // parked cars (static)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const pk = city.parked;
    this.parkedMesh = new THREE.InstancedMesh(carGeo, carMat, Math.max(1, pk.length));
    pk.forEach((c, k) => {
      e.set(0, c.rot, 0); q.setFromEuler(e);
      m4.compose(p.set(c.x, c.y, c.z), q, one);
      this.parkedMesh.setMatrixAt(k, m4);
      this.parkedMesh.setColorAt(k, col.set(pick(CAR_COLS)));
    });
    this.parkedMesh.castShadow = this.parkedMesh.receiveShadow = true;
    this.parkedMesh.computeBoundingSphere();
    parent.add(this.parkedMesh);

    // pedestrians
    const nWalk = opts.people ?? 3200;
    const blocks = city.walkBlocks.map(b => ({ ...b, w: b.x1 - b.x0, d: b.z1 - b.z0, P: 2 * (b.x1 - b.x0 + b.z1 - b.z0) }));
    const totalP = blocks.reduce((a, b) => a + b.P, 0);
    this.walkers = [];
    for (let k = 0; k < nWalk; k++) {
      let t = r() * totalP, bi = 0;
      while (t > blocks[bi].P && bi < blocks.length - 1) { t -= blocks[bi].P; bi++; }
      this.walkers.push({ b: blocks[bi], s: t, v: (0.9 + r() * 0.8) * (r() < 0.5 ? 1 : -1), lat: (r() - 0.5) * 2.2 });
    }
    const crowdPts = [];
    for (const c of city.crowds) {
      for (let k = 0; k < c.n; k++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c.rad;
        crowdPts.push([c.x + Math.cos(a) * d, c.y, c.z + Math.sin(a) * d]);
      }
    }
    // small knots of people standing at corners
    for (let k = 0; k < 320; k++) {
      const b = pick(blocks); const n = 3 + Math.floor(r() * 10);
      const cx = r() < 0.5 ? b.x0 : b.x1, cz = r() < 0.5 ? b.z0 : b.z1;
      for (let m = 0; m < n; m++) crowdPts.push([cx + (r() - 0.5) * 3, CURB, cz + (r() - 0.5) * 3]);
    }
    this.nWalk = nWalk;
    const pplGeo = personGeometry();
    this.pplMesh = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), nWalk + crowdPts.length);
    const arr = this.pplMesh.instanceMatrix.array;
    for (let k = 0; k < nWalk + crowdPts.length; k++) {
      m4.identity();
      if (k >= nWalk) { const c = crowdPts[k - nWalk]; m4.setPosition(c[0], c[1], c[2]); }
      m4.toArray(arr, k * 16);
      this.pplMesh.setColorAt(k, col.set(pick(PPL_COLS)));
    }
    this.pplMesh.castShadow = true; this.pplMesh.receiveShadow = true;
    this.pplMesh.frustumCulled = false;
    parent.add(this.pplMesh);

    this._m4 = m4; this._q = q; this._e = e; this._p = p; this._one = one;
    this.update(0);
  }

  startSeg(car, a, b) {
    const A = this.nodes[a], Bn = this.nodes[b];
    let dx = Bn.x - A.x, dz = Bn.z - A.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const rx = -dz, rz = dx;
    car.a = a; car.b = b; car.dx = dx; car.dz = dz;
    car.p0x = A.x + dx * IN + rx * LANE; car.p0z = A.z + dz * IN + rz * LANE;
    car.len = L - 2 * IN; car.s = 0; car.turn = false;
  }

  startTurn(car) {
    const Bn = this.nodes[car.b];
    const opts = Bn.nb.filter(n => n !== car.a);
    const c = opts.length ? opts[Math.floor(this.r() * opts.length)] : car.a;
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
    car.next = c; car.turn = true; car.t = 0;
  }

  update(dt) {
    const { _m4: m4, _q: q, _e: e, _p: p, _one: one } = this;
    for (let k = 0; k < this.cars.length; k++) {
      const car = this.cars[k];
      let x, z, hx, hz;
      if (!car.turn) {
        car.s += car.v * dt;
        if (car.s >= car.len) { const over = car.s - car.len; this.startTurn(car); car.t = over / car.tlen; }
      } else {
        car.t += car.v * dt / car.tlen;
        if (car.t >= 1) { const over = (car.t - 1) * car.tlen; this.startSeg(car, car.b, car.next); car.s = over; }
      }
      if (!car.turn) {
        x = car.p0x + car.dx * car.s; z = car.p0z + car.dz * car.s; hx = car.dx; hz = car.dz;
      } else {
        const t = Math.min(1, car.t), u = 1 - t, Q = car.q;
        x = u * u * Q[0] + 2 * u * t * Q[2] + t * t * Q[4];
        z = u * u * Q[1] + 2 * u * t * Q[3] + t * t * Q[5];
        hx = 2 * u * (Q[2] - Q[0]) + 2 * t * (Q[4] - Q[2]);
        hz = 2 * u * (Q[3] - Q[1]) + 2 * t * (Q[5] - Q[3]);
      }
      e.set(0, Math.atan2(-hz, hx), 0); q.setFromEuler(e);
      m4.compose(p.set(x, 0, z), q, one);
      this.carMesh.setMatrixAt(k, m4);
    }
    this.carMesh.instanceMatrix.needsUpdate = true;

    const arr = this.pplMesh.instanceMatrix.array;
    for (let k = 0; k < this.nWalk; k++) {
      const w = this.walkers[k], b = w.b;
      w.s += w.v * dt;
      let s = ((w.s % b.P) + b.P) % b.P, x, z;
      if (s < b.w) { x = b.x0 + s; z = b.z0 - w.lat * 0.5; }
      else if ((s -= b.w) < b.d) { x = b.x1 + w.lat * 0.5; z = b.z0 + s; }
      else if ((s -= b.d) < b.w) { x = b.x1 - s; z = b.z1 + w.lat * 0.5; }
      else { s -= b.w; x = b.x0 - w.lat * 0.5; z = b.z1 - s; }
      const o = k * 16;
      arr[o + 12] = x; arr[o + 13] = CURB; arr[o + 14] = z;
    }
    this.pplMesh.instanceMatrix.needsUpdate = true;
  }
}
