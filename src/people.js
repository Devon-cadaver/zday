// Civilians and zombies. Typed-array agent sim:
// civilians walk block perimeters or stand in crowds, panic and flee when they
// notice a zombie, get grabbed and bitten, carry the infection unseen for a
// while, then turn. Zombies wander the streets, chase, lunge and bite.
import * as THREE from 'three';
import { HALF, RW, CURB } from './city.js';
import { rng } from './textures.js';
import { personGeometry } from './traffic.js';

export const ST = { WALK: 0, IDLE: 1, FLEE: 2, RETURN: 3, GRABBED: 4, TURNING: 5, ZOMBIE: 6, FALLING: 7 };

// Zombie types. Level 1 is the Shambler.
export const ZTYPES = [{
  name: 'Shambler', wander: 0.55, chase: 1.3, lunge: 2.9, lungeR: 2.2, sight: 12, notice: 5.5, noticeP: 0.3,
  biteR: 0.75, biteT: 1.1, recover: 1.4, incubate: [10, 18], color: '#7e9a52',
}];

const PPL_COLS = ['#2b2522', '#3a3530', '#1f2630', '#26221f', '#e8e2d6', '#d9d0bf', '#8c2f25', '#33476b', '#b59a73', '#5a4a3a', '#6e2a3c', '#3d5a45'];
const RUN = [2.4, 3.2];
const SCREAM_R = 12, SCREAM_P = 0.65;
const CELL = 6, RES = 0.5;
const DROP_CAP = 64;

