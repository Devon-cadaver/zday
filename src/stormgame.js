// Defend's weather levels (Sean; HERO-PLAN 12d): powers alone do not stop the weather. Glowing spots round the town are the jobs: Lock on flies her to the
// nearest, and a tap in the green of the gauge does it. Flood: lift stranded buses onto roofs. Dust storm: blow out the dust devils. Tsunami: raise ice
// walls ahead of the wave. Cold wave: thaw the people frozen in the streets. The last job ends the disaster; the storm is slowed so there is time, and if it
// runs its course anyway the level ends as it always did. The tornado has its own game (windgame.js).
import * as THREE from 'three';
import { sfx } from './audio.js';
import { LAB } from './lab.js';
import { finish } from './heropower.js';
import { villainRig, detail } from './villains.js';
import { buildVehicle } from './vehicles.js';

const KINDS = {
  flood: { n: 5, col: [3, 2.3, 0.3], act: '🚌 LIFT IT', noun: 'buses lifted', go: 'Lock on: stranded buses need lifting onto the roofs', how: 'lift the stranded buses' },
  haboob: { n: 5, col: [3, 1.5, 0.4], act: '🌬 BLOW IT OUT', noun: 'dust devils out', go: 'Lock on: blow out the dust devils to break the storm', how: 'blow out the dust devils' },
  tsunami: { n: 4, col: [0.4, 2.2, 3], act: '❄ ICE WALL', noun: 'ice walls up', go: 'Lock on: raise ice walls ahead of the wave', how: 'raise the ice walls' },
  coldwave: { n: 5, col: [3, 1, 0.3], act: '🔥 THAW', noun: 'streets thawed', go: 'Lock on: thaw the people frozen in the streets', how: 'thaw the frozen streets' },
};
const box = (x, y, z, c) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
function busMesh() { const g = new THREE.Group(), b = box(11, 3.4, 3.2, '#e8b52a'); b.position.y = 1.9; const w = box(9.6, 1, 3.3, '#27303a'); w.position.y = 2.6; g.add(b, w); return g; }

