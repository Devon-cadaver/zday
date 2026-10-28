// A chemical tanker crash: how a zombie outbreak starts. A tanker barrels down a
// street out of control, jackknifes and rolls onto its side with a bang, and a
// green cloud creeps out of the split tank for half a minute. Whoever breathes it
// is infected (they run, then turn a little later) and the bites carry it on from
// there. The wreck stays until the city is reset.
import * as THREE from 'three';
import { KIND } from './people.js';

const GAS = new THREE.Color('#9ad84e');
let PUFF = null;
function puffTexture() {
  if (PUFF) return PUFF;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (PUFF = new THREE.CanvasTexture(c));
}

// the tanker, nose along +x: a red cab, a steel tank with a green band and hazard diamonds, ten wheels
function tankerMesh() {
  const g = new THREE.Group(), mat = (col, rough = 0.6) => new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: 0.1 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(9.4, 0.45, 2.1), mat('#2a2a2a'), 0, 0.78, 0); // chassis
  add(new THREE.BoxGeometry(2.2, 2.2, 2.3), mat('#c4352a'), 4.3, 1.95, 0); // cab
  add(new THREE.BoxGeometry(0.08, 0.8, 1.9), mat('#9cc0cc', 0.2), 5.42, 2.35, 0); // windscreen
  add(new THREE.CylinderGeometry(1.15, 1.15, 6.8, 18).rotateZ(Math.PI / 2), mat('#d6d9d5', 0.35), -1, 2.2, 0); // the tank
  add(new THREE.CylinderGeometry(1.18, 1.18, 0.9, 18).rotateZ(Math.PI / 2), mat('#6fbf2a'), -1, 2.2, 0); // its band
  for (const s of [-1, 1]) { const d = add(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ color: '#ffd23a', side: THREE.DoubleSide }), -2.6, 2.2, s * 1.17); d.rotation.z = Math.PI / 4; }
  const wheel = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10).rotateX(Math.PI / 2), black = mat('#141414', 0.9);
  for (const x of [4.3, 1.4, 0.2, -3.1, -4.3]) for (const z of [-1.05, 1.05]) add(wheel, black, x, 0.5, z);
  return g;
}

