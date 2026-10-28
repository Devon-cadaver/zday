// Arcade feedback for Be The Disaster: what falls, burns or is wrecked throws up
// its points where it happened, hits close together build a combo that multiplies
// them, and the big moments get a name, a jolt and a beat of slow motion. Points
// pop up over buildings, cars and fires only: nothing is counted over people.
import * as THREE from 'three';
import { CURVE } from './curve.js';
import { sfx } from './audio.js';

const CSS = `
#zd-pops{position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden;font:800 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}
#zd-pops .p{position:absolute;left:0;top:0;white-space:nowrap;color:#ffd166;text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.35);will-change:transform,opacity;opacity:0}
#zd-pops .p.car{color:#9fe3ff}#zd-pops .p.fire{color:#ff9a4a}#zd-pops .p.big{font-size:18px}#zd-pops .p.huge{font-size:25px;color:#ffe08a}
#zd-call{position:fixed;left:0;right:0;top:31%;text-align:center;z-index:7;pointer-events:none;opacity:0;padding:0 16px;
  font:900 34px/1.05 system-ui,-apple-system,"Segoe UI",sans-serif;color:#ffe08a;letter-spacing:.01em;text-transform:uppercase;
  text-shadow:0 2px 0 #7a3b12,0 4px 10px rgba(0,0,0,.6)}
#zd-call.small{font-size:22px;color:#fff4e0}
#zd-call.combo{color:#a6ff4d;text-shadow:0 2px 0 #2c4a10,0 4px 10px rgba(0,0,0,.6)}
#zd-call.on{animation:zdcall 1.5s ease-out forwards}
@keyframes zdcall{0%{opacity:0;transform:scale(.5)}12%{opacity:1;transform:scale(1.12)}22%{transform:scale(1)}72%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-16px) scale(1.04)}}
.zd-rp{position:relative}
.zd-rp .x{font-style:normal;font-size:13px;font-weight:900;color:#a6ff4d;display:none}
.zd-rp.combo .x{display:inline}
.zd-rp .cb{position:absolute;left:6px;right:6px;bottom:2px;height:2px;border-radius:1px;background:#a6ff4d;transform-origin:left;transform:scaleX(0)}
.zd-rp b{display:inline-block;transition:transform .12s}
.zd-rp.bump b{transform:scale(1.18)}
#zd-clock.hurry b{color:#ff6a4a}
`;

const WINDOW = 3.5; // s: a hit this soon after the last keeps the combo going
const STEPS = [[6, 1.5], [16, 2], [32, 2.5], [56, 3]]; // hits in the combo, and the multiplier from there on
const PTS = { b: 150, car: 40, fire: 60 }; // as be.js scores them, before the disaster's own k
const POOL = 18;

