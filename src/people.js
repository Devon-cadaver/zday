// Civilians and zombies. Typed-array agent sim.
// Civilians walk block loops or stand in crowds, panic and flee when they notice
// a zombie, and when the outbreak is close they run into a building and up to
// the roof. Bitten civilians carry the infection unseen, then turn. Zombies
// wander, chase, lunge and bite; when survivors sit on a roof they pile up
// against the wall like ants until the pile reaches the roof, then climb over.
import * as THREE from 'three';
import { HALF, RW, CURB } from './city.js';
import { rng } from './textures.js';
import { personGeometry } from './traffic.js';

export const ST = { WALK: 0, IDLE: 1, FLEE: 2, RETURN: 3, GRABBED: 4, TURNING: 5, ZOMBIE: 6, FALLING: 7, DEAD: 8, SEEK: 9, INSIDE: 10, ROOF: 11, PILE: 12, CLIMB: 13, JUMP: 14 };

// Zombie types. Level 1 is the Shambler.
export const ZTYPES = [{
  name: 'Shambler', wander: 0.55, chase: 1.3, lunge: 2.9, lungeR: 2.2, sight: 12, notice: 5.5, noticeP: 0.3,
  biteR: 0.75, biteT: 1.1, recover: 1.4, incubate: [10, 18], color: '#7e9a52',
}];

const PPL_COLS = ['#2b2522', '#3a3530', '#1f2630', '#26221f', '#e8e2d6', '#d9d0bf', '#8c2f25', '#33476b', '#b59a73', '#5a4a3a', '#6e2a3c', '#3d5a45'];
const RUN = [2.4, 3.2];
const SCREAM_R = 12, SCREAM_P = 0.65;
const CELL = 6, RES = 0.5, RCELL = 25;
const DROP_CAP = 64;
const G = 9.8;
const pileH = (n) => 1.7 * Math.sqrt(n) + 0.5;
const pileR = (n) => pileH(n) * 0.65 + 1.0;

const S = ST;

// half cone (flat side at x=0, bulging toward +x), unit radius and height, lumpy, mottled
// a tangle of bodies: limbs and torsos in zombie greens, rags and shadow
function bodiesTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = rng(91);
  g.fillStyle = '#17150f'; g.fillRect(0, 0, 256, 256);
  const cols = ['#6f8a48', '#7e9a52', '#5d7440', '#8a9a62', '#4f5f36', '#6b5a44', '#3e4a5a', '#7a3a30', '#8c8574', '#556b3a'];
  for (let i = 0; i < 520; i++) {
    const x = r() * 256, y = r() * 256, w = 3 + r() * 9, h = 8 + r() * 22, a = r() * Math.PI;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(1.5, 2, w, h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,230,0.18)'; g.beginPath(); g.ellipse(-w * 0.3, -h * 0.3, w * 0.4, h * 0.5, 0, 0, Math.PI * 2); g.fill();
    if (r() < 0.35) { g.fillStyle = '#9aa36e'; g.beginPath(); g.arc(0, -h, w * 0.8, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3);
  t.anisotropy = 4;
  return t;
}

function moundGeometry() {
  const g = new THREE.CylinderGeometry(0.12, 1, 1, 22, 8, true, 0, Math.PI);
  g.translate(0, 0.5, 0);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const r = rng(77);
  const pal = [[1, 1, 1], [0.85, 0.85, 0.82], [0.7, 0.72, 0.68], [0.95, 0.9, 0.85], [0.78, 0.8, 0.75]];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 0.02 && y < 0.98 && x > 0.05) {
      const k = 1 + (r() - 0.5) * 0.34;
      pos.setXYZ(i, x * k, y + (r() - 0.5) * 0.08, z * k);
    }
    const c = pal[Math.floor(r() * pal.length)];
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const CIV = new Uint8Array(16); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.ROOF].forEach(s => { CIV[s] = 1; });
const INHASH = new Uint8Array(16); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.ROOF, S.GRABBED, S.TURNING, S.ZOMBIE].forEach(s => { INHASH[s] = 1; });
const HITTABLE = new Uint8Array(16); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.GRABBED, S.TURNING, S.ZOMBIE].forEach(s => { HITTABLE[s] = 1; });

