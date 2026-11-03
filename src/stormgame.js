// Defend's weather levels (Sean; HERO-PLAN 12d): powers alone do not stop the weather. Glowing spots round the town are the jobs: Lock on flies her to the
// nearest, and a tap in the green of the gauge does it. Flood: lift stranded buses onto roofs. Dust storm: blow out the dust devils. Tsunami: raise ice
// walls ahead of the wave. Cold wave: thaw the people frozen in the streets. The last job ends the disaster; the storm is slowed so there is time, and if it
// runs its course anyway the level ends as it always did. The tornado has its own game (windgame.js).
import * as THREE from 'three';
import { sfx } from './audio.js';
import { LAB } from './lab.js';
import { finish } from './heropower.js';

const KINDS = {
  flood: { n: 5, col: [3, 2.3, 0.3], act: '🚌 LIFT IT', noun: 'buses lifted', go: 'Lock on: stranded buses need lifting onto the roofs', how: 'lift the stranded buses' },
  haboob: { n: 5, col: [3, 1.5, 0.4], act: '🌬 BLOW IT OUT', noun: 'dust devils out', go: 'Lock on: blow out the dust devils to break the storm', how: 'blow out the dust devils' },
  tsunami: { n: 4, col: [0.4, 2.2, 3], act: '❄ ICE WALL', noun: 'ice walls up', go: 'Lock on: raise ice walls ahead of the wave', how: 'raise the ice walls' },
  coldwave: { n: 5, col: [3, 1, 0.3], act: '🔥 THAW', noun: 'streets thawed', go: 'Lock on: thaw the people frozen in the streets', how: 'thaw the frozen streets' },
};
const box = (x, y, z, c) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
function busMesh() { const g = new THREE.Group(), b = box(11, 3.4, 3.2, '#e8b52a'); b.position.y = 1.9; const w = box(9.6, 1, 3.3, '#27303a'); w.position.y = 2.6; g.add(b, w); return g; }

