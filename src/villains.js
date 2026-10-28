// Super villains: three of them, chalk-white skin, dressed head to toe in black
// with long black capes. Blur is so fast he runs straight through buildings and
// sends cars spinning out of his way. Tyrant flies, lifts cars and whole buildings
// and hurls them at each other, and his red laser eyes scorch the streets and set
// things alight. Weaver has six arms and swings from roof to roof on a web line;
// his webs stick cars and people fast where they are, and his red acid eats away
// the stuck cars. People scatter from all three and get out of buildings before
// they come down. In the Sandbox they run riot on their own; in Be The Disaster
// you control one at a time.
import * as THREE from 'three';
import { Splash } from './water.js';
import { ST } from './people.js';
import { roofTop } from './tripod.js';
import { tossStep } from './brawl.js';
import { Body, sweepTubes } from './flesh.js';
import { sfx } from './audio.js';
import { heroesWin } from './heroes.js';

const S = 2.2; // a villain stands a bit over twice as tall as a person, so you can pick them out from above
const NEAR = 330; // closer than this to the camera, a figure has its smooth body
const G = 9.8, HANDS = 4.9; // gravity; hands raised overhead, metres above the feet
const DRIVE = 0, REST = 2, EXT = 4, AIR = 5; // car modes (traffic.js)
const now = () => performance.now();
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let M = null;
function kit() {
  if (M) return M;
  M = {
    skin: new THREE.MeshStandardMaterial({ color: '#ece9e4', roughness: 0.5 }),
    suit: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.45, metalness: 0.15 }),
    cape: new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.6, side: THREE.DoubleSide }),
    hair: new THREE.MeshStandardMaterial({ color: '#070707', roughness: 0.3 }),
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2), fog: false }),
    web: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.94, 0.9) }),
    laser: new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 0.4, 0.25), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    acid: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.08, 0.05) }),
    limb: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, -0.5, 0), // hangs down from its joint
    ball: new THREE.SphereGeometry(1, 14, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    ray: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0), // from its base up to length 1
    disc: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
  };
  return M;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// stretch a beam or a thread (kit().ray) from a to b
export function aim(mesh, ax, ay, az, bx, by, bz, r) {
  _v.set(bx - ax, by - ay, bz - az); const len = _v.length() || 0.01; _v.multiplyScalar(1 / len);
  mesh.position.set(ax, ay, az); mesh.quaternion.setFromUnitVectors(_up, _v); mesh.scale.set(r, len, r);
}
function strand(scene, mat = kit().web) { const m = new THREE.Mesh(kit().ray, mat); m.frustumCulled = false; m.visible = false; scene.add(m); return m; }
function dropShell(scene, shell) { scene.remove(shell); shell.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); }

// a cape: cloth hung from the shoulders that streams out behind with speed and ripples
class Cape {
  constructor(parent, len, mat) {
    this.C = 5; this.R = 9; this.len = len; this.lift = 0; this.t = Math.random() * 10;
    this.g = new THREE.PlaneGeometry(1, 1, this.C - 1, this.R - 1); // its vertices are laid out again every frame
    this.mesh = new THREE.Mesh(this.g, mat || kit().cape); this.mesh.castShadow = true; this.mesh.frustumCulled = false; parent.add(this.mesh);
  }
  // lift: 0 hangs straight down, 1 streams straight back; flap: how hard it ripples
  update(dt, lift, flap) {
    this.t += dt; this.lift += (lift - this.lift) * Math.min(1, dt * 4);
    const p = this.g.attributes.position, C = this.C, R = this.R, seg = this.len / (R - 1);
    for (let c = 0; c < C; c++) {
      const u = c / (C - 1) - 0.5;
      let y = 0.55, z = -0.11;
      for (let r = 0; r < R; r++) {
        const v = r / (R - 1), w = 0.36 + 0.32 * v; // wider at the hem
        if (r > 0) {
          const a = this.lift * 1.45 * Math.min(1, 0.35 + v) + Math.sin(this.t * (4 + flap * 7) - v * 5 + u * 2) * (0.05 + flap * 0.24) * v;
          y -= Math.cos(a) * seg; z -= Math.sin(a) * seg;
        }
        p.setXYZ(r * C + c, u * w, y, z - Math.abs(u) * 0.05 * (1 - this.lift));
      }
    }
    p.needsUpdate = true; this.g.computeVertexNormals();
  }
}

// a figure about 1.8 m tall (before scaling) facing +z, feet at the origin; every limb a pivot
export function rig(o = {}) {
  const m = kit(), mt = o.mats || m, root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(S);
  const parts = [], part = (g, mat, sx, sy, sz, x, y, z, parent) => { const me = new THREE.Mesh(g, mat); me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.castShadow = true; parent.add(me); parts.push(me); return me; };
  const pivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const hips = pivot(body, 0, 0.94, 0);
  const sl = o.slim ? 0.88 : 1;
  part(m.box, mt.suit, 0.3 * sl, 0.16, 0.18, 0, 0, 0, hips);
  const legs = [-1, 1].map(sx => {
    const hip = pivot(hips, sx * 0.09, -0.04, 0); part(m.limb, mt.suit, 0.075 * sl, 0.46, 0.075 * sl, 0, 0, 0, hip);
    const knee = pivot(hip, 0, -0.45, 0); part(m.limb, mt.suit, 0.06 * sl, 0.44, 0.06 * sl, 0, 0, 0, knee); part(m.box, mt.boot || mt.suit, 0.1, 0.07, 0.22, 0, -0.45, 0.05, knee);
    return { hip, knee };
  });
  const torso = pivot(hips, 0, 0.06, 0);
  part(m.box, mt.suit, 0.36 * sl, 0.5, 0.2, 0, 0.28, 0, torso);
  part(m.box, mt.suit, 0.44 * sl, 0.1, 0.22, 0, 0.5, 0, torso); // shoulders
  if (mt.belt) part(m.box, mt.belt, 0.37 * sl, 0.05, 0.21, 0, 0.05, 0, torso);
  if (mt.badge) part(m.box, mt.badge, 0.12, 0.12, 0.02, 0, 0.36, 0.105, torso); // the emblem on the chest
  const head = pivot(torso, 0, 0.7, 0);
  part(m.ball, mt.skin, 0.11, 0.13, 0.115, 0, 0, 0, head);
  part(m.ball, mt.hair, 0.117, 0.085, 0.122, 0, 0.055, -0.014, head); // the hair
  if (o.longHair) part(m.box, mt.hair, 0.12, 0.26, 0.06, 0, -0.1, -0.1, head).userData.keep = true; // a long ponytail down the back
  part(m.box, mt.skin, 0.06, 0.08, 0.06, 0, -0.13, 0, head); // neck
  const eyes = o.eyes ? [-1, 1].map(sx => { const e = part(m.ball, mt.eye || m.eye, 0.024, 0.02, 0.016, sx * 0.042, 0.015, 0.108, head); e.userData.keep = true; return e; }) : null;
  const arms = [];
  (o.arms === 6 ? [0.48, 0.34, 0.2] : [0.48]).forEach((y, row) => {
    for (const sx of [-1, 1]) {
      const sh = pivot(torso, sx * 0.23 * sl, y, 0); part(m.limb, mt.suit, 0.055 * sl, 0.3, 0.055 * sl, 0, 0, 0, sh);
      const el = pivot(sh, 0, -0.29, 0); part(m.limb, mt.suit, 0.045 * sl, 0.27, 0.045 * sl, 0, 0, 0, el); part(m.ball, mt.glove || mt.skin, 0.045, 0.05, 0.045, 0, -0.29, 0, el);
      arms.push({ sh, el, sx, row });
    }
  });
  const cape = new Cape(torso, o.capeLen ?? 1.15, mt.cape);
  return { root, body, hips, torso, head, legs, arms, eyes, cape, parts, mt, o };
}
// the close-up body: smooth tubes swept through the same joints (flesh.js), each part in its own colour - a suit with
// a belt and an emblem, boots, gloves, a head with hair over the crown. Built the first time a figure comes near
function smoothBody(r) {
  const mt = r.mt, o = r.o, sl = o.slim ? 0.88 : 1, col = (mm, d = [1, 1, 1]) => (mm && mm.color ? [mm.color.r, mm.color.g, mm.color.b] : d);
  const suit = col(mt.suit), skin = col(mt.skin), boot = col(mt.boot || mt.suit), glove = col(mt.glove || mt.skin), hair = col(mt.hair), belt = mt.belt ? col(mt.belt) : null, badge = mt.badge ? col(mt.badge) : null;
  const body = new Body(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: mt.suit.roughness ?? 0.45, metalness: mt.suit.metalness ?? 0.05 }));
  const T = (q, pts, ref) => { const t = body.add({ lumps: 0, tile: 0.3, ...q }); t.src = pts; t.refSrc = ref; };
  const H = r.hips, Tq = r.torso, Hd = r.head;
  T({ rings: 16, cols: 14, len: 0.8, radii: [0.12, 0.15, 0.14, 0.17, 0.21, 0.1].map(v => v * sl), bulge: [0, 0, 0.012, 0.01, 0], capStart: true, capEnd: true, shape: (u, c, s) => 1 / Math.sqrt((c / 0.62) ** 2 + s * s),
    tint: (u, c, s) => (belt && u > 0.24 && u < 0.3 ? belt : badge && c > 0.75 && u > 0.6 && u < 0.72 && Math.abs(s) < 0.4 ? badge : suit) },
    [[H, 0, -0.08, 0], [H, 0, 0.02, 0], [Tq, 0, 0.12, 0], [Tq, 0, 0.32, 0], [Tq, 0, 0.5, 0], [Tq, 0, 0.6, 0]], [Tq, 0, 0, 1]);
  T({ rings: 14, cols: 12, len: 0.4, radii: [0.05, 0.045, 0.085, 0.112, 0.06], capStart: true, capEnd: true, shape: (u, c, s) => 1 / Math.sqrt((c / 1.05) ** 2 + (s / 0.93) ** 2),
    tint: (u, c) => (u > 0.72 || (u > 0.5 && c < -0.2) ? hair : skin) }, // hair over the crown and down the back
    [[Tq, 0, 0.58, 0], [Hd, 0, -0.12, 0], [Hd, 0, -0.06, 0.012], [Hd, 0, 0.03, 0], [Hd, 0, 0.14, -0.01]], [Hd, 0, 0, 1]);
  for (const L of r.legs) {
    const sx = Math.sign(L.hip.position.x) || 1;
    T({ rings: 16, cols: 10, len: 1.0, radii: [0.085 * sl, 0.08 * sl, 0.058 * sl, 0.045, 0.045, 0.035], bulge: [0, 0.014, 0.012, 0, 0], capStart: true, capEnd: true, tint: (u) => (u > 0.72 ? boot : suit) },
      [[H, sx * 0.06, 0.02, 0], [L.hip, 0, 0, 0], [L.knee, 0, 0, 0], [L.knee, 0, -0.4, 0], [L.knee, 0, -0.45, 0.06], [L.knee, 0, -0.46, 0.15]], [H, 0, 0, 1]);
  }
  for (const A of r.arms) {
    T({ rings: 14, cols: 9, len: 0.75, radii: [0.07 * sl, 0.058 * sl, 0.046 * sl, 0.04, 0.045, 0], bulge: [0, 0.01, 0.008, 0, 0], capStart: true, capEnd: true, tint: (u) => (u > 0.8 ? glove : suit) },
      [[Tq, A.sx * 0.13 * sl, A.sh.position.y, 0], [A.sh, 0, 0, 0], [A.el, 0, 0, 0], [A.el, 0, -0.26, 0], [A.el, 0, -0.31, 0], [A.el, 0, -0.36, 0]], [Tq, 0, 0, 1]);
  }
  const mesh = body.build([0, 1, 0], 2.2); mesh.visible = false; r.body.add(mesh);
  return { body, mesh };
}
// close up (or always, for the roster) the smooth body; further off the boxy figure, a few pixels tall, where the
// extra detail would cost frames and show nothing. Call after the pose is set
export function detail(r, D, always = false) {
  const cam = D && D.ctx.camera, near = always || (cam && cam.position.distanceToSquared(r.root.position) < NEAR * NEAR);
  if (near && !r.smooth) r.smooth = smoothBody(r);
  if (!r.smooth) return;
  if (near !== !!r.smoothOn) { r.smoothOn = near; r.smooth.mesh.visible = near; for (const p of r.parts) if (!p.userData.keep) p.visible = !near; }
  if (near) { r.root.updateMatrixWorld(true); sweepTubes(r.body, r.smooth.body); }
}
// a hand's place in the world (call after the pose is set and the matrices updated)
export const handAt = (arm, out) => arm.el.localToWorld(out.set(0, -0.3, 0));

