// Solar flare / geomagnetic storm: aurora curtains ripple over the city, the
// power grid fails (windows and street lamps go dark, transformers blow in
// showers of sparks and start fires), cars' electronics die and they roll to
// a stop, and the radio blackout grounds helicopters and garbles 911 calls.
import * as THREE from 'three';
import { NOISE, Splash } from './water.js';

const AURORA_VS = /* glsl */`
uniform float uTime;
varying vec2 vUv;
${NOISE}
void main() {
  vUv = uv; vec3 p = position;
  p.z += sin(p.x * 0.004 + uTime * 0.15) * 60.0 + (fbm(vec2(p.x * 0.002, uTime * 0.05)) - 0.5) * 160.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const AURORA_FS = /* glsl */`
uniform float uTime, uK;
varying vec2 vUv;
${NOISE}
void main() {
  float rays = fbm(vec2(vUv.x * 70.0 + uTime * 0.35, uTime * 0.25)); rays = rays * rays * 2.2;
  float fy = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
  float fx = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
  vec3 col = mix(vec3(0.15, 1.7, 0.6), vec3(1.3, 0.3, 1.5), smoothstep(0.25, 0.85, vUv.y));
  float a = rays * fy * fx * uK * (0.7 + 0.3 * sin(uTime * 1.3 + vUv.x * 9.0));
  gl_FragColor = vec4(col * a, a);
}`;

// the aurora's light on the city: soft drifting bands of green and violet
const GLOW_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLOW_FS = /* glsl */`
uniform float uTime, uK;
varying vec3 vW;
${NOISE}
void main() {
  // ribbons that bend and drift: a sine across the city warped by noise
  float w = fbm(vec2(vW.x * 0.0025 + uTime * 0.02, vW.z * 0.0025)) * 9.0;
  float band = pow(0.5 + 0.5 * sin(vW.z * 0.018 + vW.x * 0.004 + w + uTime * 0.15), 5.0);
  vec3 col = mix(vec3(0.2, 1.0, 0.5), vec3(0.8, 0.3, 1.0), smoothstep(0.4, 0.7, fbm(vW.xz * 0.002 - uTime * 0.02)));
  gl_FragColor = vec4(col * band * uK, band * uK);
}`;

// the wave of the storm sweeping in: a wall of shimmering light
const WAVE_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WAVE_FS = /* glsl */`
uniform float uTime, uK;
varying vec2 vUv;
${NOISE}
void main() {
  float rays = fbm(vec2(vUv.x * 90.0, uTime * 1.5)) * 0.6 + fbm(vec2(vUv.x * 300.0 + uTime * 3.0, uTime)) * 0.4;
  rays = pow(rays, 2.0) * 2.5;
  float fy = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.25, 1.0, vUv.y));
  vec3 col = mix(vec3(0.3, 2.2, 2.6), vec3(2.0, 0.4, 2.6), smoothstep(0.1, 0.7, vUv.y + (rays - 0.5) * 0.3));
  float a = (rays * fy + smoothstep(0.08, 0.0, vUv.y) * 1.5) * uK;
  gl_FragColor = vec4(col * a, a);
}`;

export class SolarStorm {
  constructor(D, opts = {}) {
    this.type = 'solar'; this.D = D; this.t = 0; this.alive = true; this.life = opts.life ?? 90; this.k = 0;
    const B = D.ctx.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    this.curtains = [[-260, 0.25, 420], [60, -0.18, 470], [320, 0.4, 400]].map(([dz, yaw, y]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1700, 170, 140, 6), new THREE.ShaderMaterial({ vertexShader: AURORA_VS, fragmentShader: AURORA_FS, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uK: { value: 0 } } }));
      m.position.set(cx, y, cz + dz); m.rotation.y = yaw; m.frustumCulled = false; m.renderOrder = 8;
      D.ctx.scene.add(m); return m;
    });
    const gg = new THREE.PlaneGeometry(B.x1 - B.x0 + 400, B.z1 - B.z0 + 400, 64, 64); gg.rotateX(-Math.PI / 2); // vertices enough to bend with the world's curve
    this.glow = new THREE.Mesh(gg, new THREE.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uK: { value: 0 } } }));
    this.glow.position.set(cx, 26, cz); this.glow.renderOrder = 8; this.glow.frustumCulled = false; D.ctx.scene.add(this.glow);
    this.sparks = new Splash(D.ctx.scene, 1500); this.sparks.mat.blending = THREE.AdditiveBlending; this.sparks.mat.uniforms.uColor.value.setRGB(2.2, 2.6, 3.4);
    this.sparkT = 0.5; this.said = false; this.stalled = new Map(); this.rolled = new Set();
    // the wave: in from one side at 70 m/s; cars die and transformers blow as it passes, and just behind it
    // everything glows like a black-light poster for a second or so
    const side = Math.floor(Math.random() * 4), dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]], edges = [[cx, B.z1 + 60], [cx, B.z0 - 60], [B.x1 + 60, cz], [B.x0 - 60, cz]];
    this.dir = dirs[side]; this.origin = edges[side]; this.ws = 0; this.extent = (side < 2 ? B.z1 - B.z0 : B.x1 - B.x0) + 120;
    const W = (side < 2 ? B.x1 - B.x0 : B.z1 - B.z0) + 500;
    this.wave = new THREE.Mesh(new THREE.PlaneGeometry(W, 230, 1, 1), new THREE.ShaderMaterial({ vertexShader: WAVE_VS, fragmentShader: WAVE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uK: { value: 1 } } }));
    this.wave.rotation.y = Math.atan2(this.dir[0], this.dir[1]); this.wave.renderOrder = 8; this.wave.frustumCulled = false; D.ctx.scene.add(this.wave);
    this.blk = { amount: 0, origin: this.origin, dir: this.dir, front: 0, width: 120 }; D.ctx.post.opts.blacklight = this.blk;
    D.emit({ type: 'warn', hazard: 'solar', text: 'Solar flare! A geomagnetic storm is knocking out power and radio. Helicopters are grounded' });
  }
  update(h) {
    const D = this.D, { city, fire, controls } = D.ctx;
    this.t += h; this.sparks.update(h);
    this.k = Math.min(1, this.t / 6, Math.max(0, (this.life - this.t) / 10));
    const o0 = this.origin, d0 = this.dir, O = D.ctx.outskirts, plant = O && O.plant && O.plant.group.visible ? O.plant.reactor : null, plantAt = plant ? (plant.x - o0[0]) * d0[0] + (plant.z - o0[1]) * d0[1] : -1e9;
    if (this.ws < Math.max(this.extent + 200, plantAt + 30)) { // on past the town as far as the power plant
      this.ws += 70 * h;
      const o = this.origin, d = this.dir, at = (x, z) => (x - o[0]) * d[0] + (z - o[1]) * d[1];
      if (plant && !this.plantHit && plantAt < this.ws) { this.plantHit = true; D.plantSurge(); } // the surge reaches the power plant: its cooling fails (Sean: always)
      const T = D.ctx.traffic;
      for (const car of T.cars) { // as the wave rolls over them the electronics go: drivers lose control, engines die, the rest panic
        if (car.mission || car.gone || this.rolled.has(car) || at(car.x, car.z) > this.ws) continue;
        this.rolled.add(car); if (car.mode !== 0) continue;
        const r = Math.random();
        if (r < 0.4 && car.v > 3) T.crash(car, null, 8 + Math.random() * 8); // skidding out of control into whatever is near
        else if (r < 0.6) { this.stalled.set(car, car.cruise); car.cruise = 0; }
        else { car.panic = Math.max(car.panic || 0, 12); car.zx = car.x - d[0] * 20; car.zz = car.z - d[1] * 20; }
      }
      for (const l of city.lamps) {
        const s = at(l.x, l.z); if (!(s < this.ws && s > this.ws - 70 * h) || Math.random() > 0.18) continue;
        const x = l.x + l.arm[0] * 1.3, z = l.z + l.arm[1] * 1.3;
        this.sparks.emit(x, 6.5, z, 18, { up: [2, 7], spread: 6, life: 0.9, size: 0.6 });
        if (Math.random() < 0.12) this.spark(x, z); // the surge sets something alight
      }
      if (!this.waveSaid && this.ws > 60) { this.waveSaid = true; D.flash(0.25); }
    }
    // transformers blowing near where you are looking
    if ((this.sparkT -= h) <= 0 && this.k > 0.3) {
      this.sparkT = 0.25 + Math.random() * 0.5;
      const c = controls.target, near = city.lamps.filter(l => Math.abs(l.x - c.x) < 260 && Math.abs(l.z - c.z) < 260), l = near.length ? near[Math.floor(Math.random() * near.length)] : city.lamps[Math.floor(Math.random() * city.lamps.length)];
      if (l) {
        const x = l.x + l.arm[0] * 1.3, z = l.z + l.arm[1] * 1.3;
        this.sparks.emit(x, 6.5, z, 26, { up: [2, 8], spread: 7, life: 1.1, size: 0.7 });
        if (Math.random() < 0.3) D.flash(0.05);
        if (Math.random() < 0.16) this.spark(x, z);
      }
    }
    if (this.t > this.life) {
      this.alive = false;
      for (const [car, cruise] of this.stalled) car.cruise = cruise;
      D.emit({ type: 'solarend', text: 'The geomagnetic storm has passed. Power and radio are coming back' });
    }
  }
  // sparks from the surge: the nearest building catches, or a parked car (two dozen fires at most from one flare)
  spark(x, z) {
    const D = this.D, { city, fire, traffic } = D.ctx;
    if ((this.fires = this.fires || 0) >= 24) return;
    if (Math.random() < 0.3) { const pc = traffic.parkedNear(x, z, 9).find(p => !p.burnt); if (pc) { traffic.burnParked(pc); fire.carFire(pc.x, pc.z); this.fires++; return; } }
    let best = 1e9, bk = -1; city.buildingsNear(x, z, 16, (k, d) => { if (d < best && !city.dead[k]) { best = d; bk = k; } });
    if (bk >= 0 && fire.igniteBuilding(bk)) { this.fires++; if (!this.said) { this.said = true; D.emit({ type: 'transformer', text: 'Transformers are exploding and starting fires' }); } }
  }
  // after the day/night cycle has set the lights: the grid is down
  afterLight() {
    const { city, game, hemi, scene, post, controls } = this.D.ctx, off = Math.random() < 0.04 ? 0.5 : 0;
    // the grid goes down where the wave has passed (judged at the point you are looking at)
    const tg = controls.target, passed = Math.min(1, Math.max(0, (this.ws - ((tg.x - this.origin[0]) * this.dir[0] + (tg.z - this.origin[1]) * this.dir[1])) / 40)), k = this.k * passed;
    for (const m of city.mats.fac) m.emissiveIntensity *= 1 - k + k * off;
    city.mats.shop.emissiveIntensity *= 1 - k + k * off;
    const dl = game && game.daylight; if (dl) { dl.lampMat.opacity *= 1 - k; }
    const night = post.opts.night || 0;
    hemi.color.lerp(this._g || (this._g = new THREE.Color(0.45, 1, 0.65)), 0.25 * k * (0.3 + 0.7 * night));
    scene.background.lerp(this._s || (this._s = new THREE.Color(0.06, 0.2, 0.14)), 0.35 * k * night);
    if (scene.fog) scene.fog.color.copy(scene.background);
  }
  sync(dt, realT) {
    const night = this.D.ctx.post.opts.night || 0;
    for (const m of this.curtains) { m.material.uniforms.uTime.value = realT; m.material.uniforms.uK.value = this.k * (0.1 + 0.25 * night); }
    this.glow.material.uniforms.uTime.value = realT; this.glow.material.uniforms.uK.value = this.k * (0.06 + 0.34 * night);
    this.sparks.sync(1, this.D.ctx.fire.uniforms.uScale.value);
    const B = this.D.ctx.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, d = this.dir, o = this.origin;
    const tx = Math.abs(d[0]) > 0.5 ? 0 : 1; // the wall spans the city sideways to its direction
    this.wave.position.set(tx ? cx : o[0] + d[0] * this.ws, 115, tx ? o[1] + d[1] * this.ws : cz);
    this.wave.material.uniforms.uTime.value = realT; this.wave.material.uniforms.uK.value = this.ws < this.extent ? 1 : Math.max(0, 1 - (this.ws - this.extent) / 150);
    this.wave.visible = this.ws < this.extent + 150;
    this.blk.front = this.ws; this.blk.amount = this.ws < this.extent + 120 ? 1 : 0;
  }
  dispose() {
    for (const m of [...this.curtains, this.glow, this.wave]) { this.D.ctx.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    if (this.D.ctx.post.opts.blacklight === this.blk) this.D.ctx.post.opts.blacklight = null;
    this.D.ctx.scene.remove(this.sparks.points); this.sparks.points.geometry.dispose(); this.sparks.mat.dispose();
    if (this.alive) for (const [car, cruise] of this.stalled) car.cruise = cruise;
  }
}
