// Be The Disaster: pick a disaster and be it for a minute and a half. One finger
// drives it (two fingers pan and zoom): steer a tornado, fly an alien saucer,
// pull a tsunami through the streets, pour lava, tear a fault line across the
// city, open sinkholes, or call down meteors. Everything destroyed scores.
import * as THREE from 'three';
import { Twister } from './twister.js';
import { Splash } from './water.js';
import { LavaField } from './volcano.js';
import { Hole, swallow } from './impact.js';
import { saucerMesh, beamMesh } from './aliens.js';
import { ST, KIND } from './people.js';
import { roofTop } from './tripod.js';
import { Gauge, SIZED } from './gauge.js';
import { PLACES, PATH, placeKey } from './places.js';
import { SEE } from './see.js';
import { Hits } from './hits.js';
import { Chain } from './chain.js';
const SEE_KINDS = new Set(['saucer', 'tripod', 'zombies', 'riot', 'villains', 'kaiju', 'worm']); // see-through helps: someone in the streets to keep in sight
import { ZombiesCtl, RiotCtl, FloodCtl, VolcanoCtl, DustCtl, BlizzardCtl, SolarCtl, NukeCtl, ReactorCtl, RoamingHoleCtl, TripodCtl, VillainsCtl, WormCtl, KaijuCtl } from './be-more.js';

const RUN = 90; // arcade length: short runs, one tap to go again (was 180)
// ranks against the town's goal (30 a building), so a hamlet and the city rank alike (playtests: fixed scores made the small towns all S and Metro all C)
const RANKS = [[0, 'F'], [0.25, 'D'], [0.6, 'C'], [1, 'B'], [1.6, 'A'], [2.5, 'S']];
export const BE = {
  tornado: { name: 'Tornado', k: 0.9, hint: 'Drag to steer the tornado. It grows as it feeds' },
  sinkhole: { name: 'Sinkhole', k: 0.6, hint: 'Hold to size a sinkhole (up to ten blocks wide), let go and the ground gives way' },
  zombies: { name: 'Zombie outbreak', k: 6, zom: true, hint: 'Tap to bite someone. Hold and drag and the horde follows your finger' },
  riot: { name: 'Riot', k: 15.5, hint: 'Drag to lead the mob. It smashes and burns wherever you take it, and grows' },
  quake: { name: 'Earthquake', k: 0.6, hint: 'Drag across the city to tear a fault line through it' },
  flood: { name: 'Flood', k: 1.15, hint: 'Hold to make it pour: the water rises while you hold and drains when you let go' },
  meteor: { name: 'Meteor shower', k: 0.3, hint: 'Hold to size the rock, from a fireball to a planet killer. Let go and it comes down there' },
  lava: { name: 'Lava', k: 2.6, hint: 'Drag to pour lava. It runs down the streets and swallows what it touches' },
  haboob: { name: 'Dust storm', k: 0.9, hint: 'Drag to pull the wall of dust through the streets. It lifts cars and people' },
  coldwave: { name: 'Blizzard', k: 7, hint: 'Drag to steer a freezing blizzard. Everyone it catches freezes solid' },
  tsunami: { name: 'Tsunami', k: 0.5, hint: 'Drag to pull the wave. The water surges toward your finger' },
  saucer: { name: 'Alien saucer', k: 4.2, hint: 'Drag to fly and blast the streets. Hold still over a crowd to beam them up' },
  solar: { name: 'Solar flare', k: 1.25, hint: 'Hold to charge a flare, let go to strike. The longer you hold, the wider it hits' },
  tripod: { name: 'Alien tripod', k: 8.2, hint: 'Drag to walk it. Hold under it to beam people up. Tap to sweep the heat ray' },
  volcano: { name: 'Volcano', k: 1.9, hint: 'Hold to size the volcano and let go where it bursts out. Then hold anywhere to rain lava bombs there' },
  blackhole: { name: 'Black hole', k: 1.55, hint: 'Drag to move the black hole. It grows with everything it swallows' },
  nuclear: { name: 'Nuclear strike', k: 0.16, hint: 'Hold to set the yield, let go to launch. Three warheads, another every 30 seconds' },
  meltdown: { name: 'Meltdown', k: 4.5, zom: true, hint: 'Hold to overload the reactor until it blows, then drag to steer the fallout over the city' },
  worm: { name: 'Giant worm', k: 2, hint: 'Drag to steer it under the streets. Let go and it bursts out of the ground there' },
  kaiju: { name: 'Kaiju', k: 4.2, hint: 'Drag to walk it. Tap a car to throw it, tap people to send a tentacle, tap a building to swipe it, tap open ground to roar' },
  villains: { name: 'Super villains', k: 1.8, hint: 'Play as Blur, Tyrant or Weaver; Switch changes who. Blur runs where you drag, Tyrant grabs and throws what you tap, Weaver webs the street' },
};

