// Holes in the ground and what makes them. Hole draws a pit as a flat disc
// whose shader casts the view ray down into an imaginary shaft (walls with
// rock strata, a floor of mud or glowing melt), so it has real depth from any
// angle. Meteor: a warning, a fireball across the sky, then an impact that
// flattens the blocks around it, flings cars and debris, sets the district on
// fire and leaves a smoking crater. Sinkhole: rumbling and cracks, then the
// street gives way and swallows people, cars and whole buildings.
import * as THREE from 'three';
import { NOISE } from './water.js';

const HOLE_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const HOLE_FS = /* glsl */`
uniform vec3 uC, uWall, uFloor, uRimCol, uFogColor; uniform float uR, uDepth, uRim, uGlow, uLight, uFogDensity, uTime;
varying vec3 vW;
${NOISE}
void main() {
  vec2 d = vW.xz - uC.xz; float r = length(d);
  if (r > uR * uRim) discard;
  vec3 col; float a = 1.0, dist = length(cameraPosition - vW);
  if (r > uR) { // the lip: torn ground and rubble thinning out
    float k = (r - uR) / (uR * (uRim - 1.0)), n = fbm(vW.xz * 0.3);
    a = 1.0 - smoothstep(0.25, 1.0, k + (n - 0.5) * 0.7);
    col = uRimCol * (0.55 + 0.7 * n) * uLight;
    col += vec3(2.4, 0.7, 0.12) * uGlow * 0.6 * smoothstep(0.62, 0.8, fbm(vW.xz * 0.5)) * (1.0 - k);
  } else {
    vec3 V = normalize(vW - cameraPosition);
    vec2 v = V.xz; float A = max(dot(v, v), 1e-5), B = dot(d, v), C = dot(d, d) - uR * uR;
    float tw = (-B + sqrt(max(0.0, B * B - A * C))) / A, tf = uDepth / max(-V.y, 1e-3);
    if (tw < tf) { // a wall
      vec3 p = vW + V * tw; float dep = uC.y - p.y, ang = atan(p.z - uC.z, p.x - uC.x);
      float rock = fbm(vec2(ang * uR * 0.3, dep * 0.7)), strata = rock * 0.7 + 0.3 * sin(dep * 2.3 + rock * 4.0);
      col = uWall * (0.5 + 0.7 * strata) * mix(1.0, 0.18, smoothstep(0.0, uDepth, dep)) * uLight;
      col += vec3(2.4, 0.7, 0.12) * uGlow * smoothstep(uDepth * 0.45, uDepth, dep) * (0.4 + strata);
    } else { // the floor
      vec3 p = vW + V * tf; float n = fbm(p.xz * 0.22 + uTime * 0.03);
      col = uFloor * (0.45 + 0.6 * n) * 0.3 * uLight;
      col += vec3(2.8, 0.9, 0.18) * uGlow * smoothstep(0.42, 0.72, n);
    }
  }
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.8);
  gl_FragColor = vec4(col, a);
}`;

