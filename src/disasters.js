// Disaster manager: runs every hazard (tornado, earthquake, flood, tsunami,
// riot, alien invasion), the weather, debris and ground marks, and the shared
// pieces they need: tearing down buildings, lightning strikes, warnings.
import * as THREE from 'three';
import { Debris, Decals } from './debris.js';
import { Weather, WEATHER } from './weather.js';
import { Twister } from './twister.js';
import { Quake } from './quake.js';
import { WaterSurface, Flood, Tsunami } from './water.js';
import { Riot } from './riot.js';
import { Invasion } from './aliens.js';
import { Meteor, Sinkhole } from './impact.js';
import { Volcano } from './volcano.js';
import { Haboob, ColdWave } from './fronts.js';
import { SolarStorm } from './solar.js';
import { Mushroom, NuclearStrike, Meltdown } from './nuke.js';

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
};
export { WEATHER };

class TornadoEvent {
  constructor(D, x, z, opts) {
    this.type = 'tornado'; this.D = D;
    this.tw = new Twister(D, x, z, { size: opts.size ?? 1.4 + Math.random() * 0.8, life: opts.life });
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
    this.debris.groundY = (x, z) => (this.inHole(x, z) ? -40 : people.groundY(x, z)); // debris falls into pits and craters
    this.decals = new Decals(scene);
    this.weather = new Weather({ ...ctx, disasters: this });
    this.water = new WaterSurface(this);
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
  inHole(x, z) { for (const l of this.leftovers) if (l.R && Math.hypot(x - l.x, z - l.z) < l.R) return true; return false; }
  // after the day/night cycle and the weather have set the lights (a solar storm cuts the power)
  afterLight() { for (const e of this.list) if (e.afterLight) e.afterLight(); }
  onEvent(e) {
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
    if (!ev) return null;
    this.list.push(ev); this.stats.hazards++;
    return ev;
  }

  // ---------- tearing down a building: 'tear' (tornado: the shell flies up the funnel) or 'collapse'
  destroyBuilding(k, how = 'collapse', opts = {}) {
    const { city, people, fire } = this.ctx;
    if (city.dead[k]) return false;
    const b = city.buildings[k], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, d = b.z1 - b.z0;
    const hgt = b.top - b.baseY, wc = b.wallCol, hex = new THREE.Color(wc[0], wc[1], wc[2]).getHex();
    people.clearBuilding(k, how === 'tear' ? 'tear' : 'crush');
    fire.gone(k);
    const shell = city.extractBuilding(k); city.hideBuilding(k);
    const dbr = this.debris;
    if (how === 'tear') {
      dbr.addObject(shell, 'lift', { vort: opts.vort, dur: 1.4 + Math.min(1.6, hgt * 0.03), h: hgt });
      const n = Math.min(36, 10 + Math.round(hgt * 0.9));
      for (let i = 0; i < n; i++) {
        const s = 0.6 + Math.random() * Math.min(2.4, w * 0.2);
        dbr.add(b.x0 + Math.random() * w, b.baseY + Math.random() * hgt, b.z0 + Math.random() * d, s, 0.3 + Math.random() * s * 0.5, s * (0.5 + Math.random()), Math.random() < 0.75 ? hex : 0x8a8478, 'orbit', { vort: opts.vort, hold: 1.5 + Math.random() * 3 });
      }
      city.addRubble(k, 0.7);
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
    for (let i = this.leftovers.length - 1; i >= 0; i--) { const l = this.leftovers[i]; if (l.update) l.update(h); if (l.alive === false) { l.dispose(); this.leftovers.splice(i, 1); } }
    for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].alive) { this.list[i].dispose(); this.list.splice(i, 1); }
    this.water.update(h);
    this.weather.update(h);
    this.debris.update(h);
  }
  sync(dt, realT) {
    const { sun, hemi, post } = this.ctx, night = post.opts.night || 0;
    this.sunK = Math.min(1.2, sun.intensity / 5) * (1 - night);
    this.lightK = (0.3 + 0.7 * Math.min(1.2, (sun.intensity * 0.6 + hemi.intensity * 0.55) / 3.7)) * (1 - night * 0.55);
    for (const e of this.list) e.sync(dt, realT);
    for (const l of this.leftovers) l.sync(dt, realT);
    this.water.sync(dt, realT);
    this.weather.sync(dt, realT);
    this.debris.sync();
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt; b.g.visible = Math.random() < 0.82;
      if (b.t <= 0) { this.ctx.scene.remove(b.g); b.g.traverse((m) => m.geometry && m.geometry.dispose()); this.bolts.splice(i, 1); }
    }
  }
  reset() {
    for (const e of this.list) e.dispose();
    this.list.length = 0; this.timers.length = 0; this.events.length = 0;
    for (const l of this.leftovers) l.dispose(); this.leftovers.length = 0;
    for (const b of this.bolts) this.ctx.scene.remove(b.g); this.bolts.length = 0;
    this.debris.reset(); this.decals.reset(); this.water.reset();
    this.weather.set('clear', true);
    this.stats = { buildings: 0, hazards: 0 };
    if (this.ctx.outskirts) { this.ctx.outskirts.reset(); this.later(0, () => this.ctx.outskirts.steam(this.ctx.fire)); } // after fire.reset has cleared the pools
  }
}
