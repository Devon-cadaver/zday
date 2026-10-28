// The tornado, rebuilt for this world: a soft, lit, noise-banded funnel (two
// shader layers that feather at the edges and melt into the cloud), a rotating
// wall cloud and churning dust ring as GPU sprites, orbiting junk, and real
// interactions: people, cars, parked cars, trees and whole buildings are
// pulled in, spun up the funnel and flung out.
import * as THREE from 'three';
import { Brace } from './brace.js';

const NOISE = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

const FUNNEL_VS = /* glsl */`
uniform float uTime, uH, uR0, uR1, uRope, uDescend, uWob, uWiden;
uniform vec2 uLean;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vY;
void main() {
  float y0 = position.y;                      // 0 bottom .. 1 top
  float y = 1.0 - (1.0 - y0) * uDescend;       // descends from the cloud base
  float ang = atan(position.z, position.x);
  float r = (uR0 + pow(y, 2.2) * uR1) * uWiden;
  r *= 1.0 + 0.13 * sin(ang * 3.0 + uTime * 2.3 + y * 9.0) * (0.35 + y * 0.65);
  r *= mix(1.0, 0.25 + 0.75 * pow(y, 0.6), uRope);
  vec3 p = vec3(cos(ang) * r, y * uH, sin(ang) * r);
  p.xz += uLean * pow(y, 1.5) * uH * 0.22;
  float bend = pow(1.0 - y, 1.5);
  p.x += sin(uTime * 0.9 + y * 4.0) * uWob * bend * uH * 0.04;
  p.z += cos(uTime * 0.7 + y * 3.3) * uWob * bend * uH * 0.04;
  vec3 n = normalize(vec3(cos(ang), -0.45 * pow(y, 1.2) * uR1 / uH, sin(ang)));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vUv = vec2(ang / 6.2832 + 0.5, y); vY = y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FUNNEL_FS = /* glsl */`
uniform vec3 uColA, uColB, uDust, uSunDir, uFogColor; uniform float uAlpha, uTime, uSpin, uFade, uFogDensity, uBand, uLight;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vY;
${NOISE}
void main() {
  float spin = uTime * uSpin * (1.5 - 0.8 * vY);
  vec2 q = vec2(vUv.x * 4.0 + spin * 0.3 + vY * 2.2, vY * 4.0 * uBand - uTime * 0.7);
  float n = fbm(q);
  float streak = fbm(vec2(vUv.x * 18.0 + spin * 0.55 + vY * 5.0, vY * 1.3 + uTime * 0.1));
  float d = smoothstep(0.2, 0.9, n * 0.75 + streak * 0.45);
  vec3 col = mix(uColA, uColB, d);
  vec3 N = normalize(vN);
  col *= 0.55 + 0.6 * max(0.0, dot(N, uSunDir)) + 0.12 * d;
  col = mix(col, uDust, smoothstep(0.25, 0.0, vY) * 0.7);
  col *= uLight;
  vec3 V = normalize(cameraPosition - vW);
  float facing = abs(dot(N, V));
  col *= 0.8 + 0.2 * smoothstep(0.0, 0.6, facing);
  float a = uAlpha * smoothstep(0.0, 0.32, facing) * (0.72 + 0.28 * d);
  a *= smoothstep(1.0, 0.8, vY) * uFade;
  float dist = length(cameraPosition - vW);
  float f = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  col = mix(col, uFogColor, f * 0.85);
  gl_FragColor = vec4(col, a);
}`;

const PUFF_VS = /* glsl */`
uniform float uTime, uR, uH, uScale, uFade, uSpin, uRise, uR0;
uniform vec3 uCenter;
attribute vec4 aP;
varying float vA; varying float vShade;
void main() {
  float r = uR0 + aP.x * uR;
  float ang = aP.y + uTime * uSpin * (0.35 + 0.9 * (1.0 - aP.x));
  float y = uRise > 0.0 ? mod(aP.z + uTime * uRise, uH) : uH + aP.z;
  vec3 p = uCenter + vec3(cos(ang) * r, y, sin(ang) * r);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = aP.w * uScale / -mv.z;
  vA = uFade * (uRise > 0.0 ? (1.0 - y / uH) : (0.6 + 0.4 * (1.0 - aP.x)));
  vShade = clamp(0.35 + aP.z * 0.06 + aP.x * 0.3, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const PUFF_FS = /* glsl */`
uniform vec3 uColA, uColB; uniform float uAlpha, uLight;
varying float vA; varying float vShade;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  float a = smoothstep(0.5, 0.1, d) * vA * uAlpha;
  gl_FragColor = vec4(mix(uColA, uColB, vShade) * uLight, a);
}`;

function puffs(n, gen, colA, colB, alpha) {
  const g = new THREE.BufferGeometry(), aP = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) gen(aP, i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(aP, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uR: { value: 1 }, uR0: { value: 0 }, uH: { value: 1 }, uScale: { value: 500 }, uFade: { value: 0 }, uSpin: { value: 1 }, uRise: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) }, uAlpha: { value: alpha }, uLight: { value: 1 } },
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return pts;
}

