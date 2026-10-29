// Debris shared by every disaster: instanced chunks and whole objects (building
// shells, cars) that orbit a vortex, fly, float on flood water, rest on the
// ground and fade. Decals mark scoured ground and earthquake cracks.
import * as THREE from 'three';
import { cutGround } from './holes.js';

const G = 9.8, OBJ_CAP = 110, OBJ_SHADOWS = 60; // whole objects (each a draw call, two with its shadow): a busy storm threw hundreds of cars
const M = { FREE: 0, ORBIT: 1, FLY: 2, REST: 3, FLOAT: 4, LIFT: 5, SINK: 6 };
export { M as DEBRIS_MODE };

// one step of a fall into a black hole: the spiral tightens and speeds up; returns [x, y, z, distance to the centre]
export function sinkStep(vt, px, py, pz, h) {
  const dx = px - vt.x, dz = pz - vt.z, r = Math.hypot(dx, dz);
  const nr = Math.max(0, r - h * (2.5 + 70 / (r + 3))), a = Math.atan2(dz, dx) + h * (0.8 + 45 / (r + 4));
  const ny = py + (vt.y - py) * Math.min(1, h * (0.5 + 14 / (r + 6)));
  return [vt.x + Math.cos(a) * nr, ny, vt.z + Math.sin(a) * nr, Math.hypot(nr, ny - vt.y)];
}

// how far up the leaning funnel a height is (0 at the ground, 1 at the cloud)
const leanK = (vt, y) => Math.pow(Math.max(0, Math.min(1, y / vt.H)), 1.5);

