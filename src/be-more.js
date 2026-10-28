// More ways to be the disaster (see be.js): each one plays differently.
// Patient zero bites and herds a horde; the mob follows its ringleader; the
// rain maker raises the water; the volcano is placed and then aimed; the dust
// storm is pulled through the streets; a blizzard cell freezes what it
// crosses; solar flares are charged and released; warheads are few and
// their yield is held; the reactor is pushed until it blows, then its fallout
// is steered; the black hole roams and grows; the tripod walks, burns and feeds.
import * as THREE from 'three';
import { Splash } from './water.js';
import { Tripod } from './tripod.js';
import { ST, KIND } from './people.js';

const wrap = (o) => ({ type: 'player', get alive() { return o.alive !== false; }, update: (h) => o.update(h), sync: (dt, t) => o.sync && o.sync(dt, t), dispose: () => o.dispose && o.dispose(), poi: (x, z) => o.poi && o.poi(x, z) });
const now = () => performance.now();
// a glowing ring on the ground (charging a flare or a warhead)
function ringMesh(scene, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  m.renderOrder = 9; m.visible = false; scene.add(m); return m;
}

// Patient zero: tap to bite (bites come back over time), hold and drag and the horde follows your finger
export class ZombiesCtl {
  constructor(be) { this.be = be; this.bites = 5; this.regen = 0; this.lureT = 0; be.D.list.push(wrap(this)); } // a 90 s run: five bites to start, one back every 3 s, up to 8
  down(x, z) { this.held = true; this.fx = x; this.fz = z; this.t0 = now(); }
  move(x, z) { this.fx = x; this.fz = z; }
  up() {
    this.held = false;
    if (now() - this.t0 < 260) { // a tap: a bite
      if (this.bites <= 0) { this.be.g.toast('No bites left yet: they come back every few seconds'); return; }
      if (this.be.D.ctx.people.infectAt(this.fx, this.fz, 6, [1, 3])) this.bites--;
    }
  }
  update(h) {
    if (this.bites < 8 && (this.regen += h) > 3) { this.regen = 0; this.bites++; }
    if (this.held && (this.lureT -= h) <= 0) { this.lureT = 0.4; this.be.D.ctx.people.lure(this.fx, this.fz, 110); }
  }
  label() { return this.bites + ' bites · ' + this.be.D.ctx.people.stats.zombies + ' zombies'; }
}

// The ringleader: the mob marches wherever you lead it, smashing and burning, picking up recruits
export class RiotCtl {
  constructor(be, x, z) { this.be = be; this.start(x, z); be.D.list.push(wrap(this)); }
  start(x, z) { this.ev = this.be.D.start('riot', x, z, { n: 90, life: 99999, quiet: true }); }
  down(x, z) { this.ev.lead = [x, z]; } move(x, z) { this.ev.lead = [x, z]; } up() { this.ev.lead = null; }
  update(h) {
    if (!this.ev.alive) { const m = this.ev.mob; this.start(m.x, m.z); return; } // broken up: a new mob forms
    if ((this.smashT = (this.smashT || 0) - h) > 0) return;
    this.smashT = 1; // the mob tears into whatever it passes: cars overturned, shops set alight, people beaten
    const { people, traffic, city, fire } = this.be.D.ctx, m = this.ev.mob, k = Math.min(1, this.ev.count / 40);
    traffic.near(m.x, m.z, 12, (car) => { if (car.mode === 0 && !car.mission && Math.random() < 0.35 * k) { traffic.crash(car, null, 6); if (Math.random() < 0.4) traffic.burn(car); } });
    city.buildingsNear(m.x, m.z, 10, (kb) => { if (!fire.bFire[kb] && Math.random() < 0.12 * k) fire.igniteBuilding(kb); });
    people.around(m.x, m.z, 9, (j) => { if (people.st[j] !== ST.RIOT && people.hittable(j) && people.kind[j] === KIND.CIVILIAN && Math.random() < 0.06 * k) people.kill(j, 0, 0, 'crush'); });
  }
  follow() { return [this.ev.mob.x, this.ev.mob.z]; }
  label() { return this.ev.count + ' rioters'; }
}

