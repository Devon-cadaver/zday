// Chain reactions (Be The Disaster): the town finishes what the disaster starts.
// A tall building coming down leans into the next one in its way and brings it
// down too, and that one the next; a burning car blows up after a few seconds and
// sets the cars round it alight (and they blow in turn), now and then lighting the
// building beside it; a building that has burned a while may blow its gas main, a
// fireball that brings it down and sets its neighbours alight. Explosions scare
// people off; they do not hurt anyone by themselves.
import { sfx } from './audio.js';

const MAX_DEPTH = 5; // dominoes in one run
const AIRBORNE = 3; // dominoes on their way down at once (each collapse costs a step)

export class Chain {
  // say(text, slow): the named moment (hits.js)
  constructor(D, say) { this.D = D; this.say = say; this.reset(); }

  reset() {
    this.t = 0; this.scan = 0; this.q = 0; this.lastGas = -99;
    this.depth = new Map(); // building -> how far down a domino run it is
    this.lit = new Map(); // building -> when it caught fire
    this.cars = new Map(); // car or parked car -> when it blows
    this.blown = new WeakSet();
    this.booms = [];
    this.n = { domino: 0, car: 0, gas: 0 };
  }

  // a building came down. fall: the angle it was tipped by (debris 'sink' leans its top toward (-sin, cos))
  collapse(k, fall) {
    if (fall == null) return; // torn away or vaporised: nothing left standing to lean
    const D = this.D, { city } = D.ctx, b = city.buildings[k]; if (!b) return;
    const d0 = this.depth.get(k) || 0, hgt = b.top - b.baseY;
    if (d0 >= MAX_DEPTH || hgt < 9 || this.q >= AIRBORNE) return;
    const ux = -Math.sin(fall), uz = Math.cos(fall), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const reach = hgt * 0.85 + Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.5;
    let best = -1, bd = 1e9;
    city.buildingsNear(cx, cz, reach, (j, d, o) => {
      if (j === k || city.dead[j] || this.depth.has(j) || o.landmark) return;
      const ox = (o.x0 + o.x1) / 2 - cx, oz = (o.z0 + o.z1) / 2 - cz, ol = Math.hypot(ox, oz) || 1;
      if ((ox * ux + oz * uz) / ol < 0.75 || ol > reach) return; // within about 40 degrees of the way it leans
      if (ol < bd) { bd = ol; best = j; }
    });
    if (best < 0) return;
    const o = city.buildings[best], oh = o.top - o.baseY;
    if (Math.random() > (oh <= hgt * 1.15 ? 0.6 : 0.2)) return; // a bigger one may stand
    this.depth.set(best, d0 + 1); this.q++;
    const nx = (o.x0 + o.x1) / 2 - cx, nz = (o.z0 + o.z1) / 2 - cz, nl = Math.hypot(nx, nz) || 1;
    D.later(0.55 + Math.random() * 0.35, () => {
      this.q--; if (city.dead[best]) return;
      D.destroyBuilding(best, 'collapse', { dir: Math.atan2(-nx / nl, nz / nl) }); // leaning on the same way down the line
      this.n.domino++;
      this.say('Domino!', 0.6);
    });
  }

  // a building caught fire
  fire(k) { if (!this.lit.has(k)) this.lit.set(k, this.t); }

  // a car (or a parked car) is burning: it blows in a few seconds
  carLit(c, soon = false) { if (c && !c.mission && !this.cars.has(c) && !this.blown.has(c)) this.cars.set(c, this.t + (soon ? 3 : 4) + Math.random() * 5); }

  step(h) {
    this.t += h;
    if ((this.scan -= h) > 0) return;
    this.scan = 0.5;
    const D = this.D, { traffic, fire, city } = D.ctx;
    for (const c of traffic.cars) if (c.burning && !c.gone) this.carLit(c); // set alight by a crash, a laser, a landing
    let n = 0;
    for (const [c, at] of this.cars) {
      if (at > this.t) continue;
      this.cars.delete(c); this.blown.add(c);
      if (c.gone) continue;
      this.boom(c.x, c.z);
      if (++n >= 2) break; // a couple at a time
    }
    // a building burning a while: one roll at its gas main
    if (this.t - this.lastGas > 4) for (const [k, at] of this.lit) {
      if (city.dead[k] || !fire.bFire[k]) { this.lit.delete(k); continue; }
      if (this.t - at < 10) continue;
      this.lit.delete(k);
      if (Math.random() < 0.3) { this.gas(k); break; }
    }
  }

  // a car blows up at (x, z)
  boom(x, z) {
    const D = this.D, { traffic, fire, city, people } = D.ctx;
    fire.burst(x, 1.2, z, 12, 2.4); sfx('boom', x, 1, z, { gain: 0.75 }); people.scare(x, z, 24, 0.8); D.shake(0.12);
    for (const pc of traffic.parkedNear(x, z, 7)) if (!pc.burnt) {
      traffic.burnParked(pc); fire.carFire(pc.x, pc.z); this.carLit(pc, true);
      D.emit({ type: 'carfire', x: pc.x, z: pc.z, car: pc });
    }
    traffic.near(x, z, 8, (o) => {
      if (o.mission || o.gone || this.blown.has(o) || this.cars.has(o) || o.mode === 4 || o.mode === 5) return; // EXT, AIR: already off the road
      const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz) || 1; if (d > 8) return;
      o.soft = true; o.ignite = true; // people get out of its way where it lands
      traffic.fling(o, dx / d * 4, 5 + Math.random() * 3, dz / d * 4);
    });
    city.buildingsNear(x, z, 5, (k) => { if (!city.dead[k] && !fire.bFire[k] && Math.random() < 0.3) fire.igniteBuilding(k); });
    this.n.car++;
    this.booms.push(this.t); while (this.booms.length && this.booms[0] < this.t - 8) this.booms.shift();
    if (this.booms.length >= 3) this.say('Chain reaction!');
  }

  // a building's gas main goes: a fireball, it comes down, the fire leaps to its neighbours
  gas(k) {
    const D = this.D, { city, fire, people } = D.ctx, b = city.buildings[k];
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, R = Math.max(14, Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.9);
    fire.blast(cx, cz, R);
    const ev = fire.events[fire.events.length - 1]; if (ev && ev.type === 'blast') fire.events.pop(); // not an attack: nothing in the world reacts to it as one (a kaiju takes blasts as hits)
    sfx('boomBig', cx, (b.top + b.baseY) / 2, cz); D.shake(0.5); people.scare(cx, cz, 50, 1);
    D.destroyBuilding(k, 'collapse');
    this.lastGas = this.t; this.n.gas++;
    this.say('Gas main!', 0.5);
  }
}