// a disaster the player drives, run by the disaster manager like any other event
const wrap = (o) => ({ type: 'player', get alive() { return o.alive !== false; }, update: (h) => o.update(h), sync: (dt, t) => o.sync && o.sync(dt, t), dispose: () => o.dispose && o.dispose(), poi: (x, z) => o.poi && o.poi(x, z) });

class TornadoCtl {
  constructor(be, x, z) { this.tw = new Twister(be.D, x, z, { player: true, size: 1, speed: 10 }); be.D.list.push(wrap(this)); }
  get alive() { return this.tw.alive; }
  down(x, z) { this.tw.steer(x, z); } move(x, z) { this.tw.steer(x, z); } up() {}
  update(h) { this.tw.update(h); } sync(dt, t) { this.tw.sync(dt, t); } dispose() { this.tw.dispose(); }
  poi() { return { x: this.tw.x, z: this.tw.z, danger: this.tw.reach * 2.8, range: 340 }; }
  follow() { return [this.tw.x + this.tw.vx * 1.5, this.tw.z + this.tw.vz * 1.5]; }
  label() { return 'EF' + Math.max(1, Math.min(5, Math.floor(this.tw.size * 2 - 0.999))); }
  finish() { this.tw.player = false; this.tw.life = 0; }
}

class SinkholeCtl {
  constructor(be) { this.be = be; this.cur = null; this.n = 0; be.D.list.push(wrap(this)); }
  down(x, z) { this.be.gauge.start('sinkhole', x, z); }
  dig(x, z, Rmax) { const D = this.be.D; this.n++; this.cur = { x, z, R: 2, Rmax, hole: new Hole(D, x, z, { R: 2, depth: 90, rim: 1.3, shape: 'shaft', wall: '#6e5a46', floor: '#4a3c2a', rimCol: '#7a6650' }) }; D.shake(0.4); D.ctx.people.scare(x, z, 40, 0.6); }
  move(x, z) { this.be.gauge.move(x, z); }
  up() { const r = this.be.gauge.release(); if (r && !this.cur) this.dig(r.x, r.z, r.v); } // the hole opens where you let go and widens to the size you set
  settle() { const c = this.cur; if (!c) return; this.cur = null; this.be.D.ctx.people.block(c.x, c.z, c.R + 0.3); this.be.D.ctx.traffic.closeNear(c.x, c.z, c.R + 3); }
  update(h) {
    const c = this.cur; if (!c) return;
    const D = this.be.D, { city, fire } = D.ctx;
    c.R = Math.min(c.Rmax, c.R + h * (4 + c.R * 0.12)); c.hole.setR(c.R); D.shake(0.15); // faster the wider it gets
    if (c.R >= c.Rmax) { this.settle(); return; }
    swallow(D, c.x, c.z, c.R);
    city.buildingsNear(c.x, c.z, c.R, (k, d, b) => { const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2; if (Math.hypot(bx - c.x, bz - c.z) < c.R + 2) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(c.z - bz, c.x - bx), noRubble: true, noCrush: true }); });
    if (Math.random() < h * 4) { const a = Math.random() * 6.28; fire.dustCloud(c.x + Math.cos(a) * c.R, c.z + Math.sin(a) * c.R, 4, 8); }
  }
  label() { return this.cur ? Math.round(this.cur.R * 2) + ' m wide' : 'Hold to size it'; }
  poi() { const c = this.cur; return c ? { x: c.x, z: c.z, danger: c.R + 10, range: 160 } : null; }
}

