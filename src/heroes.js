// Super heroes: three of them, peach skin, each in a neon suit and cape of their
// own (Dragonfly green, Nova pink, Tempo cyan, lit from within), called
// with the hero signal (a peace sign shone onto the clouds from a rooftop).
// Dragonfly flies on four buzzing insect wings: he cuts people and cars free of
// Weaver's webs and knocks Weaver off his perch. Nova flies and is the strongest:
// she punches Tyrant out of the sky and catches what he throws (a building she
// puts back where it stood). Tempo makes time bubbles: inside one everything
// crawls, Blur included, and thrown cars, buildings and tornado debris drift
// instead of flying. Any of them will catch an incoming nuclear missile or a
// meteor (Tempo slows it first) and carry it up into space; a big meteor is
// broken up and its pieces go up too. In a flood or a tsunami they pull people
// out of the water two at a time and fly them up onto a roof clear of it, and
// Tempo holds back the incoming wave with his bubbles.
import * as THREE from 'three';
import { rig, relax, handsOnHips, tumble, detail } from './villains.js';
import { tossStep, toss } from './brawl.js';
import { fightPose } from './melee.js';
import { alienStep } from './herofight.js';
import { riftStep } from './rift.js';
const up = (v) => v && !v.gone && !v.beaten;
import { roofTop } from './tripod.js';
import { ST } from './people.js';
import { sfx } from './audio.js';
const _hv = new THREE.Vector3();

const UP = 520; // carried this high, a meteor or a warhead is gone into space
const ODDS = 0.66; // how often the heroes win, rolled once for each villain, monster, meteor or missile
export function heroesWin(o) { if (o.heroWin === undefined) o.heroWin = Math.random() < ODDS; return o.heroWin; }
const HANDS = 4.9;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let HM = null;
function kit() {
  if (HM) return HM;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  // the hero signal: a glowing disc on the clouds with a peace sign across it
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.62, 'rgba(255,238,170,0.95)'); g.addColorStop(0.8, 'rgba(255,220,130,0.45)'); g.addColorStop(1, 'rgba(255,210,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(30,24,14,0.92)'; x.lineWidth = 15; x.lineCap = 'round';
  x.beginPath(); x.arc(128, 128, 70, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(128, 58); x.lineTo(128, 198); x.stroke();
  x.beginPath(); x.moveTo(128, 128); x.lineTo(128 - 49.5, 128 + 49.5); x.moveTo(128, 128); x.lineTo(128 + 49.5, 128 + 49.5); x.stroke();
  const sig = new THREE.CanvasTexture(c); sig.colorSpace = THREE.SRGBColorSpace;
  HM = {
    skin: std('#f2c4a0'), suit: std('#f6f4ef', { roughness: 0.4 }), cape: std('#f2f0ea', { side: THREE.DoubleSide, roughness: 0.6 }),
    belt: std('#d8b04a', { metalness: 0.5, roughness: 0.35 }), badge: std('#d8b04a', { metalness: 0.5, roughness: 0.35 }), boot: std('#e8e4dc'),
    hair: { Dragonfly: std('#4a3424', { roughness: 0.4 }), Nova: std('#d9b25e', { roughness: 0.4 }), Tempo: std('#2a2a2a', { roughness: 0.4 }) },
    wing: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.95, 1.0), transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.8, 2.6), fog: false }),
    wingGeo: new THREE.CircleGeometry(1, 20).scale(0.5, 0.13, 1).translate(0.5, 0, 0).rotateX(-Math.PI / 2), // a narrow oval membrane reaching out from its root
    signal: sig,
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.92, 0.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    sphere: new THREE.SphereGeometry(1, 32, 16),
    rock: new THREE.IcosahedronGeometry(1, 1),
    rockMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.0, 0.3), fog: false }),
  };
  // each their own neon, glowing a little, so they stand out from the town, from the villains and from each other
  const neon = (hex) => { const c = new THREE.Color(hex); return { suit: std(hex, { roughness: 0.35, emissive: c, emissiveIntensity: 0.45 }), boot: std(hex, { roughness: 0.4, emissive: c, emissiveIntensity: 0.3 }), cape: std(hex, { side: THREE.DoubleSide, roughness: 0.55, emissive: c, emissiveIntensity: 0.3 }) }; };
  HM.look = { Dragonfly: neon('#3dff5c'), Nova: neon('#ff3fcf'), Tempo: neon('#29e3ff') };
  return HM;
}

