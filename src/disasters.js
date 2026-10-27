// Disaster manager: runs every hazard (tornado, earthquake, flood, tsunami,
// riot, alien invasion), the weather, debris and ground marks, and the shared
// pieces they need: tearing down buildings, lightning strikes, warnings.
import * as THREE from 'three';
import { Debris, Decals } from './debris.js';
import { Weather, WEATHER } from './weather.js';
import { Twister } from './twister.js';
import { Quake } from './quake.js';
import { WaterSurface, Flood, Tsunami, Splash } from './water.js';
import { Riot } from './riot.js';
import { Invasion } from './aliens.js';
import { Meteor, Sinkhole } from './impact.js';
import { Volcano } from './volcano.js';
import { Haboob, ColdWave } from './fronts.js';
import { SolarStorm } from './solar.js';
import { BlackHole } from './blackhole.js';
import { Boats } from './boats.js';
import { Barriers } from './barrier.js';
import { sfx } from './audio.js';
import { Mushroom, NuclearStrike, Meltdown, nuclearDamage } from './nuke.js';
import { Villains } from './villains.js';
import { Zones } from './rebuild.js';
import { Heroes } from './heroes.js';
import { Brawl } from './brawl.js';
import { Worm } from './worm.js';
import { Kaiju } from './kaiju.js';

export const threatName = (h) => (h === 'zombies' ? 'Zombie outbreak' : HAZARDS[h].name);

export const HAZARDS = {
  tornado: { name: 'Tornado', tap: true },
  quake: { name: 'Earthquake', tap: true },
  flood: { name: 'Flood', tap: false },
  tsunami: { name: 'Tsunami', tap: false },
  riot: { name: 'Riot', tap: true },
  aliens: { name: 'Alien invasion', tap: false },
  meteor: { name: 'Meteor', tap: true },
  sinkhole: { name: 'Sinkhole', tap: true },
  volcano: { name: 'Volcano', tap: true },
  haboob: { name: 'Dust storm', tap: false },
  coldwave: { name: 'Cold wave', tap: false },
  solar: { name: 'Solar flare', tap: false },
  nuclear: { name: 'Nuclear attack', tap: true },
  meltdown: { name: 'Plant meltdown', tap: false },
  blackhole: { name: 'Black hole', tap: true },
  villains: { name: 'Super villains', tap: true },
  worm: { name: 'Giant worm', tap: true },
  kaiju: { name: 'Kaiju', tap: true },
};
// called by the hero signal rather than picked as a disaster
export const HELPERS = { heroes: { name: 'Hero signal' } };
export { WEATHER };

class TornadoEvent {
  constructor(D, x, z, opts) {
    this.type = 'tornado'; this.D = D;
    this.tw = new Twister(D, x, z, { size: opts.size ?? 1.4 + Math.random() * 0.8, life: opts.life ?? (opts.size ? 50 + opts.size * 10 : undefined) });
    const w = D.weather.type;
    if (w === 'clear' || w === 'heat' || w === 'fog' || w === 'sand') { this.prevWeather = w; D.weather.set('storm'); }
    D.emit({ type: 'warn', hazard: 'tornado', x, z, r: 70, text: 'Tornado warning! A twister is touching down in the ' + D.district(x, z) + ' district' });
  }
  get alive() { return this.tw.alive; }
  get x() { return this.tw.x; } get z() { return this.tw.z; }
  update(h) { this.tw.update(h); if (!this.tw.alive && this.prevWeather && this.D.weather.type === 'storm' && !this.D.list.some(e => e !== this && e.type === 'tornado' && e.alive)) this.D.weather.set(this.prevWeather === 'heat' ? 'clear' : this.prevWeather); }
  sync(dt, t) { this.tw.sync(dt, t); }
  poi() { const tw = this.tw; return tw.phase === 'gone' ? null : { x: tw.x, z: tw.z, danger: tw.reach * 2.8, range: 340 }; }
  dispose() { this.tw.dispose(); }
}

