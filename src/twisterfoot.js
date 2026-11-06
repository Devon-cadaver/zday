// The tornado fought on foot (HERO-PLAN 10d's not yet: a tornado fought on foot with the kit; Sean, 2026-11-06), in the crowd fight (horde.js
// o.twister), in the Faultline's place (the same hooks: step, sweepHit, stoneNear, homing, giantsLeft, focus, dispose). The town's tornado
// (twister.js), held near her: it circles her and tears up the streets, it pulls her in when she is close (a dash gets her out), and every few
// seconds it flings a car at where she is going (a red ring where it will land). A car that has landed glows: GRAB it, let go, and it flies
// into the funnel. Each hit shrinks it; five and it ropes out, and Twister, the one behind it, comes out of it for the street fight (horde
// ctrlMake, as the worm's and the kaiju's drivers). Down, the town is saved.
import * as THREE from 'three';
import { sfx } from './audio.js';

const AIRY = ['dodge', 'glide', 'jugUp', 'jugWait', 'jugFall', 'sig', 'liftoff'];
const CARS = ['#c8352c', '#2a58c8', '#e8c33a', '#f4f1ea', '#20242e', '#3c7a4a'];
function carMesh(col) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.3 }), b = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.9), m), c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.75), new THREE.MeshStandardMaterial({ color: '#20262c', roughness: 0.2 })); c.position.set(-0.2, 0.95, 0); b.castShadow = c.castShadow = true; g.add(b, c); return g; }

