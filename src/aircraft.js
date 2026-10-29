// Helicopters: the water helicopter flies in, hovers and drops on a circle (or,
// over flood water, drops life rafts); the rescue helicopter hovers over a
// rooftop refuge or over people afloat in a flood, lowers a rope and winches
// survivors up one at a time.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';

const SPEED = 30, ALT = 48, JET_SPEED = 120, JET_ALT = 60;
const ROPE_GEO = new THREE.CylinderGeometry(0.07, 0.07, 1, 5, 1, true).translate(0, -0.5, 0), ROPE_MAT = new THREE.MeshStandardMaterial({ color: '#d8c890', roughness: 0.8 });
const DOWN = new THREE.Vector3(0, -1, 0), _rd = new THREE.Vector3();
const LOWER = 0.6, LIFT = 1.3; // the rope down to them, then the winch up to the door

export class Helicopters {
  constructor(scene, city, fire, people) {
    Object.assign(this, { scene, city, fire, people });
    this.list = []; this.events = []; this.jets = [];
    this.bombGeo = new THREE.CylinderGeometry(0.5, 0.3, 3.2, 8); this.bombGeo.rotateZ(Math.PI / 2);
    this.bombMat = new THREE.MeshStandardMaterial({ color: '#3a3f3a', roughness: 0.6 });
  }

  // an A-10 run: straight line through (tx,tz), bomb released to land there, blast on impact
  // the B-2: high and slow, one bomb, the nuke on impact
  nuke(tx, tz, opts = {}) {
    const obj = buildVehicle('b2'); obj.scale.setScalar(4);
    const a = Math.random() * Math.PI * 2, R = 1100;
    const hx = Math.cos(a), hz = Math.sin(a);
    const jet = { obj, x: tx - hx * R, y: 140, z: tz - hz * R, hx, hz, tx, tz, state: 'in', t: 0, bomb: null, nuke: true, speed: 70, alt: 140, onBlast: opts.onBlast, radius: opts.radius ?? 150 };
    obj.position.set(jet.x, jet.y, jet.z);
    this.scene.add(obj); this.jets.push(jet);
    jet.eta = R / 70;
    return jet;
  }

  // a napalm run: an A-10 low along a line through (tx, tz), canisters bursting into a carpet of fire behind it (what is
  // there catches; opts.onBurn(x, z, R) at each, for the killer plant)
  napalm(tx, tz, opts = {}) {
    const obj = buildVehicle('a10'); obj.scale.setScalar(2.2);
    const a = Math.random() * Math.PI * 2, R = 900, hx = Math.cos(a), hz = Math.sin(a);
    const jet = { obj, x: tx - hx * R, y: 60, z: tz - hz * R, hx, hz, tx, tz, state: 'in', t: 0, napalm: true, speed: 75, alt: 60, onBurn: opts.onBurn, dropT: 0 };
    obj.position.set(jet.x, jet.y, jet.z); this.scene.add(obj); this.jets.push(jet);
    jet.eta = R / 75;
    return jet;
  }
  // a cloud seeding run: a light plane crosses (tx, tz) trailing silver iodide; onSeed when it is over the target
  seed(tx, tz, opts = {}) {
    const obj = buildVehicle('seeder_plane'); obj.scale.setScalar(2.4);
    const a = Math.random() * Math.PI * 2, R = 800, hx = Math.cos(a), hz = Math.sin(a);
    const jet = { obj, x: tx - hx * R, y: 95, z: tz - hz * R, hx, hz, tx, tz, state: 'in', t: 0, seed: true, speed: 55, alt: 95, onSeed: opts.onSeed, trailT: 0 };
    obj.position.set(jet.x, jet.y, jet.z); this.scene.add(obj); this.jets.push(jet);
    jet.eta = R / 55;
    return jet;
  }

  strike(tx, tz, opts = {}) {
    const obj = buildVehicle('a10'); obj.scale.setScalar(2.2);
    const a = Math.random() * Math.PI * 2, R = 900;
    const hx = Math.cos(a), hz = Math.sin(a);
    const jet = { obj, x: tx - hx * R, y: JET_ALT, z: tz - hz * R, hx, hz, tx, tz, state: 'in', t: 0, bomb: null, onBlast: opts.onBlast, radius: opts.radius ?? 25 };
    obj.position.set(jet.x, jet.y, jet.z);
    this.scene.add(obj); this.jets.push(jet);
    jet.eta = R / JET_SPEED;
    return jet;
  }