export class Hits {
  // scorePill: the score's pill (null: no points shown); o.quiet: no numbers or combos, only the named moments (Disaster TV)
  constructor(g, scorePill, o = {}) {
    this.g = g; this.quiet = !!o.quiet;
    if (!document.getElementById('zd-hits-css')) { const s = document.createElement('style'); s.id = 'zd-hits-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.layer = document.createElement('div'); this.layer.id = 'zd-pops';
    this.call = document.createElement('div'); this.call.id = 'zd-call';
    document.body.append(this.layer, this.call);
    this.pool = [];
    for (let i = 0; i < POOL; i++) { const d = document.createElement('div'); d.className = 'p'; this.layer.appendChild(d); this.pool.push({ d, life: 0, x: 0, y: 0, z: 0 }); }
    this.pill = scorePill ? scorePill.parentNode : null; // the score pill: the multiplier and its draining bar ride on it
    if (this.pill) {
      this.xEl = document.createElement('i'); this.xEl.className = 'x'; this.pill.appendChild(this.xEl);
      this.bar = document.createElement('span'); this.bar.className = 'cb'; this.pill.appendChild(this.bar);
    }
    this.v = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.t = 0; this.n = 0; this.mult = 1; this.lastT = -99; this.tokens = 4; this.bonus = 0;
    this.best = 1; this.bestN = 0; this.bins = new Map(); this.binT = 0; this.recent = []; this.cool = {}; this.slowCool = 0;
    for (const p of this.pool) { p.life = 0; p.d.style.opacity = '0'; }
    this.call.className = ''; if (this.pill) this.pill.classList.remove('combo');
  }

  dispose() { this.layer.remove(); this.call.remove(); if (this.pill) { this.xEl.remove(); this.bar.remove(); } }

  // something wrecked at (x, y, z): kind 'b' (a building), 'car' or 'fire'; k is the disaster's own scale
  hit(kind, x, y, z, k, o = {}) {
    const t = this.t;
    if (this.quiet) { this.recent.push(kind, t); if (o.big) this.moment('Big one!', 0.9); return; }
    if (t - this.lastT > WINDOW) this.drop();
    this.lastT = t;
    if (this.tokens >= 1) { this.tokens--; this.n++; } // a burst (a nuke, a meteor) counts as only so many hits: a combo is built by keeping it going
    let m = 1; for (const [n, v] of STEPS) if (this.n >= n) m = v;
    if (m > this.mult) { this.mult = m; this.say('Combo ×' + m, 'combo'); sfx('chime', ...this.here(), { rate: 0.9 + m * 0.1 }); }
    if (this.mult > this.best || (this.mult === this.best && this.n > this.bestN)) { this.best = this.mult; this.bestN = this.n; }
    const pts = PTS[kind] * k * this.mult; this.bonus += PTS[kind] * k * (this.mult - 1);
    // what falls together pops up together: one number for each patch of town, gathered over a quarter of a second
    const key = Math.floor(x / 45) + ',' + Math.floor(z / 45) + kind;
    let b = this.bins.get(key); if (!b) this.bins.set(key, b = { kind, x: 0, y: 0, z: 0, n: 0, pts: 0 });
    b.x += x; b.z += z; b.y = Math.max(b.y, y); b.n++; b.pts += pts;
    this.recent.push(kind, t);
    if (o.big) this.moment('Big one!', 0.9);
  }

  // a number of its own, straight away (a landmark's bonus)
  pop(x, y, z, text, cls = 'b huge') {
    const p = this.pool.find(q => q.life <= 0) || this.pool.reduce((a, q) => (q.life < a.life ? q : a));
    p.x = x; p.y = y; p.z = z; p.life = p.max = 2.2; p.d.textContent = text; p.d.className = 'p ' + cls;
  }

  // the combo runs out
  drop() { this.n = 0; this.mult = 1; if (this.pill) this.pill.classList.remove('combo'); }

  here() { const tg = this.g.controls.target; return [tg.x, 0, tg.z]; }

  // a named moment: the words, a jolt, and (not too often) a beat of slow motion
  moment(text, slow = 0) {
    if ((this.cool[text] || -99) > this.t - 6) return;
    this.cool[text] = this.t;
    this.say(text);
    sfx('stinger', ...this.here());
    const g = this.g; if (g.disasters) g.disasters.shake(0.5);
    if (slow && this.slowCool <= this.t) { g.slowT = Math.max(g.slowT || 0, slow); this.slowCool = this.t + 7; }
  }

  // big words across the middle for a moment
  say(text, cls = '') {
    const c = this.call; c.className = ''; void c.offsetWidth; // restart the animation
    c.textContent = text; c.className = 'on' + (cls ? ' ' + cls : '');
  }

  // each frame: dt real seconds, sdt game seconds (0 once the run is over: the last numbers float away)
  frame(dt, sdt) {
    this.t += sdt;
    this.tokens = Math.min(5, this.tokens + sdt * 3);
    if (this.n && this.t - this.lastT > WINDOW) this.drop();
    // the named moments from what has piled up in the last few seconds
    const R = this.recent, t = this.t; let i0 = 0; while (i0 < R.length && R[i0 + 1] < t - 4) i0 += 2; if (i0) R.splice(0, i0);
    let b = 0, car = 0, fire = 0;
    for (let i = 0; i < R.length; i += 2) { const age = t - R[i + 1]; if (R[i] === 'b' && age < 1.5) b++; else if (R[i] === 'car' && age < 2) car++; else if (R[i] === 'fire') fire++; }
    if (b >= 7) this.moment('Whole block!', 0.7); else if (car >= 7) this.moment('Pile-up!'); else if (fire >= 6) this.moment('Up in flames!');
    if ((this.binT -= sdt) <= 0 && this.bins.size) { this.binT = 0.25; this.flush(); }
    this.draw(dt);
    // the multiplier on the score pill, its bar draining until the combo runs out
    if (!this.pill) return;
    const on = this.mult > 1 && this.n > 0;
    this.pill.classList.toggle('combo', on);
    if (on) { this.xEl.textContent = '×' + this.mult; this.bar.style.transform = 'scaleX(' + Math.max(0, 1 - (this.t - this.lastT) / WINDOW).toFixed(3) + ')'; }
    else this.bar.style.transform = 'scaleX(0)';
  }

  flush() {
    const list = [...this.bins.values()].sort((a, b) => b.pts - a.pts); this.bins.clear();
    for (const b of list.slice(0, 6)) {
      let p = this.pool.find(q => q.life <= 0); if (!p) p = this.pool.reduce((a, q) => (q.life < a.life ? q : a));
      p.x = b.x / b.n; p.z = b.z / b.n; p.y = b.y + 4; p.life = 1.3; p.max = 1.3;
      p.d.textContent = '+' + Math.round(b.pts).toLocaleString();
      p.d.className = 'p ' + b.kind + (b.pts >= 3000 ? ' huge' : b.pts >= 700 ? ' big' : '');
    }
  }

  // the numbers where they happened (on the curved ground), rising and fading
  draw(dt) {
    const g = this.g, cam = g.camera, k = CURVE.k.value, c = CURVE.c.value, W = innerWidth, H = innerHeight, v = this.v;
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.d.style.opacity = '0'; continue; }
      v.set(p.x, p.y - k * ((p.x - c.x) ** 2 + (p.z - c.y) ** 2), p.z).project(cam);
      if (v.z > 1 || v.z < -1) { p.d.style.opacity = '0'; continue; }
      const a = 1 - p.life / p.max, sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H - a * 46, s = a < 0.12 ? 0.6 + a / 0.12 * 0.5 : 1.1 - Math.min(0.1, a);
      p.d.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + s.toFixed(3) + ')';
      p.d.style.opacity = String(a > 0.7 ? (1 - a) / 0.3 : 1);
    }
  }
}
