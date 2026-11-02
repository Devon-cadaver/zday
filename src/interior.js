// The inside of a building a hero smashes into (Sean). Every building in the city is one hollow shell merged into the
// city's big meshes, which is what keeps the frame rate up; floors in all of them would cost a lot and show nowhere. So
// the moment the hero bursts in, that one building is lifted out of the city mesh into its own group (city.liftBuilding:
// the same copy a falling building gets) and given an inside: a floor slab every storey as a grid of tiles, a row of
// columns, a few boxes of furniture (desks and shelves in the tall downtown blocks, beds, tables and wardrobes in the
// rest), and a dark hole where the hero came in. The shell's walls are drawn back-face only while the inside exists: from
// outside you look in through the near wall, like a doll's house, and the far walls stay as the backdrop. Flying on
// through it, the hero punches holes in the tiles and flings the furniture (step). When the building comes down the
// inside rides the same fall (it is in the same group, which disasters.destroyBuilding takes as its shell) and is freed
// with it. One or two buildings at a time, a few hundred triangles.
import * as THREE from 'three';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lit = (col, rough = 0.85) => new THREE.MeshStandardMaterial({ color: col, roughness: rough, emissive: col, emissiveIntensity: 0.28 }); // the sun can't reach under the roof: a little glow of their own
const MAT = { slab: lit('#b9b2a4'), column: lit('#6d6861', 0.7), stuff: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, emissive: '#ffffff', emissiveIntensity: 0.22 }), hole: new THREE.MeshBasicMaterial({ color: '#0b0908', side: THREE.DoubleSide }) };
const HOLE = new THREE.CircleGeometry(1.1, 18);
const OFFICE = [0xe8e4dc, 0xbfc7cf, 0x4f6f8f, 0x8a8f96, 0xd8c7a8], HOME = [0x9a6b45, 0xc9b79a, 0x6f8f6a, 0x8c4a3f, 0xe3dccb, 0x5a6b8a];
const TILE = 3, cloned = new WeakMap(); // a back-face copy of each city wall material (its shader hook kept), made once
const backSide = (m) => { let c = cloned.get(m); if (!c) { c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.side = THREE.BackSide; cloned.set(m, c); } return c; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Interior {
  // the building k, entered at (x, y, z) heading (fx, fz)
  constructor(D, k, x, y, z, fx, fz) {
    const { city, scene, low } = D.ctx, b = city.buildings[k];
    this.D = D; this.k = k; this.b = b; this.alive = true;
    const g = this.g = city.liftBuilding(k); g.traverse((m) => { if (m.isMesh && m.material) m.material = backSide(m.material); });
    const cx = g.position.x, cz = g.position.z, w = b.x1 - b.x0, d = b.z1 - b.z0, hgt = b.roofY - b.baseY, fl = Math.max(1, b.fl || 1), sh = hgt / fl;
    const office = hgt > 30 || (b.landmark && b.landmark !== 'Temple'), pal = office ? OFFICE : HOME;
    // tiles: a floor every storey (not the ground, not the roof), inset from the walls
    const items = this.items = []; // { kind, x, y, z, sx, sy, sz, col, on, i (instance) }
    if (!b.landmark || b.landmark === 'City hall') {
      const nx = Math.max(1, Math.round((w - 0.8) / TILE)), nz = Math.max(1, Math.round((d - 0.8) / TILE)), tx = (w - 0.8) / nx, tz = (d - 0.8) / nz;
      for (let f = 1; f < fl; f++) { const y = b.baseY + f * sh; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) items.push({ kind: 'tile', x: b.x0 + 0.4 + (i + 0.5) * tx, y: y - 0.15, z: b.z0 + 0.4 + (j + 0.5) * tz, sx: tx - 0.06, sy: 0.3, sz: tz - 0.06 }); }
      // columns on a grid, the full height
      for (let x = b.x0 + 3; x < b.x1 - 2; x += 6) for (let z = b.z0 + 3; z < b.z1 - 2; z += 6) items.push({ kind: 'col', x, y: b.baseY + hgt / 2, z, sx: 0.5, sy: hgt, sz: 0.5 });
      // furniture on every floor, the ground floor too: a few boxes per 30 square metres (fewer on a weak phone)
      const per = Math.max(2, Math.round(w * d / (low ? 50 : 30)));
      for (let f = 0; f < fl; f++) { const y = b.baseY + f * sh; for (let n = 0; n < per; n++) {
        const r = Math.random(), col = pal[Math.floor(Math.random() * pal.length)];
        const sz = office ? (r < 0.6 ? [1.5, 0.75, 0.8] : r < 0.85 ? [0.45, 2, 1.2] : [0.7, 0.9, 0.7]) : (r < 0.35 ? [1.6, 0.6, 2.1] : r < 0.6 ? [1.3, 0.75, 0.9] : r < 0.8 ? [0.6, 2, 1.1] : [0.8, 0.9, 0.8]);
        items.push({ kind: 'stuff', x: b.x0 + 1 + Math.random() * (w - 2), y: y + sz[1] / 2 + 0.05, z: b.z0 + 1 + Math.random() * (d - 2), sx: sz[0], sy: sz[1], sz: sz[2], col });
      } }
    }
    this.inst = {};
    for (const kind of ['tile', 'col', 'stuff']) {
      const list = items.filter(q => q.kind === kind); if (!list.length) continue;
      const im = new THREE.InstancedMesh(BOX, kind === 'tile' ? MAT.slab : kind === 'col' ? MAT.column : MAT.stuff, list.length);
      list.forEach((q, i) => { q.i = i; q.on = true; _m.compose(_p.set(q.x - cx, q.y, q.z - cz), _q.identity(), _s.set(q.sx, q.sy, q.sz)); im.setMatrixAt(i, _m); if (kind === 'stuff') im.setColorAt(i, _c.setHex(q.col)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false;
      g.add(im); this.inst[kind] = im;
    }
    // the hole where they came in: a dark disc on the wall face, through to both sides
    const hole = new THREE.Mesh(HOLE, MAT.hole); hole.position.set(x - cx, y, z - cz); hole.lookAt(x - cx + fx, y, z - cz + fz); g.add(hole);
    scene.add(g); D.lifted = this;
  }
  // the hero at (x, y, z) inside: tiles within reach of them at their height go, furniture is flung ahead
  step(x, y, z, fx, fz) {
    if (!this.alive) return;
    const D = this.D, cx = this.g.position.x, cz = this.g.position.z; let touched = {};
    for (const q of this.items) {
      if (!q.on) continue;
      const dx = q.x - x, dz = q.z - z;
      if (q.kind === 'tile') { if (Math.abs(q.y - y) > 1.3 || dx * dx + dz * dz > 1.9 * 1.9) continue; }
      else if (q.kind === 'stuff') { if (Math.abs(q.y - y) > 2.2 || dx * dx + dz * dz > 1.9 * 1.9) continue; }
      else continue; // columns stand
      q.on = false; touched[q.kind] = true; _m.makeScale(0, 0, 0); this.inst[q.kind].setMatrixAt(q.i, _m);
      if (q.kind === 'stuff') D.debris.add(q.x, q.y, q.z, q.sx * 0.7, q.sy * 0.7, q.sz * 0.7, q.col, 'fly', { v: [fx * (8 + Math.random() * 8) + (Math.random() - 0.5) * 5, 3 + Math.random() * 5, fz * (8 + Math.random() * 8) + (Math.random() - 0.5) * 5] });
      else for (let n = 0; n < 3; n++) D.debris.add(q.x, q.y, q.z, 0.5 + Math.random() * 0.6, 0.25, 0.5 + Math.random() * 0.6, 0xb9b2a4, 'fly', { v: [(Math.random() - 0.5) * 8, -2 - Math.random() * 4, (Math.random() - 0.5) * 8] });
    }
    for (const kind in touched) this.inst[kind].instanceMatrix.needsUpdate = true;
  }
  // handed to destroyBuilding as the shell: the group falls with everything in it, and debris frees its geometry
  take() { this.alive = false; if (this.D.lifted === this) this.D.lifted = null; return this.g; }
}
