// Quarantine (Commander): a zombie outbreak can be sealed in with police and then
// cleared with a mini nuke. The streets are a coarse grid (4 m cells, walkable or
// not); a cruiser sets up a roadblock where it was sent (12 m round the spot
// tapped, junction and all) and across the street it parked in, and an officer at
// their post holds the street round them. Once a second the zombies' area is flooded out across the grid
// from every zombie, stopping at buildings and at police: if the flood is boxed in
// (and small enough for a mini nuke) that area is sealed and drawn in red. If it
// gets out, the streets out are marked with amber rings about 50 m beyond the
// zombies: a cruiser on each one closes the box. The mini nuke clears only a sealed
// zone, everyone inside it included (in the street, indoors, up on its roofs), chars
// its buildings and leaves no radiation (nobody turns from it). Everyone who was in
// a sealed zone and got out before it went off earns points (Sean: extra points for
// getting people out; anyone still in it dies). A zombie that gets out before it
// goes off has to be boxed in again.
import * as THREE from 'three';
import { ST, KIND } from './people.js';

const C = 4; // grid cell (m)
const HOLD = 8.5, POST = 25; // an officer at their post holds the street this far round them, while within this of the post
const BLOCK = 12; // a roadblock holds this far round the spot the cruiser was sent to
const ACROSS = 15; // a parked cruiser's barricade reaches this far either side of it, until it meets a building
const MAX_ZONE = 2500; // cells: the most one mini nuke can clear (about 200 m across); a bigger box counts as open (a whole town is boxed in by the countryside)
const RING = 9; // cells out from the zombies where the open streets get marked (about 36 m)
const ZST = new Set([ST.ZOMBIE, ST.TURNING, ST.PILE, ST.CLIMB]);

