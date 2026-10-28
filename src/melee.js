// Hand to hand (heroes against villains). A hero and a villain who close in square
// up and trade blows: punches, kicks, an uppercut, blocks. The villains start
// fights of their own and fight back, and a second villain close by may join in to
// gang up on the hero (and a free hero may fly in to even it up). A bout ends with
// a finishing blow that sends the loser flying. Tyrant and a hero with a beam of
// their own (Nova's eyes, Tempo's hands) can also lock beams: they face off at a
// distance, staring each other down, the two beams meet between them in a growing
// ball of light that is pushed back and forth, and it bursts in a shock wave that
// knocks them both back and blows out the windows round it. The sky slam and the
// space dive: stunts.js.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { toss } from './brawl.js';

const S = 2.2; // figure scale (villains.js)
const EYE = 3.75, SHOULDER = 3.25; // metres above the feet
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MOVE_T = { punch: 0.4, kick: 0.5, upper: 0.5, block: 0.4, hit: 0.4 };
const DMG = { punch: 14, kick: 18, upper: 24 };
const BEAM = { Nova: new THREE.Color(3.2, 0.45, 2.4), Tempo: new THREE.Color(0.5, 2.6, 3.4), Tyrant: new THREE.Color(7, 0.4, 0.25) };

let K = null;
function kit() {
  if (K) return K;
  const add = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  K = {
    ray: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0),
    ball: new THREE.SphereGeometry(1, 20, 14),
    ring: new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2),
    core: add(new THREE.Color(4, 3.6, 3)), add,
  };
  return K;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function stretch(m, ax, ay, az, bx, by, bz, r) {
  _a.set(bx - ax, by - ay, bz - az); const L = _a.length() || 0.01;
  m.position.set(ax, ay, az); m.quaternion.setFromUnitVectors(_up, _a.multiplyScalar(1 / L)); m.scale.set(r, L, r);
}
const fwd = (f) => [Math.sin(f.yaw), Math.cos(f.yaw)];

