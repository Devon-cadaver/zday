// Civilians, zombies and police officers. Typed-array agent sim.
// Civilians walk block loops or stand in crowds, panic and flee when they notice
// a zombie, and when the outbreak is close they run into a building and up to
// the roof. Bitten civilians carry the infection unseen, then turn into one of
// several zombie types (walker, runner, crawler, bloater, juggernaut, screamer,
// skeleton). Zombies wander, chase, lunge and bite; when survivors sit on a roof
// they pile up against the wall like ants until the pile reaches the roof, then
// climb over. Officers hold a post, shoot zombies within range, fall back when
// overrun and can be bitten like anyone else.
import * as THREE from 'three';
import { cutGround } from './holes.js';
import { HALF, RW, SW, CURB } from './city.js';
import { rng } from './textures.js';
import { Lives } from './lives.js';
import { ARCHETYPES, figureGeometry, figureMaterial, figureAttributes, rollArchetype, OFFICER_LOOK, FIREFIGHTER_LOOK, SOLDIER_LOOK, ALIEN_LOOK, ZTYPES, rollZombieType, ZSKIN, FLAG, HAT, RADIOACTIVE } from './figures.js';

export const ST = { WALK: 0, IDLE: 1, FLEE: 2, RETURN: 3, GRABBED: 4, TURNING: 5, ZOMBIE: 6, FALLING: 7, DEAD: 8, SEEK: 9, INSIDE: 10, ROOF: 11, PILE: 12, CLIMB: 13, JUMP: 14, COP: 15, FIREMAN: 16, EVAC: 17, BOARD: 18, EXT: 19, AIR: 20, RIOT: 21, ALIEN: 22, FROZEN: 23, FILM: 24, HELD: 25, PRAY: 26, FIGHT: 27, STEAL: 28, SWIM: 29, GO: 30 }; // GO: on the way somewhere in their day (lives.js)
// how someone takes danger when it comes: most run or hide, some fight back, some go for a car, some kneel and pray
export const TRAIT = { NONE: 0, FIGHTER: 1, DRIVER: 2, FAITHFUL: 3 };
export const KIND = { CIVILIAN: 0, OFFICER: 1, FIREFIGHTER: 2, SOLDIER: 3, ALIEN: 4 };
export { ZTYPES };

const INCUBATE = [10, 18];
const RUN = [2.4, 3.2];
const SCREAM_R = 12, SCREAM_P = 0.65;
const STEER = [0.45, -0.45, 0.9, -0.9, 1.57, -1.57, 2.36, -2.36, 3.14]; // tried in this order, nearest the wanted heading first
const CELL = 6, RES = 0.5, RCELL = 25;
const UNIT_CAP = 320;
const G = 9.8;
const pileH = (n) => 1.7 * Math.sqrt(n) + 0.5;
const pileR = (n) => pileH(n) * 0.65 + 1.0;

const S = ST;
const CIV = new Uint8Array(32); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.ROOF, S.COP, S.FIREMAN, S.BOARD, S.RIOT, S.FILM, S.PRAY, S.FIGHT, S.STEAL].forEach(s => { CIV[s] = 1; });
const INHASH = new Uint8Array(32); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.ROOF, S.COP, S.FIREMAN, S.BOARD, S.RIOT, S.GRABBED, S.TURNING, S.ZOMBIE, S.ALIEN, S.FROZEN, S.FILM, S.HELD, S.PRAY, S.FIGHT, S.STEAL].forEach(s => { INHASH[s] = 1; });
const HITTABLE = new Uint8Array(32); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.COP, S.FIREMAN, S.BOARD, S.RIOT, S.GRABBED, S.TURNING, S.ZOMBIE, S.ALIEN, S.FROZEN, S.FILM, S.HELD, S.PRAY, S.FIGHT, S.STEAL].forEach(s => { HITTABLE[s] = 1; });
export const HOSTILE = new Uint8Array(32); HOSTILE[S.ZOMBIE] = 1; HOSTILE[S.ALIEN] = 1;
const BRACE = new Uint8Array(32); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.GO, S.ROOF, S.FILM, S.PRAY, S.SEEK].forEach(s => { BRACE[s] = 1; }); // who can curl up in a ball where they are
const GRABBABLE = new Uint8Array(32); [S.WALK, S.IDLE, S.FLEE, S.RETURN, S.SEEK, S.ROOF, S.COP, S.FIREMAN, S.BOARD, S.RIOT, S.GRABBED, S.TURNING, S.ZOMBIE, S.ALIEN, S.PILE, S.CLIMB, S.FALLING, S.JUMP, S.FROZEN, S.FILM, S.HELD, S.PRAY, S.FIGHT, S.STEAL].forEach(s => { GRABBABLE[s] = 1; });
const DISASTER_CAUSE = new Set(['fling', 'crush', 'drown', 'zap', 'bolt', 'freeze', 'burn', 'impact', 'rad']);
const ZSTATE = new Uint8Array(32); [S.ZOMBIE, S.TURNING, S.PILE, S.CLIMB, S.FALLING].forEach(s => { ZSTATE[s] = 1; });
const ANIM = new Float32Array(32);
ANIM[S.WALK] = 1; ANIM[S.FLEE] = 2; ANIM[S.RETURN] = 1; ANIM[S.TURNING] = 5; ANIM[S.ZOMBIE] = 3; ANIM[S.FALLING] = 5;
// afloat in deep water (SWIM): in the hash, can be pulled out (hittable, grabbable), waving for help (anim 12); not
// a civilian on foot, so crowds, zombies and sirens leave them be
INHASH[S.SWIM] = HITTABLE[S.SWIM] = GRABBABLE[S.SWIM] = 1; ANIM[S.SWIM] = 12;
CIV[S.GO] = INHASH[S.GO] = HITTABLE[S.GO] = GRABBABLE[S.GO] = 1; ANIM[S.GO] = 1; // on the way somewhere: a civilian on foot like any other
ANIM[S.DEAD] = 4; ANIM[S.SEEK] = 2; ANIM[S.PILE] = 5; ANIM[S.CLIMB] = 5; ANIM[S.JUMP] = 2; ANIM[S.BOARD] = 2; ANIM[S.EXT] = 2; ANIM[S.AIR] = 2; ANIM[S.RIOT] = 1; ANIM[S.ALIEN] = 7; ANIM[S.HELD] = 0; ANIM[S.PRAY] = 10; ANIM[S.FIGHT] = 7; ANIM[S.STEAL] = 2;

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

// half cone (flat side at x=0, bulging toward +x), unit radius and height, lumpy
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

