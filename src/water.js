// Water: one animated surface for floods and the sea that follows a tsunami,
// a spray system for splashes, the flood event (water rises through the
// streets, cars stall, people head for the rooftops and the slow ones drown)
// and the tsunami (sirens, then a wall of water sweeps across the city from
// one coast). The wave front is ragged: it is split into sections that each
// advance on their own, rushing down open streets, held back and piling up
// against buildings, and bursting into spray where it hits them.
import * as THREE from 'three';

export const NOISE = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;
// the front line: FRONT_N sections across the coast, packed four to a vec4
export const FRONT_N = 96;
export const FRONT = /* glsl */`
uniform vec4 uFront[24]; uniform vec4 uPile[24]; uniform float uHalfW, uSegW;
float pick(vec4 v, int c) { return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
float frontSeg(int i) { i = clamp(i, 0, ${FRONT_N - 1}); return pick(uFront[i / 4], i - (i / 4) * 4); }
float pileSeg(int i) { i = clamp(i, 0, ${FRONT_N - 1}); return pick(uPile[i / 4], i - (i / 4) * 4); }
float frontAt(float t) { float f = (t + uHalfW) / uSegW, i0 = floor(f); return mix(frontSeg(int(i0)), frontSeg(int(i0) + 1), f - i0); }
float pileAt(float t) { float f = (t + uHalfW) / uSegW, i0 = floor(f); return mix(pileSeg(int(i0)), pileSeg(int(i0) + 1), f - i0); }
`;

const SURF_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SURF_FS = /* glsl */`
uniform float uTime, uAlpha, uFogDensity, uLight, uSunI, uHasFront, uLag; uniform vec2 uOrigin, uDir, uTan;
uniform vec3 uDeep, uShallow, uSky, uSunDir, uFogColor;
varying vec3 vW;
${NOISE}
${FRONT}
void main() {
  float behind = 1e4;
  if (uHasFront > 0.5) {
    vec2 r = vW.xz - uOrigin;
    behind = frontAt(dot(r, uTan)) - uLag - dot(r, uDir);
    if (behind < 0.0) discard;
  }
  vec2 p = vW.xz * 0.05;
  float n1 = fbm(p + vec2(uTime * 0.05, uTime * 0.03));
  float n2 = fbm(p * 2.7 - vec2(uTime * 0.09, -uTime * 0.06));
  float n = n1 * 0.6 + n2 * 0.4;
  vec3 N = normalize(vec3((n1 - 0.5) * 0.7, 1.0, (n2 - 0.5) * 0.7));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(0.0, dot(N, V)), 3.0);
  vec3 col = mix(uDeep, uShallow, n) * uLight;
  col = mix(col, uSky * 0.75, 0.1 + fres * 0.55);
  vec3 H = normalize(uSunDir + V);
  col += pow(max(0.0, dot(N, H)), 90.0) * 0.8 * uSunI;
  // churned white water just behind the wave, scum streaks elsewhere
  float churn = smoothstep(45.0, 0.0, behind) * smoothstep(0.42, 0.7, fbm(vW.xz * 0.11 + vec2(uTime * 0.4, -uTime * 0.25)));
  col = mix(col, vec3(0.62, 0.6, 0.55) * uLight, max(smoothstep(0.66, 0.8, n2) * 0.25, churn * 0.85));
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.85);
  gl_FragColor = vec4(col, uAlpha);
}`;

