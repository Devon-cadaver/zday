// Weather: clear, rain, thunderstorm, fog, snow, heat wave, sandstorm.
// Precipitation is GPU-animated streaks and flakes in a box that follows the
// camera; the rest is light, fog, grade and gameplay modifiers layered on top
// of the day and night cycle.
import * as THREE from 'three';
import { FRONT, FRONT_N } from './water.js';

export const WEATHER = {
  clear: { name: 'Clear', sun: 1, hemi: 1, fog: 1, sky: '#d9bf95', skyK: 0, sepia: 1, exp: 1, rain: 0, snow: 0, sand: 0, cover: 0 },
  rain: { name: 'Rain', sun: 0.42, hemi: 0.86, fog: 1.5, sky: '#8c9096', skyK: 0.55, sepia: 0.45, exp: 0.96, rain: 1, snow: 0, sand: 0, cover: 0 },
  storm: { name: 'Thunderstorm', sun: 0.24, hemi: 0.72, fog: 1.7, sky: '#5f656e', skyK: 0.7, sepia: 0.3, exp: 0.92, rain: 1.7, snow: 0, sand: 0, cover: 0, bolts: true },
  fog: { name: 'Fog', sun: 0.55, hemi: 1.05, fog: 3.2, sky: '#d4cec4', skyK: 0.85, sepia: 0.55, exp: 1.02, rain: 0, snow: 0, sand: 0, cover: 0 },
  snow: { name: 'Snow', sun: 0.62, hemi: 1.1, fog: 1.9, sky: '#d6dae0', skyK: 0.7, sepia: 0.25, exp: 0.97, rain: 0, snow: 1, sand: 0, cover: 0.15 },
  heat: { name: 'Heat wave', sun: 1.25, hemi: 1.05, fog: 1.7, sky: '#e9b56f', skyK: 0.45, sepia: 1.5, exp: 1.07, rain: 0, snow: 0, sand: 0, cover: 0 },
  ash: { name: 'Ash fall', sun: 0.32, hemi: 0.8, fog: 2.4, sky: '#6a6460', skyK: 0.75, sepia: 0.5, exp: 0.9, rain: 0, snow: 0.9, sand: 0, cover: 0, ash: true },
  dust: { name: 'Dust storm', sun: 0.28, hemi: 0.72, fog: 5.5, sky: '#9a5a28', skyK: 0.92, sepia: 1.7, exp: 0.86, rain: 0, snow: 0, sand: 1.7, cover: 0 },
  sand: { name: 'Sandstorm', sun: 0.5, hemi: 0.95, fog: 2.8, sky: '#c78a48', skyK: 0.85, sepia: 1.4, exp: 0.96, rain: 0, snow: 0, sand: 1, cover: 0 },
};
const KEYS = ['sun', 'hemi', 'fog', 'skyK', 'sepia', 'exp', 'rain', 'snow', 'sand', 'cover'];

const PRECIP_VS = /* glsl */`
uniform vec3 uCenter, uSize; uniform float uTime, uSpeed, uLen, uMode, uFocus, uMask, uBack; uniform vec2 uWind, uOrigin, uDir, uTan;
attribute vec4 aSeed;
varying float vA;
${FRONT}
void main() {
  vec3 p = aSeed.xyz * uSize;
  float t = uTime * uSpeed * (0.8 + aSeed.x * 0.4);
  if (uMode < 0.5) { p.y -= t; p.xz += uWind * t * 0.12; }                       // rain
  else if (uMode < 1.5) { p.y -= t; p.x += sin(uTime * 0.8 + aSeed.y * 40.0) * uSize.x * 0.01; p.z += cos(uTime * 0.6 + aSeed.x * 30.0) * uSize.z * 0.01; } // snow
  else { p.xz += uWind * t; p.y += sin(uTime * 0.5 + aSeed.z * 20.0) * uSize.y * 0.02; } // sand
  p = mod(p - uCenter + uSize * 0.5, uSize) + uCenter - uSize * 0.5;
  if (uMode < 0.5) { p.y += aSeed.w * uLen; p.xz -= uWind * aSeed.w * uLen * 0.25; }
  else if (uMode > 1.5) { p.xz -= uWind * aSeed.w * uLen; }
  vec3 rel = (p - uCenter) / (uSize * 0.5);
  vA = 1.0 - smoothstep(0.65, 1.0, max(abs(rel.x), max(abs(rel.y), abs(rel.z))));
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vA *= 1.0 - smoothstep(0.1, 0.32, abs(-mv.z - uFocus) / uFocus); // only near the sharp band, the blur would hide the rest
  if (uMask > 0.5) { vec2 r = p.xz - uOrigin; vA *= smoothstep(0.0, 30.0, frontAt(dot(r, uTan)) - dot(r, uDir) - uBack); } // a cold front: only behind it
  gl_PointSize = uLen * 380.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PRECIP_FS = /* glsl */`