// the pose for a figure in a fight, laid over its own (call in its sync, before tumble and detail)
export function fightPose(r, f) {
  const A = r.arms, L = r.legs, m = f.move;
  if (f.downT > 0) { // flat on their back in a crater (stunts.js)
    r.body.rotation.x = -1.45; r.body.position.y = 0.3; r.head.rotation.x = 0.3;
    for (const a of A.slice(0, 2)) { a.sh.rotation.set(0.2, 0, a.sx * 1.2); a.el.rotation.set(-0.3, 0, 0); } for (const l of L) { l.hip.rotation.x = 0.1; l.knee.rotation.x = 0.4; }
    return;
  }
  if (f.stunt) { // a big move (stunts.js): an uppercut, a hammer blow, rising fist first, diving fist first
    r.body.rotation.x = 0;
    if (m && m.kind === 'hammer') { const u = clamp(m.t / m.T, 0, 1); for (const a of A.slice(0, 2)) { a.sh.rotation.set(-3.0 + 2.3 * u, 0, -a.sx * 0.15); a.el.rotation.set(0, 0, 0); } r.torso.rotation.x = 0.35 * u; for (const l of L) l.knee.rotation.x = 0.5; return; }
    if (!m && f.stuntPose === 'rise') { A[1].sh.rotation.set(-3.0, 0, 0.1); A[1].el.rotation.set(0, 0, 0); A[0].sh.rotation.set(0.2, 0, -0.15); for (const l of L) { l.hip.rotation.x = 0; l.knee.rotation.x = 0.1; } return; }
    if (!m && f.stuntPose === 'dive') { r.body.rotation.x = Math.PI; r.body.position.y = 4.2; for (const a of A.slice(0, 2)) { a.sh.rotation.set(-3.0, 0, a.sx * 0.12); a.el.rotation.set(0, 0, 0); } for (const l of L) { l.hip.rotation.x = 0; l.knee.rotation.x = 0.05; } return; }
    if (!m) return; // the one sent flying tumbles
  } else if (!f.fight && !f.beam) return;
  if (f.beam) { // locked in a beam clash: leaning into it, fists back (Tempo: both hands out, the beam between them)
    r.torso.rotation.x = 0.18; r.head.rotation.x = -0.12; r.body.rotation.x = 0;
    if (f.name === 'Tempo') for (const a of A.slice(0, 2)) { a.sh.rotation.set(-1.55, 0, -a.sx * 0.12); a.el.rotation.set(0, 0, 0); }
    else for (const a of A.slice(0, 2)) { a.sh.rotation.set(0.45, 0, a.sx * 0.25); a.el.rotation.set(-0.9, 0, 0); }
    for (const l of L) { l.hip.rotation.x = 0.1; l.knee.rotation.x = 0.35; }
    return;
  }
  if (!f.fight && !f.stunt) return;
  r.body.rotation.x = 0;
  if (f.name === 'Weaver') { r.hips.position.y = 0.94; r.head.rotation.x = 0; } // up off his haunches to fight
  if (!m && f.fight) { // squared up: fists up, one foot forward, bobbing
    for (const a of A.slice(0, 2)) { a.sh.rotation.set(-1.0, 0, -a.sx * 0.15); a.el.rotation.set(-1.75, 0, 0); }
    r.torso.rotation.x = 0.12; r.head.rotation.x = -0.05; L[0].hip.rotation.x = -0.3; L[1].hip.rotation.x = 0.22; for (const l of L) l.knee.rotation.x = 0.3;
    r.body.position.y = Math.sin((f.t || 0) * 7) * 0.06;
    return;
  }
  const k = Math.sin(Math.PI * clamp(m.t / m.T, 0, 1)); // out and back
  if (m.kind === 'punch') {
    const a = A[m.side], o = A[1 - m.side];
    a.sh.rotation.set(-1.15 - 0.45 * k, 0, a.sx * 0.05); a.el.rotation.set(-1.7 * (1 - k), 0, 0);
    o.sh.rotation.set(-1.0, 0, -o.sx * 0.15); o.el.rotation.set(-1.75, 0, 0);
    r.torso.rotation.y = -Math.sign(a.sx) * 0.5 * k; r.torso.rotation.x = 0.15 + 0.12 * k;
  } else if (m.kind === 'kick') {
    const l = L[m.side], o = L[1 - m.side];
    l.hip.rotation.x = -1.7 * k; l.knee.rotation.x = 0.9 * (1 - k); o.hip.rotation.x = 0.15; o.knee.rotation.x = 0.3;
    r.torso.rotation.x = -0.35 * k; for (const a of A.slice(0, 2)) { a.sh.rotation.set(-0.5, 0, a.sx * (0.6 + 0.4 * k)); a.el.rotation.set(-0.8, 0, 0); }
  } else if (m.kind === 'upper') {
    const a = A[m.side];
    a.sh.rotation.set(-0.4 - 2.4 * k, 0, a.sx * 0.1); a.el.rotation.set(-1.2 * (1 - k), 0, 0);
    r.torso.rotation.x = 0.4 - 0.7 * k; r.hips.position.y -= 0.14 * (1 - k); for (const l of L) l.knee.rotation.x = 0.6 * (1 - k);
  } else if (m.kind === 'block') {
    for (const a of A.slice(0, 2)) { a.sh.rotation.set(-1.5, 0, -a.sx * 0.5); a.el.rotation.set(-1.75, 0, 0); }
    r.torso.rotation.x = 0.25; r.head.rotation.x = 0.3;
  } else if (m.kind === 'hit') {
    r.torso.rotation.x = -0.5 * k; r.head.rotation.x = -0.55 * k;
    for (const a of A.slice(0, 2)) { a.sh.rotation.set(-0.3 - 0.4 * k, 0, a.sx * (0.4 + 0.7 * k)); a.el.rotation.set(-0.4, 0, 0); }
  }
}

export class Melee {
  constructor(brawl) { this.B = brawl; this.D = brawl.D; this.bouts = []; this.clashes = []; this.scanT = 0; this.clashCd = 8; }
  reset() {
    for (const c of this.clashes) this.endClash(c, true); this.bouts.length = 0; this.clashes.length = 0; this.clashCd = 8;
    if (this.waves) { for (const w of this.waves) for (const m of [w.ring, w.shell]) { this.D.ctx.scene.remove(m); m.material.dispose(); } this.waves.length = 0; }
  }