class QuakeCtl {
  constructor(be) { this.be = be; this.held = false; this.len = 0; be.D.list.push(wrap(this)); }
  down(x, z) { this.held = true; this.last = [x, z]; this.tip = [x, z]; this.tx = x; this.tz = z; }
  move(x, z) { this.tx = x; this.tz = z; }
  up() { this.held = false; }
  update(h) {
    if (!this.held) return;
    this.be.D.shake(0.22);
    // the fault tears toward your finger at up to 35 m/s, a jagged line one 7 m break at a time
    const t = this.tip, dx = this.tx - t[0], dz = this.tz - t[1], d = Math.hypot(dx, dz), s = Math.min(d, 35 * h);
    if (d > 0.01) { t[0] += dx / d * s; t[1] += dz / d * s; }
    const L = Math.hypot(t[0] - this.last[0], t[1] - this.last[1]);
    if (L >= 7) { const j = (Math.random() - 0.5) * 3; this.split(t[0] - dz / (d || 1) * j, t[1] + dx / (d || 1) * j); }
  }
  split(x, z) {
    const D = this.be.D, { city, people, traffic, fire } = D.ctx, [lx, lz] = this.last, L = Math.hypot(x - lx, z - lz);
    this.last = [x, z]; this.len += L;
    const a = Math.atan2(z - lz, x - lx), mx = (x + lx) / 2, mz = (z + lz) / 2, nx = -Math.sin(a), nz = Math.cos(a);
    D.decals.add('crack', mx, mz, L + 2, 3.4, -a);
    D.shake(0.7);
    const near = (px, pz) => { const t = Math.max(0, Math.min(L, (px - lx) * Math.cos(a) + (pz - lz) * Math.sin(a))); return Math.hypot(px - (lx + Math.cos(a) * t), pz - (lz + Math.sin(a) * t)); };
    city.buildingsNear(mx, mz, L / 2 + 12, (k, d, b) => {
      const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, dd = Math.max(0, near(bx, bz) - Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2);
      if (dd < 9 && Math.random() < 0.3 + (b.top - b.baseY) / 70) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(nz, nx) * (Math.random() < 0.5 ? 1 : -1) });
      else if (dd < 9 && Math.random() < 0.06) fire.igniteBuilding(k); // a gas main goes up
    });
    people.around(mx, mz, L / 2 + 4, (j) => { if (near(people.x[j], people.z[j]) < 2.5) people.fallIn(j); });
    people.scare(mx, mz, 70, 0.7);
    traffic.near(mx, mz, L / 2 + 8, (car) => { if (car.mode === 0 && near(car.x, car.z) < 7) traffic.crash(car, null, 8); });
    for (const pc of traffic.parkedNear(mx, mz, L / 2 + 3)) if (near(pc.x, pc.z) < 3) traffic.takeParked(pc);
    for (const it of city.takeStreetNear(mx, mz, L / 2 + 3)) if (near(it.x, it.z) < 3) D.debris.add(it.x, it.y, it.z, it.s * 0.8, it.s * 0.5, it.s * 0.8, it.kind === 'tree' ? it.col : '#4a4540', 'fly', { v: [nx * 4, 4, nz * 4] });
  }
  label() { return Math.round(this.len) + ' m of faults'; }
  poi() { return this.held ? { x: this.last[0], z: this.last[1], danger: 20, range: 150 } : null; }
}

class MeteorCtl {
  constructor(be) { this.be = be; this.cd = 0; this.n = 0; be.D.list.push(wrap(this)); }
  down(x, z) {
    if (this.cd > 0) { this.be.g.toast('The next meteor is ' + Math.ceil(this.cd) + ' s away'); return; }
    this.be.gauge.start('meteor', x, z);
  }
  move(x, z) { this.be.gauge.move(x, z); }
  up() {
    const r = this.be.gauge.release(); if (!r) return;
    this.n++; this.cd = 3 + r.v / 10; // a planet killer takes a while to come round again
    this.be.D.start('meteor', r.x, r.z, { ...r.opts, warn: 3, quiet: true, mushroom: r.v < 40 && this.n % 2 === 1 });
  }
  update(h) { this.cd = Math.max(0, this.cd - h); }
  label() { return this.cd > 0 ? 'Next in ' + Math.ceil(this.cd) + ' s' : 'Ready'; }
}

