// Holes in the ground and what makes them. Hole is a real pit: the ground is
// cut away over it (holes.js) and a lathed wall with rock strata and a floor of
// mud or glowing melt line it, so whatever falls in is seen going down. A lip of
// torn ground rings it. Meteor: a warning, a fireball across the sky, then an
// impact that flattens the blocks around it, flings cars and debris, sets the
// district on fire and leaves a smoking crater. Sinkhole: rumbling and cracks,
// then the street gives way and swallows people, cars and whole buildings.
import * as THREE from 'three';
import { NOISE } from './water.js';
import { Mushroom, nuclearDamage } from './nuke.js';
import { addHole, setHole, removeHole } from './holes.js';

const PIT_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FOG = /* glsl */`col = mix(col, uFogColor, (1.0 - exp(-pow(length(cameraPosition - vW) * uFogDensity, 2.0))) * 0.8);`;
// the torn lip around the opening
const LIP_FS = /* glsl */`
uniform vec3 uC, uRimCol, uFogColor; uniform float uR, uRim, uGlow, uLight, uFogDensity;
varying vec3 vW;
${NOISE}
void main() {
  float r = length(vW.xz - uC.xz);
  if (r > uR * uRim || r < uR) discard;
  float k = (r - uR) / (uR * (uRim - 1.0)), n = fbm(vW.xz * 0.3);
  float a = 1.0 - smoothstep(0.25, 1.0, k + (n - 0.5) * 0.7);
  vec3 col = uRimCol * (0.55 + 0.7 * n) * uLight;
  col += vec3(2.4, 0.7, 0.12) * uGlow * 0.6 * smoothstep(0.62, 0.8, fbm(vW.xz * 0.5)) * (1.0 - k);
  ${FOG}
  gl_FragColor = vec4(col, a);
}`;
// the shaft wall: rock strata, darker the deeper it goes, hot at the bottom of a fresh crater
const WALL_FS = /* glsl */`
uniform vec3 uC, uWall, uFogColor; uniform float uR, uDepth, uGlow, uLight, uFogDensity;
varying vec3 vW;
${NOISE}
void main() {
  float dep = clamp(uC.y - vW.y, 0.0, uDepth * 1.2), ang = atan(vW.z - uC.z, vW.x - uC.x);
  float rock = fbm(vec2(ang * max(uR, 4.0) * 0.3, dep * 0.7)), strata = rock * 0.7 + 0.3 * sin(dep * 2.3 + rock * 4.0);
  vec3 col = uWall * (0.5 + 0.7 * strata) * mix(1.0, 0.16, smoothstep(0.0, uDepth, dep)) * uLight;
  col += vec3(2.4, 0.7, 0.12) * uGlow * smoothstep(uDepth * 0.45, uDepth, dep) * (0.4 + strata);
  ${FOG}
  gl_FragColor = vec4(col, 1.0);
}`;
const FLOOR_FS = /* glsl */`
uniform vec3 uFloor, uFogColor; uniform float uGlow, uLight, uFogDensity, uTime;
varying vec3 vW;
${NOISE}
void main() {
  float n = fbm(vW.xz * 0.22 + uTime * 0.03);
  vec3 col = uFloor * (0.45 + 0.6 * n) * 0.3 * uLight;
  col += vec3(2.8, 0.9, 0.18) * uGlow * smoothstep(0.42, 0.72, n);
  ${FOG}
  gl_FragColor = vec4(col, 1.0);
}`;
// wall profiles, unit radius and depth from the rim down: a steep shaft or a crater bowl
const PROFILE = {
  shaft: [[1.02, 0], [0.99, -0.06], [0.95, -0.3], [0.92, -0.62], [0.9, -1]],
  bowl: [[1.02, 0], [0.93, -0.25], [0.78, -0.55], [0.55, -0.82], [0.32, -1]],
};
const TOP = 0.28; // the wall starts just above the curbs