export class People {
  constructor(city, parent, opts = {}) {
    this.city = city;
    this.opts = opts;
    this.nWalk = opts.people ?? 3200;
    this.ztype = ZTYPES[0];
    this.buildWalkGrid();

    // count crowd members up front (same RNG as init)
    this.crowdPts = this.makeCrowds(rng(opts.seed ?? 99));
    this.nHuman = this.nWalk + this.crowdPts.length;
    const N = this.N = this.nHuman + DROP_CAP;
    this.x = new Float32Array(N); this.z = new Float32Array(N); this.y = new Float32Array(N);
    this.st = new Uint8Array(N); this.inf = new Uint8Array(N);
    this.t1 = new Float32Array(N); this.inc = new Float32Array(N); this.inc0 = new Float32Array(N);
    this.spd = new Float32Array(N); this.blk = new Int16Array(N); this.s = new Float32Array(N); this.lat = new Float32Array(N);
    this.hx = new Float32Array(N); this.hz = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.target = new Int32Array(N); this.think = new Float32Array(N); this.wt = new Float32Array(N);
    this.col = new Uint8Array(N); this.dirty = new Uint8Array(N);

    // spatial hash
    const B = city.bounds;
    this.hx0 = B.x0 - HALF; this.hz0 = B.z0 - HALF;
    this.hw = Math.ceil((B.x1 - B.x0 + 2 * HALF) / CELL) + 1;
    this.hh = Math.ceil((B.z1 - B.z0 + 2 * HALF) / CELL) + 1;
    this.head = new Int32Array(this.hw * this.hh);
    this.next = new Int32Array(N);

    // meshes
    this.mesh = new THREE.InstancedMesh(personGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), N);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    const ringG = new THREE.RingGeometry(0.95, 1.3, 20); ringG.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }), N);
    this.rings.frustumCulled = false; this.rings.renderOrder = 2;
    this.rings.setColorAt(0, new THREE.Color());
    parent.add(this.rings);
    const bloodG = new THREE.CircleGeometry(1, 12); bloodG.rotateX(-Math.PI / 2);
    this.bloodMax = 900;
    this.blood = new THREE.InstancedMesh(bloodG, new THREE.MeshStandardMaterial({ color: '#5c0d08', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), this.bloodMax);
    this.blood.count = 0; this.blood.frustumCulled = false; this.blood.receiveShadow = true;
    parent.add(this.blood);
    this.dust = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#efe0c0', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; parent.add(m); this.dust.push({ m, t: 1 });
    }

    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YZX');
    this._p = new THREE.Vector3(); this._p2 = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color(); this._c2 = new THREE.Color();
    this.pal = PPL_COLS.map(h => new THREE.Color(h));
    this.zcol = new THREE.Color(this.ztype.color);
    this.reset();
  }

  // ---------- setup
  makeCrowds(r) {
    const pts = [];
    for (const c of this.city.crowds) {
      for (let k = 0; k < c.n; k++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c.rad;
        pts.push([c.x + Math.cos(a) * d, c.y, c.z + Math.sin(a) * d]);
      }
    }
    const blocks = this.city.walkBlocks;
    for (let k = 0; k < 320; k++) {
      const b = blocks[Math.floor(r() * blocks.length)]; const n = 3 + Math.floor(r() * 10);
      const cx = r() < 0.5 ? b.x0 : b.x1, cz = r() < 0.5 ? b.z0 : b.z1;
      for (let m = 0; m < n; m++) pts.push([cx + (r() - 0.5) * 3, CURB, cz + (r() - 0.5) * 3]);
    }
    return pts;
  }

  buildWalkGrid() {
    const { sx, sz, NB, open } = this.city;
    this.gx0 = sx[0] - HALF; this.gz0 = sz[0] - HALF;
    this.gw = Math.ceil((sx[NB] - sx[0] + 2 * HALF) / RES) + 1;
    this.gh = Math.ceil((sz[NB] - sz[0] + 2 * HALF) / RES) + 1;
    const corrX = new Uint8Array(this.gw), corrZ = new Uint8Array(this.gh);
    const roadX = new Uint8Array(this.gw), roadZ = new Uint8Array(this.gh);
    const near = (v, lines) => { let d = 1e9; for (const l of lines) d = Math.min(d, Math.abs(v - l)); return d; };
    for (let c = 0; c < this.gw; c++) { const d = near(this.gx0 + (c + 0.5) * RES, sx); corrX[c] = d < HALF - 0.35 ? 1 : 0; roadX[c] = d < RW / 2 ? 1 : 0; }
    for (let c = 0; c < this.gh; c++) { const d = near(this.gz0 + (c + 0.5) * RES, sz); corrZ[c] = d < HALF - 0.35 ? 1 : 0; roadZ[c] = d < RW / 2 ? 1 : 0; }
    const g = new Uint8Array(this.gw * this.gh); // bit0 walkable, bit1 road
    for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) {
      g[j * this.gw + i] = ((corrX[i] | corrZ[j]) ? 1 : 0) | ((roadX[i] | roadZ[j]) ? 2 : 0);
    }
    for (const o of open) {
      const i0 = Math.ceil((o.x0 + 0.4 - this.gx0) / RES), i1 = Math.floor((o.x1 - 0.4 - this.gx0) / RES);
      const j0 = Math.ceil((o.z0 + 0.4 - this.gz0) / RES), j1 = Math.floor((o.z1 - 0.4 - this.gz0) / RES);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * this.gw + i] |= 1;
    }
    this.grid = g;
  }

  cellOf(x, z) {
    const i = Math.floor((x - this.gx0) / RES), j = Math.floor((z - this.gz0) / RES);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return -1;
    return j * this.gw + i;
  }
  walkable(x, z) { const c = this.cellOf(x, z); return c >= 0 && (this.grid[c] & 1) === 1; }
  groundY(x, z) { const c = this.cellOf(x, z); return c >= 0 && (this.grid[c] & 2) ? 0 : CURB; }

  // nearest walkable point within maxR of (x,z), or null
  snapWalkable(x, z, maxR = 30) {
    if (this.walkable(x, z)) return [x, z];
    for (let r = 0.5; r <= maxR; r += 0.5) {
      const n = Math.max(8, Math.round(r * 6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.walkable(px, pz)) return [px, pz];
      }
    }
    return null;
  }

  reset() {
    const r = this.r = rng(this.opts.seed ?? 99);
    this.makeCrowds(r); // keep the RNG stream identical to the constructor's crowd pass
    const blocks = this.blocks = this.city.walkBlocks.map(b => ({ ...b, w: b.x1 - b.x0, d: b.z1 - b.z0, P: 2 * (b.x1 - b.x0 + b.z1 - b.z0) }));
    const totalP = blocks.reduce((a, b) => a + b.P, 0);
    for (let k = 0; k < this.nWalk; k++) {
      let t = r() * totalP, bi = 0;
      while (t > blocks[bi].P && bi < blocks.length - 1) { t -= blocks[bi].P; bi++; }
      this.st[k] = ST.WALK; this.blk[k] = bi; this.s[k] = t;
      this.spd[k] = (0.9 + r() * 0.8) * (r() < 0.5 ? 1 : -1);
      this.lat[k] = (r() - 0.5) * 2.2;
      this.walkPos(k);
    }
    for (let k = 0; k < this.crowdPts.length; k++) {
      const i = this.nWalk + k, c = this.crowdPts[k];
      this.st[i] = ST.IDLE; this.x[i] = c[0]; this.z[i] = c[2]; this.y[i] = c[1];
      this.spd[i] = 0.9 + r() * 0.7; this.lat[i] = (r() - 0.5) * 2.2;
    }
    this.dirty.fill(0);
    for (let i = 0; i < this.N; i++) {
      this.inf[i] = 0; this.target[i] = -1; this.t1[i] = 0; this.think[i] = r() * 0.4;
      this.col[i] = Math.floor(r() * PPL_COLS.length);
      this.mesh.setColorAt(i, this.pal[this.col[i]]);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.active = this.nHuman;
    this.drops = 0;
    this.bloodN = 0; this.blood.count = 0;
    this.time = 0;
    this.stats = { humans: this.nHuman, infected: 0, zombies: 0, bites: 0 };
    this.events = [];
    for (const d of this.dust) { d.m.visible = false; d.t = 1; }
    this.sync(0);
  }

  // ---------- helpers
  walkPos(i) {
    const b = this.blocks[this.blk[i]], lat = this.lat[i] * 0.5;
    let s = ((this.s[i] % b.P) + b.P) % b.P, x, z;
    if (s < b.w) { x = b.x0 + s; z = b.z0 - lat; }
    else if ((s -= b.w) < b.d) { x = b.x1 + lat; z = b.z0 + s; }
    else if ((s -= b.d) < b.w) { x = b.x1 - s; z = b.z1 + lat; }
    else { s -= b.w; x = b.x0 - lat; z = b.z1 - s; }
    this.x[i] = x; this.z[i] = z; this.y[i] = CURB;
  }

  // move agent i along (dx,dz) by dist with wall sliding; false if fully blocked
  move(i, dx, dz, dist) {
    const x = this.x[i], z = this.z[i];
    const nx = x + dx * dist, nz = z + dz * dist;
    if (!this.walkable(x, z) || this.walkable(nx, nz)) { this.x[i] = nx; this.z[i] = nz; }
    else if (Math.abs(dx) > 0.05 && this.walkable(nx, z)) { this.x[i] = nx; }
    else if (Math.abs(dz) > 0.05 && this.walkable(x, nz)) { this.z[i] = nz; }
    else return false;
    this.y[i] = this.groundY(this.x[i], this.z[i]);
    return true;
  }

  isPrey(j) { const s = this.st[j]; return (s === ST.WALK || s === ST.IDLE || s === ST.FLEE || s === ST.RETURN) && !this.inf[j]; }
  isCivilian(j) { const s = this.st[j]; return s === ST.WALK || s === ST.IDLE || s === ST.FLEE || s === ST.RETURN; }

  buildHash() {
    this.head.fill(-1);
    const { hx0, hz0, hw, hh } = this;
    for (let i = 0; i < this.active; i++) {
      if (!this.isCivilian(i)) continue;
      const cx = Math.floor((this.x[i] - hx0) / CELL), cz = Math.floor((this.z[i] - hz0) / CELL);
      if (cx < 0 || cz < 0 || cx >= hw || cz >= hh) continue;
      const c = cz * hw + cx;
      this.next[i] = this.head[c]; this.head[c] = i;
    }
  }

  // visit civilians within R of (x,z)
  around(x, z, R, fn) {
    const { hx0, hz0, hw, hh } = this;
    const c0 = Math.max(0, Math.floor((x - R - hx0) / CELL)), c1 = Math.min(hw - 1, Math.floor((x + R - hx0) / CELL));
    const r0 = Math.max(0, Math.floor((z - R - hz0) / CELL)), r1 = Math.min(hh - 1, Math.floor((z + R - hz0) / CELL));
    const R2 = R * R;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      for (let j = this.head[rr * hw + cc]; j >= 0; j = this.next[j]) {
        const dx = this.x[j] - x, dz = this.z[j] - z, d2 = dx * dx + dz * dz;
        if (d2 <= R2) fn(j, d2, dx, dz);
      }
    }
  }

  panic(j, fromX, fromZ, threat) {
    if (!this.isCivilian(j)) return; // state may have changed earlier this tick
    let dx = this.x[j] - fromX, dz = this.z[j] - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    dx = dx / d + (this.r() - 0.5) * 0.5; dz = dz / d + (this.r() - 0.5) * 0.5;
    const n = Math.hypot(dx, dz) || 1;
    this.hx[j] = dx / n; this.hz[j] = dz / n;
    if (this.st[j] !== ST.FLEE) this.tx[j] = RUN[0] + this.r() * (RUN[1] - RUN[0]); // run speed stored in tx while fleeing
    this.st[j] = ST.FLEE; this.t1[j] = 4 + this.r() * 4; this.target[j] = threat;
  }

  startReturn(i) {
    // nearest point on any block's walking loop
    const x = this.x[i], z = this.z[i];
    let best = 1e18, bb = 0, bs = 0;
    for (let k = 0; k < this.blocks.length; k++) {
      const b = this.blocks[k];
      if (x < b.x0 - 25 || x > b.x1 + 25 || z < b.z0 - 25 || z > b.z1 + 25) continue;
      const cx = Math.min(Math.max(x, b.x0), b.x1), cz = Math.min(Math.max(z, b.z0), b.z1);
      const cand = [[Math.abs(cz - b.z0) + Math.abs(x - cx) + Math.abs(z - b.z0), cx - b.x0],
        [Math.abs(x - b.x1) + Math.abs(z - cz), b.w + (cz - b.z0)],
        [Math.abs(z - b.z1) + Math.abs(x - cx), b.w + b.d + (b.x1 - cx)],
        [Math.abs(x - b.x0) + Math.abs(z - cz), 2 * b.w + b.d + (b.z1 - cz)]];
      for (const [d, s] of cand) if (d < best) { best = d; bb = k; bs = s; }
    }
    this.blk[i] = bb; this.s[i] = bs;
    const sx = this.x[i], sz = this.z[i];
    this.walkPos(i);
    this.tx[i] = this.x[i]; this.tz[i] = this.z[i];
    this.x[i] = sx; this.z[i] = sz;
    this.st[i] = ST.RETURN;
  }

  addBlood(x, z, size) {
    const k = this.bloodN % this.bloodMax; this.bloodN++;
    const m = this._m4, q = this._q;
    this._e.set(0, this.r() * 6.28, 0); q.setFromEuler(this._e);
    m.compose(this._p.set(x, this.groundY(x, z) + 0.025, z), q, this._p2.set(size, 1, size * (0.6 + this.r() * 0.5)));
    this.blood.setMatrixAt(k, m);
    this.blood.count = Math.min(this.bloodN, this.bloodMax);
    this.blood.instanceMatrix.needsUpdate = true;
  }

  puff(x, z) {
    const d = this.dust.find(o => o.t >= 1) || this.dust[0];
    d.t = 0; d.m.visible = true; d.m.position.set(x, this.groundY(x, z) + 0.05, z);
  }

  // ---------- player actions
  drop(x, z) {
    const p = this.snapWalkable(x, z);
    if (!p || this.drops >= DROP_CAP) return -1;
    const i = this.active++;
    this.drops++;
    this.st[i] = ST.FALLING; this.x[i] = p[0]; this.z[i] = p[1]; this.t1[i] = 0.75;
    this.y[i] = this.groundY(p[0], p[1]) + 30;
    this.target[i] = -1; this.inf[i] = 0; this.think[i] = 0; this.wt[i] = 0;
    this.mesh.setColorAt(i, this.zcol); this.mesh.instanceColor.needsUpdate = true; this.dirty[i] = 2;
    return i;
  }

  // ---------- simulation
  step(h) {
    this.time += h;
    this.buildHash();
    const Z = this.ztype;
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      if (s === ST.WALK) {
        this.s[i] += this.spd[i] * h; this.walkPos(i);
      } else if (s === ST.FLEE) {
        const tg = this.target[i];
        if (tg >= 0 && this.st[tg] === ST.ZOMBIE && (this.think[i] -= h) <= 0) {
          this.think[i] = 0.4;
          const dx = this.x[i] - this.x[tg], dz = this.z[i] - this.z[tg], d = Math.hypot(dx, dz);
          if (d < 14 && d > 0.01) { this.hx[i] = this.hx[i] * 0.4 + dx / d * 0.6; this.hz[i] = this.hz[i] * 0.4 + dz / d * 0.6; const n = Math.hypot(this.hx[i], this.hz[i]) || 1; this.hx[i] /= n; this.hz[i] /= n; }
        }
        if (!this.move(i, this.hx[i], this.hz[i], this.tx[i] * h)) {
          // cornered: pick a free cardinal direction
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (let k = 0; k < 4; k++) { const d = dirs[(k + Math.floor(this.r() * 4)) % 4]; if (this.walkable(this.x[i] + d[0], this.z[i] + d[1])) { this.hx[i] = d[0]; this.hz[i] = d[1]; break; } }
        }
        if ((this.t1[i] -= h) <= 0) this.startReturn(i);
      } else if (s === ST.RETURN) {
        const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
        const v = Math.abs(this.spd[i]) * h;
        if (d <= v + 0.05) { this.st[i] = ST.WALK; this.walkPos(i); }
        else if (!this.move(i, dx / d, dz / d, v)) { this.x[i] = this.tx[i]; this.z[i] = this.tz[i]; }
      } else if (s === ST.GRABBED) {
        if ((this.t1[i] -= h) <= 0) {
          this.inf[i] = 1;
          this.inc[i] = this.inc0[i] = Z.incubate[0] + this.r() * (Z.incubate[1] - Z.incubate[0]);
          const b = this.target[i];
          this.st[i] = ST.IDLE; // released: a civilian again (now infected) so it can run
          this.panic(i, b >= 0 ? this.x[b] : this.x[i] + 1, b >= 0 ? this.z[b] : this.z[i], b);
          this.t1[i] = 3 + this.r() * 3;
        }
      } else if (s === ST.TURNING) {
        if ((this.t1[i] -= h) <= 0) { this.st[i] = ST.ZOMBIE; this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0; this.events.push({ type: 'turned', i }); }
      } else if (s === ST.ZOMBIE) {
        this.zombieStep(i, h, Z);
      } else if (s === ST.FALLING) {
        this.t1[i] -= h;
        const g = this.groundY(this.x[i], this.z[i]);
        const t = Math.max(0, this.t1[i] / 0.75);
        this.y[i] = g + 30 * t * t;
        if (this.t1[i] <= 0) {
          this.y[i] = g; this.st[i] = ST.ZOMBIE; this.t1[i] = 0.6; this.think[i] = 0;
          this.puff(this.x[i], this.z[i]);
          const zx = this.x[i], zz = this.z[i];
          this.around(zx, zz, 7, (j) => { if (this.r() < 0.45) this.panic(j, zx, zz, i); });
          this.events.push({ type: 'landed', i });
        }
      }
      // incubation
      if (this.inf[i] && s !== ST.GRABBED && s !== ST.TURNING && s !== ST.ZOMBIE) {
        this.inc[i] -= h;
        this.dirty[i] = 1;
        if (this.inc[i] <= 0) {
          this.inf[i] = 0; this.st[i] = ST.TURNING; this.t1[i] = 1.4;
          this.y[i] = this.groundY(this.x[i], this.z[i]);
          const zx = this.x[i], zz = this.z[i];
          this.around(zx, zz, 8, (j) => { if (this.r() < 0.5) this.panic(j, zx, zz, i); });
        }
      }
    }
    // dust rings
    for (const d of this.dust) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + h / 0.9);
      const k = 1 + d.t * 5; d.m.scale.set(k, 1, k); d.m.material.opacity = 0.75 * (1 - d.t);
      if (d.t >= 1) d.m.visible = false;
    }
  }

  zombieStep(i, h, Z) {
    if (this.t1[i] > 0) { this.t1[i] -= h; return; } // biting or recovering
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.3 + this.r() * 0.2;
      const zx = this.x[i], zz = this.z[i];
      let tg = this.target[i];
      if (tg >= 0) {
        const d = Math.hypot(this.x[tg] - zx, this.z[tg] - zz);
        if (!this.isPrey(tg) || d > Z.sight * 1.4) tg = -1;
      }
      let best = Z.sight * Z.sight, bi = tg;
      const n2 = Z.notice * Z.notice;
      this.around(zx, zz, Z.sight, (j, d2) => {
        if (d2 < n2 && this.st[j] !== ST.FLEE && this.r() < Z.noticeP) this.panic(j, zx, zz, i);
        if (tg < 0 && d2 < best && this.isPrey(j)) { best = d2; bi = j; }
      });
      this.target[i] = bi;
    }
    const tg = this.target[i];
    if (tg >= 0 && this.isPrey(tg)) {
      const dx = this.x[tg] - this.x[i], dz = this.z[tg] - this.z[i], d = Math.hypot(dx, dz) || 0.001;
      this.hx[i] = dx / d; this.hz[i] = dz / d;
      if (d < Z.biteR) { this.bite(i, tg, Z); return; }
      const v = d < Z.lungeR ? Z.lunge : Z.chase;
      if (!this.move(i, dx / d, dz / d, v * h)) this.target[i] = -1;
    } else {
      this.target[i] = -1;
      this.wt[i] -= h;
      if (this.wt[i] <= 0 || !this.move(i, this.hx[i], this.hz[i], Z.wander * h)) {
        // wander along a street: pick a walkable cardinal heading
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < 6; k++) {
          const d = dirs[Math.floor(this.r() * 4)];
          if (this.walkable(this.x[i] + d[0] * 3, this.z[i] + d[1] * 3)) { this.hx[i] = d[0]; this.hz[i] = d[1]; break; }
        }
        this.wt[i] = 3 + this.r() * 6;
      }
    }
  }

  bite(i, j, Z) {
    this.st[j] = ST.GRABBED; this.t1[j] = Z.biteT; this.target[j] = i;
    this.t1[i] = Z.biteT + Z.recover; this.target[i] = -1;
    this.addBlood(this.x[j], this.z[j], 0.6 + this.r() * 0.6);
    this.stats.bites++;
    const bx = this.x[j], bz = this.z[j];
    this.around(bx, bz, SCREAM_R, (k) => { if (k !== j && this.r() < SCREAM_P) this.panic(k, bx, bz, i); });
    this.events.push({ type: 'bite', i, j, x: bx, z: bz });
  }

  // ---------- render sync
  sync(camDist = 300) {
    this.ringScale = Math.min(2.2, Math.max(0.8, camDist / 220));
    this.rings.material.opacity = camDist > 400 ? 0.55 : 0.8;
    const arr = this.mesh.instanceMatrix.array;
    const m = this._m4, q = this._q, e = this._e, p = this._p, one = this._one;
    let humans = 0, infected = 0, zombies = 0, rings = 0, colDirty = false;
    const t = this.time;
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      const o = i * 16;
      if (s === ST.ZOMBIE || s === ST.TURNING || s === ST.FALLING || s === ST.GRABBED) {
        let yaw = Math.atan2(-this.hz[i], this.hx[i]), tilt = 0, y = this.y[i];
        if (s === ST.ZOMBIE) tilt = -0.32 + Math.sin(t * 5 + i) * 0.06;
        else if (s === ST.TURNING) tilt = Math.sin(t * 14 + i) * 0.35;
        else if (s === ST.GRABBED) tilt = 0.25;
        e.set(0, yaw, tilt); q.setFromEuler(e);
        m.compose(p.set(this.x[i], y, this.z[i]), q, one);
        m.toArray(arr, o);
      } else {
        arr[o] = 1; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = 1;
        arr[o + 12] = this.x[i]; arr[o + 13] = this.y[i]; arr[o + 14] = this.z[i];
      }
      if (s === ST.ZOMBIE || s === ST.FALLING || s === ST.TURNING) {
        zombies++;
        if (s !== ST.FALLING) this.ringAt(rings++, i, 0);
        if (this.dirty[i] !== 2) { this.mesh.setColorAt(i, this.zcol); this.dirty[i] = 2; colDirty = true; }
      } else {
        if (this.inf[i] || s === ST.GRABBED) { infected++; this.ringAt(rings++, i, 1); } else humans++;
        if (this.dirty[i] === 1 && this.inf[i]) {
          const k = Math.min(1, Math.max(0, 1 - this.inc[i] / this.inc0[i]));
          this._c.copy(this.pal[this.col[i]]).lerp(this.zcol, Math.max(0, (k - 0.55) / 0.45));
          this.mesh.setColorAt(i, this._c); colDirty = true; this.dirty[i] = 0;
        }
      }
    }
    this.mesh.count = this.active;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colDirty) this.mesh.instanceColor.needsUpdate = true;
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.stats.humans = humans; this.stats.infected = infected; this.stats.zombies = zombies;
  }

  ringAt(k, i, kind) {
    const arr = this.rings.instanceMatrix.array, o = k * 16;
    const sc = (kind === 0 ? 1 + Math.sin(this.time * 4 + i) * 0.08 : 0.7) * this.ringScale;
    arr.fill(0, o, o + 16);
    arr[o] = sc; arr[o + 5] = 1; arr[o + 10] = sc; arr[o + 15] = 1;
    arr[o + 12] = this.x[i]; arr[o + 13] = this.groundY(this.x[i], this.z[i]) + 0.06; arr[o + 14] = this.z[i];
    this.rings.setColorAt(k, kind === 0 ? (this._zr || (this._zr = new THREE.Color('#a6ff4d'))) : (this._ir || (this._ir = new THREE.Color('#ffc233'))));
  }

  nearestZombie(x, z, skip = -1) {
    let best = 1e18, bi = -1;
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== ST.ZOMBIE || i === skip) continue;
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }
}