const BEAM_VS = /* glsl */`varying float vY; void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FS = /* glsl */`uniform float uOp; varying float vY; void main() { gl_FragColor = vec4(vec3(1.0, 0.92, 0.6) * uOp * (1.0 - vY * 0.85), 1.0); }`; // brightest at the lamp, fading up the beam
// ---------- the hero signal: a searchlight on the tallest roof nearby, a peace sign on the clouds above it
class Signal {
  constructor(D, x, z) {
    const { city, scene, fire } = D.ctx, K = kit();
    this.D = D; this.t = 0; this.life = 14; this.alive = true;
    let best = -1, top = 0; city.buildingsNear(x, z, 90, (k, d, b) => { if (b.roofY > top && !b.landmark) { top = b.roofY; best = k; } });
    const b = best >= 0 ? city.buildings[best] : null;
    const rp = b ? city.roofPoint(best, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) : [x, z]; // on the roof, clear of its hut
    this.lx = rp[0]; this.lz = rp[1]; this.ly = b ? b.roofY + 0.5 : 0.5; this.k = best;
    // the light is angled up towards the viewer so the peace sign lands in the sky at the top of the view
    const cam = D.ctx.camera, v = new THREE.Vector3(0, 0.55, 0.5).unproject(cam).sub(cam.position).normalize(), sy = Math.min(cam.position.y * 0.8, this.ly + 75), tt = v.y < -0.02 ? (sy - cam.position.y) / v.y : 300;
    this.sx = cam.position.x + v.x * tt; this.sy = cam.position.y + v.y * tt; this.sz = cam.position.z + v.z * tt;
    const dir = new THREE.Vector3(this.sx - this.lx, this.sy - this.ly, this.sz - this.lz), H = dir.length();
    const wide = Math.max(8, cam.position.distanceTo(new THREE.Vector3(this.sx, this.sy, this.sz)) * 0.085 * 0.4); // the beam opens out to the width of the sign
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(wide, 1.4, 1, 24, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({ vertexShader: BEAM_VS, fragmentShader: BEAM_FS, uniforms: { uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); this.beam.position.set(this.lx, this.ly, this.lz);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); this.beam.scale.set(1, H, 1); this.beam.renderOrder = 8; this.beam.frustumCulled = false; scene.add(this.beam);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.signal, transparent: true, depthWrite: false, fog: false, opacity: 0 })); this.sprite.position.set(this.sx, this.sy, this.sz); this.size = Math.max(25, cam.position.distanceTo(this.sprite.position) * 0.085); this.sprite.scale.set(this.size, this.size, 1); this.sprite.renderOrder = 9; scene.add(this.sprite); // about a quarter of the view high
    const t = fire.uniforms.uTime.value; // a bank of cloud for it to shine on
    const cr = Math.max(14, cam.position.distanceTo(new THREE.Vector3(this.sx, this.sy, this.sz)) * 0.04);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, r = fire.smoke.alloc(6, this.sx + Math.cos(a) * cr * 1.4, this.sy - 4, this.sz + Math.sin(a) * cr * 1.4, cr, cr, 6, t); fire.later(10, () => fire.smoke.end(r, fire.uniforms.uTime.value)); fire.later(20, () => fire.smoke.release(r)); }
  }
  update(h) {
    this.t += h; const k = Math.min(1, this.t, Math.max(0, (this.life - this.t) / 2)), night = this.D.ctx.post.opts.night || 0;
    this.beam.material.uniforms.uOp.value = k * (0.12 + 0.2 * night); this.sprite.material.opacity = k; this.sprite.scale.setScalar(this.size * (0.94 + 0.06 * Math.sin(this.t * 3)));
    if (this.t >= this.life) this.dispose();
  }
  dispose() { if (!this.alive) return; this.alive = false; const sc = this.D.ctx.scene; sc.remove(this.beam, this.sprite); this.beam.geometry.dispose(); this.beam.material.dispose(); this.sprite.material.dispose(); }
}

// ---------- Tempo's time bubbles: a shimmering sphere; inside it everything moves at a crawl (D.slowAt)
const BUB_VS = /* glsl */`varying vec3 vN, vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const BUB_FS = /* glsl */`
uniform float uOp, uTime; varying vec3 vN, vW;
void main() {
  vec3 V = normalize(cameraPosition - vW), N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float f = pow(1.0 - abs(dot(N, V)), 2.5), rip = 0.5 + 0.5 * sin(vW.y * 0.8 - uTime * 3.0 + vW.x * 0.3);
  vec3 col = mix(vec3(0.55, 0.85, 1.0), vec3(0.9, 0.97, 1.0), f) * (1.1 + 0.3 * rip);
  gl_FragColor = vec4(col, (0.06 + 0.55 * f + 0.05 * rip) * uOp);
}`;
class Bubble {
  constructor(H, x, y, z, R, life, track = null) {
    this.H = H; this.b = { x, y, z, R: 0.1 }; this.R = R; this.life = life; this.t = 0; this.track = track; this.alive = true;
    H.D.bubbles.push(this.b); sfx('warp', x, y, z);
    this.mesh = new THREE.Mesh(kit().sphere, new THREE.ShaderMaterial({ vertexShader: BUB_VS, fragmentShader: BUB_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uOp: { value: 0 }, uTime: { value: 0 } } }));
    this.mesh.renderOrder = 6; this.mesh.frustumCulled = false; H.scene.add(this.mesh);
  }
  update(h) {
    this.t += h;
    if (this.b.pop) { this.b.pop = false; this.t = Math.max(this.t, this.life - 0.4); } // shattered from inside
    if (this.track) { const p = this.track(); if (p) { this.b.x = p.x; this.b.y = p.y; this.b.z = p.z; } else this.t = Math.max(this.t, this.life - 0.4); }
    const k = Math.min(1, this.t / 0.35), out = Math.max(0, Math.min(1, (this.life - this.t) / 0.6));
    this.b.R = this.R * k * (0.6 + 0.4 * out);
    this.mesh.position.set(this.b.x, this.b.y, this.b.z); this.mesh.scale.setScalar(Math.max(0.1, this.b.R));
    const u = this.mesh.material.uniforms; u.uOp.value = out; u.uTime.value = this.t;
    if (this.t >= this.life) this.dispose();
  }
  dispose() { if (!this.alive) return; this.alive = false; const D = this.H.D; D.bubbles.splice(D.bubbles.indexOf(this.b), 1); this.H.scene.remove(this.mesh); this.mesh.material.dispose(); }
}

