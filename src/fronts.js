// Storm fronts that sweep the city from one edge, built on the tsunami's
// ragged SweepFront. Haboob: a towering wall of dust that sandblasts the
// streets, lifts people and cars, topples some low buildings and leaves a
// sandstorm behind it. Cold wave: a blizzard wall with frost creeping over the
// ground behind it; anyone caught outdoors freezes solid (zombies included,
// until the cold breaks).
import * as THREE from 'three';
import { NOISE, FRONT, SweepFront, Splash } from './water.js';

const CURTAIN_VS = /* glsl */`
uniform float uTime, uH, uBack; uniform vec2 uOrigin, uDir, uTan;
varying vec2 vP; varying vec3 vW; varying float vY;
${NOISE}
${FRONT}
void main() {
  float tc = position.x, y = position.y;
  float top = uH * (0.65 + 0.5 * fbm(vec2(tc * 0.007, uTime * 0.02)));
  // the foot rolls forward, the top trails back
  float s = frontAt(tc) - uBack + (sin(y * 3.1416) * 0.18 - y * 0.35) * top * 0.3;
  vec3 w = vec3(uOrigin.x + uTan.x * tc + uDir.x * s, y * top, uOrigin.y + uTan.y * tc + uDir.y * s);
  vW = w; vY = y; vP = vec2(tc, y * top);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const CURTAIN_FS = /* glsl */`