export class StormGame {
  constructor(F, e) {
    this.F = F; this.e = e; this.K = KINDS[e.type]; this.t = 0; this.done = 0; this.spots = []; this.cur = null; this.row = null; this.nt = 0; this.tweens = []; this.built = []; this.ready = false;
    if (e.type === 'flood') e.hold = 1e6; else if (e.sw) e.sw.speed *= e.type === 'tsunami' ? 0.3 : 0.45;
    F.tip(this.K.go);
  }
  get D() { return this.F.g.disasters; }
  get left() { return this.spots.filter(s => !s.done && !s.lost).length; }
  label() { return this.done + ' of ' + this.spots.length + ' ' + this.K.noun; }
  // the jobs: a devil moves, the others stay put
  place() {
    const g = this.F.g, e = this.e, P = g.people, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, R = Math.min(B.x1 - B.x0, B.z1 - B.z0) * 0.42, n = this.K.n;
    if (e.type === 'haboob') { for (const v of e.devils.list.slice(0, n)) this.spots.push({ devil: v, get x() { return v.x; }, get z() { return v.z; } }); }
    else if (e.type === 'tsunami') { const sw = e.sw, B0 = Math.min(B.x1 - B.x0, B.z1 - B.z0) * 0.8; for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * (B0 / n), along = sw.extent * 0.3 + Math.random() * 30; this.spots.push({ along, x: sw.origin.x + sw.dir.x * along + sw.tan.x * off, z: sw.origin.y + sw.dir.y * along + sw.tan.y * off }); } }
    else for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * 0.5, r = R * (0.45 + Math.random() * 0.55), q = P.snapWalkable(cx + Math.cos(a) * r, cz + Math.sin(a) * r, 60) || [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; const s = { x: q[0], z: q[1] }; if (e.type === 'flood') { s.bus = busMesh(); s.bus.rotation.y = Math.random() * 3; s.bus.position.set(s.x, P.groundY(s.x, s.z), s.z); this.D.ctx.scene.add(s.bus); } this.spots.push(s); }
    const col = new THREE.Color(...this.K.col); this.geo = new THREE.CylinderGeometry(1.4, 1.4, 150, 8, 1, true).translate(0, 75, 0); this.mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    for (const s of this.spots) { s.m = new THREE.Mesh(this.geo, this.mat); s.m.frustumCulled = false; s.m.renderOrder = 6; this.D.ctx.scene.add(s.m); }
    this.ready = true;
  }
  // Lock on: to the nearest job left
  lockOn() { const F = this.F; if (!this.ready) return; let b = null, bd = 1e9; for (const s of this.spots) { if (s.done || s.lost) continue; const d = Math.hypot(s.x - F.pos.x, s.z - F.pos.z); if (d < bd) { bd = d; b = s; } } if (!b) return; this.closeUi(); F.lockHint = false; F.engaged = null; const G = this, gy = () => F.g.people.groundY(b.x, b.z); F.lock = { storm: G, spot: b, name: 'the job', get x() { return b.x; }, get z() { return b.z; }, get y() { return gy() + 12; }, get gone() { return b.done || b.lost; } }; F.tip('Flying there: ' + this.left + ' left'); sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 0.8 }); }
  arrive(s) { this.nt = Math.random() * 0.4; this.ui(); this.cur = s; this.F.tip('Tap in the green'); }
  ui() {
    const F = this.F; this.closeUi(); if (!F.bar) return; const row = this.row = document.createElement('div'); row.dataset.storm = '1'; row.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:4px';
    row.innerHTML = '<div style="position:relative;height:26px;border-radius:8px;background:rgba(10,8,20,.82);border:1px solid rgba(255,255,255,.3);overflow:hidden;pointer-events:none"><i style="position:absolute;top:0;bottom:0;left:39%;width:22%;background:#49d65a"></i><b style="position:absolute;top:0;bottom:0;width:5px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff"></b></div><button type="button" class="zd-btn use" data-storm-act style="padding:18px 2px;font-size:16px;touch-action:none;width:100%">' + this.K.act + '</button>';
    this.needle = row.querySelector('b'); const q = row.querySelector('button'); q.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.tap(); }); q.addEventListener('click', (e) => e.stopPropagation()); F.bar.insertBefore(row, F.bar.firstChild);
  }
  closeUi() { if (this.row) { this.row.remove(); this.row = null; } this.cur = null; }
  get pos() { const u = this.nt % 2; return u < 1 ? u : 2 - u; }
  tap() { const s = this.cur, F = this.F; if (!s) return; if (Math.abs(this.pos - 0.5) <= 0.11) this.job(s); else { F.tip('Missed the green: again'); F.punch = 0.2; sfx('thud', F.pos.x, F.pos.y, F.pos.z, { gain: 0.5 }); } }
  // the job, done
  job(s) {
    const F = this.F, g = F.g, D = this.D, e = this.e, P = g.people, S = D.ctx.scene; s.done = true; this.done++; this.closeUi(); if (s.m) { S.remove(s.m); s.m = null; } F.punch = 0.4; g.shake = Math.max(g.shake || 0, 0.3); const gy = P.groundY(s.x, s.z); D.brawl.stunts.ring(s.x, gy + 4, s.z, 16, 0.5, new THREE.Color(...this.K.col), 0.8);
    if (e.type === 'flood') { let to = null, bd = 1e9; g.city.buildingsNear(s.x, s.z, 80, (k, d, b) => { if (b.roofY > 40) return; const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, q = Math.hypot(x - s.x, z - s.z); if (q < bd) { bd = q; to = [x, b.roofY + 0.2, z]; } }); this.tweens.push({ o: s.bus, a: s.bus.position.clone(), b: to ? new THREE.Vector3(to[0], to[1], to[2]) : s.bus.position.clone().setY(gy + 14), t: 0 }); LAB.stats.saved = (LAB.stats.saved || 0) + 12; sfx('whoosh', s.x, gy, s.z, { gain: 0.9 }); F.tip('Bus safe on a roof! ' + this.left + ' left'); }
    else if (e.type === 'haboob') { const v = s.devil, L = e.devils.list, i = L.indexOf(v); if (i >= 0) L.splice(i, 1); v.m.visible = false; S.remove(v.m); g.fire.dustCloud(s.x, s.z, 8, 30); e.sw.speed *= 0.85; sfx('whoomph', s.x, gy, s.z, { gain: 1 }); F.tip('Dust devil out! ' + this.left + ' left'); }
    else if (e.type === 'tsunami') { const w = box(70, 22, 5, '#a8e4ff'); w.material.transparent = true; w.material.opacity = 0.85; w.material.emissive = new THREE.Color('#2a7fb0'); w.position.set(s.x, gy + 9, s.z); w.rotation.y = -Math.atan2(e.sw.tan.y, e.sw.tan.x); S.add(w); this.built.push(w); e.sw.speed *= 0.65; sfx('glass', s.x, gy, s.z, { gain: 1, rate: 0.7 }); F.tip('Ice wall up! ' + this.left + ' left'); }
    else { const n = P.thawNear(s.x, s.z, 34); g.fire.burst(s.x, gy + 3, s.z, 16, 2); LAB.stats.saved = (LAB.stats.saved || 0) + n; sfx('whoomph', s.x, gy, s.z, { gain: 1 }); F.tip((n ? n + ' people thawed! ' : 'This street is safe now. ') + this.left + ' left'); }
    if (!this.left) this.win();
  }
  win() { const F = this.F, e = this.e; if (!e.alive || this.won) return; this.won = true; if (e.type === 'flood') e.fall = 10; finish(e); if (e.type === 'tsunami') e.recedeT = 42; LAB.stats.stopped = (LAB.stats.stopped || 0) + 1; this.D.flash(0.2); F.tip('You stopped the ' + ({ flood: 'flood', haboob: 'dust storm', tsunami: 'tsunami', coldwave: 'cold wave' })[e.type] + '!'); if (F.onStopped) F.onStopped(e); }
  step(h) {
    const F = this.F, e = this.e; this.t += h; if (!this.ready && this.t > 0.2) this.place(); if (!this.ready) return;
    for (const q of this.tweens) { q.t = Math.min(1, q.t + h / 1.1); q.o.position.lerpVectors(q.a, q.b, q.t); q.o.position.y += Math.sin(q.t * Math.PI) * 18; } this.tweens = this.tweens.filter(q => q.t < 1);
    const P = F.g.people, wl = e.type === 'flood' ? e.level : -1;
    for (const s of this.spots) { if (s.done) continue; const gy = P.groundY(s.x, s.z); if (s.bus) s.bus.position.y = Math.max(gy, wl + 0.2) + Math.sin(this.t * 1.5 + s.x) * 0.12; if (s.along != null && !s.lost && e.sw && e.phase !== 'warn' && e.sw.t * e.sw.speed > s.along + 6 && e.sw.nearest && e.sw.nearest(s.x, s.z) < 0) { s.lost = true; if (s.m) { s.m.parent.remove(s.m); s.m = null; } F.tip('The wave got past that spot'); if (this.cur === s) this.closeUi(); } if (s.m) s.m.position.set(s.x, gy, s.z); }
    if (this.cur) { this.nt += h * 1.15; if (this.needle) this.needle.style.left = (this.pos * 100) + '%'; if (Math.hypot(this.cur.x - F.pos.x, this.cur.z - F.pos.z) > 30) this.closeUi(); else if (this.cur.devil) { F.pos.x += (this.cur.x - F.pos.x) * Math.min(1, h * 2); F.pos.z += (this.cur.z - F.pos.z) * Math.min(1, h * 2); } }
    if (!this.left && e.alive && e.type !== 'flood' && this.spots.length && this.done) this.win();
  }
  dispose() { const S = this.D.ctx.scene; this.closeUi(); for (const s of this.spots) { if (s.m) S.remove(s.m); if (s.bus) S.remove(s.bus); } for (const w of this.built) S.remove(w); this.built = []; this.spots = []; if (this.geo) this.geo.dispose(); if (this.mat) this.mat.dispose(); }
}
export const stormKinds = KINDS;
