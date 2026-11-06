// Free flight after a win (Sean, 2026-11-05): a third choice on the win card, FLY AROUND TOWN. Fly where you like, and pick
// something to do from the row over the flight bar: RINGS (a course of glowing rings over the town against the clock, the
// best time kept for each town), FIRES (five buildings alight: fly in close over one and she hoses it down), CATS (cats stuck
// on roofs: fly by one to pick it up, take it down to the green light), REBUILD (the town's fallen buildings: hover by a site
// and its crew builds ten times as fast), BAND (sit in with the band as its singer: the band game, rhythm.js). The flight
// bar's BASE flies home and in (flight.baseRun), as Back to base does. Each thing done is worth a little XP.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { Site } from './rebuild.js';
import { PLACES, placeKey } from './places.js';

const CSS = `
#zd-free{position:fixed;left:8px;right:8px;z-index:31;display:flex;gap:5px;justify-content:center;pointer-events:none;font-family:system-ui,-apple-system,sans-serif}
#zd-free button{pointer-events:auto;flex:1 1 0;max-width:86px;min-height:46px;padding:4px 2px;border:1px solid rgba(255,255,255,.3);border-radius:12px;background:rgba(22,18,40,.82);color:#fff;font:800 11px/1.15 system-ui,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.35)}
#zd-free button b{display:block;font-size:17px;line-height:1.1}
#zd-free button.on{background:linear-gradient(#ffb02e,#d9570f);border-color:#ffe27a}
#zd-free-st{position:fixed;left:50%;transform:translateX(-50%);top:calc(48px + env(safe-area-inset-top));z-index:31;max-width:200px;padding:5px 10px;border-radius:10px;background:rgba(16,12,30,.78);color:#fff;font:800 12px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none}
#zd-free-st small{display:block;font-weight:600;opacity:.8}
`;
const ACTS = [['rings', '🎯', 'Rings'], ['fires', '🔥', 'Fires'], ['cats', '🐱', 'Cats'], ['rebuild', '🏗', 'Rebuild'], ['band', '🎸', 'Band']];
const BEST = 'zday_rings';
const fmt = (t) => Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
const glowM = (c, op = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, fog: false });
// a beam of light standing over something to find, seen from across the town
function beam(c, h = 90) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, h, 10, 1, true).translate(0, h / 2, 0), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.renderOrder = 6; return m; }
// a cat: body, head, ears, tail; twice life size so it can be seen from the air
function catModel(col) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1 }), box = (w, h, d, x, y, z, mt = m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  box(0.32, 0.28, 0.62, 0, 0.32, 0); box(0.3, 0.27, 0.27, 0, 0.55, 0.36); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), m); e.position.set(s * 0.09, 0.74, 0.36); g.add(e); box(0.07, 0.2, 0.07, s * 0.1, 0.1, 0.22); box(0.07, 0.2, 0.07, s * 0.1, 0.1, -0.22); box(0.04, 0.04, 0.02, s * 0.07, 0.58, 0.5, dark); }
  const tail = box(0.06, 0.06, 0.5, 0, 0.5, -0.5); tail.rotation.x = -0.8; g.userData.tail = tail; g.scale.setScalar(2); return g;
}
export class FreeFly {
  constructor(M, o) { this.M = M; this.g = M.g; this.HS = o.HS; this.rigFor = o.rigFor; this.active = false; }
  // up over where the fight ended
  start(at) {
    const g = this.g, C = g.city.bounds, x = at ? at[0] : (C.x0 + C.x1) / 2, z = at ? at[2] : (C.z0 + C.z1) / 2, y = Math.max(at ? at[1] : 40, g.people.groundY(x, z) + 8);
    if (!document.getElementById('zd-free-css')) { const c = document.createElement('style'); c.id = 'zd-free-css'; c.textContent = CSS; document.head.appendChild(c); }
    this.active = true; this.leaving = false; this.act = null; this.town = PLACES[placeKey()] ? PLACES[placeKey()].name : 'the town'; this.fly(x, y, z); this.ui(); this.last = performance.now(); const loop = () => { if (!this.active) return; this.tick(); this.raf = requestAnimationFrame(loop); }; loop();
    this.status('FREE FLIGHT', 'Pick something to do, or just fly. BASE goes home');
  }
  fly(x, y, z) {
    const g = this.g, F = g.flight; F.owner = { baseArrive: () => this.home() }; F.heroGame = true; F.inLevel = true; F.homing = true /* no TEAM buttons (heropower teamUiStep): no one to fight */; F.start(this.HS.load()[this.M.side].flyer); if (F.army) { F.army.dispose(); F.army = null; } F.onStopped = () => {};
    F.pos.set(x, y, z); F.pitch = 0; F.roll = 0; F.hovering = true; F.speed = F.thr = 0; F.snap = true; F.setView(F.view);
    if (F.lockBtn) F.lockBtn.style.display = 'none'; const q = F.bar && F.bar.querySelector('[data-f="exit"]'); if (q) q.style.display = 'none'; /* nothing to lock on to, and BASE is the way out */
    F.tip('Free flight over ' + this.town + ': drag to fly, BOOST to go fast');
  }
  ui() {
    const el = this.el = document.createElement('div'); el.id = 'zd-free'; el.innerHTML = ACTS.map(([k, ic, t]) => '<button type="button" data-a="' + k + '"><b>' + ic + '</b>' + t + '</button>').join(''); document.body.appendChild(el);
    el.querySelectorAll('[data-a]').forEach((b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.a; if (this.act === k) { this.clear(); this.status('FREE FLIGHT', 'Pick something to do, or just fly'); return; } this.go(k); }; });
    const st = this.stEl = document.createElement('div'); st.id = 'zd-free-st'; document.body.appendChild(st); this.place();
  }
  // just over the flight's bar
  place() { const F = this.g.flight; if (!this.el) return; const top = F.bar && F.bar.isConnected ? F.bar.getBoundingClientRect().top : innerHeight - 120; this.el.style.bottom = Math.max(8, innerHeight - top + 6) + 'px'; }
  status(a, b) { if (this.stEl) this.stEl.innerHTML = a + (b ? '<small>' + b + '</small>' : ''); }
  mark() { if (this.el) this.el.querySelectorAll('[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === this.act)); }
  go(k) {
    this.clear(); this.act = k; this.mark();
    if (k === 'rings') this.ringsGo(); else if (k === 'fires') this.firesGo(); else if (k === 'cats') this.catsGo(); else if (k === 'rebuild') this.rebuildGo(); else if (k === 'band') this.bandGo();
  }
  xp(n, what) { const s = this.HS.load()[this.M.side]; s.xp += n; this.HS.save(); const F = this.g.flight; if (F.active) F.bigText(what + ' +' + n + ' XP', '#ffd27a', 1.8); sfx('chime', F.pos.x, F.pos.y, F.pos.z, { gain: 0.9 }); }
  add(o) { this.g.disasters.ctx.scene.add(o); (this.objs = this.objs || []).push(o); return o; }
  // what the last thing left about: rings, cats, beams taken away; fires still burning put out; sites still going finished
  clear() {
    const g = this.g, S = g.disasters.ctx.scene, fire = g.disasters.ctx.fire, city = g.city;
    for (const o of this.objs || []) { S.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); }); } this.objs = [];
    if (this.fires) for (const f of this.fires.list) if (fire.bFire[f.k] === 1) fire.extinguish(f.k); this.fires = null;
    if (this.works) for (const w of this.works.list) if (w.s.alive) { if (w.s.phase === 'clear') city.clearRubble(w.s.k); w.s.finish(); } this.works = null;
    this.rings = null; this.cats = null; this.act = null; this.mark();
  }
  // ---------- each frame
  tick() {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000), g = this.g, F = g.flight; this.last = now;
    if (g.mode !== this.M) { this.end(); return; } // the menu or another mode took over
    if (!F.active || g.paused || this.leaving) return; this.place();
    if (this.rings) this.ringsStep(dt); if (this.fires) this.firesStep(dt); if (this.cats) this.catsStep(dt); if (this.works) this.worksStep(dt);
  }
  // ---------- rings: ten round the town at different heights, each facing the next; the next one gold with a beam over it
  ringsGo() {
    const g = this.g, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, R = Math.min(B.x1 - B.x0, B.z1 - B.z0) * 0.34, F = g.flight, N = 10, a0 = Math.atan2(F.pos.z - cz, F.pos.x - cx), pts = [];
    for (let i = 0; i < N; i++) { const a = a0 + i / N * Math.PI * 2, r = R * (0.72 + 0.28 * Math.sin(i * 1.7)); pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 26 + 24 * (0.5 + 0.5 * Math.sin(i * 2.3)), cz + Math.sin(a) * r)); }
    const list = pts.map((p, i) => { const m = this.add(new THREE.Mesh(new THREE.TorusGeometry(6, 0.5, 10, 40), glowM(new THREE.Color(0.5, 0.9, 1.6), 0.55))); m.position.copy(p); m.lookAt(pts[(i + 1) % N]); return { m, p, n: new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion) }; });
    this.rings = { list, i: 0, t: 0, on: false, beam: this.add(beam(new THREE.Color(1.6, 1.3, 0.4))) }; this.ringShow(); this.status('RINGS 0/' + N, 'Fly through the gold one');
  }
  ringShow() { const R = this.rings; R.list.forEach((q, i) => { const cur = i === R.i, nx = i === R.i + 1; q.m.visible = i >= R.i; q.m.material.color.set(cur ? new THREE.Color(2.2, 1.7, 0.4) : nx ? new THREE.Color(0.8, 1.2, 1.8) : new THREE.Color(0.4, 0.7, 1.2)); q.m.material.opacity = cur ? 0.95 : nx ? 0.6 : 0.3; }); const c = R.list[R.i]; if (c) R.beam.position.set(c.p.x, c.p.y + 7, c.p.z); }
  ringsStep(dt) {
    const R = this.rings, F = this.g.flight, c = R.list[R.i]; if (R.on) R.t += dt; if (!c) return; c.m.scale.setScalar(1 + 0.06 * Math.sin(performance.now() / 120));
    const rel = F.pos.clone().sub(c.p), along = rel.dot(c.n), rad = rel.clone().addScaledVector(c.n, -along).length();
    if (rad < 6.2 && Math.abs(along) < 3) { R.i++; R.on = true; sfx('chime', c.p.x, c.p.y, c.p.z, { gain: 0.8, rate: 1 + R.i * 0.05 }); this.g.disasters.brawl.stunts.ring(c.p.x, c.p.y, c.p.z, 7, 0.35, new THREE.Color(2, 1.6, 0.5), 0.8); this.ringShow();
      if (R.i >= R.list.length) { let best = {}; try { best = JSON.parse(localStorage.getItem(BEST) || '{}') || {}; } catch (e) { best = {}; } const k = placeKey(), was = best[k], nb = !was || R.t < was; if (nb) { best[k] = +R.t.toFixed(2); try { localStorage.setItem(BEST, JSON.stringify(best)); } catch (e) { /* not kept */ } } this.status('RINGS DONE ' + fmt(R.t), nb ? 'A new best for ' + this.town : 'Best ' + fmt(was)); const t = R.t; this.clear(); this.act = null; this.xp(40, nb && was ? 'NEW BEST ' + fmt(t) + '!' : 'RINGS ' + fmt(t)); return; } }
    this.status('RINGS ' + R.i + '/' + R.list.length + (R.on ? ' · ' + fmt(R.t) : ''), R.on ? 'Keep going' : 'Fly through the gold one to start the clock');
  }
  // ---------- fires: five buildings alight, apart from each other; in close over one (22 m across, up to 25 m over its roof) she hoses it down
  pickBuildings(n, ok, gap) { const g = this.g, c = g.city, B = c.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, R = Math.min(B.x1 - B.x0, B.z1 - B.z0) * 0.42, out = [], ks = []; for (let k = 0; k < c.buildings.length; k++) ks.push(k); for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
    for (const k of ks) { const b = c.buildings[k]; if (!b || !ok(k, b)) continue; const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2; if (Math.hypot(x - cx, z - cz) > R) continue; if (out.some((q) => Math.hypot(q.x - x, q.z - z) < gap)) continue; out.push({ k, b, x, z }); if (out.length >= n) break; } return out; }
  firesGo() {
    const g = this.g, fire = g.disasters.ctx.fire, c = g.city, list = this.pickBuildings(5, (k, b) => !c.dead[k] && fire.bFire[k] === 0 && b.top - b.baseY > 6, 40);
    if (!list.length) { this.status('FIRES', 'Nothing here will burn'); this.act = null; this.mark(); return; }
    for (const f of list) { fire.igniteBuilding(f.k); f.beam = this.add(beam(new THREE.Color(1.8, 0.6, 0.2))); f.beam.position.set(f.x, f.b.top + 4, f.z); }
    this.fires = { list, out: 0, sprayT: 0 }; this.status('FIRES 0/' + list.length, 'Fly in close over one to hose it down'); g.flight.tip('Fires! Fly in low over the orange lights');
  }
  firesStep(dt) {
    const g = this.g, F = g.flight, fire = g.disasters.ctx.fire, Fs = this.fires; let out = 0, near = null;
    for (const f of Fs.list) { if (fire.bFire[f.k] !== 1) { out++; if (f.beam.visible) { f.beam.visible = false; this.g.disasters.brawl.stunts.ring(f.x, f.b.top + 1, f.z, 8, 0.4, new THREE.Color(0.6, 1.2, 1.8), 0.7); sfx('chime', f.x, f.b.top, f.z, { gain: 0.6, rate: 1.3 }); } continue; } if (Math.hypot(F.pos.x - f.x, F.pos.z - f.z) < 22 && F.pos.y < f.b.top + 25) near = f; }
    if (near) { fire.douse(near.k, dt * 12); if ((Fs.sprayT -= dt) <= 0) { Fs.sprayT = 0.03; const D = g.disasters; for (let i = 0; i < 3; i++) { const s = 0.15 + Math.random() * 0.2, tx = near.x + (Math.random() - 0.5) * 8, tz = near.z + (Math.random() - 0.5) * 8, ty = near.b.top, T = 0.5; D.debris.add(F.pos.x, F.pos.y - 0.5, F.pos.z, s, s, s, Math.random() < 0.5 ? 0xbfe8ff : 0x7fc8ff, 'fly', { v: [(tx - F.pos.x) / T, (ty - F.pos.y) / T + 2.5, (tz - F.pos.z) / T], life: T }); } } }
    Fs.out = out; this.status('FIRES ' + out + '/' + Fs.list.length, near ? 'Hosing it down...' : 'Fly in close over one'); if (out >= Fs.list.length) { this.clear(); this.status('FIRES OUT', 'The town thanks you'); this.xp(40, 'ALL FIRES OUT!'); }
  }
  // ---------- cats: four on roofs; fly by one (within 6 m) and she has it; take it down to its green light (8 m across, under 12 m up)
  catsGo() {
    const g = this.g, c = g.city, P = g.people, cols = ['#e08a3a', '#2a2a2e', '#f2f0ea', '#8a8e96'], list = this.pickBuildings(4, (k, b) => !c.dead[k] && b.top - b.baseY > 10, 45);
    if (!list.length) { this.status('CATS', 'No roofs to get stuck on'); this.act = null; this.mark(); return; }
    list.forEach((q, i) => { q.cat = this.add(catModel(cols[i % cols.length])); q.cat.position.set(q.x, q.b.top, q.z); q.cat.rotation.y = Math.random() * 6.28; q.beam = this.add(beam(new THREE.Color(1.8, 1.5, 0.4), 60)); q.beam.position.set(q.x, q.b.top + 2, q.z); const p = P.snapWalkable(q.x, q.z + (q.b.z1 - q.b.z0) / 2 + 6, 30) || [q.x, q.z]; q.to = { x: p[0], z: p[1], y: P.groundY(p[0], p[1]) }; q.ring = this.add(new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 32).rotateX(-Math.PI / 2), glowM(new THREE.Color(0.4, 2, 0.6), 0.8))); q.ring.position.set(q.to.x, q.to.y + 0.08, q.to.z); q.ring.visible = false; q.gb = this.add(beam(new THREE.Color(0.4, 1.8, 0.5), 50)); q.gb.position.set(q.to.x, q.to.y, q.to.z); q.gb.visible = false; q.state = 'roof'; });
    this.cats = { list, held: null, done: 0 }; this.status('CATS 0/' + list.length, 'Stuck on roofs: follow the yellow lights'); g.flight.tip('Cats stuck on roofs! Fly by one to pick it up');
  }
  catsStep(dt) {
    const g = this.g, F = g.flight, C = this.cats, t = performance.now() / 1000;
    for (const q of C.list) { if (q.state === 'home') continue; q.cat.userData.tail.rotation.y = Math.sin(t * 4 + q.x) * 0.5; if (q.state === 'roof') { if (!C.held && F.pos.distanceTo(q.cat.position) < 6) { q.state = 'held'; C.held = q; q.beam.visible = false; q.ring.visible = true; q.gb.visible = true; F.bigText('GOT IT! TAKE IT DOWN', '#ffd27a', 1.4); sfx('chime', F.pos.x, F.pos.y, F.pos.z, { gain: 0.7, rate: 1.6 }); } continue; }
      if (q.state === 'held') { q.cat.position.set(F.pos.x, F.pos.y - 1.6, F.pos.z); q.cat.rotation.y = -F.yaw + Math.PI / 2; q.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 6)); if (Math.hypot(F.pos.x - q.to.x, F.pos.z - q.to.z) < 8 && F.pos.y - q.to.y < 12) { q.state = 'home'; C.held = null; C.done++; q.cat.position.set(q.to.x, q.to.y, q.to.z); q.ring.visible = false; q.gb.visible = false; g.disasters.brawl.stunts.ring(q.to.x, q.to.y + 0.5, q.to.z, 5, 0.4, new THREE.Color(0.6, 2, 0.8), 0.8); if (C.done < C.list.length) { F.bigText('HOME SAFE!', '#9dffb0', 1.2); sfx('chime', q.to.x, q.to.y, q.to.z, { gain: 0.8, rate: 1.2 }); } } } }
    this.status('CATS ' + C.done + '/' + C.list.length, C.held ? 'Down to the green light' : 'Follow the yellow lights'); if (C.done >= C.list.length) { this.clear(); this.status('CATS RESCUED', 'Every one home'); this.xp(40, 'ALL CATS HOME!'); }
  }
  // ---------- rebuild: up to three of the town's fallen buildings; hover by a site (35 m) and its crew works ten times as fast
  rebuildGo() {
    const g = this.g, c = g.city, D = g.disasters, F = g.flight, dead = []; for (let k = 0; k < c.buildings.length; k++) if (c.dead[k] && c.buildings[k]) dead.push(k);
    if (!dead.length) { this.status('REBUILD', 'Nothing has fallen here'); this.act = null; this.mark(); return; }
    const mid = (k) => { const b = c.buildings[k]; return Math.hypot((b.x0 + b.x1) / 2 - F.pos.x, (b.z0 + b.z1) / 2 - F.pos.z); }, ks = dead.sort((a, b) => mid(a) - mid(b)).slice(0, 3);
    const list = ks.map((k) => { const s = new Site(D, k, {}), bm = this.add(beam(new THREE.Color(0.5, 1.2, 2), 70)); bm.position.set(s.cx, c.buildings[k].baseY + 2, s.cz); return { s, bm }; });
    this.works = { list }; this.status('REBUILD 0/' + list.length, 'Hover by a blue light to help'); F.tip('Fallen buildings: hover by a site and the crew works fast');
  }
  worksStep(dt) {
    const F = this.g.flight, W = this.works; let done = 0, near = null;
    for (const w of W.list) { if (!w.s.alive) { done++; w.bm.visible = false; continue; } const n = Math.hypot(F.pos.x - w.s.cx, F.pos.z - w.s.cz) < 35; if (n) near = w; w.s.update(dt * (n ? 10 : 1)); if (n && Math.random() < dt * 6) this.g.disasters.brawl.stunts.ring(w.s.cx, F.pos.y - 2, w.s.cz, 3 + Math.random() * 4, 0.3, new THREE.Color(0.6, 1.3, 2), 0.5); }
    this.status('REBUILD ' + done + '/' + W.list.length, near ? Math.round(near.s.progress * 100) + '% up' : 'Hover by a blue light'); if (done >= W.list.length) { this.clear(); this.status('REBUILT', 'Good as new'); this.xp(40, 'TOWN REBUILT!'); }
  }
  // ---------- the band: the hero in the singer's place for the band game, then back up over the stage
  bandGo() {
    const g = this.g, BG = g.bandGame, B = BG && BG.band ? BG.band() : null, F = g.flight; if (!B) { this.status('BAND', 'There is no stage in this town'); this.act = null; this.mark(); return; }
    const vox = B.members.find((m) => m.role === 'vox'); if (vox && this.rigFor) { const nm = this.HS.curName(this.M.side), hr = this.rigFor(nm, this.HS.outfit(nm)); if (hr.cape && hr.cape.mesh) hr.cape.mesh.visible = false; hr.root.scale.copy(vox.r.root.scale); hr.root.position.copy(vox.r.root.position); hr.root.rotation.copy(vox.r.root.rotation); vox.r.root.parent.add(hr.root); vox.r.root.visible = false; this.swap = { vox, was: vox.r }; vox.r = hr; }
    const V = B.venue, at = [V.x, 40, V.z]; this.el.style.display = 'none'; this.stEl.style.display = 'none'; if (F.active) F.stop(true);
    BG.onStop = () => { const S = this.swap; if (S) { const hr = S.vox.r; if (hr.root.parent) hr.root.parent.remove(hr.root); S.vox.r = S.was; S.was.root.visible = true; this.swap = null; } if (!this.active || g.mode !== this.M) return; this.el.style.display = ''; this.stEl.style.display = ''; this.act = null; this.mark(); this.fly(at[0], at[1], at[2]); this.status('FREE FLIGHT', 'Encore any time'); };
    BG.start(); if (!BG.active) BG.onStop(); else this.status('ON STAGE', '');
  }
  // ---------- home: the BASE button's flight lands at the door
  home() {
    if (this.leaving) return; this.leaving = true; const g = this.g, F = g.flight; F.baseStop(); F.hovering = true; F.speed = F.thr = 0;
    const fd = document.createElement('div'); fd.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .22s;z-index:65;pointer-events:none'; document.body.appendChild(fd); requestAnimationFrame(() => { fd.style.opacity = '1'; });
    setTimeout(() => { this.end(); if (F.active) F.stop(true); F.heroGame = false; F.inLevel = false; F.homing = false; F.owner = this.M; if (g.mode === this.M) this.M.hub(); fd.style.transition = 'opacity .35s'; fd.style.opacity = '0'; setTimeout(() => fd.remove(), 400); }, 240);
  }
  end() { if (!this.active) return; this.active = false; this.g.flight.homing = false; cancelAnimationFrame(this.raf); this.clear(); if (this.el) this.el.remove(); if (this.stEl) this.stEl.remove(); this.el = this.stEl = null; const BG = this.g.bandGame; if (BG && BG.onStop && !BG.active) BG.onStop = null; }
}