// a pit; lives in D.leftovers until the world is reset
export class Hole {
  constructor(D, x, z, o = {}) {
    this.D = D; this.x = x; this.z = z; this.R = o.R ?? 10; this.glow = o.glow ?? 0; this.cool = o.cool ?? 0;
    const rim = o.rim ?? 1.35, geo = new THREE.CircleGeometry(rim, 72); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({ vertexShader: HOLE_VS, fragmentShader: HOLE_FS, transparent: true, depthWrite: false,
      uniforms: { uC: { value: new THREE.Vector3(x, 0.23, z) }, uR: { value: this.R }, uDepth: { value: o.depth ?? this.R * 0.7 }, uRim: { value: rim }, uGlow: { value: this.glow },
        uLight: { value: 1 }, uFogDensity: { value: 0.0006 }, uTime: { value: 0 }, uFogColor: { value: new THREE.Color() },
        uWall: { value: new THREE.Color(o.wall ?? '#6a5848') }, uFloor: { value: new THREE.Color(o.floor ?? '#3a3026') }, uRimCol: { value: new THREE.Color(o.rimCol ?? '#7a6650') } } });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.position.set(x, 0.23, z); this.mesh.scale.setScalar(Math.max(0.01, this.R)); this.mesh.renderOrder = 1;
    D.ctx.scene.add(this.mesh);
    D.leftovers.push(this);
  }
  setR(R) { this.R = R; this.mesh.scale.setScalar(Math.max(0.01, R)); this.mat.uniforms.uR.value = R; }
  update(h) {
    if (this.cool && this.glow > 0.12) this.glow = Math.max(0.12, this.glow - h * this.cool);
    if ((this.swT = (this.swT ?? 0) - h) <= 0 && this.R > 2) { this.swT = 0.4; swallow(this.D, this.x, this.z, this.R * 0.92, true); } // anything that wanders in later falls too
  }
  sync(dt, realT) {
    const u = this.mat.uniforms, sc = this.D.ctx.scene;
    u.uGlow.value = this.glow; u.uLight.value = this.D.lightK; u.uTime.value = realT;
    u.uFogColor.value.copy(sc.background); u.uFogDensity.value = sc.fog ? sc.fog.density : 0.0006;
  }
  dispose() { this.D.ctx.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// everything within R of (x, z) goes down the hole
function swallow(D, x, z, R, moversOnly = false) {
  const { people, traffic, city } = D.ctx;
  people.around(x, z, R, (j) => people.fallIn(j));
  for (let i = 0; i < people.active; i++) if ((people.st[i] === 19 || people.st[i] === 20) && Math.hypot(people.x[i] - x, people.z[i] - z) < R && people.y[i] < 3) people.fallIn(i);
  traffic.near(x, z, R + 3, (car) => { if (!car.gone && Math.hypot(car.x - x, car.z - z) < R) { if (car.mission && car.onLost && car.mode === 0) car.onLost(car); traffic.remove(car); D.emit({ type: 'carfall', x: car.x, z: car.z }); } });
  if (moversOnly) return;
  for (const pc of traffic.parkedNear(x, z, R)) traffic.takeParked(pc);
  city.takeStreetNear(x, z, R);
}

export class Meteor {
  constructor(D, x, z, o = {}) {
    this.type = 'meteor'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true; this.phase = 'warn';
    this.R = o.size ?? 20; this.warnT = o.warn ?? 18; this.small = !!o.small;
    const a = Math.random() * Math.PI * 2; this.from = new THREE.Vector3(x + Math.cos(a) * 1500, 950, z + Math.sin(a) * 1500); this.to = new THREE.Vector3(x, 0, z);
    if (!this.small) D.emit({ type: 'warn', hazard: 'meteor', x, z, r: this.R * 3.5, exact: true, text: 'Incoming! An asteroid fragment will hit the ' + D.district(x, z) + ' district in ' + Math.round(this.warnT) + ' seconds. Clear the area' });
  }
  update(h) {
    const D = this.D, fire = D.ctx.fire;
    this.t += h;
    if (this.phase === 'warn') {
      if (this.t > this.warnT - 3) {
        this.phase = 'fall'; this.ft = 0;
        const m = new THREE.Mesh(new THREE.SphereGeometry(this.small ? 2.5 : 6, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.2), fog: false }));
        this.ball = m; D.ctx.scene.add(m);
      }
      return;
    }
    if (this.phase === 'fall') {
      this.ft += h; const k = Math.min(1, this.ft / 3), p = this.from.clone().lerp(this.to, k);
      this.ball.position.copy(p);
      if (Math.random() < 0.8) fire.burst(p.x, p.y, p.z, 5, this.small ? 3 : 7);
      if (Math.random() < 0.5) { const r = fire.smoke.alloc(3, p.x, p.y, p.z, 4, 4, this.small ? 1.5 : 3, fire.uniforms.uTime.value); fire.later(3, () => fire.smoke.end(r, fire.uniforms.uTime.value)); fire.later(14, () => fire.smoke.release(r)); }
      D.flash(k * k * (this.small ? 0.1 : 0.35));
      if (k >= 1) { D.ctx.scene.remove(this.ball); this.ball.geometry.dispose(); this.impact(); this.phase = 'after'; this.at = 0; }
      return;
    }
    this.at += h;
    if (this.ring) {
      const k = Math.min(1, this.at / 1.6); this.ring.scale.setScalar(0.1 + k * this.R * 7); this.ring.material.opacity = 0.55 * (1 - k);
      if (k >= 1) { D.ctx.scene.remove(this.ring); this.ring.geometry.dispose(); this.ring.material.dispose(); this.ring = null; }
    }
    if (this.at > 4) this.alive = false;
  }
  impact() {
    const D = this.D, { people, traffic, city, fire } = D.ctx, x = this.x, z = this.z, R = this.R;
    D.flash(this.small ? 0.3 : 1.5); D.shake(this.small ? 0.8 : 2.6);
    new Hole(D, x, z, { R: R * 0.9, depth: R * 0.6, rim: 1.6, glow: this.small ? 0.6 : 1.3, cool: 0.02, wall: '#4e3e32', floor: '#2c221a', rimCol: '#5c4838' });
    // the blast: buildings near the crater come down, further out they burn
    city.buildingsNear(x, z, R * 4.5, (k, d, b) => {
      if (d < R * 1.5) D.destroyBuilding(k, 'collapse', { dir: Math.atan2((b.z0 + b.z1) / 2 - z, (b.x0 + b.x1) / 2 - x), noRubble: d < R * 0.9 });
      else { city.char(k, d < R * 3 ? 0.6 : 0.82); if (Math.random() < (d < R * 3 ? 0.45 : 0.15)) fire.igniteBuilding(k); }
    });
    swallow(D, x, z, R * 0.9);
    people.around(x, z, R * 2.2, (j) => { const s = people.st[j]; if (s === 8 || s === 19 || s === 20) return; people.wz[j] = s === 6 ? 1 : 0; const dx = people.x[j] - x, dz = people.z[j] - z, d = Math.hypot(dx, dz) || 1; people.kill(j, dx / d * 12, dz / d * 12, 'impact'); });
    people.scare(x, z, R * 7, 0.9);
    // cars and parked cars hurled outwards, trees and lamps torn out
    traffic.near(x, z, R * 3, (car) => { const dx = car.x - x, dz = car.z - z, d = Math.hypot(dx, dz) || 1; if (d > R * 3 || car.gone) return; const p = 1 - d / (R * 3.2); traffic.fling(car, dx / d * 32 * p, 9 + 14 * p, dz / d * 32 * p); });
    for (const pc of traffic.parkedNear(x, z, R * 2.6)) {
      traffic.takeParked(pc);
      const dx = pc.x - x, dz = pc.z - z, d = Math.hypot(dx, dz) || 1, p = 1 - d / (R * 3);
      const m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
      D.debris.addObject(m, 'fly', { v: [dx / d * 28 * p, 8 + 12 * p, dz / d * 28 * p] });
    }
    for (const it of city.takeStreetNear(x, z, R * 3.2)) { const dx = it.x - x, dz = it.z - z, d = Math.hypot(dx, dz) || 1; D.debris.add(it.x, it.y, it.z, it.s * 0.9, it.s * 0.6, it.s * 0.9, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v: [dx / d * 22, 8 + Math.random() * 8, dz / d * 22] }); }
    // ejecta: rock and dirt thrown out of the crater
    for (let n = 0; n < (this.small ? 25 : 110); n++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * (this.small ? 15 : 34), s = 0.5 + Math.random() * (this.small ? 1 : 2.2);
      D.debris.add(x + Math.cos(a) * R * 0.5, 1 + Math.random() * 3, z + Math.sin(a) * R * 0.5, s, s * 0.7, s, Math.random() < 0.5 ? 0x4e3e32 : 0x6a5a48, 'fly', { v: [Math.cos(a) * sp, 8 + Math.random() * 20, Math.sin(a) * sp] });
    }
    // fireball, a dust column and a ring of dust racing outwards
    const t = fire.uniforms.uTime.value, fb = fire.flames.alloc(this.small ? 20 : 70, x, 2, z, R * 0.6, R * 0.6, this.small ? 4 : 9, t);
    fire.later(1.6, () => fire.flames.end(fb, fire.uniforms.uTime.value)); fire.later(8, () => fire.flames.release(fb));
    fire.dustCloud(x, z, R * 1.8, this.small ? 20 : 70);
    if (!this.small) { const sm = fire.smoke.alloc(60, x, 10, z, R, R, 6, t); fire.later(40, () => fire.smoke.end(sm, fire.uniforms.uTime.value)); fire.later(55, () => fire.smoke.release(sm)); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d8c4a0', transparent: true, opacity: 0.55, depthWrite: false }));
    ring.position.set(x, 1.2, z); ring.renderOrder = 4; D.ctx.scene.add(ring); this.ring = ring;
    people.block(x, z, R * 0.9);
    traffic.closeNear(x, z, R * 0.9 + 4);
    // a few smaller fragments come down nearby
    if (!this.small) for (let n = 0; n < 3; n++) { const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 120; D.later(0.4 + Math.random() * 1.8, () => D.start('meteor', x + Math.cos(a) * d, z + Math.sin(a) * d, { size: 5 + Math.random() * 3, warn: 3, small: true })); }
    D.emit(this.small ? { type: 'fragment', x, z } : { type: 'impact', x, z, text: 'Impact! The asteroid hit the ' + D.district(x, z) + ' district' });
  }
  sync() {}
  dispose() { if (this.ball) this.D.ctx.scene.remove(this.ball); if (this.ring) this.D.ctx.scene.remove(this.ring); }
}

