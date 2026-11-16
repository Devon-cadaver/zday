// Disaster TV's wrecking (Sean, 2026-11-15: the fights should visibly wreck the town as they go). On top of what each fight already brings
// down (a foe flung through a wall, the neck drag, a hurled building, the kaiju's own feet), in a level: the blasts that miss (the foe's
// power, now and then hers) hitting a building near the fight that the camera can see, and it comes down; a giant knocked back by a big
// blow staggers into the block behind it; a storm hurls a chunk of the street into a building. Only low and middling buildings are
// brought down this way (a tall tower takes the blast in its windows and stays up), never a landmark, and it stops once half the town is down.
import * as THREE from 'three';
import { sfx } from './audio.js';

const rnd = (a, b) => a + Math.random() * (b - a), TALL = 42, _v = new THREE.Vector3();
const HOT = { foe: new THREE.Color(5, 1.1, 0.35), hero: new THREE.Color(0.6, 2.4, 5), storm: new THREE.Color(1.6, 1.3, 1) };

export class Wreck {
  constructor(tv) { this.tv = tv; this.g = tv.g; this.fx = []; this.reset(); }
  reset() { this.t = rnd(2.5, 4); this.n = 0; this.lastFoe = null; this.knockT = 0; for (const f of this.fx) this.drop(f); this.fx = []; }
  D() { return this.g.disasters; }
  low(k) { const c = this.g.city, b = c.buildings[k]; return b && !c.dead[k] && !b.landmark && b.top - b.baseY < TALL; }
  downFrac() { const c = this.g.city; let n = 0; for (let k = 0; k < c.buildings.length; k++) if (c.dead[k]) n++; return n / Math.max(1, c.buildings.length); }
  // a building near (x, z) the camera can see (its middle inside the clear part of the screen), not the roof the camera is on
  target(x, z, R0, R1, away) {
    const c = this.g.city, cam = this.g.camera, cur = this.tv.cam.cur, L = []; cam.updateMatrixWorld();
    c.buildingsNear(x, z, R1, (k, d, b) => {
      if (!this.low(k) || (cur && cur.kind === 'roof' && cur.k === k)) return; const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, dd = Math.hypot(bx - x, bz - z); if (dd < R0) return;
      if (away && (bx - x) * away[0] + (bz - z) * away[1] < 0) return; // behind what was knocked back, not in front of it
      if (!this.inShot(b, cam)) return;
      L.push([k, dd]);
    });
    if (!L.length) return -1; L.sort((p, q) => p[1] - q[1]); return L[Math.floor(Math.random() * Math.min(4, L.length))][0];
  }
  // a good piece of it in the shot (its box on the screen at least a fifth of the way across and a sixth of the way up; a fight's tight shot sees the walls behind, not their middles)
  inShot(b, cam) {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9, n = 0;
    for (const x of [b.x0, b.x1]) for (const y of [b.baseY, b.top]) for (const z of [b.z0, b.z1]) { _v.set(x, y, z).project(cam); if (_v.z > 1) continue; n++; x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); }
    if (n < 4) return false; return Math.min(1, x1) - Math.max(-1, x0) > 0.4 && Math.min(0.75, y1) - Math.max(-0.6, y0) > 0.3;
  }
  // a bolt from (x, y, z) into building k, then the hit
  blast(x, y, z, k, col, then) {
    const D = this.D(), S = D.ctx.scene, b = this.g.city.buildings[k], bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, tx = Math.max(b.x0, Math.min(b.x1, x)), tz = Math.max(b.z0, Math.min(b.z1, z)), ty = b.baseY + Math.min(b.top - b.baseY - 1, rnd(4, 12));
    const hx = tx === x && tz === z ? bx : tx, hz = tx === x && tz === z ? bz : tz;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 8; S.add(m); const ball = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); S.add(ball);
    this.fx.push({ m, ball, t: 0, T: 0.28, a: [x, y, z], b: [hx, ty, hz], k, then }); sfx('laser', x, y, z, { gain: 0.9, rate: 0.8 + Math.random() * 0.3 });
  }
  drop(f) { const S = this.D().ctx.scene; for (const o of [f.m, f.ball]) if (o) { S.remove(o); o.geometry.dispose(); o.material.dispose(); } }
  // the hit: the windows blown through, fire, and down it comes, leaning away from the blow
  smash(k, fx, fz, big) {
    const D = this.D(), c = this.g.city, b = c.buildings[k]; if (!b || c.dead[k]) return false; const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, l = Math.hypot(fx, fz) || 1, fire = D.ctx.fire;
    D.blowWindows(k, fx, fz, 1.2); if (fire && fire.burst) fire.burst(bx - fx / l * 2, b.baseY + Math.min(10, (b.top - b.baseY) * 0.5), bz - fz / l * 2, big ? 40 : 26, big ? 3.2 : 2.4);
    sfx('boomBig', bx, b.baseY + 8, bz, { gain: 1.1 }); D.flash(big ? 0.22 : 0.12); this.g.shake = Math.max(this.g.shake || 0, big ? 1.1 : 0.7); this.g.hitStop = Math.max(this.g.hitStop || 0, big ? 0.09 : 0.05);
    if (b.top - b.baseY >= TALL || b.landmark) return false;
    D.destroyBuilding(k, 'collapse', { dir: Math.atan2(fx, fz), spare: true, noCrush: true }); this.n++; return true;
  }
  step(dt) {
    const D = this.D(); if (!this.fx.length && !this.tv.lv) return;
    // the bolts in flight
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t += dt; const u = Math.min(1, f.t / f.T), [ax, ay, az] = f.a, [bx, by, bz] = f.b, cx = ax + (bx - ax) * u, cy = ay + (by - ay) * u, cz = az + (bz - az) * u;
      if (f.m) { _v.set(cx - ax, cy - ay, cz - az); const L = _v.length(); f.m.position.set(ax, ay, az); if (L > 0.01) f.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.normalize()); f.m.scale.set(0.45, Math.max(0.01, L), 0.45); f.m.material.opacity = u < 1 ? 0.95 : Math.max(0, 0.95 - (f.t - f.T) * 6); }
      if (f.arc) { f.ball.position.set(cx, cy + Math.sin(u * Math.PI) * 14, cz); f.ball.rotation.x += dt * 6; f.ball.rotation.z += dt * 4; f.ball.visible = u < 1; }
      else if (f.ball) { f.ball.position.set(cx, cy, cz); f.ball.scale.setScalar(u < 1 ? 1 : 1 + (f.t - f.T) * 8); f.ball.material.opacity = u < 1 ? 1 : Math.max(0, 1 - (f.t - f.T) * 5); }
      if (u >= 1 && !f.hit) { f.hit = true; this.smash(f.k, bx - ax, bz - az, true); if (f.then) f.then(); }
      if (f.t > f.T + 0.25) { this.drop(f); this.fx.splice(i, 1); }
    }
    const lv = this.tv.lv, S = this.tv.cam.dir && this.tv.cam.dir.S; if (!lv || !S || !S.b || this.downFrac() > 0.5) return;
    const a = S.a, b = S.b, g = this.g, T = g.fightTest, F = g.flight, H = g.horde;
    // a giant knocked back by a big blow staggers into the block behind it
    { const e = H.active && H.o.boss && H.o.boss.alive ? H.o.boss : null, hp = e ? e.heroHp : null; this.knockT -= dt;
      if (hp != null && this.lastFoe != null && this.lastFoe - hp >= 4 && this.knockT <= 0) { this.knockT = 2.2; const k = this.target(b.x, b.z, 4, e.type === 'kaiju' ? 34 : 24, [b.x - a.x, b.z - a.z]); if (k >= 0) { this.smash(k, b.x - a.x, b.z - a.z, true); this.tv.hits.say('Knocked into a building!', 'small'); } }
      this.lastFoe = hp; }
    // the blasts that miss: every few seconds, from the foe (now and then from her) into a building the camera sees
    if ((this.t -= dt) > 0) return; this.t = S.fight ? rnd(2.6, 4) : rnd(3.6, 5.6);
    const storm = F.active && F.live && !F.live.drain && b.big, mx = storm ? b.x : (a.x + b.x) / 2, mz = storm ? b.z : (a.z + b.z) / 2, k = this.target(mx, mz, storm ? 10 : 6, storm ? 90 : b.big ? 60 : 58); if (k < 0) { this.t = 1; return; } // none in sight: look again soon
    if (storm) { this.hurl(b, k); return; } // a storm: a lump of the street hurled
    const hers = Math.random() < (b.crowd ? 0.7 : 0.3), src = hers ? a : b; if (b.crowd && !hers) { this.smash(k, (g.city.buildings[k].x0 + g.city.buildings[k].x1) / 2 - mx, (g.city.buildings[k].z0 + g.city.buildings[k].z1) / 2 - mz, false); return; } // a mob: a building set upon
    const sy = src.big ? src.y + src.h * 0.55 : src.y + 1.4;
    this.blast(src.x, sy, src.z, k, hers ? HOT.hero : HOT.foe, null);
    if (T.active && !hers && Math.random() < 0.5) this.tv.say(pick(['A blast goes wide and brings down a building', 'It missed, and the block behind took it!', 'Another building down in the crossfire']));
  }
  // a storm throws a lump of the street (a car-sized block) into a building
  hurl(b, k) {
    const D = this.D(), S = D.ctx.scene, c = this.g.city.buildings[k], m = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 4.5), new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0x8a7d6a : 0x5c6670, roughness: 0.9 }));
    S.add(m); const f = { m: null, ball: m, t: 0, T: 0.9, a: [b.x, b.y + b.h * 0.5, b.z], b: [(c.x0 + c.x1) / 2, c.baseY + Math.min(c.top - c.baseY - 1, 8), (c.z0 + c.z1) / 2], k, then: null };
    f.arc = true; this.fx.push(f); sfx('whoosh', b.x, b.y + 10, b.z, { gain: 1.1, rate: 0.6 });
  }
  dispose() { for (const f of this.fx) this.drop(f); this.fx = []; }
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
