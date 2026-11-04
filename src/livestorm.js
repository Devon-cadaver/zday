// The tornado as a villain (Sean: the weather disasters more like villains; the tornado has eyes and a mouth and you fight it while it hurls things at you and wrecks the town).
// Defend's tornado level: it has a face low on the funnel that follows you, a health bar, and it comes after you, tearing up the town on the way, throwing cars and rubble at where you are going.
// Lock on is a flying punch from wherever you are: straight in, a blow to the face, and you bounce off. Right after a throw its mouth stays open and a punch there counts double; Freeze counts too.
// Stay moving or what it throws hits you. Powers hurt it as they always did (heropower.js). flight.js F.live; the ring object is F.ring for the moment of the punch, as windgame.js does.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { LAB } from './lab.js';

const FACE_Y = 27, PUNCH = 5, MOUTH_K = 2.6, THROW_SP = 62, REACH = 270, BREATH = 0.8;
const CARS = [0xc9352a, 0x2a6fc9, 0xe0c23a, 0xe8e8e8, 0x3a3a44];
const basic = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });

export class LiveTornado {
  constructor(F, e) {
    this.F = F; this.e = e; this.tw = e.tw; if (e.heroHp == null) e.heroHp = 100; if (e.wgSize == null) e.wgSize = this.tw.size; this.t = 0; this.throwT = 2.5; this.items = []; this.openT = 0; this.hurtT = 0; this.at = new THREE.Vector3(); this.lp = F.pos.clone(); this.vel = new THREE.Vector3(); this.chaseT = 0;
    const g = this.face = new THREE.Group(); const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.renderOrder = 6; parent.add(m); return m; };
    const ball = new THREE.SphereGeometry(1, 18, 14), white = basic(0xffffff), black = basic(0x14121c), red = basic(0x5a0d14), bar = new THREE.BoxGeometry(1, 1, 1);
    this.eyes = [-1, 1].map((s) => { const eye = add(ball, white, s * 3.1, 2.2, 0); eye.scale.set(2.3, 2.5, 0.9); const pupil = add(ball, black, s * 3, 2, 0.95); pupil.scale.set(0.95, 1.15, 0.35); const brow = add(bar, black, s * 3.1, 4.9, 1); brow.scale.set(4.6, 0.9, 0.5); brow.rotation.z = s * -0.42; return { eye, pupil, brow, s }; });
    this.mouth = add(ball, red, 0, -3.1, 0); this.mouth.scale.set(5.2, 1, 0.8);
    this.teeth = [-3.4, -1.7, 0, 1.7, 3.4].map((x) => { const q = add(bar, white, x, -2.1, 0.8); q.scale.set(1.2, 1, 0.4); return q; });
    this.scene.add(g); g.visible = false;
    const el = this.el = document.createElement('div'); el.id = 'zd-boss'; el.style.cssText = 'position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translateX(-50%);width:min(62vw,300px);z-index:29;pointer-events:none;font:900 12px system-ui,sans-serif;letter-spacing:.08em;color:#fff;text-align:center;text-shadow:0 1px 3px #000'; el.innerHTML = 'THE TORNADO<div style="height:12px;margin-top:3px;border-radius:6px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.5);overflow:hidden"><i style="display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff5a4a,#ffd27a);transition:width .15s"></i></div>'; document.body.appendChild(el); this.barEl = el.querySelector('i');
    F.tip('It has seen you! LOCK ON to punch it. Keep moving: it throws things');
  }
  // the camera (flight.js) takes this as it does a giant
  get x() { return this.tw.x; }
  get z() { return this.tw.z; }
  get alive() { return this.tw.alive && !this.gone; }
  get type() { return 'tornado'; }
  get yaw() { return 0; }
  get scene() { return this.F.g.disasters.ctx.scene; }
  get D() { return this.F.g.disasters; }
  // where its face is, on the side of the funnel towards her
  place() { const F = this.F, tw = this.tw, k = Math.pow(Math.min(1, FACE_Y / tw.H), 1.5), ax = tw.x + (tw.vort.lx || 0) * k, az = tw.z + (tw.vort.lz || 0) * k, dx = F.pos.x - ax, dz = F.pos.z - az, d = Math.hypot(dx, dz) || 1, r = tw.radiusAt(FACE_Y) * 1.08; this.at.set(ax + dx / d * r, FACE_Y, az + dz / d * r); }
  step(dt) {
    const F = this.F, tw = this.tw, e = this.e; if (!e.alive || !tw.alive || e.heroHp <= 0) { this.dispose(); return; }
    this.t += dt; if (dt > 0) { this.vel.copy(F.pos).sub(this.lp).divideScalar(dt); this.lp.copy(F.pos); } this.openT = Math.max(0, this.openT - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.place();
    const g = this.face, on = tw.descend > 0.5 && tw.fade > 0.5; g.visible = on; const s = 1.15 * Math.max(0.75, tw.radiusAt(FACE_Y) / 12); g.position.copy(this.at); g.position.y += Math.sin(this.t * 3) * 0.7; g.scale.setScalar(s); g.lookAt(F.pos.x, F.pos.y + 4, F.pos.z); g.rotation.z += Math.sin(this.t * 2.1) * 0.08;
    const open = this.openT > 0, frozen = tw.frozen > 0, hurt = this.hurtT > 0, wide = open ? 3.6 : 1 + Math.abs(Math.sin(this.t * 2)) * 0.35; this.mouth.scale.y += (wide - this.mouth.scale.y) * Math.min(1, dt * 12); for (const q of this.teeth) q.position.y = -3.1 + this.mouth.scale.y * 0.72; this.mouth.material.color.setHex(frozen ? 0x2a6fa8 : open ? 0xc81e28 : 0x5a0d14);
    for (const E of this.eyes) { E.eye.scale.y = hurt ? 0.5 : 2.5; E.pupil.visible = !hurt; E.brow.rotation.z = E.s * (hurt ? 0.35 : -0.42); }
    this.barEl.style.width = Math.max(0, e.heroHp) + '%';
    // it comes for you, through whatever is in the way
    if (!frozen && (this.chaseT -= dt) <= 0) { this.chaseT = 1.2; tw.steer(F.pos.x, F.pos.z); }
    // it throws
    const d = Math.hypot(F.pos.x - tw.x, F.pos.z - tw.z); if (on && !frozen && !F.ring && F.state === 'fly' && d < REACH && (this.throwT -= dt) <= 0) { this.throwT = 2.9 - 1.1 * (1 - e.heroHp / 100); this.hurl(); }
    this.itemStep(dt);
  }
  hurl() { const F = this.F, sx = this.at.x, sy = this.at.y - 3, sz = this.at.z, n = this.e.heroHp < 50 ? 2 : 1; this.openT = 1.3; sfx('whoosh', sx, sy, sz, { gain: 1.1, rate: 0.6 }); for (let i = 0; i < n; i++) { const car = Math.random() < 0.65, m = new THREE.Mesh(new THREE.BoxGeometry(car ? 2.4 : 2.6, car ? 1.5 : 2.2, car ? 5 : 2.6), new THREE.MeshStandardMaterial({ color: car ? CARS[Math.floor(Math.random() * CARS.length)] : 0x8a8478, roughness: 0.6 })); m.castShadow = true; m.position.set(sx, sy, sz); this.scene.add(m); const dist = F.pos.distanceTo(this.at), T = Math.max(0.7, Math.min(2.4, dist / THROW_SP)), sw = i ? (Math.random() - 0.5) * 16 : 0, tx = F.pos.x + this.vel.x * T * 0.85 + sw, ty = F.pos.y + this.vel.y * T * 0.5, tz = F.pos.z + this.vel.z * T * 0.85 + sw; this.items.push({ m, sx, sy, sz, tx, ty, tz, t: 0, T, spin: [Math.random() * 7, Math.random() * 7] }); } }
  itemStep(dt) { const F = this.F, L = this.items; for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; q.t += dt; const u = q.t / q.T, m = q.m; m.position.set(q.sx + (q.tx - q.sx) * u, q.sy + (q.ty - q.sy) * u + Math.sin(Math.min(1, u) * Math.PI) * 8, q.sz + (q.tz - q.sz) * u); m.rotation.x += q.spin[0] * dt; m.rotation.y += q.spin[1] * dt; const hit = !F.ring && F.state === 'fly' && m.position.distanceTo(F.pos) < 4.2; if (hit || u > 1.25) { if (hit) { F.damage(LAB.villainHit(8), 'The tornado threw a car at you'); F.g.shake = Math.max(F.g.shake || 0, 0.7); F.bigText('HIT!', '#ff8a7a', 0.5); } this.burst(m.position.x, m.position.y, m.position.z, hit ? 10 : 5, m.material.color.getHex()); this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); L.splice(i, 1); } } }
  burst(x, y, z, n, col) { for (let i = 0; i < n; i++) { const s = 0.25 + Math.random() * 0.5; this.D.debris.add(x, y, z, s, s * 0.7, s, col, 'fly', { v: [(Math.random() - 0.5) * 18, 2 + Math.random() * 10, (Math.random() - 0.5) * 18], life: 0.7 }); } }
  // Lock on: the flying punch
  charge() { const F = this.F; if (F.ring) return; if (this.t < (this.nextT || 0)) { F.tip('Catching your breath'); return; } this.place(); if (F.pos.distanceTo(this.at) > REACH + 60) { F.tip('Too far: fly closer'); return; } F.lock = null; F.hovering = false; F.ring = this.punch = { phase: 'go', t: 0, step: (dt) => this.ringStep(dt), cam: (dt, cam, snap) => this.ringCam(dt, cam, snap), end: () => this.ringEnd() }; sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 1.1, rate: 1.1 }); }
  ringStep(dt) { const F = this.F, Q = this.punch, e = this.e; this.step(dt); if (!F.ring || !Q) return; Q.t += dt; F.obj.position.copy(F.pos); if (Q.phase === 'go') { const dx = this.at.x - F.pos.x, dy = this.at.y - F.pos.y, dz = this.at.z - F.pos.z, d = Math.hypot(dx, dy, dz) || 1, st = Math.min(d, (70 + 70 * Math.min(1, Q.t * 2)) * dt); F.pos.x += dx / d * st; F.pos.y += dy / d * st; F.pos.z += dz / d * st; F.yaw = Math.atan2(-dz, dx); F.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - F.pitch) * Math.min(1, dt * 8); F.speed = F.thr = 70; if (d < 5 || Q.t > 3) { this.land(); if (!F.ring) return; Q.phase = 'back'; Q.t = 0; Q.vx = -dx / d * 62; Q.vz = -dz / d * 62; Q.vy = 12; } return; } F.pos.x += Q.vx * dt; F.pos.y += Q.vy * dt; F.pos.z += Q.vz * dt; const dr = Math.exp(-dt * 2.4); Q.vx *= dr; Q.vy = Q.vy * dr - 10 * dt; Q.vz *= dr; F.speed = F.thr = 20; if (Q.t > 0.55) this.ringEnd(); }
  land() { const F = this.F, e = this.e, tw = this.tw, mouth = this.openT > 0, cold = tw.frozen > 0, n = PUNCH * (mouth ? MOUTH_K : 1) * (cold ? 1.5 : 1) / (1 + 0.05 * (LAB.villain - 1)); e.heroHp = Math.max(0, e.heroHp - n); this.hurtT = 0.5; tw.size = 1.15 + (e.wgSize - 1.15) * e.heroHp / 100; if (tw.applySize) tw.applySize(); F.g.shake = Math.max(F.g.shake || 0, mouth ? 1.2 : 0.8); F.g.hitStop = Math.max(F.g.hitStop || 0, mouth ? 0.12 : 0.07); this.D.flash(mouth ? 0.2 : 0.1); sfx('smack', this.at.x, this.at.y, this.at.z, { gain: 1.2, rate: mouth ? 0.8 : 1 }); this.burst(this.at.x, this.at.y, this.at.z, 12, 0xb9b1a0); F.bigText(mouth ? 'IN THE MOUTH! ' + Math.round(n) : cold ? 'FROZEN! ' + Math.round(n) : 'POW! ' + Math.round(n), mouth ? '#ffd27a' : '#ffffff', 0.7); this.openT = 0; if (e.heroHp <= 0) this.win(); }
  win() { const F = this.F, e = this.e, tw = this.tw; e.heroHp = 0; tw.life = 0; if (tw.phase === 'ground') { tw.phase = 'rope'; tw.ropeT = 0; } tw.frozen = 0; this.ringEnd(); F.tip('You stopped the tornado!'); F.bigText('TORNADO DOWN!', '#ffd27a', 1.8); this.D.flash(0.25); LAB.stats.stopped = (LAB.stats.stopped || 0) + 1; if (F.onStopped) F.onStopped(e); this.dispose(); }
  ringEnd() { const F = this.F; if (F.ring !== this.punch && this.punch) { this.punch = null; return; } this.punch = null; this.nextT = this.t + BREATH; F.ring = null; F.hovering = true; F.speed = F.thr = 0; F.arcGap = true; F.roll = 0; F.pitch = Math.max(-0.5, Math.min(0.5, Math.atan2(Math.sin(F.pitch), Math.cos(F.pitch)))); }
  // from behind and beside her, the face in the shot
  ringCam(dt, cam, snap) { const F = this.F, dx = this.at.x - F.pos.x, dz = this.at.z - F.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d; if (Math.abs(cam.fov - 52) > 0.02) { cam.fov += (52 - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); } F.ctx.post.opts.dof = false; cam.up.set(0, 1, 0); const k = snap ? 1 : 1 - Math.exp(-dt * 5); cam.position.x += (F.pos.x - ux * 24 - uz * 12 - cam.position.x) * k; cam.position.y += (F.pos.y + 9 - cam.position.y) * k; cam.position.z += (F.pos.z - uz * 24 + ux * 12 - cam.position.z) * k; cam.lookAt((F.pos.x + this.at.x) / 2, (F.pos.y + this.at.y) / 2, (F.pos.z + this.at.z) / 2); return true; }
  dispose() { if (this.gone) return; this.gone = true; const F = this.F; if (F.live === this) F.live = null; if (F.ring && F.ring === this.punch) this.ringEnd(); this.scene.remove(this.face); this.face.traverse((o) => { if (o.isMesh) { o.material.dispose(); } }); for (const q of this.items) { this.scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); } this.items.length = 0; this.el.remove(); }
}
