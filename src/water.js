// Water: one animated surface for floods and the sea that follows a tsunami,
// the flood event (water rises through the streets, cars stall, people head
// for the rooftops and the slow ones drown) and the tsunami (sirens, then a
// wall of water sweeps across the city from one coast, carrying away people,
// cars, trees and low buildings, and leaves the streets flooded).
import * as THREE from 'three';

const NOISE = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;
const SURF_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SURF_FS = /* glsl */`
uniform float uTime, uFrontS, uAlpha, uFogDensity, uLight, uSunI; uniform vec2 uOrigin, uDir;
uniform vec3 uDeep, uShallow, uSky, uSunDir, uFogColor;
varying vec3 vW;
${NOISE}
void main() {
  if (dot(vW.xz - uOrigin, uDir) > uFrontS) discard;
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
  col = mix(col, vec3(0.62, 0.6, 0.55) * uLight, smoothstep(0.66, 0.8, n2) * 0.25);
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.85);
  gl_FragColor = vec4(col, uAlpha);
}`;

const WAVE_VS = /* glsl */`
uniform float uTime, uHw, uFlood, uDepth;
varying float vH; varying float vU; varying vec3 vW;
${NOISE}
void main() {
  float u = position.z; float crest = 8.0;
  float h;
  if (u < crest) { float k = u / crest; h = uHw * (1.0 - pow(1.0 - k, 2.4)); }
  else { float k = (u - crest) / (uDepth - crest); h = mix(uHw, uFlood, smoothstep(0.0, 1.0, k)); }
  float rough = fbm(vec2(position.x * 0.04 + uTime * 0.2, u * 0.08 - uTime * 0.5));
  h += (rough - 0.5) * 2.6 * (1.0 - u / uDepth) + sin(position.x * 0.05 + uTime * 1.3) * 0.6;
  float lip = smoothstep(crest * 0.3, crest, u) * (1.0 - smoothstep(crest, crest * 2.2, u));
  vec3 p = vec3(position.x, max(0.0, h), u - lip * 3.5);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vH = h / uHw; vU = u; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WAVE_FS = /* glsl */`
