// The rogue army (HERO-PLAN 3f.2; from Sean's street-fight inspiration): they can't tell the hero from the villains. Two jets high
// over town fire missiles at both; two helicopters hover close and shoot; a squad of soldiers on the street shoots at the villains
// and gets cornered by them. The hero can catch a missile aimed at them and throw it at a villain, catch a helicopter a villain has
// knocked out of the air, and pull a cornered soldier out of trouble, all by tapping a circle. Three saves and the commander calls
// it off: the army stops shooting at the hero and goes for the villains only. Soldiers and crews are knocked flat, not killed.
// Turned on with Rogue army in the hero lab; flight.js makes one at take-off and steps it.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { toss } from './brawl.js';
import { LAB } from './lab.js';

const CSS = `
#zd-army{position:fixed;left:0;top:0;right:0;bottom:0;z-index:30;pointer-events:none}
#zd-army .c{position:absolute;width:72px;height:72px;margin:-36px 0 0 -36px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font:900 12px system-ui,-apple-system,sans-serif;text-shadow:0 1px 3px #000;pointer-events:auto;cursor:pointer;touch-action:none}
#zd-army .c.catch{background:radial-gradient(circle,rgba(255,170,60,.95),rgba(220,80,20,.6) 62%,rgba(220,80,20,0) 74%);box-shadow:0 0 16px 5px rgba(255,150,60,.8)}
#zd-army .c.save{background:radial-gradient(circle,rgba(120,255,160,.95),rgba(30,170,90,.6) 62%,rgba(30,170,90,0) 74%);box-shadow:0 0 16px 5px rgba(120,255,160,.8)}
#zd-army .trust{position:absolute;left:12px;top:calc(10px + env(safe-area-inset-top));padding:5px 8px;border-radius:8px;background:rgba(20,24,14,.72);color:#dfe8c8;font:800 11px system-ui,-apple-system,sans-serif}
`;
const OLIVE = () => new THREE.MeshStandardMaterial({ color: '#59643f', roughness: 0.9 });
const _p = new THREE.Vector3();
export class Army {
  constructor(F) {
    this.F = F; const g = this.g = F.g; this.D = g.disasters; this.scene = this.D.ctx.scene; this.t = 0; this.saves = 0; this.friendly = false; this.fireT = 3; this.heliT = 16; this.dangerT = 9; this.parts = [];
    if (!document.getElementById('zd-army-css')) { const s = document.createElement('style'); s.id = 'zd-army-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div'); this.el.id = 'zd-army'; this.el.innerHTML = '<div class="trust"></div>'; document.body.appendChild(this.el); this.tr = this.el.querySelector('.trust');
    const B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2; this.cx = cx; this.cz = cz;
    this.jets = [0, Math.PI].map(a => { const o = buildVehicle('a10'); o.scale.setScalar(2.2); this.scene.add(o); return { o, a }; });
    this.helis = [0, 1].map(i => { const o = buildVehicle('heli_rescue'); o.scale.setScalar(1.8); o.traverse(m => { if (m.isMesh && m.material && m.material.color) { m.material = m.material.clone(); m.material.color.set('#7f8d5f'); } }); this.scene.add(o); return { o, i, x: cx + (i ? 80 : -80), y: 90, z: cz + 60, shot: 1 + i, state: 'fly', c: null, vy: 0 }; });
    this.mats = OLIVE(); this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.squad = []; for (let i = 0; i < 6 && this.squad.length < 6; i++) { let x = cx, z = cz, ok = false; for (let k = 0; k < 20 && !ok; k++) { const a = Math.random() * 6.28, r = 20 + Math.random() * 40; x = cx + Math.cos(a) * r; z = cz + Math.sin(a) * r; ok = true; g.city.buildingsNear(x, z, 2, () => { ok = false; }); } if (ok) this.squad.push(this.soldier(x, z)); }
    this.missiles = []; this.lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.8), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); this.lines.frustumCulled = false; this.scene.add(this.lines);
    F.tip('A rogue army unit has arrived, and it is shooting at everyone! Save them and they may come round');
    sfx('horn', cx, 40, cz, { gain: 0.6 }); this.say();
  }
  soldier(x, z) {
    const g = new THREE.Group(), y = this.g.people.groundY(x, z), box = (sx, sy, sz, px, py, pz, m = this.mats) => { const b = new THREE.Mesh(this.geo, m); b.scale.set(sx, sy, sz); b.position.set(px, py, pz); b.castShadow = true; g.add(b); };
    box(0.5, 0.75, 0.3, 0, 1.25, 0); box(0.2, 0.85, 0.22, -0.13, 0.43, 0); box(0.2, 0.85, 0.22, 0.13, 0.43, 0); box(0.3, 0.28, 0.32, 0, 1.8, 0); box(0.13, 0.13, 0.75, 0.2, 1.3, 0.35);
    g.position.set(x, y, z); g.rotation.y = Math.random() * 6.28; this.scene.add(g); return { o: g, x, y, z, down: false, shot: Math.random() * 2, c: null, vy: 0, vx: 0, vz: 0 };
  }
  say() { this.tr.textContent = this.friendly ? 'ARMY: ON YOUR SIDE' : 'ARMY: HOSTILE · saves ' + this.saves + '/3'; }
  saved() { this.saves++; LAB.stats.saved = (LAB.stats.saved || 0) + 1; if (!this.friendly && this.saves >= 3) { this.friendly = true; this.F.tip('Commander: hold your fire! That one is on our side. Target the villains'); sfx('chime', this.F.pos.x, this.F.pos.y, this.F.pos.z, { gain: 0.9 }); } this.say(); }
  villains() { const o = []; for (const e of this.D.list) if (e.alive && e.type === 'villains') for (const w of e.who) if (!w.gone && !w.beaten && !w.leaving) o.push(w); return o; }
  // a tappable circle that follows a place on the screen
  circle(kind, label, fn) { const c = document.createElement('div'); c.className = 'c ' + kind; c.textContent = label; c.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (c.done) return; c.done = true; c.remove(); fn(); }); this.el.appendChild(c); return c; }
  place(c, x, y, z) { _p.set(x, y, z).project(this.D.ctx.camera); const on = _p.z < 1; c.style.display = on ? '' : 'none'; if (on) { c.style.left = Math.max(50, Math.min(innerWidth - 100, (_p.x + 1) / 2 * innerWidth)) + 'px'; c.style.top = Math.max(120, Math.min(innerHeight - 200, (1 - _p.y) / 2 * innerHeight)) + 'px'; } }
  drop(c) { if (c) { c.done = true; c.remove(); } }
  fire(from) {
    const vs = this.villains(), F = this.F, hero = !this.friendly && F.state === 'fly' && (!vs.length || Math.random() < 0.55), tg = hero ? null : vs[Math.floor(Math.random() * vs.length)]; if (!hero && !tg) return;
    const m = new THREE.Mesh(this.geo, this.mats); m.scale.set(0.4, 0.4, 1.8); m.position.copy(from); this.scene.add(m);
    const s = { m, t: 0, tg, hero, c: null, speed: 85 }; this.missiles.push(s); sfx('whoosh', from.x, from.y, from.z, { gain: 0.8, rate: 0.7 });
    if (hero) s.c = this.circle('catch', 'CATCH', () => { s.c = null; const w = this.villains().sort((a, b) => Math.hypot(a.x - F.pos.x, a.z - F.pos.z) - Math.hypot(b.x - F.pos.x, b.z - F.pos.z))[0]; s.hero = false; s.tg = w || null; s.t = Math.min(s.t, 3); m.position.set(F.pos.x, F.pos.y + 2, F.pos.z); s.speed = 110; F.punch = 0.4; sfx('thud', F.pos.x, F.pos.y, F.pos.z, { gain: 0.9 }); F.tip(w ? 'Caught it! Thrown at ' + w.name : 'Caught it!'); });
  }
  boom(m, big) { const f = this.g.fire, p = m.position; f.burst(p.x, p.y, p.z, big ? 18 : 12, big ? 2.4 : 1.8); sfx('boom', p.x, p.y, p.z, { gain: 0.6 }); }
  step(h) {
    const F = this.F, g = this.g, D = this.D, vs = this.villains(), cam = D.ctx.camera; this.t += h; let ln = 0; const P = this.lines.geometry.attributes.position.array;
    const shot = (ax, ay, az, bx, by, bz) => { if (ln >= 8) return; const o = ln * 6; P[o] = ax; P[o + 1] = ay; P[o + 2] = az; P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz; ln++; };
    for (const j of this.jets) { j.a += h * 0.28; const x = this.cx + Math.cos(j.a) * 300, z = this.cz + Math.sin(j.a) * 300; j.o.position.set(x, 240, z); j.o.rotation.y = -j.a - Math.PI / 2; }
    if ((this.fireT -= h) <= 0) { this.fireT = 3.5 + Math.random() * 3; const j = this.jets[Math.floor(Math.random() * 2)]; this.fire(j.o.position); }
    for (const s of this.missiles) {
      s.t += h; const m = s.m, tx = s.hero ? F.pos.x : s.tg ? s.tg.x : m.position.x, ty = s.hero ? F.pos.y + 1 : s.tg ? (s.tg.y || 0) + 2 : 0, tz = s.hero ? F.pos.z : s.tg ? s.tg.z : m.position.z;
      _p.set(tx - m.position.x, ty - m.position.y, tz - m.position.z); const d = _p.length() || 1; m.position.addScaledVector(_p, Math.min(1, s.speed * h / d)); m.lookAt(tx, ty, tz); if (Math.random() < 0.6) g.fire.spray(m.position.x, m.position.z, m.position.y, 1, 0.3, 0.6);
      if (s.c) this.place(s.c, m.position.x, m.position.y, m.position.z);
      if (d < 3 || s.t > 7 || m.position.y < 0.5 || (s.tg && (s.tg.gone || s.tg.beaten))) {
        s.done = true; this.boom(m, s.t <= 7);
        if (d < 3 && s.hero) { F.damage(LAB.villainHit(10), 'A missile hit you!'); g.shake = Math.max(g.shake || 0, 0.5); }
        if (d < 3 && s.tg) { D.brawl.hurt(s.tg, 30, { name: 'The army' }); s.tg.flinch = 1; }
      }
    }
    if (this.missiles.some(s => s.done)) { for (const s of this.missiles) if (s.done) { this.scene.remove(s.m); this.drop(s.c); s.c = null; } this.missiles = this.missiles.filter(s => !s.done); }
    for (const H of this.helis) {
      if (H.state === 'gone') continue; const o = H.o;
      if (H.state === 'fly') {
        const a = this.t * 0.3 + H.i * 3.14, tx = F.pos.x + Math.cos(a) * 60, tz = F.pos.z + Math.sin(a) * 60, ty = Math.max(90, F.pos.y + 30); H.x += (tx - H.x) * h * 0.5; H.y += (ty - H.y) * h * 0.5; H.z += (tz - H.z) * h * 0.5;
        if ((H.shot -= h) <= 0) { H.shot = 0.25; const tg = this.friendly ? vs[H.i % Math.max(1, vs.length)] : H.i % 2 && vs.length ? vs[0] : null, hx = tg ? tg.x : F.pos.x, hy = tg ? (tg.y || 0) + 2 : F.pos.y + 1, hz = tg ? tg.z : F.pos.z; shot(H.x, H.y, H.z, hx + (Math.random() - 0.5) * 3, hy + (Math.random() - 0.5) * 3, hz + (Math.random() - 0.5) * 3); if (Math.random() < 0.2) sfx('rifle', H.x, H.y, H.z, { gain: 0.35 }); if (!tg && F.state === 'fly' && Math.random() < 0.14) F.damage(LAB.villainHit(1.5), 'The helicopters are shooting at you!'); }
      } else if (H.state === 'fall') {
        H.t += h; H.vy -= 18 * h; H.y += H.vy * h; o.rotation.y += h * 4; if (H.c) this.place(H.c, H.x, H.y, H.z); if (Math.random() < 0.5) g.fire.spray(H.x, H.z, H.y, 2, 1, 1.4);
        const gy = g.people.groundY(H.x, H.z); if (H.y <= gy + 1) { this.drop(H.c); H.c = null; H.y = gy + 1; H.state = 'wreck'; g.fire.dustCloud(H.x, H.z, 6, 6); g.fire.burst(H.x, gy + 1, H.z, 16, 2.2); sfx('crash', H.x, gy, H.z, { gain: 1 }); LAB.stats.hurt += 1; o.rotation.z = 0.5; }
      } else if (H.state === 'safe') { const gy = g.people.groundY(H.x, H.z); H.y += (gy + 1 - H.y) * h * 0.8; if (H.y < gy + 1.3) H.state = 'landed'; }
      o.position.set(H.x, H.y, H.z); if (H.state === 'fly') o.rotation.y = Math.atan2(-(F.pos.z - H.z), F.pos.x - H.x);
    }
    if ((this.heliT -= h) <= 0) { this.heliT = 18 + Math.random() * 8; const H = this.helis.find(q => q.state === 'fly'); if (H && vs.length) { H.state = 'fall'; H.t = 0; H.vy = 0; g.fire.burst(H.x, H.y, H.z, 10, 1.6); sfx('crash', H.x, H.y, H.z, { gain: 0.9 }); F.tip(vs[0].name + ' knocked a helicopter out of the sky! Catch it!'); H.c = this.circle('save', 'CATCH', () => { H.c = null; H.state = 'safe'; F.punch = 0.4; F.tip('You set the helicopter down safely'); this.saved(); }); } }
    for (const S of this.squad) {
      if (S.down) { if (S.vy !== 0) { S.vy -= 20 * h; S.x += S.vx * h; S.z += S.vz * h; S.y += S.vy * h; const gy = g.people.groundY(S.x, S.z); if (S.y <= gy) { S.y = gy; S.vy = 0; } S.o.position.set(S.x, S.y, S.z); } continue; }
      if (S.c) { this.place(S.c, S.x, S.y + 2, S.z); if ((S.ct -= h) <= 0) { this.drop(S.c); S.c = null; const dx = S.x - S.th.x, dz = S.z - S.th.z, d = Math.hypot(dx, dz) || 1; S.down = true; S.vx = dx / d * 8; S.vz = dz / d * 8; S.vy = 7; S.o.rotation.x = 1.5; sfx('thud', S.x, S.y, S.z, { gain: 0.7 }); LAB.stats.hurt += 1; F.tip('A soldier was knocked flat. They will live'); } else if (S.th && !S.th.gripped && !S.th.tossed) { S.th.x += (S.x + 3 - S.th.x) * h * 2; S.th.z += (S.z - S.th.z) * h * 2; } }
      if (vs.length && (S.shot -= h) <= 0) { S.shot = 1 + Math.random(); const w = vs[0]; S.o.rotation.y = Math.atan2(w.x - S.x, w.z - S.z); shot(S.x, S.y + 1.4, S.z, w.x + (Math.random() - 0.5) * 2, (w.y || 0) + 2, w.z + (Math.random() - 0.5) * 2); if (Math.random() < 0.3) sfx('rifle', S.x, S.y, S.z, { gain: 0.25 }); }
    }
    if ((this.dangerT -= h) <= 0) { this.dangerT = 10 + Math.random() * 6; const S = this.squad.filter(q => !q.down && !q.c)[0], th = vs.find(w => !w.gripped && !w.tossed) || vs[0]; if (S && th) { S.th = th; S.ct = 3.2 * (F.P.slow || 1); F.tip(th.name + ' has cornered a soldier! Tap to save them'); S.c = this.circle('save', 'SAVE', () => { S.c = null; if (!th.gripped) { const dx = th.x - S.x, dz = th.z - S.z, d = Math.hypot(dx, dz) || 1; toss(th, dx / d * 26, 7, dz / d * 26); } D.brawl.hurt(th, 20, { name: F.P.name }); g.fire.burst(th.x, (th.y || 0) + 2, th.z, 8, 1.2); sfx('crash', th.x, 2, th.z, { gain: 0.8 }); F.tip('Soldier saved!'); this.saved(); }); } }
    const pos = this.lines.geometry.attributes.position; for (let i = ln * 6; i < 48; i++) P[i] = 0; pos.needsUpdate = true; this.lines.geometry.setDrawRange(0, ln * 2);
  }
  dispose() {
    const S = this.scene; for (const j of this.jets) S.remove(j.o); for (const H of this.helis) { S.remove(H.o); this.drop(H.c); } for (const q of this.squad) { S.remove(q.o); this.drop(q.c); } for (const s of this.missiles) { S.remove(s.m); this.drop(s.c); }
    S.remove(this.lines); this.lines.geometry.dispose(); this.lines.material.dispose(); this.geo.dispose(); this.mats.dispose(); this.el.remove();
  }
}