class Hero {
  constructor(H, name, o = {}) {
    const K = kit();
    this.H = H; this.D = H.D; this.name = name; this.t = Math.random() * 5;
    this.x = H.sig.sx + (Math.random() - 0.5) * 30; this.y = H.sig.sy + 20; this.z = H.sig.sz + (Math.random() - 0.5) * 30; this.vx = this.vy = this.vz = 0; this.hs = 0; this.yaw = 0; this.pitch = 0;
    this.side = 'hero'; this.busyT = 0;
    this.state = 'wait'; this.waitT = 2.5 + (o.delay || 0); this.job = null; this.cd = 0; this.gcd = 0; this.punchT = 0; this.castT = 0; this.carry = null;
    this.rig = rig({ mats: { ...K, ...K.look[name], hair: K.hair[name] }, slim: o.slim, longHair: o.longHair, capeLen: 1.1 }); this.rig.root.visible = false; H.scene.add(this.rig.root);
    if (o.wings) { // four insect wings at the shoulder blades
      this.wings = [];
      for (const [sx, y, sweep] of [[1, 0.46, 0.25], [-1, 0.46, 0.25], [1, 0.38, 0.7], [-1, 0.38, 0.7]]) {
        const pv = new THREE.Group(); pv.position.set(sx * 0.06, y, -0.12); pv.scale.x = sx; pv.rotation.y = -sweep; this.rig.torso.add(pv);
        const w = new THREE.Mesh(K.wingGeo, K.wing); w.scale.setScalar(0.85); pv.add(w); this.wings.push(pv);
      }
    }
    if (o.glow) this.hands = this.rig.arms.map(a => { const g = new THREE.Mesh(K.sphere, K.glow); g.scale.setScalar(0.07); g.position.y = -0.3; g.visible = false; a.el.add(g); return g; });
  }
  get busy() { return this.job && ((this.job.kind === 'alien' && this.job.phase && this.job.phase !== 'go') || this.job.kind === 'catch' || this.job.kind === 'carry' || this.job.kind === 'return' || this.job.kind === 'ferry' || (this.job.kind === 'swim' && this.job.ppl && this.job.ppl.length > 0)); }
  fly(gx, gy, gz, h, top = 50, extra = 0) {
    const dx = gx - this.x, dy = gy - this.y, dz = gz - this.z, d = Math.hypot(dx, dy, dz), sp = Math.min(top, d * 1.8 + extra), f = Math.min(1, h * 3);
    if (d > 0.01) { this.vx += (dx / d * sp - this.vx) * f; this.vy += (dy / d * sp - this.vy) * f; this.vz += (dz / d * sp - this.vz) * f; }
    this.x += this.vx * h; this.y = Math.max(this.D.ctx.people.groundY(this.x, this.z) + 0.2, this.y + this.vy * h); this.z += this.vz * h;
    this.hs = Math.hypot(this.vx, this.vz); if (this.hs > 1) { let a = Math.atan2(this.vx, this.vz) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.yaw += a * Math.min(1, h * 5); }
    return d;
  }
  cruiseY(x = this.x, z = this.z) { return Math.max(30, roofTop(this.D.ctx.city, x, z, 14).top + 12); }
  update(h) {
    this.t += h; this.cd = Math.max(0, this.cd - h); this.gcd = Math.max(0, this.gcd - h); this.punchT = Math.max(0, this.punchT - h); this.castT = Math.max(0, this.castT - h);
    if (this.state === 'gone') return;
    if (this.state === 'wait') { this.waitT -= h; if (this.waitT <= 0 && this.H.hold <= 0) { this.state = 'fly'; this.rig.root.visible = true; } return; }
    if (this.state === 'leave') { this.fly(this.x, UP + 50, this.z, h, 60); if (this.y > UP) this.state = 'gone'; return; }
    if (this.tossed) { if (tossStep(this, this.D, h)) this.busyT = 1.0; return; } // thrown: through whatever is in the way, then back up
    if (this.gripped) return;
    if (this.busyT > 0) { this.busyT -= h; return; }
    const J = this.job;
    if (!J) { this.idle(h); return; }
    if (J.kind === 'catch') this.doCatch(h, J);
    else if (J.kind === 'carry') this.doCarry(h, J);
    else if (J.kind === 'return') this.doReturn(h, J);
    else if (J.kind === 'fight') this.doFight(h, J);
    else if (J.kind === 'web') this.doWeb(h, J);
    else if (J.kind === 'slow') this.doSlow(h, J);
    else if (J.kind === 'bubble') this.doBubble(h, J);
    else if (J.kind === 'fetch') this.doFetch(h, J);
    else if (J.kind === 'monster') this.doMonster(h, J);
    else if (J.kind === 'ferry') this.doFerry(h, J);
    else if (J.kind === 'blur') this.doBlur(h, J);
    else if (J.kind === 'swim') this.doSwim(h, J);
    else if (J.kind === 'wave') this.doWave(h, J);
    else if (J.kind === 'alien') alienStep(this, h, J);
    else if (J.kind === 'rift') riftStep(this, h, J);
  }
  // nothing to do: hover by the signal, then land on its roof
  idle(h) {
    const s = this.H.home, i = this.H.who.indexOf(this), a = i * 2.1 + this.t * 0.15;
    if (this.H.idleT > 6 && s.k >= 0) { const b = this.D.ctx.city.buildings[s.k]; if (b && !this.D.ctx.city.dead[s.k]) { const [px, pz] = this.D.ctx.city.roofPoint(s.k, s.x + (i - 1) * 3, s.z); this.fly(px, b.roofY, pz, h, 20); this.landed = Math.abs(this.y - b.roofY) < 0.3; return; } }
    this.landed = false; this.fly(s.x + Math.cos(a) * 18, this.cruiseY(s.x, s.z), s.z + Math.sin(a) * 18, h, 25);
  }
  // an incoming meteor or warhead: get under it, Tempo slows it, the first there seizes it
  doCatch(h, J) {
    const e = J.e;
    if (!e.alive || (e.phase !== 'warn' && e.phase !== 'fall')) { this.job = null; return; }
    if (e.phase === 'warn') { this.fly(e.x, 110, e.z, h, 60); return; }
    const o = e.OBJ; if (!o) { this.job = null; return; }
    const p = o.position, d = this.fly(p.x, p.y, p.z, h, 90, 30);
    if (d < 8 + (e.R || 0) * 0.2 && !heroesWin(e)) { this.lost(e, 'the ' + (e.type === 'nuclear' ? 'nuclear missile' : 'meteor')); return; } // too much for them: it comes down
    if (d < 8 + (e.R || 0) * 0.2 && e.seize()) {
      this.job = { kind: 'carry', e };
      if (e.type === 'meteor' && e.R >= 40) this.H.smash(e, this); // too big to carry whole: broken up first
      this.D.emit({ type: 'herocatch', text: this.name + ' caught the ' + (e.type === 'nuclear' ? 'nuclear missile' : 'meteor') + '!' });
    }
  }
  // beaten: knocked flying, and none of them tries again
  lost(o, what) {
    o.heroLost = true; this.job = null;
    toss(this, (Math.random() - 0.5) * 40, 12, (Math.random() - 0.5) * 40);
    this.D.emit({ type: 'herolost', text: this.name + " couldn't stop " + what + '!' });
  }
  doCarry(h, J) {
    const e = J.e, o = e.OBJ; if (!o) { this.job = null; return; }
    this.fly(this.x, UP + 60, this.z, h, 55);
    o.position.set(this.x, this.y + 6, this.z); if (e.type === 'nuclear') o.lookAt(this.x, this.y + 100, this.z);
    if (this.y > UP) { e.vanish(); this.job = null; this.D.emit({ type: 'herospace', text: this.name + ' threw the ' + (e.type === 'nuclear' ? 'nuclear missile' : 'meteor') + ' into space!' }); }
  }
  // a thrown building: carried home and set back down where it stood
  doReturn(h, J) {
    const city = this.D.ctx.city, b = J.k != null ? city.buildings[J.k] : null;
    const tx = b ? (b.x0 + b.x1) / 2 : this.x, tz = b ? (b.z0 + b.z1) / 2 : this.z;
    const hd = Math.hypot(tx - this.x, tz - this.z), clear = Math.max(30, roofTop(city, this.x, this.z, J.half + 8).top + 2) - HANDS;
    this.fly(tx, hd > 6 ? clear : (b ? b.baseY : 0) - HANDS + 0.5, tz, h, 28);
    J.shell.position.set(this.x, this.y + HANDS - J.base, this.z); J.shell.rotation.set(0, J.shell.rotation.y * 0.95, 0);
    if (hd < 2 && this.y < this.D.ctx.people.groundY(tx, tz) + 1.5) { // low enough: set it down where it stood
      this.D.ctx.scene.remove(J.shell); J.shell.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
      if (b && city.dead[J.k]) { city.restoreBuilding(J.k); const f = this.D.ctx.fire; if (f.bFire) { f.bFire[J.k] = 0; if (f.soaked) f.soaked[J.k] = 0; } }
      this.D.emit({ type: 'heroreturn', text: this.name + ' put the building back where it belongs!' });
      this.job = null;
    }
  }
  // a car from the street, to spin round and hurl at a villain
  fetch(target, back) { let best = null, bd = 60; this.D.ctx.traffic.near(this.x, this.z, 60, (c) => { if (c.mode !== 0 || c.mission || c.gone) return; const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < bd) { bd = d; best = c; } }); if (!best) return false; this.job = { kind: 'fetch', car: best, target, back }; return true; }
  doFetch(h, J) {
    const c = J.car;
    if (!up(J.target) || c.gone || c.mode === 4 || c.mode === 5) { this.job = J.back; return; }
    const d = this.fly(c.x, (c.y || 0) + 1.5, c.z, h, 60, 15);
    if (d < 4 && this.D.ctx.traffic.grab(c)) { this.D.brawl.spin(this, c, J.target); this.job = J.back; }
  }
  // Nova and Tyrant: she goes for anything he has thrown first, then for him
  doFight(h, J) {
    const ty = J.v, V = J.V;
    if (ty.gone || ty.beaten || ty.heroLost) { this.job = null; return; }
    const shell = ty.flying.find(f => f.shell && !f.caught);
    if (shell) {
      const d = this.fly(shell.x, shell.y + 2, shell.z, h, 70, 20);
      if (d < 9) { shell.caught = true; ty.flying.splice(ty.flying.indexOf(shell), 1); this.job = { kind: 'return', shell: shell.shell, k: shell.k, base: shell.base, half: shell.half }; this.D.emit({ type: 'herocatch2', text: 'Nova caught the building in mid-air!' }); }
      return;
    }
    if (Math.hypot(ty.x - this.x, ty.z - this.z) > 28 && (this.carT = (this.carT ?? 2) - h) <= 0) { this.carT = 5; if (Math.random() < 0.35 && this.D.brawl.melee.clash(this, ty)) return; if (this.fetch(ty, J)) return; } // from a distance: beam against beam, or a car at him
    const d = this.fly(ty.x, ty.y + 2, ty.z, h, 60, 15);
    if (d < 5 && this.cd <= 0) {
      const r = Math.random();
      if (r < 0.45 && this.D.brawl.melee.start(this, ty)) { this.cd = 2; return; } // toe to toe, punches and kicks
      if (r < 0.6 && !ty.gripped && !ty.tossed) { this.cd = 2; this.D.brawl.grab(this, ty); return; } // grabs him and hurls him through a building
      if (r < 0.72 && !ty.gripped && !ty.tossed && this.D.brawl.drag(this, ty)) { this.cd = 3; return; } // or by the throat, down the street
      this.cd = 1.1; this.punchT = 0.35;
      const dx = ty.x - this.x, dz = ty.z - this.z, dl = Math.hypot(dx, dz) || 1;
      ty.hp -= 25; ty.vx += dx / dl * 22; ty.vz += dz / dl * 22; ty.vy += 8; ty.ray = null; ty.wind = 0; sfx('thud', ty.x, ty.y + 2, ty.z, { gain: 1.2 });
      this.D.ctx.fire.burst(ty.x, ty.y + 3, ty.z, 14, 2); if (V.near(ty.x, ty.z)) this.D.shake(0.25);
      if (ty.held) { // he lets go of whatever he was holding
        const Hh = ty.held; ty.held = null; ty.plan = null;
        if (Hh.car) { Hh.car.soft = true; this.D.ctx.traffic.fling(Hh.car, dx / dl * 3, 1, dz / dl * 3); }
        else { this.job = { kind: 'return', shell: Hh.shell, k: Hh.k, base: Hh.base, half: Hh.half }; return; }
      }
      if (ty.hp <= 0) { V.beat(ty, 'Nova'); if (ty.heroLost) toss(this, -dx / dl * 30, 10, -dz / dl * 30); this.job = null; }
    }
  }
  // Dragonfly and Weaver: every web cut first, then him
  doWeb(h, J) {
    const wv = J.v, V = J.V;
    const web = wv && wv.webs ? wv.webs.filter(w => w.alive).sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z) - Math.hypot(b.x - this.x, b.z - this.z))[0] : null;
    if (web) {
      const d = this.fly(web.x, 4, web.z, h, 60, 15);
      if (d < 5) { web.release(); this.D.ctx.fire.burst(web.x, 1, web.z, 10, 1.4); if (!this.H.saidWeb) { this.H.saidWeb = true; this.D.emit({ type: 'heroweb', text: 'Dragonfly is cutting people free of the webs' }); } }
      return;
    }
    if (!wv || wv.gone || wv.beaten || wv.heroLost) { this.job = null; return; }
    if (Math.hypot(wv.x - this.x, wv.z - this.z) > 28 && (this.carT = (this.carT ?? 3) - h) <= 0) { this.carT = 6; if (this.fetch(wv, J)) return; }
    const d = this.fly(wv.x, wv.y + 2, wv.z, h, 65, 20);
    if (d < 4.5 && this.cd <= 0) {
      const r = Math.random();
      if (r < 0.45 && this.D.brawl.melee.start(this, wv)) { this.cd = 2; return; }
      if (r < 0.6 && !wv.gripped && !wv.tossed) { this.cd = 2; this.D.brawl.grab(this, wv); return; }
      if (r < 0.72 && !wv.gripped && !wv.tossed && this.D.brawl.drag(this, wv)) { this.cd = 3; return; }
      this.cd = 1.3; this.punchT = 0.35; wv.hp -= 34; sfx('thud', wv.x, wv.y + 2, wv.z, { gain: 1.2 });
      this.D.ctx.fire.burst(wv.x, wv.y + 3, wv.z, 12, 1.6);
      if (wv.state === 'perch') wv.hop(true);
      if (wv.hp <= 0) { V.beat(wv, 'Dragonfly'); if (wv.heroLost) toss(this, (Math.random() - 0.5) * 50, 10, (Math.random() - 0.5) * 50); this.job = null; }
    }
  }
  // Blur held in a time bubble, or seeing stars after a throw, can be caught: in close at full speed (a hero's own
  // time runs on inside the bubble) to get hold of him before he vibrates free. true while going for him
  catchBlur(h, bl, range) {
    const held = !(bl.freeT > 0) && this.D.slowAt(bl.x, 2, bl.z) < 1;
    if (!(held || bl.dazed > 0) || bl.tossed || bl.gripped || bl.gone || bl.beaten || bl.heroLost) return false;
    if (Math.hypot(bl.x - this.x, bl.z - this.z) > range) return false;
    const d = this.fly(bl.x, (bl.y || 0) + 2, bl.z, h, 90, 30);
    if (d < 5 && this.gcd <= 0) {
      this.gcd = 1.5; const B = this.D.brawl, r = Math.random();
      if (!this.H.saidBlur) { this.H.saidBlur = true; this.D.emit({ type: 'heroblur', text: (held ? 'Blur is frozen in time, and ' : 'Blur is seeing stars, and ') + this.name + ' got hold of him!' }); }
      if (r < 0.35 && B.melee.start(this, bl)) return; // toe to toe while he is slow enough to hit
      if (r < 0.6) B.grab(this, bl); // round once and through a building
      else if (!(r < 0.8 && B.drag(this, bl))) { // or by the throat down the street, or a punch that knocks him flat
        this.punchT = 0.35; const dx = bl.x - this.x, dz = bl.z - this.z, dl = Math.hypot(dx, dz) || 1;
        toss(bl, dx / dl * 16, 7, dz / dl * 16); B.hurt(bl, 25, this); this.D.ctx.fire.burst(bl.x, 3, bl.z, 12, 1.8);
      }
    }
    return true;
  }
  // Tempo and Blur: a bubble where he is going, then in to catch him while he crawls; held in time long enough (24 s in all), he gives up
  doSlow(h, J) {
    const bl = J.v, V = J.V;
    if (bl.gone || bl.beaten || bl.heroLost) { this.job = null; return; }
    if (bl.trapped > 24) { V.beat(bl, 'Tempo'); this.job = null; return; }
    if (this.catchBlur(h, bl, 120)) return;
    if (bl.trapped > 0.6 && (this.carT = (this.carT ?? 1) - h) <= 0) { this.carT = 6; if (this.fetch(bl, J)) return; } // he is stuck in the bubble: a car at him
    const d = Math.hypot(bl.x - this.x, bl.z - this.z);
    this.fly(bl.x - (bl.x - this.x) / (d || 1) * 45, this.cruiseY(bl.x, bl.z), bl.z - (bl.z - this.z) / (d || 1) * 45, h, 60);
    if (d < 170 && this.cd <= 0) {
      this.cd = 2.8; this.castT = 0.6;
      let px = bl.x, pz = bl.z;
      if (bl.state === 'dash') { const gx = bl.goal[0] - bl.x, gz = bl.goal[1] - bl.z, gl = Math.hypot(gx, gz) || 1, a = Math.min(18, gl); px += gx / gl * a; pz += gz / gl * a; }
      this.H.bubble(px, 3, pz, 20, 5);
    }
  }
  // the others, once their own villain is dealt with: shadow Blur, ready to catch him the moment a bubble holds him
  doBlur(h, J) {
    const bl = J.v;
    if (!up(bl) || bl.heroLost) { this.job = null; return; }
    if (this.catchBlur(h, bl, 220)) return;
    const d = Math.hypot(bl.x - this.x, bl.z - this.z) || 1;
    this.fly(bl.x - (bl.x - this.x) / d * 35, this.cruiseY(bl.x, bl.z), bl.z - (bl.z - this.z) / d * 35, h, 70);
  }
  // the giant worm and the kaiju: Tempo holds it in a time bubble, Dragonfly cuts loose whoever a tentacle holds,
  // and they go for its heads (the worm's only when it is above ground)
  doMonster(h, J) {
    const m = J.m, kj = m.type === 'kaiju';
    if (!m.alive || m.heroLost || (kj ? m.state === 'leave' : m.phase === 'leave' || m.phase === 'gone')) { this.job = null; return; }
    if (!J.slow && this.name === 'Tempo' && this.cd <= 0) J.slow = true; // between bubbles he was at its heads with the others
    if (J.slow) {
      const at = () => (m.alive ? (kj ? { x: m.x, y: 30, z: m.z } : { x: m.x, y: Math.max(4, m.y), z: m.z }) : null), p = at();
      const d = this.fly(p.x + 45, this.cruiseY(p.x, p.z) + 15, p.z + 45, h, 60);
      if (d < 150 && this.cd <= 0) {
        this.cd = kj ? 24 : 9; this.castT = 0.6; this.H.bubble(p.x, p.y, p.z, kj ? 42 : 30, kj ? 5 : 6, at); this.job = null; // the kaiju is held a few seconds in every half minute or so
        if (!this.H.saidSlowM) { this.H.saidSlowM = true; this.D.emit({ type: 'heroslowm', text: 'Tempo has the ' + (kj ? 'monster' : 'worm') + ' caught in a time bubble!' }); }
      }
      return;
    }
    if (J.cut && kj) {
      const q = m.rig.tents.find((t) => t.held && t.held.ppl && t.held.ppl.length);
      if (q) {
        const d = this.fly(q.tip.x, q.tip.y, q.tip.z, h, 75, 25);
        if (d < 5) {
          const ppl = m.rescue(q); this.cd = 0.8;
          if (ppl.length) { this.job = { kind: 'ferry', ppl, back: J, m }; if (!this.H.saidCut) { this.H.saidCut = true; this.D.emit({ type: 'herocut', text: this.name + ' cut people free of a tentacle!' }); } }
        }
        return;
      }
    }
    let tx, ty, tz;
    if (kj) { m.rig.heads[this.H.who.indexOf(this) % 2].head.getWorldPosition(_hv); tx = _hv.x; ty = _hv.y; tz = _hv.z; }
    else if (m.phase === 'arc' && m.y > 2) { tx = m.x; ty = m.y; tz = m.z; }
    else { this.fly(m.x + (this.name === 'Nova' ? 25 : -25), this.cruiseY(m.x, m.z) + 10, m.z, h, 45); return; } // over the ground where it is moving, waiting for it to come up
    const d = this.fly(tx, ty, tz, h, 70, 20);
    if (d < 6 && this.cd <= 0) {
      this.cd = this.name === 'Nova' ? 1.2 : 1.6; this.punchT = 0.35;
      const dx = this.x - tx, dz = this.z - tz, dl = Math.hypot(dx, dz) || 1;
      m.damage((this.name === 'Nova' ? 12 : 6) * (kj ? 0.7 : 1), this.name); this.D.ctx.fire.burst(tx, ty, tz, 14, 2.5); sfx('thud', tx, ty, tz, { gain: 1.4, rate: 0.8 });
      if (m.heroLost) { toss(this, dx / dl * 45, 16, dz / dl * 45); this.job = null; return; } // swatted away
      this.vx = dx / dl * 25; this.vz = dz / dl * 25; this.vy = 6; // knocked back off it
      this.D.shake(0.15);
    }
  }
  // people cut free: carried down to the street away from the monster and set down unhurt
  doFerry(h, J) {
    const people = this.D.ctx.people, m = J.m;
    J.ppl = J.ppl.filter((j) => people.st[j] === ST.EXT);
    if (!J.to) { const a = Math.atan2(this.z - m.z, this.x - m.x); J.to = people.snapWalkable(m.x + Math.cos(a) * 70, m.z + Math.sin(a) * 70, 30) || [m.x + Math.cos(a) * 70, m.z + Math.sin(a) * 70]; }
    const d = this.fly(J.to[0], people.groundY(J.to[0], J.to[1]) + 1.6, J.to[1], h, 45);
    J.ppl.forEach((j, k) => { people.x[j] = this.x + (k - 0.5) * 0.7; people.y[j] = this.y - 1.6; people.z[j] = this.z; });
    if (d < 2.5 || !J.ppl.length) { for (const j of J.ppl) people.setDown(j, m.x, m.z); this.job = J.back; }
  }
  // a flood: people afloat pulled out two at a time and flown up onto the nearest roof standing clear of the water
  doSwim(h, J) {
    const P = this.D.ctx.people, city = this.D.ctx.city;
    J.ppl = (J.ppl || []).filter((j) => P.st[j] === 19);
    J.ppl.forEach((j, k) => { P.x[j] = this.x + (k - 0.5) * 0.7; P.y[j] = this.y - 1.7; P.z[j] = this.z; }); // hanging from their hands
    if (J.k == null) {
      if (J.j == null || P.st[J.j] !== 29) { // who next: someone afloat near the busiest spot nearest this hero
        J.j = null; if ((J.lookT = (J.lookT || 0) - h) > 0) { this.fly(this.x, this.cruiseY(), this.z, h, 20); return; }
        J.lookT = 0.5;
        const spots = P.swimSpots(8); let best = null, bd = 1e9; for (const s of spots) { const d = Math.hypot(s[0] - this.x, s[1] - this.z) - s[2] * 4; if (d < bd) { bd = d; best = s; } }
        const j = best ? P.nearestSwimmer(best[0], best[1], 60) : -1;
        if (j < 0) { if (J.ppl.length) J.k = this.roofFor(); else { this.job = null; return; } }
        else J.j = j;
      }
      if (J.j != null) {
        const j = J.j, d = this.fly(P.x[j], P.y[j] + 2.2, P.z[j], h, 60, 15);
        if (d < 3 && P.grab(j)) {
          P.fx[j] = 3; J.ppl.push(j); J.j = null;
          if (!this.H.saidSwim) { this.H.saidSwim = true; this.D.emit({ type: 'heroswim', text: this.name + ' is pulling people out of the water!' }); }
          if (J.ppl.length >= 2 || P.nearestSwimmer(this.x, this.z, 30) < 0) J.k = this.roofFor();
        }
        return;
      }
    }
    if (J.k == null || J.k < 0 || city.dead[J.k]) { J.k = this.roofFor(); if (J.k < 0) { for (const j of J.ppl) P.swim(j, 30); this.job = null; return; } }
    const b = P.bld[J.k], rf = b.roof, [cx, cz] = city.roofPoint(J.k, (rf.x0 + rf.x1) / 2, (rf.z0 + rf.z1) / 2), hd = Math.hypot(cx - this.x, cz - this.z);
    this.fly(cx, hd > 8 ? Math.max(b.roofY + 6, this.cruiseY(this.x, this.z)) : b.roofY + 1.9, cz, h, 55);
    if (hd < 3 && this.y < b.roofY + 3) { for (const j of J.ppl) P.toRoof(j, J.k); this.D.emit({ type: 'heroroof', n: J.ppl.length }); this.job = null; }
  }
  // the nearest roof standing well clear of the water (a building that is still up), or -1
  roofFor() {
    const P = this.D.ctx.people, W = this.D.water, city = this.D.ctx.city; let best = -1, bd = 1e9;
    city.buildingsNear(this.x, this.z, 160, (k, d, b) => { if (city.dead[k] || b.landmark || !P.bld[k] || !P.bld[k].roof || b.roofY < Math.max(0, W.level) + 3) return; const s = d + (P.bRoofAll[k] || 0) * 0.5; if (s < bd) { bd = s; best = k; } });
    return best;
  }
  // a dropped job (the heroes leaving): whoever they were carrying goes back in the water
  letGo() { const J = this.job; if (J && J.kind === 'swim' && J.ppl) { const P = this.D.ctx.people; for (const j of J.ppl) if (P.st[j] === 19) P.swim(j, 30); J.ppl = []; } }
  // Tempo and a tsunami coming in: a bubble on the front where it is about to reach the streets in view, holding it to a crawl
  doWave(h, J) {
    const e = J.e; if (!e.alive || e.phase !== 'wave') { this.job = null; return; }
    const c = this.D.ctx.controls.target, p = e.poi(c.x, c.z); if (!p) { this.job = null; return; }
    const ax = p.x - e.dir.x * 14, az = p.z - e.dir.y * 14, d = this.fly(ax - e.dir.x * 30, 40, az - e.dir.y * 30, h, 70);
    if (d < 60) {
      this.cd = 13; this.castT = 0.6; this.H.bubble(ax, 6, az, 46, 7); this.job = null;
      if (!this.H.saidWave) { this.H.saidWave = true; this.D.emit({ type: 'herowave', text: 'Tempo is holding back the wave with a time bubble!' }); }
    }
  }
  // Tempo: a bubble over things flying through the air (thrown, flung by a tornado)
  doBubble(h, J) {
    const d = this.fly(J.x + 25, this.cruiseY(J.x, J.z), J.z + 25, h, 60);
    if (d < 120 && this.cd <= 0) { this.cd = 3; this.castT = 0.6; this.H.bubble(J.x, J.y, J.z, J.R, 6); this.job = null; }
  }
  sync(dt) {
    const r = this.rig; if (this.state === 'gone' || this.state === 'wait') { r.root.visible = this.state !== 'gone' && this.state !== 'wait'; return; }
    r.root.visible = true; r.root.position.set(this.x, this.y, this.z); r.root.rotation.y = this.yaw;
    relax(r);
    const A = r.arms, carrying = this.job && (this.job.kind === 'carry' || this.job.kind === 'return');
    let pitch = 0;
    if (carrying) { for (const a of A) { a.sh.rotation.set(-2.9, 0, a.sx * 0.25); a.el.rotation.set(-0.2, 0, 0); } }
    else if (this.punchT > 0) { A[1].sh.rotation.set(-1.6, 0, 0.1); A[0].sh.rotation.set(0.4, 0, -0.2); A[0].el.rotation.set(-1.4, 0, 0); r.torso.rotation.x = 0.3; }
    else if (this.castT > 0) { for (const a of A) { a.sh.rotation.set(-1.5, 0, a.sx * -0.15); a.el.rotation.set(0, 0, 0); } }
    else if (this.landed) handsOnHips(r);
    else if (this.hs > 10) { pitch = 1.35 * Math.min(1, (this.hs - 10) / 14); A[1].sh.rotation.set(-3.0, 0, 0.1); A[0].sh.rotation.set(0.25, 0, -0.1); }
    else { for (const a of A) a.sh.rotation.set(0.1, 0, a.sx * 0.3); for (const L of r.legs) { L.hip.rotation.x = 0.1; L.knee.rotation.x = 0.25; } }
    this.pitch += (pitch - this.pitch) * Math.min(1, dt * 3); r.body.rotation.x = this.pitch; r.head.rotation.x = -this.pitch * 0.6;
    if (!this.landed && this.hs < 10) r.body.position.y = Math.sin(this.t * 2) * 0.2;
    fightPose(r, this); // squared up, a punch or a kick, a block, reeling; or leaning into a beam clash
    if (this.tossed || this.gripped || this.spinning) tumble(r, this.t, this.spinning);
    r.cape.update(dt, this.pitch > 0.5 ? 0.12 : Math.min(0.6, this.hs / 30), 0.3 + Math.min(0.7, this.hs / 20)); detail(r, this.D);
    if (this.wings) { const fl = this.landed ? 0 : 1; this.wings.forEach((w, i) => { w.rotation.z = fl ? Math.sin(this.t * 55 + i * 1.3) * 0.45 + 0.15 : -0.15; w.rotation.y = -(i < 2 ? 0.25 : 0.7) - (fl ? 0 : 0.6); }); }
    if (this.hands) for (const g of this.hands) g.visible = this.castT > 0;
  }
  dispose() { this.H.scene.remove(this.rig.root); this.rig.cape.g.dispose(); if (this.job && this.job.shell) { this.H.scene.remove(this.job.shell); } }
}