export class People {
  constructor(city, parent, opts = {}) {
    this.city = city;
    this.opts = opts;
    this.nWalk = opts.people ?? 3200;
    this.ztype = ZTYPES[0];
    this.fire = null; this.onOverrun = null;
    this.buildWalkGrid();
    this.setupBuildings();

    this.crowdPts = this.makeCrowds(rng(opts.seed ?? 99));
    this.nHuman = this.nWalk + this.crowdPts.length;
    const N = this.N = this.nHuman + DROP_CAP;
    const F = () => new Float32Array(N);
    this.x = F(); this.z = F(); this.y = F(); this.t1 = F(); this.inc = F(); this.inc0 = F(); this.spd = F(); this.s = F(); this.lat = F();
    this.hx = F(); this.hz = F(); this.tx = F(); this.tz = F(); this.think = F(); this.wt = F();
    this.st = new Uint8Array(N); this.inf = new Uint8Array(N); this.col = new Uint8Array(N); this.dirty = new Uint8Array(N); this.fx = new Uint8Array(N);
    this.blk = new Int16Array(N); this.lvl = new Int16Array(N); this.bt = new Int16Array(N);
    this.target = new Int32Array(N);

    const B = city.bounds;
    this.hx0 = B.x0 - HALF; this.hz0 = B.z0 - HALF;
    this.hw = Math.ceil((B.x1 - B.x0 + 2 * HALF) / CELL) + 1;
    this.hh = Math.ceil((B.z1 - B.z0 + 2 * HALF) / CELL) + 1;
    this.head = new Int32Array(this.hw * this.hh);
    this.next = new Int32Array(N);

    this.mesh = new THREE.InstancedMesh(personGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), N);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    const ringG = new THREE.RingGeometry(0.95, 1.3, 20); ringG.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }), N);
    this.rings.frustumCulled = false; this.rings.renderOrder = 2;
    this.rings.setColorAt(0, new THREE.Color());
    parent.add(this.rings);
    const bloodG = new THREE.CircleGeometry(1, 12); bloodG.rotateX(-Math.PI / 2);
    this.bloodMax = 1500;
    this.blood = new THREE.InstancedMesh(bloodG, new THREE.MeshStandardMaterial({ color: '#5c0d08', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), this.bloodMax);
    this.blood.count = 0; this.blood.frustumCulled = false; this.blood.receiveShadow = true;
    parent.add(this.blood);
    this.mounds = new THREE.InstancedMesh(moundGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: bodiesTexture() }), Math.max(1, this.bld.length));
    this.mounds.count = 0; this.mounds.castShadow = true; this.mounds.receiveShadow = true; this.mounds.frustumCulled = false;
    parent.add(this.mounds);
    this.dust = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#efe0c0', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; parent.add(m); this.dust.push({ m, t: 1 });
    }

    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YZX');
    this._p = new THREE.Vector3(); this._p2 = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
    this.pal = PPL_COLS.map(h => new THREE.Color(h));
    this.zcol = new THREE.Color(this.ztype.color);
    this.zr = new THREE.Color('#a6ff4d'); this.ir = new THREE.Color('#ffc233');
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

  setupBuildings() {
    const bl = this.bld = this.city.buildings;
    const nb = bl.length;
    this.bIn = new Int16Array(nb); this.bRoof = new Int16Array(nb); this.bRoofAll = new Int16Array(nb);
    this.bPile = new Int32Array(nb); this.bBreach = new Uint8Array(nb); this.bBarr = new Uint8Array(nb);
    this.bHad = new Uint8Array(nb); this.bOver = new Uint8Array(nb); this.bEmpty = new Float32Array(nb);
    this.bCap = new Int16Array(nb);
    const B = this.city.bounds;
    this.rx0 = B.x0 - HALF; this.rz0 = B.z0 - HALF;
    this.rw = Math.ceil((B.x1 - B.x0 + 2 * HALF) / RCELL) + 1; this.rh = Math.ceil((B.z1 - B.z0 + 2 * HALF) / RCELL) + 1;
    this.rgrid = Array.from({ length: this.rw * this.rh }, () => []);
    bl.forEach((b, k) => {
      const rf = b.roof, area = Math.max(0, rf.x1 - rf.x0) * Math.max(0, rf.z1 - rf.z0);
      if (!b.door || area < 20) return;
      this.bCap[k] = Math.min(120, Math.floor(area / 5));
      b.t = [-b.n[1], b.n[0]];
      const ci = Math.floor((b.door[0] - this.rx0) / RCELL), cj = Math.floor((b.door[1] - this.rz0) / RCELL);
      if (ci >= 0 && cj >= 0 && ci < this.rw && cj < this.rh) this.rgrid[cj * this.rw + ci].push(k);
    });
  }

  refugesNear(x, z, R, fn) {
    const c0 = Math.max(0, Math.floor((x - R - this.rx0) / RCELL)), c1 = Math.min(this.rw - 1, Math.floor((x + R - this.rx0) / RCELL));
    const r0 = Math.max(0, Math.floor((z - R - this.rz0) / RCELL)), r1 = Math.min(this.rh - 1, Math.floor((z + R - this.rz0) / RCELL));
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) for (const k of this.rgrid[j * this.rw + i]) fn(k);
  }

  cellOf(x, z) {
    const i = Math.floor((x - this.gx0) / RES), j = Math.floor((z - this.gz0) / RES);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return -1;
    return j * this.gw + i;
  }
  walkable(x, z) { const c = this.cellOf(x, z); return c >= 0 && (this.grid[c] & 1) === 1; }
  onRoad(x, z) { const c = this.cellOf(x, z); return c >= 0 && (this.grid[c] & 2) === 2; }
  groundY(x, z) { const c = this.cellOf(x, z); return c >= 0 && (this.grid[c] & 2) ? 0 : CURB; }

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
    this.makeCrowds(r);
    const blocks = this.blocks = this.city.walkBlocks.map(b => ({ ...b, w: b.x1 - b.x0, d: b.z1 - b.z0, P: 2 * (b.x1 - b.x0 + b.z1 - b.z0) }));
    const totalP = blocks.reduce((a, b) => a + b.P, 0);
    for (let k = 0; k < this.nWalk; k++) {
      let t = r() * totalP, bi = 0;
      while (t > blocks[bi].P && bi < blocks.length - 1) { t -= blocks[bi].P; bi++; }
      this.st[k] = S.WALK; this.blk[k] = bi; this.s[k] = t;
      this.spd[k] = (0.9 + r() * 0.8) * (r() < 0.5 ? 1 : -1);
      this.lat[k] = (r() - 0.5) * 2.2;
      this.walkPos(k);
    }
    for (let k = 0; k < this.crowdPts.length; k++) {
      const i = this.nWalk + k, c = this.crowdPts[k];
      this.st[i] = S.IDLE; this.x[i] = c[0]; this.z[i] = c[2]; this.y[i] = c[1];
      this.spd[i] = 0.9 + r() * 0.7; this.lat[i] = (r() - 0.5) * 2.2;
    }
    this.dirty.fill(0); this.lvl.fill(-1); this.bt.fill(-1); this.fx.fill(0); this.inf.fill(0); this.target.fill(-1); this.t1.fill(0);
    for (let i = 0; i < this.N; i++) {
      this.think[i] = r() * 0.4;
      this.col[i] = Math.floor(r() * PPL_COLS.length);
      this.mesh.setColorAt(i, this.pal[this.col[i]]);
    }
    this.mesh.instanceColor.needsUpdate = true;
    for (const a of [this.bIn, this.bRoof, this.bRoofAll, this.bPile, this.bBreach, this.bBarr, this.bHad, this.bOver, this.bEmpty]) a.fill(0);
    this.active = this.nHuman;
    this.drops = 0;
    this.bloodN = 0; this.blood.count = 0;
    this.time = 0; this.bldT = 0; this.firstRoof = false;
    this.stats = { humans: this.nHuman, infected: 0, zombies: 0, dead: 0, roof: 0, bites: 0, runover: 0 };
    this.events = [];
    for (const d of this.dust) { d.m.visible = false; d.t = 1; }
    this.sync(300);
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

  moveRoof(i, dx, dz, dist) {
    const rf = this.bld[this.lvl[i]].roof;
    const nx = this.x[i] + dx * dist, nz = this.z[i] + dz * dist;
    const cx = Math.min(Math.max(nx, rf.x0), rf.x1), cz = Math.min(Math.max(nz, rf.z0), rf.z1);
    this.x[i] = cx; this.z[i] = cz;
    return cx === nx && cz === nz;
  }

  randomCardinal(i, look = 1) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < 6; k++) {
      const d = dirs[Math.floor(this.r() * 4)];
      if (this.walkable(this.x[i] + d[0] * look, this.z[i] + d[1] * look)) { this.hx[i] = d[0]; this.hz[i] = d[1]; return true; }
    }
    return false;
  }

  isPrey(j) { return CIV[this.st[j]] === 1 && !this.inf[j]; }
  isCivilian(j) { return CIV[this.st[j]] === 1; }
  hittable(j) { return this.lvl[j] === -1 && HITTABLE[this.st[j]] === 1; }

  buildHash() {
    this.head.fill(-1);
    const { hx0, hz0, hw, hh } = this;
    for (let i = 0; i < this.active; i++) {
      if (!INHASH[this.st[i]] || this.lvl[i] < -1) continue;
      const cx = Math.floor((this.x[i] - hx0) / CELL), cz = Math.floor((this.z[i] - hz0) / CELL);
      if (cx < 0 || cz < 0 || cx >= hw || cz >= hh) continue;
      const c = cz * hw + cx;
      this.next[i] = this.head[c]; this.head[c] = i;
    }
  }

  // visit agents (civilians, zombies, grabbed, turning) within R on level lvl
  around(x, z, R, fn, lvl = -1) {
    const { hx0, hz0, hw, hh } = this;
    const c0 = Math.max(0, Math.floor((x - R - hx0) / CELL)), c1 = Math.min(hw - 1, Math.floor((x + R - hx0) / CELL));
    const r0 = Math.max(0, Math.floor((z - R - hz0) / CELL)), r1 = Math.min(hh - 1, Math.floor((z + R - hz0) / CELL));
    const R2 = R * R;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      for (let j = this.head[rr * hw + cc]; j >= 0; j = this.next[j]) {
        if (this.lvl[j] !== lvl) continue;
        const dx = this.x[j] - x, dz = this.z[j] - z, d2 = dx * dx + dz * dz;
        if (d2 <= R2) fn(j, d2, dx, dz);
      }
    }
  }

  zombiesNear(x, z, R, lvl = -1) {
    let n = 0;
    this.around(x, z, R, (j) => { if (this.st[j] === S.ZOMBIE) n++; }, lvl);
    return n;
  }

  panic(j, fromX, fromZ, threat) {
    if (!this.isCivilian(j)) return;
    const s = this.st[j];
    if (s === S.SEEK) return;
    let dx = this.x[j] - fromX, dz = this.z[j] - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    dx = dx / d + (this.r() - 0.5) * 0.5; dz = dz / d + (this.r() - 0.5) * 0.5;
    const n = Math.hypot(dx, dz) || 1;
    this.hx[j] = dx / n; this.hz[j] = dz / n;
    if (s === S.ROOF) { this.t1[j] = 2 + this.r() * 2; return; }
    if (s !== S.FLEE && this.wantsRoof(j) && this.trySeek(j)) return;
    if (s !== S.FLEE) this.tx[j] = RUN[0] + this.r() * (RUN[1] - RUN[0]); // run speed while fleeing
    this.st[j] = S.FLEE; this.t1[j] = 4 + this.r() * 4; this.target[j] = threat;
  }

  wantsRoof(j) {
    if (this.r() > 0.6) return false;
    if (this.stats.zombies >= 30) return true;
    return this.zombiesNear(this.x[j], this.z[j], 18) >= 2;
  }

  trySeek(j) {
    const x = this.x[j], z = this.z[j];
    let best = 35 * 35, bk = -1;
    this.refugesNear(x, z, 35, (k) => {
      if (this.bBreach[k] || (this.fire && this.fire.bFire[k]) || this.bIn[k] + this.bRoofAll[k] >= this.bCap[k]) return;
      const b = this.bld[k], d2 = (b.door[0] - x) ** 2 + (b.door[1] - z) ** 2;
      if (d2 < best) { best = d2; bk = k; }
    });
    if (bk < 0) return false;
    this.st[j] = S.SEEK; this.bt[j] = bk; this.tx[j] = this.bld[bk].door[0]; this.tz[j] = this.bld[bk].door[1];
    this.wt[j] = RUN[0] + this.r() * (RUN[1] - RUN[0]); this.t1[j] = 30;
    return true;
  }

  startReturn(i) {
    const x = this.x[i], z = this.z[i];
    let best = 1e18, bb = 0, bs = 0;
    for (let k = 0; k < this.blocks.length; k++) {
      const b = this.blocks[k];
      if (x < b.x0 - 25 || x > b.x1 + 25 || z < b.z0 - 25 || z > b.z1 + 25) continue;
      const cx = Math.min(Math.max(x, b.x0), b.x1), cz = Math.min(Math.max(z, b.z0), b.z1);
      const cand = [[Math.abs(x - cx) + Math.abs(z - b.z0), cx - b.x0],
        [Math.abs(x - b.x1) + Math.abs(z - cz), b.w + (cz - b.z0)],
        [Math.abs(z - b.z1) + Math.abs(x - cx), b.w + b.d + (b.x1 - cx)],
        [Math.abs(x - b.x0) + Math.abs(z - cz), 2 * b.w + b.d + (b.z1 - cz)]];
      for (const [d, s] of cand) if (d < best) { best = d; bb = k; bs = s; }
    }
    this.blk[i] = bb; this.s[i] = bs;
    const sx = this.x[i], sz = this.z[i];
    this.walkPos(i);
    this.tx[i] = this.x[i]; this.tz[i] = this.z[i];
    this.x[i] = sx; this.z[i] = sz; this.y[i] = this.groundY(sx, sz);
    this.st[i] = S.RETURN;
  }

  addBlood(x, z, size, y = null) {
    const k = this.bloodN % this.bloodMax; this.bloodN++;
    this._e.set(0, this.r() * 6.28, 0); this._q.setFromEuler(this._e);
    this._m4.compose(this._p.set(x, (y ?? this.groundY(x, z)) + 0.025, z), this._q, this._p2.set(size, 1, size * (0.6 + this.r() * 0.5)));
    this.blood.setMatrixAt(k, this._m4);
    this.blood.count = Math.min(this.bloodN, this.bloodMax);
    this.blood.instanceMatrix.needsUpdate = true;
  }

  puff(x, z) {
    const d = this.dust.find(o => o.t >= 1) || this.dust[0];
    d.t = 0; d.m.visible = true; d.m.position.set(x, this.groundY(x, z) + 0.05, z);
  }

  // fall from height y0 straight down at (x,z); zombies land as zombies, civilians die
  startFall(i, x, z, y0, civilian) {
    const g = this.groundY(x, z);
    this.x[i] = x; this.z[i] = z; this.y[i] = y0;
    this.inc[i] = y0; this.inc0[i] = Math.max(0.3, Math.sqrt(2 * Math.max(0.1, y0 - g) / G)); this.t1[i] = this.inc0[i];
    this.st[i] = civilian ? S.JUMP : S.FALLING; this.lvl[i] = -1; this.inf[i] = 0; this.fx[i] = 0;
  }

  // a point just outside the wall of building k nearest to (x,z)
  edgePoint(k, x, z) {
    const b = this.bld[k];
    const d = [x - b.x0, b.x1 - x, z - b.z0, b.z1 - z];
    const m = Math.min(...d), o = 1.0;
    if (m === d[0]) return [b.x0 - o, Math.min(Math.max(z, b.z0), b.z1)];
    if (m === d[1]) return [b.x1 + o, Math.min(Math.max(z, b.z0), b.z1)];
    if (m === d[2]) return [Math.min(Math.max(x, b.x0), b.x1), b.z0 - o];
    return [Math.min(Math.max(x, b.x0), b.x1), b.z1 + o];
  }

  // ---------- player / external actions
  drop(x, z) {
    const p = this.snapWalkable(x, z);
    if (!p || this.drops >= DROP_CAP) return -1;
    const i = this.active++;
    this.drops++;
    this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0; this.bt[i] = -1;
    this.startFall(i, p[0], p[1], this.groundY(p[0], p[1]) + 30, false);
    this.inc0[i] = 0.75; this.t1[i] = 0.75; this.fx[i] = 1;
    this.mesh.setColorAt(i, this.zcol); this.mesh.instanceColor.needsUpdate = true; this.dirty[i] = 2;
    return i;
  }

  // killed (run over, fell). vx,vz throw the body a little.
  kill(j, vx = 0, vz = 0, cause = 'car') {
    const wasZ = this.st[j] === S.ZOMBIE;
    if (wasZ && cause === 'car' && this.fx[j] !== 2 && Math.hypot(vx, vz) < 11 && this.r() < 0.65) {
      const sp = Math.hypot(vx, vz) || 1;
      this.move(j, vx / sp, vz / sp, 1.5 + sp * 0.25);
      this.hx[j] = vx / sp; this.hz[j] = vz / sp;
      this.fx[j] = 2; this.t1[j] = 2 + this.r() * 2; this.target[j] = -1;
      this.addBlood(this.x[j], this.z[j], 0.5);
      this.events.push({ type: 'knockdown', j });
      return;
    }
    this.st[j] = S.DEAD; this.inf[j] = 0; this.lvl[j] = -1;
    this.x[j] += vx * 0.12; this.z[j] += vz * 0.12;
    const sp = Math.hypot(vx, vz);
    if (sp > 0.1) { this.hx[j] = vx / sp; this.hz[j] = vz / sp; } else { const a = this.r() * 6.28; this.hx[j] = Math.cos(a); this.hz[j] = Math.sin(a); }
    this.y[j] = this.groundY(this.x[j], this.z[j]);
    this.addBlood(this.x[j], this.z[j], 0.7 + this.r() * 0.6);
    this._c.copy(wasZ ? this.zcol : this.pal[this.col[j]]).multiplyScalar(0.45);
    this.mesh.setColorAt(j, this._c); this.mesh.instanceColor.needsUpdate = true; this.dirty[j] = 3;
    if (cause === 'car') { this.stats.runover++; this.events.push({ type: 'runover', j, zombie: wasZ }); }
  }

  // panic civilians around a point (crash)
  scare(x, z, R, p = 0.8) {
    this.around(x, z, R, (j) => { if (this.r() < p) this.panic(j, x, z, -1); });
  }

  // ---------- simulation
  step(h) {
    this.time += h;
    this.buildHash();
    const Z = this.ztype;
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      switch (s) {
        case S.WALK: this.s[i] += this.spd[i] * h; this.walkPos(i); break;
        case S.FLEE: this.fleeStep(i, h); break;
        case S.RETURN: {
          const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
          const v = Math.abs(this.spd[i]) * h;
          if (d <= v + 0.05) { this.st[i] = S.WALK; this.walkPos(i); }
          else if (!this.move(i, dx / d, dz / d, v)) { this.x[i] = this.tx[i]; this.z[i] = this.tz[i]; }
          break;
        }
        case S.SEEK: this.seekStep(i, h); break;
        case S.INSIDE: this.insideStep(i, h); break;
        case S.ROOF: this.roofStep(i, h); break;
        case S.GRABBED:
          if ((this.t1[i] -= h) <= 0) {
            this.inf[i] = 1;
            this.inc[i] = this.inc0[i] = Z.incubate[0] + this.r() * (Z.incubate[1] - Z.incubate[0]);
            const b = this.target[i];
            this.st[i] = this.lvl[i] >= 0 ? S.ROOF : S.IDLE; // released, a civilian again (infected)
            this.panic(i, b >= 0 ? this.x[b] : this.x[i] + 1, b >= 0 ? this.z[b] : this.z[i], b);
            if (this.st[i] === S.FLEE) this.t1[i] = 3 + this.r() * 3;
          }
          break;
        case S.TURNING:
          if ((this.t1[i] -= h) <= 0) { this.st[i] = S.ZOMBIE; this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0; this.bt[i] = -1; this.inc[i] = 0; this.events.push({ type: 'turned', i }); }
          break;
        case S.ZOMBIE: if (this.lvl[i] >= 0) this.roofZombieStep(i, h, Z); else this.zombieStep(i, h, Z); break;
        case S.FALLING: case S.JUMP: this.fallStep(i, h); break;
        case S.CLIMB: this.climbStep(i, h); break;
        default: break; // IDLE, DEAD, PILE
      }
      // incubation (paused while on the stairs)
      if (this.inf[i] && CIV[this.st[i]] && this.st[i] !== S.INSIDE) {
        this.inc[i] -= h;
        this.dirty[i] = 1;
        if (this.inc[i] <= 0) {
          this.inf[i] = 0; this.st[i] = S.TURNING; this.t1[i] = 1.4;
          if (this.lvl[i] < 0) this.y[i] = this.groundY(this.x[i], this.z[i]);
          const zx = this.x[i], zz = this.z[i], lv = this.lvl[i];
          this.around(zx, zz, 8, (j) => { if (this.r() < 0.5) this.panic(j, zx, zz, i); }, lv);
        }
      }
    }
    this.bldT += h;
    if (this.bldT >= 1) { this.buildingTick(this.bldT); this.bldT = 0; }
    for (const d of this.dust) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + h / 0.9);
      const k = 1 + d.t * 5; d.m.scale.set(k, 1, k); d.m.material.opacity = 0.75 * (1 - d.t);
      if (d.t >= 1) d.m.visible = false;
    }
  }

  fleeStep(i, h) {
    const tg = this.target[i];
    if (tg >= 0 && this.st[tg] === S.ZOMBIE && (this.think[i] -= h) <= 0) {
      this.think[i] = 0.4;
      const dx = this.x[i] - this.x[tg], dz = this.z[i] - this.z[tg], d = Math.hypot(dx, dz);
      if (d < 14 && d > 0.01) {
        this.hx[i] = this.hx[i] * 0.4 + dx / d * 0.6; this.hz[i] = this.hz[i] * 0.4 + dz / d * 0.6;
        const n = Math.hypot(this.hx[i], this.hz[i]) || 1; this.hx[i] /= n; this.hz[i] /= n;
      }
    }
    if (!this.move(i, this.hx[i], this.hz[i], this.tx[i] * h)) this.randomCardinal(i);
    if ((this.t1[i] -= h) <= 0) this.startReturn(i);
  }

  seekStep(i, h) {
    const k = this.bt[i], b = this.bld[k];
    const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
    this.t1[i] -= h;
    if (d < 0.9) {
      const full = this.bIn[k] + this.bRoofAll[k] >= this.bCap[k];
      const blocked = this.bBreach[k] || (this.fire && this.fire.bFire[k]) || full || (this.bBarr[k] && this.zombiesNear(b.door[0], b.door[1], 4) > 0);
      if (blocked) { this.st[i] = S.IDLE; this.panic(i, b.wall[0], b.wall[1], -1); return; }
      this.st[i] = S.INSIDE; this.lvl[i] = -2; this.bIn[k]++; this.bBarr[k] = 1;
      this.t1[i] = 3 + (b.roofY - b.baseY) / 5 + this.r() * 2;
      return;
    }
    if (this.t1[i] <= 0) { this.st[i] = S.IDLE; this.panic(i, this.x[i] - dx, this.z[i] - dz, -1); return; }
    if (this.wt[i] < 0) { // detouring around a corner
      this.inc[i] -= h;
      if (this.inc[i] <= 0 || !this.move(i, this.hx[i], this.hz[i], -this.wt[i] * h)) this.wt[i] = -this.wt[i];
      return;
    }
    if (!this.move(i, dx / d, dz / d, this.wt[i] * h)) {
      if (this.randomCardinal(i, 1.5)) { this.wt[i] = -this.wt[i]; this.inc[i] = 1.2; }
    }
  }

  insideStep(i, h) {
    if ((this.t1[i] -= h) > 0) return;
    const k = this.bt[i], rf = this.bld[k].roof;
    this.bIn[k] = Math.max(0, this.bIn[k] - 1);
    this.st[i] = S.ROOF; this.lvl[i] = k; this.bHad[k] = 1;
    this.x[i] = rf.x0 + this.r() * (rf.x1 - rf.x0); this.z[i] = rf.z0 + this.r() * (rf.z1 - rf.z0); this.y[i] = this.bld[k].roofY;
    this.tx[i] = this.x[i]; this.tz[i] = this.z[i]; this.t1[i] = 0;
    if (!this.firstRoof) { this.firstRoof = true; this.events.push({ type: 'roof', k }); }
  }

  roofStep(i, h) {
    const k = this.lvl[i], b = this.bld[k], rf = b.roof;
    if (this.fire && this.fire.bFire[k] === 1 && this.r() < h * 0.07) {
      const e = this.edgePoint(k, this.x[i], this.z[i]);
      this.startFall(i, e[0], e[1], b.roofY, true);
      this.events.push({ type: 'jump', i });
      return;
    }
    if (this.t1[i] > 0) {
      this.t1[i] -= h;
      if (!this.moveRoof(i, this.hx[i], this.hz[i], 2.3 * h)) { const a = this.r() * 6.28; this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a); }
      return;
    }
    const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
    if (d > 0.1) this.moveRoof(i, dx / d, dz / d, Math.min(d, 0.5 * h));
    else if (this.r() < h * 0.4) { this.tx[i] = rf.x0 + this.r() * (rf.x1 - rf.x0); this.tz[i] = rf.z0 + this.r() * (rf.z1 - rf.z0); }
  }

  fallStep(i, h) {
    this.t1[i] -= h;
    const g = this.groundY(this.x[i], this.z[i]);
    const t = Math.max(0, this.t1[i] / this.inc0[i]);
    this.y[i] = g + (this.inc[i] - g) * t * t;
    if (this.t1[i] > 0) return;
    this.y[i] = g;
    if (this.st[i] === S.JUMP) { this.kill(i, 0, 0, 'fall'); this.addBlood(this.x[i], this.z[i], 1.1); return; }
    this.st[i] = S.ZOMBIE; this.lvl[i] = -1; this.t1[i] = 0.6; this.think[i] = 0; this.bt[i] = -1; this.target[i] = -1; this.inc[i] = 0;
    if (this.fx[i] === 1) {
      this.fx[i] = 0;
      this.puff(this.x[i], this.z[i]);
      const zx = this.x[i], zz = this.z[i];
      this.around(zx, zz, 7, (j) => { if (this.r() < 0.45) this.panic(j, zx, zz, i); });
      this.events.push({ type: 'landed', i });
    }
  }

  // ---------- zombies
  zombieStep(i, h, Z) {
    if (this.t1[i] > 0) { this.t1[i] -= h; if (this.t1[i] <= 0 && this.fx[i] === 2) this.fx[i] = 0; return; }
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.3 + this.r() * 0.2;
      const zx = this.x[i], zz = this.z[i];
      let tg = this.target[i];
      if (tg >= 0) {
        const d = Math.hypot(this.x[tg] - zx, this.z[tg] - zz);
        if (!this.isPrey(tg) || this.lvl[tg] !== -1 || d > Z.sight * 1.4) tg = -1;
      }
      let best = Z.sight * Z.sight, bi = tg;
      const n2 = Z.notice * Z.notice;
      this.around(zx, zz, Z.sight, (j, d2) => {
        if (!CIV[this.st[j]]) return;
        if (d2 < n2 && this.st[j] !== S.FLEE && this.r() < Z.noticeP) this.panic(j, zx, zz, i);
        if (tg < 0 && d2 < best && !this.inf[j] && CIV[this.st[j]]) { best = d2; bi = j; }
      });
      this.target[i] = bi;
      if (bi >= 0) this.bt[i] = -1;
      else if (this.bt[i] < 0 && this.r() < 0.7) this.bt[i] = this.pileTarget(zx, zz);
      else if (this.bt[i] >= 0 && this.bRoof[this.bt[i]] === 0 && !this.bBreach[this.bt[i]]) this.bt[i] = -1;
    }
    const tg = this.target[i];
    if (tg >= 0 && this.isPrey(tg) && this.lvl[tg] === -1) {
      const dx = this.x[tg] - this.x[i], dz = this.z[tg] - this.z[i], d = Math.hypot(dx, dz) || 0.001;
      this.hx[i] = dx / d; this.hz[i] = dz / d;
      if (d < Z.biteR) { this.bite(i, tg, Z); return; }
      const v = d < Z.lungeR ? Z.lunge : Z.chase;
      if (!this.move(i, dx / d, dz / d, v * h)) this.target[i] = -1;
      return;
    }
    this.target[i] = -1;
    const k = this.bt[i];
    if (k >= 0) { this.toPile(i, h, k, Z); return; }
    this.wt[i] -= h;
    if (this.wt[i] <= 0 || !this.move(i, this.hx[i], this.hz[i], Z.wander * h)) {
      this.randomCardinal(i, 3);
      this.wt[i] = 3 + this.r() * 6;
    }
  }

  pileTarget(x, z) {
    let best = 60 * 60, bk = -1;
    this.refugesNear(x, z, 60, (k) => {
      if (this.bRoof[k] === 0) return;
      const b = this.bld[k], d2 = (b.wall[0] - x) ** 2 + (b.wall[1] - z) ** 2;
      if (d2 < best) { best = d2; bk = k; }
    });
    return bk;
  }

  toPile(i, h, k, Z) {
    const b = this.bld[k];
    const R = pileR(this.bPile[k] + 1);
    const dW = Math.hypot(this.x[i] - b.wall[0], this.z[i] - b.wall[1]);
    if (dW < R + 1.3) { this.joinPile(i, k); return; }
    if (this.wt[i] > 0) { // detour
      this.wt[i] -= h;
      if (!this.move(i, this.hx[i], this.hz[i], Z.chase * h)) this.wt[i] = 0;
      return;
    }
    const px = b.wall[0] + b.n[0] * (R + 0.5), pz = b.wall[1] + b.n[1] * (R + 0.5);
    const dx = px - this.x[i], dz = pz - this.z[i], d = Math.hypot(dx, dz) || 0.001;
    this.hx[i] = dx / d; this.hz[i] = dz / d;
    if (!this.move(i, dx / d, dz / d, Z.chase * h)) { if (this.randomCardinal(i, 1.5)) this.wt[i] = 1.5; }
  }

  joinPile(i, k) {
    const b = this.bld[k];
    if (this.bBreach[k]) { this.startClimb(i, k); return; }
    const n = ++this.bPile[k];
    const H = pileH(n), R = pileR(n);
    const rho = R * (0.12 + 0.88 * Math.sqrt(this.r()));
    const phi = (this.r() - 0.5) * Math.PI * 0.92;
    const a = Math.max(0.35, rho * Math.cos(phi)), t = rho * Math.sin(phi);
    this.x[i] = b.wall[0] + b.n[0] * a + b.t[0] * t;
    this.z[i] = b.wall[1] + b.n[1] * a + b.t[1] * t;
    this.y[i] = b.baseY + Math.max(0, H * (1 - rho / R));
    this.hx[i] = -b.n[0]; this.hz[i] = -b.n[1];
    this.st[i] = S.PILE; this.lvl[i] = -2; this.bt[i] = k; this.target[i] = -1;
    if (H >= b.roofY - b.baseY - 0.3) this.breach(k);
  }

  breach(k) {
    if (this.bBreach[k]) return;
    this.bBreach[k] = 1;
    this.events.push({ type: 'breach', k });
    const top = [];
    for (let i = 0; i < this.active; i++) if (this.st[i] === S.PILE && this.bt[i] === k) top.push(i);
    top.sort((a, b) => this.y[b] - this.y[a]);
    for (let n = 0; n < Math.min(8, top.length); n++) this.startClimb(top[n], k);
    if (!this.bOver[k]) { this.bOver[k] = 1; if (this.onOverrun) this.onOverrun(k, 'breach'); }
  }

  startClimb(i, k) {
    const b = this.bld[k];
    this.st[i] = S.CLIMB; this.lvl[i] = -2; this.bt[i] = k;
    this.tx[i] = this.x[i]; this.tz[i] = this.z[i]; this.inc[i] = this.y[i];
    this.inc0[i] = Math.max(1, (b.roofY - this.y[i]) / 1.8 + 0.6); this.t1[i] = 0;
    this.hx[i] = -b.n[0]; this.hz[i] = -b.n[1];
  }

  climbStep(i, h) {
    const k = this.bt[i], b = this.bld[k];
    this.t1[i] += h / this.inc0[i];
    const p = Math.min(1, this.t1[i]);
    const ex = b.wall[0] + b.n[0] * 0.3, ez = b.wall[1] + b.n[1] * 0.3;
    this.x[i] = this.tx[i] + (ex - this.tx[i]) * p; this.z[i] = this.tz[i] + (ez - this.tz[i]) * p;
    this.y[i] = this.inc[i] + (b.roofY - this.inc[i]) * p + Math.sin(p * Math.PI) * 0.6;
    if (p < 1) return;
    const rf = b.roof;
    this.st[i] = S.ZOMBIE; this.lvl[i] = k; this.y[i] = b.roofY; this.think[i] = 0; this.target[i] = -1; this.inc[i] = 0; this.t1[i] = 0.3;
    this.x[i] = Math.min(Math.max(b.wall[0] - b.n[0] * 1.2, rf.x0), rf.x1);
    this.z[i] = Math.min(Math.max(b.wall[1] - b.n[1] * 1.2, rf.z0), rf.z1);
  }

  roofZombieStep(i, h, Z) {
    if (this.t1[i] > 0) { this.t1[i] -= h; return; }
    const k = this.lvl[i];
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.3 + this.r() * 0.2;
      const zx = this.x[i], zz = this.z[i];
      let best = 1e9, bi = -1;
      this.around(zx, zz, 40, (j, d2) => {
        if (!CIV[this.st[j]]) return;
        if (d2 < 64) this.panic(j, zx, zz, i);
        if (d2 < best && !this.inf[j]) { best = d2; bi = j; }
      }, k);
      this.target[i] = bi;
    }
    const tg = this.target[i];
    if (tg >= 0 && this.isPrey(tg) && this.lvl[tg] === k) {
      this.inc[i] = 0;
      const dx = this.x[tg] - this.x[i], dz = this.z[tg] - this.z[i], d = Math.hypot(dx, dz) || 0.001;
      this.hx[i] = dx / d; this.hz[i] = dz / d;
      if (d < Z.biteR) { this.bite(i, tg, Z); return; }
      this.moveRoof(i, dx / d, dz / d, (d < Z.lungeR ? Z.lunge : Z.chase) * h);
      return;
    }
    // nobody left up here: shuffle about, eventually walk off the edge
    this.inc[i] += h;
    this.wt[i] -= h;
    if (this.wt[i] <= 0 || !this.moveRoof(i, this.hx[i], this.hz[i], Z.wander * h)) {
      const a = this.r() * 6.28; this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a); this.wt[i] = 2 + this.r() * 4;
    }
    if (this.inc[i] > 12 && this.r() < h * 0.04) {
      const e = this.edgePoint(k, this.x[i], this.z[i]);
      this.startFall(i, e[0], e[1], this.bld[k].roofY, false);
    }
  }

  bite(i, j, Z) {
    this.st[j] = S.GRABBED; this.t1[j] = Z.biteT; this.target[j] = i;
    this.t1[i] = Z.biteT + Z.recover; this.target[i] = -1;
    this.addBlood(this.x[j], this.z[j], 0.6 + this.r() * 0.6, this.lvl[j] >= 0 ? this.y[j] : null);
    this.stats.bites++;
    const bx = this.x[j], bz = this.z[j], lv = this.lvl[j];
    this.around(bx, bz, SCREAM_R, (k) => { if (k !== j && this.r() < SCREAM_P) this.panic(k, bx, bz, i); }, lv);
    this.events.push({ type: 'bite', i, j, x: bx, z: bz });
  }

  buildingTick(dt) {
    for (let k = 0; k < this.bld.length; k++) {
      if (this.bPile[k] === 0 && !this.bBreach[k]) continue;
      if (this.bRoof[k] === 0 && this.bIn[k] === 0) {
        this.bEmpty[k] += dt;
        if (this.bEmpty[k] >= 3) this.collapse(k);
      } else this.bEmpty[k] = 0;
    }
  }

  // survivors gone: the pile spills back into the street
  collapse(k) {
    for (let i = 0; i < this.active; i++) {
      if ((this.st[i] === S.PILE || this.st[i] === S.CLIMB) && this.bt[i] === k) {
        this.startFall(i, this.x[i], this.z[i], this.y[i], false);
      }
    }
    this.bPile[k] = 0; this.bBreach[k] = 0; this.bEmpty[k] = 0; this.bBarr[k] = 0;
    if (this.bHad[k] && !this.bOver[k]) { this.bOver[k] = 1; if (this.onOverrun) this.onOverrun(k, 'collapse'); }
  }

  // ---------- render sync
  sync(camDist = 300) {
    this.ringScale = Math.min(2.2, Math.max(0.8, camDist / 220));
    this.rings.material.opacity = camDist > 400 ? 0.55 : 0.8;
    const arr = this.mesh.instanceMatrix.array;
    const m = this._m4, q = this._q, e = this._e, p = this._p, one = this._one;
    let humans = 0, infected = 0, zombies = 0, dead = 0, roof = 0, rings = 0, colDirty = false;
    this.bRoof.fill(0); this.bRoofAll.fill(0);
    const t = this.time;
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      const o = i * 16;
      if (s === S.INSIDE) {
        arr.fill(0, o, o + 16);
      } else if (CIV[s]) {
        arr[o] = 1; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
        arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = 1; arr[o + 11] = 0;
        arr[o + 12] = this.x[i]; arr[o + 13] = this.y[i]; arr[o + 14] = this.z[i]; arr[o + 15] = 1;
      } else {
        let tilt = 0, y = this.y[i];
        if (s === S.ZOMBIE) tilt = this.fx[i] === 2 ? (this.t1[i] > 0.6 ? Math.PI / 2 : Math.PI / 2 * this.t1[i] / 0.6) : -0.32 + Math.sin(t * 5 + i) * 0.06;
        else if (s === S.TURNING) tilt = Math.sin(t * 14 + i) * 0.35;
        else if (s === S.GRABBED) tilt = 0.25;
        else if (s === S.PILE) tilt = -0.95 + Math.sin(t * 6 + i * 1.7) * 0.25;
        else if (s === S.CLIMB) tilt = -1.1;
        else if (s === S.JUMP) tilt = Math.sin(t * 9 + i) * 1.2;
        else if (s === S.DEAD) { tilt = Math.PI / 2; y += 0.22; }
        e.set(0, Math.atan2(-this.hz[i], this.hx[i]), tilt); q.setFromEuler(e);
        m.compose(p.set(this.x[i], y, this.z[i]), q, one);
        m.toArray(arr, o);
      }
      if (s === S.DEAD) { dead++; continue; }
      if (s === S.ZOMBIE || s === S.FALLING || s === S.TURNING || s === S.PILE || s === S.CLIMB) {
        zombies++;
        if (s === S.ZOMBIE || s === S.TURNING) this.ringAt(rings++, i, 0);
        if (this.dirty[i] !== 2) { this.mesh.setColorAt(i, this.zcol); this.dirty[i] = 2; colDirty = true; }
        continue;
      }
      // civilians (incl. grabbed, jumping)
      if (s === S.ROOF) { roof++; const k = this.lvl[i]; this.bRoofAll[k]++; if (!this.inf[i]) this.bRoof[k]++; }
      else if (s === S.INSIDE) roof++;
      if (this.inf[i] || s === S.GRABBED) { infected++; if (s !== S.INSIDE) this.ringAt(rings++, i, 1); } else humans++;
      if (this.dirty[i] === 1 && this.inf[i]) {
        const k = Math.min(1, Math.max(0, 1 - this.inc[i] / this.inc0[i]));
        this._c.copy(this.pal[this.col[i]]).lerp(this.zcol, Math.max(0, (k - 0.55) / 0.45));
        this.mesh.setColorAt(i, this._c); colDirty = true; this.dirty[i] = 0;
      }
    }
    this.mesh.count = this.active;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colDirty) this.mesh.instanceColor.needsUpdate = true;
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
    // mounds under the piles
    let mc = 0;
    for (let k = 0; k < this.bld.length; k++) {
      const n = this.bPile[k]; if (!n) continue;
      const b = this.bld[k], H = Math.min(pileH(n) * 0.92, b.roofY - b.baseY), R = pileR(n) * 0.85;
      e.set(0, Math.atan2(-b.n[1], b.n[0]), 0); q.setFromEuler(e);
      m.compose(p.set(b.wall[0], b.baseY - 0.3, b.wall[1]), q, this._p2.set(R, H, R));
      this.mounds.setMatrixAt(mc++, m);
    }
    this.mounds.count = mc;
    this.mounds.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    Object.assign(this.stats, { humans, infected, zombies, dead, roof });
  }

  ringAt(k, i, kind) {
    const arr = this.rings.instanceMatrix.array, o = k * 16;
    const sc = (kind === 0 ? 1 + Math.sin(this.time * 4 + i) * 0.08 : 0.7) * this.ringScale;
    arr.fill(0, o, o + 16);
    arr[o] = sc; arr[o + 5] = 1; arr[o + 10] = sc; arr[o + 15] = 1;
    arr[o + 12] = this.x[i]; arr[o + 13] = (this.lvl[i] >= 0 ? this.y[i] : this.groundY(this.x[i], this.z[i])) + 0.06; arr[o + 14] = this.z[i];
    this.rings.setColorAt(k, kind === 0 ? this.zr : this.ir);
  }

  nearestZombie(x, z, skip = -1) {
    let best = 1e18, bi = -1;
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== S.ZOMBIE || i === skip) continue;
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }
}
