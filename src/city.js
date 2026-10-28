// Procedural miniature city: street grid, lots, mid-rise buildings with
// shopfronts, setbacks, balconies, parapets and rooftop clutter, parks,
// plazas, street trees, lamps and crosswalks.
import * as THREE from 'three';
import { cutGround } from './holes.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';
import { townMask } from './shapes.js';

export const RW = 10;          // road width (curb to curb)
export const SW = 3;           // sidewalk width
export const HALF = RW / 2 + SW; // street corridor half width
export const CURB = 0.18;      // sidewalk height
export const LANE = 2.15;      // lane offset from road centre (a bus in it clears the cars parked at the kerb)
const GF = 4, FH = 3;          // ground floor and upper floor heights

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const toWhite = (c, k) => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];

const ROOFS = ['#d3c7b0', '#c8b99d', '#d9cbae', '#bfae92', '#cdbda3', '#8d877c', '#77726a', '#a39c8e', '#6d6a64', '#b0a898'];
// what real city blocks are built of; districts mix them differently (see wallColor)
export const MATERIALS = {
  brick: ['#a65a3e', '#9a4f37', '#b3664a', '#8e4a34', '#b97257', '#a35f44', '#c07a5c', '#8a3f2e'],
  brown: ['#7b5a45', '#86644c', '#6e5040', '#93705a'],
  stone: ['#ddd2bb', '#e4dac6', '#d2c5aa', '#e9e1cf', '#cbbd9f'],
  sand: ['#e8c79a', '#d9a978', '#d6b98e', '#c9a57a', '#e0c7a6', '#cfae84'],
  concrete: ['#b6b2a8', '#a9a59b', '#c4c0b5', '#9d9a92', '#bdb8ad'],
  white: ['#f0ebe1', '#ece5d8', '#f4efe6', '#e8e2d4'],
  dark: ['#5f5c58', '#6a6660', '#55524e', '#4b4a48'],
  pastel: ['#a8b49a', '#9fb0b8', '#d9a28a', '#d8b766', '#c7a2a6', '#b8c4a8', '#e2b98f'],
  glass: ['#7f94a2', '#8aa1aa', '#6f8290', '#93a7a5', '#6c7c86'],
};
const MIX = {
  down: { stone: 3, concrete: 3, dark: 1.6, white: 1.2, brick: 1, sand: 0.6 },
  old: { brick: 5, brown: 2.5, stone: 1.2, sand: 1, pastel: 0.4 },
  res: { white: 2.2, pastel: 2.4, sand: 2, brick: 1.4, stone: 0.8 },
  ind: { concrete: 3, brick: 3, dark: 1.6, sand: 0.8 },
  mixed: { brick: 2.2, sand: 1.6, stone: 1.6, white: 1.2, concrete: 1, pastel: 0.8, brown: 0.6, dark: 0.4 },
};
const RUST = ['#b86a3e', '#a85d36', '#c27c4b', '#9c5a3a', '#b5774f', '#a8673f'];
const GREENS = ['#6f7f3a', '#5d7034', '#7d8a45', '#56692f', '#8a9150', '#68783c', '#4f6330'];

class Bucket {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.v = 0; }
  quad(a, b, c, d, n, ua, ub, uc, ud, ca, cb) {
    const v = this.v;
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1], ud[0], ud[1]);
    this.c.push(ca[0], ca[1], ca[2], ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cb[0], cb[1], cb[2]);
    this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
    this.v += 4;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Sides: left-bottom corner, right direction (x,z) seen from outside, width.
const SIDES = [
  { n: [1, 0, 0], L: b => [b.x1, b.z1], R: [0, -1], w: b => b.z1 - b.z0, out: [1, 0] },
  { n: [-1, 0, 0], L: b => [b.x0, b.z0], R: [0, 1], w: b => b.z1 - b.z0, out: [-1, 0] },
  { n: [0, 0, 1], L: b => [b.x0, b.z1], R: [1, 0], w: b => b.x1 - b.x0, out: [0, 1] },
  { n: [0, 0, -1], L: b => [b.x1, b.z0], R: [-1, 0], w: b => b.x1 - b.x0, out: [0, -1] },
];
const ao = (y) => 0.74 + 0.26 * Math.min(1, Math.max(0, y) / 14);
const PLAIN = { su: 8, sv: 8, v0: 0, world: true };

function sides(bk, b, y0, y1, col, uv, mask = 15, aoOn = true) {
  for (let s = 0; s < 4; s++) {
    if (!(mask & (1 << s))) continue;
    const S = SIDES[s]; const [lx, lz] = S.L(b); const w = S.w(b);
    if (w <= 0.001) continue;
    const bx = lx + S.R[0] * w, bz = lz + S.R[1] * w;
    const u0 = uv.world ? (lx * S.R[0] + lz * S.R[1]) / uv.su : 0;
    const u1 = u0 + w / uv.su;
    const v0 = (y0 - uv.v0) / uv.sv, v1 = (y1 - uv.v0) / uv.sv;
    const ca = aoOn ? shade(col, ao(y0)) : col, cb = aoOn ? shade(col, ao(y1)) : col;
    bk.quad([lx, y0, lz], [bx, y0, bz], [bx, y1, bz], [lx, y1, lz], S.n, [u0, v0], [u1, v0], [u1, v1], [u0, v1], ca, cb);
  }
}
function top(bk, b, y, col, sc = 8) {
  bk.quad([b.x0, y, b.z1], [b.x1, y, b.z1], [b.x1, y, b.z0], [b.x0, y, b.z0], [0, 1, 0],
    [b.x0 / sc, -b.z1 / sc], [b.x1 / sc, -b.z1 / sc], [b.x1 / sc, -b.z0 / sc], [b.x0 / sc, -b.z0 / sc], col, col);
}
function box(bk, b, y0, y1, col, uv = PLAIN) { sides(bk, b, y0, y1, col, uv); top(bk, b, y1, toWhite(col, 0.06)); }

function crownGeometry() {
  const parts = [];
  const offs = [[0, 0, 0, 1], [0.55, 0.2, 0.25, 0.72], [-0.5, 0.25, -0.3, 0.7], [0.1, 0.55, -0.35, 0.62], [-0.25, 0.15, 0.5, 0.66], [0.35, -0.1, -0.5, 0.6]];
  for (const [x, y, z, s] of offs) { const g = new THREE.IcosahedronGeometry(s, 1); g.translate(x, y, z); parts.push(g); }
  const m = mergeGeometries(parts);
  const pos = m.attributes.position; const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = 0.45 + 0.55 * Math.min(1, Math.max(0, (pos.getY(i) + 0.7) / 1.5));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t;
  }
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}