export class TwisterFoot {
  constructor(H, o = {}) { this.H = H; this.g = H.g; this.S = H.g.disasters.ctx.scene; this.P = H.g.people; this.need = Math.round(5 * (o.tough || 1)); this.hits = 0; this.giants = []; this.stones = []; this.flying = []; this.t = 0; this.cd = 5; this.started = false; this.said = {}; this.busy = false; this.ang = Math.random() * 6.28; this.grabText = 'A CAR! LET GO TO THROW IT INTO THE FUNNEL'; }
  say(k, txt, T = 1.6) { if (this.said[k]) return; this.said[k] = true; this.H.say(txt, T, '#9fd8ff'); }
  mark(x, z, R, col = [2, 0.3, 0.2]) { const m = new THREE.Mesh(new THREE.RingGeometry(R * 0.82, R, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); m.position.set(x, this.P.groundY(x, z) + 0.12, z); this.S.add(m); return m; }
  unmark(m) { if (!m) return; this.S.remove(m); m.geometry.dispose(); m.material.dispose(); }
  // it touches down 60 m off, steered from then on
  start() {
    const h = this.H.h, D = this.g.disasters, a = Math.random() * 6.28, x = h.x + Math.cos(a) * 60, z = h.z + Math.sin(a) * 60; this.ev = D.start('tornado', x, z, { life: 99999, size: 1.9 });
    if (!this.ev || !this.ev.tw) { this.done = true; return; } const tw = this.tw = this.ev.tw; tw.player = true; tw.speed = 7; this.size0 = tw.size; this.started = true;
    this.giants = [{ alive: true, get x() { return tw.x; }, get z() { return tw.z; }, size: 24 }]; // for the hero's guard (her nearest foe)
    this.H.say('THE TORNADO!', 1.8, '#9fd8ff'); this.g.shake = Math.max(this.g.shake || 0, 0.5); sfx('whoosh', x, 20, z, { gain: 1.2, rate: 0.5 });
  }
  get funnel() { return this.tw && this.tw.phase !== 'rope' && this.tw.phase !== 'gone' && !this.down; }
  // ---------- each frame
  step(dt) {
    if (this.H.over || !(dt > 0) || this.done) return; if (!this.started) { if (this.H.active) this.start(); else return; } this.t += dt; const h = this.H.h, tw = this.tw;
    if (this.funnel) {
      // it circles her about 24 m off, closing in and backing off
      this.ang += dt * 0.22; const r = 24 + Math.sin(this.t * 0.35) * 8; tw.steerT = [h.x + Math.cos(this.ang) * r, h.z + Math.sin(this.ang) * r];
      // close, it pulls her in; right on it, it throws her out
      const dx = tw.x - h.x, dz = tw.z - h.z, d = Math.hypot(dx, dz) || 1, R = 16 * tw.size / this.size0;
      if (this.H.active && d < R && !AIRY.includes(h.state) && !['down', 'getup', 'flung'].includes(h.state)) {
        const k = (1 - d / R) * 6 * dt; h.x += dx / d * k * d * 0.25; h.z += dz / d * k * d * 0.25; this.say('pull', 'IT IS PULLING YOU IN: DASH OUT!');
        if (d < 5) { h.x = tw.x - dx / d * 12; h.z = tw.z - dz / d * 12; this.H.hitWhy = 'CAUGHT IN THE FUNNEL!'; this.H.bite(1.4); this.H.hitWhy = null; this.g.shake = Math.max(this.g.shake || 0, 0.7); }
      }
      if ((this.cd -= dt) <= 0) { this.cd = 3.2 + Math.random() * 1.6; this.toss(); }
    }
    this.flyStep(dt); this.stonesStep(dt);
    // down: Twister comes out of it; when he is beaten, it is over
    if (this.down && !this.ctrl && (this.downT += dt) > 2.5) { this.ctrl = this.H.ctrlMake({ type: 'tornado' }); this.H.countT = 0; }
  }
  // ---------- a car flung at where she is going
  toss() {
    const h = this.H.h, tw = this.tw, tx = h.x + h.vx * 0.7, tz = h.z + h.vz * 0.7, m = carMesh(CARS[Math.floor(Math.random() * CARS.length)]), a = new THREE.Vector3(tw.x, this.P.groundY(tw.x, tw.z) + 18, tw.z);
    m.position.copy(a); this.S.add(m); this.flying.push({ m, mk: this.mark(tx, tz, 3.2), a, x: tx, y: this.P.groundY(tx, tz) + 0.6, z: tz, t: 0, T: 1.4, arc: 10, w: (Math.random() - 0.5) * 8 });
    sfx('whoosh', a.x, a.y, a.z, { gain: 1, rate: 0.7 }); this.say('throw', 'CARS! GRAB ONE THAT LANDS AND THROW IT INTO THE FUNNEL', 2.2);
  }
  flyStep(dt) {
    const h = this.H.h; for (const b of this.flying) { b.t += dt; const u = Math.min(1, b.t / b.T); b.m.position.set(b.a.x + (b.x - b.a.x) * u, b.a.y + (b.y - b.a.y) * u + Math.sin(u * Math.PI) * b.arc, b.a.z + (b.z - b.a.z) * u); b.m.rotation.x += dt * b.w; b.m.rotation.y += dt * b.w * 0.6; if (u < 1) continue; b.done = true; this.unmark(b.mk);
      this.g.shake = Math.max(this.g.shake || 0, 0.5); sfx('crash', b.x, 1, b.z, { gain: 1, rate: 0.8 }); this.g.disasters.ctx.fire.dustCloud(b.x, b.z, 3, 4); this.busy = true; this.H.sweep(b.x, b.z, 3.5, 'burst'); this.busy = false;
      if (this.H.active && Math.hypot(h.x - b.x, h.z - b.z) < 3.4 && !AIRY.includes(h.state)) { this.H.hitWhy = 'HIT BY A CAR!'; this.H.bite(1.6); this.H.hitWhy = null; }
      b.m.rotation.set(0, Math.random() * 6.28, 0); b.m.position.y = this.P.groundY(b.x, b.z) + 0.55; const glow = this.mark(b.x, b.z, 3, [1.4, 1.2, 0.3]); this.stones.push({ m: b.m, glow, x: b.x, z: b.z, r: 2, t: 0 }); while (this.stones.length > 4) this.stoneGone(this.stones[0]); }
    this.flying = this.flying.filter((b) => !b.done);
  }
  stonesStep(dt) { for (const s of this.stones) { s.t += dt; s.glow.material.opacity = 0.45 + 0.35 * Math.sin(s.t * 5); if (s.t > 18) s.old = true; } for (const s of this.stones.filter((q) => q.old)) this.stoneGone(s); }
  stoneGone(s) { this.stones = this.stones.filter((q) => q !== s); this.unmark(s.glow); this.S.remove(s.m); }
  // GRAB by one (horde grabOn): within reach of the car, or of where a drawn stroke's dash began
  stoneNear(R) { const h = this.H.h, H = this.H, fr = H.dashFrom && performance.now() - (H.dashAt || 0) < 1200 ? H.dashFrom : null; let best = null, bd = 1e9; for (const s of this.stones) { const d = Math.min(Math.hypot(s.x - h.x, s.z - h.z), fr ? Math.hypot(s.x - fr[0], s.z - fr[1]) : 1e9) - s.r; if (d < R && d < bd) { bd = d; best = s; } } if (!best) return null; this.stones = this.stones.filter((q) => q !== best); this.unmark(best.glow); best.m.scale.setScalar(0.45); return best; }
  // thrown back (horde thrownStep): it flies into the funnel; true when it has hit
  homing(f, dt) { if (!this.funnel) return false; const tw = this.tw, cy = this.P.groundY(tw.x, tw.z) + 10, tx = tw.x - f.x, ty = cy - f.y, tz = tw.z - f.z, dd = Math.hypot(tx, ty, tz) || 1, sp = 46, k = Math.min(1, dt * 6); f.vx += (tx / dd * sp - f.vx) * k; f.vy += (ty / dd * sp - f.vy) * k; f.vz += (tz / dd * sp - f.vz) * k; if (dd > 6) return false; this.hit(f.x, f.y, f.z); return true; }
  hit(x, y, z) {
    const D = this.g.disasters, tw = this.tw; this.hits++; D.ctx.fire.burst(x, y, z, 12, 2); D.flash && D.flash(0.12); this.g.shake = Math.max(this.g.shake || 0, 0.9); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.1); sfx('crash', x, y, z, { gain: 1.2, rate: 0.7 }); this.H.hits++; this.H.hitsT = 1.5;
    tw.size = this.size0 * (1 - 0.45 * this.hits / this.need); // smaller each time
    if (this.hits >= this.need) { this.down = true; this.downT = 0; tw.player = false; tw.phase = 'rope'; tw.ropeT = 0; this.giants[0].alive = false; this.H.say('IT\'S BREAKING UP!', 1.8, '#ffd27a'); for (const b of this.flying) { this.unmark(b.mk); this.S.remove(b.m); } this.flying = []; }
    else this.H.say('INTO THE FUNNEL! ' + this.hits + '/' + this.need, 1.2, '#ffd27a');
  }
  // her blows on the funnel do nothing but say so
  sweepHit(x, z, R, dmg, how) { if (this.busy || !this.funnel || (how !== 'blow' && how !== 'kick')) return; if (Math.hypot(this.tw.x - x, this.tw.z - z) > R + 6) return; if (performance.now() > (this.punchSaid || 0)) { this.punchSaid = performance.now() + 6000; this.H.say('YOU CANNOT PUNCH WIND: THROW CARS INTO IT', 1.6, '#9fd8ff'); } }
  // the camera: the funnel and her together, from lower and further, a wider lens
  focus() { if (!this.funnel) return null; return { x: this.tw.x, z: this.tw.z, type: 'giant', want: 70, up: 14, el: 0.26, fov: innerWidth < innerHeight ? 40 : 28 }; }
  // what is left: the funnel till it is down, then Twister till he is beaten
  giantsLeft() { if (this.done) return 0; if (!this.started || !this.down) return 1; return this.ctrl && this.ctrl.gone ? 0 : 1; }
  dispose() { for (const s of this.stones) { this.unmark(s.glow); this.S.remove(s.m); } for (const b of this.flying) { this.unmark(b.mk); this.S.remove(b.m); } this.stones = []; this.flying = []; if (this.tw && this.tw.phase !== 'gone') { this.tw.player = false; this.tw.phase = 'rope'; this.tw.ropeT = 0; } this.done = true; }
}