export class Quarantine {
  constructor(g) {
    this.g = g; this.P = null; this.zones = []; this.gaps = []; this.t = 0; this.seen = []; this.said = false;
    this.tracked = new Map(); // healthy people seen inside a sealed zone: their cell there and when (to score the ones who get out)
  }
  // the grid for this town
  build() {
    const P = this.P = this.g.people, B = this.g.city.bounds;
    this.x0 = B.x0 - 40; this.z0 = B.z0 - 40; this.W = Math.ceil((B.x1 - B.x0 + 80) / C); this.H = Math.ceil((B.z1 - B.z0 + 80) / C);
    const N = this.W * this.H; this.walk = new Uint8Array(N); this.blk = new Uint8Array(N); this.comp = new Int32Array(N); this.q = new Int32Array(N); this.mark = new Int32Array(N); this.stamp = 0;
    for (let cz = 0; cz < this.H; cz++) for (let cx = 0; cx < this.W; cx++) {
      const x = this.x0 + (cx + 0.5) * C, z = this.z0 + (cz + 0.5) * C;
      this.walk[cz * this.W + cx] = P.walkable(x, z) || P.walkable(x - 1.3, z) || P.walkable(x + 1.3, z) || P.walkable(x, z - 1.3) || P.walkable(x, z + 1.3) ? 1 : 0;
    }
  }
  cell(x, z) { const cx = Math.floor((x - this.x0) / C), cz = Math.floor((z - this.z0) / C); return cx < 0 || cz < 0 || cx >= this.W || cz >= this.H ? -1 : cz * this.W + cx; }
  at(c) { return [this.x0 + ((c % this.W) + 0.5) * C, this.z0 + (Math.floor(c / this.W) + 0.5) * C]; }
  hold(x, z, R) {
    const W = this.W, c0 = Math.max(0, Math.floor((x - R - this.x0) / C)), c1 = Math.min(W - 1, Math.floor((x + R - this.x0) / C));
    const r0 = Math.max(0, Math.floor((z - R - this.z0) / C)), r1 = Math.min(this.H - 1, Math.floor((z + R - this.z0) / C));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const px = this.x0 + (c + 0.5) * C, pz = this.z0 + (r + 0.5) * C; if ((px - x) ** 2 + (pz - z) ** 2 <= R * R) this.blk[r * W + c] = 1; }
  }
  // a cruiser stopped in a street: a line across it, two cells thick, out to the buildings on either side
  barricade(x, z, hx, hz) {
    const L = Math.hypot(hx, hz) || 1, ax = hx / L, az = hz / L, px = -az, pz = ax;
    for (const a of [-2.5, 0, 2.5]) for (const sg of [1, -1]) for (let t = 0; t <= ACROSS; t++) {
      const c = this.cell(x + ax * a + px * t * sg, z + az * a + pz * t * sg); if (c < 0) break;
      if (!this.walk[c] && t > 4) break; this.blk[c] = 1;
    }
  }
  // a zombie's cell, or the nearest street cell to it (one up on a roof, at a building's edge)
  seedOf(x, z) {
    const c = this.cell(x, z); if (c < 0) return -1; if (this.walk[c]) return c;
    const W = this.W, cx = c % W, cz = Math.floor(c / W);
    for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= this.H) continue;
      const k = nz * W + nx; if (this.walk[k]) return k;
    }
    return c;
  }

  // once a second: who holds which street, where the zombies are, which areas are boxed in and which streets are open
  compute() {
    const g = this.g, P = g.people; if (P !== this.P) this.build();
    const W = this.W, H = this.H, walk = this.walk, blk = this.blk, comp = this.comp, q = this.q;
    blk.fill(0);
    for (let i = 0; i < P.active; i++) {
      const k = P.kind[i];
      if ((k === KIND.OFFICER || k === KIND.SOLDIER) && P.st[i] === ST.COP && Math.hypot(P.x[i] - P.s[i], P.z[i] - P.lat[i]) < POST) this.hold(P.s[i], P.lat[i], HOLD);
    }
    for (const c of g.traffic.missions) if (c.kind === 'police' && !c.gone && (c.mode === 2 || c.mode === 3)) { this.barricade(c.x, c.z, c.hx, c.hz); if (c.post) this.hold(c.post[0], c.post[1], BLOCK); } // stopped or parked: across its street, and round where it was sent
    const seeds = [];
    for (let i = 0; i < P.active; i++) if (ZST.has(P.st[i])) { // up on a roof (or piled against a building): it counts at the building's door
      const b = P.lvl[i] >= 0 ? P.bld[P.lvl[i]] : P.bt[i] >= 0 && (P.st[i] === ST.PILE || P.st[i] === ST.CLIMB) ? P.bld[P.bt[i]] : null, d = b && b.door;
      const c = this.seedOf(d ? d[0] : P.x[i], d ? d[1] : P.z[i]); if (c >= 0 && this.walk[c] && !blk[c]) seeds.push(c); // one in a roadblock is the police's to deal with
    }
    comp.fill(0); this.zones = []; this.gaps = [];
    for (const s0 of seeds) {
      if (comp[s0]) continue;
      const id = this.zones.length + 1; let n = 0, head = 0, sx = 0, sz = 0, edge = false;
      comp[s0] = id; q[n++] = s0;
      while (head < n) {
        const c = q[head++], cx = c % W, cz = (c - cx) / W;
        sx += cx; sz += cz;
        if (cx === 0 || cz === 0 || cx === W - 1 || cz === H - 1 || n > MAX_ZONE) { edge = true; if (cx === 0 || cz === 0 || cx === W - 1 || cz === H - 1) continue; }
        for (const k of [c - 1, c + 1, c - W, c + W]) if (!comp[k] && walk[k] && !blk[k]) { comp[k] = id; q[n++] = k; }
      }
      const zn = { id, n, z: 0, cx: this.x0 + (sx / n + 0.5) * C, cz: this.z0 + (sz / n + 0.5) * C, sealed: !edge, open: edge, cells: null, r: 0 };
      if (!edge) { zn.cells = q.slice(0, n); let r2 = 0; for (const c of zn.cells) { const [x, z] = this.at(c); r2 = Math.max(r2, (x - zn.cx) ** 2 + (z - zn.cz) ** 2); } zn.r = Math.sqrt(r2) + C; }
      this.zones.push(zn);
    }
    for (const s of seeds) this.zones[comp[s] - 1].z++;
    // the open ones: the streets out, about RING cells beyond their zombies
    for (const zn of this.zones) {
      if (!zn.open) continue;
      const st = ++this.stamp, mark = this.mark; let n = 0, head = 0, layerEnd;
      for (const s of seeds) if (comp[s] === zn.id && mark[s] !== st) { mark[s] = st; q[n++] = s; }
      for (let d = 0; d < RING && head < n; d++) {
        layerEnd = n;
        while (head < layerEnd) { const c = q[head++]; for (const k of [c - 1, c + 1, c - W, c + W]) if (k >= 0 && k < W * H && mark[k] !== st && walk[k] && !blk[k]) { mark[k] = st; q[n++] = k; } }
      }
      const front = []; for (let k = head; k < n; k++) front.push(q[k]); // the last layer reached
      const out = [];
      for (const c of front) {
        const [x, z] = this.at(c); let m = null;
        for (const o of out) if (Math.hypot(o.sx / o.n - x, o.sz / o.n - z) < BLOCK * 1.5) { m = o; break; }
        if (m) { m.sx += x; m.sz += z; m.n++; } else out.push({ sx: x, sz: z, n: 1 });
      }
      // each on the nearest junction within 22 m (a cruiser there closes every street through it), the same junction once
      const nodes = g.traffic.nodes || [], snap = (o) => { let best = null, bd = 22 * 22; for (const nd of nodes) { const d = (nd.x - o.x) ** 2 + (nd.z - o.z) ** 2; if (d < bd) { bd = d; best = nd; } } return best ? { x: best.x, z: best.z } : o; };
      const snapped = []; for (const o of out.map(o => snap({ x: o.sx / o.n, z: o.sz / o.n }))) if (!snapped.some(q => Math.hypot(q.x - o.x, q.z - o.z) < 10)) snapped.push(o);
      zn.gaps = snapped.sort((a, b) => Math.hypot(a.x - zn.cx, a.z - zn.cz) - Math.hypot(b.x - zn.cx, b.z - zn.cz)).slice(0, 16);
      this.gaps.push(...zn.gaps);
    }
    this.track();
  }
  // the healthy people in each sealed zone (in its streets, or in or on a building whose door opens onto it)
  track() {
    const P = this.P, comp = this.comp;
    for (const zn of this.zones) zn.people = 0;
    if (!this.zones.some(zn => zn.sealed)) return;
    for (let j = 0; j < P.nHuman; j++) {
      const s = P.st[j]; if (P.kind[j] !== KIND.CIVILIAN || P.inf[j] || s === ST.DEAD || s === ST.EVAC || ZST.has(s)) continue;
      const k = s === ST.INSIDE ? P.bt[j] : P.lvl[j], b = k >= 0 ? P.bld[k] : null, d = b && b.door;
      const c = d ? this.seedOf(d[0], d[1]) : this.cell(P.x[j], P.z[j]); if (c < 0) continue;
      const id = comp[c], zn = id ? this.zones[id - 1] : null; if (!zn || !zn.sealed) continue;
      zn.people++; this.tracked.set(j, [c, this.g.simT]);
    }
  }
  // inside a sealed zone (the police let nobody in on an errand)
  closed(x, z) { if (!this.zones.length || this.P !== this.g.people) return false; const c = this.seedOf(x, z); if (c < 0) return false; const zn = this.comp[c] ? this.zones[this.comp[c] - 1] : null; return !!zn && zn.sealed; }
  // the zone tapped: its cell, or one within two cells (a tap on a kerb or a building's edge)
  zoneAt(x, z) {
    const c = this.cell(x, z); if (c < 0) return null; if (this.comp[c]) return this.zones[this.comp[c] - 1] || null;
    const W = this.W; for (let r = 1; r <= 2; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const k = c + dz * W + dx; if (k >= 0 && k < this.comp.length && this.comp[k]) return this.zones[this.comp[k] - 1] || null; }
    return null;
  }

  // ---------- each frame (from Commander.update)
  step(dt) {
    const g = this.g, P = g.people; if (!P) return;
    P.holdPosts = P.stats.zombies > 12; P.quar = this; // an outbreak on: officers keep to their posts (the cordon holds) until the last dozen, then hunt them down; lives.go asks closed()
    if ((this.t -= dt) <= 0) { this.t = 1; if (P.stats.zombies > 0) { this.compute(); this.news(); } else if (this.zones.length) { this.zones = []; this.gaps = []; } this.draw(); }
    if (this.gapMesh && this.gapMesh.visible) this.gapMat.opacity = 0.55 + Math.sin(performance.now() / 220) * 0.3; // the open streets blink
  }
  // what the commander hears: an outbreak to box in, a zone sealed, a zone broken out of
  news() {
    const g = this.g, D = g.disasters, now = [];
    if (!this.said && this.zones.length) { this.said = true; g.toast('Box the outbreak in: a police car on every amber ring seals the streets out, then a mini nuke clears the red zone', 6500); }
    // one message at a time, and not again for the same spot for a while (zones flicker as zombies come and go at a roadblock)
    const T = g.simT, told = (this.told || []).filter(o => T - o.t < 30), fresh = (what, x, z) => !told.some(o => o.what === what && Math.hypot(o.x - x, o.z - z) < 80);
    let said = false;
    for (const zn of [...this.zones].sort((a, b) => b.z - a.z)) {
      const was = this.seen.find(o => Math.hypot(o.x - zn.cx, o.z - zn.cz) < 60);
      if (!said && zn.sealed && zn.z >= 2 && (!was || !was.sealed) && fresh('sealed', zn.cx, zn.cz)) { said = true; told.push({ what: 'sealed', x: zn.cx, z: zn.cz, t: T }); g.toast('Quarantine sealed in the ' + D.district(zn.cx, zn.cz) + ' district: ' + zn.z + ' zombies' + (zn.people ? ' and ' + zn.people + (zn.people === 1 ? ' person' : ' people') + ' boxed in. Get the people out for points (an evac bus), then mini nuke it' : ' boxed in. Mini nuke it'), 6000); }
      if (!said && !zn.sealed && was && was.sealed && fresh('broke', zn.cx, zn.cz)) { said = true; told.push({ what: 'broke', x: zn.cx, z: zn.cz, t: T }); g.toast('Zombies broke out of the quarantine in the ' + D.district(zn.cx, zn.cz) + ' district! Box them in again', 5000); }
      now.push({ x: zn.cx, z: zn.cz, sealed: zn.sealed });
    }
    this.seen = now; this.told = told;
  }
  // the red zones (fill and edge), the amber rings on the open streets
  draw() {
    const D = this.g.disasters, scene = D && D.ctx.scene; if (!scene) return;
    if (!this.fill || this.fill.parent !== scene) {
      this.fillMat = new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
      this.edgeMat = new THREE.MeshBasicMaterial({ color: '#ff3a24', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
      this.fill = new THREE.Mesh(new THREE.BufferGeometry(), this.fillMat); this.edge = new THREE.Mesh(new THREE.BufferGeometry(), this.edgeMat);
      this.fill.renderOrder = 3; this.edge.renderOrder = 4; this.fill.frustumCulled = this.edge.frustumCulled = false;
      this.gapMat = new THREE.MeshBasicMaterial({ color: '#ffb23a', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
      this.gapMesh = new THREE.InstancedMesh(new THREE.RingGeometry(4.2, 5.6, 32).rotateX(-Math.PI / 2), this.gapMat, 48); this.gapMesh.renderOrder = 4; this.gapMesh.frustumCulled = false;
      scene.add(this.fill, this.edge, this.gapMesh);
    }
    const F = [], E = [], W = this.W, y = 0.7, ye = 0.75, w = 0.8; // over the pavements and kerbs
    for (const zn of this.zones) {
      if (!zn.cells) continue;
      const id = zn.id, comp = this.comp;
      for (const c of zn.cells) {
        const [x, z] = this.at(c), h = C / 2;
        F.push(x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z - h, x + h, y, z + h, x - h, y, z + h);
        const side = (k, ax, az, bx, bz) => { if (comp[k] === id) return; const nx = az - bz, nz = bx - ax, L = Math.hypot(nx, nz), ox = nx / L * w, oz = nz / L * w; E.push(ax, ye, az, bx, ye, bz, bx + ox, ye, bz + oz, ax, ye, az, bx + ox, ye, bz + oz, ax + ox, ye, az + oz); };
        side(c - 1, x - h, z + h, x - h, z - h); side(c + 1, x + h, z - h, x + h, z + h); side(c - W, x - h, z - h, x + h, z - h); side(c + W, x + h, z + h, x - h, z + h);
      }
    }
    const set = (m, arr) => { m.geometry.dispose(); m.geometry = new THREE.BufferGeometry(); m.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); m.visible = arr.length > 0; };
    set(this.fill, F); set(this.edge, E);
    const M = new THREE.Matrix4(), n = Math.min(48, this.gaps.length);
    for (let k = 0; k < n; k++) { M.makeTranslation(this.gaps[k].x, 0.8, this.gaps[k].z); this.gapMesh.setMatrixAt(k, M); }
    this.gapMesh.count = n; this.gapMesh.instanceMatrix.needsUpdate = true; this.gapMesh.visible = n > 0;
  }

  // ---------- the mini nuke: clears a sealed zone (true: it went off)
  nuke(zn) {
    const g = this.g, P = g.people, D = g.disasters, comp = this.comp, blk = this.blk, W = this.W;
    // inside: in a zone cell, or a step out from it where no officer holds the street (the cordon itself is spared)
    const inside = (x, z) => { const c = this.cell(x, z); if (c < 0) return false; if (comp[c] === zn.id) return true; if (blk[c]) return false; for (const k of [c - 1, c + 1, c - W, c + W, c - W - 1, c - W + 1, c + W - 1, c + W + 1]) if (comp[k] === zn.id) return true; return false; };
    const hitB = new Uint8Array(P.bld.length); // its buildings: the door or the middle in it
    P.bld.forEach((b, k) => { if (inside((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) || (b.door && inside(b.door[0], b.door[1]))) hitB[k] = 1; });
    const hit = (j) => { const s = P.st[j]; if (s === ST.INSIDE) return P.bt[j] >= 0 && hitB[P.bt[j]] === 1; if (P.lvl[j] >= 0) return hitB[P.lvl[j]] === 1; return inside(P.x[j], P.z[j]); }; // anyone in it dies: in the street, indoors, up on a roof
    // the ones who were boxed in here and got out (gone off on a bus or a stolen car, or simply out past the police), alive and unbitten
    let saved = 0;
    for (const [j, at] of this.tracked) {
      if (g.simT - at[1] > 60) { this.tracked.delete(j); continue; } // not seen in a sealed zone for a minute
      if (comp[at[0]] !== zn.id) continue; // seen in another zone, not this one
      const s = P.st[j]; if (s !== ST.DEAD && !P.inf[j] && !ZST.has(s) && P.kind[j] === KIND.CIVILIAN && (s === ST.EVAC || !hit(j))) saved++;
      this.tracked.delete(j);
    }
    const res = P.nukeIf(hit, zn.cx, zn.cz, zn.r, true); res.saved = saved;
    P.bld.forEach((b, k) => { if (hitB[k]) { g.city.char(k, 0.22); if (g.fire.bFire[k] === 1) g.fire.extinguish(k); g.fire.bFire[k] = 2; g.fire.soaked[k] = g.fire.simT + 1e9; } });
    D.mushroom(zn.cx, zn.cz, Math.max(40, zn.r * 0.8));
    g.fire.spray(zn.cx, zn.cz, 1, 40, zn.r, 4);
    g.flash = 0.5; g.shake = 1.6; // a flash that leaves the picture readable
    D.events.push({ type: 'nukeflash', x: zn.cx, z: zn.cz });
    this.t = 0; // look again straight away
    return res;
  }
}