class LavaCtl {
  constructor(be) {
    this.be = be; const D = be.D, B = D.ctx.city.bounds, n = D.ctx.low ? 120 : 150, span = Math.max(B.x1 - B.x0, B.z1 - B.z0) + 60;
    this.field = new LavaField(D, (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, { n, cell: span / n });
    this.splash = new Splash(D.ctx.scene, 1500); this.splash.mat.blending = THREE.AdditiveBlending; this.splash.mat.uniforms.uColor.value.setRGB(3, 0.9, 0.18); this.splash.points.renderOrder = 7;
    this.held = false; this.poured = 0; D.list.push(wrap(this));
  }
  down(x, z) { this.held = true; this.x = x; this.z = z; } move(x, z) { this.x = x; this.z = z; } up() { this.held = false; }
  update(h) {
    this.splash.update(h);
    if (!this.held) return;
    this.field.pour(this.x, this.z, 150 * h); this.poured += 150 * h;
    this.splash.emit(this.x, 1, this.z, 6, { up: [5, 13], spread: 6, life: 1.6, size: 2.2 });
    if (Math.random() < 0.3) this.be.D.ctx.fire.burst(this.x, 1, this.z, 6, 2.4);
  }
  sync() { this.splash.sync(1, this.be.D.ctx.fire.uniforms.uScale.value); }
  dispose() { this.be.D.ctx.scene.remove(this.splash.points); this.splash.points.geometry.dispose(); this.splash.mat.dispose(); }
  label() { return Math.round(this.poured).toLocaleString() + ' m³ poured'; }
  poi() { return this.held ? { x: this.x, z: this.z, danger: 45, range: 300 } : null; }
}

class TsunamiCtl {
  follow() { const F = this.be.g.front(this.ev); return F && !F.gone ? [F.x, F.z] : null; } // the camera rides along the wave front (it stayed put and lost it)
  constructor(be) { this.be = be; this.held = false; this.waves = 0; this.next(0.01); be.D.list.push(wrap(this)); }
  next(warn) {
    this.waves++; this.mop = false;
    // the water near your finger surges toward it; the rest of the wave rolls in slowly
    const pull = (t, F) => {
      if (this.mop) return 1.6; // most of the city is under: the stragglers catch up
      if (!this.held || !this.ev) return 0.5;
      const sw = this.ev.sw, dx = this.fx - sw.origin.x, dz = this.fz - sw.origin.y, d = Math.abs(t - (dx * sw.tan.x + dz * sw.tan.y));
      return d < 220 && dx * sw.dir.x + dz * sw.dir.y > F - 30 ? 0.5 + 2 * (1 - d / 220) : 0.5;
    };
    this.prev = this.ev;
    this.ev = this.be.D.start('tsunami', null, null, { side: 0, warn, quiet: true, speed: 16, pull, start: -20 }); // always off the ocean
  }
  down(x, z) { this.held = true; this.fx = x; this.fz = z; } move(x, z) { this.fx = x; this.fz = z; } up() { this.held = false; }
  update(h) {
    const ev = this.ev, sw = ev.sw;
    if (this.prev && this.prev.alive) this.prev.recedeT += h * 3; // the last wave drains out fast, before the next one lands
    if (ev.phase === 'wave' && !this.mop) {
      const B = this.be.D.ctx.city.bounds, half = (B.x1 - B.x0) / 2;
      let n = 0, past = 0;
      for (let k = 0; k < sw.F.length; k++) { if (Math.abs(-sw.halfW + k * sw.segW) > half) continue; n++; if (sw.F[k] > sw.extent - 60) past++; }
      this.mop = past > n * 0.6;
    }
    if (ev.phase === 'recede') this.next(16);
  }
  label() { return 'Wave ' + this.waves + (this.ev.phase === 'warn' && this.waves > 1 ? ' coming' : ''); }
}

class SaucerCtl {
  constructor(be, x, z) {
    this.be = be; const D = be.D;
    this.obj = saucerMesh(); this.obj.scale.setScalar(1.3); this.beam = beamMesh(); D.ctx.scene.add(this.obj, this.beam);
    this.x = x; this.z = z; this.y = 30; this.tx = x; this.tz = z; this.vx = 0; this.vz = 0; this.held = false;
    this.lift = []; this.car = null; this.n = 0; this.zapT = 1; this.lasers = []; this.abducted = 0;
    this.laserGeo = new THREE.CylinderGeometry(0.18, 0.18, 1, 5, 1, true).translate(0, 0.5, 0); this.laserMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 6, 2.2), fog: false });
    D.list.push(wrap(this));
  }
  down(x, z) { this.held = true; this.tx = x; this.tz = z; } move(x, z) { this.tx = x; this.tz = z; } up() { this.held = false; }
  update(h) {
    const D = this.be.D, { people, traffic } = D.ctx;
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz) || 0.001, v = Math.min(30, d * 1.5);
    this.vx = dx / d * v; this.vz = dz / d * v; this.x += this.vx * h; this.z += this.vz * h;
    const beaming = this.held && d < 16; this.off = beaming ? 0 : (this.off || 0) + h; const drop = this.off > 0.8; // a drifting finger doesn't drop them at once
    this.y += (Math.max(beaming ? 22 : 32, roofTop(D.ctx.city, this.x, this.z, 8.5).top + 7) - this.y) * Math.min(1, h * 1.6); // over the roofs, never through them
    this.beam.visible = beaming;
    if (beaming && (this.n -= h) <= 0) {
      this.n = 0.3; let got = 0;
      people.around(this.x, this.z, 10, (j) => { if (got < 3 && this.lift.length < 20 && people.lvl[j] === -1 && people.grab(j)) { this.lift.push(j); got++; } });
      if (!this.car && Math.random() < 0.2) traffic.near(this.x, this.z, 8, (car) => { if (!this.car && !car.mission && !car.gone && (car.mode === 0 || car.mode === 2) && Math.hypot(car.x - this.x, car.z - this.z) < 8 && traffic.grab(car)) this.car = car; });
    }
    for (let k = this.lift.length - 1; k >= 0; k--) {
      const j = this.lift[k];
      if (people.st[j] !== ST.EXT) { this.lift.splice(k, 1); continue; }
      if (drop) { people.fling(j, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3); this.lift.splice(k, 1); continue; } // dropped
      if (!beaming) continue; // held a moment
      people.x[j] += (this.x - people.x[j]) * Math.min(1, h * 1.5); people.z[j] += (this.z - people.z[j]) * Math.min(1, h * 1.5); people.y[j] += 3.4 * h;
      if (people.y[j] > this.y - 1.5) { people.st[j] = ST.EVAC; people.lvl[j] = -1; people.stats.abducted++; this.abducted++; this.lift.splice(k, 1); }
    }
    if (this.car) {
      const c = this.car;
      if (drop) { traffic.fling(c, 0, 0, 0); this.car = null; }
      else if (!beaming) { /* held a moment */ }
      else { c.x += (this.x - c.x) * Math.min(1, h * 1.2); c.z += (this.z - c.z) * Math.min(1, h * 1.2); c.y = (c.y || 0) + 2.6 * h; c.yaw += h; if (c.y > this.y - 2) { traffic.remove(c); this.car = null; } }
    }
    if (!beaming && (this.zapT -= h) <= 0) { this.zapT = 0.35; this.zap(); } // it fires on anything below while it flies
    for (let i = this.lasers.length - 1; i >= 0; i--) { const l = this.lasers[i]; if ((l.t -= h) <= 0) { D.ctx.scene.remove(l.m); this.lasers.splice(i, 1); } }
  }
  zap() {
    const D = this.be.D, { city, traffic, fire, people } = D.ctx, r = Math.random(), x = this.x, z = this.z;
    let tx, ty, tz;
    if (r < 0.5) {
      const ks = []; city.buildingsNear(x, z, 36, (k) => ks.push(k)); if (!ks.length) return;
      const k = ks[Math.floor(Math.random() * ks.length)], b = city.buildings[k];
      tx = Math.max(b.x0, Math.min(b.x1, x)); tz = Math.max(b.z0, Math.min(b.z1, z)); ty = b.baseY + Math.random() * (b.top - b.baseY);
      if (b.top - b.baseY < 30 && Math.random() < 0.3) D.destroyBuilding(k, 'collapse'); else if (Math.random() < 0.6) fire.igniteBuilding(k);
    } else if (r < 0.8) {
      let c = null; traffic.near(x, z, 36, (car) => { if (!c && !car.gone && (car.mode === 0 || car.mode === 2) && !car.burning) c = car; }); if (!c) return;
      tx = c.x; ty = 1; tz = c.z; traffic.burn(c);
    } else {
      let j0 = -1; people.around(x + (Math.random() - 0.5) * 20, z + (Math.random() - 0.5) * 20, 14, (j) => { if (j0 < 0 && people.hittable(j)) j0 = j; }); if (j0 < 0) return;
      tx = people.x[j0]; ty = 0.3; tz = people.z[j0];
      people.around(tx, tz, 2.5, (j) => { if (people.hittable(j) && people.kind[j] !== KIND.ALIEN) { people.wz[j] = people.st[j] === ST.ZOMBIE ? 1 : 0; people.kill(j, 0, 0, 'zap'); } });
    }
    fire.burst(tx, ty, tz, 8, 1.6);
    const m = new THREE.Mesh(this.laserGeo, this.laserMat), from = new THREE.Vector3(x, this.y - 1, z), dv = new THREE.Vector3(tx, ty, tz).sub(from);
    m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.clone().normalize()); m.scale.set(1, dv.length(), 1);
    D.ctx.scene.add(m); this.lasers.push({ m, t: 0.18 });
  }
  sync(dt, realT) {
    this.obj.position.set(this.x, this.y + Math.sin(realT * 2) * 0.3, this.z); this.obj.userData.spin.rotation.y += dt * 1.6;
    this.obj.rotation.x = -this.vz * 0.01; this.obj.rotation.z = this.vx * 0.01;
    if (this.beam.visible) { this.beam.position.set(this.x, this.y - 0.8, this.z); this.beam.scale.set(1, Math.max(1, this.y - 0.8), 1); this.beam.material.uniforms.uTime.value = realT; this.beam.material.uniforms.uOn.value = 1; }
  }
  dispose() {
    const D = this.be.D; D.ctx.scene.remove(this.obj, this.beam); this.beam.material.dispose();
    for (const l of this.lasers) D.ctx.scene.remove(l.m); this.laserGeo.dispose(); this.laserMat.dispose();
  }
  follow() { return [this.x + this.vx * 0.8, this.z + this.vz * 0.8]; }
  label() { return this.abducted + ' abducted'; }
  poi() { return { x: this.x, z: this.z, danger: 22, range: 300 }; }
}

