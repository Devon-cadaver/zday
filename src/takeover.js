// Taking over a disaster in the Sandbox (Sean): start one, then "Take over a unit": a label goes up over everything that
// can be driven (a saucer or a walker of an alien invasion, the worm, the kaiju, a tornado); tap one, then Take over. It
// is then yours from behind (third person; the worm from above the ground over where it tunnels): the left thumb moves it
// across the screen (up away from the camera), a drag on the right half turns the view, a pinch or the wheel zooms, and
// its own buttons do what it does (a saucer beams people up, zaps, drops aliens; a walker beams and burns; the worm bursts
// out of the ground; the kaiju throws a car, reaches with a tentacle, breathes fire). Stop hands it back to itself. The
// units' own player switches (Be The Disaster's) keep them from thinking for themselves meanwhile. main.js hands it the
// camera like the planes (flight.js) and the ground (drive.js).
import * as THREE from 'three';
import { SEE } from './see.js';

const fwd = (yaw) => [Math.cos(yaw), -Math.sin(yaw)]; // the camera's way of turning (as flight.js and drive.js)
// what can be taken over: its name, where it is (and how high to look), the camera behind it (distance, height), how it
// moves toward a point ahead, its buttons, and whether it is still there to drive
const KINDS = {
  band: { name: 'Band', at: (u) => [u.b.venue.x, u.b.venue.y + u.b.venue.H + 2, u.b.venue.z], ok: (u) => u.b.on }, // not driven: played (rhythm.js)
  saucer: {
    name: 'Saucer', at: (u) => [u.s.x, u.s.y, u.s.z], cam: [32, 14], ahead: 30,
    take: (u) => { u.s.player = true; }, free: (u) => { u.s.player = false; },
    move: (u, tx, tz) => { if (u.s.state === 'cruise') { u.s.tx = tx; u.s.tz = tz; } },
    acts: [['Beam up', (u) => act(u, 'abduct')], ['Zap', (u) => act(u, 'zap')], ['Drop aliens', (u) => act(u, 'drop')]], face: (u) => Math.atan2(-u.s.vz, u.s.vx || 0.001),
    ok: (u) => u.s.state === 'cruise' || u.s.state === 'act', lost: 'Your saucer was shot down!',
    status: (u) => 'hull ' + Math.max(0, Math.round(u.s.hp / 60 * 100)) + '% · ' + (u.s.state === 'act' ? u.s.act : 'flying'),
  },
  walker: {
    name: 'Walker', at: (u) => [u.t.x, u.t.y, u.t.z], cam: [55, 30], ahead: 30,
    take: (u) => { u.t.player = true; }, free: (u) => { u.t.player = false; u.t.steer(u.t.x, u.t.z); },
    move: (u, tx, tz) => u.t.steer(tx, tz), stay: (u) => u.t.steer(u.t.x, u.t.z),
    acts: [['Beam', (u, fx, fz) => u.t.beamAt(u.t.x + fx * 12, u.t.z + fz * 12)], ['Heat ray', (u, fx, fz) => { if (!u.t.ray) u.t.fireAt(u.t.x + fx * 70, u.t.z + fz * 70); }]],
    ok: (u) => !u.t.gone && (u.t.state === 'walk' || u.t.state === 'drop'), lost: 'Your walker came down!', face: (u) => -u.t.yaw,
    status: (u) => 'armour ' + Math.max(0, Math.round(u.t.hp / 140 * 100)) + '%',
  },
  worm: {
    name: 'Worm', at: (u) => [u.w.x, 0, u.w.z], cam: [45, 34], ahead: 35,
    take: (u) => { u.w.player = true; u.w.life = Infinity; }, free: (u) => { u.w.player = false; u.w.life = u.w.t + 40; },
    move: (u, tx, tz) => u.w.steer(tx, tz), stay: (u) => u.w.steer(u.w.x, u.w.z),
    acts: [['Breach!', (u) => u.w.breach()]],
    ok: (u) => u.w.alive, lost: 'The worm is gone', face: (u) => -u.w.yaw,
    status: (u) => u.w.surfaced ? 'breaching!' : 'underground',
  },
  kaiju: {
    name: 'Kaiju', at: (u) => [u.k.x, 30, u.k.z], cam: [80, 48], ahead: 35,
    take: (u) => { u.k.player = true; u.k.life = Infinity; }, free: (u) => { u.k.player = false; u.k.life = u.k.t + 90; },
    move: (u, tx, tz) => u.k.steer(tx, tz), stay: (u) => u.k.steer(u.k.x, u.k.z),
    acts: [['Throw car', (u) => kaijuCar(u)], ['Tentacle', (u, fx, fz) => u.k.tentGrab(u.k.x + fx * 45, u.k.z + fz * 45)], ['Fire', (u) => { if (!u.k.act) u.k.act = { kind: 'fire', t: 0, hi: 0, sweep: 1, both: Math.random() < 0.5 }; }]],
    ok: (u) => u.k.alive && u.k.state !== 'leave', lost: 'Your kaiju has been driven off!', face: (u) => -u.k.yaw,
    status: (u) => Math.max(0, Math.round(u.k.hp)) + ' hp',
  },
  tornado: {
    name: 'Tornado', at: (u) => [u.tw.x, 40, u.tw.z], cam: [150, 70], ahead: 45,
    take: (u) => { u.tw.player = true; }, free: (u) => { u.tw.player = false; u.tw.life = u.tw.t + 20; },
    move: (u, tx, tz) => u.tw.steer(tx, tz), stay: (u) => u.tw.steer(u.tw.x, u.tw.z),
    acts: [],
    ok: (u) => u.tw.phase === 'ground', lost: 'Your tornado has died out', face: (u) => Math.atan2(-u.tw.vz, u.tw.vx || 0.001),
    status: (u) => 'strength ' + u.tw.size.toFixed(1),
  },
};
// a saucer's own acts, started now over where it is: another button changes act, the same one again ends it (back to flying)
function act(u, what) {
  const s = u.s; if (s.state !== 'cruise' && s.state !== 'act') return;
  if (s.state === 'act' && s.act === 'abduct') { for (const j of s.lift) u.e.drop(j); s.lift.length = 0; s.beam.visible = false; } // whoever was in the beam falls
  if (s.state === 'act' && s.act === what) { s.state = 'cruise'; s.tx = s.x; s.tz = s.z; return; }
  s.state = 'act'; s.act = what; s.t = 0; s.n = 0; s.vx = s.vz = 0;
}
// the kaiju grabs the nearest car in reach and throws it
function kaijuCar(u) {
  const K = u.k; if (K.act) return;
  let car = null, bd = 45; K.D.ctx.traffic.near(K.x, K.z, 45, (c) => { if (!c.gone && c.mode === 0 && !c.mission) { const d = Math.hypot(c.x - K.x, c.z - K.z); if (d < bd) { bd = d; car = c; } } });
  if (car) K.act = { kind: 'car', car, t: 0, arm: 0 };
}

