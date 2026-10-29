// Hero and villain fights. They throw cars at each other: whoever a car is
// thrown at may catch it and spin round to hurl it straight back, break it in
// half with their hands, laser it in half (Tyrant), dodge it (Blur), or take it
// full on and go flying. They grab each other and hurl the other through the
// nearest building: windows burst out of the far side, smaller buildings come
// down behind them, and they leave a crater where they land. Or they grab the
// other by the throat and fly low down the street, dragging them through the
// ground: cars kicked flying, buildings in the way ploughed through, a trench of
// cracks and dust behind, and a fling at the end. Fist fights and beam clashes: melee.js.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { Melee } from './melee.js';
import { Stunts } from './stunts.js';

const AIR = 5, EXT = 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SPIN = 0.65; // one full turn before the throw
const HALVES = new Map(); // car type -> [front half, back half]

// a car cut across the middle: every vertex behind (or in front of) the cut is pressed flat onto it, so each half is closed off by its own end face
function halves(traffic, type) {
  let h = HALVES.get(type); if (h) return h;
  const g = traffic.geometryOf(type), mk = (front) => { const c = g.clone(), p = c.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, front ? Math.max(p.getX(i), 0) : Math.min(p.getX(i), 0)); return c; };
  h = [mk(true), mk(false)]; HALVES.set(type, h); return h;
}

// where to aim a throw at a fighter: a little ahead of where it is going
const aimAt = (f) => [f.x + (f.vx || 0) * 0.6, (f.y || 0) + 2.5, f.z + (f.vz || 0) * 0.6];
const alive = (f) => f && (f.side === 'hero' ? f.state === 'fly' : !f.gone && !f.beaten);

// something thrown hard (a hero or a villain): it flies until it hits the ground, smashing through what is in the way. true when it lands
export function tossStep(o, D, h) {
  const T = o.tossed, { city, fire, people, traffic } = D.ctx;
  T.t += h; T.vy -= 16 * h;
  const n = Math.max(1, Math.ceil(Math.hypot(T.vx, T.vy, T.vz) * h / 1.5));
  for (let s = 0; s < n; s++) {
    o.x += T.vx * h / n; o.y += T.vy * h / n; o.z += T.vz * h / n;
    let inB = -1; city.buildingsNear(o.x, o.z, 0.1, (k, d, b) => { if (d === 0 && o.y < b.top + 0.5) inB = k; });
    if (inB !== T.inB) { if (T.inB >= 0) smash(D, T.inB, o.x, o.y, o.z, T.vx, T.vz, true); if (inB >= 0) smash(D, inB, o.x, o.y, o.z, T.vx, T.vz, false); T.inB = inB; }
    if (inB >= 0) { T.vx *= 0.975; T.vz *= 0.975; } // ploughing through slows them a little
  }
  const B = city.bounds; o.x = clamp(o.x, B.x0 + 5, B.x1 - 5); o.z = clamp(o.z, B.z0 + 5, B.z1 - 5);
  const gy = people.groundY(o.x, o.z);
  if (o.y > gy || T.vy > 0) return false;
  o.y = gy; o.tossed = null;
  if (T.inB >= 0) smash(D, T.inB, o.x, o.y, o.z, T.vx, T.vz, true);
  D.decals.add('crack', o.x, o.z, 10, 10); fire.dustCloud(o.x, o.z, 7, 6); fire.burst(o.x, 0.5, o.z, 22, 2.4);
  people.around(o.x, o.z, 9, (j) => { if (!people.hittable(j)) return; const dx = people.x[j] - o.x, dz = people.z[j] - o.z, d = Math.hypot(dx, dz) || 1; people.move(j, dx / d, dz / d, 3); people.panic(j, o.x, o.z, -1); });
  traffic.near(o.x, o.z, 7, (c) => { if (c.gone || c.mode === EXT || c.mode === AIR) return; const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz) || 1; if (d > 7) return; c.soft = true; traffic.fling(c, dx / d * 9, 5, dz / d * 9); });
  if (near(D, o.x, o.z)) D.shake(0.7);
  return true;
}
// through building k at (x, y, z) heading (vx, vz): windows burst out, and coming out of a small one brings it down
function smash(D, k, x, y, z, vx, vz, out) {
  const { city, fire } = D.ctx, b = city.buildings[k]; if (!b || city.dead[k]) return;
  const hgt = b.top - b.baseY, wc = b.wallCol, col = ((wc[0] * 255) << 16) | ((wc[1] * 255) << 8) | (wc[2] * 255), sp = Math.hypot(vx, vz) || 1, f = out ? 1 : -0.4;
  D.blowWindows(k, vx, vz, 1.2);
  for (let i = 0; i < 16; i++) { const s = 0.5 + Math.random() * 1.4, v = 6 + Math.random() * 12; D.debris.add(x, y + (Math.random() - 0.5) * 3, z, s, s * 0.6, s, Math.random() < 0.65 ? col : 0x8a8478, 'fly', { v: [vx / sp * v * f + (Math.random() - 0.5) * 6, 1 + Math.random() * 6, vz / sp * v * f + (Math.random() - 0.5) * 6] }); }
  fire.dustCloud(x, z, 5, Math.min(hgt, y + 6));
  if (out && (hgt < 30 || (hgt < 50 && Math.random() < 0.5))) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(vz, vx), spare: true, noCrush: true });
  if (near(D, x, z)) D.shake(0.35);
}
function near(D, x, z) { const { camera, controls } = D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.2; }
export function toss(f, vx, vy, vz) { if (f.dropHeld) f.dropHeld(); f.tossed = { vx, vy, vz, t: 0, inB: -1 }; f.busyT = 0; f.spinning = false; f.pinned = null; }

