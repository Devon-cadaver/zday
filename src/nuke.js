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
const WALL_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WALL_FS = /* glsl */`
uniform float uTime, uK;
varying vec2 vUv;
${NOISE}
void main() {
  float n = fbm(vec2(vUv.x * 70.0, vUv.y * 2.5 - uTime * 1.4)), h = vUv.y;
  float a = (1.0 - smoothstep(0.25 + n * 0.55, 0.98, h)) * uK * (0.5 + 0.5 * n);
  vec3 col = mix(vec3(2.4, 1.0, 0.3), vec3(0.62, 0.42, 0.26), smoothstep(0.0, 0.55, h + (n - 0.5) * 0.4)); // fire at the foot, dust above
  gl_FragColor = vec4(col, a);
}`;

// The blast itself, after Sean's reference (the nuclear dream in T2): a flash that washes the city white
// and then orange, a wall of fire and dust racing out across it, buildings blown apart in its path, cars
// and trees hurled outwards, windows blown in further out, and everyone near the centre turned to ash
// statues that crumble away in the wind. Survivors at the edge are irradiated and turn radioactive later.
export class NukeBlast {
  constructor(D, x, z, R, o = {}) {
    this.type = 'nukeblast'; this.D = D; this.x = x; this.z = z; this.R = R; this.t = 0; this.f = 0; this.alive = true;
    this.speed = R / 3.4; this.byPlayer = !!o.byPlayer; this.ash = []; this.heat = 1; this.clean = !!o.clean; // clean: no fallout zone, no doses (a villain's mini nuke)
    if (D.contaminate && !this.clean) D.contaminate(x, z, R * 0.9); // the ground stays hot until a hazmat team clears it
    const { fire, scene } = D.ctx;
    D.flash(o.mini ? 0.8 : o.bigFlash ? 1.8 : 1.3); D.shake(o.mini ? 1.8 : 3); // a blink of white, then the orange heat wash (post.js uHeat) carries it
    fire.nuke(x, z, R * 0.9, { cloud: false });
    new Mushroom(D, x, z, R * 0.7);
    this.mat = new THREE.ShaderMaterial({ vertexShader: WALL_VS, fragmentShader: WALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uK: { value: 1 } } });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.12, 1, 160, 1, true).translate(0, 0.5, 0), this.mat);
    this.wall.position.set(x, 0, z); this.wall.renderOrder = 7; this.wall.frustumCulled = false; scene.add(this.wall);
    D.emit({ type: 'nukeflash', x, z });
  }
  poi() { return { x: this.x, z: this.z, danger: this.R * 1.3, range: 2500 }; }

  update(h) {
    const D = this.D, { people } = D.ctx;
    this.t += h;
    const f0 = this.f, end = this.R * 1.25;
    if (f0 < end) { this.f = Math.min(end, f0 + this.speed * h * (1.4 - 0.8 * f0 / end)); this.sweep(f0, this.f); D.shake(1.2 * (1 - f0 / end)); }
    this.heat = this.t < 1.2 ? 1 : Math.max(0, 1 - (this.t - 1.2) / 8);
    for (let k = this.ash.length - 1; k >= 0; k--) {
      const a = this.ash[k];
      if (this.t < a.at) continue;
      this.ash.splice(k, 1);
      if (people.st[a.j] !== 23) continue; // something else got to them first
      const px = people.x[a.j], py = people.y[a.j], pz = people.z[a.j];
      people.crumble(a.j, this.byPlayer);
      if (D.debris.free.length > 60) for (let n = 0; n < 3; n++) { const s = 0.12 + Math.random() * 0.22; D.debris.add(px, py + 0.4 + Math.random() * 1.2, pz, s, s * 0.7, s, Math.random() < 0.5 ? 0x7a756e : 0x5e5a54, 'fly', { v: [a.dx * (8 + Math.random() * 10), 1 + Math.random() * 3, a.dz * (8 + Math.random() * 10)] }); }
      if ((this.dustN = (this.dustN || 0) + 1) % 7 === 0) D.ctx.fire.dustCloud(px, pz, 2.5, 3);
    }
    if (this.t > 14 && !this.ash.length) this.alive = false;
  }

  // everything the front crossed this step, between radius r0 and r1
  sweep(r0, r1) {
    const D = this.D, { people, traffic, city, fire } = D.ctx, x = this.x, z = this.z, R = this.R;
    city.buildingsNear(x, z, r1, (k, d, b) => {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, bd = Math.hypot(cx - x, cz - z);
      if (bd < r0 || bd >= r1) return;
      const a = Math.atan2(cz - z, cx - x), ox = Math.cos(a), oz = Math.sin(a), hgt = b.top - b.baseY;
      if (bd < R * 0.5 || (bd < R * 0.72 && hgt < 22 && Math.random() < 0.45)) { // blown apart
        if (D.destroyBuilding(k, 'collapse', { dir: a })) for (let n = 0; n < 8; n++) { const s = 0.8 + Math.random() * 2; D.debris.add(cx, b.baseY + Math.random() * hgt, cz, s, s * 0.6, s, Math.random() < 0.6 ? 0x6a5e52 : 0x3a332c, 'fly', { v: [ox * (18 + Math.random() * 22), 4 + Math.random() * 10, oz * (18 + Math.random() * 22)] }); }
      } else if (bd < R) { city.char(k, 0.5 + 0.3 * bd / R); D.blowWindows(k, ox, oz, 1.3); if (Math.random() < 0.55) fire.igniteBuilding(k); }
      else { city.char(k, 0.85); D.blowWindows(k, ox, oz, 0.7); }
    });
    const r02 = r0 * r0, r12 = r1 * r1;
    for (let j = 0; j < people.active; j++) {
      const s = people.st[j];
      if (s === 8 || s === 17) continue;
      const dx = people.x[j] - x, dz = people.z[j] - z, d2 = dx * dx + dz * dz;
      if (d2 < r02 || d2 >= r12) continue;
      const d = Math.sqrt(d2) || 1, ox = dx / d, oz = dz / d;
      if (s === 10) { if (d < R * 0.5) people.crumble(j, this.byPlayer); continue; } // indoors: only the inner ring is lost with the buildings
      if (d < R * 0.72) { people.ashen(j); this.ash.push({ j, at: this.t + 0.3 + Math.random() * 1.7, dx: ox, dz: oz }); } // ash where they stood
      else if (d < R) {
        if (Math.random() < 0.15 + 0.8 * (1 - (d - R * 0.72) / (R * 0.28))) {
          const wasZ = s === 6, civ = people.kind[j] === 0;
          people.kill(j, ox * 14, oz * 14, 'burn');
          if (this.byPlayer) { if (wasZ) { people.stats.disasterZ--; people.stats.nukedZ++; } else if (civ) { people.stats.disasterCiv--; people.stats.nukedCiv++; } }
        }
      } else if (!this.clean && people.isPrey(j) && people.kind[j] === 0 && Math.random() < 0.07) { people.inf[j] = 1; people.zrad[j] = 2; people.inc[j] = people.inc0[j] = 10 + Math.random() * 25; people.dirty[j] = 1; } // a dose of radiation
    }
    traffic.near(x, z, r1, (car) => {
      if (car.gone || car.mode === 4 || car.mode === 5) return;
      const dx = car.x - x, dz = car.z - z, d = Math.hypot(dx, dz) || 1; if (d < r0 || d >= r1) return;
      const p = Math.max(0, 1 - d / (R * 1.25));
      traffic.fling(car, dx / d * (6 + 34 * p), 3 + 12 * p, dz / d * (6 + 34 * p)); car.ignite = Math.random() < 0.6;
      if (!car.mission) traffic.tint(car, '#16130f');
    });
    for (const pc of traffic.parkedNear(x, z, r1)) {
      const dx = pc.x - x, dz = pc.z - z, d = Math.hypot(dx, dz) || 1; if (d < r0) continue;
      traffic.takeParked(pc);
      if (D.debris.objs.length > 140) continue;
      const p = Math.max(0, 1 - d / (R * 1.25)), m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat('#1a1714')); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
      D.debris.addObject(m, 'fly', { v: [dx / d * (8 + 26 * p), 3 + 10 * p, dz / d * (8 + 26 * p)] });
    }
    for (const it of city.takeStreetNear(x, z, Math.min(r1, R * 1.1))) { const dx = it.x - x, dz = it.z - z, d = Math.hypot(dx, dz) || 1; D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.6, it.s * 0.9, '#2a2420', 'fly', { v: [dx / d * 26, 5 + Math.random() * 8, dz / d * 26] }); }
  }

  sync(dt, realT) {
    const D = this.D, end = this.R * 1.25, k = Math.max(0, 1 - this.f / end);
    this.wall.scale.set(Math.max(1, this.f), 8 + 22 * k, Math.max(1, this.f));
    this.mat.uniforms.uTime.value = realT; this.mat.uniforms.uK.value = this.f >= end ? Math.max(0, this.mat.uniforms.uK.value - dt * 0.8) : 0.35 + 0.65 * k;
    const o = D.ctx.post.opts; o.heat = Math.max(o.heatAt === realT ? o.heat || 0 : 0, this.heat); o.heatAt = realT; // the hottest blast this frame, so it fades (it held the screen at its hottest ever)
  }
  dispose() { this.D.ctx.scene.remove(this.wall); this.wall.geometry.dispose(); this.mat.dispose(); this.D.ctx.post.opts.heat = 0; }
}