export class Spill {
  constructor(D, x, z, opts = {}) {
    this.type = 'spill'; this.D = D; this.alive = true; this.t = 0;
    const { city, scene } = D.ctx;
    // the street it comes down: the nearest street line, in one of its lanes
    let bx = 1e9, bi = 0, bz = 1e9, bj = 0;
    city.sx.forEach((v, i) => { if (Math.abs(v - x) < bx) { bx = Math.abs(v - x); bi = i; } });
    city.sz.forEach((v, j) => { if (Math.abs(v - z) < bz) { bz = Math.abs(v - z); bj = j; } });
    const ns = bx < bz, lane = 2.15 * (Math.random() < 0.5 ? 1 : -1), dir = Math.random() < 0.5 ? 1 : -1;
    this.x = ns ? city.sx[bi] + lane : x; this.z = ns ? z : city.sz[bj] + lane;
    this.dx = ns ? 0 : dir; this.dz = ns ? dir : 0; this.yaw = Math.atan2(-this.dz, this.dx);
    this.mesh = tankerMesh(); scene.add(this.mesh);
    this.phase = 'drive'; this.dist = 75; this.spin = 0; this.roll = 0; this.slide = 0;
    this.R = 0; this.inc = opts.inc || [9, 16]; this.left = opts.max ?? 22; this.quiet = !!opts.quiet;
    this.puffs = []; this.puffT = 0; this.tick = 0;
    this.pose();
  }
  poi() { return { x: this.x, z: this.z, danger: 22, range: 120 }; }
  pose() {
    const m = this.mesh, d = this.phase === 'drive' ? this.dist : -this.slide;
    m.position.set(this.x - this.dx * d, this.roll * 1.1, this.z - this.dz * d);
    m.rotation.set(0, this.yaw + this.spin, 0); m.rotateX(this.roll * (Math.PI / 2) * 0.96); // over onto its side
  }
  update(h) {
    const D = this.D, { people, fire } = D.ctx;
    this.t += h;
    if (this.phase === 'drive') { // out of control down the street
      this.dist -= 28 * h; this.spin = Math.sin(this.t * 9) * 0.07;
      if (this.dist <= 0) {
        this.phase = 'crash'; this.ct = 0; this.dist = 0;
        D.emit({ type: 'crash', x: this.x, z: this.z }); D.emit({ type: 'boom', x: this.x, z: this.z });
        if (fire.burst) fire.burst(this.x, 1.5, this.z);
        people.scare(this.x, this.z, 30, 1);
        if (!this.quiet) D.emit({ type: 'warn', hazard: 'zombies', x: this.x, z: this.z, r: 40, exact: true, text: 'A chemical tanker has crashed in the ' + D.district(this.x, this.z) + ' district! Its gas is turning people into zombies. Keep everyone away' });
      }
    } else if (this.phase === 'crash') { // jackknifing and rolling over, sliding on
      this.ct += h; const k = Math.min(1, this.ct / 0.9), e = 1 - Math.pow(1 - k, 2);
      this.spin = 0.65 * e; this.roll = e; this.slide = 7 * e;
      if (k >= 1) { this.phase = 'gas'; this.gt = 0; }
    } else if (this.phase === 'gas') { // the cloud creeps out, holds, thins
      this.gt += h; const life = 30;
      this.R = 24 * Math.min(1, this.gt / 8) * (this.gt > life - 6 ? Math.max(0, (life - this.gt) / 6) : 1);
      if ((this.tick -= h) <= 0 && this.left > 0 && this.R > 3) { // breathing it in
        this.tick = 0.5;
        people.around(this.x, this.z, this.R, (j) => {
          if (this.left <= 0 || people.kind[j] !== KIND.CIVILIAN || people.inf[j] || !people.isPrey(j) || Math.random() > 0.22) return;
          people.inf[j] = 1; people.inc[j] = people.inc0[j] = this.inc[0] + Math.random() * (this.inc[1] - this.inc[0]); people.dirty[j] = 1;
          people.panic(j, this.x, this.z, -1); this.left--;
        });
      }
      if (this.gt >= life) { this.phase = 'done'; this.alive = false; }
    }
    this.pose();
  }
  sync(dt) {
    const scene = this.D.ctx.scene;
    if (this.phase === 'gas' && (this.puffT -= dt) <= 0 && this.R > 1) { // a new wisp from the split tank, drifting out
      this.puffT = 0.09;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: GAS, transparent: true, depthWrite: false, opacity: 0 }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * this.R * 0.35;
      s.position.set(this.x + Math.cos(a) * r, 0.8, this.z + Math.sin(a) * r); scene.add(s);
      this.puffs.push({ s, t: 0, life: 3.5 + Math.random() * 2, vx: Math.cos(a) * this.R * 0.18, vz: Math.sin(a) * this.R * 0.18 });
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]; p.t += dt; const k = p.t / p.life;
      p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y = 0.8 + k * 2.5;
      p.s.scale.setScalar(4 + k * 11); p.s.material.opacity = 0.7 * Math.min(1, p.t * 3) * (1 - k);
      if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); this.puffs.splice(i, 1); }
    }
  }
  // the cloud goes; the wreck stays on the street until the city is reset
  dispose() {
    const D = this.D, scene = D.ctx.scene, mesh = this.mesh;
    for (const p of this.puffs) { scene.remove(p.s); p.s.material.dispose(); } this.puffs.length = 0;
    if (this.phase === 'done') D.leftovers.push({ alive: true, sync() {}, dispose() { scene.remove(mesh); } });
    else scene.remove(mesh);
  }
}
