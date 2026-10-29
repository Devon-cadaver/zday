// Flying a plane round the town (Sandbox; Sean): a stunt plane or a fighter jet, seen from behind (chase) or from the
// cockpit. Arcade handling for a phone: drag anywhere and the plane follows the finger like a stick (left and right bank
// it into a turn; down climbs and up dives, as a pilot pulls back and pushes forward, or the other way with Invert); let
// go and it levels out. Faster and Slower set the throttle. The payload button goes round what it carries (storm seeding
// on the stunt plane, a small bomb, a big bomb, napalm, a nuke) and Drop lets one go. Keys work too (arrows or WASD to
// steer, Shift faster, Ctrl slower, Q the payload, Space to drop, I to invert, V the view, Esc to land). Fly into a building or the ground
// and it goes up in flames there; a moment later you are back in the air at the edge of town. The disasters carry on
// round you, and fight back (hazards: the tornado pulls the plane in, the kaiju throws cars at it, grabs it and burns it,
// the dust storm's devils toss it about) - the hull takes the damage, and at nothing it goes down. main.js hands the
// camera over while it is up (frame()), and game.js's Sandbox has the buttons.
// Or a super hero (Nova, Dragonfly, Tempo), flown the same way but slower, able to hang in the air, skimming the ground
// and bumping off walls rather than crashing: Lock on picks the nearest villain and flies straight at them, and up close
// the fight is the kaiju game's (heroduel.js): tap the weak spots, spin and toss, fly at them again.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { SEE } from './see.js';
import { heroRig } from './heroes.js';
import { relax, detail } from './villains.js';
import { Duel } from './heroduel.js';

