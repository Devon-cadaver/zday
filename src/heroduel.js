// A hero's fight with a villain (Sean; after the kaiju game's close combat in Tornado Alley): the hero has flown in and
// caught the villain, who hangs there, held (villains.js pinPose: reeling, not tumbling). WEAK SPOTS: glowing circles pop up
// over the villain one after another and each is there only about a second - tap it and the hero lands a blow, miss it
// and the villain lands one. Then the villain is dazed, and there are two buttons. SPIN & TOSS: circle a finger round and
// round to whirl the villain about by the ankles, and with enough turns they are hurled away across the town; too slow
// and they break free. RANDOM MOVE: one of a flying kick, by the neck (dragged down the street, ploughing through what
// is in the way: brawl.js drag), a laser blast, or the sky slam - hold a circle to launch them (the longer, the higher),
// tap a circle to fly up after them, hold a circle to smash them back down (the longer, the harder, and the bigger the
// crater where they land). After any of them, FLY AT THEM sends the hero straight after the villain for the next round.
// flight.js runs it (a hero's Lock on) and poses the hero (F.act); the villains' own hurt, toss and beat do the rest.
import * as THREE from 'three';
import { toss } from './brawl.js';
import { sfx } from './audio.js';

const HIP = 0.94 * 2.2; // the hero is flown by the hips (flight.js)
const HANDS = [1.24, 1.1]; // the hands held out ahead and together for the spin (flight.js heroPose): ahead of the hips, up from them
const BEAM = { Nova: [3.2, 0.45, 2.4], Dragonfly: [0.7, 3.2, 0.9], Tempo: [0.5, 2.6, 3.4] }; // each hero's laser, lit past white so it glows
const MOVES = ['kick', 'drag', 'laser', 'slam'];
const SAY = { kick: '🦵 FLYING KICK!', drag: '✊ BY THE NECK!', laser: '🔴 LASER BLAST!', slam: '🚀 SKY SLAM!' };
const ease = (u) => 1 - (1 - u) * (1 - u);
const _a = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
let RAY = null; // the laser's shape, made once
function stretch(m, ax, ay, az, bx, by, bz, r) { _a.set(bx - ax, by - ay, bz - az); const L = _a.length() || 0.01; m.position.set(ax, ay, az); m.quaternion.setFromUnitVectors(_up, _a.multiplyScalar(1 / L)); m.scale.set(r, L, r); }
// the hero as brawl.js sees a fighter, for its drag: placed by the feet, facing by its own yaw (sin, cos)
function holder(F) {
  return { name: F.P.name, side: 'hero', busyT: 0, dragging: false, tossed: null, gripped: false,
    get state() { return F.state; }, get x() { return F.pos.x; }, set x(a) { F.pos.x = a; }, get z() { return F.pos.z; }, set z(a) { F.pos.z = a; },
    get y() { return F.pos.y - HIP; }, set y(a) { F.pos.y = a + HIP; },
    get yaw() { return Math.atan2(Math.cos(F.yaw), -Math.sin(F.yaw)); }, set yaw(a) { F.yaw = Math.atan2(-Math.cos(a), Math.sin(a)); } };
}