const CSS = `
#zd-take{position:fixed;left:0;top:0;right:0;bottom:0;touch-action:none}
#zd-take .stick{position:absolute;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:none;pointer-events:none}
#zd-take .knob{position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(255,255,255,.45)}
#zd-take .hud{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(20,14,30,.6);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:6px 11px;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;white-space:nowrap;pointer-events:none}
#zd-take .tip{position:absolute;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);color:#fff;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;text-shadow:0 1px 3px #000;pointer-events:none;transition:opacity .6s;width:80vw}
#zd-takebar{position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px;width:min(calc(100vw - 16px),460px);z-index:31}
#zd-takebar .zd-btn{flex:1 1 0;min-width:0;padding:12px 4px;font-size:11px;color:#fff;background:linear-gradient(#8a3bff,#5216c2);border-color:rgba(255,255,255,.3)}
#zd-takebar .zd-btn.act{background:linear-gradient(#ffb02e,#e05a10)}
#zd-takebar .zd-btn.exit{background:linear-gradient(#ff5a8a,#c2165a)}
.zd-pickmark{position:fixed;left:0;top:0;z-index:30;transform:translate(-50%,-130%);padding:6px 11px;border-radius:12px;border:2px solid #ffd27a;background:rgba(40,20,60,.85);color:#fff;font:700 12px system-ui,-apple-system,sans-serif;white-space:nowrap;cursor:pointer}
.zd-pickmark.sel{background:#ffb02e;color:#241032}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe,body.zd-flying #zd-top{display:none!important}
body.zd-picking #zd-bar,body.zd-picking #zd-dis{display:none!important}
`;

