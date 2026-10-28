// Commander mode: a 10 minute round of incidents (zombie outbreaks, quakes,
// riots, and worse disasters as you level up), an alert level, Response Points,
// and rescue units the player dispatches by tapping the map.
import * as THREE from 'three';
import { ST } from './people.js';
import { HAZARD_LEVEL, WEATHER_LEVEL } from './profile.js';
import { WEATHER, threatName } from './disasters.js';
import { Site, Camp, Hazmat } from './rebuild.js';
import { seedEffect, campSpot, custodyBuses } from './response.js';
import { PLACES, PATH, placeKey } from './places.js';

export const UNITS = [
  { id: 'police', name: 'Police', cost: 50, cd: 20, alert: 0 },
  { id: 'fire', name: 'Fire truck', cost: 80, cd: 30, alert: 0 }, // from the first round: riots and outbreaks start fires
  { id: 'bus', name: 'Evac bus', cost: 60, cd: 30, alert: 0 },
  { id: 'boat', name: 'Rescue boat', cost: 80, cd: 20, alert: 0 }, // only once the streets flood
  { id: 'coast', name: 'Coast Guard', cost: 250, cd: 60, alert: 0 }, // a flood: boats and helicopters at once to the worst spots in the water, no tap
  { id: 'barrier', name: 'Flood barrier', cost: 200, cd: 25, alert: 0 }, // a tsunami coming: an inflatable barrier across its path
  { id: 'chaser', name: 'Storm chaser', cost: 60, cd: 25, alert: 0 }, // spots tornadoes and aliens: calls in seeders, jets and tanks
  { id: 'seeder', name: 'Cloud seeder', cost: 100, cd: 30, alert: 0 }, // weakens tornadoes, breaks up storms
  { id: 'build', name: 'Construction', cost: 100, cd: 20, alert: 0 }, // rebuilds a fallen building
  { id: 'camp', name: 'Medical camp', cost: 120, cd: 40, alert: 0 }, // shelters people nearby until the rebuilding is done
  { id: 'hazmat', name: 'Hazmat team', cost: 120, cd: 30, alert: 0 }, // clears radiation so building can start, decontaminates people
  { id: 'heroes', name: 'Hero signal', cost: 300, cd: 120, alert: 0 }, // Dragonfly, Nova and Tempo: catch meteors and missiles, slow what flies
  { id: 'water', name: 'Water heli', cost: 150, cd: 60, alert: 2 },
  { id: 'rescue', name: 'Rescue heli', cost: 120, cd: 45, alert: 2 },
  { id: 'apc', name: 'Army APC', cost: 250, cd: 60, alert: 3 },
  { id: 'strike', name: 'Airstrike', cost: 300, cd: 45, alert: 4 },
  { id: 'nuke', name: 'Nuke', cost: 1000, cd: 9999, alert: 4, once: true },
];
const ALERTS = ['Quiet', 'Incident', 'Spreading', 'Major incident', 'City emergency'];
const FLOOD_CD = { boat: 5, rescue: 8, water: 15 }; // once the streets flood the coast guard and air rescue go out back to back
const GROUND = new Set(['police', 'bus', 'fire', 'apc', 'chaser', 'build', 'camp', 'hazmat']); // nothing on wheels gets through flooded streets
const ROUND = 600;
const START_RP = 100;
const SITE_AT = [0, 11, 23]; // the sites of one zombie outbreak break out this far apart

const CALLS = ['there is a man eating someone on the sidewalk!', 'they are attacking people outside my window', 'something is wrong with the people on my street', 'send help, they are everywhere', 'my neighbour just bit the mailman'];

const MSGS = {
  runover: 'A panicked driver plowed through a street somewhere',
  crash: 'Drivers are panicking and crashing. Look for the smoke',
  carfire: 'A wrecked car is burning',
  roof: 'Survivors are barricading themselves on a rooftop',
  breach: 'The horde piled up and reached a rooftop!',
  fire: 'An overrun building has caught fire',
  jump: 'Survivors are jumping from a burning roof',
  fallback: 'Officers are falling back! Too many zombies',
  copbit: 'An officer has been bitten',
  fireout: 'The fire crew knocked down a blaze',
  waterdrop: 'Water drop! Everything under it is out and soaked',
  rescued: 'Survivors are being lifted off a rooftop',
  grenade: 'The squad is throwing grenades into the horde',
  blast: 'Airstrike on target. Fires are starting in the blast zone',
  boarded: 'Civilians are boarding the evacuation bus',
  nuke: 'Nuclear detonation. The district is gone',
  arrest: 'Officers are arresting rioters',
  aliendrop: 'Armed aliens are on the ground! Soldiers and police will engage them',
  pray: 'Some people have stopped to pray in the street',
  fightback: 'Civilians are fighting back with whatever they can find',
  stolen: 'Someone hotwired a parked car and fled',
};

