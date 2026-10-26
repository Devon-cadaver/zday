// Nuclear blasts. Mushroom is the look of one (also used by the commander's
// nuke and by big meteor impacts): a blinding fireball, a shock dome and a
// ground ring racing out, then a rolling cap of glowing cloud that cools to
// grey-brown smoke on a rising stem, with a surge of dust spreading along the
// ground. NuclearStrike is the disaster: air raid sirens, a missile streaking
// in, and a detonation that flattens the blocks around it and sets the
// district burning. Meltdown is a power plant reactor going critical.
import * as THREE from 'three';
import { NOISE } from './water.js';
import { Hole } from './impact.js';

const PUFF_VS = /* glsl */`
attribute vec4 aP; // seed, shade, spin, glow
uniform float uTime;
varying vec2 vUv; varying vec4 vP;
void main() {
  vUv = uv; vP = aP;
  vec4 c = viewMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));
  float s = length(instanceMatrix[0].xyz), a = aP.z + uTime * 0.05 * (aP.x - 0.5);
  c.xy += mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy * s;
  gl_Position = projectionMatrix * c;
}`;
const PUFF_FS = /* glsl */`
uniform vec3 uLit, uShade, uSunV; uniform float uLight, uTime, uFade;
varying vec2 vUv; varying vec4 vP;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float n = fbm(p * 2.3 + vP.x * 41.0 + vec2(0.0, -uTime * 0.06)), n2 = fbm(p * 5.5 + vP.x * 13.0);
  float edge = r + (n - 0.5) * 0.6 + (n2 - 0.5) * 0.15;
  if (edge > 1.0) discard;
  vec3 N = normalize(vec3(p * 1.15 + (n - 0.5) * 0.9, sqrt(max(0.0, 1.0 - r * r)) + 0.15));
  float lit = clamp(dot(N, uSunV) * 0.65 + 0.4, 0.0, 1.0);
  vec3 col = mix(uShade, uLit, smoothstep(0.0, 1.0, lit * 0.8 + 0.2)) * (0.88 + 0.24 * vP.y) * uLight;
  // the inside of the young cloud still burns
  col += mix(vec3(4.0, 1.4, 0.3), vec3(6.0, 4.0, 1.6), smoothstep(0.6, 1.0, vP.w)) * vP.w * (0.55 + 0.45 * n) * (1.0 - r * 0.5);
  float a = smoothstep(1.0, 0.45, edge) * smoothstep(1.0, 0.8, r) * uFade;
  if (a < 0.06) discard;
  gl_FragColor = vec4(col, a);
}`;
const BALL_VS = /* glsl */`
varying vec3 vN; varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const BALL_FS = /* glsl */`
uniform float uTime, uAge;
varying vec3 vN; varying vec3 vW;
${NOISE}
void main() {
  vec3 V = normalize(cameraPosition - vW); float fres = 1.0 - abs(dot(normalize(vN), V));
  float n = fbm(vW.xz * 0.04 + vec2(vW.y * 0.05, uTime * 0.6)) * 0.7 + fbm(vW.xy * 0.09 - uTime * 0.4) * 0.3;
  vec3 col = mix(vec3(9.0, 7.5, 4.5), vec3(4.0, 1.1, 0.2), clamp(fres * 0.9 + uAge * 0.7 + (n - 0.5) * 0.6, 0.0, 1.0)) * (0.65 + 0.7 * n);
  gl_FragColor = vec4(col, (1.0 - uAge) * (1.0 - fres * fres * 0.6));
}`;

// the look of a nuclear blast; lives in D.leftovers until it has drifted away
export class Mushroom {
  constructor(D, x, z, R, o = {}) {
    this.D = D; this.x = x; this.z = z; this.R = R; this.t = 0; this.life = o.life ?? 150; this.alive = true;
    const n = D.ctx.low ? 170 : 280, scene = D.ctx.scene;
    this.P = [];
    for (let k = 0; k < n; k++) {
      const r = Math.random(), kind = r < 0.46 ? 'cap' : r < 0.7 ? 'stem' : 'surge';
      this.P.push({ kind, u: Math.random() * Math.PI * 2, v: Math.random() * Math.PI * 2, f: Math.random(), k: Math.random(), size: 0.7 + Math.random() * 0.6, seed: Math.random(), shade: Math.random(), spin: Math.random() * 6.28 });
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); geo.setAttribute('aP', this.aP);
    this.mat = new THREE.ShaderMaterial({ vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: true,
      uniforms: { uTime: { value: 0 }, uLit: { value: new THREE.Color(o.lit ?? '#e4d4be') }, uShade: { value: new THREE.Color(o.shade ?? '#6e5e52') }, uSunV: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: 1 }, uFade: { value: 1 } } });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, n); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    // fireball, shock dome and ground ring
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({ vertexShader: BALL_VS, fragmentShader: BALL_FS, transparent: true, uniforms: { uTime: { value: 0 }, uAge: { value: 0 } } }));
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f4f0ea', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#efe4d0', transparent: true, opacity: 0.7, depthWrite: false }));
    this.ball.position.set(x, 0, z); this.dome.position.set(x, 0, z); this.ring.position.set(x, 1.5, z);
    this.dome.renderOrder = 7; this.ring.renderOrder = 7;
    scene.add(this.mesh, this.ball, this.dome, this.ring);
    this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this.order = this.P.map((p, i) => i);
    this.wind = new THREE.Vector2(0.35, -0.2).normalize();
    D.leftovers.push(this);
  }
  update(h) { this.t += h; for (const p of this.P) if (p.kind === 'stem') { p.f += h * 0.03; if (p.f > 1) p.f -= 1; } }
  sync(dt, realT) {
    const D = this.D, R = this.R, t = this.t, cam = D.ctx.camera.position, P = this.P;
    const Hc = R * 1.25 * (1 - Math.exp(-t / 7)) + R * 0.1, rr = R * 0.36 * (1 - Math.exp(-t / 6)) + R * 0.05, rm = R * 0.17 * (1 - Math.exp(-t / 4)) + R * 0.04;
    const stemR = R * 0.09 * (1 + t * 0.008), Rs = R * 1.35 * (1 - Math.exp(-t / 2.2)), hot = Math.exp(-t / 7), drift = Math.min(t * 0.6, 60);
    const cx = this.x + this.wind.x * drift, cz = this.z + this.wind.y * drift, fade = Math.min(1, (this.life - t) / 30);
    for (const p of P) {
      if (p.kind === 'cap') { // a torus rolling over and over (out over the top, in underneath)
        const a = p.u + t * 0.015, v = p.v + t * 0.35, rad = rr + rm * Math.cos(v) * (0.7 + 0.5 * p.k);
        p.x = cx + Math.cos(a) * rad; p.z = cz + Math.sin(a) * rad; p.y = Hc + rm * Math.sin(v) * 0.8;
        p.s = R * (0.24 + 0.14 * p.k) * p.size * Math.min(1, 0.2 + t * 0.5); p.glow = hot * (0.5 + 0.5 * Math.sin(v) * 0.5 + 0.3) * (Math.cos(v) < 0 ? 1.3 : 0.8);
      } else if (p.kind === 'stem') {
        const y = p.f * Hc, w = stemR * (1 + 1.4 * Math.pow(1 - p.f, 3)) * (0.5 + p.k);
        const k = Math.min(1, p.f * 1.1), ox = this.x + (cx - this.x) * k, oz = this.z + (cz - this.z) * k;
        p.x = ox + Math.cos(p.u) * w; p.z = oz + Math.sin(p.u) * w; p.y = y;
        p.s = R * (0.15 + 0.1 * p.k) * p.size * Math.min(1, t * 0.4); p.glow = hot * 0.7 * p.f;
      } else { // the base surge rolling out along the ground
        const rad = Rs * (0.55 + 0.45 * p.k);
        p.x = this.x + Math.cos(p.u) * rad; p.z = this.z + Math.sin(p.u) * rad; p.y = R * 0.04 + p.f * R * 0.06;
        p.s = R * (0.15 + 0.12 * p.k) * p.size * Math.min(1, t * 0.8); p.glow = hot * 0.25 * (1 - p.k);
      }
      p.d = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2;
    }
    this.order.sort((a, b) => P[b].d - P[a].d);
    const A = this.aP.array, m = this._m, v = this._v, s = this._s, q = this._q;
    this.order.forEach((idx, k) => { const p = P[idx]; m.compose(v.set(p.x, p.y, p.z), q, s.setScalar(Math.max(0.01, p.s))); this.mesh.setMatrixAt(k, m); A[k * 4] = p.seed; A[k * 4 + 1] = p.shade; A[k * 4 + 2] = p.spin; A[k * 4 + 3] = Math.min(1, p.glow); });
    this.mesh.instanceMatrix.needsUpdate = true; this.aP.needsUpdate = true;
    const u = this.mat.uniforms, sun = D.ctx.sun;
    u.uTime.value = realT; u.uLight.value = D.lightK; u.uFade.value = fade;
    u.uSunV.value.copy(sun.position).sub(sun.target.position).normalize().transformDirection(D.ctx.camera.matrixWorldInverse).multiplyScalar(0.6).add(this._fill || (this._fill = new THREE.Vector3(0.35, 0.55, 0.75))).normalize();
    // the first seconds: fireball swelling and rising, the shock dome and ring racing out
    const kb = Math.min(1, t / 1.2);
    this.ball.visible = t < 6; this.ball.scale.setScalar(R * 0.24 * Math.sqrt(kb)); this.ball.position.y = R * 0.12 + Hc * 0.6 * Math.min(1, t / 6);
    this.ball.material.uniforms.uTime.value = realT; this.ball.material.uniforms.uAge.value = Math.min(1, t / 6);
    const ks = Math.min(1, t / 1.6);
    this.dome.visible = t < 1.8; this.dome.scale.setScalar(R * 1.4 * ks); this.dome.material.opacity = 0.32 * (1 - ks);
    this.ring.visible = t < 3; this.ring.scale.setScalar(R * 1.6 * Math.min(1, t / 2.5)); this.ring.material.opacity = 0.7 * (1 - Math.min(1, t / 3));
    if (t > this.life) this.alive = false;
  }
  dispose() {
    for (const o of [this.mesh, this.ball, this.dome, this.ring]) { this.D.ctx.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }
  poi() { return this.t < 90 ? { x: this.x, z: this.z, danger: this.R * 1.4, range: 1400 } : null; }
}

// the destruction of a nuclear blast on the ground at (x, z), radius R (none of it counts against the player)
export function nuclearDamage(D, x, z, R) {
  const { people, traffic, city, fire } = D.ctx;
  D.flash(1.7); D.shake(2.8);
  fire.nuke(x, z, R, { cloud: false });
  people.nuke(x, z, R, false);
  traffic.nuke(x, z, R);
  city.buildingsNear(x, z, R * 0.4, (k, d, b) => D.destroyBuilding(k, 'collapse', { dir: Math.atan2((b.z0 + b.z1) / 2 - z, (b.x0 + b.x1) / 2 - x) }));
  for (const it of city.takeStreetNear(x, z, R * 0.9)) { const dx = it.x - x, dz = it.z - z, d = Math.hypot(dx, dz) || 1; D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.6, it.s * 0.9, '#2a2420', 'fly', { v: [dx / d * 28, 6 + Math.random() * 8, dz / d * 28] }); }
  for (const pc of traffic.parkedNear(x, z, R * 0.8)) traffic.burnParked(pc);
  new Mushroom(D, x, z, R);
}

export class NuclearStrike {
  constructor(D, x, z, o = {}) {
    this.type = 'nuclear'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true; this.phase = 'warn';
    this.R = o.size ?? 130; this.warnT = o.warn ?? 20;
    const a = Math.random() * Math.PI * 2; this.from = new THREE.Vector3(x + Math.cos(a) * 2200, 1400, z + Math.sin(a) * 2200); this.to = new THREE.Vector3(x, 0, z);
    D.ctx.people.alarm(30);
    D.emit({ type: 'warn', hazard: 'nuclear', x, z, r: this.R, exact: true, text: 'Air raid sirens! A nuclear missile is inbound to the ' + D.district(x, z) + ' district. ' + Math.round(this.warnT) + ' seconds to impact' });
  }
  update(h) {
    const D = this.D, fire = D.ctx.fire;
    this.t += h;
    if (this.phase === 'warn') {
      if (this.t > this.warnT - 2.5) {
        this.phase = 'fall'; this.ft = 0;
        this.missile = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 9, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8d8d0', metalness: 0.4, roughness: 0.4 }));
        D.ctx.scene.add(this.missile);
      }
      return;
    }
    if (this.phase === 'fall') {
      this.ft += h; const k = Math.min(1, this.ft / 2.5), p = this.from.clone().lerp(this.to, k);
      this.missile.position.copy(p); this.missile.lookAt(this.to);
      if (Math.random() < 0.9) { const r = fire.smoke.alloc(2, p.x, p.y, p.z, 1.5, 1.5, 1.6, fire.uniforms.uTime.value); fire.later(2, () => fire.smoke.end(r, fire.uniforms.uTime.value)); fire.later(12, () => fire.smoke.release(r)); }
      fire.burst(p.x, p.y, p.z, 3, 2.2);
      if (k >= 1) { D.ctx.scene.remove(this.missile); this.missile.geometry.dispose(); this.missile.material.dispose(); this.missile = null; nuclearDamage(D, this.x, this.z, this.R); this.phase = 'after'; this.at = 0; D.emit({ type: 'detonation', x: this.x, z: this.z, text: 'Detonation. The ' + D.district(this.x, this.z) + ' district is gone' }); }
      return;
    }
    if ((this.at += h) > 3) this.alive = false;
  }
  poi() { return this.phase === 'fall' && this.missile ? { x: this.missile.position.x, z: this.missile.position.z, danger: 0, range: 3000 } : null; }
  sync() {}
  dispose() { if (this.missile) this.D.ctx.scene.remove(this.missile); }
}

const FALLOUT_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FALLOUT_FS = /* glsl */`
uniform float uTime, uR, uK, uLight; uniform vec2 uC;
varying vec3 vW;
${NOISE}
void main() {
  float r = length(vW.xz - uC) / uR; if (r > 1.0) discard;
  float n = fbm(vW.xz * 0.012 + vec2(uTime * 0.03, -uTime * 0.02)) * 0.7 + fbm(vW.xz * 0.04 - uTime * 0.05) * 0.3;
  float a = smoothstep(1.0, 0.45, r + (n - 0.5) * 0.5) * smoothstep(0.25, 0.65, n) * 0.5 * uK;
  gl_FragColor = vec4(vec3(0.5, 0.66, 0.3) * uLight * (0.8 + 0.4 * n), a);
}`;

// the power plant on the coast: the reactor overheats, then explodes, and fallout drifts over the city
export class Meltdown {
  constructor(D, opts = {}) {
    this.type = 'meltdown'; this.D = D; this.t = 0; this.phase = 'warn'; this.said = 0; this.steamT = 0; this.alive = true;
    const O = D.ctx.outskirts;
    if (!O || !O.plant.group.visible) { this.alive = false; return; } // no plant (or it has already gone up)
    this.plant = O.plant; this.x = O.plant.reactor.x; this.z = O.plant.reactor.z; this.R = opts.size ?? 170; this.warnT = opts.warn ?? 32;
    D.ctx.people.alarm(35);
    D.emit({ type: 'warn', hazard: 'meltdown', x: this.x, z: this.z, r: this.R, exact: true, text: 'Reactor overload at the nuclear power plant! The core is overheating' });
  }
  update(h) {
    const D = this.D, { fire, people } = D.ctx;
    this.t += h;
    if (this.phase === 'warn') {
      const k = this.t / this.warnT, msgs = [[0.4, 'Core temperature critical at the power plant. Get away from the coast'], [0.75, 'Meltdown imminent! The coolant pumps have failed']];
      if (this.said < msgs.length && k > msgs[this.said][0]) D.emit({ type: 'meltdownwarn', text: msgs[this.said++][1] });
      this.plant.lightMat.color.setRGB(Math.sin(this.t * (5 + k * 14)) > 0 ? 5 : 0.3, 0.12, 0.05);
      if ((this.steamT -= h) <= 0) { this.steamT = Math.max(0.2, 1.4 - k * 1.2); fire.spray(this.x + (Math.random() - 0.5) * 20, this.z + (Math.random() - 0.5) * 20, 20 + Math.random() * 12, 5, 7, 2.6); }
      const c = D.ctx.controls.target; if (Math.hypot(c.x - this.x, c.z - this.z) < 500) D.shake(0.04 + k * k * 0.3);
      if (this.t > this.warnT) this.explode();
      return;
    }
    // fallout drifting in over the city
    const f = this.fall; f.t += h; f.x += f.vx * h; f.z += f.vz * h;
    f.k = Math.min(1, f.t / 6) * Math.max(0, Math.min(1, (f.life - f.t) / 15));
    if ((f.doseT -= h) <= 0) {
      f.doseT = 1;
      people.around(f.x, f.z, f.R * 0.85, (j) => { const s = people.st[j]; if ((s === 0 || s === 1 || s === 2 || s === 3 || s === 9 || s === 24) && people.kind[j] === 0 && Math.random() < 0.012 * f.k) people.kill(j, 0, 0, 'rad'); });
    }
    if (f.t > f.life) this.alive = false;
  }
  explode() {
    const D = this.D, { scene, city } = D.ctx, P = this.plant;
    this.phase = 'after';
    P.group.visible = false; P.lightMat.color.setRGB(0.3, 0.05, 0.03);
    new Hole(D, this.x, this.z, { R: 34, depth: 20, rim: 1.6, glow: 1.6, cool: 0.01, wall: '#4e463e', floor: '#2a221c', rimCol: '#5a5048' });
    for (let n = 0; n < 90; n++) { // the towers and the dome blown apart
      const a = Math.random() * Math.PI * 2, sp = 12 + Math.random() * 30, s = 1 + Math.random() * 3.5;
      D.debris.add(this.x + Math.cos(a) * 20, 5 + Math.random() * 40, this.z + Math.sin(a) * 20, s, s * 0.6, s, Math.random() < 0.6 ? 0xcfc8bb : 0x8a8478, 'fly', { v: [Math.cos(a) * sp, 10 + Math.random() * 25, Math.sin(a) * sp] });
    }
    nuclearDamage(D, this.x, this.z, this.R);
    const B = city.bounds, tx = (B.x0 + B.x1) / 2, tz = (B.z0 + B.z1) / 2, d = Math.hypot(tx - this.x, tz - this.z) || 1;
    this.fall = { x: this.x, z: this.z, vx: (tx - this.x) / d * 5, vz: (tz - this.z) / d * 5, R: 170, t: 0, k: 0, life: 75, doseT: 2 };
    const geo = new THREE.PlaneGeometry(420, 420, 1, 1); geo.rotateX(-Math.PI / 2);
    this.cloud = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: FALLOUT_VS, fragmentShader: FALLOUT_FS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uR: { value: 170 }, uK: { value: 0 }, uLight: { value: 1 }, uC: { value: new THREE.Vector2() } } }));
    this.cloud.renderOrder = 6; this.cloud.frustumCulled = false; scene.add(this.cloud);
    D.emit({ type: 'meltdownboom', x: this.x, z: this.z, text: 'The reactor has exploded! Radioactive fallout is drifting over the city' });
  }
  poi() { return this.phase === 'warn' ? { x: this.x, z: this.z, danger: 60, range: 900 } : null; }
  sync(dt, realT) {
    if (!this.cloud) return;
    const f = this.fall, u = this.cloud.material.uniforms;
    this.cloud.position.set(f.x, 22, f.z); u.uC.value.set(f.x, f.z); u.uTime.value = realT; u.uK.value = f.k; u.uLight.value = this.D.lightK;
  }
  dispose() { if (this.cloud) { this.D.ctx.scene.remove(this.cloud); this.cloud.geometry.dispose(); this.cloud.material.dispose(); } }
}