// speeds in metres a second; turn: how hard it turns at full bank; chase: the camera's distance behind and height above;
// seat: the cockpit's place (forward, up) in the model
const PLANES = {
  stunt: { name: 'Stunt plane', min: 22, max: 72, start: 42, turn: 1.15, climb: 1.0, chase: [17, 5], seat: [0.6, 1.25], sound: 'stunt' },
  jet: { name: 'Fighter jet', min: 45, max: 150, start: 85, turn: 0.95, climb: 0.85, chase: [28, 7.5], seat: [2.4, 1.85], sound: 'jet', gun: { mag: 40, rate: 12, dmg: 4, range: 350 } },
  a10: { name: 'A-10 Warthog', model: 'a10', scale: 1.7, min: 35, max: 95, start: 60, turn: 1.05, climb: 0.9, chase: [24, 7], seat: [3.2, 3.0], sound: 'jet', gun: { mag: 60, rate: 14, dmg: 6, range: 380 } },
  seeder: { name: 'Cloud seeder', model: 'seeder_plane', scale: 1.8, min: 25, max: 75, start: 45, turn: 1.1, climb: 1.0, chase: [20, 6], seat: [2.8, 3.0], sound: 'stunt' },
  b2: { name: 'B-2 Spirit', model: 'b2', scale: 3, min: 50, max: 120, start: 75, turn: 0.7, climb: 0.6, chase: [40, 12], seat: [3.6, 5.2], sound: 'jet' },
  b52: { name: 'B-52', model: 'b52', scale: 2.4, min: 45, max: 110, start: 70, turn: 0.6, climb: 0.55, chase: [44, 13], seat: [9.0, 5.0], sound: 'jet' },
  // the heroes: punch, how hard their blows land in a fight; slow, how much longer the weak spots last (Tempo slows time)
  nova: { name: 'Nova', hero: 'Nova', min: 6, max: 72, start: 30, turn: 1.8, climb: 1.4, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 1.4 },
  dragonfly: { name: 'Dragonfly', hero: 'Dragonfly', min: 6, max: 88, start: 34, turn: 2.1, climb: 1.5, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 1 },
  tempo: { name: 'Tempo', hero: 'Tempo', min: 6, max: 64, start: 28, turn: 1.8, climb: 1.4, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 0.9, slow: 1.45 },
};
const CEIL = 650, KMH = 3.6, FOV_CHASE = 62, FOV_COCKPIT = 72, INVERT = 'zday_fly_invert';
// what each plane carries, in the order the payload button goes round; wait: seconds before the next; R: the blast's reach; s: the bomb's size
const LOADS = { stunt: ['seed', 'small', 'big', 'napalm', 'nuke'], jet: ['small', 'big', 'napalm', 'nuke'], a10: ['small', 'big', 'napalm'], seeder: ['seed', 'small'], b2: ['big', 'nuke'], b52: ['carpet', 'big', 'napalm', 'nuke'] };
const LOAD = { seed: { name: 'Storm seeding', wait: 8 }, small: { name: 'Small bomb', wait: 0.35, R: 12, s: 0.7, kaiju: 40 }, big: { name: 'Big bomb', wait: 1.2, R: 26, s: 1.3, kaiju: 120 }, napalm: { name: 'Napalm', wait: 2.5, s: 1.1, kaiju: 70 }, carpet: { name: 'Carpet bombs', wait: 3, R: 12, s: 0.7, kaiju: 40, stick: 8 }, nuke: { name: 'Nuke', wait: 10, R: 200, s: 2.4 } }; // kaiju: what a hit does to it, on top of the blast
const SEED_REACH = 160; // a seeding run passing this close to a tornado weakens it (closer, more)
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX');
const HIP = 0.94 * 2.2; // a hero's hips above the feet (the rig's 0.94 at its scale): the hero is flown by the hips
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
// any of the others: the airstrikes' own models, sized up
function planeModel(kind, P) {
  if (P.hero) { const g = new THREE.Group(), r = heroRig(P.hero); r.root.rotation.y = Math.PI / 2; g.add(r.root); g.userData.hero = r; return g; } // a hero lying along +x, posed each frame (heroPose)
  if (kind === 'stunt') return stuntModel();
  if (kind === 'jet') return jetModel();
  const g = new THREE.Group(), m = buildVehicle(P.model); m.scale.setScalar(P.scale); g.add(m); return g;
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
#zd-fly .hud{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(20,14,30,.6);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:6px 11px;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;white-space:pre;text-align:center;line-height:1.35;pointer-events:none;font-variant-numeric:tabular-nums}
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
#zd-flybar .zd-btn.lock{flex:1 1 0;background:linear-gradient(#ff5ad5,#a0168a);font-size:13px;letter-spacing:.08em}
#zd-flybar .zd-btn.lock.on{background:linear-gradient(#ffd27a,#e08a10)}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe,body.zd-flying #zd-top{display:none!important} /* the numbers at the top too: the readout sits there */
`;

export class Flight {
  constructor(game, ctx) { // ctx: { camera, controls, post, renderer }
    this.g = game; this.ctx = ctx; this.active = false; this.view = 'chase'; this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion();
    this.near = 1; this.focus = 30; this.at = new THREE.Vector3(); this.lod = 3; // main.js: flying, the whole town in view, everything in fewer pieces
  }
  // up: the plane at the edge of town, heading in; the camera taken over
  start(kind = 'stunt') {
    if (this.active) this.stop(true);
    const g = this.g, { camera, controls, post } = this.ctx;
    this.kind = PLANES[kind] ? kind : 'stunt'; this.P = PLANES[this.kind];
    this.saved = { far: camera.far, fov: camera.fov, dof: post.opts.dof, see: SEE.on, pos: camera.position.clone(), tg: controls.target.clone() };
    this.obj = planeModel(this.kind, this.P); this.obj.rotation.order = 'YZX'; g.disasters.ctx.scene.add(this.obj);
    this.zoom = this.zoom || 1; this.ammo = this.P.gun ? this.P.gun.mag : 0; this.reload = 0; this.stickN = 0; this.shots = [];
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3)); tg.setDrawRange(0, 0); // the gun's tracers
    this.tracer = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.7), transparent: true, opacity: 0.9 })); this.tracer.frustumCulled = false; g.disasters.ctx.scene.add(this.tracer);
    camera.far = 4000; // past the fog anyway; a nearer far plane keeps the depth sharp with the near one so close
    this.loads = LOADS[this.kind] || []; this.load = 0; this.bombs = []; this.coolT = 0; this.seedT = 0;
    try { this.invert = localStorage.getItem(INVERT) === '1'; } catch (e) { this.invert = false; }
    this.ui(); this.active = true; controls.enabled = false; post.opts.dof = false; g.setFollow(-1);
    document.body.classList.add('zd-flying');
    this.spawn(); this.setView(this.view);
    if (this.P.hero) { // villains to fight: three of them in the middle of town if there are none about
      const D = g.disasters, B = g.city.bounds;
      if (!D.list.some(e => e.alive && e.type === 'villains' && e.who.some(v => !v.gone && !v.beaten))) D.start('villains', (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2);
      this.tip('Drag anywhere to fly. Press Lock on and ' + this.P.name + ' flies straight at the nearest villain');
    } else this.tip('Drag anywhere to steer: left and right to turn, ' + (this.invert ? 'up to climb, down to dive' : 'down to climb, up to dive') + '. Let go and it levels out. Pick a payload, then Drop');
  }
  spawn() {
    const B = this.g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, a = Math.random() * Math.PI * 2, R = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.5 + 60;
    this.pos.set(cx + Math.cos(a) * R, 95, cz + Math.sin(a) * R);
    this.yaw = Math.atan2(-(cz - this.pos.z), cx - this.pos.x); this.pitch = 0; this.roll = 0;
    this.speed = this.thr = this.P.start; this.ix = this.iy = 0; this.state = 'fly'; this.t = 0; this.obj.visible = this.view === 'chase'; this.snap = true;
    this.hull = 100; this.caught = null; this.thrown = []; this.seedTw = null; this.lock = null; this.punch = 0; this.act = null;
    if (this.P.hero) this.pos.y = 60;
  }
  ui() {
    if (!document.getElementById('zd-fly-css')) { const s = document.createElement('style'); s.id = 'zd-fly-css'; s.textContent = CSS; document.head.appendChild(s); }
    const R = this.ctx.renderer.domElement, ov = this.ov = document.createElement('div'); ov.id = 'zd-fly';
    ov.innerHTML = '<div class="hz"></div><div class="ret"></div><div class="stick"><div class="knob"></div></div><div class="hud"></div><div class="tip"></div>';
    R.parentNode.insertBefore(ov, R.nextSibling); // over the town, under the numbers and buttons
    this.hud = ov.querySelector('.hud'); this.hz = ov.querySelector('.hz'); this.stick = ov.querySelector('.stick'); this.knob = ov.querySelector('.knob'); this.tipEl = ov.querySelector('.tip');
    const bar = this.bar = document.createElement('div'); bar.id = 'zd-flybar';
    bar.innerHTML = (this.P.hero ? '<div class="row"><button type="button" class="zd-btn lock" data-f="lock">\uD83C\uDFAF Lock on</button></div>' : '<div class="row"><button type="button" class="zd-btn load" data-f="load"></button><button type="button" class="zd-btn drop" data-f="drop">Drop</button></div>') +
      '<div class="row"><button type="button" class="zd-btn" data-f="view"></button><button type="button" class="zd-btn" data-f="slow">Slower</button><button type="button" class="zd-btn" data-f="fast">Faster</button><button type="button" class="zd-btn" data-f="inv"></button><button type="button" class="zd-btn exit" data-f="exit">Land</button></div>';
    document.body.appendChild(bar); this.viewBtn = bar.querySelector('[data-f="view"]'); this.loadBtn = bar.querySelector('[data-f="load"]'); this.dropBtn = bar.querySelector('[data-f="drop"]'); this.invBtn = bar.querySelector('[data-f="inv"]');
    this.lockBtn = bar.querySelector('[data-f="lock"]'); this.invBtn.onclick = () => this.setInvert(!this.invert);
    if (this.lockBtn) this.lockBtn.onclick = () => this.lockOn(); else { this.loadBtn.onclick = () => this.cycle(); this.dropBtn.onclick = () => this.drop(); this.cycle(0); }
    this.setInvert(this.invert, true);
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
    // two fingers: a pinch zooms (the stick let go meanwhile); the mouse wheel too
    const pts = new Map(); let pinch = null;
    ov.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: this.zoom }; } });
    ov.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; this.setZoom(pinch.z * pinch.d / (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1)); this.ix = this.iy = 0; this.stick.style.display = 'none'; } });
    for (const ev of ['pointerup', 'pointercancel']) ov.addEventListener(ev, (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; });
    ov.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(this.zoom * Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    this.keys = new Set();
    this.onKey = (e) => {
      const down = e.type === 'keydown', k = e.key.toLowerCase();
      if (down && (k === 'v')) this.setView(this.view === 'chase' ? 'cockpit' : 'chase');
      if (down && k === 'escape') { this.stop(); return; }
      if (down && (k === 'shift' || k === '+' || k === '=')) this.throttle(1);
      if (down && (k === 'control' || k === '-')) this.throttle(-1);
      if (down && !e.repeat && k === ' ') { if (this.P.hero) this.lockOn(); else this.drop(); }
      if (down && !e.repeat && k === 'q' && this.loads.length) this.cycle();
      if (down && !e.repeat && k === 'i') this.setInvert(!this.invert);
      if (down && k === 'z') this.setZoom(this.zoom * 0.88); if (down && k === 'x') this.setZoom(this.zoom / 0.88);
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
  }
  tip(text) { if (!this.tipEl) return; this.tipEl.textContent = text; this.tipEl.style.opacity = '1'; clearTimeout(this.tipT); this.tipT = setTimeout(() => { if (this.tipEl) this.tipEl.style.opacity = '0'; }, 5000); }
  // nearer or further: the chase camera's distance, or in the cockpit how wide it sees
  setZoom(z) { this.zoom = Math.max(0.45, Math.min(3, z)); if (this.view === 'cockpit') { const c = this.ctx.camera; c.fov = FOV_COCKPIT * Math.max(0.35, Math.min(1.25, this.zoom)); c.updateProjectionMatrix(); } }
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
    if (this.state !== 'fly' || this.coolT > 0 || this.seedT > 0 || !this.loads.length) return;
    const id = this.loads[this.load], L = LOAD[id]; this.coolT = L.wait;
    if (id === 'seed') { this.seedT = 5; this.trailT = 0; this.seedHigh = 0; this.tip('Seeding the clouds...'); return; }
    if (L.stick) { this.stickN = L.stick; this.stickT = 0; this.stickId = id; return; } // a stick of them, one after another (frame)
    this.release(id);
  }
  release(id) {
    const L = LOAD[id], H = this.g.helis, m = new THREE.Mesh(H.bombGeo, H.bombMat); m.scale.setScalar(L.s); m.castShadow = true; this.g.disasters.ctx.scene.add(m);
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
      if (this.state === 'fly' && Math.hypot(this.pos.x - x, this.pos.z - z) < L.R * 0.6 && this.pos.y < 300) this.crash(-1, 'Caught in your own nuke!');
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
    // on a disaster: the kaiju hurt (more than the blast alone), a dust devil taken out
    for (const e of D.list) {
      if (!e.alive) continue;
      if (e.type === 'kaiju' && L.kaiju && e.state !== 'leave' && Math.hypot(e.x - x, e.z - z) < 45) { e.damage(L.kaiju); this.tip('Direct hit! The kaiju is down to ' + Math.max(0, Math.round(e.hp)) + ' of 1200'); }
      if (e.type === 'haboob' && e.devils) for (const v of e.devils.list) if (!v.dead && Math.hypot(v.x - x, v.z - z) < (L.R || 20) + v.r * 0.8) this.killDevil(e, v, 'Bombed it out!'); // a column of dust: a blast near enough breaks it up
    }
  }
  // the seeding run over: the weather a step wilder (clear to rain to a thunderstorm); seeded in a thunderstorm over the
  // town, a tornado comes down under it
  seeded() {
    const D = this.g.disasters, w = D.weather.type, x = this.pos.x, z = this.pos.z, B = this.g.city.bounds;
    // a tornado about: the run weakens it, more the closer it passed (the cloud seeder's way); a tornado too weak to stand ropes out
    const tws = D.list.filter(e => e.alive && e.type === 'tornado' && e.tw).map(e => e.tw), runs = this.seedTw; this.seedTw = null;
    if (tws.length) {
      let best = null; for (const tw of tws) if (runs && runs.has(tw) && (!best || tw._seedMin < best._seedMin)) best = tw;
      for (const tw of tws) { const m = tw._seedMin; tw._seedMin = undefined; if (tw !== best || m == null || m > SEED_REACH) continue;
        tw.size = Math.max(0.6, tw.size - (0.12 + 0.28 * (1 - Math.max(0, m) / SEED_REACH))); tw.applySize(); tw.life = Math.min(tw.life, tw.t + 25); // two or three close runs bring it down
        if (tw.size < 1.05 && tw.phase === 'ground') { tw.phase = 'rope'; tw.ropeT = 0; this.tip('The tornado is roping out and dying!'); }
        else this.tip('Seeded ' + Math.max(0, Math.round(m)) + ' m from the tornado: it is weakening (strength ' + tw.size.toFixed(1) + ')');
        return; }
      const high = this.seedHigh; this.seedHigh = 0;
      this.tip(high && !(runs && runs.size) ? 'Seed under the cloud base (below ' + Math.round(high) + ' m) to weaken it' : 'Fly the seeding run closer to the tornado, within ' + SEED_REACH + ' m'); return;
    }
    if (w === 'storm') {
      if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) { D.start('tornado', x, z); this.tip('The storm you seeded spins up a tornado!'); } else this.tip('Seed over the town to spin the storm up into a tornado');
    } else { const to = w === 'rain' ? 'storm' : 'rain'; D.weather.set(to); this.tip(to === 'storm' ? 'The clouds boil up into a thunderstorm' : 'The seeded clouds start to rain'); }
  }
  throttle(d) { const P = this.P; this.thr = Math.max(P.min, Math.min(P.max, this.thr + d * (P.max - P.min) / 5)); }
  setView(v) {
    this.view = v; const cam = this.ctx.camera;
    cam.fov = v === 'cockpit' ? FOV_COCKPIT * Math.max(0.35, Math.min(1.25, this.zoom || 1)) : FOV_CHASE; cam.updateProjectionMatrix();
    this.near = v === 'cockpit' ? 0.5 : 1.5; this.obj.visible = v === 'chase' && this.state === 'fly'; this.snap = true;
    SEE.on = v === 'cockpit' ? false : this.saved.see; // walls see-through only between the chase camera and the plane
    this.ov.classList.toggle('cockpit', v === 'cockpit'); this.viewBtn.textContent = v === 'cockpit' ? 'Chase view' : 'Cockpit';
  }
  // down: back to the town as it was, the view over where the plane last was
  stop(quiet = false) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx;
    if (this.duel) this.duel.end('', false); this.lock = null;
    this.active = false; document.body.classList.remove('zd-flying');
    const hr = this.obj.userData.hero; g.disasters.ctx.scene.remove(this.obj);
    if (hr) { hr.cape.g.dispose(); if (hr.smooth && hr.smooth.mesh) { hr.smooth.mesh.geometry.dispose(); const m = hr.smooth.mesh.material; (Array.isArray(m) ? m : [m]).forEach(x => x && x.dispose()); } } else this.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); // its own shapes and paint (a hero's are shared with the rest: only the cape is its own)
    for (const b of this.bombs) g.disasters.ctx.scene.remove(b.m); this.bombs = [];
    g.disasters.ctx.scene.remove(this.tracer); this.tracer.geometry.dispose(); this.tracer.material.dispose();
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
      if (this.stickN > 0 && this.state === 'fly' && (this.stickT -= dt) <= 0) { this.stickT = 0.16; this.stickN--; this.release(this.stickId); }
      if (this.state === 'fly') this.gunStep(dt); this.tracerStep(dt);
      if (this.seedT > 0) { // a long white trail of seeding flares behind it
        this.seedT -= dt; _f.set(1, 0, 0).applyQuaternion(this.q);
        if ((this.trailT -= dt) <= 0) { this.trailT = 0.12; g.fire.spray(this.pos.x - _f.x * 6, this.pos.z - _f.z * 6, this.pos.y - 1, 5, 3, 3.2); }
        if (this.seedT <= 0) this.seeded();
      }
    }
    if (run) this.t2 = (this.t2 || 0) + dt; // the clock the hurt and hit timers go by
    if (run && this.punch > 0) this.punch -= dt;
    if (run && this.duel && this.state === 'fly') { this.hover(dt); if (this.duel) this.duel.step(dt); }
    else if (run && this.state === 'fly') this.fly(dt);
    else if (run && this.state === 'down' && (this.t += dt) > 2.6) { this.spawn(); this.setView(this.view); }
    // the plane where it is
    _e.set(this.roll, this.yaw, this.pitch); this.q.setFromEuler(_e);
    this.obj.position.copy(this.pos); this.obj.quaternion.copy(this.q);
    const prop = this.obj.userData.prop, burner = this.obj.userData.burner, k = (this.thr - P.min) / (P.max - P.min);
    if (prop) prop.rotation.x += dt * (40 + 50 * k);
    if (this.obj.userData.hero) this.heroPose(this.obj.userData.hero, dt);
    if (burner) { burner.scale.set(0.6 + k * 0.9, 1, 1); burner.material.opacity = 0.35 + 0.55 * k; }
    // the camera: behind and above it, easing after it (no roll, so the horizon stays put), or in its seat
    _f.set(1, 0, 0).applyQuaternion(this.q);
    if (this.duel && this.state === 'fly') { // a fight: over the hero's shoulder, the villain in front; held still while they spin
      const v = this.duel.v, fx = Math.cos(this.yaw), fz = -Math.sin(this.yaw), back = 13 * this.zoom, side = 7 * this.zoom;
      const ph = this.duel.phase;
      if (ph === 'spin') _v.copy(cam.position); else _v.set(this.pos.x - fx * back - fz * side, this.pos.y + 7 * Math.pow(this.zoom, 0.8), this.pos.z - fz * back + fx * side);
      cam.position.lerp(_v, 1 - Math.exp(-dt * (ph === 'slam' ? 12 : 4))); cam.up.set(0, 1, 0);
      if (ph === 'spin') cam.lookAt(this.pos); else if (ph === 'slam') cam.lookAt(_u.set(v.x, (v.y || 0) + HIP, v.z)); else cam.lookAt(_u.set(this.pos.x + (v.x - this.pos.x) * 0.65, Math.max(this.pos.y, (v.y || 0) + HIP) + 0.5, this.pos.z + (v.z - this.pos.z) * 0.65));
    } else if (this.view === 'cockpit' && this.state === 'fly') {
      _v.set(P.seat[0], P.seat[1], 0).applyQuaternion(this.q); cam.position.copy(this.pos).add(_v);
      cam.quaternion.copy(this.q).multiply(SEAT_TURN); cam.up.set(0, 1, 0).applyQuaternion(this.q);
    } else {
      const fl = Math.hypot(_f.x, _f.z) || 1, back = P.chase[0] * this.zoom, hi = P.chase[1] * Math.pow(this.zoom, 0.8);
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
      const th = this.threat, hull = Math.max(0, Math.round(this.hull)), L = this.lock;
      this.hud.textContent = P.name.toUpperCase() + ' · ' + Math.round(this.speed * KMH) + ' km/h · ' + Math.max(0, Math.round(this.pos.y)) + ' m · ' + (P.hero ? 'health ' : 'hull ') + hull + '%' + (this.P.gun ? ' · gun ' + (this.reload > 0 ? 'reloading' : this.ammo) : '') +
        (this.duel ? '\nFIGHTING ' + this.duel.v.name.toUpperCase() : L ? '\nLOCKED ON ' + L.name.toUpperCase() + ' ' + Math.round(Math.hypot(L.x - this.pos.x, L.z - this.pos.z)) + ' m' : th && th.d < 600 ? '\n' + th.name.toUpperCase() + ' ' + Math.max(0, Math.round(th.d)) + ' m' : '');
      this.hud.style.color = hull < 35 ? '#ff8a7a' : th && th.d < 60 ? '#ffd27a' : '#fff';
      if (this.state === 'fly' && this.hull < 60) g.fire.spray(this.pos.x - _f.x * 3, this.pos.z - _f.z * 3, this.pos.y, this.hull < 30 ? 4 : 2, 1, 2.2); // smoke off a hurt plane
      if (g.audio) g.audio.engine(this.state === 'fly' ? this.P.sound : null, k);
      if (this.dropBtn) { this.dropBtn.textContent = this.seedT > 0 ? 'Seeding' : 'Drop'; this.dropBtn.classList.toggle('wait', this.coolT > 0 || this.seedT > 0 || this.state !== 'fly'); }
      if (this.lockBtn) { this.lockBtn.textContent = this.lock ? 'Let go of the lock' : '\uD83C\uDFAF Lock on'; this.lockBtn.classList.toggle('on', !!this.lock); this.bar.style.visibility = this.duel ? 'hidden' : ''; }
    }
    if (this.view === 'cockpit') this.hz.style.transform = 'translate(-50%,' + (this.pitch * 260).toFixed(0) + 'px) rotate(' + (-this.roll).toFixed(3) + 'rad)';
  }
  fly(dt) {
    const g = this.g, P = this.P, K = this.keys;
    if (this.caught) { // in the tornado's grip: spun round it and up, then spat out in pieces
      const C = this.caught, tw = C.tw; C.t += dt; C.a += dt * (3 + C.t); C.r = Math.max(4, C.r * (1 - dt * 0.3));
      this.pos.set(tw.x + Math.cos(C.a) * C.r, this.pos.y + 16 * dt, tw.z + Math.sin(C.a) * C.r); this.yaw = -C.a - Math.PI / 2; this.roll += dt * 9; this.pitch = Math.sin(C.t * 5) * 0.6;
      g.shake = Math.max(g.shake || 0, 0.8); if (C.t > 2.4) this.crash(-1, this.P.hero ? 'The tornado threw you out of the sky!' : 'The tornado tore your plane apart!');
      return;
    }
    if (this.lock && this.homeIn(dt)) return;
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
    this.speed += (this.thr - this.speed) * Math.min(1, dt * 0.8) - (P.hero ? 0 : Math.sin(this.pitch) * 9.8 * 0.6 * dt); // a hero climbs as fast as they dive
    this.speed = Math.max(P.min * 0.7, Math.min(P.max * 1.25, this.speed));
    _e.set(this.roll, this.yaw, this.pitch); _q.setFromEuler(_e); _f.set(1, 0, 0).applyQuaternion(_q);
    this.pos.addScaledVector(_f, this.speed * dt);
    this.hazards(dt); if (this.state !== 'fly' || this.caught) return;
    // low over the streets, people duck
    if (this.pos.y < 35 && (this.scareT = (this.scareT || 0) - dt) <= 0) { this.scareT = 0.5; g.people.scare(this.pos.x, this.pos.z, 30, 0.4); }
    // into the ground, or a building
    const x = this.pos.x, y = this.pos.y, z = this.pos.z;
    if (P.hero) { // skims the ground; flies into a wall and bounces off it, nose up
      if (y < 2.4) { this.pos.y = 2.4; if (this.pitch < 0) this.pitch *= 0.3; }
      let wall = false; g.city.buildingsNear(x, z, 2, (k, d, b) => { if (y < b.roofY + 1.5) wall = true; });
      if (wall) { _f.set(1, 0, 0).applyQuaternion(_q); this.pos.addScaledVector(_f, -this.speed * dt * 1.5); this.speed *= 0.5; this.pitch = Math.max(this.pitch, 0.7); if ((this.bumpT || 0) < this.t2) { this.bumpT = this.t2 + 1; this.damage(3, 'You bumped into a building!'); } }
      return;
    }
    if (y < 1.2) { this.crash(-1); return; }
    let hit = -1; g.city.buildingsNear(x, z, 2.5, (k, d, b) => { if (hit < 0 && y < b.roofY + 0.4) hit = k; });
    if (hit >= 0) this.crash(hit);
  }
  crash(k, why) {
    if (this.state !== 'fly') return;
    const g = this.g, f = g.fire, x = this.pos.x, y = Math.max(1, this.pos.y), z = this.pos.z;
    this.state = 'down'; this.t = 0; this.obj.visible = false; this.at.set(x, y, z); this.caught = null; this.hull = 0; this.lock = null;
    if (this.duel) this.duel.end('', false);
    if (this.g.audio) this.g.audio.engine(null);
    if (this.P.hero) { f.dustCloud(x, z, 6, Math.min(20, y + 4)); sfx('thud', x, y, z, { gain: 1 }); this.tip((why || 'You were knocked out of the sky!') + ' Back up in a moment'); return; } // knocked down, no fireball
    f.burst(x, y, z, 16, 2.4); f.burst(x, y + 2, z, 10, 1.6);
    if (k >= 0) f.igniteBuilding(k);
    sfx('boom', x, y, z, { gain: 0.8 }); g.shake = Math.max(g.shake || 0, 0.25);
    this.tip((why || (k >= 0 ? 'You flew into a building!' : 'You crashed!')) + ' Back in the air in a moment');
  }
  // hurt: the hull down by n (at nothing it goes down, why the reason), told once in a while
  damage(n, why) {
    if (this.state !== 'fly') return;
    this.hull -= n; if (this.hull <= 0) { this.crash(-1, why); return; }
    if ((this.hurtT || 0) < this.t2) { this.hurtT = this.t2 + 1.5; this.tip(why + (this.P.hero ? ' Health ' : ' Hull ') + Math.round(this.hull) + '%'); sfx('crash', this.pos.x, this.pos.y, this.pos.z, { gain: 0.4, rate: 1.3 }); }
  }
  // the gun (the fighters): whatever is ahead and in range - the kaiju, a saucer, a walker, a dust devil - it fires at by
  // itself, a magazine at a time, then reloads
  gunStep(h) {
    const G = this.P.gun; if (!G) return;
    if (this.reload > 0) { this.reload -= h; if (this.reload <= 0) this.ammo = G.mag; return; }
    if ((this.gunT = (this.gunT || 0) - h) > 0) return;
    const t = this.sight(G.range); if (!t) return;
    this.gunT = 1 / G.rate; this.ammo--;
    _f.set(1, 0, 0).applyQuaternion(this.q); const j = t.r * 0.6, ax = t.x + (Math.random() - 0.5) * j, ay = t.y + (Math.random() - 0.5) * j, az = t.z + (Math.random() - 0.5) * j;
    this.shots.push({ a: [this.pos.x + _f.x * 4, this.pos.y + _f.y * 4 - 0.5, this.pos.z + _f.z * 4], b: [ax, ay, az], t: 0.07 });
    if (Math.random() < 0.75) t.hit(G.dmg);
    if (this.ammo % 3 === 0) sfx('shot', this.pos.x, this.pos.y, this.pos.z, { gain: 0.3, rate: 1.5 });
    if (this.ammo <= 0) { this.reload = 2.5; this.tip('Out of rounds: reloading'); }
  }
  // the target ahead: within range and about 9 degrees of the nose, the nearest
  sight(range) {
    const p = this.pos, out = [], D = this.g.disasters; _f.set(1, 0, 0).applyQuaternion(this.q);
    for (const e of D.list) {
      if (!e.alive) continue;
      if (e.type === 'kaiju' && e.state !== 'leave') out.push({ x: e.x, y: 35, z: e.z, r: 12, hit: (n) => { if (e.state === 'leave') return; e.hp -= n; if (Math.random() < 0.15) this.g.fire.burst(e.x, 30 + Math.random() * 15, e.z, 3, 1); if (e.hp <= 0) e.retreat('The monster is hurt and retreating out of the city!'); } }); // a round at a time: no big burst each
      if (e.type === 'aliens') {
        for (const s of e.saucers) if (s.state === 'cruise' || s.state === 'act') out.push({ x: s.x, y: s.y, z: s.z, r: 6, hit: (n) => { s.hp -= n; this.g.fire.burst(s.x, s.y, s.z, 2, 0.6); if (s.hp <= 0) { e.shootDown(s); this.tip('Saucer down!'); } } });
        for (const tr of e.tripods) if (!tr.gone && tr.state !== 'fall' && tr.state !== 'wreck') out.push({ x: tr.x, y: Math.max(12, (tr.y || 30) - 4), z: tr.z, r: 8, hit: (n) => tr.damage(n) });
      }
      if (e.type === 'haboob' && e.devils) for (const v of e.devils.list) if (!v.dead && e.sw.inCity(v.x, v.z, 40)) out.push({ x: v.x, y: v.h * 0.4, z: v.z, r: v.r * 0.5, hit: (n) => { v.hp = (v.hp ?? 30) - n; if (v.hp <= 0 && !v.dead) this.killDevil(e, v, 'Shot it to pieces!'); } });
    }
    let best = null, bd = range;
    for (const t of out) { const dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz) || 1; if (d < bd && (dx * _f.x + dy * _f.y + dz * _f.z) / d > 0.988) { bd = d; best = t; } }
    return best;
  }
  tracerStep(h) {
    if (!this.tracer) return;
    for (const s of this.shots) s.t -= h; if (this.shots.length) this.shots = this.shots.filter(s => s.t > 0).slice(-32);
    const a = this.tracer.geometry.attributes.position; this.shots.forEach((s, i) => { a.setXYZ(i * 2, s.a[0], s.a[1], s.a[2]); a.setXYZ(i * 2 + 1, s.b[0], s.b[1], s.b[2]); });
    a.needsUpdate = true; this.tracer.geometry.setDrawRange(0, this.shots.length * 2);
  }
  // the nearest danger, for the HUD
  note(name, d) { if (!this.threat || d < this.threat.d) this.threat = { name, d }; }
  // the disasters fight back: each one near enough has its go at the plane
  hazards(h) {
    this.threat = null;
    for (const e of this.g.disasters.list) {
      if (!e.alive || this.state !== 'fly' || this.caught) continue;
      if (e.type === 'tornado' && e.tw) this.twister(e.tw, h);
      else if (e.type === 'kaiju') this.kaijuStep(e, h);
      else if (e.type === 'haboob' && e.devils) this.devilStep(e, h);
      else if (e.type === 'villains') this.villainStep(e, h);
    }
    // cars the kaiju threw, on their way: one that reaches the plane hits it
    for (const th of this.thrown) { th.t += h; const o = th.o.position; if (this.state === 'fly' && o.distanceTo(this.pos) < 7) { th.done = true; this.g.fire.burst(o.x, o.y, o.z, 10, 2); this.damage(60, 'A car the kaiju threw hit you!'); } else if (th.t > 6 || o.y < 3) th.done = true; }
    if (this.thrown.some(th => th.done)) this.thrown = this.thrown.filter(th => !th.done);
  }
  // a tornado: within reach of its funnel (wider the higher up, and leaning with it) the plane is drawn in and round and
  // shaken; into the funnel itself and it is caught. Over the top of it, nothing. A seeding run notes how close it came
  twister(tw, h) {
    if (tw.descend < 0.5 || tw.fade < 0.5) return; // still coming down out of the cloud, or gone
    const p = this.pos, k = Math.pow(Math.max(0, Math.min(1, p.y / tw.H)), 1.5), ax = tw.x + (tw.vort.lx || 0) * k, az = tw.z + (tw.vort.lz || 0) * k;
    const dx = p.x - ax, dz = p.z - az, d = Math.hypot(dx, dz) || 0.01, r = tw.radiusAt(Math.min(p.y, tw.H)), reach = r * 4 + 70;
    this.note('tornado', d - r);
    if (this.seedT > 0) { if (p.y < tw.H) { tw._seedMin = Math.min(tw._seedMin ?? 1e9, d - r); (this.seedTw || (this.seedTw = new Set())).add(tw); } else this.seedHigh = tw.H; } // only under the cloud base
    if (p.y > tw.H && d < reach) { this.g.shake = Math.max(this.g.shake || 0, 0.3); this.roll += (Math.random() - 0.5) * 0.08; } // the wall cloud over it: rough air
    if (p.y > tw.H * 1.15 || d > reach) { if (d > reach + 40) this.saidPull = false; return; }
    const s = Math.pow(1 - d / reach, 2), tx = -dz / d, tz = dx / d; // how hard it has hold, and the way it turns round
    p.x += (-dx / d * 50 + tx * 30) * s * h; p.z += (-dz / d * 50 + tz * 30) * s * h; p.y += 8 * s * h;
    this.roll += (Math.random() - 0.5) * s * 0.5; this.pitch += (Math.random() - 0.5) * s * 0.12; this.g.shake = Math.max(this.g.shake || 0, s * 0.7);
    if (s > 0.12 && !this.saidPull) { this.saidPull = true; this.tip('The tornado is pulling you in! Turn away, speed up, or climb over it'); }
    if (d < r * 1.5 + 4) { this.caught = { tw, a: Math.atan2(dz, dx), r: Math.max(6, d), t: 0 }; this.tip('Sucked into the tornado!'); }
  }
  // the kaiju: flies too close under it and a tentacle snatches the plane; through the jet of its fire and it burns; in
  // range it throws a car at where the plane will be
  kaijuStep(e, h) {
    if (e.state === 'leave') return;
    const p = this.pos, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 0.01;
    this.note('kaiju ' + Math.max(0, Math.round(e.hp)) + ' hp', d);
    if (d < 48 && p.y < 80) {
      if (!this.saidTent) { this.saidTent = true; this.tip('Too close! Its tentacles are reaching for you'); }
      if (d < 30 && p.y < 65 && Math.random() < h * 2.5) { this.crash(-1, this.P.hero ? 'A tentacle swatted you out of the air!' : 'A tentacle snatched your plane out of the air!'); return; }
    } else if (d > 90) this.saidTent = false;
    if (e.act && e.act.kind === 'fire' && d < 95 && p.y < 75 && (dx * Math.cos(e.yaw) + dz * Math.sin(e.yaw)) / d > 0.7) this.damage(32 * h, 'You flew through its fire!');
    if (d < 260 && p.y < 190 && (e._throwT = (e._throwT ?? 2.5) - h) <= 0) { e._throwT = 4.5 + Math.random() * 3; this.throwAt(e); }
  }
  // a parked car near the kaiju, hurled from up at its shoulders to where the plane will be when it gets there
  throwAt(e) {
    const g = this.g, T = g.traffic, D = g.disasters; let pc = null, bd = 1e9;
    for (const c of T.parkedNear(e.x, e.z, 80)) { const d = Math.hypot(c.x - e.x, c.z - e.z); if (d < bd) { bd = d; pc = c; } }
    if (!pc) return;
    T.takeParked(pc);
    const m = new THREE.Mesh(T.geometryOf(pc.type), D.carMat(pc.hex)); m.castShadow = true;
    const sx = e.x, sy = 40, sz = e.z; m.position.set(sx, sy, sz);
    _f.set(1, 0, 0).applyQuaternion(this.q);
    const t = Math.max(0.9, Math.hypot(this.pos.x - sx, this.pos.y - sy, this.pos.z - sz) / 75), tx = this.pos.x + _f.x * this.speed * t, ty = this.pos.y + _f.y * this.speed * t, tz = this.pos.z + _f.z * this.speed * t;
    D.debris.addObject(m, 'fly', { v: [(tx - sx) / t, (ty - sy) / t + 4.9 * t, (tz - sz) / t] });
    this.thrown.push({ o: m, t: 0 });
    sfx('roar', e.x, 45, e.z, { gain: 0.6 }); this.tip('The kaiju threw a car at you! Turn!');
  }
  // the dust storm's devils: flying into one tosses the plane about; a seeding run close by takes it out (so does a bomb: boom)
  devilStep(e, h) {
    const p = this.pos;
    for (const v of e.devils.list) {
      if (v.dead || !e.sw.inCity(v.x, v.z, 40)) continue;
      const d = Math.hypot(p.x - v.x, p.z - v.z), r = v.r * (0.22 + 0.78 * Math.min(1, Math.max(0, p.y) / v.h)); // its width at the plane's height
      this.note('dust devil', d - r);
      if (this.seedT > 0 && d < r + 45) { this.killDevil(e, v, 'Seeded it out!'); continue; }
      if (p.y < v.h && d < r && (v.hitT || 0) < this.t2) { v.hitT = this.t2 + 2; this.roll += (Math.random() < 0.5 ? -1 : 1) * 1.6; this.pitch += 0.35; this.g.shake = Math.max(this.g.shake || 0, 0.7); this.damage(30, 'A dust devil tossed you about!'); }
    }
  }
  // the villains: the nearest named on the HUD; one close to a hero (not in a fight with them) lands a blow now and then
  villainStep(e, h) {
    for (const v of e.who) {
      if (v.gone || v.beaten) continue;
      const d = Math.hypot(v.x - this.pos.x, (v.y || 0) + HIP - this.pos.y, v.z - this.pos.z); this.note(v.name, d);
      if (this.P.hero && !v.tossed && !v.gripped && d < 12 && (v.hitT || 0) < this.t2) { v.hitT = this.t2 + 2.5; this.g.shake = Math.max(this.g.shake || 0, 0.3); this.damage(6, v.name + ' hit you!'); }
    }
  }
  // Lock on (a hero): the nearest villain still up, and the hero flies straight at them (homeIn); pressed again, the lock let go
  lockOn(v, again = false) {
    if (this.state !== 'fly' || this.duel) return;
    if (this.lock && !again) { this.lock = null; this.tip('Lock let go: flying free'); return; }
    if (!v) { let bd = 1e9; for (const e of this.g.disasters.list) if (e.alive && e.type === 'villains') for (const w of e.who) { if (w.gone || w.beaten) continue; const d = Math.hypot(w.x - this.pos.x, w.z - this.pos.z); if (d < bd) { bd = d; v = w; } } }
    if (!v || v.gone || v.beaten) { const B = this.g.city.bounds; this.lock = null; this.g.disasters.start('villains', (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2); this.tip('More villains are coming! Press Lock on again'); return; } // all beaten: three more
    this.lock = v; this.tip('Locked on ' + v.name + '! Flying straight at them'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 });
  }
  // locked on: straight at the villain, faster the further, up over a roof in the way; close enough and the fight is on (heroduel.js)
  homeIn(dt) {
    const v = this.lock, P = this.P;
    if (!v || v.gone || v.beaten) { this.lock = null; return false; }
    const ty = Math.max(2.4, (v.y || 0) + HIP), dx = v.x - this.pos.x, dy = ty - this.pos.y, dz = v.z - this.pos.z, d = Math.hypot(dx, dy, dz) || 0.01;
    if (d < 6.5) { this.speed = 0; this.duel = new Duel(this, v); this.obj.visible = true; SEE.on = this.saved.see; return true; }
    let a = Math.atan2(-dz, dx) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    this.yaw += a * Math.min(1, dt * 5); this.roll += (Math.max(-1, Math.min(1, -a * 2)) - this.roll) * Math.min(1, dt * 3);
    this.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) * 0.8 - this.pitch) * Math.min(1, dt * 4);
    this.speed += (Math.min(P.max * 1.6, d * 1.6 + 14) - this.speed) * Math.min(1, dt * 2.5);
    const s = Math.min(d - 6, this.speed * dt); this.pos.x += dx / d * s; this.pos.y += dy / d * s; this.pos.z += dz / d * s;
    let top = -1; this.g.city.buildingsNear(this.pos.x, this.pos.z, 2, (k, dd, b) => { if (this.pos.y < b.roofY + 2.4 && b.roofY > top) top = b.roofY; });
    if (top >= 0 && d > 14) this.pos.y = top + 2.4; // over it, not through it
    if (this.pos.y < 2.4) this.pos.y = 2.4;
    return true;
  }
  // in a fight: hanging in the air a step from the villain, at their height, facing them (they are held there); while
  // spinning them, still, turning with them; once they are thrown, watching them go
  hover(dt) {
    const D = this.duel, v = D.v, k = Math.min(1, dt * 3);
    if (D.phase === 'spots' || D.phase === 'dazed') {
      const dx = this.pos.x - v.x, dz = this.pos.z - v.z, d = Math.hypot(dx, dz) || 1;
      this.pos.x += (v.x + dx / d * 5.5 - this.pos.x) * k; this.pos.z += (v.z + dz / d * 5.5 - this.pos.z) * k; this.pos.y += (Math.max(2.4, (v.y || 0) + HIP) - this.pos.y) * k;
    }
    if (D.phase === 'spin') this.pos.y += (Math.max(this.pos.y, 14) - this.pos.y) * Math.min(1, dt * 1.2); // rising as they whirl round
    if (D.phase !== 'drag' && D.phase !== 'slam') { // dragging them (brawl.js steers) or the sky slam (heroduel.js places the hero): hands off
      let a = Math.atan2(-(v.z - this.pos.z), v.x - this.pos.x) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      this.yaw += a * Math.min(1, dt * (D.phase === 'spin' ? 25 : 5));
    }
    this.pitch -= this.pitch * Math.min(1, dt * 4); this.roll -= this.roll * Math.min(1, dt * 4); this.speed = 0;
  }
  // the fight over (heroduel.js): back to flying
  duelOver(won) { this.duel = null; this.act = null; this.lock = null; this.obj.visible = this.view === 'chase' && this.state === 'fly'; SEE.on = this.view === 'cockpit' ? false : this.saved.see; this.speed = this.thr = Math.max(this.thr, this.P.start * 0.6); this.pitch = 0.5; } // nose up, clear of the street
  // a hero's pose: flat out along the way at speed, one fist ahead; upright and treading air slow or in a fight; a punch;
  // arms out holding on while spinning a villain round. The rig set so the hips are where the hero is
  heroPose(r, dt) {
    const A = r.arms, L = r.legs, D = this.duel, fast = D ? 0 : Math.max(0, Math.min(1, (this.speed - 10) / 14)), act = this.act, kind = act && act.kind;
    const u = act ? Math.min(1, act.t / act.T) : 0, k = Math.sin(Math.PI * u); // a move: how far through it; out and back
    relax(r); this.lean = kind === 'dive' ? Math.PI : (this.lean || 0) + ((kind === 'drag' ? 0.9 : 1.35 * fast) - (this.lean || 0)) * Math.min(1, dt * 3); // head first after them in the dive
    if (D && D.phase === 'spin') for (const a of A) { a.sh.rotation.set(-1.5, 0, -a.sx * 0.24); a.el.rotation.set(0, 0, 0); } // straight out and in together: the hands on the villain's ankles (heroduel.js HANDS)
    else if (kind === 'kick') { L[1].hip.rotation.x = -1.7 * k; L[1].knee.rotation.x = 0.9 * (1 - k); L[0].knee.rotation.x = 0.3; r.torso.rotation.x = -0.35 * k; for (const a of A) { a.sh.rotation.set(-0.5, 0, a.sx * (0.6 + 0.4 * k)); a.el.rotation.set(-0.8, 0, 0); } }
    else if (kind === 'laser') { if (this.P.hero === 'Nova') { for (const a of A) { a.sh.rotation.set(0.45, 0, a.sx * 0.25); a.el.rotation.set(-0.9, 0, 0); } r.torso.rotation.x = 0.15; } else for (const a of A) { a.sh.rotation.set(-1.55, 0, -a.sx * 0.12); a.el.rotation.set(0, 0, 0); } } // Nova's from her eyes, fists back; the others' from their hands
    else if (kind === 'crouch') { A[1].sh.rotation.set(0.5, 0, 0.1); A[1].el.rotation.set(-1.4, 0, 0); A[0].sh.rotation.set(-1.0, 0, -0.15); A[0].el.rotation.set(-1.7, 0, 0); r.torso.rotation.x = 0.4; for (const l of L) { l.hip.rotation.x = -0.4; l.knee.rotation.x = 0.8; } } // wound up for the uppercut
    else if (kind === 'upper') { A[1].sh.rotation.set(-0.4 - 2.4 * k, 0, 0.1); A[1].el.rotation.set(-1.2 * (1 - k), 0, 0); r.torso.rotation.x = 0.4 - 0.7 * k; }
    else if (kind === 'rise') { A[1].sh.rotation.set(-3.0, 0, 0.1); A[0].sh.rotation.set(0.2, 0, -0.15); }
    else if (kind === 'hammerUp' || kind === 'hammer' || kind === 'dive') { const s = kind === 'hammer' ? u : 0; for (const a of A) { a.sh.rotation.set(-3.0 + 2.3 * s, 0, -a.sx * 0.15); a.el.rotation.set(0, 0, 0); } r.torso.rotation.x = kind === 'hammerUp' ? -0.25 : 0.35 * s; } // fists together over the head, brought down
    else if (kind === 'drag') { A[1].sh.rotation.set(0.9, 0, 0.25); A[1].el.rotation.set(0, 0, 0); A[0].sh.rotation.set(-2.9, 0, -0.1); } // one hand back on their throat, the other ahead
    else if (this.punch > 0) { A[1].sh.rotation.set(-1.6, 0, 0.1); A[0].sh.rotation.set(0.4, 0, -0.2); A[0].el.rotation.set(-1.4, 0, 0); r.torso.rotation.x = 0.3; }
    else if (fast > 0.5) { A[1].sh.rotation.set(-3.0, 0, 0.1); A[0].sh.rotation.set(0.25, 0, -0.1); }
    else { for (const a of A) a.sh.rotation.set(0.1, 0, a.sx * 0.3); for (const L of r.legs) { L.hip.rotation.x = 0.1; L.knee.rotation.x = 0.25; } }
    r.body.rotation.x = this.lean; r.head.rotation.x = -this.lean * 0.6;
    r.root.position.set(-Math.sin(this.lean) * HIP, -Math.cos(this.lean) * HIP + (fast < 0.5 && !D ? Math.sin((this.wingT || 0) * 2) * 0.15 : 0), 0); // treading air (held still in a fight)
    r.cape.update(dt, this.lean > 0.5 ? 0.12 : Math.min(0.6, this.speed / 30), 0.3 + Math.min(0.7, this.speed / 20));
    this.wingT = (this.wingT || 0) + dt; r.wings.forEach((w, i) => { w.rotation.z = Math.sin(this.wingT * 55 + i * 1.3) * 0.45 + 0.15; });
    if (this.obj.visible) detail(r, null, true);
  }
  killDevil(e, v, why) {
    v.dead = true; if (e.dust) e.dust.emit(v.x, 6, v.z, 30, { up: [6, 20], spread: 14, life: 2.2, size: 7 });
    const left = e.devils.list.filter(q => !q.dead && e.sw.inCity(q.x, q.z, 40)).length;
    this.tip(left ? why + ' ' + left + ' dust devil' + (left > 1 ? 's' : '') + ' left' : 'Every dust devil is down!');
  }
}