export class Commander {
  constructor(g) {
    this.g = g; this.msgs = MSGS;
    this.el = {
      h: g.addPill('zd-h', 'Humans'), z: g.addPill('zd-z', 'Zombies'), d: g.addPill('zd-d', 'Dead'),
      rp: g.addPill('zd-rp', 'Points'), inc: g.addPill('', 'Incidents'), alert: g.addPill('zd-al', '', 'zd-alert'), clock: g.addPill('', '', 'zd-clock'),
    };
    this.el.alertPill = this.el.alert.parentElement;
    this.pr = g.profile; this.diff = this.pr.difficulty();
    this.cards = {};
    const row = g.addCardRow();
    for (const u of UNITS) {
      if (!this.pr.unlocked(u.id)) continue;
      const b = g.addButton('zd-card-' + u.id, '<span class="nm">' + u.name + '</span><span class="cost">' + u.cost + ' pts</span><span class="cd"></span>', () => this.select(u.id), 'zd-card' + (u.once ? ' zd-nuke' : ''));
      row.appendChild(b); this.cards[u.id] = { btn: b, cd: b.querySelector('.cd'), u };
    }
    g.addSpeedButton();
    g.addButton('zd-restart', 'Restart', () => this.start());
    g.addButton('zd-menu-btn', 'Menu', () => { location.href = location.pathname; });
    this.end = document.createElement('div'); this.end.id = 'zd-end'; this.end.hidden = true;
    document.body.appendChild(this.end);
    // the scope: red rings and cross hairs that close in on where an incident is, when Show is tapped
    {
      const mat = new THREE.MeshBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: 0, depthWrite: false, depthTest: false }), m = this.scope = new THREE.Group();
      const flat = (geo) => { geo.rotateX(-Math.PI / 2); const o = new THREE.Mesh(geo, mat); o.renderOrder = 3; m.add(o); };
      flat(new THREE.RingGeometry(0.93, 1, 64)); flat(new THREE.RingGeometry(0.44, 0.48, 48)); flat(new THREE.CircleGeometry(0.05, 16));
      for (let k = 0; k < 4; k++) { const geo = new THREE.PlaneGeometry(0.035, 0.42); geo.translate(0, 0.83, 0); geo.rotateZ(k * Math.PI / 2); flat(geo); } // the four ticks
      m.visible = false; this.scopeMat = mat; g.people.mesh.parent.add(m); this.aim = null;
    }
    this.start();
  }

  // ---------- round
  start() {
    const g = this.g, p = g.people;
    this.end.hidden = true; this.pr.played('commander', placeKey()); // where you left off
    this.diff = this.pr.difficulty();
    p.incubate = this.diff.incubate.slice(); p.runnerBoost = this.diff.runners; p.markInfected = this.pr.has('drone');
    if (g.helis) g.helis.doubleDrop = this.pr.has('doubledrop');
    for (const o of [...(this.works || []), ...(this.camps || []), ...(this.hazmats || [])]) o.dispose();
    this.works = []; this.camps = []; this.hazmats = []; this.buildTo = new Set();
    this.rebuiltN = 0; this.crews = 0; this.campsSent = 0; this.sheltered = 0; this.hazSent = 0; this.cleanups = 0; this.jailBuses = 0; this.heroCalls = 0; this.villainsBeaten = 0;
    g.resetWorld(); g.setSpeed(1);
    this.t = 0; this.rp = START_RP; this.earned = 0; this.alert = 0; this.blocksInf = 0; this.fires = 0; this.ended = false;
    this.sel = null; this.cool = {}; for (const u of UNITS) this.cool[u.id] = 0;
    this.cdOf = (id) => id === 'police' ? this.diff.policeCd : id === 'fire' ? this.diff.fireCd : this.flooded() && FLOOD_CD[id] ? FLOOD_CD[id] : this.cards[id].u.cd;
    this.wasFlooded = false;
    if (g.helis) g.helis.reset();
    this.kills0 = 0; this.sent = 0; this.lost = 0; this.heatT = 0; this.callT = 30;
    this.out0 = 0; this.rescued0 = 0; this.trucks = 0; this.helisSent = 0; this.apcs = 0; this.strikes = 0; this.bombedCiv0 = 0; this.bombed0 = 0;
    this.buses = 0; this.bused0 = 0; this.boatsSent = 0; this.chasersSent = 0; this.seeds = 0; this.calledJets = 0; this.calledTanks = 0; this.jetAt = 0; this.tankAt = 0; this.chaseT = 0;
    if (this.tracers) { for (const tr of this.tracers) this.g.disasters.ctx.scene.remove(tr.m); this.tracers.length = 0; } g.disasters.boats.auto = false; this.nuked = false; this.nukeAt = null; this.nukedCiv0 = 0;
    this.lastCall = null; this.aim = null; this.scope.visible = false;
    for (const c of Object.values(this.cards)) c.btn.classList.remove('sel');
    // the weather this round (the people RNG restarts with every reset, so the round plan rolls its own dice)
    const R = Math.random;
    const lvl = this.pr.level, wPool = Object.keys(WEATHER_LEVEL).filter(w => lvl >= WEATHER_LEVEL[w]);
    this.weather = lvl < 2 || R() < 0.4 ? 'clear' : wPool[Math.floor(R() * wPool.length)];
    g.disasters.weather.set(this.weather, true);
    this.wxShift = wPool.length > 1 && R() < 0.35 ? 220 + R() * 140 : -1;
    // the incidents this round brings, drawn from what your level allows (zombie outbreaks turn up most)
    const bag = Object.keys(HAZARD_LEVEL).filter(h => lvl >= HAZARD_LEVEL[h]).concat(['zombies', 'zombies']), n = this.diff.incidents;
    this.incidents = [];
    for (let k = 0; k < n && bag.length; k++) {
      const type = bag[Math.floor(R() * bag.length)];
      for (let j = bag.length - 1; j >= 0; j--) if (bag[j] === type) bag.splice(j, 1);
      // each comes in by this time at the latest, or sooner once the city has gone quiet again
      this.incidents.push({ type, at: k === 0 ? 4 : 4 + k * 420 / Math.max(1, n - 1) * (0.85 + R() * 0.3), fired: false });
    }
    this.sites = []; this.quietT = 0; this.lastInc = 0;
    this.alertFloor = 0; this.saucers = 0; this.tripods = 0; this.arrests0 = 0; this.alienK0 = 0; this.riotsBroken = 0; this.hit = [];
    g.lookAt(0, 0);
    this.hud();
    g.toast('Dispatch is open. ' + (n === 1 ? 'One incident' : n + ' incidents') + ' expected this round: answer each call with your rescue units' + (this.weather !== 'clear' ? '. Weather: ' + WEATHER[this.weather].name.toLowerCase() : ''), 5000);
  }

  // an incident comes in: a zombie outbreak (one to three sites, seconds apart) or a disaster
  incident(inc) {
    const g = this.g, p = g.people;
    inc.fired = true; this.hit.push(inc.type); this.lastInc = this.t; this.quietT = 0;
    if (inc.type !== 'zombies') { g.disasters.start(inc.type); return; }
    const B = g.city.bounds, pts = [], R = Math.random; // well apart, away from the edge
    for (let tries = 0; tries < 200 && pts.length < this.diff.sites; tries++) {
      const x = B.x0 + 50 + R() * (B.x1 - B.x0 - 100), z = B.z0 + 50 + R() * (B.z1 - B.z0 - 100);
      const w = p.snapWalkable(x, z, 20);
      if (!w || pts.some(q => Math.hypot(q[0] - w[0], q[1] - w[1]) < 140)) continue;
      pts.push(w);
    }
    pts.forEach((w, k) => this.sites.push({ x: w[0], z: w[1], at: this.t + SITE_AT[k], fired: false }));
  }

  // nothing left to deal with: no disaster under way, no zombies or bitten, no buildings burning
  quiet() {
    const p = this.g.people;
    return !this.g.disasters.list.some(e => e.type !== 'heroes') && p.stats.zombies === 0 && p.stats.infected === 0 && this.fires === 0 && this.sites.every(s => s.fired);
  }

  // a 911 call or an incident: its name blinks with what to do, then waits in a chip above the bar; Show flies there
  // and the scope closes in on the search zone (jittered, so it is still a hunt). mark: show the scope straight away
  // without moving the camera (a target you picked yourself)
  report(x, z, text, radius, exact = false, name = 'Incident', mark = false) {
    const p = this.g.people;
    if (this.g.disasters.active('solar') && !exact) { radius *= 1.6; text = 'Static on the line... ' + text; } // the radio blackout garbles calls
    const a = p.r() * Math.PI * 2, jit = exact ? 0 : p.r() * radius * 0.45;
    const cx = x + Math.cos(a) * jit, cz = z + Math.sin(a) * jit, call = this.lastCall = { x: cx, z: cz, r: radius };
    const hint = text.replace(/^[^!:.]{1,24}[!:.]\s*/, ''); // the name is in the flash already
    this.g.alertFlash(name, hint, () => { this.g.lookAt(call.x, call.z, 330); this.aimAt(call); });
    if (mark) this.aimAt(call);
  }
  aimAt(c) { this.aim = { x: c.x, z: c.z, r: Math.max(18, c.r * 0.6), t: 0 }; this.scope.visible = true; }
  // the scope: wide and turning, it closes on the spot in a second, holds there pulsing, then fades
  scopeStep(dt) {
    const A = this.aim; if (!A) return;
    A.t += dt; const k = Math.min(1, A.t / 1.1), e = 1 - Math.pow(1 - k, 3), m = this.scope;
    m.position.set(A.x, 0.4, A.z); m.scale.setScalar(A.r * (4.5 - 3.5 * e)); m.rotation.y = (1 - e) * Math.PI * 0.75;
    this.scopeMat.opacity = Math.min(1, A.t * 4) * (A.t < 6 ? 0.8 + 0.2 * Math.sin(A.t * 9) : Math.max(0, 1 - (A.t - 6) / 1.2));
    if (A.t > 7.2) { this.aim = null; m.visible = false; }
  }

  district(x, z) {
    const B = this.g.city.bounds;
    const fx = (x - B.x0) / (B.x1 - B.x0), fz = (z - B.z0) / (B.z1 - B.z0);
    const ns = fz < 0.34 ? 'North' : fz > 0.66 ? 'South' : '', ew = fx < 0.34 ? 'West' : fx > 0.66 ? 'East' : '';
    return ns && ew ? ns + '-' + ew : ns || ew || 'Central';
  }

  select(id) {
    const c = this.cards[id];
    if (this.ended) return;
    if (this.sel === id) { this.sel = null; c.btn.classList.remove('sel'); return; }
    if (c.u.once && this.nuked) { this.g.toast('Only one nuke per round'); return; }
    if (this.rp < c.u.cost) { this.g.toast('Not enough points. ' + c.u.name + ' costs ' + c.u.cost); return; }
    if (this.alert < c.u.alert) { this.g.toast(c.u.name + ' needs alert level ' + c.u.alert); return; }
    if ((id === 'water' || id === 'rescue') && this.g.disasters.active('solar')) { this.g.toast('Helicopters are grounded by the solar storm'); return; }
    if (id === 'boat' && !this.g.disasters.boats.flooded) { this.g.toast('Rescue boats need flooded streets'); return; }
    if (id === 'coast' && !this.flooded()) { this.g.toast('The Coast Guard goes out once the streets flood'); return; }
    if (id === 'barrier' && !this.tsunami()) { this.g.toast('Flood barriers are for holding back a tsunami. Wait for a warning'); return; }
    if (GROUND.has(id) && this.flooded()) { this.g.toast('The streets are under water: nothing on wheels can get through. Send boats, helicopters or the heroes', 4000); return; }
    if (id === 'coast') { this.sendCoast(); return; } // no tap: they go where the most people are in the water
    for (const o of Object.values(this.cards)) o.btn.classList.remove('sel');
    this.sel = id; c.btn.classList.add('sel');
    this.g.toast(id === 'heroes' ? 'Tap where to shine the hero signal' : id === 'barrier' ? 'Tap a street ahead of the wave: the barrier goes up across its path' : id === 'build' ? 'Tap a fallen building to rebuild it' : id === 'camp' ? 'Tap where the medical camp should go' : id === 'hazmat' ? 'Tap the area to decontaminate' : 'Tap the map where the ' + c.u.name.toLowerCase() + ' should go');
  }

  tap(x, z) {
    if (this.ended) return;
    if (!this.sel) { this.g.toast('Pick a unit below, then tap the map'); return; }
    const id = this.sel;
    if (id === 'police') this.sendPolice(x, z);
    else if (id === 'fire') this.sendFire(x, z);
    else if (id === 'water') this.sendWater(x, z);
    else if (id === 'rescue') this.sendRescue(x, z);
    else if (id === 'apc') this.sendApc(x, z);
    else if (id === 'strike') this.sendStrike(x, z);
    else if (id === 'bus') this.sendBus(x, z);
    else if (id === 'nuke') this.sendNuke(x, z);
    else if (id === 'boat') this.sendBoat(x, z);
    else if (id === 'barrier') this.sendBarrier(x, z);
    else if (id === 'chaser') this.sendChaser(x, z);
    else if (id === 'seeder') this.sendSeeder(x, z, true);
    else if (id === 'build') this.sendBuild(x, z);
    else if (id === 'camp') this.sendCamp(x, z);
    else if (id === 'hazmat') this.sendHazmat(x, z);
    else if (id === 'heroes') { this.g.disasters.start('heroes', x, z); this.spend('heroes'); this.heroCalls++; }
  }

  // a construction crew to the nearest fallen building: it clears the rubble and builds it back up
  sendBuild(x, z) {
    const g = this.g, D = g.disasters, city = g.city;
    let best = -1, bd = 90;
    for (let k = 0; k < city.buildings.length; k++) {
      if (!city.dead[k] || this.buildTo.has(k) || this.works.some(w => w.k === k && w.alive)) continue;
      const b = city.buildings[k], d = Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) { g.toast('No fallen buildings near there to rebuild'); return; }
    const b = city.buildings[best], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (D.holeFloor(cx, cz) != null) { g.toast('The ground under that one is gone. Nothing can be built there'); return; }
    if (D.zones.at(cx, cz)) { g.toast('That ruin is inside a radiation zone. Send a hazmat team to clear it first', 4000); return; }
    const to = b.door || [cx, cz];
    this.buildTo.add(best);
    const car = g.traffic.dispatchTo(to[0], to[1], { kind: 'build',
      onArrive: (ax, az, truck) => { this.buildTo.delete(best); if (!city.dead[best]) { g.traffic.depart(truck); return; } this.works.push(new Site(D, best, { car: truck, onDone: (s) => this.rebuilt(s) })); g.toast('Construction crew at work in the ' + this.district(cx, cz) + ': clearing the rubble first'); },
      onLost: () => { this.buildTo.delete(best); this.lost++; g.toast('A construction truck was wrecked on the way'); } });
    if (!car) { this.buildTo.delete(best); g.toast('No road to that spot'); return; }
    this.spend('build'); this.crews++;
    g.toast('Construction crew rolling, about ' + Math.ceil(car.eta) + ' s out');
  }
  rebuilt(s) {
    const g = this.g; this.rebuiltN++; this.rp += 60; this.earned += 60;
    g.toast('A building in the ' + this.district(s.cx, s.cz) + ' is rebuilt', 3000);
    if (s.car && !s.car.gone) g.traffic.depart(s.car);
  }
  // a medical camp: tents go up and people from the streets around are brought in and kept safe
  sendCamp(x, z) {
    const g = this.g, w = this.campSpot(x, z) || g.people.snapWalkable(x, z, 30);
    if (!w) { g.toast('No open ground there for a camp'); return; }
    if (this.camps.some(c => c.alive && Math.hypot(c.x - w[0], c.z - w[1]) < 40)) { g.toast('There is already a medical camp there'); return; }
    const car = g.traffic.dispatchTo(w[0], w[1], { kind: 'medic',
      onArrive: (ax, az, amb) => { const c = new Camp(g.disasters, w[0], w[1], { minT: 90 }); c.car = amb; this.camps.push(c); g.toast('Medical camp open in the ' + this.district(w[0], w[1]) + '. People nearby are being brought in'); },
      onLost: () => { this.lost++; g.toast('The ambulance was wrecked on the way'); } });
    if (!car) { g.toast('No road to that spot'); return; }
    this.spend('camp'); this.campsSent++;
    g.toast('Ambulance on its way to set up a camp, about ' + Math.ceil(car.eta) + ' s out');
  }
  // open ground for the tents near (x, z): walkable with nothing built within 10 m, a park or a square rather than a road
  campSpot(x, z) { return campSpot(this.g.people, this.g.city, x, z); }
  // a hazmat clean-up where the truck parks: radiation, people with a dose, burning wrecks
  sendHazmat(x, z) {
    const g = this.g;
    const car = g.traffic.dispatchTo(x, z, { kind: 'hazmat',
      onArrive: (ax, az, truck) => { this.hazmats.push(new Hazmat(g.disasters, ax, az, { onDone: (hz) => this.cleaned(hz, truck) })); g.toast('Hazmat team suiting up in the ' + this.district(ax, az)); },
      onLost: () => { this.lost++; g.toast('The hazmat truck was wrecked on the way'); } });
    if (!car) { g.toast('No road to that spot'); return; }
    this.spend('hazmat'); this.hazSent++;
    g.toast('Hazmat team rolling, about ' + Math.ceil(car.eta) + ' s out');
  }
  cleaned(hz, truck) {
    const g = this.g, bonus = 40 + hz.cleaned * 2; this.rp += bonus; this.earned += bonus; this.cleanups++;
    g.toast(hz.zones ? 'Hazmat: radiation cleared here. Construction can start' : hz.cleaned ? 'Hazmat: ' + hz.cleaned + ' people decontaminated' : 'Hazmat: the area is clean', 3500);
    if (truck && !truck.gone) g.traffic.depart(truck);
  }
  // work sites, camps and clean-ups; a camp closes once no rebuilding is going on near it and it is safe
  worksTick(sdt) {
    const g = this.g, p = g.people;
    for (const w of this.works) w.update(sdt);
    for (const hz of this.hazmats) hz.update(sdt);
    for (const c of this.camps) {
      if (!c.alive) continue;
      c.update(sdt);
      const busy = this.buildTo.size > 0 || this.works.some(w => w.alive && Math.hypot(w.cx - c.x, w.cz - c.z) < 320);
      if (c.t > c.minT && !busy && p.zombiesNear(c.x, c.z, 70) === 0) {
        const n = c.close(); this.sheltered += Math.max(c.peak, n); this.rp += 2 * n; this.earned += 2 * n;
        g.toast(n ? 'Rebuilding done: the medical camp is sending ' + n + ' people home' : 'The medical camp is packing up', 3500);
        if (c.car && !c.car.gone) g.traffic.depart(c.car);
      }
    }
    this.works = this.works.filter(w => w.alive); this.hazmats = this.hazmats.filter(h => h.alive); this.camps = this.camps.filter(c => c.alive);
  }
  // rioters in custody: a police bus comes for them and takes them out of the area
  custodyTick() {
    const g = this.g;
    custodyBuses(g, (x, z) => this.district(x, z), () => { this.jailBuses++; if (this.jailBuses === 1) g.toast('A police bus is on its way to take the arrested rioters away', 3500); });
  }

  sendPolice(x, z) {
    const g = this.g, c = this.cards.police;
    const car = g.traffic.dispatchTo(x, z, {
      onArrive: (ax, az) => {
        g.people.spawnOfficers(ax, az, this.pr.has('squad4') ? 4 : 2);
        const up = this.tsunami() ? g.people.alarmAt(ax, az, 90) : 0; // a wave coming: they get everyone round them up onto the roofs
        g.toast(up ? 'Officers in the ' + this.district(ax, az) + ' are getting ' + up + ' people up onto the rooftops' : 'Officers on scene in the ' + this.district(ax, az));
      },
      onLost: () => { this.lost++; g.toast('A cruiser was wrecked on the way'); },
    });
    if (!car) { g.toast(g.traffic.missions.filter(m => !m.gone).length >= 24 ? 'All cruisers are out' : 'No road to that spot'); return; }
    this.spend('police'); this.sent++;
    g.toast('Cruiser dispatched, about ' + Math.ceil(car.eta) + ' s out');
  }

  sendChaser(x, z) {
    const g = this.g;
    const car = g.traffic.dispatchTo(x, z, { kind: 'chaser', onArrive: (ax, az) => g.toast('Storm chasers on station in the ' + this.district(ax, az) + '. They will call in what they spot'), onLost: () => { this.lost++; g.toast('A storm chaser truck was wrecked'); } });
    if (!car) { g.toast('No road to that spot'); return; }
    this.spend('chaser'); this.chasersSent++;
    g.toast('Storm chasers rolling, about ' + Math.ceil(car.eta) + ' s out');
  }
  // a seeding run over (x, z): tornadoes nearby lose strength (a weak one ropes out), a thunderstorm breaks up into rain, rain into clear skies
  sendSeeder(x, z, paid) {
    const g = this.g;
    if (paid) { this.spend('seeder'); this.seeds++; g.toast('Cloud seeder inbound, about ' + Math.ceil(800 / 55) + ' s out'); }
    g.helis.seed(x, z, { onSeed: (sx, sz) => this.seeded(sx, sz) });
  }
  seeded(x, z) {
    const g = this.g, { hit, w } = seedEffect(g.disasters, x, z);
    g.toast(hit ? 'Seeding run complete: the tornado is losing strength' : w === 'storm' ? 'Seeding run complete: the storm is breaking up into rain' : 'Seeding run complete', 3500);
  }
  // storm chasers on station: what they see, they call in
  chaserTick() {
    const g = this.g, D = g.disasters, now = this.t;
    const chasers = g.traffic.missions.filter(c => c.kind === 'chaser' && !c.gone && (c.mode === 3 || c.mode === 0));
    if (!chasers.length && !g.traffic.missions.some(c => c.kind === 'tank')) return;
    const near = (x, z, R) => chasers.find(c => Math.hypot(c.x - x, c.z - z) < R);
    for (const e of D.list) if (e.type === 'tornado' && e.tw && e.tw.onGround) {
      const c = near(e.tw.x, e.tw.z, 280);
      if (c && now > (e.seedAt || 0)) { e.seedAt = now + 18; this.sendSeeder(e.tw.x, e.tw.z, false); this.report(e.tw.x, e.tw.z, 'Storm chasers: "Tornado on the ground! Calling in a seeding run"', 40, true, 'Tornado'); }
    }
    const inv = D.list.find(e => e.type === 'aliens');
    const targets = [];
    if (inv) {
      for (const t of inv.tripods) if (t.state === 'walk') targets.push({ x: t.x, z: t.z, t });
      for (const s of inv.saucers) if ((s.state === 'cruise' || s.state === 'act') && s.y < 80) targets.push({ x: s.x, z: s.z, s });
    }
    for (const tg of targets) {
      const c = near(tg.x, tg.z, 300); if (!c) continue;
      const o = tg.t || tg.s;
      if (!o.spotted) { o.spotted = true; this.report(tg.x, tg.z, 'Storm chasers: "' + (tg.t ? 'A tripod' : 'A saucer') + ' in the ' + this.district(tg.x, tg.z) + '! Calling it in to the army"', 45, true, tg.t ? 'Tripod' : 'Saucer'); }
      if (now > (this.jetAt || 0)) { this.jetAt = now + 12; g.helis.strike(tg.x, tg.z, { radius: 25 }); this.calledJets++; } // an A-10 on the spot
      if (tg.t && now > (this.tankAt || 0) && g.traffic.missions.filter(m => m.kind === 'tank' && !m.gone).length < 3) {
        const car = g.traffic.dispatchTo(tg.x, tg.z, { kind: 'tank', onArrive: () => g.toast('A tank is in position and engaging') });
        if (car) { this.tankAt = now + 30; this.calledTanks++; g.toast('The army is sending a tank, about ' + Math.ceil(car.eta) + ' s out', 3000); }
      }
    }
    // tanks shell whatever alien is in range
    for (const tk of g.traffic.missions) {
      if (tk.kind !== 'tank' || tk.gone || (tk.fireT = (tk.fireT || 0) - 1) > 0) continue;
      let best = null, bd = 160;
      for (const tg of targets) { const d = Math.hypot(tg.x - tk.x, tg.z - tk.z); if (d < bd) { bd = d; best = tg; } }
      if (!best) continue;
      tk.fireT = 3;
      const o = best.t || best.s, y = best.t ? o.y : o.y;
      this.tracer(tk.x, 3, tk.z, best.x, y, best.z);
      g.fire.burst(best.x, y, best.z, 12, 2.2);
      if (best.t) o.damage(14); else { o.hp -= 20; if (o.hp <= 0) inv.shootDown(o); }
    }
  }
  tracer(x0, y0, z0, x1, y1, z1) {
    const s = this.g.disasters.ctx.scene;
    if (!this.trGeo) { this.trGeo = new THREE.CylinderGeometry(0.25, 0.25, 1, 5, 1, true).translate(0, 0.5, 0); this.trMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.2), fog: false }); this.tracers = []; }
    const m = new THREE.Mesh(this.trGeo, this.trMat), d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
    m.position.set(x0, y0, z0); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); m.scale.set(1, d.length(), 1);
    s.add(m); this.tracers.push({ m, t: 0.15 });
    this.g.fire.burst(x0, y0, z0, 6, 1.4);
  }

  sendBoat(x, z) {
    const g = this.g, big = this.boatsSent % 2 === 1;
    const b = g.disasters.boats.send(x, z, { kind: big ? 'patrol' : 'speed', onArrive: () => g.toast('The rescue boat is pulling people out of the water in the ' + this.district(x, z)), onFull: (bt) => g.toast('Rescue boat heading out with ' + bt.load + ' aboard') });
    if (!b) { g.toast('No flooded street leads there'); return; }
    this.spend('boat'); this.boatsSent++;
    g.toast((big ? 'Patrol boat' : 'Speedboat') + ' on its way through the flooded streets');
  }

  flooded() { return this.g.disasters.boats.flooded; }
  tsunami() { return this.g.disasters.list.find(e => e.type === 'tsunami' && e.alive && (e.phase === 'warn' || e.phase === 'wave')); }
  // the Coast Guard all at once: three boats and two rescue helicopters to the worst spots in the water across the city
  sendCoast() {
    const g = this.g, D = g.disasters, spots = g.people.swimSpots(5);
    if (!spots.length) { const s = D.boats.stranded(); if (s) spots.push([s[0], s[1], 0]); }
    if (!spots.length) { g.toast('Nobody is stranded in the water right now'); return; }
    let boats = 0;
    for (let i = 0; i < 3; i++) { const s = spots[i % spots.length]; if (D.boats.send(s[0] + i * 6, s[1], { kind: i === 1 ? 'patrol' : 'speed' })) boats++; }
    for (let i = 0; i < 2; i++) { const s = spots[i % spots.length]; g.helis.send('rescue', s[0] + i * 12, s[1], { k: -1, onDone: (n) => { if (n) g.toast('Coast Guard helicopter leaving with ' + n + ' pulled from the water', 3000); } }); }
    this.spend('coast'); this.boatsSent += boats; this.helisSent += 2;
    g.toast('Coast Guard launched: ' + boats + ' boats and 2 helicopters heading for the people in the water', 4000);
  }
  // an inflatable barrier across the tsunami's path at (x, z): it holds that stretch of the wave back for a while
  sendBarrier(x, z) {
    const g = this.g, T = this.tsunami();
    if (!T) { g.toast('No tsunami is coming'); return; }
    const b = g.disasters.barriers.place(x, z, T);
    if (!b) { g.toast('The wave is already there. Put the barrier further ahead of it'); return; }
    this.spend('barrier'); this.barriersUp = (this.barriersUp || 0) + 1;
    g.toast('Flood barrier inflating in the ' + this.district(b.x, b.z) + '. It will hold that stretch of the wave back for a while', 4000);
  }

  spend(id) {
    const c = this.cards[id];
    this.rp -= c.u.cost; this.cool[id] = c.u.once ? this.cdOf(id) : 0; // send another straight away if the points are there
    if (this.rp < c.u.cost || c.u.once) { this.sel = null; c.btn.classList.remove('sel'); } // still picked: tap the map again for another
  }

  sendFire(x, z) {
    const g = this.g, p = g.people;
    const fires = g.fire.firesWithin(x, z, 80);
    let to = [x, z];
    if (fires.length) { const b = p.bld[fires[0]]; to = b.door || [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]; }
    const car = g.traffic.dispatchTo(to[0], to[1], {
      kind: 'fire',
      onArrive: (ax, az) => { p.spawnFirefighters(ax, az, 2); g.toast('Fire crew on scene in the ' + this.district(ax, az)); },
      onLost: () => { this.lost++; g.toast('The fire truck was wrecked on the way'); },
    });
    if (!car) { g.toast('No fire truck available'); return; }
    this.spend('fire'); this.trucks++;
    g.toast((fires.length ? 'Fire truck rolling to the blaze, about ' : 'No fire there yet. Truck will stand by, about ') + Math.ceil(car.eta) + ' s out');
  }

  sendWater(x, z) {
    const g = this.g;
    if (this.flooded()) { // over flood water it drops life rafts: people afloat swim to them and hang on until a boat comes
      const hl = g.helis.send('water', x, z, { onDrop: (dx, dz) => { const n = g.disasters.boats.dropRafts(dx, dz); g.toast(n ? 'Life rafts in the water: ' + n + ' people are holding on' : 'Life rafts dropped, but nobody was in the water there', 3500); } });
      this.spend('water'); this.helisSent++;
      g.toast('Helicopter inbound with life rafts, ' + Math.ceil(hl.eta) + ' s out'); return;
    }
    const fires = g.fire.firesWithin(x, z, 40).length;
    const hl = g.helis.send('water', x, z, {});
    this.spend('water'); this.helisSent++;
    g.toast((fires ? 'Water helicopter inbound, ' : 'No fire under that spot. Helicopter will soak the area, ') + Math.ceil(hl.eta) + ' s out');
  }

  sendRescue(x, z) {
    const g = this.g, p = g.people;
    let n = 0, sx = 0, sz = 0; p.around(x, z, 45, (j) => { if (p.st[j] === ST.SWIM) { n++; sx += p.x[j]; sz += p.z[j]; } });
    if (n) { // people in the water there: it winches them out one by one
      const hl = g.helis.send('rescue', sx / n, sz / n, { k: -1, onDone: (m) => g.toast(m ? 'Rescue helicopter leaving with ' + m + ' pulled from the water' : 'Rescue helicopter found nobody left in the water') });
      this.spend('rescue'); this.helisSent++;
      g.toast('Rescue helicopter inbound to ' + n + ' people in the water, ' + Math.ceil(hl.eta) + ' s out'); return;
    }
    let best = 0, bk = -1;
    p.bld.forEach((b, k) => {
      if (!p.bRoof[k]) return;
      const d = Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z);
      if (d <= 90 && p.bRoof[k] - d * 0.05 > best) { best = p.bRoof[k] - d * 0.05; bk = k; }
    });
    if (bk < 0) { g.toast('Nobody is on a rooftop near there'); return; }
    const b = p.bld[bk], rf = b.roof;
    const hl = g.helis.send('rescue', (rf.x0 + rf.x1) / 2, (rf.z0 + rf.z1) / 2, { k: bk, onDone: (n) => g.toast(n ? 'Rescue helicopter leaving with ' + n + ' survivors' : 'Rescue helicopter found nobody left to lift') });
    this.spend('rescue'); this.helisSent++;
    g.toast('Rescue helicopter inbound to a roof with ' + p.bRoof[bk] + ' people, ' + Math.ceil(hl.eta) + ' s out');
  }

  sendApc(x, z) {
    const g = this.g, p = g.people;
    const car = g.traffic.dispatchTo(x, z, {
      kind: 'apc',
      onArrive: (ax, az) => { p.spawnOfficers(ax, az, 8, 3); g.toast('Squad deployed. They are holding the crossing in the ' + this.district(ax, az)); },
      onLost: () => { this.lost++; g.toast('The APC was lost on the way'); },
    });
    if (!car) { g.toast('No APC available'); return; }
    this.spend('apc'); this.apcs++;
    g.toast('APC rolling, about ' + Math.ceil(car.eta) + ' s out');
  }

  sendStrike(x, z) {
    const g = this.g;
    const jet = g.helis.strike(x, z, { radius: 25, onBlast: (bx, bz) => { if (g.camera.position.distanceTo(g.controls.target) < 500) g.shake = Math.max(g.shake, 1); } });
    this.spend('strike'); this.strikes++;
    // mark the target for the player
    this.report(x, z, 'Airstrike inbound. Impact in ' + Math.ceil(jet.eta) + ' s. Clear the area!', 25, true, 'Airstrike', true);
    this.lastCall = { x, z };
  }

  sendBus(x, z) {
    const g = this.g, p = g.people;
    const car = g.traffic.dispatchTo(x, z, {
      kind: 'bus',
      onArrive: (ax, az, bus) => {
        bus.cap = this.pr.has('bigbus') ? 45 : 30; bus.loadT = 0; bus.loaded = 0; bus.called = p.callToBus(ax, az, bus.cap > 30 ? 55 : 45, bus.cap, bus.id);
        g.toast(bus.called ? 'Bus loading in the ' + this.district(ax, az) + '. ' + bus.called + ' people running for it' : 'Bus arrived but nobody is around to board');
        if (!bus.called) { bus.loadT = 20; }
      },
      onLost: (bus) => { this.lost++; p.releaseBus(bus.id); g.toast('The evacuation bus was wrecked'); },
      onGone: (bus) => { g.toast('Bus clear of the city with ' + bus.loaded + ' aboard'); },
    });
    if (!car) { g.toast('No bus available'); return; }
    this.spend('bus'); this.buses++;
    g.toast('Evacuation bus rolling, about ' + Math.ceil(car.eta) + ' s out');
  }

  sendNuke(x, z) {
    const g = this.g;
    this.nuked = true; this.nukeAt = { x, z };
    const jet = g.helis.nuke(x, z, { radius: 230, onBlast: (bx, bz) => { g.flash = 1.6; g.shake = 2.5; } });
    this.spend('nuke');
    this.report(x, z, 'NUCLEAR STRIKE AUTHORISED. Impact in ' + Math.ceil(jet.eta) + ' s. Get everyone out!', 150, true, 'Nuke', true);
    this.lastCall = { x, z };
    g.toast('B-2 inbound. ' + Math.ceil(jet.eta) + ' seconds to detonation', 5000);
  }

  busTick(sdt) {
    const g = this.g, p = g.people;
    for (const bus of g.traffic.missions) {
      if (bus.kind !== 'bus' || bus.mode !== 3 || bus.leaving) continue;
      bus.loadT += sdt;
      const zn = p.zombiesNear(bus.x, bus.z, 10);
      if (zn >= 4 && bus.loadT > 3) { p.releaseBus(bus.id); g.toast('Bus swarmed! Leaving with ' + bus.loaded + ' aboard'); g.traffic.depart(bus); continue; }
      if (bus.loaded >= (bus.cap || 30) || bus.loadT >= ((bus.cap || 30) > 30 ? 35 : 25)) { p.releaseBus(bus.id); g.traffic.depart(bus); }
    }
  }

  onEvent(e) {
    if (e.type === 'bite' && e.officer && !this.g.seen.copbit) { this.g.seen.copbit = true; this.g.toast(MSGS.copbit, 3200); }
    if (e.type === 'boarded') { const bus = this.g.traffic.cars[e.bus]; if (bus) bus.loaded = (bus.loaded || 0) + 1; }
    if (e.type === 'saucerdown') { this.saucers++; this.rp += 500; this.earned += 500; }
    if (e.type === 'tripoddown') { this.tripods = (this.tripods || 0) + 1; this.rp += 800; this.earned += 800; }
    if (e.type === 'riotend' && e.broken) { this.riotsBroken++; this.rp += 100; this.earned += 100; }
    if (e.type === 'villainbeaten') { this.villainsBeaten++; this.rp += 300; this.earned += 300; }
    if (e.type === 'warn') {
      if (e.hazard === 'villains' && !this.ended) setTimeout(() => this.g.toast(this.cards.heroes ? 'Only the super heroes can beat them: use the Hero signal' : 'Police cannot stop them. Hold out until they leave', 4500), 4500);
      this.alertFloor = Math.max(this.alertFloor, e.hazard === 'aliens' || e.hazard === 'volcano' || e.hazard === 'meteor' || e.hazard === 'nuclear' || e.hazard === 'meltdown' || e.hazard === 'blackhole' || e.hazard === 'kaiju' || e.hazard === 'worm' ? 3 : e.hazard === 'riot' ? 1 : 2); // disasters open up the units you need
      if (e.x != null && !this.ended) { this.report(e.x, e.z, e.text, e.r || 60, e.exact, e.hazard ? threatName(e.hazard) : 'Incident'); return true; }
    }
  }

  // zombies per street block; a block with 3+ is infected
  heat() {
    const p = this.g.people, { sx, sz, NB } = this.g.city;
    const cnt = new Int16Array(NB * NB);
    for (let i = 0; i < p.active; i++) {
      const s = p.st[i];
      if (s !== ST.ZOMBIE && s !== ST.TURNING && s !== ST.PILE && s !== ST.CLIMB) continue;
      let bx = -1, bz = -1;
      for (let k = 0; k < NB; k++) { if (p.x[i] >= sx[k] && p.x[i] < sx[k + 1]) bx = k; if (p.z[i] >= sz[k] && p.z[i] < sz[k + 1]) bz = k; }
      if (bx >= 0 && bz >= 0) cnt[bz * NB + bx]++;
    }
    let n = 0; for (let k = 0; k < cnt.length; k++) if (cnt[k] >= 5) n++;
    this.blocksInf = n;
    let f = 0; for (const v of this.g.fire.bFire) if (v === 1) f++;
    this.fires = f;
    let a = 0;
    if (p.stats.zombies > 0 || n > 0) a = 1;
    if (n >= 2 || f > 0) a = 2;
    if (n >= 5) a = 3;
    if (n >= 10) a = 4;
    a = Math.max(a, this.alertFloor);
    if (a > this.alert) {
      this.alert = a;
      if (a >= 2) this.g.toast('Alert raised: ' + ALERTS[a] + (n ? ' · ' + n + ' blocks overrun' : ''), 3500);
    }
  }

  phase() { return (this.t / ROUND) % 1; }

  update(sdt, dt = sdt) {
    this.scopeStep(dt); // on the real clock: it closes in while paused too
    if (this.ended) return;
    const g = this.g, p = g.people;
    this.t += sdt;
    for (const o of this.sites) {
      if (o.fired || this.t < o.at) continue;
      o.fired = true;
      p.infectAt(o.x, o.z, this.diff.seeds);
      this.report(o.x, o.z, '911 · ' + this.district(o.x, o.z) + ': "someone is biting people!"', 70, false, 'Zombies');
    }
    // the next incident: on schedule, or early once the city has been quiet for a while
    this.quietT = this.quiet() ? this.quietT + sdt : 0;
    const next = this.incidents.find(i => !i.fired);
    if (next && (this.t >= next.at || (this.quietT > 12 && this.t > this.lastInc + 40))) this.incident(next);
    if (this.wxShift > 0 && this.t >= this.wxShift) {
      this.wxShift = -1;
      const pool = Object.keys(WEATHER_LEVEL).filter(w => this.pr.level >= WEATHER_LEVEL[w] && w !== this.weather);
      this.weather = pool[Math.floor(p.r() * pool.length)]; g.disasters.weather.set(this.weather);
      g.toast('The weather is turning: ' + WEATHER[this.weather].name.toLowerCase(), 3500);
    }
    const income = (1 + p.stats.humans / 2000) * sdt;
    this.rp += income; this.earned += income;
    const k = p.stats.shot; if (k > this.kills0) { this.rp += k - this.kills0; this.earned += k - this.kills0; this.kills0 = k; }
    const fo = g.fire.stats.out; if (fo > this.out0) { this.rp += 30 * (fo - this.out0); this.earned += 30 * (fo - this.out0); this.out0 = fo; }
    const rs = p.stats.rescued; if (rs > this.rescued0) { this.rp += 3 * (rs - this.rescued0); this.earned += 3 * (rs - this.rescued0); this.rescued0 = rs; }
    const ar = p.stats.arrests; if (ar > this.arrests0) { this.rp += 3 * (ar - this.arrests0); this.earned += 3 * (ar - this.arrests0); this.arrests0 = ar; }
    const ak = p.stats.aliensKilled; if (ak > this.alienK0) { this.rp += 10 * (ak - this.alienK0); this.earned += 10 * (ak - this.alienK0); this.alienK0 = ak; }
    const bz = p.stats.bombed; if (bz > this.bombed0) { this.rp += bz - this.bombed0; this.earned += bz - this.bombed0; this.bombed0 = bz; }
    const bc = p.stats.bombedCiv; if (bc > this.bombedCiv0) { this.rp -= 5 * (bc - this.bombedCiv0); this.earned -= 5 * (bc - this.bombedCiv0); this.bombedCiv0 = bc; g.toast('Your airstrike killed ' + bc + ' civilians so far', 3500); }
    this.busTick(sdt);
    if ((this.chaseT -= sdt) <= 0) { this.chaseT = 1; this.chaserTick(); this.custodyTick(); }
    this.worksTick(sdt);
    if (this.tracers) for (let i = this.tracers.length - 1; i >= 0; i--) { const tr = this.tracers[i]; if ((tr.t -= sdt) <= 0) { this.g.disasters.ctx.scene.remove(tr.m); this.tracers.splice(i, 1); } }
    const bu = p.stats.bused; if (bu > this.bused0) { this.rp += 3 * (bu - this.bused0); this.earned += 3 * (bu - this.bused0); this.bused0 = bu; }
    const nc = p.stats.nukedCiv; if (nc > this.nukedCiv0) { this.rp -= 5 * (nc - this.nukedCiv0); this.earned -= 5 * (nc - this.nukedCiv0); this.nukedCiv0 = nc; g.toast('The nuke killed ' + nc + ' civilians', 5000); }
    if (this.rp < 0) this.rp = 0; // penalties cost score, never lock the cards
    for (const id in this.cool) if (this.cool[id] > 0) this.cool[id] = Math.max(0, this.cool[id] - sdt);
    const fl = this.flooded();
    if (fl && !this.wasFlooded) { for (const id in FLOOD_CD) if (this.cool[id] > FLOOD_CD[id]) this.cool[id] = FLOOD_CD[id]; g.toast('The streets are flooding. The Coast Guard and air rescue are on full alert: boats and rescue helicopters can go out back to back', 4500); }
    this.wasFlooded = fl;

    this.heatT += sdt;
    if (this.heatT >= 1) { this.heatT = 0; this.heat(); }
    // the switchboard: every so often a caller reports where they saw one
    this.callT -= sdt;
    if (this.callT <= 0 && p.stats.zombies > 0 && this.sites.length && this.sites.every(s => s.fired)) {
      this.callT = 15 + p.r() * 10;
      const zs = []; for (let i = 0; i < p.active; i++) if (p.st[i] === ST.ZOMBIE && p.lvl[i] === -1) zs.push(i);
      if (zs.length) { const i = zs[Math.floor(p.r() * zs.length)]; this.report(p.x[i], p.z[i], '911 · ' + this.district(p.x[i], p.z[i]) + ': "' + CALLS[Math.floor(p.r() * CALLS.length)] + '"', 55, false, 'Zombie sighting'); }
    }
    // end of round
    const hum = p.stats.humans, tot = p.nHuman;
    if (!next && this.t > this.lastInc + 30 && this.quietT > 3) this.finish('contained');
    else if (hum < tot * 0.2) this.finish('lost');
    else if (this.t >= ROUND) this.finish('holdout');
    this.hud();
  }

  hud() {
    const p = this.g.people, s = p.stats, e = this.el;
    e.h.textContent = s.humans; e.z.textContent = s.zombies; e.d.textContent = s.dead;
    e.rp.textContent = Math.floor(this.rp);
    e.inc.textContent = this.incidents.filter(i => i.fired).length + '/' + this.incidents.length;
    e.alert.textContent = this.alert ? 'Alert ' + this.alert + ' · ' + ALERTS[this.alert] : ALERTS[0];
    e.alertPill.className = 'zd-pill zd-al a' + this.alert;
    const left = Math.max(0, ROUND - this.t), m = Math.floor(left / 60), sec = Math.floor(left % 60);
    e.clock.textContent = m + ':' + String(sec).padStart(2, '0');
    for (const c of Object.values(this.cards)) {
      const cd = this.cool[c.u.id];
      c.cd.style.height = cd > 0 ? (100 * cd / this.cdOf(c.u.id)) + '%' : '0';
      const id = c.u.id, wet = this.flooded(), cant = (GROUND.has(id) && wet) || ((id === 'coast' || id === 'boat') && !wet) || (id === 'barrier' && !this.tsunami());
      c.btn.classList.toggle('off', (c.u.once && this.nuked) || this.rp < c.u.cost || this.alert < c.u.alert || cant);
      if (c.u.once) c.cd.style.height = '0';
    }
  }

  finish(reason) {
    this.ended = true;
    const g = this.g, p = g.people, s = p.stats, tot = p.nHuman;
    let intact = 0; for (const v of g.fire.bFire) if (!v) intact++;
    const score = Math.round(this.earned + 10 * (s.humans + s.rescued + s.bused) + 20 * intact);
    const frac = (s.humans + s.rescued + s.bused) / tot;
    let stars = 0;
    if (reason === 'contained') stars = frac >= 0.9 ? 3 : 2;
    else if (reason === 'holdout') stars = frac >= 0.7 ? 2 : 1;
    if (this.nuked) stars = Math.min(stars, 1);
    const title = reason === 'contained' ? 'City secured' : reason === 'holdout' ? 'The city held out' : 'The city is lost';
    const sub = reason === 'contained' ? 'Every incident is under control. The city owes you a drink.' : reason === 'holdout' ? 'Ten minutes survived. The army arrives at dawn.' : 'Too many lives were lost.';
    const t = Math.floor(this.t);
    const lines = [
      ['Survivors', s.humans.toLocaleString() + ' of ' + tot.toLocaleString()],
      ['Dead', s.dead.toLocaleString()],
      ['Zombies shot by police', s.shot.toLocaleString()],
      ['Cruisers and trucks sent / wrecked', (this.sent + this.trucks) + ' / ' + this.lost],
      ['Helicopters sent', this.helisSent],
      ['APCs / airstrikes', this.apcs + ' / ' + this.strikes],
      ...(this.chasersSent || this.seeds ? [['Storm chasers / seeding runs', this.chasersSent + ' / ' + this.seeds], ['Jets / tanks called in', this.calledJets + ' / ' + this.calledTanks]] : []),
      ['Killed by bombs: zombies / civilians', s.bombed + ' / ' + s.bombedCiv],
      ['Rescued by helicopter or boat', s.rescued.toLocaleString()],
      ['Evacuated by bus', s.bused.toLocaleString()],
      ['Nuke: zombies / civilians', this.nuked ? s.nukedZ + ' / ' + s.nukedCiv : 'not used'],
      ['Fires put out', g.fire.stats.out],
      ['Buildings burned or destroyed', (g.fire.bFire.length - intact).toLocaleString()],
      ...(this.weather !== 'clear' ? [['Weather', WEATHER[this.weather].name]] : []),
      ['Incidents', this.hit.map(threatName).join(', ') || 'none'],
      ...(this.hit.some(h => h !== 'zombies') ? [['Killed by disasters', (s.disasterCiv + s.drowned).toLocaleString()]] : []),
      ...(s.arrests ? [['Rioters arrested / taken away', s.arrests + ' / ' + s.jailed]] : []),
      ...(this.heroCalls || this.hit.includes('villains') ? [['Hero signals / villains beaten', this.heroCalls + ' / ' + this.villainsBeaten]] : []),
      ...(this.crews || this.campsSent || this.hazSent ? [['Buildings rebuilt', this.rebuiltN], ['Sheltered in camps / bites treated', this.sheltered + ' / ' + s.treated], ['Hazmat clean-ups', this.cleanups]] : []),
      ...(this.hit.includes('aliens') ? [['Saucers / tripods downed', this.saucers + ' / ' + (this.tripods || 0)], ['Aliens killed', s.aliensKilled], ['Abducted', s.abducted]] : []),
      ['Time', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')],
    ];
    const r = this.pr.addRound(score, stars);
    const here = placeKey(), at = PATH.indexOf(here), opened = stars >= 2 ? this.pr.clear('commander', here) : null, nextKey = PATH[at + 1], nextOpen = at >= 0 && nextKey && at + 1 <= this.pr.reach('commander');
    const road = at < 0 ? '' : opened ? '<div class="lvl">New town open: ' + PLACES[opened].name + '</div>' : nextKey && !nextOpen ? '<div class="xp">Win with two stars to open ' + PLACES[nextKey].name + '</div>' : '';
    const xpLine = '<div class="xp">+' + r.xp.toLocaleString() + ' XP · level ' + r.level + (this.pr.nextXp ? ' · ' + (this.pr.nextXp - this.pr.xp).toLocaleString() + ' to next' : '') + '</div>' +
      (r.levelUp ? '<div class="lvl">Level up! Commander level ' + r.level + this.g.nextUnlockText(r.level) + '</div>' : '');
    g.endScreen(this.end, '<h2>' + title + '</h2><div>' + sub + '</div>' +
      '<div class="stars">' + '★'.repeat(stars) + '<span>' + '★'.repeat(3 - stars) + '</span></div>' +
      '<div class="score">Score ' + score.toLocaleString() + '</div>' + xpLine + road, lines,
      (nextOpen ? '<button class="zd-btn go" type="button" id="zd-next">On to ' + PLACES[nextKey].name + '</button>' : '') + '<button class="zd-btn' + (nextOpen ? '' : ' go') + '" type="button" id="zd-again">Play again</button><button class="zd-btn" type="button" id="zd-tomenu" style="background:rgba(28,20,12,.9);border-color:rgba(255,236,200,.25)">Menu</button>');
    this.end.querySelector('#zd-again').onclick = () => { if (r.levelUp) { location.href = location.pathname + '?mode=commander'; return; } this.start(); };
    this.end.querySelector('#zd-tomenu').onclick = () => { location.href = location.pathname; };
    if (nextOpen) this.end.querySelector('#zd-next').onclick = () => this.g.journey(nextKey);
    this.end.hidden = false;
    g.setSpeed(1);
  }
}