export class Sinkhole {
  constructor(D, x, z, o = {}) {
    this.type = 'sinkhole'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true;
    this.Rmax = o.size ?? 11 + Math.random() * 13; this.rumble = 3.5; this.grow = 7; this.hole = null; this.cracked = false;
    D.emit({ type: 'warn', hazard: 'sinkhole', x, z, r: this.Rmax * 2, exact: true, text: 'Sinkhole! The ground is giving way in the ' + D.district(x, z) + ' district' });
  }
  update(h) {
    const D = this.D, { people, fire, city } = D.ctx;
    this.t += h;
    if (this.t < this.rumble) {
      D.shake(0.2);
      if (!this.cracked) { this.cracked = true; for (let n = 0; n < 9; n++) { const a = n / 9 * Math.PI * 2 + Math.random() * 0.4, L = this.Rmax * (0.8 + Math.random() * 0.6); D.decals.add('crack', this.x + Math.cos(a) * L * 0.6, this.z + Math.sin(a) * L * 0.6, L, 2.5, -a); } }
      if (Math.random() < h * 2) people.scare(this.x, this.z, this.Rmax * 2.5, 0.3);
      return;
    }
    const k = Math.min(1, (this.t - this.rumble) / this.grow), R = this.Rmax * (1 - Math.pow(1 - k, 2.2));
    if (!this.hole) this.hole = new Hole(D, this.x, this.z, { R: 0.5, depth: this.Rmax * 1.4, rim: 1.3, wall: '#6e5a46', floor: '#4a3c2a', rimCol: '#7a6650' });
    this.hole.setR(R);
    D.shake(0.3 * (1 - k) + 0.05);
    swallow(this.D, this.x, this.z, R);
    city.buildingsNear(this.x, this.z, R, (kb, d, b) => {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (Math.hypot(cx - this.x, cz - this.z) < R + 2) D.destroyBuilding(kb, 'collapse', { dir: Math.atan2(this.z - cz, this.x - cx), noRubble: true, noCrush: true });
    });
    if (Math.random() < h * 4) { const a = Math.random() * Math.PI * 2; fire.dustCloud(this.x + Math.cos(a) * R, this.z + Math.sin(a) * R, 4, 8); }
    // a broken water main sprays muddy water out of the pit for a while
    if (k > 0.3 && this.t < this.rumble + this.grow + 6 && Math.random() < 0.6) D.water.splash.emit(this.x, 0.5, this.z, 4, { up: [8, 16], spread: 4, life: 2, size: 1.8 });
    if (k >= 1 && this.t > this.rumble + this.grow + 6) {
      people.block(this.x, this.z, R + 0.3);
      D.ctx.traffic.closeNear(this.x, this.z, R + 3);
      this.alive = false;
      D.emit({ type: 'sinkholeend', text: 'The sinkhole has stopped growing' });
    }
  }
  sync() {}
  dispose() {}
}