export class BeTheDisaster {
  constructor(g, kind = 'tornado') {
    g.profile.mode = 'be'; // its level keeps step with its road of towns
    SEE.on = SEE_KINDS.has(kind); SEE.far = 600; // see-through for the ones that are someone in the streets; not for the ones that flatten a whole area (playtests: it speckled the very buildings a tornado was wrecking)
    this.g = g; this.D = g.disasters; this.kind = BE[kind] ? kind : 'tornado'; this.msgs = {};
    this.el = {
      score: g.addPill('zd-rp', 'Score'), what: g.addPill('zd-al', '', 'zd-ef'),
      b: g.addPill('zd-d', 'Buildings'), p: g.addPill('zd-h', 'Victims'), c: g.addPill('', 'Cars'), clock: g.addPill('', '', 'zd-clock'),
    };
    this.hits = new Hits(g, this.el.score); // points popping up where things fall, combos, the big moments
    this.chain = new Chain(this.D, (text, slow) => this.hits.moment(text, slow)); // the town finishes what the disaster starts
    g.addButton('zd-restart', 'Restart', () => this.start());
    g.addButton('zd-pick', 'Disasters', () => { location.href = location.pathname + '?mode=be'; });
    g.addButton('zd-menu-btn', 'Menu', () => { location.href = location.pathname; });
    this.end = document.getElementById('zd-end') || document.createElement('div'); this.end.id = 'zd-end'; this.end.hidden = true;
    if (!this.end.parentNode) document.body.appendChild(this.end);
    // one finger drives the disaster; two fingers (or the right mouse button) pan, pinch or wheel to zoom
    this.gauge = new Gauge(g.disasters.ctx.scene); // hold-to-size
    g.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
    g.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.bindDrag();
    this.start();
  }

