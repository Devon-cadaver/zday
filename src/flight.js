// Flying a plane round the town (Sandbox; Sean): a stunt plane or a fighter jet, seen from behind (chase) or from the
// cockpit. Arcade handling for a phone: drag anywhere and the plane follows the finger like a stick (left and right bank
// it into a turn; down climbs and up dives, as a pilot pulls back and pushes forward, or the other way with Invert); let
// go and it levels out. Faster and Slower set the throttle. The payload button goes round what it carries (storm seeding
// on the stunt plane, a small bomb, a big bomb, napalm, a nuke) and Drop lets one go. Keys work too (arrows or WASD to
// steer, Shift faster, Ctrl slower, Q the payload, Space to drop, I to invert, V the view, Esc to land). Fly into a building or the ground
// and it goes up in flames there; a moment later you are back in the air at the edge of town. The disasters carry on
// round you. main.js hands the camera over while it is up (frame()), and game.js's Sandbox has the buttons.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { SEE } from './see.js';

// speeds in metres a second; turn: how hard it turns at full bank; chase: the camera's distance behind and height above;
// seat: the cockpit's place (forward, up) in the model
const PLANES = {
  stunt: { name: 'Stunt plane', min: 22, max: 72, start: 42, turn: 1.15, climb: 1.0, chase: [17, 5], seat: [0.6, 1.25] },
  jet: { name: 'Fighter jet', min: 45, max: 150, start: 85, turn: 0.95, climb: 0.85, chase: [28, 7.5], seat: [2.4, 1.85] },
};
const CEIL = 650, KMH = 3.6, FOV_CHASE = 62, FOV_COCKPIT = 72, INVERT = 'zday_fly_invert';
// what each plane carries, in the order the payload button goes round; wait: seconds before the next; R: the blast's reach; s: the bomb's size
const LOADS = { stunt: ['seed', 'small', 'big', 'napalm', 'nuke'], jet: ['small', 'big', 'napalm', 'nuke'] };
const LOAD = { seed: { name: 'Storm seeding', wait: 8 }, small: { name: 'Small bomb', wait: 0.35, R: 12, s: 0.7 }, big: { name: 'Big bomb', wait: 1.2, R: 26, s: 1.3 }, napalm: { name: 'Napalm', wait: 2.5, s: 1.1 }, nuke: { name: 'Nuke', wait: 10, R: 200, s: 2.4 } };
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX');
const SEAT_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // a camera looks down -z; the planes point along +x

// a little red and white stunt plane, nose along +x, about 7 m long, its propeller turning (userData.prop)
function stuntModel() {
  const g = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: '#d8282e', roughness: 0.45, metalness: 0.1 }), white = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.6 }), glass = new THREE.MeshStandardMaterial({ color: '#2b4a66', roughness: 0.1, metalness: 0.5 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.62, 0.22, 6, 12).rotateZ(-Math.PI / 2), red, -0.6, 1.3, 0); // the body, narrowing to the tail
  add(new THREE.CylinderGeometry(0.66, 0.62, 0.9, 12).rotateZ(-Math.PI / 2), white, 2.8, 1.3, 0); // the cowling
  add(new THREE.ConeGeometry(0.26, 0.5, 10).rotateZ(-Math.PI / 2), white, 3.45, 1.3, 0); // the spinner
  add(new THREE.BoxGeometry(1.6, 0.14, 8.6), white, 0.9, 1.0, 0); // the wing
  add(new THREE.BoxGeometry(1.62, 0.16, 1.2), red, 0.9, 1.0, 3.75); add(new THREE.BoxGeometry(1.62, 0.16, 1.2), red, 0.9, 1.0, -3.75); // red tips
  add(new THREE.BoxGeometry(1.0, 0.1, 3.0), white, -3.2, 1.45, 0); // the tailplane
  add(new THREE.BoxGeometry(1.1, 1.3, 0.12), red, -3.3, 2.05, 0); // the fin
  add(new THREE.SphereGeometry(0.55, 12, 8).scale(1.5, 0.75, 0.85), glass, 0.5, 1.85, 0); // the canopy
  add(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10).rotateX(Math.PI / 2), dark, 1.6, 0.3, 0.9); add(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10).rotateX(Math.PI / 2), dark, 1.6, 0.3, -0.9); // wheels
  add(new THREE.BoxGeometry(0.12, 0.8, 0.12), dark, 1.6, 0.65, 0.9); add(new THREE.BoxGeometry(0.12, 0.8, 0.12), dark, 1.6, 0.65, -0.9);
  const prop = new THREE.Group(); prop.position.set(3.55, 1.3, 0); g.add(prop);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.7, 0.22), dark); prop.add(blade);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#cfd4da', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); prop.add(blur); // the blur of it spinning
  g.userData.prop = prop;
  return g;
}
// the fighter: the F-16 of the airstrikes with an afterburner glow at its tail (userData.burner), its throttle
function jetModel() {
  const g = new THREE.Group(), m = buildVehicle('f16'); m.scale.setScalar(1.6); g.add(m);
  const burner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.4, 12).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.8, depthWrite: false }));
  burner.position.set(-7.2, 2.08, 0); g.add(burner); g.userData.burner = burner;
  return g;
}