uniform float uTime, uFade, uFogDensity, uLight; uniform vec3 uFogColor, uSunDir;
varying float vH; varying float vU; varying vec3 vW;
${NOISE}
void main() {
  float n = fbm(vW.xz * 0.08 + vec2(uTime * 0.3, -uTime * 0.2));
  vec3 body = mix(vec3(0.02, 0.05, 0.06), vec3(0.09, 0.18, 0.18), smoothstep(0.2, 1.0, vH));
  float crest = smoothstep(0.82, 1.0, vH) * smoothstep(16.0, 7.0, vU) * smoothstep(1.5, 5.0, vU);
  float toe = smoothstep(2.0, 0.0, vU) * 0.75;
  float streak = smoothstep(0.58, 0.78, n) * 0.4 * smoothstep(34.0, 8.0, vU);
  float foam = clamp((crest + toe + streak) * (0.65 + n * 0.7), 0.0, 1.0);
  vec3 col = mix(body, vec3(0.75, 0.76, 0.74), foam) * uLight;
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.8);
  gl_FragColor = vec4(col, (0.88 + foam * 0.12) * uFade);
}`;

const PALETTE = {
  flood: [new THREE.Color(0.075, 0.065, 0.042), new THREE.Color(0.17, 0.145, 0.09)],
  sea: [new THREE.Color(0.03, 0.065, 0.075), new THREE.Color(0.1, 0.16, 0.16)],
};

export class WaterSurface {
  constructor(D) {
    this.D = D;
    const B = D.ctx.city.bounds, M = 260;
    const geo = new THREE.PlaneGeometry(B.x1 - B.x0 + M * 2, B.z1 - B.z0 + M * 2, 1, 1); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SURF_VS, fragmentShader: SURF_FS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uFrontS: { value: 1e6 }, uAlpha: { value: 0.9 }, uFogDensity: { value: 0.0006 }, uLight: { value: 1 }, uSunI: { value: 1 }, uOrigin: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) },
        uDeep: { value: PALETTE.flood[0].clone() }, uShallow: { value: PALETTE.flood[1].clone() }, uSky: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFogColor: { value: new THREE.Color() } },
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.position.set((B.x0 + B.x1) / 2, -1, (B.z0 + B.z1) / 2);
    this.mesh.renderOrder = 2; this.mesh.visible = false; this.mesh.frustumCulled = false;
    D.ctx.scene.add(this.mesh);
    this.level = -1; this.frontS = 1e6; this.origin = new THREE.Vector2(); this.dir = new THREE.Vector2(1, 0);
    this.levelAt = (x, z) => ((x - this.origin.x) * this.dir.x + (z - this.origin.y) * this.dir.y > this.frontS ? -99 : this.level);
  }
  colors(kind) { this.mat.uniforms.uDeep.value.copy(PALETTE[kind][0]); this.mat.uniforms.uShallow.value.copy(PALETTE[kind][1]); }
  get active() { return this.level > -0.3; }
  update() {
    const { people, traffic } = this.D.ctx, on = this.active;
    people.waterAt = on ? this.levelAt : null; traffic.waterAt = on ? this.levelAt : null; this.D.debris.waterY = on ? this.levelAt : null;
  }
  sync(dt, realT) {
    this.mesh.visible = this.active;
    if (!this.mesh.visible) return;
    const { scene, sun } = this.D.ctx, u = this.mat.uniforms;
    this.mesh.position.y = this.level;
    u.uTime.value = realT; u.uFrontS.value = this.frontS; u.uOrigin.value.copy(this.origin); u.uDir.value.copy(this.dir);
    u.uSky.value.copy(scene.background); u.uFogColor.value.copy(scene.background); u.uFogDensity.value = scene.fog ? scene.fog.density : 0.0006;
    u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    u.uLight.value = this.D.lightK; u.uSunI.value = this.D.sunK;
  }
  reset() { this.level = -1; this.frontS = 1e6; this.mesh.visible = false; this.update(); }
}

export class Flood {
  constructor(D, opts = {}) {
    this.type = 'flood'; this.D = D; this.t = 0; this.alive = true;
    this.maxL = opts.level ?? 1.75; this.rise = 26; this.hold = 75; this.fall = 35;
    D.water.colors('flood'); D.water.frontS = 1e6;
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

export class Tsunami {
  constructor(D, opts = {}) {
    this.type = 'tsunami'; this.D = D; this.t = 0; this.alive = true; this.phase = 'warn';
    const B = D.ctx.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const side = opts.side ?? Math.floor(Math.random() * 4); // 0 south, 1 north, 2 east, 3 west
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]], edges = [[cx, B.z1 + 40], [cx, B.z0 - 40], [B.x1 + 40, cz], [B.x0 - 40, cz]];
    this.dir = new THREE.Vector2(...dirs[side]); this.origin = new THREE.Vector2(...edges[side]); this.tan = new THREE.Vector2(-this.dir.y, this.dir.x);
    this.extent = (side < 2 ? B.z1 - B.z0 : B.x1 - B.x0) + 80; this.width = (side < 2 ? B.x1 - B.x0 : B.z1 - B.z0) + 600;
    this.coast = ['South', 'North', 'East', 'West'][side];
    this.Hw = opts.height ?? 12; this.floodH = 4.2; this.speed = 15; this.frontS = -40; this.warnT = opts.warn ?? 18; this.damaged = new Set(); this.stepN = 0;
    this.recedeT = 0;
    const { people, traffic } = D.ctx;
    people.alarm(40);
    for (const car of traffic.cars) if (car.mode === 0 && !car.mission) { car.panic = 30; car.zx = this.origin.x; car.zz = this.origin.y; }
    D.emit({ type: 'warn', hazard: 'tsunami', x: this.origin.x + this.dir.x * 60, z: this.origin.y + this.dir.y * 60, r: 120, exact: true, text: 'Tsunami warning! A wave is coming in from the ' + this.coast + ' coast. Get everyone onto the rooftops' });
    // the wave
    const geo = new THREE.PlaneGeometry(this.width, 70, 90, 28); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 35);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: WAVE_VS, fragmentShader: WAVE_FS, transparent: true, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uHw: { value: this.Hw }, uFlood: { value: this.floodH }, uDepth: { value: 70 }, uFade: { value: 1 }, uFogDensity: { value: 0.0006 }, uLight: { value: 1 }, uFogColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } },
    });
    this.wave = new THREE.Mesh(geo, this.mat); this.wave.visible = false; this.wave.frustumCulled = false; this.wave.renderOrder = 3;
    this.wave.rotation.y = Math.atan2(-this.dir.x, -this.dir.y);
    D.ctx.scene.add(this.wave);
  }

  update(h) {
    const D = this.D, { people, traffic, city, fire } = D.ctx;
    this.t += h;
    if (this.phase === 'warn') {
      if (this.t > this.warnT) {
        this.phase = 'wave'; this.wave.visible = true;
        D.water.colors('sea'); D.water.origin.copy(this.origin); D.water.dir.copy(this.dir); D.water.level = this.floodH;
        D.emit({ type: 'tsunamihit', text: 'The wave is here!' });
      }
      return;
    }
    if (this.phase === 'wave') {
      this.frontS += this.speed * h;
      D.water.frontS = this.frontS - 9;
      D.shake(0.12);
      const o = this.origin, d = this.dir, lo = this.frontS - 3, hi = this.frontS + 1.5;
      const inBand = (x, z) => { const s = (x - o.x) * d.x + (z - o.y) * d.y; return s > lo && s < hi; };
      const push = () => [d.x * (15 + Math.random() * 7), 3 + Math.random() * 4, d.y * (15 + Math.random() * 7)];
      for (let i = 0; i < people.active; i++) {
        const s = people.st[i];
        if (s === 8 || s === 10 || s === 17 || s === 19 || s === 20 || people.lvl[i] !== -1) continue;
        if (inBand(people.x[i], people.z[i])) { const v = push(); people.fling(i, v[0], v[1], v[2]); }
      }
      for (const car of traffic.cars) {
        if (car.gone || car.mode === 4 || car.mode === 5) continue;
        if (inBand(car.x, car.z)) { const v = push(); traffic.fling(car, v[0], v[1] + 1, v[2]); }
      }
      for (const pc of traffic.parkedList) {
        if (!pc.alive || !inBand(pc.x, pc.z)) continue;
        traffic.takeParked(pc);
        const m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
        D.debris.addObject(m, 'fly', { v: push() });
      }
      if (++this.stepN % 2 === 0) {
        const fx = o.x + d.x * this.frontS, fz = o.y + d.y * this.frontS, B = city.bounds;
        for (let t = -this.width / 2; t <= this.width / 2; t += 15) {
          const px = fx + this.tan.x * t, pz = fz + this.tan.y * t;
          if (px < B.x0 - 20 || px > B.x1 + 20 || pz < B.z0 - 20 || pz > B.z1 + 20) continue;
          for (const it of city.takeStreetNear(px, pz, 9)) { const v = push(); D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.6, it.s * 0.9, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v }); }
          city.buildingsNear(px, pz, 8, (k, dd, b) => {
            if (this.damaged.has(k)) return;
            this.damaged.add(k); // each building gets one roll as the wave hits it
            if (b.top - b.baseY < this.Hw * 0.75 && Math.random() < 0.45) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(d.y, d.x) });
            else { city.char(k, 0.84); if (fire.bFire[k] === 1) fire.extinguish(k); }
          });
          if (Math.random() < 0.12) fire.spray(px - d.x * 4, pz - d.y * 4, this.Hw * 0.75, 3, 4, 1.1);
        }
      }
      if (this.frontS > this.extent + 70) { this.phase = 'recede'; this.recedeT = 0; D.water.frontS = 1e6; }
      return;
    }
    // the sea drains back out of the streets
    this.recedeT += h;
    this.mat.uniforms.uFade.value = Math.max(0, 1 - this.recedeT / 3);
    if (this.recedeT > 3) this.wave.visible = false;
    D.water.level = this.floodH - (this.floodH + 0.5) * Math.min(1, this.recedeT / 50);
    if (this.recedeT > 50) { this.alive = false; D.water.level = -1; D.emit({ type: 'tsunamiend', text: 'The sea has drained out of the streets' }); }
  }

  sync(dt, realT) {
    if (!this.wave.visible) return;
    const { scene, sun } = this.D.ctx, u = this.mat.uniforms;
    this.wave.position.set(this.origin.x + this.dir.x * this.frontS, 0, this.origin.y + this.dir.y * this.frontS);
    u.uTime.value = realT; u.uFogColor.value.copy(scene.background); u.uFogDensity.value = scene.fog ? scene.fog.density : 0.0006;
    u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    u.uLight.value = this.D.lightK;
  }
  dispose() {
    this.D.ctx.scene.remove(this.wave); this.wave.geometry.dispose(); this.mat.dispose();
    if (!this.D.list.some(e => e !== this && (e.type === 'flood' || e.type === 'tsunami') && e.alive)) { this.D.water.level = -1; this.D.water.frontS = 1e6; }
  }
}
