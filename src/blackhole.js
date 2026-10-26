// A mini black hole: a black sphere hanging over the street inside a blazing,
// swirling accretion disk, bending the light behind it (post.js lens). It
// grows as it feeds: people, cars, parked cars and torn-apart buildings spiral
// in faster and faster and vanish at the horizon, and the ground under it is
// eaten into a black void. When it has fed it collapses in a flash and the
// void stays behind, a sinkhole into nothing.
import * as THREE from 'three';
import { Hole, swallow } from './impact.js';
import { NOISE } from './water.js';

const DISK_VS = /* glsl */`
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISK_FS = /* glsl */`
uniform float uTime, uIn, uOut, uAmt;
varying vec2 vP;
${NOISE}
void main() {
  float r = length(vP), a = atan(vP.y, vP.x), t = clamp((r - uIn) / (uOut - uIn), 0.0, 1.0);
  float sw = a * 2.0 + uTime * (3.0 / (0.25 + t)) + log(r) * 5.0; // inner orbits run faster
  float bands = 0.45 + 0.55 * fbm(vec2(sw * 1.3, t * 9.0));
  float heat = pow(1.0 - t, 1.7);
  vec3 col = mix(vec3(1.5, 0.32, 0.05), vec3(3.2, 2.5, 1.7), heat);
  float beam = 0.55 + 0.65 * max(0.0, cos(a - 0.7)); // the side swinging towards us is brighter
  float alpha = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.5, 1.0, t)) * bands * uAmt;
  gl_FragColor = vec4(col * beam * (0.5 + heat), alpha);
}`;
// the photon ring: a thin bright halo hugging the horizon, always facing the camera
const RING_FS = /* glsl */`
uniform float uAmt, uTime;
varying vec2 vP;
void main() {
  float r = length(vP);
  float ring = exp(-pow((r - 1.08) * 14.0, 2.0)) * 1.6 + exp(-pow((r - 1.0) * 5.0, 2.0)) * 0.35;
  float flick = 0.85 + 0.15 * sin(uTime * 23.0 + atan(vP.y, vP.x) * 6.0);
  gl_FragColor = vec4(vec3(3.0, 2.2, 1.4) * ring * flick, ring * uAmt);
}`;

export class BlackHole {
  constructor(D, x, z, o = {}) {
    this.type = 'blackhole'; this.D = D; this.x = x; this.z = z; this.y = 15; this.t = 0; this.alive = true; this.phase = 'form';
    this.Rmax = o.size ?? 3.2 + Math.random() * 1.3; this.life = o.life ?? 26; this.Rh = 0.05; this.tick = 0;
    this.lift = []; this.cars = []; this.eaten = 0;
    this.hold = !!o.grow; this.holding = this.hold; this.holdT = 0; this.voidR = 3;
    this.steer = !!o.steer; this.tx = x; this.tz = z; this.torn = 0; // steered (Be The Disaster): it roams after your finger and leaves its void where it dies // held: it swells for as long as the finger is down
    const scene = D.ctx.scene;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
    this.diskMat = new THREE.ShaderMaterial({ vertexShader: DISK_VS, fragmentShader: DISK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uIn: { value: 1.25 }, uOut: { value: 4.6 }, uAmt: { value: 0 } } });
    this.disk = new THREE.Mesh(new THREE.RingGeometry(1.25, 4.6, 128, 1), this.diskMat);
    this.ringMat = new THREE.ShaderMaterial({ vertexShader: DISK_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAmt: { value: 0 }, uTime: { value: 0 } } });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), this.ringMat);
    this.disk.renderOrder = 8; this.ring.renderOrder = 9;
    scene.add(this.ball, this.disk, this.ring);
    this.tilt = new THREE.Euler(-Math.PI / 2 + 0.32, 0, Math.random() * 6.28, 'YXZ');
    // debris drawn in spirals into it (debris.js treats a sink vortex specially)
    this.vort = { x, z, y: this.y, H: this.y * 2, sink: true, horizon: 0.1, scale: 1, spin: 1, alive: true, radiusAt: () => 2 };
    this.vi = D.debris.vortices.push(this.vort) - 1;
    this.hole = this.steer ? { R: 3, setR(r) { this.R = r; } } : new Hole(D, x, z, { R: 0.5, depth: 70, rim: 1.25, shape: 'shaft', wall: '#16120f', floor: '#000000', rimCol: '#2c2622', void: true });
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'blackhole', x, z, r: 70, exact: true, text: 'Gravitational anomaly in the ' + D.district(x, z) + ' district! Something is tearing a hole in space. Get away from it' });
    D.flash(0.25); D.shake(0.6);
  }
  get pullR() { return Math.max(18 + this.Rh * 15, this.voidR + 45); }
  get tearR() { return Math.max(5 + this.Rh * 6, this.voidR + 10); }
  get size() { return this.hole.R; }
  release() { if (this.holding) { this.holding = false; this.ft = 0; } }
  collapse() { if (this.phase === 'form' || this.phase === 'feed') { this.phase = 'collapse'; this.ct = 0; this.R0 = this.Rh; } }
  poi() { return this.phase === 'gone' ? null : { x: this.x, z: this.z, danger: this.pullR * 1.15, range: 520 }; }

  update(h) {
    const D = this.D;
    this.t += h;
    if (this.steer && (this.phase === 'form' || this.phase === 'feed')) { // roams after the finger, slower the bigger it is, and grows with what it eats
      const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz), sp = Math.max(2, 9 - this.Rh);
      if (d > 1) { this.x += dx / d * Math.min(d, sp * h); this.z += dz / d * Math.min(d, sp * h); this.vort.x = this.x; this.vort.z = this.z; }
      const tRh = (this.phase === 'form' ? Math.min(1, this.t / 1.5) : 1) * Math.min(7, 1 + this.eaten * 0.01 + this.torn * 0.12);
      this.Rh += (tRh - this.Rh) * Math.min(1, h);
      this.hole.R = 3 + this.Rh * 3;
      D.shake(0.1 + this.Rh * 0.03);
      if (this.phase === 'form' && this.t >= 1.5) { this.phase = 'feed'; this.ft = 0; }
    } else if (this.hold && (this.phase === 'form' || this.phase === 'feed')) { // swells while held, feeds a while after it is let go
      if (this.holding) { this.holdT += h; if (this.holdT > 90) this.release(); }
      const tRh = (this.phase === 'form' ? Math.min(1, this.t / 1.5) : 1) * (1 + Math.min(8, this.holdT * 0.4));
      this.Rh += (tRh - this.Rh) * Math.min(1, h * 2);
      this.voidR = Math.min(D.maxHoleR, 3 + this.holdT * 5.5);
      D.shake(0.12 + this.Rh * 0.03);
      if (this.phase === 'form' && this.t >= 1.5) { this.phase = 'feed'; this.ft = 0; }
      if (!this.holding && this.phase === 'feed' && (this.ft += h) >= 10) { this.phase = 'collapse'; this.ct = 0; this.R0 = this.Rh; }
    } else if (this.phase === 'form') {
      this.Rh = 0.05 + Math.min(1, this.t / 3) * 0.95;
      D.shake(0.15);
      if (this.t >= 3) { this.phase = 'feed'; this.ft = 0; }
    } else if (this.phase === 'feed') {
      this.ft += h;
      this.Rh = 1 + (this.Rmax - 1) * Math.min(1, this.ft / (this.life * 0.7));
      D.shake(0.12 + this.Rh * 0.03);
      if (this.ft >= this.life) { this.phase = 'collapse'; this.ct = 0; this.R0 = this.Rh; }
    } else if (this.phase === 'collapse') {
      this.ct += h;
      this.Rh = this.R0 * Math.max(0.02, 1 - this.ct / 1.6);
      if (this.ct >= 1.6) this.burst();
    }
    this.vort.horizon = this.Rh;
    if (this.phase === 'form' || this.phase === 'feed') {
      if ((this.tick -= h) <= 0) { this.tick = 0.25; this.pull(); }
    }
    this.spiral(h);
  }

  // who and what gets caught this moment
  pull() {
    const D = this.D, { people, traffic, city } = D.ctx, x = this.x, z = this.z, P = this.pullR, T = this.tearR;
    people.around(x, z, P * 1.5, (j) => {
      if (!people.hittable(j)) return;
      const d = Math.hypot(people.x[j] - x, people.z[j] - z);
      if (d < P && this.lift.length < 320 && Math.random() < Math.pow(1 - d / P, 0.7) * 0.9 && people.grab(j)) { this.lift.push(j); return; }
      if (Math.random() < 0.3) people.panic(j, x, z, -1); // everyone else runs...
      const k = Math.min(1, (P * 1.5 - d) / (P * 0.5)) * 1.3, nx = people.x[j] + (x - people.x[j]) / d * k, nz = people.z[j] + (z - people.z[j]) / d * k;
      if (people.walkable(nx, nz)) { people.x[j] = nx; people.z[j] = nz; } // ...but the pull drags them back
    });
    if (this.cars.length < 28) traffic.near(x, z, P, (car) => {
      if (car.gone || car.mode === 4 || car.mode === 5 || car.mission) return;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < P * 0.9 && Math.random() < (1 - d / P) * 0.28 && traffic.grab(car)) this.cars.push(car);
    });
    for (const pc of traffic.parkedNear(x, z, P * 0.7)) {
      if (Math.random() > 0.35) continue;
      traffic.takeParked(pc);
      const m = new THREE.Mesh(traffic.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true; m.position.set(pc.x, 0.3, pc.z); m.rotation.y = pc.rot;
      D.debris.addObject(m, 'orbit', { vort: this.vi, hold: 99 });
    }
    // buildings in reach are torn apart and drawn in, the nearest first
    let k0 = -1, dk = 1e9, inside = 0;
    city.buildingsNear(x, z, T, (k, d, b) => {
      if (this.hold && inside < 3 && Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z) < this.hole.R + 4 && D.destroyBuilding(k, 'tear', { vort: this.vi, noRubble: true })) { inside++; for (const j of people.lifted) this.lift.push(j); people.lifted.length = 0; return; }
      if (d < dk) { dk = d; k0 = k; }
    });
    if (k0 >= 0 && Math.random() < 0.5 && D.destroyBuilding(k0, 'tear', { vort: this.vi, noRubble: true }) && ++this.torn) { for (const j of people.lifted) this.lift.push(j); people.lifted.length = 0; } // the people inside go with it
    for (const it of city.takeStreetNear(x, z, T)) D.debris.add(it.x, it.y, it.z, it.s * 0.8, it.s * 0.6, it.s * 0.8, it.kind === 'tree' ? it.col : '#4a4540', 'orbit', { vort: this.vi, hold: 99 });
    // the street itself comes up in chunks
    for (let n = 0; n < 4; n++) {
      const a = Math.random() * 6.28, r = this.hole.R + Math.random() * T * 0.5, s = 0.4 + Math.random() * 1.3;
      D.debris.add(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, s, s * 0.35, s * (0.6 + Math.random() * 0.6), Math.random() < 0.6 ? 0x6a655c : 0x8a8274, 'orbit', { vort: this.vi, hold: 99 });
    }
    if (!this.steer) this.hole.setR(Math.max(this.hole.R, this.hold ? this.voidR : Math.min(T * 0.85, 3 + this.Rh * 4.6)));
  }

  // everything caught spirals in: tighter and faster as it falls, gone at the horizon
  spiral(h) {
    const { people, traffic } = this.D.ctx, x = this.x, z = this.z, cy = this.y, H = this.Rh;
    const step = (px, py, pz) => {
      const dx = px - x, dz = pz - z, r = Math.hypot(dx, dz);
      const nr = Math.max(0, r - h * (2.5 + 70 / (r + 3))), a = Math.atan2(dz, dx) + h * (0.8 + 45 / (r + 4));
      const ny = py + (cy - py) * Math.min(1, h * (0.5 + 14 / (r + 6)));
      return [x + Math.cos(a) * nr, ny, z + Math.sin(a) * nr, Math.hypot(nr, ny - cy)];
    };
    for (let k = this.lift.length - 1; k >= 0; k--) {
      const j = this.lift[k];
      if (people.st[j] !== 19) { this.lift.splice(k, 1); continue; } // shot or dropped
      const [nx, ny, nz, d] = step(people.x[j], people.y[j], people.z[j]);
      people.x[j] = nx; people.y[j] = ny; people.z[j] = nz;
      if (d < H + 0.6) { people.fallIn(j); this.eaten++; this.lift.splice(k, 1); }
    }
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k];
      if (c.mode !== 4 || c.gone) { this.cars.splice(k, 1); continue; }
      const [nx, ny, nz, d] = step(c.x, c.y || 0, c.z);
      c.x = nx; c.y = ny; c.z = nz; c.yaw += h * 3.2; c.roll = (c.roll || 0) + h * 2.1; c.pitch = (c.pitch || 0) + h * 1.4;
      if (d < H + 1.5) { traffic.remove(c); this.cars.splice(k, 1); }
    }
  }

  // fed: it collapses in a flash and throws out whatever had not crossed yet
  burst() {
    const D = this.D, { people, traffic } = D.ctx;
    D.flash(0.9); D.shake(1.8);
    for (const j of this.lift) if (people.st[j] === 19) { const dx = people.x[j] - this.x, dz = people.z[j] - this.z, d = Math.hypot(dx, dz) || 1; people.fling(j, dx / d * 14, 6, dz / d * 14); }
    for (const c of this.cars) if (c.mode === 4 && !c.gone) { const dx = c.x - this.x, dz = c.z - this.z, d = Math.hypot(dx, dz) || 1; traffic.fling(c, dx / d * 16, 6, dz / d * 16); }
    this.lift.length = 0; this.cars.length = 0;
    this.vort.alive = false;
    if (this.steer) { // it dies where it stands and the ground there is gone
      const R = Math.min(D.maxHoleR, 6 + this.Rh * 7);
      this.hole = new Hole(D, this.x, this.z, { R, depth: 70, rim: 1.25, shape: 'shaft', wall: '#16120f', floor: '#000000', rimCol: '#2c2622', void: true });
      swallow(D, this.x, this.z, R); D.ctx.city.buildingsNear(this.x, this.z, R, (k, d, b) => { if (Math.hypot((b.x0 + b.x1) / 2 - this.x, (b.z0 + b.z1) / 2 - this.z) < R) D.destroyBuilding(k, 'collapse', { noRubble: true, noCrush: true }); });
    }
    people.block(this.x, this.z, this.hole.R + 0.3); traffic.closeNear(this.x, this.z, this.hole.R + 3);
    D.ctx.post.opts.lens = null;
    this.phase = 'gone'; this.alive = false;
    D.emit({ type: 'blackholeend', text: 'The black hole has evaporated. It left a void in the earth' });
  }

  sync(dt, realT) {
    const D = this.D, cam = D.ctx.camera, R = this.Rh, amt = this.phase === 'gone' ? 0 : Math.min(1, R);
    this.ball.position.set(this.x, this.y, this.z); this.ball.scale.setScalar(Math.max(0.01, R));
    this.disk.position.copy(this.ball.position); this.disk.scale.setScalar(Math.max(0.01, R));
    this.tilt.z += dt * 0.05; this.disk.rotation.copy(this.tilt);
    this.ring.position.copy(this.ball.position); this.ring.scale.setScalar(Math.max(0.01, R)); this.ring.quaternion.copy(cam.quaternion);
    this.diskMat.uniforms.uTime.value = realT; this.diskMat.uniforms.uAmt.value = amt;
    this.ringMat.uniforms.uTime.value = realT; this.ringMat.uniforms.uAmt.value = amt;
    // light bends round it: where it sits on screen and how big
    const p = this.ball.position.clone().project(cam), e = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion).multiplyScalar(R).add(this.ball.position).project(cam);
    const asp = D.ctx.renderer.domElement.width / Math.max(1, D.ctx.renderer.domElement.height);
    const rs = Math.hypot((e.x - p.x) * 0.5 * asp, (e.y - p.y) * 0.5);
    D.ctx.post.opts.lens = p.z < 1 && amt > 0 ? { amount: amt, x: p.x * 0.5 + 0.5, y: p.y * 0.5 + 0.5, r: rs * 1.9 } : null;
  }

  dispose() {
    const D = this.D, { people, traffic } = D.ctx;
    for (const j of this.lift) if (people.st[j] === 19) people.fling(j, 0, 0, 0);
    for (const c of this.cars) if (c.mode === 4 && !c.gone) traffic.fling(c, 0, 0, 0);
    this.vort.alive = false;
    if (D.ctx.post.opts.lens) D.ctx.post.opts.lens = null;
    D.ctx.scene.remove(this.ball, this.disk, this.ring);
    for (const m of [this.ball, this.disk, this.ring]) { m.geometry.dispose(); m.material.dispose(); }
  }
}