export class Debris {
  constructor(scene, cap = 1600) {
    this.scene = scene; this.cap = cap;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), cap);
    this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    const F = () => new Float32Array(cap);
    Object.assign(this, { x: F(), y: F(), z: F(), vx: F(), vy: F(), vz: F(), rx: F(), ry: F(), rz: F(), wx: F(), wy: F(), wz: F(), sx: F(), sy: F(), sz: F(), t: F(), a: F(), hy: F() });
    this.mode = new Uint8Array(cap); this.vort = new Int16Array(cap).fill(-1);
    this.free = []; for (let i = cap - 1; i >= 0; i--) this.free.push(i);
    this.objs = [];
    this.vortices = []; // { x, z, H, scale, radiusAt(y) , alive }
    this.waterY = null; // function (x, z) -> water surface or -99
    this.groundY = () => 0.2;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    this.maxIndex = 0;
  }

  alloc() {
    if (this.free.length) return this.free.pop();
    // recycle the oldest resting chunk
    let best = -1, bt = 1e9;
    for (let i = 0; i < this.maxIndex; i++) if (this.mode[i] === M.REST && this.t[i] < bt) { bt = this.t[i]; best = i; }
    return best;
  }

  // one chunk. mode 'fly' needs v [vx,vy,vz]; 'orbit' needs vort (index) and hold; 'float' needs v
  add(x, y, z, sx, sy, sz, hex, mode = 'fly', o = {}) {
    const i = this.alloc(); if (i < 0) return -1;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.sx[i] = sx; this.sy[i] = sy; this.sz[i] = sz;
    this.rx[i] = Math.random() * 6; this.ry[i] = Math.random() * 6; this.rz[i] = Math.random() * 6;
    this.wx[i] = (Math.random() - 0.5) * 10; this.wy[i] = (Math.random() - 0.5) * 10; this.wz[i] = (Math.random() - 0.5) * 10;
    const v = o.v || [0, 0, 0]; this.vx[i] = v[0]; this.vy[i] = v[1]; this.vz[i] = v[2];
    this.mode[i] = mode === 'orbit' ? M.ORBIT : mode === 'float' ? M.FLOAT : mode === 'rest' ? M.REST : M.FLY;
    this.vort[i] = o.vort ?? -1; this.t[i] = mode === 'rest' ? 30 : (o.hold ?? 2 + Math.random() * 2.5);
    if (this.mode[i] === M.ORBIT) { const vt = this.vortices[this.vort[i]]; this.a[i] = Math.atan2(z - vt.z, x - vt.x); this.hy[i] = vt.H * (0.15 + Math.random() * 0.7); }
    this.mesh.setColorAt(i, this._c.set(hex)); this.mesh.instanceColor.needsUpdate = true;
    if (i + 1 > this.maxIndex) this.maxIndex = i + 1;
    return i;
  }

  // a whole object (building shell, car). opts like add(); 'lift' = sucked up and shrunk away, 'sink' = collapses into the ground
  addObject(o, mode, opts = {}) {
    if (this.objs.length >= OBJ_CAP) { // the oldest wreck lying still (else the oldest afloat) sinks away to make room
      const old = this.objs.find(q => q.mode === M.REST && q.t < q.life) || this.objs.find(q => q.mode === M.FLOAT);
      if (old) { if (old.mode === M.FLOAT) { old.mode = M.REST; old.t = 0; } old.life = Math.min(old.life, old.t); }
    }
    if (this.objs.length >= OBJ_SHADOWS) o.traverse(m => { m.castShadow = false; }); // past that, no shadows for the newcomers
    this.scene.add(o);
    const d = { o, mode: { orbit: M.ORBIT, fly: M.FLY, float: M.FLOAT, lift: M.LIFT, sink: M.SINK, rest: M.REST }[mode], t: 0, vort: opts.vort ?? -1,
      v: new THREE.Vector3(...(opts.v || [0, 0, 0])), w: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
      hold: opts.hold ?? 2.5, dur: opts.dur ?? 2.5, dir: opts.dir ?? Math.random() * 6.28, h: opts.h ?? 10, base: o.position.clone(), s0: o.scale.clone(), onDone: opts.onDone, a: 0, hy: 0, life: opts.life ?? 25 };
    if (d.mode === M.ORBIT) { const vt = this.vortices[d.vort]; d.a = Math.atan2(o.position.z - vt.z, o.position.x - vt.x); d.hy = vt.H * (0.1 + Math.random() * 0.35); }
    this.objs.push(d);
    return d;
  }

  fling(i, vt) {
    const a = this.a[i], sc = vt.scale || 1;
    const out = 12 + Math.random() * 12, tan = 18 + Math.random() * 14;
    this.vx[i] = (Math.cos(a) * out - Math.sin(a) * tan) * sc; this.vz[i] = (Math.sin(a) * out + Math.cos(a) * tan) * sc; this.vy[i] = 4 + Math.random() * 10;
    this.mode[i] = M.FLY;
  }

  update(h) {
    const wy = this.waterY;
    for (let i = 0; i < this.maxIndex; i++) {
      const md = this.mode[i];
      if (md === M.FREE) continue;
      if (md === M.ORBIT) {
        const vt = this.vortices[this.vort[i]];
        if (!vt || !vt.alive) { this.mode[i] = M.FLY; this.vy[i] = 2; continue; }
        if (vt.sink) {
          const [nx, ny, nz, d] = sinkStep(vt, this.x[i], this.y[i], this.z[i], h);
          this.x[i] = nx; this.y[i] = ny; this.z[i] = nz;
          this.rx[i] += this.wx[i] * h * 2; this.ry[i] += this.wy[i] * h * 2; this.rz[i] += this.wz[i] * h * 2;
          if (d < vt.horizon + 0.4) { this.mode[i] = M.FREE; this.free.push(i); this.sx[i] = 0; }
          continue;
        }
        this.t[i] -= h;
        this.y[i] += (this.hy[i] - this.y[i]) * Math.min(1, h * 0.8);
        this.a[i] += h * (2.2 - (this.y[i] / vt.H) * 1.1) * (vt.spin || 1);
        const r = vt.radiusAt(this.y[i]) * 1.08;
        const l = leanK(vt, this.y[i]), tx = vt.x + (vt.lx || 0) * l + Math.cos(this.a[i]) * r, tz = vt.z + (vt.lz || 0) * l + Math.sin(this.a[i]) * r;
        const k = Math.min(1, h * 3); this.x[i] += (tx - this.x[i]) * k; this.z[i] += (tz - this.z[i]) * k;
        this.rx[i] += this.wx[i] * h; this.ry[i] += this.wy[i] * h; this.rz[i] += this.wz[i] * h;
        if (this.t[i] <= 0) this.fling(i, vt);
      } else if (md === M.FLY) {
        const h0 = h; h *= this.slowAt ? this.slowAt(this.x[i], this.y[i], this.z[i]) : 1; // a time bubble
        this.vy[i] -= G * h; this.x[i] += this.vx[i] * h; this.y[i] += this.vy[i] * h; this.z[i] += this.vz[i] * h;
        this.rx[i] += this.wx[i] * h; this.ry[i] += this.wy[i] * h; this.rz[i] += this.wz[i] * h;
        const w = wy ? wy(this.x[i], this.z[i]) : -99;
        if (w > 0.3 && this.y[i] <= w) { this.mode[i] = M.FLOAT; if (this.onSplash && this.vy[i] < -6) this.onSplash(this.x[i], w, this.z[i], this.sx[i]); this.vy[i] = 0; }
        else if (this.y[i] <= this.groundY(this.x[i], this.z[i]) + this.sy[i] * 0.4) { this.y[i] = this.groundY(this.x[i], this.z[i]) + this.sy[i] * 0.4; this.mode[i] = M.REST; this.t[i] = 25 + Math.random() * 10; this.rx[i] = 0; this.rz[i] = (Math.random() - 0.5) * 0.3; }
        h = h0;
      } else if (md === M.FLOAT) {
        const w = wy ? wy(this.x[i], this.z[i]) : -99;
        const f = Math.exp(-0.35 * h); this.vx[i] *= f; this.vz[i] *= f;
        this.x[i] += this.vx[i] * h; this.z[i] += this.vz[i] * h;
        this.ry[i] += this.wy[i] * h * 0.1;
        const gy = this.groundY(this.x[i], this.z[i]) + this.sy[i] * 0.4;
        if (w < gy) { this.y[i] = gy; this.mode[i] = M.REST; this.t[i] = 25; }
        else this.y[i] = w + Math.sin(this.ry[i] * 3 + i) * 0.1;
      } else if (md === M.REST) {
        this.t[i] -= h;
        if (this.t[i] < 3) this.y[i] -= h * 0.25;
        if (this.t[i] <= 0) { this.mode[i] = M.FREE; this.free.push(i); this.sx[i] = 0; }
      }
    }
    // objects
    for (let n = this.objs.length - 1; n >= 0; n--) {
      const d = this.objs[n], o = d.o; d.t += h;
      if (d.mode === M.LIFT) { // building shell: lifts, spins, is drawn into the funnel and shrinks away
        const k = Math.min(1, d.t / d.dur), vt = this.vortices[d.vort];
        o.position.y = vt && vt.sink ? d.base.y + (vt.y - d.base.y) * k * k : d.base.y + k * k * d.h * 2.2; // a black hole draws it to its own height
        o.rotation.y += h * (1.5 + k * 9); o.rotation.z = Math.sin(d.t * 6) * 0.3 * k;
        const sc = 1 - k * 0.94; o.scale.set(d.s0.x * sc, d.s0.y * sc, d.s0.z * sc);
        if (vt && vt.alive) { const f = Math.min(1, h * 1.6), l = leanK(vt, o.position.y); o.position.x += (vt.x + (vt.lx || 0) * l - o.position.x) * f; o.position.z += (vt.z + (vt.lz || 0) * l - o.position.z) * f; }
        if (k >= 1) { this.drop(n); continue; }
      } else if (d.mode === M.SINK) { // collapse: shudder, lean, drop into a cloud of dust
        const k = Math.min(1, d.t / d.dur);
        const lean = Math.min(1, k * 1.6) * 0.28;
        o.rotation.x = Math.cos(d.dir) * lean; o.rotation.z = Math.sin(d.dir) * lean;
        o.position.x = d.base.x + Math.sin(d.t * 37) * 0.25 * (1 - k); o.position.z = d.base.z + Math.cos(d.t * 31) * 0.25 * (1 - k);
        o.position.y = d.base.y - k * k * d.h * 0.95;
        if (k >= 1) { if (d.onDone) d.onDone(); this.drop(n); continue; }
      } else if (d.mode === M.ORBIT && this.vortices[d.vort] && this.vortices[d.vort].sink && this.vortices[d.vort].alive) {
        const vt = this.vortices[d.vort], p = o.position, [nx, ny, nz, dd] = sinkStep(vt, p.x, p.y, p.z, h);
        p.set(nx, ny, nz); o.rotation.x += d.w.x * h * 2; o.rotation.y += d.w.y * h * 2; o.rotation.z += d.w.z * h * 2;
        const sc = Math.min(1, dd / 8); o.scale.set(d.s0.x * sc, d.s0.y * sc, d.s0.z * sc);
        if (dd < vt.horizon + 1) { this.drop(n); continue; }
      } else if (d.mode === M.ORBIT) {
        const vt = this.vortices[d.vort];
        if (!vt || !vt.alive || d.t > d.hold) {
          d.mode = M.FLY; const a = d.a, sc = (vt && vt.scale) || 1;
          d.v.set((Math.cos(a) * 10 - Math.sin(a) * 18) * sc, 6 + Math.random() * 6, (Math.sin(a) * 10 + Math.cos(a) * 18) * sc);
          continue;
        }
        o.position.y += (d.hy - o.position.y) * Math.min(1, h * 0.8);
        d.a += h * (2.0 - (o.position.y / vt.H)) * (vt.spin || 1);
        const r = vt.radiusAt(o.position.y) * 1.15, f = Math.min(1, h * 2.5);
        const l = leanK(vt, o.position.y);
        o.position.x += (vt.x + (vt.lx || 0) * l + Math.cos(d.a) * r - o.position.x) * f; o.position.z += (vt.z + (vt.lz || 0) * l + Math.sin(d.a) * r - o.position.z) * f;
        o.rotation.x += d.w.x * h; o.rotation.y += d.w.y * h; o.rotation.z += d.w.z * h;
      } else if (d.mode === M.FLY) {
        const hs = h * (this.slowAt ? this.slowAt(o.position.x, o.position.y, o.position.z) : 1);
        d.v.y -= G * hs; o.position.addScaledVector(d.v, hs);
        o.rotation.x += d.w.x * h; o.rotation.y += d.w.y * h; o.rotation.z += d.w.z * h;
        const w = wy ? wy(o.position.x, o.position.z) : -99;
        if (w > 0.4 && o.position.y <= w) { d.mode = M.FLOAT; if (this.onSplash) this.onSplash(o.position.x, w, o.position.z, 3); d.v.y = 0; }
        else if (o.position.y <= this.groundY(o.position.x, o.position.z)) { o.position.y = this.groundY(o.position.x, o.position.z); d.mode = M.REST; d.t = 0; o.rotation.x = Math.random() < 0.5 ? 0 : Math.PI; o.rotation.z = (Math.random() - 0.5) * 0.4; if (d.onLand) d.onLand(o); }
      } else if (d.mode === M.FLOAT) {
        const w = wy ? wy(o.position.x, o.position.z) : -99, fl = this.flowAt ? this.flowAt(o.position.x, o.position.z) : null; // a whirlpool's pull
        if (fl) { const k = Math.min(1, h * 1.2); d.v.x += (fl[0] * 5 - d.v.x) * k; d.v.z += (fl[1] * 5 - d.v.z) * k; if (fl[3] && fl[3](o.position.x, o.position.z)) { this.drop(n); continue; } } // down the hole
        if (!fl) { const f = Math.exp(-0.3 * h); d.v.x *= f; d.v.z *= f; }
        o.position.x += d.v.x * h; o.position.z += d.v.z * h; o.rotation.y += h * 0.15;
        if (w < 0.25) { o.position.y = 0.2; d.mode = M.REST; d.t = 0; }
        else o.position.y = w - 0.4 + Math.sin(d.t * 1.5) * 0.15;
      } else if (d.mode === M.REST) {
        if (d.t > d.life) { o.position.y -= h * 0.3; if (d.t > d.life + 4) { this.drop(n); continue; } }
      }
    }
  }

  // a pit opened under (x, z): whatever was lying within R falls
  wake(x, z, R) {
    for (let i = 0; i < this.maxIndex; i++) if (this.mode[i] === M.REST && Math.hypot(this.x[i] - x, this.z[i] - z) < R) { this.mode[i] = M.FLY; this.vx[i] = this.vy[i] = this.vz[i] = 0; }
    for (const d of this.objs) if (d.mode === M.REST && Math.hypot(d.o.position.x - x, d.o.position.z - z) < R) { d.mode = M.FLY; d.v.set(0, 0, 0); }
  }

  drop(n) {
    const d = this.objs[n];
    this.scene.remove(d.o);
    if (d.o.userData.disposeGeo) d.o.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    this.objs.splice(n, 1);
  }

  sync() {
    const arr = this.mesh.instanceMatrix.array, m = this._m, q = this._q, e = this._e, p = this._p, s = this._s;
    for (let i = 0; i < this.maxIndex; i++) {
      if (this.mode[i] === M.FREE) { arr.fill(0, i * 16, i * 16 + 16); continue; }
      e.set(this.rx[i], this.ry[i], this.rz[i]); q.setFromEuler(e);
      m.compose(p.set(this.x[i], this.y[i], this.z[i]), q, s.set(this.sx[i], this.sy[i], this.sz[i]));
      m.toArray(arr, i * 16);
    }
    this.mesh.count = this.maxIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.mode.fill(0); this.free.length = 0; for (let i = this.cap - 1; i >= 0; i--) this.free.push(i);
    this.maxIndex = 0; this.mesh.count = 0;
    for (let n = this.objs.length - 1; n >= 0; n--) this.drop(n);
    this.vortices.length = 0;
  }
}