  // kind 'water' | 'rescue'; opts.k = building index for a rescue (-1: people afloat around (tx, tz));
  // opts.onDrop(x, z) for a water helicopter dropping life rafts instead of water
  send(kind, tx, tz, opts = {}) {
    const obj = buildVehicle(kind === 'water' ? 'heli_wildfire' : 'heli_rescue');
    obj.scale.setScalar(2.0);
    const B = this.city.bounds;
    const a = Math.random() * Math.PI * 2, R = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.75 + 150;
    const hl = { kind, obj, x: tx + Math.cos(a) * R, y: ALT, z: tz + Math.sin(a) * R, tx, tz, state: 'in', t: 0, k: opts.k ?? -1,
      loaded: 0, idle: 0, load: 0, onDone: opts.onDone, onDrop: opts.onDrop, hx: 1, hz: 0, v: 0, bob: Math.random() * 6, eta: (R - 60) / SPEED + 60 / 12 };
    obj.position.set(hl.x, hl.y, hl.z);
    this.scene.add(obj); this.list.push(hl);
    return hl;
  }

  // how high a rescue helicopter hangs: well over the roof, or over the water
  hoverY(hl) { if (hl.k >= 0) return this.people.bld[hl.k].roofY + 11; const w = this.people.waterAt ? this.people.waterAt(hl.tx, hl.tz) : 0; return Math.max(0, w) + 15; }
  // the winch: a rope down to the next survivor (off the roof, or the nearest afloat under it), up they come, the next.
  // Over water it edges across to whoever is afloat nearby
  hoistStep(hl, h) {
    const P = this.people, R = hl.rope || (hl.rope = { j: -1, t: 0, len: 0, mesh: null });
    if (!R.mesh) { R.mesh = new THREE.Mesh(ROPE_GEO, ROPE_MAT); R.mesh.frustumCulled = false; this.scene.add(R.mesh); }
    if (R.j >= 0 && P.st[R.j] !== 19) R.j = -1; // taken by something else meanwhile
    if (R.j < 0) {
      let j = hl.k >= 0 ? P.roofPerson(hl.k) : -1;
      if (j < 0 && P.waterAt) j = P.nearestSwimmer(hl.x, hl.z, 22);
      if (j < 0 || !P.hoist(j)) {
        hl.idle += h; R.len += (4 - R.len) * Math.min(1, h * 2);
        const far = P.waterAt && hl.k < 0 ? P.nearestSwimmer(hl.x, hl.z, 110) : -1;
        if (far >= 0) { const dx = P.x[far] - hl.x, dz = P.z[far] - hl.z, d = Math.hypot(dx, dz) || 1, s = Math.min(d, 9 * h); hl.x += dx / d * s; hl.z += dz / d * s; hl.tx = hl.x; hl.tz = hl.z; hl.idle = Math.max(0, hl.idle - h); }
        return;
      }
      hl.idle = 0; R.j = j; R.t = 0; R.x0 = P.x[j]; R.y0 = P.y[j]; R.z0 = P.z[j];
    }
    R.t += h;
    const j = R.j, top = hl.y - 1.5;
    if (R.t < LOWER) { R.len = Math.max(R.len, (top - R.y0 - 1.9) * (R.t / LOWER)); return; }
    const e = Math.min(1, (R.t - LOWER) / LIFT), k = e * e * (3 - 2 * e);
    P.x[j] = R.x0 + (hl.x - R.x0) * k; P.z[j] = R.z0 + (hl.z - R.z0) * k; P.y[j] = R.y0 + (top - 2.2 - R.y0) * k;
    if (e >= 1) { P.winched(j); R.j = -1; R.len = 3; hl.loaded++; this.events.push({ type: 'rescued', k: hl.k }); }
  }
  update(h) {
    for (const hl of this.list) {
      if (hl.state === 'in') {
        const dx = hl.tx - hl.x, dz = hl.tz - hl.z, d = Math.hypot(dx, dz) || 0.001;
        const v = d > 60 ? SPEED : Math.max(5, SPEED * d / 60);
        const step = Math.min(d, v * h);
        hl.x += dx / d * step; hl.z += dz / d * step; hl.hx = dx / d; hl.hz = dz / d; hl.v = v;
        if (hl.kind === 'rescue' && d < 80) hl.y += (this.hoverY(hl) - hl.y) * Math.min(1, h * 1.5);
        else if (hl.kind === 'water' && d < 80) hl.y += (28 - hl.y) * Math.min(1, h * 1.2);
        if (d < 1.5) { hl.state = 'hover'; hl.t = 0; }
      } else if (hl.state === 'hover') {
        hl.t += h; hl.v = 0;
        if (hl.kind === 'water') {
          if (hl.t >= 2.5) {
            if (hl.onDrop) { hl.onDrop(hl.tx, hl.tz); hl.state = 'out'; hl.t = 0; continue; }
            this.fire.dropWater(hl.tx, hl.tz, 40);
            if (this.doubleDrop && !hl.second) { hl.second = true; hl.tx += hl.hx * 45; hl.tz += hl.hz * 45; hl.state = 'in'; hl.t = 0; }
            else { hl.state = 'out'; hl.t = 0; if (hl.onDone) hl.onDone(); }
          }
        } else {
          if (hl.k >= 0 && this.city.dead && this.city.dead[hl.k]) hl.k = -1; // the building went down under it: over the water (or nothing) now
          hl.y += (this.hoverY(hl) - hl.y) * Math.min(1, h * 2);
          this.hoistStep(hl, h);
          if (hl.loaded >= 12 || hl.idle >= 6 || hl.t > 45) {
            const R = hl.rope; if (R && R.j >= 0) { this.people.winched(R.j); R.j = -1; hl.loaded++; } // the one on the rope is pulled in
            hl.state = 'out'; hl.t = 0; if (hl.onDone) hl.onDone(hl.loaded);
          }
        }
      } else {
        hl.t += h; hl.v = Math.min(SPEED, 6 + hl.t * 8);
        hl.y += (ALT + 12 - hl.y) * Math.min(1, h * 0.8);
        hl.x += hl.hx * hl.v * h; hl.z += hl.hz * hl.v * h;
        const B = this.city.bounds;
        if (hl.rope && hl.rope.mesh) { hl.rope.len = Math.max(0, hl.rope.len - h * 6); if (hl.rope.len <= 0) { this.scene.remove(hl.rope.mesh); hl.rope.mesh = null; } } // reeled in
        if (hl.x < B.x0 - 300 || hl.x > B.x1 + 300 || hl.z < B.z0 - 300 || hl.z > B.z1 + 300) { this.scene.remove(hl.obj); if (hl.rope && hl.rope.mesh) this.scene.remove(hl.rope.mesh); hl.dead = true; }
      }
    }
    if (this.list.some(hl => hl.dead)) this.list = this.list.filter(hl => !hl.dead);
    for (const j of this.jets) {
      const sp = j.speed || JET_SPEED, alt = j.alt || JET_ALT;
      j.x += j.hx * sp * h; j.z += j.hz * sp * h; j.t += h;
      const along = (j.tx - j.x) * j.hx + (j.tz - j.z) * j.hz; // distance still to go to the target
      // release the bomb so its ballistic fall lands it on the target
      const lead = sp * Math.sqrt(2 * alt / 9.8);
      if (j.seed) { // no bomb: a long white trail of seeding flares over the target, and the clouds answer
        if (Math.abs(along) < 260 && (j.trailT -= h) <= 0) { j.trailT = 0.12; this.fire.spray(j.x - j.hx * 6, j.z - j.hz * 6, j.y - 2, 5, 4, 3.2); }
        if (j.state === 'in' && along <= 0) { j.state = 'done'; if (j.onSeed) j.onSeed(j.tx, j.tz); }
        if (along < -1300) { this.scene.remove(j.obj); j.dead = true; }
        continue;
      }
      if (j.napalm) { // canisters all along the run over the target, bursting into fire just behind it
        if (Math.abs(along) < 85 && (j.dropT -= h) <= 0) {
          j.dropT = 0.12; const bx = j.x - j.hx * 30, bz = j.z - j.hz * 30;
          this.fire.burst(bx, 1.5, bz, 18, 3.2); this.fire.burst(bx + (Math.random() - 0.5) * 10, 1, bz + (Math.random() - 0.5) * 10, 10, 2.4);
          this.city.buildingsNear(bx, bz, 7, (k) => { if (Math.random() < 0.25) this.fire.igniteBuilding(k); }); this.people.scare(bx, bz, 35, 0.9);
          if (j.onBurn) j.onBurn(bx, bz, 11);
        }
        if (along < -1300) { this.scene.remove(j.obj); j.dead = true; }
        continue;
      }
      if (j.state === 'in' && along <= lead) {
        j.state = 'dropped';
        const m = new THREE.Mesh(this.bombGeo, this.bombMat); m.castShadow = true;
        this.scene.add(m);
        if (j.nuke) m.scale.setScalar(2.5);
        j.bomb = { m, x: j.x, y: j.y - 2, z: j.z, vx: j.hx * sp, vz: j.hz * sp, vy: 0 };
      }
      if (j.bomb) {
        const b = j.bomb;
        b.vy -= 9.8 * h; b.x += b.vx * h; b.z += b.vz * h; b.y += b.vy * h;
        b.m.position.set(b.x, b.y, b.z); b.m.rotation.y = Math.atan2(-b.vz, b.vx); b.m.rotation.z = Math.atan2(b.vy, Math.hypot(b.vx, b.vz));
        if (b.y <= 0.5) {
          this.scene.remove(b.m); j.bomb = null;
          if (j.nuke && this.nukeBlast) { this.nukeBlast(b.x, b.z, j.radius); this.events.push({ type: 'nuke', x: b.x, z: b.z }); }
          else if (j.nuke) { this.fire.nuke(b.x, b.z, j.radius, { cloud: !this.mushroom }); if (this.mushroom) this.mushroom(b.x, b.z, j.radius); this.people.nuke(b.x, b.z, j.radius); if (this.traffic) this.traffic.nuke(b.x, b.z, j.radius); this.events.push({ type: 'nuke', x: b.x, z: b.z }); }
          else { this.fire.blast(b.x, b.z, j.radius); this.people.blast(b.x, b.z, j.radius); }
          if (j.onBlast) j.onBlast(b.x, b.z);
        }
      }
      if (along < -1300) { this.scene.remove(j.obj); j.dead = true; }
    }
    if (this.jets.some(j => j.dead)) this.jets = this.jets.filter(j => !j.dead);
  }