const CSS = `
#zd-fly{position:fixed;left:0;top:0;right:0;bottom:0;touch-action:none}
#zd-fly .stick{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:none;pointer-events:none}
#zd-fly .knob{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,255,255,.45)}
#zd-fly .hud{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(20,14,30,.6);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:6px 11px;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums}
#zd-fly .hz,#zd-fly .ret{position:absolute;left:50%;top:50%;pointer-events:none;display:none}
#zd-fly .hz{width:56vw;height:0;border-top:2px solid rgba(160,255,190,.55)}
#zd-fly .ret{width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid rgba(160,255,190,.8);border-radius:50%}
#zd-fly.cockpit .hz,#zd-fly.cockpit .ret{display:block}
#zd-fly .tip{position:absolute;left:50%;bottom:calc(130px + env(safe-area-inset-bottom));transform:translateX(-50%);color:#fff;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;text-shadow:0 1px 3px #000;pointer-events:none;transition:opacity .6s;width:80vw}
#zd-flybar{position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;width:min(calc(100vw - 16px),460px);z-index:31}
#zd-flybar .row{display:flex;gap:6px}
#zd-flybar .zd-btn{flex:1 1 0;min-width:0;padding:12px 4px;font-size:11px;color:#fff;background:linear-gradient(#8a3bff,#5216c2);border-color:rgba(255,255,255,.3)}
#zd-flybar .zd-btn.exit{background:linear-gradient(#ff5a8a,#c2165a)}
#zd-flybar .zd-btn.load{flex:2 1 0;background:linear-gradient(#3a2a6a,#241848)}
#zd-flybar .zd-btn.drop{background:linear-gradient(#ffb02e,#e05a10);font-size:13px;letter-spacing:.1em}
#zd-flybar .zd-btn.drop.wait{opacity:.45}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe{display:none!important}
`;