// The rain maker: hold to make it pour and the water rises; let go and it drains away again
export class FloodCtl {
  constructor(be) { const D = be.D; this.be = be; this.level = -0.3; D.water.colors('flood'); D.water.front = null; D.weather.set('rain'); D.list.push(wrap(this)); }
  down() { this.held = true; this.be.D.weather.set('storm'); } move() {} up() { this.held = false; this.be.D.weather.set('rain'); }
  update(h) {
    this.level = this.held ? Math.min(6, this.level + h * 0.16) : Math.max(-0.4, this.level - h * 0.04); this.be.D.water.level = this.level;
    if (this.level < 2.5) return;
    const D = this.be.D, city = D.ctx.city; this.sink = (this.sink || 0) + h * (this.level - 1.5) * 0.15; // deep water starts taking buildings (there was nothing left to wreck after a minute)
    while (this.sink > 0.5) {
      this.sink -= 0.5; let best = -1, bh = 1e9;
      for (let n = 0; n < 12; n++) { const k = Math.floor(Math.random() * city.buildings.length); if (city.dead[k]) continue; const b = city.buildings[k], hg = b.top - b.baseY; if (hg < bh) { bh = hg; best = k; } } // the lowest of a dozen
      if (best >= 0 && bh <= this.level * 3 + 4) D.destroyBuilding(best, 'collapse', {});
    }
  }
  label() { return 'Water ' + Math.max(0, this.level).toFixed(1) + ' m' + (this.held ? ' · rising' : ''); }
  dispose() { this.be.D.water.level = -1; }
}

// The volcano: tap where it bursts out of the ground, then hold anywhere to rain lava bombs on that spot
export class VolcanoCtl {
  constructor(be) { this.be = be; be.D.list.push(wrap(this)); }
  down(x, z) {
    if (!this.v) { this.be.gauge.start('volcano', x, z); return; } // first: size it
    this.v.aim = [x, z];
  }
  move(x, z) { if (!this.v) this.be.gauge.move(x, z); else if (this.v.aim) this.v.aim = [x, z]; }
  up() {
    if (!this.v) { const r = this.be.gauge.release(); if (r) { this.v = this.be.D.start('volcano', r.x, r.z, { ...r.opts, warn: 3, erupt: 99999, quiet: true }); this.be.g.lookAt(r.x, r.z, 520); } return; }
    this.v.aim = null;
  }
  update() {}
  label() { return !this.v ? 'Hold to size it' : this.v.phase === 'rumble' ? 'Rumbling' : this.v.aim ? 'Bombarding' : 'Erupting'; }
}

// The dust storm: the wall surges towards your finger; a new one rolls in out of the desert when it has passed
export class DustCtl {
  follow() { const F = this.be.g.front(this.ev); return F && !F.gone ? [F.x + F.dx * 40, F.z + F.dz * 40] : null; } // the camera rides just ahead of the wall of dust
  heading() { const F = this.be.g.front(this.ev); return F && !F.gone ? Math.atan2(F.dz, F.dx) : null; } // and stands ahead of it, facing it, to watch it come (from behind it there is nothing but haze)
  constructor(be) { this.be = be; this.n = 0; this.next(); be.D.list.push(wrap(this)); }
  next() {
    this.n++; let me = null;
    const pull = (t, F) => {
      if (!this.held || this.ev !== me) return 0.55; // only the newest wall follows the finger
      const sw = me.sw, dx = this.fx - sw.origin.x, dz = this.fz - sw.origin.y, d = Math.abs(t - (dx * sw.tan.x + dz * sw.tan.y));
      return d < 200 && dx * sw.dir.x + dz * sw.dir.y > F - 30 ? 0.55 + 2 * (1 - d / 200) : 0.55;
    };
    me = this.ev = this.be.D.start('haboob', null, null, { side: this.n % 2 ? 2 : 3, pull, quiet: true, light: true }); // a light sandy haze, not the dark fog: the dust storm was nothing but brown
    if (this.n === 1) this.be.D.weather.set('sand');
  }
  down(x, z) { this.held = true; this.fx = x; this.fz = z; } move(x, z) { this.fx = x; this.fz = z; } up() { this.held = false; }
  update() { const ev = this.ev; if (!ev.alive || (ev.phase === 'sweep' && ev.sw && ev.sw.lead() > ev.sw.extent * 0.6)) this.next(); } // the next wall once this one is most of the way across (it waited 50 s after each had gone)
  label() { return 'Storm ' + this.n; }
}