  sync(dt) {
    for (const hl of this.list) {
      const o = hl.obj;
      hl.bob += dt * 2;
      o.position.set(hl.x, hl.y + Math.sin(hl.bob) * 0.4, hl.z);
      o.rotation.y = Math.atan2(-hl.hz, hl.hx);
      o.rotation.z = -(hl.v / SPEED) * 0.25;
      if (o.userData.rotor) o.userData.rotor.rotation.y += dt * 22;
      const R = hl.rope;
      if (R && R.mesh) { // from the belly to whoever is on it, or hanging free
        const P = this.people, x0 = o.position.x, y0 = o.position.y - 1.5, z0 = o.position.z;
        if (R.j >= 0 && R.t >= LOWER) _rd.set(P.x[R.j] - x0, P.y[R.j] + 1.9 - y0, P.z[R.j] - z0); else _rd.set(Math.sin(hl.bob * 0.7) * 0.3, -Math.max(0.1, R.len), Math.cos(hl.bob * 0.6) * 0.3);
        const L = Math.max(0.1, _rd.length()); R.mesh.position.set(x0, y0, z0); R.mesh.quaternion.setFromUnitVectors(DOWN, _rd.multiplyScalar(1 / L)); R.mesh.scale.set(1, L, 1);
      }
    }
    for (const j of this.jets) { j.obj.position.set(j.x, j.y, j.z); j.obj.rotation.y = Math.atan2(-j.hz, j.hx); j.obj.rotation.z = Math.sin(j.t * 1.5) * 0.04; }
  }

  reset() { for (const hl of this.list) { this.scene.remove(hl.obj); if (hl.rope && hl.rope.mesh) this.scene.remove(hl.rope.mesh); } this.list = []; for (const j of this.jets) { this.scene.remove(j.obj); if (j.bomb) this.scene.remove(j.bomb.m); } this.jets = []; this.events.length = 0; }
}