const WAVE_VS = /* glsl */`
uniform float uTime, uHw, uFlood, uDepth; uniform vec2 uOrigin, uDir, uTan;
varying float vH; varying float vU; varying vec3 vW;
${NOISE}
${FRONT}
void main() {
  float tc = position.x, u = position.z, crest = 8.0;
  float hw = uHw * pileAt(tc) * (0.78 + 0.44 * noise(vec2(tc * 0.016, uTime * 0.08)));
  float h;
  if (u < crest) { float k = u / crest; h = hw * (1.0 - pow(1.0 - k, 2.4)); }
  else { float k = (u - crest) / (uDepth - crest); h = mix(hw, uFlood, smoothstep(0.0, 1.0, k)); }
  float rough = fbm(vec2(tc * 0.04 + uTime * 0.2, u * 0.08 - uTime * 0.5));
  h += (rough - 0.5) * 3.2 * (1.0 - u / uDepth) + sin(tc * 0.05 + uTime * 1.3) * 0.6;
  float lip = smoothstep(crest * 0.3, crest, u) * (1.0 - smoothstep(crest, crest * 2.2, u));
  float s = frontAt(tc) - u + lip * (2.5 + 2.0 * noise(vec2(tc * 0.03, uTime * 0.3)));
  vec3 w = vec3(uOrigin.x + uTan.x * tc + uDir.x * s, max(0.0, h), uOrigin.y + uTan.y * tc + uDir.y * s);
  vH = h / hw; vU = u; vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const WAVE_FS = /* glsl */`