uniform vec3 uColor; uniform float uAlpha, uMode;
varying float vA;
void main() {
  float a = uAlpha * vA;
  if (uMode > 0.5 && uMode < 1.5) { float d = length(gl_PointCoord - 0.5); a *= smoothstep(0.5, 0.15, d); }
  gl_FragColor = vec4(uColor, a);
}`;

function precip(n, mode, color, pairs) {
  const g = new THREE.BufferGeometry();
  const count = pairs ? n * 2 : n;
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < n; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    for (let e = 0; e < (pairs ? 2 : 1); e++) { const o = (pairs ? i * 2 + e : i) * 4; seed[o] = x; seed[o + 1] = y; seed[o + 2] = z; seed[o + 3] = e; }
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PRECIP_VS, fragmentShader: PRECIP_FS, transparent: true, depthWrite: false,
    uniforms: { uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(1, 1, 1) }, uTime: { value: 0 }, uSpeed: { value: 1 }, uLen: { value: 1 }, uMode: { value: mode }, uFocus: { value: 400 }, uWind: { value: new THREE.Vector2(0.6, 0.25) }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 },
      uMask: { value: 0 }, uBack: { value: 25 }, uOrigin: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uTan: { value: new THREE.Vector2(0, 1) }, uFront: { value: new Float32Array(FRONT_N) }, uPile: { value: new Float32Array(FRONT_N) }, uHalfW: { value: 1 }, uSegW: { value: 1 } },
  });
  const obj = pairs ? new THREE.LineSegments(g, mat) : new THREE.Points(g, mat);
  obj.frustumCulled = false; obj.renderOrder = 6; obj.visible = false;
  return obj;
}

export class Weather {
  // snow (and sleet) only behind a sweeping cold front (fronts.js ColdWave), or everywhere again (null)
  snowBehind(sw) {
    for (const o of [this.snow, this.rain]) {
      const u = o.material.uniforms; u.uMask.value = sw ? 1 : 0; if (!sw) continue;
      u.uOrigin.value = sw.origin; u.uDir.value = sw.dir; u.uTan.value = sw.tan; u.uFront.value = sw.F; u.uPile.value = sw.P; u.uHalfW.value = sw.halfW; u.uSegW.value = sw.segW;
    }
  }
  constructor(ctx) {
    this.ctx = ctx; // { scene, sun, hemi, post, city, camera, controls, fire, traffic, people, disasters, low }
    const { scene, post, low } = ctx;
    this.base = { sepia: post.opts.sepia, exp: post.opts.exposure, fog: scene.fog ? scene.fog.density : 0.0006 };
    this.type = 'clear'; this.p = { ...WEATHER.clear }; this.target = WEATHER.clear;
    this.rain = precip(low ? 2600 : 5200, 0, '#c8d0dc', true);
    this.snow = precip(low ? 1600 : 3200, 1, '#ffffff', false);
    this.sand = precip(low ? 1600 : 3000, 2, '#e0b07a', true);
    for (const o of [this.rain, this.snow, this.sand]) scene.add(o);
    this.boltT = 5; this.heatT = 30; this.bolts = [];
    this._c = new THREE.Color(); this._sky = new THREE.Color(); this._v = new THREE.Vector3();
  }

  set(type, instant = false) {
    if (!WEATHER[type]) type = 'clear';
    this.type = type; this.target = WEATHER[type];
    if (instant) for (const k of KEYS) this.p[k] = this.target[k];
    this._sky.set(this.target.sky);
    const { fire, traffic, people } = this.ctx;
    fire.rainK = type === 'storm' ? 2.2 : type === 'rain' ? 1.4 : 0;
    fire.spreadK = type === 'heat' ? 3.5 : (type === 'rain' || type === 'storm') ? 0.15 : type === 'snow' ? 0.5 : 1;
    traffic.speedK = type === 'snow' ? 0.65 : type === 'dust' ? 0.6 : type === 'sand' || type === 'ash' ? 0.8 : type === 'fog' ? 0.85 : 1;
    traffic.gripK = type === 'snow' ? 0.45 : type === 'storm' ? 0.75 : type === 'sand' ? 0.7 : 1;
    people.speedK = type === 'snow' ? 0.8 : type === 'sand' ? 0.9 : 1;
  }

  // simulation: lightning, heat fires
  update(h) {
    const tg = this.target;
    if (tg.bolts) {
      this.boltT -= h;
      if (this.boltT <= 0) {
        this.boltT = 3 + Math.random() * 6;
        const c = this.ctx.controls.target, a = Math.random() * 6.28, d = 40 + Math.random() * 260;
        this.ctx.disasters.strike(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d);
      }
    }
    if (this.type === 'heat') {
      this.heatT -= h;
      if (this.heatT <= 0) { this.heatT = 25 + Math.random() * 30; const b = this.ctx.city.buildings; for (let n = 0; n < 6; n++) { const k = Math.floor(Math.random() * b.length); if (this.ctx.fire.igniteBuilding(k)) { this.ctx.disasters.emit({ type: 'heatfire', k, text: 'The heat set a building on fire' }); break; } } }
    }
  }

  // after the day/night cycle has set the lights each frame
  apply(dt) {
    const p = this.p, tg = this.target, k = Math.min(1, dt * 0.35);
    for (const key of KEYS) p[key] += (tg[key] - p[key]) * k;
    const { sun, hemi, post, scene, city } = this.ctx;
    sun.intensity *= p.sun; hemi.intensity *= p.hemi;
    // extra weather fog is set so the haze at the point you look at is the same at any zoom
    const dist = this.ctx.camera.position.distanceTo(this.ctx.controls.target);
    if (scene.fog) scene.fog.density = this.base.fog * (1 + (p.fog - 1) * Math.min(1.4, 430 / dist)) * Math.min(1, 1000 / dist); // zoomed far out the haze thins, so the whole world stays in view
    const night = post.opts.night || 0;
    this._c.copy(this._sky).multiplyScalar(1 - night * 0.82);
    scene.background.lerp(this._c, p.skyK);
    if (scene.fog) scene.fog.color.copy(scene.background);
    post.opts.sepia = this.base.sepia * p.sepia;
    post.opts.exposure = this.base.exp * p.exp;
    const cover = p.cover * (1 - night * 0.7);
    for (const m of [city.mats.walk, city.mats.grass, city.mats.roof, city.mats.tile, city.mats.ground]) { if (!m) continue; m.emissive.setRGB(cover, cover, cover * 1.05); }
  }

  sync(dt, realT) {
    const { camera, controls } = this.ctx, p = this.p;
    const dist = camera.position.distanceTo(controls.target);
    const c = this._v.copy(camera.position).sub(controls.target).multiplyScalar(0.15).add(controls.target);
    const set = (o, amount, alpha, speed, len, size) => {
      o.visible = amount > 0.02;
      if (!o.visible) return;
      const u = o.material.uniforms;
      u.uCenter.value.copy(c); u.uSize.value.set(dist * size[0], dist * size[1], dist * size[2]);
      u.uTime.value = realT; u.uFocus.value = dist; u.uSpeed.value = dist * speed; u.uLen.value = dist * len; u.uAlpha.value = alpha * Math.min(1, amount);
    };
    set(this.rain, p.rain, 0.15 * Math.min(1.4, p.rain), 0.085, 0.008, [0.6, 0.5, 0.6]);
    if (this.snow.visible || p.snow > 0.02) this.snow.material.uniforms.uColor.value.set(this.target.ash ? '#7a746e' : '#ffffff'); // grey ash falls like snow
    set(this.snow, p.snow, 0.85, 0.006, 0.009, [0.6, 0.5, 0.6]);
    set(this.sand, p.sand, 0.22, 0.1, 0.03, [0.6, 0.45, 0.6]);
  }
}
