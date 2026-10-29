// Play the band (Sandbox; Sean): tap the band on its stage (or pick it in Take over), Control, and play the theme song as
// them. Balls come up over the four of them, a ring closing in on each; tap as the ring meets the ball - on the beat of the
// song - and that one plays the note: PERFECT or GOOD, the combo climbing (x2, x3, x4) and the show with it, flame jets
// every 10 in a row, fireworks every 25; a miss breaks it. A minute's set after a count-in, then the score, a grade and
// the best kept. The beat: each song's tempo and first beat, measured from the files (band.js SONGS); the song's clock is
// the band's own player (music.js), smoothed; with the music off the balls keep the same beat in silence. main.js hands
// it the camera while it plays, like the planes (frame).
import * as THREE from 'three';
import { SONGS } from './band.js';
import { sfx } from './audio.js';

const AP = 1.2, PERFECT = 0.1, GOOD = 0.2, SET = 60, COUNT = 4; // the ring's time in (s), the windows either side of the beat (s), the set (s), beats counted in
const ICON = { vox: '🎤', gtr: '🎸', bass: '🎸', drums: '🥁' };
const BEST = 'zday_band_best';
const hash = (k, s) => { const x = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

const CSS = `
#zd-band{position:fixed;left:0;top:0;right:0;bottom:0;z-index:32;touch-action:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#zd-band .hud{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);width:min(90vw,380px);text-align:center;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none}
#zd-band .ttl{font:900 13px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.08em}
#zd-band .sc{display:flex;justify-content:space-between;margin-top:6px;font:800 14px/1 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
#zd-band .sc b{color:#ffd27a}
#zd-band .bar{height:6px;margin-top:6px;border-radius:3px;background:rgba(0,0,0,.45);overflow:hidden}
#zd-band .bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff4fa3,#ffd27a)}
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
#zd-band .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-55%);width:min(84vw,320px);padding:18px 16px;border-radius:16px;background:rgba(20,10,30,.88);border:1px solid rgba(255,255,255,.2);color:#fff;text-align:center}
#zd-band .res .gr{font:900 64px/1 system-ui,-apple-system,sans-serif;color:#ffd27a;text-shadow:0 0 18px rgba(255,200,90,.6)}
#zd-band .res .pts{font:900 22px/1.3 system-ui,-apple-system,sans-serif;margin-top:4px}
#zd-band .res .ln{font:700 13px/1.6 system-ui,-apple-system,sans-serif;opacity:.9}
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
    this.B = B; this.song = SONGS[B.girls ? 'theme2' : 'theme']; this.period = 60 / this.song.bpm; this.mul = B.girls ? 2 : 1; // the girls' song is half-time: the band moves at double
    this.active = true; controls.enabled = false; post.opts.dof = false; g.setFollow(-1); document.body.classList.add('zd-flying');
    camera.fov = 50; camera.updateProjectionMatrix(); // a wider lens than the town's: close in front of the stage, not across the stands
    const M = g.audio && g.audio.music; if (M) M.bandLoud = true;
    B.beatClock = () => (this.clock - this.song.first) / this.period * this.mul; // the band moves on the song's beat
    this.place(); this.ui(); this.reset();
  }
  // the camera: square on to the stage, far enough back that the guitars either side are in (the screen's width), a little above
  place() {
    const B = this.B, V = B.venue, cam = this.ctx.camera, hf = Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect), back = Math.max(13, (V.W * 0.3 + 2) / Math.tan(hf));
    this.camAt = B.g.localToWorld(new THREE.Vector3(0, V.H + 4 + back * 0.16, V.D / 2 + back)); this.lookAt = B.g.localToWorld(new THREE.Vector3(0, V.H + 2.1, -0.4));
  }
  ui() {
    this.css(); const el = this.el = document.createElement('div'); el.id = 'zd-band';
    el.innerHTML = '<div class="hud"><div class="ttl">🎸 PLAY THE BAND: TAP EACH BALL AS ITS RING CLOSES</div><div class="sc"><span>SCORE <b class="pts">0</b></span><span>COMBO <b class="cb">0</b></span></div><div class="bar"><i></i></div><div class="hint"></div></div><div class="acts"><button type="button" data-b="stop">Stop</button></div>';
    document.body.appendChild(el);
    this.ptsEl = el.querySelector('.pts'); this.cbEl = el.querySelector('.cb'); this.barI = el.querySelector('.bar i'); this.hintEl = el.querySelector('.hint');
    el.querySelector('[data-b="stop"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
  }
  // a new set
  reset() {
    for (const n of this.notes || []) n.el.remove(); if (this.res) { this.res.remove(); this.res = null; } if (this.bigEl) { this.bigEl.remove(); this.bigEl = null; }
    this.notes = []; this.score = 0; this.combo = 0; this.bestCombo = 0; this.hits = { perfect: 0, good: 0, miss: 0 }; this.over = false; this.last = -1; this.same = 0;
    this.clock = null; this.tick(0); // where the song is now
    const k0 = Math.ceil((this.clock - this.song.first) / this.period) + 1; this.k0 = k0; this.nextK = k0 + COUNT; this.endK = k0 + COUNT + Math.round(SET / this.period); // a count-in, then a minute of beats
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
    if (a < this.clock - 1 || a > want + 2) { this.clock = a; return true; } // looped back to the start, or skipped on: a new set
    this.clock = Math.abs(a - want) > 0.12 ? a : want + (a - want) * 0.1; // drifted (a slow frame): straight to it; otherwise eased
    return false;
  }
  show() { this.ptsEl.textContent = this.score; this.cbEl.textContent = this.combo + (this.combo >= 10 ? ' x' + this.mult() : ''); }
  mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }
  // which of them plays beat k (null: a rest): the drums on the bar's downbeats as often as not, otherwise the singer or a
  // guitar, never the same one three times running; more of the off-beats as the set goes on
  chart(k) {
    const prog = (k - this.k0 - COUNT) * this.period / SET, r = hash(k, 1), girls = this.B.girls;
    const on = girls ? r > 0.12 : (k % 2 === 0 || r < 0.12 + 0.3 * prog);
    if (!on) return null;
    let lane = (k % 4 === 0 && hash(k, 2) < 0.5) ? 3 : Math.floor(hash(k, 3) * 3);
    if (lane === this.last && ++this.same >= 2) { lane = (lane + 1 + Math.floor(hash(k, 4) * 2)) % 4; this.same = 0; } else if (lane !== this.last) this.same = 0;
    this.last = lane; return lane;
  }
  spawn(k, lane, at) {
    const role = this.B.members[lane].role, el = document.createElement('div'); el.className = 'note' + (this.B.girls ? ' girl' : ''); el.innerHTML = ICON[role] + '<i></i>';
    const n = { k, lane, at, el, ring: el.querySelector('i'), done: false }; this.el.appendChild(el); this.notes.push(n);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.judge(n); });
  }
  // a tap on a ball: how near the beat
  judge(n) {
    if (n.done || this.over) return; const d = this.now() - n.at, ad = Math.abs(d);
    if (d < -GOOD) return; // far too early: not yet
    const perfect = ad <= PERFECT; n.done = true; n.el.classList.add('hit'); setTimeout(() => n.el.remove(), 230);
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.hits[perfect ? 'perfect' : 'good']++;
    this.score += (perfect ? 100 : 50) * this.mult(); this.say(n, perfect ? 'PERFECT' : 'GOOD', perfect ? '#ffd27a' : '#8affb0'); this.show();
    const B = this.B, mb = B.members[n.lane]; mb.hop = 0.35; // that one leaps (band.js)
    if (n.lane === 3 || perfect) B.pyro.emit(B.g.localToWorld(_w.set(mb.x, B.venue.H + 2.5, mb.z)).x, _w.y, _w.z, perfect ? 10 : 5, { up: [4, 9], spread: 0.8, life: 0.5, size: 1.4 });
    if (this.combo % 10 === 0) { B.pyroT = 0; sfx('chime', B.venue.x, B.venue.y + 4, B.venue.z, { gain: 0.35 }); } // flame jets across the front
    if (this.combo % 25 === 0) { B.fwT = 0; setTimeout(() => { if (this.B) this.B.fwT = 0; }, 300); } // fireworks
  }
  miss(n) {
    n.done = true; n.el.classList.add('miss'); setTimeout(() => n.el.remove(), 300);
    this.combo = 0; this.hits.miss++; this.say(n, 'MISS', '#ff7a7a'); this.show();
    sfx('thud', this.B.venue.x, this.B.venue.y + 2, this.B.venue.z, { gain: 0.25, rate: 0.6 });
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
    if (this.over) return;
    if (this.tick(dt)) { for (const n of this.notes) if (!n.done) { n.done = true; n.el.remove(); } this.reset(); return; } // the song jumped: start the set again
    const t = this.clock, P = this.period, F = this.song.first;
    // the count-in: 4, 3, 2, 1 on the beats before the first ball lands
    const kb = Math.floor((t - F) / P + 0.0001);
    if (kb > this.counted && kb < this.k0 + COUNT) { this.counted = kb; const left = this.k0 + COUNT - kb; this.big(left > 0 && left <= COUNT ? String(left) : ''); }
    else if (kb >= this.k0 + COUNT && this.counted < this.k0 + COUNT) { this.counted = kb; this.big('GO!'); setTimeout(() => this.big(''), 400); }
    // the balls due within the ring's time in
    while (this.nextK < this.endK && F + this.nextK * P - t < AP) {
      const k = this.nextK++, lane = this.chart(k); if (lane != null) this.spawn(k, lane, F + k * P);
      if (this.B.girls && k > this.k0 + COUNT + 4 && hash(k, 5) < 0.08 + 0.2 * Math.min(1, (k - this.k0) * P / SET)) { const l2 = (lane == null ? 1 : lane + 2) % 4; this.spawn(k + 0.5, l2, F + (k + 0.5) * P); } // an off-beat as well
    }
    for (const n of this.notes) {
      if (n.done) continue;
      if (t - n.at > GOOD) { this.miss(n); continue; }
      const [x, y] = this.spotOf(n.lane), s = 1 + 1.8 * Math.max(0, (n.at - t) / AP); // the ring closing in
      n.el.style.left = x + 'px'; n.el.style.top = y + 'px'; n.ring.style.transform = 'scale(' + s.toFixed(3) + ')'; n.ring.style.opacity = s > 2.6 ? '0.4' : '1';
    }
    if (this.notes.length > 40) this.notes = this.notes.filter(n => !n.done);
    const end = F + this.endK * P; this.barI.style.width = Math.max(0, Math.min(100, (end - t) / SET * 100)) + '%';
    this.hintEl.textContent = this.audible ? '' : 'Turn the music on (🎵) to hear the song';
    if (t > end + GOOD + 0.1 && this.notes.every(n => n.done)) this.results();
  }
  big(s) { if (!this.bigEl) { this.bigEl = document.createElement('div'); this.bigEl.className = 'big'; this.el.appendChild(this.bigEl); } this.bigEl.textContent = s; }
  // the set over: the grade, the score, the best kept
  results() {
    this.over = true; this.big('');
    const h = this.hits, n = h.perfect + h.good + h.miss, acc = n ? (h.perfect + h.good * 0.5) / n : 0, grade = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
    let best = 0; try { best = +(localStorage.getItem(BEST) || 0); } catch (e) { /* no storage */ }
    const newBest = this.score > best; if (newBest) { try { localStorage.setItem(BEST, String(this.score)); } catch (e) { /* not kept */ } }
    const r = this.res = document.createElement('div'); r.className = 'res';
    r.innerHTML = '<div class="gr">' + grade + '</div><div class="pts">' + this.score + (newBest ? ' ⭐ NEW BEST' : '') + '</div><div class="ln">PERFECT ' + h.perfect + ' · GOOD ' + h.good + ' · MISS ' + h.miss + '</div><div class="ln">Best combo ' + this.bestCombo + ' · ' + Math.round(acc * 100) + '% on the beat</div>' + (newBest || !best ? '' : '<div class="ln">Your best: ' + best + '</div>');
    this.el.appendChild(r);
    const acts = this.el.querySelector('.acts'); acts.innerHTML = '<button type="button" class="go" data-b="again">Play again</button><button type="button" data-b="stop">Done</button>';
    acts.querySelector('[data-b="again"]').onclick = (e) => { e.stopPropagation(); acts.innerHTML = '<button type="button" data-b="stop">Stop</button>'; acts.querySelector('[data-b="stop"]').onclick = (ev) => { ev.stopPropagation(); this.stop(); }; this.reset(); };
    acts.querySelector('[data-b="stop"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
    if (this.B && newBest) { this.B.fwT = 0; this.B.pyroT = 0; }
    this.lastResult = { grade, score: this.score, acc, ...h, bestCombo: this.bestCombo };
  }
  // off: the view back where it was
  stop(why) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx;
    this.active = false; document.body.classList.remove('zd-flying'); if (this.el) this.el.remove(); this.el = null; this.notes = []; this.bigEl = null; this.res = null;
    const M = g.audio && g.audio.music; if (M) M.bandLoud = false;
    if (this.B) { this.B.beatClock = null; for (const mb of this.B.members) mb.hop = 0; } this.B = null;
    camera.position.copy(this.saved.pos); controls.target.copy(this.saved.tg); camera.fov = this.saved.fov; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); post.opts.dof = this.saved.dof;
    controls.enabled = true; controls.update(); g.focusAt = null;
    if (why) g.toast(why, 3000);
  }
}