  bindDrag() {
    const g = this.g, dom = g.renderer.domElement, held = new Set();
    let driving = false;
    const at = (e) => g.worldPoint(e.clientX, e.clientY);
    dom.addEventListener('pointerdown', (e) => {
      if (this.dead) return;
      held.add(e.pointerId);
      if (held.size > 1) { if (driving && this.ctl) this.ctl.up(); driving = false; return; } // a second finger: pan or zoom instead
      if (e.button !== 0 || this.ended || !this.ctl) return;
      const p = at(e); if (!p) return;
      driving = true; this.ctl.down(p.x, p.z);
    });
    dom.addEventListener('pointermove', (e) => { if (this.dead || !driving || held.size !== 1 || !this.ctl) return; const p = at(e); if (p) this.ctl.move(p.x, p.z); });
    const up = (e) => { held.delete(e.pointerId); if (!this.dead && driving && !held.size) { driving = false; if (this.ctl) this.ctl.up(); } };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  }

  start() {
    const g = this.g, D = g.disasters, B = g.city.bounds, p = g.people, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    this.end.hidden = true; this.ended = false; g.profile.played('be', placeKey()); // where you left off
    if (g.radio && this.started) g.radio.cue(this.kind); // on the air (the first time, radio.begin does it)
    this.started = true;
    if (this.gauge) this.gauge.cancel();
    g.resetWorld(); g.setSpeed(1); D.boats.auto = false; // nobody comes to the rescue
    this.t = 0; this.score = 0; this.tick = 0; this.shown = 0; this.said10 = false;
    this.hits.reset(); this.wrecked = new WeakSet(); this.chain.reset();
    { const hs = g.city.buildings.map(b => b.top - b.baseY).sort((a, b) => a - b); this.bigH = Math.max(30, hs[Math.floor(hs.length * 0.96)] || 30); } // the tallest few in this town are the big ones
    D.weather.set(this.kind === 'tornado' ? 'storm' : 'clear', true);
    // a few outbreaks already under way, for some extra chaos
    for (let k = 0; k < 3; k++) { const w = p.snapWalkable(B.x0 + 80 + Math.random() * (B.x1 - B.x0 - 160), B.z0 + 80 + Math.random() * (B.z1 - B.z0 - 160), 20); if (w) p.infectAt(w[0], w[1], 5); }
    const k = this.kind;
    if (k === 'tornado') { this.ctl = new TornadoCtl(this, B.x0 + 90, cz); g.lookAt(B.x0 + 150, cz, 400); }
    else if (k === 'saucer') { this.ctl = new SaucerCtl(this, cx, cz); g.lookAt(cx, cz, 380); }
    else if (k === 'sinkhole') { this.ctl = new SinkholeCtl(this); g.lookAt(cx, cz, 420); }
    else if (k === 'quake') { this.ctl = new QuakeCtl(this); g.lookAt(cx, cz, 450); }
    else if (k === 'blackhole') { this.ctl = new RoamingHoleCtl(this, cx, cz); g.lookAt(cx, cz, 520); }
    else if (k === 'zombies') { this.ctl = new ZombiesCtl(this); g.lookAt(cx, cz, 420); }
    else if (k === 'riot') { this.ctl = new RiotCtl(this, cx, cz); g.lookAt(cx, cz, 360); }
    else if (k === 'flood') { this.ctl = new FloodCtl(this); g.lookAt(cx, cz, 480); }
    else if (k === 'haboob') { this.ctl = new DustCtl(this); g.lookAt(B.x1 - 160, cz, 540); }
    else if (k === 'coldwave') { this.ctl = new BlizzardCtl(this, cx, cz); g.lookAt(cx, cz, 420); }
    else if (k === 'solar') { this.ctl = new SolarCtl(this); g.lookAt(cx, cz, 480); }
    else if (k === 'tripod') { this.ctl = new TripodCtl(this, cx, cz); g.lookAt(cx, cz, 380); }
    else if (k === 'volcano') { this.ctl = new VolcanoCtl(this); g.lookAt(cx, cz, 500); }
    else if (k === 'nuclear') { this.ctl = new NukeCtl(this); g.lookAt(cx, cz, 600); }
    else if (k === 'meltdown') { this.ctl = new ReactorCtl(this); }
    else if (k === 'meteor') { this.ctl = new MeteorCtl(this); g.lookAt(cx, cz, 520); }
    else if (k === 'lava') { this.ctl = new LavaCtl(this); g.lookAt(cx, cz, 420); }
    else if (k === 'tsunami') { this.ctl = new TsunamiCtl(this); g.lookAt(cx, B.z1 - 120, 520); }
    else if (k === 'worm') { this.ctl = new WormCtl(this, cx, cz); g.lookAt(cx, cz, 440); }
    else if (k === 'kaiju') { this.ctl = new KaijuCtl(this, cx, cz); g.lookAt(cx, cz, 480); }
    else if (k === 'villains') { this.ctl = new VillainsCtl(this, cx, cz); g.lookAt(cx, cz, 380); }
    this.base = this.measure();
    g.toast('Be The Disaster: ' + BE[k].name + '. ' + BE[k].hint, 6000);
    this.hits.say('Go!');
  }