// a pit; lives in D.leftovers until the world is reset
export class Hole {
  constructor(D, x, z, o = {}) {
    this.D = D; this.x = x; this.z = z; this.R = o.R ?? 10; this.glow = o.glow ?? 0; this.cool = o.cool ?? 0;
    this.depth = o.depth ?? this.R * 0.7; this.shape = o.shape ?? 'bowl'; this.fb = PROFILE[this.shape][4][0];
    this.bottomless = !!o.void; // a void: what falls in drops out of sight
    const rim = o.rim ?? 1.35, scene = D.ctx.scene;
    const common = { uC: { value: new THREE.Vector3(x, TOP, z) }, uR: { value: this.R }, uDepth: { value: this.depth }, uGlow: { value: this.glow }, uLight: { value: 1 }, uFogDensity: { value: 0.0006 }, uFogColor: { value: new THREE.Color() } };
    const lipGeo = new THREE.CircleGeometry(rim, 72); lipGeo.rotateX(-Math.PI / 2);
    this.lipMat = new THREE.ShaderMaterial({ vertexShader: PIT_VS, fragmentShader: LIP_FS, transparent: true, depthWrite: false,
      uniforms: { ...common, uRim: { value: rim }, uRimCol: { value: new THREE.Color(o.rimCol ?? '#7a6650') } } });
    this.lip = new THREE.Mesh(lipGeo, this.lipMat); this.lip.position.set(x, 0.23, z); this.lip.renderOrder = 1;
    this.wallMat = new THREE.ShaderMaterial({ vertexShader: PIT_VS, fragmentShader: WALL_FS, side: THREE.DoubleSide, uniforms: { ...common, uWall: { value: new THREE.Color(o.wall ?? '#6a5848') } } });
    this.wall = new THREE.Mesh(new THREE.LatheGeometry(PROFILE[this.shape].map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 56), this.wallMat);
    this.floorMat = new THREE.ShaderMaterial({ vertexShader: PIT_VS, fragmentShader: FLOOR_FS, uniforms: { ...common, uTime: { value: 0 }, uFloor: { value: new THREE.Color(o.floor ?? '#3a3026') } } });
    const fg = new THREE.CircleGeometry(1, 48); fg.rotateX(-Math.PI / 2);
    this.floor = new THREE.Mesh(fg, this.floorMat);
    for (const m of [this.wall, this.floor]) { m.position.set(x, TOP, z); m.receiveShadow = false; }
    scene.add(this.lip, this.wall, this.floor);
    this.cutY = 1.2; this.slot = addHole(this);
    this.setR(this.R);
    D.leftovers.push(this);
  }
  poi() { return this.age < 90 ? { x: this.x, z: this.z, danger: this.R + 6, range: this.R * 7 + 60 } : null; } // people gather to stare at it for a while
  setR(R) {
    this.R = R; const s = Math.max(0.01, R);
    this.lip.scale.setScalar(s); this.wall.scale.set(s, this.depth, s);
    this.floor.scale.set(s * this.fb, 1, s * this.fb); this.floor.position.y = TOP - this.depth + 0.02;
    this.lipMat.uniforms.uR.value = R; this.wallMat.uniforms.uR.value = R;
    setHole(this.slot, R);
    this.D.debris.wake(this.x, this.z, R); // what was lying on the ground drops in
  }
  // the height of the pit's surface at (x, z), or null outside it
  floorAt(x, z) {
    const r = Math.hypot(x - this.x, z - this.z) / Math.max(0.01, this.R);
    if (r >= 1) return null;
    if (this.bottomless && r < this.fb) return -400;
    return TOP - this.depth * Math.min(1, (1 - r) / (1 - this.fb));
  }
  update(h) {
    this.age = (this.age || 0) + h;
    if (this.cool && this.glow > 0.12) this.glow = Math.max(0.12, this.glow - h * this.cool);
    if ((this.swT = (this.swT ?? 0) - h) <= 0 && this.R > 2) { this.swT = 0.4; swallow(this.D, this.x, this.z, this.R * 0.97, true); } // anything that wanders in later falls too
  }
  sync(dt, realT) {
    const sc = this.D.ctx.scene;
    for (const m of [this.lipMat, this.wallMat, this.floorMat]) {
      const u = m.uniforms; u.uGlow.value = this.glow; u.uLight.value = this.D.lightK;
      u.uFogColor.value.copy(sc.background); u.uFogDensity.value = sc.fog ? sc.fog.density : 0.0006;
    }
    this.floorMat.uniforms.uTime.value = realT;
  }
  dispose() {
    removeHole(this.slot);
    this.D.ctx.scene.remove(this.lip, this.wall, this.floor);
    for (const m of [this.lip, this.wall, this.floor]) { m.geometry.dispose(); m.material.dispose(); }
  }
}