export function relax(r) {
  for (const L of r.legs) { L.hip.rotation.set(0, 0, 0); L.knee.rotation.set(0, 0, 0); }
  for (const a of r.arms) { a.sh.rotation.set(0, 0, a.sx * 0.08); a.el.rotation.set(0, 0, 0); }
  r.torso.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0); r.body.rotation.set(0, 0, 0); r.body.position.y = 0; r.hips.position.y = 0.94;
}
// a sprint at phase ph; k: how hard
function run(r, ph, k) {
  const s = Math.sin(ph), c = Math.cos(ph), L = r.legs, A = r.arms;
  L[0].hip.rotation.set(-s * 1.05 * k, 0, 0); L[1].hip.rotation.set(s * 1.05 * k, 0, 0);
  L[0].knee.rotation.x = (0.15 + Math.max(0, c) * 1.6) * k; L[1].knee.rotation.x = (0.15 + Math.max(0, -c) * 1.6) * k;
  A[0].sh.rotation.set(s * 1.2 * k, 0, -0.12); A[1].sh.rotation.set(-s * 1.2 * k, 0, 0.12);
  A[0].el.rotation.set(-1.4 * k, 0, 0); A[1].el.rotation.set(-1.4 * k, 0, 0);
  r.hips.position.y = 0.94 - 0.07 * k + Math.abs(c) * 0.05 * k;
}
// thrown or held (tumbling), or spinning something round at arm's length
export function tumble(r, t, spinning) {
  if (spinning) { for (const a of r.arms) { a.sh.rotation.set(-1.5, 0, a.sx * 0.15); a.el.rotation.set(0, 0, 0); } return; }
  r.body.rotation.x = t * 9; r.body.rotation.z = Math.sin(t * 5) * 0.5;
  for (const a of r.arms) a.sh.rotation.set(-1.2, 0, a.sx * 1.4);
  for (const L of r.legs) { L.hip.rotation.x = -0.5; L.knee.rotation.x = 0.8; }
}
export function handsOnHips(r) {
  r.legs[0].hip.rotation.z = -0.09; r.legs[1].hip.rotation.z = 0.09;
  for (const a of r.arms) { a.sh.rotation.set(0.15, 0, a.sx * 0.6); a.el.rotation.set(-0.3, 0, -a.sx * 1.7); }
}

