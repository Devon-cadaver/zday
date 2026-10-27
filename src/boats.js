// Rescue boats for floods and tsunamis (the police speedboat and patrol boat
// from Sean's sheet). A boat comes in from the edge of the city along the
// flooded streets, idles where it was sent and pulls people out of the water
// and off low rooftops, then heads back out when it is full. In the Sandbox
// they come on their own to wherever people are stranded; in Commander the
// player sends them. Once there a boat works the area, motoring across to
// whoever it sees afloat. Life rafts (dropped from a helicopter) keep people
// afloat until a boat gets to them.
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';

const SPEED = 11;
const SWIM = 29; // people.js ST.SWIM
let RAFT = null;
function raftKit() {
  if (RAFT) return RAFT;
  RAFT = { ring: new THREE.TorusGeometry(1.5, 0.42, 8, 18).rotateX(Math.PI / 2), floor: new THREE.CircleGeometry(1.2, 14).rotateX(-Math.PI / 2), canopy: new THREE.ConeGeometry(1.1, 1.2, 10, 1, true).translate(0, 0.9, 0),
    orange: new THREE.MeshStandardMaterial({ color: '#ff6a1c', roughness: 0.6 }), dark: new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.9 }), yellow: new THREE.MeshStandardMaterial({ color: '#ffc21a', roughness: 0.6, side: THREE.DoubleSide }) };
  return RAFT;
}

export class Boats {
  constructor(D) { this.D = D; this.list = []; this.rafts = []; this.auto = true; this.autoT = 5; this.rescued = 0; }
  // enough water in the streets to run a boat
  get flooded() { const W = this.D.water; return W.active && W.level > 0.8; }
  wet(x, z) { const W = this.D.water; return W.levelAt(x, z) - this.D.ctx.people.groundY(x, z) > 0.6 || (W.front && W.levelAt(x, z) > 0); }

