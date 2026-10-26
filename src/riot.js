// Riot: an angry mob marches through the streets, throwing petrol bombs at
// cars and shopfronts and pulling in passers-by as it goes. Police arrest
// rioters one at a time; soldiers fire tear gas into the crowd. It fizzles out
// once the mob drops below a handful, or after a few minutes.
import * as THREE from 'three';
import { ST, KIND } from './people.js';

const GEO = new THREE.SphereGeometry(0.22, 6, 4);
let MOLOTOV = null, CANISTER = null;

export class Riot {
  constructor(D, x, z, opts = {}) {
    this.type = 'riot'; this.D = D; this.t = 0; this.alive = true;
    const { people, traffic } = D.ctx;
    if (!MOLOTOV) { MOLOTOV = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.2, 0.5) }); CANISTER = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.8, 0.76) }); }
    this.cap = opts.n ?? 50; this.life = opts.life ?? 170;
    const n0 = traffic.nodes[traffic.nearestNode(x, z)];
    this.mob = { id: people.mobs.length, x: n0.x, z: n0.z, alive: true };
    people.mobs.push(this.mob);
    this.members = people.startRiot(x, z, Math.round(this.cap * 0.7), this.mob);
    this.prev = -1; this.next = traffic.nearestNode(x, z); this.pause = 3;
    this.throwT = 2; this.tick = 0; this.recruitT = 6; this.count = this.members.length; this.peak = this.count;
    this.shots = []; this.burnt = 0; this.scorched = new Set();
    if (!opts.quiet) D.emit({ type: 'warn', hazard: 'riot', x: this.mob.x, z: this.mob.z, r: 45, exact: true, text: 'Riot! An angry mob is smashing up the ' + D.district(x, z) + ' district. Send police to make arrests' });
  }
  get x() { return this.mob.x; } get z() { return this.mob.z; }

  poi() { return { x: this.mob.x, z: this.mob.z, danger: 18, range: 110 }; }
  member() {
    const { people } = this.D.ctx;
    for (let n = 0; n < 8 && this.members.length; n++) { const j = this.members[Math.floor(Math.random() * this.members.length)]; if (people.st[j] === ST.RIOT && people.bt[j] === this.mob.id) return j; }
    return -1;
  }

  update(h) {
    const D = this.D, { people, traffic, city } = D.ctx, mob = this.mob;
    this.t += h;
    // march from crossing to crossing, stopping now and then to smash the place up
    if (this.lead) this.pause = 0; // someone is leading it: no stopping
    if (this.pause > 0) this.pause -= h;
    else {
      const N = traffic.nodes[this.next], dx = N.x - mob.x, dz = N.z - mob.z, d = Math.hypot(dx, dz);
      if (d < 1.5 && this.lead) { // take the street that heads most towards the leader
        const [lx, lz] = this.lead; let best = this.next, bd = Math.hypot(N.x - lx, N.z - lz);
        for (const v of N.nb) { const n = traffic.nodes[v], dd = Math.hypot(n.x - lx, n.z - lz); if (dd < bd - 2) { bd = dd; best = v; } }
        this.prev = this.next; this.next = best;
      } else if (d < 1.5) {
        if (Math.random() < 0.5) this.pause = 4 + Math.random() * 8;
        const B = city.bounds, nb = N.nb.filter(v => v !== this.prev);
        const ok = nb.filter(v => { const n = traffic.nodes[v]; return n.x > B.x0 + 40 && n.x < B.x1 - 40 && n.z > B.z0 + 40 && n.z < B.z1 - 40; });
        const pick = ok.length ? ok : nb.length ? nb : N.nb;
        this.prev = this.next; this.next = pick[Math.floor(Math.random() * pick.length)];
      } else if (d >= 1.5) { const s = Math.min(d, (this.lead ? 2.6 : 1.4) * h); mob.x += dx / d * s; mob.z += dz / d * s; }
    }
    if ((this.tick -= h) <= 0) {
      this.tick = 1;
      let n = 0;
      for (const j of this.members) if (people.st[j] === ST.RIOT && people.bt[j] === mob.id) n++;
      this.count = n; this.peak = Math.max(this.peak, n);
      people.scare(mob.x, mob.z, 16, 0.12);
      // soldiers nearby fire tear gas into the crowd
      let sol = -1;
      people.around(mob.x, mob.z, 32, (j) => { if (sol < 0 && people.kind[j] === KIND.SOLDIER && people.st[j] === ST.COP) sol = j; });
      if (sol >= 0 && n > 0 && Math.random() < 0.3) { const j = this.member(); if (j >= 0) this.lob(people.x[sol], people.z[sol], people.x[j], people.z[j], 'gas', null); }
      if (n < 5 || this.t > this.life) { this.end(n < 5); return; }
    }
    if ((this.recruitT -= h) <= 0) {
      this.recruitT = 5 + Math.random() * 4;
      if (this.count < this.cap) this.members.push(...people.startRiot(mob.x, mob.z, 2, mob));
    }
    if ((this.throwT -= h) <= 0 && this.count > 0) {
      this.throwT = (3 + Math.random() * 3) * Math.max(0.6, 20 / (this.count + 10)); // a bigger mob throws more
      this.throwOne();
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.t += h; const k = Math.min(1, s.t / s.T);
      s.m.position.set(s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k + s.arc * 4 * k * (1 - k), s.z0 + (s.z1 - s.z0) * k);
      s.m.rotation.x += h * 9;
      if (k >= 1) { this.land(s); D.ctx.scene.remove(s.m); this.shots.splice(i, 1); }
    }
  }

  // pick something to hit near one of the rioters: a car, a parked car or a shopfront
  throwOne() {
    const { people, traffic, city } = this.D.ctx, j = this.member();
    if (j < 0) return;
    const x = people.x[j], z = people.z[j], roll = Math.random();
    let tgt = null;
    if (roll < 0.45) {
      let best = 22;
      traffic.near(x, z, 22, (car) => {
        if (car.mission || car.gone || car.burning || (car.mode !== 0 && car.mode !== 2)) return;
        const d = Math.hypot(car.x - x, car.z - z); if (d < best) { best = d; tgt = { car, x: car.x, z: car.z, y: 1 }; }
      });
    }
    if (!tgt && roll < 0.75) {
      const list = traffic.parkedNear(x, z, 20).filter(pc => !pc.burnt);
      if (list.length) { const pc = list[Math.floor(Math.random() * list.length)]; tgt = { pc, x: pc.x, z: pc.z, y: 0.8 }; }
    }
    if (!tgt) {
      const ks = []; city.buildingsNear(x, z, 22, (k) => { if (!city.dead[k]) ks.push(k); });
      if (ks.length) {
        const k = ks[Math.floor(Math.random() * ks.length)], b = city.buildings[k];
        tgt = { k, x: Math.max(b.x0, Math.min(b.x1, x)), z: Math.max(b.z0, Math.min(b.z1, z)), y: 2 + Math.random() * 3 };
      }
    }
    if (tgt) { people.hx[j] = tgt.x - x; people.hz[j] = tgt.z - z; this.lob(x, z, tgt.x, tgt.z, 'molotov', tgt); }
  }

  lob(x0, z0, x1, z1, kind, tgt) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(GEO, kind === 'gas' ? CANISTER : MOLOTOV); m.position.set(x0, 1.7, z0);
    this.D.ctx.scene.add(m);
    this.shots.push({ m, kind, tgt, x0, z0, y0: 1.7, x1, z1, y1: tgt ? tgt.y : 0.3, T: 0.55 + d / 20, t: 0, arc: 2 + d * 0.22 });
  }

  land(s) {
    const { fire, traffic, people, city } = this.D.ctx;
    if (s.kind === 'gas') { people.gas(s.x1, s.z1, 9); fire.gasCloud(s.x1, s.z1, 7); return; }
    fire.burst(s.x1, s.y1, s.z1);
    const tg = s.tgt;
    if (tg.car) { if (!tg.car.gone && Math.random() < 0.75) { traffic.burn(tg.car); this.burnt++; } }
    else if (tg.pc) { if (tg.pc.alive && !tg.pc.burnt) { traffic.burnParked(tg.pc); fire.carFire(tg.pc.x, tg.pc.z); this.burnt++; } }
    else if (tg.k != null) {
      if (Math.random() < 0.3 && fire.igniteBuilding(tg.k)) { this.burnt++; this.D.emit({ type: 'riotfire', k: tg.k, x: s.x1, z: s.z1, text: 'Rioters set a building alight' }); }
      else if (!this.scorched.has(tg.k)) { this.scorched.add(tg.k); city.char(tg.k, 0.92); }
    }
  }

  end(broken) {
    this.alive = false; this.mob.alive = false;
    this.D.emit({ type: 'riotend', broken, text: broken ? 'The riot has been broken up' : 'The rioters have drifted home' });
  }
  sync() {}
  dispose() { for (const s of this.shots) this.D.ctx.scene.remove(s.m); this.shots.length = 0; this.mob.alive = false; }
}
