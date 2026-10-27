// Fire and smoke: GPU-animated point sprites (one draw call each), plus
// building fire logic (burn time, spread to neighbours, charring).
import * as THREE from 'three';
import { cutGround } from './holes.js';

const COMMON_VS = /* glsl */`
uniform float uTime, uScale;
attribute vec3 aBase;
attribute vec4 aSeed;   // x seed, y size, z start time, w end time
attribute vec2 aSpread;
varying float vA; varying float vT;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
`;

const FLAME_VS = COMMON_VS + /* glsl */`
void main() {
  float seed = aSeed.x, size = aSeed.y;
  float rate = 0.9 + h1(seed * 3.1) * 0.9;
  float t = fract(uTime * rate + h1(seed));
  vec3 p = aBase + vec3((h1(seed * 7.7) - 0.5) * 2.0 * aSpread.x, 0.0, (h1(seed * 5.3) - 0.5) * 2.0 * aSpread.y);
  p.y += t * size * 1.8;
  p.x += sin(uTime * 3.0 + seed) * 0.12 * size;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float fade = clamp((uTime - aSeed.z) / 2.0, 0.0, 1.0) * (1.0 - clamp((uTime - aSeed.w) / 3.0, 0.0, 1.0));
  vA = fade * (1.0 - t * 0.85); vT = t;
  gl_PointSize = min(300.0, size * (1.25 - t * 0.7) * uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FLAME_FS = /* glsl */`