  // who is free to fight: not thrown, held, beaten, carrying something, driven by the player, or already at it
  free(f) {
    if (!f || f.tossed || f.gripped || f.spinning || f.dragging || f.fight || f.beam || (f.busyT || 0) > 0.05) return false;
    if (f.side === 'hero') return f.state === 'fly' && !f.busy && !f.landed;
    if (f.player || f.gone || f.beaten || f.leaving || f.heroLost) return false;
    if (f.name === 'Blur') return true; // he breaks off a run to fight
    if (f.name === 'Tyrant') return !f.held && !(f.wind > 0) && (f.state === 'fly' || f.state === 'stand');
    if (f.name === 'Weaver') return f.state === 'perch';
    return false;
  }

  // a bout between hero h and villain v (who starts it swings first). false if either is not free
  start(h, v, villainFirst = false) {
    if (!this.free(h) || !this.free(v)) return false;
    let ux = v.x - h.x, uz = v.z - h.z; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    const b = { heroes: [h], villains: [v], cx: v.x - ux * 1.3, cy: v.y || 0, cz: v.z - uz * 1.3, ux, uz, t: 0, next: 0.35, first: villainFirst ? v : h, n: 0, max: 5 + Math.floor(Math.random() * 4), joinT: 1.5 };
    for (const f of [h, v]) this.enlist(f, b);
    this.bouts.push(b);
    this.B.say('bout' + h.name + v.name, villainFirst ? v.name + ' turned on ' + h.name + '!' : h.name + ' and ' + v.name + ' are fighting hand to hand!');
    return true;
  }
  enlist(f, b) {
    f.fight = b; f.move = null; f.busyT = 0.25;
    if (f.side === 'hero') { f.vx = f.vy = f.vz = 0; f.hs = 0; return; }
    f.speed = 0; if (f.name === 'Blur' && f.state === 'dash') { f.state = 'rest'; f.restT = 1.5; f.inB = -1; } // stopped dead to fight; off again after
  }
  release(f, rest = 0.3) { if (f.fight) { f.fight = null; f.move = null; f.busyT = rest; } }

  // where each one stands: 1 on 1 facing; 1 against 2 in the middle with one each side; 2 on 2 as two pairs side by side
  slots(b) {
    const H = b.heroes, V = b.villains, out = new Map(), px = -b.uz, pz = b.ux;
    const line = (A, B2, ox, oz) => { // A on the near side, B2 on the far side, about (cx + ox, cz + oz)
      const cx = b.cx + ox, cz = b.cz + oz;
      if (A.length === 1 && B2.length === 1) { out.set(A[0], [cx - b.ux * 1.3, cz - b.uz * 1.3]); out.set(B2[0], [cx + b.ux * 1.3, cz + b.uz * 1.3]); }
      else if (A.length === 1) { out.set(A[0], [cx, cz]); out.set(B2[0], [cx + b.ux * 2.6, cz + b.uz * 2.6]); out.set(B2[1], [cx - b.ux * 2.6, cz - b.uz * 2.6]); }
      else { out.set(B2[0], [cx, cz]); out.set(A[0], [cx - b.ux * 2.6, cz - b.uz * 2.6]); out.set(A[1], [cx + b.ux * 2.6, cz + b.uz * 2.6]); }
    };
    if (H.length === 2 && V.length === 2) { line([H[0]], [V[0]], px * 3.5, pz * 3.5); line([H[1]], [V[1]], -px * 3.5, -pz * 3.5); }
    else line(H, V, 0, 0);
    return out;
  }
  foeOf(b, f) { const L = f.side === 'hero' ? b.villains : b.heroes; let best = null, bd = 1e9; for (const o of L) { const d = Math.hypot(o.x - f.x, o.z - f.z); if (d < bd) { bd = d; best = o; } } return best; }