// opts (all optional; the defaults build the big city): seed, blocks (blocks a side), maxFloors, tall (how often a
// building is 7-12 storeys), landmarks (which of spire, deco, dome, stadium), centers (downtown clusters), diag (the
// diagonal avenue), tint (extra weight for wall materials, e.g. { sand: 12 } for a desert town), shape (the town's
// outline, shapes.js: the blocks outside it are open land with the roads running on through), land (desert, forest,
// coast: what that land is like)
export function buildCity(tex, opts = {}) {
  const r = rng(opts.seed ?? 20261025);
  const NB = opts.blocks ?? 12;
  const pick = (a) => a[Math.floor(r() * a.length)];

  // ---- street grid
  const sx = [0], sz = [0];
  for (let i = 0; i < NB; i++) { sx.push(sx[i] + 2 * HALF + 34 + r() * 30); sz.push(sz[i] + 2 * HALF + 34 + r() * 30); }
  const ox = sx[NB] / 2, oz = sz[NB] / 2;
  for (let i = 0; i <= NB; i++) { sx[i] -= ox; sz[i] -= oz; }

  // ---- layout variety: a diagonal avenue that cuts blocks into triangles, roundabouts (the first a big
  // circus), and pairs of blocks merged into superblocks (some become parks or civic plazas)
  const NZ = NB + 1, nid = (i, j) => i * NZ + j, ekey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  const inTown = townMask(opts.shape, NB, opts.seed ?? 20261025), land = (i, j) => i < 0 || j < 0 || i >= NB || j >= NB || !inTown(i, j);
  const rl = rng((opts.seed ?? 20261025) + 77); // the open land's own dice, so it does not shift the town's
  const layout = { removed: new Set(), rounds: [], diags: [], superblocks: [] };
  const splitBlk = new Map(), roundAt = new Map(), owner = new Map();
  if (opts.diag !== false) { // the diagonal avenue runs corner to corner through k blocks
    const k = NB >= 12 ? 4 : 3, dj = r() < 0.5 ? 1 : -1;
    const i0 = 1 + Math.floor(r() * (NB - k - 1));
    const j0 = dj > 0 ? 1 + Math.floor(r() * (NB - k - 1)) : k + 1 + Math.floor(r() * (NB - k - 1));
    for (let t = 0; t < k; t++) {
      const ia = i0 + t, ja = j0 + t * dj, ib = ia + 1, jb = ja + dj;
      const ax = sx[ia], az = sz[ja], bx = sx[ib], bz = sz[jb], L = Math.hypot(bx - ax, bz - az);
      const seg = { a: nid(ia, ja), b: nid(ib, jb), ax, az, bx, bz, ux: (bx - ax) / L, uz: (bz - az) / L, L };
      layout.diags.push(seg); splitBlk.set(ia + ',' + Math.min(ja, jb), seg);
    }
  }
  const diagNodes = new Set(); for (const sg of layout.diags) { diagNodes.add(sg.a); diagNodes.add(sg.b); }
  const cornersOf = (i, j, i2 = i, j2 = j) => [nid(i, j), nid(i2 + 1, j), nid(i, j2 + 1), nid(i2 + 1, j2 + 1)];
  const splitCorner = new Set(); for (const key of splitBlk.keys()) { const [i, j] = key.split(',').map(Number); cornersOf(i, j).forEach(c => splitCorner.add(c)); }
  for (let tries = 0, want = NB >= 12 ? 3 : 2; tries < 300 && layout.rounds.length < want; tries++) {
    const i = 1 + Math.floor(r() * (NB - 1)), j = 1 + Math.floor(r() * (NB - 1)), id = nid(i, j);
    if (splitCorner.has(id) || layout.rounds.some(o => Math.abs(o.i - i) + Math.abs(o.j - j) < 3)) continue;
    const big = layout.rounds.length === 0, ri = big ? 15 : 6 + r() * 2, ro = ri + 7.5;
    const room = Math.min(sx[i] - sx[i - 1], sx[i + 1] - sx[i], sz[j] - sz[j - 1], sz[j + 1] - sz[j]) - 2 * HALF;
    if (ro + SW > HALF + room * 0.55) continue;
    const rd = { i, j, id, x: sx[i], z: sz[j], ri, ro, rc: ri + 3.7, big };
    layout.rounds.push(rd); roundAt.set(id, rd);
  }
  { // superblocks: two neighbouring blocks with the street between them taken out
    const deg = new Map(), base = (id) => { const i = Math.floor(id / NZ), j = id % NZ; return (i > 0) + (i < NB) + (j > 0) + (j < NB); };
    const dg = (id) => deg.get(id) ?? base(id);
    for (let tries = 0, want = NB >= 12 ? 6 : 4; tries < 400 && layout.superblocks.length < want; tries++) {
      const i = Math.floor(r() * NB), j = Math.floor(r() * NB), horiz = r() < 0.5, i2 = horiz ? i + 1 : i, j2 = horiz ? j : j + 1;
      if (i2 >= NB || j2 >= NB) continue;
      const k1 = i + ',' + j, k2 = i2 + ',' + j2;
      if (owner.has(k1) || owner.has(k2) || splitBlk.has(k1) || splitBlk.has(k2) || land(i, j) || land(i2, j2)) continue;
      const a = horiz ? nid(i + 1, j) : nid(i, j + 1), b = nid(i + 1, j + 1);
      if (diagNodes.has(a) || diagNodes.has(b) || roundAt.has(a) || roundAt.has(b) || cornersOf(i, j, i2, j2).some(c => roundAt.has(c)) || dg(a) < 3 || dg(b) < 3) continue;
      deg.set(a, dg(a) - 1); deg.set(b, dg(b) - 1);
      layout.removed.add(ekey(a, b));
      const q = r(), rect = { x0: sx[i] + HALF, x1: sx[i2 + 1] - HALF, z0: sz[j] + HALF, z1: sz[j2 + 1] - HALF, kind: q < 0.3 ? 'park' : q < 0.65 ? 'plaza' : 'dense' };
      layout.superblocks.push(rect); owner.set(k1, rect); owner.set(k2, 'skip');
    }
  }
  const nearRound = (x, z, pad) => layout.rounds.some(rd => Math.hypot(x - rd.x, z - rd.z) < rd.ro + SW + pad);
  const diagDist = (sg, x, z) => ({ t: (x - sg.ax) * sg.ux + (z - sg.az) * sg.uz, d: sg.ux * (z - sg.az) - sg.uz * (x - sg.ax) });
  const nearDiag = (x, z, pad) => layout.diags.some(sg => { const q = diagDist(sg, x, z); return q.t > -HALF - pad && q.t < sg.L + HALF + pad && Math.abs(q.d) < HALF + pad; });
  const rectGap = (lot, x, z) => Math.hypot(Math.max(lot.x0 - x, 0, x - lot.x1), Math.max(lot.z0 - z, 0, z - lot.z1));
  const vGone = (i, z) => { for (let j = 0; j < NB; j++) if (z >= sz[j] && z < sz[j + 1]) return layout.removed.has(ekey(nid(i, j), nid(i, j + 1))); return false; };
  const hGone = (j, x) => { for (let i = 0; i < NB; i++) if (x >= sx[i] && x < sx[i + 1]) return layout.removed.has(ekey(nid(i, j), nid(i + 1, j))); return false; };

  const B = {
    fac: [new Bucket(), new Bucket(), new Bucket(), new Bucket()],
    shop: new Bucket(), roof: new Bucket(), walk: new Bucket(), grass: new Bucket(),
  };
  const crowns = [], trunks = [], tanks = [], lamps = [], stripes = [], parked = [], crowds = [], walkBlocks = [], open = [], buildings = [];
  let curB = -1; // building being generated (rooftop clutter remembers its owner)

  // downtown clusters
  const centers = [];
  for (let k = 0; k < (opts.centers ?? 3); k++) centers.push([(r() - 0.5) * sx[NB] * 1.2, (r() - 0.5) * sz[NB] * 1.2, (90 + r() * 90) * Math.min(1, NB / 12)]);
  const blockAt = (v, lines) => { for (let k = 0; k < NB; k++) if (v < lines[k + 1]) return k; return NB - 1; };
  for (const c of centers) for (let t = 0; t < 8 && land(blockAt(c[0], sx), blockAt(c[1], sz)); t++) { c[0] *= 0.7; c[1] *= 0.7; } // drawn in until it is on built ground
  const heightAt = (x, z) => {
    let h = 0;
    for (const [cx, cz, s] of centers) h = Math.max(h, Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s)));
    return h;
  };

  // districts: a brick old town, a stone, glass and concrete downtown, lighter painted residential streets, industrial edges
  const dS = [r() * 100, r() * 100, r() * 100];
  const district = (x, z) => {
    if (heightAt(x, z) > 0.55) return 'down';
    const edge = Math.max(Math.abs(x) / sx[NB], Math.abs(z) / sz[NB]), n1 = Math.sin(x * 0.006 + dS[0]) * Math.cos(z * 0.005 + dS[1]), n2 = Math.sin(x * 0.0045 - z * 0.004 + dS[2]);
    if (edge > 0.8 && n2 > 0.1) return 'ind';
    return n1 > 0.15 ? 'old' : n1 < -0.25 ? 'res' : 'mixed';
  };
  const wallColor = (x, z, fl, style) => {
    let w;
    if (style === 1) w = { glass: 6, concrete: 2, dark: 1.5, stone: 1 }; // ribbon windows: a modern office block
    else { w = { ...MIX[district(x, z)] }; if (fl >= 9) for (const k of ['stone', 'concrete', 'dark']) w[k] = (w[k] || 0) * 2 + 1; }
    if (opts.tint) for (const k in opts.tint) w[k] = (w[k] || 0) + opts.tint[k]; // the place's own character
    let t = r() * Object.values(w).reduce((a, b) => a + b, 0), m = 'sand';
    for (const k in w) { if ((t -= w[k]) <= 0) { m = k; break; } }
    return shade(lin(pick(MATERIALS[m])), 0.92 + r() * 0.14);
  };

  const addTree = (x, z, y, s, trunkH) => {
    trunks.push({ x, z, y, h: trunkH, s: s * 0.5, b: curB });
    crowns.push({ x, y: y + trunkH + s * 0.75, z, s, col: pick(GREENS), b: curB });
  };

  function parapet(b, y, col, hgt = 0.9) {
    const t = 0.35;
    const c = shade(col, 0.95);
    box(B.roof, { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + t }, y, y + hgt, c);
    box(B.roof, { x0: b.x0, x1: b.x1, z0: b.z1 - t, z1: b.z1 }, y, y + hgt, c);
    box(B.roof, { x0: b.x0, x1: b.x0 + t, z0: b.z0 + t, z1: b.z1 - t }, y, y + hgt, c);
    box(B.roof, { x0: b.x1 - t, x1: b.x1, z0: b.z0 + t, z1: b.z1 - t }, y, y + hgt, c);
  }

  function roofStuff(t, y, wallCol, need = false) {
    const w = t.x1 - t.x0, d = t.z1 - t.z0, area = w * d;
    if (w < 3 || d < 3) return;
    const m = 1.0;
    const rp = (sw, sd) => {
      const x = t.x0 + m + r() * Math.max(0, w - 2 * m - sw);
      const z = t.z0 + m + r() * Math.max(0, d - 2 * m - sd);
      return { x0: x, x1: x + sw, z0: z, z1: z + sd };
    };
    if (r() < 0.45) { // terracotta / rust surfacing
      const pw = w * (0.35 + r() * 0.55), pd = d * (0.35 + r() * 0.55);
      const p = rp(Math.min(pw, w - 2 * m), Math.min(pd, d - 2 * m)), c = lin(pick(RUST));
      sides(B.roof, p, y, y + 0.14, c, PLAIN); top(B.roof, p, y + 0.14, c);
    }
    let hut = null;
    if ((need || r() < 0.7) && w > 4.5 && d > 4.5) { // stair / lift hut, with the door people come up through
      const big = w > 7 && d > 7;
      const hb = rp(big ? 2.4 + r() * 1.4 : 1.7 + r() * 0.5, big ? 2.4 + r() * 1.8 : 1.7 + r() * 0.5);
      const hh = big ? 2.5 + r() * 0.6 : 2.3;
      box(B.roof, hb, y, y + hh, toWhite(wallCol, 0.15));
      parapet(hb, y + hh, toWhite(wallCol, 0.1), 0.35);
      const hcx = (hb.x0 + hb.x1) / 2, hcz = (hb.z0 + hb.z1) / 2, ox = (t.x0 + t.x1) / 2 - hcx, oz = (t.z0 + t.z1) / 2 - hcz, dc = lin('#4a3c30');
      let door; // on the side that faces the open roof
      if (Math.abs(ox) > Math.abs(oz)) { const fx = ox > 0 ? hb.x1 : hb.x0, sg = ox > 0 ? 1 : -1; box(B.roof, { x0: Math.min(fx, fx + sg * 0.07), x1: Math.max(fx, fx + sg * 0.07), z0: hcz - 0.45, z1: hcz + 0.45 }, y, y + 2, dc); door = [fx + sg * 0.8, hcz]; }
      else { const fz = oz > 0 ? hb.z1 : hb.z0, sg = oz > 0 ? 1 : -1; box(B.roof, { x0: hcx - 0.45, x1: hcx + 0.45, z0: Math.min(fz, fz + sg * 0.07), z1: Math.max(fz, fz + sg * 0.07) }, y, y + 2, dc); door = [hcx, fz + sg * 0.8]; }
      hut = { x0: hb.x0, x1: hb.x1, z0: hb.z0, z1: hb.z1, door };
    }
    const nAC = Math.floor((0.3 + r() * 0.7) * Math.min(12, area / 22));
    for (let k = 0; k < nAC; k++) {
      const s = 0.8 + r() * 0.9;
      box(B.roof, rp(s, s * (0.6 + r() * 0.5)), y, y + 0.5 + r() * 0.7, lin(r() < 0.7 ? '#dcd8cf' : '#a39c90'));
    }
    if (r() < 0.3) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const rr = 0.6 + r() * 0.5; const p = rp(rr * 2, rr * 2);
        tanks.push({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, y, r: rr, h: 1.0 + r() * 1.0, dark: r() < 0.5, b: curB });
      }
    }
    if (r() < 0.55) { // roof garden
      if (r() < 0.6) { const p = rp(w * 0.5, d * 0.4); sides(B.roof, p, y, y + 0.32, lin('#b5ab98'), PLAIN); top(B.grass, p, y + 0.32, lin('#a0a070'), 6); }
      const n = 2 + Math.floor(r() * Math.min(14, area / 20));
      for (let k = 0; k < n; k++) {
        const s = 0.45 + r() * 0.7; const p = rp(s * 2, s * 2);
        crowns.push({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, y: y + s * 0.7, s, col: pick(GREENS), b: curB });
      }
      if (r() < 0.3 && w > 8 && d > 8) { const p = rp(4, 4); addTree((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, y, 1.4 + r() * 0.8, 1.2); }
    }
    if (r() < 0.3) { // clutter: crates, sheds
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) { const s = 0.6 + r() * 1.6; box(B.roof, rp(s, s * (0.5 + r())), y, y + 0.4 + r() * 1.2, lin(pick(['#9b7f60', '#b8a385', '#8c8a80', '#c9b79a']))); }
    }
    return hut;
  }

  function balconies(b, y0, fl, col, mask) {
    const D = 1.1;
    for (let s = 0; s < 4; s++) {
      if (!(mask & (1 << s))) continue;
      const S = SIDES[s]; const [lx, lz] = S.L(b); const w = S.w(b);
      const nSeg = Math.floor((w - 1) / 6);
      if (nSeg < 1) continue;
      const start = (w - nSeg * 6) / 2;
      for (let f = 1; f < fl; f++) {
        const y = y0 + GF + f * FH;
        for (let k = 0; k < nSeg; k++) {
          const a0 = start + k * 6 + 0.6, a1 = a0 + 4.8;
          const p0x = lx + S.R[0] * a0, p0z = lz + S.R[1] * a0;
          const p1x = lx + S.R[0] * a1 + S.out[0] * D, p1z = lz + S.R[1] * a1 + S.out[1] * D;
          const rect = { x0: Math.min(p0x, p1x), x1: Math.max(p0x, p1x), z0: Math.min(p0z, p1z), z1: Math.max(p0z, p1z) };
          box(B.roof, rect, y - 0.2, y + 0.95, shade(col, 0.97));
        }
      }
    }
  }

  function building(lot, interior, blk) {
    const ins = r() < 0.75 ? 0.12 : 0.4 + r() * 1.4;
    const b = { x0: lot.x0 + ins, x1: lot.x1 - ins, z0: lot.z0 + ins, z1: lot.z1 - ins };
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (w < 3.5 || d < 3.5) return;
    curB = buildings.length;
    const hf = heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    let fl; const q = r();
    const tall = opts.tall ?? 0.12;
    if (q < 0.38) fl = 1 + Math.floor(r() * 3);
    else if (q < 1 - tall) fl = 3 + Math.floor(r() * 4);
    else fl = 7 + Math.floor(r() * 6);
    fl = Math.max(1, Math.round(fl * (0.8 + hf * 0.8)));
    if (interior) fl = Math.max(1, Math.round(fl * 0.6));
    fl = Math.min(fl, Math.floor(Math.min(w, d) * 0.9), opts.maxFloors ?? 16);
    const sq = r();
    const style = fl >= 9 ? (sq < 0.25 ? 1 : sq < 0.7 ? 0 : 2) : (sq < 0.45 ? 0 : sq < 0.72 ? 2 : sq < 0.93 ? 3 : 1);
    const col = wallColor((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, fl, style);
    const y0 = CURB;
    const fk = 'fac' + style, vStart = { [fk]: B.fac[style].v, shop: B.shop.v, roof: B.roof.v, grass: B.grass.v };
    sides(B.shop, b, y0, y0 + GF, toWhite(col, 0.35), { su: 24, sv: GF, v0: y0 });
    const h = y0 + GF + fl * FH;
    sides(B.fac[style], b, y0 + GF, h, col, { su: 12, sv: 12, v0: y0 + GF });
    top(B.roof, b, h, lin(pick(ROOFS)));
    if (style === 3) box(B.roof, { x0: b.x0 - 0.3, x1: b.x1 + 0.3, z0: b.z0 - 0.3, z1: b.z1 + 0.3 }, h - 0.5, h - 0.08, toWhite(col, 0.2));
    parapet(b, h, col, style === 1 ? 1.2 : 0.9);
    if ((style === 0 || style === 2) && fl >= 2 && r() < 0.55) {
      let mask = 1 << Math.floor(r() * 4);
      if (r() < 0.5) mask |= 1 << Math.floor(r() * 4);
      balconies(b, y0, fl, col, mask);
    }
    let tr = b, th = h;
    if (fl >= 5 && r() < 0.4) {
      const t = { ...b };
      if (r() < 0.6) t.x0 += 2 + r() * 3;
      if (r() < 0.6) t.x1 -= 2 + r() * 3;
      if (r() < 0.6) t.z0 += 2 + r() * 3;
      if (r() < 0.6) t.z1 -= 2 + r() * 3;
      if (t.x1 - t.x0 >= 5 && t.z1 - t.z0 >= 5 && (t.x0 !== b.x0 || t.x1 !== b.x1 || t.z0 !== b.z0 || t.z1 !== b.z1)) {
        const extra = 1 + Math.floor(r() * 5);
        const h2 = h + extra * FH;
        sides(B.fac[style], t, h, h2, col, { su: 12, sv: 12, v0: y0 + GF });
        top(B.roof, t, h2, lin(pick(ROOFS)));
        parapet(t, h2, col);
        roofStuff({ x0: b.x0 + 0.4, x1: b.x1 - 0.4, z0: b.z0 + 0.4, z1: b.z1 - 0.4 }, h, col); // lower terrace
        tr = t; th = h2;
      }
    }
    const hut = roofStuff({ x0: tr.x0 + 0.35, x1: tr.x1 - 0.35, z0: tr.z0 + 0.35, z1: tr.z1 - 0.35 }, th, col, !interior);
    // gameplay record: street door, roof, vertex ranges (for charring)
    const ranges = [{ key: fk, v0: vStart[fk], v1: B.fac[style].v }, { key: 'shop', v0: vStart.shop, v1: B.shop.v }, { key: 'roof', v0: vStart.roof, v1: B.roof.v }, { key: 'grass', v0: vStart.grass, v1: B.grass.v }]; // grass: its roof garden
    const rec = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, roofY: th, baseY: y0, fl, ranges, door: null,
      roof: { x0: tr.x0 + 0.7, x1: tr.x1 - 0.7, z0: tr.z0 + 0.7, z1: tr.z1 - 0.7 } };
    if (!interior) {
      const dr = rng(buildings.length * 7919 + 13), e = 0.05, opts = [];
      if (Math.abs(lot.z0 - blk.z0) < e) opts.push(3);
      if (Math.abs(lot.z1 - blk.z1) < e) opts.push(2);
      if (Math.abs(lot.x0 - blk.x0) < e) opts.push(1);
      if (Math.abs(lot.x1 - blk.x1) < e) opts.push(0);
      if (opts.length) {
        const sd = opts[Math.floor(dr() * opts.length)];
        const ax = b.x0 + 1.2 + dr() * Math.max(0, w - 2.4), az = b.z0 + 1.2 + dr() * Math.max(0, d - 2.4);
        if (sd === 3) { rec.wall = [ax, b.z0]; rec.door = [ax, blk.z0 - 0.9]; rec.n = [0, -1]; }
        else if (sd === 2) { rec.wall = [ax, b.z1]; rec.door = [ax, blk.z1 + 0.9]; rec.n = [0, 1]; }
        else if (sd === 1) { rec.wall = [b.x0, az]; rec.door = [blk.x0 - 0.9, az]; rec.n = [-1, 0]; }
        else { rec.wall = [b.x1, az]; rec.door = [blk.x1 + 0.9, az]; rec.n = [1, 0]; }
      }
    }
    rec.wallCol = col; rec.top = th; rec.hut = hut || null; rec.hatch = hut ? hut.door : null;
    buildings.push(rec);
    curB = -1;
  }

  // ---- landmarks: one building of stacked tiers on a whole block, recorded like any other (it can burn and fall)
  const sq = (cx, cz, hw, hd = hw) => ({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd });
  function tiered(tiers, style, col, blk, o = {}) {
    curB = buildings.length;
    const fk = 'fac' + style, vStart = { [fk]: B.fac[style].v, shop: B.shop.v, roof: B.roof.v, grass: B.grass.v }, y0 = CURB, base = tiers[0].b;
    sides(B.shop, base, y0, y0 + GF, toWhite(col, 0.3), { su: 24, sv: GF, v0: y0 });
    let y = y0 + GF, fl = 0;
    for (const t of tiers) {
      const y1 = y + t.fl * FH; fl += t.fl;
      sides(B.fac[style], t.b, y, y1, col, { su: 12, sv: 12, v0: y0 + GF });
      top(B.roof, t.b, y1, lin(o.roof || '#a39c8e'));
      box(B.roof, { x0: t.b.x0 - 0.35, x1: t.b.x1 + 0.35, z0: t.b.z0 - 0.35, z1: t.b.z1 + 0.35 }, y1 - 0.7, y1 - 0.08, toWhite(col, o.trim ?? 0.25)); // cornice
      parapet(t.b, y1, col, 1.0);
      y = y1;
    }
    const tb = tiers[tiers.length - 1].b, tcx = (tb.x0 + tb.x1) / 2, tcz = (tb.z0 + tb.z1) / 2;
    const hut = o.noHut ? null : roofStuff({ x0: tb.x0 + 0.35, x1: tb.x1 - 0.35, z0: tb.z0 + 0.35, z1: tb.z1 - 0.35 }, y, col, true);
    const th = o.crown ? o.crown(tcx, tcz, y, tb) : y;
    const ranges = [{ key: fk, v0: vStart[fk], v1: B.fac[style].v }, { key: 'shop', v0: vStart.shop, v1: B.shop.v }, { key: 'roof', v0: vStart.roof, v1: B.roof.v }, { key: 'grass', v0: vStart.grass, v1: B.grass.v }];
    const rec = { x0: base.x0, x1: base.x1, z0: base.z0, z1: base.z1, roofY: y, baseY: y0, fl, ranges, door: null, roof: { x0: tb.x0 + 0.7, x1: tb.x1 - 0.7, z0: tb.z0 + 0.7, z1: tb.z1 - 0.7 }, landmark: o.name };
    const cx = (base.x0 + base.x1) / 2; rec.wall = [cx, base.z0]; rec.door = [cx, blk.z0 - 0.9]; rec.n = [0, -1];
    rec.wallCol = col; rec.top = th; rec.hut = hut || null; rec.hatch = hut ? hut.door : null;
    buildings.push(rec); curB = -1;
    return rec;
  }
  // a round drum and a dome made of quads (the dome of a civic building)
  function drum(cx, cz, y0, y1, R, col, segs = 18) {
    for (let j = 0; j < segs; j++) {
      const b0 = j / segs * Math.PI * 2, b1 = (j + 1) / segs * Math.PI * 2, bm = (b0 + b1) / 2;
      const P = (b, y) => [cx + Math.cos(b) * R, y, cz + Math.sin(b) * R];
      B.roof.quad(P(b1, y0), P(b0, y0), P(b0, y1), P(b1, y1), [Math.cos(bm), 0, Math.sin(bm)], [0, 0], [1, 0], [1, 1], [0, 1], shade(col, 0.82), col);
    }
  }
  function dome(cx, cz, y, R, col, segs = 18, rings = 7) {
    for (let i = 0; i < rings; i++) {
      const a0 = i / rings * Math.PI / 2, a1 = (i + 1) / rings * Math.PI / 2, am = (a0 + a1) / 2;
      for (let j = 0; j < segs; j++) {
        const b0 = j / segs * Math.PI * 2, b1 = (j + 1) / segs * Math.PI * 2, bm = (b0 + b1) / 2;
        const P = (a, b) => [cx + Math.cos(a) * Math.cos(b) * R, y + Math.sin(a) * R, cz + Math.cos(a) * Math.sin(b) * R];
        const c = shade(col, 0.8 + 0.2 * Math.sin(am));
        B.roof.quad(P(a0, b1), P(a0, b0), P(a1, b0), P(a1, b1), [Math.cos(am) * Math.cos(bm), Math.sin(am), Math.cos(am) * Math.sin(bm)], [0, 0], [1, 0], [1, 1], [0, 1], c, c);
      }
    }
  }
  const mast = (cx, cz, y, hgt, s = 0.5) => { box(B.roof, sq(cx, cz, s), y, y + hgt, lin('#c9c4ba')); box(B.roof, sq(cx, cz, s * 2.2), y + hgt * 0.35, y + hgt * 0.35 + 0.6, lin('#9a958c')); return y + hgt; };
  // the stadium: a ring of stands round a pitch, a roof canopy, floodlight towers; its 'roof' is the pitch, where crowds gather
  function stadium(cx, cz, R, blk) {
    curB = buildings.length;
    const vStart = { roof: B.roof.v, grass: B.grass.v }, y0 = CURB, H = 16, segs = 40, r0 = R * 0.55, wall = lin('#cfc7b8'), seat = lin('#8c3a32'), seat2 = lin('#a8a29a');
    const P = (a, r, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    for (let j = 0; j < segs; j++) {
      const a0 = j / segs * Math.PI * 2, a1 = (j + 1) / segs * Math.PI * 2, am = (a0 + a1) / 2, ox = Math.cos(am), oz = Math.sin(am);
      B.roof.quad(P(a1, R, y0), P(a0, R, y0), P(a0, R, y0 + H), P(a1, R, y0 + H), [ox, 0, oz], [0, 0], [1, 0], [1, 1], [0, 1], shade(wall, 0.78), wall); // the outer wall
      if (j % 2 === 0) B.roof.quad(P(a1, R + 0.05, y0 + 3), P(a0, R + 0.05, y0 + 3), P(a0, R + 0.05, y0 + H - 2), P(a1, R + 0.05, y0 + H - 2), [ox, 0, oz], [0, 0], [1, 0], [1, 1], [0, 1], lin('#9a9286'), lin('#b3ab9e')); // pillars between the arches
      for (let t = 0; t < 4; t++) { // the stands, rising from the pitch to the rim in four tiers
        const ra = r0 + (R - r0) * t / 4, rb = r0 + (R - r0) * (t + 1) / 4, ya = y0 + 1 + (H - 2) * t / 4, yb = y0 + 1 + (H - 2) * (t + 1) / 4, c = j % 5 === 0 ? seat2 : seat; // aisles
        B.roof.quad(P(a0, ra, ya), P(a1, ra, ya), P(a1, rb, yb), P(a0, rb, yb), [-ox * 0.6, 0.8, -oz * 0.6], [0, 0], [1, 0], [1, 1], [0, 1], shade(c, 0.85), c);
      }
      B.roof.quad(P(a1, R - 0.3, y0 + H + 1.2), P(a0, R - 0.3, y0 + H + 1.2), P(a0, R - (R - r0) * 0.55, y0 + H + 2.2), P(a1, R - (R - r0) * 0.55, y0 + H + 2.2), [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1], lin('#e8e4dc'), lin('#f2efe8')); // the canopy
    }
    const field = { x0: cx - r0 * 0.7, x1: cx + r0 * 0.7, z0: cz - r0 * 0.7, z1: cz + r0 * 0.7 };
    top(B.grass, sq(cx, cz, r0 * 0.98), y0 + 0.9, lin('#7f9a52'), 6); // the pitch
    for (let k = -2; k <= 2; k++) top(B.grass, sq(cx + k * r0 * 0.3, cz, r0 * 0.06, r0 * 0.6), y0 + 0.93, lin('#a8c070'), 6); // mowing stripes (in the stadium's own ranges, so they go with it)
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = cx + sx * R * 0.78, z = cz + sz * R * 0.78; box(B.roof, sq(x, z, 0.6), y0, y0 + H + 14, lin('#8a8a86')); box(B.roof, sq(x, z, 2.2, 1.2), y0 + H + 14, y0 + H + 16.5, lin('#e8e6dc')); } // floodlights
    const rec = { x0: cx - R, x1: cx + R, z0: cz - R, z1: cz + R, roofY: y0 + 0.9, baseY: y0, fl: 5, door: null, landmark: 'Stadium',
      ranges: [{ key: 'roof', v0: vStart.roof, v1: B.roof.v }, { key: 'grass', v0: vStart.grass, v1: B.grass.v }], roof: field };
    rec.wall = [cx, cz - R]; rec.door = [cx, blk.z0 - 0.9]; rec.n = [0, -1];
    rec.wallCol = wall; rec.top = y0 + H + 2.2; rec.hut = null; rec.hatch = null;
    buildings.push(rec); curB = -1;
    crowds.push({ x: cx, z: blk.z0 + 2, y: CURB + 0.03, n: 20, rad: 5 });
  }

  function landmark(kind, blk) {
    const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2, W = (blk.x1 - blk.x0) / 2, D = (blk.z1 - blk.z0) / 2;
    top(B.walk, blk, CURB + 0.03, lin('#ece2cf'), 4); // a paved forecourt all round
    crowds.push({ x: cx, z: blk.z0 + 3, y: CURB + 0.03, n: 14 + Math.floor(r() * 14), rad: 4 });
    if (kind === 'spire') // a glass skyscraper in three setbacks with a spire
      tiered([{ b: sq(cx, cz, W * 0.62, D * 0.62), fl: 14 }, { b: sq(cx, cz, W * 0.5, D * 0.5), fl: 12 }, { b: sq(cx, cz, W * 0.38, D * 0.38), fl: 10 }], 1, lin('#6f8290'), blk,
        { name: 'Skyscraper', roof: '#5f6a72', trim: 0.15, crown: (x, z, y, t) => { box(B.roof, sq(x, z, (t.x1 - t.x0) * 0.32), y, y + 5, lin('#8a98a2')); box(B.roof, sq(x, z, (t.x1 - t.x0) * 0.18), y + 5, y + 10, lin('#a7b2b8')); return mast(x, z, y + 10, 26, 0.45); } });
    else if (kind === 'deco') // a stepped limestone Art Deco tower
      tiered([{ b: sq(cx, cz, W * 0.66, D * 0.66), fl: 10 }, { b: sq(cx, cz, W * 0.54, D * 0.54), fl: 8 }, { b: sq(cx, cz, W * 0.42, D * 0.42), fl: 7 }, { b: sq(cx, cz, W * 0.3, D * 0.3), fl: 5 }], 0, lin('#e2d6bc'), blk,
        { name: 'Art Deco tower', trim: 0.4, crown: (x, z, y, t) => { const s = (t.x1 - t.x0) / 2; box(B.roof, sq(x, z, s * 0.7), y, y + 5, lin('#e8dcc2')); box(B.roof, sq(x, z, s * 0.45), y + 5, y + 9, lin('#d9c9a4')); box(B.roof, sq(x, z, s * 0.25), y + 9, y + 13, lin('#cdb98c')); return mast(x, z, y + 13, 16, 0.35); } });
    else if (kind === 'stadium') stadium(cx, cz, Math.min(W, D) * 0.92, blk);
    else if (kind === 'dome') { // city hall: white stone, a columned portico and a green copper dome
      const hw = W * 0.8, hd = D * 0.55, h = CURB + GF + 4 * FH, R = Math.min(hw, hd) * 0.42;
      tiered([{ b: sq(cx, cz, hw, hd), fl: 4 }], 3, lin('#efe9dc'), blk, { name: 'City hall', noHut: true, trim: 0.45, roof: '#cfc6b4',
        crown: (x, z, y) => { drum(x, z, y, y + 7, R, lin('#ebe4d5')); box(B.roof, sq(x, z, R * 1.05, R * 1.05), y + 6.6, y + 7.2, lin('#dcd3c0')); dome(x, z, y + 7, R, lin('#86a596')); drum(x, z, y + 7 + R, y + 10 + R, R * 0.18, lin('#e8e1d2'), 8); dome(x, z, y + 10 + R, R * 0.2, lin('#86a596'), 8, 3); return y + 10 + R * 1.2; } });
      for (let k = 0; k < 8; k++) { const x = cx - hw * 0.55 + k * hw * 1.1 / 7; box(B.roof, sq(x, cz - hd - 2.2, 0.5), CURB, h, lin('#f2ece0')); } // the portico
      box(B.roof, { x0: cx - hw * 0.62, x1: cx + hw * 0.62, z0: cz - hd - 3.2, z1: cz - hd }, h, h + 1.4, lin('#ebe4d5'));
      box(B.roof, { x0: cx - hw * 0.62, x1: cx + hw * 0.62, z0: cz - hd - 3.4, z1: cz - hd }, CURB, CURB + 0.6, lin('#e2dacb')); // steps
    }
  }

  function split(rect, out, depth) {
    const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
    const maxS = 10 + r() * 13;
    if ((w < maxS && d < maxS) || depth > 7) { out.push(rect); return; }
    if (w > d) {
      const t = rect.x0 + w * (0.32 + r() * 0.36);
      split({ ...rect, x1: t }, out, depth + 1); split({ ...rect, x0: t }, out, depth + 1);
    } else {
      const t = rect.z0 + d * (0.32 + r() * 0.36);
      split({ ...rect, z1: t }, out, depth + 1); split({ ...rect, z0: t }, out, depth + 1);
    }
  }

  function parkingLot(lot) {
    top(B.roof, lot, CURB + 0.03, lin('#bfb3a0'));
    const horiz = (lot.x1 - lot.x0) > (lot.z1 - lot.z0);
    const along = horiz ? [lot.x0 + 2, lot.x1 - 2] : [lot.z0 + 2, lot.z1 - 2];
    const across = horiz ? [lot.z0 + 3, lot.z1 - 3] : [lot.x0 + 3, lot.x1 - 3];
    for (let c = across[0]; c <= across[1]; c += 6) {
      for (let a = along[0]; a <= along[1] - 2.4; a += 2.7) {
        if (r() < 0.25) continue;
        parked.push(horiz ? { x: a + 1.2, z: c, y: CURB + 0.03, rot: Math.PI / 2 } : { x: c, z: a + 1.2, y: CURB + 0.03, rot: 0 });
      }
    }
  }

  // ---- sidewalk slabs that are not plain rectangles (triangle halves, corners cut by a roundabout)
  const slabGeos = [], curbCol = lin('#e2d8c6'), fountains = [];
  function slab(poly) {
    if (poly.length < 3) return;
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: CURB, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count, cA = new Float32Array(n * 3), uA = new Float32Array(n * 2);
    for (let v = 0; v < n; v++) {
      const c = nrm.getY(v) > 0.5 ? [1, 1, 1] : curbCol; cA[v * 3] = c[0]; cA[v * 3 + 1] = c[1]; cA[v * 3 + 2] = c[2];
      uA[v * 2] = pos.getX(v) / 4; uA[v * 2 + 1] = -pos.getZ(v) / 4;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cA, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uA, 2));
    slabGeos.push(g);
  }
  const rectPoly = (rc) => [[rc.x0, rc.z0], [rc.x1, rc.z0], [rc.x1, rc.z1], [rc.x0, rc.z1]];
  // a rectangle whose corners next to a roundabout follow the ring's outer curb
  function cutRect(rc, rounds) {
    const pts = [], C = rectPoly(rc);
    for (let k = 0; k < 4; k++) {
      const [cx, cz] = C[k], rd = rounds.find(o => Math.abs(o.x - cx) < HALF + 1 && Math.abs(o.z - cz) < HALF + 1);
      if (!rd) { pts.push([cx, cz]); continue; }
      const out = (b) => { // where the edge from this corner towards b leaves the ring
        const dx = b[0] - cx, dz = b[1] - cz, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, fx = cx - rd.x, fz = cz - rd.z;
        const bb = fx * ux + fz * uz, t = -bb + Math.sqrt(Math.max(0, bb * bb - (fx * fx + fz * fz - rd.ro * rd.ro))); return [cx + ux * t, cz + uz * t];
      };
      const p1 = out(C[(k + 3) % 4]), p2 = out(C[(k + 1) % 4]);
      const a1 = Math.atan2(p1[1] - rd.z, p1[0] - rd.x); let da = Math.atan2(p2[1] - rd.z, p2[0] - rd.x) - a1;
      while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      for (let q = 0; q <= 10; q++) { const a = a1 + da * q / 10; pts.push([rd.x + Math.cos(a) * rd.ro, rd.z + Math.sin(a) * rd.ro]); }
    }
    return pts;
  }
  function clip(poly, f) { // the part of poly where f >= 0
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length], fa = f(a[0], a[1]), fb = f(b[0], b[1]);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  const lotFits = (lot, diag, cuts) => {
    if (diag) {
      const D = rectPoly(lot).map(([x, z]) => diagDist(diag, x, z).d), m = HALF + 0.4;
      if (!(D.every(d => d >= m) || D.every(d => d <= -m))) return false;
    }
    for (const rd of cuts) if (rectGap(lot, rd.x, rd.z) < rd.ro + SW + 0.6) return false;
    return true;
  };
  const halve = (lot) => { const w = lot.x1 - lot.x0, d = lot.z1 - lot.z0; if (w > d) { const t = lot.x0 + w / 2; return [{ ...lot, x1: t }, { ...lot, x0: t }]; } const t = lot.z0 + d / 2; return [{ ...lot, z1: t }, { ...lot, z0: t }]; };
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

  function placeLots(lots, blk, diag, cuts, keepOpen) {
    const e = 0.01;
    for (const lot of lots) {
      const w = lot.x1 - lot.x0, d = lot.z1 - lot.z0, area = w * d;
      if (keepOpen && overlaps(lot, keepOpen)) { open.push(lot); continue; }
      if (!lotFits(lot, diag, cuts)) {
        // cut it smaller so buildings step along the avenue or around the ring; what is left is paving
        if (w > 9 || d > 9) { placeLots(halve(lot), blk, diag, cuts, keepOpen); continue; }
        open.push(lot);
        const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
        if (w > 4 && d > 4 && r() < 0.4 && (!diag || Math.abs(diagDist(diag, cx, cz).d) > HALF + 1.5) && !nearRound(cx, cz, 1)) addTree(cx, cz, CURB, 1.3 + r() * 0.8, 2.2);
        continue;
      }
      const interior = lot.x0 > blk.x0 + e && lot.x1 < blk.x1 - e && lot.z0 > blk.z0 + e && lot.z1 < blk.z1 - e;
      const k = r();
      if (k < 0.05 && !interior) {
        top(B.walk, lot, CURB + 0.03, lin('#f4ead8'), 4);
        const n = 1 + Math.floor(r() * 4);
        for (let t = 0; t < n; t++) addTree(lot.x0 + 2 + r() * (w - 4), lot.z0 + 2 + r() * (d - 4), CURB, 1.5 + r(), 2.5);
        open.push(lot);
        crowds.push({ x: (lot.x0 + lot.x1) / 2, z: (lot.z0 + lot.z1) / 2, y: CURB + 0.03, n: 10 + Math.floor(r() * 30), rad: Math.min(w, d) * 0.35 });
      } else if (k < 0.08) {
        top(B.grass, lot, CURB + 0.04, lin('#ffffff'), 6);
        const n = 1 + Math.floor(area / 60);
        for (let t = 0; t < n; t++) addTree(lot.x0 + 1.5 + r() * (w - 3), lot.z0 + 1.5 + r() * (d - 3), CURB, 1.3 + r() * 1.2, 1.8 + r() * 2);
      } else if (k < 0.13 && area > 250 && !interior) {
        parkingLot(lot); open.push(lot);
      } else {
        building(lot, interior, blk);
      }
    }
  }

  // a block outside the town: open land up to the road edge, grass and woods, or desert scrub
  function landBlock(sw) {
    const kind = opts.land || 'grass', desert = kind === 'desert';
    top(B.grass, sw, 0.05, lin(desert ? '#f0cf94' : kind === 'forest' ? '#d8e4c8' : '#ffffff'), 6);
    const area = (sw.x1 - sw.x0) * (sw.z1 - sw.z0), n = Math.floor(area / (desert ? 420 : kind === 'forest' ? 55 : 160));
    for (let k = 0; k < n; k++) {
      const x = sw.x0 + 3 + rl() * (sw.x1 - sw.x0 - 6), z = sw.z0 + 3 + rl() * (sw.z1 - sw.z0 - 6), s = desert ? 0.6 + rl() * 0.6 : 1.5 + rl() * 1.6, h = desert ? 0.5 + rl() * 0.5 : 2 + rl() * 2.4;
      trunks.push({ x, z, y: 0.05, h, s: s * 0.5, b: -1 });
      crowns.push({ x, y: 0.05 + h + s * 0.75, z, s, col: desert ? (rl() < 0.5 ? '#8f8a52' : '#a39a5e') : GREENS[Math.floor(rl() * GREENS.length)], b: -1 });
    }
  }
  // a big park across a superblock: lawns, two crossing paths, a fountain in the middle, plenty of trees
  function bigPark(blk) {
    top(B.grass, blk, CURB + 0.04, lin('#ffffff'), 6);
    const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
    top(B.walk, { x0: blk.x0, x1: blk.x1, z0: cz - 1.6, z1: cz + 1.6 }, CURB + 0.07, lin('#efe2c8'), 4);
    top(B.walk, { x0: cx - 1.6, x1: cx + 1.6, z0: blk.z0, z1: blk.z1 }, CURB + 0.07, lin('#efe2c8'), 4);
    top(B.walk, { x0: cx - 7, x1: cx + 7, z0: cz - 7, z1: cz + 7 }, CURB + 0.08, lin('#efe2c8'), 4);
    fountains.push({ x: cx, z: cz, R: 4.2 });
    const n = Math.floor((blk.x1 - blk.x0) * (blk.z1 - blk.z0) / 55);
    for (let k = 0; k < n; k++) {
      const x = blk.x0 + 2 + r() * (blk.x1 - blk.x0 - 4), z = blk.z0 + 2 + r() * (blk.z1 - blk.z0 - 4);
      if (Math.abs(x - cx) < 3.5 || Math.abs(z - cz) < 3.5 || (Math.abs(x - cx) < 9 && Math.abs(z - cz) < 9)) continue;
      addTree(x, z, CURB, 1.6 + r() * 1.5, 2 + r() * 2.2);
    }
    open.push(blk);
    crowds.push({ x: cx, z: cz, y: CURB + 0.08, n: 30 + Math.floor(r() * 30), rad: 9 });
    crowds.push({ x: cx + (blk.x1 - blk.x0) * 0.25, z: cz, y: CURB + 0.07, n: 12, rad: 5 });
  }

  // ---- where the landmarks go: whole ordinary blocks in the busiest districts, well apart
  const landmarks = new Map();
  {
    const cand = [];
    for (let i = 1; i < NB - 1; i++) for (let j = 1; j < NB - 1; j++) {
      const key = i + ',' + j;
      if (owner.get(key) || splitBlk.get(key) || land(i, j) || cornersOf(i, j).some(c => roundAt.get(c))) continue;
      const x = (sx[i] + sx[i + 1]) / 2, z = (sz[j] + sz[j + 1]) / 2;
      cand.push({ key, x, z, s: heightAt(x, z) + r() * 0.35 });
    }
    cand.sort((a, b) => b.s - a.s);
    const kinds = opts.landmarks || ['spire', 'deco', 'dome', 'stadium'];
    for (const c of cand) {
      if (landmarks.size >= kinds.length) break;
      if ([...landmarks.values()].some(o => Math.hypot(o.x - c.x, o.z - c.z) < 140)) continue;
      landmarks.set(c.key, { kind: kinds[landmarks.size], x: c.x, z: c.z });
    }
  }

  // ---- blocks (a merged superblock is handled once, by its first block)
  for (let i = 0; i < NB; i++) {
    for (let j = 0; j < NB; j++) {
      const key = i + ',' + j, own = owner.get(key);
      if (own === 'skip') continue;
      const blk = own || { x0: sx[i] + HALF, x1: sx[i + 1] - HALF, z0: sz[j] + HALF, z1: sz[j + 1] - HALF };
      const sw = { x0: blk.x0 - SW, x1: blk.x1 + SW, z0: blk.z0 - SW, z1: blk.z1 + SW };
      const diag = splitBlk.get(key) || null;
      const cuts = own ? [] : cornersOf(i, j).map(c => roundAt.get(c)).filter(Boolean);
      if (!own && !diag && !cuts.length && land(i, j)) { landBlock(sw); continue; } // outside the town
      if (diag) { // two triangle halves either side of the avenue
        const P = rectPoly(sw);
        slab(clip(P, (x, z) => diagDist(diag, x, z).d - RW / 2));
        slab(clip(P, (x, z) => -diagDist(diag, x, z).d - RW / 2));
      } else if (cuts.length) slab(cutRect(sw, cuts));
      else { sides(B.roof, sw, 0, CURB, curbCol, PLAIN, 15, false); top(B.walk, sw, CURB, lin('#ffffff'), 4); }
      walkBlocks.push({ x0: blk.x0 - SW * 0.5, x1: blk.x1 + SW * 0.5, z0: blk.z0 - SW * 0.5, z1: blk.z1 + SW * 0.5 });

      if (own && own.kind === 'park') { bigPark(blk); continue; }
      const lm = landmarks.get(key); if (lm && !own && !diag && !cuts.length) { landmark(lm.kind, blk); continue; }
      if (!own && !diag && !cuts.length && r() < 0.05) { // whole-block park
        top(B.grass, blk, CURB + 0.04, lin('#ffffff'), 6);
        const n = Math.floor((blk.x1 - blk.x0) * (blk.z1 - blk.z0) / 45);
        for (let k = 0; k < n; k++) addTree(blk.x0 + 2 + r() * (blk.x1 - blk.x0 - 4), blk.z0 + 2 + r() * (blk.z1 - blk.z0 - 4), CURB, 1.6 + r() * 1.4, 2 + r() * 2);
        open.push(blk);
        crowds.push({ x: (blk.x0 + blk.x1) / 2, z: (blk.z0 + blk.z1) / 2, y: CURB + 0.04, n: 20 + Math.floor(r() * 30), rad: 8 });
        continue;
      }
      let keepOpen = null;
      if (own && own.kind === 'plaza') { // a civic square in the middle with a fountain, buildings around it
        const w = blk.x1 - blk.x0, d = blk.z1 - blk.z0, cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
        keepOpen = { x0: cx - w * 0.24, x1: cx + w * 0.24, z0: cz - d * 0.24, z1: cz + d * 0.24 };
        top(B.walk, keepOpen, CURB + 0.03, lin('#efe3cc'), 4);
        fountains.push({ x: cx, z: cz, R: Math.min(5, Math.min(w, d) * 0.08) });
        for (const [fx, fz] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) addTree(keepOpen.x0 + (keepOpen.x1 - keepOpen.x0) * fx, keepOpen.z0 + (keepOpen.z1 - keepOpen.z0) * fz, CURB, 1.6 + r() * 0.6, 2.5);
        crowds.push({ x: cx, z: cz, y: CURB + 0.03, n: 25 + Math.floor(r() * 25), rad: Math.min(keepOpen.x1 - keepOpen.x0, keepOpen.z1 - keepOpen.z0) * 0.35 });
      }
      const lots = []; split(blk, lots, 0);
      placeLots(lots, blk, diag, cuts, keepOpen);
    }
  }

  // ---- roundabout islands: grass and a curb, a big tree (or the circus fountain and a ring of trees)
  for (const rd of layout.rounds) {
    if (rd.big) {
      fountains.push({ x: rd.x, z: rd.z, R: 5 });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; addTree(rd.x + Math.cos(a) * (rd.ri - 3), rd.z + Math.sin(a) * (rd.ri - 3), CURB, 1.6 + r() * 0.6, 2.4); }
    } else {
      addTree(rd.x, rd.z, CURB, 2.4 + r() * 0.6, 3.2);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; crowns.push({ x: rd.x + Math.cos(a) * (rd.ri - 1.2), z: rd.z + Math.sin(a) * (rd.ri - 1.2), y: CURB + 0.5, s: 0.7 + r() * 0.3, col: pick(GREENS), b: -1 }); }
    }
  }

  // ---- street furniture
  const nearNode = (v, lines) => lines.some(l => Math.abs(v - l) < HALF + 2.5);
  const skip = (x, z) => nearRound(x, z, 1.5) || nearDiag(x, z, 0.6);
  const ruralV = (i, z) => { const j = blockAt(z, sz); return land(i - 1, j) && land(i, j); }, ruralH = (j, x) => { const i = blockAt(x, sx); return land(i, j - 1) && land(i, j); }; // a road with open land both sides
  const lo = sx[0], hi = sx[NB], loz = sz[0], hiz = sz[NB];
  for (let i = 0; i <= NB; i++) {
    const boulevard = r() < 0.5;
    for (const side of [-1, 1]) {
      const off = side * (RW / 2 + 1.1);
      for (let z = loz; z <= hiz; z += 7 + r() * 4) {
        if (nearNode(z, sz) || vGone(i, z) || skip(sx[i] + off, z) || (ruralV(i, z) && rl() < 0.85)) continue;
        if (boulevard && r() < 0.85) addTree(sx[i] + off, z, CURB, 1.5 + r() * 0.9, 2.2 + r() * 1.5);
        else if (r() < 0.12) addTree(sx[i] + off, z, CURB, 1.4 + r() * 0.8, 2.2 + r());
      }
      for (let z = loz + 12; z <= hiz; z += 32) if (!nearNode(z, sz) && !vGone(i, z) && !skip(sx[i] + side * 5.4, z) && !ruralV(i, z)) lamps.push({ x: sx[i] + side * (RW / 2 + 0.4), z, arm: [-side, 0] });
      // parked cars
      for (let z = loz; z <= hiz; z += 5.6) {
        if (nearNode(z, sz) || r() < 0.55 || vGone(i, z) || skip(sx[i] + side * 4.35, z) || ruralV(i, z)) continue;
        parked.push({ x: sx[i] + side * 4.35, z, y: 0, rot: Math.PI / 2 + (side > 0 ? Math.PI : 0) });
      }
    }
  }
  for (let j = 0; j <= NB; j++) {
    const boulevard = r() < 0.5;
    for (const side of [-1, 1]) {
      const off = side * (RW / 2 + 1.1);
      for (let x = lo; x <= hi; x += 7 + r() * 4) {
        if (nearNode(x, sx) || hGone(j, x) || skip(x, sz[j] + off) || (ruralH(j, x) && rl() < 0.85)) continue;
        if (boulevard && r() < 0.85) addTree(x, sz[j] + off, CURB, 1.5 + r() * 0.9, 2.2 + r() * 1.5);
        else if (r() < 0.12) addTree(x, sz[j] + off, CURB, 1.4 + r() * 0.8, 2.2 + r());
      }
      for (let x = lo + 12; x <= hi; x += 32) if (!nearNode(x, sx) && !hGone(j, x) && !skip(x, sz[j] + side * 5.4) && !ruralH(j, x)) lamps.push({ x, z: sz[j] + side * (RW / 2 + 0.4), arm: [0, -side] });
      for (let x = lo; x <= hi; x += 5.6) {
        if (nearNode(x, sx) || r() < 0.55 || hGone(j, x) || skip(x, sz[j] + side * 4.35) || ruralH(j, x)) continue;
        parked.push({ x, z: sz[j] + side * 4.35, y: 0, rot: side > 0 ? 0 : Math.PI });
      }
    }
  }
  // the avenue: a tree-lined boulevard with lamps both sides
  for (const sg of layout.diags) {
    for (const side of [-1, 1]) {
      const nx = -sg.uz * side, nz = sg.ux * side;
      for (let t = HALF + 6; t < sg.L - HALF - 6; t += 8 + r() * 3) if (r() < 0.85) addTree(sg.ax + sg.ux * t + nx * (RW / 2 + 1.1), sg.az + sg.uz * t + nz * (RW / 2 + 1.1), CURB, 1.5 + r() * 0.8, 2.2 + r() * 1.3);
      for (let t = HALF + 12; t < sg.L - HALF - 8; t += 30) lamps.push({ x: sg.ax + sg.ux * t + nx * (RW / 2 + 0.4), z: sg.az + sg.uz * t + nz * (RW / 2 + 0.4), arm: [-nx, -nz] });
    }
  }
  // crosswalks (pushed out past the ring at a roundabout; none where the avenue crosses)
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
    if (r() > 0.45 || diagNodes.has(nid(i, j)) || (land(i - 1, j - 1) && land(i, j - 1) && land(i - 1, j) && land(i, j))) continue;
    const X = sx[i], Z = sz[j], rd = roundAt.get(nid(i, j)), off = rd ? rd.ro + 2 : HALF + 1.6;
    for (const sd of [-1, 1]) {
      // across the road running along x (bars along x, spread along z)
      for (let k = -4; k <= 4; k += 1.1) stripes.push({ x: X + sd * off, z: Z + k, w: 3, d: 0.55 });
      for (let k = -4; k <= 4; k += 1.1) stripes.push({ x: X + k, z: Z + sd * off, w: 0.55, d: 3 });
    }
  }

  // ---- meshes
  const group = new THREE.Group();
  const std = (o) => cutGround(new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o })); // open pits cut through all of it
  // walls darken towards the street: grime and the shade of the pavement, baked into the shading (it costs nothing)
  const walls = (m) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.74 + 0.26 * smoothstep(0.2, 6.0, vHoleW.y);'); }; return m; };
  const nrm = (k) => new THREE.Vector2(k, k);
  const mats = {
    fac: tex.facades.map((m, k) => walls(std({ map: m, normalMap: tex.facadeRelief[k], normalScale: nrm(1.6), vertexColors: true, roughness: 0.85, emissiveMap: tex.facadesLit[k], emissive: '#ffffff', emissiveIntensity: 0 }))),
    shop: walls(std({ map: tex.shop, normalMap: tex.shopRelief, normalScale: nrm(1.6), vertexColors: true, emissiveMap: tex.shopLit, emissive: '#ffffff', emissiveIntensity: 0 })),
    roof: std({ map: tex.roof, normalMap: tex.roofRelief, normalScale: nrm(1.5), vertexColors: true }),
    walk: std({ map: tex.sidewalk, vertexColors: true }),
    grass: std({ map: tex.grass, vertexColors: true, roughness: 1 }),
  };
  const meshes = {};
  const add = (bk, mat, cast = true, key = null) => {
    if (!bk.v) return;
    const m = new THREE.Mesh(bk.geometry(), mat);
    if (key) { meshes[key] = m; m.userData.orig = m.geometry.attributes.color.array.slice(); m.userData.origPos = m.geometry.attributes.position.array.slice(); }
    m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
    group.add(m);
  };
  B.fac.forEach((bk, k) => add(bk, mats.fac[k], true, 'fac' + k));
  add(B.shop, mats.shop, true, 'shop'); add(B.roof, mats.roof, true, 'roof'); add(B.walk, mats.walk, false); add(B.grass, mats.grass, false, 'grass');
  if (slabGeos.length) { const m = new THREE.Mesh(mergeGeometries(slabGeos), mats.walk); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
  const colorize = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let v = 0; v < n; v++) a.set(c, v * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const curbMat = std({ color: '#e2d8c6' });
  for (const rd of layout.rounds) {
    const g = colorize(new THREE.CylinderGeometry(rd.ri, rd.ri, CURB + 0.06, 56), [1, 1, 1]); g.translate(rd.x, (CURB + 0.06) / 2, rd.z);
    const uv = g.attributes.uv, pos = g.attributes.position; for (let v = 0; v < uv.count; v++) uv.setXY(v, pos.getX(v) / 6, -pos.getZ(v) / 6);
    const m = new THREE.Mesh(g, [curbMat, mats.grass, mats.grass]); m.receiveShadow = true; group.add(m);
  }
  if (fountains.length) {
    const stone = [], water = [];
    for (const f of fountains) {
      stone.push(new THREE.CylinderGeometry(f.R, f.R + 0.2, 0.75, 32).translate(f.x, CURB + 0.37, f.z));
      stone.push(new THREE.CylinderGeometry(0.45, 0.7, 2.6, 12).translate(f.x, CURB + 1.3, f.z));
      stone.push(new THREE.CylinderGeometry(1.5, 0.5, 0.4, 16).translate(f.x, CURB + 2.6, f.z));
      water.push(new THREE.CylinderGeometry(f.R - 0.35, f.R - 0.35, 0.06, 32).translate(f.x, CURB + 0.78, f.z));
      water.push(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 16).translate(f.x, CURB + 2.82, f.z));
    }
    const sm = new THREE.Mesh(mergeGeometries(stone), std({ color: '#d8ccb6' })); sm.castShadow = true; sm.receiveShadow = true; group.add(sm);
    group.add(new THREE.Mesh(mergeGeometries(water), std({ color: '#86aeb0', roughness: 0.15, metalness: 0.1, emissive: '#1a2a2c' })));
  }

  // ground (roads everywhere under the blocks)
  const gw = sx[NB] - sx[0] + 72, gd = sz[NB] - sz[0] + 72; // just the city: the land around it is outskirts.js
  const ground = new THREE.PlaneGeometry(gw, gd);
  ground.rotateX(-Math.PI / 2);
  const uv = ground.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * gw / 8, uv.getY(k) * gd / 8);
  const gm = new THREE.Mesh(ground, std({ map: tex.asphalt, color: '#ffffff' }));
  mats.ground = gm.material;
  gm.receiveShadow = true; group.add(gm);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const inst = (geo, mat, list, fn, cast = true) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    im.count = list.length;
    list.forEach((it, k) => { fn(it, k); im.setMatrixAt(k, m4); if (it.col) im.setColorAt(k, col.set(it.col)); });
    im.castShadow = cast; im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
    return im;
  };
  // the same, split into tiles across the city so the camera (and the shadow camera) only draws the tiles it can see;
  // at(k) is where item k ended up: [its tile's mesh, its index there]. Each tile also gets a low-detail stand-in drawn only into the shadow map
  const TILE = 160;
  const instTiled = (geo, mat, list, fn, cast = true, shadowGeo = null) => {
    const mats = list.map((it, k) => { fn(it, k); return m4.clone(); }); // in list order: fn draws random numbers, the city must come out the same
    const tiles = new Map(), at = new Array(list.length);
    list.forEach((it, k) => { const key = Math.floor(it.x / TILE) + ',' + Math.floor(it.z / TILE); let t = tiles.get(key); if (!t) tiles.set(key, (t = [])); at[k] = [t, t.length]; t.push(k); });
    const meshes = [];
    for (const idx of tiles.values()) {
      const im = new THREE.InstancedMesh(geo, mat, idx.length); im.count = idx.length;
      idx.forEach((k, j) => { im.setMatrixAt(j, mats[k]); if (list[k].col) im.setColorAt(j, col.set(list[k].col)); });
      im.castShadow = cast && !shadowGeo; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); group.add(im); meshes.push(im); idx.im = im;
      if (cast && shadowGeo) { const sh = new THREE.InstancedMesh(shadowGeo, mat, idx.length); sh.instanceMatrix = im.instanceMatrix; sh.count = idx.length; sh.castShadow = true; sh.layers.set(1); sh.boundingSphere = im.boundingSphere; group.add(sh); }
    }
    return { meshes, at: (k) => [at[k][0].im, at[k][1]] };
  };
  const crownT = instTiled(crownGeometry(), std({ vertexColors: true, roughness: 1 }), crowns, (c) => {
    e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e);
    m4.compose(p.set(c.x, c.y, c.z), q, s.set(c.s, c.s * (0.8 + r() * 0.3), c.s));
  }, true, new THREE.IcosahedronGeometry(1.05, 1).translate(0.05, 0.25, 0)); // its shadow: one lumpy ball instead of six
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 1, 5); trunkG.translate(0, 0.5, 0);
  const trunkT = instTiled(trunkG, std({ color: '#5a4430' }), trunks, (t) => { q.identity(); m4.compose(p.set(t.x, t.y, t.z), q, s.set(t.s, t.h + 0.6, t.s)); });
  const tankG = new THREE.CylinderGeometry(1, 1, 1, 10); tankG.translate(0, 0.5, 0);
  tanks.forEach(t => { t.col = t.dark ? '#3a3632' : '#e9e4da'; });
  const tankT = instTiled(tankG, std({ color: '#ffffff', roughness: 0.6 }), tanks, (t) => { q.identity(); m4.compose(p.set(t.x, t.y, t.z), q, s.set(t.r, t.h, t.r)); });
  const lampG = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.1, 6.5, 4).translate(0, 3.25, 0),
    new THREE.BoxGeometry(1.4, 0.12, 0.25).translate(0.65, 6.45, 0),
  ]);
  const lampT = instTiled(lampG, std({ color: '#4a4540' }), lamps, (l) => {
    e.set(0, Math.atan2(-l.arm[1], l.arm[0]), 0); q.setFromEuler(e);
    m4.compose(p.set(l.x, CURB, l.z), q, s.set(1, 1, 1));
  });
  const stripeG = new THREE.PlaneGeometry(1, 1); stripeG.rotateX(-Math.PI / 2);
  instTiled(stripeG, std({ color: '#f3ede0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), stripes, (st) => {
    q.identity(); m4.compose(p.set(st.x, 0.02, st.z), q, s.set(st.w, 1, st.d));
  }, false);

  // a spot to stand on building k's roof near (x, z): inside its edge and out of the stair hut (Sean: a hero landed
  // inside one, his head showing over its parapet)
  const roofPoint = (k, x, z) => {
    const b = buildings[k], r = b.roof || b, hu = b.hut, m = 1.3, cl = (v, a, c) => Math.max(a, Math.min(c, v));
    let px = cl(x, r.x0 + 0.8, r.x1 - 0.8), pz = cl(z, r.z0 + 0.8, r.z1 - 0.8);
    if (hu && px > hu.x0 - m && px < hu.x1 + m && pz > hu.z0 - m && pz < hu.z1 + m) { // out of its nearest side that is still on the roof
      const way = [[hu.x0 - m, pz, px - hu.x0 + m], [hu.x1 + m, pz, hu.x1 + m - px], [px, hu.z0 - m, pz - hu.z0 + m], [px, hu.z1 + m, hu.z1 + m - pz]]
        .filter(([qx, qz]) => qx >= r.x0 + 0.4 && qx <= r.x1 - 0.4 && qz >= r.z0 + 0.4 && qz <= r.z1 - 0.4).sort((p, q) => p[2] - q[2]);
      if (way.length) { px = way[0][0]; pz = way[0][1]; }
      else { let bd = -1; for (const qx of [r.x0 + 0.4, r.x1 - 0.4]) for (const qz of [r.z0 + 0.4, r.z1 - 0.4]) { const d = Math.hypot(Math.max(hu.x0 - qx, 0, qx - hu.x1), Math.max(hu.z0 - qz, 0, qz - hu.z1)); if (d > bd) { bd = d; px = qx; pz = qz; } } } // a small roof: its corner furthest from the hut
    }
    return [px, pz];
  };

  // ---------- destruction: buildings can be hidden, lifted out as a separate shell, and replaced by rubble
  const instMeshes = [...crownT.meshes, ...trunkT.meshes, ...tankT.meshes, ...lampT.meshes];
  for (const im of instMeshes) im.userData.orig = im.instanceMatrix.array.slice();
  const bInst = buildings.map(() => []);
  crowns.forEach((c, k) => { if (c.b >= 0) bInst[c.b].push(crownT.at(k)); });
  trunks.forEach((t, k) => { if (t.b >= 0) bInst[t.b].push(trunkT.at(k)); });
  tanks.forEach((t, k) => { if (t.b >= 0) bInst[t.b].push(tankT.at(k)); });
  // street furniture grid (street and park trees, lamps) so storms can rip them out
  const SG = 20, streetGrid = new Map();
  const sgAdd = (x, z, item) => { const key = Math.floor(x / SG) + ',' + Math.floor(z / SG); let a = streetGrid.get(key); if (!a) streetGrid.set(key, (a = [])); a.push(item); };
  crowns.forEach((c, k) => { if (c.b < 0) sgAdd(c.x, c.z, { kind: 'tree', x: c.x, z: c.z, y: c.y, s: c.s, ims: [crownT.at(k)], col: c.col, alive: true }); });
  // pair trunks with the crown at the same spot
  { const byPos = new Map(); for (const a of streetGrid.values()) for (const it of a) byPos.set(it.x.toFixed(2) + ',' + it.z.toFixed(2), it);
    trunks.forEach((t, k) => { if (t.b >= 0) return; const it = byPos.get(t.x.toFixed(2) + ',' + t.z.toFixed(2)); if (it) it.ims.push(trunkT.at(k)); }); }
  lamps.forEach((l, k) => sgAdd(l.x, l.z, { kind: 'lamp', x: l.x, z: l.z, y: CURB, s: 1, ims: [lampT.at(k)], col: '#4a4540', alive: true }));
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  const dead = new Uint8Array(buildings.length);
  const center = (b) => [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
  // building grid for area queries
  const BG = 25, bGrid = new Map();
  buildings.forEach((b, k) => { for (let gx = Math.floor(b.x0 / BG); gx <= Math.floor(b.x1 / BG); gx++) for (let gz = Math.floor(b.z0 / BG); gz <= Math.floor(b.z1 / BG); gz++) { const key = gx + ',' + gz; let a = bGrid.get(key); if (!a) bGrid.set(key, (a = [])); a.push(k); } });
  const buildingsNear = (x, z, R, fn) => {
    const seen = new Set();
    for (let gx = Math.floor((x - R) / BG); gx <= Math.floor((x + R) / BG); gx++) for (let gz = Math.floor((z - R) / BG); gz <= Math.floor((z + R) / BG); gz++) {
      const a = bGrid.get(gx + ',' + gz); if (!a) continue;
      for (const k of a) {
        if (seen.has(k) || dead[k]) continue; seen.add(k);
        const b = buildings[k], cx = Math.min(Math.max(x, b.x0), b.x1), cz = Math.min(Math.max(z, b.z0), b.z1);
        const d = Math.hypot(cx - x, cz - z);
        if (d <= R) fn(k, d, b);
      }
    }
  };
  const hideBuilding = (k) => {
    if (dead[k]) return false; dead[k] = 1;
    const b = buildings[k], [cx, cz] = center(b);
    for (const rg of b.ranges) {
      const m = meshes[rg.key]; if (!m || rg.v1 <= rg.v0) continue;
      const pos = m.geometry.attributes.position, a = pos.array;
      for (let v = rg.v0; v < rg.v1; v++) { a[v * 3] = cx; a[v * 3 + 1] = -30; a[v * 3 + 2] = cz; }
      pos.addUpdateRange(rg.v0 * 3, (rg.v1 - rg.v0) * 3); pos.needsUpdate = true;
    }
    for (const [im, i] of bInst[k]) { im.setMatrixAt(i, zeroM); im.instanceMatrix.needsUpdate = true; }
    return true;
  };
  // a separate copy of one building (its walls, shopfronts, roof and trim) centred on its footprint
  const extractBuilding = (k) => {
    const b = buildings[k], [cx, cz] = center(b);
    const g = new THREE.Group(); g.position.set(cx, 0, cz);
    for (const rg of b.ranges) {
      const m = meshes[rg.key]; if (!m || rg.v1 <= rg.v0) continue;
      const src = m.geometry, n = rg.v1 - rg.v0;
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3);
      const op = m.userData.origPos, sn = src.attributes.normal.array, su = src.attributes.uv.array, sc = src.attributes.color.array;
      for (let i = 0; i < n; i++) {
        const v = rg.v0 + i;
        P[i * 3] = op[v * 3] - cx; P[i * 3 + 1] = op[v * 3 + 1]; P[i * 3 + 2] = op[v * 3 + 2] - cz;
        N[i * 3] = sn[v * 3]; N[i * 3 + 1] = sn[v * 3 + 1]; N[i * 3 + 2] = sn[v * 3 + 2];
        U[i * 2] = su[v * 2]; U[i * 2 + 1] = su[v * 2 + 1];
        C[i * 3] = sc[v * 3]; C[i * 3 + 1] = sc[v * 3 + 1]; C[i * 3 + 2] = sc[v * 3 + 2];
      }
      const idx = new Uint32Array((n / 4) * 6);
      for (let q = 0; q < n / 4; q++) { const o = q * 4, w = q * 6; idx[w] = o; idx[w + 1] = o + 1; idx[w + 2] = o + 2; idx[w + 3] = o; idx[w + 4] = o + 2; idx[w + 5] = o + 3; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
      const mm = new THREE.Mesh(geo, m.material); mm.castShadow = true; g.add(mm);
    }
    g.userData.disposeGeo = true;
    return g;
  };
  // rubble: low heaps of blocks in the building's colours
  const RUB = 6000;
  const rubble = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ roughness: 1 }), RUB);
  rubble.count = 0; rubble.castShadow = true; rubble.receiveShadow = true; rubble.frustumCulled = false;
  rubble.setColorAt(0, new THREE.Color()); group.add(rubble);
  let rubN = 0;
  const addRubble = (k, charred = 0.75) => {
    const b = buildings[k], w = b.x1 - b.x0, d = b.z1 - b.z0, area = w * d, rub0 = rubN;
    const n = Math.min(90, Math.max(10, Math.round(area / 5)));
    const wc = b.wallCol, hgt = Math.min(8, 1.5 + (b.top - b.baseY) * 0.12);
    // a few big slabs make the core of the heap
    for (let i = 0; i < 3 && rubN < RUB; i++) {
      const sw = w * (0.35 + Math.random() * 0.25), sd = d * (0.35 + Math.random() * 0.25), sh = hgt * (0.45 + Math.random() * 0.35);
      e.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35); q.setFromEuler(e);
      m4.compose(p.set(b.x0 + w * (0.35 + Math.random() * 0.3), CURB + sh * 0.35, b.z0 + d * (0.35 + Math.random() * 0.3)), q, s.set(sw, sh, sd));
      rubble.setMatrixAt(rubN, m4);
      const k2 = (0.6 + Math.random() * 0.3) * charred; col.setRGB(wc[0] * k2, wc[1] * k2, wc[2] * k2);
      rubble.setColorAt(rubN, col); rubN++;
    }
    for (let i = 0; i < n && rubN < RUB; i++) {
      const u = Math.random(), v = Math.random(), bs = 0.8 + Math.random() * 2.6;
      const cxr = b.x0 + 0.5 + u * (w - 1), czr = b.z0 + 0.5 + v * (d - 1);
      const edge = Math.min(u, 1 - u, v, 1 - v) * 2; // heaps are higher in the middle
      e.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6); q.setFromEuler(e);
      const sy = (0.4 + Math.random() * 1.2) * (0.5 + edge);
      m4.compose(p.set(cxr, CURB + sy * 0.3 + Math.random() * hgt * edge * 0.6, czr), q, s.set(bs, sy, bs * (0.5 + Math.random())));
      rubble.setMatrixAt(rubN, m4);
      const k2 = (0.55 + Math.random() * 0.45) * charred, grey = Math.random() < 0.3;
      col.setRGB(grey ? 0.45 * k2 : wc[0] * k2, grey ? 0.43 * k2 : wc[1] * k2, grey ? 0.4 * k2 : wc[2] * k2);
      rubble.setColorAt(rubN, col); rubN++;
    }
    rubble.count = rubN; rubble.instanceMatrix.needsUpdate = true; rubble.instanceColor.needsUpdate = true;
    (b.rub || (b.rub = [])).push([rub0, rubN]);
  };
  const clearRubble = (k) => {
    const b = buildings[k]; if (!b.rub) return;
    for (const [a, z] of b.rub) for (let i = a; i < z; i++) rubble.setMatrixAt(i, zeroM);
    b.rub = null; rubble.instanceMatrix.needsUpdate = true;
  };
  // a rebuilt building: its walls, roof, colours and rooftop trees and tanks back as they were
  const restoreBuilding = (k) => {
    const b = buildings[k];
    for (const rg of b.ranges) {
      const m = meshes[rg.key]; if (!m || rg.v1 <= rg.v0) continue;
      const pos = m.geometry.attributes.position, col = m.geometry.attributes.color;
      pos.array.set(m.userData.origPos.subarray(rg.v0 * 3, rg.v1 * 3), rg.v0 * 3); pos.addUpdateRange(rg.v0 * 3, (rg.v1 - rg.v0) * 3); pos.needsUpdate = true;
      col.array.set(m.userData.orig.subarray(rg.v0 * 3, rg.v1 * 3), rg.v0 * 3); col.addUpdateRange(rg.v0 * 3, (rg.v1 - rg.v0) * 3); col.needsUpdate = true;
    }
    for (const [im, i] of bInst[k]) { im.instanceMatrix.array.set(im.userData.orig.subarray(i * 16, i * 16 + 16), i * 16); im.instanceMatrix.needsUpdate = true; }
    clearRubble(k); dead[k] = 0;
  };
  const hidden = [];
  // street trees and lamps within R are ripped out; returns what was taken
  const takeStreetNear = (x, z, R) => {
    const out = [];
    for (let gx = Math.floor((x - R) / SG); gx <= Math.floor((x + R) / SG); gx++) for (let gz = Math.floor((z - R) / SG); gz <= Math.floor((z + R) / SG); gz++) {
      const a = streetGrid.get(gx + ',' + gz); if (!a) continue;
      for (const it of a) {
        if (!it.alive || Math.hypot(it.x - x, it.z - z) > R) continue;
        it.alive = false; hidden.push(it);
        for (const [im, i] of it.ims) { im.setMatrixAt(i, zeroM); im.instanceMatrix.needsUpdate = true; }
        out.push(it);
      }
    }
    return out;
  };
  const restoreAll = () => {
    for (const m of Object.values(meshes)) {
      const col = m.geometry.attributes.color; col.array.set(m.userData.orig); col.clearUpdateRanges(); col.needsUpdate = true;
      const pos = m.geometry.attributes.position; pos.array.set(m.userData.origPos); pos.clearUpdateRanges(); pos.needsUpdate = true;
    }
    for (const im of instMeshes) { im.instanceMatrix.array.set(im.userData.orig); im.instanceMatrix.needsUpdate = true; }
    for (const it of hidden) it.alive = true; hidden.length = 0;
    dead.fill(0); rubN = 0; rubble.count = 0; for (const b of buildings) b.rub = null;
  };

  // darken one building's vertex colours (fire damage); uncharAll restores
  const char = (k, f) => {
    for (const rg of buildings[k].ranges) {
      const m = meshes[rg.key]; if (!m || rg.v1 <= rg.v0) continue;
      const col = m.geometry.attributes.color, a = col.array;
      for (let v = rg.v0 * 3; v < rg.v1 * 3; v++) a[v] *= f;
      col.addUpdateRange(rg.v0 * 3, (rg.v1 - rg.v0) * 3); col.needsUpdate = true;
    }
  };
  const uncharAll = () => {
    for (const m of Object.values(meshes)) { const col = m.geometry.attributes.color; col.array.set(m.userData.orig); col.clearUpdateRanges(); col.needsUpdate = true; }
  };

  return {
    buildings, char, uncharAll, lamps, mats,
    dead, buildingsNear, hideBuilding, extractBuilding, addRubble, clearRubble, restoreBuilding, takeStreetNear, restoreAll,
    group, sx, sz, NB, parked, crowds, walkBlocks, open, layout, nid, roofPoint,
    bounds: { x0: sx[0], x1: sx[NB], z0: sz[0], z1: sz[NB] },
    stats: { crowns: crowns.length, tanks: tanks.length, parked: parked.length, verts: Object.values(B).flat().reduce((a, b) => a + b.v, 0) },
  };
}
