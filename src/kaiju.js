// The kaiju: a gaunt giant forty-odd metres tall, hunched forward on long legs
// with arms so long its knuckles touch the street, a small head on a long neck,
// spines down its back, all of it in grey-brown scales. Every limb runs into a
// rounded joint, so the body reads as one piece, and the joints ease from pose
// to pose rather than snapping. It walks in from the edge of the city: every
// footfall flattens what it lands on, it ploughs through the smaller buildings in
// its way, swipes the tops off others, picks up cars and hurls them, and stops to
// roar. Airstrikes hurt it; hurt enough (or after a few minutes) it walks back out
// of the city. In Be The Disaster you walk it and choose what it smashes.
import * as THREE from 'three';
import { scaly } from './skins.js';

const THIGH = 14, SHIN = 15, TORSO = 22, UPPER = 19, FORE = 19, LEAN = 0.95, SPEED = 5.5, STRIDE = 20;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (c) => Math.pow(Math.max(0, c), 1.6); // a fold that starts and stops gently

let M = null;
function mats() {
  if (M) return M;
  M = { skin: scaly('#b4a898', [3, 3], { rows: 6, cols: 6, bump: 3 }), dark: scaly('#6e655a', [2, 2], { rows: 5, cols: 5, bump: 3 }),
    pale: scaly('#d6ccb8', [2, 3], { rows: 6, cols: 6, bump: 2 }), mouth: new THREE.MeshStandardMaterial({ color: '#3a1410', roughness: 0.5 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 0.5 }), eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.1, 0.6) }) };
  return M;
}
// the creature, facing +x, feet at the origin: every joint a pivot with a rounded ball where limb meets limb
export function kaijuRig() {
  const m = mats(), root = new THREE.Group();
  const mesh = (g, mat, parent) => { const me = new THREE.Mesh(g, mat); me.castShadow = true; parent.add(me); return me; };
  const ball = (r, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const b = mesh(new THREE.SphereGeometry(r, 18, 14), mat, parent); b.position.set(x, y, z); b.scale.set(sx, sy, sz); return b; };
  // a limb hanging down from its joint: tapered, with a ball at the top the size of its top end
  const limb = (r0, r1, len, mat, parent) => { mesh(new THREE.CylinderGeometry(r1, r0, len, 18, 3).translate(0, -len / 2, 0), mat, parent); ball(r0 * 1.04, mat, parent); };
  const piv = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const hips = piv(root, 0, 26, 0);
  ball(5.6, m.skin, hips, 0, 0, 0, 1.25, 0.95, 1.15);
  const legs = [-1, 1].map(s => {
    const hip = piv(hips, 0, 0, s * 5); limb(2.7, 2.1, THIGH, m.skin, hip);
    const knee = piv(hip, 0, -THIGH, 0); limb(2.15, 1.3, SHIN, m.skin, knee);
    const foot = piv(knee, 0, -SHIN, 0); ball(1.45, m.skin, foot); ball(1.6, m.dark, foot, 1.8, -0.5, 0, 2.7, 1, 1.6); // ankle, then the long foot
    for (let c = 0; c < 3; c++) { const cl = mesh(new THREE.ConeGeometry(0.42, 2.2, 8), m.tooth, foot); cl.position.set(5.6, -0.9, (c - 1) * 1.1); cl.rotation.z = -1.45; }
    return { hip, knee, foot, s };
  });
  const torso = piv(hips, 0, 0, 0); torso.rotation.z = -LEAN;
  mesh(new THREE.CylinderGeometry(5.4, 4.9, TORSO, 20, 4).translate(0, TORSO / 2, 0), m.skin, torso).scale.z = 1.25;
  ball(5.45, m.skin, torso, 0, TORSO, 0, 1, 0.9, 1.25); // the shoulders, rounded off
  ball(1, m.pale, torso, 3.2, TORSO * 0.48, 0, 2.6, TORSO * 0.48, 3.8); // the pale belly
  for (let i = 0; i < 11; i++) { const sp = mesh(new THREE.ConeGeometry(0.9 - i * 0.03, 3.8 - i * 0.18, 8), m.dark, torso); sp.position.set(-4.7, 1 + i * 2.1, 0); sp.rotation.z = 0.5; } // spines down its back
  const neck = piv(torso, 0, TORSO, 0); neck.rotation.z = LEAN - 0.35;
  mesh(new THREE.CylinderGeometry(1.9, 2.7, 9, 16, 2).translate(0, 4.5, 0), m.skin, neck); ball(2.8, m.skin, neck); ball(2.0, m.skin, neck, 0, 9, 0);
  const head = piv(neck, 0, 9, 0); head.rotation.z = -1.2;
  ball(1, m.skin, head, 0, 3.4, 0, 2.1, 3.9, 2.4); // the long skull
  ball(1, m.dark, head, 1.2, 4.8, 0, 0.9, 1.6, 2.2); // brow ridge
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.42, 10, 8), m.eye, head); e.position.set(1.7, 5.0, s * 1.75); }
  mesh(new THREE.BoxGeometry(0.4, 5.6, 2.4).translate(-1.4, 3.6, 0), m.mouth, head);
  const jaw = piv(head, -1.0, 0.9, 0); ball(1, m.skin, jaw, -0.9, 3.0, 0, 1.0, 3.1, 1.8);
  for (let t = 0; t < 7; t++) { const th = mesh(new THREE.ConeGeometry(0.22, 0.9, 6), m.tooth, jaw); th.position.set(-0.1, 1.2 + t * 0.75, (t % 2 ? 1 : -1) * 1.1); th.rotation.z = -1.4; }
  const arms = [-1, 1].map(s => {
    const sh = piv(torso, 0, TORSO - 2.5, s * 6.2); ball(2.7, m.skin, sh); limb(2.3, 1.8, UPPER, m.skin, sh);
    const el = piv(sh, 0, -UPPER, 0); limb(1.85, 1.2, FORE, m.skin, el);
    const hand = piv(el, 0, -FORE, 0); ball(1.3, m.skin, hand); ball(1, m.dark, hand, 0.4, -1.2, 0, 1.9, 1.3, 1.9);
    for (let c = 0; c < 3; c++) { const cl = mesh(new THREE.ConeGeometry(0.5, 4.2, 8), m.tooth, hand); cl.position.set(1.7, -2.6, (c - 1) * 1.1); cl.rotation.z = 2.55; }
    return { sh, el, hand, s };
  });
  const tail = []; let tp = piv(hips, -5.5, 0, 0);
  for (let i = 0; i < 5; i++) { tp.rotation.z = i ? -0.12 : -1.35; limb(2.5 - i * 0.42, 2.08 - i * 0.42, 8, m.skin, tp); tail.push(tp); tp = piv(tp, 0, -8, 0); }
  // every joint the pose sets, for easing from one pose to the next
  const joints = [];
  for (const L of legs) joints.push([L.hip, 'z'], [L.knee, 'z'], [L.foot, 'z']);
  for (const A of arms) joints.push([A.sh, 'z'], [A.el, 'z'], [A.hand, 'z']);
  joints.push([neck, 'z'], [head, 'z'], [jaw, 'z'], [hips, 'x'], [torso, 'y']);
  for (const t of tail) joints.push([t, 'y']);
  return { root, hips, legs, torso, neck, head, jaw, arms, tail, joints };
}
// the pose for walk phase ph (ph = null: standing); returns the hip height that puts the standing foot on the ground
function pose(r, ph, o = {}) {
  let low = 0;
  r.legs.forEach((L, i) => {
    const p = (ph ?? 0) + i * Math.PI, sw = ph == null ? 0 : 1;
    const h = 0.12 + 0.42 * Math.sin(p) * sw, k = -0.55 - 0.6 * ease(Math.cos(p)) * sw; // the knee folds as the leg swings through
    L.hip.rotation.z = h; L.knee.rotation.z = k; L.foot.rotation.z = -(h + k) + 0.15 * ease(-Math.cos(p)) * sw; // the foot rolls off the toes
    low = Math.max(low, THIGH * Math.cos(h) + SHIN * Math.cos(h + k) + 1.4);
  });
  r.arms.forEach((A, i) => {
    const p = (ph ?? 0) + (1 - i) * Math.PI, sw = ph == null ? 0.2 : 1;
    let s = LEAN + 0.25 + 0.38 * Math.sin(p) * sw, e = -0.25 - 0.3 * ease(-Math.cos(p)) * sw;
    if (o.reach && o.reach.arm === i) { s = LEAN + 1.1 * o.reach.k + 0.25 * (1 - o.reach.k); e = -0.2 - 0.3 * o.reach.k; }
    if (o.lift && o.lift.arm === i) { s = LEAN + 2.6 * o.lift.k; e = -0.6 * o.lift.k; }
    if (o.swipe && o.swipe.arm === i) { s = LEAN + 2.2 - 3.2 * o.swipe.k; e = -0.3; }
    A.sh.rotation.z = s; A.el.rotation.z = e; A.hand.rotation.z = -0.3 + 0.2 * Math.sin(p) * sw;
  });
  const roar = o.roar || 0, sway = ph == null ? 0 : 1;
  r.hips.rotation.x = 0.045 * Math.sin(ph ?? 0) * sway; r.torso.rotation.y = 0.07 * Math.sin((ph ?? 0) + 0.6) * sway; // the body rolls and twists with the stride
  r.neck.rotation.z = LEAN - 0.35 + roar * 0.6 + 0.04 * Math.sin((ph ?? 0) * 2) * sway; r.head.rotation.z = -1.2 + roar * 0.5; r.jaw.rotation.z = -0.15 - roar * 0.75;
  r.tail.forEach((t, i) => { if (i) t.rotation.y = Math.sin((ph ?? 0) * 0.5 + i * 0.7) * 0.16; });
  return low;
}
// standing, for the roster
export function kaijuModel() { const r = kaijuRig(); r.hips.position.y = pose(r, 0.8); return r.root; }

