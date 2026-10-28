// The neon city's elevated railway (city.rail, laid out by city.js): a concrete viaduct along one street on pillars
// down its middle, two tracks, a station in the middle of town, and two trains running end to end, stopping at the
// station and turning back at the ends of the line. What tears up the street there (city.takeStreetNear: tornadoes,
// impacts, blasts, the tsunami, lava) breaks spans and topples pillars, and so does the kaiju walking through it; a
// train that cannot stop short of a gap runs off the broken end, its cars dropping one after another into the street.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CAR = 19, CARS = 5, LEN = CAR * CARS, VMAX = 15, ACC = 1.0, BRAKE = 1.4, SH = 23; // m, m/s, m/s2; SH: the station's half length
const LIGHT = new Set(['heroes', 'haboob', 'coldwave', 'spill', 'solar', 'riot', 'zombies', 'flood']); // these do not bring the line down

const paint = (geo, hex) => { const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
const bx = (x0, x1, y0, y1, z0, z1, hex) => paint(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), hex);

export class Rail {
  constructor({ scene, city, disasters, post }) {
    const L = this.L = city.rail; this.ctx = { city, D: disasters, post };
    const g = this.group = new THREE.Group(); scene.add(g);
    this.spans = []; for (let k = 0; k + 1 < L.pillars.length; k++) this.spans.push({ a: L.pillars[k], b: L.pillars[k + 1], down: false });
    this.posts = L.pillars.map(x => ({ x, down: false, tilt: [0, 0] }));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    // a span: one unit long (scaled to its length), the deck, its parapets, the ballast and rails of both tracks
    const deck = mergeGeometries([
      bx(0, 1, -1.2, 0, -3.6, 3.6, '#b9b4aa'), bx(0, 1, 0, 1.1, 3.3, 3.6, '#c9c4ba'), bx(0, 1, 0, 1.1, -3.6, -3.3, '#c9c4ba'),
      bx(0, 1, 0, 0.12, 0.6, 3.0, '#6d665c'), bx(0, 1, 0, 0.12, -3.0, -0.6, '#6d665c'),
      ...[-2.52, -1.08, 1.08, 2.52].map(z => bx(0, 1, 0.12, 0.3, z - 0.07, z + 0.07, '#8f9396')),
    ]);
    const pier = mergeGeometries([bx(-0.7, 0.7, 0, L.y - 2.4, -0.7, 0.7, '#aaa59b'), bx(-0.9, 0.9, L.y - 2.4, L.y - 1.2, -3.3, 3.3, '#b3aea4')]);
    this.deck = new THREE.InstancedMesh(deck, mat, this.spans.length); this.pier = new THREE.InstancedMesh(pier, mat, this.posts.length);
    // the station: platforms both sides with yellow edges, a canopy on columns over the tracks
    const st = [bx(-SH, SH, -1.2, 1.0, 3.6, 7.4, '#cfcac0'), bx(-SH, SH, -1.2, 1.0, -7.4, -3.6, '#cfcac0'), bx(-SH, SH, 1.0, 1.06, 3.6, 4.1, '#e8d24a'), bx(-SH, SH, 1.0, 1.06, -4.1, -3.6, '#e8d24a'),
      bx(-SH, SH, 1.0, 2.3, 7.2, 7.4, '#8fa4b0'), bx(-SH, SH, 1.0, 2.3, -7.4, -7.2, '#8fa4b0'), bx(-SH - 1, SH + 1, 5.2, 5.6, -7.8, 7.8, '#e2e5e8')];
    for (const x of [-18, -6, 6, 18]) for (const z of [5.9, -5.9]) st.push(bx(x - 0.25, x + 0.25, 1.0, 5.2, z - 0.25, z + 0.25, '#9aa0a4'));
    this.station = new THREE.Mesh(mergeGeometries(st).translate(L.station, L.y, L.z), mat);
    // the trains: five cars each, silver with the line's stripe (green, orange); their windows a mesh of their own, lit at night
    const car = (stripe) => mergeGeometries([bx(-9.2, 9.2, 0.35, 3.75, -1.45, 1.45, '#dfe3e6'), bx(-9.25, 9.25, 1.05, 1.4, -1.47, 1.47, stripe), bx(-9.2, 9.2, 3.75, 3.95, -1.2, 1.2, '#b4b8bc'), bx(-9.25, 9.25, 0.35, 0.6, -1.47, 1.47, '#3a3e42')]);
    this.cars = [new THREE.InstancedMesh(car('#3fae49'), mat, CARS), new THREE.InstancedMesh(car('#f08a24'), mat, CARS)];
    this.winMat = new THREE.MeshStandardMaterial({ color: '#26323c', emissive: '#ffe2a8', emissiveIntensity: 0, roughness: 0.3 });
    this.wins = new THREE.InstancedMesh(new THREE.BoxGeometry(17.2, 1.15, 2.96).translate(0, 2.37, 0), this.winMat, CARS * 2);
    for (const m of [this.deck, this.pier, this.station, ...this.cars, this.wins]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    for (const m of [this.deck, this.pier, ...this.cars, this.wins]) m.frustumCulled = false; // moved by hand
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
    city.hooks.street = (x, z, R) => this.breakNear(x, z, R);
    this.reset();
  }
  // everything back up: the line whole, the trains at the ends of it
  reset() {
    for (const s of this.spans) s.down = false;
    for (const p of this.posts) p.down = false;
    this.station.visible = true; this.chk = 0; this.said = false;
    const L = this.L;
    this.trains = [0, 1].map(k => ({ k, track: k ? -1 : 1, dir: k ? -1 : 1, head: k ? L.x1 - 4 - LEN : L.x0 + 4 + LEN, v: 0, wait: 3 + k * 9, end: false, falling: false,
      cars: Array.from({ length: CARS }, () => ({ st: 'run', x: 0, y: L.y, vx: 0, vy: 0, pitch: 0, yaw: 0, roll: 0 })) }));
    this.place(); this.sync(true);
  }
  // the span under x (-1 off the ends)
  spanAt(x) { for (let k = 0; k < this.spans.length; k++) if (x >= this.spans[k].a && x <= this.spans[k].b) return k; return -1; }
  // a storm, a blast, an impact tearing up the street at (x, z) out to R: the spans and pillars it reaches come down
  breakNear(x, z, R) {
    const L = this.L, D = this.ctx.D;
    if (R < 5 || !D || !D.list.some(e => e.alive && !LIGHT.has(e.type))) return; // the small stuff, the weather: no
    const dz = Math.max(0, Math.abs(z - L.z) - 3.6); if (dz > R) return;
    const reach = Math.sqrt(R * R - dz * dz);
    let hit = false;
    for (const s of this.spans) if (!s.down && s.b > x - reach && s.a < x + reach) { s.down = true; hit = true; this.crumble((s.a + s.b) / 2, s.b - s.a); }
    for (const p of this.posts) if (!p.down && Math.abs(p.x - x) < reach * 0.8) { p.down = true; hit = true; const a = Math.random() * 6.28; p.tilt = [Math.cos(a) * 1.25, Math.sin(a) * 1.25]; }
    if (!hit) return;
    if (this.station.visible && this.spans.some(s => s.down && s.b > L.station - SH && s.a < L.station + SH)) { this.station.visible = false; this.crumble(L.station, SH * 2); }
    this.sync(true);
  }
  // concrete coming down off the line along len of it at x
  crumble(x, len) {
    const D = this.ctx.D, L = this.L; if (!D || !D.debris) return;
    for (let k = 0, n = Math.min(14, 4 + Math.round(len / 4)); k < n; k++) D.debris.add(x + (Math.random() - 0.5) * len, L.y - 0.5, L.z + (Math.random() - 0.5) * 6, 1 + Math.random() * 2, 0.6 + Math.random(), 1 + Math.random() * 2, '#b9b4aa', 'fly', { v: [(Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4] });
  }
  step(h) {
    const D = this.ctx.D;
    if (D && (this.chk -= h) <= 0) { this.chk = 0.3; for (const e of D.list) if (e.alive && e.type === 'kaiju' && Number.isFinite(e.x) && Number.isFinite(e.z)) this.breakNear(e.x, e.z, 9); } // the kaiju walks through it
    for (const T of this.trains) this.drive(T, h);
    this.place(); this.sync(false);
    const night = (this.ctx.post && this.ctx.post.opts.night) || 0; this.winMat.emissiveIntensity = 1.2 * Math.min(1, Math.max(0, (night - 0.15) / 0.45));
  }
  // one train along its track: on to the next stop (the station, the end of the line, short of a gap), a wait, on
  drive(T, h) {
    const L = this.L, dir = T.dir;
    if (T.cars.every(c => c.st !== 'run')) return;
    if (!T.falling) {
      if (T.wait > 0) { T.wait -= h; if (T.wait <= 0 && T.end) { T.head -= dir * LEN; T.dir = -dir; T.end = false; } return; }
      const stops = [[L.station + dir * LEN / 2, 7], [dir > 0 ? L.x1 - 3 : L.x0 + 3, 9]];
      for (const s of this.spans) if (s.down) stops.push([(dir > 0 ? s.a : s.b) - dir * 4, -1]); // short of a gap: it waits there
      let d = 1e9, wait = 0;
      for (const [x, w] of stops) { const dd = (x - T.head) * dir; if (dd > 0.25 && dd < d) { d = dd; wait = w; } }
      const want = Math.min(VMAX, Math.sqrt(2 * BRAKE * d));
      T.v = T.v < want ? Math.min(want, T.v + ACC * h) : Math.max(want, T.v - BRAKE * 1.6 * h);
      if (d - T.v * h <= 0.25 && T.v < 1.5) { T.head += dir * d; T.v = 0; T.wait = wait < 0 ? 1e9 : wait; T.end = wait === 9; return; } // there
    }
    T.head += dir * T.v * h;
    for (const c of T.cars) if (c.st === 'run') { const k = this.spanAt(c.x + dir * 8); if (k < 0 || this.spans[k].down) { c.st = 'fall'; c.vx = dir * Math.max(T.v, 2); c.vy = 0; c.roll = (Math.random() - 0.5) * 0.5; T.falling = true; this.off(T); } } // off the broken end
  }
  // a train gone off the line: the news, once
  off(T) {
    if (T.said) return; T.said = true;
    const D = this.ctx.D; if (D) { D.emit({ type: 'train', text: 'A train ran off the broken line!' }); D.shake(0.25); }
  }
  // where each car is: on the track behind the head, or falling, or come to rest in the street
  place() {
    const L = this.L, h = 1 / 30;
    for (const T of this.trains) T.cars.forEach((c, k) => {
      if (c.st === 'run') { c.x = T.head - T.dir * (k * CAR + CAR / 2); c.y = L.y; c.yaw = 0; c.pitch = 0; return; }
      if (c.st !== 'fall') return;
      c.x += c.vx * h; c.y += c.vy * h; c.vy -= 9.8 * h; c.vx *= 0.995; c.pitch -= Math.sign(c.vx) * h * 0.9; c.yaw += c.roll * h;
      if (c.y <= 0.3) { c.y = 0.3; c.st = 'wreck'; c.pitch = Math.max(-0.5, Math.min(0.5, c.pitch)); const D = this.ctx.D; if (D) { D.shake(0.2); this.crumble(c.x, 6); } }
    });
  }
  sync(all) {
    const { m4, q, e, p, s } = this, L = this.L;
    if (all) {
      this.spans.forEach((sp, k) => {
        const len = sp.b - sp.a, pa = this.posts[k], pb = this.posts[k + 1];
        if (!sp.down) { q.identity(); m4.compose(p.set(sp.a, L.y, L.z), q, s.set(len, 1, 1)); }
        else if (pa.down && pb.down) { q.identity(); m4.compose(p.set(sp.a, 0.6, L.z), q, s.set(len, 1, 1)); } // flat in the street
        else { const th = Math.asin(Math.min(1, (L.y - 0.6) / len)), atB = pa.down && !pb.down; e.set(0, atB ? Math.PI : 0, -th); q.setFromEuler(e); m4.compose(p.set(atB ? sp.b : sp.a, L.y, L.z), q, s.set(len, 1, 1)); } // hanging from the end still up
        this.deck.setMatrixAt(k, m4);
      });
      this.posts.forEach((po, k) => { e.set(po.down ? po.tilt[0] : 0, 0, po.down ? po.tilt[1] : 0); q.setFromEuler(e); m4.compose(p.set(po.x, 0, L.z), q, s.set(1, 1, 1)); this.pier.setMatrixAt(k, m4); });
      this.deck.instanceMatrix.needsUpdate = true; this.pier.instanceMatrix.needsUpdate = true;
    }
    for (const T of this.trains) T.cars.forEach((c, k) => {
      e.set(0, c.yaw, c.pitch); q.setFromEuler(e); m4.compose(p.set(c.x, c.y, L.z + T.track * 1.8), q, s.set(1, 1, 1));
      this.cars[T.k].setMatrixAt(k, m4); this.wins.setMatrixAt(T.k * CARS + k, m4);
    });
    for (const m of this.cars) m.instanceMatrix.needsUpdate = true; this.wins.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.ctx.city.hooks.street = null; }
}