uniform float uTime, uFade, uFogDensity, uLight; uniform vec3 uFogColor, uSunDir;
varying float vH; varying float vU; varying vec3 vW;
${NOISE}
void main() {
  float n = fbm(vW.xz * 0.08 + vec2(uTime * 0.3, -uTime * 0.2));
  vec3 body = mix(vec3(0.02, 0.05, 0.06), vec3(0.09, 0.18, 0.18), smoothstep(0.2, 1.0, vH));
  float crest = smoothstep(0.78, 1.0, vH) * smoothstep(16.0, 6.0, vU) * smoothstep(1.0, 4.5, vU);
  float toe = smoothstep(2.5, 0.0, vU) * 0.8;
  float streak = smoothstep(0.55, 0.78, n) * 0.45 * smoothstep(38.0, 8.0, vU);
  float foam = clamp((crest + toe + streak) * (0.6 + n * 0.8), 0.0, 1.0);
  vec3 col = mix(body, vec3(0.75, 0.76, 0.74), foam) * uLight;
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.8);
  gl_FragColor = vec4(col, (0.88 + foam * 0.12) * uFade);
}`;

// spray: ballistic droplets that burst up, arc over and fade
const SPLASH_VS = /* glsl */`
uniform float uTime, uScale;
attribute vec3 aVel; attribute vec3 aT; // start time, life, size
varying float vA;
void main() {
  float t = uTime - aT.x, k = t / aT.y;
  if (k < 0.0 || k >= 1.0) { vA = 0.0; gl_PointSize = 0.0; gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  vec3 p = position + aVel * t; p.y -= 4.9 * t * t;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = min(260.0, aT.z * (0.5 + k * 1.7) * uScale / -mv.z);
  vA = (1.0 - k) * (1.0 - k) * smoothstep(0.0, 0.05, k);
  gl_Position = projectionMatrix * mv;
}`;
const SPLASH_FS = /* glsl */`
uniform vec3 uColor; uniform float uLight;
varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor * uLight, smoothstep(0.5, 0.1, d) * vA * 0.9); }`;

export class Splash {
  constructor(scene, cap) {
    this.cap = cap; this.head = 0; this.time = 0; this.dirty = false;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3); this.tt = new Float32Array(cap * 3);
    for (let i = 0; i < cap; i++) { this.tt[i * 3] = -1e9; this.tt[i * 3 + 1] = 1; }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(this.vel, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(this.tt, 3));
    this.mat = new THREE.ShaderMaterial({ vertexShader: SPLASH_VS, fragmentShader: SPLASH_FS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uScale: { value: 500 }, uLight: { value: 1 }, uColor: { value: new THREE.Color(0.86, 0.9, 0.9) } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6;
    scene.add(this.points);
  }
  // n droplets from (x, y, z). o: dir [vx, vz] mean sideways velocity, up [min, max], spread, life, size,
  // along [tx, tz, half] to spread the source along a line, rise (random start height)
  emit(x, y, z, n, o = {}) {
    const up = o.up || [4, 9], dir = o.dir || [0, 0], sp = o.spread ?? 3, life = o.life ?? 1.6, size = o.size ?? 2, al = o.along, rise = o.rise ?? 0, v = o.v; // v: thrown at exactly this velocity (a jet)
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % this.cap;
      const a = al ? (Math.random() * 2 - 1) * al[2] : 0;
      this.pos[i * 3] = x + (al ? al[0] * a : 0) + (Math.random() - 0.5) * 1.5;
      this.pos[i * 3 + 1] = y + Math.random() * rise;
      this.pos[i * 3 + 2] = z + (al ? al[1] * a : 0) + (Math.random() - 0.5) * 1.5;
      this.vel[i * 3] = (v ? v[0] : dir[0] * (0.5 + Math.random())) + (Math.random() - 0.5) * sp;
      this.vel[i * 3 + 1] = v ? v[1] + (Math.random() - 0.5) * sp : up[0] + Math.random() * (up[1] - up[0]);
      this.vel[i * 3 + 2] = (v ? v[2] : dir[1] * (0.5 + Math.random())) + (Math.random() - 0.5) * sp;
      this.tt[i * 3] = this.time - Math.random() * 0.15; this.tt[i * 3 + 1] = life * (0.7 + Math.random() * 0.6); this.tt[i * 3 + 2] = size * (0.6 + Math.random() * 0.8);
    }
    this.dirty = true;
  }
  update(h) { this.time += h; }
  sync(lightK, scale) {
    if (this.dirty) { const a = this.points.geometry.attributes; a.position.needsUpdate = a.aVel.needsUpdate = a.aT.needsUpdate = true; this.dirty = false; }
    const u = this.mat.uniforms; u.uTime.value = this.time; u.uLight.value = lightK; u.uScale.value = scale;
  }
  reset() { for (let i = 0; i < this.cap; i++) this.tt[i * 3] = -1e9; this.dirty = true; }
}

const PALETTE = {
  flood: [new THREE.Color(0.075, 0.065, 0.042), new THREE.Color(0.17, 0.145, 0.09), new THREE.Color(0.5, 0.46, 0.36)],
  sea: [new THREE.Color(0.03, 0.065, 0.075), new THREE.Color(0.1, 0.16, 0.16), new THREE.Color(0.86, 0.9, 0.9)],
};
const NO_FRONT = new Float32Array(FRONT_N).fill(1e6), FLAT = new Float32Array(FRONT_N).fill(1);

export class WaterSurface {
  constructor(D) {
    this.D = D;
    const B = D.ctx.city.bounds, M = 260;
    const geo = new THREE.PlaneGeometry(B.x1 - B.x0 + M * 2, B.z1 - B.z0 + M * 2, 96, 96); geo.rotateX(-Math.PI / 2); // enough vertices to bend with the world's curve (as one 1x1 sheet its far corners dropped and the water sank out of sight zoomed out)
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SURF_VS, fragmentShader: SURF_FS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.9 }, uFogDensity: { value: 0.0006 }, uLight: { value: 1 }, uSunI: { value: 1 },
        uHasFront: { value: 0 }, uLag: { value: 9 }, uFront: { value: NO_FRONT }, uPile: { value: FLAT }, uHalfW: { value: 1 }, uSegW: { value: 1 },
        uOrigin: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uTan: { value: new THREE.Vector2(0, 1) },
        uDeep: { value: PALETTE.flood[0].clone() }, uShallow: { value: PALETTE.flood[1].clone() }, uSky: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFogColor: { value: new THREE.Color() } },
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.position.set((B.x0 + B.x1) / 2, -1, (B.z0 + B.z1) / 2);
    this.mesh.renderOrder = 2; this.mesh.visible = false; this.mesh.frustumCulled = false;
    D.ctx.scene.add(this.mesh);
    this.splash = new Splash(D.ctx.scene, D.ctx.low ? 1800 : 3600);
    this.level = -1; this.front = null; this.lag = 9; this.wetLag = 1; this.halfW = 1; this.segW = 1; // the flat surface starts lag behind the wave front (the wave's own body before it); for people, cars and boats the water starts right behind it
    this.origin = new THREE.Vector2(); this.dir = new THREE.Vector2(1, 0); this.tan = new THREE.Vector2(0, 1);
    this.levelAt = (x, z) => {
      if (!this.front) return this.level;
      const dx = x - this.origin.x, dz = z - this.origin.y;
      return dx * this.dir.x + dz * this.dir.y > this.frontAt(dx * this.tan.x + dz * this.tan.y) - this.wetLag ? -99 : this.level;
    };
  }
  frontAt(t) {
    if (!this.front) return 1e9; // no wave front (a flood): the water is everywhere
    const f = (t + this.halfW) / this.segW, i = Math.max(0, Math.min(FRONT_N - 2, Math.floor(f))), k = Math.min(1, Math.max(0, f - i));
    return this.front[i] * (1 - k) + this.front[i + 1] * k;
  }
  colors(kind) { const u = this.mat.uniforms; u.uDeep.value.copy(PALETTE[kind][0]); u.uShallow.value.copy(PALETTE[kind][1]); this.splash.mat.uniforms.uColor.value.copy(PALETTE[kind][2]); }
  get active() { return this.level > -0.3; }
  update(h) {
    const { people, traffic } = this.D.ctx, on = this.active;
    people.waterAt = on ? this.levelAt : null; traffic.waterAt = on ? this.levelAt : null; this.D.debris.waterY = on ? this.levelAt : null;
    this.splash.update(h);
  }
  sync(dt, realT) {
    this.splash.sync(this.D.lightK, this.D.ctx.fire.uniforms.uScale.value);
    this.mesh.visible = this.active;
    if (!this.mesh.visible) return;
    const { scene, sun } = this.D.ctx, u = this.mat.uniforms;
    this.mesh.position.y = this.level;
    u.uTime.value = realT; u.uOrigin.value.copy(this.origin); u.uDir.value.copy(this.dir); u.uTan.value.copy(this.tan);
    u.uHasFront.value = this.front ? 1 : 0; u.uFront.value = this.front || NO_FRONT; u.uHalfW.value = this.halfW; u.uSegW.value = this.segW; u.uLag.value = this.lag;
    u.uSky.value.copy(scene.background); u.uFogColor.value.copy(scene.background); u.uFogDensity.value = scene.fog ? scene.fog.density : 0.0006;
    u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    u.uLight.value = this.D.lightK; u.uSunI.value = this.D.sunK;
  }
  reset() { this.level = -1; this.front = null; this.mesh.visible = false; this.splash.reset(); this.update(0); }
}

export class Flood {
  constructor(D, opts = {}) {
    this.type = 'flood'; this.D = D; this.t = 0; this.alive = true;
    this.maxL = opts.level ?? 1.75; this.rise = 26; this.hold = 75; this.fall = 35;
    D.water.colors('flood'); if (!D.list.some(e => e.type === 'tsunami' && e.alive)) D.water.front = null; // a tsunami still coming in keeps its front (clearing it under the wave stopped the game)
    const w = D.weather.type; if (w === 'clear' || w === 'heat' || w === 'sand' || w === 'fog') D.weather.set('rain');
    D.ctx.people.alarm(25);
    D.emit({ type: 'warn', hazard: 'flood', text: 'Flash flood! The river has burst its banks. Get people to high ground' });
  }
  get level() {
    const t = this.t;
    if (t < this.rise) return -0.3 + (this.maxL + 0.3) * (t / this.rise);
    if (t < this.rise + this.hold) return this.maxL;
    return this.maxL - (this.maxL + 0.5) * Math.min(1, (t - this.rise - this.hold) / this.fall);
  }
  update(h) {
    this.t += h;
    this.D.water.level = this.level;
    if (this.t > this.rise + this.hold + this.fall) { this.alive = false; this.D.water.level = -1; this.D.emit({ type: 'floodend', text: 'The flood water has drained away' }); }
  }
  sync() {}
  dispose() { if (!this.D.list.some(e => e !== this && (e.type === 'flood' || e.type === 'tsunami') && e.alive)) this.D.water.level = -1; }
}

// a front that sweeps across the city from one coast, split into sections that each keep their own pace
// (sections inside standing buildings slow down and pile up, open streets race ahead)
export class SweepFront {
  constructor(D, side, o = {}) {
    this.D = D;
    const B = D.ctx.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]], edges = [[cx, B.z1 + 40], [cx, B.z0 - 40], [B.x1 + 40, cz], [B.x0 - 40, cz]];
    this.dir = new THREE.Vector2(...dirs[side]); this.origin = new THREE.Vector2(...edges[side]); this.tan = new THREE.Vector2(-this.dir.y, this.dir.x);
    this.extent = (side < 2 ? B.z1 - B.z0 : B.x1 - B.x0) + 80; this.width = (side < 2 ? B.x1 - B.x0 : B.z1 - B.z0) + 600;
    this.halfW = this.width / 2; this.segW = this.width / (FRONT_N - 1);
    this.coast = ['South', 'North', 'East', 'West'][side];
    this.speed = o.speed ?? 15; this.slow = o.slow ?? 0.45; this.fast = o.fast ?? 1.08; this.pileK = o.pile ?? 1.4; this.t = 0;
    this.pull = o.pull || null; // optional (tangent coordinate, front) -> speed factor: lets a player drag the front
    this.F = new Float32Array(FRONT_N); this.P = new Float32Array(FRONT_N).fill(1); this.T = new Float32Array(FRONT_N);
    this.held = new Uint8Array(FRONT_N); this.tame = new Uint8Array(FRONT_N); // held at a flood barrier; spilled over one (no force left)
    this.pace = new Float32Array(FRONT_N); this.ph = new Float32Array(FRONT_N);
    const a = Math.random() * 6, b = Math.random() * 6, s0 = o.start ?? -40;
    for (let k = 0; k < FRONT_N; k++) { this.F[k] = s0 + Math.sin(k * 0.37 + a) * 5 + Math.sin(k * 0.11 + b) * 9; this.pace[k] = 0.9 + Math.random() * 0.2; this.ph[k] = Math.random() * 6.28; }
  }
  at(k, back = 0) { const t = -this.halfW + k * this.segW, s = this.F[k] - back; return [this.origin.x + this.tan.x * t + this.dir.x * s, this.origin.y + this.tan.y * t + this.dir.y * s]; }
  inCity(x, z, m = 20) { const B = this.D.ctx.city.bounds; return x > B.x0 - m && x < B.x1 + m && z > B.z0 - m && z < B.z1 + m; }
  frontAt(t) { const f = (t + this.halfW) / this.segW, i = Math.max(0, Math.min(FRONT_N - 2, Math.floor(f))), k = Math.min(1, Math.max(0, f - i)); return this.F[i] * (1 - k) + this.F[i + 1] * k; }
  // how far behind the front (x, z) is (negative: not reached yet)
  behind(x, z) { const dx = x - this.origin.x, dz = z - this.origin.y; return this.frontAt(dx * this.tan.x + dz * this.tan.y) - (dx * this.dir.x + dz * this.dir.y); }
  lead() { let m = Infinity; for (let k = 0; k < FRONT_N; k++) m = Math.min(m, this.F[k]); return m; }
  tameRange(t0, t1) { for (let k = 0; k < FRONT_N; k++) { const t = -this.halfW + k * this.segW; if (t > t0 && t < t1) this.tame[k] = 1; } }
  tameAt(t) { return this.tame[Math.max(0, Math.min(FRONT_N - 1, Math.round((t + this.halfW) / this.segW)))] === 1; }
  advance(h) {
    const { city } = this.D.ctx, F = this.F, P = this.P, H = this.held, bar = this.D.barriers, slowAt = this.D.slowAt;
    this.t += h;
    for (let k = 0; k < FRONT_N; k++) {
      const [x, z] = this.at(k);
      let blocked = false;
      if (this.slow < 1 && this.inCity(x, z)) city.buildingsNear(x, z, 3, (kb, d) => { if (d === 0 && !city.dead[kb]) blocked = true; });
      const f0 = F[k], slow = slowAt ? this.D.slowAt(x, 4, z) : 1; // one of Tempo's time bubbles holds it to a crawl
      F[k] += this.speed * this.pace[k] * (0.9 + 0.2 * Math.sin(this.t * 0.35 + this.ph[k])) * (blocked ? this.slow : this.fast) * (this.tame[k] ? 0.6 : 1) * slow * (this.pull ? this.pull(-this.halfW + k * this.segW, F[k]) : 1) * h;
      H[k] = 0;
      const b = bar && bar.list.length ? bar.holdAt(this, -this.halfW + k * this.segW, f0) : null;
      if (b && F[k] > b.stop) { F[k] = b.stop; H[k] = 1; b.held = true; } // stopped at a flood barrier
      P[k] += ((H[k] ? 1.15 : blocked ? this.pileK : 1) - P[k]) * Math.min(1, h * 2.5);
    }
    // keep it one body: a little smoothing, and no section may trail its neighbour by more than a steep slope
    const T = this.T, L = this.segW * 1.3;
    for (let k = 0; k < FRONT_N; k++) T[k] = H[k] ? F[k] : F[k] + 0.02 * ((F[k - 1] ?? F[k]) + (F[k + 1] ?? F[k]) - 2 * F[k]);
    for (let k = 0; k < FRONT_N - 1; k++) {
      if (H[k] || H[k + 1]) continue; // held at a barrier: the rest of the wave goes on round it
      const e = T[k + 1] - T[k];
      if (e > L) { T[k] += (e - L) * 0.7; T[k + 1] -= (e - L) * 0.3; } else if (e < -L) { T[k + 1] += (-e - L) * 0.7; T[k] -= (-e - L) * 0.3; }
    }
    F.set(T);
  }
}

export class Tsunami {
  constructor(D, opts = {}) {
    this.type = 'tsunami'; this.D = D; this.t = 0; this.alive = true; this.phase = 'warn';
    const side = opts.side ?? (Math.random() < 0.75 ? 0 : Math.floor(Math.random() * 4)); // 0 south (the ocean), 1 north, 2 east, 3 west
    const sw = this.sw = new SweepFront(D, side, { speed: opts.speed ?? 15, slow: 0.45, fast: 1.08, pile: 1.4, pull: opts.pull, start: opts.start });
    Object.assign(this, { dir: sw.dir, origin: sw.origin, tan: sw.tan, extent: sw.extent, width: sw.width, halfW: sw.halfW, segW: sw.segW, coast: sw.coast, front: sw.F, pile: sw.P });
    this.Hw = opts.height ?? 12; this.floodH = 4.2; this.warnT = opts.warn ?? 18; this.damaged = new Set(); this.stepN = 0;
    this.recedeT = 0;
    const { people, traffic } = D.ctx;
    if (!opts.quiet) people.alarm(40);
    for (const car of traffic.cars) if (car.mode === 0 && !car.mission) { car.panic = 30; car.zx = this.origin.x; car.zz = this.origin.y; }
    if (!opts.quiet) D.emit({ type: 'warn', hazard: 'tsunami', x: this.origin.x + this.dir.x * 60, z: this.origin.y + this.dir.y * 60, r: 120, exact: true, text: 'Tsunami warning! A wave is coming in from the ' + this.coast + ' coast. Get everyone onto the rooftops' });
    // the wave: x runs along the coast, z is distance behind the front; the vertex shader bends it to the front line
    const geo = new THREE.PlaneGeometry(this.width, 70, 220, 28); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 35);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: WAVE_VS, fragmentShader: WAVE_FS, transparent: true, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uHw: { value: this.Hw }, uFlood: { value: this.floodH }, uDepth: { value: 70 }, uFade: { value: 1 }, uFogDensity: { value: 0.0006 }, uLight: { value: 1 },
        uFogColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uOrigin: { value: this.origin }, uDir: { value: this.dir }, uTan: { value: this.tan },
        uFront: { value: this.front }, uPile: { value: this.pile }, uHalfW: { value: this.halfW }, uSegW: { value: this.segW } },
    });
    this.wave = new THREE.Mesh(geo, this.mat); this.wave.visible = false; this.wave.frustumCulled = false; this.wave.renderOrder = 3;
    D.ctx.scene.add(this.wave);
  }

  at(k, back = 0) { return this.sw.at(k, back); }
  inCity(x, z, m = 20) { return this.sw.inCity(x, z, m); }
  advance(h) { this.sw.advance(h); }

  update(h) {
    const D = this.D, { people, traffic, city, fire } = D.ctx, W = D.water;
    this.t += h;
    if (this.phase === 'warn') {
      if (this.t > this.warnT) {
        this.phase = 'wave'; this.wave.visible = true;
        W.colors('sea'); W.origin.copy(this.origin); W.dir.copy(this.dir); W.tan.copy(this.tan); W.halfW = this.halfW; W.segW = this.segW; W.front = this.front; W.lag = 9;
        W.level = this.floodH;
        const c = D.ctx.controls.target, p = this.poi(c.x, c.z);
        D.emit({ type: 'tsunamihit', x: p ? p.x : c.x, z: p ? p.z : c.z, text: 'The wave is here!' });
      }
      return;
    }
    if (this.phase === 'wave') {
      this.advance(h);
      D.shake(0.12);
      const o = this.origin, d = this.dir, tn = this.tan;
      const inBand = (x, z) => { const dx = x - o.x, dz = z - o.y, s = dx * d.x + dz * d.y, t = dx * tn.x + dz * tn.y, f = W.frontAt(t); return s > f - 3 && s < f + 1.5 && !this.sw.tameAt(t); }; // what spills over a barrier sweeps nobody away
      const push = () => [d.x * (15 + Math.random() * 7), 3 + Math.random() * 4, d.y * (15 + Math.random() * 7)];
      for (let i = 0; i < people.active; i++) {
        const s = people.st[i];
        if (s === 8 || s === 10 || s === 17 || s === 19 || s === 20 || s === 29 || people.lvl[i] !== -1) continue;
        if (inBand(people.x[i], people.z[i])) { const f = 6 + Math.random() * 6; people.fling(i, d.x * f, 3 + Math.random() * 3, d.y * f); } // tumbled over and down into the water behind the front (most come up again)
      }
      for (const car of traffic.cars) {
        if (car.gone || car.mode === 4 || car.mode === 5) continue;
        if (inBand(car.x, car.z)) { const v = push(); traffic.fling(car, v[0], v[1] + 1, v[2]); W.splash.emit(car.x, 1, car.z, 10, { up: [4, 9], dir: [d.x * 6, d.y * 6], spread: 4, life: 1.4, size: 1.6 }); }
      }
      for (const pc of traffic.parkedList) {
        if (!pc.alive || !inBand(pc.x, pc.z)) continue;
        traffic.takeParked(pc);
        const m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
        D.debris.addObject(m, 'fly', { v: push() });
      }
      // spray thrown off the crest all along the front
      for (let n = 0; n < 4; n++) {
        const k = Math.floor(Math.random() * FRONT_N), [x, z] = this.at(k, 4);
        if (this.inCity(x, z, 120)) W.splash.emit(x, this.Hw * this.pile[k] * 0.85, z, 7, { up: [2, 6], dir: [d.x * 7, d.y * 7], spread: 5, life: 1.5, size: 1.5, along: [tn.x, tn.y, this.segW * 0.5] });
      }
      if (++this.stepN % 2 === 0) {
        for (let k = 0; k < FRONT_N; k++) {
          const [px, pz] = this.at(k);
          if (!this.inCity(px, pz) || this.sw.tame[k] || this.sw.held[k]) continue;
          for (const it of city.takeStreetNear(px, pz, 9)) { const v = push(); D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.6, it.s * 0.9, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v }); }
          city.buildingsNear(px, pz, 6, (kb, dd, b) => {
            if (this.damaged.has(kb)) return;
            this.damaged.add(kb); // first contact: it bursts up the facade, then the building gets one roll
            this.burst(b, px, pz, k);
            if (b.top - b.baseY < this.Hw * 0.75 && Math.random() < 0.45) D.destroyBuilding(kb, 'collapse', { dir: Math.atan2(d.y, d.x) });
            else { city.char(kb, 0.84); if (fire.bFire[kb] === 1) fire.extinguish(kb); D.blowWindows(kb, d.x, d.y, 1); } // the far side's windows burst out
          });
        }
      }
      if (this.sw.lead() > this.extent + 70) { this.phase = 'recede'; this.recedeT = 0; W.front = null; }
      return;
    }
    // the sea drains back out of the streets
    this.recedeT += h;
    this.mat.uniforms.uFade.value = Math.max(0, 1 - this.recedeT / 3);
    if (this.recedeT > 3) this.wave.visible = false;
    W.level = this.floodH - (this.floodH + 0.5) * Math.min(1, this.recedeT / 50);
    if (this.recedeT > 50) { this.alive = false; W.level = -1; D.emit({ type: 'tsunamiend', text: 'The sea has drained out of the streets' }); }
  }

  poi(x, z) {
    if (this.phase === 'recede') return null;
    const sw = this.sw;
    if (this.phase === 'warn') { const dx = x - sw.origin.x, dz = z - sw.origin.y, t = dx * sw.tan.x + dz * sw.tan.y; return { x: sw.origin.x + sw.tan.x * t, z: sw.origin.y + sw.tan.y * t, danger: 0, range: 700 }; } // looking out to sea
    return (() => { const dx = x - sw.origin.x, dz = z - sw.origin.y, t = dx * sw.tan.x + dz * sw.tan.y, s = sw.frontAt(t); return { x: sw.origin.x + sw.tan.x * t + sw.dir.x * s, z: sw.origin.y + sw.tan.y * t + sw.dir.y * s, danger: 30, range: 420 }; })();
  }
  // the wave slams into a facade: a sheet of spray climbs it and falls back, mist hangs after
  burst(b, px, pz, k) {
    const D = this.D, d = this.dir, tn = this.tan, sp = D.water.splash;
    const qx = Math.max(b.x0, Math.min(b.x1, px)), qz = Math.max(b.z0, Math.min(b.z1, pz));
    const face = Math.abs(tn.x) > 0.5 ? b.x1 - b.x0 : b.z1 - b.z0, half = Math.min(face, this.segW * 1.6) / 2;
    const tall = Math.min(1.6, 0.7 + (b.top - b.baseY) / 30), power = this.pile[k] * tall;
    sp.emit(qx - d.x * 1.5, 1, qz - d.y * 1.5, Math.round(60 + half * 5), { up: [9 * power, 22 * power], dir: [-d.x * 3, -d.y * 3], spread: 6, life: 2.6, size: 2.1, along: [tn.x, tn.y, half], rise: this.Hw * 0.5 });
    sp.emit(qx - d.x * 3, this.Hw * 0.6, qz - d.y * 3, 10, { up: [3, 8], dir: [-d.x * 7, -d.y * 7], spread: 8, life: 2.2, size: 3, along: [tn.x, tn.y, half] });
  }

  sync(dt, realT) {
    if (!this.wave.visible) return;
    const { scene, sun } = this.D.ctx, u = this.mat.uniforms;
    u.uTime.value = realT; u.uFogColor.value.copy(scene.background); u.uFogDensity.value = scene.fog ? scene.fog.density : 0.0006;
    u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    u.uLight.value = this.D.lightK;
  }
  dispose() {
    this.D.ctx.scene.remove(this.wave); this.wave.geometry.dispose(); this.mat.dispose();
    if (!this.D.list.some(e => e !== this && (e.type === 'flood' || e.type === 'tsunami') && e.alive)) { this.D.water.level = -1; this.D.water.front = null; }
  }
}