export class StormGame {
  constructor(F, e, K) {
    this.F = F; this.e = e; this.K = K || KINDS[e.type]; this.t = 0; this.done = 0; this.spots = []; this.cur = null; this.row = null; this.nt = 0; this.tweens = []; this.built = []; this.ready = false;
    if (K) { /* Destroy's: it sets its own storm */ } else if (e.type === 'flood') e.hold = 1e6; else if (e.sw) e.sw.speed *= e.type === 'tsunami' ? 0.3 : 0.45;
    F.tip(this.K.go);
  }
  get D() { return this.F.g.disasters; }
  get left() { return this.spots.filter(s => !s.done && !s.lost).length; }
  label() { return this.done + ' of ' + this.spots.length + ' ' + this.K.noun; }
  pct() { return this.done / (this.spots.length || 1) * 100; }
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

// ---------- Destroy (Sean): the city for points. Whatever falls scores, faster chains multiply it. Wrecking fills the Storm meter, and in a weather level UNLEASH aims the
// weather; heroes and rescue squads come to undo it, the Defend jobs in reverse: each one finished weakens the storm, unless Lock on or a power stops them first.
const WAR = {
  tornado: { act: 'UNLEASH THE TORNADO', job: 'is calming the tornado', weather: 1 }, flood: { act: 'BREAK THE LEVEE', job: 'is lifting a bus', weather: 1 }, haboob: { act: 'BLIND THE ARMY', job: 'is blowing the dust away', weather: 1 },
  tsunami: { act: 'CALL THE WAVE', job: 'is raising an ice wall', weather: 1 }, coldwave: { act: 'SHATTER THE TOWN', job: 'is thawing a street', weather: 1 }, none: { act: '', job: 'is rescuing people' },
};
const SQUADS = ['ambulance', 'fire_truck', 'police_interceptor'];
export class StormWar extends StormGame {
  constructor(F, R) {
    const type = (R.allies || []).map(e => e.type).find(t => WAR[t]) || 'none', e = (R.allies || []).find(q => q.type === type) || null, W = WAR[type];
    super(F, e || { type }, { act: '✊ STOP THEM', noun: '', how: '', go: 'Wreck the town for points. Lock on stops the heroes and squads undoing it', col: [0.5, 1.4, 3] });
    this.war = true; this.R = R; this.type = type; this.W = W; this.e = e; this.score = 0; this.goal = R.need * 400; this.chain = 0; this.chainT = 0; this.mult = 1; this.meter = 0; this.strength = W.weather && e ? 100 : 0; this.jobT = 12; this.followT = 0; this.blindT = 0; this.shatterT = 0; this.sink = 0;
    const D = this.D; this.p0 = LAB.stats.buildings; this.b0 = D.stats.buildings; this.c0 = D.ctx.traffic.stats.wrecks || 0; if (e && type === 'flood') e.hold = 1e6;
    const col = new THREE.Color(...this.K.col); this.geo = new THREE.CylinderGeometry(1.4, 1.4, 150, 8, 1, true).translate(0, 75, 0); this.mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }); this.ready = true;
  }
  place() {}
  // flown through (flight.js burstOut): points by its height, times the chain, up on the screen
  smashed(hgt) { this.chain += 1; this.chainT = 5; this.mult = Math.min(10, 1 + Math.floor(this.chain / 2)); const pts = Math.round((100 + hgt * 20) / 50) * 50 * this.mult; this.score += pts; this.p0 += 1; this.b0 += 1; this.meter = Math.min(100, this.meter + 6); const big = hgt > 40; this.F.bigText('+' + pts.toLocaleString() + (this.mult > 1 ? '  x' + this.mult : '') + (big ? ' TOWER!' : ''), big ? '#ff7a3a' : '#ffd27a', 0.9); if (this.chain > 1 && this.chain % 5 === 0) this.F.tip(this.chain + ' IN A ROW!'); }
  lockOn() { if (!this.left) return false; return super.lockOn(); }
  label() { return 'SCORE ' + Math.round(this.score) + ' / ' + this.goal + (this.mult > 1 ? ' <b style="color:#ffd27a">x' + this.mult + '</b>' : '') + (this.W.weather ? ' &middot; storm ' + Math.round(this.strength) + '%' : '') + (this.left ? ' &middot; <b style="color:#9fd4ff">' + this.left + ' to stop</b>' : ''); }
  pct() { return Math.min(100, this.score / (this.goal || 1) * 100); }
  // the Unleash button, kept on the bar through the flight's restarts
  meterUi() { const F = this.F; if (!this.W.weather || !F.bar) return; if (!this.mb || !this.mb.isConnected) { const q = this.mb = document.createElement('button'); q.type = 'button'; q.dataset.unleash = '1'; q.className = 'zd-btn'; q.style.cssText = 'position:relative;overflow:hidden;width:100%;padding:11px 2px;margin-bottom:4px;font-size:13px;touch-action:none'; q.innerHTML = '<i style="position:absolute;left:0;top:0;bottom:0;background:rgba(255,190,60,.55)"></i><span style="position:relative"></span>'; q.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.unleash(); }); q.addEventListener('click', (ev) => ev.stopPropagation()); F.bar.insertBefore(q, F.bar.firstChild); this.mf = q.children[0]; this.ms = q.children[1]; } const full = this.meter >= 100; this.mf.style.width = Math.min(100, this.meter) + '%'; const t = full ? '⚡ ' + this.W.act : 'Storm meter ' + Math.floor(this.meter) + '%'; if (this.ms.textContent !== t) this.ms.textContent = t; this.mb.style.boxShadow = full ? '0 0 16px #ffd27a' : ''; }
  closeAll() { if (this.mb) { this.mb.remove(); this.mb = null; } if (this.coast) { this.coast.remove(); this.coast = null; } }
  near(n) { const g = this.F.g, c = g.city, p = this.F.pos, L = []; c.buildingsNear(p.x, p.z, 130, (k, d, b) => { if (!c.dead[k]) L.push([Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.z0 + b.z1) / 2 - p.z), k]); }); return L.sort((a, b) => a[0] - b[0]).slice(0, n).map(q => q[1]); }
  shatter(n) { const D = this.D; for (const k of this.near(n)) D.destroyBuilding(k, 'collapse', { spare: true, noCrush: true }); }
  restart() { const g = this.F.g, D = this.D, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, e = D.start(this.type, cx + (Math.random() - 0.5) * 120, cz + (Math.random() - 0.5) * 120, this.type === 'tornado' ? { life: 99999 } : { life: 99999, quiet: true }); if (e) { this.e = e; (this.R.allies = this.R.allies || []).push(e); if (this.type === 'flood') e.hold = 1e6; } return e; }
  unleash() {
    const F = this.F, g = F.g, D = this.D; if (this.meter < 100 || F.state !== 'fly') return; if (this.type === 'tsunami' && !(this.e && this.e.alive && this.e.phase !== 'recede')) { this.pickCoast(); return; } this.meter = 0; this.strength = Math.min(100, this.strength + 25); const fresh = this.broken || !(this.e && this.e.alive); this.broken = false; if (fresh) this.restart(); const e = this.e; if (!e) return; g.shake = Math.max(g.shake || 0, 0.8); D.flash(0.15); sfx('boom', F.pos.x, F.pos.y, F.pos.z, { gain: 1 });
    if (this.type === 'tornado') { e.tw.size = Math.min(3.2, e.tw.size + 0.35); this.followT = 12; F.tip('The tornado follows you: lead it through the town!'); }
    else if (this.type === 'flood') { e.maxL = Math.min(5, e.maxL + 1.1); D.weather.set('storm'); F.tip('The levee breaks! Deep water takes the buildings'); }
    else if (this.type === 'haboob') { this.blindT = 15; if (e.sw) e.sw.speed *= 1.25; this.shatter(3); F.tip('The army is blind in the dust: their shots stop'); }
    else if (this.type === 'tsunami') { e.sw.speed *= 1.5; F.tip('The wave surges!'); }
    else if (this.type === 'coldwave') { this.shatterT = 15; this.shatter(5); F.tip('Frozen solid: every building breaks in one hit'); }
  }
  pickCoast() { const F = this.F; if (this.coast) return; const r = this.coast = document.createElement('div'); r.style.cssText = 'display:flex;gap:4px;margin-bottom:4px'; [['South', 0], ['North', 1], ['East', 2], ['West', 3]].forEach(([n, i]) => { const q = document.createElement('button'); q.type = 'button'; q.className = 'zd-btn use'; q.dataset.coast = String(i); q.style.cssText = 'flex:1 1 0;padding:14px 0;font-size:13px;touch-action:none'; q.textContent = n; q.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.callWave(i); }); q.addEventListener('click', (ev) => ev.stopPropagation()); r.appendChild(q); }); F.bar.insertBefore(r, F.bar.firstChild); F.tip('Which coast does the wave come from?'); }
  callWave(side) { const F = this.F, D = this.D, g = F.g, B = g.city.bounds; if (this.coast) { this.coast.remove(); this.coast = null; } this.meter = 0; this.strength = Math.min(100, this.strength + 25); const e = D.start('tsunami', (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, { side, quiet: true, warn: 3 }); if (e) { this.e = e; (this.R.allies = this.R.allies || []).push(e); } g.shake = Math.max(g.shake || 0, 0.8); F.tip('Here it comes!'); }
  // someone comes to undo it
  newJob() {
    const F = this.F, g = F.g, P = g.people, S = this.D.ctx.scene, B = g.city.bounds, a = Math.random() * 6.283, r = Math.min(B.x1 - B.x0, B.z1 - B.z0) * (0.2 + Math.random() * 0.25), q = P.snapWalkable((B.x0 + B.x1) / 2 + Math.cos(a) * r, (B.z0 + B.z1) / 2 + Math.sin(a) * r, 60); if (!q) return;
    const s = { x: q[0], z: q[1], t: 0 }, gy = P.groundY(s.x, s.z), free = g.disasters.list.filter(e => e.alive && e.type === 'villains').flatMap(e => e.who).filter(w => !w.gone && !w.beaten && !w.gripped && !this.spots.some(o => o.who === w && !o.done && !o.lost));
    if (free.length && Math.random() < 0.6) { const w = free[Math.floor(Math.random() * free.length)]; s.who = w; s.T = 16; w.gripped = true; w.rig.root.visible = false; const rig = villainRig(w.name, undefined, true); rig.root.position.set(s.x, gy + 5, s.z); S.add(rig.root); rig.root.updateMatrixWorld(true); rig.cape.update(0.1, 0.2, 0.3); rig.cape.update(0.03, 0.2, 0.3); detail(rig, null, true); s.bus = rig.root; F.tip(w.name + ' ' + this.W.job + '! Lock on to stop them'); }
    else { s.T = 22; const v = buildVehicle(SQUADS[Math.floor(Math.random() * SQUADS.length)]); v.scale.setScalar(1.6); v.position.set(s.x, gy, s.z); v.rotation.y = Math.random() * 6.28; S.add(v); s.bus = v; F.tip('A rescue squad is at work! Stop them, or Lock on'); }
    s.m = new THREE.Mesh(this.geo, this.mat); s.m.frustumCulled = false; s.m.renderOrder = 6; s.m.position.set(s.x, gy, s.z); S.add(s.m); this.spots.push(s);
  }
  drop(s) { const S = this.D.ctx.scene; if (s.m) { S.remove(s.m); s.m = null; } if (s.bus) { S.remove(s.bus); s.bus = null; } if (s.who) { s.who.gripped = false; s.who.rig.root.visible = true; s.who.x = s.x; s.who.z = s.z; } if (this.cur === s) this.closeUi(); }
  // stopped, by the gauge or by powers
  job(s) { const F = this.F, g = F.g; if (s.done || s.lost) return; s.done = true; this.drop(s); g.fire.burst(s.x, g.people.groundY(s.x, s.z) + 3, s.z, 14, 2); F.punch = 0.4; g.shake = Math.max(g.shake || 0, 0.4); sfx('crash', s.x, 2, s.z, { gain: 0.9 }); if (s.who) { const lvl = LAB.villain || 1, mx = 180 + 70 * lvl; s.who.fightHp = Math.max(mx * 0.3, (s.who.fightHp ?? mx) - 60); } this.score += s.who ? 500 : 300; this.meter = Math.min(100, this.meter + 20); F.tip(s.who ? s.who.name + ' stopped! +500' : 'Rescue squad stopped! +300'); }
  hit(s) { s.hits = (s.hits || 0) + 1; if (s.hits >= 3) this.job(s); else this.F.tip((s.who ? s.who.name : 'The squad') + ' hit: ' + (3 - s.hits) + ' more'); }
  // they got it done
  undone(s) { const F = this.F; s.lost = true; this.drop(s); if (this.W.weather && this.e && this.e.alive) { this.strength = Math.max(0, this.strength - 25); F.tip((s.who ? s.who.name : 'The squad') + ' weakened your storm! ' + this.strength + '% left'); if (this.strength <= 0) { this.broken = true; finish(this.e); F.tip('Your storm is broken. Fill the meter and bring it back'); } } else { this.score = Math.max(0, this.score - 200); F.tip('They got people out: -200'); } }
  step(h) {
    const F = this.F, g = F.g, D = this.D, e = this.e; this.t += h;
    const db = D.stats.buildings - this.b0, dc = (D.ctx.traffic.stats.wrecks || 0) - this.c0; this.b0 = D.stats.buildings; this.c0 = D.ctx.traffic.stats.wrecks || 0;
    { const mine = Math.min(db, LAB.stats.buildings - this.p0); this.p0 = LAB.stats.buildings; if (mine > 0) { this.chain += mine; this.chainT = 5; this.mult = Math.min(10, 1 + Math.floor(this.chain / 2)); this.score += 100 * mine * this.mult; } /* yours chain; what the storm brings down scores half, no chain */ if (db > mine) this.score += 50 * (db - mine); } if (db > 0) this.meter = Math.min(100, this.meter + db * 6); if (dc > 0) { this.score += 25 * dc; this.meter = Math.min(100, this.meter + dc * 1.5); }
    if (this.chainT > 0 && (this.chainT -= h) <= 0) { this.chain = 0; this.mult = 1; }
    if (this.followT > 0 && e && e.tw) { this.followT -= h; if (this.followT > 0) e.tw.steer(F.pos.x + Math.cos(F.yaw) * 50, F.pos.z - Math.sin(F.yaw) * 50); else e.tw.steerT = null; }
    if (this.blindT > 0) { this.blindT -= h; const A = F.army; if (A) { A.fireT = Math.max(A.fireT, 2); for (const q of A.helis) q.shot = Math.max(q.shot, 2); } }
    if (this.shatterT > 0) this.shatterT -= h;
    if (this.type === 'flood' && e && e.alive && e.level >= 2.5) { const c = g.city; this.sink += h * (e.level - 1.5) * 0.15; while (this.sink > 0.5) { this.sink -= 0.5; let best = -1, bh = 1e9; for (let n = 0; n < 12; n++) { const k = Math.floor(Math.random() * c.buildings.length); if (c.dead[k]) continue; const b = c.buildings[k], hg = b.top - b.baseY; if (hg < bh) { bh = hg; best = k; } } if (best >= 0 && bh <= e.level * 3 + 4) D.destroyBuilding(best, 'collapse', { spare: true, noCrush: true }); } }
    if ((this.jobT -= h) <= 0 && this.left < 2) { this.jobT = 16; this.newJob(); } else if (this.jobT <= 0) this.jobT = 3;
    for (const s of this.spots) { if (s.done || s.lost) continue; s.t += h; if (s.who && s.bus) { s.bus.rotation.y += h; } if (s.t >= s.T) this.undone(s); }
    if (this.cur) { this.nt += h * 1.15; if (this.needle) this.needle.style.left = (this.pos * 100) + '%'; if (Math.hypot(this.cur.x - F.pos.x, this.cur.z - F.pos.z) > 30) this.closeUi(); }
    this.meterUi();
  }
  dispose() { for (const s of this.spots) if (!s.done && !s.lost) { s.lost = true; this.drop(s); } this.closeAll(); super.dispose(); }
}