  boutStep(b, h) {
    const D = this.D, { fire, people } = D.ctx;
    b.t += h;
    // anyone who has been thrown, beaten or has left drops out
    for (const L of [b.heroes, b.villains]) for (let i = L.length - 1; i >= 0; i--) { const f = L[i]; if (f.tossed || f.gripped || f.gone || f.beaten || (f.side === 'hero' && f.state !== 'fly')) { f.fight = null; f.move = null; L.splice(i, 1); } }
    if (!b.heroes.length || !b.villains.length) { for (const f of [...b.heroes, ...b.villains]) this.release(f); return true; }
    const at = this.slots(b);
    for (const f of [...b.heroes, ...b.villains]) {
      f.busyT = 0.25; if (f.vx != null) f.vx = f.vy = f.vz = 0; // their own update stands still while the bout has them
      const s = at.get(f), o = this.foeOf(b, f); if (!s) continue;
      const kb = f.knock || 0; f.knock = kb * Math.exp(-h * 6); // knocked back a step by a blow, then in again
      const dir = o ? [o.x - f.x, o.z - f.z] : [b.ux, b.uz], dl = Math.hypot(dir[0], dir[1]) || 1;
      const tx = s[0] - dir[0] / dl * kb, tz = s[1] - dir[1] / dl * kb, dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
      const step = d > 5 ? Math.min(d, 45 * h) : d * Math.min(1, h * 10); // flying in to join: quick, but not a jump
      if (d > 1e-3) { f.x += dx / d * step; f.z += dz / d * step; }
      f.y = (f.y || 0) + (b.cy - (f.y || 0)) * Math.min(1, h * 6);
      if (o) { const a = Math.atan2(o.x - f.x, o.z - f.z); let da = a - f.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); f.yaw += da * Math.min(1, h * 12); }
      if (f.move && (f.move.t += h) >= f.move.T) f.move = null;
    }
    // a blow on its way lands
    if (b.hit && b.t >= b.hit.at) { this.land(b, b.hit); b.hit = null; }
    if (b.over) return b.t >= b.over;
    if (b.t < b.next || b.hit) return false;
    // whose turn: the one who started first, then anyone (two on one side swing twice as often), never someone reeling
    const all = [...b.heroes, ...b.villains].filter(f => !(f.move && f.move.kind === 'hit'));
    let A = b.n === 0 ? b.first : all[Math.floor(Math.random() * all.length)];
    if (!A || !all.includes(A)) A = all[0]; if (!A) { b.next = b.t + 0.2; return false; }
    const T = this.foeOf(b, A); if (!T) return false;
    const fin = b.n >= b.max;
    const r = Math.random(), kind = fin ? (r < 0.5 ? 'kick' : 'upper') : r < 0.55 ? 'punch' : r < 0.85 ? 'kick' : 'upper';
    A.move = { kind, t: 0, T: MOVE_T[kind], side: (b.n + (A.side === 'hero' ? 0 : 1)) % 2 };
    b.hit = { at: b.t + MOVE_T[kind] * 0.45, by: A, to: T, kind, fin };
    b.n++; b.next = b.t + 0.5 + Math.random() * 0.2;
    return false;
  }

  // a blow arrives: blocked, or it lands (the last one, the finisher, decides who goes flying)
  land(b, w) {
    const D = this.D, { fire } = D.ctx, A = w.by, T = w.to; if (!T || T.tossed || T.gone) return;
    const [fx, fz] = fwd(A), cx = A.x + fx * 1.9, cz = A.z + fz * 1.9, cy = (A.y || 0) + (w.kind === 'kick' ? 2.0 : 3.3);
    if (w.fin) return this.finish(b, w);
    const gang = (T.side === 'hero' ? b.villains.length : b.heroes.length) > (T.side === 'hero' ? b.heroes.length : b.villains.length);
    const guard = T.side === 'villain' ? 0.38 : gang ? 0.15 : 0.3; // the villains defend themselves; one against two can hardly cover up
    if (!(T.move && T.move.kind === 'hit') && Math.random() < guard) {
      T.move = { kind: 'block', t: 0, T: MOVE_T.block, side: 0 }; T.knock = 0.4;
      fire.burst(cx, cy, cz, 6, 0.8); sfx('thud', cx, cy, cz, { gain: 0.55, rate: 1.6 });
      return;
    }
    T.move = { kind: 'hit', t: 0, T: MOVE_T.hit, side: 0 }; T.knock = w.kind === 'punch' ? 1.0 : 1.5;
    fire.burst(cx, cy, cz, w.kind === 'punch' ? 10 : 14, w.kind === 'punch' ? 1.3 : 1.7);
    sfx('thud', cx, cy, cz, { gain: w.kind === 'punch' ? 1.0 : 1.25, rate: w.kind === 'kick' ? 0.85 : 1 });
    if (this.near(cx, cz)) D.shake(w.kind === 'punch' ? 0.1 : 0.18);
    if (T.side === 'villain') this.B.hurt(T, DMG[w.kind], A); // a villain worn down to nothing is beaten (Villains.beat)
  }

  // the last blow: whoever loses is sent flying (one against two usually goes down)
  finish(b, w) {
    const D = this.D, A = w.by, T = w.to, H = b.heroes.length, V = b.villains.length;
    const villainsLose = H > V ? Math.random() < 0.75 : V > H ? Math.random() < 0.25 : Math.random() < 0.58;
    const loser = villainsLose ? (T.side === 'villain' ? T : b.villains[0]) : (T.side === 'hero' ? T : b.heroes[0]);
    const winner = loser === T ? A : this.foeOf(b, loser) || A;
    if (winner !== A) { winner.move = { kind: w.kind, t: 0, T: MOVE_T[w.kind], side: 0 }; }
    const dx = loser.x - winner.x, dz = loser.z - winner.z, dl = Math.hypot(dx, dz) || 1, up = w.kind === 'upper' ? 16 : 8;
    for (const f of [...b.heroes, ...b.villains]) this.release(f, f === loser ? 0 : 0.6);
    if (Math.random() < 0.4 && this.B.stunts.slam(winner, loser)) { b.over = b.t + 0.6; return; } // up into the sky and hammered back down
    const p = [(loser.x + winner.x) / 2, (loser.y || 0) + 3, (loser.z + winner.z) / 2];
    D.ctx.fire.burst(p[0], p[1], p[2], 22, 2.4); sfx('thud', p[0], p[1], p[2], { gain: 1.4, rate: 0.75 }); if (this.near(p[0], p[2])) D.shake(0.35);
    toss(loser, dx / dl * 30, up, dz / dl * 30);
    if (loser.side === 'villain') this.B.hurt(loser, 30, winner);
    const how = w.kind === 'upper' ? ' with an uppercut' : ' with a flying kick';
    if (loser.side === 'hero' && V > 1) this.B.say('gang' + loser.name, b.villains.map(v => v.name).join(' and ') + ' ganged up on ' + loser.name + ' and knocked them flying!');
    else this.B.say('ko' + loser.name, winner.name + ' sent ' + loser.name + ' flying' + how + '!');
    b.over = b.t + 0.6;
  }

  near(x, z) { const { camera, controls } = this.D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.2; }

  // ---------- beam against beam
  clash(h, v) {
    if (!this.free(h) || !this.free(v) || this.clashCd > 0) return false;
    const D = this.D, k = kit(), dx = v.x - h.x, dz = v.z - h.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, span = clamp(l, 34, 60);
    const mx = (h.x + v.x) / 2, mz = (h.z + v.z) / 2, y = Math.max(28, (h.y + (v.y || 0)) / 2);
    const mk = (c, r) => { const m = new THREE.Mesh(k.ray, k.add(c, 0.95)); m.frustumCulled = false; m.renderOrder = 7; D.ctx.scene.add(m); return m; };
    const c = { h, v, t: 0, T: 3.2 + Math.random() * 1.2, s: 0.5, sv: 0, ux, uz, ax: mx - ux * span / 2, az: mz - uz * span / 2, bx: mx + ux * span / 2, bz: mz + uz * span / 2, y,
      bh: mk(BEAM[h.name] || BEAM.Nova), bv: mk(BEAM.Tyrant), glow: new THREE.Mesh(k.ball, k.add(new THREE.Color(1.6, 0.8, 1.1), 0.45)), core: new THREE.Mesh(k.ball, k.core), zapT: 0 };
    for (const m of [c.glow, c.core]) { m.frustumCulled = false; m.renderOrder = 8; D.ctx.scene.add(m); }
    h.beam = v.beam = c; h.vx = h.vy = h.vz = 0; h.hs = 0; v.speed = 0; v.hs = 0; v.ray = null;
    this.clashes.push(c); this.clashCd = 25;
    this.B.say('clash', h.name + ' and ' + v.name + ' locked beams!');
    return true;
  }
  clashStep(c, h) {
    const D = this.D, { fire } = D.ctx, H = c.h, V = c.v;
    c.t += h;
    if (H.tossed || V.tossed || H.state !== 'fly' || V.gone || V.beaten) { this.endClash(c, true); return true; }
    for (const [f, x, z, o] of [[H, c.ax, c.az, V], [V, c.bx, c.bz, H]]) {
      f.busyT = 0.25; f.x += (x - f.x) * Math.min(1, h * 4); f.z += (z - f.z) * Math.min(1, h * 4); f.y = (f.y || 0) + (c.y - (f.y || 0)) * Math.min(1, h * 4);
      const a = Math.atan2(o.x - f.x, o.z - f.z); let da = a - f.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); f.yaw += da * Math.min(1, h * 10);
    }
    // the meeting point is shoved back and forth as each pushes harder
    c.sv += (Math.random() - 0.5) * h * 3; c.sv *= Math.exp(-h * 1.5); c.s = clamp(c.s + c.sv * h, 0.28, 0.72);
    const [hx, hz] = fwd(H), [vx, vz] = fwd(V);
    const ha = H.name === 'Tempo' ? [H.x + hx * 1.5, H.y + SHOULDER - 0.2, H.z + hz * 1.5] : [H.x + hx * 0.3, H.y + EYE, H.z + hz * 0.3];
    const va = [V.x + vx * 0.3, (V.y || 0) + EYE, V.z + vz * 0.3];
    const px = ha[0] + (va[0] - ha[0]) * c.s, py = ha[1] + (va[1] - ha[1]) * c.s, pz = ha[2] + (va[2] - ha[2]) * c.s;
    const g = Math.min(1, c.t / c.T), pulse = 1 + 0.18 * Math.sin(c.t * 31);
    stretch(c.bh, ha[0], ha[1], ha[2], px, py, pz, 0.22 + 0.1 * g); stretch(c.bv, va[0], va[1], va[2], px, py, pz, 0.22 + 0.1 * g);
    c.glow.position.set(px, py, pz); c.glow.scale.setScalar((0.8 + 1.3 * g) * pulse); c.core.position.set(px, py, pz); c.core.scale.setScalar((0.35 + 0.55 * g) * pulse);
    if ((c.zapT -= h) <= 0) { c.zapT = 0.09; fire.burst(px, py, pz, 3 + Math.round(g * 4), 0.7 + g * 0.8); if (Math.random() < 0.3) sfx('zap', px, py, pz, { gain: 0.8, rate: 0.6 + g * 0.5 }); }
    if (this.near(px, pz)) D.shake(0.08 + g * 0.3);
    c.px = px; c.py = py; c.pz = pz;
    if (c.t >= c.T) { this.burst(c); return true; }
    return false;
  }
  // the ball of light bursts: a ring of force out across the sky, a flash, both knocked back, windows out below
  burst(c) {
    const D = this.D, { fire, city, traffic, people } = D.ctx, k = kit(), H = c.h, V = c.v, px = c.px, py = c.py, pz = c.pz;
    const ring = new THREE.Mesh(k.ring, k.add(new THREE.Color(1.8, 1.5, 1.4), 0.8)), shell = new THREE.Mesh(k.ball, k.add(new THREE.Color(1.2, 0.9, 1.0), 0.3));
    for (const m of [ring, shell]) { m.position.set(px, py, pz); m.frustumCulled = false; m.renderOrder = 8; D.ctx.scene.add(m); }
    this.waves = this.waves || []; this.waves.push({ ring, shell, t: 0 });
    fire.burst(px, py, pz, 24, 2.4); sfx('boomBig', px, py, pz); if (this.near(px, pz)) { D.shake(0.9); D.flash(0.35); }
    this.endClash(c, false);
    toss(H, -c.ux * 30, 10, -c.uz * 30); toss(V, c.ux * 30, 10, c.uz * 30); this.B.hurt(V, 40, H);
    city.buildingsNear(px, pz, 40, (kk, d, b) => { if (!city.dead[kk] && b.top > py - 25) D.blowWindows(kk, (b.x0 + b.x1) / 2 - px, (b.z0 + b.z1) / 2 - pz, 0.7); });
    traffic.near(px, pz, 26, (car) => { if (car.gone || car.mission || car.mode === 4 || car.mode === 5) return; const dx = car.x - px, dz = car.z - pz, d = Math.hypot(dx, dz) || 1; car.soft = true; traffic.fling(car, dx / d * 12, 6, dz / d * 12); });
    people.scare(px, pz, 60, 1);
    this.B.say('clashboom', 'The beams burst! The shock wave knocked ' + H.name + ' and ' + V.name + ' flying');
  }
  endClash(c, quiet) {
    const sc = this.D.ctx.scene; for (const m of [c.bh, c.bv, c.glow, c.core]) { sc.remove(m); m.material.dispose(); }
    for (const f of [c.h, c.v]) if (f.beam === c) { f.beam = null; f.busyT = quiet ? 0.2 : 0; }
  }

  // every so often: villains turn on a hero who comes close; a second villain joins a fight to gang up; a free hero
  // flies in to even it up; Tyrant and a hero with a beam lock beams across the street
  scan() {
    const B = this.B, H = B.fighters('hero'), V = B.fighters('villain');
    for (const v of V) {
      if (!this.free(v)) continue;
      let best = null, bd = 12; for (const h of H) { if (!this.free(h)) continue; const d = Math.hypot(h.x - v.x, h.z - v.z); if (d < bd && Math.abs((h.y || 0) - (v.y || 0)) < 12) { bd = d; best = h; } }
      if (best && Math.random() < 0.7) { this.start(best, v, true); continue; }
      if (v.name === 'Tyrant' && this.clashCd <= 0) for (const h of H) { if ((h.name === 'Nova' || h.name === 'Tempo') && this.free(h)) { const d = Math.hypot(h.x - v.x, h.z - v.z); if (d > 25 && d < 95 && Math.random() < 0.2 && this.clash(h, v)) break; } }
    }
    for (const b of this.bouts) {
      if (b.over) continue;
      if (b.villains.length === 1 && b.heroes.length === 1 && b.t > b.joinT) for (const v of V) { // a second villain piles in
        if (!this.free(v) || Math.hypot(v.x - b.cx, v.z - b.cz) > 150 || Math.random() > 0.5) continue;
        b.villains.push(v); this.enlist(v, b); b.max += 3;
        this.B.say('gangup' + v.name, b.villains.map(x => x.name).join(' and ') + ' are ganging up on ' + b.heroes[0].name + '!');
        break;
      } else if (b.heroes.length === 1 && b.villains.length === 2) for (const h of H) { // and a free hero comes to help
        if (!this.free(h) || Math.hypot(h.x - b.cx, h.z - b.cz) > 130 || Math.random() > 0.4) continue;
        b.heroes.push(h); this.enlist(h, b);
        this.B.say('help' + h.name, h.name + ' flew in to help ' + b.heroes[0].name + '!');
        break;
      }
    }
  }

  update(h) {
    this.clashCd = Math.max(0, this.clashCd - h);
    if ((this.scanT -= h) <= 0) { this.scanT = 0.4; this.scan(); }
    for (let i = this.bouts.length - 1; i >= 0; i--) if (this.boutStep(this.bouts[i], h)) { const b = this.bouts[i]; for (const f of [...b.heroes, ...b.villains]) if (f.fight === b) this.release(f); this.bouts.splice(i, 1); }
    for (let i = this.clashes.length - 1; i >= 0; i--) if (this.clashStep(this.clashes[i], h)) this.clashes.splice(i, 1);
    if (this.waves) for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.t += h; const k = w.t / 0.8;
      w.ring.scale.setScalar(2 + 55 * Math.sqrt(k)); w.ring.material.opacity = 0.8 * (1 - k); w.shell.scale.setScalar(2 + 12 * Math.sqrt(k)); w.shell.material.opacity = 0.3 * (1 - k) * (1 - k);
      if (k >= 1) { for (const m of [w.ring, w.shell]) { this.D.ctx.scene.remove(m); m.material.dispose(); } this.waves.splice(i, 1); }
    }
  }
}