  // what the world reports: buildings down, fires, wrecked cars score where they happen (never people)
  onEvent(e) {
    const H = this.hits; if (!H || this.ended || !this.ctl) return;
    const k = BE[this.kind].k, c = this.g.city;
    if (e.type === 'collapse') { const b = c.buildings[e.k]; if (b) H.hit('b', e.x, b.top, e.z, k, { big: b.top - b.baseY >= this.bigH }); this.chain.collapse(e.k, e.fall); }
    else if (e.type === 'fire') { const b = c.buildings[e.k]; if (b && !c.dead[e.k]) H.hit('fire', (b.x0 + b.x1) / 2, b.top, (b.z0 + b.z1) / 2, k); this.chain.fire(e.k); }
    else if (e.type === 'carland' || e.type === 'carfire' || e.type === 'crash') for (const cr of [e.car, e.other]) if (cr && !cr.mission && !this.wrecked.has(cr)) { this.wrecked.add(cr); H.hit('car', cr.x, 2, cr.z, k); } // each car once
  }

  // what has been wrecked so far
  measure() {
    const { people, traffic, fire } = this.g, D = this.g.disasters;
    let cars = 0; for (const c of traffic.cars) if (!c.mission && (c.gone || c.mode !== 0 || c.frozen)) cars++; // frozen solid counts too
    for (const pc of traffic.parkedList) if (!pc.alive || pc.burnt) cars++;
    let fires = 0; const dead = this.g.city.dead; for (let k = 0; k < fire.bFire.length; k++) if (fire.bFire[k] && !dead[k]) fires++;
    return { b: D.stats.buildings, dead: people.stats.dead, abd: people.stats.abducted, cars, fires, zom: people.stats.zombies };
  }

  tap() {}
  busy() { return true; } // a finger here drives the disaster
  phase() { return 0.1 + (this.t / RUN) * 0.25; }

