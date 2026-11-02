// The horde (Sean: dabble in the disaster fighting by fighting zombies; they should be easy, small against a hero, but hundreds at a
// time, a bite doing a little damage; keep punching and moving, they burst into dust when hit, and with so many it is hard not
// to get bitten). Nova on foot in the town's own streets with the fight test's body, clips and steady iso camera; the zombies are
// the town's (people.js), rained down round her and drawn to her (people.heroTg). Tap: a punch, in rhythm the combo, each blow
// dusting everyone in its arc; swipe: a dash that way, dusting anyone in the path; hold: a slam that clears a circle. A zombie
// that reaches her bites for a little. Clear them all, or be overrun. Leaving reloads the town, so the horde is gone with it.
import * as THREE from 'three';
import { heroRig } from './heroes.js';
import { CLIPS } from './clips.js';
import { Body, C, CSS } from './fighttest.js';
import { Streak } from './streak.js';
import { sfx } from './audio.js';
import { placeKey, travel } from './places.js';

const N0 = 300, BITE = 2.5, TAP_MS = 220, SWIPE_PX = 26, COMBO_T = 0.6, LUNGE_R = 11, EL = 0.58, AZ0 = Math.atan2(0.6, 0.8);
// the blows: the clip, when the blow lands, when it can be followed, how far it reaches, how wide (the cosine of the half angle; -1: all round)
const ATK = {
  jabL: { clip: CLIPS.jabL, at: 0.08, end: 0.24, r: 3.2, arc: 0.4 },
  jabR: { clip: CLIPS.jabR, at: 0.08, end: 0.24, r: 3.2, arc: 0.4 },
  cross: { clip: CLIPS.cross, at: 0.1, end: 0.42, r: 3.8, arc: 0 },
  heavy: { clip: CLIPS.hammerDown, at: 0.12, end: 0.45, r: 5.5, arc: -1 },
};
const COMBO = ['jabL', 'jabR', 'cross'];
const ZST = new Set([5, 6, 7]); // turning, zombie, falling (people.js ST)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Horde {
  constructor(g, ctx) { this.g = g; this.ctx = ctx; this.active = false; this.near = 1.5; this.focus = 60; this.lod = 0; }
  start() {
    const g = this.g; for (const p of [g.flight, g.drive, g.takeover, g.bandGame, g.fightTest]) if (p && p.active) p.stop(true); if (g.takeover && g.takeover.picking) g.takeover.endPick();
    const P = g.people, B = g.city.bounds, { camera, controls, post } = this.ctx, S = g.disasters.ctx.scene, p = P.snapWalkable((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, 80);
    this.cx = p ? p[0] : (B.x0 + B.x1) / 2; this.cz = p ? p[1] : (B.z0 + B.z1) / 2;
    this.active = true; controls.enabled = false; g.setFollow(-1); document.body.classList.add('zd-flying'); post.opts.dof = true;
    this.h = new Body(heroRig('Nova'), 100); S.add(this.h.r.root); this.streak = new Streak(S, [1.6, 0.5, 1.4]); this.ids = [];
    if (!document.getElementById('zd-fight-css')) { const s = document.createElement('style'); s.id = 'zd-fight-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.ui(); this.restart();
    camera.fov = innerWidth < innerHeight ? 28 : 18; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); this.place(1); camera.position.copy(this.camTo);
  }
  ui() {
    const el = this.el = document.createElement('div'); el.id = 'zd-fight';
    el.innerHTML = '<div class="bars"><div>NOVA<div class="hp"><i class="hh" style="background:linear-gradient(90deg,#ff5ad5,#ffd27a)"></i></div></div><div style="text-align:right">ZOMBIES <span class="zc">0</span><div class="hp"><i class="vh" style="margin-left:auto;background:linear-gradient(90deg,#6fa84a,#b9d96a)"></i></div></div></div><div class="say"></div><div class="hint">TAP punch (in rhythm, a combo) &middot; SWIPE dash through them &middot; HOLD a slam that clears a circle<br>Keep moving: a bite takes a little, hundreds take a lot</div><div class="acts"><button type="button" data-a="again">Restart</button><button type="button" data-a="exit">Leave</button></div>';
    document.body.appendChild(el); this.hh = el.querySelector('.hh'); this.vh = el.querySelector('.vh'); this.zc = el.querySelector('.zc'); this.sayEl = el.querySelector('.say');
    el.querySelector('[data-a="again"]').onclick = (e) => { e.stopPropagation(); this.restart(); }; el.querySelector('[data-a="exit"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
    this.ptrs = new Map();
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), used: false }); });
    el.addEventListener('pointermove', (e) => { const p = this.ptrs.get(e.pointerId); if (!p || p.used) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.hypot(dx, dy) > SWIPE_PX && performance.now() - p.t < 450) { p.used = true; this.swipe(dx, dy); } });
    const up = (e) => { const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId); if (p.held) { this.release(); return; } if (!p.used && performance.now() - p.t < 450) this.tap(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => { const p = this.ptrs.get(e.pointerId); this.ptrs.delete(e.pointerId); if (p && p.held) this.release(); });
    this.onKey = (e) => { if (e.repeat) return; if (e.key === 'Escape') this.stop(); if (e.key === ' ') this.tap(); const d = { arrowleft: [-40, 0], arrowright: [40, 0], arrowup: [0, -40], arrowdown: [0, 40] }[e.key.toLowerCase()]; if (d) this.swipe(d[0], d[1]); }; addEventListener('keydown', this.onKey);
  }
  restart() {
    const h = this.h, P = this.g.people; if (this.endEl) { this.endEl.remove(); this.endEl = null; }
    for (const j of this.ids) P.vanish(j); this.pool = this.ids.slice(); this.ids.length = 0; // the last round's horde gone, its slots dropped again
    Object.assign(h, { x: this.cx, z: this.cz, y: P.groundY(this.cx, this.cz), vx: 0, vz: 0, vy: 0, hp: h.hpMax, yaw: 0 }); h.go('idle', C.guard);
    P.heroTg = { x: h.x, z: h.z, R: 90, bites: 0 }; this.bitesSeen = 0; this.bitten = 0; this.kills = 0; this.left = N0; this.toDrop = N0; this.dropT = 0; this.time = 0; this.over = false; this.combo = 0; this.comboT = 0; this.buffer = false; this.charging = false; this.atk = null; this.hits = 0; this.hitsT = 0; this.countT = 0; this.say('', 0);
    const hi = this.el.querySelector('.hint'); hi.style.opacity = '0.9'; clearTimeout(this.hintT); this.hintT = setTimeout(() => { hi.style.opacity = '0'; }, 12000);
  }
  stop() { if (!this.active) return; this.active = false; this.g.people.heroTg = null; removeEventListener('keydown', this.onKey); travel(placeKey(), 'sandbox'); }
  say(text, T = 0.7, col = '#fff') { this.sayEl.textContent = text; this.sayEl.style.color = col; this.sayEl.style.opacity = text ? '1' : '0'; this.sayT = T; }
  // ---------- input
  tap() { const h = this.h; if (this.over) return; if (h.state === 'idle') this.nextAtk(); else if (h.state === 'attack' || h.state === 'lunge') this.buffer = true; }
  nextAtk() { if (this.comboT <= 0) this.combo = 0; this.startAtk(COMBO[this.combo % 3]); }
  // the nearest zombie: faced, and lunged at when out of reach
  startAtk(name) { const h = this.h, A = ATK[name], n = this.nearest(LUNGE_R); this.atk = name; this.landed = false; this.buffer = false; this.comboT = 0; if (n) { h.yaw = Math.atan2(n[0] - h.x, n[1] - h.z); if (n[2] > A.r - 0.8 && A !== ATK.heavy) { this.lx = n[0]; this.lz = n[1]; h.go('lunge', C.guard); sfx('whoosh', h.x, h.y, h.z, { gain: 0.5, rate: 1.5 }); return; } } h.go('attack', A.clip); }
  nearest(R) { const P = this.g.people, h = this.h; let bd = R * R, b = null; P.around(h.x, h.z, R, (j, d2) => { if (d2 < bd && ZST.has(P.st[j]) && P.lvl[j] === -1) { bd = d2; b = [P.x[j], P.z[j], Math.sqrt(d2)]; } }); return b; }
  swipe(dx, dy) {
    const h = this.h; if (this.over || !['idle', 'attack', 'lunge', 'charge'].includes(h.state)) return;
    const cam = this.ctx.camera; _a.setFromMatrixColumn(cam.matrixWorld, 0); _a.y = 0; _a.normalize(); cam.getWorldDirection(_b); _b.y = 0; _b.normalize(); const l = Math.hypot(dx, dy) || 1, wx = _a.x * dx / l - _b.x * dy / l, wz = _a.z * dx / l - _b.z * dy / l, wl = Math.hypot(wx, wz) || 1;
    h.vx = wx / wl * 27; h.vz = wz / wl * 27; h.go('dodge', C.dodge); h.yaw = Math.atan2(h.vx, h.vz); this.combo = 0; this.comboT = 0; this.buffer = false; this.charging = false; this.atk = null; this.dashed = 0; sfx('whoosh', h.x, h.y, h.z, { gain: 0.8, rate: 1.1 });
  }
  hold() { const h = this.h; if (this.over || !['idle', 'attack'].includes(h.state) || (h.state === 'attack' && !this.landed)) return false; h.go('charge', C.charge); this.charging = true; this.k = 0; return true; }
  release() { const h = this.h; if (h.state !== 'charge') return; this.charging = false; this.startAtk('heavy'); }
  // ---------- each frame
  frame(dt, tg) {
    const g = this.g, h = this.h, P = g.people; if (this.ptrs) for (const p of this.ptrs.values()) if (!p.used && !p.held && performance.now() - p.t > TAP_MS) { p.used = true; if (this.hold()) p.held = true; }
    if (!g.paused && dt > 0) {
      this.time += dt; if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.say('', 0); } if (this.hitsT > 0) { this.hitsT -= dt; if (this.hitsT <= 0) this.hits = 0; } if (this.comboT > 0) this.comboT -= dt;
      // the horde rains down round her, a few at a time
      if (this.toDrop > 0 && !this.over) { this.dropT -= dt; while (this.dropT <= 0 && this.toDrop > 0) { this.dropT += 0.03; const a = Math.random() * 6.28, r = 12 + Math.random() * 36, j = P.drop(h.x + Math.cos(a) * r, h.z + Math.sin(a) * r, -1, this.pool.length ? this.pool.pop() : -1); if (j < 0) { this.toDrop = 0; break; } this.ids.push(j); this.toDrop--; } }
      P.heroTg.x = h.x; P.heroTg.z = h.z; const b = P.heroTg.bites; if (b > this.bitesSeen && !this.over) { this.bite(b - this.bitesSeen); this.bitesSeen = b; }
      this.heroStep(dt); h.pose(dt, h.y, h.state !== 'down'); this.streak.update(_c.set(h.x, h.y + 2.2, h.z), h.state === 'lunge' || h.state === 'dodge', this.ctx.camera, dt);
      if ((this.countT -= dt) <= 0) { this.countT = 0.4; let n = 0; for (const j of this.ids) if (ZST.has(P.st[j])) n++; this.left = n + this.toDrop; this.zc.textContent = this.left; this.vh.style.width = Math.min(100, this.left / N0 * 100) + '%'; if (this.left === 0 && !this.over) this.finish(true); }
      this.hh.style.width = Math.max(0, h.hp / h.hpMax * 100) + '%';
    }
    this.place(dt); g.focusAt = _a.copy(this.look); tg.set(g.focusAt.x, 0, g.focusAt.z); this.focus = this.ctx.camera.position.distanceTo(g.focusAt);
  }
  // only the streets: a step that leaves them is taken back
  move(dx, dz) { const h = this.h, P = this.g.people, nx = h.x + dx, nz = h.z + dz; if (P.walkable(nx, nz)) { h.x = nx; h.z = nz; } else if (P.walkable(nx, h.z)) { h.x = nx; } else if (P.walkable(h.x, nz)) { h.z = nz; } else { h.vx = 0; h.vz = 0; } h.y = P.groundY(h.x, h.z); }
  heroStep(dt) {
    const h = this.h; h.t += dt; h.walkK *= Math.exp(-dt * 10);
    switch (h.state) {
      case 'idle': { this.move(h.vx * dt, h.vz * dt); const k = Math.exp(-7 * dt); h.vx *= k; h.vz *= k; const n = this.nearest(14); if (n) { let a = Math.atan2(n[0] - h.x, n[1] - h.z) - h.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); h.yaw += a * Math.min(1, dt * 10); } if (h.clip !== C.guard) h.play(C.guard); break; }
      case 'lunge': { const A = ATK[this.atk], dx = this.lx - h.x, dz = this.lz - h.z, d = Math.hypot(dx, dz) || 1; if (d <= A.r - 1 || h.t > 0.5) { h.go('attack', A.clip); break; } this.move(dx / d * 22 * dt, dz / d * 22 * dt); h.phase += dt * 30; h.walkK = 0.6; break; }
      case 'attack': { const A = ATK[this.atk]; if (!this.landed && h.t >= A.at) { this.landed = true; this.contact(A); } if (h.t >= A.end) this.afterAtk(); else if (this.buffer && this.landed && h.t >= A.at + 0.09 && COMBO.includes(this.atk)) this.afterAtk(); break; }
      case 'charge': this.k = Math.min(1, this.k + dt / 0.9); if (Math.random() < 0.3 * this.k) this.g.disasters.brawl.stunts.ring(h.x, h.y + 0.3, h.z, 1.6 + 2 * this.k, 0.25, new THREE.Color(1.6, 0.5, 1.4), 0.6); break;
      case 'dodge': { this.move(h.vx * dt, h.vz * dt); const k = Math.exp(-4 * dt); h.vx *= k; h.vz *= k; this.sweep(h.x, h.z, 1.5, 'dash'); if (h.t > 0.26) { h.vx *= 0.15; h.vz *= 0.15; h.go('idle', C.guard); } break; }
      case 'down': break;
      default: break;
    }
  }
  afterAtk() { const h = this.h; const was = this.atk; if (COMBO.includes(was)) { const i = COMBO.indexOf(was); this.combo = i === 2 ? 0 : i + 1; this.comboT = i === 2 ? 0 : COMBO_T; } this.atk = null; const b = this.buffer; this.buffer = false; h.go('idle', C.guard); if (b && this.combo > 0) this.nextAtk(); }
  // the blow: everyone in its arc is dust
  contact(A) {
    const h = this.h, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), n = this.sweep(h.x, h.z, A.r, 'blow', (dx, dz, d) => (dx * fx + dz * fz) / (d || 1) >= A.arc);
    if (!n) { sfx('whoosh', h.x, h.y + 2, h.z, { gain: 0.4, rate: 1.7 }); return; }
    this.hits += n; this.hitsT = 1.2; this.say(this.hits + ' DUSTED', 0.7, '#ffd27a'); this.g.hitStop = Math.max(this.g.hitStop || 0, A === ATK.heavy ? 0.08 : 0.03); this.g.shake = Math.max(this.g.shake || 0, A === ATK.heavy ? 0.5 : 0.1);
    if (A === ATK.heavy) { this.g.disasters.brawl.stunts.ring(h.x, h.y + 0.3, h.z, A.r + 1, 0.35, new THREE.Color(1.2, 1.1, 0.9), 0.6); sfx('crash', h.x, h.y, h.z, { gain: 1, rate: 0.7 }); } else sfx('thud', h.x, h.y + 2, h.z, { gain: 0.8, rate: 1.3 });
  }
  sweep(x, z, R, how, test) { const P = this.g.people, D = this.g.disasters; let n = 0; P.around(x, z, R, (j, d2) => { if (!ZST.has(P.st[j]) || P.lvl[j] !== -1) return; const dx = P.x[j] - x, dz = P.z[j] - z; if (test && !test(dx, dz, Math.sqrt(d2))) return; const zx = P.x[j], zy = P.y[j], zz = P.z[j]; if (!P.vanish(j)) return; n++; this.kills++; for (let i = 0; i < 4; i++) { const s = 0.15 + Math.random() * 0.3; D.debris.add(zx, zy + 0.3 + Math.random() * 1.2, zz, s, s * 0.7, s, Math.random() < 0.5 ? 0x9a9184 : 0x6f6a5e, 'fly', { v: [(Math.random() - 0.5) * 9 + dx, 2 + Math.random() * 5, (Math.random() - 0.5) * 9 + dz], life: 0.8 }); } if (n < 6) D.brawl.stunts.ring(zx, zy + 1, zz, 1.3, 0.22, new THREE.Color(0.9, 0.85, 0.7), 0.6); }); if (n && how === 'dash') { this.hits += n; this.hitsT = 1.2; this.say(this.hits + ' DUSTED', 0.7, '#ffd27a'); sfx('thud', x, 1, z, { gain: 0.6, rate: 1.5 }); } return n; }
  bite(n) { const h = this.h; h.hp -= BITE * n; this.bitten += n; this.g.shake = Math.max(this.g.shake || 0, 0.25); this.g.disasters.brawl.stunts.ring(h.x, h.y + 2.5, h.z, 1.6, 0.18, new THREE.Color(2.2, 0.4, 0.3), 0.9); sfx('thud', h.x, h.y + 2, h.z, { gain: 0.9, rate: 0.8 }); this.say('BITTEN!', 0.6, '#ff8a7a'); if (h.hp <= 0) { h.hp = 0; h.go('down', C.down); this.finish(false); } }
  finish(won) { if (this.over) return; this.over = true; this.g.people.heroTg = null; const e = this.endEl = document.createElement('div'); e.className = 'end'; e.innerHTML = (won ? 'STREET CLEARED<br><small style="font-size:14px">' + this.kills + ' dusted in ' + Math.round(this.time) + ' s, bitten ' + this.bitten + ' times</small>' : 'OVERRUN<br><small style="font-size:14px">' + this.kills + ' dusted in ' + Math.round(this.time) + ' s</small>') + '<button type="button">Again</button>'; e.querySelector('button').onclick = (ev) => { ev.stopPropagation(); this.restart(); }; this.el.appendChild(e); }
  // the camera: one steady angle over her, swung round any building that hides her
  place(dt) {
    const h = this.h, cam = this.ctx.camera, D = 36, ce = Math.cos(EL) * D; this.look = this.look || new THREE.Vector3(h.x, h.y + 2, h.z); this.look.lerp(_c.set(h.x, h.y + 2, h.z), Math.min(1, dt * 8));
    if (this.az == null) { this.az = this.azTo = AZ0; } const cy = this.look.y + Math.sin(EL) * D, at = (a) => _a.set(this.look.x + Math.sin(a) * ce, cy, this.look.z + Math.cos(a) * ce);
    if ((this.nearT = (this.nearT || 0) - dt) <= 0) { this.nearT = 0.5; const c = this.g.city, L = this.nearB = []; c.buildings.forEach((b, k) => { if (!c.dead[k] && Math.abs((b.x0 + b.x1) / 2 - h.x) < 70 && Math.abs((b.z0 + b.z1) / 2 - h.z) < 70) L.push(b); }); }
    if (this.hidden(at(this.azTo))) { let best = null; for (let k = 1; k <= 8 && best == null; k++) for (const sg of [1, -1]) { const a = this.azTo + sg * k * 0.3; if (!this.hidden(at(a))) { best = a; break; } } if (best != null) this.azTo = best; } else if (Math.abs(this.azTo - AZ0) > 0.01 && !this.hidden(at(AZ0))) this.azTo = AZ0;
    this.az += (this.azTo - this.az) * Math.min(1, dt * 2.2); this.camTo = this.camTo || new THREE.Vector3(); this.camTo.copy(at(this.az)); cam.position.copy(this.camTo); cam.lookAt(this.look);
  }
  hidden(c) { const h = this.h, fy = h.y + 2; for (const b of this.nearB || []) { for (let i = 1; i < 14; i++) { const t = i / 14, x = c.x + (h.x - c.x) * t, z = c.z + (h.z - c.z) * t, y = c.y + (fy - c.y) * t; if (x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5 && y < b.roofY) return true; } } return false; }
}