// a hero on their own for the roster
export function heroModel(name) { return heroRig(name).root; }
// the same, the rig itself to pose (flight.js: a hero the player flies); r.wings: Dragonfly's, to beat
export function heroRig(name) {
  const K = kit(), r = rig({ mats: { ...K, ...K.look[name], hair: K.hair[name] }, slim: name === 'Nova', longHair: name === 'Nova', capeLen: 1.1 }); relax(r); handsOnHips(r);
  const wings = [];
  if (name === 'Dragonfly') for (const [sx, y, sweep] of [[1, 0.46, 0.25], [-1, 0.46, 0.25], [1, 0.38, 0.7], [-1, 0.38, 0.7]]) {
    const pv = new THREE.Group(); pv.position.set(sx * 0.06, y, -0.12); pv.scale.x = sx; pv.rotation.y = -sweep; r.torso.add(pv);
    const w = new THREE.Mesh(K.wingGeo, K.wing); w.scale.setScalar(0.85); pv.add(w); wings.push(pv);
  }
  if (name === 'Tempo') for (const a of r.arms) { const g = new THREE.Mesh(K.sphere, K.glow); g.scale.setScalar(0.07); g.position.y = -0.3; a.el.add(g); }
  let t = 0; r.root.userData.tick = (dt) => { t += dt; r.cape.update(dt, 0.12, 0.35); wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 40 + i * 1.3) * 0.4 + 0.15; }); }; r.cape.update(0.1, 0.12, 0.35); detail(r, null, true);
  r.wings = wings; return r;
}

