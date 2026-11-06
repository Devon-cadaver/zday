// The Faultline's looks (Sean, 2026-11-05: a giant of rock with lava in its cracks, breaking into smaller and smaller ones). golem(design)
// gives a figure 10 units tall standing on y = 0, with its joints to pose: { root, hips, torso, head, arms: [{ sh, el }], legs: [{ hip, knee }],
// tick(t) }. Four looks for Sean to choose from (golems.html): A Basalt Brute, B Magma Core, C Obsidian Titan, D Living Mountain.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const hash = (x, y, z, s) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.1) * 43758.5453; return v - Math.floor(v); };
// a rough stone: an icosahedron with its corners pushed in and out (each corner always the same way, so the faces stay joined)
export function stoneGeo(sx, sy, sz, rough = 0.28, detail = 1, seed = 0) { let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash(x, y, z, seed) - 0.5) * 2 * rough; p.setXYZ(i, x * sx * k, y * sy * k, z * sz * k); } g = g.toNonIndexed(); g.computeVertexNormals(); return g; }
let SH = 0; const shardGeo = (sx, sy, sz) => stoneGeo(sx * 1.15, sy, sz * 1.15, 0.14, 0, 40 + SH++); // a crystal: a few big flat faces
const rockM = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, ...o });
const lavaM = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.75, 0.12) });
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; }
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
// the bones: hips over the legs, the torso on the hips, head and shoulders on the torso; every limb hangs down its own -y
function bones(P) {
  const root = new THREE.Group(), hips = grp(root, 0, P.thigh + P.shin, 0), torso = grp(hips), head = grp(torso, 0, P.torso, P.headZ || 0), arms = [], legs = [];
  for (const s of [-1, 1]) { const sh = grp(torso, s * P.shW / 2, P.torso * 0.86, 0), el = grp(sh, 0, -P.upper, 0), fist = grp(el, 0, -P.fore, 0); arms.push({ sh, el, fist, s }); const hip = grp(hips, s * P.hipW / 2, 0, 0), knee = grp(hip, 0, -P.thigh, 0), foot = grp(knee, 0, -P.shin, 0); legs.push({ hip, knee, foot, s }); }
  return { root, hips, torso, head, arms, legs };
}
// ---------- A: Basalt Brute. Hunched like a gorilla, dark plates of basalt with lava between them, arms down to its knees, huge fists
function brute() {
  const P = { thigh: 1.5, shin: 1.5, torso: 3.8, shW: 5.2, hipW: 2.2, upper: 2.1, fore: 2.1, headZ: 0.6 }, B = bones(P), R = rockM('#2f2a28'), R2 = rockM('#45403a'), L = lavaM();
  put(B.torso, new THREE.BoxGeometry(3.2, 3.4, 2.1), L, 0, 1.9, 0); // the core, showing through the cracks
  put(B.torso, stoneGeo(1.35, 1.25, 1.1, 0.22, 1, 1), R, -0.85, 2.6, 0.45); put(B.torso, stoneGeo(1.35, 1.25, 1.1, 0.22, 1, 2), R, 0.85, 2.6, 0.45); put(B.torso, stoneGeo(1.5, 1.0, 1.05, 0.25, 1, 3), R2, 0, 0.9, 0.35); put(B.torso, stoneGeo(1.8, 1.9, 1.15, 0.2, 1, 4), R, 0, 2.0, -0.6); put(B.torso, stoneGeo(2.4, 0.8, 1.4, 0.25, 1, 5), R2, 0, 3.45, -0.1);
  put(B.head, stoneGeo(0.75, 0.65, 0.8, 0.25, 1, 6), R2, 0, 0.35, 0.2); for (const s of [-1, 1]) put(B.head, new THREE.BoxGeometry(0.22, 0.1, 0.1), L, s * 0.28, 0.45, 0.88); put(B.head, new THREE.BoxGeometry(0.6, 0.08, 0.1), L, 0, 0.12, 0.86);
  for (const a of B.arms) { put(a.sh, stoneGeo(1.15, 1.0, 1.15, 0.25, 1, 7 + a.s), R2, a.s * 0.2, 0.2, 0); put(a.sh, new THREE.CylinderGeometry(0.42, 0.42, P.upper, 8), L, 0, -P.upper / 2, 0); put(a.sh, stoneGeo(0.8, 0.85, 0.8, 0.25, 1, 9 + a.s), R, 0, -P.upper * 0.55, 0); put(a.el, stoneGeo(0.9, 1.05, 0.9, 0.25, 1, 11 + a.s), R, 0, -P.fore * 0.45, 0); put(a.fist, stoneGeo(1.15, 1.0, 1.15, 0.2, 1, 13 + a.s), R2, 0, -0.5, 0.1); }
  for (const l of B.legs) { put(l.hip, new THREE.CylinderGeometry(0.4, 0.4, P.thigh, 8), L, 0, -P.thigh / 2, 0); put(l.hip, stoneGeo(0.85, 0.8, 0.85, 0.25, 1, 15 + l.s), R, 0, -P.thigh * 0.45, 0); put(l.knee, stoneGeo(0.8, 0.85, 0.8, 0.25, 1, 17 + l.s), R, 0, -P.shin * 0.5, 0); put(l.foot, stoneGeo(0.95, 0.35, 1.25, 0.2, 1, 19 + l.s), R2, 0, 0.2, 0.25); }
  B.torso.rotation.x = 0.45; B.head.rotation.x = -0.35; for (const a of B.arms) { a.sh.rotation.set(-0.25, 0, a.s * 0.12); a.el.rotation.x = -0.25; } for (const l of B.legs) { l.hip.rotation.set(-0.15, 0, l.s * 0.08); l.knee.rotation.x = 0.25; }
  return finish(B, [L], (t) => { B.torso.rotation.x = 0.45 + Math.sin(t * 1.1) * 0.04; for (const a of B.arms) a.sh.rotation.x = -0.25 + Math.sin(t * 1.1 + a.s) * 0.06; });
}
// ---------- B: Magma Core. Boulders held round a glowing core by the heat; its limbs are chains of stones with lava between them
function magma() {
  const P = { thigh: 1.7, shin: 1.7, torso: 3.6, shW: 4.6, hipW: 2.0, upper: 1.9, fore: 1.9 }, B = bones(P), R = rockM('#4a2c22'), R2 = rockM('#5e3a2a'), L = lavaM(), ball = (r) => new THREE.SphereGeometry(r, 14, 10);
  put(B.torso, ball(1.55), L, 0, 1.9, 0.1); const ring = [[-1.25, 2.6, 0.7, 1], [1.25, 2.6, 0.7, 2], [-1.35, 1.2, 0.6, 3], [1.35, 1.2, 0.6, 4], [0, 3.25, 0.2, 5], [0, 1.9, -1.3, 6], [0, 0.55, 0.3, 7]]; for (const [x, y, z, s] of ring) put(B.torso, stoneGeo(1.05, 0.95, 0.95, 0.3, 1, s), s % 2 ? R : R2, x, y, z);
  put(B.head, stoneGeo(0.85, 0.85, 0.85, 0.3, 1, 8), R2, 0, 0.5, 0); put(B.head, new THREE.BoxGeometry(0.9, 0.16, 0.2), L, 0, 0.3, 0.78); for (const s of [-1, 1]) put(B.head, ball(0.12), L, s * 0.3, 0.68, 0.75);
  for (const a of B.arms) { put(a.sh, ball(0.45), L, 0, 0, 0); put(a.sh, stoneGeo(0.75, 0.85, 0.75, 0.3, 1, 9 + a.s), R, 0, -P.upper * 0.5, 0); put(a.el, ball(0.38), L, 0, 0, 0); put(a.el, stoneGeo(0.7, 0.8, 0.7, 0.3, 1, 11 + a.s), R2, 0, -P.fore * 0.45, 0); put(a.fist, stoneGeo(0.95, 0.85, 0.95, 0.3, 1, 13 + a.s), R, 0, -0.45, 0); put(a.fist, ball(0.18), L, a.s * 0.2, -1.15, 0.1); }
  for (const l of B.legs) { put(l.hip, ball(0.45), L, 0, 0, 0); put(l.hip, stoneGeo(0.8, 0.85, 0.8, 0.3, 1, 15 + l.s), R2, 0, -P.thigh * 0.5, 0); put(l.knee, ball(0.4), L, 0, 0, 0); put(l.knee, stoneGeo(0.75, 0.85, 0.75, 0.3, 1, 17 + l.s), R, 0, -P.shin * 0.5, 0); put(l.foot, stoneGeo(0.9, 0.4, 1.1, 0.25, 1, 19 + l.s), R2, 0, 0.2, 0.2); }
  B.torso.rotation.x = 0.15; for (const a of B.arms) a.sh.rotation.set(-0.15, 0, a.s * 0.3); for (const l of B.legs) l.hip.rotation.z = l.s * 0.1;
  return finish(B, [L], (t) => { B.torso.position.y = Math.sin(t * 1.6) * 0.08; for (const a of B.arms) a.sh.rotation.z = a.s * (0.3 + Math.sin(t * 1.4) * 0.05); });
}
// ---------- C: Obsidian Titan. Tall and narrow-waisted, black glassy shards, a fault line of lava down its chest and limbs, horns
function obsidian() {
  const P = { thigh: 2.1, shin: 2.1, torso: 3.6, shW: 4.4, hipW: 1.6, upper: 2.0, fore: 2.0 }, B = bones(P), R = rockM('#16131c', { roughness: 0.35, metalness: 0.35 }), R2 = rockM('#26202e', { roughness: 0.4, metalness: 0.3 }), L = lavaM();
  put(B.torso, shardGeo(1.6, 1.9, 0.9), R, 0, 2.3, 0); put(B.torso, shardGeo(0.85, 1.1, 0.7), R2, 0, 0.7, 0); for (const s of [-1, 1]) { put(B.torso, shardGeo(0.9, 1.3, 0.7), R2, s * 1.2, 2.7, 0, 0, 0, s * 0.5); put(B.torso, new THREE.ConeGeometry(0.35, 1.6, 5), R, s * 1.9, 3.7, 0, 0, 0, -s * 0.35); }
  const crack = [[0, 3.4, 0.1], [0.25, 2.9, -0.3], [-0.15, 2.3, 0.35], [0.2, 1.7, -0.25], [0, 1.0, 0.2]]; for (let i = 0; i < crack.length - 1; i++) { const a = crack[i], b = crack[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); put(B.torso, new THREE.BoxGeometry(0.1, len, 0.06), L, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.86 - Math.abs((a[1] + b[1]) / 2 - 2.3) * 0.25, 0, 0, Math.atan2(b[0] - a[0], a[1] - b[1])); }
  put(B.head, shardGeo(0.55, 0.75, 0.55), R2, 0, 0.55, 0); for (const s of [-1, 1]) { put(B.head, new THREE.ConeGeometry(0.14, 0.9, 5), R, s * 0.4, 1.1, -0.1, -0.4, 0, -s * 0.5); put(B.head, new THREE.BoxGeometry(0.22, 0.06, 0.06), L, s * 0.2, 0.62, 0.48); }
  for (const a of B.arms) { put(a.sh, shardGeo(0.6, 1.1, 0.55), R2, 0, -P.upper * 0.45, 0); put(a.sh, new THREE.BoxGeometry(0.07, P.upper * 0.8, 0.07), L, 0, -P.upper * 0.45, 0.48); put(a.el, shardGeo(0.55, 1.1, 0.5), R, 0, -P.fore * 0.45, 0); put(a.fist, shardGeo(0.55, 0.65, 0.55), R2, 0, -0.35, 0); }
  for (const l of B.legs) { put(l.hip, shardGeo(0.6, 1.2, 0.6), R, 0, -P.thigh * 0.5, 0); put(l.hip, new THREE.BoxGeometry(0.07, P.thigh * 0.7, 0.07), L, l.s * 0.12, -P.thigh * 0.5, 0.52); put(l.knee, shardGeo(0.5, 1.15, 0.5), R2, 0, -P.shin * 0.5, 0); put(l.foot, shardGeo(0.5, 0.25, 0.85), R, 0, 0.12, 0.2); }
  for (const a of B.arms) a.sh.rotation.set(-0.1, 0, a.s * 0.18);
  return finish(B, [L], (t) => { B.torso.rotation.y = Math.sin(t * 0.7) * 0.08; for (const a of B.arms) a.sh.rotation.z = a.s * (0.18 + Math.sin(t * 1.3) * 0.04); });
}
// ---------- D: Living Mountain. A hill that stood up: the town on its back (grass, trees, a lamp post, a car), lava in the cracks of its belly
function mountain() {
  const P = { thigh: 1.2, shin: 1.2, torso: 4.2, shW: 6.0, hipW: 2.8, upper: 2.2, fore: 2.2, headZ: 1.1 }, B = bones(P), R = rockM('#6e6052'), R2 = rockM('#857564'), G = rockM('#5d7a3a'), L = lavaM();
  put(B.torso, new THREE.BoxGeometry(3.2, 2.4, 1.6), L, 0, 1.4, 0.6); put(B.torso, stoneGeo(2.6, 2.3, 2.3, 0.22, 1, 1), R, 0, 2.2, -0.5); for (const [x, y, z, s] of [[-1.15, 1.2, 1.2, 2], [1.15, 1.25, 1.2, 3], [0, 0.4, 1.25, 4]]) put(B.torso, stoneGeo(1.05, 0.95, 0.75, 0.25, 1, s), R2, x, y, z);
  const back = grp(B.torso, 0, 4.05, -0.8); put(back, stoneGeo(2.2, 0.45, 1.9, 0.3, 1, 5), G, 0, 0, 0);
  for (const [x, z, h] of [[-1.1, -0.4, 1.3], [0.9, 0.5, 1.0], [0.3, -1.0, 1.5]]) { put(back, new THREE.CylinderGeometry(0.08, 0.1, h * 0.5, 6), rockM('#5a4430'), x, h * 0.25 + 0.2, z); put(back, new THREE.ConeGeometry(0.5, h, 7), G, x, h * 0.75 + 0.2, z); }
  put(back, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), rockM('#3a3a40'), 1.5, 0.95, -0.6, 0, 0, -0.35); put(back, new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe8a0' }), 1.78, 1.68, -0.6);
  const car = grp(back, -0.4, 0.45, 0.9); car.rotation.set(0.5, 0.7, 0.3); put(car, new THREE.BoxGeometry(1.1, 0.35, 0.55), rockM('#c0392b', { flatShading: false, roughness: 0.5 }), 0, 0, 0); put(car, new THREE.BoxGeometry(0.6, 0.28, 0.5), rockM('#2a2f3a', { flatShading: false, roughness: 0.3 }), -0.05, 0.3, 0);
  put(B.head, stoneGeo(0.8, 0.6, 0.8, 0.25, 1, 6), R2, 0, 0.1, 0.1); for (const s of [-1, 1]) put(B.head, new THREE.BoxGeometry(0.2, 0.09, 0.1), L, s * 0.28, 0.18, 0.86);
  for (const a of B.arms) { put(a.sh, stoneGeo(1.3, 1.1, 1.3, 0.25, 1, 7 + a.s), R, a.s * 0.3, 0.1, 0); put(a.sh, stoneGeo(1.0, 1.15, 1.0, 0.25, 1, 9 + a.s), R2, 0, -P.upper * 0.55, 0); put(a.el, new THREE.CylinderGeometry(0.45, 0.45, 0.5, 8), L, 0, 0, 0); put(a.el, stoneGeo(1.05, 1.15, 1.05, 0.25, 1, 11 + a.s), R, 0, -P.fore * 0.5, 0); put(a.fist, stoneGeo(1.3, 1.0, 1.3, 0.22, 1, 13 + a.s), R2, 0, -0.45, 0.15); }
  for (const l of B.legs) { put(l.hip, stoneGeo(1.05, 0.85, 1.05, 0.25, 1, 15 + l.s), R, 0, -P.thigh * 0.45, 0); put(l.knee, stoneGeo(1.05, 0.8, 1.05, 0.25, 1, 17 + l.s), R2, 0, -P.shin * 0.5, 0); put(l.foot, stoneGeo(1.15, 0.38, 1.4, 0.2, 1, 19 + l.s), R, 0, 0.2, 0.3); }
  B.torso.rotation.x = 0.55; B.head.rotation.x = -0.5; for (const a of B.arms) { a.sh.rotation.set(-0.45, 0, a.s * 0.2); a.el.rotation.x = -0.35; } for (const l of B.legs) l.hip.rotation.z = l.s * 0.12;
  return finish(B, [L], (t) => { B.torso.rotation.x = 0.55 + Math.sin(t * 0.9) * 0.03; for (const a of B.arms) a.sh.rotation.x = -0.45 + Math.sin(t * 0.9 + a.s * 2) * 0.05; });
}
// to 10 units tall on the ground; the lava breathing; tick(t) for the idle
function finish(B, lavas, idle) {
  B.root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(B.root), k = 10 / (box.max.y - box.min.y); const outer = new THREE.Group(); outer.add(B.root); B.root.scale.setScalar(k); B.root.position.y = -box.min.y * k;
  const base = lavas.map((m) => m.color.clone());
  return { root: outer, body: B.root, hips: B.hips, torso: B.torso, head: B.head, arms: B.arms, legs: B.legs, tick(t) { idle(t); const g = 0.82 + 0.18 * Math.sin(t * 3.1); lavas.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(g)); } };
}
export const GOLEMS = { brute: { name: 'A: Basalt Brute', make: brute }, magma: { name: 'B: Magma Core', make: magma }, obsidian: { name: 'C: Obsidian Titan', make: obsidian }, mountain: { name: 'D: Living Mountain', make: mountain } };
export function golem(design = 'brute') { return (GOLEMS[design] || GOLEMS.brute).make(); }
