// Storm fronts that sweep the city from one edge, built on the tsunami's
// ragged SweepFront. Haboob: a towering wall of dust rolling in like a wave of
// dirt (Sean's reference: the Fury Road storm) - its top curls forward over the
// face, twisted vortex columns hang down it, dust balls tumble along its foot,
// lightning flickers inside and dust devils follow behind. It sandblasts the
// streets, lifts people and cars, topples some low buildings and leaves a
// sandstorm behind it. Cold wave (the arctic blast): the same rolling wall in
// white and ice blue, powder boiling along its foot, snow falling only behind it
// and frost creeping over the ground there; anyone caught outdoors freezes solid (zombies included,
// until the cold breaks).
import * as THREE from 'three';
import { NOISE, FRONT, SweepFront, Splash } from './water.js';
import { sfx } from './audio.js';

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
// ---------- the dust wall: one sheet bent to the storm's cross-section all along the front - a toe on the ground, a face
// leaning back, a top rolling forward over it like a breaking wave, then the thick body behind - pushed in and out by slow
// churning noise into great billows that climb the face. Twisted ropes of dust hang down it; lightning lights it inside
// (forward of the front, up) as fractions of the height: a rolling nose at the foot, the face, the curl over the top, the body behind
const PROF = [[0, 0], [0.02, 0.035], [0.012, 0.08], [-0.04, 0.17], [-0.07, 0.32], [-0.06, 0.5], [-0.01, 0.66], [0.08, 0.78], [0.17, 0.87], [0.2, 0.95], [0.12, 1.02], [-0.04, 1.04], [-0.3, 0.97], [-0.8, 0.9]];
const WALL_VS = /* glsl */`
uniform float uTime, uH; uniform vec2 uOrigin, uDir, uTan;
attribute vec3 aN; // the cross-section's outward normal (forward, up) and how far along it this row is
varying vec3 vW, vN; varying float vU, vY, vTc, vRope;
${NOISE}
${FRONT}
// how far the surface is pushed out here: tall billows climbing the face, smaller ones riding on them, and twisted
// ropes of dust hanging down it every hundred metres or so (not every one)
float rope(float tc, float y) {
  float cx = tc / 110.0, ch = hash(vec2(floor(cx), 3.7)), wob = fract(cx) - 0.5 + sin(y / uH * 9.0 + ch * 6.28 + uTime * 0.4) * 0.08;
  return smoothstep(0.2, 0.0, abs(wob)) * step(0.35, ch) * (0.55 + 0.45 * sin(wob * 40.0 + y * 0.12 - uTime * 2.4 + ch * 9.0));
}
float push(float tc, float y, float u) {
  vec2 q = vec2(tc * 0.013, y * 0.0075 - uTime * 0.035);
  float bill = (fbm(q) - 0.5) * 80.0 + (fbm(q * 3.1 + 7.3) - 0.5) * 26.0;
  float face = smoothstep(0.02, 0.2, u) * (1.0 - smoothstep(0.5, 0.65, u)) * smoothstep(0.08, 0.26, y / uH);
  float toe = (fbm(vec2(tc * 0.045, y * 0.05 - uTime * 0.2)) - 0.35) * 34.0 * smoothstep(0.0, 0.02, u) * (1.0 - smoothstep(0.08, 0.2, u)); // dust balls rolling along the foot
  return bill * smoothstep(0.0, 0.12, u) + rope(tc, y) * 24.0 * face + toe;
}
void main() {
  float tc = position.x, u = aN.z, hk = 0.85 + 0.3 * fbm(vec2(tc * 0.004, uTime * 0.01)); // taller and lower stretches
  float y = position.y * uH * hk, s = position.z * uH;
  float b = push(tc, y, u), bx = push(tc + 4.0, y, u), by = push(tc, y + 4.0, u);
  float sOff = frontAt(tc) + s + aN.x * b, yy = max(0.0, y + aN.y * b);
  vec3 w = vec3(uOrigin.x + uTan.x * tc + uDir.x * sOff, yy, uOrigin.y + uTan.y * tc + uDir.y * sOff);
  vec3 T = vec3(uTan.x, 0.0, uTan.y), N0 = normalize(vec3(uDir.x * aN.x, aN.y, uDir.y * aN.x)), A = normalize(cross(T, N0));
  vN = normalize(N0 - T * (bx - b) / 4.0 - A * (by - b) / 4.0); // tilted by the slope of the billows, so they catch the light
  vW = w; vU = u; vY = yy / uH; vTc = tc; vRope = rope(tc, y) * smoothstep(0.02, 0.2, u) * (1.0 - smoothstep(0.5, 0.65, u));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const WALL_FS = /* glsl */`