export class Kaiju {
  constructor(D, x, z, o = {}) {
    this.type = 'kaiju'; this.D = D; this.alive = true; this.t = 0; this.hp = o.hp ?? 400; this.life = o.life ?? 200; this.player = !!o.player;
    const B = D.ctx.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    // in from the edge of the city nearest where it was called
    const ex = x - cx, ez = z - cz, side = Math.abs(ex) > Math.abs(ez) ? [Math.sign(ex || 1), 0] : [0, Math.sign(ez || 1)];
    this.x = side[0] ? (side[0] > 0 ? B.x1 + 40 : B.x0 - 40) : clamp(x, B.x0 + 40, B.x1 - 40); this.z = side[1] ? (side[1] > 0 ? B.z1 + 40 : B.z0 - 40) : clamp(z, B.z0 + 40, B.z1 - 40);
    this.goal = [clamp(x, B.x0 + 40, B.x1 - 40), clamp(z, B.z0 + 40, B.z1 - 40)]; this.yaw = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x);
    this.ph = 0; this.state = 'walk'; this.act = null; this.actT = 6; this.roarT = 10; this.goT = 20; this.cars = 0;
    this.rig = kaijuRig(); D.ctx.scene.add(this.rig.root); this.cur = []; this.hy = null;
    this._v = new THREE.Vector3();
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'kaiju', x: this.goal[0], z: this.goal[1], r: 60, exact: true, text: 'A giant monster is coming into the city from the ' + (side[0] ? (side[0] > 0 ? 'east' : 'west') : (side[1] > 0 ? 'south' : 'north')) + '!' });
  }
  steer(x, z) { const B = this.D.ctx.city.bounds; this.goal = [clamp(x, B.x0 + 30, B.x1 - 30), clamp(z, B.z0 + 30, B.z1 - 30)]; }
  damage(n) { if (this.state === 'leave') return; this.hp -= n; this.D.ctx.fire.burst(this.x, 30, this.z, 20, 4); if (this.hp <= 0) this.retreat('The monster is hurt and retreating out of the city!'); }
  retreat(text) { if (this.state === 'leave') return; this.state = 'leave'; this.dropCar(); this.act = null; const B = this.D.ctx.city.bounds, d = [this.x - B.x0, B.x1 - this.x, this.z - B.z0, B.z1 - this.z], m = Math.min(...d); this.goal = m === d[0] ? [B.x0 - 120, this.z] : m === d[1] ? [B.x1 + 120, this.z] : m === d[2] ? [this.x, B.z0 - 120] : [this.x, B.z1 + 120]; this.D.emit({ type: 'kaijuleave', text }); }
  onEvent(e) { if ((e.type === 'blast' && Math.hypot(e.x - this.x, e.z - this.z) < 35) || ((e.type === 'nuked' || e.type === 'nukeflash') && Math.hypot(e.x - this.x, e.z - this.z) < 200)) this.damage(e.type === 'blast' ? 50 : 999); }
  // pick something to do next: grab a car, swipe a building, roar
  choose() {
    const { traffic, city } = this.D.ctx;
    if ((this.roarT -= 4) <= 0) { this.roarT = 14 + Math.random() * 8; this.act = { kind: 'roar', t: 0 }; return; } // about every third thing it does
    let car = null; traffic.near(this.x + Math.cos(this.yaw) * 14, this.z + Math.sin(this.yaw) * 14, 26, (c) => { if (!car && !c.gone && c.mode === 0 && !c.mission) car = c; });
    if (car && Math.random() < 0.6) { this.act = { kind: 'car', car, t: 0, arm: Math.random() < 0.5 ? 0 : 1 }; return; }
    let bk = -1; city.buildingsNear(this.x + Math.cos(this.yaw) * 16, this.z + Math.sin(this.yaw) * 16, 14, (k) => { if (bk < 0) bk = k; });
    if (bk >= 0) this.act = { kind: 'swipe', k: bk, t: 0, arm: Math.random() < 0.5 ? 0 : 1 };
  }
  dropCar() { const a = this.act; if (a && a.kind === 'car' && a.held && !a.car.gone) this.D.ctx.traffic.fling(a.car, 0, -2, 0); }
  update(h) {
    const D = this.D, B = D.ctx.city.bounds;
    this.t += h;
    if (this.state !== 'leave' && this.t > this.life) this.retreat('The monster is wandering back out of the city');
    if (this.state === 'leave' && (this.x < B.x0 - 100 || this.x > B.x1 + 100 || this.z < B.z0 - 100 || this.z > B.z1 + 100)) { this.alive = false; return; }
    const A = this.act;
    if (A) { this.doAct(h, A); if (A.kind !== 'car' || !A.held) return; } // it stops to do it (carrying a car, it walks on)
    else if (!this.player && this.state !== 'leave' && (this.actT -= h) <= 0) { this.actT = 6 + Math.random() * 5; this.choose(); if (this.act) return; }
    if (!this.player && this.state !== 'leave' && ((this.goT -= h) <= 0 || Math.hypot(this.goal[0] - this.x, this.goal[1] - this.z) < 15)) { this.goT = 25; this.newGoal(); }
    // walk: turn towards the goal, turning away from towers too tall to wade through
    let want = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x);
    const fx = this.x + Math.cos(this.yaw) * 14, fz = this.z + Math.sin(this.yaw) * 14; let tall = null;
    D.ctx.city.buildingsNear(fx, fz, 8, (k, d, b) => { if (b.top - b.baseY > 70) tall = b; });
    if (tall && this.state !== 'leave') { const cx = (tall.x0 + tall.x1) / 2 - this.x, cz = (tall.z0 + tall.z1) / 2 - this.z; want = Math.atan2(cz, cx) + (Math.sin(this.yaw - Math.atan2(cz, cx)) > 0 ? 1.4 : -1.4); }
    if (this.player && Math.hypot(this.goal[0] - this.x, this.goal[1] - this.z) < 6) return; // waiting for your finger
    let da = want - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += clamp(da, -0.5 * h, 0.5 * h);
    const sp = SPEED * (Math.abs(da) > 1 ? 0.4 : 1);
    this.x += Math.cos(this.yaw) * sp * h; this.z += Math.sin(this.yaw) * sp * h;
    const before = this.ph; this.ph += h * sp / STRIDE * Math.PI * 2;
    for (let i = 0; i < 2; i++) { const a = before + i * Math.PI, b = this.ph + i * Math.PI; if (Math.cos(a) > 0 && Math.cos(b) <= 0) this.stomp(i); } // a foot comes down as the leg passes its furthest forward
    this.wade();
  }
  newGoal() {
    const { people, city } = this.D.ctx, B = city.bounds; let best = -1;
    for (let n = 0; n < 10; n++) { const i = Math.floor(Math.random() * people.active); if (!people.hittable(i)) continue; const d = Math.hypot(people.x[i] - this.x, people.z[i] - this.z); if (d < 80 || d > 300) continue; let c = 0; people.around(people.x[i], people.z[i], 12, () => { c++; }); if (c > best) { best = c; this.goal = [people.x[i], people.z[i]]; } }
    if (best < 0) this.goal = [clamp(this.x + (Math.random() - 0.5) * 300, B.x0 + 50, B.x1 - 50), clamp(this.z + (Math.random() - 0.5) * 300, B.z0 + 50, B.z1 - 50)];
  }
  // the foot world position (the exact pose, not the eased one)
  footAt(i) { this.sync(0, 0); this.rig.root.updateMatrixWorld(true); return this.rig.legs[i].foot.getWorldPosition(this._v); }
  stomp(i) {
    const D = this.D, { city, people, traffic, fire } = D.ctx, p = this.footAt(i), x = p.x, z = p.z;
    people.crushNear(x, z, 4);
    traffic.near(x, z, 7, (c) => { if (c.gone || c.mode === 4 || c.mode === 5) return; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1; if (d < 7) traffic.fling(c, dx / d * 10, 6, dz / d * 10); });
    for (const pc of traffic.parkedNear(x, z, 4)) traffic.burnParked(pc);
    city.buildingsNear(x, z, 4, (k, d, b) => { if (b.top - b.baseY < 45) D.destroyBuilding(k, 'collapse', { dir: this.yaw }); else D.blowWindows(k, Math.cos(this.yaw), Math.sin(this.yaw), 1); });
    D.decals.add('crack', x, z, 9, 9); fire.dustCloud(x, z, 6, 4); people.scare(x, z, 50, 0.8);
    if (this.near(x, z)) D.shake(0.55);
  }
  // the body ploughs through anything smaller than it
  wade() {
    const D = this.D; D.ctx.city.buildingsNear(this.x + Math.cos(this.yaw) * 4, this.z + Math.sin(this.yaw) * 4, 6, (k, d, b) => { if (b.top - b.baseY <= 70) D.destroyBuilding(k, 'collapse', { dir: this.yaw }); });
  }
  doAct(h, A) {
    const D = this.D, { traffic, city, people } = D.ctx; A.t += h;
    if (A.kind === 'roar') {
      if (A.t > 0.5 && !A.done) { A.done = true; people.scare(this.x, this.z, 140, 0.95); if (this.near(this.x, this.z)) D.shake(0.9); if (!this.saidRoar) { this.saidRoar = true; D.emit({ type: 'roar', text: 'The monster roars!' }); } }
      if (A.t > 2.6) this.act = null;
      return;
    }
    if (A.kind === 'swipe') {
      if (A.t > 0.55 && !A.done) {
        A.done = true; const b = city.buildings[A.k];
        if (b && !city.dead[A.k]) { if (b.top - b.baseY < 55) D.destroyBuilding(A.k, 'collapse', { dir: this.yaw + (A.arm ? -1 : 1) * 0.8 }); else { D.blowWindows(A.k, Math.cos(this.yaw), Math.sin(this.yaw), 1.4); city.char(A.k, 0.8); } }
        if (this.near(this.x, this.z)) D.shake(0.5);
      }
      if (A.t > 1.2) this.act = null;
      return;
    }
    // a car: reach down, pick it up, lift it high and throw it
    const c = A.car;
    if (!A.held) {
      if (c.gone || c.mode === 5 || c.mode === 4) { this.act = null; return; }
      if (A.t > 0.9) { if (!traffic.grab(c)) { this.act = null; return; } A.held = true; A.t = 0; }
      return;
    }
    const hp = this.handAt(A.arm); c.x = hp.x; c.y = hp.y; c.z = hp.z; c.yaw += h * 2;
    if (A.t > 1.1) {
      let tx = this.x + Math.cos(this.yaw) * 120, tz = this.z + Math.sin(this.yaw) * 120; // at a crowd ahead, or just far
      let best = 0; people.around(this.x, this.z, 160, (j) => { if (Math.random() < 0.02 && people.hittable(j)) { const d = Math.hypot(people.x[j] - this.x, people.z[j] - this.z); if (d > 50 && d > best) { best = d; tx = people.x[j]; tz = people.z[j]; } } });
      const T = 2.2; traffic.fling(c, (tx - c.x) / T, (0 - c.y + 0.5 * 9.8 * T * T) / T, (tz - c.z) / T);
      this.act = null; this.cars++;
      if (this.cars === 1) D.emit({ type: 'kaijucar', text: 'The monster is throwing cars!' });
    }
  }
  handAt(i) { this.rig.root.updateMatrixWorld(true); return this.rig.arms[i].hand.getWorldPosition(this._v); }
  near(x, z) { const { camera, controls } = this.D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.3; }
  poi() { return { x: this.x, z: this.z, danger: 45, range: 400 }; }
  // dt 0: exactly the pose (for working out where a foot lands); otherwise each joint eases towards it
  sync(dt = 0) {
    const r = this.rig, A = this.act, o = {};
    if (A && A.kind === 'roar') o.roar = Math.min(1, A.t * 3) * Math.min(1, (2.6 - A.t) * 2);
    if (A && A.kind === 'swipe') o.swipe = { arm: A.arm, k: Math.min(1, A.t / 0.9) };
    if (A && A.kind === 'car') { if (!A.held) o.reach = { arm: A.arm, k: Math.min(1, A.t / 0.9) }; else o.lift = { arm: A.arm, k: Math.min(1, A.t / 0.8) }; }
    const walking = !A || (A.kind === 'car' && A.held);
    const hy = pose(r, walking ? this.ph : null, o) + (walking ? 0 : 0.3), exact = !(dt > 0), k = 1 - Math.exp(-dt * 10);
    if (!exact) { // the eased pose is kept apart, so working out a footfall does not disturb it
      r.joints.forEach(([j, ax], i) => { const want = j.rotation[ax]; j.rotation[ax] = this.cur[i] = this.cur[i] == null ? want : this.cur[i] + (want - this.cur[i]) * k; });
      this.hy = this.hy == null ? hy : this.hy + (hy - this.hy) * k;
    }
    r.hips.position.y = exact || this.hy == null ? hy : this.hy;
    r.root.position.set(this.x, 0, this.z); r.root.rotation.y = -this.yaw;
  }
  dispose() { this.dropCar(); this.D.ctx.scene.remove(this.rig.root); }
}
