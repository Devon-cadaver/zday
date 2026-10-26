// Volcanic eruption: tremors and steam, then a fissure tears open in the
// street. Lava fountains out of the vent, molten bombs rain down setting roofs
// alight, an ash column turns the sky grey, and a lava flow spreads through
// the streets: a small fluid grid that runs down open roads, banks up against
// buildings until they burn and fall, and slowly crusts over as it cools.
import * as THREE from 'three';
import { NOISE, Splash } from './water.js';
import { Hole } from './impact.js';

const N0 = 80, CELL0 = 3.5;
const LAVA_VS = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv; varying vec3 vW;
void main() { vec4 m = texture2D(uMap, uv); vec3 p = position; p.y += m.r * 2.55 * 0.6; vUv = uv; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LAVA_FS = /* glsl */`
uniform sampler2D uMap; uniform float uTime, uLight, uFogDensity; uniform vec3 uFogColor;
varying vec2 vUv; varying vec3 vW;
${NOISE}
void main() {
  vec4 m = texture2D(uMap, vUv); float h = m.r * 2.55, heat = m.g;
  if (h < 0.05) discard;
  float n = fbm(vW.xz * 0.22 + vec2(uTime * 0.02, 0.0)), n2 = fbm(vW.xz * 0.8 - uTime * 0.04);
  float crack = smoothstep(0.07, 0.0, abs(n - 0.5)) + smoothstep(0.05, 0.0, abs(n2 - 0.52)) * 0.6;
  vec3 crust = vec3(0.11, 0.09, 0.08) * (0.6 + 0.8 * n2) * uLight;
  vec3 glow = mix(vec3(1.5, 0.22, 0.03), vec3(4.2, 1.7, 0.35), n2);
  // plates of dark crust riding on the glowing flow, more of them as it cools
  float crustK = smoothstep(0.42, 0.6, n2 * 0.7 + n * 0.3 + (1.0 - heat) * 0.9);
  vec3 col = mix(glow * 0.62, crust, crustK) + glow * crack * heat * 1.2 * crustK;
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.7);
  gl_FragColor = vec4(col, smoothstep(0.05, 0.2, h));
}`;

// the lava itself; stays in D.leftovers, cooling, until the world is reset
export class LavaField {
  constructor(D, x, z, o = {}) {
    const N = this.N = o.n ?? N0, CELL = this.CELL = o.cell ?? CELL0; // a bigger field can cover the whole city
    this.D = D; this.x0 = x - N * CELL / 2; this.z0 = z - N * CELL / 2;
    this.H = new Float32Array(N * N); this.T = new Float32Array(N * N); this.F = new Float32Array(N * N); this.HT = new Float32Array(N * N);
    this.covered = new Uint8Array(N * N); this.bcell = new Int32Array(N * N).fill(-1); this.melt = new Map(); this.newCells = []; this.roadCells = [];
    const { city } = D.ctx;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const cx = this.x0 + (i + 0.5) * CELL, cz = this.z0 + (j + 0.5) * CELL; city.buildingsNear(cx, cz, 0.1, (k, d) => { if (d === 0) this.bcell[j * N + i] = k; }); }
    this.data = new Uint8Array(N * N * 4);
    this.tex = new THREE.DataTexture(this.data, N, N, THREE.RGBAFormat); this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(N * CELL, N * CELL, N - 1, N - 1); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({ vertexShader: LAVA_VS, fragmentShader: LAVA_FS, transparent: true, depthWrite: false,
      uniforms: { uMap: { value: this.tex }, uTime: { value: 0 }, uLight: { value: 1 }, uFogDensity: { value: 0.0006 }, uFogColor: { value: new THREE.Color() } } });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.position.set(x, 0.24, z); this.mesh.renderOrder = 2; this.mesh.frustumCulled = false;
    D.ctx.scene.add(this.mesh);
    this.texT = 0; this.fxT = 0; this.closeT = 0;
    D.leftovers.push(this);
  }
  cellAt(x, z) { const N = this.N, i = Math.floor((x - this.x0) / this.CELL), j = Math.floor((z - this.z0) / this.CELL); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; }
  pour(x, z, vol) { // cubic metres of fresh lava at (x, z)
    const c = this.cellAt(x, z); if (c < 0) return;
    const add = vol / (this.CELL * this.CELL); this.T[c] = (this.T[c] * this.H[c] + add) / (this.H[c] + add); this.H[c] += add;
  }
  update(h) {
    const { H, T, F, HT, bcell, N } = this, city = this.D.ctx.city;
    F.fill(0); HT.fill(0);
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const c = j * N + i, hc = H[c]; if (hc < 0.02) continue;
      const visc = 0.1 + (1 - T[c]) * 0.7; // cooling lava stiffens and stops
      for (let q = 0; q < 4; q++) {
        const nb = q === 0 ? c - 1 : q === 1 ? c + 1 : q === 2 ? c - N : c + N;
        const wall = bcell[nb] >= 0 && !city.dead[bcell[nb]] ? 1.4 : 0; // a standing building holds the flow back
        const dh = hc - (H[nb] + wall) - visc; if (dh <= 0) continue;
        const f = Math.min(dh * 0.18, hc * 0.2) * Math.min(1, h * 8);
        F[c] -= f; F[nb] += f; HT[nb] += f * T[c];
        if (wall && T[c] > 0.3) { const k = bcell[nb]; this.melt.set(k, (this.melt.get(k) || 0) + h); }
      }
    }
    for (let c = 0; c < N * N; c++) {
      if (F[c] > 0) T[c] = (T[c] * H[c] + HT[c]) / Math.max(1e-4, H[c] + F[c]);
      H[c] = Math.max(0, H[c] + F[c]);
      if (H[c] > 0.02) T[c] = Math.min(1, Math.max(0, T[c] - h * (H[c] < 0.3 ? 0.006 : 0.003)));
      if (!this.covered[c] && H[c] > 0.12) { this.covered[c] = 1; this.newCells.push(c); }
    }
    // buildings with lava against them catch fire, and in time give way
    for (const [k, t] of this.melt) {
      if (city.dead[k]) { this.melt.delete(k); continue; }
      if (t > 1 && !this.D.ctx.fire.bFire[k]) this.D.ctx.fire.igniteBuilding(k);
      if (t > 14) { this.D.destroyBuilding(k, 'collapse'); this.melt.delete(k); }
    }
    if ((this.fxT -= h) <= 0) { this.fxT = 0.5; this.effects(); }
  }
  effects() {
    const D = this.D, { people, traffic, city, fire } = D.ctx, { H, T, N, CELL } = this;
    const hot = (x, z) => { const c = this.cellAt(x, z); return c >= 0 && H[c] > 0.15 && T[c] > 0.15; };
    for (let i = 0; i < people.active; i++) {
      const s = people.st[i];
      if (s === 8 || s === 10 || s === 17 || s === 19 || s === 20 || people.lvl[i] !== -1) continue;
      if (hot(people.x[i], people.z[i])) { people.wz[i] = s === 6 ? 1 : 0; if (s === 23) people.st[i] = people.wz[i] ? 6 : 1; people.kill(i, 0, 0, 'burn'); }
    }
    for (const car of traffic.cars) if (!car.gone && !car.lava && hot(car.x, car.z)) { car.lava = true; traffic.burn(car); car.cruise = 0; }
    for (const pc of traffic.parkedList) if (pc.alive && !pc.burnt && hot(pc.x, pc.z)) { traffic.burnParked(pc); fire.carFire(pc.x, pc.z); }
    // newly covered ground: trees burn, people can no longer walk there, and every few seconds roads close
    for (const c of this.newCells) {
      const cx = this.x0 + (c % N + 0.5) * CELL, cz = this.z0 + (Math.floor(c / N) + 0.5) * CELL;
      for (const it of city.takeStreetNear(cx, cz, CELL * 0.8)) fire.burst(it.x, it.y, it.z, 8, 1.6);
      people.block(cx, cz, CELL * 0.75);
      city.buildingsNear(cx, cz, CELL, (k) => { if (!fire.bFire[k] && Math.random() < 0.3) fire.igniteBuilding(k); }); // lava against a wall sets the building alight
      this.roadCells.push(cx, cz);
    }
    this.newCells.length = 0;
    if (this.roadCells.length && (this.closeT -= 0.5) <= 0) {
      this.closeT = 3;
      for (let k = 0; k < this.roadCells.length; k += 2) traffic.closeNear(this.roadCells[k], this.roadCells[k + 1], CELL);
      this.roadCells.length = 0;
    }
  }
  sync(dt, realT) {
    if ((this.texT -= dt) <= 0) {
      this.texT = 0.1;
      const d = this.data, N = this.N;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const c = j * N + i, o = ((N - 1 - j) * N + i) * 4; // texture rows run the other way to z
        d[o] = Math.min(255, this.H[c] / 2.55 * 255); d[o + 1] = this.T[c] * 255; d[o + 2] = 0; d[o + 3] = 255;
      }
      this.tex.needsUpdate = true;
    }
    const u = this.mat.uniforms, sc = this.D.ctx.scene;
    u.uTime.value = realT; u.uLight.value = this.D.lightK; u.uFogColor.value.copy(sc.background); u.uFogDensity.value = sc.fog ? sc.fog.density : 0.0006;
  }
  dispose() { this.D.ctx.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); this.tex.dispose(); }
}