const CSS = `
#zd-duel{position:fixed;left:0;top:0;right:0;bottom:0;z-index:29;touch-action:none}
#zd-duel .pan{position:absolute;left:50%;top:calc(66px + env(safe-area-inset-top));transform:translateX(-50%);width:min(86vw,360px);text-align:center;color:#fff;font:800 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;text-shadow:0 1px 3px #000;pointer-events:none}
#zd-duel .bar{height:8px;margin-top:6px;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden}
#zd-duel .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff5ad5,#ffd27a)}
#zd-duel .vhp{margin-top:6px;font-size:11px;font-weight:700;opacity:.9}
#zd-duel .spot{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #fff;background:radial-gradient(circle,rgba(255,240,140,.95),rgba(255,120,60,.55) 60%,rgba(255,80,40,0) 72%);box-shadow:0 0 16px 4px rgba(255,200,80,.85);animation:zdSpot 1.05s linear forwards}
#zd-duel .spot.pop{animation:zdPop .2s ease-out forwards}
#zd-duel .spot.miss{animation:zdMiss .25s ease-out forwards}
@keyframes zdSpot{from{transform:scale(1.25)}to{transform:scale(.55);opacity:.55}}
#zd-duel .spot.slow:not(.pop):not(.miss){animation-duration:1.52s}
@keyframes zdPop{to{transform:scale(1.7);opacity:0}}
@keyframes zdMiss{to{transform:scale(.3);opacity:0;filter:hue-rotate(-60deg)}}
#zd-duel .acts{position:absolute;left:50%;bottom:calc(130px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:8px;width:max-content;max-width:calc(100vw - 16px)}
#zd-duel .acts button{appearance:none;border:2px solid rgba(255,255,255,.4);border-radius:14px;padding:14px 12px;font:900 13px system-ui,-apple-system,sans-serif;letter-spacing:.05em;color:#fff;background:linear-gradient(#ff5ad5,#a0168a);box-shadow:0 0 16px rgba(255,90,213,.6);cursor:pointer;white-space:nowrap}
#zd-duel .land{position:absolute;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));appearance:none;border:2px solid rgba(255,255,255,.35);border-radius:12px;padding:10px 14px;font:800 12px system-ui,-apple-system,sans-serif;color:#fff;background:linear-gradient(#ff5a8a,#c2165a);cursor:pointer}
#zd-duel .acts button.rnd{background:linear-gradient(#ffc04a,#d0700a);box-shadow:0 0 16px rgba(255,180,60,.6)}
#zd-duel .ring{position:absolute;left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:3px dashed rgba(255,255,255,.55);pointer-events:none;animation:zdTurn 1.2s linear infinite}
@keyframes zdTurn{to{transform:rotate(360deg)}}
#zd-duel .hold{position:absolute;width:88px;height:88px;margin:-44px 0 0 -44px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font:900 13px system-ui,-apple-system,sans-serif;letter-spacing:.06em;text-shadow:0 1px 2px #000;background:rgba(0,0,0,.35);background:radial-gradient(circle,rgba(40,20,60,.55) 55%,transparent 57%),conic-gradient(#ffd27a calc(var(--k,0) * 360deg),rgba(0,0,0,.35) 0deg);box-shadow:0 0 18px 4px rgba(255,210,122,.7);animation:zdPulse .6s ease-in-out infinite alternate;touch-action:none}
#zd-duel .hold.tap{background:radial-gradient(circle,rgba(150,230,255,.9),rgba(40,120,255,.55) 62%,rgba(40,120,255,0) 74%);box-shadow:0 0 18px 5px rgba(120,220,255,.85)}
@keyframes zdPulse{to{transform:scale(1.08)}}
`;