// everything within R of (x, z) goes over the edge and down the hole
export function swallow(D, x, z, R, moversOnly = false) {
  const { people, traffic, city } = D.ctx;
  people.around(x, z, R, (j) => {
    const s = people.st[j];
    if (s === 8) { const f = D.holeFloor(people.x[j], people.z[j]); if (f != null && people.y[j] > f + 0.5) { people.y[j] = f; people.dirty[j] = 3; } return; } // the dead drop to the bottom
    if (s === 10 || s === 17 || s === 19 || s === 20) return;
    const dx = x - people.x[j], dz = z - people.z[j], d = Math.hypot(dx, dz) || 1, v = 0.8 + Math.random() * 1.6;
    people.fling(j, dx / d * v, 0.4 + Math.random() * 0.8, dz / d * v); // they slip in and fall
  });
  traffic.near(x, z, R + 3, (car) => {
    if (car.gone || car.mode === 4 || car.mode === 5 || Math.hypot(car.x - x, car.z - z) >= R) return;
    const f = D.holeFloor(car.x, car.z); if (f != null && car.y < f + 1) return; // already down there
    if (car.mode === 0) { traffic.driveOff(car); D.emit({ type: 'carfall', x: car.x, z: car.z }); } // a moving car sails off the edge
    else traffic.fling(car, 0, 0.3, 0); // wrecks and parked units tip in
  });
  for (const pc of traffic.parkedNear(x, z, R)) {
    traffic.takeParked(pc);
    const m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
    D.debris.addObject(m, 'fly', { v: [(x - pc.x) * 0.05, 0.4, (z - pc.z) * 0.05] });
  }
  if (moversOnly) return;
  for (const it of city.takeStreetNear(x, z, R)) D.debris.add(it.x, it.y, it.z, it.s * 0.8, it.s * 0.6, it.s * 0.8, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v: [(x - it.x) * 0.05, 0.5, (z - it.z) * 0.05] });
}