export class Volcano {
  constructor(D, x, z, o = {}) {
    this.type = 'volcano'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true; this.phase = 'rumble';
    this.warnT = o.warn ?? 14; this.eruptT = o.erupt ?? 60 * Math.sqrt(o.size ?? 1); this.waneT = 25; this.bombT = 1; this.ashT = 0; this.bombs = [];
    this.k = o.size ?? 1; // 0.5 a vent ... 3 a supervolcano
    this.prevWeather = D.weather.type;
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'volcano', x, z, r: 130, exact: true, text: 'Magma is rising under the ' + D.district(x, z) + ' district! An eruption is coming. Get everyone out' });
    this.bombMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.3) }); this.bombGeo = new THREE.SphereGeometry(1.1, 8, 6);
  }
  update(h) {
    const D = this.D, { people, fire, city } = D.ctx;
    this.t += h;
    if (this.splash) this.splash.update(h);
    if (this.phase === 'rumble') {
      D.shake(0.15 + 0.25 * (this.t / this.warnT));
      if (Math.random() < h * 3) { const a = Math.random() * 6.28, d = Math.random() * 40; fire.spray(this.x + Math.cos(a) * d, this.z + Math.sin(a) * d, 0.5, 4, 1.5, 1.2); }
      if (Math.random() < h * 1.5) { const a = Math.random() * 6.28, L = 8 + Math.random() * 14; D.decals.add('crack', this.x + Math.cos(a) * L * 0.7, this.z + Math.sin(a) * L * 0.7, L, 2.2, -a); }
      if (this.t > this.warnT) this.erupt();
      return;
    }
    const te = this.t - this.warnT, waning = te > this.eruptT, k = waning ? Math.max(0, 1 - (te - this.eruptT) / this.waneT) : 1;
    D.shake(0.1 * k + 0.03);
    // the fountain and the flow
    this.lava.pour(this.x, this.z, 115 * this.k * this.k * k * h);
    if (k > 0) this.splash.emit(this.x, 1, this.z, Math.round((10 * k + 1) * Math.min(2.5, this.k)), { up: [(12 * k + 4) * Math.sqrt(this.k), (30 * k + 6) * Math.sqrt(this.k)], spread: 9 * this.k, life: 2.4, size: 2.4 * Math.sqrt(this.k) });
    if (Math.random() < 0.5 * k) fire.burst(this.x + (Math.random() - 0.5) * 6, 1, this.z + (Math.random() - 0.5) * 6, 8, 3);
    // the ash column
    if ((this.ashT -= h) <= 0 && k > 0.2) {
      this.ashT = 1.6; const t = fire.uniforms.uTime.value, r = fire.smoke.alloc(22, this.x, 8, this.z, 10, 10, 6 * k + 2, t);
      fire.later(9, () => fire.smoke.end(r, fire.uniforms.uTime.value)); fire.later(22, () => fire.smoke.release(r));
    }
    // lava bombs
    if ((this.bombT -= h) <= 0 && k > 0.15) { this.bombT = this.aim ? 0.16 : (0.5 + Math.random() * 0.6) / (k * this.k); this.launch(); } // aimed (Be The Disaster): a barrage at the finger
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]; b.vy -= 9.8 * h; b.m.position.x += b.vx * h; b.m.position.y += b.vy * h; b.m.position.z += b.vz * h; b.m.rotation.x += h * 4;
      if ((b.trail -= h) <= 0) { b.trail = 0.12; fire.burst(b.m.position.x, b.m.position.y, b.m.position.z, 2, 1.4); }
      if (b.m.position.y <= 0.5) { this.land(b.m.position.x, b.m.position.z); D.ctx.scene.remove(b.m); this.bombs.splice(i, 1); }
    }
    if (waning && k <= 0 && !this.bombs.length) {
      this.alive = false; this.vent.cool = 0.03;
      D.weather.set(this.prevWeather === 'ash' ? 'clear' : this.prevWeather);
      D.emit({ type: 'volcanoend', text: 'The eruption is dying down. The lava is cooling' });
    }
  }
  poi() { return { x: this.x, z: this.z, danger: this.phase === 'rumble' ? 25 : 75, range: 480 }; }
  erupt() {
    const D = this.D, { people, city, fire } = D.ctx;
    this.phase = 'erupt';
    const K = this.k;
    this.vent = new Hole(D, this.x, this.z, { R: 7 * K, depth: 5 * K, rim: 1.7, glow: 2, wall: '#3a2e28', floor: '#2a1c14', rimCol: '#3e3028' });
    this.lava = new LavaField(D, this.x, this.z, K > 1 ? { n: Math.round(80 * Math.min(1.9, K)), cell: 3.5 * Math.max(1, K / 1.9) } : {}); // a bigger field for a bigger mountain
    this.splash = new Splash(D.ctx.scene, 1600); this.splash.mat.blending = THREE.AdditiveBlending; this.splash.mat.uniforms.uColor.value.setRGB(3, 0.9, 0.18);
    this.splash.points.renderOrder = 7;
    city.buildingsNear(this.x, this.z, 12 * K, (k, d, b) => D.destroyBuilding(k, 'collapse', { dir: Math.atan2((b.z0 + b.z1) / 2 - this.z, (b.x0 + b.x1) / 2 - this.x) }));
    people.around(this.x, this.z, 8 * K, (j) => people.fallIn(j));
    people.scare(this.x, this.z, 160, 0.95);
    D.flash(0.5); D.shake(1.6);
    D.weather.set('ash');
    D.emit({ type: 'eruption', x: this.x, z: this.z, text: 'Eruption! Lava is pouring into the streets' });
  }
  launch() {
    let a = Math.random() * Math.PI * 2, d = (35 + Math.pow(Math.random(), 0.7) * 200) * Math.sqrt(this.k);
    if (this.aim) { const tx = this.aim[0] + (Math.random() - 0.5) * 18, tz = this.aim[1] + (Math.random() - 0.5) * 18; a = Math.atan2(tz - this.z, tx - this.x); d = Math.max(12, Math.hypot(tx - this.x, tz - this.z)); }
    const T = 2.4 + d / 110;
    const m = new THREE.Mesh(this.bombGeo, this.bombMat); m.position.set(this.x, 4, this.z); this.D.ctx.scene.add(m);
    this.bombs.push({ m, vx: Math.cos(a) * d / T, vz: Math.sin(a) * d / T, vy: (-4 + 4.9 * T * T) / T, trail: 0 });
  }
  land(x, z) {
    const D = this.D, { people, traffic, city, fire } = D.ctx;
    fire.burst(x, 1, z, 16, 2.6); D.decals.add('scour', x, z, 5, 5);
    let hit = -1; city.buildingsNear(x, z, 0.5, (k, d) => { if (d === 0) hit = k; });
    if (hit >= 0) { if (Math.random() < 0.7) fire.igniteBuilding(hit); }
    else {
      people.around(x, z, 3.5, (j) => { const s = people.st[j]; if (s === 8 || s === 19 || s === 20) return; people.wz[j] = s === 6 ? 1 : 0; people.kill(j, 0, 0, 'burn'); });
      traffic.near(x, z, 4, (car) => { if (Math.hypot(car.x - x, car.z - z) < 4) traffic.burn(car); });
      for (const pc of traffic.parkedNear(x, z, 3.5)) { traffic.burnParked(pc); fire.carFire(pc.x, pc.z); }
    }
    const c = D.ctx.controls.target; if (Math.hypot(c.x - x, c.z - z) < 120) D.shake(0.15);
  }
  sync(dt, realT) { if (this.splash) this.splash.sync(1, this.D.ctx.fire.uniforms.uScale.value); }
  dispose() {
    for (const b of this.bombs) this.D.ctx.scene.remove(b.m); this.bombs.length = 0;
    if (this.splash) { this.D.ctx.scene.remove(this.splash.points); this.splash.points.geometry.dispose(); this.splash.mat.dispose(); }
    this.bombGeo.dispose(); this.bombMat.dispose();
  }
}