export class TakeOver {
  constructor(game, ctx) { // ctx: { camera, controls, post, renderer }
    this.g = game; this.ctx = ctx; this.active = false; this.picking = false; this.near = 1; this.focus = 60; this.lod = 3;
  }
  css() { if (!document.getElementById('zd-take-css')) { const s = document.createElement('style'); s.id = 'zd-take-css'; s.textContent = CSS; document.head.appendChild(s); } }
  // what can be taken over right now
  candidates() {
    const out = [];
    for (const e of this.g.disasters.list) {
      if (!e.alive) continue;
      if (e.type === 'aliens') { for (const s of e.saucers) if (s.state === 'cruise' || s.state === 'act') out.push({ kind: 'saucer', e, s }); for (const t of e.tripods) if (!t.gone && t.state === 'walk') out.push({ kind: 'walker', e, t }); }
      if (e.type === 'worm') out.push({ kind: 'worm', w: e });
      if (e.type === 'kaiju' && e.state !== 'leave') out.push({ kind: 'kaiju', k: e });
      if (e.type === 'tornado' && e.tw && e.tw.phase === 'ground') out.push({ kind: 'tornado', tw: e.tw });
    }
    const b = this.g.band; if (b && b.venue && b.on && this.g.bandGame) out.push({ kind: 'band', b }); // the band too: Control plays them (rhythm.js)
    return out;
  }
  // the pick: a label over each one; tap one, then Take over
  pick() {
    this.css(); const g = this.g, list = this.candidates();
    if (!list.length) { g.toast('Start a disaster first: an alien invasion (saucers and walkers), the giant worm, the kaiju or a tornado. Then take it over', 5000); return; }
    this.picking = true; this.sel = null; document.body.classList.add('zd-picking');
    this.marks = list.map((u) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'zd-pickmark'; b.textContent = KINDS[u.kind].name; b.onclick = (e) => { e.stopPropagation(); this.select(u, b); }; document.body.appendChild(b); return { u, b }; });
    const bar = this.pbar = document.createElement('div'); bar.id = 'zd-takebar';
    bar.innerHTML = '<button type="button" class="zd-btn act" data-t="go">Take over</button><button type="button" class="zd-btn exit" data-t="no">Cancel</button>';
    document.body.appendChild(bar); this.goBtn = bar.querySelector('[data-t="go"]'); this.goBtn.style.opacity = '0.45';
    this.goBtn.onclick = () => { if (this.sel) { const u = this.sel; this.endPick(); if (u.kind === 'band') g.bandGame.start(); else this.start(u); } else g.toast('Tap one of the labels first'); };
    bar.querySelector('[data-t="no"]').onclick = () => this.endPick();
    g.toast('Tap the one you want, then Take over', 3500);
    const loop = () => { if (!this.picking) return; this.placeMarks(); requestAnimationFrame(loop); }; loop();
  }
  select(u, b) { this.sel = u; for (const m of this.marks) m.b.classList.toggle('sel', m.b === b); this.goBtn.textContent = u.kind === 'band' ? 'Control the band' : 'Take over the ' + KINDS[u.kind].name.toLowerCase(); this.goBtn.style.opacity = '1'; }
  placeMarks() {
    const cam = this.ctx.camera, v = new THREE.Vector3();
    for (const m of this.marks) {
      const K = KINDS[m.u.kind]; if (!K.ok(m.u)) { m.b.style.display = 'none'; continue; }
      const [x, y, z] = K.at(m.u); v.set(x, y + 8, z).project(cam);
      if (v.z > 1) { m.b.style.display = 'none'; continue; }
      m.b.style.display = ''; m.b.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; m.b.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
    }
  }
  endPick() { this.picking = false; document.body.classList.remove('zd-picking'); for (const m of this.marks || []) m.b.remove(); this.marks = []; if (this.pbar) this.pbar.remove(); this.pbar = null; }

  // yours: the camera behind it, the thumbs and its buttons
  start(u) {
    const g = this.g, { camera, controls, post } = this.ctx, K = KINDS[u.kind];
    this.u = u; this.K = K; K.take(u);
    this.saved = { fov: camera.fov, far: camera.far, dof: post.opts.dof, see: SEE.on };
    camera.fov = 60; camera.far = 4000; camera.updateProjectionMatrix(); post.opts.dof = false; controls.enabled = false; g.setFollow(-1);
    const [x, , z] = K.at(u); this.camYaw = K.face ? K.face(u) : Math.atan2(-(z - camera.position.z), x - camera.position.x); this.zoom = 1; this.ix = this.iy = 0; this.snap = true; this.pos = new THREE.Vector3(x, 0, z); // the camera behind it, the way it faces
    this.ui(); this.active = true; document.body.classList.add('zd-flying');
    this.tip('You are the ' + K.name.toLowerCase() + '. Press anywhere to move; a second finger turns the view and zooms');
  }
  ui() {
    this.css(); // (also when started straight away, without the pick)
    const R = this.ctx.renderer.domElement, ov = this.ov = document.createElement('div'); ov.id = 'zd-take';
    ov.innerHTML = '<div class="stick"><div class="knob"></div></div><div class="hud"></div><div class="tip"></div>';
    R.parentNode.insertBefore(ov, R.nextSibling);
    this.hud = ov.querySelector('.hud'); this.stickEl = ov.querySelector('.stick'); this.knob = ov.querySelector('.knob'); this.tipEl = ov.querySelector('.tip');
    const bar = this.bar = document.createElement('div'); bar.id = 'zd-takebar';
    bar.innerHTML = this.K.acts.map(([n], i) => '<button type="button" class="zd-btn act" data-a="' + i + '">' + n + '</button>').join('') + '<button type="button" class="zd-btn exit" data-t="stop">Stop</button>';
    document.body.appendChild(bar);
    bar.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { const [fx, fz] = fwd(this.camYaw); this.K.acts[+b.dataset.a][1](this.u, fx, fz); }; });
    bar.querySelector('[data-t="stop"]').onclick = () => this.stop();
    const touches = new Map(); // a stick wherever the first finger comes down (Sean); a second finger turns the view (sideways) and zooms (up and down)
    ov.addEventListener('pointerdown', (e) => {
      const left = ![...touches.values()].some(t => t.left); touches.set(e.pointerId, { left, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY });
      if (left) { this.stickEl.style.display = 'block'; this.stickEl.style.left = e.clientX + 'px'; this.stickEl.style.top = e.clientY + 'px'; this.knob.style.transform = ''; }
      try { ov.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } e.preventDefault();
    });
    ov.addEventListener('pointermove', (e) => {
      const t = touches.get(e.pointerId); if (!t) return;
      if (t.left) { const dx = Math.max(-1, Math.min(1, (e.clientX - t.x) / 60)), dy = Math.max(-1, Math.min(1, (e.clientY - t.y) / 60)); this.ix = dx; this.iy = -dy; this.knob.style.transform = 'translate(' + dx * 27 + 'px,' + dy * 27 + 'px)'; }
      else { this.camYaw -= (e.clientX - t.lx) * 0.006; this.zoom = Math.max(0.4, Math.min(3, this.zoom * Math.exp((e.clientY - t.ly) * 0.004))); t.lx = e.clientX; t.ly = e.clientY; }
    });
    const up = (e) => { const t = touches.get(e.pointerId); if (!t) return; touches.delete(e.pointerId); if (t.left) { this.ix = this.iy = 0; this.stickEl.style.display = 'none'; } };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    ov.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.4, Math.min(3, this.zoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
    this.keys = new Set();
    this.onKey = (e) => {
      const down = e.type === 'keydown', k = e.key.toLowerCase();
      if (down && !e.repeat) { if (k === 'escape') { this.stop(); return; } const n = '123'.indexOf(k); if (n >= 0 && this.K.acts[n]) { const [fx, fz] = fwd(this.camYaw); this.K.acts[n][1](this.u, fx, fz); } }
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
  }
  tip(text) { if (!this.tipEl) return; this.tipEl.textContent = text; this.tipEl.style.opacity = '1'; clearTimeout(this.tipT); this.tipT = setTimeout(() => { if (this.tipEl) this.tipEl.style.opacity = '0'; }, 4500); }
  stop(why) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx;
    this.active = false; document.body.classList.remove('zd-flying'); this.K.free(this.u);
    this.ov.remove(); this.bar.remove(); removeEventListener('keydown', this.onKey); removeEventListener('keyup', this.onKey); clearTimeout(this.tipT); this.tipEl = null;
    camera.fov = this.saved.fov; camera.far = this.saved.far; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); post.opts.dof = this.saved.dof; SEE.on = this.saved.see;
    const B = g.city.bounds, x = Math.max(B.x0, Math.min(B.x1, this.pos.x)), z = Math.max(B.z0, Math.min(B.z1, this.pos.z));
    controls.target.set(x, 0, z); camera.position.set(x + 60, 240, z + 180); camera.lookAt(controls.target); controls.enabled = true; controls.update();
    g.focusAt = null; g.toast(why || 'It is on its own again', 3000);
  }
  // a frame: the thumbs move it, the camera follows behind, the readout
  frame(dt, tg) {
    const g = this.g, cam = this.ctx.camera, K = this.K, u = this.u, keys = this.keys;
    if (!K.ok(u)) { this.stop(K.lost); return; }
    let ix = this.ix, iy = this.iy;
    if (keys.has('arrowleft') || keys.has('a')) ix = -1; if (keys.has('arrowright') || keys.has('d')) ix = 1;
    if (keys.has('arrowup') || keys.has('w')) iy = 1; if (keys.has('arrowdown') || keys.has('s')) iy = -1;
    if (keys.has('q')) this.camYaw += dt * 1.6; if (keys.has('e')) this.camYaw -= dt * 1.6;
    const [x, y, z] = K.at(u), [fx, fz] = fwd(this.camYaw), sx = -fz, sz = fx, m = Math.min(1, Math.hypot(ix, iy));
    this.pos.set(x, 0, z);
    if (m > 0.1) { // toward a point ahead, across the screen; the view swings round behind slowly as it goes
      const wx = fx * iy + sx * ix, wz = fz * iy + sz * ix, wl = Math.hypot(wx, wz) || 1;
      K.move(u, x + wx / wl * K.ahead * m, z + wz / wl * K.ahead * m);
      if (iy > 0.3) { const want = Math.atan2(-wz, wx); let d = want - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.camYaw += d * Math.min(1, dt * 0.8); }
    } else if (K.stay) K.stay(u);
    else K.move(u, x, z);
    const back = K.cam[0] * this.zoom, hi = K.cam[1] * Math.pow(this.zoom, 0.8), look = u.kind === 'worm' ? 0 : y;
    const v = new THREE.Vector3(x - fx * back, Math.max(look, 0) + hi, z - fz * back);
    if (this.snap) cam.position.copy(v); else cam.position.lerp(v, 1 - Math.exp(-dt * 5));
    cam.up.set(0, 1, 0); cam.lookAt(x + fx * K.ahead * 0.5, look + (u.kind === 'worm' ? 2 : 0), z + fz * K.ahead * 0.5);
    this.snap = false; this.focus = cam.position.distanceTo(_t.set(x, look, z)); this.near = Math.max(1, this.focus * 0.02);
    tg.set(x, 0, z); g.focusAt = _t.clone();
    if ((this.hudT = (this.hudT || 0) - dt) <= 0) { this.hudT = 0.25; this.hud.textContent = K.name.toUpperCase() + ' · ' + K.status(u); }
  }
}
const _t = new THREE.Vector3();
