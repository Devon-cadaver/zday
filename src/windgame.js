// The tornado level's mini-game (Sean: flying round it the other way, but flying is too hard to control for that). Lock on and the game does the
// flying: she goes round the funnel against its spin, seen from the side. Three heights: swipe or the arrows to change, out of the way of what it
// throws. GUST in the green of the gauge unwinds it; a miss lets it wind back up. Freeze holds it still and every gust counts for more. Hit, she is
// thrown clear and hovers, and Lock on brings her back. Everything else about the level (who wins, its reward) is the ordinary flight level's.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { LAB } from './lab.js';
import { POWER } from './heropower.js';

const LANES = [26, 42, 58], W_HER = 0.75, W_JUNK = 0.75, SHOW = 2.5; // the three heights; how fast she and the junk go round, opposite ways; how far ahead junk appears, in radians
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const box = (x, y, z, c) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
function junkMesh(kind) { // bigger than life, so it reads from the side
  const g = new THREE.Group();
  if (kind === 0) { const c = ['#c9352a', '#2f6fd0', '#e0b030', '#dfe3e8'][Math.floor(Math.random() * 4)]; g.add(box(8, 2.2, 4, c)); const top = box(4.2, 1.7, 3.6, '#22262c'); top.position.y = 1.9; g.add(top); }
  else if (kind === 1) { const t = box(1.4, 8, 1.4, '#5a3a26'); g.add(t); const top = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 7), new THREE.MeshStandardMaterial({ color: '#4a6a2c', roughness: 0.9, flatShading: true })); top.position.y = 6; g.add(top); }
  else { const a = box(9, 0.8, 7, '#8a3a2c'); a.rotation.z = 0.5; a.position.set(-2.6, 1, 0); const b = box(9, 0.8, 7, '#8a3a2c'); b.rotation.z = -0.5; b.position.set(2.6, 1, 0); g.add(a, b); }
  g.scale.setScalar(0.8); g.spin = [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4]; return g;
}