// The blizzard: a freezing storm cell that follows your finger, icing everyone and everything it crosses
export class BlizzardCtl {
  constructor(be, x, z) {
    const D = be.D; this.be = be; this.x = x; this.z = z; this.tx = x; this.tz = z; this.R = 26; this.t = 0; this.tick = 0; this.frozen = 0;
    this.snow = new Splash(D.ctx.scene, 3600); this.fogT = 0; this.snow.mat.uniforms.uColor.value.setRGB(0.95, 0.97, 1.0); // and a dense white whirl of cloud at its core
    D.weather.set('snow'); D.list.push(wrap(this));
  }
  down(x, z) { this.tx = x; this.tz = z; } move(x, z) { this.tx = x; this.tz = z; } up() {}
  update(h) {
    const D = this.be.D, { people, traffic, city, fire } = D.ctx;
    this.t += h; this.R = Math.min(48, 26 + this.t * 0.15); this.snow.update(h);
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    if (d > 1) { this.x += dx / d * Math.min(d, 8 * h); this.z += dz / d * Math.min(d, 8 * h); }
    if ((this.fogT -= h) <= 0) { this.fogT = 0.35; const a = Math.random() * 6.28, r = Math.random() * this.R * 0.8, t = fire.uniforms.uTime.value, m = fire.mist.alloc(6, this.x + Math.cos(a) * r, 4 + Math.random() * 10, this.z + Math.sin(a) * r, this.R * 0.35, this.R * 0.35, 6 + this.R * 0.12, t); fire.later(1.5, () => fire.mist.end(m, fire.uniforms.uTime.value)); fire.later(7, () => fire.mist.release(m)); }
    for (let n = 0; n < 34; n++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * this.R; this.snow.emit(this.x + Math.cos(a) * r, 2 + Math.random() * 30, this.z + Math.sin(a) * r, 1, { up: [-3, 1], dir: [-Math.sin(a) * 9, Math.cos(a) * 9], spread: 3, life: 2.4, size: 1.6 }); } // swirling snow
    if ((this.tick -= h) > 0) return;
    this.tick = 0.25;
    people.around(this.x, this.z, this.R, (j) => { const s = people.st[j]; if ((people.hittable(j) || s === ST.ROOF) && s !== ST.FROZEN && people.kind[j] !== KIND.ALIEN && Math.random() < 0.3 * (1 - Math.hypot(people.x[j] - this.x, people.z[j] - this.z) / this.R) + 0.05 && people.freeze(j)) this.frozen++; });
    traffic.near(this.x, this.z, this.R, (car) => { if (car.mode === 0 && !car.mission && Math.random() < 0.25) { if (Math.random() < 0.15) traffic.crash(car, null, 7); else traffic.freezeCar(car); } }); // skidding on the ice, or frozen where they stand
    for (const pc of traffic.parkedNear(this.x, this.z, this.R)) traffic.frostParked(pc);
    fire.quench((x, z) => Math.hypot(x - this.x, z - this.z) < this.R ? 2 : 0); // fires go out under the snow
    city.buildingsNear(this.x, this.z, this.R, (k) => fire.soak(k, 20));
    if (Math.random() < 0.5) D.decals.add('scour', this.x + (Math.random() - 0.5) * this.R, this.z + (Math.random() - 0.5) * this.R, 6, 6);
  }
  sync() { this.snow.sync(this.be.D.lightK, this.be.D.ctx.fire.uniforms.uScale.value); }
  dispose() { this.be.D.ctx.scene.remove(this.snow.points); this.snow.points.geometry.dispose(); this.snow.mat.dispose(); }
  follow() { return [this.x, this.z]; }
  poi() { return { x: this.x, z: this.z, danger: this.R + 5, range: 260 }; }
  label() { return this.frozen + ' frozen'; }
}

