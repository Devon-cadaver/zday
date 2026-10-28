// Emergency response. The Sandbox's auto-responders: while they are on, every
// disaster you drop gets its counter: fire trucks to burning buildings and a
// water drop on a big blaze, rescue helicopters to people stranded on roofs,
// police to zombies and riots (and a police bus for the arrested), storm chasers
// and cloud seeding for tornadoes, airstrikes on alien tripods and saucers,
// hazmat for radiation, and the hero signal for super villains and incoming
// meteors and missiles. Once a disaster is over, construction crews rebuild
// what fell, with a medical camp by the work to hold the people from round
// there. Also the pieces Commander shares: cloud seeding, camp spots, police buses.
import { Site, Camp, Hazmat } from './rebuild.js';
import { ST } from './people.js';

// a cloud-seeding run reaches (x, z): tornadoes nearby lose strength (a weak one ropes out), a thunderstorm breaks up into rain, rain into clear skies
export function seedEffect(D, x, z) {
  let hit = 0;
  for (const e of D.list) {
    if (e.type !== 'tornado' || !e.tw) continue;
    const tw = e.tw; if (Math.hypot(tw.x - x, tw.z - z) > 220) continue;
    hit++; tw.size = Math.max(0.6, tw.size - 0.55); tw.applySize(); tw.life = Math.min(tw.life, tw.t + 25);
    if (tw.size < 1.05 && tw.phase === 'ground') { tw.phase = 'rope'; tw.ropeT = 0; }
  }
  const w = D.weather.type;
  if (w === 'storm') D.weather.set('rain'); else if (w === 'rain' && !D.active('flood')) D.weather.set('clear');
  return { hit, w };
}
// open ground for the tents near (x, z): walkable with nothing built within 10 m, a park or a square rather than a road
export function campSpot(people, city, x, z) {
  let best = null, bd = 1e9;
  for (let r = 0; r <= 60; r += 5) for (let a = 0; a < 6.28; a += r ? 5 / r : 7) {
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!people.walkable(px, pz)) continue;
    let clear = true; city.buildingsNear(px, pz, 10, () => { clear = false; }); if (!clear) continue;
    const d = r + (people.onRoad(px, pz) ? 25 : 0); if (d < bd) { bd = d; best = [px, pz]; }
  }
  return best;
}
// rioters in custody: a police bus comes for each group and takes them out of the area (call once a second)
export function custodyBuses(g, district, onSent) {
  const p = g.people;
  for (const c of p.custody) {
    if (c.done) continue;
    if (c.bus) {
      const bus = c.bus;
      if (!c.freed && (bus.gone || (bus.mode !== 3 && p.time - c.sentAt > 120))) { p.releaseHeld(c.id); c.freed = true; } // it never got to them: let off with a warning
      if (bus.gone) { c.done = true; continue; }
      if (bus.mode !== 3 || bus.leaving) continue;
      bus.loadT = (bus.loadT || 0) + 1; let boarding = 0;
      for (let i = 0; i < p.active; i++) if (p.st[i] === ST.BOARD && p.bt[i] === bus.id) boarding++;
      if ((!boarding && bus.loadT > 2) || bus.loadT > 35) { p.releaseBus(bus.id); g.traffic.depart(bus); c.done = true; }
      continue;
    }
    const n = p.heldBy(c.id);
    if (!n) { c.done = true; continue; }
    if (n < 4 && p.time - c.t < 20) continue; // wait a little for a bus load
    const car = g.traffic.dispatchTo(c.x, c.z, { kind: 'jail',
      onArrive: (ax, az, bus) => { bus.loadT = 0; bus.loaded = 0; const k = p.custodyToBus(c.id, ax, az, bus.id); g.toast('Police bus loading ' + k + ' arrested rioters in the ' + district(ax, az)); },
      onLost: (bus) => { p.releaseBus(bus.id); c.done = true; },
      onGone: (bus) => { g.toast('Police bus away with ' + (bus.loaded || 0) + ' rioters', 3000); } });
    if (car) { c.bus = car; c.sentAt = p.time; if (onSent) onSent(car); }
  }
}