export class Disasters {
  constructor(ctx) {
    this.ctx = ctx; // { scene, city, people, traffic, fire, post, camera, controls, renderer, sun, hemi, low, game }
    const { scene, people } = ctx;
    this.debris = new Debris(scene, ctx.low ? 1000 : 1600);
    this.debris.groundY = (x, z) => this.holeFloor(x, z) ?? people.groundY(x, z); // debris, cars and people fall into pits and craters
    ctx.traffic.groundAt = (x, z) => this.holeFloor(x, z) ?? 0;
    people.holeAt = (x, z) => this.holeFloor(x, z);
    this.bubbles = []; // Tempo's time bubbles: { x, y, z, R }
    ctx.traffic.slowAt = this.debris.slowAt = (x, y, z) => this.slowAt(x, y, z);
    this.decals = new Decals(scene);
    this.weather = new Weather({ ...ctx, disasters: this });
    this.water = new WaterSurface(this);
    this.boats = new Boats(this); // rescue boats in floods and tsunamis
    this.barriers = new Barriers(this); // inflatable flood barriers across a tsunami's path
    this.jets = ctx.fire.jets = new Splash(ctx.scene, ctx.low ? 1500 : 3000); this.jets.mat.uniforms.uColor.value.setRGB(1.1, 1.2, 1.3); // water from hoses and fire trucks' cannons
    this.zones = new Zones(this);
    this.brawl = new Brawl(this); // heroes and villains throwing cars and each other // radiation left behind: nothing is rebuilt inside it until hazmat clears it
    this.spitFx = new Splash(scene, 500); this.spitFx.mat.uniforms.uColor.value.setRGB(0.5, 0.95, 0.18); // spitter acid
    people.poi = (x, z) => this.poiAt(x, z); // onlookers watch (and film) whatever is happening near them
    // things falling into flood water or the sea throw up a splash
    this.debris.onSplash = (x, y, z, s) => this.water.splash.emit(x, y, z, Math.round(4 + s * 3), { up: [3, 4 + s * 2], spread: 3, life: 1.1, size: 1.2 + s * 0.3 });
    this.list = []; this.events = []; this.bolts = []; this.timers = []; this.leftovers = []; // craters, pits and lava stay until the world is reset
    this.lightK = 1; this.sunK = 1; // how bright the scene is lit right now (weather, night), for the unlit effects
    this.stats = { buildings: 0, hazards: 0 };
    this._carMats = new Map();
    this.boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.3, 3.8), fog: false });
    this.boltGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.1, 2.2), transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  }

  district(x, z) {
    const B = this.ctx.city.bounds;
    const fx = (x - B.x0) / (B.x1 - B.x0), fz = (z - B.z0) / (B.z1 - B.z0);
    const ns = fz < 0.34 ? 'North' : fz > 0.66 ? 'South' : '', ew = fx < 0.34 ? 'West' : fx > 0.66 ? 'East' : '';
    return ns && ew ? ns + '-' + ew : ns || ew || 'Central';
  }

  carMat(hex) {
    if (!this._carMats.has(hex)) this._carMats.set(hex, new THREE.MeshStandardMaterial({ vertexColors: true, color: hex, roughness: 0.5, metalness: 0.1 }));
    return this._carMats.get(hex);
  }
  emit(e) { this.events.push(e); }
  shake(a) { const g = this.ctx.game; if (g) g.shake = Math.max(g.shake || 0, a); }
  flash(a) { const g = this.ctx.game; if (g) g.flash = Math.max(g.flash || 0, a); }
  later(secs, fn) { this.timers.push({ t: secs, fn }); }
  // the most striking thing an onlooker at (x, z) can see right now: { x, z, danger, range } or null
  poiAt(x, z) {
    let best = null, bs = 1;
    const consider = (p) => { if (!p) return; const sc = Math.hypot(p.x - x, p.z - z) / p.range; if (sc < bs) { bs = sc; best = p; } };
    for (const e of this.list) if (e.poi) consider(e.poi(x, z));
    for (const l of this.leftovers) if (l.poi) consider(l.poi(x, z));
    if (!best) { const f = this.ctx.fire.firesWithin(x, z, 70); if (f.length) { const b = this.ctx.city.buildings[f[0]]; consider({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, danger: 10, range: 70 }); } }
    return best;
  }
  mushroom(x, z, R) { return new Mushroom(this, x, z, R); }
  nukeBlast(x, z, R, o = {}) { return nuclearDamage(this, x, z, R, o); }
  contaminate(x, z, R) { return this.zones.add(x, z, R); }
  // how fast time runs at a point: a crawl inside a time bubble
  slowAt(x, y, z) { for (const b of this.bubbles) if ((x - b.x) ** 2 + (y - b.y) ** 2 + (z - b.z) ** 2 < b.R * b.R) return 0.1; return 1; }
  // the widest a held sinkhole or black hole can get: a pit covering about ten city blocks
  get maxHoleR() { const c = this.ctx.city, B = c.bounds; return (B.x1 - B.x0) / c.NB * 1.78; }
  inHole(x, z) { return this.holeFloor(x, z) != null; }
  // the surface of the deepest pit under (x, z), or null
  holeFloor(x, z) { let y = null; for (const l of this.leftovers) if (l.floorAt) { const f = l.floorAt(x, z); if (f != null && (y == null || f < y)) y = f; } return y; }
  // after the day/night cycle and the weather have set the lights (a solar storm cuts the power)
  afterLight() { for (const e of this.list) if (e.afterLight) e.afterLight(); }
  onEvent(e) {
    if (e.type === 'spit') { // an arc of green acid from the spitter to its target
      for (let k = 0; k <= 6; k++) { const t = k / 6; this.spitFx.emit(e.x + (e.tx - e.x) * t, 1.5 + Math.sin(t * Math.PI) * 1.2, e.z + (e.tz - e.z) * t, 3, { up: [0, 1.5], spread: 0.8, life: 0.7, size: 0.9 }); }
      this.spitFx.emit(e.tx, 1.2, e.tz, 14, { up: [1, 3], spread: 2.5, life: 0.9, size: 1 });
    }
    if (e.type === 'carland' && this.water.active && this.water.levelAt(e.x, e.z) > 0.4) this.water.splash.emit(e.x, this.water.level, e.z, 16, { up: [4, 9], spread: 5, life: 1.4, size: 2 });
    for (const ev of this.list) if (ev.onEvent) ev.onEvent(e);
  }
  active(type) { return this.list.some(e => e.type === type && e.alive); }

  // ---------- starting hazards
  start(type, x, z, opts = {}) {
    const B = this.ctx.city.bounds;
    if (x == null) { x = B.x0 + 80 + Math.random() * (B.x1 - B.x0 - 160); z = B.z0 + 80 + Math.random() * (B.z1 - B.z0 - 160); }
    let ev = null;
    if (type === 'tornado') ev = new TornadoEvent(this, x, z, opts);
    else if (type === 'quake') ev = new Quake(this, x, z, opts.mag ?? 6.6 + Math.random() * 1.2, opts);
    else if (type === 'flood') ev = new Flood(this, opts);
    else if (type === 'tsunami') ev = new Tsunami(this, opts);
    else if (type === 'riot') ev = new Riot(this, x, z, opts);
    else if (type === 'aliens') ev = new Invasion(this, opts);
    else if (type === 'meteor') ev = new Meteor(this, x, z, opts);
    else if (type === 'sinkhole') ev = new Sinkhole(this, x, z, opts);
    else if (type === 'volcano') ev = new Volcano(this, x, z, opts);
    else if (type === 'haboob') ev = new Haboob(this, opts);
    else if (type === 'coldwave') ev = new ColdWave(this, opts);
    else if (type === 'solar') ev = new SolarStorm(this, opts);
    else if (type === 'nuclear') ev = new NuclearStrike(this, x, z, opts);
    else if (type === 'meltdown') ev = new Meltdown(this, opts);
    else if (type === 'blackhole') ev = new BlackHole(this, x, z, opts);
    else if (type === 'villains') ev = new Villains(this, x, z, opts);
    else if (type === 'worm') ev = new Worm(this, x, z, opts);
    else if (type === 'kaiju') ev = new Kaiju(this, x, z, opts);
    else if (type === 'heroes') { const on = this.list.find(e => e.type === 'heroes' && e.alive && !e.leaving); if (on) { on.signal(x, z); return on; } ev = new Heroes(this, x, z, opts); }
    if (!ev) return null;
    this.list.push(ev); this.stats.hazards++;
    return ev;
  }

  // fire trucks parked at a fire: the roof cannon arcs a jet onto the building nearest them that is burning, and it helps put it out
  cannons(h) {
    const { traffic, fire, city } = this.ctx;
    for (const c of traffic.missions) {
      if (c.kind !== 'fire' || c.mode !== 3 || c.gone) continue;
      const k = (c.fireK != null && fire.bFire[c.fireK] === 1) ? c.fireK : (c.fireK = fire.firesWithin(c.x, c.z, 55)[0]); if (k == null) continue;
      const b = city.buildings[k], tx = Math.max(b.x0, Math.min(b.x1, c.x)), tz = Math.max(b.z0, Math.min(b.z1, c.z)), sw = Math.sin(this.ctx.fire.uniforms.uTime.value * 0.6 + c.id) * 3;
      fire.jet(c.x, 4, c.z, tx + sw, Math.min(b.top - 1, 6 + (c.id % 3) * 4), tz - sw, 4, 1.6);
      fire.douse(k, h * 0.6);
    }
  }
  // a wave or a dust wall slams into building k from direction (dx, dz): the windows on the far side blow out
  blowWindows(k, dx, dz, power = 1) {
    const { city } = this.ctx, b = city.buildings[k]; if (!b || city.dead[k]) return;
    const xs = Math.abs(dx) > Math.abs(dz), s = xs ? Math.sign(dx) : Math.sign(dz), hgt = b.top - b.baseY;
    sfx(hgt > 14 || power > 0.9 ? 'glassBig' : 'glass', (b.x0 + b.x1) / 2, b.baseY + Math.min(20, hgt * 0.5), (b.z0 + b.z1) / 2, { gain: Math.min(1, 0.5 + power * 0.5) });
    // the far face bursts outwards; the face taking the hit shatters and rains down the wall
    for (const [face, out, k0] of [[s, 1, 1], [-s, 0.25, 0.5]]) {
      const n = Math.round(Math.min(50, 14 + hgt * 0.9) * power * k0);
      for (let i = 0; i < n; i++) {
        const t = Math.random(), y = b.baseY + 3 + Math.random() * Math.max(1, hgt - 4), sp = (5 + Math.random() * 8) * power * out, sz = 0.2 + Math.random() * 0.4;
        const x = xs ? (face > 0 ? b.x1 + 0.2 : b.x0 - 0.2) : b.x0 + t * (b.x1 - b.x0), z = xs ? b.z0 + t * (b.z1 - b.z0) : (face > 0 ? b.z1 + 0.2 : b.z0 - 0.2);
        this.debris.add(x, y, z, sz, 0.05, sz * (0.6 + Math.random()), Math.random() < 0.7 ? 0xeefcff : 0xb4d6de, 'fly', { v: [(xs ? face * sp : 0) + (Math.random() - 0.5) * 3, out > 0.5 ? 1 + Math.random() * 4 : -1 - Math.random() * 2, (xs ? 0 : face * sp) + (Math.random() - 0.5) * 3] });
      }
    }
    city.char(k, 0.9); // dark, empty window holes
  }

  // ---------- tearing down a building: 'tear' (tornado: the shell flies up the funnel) or 'collapse'
  destroyBuilding(k, how = 'collapse', opts = {}) {
    const { city, people, fire } = this.ctx;
    if (city.dead[k]) return false;
    const b = city.buildings[k], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, d = b.z1 - b.z0;
    const hgt = b.top - b.baseY, wc = b.wallCol, hex = new THREE.Color(wc[0], wc[1], wc[2]).getHex();
    people.clearBuilding(k, how === 'tear' ? 'tear' : opts.spare ? 'spare' : 'crush'); // spare: everyone gets out first
    fire.gone(k);
    if (opts.vanish) { people.clearBuilding(k, 'crush'); fire.gone(k); city.hideBuilding(k); this.stats.buildings++; this.emit({ type: 'collapse', k, how, x: cx, z: cz }); return true; } // vaporised: no shell, no debris
    const shell = city.extractBuilding(k); city.hideBuilding(k);
    const dbr = this.debris;
    if (how === 'tear') {
      dbr.addObject(shell, 'lift', { vort: opts.vort, dur: 1.4 + Math.min(1.6, hgt * 0.03), h: hgt });
      const n = Math.min(36, 10 + Math.round(hgt * 0.9));
      for (let i = 0; i < n; i++) {
        const s = 0.6 + Math.random() * Math.min(2.4, w * 0.2);
        dbr.add(b.x0 + Math.random() * w, b.baseY + Math.random() * hgt, b.z0 + Math.random() * d, s, 0.3 + Math.random() * s * 0.5, s * (0.5 + Math.random()), Math.random() < 0.75 ? hex : 0x8a8478, 'orbit', { vort: opts.vort, hold: 1.5 + Math.random() * 3 });
      }
      if (!opts.noRubble) city.addRubble(k, 0.7);
    } else {
      const dur = 2.2 + Math.random() * 1.4;
      dbr.addObject(shell, 'sink', { dur, h: hgt + 2, dir: opts.dir ?? Math.random() * 6.28, onDone: () => { if (!opts.noRubble) city.addRubble(k, 0.75); } });
      fire.dustCloud(cx, cz, Math.max(w, d) * 0.6, hgt);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * 6.28, sp = 3 + Math.random() * 6, s = 0.6 + Math.random() * 1.6;
        dbr.add(cx + Math.cos(a) * w * 0.4, b.baseY + Math.random() * hgt * 0.6, cz + Math.sin(a) * d * 0.4, s, s * 0.6, s, Math.random() < 0.7 ? hex : 0x6a6660, 'fly', { v: [Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp] });
      }
      if (!opts.noCrush) people.crushNear(cx, cz, Math.max(w, d) * 0.5 + 4);
      this.shake(0.35);
    }
    this.stats.buildings++;
    this.emit({ type: 'collapse', k, how, x: cx, z: cz });
    return true;
  }

  // ---------- lightning: a jagged bolt from the clouds; kills near the strike, may set a roof alight
  strike(x, z, opts = {}) {
    const { city, people, fire, scene, camera, controls } = this.ctx;
    let top = 0, kb = -1;
    city.buildingsNear(x, z, 0.5, (k, d, b) => { if (d === 0 && b.top > top) { top = b.top; kb = k; } });
    const y0 = opts.from ?? 170 + Math.random() * 40;
    const pts = []; const n = 12;
    for (let i = 0; i <= n; i++) {
      const k = i / n; const j = i === 0 || i === n ? 0 : (6 + y0 * 0.04);
      pts.push(new THREE.Vector3(x + (Math.random() - 0.5) * j, y0 + (top - y0) * k, z + (Math.random() - 0.5) * j));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.45, 4, false), this.boltMat));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 2.2, 5, false), this.boltGlow));
    for (let f = 0; f < 2; f++) { // a fork
      const s = 2 + Math.floor(Math.random() * 6), fp = [pts[s].clone()];
      let p = pts[s].clone(); for (let q = 0; q < 4; q++) { p = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, -8 - Math.random() * 10, (Math.random() - 0.5) * 16)); fp.push(p); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fp), 16, 0.25, 3, false), this.boltMat));
    }
    scene.add(g); this.bolts.push({ g, t: 0.22 + Math.random() * 0.12 });
    const near = camera.position.distanceTo(controls.target) * 1.2 > Math.hypot(x - controls.target.x, z - controls.target.z);
    if (near) this.flash(opts.mild ? 0.35 : 0.55);
    if (kb >= 0) { if (Math.random() < (opts.mild ? 0.15 : 0.35)) fire.igniteBuilding(kb); }
    else {
      people.around(x, z, opts.mild ? 2 : 3.5, (j) => { const s = people.st[j]; if (s === 8 || s === 19 || s === 20) return; people.wz[j] = (s === 6) ? 1 : 0; people.kill(j, 0, 0, 'bolt'); });
      this.decals.add('scour', x, z, 4, 4);
    }
    this.emit({ type: 'bolt', x, z });
  }

  // ---------- frame and step
  update(h) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= h; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    for (const e of this.list) e.update(h);
    this.brawl.update(h);
    for (let i = this.leftovers.length - 1; i >= 0; i--) { const l = this.leftovers[i]; if (l.update) l.update(h); if (l.alive === false) { l.dispose(); this.leftovers.splice(i, 1); } }
    for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].alive) { this.list[i].dispose(); this.list.splice(i, 1); }
    this.water.update(h); this.spitFx.update(h); this.boats.update(h); this.barriers.update(h); this.jets.update(h); this.cannons(h);
    if (this.water.active && (this.quenchT = (this.quenchT || 0) - h) <= 0) { this.quenchT = 0.5; const W = this.water, P = this.ctx.people; this.ctx.fire.quench((x, z) => W.levelAt(x, z) - P.groundY(x, z)); } // water puts fires out
    this.weather.update(h);
    this.debris.update(h);
  }
  sync(dt, realT) {
    const { sun, hemi, post } = this.ctx, night = post.opts.night || 0;
    this.sunK = Math.min(1.2, sun.intensity / 5) * (1 - night);
    this.lightK = (0.3 + 0.7 * Math.min(1.2, (sun.intensity * 0.6 + hemi.intensity * 0.55) / 3.7)) * (1 - night * 0.55);
    for (const e of this.list) e.sync(dt, realT);
    for (const l of this.leftovers) l.sync(dt, realT);
    this.water.sync(dt, realT); this.boats.sync(dt, realT); this.jets.sync(this.lightK, this.ctx.fire.uniforms.uScale.value); this.spitFx.sync(this.lightK, this.ctx.fire.uniforms.uScale.value);
    this.weather.sync(dt, realT); this.zones.sync(realT);
    const sir = this.sirens; if (sir) { sir.beacons = sir.beacons.filter(b => !b.candle); for (const c of this.ctx.people.circles) sir.beacons.push({ x: c.x, y: 0.35, z: c.z, c: [2.2, 1.3, 0.45], kind: 'steady', candle: true, pool: 3.5 }); } // candles in the prayer circles
    this.debris.sync();
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt; b.g.visible = Math.random() < 0.82;
      if (b.t <= 0) { this.ctx.scene.remove(b.g); b.g.traverse((m) => m.geometry && m.geometry.dispose()); this.bolts.splice(i, 1); }
    }
  }
  reset() {
    for (const e of this.list) e.dispose();
    this.list.length = 0; this.timers.length = 0; this.events.length = 0; this.bubbles.length = 0;
    for (const l of this.leftovers) l.dispose(); this.leftovers.length = 0;
    for (const b of this.bolts) this.ctx.scene.remove(b.g); this.bolts.length = 0;
    this.debris.reset(); this.decals.reset(); this.water.reset(); this.boats.reset(); this.barriers.reset(); this.zones.reset(); this.brawl.reset();
    this.weather.set('clear', true);
    this.stats = { buildings: 0, hazards: 0 };
    if (this.ctx.outskirts) { this.ctx.outskirts.reset(); this.later(0, () => this.ctx.outskirts.steam(this.ctx.fire)); } // after fire.reset has cleared the pools
  }
}