export class Meteor {
  constructor(D, x, z, o = {}) {
    this.type = 'meteor'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true; this.phase = 'warn';
    this.R = o.size ?? 20; this.warnT = o.warn ?? 18; this.small = !!o.small;
    const a = Math.random() * Math.PI * 2; this.from = new THREE.Vector3(x + Math.cos(a) * 1500, 950, z + Math.sin(a) * 1500); this.to = new THREE.Vector3(x, 0, z);
    this.quiet = !!o.quiet; this.cloud = o.mushroom ?? true;
    if (!this.small && !this.quiet) D.emit({ type: 'warn', hazard: 'meteor', x, z, r: this.R * 3.5, exact: true, text: 'Incoming! An asteroid fragment will hit the ' + D.district(x, z) + ' district in ' + Math.round(this.warnT) + ' seconds. Clear the area' });
  }
  update(h) {
    const D = this.D, fire = D.ctx.fire;
    this.t += h;
    if (this.phase === 'warn') {
      if (this.t > this.warnT - 3) {
        this.phase = 'fall'; this.ft = 0;
        if (!this.small) { // in from the top edge of the view, so you watch it come all the way down
          const cam = D.ctx.camera, v = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.97, 0.5).unproject(cam).sub(cam.position).normalize();
          const hit = v.y < -0.05 ? cam.position.y / -v.y : 2000;
          this.from.copy(cam.position).addScaledVector(v, hit * 0.5);
        }
        const m = new THREE.Mesh(new THREE.SphereGeometry(this.small ? 2.5 : Math.max(6, this.R * 0.32), 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.2), fog: false })); // the bigger the crater, the bigger the rock
        this.ball = m; D.ctx.scene.add(m);
        if (!this.small) { // a dark, lumpy rock inside the glowing shell of its own fire
          const r = Math.max(6, this.R * 0.32), rg = new THREE.IcosahedronGeometry(r * 0.78, 2), pa = rg.attributes.position;
          for (let i = 0; i < pa.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(pa.getX(i) * 0.7 / r * 6 + pa.getY(i) * 1.3 / r * 6) * Math.cos(pa.getZ(i) / r * 5)); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); }
          rg.computeVertexNormals();
          m.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.2, 0.08), fog: false })));
          m.material.color.setRGB(1.5, 0.62, 0.2); m.material.transparent = true; m.material.opacity = 0.32; m.material.depthWrite = false; m.material.blending = THREE.AdditiveBlending; m.renderOrder = 7;
        }
      }
      return;
    }
    if (this.phase === 'fall') {
      const fallT = 3 + Math.max(0, this.R - 20) / 50; // a giant takes longer to come down, and you see it all the way
      this.ft += h; const k = Math.min(1, this.ft / fallT), p = this.from.clone().lerp(this.to, k);
      this.ball.position.copy(p);
      const back = this.small ? 0 : Math.max(6, this.R * 0.32) * 1.3, dv = this.to.clone().sub(this.from).normalize(); // the fire streams off behind it
      if (Math.random() < 0.8) fire.burst(p.x - dv.x * back, p.y - dv.y * back, p.z - dv.z * back, 5 + Math.round(this.R / 15), this.small ? 3 : Math.max(7, this.R * 0.3));
      if (this.R > 40) D.shake(k * k * 0.8);
      if (Math.random() < 0.5) { const r = fire.smoke.alloc(3, p.x, p.y, p.z, 4, 4, this.small ? 1.5 : 3, fire.uniforms.uTime.value); fire.later(3, () => fire.smoke.end(r, fire.uniforms.uTime.value)); fire.later(14, () => fire.smoke.release(r)); }
      D.flash(k * k * (this.small ? 0.1 : 0.35));
      if (k >= 1) { D.ctx.scene.remove(this.ball); this.ball.traverse(o => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } }); this.impact(); this.phase = 'after'; this.at = 0; }
      return;
    }
    this.at += h;
    if (this.ring) {
      const k = Math.min(1, this.at / 1.6); this.ring.scale.setScalar(0.1 + k * this.R * 7); this.ring.material.opacity = 0.55 * (1 - k);
      if (k >= 1) { D.ctx.scene.remove(this.ring); this.ring.geometry.dispose(); this.ring.material.dispose(); this.ring = null; }
    }
    if (this.at > 4) this.alive = false;
  }
  poi() { return this.phase === 'fall' && this.ball ? { x: this.ball.position.x, z: this.ball.position.z, danger: 0, range: 3000 } : null; }
  impact() {
    const D = this.D, { people, traffic, city, fire } = D.ctx, x = this.x, z = this.z, R = this.R;
    if (R >= 40) { // a city killer and up: a crater blasted out of the ground and a blast like two nukes going off at once
      const cr = Math.min(D.maxHoleR, R * 0.9);
      new Hole(D, x, z, { R: cr, depth: Math.min(90, R * 0.6), rim: 1.4, glow: 1.6, cool: 0.012, wall: '#4e3e32', floor: '#2c221a', rimCol: '#5c4838' });
      city.buildingsNear(x, z, cr, (k, d, b) => { if (Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z) < cr) D.destroyBuilding(k, 'collapse', { vanish: true }); }); // vaporised
      swallow(D, x, z, cr);
      nuclearDamage(D, x, z, R * 3.2, { bigFlash: true });
      D.later(0.35, () => { D.flash(2); D.shake(3.5); }); // the second shock
      for (let n = 0; n < 160; n++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50, s = 1 + Math.random() * 3.5; D.debris.add(x + Math.cos(a) * cr * 0.6, 2 + Math.random() * 6, z + Math.sin(a) * cr * 0.6, s, s * 0.7, s, Math.random() < 0.5 ? 0x4e3e32 : 0x6a5a48, 'fly', { v: [Math.cos(a) * sp, 15 + Math.random() * 35, Math.sin(a) * sp] }); }
      D.emit(this.quiet ? { type: 'fragment', x, z } : { type: 'impact', x, z, text: (R >= 112 ? 'Planet killer!' : R >= 80 ? 'Extinction event!' : 'City killer!') + ' The asteroid hit the ' + D.district(x, z) + ' district' });
      return;
    }
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
    if (!this.small && this.cloud) new Mushroom(D, x, z, R * 2.6, { life: 100, lit: '#cdb79a', shade: '#4e4036' }); // it goes up like a nuke
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d8c4a0', transparent: true, opacity: 0.55, depthWrite: false }));
    ring.position.set(x, 1.2, z); ring.renderOrder = 4; D.ctx.scene.add(ring); this.ring = ring;
    people.block(x, z, R * 0.9);
    traffic.closeNear(x, z, R * 0.9 + 4);
    // a few smaller fragments come down nearby
    if (!this.small && !this.quiet) for (let n = 0; n < 3; n++) { const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 120; D.later(0.4 + Math.random() * 1.8, () => D.start('meteor', x + Math.cos(a) * d, z + Math.sin(a) * d, { size: 5 + Math.random() * 3, warn: 3, small: true })); }
    D.emit(this.small || this.quiet ? { type: 'fragment', x, z } : { type: 'impact', x, z, text: 'Impact! The asteroid hit the ' + D.district(x, z) + ' district' });
  }
  sync() {}
  dispose() { if (this.ball) this.D.ctx.scene.remove(this.ball); if (this.ring) this.D.ctx.scene.remove(this.ring); }
}

