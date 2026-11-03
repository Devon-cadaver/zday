// The villains' lair inside (Sean: a throne, someone wants to rule the world; creepier all round: spikes on the walls, chains, cages, skulls). Used by baseroom.js (what stays put) and basedecor.js (what the player chooses: the throne and the braziers).
// The many small things (spikes, links, bones, skulls) go in as one instanced mesh each, for the older phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HS, rigFor } from './herogame.js';
import { detail, handsOnHips } from './villains.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o }), glow = (c, k = 1.5) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _q2 = new THREE.Quaternion();
// a skull a metre across, facing +z: the bone, the dark of its holes, the glow in its eyes
function skullGeos() {
  const part = (g, x, y, z, sx = 1, sy = 1, sz = 1) => g.scale(sx, sy, sz).translate(x, y, z);
  const bone = mergeGeometries([part(new THREE.SphereGeometry(0.5, 12, 9), 0, 0.2, 0, 1, 1.02, 1.12), part(new THREE.BoxGeometry(0.62, 0.3, 0.55), 0, -0.12, 0.16), part(new THREE.BoxGeometry(0.5, 0.17, 0.46), 0, -0.38, 0.18)]);
  const dark = mergeGeometries([part(new THREE.SphereGeometry(0.15, 8, 6), -0.2, 0.14, 0.47, 1.1, 1, 0.6), part(new THREE.SphereGeometry(0.15, 8, 6), 0.2, 0.14, 0.47, 1.1, 1, 0.6), part(new THREE.BoxGeometry(0.1, 0.16, 0.08), 0, -0.07, 0.45), part(new THREE.BoxGeometry(0.46, 0.035, 0.05), 0, -0.25, 0.43), part(new THREE.BoxGeometry(0.03, 0.2, 0.05), -0.12, -0.3, 0.42), part(new THREE.BoxGeometry(0.03, 0.2, 0.05), 0, -0.3, 0.42), part(new THREE.BoxGeometry(0.03, 0.2, 0.05), 0.12, -0.3, 0.42)]);
  const eyes = mergeGeometries([part(new THREE.SphereGeometry(0.06, 6, 5), -0.2, 0.14, 0.53), part(new THREE.SphereGeometry(0.06, 6, 5), 0.2, 0.14, 0.53)]);
  return { bone, dark, eyes };
}
export function batch(room) {
  const S = skullGeos(), iron = std('#2a2a30', { metalness: 0.75, roughness: 0.42 }), bone = std('#d8cfb4', { roughness: 0.92 }), defs = { spike: [new THREE.ConeGeometry(0.12, 0.7, 6), iron], link: [new THREE.TorusGeometry(0.055, 0.017, 5, 8), iron], bar: [new THREE.CylinderGeometry(0.028, 0.028, 1, 6), iron], ring: [new THREE.TorusGeometry(1, 0.03, 6, 22).rotateX(Math.PI / 2), iron], plate: [new THREE.CylinderGeometry(1, 1, 0.05, 14), iron], bone: [new THREE.CylinderGeometry(0.03, 0.035, 1, 6), bone], rib: [new THREE.TorusGeometry(0.15, 0.016, 5, 12, Math.PI * 1.4).rotateX(Math.PI / 2).rotateY(Math.PI * 0.8), bone], skullB: [S.bone, bone], skullD: [S.dark, new THREE.MeshBasicMaterial({ color: '#070404' })], skullE: [S.eyes, glow('#ff2a1a', 1.8)] }, L = {};
  const push = (k, q, p, sx, sy, sz) => { _s.set(sx, sy, sz); (L[k] = L[k] || []).push(new THREE.Matrix4().compose(p, q, _s)); };
  const B = {
    put: (k, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => { _q.setFromEuler(_e.set(rx, ry, rz)); push(k, _q, _p.set(x, y, z), sx, sy, sz); },
    // a skull at this size; lit: its eyes glow
    skull: (x, y, z, ry = 0, s = 0.32, lit = false, rx = 0, rz = 0) => { for (const k of lit ? ['skullB', 'skullD', 'skullE'] : ['skullB', 'skullD']) B.put(k, x, y, z, rx, ry, rz, s); },
    // a chain from a to b, sagging in the middle
    chain: (x0, y0, z0, x1, y1, z1, sag = 0) => { const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(3, Math.round((len + sag) / 0.125)); let px = x0, py = y0, pz = z0; for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z = z0 + (z1 - z0) * t; _d.set(x - px, y - py, z - pz).normalize(); _q.setFromUnitVectors(_up, _d); if (i % 2) _q.multiply(_q2.setFromAxisAngle(_up, Math.PI / 2)); push('link', _q, _p.set((x + px) / 2, (y + py) / 2, (z + pz) / 2), 1, 1.5, 1); px = x; py = y; pz = z; } },
    // a cage of bars: its floor at y
    cage: (x, y, z, r, h, top = true) => { B.put('plate', x, y, z, 0, 0, 0, r, 1, r); for (const f of [0.02, 0.5, 1]) B.put('ring', x, y + h * f, z, 0, 0, 0, r, 1, r); const n = Math.round(r * 15); for (let i = 0; i < n; i++) { const a = i / n * 6.2832; B.put('bar', x + Math.cos(a) * r, y + h / 2, z + Math.sin(a) * r, 0, 0, 0, 1, h, 1); } if (top) B.put('spike', x, y + h + 0.3, z, 0, 0, 0, 1.2); },
    // a skeleton slumped on the floor at y, facing ry
    bones: (x, y, z, ry = 0) => { const c = Math.cos(ry), s = Math.sin(ry), T = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c]; const at = (k, lx, ly, lz, rx, rz, l) => { const [a, b] = T(lx, lz); B.put(k, a, y + ly, b, rx, ry, rz, 1, l, 1); }; const [hx, hz] = T(0.05, 0.1); B.skull(hx, y + 0.86, hz, ry + 0.3, 0.2, false, 0.4, 0.2); at('bone', 0, 0.42, -0.04, -0.15, 0, 0.56); for (let i = 0; i < 4; i++) { const [a, b] = T(0, -0.03); B.put('rib', a, y + 0.32 + i * 0.09, b, -0.15, ry, 0, 1 - Math.abs(i - 1.5) * 0.12); } for (const sd of [-1, 1]) { at('bone', sd * 0.2, 0.42, 0.03, 0.15, sd * 0.25, 0.5); at('bone', sd * 0.26, 0.14, 0.14, -0.9, sd * 0.1, 0.34); at('bone', sd * 0.14, 0.1, 0.26, 1.45, sd * 0.25, 0.46); at('bone', sd * 0.2, 0.08, 0.68, 1.5, sd * 0.12, 0.42); } },
    flush: () => { for (const k in L) { const q = new THREE.InstancedMesh(defs[k][0], defs[k][1], L[k].length); L[k].forEach((M, i) => q.setMatrixAt(i, M)); q.instanceMatrix.needsUpdate = true; q.castShadow = k !== 'skullD' && k !== 'skullE'; q.frustumCulled = false; room.add(q); } },
  };
  return B;
}
// the banners: a skull on blood red, drips at the foot
function banner() { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#4a0a12'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#0a0506'; g.fillRect(0, 0, 128, 14); g.fillRect(0, 0, 8, 256); g.fillRect(120, 0, 8, 256); g.fillStyle = '#d8cfb4'; g.beginPath(); g.arc(64, 96, 38, 0, 6.3); g.fill(); g.fillRect(42, 122, 44, 30); g.fillStyle = '#0a0506'; g.beginPath(); g.arc(49, 94, 12, 0, 6.3); g.arc(79, 94, 12, 0, 6.3); g.fill(); g.fillRect(60, 110, 8, 12); for (const x of [50, 60, 70, 80]) g.fillRect(x - 1, 134, 2, 18); g.fillStyle = '#d8cfb4'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64 + s * 24, 66); g.lineTo(64 + s * 54, 18); g.lineTo(64 + s * 36, 76); g.fill(); } g.fillStyle = '#0a0506'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 24, 256); g.lineTo(i * 24 + 12, 226); g.lineTo(i * 24 + 24, 256); g.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 1, side: THREE.DoubleSide }); }
// the far walls: spikes standing out of them and along the top, iron bands, chains in loops
function wallsDressed(B, K, w, d) {
  const iron = std('#17171b', { metalness: 0.6, roughness: 0.5 }), bz = -d / 2 + 0.26, lx = -w / 2 + 0.26;
  K.box(w - 0.6, 0.22, 0.1, 0, 3.55, bz, iron); K.box(w - 0.6, 0.22, 0.1, 0, 1.45, bz, iron); K.box(0.1, 0.22, d - 0.6, lx, 3.55, 0, iron); K.box(0.1, 0.22, d - 0.6, lx, 1.45, 0, iron);
  for (let x = -w / 2 + 0.8; x < w / 2 - 0.4; x += 1.1) { const big = Math.round((x + w) / 1.1) % 2 === 0; B.put('spike', x, 5.3 + (big ? 0.4 : 0), bz, 0, 0, 0, big ? 1.35 : 0.9, big ? 2.1 : 1.1, big ? 1.35 : 0.9); B.put('spike', x + 0.3, 3.55, bz + 0.34, Math.PI / 2, 0, 0, 0.8); B.put('spike', x, 1.45, bz + 0.34, Math.PI / 2, 0, 0, 0.8); }
  for (let z = -d / 2 + 0.8; z < d / 2 - 0.4; z += 1.1) { const big = Math.round((z + d) / 1.1) % 2 === 0; B.put('spike', lx, 5.3 + (big ? 0.4 : 0), z, 0, 0, 0, big ? 1.35 : 0.9, big ? 2.1 : 1.1, big ? 1.35 : 0.9); B.put('spike', lx + 0.34, 3.55, z + 0.3, 0, 0, -Math.PI / 2, 0.8); B.put('spike', lx + 0.34, 1.45, z, 0, 0, -Math.PI / 2, 0.8); }
  // the near rails too, low ones so they hide nothing
  for (let z = -d / 2 + 0.8; z < d / 2; z += 1.4) B.put('spike', w / 2, 1.42, z, 0, 0, 0, 0.8);
  for (let x = -w / 2 + 0.8; x < w / 2; x += 1.4) if (Math.abs(x) > 1.8) B.put('spike', x, 1.42, d / 2, 0, 0, 0, 0.8);
  const span = 3.4; for (let x = -w / 2 + 1; x + span < w / 2; x += span) { B.chain(x, 4.6, bz + 0.14, x + span, 4.6, bz + 0.14, 0.75); B.skull(x, 4.68, bz + 0.2, 0, 0.3, true); } for (let z = -d / 2 + 1; z + span < d / 2; z += span) { B.chain(lx + 0.14, 4.6, z, lx + 0.14, 4.6, z + span, 0.75); B.skull(lx + 0.2, 4.68, z, Math.PI / 2, 0.3, true); }
}
// a column with skulls stacked round it, a spike on top
function column(B, K, x, z, m) { K.cyl(0.42, 0.55, 4.2, x, 2.1, z, m, 8, true); for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const a = i * 1.5708 + j * 0.78; B.skull(x + Math.sin(a) * 0.5, 1.0 + j * 1.15, z + Math.cos(a) * 0.5, a, 0.3, j === 2); } B.put('spike', x, 4.7, z, 0, 0, 0, 3, 1.6, 3); }
// a cage on a chain from an arm out of the wall, somebody long dead in it
function hanging(B, K, x, z, y, zArm, iron) { K.box(0.2, 0.2, Math.abs(zArm - z) + 0.4, x, 5.05, (z + zArm) / 2, iron, 0, true); B.chain(x, 5, z, x, y + 1.5, z, 0); B.cage(x, y, z, 0.58, 1.5, false); B.bones(x, y + 0.03, z, 0.3); }
// the doom globe: the world on a table of skulls, a red mark for each town wrecked; it turns
function doomGlobe(room, K, B, x, z, tick) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#071410'; g.fillRect(0, 0, 256, 128); let r = 41; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; }; g.fillStyle = '#1f5a34'; for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(rnd() * 256, 18 + rnd() * 92, 6 + rnd() * 20, 4 + rnd() * 12, rnd() * 3, 0, 6.3); g.fill(); } g.strokeStyle = 'rgba(80,255,150,.35)'; for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); } for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const wrecked = Math.max(3, HS.load().villain.idx + 3); g.fillStyle = '#ff2a1a'; for (let i = 0; i < wrecked; i++) { g.beginPath(); g.arc(rnd() * 256, 22 + rnd() * 84, 5, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const stone = std('#201c22', { roughness: 0.9, flatShading: true });
  K.cyl(1.55, 1.75, 0.3, x, 0.2, z, stone, 8, true); K.cyl(0.55, 0.85, 0.8, x, 0.72, z, stone, 8, true); for (let i = 0; i < 6; i++) { const a = i * 1.0472; B.skull(x + Math.sin(a) * 0.88, 0.62, z + Math.cos(a) * 0.88, a, 0.32, true); B.put('spike', x + Math.sin(a) * 1.5, 0.75, z + Math.cos(a) * 1.5, 0, 0, 0, 0.9); }
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshBasicMaterial({ map: t })); earth.position.set(x, 2.3, z); room.add(earth); const halo = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.035, 6, 36).rotateX(Math.PI / 2), glow('#ff3a2a', 1.3)); halo.position.copy(earth.position); halo.rotation.z = 0.35; room.add(halo); for (const a of [0, 2.094, 4.188]) { const q = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.2, 5), std('#2a2a30', { metalness: 0.7 })); q.position.set(x + Math.cos(a) * 0.9, 1.45, z + Math.sin(a) * 0.9); q.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); room.add(q); }
  tick.push((T) => { earth.rotation.y = T * 0.22; halo.rotation.y = -T * 0.5; });
}
// a captured hero, sat on the floor of a cage with their head down (Sean's cages; nobody hurt, only caught)
function prisoner(room, x, z, ry, tick) {
  const T = HS.team('hero'), n = T.length ? HS.name(T[0]) : 'Nova', r = rigFor(n, HS.outfit(n)); r.root.position.set(x, -0.42, z); r.root.rotation.y = ry; for (const L of r.legs) { L.hip.rotation.x = -1.2; L.knee.rotation.x = 1.9; } r.arms.forEach((a) => { a.sh.rotation.set(-0.9, 0, a.sx * 0.1); a.el.rotation.set(-0.8, 0, 0); }); r.head.rotation.x = 0.45; if (r.cape) r.cape.update(0.05, 0.05, 0.1); detail(r, null, true); room.add(r.root);
  tick.push((t) => { r.head.rotation.y = Math.sin(t * 0.5) * 0.35; r.head.rotation.x = 0.4 + Math.sin(t * 0.31) * 0.12; });
}
// the two who are not on the throne stand either side of it, like henchmen: made again when that changes
export function standTeam(room) {
  if (room.userData.seats) room.remove(room.userData.seats); const g = room.userData.seats = new THREE.Group(); room.add(g); const others = HS.team('villain').map(id => HS.name(id)).filter(q => q !== HS.curName('villain')).slice(0, 2);
  others.forEach((n, i) => { const sd = i ? 1 : -1, r = rigFor(n, HS.outfit(n)); r.root.position.set(sd * 2.7, 0.07, -2.2); r.root.rotation.y = -sd * 0.22; handsOnHips(r); if (r.cape) r.cape.update(0.05, 0.05, 0.1); detail(r, null, true); g.add(r.root); });
}
export function furnishLair(key, room, w, d, K, statue, monitors, solids, tick) {
  const B = batch(room), iron = std('#17171b', { metalness: 0.6, roughness: 0.5 }), stone = std('#26222a', { roughness: 0.95, flatShading: true });
  { const H = new THREE.HemisphereLight('#8a84b8', '#20121a', 0.8); room.add(H); const P0 = new THREE.PointLight('#ff4a30', 34, 24, 1.5); P0.position.set(0, 4.6, key === 'office' ? -3.4 : -2); room.add(P0); const P1 = new THREE.PointLight('#8a50ff', 20, 26, 1.5); P1.position.set(key === 'office' ? -5 : -9, 4.2, 3); room.add(P1); const P2 = new THREE.PointLight('#50ff90', 14, 18, 1.6); P2.position.set(key === 'office' ? 6 : 9, 3.6, 2.2); room.add(P2); tick.push((t) => { P0.intensity = 34 + Math.sin(t * 7.3) * 6 + Math.sin(t * 13.1) * 4; }); }
  // nothing out there: black below and behind, so the place hangs in the dark
  { const vm = new THREE.MeshBasicMaterial({ color: '#040206', fog: false, side: THREE.DoubleSide }), V = (geo, x, y, z) => { const q = new THREE.Mesh(geo, vm); q.position.set(x, y, z); room.add(q); }; V(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), 0, -3.2, 0); V(new THREE.PlaneGeometry(1600, 500), 0, 200, -d / 2 - 2); V(new THREE.PlaneGeometry(1600, 500).rotateY(Math.PI / 2), -w / 2 - 2, 200, 0); }
  wallsDressed(B, K, w, d);
  if (key === 'office') {
    solids.push([0, -5.6, 2.7]); standTeam(room); solids.push([-2.7, -2.2, 0.4], [2.7, -2.2, 0.4]);
    doomGlobe(room, K, B, 6.1, 2.4, tick); solids.push([6.1, 2.4, 1.9]);
    const bm = banner(); for (const x of [-6.2, 6.8]) { K.box(1.5, 3.4, 0.05, x, 3, -d / 2 + 0.3, bm); K.box(1.8, 0.1, 0.1, x, 4.75, -d / 2 + 0.34, std('#17171b')); B.put('spike', x - 0.95, 4.75, -d / 2 + 0.34, 0, 0, Math.PI / 2, 0.6); B.put('spike', x + 0.95, 4.75, -d / 2 + 0.34, 0, 0, -Math.PI / 2, 0.6); }
    { const q = K.box(1.5, 3.4, 0.05, -w / 2 + 0.3, 3, 4.4, bm, Math.PI / 2); q.castShadow = false; }
    column(B, K, -3.9, -7, stone); column(B, K, 3.9, -7, stone); solids.push([-3.9, -7, 0.7], [3.9, -7, 0.7]); column(B, K, -10.2, -7.2, stone); column(B, K, 10.2, -7.2, stone);
    hanging(B, K, -5.1, -6.4, 2.6, -7.8, iron); { K.box(1.5, 0.2, 0.2, -10.2, 5.05, -1, iron, 0, true); B.chain(-9.6, 5, -1, -9.6, 3.8, -1, 0); B.cage(-9.6, 2.3, -1, 0.58, 1.5, false); B.bones(-9.6, 2.33, -1, 1.2); }
    B.cage(9.2, 0.08, -0.6, 1.25, 2.5); prisoner(room, 9.2, -0.6, -Math.PI / 2 - 0.5, tick); solids.push([9.2, -0.6, 1.4]);
    B.cage(-9.1, 0.08, 5.6, 0.95, 2.1); B.bones(-9.1, 0.1, 5.6, 0.9); solids.push([-9.1, 5.6, 1.1]);
    monitors(K, -w / 2 + 0.28, 2.6, 0.9 + 1.6, 2, 2, 1.3, 0.8, Math.PI / 2, ['doom']);
    monitors(K, 8.7, 3.4, -7.72, 2, 1, 1.0, 0.7, 0, ['doom']);
    for (const [x, z, n] of [[-7, 7, 5], [7.8, 7, 6], [-4.8, -4, 4], [3.6, -3.5, 3], [-10.2, 2.5, 4]]) for (let i = 0; i < n; i++) { const a = i * 2.4, r0 = 0.13 * Math.sqrt(i) * 2.2; B.skull(x + Math.cos(a) * r0, 0.22 + (i > 3 ? 0.2 : 0), z + Math.sin(a) * r0, a * 1.3, 0.3, false, 0.1, (i % 3 - 1) * 0.2); }
    { const team = HS.team('villain').map(id => HS.name(id)); statue(K, room, team[0] || 'Tyrant', 9.5, 5.6, -Math.PI / 2 - 0.6); solids.push([9.5, 5.6, 1.1]); }
    const rune = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 40).rotateX(-Math.PI / 2), glow('#ff2a1a', 1.2)); rune.position.set(0, 0.09, -5.4); room.add(rune);
    tick.push((t) => { rune.material.color.setRGB(1.2 + Math.sin(t * 2.4) * 0.5, 0.2, 0.12); });
  } else {
    column(B, K, -9, -15.7, stone); column(B, K, 9, -15.7, stone); column(B, K, -18.6, -15.7, stone); column(B, K, 18.6, -15.7, stone); solids.push([-9, -15.7, 0.7], [9, -15.7, 0.7]);
    hanging(B, K, -6, -15, 2.6, -16.6, iron); hanging(B, K, 6, -15, 2.2, -16.6, iron); hanging(B, K, -13, -15.2, 2.4, -16.6, iron);
    B.cage(-18, 0.08, 8, 1.2, 2.5); B.bones(-18, 0.1, 8, 1.2); B.cage(17.6, 0.08, 6.6, 1.2, 2.5); B.bones(17.6, 0.1, 6.6, -1.2); solids.push([-18, 8, 1.4], [17.6, 6.6, 1.4]);
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.2832, x = Math.cos(a) * 14.5, z = -2 + Math.sin(a) * 14.5; B.put('spike', x, 0.42, z, 0, 0, 0, 1.2, 1.2, 1.2); if (i % 6 === 0) B.skull(x, 1.0, z, Math.atan2(-x, 2 - z - 2), 0.3, true); }
    for (const [x, z, n] of [[-12, 13, 7], [11, 14, 6], [-18, -10, 5], [17, -9, 5]]) for (let i = 0; i < n; i++) { const a = i * 2.4, r0 = 0.13 * Math.sqrt(i) * 2.2; B.skull(x + Math.cos(a) * r0, 0.22 + (i > 3 ? 0.2 : 0), z + Math.sin(a) * r0, a * 1.3, 0.3, false, 0.1, (i % 3 - 1) * 0.2); }
  }
  B.flush();
}
// a horn: tapered pieces along a curve
function horn(P, pts, r0, m) { const n = pts.length - 1; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1], rA = r0 * (1 - i / n) + 0.008, rB = r0 * (1 - (i + 1) / n) + (i === n - 1 ? 0.002 : 0.008); _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const l = _d.length(); _d.normalize(); const q = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, l * 1.1, 7), m); q.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); q.quaternion.setFromUnitVectors(_up, _d); q.castShadow = true; P.add(q); } }
// the throne, the braziers: what the player's choices build. H: the decor's helpers. lv: the villain's level; the throne grows with it
export function lairDecor(H, lv) {
  const { add, box, cyl, put, flames, I, alt, G } = H, T = I.table, B = batch(G), m = std(T.c, { roughness: 0.7, flatShading: true }), a = std(new THREE.Color(alt(T.c)).multiplyScalar(0.45), { roughness: 0.95, flatShading: true }), tier = lv >= 8 ? 3 : lv >= 5 ? 2 : lv >= 3 ? 1 : 0, s = 1 + tier * 0.12, F = I.fire, fl = F.flame, eye = glow(fl === '#050506' ? '#ff2a1a' : fl, 2.2);
  // the steps up to it
  box(7.2, 0.3, 5, 0, 0.2, -5.45, a); box(5.6, 0.3, 3.9, 0, 0.5, -5.8, m); box(4.2, 0.3, 2.8, 0, 0.8, -6.2, a);
  for (const [x, y, z] of [[-3.4, 0.35, -3.2], [3.4, 0.35, -3.2], [-2.6, 0.65, -4.1], [2.6, 0.65, -4.1], [-1.9, 0.95, -5.0], [1.9, 0.95, -5.0]]) { B.put('spike', x, y + 0.34, z, 0, 0, 0, 1.3); if (T.deco !== 'none') put(T.deco, 0.34, T.c, x * 0.86, y, z + 0.2); }
  const Y = 0.95, Z = -6.3, g = new THREE.Group(); g.position.set(0, Y, Z); g.scale.setScalar(s); G.add(g); const part = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); q.rotation.set(rx, ry, rz); q.castShadow = true; q.receiveShadow = true; g.add(q); return q; }, bx = (w, h, d, x, y, z, mat, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz), Pg = { add: (q) => { g.add(q); return q; } };
  // the seat and the arms, a little skull on each
  bx(1.8, 0.55, 1.5, 0, 0.28, 0.1, m); bx(1.6, 0.08, 1.3, 0, 0.59, 0.12, std('#4a0a12', { roughness: 1 }));
  const boneM = std(T.look === 2 ? T.c : '#a89e86', { roughness: 0.95 }), dark = new THREE.MeshBasicMaterial({ color: '#080404' }), sk = (x, y, z, r, lit) => { const c = part(new THREE.SphereGeometry(r, 12, 9), boneM, x, y, z); c.scale.set(1, 1.02, 1.1); bx(r * 1.2, r * 0.6, r * 1.05, x, y - r * 0.62, z + r * 0.3, boneM); for (const sd of [-1, 1]) { part(new THREE.SphereGeometry(r * 0.31, 10, 8), dark, x + sd * r * 0.4, y - r * 0.05, z + r * 0.88).scale.z = 0.6; if (lit) part(new THREE.SphereGeometry(r * 0.11, 8, 6), eye, x + sd * r * 0.4, y - r * 0.05, z + r * 1.03); } bx(r * 0.2, r * 0.3, r * 0.12, x, y - r * 0.42, z + r * 1.03, dark); for (let i = -2; i <= 2; i++) bx(r * 0.05, r * 0.3, r * 0.08, x + i * r * 0.2, y - r * 0.72, z + r * 0.83, dark); };
  for (const sd of [-1, 1]) { bx(0.34, 0.75, 1.4, sd * 1.05, 0.5, 0.15, m); sk(sd * 1.05, 1.06, 0.72, 0.21, true); B.put('spike', sd * 1.05, Y + 0.9 * s, Z - 0.3 * s, 0, 0, sd * -0.35, 1.1); }
  if (T.look === 0) { // the skull: a giant one for a back
    bx(1.9, 2, 0.4, 0, 1.4, -0.7, a); sk(0, 3.1, -0.9, 1.25, true);
    for (const sd of [-1, 1]) horn(Pg, Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [sd * (0.95 + 1.5 * t - 0.2 * t * t), 3.7 + 2.1 * t * t + 0.5 * t, -0.9 - 0.4 * t + 0.5 * t * t]; }), 0.3, std('#16141a', { metalness: 0.4, roughness: 0.5 }));
  } else if (T.look === 1) { // iron: a fan of blades
    bx(1.9, 2.4, 0.3, 0, 1.6, -0.7, a); for (let i = -6; i <= 6; i++) { const q = i / 6, h = 3.2 + (1 - Math.abs(q)) * 2.6 + (i % 2 ? -0.5 : 0.3), rz = -q * 0.75, st = part(new THREE.ConeGeometry(0.2, h, 4), std(T.c, { metalness: 0.8, roughness: 0.3, flatShading: true }), Math.sin(-rz) * h / 2 + q * 0.5, 1 + Math.cos(rz) * h / 2, -0.82, 0, 0, rz); st.scale.z = 0.3; } sk(0, 3.1, -0.45, 0.62, true);
  } else { // bone: ribs for a back, antlers over it
    bx(1.7, 1.8, 0.25, 0, 1.3, -0.7, a); part(new THREE.CylinderGeometry(0.1, 0.14, 3.6, 7), boneM, 0, 2.3, -0.62); for (let i = 0; i < 6; i++) { const y = 1.15 + i * 0.5, r = 1.15 - i * 0.1; const q = part(new THREE.TorusGeometry(r, 0.07, 6, 18, Math.PI), boneM, 0, y, -0.6, 0.35); q.rotation.z = 0; q.rotation.x = -1.15; } sk(0, 4.3, -0.52, 0.72, true);
    for (const sd of [-1, 1]) { const P = (t) => [sd * (0.45 + 1.9 * t), 4.6 + 1.6 * t - 0.25 * t * t, -0.5 - 0.3 * t], L = Array.from({ length: 8 }, (_, i) => P(i / 7)); horn(Pg, L, 0.13, boneM); for (const [t, up] of [[0.4, 0.8], [0.7, 0.7]]) { const o = P(t); horn(Pg, [o, [o[0] + sd * 0.1, o[1] + up * 0.5, o[2]], [o[0] + sd * 0.1, o[1] + up, o[2] + 0.1]], 0.07, boneM); } }
  }
  if (tier >= 1) for (const sd of [-1, 1]) { const x = sd * 1.75; for (let i = 0; i < 4; i++) part(new THREE.ConeGeometry(0.11, 1 + i * 0.45, 5), std('#16141a', { metalness: 0.7, roughness: 0.4 }), x + sd * i * 0.24, 0.75 + i * 0.32, -0.75, 0, 0, -sd * (0.25 + i * 0.16)); }
  if (tier >= 2) { const q = bx(2.6, 3.6, 0.06, 0, 2.4, -1.3, std('#4a0a12', { roughness: 1, side: THREE.DoubleSide })); q.castShadow = false; }
  if (tier >= 3) for (const sd of [-1, 1]) horn(Pg, Array.from({ length: 8 }, (_, i) => { const t = i / 7; return [sd * (1.2 + 2.8 * t), 1 + 3.8 * t - 1 * t * t, -1 - 0.5 * t]; }), 0.2, boneM);
  G.userData.seat = { x: 0, y: Y + 0.63 * s, z: Z + 0.12 * s };
  // the braziers: up the carpet and either side of the throne
  const iron = std(F.c, { metalness: 0.7, roughness: 0.45 }), fm = [glow(fl, fl === '#050506' ? 1 : 1.6), glow('#' + (fl === '#050506' ? new THREE.Color('#3a0808') : new THREE.Color(fl).lerp(new THREE.Color('#ffffff'), 0.45)).getHexString(), fl === '#050506' ? 1 : 1.5)];
  for (const [x, z, y0] of [[-4.5, -2.7, 0.06], [4.5, -2.7, 0.06], [-2.5, 2.2, 0.06], [2.5, 2.2, 0.06], [-2.5, 6.1, 0.06], [2.5, 6.1, 0.06]]) {
    let top = 1.5; const P = { add: (q) => { G.add(q); return q; } };
    if (F.look === 0) { cyl(0.05, 0.12, 1.3, x, y0 + 0.65, z, iron, 8); cyl(0.42, 0.14, 0.32, x, y0 + 1.42, z, iron, 10); }
    else if (F.look === 1) { cyl(0.08, 0.14, 0.9, x, y0 + 0.45, z, iron, 8); B.skull(x, y0 + 1.25, z, 0, 0.72, true); top = 1.72; }
    else { cyl(0.04, 0.16, 1.9, x, y0 + 0.95, z, iron, 6); cyl(0.42, 0.1, 0.24, x, y0 + 1.95, z, iron, 8); for (let i = 0; i < 6; i++) { const q = i * 1.047; B.put('spike', x + Math.cos(q) * 0.42, y0 + 2.28, z + Math.sin(q) * 0.42, Math.sin(q) * 0.3, 0, -Math.cos(q) * 0.3, 0.8); } top = 2; }
    if (F.deco !== 'none') put(F.deco, 0.3, F.c, x, y0, z + 0.45);
    for (let i = 0; i < 4; i++) { const q = i * 1.57 + 0.4, f = add(new THREE.Mesh(new THREE.ConeGeometry(0.17 + (i % 2) * 0.05, 0.7, 6), fm[i % 2]), x + Math.cos(q) * 0.16, y0 + top + 0.3, z + Math.sin(q) * 0.16); f.phase = i * 1.7 + x; f.low = y0 + top - 0.05; flames.push(f); }
  }
  B.flush();
}