// Solar flares: hold to charge (the ring grows), let go and a column of the sun's fire strikes there
export class SolarCtl {
  constructor(be) {
    const D = be.D; this.be = be; this.cd = 0; this.charge = 0; this.flashK = 0; this.n = 0;
    this.ring = ringMesh(D.ctx.scene, new THREE.Color(1.4, 1.2, 2.4));
    this.col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 400, 24, 1, true).translate(0, 200, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.col.visible = false; this.col.renderOrder = 8; D.ctx.scene.add(this.col);
    this.sparks = new Splash(D.ctx.scene, 1500); this.sparks.mat.blending = THREE.AdditiveBlending; this.sparks.mat.uniforms.uColor.value.setRGB(2.2, 2.6, 3.4);
    D.list.push(wrap(this));
  }
  get R() { return 12 + 58 * this.charge; }
  down(x, z) { if (this.cd > 0) { this.be.g.toast('The sun is gathering itself: ' + Math.ceil(this.cd) + ' s'); return; } this.held = true; this.charge = 0; this.at = [x, z]; }
  move(x, z) { if (this.held) this.at = [x, z]; }
  up() { if (this.held) { this.held = false; this.strike(); } }
  strike() {
    const D = this.be.D, { people, traffic, city, fire } = D.ctx, [x, z] = this.at, R = this.R;
    this.cd = 2.5; this.n++; this.flashK = 1; this.sx = x; this.sz = z; this.sR = R;
    D.flash(0.35); D.shake(0.4);
    D.ctx.post.opts.blacklight = { amount: 1, origin: [x - R, z], dir: [1, 0], front: R * 2, width: R * 2 }; // a black-light poster where it lands
    people.around(x, z, R, (j) => { if (!people.hittable(j) || people.kind[j] === KIND.ALIEN) return; if (Math.random() < 0.45) { people.wz[j] = people.st[j] === ST.ZOMBIE ? 1 : 0; people.kill(j, 0, 0, 'zap'); } else people.panic(j, x, z, -1); });
    traffic.near(x, z, R, (car) => { if (car.mode === 0 && !car.mission) { if (Math.random() < 0.5) traffic.crash(car, null, 6); else car.cruise = 0; } }); // every engine dies
    city.buildingsNear(x, z, R, (k) => { city.char(k, 0.85); if (Math.random() < 0.3) fire.igniteBuilding(k); });
    { const O = D.ctx.outskirts, P = O && O.plant && O.plant.reactor; if (P && Math.hypot(P.x - x, P.z - z) < R + 60) D.plantSurge(); } // a flare on the power plant: its cooling fails
    for (const l of city.lamps) if (Math.hypot(l.x - x, l.z - z) < R && Math.random() < 0.6) this.sparks.emit(l.x, 6.5, l.z, 14, { up: [2, 7], spread: 6, life: 0.9, size: 0.6 });
  }
  update(h) {
    this.cd = Math.max(0, this.cd - h);
    if (this.held) this.charge = Math.min(1, this.charge + h / 3);
    if (this.flashK > 0) { this.flashK = Math.max(0, this.flashK - h * 1.2); const bl = this.be.D.ctx.post.opts.blacklight; if (bl) bl.amount = this.flashK; if (this.flashK <= 0) this.be.D.ctx.post.opts.blacklight = null; }
    this.sparks.update(h);
  }
  sync(dt, realT) {
    this.ring.visible = !!this.held; if (this.held) { this.ring.position.set(this.at[0], 0.4, this.at[1]); this.ring.scale.setScalar(this.R); this.ring.material.opacity = 0.5 + 0.4 * Math.sin(realT * 8); }
    this.col.visible = this.flashK > 0; if (this.col.visible) { this.col.position.set(this.sx, 0, this.sz); this.col.scale.set(this.sR * 0.35, 1, this.sR * 0.35); this.col.material.opacity = this.flashK * 0.8; }
    this.sparks.sync(1, this.be.D.ctx.fire.uniforms.uScale.value);
  }
  dispose() { const s = this.be.D.ctx.scene; s.remove(this.ring, this.col, this.sparks.points); this.be.D.ctx.post.opts.blacklight = null; }
  label() { return this.cd > 0 ? 'Recharging' : this.held ? Math.round(this.R * 2) + ' m flare' : 'Hold to charge'; }
}

// The arsenal: three warheads (another every minute); hold to dial the yield up, let go to launch
export class NukeCtl {
  constructor(be) { this.be = be; this.heads = 3; this.regen = 0; be.D.list.push(wrap(this)); }
  down(x, z) {
    if (this.heads <= 0) { this.be.g.toast('No warheads left: the next one is ' + Math.ceil(30 - this.regen) + ' s away'); return; }
    this.be.gauge.start('nuclear', x, z);
  }
  move(x, z) { this.be.gauge.move(x, z); }
  up() { const r = this.be.gauge.release(); if (!r) return; this.heads--; this.be.D.start('nuclear', r.x, r.z, { ...r.opts, warn: 5.2, quiet: true }); }
  update(h) { if (this.heads < 3 && (this.regen += h) >= 30) { this.regen = 0; this.heads++; } } // a new warhead every 30 s (a minute left long dead stretches)
  label() { return this.heads + ' warheads'; }
}