export class WindGame {
  constructor(F, e) { this.F = F; this.e = e; this.tw = e.tw; this.phase = 'in'; this.lane = 1; this.latch = false; this.junk = []; this.spawnT = 1.2; this.nt = 0; this.cd = 0; this.frzCd = 0; this.t = 0; this.a = Math.atan2(F.pos.z - this.tw.z, F.pos.x - this.tw.x); if (e.heroHp == null) e.heroHp = 100; if (e.wgSize == null) e.wgSize = this.tw.size; if (e.wgStreak == null) e.wgStreak = 0; F.hovering = true; F.lock = null; F.speed = F.thr = 0; F.tip('Into the ring! Dodge up and down. GUST in the green'); sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 1 }); this.ui(true); }
  static thrownFrom(F, e) { const G = new WindGame(F, e); G.ui(false); G.throwOff(false); return G; }
  get D() { return this.F.g.disasters; }
  get progress() { return 1 - Math.max(0, this.e.heroHp) / 100; }
  get frozen() { return this.tw.frozen > 0; }
  get radius() { return this.tw.radiusAt(LANES[2]) + 20; }
  // how far along the gauge is, 0 to 1 and back; the green's half width
  get needle() { const u = (this.nt % 2); return u < 1 ? u : 2 - u; }
  get zone() { return this.frozen ? 0.5 : 0.15 - 0.05 * this.progress; }
  ui(on) {
    { const rep = document.getElementById('zd-rep'); if (rep) rep.style.visibility = on ? 'hidden' : ''; } // the gauge says it, and the dots go there
    const F = this.F, r0 = F.bar && F.bar.querySelector('.row'); if (F.tipEl) F.tipEl.style.transform = on ? 'translate(-50%,-44px)' : ''; for (const el of [this.row, this.gauge, this.dots]) if (el) el.remove(); this.row = this.gauge = this.dots = null; if (r0) r0.style.display = on ? 'none' : ''; if (!on || !r0) return;
    const row = this.row = document.createElement('div'); row.className = 'row'; const stop = (q, fn) => { q.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); q.addEventListener('click', (e) => e.stopPropagation()); };
    const mk = (t, flex) => { const q = document.createElement('button'); q.type = 'button'; q.className = 'zd-btn use'; q.style.cssText = 'padding:18px 2px;font-size:14px;touch-action:none;flex:' + flex + ' 1 0'; q.innerHTML = t; row.appendChild(q); return q; };
    const P0 = POWER[F.power.list()[0]], gu = this.gustBtn = mk('🌬 GUST', 2), fz = this.frzBtn = mk(P0.icon + ' ' + P0.name.toUpperCase(), 1.4), up = this.upBtn = mk('▲', 1), dn = this.dnBtn = mk('▼', 1); gu.dataset.wg = 'gust'; fz.dataset.wg = 'freeze'; up.dataset.wg = 'up'; dn.dataset.wg = 'down'; stop(gu, () => this.gust()); stop(fz, () => this.freeze()); stop(up, () => this.move(1)); stop(dn, () => this.move(-1));
    const g = this.gauge = document.createElement('div'); g.style.cssText = 'position:relative;height:26px;border-radius:8px;background:rgba(10,8,20,.82);border:1px solid rgba(255,255,255,.3);overflow:hidden;pointer-events:none'; g.innerHTML = '<i style="position:absolute;top:0;bottom:0;background:#49d65a"></i><b style="position:absolute;top:0;bottom:0;width:5px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff"></b><span style="position:absolute;left:8px;top:5px;font:800 12px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000"></span>'; this.zoneEl = g.children[0]; this.needleEl = g.children[1]; this.labelEl = g.children[2]; F.bar.insertBefore(g, r0); F.bar.insertBefore(row, r0);
    const d = this.dots = document.createElement('div'); d.id = 'zd-lanes'; d.style.cssText = 'position:fixed;left:12px;top:34%;display:flex;flex-direction:column;gap:12px;z-index:25;pointer-events:none'; d.innerHTML = '<i></i><i></i><i></i>'; for (const q of d.children) q.style.cssText = 'display:block;width:30px;height:30px;border-radius:50%;box-sizing:border-box;border:3px solid rgba(255,255,255,.5);background:rgba(10,8,20,.5);transition:background .08s'; document.body.appendChild(d);
  }
  move(dir) { if (this.phase !== 'ring') return; const n = Math.max(0, Math.min(2, this.lane + dir)); if (n === this.lane) return; this.lane = n; sfx('whoosh', this.F.pos.x, this.F.pos.y, this.F.pos.z, { gain: 0.5, rate: 1.5 }); }
  gust() {
    if (this.phase !== 'ring' || this.cd > 0) return; this.cd = 0.3; const e = this.e, F = this.F, D = this.D, tw = this.tw, good = Math.abs(this.needle - 0.5) <= this.zone, y = F.pos.y;
    F.punch = 0.4; for (let i = 0; i < (good ? 3 : 1); i++) D.brawl.stunts.ring(tw.x, y + (i - 1) * 3, tw.z, tw.radiusAt(y) + (good ? 8 : 3), 0.35 + i * 0.12, good ? new THREE.Color(1.4, 2.2, 1.6) : new THREE.Color(1.2, 1.2, 1.2), 0.8);
    if (!good) { e.heroHp = Math.min(100, e.heroHp + 1.5); e.wgStreak = 0; F.tip('Too early or too late: it winds back up'); sfx('whoosh', F.pos.x, y, F.pos.z, { gain: 0.6, rate: 0.7 }); this.nudge('#ff8a7a'); this.apply(); return; }
    e.wgStreak++; const hit = (3 + Math.min(e.wgStreak, 6) * 0.25) * (this.frozen ? 1.6 : 1); e.heroHp -= hit; F.tip(e.wgStreak > 1 ? 'GUST! ' + e.wgStreak + ' in a row' : 'GUST!'); F.g.shake = Math.max(F.g.shake || 0, 0.4); sfx('whoosh', F.pos.x, y, F.pos.z, { gain: 1.4, rate: 0.6 }); sfx('thud', tw.x, y, tw.z, { gain: 0.8, rate: 0.7 }); this.nudge('#a6ff4d'); this.apply();
    if (e.heroHp <= 0) this.win();
  }
  nudge(c) { if (!this.gauge) return; this.gauge.style.borderColor = c; clearTimeout(this.ngT); this.ngT = setTimeout(() => { if (this.gauge) this.gauge.style.borderColor = 'rgba(255,255,255,.3)'; }, 240); }
  // the funnel shrinks as it unwinds
  apply() { const e = this.e, tw = this.tw; tw.size = 1.15 + (e.wgSize - 1.15) * Math.max(0, e.heroHp) / 100; }
  freeze() {
    if (this.phase !== 'ring' || this.frzCd > 0) { if (this.frzCd > 0) this.F.tip('It needs a moment to charge'); return; } this.frzCd = 6; const tw = this.tw, F = this.F, D = this.D; tw.frozen = 2; for (let i = 0; i < 4; i++) D.brawl.stunts.ring(tw.x, 18 + i * 14, tw.z, tw.radiusAt(18 + i * 14) + 5, 0.5 + i * 0.1, new THREE.Color(0.7, 1.8, 3), 0.9); F.tip('Frozen! Any gust lands, and hits harder'); F.g.shake = Math.max(F.g.shake || 0, 0.4); sfx('glass', tw.x, F.pos.y, tw.z, { gain: 1.1 });
    const u = [tw.inner.material.uniforms, tw.outer.material.uniforms], was = u.map(q => [q.uColA.value.clone(), q.uColB.value.clone()]); for (const q of u) { q.uColA.value.set('#7fc4ee'); q.uColB.value.set('#dff4ff'); } setTimeout(() => u.forEach((q, i) => { q.uColA.value.copy(was[i][0]); q.uColB.value.copy(was[i][1]); }), 2000);
  }
  win() { const F = this.F, e = this.e, tw = this.tw; e.heroHp = 0; tw.life = 0; if (tw.phase === 'ground') { tw.phase = 'rope'; tw.ropeT = 0; } tw.frozen = 0; this.end(); F.tip('You stopped the tornado!'); this.D.flash(0.2); LAB.stats.stopped = (LAB.stats.stopped || 0) + 1; if (F.onStopped) F.onStopped(e); }
  // out of the ring: FLY, or the level over
  end() { this.clearJunk(); this.ui(false); const F = this.F; F.obj.scale.setScalar(1); F.ring = null; F.hovering = true; F.speed = F.thr = 0; F.roll = Math.atan2(Math.sin(F.roll), Math.cos(F.roll)); F.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(Math.sin(F.pitch), Math.cos(F.pitch)))); }
  clearJunk() { for (const q of this.junk) this.D.ctx.scene.remove(q.m), q.m.traverse((o) => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } }); this.junk.length = 0; }
  throwOff(hurt) { const F = this.F, D = this.D, a = this.a, sp = 46; this.clearJunk(); this.ui(false); this.phase = 'thrown'; this.th = { t: 0, vx: Math.cos(a) * sp, vy: 10 + Math.random() * 10, vz: Math.sin(a) * sp, spin: Math.random() < 0.5 ? 1 : -1 }; F.hovering = false; if (hurt) { if (F.hull > 15) F.damage(10, 'The tornado threw you too hard'); this.e.heroHp = Math.min(100, this.e.heroHp + 6); this.e.wgStreak = 0; this.apply(); } F.tip('Thrown clear!'); F.g.shake = Math.max(F.g.shake || 0, 1); sfx('crash', F.pos.x, F.pos.y, F.pos.z, { gain: 1, rate: 0.8 }); D.ctx.fire.burst(F.pos.x, F.pos.y, F.pos.z, 10, 2); }
  spawn() { const p = this.progress, both = p > 0.5 && Math.random() < 0.3 + p * 0.5, pick = Math.random() < 0.55 ? this.lane : Math.floor(Math.random() * 3), L = [pick]; if (both) L.push((pick + (Math.random() < 0.5 ? 1 : 2)) % 3); for (const lane of L) { const m = junkMesh(Math.floor(Math.random() * 3)); this.D.ctx.scene.add(m); this.junk.push({ a: this.a - SHOW, lane, m, y: LANES[lane] }); } }
  step(dt) {
    const F = this.F, tw = this.tw, e = this.e;
    if (!e.alive || e.heroHp <= 0) { this.end(); return; }
    F.obj.position.copy(F.pos); F.obj.scale.setScalar(2.2); // bigger than life in here: the eye has to find her at a glance
    if (this.phase === 'thrown') { const Q = this.th; Q.t += dt; F.pos.x += Q.vx * dt; F.pos.y += Q.vy * dt; F.pos.z += Q.vz * dt; const dr = Math.exp(-dt * 1.3); Q.vx *= dr; Q.vz *= dr; Q.vy = Q.vy * dr - 8 * dt; F.roll += dt * 15 * Q.spin; F.pitch += dt * 8; F.speed = F.thr = 0; const gy = F.g.people.groundY(F.pos.x, F.pos.z) + 3; if (F.pos.y < gy) { F.pos.y = gy; Q.vy = Math.abs(Q.vy) * 0.4; } if (Q.t > 1.7) { this.end(); F.tip('Got it back! Lock on to go round again'); } return; }
    this.t += dt; const cold = this.frozen, R = this.radius, wx = () => tw.x + Math.cos(this.a) * R, wz = () => tw.z + Math.sin(this.a) * R; F.speed = F.thr = 0;
    this.a -= W_HER * dt; F.yaw = Math.atan2(Math.cos(this.a), Math.sin(this.a));
    if (this.phase === 'in') { const k = Math.min(1, dt * (2.5 + this.t * this.t * 6)); F.pos.x += (wx() - F.pos.x) * k; F.pos.y += (LANES[this.lane] - F.pos.y) * k; F.pos.z += (wz() - F.pos.z) * k; F.pitch += (0 - F.pitch) * k; F.speed = 45; if (Math.hypot(wx() - F.pos.x, wz() - F.pos.z) < 3) this.phase = 'ring'; return; }
    F.pos.x = wx(); F.pos.z = wz(); F.pos.y += (LANES[this.lane] - F.pos.y) * Math.min(1, dt * 9); F.roll += (-0.35 - F.roll) * Math.min(1, dt * 4); F.pitch += (0.1 - F.pitch) * Math.min(1, dt * 4); F.speed = 45;
    // a swipe up or down, or the arrow keys, changes height
    const K = F.keys, iy = K.has('arrowup') || K.has('w') ? -1 : K.has('arrowdown') || K.has('s') ? 1 : F.iy; if (Math.abs(iy) > 0.45) { if (!this.latch) { this.latch = true; this.move(iy < 0 ? 1 : -1); } } else if (Math.abs(iy) < 0.2) this.latch = false;
    this.cd = Math.max(0, this.cd - dt); this.frzCd = Math.max(0, this.frzCd - dt); const p = this.progress; this.nt += dt / (cold ? 1.2 : 0.85 - 0.3 * p);
    if (!cold && (this.spawnT -= dt) <= 0) { this.spawnT = 1.9 - 0.8 * p; this.spawn(); }
    const near = [1e9, 1e9, 1e9];
    for (let i = this.junk.length - 1; i >= 0; i--) { const q = this.junk[i]; if (!cold) q.a += W_JUNK * dt; const gap = wrap(q.a - this.a), m = q.m; m.position.set(tw.x + Math.cos(q.a) * R, q.y, tw.z + Math.sin(q.a) * R); if (!cold) { m.rotation.x += m.spin[0] * dt; m.rotation.y += m.spin[1] * dt; m.rotation.z += m.spin[2] * dt; } if (Math.abs(gap) < 0.09 && q.lane === this.lane) { this.throwOff(true); return; } if (gap > 0.14 && gap < 1.5) { this.D.ctx.scene.remove(m); m.traverse((o) => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } }); this.junk.splice(i, 1); continue; } near[q.lane] = Math.min(near[q.lane], -gap); }
    if (this.gauge) { const z = this.zone; this.zoneEl.style.left = ((0.5 - z) * 100).toFixed(1) + '%'; this.zoneEl.style.width = (z * 200).toFixed(1) + '%'; this.zoneEl.style.background = cold ? '#7fd8ff' : '#49d65a'; this.needleEl.style.left = (this.needle * 100).toFixed(1) + '%'; this.labelEl.textContent = 'TORNADO ' + Math.ceil(Math.max(0, e.heroHp)) + '%'; this.frzBtn.style.opacity = this.frzCd > 0 ? '0.45' : '1'; }
    if (this.dots) for (let i = 0; i < 3; i++) { const el = this.dots.children[2 - i], danger = near[i] < 1.7, soon = near[i] < 0.9; el.style.background = i === this.lane ? (danger ? '#ff3b6a' : '#ff5ad5') : danger ? (soon ? '#ff3b3b' : 'rgba(255,90,60,.55)') : 'rgba(10,8,20,.5)'; el.style.borderColor = danger ? '#ffd0c0' : 'rgba(255,255,255,.5)'; }
  }
  // from outside the ring and a little behind her, a wide lens, the funnel filling the middle: this also keeps the turning of the world behind it down
  cam(dt, cam, snap) {
    if (Math.abs(cam.fov - 58) > 0.02) { cam.fov += (58 - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); } const F = this.F, tw = this.tw, thrown = this.phase === 'thrown', R = this.radius; F.ctx.post.opts.dof = false; cam.up.set(0, 1, 0);
    if (thrown) { const k = 1 - Math.exp(-dt * 4), a = this.a; cam.position.x += (F.pos.x + Math.cos(a) * 34 - cam.position.x) * k; cam.position.y += (F.pos.y + 9 - cam.position.y) * k; cam.position.z += (F.pos.z + Math.sin(a) * 34 - cam.position.z) * k; cam.lookAt(F.pos.x, F.pos.y, F.pos.z); return true; }
    this.camK = snap ? 1 : Math.min(1, (this.camK || 0) + dt / 1.1); const k = this.camK * this.camK, ca = this.a + 0.25, cr = R + 58; cam.position.x += (tw.x + Math.cos(ca) * cr - cam.position.x) * k; cam.position.y += (58 - cam.position.y) * k; cam.position.z += (tw.z + Math.sin(ca) * cr - cam.position.z) * k; cam.lookAt(tw.x + Math.cos(this.a) * R * 0.7, 44, tw.z + Math.sin(this.a) * R * 0.7); return true;
  }
}