uniform float uTime, uH, uLight, uFade, uFogDensity, uFlash; uniform vec3 uLit, uShade, uDark, uPale, uSunW, uFogColor, uFlashP; uniform vec2 uTan;
varying vec3 vW, vN; varying float vU, vY, vTc, vRope;
${NOISE}
void main() {
  float t = uTime;
  vec2 p = vec2(vTc * 0.035, vY * uH * 0.02 - t * 0.06);
  float n1 = fbm(p), n2 = fbm(p * 3.3 + vec2(t * 0.02, -t * 0.1));
  vec3 N = normalize(vN + vec3(uTan.x, 0.0, uTan.y) * (n2 - 0.5) * 0.8 + vec3(0.0, (n1 - 0.5) * 0.6, 0.0)), V = normalize(cameraPosition - vW);
  float lit = max(0.0, dot(N, uSunW)) * 0.75 + (0.5 + 0.5 * N.y) * 0.45 + max(0.0, dot(N, V)) * 0.12; // sun, the sky above, a little from the viewer
  vec3 col = mix(uShade, uLit, smoothstep(0.15, 1.05, lit)) * (0.5 + 0.5 * smoothstep(0.25, 0.65, n2)); // dark folds between the cauliflower heads
  col *= 1.0 + vRope * 0.25;
  col = mix(col, uDark, smoothstep(0.62, 1.0, vY) * 0.5 + smoothstep(0.7, 1.0, vU) * 0.35); // the top in its own shadow
  col = mix(col, uPale, (1.0 - smoothstep(0.0, 0.12, vY)) * 0.35); // thinner dust low down
  col *= uLight;
  col += vec3(0.95, 0.9, 1.0) * uFlash * exp(-length(vW - uFlashP) / 70.0) * 1.3; // lightning inside it
  col = mix(col, uFogColor, (1.0 - exp(-pow(length(cameraPosition - vW) * uFogDensity, 2.0))) * 0.55);
  float a = uFade * smoothstep(0.0, 0.05, vU + (n1 - 0.5) * 0.06) * (1.0 - smoothstep(0.88, 1.0, vU)); // ragged at the toe, gone at the far back
  if (a < 0.05) discard;
  gl_FragColor = vec4(col, a);
}`;
export class DustWall {
  constructor(D, sw, o = {}) {
    this.D = D; this.sw = sw; this.H = o.H ?? 280;
    const B = D.ctx.city.bounds, span = (Math.abs(sw.tan.x) > 0.5 ? B.x1 - B.x0 : B.z1 - B.z0) / 2 + 320;
    const mid = Math.abs(sw.tan.x) > 0.5 ? ((B.x0 + B.x1) / 2 - sw.origin.x) * sw.tan.x : ((B.z0 + B.z1) / 2 - sw.origin.y) * sw.tan.y;
    const curve = new THREE.SplineCurve(PROF.map(([s, y]) => new THREE.Vector2(s, y))), R = 34, C = D.ctx.low ? 160 : 240;
    const pos = new Float32Array((R + 1) * (C + 1) * 3), nrm = new Float32Array((R + 1) * (C + 1) * 3), idx = [];
    for (let r = 0; r <= R; r++) {
      const u = r / R, pt = curve.getPointAt(u), tg = curve.getTangentAt(u), ns = tg.y, ny = -tg.x, nl = Math.hypot(ns, ny) || 1; // outward: forward and up
      for (let c = 0; c <= C; c++) { const k = r * (C + 1) + c; pos.set([mid - span + (c / C) * span * 2, pt.y, pt.x], k * 3); nrm.set([ns / nl, ny / nl, u], k * 3); }
    }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const a = r * (C + 1) + c, b = a + C + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aN', new THREE.BufferAttribute(nrm, 3)); geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ vertexShader: WALL_VS, fragmentShader: WALL_FS, transparent: true, depthWrite: true, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uH: { value: this.H }, uOrigin: { value: sw.origin }, uDir: { value: sw.dir }, uTan: { value: sw.tan }, uFront: { value: sw.F }, uPile: { value: sw.P }, uHalfW: { value: sw.halfW }, uSegW: { value: sw.segW },
        uLit: { value: new THREE.Color(o.lit ?? '#f2b466') }, uShade: { value: new THREE.Color(o.shade ?? '#5e3218') }, uDark: { value: new THREE.Color(o.dark ?? '#2e1a10') }, uPale: { value: new THREE.Color(o.pale ?? '#e0b88c') },
        uSunW: { value: new THREE.Vector3(0, 1, 0) }, uFogColor: { value: new THREE.Color() }, uLight: { value: 1 }, uFade: { value: 1 }, uFogDensity: { value: 0.0006 }, uFlash: { value: 0 }, uFlashP: { value: new THREE.Vector3() } } });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    D.ctx.scene.add(this.mesh);
  }
  sync(realT, fade = 1) {
    const D = this.D, u = this.mat.uniforms, sc = D.ctx.scene, sun = D.ctx.sun;
    u.uTime.value = realT; u.uLight.value = D.lightK; u.uFade.value = fade; u.uFogColor.value.copy(sc.background); u.uFogDensity.value = sc.fog ? sc.fog.density : 0.0006;
    u.uSunW.value.copy(sun.position).sub(sun.target.position).normalize();
  }
  dispose() { this.D.ctx.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ---------- dust devils: little twisters following behind the wall, snaking columns of spinning dust that throw up
// whatever is loose in the street and scatter anyone near them
const DEVIL_VS = /* glsl */`
uniform float uTime, uSeed, uLean; varying vec2 vUv;
void main() {
  vUv = uv; vec3 p = position; float y = p.y;
  p.x += sin(y * 2.6 + uTime * 1.3 + uSeed * 6.0) * uLean * y; p.z += cos(y * 2.1 + uTime * 1.1 + uSeed * 3.0) * uLean * y; // it snakes as it climbs
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const DEVIL_FS = /* glsl */`
uniform float uTime, uSeed, uLight, uFade; uniform vec3 uLit, uShade; varying vec2 vUv;
${NOISE}
void main() {
  float band = sin(vUv.x * 18.85 + vUv.y * 9.0 - uTime * 7.0 + uSeed * 6.0) * 0.5 + 0.5;
  float n = fbm(vec2(vUv.x * 8.0 + uTime * 0.8, vUv.y * 5.0 - uTime * 1.6) + uSeed * 9.0);
  float a = (0.3 + 0.55 * band * n + 0.2 * n) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y)) * uFade;
  gl_FragColor = vec4(mix(uShade, uLit, 0.35 + 0.55 * n * band) * uLight, a);
}`;
export class DustDevils {
  constructor(D, sw, n) {
    this.D = D; this.sw = sw; this.list = []; this.t = 0;
    const geo = this.geo = new THREE.CylinderGeometry(1, 0.22, 1, 20, 12, true).translate(0, 0.5, 0);
    const B = D.ctx.city.bounds, span = (Math.abs(sw.tan.x) > 0.5 ? B.x1 - B.x0 : B.z1 - B.z0) / 2;
    const mid = Math.abs(sw.tan.x) > 0.5 ? ((B.x0 + B.x1) / 2 - sw.origin.x) * sw.tan.x : ((B.z0 + B.z1) / 2 - sw.origin.y) * sw.tan.y;
    for (let i = 0; i < n; i++) {
      const seed = Math.random(), mat = new THREE.ShaderMaterial({ vertexShader: DEVIL_VS, fragmentShader: DEVIL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uLean: { value: 0.08 + Math.random() * 0.1 }, uLight: { value: 1 }, uFade: { value: 1 }, uLit: { value: new THREE.Color('#e2a866') }, uShade: { value: new THREE.Color('#7a4824') } } });
      const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 6; D.ctx.scene.add(m);
      const h = 50 + Math.random() * 90;
      this.list.push({ m, t0: mid + (Math.random() * 2 - 1) * span, back: 30 + Math.random() * 200, h, r: h * (0.16 + Math.random() * 0.08), ph: Math.random() * 6.28, x: 0, z: 0, kickT: 0 });
    }
  }
  update(h, dust) {
    const D = this.D, sw = this.sw, { people, city } = D.ctx; this.t += h;
    for (const v of this.list) {
      const t = v.t0 + Math.sin(this.t * 0.11 + v.ph) * 60, s = sw.frontAt(t) - v.back - Math.sin(this.t * 0.07 + v.ph * 2) * 25; // wandering along behind the front
      v.x = sw.origin.x + sw.tan.x * t + sw.dir.x * s; v.z = sw.origin.y + sw.tan.y * t + sw.dir.y * s;
      if (!sw.inCity(v.x, v.z, 40) || (v.kickT -= h) > 0) continue;
      v.kickT = 0.3;
      dust.emit(v.x, 0.5, v.z, 4, { up: [4, 12], spread: 7, life: 1.8, size: 4 });
      for (const it of city.takeStreetNear(v.x, v.z, 3)) D.debris.add(it.x, it.y, it.z, it.s * 0.8, it.s * 0.5, it.s * 0.8, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v: [(Math.random() - 0.5) * 8, 12 + Math.random() * 8, (Math.random() - 0.5) * 8] });
      people.around(v.x, v.z, 6, (j) => { if (!people.hittable(j)) return; if (Math.random() < 0.04) people.fling(j, (Math.random() - 0.5) * 6, 6 + Math.random() * 3, (Math.random() - 0.5) * 6); else if (people.isCivilian(j)) people.panic(j, v.x, v.z, -1); }); // most scatter; the odd one is lifted off their feet
    }
  }
  sync(realT, fade = 1) {
    for (const v of this.list) {
      v.m.position.set(v.x, 0, v.z); v.m.scale.set(v.r, v.h, v.r); v.m.rotation.y = -realT * 3;
      const u = v.m.material.uniforms; u.uTime.value = realT; u.uLight.value = this.D.lightK; u.uFade.value = fade * (this.sw.inCity(v.x, v.z, 120) ? 1 : 0);
    }
  }
  dispose() { for (const v of this.list) { this.D.ctx.scene.remove(v.m); v.m.material.dispose(); } this.geo.dispose(); }
}

