// The Faultline (Sean, 2026-11-05; its fight reworked 2026-11-15: "it should be more dynamic. maybe the player has to break off arms then its head
// before it falls and breaks into two smaller versions"). The earthquake level's boss: a giant of rock with lava in its cracks, 50 m tall
// (golemkit.js: A Basalt Brute in the Far Isles' towns, D Living Mountain everywhere else). It is broken apart a piece at a time: an arm, the
// other arm, then the head, each ringed in light while it is the one to break. Two ways to break the ringed piece:
//  - GRAB a boulder that is lying about and throw it back: it flies at the ring and knocks the piece off;
//  - or batter its feet (FOOT_NEED blows) until it buckles to its knees, and hit it while it is down (the ring turns green).
// A piece that comes off falls, flattens what it lands on and breaks into boulders to throw. What the giant does changes as it loses them: with
// both arms it throws boulders and stomps (a quake: a ring of broken ground rolls out; dash through it, or be far off); with one arm it also
// sweeps the street with it (a red fan first); with none it comes in close, stomps twice and spits lava rocks. Every stomp shakes a rock loose
// near her, so there is always something to throw. The head off, it falls and breaks in two: two of half the size with an arm each (the arm,
// then the head). Those break into four a quarter the size, which come at you and pound the ground (a red ring first) and are fought hand to
// hand; each crumbles into stone men that go down in one hit. Stone men also come up where a big one falls, but nothing waits for them.
// It runs inside the crowd fight (horde.js this.fl): stepped from there on foot and in the air, its giants framed by the camera (focus), blows
// reaching it (sweepHit), boulders grabbed (stoneNear) and thrown back (homing), the count kept open while any is left (giantsLeft).
import * as THREE from 'three';
import { golem, stoneGeo } from './golemkit.js';
import { sfx } from './audio.js';
import { ZTYPES } from './figures.js';

