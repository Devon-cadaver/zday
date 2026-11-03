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
// and smashing straight through buildings, which come down behind them (plough): Lock on picks the nearest villain and flies straight at them, and up close
// the fight is the fight engine's (fighttest.js), down in the street where they are; then back into the air.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { SEE } from './see.js';
import { heroRig } from './heroes.js';
import { relax, detail, villainRig , S } from './villains.js';
import { Interior } from './interior.js';
import { LAB } from './lab.js';
import { playClip } from './clips.js';
import { Streak } from './streak.js';
import { Getaway } from './getaway.js';
import { Army } from './army.js';
import { HeroPower, POWER } from './heropower.js';
import { HS } from './herogame.js';
import { WindGame } from './windgame.js';

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
  tyrant: { name: 'Tyrant', hero: 'Tyrant', rigV: 1, min: 6, max: 70, start: 30, turn: 1.8, climb: 1.4, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 1.4 },
  blur: { name: 'Blur', hero: 'Blur', rigV: 1, min: 6, max: 90, start: 36, turn: 2.2, climb: 1.5, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 0.9, slow: 1.3 },
  weaver: { name: 'Weaver', hero: 'Weaver', rigV: 1, min: 6, max: 66, start: 28, turn: 1.9, climb: 1.4, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 1.1 },
  tempo: { name: 'Tempo', hero: 'Tempo', min: 6, max: 64, start: 28, turn: 1.8, climb: 1.4, chase: [10, 3.4], seat: [1.9, 0.7], sound: 'wind', punch: 0.9, slow: 1.45 },
};
const CEIL = 650, KMH = 3.6, FOV_CHASE = 62, FOV_COCKPIT = 72, INVERT = 'zday_fly_invert';
const FOV_ISO = 18, ISO_DIST = 64, ISO_EL = 0.84; // a fight is watched the way the town is (Sean): the town's narrow lens, far off and high (about 48 degrees), the miniature look with the blur on
// what each plane carries, in the order the payload button goes round; wait: seconds before the next; R: the blast's reach; s: the bomb's size
const LOADS = { stunt: ['seed', 'small', 'big', 'napalm', 'nuke'], jet: ['small', 'big', 'napalm', 'nuke'], a10: ['small', 'big', 'napalm'], seeder: ['seed', 'small'], b2: ['big', 'nuke'], b52: ['carpet', 'big', 'napalm', 'nuke'] };
const LOAD = { seed: { name: 'Storm seeding', wait: 8 }, small: { name: 'Small bomb', wait: 0.35, R: 12, s: 0.7, kaiju: 40 }, big: { name: 'Big bomb', wait: 1.2, R: 26, s: 1.3, kaiju: 120 }, napalm: { name: 'Napalm', wait: 2.5, s: 1.1, kaiju: 70 }, carpet: { name: 'Carpet bombs', wait: 3, R: 12, s: 0.7, kaiju: 40, stick: 8 }, nuke: { name: 'Nuke', wait: 10, R: 200, s: 2.4 } }; // kaiju: what a hit does to it, on top of the blast
const SEED_REACH = 160; // a seeding run passing this close to a tornado weakens it (closer, more)
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX');
const HIP = 0.94 * S; // a hero's hips above the feet (the rig's 0.94 at its scale): the hero is flown by the hips
const SEAT_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // a camera looks down -z; the planes point along +x
const SHOT = { Blur: { col: 0x6fb8ff, r: 0.7, glow: true }, Tyrant: { col: 0x3a3430, r: 1.1 }, Weaver: { col: 0xf4f1ea, r: 0.8 } }; // what each villain throws at a hero flying in
const SHOT_GEO = new THREE.SphereGeometry(1, 10, 8), SHOT_BOX = new THREE.BoxGeometry(1.6, 1.2, 1.4);
const wallHex = (b) => { const c = b.wallCol || [0.6, 0.56, 0.5]; return ((c[0] * 255) << 16) | ((c[1] * 255) << 8) | (c[2] * 255); }; // a building's wall colour, for its bricks flying

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
  if (P.hero) { const g = new THREE.Group(), r = P.rigV ? villainRig(P.hero, HS.outfit(P.hero)) : heroRig(P.hero, HS.outfit(P.hero)); r.root.rotation.y = Math.PI / 2; g.add(r.root); g.userData.hero = r; return g; } // a hero lying along +x, posed each frame (heroPose)
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
#zd-fly .hud{max-width:calc(100vw - 24px);box-sizing:border-box;line-height:1.25!important;text-align:center;position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(20,14,30,.6);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:6px 11px;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;white-space:pre;text-align:center;line-height:1.35;pointer-events:none;font-variant-numeric:tabular-nums;max-width:calc(100vw - 28px);box-sizing:border-box}
#zd-fly .hz,#zd-fly .ret{position:absolute;left:50%;top:50%;pointer-events:none;display:none}
#zd-fly .hz{width:56vw;height:0;border-top:2px solid rgba(160,255,190,.55)}
#zd-fly .ret{width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid rgba(160,255,190,.8);border-radius:50%}
#zd-fly.cockpit .hz,#zd-fly.cockpit .ret{display:block}
#zd-fly .tip{position:absolute;left:50%;bottom:calc(130px + env(safe-area-inset-bottom));transform:translateX(-50%);color:#fff;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;text-shadow:0 1px 3px #000;pointer-events:none;transition:opacity .6s;width:80vw}
#zd-flybar{position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;width:min(calc(100vw - 16px),460px);z-index:31}
#zd-flybar .row{display:flex;gap:6px}
#zd-flybar .zd-btn{flex:1 1 0;min-width:0;padding:14px 4px;font-size:11px;color:#fff;background:linear-gradient(#8a3bff,#5216c2);border-color:rgba(255,255,255,.3)}
#zd-flybar .zd-btn.exit{background:linear-gradient(#ff5a8a,#c2165a)}
#zd-flybar .zd-btn.grabnow{background:linear-gradient(#fff27a,#ff9d00);color:#2a1038;border-color:#fff;font-size:14px;font-weight:900;animation:zdGrabNow .45s ease-in-out infinite alternate} /* GRAB IT can be done now (Sean: it must show) */
@keyframes zdGrabNow{from{transform:scale(1);box-shadow:0 0 8px 2px rgba(255,220,80,.7)}to{transform:scale(1.1);box-shadow:0 0 26px 10px rgba(255,220,80,.95)}}
#zd-flybar .zd-btn.load{flex:2 1 0;background:linear-gradient(#3a2a6a,#241848)}
#zd-flybar .zd-btn.drop{background:linear-gradient(#ffb02e,#e05a10);font-size:13px;letter-spacing:.1em}
#zd-flybar .zd-btn.drop.wait{opacity:.45}
#zd-flybar .zd-btn.use{background:linear-gradient(#ffc04a,#d0700a);min-width:58px}
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
    if (this.P.hero) { const c = { Nova: [1.6, 0.5, 1.4], Dragonfly: [0.6, 1.7, 0.7], Tempo: [0.5, 1.2, 1.8] }[this.P.hero] || [1.4, 1.2, 0.8]; this.streak = new Streak(g.disasters.ctx.scene, c); } // the speed streak behind a hero's dashes (streak.js)
    this.zoom = this.zoom || 1; this.ammo = this.P.gun ? this.P.gun.mag : 0; this.reload = 0; this.stickN = 0; this.shots = [];
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3)); tg.setDrawRange(0, 0); // the gun's tracers
    this.tracer = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.7), transparent: true, opacity: 0.9 })); this.tracer.frustumCulled = false; g.disasters.ctx.scene.add(this.tracer);
    camera.far = 4000; // past the fog anyway; a nearer far plane keeps the depth sharp with the near one so close
    this.loads = LOADS[this.kind] || []; this.load = 0; this.bombs = []; this.coolT = 0; this.seedT = 0;
    try { this.invert = localStorage.getItem(INVERT) === '1'; } catch (e) { this.invert = false; }
    this.ui(); this.active = true; controls.enabled = false; post.opts.dof = false; g.setFollow(-1); LAB.reset();
    if (this.P.hero && !this.viewSet) { let v = null; try { v = localStorage.getItem('zday_flyview'); } catch (e) { /* no storage */ } this.view = v === 'chase' || v === 'cockpit' ? v : 'iso'; this.viewSet = true; } // heroes start in the town's view (Sean); after that the view is as it was left
    document.body.classList.add('zd-flying');
    this.spawn(); this.setView(this.view);
    if (this.P.hero && LAB.army) this.army = new Army(this); // the rogue army, if the lab has it on (army.js)
    if (this.P.hero) { // villains to fight: three of them in the middle of town if there are none about
      const D = g.disasters, B = g.city.bounds;
      if (!this.heroGame && !D.list.some(e => e.alive && e.type === 'villains' && e.who.some(v => !v.gone && !v.beaten))) D.start('villains', (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2);
      this.tip('Drag anywhere to fly. Fly into a building to smash right through it. Press Lock on and ' + this.P.name + ' flies straight at the nearest villain');
    } else this.tip('Drag anywhere to steer: left and right to turn, ' + (this.invert ? 'up to climb, down to dive' : 'down to climb, up to dive') + '. Let go and it levels out. Pick a payload, then Drop');
  }
  spawn() {
    const B = this.g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, a = Math.random() * Math.PI * 2, R = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.5 + 60;
    this.pos.set(cx + Math.cos(a) * R, 95, cz + Math.sin(a) * R);
    this.yaw = Math.atan2(-(cz - this.pos.z), cx - this.pos.x); this.pitch = 0; this.roll = 0;
    if (this.heroGame && this.inLevel) document.body.classList.add('zd-flying'); this.speed = this.thr = this.P.start; this.ix = this.iy = 0; this.state = 'fly'; this.t = 0; this.obj.visible = this.view !== 'cockpit'; this.snap = true;
    this.hullMax = this.P.hero ? LAB.heroHealth() : 100; this.hull = this.hullMax; this.caught = null; this.thrown = []; this.seedTw = null; this.lock = null; this.punch = 0; this.act = null; this.inB = -1; this.downAt = false; this.clearShots(); // a hero's health by the lab's level
    if (this.P.hero) this.pos.y = 60;
  }
  ui() {
    if (!document.getElementById('zd-fly-css')) { const s = document.createElement('style'); s.id = 'zd-fly-css'; s.textContent = CSS; document.head.appendChild(s); }
    const R = this.ctx.renderer.domElement, ov = this.ov = document.createElement('div'); ov.id = 'zd-fly';
    ov.innerHTML = '<div class="hz"></div><div class="ret"></div><div class="stick"><div class="knob"></div></div><div class="hud"></div><div class="tip"></div>';
    R.parentNode.insertBefore(ov, R.nextSibling); // over the town, under the numbers and buttons
    this.hud = ov.querySelector('.hud'); this.hz = ov.querySelector('.hz'); this.stick = ov.querySelector('.stick'); this.knob = ov.querySelector('.knob'); this.tipEl = ov.querySelector('.tip');
    const bar = this.bar = document.createElement('div'); bar.id = 'zd-flybar';
    bar.innerHTML = (this.P.hero ? '<div class="row"><button type="button" class="zd-btn" data-f="power"></button><button type="button" class="zd-btn use" data-f="use">Use</button><button type="button" class="zd-btn lock" data-f="lock">\uD83C\uDFAF Lock on</button></div>' : '<div class="row"><button type="button" class="zd-btn load" data-f="load"></button><button type="button" class="zd-btn drop" data-f="drop">Drop</button></div>') +
      '<div class="row"><button type="button" class="zd-btn" data-f="view"></button><button type="button" class="zd-btn" data-f="slow">Slower</button><button type="button" class="zd-btn" data-f="fast">Faster</button><button type="button" class="zd-btn" data-f="inv"></button><button type="button" class="zd-btn exit" data-f="exit">Land</button></div>';
    document.body.appendChild(bar); this.viewBtn = bar.querySelector('[data-f="view"]'); this.loadBtn = bar.querySelector('[data-f="load"]'); this.dropBtn = bar.querySelector('[data-f="drop"]'); this.invBtn = bar.querySelector('[data-f="inv"]');
    this.lockBtn = bar.querySelector('[data-f="lock"]'); this.invBtn.onclick = () => this.setInvert(!this.invert);
    this.powerBtn = bar.querySelector('[data-f="power"]'); if (this.powerBtn) { this.power = new HeroPower(this); this.powerBtn.onclick = () => this.power.cycle(); bar.querySelector('[data-f="use"]').onclick = () => this.power.use(); this.power.show(); } // powers against disasters (heropower.js)
    if (this.lockBtn) this.lockBtn.onclick = () => this.lockOn(); else { this.loadBtn.onclick = () => this.cycle(); this.dropBtn.onclick = () => this.drop(); this.cycle(0); }
    this.setInvert(this.invert, true);
    bar.querySelector('[data-f="view"]').onclick = () => this.setView(this.nextView());
    bar.querySelector('[data-f="slow"]').onclick = () => this.throttle(-1);
    bar.querySelector('[data-f="fast"]').onclick = () => this.throttle(1);
    bar.querySelector('[data-f="exit"]').onclick = () => { if (this.fromHorde) this.landHorde(false); else if (this.fromBase) this.landBase(); else this.stop(); };
    if ((this.fromHorde || this.inLevel) && this.power) { // story mode: each power its own button, and BOOST in place of Use (Sean): fast while held
      const r0 = bar.querySelector('.row'); this.powerBtn.style.display = 'none'; const ub = bar.querySelector('[data-f="use"]'); ub.style.display = 'none';
      this.power.list().forEach((id, i) => { const P0 = POWER[id], q = document.createElement('button'); q.type = 'button'; q.className = 'zd-btn'; q.dataset.pw = id; q.innerHTML = P0.icon + ' ' + P0.name; q.onclick = () => { this.power.i = i; this.power.use(); }; r0.insertBefore(q, ub); });
      const bo = document.createElement('button'); bo.type = 'button'; bo.className = 'zd-btn use'; bo.innerHTML = '\u26A1 BOOST'; bo.style.touchAction = 'none'; const on = (e) => { e.preventDefault(); e.stopPropagation(); try { bo.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } if (this.hovering) this.unhover(); this.lock = null; this.boosting = true; }, off = () => { this.boosting = false; }; bo.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bo.addEventListener(ev, off); r0.insertBefore(bo, ub);
    }
    if (this.inLevel && !this.fromHorde) { // Destroy's bar: Fly, Lock on, and leaving takes two taps
      const r1 = bar.querySelectorAll('.row')[1], ex = bar.querySelector('[data-f="exit"]'); for (const k of ['view', 'slow', 'fast', 'inv']) bar.querySelector('[data-f="' + k + '"]').style.display = 'none';
      const fb = this.flyBtn = document.createElement('button'); fb.type = 'button'; fb.className = 'zd-btn lock'; fb.innerHTML = '\u2708 FLY'; fb.onclick = () => { if (this.hovering) this.unhover(); else { this.hovering = true; this.lock = null; } }; r1.insertBefore(fb, ex); this.addUpDown(r1, ex); r1.insertBefore(this.lockBtn, ex); { const lb = this.baseBtn = document.createElement('button'); lb.type = 'button'; lb.className = 'zd-btn exit'; lb.innerHTML = this.inLair() ? '\uD83D\uDC80 LAIR' : '\uD83C\uDFE0 BASE'; lb.onclick = () => this.toLair(); r1.insertBefore(lb, ex); } ex.innerHTML = 'QUIT'; let armed = 0; ex.onclick = () => { if (performance.now() - armed < 2500) this.stop(); else { armed = performance.now(); ex.innerHTML = 'SURE?'; setTimeout(() => { if (ex.isConnected) ex.innerHTML = 'QUIT'; }, 2500); } };
    }
    if (this.fromHorde) { // the level's row of four (Sean): Fly, Land, Lock on, Base; the powers and the smash above
      const r0 = bar.querySelector('.row'), r1 = bar.querySelectorAll('.row')[1], ex = bar.querySelector('[data-f="exit"]'), mk = (t, c, f) => { const q = document.createElement('button'); q.type = 'button'; q.className = 'zd-btn ' + c; q.innerHTML = t; q.onclick = f; return q; };
      for (const k of ['view', 'slow', 'fast', 'inv']) bar.querySelector('[data-f="' + k + '"]').style.display = 'none';
      this.flyBtn = mk('\u2708 FLY', 'lock', () => { if (this.hovering) this.unhover(); else { this.hovering = true; this.lock = null; } }); r1.insertBefore(this.flyBtn, ex); this.addUpDown(r1, ex); ex.innerHTML = '\u2B07 LAND'; r1.appendChild(this.lockBtn); r1.appendChild(this.baseBtn = mk(this.g.mode && this.g.mode.side === 'villain' ? '\uD83D\uDC80 LAIR' : '\uD83C\uDFE0 BASE', 'exit', () => { const H = this.fromHorde; if (H) H.toBase(); }));
      this.smashBtn = mk('\u270A SMASH LAND', 'exit', () => { const H = this.fromHorde; if (H && H.airGrab()) return; this.landHorde(true); }); r0.appendChild(this.smashBtn);
    } // up from the street fight: the grab button's place in the air
    // the finger as a stick: how far it has gone from where it came down
    let id = null, ox = 0, oy = 0;
    const held = () => this.fromHorde && (this.fromHorde.holdPhase === 'hold' || this.fromHorde.holdPhase === 'spin'); let t0 = 0, far = false; ov.addEventListener('pointerdown', (e) => { if (id !== null) return; t0 = performance.now(); far = false; id = e.pointerId; ox = e.clientX; oy = e.clientY; this.stick.style.display = 'block'; this.stick.style.left = ox + 'px'; this.stick.style.top = oy + 'px'; this.knob.style.transform = ''; try { ov.setPointerCapture(id); } catch (er) { /* fine */ } e.preventDefault(); });
    ov.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return; if (Math.hypot(e.clientX - ox, e.clientY - oy) > 14) far = true; if (held()) { if (far) { const H = this.fromHorde; if (H.holdPhase === 'hold') H.spinStart(ox, oy); H.spinDrag(e.clientX, e.clientY); } return; } /* holding it: a finger circling on the screen spins it too */ if ((this.engaged || this.riding || this.bossClose) && !far) return; // in close a tap is a punch, only a real drag flies off
      const dx = Math.max(-1, Math.min(1, (e.clientX - ox) / 70)), dy = Math.max(-1, Math.min(1, (e.clientY - oy) / 70));
      this.ix = dx; this.iyRaw = dy; this.iy = this.invert ? -dy : dy; this.knob.style.transform = 'translate(' + dx * 30 + 'px,' + dy * 30 + 'px)';
    });
    const up = (e) => { if (e.pointerId !== id) return; id = null; this.ix = this.iy = this.iyRaw = 0; this.stick.style.display = 'none'; if (this.fromHorde) this.fromHorde.spinRelease(); if ((this.engaged || this.riding || this.bossClose) && !far && performance.now() - t0 < 350 && this.fromHorde) this.fromHorde.airPunch(); };
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
      if (down && (k === 'v')) this.setView(this.nextView());
      if (down && k === 'escape') { this.stop(); return; }
      if (down && (k === 'shift' || k === '+' || k === '=')) this.throttle(1);
      if (down && (k === 'control' || k === '-')) this.throttle(-1);
      if (down && !e.repeat && k === ' ') { if (this.P.hero) this.lockOn(); else this.drop(); }
      if (down && !e.repeat && k === 'q' && this.loads.length) this.cycle();
      if (down && !e.repeat && this.power) { if (k === 'q') this.power.cycle(); if (k === 'e') this.power.use(); }
      if (down && !e.repeat && k === 'i') this.setInvert(!this.invert);
      if (down && k === 'z') this.setZoom(this.zoom * 0.88); if (down && k === 'x') this.setZoom(this.zoom / 0.88);
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
  }
  // a bar under the HUD for what she is fighting
  targetBar() { const H = this.fromHorde, e = H && H.o.boss; let m = this.engaged || (H && H.heldS) || (this.lock && this.lock.machine) || null, f = -1, name = ''; if (m) { f = m.legs ? m.hp / 640 : m.hp / 60; name = m.legs ? 'TRIPOD' : 'SAUCER'; } else if (e && e.alive && (this.riding || this.bossClose || (this.lock && this.lock.worm))) { f = (e.heroHp ?? 100) / 100; name = e.type.toUpperCase(); } let el = this.tgtEl; if (f < 0) { if (el) el.style.display = 'none'; return; } if (!el || !el.isConnected) { el = this.tgtEl = document.createElement('div'); el.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(46px + env(safe-area-inset-top));width:min(58vw,240px);height:16px;border-radius:8px;background:rgba(10,8,20,.8);border:1px solid rgba(255,255,255,.35);overflow:hidden;pointer-events:none'; el.innerHTML = '<i style="display:block;height:100%;background:linear-gradient(90deg,#ff3b3b,#ffb23b)"></i><b style="position:absolute;left:0;right:0;top:1px;text-align:center;font:800 10px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000"></b>'; this.ov.appendChild(el); } el.style.display = ''; el.children[0].style.width = Math.max(0, Math.min(100, f * 100)).toFixed(0) + '%'; el.children[1].textContent = name; }
  // a big word across the top of the screen: what she would be told on foot
  bigText(text, col, T = 0.8) { if (!this.ov) return; let el = this.bigEl; if (!el || !el.isConnected) { el = this.bigEl = document.createElement('div'); el.style.cssText = 'position:absolute;left:8px;right:8px;top:calc(172px + env(safe-area-inset-top));text-align:center;font:900 30px Impact,"Arial Black",sans-serif;letter-spacing:.03em;text-shadow:0 2px 6px #000,0 0 14px rgba(0,0,0,.6);pointer-events:none;transition:opacity .2s;opacity:0'; this.ov.appendChild(el); } clearTimeout(this.bigT); el.textContent = text; el.style.color = col || '#fff'; el.style.opacity = text ? '1' : '0'; if (text) this.bigT = setTimeout(() => { el.style.opacity = '0'; }, T * 1000); }
  // the pause menu's flying options, remembered (Sean)
  viewName() { return { iso: 'Above', chase: 'Behind', cockpit: 'First person' }[this.view] || 'Above'; }
  cycleView() { const v = this.nextView(); this.viewSet = true; try { localStorage.setItem('zday_flyview', v); } catch (e) { /* no storage */ } if (this.active) this.setView(v); else this.view = v; }
  flipInvert() { this.invert = !this.invert; try { localStorage.setItem(INVERT, this.invert ? '1' : '0'); } catch (e) { /* no storage */ } if (this.active && this.invBtn) this.setInvert(this.invert, true); }
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
  // the town's view: a building between the camera and the hero (within 70 m, up to its roof) swings the view round in 0.3 rad steps
  // until she is seen, and back when it is clear (Sean: the camera moves to show the player, as in the fight test)
  swing(dt, at, b0) {
    if (this.azOff == null) { this.azOff = 0; this.azTo = 0; } if ((this.nearT = (this.nearT || 0) - dt) <= 0) { this.nearT = 0.5; const c = this.g.city, L = this.nearB = []; if (c && c.buildings) c.buildings.forEach((b, k) => { if (!c.dead[k] && Math.abs((b.x0 + b.x1) / 2 - this.pos.x) < 70 && Math.abs((b.z0 + b.z1) / 2 - this.pos.z) < 70) L.push(b); }); }
    if (this.hidden(at(b0 + this.azTo))) { let best = null; for (let k = 1; k <= 8 && best == null; k++) for (const sg of [1, -1]) { const a = this.azTo + sg * k * 0.3; if (!this.hidden(at(b0 + a))) { best = a; break; } } if (best != null) this.azTo = best; } else if (Math.abs(this.azTo) > 0.01 && !this.hidden(at(b0))) this.azTo = 0;
    this.azOff += (this.azTo - this.azOff) * Math.min(1, dt * 2.2);
  }
  hidden(c) { const hx = this.pos.x, hy = this.pos.y, hz = this.pos.z; for (const b of this.nearB || []) { for (let i = 1; i < 14; i++) { const t = i / 14, x = c.x + (hx - c.x) * t, z = c.z + (hz - c.z) * t, y = c.y + (hy - c.y) * t; if (x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5 && y < b.roofY) return true; } } return false; }
  // the views: chase (behind the plane), cockpit, and iso (the town's own lens, high and far, following the hero across the
  // miniature town: Sean). Heroes start in iso
  nextView() { return this.view === 'chase' ? 'cockpit' : this.view === 'cockpit' ? 'iso' : 'chase'; }
  setView(v) {
    this.view = v; const cam = this.ctx.camera;
    cam.fov = v === 'cockpit' ? FOV_COCKPIT * Math.max(0.35, Math.min(1.25, this.zoom || 1)) : v === 'iso' ? FOV_ISO : FOV_CHASE; cam.updateProjectionMatrix();
    this.near = v === 'cockpit' ? 0.5 : 1.5; this.obj.visible = v !== 'cockpit' && this.state === 'fly'; this.snap = true; this.ctx.post.opts.dof = v === 'iso' && !!this.active;
    SEE.on = v === 'cockpit' ? false : this.saved.see; // walls see-through only between the chase camera and the plane
    this.ov.classList.toggle('cockpit', v === 'cockpit'); this.viewBtn.textContent = v === 'chase' ? 'Cockpit' : v === 'cockpit' ? 'Iso view' : 'Chase view';
  }
  // down: back to the town as it was, the view over where the plane last was
  stop(quiet = false) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx;
    this.fromHorde = null; this.fromBase = null; this.smashing = null; this.hovering = false; this.flyBtn = null; this.smashBtn = null; this.boosting = false; this.goBase = null; this.baseBtn = null; this.markM = null; this.barH = 0; if (this.inLevel && !this.fromHorde) document.body.classList.remove('zd-flying'); this.holdY = null; this.upDown = 0; this.udEl = null; this.cvWas = null; if (this.ring) { this.ring.clearJunk(); this.ring.ui(false); this.ring = null; } this.engaged = null; this.spinHold = false; this.riding = false; this.bucked = null; this.bossClose = false; this.lock = null; this.dropInside(); this.inB = -1; this.clearShots(); if (this.power) { this.power.dispose(); this.power = null; this.powerBtn = null; } if (this.army) { this.army.dispose(); this.army = null; } if (this.getaways) { for (const G of this.getaways) G.finish(); this.getaways = []; }
    this.active = false; document.body.classList.remove('zd-flying');
    const hr = this.obj.userData.hero; g.disasters.ctx.scene.remove(this.obj); if (this.streak) { this.streak.dispose(g.disasters.ctx.scene); this.streak = null; }
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
    if (run && this.punch > 0) this.punch -= dt; // only the pose: she never stops in the air for it (Sean: no pause at a wall)
    if (run && this.state === 'fly') this.fly(dt);
    else if (run && this.state === 'tossed') this.tossStep(dt);
    else if (run && this.state === 'down' && (this.t += dt) > (this.downAt ? 1.4 : 2.6)) { if (this.downAt) this.getUp(); else { this.spawn(); this.setView(this.view); } }
    if (run && this.shots.length) this.shotStep(dt);
    if (run && this.army) this.army.step(dt);
    if (run && this.power) this.power.step(dt);
    if (run && this.getaways && this.getaways.length) { for (const G of this.getaways) G.step(dt); this.getaways = this.getaways.filter(G => !G.done); }
    // the plane where it is
    _e.set(this.roll, this.yaw, this.pitch); this.q.setFromEuler(_e);
    this.obj.position.copy(this.pos); this.obj.quaternion.copy(this.q);
    const prop = this.obj.userData.prop, burner = this.obj.userData.burner, k = (this.thr - P.min) / (P.max - P.min);
    if (prop) prop.rotation.x += dt * (40 + 50 * k);
    if (this.obj.userData.hero) this.heroPose(this.obj.userData.hero, dt);
    if (this.streak) this.streak.update(this.pos, this.state === 'tossed' || (this.state === 'fly' && !this.duel && this.speed > 55), cam, dt);
    if (burner) { burner.scale.set(0.6 + k * 0.9, 1, 1); burner.material.opacity = 0.35 + 0.55 * k; }
    // the camera: behind and above it, easing after it (no roll, so the horizon stays put), or in its seat
    _f.set(1, 0, 0).applyQuaternion(this.q);
    const cv = this.camView(); if (cv !== this.cvWas) { if (this.cvWas && this.state === 'fly') { this.g.camBlend = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, t: 0, T: 0.7 }; const keep = this.view; this.setView(cv); this.view = keep; this.snap = true; } this.cvWas = cv; }
    if (this.ring && this.state === 'fly') this.ring.cam(dt, cam, this.snap);
    else if (cv === 'cockpit' && this.state === 'fly') {
      _v.set(P.seat[0], P.seat[1], 0).applyQuaternion(this.q); cam.position.copy(this.pos).add(_v);
      cam.quaternion.copy(this.q).multiply(SEAT_TURN); cam.up.set(0, 1, 0).applyQuaternion(this.q);
    } else if (cv === 'iso' && this.state !== 'down') { // the town's lens, behind and well above the hero's heading, aimed a little ahead of them
      const arc0 = this.arcadeOn(), H1 = this.fromHorde, hd = H1 && H1.heldS, en = this.engaged, B1 = H1 && H1.o.boss, foc = !!(B1 && B1.alive && !hd && (this.hovering || this.riding || this.bucked)), wk = foc ? (this.riding ? 0.8 : 1) : hd ? (hd.legs ? 2.8 : 1.9) : en ? (en.legs ? 1.9 : 1.5) : 1; this.closeK = (this.closeK || 1) + (wk - (this.closeK || 1)) * (1 - Math.exp(-dt * 3)); this.focK = (this.focK || 0) + ((foc ? 1 : 0) - (this.focK || 0)) * (1 - Math.exp(-dt * 3)); const ck = Math.max(0, Math.min(1, (this.closeK - 1) / 0.4)), el0 = ISO_EL + (Math.min(ISO_EL, 0.42) - ISO_EL) * ck, focE = this.focE = (this.focE || 0.36) + ((this.surf || (this.pos.y < 18 && !this.riding) ? 1.2 : this.riding && B1.type === 'kaiju' ? 0.62 : 0.36) - (this.focE || 0.36)) * (1 - Math.exp(-dt * 4)), el = el0 + (focE - el0) * this.focK;
      { const fw = FOV_ISO + (36 - FOV_ISO) * this.focK; if (Math.abs(cam.fov - fw) > 0.02) { cam.fov = fw; cam.updateProjectionMatrix(); } } /* the giants (Sean): behind her with the monster always in view, which takes a wider lens than the town's */
      this.ctx.post.opts.dof = !arc0 && this.pos.y < 30 && ck === 0 && this.focK < 0.01; // high up, the whole town stays sharp to steer by
      const fl = Math.hypot(_f.x, _f.z) || 1, dist = ISO_DIST * 1.35 * this.zoom * this.closeK, ce = Math.cos(el) * dist, cy = this.pos.y + Math.sin(el) * dist; let b0 = Math.atan2(-_f.x / fl, -_f.z / fl); const arc = this.arcadeOn(); if (arc && !foc && !this.goBase) b0 = this.azF == null ? (this.azF = H1 && H1.az != null ? H1.az : b0) : this.azF; /* a fixed view: the stick means the same way on the screen, as on foot */ if (foc && this.riding && B1.type === 'kaiju') b0 = this.focB = Math.atan2(-Math.cos(B1.yaw), -Math.sin(B1.yaw)); else if (foc && this.riding) b0 = this.focB = Math.atan2(-Math.sin(B1.yaw), Math.cos(B1.yaw)); else if (foc) { const q = Math.hypot(this.pos.x - B1.x, this.pos.z - B1.z); if (q > 3) b0 = this.focB = Math.atan2(this.pos.x - B1.x, this.pos.z - B1.z); else if (this.focB != null) b0 = this.focB; } if (this.spinHold) { if (this.spinB == null) this.spinB = b0; b0 = this.spinB; } else this.spinB = null;
      if (arc) { if (this.azS == null || this.snap) this.azS = b0; const da = b0 - this.azS, st = Math.atan2(Math.sin(da), Math.cos(da)) * (1 - Math.exp(-dt * 2.6)), lim = this.goBase ? 1.5 * dt : 9; this.azS += Math.max(-lim, Math.min(lim, st)); /* flying to the base: an unhurried swing round behind her */ b0 = this.azS; }
      this.swing(dt, (a) => _u.set(this.pos.x + Math.sin(a) * ce, cy, this.pos.z + Math.cos(a) * ce), b0); _v.set(this.pos.x + Math.sin(b0 + this.azOff) * ce, cy, this.pos.z + Math.cos(b0 + this.azOff) * ce);
      if (arc) { const ff = H1 && H1.followF, k = 1 - Math.exp(-dt * (ff ? 3.5 : 2.5)); this.coX = (this.coX || 0) + ((ff ? Math.max(-130, Math.min(130, ff.x - this.pos.x)) : 0) - (this.coX || 0)) * k; this.coZ = (this.coZ || 0) + ((ff ? Math.max(-130, Math.min(130, ff.z - this.pos.z)) : 0) - (this.coZ || 0)) * k; _v.x += this.coX; _v.z += this.coZ; }
      if (this.snap || arc) cam.position.copy(_v); else cam.position.lerp(_v, 1 - Math.exp(-dt * 3)); cam.up.set(0, 1, 0); // in a level no lag at all: a narrow lens and a lag lose her off the screen
      const ah = this.hovering || this.spinHold || arc ? 0 : 8; _u.set(this.pos.x + _f.x / fl * ah + (arc ? this.coX || 0 : 0), this.pos.y + (hd ? (hd.y - this.pos.y) * 0.4 : 0), this.pos.z + _f.z / fl * ah + (arc ? this.coZ || 0 : 0)); if (B1 && this.focK > 0.001) { const onK = this.riding && B1.type === 'kaiju', tx = onK ? Math.cos(B1.yaw) * 30 : B1.x - this.pos.x, ty = onK ? 4 : (B1.type === 'worm' ? Math.max(B1.y, 0) : 18) - this.pos.y, tz = onK ? Math.sin(B1.yaw) * 30 : B1.z - this.pos.z, s = Math.min(0.5, 40 / (Math.hypot(tx, ty, tz) || 1)) * (this.riding && B1.type === 'worm' ? 0.2 : 1); _u.x += (this.pos.x + tx * s - _u.x) * this.focK; _u.y += (this.pos.y + ty * s - _u.y) * this.focK; _u.z += (this.pos.z + tz * s - _u.z) * this.focK; } cam.lookAt(_u); // floating: she is in the middle of the view
    } else {
      const fl = Math.hypot(_f.x, _f.z) || 1, back = P.chase[0] * this.zoom, hi = P.chase[1] * Math.pow(this.zoom, 0.8);
      _v.set(this.pos.x - _f.x / fl * back, this.pos.y + hi - _f.y * back * 0.5, this.pos.z - _f.z / fl * back);
      if (this.state === 'down') _v.copy(this.at).add(_u.set(this.downAt ? -16 : -30, this.downAt ? 12 : 22, this.downAt ? -16 : -30)); // watching the wreck burn (or the hero getting up)
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
      const th = this.threat, hull = Math.max(0, Math.round(this.hull / (this.hullMax || 100) * 100)), L = this.lock;
      this.targetBar(); if (this.lockBtn) this.lockBtn.classList.toggle('grabnow', !!this.lockHint && !this.lock && !this.ring && !this.engaged && !this.bossClose);
      this.hud.textContent = (P.hero ? HS.disp(P.hero) : P.name).toUpperCase() + ' · ' + (this.arcadeOn() ? (this.fromHorde && !this.fromHorde.o.boss ? this.fromHorde.left + ' left · ' : '') : Math.round(this.speed * KMH) + ' km/h · ' + Math.max(0, Math.round(this.pos.y)) + ' m · ') + (P.hero ? 'health ' : 'hull ') + hull + '%' + (this.P.gun ? ' · gun ' + (this.reload > 0 ? 'reloading' : this.ammo) : '') +
        (L ? '\nLOCKED ON ' + L.name.toUpperCase() + ' ' + Math.round(Math.hypot(L.x - this.pos.x, L.z - this.pos.z)) + ' m' : th && th.d < 600 ? '\n' + th.name.toUpperCase() + ' ' + Math.max(0, Math.round(th.d)) + ' m' : '') + (LAB.on && P.hero ? '\n' + LAB.line() : '');
      this.hud.style.color = hull < 35 ? '#ff8a7a' : th && th.d < 60 ? '#ffd27a' : '#fff';
      document.body.style.setProperty('--zd-hud-end', Math.round(this.hud.getBoundingClientRect().bottom + 6) + 'px'); // the fight's panel sits under the HUD, however tall it is (the lab's lines)
      if (this.state === 'fly' && this.hull < 60) g.fire.spray(this.pos.x - _f.x * 3, this.pos.z - _f.z * 3, this.pos.y, this.hull < 30 ? 4 : 2, 1, 2.2); // smoke off a hurt plane
      if (g.audio) g.audio.engine(this.state === 'fly' ? this.P.sound : null, k);
      if (this.dropBtn) { this.dropBtn.textContent = this.seedT > 0 ? 'Seeding' : 'Drop'; this.dropBtn.classList.toggle('wait', this.coolT > 0 || this.seedT > 0 || this.state !== 'fly'); }
      if (this.tipEl && this.bar && this.arcadeOn()) { const bh = this.bar.offsetHeight; if (bh !== this.barH) { this.barH = bh; this.tipEl.style.bottom = 'calc(' + (bh + 18) + 'px + env(safe-area-inset-bottom))'; } }
      if (this.arcadeOn() && !this.markM) { const m = this.markM = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.42, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.6, 0.7), transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.renderOrder = 9; m.position.y = 0.2; this.obj.add(m); } if (this.markM) this.markM.visible = this.camView() !== 'cockpit';
      if (this.smashBtn && this.fromHorde) { const lb = this.fromHorde.airLabel(), now = lb.includes('GRAB IT'); this.smashBtn.innerHTML = lb; this.smashBtn.classList.toggle('grabnow', now); if (now && !this.grabWas) this.bigText('GRAB IT!', '#ffe27a', 1.4); this.grabWas = now; }
      if (this.baseBtn) this.baseBtn.innerHTML = this.goBase ? '\u2716 STOP' : this.inLair() ? '\uD83D\uDC80 LAIR' : '\uD83C\uDFE0 BASE';
      if (this.flyBtn && this.udEl) { const off = this.ring || this.riding; this.flyBtn.style.display = off ? '' : 'none'; this.udEl.style.display = off ? 'none' : 'flex'; }
      if (this.flyBtn) this.flyBtn.innerHTML = this.ring ? '\u2708 LEAVE' : this.riding ? '\u2708 JUMP OFF' : this.hovering ? '\u2708 FLY' : '\u23F8 HOVER';
      if (this.lockBtn) { this.lockBtn.textContent = this.lock ? 'Let go of the lock' : '\uD83C\uDFAF Lock on'; this.lockBtn.classList.toggle('on', !!this.lock); this.bar.style.visibility = ''; }
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
    if (this.smashing) { const Q = this.smashing; if (Q.to) { const k = Math.min(1, dt * 5); this.pos.x += (Q.to[0] - this.pos.x) * k; this.pos.z += (Q.to[1] - this.pos.z) * k; } /* over a roof: she comes down to the street beside it, not through it and across */ const gy = this.g.people.groundY(this.pos.x, this.pos.z); this.pos.y -= Q.sp * dt; this.pitch = Q.smash ? -1.4 : 0; this.speed = 0; this.obj.position.copy(this.pos); if (this.pos.y <= gy + 1.2) { this.smashing = null; this.landHorde(Q.smash, true); } return; }
    if (this.ring) { this.ring.step(dt); return; }
    if ((this.riding || this.bucked) && this.fromHorde) { this.fromHorde.rideAir(dt); return; } // on the worm's back, or thrown off it
    if (this.arcadeOn()) { this.arcT = this.arcT || 0; if (this.lock && this.homeIn(dt)) { this.arcGap = true; return; } this.arcade(dt); return; }
    if (this.hovering) { if (Math.abs(this.ix) + Math.abs(this.iy) > 0.15 || K.has('arrowleft') || K.has('arrowright') || K.has('arrowup') || K.has('arrowdown')) this.unhover(); else { this.thr = 0; this.speed = 0; } } // floating in one spot till a finger or a button says go // the smash landing: straight down at 70 m/s
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
    if (far > 450 && !this.fromBase) {
      const want = Math.atan2(-(cz - this.pos.z), cx - this.pos.x); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 0.8);
      if (!this.saidFar) { this.saidFar = true; this.tip('Turning back toward town'); }
    } else if (far < 300) this.saidFar = false;
    // speed: toward the throttle, faster in a dive, slower climbing
    this.speed += ((this.boosting ? P.max * 1.2 : this.thr) - this.speed) * Math.min(1, dt * (this.boosting ? 3 : 0.8)) - (P.hero ? 0 : Math.sin(this.pitch) * 9.8 * 0.6 * dt); // a hero climbs as fast as they dive
    this.speed = this.hovering ? 0 : Math.max(P.min * 0.7, Math.min(P.max * 1.25, this.speed));
    _e.set(this.roll, this.yaw, this.pitch); _q.setFromEuler(_e); _f.set(1, 0, 0).applyQuaternion(_q);
    const px = this.pos.x, py = this.pos.y, pz = this.pos.z; // where it was: a hero ploughs through what lies between
    this.pos.addScaledVector(_f, this.speed * dt);
    this.hazards(dt); if (this.state !== 'fly' || this.caught) return;
    // low over the streets, people duck
    if (this.pos.y < 35 && (this.scareT = (this.scareT || 0) - dt) <= 0) { this.scareT = 0.5; g.people.scare(this.pos.x, this.pos.z, 30, 0.4); }
    // into the ground, or a building
    const x = this.pos.x, y = this.pos.y, z = this.pos.z;
    if (P.hero) { // skims the ground; goes straight through a building and brings it down (plough)
      if (y < 2.4) { this.pos.y = 2.4; if (this.pitch < 0) this.pitch *= 0.3; }
      this.plough(px, py, pz);
      return;
    }
    if (y < 1.2) { this.crash(-1); return; }
    let hit = -1; g.city.buildingsNear(x, z, 2.5, (k, d, b) => { if (hit < 0 && y < b.roofY + 0.4) hit = k; });
    if (hit >= 0) this.crash(hit);
  }
  crash(k, why) {
    if (this.state !== 'fly') return;
    this.goBase = null;
    const g = this.g, f = g.fire, x = this.pos.x, y = Math.max(1, this.pos.y), z = this.pos.z;
    this.state = 'down'; this.t = 0; this.obj.visible = false; this.at.set(x, y, z); this.caught = null; this.hull = 0; this.lock = null; this.inB = -1; this.dropInside(); this.downAt = false; this.clearShots();
    if (this.g.audio) this.g.audio.engine(null);
    if (this.P.hero) { f.dustCloud(x, z, 6, Math.min(20, y + 4)); sfx('thud', x, y, z, { gain: 1 }); this.tip((why || 'You were knocked out of the sky!') + ' Back up in a moment'); return; } // knocked down, no fireball
    f.burst(x, y, z, 16, 2.4); f.burst(x, y + 2, z, 10, 1.6);
    if (k >= 0) f.igniteBuilding(k);
    sfx('boom', x, y, z, { gain: 0.8 }); g.shake = Math.max(g.shake || 0, 0.25);
    this.tip((why || (k >= 0 ? 'You flew into a building!' : 'You crashed!')) + ' Back in the air in a moment');
  }
  // hurt: the hull down by n (at nothing it goes down, why the reason), told once in a while
  damage(n, why) {
    if (this.state !== 'fly' && this.state !== 'tossed') return;
    this.hull -= n; LAB.stats.taken += n; if (this.hull <= 0) { this.crash(-1, why); return; }
    if ((this.hurtT || 0) < this.t2) { this.hurtT = this.t2 + 1.5; this.tip(why + (this.P.hero ? ' Health ' : ' Hull ') + Math.round(this.hull / (this.hullMax || 100) * 100) + '%'); sfx('crash', this.pos.x, this.pos.y, this.pos.z, { gain: 0.4, rate: 1.3 }); }
  }
  // the hero thrown (a villain's grab, heroduel.js): tumbling along, through whatever is in the way, down into the street,
  // then up again where they fell
  hurl(vx, vy, vz, why) {
    if (this.state !== 'fly') return;
    this.state = 'tossed'; this.vel = new THREE.Vector3(vx, vy, vz); this.lock = null; this.speed = Math.hypot(vx, vz); this.act = { kind: 'dive', t: 0, T: 1e9 }; this.obj.visible = this.view !== 'cockpit'; this.t = 0;
    if (why) this.tip(why);
  }
  tossStep(dt) {
    const V = this.vel, g = this.g, px = this.pos.x, py = this.pos.y, pz = this.pos.z; V.y -= 22 * dt; this.t += dt;
    this.pos.addScaledVector(V, dt); this.yaw = Math.atan2(-V.z, V.x); this.roll += dt * 7; this.pitch = Math.atan2(V.y, Math.hypot(V.x, V.z)) * 0.5;
    this.plough(px, py, pz);
    const gy = Math.max(2.4, g.people.groundY(this.pos.x, this.pos.z) + 2.4);
    if (this.pos.y <= gy || this.t > 6) { // down in the street
      this.pos.y = gy; const x = this.pos.x, z = this.pos.z;
      g.disasters.decals.add('crack', x, z, 8, 8); g.fire.dustCloud(x, z, 5, 5); g.fire.burst(x, 0.5, z, 10, 1.6); sfx('thud', x, gy, z, { gain: 1.2, rate: 0.7 }); g.shake = Math.max(g.shake || 0, 0.5);
      LAB.stats.scared += g.people.scare(x, z, 14, 0.9); this.dropInside(); this.inB = -1;
      this.state = 'down'; this.t = 0; this.at.set(x, gy, z); this.downAt = true; this.roll = 0; this.act = null;
    }
  }
  getUp() { // back on their feet, flying low, slow, nose up
    this.state = 'fly'; this.downAt = false; this.pos.copy(this.at); this.pos.y = Math.max(this.pos.y, 2.4) + 0.5; this.speed = this.thr = Math.max(this.P.min, this.P.start * 0.5); this.pitch = 0.4; this.roll = 0; this.yaw += Math.PI; this.obj.visible = this.view !== 'cockpit'; this.caught = null;
    this.tip('Back up! Press Lock on to go after them'); if (this.g.audio) this.g.audio.engine(this.P.sound, 0.3);
  }
  // shots at a hero flying in: a villain locked on from 30 to 220 m away throws something every couple of seconds, aimed
  // a little ahead; the stick weaves the hero out of its way (homeIn); one that lands hurts and knocks them about
  shoot(v) {
    const S = SHOT[v.name] || SHOT.Tyrant, g = this.g, m = new THREE.Mesh(S.r > 1 ? SHOT_BOX : SHOT_GEO, new THREE.MeshBasicMaterial({ color: S.col, transparent: !!S.glow, opacity: S.glow ? 0.9 : 1 }));
    if (S.r <= 1) m.scale.setScalar(S.r); m.position.set(v.x, (v.y || 0) + 3, v.z); g.disasters.ctx.scene.add(m);
    _f.set(1, 0, 0).applyQuaternion(this.q); const lead = 0.5, tx = this.pos.x + _f.x * this.speed * lead, ty = this.pos.y + _f.y * this.speed * lead, tz = this.pos.z + _f.z * this.speed * lead;
    const d = Math.hypot(tx - m.position.x, ty - m.position.y, tz - m.position.z) || 1, sp = 72;
    this.shots.push({ o: m, v: new THREE.Vector3((tx - m.position.x) / d * sp, (ty - m.position.y) / d * sp, (tz - m.position.z) / d * sp), t: 0, by: v.name, glow: !!S.glow });
    sfx(S.glow ? 'zap' : 'whoosh', v.x, v.y, v.z, { gain: 0.8 });
    if (!this.saidShot) { this.saidShot = true; this.tip(v.name + ' is throwing things at you! Drag left or right to weave'); }
  }
  shotStep(dt) {
    const g = this.g;
    for (const s of this.shots) {
      s.t += dt; s.o.position.addScaledVector(s.v, dt); s.o.rotation.x += dt * 6; s.o.rotation.z += dt * 4;
      if (s.glow && Math.random() < 0.5) g.fire.burst(s.o.position.x, s.o.position.y, s.o.position.z, 1, 0.7);
      if (this.state === 'fly' && s.o.position.distanceTo(this.pos) < 3.6) { s.done = true; g.fire.burst(this.pos.x, this.pos.y + 1, this.pos.z, 10, 1.6); this.damage(LAB.villainHit(8), s.by + ' hit you!'); this.roll += (Math.random() < 0.5 ? -1 : 1) * 1.2; this.pitch -= 0.3; g.shake = Math.max(g.shake || 0, 0.35); }
      else if (s.t > 3.5 || s.o.position.y < 0) s.done = true;
    }
    if (this.shots.some(s => s.done)) { for (const s of this.shots) if (s.done) { g.disasters.ctx.scene.remove(s.o); s.o.material.dispose(); } this.shots = this.shots.filter(s => !s.done); }
  }
  clearShots() { if (this.shots) for (const s of this.shots) { this.g.disasters.ctx.scene.remove(s.o); s.o.material.dispose(); } this.shots = []; }
  getaway(v) { (this.getaways = this.getaways || []).push(new Getaway(this.g.disasters.ctx.scene, v)); }
  // a hero goes straight through buildings (Sean): in through one wall in a spray of glass and brick, out through the far
  // one, and the building comes down behind them, leaning the way they went; a low one may go up in a fireball first (a
  // tall tower never does: it only falls, in its dust). Checked every 2 m along the way since the last frame, so a fast
  // hero on a slow phone can't skip a small one. Everyone inside gets out first (spare)
  plough(px, py, pz) {
    const city = this.g.city, x = this.pos.x, y = this.pos.y, z = this.pos.z, n = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 2));
    for (let i = 1; i <= n; i++) {
      const sx = px + (x - px) * i / n, sy = py + (y - py) * i / n, sz = pz + (z - pz) * i / n;
      let inK = -1; city.buildingsNear(sx, sz, 0.6, (k, d, b) => { if (inK < 0 && sy < b.roofY + 0.8) inK = k; });
      if (inK === this.inB) { if (inK >= 0 && this.inside) this.inside.step(sx, sy, sz, Math.cos(this.yaw), -Math.sin(this.yaw)); continue; }
      if (this.inB >= 0) this.burstOut(this.inB, sx, sy, sz);
      if (inK >= 0) this.burstIn(inK, sx, sy, sz);
      this.inB = inK;
    }
  }
  // the pieces kept small (under about a metre): the chase camera is close, and big ones flying past filled a phone's screen
  burstIn(k, x, y, z) {
    const g = this.g, b = g.city.buildings[k], fx = Math.cos(this.yaw), fz = -Math.sin(this.yaw), col = wallHex(b);
    for (let i = 0; i < 18; i++) { const s = 0.3 + Math.random() * 0.7, v = 4 + Math.random() * 8, r = Math.random(); g.disasters.debris.add(x, y + (Math.random() - 0.5) * 3, z, s, s * 0.6, s, r < 0.5 ? col : r < 0.75 ? 0xeefcff : 0x8a8478, 'fly', { v: [-fx * v + (Math.random() - 0.5) * 7, 1 + Math.random() * 5, -fz * v + (Math.random() - 0.5) * 7] }); } // back out of the hole, toward the camera
    g.fire.dustCloud(x, z, 4, Math.min(b.top - b.baseY, y + 5));
    this.dropInside(); this.inside = new Interior(g.disasters, k, x, y, z, fx, fz); this.inside.step(x, y, z, fx, fz); // its floors and furniture, from here on (interior.js)
    sfx('crash', x, y, z, { gain: 0.9 }); sfx('glass', x, y, z, { gain: 0.6 });
    this.punch = 0.4; g.shake = Math.max(g.shake || 0, 0.2);
    LAB.stats.scared += g.people.scare(x, z, 25, 0.8);
  }
  burstOut(k, x, y, z) {
    const g = this.g, D = g.disasters, b = g.city.buildings[k]; if (g.city.dead[k]) return;
    const fx = Math.cos(this.yaw), fz = -Math.sin(this.yaw), hgt = b.top - b.baseY, col = wallHex(b), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, d = b.z1 - b.z0;
    D.blowWindows(k, fx, fz, 1.2);
    for (let i = 0; i < 22; i++) { const s = 0.35 + Math.random() * 0.9, v = 8 + Math.random() * 12; D.debris.add(x, y + (Math.random() - 0.5) * 3, z, s, s * 0.6, s, Math.random() < 0.65 ? col : 0x8a8478, 'fly', { v: [fx * v + (Math.random() - 0.5) * 6, 1 + Math.random() * 6, fz * v + (Math.random() - 0.5) * 6] }); } // out ahead of the hero
    sfx('crash', x, y, z, { gain: 1, rate: 0.8 }); g.shake = Math.max(g.shake || 0, 0.45);
    if (hgt < 30 && Math.random() < 0.4) { // a low one blows up
      for (let i = 0; i < 6; i++) g.fire.burst(cx + (Math.random() - 0.5) * w * 0.7, b.baseY + hgt * (0.2 + Math.random() * 0.6), cz + (Math.random() - 0.5) * d * 0.7, 16, 2.6 + Math.random());
      for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, s = 0.4 + Math.random() * 1.0, v = 10 + Math.random() * 14; D.debris.add(cx, b.baseY + hgt * (0.3 + Math.random() * 0.5), cz, s, s * 0.6, s, Math.random() < 0.6 ? col : 0x3a3430, 'fly', { v: [Math.cos(a) * v, 4 + Math.random() * 10, Math.sin(a) * v] }); }
      sfx('boomBig', cx, b.baseY + hgt * 0.5, cz, { gain: 0.9 }); g.shake = Math.max(g.shake, 0.9);
      LAB.stats.scared += g.people.scare(cx, cz, 60, 1);
    }
    const shell = this.inside && this.inside.k === k ? this.inside.take() : null; this.inside = null; LAB.stats.buildings++;
    D.destroyBuilding(k, 'collapse', { dir: Math.atan2(-fx, fz), spare: true, noCrush: true, shell }); // leaning over the way the hero went, floors and all
  }
  // the inside of a building the hero never came out of (knocked down in it, landed): it comes down anyway
  dropInside() { const I = this.inside; this.inside = null; if (I && I.alive && !this.g.city.dead[I.k]) this.g.disasters.destroyBuilding(I.k, 'collapse', { spare: true, noCrush: true, shell: I.take() }); }
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
    for (const th of this.thrown) { th.t += h; const o = th.o.position; if (this.state === 'fly' && o.distanceTo(this.pos) < 7) { th.done = true; this.g.fire.burst(o.x, o.y, o.z, 10, 2); this.damage(this.fromHorde ? 15 : 60, 'A car the kaiju threw hit you!'); } else if (th.t > 6 || o.y < 3) th.done = true; }
    if (this.thrown.some(th => th.done)) this.thrown = this.thrown.filter(th => !th.done);
  }
  // a tornado: within reach of its funnel (wider the higher up, and leaning with it) the plane is drawn in and round and
  // shaken; into the funnel itself and it is caught. Over the top of it, nothing. A seeding run notes how close it came
  twister(tw, h) {
    if (tw.descend < 0.5 || tw.fade < 0.5) return; // still coming down out of the cloud, or gone
    const p = this.pos, k = Math.pow(Math.max(0, Math.min(1, p.y / tw.H)), 1.5), ax = tw.x + (tw.vort.lx || 0) * k, az = tw.z + (tw.vort.lz || 0) * k;
    const dx = p.x - ax, dz = p.z - az, d = Math.hypot(dx, dz) || 0.01, r = tw.radiusAt(Math.min(p.y, tw.H)), reach = r * 4 + 70;
    this.note('tornado', d - r);
    if (this.storyTornado()) { if (d < r + 12 && p.y < tw.H) { const e = this.g.disasters.list.find(q => q.tw === tw); if (e) { const G = WindGame.thrownFrom(this, e); G.a = Math.atan2(dz, dx); G.th.vx = Math.cos(G.a) * 46; G.th.vz = Math.sin(G.a) * 46; this.ring = G; } } return; }
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
    if (this.fromHorde && (this.riding || this.bucked || this.bossClose)) return;
    if (d < 48 && p.y < 80) {
      if (!this.saidTent) { this.saidTent = true; this.tip('Too close! Its tentacles are reaching for you'); }
      if (d < 30 && p.y < 65 && this.fromHorde) { if (Math.random() < h * 1.5) this.fromHorde.swat(); return; } if (d < 30 && p.y < 65 && Math.random() < h * 2.5) { this.crash(-1, this.P.hero ? 'A tentacle swatted you out of the air!' : 'A tentacle snatched your plane out of the air!'); return; }
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
      if (this.P.hero && !v.tossed && !v.gripped && d < 12 && (v.hitT || 0) < this.t2) { v.hitT = this.t2 + 2.5; this.g.shake = Math.max(this.g.shake || 0, 0.3); this.damage(LAB.villainHit(6), v.name + ' hit you!'); }
      if (this.P.hero && v === this.lock && !v.tossed && !v.gripped && d > 30 && d < 220) { if ((v.shotT = (v.shotT ?? 1.2) - h) <= 0) { v.shotT = Math.max(1, 2.6 - 0.06 * LAB.villain); this.shoot(v); } } // throwing things at a hero flying in
    }
  }
  // Lock on (a hero): the nearest villain still up, and the hero flies straight at them (homeIn); pressed again, the lock let go
  lockOn(v, again = false) {
    if (this.state !== 'fly' || this.riding || this.bucked || this.ring) return;
    this.lockHint = false; if (this.goBase) this.baseStop();
    if (!v && this.storyTornado()) { this.ring = new WindGame(this, this.storyTornado()); return; }
    if (this.lock && !again) { this.lock = null; this.tip('Lock let go: flying free'); return; }
    if (this.fromBase) { this.tip('Nothing to lock on in the base; Land to come down'); return; }
    if (this.fromHorde && this.fromHorde.o.boss && !v) { const e = this.fromHorde.o.boss; if (e.type === 'worm' || e.type === 'kaiju') { this.bossClose = false; this.lock = { worm: e, name: 'it', get x() { return e.x; }, get z() { return e.z; }, get y() { return e.type === 'kaiju' ? 44 : Math.max(e.y, 6); }, get gone() { return !e.alive; } }; this.tip('Locked on! Straight at it'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 }); return; } this.lock = { zombie: -1, name: 'it', get x() { return e.x; }, get z() { return e.z; }, y: 0, get gone() { return !e.alive; } }; this.tip('Locked on! Straight at it, down to fight; or SMASH LAND'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 }); return; }
    if (this.fromHorde && !v && this.fromHorde.nearGen(this.pos.x, this.pos.z, 240)) { const q0 = this.fromHorde.nearGen(this.pos.x, this.pos.z, 240); this.engaged = null; this.bossClose = false; this.lock = { gen: q0, name: 'it', get x() { return q0.x; }, get z() { return q0.z; }, get y() { return q0.y; }, get gone() { return q0.gone; } }; this.tip('Locked on the general! Straight at it'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 }); return; }
    if (this.fromHorde && !v) { const H = this.fromHorde, P = this.g.people; let bj = -1, bd = 1e9; for (const j of H.ids) { if (!H.isT(j)) continue; const d2 = (P.x[j] - this.pos.x) ** 2 + (P.z[j] - this.pos.z) ** 2; if (d2 < bd) { bd = d2; bj = j; } } const mc = H.nearMachine(this.pos.x, this.pos.y, this.pos.z, 1e9); if (mc) { /* in the air, the machines first; LAND is for the ground */ const m = mc.m; this.engaged = null; this.lock = { machine: m, name: 'it', get x() { return m.legs ? (m.legs[0].fx + m.x) / 2 : m.x; }, get z() { return m.legs ? (m.legs[0].fz + m.z) / 2 : m.z; }, get y() { return m.legs ? 26 : m.y; }, get gone() { return !H.machineUp(m); } }; this.tip('Locked on! Straight at it'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 }); return; } if (bj < 0) { this.tip('Nothing left to lock on'); return; } this.lock = { zombie: bj, name: 'a zombie', get x() { return P.x[bj]; }, get z() { return P.z[bj]; }, get y() { return P.y[bj]; }, get gone() { return !H.isT(bj); } }; this.tip(H.o.types ? 'Down to the street: finish them!' : 'Locked on a zombie! Straight at it, down to fight; or SMASH LAND'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 }); return; } // up from the street fight: the nearest zombie within a block
    if (!v) { let bd = 1e9; for (const e of this.g.disasters.list) if (e.alive && e.type === 'villains') for (const w of e.who) { if (w.gone || w.beaten) continue; const d = Math.hypot(w.x - this.pos.x, w.z - this.pos.z); if (d < bd) { bd = d; v = w; } } }
    if (!v || v.gone || v.beaten) { const B = this.g.city.bounds; this.lock = null; this.g.disasters.start('villains', (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2); this.tip('More villains are coming! Press Lock on again'); return; } // all beaten: three more
    this.lock = v; this.tip('Locked on ' + v.name + '! Flying straight at them'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 0.9 });
  }
  // the level's tornado, on the defending side (windgame.js)
  storyTornado() { if (!this.heroGame || !this.inLevel || this.fromHorde || !this.g.mode || this.g.mode.side !== 'hero') return null; return this.g.disasters.list.find(e => e.alive && e.type === 'tornado' && e.tw && e.tw.phase !== 'rope') || null; }
  // a story level: the arcade way (Sean). A finger on the screen and she goes that way on the screen, as on foot, faster the further it is pushed; let go and she stops and hovers. Her height looks after itself over the roofs; the arrows on the bar go up and down. Behind and first person, only for getting around: left and right turn, up and down climb and dive (Invert)
  arcadeOn() { return !!(this.P && this.P.hero && this.heroGame && (this.fromHorde || this.inLevel) && !this.fromBase); }
  fightCam() { const H = this.fromHorde; return !!(this.engaged || this.bossClose || this.riding || this.bucked || this.ring || this.smashing || (H && H.heldS) || (this.lock && (this.lock.machine || this.lock.worm || this.lock.gen))); }
  camView() { return this.fightCam() ? 'iso' : this.view; }
  arcade(dt) {
    const g = this.g, P = this.P, K = this.keys, cv = this.camView(); let ix = this.ix || 0, iy = this.iyRaw || 0; if (K.has('arrowleft') || K.has('a')) ix = -1; if (K.has('arrowright') || K.has('d')) ix = 1; if (K.has('arrowup') || K.has('w')) iy = -1; if (K.has('arrowdown') || K.has('s')) iy = 1;
    const mag = Math.min(1, Math.hypot(ix, iy)), on = mag > 0.15, slamming = this.fromHorde && this.fromHorde.holdPhase === 'smash', close = this.engaged || this.bossClose || slamming; /* a smash moves her itself: her held height must not pull against it */ if (on && (this.engaged || this.bossClose) && !g.flight.spinHold) { this.engaged = null; this.bossClose = false; }
    let want = 0, vert = 0, turn = 0; if (this.goBase && mag > 0.35) { this.baseStop(); this.tip('Staying out here'); }
    const GB = this.goBase ? this.baseRun(dt) : null; if (!this.active || this.state !== 'fly') return; if (GB) { want = GB.want; turn = GB.turn; }
    else if (on && !(this.fromHorde && this.fromHorde.heldS && this.fromHorde.holdPhase !== 'hold')) { this.hovering = false;
      if (cv === 'iso') { const a = this.azS == null ? 0.7 : this.azS, fx = -Math.sin(a), fz = -Math.cos(a), rx = -fz, rz = fx, dx = fx * -iy + rx * ix, dz = fz * -iy + rz * ix; let da = Math.atan2(-dz, dx) - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); turn = Math.max(-1, Math.min(1, da)); this.yaw += Math.max(-3.6 * dt, Math.min(3.6 * dt, da)); want = P.max * (0.2 + 0.32 * mag); } /* the town is small: about 37 m/s at most, BOOST for more */
      else { turn = -ix * 0.35; this.yaw -= ix * 1.4 * dt; vert = (this.invert ? iy : -iy) * 30; want = P.max * 0.5; } }
    if (this.boosting && !GB) { this.hovering = false; want = P.max * 1.25; }
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * (want > this.speed ? 3.5 : 6))); if (!on && !this.boosting && this.speed < 1.5) { this.speed = 0; this.hovering = true; } this.thr = this.speed;
    // far out of town: pushed back
    const B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, dc = Math.hypot(this.pos.x - cx, this.pos.z - cz) || 1, far = dc - Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.5; if (far > 40 && !this.goBase && this.speed > 2) { const k = Math.min(1, (far - 40) / 40) * Math.max(this.speed, 10) * dt * 1.1; this.pos.x += (cx - this.pos.x) / dc * k; this.pos.z += (cz - this.pos.z) / dc * k; if (!this.saidFar) { this.saidFar = true; this.tip('That is the edge of town'); } } else if (far < 20) this.saidFar = false;
    const px = this.pos.x, py = this.pos.y, pz = this.pos.z, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); this.pos.x += cy * this.speed * dt; this.pos.z -= sy * this.speed * dt;
    // height: where she was put, up over any roof near or just ahead
    if (this.arcGap || this.holdY == null) { if (this.holdTo != null) this.climbT = 0; this.holdY = this.holdTo != null ? this.holdTo : this.pos.y; this.holdTo = null; this.arcGap = false; }
    if (close) { this.holdY = this.pos.y; } else { this.holdY = Math.max(4, Math.min(CEIL, this.holdY + ((this.upDown || 0) * 30 + vert) * dt)); let top = 0; const look = (x, z, r) => g.city.buildingsNear(x, z, r, (k, d, b) => { if (b.top > top) top = b.top; }); look(this.pos.x, this.pos.z, 7); if (this.speed > 4) look(this.pos.x + cy * this.speed * 0.5, this.pos.z - sy * this.speed * 0.5, 7); const to = top > 0 ? Math.max(this.holdY, top + 5) : this.holdY, cl = this.climbT == null ? 1 : Math.min(1, (this.climbT += dt)), vy = Math.max(-34, Math.min(6 + 44 * cl * cl, (to - this.pos.y) * (to > this.pos.y ? 6 : 2.4))); /* off the ground she builds up to it, or she is gone from the frame before the camera follows */ this.pos.y += vy * dt; this.pitch += (Math.max(-0.5, Math.min(0.5, vy * 0.015)) - this.pitch) * Math.min(1, dt * 5); }
    this.roll += (-turn * 0.7 - this.roll) * Math.min(1, dt * 6);
    this.hazards(dt); if (this.state !== 'fly' || this.caught) return;
    if (this.pos.y < 35 && this.speed > 4 && (this.scareT = (this.scareT || 0) - dt) <= 0) { this.scareT = 0.5; g.people.scare(this.pos.x, this.pos.z, 30, 0.4); }
    if (this.pos.y < 2.4) this.pos.y = 2.4; this.plough(px, py, pz); this.obj.position.copy(this.pos);
  }
  baseGo() { this.lockHint = false; if (this.fightCam() || this.riding) { const c0 = this.ctx.camera; this.g.camBlend = { pos: c0.position.clone(), quat: c0.quaternion.clone(), fov: c0.fov, t: 0, T: 0.7 }; } const B = this.g.base, door = this.baseDoor(), top = new THREE.Box3().setFromObject(B.ext).max.y; this.hovering = false; this.goBase = { t: 0, near: Math.hypot(door[0] - this.pos.x, door[1] - this.pos.z) < 55, cruise: Math.min(CEIL, Math.max(this.pos.y, 62, top + 14)) }; this.holdY = this.goBase.cruise; this.climbT = 0.6; this.tip(this.inLair() ? 'Flying to the lair. Drag, or STOP, to stay out here' : 'Flying to the base. Drag, or BASE again, to stop'); sfx('whoosh', this.pos.x, this.pos.y, this.pos.z, { gain: 1.1, rate: 0.8 }); }
  // the LAIR button in Destroy and the BASE button in Defend's flying levels (Sean): the same flight to the door as in the horde's levels; the level goes on outside
  inLair() { return !!(this.inLevel && !this.fromHorde && this.owner && this.owner.side === 'villain'); }
  toLair() { if (this.state !== 'fly') return; if (this.goBase) { this.baseStop(); this.tip('Staying out here'); return; } if (this.ring) this.ring.end(); this.engaged = null; this.bossClose = false; this.lock = null; if (!this.g.base.placed) this.g.base.place(); this.baseGo(); }
  baseStop() { this.goBase = null; this.boosting = false; this.holdY = this.pos.y; if (this.speed < 1) this.hovering = true; }
  baseDoor() { const B = this.g.base; return [B.x, B.z + (B.S ? B.S.d : 24) / 2 + 8]; }
  // this frame's run: round to the front of the base at full boost, then down to the door
  baseRun(dt) { const Q = this.goBase, P = this.P, door = this.baseDoor(), gy = this.g.people.groundY(door[0], door[1]); Q.t += dt; this.hovering = false; if (!Q.near && Math.hypot(door[0] - this.pos.x, door[1] + 40 - this.pos.z) < 28) Q.near = true; const ax = door[0], az = door[1] + (Q.near ? 0 : 40), dx = ax - this.pos.x, dz = az - this.pos.z, d = Math.hypot(dx, dz) || 0.01; let da = Math.atan2(-dz, dx) - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (d > 2) this.yaw += Math.max(-4.5 * dt, Math.min(4.5 * dt, da)); this.holdY = Q.near ? gy + 4 : Q.cruise; if ((Q.near && d < 7 && this.pos.y < gy + 11) || Q.t > 16) { (this.fromHorde || this.owner).baseArrive(); return null; } const want = Q.near ? d * 1.3 + 7 : Math.min(P.max * 1.6, d * 2 + 30); this.boosting = want > P.max * 0.9; return { want, turn: Math.max(-1, Math.min(1, da)) }; }
  // the bar's up and down: held, she goes up or down; in the cell where FLY was
  addUpDown(row, before) { const w = this.udEl = document.createElement('div'); w.style.cssText = 'flex:1 1 0;min-width:0;display:flex;gap:3px'; const mk = (t, v, attr) => { const q = document.createElement('button'); q.type = 'button'; q.className = 'zd-btn lock'; q.setAttribute(attr, ''); q.style.cssText = 'padding:14px 0;font-size:15px;touch-action:none'; q.textContent = t; const on = (e) => { e.preventDefault(); e.stopPropagation(); try { q.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } this.upDown = v; }, off = () => { this.upDown = 0; }; q.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) q.addEventListener(ev, off); q.addEventListener('click', (e) => e.stopPropagation()); w.appendChild(q); }; mk('\u25B2', 1, 'data-up'); mk('\u25BC', -1, 'data-down'); row.insertBefore(w, before); }
  unhover() { if (this.ring) this.ring.end(); this.engaged = null; this.bossClose = false; if (this.riding && this.fromHorde) this.fromHorde.rideEnd(); this.hovering = false; this.thr = this.speed = Math.max(this.P.start || 30, 20); }
  // back onto the base's floor (base.js land) from a flight round its hall
  landBase() { const Bs = this.fromBase; if (!Bs || this.state !== 'fly') return; this.fromBase = null; const x = this.pos.x, z = this.pos.z, cam = this.ctx.camera; this.g.camBlend = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, t: 0, T: 1.0 }; this.stop(true); Bs.land(x, z); }
  // back down into the street fight she took off from (horde.js land): a plain landing where she is, or the smash: straight down first, a shockwave where she lands
  landHorde(smash, now) { const H = this.fromHorde; if (!H || this.state !== 'fly') return; if (!now) { if (this.smashing) return; if (this.goBase) this.baseStop(); if (this.riding) H.rideEnd(); this.bucked = null; this.bossClose = false; this.smashing = { sp: smash ? 70 : 32, smash, to: this.g.people.snapWalkable(this.pos.x, this.pos.z, 40) }; this.hovering = false; this.lock = null; this.speed = 0; this.tip(smash ? 'SMASH LANDING!' : 'Coming down'); return; } this.fromHorde = null; const x = this.pos.x, z = this.pos.z, cam = this.ctx.camera; this.g.camBlend = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, t: 0, T: 1.0 }; this.stop(true); H.land(x, z, smash); }
  // locked on: straight at the villain, faster the further, through every building in the way; close enough and the fight is on (fightFoe)
  homeIn(dt) {
    const v = this.lock, P = this.P; this.hovering = false;
    if (!v || v.gone || v.beaten) { this.lock = null; return false; }
    const ty = Math.max(2.4, (v.y || 0) + HIP), dx = v.x - this.pos.x, dy = ty - this.pos.y, dz = v.z - this.pos.z, d = Math.hypot(dx, dy, dz) || 0.01;
    if (v.gen) { if (d < 14) { this.lock = null; this.speed = 0; this.fromHorde.genFight(v.gen); return true; } }
    else if (v.worm) { if (d < (v.worm.type === 'kaiju' ? 28 : 14)) { this.lock = null; this.hovering = true; this.bossClose = true; this.speed = this.thr = 0; this.tip(v.worm.type === 'kaiju' ? 'In close: GRAB IT to climb on; tap to punch' : 'In close: GRAB IT to ride it; tap to punch when it is up'); return true; } }
    else if (v.machine) { if (d < 10) { this.fromHorde.hitMachine(v.machine, 10, 'HIT'); this.lock = null; this.hovering = true; this.engaged = v.machine; this.speed = this.thr = 0; this.tip('In close: tap to punch, or GRAB IT'); this.power.ramT = 0.8; return true; } }
    else if (v.zombie != null) { if (d < 7) { this.landHorde(false); return true; } }
    else if (d < 6.5) { if (this.inB >= 0) { this.burstOut(this.inB, this.pos.x, this.pos.y, this.pos.z); this.inB = -1; } this.speed = 0; this.fightFoe(v); return true; } // reached them: down into the fight
    let a = Math.atan2(-dz, dx) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    this.yaw += a * Math.min(1, dt * 5); this.roll += (Math.max(-1, Math.min(1, -a * 2)) - this.roll) * Math.min(1, dt * 3);
    this.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) * 0.8 - this.pitch) * Math.min(1, dt * 4);
    this.speed += (Math.min(P.max * 1.6, d * 1.6 + 14) - this.speed) * Math.min(1, dt * 2.5);
    const px = this.pos.x, py = this.pos.y, pz = this.pos.z, s = Math.min(d - 6, this.speed * dt); this.pos.x += dx / d * s; this.pos.y += dy / d * s; this.pos.z += dz / d * s;
    const K = this.keys; let ix = this.ix; if (K.has('arrowleft') || K.has('a')) ix = -1; if (K.has('arrowright') || K.has('d')) ix = 1; // the stick weaves them side to side (the villain's shots)
    if (Math.abs(ix) > 0.05 && d > 12) { const hd = Math.hypot(dx, dz) || 1; this.pos.x += dz / hd * ix * 22 * dt; this.pos.z -= dx / hd * ix * 22 * dt; }
    if (this.pos.y < 2.4) this.pos.y = 2.4;
    this.plough(px, py, pz); // straight through everything in the way, as when flown by hand (Sean)
    return true;
  }
  // Lock on reached them (Sean: only the one fighting, everywhere): the flight set down, the fight engine in the street where they are, against them; then back into the air from there,
  // beaten they flee, and a loss is a knock out of the sky. What they have left stays on them for the next round. The camera eased across both ways
  fightFoe(v) {
    const g = this.g, T = g.fightTest, D = g.disasters, P = g.people, cam = this.ctx.camera, s = { kind: this.kind, P: this.P, heroGame: this.heroGame, onStopped: this.onStopped, view: this.view, stats: { ...LAB.stats }, hullK: this.hull / (this.hullMax || 100), hero: this.P.hero };
    const q = P.snapWalkable(v.x, v.z, 40) || [v.x, v.z], lvl = LAB.villain || 1, hpMax = 180 + 70 * lvl; v.gripped = true; v.rig.root.visible = false; g.camBlend = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, t: 0, T: 1.1 };
    this.stop(true); this.fighting = true;
    T.start({ ring: { x: q[0], z: q[1], y: P.groundY(q[0], q[1]), r: 26 }, street: true, who: s.hero, hp: Math.max(20, s.hullK * 100), foe: { name: v.name, hpMax, hp: v.fightHp ?? hpMax, dmgK: 0.75 + 0.1 * lvl }, onEnd: (won, F2) => {
      const x = F2.h.x, z = F2.h.z, y = F2.h.y, yaw = F2.h.yaw, left = F2.h.hp, foeLeft = F2.v.hp; g.camBlend = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, t: 0, T: 1.1 }; T.stop(true); this.fighting = false; this.heroGame = s.heroGame; this.start(s.kind); this.P = s.P; this.onStopped = s.onStopped; Object.assign(LAB.stats, s.stats); this.pos.set(x, y + 1.5, z); this.yaw = Math.atan2(-Math.cos(yaw), Math.sin(yaw)); this.pitch = 0.9; this.speed = 5; this.thr = Math.max(this.P.start || 5, 5); this.setView(s.view); this.hull = this.hullMax * Math.max(0.2, left / 100);
      v.gripped = false; v.rig.root.visible = true; v.x = F2.v.x; v.z = F2.v.z;
      if (won) { LAB.stats.won++; delete v.fightHp; v.heroWin = true; for (const e of D.list) if (e.type === 'villains' && e.who.includes(v)) e.beat(v, s.hero); this.tip(v.name + ' is beaten!'); } else { v.fightHp = Math.max(40, foeLeft); this.crash(-1, v.name + ' knocked you out!'); }
    } });
  }
  // a hero's pose: flat out along the way at speed, one fist ahead; upright and treading air slow or in a fight; a punch;
  // arms out holding on while spinning a villain round. The rig set so the hips are where the hero is
  heroPose(r, dt) {
    const A = r.arms, L = r.legs, D = null, fast = Math.max(0, Math.min(1, (this.speed - 10) / 14)), act = this.act, kind = act && act.kind;
    const u = act ? Math.min(1, act.t / act.T) : 0, k = Math.sin(Math.PI * u); // a move: how far through it; out and back
    relax(r); this.lean = kind === 'dive' ? Math.PI : (this.lean || 0) + ((kind === 'drag' ? 0.9 : 1.35 * fast) - (this.lean || 0)) * Math.min(1, dt * 3); // head first after them in the dive
    const C = this.clip; let bodyY = 0;
    if (C) { C.t += dt; playClip(r, C.clip, C.t); this.lean = r.body.rotation.x; bodyY = r.hips.position.y - 0.94; r.hips.position.y = 0.94; } // a keyframed move (clips.js): its lean and hip drop are its own
    else if (kind === 'kick') { L[1].hip.rotation.x = -1.7 * k; L[1].knee.rotation.x = 0.9 * (1 - k); L[0].knee.rotation.x = 0.3; r.torso.rotation.x = -0.35 * k; for (const a of A) { a.sh.rotation.set(-0.5, 0, a.sx * (0.6 + 0.4 * k)); a.el.rotation.set(-0.8, 0, 0); } }
    else if (kind === 'laser') { if (this.P.hero === 'Nova') { for (const a of A) { a.sh.rotation.set(0.45, 0, a.sx * 0.25); a.el.rotation.set(-0.9, 0, 0); } r.torso.rotation.x = 0.15; } else for (const a of A) { a.sh.rotation.set(-1.55, 0, -a.sx * 0.12); a.el.rotation.set(0, 0, 0); } } // Nova's from her eyes, fists back; the others' from their hands
    else if (kind === 'crouch') { A[1].sh.rotation.set(0.5, 0, 0.1); A[1].el.rotation.set(-1.4, 0, 0); A[0].sh.rotation.set(-1.0, 0, -0.15); A[0].el.rotation.set(-1.7, 0, 0); r.torso.rotation.x = 0.4; for (const l of L) { l.hip.rotation.x = -0.4; l.knee.rotation.x = 0.8; } } // wound up for the uppercut
    else if (kind === 'upper') { A[1].sh.rotation.set(-0.4 - 2.4 * k, 0, 0.1); A[1].el.rotation.set(-1.2 * (1 - k), 0, 0); r.torso.rotation.x = 0.4 - 0.7 * k; }
    else if (kind === 'rise') { A[1].sh.rotation.set(-3.0, 0, 0.1); A[0].sh.rotation.set(0.2, 0, -0.15); }
    else if (kind === 'hammerUp' || kind === 'hammer' || kind === 'dive') { const s = kind === 'hammer' ? u : 0; for (const a of A) { a.sh.rotation.set(-3.0 + 2.3 * s, 0, -a.sx * 0.15); a.el.rotation.set(0, 0, 0); } r.torso.rotation.x = kind === 'hammerUp' ? -0.25 : 0.35 * s; } // fists together over the head, brought down
    else if (kind === 'drag') { A[1].sh.rotation.set(0.9, 0, 0.25); A[1].el.rotation.set(0, 0, 0); A[0].sh.rotation.set(-2.9, 0, -0.1); } // one hand back on their throat, the other ahead
    else if (this.riding) { for (const a of A) { a.sh.rotation.set(-1.0, 0, -a.sx * 0.3); a.el.rotation.set(-0.7, 0, 0); } }
    else if (this.spinHold || (this.fromHorde && this.fromHorde.heldS)) { for (const a of A) { a.sh.rotation.set(-1.5, 0, -a.sx * 0.24); a.el.rotation.set(0, 0, 0); } }
    else if (this.punch > 0) { A[1].sh.rotation.set(-1.6, 0, 0.1); A[0].sh.rotation.set(0.4, 0, -0.2); A[0].el.rotation.set(-1.4, 0, 0); r.torso.rotation.x = 0.3; }
    else if (fast > 0.5) { A[1].sh.rotation.set(-3.0, 0, 0.1); A[0].sh.rotation.set(0.25, 0, -0.1); }
    else { for (const a of A) a.sh.rotation.set(0.1, 0, a.sx * 0.3); for (const L of r.legs) { L.hip.rotation.x = 0.1; L.knee.rotation.x = 0.25; } }
    r.body.rotation.x = this.lean; if (!C) r.head.rotation.x = -this.lean * 0.6;
    r.root.position.set(-Math.sin(this.lean) * HIP, -Math.cos(this.lean) * HIP + bodyY + (fast < 0.5 && !D ? Math.sin((this.wingT || 0) * 2) * 0.15 : 0), 0); // treading air (held still in a fight)
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