export class Sinkhole {
  constructor(D, x, z, o = {}) {
    this.type = 'sinkhole'; this.D = D; this.x = x; this.z = z; this.t = 0; this.alive = true;
    this.Rmax = o.size ?? 11 + Math.random() * 13; this.rumble = 3.5; this.grow = 7 * Math.sqrt(Math.max(1, this.Rmax / 17)); this.hole = null; this.cracked = false; // a bigger one takes longer to give way
    this.hold = !!o.grow; this.holding = this.hold; this.R = 0; // held: it widens for as long as the finger is down
    if (this.hold) { this.Rmax = D.maxHoleR; this.rumble = 0.8; }
    if (!this.hold || !o.quiet) D.emit({ type: 'warn', hazard: 'sinkhole', x, z, r: this.Rmax * 2, exact: true, text: 'Sinkhole! The ground is giving way in the ' + D.district(x, z) + ' district' });
  }
  get size() { return this.R; }
  release() { this.holding = false; }
  poi() { return { x: this.x, z: this.z, danger: (this.hold ? this.R + 15 : this.Rmax) * 1.5, range: 160 + this.R * 2 }; }
  update(h) {
    const D = this.D, { people, fire, city } = D.ctx;
    this.t += h;
    if (this.t < this.rumble) {
      D.shake(0.2);
      if (!this.cracked) { this.cracked = true; for (let n = 0; n < 9; n++) { const a = n / 9 * Math.PI * 2 + Math.random() * 0.4, L = (this.hold ? 22 : this.Rmax) * (0.8 + Math.random() * 0.6); D.decals.add('crack', this.x + Math.cos(a) * L * 0.6, this.z + Math.sin(a) * L * 0.6, L, 2.5, -a); } }
      if (Math.random() < h * 2) people.scare(this.x, this.z, this.Rmax * 2.5, 0.3);
      return;
    }
    let k, R;
    if (this.hold) { // widens faster the bigger it gets, until let go or ten blocks across
      if (this.holding && this.R < this.Rmax) this.R = Math.min(this.Rmax, Math.max(1.5, this.R) + h * (3 + this.R * 0.09));
      R = this.R; k = this.holding && this.R < this.Rmax ? 0.5 : 1;
      if (k >= 1) this.doneT = (this.doneT || 0) + h;
    } else { k = Math.min(1, (this.t - this.rumble) / this.grow); R = this.R = this.Rmax * (1 - Math.pow(1 - k, 2.2)); }
    if (!this.hole) this.hole = new Hole(D, this.x, this.z, { R: 0.5, depth: this.hold ? 90 : Math.min(90, Math.max(20, this.Rmax * 1.4)), rim: 1.3, shape: 'shaft', wall: '#6e5a46', floor: '#4a3c2a', rimCol: '#7a6650' });
    this.hole.setR(R);
    D.shake(0.3 * (1 - k) + 0.05);
    swallow(this.D, this.x, this.z, R);
    city.buildingsNear(this.x, this.z, R, (kb, d, b) => {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (Math.hypot(cx - this.x, cz - this.z) < R + 2) D.destroyBuilding(kb, 'collapse', { dir: Math.atan2(this.z - cz, this.x - cx), noRubble: true, noCrush: true });
    });
    if (Math.random() < h * 4) { const a = Math.random() * Math.PI * 2; fire.dustCloud(this.x + Math.cos(a) * R, this.z + Math.sin(a) * R, 4, 8); }
    // a broken water main sprays muddy water out of the pit for a while
    if (k > 0.3 && (this.hold ? !(this.doneT > 2) : this.t < this.rumble + this.grow + 6) && Math.random() < 0.6) D.water.splash.emit(this.x, 0.5, this.z, 4, { up: [8, 16], spread: 4, life: 2, size: 1.8 });
    if (k >= 1 && (this.hold ? this.doneT > 5 : this.t > this.rumble + this.grow + 6)) {
      people.block(this.x, this.z, R + 0.3);
      D.ctx.traffic.closeNear(this.x, this.z, R + 3);
      this.alive = false;
      D.emit({ type: 'sinkholeend', text: 'The sinkhole has stopped growing' });
    }
  }
  sync() {}
  dispose() {}
}