// a nuclear detonation at (x, z): the blast above, as an event of its own
export function nuclearDamage(D, x, z, R, o = {}) {
  const ev = new NukeBlast(D, x, z, R, o);
  D.list.push(ev);
  return ev;
}

export class NuclearStrike {
  constructor(D, x, z, o = {}) {
    this.type = 'nuclear'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true; this.phase = 'warn';
    this.R = o.size ?? 280; this.warnT = o.warn ?? 20;
    const a = Math.random() * Math.PI * 2; this.from = new THREE.Vector3(x + Math.cos(a) * 900, 1300, z + Math.sin(a) * 900); this.to = new THREE.Vector3(x, 60, z); // it bursts in the air above the target
    if (!o.quiet) D.ctx.people.alarm(30);
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'nuclear', x, z, r: this.R, exact: true, text: 'Air raid sirens! A nuclear missile is inbound to the ' + D.district(x, z) + ' district. ' + Math.round(this.warnT) + ' seconds to impact' });
  }
  update(h) {
    const D = this.D, fire = D.ctx.fire;
    this.t += h;
    if (this.phase === 'warn') {
      if (this.t > this.warnT - 5) {
        this.phase = 'fall'; this.ft = 0;
        { // it dives in from just above the near edge of the view, so the whole plunge is on screen
          const cam = D.ctx.camera.position, fx = this.x - cam.x, fz = this.z - cam.z, fl = Math.hypot(fx, fz) || 1;
          this.from.set(cam.x + fx * 0.5, cam.y * 0.68, cam.z + fz * 0.5); this.to.set(this.x, 60, this.z);
        }
        this.missile = new THREE.Group();
        this.missile.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 12, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8d8d0', metalness: 0.4, roughness: 0.4 })));
        this.missile.add(new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 10).rotateX(Math.PI / 2).translate(0, 0, 7.7), new THREE.MeshStandardMaterial({ color: '#3a3a36', roughness: 0.5 })));
        this.missile.add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8).translate(0, 0, -7.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 3.5, 1.2), fog: false })));
        this.missile.scale.setScalar(2.2); D.ctx.scene.add(this.missile);
      }
      return;
    }
    if (this.phase === 'fall') {
      this.ft += h * D.slowAt(this.missile.position.x, this.missile.position.y, this.missile.position.z); const k = Math.min(1, this.ft / 5), p = this.from.clone().lerp(this.to, k * k * (3 - 2 * k) * 0.25 + k * 0.75); // a time bubble holds it back
      this.missile.position.copy(p); this.missile.lookAt(this.to);
      if (Math.random() < 0.9) { const r = fire.smoke.alloc(2, p.x, p.y, p.z, 1.5, 1.5, 1.6, fire.uniforms.uTime.value); fire.later(2, () => fire.smoke.end(r, fire.uniforms.uTime.value)); fire.later(12, () => fire.smoke.release(r)); }
      fire.burst(p.x, p.y, p.z, 3, 2.2);
      if (k >= 1) { D.ctx.scene.remove(this.missile); this.missile.traverse(m => { if (m.geometry) { m.geometry.dispose(); m.material.dispose(); } }); this.missile = null; nuclearDamage(D, this.x, this.z, this.R); this.phase = 'after'; this.at = 0; D.emit({ type: 'detonation', x: this.x, z: this.z, text: 'Detonation. The ' + D.district(this.x, this.z) + ' district is gone' }); }
      return;
    }
    if (this.phase === 'held') { const p = this.missile.position; fire.burst(p.x, p.y - 3, p.z, 2, 2); return; }
    if ((this.at += h) > 3) this.alive = false;
  }
  get OBJ() { return this.missile; } set OBJ(v) { this.missile = v; }
  // a hero has it: no impact; the hero carries it up and away (the ball follows the hero) until vanish()
  seize() { if (this.phase !== 'fall') return false; this.phase = 'held'; return true; }
  vanish() { this.phase = 'gone'; const o = this.OBJ; if (o) { this.D.ctx.scene.remove(o); o.traverse(m => { if (m.geometry) { m.geometry.dispose(); m.material.dispose(); } }); } this.OBJ = null; this.alive = false; }
  poi() { return (this.phase === 'fall' || this.phase === 'held') && this.missile ? { x: this.missile.position.x, z: this.missile.position.z, danger: 0, range: 3000 } : null; }
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
    this.plant = O.plant; this.x = O.plant.reactor.x; this.z = O.plant.reactor.z; this.R = opts.size ?? 230; this.warnT = opts.warn ?? 32;
    this.fallLife = opts.fallLife ?? 75;
    if (!opts.quiet) D.ctx.people.alarm(35);
    if (!opts.quiet) D.emit({ type: 'warn', hazard: 'meltdown', x: this.x, z: this.z, r: this.R, exact: true, text: 'Reactor overload at the nuclear power plant! The core is overheating' });
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
      if (f.k > 0.3 && (this.zoneT = (this.zoneT ?? 0) - 1) <= 0 && this.D.contaminate) { this.zoneT = 8; this.D.contaminate(f.x, f.z, f.R * 0.6); } // fallout settles where the cloud passes
      people.around(f.x, f.z, f.R * 0.85, (j) => { const s = people.st[j]; if ((s === 0 || s === 1 || s === 2 || s === 3 || s === 9 || s === 24) && people.kind[j] === 0 && Math.random() < 0.012 * f.k) { if (Math.random() < 0.45) people.kill(j, 0, 0, 'rad'); else if (!people.inf[j]) { people.inf[j] = 1; people.zrad[j] = 2; people.inc[j] = people.inc0[j] = 12 + Math.random() * 20; people.dirty[j] = 1; } } }); // the rest of the dosed turn radioactive later
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
    this.fall = { x: this.x, z: this.z, vx: (tx - this.x) / d * 5, vz: (tz - this.z) / d * 5, R: 170, t: 0, k: 0, life: this.fallLife, doseT: 2 };
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