export class People {
  constructor(city, parent, opts = {}) {
    this.city = city;
    this.opts = opts;
    this.nWalk = opts.people ?? 3200;
    this.fire = null; this.onOverrun = null;
    this.incubate = INCUBATE.slice(); this.runnerBoost = false; this.markInfected = false;
    this.rings = (city.layout && city.layout.rounds) || [];
    this.buildWalkGrid();
    this.setupBuildings();

    this.crowdPts = this.makeCrowds(rng(opts.seed ?? 99));
    this.nHuman = this.nWalk + this.crowdPts.length;
    const N = this.N = this.nHuman + UNIT_CAP;
    const F = () => new Float32Array(N);
    this.x = F(); this.z = F(); this.y = F(); this.t1 = F(); this.inc = F(); this.inc0 = F(); this.spd = F(); this.s = F(); this.lat = F();
    this.hx = F(); this.hz = F(); this.tx = F(); this.tz = F(); this.think = F(); this.wt = F(); this.hp = F();
    this.braceT = new Float32Array(N); // curled up in a ball for this long, a storm wall about to hit (brace.js)
    this.wz = new Uint8Array(N); this.wet = new Float32Array(N); this.cuff = new Float32Array(N); // seconds spent handcuffing a rioter
    this.px = new Float32Array(N); this.pz = new Float32Array(N); this.watch = new Uint8Array(N); // what someone is watching (a disaster nearby)
    this.st = new Uint8Array(N); this.inf = new Uint8Array(N); this.dirty = new Uint8Array(N); this.fx = new Uint8Array(N); this.kind = new Uint8Array(N); this.zt = new Uint8Array(N);
    this.zrad = new Uint8Array(N); this.spitT = new Float32Array(N); this.specT = 0; // irradiated (turns radioactive); a spitter's cooldown
    this.hord = new Int32Array(N).fill(-1); this.hordes = new Map(); this.hordeN = 0; this.hordeT = 0; // which horde a zombie walks with (hordeTick)
    this.blk = new Int16Array(N); this.lvl = new Int16Array(N); this.bt = new Int16Array(N);
    this.target = new Int32Array(N);
    this.base = new Array(N); this.trait = new Uint8Array(N);
    this.lives = new Lives(this, S, KIND, TRAIT); this.hour = 8.4; this.danger = false; this.lifeT = 0; // homes, jobs, characters, their day (the game sets the hour)

    const B = city.bounds;
    this.hx0 = B.x0 - HALF; this.hz0 = B.z0 - HALF;
    this.hw = Math.ceil((B.x1 - B.x0 + 2 * HALF) / CELL) + 1;
    this.hh = Math.ceil((B.z1 - B.z0 + 2 * HALF) / CELL) + 1;
    this.head = new Int32Array(this.hw * this.hh);
    this.next = new Int32Array(N);

    // figures: one instanced mesh, per-instance looks and animation id
    const geo = figureGeometry();
    this.fa = figureAttributes(geo, N);
    this.anim = this.fa.arrays.anim;
    const fm = figureMaterial();
    this.uTime = fm.uTime; this.uGlow = fm.uGlow;
    this.mesh = new THREE.InstancedMesh(geo, fm.mat, N);
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    // their shadows: a slim block per person in the same place, drawn only into the shadow map (the shadow pass never ran the figure's posing anyway)
    this.shadow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.7, 0.44).translate(0, 0.85, 0), fm.mat, N);
    this.shadow.instanceMatrix = this.mesh.instanceMatrix; this.shadow.castShadow = true; this.shadow.frustumCulled = false; this.shadow.layers.set(1); this.shadow.count = 0;
    parent.add(this.shadow);

    const bloodG = new THREE.CircleGeometry(1, 12); bloodG.rotateX(-Math.PI / 2);
    this.bloodMax = 1500;
    this.blood = new THREE.InstancedMesh(bloodG, cutGround(new THREE.MeshStandardMaterial({ color: '#5c0d08', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })), this.bloodMax);
    this.blood.count = 0; this.blood.frustumCulled = false; this.blood.receiveShadow = true;
    parent.add(this.blood);
    this.mounds = new THREE.InstancedMesh(moundGeometry(), cutGround(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: bodiesTexture() })), Math.max(1, this.bld.length));
    this.mounds.count = 0; this.mounds.castShadow = true; this.mounds.receiveShadow = true; this.mounds.frustumCulled = false;
    parent.add(this.mounds);
    const ringG = new THREE.RingGeometry(0.8, 1.05, 18); ringG.rotateX(-Math.PI / 2);
    this.marks = new THREE.InstancedMesh(ringG, new THREE.MeshBasicMaterial({ color: '#ffc233', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }), 512);
    this.marks.count = 0; this.marks.frustumCulled = false; this.marks.renderOrder = 2;
    parent.add(this.marks);
    this.flashMax = 48;
    this.flashes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff2a0' }), this.flashMax);
    this.flashes.count = 0; this.flashes.frustumCulled = false;
    parent.add(this.flashes);
    this.flashList = []; this.grenades = []; this.grenadeCd = 0; this.lifted = []; this.doors = new Map(); // bus doors (busDoor)
    // phones held up by people filming a disaster (their screens glow at night)
    this.phones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.34, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.5, 1.9) }), 900);
    this.phones.count = 0; this.phones.frustumCulled = false; parent.add(this.phones);
    this.poi = null; this.watchT = 0; this.watchSlice = 0;
    this.dust = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#efe0c0', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; parent.add(m); this.dust.push({ m, t: 1 });
    }

    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YZX');
    this._p = new THREE.Vector3(); this._p2 = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
    this.reset();
  }

  // ---------- setup
  makeCrowds(r) {
    const pts = [];
    const groups = Math.round(320 * Math.min(1, this.opts.crowd ?? 1)); // the corner groups go with the size of the town (a hamlet is not as packed as the city)
    for (const c of this.city.crowds) {
      for (let k = 0; k < c.n; k++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c.rad;
        const [px, pz] = this.offRoad(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d);
        pts.push([px, c.y, pz]);
      }
    }
    const blocks = this.city.walkBlocks;
    for (let k = 0; k < groups; k++) {
      const b = blocks[Math.floor(r() * blocks.length)]; const n = 3 + Math.floor(r() * 10);
      const cx = r() < 0.5 ? b.x0 : b.x1, cz = r() < 0.5 ? b.z0 : b.z1;
      for (let m = 0; m < n; m++) { const [px, pz] = this.offRoad(...this.offRing(cx + (r() - 0.5) * 3, cz + (r() - 0.5) * 3)); pts.push([px, CURB, pz]); }
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
    const L = this.city.layout, cell = (fn, x0, x1, z0, z1) => {
      const i0 = Math.max(0, Math.floor((x0 - this.gx0) / RES)), i1 = Math.min(this.gw - 1, Math.floor((x1 - this.gx0) / RES));
      const j0 = Math.max(0, Math.floor((z0 - this.gz0) / RES)), j1 = Math.min(this.gh - 1, Math.floor((z1 - this.gz0) / RES));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * this.gw + i, this.gx0 + (i + 0.5) * RES, this.gz0 + (j + 0.5) * RES);
    };
    // superblocks: the street that was taken out is now inside the block
    if (L) for (const sb of L.superblocks) cell((c) => { g[c] = 0; }, sb.x0 + 0.4, sb.x1 - 0.4, sb.z0 + 0.4, sb.z1 - 0.4);
    for (const o of open) {
      const i0 = Math.ceil((o.x0 + 0.4 - this.gx0) / RES), i1 = Math.floor((o.x1 - 0.4 - this.gx0) / RES);
      const j0 = Math.ceil((o.z0 + 0.4 - this.gz0) / RES), j1 = Math.floor((o.z1 - 0.4 - this.gz0) / RES);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * this.gw + i] |= 1;
    }
    if (L) {
      // roundabouts: the ring is road, the island and the curved sidewalk are walkable at curb height
      for (const rd of L.rounds) {
        const R = rd.ro + SW;
        cell((c, x, z) => { const d = Math.hypot(x - rd.x, z - rd.z); if (d > R - 0.35) return; g[c] = 1 | (d >= rd.ri && d < rd.ro ? 2 : 0); }, rd.x - R, rd.x + R, rd.z - R, rd.z + R);
      }
      // the diagonal avenue: road down the middle, sidewalks either side
      for (const sg of L.diags) {
        cell((c, x, z) => {
          const t = (x - sg.ax) * sg.ux + (z - sg.az) * sg.uz, d = Math.abs(sg.ux * (z - sg.az) - sg.uz * (x - sg.ax));
          if (t < -HALF || t > sg.L + HALF || d > HALF - 0.35) return;
          g[c] |= 1; if (d < RW / 2) g[c] |= 2;
        }, Math.min(sg.ax, sg.bx) - HALF, Math.max(sg.ax, sg.bx) + HALF, Math.min(sg.az, sg.bz) - HALF, Math.max(sg.az, sg.bz) + HALF);
      }
    }
    this.grid = g; this.grid0 = g.slice();
  }
  // a disaster makes ground impassable (a pit, a lava field); reset() puts the original grid back
  block(x, z, R, test = null) {
    const i0 = Math.max(0, Math.floor((x - R - this.gx0) / RES)), i1 = Math.min(this.gw - 1, Math.floor((x + R - this.gx0) / RES));
    const j0 = Math.max(0, Math.floor((z - R - this.gz0) / RES)), j1 = Math.min(this.gh - 1, Math.floor((z + R - this.gz0) / RES));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = this.gx0 + (i + 0.5) * RES, cz = this.gz0 + (j + 0.5) * RES;
      if (Math.hypot(cx - x, cz - z) <= R && (!test || test(cx, cz))) this.grid[j * this.gw + i] = 0;
    }
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
      const rf = b.roof, area = b.area ?? Math.max(0, rf.x1 - rf.x0) * Math.max(0, rf.z1 - rf.z0); // area: a pitched roof's floor (its 'roof' is the ridge)
      if (b.door && b.n) b.t = [-b.n[1], b.n[0]]; // along the wall from the door (firefighters line up on it, however small the building)
      if (!b.door || area < 20) return;
      this.bCap[k] = Math.min(120, Math.floor(area / 5));
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

  // ---------- looks
  setLook(i, L) { this.fa.write(i, L); this.lookDirty = true; }
  zombieLook(i) {
    const Z = ZTYPES[this.zt[i]];
    const L = Z.look(this.base[i]);
    L.scale = Z.scale || 1; L.torso = Z.torso || 1; // only radioactive zombies glow (their look sets it)
    this.setLook(i, L); this.dirty[i] = 2;
  }
  deadLook(i) {
    const A = this.fa.arrays, o = i * 3;
    for (let c = 0; c < 3; c++) { A.shirt[o + c] *= 0.5; A.pants[o + c] *= 0.5; A.skin[o + c] *= 0.55; A.accent[o + c] *= 0.5; A.accent2[o + c] *= 0.5; }
    A.kit[i * 4 + 1] = (A.kit[i * 4 + 1] | 0) & ~FLAG.GLOW;
    this.lookDirty = true; this.dirty[i] = 3;
  }

  reset() {
    this.braceT.fill(0);
    if (this.grid0) this.grid.set(this.grid0);
    this.doors.clear();
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
    this.dirty.fill(0); this.lvl.fill(-1); this.bt.fill(-1); this.fx.fill(0); this.inf.fill(0); this.target.fill(-1); this.t1.fill(0); this.kind.fill(0); this.zt.fill(0); this.hp.fill(1); this.zrad.fill(0); this.spitT.fill(0); this.custody = []; this.custodyN = 0; this.circles = []; this.circleN = 0;
    for (let i = 0; i < this.N; i++) {
      this.think[i] = r() * 0.4;
      const a = r() * Math.PI * 2; this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a);
      const A = rollArchetype(r); this.base[i] = A.roll(r); this.lives.arch[i] = ARCHETYPES.indexOf(A);
      this.setLook(i, this.base[i]);
      // temperament, from a hash of the index so the crowd looks the same as before: builders and off-duty cops fight, business types grab a car, the homeless pray
      const q = (((i + 1) * 2654435761) >>> 0) / 4294967296, fight = A.id === 'construction' || A.id === 'offduty' ? 0.45 : 0.07, drive = A.id === 'business' ? 0.18 : 0.06, pray = A.id === 'homeless' ? 0.3 : 0.08;
      this.trait[i] = q < fight ? TRAIT.FIGHTER : q < fight + drive ? TRAIT.DRIVER : q < fight + drive + pray ? TRAIT.FAITHFUL : TRAIT.NONE;
    }
    for (const a of [this.bIn, this.bRoof, this.bRoofAll, this.bPile, this.bBreach, this.bBarr, this.bHad, this.bOver, this.bEmpty]) a.fill(0);
    this.active = this.nHuman;
    this.drops = 0;
    this.bloodN = 0; this.blood.count = 0;
    this.time = 0; this.bldT = 0; this.firstRoof = false;
    this.stats = { humans: this.nHuman, infected: 0, zombies: 0, dead: 0, roof: 0, bites: 0, runover: 0, shot: 0, officers: 0, rescued: 0, bombed: 0, bombedCiv: 0, bused: 0, nukedCiv: 0, nukedZ: 0,
      disasterCiv: 0, disasterZ: 0, drowned: 0, abducted: 0, aliens: 0, aliensKilled: 0, rioters: 0, arrests: 0, jailed: 0, treated: 0, prayed: 0, fought: 0, stole: 0 };
    this.wz.fill(0); this.wet.fill(0); this.cuff.fill(0); this.watch.fill(0); this.waterAt = null; this.alarmT = 0; this.speedK = 1; this.mobs = [];
    this.hord.fill(-1); this.hordes.clear(); this.hordeT = 0;
    this.events = [];
    this.flashList.length = 0; this.grenades.length = 0; this.grenadeCd = 0;
    for (const d of this.dust) { d.m.visible = false; d.t = 1; }
    this.lives.reset(this.opts.seed ?? 99);
    this.sync(300);
  }

  // ---------- helpers
  walkPos(i) {
    const b = this.blocks[this.blk[i]], lat = this.lat[i] * 0.5;
    let s = ((this.s[i] % b.P) + b.P) % b.P, x, z;
    const fwd = this.spd[i] >= 0 ? 1 : -1;
    if (s < b.w) { x = b.x0 + s; z = b.z0 - lat; this.hx[i] = fwd; this.hz[i] = 0; }
    else if ((s -= b.w) < b.d) { x = b.x1 + lat; z = b.z0 + s; this.hx[i] = 0; this.hz[i] = fwd; }
    else if ((s -= b.d) < b.w) { x = b.x1 - s; z = b.z1 + lat; this.hx[i] = -fwd; this.hz[i] = 0; }
    else { s -= b.w; x = b.x0 - lat; z = b.z1 - s; this.hx[i] = 0; this.hz[i] = -fwd; }
    [x, z] = this.offRing(x, z);
    this.x[i] = x; this.z[i] = z; this.y[i] = CURB;
  }

  // the nearest walkable spot that is not roadway (searching out to 12 m), for people who are meant to stand still
  offRoad(x, z) {
    const ok = (px, pz) => this.walkable(px, pz) && !this.onRoad(px, pz);
    if (ok(x, z)) return [x, z];
    for (let r = RES; r <= 12; r += RES) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (ok(px, pz)) return [px, pz];
    }
    return [x, z];
  }

  // a spot on a block corner that a roundabout cut away moves out onto the curved sidewalk
  offRing(x, z) {
    for (const rd of this.rings) {
      const dx = x - rd.x, dz = z - rd.z, d = Math.hypot(dx, dz), R = rd.ro + SW * 0.55;
      if (d < R && d > 0.01) return [rd.x + dx / d * R, rd.z + dz / d * R];
    }
    return [x, z];
  }

  wk(x, z) {
    let k = this.speedK;
    if (this.waterAt) { const d = this.waterAt(x, z) - this.groundY(x, z); if (d > 0.35) k *= d > 1.1 ? 0.35 : 0.6; }
    return k;
  }

  move(i, dx, dz, dist) {
    const x = this.x[i], z = this.z[i];
    if (this.waterAt || this.speedK !== 1) dist *= this.wk(x, z);
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
  ztype(i) { return ZTYPES[this.zt[i]]; }

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

  // visit agents (civilians, officers, zombies, grabbed, turning) within R on level lvl
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
    if (s === S.FIGHT || s === S.STEAL || (s === S.PRAY && this.r() < 0.8)) return; // they made their choice (most who pray keep praying)
    if (s === S.GO && this.lives.inPlan(j) && (this.x[j] - fromX) ** 2 + (this.z[j] - fromZ) ** 2 > 25) return; // on their way to safety: they keep going unless it is right on them
    if (s !== S.FLEE && s !== S.PRAY && this.lvl[j] === -1 && this.kind[j] === KIND.CIVILIAN && !this.inf[j] && this.lives.respond(j, fromX, fromZ, threat)) return; // what this person does about it (lives.js)
    this.fleeFrom(j, fromX, fromZ, threat);
  }
  // away from (fromX, fromZ) at a run (or up onto a roof, if that is where they would rather be)
  fleeFrom(j, fromX, fromZ, threat) {
    const s = this.st[j];
    if (s === S.SEEK || s === S.COP || s === S.BOARD) return;
    if (s === S.RIOT && !(threat >= 0 && HOSTILE[this.st[threat]])) return; // rioters only scatter for the undead
    if (s === S.FIREMAN) { this.st[j] = S.FLEE; this.tx[j] = 2.8; this.t1[j] = 3 + this.r() * 2; this.target[j] = threat; this.bt[j] = -1; const d0 = Math.hypot(this.x[j] - fromX, this.z[j] - fromZ) || 1; this.hx[j] = (this.x[j] - fromX) / d0; this.hz[j] = (this.z[j] - fromZ) / d0; return; }
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

  // what a person can do about danger besides running (lives.respond chooses): stand their ground with whatever they can grab
  fightBack(j, threat) {
    const x = this.x[j], z = this.z[j];
    this.st[j] = S.FIGHT; this.target[j] = threat; this.t1[j] = 6; this.wt[j] = 0.4; this.think[j] = 0; this.fx[j] = 0;
    const A = this.fa.arrays; A.kit[j * 4 + 1] = (A.kit[j * 4 + 1] | 0) | FLAG.ITEM; this.lookDirty = true;
    if (!this.saidFight) { this.saidFight = true; this.events.push({ type: 'fightback', x, z }); }
    return true;
  }
  // the nearest parked car nobody else is going for: in, and away
  stealCar(j, fromX, fromZ) {
    const x = this.x[j], z = this.z[j];
    if (this.traffic) {
      const L = this.traffic.parkedList; let best = 30 * 30, bi = -1;
      for (let k = 0; k < L.length; k++) { const pc = L[k]; if (!pc.alive || pc.claimed || pc.burnt) continue; const d2 = (pc.x - x) ** 2 + (pc.z - z) ** 2; if (d2 < best) { best = d2; bi = k; } }
      if (bi >= 0) { L[bi].claimed = true; this.st[j] = S.STEAL; this.bt[j] = bi; this.t1[j] = 20; this.px[j] = fromX; this.pz[j] = fromZ; this.wt[j] = RUN[0] + this.r() * (RUN[1] - RUN[0]); return true; }
    }
    return false;
  }
  // a looter out of shop k with an armful: something in their hands, the first time a word on the news
  looted(j, k) {
    const A = this.fa.arrays; A.kit[j * 4 + 1] = (A.kit[j * 4 + 1] | 0) | FLAG.ITEM; this.lookDirty = true;
    this.stats.looted = (this.stats.looted || 0) + 1;
    if (!this.saidLoot) { this.saidLoot = true; this.events.push({ type: 'looting', x: this.x[j], z: this.z[j] }); }
  }
  // down on their knees: in the circle nearby, or starting one here
  pray(j, c) {
    const x = this.x[j], z = this.z[j];
    if (!c) { c = { id: this.circleN++ % 30000, x, z, n: 0, slots: 0 }; this.circles.push(c); if (!this.saidPray) { this.saidPray = true; this.events.push({ type: 'pray', x, z }); } }
    const m = c.slots++, a = m * 2.39996, R = 1.4 + Math.min(14, c.slots) * 0.16; // spread round the ring as they arrive
    let px = c.x + Math.cos(a) * R, pz = c.z + Math.sin(a) * R;
    if (!this.walkable(px, pz)) { const p = this.snapWalkable(px, pz, 4); if (p) { px = p[0]; pz = p[1]; } else { px = x; pz = z; } }
    this.st[j] = S.PRAY; this.bt[j] = c.id; this.tx[j] = px; this.tz[j] = pz; this.fx[j] = 0; this.t1[j] = 15; this.think[j] = 1; c.n++; this.stats.prayed++;
  }
  prayStep(i, h) {
    this.t1[i] -= h;
    if (this.fx[i] === 0) { // getting to their place in the circle
      const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
      if (d > 0.3 && this.t1[i] > 5) { this.hx[i] = dx / d; this.hz[i] = dz / d; if (!this.move(i, dx / d, dz / d, Math.min(d, 2.4 * h))) this.t1[i] = 0; return; }
      this.fx[i] = 1; this.t1[i] = 12 + this.r() * 10;
    }
    const c = this.circles.find(q => q.id === this.bt[i]); if (c) this.face(i, c.x, c.z);
    if ((this.think[i] -= h) > 0) return;
    this.think[i] = 1;
    const p = this.poi && this.poi(this.x[i], this.z[i]), danger = this.zombiesNear(this.x[i], this.z[i], 30) > 0 || (p && Math.hypot(p.x - this.x[i], p.z - this.z[i]) < Math.max(40, p.danger * 1.5));
    if (danger) this.t1[i] = Math.max(this.t1[i], 6);
    else if (this.t1[i] <= 0) { if (c) c.n--; this.bt[i] = -1; this.fx[i] = 0; this.startReturn(i); } // all quiet again: up off their knees
  }
  // going for the nearest zombie, swinging whatever they found; outnumbered, they run after all
  fightStep(i, h) {
    const x = this.x[i], z = this.z[i];
    let tg = this.target[i];
    this.t1[i] -= h; this.wt[i] -= h;
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.4;
      if (tg < 0 || this.st[tg] !== S.ZOMBIE || this.lvl[tg] !== -1 || Math.hypot(this.x[tg] - x, this.z[tg] - z) > 16) {
        tg = -1; let best = 14 * 14; this.around(x, z, 14, (j, d2) => { if (this.st[j] === S.ZOMBIE && d2 < best) { best = d2; tg = j; } }); this.target[i] = tg;
      }
      if (this.zombiesNear(x, z, 7) >= 4 && this.r() < 0.5) { this.endFight(i); this.st[i] = S.IDLE; this.panic(i, tg >= 0 ? this.x[tg] : x + 1, tg >= 0 ? this.z[tg] : z, tg); return; }
      if (tg >= 0) this.t1[i] = 6; else if (this.t1[i] <= 0) { this.endFight(i); this.startReturn(i); return; }
    }
    if (tg < 0) { this.fx[i] = 0; return; }
    const dx = this.x[tg] - x, dz = this.z[tg] - z, d = Math.hypot(dx, dz) || 0.01;
    this.hx[i] = dx / d; this.hz[i] = dz / d;
    if (d > 1.4) { this.fx[i] = 0; if (!this.move(i, dx / d, dz / d, 2.6 * h)) this.target[i] = -1; return; }
    this.fx[i] = 1;
    if (this.wt[i] > 0) return;
    this.wt[i] = 0.8 + this.r() * 0.4;
    if (this.r() < 0.35) { this.kill(tg, dx / d * 3, dz / d * 3, 'melee'); this.stats.fought++; this.target[i] = -1; }
    else if (this.fx[tg] !== 2) { this.fx[tg] = 2; this.t1[tg] = 1.4 + this.r(); this.move(tg, dx / d, dz / d, 0.8); } // knocked flat
  }
  endFight(i) { this.target[i] = -1; this.fx[i] = 0; this.setLook(i, this.base[i]); }
  // running for a parked car: once there it is hotwired and away
  stealStep(i, h) {
    const T = this.traffic, pc = T ? T.parkedList[this.bt[i]] : null;
    this.t1[i] -= h;
    if (!pc || !pc.alive || pc.burnt || this.t1[i] <= 0) { if (pc) pc.claimed = false; this.st[i] = S.IDLE; this.bt[i] = -1; this.panic(i, this.px[i], this.pz[i], -1); return; }
    const dx = pc.x - this.x[i], dz = pc.z - this.z[i], d = Math.hypot(dx, dz);
    if (d < 2.4) {
      const car = T.hotwire(pc, this.px[i], this.pz[i]); pc.claimed = false;
      if (car) { this.st[i] = S.EVAC; this.lvl[i] = -1; this.stats.stole++; this.events.push({ type: 'stolen', i, x: pc.x, z: pc.z }); }
      else { this.st[i] = S.IDLE; this.bt[i] = -1; this.panic(i, this.px[i], this.pz[i], -1); }
      return;
    }
    this.hx[i] = dx / d; this.hz[i] = dz / d;
    if (!this.move(i, dx / d, dz / d, this.wt[i] * h)) this.steer(i, dx / d, dz / d) && this.move(i, this.hx[i], this.hz[i], this.wt[i] * h);
  }
  // the open way nearest to heading (ax, az): headings either side tried in turn, each clear for a few metres
  steer(i, ax, az) {
    const x = this.x[i], z = this.z[i], base = Math.atan2(az, ax);
    for (const off of STEER) { const a = base + off, cx = Math.cos(a), cz = Math.sin(a); if (this.walkable(x + cx * 2.5, z + cz * 2.5) && this.walkable(x + cx * 5, z + cz * 5)) { this.hx[i] = cx; this.hz[i] = cz; return true; } }
    return this.randomCardinal(i);
  }
  // prayer circles nobody is kneeling in any more go
  circleTick() {
    if (!this.circles.length) return;
    const n = new Map(); for (let i = 0; i < this.active; i++) if (this.st[i] === S.PRAY) n.set(this.bt[i], (n.get(this.bt[i]) || 0) + 1);
    for (const c of this.circles) c.n = n.get(c.id) || 0;
    this.circles = this.circles.filter(c => c.n > 0);
  }
  wantsRoof(j) {
    if (this.kind[j] !== KIND.CIVILIAN) return false;
    if (this.alarmT > 0) return this.r() < 0.85;
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

  becomeZombie(i, type = -1) {
    this.zt[i] = type >= 0 ? type : this.zrad[i] ? RADIOACTIVE : (this.runnerBoost && this.r() < 0.3 ? 1 : rollZombieType(this.r));
    const Z = ZTYPES[this.zt[i]];
    this.hp[i] = Z.rad && this.zrad[i] === 1 ? 1 : Z.hp; // the tanker's gas: they glow, but drop to one shot (the nuclear kind takes two) this.inc[i] = Z.scream ? 4 + this.r() * 4 : 0;
    this.zombieLook(i);
  }

  // ---------- player / external actions
  // sandbox: a zombie falls from the sky
  drop(x, z, type = 0) {
    const p = this.snapWalkable(x, z);
    if (!p || this.active >= this.N) return -1;
    const i = this.active++;
    this.drops++;
    this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0; this.bt[i] = -1; this.kind[i] = 0;
    this.startFall(i, p[0], p[1], this.groundY(p[0], p[1]) + 30, false);
    this.inc0[i] = 0.75; this.t1[i] = 0.75; this.fx[i] = 1;
    this.becomeZombie(i, type);
    return i;
  }

  // commander: the n nearest civilians to (x,z) are already bitten and will turn soon
  // radiation from a blast or the plant: some of the living in range are infected and will turn radioactive
  irradiate(x, z, R, p = 0.3, inc = [8, 20]) {
    let n = 0;
    this.around(x, z, R, (j) => { if (this.isPrey(j) && this.kind[j] === KIND.CIVILIAN && this.r() < p) { this.inf[j] = 1; this.zrad[j] = 1; this.inc[j] = this.inc0[j] = inc[0] + this.r() * (inc[1] - inc[0]); this.dirty[j] = 1; n++; } });
    return n;
  }
  // twice a second: radioactive zombies infect everyone near them, spitters spit at someone out of reach
  specials() {
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== S.ZOMBIE || this.lvl[i] !== -1) continue;
      const Z = ZTYPES[this.zt[i]];
      if (Z.rad && this.zrad[i] === 2) { // only the nuclear kind gives off enough to infect without a bite
        this.around(this.x[i], this.z[i], 6.5, (j) => { if (this.isPrey(j) && this.kind[j] === KIND.CIVILIAN && this.r() < 0.02) { this.inf[j] = 1; this.zrad[j] = 2; this.inc[j] = this.inc0[j] = 5 + this.r() * 8; this.dirty[j] = 1; } });
      } else if (Z.spit && (this.spitT[i] -= 0.5) <= 0) {
        let tg = -1, bd = 1e9;
        this.around(this.x[i], this.z[i], 9, (j, d2) => { if (d2 > 4 && d2 < bd && this.isPrey(j) && this.kind[j] === KIND.CIVILIAN) { bd = d2; tg = j; } });
        if (tg >= 0) {
          this.spitT[i] = 6 + this.r() * 4;
          this.events.push({ type: 'spit', x: this.x[i], z: this.z[i], tx: this.x[tg], tz: this.z[tg] });
          if (this.r() < 0.6) { this.inf[tg] = 1; this.inc[tg] = this.inc0[tg] = 6 + this.r() * 8; this.dirty[tg] = 1; this.panic(tg, this.x[i], this.z[i], i); }
        }
      }
    }
  }

  infectAt(x, z, n, inc = [3, 8], rad = 0) {
    this.buildHash();
    const c = [];
    this.around(x, z, 16, (j, d2) => { if (this.isPrey(j) && this.kind[j] === 0 && this.st[j] !== S.ROOF) c.push([d2, j]); });
    c.sort((a, b) => a[0] - b[0]);
    let done = 0;
    for (const [, j] of c) {
      if (done >= n) break;
      this.inf[j] = 1; this.zrad[j] = rad; this.inc[j] = this.inc0[j] = inc[0] + this.r() * (inc[1] - inc[0]); this.dirty[j] = 1; done++;
    }
    return done;
  }

  // commander: officers get out of a cruiser at (x,z); kind OFFICER or SOLDIER
  spawnOfficers(x, z, n, kind = KIND.OFFICER) {
    const out = [];
    for (let k = 0; k < n && this.active < this.N; k++) {
      const a = this.r() * Math.PI * 2;
      let p = null;
      for (let rr = 2; rr <= 9 && !p; rr += 1) for (let q = 0; q < 10 && !p; q++) {
        const b = a + q * 0.63, px = x + Math.cos(b) * rr, pz = z + Math.sin(b) * rr;
        if (this.walkable(px, pz) && !this.onRoad(px, pz)) p = [px, pz];
      }
      if (!p) p = this.snapWalkable(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5, 12);
      if (!p) continue;
      const i = this.active++;
      this.st[i] = S.COP; this.kind[i] = kind; this.lvl[i] = -1; this.inf[i] = 0; this.fx[i] = 0;
      this.x[i] = p[0]; this.z[i] = p[1]; this.y[i] = this.groundY(p[0], p[1]);
      this.s[i] = kind === KIND.SOLDIER ? x : p[0]; this.lat[i] = kind === KIND.SOLDIER ? z : p[1]; // post (soldiers hold the vehicle)
      this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0.5 + this.r() * 0.5; this.bt[i] = -1; this.inc[i] = 0;
      this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a);
      this.base[i] = kind === KIND.SOLDIER ? SOLDIER_LOOK(this.r) : OFFICER_LOOK(this.r); this.setLook(i, this.base[i]); this.dirty[i] = 0;
      this.stats.officers++;
      out.push(i);
    }
    return out;
  }

  // commander: a fire crew gets off the truck at (x,z); the truck is their post
  spawnFirefighters(x, z, n) {
    const out = [];
    for (let k = 0; k < n && this.active < this.N; k++) {
      const a = this.r() * Math.PI * 2;
      let p = null;
      for (let rr = 2; rr <= 9 && !p; rr += 1) for (let q = 0; q < 10 && !p; q++) {
        const b = a + q * 0.63, px = x + Math.cos(b) * rr, pz = z + Math.sin(b) * rr;
        if (this.walkable(px, pz) && !this.onRoad(px, pz)) p = [px, pz];
      }
      if (!p) p = this.snapWalkable(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5, 12);
      if (!p) continue;
      const i = this.active++;
      this.st[i] = S.FIREMAN; this.kind[i] = KIND.FIREFIGHTER; this.lvl[i] = -1; this.inf[i] = 0; this.fx[i] = 0;
      this.x[i] = p[0]; this.z[i] = p[1]; this.y[i] = this.groundY(p[0], p[1]);
      this.s[i] = x; this.lat[i] = z; // post: the truck
      this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0; this.bt[i] = -1; this.inc[i] = 0;
      this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a);
      this.base[i] = FIREFIGHTER_LOOK(this.r); this.setLook(i, this.base[i]); this.dirty[i] = 0;
      out.push(i);
    }
    return out;
  }

  // the front door of bus busId, on the side with room to stand: [door x, z, a step inside x, z], and when it is next
  // free (one at a time up the steps). Worked out once per stop
  busDoor(busId) {
    let D = this.doors.get(busId); if (D) return D;
    const bus = this.traffic && this.traffic.cars[busId]; if (!bus || bus.gone) return null;
    const hx = bus.hx ?? Math.cos(bus.yaw), hz = bus.hz ?? -Math.sin(bus.yaw), s = this.walkable(bus.x + hx * 3 - hz * 3.5, bus.z + hz * 3 + hx * 3.5) ? 1 : -1, rx = -hz * s, rz = hx * s;
    D = { d: [bus.x + hx * 3.2 + rx * 1.8, bus.z + hz * 3.2 + rz * 1.8, bus.x + hx * 3.2 + rx * 0.2, bus.z + hz * 3.2 + rz * 0.2], free: 0 };
    this.doors.set(busId, D); return D;
  }
  // evacuation bus parked at (x,z): up to n street civilians within R run for its door
  callToBus(x, z, R, n, busId) {
    const c = [], D = this.busDoor(busId); if (D) { x = D.d[0]; z = D.d[1]; }
    this.around(x, z, R, (j, d2) => { if (this.kind[j] === 0 && !this.inf[j] && (this.st[j] === S.WALK || this.st[j] === S.IDLE || this.st[j] === S.FLEE || this.st[j] === S.RETURN || this.st[j] === S.GO)) c.push([d2, j]); });
    c.sort((a, b) => a[0] - b[0]);
    let k = 0;
    for (const [, j] of c) {
      if (k >= n) break;
      if (this.r() > 0.35 + this.lives.trust * 0.65) continue; // not everyone trusts the bus (the city's mood)
      this.st[j] = S.BOARD; this.tx[j] = x; this.tz[j] = z; this.bt[j] = busId; this.t1[j] = 25; this.inc[j] = 0; this.fx[j] = 0; this.watch[j] = 0;
      this.wt[j] = RUN[0] + this.r() * (RUN[1] - RUN[0]); k++;
    }
    return k;
  }

  // everyone still running for bus busId gives up
  releaseBus(busId) {
    for (let i = 0; i < this.active; i++) if (this.st[i] === S.BOARD && this.bt[i] === busId && this.watch[i] !== 2) { this.st[i] = S.IDLE; this.bt[i] = -1; this.fx[i] = 0; this.watch[i] = 0; this.panic(i, this.tx[i], this.tz[i], -1); if (this.st[i] === S.IDLE) this.startReturn(i); } // back to their street, not left standing in the queue
    this.doors.delete(busId);
  }

  // running for the bus door; there, waiting a turn (watch 1), then up the steps and in (watch 2)
  boardStep(i, h) {
    const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz), D = this.doors.get(this.bt[i]);
    const aboard = () => { this.st[i] = S.EVAC; this.lvl[i] = -1; if (this.fx[i] === 1) this.stats.jailed++; else this.stats.bused++; this.fx[i] = 0; this.watch[i] = 0; this.events.push({ type: 'boarded', i, bus: this.bt[i] }); };
    if (this.watch[i] === 2 && !D) { this.bt[i] = -1; this.fx[i] = 0; this.watch[i] = 0; this.y[i] = this.groundY(this.x[i], this.z[i]); this.startReturn(i); return; } // the bus pulled away as they stepped up
    if (this.watch[i] === 2) { // from where they stood to the door, then up into the bus
      this.t1[i] -= h; const k = 1 - Math.max(0, this.t1[i]) / 0.9;
      if (k < 0.55) { const e = k / 0.55; this.x[i] = this.px[i] + (D.d[0] - this.px[i]) * e; this.z[i] = this.pz[i] + (D.d[1] - this.pz[i]) * e; }
      else { const e = (k - 0.55) / 0.45; this.x[i] = D.d[0] + (D.d[2] - D.d[0]) * e; this.z[i] = D.d[1] + (D.d[3] - D.d[1]) * e; this.y[i] = this.groundY(this.x[i], this.z[i]) + 0.55 * e; }
      if (this.t1[i] <= 0) aboard();
      return;
    }
    this.t1[i] -= h;
    const bus = this.traffic && this.traffic.cars[this.bt[i]], giveUp = () => { this.bt[i] = -1; this.fx[i] = 0; this.watch[i] = 0; this.startReturn(i); };
    if (bus && bus.gone) { giveUp(); return; } // the bus has gone without them
    if (D && d < 2.6) { // at the door: in turn
      if (this.time < D.free) { if (this.t1[i] < -20) { giveUp(); return; } this.watch[i] = 1; this.face(i, D.d[2], D.d[3]); return; }
      D.free = this.time + 0.42; this.watch[i] = 2; this.t1[i] = 0.9; this.px[i] = this.x[i]; this.pz[i] = this.z[i]; this.face(i, D.d[2], D.d[3]); return;
    }
    if (!D && d < 2.2) { aboard(); return; }
    if (this.t1[i] <= 0) { giveUp(); return; } // could not get to it: back to their street
    if (this.inc[i] > 0) { this.inc[i] -= h; if (!this.move(i, this.hx[i], this.hz[i], this.wt[i] * h)) this.inc[i] = 0; return; }
    this.hx[i] = dx / d; this.hz[i] = dz / d;
    if (!this.move(i, dx / d, dz / d, this.wt[i] * h) && this.randomCardinal(i, 1.5)) this.inc[i] = 1.2;
  }

  // the nuke: everything within R dies, roofs included; the ground is scorched for the rest of the round
  nuke(x, z, R, byPlayer = true) { // byPlayer: the commander's own nuke (its civilian toll counts against them)
    const R2 = R * R;
    return this.nukeIf((j) => (this.x[j] - x) ** 2 + (this.z[j] - z) ** 2 <= R2, x, z, R, byPlayer);
  }
  // everyone the test picks out burned where they stand (the mini nuke picks those inside its quarantine zone)
  nukeIf(test, x, z, R, byPlayer = true) {
    let zk = 0, ck = 0;
    for (let j = 0; j < this.active; j++) {
      const s = this.st[j];
      if (s === S.DEAD || s === S.EVAC || !test(j)) continue;
      const dx = this.x[j] - x, dz = this.z[j] - z, d2 = dx * dx + dz * dz;
      const wasZ = s === S.ZOMBIE || s === S.PILE || s === S.CLIMB || s === S.TURNING || s === S.FALLING;
      if (s === S.PILE || s === S.CLIMB) { const k = this.bt[j]; if (k >= 0) this.bPile[k] = 0; }
      if (s === S.INSIDE) { const k = this.bt[j]; if (k >= 0) this.bIn[k] = Math.max(0, this.bIn[k] - 1); }
      const d = Math.sqrt(d2) || 1;
      this.st[j] = S.DEAD; this.inf[j] = 0; this.lvl[j] = -1;
      this.hx[j] = dx / d; this.hz[j] = dz / d; this.y[j] = this.groundY(this.x[j], this.z[j]);
      this.deadLook(j);
      const A = this.fa.arrays, o = j * 3; for (let c = 0; c < 3; c++) { A.shirt[o + c] *= 0.3; A.pants[o + c] *= 0.3; A.skin[o + c] *= 0.3; }
      if (wasZ) zk++; else { ck++; if (this.kind[j] === KIND.CIVILIAN) { if (byPlayer) this.stats.nukedCiv++; else this.stats.disasterCiv++; } }
    }
    if (byPlayer) this.stats.nukedZ += zk; else this.stats.disasterZ += zk;
    for (let k = 0; k < this.bld.length; k++) { const b = this.bld[k]; if (Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z) <= R) { this.bPile[k] = 0; this.bBreach[k] = 0; this.bBarr[k] = 0; this.bCap[k] = 0; } }
    this.scare(x, z, R * 2.2, 1);
    this.events.push({ type: 'nukekill', x, z, zk, ck });
    return { zk, ck };
  }

  // rescue helicopter: the next uninfected survivor on the roof of building k (or -1), taken onto the rope (hoist),
  // and in at the door (winched)
  roofPerson(k) { for (let i = 0; i < this.active; i++) if (this.st[i] === S.ROOF && this.lvl[i] === k && !this.inf[i]) return i; return -1; }
  hoist(j) { if (!this.grab(j)) return false; this.fx[j] = 3; this.hx[j] = 1; this.hz[j] = 0; return true; }
  winched(j) { this.st[j] = S.EVAC; this.lvl[j] = -1; this.fx[j] = 0; this.stats.rescued++; }
  // rescue helicopter: lift one uninfected survivor off the roof of building k
  evacuateFrom(k) {
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== S.ROOF || this.lvl[i] !== k || this.inf[i]) continue;
      this.st[i] = S.EVAC; this.lvl[i] = -1; this.stats.rescued++;
      return true;
    }
    return false;
  }

  // hurt or kill. Cars: slow hits knock walkers down, fast hits kill, armour shrugs. Shots: 1 hp.
  kill(j, vx = 0, vz = 0, cause = 'car') {
    const wasZ = this.st[j] === S.ZOMBIE, counted = this.st[j] === S.FROZEN && this.fx[j] >= 8; // already counted when the ice (or the flash) took them
    if (wasZ) {
      const Z = this.ztype(j);
      let dmg = 99;
      if (cause === 'car') {
        const sp = Math.hypot(vx, vz);
        if (Z.armored) dmg = sp >= 11 ? 2 : 0.5;
        else if (sp < 11 && this.fx[j] !== 2 && this.r() < 0.65) dmg = 0;
        if (dmg === 0 || (dmg < 99 && this.hp[j] - dmg > 0)) {
          this.hp[j] -= dmg;
          const n = sp || 1;
          if (!Z.armored) { this.move(j, vx / n, vz / n, 1.5 + sp * 0.25); this.fx[j] = 2; this.t1[j] = 2 + this.r() * 2; }
          this.hx[j] = vx / n; this.hz[j] = vz / n; this.target[j] = -1;
          this.addBlood(this.x[j], this.z[j], 0.5);
          this.events.push({ type: 'knockdown', j });
          return;
        }
      } else if (cause === 'shot') {
        dmg = 1;
        if (this.hp[j] - dmg > 0) { this.hp[j] -= dmg; this.t1[j] = Math.max(this.t1[j], 0.25); this.addBlood(this.x[j], this.z[j], 0.35); return; }
      }
      if (Z.pop) {
        this.addBlood(this.x[j], this.z[j], 2.2);
        const bx = this.x[j], bz = this.z[j];
        this.around(bx, bz, 3.2, (k) => { if (this.isPrey(k) && this.kind[k] === 0) { this.inf[k] = 1; this.inc[k] = this.inc0[k] = 4 + this.r() * 5; this.dirty[k] = 1; } });
        this.scare(bx, bz, 9, 0.9);
        this.events.push({ type: 'pop', j });
      }
    }
    this.st[j] = S.DEAD; this.inf[j] = 0; this.lvl[j] = -1;
    this.x[j] += vx * 0.12; this.z[j] += vz * 0.12;
    const sp = Math.hypot(vx, vz);
    if (sp > 0.1) { this.hx[j] = vx / sp; this.hz[j] = vz / sp; } else { const a = this.r() * 6.28; this.hx[j] = Math.cos(a); this.hz[j] = Math.sin(a); }
    this.y[j] = this.groundY(this.x[j], this.z[j]);
    this.addBlood(this.x[j], this.z[j], cause === 'shot' ? 0.45 + this.r() * 0.3 : 0.7 + this.r() * 0.6);
    this.deadLook(j);
    if (this.kind[j] === KIND.ALIEN) { this.stats.aliensKilled++; this.events.push({ type: 'alienkill', j, cause }); return; }
    if (cause === 'zap') { const A = this.fa.arrays, o = j * 3; for (let c = 0; c < 3; c++) { A.shirt[o + c] *= 0.35; A.pants[o + c] *= 0.35; A.skin[o + c] *= 0.3; } }
    if (cause === 'burn') { const A = this.fa.arrays, o = j * 3; for (let c = 0; c < 3; c++) { A.shirt[o + c] *= 0.25; A.pants[o + c] *= 0.25; A.skin[o + c] *= 0.2; } }
    if (DISASTER_CAUSE.has(cause) && !counted) { if (wasZ || this.wz[j]) this.stats.disasterZ++; else if (this.kind[j] === KIND.CIVILIAN) this.stats.disasterCiv++; }
    if (cause === 'car') { this.stats.runover++; this.events.push({ type: 'runover', j, zombie: wasZ }); }
    else if (cause === 'shot') { if (wasZ) this.stats.shot++; this.events.push({ type: 'shotdead', j, zombie: wasZ }); }
  }

  // a nuclear flash: turned to an ash statue where they stand (crumble() finishes it)
  ashen(j) {
    const s = this.st[j];
    this.wz[j] = s === S.ZOMBIE || ZSTATE[s] || ((s === S.EXT || s === S.AIR || s === S.FROZEN) && this.wz[j]) ? 1 : 0;
    if ((s === S.PILE || s === S.CLIMB) && this.bt[j] >= 0) this.bPile[this.bt[j]] = Math.max(0, this.bPile[this.bt[j]] - 1);
    this.st[j] = S.FROZEN; this.t1[j] = 0; this.target[j] = -1; this.inf[j] = 0; this.fx[j] = 8;
    const A = this.fa.arrays, o = j * 3, g = 0.4 + this.r() * 0.14;
    for (const key of ['shirt', 'pants', 'skin', 'accent', 'accent2']) { A[key][o] = g * 1.03; A[key][o + 1] = g; A[key][o + 2] = g * 0.93; }
    A.kit[j * 4 + 1] = (A.kit[j * 4 + 1] | 0) & ~FLAG.GLOW; A.zed[j * 4 + 1] = 0; A.zed[j * 4 + 3] = 0;
    this.lookDirty = true; this.dirty[j] = 4;
  }
  // the ash statue blows away; counted against the commander when it was their own nuke
  crumble(j, byPlayer = false) {
    const z = !!this.wz[j] || this.st[j] === S.ZOMBIE;
    if (this.kind[j] === KIND.ALIEN) this.stats.aliensKilled++;
    else if (z) { if (byPlayer) this.stats.nukedZ++; else this.stats.disasterZ++; }
    else if (this.kind[j] === KIND.CIVILIAN) { if (byPlayer) this.stats.nukedCiv++; else this.stats.disasterCiv++; }
    this.st[j] = S.DEAD; this.inf[j] = 0; this.lvl[j] = -1; this.y[j] = -25; this.dirty[j] = 3;
  }

  // panic civilians around a point (crash, pop)
  scare(x, z, R, p = 0.8) {
    this.around(x, z, R, (j) => { if (this.r() < p) this.panic(j, x, z, -1); });
  }

  // ---------- simulation
  step(h) {
    this.time += h;
    this.buildHash();
    if ((this.specT -= h) <= 0) { this.specT = 0.5; this.specials(); }
    if ((this.hordeT -= h) <= 0) { this.hordeT = 1; this.hordeTick(); }
    if ((this.lifeT -= h) <= 0) { this.lifeT = 0.25; this.lives.tick(); } // a slice of the strollers think what to do next
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      if (this.braceT[i] > 0) { this.braceT[i] -= h; if (BRACE[s]) continue; this.braceT[i] = 0; } // curled up where they are (anything else that happens to them ends it)
      switch (s) {
        case S.WALK: this.s[i] += this.spd[i] * h * ((this.waterAt || this.speedK !== 1) ? this.wk(this.x[i], this.z[i]) : 1); this.walkPos(i); break;
        case S.AIR: this.airStep(i, h); break;
        case S.SWIM: this.swimStep(i, h); break;
        case S.RIOT: this.riotStep(i, h); break;
        case S.FROZEN: this.frozenStep(i, h); break;
        case S.FILM: this.filmStep(i, h); break;
        case S.ALIEN: this.alienStep(i, h); break;
        case S.FLEE: this.fleeStep(i, h); break;
        case S.RETURN: {
          const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
          const v = Math.abs(this.spd[i]) * h;
          if (d <= v + 0.05) { this.st[i] = S.WALK; this.walkPos(i); }
          else { this.hx[i] = dx / d; this.hz[i] = dz / d; if (!this.move(i, dx / d, dz / d, v)) { this.x[i] = this.tx[i]; this.z[i] = this.tz[i]; } }
          break;
        }
        case S.SEEK: this.seekStep(i, h); break;
        case S.GO: this.lives.goStep(i, h); break;
        case S.INSIDE: this.insideStep(i, h); break;
        case S.ROOF: this.roofStep(i, h); break;
        case S.COP: this.copStep(i, h); break;
        case S.FIREMAN: this.firemanStep(i, h); break;
        case S.BOARD: this.boardStep(i, h); break;
        case S.HELD: this.heldStep(i, h); break;
        case S.PRAY: this.prayStep(i, h); break;
        case S.FIGHT: this.fightStep(i, h); break;
        case S.STEAL: this.stealStep(i, h); break;
        case S.GRABBED:
          if ((this.t1[i] -= h) <= 0) {
            this.inf[i] = 1;
            this.inc[i] = this.inc0[i] = this.incubate[0] + this.r() * (this.incubate[1] - this.incubate[0]);
            const b = this.target[i];
            if (b >= 0 && this.zt[b] === RADIOACTIVE) this.zrad[i] = this.zrad[b] || 1; // a radioactive bite carries it on: the whole outbreak glows
            if (this.kind[i] === KIND.OFFICER) { this.st[i] = S.COP; this.target[i] = -1; break; }
            if (this.kind[i] === KIND.FIREFIGHTER) { this.st[i] = S.FIREMAN; this.target[i] = -1; break; }
            this.st[i] = this.lvl[i] >= 0 ? S.ROOF : S.IDLE; // released, a civilian again (infected)
            this.panic(i, b >= 0 ? this.x[b] : this.x[i] + 1, b >= 0 ? this.z[b] : this.z[i], b);
            if (this.st[i] === S.FLEE) this.t1[i] = 3 + this.r() * 3;
          }
          break;
        case S.TURNING:
          if ((this.t1[i] -= h) <= 0) {
            this.st[i] = S.ZOMBIE; this.target[i] = -1; this.think[i] = 0; this.wt[i] = 0; this.bt[i] = -1; this.fx[i] = 0;
            this.becomeZombie(i);
            this.events.push({ type: 'turned', i });
          }
          break;
        case S.ZOMBIE: if (this.lvl[i] >= 0) this.roofZombieStep(i, h, this.ztype(i)); else this.zombieStep(i, h, this.ztype(i)); break;
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
      // deep water: a few seconds wading in it and the living are swept off their feet (zombies just keep walking)
      if (this.waterAt && CIV[this.st[i]] && this.lvl[i] === -1) {
        const d = this.waterAt(this.x[i], this.z[i]) - this.groundY(this.x[i], this.z[i]);
        if (d > 1.3) { this.wet[i] += h; if (this.wet[i] > 5) this.swim(i, 60 + this.r() * 60); }
        else if (this.wet[i] > 0) this.wet[i] = Math.max(0, this.wet[i] - h);
      }
    }
    if (this.alarmT > 0) this.alarmT -= h;
    if ((this.watchT -= h) <= 0) { this.watchT = 0.25; this.watchScan(); }
    this.bldT += h;
    if (this.bldT >= 1) {
      this.buildingTick(this.bldT); this.bldT = 0; this.circleTick();
      for (const c of this.custody) if (!c.bus && !c.done && this.time - c.t > 90) { this.releaseHeld(c.id); c.done = true; } // no bus ever came: let off with a warning
    }
    for (const d of this.dust) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + h / 0.9);
      const k = 1 + d.t * 5; d.m.scale.set(k, 1, k); d.m.material.opacity = 0.75 * (1 - d.t);
      if (d.t >= 1) d.m.visible = false;
    }
    for (let k = this.flashList.length - 1; k >= 0; k--) { if ((this.flashList[k].t -= h) <= 0) this.flashList.splice(k, 1); }
    this.grenadeCd -= h;
    for (let k = this.grenades.length - 1; k >= 0; k--) {
      const gr = this.grenades[k];
      if ((gr.t -= h) <= 0) { this.grenades.splice(k, 1); this.events.push({ type: 'boom', x: gr.x, z: gr.z, size: 0 }); this.blast(gr.x, gr.z, 5, false); this.puff(gr.x, gr.z); if (this.fire) this.fire.spray(gr.x, gr.z, 0.5, 6, 2.5, 0.9); }
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
    if (!this.move(i, this.hx[i], this.hz[i], this.tx[i] * h)) this.steer(i, this.hx[i], this.hz[i]);
    if ((this.t1[i] -= h) <= 0) {
      if (this.kind[i] === KIND.OFFICER) { this.st[i] = S.COP; this.fx[i] = 0; this.target[i] = -1; }
      else if (this.kind[i] === KIND.FIREFIGHTER) { this.st[i] = S.FIREMAN; this.fx[i] = 0; this.target[i] = -1; this.bt[i] = -1; }
      else this.startReturn(i);
    }
  }

  seekStep(i, h) {
    const k = this.bt[i], b = this.bld[k];
    const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
    this.t1[i] -= h;
    if (d < 0.9) {
      const full = this.bIn[k] + this.bRoofAll[k] >= this.bCap[k];
      const blocked = this.bBreach[k] || (this.fire && this.fire.bFire[k]) || full || (this.bBarr[k] && this.zombiesNear(b.door[0], b.door[1], 4) > 0);
      if (blocked) { this.st[i] = S.IDLE; this.panic(i, b.wall[0], b.wall[1], -1); return; }
      this.st[i] = S.INSIDE; this.lvl[i] = -2; this.bIn[k]++; this.bBarr[k] = 1; this.fx[i] = 0; // sheltering (fx 9 is the routine)
      this.t1[i] = 3 + (b.roofY - b.baseY) / 5 + this.r() * 2;
      return;
    }
    if (this.t1[i] <= 0) { this.st[i] = S.IDLE; this.panic(i, this.x[i] - dx, this.z[i] - dz, -1); return; }
    if (this.wt[i] < 0) { // detouring around a corner
      this.inc[i] -= h;
      if (this.inc[i] <= 0 || !this.move(i, this.hx[i], this.hz[i], -this.wt[i] * h)) this.wt[i] = -this.wt[i];
      return;
    }
    this.hx[i] = dx / d; this.hz[i] = dz / d;
    if (!this.move(i, dx / d, dz / d, this.wt[i] * h)) {
      if (this.randomCardinal(i, 1.5)) { this.wt[i] = -this.wt[i]; this.inc[i] = 1.2; }
    }
  }

  insideStep(i, h) {
    if (this.fx[i] === 9) { this.lives.indoorStep(i, h); return; } // at home, at work, in a shop
    if ((this.t1[i] -= h) > 0) return;
    const k = this.bt[i], rf = this.bld[k].roof;
    this.bIn[k] = Math.max(0, this.bIn[k] - 1);
    this.st[i] = S.ROOF; this.lvl[i] = k; this.bHad[k] = 1;
    const hd = this.bld[k].hatch; // up the stairs and out through the hut door
    if (hd) { this.x[i] = hd[0] + (this.r() - 0.5) * 0.4; this.z[i] = hd[1] + (this.r() - 0.5) * 0.4; } else { this.x[i] = rf.x0 + this.r() * (rf.x1 - rf.x0); this.z[i] = rf.z0 + this.r() * (rf.z1 - rf.z0); }
    this.y[i] = this.bld[k].roofY;
    const sp = this.roofSpot(k); this.tx[i] = sp[0]; this.tz[i] = sp[1]; this.t1[i] = 0; this.think[i] = this.r(); this.watch[i] = 0;
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
    // something to see? crowd the side of the roof that faces it (and run across when it moves past)
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.6 + this.r() * 0.6;
      const p = this.poi && this.poi(this.x[i], this.z[i]);
      if (p) { const e = this.watchSpot(k, i, p.x, p.z); this.tx[i] = e[0]; this.tz[i] = e[1]; this.px[i] = p.x; this.pz[i] = p.z; this.watch[i] = 1; }
      else if (this.watch[i]) { this.watch[i] = 0; const q = this.roofSpot(k); this.tx[i] = q[0]; this.tz[i] = q[1]; }
    }
    const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz);
    if (d > 0.1) { const run = this.watch[i] && d > 2.5; this.hx[i] = dx / d; this.hz[i] = dz / d; this.moveRoof(i, dx / d, dz / d, Math.min(d, (run ? 2.4 : 0.5) * h)); this.fx[i] = run ? 2 : 1; }
    else if (this.watch[i]) { this.face(i, this.px[i], this.pz[i]); this.fx[i] = this.films(i) ? 3 : 0; this.snap(i); }
    else { this.fx[i] = 0; if (this.r() < h * 0.4) { const q = this.roofSpot(k); this.tx[i] = q[0]; this.tz[i] = q[1]; } }
  }

  // a free spot on roof k, clear of the stair hut
  roofSpot(k) {
    const b = this.bld[k], rf = b.roof, hu = b.hut;
    let x = 0, z = 0;
    for (let n = 0; n < 6; n++) {
      x = rf.x0 + this.r() * (rf.x1 - rf.x0); z = rf.z0 + this.r() * (rf.z1 - rf.z0);
      if (!hu || x < hu.x0 - 0.4 || x > hu.x1 + 0.4 || z < hu.z0 - 0.4 || z > hu.z1 + 0.4) break;
    }
    return [x, z];
  }
  // where on roof k to stand to watch (px, pz): along the parapet facing it, spread out, a second row behind
  watchSpot(k, i, px, pz) {
    const rf = this.bld[k].roof, cx = (rf.x0 + rf.x1) / 2, cz = (rf.z0 + rf.z1) / 2, m = 0.45;
    let dx = px - cx, dz = pz - cz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const hw = Math.max(0.1, (rf.x1 - rf.x0) / 2 - m), hd = Math.max(0.1, (rf.z1 - rf.z0) / 2 - m);
    const s = Math.min(hw / Math.max(1e-3, Math.abs(dx)), hd / Math.max(1e-3, Math.abs(dz)));
    const spread = ((i * 7919) % 101) / 100 - 0.5, row = (i % 3) * 0.75;
    const ex = cx + dx * (s - row) - dz * spread * Math.max(hw, hd) * 1.8, ez = cz + dz * (s - row) + dx * spread * Math.max(hw, hd) * 1.8;
    return [Math.min(rf.x1 - m, Math.max(rf.x0 + m, ex)), Math.min(rf.z1 - m, Math.max(rf.z0 + m, ez))];
  }
  face(i, px, pz) { const dx = px - this.x[i], dz = pz - this.z[i], d = Math.hypot(dx, dz) || 1; this.hx[i] = dx / d; this.hz[i] = dz / d; }
  films(i) { return ((i * 2654435761) >>> 0) % 10 < 7; } // most hold a phone up, some just stare
  snap(i) { if (this.films(i) && this.r() < 0.004 && this.flashList.length < this.flashMax) this.flashList.push({ x: this.x[i] + this.hx[i] * 0.5, y: this.y[i] + 1.5, z: this.z[i] + this.hz[i] * 0.5, t: 0.05 }); }

  // people in the street who are not in danger stop to watch and film
  watchScan() {
    if (!this.poi || this.filmN > 600) return;
    const sl = this.watchSlice = (this.watchSlice + 1) % 6;
    for (let i = sl; i < this.active; i += 6) {
      const s = this.st[i];
      if ((s !== S.WALK && s !== S.IDLE && s !== S.RETURN && s !== S.GO) || this.inf[i] || this.kind[i] !== KIND.CIVILIAN || this.lvl[i] !== -1) continue;
      const p = this.poi(this.x[i], this.z[i]);
      if (!p || this.r() > 0.08 + this.lives.trait('curious', i) * 0.5 - this.lives.trait('fear', i) * 0.2) continue; // the curious stay to film it
      const d = Math.hypot(p.x - this.x[i], p.z - this.z[i]);
      if (d < p.danger || d > Math.min(p.range * 0.5, 160)) continue; // from the street you only see what is fairly close
      this.st[i] = S.FILM; this.t1[i] = 8 + this.r() * 14; this.think[i] = this.r(); this.px[i] = p.x; this.pz[i] = p.z;
    }
  }
  filmStep(i, h) {
    this.t1[i] -= h;
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.8 + this.r() * 0.5;
      const p = this.poi && this.poi(this.x[i], this.z[i]);
      if (!p || this.t1[i] <= 0) { this.startReturn(i); return; }
      this.px[i] = p.x; this.pz[i] = p.z;
      if (Math.hypot(p.x - this.x[i], p.z - this.z[i]) < p.danger) { this.panic(i, p.x, p.z, -1); return; } // too close now: run
    }
    this.face(i, this.px[i], this.pz[i]); this.snap(i);
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

  // ---------- officers
  copStep(i, h) {
    const x = this.x[i], z = this.z[i];
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.25;
      const sol = this.kind[i] === KIND.SOLDIER;
      const mop = this.stats.zombies <= 12 && !this.holdPosts, R = mop ? 160 : sol ? 70 : 60; // few left: officers roam and hunt them down (not while they hold a quarantine)
      let best = R * R, bi = -1, near = 0, clump = 0, cx = 0, cz = 0;
      this.around(x, z, R, (j, d2) => { if (!HOSTILE[this.st[j]]) return; if (d2 < 36) near++; if (d2 < best) { best = d2; bi = j; } if (sol && d2 > 100 && d2 < 900) { clump++; cx += this.x[j]; cz += this.z[j]; } });
      if (!mop && bi >= 0 && Math.hypot(this.x[bi] - this.s[i], this.z[bi] - this.lat[i]) > (this.holdPosts ? 24 : sol ? 45 : 100)) bi = -1; // too far from the post (an outbreak on: they hold their street)
      if (bi < 0 && this.smallPiles && this.smallPiles.length) { // nothing in the street: a small pile at a building's foot within 22 m, or 160 m once only a few are left (it can't reach the roof and nobody could shoot it)
        for (const k of this.smallPiles) { const b = this.bld[k]; if (Math.hypot(b.wall[0] - x, b.wall[1] - z) > (mop ? 160 : 22)) continue; for (let j = 0; j < this.active; j++) if (this.st[j] === S.PILE && this.bt[j] === k) { this.unpile(j); bi = j; break; } if (bi >= 0) break; }
      }
      this.target[i] = bi;
      if (sol && clump >= 6 && this.grenadeCd <= 0) { this.grenadeCd = 4; this.grenade(i, cx / clump, cz / clump); }
      if (bi < 0) { // nothing to shoot: pick a rioter to arrest
        let rb = 25 * 25, rj = -1;
        this.around(x, z, 25, (j, d2) => { if (this.st[j] === S.RIOT && d2 < rb) { rb = d2; rj = j; } });
        this.bt[i] = rj;
      } else this.bt[i] = -1;
      if (near >= (sol ? 14 : 8)) { // overrun: fall back
        this.st[i] = S.FLEE; this.tx[i] = 3.0; this.t1[i] = 4; this.target[i] = bi;
        const dx = x - this.x[bi], dz = z - this.z[bi], d = Math.hypot(dx, dz) || 1; this.hx[i] = dx / d; this.hz[i] = dz / d;
        this.events.push({ type: 'fallback', i });
        return;
      }
    }
    const tg = this.target[i];
    const ar = this.bt[i];
    if ((tg < 0 || !HOSTILE[this.st[tg]]) && ar >= 0 && this.st[ar] === S.RIOT) {
      const dx = this.x[ar] - x, dz = this.z[ar] - z, d = Math.hypot(dx, dz) || 0.001;
      this.hx[i] = dx / d; this.hz[i] = dz / d; this.fx[i] = 1;
      if (d > 1.6) { if (!this.move(i, dx / d, dz / d, 3.0 * h)) this.randomCardinal(i, 1.5); }
      else { this.t1[ar] = 0.3; this.cuff[i] += h; if (this.cuff[i] >= 2.5) { this.arrest(ar); this.bt[i] = -1; this.cuff[i] = 0; } } // hold them, cuff them
      return;
    }
    if (tg >= 0 && HOSTILE[this.st[tg]]) {
      const dx = this.x[tg] - x, dz = this.z[tg] - z, d = Math.hypot(dx, dz) || 0.001;
      this.hx[i] = dx / d; this.hz[i] = dz / d;
      const sol = this.kind[i] === KIND.SOLDIER, engage = sol ? 18 : 12, range = sol ? 32 : 22;
      if (this.inc[i] > 0) { // detouring round a corner
        this.inc[i] -= h; this.fx[i] = 1;
        if (!this.move(i, this.hx[i], this.hz[i], 2.4 * h)) this.inc[i] = 0;
      } else if (d > engage) { if (!this.move(i, dx / d, dz / d, 2.8 * h) && this.randomCardinal(i, 1.5)) this.inc[i] = 1.2; this.fx[i] = 1; }
      else if (d < 3.5) { this.move(i, -dx / d, -dz / d, 1.8 * h); this.fx[i] = 1; }
      else this.fx[i] = 2;
      this.wt[i] -= h; if (sol) this.inc0[i] -= h;
      if (this.wt[i] <= 0 && d < range) { this.wt[i] = sol ? 0.35 : 0.6; this.shoot(i, tg, sol ? d * 0.6 : d); }
      return;
    }
    // no target: drift back toward the post
    const dx = this.s[i] - x, dz = this.lat[i] - z, d = Math.hypot(dx, dz);
    if (d > 3) { this.hx[i] = dx / d; this.hz[i] = dz / d; this.move(i, dx / d, dz / d, 1.2 * h); this.fx[i] = 1; }
    else this.fx[i] = 0;
  }

  // ---------- firefighters
  firemanStep(i, h) {
    const x = this.x[i], z = this.z[i], F = this.fire;
    let k = this.bt[i];
    if (k >= 0 && (!F || F.bFire[k] !== 1)) { k = this.bt[i] = -1; }
    if (k < 0) {
      if ((this.think[i] -= h) <= 0) {
        this.think[i] = 1.0;
        let best = 110 * 110, bk = -1;
        if (F) for (const [k2] of F.burning) {
          if (F.bFire[k2] !== 1) continue;
          const b = this.bld[k2]; if (!b.door) continue;
          const d2 = (b.door[0] - this.s[i]) ** 2 + (b.door[1] - this.lat[i]) ** 2;
          if (d2 < best) { best = d2; bk = k2; }
        }
        if (bk >= 0) {
          const b = this.bld[bk];
          k = this.bt[i] = bk;
          this.tx[i] = b.door[0] + b.n[0] * 1.6 + b.t[0] * (this.r() - 0.5) * 3;
          this.tz[i] = b.door[1] + b.n[1] * 1.6 + b.t[1] * (this.r() - 0.5) * 3;
          this.inc[i] = 0;
        }
      }
      if (k < 0) { // nothing burning: wait by the truck
        const dx = this.s[i] - x, dz = this.lat[i] - z, d = Math.hypot(dx, dz);
        if (d > 4) { this.hx[i] = dx / d; this.hz[i] = dz / d; this.move(i, dx / d, dz / d, 1.4 * h); this.fx[i] = 1; } else this.fx[i] = 0;
        return;
      }
    }
    const dx = this.tx[i] - x, dz = this.tz[i] - z, d = Math.hypot(dx, dz);
    if (d > 2) {
      if (this.inc[i] > 0) { this.inc[i] -= h; if (!this.move(i, this.hx[i], this.hz[i], 2.4 * h)) this.inc[i] = 0; }
      else { this.hx[i] = dx / d; this.hz[i] = dz / d; if (!this.move(i, dx / d, dz / d, 2.4 * h) && this.randomCardinal(i, 1.5)) this.inc[i] = 1.2; }
      this.fx[i] = 1;
      return;
    }
    // on the hose
    const b = this.bld[k];
    const wx = b.wall[0] - x, wz = b.wall[1] - z, wd = Math.hypot(wx, wz) || 1;
    this.hx[i] = wx / wd; this.hz[i] = wz / wd; this.fx[i] = 2;
    F.douse(k, h);
    F.jet(x + this.hx[i] * 0.5, this.y[i] + 1.2, z + this.hz[i] * 0.5, b.wall[0] - b.n[0] * 0.4 + b.t[0] * Math.sin(this.time * 0.7 + i) * 2, 2.5 + (i % 4) * 1.5, b.wall[1] - b.n[1] * 0.4 + b.t[1] * Math.sin(this.time * 0.7 + i) * 2, 2, 0.9); // the hose
    this.wt[i] -= h;
    if (this.wt[i] <= 0) { this.wt[i] = 0.35; F.spray(b.wall[0] - b.n[0] * 0.6 + (this.r() - 0.5) * 2, b.wall[1] - b.n[1] * 0.6 + (this.r() - 0.5) * 2, 1.5 + this.r() * 4); }
  }

  // a soldier lobs a grenade at a clump: 5 m kill radius after a 1.5 s fuse
  grenade(i, gx, gz) {
    this.events.push({ type: 'grenade', x: gx, z: gz, from: i });
    this.grenades.push({ x: gx, z: gz, t: 1.5 });
  }

  // airstrike / grenade: everything within R dies; civilians count against the commander
  blast(x, z, R, civilians = true) {
    let zk = 0, ck = 0;
    const R2 = R * R;
    for (let j = 0; j < this.active; j++) {
      const s = this.st[j];
      if (s === S.DEAD || s === S.INSIDE || s === S.EVAC) continue;
      if (this.lvl[j] >= 0 && R < 15) continue; // grenades do not reach rooftops
      const dx = this.x[j] - x, dz = this.z[j] - z, d2 = dx * dx + dz * dz;
      if (d2 > R2) continue;
      const wasZ = s === S.ZOMBIE || s === S.PILE || s === S.CLIMB || s === S.TURNING || s === S.FALLING;
      if (!wasZ && !civilians) continue;
      if (s === S.PILE || s === S.CLIMB) { const k = this.bt[j]; if (k >= 0) { this.bPile[k] = Math.max(0, this.bPile[k] - 1); } }
      const d = Math.sqrt(d2) || 1, k = (1 - d / R) * 12 + 3;
      this.st[j] = S.DEAD; this.inf[j] = 0; this.lvl[j] = -1; this.x[j] += dx / d * 0.5; this.z[j] += dz / d * 0.5;
      this.hx[j] = dx / d; this.hz[j] = dz / d; this.y[j] = this.groundY(this.x[j], this.z[j]);
      this.deadLook(j);
      if (wasZ) zk++; else { ck++; if (this.kind[j] === KIND.CIVILIAN) this.stats.bombedCiv++; }
    }
    this.stats.bombed += zk;
    if (R >= 15) { this.addBlood(x, z, R * 0.5); this.scare(x, z, R * 2.5, 0.95); }
    else this.addBlood(x, z, 1.5);
    this.events.push({ type: 'blastkill', x, z, zk, ck });
    return { zk, ck };
  }

  // ---------- disasters
  // take control of an agent (tornado, tractor beam, wave). Returns false if it cannot be taken.
  grab(i) {
    const s = this.st[i];
    if (!GRABBABLE[s]) return false;
    this.wz[i] = ZSTATE[s] ? 1 : 0;
    if ((s === S.PILE || s === S.CLIMB) && this.bt[i] >= 0) this.bPile[this.bt[i]] = Math.max(0, this.bPile[this.bt[i]] - 1);
    this.st[i] = S.EXT; this.lvl[i] = -1; this.inf[i] = 0; this.target[i] = -1; this.fx[i] = 0;
    return true;
  }
  // set someone down on the street unhurt (carried down by a hero); they run from (fx, fz)
  setDown(i, fx, fz) {
    if (this.st[i] !== S.EXT) return;
    this.y[i] = this.groundY(this.x[i], this.z[i]); this.lvl[i] = -1;
    if (this.wz[i]) { this.st[i] = S.ZOMBIE; return; }
    this.st[i] = S.IDLE; this.panic(i, fx, fz, -1);
  }
  // let it go with a velocity: ballistic until it lands
  fling(i, vx, vy, vz) {
    if (this.st[i] !== S.EXT && !this.grab(i)) return;
    this.st[i] = S.AIR; this.tx[i] = vx; this.wt[i] = vy; this.tz[i] = vz;
  }
  airStep(i, h) {
    this.wt[i] -= G * h;
    this.x[i] += this.tx[i] * h; this.y[i] += this.wt[i] * h; this.z[i] += this.tz[i] * h;
    const w = this.waterAt ? this.waterAt(this.x[i], this.z[i]) : -99;
    const pit = this.holeAt ? this.holeAt(this.x[i], this.z[i]) : null, gnd = pit ?? this.groundY(this.x[i], this.z[i]);
    const g = Math.max(gnd, w > 0.3 ? w - 0.2 : -99);
    if (this.y[i] > g) return;
    this.y[i] = gnd;
    if (pit != null && pit < -1) { this.st[i] = S.IDLE; this.kill(i, this.tx[i], this.tz[i], 'fling'); this.y[i] = pit; this.dirty[i] = 3; return; } // to the bottom of a pit
    if (!this.walkable(this.x[i], this.z[i])) { const p = this.snapWalkable(this.x[i], this.z[i], 12); if (p) { this.x[i] = p[0]; this.z[i] = p[1]; } }
    const sp = Math.hypot(this.tx[i], this.wt[i], this.tz[i]);
    if (this.wz[i]) {
      this.st[i] = S.ZOMBIE; this.lvl[i] = -1;
      if (sp < 14 || this.r() < 0.3) { this.fx[i] = 2; this.t1[i] = 2 + this.r() * 2; this.think[i] = 0; return; } // gets back up
      this.kill(i, this.tx[i], this.tz[i], 'fling'); return;
    }
    if (w - gnd > 1.3 && this.kind[i] === KIND.CIVILIAN && this.r() < 0.9) { this.tx[i] *= 0.15; this.tz[i] *= 0.15; this.swim(i, 60 + this.r() * 60); return; } // into deep water: nearly all come up again, and keep afloat a minute or two (playtests: they drowned before a boat could get there)
    this.st[i] = S.IDLE; // so kill() treats it as the person it was
    this.kill(i, this.tx[i], this.tz[i], 'fling');
  }
  // swept off their feet: afloat for secs before they tire and go under
  swim(i, secs) {
    if (this.st[i] !== S.AIR) { this.tx[i] = (this.r() - 0.5) * 1.5; this.tz[i] = (this.r() - 0.5) * 1.5; } // thrown in: the throw carries them a little
    this.st[i] = S.SWIM; this.lvl[i] = -1; this.t1[i] = secs; this.fx[i] = 0; this.wet[i] = 0; this.target[i] = -1; this.bt[i] = -1;
  }
  // afloat at the surface, drifting, waving for help, until a boat, a helicopter or a hero gets to them, the water
  // drops enough to stand, or they tire and go under. On a life raft (fx 1) they hold on where it floats
  swimStep(i, h) {
    const w = this.waterAt ? this.waterAt(this.x[i], this.z[i]) : -99, g = this.groundY(this.x[i], this.z[i]);
    if (w - g < 0.9) { this.st[i] = S.IDLE; this.y[i] = g; this.fx[i] = 0; return; } // back on their feet
    if (this.fx[i] !== 1 && (this.t1[i] -= h) <= 0) { this.kill(i, 0, 0, 'drown'); this.stats.drowned++; return; }
    if (this.fx[i] === 1) { if ((this.t1[i] -= h) <= 0) { this.fx[i] = 0; this.t1[i] = 20; } } // the raft has drifted off or gone down
    else if (this.fx[i] === 4) { // swimming over to a life raft
      const dx = this.px[i] - this.x[i], dz = this.pz[i] - this.z[i], d = Math.hypot(dx, dz);
      if (d < 0.4) { this.fx[i] = 1; this.t1[i] = 120; this.face(i, this.px[i] - dx * 3, this.pz[i] - dz * 3); } else { const s = Math.min(d, 1.6 * h); this.x[i] += dx / d * s; this.z[i] += dz / d * s; this.hx[i] = dx / d; this.hz[i] = dz / d; }
    } else {
      this.tx[i] += ((this.r() - 0.5) * 1.6 - this.tx[i] * 0.5) * h; this.tz[i] += ((this.r() - 0.5) * 1.6 - this.tz[i] * 0.5) * h;
      const nx = this.x[i] + this.tx[i] * h, nz = this.z[i] + this.tz[i] * h;
      if (this.walkable(nx, nz)) { this.x[i] = nx; this.z[i] = nz; } else { this.tx[i] *= -0.5; this.tz[i] *= -0.5; } // off the walls
      if (this.r() < h * 0.3) { const a = this.r() * 6.28; this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a); }
    }
    this.y[i] = w - 1.3 + Math.sin(this.time * 2.2 + i) * 0.07;
  }
  // everyone afloat, bunched by area: the n busiest spots [x, z, count], most first
  swimSpots(n = 6, cell = 70) {
    const m = new Map();
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== S.SWIM) continue;
      const key = Math.floor(this.x[i] / cell) * 4096 + Math.floor(this.z[i] / cell), e = m.get(key);
      if (e) { e[0] += this.x[i]; e[1] += this.z[i]; e[2]++; } else m.set(key, [this.x[i], this.z[i], 1]);
    }
    return [...m.values()].map(e => [e[0] / e[2], e[1] / e[2], e[2]]).sort((a, b) => b[2] - a[2]).slice(0, n);
  }
  // the one afloat nearest (x, z) within R, or -1
  // the swimmer to go for: the nearest of those closest to going under (on a raft they can wait)
  nearestSwimmer(x, z, R) { let best = -1, bs = 1e9; this.around(x, z, R, (j, d2) => { if (this.st[j] !== S.SWIM) return; const s = Math.sqrt(d2) + (this.fx[j] === 1 ? 150 : this.t1[j]) * 1.2; if (s < bs) { bs = s; best = j; } }); return best; }
  // pulled out of the water and set down on the roof of building k (by a hero): they join whoever is up there
  toRoof(i, k) {
    const b = this.bld[k], sp = this.roofSpot(k), q = this.roofSpot(k);
    this.st[i] = S.ROOF; this.lvl[i] = k; this.bHad[k] = 1; this.x[i] = sp[0]; this.z[i] = sp[1]; this.y[i] = b.roofY;
    this.tx[i] = q[0]; this.tz[i] = q[1]; this.t1[i] = 0; this.think[i] = this.r(); this.watch[i] = 0; this.fx[i] = 0; this.inf[i] = 0;
  }
  // everyone up on, inside or piled against building k when it comes down
  clearBuilding(k, how = 'crush') {
    const b = this.bld[k];
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      const onIt = (s === S.ROOF && this.lvl[i] === k) || ((s === S.ZOMBIE || s === S.GRABBED || s === S.TURNING) && this.lvl[i] === k) || (s === S.INSIDE && this.bt[i] === k) || ((s === S.PILE || s === S.CLIMB) && this.bt[i] === k);
      if (!onIt) continue;
      if (how === 'tear') { if (this.grab(i)) this.lifted.push(i); continue; }
      const wasZ = ZSTATE[s] || (s === S.ZOMBIE);
      this.lvl[i] = -1;
      this.x[i] = b.x0 + this.r() * (b.x1 - b.x0); this.z[i] = b.z0 + this.r() * (b.z1 - b.z0);
      const p = this.snapWalkable(this.x[i], this.z[i], 15); if (p) { this.x[i] = p[0]; this.z[i] = p[1]; }
      if (how === 'spare') { if (wasZ) { this.st[i] = S.ZOMBIE; this.wz[i] = 1; } else { this.st[i] = S.IDLE; this.panic(i, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, -1); } continue; }
      if (wasZ) { this.st[i] = S.ZOMBIE; this.wz[i] = 1; if (this.r() < 0.7) this.kill(i, 0, 0, 'crush'); else { this.fx[i] = 2; this.t1[i] = 3; } }
      else { this.st[i] = S.IDLE; this.kill(i, 0, 0, 'crush'); }
    }
    this.bIn[k] = 0; this.bPile[k] = 0; this.bBreach[k] = 0; this.bBarr[k] = 0; this.bCap[k] = 0; this.bEmpty[k] = 0;
  }
  // everyone at ground level near (x,z) is crushed (falling building, wave)
  crushNear(x, z, R, civiliansToo = true) {
    let n = 0;
    this.around(x, z, R, (j) => {
      if (!HITTABLE[this.st[j]]) return;
      if (!civiliansToo && !HOSTILE[this.st[j]]) return;
      this.wz[j] = ZSTATE[this.st[j]] ? 1 : 0;
      this.kill(j, 0, 0, 'crush'); n++;
    });
    return n;
  }
  // police on the spot before a flood: everyone on the street near (x, z) heads up onto the rooftops. How many went
  alarmAt(x, z, R) {
    let n = 0;
    this.around(x, z, R, (i) => { const s = this.st[i]; if (this.kind[i] === KIND.CIVILIAN && !this.inf[i] && (s === S.WALK || s === S.IDLE || s === S.RETURN || s === S.GO || s === S.FLEE || s === S.FILM) && this.r() < 0.4 + this.lives.trust * 0.6 && this.trySeek(i)) n++; }); // how many do as the police say: the city's trust
    return n;
  }
  // tsunami and flood sirens: civilians head for the rooftops
  alarm(secs = 30) {
    this.alarmT = secs;
    for (let i = 0; i < this.nHuman; i++) {
      const s = this.st[i];
      if (this.kind[i] !== KIND.CIVILIAN || this.inf[i]) continue;
      if ((s === S.WALK || s === S.IDLE || s === S.RETURN || s === S.GO || s === S.FLEE) && this.r() < 0.8) this.trySeek(i) || this.panic(i, this.x[i] + 1, this.z[i], -1);
    }
  }
  // ---------- cold: frozen solid where they stood. Civilians die after a while; zombies thaw when the cold passes
  freeze(i) {
    const s = this.st[i];
    if (!HITTABLE[s] || this.lvl[i] !== -1 || this.kind[i] === KIND.ALIEN) return false;
    this.wz[i] = ZSTATE[s] || s === S.ZOMBIE ? 1 : 0;
    if (s === S.GRABBED || s === S.TURNING) this.wz[i] = 0;
    this.st[i] = S.FROZEN; this.t1[i] = 0; this.target[i] = -1; this.fx[i] = 0; this.bt[i] = -1;
    this.events.push({ type: 'frozen', i, x: this.x[i], z: this.z[i] });
    return true;
  }
  frozenStep(i, h) {
    if (this.fx[i] >= 7) return; // stuck in a web (7), dead in the ice (9) or an ash statue (8): nothing happens until they are let go
    this.t1[i] += h;
    if (!this.wz[i] && this.t1[i] > 18) { this.fx[i] = 9; if (this.kind[i] === KIND.CIVILIAN) this.stats.disasterCiv++; this.events.push({ type: 'frozedead', i }); } // frozen to death, still standing
  }
  frozenLook(i) {
    const A = this.fa.arrays, o = i * 3, ice = this.fx[i] === 7 ? [0.9, 0.89, 0.85] : [0.62, 0.74, 0.86]; // a web wraps them in white silk
    for (const key of ['shirt', 'pants', 'skin', 'accent', 'accent2']) for (let c = 0; c < 3; c++) A[key][o + c] = A[key][o + c] * 0.3 + ice[c] * 0.7;
    A.kit[i * 4 + 1] = (A.kit[i * 4 + 1] | 0) & ~FLAG.GLOW;
    this.lookDirty = true; this.dirty[i] = 4;
  }
  thawAll() {
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== S.FROZEN || this.fx[i] === 8) continue;
      if (this.fx[i] === 9) { this.setLook(i, this.base[i]); this.st[i] = S.IDLE; this.fx[i] = 0; this.kill(i, 0, 0, 'thaw'); continue; } // the ice lets go and the body falls
      if (this.wz[i]) { this.st[i] = S.ZOMBIE; this.t1[i] = 0; } else { this.st[i] = S.IDLE; this.setLook(i, this.base[i]); this.dirty[i] = 0; }
    }
  }
  // a work crew (construction, hazmat, medics): they mill about within R of (x, z) until dismiss(id)
  spawnCrew(x, z, n, look, id, R = 8) {
    let made = 0;
    for (let k = 0; k < n && this.active < this.N; k++) {
      const a = this.r() * Math.PI * 2, p = this.snapWalkable(x + Math.cos(a) * 3, z + Math.sin(a) * 3, 14); if (!p) continue;
      const i = this.active++;
      this.kind[i] = KIND.FIREFIGHTER; this.st[i] = S.IDLE; this.inf[i] = 0; this.zrad[i] = 0; this.wz[i] = 0; this.hp[i] = 1;
      this.x[i] = p[0]; this.z[i] = p[1]; this.y[i] = this.groundY(p[0], p[1]); this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a);
      this.base[i] = look(this.r); this.setLook(i, this.base[i]); this.dirty[i] = 0;
      this.hold(i, x, z, R, 0, id); made++;
    }
    return made;
  }
  dismiss(id) { for (let i = 0; i < this.active; i++) if (this.st[i] === S.HELD && this.bt[i] === id) { this.st[i] = S.EVAC; this.lvl[i] = -1; } } // back in the truck
  // held somewhere: fx 0 at a medical camp (milling about inside it), fx 1 in police custody (waiting, hands cuffed, for the bus)
  hold(i, x, z, R, fx, id) {
    const s = this.st[i];
    if ((s === S.PILE || s === S.CLIMB) && this.bt[i] >= 0) this.bPile[this.bt[i]] = Math.max(0, this.bPile[this.bt[i]] - 1);
    this.st[i] = S.HELD; this.tx[i] = x; this.tz[i] = z; this.wt[i] = R; this.fx[i] = fx; this.bt[i] = id; this.t1[i] = 0; this.inc[i] = this.r() * 3; this.target[i] = -1; this.lvl[i] = -1;
    if (this.inf[i]) { this.inf[i] = 0; this.zrad[i] = 0; this.stats.treated++; this.setLook(i, this.base[i]); this.dirty[i] = 0; } // the medics treat the bite before it takes hold
  }
  heldStep(i, h) {
    const dx = this.tx[i] - this.x[i], dz = this.tz[i] - this.z[i], d = Math.hypot(dx, dz), R = this.wt[i];
    if (d > R) { // on the way there (running when it is far)
      const v = d > R + 8 ? 3 : 1.4; this.hx[i] = dx / d; this.hz[i] = dz / d; this.t1[i] = d > R + 8 ? 9 : 1;
      if (!this.move(i, dx / d, dz / d, v * h)) { this.x[i] += dx / d * v * h; this.z[i] += dz / d * v * h; }
      return;
    }
    if (this.fx[i] === 1) { this.t1[i] = 0; return; }
    if (this.t1[i] > 0) { this.t1[i] = Math.min(this.t1[i], 2) - h; this.move(i, this.hx[i], this.hz[i], 0.9 * h); } // a slow stroll round the camp
    else if ((this.inc[i] -= h) <= 0) { this.inc[i] = 3 + this.r() * 6; const a = this.r() * 6.28; this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a); this.t1[i] = 0.8 + this.r() * 1.4; }
  }
  // everyone held by camp or custody group id goes back to their day
  releaseHeld(id) {
    let n = 0;
    for (let i = 0; i < this.active; i++) if (this.st[i] === S.HELD && this.bt[i] === id) { this.st[i] = S.IDLE; this.bt[i] = -1; this.fx[i] = 0; this.inc[i] = 0; this.t1[i] = 0; this.startReturn(i); n++; }
    return n;
  }
  heldBy(id) { let n = 0; for (let i = 0; i < this.active; i++) if (this.st[i] === S.HELD && this.bt[i] === id) n++; return n; }
  // a medical camp at (x, z): up to n civilians within R come and stay inside radius campR (anyone bitten not long ago is treated)
  callToCamp(x, z, R, n, id, campR) {
    const c = [];
    this.around(x, z, R, (j, d2) => {
      const s = this.st[j];
      if (this.kind[j] !== KIND.CIVILIAN || (s !== S.WALK && s !== S.IDLE && s !== S.FLEE && s !== S.RETURN && s !== S.GO && s !== S.FILM)) return;
      if (this.inf[j] && this.inc[j] < this.inc0[j] * 0.5) return; // too far gone to help
      c.push([d2, j]);
    });
    c.sort((a, b) => a[0] - b[0]);
    let k = 0; for (const [, j] of c) { if (k >= n) break; this.hold(j, x, z, campR, 0, id); k++; }
    return k;
  }
  // the police bus is here: everyone in custody group id walks to its door
  custodyToBus(id, x, z, busId) {
    let n = 0; const D = this.busDoor(busId); if (D) { x = D.d[0]; z = D.d[1]; }
    for (let i = 0; i < this.active; i++) if (this.st[i] === S.HELD && this.bt[i] === id) { this.st[i] = S.BOARD; this.tx[i] = x; this.tz[i] = z; this.bt[i] = busId; this.t1[i] = 40; this.inc[i] = 0; this.fx[i] = 1; this.wt[i] = 2.6; this.watch[i] = 0; n++; }
    return n;
  }
  // caught in a super villain's web: stuck where they stand until the web lets go
  web(i) {
    const s = this.st[i];
    if (!HITTABLE[s] || s === S.FROZEN || this.lvl[i] !== -1 || this.kind[i] === KIND.ALIEN) return false;
    this.wz[i] = ZSTATE[s] || s === S.ZOMBIE ? 1 : 0;
    if (s === S.GRABBED || s === S.TURNING) this.wz[i] = 0;
    this.st[i] = S.FROZEN; this.t1[i] = 0; this.target[i] = -1; this.fx[i] = 7; this.bt[i] = -1; this.dirty[i] = 0;
    return true;
  }
  unweb(i) {
    if (this.st[i] !== S.FROZEN || this.fx[i] !== 7) return;
    this.fx[i] = 0; this.t1[i] = 0; this.dirty[i] = 0;
    if (this.wz[i]) this.st[i] = S.ZOMBIE; else { this.st[i] = S.IDLE; this.setLook(i, this.base[i]); }
  }
  // swallowed by the ground (a sinkhole, a crater): gone for good
  fallIn(j) {
    const s = this.st[j];
    if (s === S.DEAD || s === S.EVAC || s === S.INSIDE || this.lvl[j] !== -1) return;
    const z = ZSTATE[s] || s === S.ZOMBIE || ((s === S.EXT || s === S.AIR || s === S.FROZEN) && this.wz[j]);
    if (this.kind[j] === KIND.ALIEN) this.stats.aliensKilled++;
    else if (z) this.stats.disasterZ++; else if (this.kind[j] === KIND.CIVILIAN) this.stats.disasterCiv++;
    this.st[j] = S.DEAD; this.inf[j] = 0; this.y[j] = -25; this.dirty[j] = 3;
  }

  // ---------- riots
  startRiot(x, z, n, mob) {
    const c = [];
    this.buildHash();
    this.around(x, z, 45, (j, d2) => { const s = this.st[j]; if (this.kind[j] === KIND.CIVILIAN && !this.inf[j] && (s === S.WALK || s === S.IDLE || s === S.RETURN || s === S.GO)) c.push([d2, j]); });
    c.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [, j] of c) {
      if (out.length >= n) break;
      this.st[j] = S.RIOT; this.bt[j] = mob.id; this.t1[j] = 0;
      const a = this.r() * Math.PI * 2, rr = 2 + Math.sqrt(this.r()) * 9; this.tx[j] = Math.cos(a) * rr; this.tz[j] = Math.sin(a) * rr;
      this.base[j] = { ...this.base[j], hat: HAT.BEANIE, accent: new THREE.Color('#1a1a1c') }; this.setLook(j, this.base[j]);
      out.push(j);
    }
    return out;
  }
  riotStep(i, h) {
    const mob = this.mobs[this.bt[i]];
    if (!mob || !mob.alive) { this.st[i] = S.IDLE; this.bt[i] = -1; this.startReturn(i); return; }
    if (this.t1[i] > 0) { this.t1[i] -= h; return; } // an officer has hold of them
    const jx = Math.sin(this.time * 1.7 + i) * 1.5, jz = Math.cos(this.time * 1.3 + i * 0.7) * 1.5;
    const tx = mob.x + this.tx[i] + jx, tz = mob.z + this.tz[i] + jz;
    const dx = tx - this.x[i], dz = tz - this.z[i], d = Math.hypot(dx, dz);
    if (d > 0.4) {
      this.hx[i] = dx / d; this.hz[i] = dz / d;
      if (!this.move(i, dx / d, dz / d, Math.min(d, (d > 6 ? 2.6 : 1.3) * h)) && this.randomCardinal(i, 1.5)) this.move(i, this.hx[i], this.hz[i], 1.2 * h);
    } else { this.hx[i] = mob.x - this.x[i]; this.hz[i] = mob.z - this.z[i]; }
  }
  arrest(j) {
    if (this.st[j] !== S.RIOT) return;
    this.stats.arrests++;
    let g = this.custody.find(c => !c.bus && Math.hypot(c.x - this.x[j], c.z - this.z[j]) < 45);
    if (!g) { g = { id: 1000 + this.custodyN++, x: this.x[j], z: this.z[j], n: 0, t: this.time, bus: null }; this.custody.push(g); }
    this.hold(j, g.x, g.z, 2.2, 1, g.id); g.n++;
    this.events.push({ type: 'arrest', j, x: this.x[j], z: this.z[j] });
  }
  // tear gas: rioters near (x,z) give up
  gas(x, z, R = 9) {
    this.around(x, z, R, (j) => { if (this.st[j] === S.RIOT) { this.st[j] = S.IDLE; this.bt[j] = -1; this.panic(j, x, z, -1); this.stats.arrests++; } });
  }
  // ---------- aliens
  spawnAliens(x, z, n) {
    const out = [];
    for (let k = 0; k < n && this.active < this.N; k++) {
      const a = this.r() * Math.PI * 2;
      const p = this.snapWalkable(x + Math.cos(a) * 3, z + Math.sin(a) * 3, 15); if (!p) continue;
      const i = this.active++;
      this.st[i] = S.ALIEN; this.kind[i] = KIND.ALIEN; this.lvl[i] = -1; this.inf[i] = 0; this.fx[i] = 0; this.wz[i] = 0;
      this.x[i] = p[0]; this.z[i] = p[1]; this.y[i] = this.groundY(p[0], p[1]);
      this.target[i] = -1; this.think[i] = this.r() * 0.3; this.wt[i] = 0.5 + this.r(); this.bt[i] = -1; this.inc[i] = 0; this.hp[i] = 2;
      this.hx[i] = Math.cos(a); this.hz[i] = Math.sin(a);
      this.base[i] = ALIEN_LOOK(this.r); this.setLook(i, this.base[i]); this.dirty[i] = 0;
      out.push(i);
    }
    return out;
  }
  alienStep(i, h) {
    const x = this.x[i], z = this.z[i];
    if ((this.think[i] -= h) <= 0) {
      this.think[i] = 0.35;
      let best = 34 * 34, bi = -1;
      this.around(x, z, 34, (j, d2) => {
        const s = this.st[j];
        if (!(CIV[s] || s === S.ZOMBIE || s === S.GRABBED || s === S.TURNING) || s === S.ROOF) return;
        const w = (s === S.COP) ? d2 * 0.4 : d2; // armed humans first
        if (w < best) { best = w; bi = j; }
      });
      this.target[i] = bi;
    }
    const tg = this.target[i];
    if (tg >= 0 && this.st[tg] !== S.DEAD && this.st[tg] !== S.EXT && this.st[tg] !== S.AIR && this.lvl[tg] === -1) {
      const dx = this.x[tg] - x, dz = this.z[tg] - z, d = Math.hypot(dx, dz) || 0.001;
      this.hx[i] = dx / d; this.hz[i] = dz / d;
      if (d > 11) { if (!this.move(i, dx / d, dz / d, 2.2 * h)) this.randomCardinal(i, 1.5); this.fx[i] = 1; } else this.fx[i] = 2;
      this.wt[i] -= h;
      if (this.wt[i] <= 0 && d < 20) {
        this.wt[i] = 0.9 + this.r() * 0.4;
        if (this.flashList.length < this.flashMax) this.flashList.push({ x: x + this.hx[i] * 0.6, y: this.y[i] + 1.2, z: z + this.hz[i] * 0.6, t: 0.12 });
        this.events.push({ type: 'zap', x, z, tx: this.x[tg], tz: this.z[tg] });
        if (this.r() < 0.72) { this.wz[tg] = ZSTATE[this.st[tg]] ? 1 : 0; if (this.st[tg] === S.GRABBED || this.st[tg] === S.TURNING) this.st[tg] = S.IDLE; this.kill(tg, 0, 0, 'zap'); }
      }
      return;
    }
    this.fx[i] = 1; this.wt[i] -= h;
    if (this.inc[i] <= 0 || !this.move(i, this.hx[i], this.hz[i], 1.6 * h)) { this.randomCardinal(i, 3); this.inc[i] = 3 + this.r() * 4; }
    this.inc[i] -= h;
  }

  shoot(i, j, d = 10) {
    const x = this.x[i], z = this.z[i];
    this.events.push({ type: 'shot', x, z, tx: this.x[j], tz: this.z[j] });
    if (this.flashList.length < this.flashMax) this.flashList.push({ x: x + this.hx[i] * 0.6, y: this.y[i] + 1.3, z: z + this.hz[i] * 0.6, t: 0.08 });
    const hit = Math.min(0.95, 1.05 - 0.025 * d) + (this.ztype(j).hitMod || 0);
    if (this.r() < hit) this.kill(j, (this.x[j] - x) * 0.5, (this.z[j] - z) * 0.5, 'shot');
    // the noise draws idle zombies toward the shooter (rifles carry further)
    this.around(x, z, this.kind[i] === KIND.SOLDIER ? 45 : 25, (k) => {
      if (this.st[k] !== S.ZOMBIE || this.target[k] >= 0 || this.bt[k] >= 0 || this.r() > 0.5) return;
      const dx = x - this.x[k], dz = z - this.z[k], dd = Math.hypot(dx, dz) || 1;
      this.hx[k] = dx / dd; this.hz[k] = dz / dd; this.wt[k] = 4; this.fx[k] = 3;
    });
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
      let best = Z.sight * Z.sight, bi = tg, civNear = 0;
      const n2 = Z.notice * Z.notice;
      this.around(zx, zz, Z.sight, (j, d2) => {
        if (!CIV[this.st[j]]) return;
        civNear++;
        if (d2 < n2 && this.st[j] !== S.FLEE && this.r() < Z.noticeP) this.panic(j, zx, zz, i);
        if (tg < 0 && d2 < best && !this.inf[j] && CIV[this.st[j]]) { best = d2; bi = j; }
      });
      this.target[i] = bi;
      if (bi < 0 && this.stats.zombies <= 3 && this.cops && this.cops.length) { // one of the last few: drawn to the nearest police (officers can't find their way round blocks to them)
        let cd = 1e12, cj = -1; for (const c of this.cops) { const d2 = (this.x[c] - zx) ** 2 + (this.z[c] - zz) ** 2; if (d2 < cd) { cd = d2; cj = c; } }
        if (cj >= 0) { const dd = Math.sqrt(cd) || 1; this.hx[i] = (this.x[cj] - zx) / dd; this.hz[i] = (this.z[cj] - zz) / dd; this.wt[i] = 4; this.fx[i] = 3; this.bt[i] = -1; }
      }
      if (Z.scream && civNear > 0) { this.inc[i] -= 0.4; if (this.inc[i] <= 0) { this.scream(i); return; } }
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
    const alerted = this.fx[i] === 3;
    if (!alerted && this.hord[i] >= 0 && this.hordeStep(i, h, Z)) return; // with the horde
    this.wt[i] -= h;
    if (this.wt[i] <= 0 || !this.move(i, this.hx[i], this.hz[i], (alerted ? Z.chase : Z.wander) * h)) {
      this.randomCardinal(i, 3);
      this.wt[i] = 3 + this.r() * 6; this.fx[i] = 0;
    }
  }

  // ---------- hordes: zombies band together and move as one, like a mob. Noise draws them - a car tearing past (they go
  // after it until it is gone, or something new turns their heads), people - and they close on people from every side,
  // a ring tightening round them. Once a zombie sees someone close it is every zombie for itself (zombieStep)
  hordeTick() {
    const H = this.hordes, Z = S.ZOMBIE;
    for (const g of H.values()) { g.sx = 0; g.sz = 0; g.n = 0; }
    for (let i = 0; i < this.active; i++) {
      const id = this.hord[i]; if (id < 0) continue;
      const g = H.get(id);
      if (!g || this.st[i] !== Z || this.lvl[i] !== -1 || (this.x[i] - g.x) ** 2 + (this.z[i] - g.z) ** 2 > 90 * 90) { this.hord[i] = -1; continue; }
      g.sx += this.x[i]; g.sz += this.z[i]; g.n++;
    }
    for (const [id, g] of H) { if (g.n < 3) { H.delete(id); continue; } g.x = g.sx / g.n; g.z = g.sz / g.n; }
    // stragglers fall in with a horde nearby, or band together into a new one
    for (let i = 0; i < this.active; i++) {
      if (this.st[i] !== Z || this.hord[i] >= 0 || this.lvl[i] !== -1) continue;
      let best = -1, bd = 45 * 45;
      for (const [id, g] of H) { const d2 = (g.x - this.x[i]) ** 2 + (g.z - this.z[i]) ** 2; if (d2 < bd) { bd = d2; best = id; } }
      if (best >= 0) { this.hord[i] = best; H.get(best).n++; continue; }
      let m = 0; this.around(this.x[i], this.z[i], 22, (j) => { if (this.st[j] === Z && this.hord[j] < 0) m++; });
      if (m < 4) continue;
      const id = this.hordeN++, g = { x: this.x[i], z: this.z[i], n: 0, gx: this.x[i], gz: this.z[i], focus: null, ft: 0, wa: this.r() * 6.28, waT: 0 };
      H.set(id, g); this.around(this.x[i], this.z[i], 22, (j) => { if (this.st[j] === Z && this.hord[j] < 0) { this.hord[j] = id; g.n++; } });
    }
    for (const g of H.values()) this.hordeAim(g);
  }
  // what a horde goes for: what has its attention now, unless something louder or nearer comes along
  hordeAim(g) {
    const loud = (c) => (c.panic > 0 || c.burning ? 0.1 : 0.025) * Math.abs(c.v || 0) / Math.max(15, Math.hypot(c.x - g.x, c.z - g.z)); // a car: the faster and nearer, the louder; one fleeing in a panic most of all
    const crowd = (x, z, R) => { let n = 0, sx = 0, sz = 0; this.around(x, z, R, (j) => { if (CIV[this.st[j]] && !this.inf[j]) { n++; sx += this.x[j]; sz += this.z[j]; } }); return n ? [sx / n, sz / n, n] : null; };
    const f = g.focus; let cur = 0;
    g.ft++;
    if (f && f.car) { const c = f.car; if (!c.gone && c.mode !== 4 && c.mode !== 5 && Math.hypot(c.x - g.x, c.z - g.z) < 180) { cur = Math.max(loud(c), g.ft < 6 ? 0.05 : 0); g.gx = c.x + (c.hx || 0) * Math.abs(c.v || 0) * 1.2; g.gz = c.z + (c.hz || 0) * Math.abs(c.v || 0) * 1.2; } } // after it, where it is going
    else if (f && f.ppl) { const q = crowd(f.x, f.z, 30); if (q && g.ft < 40) { f.x = g.gx = q[0]; f.z = g.gz = q[1]; cur = Math.min(q[2], 20) * 0.1 / Math.max(15, Math.hypot(q[0] - g.x, q[1] - g.z)); } }
    // something new: a car tearing past, or people within reach
    let nf = null, ns = 0;
    if (this.traffic) this.traffic.near(g.x, g.z, 120, (c) => { if (c.gone || c.mode === 4 || c.mode === 5 || Math.abs(c.v || 0) < 5) return; const s = loud(c); if (s > ns) { ns = s; nf = { car: c }; } });
    const q = crowd(g.x, g.z, 60); if (q && q[2] >= 2) { const s = Math.min(q[2], 20) * 0.1 / Math.max(15, Math.hypot(q[0] - g.x, q[1] - g.z)); if (s > ns) { ns = s; nf = { ppl: true, x: q[0], z: q[1] }; } }
    if (nf && ns > cur * 1.5 && (!f || nf.car !== f.car)) { g.focus = nf; g.ft = 0; if (nf.car) { g.gx = nf.car.x; g.gz = nf.car.z; } else { g.gx = nf.x; g.gz = nf.z; } return; }
    if (cur > 0) return;
    // nothing: the horde drifts down the streets together, turning now and then
    g.focus = null;
    if ((g.waT -= 1) <= 0 || Math.hypot(g.gx - g.x, g.gz - g.z) < 8) {
      g.waT = 8 + this.r() * 8; g.wa += (this.r() - 0.5) * 2;
      const p = this.snapWalkable(g.x + Math.cos(g.wa) * 45, g.z + Math.sin(g.wa) * 45, 25); if (p) { g.gx = p[0]; g.gz = p[1]; } else g.wa += Math.PI;
    }
  }
  // a horde member: its own place in the mass round the horde's goal (a ring round people, so they are hemmed in)
  hordeStep(i, h, Z) {
    const g = this.hordes.get(this.hord[i]); if (!g) { this.hord[i] = -1; return false; }
    const a = i * 2.39996, ring = g.focus && g.focus.ppl;
    const r = ring ? Math.max(1, 13 - 1.6 * g.ft) + (i % 5) * 0.8 : Math.min(15, 1.3 * Math.sqrt(g.n)) * (0.3 + 0.7 * ((i * 0.618) % 1)); // the ring closes in
    const tx = g.gx + Math.cos(a) * r + Math.sin(this.time * 0.9 + i) * 1.2, tz = g.gz + Math.sin(a) * r + Math.cos(this.time * 0.7 + i) * 1.2;
    const dx = tx - this.x[i], dz = tz - this.z[i], d = Math.hypot(dx, dz);
    this.fx[i] = 0;
    if (d < 0.8) return true; // in its place: swaying
    const sp = (g.focus ? Z.chase * (g.focus.car ? 1 : 0.8) : Z.wander) * (d > 25 ? 1.2 : 1);
    if (this.wt[i] > 0) { this.wt[i] -= h; if (this.move(i, this.hx[i], this.hz[i], sp * h)) return true; } // round a corner
    this.hx[i] = dx / d; this.hz[i] = dz / d;
    if (!this.move(i, dx / d, dz / d, Math.min(d, sp * h)) && this.randomCardinal(i, 1.5)) this.wt[i] = 1.2;
    return true;
  }

  // zombies within R that are not after anyone shamble towards (x, z) (Be The Disaster: the horde follows your finger)
  lure(x, z, R) {
    this.around(x, z, R, (k) => {
      if (this.st[k] !== S.ZOMBIE || this.target[k] >= 0 || this.bt[k] >= 0) return;
      const dx = x - this.x[k], dz = z - this.z[k], dd = Math.hypot(dx, dz) || 1;
      this.hx[k] = dx / dd; this.hz[k] = dz / dd; this.wt[k] = 3; this.fx[k] = 3;
    });
  }

  // the screamer: everyone nearby scatters, every zombie nearby comes running
  scream(i) {
    const x = this.x[i], z = this.z[i];
    this.inc[i] = 8 + this.r() * 5;
    this.around(x, z, 28, (j) => { if (CIV[this.st[j]]) this.panic(j, x, z, i); });
    this.around(x, z, 45, (k) => {
      if (k === i || this.st[k] !== S.ZOMBIE || this.target[k] >= 0 || this.bt[k] >= 0) return;
      const dx = x - this.x[k], dz = z - this.z[k], dd = Math.hypot(dx, dz) || 1;
      this.hx[k] = dx / dd; this.hz[k] = dz / dd; this.wt[k] = 6; this.fx[k] = 3;
    });
    this.t1[i] = 1.2; // stands and howls
    this.events.push({ type: 'scream', i, x, z });
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
    this.events.push({ type: 'bite', i, j, x: bx, z: bz, officer: this.kind[j] === KIND.OFFICER });
  }

  buildingTick(dt) {
    const small = this.smallPiles || (this.smallPiles = []); small.length = 0; // piles of one to three: officers nearby knock them down (copStep)
    for (let k = 0; k < this.bld.length; k++) {
      if (this.bPile[k] === 0 && !this.bBreach[k]) continue;
      if (this.bPile[k] <= 3 && !this.bBreach[k]) small.push(k);
      const lone = this.bPile[k] <= 2 && this.bRoof[k] === 0 && !this.bBreach[k]; // one or two scratching at a door with people indoors: they give up in a while (else nobody can shoot them)
      if ((this.bRoof[k] === 0 && this.bIn[k] === 0) || lone) {
        this.bEmpty[k] += dt;
        if (this.bEmpty[k] >= (this.bIn[k] ? 20 : 3)) this.collapse(k, this.bIn[k] > 0);
      } else this.bEmpty[k] = 0;
    }
  }

  // shot at from the street: one of a small pile drops back down to face the officer
  unpile(j) { const k = this.bt[j]; if (k >= 0 && this.bPile[k] > 0) this.bPile[k]--; this.st[j] = S.ZOMBIE; this.lvl[j] = -1; this.bt[j] = -1; this.y[j] = this.groundY(this.x[j], this.z[j]); this.target[j] = -1; }
  // survivors gone: the pile spills back into the street
  collapse(k, gaveUp = false) { // gaveUp: a small pile that came to nothing (no overrun)
    for (let i = 0; i < this.active; i++) {
      if ((this.st[i] === S.PILE || this.st[i] === S.CLIMB) && this.bt[i] === k) {
        this.startFall(i, this.x[i], this.z[i], this.y[i], false);
      }
    }
    this.bPile[k] = 0; this.bBreach[k] = 0; this.bEmpty[k] = 0; this.bBarr[k] = 0;
    if (!gaveUp && this.bHad[k] && !this.bOver[k]) { this.bOver[k] = 1; if (this.onOverrun) this.onOverrun(k, 'collapse'); }
  }

  // ---------- render sync
  sync() {
    const arr = this.mesh.instanceMatrix.array, anim = this.anim;
    const m = this._m4, q = this._q, e = this._e, p = this._p;
    const cops = []; // officers at work (the last few zombies are drawn to them)
    let humans = 0, infected = 0, zombies = 0, dead = 0, roof = 0, officers = 0, aliens = 0, rioters = 0, colDirty = this.lookDirty, film = 0, afloat = 0;
    this.bRoof.fill(0); this.bRoofAll.fill(0);
    const t = this.time;
    for (let i = 0; i < this.active; i++) {
      const s = this.st[i];
      const o = i * 16;
      let an = ANIM[s];
      if (s === S.GO && (this.fx[i] === 8 || this.fx[i] === 7)) an = 0; // standing about at a park or a square, waiting at the kerb
      if (s === S.INSIDE || s === S.EVAC) { arr.fill(0, o, o + 16); if (s === S.INSIDE) { if (this.inf[i]) infected++; else if (this.kind[i] === KIND.CIVILIAN) humans++; } continue; } // sheltering indoors still counts as alive
      if (s === S.ALIEN) aliens++;
      let tilt = 0, y = this.y[i];
      if (s === S.ZOMBIE) {
        const Z = ZTYPES[this.zt[i]];
        if (this.fx[i] === 2) { tilt = this.t1[i] > 0.6 ? Math.PI / 2 : Math.PI / 2 * this.t1[i] / 0.6; an = 4; }
        else { tilt = Z.tilt + (Z.anim === 3 ? Math.sin(t * 5 + i) * 0.06 : 0); an = Z.anim; if (Z.anim === 8) y += 0.05; }
      }
      else if (s === S.TURNING) tilt = Math.sin(t * 14 + i) * 0.35;
      else if (s === S.GRABBED) tilt = 0.25;
      else if (s === S.PILE) tilt = -0.95 + Math.sin(t * 6 + i * 1.7) * 0.25;
      else if (s === S.CLIMB) tilt = -1.1;
      else if (s === S.JUMP) tilt = Math.sin(t * 9 + i) * 1.2;
      else if (s === S.EXT && this.fx[i] === 3) an = 12; // on a rescue rope, holding on with both hands
      else if (s === S.EXT || s === S.AIR) tilt = t * (5 + (i % 5)) + i;
      else if (s === S.DEAD) { tilt = Math.PI / 2; y += 0.17; }
      else if (s === S.ROOF) an = this.t1[i] > 0 || this.fx[i] === 2 ? 2 : this.fx[i] === 1 ? 1 : this.fx[i] === 3 ? 6 : 0;
      else if (s === S.FILM) { an = this.films(i) ? 6 : 0; film++; }
      else if (s === S.HELD) an = this.t1[i] > 0 ? (this.t1[i] > 5 ? 2 : 1) : 0;
      else if (s === S.BOARD) an = this.watch[i] === 1 ? 0 : this.watch[i] === 2 ? 1 : 2; // waiting a turn at the door, stepping in
      else if (s === S.PRAY) an = this.fx[i] ? 10 : 2;
      else if (s === S.FIGHT) an = this.fx[i] ? 11 : this.target[i] >= 0 ? 2 : 7;
      else if (s === S.COP) an = this.fx[i] === 1 ? 7 : this.fx[i] === 2 ? 6 : 0;
      else if (s === S.FIREMAN) an = this.fx[i] === 1 ? 1 : this.fx[i] === 2 ? 6 : 0;
      if (this.braceT[i] > 0 && BRACE[s]) an = 13; // curled up
      // rotation Ry(yaw) * Rz(tilt), column major
      const hx = this.hx[i], hz = this.hz[i], hl = Math.hypot(hx, hz) || 1;
      const c = hx / hl, sn = -hz / hl, ct = Math.cos(tilt), stt = Math.sin(tilt);
      arr[o] = c * ct; arr[o + 1] = stt; arr[o + 2] = -sn * ct; arr[o + 3] = 0;
      arr[o + 4] = -c * stt; arr[o + 5] = ct; arr[o + 6] = sn * stt; arr[o + 7] = 0;
      arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
      arr[o + 12] = this.x[i]; arr[o + 13] = y; arr[o + 14] = this.z[i]; arr[o + 15] = 1;
      anim[i] = an;
      if (s === S.DEAD) { dead++; continue; }
      if (s === S.ALIEN) continue;
      if ((s === S.EXT || s === S.AIR) && this.wz[i]) { zombies++; continue; }
      if (s === S.RIOT) rioters++;
      if (s === S.FROZEN) { if (this.fx[i] >= 8) dead++; else if (this.wz[i]) zombies++; else if (this.kind[i] === KIND.CIVILIAN) humans++; if (this.dirty[i] !== 4) { this.frozenLook(i); colDirty = true; } continue; }
      if (s === S.ZOMBIE || s === S.FALLING || s === S.TURNING || s === S.PILE || s === S.CLIMB) {
        zombies++;
        if (s !== S.TURNING && this.dirty[i] !== 2) { this.zombieLook(i); colDirty = true; }
        continue;
      }
      if (s === S.ROOF) { roof++; const k = this.lvl[i]; this.bRoofAll[k]++; if (!this.inf[i]) this.bRoof[k]++; }
      else if (s === S.SWIM) afloat++;
      if (s === S.COP || (this.kind[i] === KIND.OFFICER && CIV[s])) { officers++; if (s === S.COP && cops.length < 64) cops.push(i); }
      if (this.inf[i] || s === S.GRABBED) infected++; else if (this.kind[i] === KIND.CIVILIAN) humans++;
      if (this.dirty[i] === 1 && this.inf[i]) {
        const k = Math.min(1, Math.max(0, 1 - this.inc[i] / this.inc0[i]));
        const b = this.base[i];
        this._c.copy(b.skin).lerp(ZSKIN, Math.max(0, (k - 0.45) / 0.55));
        this.setLook(i, { ...b, skin: this._c }); colDirty = true; this.dirty[i] = 0;
      }
    }
    this.mesh.count = this.shadow.count = this.active;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fa.attrs.anim.needsUpdate = true;
    if (colDirty) { this.fa.dirty(); this.lookDirty = false; }
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
    // drone recon: amber rings on the infected who have not turned yet
    let mk = 0;
    if (this.markInfected) {
      const ma = this.marks.instanceMatrix.array;
      for (let i = 0; i < this.active && mk < 512; i++) {
        if (!this.inf[i] || !CIV[this.st[i]] || this.lvl[i] < -1) continue;
        const o = mk * 16; ma.fill(0, o, o + 16);
        ma[o] = 1; ma[o + 5] = 1; ma[o + 10] = 1; ma[o + 15] = 1;
        ma[o + 12] = this.x[i]; ma[o + 13] = this.y[i] + 0.08; ma[o + 14] = this.z[i];
        mk++;
      }
      this.marks.instanceMatrix.needsUpdate = true;
    }
    this.marks.count = mk;
    // phones held up to film
    let pc = 0; const pm = this._pm || (this._pm = new THREE.Matrix4()), pq = this._pq || (this._pq = new THREE.Quaternion()), pe = this._pe || (this._pe = new THREE.Euler()), pv = this._pv || (this._pv = new THREE.Vector3()), one = this._one || (this._one = new THREE.Vector3(1, 1, 1));
    for (let i = 0; i < this.active && pc < 900; i++) {
      const s = this.st[i];
      if (!((s === S.FILM && this.films(i)) || (s === S.ROOF && this.fx[i] === 3))) continue;
      pe.set(-0.2, Math.atan2(this.hx[i], this.hz[i]), 0); pq.setFromEuler(pe);
      pm.compose(pv.set(this.x[i] + this.hx[i] * 0.5, this.y[i] + 1.45, this.z[i] + this.hz[i] * 0.5), pq, one); this.phones.setMatrixAt(pc++, pm);
    }
    this.phones.count = pc; this.phones.instanceMatrix.needsUpdate = true;
    // muzzle flashes
    let fc = 0;
    for (const f of this.flashList) { m.identity(); m.setPosition(f.x, f.y, f.z); this.flashes.setMatrixAt(fc++, m); }
    this.flashes.count = fc;
    this.flashes.instanceMatrix.needsUpdate = true;
    Object.assign(this.stats, { humans, infected, zombies, dead, roof, officers, aliens, rioters, afloat }); this.filmN = film; this.cops = cops;
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