  update(sdt, dt) {
    if (this.hits) this.hits.frame(dt, this.ended ? 0 : sdt);
    if (this.ended) return;
    const g = this.g;
    this.gauge.update(dt);
    if (this.gauge.active) { const R = SIZED[this.gauge.kind].ring(this.gauge.v), d = g.camera.position.distanceTo(g.controls.target), want = Math.min(g.controls.maxDistance || 1100, R * 3); if (want > d + 5) g.zoomTo = want; }
    this.t += sdt;
    const f = this.ctl && this.ctl.follow && this.ctl.follow();
    if (f) { // the camera rides along with a moving disaster
      const tg = g.controls.target, k = 1 - Math.exp(-dt * 2.2), dx = (f[0] - tg.x) * k, dz = (f[1] - tg.z) * k;
      tg.x += dx; tg.z += dz; g.camera.position.x += dx; g.camera.position.z += dz;
    }
    const hd = this.ctl && this.ctl.heading && this.ctl.heading(); // a side to watch from (the dust storm: ahead of the wall, facing it): the camera swings round to it
    if (hd != null) {
      const tg = g.controls.target, c = g.camera.position, ox = c.x - tg.x, oz = c.z - tg.z, Hd = Math.hypot(ox, oz) || 1;
      let a = Math.atan2(oz, ox); const d = ((hd - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; a += Math.max(-dt * 0.9, Math.min(dt * 0.9, d));
      c.x = tg.x + Math.cos(a) * Hd; c.z = tg.z + Math.sin(a) * Hd;
    }
    if ((this.tick -= sdt) <= 0) {
      this.tick = 0.5;
      const m = this.measure(), b = this.base;
      this.got = { b: m.b - b.b, dead: m.dead - b.dead, abd: m.abd - b.abd, cars: m.cars - b.cars, fires: m.fires - b.fires, zom: BE[this.kind].zom ? Math.max(0, m.zom - b.zom) : 0 };
      const G = this.got; this.score = Math.round(BE[this.kind].k * (150 * G.b + 12 * G.dead + 30 * G.abd + 40 * G.cars + 60 * G.fires + 12 * G.zom) + this.hits.bonus); // the zombie modes count their horde too; the combos on top
    }
    this.chain.step(sdt);
    if (!this.said10 && RUN - this.t <= 10) { this.said10 = true; this.hits.say('10 seconds!', 'small'); }
    if (this.t >= RUN) this.finish();
    this.hud(dt);
  }

  hud(dt = 1) {
    const e = this.el, G = this.got || { b: 0, dead: 0, abd: 0, cars: 0 }, left = Math.max(0, RUN - this.t);
    const was = Math.round(this.shown); this.shown += (this.score - this.shown) * Math.min(1, dt * 7); if (this.score - this.shown < 1) this.shown = this.score; // the score rolls up
    const now = Math.round(this.shown); e.score.textContent = now.toLocaleString();
    if (now > was + 50) { const p = e.score.parentNode; p.classList.add('bump'); clearTimeout(this.bumpT); this.bumpT = setTimeout(() => p.classList.remove('bump'), 130); }
    e.clock.parentNode.classList.toggle('hurry', left <= 10);
    e.what.textContent = BE[this.kind].name + (this.ctl && this.ctl.label ? ' · ' + this.ctl.label() : '');
    e.b.textContent = G.b; e.p.textContent = G.dead + G.abd; e.c.textContent = G.cars;
    e.clock.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
  }

  finish() {
    this.ended = true;
    const g = this.g, G = this.got || { b: 0, dead: 0, abd: 0, cars: 0, fires: 0 };
    this.gauge.cancel();
    if (this.ctl && this.ctl.up) this.ctl.up();
    if (this.ctl && this.ctl.finish) this.ctl.finish();
    const goal = 30 * g.city.buildings.length, bar = goal * Math.pow(2167 / g.city.buildings.length, 0.6); // the win line is the goal; ranks are against a bar that is higher in small towns (one finger reaches a hamlet's every street, not a city's)
    let rank = 'F'; for (const [s, rk] of RANKS) if (this.score >= s * bar) rank = rk;
    const r = g.profile.addBe(this.kind, this.score), best = (g.profile.data.beBest || {})[this.kind] || 0;
    const H = this.hits; H.say('Time!');
    const lines = [['Buildings destroyed', G.b], ['Victims', (G.dead + G.abd).toLocaleString()], ['Cars wrecked', G.cars], ['Fires started', G.fires]];
    if (H.best > 1) lines.unshift(['Best combo', '\u00D7' + H.best + ' (' + H.bestN + ' hits)'], ['Combo bonus', '+' + Math.round(H.bonus).toLocaleString()]);
    // the road: wreck enough of this town (a score of 30 a building) and the next one opens
    const here = placeKey(), at = PATH.indexOf(here), opened = this.score >= goal ? g.profile.clear('be', here) : null;
    if (g.profile.level > r.level) { r.level = g.profile.level; r.levelUp = r.level > r.before; } // a new town: a level with it
    const done = at === PATH.length - 1 && this.score >= goal; // the last town wrecked: the road is done
    const nextKey = PATH[at + 1], nextOpen = at >= 0 && nextKey && at + 1 <= g.profile.reach('be');
    const road = at < 0 ? '' : done ? '<div class="lvl">That was the last town. The whole road is in ruins: you are the disaster</div>' : opened ? '<div class="lvl">New town open: ' + PLACES[opened].name + '</div>' : nextKey && !nextOpen ? '<div class="xp">Score ' + goal.toLocaleString() + ' here to open ' + PLACES[nextKey].name + '</div>' : '';
    if (G.abd) lines.splice(2, 0, ['Beamed up', G.abd.toLocaleString()]);
    if (G.zom) lines.splice(2, 0, ['Zombies made', G.zom.toLocaleString()]);
    g.endScreen(this.end, '<h2>' + BE[this.kind].name + '</h2><div>Rank ' + rank + (r.best ? ' · new best!' : ' · best ' + best.toLocaleString()) + '</div>' +
      '<div class="stars" style="letter-spacing:0">' + rank + '</div>' +
      '<div class="score">Score ' + this.score.toLocaleString() + '</div>' +
      '<div class="xp">+' + r.xp.toLocaleString() + ' XP' + (r.levelUp ? ' · level up! Level ' + r.level : '') + '</div>' + road, lines,
      (nextOpen ? '<button class="zd-btn go" type="button" id="zd-next">On to ' + PLACES[nextKey].name + '</button>' : '') + '<button class="zd-btn' + (nextOpen ? '' : ' go') + '" type="button" id="zd-again">Again</button><button class="zd-btn" type="button" id="zd-other">Other disaster</button>');
    this.end.querySelector('#zd-again').onclick = () => this.start();
    this.end.querySelector('#zd-other').onclick = () => { location.href = location.pathname + '?mode=be'; };
    if (nextOpen) this.end.querySelector('#zd-next').onclick = () => g.journey(nextKey);
    setTimeout(() => { if (this.ended) this.end.hidden = false; }, 1700);
  }
}
