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
import { LAB } from './lab.js';
import { CLIPS, playClip } from './clips.js';

const HIP = 0.94 * 2.2; // the hero is flown by the hips (flight.js)
const HANDS = [1.24, 1.1]; // the hands held out ahead and together for the spin (flight.js heroPose): ahead of the hips, up from them
const BEAM = { Nova: [3.2, 0.45, 2.4], Dragonfly: [0.7, 3.2, 0.9], Tempo: [0.5, 2.6, 3.4] }; // each hero's laser, lit past white so it glows
const MOVES = ['kick', 'drag', 'laser', 'slam', 'jab', 'upper', 'pound', 'fling', 'hammer', 'elbow'];
const SAY = { kick: '🦵 FLYING KICK!', drag: '✊ BY THE NECK!', laser: '🔴 LASER BLAST!', slam: '🚀 SKY SLAM!', jab: '👊 JAB COMBO! TAP THE BEAT!', upper: '🥊 UPPERCUT!', pound: '💥 GROUND POUND! HOLD!', fling: '🏢 THROW THEM! DRAG TO AIM', hammer: '🔨 HAMMER THROW! CIRCLE YOUR FINGER', elbow: '⬇ ELBOW DROP! HOLD!' };
const ICON = { spin: '🌀', kick: '🦵', drag: '✊', laser: '🔴', slam: '🚀', jab: '👊', upper: '🥊', pound: '💥', fling: '🏢', hammer: '🔨', elbow: '⬇' };
const ease = (u) => 1 - (1 - u) * (1 - u);
const _r = new THREE.Vector3(), _w = new THREE.Vector3();
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
#zd-duel .pan{position:absolute;left:50%;top:var(--zd-hud-end,calc(66px + env(safe-area-inset-top)));transform:translateX(-50%);width:min(86vw,360px);text-align:center;color:#fff;font:800 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;text-shadow:0 1px 3px #000;pointer-events:none}
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
#zd-duel .chips{position:absolute;left:50%;bottom:calc(196px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;gap:6px;width:max-content;max-width:min(calc(100vw - 120px),320px)}
#zd-duel .chips button{appearance:none;width:42px;height:42px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(30,16,40,.75);font-size:20px;line-height:1;color:#fff;cursor:pointer;padding:0}
#zd-duel .aim{position:absolute;height:4px;width:110px;margin-top:-2px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,255,255,.2),#ffd27a);border-radius:2px;pointer-events:none;box-shadow:0 0 8px rgba(255,210,120,.8)}
#zd-duel .aim::after{content:'';position:absolute;right:-6px;top:-6px;border:8px solid transparent;border-left:12px solid #ffd27a;border-right:0}
#zd-duel .acts button.rnd{background:linear-gradient(#ffc04a,#d0700a);box-shadow:0 0 16px rgba(255,180,60,.6)}
#zd-duel .ring{position:absolute;left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:3px dashed rgba(255,255,255,.55);pointer-events:none;animation:zdTurn 1.2s linear infinite}
@keyframes zdTurn{to{transform:rotate(360deg)}}
#zd-duel .hold{position:absolute;width:88px;height:88px;margin:-44px 0 0 -44px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font:900 13px system-ui,-apple-system,sans-serif;letter-spacing:.06em;text-shadow:0 1px 2px #000;background:rgba(0,0,0,.35);background:radial-gradient(circle,rgba(40,20,60,.55) 55%,transparent 57%),conic-gradient(#ffd27a calc(var(--k,0) * 360deg),rgba(0,0,0,.35) 0deg);box-shadow:0 0 18px 4px rgba(255,210,122,.7);animation:zdPulse .6s ease-in-out infinite alternate;touch-action:none}
#zd-duel .hold.tap{background:radial-gradient(circle,rgba(150,230,255,.9),rgba(40,120,255,.55) 62%,rgba(40,120,255,0) 74%);box-shadow:0 0 18px 5px rgba(120,220,255,.85)}
@keyframes zdPulse{to{transform:scale(1.08)}}
#zd-duel .dodge{position:absolute;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font:900 22px system-ui,-apple-system,sans-serif;background:radial-gradient(circle,rgba(255,90,90,.95),rgba(200,20,40,.6) 62%,rgba(200,20,40,0) 74%);box-shadow:0 0 18px 5px rgba(255,80,80,.8);animation:zdDodge .55s linear forwards;cursor:pointer}
@keyframes zdDodge{from{transform:scale(1.3)}to{transform:scale(.7);opacity:.6}}
#zd-duel .hold.mash{background:radial-gradient(circle,rgba(255,200,90,.95),rgba(220,110,20,.6) 62%,rgba(220,110,20,0) 74%);box-shadow:0 0 18px 5px rgba(255,180,60,.85);font-size:15px}
`;

export class Duel {
  // F: the flight (the hero flying), v: the villain caught
  constructor(F, v) {
    this.F = F; this.v = v; this.g = F.g; this.phase = 'spots'; this.t = 0; this.live = []; this.spawned = 0; this.total = 6; this.next = 0.35;
    this.pow = (F.P.punch || 1) * LAB.heroPow(); this.life = 1.05 * (F.P.slow || 1) * LAB.spotLife(); LAB.stats.fights++; // how hard this hero hits; how long a spot lasts (Tempo slows time); both by the lab's levels
    v.heroWin = true; // the player's own fight: win it and they are beaten (not the odds the heroes get on their own)
    this.hpMax = Math.max(v.hp, v.hpMax || 0); this.second = !!v.second; this.windT = 1.6; this.dodge = null; // villains fight back (Sean): a wind-up every so often (a dodge circle, or a grab), and a second wind under half health
    v.gripped = true; v.pinned = 'reel'; v.flinch = 0; v.downT = 0; if (v.dropHeld) v.dropHeld(); // held where it is, reeling
    if (!document.getElementById('zd-duel-css')) { const s = document.createElement('style'); s.id = 'zd-duel-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = this.el = document.createElement('div'); el.id = 'zd-duel';
    el.innerHTML = '<div class="pan"><div class="ttl"></div><div class="bar"><i></i></div><div class="vhp"></div></div><div class="acts"></div><button type="button" class="land">Land</button>';
    document.body.appendChild(el);
    el.querySelector('.land').onclick = (e) => { e.stopPropagation(); this.F.stop(); }; // Land, in the middle of it
    this.ttl = el.querySelector('.ttl'); this.barI = el.querySelector('.bar i'); this.vhp = el.querySelector('.vhp'); this.acts = el.querySelector('.acts');
    this.title('🎯 WEAK SPOTS! TAP THEM!'); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8 });
    // the spin: a finger going round the middle of the screen
    el.addEventListener('pointerdown', (e) => { if (this.phase === 'fling') { this.aimAt(e.clientX, e.clientY); this.aiming = true; e.preventDefault(); return; } if (this.phase === 'spin' || this.phase === 'hammer') { this.last = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); e.preventDefault(); } });
    el.addEventListener('pointermove', (e) => { if (this.phase === 'fling' && this.aiming) { this.aimAt(e.clientX, e.clientY); return; } if ((this.phase !== 'spin' && this.phase !== 'hammer') || this.last == null) return; const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); let d = a - this.last; d = Math.atan2(Math.sin(d), Math.cos(d)); this.ang += Math.abs(d); this.spinA -= d; this.last = a; });
    el.addEventListener('pointerup', () => { this.last = null; if (this.phase === 'fling' && this.aiming) { this.aiming = false; this.let = true; } });
  }
  title(s) { this.ttl.textContent = s; }
  // where a point is on the screen (the villain's chest by default)
  screen(x = this.v.x, y = (this.v.y || 0) + 2.4, z = this.v.z) { const p = new THREE.Vector3(x, y, z).project(this.F.ctx.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
  hit(n) { const v = this.v; LAB.stats.dealt += n * this.pow; this.g.disasters.brawl.hurt(v, n * this.pow, { name: this.F.P.name }); this.g.fire.burst(v.x, (v.y || 0) + 2.4, v.z, 6, 0.8); this.F.punch = 0.25; v.flinch = 1; }
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
    if (v.beaten || v.hp <= 0) { LAB.stats.won++; return this.end(v.name + ' is beaten!', true); }
    if (v.flinch > 0) v.flinch = Math.max(0, v.flinch - h * 4);
    if (this.reacts) { for (const c of this.reacts) c.t += h; this.reacts = this.reacts.filter(c => c === v.react); }
    if (!this.second && v.hp < this.hpMax * 0.5) this.secondWind();
    if (v.pinned === 'reel' || v.pinned === 'dazed' || v.pinned === 'grab') v.yaw = Math.atan2(F.pos.x - v.x, F.pos.z - v.z); // facing the hero
    if (F.act && (F.act.t += h) >= F.act.T) F.act = null;
    const fn = this['_' + this.phase];
    return fn ? fn.call(this, h) : true;
  }
  _spots(h) {
    const v = this.v;
    if ((this.next -= h) <= 0 && this.spawned < this.total) { this.next = 0.45; this.spawned++; this.spot(); }
    if (this.dodge) { if (!this.dodgeStep(h)) return false; } else if ((this.windT -= h) <= 0 && this.spawned < this.total) { if (!this.noGrab && Math.random() < 0.12 + 0.015 * LAB.villain + (this.second ? 0.12 : 0)) return this.grab(); this.noGrab = Math.max(0, (this.noGrab || 0) - 1); this.windUp(); }
    for (const s of this.live) { if (s.dead) continue; s.life -= h; if (s.life <= 0) { s.dead = true; s.b.classList.add('miss'); setTimeout(() => s.b.remove(), 250); this.F.damage(LAB.villainHit(7), v.name + ' hit you!'); this.g.shake = Math.max(this.g.shake || 0, 0.25); } }
    this.barI.style.width = (this.spawned / this.total * 100) + '%';
    if (this.over) return false; // knocked out by that last miss
    if (this.spawned >= this.total && this.live.every(s => s.dead)) this.daze();
    return true;
  }
  // keyframed moves (clips.js): the hero's clip, the villain's reaction, a moment's hit stop when a blow lands
  play(name) { this.F.clip = { clip: CLIPS[name], t: 0 }; }
  react(name, hold = 0) { const v = this.v, c = { clip: CLIPS[name], t: 0, hold, play(r) { return playClip(r, this.clip, this.t) || this.t < this.clip.keys[this.clip.keys.length - 1].t + this.hold; } }; v.react = c; this.reacts = this.reacts || []; this.reacts.push(c); }
  stop(s = 0.07) { this.g.hitStop = Math.max(this.g.hitStop || 0, s); }
  // the villain winds up (a flash, a sound): a dodge circle to one side of them, tapped in time the hero sidesteps and the
  // swing misses; too late and it lands: a hit, and the weak spots up at the time are lost
  windUp() {
    const v = this.v, side = Math.random() < 0.5 ? -1 : 1, [sx, sy] = this.screen();
    const el = document.createElement('div'); el.className = 'dodge'; el.textContent = side < 0 ? '\u2B05' : '\u27A1'; el.style.left = Math.max(50, Math.min(innerWidth - 100, sx + side * 105)) + 'px'; el.style.top = Math.max(150, Math.min(innerHeight - 240, sy + 10)) + 'px'; this.el.appendChild(el);
    const d = this.dodge = { el, t: 0, side, T: 0.55 * LAB.spotLife() * (this.F.P.slow || 1), done: false };
    el.style.animationDuration = d.T.toFixed(2) + 's';
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (d.done) return; d.done = true; this.dodged(); });
    this.g.fire.burst(v.x, (v.y || 0) + 2.2, v.z, 4, 0.7); sfx('whoosh', v.x, v.y, v.z, { gain: 0.8, rate: 1.3 }); v.flinch = 0.6;
  }
  dodgeStep(h) {
    const d = this.dodge; d.t += h;
    if (d.done) { if (d.t > d.T + 0.3) { d.el.remove(); this.dodge = null; this.windT = this.windGap(); } return true; }
    if (d.t >= d.T) { // too late: the swing lands
      d.done = true; d.el.remove(); this.dodge = null; this.windT = this.windGap();
      for (const s of this.live) { if (s.dead) continue; s.dead = true; s.b.classList.add('miss'); setTimeout(() => s.b.remove(), 250); }
      this.F.damage(LAB.villainHit(9), this.v.name + ' hit you!'); this.g.shake = Math.max(this.g.shake || 0, 0.4); this.F.act = { kind: 'crouch', t: 0, T: 0.5 };
      sfx('thud', this.F.pos.x, this.F.pos.y, this.F.pos.z, { gain: 1 }); this.g.fire.burst(this.F.pos.x, this.F.pos.y + 1, this.F.pos.z, 6, 1);
      return !this.over;
    }
    return true;
  }
  dodged() { // in time: a sidestep, the swing goes past
    const d = this.dodge, F = this.F, el = d.el; el.classList.add('pop'); setTimeout(() => el.remove(), 200);
    const rx = Math.sin(F.yaw), rz = Math.cos(F.yaw); F.pos.x += rx * d.side * 1.4; F.pos.z += rz * d.side * 1.4; F.act = { kind: 'crouch', t: 0, T: 0.35 };
    sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 0.9, rate: 0.9 }); this.title('\uD83D\uDCA8 DODGED!'); setTimeout(() => { if (this.phase === 'spots') this.title('\uD83C\uDFAF WEAK SPOTS! TAP THEM!'); }, 600);
  }
  windGap() { return (2.6 - 0.06 * LAB.villain) * (this.second ? 0.7 : 1) * (0.8 + Math.random() * 0.5); }
  // grabbed: a circle to mash; free in time and the villain is shoved reeling, else they hurl the hero across the street
  grab() {
    const v = this.v, F = this.F; this.phase = 'grab'; this.t = 0; this.mashN = 0; this.mashNeed = Math.max(3, 7 - Math.floor(LAB.hero / 4)); this.mashT = 2.2 * (F.P.slow || 1);
    for (const s of this.live) { if (s.dead) continue; s.dead = true; s.b.remove(); } this.live.length = 0;
    v.pinned = 'grab'; F.act = { kind: 'crouch', t: 0, T: 1e9 }; this.button(); this.noGrab = 2; // not again for the next two wind-ups
    this.title('\u270A ' + v.name.toUpperCase() + ' HAS YOU! TAP TO BREAK FREE!'); this.circle('mash', '0/' + this.mashNeed);
    sfx('thud', F.pos.x, F.pos.y, F.pos.z, { gain: 0.9, rate: 0.8 }); this.g.shake = Math.max(this.g.shake || 0, 0.3);
    return true;
  }
  _grab(h) {
    const v = this.v, F = this.F; if (this.ring2) { this.place(this.ring2); this.ring2.textContent = this.mashN + '/' + this.mashNeed; }
    this.barI.style.width = Math.max(0, 100 - this.t / this.mashT * 100) + '%';
    const dx = v.x - F.pos.x, dz = v.z - F.pos.z, d = Math.hypot(dx, dz) || 1; F.pos.x += (v.x - dx / d * 2.2 - F.pos.x) * Math.min(1, h * 6); F.pos.z += (v.z - dz / d * 2.2 - F.pos.z) * Math.min(1, h * 6); // held close
    if (this.mashN >= this.mashNeed) { this.dropCircle(); F.act = null; this.hit(10); v.flinch = 1; sfx('crash', v.x, v.y + 2, v.z, { gain: 0.8 }); this.spawned = Math.max(this.spawned, this.total - 2); this.phase = 'spots'; this.windT = this.windGap() + 1; this.title('\uD83D\uDCAA BROKE FREE!'); v.pinned = 'reel'; return true; }
    if (this.t >= this.mashT) { this.dropCircle(); return this.hurled(); }
    return true;
  }
  hurled() { // thrown across the street: the fight is off, the villain goes about its business
    const v = this.v, F = this.F, dx = F.pos.x - v.x, dz = F.pos.z - v.z, d = Math.hypot(dx, dz) || 1;
    v.gripped = false; v.pinned = null; v.flinch = 0; v.hitT = (F.t2 || 0) + 3;
    F.damage(LAB.villainHit(14), v.name + ' threw you!'); sfx('whoosh', v.x, v.y, v.z, { gain: 1, rate: 0.7 }); this.g.shake = Math.max(this.g.shake || 0, 0.5);
    if (!this.over) F.hurl(dx / d * 34, 9, dz / d * 34, v.name + ' threw you across the street!');
    return this.end('', false);
  }
  secondWind() { // under half health: faster, meaner
    const v = this.v; this.second = v.second = true; this.life *= 0.8;
    this.g.fire.burst(v.x, (v.y || 0) + 2.4, v.z, 14, 1.8); sfx('roar', v.x, v.y, v.z, { gain: 0.8, rate: 1.4 }); this.g.shake = Math.max(this.g.shake || 0, 0.35);
    const was = this.ttl.textContent; this.title('\u26A1 ' + v.name.toUpperCase() + ' GETS A SECOND WIND!'); setTimeout(() => { if (!this.over && this.ttl.textContent.includes('SECOND WIND')) this.title(was); }, 1200);
  }
  // dazed: the spin, or a move picked at random
  daze() {
    if (this.over) return;
    this.phase = 'dazed'; this.t = 0; this.v.pinned = 'dazed';
    this.title('💫 ' + this.v.name.toUpperCase() + ' IS DAZED!');
    const rnd = MOVES.some(m => LAB.moves[m]), btns = []; if (LAB.moves.spin || !rnd) btns.push(['🌀 SPIN & TOSS', () => this.startSpin()]); if (rnd) btns.push(['🎲 RANDOM MOVE', () => this.random(), 'rnd']); this.button(...btns); this.chips(['spin', ...MOVES].filter(m => LAB.moves[m])); // only the moves the lab has on
  }
  chips(list) { // a row of small round buttons, one a move, above the big ones
    if (this.chipEl) this.chipEl.remove(); const row = this.chipEl = document.createElement('div'); row.className = 'chips';
    for (const m of list) { const b = document.createElement('button'); b.type = 'button'; b.textContent = ICON[m] || '?'; b.title = m; b.onclick = (e) => { e.stopPropagation(); this.pick(m); }; row.appendChild(b); }
    this.el.appendChild(row);
  }
  pick(m) { if (this.phase !== 'dazed') return; if (this.chipEl) { this.chipEl.remove(); this.chipEl = null; } if (m === 'spin') return this.startSpin(); this.F.lastMove = m; this.title(SAY[m]); this.button(); this['go_' + m](); }
  _dazed() {
    this.barI.style.width = Math.max(0, 100 - this.t / 4 * 100) + '%';
    if (this.t > 4) return this.free('came round and broke free!');
    return true;
  }
  startSpin() { if (this.chipEl) { this.chipEl.remove(); this.chipEl = null; } this.phase = 'spin'; this.t = 0; this.ang = 0; this.v.pinned = 'swing'; this.spinA = Math.atan2(-(this.v.z - this.F.pos.z), this.v.x - this.F.pos.x); this.title('🌀 SPIN! CIRCLE YOUR FINGER ROUND AND ROUND'); this.button(); const r = document.createElement('div'); r.className = 'ring'; this.el.appendChild(r); this.ring = r; }
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
    this.phase = 'thrown'; this.t = 0; this.F.act = null; this.F.clip = null; this.title(text);
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
    const on = MOVES.filter(m => LAB.moves[m]), pool0 = on.filter(m => m !== this.F.lastMove && (m !== 'drag' || low)), pool = pool0.length ? pool0 : on.length ? on : MOVES, m = pool[Math.floor(Math.random() * pool.length)];
    if (this.chipEl) { this.chipEl.remove(); this.chipEl = null; } this.F.lastMove = m; this.title(SAY[m]); this.button();
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
  // jab combo: three tap circles on a beat, each landed a jab, all three a knock-back; one late and they shrug it off
  go_jab() { const F = this.F; this.phase = 'jab'; this.t = 0; this.jabN = 0; this.jabT = 0; this.landT = -1; this.v.pinned = 'reel'; F.act = null; this.play('guardL'); }
  _jab(h) {
    const v = this.v, F = this.F, beat = 0.6 * (F.P.slow || 1);
    const dx = v.x - F.pos.x, dz = v.z - F.pos.z, d = Math.hypot(dx, dz) || 1; if (d > 2.4) { F.pos.x += dx / d * h * 6; F.pos.z += dz / d * h * 6; } // stepping in close
    if (this.landT >= 0) { // a punch on its way: it lands at the clip's contact key
      this.landT += h; if (this.landT >= 0.08) { const n = this.jabN; this.landT = -1; this.hit(n >= 3 ? 30 : 14); this.react(n >= 3 ? 'hitBody' : n % 2 ? 'hitHeadR' : 'hitHeadL'); this.stop(n >= 3 ? 0.09 : 0.05); v.flinch = 1;
        sfx('crash', v.x, v.y + 2, v.z, { gain: 0.7, rate: 1.2 + n * 0.1 }); this.g.fire.burst(v.x, (v.y || 0) + (n >= 3 ? 1.6 : 2.4), v.z, 5, 0.9); this.g.shake = Math.max(this.g.shake || 0, n >= 3 ? 0.4 : 0.15);
        if (n >= 3) { v.gripped = false; toss(v, dx / d * 24, 7, dz / d * 24); return this.thrown('💥 THREE JABS AND A KNOCK-BACK! GO AFTER ' + v.name.toUpperCase() + '!'); } }
      return true; }
    if (!this.ring2) { this.jabT += h; if (this.jabT >= beat * 0.55) { this.circle('tap', 'JAB'); this.ring2.style.animation = 'zdDodge ' + beat.toFixed(2) + 's linear forwards'; this.jabT = 0; this.play(this.jabN % 2 ? 'guardR' : 'guardL'); } return true; }
    this.place(this.ring2); this.jabT += h;
    if (this.tapped) { this.dropCircle(); this.jabN++; const n = this.jabN; this.landT = 0; this.play(n >= 3 ? 'cross' : n % 2 ? 'jabL' : 'jabR'); this.title('👊 ' + 'JAB! '.repeat(Math.min(2, n)) + (n >= 3 ? 'CROSS!' : '')); return true; }
    if (this.jabT >= beat) { this.dropCircle(); const dx = v.x - F.pos.x, dz = v.z - F.pos.z, d = Math.hypot(dx, dz) || 1; v.gripped = false; toss(v, dx / d * 10, 4, dz / d * 10); return this.thrown('They shrugged it off. Go after ' + v.name + '!'); }
    return true;
  }
  // uppercut: they go up; a tap circle to fly up after them and punch them away, miss it and they fall back
  go_upper() { const v = this.v, F = this.F; this.phase = 'upper'; this.sub = 'coil'; this.t = 0; this.gy = this.groundAt(v.x, v.z); this.y0 = v.y || 0; this.top = this.y0 + 22; this.upDone = false; v.pinned = 'reel'; F.act = null; this.play('uppercut'); }
  _upper(h) {
    const v = this.v, F = this.F, s = this.sub, dx0 = F.pos.x - v.x, dz0 = F.pos.z - v.z, d0 = Math.hypot(dx0, dz0) || 1;
    if (s === 'coil') { // down low in front of them, then the fist drives up through the chin at the clip's contact key
      F.pos.x += (v.x + dx0 / d0 * 1.7 - F.pos.x) * Math.min(1, h * 8); F.pos.z += (v.z + dz0 / d0 * 1.7 - F.pos.z) * Math.min(1, h * 8); F.pos.y += (this.y0 + HIP - 0.4 - F.pos.y) * Math.min(1, h * 8);
      if (this.t >= 0.28) { this.sub = 'up'; this.t = 0; v.pinned = 'air'; this.hit(20); this.react('hitUp', 2); this.stop(0.08); this.g.fire.burst(v.x, this.y0 + 2.6, v.z, 6, 1.0); sfx('thud', v.x, v.y + 2, v.z, { gain: 1.3, rate: 0.8 }); this.g.shake = Math.max(this.g.shake || 0, 0.3); }
      return true; }
    if (s === 'up') { const u = Math.min(1, this.t / 0.7); v.y = this.y0 + (this.top - this.y0) * ease(u) + (u >= 1 ? Math.sin(this.t * 3) * 0.3 : 0); if (this.t > 0.3 && !this.ring2) this.circle('tap', 'TAP'); if (this.ring2) this.place(this.ring2);
      if (this.tapped) { this.sub = 'rise'; this.dropCircle(); this.t = 0; this.hy0 = F.pos.y; F.clip = null; F.act = { kind: 'rise', t: 0, T: 1e9 }; sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 1, rate: 0.9 }); this.title('⬆ UP AFTER THEM!'); }
      else if (this.t > 2.2) { this.dropCircle(); F.clip = null; v.gripped = false; toss(v, 0, 0, 0); return this.thrown('They fell back down. Go after ' + v.name + '!'); }
      return true; }
    if (s === 'rise') { const k = Math.min(1, this.t / 0.45); F.pos.y = this.hy0 + (this.top + 2.5 - this.hy0) * ease(k); F.pos.x += (v.x + dx0 / d0 * 2.2 - F.pos.x) * Math.min(1, h * 6); F.pos.z += (v.z + dz0 / d0 * 2.2 - F.pos.z) * Math.min(1, h * 6);
      if (k >= 1) { this.sub = 'wind'; this.t = 0; F.act = null; this.play('windup'); this.title('\uD83D\uDCA5 WIND UP...'); } return true; }
    if (s === 'wind') { F.pos.y = this.top + 2.5 + Math.sin(this.t * 6) * 0.1; if (this.t >= 0.32) { this.sub = 'dash'; this.t = 0; this.play('dash'); this.hit(45); this.react('hitBody', 3); this.stop(0.07);
        v.gripped = false; v.pinned = null; toss(v, -dx0 / d0 * 30, -16, -dz0 / d0 * 30); sfx('crash', v.x, v.y + 2, v.z, { gain: 1, rate: 0.8 }); this.g.fire.burst(v.x, v.y + 2, v.z, 12, 2); this.g.shake = Math.max(this.g.shake || 0, 0.45); this.title('\uD83D\uDCA5 DOWN THEY GO!'); } return true; }
    if (s === 'dash') { // flying down after them, right on their heels, a streak behind, until they hit the street
      const dx = F.pos.x - v.x, dz = F.pos.z - v.z, d = Math.hypot(dx, dz) || 1, gy = this.groundAt(v.x, v.z);
      if (v.tossed && this.t < 2.5 && (v.y || 0) > gy + 0.5) { F.pos.x += (v.x + dx / d * 1.4 - F.pos.x) * Math.min(1, h * 10); F.pos.z += (v.z + dz / d * 1.4 - F.pos.z) * Math.min(1, h * 10); F.pos.y += ((v.y || 0) + 2.8 - F.pos.y) * Math.min(1, h * 10); F.yaw = Math.atan2(-(v.z - F.pos.z), v.x - F.pos.x); if (Math.random() < 0.7) this.g.fire.burst(F.pos.x - Math.cos(F.yaw) * 0.6, F.pos.y + 0.6, F.pos.z + Math.sin(F.yaw) * 0.6, 1, 0.6); return true; }
      F.clip = null; F.act = { kind: 'hammer', t: 0, T: 0.35 }; F.pos.set(v.x + dx / d * 3, gy + HIP + 0.3, v.z + dz / d * 3);
      this.g.disasters.decals.add('crack', v.x, v.z, 8, 8); this.g.fire.dustCloud(v.x, v.z, 3, 3); this.g.fire.burst(v.x, gy + 1, v.z, 12, 1.8); sfx('thud', v.x, gy, v.z, { gain: 1.2, rate: 0.7 }); this.g.shake = Math.max(this.g.shake || 0, 0.4); this.hit(10); v.react = null;
      return this.thrown('\uD83D\uDCA5 PUNCHED INTO THE STREET! GO AFTER ' + v.name.toUpperCase() + '!'); }
    return true;
  }
  // ground pound: hold the circle to wind up, let go and the hero slams the street beside them: a ring of force that
  // knocks everyone and everything near flat, the villain with it
  go_pound() { const v = this.v, F = this.F; this.phase = 'pound'; this.t = 0; this.k = 0; this.gy = this.groundAt(v.x, v.z); v.pinned = 'reel'; F.act = { kind: 'hammerUp', t: 0, T: 1e9 }; this.circle('hold', 'HOLD'); }
  _pound(h) {
    const v = this.v, F = this.F;
    if (this.ring2) { if (this.holding) this.k = Math.min(1, this.k + h / 1.6); this.place(this.ring2); this.ring2.style.setProperty('--k', this.k.toFixed(3)); this.ring2.textContent = this.holding || this.k > 0 ? Math.round(this.k * 100) + '%' : 'HOLD'; this.barI.style.width = (this.k * 100) + '%';
      F.pos.y += (this.gy + HIP + 3 + 5 * this.k - F.pos.y) * Math.min(1, h * 4);
      if (this.let || this.t > 5) { this.dropCircle(); this.t = 0; this.pounded = false; F.act = { kind: 'hammer', t: 0, T: 0.4 }; }
      return true; }
    if (!this.pounded) { F.pos.y += (this.gy + HIP - F.pos.y) * Math.min(1, h * 14); if (F.pos.y - this.gy - HIP < 0.3 || this.t > 0.4) this.pounded = true, this.pound(); return true; }
    if (this.t > 1.0) return this.thrown('💥 FLATTENED! GO AFTER ' + v.name.toUpperCase() + '!');
    return true;
  }
  pound() {
    const Ds = this.g.disasters, { fire, traffic, people } = Ds.ctx, v = this.v, F = this.F, p = this.k, x = F.pos.x, z = F.pos.z, gy = this.gy, R = 12 + 22 * p;
    Ds.decals.add('crack', x, z, 8 + 14 * p, 8 + 14 * p); fire.dustCloud(x, z, 3 + 5 * p, 3 + 4 * p); fire.burst(x, gy + 0.6, z, 10 + Math.round(16 * p), 1.6 + 1.4 * p);
    sfx(p > 0.6 ? 'boom' : 'thud', x, gy, z, { gain: 0.9 + 0.5 * p, rate: 0.7 }); Ds.shake(0.5 + 0.8 * p); Ds.brawl.stunts.ring(x, gy + 0.5, z, R, 0.5 + 0.4 * p, new THREE.Color(1.6, 1.3, 1.0), 0.8);
    traffic.near(x, z, R, (c) => { if (c.gone || c.mission || c.mode === 4 || c.mode === 5) return; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1, q = Math.max(0, 1 - d / R); c.soft = true; traffic.fling(c, dx / d * (6 + 14 * q), 3 + 6 * q, dz / d * (6 + 14 * q)); });
    LAB.stats.scared += people.scare(x, z, R, 1); people.around(x, z, R, (j) => { if (!people.hittable(j)) return; const dx = people.x[j] - x, dz = people.z[j] - z, d = Math.hypot(dx, dz) || 1; people.move(j, dx / d, dz / d, 3); });
    Ds.ctx.city.buildingsNear(x, z, R * 0.6, (k, d, b) => { if (!Ds.ctx.city.dead[k]) Ds.blowWindows(k, (b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z, d < R * 0.3 ? 1 : 0.5); });
    const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz) || 1; v.gripped = false; toss(v, dx / d * (10 + 16 * p), 8 + 8 * p, dz / d * (10 + 16 * p)); this.hit(25 + 45 * p);
  }
  // throw them into a building: the hero holds them overhead, a drag anywhere aims (an arrow from the villain), let go and
  // they fly that way, through whatever they hit (brawl.js: a thrown villain smashes the building they land in)
  go_fling() { const v = this.v, F = this.F; this.phase = 'fling'; this.t = 0; this.aim = null; this.let = false; this.aiming = false; v.pinned = 'air'; F.act = { kind: 'rise', t: 0, T: 1e9 }; const a = this.aimEl = document.createElement('div'); a.className = 'aim'; a.style.display = 'none'; this.el.appendChild(a); }
  aimAt(cx, cy) { // a screen direction from the villain to the finger, as a world direction on the ground
    const [sx, sy] = this.screen(), ex = cx - sx, ey = cy - sy, l = Math.hypot(ex, ey); if (l < 12) return;
    const cam = this.F.ctx.camera; _r.setFromMatrixColumn(cam.matrixWorld, 0); _r.y = 0; _r.normalize(); cam.getWorldDirection(_w); _w.y = 0; _w.normalize();
    const wx = _r.x * ex / l - _w.x * ey / l, wz = _r.z * ex / l - _w.z * ey / l, wl = Math.hypot(wx, wz) || 1; this.aim = [wx / wl, wz / wl];
    if (this.aimEl) { this.aimEl.style.display = ''; this.aimEl.style.left = sx + 'px'; this.aimEl.style.top = sy + 'px'; this.aimEl.style.transform = 'rotate(' + Math.atan2(ey, ex) + 'rad)'; }
  }
  _fling(h) {
    const v = this.v, F = this.F; v.x += (F.pos.x - v.x) * Math.min(1, h * 6); v.z += (F.pos.z - v.z) * Math.min(1, h * 6); v.y += (F.pos.y + 2.6 - v.y) * Math.min(1, h * 6);
    if (this.aimEl && !this.aim) { const [sx, sy] = this.screen(); this.aimEl.style.display = 'none'; }
    if (this.let || this.t > 6) {
      if (this.aimEl) { this.aimEl.remove(); this.aimEl = null; }
      const a = this.aim || [Math.cos(F.yaw), -Math.sin(F.yaw)]; v.gripped = false; v.pinned = null; toss(v, a[0] * 40, 9, a[1] * 40); this.hit(40); F.act = { kind: 'upper', t: 0, T: 0.4 }; F.yaw = Math.atan2(-a[1], a[0]);
      sfx('whoosh', v.x, v.y, v.z, { gain: 1, rate: 0.8 }); this.g.shake = Math.max(this.g.shake || 0, 0.3);
      return this.thrown('💥 THROWN! GO AFTER ' + v.name.toUpperCase() + '!');
    }
    return true;
  }
  // hammer throw: a shorter spin than the spin and toss, let go on the way round: they fly off outward, hard
  go_hammer() { this.startSpin(); this.phase = 'hammer'; this.title(SAY.hammer); }
  _hammer() {
    const v = this.v, F = this.F, P = F.pos, k = Math.min(1, this.t * 5), dx = Math.cos(this.spinA), dz = -Math.sin(this.spinA);
    F.yaw = this.spinA; v.x += (P.x + dx * HANDS[0] - v.x) * k; v.z += (P.z + dz * HANDS[0] - v.z) * k; v.y += (P.y + HANDS[1] - v.y) * k; v.yaw = Math.atan2(dx, dz);
    const need = Math.PI * 2 * 1.5; this.barI.style.width = Math.min(100, this.ang / need * 100) + '%';
    if (this.ang >= need) { if (this.ring) this.ring.remove(); v.gripped = false; toss(v, dx * 46, 10, dz * 46); this.hit(60); sfx('whoosh', v.x, v.y, v.z, { gain: 1, rate: 0.7 }); this.g.shake = Math.max(this.g.shake || 0, 0.35); return this.thrown('💥 HAMMER THROWN! GO AFTER ' + v.name.toUpperCase() + '!'); }
    if (this.t > 5) return this.free('slipped out of your grip!');
    return true;
  }
  // elbow drop: the hero flies up over them, holds, and comes down elbow first; the longer the hold the harder
  go_elbow() { const v = this.v, F = this.F; this.phase = 'elbow'; this.sub = 'up'; this.t = 0; this.k = 0; this.gy = this.groundAt(v.x, v.z); this.hy0 = F.pos.y; v.pinned = 'dazed'; F.act = { kind: 'rise', t: 0, T: 1e9 }; sfx('whoosh', F.pos.x, F.pos.y, F.pos.z, { gain: 0.8 }); }
  _elbow(h) {
    const v = this.v, F = this.F, vy = (v.y || 0);
    if (this.sub === 'up') { const u = Math.min(1, this.t / 0.6); F.pos.y = this.hy0 + (vy + 16 - this.hy0) * ease(u); F.pos.x += (v.x - F.pos.x) * Math.min(1, h * 5); F.pos.z += (v.z - F.pos.z) * Math.min(1, h * 5); if (u >= 1) { this.sub = 'hold'; this.t = 0; F.act = { kind: 'hammerUp', t: 0, T: 1e9 }; this.circle('hold', 'HOLD'); } return true; }
    if (this.sub === 'hold') { if (this.holding) this.k = Math.min(1, this.k + h / 1.4); this.place(this.ring2); this.ring2.style.setProperty('--k', this.k.toFixed(3)); this.ring2.textContent = this.holding || this.k > 0 ? Math.round(this.k * 100) + '%' : 'HOLD'; this.barI.style.width = (this.k * 100) + '%'; F.pos.y = vy + 16 + Math.sin(this.t * 2) * 0.4;
      if (this.let || this.t > 5) { this.dropCircle(); this.sub = 'down'; this.t = 0; this.vy = -(30 + 50 * this.k); F.act = { kind: 'dive', t: 0, T: 1e9 }; } return true; }
    this.vy -= 90 * h; F.pos.y += this.vy * h;
    if (F.pos.y <= vy + HIP + 1) { const p = this.k, x = v.x, z = v.z, Ds = this.g.disasters; F.pos.y = vy + HIP + 1; F.act = { kind: 'hammer', t: 0, T: 0.4 };
      Ds.decals.add('crack', x, z, 6 + 10 * p, 6 + 10 * p); this.g.fire.dustCloud(x, z, 3 + 3 * p, 3 + 3 * p); this.g.fire.burst(x, vy + 1, z, 12 + Math.round(14 * p), 1.8 + 1.6 * p); sfx(p > 0.6 ? 'boom' : 'thud', x, vy, z, { gain: 1 + 0.5 * p, rate: 0.7 }); Ds.shake(0.5 + 0.7 * p); Ds.brawl.stunts.ring(x, vy + 0.5, z, 8 + 10 * p, 0.4 + 0.3 * p, new THREE.Color(1.6, 1.3, 1.0), 0.7);
      v.gripped = false; v.pinned = null; toss(v, (Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6); v.busyT = 1.5 + p; v.downT = 1.5 + p; this.hit(30 + 60 * p);
      return this.thrown(p > 0.6 ? '💥 CRUSHED! GO AFTER ' + v.name.toUpperCase() + '!' : '💥 ELBOW DROPPED! GO AFTER ' + v.name.toUpperCase() + '!'); }
    return true;
  }
  go_slam() {
    const v = this.v; this.phase = 'slam'; this.sub = 'charge'; this.t = 0; this.k = 0; this.gy = this.groundAt(v.x, v.z);
    this.F.act = { kind: 'crouch', t: 0, T: 1e9 };
    this.title('✊ HOLD THE CIRCLE: THE LONGER YOU HOLD, THE HIGHER THEY GO'); this.circle('hold', 'HOLD');
  }
  // a big circle over the villain: 'hold' (this.holding while held, this.let once let go) or 'tap' (this.tapped)
  circle(kind, label) {
    if (this.ring2) this.ring2.remove();
    const c = this.ring2 = document.createElement('div'); c.className = 'hold' + (kind === 'tap' ? ' tap' : kind === 'mash' ? ' mash' : ''); c.textContent = label; this.el.appendChild(c);
    this.holding = false; this.let = false; this.tapped = false;
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (kind === 'mash') { this.mashN = (this.mashN || 0) + 1; c.style.transform = 'scale(1.15)'; setTimeout(() => { c.style.transform = ''; }, 60); return; } if (kind === 'tap') { this.tapped = true; return; } this.holding = true; try { c.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } });
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
  free(why) { const v = this.v; v.gripped = false; toss(v, (Math.random() - 0.5) * 20, 6, (Math.random() - 0.5) * 20); this.F.damage(LAB.villainHit(10), v.name + ' ' + why); return this.end('', false); }
  // over: the villain let go (if still held, it drops), a drag in hand dropped, the overlay gone, the hero flying again
  end(why, won) {
    if (this.over) return false; this.over = true;
    const v = this.v, B = this.g.disasters.brawl;
    this.dropBeam(); if (this.dodge) { this.dodge.el.remove(); this.dodge = null; } if (this.chipEl) { this.chipEl.remove(); this.chipEl = null; } if (this.aimEl) { this.aimEl.remove(); this.aimEl = null; }
    if (this.S) { const i = B.drags.indexOf(this.S); if (i >= 0) { B.drags.splice(i, 1); v.gripped = false; if (!v.tossed && !v.gone) toss(v, this.S.dx * 10, 4, this.S.dz * 10); } this.S = null; }
    v.pinned = null; v.flinch = 0; v.react = null; this.F.clip = null;
    if (v.gripped) { v.gripped = false; if (!v.tossed && !v.gone) toss(v, 0, 2, 0); } // dropped, falls to the ground
    this.el.remove(); this.F.duelOver(won); if (why) this.F.tip(why);
    return false;
  }
}
