// Procedural miniature city: street grid, lots, mid-rise buildings with
// shopfronts, setbacks, balconies, parapets and rooftop clutter, parks,
// plazas, street trees, lamps and crosswalks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

export const RW = 10;          // road width (curb to curb)
export const SW = 3;           // sidewalk width
export const HALF = RW / 2 + SW; // street corridor half width
export const CURB = 0.18;      // sidewalk height
export const LANE = 2.5;       // lane offset from road centre
const GF = 4, FH = 3;          // ground floor and upper floor heights

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const toWhite = (c, k) => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];

const WALLS = ['#e8c79a', '#d9a978', '#f0dcb8', '#c98f62', '#e3cba4', '#d6b98e', '#cfae84', '#c9a57a', '#dcc39b', '#bf9b72', '#e8d6b5', '#c7a07a',
  '#d9b48a', '#b99573', '#e0c7a6', '#cdb08f', '#ece2cf', '#d4a98c', '#c2a184', '#e6cfa8'];
const ROOFS = ['#d3c7b0', '#c8b99d', '#d9cbae', '#bfae92', '#cdbda3'];
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

export function buildCity(tex, opts = {}) {
  const r = rng(opts.seed ?? 20261025);
  const NB = opts.blocks ?? 12;
  const pick = (a) => a[Math.floor(r() * a.length)];

  // ---- street grid
  const sx = [0], sz = [0];
  for (let i = 0; i < NB; i++) { sx.push(sx[i] + 2 * HALF + 34 + r() * 30); sz.push(sz[i] + 2 * HALF + 34 + r() * 30); }
  const ox = sx[NB] / 2, oz = sz[NB] / 2;
  for (let i = 0; i <= NB; i++) { sx[i] -= ox; sz[i] -= oz; }

  const B = {
    fac: [new Bucket(), new Bucket(), new Bucket(), new Bucket()],
    shop: new Bucket(), roof: new Bucket(), walk: new Bucket(), grass: new Bucket(),
  };
  const crowns = [], trunks = [], tanks = [], lamps = [], stripes = [], parked = [], crowds = [], walkBlocks = [];

  // downtown clusters
  const centers = [];
  for (let k = 0; k < 3; k++) centers.push([(r() - 0.5) * sx[NB] * 1.2, (r() - 0.5) * sz[NB] * 1.2, 90 + r() * 90]);
  const heightAt = (x, z) => {
    let h = 0;
    for (const [cx, cz, s] of centers) h = Math.max(h, Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s)));
    return h;
  };

  const addTree = (x, z, y, s, trunkH) => {
    trunks.push({ x, z, y, h: trunkH, s: s * 0.5 });
    crowns.push({ x, y: y + trunkH + s * 0.75, z, s, col: pick(GREENS) });
  };

  function parapet(b, y, col, hgt = 0.9) {
    const t = 0.35;
    const c = shade(col, 0.95);
    box(B.roof, { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + t }, y, y + hgt, c);
    box(B.roof, { x0: b.x0, x1: b.x1, z0: b.z1 - t, z1: b.z1 }, y, y + hgt, c);
    box(B.roof, { x0: b.x0, x1: b.x0 + t, z0: b.z0 + t, z1: b.z1 - t }, y, y + hgt, c);
    box(B.roof, { x0: b.x1 - t, x1: b.x1, z0: b.z0 + t, z1: b.z1 - t }, y, y + hgt, c);
  }

  function roofStuff(t, y, wallCol) {
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
      top(B.roof, rp(Math.min(pw, w - 2 * m), Math.min(pd, d - 2 * m)), y + 0.05, lin(pick(RUST)));
    }
    if (r() < 0.7 && w > 7 && d > 7) { // stair / lift hut
      const hb = rp(2.4 + r() * 1.4, 2.4 + r() * 1.8);
      const hh = 2.5 + r() * 0.6;
      box(B.roof, hb, y, y + hh, toWhite(wallCol, 0.15));
      parapet(hb, y + hh, toWhite(wallCol, 0.1), 0.35);
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
        tanks.push({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, y, r: rr, h: 1.0 + r() * 1.0, dark: r() < 0.5 });
      }
    }
    if (r() < 0.55) { // roof garden
      if (r() < 0.6) top(B.grass, rp(w * 0.5, d * 0.4), y + 0.06, lin('#a0a070'), 6);
      const n = 2 + Math.floor(r() * Math.min(14, area / 20));
      for (let k = 0; k < n; k++) {
        const s = 0.45 + r() * 0.7; const p = rp(s * 2, s * 2);
        crowns.push({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, y: y + s * 0.7, s, col: pick(GREENS) });
      }
      if (r() < 0.3 && w > 8 && d > 8) { const p = rp(4, 4); addTree((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, y, 1.4 + r() * 0.8, 1.2); }
    }
    if (r() < 0.3) { // clutter: crates, sheds
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) { const s = 0.6 + r() * 1.6; box(B.roof, rp(s, s * (0.5 + r())), y, y + 0.4 + r() * 1.2, lin(pick(['#9b7f60', '#b8a385', '#8c8a80', '#c9b79a']))); }
    }
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

  function building(lot, interior) {
    const ins = r() < 0.75 ? 0.12 : 0.4 + r() * 1.4;
    const b = { x0: lot.x0 + ins, x1: lot.x1 - ins, z0: lot.z0 + ins, z1: lot.z1 - ins };
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (w < 3.5 || d < 3.5) return;
    const hf = heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    let fl; const q = r();
    if (q < 0.38) fl = 1 + Math.floor(r() * 3);
    else if (q < 0.88) fl = 3 + Math.floor(r() * 4);
    else fl = 7 + Math.floor(r() * 6);
    fl = Math.max(1, Math.round(fl * (0.8 + hf * 0.8)));
    if (interior) fl = Math.max(1, Math.round(fl * 0.6));
    fl = Math.min(fl, Math.floor(Math.min(w, d) * 0.9), 16);
    const sq = r();
    const style = fl >= 9 ? (sq < 0.25 ? 1 : sq < 0.7 ? 0 : 2) : (sq < 0.45 ? 0 : sq < 0.72 ? 2 : sq < 0.93 ? 3 : 1);
    const col = lin(pick(WALLS));
    const y0 = CURB;
    sides(B.shop, b, y0, y0 + GF, toWhite(col, 0.35), { su: 24, sv: GF, v0: y0 });
    const h = y0 + GF + fl * FH;
    sides(B.fac[style], b, y0 + GF, h, col, { su: 12, sv: 12, v0: y0 + GF });
    top(B.roof, b, h, lin(pick(ROOFS)));
    if (style === 3) box(B.roof, { x0: b.x0 - 0.3, x1: b.x1 + 0.3, z0: b.z0 - 0.3, z1: b.z1 + 0.3 }, h - 0.5, h, toWhite(col, 0.2));
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
    roofStuff({ x0: tr.x0 + 0.35, x1: tr.x1 - 0.35, z0: tr.z0 + 0.35, z1: tr.z1 - 0.35 }, th, col);
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

  // ---- blocks
  for (let i = 0; i < NB; i++) {
    for (let j = 0; j < NB; j++) {
      const blk = { x0: sx[i] + HALF, x1: sx[i + 1] - HALF, z0: sz[j] + HALF, z1: sz[j + 1] - HALF };
      const sw = { x0: blk.x0 - SW, x1: blk.x1 + SW, z0: blk.z0 - SW, z1: blk.z1 + SW };
      sides(B.roof, sw, 0, CURB, lin('#e2d8c6'), PLAIN, 15, false);
      top(B.walk, sw, CURB, lin('#ffffff'), 4);
      walkBlocks.push({ x0: blk.x0 - SW * 0.5, x1: blk.x1 + SW * 0.5, z0: blk.z0 - SW * 0.5, z1: blk.z1 + SW * 0.5 });

      if (r() < 0.05) { // whole-block park
        top(B.grass, blk, CURB + 0.04, lin('#ffffff'), 6);
        const n = Math.floor((blk.x1 - blk.x0) * (blk.z1 - blk.z0) / 45);
        for (let k = 0; k < n; k++) addTree(blk.x0 + 2 + r() * (blk.x1 - blk.x0 - 4), blk.z0 + 2 + r() * (blk.z1 - blk.z0 - 4), CURB, 1.6 + r() * 1.4, 2 + r() * 2);
        crowds.push({ x: (blk.x0 + blk.x1) / 2, z: (blk.z0 + blk.z1) / 2, y: CURB + 0.04, n: 20 + Math.floor(r() * 30), rad: 8 });
        continue;
      }
      const lots = []; split(blk, lots, 0);
      const e = 0.01;
      for (const lot of lots) {
        const interior = lot.x0 > blk.x0 + e && lot.x1 < blk.x1 - e && lot.z0 > blk.z0 + e && lot.z1 < blk.z1 - e;
        const area = (lot.x1 - lot.x0) * (lot.z1 - lot.z0);
        const k = r();
        if (k < 0.05 && !interior) {
          top(B.walk, lot, CURB + 0.03, lin('#f4ead8'), 4);
          const n = 1 + Math.floor(r() * 4);
          for (let t = 0; t < n; t++) addTree(lot.x0 + 2 + r() * (lot.x1 - lot.x0 - 4), lot.z0 + 2 + r() * (lot.z1 - lot.z0 - 4), CURB, 1.5 + r(), 2.5);
          crowds.push({ x: (lot.x0 + lot.x1) / 2, z: (lot.z0 + lot.z1) / 2, y: CURB + 0.03, n: 10 + Math.floor(r() * 30), rad: Math.min(lot.x1 - lot.x0, lot.z1 - lot.z0) * 0.35 });
        } else if (k < 0.08) {
          top(B.grass, lot, CURB + 0.04, lin('#ffffff'), 6);
          const n = 1 + Math.floor(area / 60);
          for (let t = 0; t < n; t++) addTree(lot.x0 + 1.5 + r() * (lot.x1 - lot.x0 - 3), lot.z0 + 1.5 + r() * (lot.z1 - lot.z0 - 3), CURB, 1.3 + r() * 1.2, 1.8 + r() * 2);
        } else if (k < 0.13 && area > 250 && !interior) {
          parkingLot(lot);
        } else {
          building(lot, interior);
        }
      }
    }
  }

  // ---- street furniture
  const nearNode = (v, lines) => lines.some(l => Math.abs(v - l) < HALF + 2.5);
  const lo = sx[0], hi = sx[NB], loz = sz[0], hiz = sz[NB];
  for (let i = 0; i <= NB; i++) {
    const boulevard = r() < 0.5;
    for (const side of [-1, 1]) {
      const off = side * (RW / 2 + 1.1);
      for (let z = loz; z <= hiz; z += 7 + r() * 4) {
        if (nearNode(z, sz)) continue;
        if (boulevard && r() < 0.85) addTree(sx[i] + off, z, CURB, 1.5 + r() * 0.9, 2.2 + r() * 1.5);
        else if (r() < 0.12) addTree(sx[i] + off, z, CURB, 1.4 + r() * 0.8, 2.2 + r());
      }
      for (let z = loz + 12; z <= hiz; z += 32) if (!nearNode(z, sz)) lamps.push({ x: sx[i] + side * (RW / 2 + 0.4), z, arm: [-side, 0] });
      // parked cars
      for (let z = loz; z <= hiz; z += 5.6) {
        if (nearNode(z, sz) || r() < 0.55) continue;
        parked.push({ x: sx[i] + side * 4.1, z, y: 0, rot: Math.PI / 2 + (side > 0 ? Math.PI : 0) });
      }
    }
  }
  for (let j = 0; j <= NB; j++) {
    const boulevard = r() < 0.5;
    for (const side of [-1, 1]) {
      const off = side * (RW / 2 + 1.1);
      for (let x = lo; x <= hi; x += 7 + r() * 4) {
        if (nearNode(x, sx)) continue;
        if (boulevard && r() < 0.85) addTree(x, sz[j] + off, CURB, 1.5 + r() * 0.9, 2.2 + r() * 1.5);
        else if (r() < 0.12) addTree(x, sz[j] + off, CURB, 1.4 + r() * 0.8, 2.2 + r());
      }
      for (let x = lo + 12; x <= hi; x += 32) if (!nearNode(x, sx)) lamps.push({ x, z: sz[j] + side * (RW / 2 + 0.4), arm: [0, -side] });
      for (let x = lo; x <= hi; x += 5.6) {
        if (nearNode(x, sx) || r() < 0.55) continue;
        parked.push({ x, z: sz[j] + side * 4.1, y: 0, rot: side > 0 ? 0 : Math.PI });
      }
    }
  }
  // crosswalks
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
    if (r() > 0.45) continue;
    const X = sx[i], Z = sz[j];
    for (const s of [-1, 1]) {
      // across the road running along x (bars along x, spread along z)
      for (let k = -4; k <= 4; k += 1.1) stripes.push({ x: X + s * (HALF + 1.6), z: Z + k, w: 3, d: 0.55 });
      for (let k = -4; k <= 4; k += 1.1) stripes.push({ x: X + k, z: Z + s * (HALF + 1.6), w: 0.55, d: 3 });
    }
  }

  // ---- meshes
  const group = new THREE.Group();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const mats = {
    fac: tex.facades.map(m => std({ map: m, vertexColors: true, roughness: 0.85 })),
    shop: std({ map: tex.shop, vertexColors: true }),
    roof: std({ map: tex.roof, vertexColors: true }),
    walk: std({ map: tex.sidewalk, vertexColors: true }),
    grass: std({ map: tex.grass, vertexColors: true, roughness: 1 }),
  };
  const add = (bk, mat, cast = true) => {
    if (!bk.v) return;
    const m = new THREE.Mesh(bk.geometry(), mat);
    m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
    group.add(m);
  };
  B.fac.forEach((bk, k) => add(bk, mats.fac[k]));
  add(B.shop, mats.shop); add(B.roof, mats.roof); add(B.walk, mats.walk, false); add(B.grass, mats.grass, false);

  // ground (roads everywhere under the blocks)
  const ground = new THREE.PlaneGeometry(4000, 4000);
  ground.rotateX(-Math.PI / 2);
  const uv = ground.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 500, uv.getY(k) * 500);
  const gm = new THREE.Mesh(ground, std({ map: tex.asphalt, color: '#ffffff' }));
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
  inst(crownGeometry(), std({ vertexColors: true, roughness: 1 }), crowns, (c) => {
    e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e);
    m4.compose(p.set(c.x, c.y, c.z), q, s.set(c.s, c.s * (0.8 + r() * 0.3), c.s));
  });
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 1, 5); trunkG.translate(0, 0.5, 0);
  inst(trunkG, std({ color: '#5a4430' }), trunks, (t) => { q.identity(); m4.compose(p.set(t.x, t.y, t.z), q, s.set(t.s, t.h + 0.6, t.s)); });
  const tankG = new THREE.CylinderGeometry(1, 1, 1, 10); tankG.translate(0, 0.5, 0);
  tanks.forEach(t => { t.col = t.dark ? '#3a3632' : '#e9e4da'; });
  inst(tankG, std({ color: '#ffffff', roughness: 0.6 }), tanks, (t) => { q.identity(); m4.compose(p.set(t.x, t.y, t.z), q, s.set(t.r, t.h, t.r)); });
  const lampG = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.1, 6.5, 4).translate(0, 3.25, 0),
    new THREE.BoxGeometry(1.4, 0.12, 0.25).translate(0.65, 6.45, 0),
  ]);
  inst(lampG, std({ color: '#4a4540' }), lamps, (l) => {
    e.set(0, Math.atan2(-l.arm[1], l.arm[0]), 0); q.setFromEuler(e);
    m4.compose(p.set(l.x, CURB, l.z), q, s.set(1, 1, 1));
  });
  const stripeG = new THREE.PlaneGeometry(1, 1); stripeG.rotateX(-Math.PI / 2);
  inst(stripeG, std({ color: '#f3ede0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), stripes, (st) => {
    q.identity(); m4.compose(p.set(st.x, 0.02, st.z), q, s.set(st.w, 1, st.d));
  }, false);

  return {
    group, sx, sz, NB, parked, crowds, walkBlocks,
    bounds: { x0: sx[0], x1: sx[NB], z0: sz[0], z1: sz[NB] },
    stats: { crowns: crowns.length, tanks: tanks.length, parked: parked.length, verts: Object.values(B).flat().reduce((a, b) => a + b.v, 0) },
  };
}