// The reactor: hold to push the core (let go and it cools a little); at 100% it blows. Then steer the fallout over the city
export class ReactorCtl {
  constructor(be) {
    this.be = be; this.p = 0; this.steamT = 0;
    const O = be.D.ctx.outskirts; this.plant = O && O.plant;
    if (this.plant) be.g.lookAt(this.plant.reactor.x, this.plant.reactor.z, 520);
    be.D.list.push(wrap(this));
  }
  down(x, z) { this.held = true; this.fx = x; this.fz = z; } move(x, z) { this.fx = x; this.fz = z; } up() { this.held = false; }
  update(h) {
    const D = this.be.D, P = this.plant; if (!P) return;
    if (!this.ev) {
      this.p = Math.max(0, Math.min(1, this.p + (this.held ? h * 0.2 : -h * 0.04))); // five seconds' hold to blow
      P.lightMat.color.setRGB(Math.sin(this.be.t * (4 + this.p * 18)) > 0 ? 1 + this.p * 4 : 0.3, 0.12, 0.05);
      if ((this.steamT -= h) <= 0) { this.steamT = Math.max(0.15, 1.4 - this.p * 1.2); D.ctx.fire.spray(P.reactor.x + (Math.random() - 0.5) * 20, P.reactor.z + (Math.random() - 0.5) * 20, 20 + Math.random() * 12, 5, 7, 2.6); }
      D.shake(this.p * this.p * 0.4);
      if (this.p >= 1) { this.ev = D.start('meltdown', null, null, { warn: 0.01, quiet: true, fallLife: 99999 }); D.ctx.people.alarm(30); }
      return;
    }
    const f = this.ev.fall; if (!f) return;
    if (this.held) { const dx = this.fx - f.x, dz = this.fz - f.z, d = Math.hypot(dx, dz) || 1; f.vx += (dx / d * 9 - f.vx) * Math.min(1, h); f.vz += (dz / d * 9 - f.vz) * Math.min(1, h); } // blow the cloud where you want it
    else { f.vx *= Math.exp(-h * 0.3); f.vz *= Math.exp(-h * 0.3); }
  }
  follow() { const f = this.ev && this.ev.fall; return f ? [f.x, f.z] : null; }
  label() { return !this.ev ? 'Core ' + Math.round(this.p * 100) + '%' : this.ev.fall ? 'Steer the fallout' : 'Meltdown!'; }
}

// The black hole: it roams after your finger like the tornado, growing with everything it eats
export class RoamingHoleCtl {
  constructor(be, x, z) { this.be = be; this.ev = be.D.start('blackhole', x, z, { steer: true, quiet: true }); be.D.list.push(wrap(this)); }
  down(x, z) { this.ev.tx = x; this.ev.tz = z; } move(x, z) { this.ev.tx = x; this.ev.tz = z; } up() {}
  update() {}
  follow() { return this.ev.alive ? [this.ev.x, this.ev.z] : null; }
  finish() { this.ev.collapse(); }
  label() { return this.ev.alive ? Math.round(this.ev.Rh * 2) + ' m horizon · ' + this.ev.eaten + ' eaten' : 'Gone'; }
}

// The tripod: drag to walk it; hold your finger under it to beam people up; tap anywhere to sweep the heat ray there
export class TripodCtl {
  constructor(be, x, z) { this.be = be; this.tp = new Tripod(be.D, x, z, { player: true, fromY: 150 }); this.fireT = 3; be.D.list.push(wrap(this)); }
  down(x, z) { this.held = true; this.fx = x; this.fz = z; this.t0 = now(); }
  move(x, z) { this.fx = x; this.fz = z; }
  up() { this.held = false; if (now() - this.t0 < 260 && Math.hypot(this.fx - this.tp.x, this.fz - this.tp.z) < 120 && !this.tp.ray) this.tp.fireAt(this.fx, this.fz); }
  update(h) {
    const tp = this.tp; tp.update(h);
    if (tp.state !== 'walk') return;
    if (this.held) {
      if (Math.hypot(this.fx - tp.x, this.fz - tp.z) > 22) { tp.steer(this.fx, this.fz); tp.tb = null; }
      else { tp.steer(tp.x, tp.z); if (!tp.tb) tp.beamAt(this.fx, this.fz); else { tp.tb.x = this.fx; tp.tb.z = this.fz; tp.tb.t = Math.min(tp.tb.t, 2); } } // keeps beaming while you hold
    } else tp.steer(tp.x, tp.z);
    if (!tp.ray && (this.fireT -= h) <= 0) { this.fireT = 4 + Math.random() * 2; tp.fireAt(); } // it burns things on its own too
  }
  sync(dt, t) { this.tp.sync(dt, t); }
  dispose() { this.tp.dispose(); }
  follow() { return [this.tp.x, this.tp.z]; }
  poi() { return { x: this.tp.x, z: this.tp.z, danger: 25, range: 320 }; }
  label() { return this.tp.eaten + ' eaten'; }
}