const TRAIL_VS = /* glsl */`attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const TRAIL_FS = /* glsl */`uniform vec3 uColor; varying float vA; void main() { gl_FragColor = vec4(uColor * vA, 1.0); }`;
// Blur's streak: a glowing red ribbon along the last half second of his run
class Trail {
  constructor(scene, n = 32) {
    this.n = n; this.pts = []; this.pos = new Float32Array(n * 6); this.al = new Float32Array(n * 2);
    const g = new THREE.BufferGeometry(), idx = [];
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(this.al, 1));
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, uniforms: { uColor: { value: new THREE.Color(1.6, 0.12, 0.06) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; this.mesh.visible = false; scene.add(this.mesh);
  }
  push(x, y, z, t) { const p = this.pts, l = p[p.length - 1]; if (l && Math.hypot(l.x - x, l.z - z) < 0.8) return; p.push({ x, y, z, t }); if (p.length > this.n) p.shift(); }
  sync(t, life = 0.45) {
    const p = this.pts; while (p.length && t - p[0].t > life) p.shift();
    for (let i = 0; i < p.length; i++) { const q = p[i], a = Math.max(0, 1 - (t - q.t) / life); this.pos.set([q.x, q.y + 0.8, q.z, q.x, q.y + 3.7, q.z], i * 6); this.al[i * 2] = a * a; this.al[i * 2 + 1] = a * a * 0.45; }
    const g = this.mesh.geometry; g.setDrawRange(0, Math.max(0, p.length - 1) * 6); g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    this.mesh.visible = p.length > 1;
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

class Villain {
  constructor(V, o) {
    this.V = V; this.D = V.D; this.x = o.x; this.z = o.z; this.y = o.y ?? 0; this.yaw = Math.random() * 6.28; this.t = Math.random() * 5; this.speed = 0; this.player = false; this.hp = 780; this.trapped = 0; this.side = 'villain'; this.busyT = 0;
    this.rig = rig(o.rig); V.scene.add(this.rig.root);
  }
  face(dx, dz, h, k = 8) { if (Math.hypot(dx, dz) < 1e-4) return; let d = Math.atan2(dx, dz) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, h * k); }
  place() { const r = this.rig.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw; }
  ground(x = this.x, z = this.z) { return this.D.ctx.people.groundY(x, z); }
  setPlayer(on) { this.player = on; }
  get gone() { return this.state === 'gone'; }
  // thrown through the air, in someone's grip, or busy spinning something round: nothing else this step
  pre(h) {
    if (this.tossed) { if (tossStep(this, this.D, h) && !this.beaten) this.landed(); return true; }
    if (this.gripped) return true;
    if (this.busyT > 0) { this.busyT -= h; return true; }
    return false;
  }
  landed() {}
  // the hero to go after: each villain has its own rival, otherwise the nearest
  foe() { const pref = { Blur: 'Tempo', Tyrant: 'Nova', Weaver: 'Dragonfly' }[this.name]; let best = null, bd = 170; for (const f of this.D.brawl.fighters('hero')) { const d = Math.hypot(f.x - this.x, f.z - this.z) - (f.name === pref ? 70 : 0); if (d < bd) { bd = d; best = f; } } return best; }
  nearCar(R) { let best = null, bd = R; this.D.ctx.traffic.near(this.x, this.z, R, (c) => { if (c.mode !== 0 || c.mission || c.gone) return; const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < bd) { bd = d; best = c; } }); return best; }
  // people near (x, z) are bowled out to arm's length and run for it
  scatter(x, z, R, push = 3) {
    const { people } = this.D.ctx;
    people.around(x, z, R, (j) => {
      if (!people.hittable(j) || people.st[j] === ST.FROZEN) return;
      const dx = people.x[j] - x, dz = people.z[j] - z, d = Math.hypot(dx, dz) || 1;
      people.move(j, dx / d, dz / d, push); people.panic(j, x, z, -1);
    });
  }
  // cars near (x, z) are knocked aside; nobody is under them when they come down
  knock(x, z, R, sp, up, skip = null) {
    const { traffic } = this.D.ctx;
    traffic.near(x, z, R, (c) => {
      if (c === skip || c.gone || c.mode === EXT || c.mode === AIR) return;
      const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1; if (d > R) return;
      c.soft = true; traffic.fling(c, dx / d * sp, up, dz / d * sp);
    });
  }
  dispose() { this.V.scene.remove(this.rig.root); this.rig.cape.g.dispose(); }
}

// a villain on its own for the roster: Blur and Tyrant hands on hips, Weaver crouched with his six arms out
export function villainModel(name) {
  const r = rig(name === 'Tyrant' ? { eyes: true } : name === 'Weaver' ? { arms: 6, capeLen: 1.05 } : {}); relax(r);
  if (name === 'Weaver') {
    r.hips.position.y = 0.6; r.torso.rotation.x = 0.55; r.head.rotation.x = -0.5; r.legs[0].hip.rotation.set(-1.2, 0, -0.35); r.legs[1].hip.rotation.set(-1.2, 0, 0.35);
    for (const L of r.legs) L.knee.rotation.x = 2.0;
    for (const a of r.arms) { a.sh.rotation.set(-0.7 + a.row * 0.55, 0, a.sx * (0.95 + a.row * 0.2)); a.el.rotation.set(-1.0, 0, -a.sx * 0.3); }
  } else handsOnHips(r);
  r.root.userData.tick = (dt) => r.cape.update(dt, 0.12, 0.35); r.cape.update(0.1, 0.12, 0.35); detail(r, null, true);
  return r.root;
}

// ---------- Blur: faster than anything; straight lines through whatever is in the way
class Blur extends Villain {
  constructor(V, x, z) {
    const B = V.D.ctx.city.bounds, e = Math.floor(Math.random() * 4);
    const sx = e === 0 ? B.x0 - 40 : e === 1 ? B.x1 + 40 : x, sz = e === 2 ? B.z0 - 40 : e === 3 ? B.z1 + 40 : z;
    super(V, { x: sx, z: sz });
    this.name = 'Blur'; this.hint = 'drag and he runs there, straight through everything in the way';
    this.frail = 2; // built for speed, not for taking a hit: a blow lands twice as hard on him
    this.state = 'dash'; this.goal = [x, z]; this.restT = 0; this.ph = 0; this.inB = -1; this.scareT = 0;
    this.trail = new Trail(V.scene);
  }
  pick() { // a busy street some way off
    const { traffic, city } = this.D.ctx, B = city.bounds; let best = -1, at = null;
    for (let n = 0; n < 12; n++) {
      const c = traffic.cars[Math.floor(Math.random() * traffic.cars.length)]; if (!c || c.gone) continue;
      const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < 90 || d > 420) continue;
      let s = Math.random() * 2; traffic.near(c.x, c.z, 20, () => { s++; });
      if (s > best) { best = s; at = [c.x, c.z]; }
    }
    return at || [B.x0 + 40 + Math.random() * (B.x1 - B.x0 - 80), B.z0 + 40 + Math.random() * (B.z1 - B.z0 - 80)];
  }
  breakFree() {
    this.stuck = 0; this.freeT = 4;
    for (const b of this.D.bubbles) if ((this.x - b.x) ** 2 + (2 - b.y) ** 2 + (this.z - b.z) ** 2 < b.R * b.R) b.pop = true;
    this.D.ctx.fire.burst(this.x, 2, this.z, 10, 1.5);
    if (!this.saidFree) { this.saidFree = true; this.D.emit({ type: 'blurfree', text: 'Blur vibrated free of the time bubble!' }); }
    this.go(this.pick());
  }
  // thrown down hard he sees stars for a moment (long enough for a hero to get hold of him again), and the next bubble holds him
  landed() { this.state = 'rest'; this.restT = this.dazed = 1.4; this.speed = 0; this.inB = -1; this.stuck = 0; this.freeT = 0; }
  go(p) { const B = this.D.ctx.city.bounds; if (this.state !== 'dash') sfx('whoosh', this.x, 2, this.z); this.goal = [clamp(p[0], B.x0 + 15, B.x1 - 15), clamp(p[1], B.z0 + 15, B.z1 - 15)]; this.state = 'dash'; this.dazed = 0; }
  leave() { const B = this.D.ctx.city.bounds, a = Math.random() * 6.28; this.goal = [(B.x0 + B.x1) / 2 + Math.cos(a) * 1400, (B.z0 + B.z1) / 2 + Math.sin(a) * 1400]; this.state = 'dash'; this.leaving = true; }
  update(h) {
    this.t += h;
    if (this.state === 'gone') return;
    if (this.pre(h)) return;
    if ((this.freeT = (this.freeT || 0) - h) < 0 && this.D.slowAt(this.x, 2, this.z) < 1) { // caught in a time bubble, running or standing; held 3 s straight, he vibrates free and runs (bubbles can't hold him for 4 s after)
      this.trapped += h; this.stuck = (this.stuck || 0) + h;
      if (this.stuck > 3 && !this.player) this.breakFree();
    } else this.stuck = 0;
    if (this.state === 'rest') {
      this.speed = 0; this.dazed = Math.max(0, (this.dazed || 0) - h);
      if (!this.player && !this.dazed && (this.carT = (this.carT ?? 3) - h) <= 0) { this.carT = 7; const foe = this.foe(), c = foe && this.nearCar(25); if (c) this.D.brawl.throwCar(c, this, foe); } // a car at the hero, at a hundred miles an hour
      if ((this.restT -= h) <= 0 && !this.player) this.go(this.pick());
      return;
    }
    const dx = this.goal[0] - this.x, dz = this.goal[1] - this.z, d = Math.hypot(dx, dz);
    if (d < 1.2) {
      if (this.leaving) { this.state = 'gone'; return; }
      this.state = 'rest'; this.restT = 1 + Math.random() * 2.2; this.speed = 0; this.inB = -1;
      this.D.ctx.fire.dustCloud(this.x, this.z, 2.5, 2.5);
      return;
    }
    this.speed = Math.min(this.leaving ? 80 : 62, this.speed + h * 240, d * 5 + 8);
    const slow = this.freeT > 0 ? 1 : this.D.slowAt(this.x, 2, this.z);
    const ux = dx / d, uz = dz / d, step = Math.min(d, this.speed * h * slow);
    this.face(ux, uz, h, 30); this.ph += h * slow * (5 + this.speed * 0.45);
    for (let done = 0; done < step;) { const s = Math.min(1.2, step - done); this.x += ux * s; this.z += uz * s; done += s; this.tear(ux, uz); this.trail.push(this.x, this.y, this.z, this.V.t); }
    this.y = this.ground();
    if ((this.scareT -= h) <= 0) { this.scareT = 0.3; this.D.ctx.people.scare(this.x, this.z, 24, 0.6); }
  }
  // everything in reach of his path gets out of the way, one way or another
  tear(ux, uz) {
    const D = this.D, { people, traffic, city } = D.ctx, x = this.x, z = this.z, B = city.bounds;
    if (this.leaving && !(x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1)) return;
    people.around(x, z, 3, (j) => { // bowled off to the side of his path
      if (!people.hittable(j) || people.st[j] === ST.FROZEN) return;
      const sd = Math.sign((people.x[j] - x) * uz - (people.z[j] - z) * ux) || 1;
      people.move(j, uz * sd, -ux * sd, 3); people.panic(j, x, z, -1);
    });
    traffic.near(x, z, 3.6, (car) => {
      if (car.gone || car.mode === EXT || car.mode === AIR || Math.hypot(car.x - x, car.z - z) > 3.4) return;
      const sd = Math.sign((car.x - x) * uz - (car.z - z) * ux) || 1; // which side of his path it was on
      car.soft = true; traffic.fling(car, ux * 22 + uz * sd * 12, 5 + Math.random() * 6, uz * 22 - ux * sd * 12); car.ignite = Math.random() < 0.3;
    });
    for (const pc of traffic.parkedNear(x, z, 2.8)) {
      traffic.takeParked(pc); const sd = Math.sign((pc.x - x) * uz - (pc.z - z) * ux) || 1;
      D.debris.add(pc.x, 1, pc.z, 1.9, 1.3, 4.2, pc.hex, 'fly', { v: [ux * 18 + uz * sd * 9, 5 + Math.random() * 5, uz * 18 - ux * sd * 9] });
      D.debris.add(pc.x, 1, pc.z, 0.7, 0.4, 0.9, 0x2a2622, 'fly', { v: [ux * 12 + (Math.random() - 0.5) * 8, 6, uz * 12 + (Math.random() - 0.5) * 8] });
    }
    for (const it of city.takeStreetNear(x, z, 1.4)) D.debris.add(it.x, 1.5, it.z, 0.4, 2.6, 0.4, 0x5a4632, 'fly', { v: [ux * 14 + (Math.random() - 0.5) * 4, 4, uz * 14 + (Math.random() - 0.5) * 4] });
    let inside = -1; city.buildingsNear(x, z, 0.1, (k, dd) => { if (dd === 0) inside = k; });
    if (inside !== this.inB) { if (this.inB >= 0) this.burst(this.inB, ux, uz, true); if (inside >= 0) this.burst(inside, ux, uz, false); this.inB = inside; }
  }
  // he bursts in through one wall and out through the other
  burst(k, ux, uz, out) {
    const D = this.D, { city, fire } = D.ctx, b = city.buildings[k]; if (!b || city.dead[k]) return;
    const hgt = b.top - b.baseY, wc = b.wallCol, hex = new THREE.Color(wc[0], wc[1], wc[2]).getHex(), f = out ? 1 : -0.5;
    for (let i = 0; i < 10; i++) { const s = 0.4 + Math.random() * 1.2, sp = 8 + Math.random() * 12; D.debris.add(this.x, 0.6 + Math.random() * 4, this.z, s, s * 0.6, s, Math.random() < 0.7 ? hex : 0xb4d6de, 'fly', { v: [ux * f * sp + (Math.random() - 0.5) * 6, 2 + Math.random() * 5, uz * f * sp + (Math.random() - 0.5) * 6] }); }
    fire.dustCloud(this.x, this.z, 3, 5);
    if (out) { if (hgt < 9 && Math.random() < 0.7) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(uz, ux), spare: true, noCrush: true }); else D.blowWindows(k, ux, uz, 0.6); }
    if (this.V.near(this.x, this.z)) D.shake(0.12);
  }
  pDown(x, z) { this.go([x, z]); }
  pMove(x, z) { this.go([x, z]); }
  pUp() {}
  sync(dt) {
    const r = this.rig; this.trail.sync(this.V.t);
    r.root.visible = this.state !== 'gone'; if (!r.root.visible) return;
    this.place(); relax(r);
    const k = Math.min(1, this.speed / 14);
    if (k > 0.02) { run(r, this.ph, k); r.torso.rotation.x = 0.55 * k; r.body.rotation.x = 0.12 * k; r.head.rotation.x = -0.4 * k; }
    else if (this.dazed > 0) { r.body.rotation.z = Math.sin(this.t * 4) * 0.12; r.torso.rotation.x = 0.35; r.head.rotation.set(0.3, Math.sin(this.t * 3) * 0.4, Math.sin(this.t * 6) * 0.3); for (const a of r.arms) { a.sh.rotation.set(-0.3, 0, a.sx * 0.5); a.el.rotation.set(-0.6, 0, 0); } } // seeing stars, swaying on his feet
    else { handsOnHips(r); r.torso.rotation.x = Math.sin(this.t * 1.6) * 0.02; r.head.rotation.y = Math.sin(this.t * 0.7) * 0.5; } // between runs, weighing up where to go next
    if (this.tossed || this.gripped || this.spinning) tumble(r, this.t, this.spinning);
    r.cape.update(dt, Math.min(1, this.speed / 35), Math.min(1, this.speed / 25) + 0.15); detail(r, this.D);
  }
  dispose() { super.dispose(); this.trail.dispose(this.V.scene); }
}

// ---------- Tyrant: flies, throws cars and buildings at each other, lasers from his eyes
class Tyrant extends Villain {
  constructor(V, x, z) {
    super(V, { x, z, y: 240, rig: { eyes: true } });
    this.name = 'Tyrant'; this.hint = 'tap a car or a building to grab it, tap again to throw it there; hold to fire his laser eyes';
    this.state = 'arrive'; this.vx = this.vy = this.vz = 0; this.plan = null; this.held = null; this.ray = null; this.rayT = 2.5; this.wind = 0; this.after = 0; this.flying = []; this.pitch = 0; this.hs = 0;
    this.beams = [0, 1].map(() => { const b = strand(V.scene, kit().laser); b.renderOrder = 8; return b; });
  }
  landed() { this.state = 'stand'; this.standT = 1.2; this.vx = this.vy = this.vz = 0; }
  dropHeld() { const H = this.held; if (!H) return; if (H.car) { H.car.soft = true; this.D.ctx.traffic.fling(H.car, 0, -1, 0); } else this.flying.push({ shell: H.shell, k: H.k, x: H.shell.position.x, y: H.shell.position.y + H.base, z: H.shell.position.z, vx: 0, vy: 0, vz: 0, w: 0.3, w2: 0.1, half: H.half, hgt: H.hgt, base: H.base, hex: H.hex }); this.held = null; this.plan = null; this.wind = 0; }
  // the laser eyes on something in the air (a car thrown at him); done() once it is cut through
  zap(car, done) { if (this.ray || this.state !== 'fly' || this.held) return false; this.ray = { car, done, t: 0, dur: 0.45, ex: car.x, ey: car.y || 0, ez: car.z }; sfx('laser', this.x, this.y + 4, this.z, { gain: 0.8, rate: 1.2 }); return true; }
  flyY() {
    const city = this.D.ctx.city;
    if (this.held && this.held.shell) { const r = this.held.half + 8; return Math.max(24, roofTop(city, this.x, this.z, r).top + 1.5, roofTop(city, this.x + this.vx * 1.5, this.z + this.vz * 1.5, r).top + 1.5); } // the building overhead clears the roofs below, and those just ahead
    return Math.max(28, roofTop(city, this.x, this.z, 12).top + 10);
  }
  update(h) {
    this.t += h;
    this.flyStep(h);
    if (this.state === 'gone') return;
    if (this.pre(h)) return;
    if (this.state === 'arrive') {
      const gy = this.ground(); this.vy = Math.max(-70, this.vy - G * 2.5 * h); this.y += this.vy * h;
      if (this.y <= gy) { this.y = gy; this.vy = 0; this.slam(); this.state = 'stand'; this.standT = 1.5; }
      return;
    }
    if (this.state === 'stand') { if ((this.standT -= h) <= 0) this.state = 'fly'; return; }
    if (this.state === 'leave') { this.vy = Math.min(45, this.vy + h * 25); this.y += this.vy * h; if (this.y > 330) this.state = 'gone'; return; }
    if (this.held) this.carry(h);
    if (this.wind > 0) { this.wind -= h; this.hover(h); if (this.wind <= 0) this.release(); }
    else {
      if (!this.plan && !this.player) this.choose();
      const g = this.goal(), d = this.steer(g[0], g[1], g[2], h, this.held && this.held.shell ? 16 : 26, this.plan && (this.plan.kind === 'car' || this.plan.kind === 'brawl') ? 14 : 0); // a moving car needs catching up with
      this.arrived(d, h);
    }
    this.after = Math.max(0, this.after - h);
    if (this.ray && this.hs < 8) this.face(this.ray.ex - this.x, this.ray.ez - this.z, h, 4);
    if (this.player) this.pTick();
    else if (!this.ray && !this.wind && (this.rayT -= h) <= 0) { this.rayT = 2.2 + Math.random() * 2.2; this.fireAt(); }
    this.rayStep(h);
  }
  steer(gx, gy, gz, h, top, extra = 0) {
    const dx = gx - this.x, dy = gy - this.y, dz = gz - this.z, d = Math.hypot(dx, dy, dz), sp = Math.min(top, d * 1.4 + (d > 1 ? extra : 0)), f = Math.min(1, h * 2.2);
    if (d > 0.01) { this.vx += (dx / d * sp - this.vx) * f; this.vy += (dy / d * sp - this.vy) * f; this.vz += (dz / d * sp - this.vz) * f; }
    this.x += this.vx * h; this.y = Math.max(this.ground(), this.y + this.vy * h); this.z += this.vz * h;
    this.hs = Math.hypot(this.vx, this.vz); if (this.hs > 1) this.face(this.vx, this.vz, h, 4);
    return d;
  }
  hover(h) { const f = Math.exp(-3 * h); this.vx *= f; this.vy *= f; this.vz *= f; this.x += this.vx * h; this.y += this.vy * h; this.z += this.vz * h; this.hs = Math.hypot(this.vx, this.vz); }
  // where the current plan wants him: [x, y, z]
  goal() {
    const P = this.plan;
    if (!P) return [this.x, this.flyY(), this.z];
    if (P.kind === 'brawl') return [P.foe.x, P.foe.y + 1, P.foe.z];
    if (P.kind === 'car') { const c = P.car, hd = Math.hypot(c.x - this.x, c.z - this.z); return [c.x, hd < 20 ? (c.y || 0) + 1.2 : Math.max(this.flyY(), 22), c.z]; }
    if (P.kind === 'bld') { const hd = Math.hypot(P.bx - this.x, P.bz - this.z); return [P.bx, hd < 16 ? P.gy : Math.max(this.flyY(), P.top + 6), P.bz]; }
    if (P.kind === 'aim') {
      if (P.tx == null) return [this.x, this.flyY(), this.z];
      const d = Math.hypot(P.tx - this.x, P.tz - this.z) || 1;
      return d < 80 ? [this.x, this.flyY(), this.z] : [P.tx + (this.x - P.tx) / d * 65, this.flyY(), P.tz + (this.z - P.tz) / d * 65];
    }
    return [P.x, this.flyY(), P.z];
  }
  arrived(d, h) {
    const P = this.plan; if (!P) return;
    if ((P.t = (P.t || 0) + h) > 20 && P.kind !== 'aim') { this.plan = null; return; } // gave up on it
    if (P.kind === 'brawl') { const f = P.foe; if (!f || f.state !== 'fly' || f.tossed || f.gripped) { this.plan = null; return; } if (Math.hypot(f.x - this.x, f.y - this.y, f.z - this.z) < 6) { if (Math.random() < 0.45 && this.D.brawl.drag(this, f)) this.busyT = 3; else this.D.brawl.grab(this, f); this.plan = null; } return; } // through a building, or by the throat down the street
    if (P.kind === 'car') {
      const c = P.car;
      if (this.held || c.gone || c.mode === EXT || c.mode === AIR) { this.plan = null; return; }
      if (Math.hypot(c.x - this.x, c.z - this.z) < 3 && Math.abs((c.y || 0) + 1.2 - this.y) < 2.5 && this.D.ctx.traffic.grab(c)) { this.held = { car: c, t: 0, y0: c.y || 0 }; this.plan = { kind: 'aim' }; this.pickThrow(); }
    } else if (P.kind === 'bld') {
      if (this.held || this.D.ctx.city.dead[P.k]) { this.plan = null; return; }
      if (Math.hypot(P.bx - this.x, P.bz - this.z) < 3 && this.y < P.gy + 2.5) this.lift(P.k);
    } else if (P.kind === 'aim') {
      if (!this.held) { this.plan = null; return; }
      if (P.foe) { if (P.foe.state !== 'fly') P.foe = null; else { P.tx = P.foe.x; P.tz = P.foe.z; P.ty = P.foe.y; } }
      if (P.tx == null) this.pickThrow();
      if (Math.hypot(P.tx - this.x, P.tz - this.z) < 80 && (!this.held.shell || this.held.t >= 1)) this.wind = 0.45;
    } else if (d < 6) this.plan = null;
  }
  choose() {
    const { traffic, city } = this.D.ctx, r = Math.random();
    const foe = this.foe(); this.foeNow = null;
    if (foe && Math.random() < 0.8) { // the heroes are here: go for one, hands on, or with a car
      if (Math.random() < 0.45) { this.plan = { kind: 'brawl', foe }; return; }
      const c = this.nearCar(130); if (c) { this.plan = { kind: 'car', car: c }; this.foeNow = foe; return; }
    }
    if (r < 0.45) {
      let best = null, bd = 1e9;
      traffic.near(this.x, this.z, 170, (c) => { if (c.mode !== DRIVE || c.gone || c.mission) return; const d = Math.hypot(c.x - this.x, c.z - this.z) + Math.random() * 60; if (d < bd) { bd = d; best = c; } });
      if (best) { this.plan = { kind: 'car', car: best }; return; }
    }
    if (r < 0.8) {
      const ks = [];
      city.buildingsNear(this.x, this.z, 150, (k, d, b) => { const hgt = b.top - b.baseY; if (!b.landmark && hgt > 5 && hgt < 34 && b.x1 - b.x0 < 26 && b.z1 - b.z0 < 26 && d > 10) ks.push(k); });
      if (ks.length) { this.grabBld(ks[Math.floor(Math.random() * ks.length)]); return; }
    }
    const B = city.bounds;
    this.plan = { kind: 'go', x: clamp(this.x + (Math.random() - 0.5) * 300, B.x0 + 40, B.x1 - 40), z: clamp(this.z + (Math.random() - 0.5) * 300, B.z0 + 40, B.z1 - 40) };
  }
  // he lands in the street beside it, on the side nearest him, and lifts it from there
  grabBld(k) {
    const b = this.D.ctx.city.buildings[k], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    let bx = clamp(this.x, b.x0, b.x1), bz = clamp(this.z, b.z0, b.z1);
    if (bx === this.x && bz === this.z) bx = b.x0;
    if (Math.abs(bx - cx) / (b.x1 - b.x0) >= Math.abs(bz - cz) / (b.z1 - b.z0)) bx += Math.sign(bx - cx || -1) * 3; else bz += Math.sign(bz - cz || -1) * 3;
    this.plan = { kind: 'bld', k, bx, bz, gy: this.ground(bx, bz), top: b.top };
  }
  lift(k) {
    const D = this.D, { city, people, fire } = D.ctx, b = city.buildings[k];
    if (!b || city.dead[k]) { this.plan = null; return; }
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, wc = b.wallCol;
    people.clearBuilding(k, 'spare'); fire.gone(k); // everyone inside gets out and runs
    const shell = city.extractBuilding(k); city.hideBuilding(k); this.V.scene.add(shell);
    D.decals.add('scour', cx, cz, (b.x1 - b.x0) * 0.7, (b.z1 - b.z0) * 0.7); fire.dustCloud(cx, cz, Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.6, 8);
    D.stats.buildings++; D.emit({ type: 'collapse', k, how: 'lift', x: cx, z: cz });
    if (this.V.near(cx, cz)) D.shake(0.4);
    this.held = { shell, k, ox: cx, oz: cz, base: b.baseY, hgt: b.top - b.baseY, half: Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2, hex: new THREE.Color(wc[0], wc[1], wc[2]).getHex(), t: 0 };
    this.plan = { kind: 'aim' }; this.pickThrow();
  }
  carry(h) {
    const H = this.held;
    if (H.car) {
      const c = H.car; if (c.mode !== EXT) { this.held = null; return; }
      H.t = Math.min(1, H.t + h * 2.5); c.x = this.x; c.z = this.z; c.y = lerp(H.y0, this.y + HANDS, H.t); c.yaw = -this.yaw; c.roll = 0; c.pitch = 0;
      return;
    }
    H.t = Math.min(1, H.t + h / 1.5);
    const ss = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }, ky = ss(0, 0.55, H.t), kx = ss(0.35, 1, H.t); // straight up out of its plot first, then across to him
    H.shell.position.set(lerp(H.ox, this.x, kx), lerp(0, this.y + HANDS - H.base, ky), lerp(H.oz, this.z, kx)); H.shell.rotation.y += h * 0.15;
    // it never passes through another building: whatever it would touch it smashes into, and he heaves it up over
    const city = this.D.ctx.city, sx = H.shell.position.x, sz = H.shell.position.z, bottom = H.shell.position.y + H.base;
    let need = 0;
    city.buildingsNear(sx, sz, H.half * 0.7, (k, d, b) => {
      if (k === H.k || city.dead[k] || b.top <= bottom + 0.5) return;
      need = Math.max(need, b.top - bottom + 1);
      if (!H.scraped) H.scraped = new Set();
      if (!H.scraped.has(k)) { H.scraped.add(k); this.smash(k, sx, b.top - 2, sz, this.vx, this.vz); }
    });
    if (need > 0) { this.y += need; H.shell.position.y += need; this.vy = Math.max(this.vy, 4); }
  }
  // what to throw it at: usually a building (the taller the better), sometimes a car
  pickThrow() {
    const P = this.plan, { city, traffic } = this.D.ctx, ks = [];
    if (this.foeNow && this.foeNow.state === 'fly') { P.foe = this.foeNow; P.tx = P.foe.x; P.tz = P.foe.z; P.ty = P.foe.y; P.k = -1; return; } // at the hero
    city.buildingsNear(this.x, this.z, 170, (k, d, b) => { if (d > 35) ks.push([k, b]); });
    if (ks.length && Math.random() < 0.75) {
      ks.sort((a, b) => b[1].top - a[1].top); const [k, b] = ks[Math.floor(Math.random() * Math.min(8, ks.length))];
      P.k = k; P.tx = (b.x0 + b.x1) / 2; P.tz = (b.z0 + b.z1) / 2; P.ty = Math.min(b.top * 0.6, 30); return;
    }
    let c = null; traffic.near(this.x, this.z, 160, (o) => { if (!c && o.mode === DRIVE && !o.gone && Math.hypot(o.x - this.x, o.z - this.z) > 40) c = o; });
    const B = city.bounds;
    P.k = -1; P.ty = 0;
    if (c) { P.tx = c.x; P.tz = c.z; } else { P.tx = clamp(this.x + (Math.random() - 0.5) * 200, B.x0 + 30, B.x1 - 30); P.tz = clamp(this.z + (Math.random() - 0.5) * 200, B.z0 + 30, B.z1 - 30); }
  }
  release() {
    const H = this.held, P = this.plan; this.wind = 0;
    if (!H || !P || P.tx == null) { this.plan = null; return; }
    const x0 = this.x, y0 = this.y + HANDS, z0 = this.z, d = Math.hypot(P.tx - x0, P.tz - z0), T = clamp(d / 30, 0.9, 2.6);
    const vx = (P.tx - x0) / T, vz = (P.tz - z0) / T, vy = (P.ty - y0 + 0.5 * G * T * T) / T;
    if (H.car && P.foe && P.foe.state === 'fly') this.D.brawl.throwCar(H.car, this, P.foe); // the hero can catch it, or not
    else if (H.car) { H.car.soft = true; this.D.ctx.traffic.fling(H.car, vx, vy, vz); this.flying.push({ car: H.car, px: H.car.x, pz: H.car.z }); }
    else this.flying.push({ shell: H.shell, k: H.k, x: H.shell.position.x, y: y0, z: H.shell.position.z, vx, vy, vz, w: (Math.random() - 0.5) * 1.6, w2: (Math.random() - 0.5) * 0.7, half: H.half, hgt: H.hgt, base: H.base, hex: H.hex });
    this.held = null; this.plan = null; this.after = 0.45;
  }
  // thrown things in flight: what they hit
  flyStep(h) {
    const { city } = this.D.ctx;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      if (f.car) {
        const c = f.car;
        if (c.mode !== AIR) { this.bump(c); this.flying.splice(i, 1); continue; }
        let hit = -1; city.buildingsNear(c.x, c.z, 0.3, (k, d, b) => { if (d === 0 && (c.y || 0) < b.top) hit = k; });
        if (hit >= 0) { this.smash(hit, c.x, c.y || 0, c.z, c.vx, c.vz); c.x = f.px; c.z = f.pz; c.vx *= -0.1; c.vz *= -0.1; c.vy = Math.min(c.vy, 0); this.flying.splice(i, 1); continue; }
        f.px = c.x; f.pz = c.z;
        continue;
      }
      if (f.caught) continue; // a hero has it
      const hs = h * this.D.slowAt(f.x, f.y, f.z);
      f.vy -= G * hs; f.x += f.vx * hs; f.y += f.vy * hs; f.z += f.vz * hs;
      f.shell.position.set(f.x, f.y - f.base, f.z); f.shell.rotation.y += f.w * hs; f.shell.rotation.x += f.w2 * hs;
      let hit = false; city.buildingsNear(f.x, f.z, f.half * 0.6, (k, d, b) => { if (b.top > f.y + 1) hit = true; });
      if (hit || f.y <= this.ground(f.x, f.z) + 0.5) { this.crash(f); this.flying.splice(i, 1); }
    }
  }
  // a thrown car comes down: the cars round it are knocked aside
  bump(c) { this.knock(c.x, c.z, 5, 7, 4, c); this.D.ctx.people.scare(c.x, c.z, 14, 0.9); this.D.ctx.fire.burst(c.x, 1, c.z, 10, 1.8); }
  // a thrown car hits a building: small ones come down, big ones lose their windows and may catch fire
  smash(k, x, y, z, vx, vz) {
    const D = this.D, { city, fire } = D.ctx, b = city.buildings[k];
    fire.burst(x, y + 1, z, 18, 2.4); fire.dustCloud(x, z, 4, Math.min(20, y + 6));
    if (b.top - b.baseY < 16) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(vz, vx), spare: true, noCrush: true });
    else { D.blowWindows(k, vx, vz, 0.8); if (Math.random() < 0.6) fire.igniteBuilding(k); }
    if (this.V.near(x, z)) D.shake(0.3);
  }
  // a thrown building lands: it brings down what it hits and breaks up
  crash(f) {
    const D = this.D, { city, fire } = D.ctx, R = f.half + 4, dir = Math.atan2(f.vz, f.vx);
    city.buildingsNear(f.x, f.z, R, (k, d, b) => { if (b.top - b.baseY < 70 || d < 2) D.destroyBuilding(k, 'collapse', { dir, spare: true, noCrush: true }); else { D.blowWindows(k, f.vx, f.vz, 1); fire.igniteBuilding(k); } });
    this.knock(f.x, f.z, R + 6, 14, 6); this.scatter(f.x, f.z, R + 10, 3);
    fire.dustCloud(f.x, f.z, f.half * 1.6, f.hgt);
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, sp = 5 + Math.random() * 9, s = 0.7 + Math.random() * 1.8; D.debris.add(f.x + Math.cos(a) * f.half * 0.5, Math.max(1, f.y) + Math.random() * 5, f.z + Math.sin(a) * f.half * 0.5, s, s * 0.6, s, Math.random() < 0.7 ? f.hex : 0x6a6660, 'fly', { v: [Math.cos(a) * sp, 3 + Math.random() * 6, Math.sin(a) * sp] }); }
    const gy = this.ground(f.x, f.z);
    if (f.y > gy + 6) D.debris.addObject(f.shell, 'fly', { v: [f.vx * 0.1, -2, f.vz * 0.1] });
    else { f.shell.position.y = gy - f.base; f.shell.rotation.set(0, f.shell.rotation.y, 0); D.debris.addObject(f.shell, 'sink', { dur: 1.6, h: f.hgt, dir }); }
    if (this.V.near(f.x, f.z)) D.shake(0.9);
  }
  // touching down: a shockwave that rocks cars and blows out the nearest windows
  slam() {
    const D = this.D, { city, fire } = D.ctx, x = this.x, z = this.z;
    this.scatter(x, z, 16, 3); this.knock(x, z, 14, 10, 4);
    city.buildingsNear(x, z, 8, (k, d, b) => D.blowWindows(k, (b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z, 0.7));
    D.decals.add('crack', x, z, 14, 14); fire.dustCloud(x, z, 12, 6); fire.burst(x, 0.5, z, 30, 2.5);
    if (this.V.near(x, z)) D.shake(0.9);
  }
  // the laser eyes: a sweep along a line that scorches the street, sets cars alight and chars walls
  fireAt(tx, tz, short) {
    const { city, traffic } = this.D.ctx; let x0, z0, y0 = 0.5;
    if (tx != null) { x0 = tx; z0 = tz; }
    else if (Math.random() < 0.5) {
      const ks = []; city.buildingsNear(this.x, this.z, 70, (k) => ks.push(k)); if (!ks.length) return;
      const b = city.buildings[ks[Math.floor(Math.random() * ks.length)]]; x0 = clamp(this.x, b.x0, b.x1); z0 = clamp(this.z, b.z0, b.z1); y0 = b.baseY + (b.top - b.baseY) * (0.3 + Math.random() * 0.6);
    } else { let c = null; traffic.near(this.x, this.z, 70, (o) => { if (!c && !o.gone && o.mode === DRIVE) c = o; }); if (!c) return; x0 = c.x; z0 = c.z; }
    const a = Math.random() * 6.28, L = short ? 5 : 12 + Math.random() * 12;
    this.ray = { x0: x0 - Math.cos(a) * L / 2, z0: z0 - Math.sin(a) * L / 2, x1: x0 + Math.cos(a) * L / 2, z1: z0 + Math.sin(a) * L / 2, y0, t: 0, dur: short ? 0.5 : 1.6, hitT: 0, charred: new Set(), ex: x0, ey: y0, ez: z0 };
    sfx('laser', this.x, this.y + 4, this.z, { rate: short ? 1.15 : 1 });
  }
  rayStep(h) {
    const R = this.ray; if (!R) return;
    if (R.car) { R.t += h; R.ex = R.car.x; R.ey = R.car.y || 0; R.ez = R.car.z; if (R.t >= R.dur) { this.ray = null; if (!R.car.gone) R.done(); } return; } // tracking a car in the air till it is cut in two
    R.t += h; const k = Math.min(1, R.t / R.dur), x = lerp(R.x0, R.x1, k), z = lerp(R.z0, R.z1, k);
    R.ex = x; R.ez = z; R.ey = R.y0 > 1 ? R.y0 - k * (R.y0 - 1) * 0.6 : 0.4;
    if ((R.hitT -= h) <= 0) {
      R.hitT = 0.1; const { people, traffic, city, fire } = this.D.ctx;
      fire.burst(x, R.ey, z, 5, 1.5);
      traffic.near(x, z, 3.5, (c) => { if (!c.gone && c.mode !== EXT && c.mode !== AIR && Math.hypot(c.x - x, c.z - z) < 3.2) this.V.torch(c); });
      city.buildingsNear(x, z, 2.5, (kb) => { if (R.charred.has(kb)) return; R.charred.add(kb); city.char(kb, 0.75); if (Math.random() < 0.3) fire.igniteBuilding(kb); });
      people.scare(x, z, 12, 0.9);
      if (Math.random() < 0.3) this.D.decals.add('scour', x, z, 3.5, 3.5);
    }
    if (k >= 1) this.ray = null;
  }
  leave() {
    const H = this.held;
    if (H && H.car) { H.car.soft = true; this.D.ctx.traffic.fling(H.car, 0, -1, 0); }
    else if (H) this.flying.push({ shell: H.shell, k: H.k, x: H.shell.position.x, y: H.shell.position.y + H.base, z: H.shell.position.z, vx: 0, vy: 0, vz: 0, w: 0.3, w2: 0.1, half: H.half, hgt: H.hgt, base: H.base, hex: H.hex });
    this.held = null; this.plan = null; this.ray = null; this.wind = 0; this.state = this.state === 'gone' ? 'gone' : 'leave'; this.vy = 0;
  }
  // in Be The Disaster: a quick tap grabs what is nearest, or throws what he holds; holding fires the lasers
  pDown(x, z) { this.pf = [x, z]; this.pt = now(); this.pHeld = true; }
  pMove(x, z) { this.pf = [x, z]; }
  pUp() {
    this.pHeld = false;
    if (now() - this.pt > 260 || this.state !== 'fly' || this.wind > 0) return;
    const [x, z] = this.pf, { traffic, city } = this.D.ctx;
    if (this.held) { let ty = 0; city.buildingsNear(x, z, 0.3, (k, d, b) => { if (d === 0) ty = Math.min(b.top * 0.6, 30); }); this.plan = { kind: 'aim', tx: x, tz: z, ty, k: -1 }; return; }
    let best = null, bd = 25;
    traffic.near(x, z, 25, (c) => { if (c.mode !== DRIVE || c.gone || c.mission) return; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } });
    if (best) { this.plan = { kind: 'car', car: best }; return; }
    let bk = -1; city.buildingsNear(x, z, 6, (k, d, b) => { if (bk < 0 && !b.landmark && b.top - b.baseY < 60 && b.x1 - b.x0 < 34 && b.z1 - b.z0 < 34) bk = k; });
    if (bk >= 0) { this.grabBld(bk); return; }
    this.plan = { kind: 'go', x, z };
  }
  pTick() {
    if (!this.pHeld || now() - this.pt < 260 || this.ray || this.wind > 0) return;
    const [x, z] = this.pf;
    if (Math.hypot(x - this.x, z - this.z) > 90 && !this.held) this.plan = { kind: 'go', x, z };
    else this.fireAt(x, z, true);
  }
  sync(dt, realT) {
    const r = this.rig; r.root.visible = this.state !== 'gone';
    for (const b of this.beams) b.visible = false;
    if (!r.root.visible) return;
    this.place(); relax(r);
    const A = r.arms, flying = this.state !== 'stand';
    let pitch = 0;
    if (this.held) { for (const a of A) { a.sh.rotation.set(-2.85, 0, a.sx * 0.28); a.el.rotation.set(-0.25, 0, 0); } } // holding it up over his head
    if (this.wind > 0) { for (const a of A) a.sh.rotation.set(-2.4, 0, a.sx * 0.3); r.torso.rotation.x = -0.35; }
    else if (this.after > 0) { for (const a of A) { a.sh.rotation.set(-1.3, 0, a.sx * 0.15); a.el.rotation.set(0, 0, 0); } r.torso.rotation.x = 0.3; }
    else if (!this.held && this.state === 'fly' && this.hs > 8 && !this.ray) { // flying flat out, one fist forward
      pitch = 1.35 * Math.min(1, (this.hs - 8) / 12);
      A[1].sh.rotation.set(-3.0, 0, 0.1); A[0].sh.rotation.set(0.25, 0, -0.1);
    } else if (!this.held && this.state === 'stand') handsOnHips(r);
    else if (!this.held) { for (const a of A) a.sh.rotation.set(0.1, 0, a.sx * 0.3); }
    if (flying && pitch < 0.5) { for (const L of r.legs) { L.hip.rotation.x = 0.12; L.knee.rotation.x = 0.3; } r.legs[1].hip.rotation.x = 0.2; }
    this.pitch += (pitch - this.pitch) * Math.min(1, dt * 3); r.body.rotation.x = this.pitch; r.head.rotation.x = -this.pitch * 0.6;
    if (flying) r.body.position.y = Math.sin(this.t * 2) * 0.25;
    if (this.tossed || this.gripped || this.spinning) tumble(r, this.t, this.spinning);
    r.cape.update(dt, this.pitch > 0.5 ? 0.12 : Math.min(0.6, this.hs / 30), 0.3 + Math.min(0.7, this.hs / 20)); detail(r, this.D);
    const R = this.ray;
    if (R && r.eyes) {
      r.root.updateMatrixWorld(true);
      for (let i = 0; i < 2; i++) { r.eyes[i].getWorldPosition(_w); aim(this.beams[i], _w.x, _w.y, _w.z, R.ex + (i - 0.5) * 0.6, R.ey, R.ez, 0.12 + Math.sin(realT * 50 + i) * 0.03); this.beams[i].visible = true; }
    }
  }
  dispose() {
    const sc = this.V.scene; super.dispose();
    for (const b of this.beams) sc.remove(b);
    if (this.held && this.held.shell) dropShell(sc, this.held.shell);
    for (const f of this.flying) if (f.shell) dropShell(sc, f.shell);
    this.flying.length = 0; this.held = null;
  }
}

// a web over the street: everyone and every car that comes into it sticks fast until it gives way
const WEB_VS = /* glsl */`varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WEB_FS = /* glsl */`
uniform float uA, uLight; varying vec2 vP;
void main() {
  float r = length(vP); if (r > 1.0) discard;
  float a = atan(vP.y, vP.x);
  float sp = abs(sin(a * 8.0)) * r;
  float spoke = 1.0 - smoothstep(0.0, fwidth(sp) * 1.5 + 0.002, sp);
  float q = r * 9.0 + a / 6.2831853;
  float d = abs(fract(q + 0.5) - 0.5);
  float thread = (1.0 - smoothstep(0.0, min(fwidth(q), 0.25) * 1.4, d)) * step(0.1, r);
  float hub = 1.0 - smoothstep(0.05, 0.1, r);
  float al = max(max(spoke, thread), hub * 0.8) * (1.0 - smoothstep(0.9, 1.0, r) * 0.6);
  gl_FragColor = vec4(vec3(0.95, 0.94, 0.9) * uLight, al * uA * 0.92);
}`;
class Web {
  constructor(V, x, z, R) {
    const { city } = V.D.ctx;
    this.V = V; this.x = x; this.z = z; this.R = R; this.t = 0; this.life = 45; this.people = []; this.cars = []; this.scanT = 0; this.alive = true;
    this.mat = new THREE.ShaderMaterial({ vertexShader: WEB_VS, fragmentShader: WEB_FS, uniforms: { uA: { value: 0 }, uLight: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(kit().disc, this.mat); this.mesh.position.set(x, 0.32, z); this.mesh.scale.set(R, 1, R); this.mesh.rotation.y = Math.random() * 6.28; this.mesh.renderOrder = 3; V.scene.add(this.mesh);
    // guy lines from its rim up to the walls around it
    this.strands = []; const ks = [];
    city.buildingsNear(x, z, R + 14, (k, d, b) => { if (d > R * 0.9) ks.push([d, b]); });
    ks.sort((a, b) => a[0] - b[0]);
    for (const [, b] of ks.slice(0, 5)) {
      const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1), dx = cx - x, dz = cz - z, dl = Math.hypot(dx, dz) || 1, hy = Math.min(b.top - 0.5, 4 + Math.random() * 7);
      const m = strand(V.scene); aim(m, x + dx / dl * R * 0.92, 0.35, z + dz / dl * R * 0.92, cx, hy, cz, 0.07); m.visible = true; this.strands.push(m);
    }
  }
  update(h) {
    this.t += h; const u = this.mat.uniforms; u.uA.value = Math.max(0, Math.min(1, this.t * 4, (this.life - this.t) / 2)); u.uLight.value = this.V.D.lightK;
    if (this.t >= this.life) { this.release(); return; }
    if ((this.scanT -= h) > 0) return;
    this.scanT = 0.3;
    const { people, traffic } = this.V.D.ctx;
    people.around(this.x, this.z, this.R * 0.95, (j) => { if (people.web(j)) this.people.push(j); });
    traffic.near(this.x, this.z, this.R + 2, (c) => {
      if (c.webbed || c.eaten || c.gone || c.mission || c.mode !== DRIVE || c.frozen || Math.hypot(c.x - this.x, c.z - this.z) > this.R) return;
      c.frozen = true; c.v = 0; c.webbed = this; this.V.tintWeb(c); this.cars.push(c);
    });
  }
  release() {
    if (!this.alive) return;
    this.alive = false;
    const { people, traffic } = this.V.D.ctx;
    for (const j of this.people) people.unweb(j);
    for (const c of this.cars) if (c.webbed === this) { c.webbed = null; c.frozen = false; if (c.mode === DRIVE) traffic.tint(c, c.colHex); }
  }
  dispose() { const sc = this.V.scene; sc.remove(this.mesh); this.mat.dispose(); for (const m of this.strands) sc.remove(m); }
}

// ---------- Weaver: six arms, swings from roof to roof, webs the streets, acid on whatever cars get stuck
class Weaver extends Villain {
  constructor(V, x, z) {
    super(V, { x, z, rig: { arms: 6, capeLen: 1.05 } });
    this.name = 'Weaver'; this.hint = 'tap the street to shoot a web there; hold and let go somewhere to swing that way. His acid eats the cars his webs catch';
    this.webs = []; this.webT = 1.5; this.spitT = 2.5; this.perchT = 7; this.swing = null; this.act = 0; this.spat = 0;
    this.line = strand(V.scene);
    const k = this.roofNear(x, z, 80);
    if (k >= 0) { const [px, pz] = this.spot(k, x, z); this.x = px; this.z = pz; this.perchK = k; this.dropTo = V.D.ctx.city.buildings[k].roofY; }
    else { this.perchK = -1; this.dropTo = this.ground(); }
    this.y = this.dropTo + 80; this.anchor = [this.x, this.dropTo + 130, this.z]; this.state = 'drop'; // down a thread from the sky
  }
  roofNear(x, z, R) { let best = -1, bd = 1e9; this.D.ctx.city.buildingsNear(x, z, R, (k, d, b) => { if (b.roofY >= 9 && !b.landmark && d < bd) { bd = d; best = k; } }); return best; }
  // where to stand on roof k: at the edge facing (tx, tz)
  spot(k, tx, tz) { const city = this.D.ctx.city, r = city.buildings[k].roof; return r.x1 > r.x0 + 1.2 && r.z1 > r.z0 + 1.2 ? city.roofPoint(k, tx, tz) : [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]; }
  update(h) {
    this.t += h; this.act = Math.max(0, this.act - h); this.spat = Math.max(0, this.spat - h);
    for (let i = this.webs.length - 1; i >= 0; i--) { const w = this.webs[i]; w.update(h); if (!w.alive) { w.dispose(); this.webs.splice(i, 1); } }
    if (this.state === 'gone') return;
    if (this.pre(h)) return;
    if (this.state === 'drop') { this.y = Math.max(this.dropTo, this.y - h * Math.max(6, (this.y - this.dropTo) * 1.6)); if (this.y <= this.dropTo + 0.05) this.state = 'perch'; return; }
    if (this.state === 'leave') { this.y += h * 22; if (this.y > this.anchor[1] - 5) this.state = 'gone'; return; }
    if (this.state === 'swing') { this.swingStep(h); return; }
    this.speed = 0;
    if (this.perchK >= 0 && this.D.ctx.city.dead[this.perchK]) { this.hop(true); return; } // his roof went: off to another
    if (!this.player) {
      if ((this.webT -= h) <= 0) { this.webT = 2.2 + Math.random() * 2; const p = this.webTarget(); if (p) this.webAt(p[0], p[1]); }
      if ((this.perchT -= h) <= 0) this.hop(false);
    }
    if (!this.player) this.yankStep(h);
    if ((this.spitT -= h) <= 0) { this.spitT = 1.2 + Math.random() * 0.6; this.spit(); }
  }
  landed() { this.swing = null; this.state = 'perch'; this.perchK = -1; this.perchT = 2; }
  // a web line onto a car in the street, and the car hurled at the hero after him
  yankStep(h) {
    if (this.yanked && (this.yanked.t -= h) <= 0) this.yanked = null;
    if ((this.yankT = (this.yankT ?? 4) - h) > 0) return;
    this.yankT = 6 + Math.random() * 3; const foe = this.foe(), c = foe && this.nearCar(55);
    if (c && this.D.brawl.throwCar(c, this, foe)) { this.yanked = { car: c, t: 0.6 }; this.act = 0.4; }
  }
  swingStep(h) {
    const W = this.swing; W.t += h / W.dur;
    const t = Math.min(1, W.t), e = 0.5 - 0.5 * Math.cos(Math.PI * t), px = this.x, pz = this.z; // like a pendulum: fastest at the bottom
    this.x = lerp(W.sx, W.ex, e); this.z = lerp(W.sz, W.ez, e); this.y = lerp(W.sy, W.ey, e) - W.sag * Math.sin(Math.PI * e);
    this.speed = Math.hypot(this.x - px, this.z - pz) / h; this.face(this.x - px, this.z - pz, h, 6);
    if (t < 1) return;
    this.swing = null; this.state = 'perch';
    if (this.D.ctx.city.dead[W.k]) { this.perchK = -1; this.hop(true); return; }
    this.perchK = W.k; this.perchT = 5 + Math.random() * 5; this.y = W.ey;
  }
  // the arc from here to roof k, kept clear of every roof in between; null if a tower is in the way
  arc(k) {
    const city = this.D.ctx.city, b = city.buildings[k], [ex, ez] = this.spot(k, this.x, this.z), ey = b.roofY, sx = this.x, sy = this.y, sz = this.z, dist = Math.hypot(ex - sx, ez - sz);
    if (dist < 12 || dist > 140) return null;
    let sag = 0.32 * dist;
    for (let i = 2; i <= 8; i++) { const t = i / 10, top = roofTop(city, lerp(sx, ex, t), lerp(sz, ez, t), 3).top; sag = Math.min(sag, (lerp(sy, ey, t) - top - 3) / Math.sin(Math.PI * t)); }
    if (sag < -0.45 * dist) return null;
    // the line hooks onto the tallest building near the middle, or high in the air if none is tall enough
    const mx = (sx + ex) / 2, mz = (sz + ez) / 2, hi = roofTop(city, mx, mz, 30), lo = Math.max(sy, ey);
    let ax = mx, az = mz, ay = lo + 0.5 * dist + 10;
    if (hi.k >= 0 && hi.top > lo + 12 && hi.top < ay + 40) { const hb = city.buildings[hi.k]; ax = clamp(mx, hb.x0, hb.x1); az = clamp(mz, hb.z0, hb.z1); ay = hi.top; }
    return { sx, sy, sz, ex, ey, ez, ax, ay, az, sag, t: 0, dur: 1.3 + dist / 36, k };
  }
  // swing to another roof: towards (tx, tz) if given, else somewhere with traffic
  hop(forced, tx, tz) {
    const { city, traffic } = this.D.ctx, cand = [];
    city.buildingsNear(this.x, this.z, 110, (k, d, b) => {
      if (k === this.perchK || b.landmark || b.roofY < 9) return;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, dist = Math.hypot(cx - this.x, cz - this.z);
      if (dist >= 28) cand.push({ k, cx, cz });
    });
    let best = null;
    if (tx != null) {
      cand.sort((a, b) => Math.hypot(a.cx - tx, a.cz - tz) - Math.hypot(b.cx - tx, b.cz - tz));
      for (const o of cand.slice(0, 8)) { best = this.arc(o.k); if (best) break; }
    } else {
      let bs = -1;
      for (let n = 0; n < Math.min(10, cand.length); n++) {
        const o = cand[Math.floor(Math.random() * cand.length)]; let s = Math.random() * 6;
        traffic.near(o.cx, o.cz, 30, () => { s += 2; });
        if (s <= bs) continue;
        const W = this.arc(o.k); if (W) { bs = s; best = W; }
      }
    }
    if (best) { this.swing = best; this.state = 'swing'; this.perchK = -1; return true; }
    if (forced) { this.y = this.ground(); this.perchK = -1; }
    this.perchT = 3;
    return false;
  }
  // a stretch of street with cars or people on it, not already webbed
  webTarget() {
    const { traffic, people } = this.D.ctx, spots = [];
    traffic.near(this.x, this.z, 80, (c) => { if (c.mode === DRIVE && !c.gone) spots.push([c.x, c.z]); });
    let n = 0; people.around(this.x, this.z, 80, (j) => { if (n++ % 9 === 0 && people.hittable(j)) spots.push([people.x[j], people.z[j]]); });
    let best = null, bs = 0;
    for (let i = 0; i < Math.min(14, spots.length); i++) {
      const [px, pz] = spots[Math.floor(Math.random() * spots.length)], d = Math.hypot(px - this.x, pz - this.z);
      if (d < 15 || this.webs.some(w => Math.hypot(w.x - px, w.z - pz) < w.R + 4)) continue;
      let s = 0; traffic.near(px, pz, 8, () => { s += 3; }); people.around(px, pz, 7, () => { s++; });
      if (s > bs) { bs = s; best = [px, pz]; }
    }
    return best;
  }
  webAt(x, z) {
    this.act = 0.35; this.face(x - this.x, z - this.z, 1, 1);
    const hy = this.y + 3.2, T = 0.5 + Math.hypot(x - this.x, z - this.z) / 70;
    this.V.shoot('web', this.x, hy, this.z, x, this.ground(x, z) + 0.3, z, T, (tx, tz) => this.addWeb(tx, tz));
  }
  addWeb(x, z) {
    this.webs.push(new Web(this.V, x, z, 6.5 + Math.random() * 2.5)); sfx('web', x, 3, z);
    if (this.webs.length > 7) { const o = this.webs.shift(); o.release(); o.dispose(); }
  }
  // acid at the nearest stuck car
  spit() {
    let best = null, bd = 85;
    for (const w of this.webs) for (const c of w.cars) { if (c.webbed !== w || c.eaten) continue; const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < bd) { bd = d; best = c; } }
    if (!best) return;
    this.spat = 0.3; this.face(best.x - this.x, best.z - this.z, 1, 1);
    this.V.shoot('acid', this.x, this.y + 3.6, this.z, best.x, (best.y || 0) + 0.8, best.z, 0.45 + bd / 60, (tx, tz) => this.V.acid(tx, tz));
  }
  leave() { this.swing = null; this.anchor = [this.x, this.y + 130, this.z]; if (this.state !== 'gone') this.state = 'leave'; }
  // in Be The Disaster: tap to web a spot (he swings closer if it is out of reach); hold and let go to swing that way
  pDown(x, z) { this.pf = [x, z]; this.pt = now(); }
  pMove(x, z) { this.pf = [x, z]; }
  pUp() {
    if (!this.pf || this.state !== 'perch') return;
    const [x, z] = this.pf, d = Math.hypot(x - this.x, z - this.z);
    if (now() - this.pt < 300 && d < 85) this.webAt(x, z);
    else this.hop(false, x, z);
  }
  sync(dt) {
    const r = this.rig; r.root.visible = this.state !== 'gone'; this.line.visible = false;
    if (!r.root.visible) return;
    this.place(); relax(r);
    const A = r.arms, hanging = this.state !== 'perch';
    if (hanging) { // on the line by his top right hand, knees tucked, the other arms out wide
      A[1].sh.rotation.set(-2.95, 0, 0.15);
      for (let i = 0; i < 6; i++) if (i !== 1) { const a = A[i]; a.sh.rotation.set(-0.3 + a.row * 0.35, 0, a.sx * (1.1 + a.row * 0.2) + Math.sin(this.t * 3 + i) * 0.1); a.el.rotation.set(-0.6, 0, 0); }
      for (const L of r.legs) { L.hip.rotation.x = -0.9; L.knee.rotation.x = 1.5; }
    } else { // crouched at the roof edge like a spider, all six arms splayed
      r.hips.position.y = 0.6; r.torso.rotation.x = 0.55; r.head.rotation.x = this.spat > 0 ? 0.3 : -0.5;
      r.legs[0].hip.rotation.set(-1.2, 0, -0.35); r.legs[1].hip.rotation.set(-1.2, 0, 0.35);
      for (const L of r.legs) L.knee.rotation.x = 2.0;
      for (const a of A) { const tw = Math.sin(this.t * 4 + a.row * 2 + a.sx) * 0.08; a.sh.rotation.set(-0.7 + a.row * 0.55 + tw, 0, a.sx * (0.95 + a.row * 0.2)); a.el.rotation.set(-1.0, 0, -a.sx * 0.3); }
      if (this.act > 0) { A[1].sh.rotation.set(-1.55, 0, 0.1); A[1].el.rotation.set(0, 0, 0); }
    }
    if (hanging) {
      r.root.updateMatrixWorld(true); handAt(A[1], _w);
      const an = this.swing ? [this.swing.ax, this.swing.ay, this.swing.az] : this.anchor;
      aim(this.line, _w.x, _w.y, _w.z, an[0], an[1], an[2], 0.09); this.line.visible = true;
    }
    if (!hanging && this.yanked && !this.yanked.car.gone) { r.root.updateMatrixWorld(true); handAt(A[1], _w); const c = this.yanked.car; aim(this.line, _w.x, _w.y, _w.z, c.x, (c.y || 0) + 1, c.z, 0.07); this.line.visible = true; }
    if (this.tossed || this.gripped || this.spinning) tumble(r, this.t, this.spinning);
    r.cape.update(dt, Math.min(0.85, this.speed / 30), 0.2 + Math.min(0.8, this.speed / 25)); detail(r, this.D);
  }
  dispose() { super.dispose(); this.V.scene.remove(this.line); for (const w of this.webs) { w.release(); w.dispose(); } this.webs.length = 0; }
}

const KINDS = { Blur, Tyrant, Weaver };

export class Villains {
  constructor(D, x, z, o = {}) {
    this.type = 'villains'; this.D = D; this.scene = D.ctx.scene; this.alive = true; this.t = 0; this.life = o.life ?? 480; this.persist = !!o.persist; // long enough for the heroes to wear them down
    this.goo = new Splash(this.scene, 700); this.goo.mat.uniforms.uColor.value.setRGB(0.75, 0.08, 0.04); this.goo.mat.blending = THREE.NormalBlending; // red acid
    this.silk = new Splash(this.scene, 300); this.silk.mat.uniforms.uColor.value.setRGB(0.95, 0.94, 0.9); this.silk.mat.blending = THREE.NormalBlending;
    this.shots = []; this._c = new THREE.Color(); this._white = new THREE.Color('#f4f2ec');
    this.who = [];
    if (!o.only || o.only === 'blur') this.who.push(new Blur(this, x, z));
    if (!o.only || o.only === 'tyrant') this.who.push(new Tyrant(this, x, z));
    if (!o.only || o.only === 'weaver') this.who.push(new Weaver(this, x, z));
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'villains', x, z, r: 60, text: 'Super villains are attacking the ' + D.district(x, z) + ' district! Blur, Tyrant and Weaver' });
  }
  // a hero has beaten one of them: they give up and leave the city
  beat(v, by) {
    if (v.beaten || v.gone) return;
    if (by && !heroesWin(v)) { // too strong for them: it shrugs off the last blow and the heroes fall back
      v.hp = Math.max(v.hp, 390);
      if (!v.heroLost) { v.heroLost = true; this.D.emit({ type: 'herolost', x: v.x, z: v.z, text: v.name + ' was too strong for ' + by + '! The heroes are falling back' }); }
      return;
    }
    v.beaten = true; v.leave(); this.D.emit({ type: 'villainbeaten', x: v.x, z: v.z, text: by + ' beat ' + v.name + '! ' + v.name + (this.persist ? ' will be back in 15 seconds' : ' is fleeing the city') }); }
  // a beaten villain back for more, somewhere near the middle of the view
  respawn(i) {
    const old = this.who[i], c = this.D.ctx.controls.target, B = this.D.ctx.city.bounds, x = clamp(c.x + (Math.random() - 0.5) * 120, B.x0 + 40, B.x1 - 40), z = clamp(c.z + (Math.random() - 0.5) * 120, B.z0 + 40, B.z1 - 40);
    const nv = new KINDS[old.name](this, x, z); nv.setPlayer(old.player); old.dispose(); this.who[i] = nv;
    this.D.emit({ type: 'villainback', text: nv.name + ' is back!' });
  }
  near(x, z) { const { camera, controls } = this.D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.2; }
  tintWeb(c) { this._c.set(c.colHex).lerp(this._white, 0.7); this.D.ctx.traffic.tint(c, '#' + this._c.getHexString()); }
  // set a car alight where it is (it stops dead rather than careering on)
  torch(c) { const { traffic } = this.D.ctx; if (c.mode === DRIVE || c.mode === 1) { traffic.grab(c); c.mode = REST; c.v = 0; } traffic.burn(c); }
  // the acid eats away the cars it lands on
  acid(x, z) {
    const { traffic, fire } = this.D.ctx;
    traffic.near(x, z, 4, (c) => {
      if (c.gone || c.eaten || c.mode === AIR || c.mode === EXT || Math.hypot(c.x - x, c.z - z) > 3.5) return;
      if (c.mode !== REST) traffic.grab(c);
      c.mode = REST; c.v = 0; c.frozen = false; c.webbed = null; c.eaten = true;
      traffic.tint(c, '#4a2418'); fire.steam(c.x, c.z, 2.5);
    });
    for (const pc of traffic.parkedNear(x, z, 3)) if (!pc.burnt) { traffic.burnParked(pc); fire.steam(pc.x, pc.z, 2); }
    this.goo.emit(x, 0.8, z, 16, { up: [1, 3.5], spread: 3, life: 1.1, size: 1.2 });
    this.D.decals.add('scour', x, z, 4, 4);
  }
  // a web ball or a glob of acid, lobbed from (x, y, z) to land on (tx, ty, tz) after T seconds
  shoot(kind, x, y, z, tx, ty, tz, T, onHit) {
    const m = new THREE.Mesh(kit().ball, kind === 'web' ? kit().web : kit().acid); m.scale.setScalar(kind === 'web' ? 0.7 : 0.5); m.position.set(x, y, z); this.scene.add(m);
    this.shots.push({ kind, x, y, z, vx: (tx - x) / T, vy: (ty - y + 0.5 * G * T * T) / T, vz: (tz - z) / T, t: 0, T, m, onHit, tx, tz });
  }
  shotStep(h) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.t += h; const t = Math.min(s.t, s.T), px = s.x + s.vx * t, py = s.y + s.vy * t - 0.5 * G * t * t, pz = s.z + s.vz * t;
      s.m.position.set(px, py, pz);
      (s.kind === 'web' ? this.silk : this.goo).emit(px, py, pz, 1, { up: [-0.5, 0.5], spread: 0.3, life: 0.5, size: 0.9 });
      if (s.t >= s.T) { this.scene.remove(s.m); this.shots.splice(i, 1); s.onHit(s.tx, s.tz); }
    }
  }
  update(h) {
    this.t += h;
    const B = this.D.ctx.city.bounds;
    for (const v of this.who) {
      v.update(h);
      // once in the city they fight there: nothing (a dash, a throw, a punch) carries them out until they are beaten or leave
      if (v.leaving || v.beaten || v.gone) continue;
      if (v.x > B.x0 + 8 && v.x < B.x1 - 8 && v.z > B.z0 + 8 && v.z < B.z1 - 8) v.inCity = true;
      else if (v.inCity) { v.x = clamp(v.x, B.x0 + 8, B.x1 - 8); v.z = clamp(v.z, B.z0 + 8, B.z1 - 8); if (Array.isArray(v.goal)) v.goal = [clamp(v.goal[0], B.x0 + 15, B.x1 - 15), clamp(v.goal[1], B.z0 + 15, B.z1 - 15)]; }
    }
    this.shotStep(h); this.goo.update(h); this.silk.update(h);
    if (!this.leaving && this.t > this.life) { this.leaving = true; for (const v of this.who) v.leave(); this.D.emit({ type: 'villainsleave', text: 'The super villains are leaving the city' }); }
    if (this.persist) this.who.forEach((v, i) => { if (v.gone && !(v.flying && v.flying.length) && (v.goneT = (v.goneT || 0) + h) > 15) this.respawn(i); });
    else if (this.who.every(v => v.gone && !(v.flying && v.flying.length))) this.alive = false;
  }
  sync(dt, realT) {
    for (const v of this.who) v.sync(dt, realT);
    const sc = this.D.ctx.fire.uniforms.uScale.value; this.goo.sync(this.D.lightK, sc); this.silk.sync(this.D.lightK, sc);
  }
  poi(x, z) { let best = null, bd = 1e9; for (const v of this.who) { if (v.gone) continue; const d = Math.hypot(v.x - x, v.z - z); if (d < bd) { bd = d; best = v; } } return best ? { x: best.x, z: best.z, danger: 16, range: 260 } : null; }
  dispose() {
    for (const v of this.who) v.dispose();
    for (const s of this.shots) this.scene.remove(s.m); this.shots.length = 0;
    for (const sp of [this.goo, this.silk]) { this.scene.remove(sp.points); sp.points.geometry.dispose(); sp.mat.dispose(); }
  }
}