export class Twister {
  constructor(D, x, z, opts = {}) {
    this.D = D; this.x = x; this.z = z;
    this.size = opts.size ?? 1.6; this.player = !!opts.player;
    this.life = opts.life ?? 55 + Math.random() * 20; this.heading = opts.heading ?? Math.random() * 6.28;
    this.speed = opts.speed ?? 7; this.t = 0; this.phase = this.player ? 'ground' : 'form';
    this.descend = this.player ? 1 : 0; this.fade = this.player ? 1 : 0; this.rope = 0;
    this.lean = new THREE.Vector2(); this.vx = 0; this.vz = 0; this.steerT = null;
    this.orbit = []; this.carOrbit = []; this.damaged = new Set(); this.trail = 0; this.stepN = 0; this.boltT = 3;
    this.onEat = opts.onEat || null; this.eaten = { buildings: 0, people: 0, zombies: 0, cars: 0, trees: 0 };
    const scene = D.ctx.scene;
    const funnel = (alpha, a, b, spin, widen) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 48, 40, true); geo.translate(0, 0.5, 0);
      const mat = new THREE.ShaderMaterial({
        vertexShader: FUNNEL_VS, fragmentShader: FUNNEL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 }, uH: { value: 100 }, uR0: { value: 4 }, uR1: { value: 30 }, uRope: { value: 0 }, uDescend: { value: 0 }, uWob: { value: 1 }, uWiden: { value: widen }, uLean: { value: new THREE.Vector2() },
          uColA: { value: new THREE.Color(a) }, uColB: { value: new THREE.Color(b) }, uDust: { value: new THREE.Color('#8a7356') }, uSunDir: { value: new THREE.Vector3(-0.78, 0.72, -0.2).normalize() },
          uFogColor: { value: new THREE.Color('#d9bf95') }, uAlpha: { value: alpha }, uSpin: { value: spin }, uFade: { value: 0 }, uFogDensity: { value: 0.0006 }, uBand: { value: 1 }, uLight: { value: 1 },
        },
      });
      const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 4; scene.add(m); return m;
    };
    this.inner = funnel(1.0, '#302e2d', '#6e685f', 2.2, 1);
    this.outer = funnel(0.36, '#6a655e', '#a89e8c', 1.4, 1.3);
    this.outer.material.uniforms.uBand.value = 0.7;
    this.cloud = puffs(170, (a, o) => { a[o] = Math.sqrt(Math.random()); a[o + 1] = Math.random() * 6.28; a[o + 2] = (Math.random() - 0.3) * 10; a[o + 3] = 26 + Math.random() * 30; }, '#2e3138', '#6a6c72', 0.75);
    this.dust = puffs(220, (a, o) => { a[o] = Math.random(); a[o + 1] = Math.random() * 6.28; a[o + 2] = Math.random() * 16; a[o + 3] = 6 + Math.random() * 9; }, '#6a5a44', '#b09a78', 0.6);
    this.dust.material.uniforms.uRise.value = 3.2;
    scene.add(this.cloud, this.dust);
    // junk riding the vortex
    const JN = 140;
    this.junk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), JN);
    this.junk.frustumCulled = false; this.junk.castShadow = true; scene.add(this.junk);
    const pal = ['#7a5a3a', '#5a3a26', '#3a3a40', '#d8d0c0', '#8a8f96', '#a04030', '#c9a57a', '#6a7a40', '#e3cba4'];
    this.junkP = [];
    for (let i = 0; i < JN; i++) {
      const plank = Math.random() < 0.45;
      this.junkP.push({ a: Math.random() * 6.28, y: Math.random(), sz: plank ? [1.6 + Math.random() * 1.6, 0.18, 0.4] : [0.4 + Math.random() * 0.8, 0.4 + Math.random() * 0.8, 0.4 + Math.random() * 0.7], spin: [Math.random() * 6, Math.random() * 6, Math.random() * 6], jit: Math.random() });
      this.junk.setColorAt(i, new THREE.Color(pal[i % pal.length]));
    }
    this.vortIndex = D.debris.vortices.length;
    this.vort = { x, z, H: 100, scale: 1, spin: 1, alive: true, radiusAt: (y) => this.radiusAt(y) };
    D.debris.vortices.push(this.vort);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.applySize();
  }

  get reach() { return 8 + 6 * this.size; }
  get maxH() { return 10 + (this.size - 1) * 22; } // an EF5+ monster (size above 3) tears down towers
  applySize() {
    this.H = 110 + 18 * this.size; this.r0 = this.reach * 0.4; this.r1 = 20 + 10 * this.size;
    this.vort.H = this.H; this.vort.scale = 0.8 + this.size * 0.25;
  }
  radiusAt(y) { const k = Math.max(0, Math.min(1, y / this.H)); return (this.r0 + Math.pow(k, 2.2) * this.r1); }
  // the funnel leans into its direction of travel: sideways offset at height y
  leanAt(y) { return Math.pow(Math.max(0, Math.min(1, y / this.H)), 1.5) * this.H * 0.22; }
  get alive() { return this.phase !== 'gone'; }
  get onGround() { return this.phase === 'ground' && this.descend > 0.85; }
  steer(x, z) { this.steerT = [x, z]; }

  grow(m) {
    if (!this.player) return;
    this.mass = (this.mass || 0) + m;
    const target = this.massTarget || 12000;
    this.size = Math.min(3, 1 + 2 * Math.min(1, this.mass / target));
    this.applySize();
  }

  update(h) {
    const D = this.D, { people, traffic, city } = D.ctx;
    this.t += h;
    if (this.phase === 'ground') (this.brace || (this.brace = new Brace(D, (x, z) => [Math.hypot(x - this.x, z - this.z) - this.reach * 2, this.x, this.z], { range: 300, curl: false }))).update(h); // seen coming: run, turn round and drive off
    // lifecycle
    if (this.phase === 'form') { this.fade = Math.min(1, this.fade + h / 3); this.descend = Math.min(1, Math.max(0, (this.t - 3) / 5)); if (this.descend >= 1) this.phase = 'ground'; }
    else if (this.phase === 'ground' && !this.player && this.t > this.life) { this.phase = 'rope'; this.ropeT = 0; }
    else if (this.phase === 'rope') { this.ropeT += h; this.rope = Math.min(1, this.ropeT / 3); if (this.ropeT > 3) this.descend = Math.max(0, 1 - (this.ropeT - 3) / 3); if (this.ropeT > 6) this.fade = Math.max(0, this.fade - h / 3); if (this.ropeT > 9) { this.phase = 'gone'; this.vort.alive = false; } }
    // movement
    const B = city.bounds;
    let tvx, tvz;
    if (this.player) {
      if (this.steerT) { const dx = this.steerT[0] - this.x, dz = this.steerT[1] - this.z, d = Math.hypot(dx, dz); if (d > 2) { const sp = this.speed * (1 + this.size * 0.15); tvx = dx / d * sp; tvz = dz / d * sp; } else { tvx = 0; tvz = 0; } }
      else { tvx = 0; tvz = 0; }
    } else {
      this.heading += (Math.random() - 0.5) * h * 0.8;
      const m = 40;
      if (this.x < B.x0 + m) this.heading = 0; else if (this.x > B.x1 - m) this.heading = Math.PI;
      if (this.z < B.z0 + m) this.heading = Math.PI / 2; else if (this.z > B.z1 - m) this.heading = -Math.PI / 2;
      tvx = Math.cos(this.heading) * this.speed; tvz = Math.sin(this.heading) * this.speed;
    }
    const k = Math.min(1, h * 1.5); this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    this.x = Math.min(B.x1, Math.max(B.x0, this.x + this.vx * h)); this.z = Math.min(B.z1, Math.max(B.z0, this.z + this.vz * h));
    this.lean.x += (this.vx * 0.12 - this.lean.x) * Math.min(1, h); this.lean.y += (this.vz * 0.12 - this.lean.y) * Math.min(1, h);
    this.vort.x = this.x; this.vort.z = this.z; this.vort.lx = this.lean.x * this.H * 0.22; this.vort.lz = this.lean.y * this.H * 0.22;
    // lightning out of the wall cloud
    this.boltT -= h;
    if (this.boltT <= 0 && this.fade > 0.6) { this.boltT = 1.5 + Math.random() * 4; const a = Math.random() * 6.28, d = this.reach + 10 + Math.random() * 50; D.strike(this.x + Math.cos(a) * d, this.z + Math.sin(a) * d, { from: this.H * 0.95, mild: true }); }
    this.updateOrbits(h);
    if (!this.onGround) return;
    const R = this.reach, x = this.x, z = this.z;
    // ground track
    this.trail += Math.hypot(this.vx, this.vz) * h;
    if (this.trail > 7) { this.trail = 0; D.decals.add('scour', x + (Math.random() - 0.5) * 3, z + (Math.random() - 0.5) * 3, R * 2.3, R * 2.3); }
    // people: pulled in, then taken
    people.around(x, z, R * 2.6, (j, d2) => {
      const s = people.st[j]; const d = Math.sqrt(d2);
      if (d < R) { this.take(j); return; }
      if (s === 6 || s === 22) { const dx = x - people.x[j], dz = z - people.z[j]; people.move(j, dx / d, dz / d, (1 - d / (R * 2.6)) * 4 * h); }
      else if (d < R * 2.6 && people.isCivilian(j) && Math.random() < h * 2) people.panic(j, x, z, -1);
    });
    for (const j of people.lifted) this.addOrbit(j); people.lifted.length = 0;
    // cars
    traffic.near(x, z, R + 3, (car) => { if (Math.hypot(car.x - x, car.z - z) < R && traffic.grab(car)) { this.carOrbit.push({ car, a: Math.atan2(car.z - z, car.x - x), hy: this.H * (0.08 + Math.random() * 0.3), t: 0, hold: 2 + Math.random() * 2.5 }); this.eat('cars', 30); } });
    for (const pc of traffic.parkedNear(x, z, R)) {
      traffic.takeParked(pc);
      const o = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); o.castShadow = true; o.position.set(pc.x, 0.3, pc.z); o.rotation.y = pc.rot;
      D.debris.addObject(o, 'orbit', { vort: this.vortIndex, hold: 2 + Math.random() * 3 }); this.eat('cars', 25);
    }
    // street trees and lamps
    for (const it of city.takeStreetNear(x, z, R)) {
      if (it.kind === 'tree') { for (let n = 0; n < 3; n++) D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.7, it.s * 0.9, it.col, 'orbit', { vort: this.vortIndex }); D.debris.add(it.x, 2, it.z, 0.4, 3, 0.4, '#5a4430', 'orbit', { vort: this.vortIndex }); }
      else D.debris.add(it.x, 3, it.z, 0.25, 6.5, 0.25, '#4a4540', 'orbit', { vort: this.vortIndex });
      this.eat('trees', 4);
    }
    // buildings (every third step)
    if (++this.stepN % 3 === 0) {
      city.buildingsNear(x, z, R * 0.85, (kb, d, b) => {
        const hgt = b.top - b.baseY;
        if (hgt <= this.maxH) { if (D.destroyBuilding(kb, 'tear', { vort: this.vortIndex })) { for (const j of people.lifted) this.addOrbit(j); people.lifted.length = 0; this.eat('buildings', 40 + hgt * 6); } }
        else if (!this.damaged.has(kb)) {
          this.damaged.add(kb); city.char(kb, 0.86);
          const wc = b.wallCol, hex = new THREE.Color(wc[0], wc[1], wc[2]).getHex();
          for (let n = 0; n < 8; n++) D.debris.add(b.x0 + Math.random() * (b.x1 - b.x0), b.baseY + Math.random() * hgt, b.z0 + Math.random() * (b.z1 - b.z0), 0.6 + Math.random(), 0.3 + Math.random() * 0.6, 0.6 + Math.random(), hex, 'orbit', { vort: this.vortIndex });
          if (people.bRoofAll[kb]) people.around(x, z, R + 30, (j) => this.take(j), kb); // swept off the roof
        }
      });
      // zombie piles against nearby walls are torn away too
      city.buildingsNear(x, z, R + 6, (kb) => { if (people.bPile[kb]) for (let i = 0; i < people.active; i++) if ((people.st[i] === 12 || people.st[i] === 13) && people.bt[i] === kb) this.take(i); });
    }
  }

  eat(kind, value) { this.eaten[kind]++; if (this.onEat) this.onEat(kind, value); this.grow(value * 0.4); }

  take(j) {
    const p = this.D.ctx.people;
    const s = p.st[j];
    if (s === 19 || s === 20 || s === 8) return;
    if (!p.grab(j)) return;
    this.addOrbit(j);
    if (p.wz[j]) this.eat('zombies', 15); else this.eat('people', 10);
  }
  addOrbit(j) {
    const p = this.D.ctx.people;
    if (this.orbit.length > 160) { p.fling(j, (Math.random() - 0.5) * 30, 14, (Math.random() - 0.5) * 30); return; }
    this.orbit.push({ j, a: Math.atan2(p.z[j] - this.z, p.x[j] - this.x), hy: this.H * (0.12 + Math.random() * 0.55), t: 0, hold: 1.8 + Math.random() * 2.8 });
  }

  updateOrbits(h) {
    const p = this.D.ctx.people, tr = this.D.ctx.traffic;
    const sc = this.vort.scale;
    for (let n = this.orbit.length - 1; n >= 0; n--) {
      const o = this.orbit[n], j = o.j;
      if (p.st[j] !== 19) { this.orbit.splice(n, 1); continue; }
      o.t += h;
      p.y[j] += (o.hy - p.y[j]) * Math.min(1, h * 0.9);
      o.a += h * (2.6 - (p.y[j] / this.H) * 1.3);
      const r = this.radiusAt(p.y[j]) * 0.95, f = Math.min(1, h * 3);
      const lj = this.leanAt(p.y[j]);
      p.x[j] += (this.x + this.lean.x * lj + Math.cos(o.a) * r - p.x[j]) * f; p.z[j] += (this.z + this.lean.y * lj + Math.sin(o.a) * r - p.z[j]) * f;
      p.hx[j] = -Math.sin(o.a); p.hz[j] = Math.cos(o.a);
      if (o.t > o.hold || !this.vort.alive || this.descend < 0.5) {
        const out = 10 + Math.random() * 10, tan = 16 + Math.random() * 14;
        p.fling(j, (Math.cos(o.a) * out - Math.sin(o.a) * tan) * sc, 5 + Math.random() * 8, (Math.sin(o.a) * out + Math.cos(o.a) * tan) * sc);
        this.orbit.splice(n, 1);
      }
    }
    for (let n = this.carOrbit.length - 1; n >= 0; n--) {
      const o = this.carOrbit[n], car = o.car;
      if (car.mode !== 4) { this.carOrbit.splice(n, 1); continue; }
      o.t += h;
      car.y += (o.hy - car.y) * Math.min(1, h * 0.8);
      o.a += h * (2.2 - (car.y / this.H));
      const r = this.radiusAt(car.y) * 1.1, f = Math.min(1, h * 2.5);
      const lc = this.leanAt(car.y);
      car.x += (this.x + this.lean.x * lc + Math.cos(o.a) * r - car.x) * f; car.z += (this.z + this.lean.y * lc + Math.sin(o.a) * r - car.z) * f;
      car.yaw += h * 3; car.roll += h * 2.2; car.pitch += h * 1.3;
      if (o.t > o.hold || !this.vort.alive || this.descend < 0.5) {
        tr.fling(car, (Math.cos(o.a) * 10 - Math.sin(o.a) * 20) * sc, 6 + Math.random() * 6, (Math.sin(o.a) * 10 + Math.cos(o.a) * 20) * sc);
        this.carOrbit.splice(n, 1);
      }
    }
  }

  sync(dt, realT) {
    const { scene, camera, renderer, sun } = this.D.ctx;
    const fogC = scene.background, fogD = scene.fog ? scene.fog.density : 0.0006;
    const sunDir = this._p.copy(sun.position).sub(sun.target.position).normalize();
    for (const m of [this.inner, this.outer]) {
      const u = m.material.uniforms;
      m.position.set(this.x, 0, this.z);
      u.uTime.value = realT; u.uH.value = this.H; u.uR0.value = this.r0; u.uR1.value = this.r1; u.uRope.value = this.rope;
      u.uDescend.value = this.descend; u.uFade.value = this.fade; u.uLean.value.copy(this.lean);
      u.uFogColor.value.copy(fogC); u.uFogDensity.value = fogD; u.uSunDir.value.copy(sunDir); u.uLight.value = this.D.lightK;
    }
    const h = renderer.getDrawingBufferSize(this._s2 || (this._s2 = new THREE.Vector2())).y;
    const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const cu = this.cloud.material.uniforms;
    cu.uCenter.value.set(this.x + this.lean.x * this.H * 0.22, 0, this.z + this.lean.y * this.H * 0.22); cu.uTime.value = realT; cu.uR.value = this.r1 * 2.4 + 20; cu.uR0.value = this.r1 * 0.3;
    cu.uLight.value = this.D.lightK; this.dust.material.uniforms.uLight.value = this.D.lightK;
    cu.uH.value = this.H * 0.97; cu.uScale.value = scale; cu.uFade.value = this.fade; cu.uSpin.value = 0.35;
    const du = this.dust.material.uniforms;
    du.uCenter.value.set(this.x, 0, this.z); du.uTime.value = realT; du.uR.value = this.reach * 1.6; du.uR0.value = this.r0 * 0.8;
    du.uH.value = 10 + this.size * 6; du.uScale.value = scale; du.uFade.value = this.fade * Math.max(0, (this.descend - 0.6) / 0.4) * (1 - this.rope * 0.7); du.uSpin.value = 2.6;
    // junk
    const m = this._m, q = this._q, e = this._e, p = this._p, s = this._s;
    const vis = this.descend > 0.7 ? this.fade * (1 - this.rope) : 0;
    for (let i = 0; i < this.junkP.length; i++) {
      const jp = this.junkP[i];
      jp.y += dt * (0.08 + jp.jit * 0.08); if (jp.y > 0.9) jp.y = 0.02;
      jp.a += dt * (4.2 - jp.y * 2.6);
      const y = jp.y * this.H, r = this.radiusAt(y) * (0.92 + jp.jit * 0.3);
      e.set(realT * jp.spin[0], realT * jp.spin[1], realT * jp.spin[2]); q.setFromEuler(e);
      m.compose(p.set(this.x + Math.cos(jp.a) * r + this.lean.x * Math.pow(jp.y, 1.5) * this.H * 0.22, y, this.z + Math.sin(jp.a) * r + this.lean.y * Math.pow(jp.y, 1.5) * this.H * 0.22), q, s.set(jp.sz[0] * vis, jp.sz[1] * vis, jp.sz[2] * vis));
      this.junk.setMatrixAt(i, m);
    }
    this.junk.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    const scene = this.D.ctx.scene;
    for (const o of [this.inner, this.outer, this.cloud, this.dust, this.junk]) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    this.vort.alive = false;
    const p = this.D.ctx.people;
    for (const o of this.orbit) if (p.st[o.j] === 19) p.fling(o.j, (Math.random() - 0.5) * 20, 6, (Math.random() - 0.5) * 20);
    for (const o of this.carOrbit) if (o.car.mode === 4) this.D.ctx.traffic.fling(o.car, (Math.random() - 0.5) * 16, 5, (Math.random() - 0.5) * 16);
    this.orbit.length = 0; this.carOrbit.length = 0;
  }
}