uniform float uTime, uAlpha, uLight, uFogDensity, uRise; uniform vec3 uColA, uColB, uFogColor;
varying vec2 vP; varying vec3 vW; varying float vY;
${NOISE}
void main() {
  float n = fbm(vec2(vP.x * 0.018, vP.y * 0.028 - uTime * uRise)), n2 = fbm(vec2(vP.x * 0.06 + uTime * 0.05, vP.y * 0.08 - uTime * uRise * 2.5));
  float bill = n * 0.6 + n2 * 0.4;
  vec3 col = mix(uColA, uColB, smoothstep(0.3, 0.8, bill) * 0.7 + vY * 0.3) * uLight;
  float a = uAlpha * (1.0 - smoothstep(0.72, 1.0, vY + (bill - 0.5) * 0.4)) * (0.72 + 0.28 * bill);
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.6);
  gl_FragColor = vec4(col, a);
}`;
const FROST_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FROST_FS = /* glsl */`
uniform float uTime, uLight, uFade; uniform vec2 uOrigin, uDir, uTan;
varying vec3 vW;
${NOISE}
${FRONT}
void main() {
  vec2 r = vW.xz - uOrigin; float behind = frontAt(dot(r, uTan)) - dot(r, uDir);
  if (behind < 0.0) discard;
  float n = fbm(vW.xz * 0.12), c = fbm(vW.xz * 1.3);
  vec3 col = vec3(0.82, 0.88, 0.95) * (0.85 + 0.25 * n) * uLight + vec3(0.6) * smoothstep(0.78, 0.9, c) * uLight;
  gl_FragColor = vec4(col, uFade * smoothstep(0.0, 25.0, behind) * (0.55 + 0.25 * n));
}`;

function curtain(D, sw, o) {
  const geo = new THREE.PlaneGeometry(sw.width, 1, 220, 14); geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({ vertexShader: CURTAIN_VS, fragmentShader: CURTAIN_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uH: { value: o.H }, uBack: { value: o.back || 0 }, uOrigin: { value: sw.origin }, uDir: { value: sw.dir }, uTan: { value: sw.tan },
      uFront: { value: sw.F }, uPile: { value: sw.P }, uHalfW: { value: sw.halfW }, uSegW: { value: sw.segW }, uRise: { value: o.rise ?? 0.12 },
      uAlpha: { value: o.alpha }, uLight: { value: 1 }, uFogDensity: { value: 0.0006 }, uColA: { value: new THREE.Color(o.a) }, uColB: { value: new THREE.Color(o.b) }, uFogColor: { value: new THREE.Color() } } });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; m.userData.alpha = o.alpha;
  D.ctx.scene.add(m);
  return m;
}
function syncCurtain(D, m, realT, fade = 1) {
  const u = m.material.uniforms, sc = D.ctx.scene;
  u.uTime.value = realT; u.uLight.value = D.lightK; u.uFogColor.value.copy(sc.background); u.uFogDensity.value = sc.fog ? sc.fog.density : 0.0006;
  u.uAlpha.value = m.userData.alpha * fade;
}
function drop(D, m) { D.ctx.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }

// a wall of billowing cloud: hundreds of lit puffs riding a SweepFront. Small cauliflower clumps roll
// along the ground at the front, big billows tower up behind them and dark masses overhang the top;
// every puff churns slowly upward and is shaded like a real cloud (sunlit side, brown shadows)
const BILLOW_VS = /* glsl */`
attribute vec4 aP; // seed, shade, spin, layer
uniform float uTime;
varying vec2 vUv; varying vec4 vP; varying float vY;
void main() {
  vUv = uv; vP = aP;
  vec4 w = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); vY = w.y;
  vec4 c = viewMatrix * w; float s = length(instanceMatrix[0].xyz), a = aP.z + uTime * 0.04 * (aP.x - 0.5);
  c.xy += mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy * s;
  gl_Position = projectionMatrix * c;
}`;
const BILLOW_FS = /* glsl */`
uniform vec3 uLit, uShade, uDark, uSunV, uFogColor; uniform float uLight, uTime, uFade, uFogDensity, uH;
varying vec2 vUv; varying vec4 vP; varying float vY;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float n = fbm(p * 2.4 + vP.x * 37.0 + vec2(0.0, -uTime * 0.05)), n2 = fbm(p * 6.0 + vP.x * 11.0);
  float edge = r + (n - 0.5) * 0.6 + (n2 - 0.5) * 0.15;
  if (edge > 1.0) discard;
  vec3 N = normalize(vec3(p * 1.15 + (n - 0.5) * 0.9, sqrt(max(0.0, 1.0 - r * r)) + 0.15));
  float lit = clamp(dot(N, uSunV) * 0.65 + 0.4, 0.0, 1.0);
  vec3 col = mix(uShade, uLit * 1.35, smoothstep(0.15, 0.95, lit)) * (0.88 + 0.24 * vP.y);
  col = mix(col, uDark, smoothstep(0.55, 1.05, vY / uH) * 0.45 + (1.0 - lit) * 0.12); // the overhang sits in its own shadow
  col *= uLight;
  float a = smoothstep(1.0, 0.55, edge) * smoothstep(1.0, 0.8, r) * uFade;
  if (a < 0.06) discard; // written to depth so the tilt-shift blur treats the wall as solid
  gl_FragColor = vec4(col, a);
}`;
export class BillowWall {
  constructor(D, sw, o = {}) {
    this.D = D; this.sw = sw; this.H = o.H ?? 260;
    const B = D.ctx.city.bounds, n = o.n ?? (D.ctx.low ? 380 : 720);
    // only build puffs where the camera can be (across the city plus a margin)
    const span = (Math.abs(sw.tan.x) > 0.5 ? B.x1 - B.x0 : B.z1 - B.z0) / 2 + 220, mid = Math.abs(sw.tan.x) > 0.5 ? ((B.x0 + B.x1) / 2 - sw.origin.x) * sw.tan.x : ((B.z0 + B.z1) / 2 - sw.origin.y) * sw.tan.y;
    this.P = [];
    for (let k = 0; k < n; k++) {
      const r = Math.random(), layer = r < 0.42 ? 0 : r < 0.82 ? 1 : 2;
      this.P.push(this.spawn({ layer, seed: Math.random(), t: mid + (Math.random() * 2 - 1) * span }, true));
    }
    this.span = span; this.mid = mid;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); geo.setAttribute('aP', this.aP);
    this.mat = new THREE.ShaderMaterial({ vertexShader: BILLOW_VS, fragmentShader: BILLOW_FS, transparent: true, depthWrite: true,
      uniforms: { uTime: { value: 0 }, uLit: { value: new THREE.Color(o.lit ?? '#f4ae62') }, uShade: { value: new THREE.Color(o.shade ?? '#7e4a26') }, uDark: { value: new THREE.Color(o.dark ?? '#46281a') },
        uSunV: { value: new THREE.Vector3(0, 1, 0) }, uFogColor: { value: new THREE.Color() }, uLight: { value: 1 }, uFade: { value: 1 }, uFogDensity: { value: 0.0006 }, uH: { value: this.H } } });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, n); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    D.ctx.scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this.order = this.P.map((p, i) => i);
  }
  spawn(p, first = false) {
    const L = p.layer;
    p.h = L === 0 ? Math.random() * 0.06 : L === 1 ? 0.05 + Math.random() * (first ? 0.6 : 0.15) : 0.55 + Math.random() * (first ? 0.4 : 0.1);
    p.back = L === 0 ? -6 + Math.random() * 18 : L === 1 ? 8 + Math.random() * 55 : -15 + Math.random() * 50;
    p.size = L === 0 ? 14 + Math.random() * 20 : L === 1 ? 40 + Math.random() * 45 : 60 + Math.random() * 55;
    p.rise = L === 0 ? 0.004 + Math.random() * 0.006 : 0.002 + Math.random() * 0.004;
    p.top = L === 0 ? 0.16 : L === 1 ? 0.75 : 1.05;
    p.shade = Math.random(); p.spin = Math.random() * 6.28; p.age = 0;
    if (!first) { p.t = this.mid + (Math.random() * 2 - 1) * this.span; p.seed = Math.random(); }
    return p;
  }
  update(h) {
    for (const p of this.P) { p.h += p.rise * h; p.age += h; if (p.h > p.top) this.spawn(p); }
  }
  sync(realT, fade = 1) {
    const D = this.D, sw = this.sw, cam = D.ctx.camera.position, m = this._m, v = this._v, s = this._s, q = this._q;
    // world positions, then back-to-front so the soft edges blend properly
    for (const p of this.P) {
      const f = sw.frontAt(p.t), sOff = f - p.back + p.h * this.H * 0.14; // the top leans out over the front
      p.x = sw.origin.x + sw.tan.x * p.t + sw.dir.x * sOff; p.z = sw.origin.y + sw.tan.y * p.t + sw.dir.y * sOff;
      p.y = p.h * this.H + p.size * 0.32; p.d = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2;
    }
    this.order.sort((a, b) => this.P[b].d - this.P[a].d);
    const A = this.aP.array;
    this.order.forEach((idx, k) => {
      const p = this.P[idx], grow = Math.min(1, p.age / 3 + 0.3);
      m.compose(v.set(p.x, p.y, p.z), q, s.setScalar(p.size * grow)); this.mesh.setMatrixAt(k, m);
      A[k * 4] = p.seed; A[k * 4 + 1] = p.shade; A[k * 4 + 2] = p.spin; A[k * 4 + 3] = p.layer;
    });
    this.mesh.instanceMatrix.needsUpdate = true; this.aP.needsUpdate = true;
    const u = this.mat.uniforms, sun = D.ctx.sun;
    u.uTime.value = realT; u.uLight.value = D.lightK; u.uFade.value = fade;
    // the sun, plus some light from the viewer's side so the face of the wall is never just a dark silhouette
    u.uSunV.value.copy(sun.position).sub(sun.target.position).normalize().transformDirection(D.ctx.camera.matrixWorldInverse).multiplyScalar(0.6).add(this._fill || (this._fill = new THREE.Vector3(0.35, 0.55, 0.75))).normalize();
  }
  dispose() { this.D.ctx.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}


export class Haboob {
  constructor(D, opts = {}) {
    this.type = 'haboob'; this.D = D; this.t = 0; this.alive = true; this.phase = 'sweep'; this.fade = 1;
    const side = opts.side ?? (Math.random() < 0.75 ? 2 : Math.floor(Math.random() * 4)), sw = this.sw = new SweepFront(D, side, { speed: 12, slow: 0.8, fast: 1.05, pile: 1.15, start: -90, pull: opts.pull });
    this.billow = new BillowWall(D, sw, { H: 270 });
    // a dense backdrop behind the billows so no gaps show through
    this.walls = [curtain(D, sw, { H: 240, alpha: 0.95, back: 60, a: '#6a4428', b: '#b8804a', rise: 0.08 }), curtain(D, sw, { H: 210, alpha: 0.9, back: 120, a: '#6a4428', b: '#a07040', rise: 0.06 })];
    this.dust = new Splash(D.ctx.scene, 2000); this.dust.mat.uniforms.uColor.value.set('#b89670');
    const { people } = D.ctx;
    this.hit = new Uint8Array(people.x.length); this.carsHit = new Set(); this.damaged = new Set(); this.stepN = 0;
    this.prevWeather = D.weather.type; this.sandOn = false; this.dustOn = false;
    if (!opts.quiet) people.alarm(20);
    if (!opts.quiet) D.emit({ type: 'warn', hazard: 'haboob', x: sw.origin.x + sw.dir.x * 80, z: sw.origin.y + sw.dir.y * 80, r: 120, exact: true, text: 'Dust storm! A wall of sand is rolling in from the ' + sw.coast + '. Get people indoors' });
  }
  update(h) {
    const D = this.D, { people, traffic, city, fire } = D.ctx, sw = this.sw, d = sw.dir;
    this.t += h; this.dust.update(h); this.billow.update(h);
    if (this.phase === 'after') {
      this.fade = Math.max(0, this.fade - h / 6);
      if (this.t > this.endT) { this.alive = false; D.weather.set(this.prevWeather === 'sand' ? 'clear' : this.prevWeather); D.emit({ type: 'haboobend', text: 'The dust is settling' }); }
      return;
    }
    sw.advance(h);
    const band = (x, z) => { const b = sw.behind(x, z); return b > -1.5 && b < 3.5; };
    for (let i = 0; i < people.active; i++) {
      if (this.hit[i]) continue;
      const s = people.st[i];
      if (s === 8 || s === 10 || s === 17 || s === 19 || s === 20 || people.lvl[i] !== -1 || !band(people.x[i], people.z[i])) continue;
      this.hit[i] = 1;
      if (Math.random() < 0.4) people.fling(i, d.x * (9 + Math.random() * 7), 5 + Math.random() * 6, d.y * (9 + Math.random() * 7));
      else if (people.isCivilian(i)) people.panic(i, people.x[i] - d.x * 10, people.z[i] - d.y * 10, -1);
    }
    for (const car of traffic.cars) {
      if (car.gone || this.carsHit.has(car) || car.mode === 4 || car.mode === 5 || !band(car.x, car.z)) continue;
      this.carsHit.add(car);
      const r = Math.random();
      if (r < 0.35) traffic.fling(car, d.x * (14 + Math.random() * 8), 6 + Math.random() * 5, d.y * (14 + Math.random() * 8));
      else if (r < 0.75 && car.mode === 0) traffic.crash(car, null, 7);
    }
    for (const pc of traffic.parkedList) {
      if (!pc.alive || !band(pc.x, pc.z) || Math.random() > 0.3) continue;
      traffic.takeParked(pc);
      const m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
      D.debris.addObject(m, 'fly', { v: [d.x * 16, 7, d.y * 16] });
    }
    for (let n = 0; n < 4; n++) { // dust boiling along the foot of the wall
      const k = Math.floor(Math.random() * 96), [x, z] = sw.at(k, -2);
      if (sw.inCity(x, z, 150)) this.dust.emit(x, 1, z, 3, { up: [1, 5], dir: [d.x * 9, d.y * 9], spread: 6, life: 2.2, size: 6, along: [sw.tan.x, sw.tan.y, sw.segW * 0.5] });
    }
    if (++this.stepN % 2 === 0) {
      for (let k = 0; k < 96; k++) {
        const [px, pz] = sw.at(k);
        if (!sw.inCity(px, pz)) continue;
        for (const it of city.takeStreetNear(px, pz, 6)) D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.6, it.s * 0.9, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v: [d.x * 16, 6 + Math.random() * 6, d.y * 16] });
        city.buildingsNear(px, pz, 5, (kb, dd, b) => {
          if (this.damaged.has(kb)) return;
          this.damaged.add(kb);
          const qx = Math.max(b.x0, Math.min(b.x1, px)), qz = Math.max(b.z0, Math.min(b.z1, pz));
          this.dust.emit(qx - d.x * 2, 1, qz - d.y * 2, 16, { up: [4, 12], dir: [-d.x * 2, -d.y * 2], spread: 7, life: 2, size: 4, along: [sw.tan.x, sw.tan.y, 6], rise: 6 });
          if (b.top - b.baseY < 10 && Math.random() < 0.25) D.destroyBuilding(kb, 'collapse', { dir: Math.atan2(d.y, d.x) });
          else { city.char(kb, 0.93); if (Math.random() < 0.55) D.blowWindows(kb, d.x, d.y, 0.7); } // sandblasted; some windows give
        });
      }
    }
    // once the wall has rolled over where you are looking it is dark, dusty and thick as fog
    if (!this.dustOn && sw.behind(D.ctx.controls.target.x, D.ctx.controls.target.z) > 20) { this.dustOn = true; D.weather.set('dust'); }
    if (!this.sandOn && sw.lead() > sw.extent + 60) { this.sandOn = true; D.later(25, () => { if (this.alive) D.weather.set('sand'); }); }
    if (sw.lead() > sw.extent + 160) { this.phase = 'after'; this.endT = this.t + 50; }
  }
  poi(x, z) { return this.phase === 'after' ? null : (() => { const dx = x - this.sw.origin.x, dz = z - this.sw.origin.y, t = dx * this.sw.tan.x + dz * this.sw.tan.y, s = this.sw.frontAt(t); return { x: this.sw.origin.x + this.sw.tan.x * t + this.sw.dir.x * s, z: this.sw.origin.y + this.sw.tan.y * t + this.sw.dir.y * s, danger: 30, range: 480 }; })(); }
  sync(dt, realT) { this.billow.sync(realT, this.fade); for (const w of this.walls) syncCurtain(this.D, w, realT, this.fade); this.dust.sync(this.D.lightK, this.D.ctx.fire.uniforms.uScale.value); }
  dispose() { this.billow.dispose(); for (const w of this.walls) drop(this.D, w); this.D.ctx.scene.remove(this.dust.points); this.dust.points.geometry.dispose(); this.dust.mat.dispose(); }
}

export class ColdWave {
  constructor(D, opts = {}) {
    this.type = 'coldwave'; this.D = D; this.t = 0; this.alive = true; this.phase = 'sweep'; this.fade = 1;
    const side = opts.side ?? (Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 4)), sw = this.sw = new SweepFront(D, side, { speed: 9, slow: 1, fast: 1, pile: 1, start: -70 });
    this.walls = [curtain(D, sw, { H: 80, alpha: 0.72, a: '#b8c2d0', b: '#f0f4fa', rise: 0.05 }), curtain(D, sw, { H: 60, alpha: 0.55, back: 30, a: '#c8d0dc', b: '#eef2f8', rise: 0.05 })];
    const B = D.ctx.city.bounds, geo = new THREE.PlaneGeometry(B.x1 - B.x0 + 300, B.z1 - B.z0 + 300, 1, 1); geo.rotateX(-Math.PI / 2);
    this.frostMat = new THREE.ShaderMaterial({ vertexShader: FROST_VS, fragmentShader: FROST_FS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uLight: { value: 1 }, uFade: { value: 1 }, uOrigin: { value: sw.origin }, uDir: { value: sw.dir }, uTan: { value: sw.tan }, uFront: { value: sw.F }, uPile: { value: sw.P }, uHalfW: { value: sw.halfW }, uSegW: { value: sw.segW } } });
    this.frost = new THREE.Mesh(geo, this.frostMat); this.frost.position.set((B.x0 + B.x1) / 2, 0.215, (B.z0 + B.z1) / 2); this.frost.renderOrder = 2; this.frost.frustumCulled = false;
    D.ctx.scene.add(this.frost);
    const { people } = D.ctx;
    this.cold = new Float32Array(people.x.length); this.stepN = 0; this.snowOn = false; this.frozeSaid = false;
    this.prevWeather = D.weather.type;
    people.alarm(30);
    D.emit({ type: 'warn', hazard: 'coldwave', x: sw.origin.x + sw.dir.x * 80, z: sw.origin.y + sw.dir.y * 80, r: 120, exact: true, text: 'Cold wave! The temperature is crashing in from the ' + sw.coast + '. Anyone caught outside will freeze' });
  }
  update(h) {
    const D = this.D, { people, traffic } = D.ctx, sw = this.sw;
    this.t += h;
    if (this.phase === 'after') {
      this.fade = Math.max(0, this.fade - h / 10);
      if (this.t > this.endT) {
        this.alive = false; people.thawAll(); traffic.gripK = 1;
        D.weather.set(this.prevWeather === 'snow' ? 'clear' : this.prevWeather);
        D.emit({ type: 'coldend', text: 'The cold has broken. The frozen are thawing' });
      }
    } else {
      sw.advance(h);
      if (!this.snowOn && sw.lead() > sw.extent * 0.25) { this.snowOn = true; D.weather.set('snow'); traffic.gripK = 0.35; }
      if (sw.lead() > sw.extent + 80) { this.phase = 'after'; this.endT = this.t + 40; }
    }
    // the cold gets into everyone outdoors behind the front
    if (++this.stepN % 3 !== 0 || this.phase === 'after' && this.fade < 0.5) return;
    const hh = h * 3;
    for (let i = 0; i < people.active; i++) {
      const s = people.st[i];
      if (s === 8 || s === 10 || s === 11 || s === 17 || s === 19 || s === 20 || s === 23 || people.lvl[i] !== -1 || people.kind[i] === 4) continue;
      if (this.phase !== 'after' && sw.behind(people.x[i], people.z[i]) < 0) continue;
      this.cold[i] += hh;
      if (this.cold[i] > 5 + ((i * 7919) % 97) / 97 * 7 && people.freeze(i) && !this.frozeSaid) { this.frozeSaid = true; D.emit({ type: 'freezing', text: 'People are freezing solid in the streets' }); }
    }
  }
  poi(x, z) { return this.phase === 'after' ? null : (() => { const dx = x - this.sw.origin.x, dz = z - this.sw.origin.y, t = dx * this.sw.tan.x + dz * this.sw.tan.y, s = this.sw.frontAt(t); return { x: this.sw.origin.x + this.sw.tan.x * t + this.sw.dir.x * s, z: this.sw.origin.y + this.sw.tan.y * t + this.sw.dir.y * s, danger: 12, range: 260 }; })(); }
  sync(dt, realT) {
    for (const w of this.walls) syncCurtain(this.D, w, realT, this.phase === 'after' ? Math.max(0, this.fade * 2 - 1) : 1);
    this.frostMat.uniforms.uLight.value = this.D.lightK; this.frostMat.uniforms.uFade.value = this.fade;
  }
  dispose() { for (const w of this.walls) drop(this.D, w); this.D.ctx.scene.remove(this.frost); this.frost.geometry.dispose(); this.frostMat.dispose(); if (this.alive) this.D.ctx.people.thawAll(); }
}