export class Duel {
  // F: the flight (the hero flying), v: the villain caught
  constructor(F, v) {
    this.F = F; this.v = v; this.g = F.g; this.phase = 'spots'; this.t = 0; this.live = []; this.spawned = 0; this.total = 6; this.next = 0.35;
    this.pow = F.P.punch || 1; this.life = 1.05 * (F.P.slow || 1); // how hard this hero hits; how long a spot lasts (Tempo slows time)
    v.heroWin = true; // the player's own fight: win it and they are beaten (not the odds the heroes get on their own)
    v.gripped = true; v.pinned = 'reel'; v.flinch = 0; v.downT = 0; if (v.dropHeld) v.dropHeld(); // held where it is, reeling
    if (!document.getElementById('zd-duel-css')) { const s = document.createElement('style'); s.id = 'zd-duel-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = this.el = document.createElement('div'); el.id = 'zd-duel';
    el.innerHTML = '<div class="pan"><div class="ttl"></div><div class="bar"><i></i></div><div class="vhp"></div></div><div class="acts"></div><button type="button" class="land">Land</button>';
    document.body.appendChild(el);
    el.querySelector('.land').onclick = (e) => { e.stopPropagation(); this.F.stop(); }; // Land, in the middle of it
    this.ttl = el.querySelector('.ttl'); this.barI = el.querySelector('.bar i'); this.vhp = el.querySelector('.vhp'); this.acts = el.querySelector('.acts');
    this.title('🎯 WEAK SPOTS! TAP THEM!'); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8 });
    // the spin: a finger going round the middle of the screen
    el.addEventListener('pointerdown', (e) => { if (this.phase === 'spin') { this.last = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); e.preventDefault(); } });
    el.addEventListener('pointermove', (e) => { if (this.phase !== 'spin' || this.last == null) return; const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); let d = a - this.last; d = Math.atan2(Math.sin(d), Math.cos(d)); this.ang += Math.abs(d); this.spinA -= d; this.last = a; });
    el.addEventListener('pointerup', () => { this.last = null; });
  }
  title(s) { this.ttl.textContent = s; }
  // where a point is on the screen (the villain's chest by default)
  screen(x = this.v.x, y = (this.v.y || 0) + 2.4, z = this.v.z) { const p = new THREE.Vector3(x, y, z).project(this.F.ctx.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
  hit(n) { const v = this.v; this.g.disasters.brawl.hurt(v, n * this.pow, { name: this.F.P.name }); this.g.fire.burst(v.x, (v.y || 0) + 2.4, v.z, 6, 0.8); this.F.punch = 0.25; v.flinch = 1; }
  // the street under (x, z), or a roof standing there
  groundAt(x, z) { const city = this.g.city; let y = this.g.people.groundY(x, z); city.buildingsNear(x, z, 0.1, (k, d, b) => { if (d === 0 && !city.dead[k] && b.roofY > y) y = b.roofY; }); return y; }
  spot() {
    const [sx, sy] = this.screen(), x = Math.max(40, Math.min(innerWidth - 84, sx + (Math.random() - 0.5) * 150)), y = Math.max(140, Math.min(innerHeight - 230, sy + (Math.random() - 0.5) * 170));
    const b = document.createElement('div'); b.className = 'spot' + (this.life > 1.2 ? ' slow' : ''); b.style.left = x + 'px'; b.style.top = y + 'px'; this.el.appendChild(b);
    const s = { b, life: this.life, dead: false }; this.live.push(s);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (s.dead) return; s.dead = true; b.classList.add('pop'); setTimeout(() => b.remove(), 200); this.hit(26); sfx('crash', this.v.x, 2, this.v.z, { gain: 0.5, rate: 1.4 }); });
  }
  // the buttons along the bottom: [label, what it does, class]
  button(...list) {
    this.acts.innerHTML = '';
    for (const [label, fn, cls] of list) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = (e) => { e.stopPropagation(); fn(); }; this.acts.appendChild(b); }
  }
  // a step (game time); false when it is over
  step(h) {
    const v = this.v, F = this.F; this.t += h;
    if (F.state !== 'fly' || v.gone) return this.end('', false);
    this.vhp.textContent = v.name.toUpperCase() + ' ' + Math.max(0, Math.round(v.hp));
    if (v.beaten || v.hp <= 0) return this.end(v.name + ' is beaten!', true);
    if (v.flinch > 0) v.flinch = Math.max(0, v.flinch - h * 4);
    if (v.pinned === 'reel' || v.pinned === 'dazed') v.yaw = Math.atan2(F.pos.x - v.x, F.pos.z - v.z); // facing the hero
    if (F.act && (F.act.t += h) >= F.act.T) F.act = null;
    const fn = this['_' + this.phase];
    return fn ? fn.call(this, h) : true;
  }
  _spots(h) {
    const v = this.v;
    if ((this.next -= h) <= 0 && this.spawned < this.total) { this.next = 0.45; this.spawned++; this.spot(); }
    for (const s of this.live) { if (s.dead) continue; s.life -= h; if (s.life <= 0) { s.dead = true; s.b.classList.add('miss'); setTimeout(() => s.b.remove(), 250); this.F.damage(7, v.name + ' hit you!'); this.g.shake = Math.max(this.g.shake || 0, 0.25); } }
    this.barI.style.width = (this.spawned / this.total * 100) + '%';
    if (this.over) return false; // knocked out by that last miss
    if (this.spawned >= this.total && this.live.every(s => s.dead)) this.daze();
    return true;
  }
  // dazed: the spin, or a move picked at random
  daze() {
    if (this.over) return;
    this.phase = 'dazed'; this.t = 0; this.v.pinned = 'dazed';
    this.title('💫 ' + this.v.name.toUpperCase() + ' IS DAZED!');
    this.button(['🌀 SPIN & TOSS', () => this.startSpin()], ['🎲 RANDOM MOVE', () => this.random(), 'rnd']);
  }
  _dazed() {
    this.barI.style.width = Math.max(0, 100 - this.t / 4 * 100) + '%';
    if (this.t > 4) return this.free('came round and broke free!');
    return true;
  }
  startSpin() { this.phase = 'spin'; this.t = 0; this.ang = 0; this.v.pinned = 'swing'; this.spinA = Math.atan2(-(this.v.z - this.F.pos.z), this.v.x - this.F.pos.x); this.title('🌀 SPIN! CIRCLE YOUR FINGER ROUND AND ROUND'); this.button(); const r = document.createElement('div'); r.className = 'ring'; this.el.appendChild(r); this.ring = r; }
  // swung round by the ankles, stretched out flat away from the hero, as the hero rises: the feet in the hero's hands
  _spin() {
    const v = this.v, F = this.F, P = F.pos, k = Math.min(1, this.t * 5), dx = Math.cos(this.spinA), dz = -Math.sin(this.spinA);
    F.yaw = this.spinA; // square to them
    v.x += (P.x + dx * HANDS[0] - v.x) * k; v.z += (P.z + dz * HANDS[0] - v.z) * k; v.y += (P.y + HANDS[1] - v.y) * k; v.yaw = Math.atan2(dx, dz);
    const need = Math.PI * 2 * 2.5; this.barI.style.width = Math.min(100, this.ang / need * 100) + '%';
    if (this.ang >= need) return this.throwIt();
    if (this.t > 5) return this.free('slipped out of your grip!');
    return true;
  }
  // hurled out, away from the camera so it is seen to go: it tumbles across the town and crashes down (toss), hurt
  throwIt() {
    const v = this.v, c = this.F.ctx.camera, dx = this.F.pos.x - c.position.x, dz = this.F.pos.z - c.position.z, l = Math.hypot(dx, dz) || 1;
    v.gripped = false; toss(v, dx / l * 34, 11, dz / l * 34); this.hit(80); sfx('whoosh', v.x, v.y, v.z, { gain: 1 });
    if (this.ring) this.ring.remove();
    this.thrown('💥 THROWN! NOW GO AFTER ' + v.name.toUpperCase() + '!');
    return true;
  }
  // after a move: FLY AT THEM, for 5 s
  thrown(text) {
    this.phase = 'thrown'; this.t = 0; this.F.act = null; this.title(text);
    this.button(['🚀 FLY AT THEM!', () => { const F = this.F, v = this.v; this.end('', false); F.lockOn(v, true); }]);
  }
  _thrown() {
    this.barI.style.width = Math.max(0, 100 - this.t / 5 * 100) + '%';
    if (this.t > 5) return this.end('', false);
    return true;
  }
  // RANDOM MOVE: not the one just done; by the neck only with them down on the street
  random() {
    const v = this.v, low = (v.y || 0) - this.g.people.groundY(v.x, v.z) < 4;
    const pool = MOVES.filter(m => m !== this.F.lastMove && (m !== 'drag' || low)), m = pool[Math.floor(Math.random() * pool.length)];
    this.F.lastMove = m; this.title(SAY[m]); this.button();
    this['go_' + m]();
  }
  // ---------- the flying kick: in close, a foot in the chest, and off they go
  go_kick() { this.phase = 'kick'; this.t = 0; this.kicked = false; this.F.act = { kind: 'kick', t: 0, T: 0.55 }; sfx('whoosh', this.F.pos.x, this.F.pos.y, this.F.pos.z, { gain: 0.8, rate: 1.3 }); }
  _kick(h) {
    const F = this.F, v = this.v, dx = v.x - F.pos.x, dz = v.z - F.pos.z, d = Math.hypot(dx, dz) || 1;
    if (this.t < 0.25) { if (d > 2.6) { F.pos.x += dx / d * h * 14; F.pos.z += dz / d * h * 14; } return true; } // the lunge in
    if (!this.kicked) { this.kicked = true; v.gripped = false; toss(v, dx / d * 32, 8, dz / d * 32); this.hit(45); sfx('crash', v.x, v.y + 2, v.z, { gain: 0.9, rate: 0.9 }); this.g.shake = Math.max(this.g.shake || 0, 0.4); }
    if (this.t > 0.6) this.thrown('💥 KICKED ACROSS TOWN! GO AFTER ' + v.name.toUpperCase() + '!');
    return true;
  }
  // ---------- the laser: from Nova's eyes, from the others' hands; it pushes them back, burning, then blasts them away
  go_laser() {
    this.phase = 'laser'; this.t = 0; this.tick = 0; this.F.act = { kind: 'laser', t: 0, T: 1.4 };
    if (!RAY) RAY = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
    const c = BEAM[this.F.P.hero] || BEAM.Nova, mat = (col, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0], col[1], col[2]), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.beam = [new THREE.Mesh(RAY, mat(c, 0.55)), new THREE.Mesh(RAY, mat([4, 3.6, 3.2], 0.95))];
    for (const m of this.beam) { m.frustumCulled = false; m.renderOrder = 7; this.g.disasters.ctx.scene.add(m); }
    sfx('laser', this.F.pos.x, this.F.pos.y, this.F.pos.z, { gain: 1, rate: 0.8 });
  }
  _laser(h) {
    const F = this.F, v = this.v, eyes = F.P.hero === 'Nova', fx = Math.cos(F.yaw), fz = -Math.sin(F.yaw);
    const ax = F.pos.x + fx * (eyes ? 0.3 : 1.5), ay = F.pos.y + (eyes ? 1.72 : 1.15), az = F.pos.z + fz * (eyes ? 0.3 : 1.5), bx = v.x, by = (v.y || 0) + 2.9, bz = v.z;
    const w = 1 + Math.sin(this.t * 40) * 0.15; stretch(this.beam[0], ax, ay, az, bx, by, bz, 0.32 * w); stretch(this.beam[1], ax, ay, az, bx, by, bz, 0.11);
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1; v.x += dx / d * h * 2.5; v.z += dz / d * h * 2.5; // pushed back along it
    if ((this.tick -= h) <= 0) { this.tick = 0.25; this.hit(8); }
    if (this.t >= 1.3) { this.dropBeam(); v.gripped = false; toss(v, dx / d * 26, 7, dz / d * 26); this.hit(12); sfx('boom', v.x, v.y + 2, v.z, { gain: 0.5 }); this.thrown('💥 BLASTED AWAY! GO AFTER ' + v.name.toUpperCase() + '!'); }
    return true;
  }
  dropBeam() { if (!this.beam) return; for (const m of this.beam) { this.g.disasters.ctx.scene.remove(m); m.material.dispose(); } this.beam = null; }
  // ---------- by the neck: dragged down the street, through whatever is in the way (brawl.js), and flung at the end
  go_drag() {
    const F = this.F, v = this.v, B = this.g.disasters.brawl;
    v.gripped = false; v.pinned = null; // the drag takes hold of them itself
    if (!B.drag(holder(F), v)) { v.gripped = true; v.pinned = 'dazed'; this.F.lastMove = 'kick'; this.title(SAY.kick); return this.go_kick(); } // no room to run: a kick instead
    this.S = B.drags[B.drags.length - 1]; this.phase = 'drag'; this.t = 0; F.act = { kind: 'drag', t: 0, T: 1e9 };
  }
  _drag() {
    if (this.g.disasters.brawl.drags.includes(this.S)) return true; // brawl.js has them, down the street
    this.S = null; this.hit(25); this.thrown('💥 DRAGGED AND FLUNG! GO AFTER ' + this.v.name.toUpperCase() + '!');
    return true;
  }
  // ---------- the sky slam: hold to launch (the longer, the higher), tap to fly up after them, hold to smash them down
  // (the longer, the harder, and the bigger the crater)
  go_slam() {
    const v = this.v; this.phase = 'slam'; this.sub = 'charge'; this.t = 0; this.k = 0; this.gy = this.groundAt(v.x, v.z);
    this.F.act = { kind: 'crouch', t: 0, T: 1e9 };
    this.title('✊ HOLD THE CIRCLE: THE LONGER YOU HOLD, THE HIGHER THEY GO'); this.circle('hold', 'HOLD');
  }
  // a big circle over the villain: 'hold' (this.holding while held, this.let once let go) or 'tap' (this.tapped)
  circle(kind, label) {
    if (this.ring2) this.ring2.remove();
    const c = this.ring2 = document.createElement('div'); c.className = 'hold' + (kind === 'tap' ? ' tap' : ''); c.textContent = label; this.el.appendChild(c);
    this.holding = false; this.let = false; this.tapped = false;
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (kind === 'tap') { this.tapped = true; return; } this.holding = true; try { c.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } });
    const up = () => { if (this.holding) { this.holding = false; this.let = true; } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    this.place(c); return c;
  }
  place(c) { const [x, y] = this.screen(); c.style.left = Math.max(50, Math.min(innerWidth - 100, x)) + 'px'; c.style.top = Math.max(150, Math.min(innerHeight - 240, y)) + 'px'; } // clear of the side buttons
  dropCircle() { if (this.ring2) { this.ring2.remove(); this.ring2 = null; } }
  _slam(h) {
    const v = this.v, F = this.F, s = this.sub;
    if (s === 'charge' || s === 'aim') { // holding a circle: the power climbing
      if (this.holding) this.k = Math.min(1, this.k + h / (s === 'charge' ? 2 : 1.6));
      const c = this.ring2; if (c) { c.style.setProperty('--k', this.k.toFixed(3)); c.textContent = this.holding || this.k > 0 ? Math.round(this.k * 100) + '%' : 'HOLD'; }
      this.barI.style.width = (this.k * 100) + '%';
      if (s === 'aim') v.y = this.top + Math.sin(this.t * 2) * 0.5; // hanging there at the top
      if (this.let || this.t > 5) { if (s === 'charge') this.launch(); else this.smash(); }
      return true;
    }
    if (s === 'up') { // up they go; a circle to tap to go after them
      const u = Math.min(1, this.t / 1.0); v.y = this.y0 + (this.top - this.y0) * ease(u) + (u >= 1 ? Math.sin(this.t * 2) * 0.5 : 0);
      if (u < 1 && Math.random() < 0.4) this.g.fire.burst(v.x, v.y, v.z, 2, 1);
      if (this.t > 0.5 && !this.ring2) this.circle('tap', 'TAP');
      if (this.ring2) this.place(this.ring2);
      if (this.tapped) {
        this.dropCircle(); this.sub = 'rise'; this.t = 0; this.hy0 = F.pos.y; F.act = { kind: 'rise', t: 0, T: 1e9 };
        sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 1, rate: 0.8 }); this.title('⬆ UP AFTER THEM!');
      } else if (this.t > 4.5) { this.dropCircle(); v.gripped = false; toss(v, 0, 0, 0); this.thrown('They fell back down on their own. Go after ' + v.name + '!'); } // too slow
      return true;
    }
    if (s === 'rise') { // the hero up past them to just above
      const u = Math.min(1, this.t / 0.7), dx = F.pos.x - v.x, dz = F.pos.z - v.z, d = Math.hypot(dx, dz) || 1;
      F.pos.y = this.hy0 + (this.top + 8 - this.hy0) * ease(u); F.pos.x += (v.x + dx / d * 2.2 - F.pos.x) * Math.min(1, h * 5); F.pos.z += (v.z + dz / d * 2.2 - F.pos.z) * Math.min(1, h * 5);
      v.y = this.top + Math.sin(this.t * 2) * 0.5;
      if (u >= 1) { this.sub = 'aim'; this.t = 0; this.k = 0; F.act = { kind: 'hammerUp', t: 0, T: 1e9 }; this.title('🔨 HOLD THE CIRCLE: THE LONGER YOU HOLD, THE HARDER THE HIT'); this.circle('hold', 'HOLD'); }
      return true;
    }
    if (s === 'down') { // straight down, faster and faster, the hero diving after them
      this.vy -= 120 * h; v.y += this.vy * h; F.pos.y = Math.max(v.y + 10, F.pos.y + this.vy * 0.85 * h);
      if (this.t > 0.3 && F.act && F.act.kind !== 'dive') F.act = { kind: 'dive', t: 0, T: 1e9 };
      if (Math.random() < 0.6) this.g.fire.burst(v.x, v.y + 3, v.z, 3, 1.4);
      if (v.y <= this.gy) this.impact();
    }
    return true;
  }
  launch() {
    const v = this.v, F = this.F;
    this.dropCircle(); this.top = this.gy + 25 + 125 * this.k; this.y0 = v.y || 0;
    this.sub = 'up'; this.t = 0; v.pinned = 'air'; F.act = { kind: 'upper', t: 0, T: 0.45 };
    this.hit(20); this.g.fire.burst(v.x, (v.y || 0) + 3, v.z, 16, 2); sfx('thud', v.x, v.y + 3, v.z, { gain: 1.5, rate: 0.7 }); this.g.shake = Math.max(this.g.shake || 0, 0.4);
    this.title('🚀 UP THEY GO! TAP THE CIRCLE TO FLY UP AFTER THEM'); this.barI.style.width = '0%';
  }
  smash() {
    const v = this.v, F = this.F, k = this.k; this.slamK = k;
    this.dropCircle(); this.sub = 'down'; this.t = 0; this.vy = -(40 + 80 * k); F.act = { kind: 'hammer', t: 0, T: 0.35 };
    this.g.fire.burst(v.x, v.y + 2, v.z, 20 + Math.round(10 * k), 2.4); sfx('thud', v.x, v.y + 2, v.z, { gain: 1.6, rate: 0.6 }); sfx('boom', v.x, v.y, v.z, { gain: 0.6 });
    this.g.disasters.brawl.stunts.ring(v.x, v.y + 2, v.z, 16 + 14 * k, 0.5, new THREE.Color(1.6, 1.4, 1.2), 0.7);
    this.title('💥 SMASH!');
  }
  // where they land: a crater as big as the blow was hard - cracks, dust, a ring of force, windows out, cars flung, people
  // bowled over (not hurt), the smallest buildings brought down by a hard one; they lie in it a moment
  impact() {
    const D = this.g.disasters, { fire, city, traffic, people } = D.ctx, v = this.v, F = this.F, p = this.slamK || 0, x = v.x, z = v.z, gy = this.gy, R = 18 + 52 * p;
    v.y = gy; v.pinned = null; v.gripped = false; v.busyT = 2.4; v.downT = 2.4;
    D.decals.add('crack', x, z, 14 + 26 * p, 14 + 26 * p); D.decals.add('scour', x, z, 6 + 8 * p, 6 + 8 * p);
    const n = 5 + Math.round(7 * p); for (let i = 0; i < n; i++) { const a = i / n * 6.28; fire.dustCloud(x + Math.cos(a) * R * 0.2, z + Math.sin(a) * R * 0.2, 4 + 5 * p, 3 + 5 * p); }
    fire.burst(x, gy + 1, z, 20 + Math.round(30 * p), 2 + 2.5 * p); if (p > 0.5) fire.burst(x, gy + 5, z, 24, 3 + 2 * p);
    sfx(p > 0.5 ? 'boomBig' : 'boom', x, gy, z, { gain: 0.7 + 0.5 * p }); D.shake(0.6 + 1.0 * p); D.flash(0.1 + 0.3 * p);
    D.brawl.stunts.ring(x, gy + 0.6, z, R, 0.6 + 0.5 * p, new THREE.Color(1.8, 1.4, 1.0), 0.9);
    city.buildingsNear(x, z, R * 0.75, (k, d, b) => {
      if (city.dead[k] || b.landmark) return; const bx = (b.x0 + b.x1) / 2 - x, bz = (b.z0 + b.z1) / 2 - z;
      if (d < R * 0.15 && b.top - b.baseY < 12 + 20 * p) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(-bx, bz) });
      else D.blowWindows(k, bx, bz, d < R * 0.3 ? 1 : 0.6);
    });
    const C = R * 0.65; traffic.near(x, z, C, (c) => { if (c.gone || c.mission || c.mode === 4 || c.mode === 5) return; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1, q = Math.max(0, 1 - d / C); c.soft = true; traffic.fling(c, dx / d * (8 + 18 * q), 4 + 8 * q, dz / d * (8 + 18 * q)); });
    people.around(x, z, R * 0.7, (j) => { if (!people.hittable(j)) return; const dx = people.x[j] - x, dz = people.z[j] - z, d = Math.hypot(dx, dz) || 1; people.move(j, dx / d, dz / d, 4); people.panic(j, x, z, -1); });
    this.hit(40 + 110 * p + (this.top - gy) * 0.25);
    const dx = F.pos.x - x, dz = F.pos.z - z, d = Math.hypot(dx, dz) || 1; F.pos.set(x + dx / d * 5, gy + HIP + 0.4, z + dz / d * 5); // the hero lands beside the crater
    this.thrown(p > 0.7 ? '💥 A HUGE CRATER! GO AFTER ' + v.name.toUpperCase() + '!' : '💥 SMASHED INTO THE STREET! GO AFTER ' + v.name.toUpperCase() + '!');
  }
  free(why) { const v = this.v; v.gripped = false; toss(v, (Math.random() - 0.5) * 20, 6, (Math.random() - 0.5) * 20); this.F.damage(10, v.name + ' ' + why); return this.end('', false); }
  // over: the villain let go (if still held, it drops), a drag in hand dropped, the overlay gone, the hero flying again
  end(why, won) {
    if (this.over) return false; this.over = true;
    const v = this.v, B = this.g.disasters.brawl;
    this.dropBeam();
    if (this.S) { const i = B.drags.indexOf(this.S); if (i >= 0) { B.drags.splice(i, 1); v.gripped = false; if (!v.tossed && !v.gone) toss(v, this.S.dx * 10, 4, this.S.dz * 10); } this.S = null; }
    v.pinned = null; v.flinch = 0;
    if (v.gripped) { v.gripped = false; if (!v.tossed && !v.gone) toss(v, 0, 2, 0); } // dropped, falls to the ground
    this.el.remove(); this.F.duelOver(won); if (why) this.F.tip(why);
    return false;
  }
}