// Super villains: you control one at a time (the Switch button changes who); the other two carry on by themselves
export class VillainsCtl {
  constructor(be, x, z) {
    this.be = be; this.ev = be.D.start('villains', x, z, { life: Infinity, quiet: true, persist: true }); this.i = 0; this.away = 22;
    const old = document.getElementById('zd-swap'); if (old) old.remove();
    this.btn = be.g.addButton('zd-swap', 'Switch', () => this.swap());
    this.take(0);
    be.D.list.push(wrap(this));
  }
  get who() { return this.ev.who[this.i]; }
  take(i) { this.i = i % this.ev.who.length; this.ev.who.forEach((v, k) => v.setPlayer(k === this.i)); this.be.g.toast('You are ' + this.who.name + ': ' + this.who.hint, 4500); }
  swap() { this.up(); this.take(this.i + 1); }
  down(x, z) { const v = this.who; if (v.beaten || v.gone) { this.be.g.toast(v.name + ' was beaten and will be back soon. Switch to another villain'); return; } v.pDown(x, z); }
  move(x, z) { const v = this.who; if (!v.beaten && !v.gone) v.pMove(x, z); } up() { const v = this.who; if (!v.beaten && !v.gone) v.pUp(); }
  // the heroes answer the signal (they arrive 20 s after you do at the earliest), beat what they can, fly off, and come back 30 s later
  update(h) {
    const D = this.be.D, on = D.list.some(e => e.type === 'heroes' && e.alive);
    this.away = on ? 0 : this.away + h;
    if (this.away >= 30) { this.away = 0; const v = this.who; D.start('heroes', v.x, v.z, { brief: true }); }
  }
  dispose() { if (this.btn) this.btn.remove(); }
  follow() { const v = this.who; return v.gone ? null : [v.x, v.z]; }
  label() { return this.who.name; }
}

// The giant worm: drag to steer it under the streets; let go and it bursts out of the ground where it is
export class WormCtl {
  constructor(be, x, z) { this.be = be; this.w = be.D.start('worm', x, z, { player: true, quiet: true, life: Infinity }); be.D.list.push(wrap(this)); }
  down(x, z) { this.w.steer(x, z); } move(x, z) { this.w.steer(x, z); } up() { this.w.breach(); }
  update() {}
  follow() { return [this.w.x, this.w.z]; }
  label() { return this.w.surfaced ? 'Breaching!' : 'Underground'; }
}
// The kaiju: drag to walk it; a quick tap on a car throws it, on a building swipes it, anywhere else it roars
export class KaijuCtl {
  constructor(be, x, z) { this.be = be; this.k = be.D.start('kaiju', x, z, { player: true, quiet: true, life: Infinity, hp: Infinity }); be.D.list.push(wrap(this)); }
  down(x, z) { this.t0 = now(); this.fx = x; this.fz = z; this.k.steer(x, z); }
  move(x, z) { this.fx = x; this.fz = z; this.k.steer(x, z); }
  up() {
    const K = this.k; if (now() - this.t0 > 260 || K.act) return;
    const { traffic, city } = this.be.D.ctx, x = this.fx, z = this.fz; K.steer(K.x, K.z); // a tap does not walk it
    let car = null; traffic.near(x, z, 10, (c) => { if (!car && !c.gone && c.mode === 0 && !c.mission) car = c; });
    if (car && Math.hypot(car.x - K.x, car.z - K.z) < 40) { K.act = { kind: 'car', car, t: 0, arm: 0 }; return; }
    if (K.tentGrab(x, z)) return; // a tentacle goes for whoever (or whatever car) is there
    let bk = -1; city.buildingsNear(x, z, 3, (k) => { if (bk < 0) bk = k; });
    if (bk >= 0 && Math.hypot(x - K.x, z - K.z) < 40) { K.yaw = Math.atan2(z - K.z, x - K.x); K.act = { kind: 'swipe', k: bk, t: 0, arm: 1 }; return; }
    K.act = { kind: 'roar', t: 0 };
  }
  update() {}
  follow() { return [this.k.x, this.k.z]; }
  label() { return this.k.cars + ' cars thrown · ' + this.k.grabbed + ' grabbed'; }
}