// ---------- lightning inside the wall: a jagged bolt from high in it down to the ground ahead, or across inside it, now
// and then somewhere along the stretch in view; the wall lights up round it
export class DustLightning {
  constructor(D, sw, wall) {
    this.D = D; this.sw = sw; this.wall = wall; this.next = 2; this.bolts = [];
    this.geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).translate(0, 0.5, 0);
    this.core = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 7), fog: false });
    this.halo = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.85, 1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  strike() {
    const D = this.D, sw = this.sw, c = D.ctx.controls.target, H = this.wall.H, dx = c.x - sw.origin.x, dz = c.z - sw.origin.y;
    const t = dx * sw.tan.x + dz * sw.tan.y + (Math.random() - 0.5) * 520, f = sw.frontAt(t), at = (tt, s, y) => new THREE.Vector3(sw.origin.x + sw.tan.x * tt + sw.dir.x * s, y, sw.origin.y + sw.tan.y * tt + sw.dir.y * s);
    // a bolt from under the curl down to the street ahead of the wall, or (four times in ten) a flash deep inside it with no bolt to see
    const ground = Math.random() < 0.6, top = ground ? at(t, f + 22 + Math.random() * 18, H * (0.62 + Math.random() * 0.1)) : at(t, f - 40 - Math.random() * 40, H * (0.4 + Math.random() * 0.4));
    if (!ground) { this.bolts.push({ g: null, life: 0.28, mid: top }); return; }
    const end = at(t + (Math.random() - 0.5) * 80, f + 50 + Math.random() * 70, 0);
    const g = new THREE.Group(), path = (a, b, n, jit) => { const pts = [a]; for (let k = 1; k < n; k++) { const p = a.clone().lerp(b, k / n); p.x += (Math.random() - 0.5) * jit; p.y += (Math.random() - 0.5) * jit * 0.5; p.z += (Math.random() - 0.5) * jit; pts.push(p); } pts.push(b); return pts; };
    const seg = (p, q, r) => { const d = this._b.subVectors(q, p), L = d.length(); for (const [mat, rr] of [[this.core, r], [this.halo, r * 4]]) { const m = new THREE.Mesh(this.geo, mat); m.position.copy(p); m.quaternion.setFromUnitVectors(this._up, d.clone().normalize()); m.scale.set(rr, L, rr); m.frustumCulled = false; m.renderOrder = 8; g.add(m); } };
    const main = path(top, end, 10, 26); for (let k = 0; k < main.length - 1; k++) seg(main[k], main[k + 1], 2.2);
    const fork = main[3 + Math.floor(Math.random() * 3)], fe = fork.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, -40 - Math.random() * 60, (Math.random() - 0.5) * 120)); fe.y = Math.max(0, fe.y);
    const br = path(fork, fe, 5, 18); for (let k = 0; k < br.length - 1; k++) seg(br[k], br[k + 1], 1.3);
    D.ctx.scene.add(g); this.bolts.push({ g, life: 0.32, mid: main[4].clone() });
    sfx('thunder', end.x, 40, end.z, { delay: 0.15 });
    if (sw.inCity(end.x, end.z, 0)) D.ctx.fire.burst(end.x, 1, end.z, 14, 2.2);
    D.flash(0.05);
  }
  update(h, active) {
    if (active && (this.next -= h) <= 0) { this.next = 1.4 + Math.random() * 3.8; this.strike(); }
    let flash = 0, at = null;
    for (let n = this.bolts.length - 1; n >= 0; n--) {
      const b = this.bolts[n]; b.life -= h;
      if (b.life <= 0) { if (b.g) this.D.ctx.scene.remove(b.g); this.bolts.splice(n, 1); continue; }
      const on = b.life > 0.2 || Math.sin(b.life * 90) > -0.2; if (b.g) b.g.visible = on; // it flickers out
      const k = on ? Math.min(1, b.life / 0.2) : 0.2; if (k > flash) { flash = k; at = b.mid; }
    }
    const u = this.wall.mat.uniforms; u.uFlash.value = flash; if (at) u.uFlashP.value.copy(at);
  }
  dispose() { for (const b of this.bolts) if (b.g) this.D.ctx.scene.remove(b.g); this.bolts.length = 0; this.geo.dispose(); this.core.dispose(); this.halo.dispose(); }
}