export class Responders {
  constructor(g) {
    this.g = g; this.on = true; this.t = 0; this.tick = 0; this.autoHeroes = false; // the heroes come when you call them (Sandbox: Call heroes)
    this.works = []; this.camps = []; this.hazmats = []; this.buildTo = new Set(); this.fell = new Map(); this.noRoute = new Map(); this.fireTo = new Map(); this.cool = {}; this.units = [];
  }
  reset() {
    for (const o of [...this.works, ...this.camps, ...this.hazmats]) o.dispose();
    this.works = []; this.camps = []; this.hazmats = []; this.buildTo.clear(); this.fell.clear(); this.noRoute.clear(); this.fireTo.clear(); this.cool = {}; this.units = []; this.t = 0;
  }
  setOn(on) { this.on = on; this.g.disasters.boats.auto = on; }
  // a building came down: it can be rebuilt once things have calmed down
  onEvent(e) {
    if (e.type === 'collapse' && e.k != null) this.fell.set(e.k, this.t);
    if (e.type === 'boarded') { const bus = this.g.traffic.cars[e.bus]; if (bus) bus.loaded = (bus.loaded || 0) + 1; } // a head count for the police bus
  }
  update(sdt) {
    this.t += sdt;
    const g = this.g, p = g.people;
    for (const w of this.works) w.update(sdt);
    for (const hz of this.hazmats) hz.update(sdt);
    for (const c of this.camps) { // a camp packs up once nothing is being rebuilt near it and it is safe
      c.update(sdt);
      const busy = this.buildTo.size > 0 || this.works.some(w => w.alive && Math.hypot(w.cx - c.x, w.cz - c.z) < 320);
      if (c.t > c.minT && !busy && p.zombiesNear(c.x, c.z, 70) === 0) { const n = c.close(); if (n) g.toast('Rebuilding done: the medical camp is sending ' + n + ' people home', 3000); if (c.car && !c.car.gone) g.traffic.depart(c.car); }
    }
    this.works = this.works.filter(w => w.alive); this.hazmats = this.hazmats.filter(h => h.alive); this.camps = this.camps.filter(c => c.alive);
    if (!this.on || (this.tick -= sdt) > 0) return;
    this.tick = 1;
    this.respond(); this.rebuild(); this.sendHome();
    custodyBuses(g, (x, z) => g.disasters.district(x, z));
  }
  ready(key, secs) { if ((this.cool[key] || 0) > this.t) return false; this.cool[key] = this.t + secs; return true; }
  out(kind) { let n = 0; for (const m of this.g.traffic.missions) if (m.kind === kind && !m.gone) n++; return n; }
  send(kind, x, z, onArrive, onLost) {
    const car = this.g.traffic.dispatchTo(x, z, { kind, onLost, onArrive: (ax, az, c) => { c.arrivedAt = this.t; if (onArrive) onArrive(ax, az, c); } });
    if (car && (kind === 'police' || kind === 'fire' || kind === 'apc' || kind === 'chaser')) this.units.push(car);
    return car;
  }
  // units on scene drive off once their job is done, so there is always someone free for the next call
  sendHome() {
    const g = this.g, p = g.people, D = g.disasters;
    for (const car of this.units) {
      if (car.gone || car.leaving || car.mode !== 3 || car.arrivedAt == null) continue;
      const on = this.t - car.arrivedAt, x = car.x, z = car.z;
      const done = car.kind === 'fire' ? on > 20 && g.fire.firesWithin(x, z, 70).length === 0
        : car.kind === 'police' ? on > 40 && p.zombiesNear(x, z, 60) === 0 && !D.list.some(e => e.type === 'riot' && e.alive && e.mob && Math.hypot(e.mob.x - x, e.mob.z - z) < 120)
        : car.kind === 'apc' ? on > 90
        : on > 20 && !D.list.some(e => e.type === 'tornado' && e.alive && e.tw && e.tw.onGround);
      if (done) g.traffic.depart(car);
    }
    this.units = this.units.filter(c => !c.gone);
  }
  // the counter to whatever is going on
  respond() {
    const g = this.g, D = g.disasters, p = g.people, fire = g.fire, city = g.city, helis = g.helis;
    // fires: a truck to each burning building (four out at most), a water drop on a big blaze
    const burning = []; for (let k = 0; k < fire.bFire.length; k++) if (fire.bFire[k] === 1 && !city.dead[k]) burning.push(k);
    for (const k of burning) {
      const tr = this.fireTo.get(k); if (tr && !tr.gone) continue;
      if (this.out('fire') >= 4) break;
      const b = p.bld[k], to = b.door || [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
      const car = this.send('fire', to[0], to[1], (ax, az) => p.spawnFirefighters(ax, az, 2)); if (car) this.fireTo.set(k, car);
    }
    if (burning.length >= 3 && helis && this.ready('water', 25)) {
      let best = burning[0], bn = 0; for (const k of burning) { const b = p.bld[k], n = fire.firesWithin((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 40).length; if (n > bn) { bn = n; best = k; } }
      const b = p.bld[best]; helis.send('water', (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, {});
    }
    // people afloat in a flood: rescue helicopters over the worst of it (four out at most), life rafts dropped where there are most
    const afloat = p.stats.afloat || 0;
    if (helis && afloat > 8) {
      const spots = p.swimSpots(4);
      if (helis.list.filter(h => h.kind === 'rescue').length < 4 && this.ready('swimheli', 6)) { const s = spots[Math.floor(Math.random() * Math.min(2, spots.length))]; if (s) helis.send('rescue', s[0], s[1], { k: -1 }); }
      if (afloat > 25 && this.ready('rafts', 16)) { const s = spots[Math.floor(Math.random() * spots.length)]; if (s) helis.send('water', s[0], s[1], { onDrop: (x, z) => D.boats.dropRafts(x, z) }); }
    }
    // people stranded on rooftops: a rescue helicopter
    if (helis && helis.list.filter(h => h.kind === 'rescue').length < 2 && this.ready('rescue', 10)) {
      let bk = -1, most = 2; p.bld.forEach((b, k) => { if (p.bRoof[k] > most && !city.dead[k]) { most = p.bRoof[k]; bk = k; } });
      if (bk >= 0) { const rf = p.bld[bk].roof; helis.send('rescue', (rf.x0 + rf.x1) / 2, (rf.z0 + rf.z1) / 2, { k: bk }); }
    }
    // zombies: police to where they are thickest, an armoured squad if it gets out of hand
    if (p.stats.zombies > 0 && this.out('police') < 6 && this.ready('police', 4)) {
      let best = null, bc = 0;
      for (let n = 0; n < 24; n++) { const i = Math.floor(Math.random() * p.active); if (p.st[i] !== ST.ZOMBIE || p.lvl[i] !== -1) continue; const c = p.zombiesNear(p.x[i], p.z[i], 20); if (c > bc) { bc = c; best = [p.x[i], p.z[i]]; } }
      if (best) this.send('police', best[0], best[1], (ax, az) => p.spawnOfficers(ax, az, 2));
    }
    if (p.stats.zombies > 60 && this.out('apc') < 2 && this.ready('apc', 40)) {
      let at = null; for (let n = 0; n < 30 && !at; n++) { const i = Math.floor(Math.random() * p.active); if (p.st[i] === ST.ZOMBIE && p.lvl[i] === -1) at = [p.x[i], p.z[i]]; }
      if (at) this.send('apc', at[0], at[1], (ax, az) => p.spawnOfficers(ax, az, 8, 3));
    }
    for (const e of D.list) {
      if (!e.alive) continue;
      // riots: police to the mob (the arrested go out on a police bus)
      if (e.type === 'riot' && e.mob && this.out('police') < 6 && this.ready('riot', 7)) this.send('police', e.mob.x, e.mob.z, (ax, az) => p.spawnOfficers(ax, az, 3));
      // tornadoes: storm chasers on it and cloud seeding runs over it
      if (e.type === 'tornado' && e.tw && e.tw.onGround) {
        if (helis && this.ready('seed', 16)) { const x = e.tw.x, z = e.tw.z; helis.seed(x, z, { onSeed: (sx, sz) => { const r = seedEffect(D, sx, sz); if (r.hit) g.toast('Cloud seeding: the tornado is losing strength', 3000); } }); }
        if (this.out('chaser') < 1 && this.ready('chaser', 60)) this.send('chaser', e.tw.x, e.tw.z);
      }
      // the kaiju: airstrikes until it turns back
      if (e.type === 'kaiju' && e.state !== 'leave' && helis && this.ready('kaiju', 9)) helis.strike(e.x, e.z, { radius: 25 });
      // aliens: airstrikes on walking tripods and low saucers
      if (e.type === 'aliens' && helis && this.ready('strike', 12)) {
        const t = (e.tripods || []).find(q => q.state === 'walk') || (e.saucers || []).find(s => (s.state === 'cruise' || s.state === 'act') && s.y < 80);
        if (t) helis.strike(t.x, t.z, { radius: 25 });
      }
    }
    // super villains, the giant worm and the kaiju, incoming meteors and missiles: the hero signal (the kaiju has the
    // city to itself for a quarter of a minute first)
    if (this.autoHeroes && !D.list.some(e => e.type === 'heroes' && e.alive && !e.leaving)) {
      const th = D.list.find(e => e.alive && (e.type === 'villains' || (e.type === 'kaiju' && e.state !== 'leave' && e.t > 15) || (e.type === 'tsunami' && e.phase !== 'recede') || (e.type === 'flood' && p.stats.afloat > 20) || (e.type === 'worm' && e.phase !== 'leave' && e.phase !== 'gone') || ((e.type === 'meteor' || e.type === 'nuclear') && (e.phase === 'warn' || e.phase === 'fall'))));
      if (th && this.ready('heroes', 20)) { const v = th.who ? th.who.find(w => !w.gone) : null; D.start('heroes', v ? v.x : th.x, v ? v.z : th.z); }
    }
    // radiation: a hazmat team to each zone (two out at once)
    for (const q of D.zones.list) {
      if (this.hazmats.length + this.out('hazmat') >= 2) break;
      if (this.hazmats.some(h => Math.hypot(h.x - q.x, h.z - q.z) < q.R) || !this.ready('hazmat' + Math.round(q.x) + ',' + Math.round(q.z), 40)) continue;
      this.send('hazmat', q.x, q.z, (ax, az, truck) => this.hazmats.push(new Hazmat(D, ax, az, { onDone: () => { if (!truck.gone) g.traffic.depart(truck); } })));
    }
  }
  // once the disasters are over: crews to what fell (six sites at a time), a medical camp by the work
  rebuild() {
    const g = this.g, D = g.disasters, city = g.city, p = g.people, c = g.controls.target;
    if (D.list.some(e => e.alive && e.type !== 'heroes')) return;
    if (this.works.length + this.buildTo.size < 6) {
      let best = -1, bd = 1e9;
      for (let k = 0; k < city.buildings.length; k++) {
        if (!city.dead[k] || this.buildTo.has(k) || this.works.some(w => w.k === k) || (this.noRoute.get(k) || 0) > this.t) continue;
        if (this.t - (this.fell.get(k) ?? -99) < 10) continue; // let the dust settle
        const b = city.buildings[k], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        if (D.holeFloor(cx, cz) != null || D.zones.at(cx, cz)) continue;
        const d = Math.hypot(cx - c.x, cz - c.z); if (d < bd) { bd = d; best = k; } // the ones you are looking at first
      }
      if (best >= 0) {
        const k = best, b = city.buildings[k], to = b.door || [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
        this.buildTo.add(k);
        const car = this.send('build', to[0], to[1], (ax, az, truck) => { this.buildTo.delete(k); if (!city.dead[k]) { g.traffic.depart(truck); return; } this.works.push(new Site(D, k, { car: truck, onDone: (s) => { if (s.car && !s.car.gone) g.traffic.depart(s.car); } })); }, () => this.buildTo.delete(k));
        if (!car) { this.buildTo.delete(k); this.noRoute.set(k, this.t + 60); }
      }
    }
    // a medical camp next to the rebuilding, for the people from round there
    for (const w of this.works) {
      if (this.camps.length >= 2 || this.out('medic') > 0) break;
      if (this.camps.some(cp => Math.hypot(cp.x - w.cx, cp.z - w.cz) < 220)) continue;
      const s = campSpot(p, city, w.cx, w.cz); if (!s) continue;
      this.send('medic', s[0], s[1], (ax, az, amb) => { const cp = new Camp(D, s[0], s[1], { minT: 60 }); cp.car = amb; this.camps.push(cp); });
      break;
    }
  }
}