export class Brawl {
  constructor(D) { this.D = D; this.shots = []; this.spins = []; this.drags = []; this.said = {}; this.t = 0; this.melee = new Melee(this); this.stunts = new Stunts(this); } // melee: hand to hand, gang-ups, beam clashes; stunts: the sky slam, the space dive
  reset() { for (const S of this.drags) S.victim.pinned = null; this.shots.length = 0; this.spins.length = 0; this.drags.length = 0; this.said = {}; this.melee.reset(); this.stunts.reset(); }
  say(key, text) { if ((this.said[key] || -99) + 8 > this.t) return; this.said[key] = this.t; this.D.emit({ type: 'brawl', text }); }
  // the side's fighters on the map now
  fighters(side) { const out = []; for (const e of this.D.list) if (e.alive && e.type === (side === 'hero' ? 'heroes' : 'villains')) for (const f of e.who) if (alive(f)) out.push(f); return out; }
  // the villains event a villain belongs to (for beating it)
  owner(v) { return this.D.list.find(e => e.type === 'villains' && e.who.includes(v)); }
  hurt(f, n, by) { sfx('thud', f.x, (f.y || 0) + 2, f.z, { gain: Math.min(1.3, 0.5 + n / 40) }); if (f.side !== 'villain') return; f.hp -= n * (f.frail || 1); if (f.hp <= 0) { const V = this.owner(f); if (V) V.beat(f, by.name); } }
  // car (held, or still on the street) thrown by `by` at fighter `target`
  throwCar(car, by, target) {
    const { traffic } = this.D.ctx, [tx, ty, tz] = aimAt(target), x0 = car.x, y0 = car.y || 0, z0 = car.z, d = Math.hypot(tx - x0, tz - z0), T = clamp(d / 38, 0.5, 2.2);
    if (car.mode !== EXT && !traffic.grab(car)) return false;
    car.soft = true; traffic.fling(car, (tx - x0) / T, (ty - y0 + 0.5 * 9.8 * T * T) / T, (tz - z0) / T);
    this.shots.push({ car, by, target, t: 0, decided: false, zap: false });
    return true;
  }
  // holder spins round once with the car (or a fighter) at arm's length, then lets go at target
  spin(holder, what, target) {
    const isCar = !what.side;
    if (isCar) { what.mode = EXT; what.vx = what.vy = what.vz = 0; } else { what.busyT = SPIN + 0.4; what.gripped = true; }
    holder.busyT = SPIN + 0.1; holder.spinning = true;
    this.spins.push({ holder, what, isCar, target, t: 0 });
  }
  // grab a fighter and hurl it through the building nearest the way you face
  grab(holder, victim) { if (victim.tossed || victim.gripped) return; this.spin(holder, victim, null); this.say('grab' + holder.name, holder.name + ' grabbed ' + victim.name + '!'); }
  // by the throat, down the street: the way (of eight) with the most in it to plough through and room to run 80 m
  drag(holder, victim) {
    if (victim.tossed || victim.gripped || holder.tossed || holder.gripped || this.drags.some(S => S.holder === holder || S.victim === victim)) return false;
    const { city, traffic } = this.D.ctx, B = city.bounds; let best = null, bs = -1e9;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.random() * 0.3, dx = Math.cos(a), dz = Math.sin(a), ex = victim.x + dx * 80, ez = victim.z + dz * 80;
      if (ex < B.x0 + 20 || ex > B.x1 - 20 || ez < B.z0 + 20 || ez > B.z1 - 20) continue;
      let s = Math.random() * 2;
      for (let d = 10; d <= 80; d += 10) { const px = victim.x + dx * d, pz = victim.z + dz * d; traffic.near(px, pz, 6, () => { s += 1; }); city.buildingsNear(px, pz, 0.1, (k, dd, b) => { if (dd === 0 && b.top - b.baseY < 60) s += 0.6; else if (dd === 0) s -= 3; }); }
      if (s > bs) { bs = s; best = [dx, dz]; }
    }
    if (!best) return false;
    holder.busyT = 3; holder.dragging = true; victim.gripped = true; victim.busyT = 3.5; victim.pinned = 'drag'; if (victim.dropHeld) victim.dropHeld(); // on their back, not tumbling (villains.js pinPose)
    this.drags.push({ holder, victim, dx: best[0], dz: best[1], t: 0, T: 2.4, inB: -1, step: 0, sp: 0 });
    this.say('drag' + holder.name, holder.name + ' grabbed ' + victim.name + ' by the throat and is dragging them down the street!');
    return true;
  }
  dragStep(S, h) {
    const D = this.D, { city, traffic, people, fire } = D.ctx, H = S.holder, V = S.victim, B = city.bounds;
    S.t += h; S.sp = Math.min(34, S.sp + h * 90);
    const nx = H.x + S.dx * S.sp * h, nz = H.z + S.dz * S.sp * h;
    const end = S.t > S.T || !alive(H) || !alive(V) || nx < B.x0 + 12 || nx > B.x1 - 12 || nz < B.z0 + 12 || nz > B.z1 - 12;
    if (end) { // let go with a fling onwards
      H.dragging = false; H.busyT = 0.5; V.gripped = false; V.pinned = null;
      if (alive(V)) { toss(V, S.dx * 22, 7, S.dz * 22); this.hurt(V, 35, H); }
      if (S.inB >= 0) smash(D, S.inB, V.x, 1.5, V.z, S.dx * 30, S.dz * 30, true);
      return true;
    }
    H.x = nx; H.z = nz; H.y += (people.groundY(H.x, H.z) + 2.2 - (H.y || 0)) * Math.min(1, h * 6); H.yaw = Math.atan2(S.dx, S.dz); H.busyT = Math.max(H.busyT, 0.1); if (H.punchT != null) H.punchT = 0.2;
    V.x = H.x - S.dx * 3; V.z = H.z - S.dz * 3; V.y = people.groundY(V.x, V.z) + 0.2; V.yaw = H.yaw + Math.PI; V.busyT = Math.max(V.busyT, 0.3);
    let inB = -1; city.buildingsNear(V.x, V.z, 0.1, (k, d, b) => { if (d === 0) inB = k; });
    if (inB !== S.inB) { if (S.inB >= 0) smash(D, S.inB, V.x, 1.5, V.z, S.dx * 30, S.dz * 30, true); if (inB >= 0) smash(D, inB, V.x, 1.5, V.z, S.dx * 30, S.dz * 30, false); S.inB = inB; }
    if ((S.step -= S.sp * h) <= 0) { // every few metres along the trench
      S.step = 2.2; S.k = (S.k || 0) + 1;
      D.decals.add('scour', V.x, V.z, 6.5, 3.4, Math.atan2(-S.dz, S.dx)); // a gouge torn along the street
      if (S.k % 2) D.decals.add('crack', V.x, V.z, 8, 8); if (S.k % 3 === 0) fire.dustCloud(V.x, V.z, 3.5, 2.5); fire.burst(V.x, 0.4, V.z, 5, 1.4);
      traffic.near(V.x, V.z, 7, (c) => { if (c.gone || c.mode === EXT || c.mode === AIR) return; const sx = c.x - V.x, sz = c.z - V.z, d = Math.hypot(sx, sz) || 1; if (d > 7) return; c.soft = true; traffic.fling(c, sx / d * 10 + S.dx * 14, 7 + Math.random() * 5, sz / d * 10 + S.dz * 14); });
      for (const pc of traffic.parkedNear(V.x, V.z, 5)) traffic.burnParked(pc);
      people.around(V.x, V.z, 7, (j) => { if (!people.hittable(j)) return; const dx = people.x[j] - V.x, dz = people.z[j] - V.z, d = Math.hypot(dx, dz) || 1; people.move(j, dx / d, dz / d, 3); people.panic(j, V.x, V.z, -1); });
      if (near(D, V.x, V.z) && S.k % 2) D.shake(0.3);
    }
    return false;
  }
  // through a building: the one 25-90 m away most nearly ahead
  throwThrough(holder, victim) {
    const { city } = this.D.ctx; let best = null, bs = -1e9;
    city.buildingsNear(holder.x, holder.z, 90, (k, d, b) => { if (d < 20 || b.landmark) return; const cx = (b.x0 + b.x1) / 2 - holder.x, cz = (b.z0 + b.z1) / 2 - holder.z, l = Math.hypot(cx, cz) || 1, s = (cx / l) * Math.sin(holder.yaw) + (cz / l) * Math.cos(holder.yaw) + Math.random() * 0.6; if (s > bs) { bs = s; best = [cx / l, cz / l, l, b.top]; } });
    const [dx, dz] = best || [Math.sin(holder.yaw), Math.cos(holder.yaw)];
    toss(victim, dx * 36, 4, dz * 36); victim.gripped = false;
    this.hurt(victim, 30, holder);
    this.say('toss' + victim.name, holder.name + ' threw ' + victim.name + ' through a building!');
  }
  // a thrown car cut in two (by hand or by laser): the halves fly apart
  split(car, laser, by) {
    const D = this.D, { traffic, fire } = D.ctx;
    if (car.mission || car.gone) return;
    const [fg, bg] = halves(traffic, car.type), mat = D.carMat(car.colHex), hx = Math.cos(car.yaw), hz = -Math.sin(car.yaw), y = car.y || 0;
    [[fg, 1], [bg, -1]].forEach(([g, s]) => {
      const m = new THREE.Mesh(g, mat); m.castShadow = true; m.position.set(car.x, y, car.z); m.rotation.set(car.roll || 0, car.yaw, car.pitch || 0, 'YXZ');
      D.debris.addObject(m, 'fly', { v: [(car.vx || 0) * 0.3 + hx * s * 7, 3 + Math.random() * 3, (car.vz || 0) * 0.3 + hz * s * 7] });
    });
    fire.burst(car.x, y + 1, car.z, laser ? 24 : 14, laser ? 1.8 : 1.4);
    traffic.remove(car);
    this.say(laser ? 'laser' : 'break', (by ? by.name : 'Someone') + (laser ? ' lasered the car in half!' : ' broke the car in half!'));
  }
  // what the one a car is thrown at does about it
  react(s) {
    const T = s.target, r = Math.random(), c = s.car;
    const pick = { Nova: [0.4, 0.75, 0], Dragonfly: [0.4, 0, 0.25], Tempo: [0.35, 0, 0], Tyrant: [0.45, 0, 0], Weaver: [0.4, 0, 0], Blur: [0, 0, T.trapped > 0.5 ? 0 : 0.6] }[T.name] || [0.3, 0, 0];
    if (r < pick[0]) { this.spin(T, c, s.by); this.say('catch' + T.name, T.name + ' caught the car and hurled it back!'); return true; } // caught: round once and straight back at them
    if (r < pick[0] + pick[1]) { this.split(c, false, T); return true; }
    if (r < pick[0] + pick[1] + pick[2]) { T.x += Math.cos(T.yaw) * 6; T.z -= Math.sin(T.yaw) * 6; return false; } // dodged
    toss(T, c.vx * 0.8, 6, c.vz * 0.8); c.vx *= 0.25; c.vz *= 0.25; this.hurt(T, 18, s.by); // took it full on
    this.say('hit' + T.name, T.name + ' was knocked flying by a car!');
    return true;
  }
  update(h) {
    this.t += h; this.melee.update(h); this.stunts.update(h);
    const D = this.D, { city, traffic, fire } = D.ctx;
    for (let i = this.drags.length - 1; i >= 0; i--) if (this.dragStep(this.drags[i], h)) this.drags.splice(i, 1);
    for (let i = this.spins.length - 1; i >= 0; i--) {
      const S = this.spins[i], H = S.holder, w = S.what; S.t += h;
      H.yaw += h * Math.PI * 2 / SPIN; H.busyT = Math.max(H.busyT || 0, 0.05);
      const ox = Math.sin(H.yaw) * 4, oz = Math.cos(H.yaw) * 4;
      if (S.isCar) { if (w.gone || w.mode !== EXT) { H.spinning = false; this.spins.splice(i, 1); continue; } w.x = H.x + ox; w.z = H.z + oz; w.y = (H.y || 0) + 3.5; w.yaw = -H.yaw; }
      else { w.x = H.x + ox; w.z = H.z + oz; w.y = (H.y || 0) + 3; w.yaw = H.yaw + Math.PI; }
      if (S.t < SPIN) continue;
      H.spinning = false; this.spins.splice(i, 1);
      if (S.isCar) { const tg = alive(S.target) ? S.target : null; if (tg) this.throwCar(w, H, tg); else { w.soft = true; traffic.fling(w, ox * 6, 6, oz * 6); } }
      else this.throwThrough(H, w);
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], c = s.car; s.t += h;
      if (c.gone || c.mode !== AIR) { this.shots.splice(i, 1); if (!c.gone && c.mode !== EXT) { fire.burst(c.x, 1, c.z, 10, 1.8); D.ctx.people.scare(c.x, c.z, 14, 0.9); } continue; }
      let hit = -1; city.buildingsNear(c.x, c.z, 0.3, (k, d, b) => { if (d === 0 && (c.y || 0) < b.top) hit = k; });
      if (hit >= 0) { smash(D, hit, c.x, c.y || 0, c.z, c.vx, c.vz, true); c.vx *= -0.1; c.vz *= -0.1; this.shots.splice(i, 1); continue; }
      const T = s.target; if (!alive(T) || s.decided) continue;
      const [tx, ty, tz] = [T.x, (T.y || 0) + 2.5, T.z], d = Math.hypot(c.x - tx, (c.y || 0) - ty, c.z - tz);
      if (T.zap && !s.zap && d < 38) { s.zap = true; if (Math.random() < 0.4 && T.zap(c, () => this.split(c, true, T))) { s.decided = true; continue; } } // Tyrant's laser eyes, while it is still on the way
      if (d < 8) { s.decided = true; if (this.react(s)) this.shots.splice(i, 1); }
    }
  }
}
