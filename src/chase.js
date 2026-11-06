// Destroy's chasers (Sean, HERO-PLAN: jets and heroes chasing you, with mini games to shake them). The more you wreck, the hotter
// it gets: at each peak two jets or a hero come after you, by turns. JETS sit on your tail and fire: a lock comes up as a red ring
// closing on a green mark; tap as it meets the mark and you barrel-roll clear (the bolt flies on into the town), early or late and it
// hits. Dodge three, or keep under the roofs (22 m) for 4 s, and they lose you. A HERO closes in behind you: arrows come up one by one,
// swipe each way in time (never down: a tablet takes a swipe down as leaving full screen) and you juke them into a building; miss and
// they land a punch, drop back and come again. Shaking either off is worth points. Paused while she is not flying (a street fight, the lair).
import * as THREE from 'three';
import { sfx } from './audio.js';
import { buildVehicle } from './vehicles.js';
import { detail } from './villains.js';

const CSS = `#zd-chase{position:fixed;left:50%;transform:translateX(-50%);top:calc(48px + env(safe-area-inset-top));z-index:33;max-width:230px;padding:5px 10px;border-radius:10px;background:rgba(48,10,10,.85);color:#fff;font:800 12px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;display:none}
#zd-chase small{display:block;font-weight:600;opacity:.85}
#zd-qte{position:fixed;left:0;right:0;top:0;bottom:0;z-index:34;display:none;touch-action:none;font-family:system-ui,sans-serif}
#zd-qte .mk{position:absolute;left:50%;top:42%;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:6px solid rgba(80,255,120,.95);box-shadow:0 0 18px rgba(80,255,120,.7);box-sizing:border-box}
#zd-qte .rg{position:absolute;left:50%;top:42%;border-radius:50%;border:5px solid #ff5040;box-shadow:0 0 14px #ff5040;box-sizing:border-box}
#zd-qte .ar{position:absolute;left:50%;top:42%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:24px;background:rgba(30,20,60,.85);border:3px solid #ffd27a;color:#ffd27a;font:900 70px/114px system-ui,sans-serif;text-align:center;box-sizing:border-box}
#zd-qte .bar{position:absolute;left:50%;top:calc(42% + 72px);width:120px;height:8px;margin-left:-60px;border-radius:4px;background:rgba(255,255,255,.2);overflow:hidden}
#zd-qte .bar i{display:block;height:100%;background:#ffd27a}
#zd-qte .tx{position:absolute;left:0;right:0;top:calc(42% + 92px);text-align:center;color:#fff;font:900 17px system-ui,sans-serif;text-shadow:0 2px 6px #000}`;
const ARROWS = { left: '←', right: '→', up: '↑' }, LOW = 22, GREEN = [0.78, 1.25]; // the ring's size against the mark's that counts as on it
export class Chase {
  constructor(M, o) {
    this.M = M; this.g = M.g; this.F = M.g.flight; this.HS = o.HS; this.rigFor = o.rigFor; this.S = this.g.disasters.ctx.scene; this.on = null; this.n = 0; this.cool = 20; this.last = performance.now(); this.base = 0;
    if (!document.getElementById('zd-chase-css')) { const c = document.createElement('style'); c.id = 'zd-chase-css'; c.textContent = CSS; document.head.appendChild(c); }
    this.st = document.createElement('div'); this.st.id = 'zd-chase'; document.body.appendChild(this.st);
    this.q = document.createElement('div'); this.q.id = 'zd-qte'; document.body.appendChild(this.q); this.q.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.qDown(e); }); this.q.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); this.qUp(e); });
  }
  status(a, b) { this.st.style.display = a ? 'block' : 'none'; if (a) this.st.innerHTML = a + (b ? '<small>' + b + '</small>' : ''); }
  // the heat (step): every few buildings down, the next of them comes, a while after the last
  step(stats) {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000), F = this.F; this.last = now; this.stats = stats; if (this.g.paused) return;
    const flying = F.active && F.state === 'fly' && !F.fighting && !F.goBase; if (!flying) { this.qHide(); this.hideAll(!F.active); return; } this.showAll();
    if (!this.on) { this.cool -= dt; const R = this.M.round, every = Math.max(5, Math.round((R && R.need ? R.need : 24) / 4)), heat = stats.buildings - this.base; this.status(heat > 0 ? 'HEAT ' + Math.min(100, Math.round(heat / every * 100)) + '%' : '', heat > 0 ? 'Wreck more and they come for you' : ''); if (heat >= every && this.cool <= 0) { this.base = stats.buildings; this.start(this.n++ % 2 ? 'hero' : 'jets'); } return; }
    if (this.on.kind === 'jets') this.jetsStep(dt); else this.heroStep(dt); this.qStep(dt);
  }
  // ---------- the jets
  start(kind) {
    const F = this.F, back = this.behind(140); if (kind === 'hero') { const ids = Object.keys(this.HS.load().chars).filter((id) => this.HS.load().chars[id].side === 'hero'); if (!ids.length || !this.rigFor) kind = 'jets'; else { const id = ids[Math.floor(Math.random() * ids.length)], nm = this.HS.name(id), r = this.rigFor(nm, this.HS.outfit(nm)); r.root.rotation.order = 'YXZ'; r.root.position.copy(back); this.S.add(r.root); this.on = { kind, r, name: this.HS.shown(id), x: back.x, y: back.y, z: back.z, next: 2.5, tries: 0 }; F.bigText(this.on.name.toUpperCase() + ' IS ON YOUR TAIL!', '#7fd8ff', 1.8); sfx('whoosh', back.x, back.y, back.z, { gain: 1.2, rate: 0.7 }); this.status(this.on.name.toUpperCase() + ' ON YOUR TAIL', 'Swipe the arrows to shake them'); return; } }
    const jets = [-1, 1].map((s) => { const o = buildVehicle('a10'); o.scale.setScalar(1.15); o.position.copy(back).addScaledVector(this.side(), s * 10); this.S.add(o); return { o, s }; });
    this.on = { kind: 'jets', jets, next: 3, dodged: 0, low: 0, bolts: [] }; F.bigText('JETS ON YOUR TAIL!', '#ff8a7a', 1.8); sfx('horn', F.pos.x, F.pos.y, F.pos.z, { gain: 0.6 }); this.status('JETS ON YOUR TAIL', 'Dodge 3, or fly low through the streets');
  }
  fwd() { const F = this.F; return new THREE.Vector3(Math.cos(F.yaw), 0, -Math.sin(F.yaw)); } // flight.js: yaw 0 is +x, turning toward -z
  side() { const f = this.fwd(); return new THREE.Vector3(-f.z, 0, f.x); }
  behind(d, up = 6) { return this.F.pos.clone().addScaledVector(this.fwd(), -d).add(new THREE.Vector3(0, up, 0)); }
  jetsStep(dt) {
    const F = this.F, J = this.on, sd = this.side(), fw = this.fwd(), k = Math.min(1, dt * 1.6);
    for (const j of J.jets) { const want = this.behind(9, 5 + j.s * 0.5).addScaledVector(sd, j.s * 5.5); /* either side of her and a little behind, where the town camera sees them */ j.o.position.lerp(want, k); j.o.rotation.set(0, Math.atan2(fw.x, fw.z) - Math.PI / 2, j.s * 0.15); }
    // under the roofs, they lose her
    if (F.pos.y < LOW) { J.low += dt; if (J.low >= 4) { this.end('LOST THEM IN THE STREETS!', 600); return; } } else J.low = Math.max(0, J.low - dt * 0.5);
    this.status('JETS ON YOUR TAIL', J.low > 0 ? 'Stay low: ' + (4 - J.low).toFixed(1) + ' s' : 'Dodged ' + J.dodged + '/3 · or fly under ' + LOW + ' m');
    for (const b of J.bolts) { b.t += dt; b.m.position.lerpVectors(b.a, b.b(), Math.min(1, b.t / b.T)); if (b.t >= b.T && !b.done) { b.done = true; this.S.remove(b.m); const p = b.m.position; this.g.disasters.ctx.fire.burst(p.x, p.y, p.z, 10, 1.6); sfx('boom', p.x, p.y, p.z, { gain: 0.5 }); } } J.bolts = J.bolts.filter((b) => !b.done);
    if (!this.qOn && (J.next -= dt) <= 0) { J.next = 5; this.lockGo(); }
  }
  bolt(from, to, T) { const m = new THREE.Mesh(this.boltGeo || (this.boltGeo = new THREE.SphereGeometry(0.6, 10, 8)), this.boltMat || (this.boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.8, 0.4) }))); m.position.copy(from); this.S.add(m); const b = { m, a: from.clone(), b: to, t: 0, T, done: false }; this.on.bolts.push(b); return b; }
  // the lock: a red ring closing on the green mark over 1.3 s; tap as they meet
  lockGo() {
    const F = this.F, J = this.on, j = J.jets[Math.floor(Math.random() * J.jets.length)]; sfx('whoosh', j.o.position.x, j.o.position.y, j.o.position.z, { gain: 0.8, rate: 0.6 });
    this.qOn = { kind: 'lock', t: 0, T: 1.3, j }; this.q.innerHTML = '<div class="mk"></div><div class="rg"></div><div class="tx">MISSILE LOCK: TAP ON THE RING</div>'; this.q.style.display = 'block'; this.rg = this.q.querySelector('.rg');
  }
  lockSize(u) { return 280 - 240 * u; } // px across: 280 down to 40
  lockEnd(ok) {
    const F = this.F, J = this.on, Q = this.qOn; this.qHide(); if (!J || J.kind !== 'jets') return; const from = Q.j.o.position.clone();
    if (ok) { J.dodged++; F.roll = (F.roll || 0) + Math.PI * 2; F.bigText('BARREL ROLL!', '#9dffb0', 1); const past = F.pos.clone().addScaledVector(this.fwd(), 70).add(new THREE.Vector3(0, -F.pos.y + 2, 0)); this.bolt(from, () => past, 0.9); sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 1, rate: 1.2 }); if (J.dodged >= 3) { this.end('THEY BROKE OFF!', 500); } return; }
    const b = this.bolt(from, () => this.F.pos.clone(), 0.35); b.hit = true; setTimeout(() => { if (this.F.active) { this.F.damage(14, 'Hit by a jet!'); this.g.disasters.ctx.fire.burst(this.F.pos.x, this.F.pos.y, this.F.pos.z, 10, 1.6); } }, 350);
  }
  // ---------- the hero
  heroStep(dt) {
    const F = this.F, H = this.on, r = H.r, fw = this.fwd(), want = this.behind(this.qOn ? 4.5 : H.next > 0 ? 22 : 8, 1.2); H.x += (want.x - H.x) * Math.min(1, dt * 2); H.y += (want.y - H.y) * Math.min(1, dt * 2); H.z += (want.z - H.z) * Math.min(1, dt * 2);
    r.root.position.set(H.x, H.y, H.z); r.root.rotation.set(1.25, Math.atan2(fw.x, fw.z), 0); if (r.arms) for (const a of r.arms) { a.sh.rotation.set(-2.9, 0, a.sx * 0.15); a.el.rotation.set(0, 0, 0); } detail(r, null, true);
    if (H.swerve) { H.swerve.t += dt; const k = Math.min(1, H.swerve.t / 0.7); H.x += (H.swerve.x - H.x) * k; H.z += (H.swerve.z - H.z) * k; H.y += (H.swerve.y - H.y) * k; r.root.position.set(H.x, H.y, H.z); if (k >= 1) { const D = this.g.disasters; if (H.swerve.k >= 0 && !this.g.city.dead[H.swerve.k]) D.destroyBuilding(H.swerve.k, 'collapse', { spare: true }); D.ctx.fire.dustCloud(H.x, H.z, 8, 10); sfx('crash', H.x, H.y, H.z, { gain: 1.2, rate: 0.8 }); this.S.remove(r.root); this.on = null; this.reward('SHAKEN OFF!', 600); } return; }
    if (H.next > 0) { H.next -= dt; this.status(H.name.toUpperCase() + ' ON YOUR TAIL', H.tries ? 'Coming again...' : 'Closing in...'); return; }
    if (!this.qOn) this.jukeGo();
  }
  jukeGo() { const keys = Object.keys(ARROWS), seq = []; for (let i = 0; i < 3; i++) seq.push(keys[Math.floor(Math.random() * keys.length)]); this.qOn = { kind: 'juke', seq, i: 0, t: 0, T: 1.3 }; this.q.style.display = 'block'; this.jukeShow(); this.status(this.on.name.toUpperCase() + ' GRABS FOR YOU', 'Swipe the way the arrow points'); }
  jukeShow() { const Q = this.qOn; this.q.innerHTML = '<div class="ar">' + ARROWS[Q.seq[Q.i]] + '</div><div class="bar"><i></i></div><div class="tx">SWIPE! ' + (Q.i + 1) + '/3</div>'; this.barI = this.q.querySelector('.bar i'); Q.t = 0; }
  jukeEnd(ok) {
    const F = this.F, H = this.on; this.qHide(); if (!H || H.kind !== 'hero') return;
    if (ok) { let best = -1, bd = 1e9, bx = 0, bz = 0, by = 0; this.g.city.buildingsNear(H.x, H.z, 70, (k, d, b) => { if (this.g.city.dead[k]) return; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, dd = Math.hypot(cx - H.x, cz - H.z); if (dd < bd) { bd = dd; best = k; bx = cx; bz = cz; by = Math.min(H.y, b.baseY + (b.top - b.baseY) * 0.6); } }); H.swerve = best >= 0 ? { k: best, x: bx, z: bz, y: by, t: 0 } : { k: -1, x: H.x + this.side().x * 40, z: H.z + this.side().z * 40, y: 2, t: 0 }; F.bigText('JUKED!', '#9dffb0', 1); sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 1.1, rate: 1.3 }); return; }
    F.damage(16, 'Caught by ' + H.name + '!'); F.punch = 0.4; sfx('thud', F.pos.x, F.pos.y, F.pos.z, { gain: 1 }); H.tries++; H.next = 4; F.bigText('CAUGHT!', '#ff8a7a', 1);
  }
  // ---------- the overlay: taps for the lock, swipes for the juke
  qDown(e) { this.qP = [e.clientX, e.clientY]; const Q = this.qOn; if (!Q || Q.kind !== 'lock') return; const s = this.lockSize(Math.min(1, Q.t / Q.T)) / 96; this.lockEnd(s >= GREEN[0] && s <= GREEN[1]); }
  qUp(e) { const Q = this.qOn; if (!Q || Q.kind !== 'juke' || !this.qP) return; const dx = e.clientX - this.qP[0], dy = e.clientY - this.qP[1]; this.qP = null; if (Math.hypot(dx, dy) < 30) return; const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'; if (dir !== Q.seq[Q.i]) { this.jukeEnd(false); return; } sfx('whoosh', this.F.pos.x, this.F.pos.y, this.F.pos.z, { gain: 0.6, rate: 1.5 + Q.i * 0.2 }); Q.i++; if (Q.i >= Q.seq.length) this.jukeEnd(true); else this.jukeShow(); }
  qStep(dt) { const Q = this.qOn; if (!Q) return; Q.t += dt; if (Q.kind === 'lock') { const u = Math.min(1, Q.t / Q.T), s = this.lockSize(u); this.rg.style.width = this.rg.style.height = s + 'px'; this.rg.style.margin = (-s / 2) + 'px 0 0 ' + (-s / 2) + 'px'; const on = s / 96 >= GREEN[0] && s / 96 <= GREEN[1]; this.rg.style.borderColor = on ? '#7dff9a' : '#ff5040'; if (u >= 1) this.lockEnd(false); return; } this.barI.style.width = Math.max(0, 100 - Q.t / Q.T * 100) + '%'; if (Q.t >= Q.T) this.jukeEnd(false); }
  qHide() { this.qOn = null; this.q.style.display = 'none'; this.q.innerHTML = ''; }
  // ---------- shaken
  end(msg, pts) { const J = this.on; if (J && J.kind === 'jets') { for (const j of J.jets) this.S.remove(j.o); for (const b of J.bolts) this.S.remove(b.m); } this.on = null; this.qHide(); this.reward(msg, pts); }
  reward(msg, pts) { const F = this.F, W = F.storm && F.storm.war ? F.storm : null; if (W) W.score = (W.score || 0) + pts; F.bigText(msg + (W ? ' +' + pts : ''), '#ffd27a', 1.8); sfx('chime', F.pos.x, F.pos.y, F.pos.z, { gain: 0.9 }); this.cool = 15; this.status(''); }
  hideAll(gone) { const J = this.on; if (!J) return; if (J.kind === 'jets') for (const j of J.jets) j.o.visible = false; else J.r.root.visible = false; if (gone) this.st.style.display = 'none'; }
  showAll() { const J = this.on; if (!J) return; if (J.kind === 'jets') for (const j of J.jets) j.o.visible = true; else J.r.root.visible = true; }
  dispose() { const J = this.on; if (J) { if (J.kind === 'jets') { for (const j of J.jets) this.S.remove(j.o); for (const b of J.bolts) this.S.remove(b.m); } else this.S.remove(J.r.root); } this.on = null; this.st.remove(); this.q.remove(); }
}