  send(x, z, o = {}) {
    const D = this.D, { traffic } = D.ctx;
    if (!this.flooded) return null;
    let route = null; const tried = new Set();
    for (let k = 0; k < 8 && !route; k++) { // come in from an edge that is under water
      const r = traffic.routeTo(x, z, tried); if (!r) break;
      tried.add(r[0]);
      const n0 = traffic.nodes[r[0]]; if (this.wet(n0.x, n0.z)) route = r;
    }
    if (!route) return null;
    const pts = route.map(k => [traffic.nodes[k].x, traffic.nodes[k].z]);
    const [ax, az] = pts[0], [bx, bz] = pts[1] || [x, z], dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz) || 1;
    pts.unshift([ax + dx / d * 70, az + dz / d * 70]); pts.push([x, z]);
    const big = o.kind === 'patrol', obj = buildVehicle(big ? 'patrol_boat' : 'police_speedboat');
    D.ctx.scene.add(obj);
    const b = { obj, pts, k: 1, x: pts[0][0], z: pts[0][1], yaw: Math.atan2(-(pts[1][1] - pts[0][1]), pts[1][0] - pts[0][0]), v: 0, state: 'out', big,
      cap: big ? 24 : 12, load: 0, t: 0, wakeT: 0, pickT: 0, onArrive: o.onArrive, onFull: o.onFull };
    this.list.push(b);
    return b;
  }

  // somewhere people are stuck: in deep water at street level or on a low roof
  stranded() {
    const { people, city } = this.D.ctx, W = this.D.water;
    for (let n = 0; n < 300; n++) {
      const j = Math.floor(Math.random() * people.active), s = people.st[j];
      if (people.kind[j] !== 0 || people.inf[j]) continue;
      if (people.lvl[j] === -1 && people.hittable(j) && s !== 6 && W.levelAt(people.x[j], people.z[j]) - people.groundY(people.x[j], people.z[j]) > 0.7) return [people.x[j], people.z[j]];
      if (s === 11 && people.lvl[j] >= 0) { const bd = city.buildings[people.lvl[j]]; if (bd && bd.top - bd.baseY < 13) return [people.x[j], people.z[j]]; }
    }
    return null;
  }

  // life rafts dropped round (x, z): people afloat nearby swim to one and hold on (not tiring) until picked up. The number holding on
  dropRafts(x, z) {
    const D = this.D, { people, scene } = D.ctx, K = raftKit(); let held = 0;
    for (let n = 0; n < 4; n++) {
      const a = n / 4 * 6.28 + Math.random() * 0.6, rx = x + Math.cos(a) * 9, rz = z + Math.sin(a) * 9;
      if (!this.wet(rx, rz) || !people.walkable(rx, rz)) continue;
      const g = new THREE.Group(); g.add(new THREE.Mesh(K.ring, K.orange), new THREE.Mesh(K.floor, K.dark), new THREE.Mesh(K.canopy, K.yellow)); g.position.set(rx, -5, rz); scene.add(g);
      const r = { g, x: rx, z: rz, t: 0, n: 0 }; this.rafts.push(r);
      D.water.splash.emit(rx, Math.max(0, D.water.level), rz, 14, { up: [2, 5], spread: 3, life: 1.2, size: 1.4 });
      people.around(rx, rz, 24, (j) => { // the six nearest swim over and hang on round the side
        if (people.st[j] !== SWIM || people.fx[j] !== 0 || r.n >= 6) return;
        const b = r.n / 6 * 6.28; people.fx[j] = 4; people.px[j] = rx + Math.cos(b) * 1.9; people.pz[j] = rz + Math.sin(b) * 1.9; people.t1[j] = Math.max(people.t1[j], 20); r.n++; held++;
      });
    }
    return held;
  }
  update(h) {
    const D = this.D, people = D.ctx.people, many = (people.stats.afloat || 0) > 40;
    if (this.auto && this.flooded && (this.autoT -= h) <= 0) {
      this.autoT = many ? 4 : 12;
      if (this.list.length < (many ? 8 : 4)) { const s = many && people.swimSpots(1)[0], p = s ? [s[0], s[1]] : this.stranded(); if (p) this.send(p[0], p[1], { kind: Math.random() < 0.4 ? 'patrol' : 'speed' }); }
    }
    for (let n = this.rafts.length - 1; n >= 0; n--) { // bobbing where they fell, gone once the water is
      const r = this.rafts[n]; r.t += h;
      if (!this.flooded || r.t > 150) { D.ctx.scene.remove(r.g); this.rafts.splice(n, 1); continue; }
      r.g.position.set(r.x, Math.max(0, D.water.level) - 0.15 + Math.sin(r.t * 1.8 + r.x) * 0.08, r.z); r.g.rotation.set(Math.sin(r.t * 1.3) * 0.06, r.t * 0.05, Math.cos(r.t * 1.1) * 0.06);
    }
    for (let n = this.list.length - 1; n >= 0; n--) {
      const b = this.list[n]; b.t += h;
      if (!this.flooded && b.state !== 'sink') { b.state = 'sink'; b.st = 0; } // the water has gone: it settles and is towed away
      if (b.state === 'out' || b.state === 'back') {
        const [tx, tz] = b.pts[b.k], dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
        let dy = Math.atan2(-dz, dx) - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        b.yaw += dy * Math.min(1, h * 2.2);
        const ahead = this.wet(b.x + Math.cos(b.yaw) * 8, b.z - Math.sin(b.yaw) * 8);
        const vmax = !ahead && b.state === 'out' ? 0 : Math.abs(dy) > 0.9 ? 3.5 : SPEED; // waits behind the front of a tsunami
        b.v += (vmax - b.v) * Math.min(1, h * 1.4);
        b.x += Math.cos(b.yaw) * b.v * h; b.z -= Math.sin(b.yaw) * b.v * h;
        if (d < (b.k === b.pts.length - 1 && b.state === 'out' ? 7 : 5)) {
          if (b.state === 'out') { if (b.k < b.pts.length - 1) b.k++; else { b.state = 'rescue'; b.rt = 0; if (b.onArrive) b.onArrive(b); } }
          else if (b.k > 0) b.k--;
          else { this.drop(n); continue; }
        }
      } else if (b.state === 'rescue') {
        b.rt += h;
        if ((b.pickT -= h) <= 0) {
          b.pickT = 0.5; const got = this.pickUp(b); if (!got) b.idle = (b.idle || 0) + 0.5; else b.idle = 0;
          if (!got && !b.goal) { const j = people.nearestSwimmer(b.x, b.z, 90); if (j >= 0) { b.goal = [people.x[j], people.z[j]]; b.idle = 0; } } // someone afloat in sight: over to them
        }
        if (b.goal) { // straight across the water to them, as long as the way is open water
          const dx = b.goal[0] - b.x, dz = b.goal[1] - b.z, d = Math.hypot(dx, dz);
          let dy = Math.atan2(-dz, dx) - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * Math.min(1, h * 2.5);
          const ax = b.x + Math.cos(b.yaw) * 6, az = b.z - Math.sin(b.yaw) * 6, open = this.wet(ax, az) && people.walkable(ax, az);
          b.v += ((open && Math.abs(dy) < 1.2 ? Math.min(7, d) : Math.abs(dy) >= 1.2 ? 1.5 : 0) - b.v) * Math.min(1, h * 1.5);
          b.x += Math.cos(b.yaw) * b.v * h; b.z -= Math.sin(b.yaw) * b.v * h;
          if (d < 6 || (!open && Math.abs(dy) < 1.2)) b.goal = null;
        } else { b.v *= Math.exp(-h * 2); b.yaw += Math.sin(b.t * 0.7) * h * 0.1; }
        if (b.load >= b.cap || b.rt > 70 || b.idle > 5) { b.state = 'back'; b.goal = null; b.k = b.pts.length - 2; if (b.onFull) b.onFull(b); }
      } else if (b.state === 'sink') {
        b.st += h; if (b.st > 3) { this.drop(n); continue; }
      }
      // a white wake behind it when it moves
      if (b.v > 3 && (b.wakeT -= h) <= 0) {
        b.wakeT = 0.08; const c = Math.cos(b.yaw), s = -Math.sin(b.yaw), back = b.big ? 5 : 3.8;
        D.water.splash.emit(b.x - c * back, D.water.level + 0.1, b.z - s * back, 3, { up: [1, 2.5], dir: [-c * 2, -s * 2], spread: 2, life: 1.0, size: 1.3 });
      }
    }
  }

  // pull people aboard: the nearest first, a few at a time
  pickUp(b) {
    const { people, city } = this.D.ctx, W = this.D.water;
    let got = 0;
    const board = (j) => { people.st[j] = 17; people.lvl[j] = -1; people.stats.rescued++; b.load++; got++; this.rescued++; };
    people.around(b.x, b.z, 13, (j) => {
      if (got >= 3 || b.load >= b.cap) return;
      if (!people.hittable(j) || people.kind[j] !== 0 || people.st[j] === 6 || people.inf[j]) return;
      if (W.levelAt(people.x[j], people.z[j]) - people.groundY(people.x[j], people.z[j]) > 0.3) board(j); // anyone in the water
    });
    if (got < 3 && b.load < b.cap) city.buildingsNear(b.x, b.z, 12, (k, d, bd) => {
      if (bd.top - bd.baseY > 13 || got >= 3) return; // low roofs only: they climb down into the boat
      people.around(b.x, b.z, 30, (j) => { if (got < 3 && b.load < b.cap && people.st[j] === 11 && !people.inf[j] && people.kind[j] === 0) board(j); }, k);
    });
    if (got) this.D.emit({ type: 'boatrescue', x: b.x, z: b.z, n: got });
    return got;
  }

  sync(dt, realT) {
    const W = this.D.water;
    for (const b of this.list) {
      const o = b.obj, sink = b.state === 'sink' ? b.st : 0;
      o.position.set(b.x, Math.max(W.level, 0) - 0.35 + Math.sin(realT * 1.7 + b.x) * 0.08 - sink * 0.6, b.z); // sits in the water to its waterline
      o.rotation.set(Math.sin(realT * 1.3 + b.z) * 0.03, b.yaw, Math.min(0.14, b.v * 0.012) + Math.sin(realT * 1.1) * 0.02, 'YXZ'); // the bow lifts at speed
    }
  }

  drop(n) { const b = this.list[n]; this.D.ctx.scene.remove(b.obj); b.obj.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); this.list.splice(n, 1); }
  reset() { for (let n = this.list.length - 1; n >= 0; n--) this.drop(n); for (const r of this.rafts) this.D.ctx.scene.remove(r.g); this.rafts.length = 0; this.autoT = 5; this.rescued = 0; }
}
