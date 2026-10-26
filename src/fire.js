// Fire and smoke: GPU-animated point sprites (one draw call each), plus
// building fire logic (burn time, spread to neighbours, charring).
import * as THREE from 'three';

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
varying float vA; varying float vT;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vA;
  vec3 c = mix(vec3(0.06, 0.05, 0.045), vec3(0.34, 0.31, 0.28), vT);
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
    this.smoke = new Pool(low ? 1600 : 3200, SMOKE_VS, SMOKE_FS, THREE.NormalBlending, parent, this.uniforms);
    this.smoke.points.renderOrder = 3; this.flames.points.renderOrder = 4;
    this.events = [];
    this.reset();
  }

  reset() {
    this.flames.reset(); this.smoke.reset();
    this.burning = new Map(); // building index -> { until, fl: [], sm }
    this.bFire = new Uint8Array(this.city.buildings.length); // 0 none, 1 burning, 2 burnt out
    this.simT = 0; this.spreadT = 0;
    this.timers = []; // { at (sim time), fn }
  }

  later(dt, fn) { this.timers.push({ at: this.simT + dt, fn }); }

  // a fire on a car wreck at rest: burns a minute or so, smoulders, goes out
  carFire(x, z) {
    const t = this.uniforms.uTime.value;
    const fl = this.flames.alloc(10, x, 0.6, z, 1.1, 0.6, 1.5, t);
    const sm = this.smoke.alloc(10, x, 1.5, z, 1.0, 1.0, 0.8, t);
    const burn = 50 + Math.random() * 50;
    this.later(burn, () => { this.flames.end(fl, this.uniforms.uTime.value); });
    this.later(burn + 6, () => { this.flames.release(fl); });
    this.later(burn + 40, () => { this.smoke.end(sm, this.uniforms.uTime.value); });
    this.later(burn + 50, () => { this.smoke.release(sm); });
  }

  igniteBuilding(k) {
    if (this.bFire[k]) return false;
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
    this.uniforms.uTime.value = realT;
    const h = renderer.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2())).y;
    this.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.simT += dt;
    this.spreadT += dt;
    const doSpread = this.spreadT >= 4; if (doSpread) this.spreadT = 0;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.simT >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    for (const [k, f] of this.burning) {
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
        for (const j of this.neighbours(k)) if (!this.bFire[j] && Math.random() < 0.006) this.igniteBuilding(j);
      }
    }
  }
}
