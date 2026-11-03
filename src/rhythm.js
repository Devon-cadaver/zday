// Play the band (Sandbox; Sean): tap the band on its stage (or pick it in Take over), Control, and play the theme song as
// them. Balls come up over the four of them, a ring closing in on each; tap as the ring meets the ball - on the beat of the
// song - and that one plays the note: PERFECT or GOOD, the combo climbing (x2, x3, x4) and the show with it, flame jets
// every 10 in a row, fireworks every 25; a miss breaks it. A minute's set after a count-in, then the score, a grade and
// the best kept. The beat: every beat of each song and what the drums play on it, measured from the files (beatmap.js; the
// songs drift, so no one steady count will do); the song's clock is the band's own player (music.js), smoothed; with the
// music off the balls keep the same beat in silence. main.js hands it the camera while it plays, like the planes (frame).
// A miss: the lamps spark and the song crunches. Perfects in a row: the crowd presses in and more come, more flames and
// fireworks. The crowd meter down: the song skips; at nothing it stops and the band walks off, and that is the set.
import * as THREE from 'three';
import { BEATS } from './beatmap.js';
import { sfx } from './audio.js';

const AP = 1.2, PERFECT = 0.1, GOOD = 0.2, FAR = 0.55, GAP = 0.26, SET = 60, COUNT = 4; // the ring's time in (s), the windows either side of the beat (s), a tap sooner than this is not meant for it yet (s), the least time between balls (s), the set (s), beats counted in
const ICON = { vox: '🎤', gtr: '🎸', bass: '🎸', drums: '🥁' };
const BEST = 'zday_band_best';
const ROCK_MISS = 4, ROCK_OFF = 3, ROCK_GOOD = 1, ROCK_PERFECT = 2, ROCK_SKIP = 45, ROCK_BAD = 25; // the crowd meter, out of 100: 25 misses from full and they walk off; the song skips from 14
const LANES = { k: [2, 3, 1], s: [3, 0, 1], b: [3, 0, 2] }; // who plays a kick, a snare, both: the bass and the drums, the drums and the singer
const hash = (k, s) => { const x = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

const CSS = `
#zd-band{position:fixed;left:0;top:0;right:0;bottom:0;z-index:29;touch-action:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#zd-band .hud{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);width:min(90vw,380px);padding:7px 10px;border-radius:12px;background:rgba(10,5,20,.66);text-align:center;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none}
#zd-band .ttl{font:900 13px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.08em}
#zd-band .sc{display:flex;justify-content:space-between;margin-top:6px;font:800 14px/1 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
#zd-band .sc b{color:#ffd27a}
#zd-band .bar{height:6px;margin-top:6px;border-radius:3px;background:rgba(0,0,0,.45);overflow:hidden}
#zd-band .bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff4fa3,#ffd27a)}
#zd-band .cnt{display:flex;justify-content:center;gap:12px;margin-top:6px;font:800 12px/1 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
#zd-band .cnt .p{color:#ffd27a}#zd-band .cnt .g{color:#8affb0}#zd-band .cnt .m{color:#ff7a7a}
#zd-band .rock{display:flex;align-items:center;gap:6px;margin-top:6px;font:800 10px/1 system-ui,-apple-system,sans-serif;letter-spacing:.06em}
#zd-band .rock .tr{flex:1;height:9px;border-radius:5px;background:rgba(0,0,0,.5);overflow:hidden}
#zd-band .rock .tr i{display:block;height:100%;width:100%;background:#58e07a;transition:width .15s,background .2s}
#zd-band .cheer{position:absolute;left:50%;top:24%;transform:translate(-50%,-50%);white-space:nowrap;color:#ffd27a;font:900 22px/1 system-ui,-apple-system,sans-serif;text-shadow:0 2px 8px #000;pointer-events:none;animation:zdBJudge 1.2s ease-out forwards}
#zd-band .hurt{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 70px 14px rgba(255,60,40,.55);animation:zdBHurt .3s ease-out forwards}
@keyframes zdBHurt{to{opacity:0}}
#zd-band .res .gr.off{color:#ff7a7a;text-shadow:0 0 18px rgba(255,90,90,.6)}
#zd-band .res .tag{font:900 15px/1.3 system-ui,-apple-system,sans-serif;color:#ffd27a;margin-top:4px;letter-spacing:.04em}
#zd-band .hint{margin-top:6px;font:600 11px/1.3 system-ui,-apple-system,sans-serif;opacity:.85}
#zd-band .note{position:absolute;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:26px;background:radial-gradient(circle,rgba(255,120,200,.95),rgba(160,30,140,.75) 62%,rgba(160,30,140,.2) 74%);box-shadow:0 0 14px 3px rgba(255,90,200,.8);touch-action:none}
#zd-band .note i{position:absolute;left:-6px;top:-6px;right:-6px;bottom:-6px;border-radius:50%;border:3px solid #ffd27a;pointer-events:none}
#zd-band .note.girl{background:radial-gradient(circle,rgba(255,170,220,.95),rgba(40,10,30,.8) 62%,rgba(40,10,30,.2) 74%)}
#zd-band .note.hit{animation:zdBPop .22s ease-out forwards}
#zd-band .note.miss{animation:zdBMiss .3s ease-out forwards}
@keyframes zdBPop{to{transform:scale(1.8);opacity:0}}
@keyframes zdBMiss{to{transform:scale(.4) translateY(30px);opacity:0;filter:grayscale(1)}}
#zd-band .judge{position:absolute;transform:translate(-50%,-50%);font:900 15px/1 system-ui,-apple-system,sans-serif;letter-spacing:.06em;text-shadow:0 1px 3px #000;pointer-events:none;animation:zdBJudge .7s ease-out forwards}
@keyframes zdBJudge{to{transform:translate(-50%,-160%);opacity:0}}
#zd-band .big{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);color:#fff;font:900 64px/1 system-ui,-apple-system,sans-serif;text-shadow:0 2px 12px #000;pointer-events:none}
#zd-band .acts{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:8px}
#zd-band .acts button{appearance:none;border:2px solid rgba(255,255,255,.35);border-radius:12px;padding:12px 18px;font:800 13px system-ui,-apple-system,sans-serif;color:#fff;background:linear-gradient(#ff5a8a,#c2165a);cursor:pointer}
#zd-band .acts button.go{background:linear-gradient(#ff4fa3,#a0168a)}
#zd-band .res{position:absolute;left:calc(50% - 22px);top:50%;transform:translate(-50%,-55%);width:min(calc(100vw - 110px),320px);padding:18px 16px;border-radius:16px;background:rgba(20,10,30,.88);border:1px solid rgba(255,255,255,.2);color:#fff;text-align:center}
#zd-band .res .gr{font:900 64px/1 system-ui,-apple-system,sans-serif;color:#ffd27a;text-shadow:0 0 18px rgba(255,200,90,.6)}
#zd-band .res .pts{font:900 22px/1.3 system-ui,-apple-system,sans-serif;margin-top:4px}
#zd-band .res .ln{font:700 13px/1.6 system-ui,-apple-system,sans-serif;opacity:.9}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe,body.zd-flying #zd-top{display:none!important} /* the town's bars put away while playing (flight.js has the same; it may not have run yet) */
.zd-bandoffer{position:fixed;z-index:30;transform:translate(-50%,-130%);padding:10px 14px;border-radius:14px;border:2px solid #ffd27a;background:linear-gradient(#ff4fa3,#a0168a);color:#fff;font:800 13px system-ui,-apple-system,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 0 16px rgba(255,90,200,.6)}
`;

export class BandGame {
  constructor(game, ctx) { // ctx: { camera, controls, post, renderer }
    this.g = game; this.ctx = ctx; this.active = false; this.near = 0.5; this.focus = 20; this.lod = 1; // main.js: close on the stage, the trees in fewer pieces
  }
  band() { const b = this.g.band; return b && b.venue && b.on ? b : null; }
  css() { if (!document.getElementById('zd-band-css')) { const s = document.createElement('style'); s.id = 'zd-band-css'; s.textContent = CSS; document.head.appendChild(s); } }
  // a tap on the town (game.js): on the stage, the offer to play them. true: it was on the stage
  tapStage(cx, cy) {
    const B = this.band(), cam = this.ctx.camera; if (!B || this.active || this.g.modeName !== 'sandbox') return false;
    if (this.g.mode && this.g.mode.busy && this.g.mode.busy()) return false; // a disaster picked and waiting to be dropped: the tap is its
    const V = B.venue; _v.set(V.x, V.y + V.H + 2, V.z); const d = cam.position.distanceTo(_v), p = _v.clone().project(cam); if (p.z > 1) return false;
    const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight, f = innerHeight / (2 * Math.tan(cam.fov * Math.PI / 360)), R = Math.max(36, V.W * 0.6 / d * f);
    if (Math.hypot(cx - sx, cy - sy) > R) return false;
    this.offer(sx, sy); return true;
  }
  offer(x, y) {
    this.css(); if (this.offerEl) this.offerEl.remove(); clearTimeout(this.offerT);
    const b = this.offerEl = document.createElement('button'); b.type = 'button'; b.className = 'zd-bandoffer'; b.textContent = '🎸 Control the band';
    b.style.left = Math.max(90, Math.min(innerWidth - 90, x)) + 'px'; b.style.top = Math.max(110, y) + 'px';
    b.onclick = (e) => { e.stopPropagation(); b.remove(); this.offerEl = null; this.start(); };
    document.body.appendChild(b); this.offerT = setTimeout(() => { b.remove(); if (this.offerEl === b) this.offerEl = null; }, 5000);
  }
  // on: the camera in front of the stage, everything else put away
  start() {
    const g = this.g, B = this.band();
    if (!B) { g.toast(g.band && g.band.venue ? 'The show is over here. Reset the town to put the band back on' : 'There is no stage in this town', 3500); return; }
    for (const p of [g.flight, g.drive, g.takeover]) if (p && p.active) p.stop(true);
    if (g.takeover && g.takeover.picking) g.takeover.endPick();
    const { camera, controls, post } = this.ctx;
    this.saved = { pos: camera.position.clone(), tg: controls.target.clone(), fov: camera.fov, dof: post.opts.dof };
    this.B = B; const map = this.map = BEATS[B.girls ? 'theme2' : 'theme']; this.pms = (map.ms[map.ms.length - 1] - map.ms[0]) / (map.ms.length - 1); this.period = this.pms / 1000; this.step = B.girls ? 2 : 1; // the girls' song is half-time on a fast beat: a ball on every second one, as a rule
    this.active = true; controls.enabled = false; post.opts.dof = false; g.setFollow(-1); document.body.classList.add('zd-flying');
    camera.fov = innerHeight > innerWidth ? 66 : 50; camera.updateProjectionMatrix(); // a wider lens than the town's: close in front of the stage, not across the stands
    const M = g.audio && g.audio.music; if (M) M.bandLoud = true;
    B.beatClock = () => this.beatAt(this.clock); // the band moves on the song's beat
    this.place(); this.ui(); this.reset();
  }
  // the camera: square on to the stage, far enough back that the guitars either side are in (the screen's width), a little above
  place() {
    const B = this.B, V = B.venue, cam = this.ctx.camera, hf = Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect), back = Math.max(13, (V.W * 0.3 + 2) / Math.tan(hf));
    this.camAt = B.g.localToWorld(new THREE.Vector3(0, V.H + 4 + back * 0.16, V.D / 2 + back)); this.lookAt = B.g.localToWorld(new THREE.Vector3(0, V.H + 2.1, -0.4));
    if (V.bowl) { const b = V.bowl, r = Math.min(b.R - 2, this.camAt.z - b.cz); this.camAt.z = b.cz + r; if (r > b.r0) this.camAt.y = Math.max(this.camAt.y, b.y0 + 1 + 14 * (r - b.r0) / (b.R - b.r0) + 2.4); } // in a stadium: up in the stands, over the crowd, not out through the wall
  }
  ui() {
    this.css(); const el = this.el = document.createElement('div'); el.id = 'zd-band';
    el.innerHTML = '<div class="hud"><div class="ttl">🎸 PLAY THE BAND: TAP EACH BALL AS ITS RING CLOSES</div><div class="sc"><span>SCORE <b class="pts">0</b></span><span>COMBO <b class="cb">0</b></span></div><div class="bar"><i></i></div><div class="cnt"><span class="p">PERFECT <b class="np">0</b></span><span class="g">GOOD <b class="ng">0</b></span><span class="m">MISS <b class="nm">0</b></span></div><div class="rock"><span>CROWD</span><div class="tr"><i></i></div></div><div class="hint"></div></div><div class="acts"><button type="button" data-b="stop">Stop</button></div>';
    document.body.appendChild(el);
    this.ptsEl = el.querySelector('.pts'); this.cbEl = el.querySelector('.cb'); this.barI = el.querySelector('.bar i'); this.hintEl = el.querySelector('.hint'); this.npEl = el.querySelector('.np'); this.ngEl = el.querySelector('.ng'); this.nmEl = el.querySelector('.nm'); this.rockI = el.querySelector('.rock i');
    el.querySelector('[data-b="stop"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
    this.onKey = (e) => { if (e.key === 'Escape') this.stop(); }; addEventListener('keydown', this.onKey); // Esc, as in the planes
  }
  // a new set
  reset() {
    for (const n of this.notes || []) n.el.remove(); if (this.res) { this.res.remove(); this.res = null; } if (this.bigEl) { this.bigEl.remove(); this.bigEl = null; }
    this.notes = []; this.score = 0; this.combo = 0; this.bestCombo = 0; this.hits = { perfect: 0, good: 0, miss: 0 }; this.over = false; this.last = -1; this.same = 0; this.rock = 100; this.run = 0; this.hype = 0; this.skipT = 0; this.walking = false; this.lastAt = -9; this.B.hype = 0; this.B.quiet = false;
    if (this.B.off) this.B.back(); if (this.held) { this.held = false; const Mh = this.g.audio && this.g.audio.music; if (Mh && Mh.holdBand) Mh.holdBand(false); }
    const M = this.g.audio && this.g.audio.music, el = M && M.bandEl;
    if (el && !el.paused && el.duration && el.duration - el.currentTime < SET + 15) { try { el.currentTime = 0; M.songAt = performance.now(); } catch (e) { /* not seekable */ } } // too near the end for a whole set: from the top (the song's own clock with it)
    this.clock = null; this.tick(0); // where the song is now
    const k0 = Math.ceil(this.beatAt(this.clock)) + 1, cn = COUNT * this.step; this.k0 = k0; this.nextK = k0 + cn; this.go = this.at(k0 + cn); this.endT = this.go + SET; this.endK = Math.ceil(this.beatAt(this.endT)); // a count-in, then a minute of beats
    this.counted = k0 - 1; this.show();
  }
  // the song's clock: the band player's time, smoothed (it ticks coarsely on some phones); a jump (it looped, it was
  // re-seeked) starts the count again; silent, a clock of its own
  // the song's time at this moment, between frames (a tap is judged when it happens, not at the last frame: slow phones)
  now() { return (this.clock ?? 0) + Math.min(0.25, (performance.now() - (this.clockAt || performance.now())) / 1000); }
  tick(dt) {
    this.clockAt = performance.now();
    const M = this.g.audio && this.g.audio.music, el = M && M.bandEl, on = !!(el && !el.paused && el.readyState >= 2 && M.level > 0);
    this.audible = on;
    if (!on) { this.clock = (this.clock ?? 0) + dt; return false; }
    const a = el.currentTime; if (this.clock == null) { this.clock = a; return false; }
    const want = this.clock + dt;
    if (a < this.clock - 1 || a > want + 2) { this.jumpFrom = this.clock; this.clock = a; return true; } // looped back to the start, or skipped on
    this.clock = Math.abs(a - want) > 0.12 ? a : want + (a - want) * 0.1; // drifted (a slow frame): straight to it; otherwise eased
    return false;
  }
  // beat k (it may be between two) as a time in the song; a time as a beat. Past either end of the map, the song's average beat
  at(k) { const m = this.map.ms, n = m.length; if (k <= 0) return (m[0] + k * this.pms) / 1000; if (k >= n - 1) return (m[n - 1] + (k - n + 1) * this.pms) / 1000; const i = Math.floor(k); return (m[i] + (m[i + 1] - m[i]) * (k - i)) / 1000; }
  beatAt(t) { const m = this.map.ms, n = m.length, q = (t ?? 0) * 1000; if (q <= m[0]) return (q - m[0]) / this.pms; if (q >= m[n - 1]) return n - 1 + (q - m[n - 1]) / this.pms; let a = 0, b = n - 1; while (b - a > 1) { const c = (a + b) >> 1; if (m[c] <= q) a = c; else b = c; } return a + (q - m[a]) / (m[b] - m[a]); }
  show() { this.npEl.textContent = this.hits.perfect; this.ngEl.textContent = this.hits.good; this.nmEl.textContent = this.hits.miss; this.rockI.style.width = this.rock + '%'; this.rockI.style.background = this.rock > ROCK_SKIP ? '#58e07a' : this.rock > ROCK_BAD ? '#ffc04a' : '#ff5a4a'; this.ptsEl.textContent = this.score; this.cbEl.textContent = this.combo + (this.combo >= 10 ? ' x' + this.mult() : ''); }
  mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }
  // which of them plays beat k (null: a rest), from what the drums do on it (beatmap.js): nothing there, no ball. Every
  // other beat to begin with, more of the rest as the set goes on; a kick to the bass or the drums, a snare to the drums or
  // the singer; never the same one three times running
  chart(k, kind) {
    const prog = Math.max(0, (this.at(k) - this.go) / SET), r = hash(k, 1), girls = this.B.girls;
    if (kind == null) kind = this.map.on[((k % this.map.on.length) + this.map.on.length) % this.map.on.length] || '-';
    if (kind === '-') return null;
    const on = k % 2 === 0 || kind === 'b' && !girls || r < (girls ? 0.08 + 0.3 * prog : 0.2 + 0.5 * prog);
    if (!on) return null;
    const L = LANES[kind]; let lane = L[Math.floor(hash(k, 3) * L.length)];
    if (lane === this.last && ++this.same >= 2) { lane = (lane + 1 + Math.floor(hash(k, 4) * 2)) % 4; this.same = 0; } else if (lane !== this.last) this.same = 0;
    this.last = lane; return lane;
  }
  spawn(k, lane, at) {
    const role = this.B.members[lane].role, el = document.createElement('div'); el.className = 'note' + (this.B.girls ? ' girl' : ''); el.innerHTML = ICON[role] + '<i></i>';
    const n = { k, lane, at, el, ring: el.querySelector('i'), done: false }; this.el.appendChild(el); this.notes.push(n);
    el.style.zIndex = String(100000 - Math.round(at * 10)); /* the one due first on top */ el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); let q = n; for (const o of this.notes) if (!o.done && o.lane === n.lane && o.at < q.at) q = o; this.judge(q); }); // two over the same one: the tap is for the one due first
  }
  // the song jumped: the balls in the air dropped (no misses), the beats laid again from where it is now; the score, the
  // combo and the time left kept
  resync() {
    for (const n of this.notes) if (!n.done) { n.done = true; n.el.remove(); }
    const left = Math.max(0, this.endT - (this.jumpFrom ?? this.clock)), k = Math.ceil(this.beatAt(this.clock)) + 1, cn = COUNT * this.step;
    this.nextK = k; this.go = this.at(k) - Math.max(0, SET - left); this.endT = this.at(k) + left; this.endK = Math.ceil(this.beatAt(this.endT)); this.k0 = k - cn; this.counted = k; this.big('');
  }
  // a tap on a ball: how near the beat
  judge(n) {
    if (n.done || this.over || this.g.paused) return; const d = this.now() - n.at, ad = Math.abs(d);
    if (d < -FAR) return; // far too early: not meant for this one yet
    if (d < -GOOD) { this.miss(n, true); return; } // too soon: it plays wrong
    const perfect = ad <= PERFECT; n.done = true; n.el.classList.add('hit'); setTimeout(() => n.el.remove(), 230);
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.hits[perfect ? 'perfect' : 'good']++;
    this.score += (perfect ? 100 : 50) * this.mult(); this.say(n, perfect ? 'PERFECT' : 'GOOD', perfect ? '#ffd27a' : '#8affb0');
    this.rock = Math.min(100, this.rock + (perfect ? ROCK_PERFECT : ROCK_GOOD)); this.run = perfect ? this.run + 1 : 0; if (perfect && this.run >= 3) this.hype = Math.min(1, this.hype + 0.035); else if (!perfect) this.hype = Math.max(0, this.hype - 0.01); this.B.hype = this.hype; this.B.quiet = this.rock <= ROCK_SKIP;
    if (perfect && this.run % 10 === 0) this.cheer(this.run + ' PERFECT IN A ROW!'); else if (perfect && this.run === 5) this.cheer('MORE FANS COMING!');
    this.show();
    const B = this.B, mb = B.members[n.lane]; mb.hop = 0.35; // that one leaps (band.js)
    if (n.lane === 3 || perfect) B.pyro.emit(B.g.localToWorld(_w.set(mb.x, B.venue.H + 2.5, mb.z)).x, _w.y, _w.z, perfect ? 10 : 5, { up: [4, 9], spread: 0.8, life: 0.5, size: 1.4 });
    if (this.combo % 10 === 0) { B.pyroT = 0; sfx('chime', B.venue.x, B.venue.y + 4, B.venue.z, { gain: 0.35 }); } // flame jets across the front
    if (this.combo % 25 === 0) { B.fwT = 0; setTimeout(() => { if (this.B) this.B.fwT = 0; }, 300); } // fireworks
  }
  miss(n, soon) {
    n.done = true; n.el.classList.add('miss'); setTimeout(() => n.el.remove(), 300);
    this.combo = 0; this.run = 0; this.hits.miss++; this.say(n, soon ? 'TOO SOON' : 'MISS', '#ff7a7a'); this.rock = Math.max(0, this.rock - (soon ? ROCK_OFF : ROCK_MISS)); this.hype = Math.max(0, this.hype - 0.12); this.B.hype = this.hype; this.B.quiet = this.rock <= ROCK_SKIP; this.show();
    const M = this.g.audio && this.g.audio.music; this.B.sparkLamps(); if (M && M.bandHurt) M.bandHurt(); sfx('thud', this.B.venue.x, this.B.venue.y + 2, this.B.venue.z, { gain: 0.25, rate: 0.6 });
    const h = document.createElement('div'); h.className = 'hurt'; this.el.appendChild(h); setTimeout(() => h.remove(), 320);
    if (this.rock <= 0) this.walkOff();
  }
  cheer(s) { const c = document.createElement('div'); c.className = 'cheer'; c.textContent = s; this.el.appendChild(c); setTimeout(() => c.remove(), 1200); }
  // the crowd meter empty: the song stops dead, the band walks off, and that is the set (frame: the results when they are gone)
  walkOff() {
    this.over = true; this.walking = true; this.big(''); for (const n of this.notes) if (!n.done) { n.done = true; n.el.remove(); } this.cheer('THE BAND HAS HAD ENOUGH');
    const M = this.g.audio && this.g.audio.music; if (M && M.setBand) { M.setBand(0, true); this.held = true; if (M.holdBand) M.holdBand(true); } this.B.hype = 0; this.B.quiet = true; this.B.walkOff();
  }
  say(n, text, col) { const j = document.createElement('div'); j.className = 'judge'; j.textContent = text; j.style.color = col; j.style.left = n.el.style.left; j.style.top = n.el.style.top; this.el.appendChild(j); setTimeout(() => j.remove(), 700); }
  // where a member's ball goes on the screen: over their head (the singer's lower, in front of the drummer's)
  spotOf(lane) {
    const B = this.B, mb = B.members[lane], H = B.venue.H, y = lane === 0 ? H + 1.9 : lane === 3 ? H + 4.4 : H + 3.9, z = lane === 0 ? mb.z + 0.6 : mb.z;
    B.g.localToWorld(_v.set(mb.x, y, z)).project(this.ctx.camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight];
  }
  // a frame (real time): the camera, the song's clock, the balls in and out
  frame(dt, tg) {
    const cam = this.ctx.camera, B = this.B;
    if (!B || !B.on) { this.stop('The show was broken up!'); return; }
    this.place(); cam.position.copy(this.camAt); cam.up.set(0, 1, 0); cam.lookAt(this.lookAt); this.focus = cam.position.distanceTo(this.lookAt);
    tg.set(this.lookAt.x, 0, this.lookAt.z); this.g.focusAt = this.lookAt;
    if (this.over) { if (this.walking && B.offDone) { this.walking = false; this.results(true); } return; }
    const paused = !!this.g.paused, M = this.g.audio && this.g.audio.music; // the pause button: the song held where it is, the balls frozen
    if (paused !== !!this.held) { this.held = paused; if (M && M.holdBand) M.holdBand(paused); }
    if (paused) return;
    if (this.tick(dt)) { this.resync(); return; } // the song jumped (it looped, the music button): the set carries on from there
    const t = this.clock, cn = COUNT * this.step;
    // the song falling apart: it skips, more often as the crowd goes
    if (this.rock <= ROCK_SKIP && t > this.go && (this.skipT -= dt) <= 0) { this.skipT = this.rock <= ROCK_BAD ? 1.3 : 2.6; if (M && M.bandSkip) M.bandSkip(); this.cheer('THE SONG IS FALLING APART'); }
    // the count-in: 4, 3, 2, 1 on the beats before the first ball lands
    const kb = Math.floor(this.beatAt(t) + 0.0001);
    if (kb > this.counted && kb < this.k0 + cn) { this.counted = kb; const left = Math.ceil((this.k0 + cn - kb) / this.step); if ((this.k0 + cn - kb) % this.step === 0) this.big(left > 0 && left <= COUNT ? String(left) : ''); }
    else if (kb >= this.k0 + cn && this.counted < this.k0 + cn) { this.counted = kb; this.big('GO!'); setTimeout(() => this.big(''), 400); }
    // the balls due within the ring's time in
    while (this.nextK < this.endK && this.at(this.nextK) - t < AP) {
      const k = this.nextK++, lane = this.chart(k); if (lane != null) { const a = this.at(k); if (a - this.lastAt >= GAP) { this.spawn(k, lane, a); this.lastAt = a; } }
      if (!this.B.girls && k > this.k0 + cn + 8) { const kind = this.map.half[k] || '-', a = this.at(k + 0.5); if (kind !== '-' && hash(k, 5) < 0.06 + 0.3 * Math.min(1, (a - this.go) / SET) && a - this.lastAt >= GAP) { const l2 = this.chart(k + 0.5, kind); if (l2 != null) { this.spawn(k + 0.5, l2, a); this.lastAt = a; } } } // a drum hit half way to the next beat as well
    }
    for (const n of this.notes) {
      if (n.done) continue;
      if (t - n.at > GOOD) { this.miss(n); continue; }
      const [x, y] = this.spotOf(n.lane), s = 1 + 1.8 * Math.max(0, (n.at - t) / AP); // the ring closing in
      n.el.style.left = Math.max(36, Math.min(innerWidth - 90, x)) + 'px'; n.el.style.top = y + 'px'; n.ring.style.transform = 'scale(' + s.toFixed(3) + ')'; n.ring.style.opacity = s > 2.6 ? '0.4' : '1';
    }
    if (this.notes.length > 40) this.notes = this.notes.filter(n => !n.done);
    const end = this.endT; this.barI.style.width = Math.max(0, Math.min(100, (end - t) / SET * 100)) + '%';
    this.hintEl.textContent = this.audible ? '' : 'Turn the music on (🎵) to hear the song';
    if (t > end + GOOD + 0.1 && this.notes.every(n => n.done)) this.results();
  }
  big(s) { if (!this.el) return; if (!this.bigEl) { this.bigEl = document.createElement('div'); this.bigEl.className = 'big'; this.el.appendChild(this.bigEl); } this.bigEl.textContent = s; }
  // the set over: the grade, the score, the best kept
  results(walked) {
    this.over = true; this.big('');
    const h = this.hits, n = h.perfect + h.good + h.miss, acc = n ? (h.perfect + h.good * 0.5) / n : 0, allP = n > 0 && h.perfect === n, full = n > 0 && h.miss === 0, grade = walked ? 'F' : allP ? 'S+' : acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D', tag = walked ? 'THE BAND WALKED OFF' : allP ? 'ALL PERFECT!' : full ? 'FULL COMBO: NOT ONE MISSED' : h.perfect + ' OF ' + n + ' PERFECT';
    let best = 0; try { best = +(localStorage.getItem(BEST) || 0); } catch (e) { /* no storage */ }
    const newBest = !walked && this.score > best; if (newBest) { try { localStorage.setItem(BEST, String(this.score)); } catch (e) { /* not kept */ } }
    const r = this.res = document.createElement('div'); r.className = 'res';
    r.innerHTML = '<div class="gr' + (walked ? ' off' : '') + '">' + grade + '</div><div class="tag">' + tag + '</div><div class="pts">' + this.score + (newBest ? ' ⭐ NEW BEST' : '') + '</div><div class="ln">PERFECT ' + h.perfect + ' · GOOD ' + h.good + ' · MISS ' + h.miss + '</div><div class="ln">Best combo ' + this.bestCombo + ' · ' + Math.round(acc * 100) + '% on the beat</div>' + (newBest || !best ? '' : '<div class="ln">Your best: ' + best + '</div>');
    this.el.appendChild(r);
    const acts = this.el.querySelector('.acts'); acts.innerHTML = '<button type="button" class="go" data-b="again">' + (walked ? 'Try again' : 'Play again') + '</button><button type="button" data-b="stop">Done</button>';
    acts.querySelector('[data-b="again"]').onclick = (e) => { e.stopPropagation(); acts.innerHTML = '<button type="button" data-b="stop">Stop</button>'; acts.querySelector('[data-b="stop"]').onclick = (ev) => { ev.stopPropagation(); this.stop(); }; if (!walked) { this.reset(); return; } if (this.res) { this.res.remove(); this.res = null; } this.B.back(); if (this.held) { this.held = false; const Mh = this.g.audio && this.g.audio.music; if (Mh && Mh.holdBand) Mh.holdBand(false); } setTimeout(() => { if (this.active && this.over) this.reset(); }, 800); }; // the band back on and the song going again, then the count
    acts.querySelector('[data-b="stop"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
    if (this.B && newBest) { this.B.fwT = 0; this.B.pyroT = 0; }
    this.lastResult = { grade, tag, walked: !!walked, score: this.score, acc, ...h, bestCombo: this.bestCombo };
  }
  // off: the view back where it was
  stop(why) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx;
    this.active = false; document.body.classList.remove('zd-flying'); removeEventListener('keydown', this.onKey); if (this.held) { this.held = false; const Mh = g.audio && g.audio.music; if (Mh && Mh.holdBand) Mh.holdBand(false); } if (this.el) this.el.remove(); this.el = null; this.notes = []; this.bigEl = null; this.res = null;
    const M = g.audio && g.audio.music; if (M) M.bandLoud = false;
    if (this.B) { this.B.beatClock = null; this.B.hype = null; this.B.quiet = false; if (this.B.off) this.B.back(); for (const mb of this.B.members) mb.hop = 0; } this.B = null;
    camera.position.copy(this.saved.pos); controls.target.copy(this.saved.tg); camera.fov = this.saved.fov; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); post.opts.dof = this.saved.dof;
    controls.enabled = true; controls.update(); g.focusAt = null;
    if (why) g.toast(why, 3000);
  }
}