export class BillowWall {
  constructor(D, sw, o = {}) {
    this.D = D; this.sw = sw; this.H = o.H ?? 260; this.small = !!o.small;
    const B = D.ctx.city.bounds, n = o.n ?? (D.ctx.low ? 380 : 720);
    // only build puffs where the camera can be (across the city plus a margin)
    const span = (Math.abs(sw.tan.x) > 0.5 ? B.x1 - B.x0 : B.z1 - B.z0) / 2 + 220, mid = Math.abs(sw.tan.x) > 0.5 ? ((B.x0 + B.x1) / 2 - sw.origin.x) * sw.tan.x : ((B.z0 + B.z1) / 2 - sw.origin.y) * sw.tan.y;
    this.P = [];
    for (let k = 0; k < n; k++) {
      const r = Math.random(), layer = o.layers ? o.layers[Math.floor(r * o.layers.length)] : r < 0.42 ? 0 : r < 0.82 ? 1 : 2;
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
    p.size = L === 0 ? (this.small ? 7 + Math.random() * 12 : 14 + Math.random() * 20) : L === 1 ? 40 + Math.random() * 45 : 60 + Math.random() * 55;
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
    this.type = 'haboob'; this.D = D; this.t = 0; this.alive = true; this.phase = 'sweep'; this.fade = 1; this.light = !!opts.light; // light: no dark fog after the wall (one storm after another, to watch)
    const side = opts.side ?? (Math.random() < 0.75 ? 2 : Math.floor(Math.random() * 4)), sw = this.sw = new SweepFront(D, side, { speed: 12, slow: 0.8, fast: 1.05, pile: 1.15, start: -90, pull: opts.pull });
    this.wall = new DustWall(D, sw, { H: this.light ? 150 : 280 }); // light: low enough to see over from a playing camera
    this.walls = [];
    this.dust = new Splash(D.ctx.scene, 2000); this.dust.mat.uniforms.uColor.value.set('#b89670');
    this.devils = new DustDevils(D, sw, D.ctx.low ? 4 : 7); this.bolts = new DustLightning(D, sw, this.wall);
    const { people } = D.ctx;
    this.hit = new Uint8Array(people.x.length); this.carsHit = new Set(); this.damaged = new Set(); this.stepN = 0;
    this.prevWeather = D.weather.type; this.sandOn = false; this.dustOn = false;
    if (!opts.quiet) people.alarm(20);
    if (!opts.quiet) D.emit({ type: 'warn', hazard: 'haboob', x: sw.origin.x + sw.dir.x * 80, z: sw.origin.y + sw.dir.y * 80, r: 120, exact: true, text: 'Dust storm! A wall of sand is rolling in from the ' + sw.coast + '. Get people indoors' });
  }
  update(h) {
    const D = this.D, { people, traffic, city, fire } = D.ctx, sw = this.sw, d = sw.dir;
    this.t += h; this.dust.update(h); this.bolts.update(h, this.phase !== 'after'); this.devils.update(h, this.dust);
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
    for (let n = 0; n < 6; n++) { // dust boiling along the foot of the wall, blown out ahead of it
      const k = Math.floor(Math.random() * 96), [x, z] = sw.at(k, -4);
      if (sw.inCity(x, z, 150)) this.dust.emit(x, 1, z, 4, { up: [0.5, 3], dir: [d.x * 14, d.y * 14], spread: 6, life: 2.6, size: 8, along: [sw.tan.x, sw.tan.y, sw.segW * 0.5] });
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
    if (!this.light && !this.dustOn && sw.behind(D.ctx.controls.target.x, D.ctx.controls.target.z) > 20) { this.dustOn = true; D.weather.set('dust'); }
    if (!this.light && !this.sandOn && sw.lead() > sw.extent + 60) { this.sandOn = true; D.later(25, () => { if (this.alive) D.weather.set('sand'); }); }
    if (sw.lead() > sw.extent + 160) { this.phase = 'after'; this.endT = this.t + 50; }
  }
  poi(x, z) { return this.phase === 'after' ? null : (() => { const dx = x - this.sw.origin.x, dz = z - this.sw.origin.y, t = dx * this.sw.tan.x + dz * this.sw.tan.y, s = this.sw.frontAt(t); return { x: this.sw.origin.x + this.sw.tan.x * t + this.sw.dir.x * s, z: this.sw.origin.y + this.sw.tan.y * t + this.sw.dir.y * s, danger: 30, range: 480 }; })(); }
  sync(dt, realT) { this.wall.sync(realT, this.fade); this.devils.sync(realT, this.fade); this.dust.sync(this.D.lightK, this.D.ctx.fire.uniforms.uScale.value); }
  dispose() { this.wall.dispose(); this.devils.dispose(); this.bolts.dispose(); this.D.ctx.scene.remove(this.dust.points); this.dust.points.geometry.dispose(); this.dust.mat.dispose(); }
}

export class ColdWave {
  constructor(D, opts = {}) {
    this.type = 'coldwave'; this.D = D; this.t = 0; this.alive = true; this.phase = 'sweep'; this.fade = 1;
    const side = opts.side ?? (Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 4)), sw = this.sw = new SweepFront(D, side, { speed: 9, slow: 1, fast: 1, pile: 1, start: -70 });
    this.wall = new DustWall(D, sw, { H: 190, lit: '#ffffff', shade: '#b4c3d6', dark: '#8797ad', pale: '#f2f6fb' }); // the dust storm's wall, in white (Sean)
    this.powder = new Splash(D.ctx.scene, 1600); this.powder.mat.uniforms.uColor.value.set('#f2f6fc');
    D.weather.snowBehind(sw); // the snow falls behind the front, never ahead of it
    const B = D.ctx.city.bounds, geo = new THREE.PlaneGeometry(B.x1 - B.x0 + 300, B.z1 - B.z0 + 300, 64, 64); geo.rotateX(-Math.PI / 2); // vertices enough to bend with the world's curve
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
    this.t += h; this.powder.update(h);
    if (this.phase === 'after') {
      this.fade = Math.max(0, this.fade - h / 10);
      if (this.t > this.endT) {
        this.alive = false; people.thawAll(); traffic.thawAll(); traffic.gripK = 1;
        D.weather.set(this.prevWeather === 'snow' ? 'clear' : this.prevWeather); D.weather.snowBehind(null);
        D.emit({ type: 'coldend', text: 'The cold has broken. The frozen are thawing' });
      }
    } else {
      sw.advance(h);
      if (!this.iceOn && sw.lead() > sw.extent * 0.25) { this.iceOn = true; traffic.gripK = 0.35; }
      // the sky closes in and it snows once the front has passed where you are looking (or has crossed the town)
      const tg = D.ctx.controls.target; if (!this.snowOn && (sw.behind(tg.x, tg.z) > 30 || sw.lead() > sw.extent)) { this.snowOn = true; D.weather.set('snow'); traffic.gripK = 0.35; }
      for (let n = 0; n < 5; n++) { const k = Math.floor(Math.random() * 96), [x, z] = sw.at(k, -3); if (sw.inCity(x, z, 150)) this.powder.emit(x, 1, z, 4, { up: [0.5, 3], dir: [sw.dir.x * 10, sw.dir.y * 10], spread: 6, life: 2.4, size: 7, along: [sw.tan.x, sw.tan.y, sw.segW * 0.5] }); } // powder boiling along the foot
      if (sw.lead() > sw.extent + 80) { this.phase = 'after'; this.endT = this.t + 40; }
    }
    // the cold gets into everyone outdoors behind the front
    if (++this.stepN % 3 !== 0 || this.phase === 'after' && this.fade < 0.5) return;
    const hh = h * 3, behind = (x, z) => this.phase === 'after' || sw.behind(x, z) > 0;
    // fires go out under the frost, and nothing behind the front will catch again until it thaws
    if (this.stepN % 9 === 0) {
      const { fire, city } = D.ctx;
      fire.quench((x, z) => behind(x, z) ? 2 : 0);
      for (let k = 0; k < city.buildings.length; k++) { const b = city.buildings[k]; if (behind((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) fire.soak(k, 30); }
    }
    // cars ice up where they stand, a few seconds after the cold reaches them
    for (const car of traffic.cars) {
      if (car.frozen || car.mode !== 0 || car.mission || !behind(car.x, car.z)) continue;
      car.cold = (car.cold || 0) + hh;
      if (car.cold > 3 + (car.id % 7) * 0.5) traffic.freezeCar(car);
    }
    if (this.stepN % 9 === 0) for (const pc of traffic.parkedList) if (!pc.frost && behind(pc.x, pc.z)) traffic.frostParked(pc);
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
    this.wall.sync(realT, this.phase === 'after' ? Math.max(0, this.fade * 2 - 1) : 1); this.powder.sync(this.D.lightK, this.D.ctx.fire.uniforms.uScale.value);
    this.frostMat.uniforms.uLight.value = this.D.lightK; this.frostMat.uniforms.uFade.value = this.fade;
  }
  dispose() { this.wall.dispose(); this.D.ctx.scene.remove(this.powder.points); this.powder.points.geometry.dispose(); this.powder.mat.dispose(); this.D.weather.snowBehind(null); this.D.ctx.scene.remove(this.frost); this.frost.geometry.dispose(); this.frostMat.dispose(); if (this.alive) { this.D.ctx.people.thawAll(); this.D.ctx.traffic.thawAll(); } }
}