const STONEMAN = ZTYPES.findIndex((z) => z.id === 'stoneman'), ZOMBIE = 6, _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const AIRY = ['dodge', 'glide', 'jugUp', 'jugWait', 'jugFall', 'sig', 'liftoff']; // states a quake ring passes under
const FOOT_NEED = 7, KNEEL_T = 3.4, STONE_T = 20, STONES = 5;
let RING = null; const ringTex = () => { if (RING) return RING; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 52, 0, 6.3); x.stroke(); x.lineWidth = 4; x.globalAlpha = 0.6; x.beginPath(); x.arc(64, 64, 36, 0, 6.3); x.stroke(); return (RING = new THREE.CanvasTexture(c)); };
export class Faultline {
  constructor(H, o = {}) { this.H = H; this.g = H.g; this.S = H.g.disasters.ctx.scene; this.P = H.g.people; this.design = o.design || 'brute'; this.size0 = o.size || 50; this.tough = o.tough || 1; this.giants = []; this.stones = []; this.flying = []; this.waves = []; this.pieces = []; this.pending = []; this.all = []; this.t = 0; this.started = false; this.said = {}; this.busy = false; }
  say(k, txt, T = 1.6) { if (this.said[k]) return; this.said[k] = true; this.H.say(txt, T, '#ff9a3a'); }
  rockMat() { return this.rockM || (this.rockM = new THREE.MeshStandardMaterial({ color: this.design === 'mountain' ? '#6e6052' : '#2f2a28', roughness: 0.95, flatShading: true })); }
  lavaMat() { return this.lavaM || (this.lavaM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.75, 0.12) })); }
  mark(x, z, R, col = [2, 0.3, 0.2]) { const m = new THREE.Mesh(new THREE.RingGeometry(R * 0.82, R, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); m.position.set(x, this.P.groundY(x, z) + 0.12, z); this.S.add(m); return m; }
  // the red fan in front of it that its arm is about to sweep
  fan(q, R) { const m = new THREE.Mesh(new THREE.CircleGeometry(R, 28, -Math.PI / 2 - 1, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.3, 0.2), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })); m.position.set(q.x, this.P.groundY(q.x, q.z) + 0.2, q.z); m.rotation.y = q.yaw; this.S.add(m); return m; }
  unmark(m) { if (!m) return; this.S.remove(m); m.geometry.dispose(); m.material.dispose(); }
  // the first one comes up out of the ground 70 m off
  start() { const h = this.H.h; let p = null; for (let i = 0; i < 8 && !p; i++) { const a = Math.random() * 6.28; p = this.P.snapWalkable(h.x + Math.cos(a) * 70, h.z + Math.sin(a) * 70, 30); } p = p || [h.x + 70, h.z]; this.spawn(p[0], p[1], this.size0, 1, true); this.started = true; this.H.say('THE FAULTLINE!', 1.8, '#ff9a3a'); this.g.shake = Math.max(this.g.shake || 0, 1); sfx('boomBig', p[0], 5, p[1], { gain: 1.1, rate: 0.6 }); }
  // stage 1: the whole giant (an arm, the other arm, the head); stage 2: a half of it with the one arm it kept (the arm, the head); stage 3: the small ones, fought by hand
  spawn(x, z, size, stage, rising, keep = 1) {
    const G = golem(this.design), y = this.P.groundY(x, z), q = { G, size, stage, x, z, y, yaw: Math.atan2(this.H.h.x - x, this.H.h.z - z), state: rising ? 'rise' : 'walk', t: 0, cd: stage < 3 ? 1.6 : 1.5 + Math.random(), hits: 0, parts: [], hp: 10 * this.tough, alive: true, ph: Math.random() * 6, ai: 0, foot: 0, dip: 0 };
    G.root.scale.setScalar(size / 10); G.root.rotation.order = 'YXZ'; G.root.position.set(x, rising ? y - size * 0.6 : y, z); G.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.S.add(G.root);
    if (stage === 1) q.parts = [{ arm: 0 }, { arm: 1 }, { head: true }]; else if (stage === 2) { this.armOff(q, 1 - keep, true); q.parts = [{ arm: keep }, { head: true }]; } q.need = q.parts.length;
    if (stage < 3) { q.ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: new THREE.Color(2.2, 1.9, 0.5), transparent: true, depthTest: false, depthWrite: false, fog: false })); q.ring.renderOrder = 9; q.ring.visible = false; this.S.add(q.ring); }
    this.giants.push(q); if (rising) this.g.disasters.ctx.fire.dustCloud(x, z, size * 0.2, 8); return q;
  }
  // a piece comes away: the body keeps stand-ins for its joints (every pose still has something to turn) and a stump of lava where it was. Returns the piece, now loose in the town
  armOff(q, i, quiet) { const A = q.G.arms[i]; if (A.off) return null; const m = A.sh, lp = m.position.clone(), par = m.parent; if (quiet) { par.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } else this.S.attach(m); this.stump(par, lp, 0.75); A.sh = new THREE.Group(); A.el = new THREE.Group(); A.fist = new THREE.Group(); A.off = true; return quiet ? null : m; }
  headOff(q) { const G = q.G, m = G.head, lp = m.position.clone(), par = m.parent; this.S.attach(m); this.stump(par, lp, 0.55); G.head = new THREE.Group(); q.noHead = true; return m; }
  stump(par, lp, r) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), this.lavaMat()); s.position.copy(lp); par.add(s); }
  arms(q) { return q.G.arms.filter((a) => !a.off).length; }
  // where the piece to break is: the middle of the arm, or the head
  partPos(q, p, out) { if (p.head) { q.G.head.getWorldPosition(out); out.y += q.size * 0.04; } else q.G.arms[p.arm].el.getWorldPosition(out); return out; }
  // out of whatever it was doing: its warning mark gone, its body square again
  clear(q) { this.unmark(q.mk); q.mk = null; q.G.torso.rotation.y = 0; q.G.torso.rotation.z = 0; q.ts = null; q.again = 0; q.hit = false; }
  rest(q) { return 1.4 + q.size * 0.012 - (this.arms(q) ? 0 : 0.4); } // between two of its moves: quicker than it was, quicker still with nothing left but its head
  // what it does next: by turns, from what it has left; with her at its feet, a stomp
  pick(q, d) { const n = this.arms(q); if (!this.H.active) return n ? 'throw' : 'spit'; if (d < q.size * 0.35 && q.last !== 'stomp') return (q.last = 'stomp'); const L = n === 2 ? ['throw', 'stomp'] : n === 1 ? ['sweep', 'throw', 'stomp'] : ['spit', 'stomp']; q.ai = (q.ai + 1) % L.length; return (q.last = L[q.ai]); }
  // ---------- each frame (horde frame on foot, bg in the air)
  step(dt) {
    if (this.H.over || !(dt > 0)) return; if (!this.started) { if (this.H.active) this.start(); else return; } this.t += dt;
    for (const q of this.giants) if (q.alive) this.giantStep(q, dt); this.giants = this.giants.filter((q) => q.alive);
    this.wavesStep(dt); this.flyStep(dt); this.stonesStep(dt); this.piecesStep(dt);
  }
  giantStep(q, dt) {
    const G = q.G, h = this.H.h, P = this.P, big = q.stage < 3, dx = h.x - q.x, dz = h.z - q.z, d = Math.hypot(dx, dz) || 1; q.t += dt; G.tick(this.t + q.ph);
    let da = Math.atan2(dx, dz) - q.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    switch (q.state) {
      case 'rise': { const k = Math.min(1, q.t / 1.6); G.root.position.y = q.y - q.size * 0.6 * (1 - k * (2 - k)); if (Math.random() < dt * 8) this.g.disasters.ctx.fire.dustCloud(q.x + (Math.random() - 0.5) * q.size * 0.3, q.z + (Math.random() - 0.5) * q.size * 0.3, q.size * 0.08, 4); if (k >= 1) { q.state = 'walk'; q.t = 0; if (big) this.say('ring', 'BREAK OFF THE ARM IN THE RING', 2.2); } break; }
      case 'walk': { const rage = big && !this.arms(q), want = big ? q.size * (rage ? 0.5 : 0.9) : q.size * 0.22 + 1.6, moving = d > want;
        if (moving && !q.ts && Math.abs(da) < 0.9) { const sp = big ? (2 + q.size * 0.05) * (rage ? 1.7 : 1) : 3.6, w0 = Math.sin(q.wp || 0); q.yaw += da * Math.min(1, dt * (big ? 0.9 : 3)); q.x += Math.sin(q.yaw) * sp * dt; q.z += Math.cos(q.yaw) * sp * dt; q.wp = (q.wp || 0) + dt * Math.PI * sp / (q.size * 0.234); /* a step is 0.234 of its height (its legs' swing), so the feet keep time with the ground */ if (big) { this.trample(q, dt); if (w0 * Math.sin(q.wp) < 0) this.footfall(q, G.legs[w0 > 0 ? 0 : 1]); } this.walkPose(q, true); }
        else this.turnStep(q, da, dt); // standing, or facing well away from her: it turns a step at a time, it does not swivel
        if ((q.cd -= dt) <= 0 && !q.ts && (Math.abs(da) < 0.8 || q.cd < -2.5)) { q.t = 0; q.hit = false; q.again = 0; G.torso.rotation.z = 0; /* facing her first (or after 2.5 s of trying) */ if (big) q.state = this.pick(q, d); else if (d < want + 3 && this.H.active) { q.state = 'punch'; q.at = [h.x, h.z]; q.mk = this.mark(h.x, h.z, 2.8); } else q.cd = 0.5; } break; }
      case 'stomp': { const k = q.t / 0.8, L = G.legs[1]; if (k < 1) { L.hip.rotation.x = -1.05 * k; L.knee.rotation.x = 1.3 * k; } else if (!q.hit) { q.hit = true; L.hip.rotation.x = 0; L.knee.rotation.x = 0; L.foot.getWorldPosition(_v); this.quake(_v.x, _v.z, q.size); this.shed(q); if (!this.arms(q)) q.again = 0.45; }
        if (q.again > 0 && (q.again -= dt) <= 0) { G.legs[0].foot.getWorldPosition(_v); this.quake(_v.x, _v.z, q.size * 0.7); } // nothing left but its head: a second quake on the heels of the first
        if (q.t > 1.35) { q.state = 'walk'; q.t = 0; q.cd = this.rest(q); } break; }
      case 'throw': { G.torso.rotation.y = Math.max(-0.6, Math.min(0.6, da)) * Math.min(1, q.t / 0.3); const A = G.arms[1].off ? G.arms[0] : G.arms[1], k = q.t / 0.75; if (k < 1) { A.sh.rotation.x = -2.7 * k; A.el.rotation.x = -0.6 * k; } else if (!q.hit) { q.hit = true; A.sh.rotation.x = -0.4; A.fist.getWorldPosition(_v); this.toss(_v.clone(), q); } if (q.t > 1.2) { G.torso.rotation.y = 0; q.state = 'walk'; q.t = 0; q.cd = this.rest(q); } break; }
      case 'sweep': { const A = G.arms.find((a) => !a.off), R = q.size * 0.8, k = q.t / 0.9; if (!A) { q.state = 'walk'; q.t = 0; q.cd = 0.3; break; } if (!q.mk && !q.hit) { q.mk = this.fan(q, R); this.say('sweep', 'ITS ARM SWEEPS: DASH OUT OF THE RED', 1.8); }
        if (k < 1) { q.mk.rotation.y = q.yaw; q.mk.position.set(q.x, P.groundY(q.x, q.z) + 0.2, q.z); q.mk.material.opacity = 0.22 + 0.35 * k; A.sh.rotation.set(-1.3 * k, 0, A.s * 1.5 * k); G.torso.rotation.y = -A.s * 0.5 * k; G.torso.rotation.x += 0.35 * k; }
        else { const u = Math.min(1, (q.t - 0.9) / 0.3); A.sh.rotation.set(-1.3, 0, A.s * (1.5 - 2.6 * u)); G.torso.rotation.y = -A.s * (0.5 - 1.1 * u); G.torso.rotation.x += 0.35; if (!q.hit) { q.hit = true; this.swept(q, R); } }
        if (q.t > 1.6) { this.clear(q); q.state = 'walk'; q.t = 0; q.cd = this.rest(q); } break; }
      case 'spit': { G.torso.rotation.y = Math.max(-0.6, Math.min(0.6, da)) * Math.min(1, q.t / 0.3); const k = q.t / 0.7; G.torso.rotation.x -= 0.4 * (k < 1 ? k : Math.max(0, 1 - (q.t - 0.7) * 4)); if (k >= 1 && !q.hit) { q.hit = true; G.head.getWorldPosition(_v); const n = this.H.active ? 1 : 0, cx = Math.cos(q.yaw), sx = Math.sin(q.yaw); for (let i = -n; i <= n; i++) this.toss(_v.clone(), q, { dx: i * 7 * cx, dz: -i * 7 * sx, k: 0.75, T: 1.1 + 0.15 * (i + 1), lava: true }); this.say('spit', 'IT SPITS LAVA ROCKS!', 1.4); }
        if (q.t > 1.2) { G.torso.rotation.y = 0; q.state = 'walk'; q.t = 0; q.cd = this.rest(q); } break; }
      case 'stagger': { G.torso.rotation.x -= 0.45 * Math.sin(Math.min(1, q.t / 0.6) * Math.PI); if (q.t > 0.6) { q.state = 'walk'; q.t = 0; q.cd = Math.max(q.cd, big ? 1 : 0); } break; }
      case 'kneel': { const e = Math.min(1, q.t / 0.35) * (1 - Math.max(0, (q.t - (KNEEL_T - 0.4)) / 0.4)); G.torso.rotation.x += 0.7 * e; for (const L of G.legs) { L.hip.rotation.x = -0.9 * e; L.knee.rotation.x = 1.5 * e; } for (const A of G.arms) if (!A.off) A.sh.rotation.x = 0.35 * e; q.dip = q.size * 0.085 * e; if (q.t > KNEEL_T) { q.dip = 0; q.foot = 0; q.state = 'walk'; q.t = 0; q.cd = 0.8; } break; } // buckled: down on its knees, its arms and head within her reach
      case 'fall': { const k = Math.min(1, q.t / 1.5); G.root.rotation.x = -1.45 * k * k; if (k >= 1 && !q.hit) { q.hit = true; this.landed(q); } if (q.t > 2.1) this.split(q); break; }
      case 'punch': { q.yaw += da * Math.min(1, dt * 5); const k = q.t / 0.8; for (const A of G.arms) { A.sh.rotation.x = k < 1 ? -2.8 * k : -0.6; } if (k >= 1 && !q.hit) { q.hit = true; this.pound(q); } if (q.t > 1.25) { q.hit = false; q.state = 'walk'; q.t = 0; q.cd = 1.4 + Math.random() * 1.2; } break; }
      case 'crumble': { G.root.position.y -= dt * q.size * 0.4; if (q.t > 1.1) this.gone(q); break; }
    }
    if (!q.alive) return;
    G.root.position.x = q.x; G.root.position.z = q.z; if (!['rise', 'crumble', 'fall'].includes(q.state)) G.root.position.y = P.groundY(q.x, q.z) - (q.dip || 0); G.root.rotation.y = q.yaw;
    if (q.ring) { const p = q.parts[q.hits], on = !!p && !['rise', 'fall'].includes(q.state); q.ring.visible = on; if (on) { const kn = q.state === 'kneel'; this.partPos(q, p, _v); q.ring.position.copy(_v); q.ring.scale.setScalar(q.size * (0.2 + 0.03 * Math.sin(this.t * 7)) * (kn ? 1.3 : 1)); q.ring.material.color.setRGB(kn ? 0.6 : 2.2, kn ? 2.4 : 1.9, kn ? 0.7 : 0.5); } } // the piece to break: yellow; green while it is down and can be hit by hand
  }
  // a turn on the spot, a step at a time (Sean, 2026-11-15: "he kinda just rotated ... make the animations force a step to turn"): a foot comes up, the body swings round as far as one step takes it (0.55 rad), the foot
  // comes down with a thud; then the other foot, until it faces her
  turnStep(q, da, dt) { const G = q.G, big = q.stage < 3, T = big ? 0.5 + q.size * 0.008 : 0.3; let s = q.ts;
    if (!s) { this.walkPose(q, false); if (Math.abs(da) < 0.22) return; s = q.ts = { t: 0, from: q.yaw, by: Math.max(-0.55, Math.min(0.55, da)), leg: (q.tsLeg = q.tsLeg == null ? (da > 0 ? 1 : 0) : 1 - q.tsLeg) }; }
    s.t += dt; const u = Math.min(1, s.t / T), e = u * u * (3 - 2 * u), up = Math.sin(Math.PI * u), L = G.legs[s.leg], O = G.legs[1 - s.leg], sg = s.by > 0 ? 1 : -1;
    q.yaw = s.from + s.by * e; L.hip.rotation.x = -0.1 - 0.75 * up; L.knee.rotation.x = 0.1 + 1.1 * up; O.hip.rotation.x = -0.1; O.knee.rotation.x = 0.1; G.torso.rotation.z = (s.leg ? -1 : 1) * 0.07 * up; for (const A of G.arms) A.sh.rotation.x = -0.2 + 0.22 * up * A.s * sg;
    if (u >= 1) { q.ts = null; G.torso.rotation.z = 0; this.footfall(q, L); } }
  // a foot comes down: the street shakes a little, dust under it
  footfall(q, L) { if (q.stage >= 3) return; L.foot.getWorldPosition(_v); this.g.shake = Math.max(this.g.shake || 0, 0.12 + q.size / 250); this.g.disasters.ctx.fire.dustCloud(_v.x, _v.z, q.size * 0.06, 2); sfx('thud', _v.x, 1, _v.z, { gain: 0.5 + q.size / 100, rate: 0.5 }); }
  walkPose(q, moving) { const G = q.G, w = moving ? Math.sin(q.wp || 0) : 0; for (const L of G.legs) { L.hip.rotation.x = w * 0.4 * L.s - 0.1; L.knee.rotation.x = Math.max(0, -w * L.s) * 0.5 + 0.1; } for (const A of G.arms) A.sh.rotation.x = -w * 0.3 * A.s - 0.2; }
  // the big ones walk through what is in their way
  trample(q, dt) { if ((q.tr = (q.tr || 0) - dt) > 0) return; q.tr = 0.25; const c = this.g.city, D = this.g.disasters; c.buildingsNear(q.x, q.z, q.size * 0.14, (k) => { if (c.dead[k]) return; D.destroyBuilding(k, 'collapse', { spare: true, noCrush: true }); this.g.shake = Math.max(this.g.shake || 0, 0.4); }); }
  gone(q) { q.alive = false; this.unmark(q.mk); q.mk = null; if (q.ring) { this.S.remove(q.ring); q.ring.material.dispose(); q.ring = null; } this.S.remove(q.G.root); q.G.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  // ---------- the quake: a ring of broken ground rolling out from the foot; on the ground in its way, she is hit
  quake(x, z, size) {
    const D = this.g.disasters; this.g.shake = Math.max(this.g.shake || 0, 0.5 + size / 80); sfx('boomBig', x, 2, z, { gain: 1, rate: 0.7 }); D.ctx.fire.dustCloud(x, z, size * 0.15, 6); this.busy = true; this.H.flingAround(x, z, size * 0.2, 12); this.busy = false;
    const R = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.75, 0.25), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); R.position.set(x, this.P.groundY(x, z) + 0.15, z); this.S.add(R); this.waves.push({ R, x, z, r: 2, max: size * 1.5, sp: 22, hit: false }); this.say('quake', 'QUAKE! DASH THROUGH THE RING');
  }
  wavesStep(dt) { const h = this.H.h, D = this.g.disasters; for (const w of this.waves) { w.r += w.sp * dt; w.R.scale.setScalar(w.r); w.R.material.opacity = 0.9 * (1 - w.r / w.max); if (Math.random() < dt * 25) { const a = Math.random() * 6.28, x = w.x + Math.cos(a) * w.r, z = w.z + Math.sin(a) * w.r; D.debris.add(x, this.P.groundY(x, z) + 0.3, z, 0.35, 0.25, 0.35, 0x6e6052, 'fly', { v: [0, 4 + Math.random() * 5, 0], life: 0.6 }); }
      if (!w.hit && this.H.active) { const d = Math.hypot(h.x - w.x, h.z - w.z); if (Math.abs(d - w.r) < 1.5 && !AIRY.includes(h.state)) { w.hit = true; this.H.hitWhy = 'QUAKE!'; this.H.bite(2.2); this.H.hitWhy = null; } }
      if (w.r >= w.max) { w.done = true; this.S.remove(w.R); w.R.geometry.dispose(); w.R.material.dispose(); } } this.waves = this.waves.filter((w) => !w.done); }
  // a stomp shakes a rock loose from it: it comes down near her (a yellow ring, no harm in it), so there is something to throw
  shed(q) { if (!this.H.active || this.stones.length + this.flying.filter((b) => b.safe).length >= 3) return; const h = this.H.h, a = Math.random() * 6.28, r = 8 + Math.random() * 6, p = this.P.snapWalkable(h.x + Math.cos(a) * r, h.z + Math.sin(a) * r, 12); if (!p) return; q.G.torso.getWorldPosition(_v2); this.toss(_v2.clone(), q, { x: p[0], z: p[1], safe: true }); }
  // its arm across the street in front of it: what stands there comes down, and she is hit if she is in the fan and on the ground
  swept(q, R) { const h = this.H.h, D = this.g.disasters, c = this.g.city, fx = Math.sin(q.yaw), fz = Math.cos(q.yaw); this.g.shake = Math.max(this.g.shake || 0, 0.8); sfx('crash', q.x + fx * R * 0.5, 2, q.z + fz * R * 0.5, { gain: 1.2, rate: 0.6 });
    for (let i = -2; i <= 2; i++) { const a = q.yaw + i * 0.4, x = q.x + Math.sin(a) * R * 0.6, z = q.z + Math.cos(a) * R * 0.6; D.ctx.fire.dustCloud(x, z, q.size * 0.08, 4); c.buildingsNear(x, z, q.size * 0.12, (k) => { if (!c.dead[k]) D.destroyBuilding(k, 'collapse', { spare: true, noCrush: true }); }); }
    this.busy = true; this.H.flingAround(q.x + fx * R * 0.5, q.z + fz * R * 0.5, R * 0.5, 14); this.busy = false;
    if (this.H.active && !AIRY.includes(h.state)) { const dx = h.x - q.x, dz = h.z - q.z; let a = Math.atan2(dx, dz) - q.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.hypot(dx, dz) < R && Math.abs(a) < 1) { this.H.hitWhy = 'SWEPT!'; this.H.bite(2); this.H.hitWhy = null; } }
    this.unmark(q.mk); q.mk = null; }
  // ---------- the boulders: thrown at where she is going, a red ring where they will land; they stay there a while to be thrown back.
  // o.x, o.z: where instead; o.dx, o.dz: that far to the side of her; o.safe: a rock shaken loose, no harm in it; o.lava: spat, glowing; o.k: its size; o.T: its time in the air
  toss(from, q, o = {}) { const h = this.H.h, F = this.g.flight, air = !this.H.active && F.active && !o.safe, r = Math.max(1, q.size * 0.04) * (o.k || 1), tx = o.x != null ? o.x : air ? F.pos.x : h.x + h.vx * 0.6 + (o.dx || 0), tz = o.z != null ? o.z : air ? F.pos.z : h.z + h.vz * 0.6 + (o.dz || 0), ty = air ? F.pos.y : this.P.groundY(tx, tz) + r * 0.8; const m = new THREE.Mesh(stoneGeo(r, r * 0.85, r, 0.3, 1, Math.random() * 99), o.lava ? this.lavaMat() : this.rockMat()); m.castShadow = true; m.position.copy(from); this.S.add(m); this.flying.push({ m, mk: air ? null : this.mark(tx, tz, r + 1.6, o.safe ? [1.4, 1.2, 0.3] : undefined), a: from, x: tx, y: ty, z: tz, r, t: 0, T: o.T || 1.3, air, safe: !!o.safe, arc: q.size * 0.25 }); sfx('whoosh', from.x, from.y, from.z, { gain: o.safe ? 0.5 : 1, rate: 0.6 }); if (!o.safe && !o.lava) this.say('throw', 'BOULDER! GRAB IT AND THROW IT BACK', 1.8); }
  flyStep(dt) { const h = this.H.h, F = this.g.flight; for (const b of this.flying) { b.t += dt; const u = Math.min(1, b.t / b.T); b.m.position.set(b.a.x + (b.x - b.a.x) * u, b.a.y + (b.y - b.a.y) * u + Math.sin(u * Math.PI) * b.arc, b.a.z + (b.z - b.a.z) * u); b.m.rotation.x += dt * 3; if (u < 1) continue; b.done = true; this.unmark(b.mk);
      if (b.air) { if (F.active && F.pos.distanceTo(b.m.position) < b.r + 3) F.damage(12, 'Hit by a boulder!'); this.S.remove(b.m); continue; }
      this.g.shake = Math.max(this.g.shake || 0, b.safe ? 0.25 : 0.5); sfx('crash', b.x, 1, b.z, { gain: b.safe ? 0.6 : 1, rate: 0.6 }); this.g.disasters.ctx.fire.dustCloud(b.x, b.z, b.r * 2, 4);
      if (!b.safe) { this.busy = true; this.H.sweep(b.x, b.z, b.r + 1.5, 'burst'); this.busy = false; if (this.H.active && Math.hypot(h.x - b.x, h.z - b.z) < b.r + 1.6 && !AIRY.includes(h.state)) { this.H.hitWhy = 'BOULDER!'; this.H.bite(1.8); this.H.hitWhy = null; } }
      this.settle(b.m, b.x, b.z, b.r); }
    this.flying = this.flying.filter((b) => !b.done); }
  // a boulder come to rest: it glows, to be grabbed and thrown; the oldest goes when there are too many
  settle(m, x, z, r) { m.position.set(x, this.P.groundY(x, z) + r * 0.7, z); const glow = this.mark(x, z, r + 0.9, [1.4, 1.2, 0.3]); this.stones.push({ m, glow, x, z, r, t: 0 }); while (this.stones.length > STONES) this.stoneGone(this.stones[0]); }
  stonesStep(dt) { for (const s of this.stones) { s.t += dt; s.glow.material.opacity = 0.45 + 0.35 * Math.sin(s.t * 5); if (s.t > STONE_T) s.old = true; } for (const s of this.stones.filter((q) => q.old)) this.stoneGone(s); }
  stoneGone(s) { this.stones = this.stones.filter((q) => q !== s); this.unmark(s.glow); this.S.remove(s.m); this.g.disasters.ctx.fire.dustCloud(s.x, s.z, s.r * 1.5, 3); }
  // GRAB by one (horde grabOn): taken from the ground, smaller in her hands
  stoneNear(R) { const h = this.H.h, H = this.H, fr = H.dashFrom && performance.now() - (H.dashAt || 0) < 1200 ? H.dashFrom : null; let best = null, bd = 1e9; for (const s of this.stones) { const d = Math.min(Math.hypot(s.x - h.x, s.z - h.z), fr ? Math.hypot(s.x - fr[0], s.z - fr[1]) : 1e9) - s.r; /* or by where a drawn stroke's dash began (horde barrelNear) */ if (d < R && d < bd) { bd = d; best = s; } } if (!best) return null; this.stones = this.stones.filter((q) => q !== best); this.unmark(best.glow); best.m.scale.setScalar(Math.min(1, 1.3 / best.r)); return best; }
  // thrown back (horde thrownStep): it flies at the ringed piece of the nearest big one standing; true when it has hit
  homing(f, dt) { const T = this.giants.filter((q) => q.alive && q.stage < 3 && q.hits < q.need && !['fall', 'rise'].includes(q.state)).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; if (!T) return false; this.partPos(T, T.parts[T.hits], _v2); const tx = _v2.x - f.x, ty = _v2.y - f.y, tz = _v2.z - f.z, dd = Math.hypot(tx, ty, tz) || 1, sp = 52, k = Math.min(1, dt * 7); f.vx += (tx / dd * sp - f.vx) * k; f.vy += (ty / dd * sp - f.vy) * k; f.vz += (tz / dd * sp - f.vz) * k; if (dd > T.size * 0.15) return false; this.stoneHit(T, f.x, f.y, f.z); return true; }
  stoneHit(q, x, y, z) { this.breakPart(q, x, y, z); }
  // the ringed piece knocked off: it falls away (piecesStep), a stump of lava left; the last one, the head, and the giant goes down
  breakPart(q, x, y, z) {
    const D = this.g.disasters, p = q.parts[q.hits]; if (!p || !q.alive || ['fall', 'rise'].includes(q.state)) return; this.partPos(q, p, _v2); const px = _v2.x, py = _v2.y, pz = _v2.z, s = q.size; q.hits++; this.clear(q); q.dip = 0; q.foot = 0;
    D.ctx.fire.burst(px, py, pz, 18, 2.6); for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, k = 0.3 + Math.random() * 0.6; D.debris.add(px, py, pz, k, k * 0.7, k, Math.random() < 0.6 ? 0x3a3330 : 0xff7a20, 'fly', { v: [Math.cos(a) * 11, 3 + Math.random() * 9, Math.sin(a) * 11], life: 1.3 }); }
    this.g.shake = Math.max(this.g.shake || 0, 1); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.12); sfx('crash', px, py, pz, { gain: 1.3, rate: 0.6 }); sfx('boomBig', px, py, pz, { gain: 0.8, rate: 0.9 }); this.H.hits++; this.H.hitsT = 1.5;
    const m = p.head ? this.headOff(q) : this.armOff(q, p.arm); if (m) { const dx = px - q.x, dz = pz - q.z, d = Math.hypot(dx, dz) || 1; this.pieces.push({ m, vx: dx / d * s * 0.1 + (Math.random() - 0.5) * 2, vy: s * 0.16, vz: dz / d * s * 0.1 + (Math.random() - 0.5) * 2, wx: (Math.random() - 0.5) * 3, wz: (Math.random() - 0.5) * 3, r: s * (p.head ? 0.08 : 0.12), size: s, head: !!p.head, t: 0 }); }
    if (q.hits >= q.need) { q.state = 'fall'; q.t = 0; this.H.say('HEAD OFF! IT\'S GOING DOWN!', 1.8, '#ffd27a'); } else { q.state = 'stagger'; q.t = 0; this.H.say(q.parts[q.hits].head ? 'ARM OFF! NOW THE HEAD' : 'ARM OFF! NOW THE OTHER ARM', 1.6, '#ffd27a'); }
  }
  // a piece that has come off: it tumbles down, flattens what it lands on, and breaks into boulders to throw
  piecesStep(dt) { const D = this.g.disasters, c = this.g.city, h = this.H.h; for (const p of this.pieces) { const m = p.m; p.t += dt; p.vy -= 34 * dt; m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt; m.rotation.x += p.wx * dt; m.rotation.z += p.wz * dt; const x = m.position.x, z = m.position.z, gy = this.P.groundY(x, z); if (m.position.y > gy + p.r && p.t < 8) continue;
      p.done = true; this.g.shake = Math.max(this.g.shake || 0, 0.9); sfx('boomBig', x, 2, z, { gain: 1, rate: 0.8 }); D.ctx.fire.dustCloud(x, z, p.r * 2.2, 7); c.buildingsNear(x, z, p.r * 1.3, (k) => { if (!c.dead[k]) D.destroyBuilding(k, 'collapse', { spare: true, noCrush: true }); });
      this.busy = true; this.H.sweep(x, z, p.r * 1.2, 'burst'); this.busy = false; if (this.H.active && Math.hypot(h.x - x, h.z - z) < p.r * 1.1 && !AIRY.includes(h.state)) { this.H.hitWhy = 'CRUSHED!'; this.H.bite(1.6); this.H.hitWhy = null; }
      this.S.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (let i = 0, n = p.head ? 1 : 2; i < n; i++) { const a = Math.random() * 6.28, d = p.r * (0.3 + Math.random() * 0.7), r = Math.max(1, p.size * 0.04), q = this.P.snapWalkable(x + Math.cos(a) * d, z + Math.sin(a) * d, 14) || [x, z], b = new THREE.Mesh(stoneGeo(r, r * 0.85, r, 0.3, 1, Math.random() * 99), this.rockMat()); b.castShadow = true; this.S.add(b); this.settle(b, q[0], q[1], r); } }
    this.pieces = this.pieces.filter((p) => !p.done); }
  // down: the street shaken, what it lands on knocked flat
  landed(q) { const D = this.g.disasters, bx = q.x - Math.sin(q.yaw) * q.size * 0.5, bz = q.z - Math.cos(q.yaw) * q.size * 0.5; this.g.shake = Math.max(this.g.shake || 0, 1.3); sfx('boomBig', bx, 2, bz, { gain: 1.2, rate: 0.5 }); for (let i = 0; i < 4; i++) D.ctx.fire.dustCloud(q.x + (bx - q.x) * i / 3, q.z + (bz - q.z) * i / 3, q.size * 0.18, 8); this.busy = true; this.H.flingAround(bx, bz, q.size * 0.35, 16); this.busy = false; const c = this.g.city; c.buildingsNear(bx, bz, q.size * 0.3, (k) => { if (!c.dead[k]) D.destroyBuilding(k, 'collapse', { spare: true, noCrush: true }); }); }
  // where it lies it breaks in two: two of half the size come up out of the rubble at once, one each side, an arm each; a few stone men with them
  split(q) { const D = this.g.disasters, P = this.P, bx = q.x - Math.sin(q.yaw) * q.size * 0.45, bz = q.z - Math.cos(q.yaw) * q.size * 0.45, by = P.groundY(bx, bz), st = q.stage + 1, sz = q.size / 2; this.gone(q);
    D.ctx.fire.burst(bx, by + 2, bz, 22, 3); for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, k = 0.4 + Math.random() * 0.8; D.debris.add(bx + Math.cos(a) * sz * 0.4, by + 1, bz + Math.sin(a) * sz * 0.4, k, k * 0.7, k, Math.random() < 0.7 ? 0x3a3330 : 0xff7a20, 'fly', { v: [Math.cos(a) * 10, 5 + Math.random() * 10, Math.sin(a) * 10], life: 1.4 }); }
    this.g.shake = Math.max(this.g.shake || 0, 1); sfx('boomBig', bx, 2, bz, { gain: 1.1, rate: 0.8 });
    for (let i = 0; i < 2; i++) { const a = q.yaw + Math.PI / 2 + i * Math.PI, p = P.snapWalkable(bx + Math.sin(a) * sz * 0.9, bz + Math.cos(a) * sz * 0.9, 20) || [bx + Math.sin(a) * sz, bz + Math.cos(a) * sz]; this.spawn(p[0], p[1], sz, st, true, i); }
    this.menUp(bx, bz, q.stage === 1 ? 10 : 6, true); this.H.say(q.stage === 1 ? 'IT BREAKS IN TWO!' : 'AND AGAIN!', 1.8, '#ff9a3a'); if (st === 3) this.say('small', 'THESE YOU CAN PUNCH', 1.8); }
  // stone men up out of the ground round where it went down
  menUp(x, z, n, quiet) { const H = this.H, P = this.P; for (let i = 0; i < n; i++) { const a = i / n * 6.28 + Math.random() * 0.4, r = 4 + Math.random() * 12, p = P.snapWalkable(x + Math.cos(a) * r, z + Math.sin(a) * r, 10); if (!p) continue; const old = H.pool.length ? -1 : this.spent(), j = P.drop(p[0], p[1], STONEMAN, H.pool.length ? H.pool.pop() : old); if (j < 0) break; P.st[j] = ZOMBIE; P.y[j] = P.groundY(p[0], p[1]); P.fx[j] = 0; P.t1[j] = 0.6; P.dirty[j] = 1; if (old < 0) H.ids.push(j); this.all.push(j); if (i % 3 === 0) { H.puff(p[0], p[1], 0.3); this.g.disasters.debris.add(p[0], P.y[j] + 0.3, p[1], 0.3, 0.2, 0.3, 0x6e6052, 'fly', { v: [0, 6, 0], life: 0.7 }); } }
    if (!quiet) H.say('IT CRUMBLES INTO STONE MEN!', 1.6, '#ff9a3a'); H.countT = 0; }
  // a stone man already dust, his place to use again (the town's spare people can run out before the last crowd): already in the count's list
  spent() { const P = this.P; for (let i = 0; i < this.all.length; i++) { const j = this.all[i]; if (P.st[j] === 17) { this.all.splice(i, 1); return j; } } return -1; }
  // the small ones: a red ring where she stands, then both fists down on it
  pound(q) { const h = this.H.h, [x, z] = q.at; this.unmark(q.mk); q.mk = null; this.g.shake = Math.max(this.g.shake || 0, 0.4); sfx('crash', x, 1, z, { gain: 0.9, rate: 0.9 }); this.g.disasters.ctx.fire.dustCloud(x, z, 2.5, 3); if (this.H.active && Math.hypot(h.x - x, h.z - z) < 2.8 && !AIRY.includes(h.state)) { this.H.hitWhy = 'POUNDED!'; this.H.bite(1.6); this.H.hitWhy = null; } }
  // her blows (horde sweep). The small ones take them. A big one: its feet crack, and enough of it and it buckles (kneel); down on its knees, a blow knocks off the ringed piece
  sweepHit(x, z, R, dmg, how) { if (this.busy) return; for (const q of this.giants) { if (!q.alive || ['crumble', 'rise', 'fall'].includes(q.state)) continue; const d = Math.hypot(q.x - x, q.z - z); if (d > R + q.size * 0.2) continue; const gy = this.P.groundY(q.x, q.z);
      if (q.stage < 3) { if (q.state === 'kneel') { if (q.t > 0.3) this.breakPart(q, x, gy + 2, z); continue; }
        q.foot += dmg; this.H.spark(q.x + (x - q.x) * 0.5, gy + 1.5, q.z + (z - q.z) * 0.5, 1); sfx('clang', x, 2, z, { gain: 0.6, rate: 0.6 }); for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, k = 0.2 + Math.random() * 0.3; this.g.disasters.debris.add(x, gy + 1, z, k, k * 0.7, k, Math.random() < 0.7 ? 0x3a3330 : 0xff7a20, 'fly', { v: [Math.cos(a) * 6, 3 + Math.random() * 5, Math.sin(a) * 6], life: 0.8 }); }
        if (q.foot >= FOOT_NEED * this.tough * (q.stage === 1 ? 1 : 0.7)) { this.clear(q); q.state = 'kneel'; q.t = 0; this.g.shake = Math.max(this.g.shake || 0, 0.9); sfx('boomBig', q.x, 2, q.z, { gain: 1, rate: 0.7 }); this.g.disasters.ctx.fire.dustCloud(q.x, q.z, q.size * 0.2, 6); this.H.say('IT BUCKLES! HIT IT NOW', 1.8, '#9dff8a'); }
        else if (performance.now() > (this.bigSaid || 0)) { this.bigSaid = performance.now() + 5000; this.H.say('ITS FEET ARE CRACKING: KEEP HITTING', 1.4, '#ff9a3a'); } continue; }
      q.hp -= dmg; this.H.hits++; this.H.hitsT = Math.max(this.H.hitsT, 1.2); this.H.spark(q.x, gy + q.size * 0.45, q.z, 1.4); sfx('clang', q.x, 2, q.z, { gain: 0.7, rate: 0.8 }); if (q.state === 'walk') { q.state = 'stagger'; q.t = 0; }
      if (q.hp <= 0) { q.state = 'crumble'; q.t = 0; this.unmark(q.mk); q.mk = null; this.g.disasters.ctx.fire.dustCloud(q.x, q.z, q.size * 0.3, 6); sfx('crash', q.x, 2, q.z, { gain: 1.1, rate: 0.7 }); this.menUp(q.x, q.z, 10); } } }
  // the camera's giant: the nearest big one, or a small one near her
  focus() { const h = this.H.h; let best = null, bd = 1e9; for (const q of this.giants) { if (!q.alive) continue; const d = Math.hypot(q.x - h.x, q.z - h.z) - q.size; if (d < bd) { bd = d; best = q; } } if (!best) return null; const s = best.size; return { x: best.x, z: best.z, type: 'giant', want: 55 + s * 1.4, up: s * 0.45, el: s > 20 ? 0.24 : 0.34, fov: innerWidth < innerHeight ? (s > 20 ? 40 : 34) : (s > 20 ? 28 : 22) }; } // the whole of it in, and her: lower, further, a wider lens (horde place() then points it down far enough that she is clear of the buttons)
  giantsLeft() { return this.giants.filter((q) => q.alive).length + this.pending.length + (this.started ? 0 : 1); }
  dispose() { for (const q of this.giants) if (q.alive) this.gone(q); for (const s of this.stones) { this.unmark(s.glow); this.S.remove(s.m); } for (const b of this.flying) { this.unmark(b.mk); this.S.remove(b.m); } for (const w of this.waves) this.S.remove(w.R); for (const p of this.pieces) this.S.remove(p.m); this.giants = []; this.stones = []; this.flying = []; this.waves = []; this.pieces = []; this.pending = []; }
}