export class Heroes {
  constructor(D, x, z, o = {}) {
    this.type = 'heroes'; this.D = D; this.scene = D.ctx.scene; this.alive = true; this.t = 0; this.idleT = 0; this.thinkT = 0; this.bubbles = []; this.chunks = []; this.hold = 0; this.vHold = 0; this.brief = !!o.brief;
    this.holds();
    const c = D.ctx.controls.target; this.signal(x ?? c.x, z ?? c.z);
    this.who = [new Hero(this, 'Dragonfly', { wings: true }), new Hero(this, 'Nova', { slim: true, longHair: true, delay: 0.4 }), new Hero(this, 'Tempo', { glow: true, delay: 0.8 })];
  }
  // the villains get 20 s to themselves before the heroes arrive or start on them (an incoming meteor or missile brings the heroes at once)
  holds() {
    let young = 0; for (const e of this.D.list) if (e.type === 'villains' && e.alive) young = Math.max(young, 20 - e.t);
    if (this.D.list.some(e => e.type === 'kaiju' && e.alive && e.state !== 'leave')) young = Math.max(young, 12 - this.t); // the kaiju: they are a while getting here
    const incoming = this.D.list.some(e => (e.type === 'meteor' || e.type === 'nuclear') && e.alive && (e.phase === 'warn' || e.phase === 'fall'));
    this.vHold = Math.max(0, young); this.hold = incoming ? 0 : this.vHold;
  }
  // light the signal (again): the heroes come to it
  signal(x, z) {
    if (this.sig) this.sig.dispose();
    this.sig = new Signal(this.D, x, z); this.home = { x: this.sig.lx, z: this.sig.lz, k: this.sig.k };
    this.idleT = 0; this.leaving = false;
    if (this.who) for (const h of this.who) if (h.state === 'leave' || h.state === 'gone') { h.state = 'fly'; h.rig.root.visible = true; h.x = this.sig.sx; h.y = this.sig.sy; h.z = this.sig.sz; }
    if (this.holds) this.holds();
    this.D.emit({ type: 'herosignal', text: 'The hero signal is lit! Dragonfly, Nova and Tempo are on their way' + (this.hold > 1 ? ', about ' + Math.ceil(this.hold + 2) + ' s out' : '') });
  }
  bubble(x, y, z, R, life, track) { const b = new Bubble(this, x, y, z, R, life, track); this.bubbles.push(b); return b; }
  // a meteor too big to carry: it breaks into glowing pieces that fly off into space
  smash(e, hero) {
    const D = this.D, p = e.OBJ.position, K = kit();
    D.flash(0.6); D.ctx.fire.burst(p.x, p.y, p.z, 40, Math.max(8, e.R * 0.3));
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(K.rock, K.rockMat); m.scale.setScalar(2 + Math.random() * Math.max(2, e.R * 0.06)); m.position.copy(p); this.scene.add(m);
      const a = Math.random() * 6.28; this.chunks.push({ m, vx: Math.cos(a) * (10 + Math.random() * 20), vy: 40 + Math.random() * 40, vz: Math.sin(a) * (10 + Math.random() * 20), t: 0 });
    }
    e.OBJ.scale.multiplyScalar(0.55);
  }
  // who does what: incoming meteors and missiles first, then the villains, then whatever is flying through the air
  assign() {
    const D = this.D, [dragon, nova, tempo] = this.who, live = this.who.filter(h => h.state === 'fly');
    let work = 0;
    for (const e of D.list) {
      if ((e.type !== 'meteor' && e.type !== 'nuclear') || !e.alive || e.heroLost || (e.phase !== 'warn' && e.phase !== 'fall')) continue;
      work++;
      if (live.some(h => h.job && h.job.e === e)) continue;
      const free = live.filter(h => !h.busy); if (!free.length) break;
      const o = e.phase === 'fall' ? e.OBJ : null, tx = o ? o.position.x : e.x, tz = o ? o.position.z : e.z;
      free.sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - (a === nova ? 60 : 0) - Math.hypot(b.x - tx, b.z - tz) + (b === nova ? 60 : 0));
      free[0].job = { kind: 'catch', e };
    }
    // Tempo slows every falling meteor and missile it can reach
    if (tempo.state === 'fly') for (const e of D.list) {
      if ((e.type !== 'meteor' && e.type !== 'nuclear') || e.phase !== 'fall' || !e.OBJ || e.slowed) continue;
      const p = e.OBJ.position; if (Math.hypot(p.x - tempo.x, p.z - tempo.z) > 300) continue;
      e.slowed = true; tempo.castT = 0.6; this.bubble(p.x, p.y, p.z, Math.max(14, (e.R || 10) * 0.6), 9, () => (e.alive && e.phase === 'fall' && e.OBJ ? e.OBJ.position : null));
    }
    const V = D.list.find(e => e.type === 'villains' && e.alive);
    if (V && this.vHold <= 0) {
      const find = (n) => V.who.find(v => v.name === n && !v.gone && !v.beaten && !v.heroLost);
      const wv = find('Weaver'), ty = find('Tyrant'), bl = find('Blur');
      if (wv || (V.who.find(v => v.name === 'Weaver') || {}).webs?.some(w => w.alive)) work++;
      if (ty || bl) work++;
      if (dragon.state === 'fly' && (!dragon.job || dragon.job.kind === 'blur')) { const w = V.who.find(v => v.name === 'Weaver'); if (w && (!w.gone && !w.beaten || w.webs.some(x => x.alive))) dragon.job = { kind: 'web', v: w, V }; }
      if (nova.state === 'fly' && (!nova.job || nova.job.kind === 'blur') && ty) nova.job = { kind: 'fight', v: ty, V };
      if (tempo.state === 'fly' && !tempo.job && bl) tempo.job = { kind: 'slow', v: bl, V };
      if (bl) for (const hr of [nova, dragon]) if (hr.state === 'fly' && !hr.job) hr.job = { kind: 'blur', v: bl, V }; // free of their own: help catch Blur
    }
    // the alien invasion: whoever is free goes at the tripods and saucers
    const I = D.list.find(e => e.type === 'aliens' && e.alive && !e.leaving);
    if (I) { work++; for (const hr of live) if (!hr.job) hr.job = { kind: 'alien', I }; }
    // a dimensional rift: whoever is free goes at its orbs and pours power into it
    const RF = D.list.find(e => e.type === 'rift' && e.alive && e.phase !== 'closing');
    if (RF) { work++; for (const hr of live) if (!hr.job) hr.job = { kind: 'rift', R: RF }; }
    // the giant monsters: whoever is free goes at it
    const M = D.list.find(e => e.alive && !e.heroLost && ((e.type === 'kaiju' && e.state !== 'leave') || (e.type === 'worm' && e.phase !== 'leave' && e.phase !== 'gone')));
    if (M) {
      work++;
      if (nova.state === 'fly' && !nova.job) nova.job = { kind: 'monster', m: M };
      if (dragon.state === 'fly' && !dragon.job) dragon.job = { kind: 'monster', m: M, cut: true };
      if (tempo.state === 'fly' && !tempo.job && tempo.cd <= 0 && (M.type === 'kaiju' || M.phase === 'arc')) tempo.job = { kind: 'monster', m: M, slow: true };
      else if (tempo.state === 'fly' && !tempo.job && M.type === 'kaiju') tempo.job = { kind: 'monster', m: M }; // until the next bubble is ready, punches like the others
    }
    // a tsunami coming in: Tempo slows it; people afloat in a flood: everyone free pulls them out
    const T = D.list.find(e => e.type === 'tsunami' && e.alive && e.phase === 'wave'), afloat = D.ctx.people.stats.afloat || 0;
    if (T || afloat) work++;
    if (T && tempo.state === 'fly' && !tempo.job && tempo.cd <= 0) tempo.job = { kind: 'wave', e: T };
    if (afloat) for (const hr of live) if (!hr.job) hr.job = { kind: 'swim' };
    // Tempo bubbles things flying through the air: cars and buildings thrown, tornado debris
    if (tempo.state === 'fly' && !tempo.job && tempo.cd <= 0) {
      let best = null, bs = 2;
      const pts = [];
      for (const c of D.ctx.traffic.cars) if (c.mode === 5 && !c.gone) pts.push([c.x, c.y, c.z]);
      for (const e of D.list) { if (e.type === 'villains') for (const v of e.who) if (v.flying) for (const f of v.flying) if (f.shell && !f.caught) pts.push([f.x, f.y, f.z], [f.x, f.y, f.z], [f.x, f.y, f.z]); if (e.type === 'tornado' && e.tw && e.tw.onGround) pts.push([e.tw.x, 12, e.tw.z], [e.tw.x, 12, e.tw.z]); }
      for (let i = 0; i < Math.min(pts.length, 30); i++) { const p = pts[i]; let s = 0; for (const q of pts) if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 25) s++; if (s > bs) { bs = s; best = p; } }
      if (best) { tempo.job = { kind: 'bubble', x: best[0], y: Math.max(8, best[1]), z: best[2], R: 28 }; work++; }
    }
    return work;
  }
  update(h) {
    this.t += h; this.holds();
    if (this.sig && this.sig.alive) this.sig.update(h);
    for (const b of this.bubbles) b.update(h); this.bubbles = this.bubbles.filter(b => b.alive);
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i]; c.t += h; c.m.position.x += c.vx * h; c.m.position.y += c.vy * h; c.m.position.z += c.vz * h; c.vy += 25 * h;
      if (Math.random() < 0.5) this.D.ctx.fire.burst(c.m.position.x, c.m.position.y - 2, c.m.position.z, 2, 3);
      if (c.m.position.y > UP || c.t > 10) { this.scene.remove(c.m); this.chunks.splice(i, 1); }
    }
    if ((this.thinkT -= h) <= 0) { this.thinkT = 0.3; const work = this.assign() + this.who.filter(w => w.job).length; this.idleT = work ? 0 : this.idleT + 0.3; }
    for (const hero of this.who) hero.update(h);
    if (!this.leaving && this.idleT > (this.brief ? 6 : 40) && this.t > 20) { this.leaving = true; for (const hero of this.who) if (hero.state !== 'gone') { hero.letGo(); hero.state = hero.state === 'wait' ? 'gone' : 'leave'; } this.D.emit({ type: 'heroesleave', text: 'All clear. The heroes are flying off' }); }
    if (this.leaving && this.who.every(w => w.state === 'gone')) this.alive = false;
  }
  sync(dt) { for (const hero of this.who) hero.sync(dt); }
  poi(x, z) { let best = null, bd = 1e9; for (const v of this.who) { if (v.state !== 'fly') continue; const d = Math.hypot(v.x - x, v.z - z); if (d < bd) { bd = d; best = v; } } return best ? { x: best.x, z: best.z, danger: 0, range: 200 } : null; }
  dispose() {
    for (const hero of this.who) hero.dispose();
    for (const b of this.bubbles) b.dispose(); this.bubbles.length = 0;
    for (const c of this.chunks) this.scene.remove(c.m); this.chunks.length = 0;
    if (this.sig) this.sig.dispose();
  }
}
