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

const THIGH = 12, SHIN = 10, META = 7, TORSO = 22, UPPER = 18, FORE = 18, LEAN = 0.95, SPEED = 5.5, STRIDE = 20;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (c) => Math.pow(Math.max(0, c), 1.6); // a fold that starts and stops gently

let M = null;
function mats() {
  if (M) return M;
  M = { skin: scaly('#aaa395', [3, 3], { rows: 6, cols: 6, bump: 3.2 }), dark: scaly('#625a50', [2, 2], { rows: 5, cols: 5, bump: 3.5 }),
    pale: scaly('#d2c9b6', [2, 3], { rows: 7, cols: 7, bump: 2 }), mouth: new THREE.MeshStandardMaterial({ color: '#3a1410', roughness: 0.5 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 0.45 }), claw: new THREE.MeshStandardMaterial({ color: '#2e2a26', roughness: 0.4 }),
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.15, 0.55) }) };
  return M;
}
// a limb hanging down from its joint: muscled (thicker through the middle), its top a ball the size of its top end, so limb runs into limb with no seam
function muscle(r0, r1, len, bulge, mat, parent) {
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t) * (1 - 0.4 * t), -t * len)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 18), mat); m.castShadow = true; parent.add(m);
  const j = new THREE.Mesh(new THREE.SphereGeometry(r0 * 1.03, 18, 14), mat); j.castShadow = true; parent.add(j);
  return m;
}
// the creature, facing +x, feet at the origin: every joint a pivot
export function kaijuRig() {
  const m = mats(), root = new THREE.Group();
  const mesh = (g, mat, parent) => { const me = new THREE.Mesh(g, mat); me.castShadow = true; parent.add(me); return me; };
  const ball = (r, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const q = mesh(new THREE.SphereGeometry(r, 18, 14), mat, parent); q.position.set(x, y, z); q.scale.set(sx, sy, sz); return q; };
  const cone = (r, h, mat, parent, x, y, z, rz = 0, ry = 0) => { const c = mesh(new THREE.ConeGeometry(r, h, 8), mat, parent); c.position.set(x, y, z); c.rotation.set(0, ry, rz); return c; };
  const piv = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const hips = piv(root, 0, 27, 0);
  ball(5.6, m.skin, hips, 0, 0, 0, 1.3, 1.0, 1.2);
  // legs: thigh, shin and a long ankle bone, standing on its toes like a big cat
  const legs = [-1, 1].map(s => {
    const hip = piv(hips, 0, -0.5, s * 5.2); muscle(2.9, 2.0, THIGH, 0.7, m.skin, hip);
    const knee = piv(hip, 0, -THIGH, 0); muscle(2.05, 1.25, SHIN, 0.45, m.skin, knee);
    const ankle = piv(knee, 0, -SHIN, 0); muscle(1.3, 0.95, META, 0.15, m.skin, ankle);
    const foot = piv(ankle, 0, -META, 0); ball(1.05, m.skin, foot); ball(1, m.dark, foot, 1.6, -0.45, 0, 2.4, 0.85, 1.5);
    for (let c = 0; c < 3; c++) cone(0.38, 2.0, m.claw, foot, 4.2, -0.8, (c - 1) * 1.0, -1.4);
    return { hip, knee, ankle, foot, s };
  });
  // the torso: a ribcage barrel, hunched forward, spines down the back, a pale belly
  const torso = piv(hips, 0, 0, 0); torso.rotation.z = -LEAN;
  const prof = [[4.4, -1], [5.4, 3], [6.1, 8], [6.3, 12], [5.9, 16], [4.9, 20], [3.4, 23.2], [2.4, 24]].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(new THREE.LatheGeometry(prof, 24), m.skin, torso).scale.z = 1.08;
  ball(1, m.pale, torso, 3.6, 10, 0, 2.6, 9, 4.2); // the pale belly
  for (let i = 0; i < 12; i++) cone(1.0 - i * 0.04, 4.2 - i * 0.2, m.dark, torso, -5.6 + Math.max(0, i - 8) * 0.6, i * 2.0, 0, 0.55); // spines down its back
  // two small extra arms folded under the chest
  const minis = [-1, 1].map(s => { const sh = piv(torso, 4.4, 13, s * 2.6); muscle(0.75, 0.5, 4, 0.12, m.skin, sh); const el = piv(sh, 0, -4, 0); muscle(0.55, 0.35, 3.6, 0.08, m.skin, el); for (let c = 0; c < 2; c++) cone(0.2, 1.1, m.claw, el, 0.2, -3.9, (c - 0.5) * 0.4, 2.8); return { sh, el, s }; });
  // the neck: three joints, so it curves; the head kept steady at the end of it
  const neck = []; let np = piv(torso, 0, 23, 0);
  for (let i = 0; i < 3; i++) { muscle(2.4 - i * 0.25, 2.15 - i * 0.25, 4.6, 0.2, m.skin, np); neck.push(np); np.rotation.z = Math.PI; np = piv(np, 0, -4.6, 0); np.rotation.z = 0; } // built hanging down and flipped to point up
  const head = np; head.scale.setScalar(1.25); // the skull: long, low brow, a hinged lower jaw, teeth top and bottom
  ball(1, m.skin, head, 0.2, -3.2, 0, 2.2, 4.8, 2.5); ball(1, m.skin, head, 0.6, -7.2, 0, 1.4, 2.2, 1.7); // skull, snout
  ball(1, m.dark, head, 1.5, -2.6, 0, 1.0, 2.4, 2.3); // the brow
  for (const sd of [-1, 1]) { cone(0.5, 2.8, m.dark, head, 1.3, -0.6, sd * 1.3, -0.55, sd * 0.35); const e = mesh(new THREE.SphereGeometry(0.42, 10, 8), m.eye, head); e.position.set(1.0, -4.4, sd * 1.95); } // (head space: -y is the way it faces, +x is up) horns swept back, small bright eyes
  for (let t = 0; t < 8; t++) cone(0.2, 0.9, m.tooth, head, -1.5, -3.6 - t * 0.55, (t % 2 ? 1 : -1) * 1.1, Math.PI / 2); // upper teeth, pointing down
  const jaw = piv(head, -1.2, -1.2, 0); ball(1, m.skin, jaw, -0.5, -3.6, 0, 1.0, 3.6, 1.8);
  for (let t = 0; t < 7; t++) cone(0.18, 0.8, m.tooth, jaw, 0.5, -2.2 - t * 0.6, (t % 2 ? 1 : -1) * 1.0, -Math.PI / 2); // lower teeth, pointing up
  mesh(new THREE.BoxGeometry(0.5, 6, 2.4).translate(-1.6, -4.4, 0), m.mouth, head);
  // arms: long enough that the knuckles reach the street, three long clawed fingers
  const arms = [-1, 1].map(s => {
    const sh = piv(torso, 0.4, 20.5, s * 6.0); ball(2.4, m.skin, sh); muscle(1.95, 1.25, UPPER, 0.35, m.skin, sh); // long, thin arms
    const el = piv(sh, 0, -UPPER, 0); muscle(1.35, 0.85, FORE, 0.3, m.skin, el);
    const hand = piv(el, 0, -FORE, 0); ball(0.95, m.skin, hand); ball(1, m.dark, hand, 0.3, -1.1, 0, 1.7, 1.3, 1.8);
    const fingers = [];
    for (let c = 0; c < 3; c++) { const f1 = piv(hand, 0.9, -1.8, (c - 1) * 1.05); muscle(0.42, 0.32, 2.6, 0.05, m.skin, f1); const f2 = piv(f1, 0, -2.6, 0); muscle(0.32, 0.22, 2.2, 0.04, m.skin, f2); cone(0.24, 1.4, m.claw, f2, 0, -2.6, 0, Math.PI); fingers.push(f1, f2); }
    return { sh, el, hand, fingers, s };
  });
  // the tail: eight joints, tapering to a point
  const tail = []; let tp = piv(hips, -5.8, 0.5, 0);
  for (let i = 0; i < 8; i++) { const r0 = 2.6 * (1 - i / 8.5), r1 = 2.6 * (1 - (i + 1) / 8.5); muscle(r0, r1, 5, 0.1, m.skin, tp); if (i % 2 === 0) cone(r0 * 0.35, r0 * 1.2, m.dark, tp, -r0 * 0.7, -2.5, 0, 0.6); tail.push(tp); tp = piv(tp, 0, -5, 0); }
  cone(0.35, 2.2, m.skin, tp, 0, -1.1, 0, Math.PI);
  // every joint the pose sets, for easing from one pose to the next
  const joints = [];
  for (const L of legs) joints.push([L.hip, 'z'], [L.knee, 'z'], [L.ankle, 'z'], [L.foot, 'z']);
  for (const A of arms) { joints.push([A.sh, 'z'], [A.el, 'z'], [A.hand, 'z']); for (const fg of A.fingers) joints.push([fg, 'z']); }
  for (const n of neck) joints.push([n, 'z']);
  joints.push([head, 'z'], [jaw, 'z'], [hips, 'x'], [torso, 'y']);
  for (const mm of minis) joints.push([mm.sh, 'z'], [mm.el, 'z']);
  for (const t of tail) joints.push([t, 'y'], [t, 'z']);
  return { root, hips, legs, torso, neck, head, jaw, arms, minis, tail, joints };
}
// the pose for walk phase ph (ph = null: standing), at time t; returns the hip height that puts the standing foot on the ground
function pose(r, ph, o = {}, t = 0) {
  let low = 0;
  const sw = ph == null ? 0 : 1, P = ph ?? 0;
  r.legs.forEach((L, i) => {
    const p = P + i * Math.PI, c = Math.cos(p);
    const a1 = 0.3 + 0.42 * Math.sin(p) * sw, a2 = -0.95 - 0.45 * ease(c) * sw, a3 = 0.75 + 0.35 * ease(c) * sw; // thigh forward, shin back, ankle bone forward again
    L.hip.rotation.z = a1; L.knee.rotation.z = a2; L.ankle.rotation.z = a3; L.foot.rotation.z = -(a1 + a2 + a3) + 0.2 * ease(-c) * sw; // the foot flat, rolling off the toes
    low = Math.max(low, THIGH * Math.cos(a1) + SHIN * Math.cos(a1 + a2) + META * Math.cos(a1 + a2 + a3) + 1.3);
  });
  r.arms.forEach((A, i) => {
    const p = P + (1 - i) * Math.PI, sw2 = ph == null ? 0.2 : 1;
    let s = LEAN + 0.22 + 0.36 * Math.sin(p) * sw2, e = -0.3 - 0.3 * ease(-Math.cos(p)) * sw2, curl = 0.5 + 0.3 * ease(Math.cos(p)) * sw2; // the hand closes as it lifts off
    if (o.reach && o.reach.arm === i) { s = LEAN + 1.1 * o.reach.k + 0.22 * (1 - o.reach.k); e = -0.2 - 0.3 * o.reach.k; curl = 0.2 + 0.9 * o.reach.k; }
    if (o.lift && o.lift.arm === i) { s = LEAN + 2.6 * o.lift.k; e = -0.6 * o.lift.k; curl = 1.1; }
    if (o.swipe && o.swipe.arm === i) { s = LEAN + 2.2 - 3.2 * o.swipe.k; e = -0.3; curl = 0.1; }
    A.sh.rotation.z = s; A.el.rotation.z = e; A.hand.rotation.z = -0.35 + 0.2 * Math.sin(p) * sw2;
    A.fingers.forEach((fg, k) => { fg.rotation.z = (k % 2 ? 0.8 : 0.5) * curl; });
  });
  const roar = o.roar || 0;
  r.hips.rotation.x = 0.045 * Math.sin(P) * sw; r.torso.rotation.y = 0.07 * Math.sin(P + 0.6) * sw; // the body rolls and twists with the stride
  // the neck curves up and forward; the head is held level whatever the body does, and rears back to roar
  const n0 = 0.62 + roar * 0.35 + 0.05 * Math.sin(P * 2) * sw, n1 = -0.18 + roar * 0.15, n2 = -0.22 + 0.04 * Math.sin(P * 2 + 1) * sw;
  r.neck[0].rotation.z = Math.PI + n0; r.neck[1].rotation.z = n1; r.neck[2].rotation.z = n2;
  r.head.rotation.z = 1.42 + roar * 0.6 - (-LEAN + Math.PI + n0 + n1 + n2); r.jaw.rotation.z = -(0.06 + roar * 0.85 + 0.06 * Math.max(0, Math.sin(t * 0.7))); // the jaw drops to roar, and hangs a little open now and then
  r.minis.forEach((mm, i) => { mm.sh.rotation.z = 0.9 + 0.25 * Math.sin(t * 2.3 + i * 1.7); mm.el.rotation.z = -1.2 + 0.3 * Math.sin(t * 3.1 + i); }); // the little arms twitch
  r.tail.forEach((tl, i) => { tl.rotation.y = Math.sin(t * 1.4 - i * 0.55 + P * 0.5) * (0.06 + i * 0.022); tl.rotation.z = i ? 0.06 : -1.35; }); // a wave running down the tail
  return low;
}
// standing, for the roster
export function kaijuModel() { const r = kaijuRig(); r.hips.position.y = pose(r, 0.8, {}, 0.5); return r.root; }

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
    if (dt > 0) this.st = (this.st || 0) + dt;
    if (A && A.kind === 'roar') o.roar = Math.min(1, A.t * 3) * Math.min(1, (2.6 - A.t) * 2);
    if (A && A.kind === 'swipe') o.swipe = { arm: A.arm, k: Math.min(1, A.t / 0.9) };
    if (A && A.kind === 'car') { if (!A.held) o.reach = { arm: A.arm, k: Math.min(1, A.t / 0.9) }; else o.lift = { arm: A.arm, k: Math.min(1, A.t / 0.8) }; }
    const walking = !A || (A.kind === 'car' && A.held);
    const hy = pose(r, walking ? this.ph : null, o, this.st || 0) + (walking ? 0 : 0.3), exact = !(dt > 0), k = 1 - Math.exp(-dt * 10);
    if (!exact) { // the eased pose is kept apart, so working out a footfall does not disturb it
      r.joints.forEach(([j, ax], i) => { const want = j.rotation[ax]; j.rotation[ax] = this.cur[i] = this.cur[i] == null ? want : this.cur[i] + (want - this.cur[i]) * k; });
      this.hy = this.hy == null ? hy : this.hy + (hy - this.hy) * k;
    }
    r.hips.position.y = exact || this.hy == null ? hy : this.hy;
    r.root.position.set(this.x, 0, this.z); r.root.rotation.y = -this.yaw;
  }
  dispose() { this.dropCar(); this.D.ctx.scene.remove(this.rig.root); }
}