varying float vA; varying float vT;
void main() {
  // teardrop: narrow tongue at the top, round belly below
  vec2 q = gl_PointCoord - vec2(0.5, 0.62);
  q.x /= mix(0.28, 1.0, gl_PointCoord.y);
  float d = length(q);
  float a = smoothstep(0.42, 0.04, d) * vA;
  vec3 c = mix(vec3(5.0, 3.0, 1.0), vec3(2.4, 0.55, 0.08), vT);
  gl_FragColor = vec4(c, a);
}`;

const SMOKE_VS = COMMON_VS + /* glsl */`
uniform vec2 uWind;
void main() {
  float seed = aSeed.x, size = aSeed.y;
  float rate = 0.07 + h1(seed * 3.1) * 0.05;
  float t = fract(uTime * rate + h1(seed));
  float hgt = size * 16.0;
  vec3 p = aBase + vec3((h1(seed * 7.7) - 0.5) * aSpread.x, 0.0, (h1(seed * 5.3) - 0.5) * aSpread.y);
  p.xz += uWind * t * hgt * 0.7;
  p.y += t * hgt;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float fade = clamp((uTime - aSeed.z) / 3.0, 0.0, 1.0) * (1.0 - clamp((uTime - aSeed.w) / 6.0, 0.0, 1.0));
  vA = fade * smoothstep(0.0, 0.08, t) * (1.0 - t) * 0.78; vT = t;
  gl_PointSize = min(420.0, size * (2.4 + t * 8.0) * uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const SMOKE_FS = /* glsl */`
uniform vec3 uColA, uColB;
varying float vA; varying float vT;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vA;
  vec3 c = mix(uColA, uColB, vT);
  gl_FragColor = vec4(c, a);
}`;

class Pool {
  constructor(cap, vs, fs, blending, parent, uniforms) {
    this.cap = cap; this.used = 0; this.free = [];
    const g = new THREE.BufferGeometry();
    this.base = new Float32Array(cap * 3); this.seed = new Float32Array(cap * 4); this.spread = new Float32Array(cap * 2);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    g.setAttribute('aBase', new THREE.BufferAttribute(this.base, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 4));
    g.setAttribute('aSpread', new THREE.BufferAttribute(this.spread, 2));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    parent.add(this.points);
  }
  alloc(n, x, y, z, sx, sz, size, start) {
    // reuse a released range first, else append
    let o = -1;
    for (let f = 0; f < this.free.length; f++) {
      const r = this.free[f];
      if (r.n >= n) { o = r.o; r.o += n; r.n -= n; if (r.n === 0) this.free.splice(f, 1); break; }
    }
    if (o < 0) {
      if (this.used + n > this.cap) return null;
      o = this.used; this.used += n;
    }
    for (let k = 0; k < n; k++) {
      const i = o + k;
      this.base[i * 3] = x; this.base[i * 3 + 1] = y; this.base[i * 3 + 2] = z;
      this.seed[i * 4] = Math.random() * 1000; this.seed[i * 4 + 1] = size * (0.75 + Math.random() * 0.5);
      this.seed[i * 4 + 2] = start; this.seed[i * 4 + 3] = 1e9;
      this.spread[i * 2] = sx; this.spread[i * 2 + 1] = sz;
    }
    this.geo.setDrawRange(0, this.used);
    for (const k of ['aBase', 'aSeed', 'aSpread']) this.geo.attributes[k].needsUpdate = true;
    return { o, n };
  }
  end(r, t) {
    if (!r) return;
    for (let k = 0; k < r.n; k++) this.seed[(r.o + k) * 4 + 3] = t;
    this.geo.attributes.aSeed.needsUpdate = true;
  }
  // after it has faded out, hand the range back
  release(r) {
    if (!r) return;
    for (let k = 0; k < r.n; k++) { this.seed[(r.o + k) * 4 + 1] = 0; this.seed[(r.o + k) * 4 + 3] = -1e9; }
    this.geo.attributes.aSeed.needsUpdate = true;
    this.free.push({ o: r.o, n: r.n });
  }
  reset() { this.used = 0; this.free = []; this.geo.setDrawRange(0, 0); }
}

export class Fire {
  constructor(parent, city, opts = {}) {
    this.city = city;
    this.uniforms = { uTime: { value: 0 }, uScale: { value: 500 }, uWind: { value: new THREE.Vector2(0.35, -0.2) } };
    const low = opts.low;
    this.flames = new Pool(low ? 4000 : 8000, FLAME_VS, FLAME_FS, THREE.AdditiveBlending, parent, this.uniforms);
    this.smoke = new Pool(low ? 1600 : 3200, SMOKE_VS, SMOKE_FS, THREE.NormalBlending, parent, { ...this.uniforms, uColA: { value: new THREE.Vector3(0.06, 0.05, 0.045) }, uColB: { value: new THREE.Vector3(0.34, 0.31, 0.28) } });
    this.mist = new Pool(low ? 800 : 1600, SMOKE_VS, SMOKE_FS, THREE.NormalBlending, parent, { ...this.uniforms, uColA: { value: new THREE.Vector3(0.8, 0.88, 0.97) }, uColB: { value: new THREE.Vector3(0.97, 0.98, 1.0) } });
    this.dust = new Pool(low ? 900 : 1800, SMOKE_VS, SMOKE_FS, THREE.NormalBlending, parent, { ...this.uniforms, uColA: { value: new THREE.Vector3(0.3, 0.26, 0.2) }, uColB: { value: new THREE.Vector3(0.52, 0.46, 0.37) } });
    this.smoke.points.renderOrder = 3; this.dust.points.renderOrder = 3; this.flames.points.renderOrder = 4; this.mist.points.renderOrder = 5;
    this.events = [];
    this.reset();
  }

  reset() {
    this.flames.reset(); this.smoke.reset(); this.mist.reset(); this.dust.reset();
    if (this.scorch) this.scorch.visible = false;
    this.burning = new Map(); // building index -> { until, fl: [], sm, wet }
    this.carFires = [];
    this.bFire = new Uint8Array(this.city.buildings.length); // 0 none, 1 burning, 2 burnt out, 3 put out
    this.soaked = new Float32Array(this.city.buildings.length); // sim time until which it cannot catch
    this.simT = 0; this.spreadT = 0; this.realT = 0;
    this.timers = []; // { at (sim time), fn }
    this.stats = { out: 0, drops: 0 };
    this.spreadK = 1; this.rainK = 0;
  }

  later(dt, fn) { this.timers.push({ at: this.simT + dt, fn }); }

  // airstrike: a fireball, a dust ring, scorched ground, fires on buildings inside
  // nuke: scorch everything within R, ring of fire at the edge, mushroom of smoke
  nuke(x, z, R = 150, o = {}) {
    const t = this.uniforms.uTime.value;
    if (o.cloud !== false) { // the old column of fire and smoke (a Mushroom draws the cloud when one is made)
      const col = this.flames.alloc(80, x, 6, z, R * 0.12, R * 0.12, 14, t);
      const cap = this.smoke.alloc(90, x, 40, z, R * 0.35, R * 0.35, 9, t);
      const base = this.smoke.alloc(60, x, 3, z, R * 0.7, R * 0.7, 5, t);
      this.later(6, () => this.flames.end(col, this.uniforms.uTime.value));
      this.later(14, () => this.flames.release(col));
      this.later(60, () => { this.smoke.end(cap, this.uniforms.uTime.value); this.smoke.end(base, this.uniforms.uTime.value); });
      this.later(80, () => { this.smoke.release(cap); this.smoke.release(base); });
    }
    this.spray(x, z, 1, 60, R * 0.95, 4);
    let lit = 0;
    this.city.buildings.forEach((b, k) => {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - x, cz - z);
      if (d > R * 1.15) return;
      if (d <= R * 0.8) {
        this.city.char(k, 0.18);
        if (this.bFire[k] === 1) this.extinguish(k); // nothing left to burn
        this.bFire[k] = 2; this.soaked[k] = this.simT + 1e9;
      } else if (Math.random() < 0.6 && this.igniteBuilding(k)) lit++;
    });
    // scorched ground
    if (!this.scorch) {
      const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2);
      this.scorch = new THREE.Mesh(g, cutGround(new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: 1, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
      this.scorch.renderOrder = 1; this.scorch.visible = false; this.flames.points.parent.add(this.scorch);
    }
    this.scorch.position.set(x, 0.03, z); this.scorch.scale.setScalar(R * 0.95); this.scorch.visible = true;
    this.events.push({ type: 'nuked', x, z, lit });
    return lit;
  }

  blast(x, z, R = 25) {
    const t = this.uniforms.uTime.value;
    const fb = this.flames.alloc(60, x, 1, z, R * 0.45, R * 0.45, 5.5, t);
    const sm = this.smoke.alloc(40, x, 4, z, R * 0.6, R * 0.6, 3.5, t);
    this.later(1.2, () => this.flames.end(fb, this.uniforms.uTime.value));
    this.later(6, () => this.flames.release(fb));
    this.later(14, () => this.smoke.end(sm, this.uniforms.uTime.value));
    this.later(26, () => this.smoke.release(sm));
    this.spray(x, z, 0.5, 50, R * 0.9, 1.4);
    let lit = 0;
    this.city.buildings.forEach((b, k) => {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - x, cz - z);
      if (d > R) return;
      this.city.char(k, 0.6);
      if (Math.random() < 0.35 && this.igniteBuilding(k)) lit++;
    });
    this.events.push({ type: 'blast', x, z, lit });
    return lit;
  }

  // a fire on a car wreck at rest: burns a minute or so, smoulders, goes out
  carFire(x, z) {
    const t = this.uniforms.uTime.value;
    const fl = this.flames.alloc(10, x, 0.6, z, 1.1, 0.6, 1.5, t);
    const sm = this.smoke.alloc(10, x, 1.5, z, 1.0, 1.0, 0.8, t);
    const burn = 50 + Math.random() * 50, rec = { x, z, fl, on: true }; this.carFires.push(rec); // tracked, so flood water can drown it
    this.later(burn, () => { if (rec.on) { rec.on = false; this.flames.end(fl, this.uniforms.uTime.value); } const i = this.carFires.indexOf(rec); if (i >= 0) this.carFires.splice(i, 1); });
    this.later(burn + 6, () => { this.flames.release(fl); });
    this.later(burn + 40, () => { this.smoke.end(sm, this.uniforms.uTime.value); });
    this.later(burn + 50, () => { this.smoke.release(sm); });
  }

  igniteBuilding(k) {
    if (this.bFire[k] || this.soaked[k] > this.simT || (this.city.dead && this.city.dead[k])) return false;
    const b = this.city.buildings[k], t = this.uniforms.uTime.value;
    const rf = b.roof, cx = (rf.x0 + rf.x1) / 2, cz = (rf.z0 + rf.z1) / 2;
    const hx = Math.max(0.5, (rf.x1 - rf.x0) / 2), hz = Math.max(0.5, (rf.z1 - rf.z0) / 2);
    const area = (rf.x1 - rf.x0) * (rf.z1 - rf.z0);
    const fl = [];
    fl.push(this.flames.alloc(Math.min(48, Math.max(10, Math.round(area / 5))), cx, b.roofY, cz, hx, hz, 2.8, t));
    // flames licking out of windows
    const nWin = 2 + Math.floor(Math.random() * 4);
    for (let k2 = 0; k2 < nWin; k2++) {
      const side = Math.floor(Math.random() * 4);
      const y = b.baseY + 4 + Math.random() * Math.max(1, b.roofY - b.baseY - 6);
      let x, z, sx = 0.2, sz = 0.2;
      if (side < 2) { z = b.z0 + Math.random() * (b.z1 - b.z0); x = side === 0 ? b.x1 + 0.3 : b.x0 - 0.3; sz = 1.2; }
      else { x = b.x0 + Math.random() * (b.x1 - b.x0); z = side === 2 ? b.z1 + 0.3 : b.z0 - 0.3; sx = 1.2; }
      fl.push(this.flames.alloc(6, x, y, z, sx, sz, 1.8, t));
    }
    const sm = this.smoke.alloc(Math.min(30, 12 + Math.round(area / 20)), cx, b.roofY + 1, cz, hx, hz, Math.min(3.2, 1.2 + Math.sqrt(area) / 12), t);
    this.burning.set(k, { until: this.simT + 90 + Math.random() * 70, fl, sm });
    this.bFire[k] = 1;
    this.city.char(k, 0.75);
    this.events.push({ type: 'fire', k });
    return true;
  }

  // a building coming down: a billow of dust about as tall as it was, and a low skirt rolling out
  dustCloud(x, z, R = 10, hgt = 20) {
    const t = this.uniforms.uTime.value;
    const col = this.dust.alloc(Math.round(Math.min(36, 12 + R)), x, 0.5, z, R, R, Math.max(0.7, Math.min(3, hgt * 0.045)), t);
    const skirt = this.dust.alloc(18, x, 0.2, z, R * 2.2, R * 2.2, 0.55, t);
    this.later(3.5, () => { this.dust.end(col, this.uniforms.uTime.value); this.dust.end(skirt, this.uniforms.uTime.value); });
    this.later(12, () => { this.dust.release(col); this.dust.release(skirt); });
  }
  // a petrol bomb or laser hit: a short splash of flame
  burst(x, y, z, n = 8, size = 1.3) {
    const r = this.flames.alloc(n, x, y, z, 0.8, 0.8, size, this.uniforms.uTime.value);
    if (!r) return;
    this.later(0.7, () => this.flames.end(r, this.uniforms.uTime.value));
    this.later(5, () => this.flames.release(r));
  }
  // tear gas: a low white cloud
  gasCloud(x, z, R = 8) {
    const t = this.uniforms.uTime.value;
    const r = this.mist.alloc(16, x, 0.3, z, R, R, 0.7, t);
    if (!r) return;
    this.later(5, () => this.mist.end(r, this.uniforms.uTime.value));
    this.later(13, () => this.mist.release(r));
  }

  // ---------- fighting fires
  // a stream of water from a hose or a truck's cannon at (x0, y0, z0) to (x1, y1, z1): droplets thrown on the arc that lands there
  jet(x0, y0, z0, x1, y1, z1, n = 1, size = 0.5) {
    const J = this.jets; if (!J) return;
    const dx = x1 - x0, dz = z1 - z0, T = Math.max(0.3, Math.hypot(dx, dz) / 24);
    J.emit(x0, y0, z0, n, { v: [dx / T, (y1 - y0 + 4.9 * T * T) / T, dz / T], spread: 0.5, life: T * 1.15, size });
  }
  // a short burst of white mist (hose spray, water drop)
  spray(x, z, y = 1.5, n = 4, spread = 1.2, size = 0.5) {
    const t = this.uniforms.uTime.value;
    const r = this.mist.alloc(n, x, y, z, spread, spread, size, t);
    if (!r) return;
    this.later(2.0, () => this.mist.end(r, this.uniforms.uTime.value));
    this.later(9, () => this.mist.release(r));
  }

  // hosing: dt seconds of water on building k; out after 20 s of it
  douse(k, dt) {
    const f = this.burning.get(k);
    if (!f || this.bFire[k] !== 1) return false;
    f.wet = (f.wet || 0) + dt;
    if (f.wet >= 20) this.extinguish(k);
    return true;
  }

  extinguish(k) {
    if (this.bFire[k] !== 1) return false;
    const f = this.burning.get(k);
    for (const r of f.fl) this.flames.end(r, this.realT);
    this.bFire[k] = 3;
    const fl = f.fl, sm = f.sm;
    this.later(6, () => { for (const r of fl) this.flames.release(r); });
    this.later(18, () => { this.smoke.end(sm, this.uniforms.uTime.value); });
    this.later(28, () => { this.smoke.release(sm); });
    for (const j of this.neighbours(k)) this.soak(j);
    this.stats.out++;
    this.events.push({ type: 'fireout', k });
    return true;
  }

  // water over the street: car fires and buildings burning at street level go out in a hiss of steam
  quench(depthAt) {
    for (const f of this.carFires) if (f.on && depthAt(f.x, f.z) > 0.45) { f.on = false; this.flames.end(f.fl, this.uniforms.uTime.value); this.steam(f.x, f.z); }
    for (const [k] of this.burning) {
      if (this.bFire[k] !== 1) continue;
      const b = this.city.buildings[k];
      if (depthAt(b.x0 - 1.5, (b.z0 + b.z1) / 2) > 1.1 || depthAt(b.x1 + 1.5, (b.z0 + b.z1) / 2) > 1.1 || depthAt((b.x0 + b.x1) / 2, b.z0 - 1.5) > 1.1 || depthAt((b.x0 + b.x1) / 2, b.z1 + 1.5) > 1.1) {
        if (this.extinguish(k)) this.steam((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.5);
      }
    }
  }
  steam(x, z, R = 2) { const t = this.uniforms.uTime.value, sm = this.smoke.alloc(Math.round(4 + R), x, 1, z, R, R, 1.2, t); this.later(2.5, () => this.smoke.end(sm, this.uniforms.uTime.value)); this.later(12, () => this.smoke.release(sm)); }

  // the building is gone (tornado, collapse): its flames go with it
  gone(k) {
    const f = this.burning.get(k);
    if (f && this.bFire[k] === 1) { for (const r of f.fl) { this.flames.end(r, this.realT); } const fl = f.fl, sm = f.sm; this.later(4, () => { for (const r of fl) this.flames.release(r); }); this.later(8, () => this.smoke.end(sm, this.uniforms.uTime.value)); this.later(18, () => this.smoke.release(sm)); }
    this.bFire[k] = 2; this.soaked[k] = 1e9;
  }

  soak(k, secs = 150) { this.soaked[k] = Math.max(this.soaked[k], this.simT + secs); }

  firesWithin(x, z, R) {
    const out = [];
    for (const [k] of this.burning) {
      if (this.bFire[k] !== 1) continue;
      const b = this.city.buildings[k], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - x, cz - z);
      if (d <= R) out.push([d, k]);
    }
    return out.sort((a, b) => a[0] - b[0]).map(e => e[1]);
  }

  // helicopter drop: everything within R goes out and stays wet
  dropWater(x, z, R = 40) {
    let n = 0;
    for (const k of this.firesWithin(x, z, R)) if (this.extinguish(k)) n++;
    this.city.buildings.forEach((b, k) => { if (Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z) <= R) this.soak(k, 200); });
    this.spray(x, z, 2, 70, R * 0.9, 1.8);
    this.spray(x, z, 6, 30, R * 0.5, 1.2);
    this.stats.drops++;
    this.events.push({ type: 'waterdrop', x, z, n });
    return n;
  }

  neighbours(k) {
    const b = this.city.buildings[k];
    if (b._nb) return b._nb;
    const out = [], m = 2.0;
    this.city.buildings.forEach((o, j) => {
      if (j === k) return;
      if (o.x0 - m < b.x1 && o.x1 + m > b.x0 && o.z0 - m < b.z1 && o.z1 + m > b.z0) out.push(j);
    });
    b._nb = out;
    return out;
  }

  // dt is simulation time (scaled by game speed); realT drives the sprite animation
  update(dt, realT, camera, renderer) {
    this.uniforms.uTime.value = realT; this.realT = realT;
    const h = renderer.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2())).y;
    this.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.simT += dt;
    this.spreadT += dt;
    const doSpread = this.spreadT >= 4; if (doSpread) this.spreadT = 0;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.simT >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    for (const [k, f] of this.burning) {
      if (this.rainK && this.bFire[k] === 1) f.until -= dt * this.rainK; // rain beats fires down
      if (this.simT >= f.until && this.bFire[k] === 1) {
        for (const r of f.fl) this.flames.end(r, realT);
        this.bFire[k] = 2;
        this.city.char(k, 0.45);
        const fl = f.fl, sm = f.sm;
        this.later(6, () => { for (const r of fl) this.flames.release(r); });
        this.later(70 + Math.random() * 50, () => { this.smoke.end(sm, this.uniforms.uTime.value); });
        this.later(130, () => { this.smoke.release(sm); });
        continue;
      }
      if (doSpread && this.bFire[k] === 1) {
        for (const j of this.neighbours(k)) if (!this.bFire[j] && this.soaked[j] <= this.simT && Math.random() < 0.006 * this.spreadK) this.igniteBuilding(j);
      }
    }
  }
}