// ground marks: soft scour patches and jagged cracks
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 14 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(40,30,22,0.22)'); gr.addColorStop(1, 'rgba(40,30,22,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  g.strokeStyle = 'rgba(30,22,16,0.25)'; g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) { g.beginPath(); let x = 64, y = 64; const a = Math.random() * 6.28; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.cos(a + (Math.random() - 0.5)) * 9; y += Math.sin(a + (Math.random() - 0.5)) * 9; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function crackTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  const draw = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath();
    let y = 16; g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 8) { y = 16 + (Math.random() - 0.5) * 12; g.lineTo(x, y); }
    g.stroke();
  };
  draw(7, 'rgba(60,45,32,0.35)'); draw(3.5, 'rgba(18,12,8,0.95)');
  for (let i = 0; i < 6; i++) { const x0 = Math.random() * 240; g.strokeStyle = 'rgba(18,12,8,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, 16); g.lineTo(x0 + 10 + Math.random() * 16, 16 + (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8)); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Decals {
  constructor(scene, cap = 700) {
    const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
    const mk = (tex) => {
      const im = new THREE.InstancedMesh(quad, cutGround(new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), cap);
      im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.renderOrder = 1; scene.add(im); return im;
    };
    this.scour = mk(blobTexture()); this.crack = mk(crackTexture());
    this.n = { scour: 0, crack: 0 }; this.cap = cap;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  add(kind, x, z, w, d, rot = Math.random() * 6.28, y = 0.04) {
    const im = this[kind], k = this.n[kind] % this.cap; this.n[kind]++;
    this._e.set(0, rot, 0); this._q.setFromEuler(this._e);
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(w, 1, d));
    im.setMatrixAt(k, this._m); im.count = Math.min(this.n[kind], this.cap); im.instanceMatrix.needsUpdate = true;
  }
  reset() { this.n.scour = 0; this.n.crack = 0; this.scour.count = 0; this.crack.count = 0; }
}