export class Flight {
  constructor(game, ctx) { // ctx: { camera, controls, post, renderer }
    this.g = game; this.ctx = ctx; this.active = false; this.view = 'chase'; this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion();
    this.near = 1; this.focus = 30; this.at = new THREE.Vector3();
  }
  // up: the plane at the edge of town, heading in; the camera taken over
  start(kind = 'stunt') {
    if (this.active) this.stop(true);
    const g = this.g, { camera, controls, post } = this.ctx;
    this.kind = PLANES[kind] ? kind : 'stunt'; this.P = PLANES[this.kind];
    this.saved = { far: camera.far, fov: camera.fov, dof: post.opts.dof, see: SEE.on, pos: camera.position.clone(), tg: controls.target.clone() };
    this.obj = this.kind === 'jet' ? jetModel() : stuntModel(); this.obj.rotation.order = 'YZX'; g.disasters.ctx.scene.add(this.obj);
    camera.far = 4000; // past the fog anyway; a nearer far plane keeps the depth sharp with the near one so close
    this.loads = LOADS[this.kind]; this.load = 0; this.bombs = []; this.coolT = 0; this.seedT = 0;
    try { this.invert = localStorage.getItem(INVERT) === '1'; } catch (e) { this.invert = false; }
    this.ui(); this.active = true; controls.enabled = false; post.opts.dof = false; g.setFollow(-1);
    document.body.classList.add('zd-flying');
    this.spawn(); this.setView(this.view);
    this.tip('Drag anywhere to steer: left and right to turn, ' + (this.invert ? 'up to climb, down to dive' : 'down to climb, up to dive') + '. Let go and it levels out. Pick a payload, then Drop');
  }
  spawn() {
    const B = this.g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, a = Math.random() * Math.PI * 2, R = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.5 + 60;
    this.pos.set(cx + Math.cos(a) * R, 95, cz + Math.sin(a) * R);
    this.yaw = Math.atan2(-(cz - this.pos.z), cx - this.pos.x); this.pitch = 0; this.roll = 0;
    this.speed = this.thr = this.P.start; this.ix = this.iy = 0; this.state = 'fly'; this.t = 0; this.obj.visible = this.view === 'chase'; this.snap = true;
  }
  ui() {
    if (!document.getElementById('zd-fly-css')) { const s = document.createElement('style'); s.id = 'zd-fly-css'; s.textContent = CSS; document.head.appendChild(s); }
    const R = this.ctx.renderer.domElement, ov = this.ov = document.createElement('div'); ov.id = 'zd-fly';
    ov.innerHTML = '<div class="hz"></div><div class="ret"></div><div class="stick"><div class="knob"></div></div><div class="hud"></div><div class="tip"></div>';
    R.parentNode.insertBefore(ov, R.nextSibling); // over the town, under the numbers and buttons
    this.hud = ov.querySelector('.hud'); this.hz = ov.querySelector('.hz'); this.stick = ov.querySelector('.stick'); this.knob = ov.querySelector('.knob'); this.tipEl = ov.querySelector('.tip');
    const bar = this.bar = document.createElement('div'); bar.id = 'zd-flybar';
    bar.innerHTML = '<div class="row"><button type="button" class="zd-btn load" data-f="load"></button><button type="button" class="zd-btn drop" data-f="drop">Drop</button></div>' +
      '<div class="row"><button type="button" class="zd-btn" data-f="view"></button><button type="button" class="zd-btn" data-f="slow">Slower</button><button type="button" class="zd-btn" data-f="fast">Faster</button><button type="button" class="zd-btn" data-f="inv"></button><button type="button" class="zd-btn exit" data-f="exit">Land</button></div>';
    document.body.appendChild(bar); this.viewBtn = bar.querySelector('[data-f="view"]'); this.loadBtn = bar.querySelector('[data-f="load"]'); this.dropBtn = bar.querySelector('[data-f="drop"]'); this.invBtn = bar.querySelector('[data-f="inv"]');
    this.loadBtn.onclick = () => this.cycle(); this.dropBtn.onclick = () => this.drop(); this.invBtn.onclick = () => this.setInvert(!this.invert);
    this.cycle(0); this.setInvert(this.invert, true);
    bar.querySelector('[data-f="view"]').onclick = () => this.setView(this.view === 'chase' ? 'cockpit' : 'chase');
    bar.querySelector('[data-f="slow"]').onclick = () => this.throttle(-1);
    bar.querySelector('[data-f="fast"]').onclick = () => this.throttle(1);
    bar.querySelector('[data-f="exit"]').onclick = () => this.stop();
    // the finger as a stick: how far it has gone from where it came down
    let id = null, ox = 0, oy = 0;
    ov.addEventListener('pointerdown', (e) => { if (id !== null) return; id = e.pointerId; ox = e.clientX; oy = e.clientY; this.stick.style.display = 'block'; this.stick.style.left = ox + 'px'; this.stick.style.top = oy + 'px'; this.knob.style.transform = ''; try { ov.setPointerCapture(id); } catch (er) { /* fine */ } e.preventDefault(); });
    ov.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = Math.max(-1, Math.min(1, (e.clientX - ox) / 70)), dy = Math.max(-1, Math.min(1, (e.clientY - oy) / 70));
      this.ix = dx; this.iy = this.invert ? -dy : dy; this.knob.style.transform = 'translate(' + dx * 30 + 'px,' + dy * 30 + 'px)';
    });
    const up = (e) => { if (e.pointerId !== id) return; id = null; this.ix = this.iy = 0; this.stick.style.display = 'none'; };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    this.keys = new Set();
    this.onKey = (e) => {
      const down = e.type === 'keydown', k = e.key.toLowerCase();
      if (down && (k === 'v')) this.setView(this.view === 'chase' ? 'cockpit' : 'chase');
      if (down && k === 'escape') { this.stop(); return; }
      if (down && (k === 'shift' || k === '+' || k === '=')) this.throttle(1);
      if (down && (k === 'control' || k === '-')) this.throttle(-1);
      if (down && !e.repeat && k === ' ') this.drop();
      if (down && !e.repeat && k === 'q') this.cycle();
      if (down && !e.repeat && k === 'i') this.setInvert(!this.invert);
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
  }
  tip(text) { if (!this.tipEl) return; this.tipEl.textContent = text; this.tipEl.style.opacity = '1'; clearTimeout(this.tipT); this.tipT = setTimeout(() => { if (this.tipEl) this.tipEl.style.opacity = '0'; }, 5000); }
  // the payload button: on round what this plane carries (d 0: just show it)
  cycle(d = 1) { this.load = (this.load + d) % this.loads.length; this.loadBtn.textContent = LOAD[this.loads[this.load]].name + ' \u25B8'; this.coolT = Math.min(this.coolT, 0.3); }
  // up and down: down climbs and up dives (a pilot's stick), or the other way round; remembered
  setInvert(on, quiet = false) {
    this.invert = on; this.invBtn.textContent = on ? 'Inverted' : 'Invert';
    try { localStorage.setItem(INVERT, on ? '1' : '0'); } catch (e) { /* not kept */ }
    if (!quiet) this.tip(on ? 'Inverted: drag up to climb, down to dive' : 'Drag down to climb, up to dive, like a pilot\'s stick');
  }
  // Drop: storm seeding is a run of flares behind it (seeded() at the end); the rest a bomb falling from under it (bombStep, boom)
  drop() {
    if (this.state !== 'fly' || this.coolT > 0 || this.seedT > 0) return;
    const id = this.loads[this.load], L = LOAD[id]; this.coolT = L.wait;
    if (id === 'seed') { this.seedT = 5; this.trailT = 0; this.tip('Seeding the clouds...'); return; }
    const H = this.g.helis, m = new THREE.Mesh(H.bombGeo, H.bombMat); m.scale.setScalar(L.s); m.castShadow = true; this.g.disasters.ctx.scene.add(m);
    _f.set(1, 0, 0).applyQuaternion(this.q);
    this.bombs.push({ m, id, x: this.pos.x, y: this.pos.y - 1.5, z: this.pos.z, vx: _f.x * this.speed, vy: _f.y * this.speed - 2, vz: _f.z * this.speed });
    sfx('thud', this.pos.x, this.pos.y, this.pos.z, { gain: 0.3, rate: 1.6 });
  }
  bombStep(h) {
    const city = this.g.city;
    for (const b of this.bombs) {
      b.vy -= 9.8 * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      b.m.position.set(b.x, b.y, b.z); b.m.rotation.set(0, Math.atan2(-b.vz, b.vx), Math.atan2(b.vy, Math.hypot(b.vx, b.vz)));
      let top = 0.5; city.buildingsNear(b.x, b.z, 0.5, (k, d, bb) => { if (bb.roofY > top) top = bb.roofY; }); // the ground, or a roof
      if (b.y <= top) { b.done = true; this.boom(b); }
    }
    if (this.bombs.some(b => b.done)) this.bombs = this.bombs.filter(b => { if (b.done) this.g.disasters.ctx.scene.remove(b.m); return !b.done; });
  }
  // a bomb lands: the airstrike's blast (the big one brings small buildings down), the napalm run's fire along its line, or
  // the full nuke (too close and it takes the plane too)
  boom(b) {
    const g = this.g, D = g.disasters, F = g.fire, L = LOAD[b.id], x = b.x, z = b.z;
    if (b.id === 'nuke') {
      const H = g.helis;
      if (H.nukeBlast) { H.nukeBlast(x, z, L.R); H.events.push({ type: 'nuke', x, z }); } else { F.nuke(x, z, L.R); g.people.nuke(x, z, L.R); }
      g.flash = 1.6; g.shake = 2.5;
      if (this.state === 'fly' && Math.hypot(this.pos.x - x, this.pos.z - z) < L.R * 0.6 && this.pos.y < 300) this.crash(-1);
    } else if (b.id === 'napalm') {
      const d = Math.hypot(b.vx, b.vz) || 1, hx = b.vx / d, hz = b.vz / d;
      for (let k = 0; k < 6; k++) {
        const bx = x + hx * k * 8, bz = z + hz * k * 8;
        F.burst(bx, 1.5, bz, 16, 3.0); g.city.buildingsNear(bx, bz, 7, (kb) => { if (Math.random() < 0.3) F.igniteBuilding(kb); });
        g.people.scare(bx, bz, 35, 0.9); D.burnPlants(bx, bz, 11, 2);
      }
      sfx('whoomph', x, 3, z, { gain: 0.9 });
    } else {
      F.blast(x, z, L.R); g.people.blast(x, z, L.R);
      if (b.id === 'big') g.city.buildingsNear(x, z, L.R * 0.45, (k, d, bb) => { if (!bb.landmark && bb.roofY < 30) D.destroyBuilding(k, 'collapse'); });
      g.shake = Math.max(g.shake || 0, b.id === 'big' ? 0.8 : 0.35);
    }
  }
  // the seeding run over: the weather a step wilder (clear to rain to a thunderstorm); seeded in a thunderstorm over the
  // town, a tornado comes down under it
  seeded() {
    const D = this.g.disasters, w = D.weather.type, x = this.pos.x, z = this.pos.z, B = this.g.city.bounds;
    if (w === 'storm') {
      if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) { D.start('tornado', x, z); this.tip('The storm you seeded spins up a tornado!'); } else this.tip('Seed over the town to spin the storm up into a tornado');
    } else { const to = w === 'rain' ? 'storm' : 'rain'; D.weather.set(to); this.tip(to === 'storm' ? 'The clouds boil up into a thunderstorm' : 'The seeded clouds start to rain'); }
  }
  throttle(d) { const P = this.P; this.thr = Math.max(P.min, Math.min(P.max, this.thr + d * (P.max - P.min) / 5)); }
  setView(v) {
    this.view = v; const cam = this.ctx.camera;
    cam.fov = v === 'cockpit' ? FOV_COCKPIT : FOV_CHASE; cam.updateProjectionMatrix();
    this.near = v === 'cockpit' ? 0.5 : 1.5; this.obj.visible = v === 'chase' && this.state === 'fly'; this.snap = true;
    SEE.on = v === 'cockpit' ? false : this.saved.see; // walls see-through only between the chase camera and the plane
    this.ov.classList.toggle('cockpit', v === 'cockpit'); this.viewBtn.textContent = v === 'cockpit' ? 'Chase view' : 'Cockpit';
  }
  // down: back to the town as it was, the view over where the plane last was
  stop(quiet = false) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx;
    this.active = false; document.body.classList.remove('zd-flying');
    g.disasters.ctx.scene.remove(this.obj); this.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); // its own shapes and paint
    for (const b of this.bombs) g.disasters.ctx.scene.remove(b.m); this.bombs = [];
    this.ov.remove(); this.bar.remove(); removeEventListener('keydown', this.onKey); removeEventListener('keyup', this.onKey); clearTimeout(this.tipT); this.tipEl = null;
    if (g.audio) g.audio.engine(null);
    camera.fov = this.saved.fov; camera.far = this.saved.far; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); post.opts.dof = this.saved.dof; SEE.on = this.saved.see;
    const B = g.city.bounds, x = Math.max(B.x0, Math.min(B.x1, this.pos.x)), z = Math.max(B.z0, Math.min(B.z1, this.pos.z));
    controls.target.set(x, 0, z); camera.position.set(x + 60, 260, z + 200); camera.lookAt(controls.target); controls.enabled = true; controls.update();
    g.focusAt = null;
    if (!quiet) g.toast('Landed. Open Disasters to fly again', 2500);
  }

  // a frame (real time, held while paused): fly, hit, place the camera; the view's centre (tg) under the plane
  frame(dt, tg) {
    const g = this.g, P = this.P, cam = this.ctx.camera;
    const run = !g.paused && dt > 0;
    if (run) {
      this.coolT = Math.max(0, this.coolT - dt); if (this.bombs.length) this.bombStep(dt);
      if (this.seedT > 0) { // a long white trail of seeding flares behind it
        this.seedT -= dt; _f.set(1, 0, 0).applyQuaternion(this.q);
        if ((this.trailT -= dt) <= 0) { this.trailT = 0.12; g.fire.spray(this.pos.x - _f.x * 6, this.pos.z - _f.z * 6, this.pos.y - 1, 5, 3, 3.2); }
        if (this.seedT <= 0) this.seeded();
      }
    }
    if (run && this.state === 'fly') this.fly(dt);
    else if (run && this.state === 'down' && (this.t += dt) > 2.6) { this.spawn(); this.setView(this.view); }
    // the plane where it is
    _e.set(this.roll, this.yaw, this.pitch); this.q.setFromEuler(_e);
    this.obj.position.copy(this.pos); this.obj.quaternion.copy(this.q);
    const prop = this.obj.userData.prop, burner = this.obj.userData.burner, k = (this.thr - P.min) / (P.max - P.min);
    if (prop) prop.rotation.x += dt * (40 + 50 * k);
    if (burner) { burner.scale.set(0.6 + k * 0.9, 1, 1); burner.material.opacity = 0.35 + 0.55 * k; }
    // the camera: behind and above it, easing after it (no roll, so the horizon stays put), or in its seat
    _f.set(1, 0, 0).applyQuaternion(this.q);
    if (this.view === 'cockpit' && this.state === 'fly') {
      _v.set(P.seat[0], P.seat[1], 0).applyQuaternion(this.q); cam.position.copy(this.pos).add(_v);
      cam.quaternion.copy(this.q).multiply(SEAT_TURN); cam.up.set(0, 1, 0).applyQuaternion(this.q);
    } else {
      const fl = Math.hypot(_f.x, _f.z) || 1, back = P.chase[0], hi = P.chase[1];
      _v.set(this.pos.x - _f.x / fl * back, this.pos.y + hi - _f.y * back * 0.5, this.pos.z - _f.z / fl * back);
      if (this.state === 'down') _v.copy(this.at).add(_u.set(-30, 22, -30)); // watching the wreck burn
      if (this.snap) cam.position.copy(_v); else cam.position.lerp(_v, 1 - Math.exp(-dt * 6));
      cam.up.set(0, 1, 0);
      cam.lookAt(this.state === 'down' ? this.at : _u.copy(this.pos).addScaledVector(_f, 12));
    }
    this.snap = false;
    this.focus = cam.position.distanceTo(this.pos);
    tg.set(this.pos.x, 0, this.pos.z); g.focusAt = this.state === 'fly' ? this.pos : this.at;
    // what the pilot reads
    if ((this.hudT = (this.hudT || 0) - dt) <= 0) {
      this.hudT = 0.15;
      this.hud.textContent = P.name.toUpperCase() + ' · ' + Math.round(this.speed * KMH) + ' km/h · ' + Math.max(0, Math.round(this.pos.y)) + ' m';
      if (g.audio) g.audio.engine(this.state === 'fly' ? this.kind : null, k);
      this.dropBtn.textContent = this.seedT > 0 ? 'Seeding' : 'Drop'; this.dropBtn.classList.toggle('wait', this.coolT > 0 || this.seedT > 0 || this.state !== 'fly');
    }
    if (this.view === 'cockpit') this.hz.style.transform = 'translate(-50%,' + (this.pitch * 260).toFixed(0) + 'px) rotate(' + (-this.roll).toFixed(3) + 'rad)';
  }
  fly(dt) {
    const g = this.g, P = this.P, K = this.keys;
    let ix = this.ix, iy = this.iy;
    if (K.has('arrowleft') || K.has('a')) ix = -1; if (K.has('arrowright') || K.has('d')) ix = 1;
    const up = K.has('arrowup') || K.has('w'), dn = K.has('arrowdown') || K.has('s');
    if (up || dn) iy = (up ? -1 : 1) * (this.invert ? -1 : 1); // up pushes the nose down, like a pilot's stick (Invert: the other way)
    // bank toward the stick (level when let go); a banked plane turns; the stick's up and down climb and dive, and with
    // nothing on it the nose comes back to level
    const rollTo = ix * 1.05; this.roll += (rollTo - this.roll) * Math.min(1, dt * 2.6);
    this.yaw -= P.turn * Math.sin(this.roll) * dt;
    if (Math.abs(iy) > 0.05) this.pitch += iy * P.climb * dt; else this.pitch -= this.pitch * Math.min(1, dt * 0.9);
    if (this.pos.y > CEIL && this.pitch > 0) this.pitch -= dt * 1.2; // the ceiling
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    // far out of town: it swings back round toward it
    const B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, far = Math.hypot(this.pos.x - cx, this.pos.z - cz) - Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.5;
    if (far > 450) {
      const want = Math.atan2(-(cz - this.pos.z), cx - this.pos.x); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 0.8);
      if (!this.saidFar) { this.saidFar = true; this.tip('Turning back toward town'); }
    } else if (far < 300) this.saidFar = false;
    // speed: toward the throttle, faster in a dive, slower climbing
    this.speed += (this.thr - this.speed) * Math.min(1, dt * 0.8) - Math.sin(this.pitch) * 9.8 * 0.6 * dt;
    this.speed = Math.max(P.min * 0.7, Math.min(P.max * 1.25, this.speed));
    _e.set(this.roll, this.yaw, this.pitch); _q.setFromEuler(_e); _f.set(1, 0, 0).applyQuaternion(_q);
    this.pos.addScaledVector(_f, this.speed * dt);
    // low over the streets, people duck
    if (this.pos.y < 35 && (this.scareT = (this.scareT || 0) - dt) <= 0) { this.scareT = 0.5; g.people.scare(this.pos.x, this.pos.z, 30, 0.4); }
    // into the ground, or a building
    const x = this.pos.x, y = this.pos.y, z = this.pos.z;
    if (y < 1.2) { this.crash(-1); return; }
    let hit = -1; g.city.buildingsNear(x, z, 2.5, (k, d, b) => { if (hit < 0 && y < b.roofY + 0.4) hit = k; });
    if (hit >= 0) this.crash(hit);
  }
  crash(k) {
    const g = this.g, f = g.fire, x = this.pos.x, y = Math.max(1, this.pos.y), z = this.pos.z;
    this.state = 'down'; this.t = 0; this.obj.visible = false; this.at.set(x, y, z);
    f.burst(x, y, z, 16, 2.4); f.burst(x, y + 2, z, 10, 1.6);
    if (k >= 0) f.igniteBuilding(k);
    sfx('boom', x, y, z, { gain: 0.8 }); g.shake = Math.max(g.shake || 0, 0.25);
    if (g.audio) g.audio.engine(null);
    this.tip(k >= 0 ? 'You flew into a building! Back in the air in a moment' : 'You crashed! Back in the air in a moment');
  }
}
