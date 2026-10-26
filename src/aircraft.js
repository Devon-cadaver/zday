// Helicopters: the water helicopter flies in, hovers and drops on a circle;
// the rescue helicopter hovers over a rooftop refuge and lifts survivors off.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';

const SPEED = 30, ALT = 48, JET_SPEED = 120, JET_ALT = 60;

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

  // kind 'water' | 'rescue'; opts.k = building index for a rescue
  send(kind, tx, tz, opts = {}) {
    const obj = buildVehicle(kind === 'water' ? 'heli_wildfire' : 'heli_rescue');
    obj.scale.setScalar(2.0);
    const B = this.city.bounds;
    const a = Math.random() * Math.PI * 2, R = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 0.75 + 150;
    const hl = { kind, obj, x: tx + Math.cos(a) * R, y: ALT, z: tz + Math.sin(a) * R, tx, tz, state: 'in', t: 0, k: opts.k ?? -1,
      loaded: 0, idle: 0, load: 0, onDone: opts.onDone, hx: 1, hz: 0, v: 0, bob: Math.random() * 6, eta: (R - 60) / SPEED + 60 / 12 };
    obj.position.set(hl.x, hl.y, hl.z);
    this.scene.add(obj); this.list.push(hl);
    return hl;
  }

  update(h) {
    for (const hl of this.list) {
      if (hl.state === 'in') {
        const dx = hl.tx - hl.x, dz = hl.tz - hl.z, d = Math.hypot(dx, dz) || 0.001;
        const v = d > 60 ? SPEED : Math.max(5, SPEED * d / 60);
        const step = Math.min(d, v * h);
        hl.x += dx / d * step; hl.z += dz / d * step; hl.hx = dx / d; hl.hz = dz / d; hl.v = v;
        if (hl.kind === 'rescue' && d < 80) { const b = this.people.bld[hl.k]; hl.y += (b.roofY + 4 - hl.y) * Math.min(1, h * 1.5); }
        else if (hl.kind === 'water' && d < 80) hl.y += (28 - hl.y) * Math.min(1, h * 1.2);
        if (d < 1.5) { hl.state = 'hover'; hl.t = 0; }
      } else if (hl.state === 'hover') {
        hl.t += h; hl.v = 0;
        if (hl.kind === 'water') {
          if (hl.t >= 2.5) { this.fire.dropWater(hl.tx, hl.tz, 40); hl.state = 'out'; hl.t = 0; if (hl.onDone) hl.onDone(); }
        } else {
          const b = this.people.bld[hl.k];
          hl.y += (b.roofY + 4 - hl.y) * Math.min(1, h * 2);
          hl.load -= h;
          if (hl.load <= 0) {
            hl.load = 0.5;
            if (this.people.evacuateFrom(hl.k)) { hl.loaded++; hl.idle = 0; this.events.push({ type: 'rescued', k: hl.k }); }
            else hl.idle += 0.5;
          }
          if (hl.loaded >= 12 || hl.idle >= 6 || hl.t > 40) { hl.state = 'out'; hl.t = 0; if (hl.onDone) hl.onDone(hl.loaded); }
        }
      } else {
        hl.t += h; hl.v = Math.min(SPEED, 6 + hl.t * 8);
        hl.y += (ALT + 12 - hl.y) * Math.min(1, h * 0.8);
        hl.x += hl.hx * hl.v * h; hl.z += hl.hz * hl.v * h;
        const B = this.city.bounds;
        if (hl.x < B.x0 - 300 || hl.x > B.x1 + 300 || hl.z < B.z0 - 300 || hl.z > B.z1 + 300) { this.scene.remove(hl.obj); hl.dead = true; }
      }
    }
    if (this.list.some(hl => hl.dead)) this.list = this.list.filter(hl => !hl.dead);
    for (const j of this.jets) {
      const sp = j.speed || JET_SPEED, alt = j.alt || JET_ALT;
      j.x += j.hx * sp * h; j.z += j.hz * sp * h; j.t += h;
      const along = (j.tx - j.x) * j.hx + (j.tz - j.z) * j.hz; // distance still to go to the target
      // release the bomb so its ballistic fall lands it on the target
      const lead = sp * Math.sqrt(2 * alt / 9.8);
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
          if (j.nuke) { this.fire.nuke(b.x, b.z, j.radius); this.people.nuke(b.x, b.z, j.radius); if (this.traffic) this.traffic.nuke(b.x, b.z, j.radius); this.events.push({ type: 'nuke', x: b.x, z: b.z }); }
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
    }
    for (const j of this.jets) { j.obj.position.set(j.x, j.y, j.z); j.obj.rotation.y = Math.atan2(-j.hz, j.hx); j.obj.rotation.z = Math.sin(j.t * 1.5) * 0.04; }
  }

  reset() { for (const hl of this.list) this.scene.remove(hl.obj); this.list = []; for (const j of this.jets) { this.scene.remove(j.obj); if (j.bomb) this.scene.remove(j.bomb.m); } this.jets = []; this.events.length = 0; }
}
