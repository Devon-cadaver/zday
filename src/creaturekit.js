// The invasion's ground units and dogs (Sean chose them all from creatures.html). A crowd of them cannot be built of separate parts: each kind's stride is recorded
// once, as ten whole shapes, when the level starts, and each creature draws the shape for where it is in its stride (CreatureLayer). The people system still runs them: moving,
// biting, falling, being thrown, counted; people.sync hands each one's place and turn over here instead of drawing a figure.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZTYPES } from './figures.js';

const mat = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.25, flatShading: true, ...o });
const glow = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.5) });
const sph = (r, sx, sy, sz, m) => { const q = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7), m); q.scale.set(sx, sy, sz); return q; };
const cap = (r, l, m) => { const g = new THREE.CapsuleGeometry(r, l, 2, 6); g.translate(0, -l / 2, 0); return new THREE.Mesh(g, m); }; // hangs from its joint
const cone = (r, h, m, n = 7) => new THREE.Mesh(new THREE.ConeGeometry(r, h, n), m);
const at = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
// a two-part limb from its joint
function limb(a, b, r, m, footM) { const hip = new THREE.Group(), knee = new THREE.Group(); hip.add(cap(r, a, m)); knee.position.y = -a; hip.add(knee); knee.add(cap(r * 0.72, b, m)); const f = sph(r * 1.05, 1.5, 0.7, 1, footM || m); f.position.y = -b; knee.add(f); return { hip, knee }; }
// a chain that ripples (tails, tentacles)
function chain(n, r0, l, m, tipM) { const root = new THREE.Group(), seg = []; let p = root; for (let i = 0; i < n; i++) { const g = new THREE.Group(), k = 1 - i / n; g.add(cap(r0 * k + 0.012, l, i === n - 1 && tipM ? tipM : m)); p.add(g); if (i) g.position.y = -l; seg.push(g); p = g; } return { root, seg }; }

// ---------- ground units
export function grey() { // the classic: a huge head on a thin body
  const g = new THREE.Group(), skin = mat('#aebdb0'), eye = new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 0.12, metalness: 0.5 }), suit = mat('#59636e');
  g.add(at(sph(0.17, 1, 1.5, 0.75, suit), 0, 1.0, 0)); const head = at(sph(0.26, 1, 1.22, 1.05, skin), 0, 1.5, 0.02); g.add(head); g.add(at(sph(0.14, 0.9, 1, 0.8, skin), 0, 1.3, 0.09));
  for (const s of [-1, 1]) head.add(at(sph(0.075, 1.25, 0.72, 0.5, eye), s * 0.1, -0.02, 0.21, 0, 0, s * -0.5));
  const A = [-1, 1].map(s => { const L = limb(0.34, 0.36, 0.035, skin); at(L.hip, s * 0.18, 1.2, 0, 0, 0, s * 0.12); g.add(L.hip); return L; }), F = [-1, 1].map(s => { const L = limb(0.42, 0.44, 0.05, suit, mat('#3a424c')); at(L.hip, s * 0.09, 0.86, 0); g.add(L.hip); return L; });
  const gun = at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), mat('#c9d2dc')), 0, -0.36, 0.1); A[1].knee.add(gun); gun.add(at(sph(0.035, 1, 1, 1, glow('#7fe04f')), 0, 0, 0.16));
  g.step = (t) => { const p = t * 6; F.forEach((L, i) => { const q = p + i * Math.PI; L.hip.rotation.x = Math.sin(q) * 0.6; L.knee.rotation.x = Math.max(0, Math.cos(q)) * 0.9; }); A[0].hip.rotation.x = Math.sin(p) * 0.4; A[1].hip.rotation.x = -1.2; A[1].knee.rotation.x = -0.2; g.position.y = Math.abs(Math.sin(p)) * 0.03; head.rotation.y = Math.sin(p) * 0.25; };
  g.speed = 3; g.rate = 6; g.forwardZ = true; return g;
}
export function mantis() { // a tall insect, its scythes held up
  const g = new THREE.Group(), sh = mat('#6fb83c'), dark = mat('#2f5a2a'), bl = mat('#dfe7f0', { metalness: 0.7, roughness: 0.25 }), body = new THREE.Group(); body.position.set(0, 1.05, 0); body.rotation.x = 0.55; g.add(body);
  body.add(at(sph(0.18, 1, 2, 1, sh), 0, 0.28, 0)); g.add(at(sph(0.22, 1, 1, 1.9, dark), 0, 0.98, -0.38));
  const head = at(sph(0.14, 1.2, 0.8, 1, sh), 0, 0.68, 0.08); body.add(head); for (const s of [-1, 1]) head.add(at(sph(0.06, 1, 1, 1, glow('#e8ff6a')), s * 0.13, 0.03, 0.05));
  const S = [-1, 1].map(s => { const L = limb(0.34, 0.5, 0.04, dark); at(L.hip, s * 0.17, 0.48, 0.05, 0, 0, s * 0.2); body.add(L.hip); const b = at(cone(0.08, 0.85, bl, 4), 0, -0.7, 0, Math.PI); L.knee.add(b); return L; });
  const F = [[-1, 0.15], [1, 0.15], [-1, -0.25], [1, -0.25]].map(([s, z]) => { const L = limb(0.55, 0.62, 0.035, dark); at(L.hip, s * 0.13, 0.98, z, 0, 0, s * 0.55); g.add(L.hip); return L; });
  g.step = (t) => { const p = t * 7; F.forEach((L, i) => { const q = p + [0, Math.PI, Math.PI, 0][i]; L.hip.rotation.x = Math.sin(q) * 0.55; L.knee.rotation.z = (i % 2 ? -1 : 1) * (0.75 - Math.max(0, Math.cos(q)) * 0.35); }); S.forEach((L, i) => { L.hip.rotation.x = -1.1 + Math.sin(p + i) * 0.12; L.knee.rotation.x = 2.1 + Math.sin(p + i) * 0.14; }); head.rotation.y = Math.sin(p) * 0.4; g.position.y = Math.abs(Math.sin(p)) * 0.04; };
  g.speed = 3.6; g.rate = 7; g.forwardZ = true; return g;
}
export function squid() { // what is in the tripods' domes, on legs of its own
  const g = new THREE.Group(), red = mat('#c9574f', { flatShading: false, roughness: 0.65 }), ten = mat('#8e3f55'), tip = glow('#7fe04f'), top = new THREE.Group(); top.position.y = 1.02; g.add(top);
  top.add(at(sph(0.4, 1, 0.82, 1, red), 0, 0.14, 0)); { const dome = at(sph(0.5, 1, 0.88, 1, new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false })), 0, 0.14, 0); dome.userData.glass = true; top.add(dome); }
  const collar = at(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 18), mat('#c9d2dc', { metalness: 0.7, roughness: 0.3 })), 0, -0.1, 0, Math.PI / 2); top.add(collar); for (const s of [-1, 1]) top.add(at(sph(0.055, 1, 1, 1, glow('#e8ff6a')), s * 0.16, 0.14, 0.42));
  const T = []; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, c = chain(6, 0.075, 0.2, ten, tip); at(c.root, Math.cos(a) * 0.3, -0.14, Math.sin(a) * 0.3); c.root.rotation.y = -a + Math.PI / 2; top.add(c.root); T.push(c); }
  g.step = (t) => { T.forEach((c, i) => c.seg.forEach((q, k) => { q.rotation.x = (k ? 0.1 : -0.75) + Math.sin(t * 6 + i * 1.05 - k * 0.8) * (k ? 0.38 : 0.26); })); top.position.y = 1.02 + Math.sin(t * 3) * 0.05; top.rotation.z = Math.sin(t * 3) * 0.06; };
  g.speed = 2.4; g.rate = 3; g.forwardZ = true; return g;
}

// ---------- the dogs: running along +x in a gallop, the back arching
function dog(o) {
  const g = new THREE.Group(), rear = new THREE.Group(), front = new THREE.Group(), H = o.h, M = o.m; g.add(rear, front); rear.position.set(-o.len / 2, H, 0); front.position.set(o.len / 2, H + o.rise, 0);
  rear.add(sph(o.hip, 1.15, 1, 0.92, M)); front.add(sph(o.chest, 1.15, 1.05, 0.95, M));
  const mid = new THREE.Mesh(new THREE.CapsuleGeometry((o.hip + o.chest) * 0.42, o.len * 0.7, 2, 8), M); mid.rotation.z = Math.PI / 2 + Math.atan2(o.rise, o.len); mid.position.set(0, H + o.rise / 2, 0); g.add(mid); g.mid = mid;
  const w = o.w, mk = (par, x, y, s) => { const L = limb(o.th, o.sh, o.r, o.lm || M, o.fm); at(L.hip, x, y, s * w); par.add(L.hip); return L; };
  const FL = [mk(front, 0.05, -o.chest * 0.4, 1), mk(front, 0.05, -o.chest * 0.4, -1)], BL = [mk(rear, 0, -o.hip * 0.4, 1), mk(rear, 0, -o.hip * 0.4, -1)];
  const neck = at(new THREE.Group(), o.chest * 0.85, o.chest * 0.5, 0, 0, 0, o.nk || -0.5); front.add(neck); o.head(neck); const tail = chain(o.tn || 6, o.tr || 0.05, o.tl || 0.16, M, o.tip); at(tail.root, -o.hip * 0.9, o.hip * 0.3, 0, 0, 0, -0.9); rear.add(tail.root); if (o.extra) o.extra(g, rear, front);
  g.step = (t) => { const p = t * o.rate, b = Math.sin(p); rear.rotation.z = -b * 0.28; front.rotation.z = b * 0.2; g.position.y = (Math.abs(Math.sin(p + 0.8)) - 0.45) * o.hop; FL.forEach((L, i) => { const q = p + i * 0.45; L.hip.rotation.z = -0.05 + Math.sin(q) * o.amp; L.knee.rotation.z = -0.15 - Math.max(0, Math.cos(q)) * 1.2; }); BL.forEach((L, i) => { const q = p + Math.PI + i * 0.45; L.hip.rotation.z = 0.25 + Math.sin(q) * o.amp; L.knee.rotation.z = -0.65 - Math.max(0, Math.cos(q)) * 0.9; }); tail.seg.forEach((q, k) => { q.rotation.z = (k ? -0.12 : 0) + Math.sin(p - k * 0.7) * 0.22; }); neck.rotation.z = (o.nk || -0.5) + Math.sin(p + 1) * 0.1; };
  g.speed = o.run; g.rate = o.rate; return g;
}
export function hound() { const M = mat('#c5d0dc', { metalness: 0.55, roughness: 0.35 }), G = glow('#7fe04f'); return dog({ m: M, lm: mat('#8f9aa6', { metalness: 0.5 }), h: 0.82, len: 0.95, rise: 0.05, hip: 0.17, chest: 0.25, w: 0.11, th: 0.42, sh: 0.46, r: 0.04, rate: 11, amp: 0.95, hop: 0.2, run: 9, tip: G, tn: 7, tl: 0.15,
  head: (n) => { n.add(at(cap(0.08, 0.24, M), 0, 0, 0, 0, 0, Math.PI / 2 + 0.7)); const h = at(sph(0.12, 1.2, 0.85, 0.85, M), 0.24, 0.18, 0); n.add(h); h.add(at(cone(0.09, 0.26, M), 0.2, -0.02, 0, 0, 0, -Math.PI / 2)); for (const s of [-1, 1]) { h.add(at(sph(0.035, 1.8, 0.6, 0.6, G), 0.07, 0.04, s * 0.09)); h.add(at(cone(0.04, 0.24, M, 4), -0.08, 0.14, s * 0.07, 0, 0, 0.55)); } },
  extra: (g) => { for (let i = 0; i < 4; i++) { for (const s of [-1, 1]) { const r = at(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.015), G), 0.26 - i * 0.14, 0.86, s * 0.185); r.rotation.x = s * 0.2; g.add(r); } } } }); }
export function maw() { const M = mat('#3f6b4a', { roughness: 0.6 }), D = mat('#233d2e'), T = mat('#f2ead2'), G = glow('#d6ff5a'); return dog({ m: M, lm: D, h: 0.62, len: 0.75, rise: 0.22, hip: 0.2, chest: 0.42, w: 0.2, th: 0.3, sh: 0.36, r: 0.08, rate: 8.5, amp: 0.75, hop: 0.14, run: 6.5, nk: -0.1, tn: 4, tr: 0.08, tl: 0.12,
  head: (n) => { const up = at(sph(0.3, 1.25, 0.6, 1, M), 0.28, 0.14, 0, 0, 0, 0.34), lo = at(sph(0.26, 1.2, 0.42, 0.92, D), 0.25, -0.17, 0, 0, 0, -0.32); n.add(up, lo); n.add(at(sph(0.2, 1.1, 0.55, 0.8, G), 0.22, -0.02, 0)); for (let i = 0; i < 5; i++) { const z = -0.2 + i * 0.1, x = 0.56 - Math.abs(z) * 0.7; n.add(at(cone(0.035, 0.15, T, 5), x, 0.01 + x * 0.1, z, Math.PI)); n.add(at(cone(0.03, 0.13, T, 5), x - 0.03, -0.14 - x * 0.1, z)); } for (const s of [-1, 1]) up.add(at(sph(0.05, 1, 1, 1, G), 0.1, 0.18, s * 0.17)); },
  extra: (g, rear, front) => { for (let i = 0; i < 5; i++) { const q = cone(0.05 + i * 0.012, 0.28 + i * 0.05, D, 5); q.position.set(-0.42 + i * 0.22, 0.86 + i * 0.07, 0); q.rotation.z = -0.25; g.add(q); } front.add(at(cone(0.06, 0.34, D, 5), 0.05, 0.46, 0, 0, 0, -0.2)); } }); }
export function stalker() { const M = mat('#6a5a99', { roughness: 0.4, metalness: 0.3 }), G = glow('#7fe04f'); return dog({ m: M, lm: mat('#4d4178', { metalness: 0.3 }), h: 1.22, len: 0.72, rise: 0.0, hip: 0.13, chest: 0.17, w: 0.13, th: 0.7, sh: 0.72, r: 0.028, rate: 7, amp: 0.85, hop: 0.24, run: 7.5, nk: -0.95, tn: 9, tr: 0.035, tl: 0.17, tip: G,
  head: (n) => { n.add(at(cap(0.04, 0.3, M), 0, 0, 0, 0, 0, Math.PI / 2 + 0.3)); const h = at(sph(0.13, 1.35, 0.72, 0.9, M), 0.34, 0.1, 0); n.add(h); [[0.14, 0.05, 0.08], [0.14, 0.05, -0.08], [0.08, 0.08, 0.12], [0.08, 0.08, -0.12], [0.03, 0.09, 0.05], [0.03, 0.09, -0.05]].forEach(([x, y, z]) => h.add(at(sph(0.024, 1, 1, 1, G), x, y, z))); for (const s of [-1, 1]) h.add(at(cone(0.022, 0.2, mat('#d8d0e8'), 4), 0.17, -0.11, s * 0.06, Math.PI, 0, 0.3)); } }); }
export function plated() { const M = mat('#8d97a3', { metalness: 0.7, roughness: 0.28 }), D = mat('#3c444e', { metalness: 0.5 }), G = glow('#7fe04f'); return dog({ m: D, lm: D, fm: M, h: 0.66, len: 0.9, rise: 0.06, hip: 0.25, chest: 0.3, w: 0.2, th: 0.32, sh: 0.34, r: 0.065, rate: 10, amp: 0.8, hop: 0.16, run: 8, tn: 5, tr: 0.085, tl: 0.13,
  head: (n) => { const h = at(sph(0.2, 1.3, 0.72, 0.9, M), 0.16, 0.06, 0); n.add(h); h.add(at(cone(0.09, 0.36, M, 5), 0.24, 0.1, 0, 0, 0, -0.9)); for (const s of [-1, 1]) { h.add(at(sph(0.04, 1.4, 0.7, 0.7, G), 0.08, 0.05, s * 0.16)); h.add(at(cone(0.05, 0.28, M, 5), -0.12, 0.12, s * 0.12, s * 0.5, 0, 0.9)); } },
  extra: (g) => { for (let i = 0; i < 6; i++) { const x = 0.52 - i * 0.21, r = 0.3 + Math.sin(i / 5 * Math.PI) * 0.08, p = sph(r, 0.5, 0.82, 1.02, M); p.position.set(x, 0.74 + (1 - i / 5) * 0.06, 0); p.rotation.z = -0.25; g.add(p); const s = sph(r * 1.02, 0.09, 0.8, 1.04, G); s.position.set(x - r * 0.46, 0.74 + (1 - i / 5) * 0.06, 0); s.rotation.z = -0.25; g.add(s); } } }); }

// ---------- the orc army (Sean's reference sheets, 2026-11-16): chunky and green, in hide and iron with red pads on their shoulders: grunts with axes, archers, brutes with spiked clubs, wolf riders, shamans
const OC = { skin: '#6f9a3c', hide: '#6a5038', iron: '#8a9098', red: '#a8301f', bone: '#e6dcc0', wood: '#5a4028', fur: '#5d5850', robe: '#3d2f4a' };
// the build they share, k its size: a stocky trunk, a heavy jaw with tusks, red eyes, pointed ears, pads on the shoulders; its parts come back to be posed and armed
function orc(k = 1, o = {}) {
  const g = new THREE.Group(), skin = mat(OC.skin, { metalness: 0.05, roughness: 0.8 }), hide = mat(o.robe || OC.hide, { metalness: 0.05, roughness: 0.9 }), iron = mat(OC.iron, { metalness: 0.6, roughness: 0.4 }), red = mat(OC.red, { metalness: 0.1 }), bone = mat(OC.bone, { metalness: 0, roughness: 0.7 }), wood = mat(OC.wood, { metalness: 0, roughness: 0.9 }), body = new THREE.Group();
  body.position.y = 0.8 * k; g.add(body); body.add(at(sph(0.25 * k, 1.2, 1.15, 0.85, hide), 0, 0.3 * k, 0)); body.add(at(sph(0.21 * k, 1.2, 0.5, 0.9, iron), 0, 0.04 * k, 0));
  const head = at(sph(0.17 * k, 1.05, 1, 1, skin), 0, 0.7 * k, 0.03 * k); body.add(head); head.add(at(sph(0.12 * k, 1.2, 0.7, 0.95, skin), 0, -0.09 * k, 0.07 * k));
  for (const s of [-1, 1]) { head.add(at(cone(0.024 * k, 0.1 * k, bone, 5), s * 0.075 * k, -0.05 * k, 0.16 * k, -0.25, 0, 0)); head.add(at(sph(0.024 * k, 1.2, 0.7, 0.6, glow('#ff4a22')), s * 0.065 * k, 0.045 * k, 0.15 * k)); head.add(at(cone(0.04 * k, 0.13 * k, skin, 4), s * 0.18 * k, 0.04 * k, -0.01 * k, 0, 0, s * -1.25)); }
  if (o.helm) head.add(at(sph(0.178 * k, 1.08, 0.72, 1.06, iron), 0, 0.075 * k, -0.01 * k));
  if (!o.bare) for (const s of [-1, 1]) body.add(at(sph(0.13 * k, 1.15, 0.7, 1.05, o.pads === 'iron' ? iron : red), s * 0.31 * k, 0.52 * k, 0));
  const A = [-1, 1].map((s) => { const L = limb(0.3 * k, 0.3 * k, 0.075 * k, skin); at(L.hip, s * 0.34 * k, 0.47 * k, 0, 0, 0, s * 0.16); body.add(L.hip); return L; });
  const F = o.legs === false ? [] : [-1, 1].map((s) => { const L = limb(0.37 * k, 0.37 * k, 0.09 * k, hide, mat('#33271c')); at(L.hip, s * 0.13 * k, 0.8 * k, 0); g.add(L.hip); return L; });
  return { g, body, head, A, F, skin, hide, iron, red, bone, wood, k };
}
// their walk: a heavy stride, the trunk rolling over it
const tramp = (P, p, sw = 0.6) => { P.F.forEach((L, i) => { const q = p + i * Math.PI; L.hip.rotation.x = Math.sin(q) * sw; L.knee.rotation.x = Math.max(0, Math.cos(q)) * 0.9; }); P.g.position.y = Math.abs(Math.sin(p)) * 0.04 * P.k; P.body.rotation.z = Math.sin(p) * 0.06; };
export function orcGrunt() { // an axe held up in one hand
  const P = orc(1), g = P.g, haft = at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 5), P.wood), 0, -0.3, 0.14, 1.25, 0, 0); P.A[1].knee.add(haft); haft.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.26), P.iron), 0, 0.3, 0.1));
  g.step = (t) => { const p = t * 6; tramp(P, p); P.A[0].hip.rotation.x = Math.sin(p) * 0.5; P.A[1].hip.rotation.x = -1.0 + Math.sin(p * 2) * 0.12; P.A[1].knee.rotation.x = -0.5; P.head.rotation.y = Math.sin(p) * 0.15; };
  g.speed = 2.6; g.rate = 6; g.forwardZ = true; return g;
}
export function orcArcher() { // leaner, hooded, the bow held out and the string drawn; a quiver on the back
  const P = orc(0.92, { bare: true }), g = P.g; P.head.add(at(cone(0.2, 0.3, P.red, 6), 0, 0.12, -0.03));
  P.A[0].knee.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 4, 10, Math.PI), P.wood), 0, -0.3, 0.05, 0, Math.PI / 2, Math.PI / 2)); P.body.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 6), P.hide), 0.1, 0.4, -0.2, 0.3, 0, -0.3));
  g.step = (t) => { const p = t * 6; tramp(P, p, 0.5); P.A[0].hip.rotation.x = -1.35; P.A[0].knee.rotation.x = -0.1; P.A[1].hip.rotation.x = -1.1 + Math.sin(p) * 0.1; P.A[1].knee.rotation.x = -1.5; P.head.rotation.y = Math.sin(p) * 0.1; };
  g.speed = 2; g.rate = 6; g.forwardZ = true; return g;
}
export function orcBrute() { // half as big again, helmed, iron on its shoulders, a spiked club
  const P = orc(1.5, { pads: 'iron', helm: true }), g = P.g, club = at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.05, 1.0, 7), P.wood), 0, -0.42, 0.2, 1.3, 0, 0); P.A[1].knee.add(club);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; club.add(at(cone(0.035, 0.12, P.iron, 4), Math.cos(a) * 0.11, 0.3 + (i % 2) * 0.12, Math.sin(a) * 0.11, Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57)); }
  g.step = (t) => { const p = t * 4.5; tramp(P, p, 0.5); P.A[0].hip.rotation.x = Math.sin(p) * 0.4; P.A[0].hip.rotation.z = -0.35; P.A[1].hip.rotation.x = -0.7 + Math.sin(p) * 0.15; P.A[1].knee.rotation.x = -0.4; P.body.rotation.x = 0.12; };
  g.speed = 1.9; g.rate = 4.5; g.forwardZ = true; return g;
}
export function wolfRider() { // a grey wolf at a gallop, a small orc with a spear on its back
  const fur = mat(OC.fur, { metalness: 0.05, roughness: 0.9 }), dark = mat('#3a3632', { metalness: 0.05, roughness: 0.9 });
  return dog({ m: fur, lm: dark, h: 0.72, len: 1.0, rise: 0.06, hip: 0.2, chest: 0.27, w: 0.13, th: 0.38, sh: 0.4, r: 0.05, rate: 10, amp: 0.9, hop: 0.18, run: 8, tn: 5, tl: 0.14, tr: 0.06,
    head: (n) => { n.add(at(cap(0.09, 0.2, fur), 0, 0, 0, 0, 0, Math.PI / 2 + 0.7)); const h = at(sph(0.14, 1.2, 0.9, 0.9, fur), 0.22, 0.16, 0); n.add(h); h.add(at(cone(0.08, 0.26, dark), 0.2, -0.03, 0, 0, 0, -Math.PI / 2)); for (const s of [-1, 1]) { h.add(at(sph(0.03, 1.4, 0.7, 0.6, glow('#ffb02a')), 0.09, 0.05, s * 0.09)); h.add(at(cone(0.045, 0.16, fur, 4), -0.06, 0.15, s * 0.08, 0, 0, 0.3)); } },
    extra: (g) => { const P = orc(0.78, { legs: false }); P.g.rotation.y = Math.PI / 2; P.g.position.set(-0.05, 0.38, 0); g.add(P.g); P.A[1].hip.rotation.x = -1.3; P.A[0].hip.rotation.x = -0.8; const spear = at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5), P.wood), 0, -0.24, 0.1, 1.45, 0, 0); P.A[1].knee.add(spear); spear.add(at(cone(0.04, 0.16, P.iron, 4), 0, 0.72, 0)); for (const s of [-1, 1]) { const L = limb(0.26, 0.24, 0.07, P.hide); at(L.hip, s * 0.2, 0.62, 0, -1.2, 0, s * 0.5); L.knee.rotation.x = 1.3; P.g.add(L.hip); } } });
}
export function orcShaman() { // robed, a crest of feathers and bone, a skull on a staff with green fire over it and in the other hand
  const P = orc(0.96, { robe: OC.robe, bare: true }), g = P.g, G = glow('#7dff4a'); P.body.add(at(cone(0.34, 0.75, P.hide, 8), 0, -0.3, 0));
  for (let i = -2; i <= 2; i++) P.head.add(at(cone(0.03, 0.24, i % 2 ? P.red : P.bone, 4), i * 0.06, 0.2 - Math.abs(i) * 0.02, -0.04, -0.3, 0, -i * 0.25));
  const staff = at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.6, 5), P.wood), 0, -0.28, 0.1, 1.5, 0, 0); P.A[1].knee.add(staff); staff.add(at(sph(0.08, 1, 1.1, 1, P.bone), 0, 0.84, 0)); staff.add(at(sph(0.06, 1, 1, 1, G), 0, 1.0, 0)); P.A[0].knee.add(at(sph(0.07, 1, 1, 1, G), 0, -0.34, 0));
  g.step = (t) => { const p = t * 5; tramp(P, p, 0.35); P.A[1].hip.rotation.x = -1.2; P.A[1].knee.rotation.x = -0.3; P.A[0].hip.rotation.x = -0.9 + Math.sin(p) * 0.3; P.A[0].hip.rotation.z = -0.5; P.head.rotation.x = Math.sin(p * 2) * 0.06; };
  g.speed = 1.8; g.rate = 5; g.forwardZ = true; return g;
}
// ---------- the robot army (Sean's sheets, 2026-11-16: "like terminators from the future"): gunmetal and steel, a red visor or one red eye: combat bots with a rifle for a forearm, assault bots half as big
// again with a cannon on each shoulder, spider bots on four jointed legs, sentry drones hovering on four rotors
const RB = { steel: '#8f99a5', gun: '#4d5560', dark: '#262a30', red: '#ff3020' };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
// the walking kind's build, k its size: a boxed trunk and hips, a square head with a red visor and an aerial, ball joints at the shoulders, plated limbs; its parts come back to be posed and armed
function bot(k = 1, o = {}) {
  const g = new THREE.Group(), steel = mat(RB.steel, { metalness: 0.7, roughness: 0.35 }), gun = mat(o.body || RB.gun, { metalness: 0.6, roughness: 0.45 }), dark = mat(RB.dark, { metalness: 0.5, roughness: 0.5 }), R = glow(RB.red), body = new THREE.Group();
  body.position.y = 0.84 * k; g.add(body); body.add(at(box(0.44 * k, 0.46 * k, 0.26 * k, gun), 0, 0.36 * k, 0)); body.add(at(box(0.3 * k, 0.16 * k, 0.2 * k, dark), 0, 0.05 * k, 0)); body.add(at(box(0.2 * k, 0.12 * k, 0.03 * k, steel), 0, 0.42 * k, 0.135 * k));
  const head = at(box(0.2 * k, 0.2 * k, 0.2 * k, steel), 0, 0.74 * k, 0.01 * k); body.add(head); head.add(at(box(0.16 * k, 0.045 * k, 0.03 * k, R), 0, 0.02 * k, 0.1 * k)); head.add(at(box(0.012 * k, 0.12 * k, 0.012 * k, dark), 0.07 * k, 0.16 * k, -0.05 * k));
  for (const s of [-1, 1]) body.add(at(sph(0.085 * k, 1, 1, 1, dark), s * 0.27 * k, 0.52 * k, 0));
  const A = [-1, 1].map((s) => { const L = limb(0.3 * k, 0.3 * k, 0.055 * k, steel, dark); at(L.hip, s * 0.3 * k, 0.52 * k, 0, 0, 0, s * 0.1); body.add(L.hip); return L; });
  const F = [-1, 1].map((s) => { const L = limb(0.4 * k, 0.4 * k, 0.07 * k, gun, dark); at(L.hip, s * 0.12 * k, 0.84 * k, 0); g.add(L.hip); return L; });
  return { g, body, head, A, F, steel, gun, dark, R, k };
}
// their march: stiff and in step, the trunk level
const march = (P, p, sw = 0.5) => { P.F.forEach((L, i) => { const q = p + i * Math.PI; L.hip.rotation.x = Math.sin(q) * sw; L.knee.rotation.x = Math.max(0, Math.cos(q)) * 0.8; }); P.g.position.y = Math.abs(Math.sin(p)) * 0.025 * P.k; };
export function combatBot() { // a rifle for a right forearm, held level, its head turning from side to side
  const P = bot(1), g = P.g; P.A[1].knee.add(at(box(0.07, 0.5, 0.07, P.dark), 0, -0.42, 0.03)); P.A[1].knee.add(at(sph(0.03, 1, 1, 1, P.R), 0, -0.68, 0.03));
  g.step = (t) => { const p = t * 6; march(P, p); P.A[0].hip.rotation.x = Math.sin(p + Math.PI) * 0.4; P.A[1].hip.rotation.x = -0.75; P.A[1].knee.rotation.x = -0.8; P.head.rotation.y = Math.sin(p * 0.5) * 0.3; };
  g.speed = 2.6; g.rate = 6; g.forwardZ = true; return g;
}
export function assaultBot() { // half as big again, plated, a cannon on each shoulder, a red core in its chest
  const P = bot(1.45, { body: '#3f464f' }), g = P.g, k = P.k;
  for (const s of [-1, 1]) { P.body.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * k, 0.07 * k, 0.5 * k, 8), P.dark), s * 0.3 * k, 0.68 * k, 0.08 * k, Math.PI / 2, 0, 0)); P.body.add(at(sph(0.035 * k, 1, 1, 1, P.R), s * 0.3 * k, 0.68 * k, 0.34 * k)); P.body.add(at(box(0.2 * k, 0.1 * k, 0.3 * k, P.steel), s * 0.3 * k, 0.6 * k, 0)); }
  P.body.add(at(sph(0.07 * k, 1, 1, 0.5, P.R), 0, 0.38 * k, 0.135 * k));
  g.step = (t) => { const p = t * 4.5; march(P, p, 0.4); P.A.forEach((L, i) => { L.hip.rotation.x = Math.sin(p + i * Math.PI) * 0.3; L.knee.rotation.x = -0.4; }); P.body.rotation.y = Math.sin(p) * 0.08; };
  g.speed = 1.9; g.rate = 4.5; g.forwardZ = true; return g;
}
export function spiderBot() { // a low steel body on four jointed legs, a dome with one red eye, a gun under its chin
  const g = new THREE.Group(), steel = mat(RB.steel, { metalness: 0.7, roughness: 0.35 }), gun = mat(RB.gun, { metalness: 0.6, roughness: 0.45 }), dark = mat(RB.dark, { metalness: 0.5 }), R = glow(RB.red), body = new THREE.Group(); body.position.y = 0.55; g.add(body);
  body.add(sph(0.3, 1.2, 0.5, 1.4, gun)); body.add(at(sph(0.18, 1, 0.8, 1, steel), 0, 0.14, 0.1)); body.add(at(sph(0.06, 1, 1, 0.6, R), 0, 0.16, 0.27)); body.add(at(box(0.05, 0.05, 0.3, dark), 0, -0.02, 0.45));
  const L = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => { const q = limb(0.42, 0.62, 0.04, steel, dark), piv = new THREE.Group(); piv.position.set(sx * 0.26, 0.02, sz * 0.3); piv.rotation.y = Math.atan2(sx, sz * 0.8); body.add(piv); piv.add(q.hip); return q; });
  g.step = (t) => { const p = t * 9; L.forEach((q, i) => { const ph = p + (i === 0 || i === 3 ? 0 : Math.PI), lift = Math.max(0, Math.sin(ph)); q.hip.rotation.x = -1.9 + lift * 0.35 + Math.cos(ph) * 0.12; q.knee.rotation.x = 1.75 - lift * 0.3; }); body.position.y = 0.55 + Math.sin(p * 2) * 0.015; body.rotation.z = Math.sin(p) * 0.03; };
  g.speed = 4.6; g.rate = 9; g.forwardZ = true; return g;
}
export function sentryDrone() { // it hovers at chest height on four rotors, a gun slung under its one red eye
  const g = new THREE.Group(), steel = mat(RB.steel, { metalness: 0.7, roughness: 0.35 }), gun = mat(RB.gun, { metalness: 0.6, roughness: 0.45 }), dark = mat(RB.dark, { metalness: 0.5 }), R = glow(RB.red), body = new THREE.Group(); body.position.y = 1.35; g.add(body);
  body.add(sph(0.2, 1.1, 0.75, 1.3, gun)); body.add(at(sph(0.07, 1, 1, 0.6, R), 0, 0, 0.24)); body.add(at(box(0.06, 0.06, 0.34, dark), 0, -0.14, 0.12)); body.add(at(sph(0.025, 1, 1, 1, R), 0, -0.14, 0.3));
  const rot = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => { body.add(at(box(0.04, 0.03, 0.34, steel), sx * 0.2, 0.04, sz * 0.2, 0, Math.atan2(sx, sz), 0)); const d = at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 10), dark), sx * 0.32, 0.09, sz * 0.32); body.add(d); return d; });
  g.step = (t) => { const p = t * 7; body.position.y = 1.35 + Math.sin(p) * 0.06; body.rotation.x = 0.12 + Math.sin(p) * 0.04; body.rotation.z = Math.sin(p * 0.5 + 1) * 0.06; rot.forEach((d, i) => { d.rotation.y = p * 3 + i; }); };
  g.speed = 3.2; g.rate = 7; g.forwardZ = true; return g;
}
// ---------- the Invading army (Sean's sheets, 2026-11-16): soldiers in dark blue armour with sand webbing, a round helmet and a blue visor: infantry with a rifle across the chest, shield troopers half
// as big again behind a tall shield with a baton, energy troopers with a pack and a glowing lance, scouts light and running low with a blade
const IV = { arm: '#4467a8', plate: '#8fa4c8', dark: '#1c222c', sand: '#b9a77a', blue: '#4ac8ff' };
function soldier(k = 1, o = {}) {
  const g = new THREE.Group(), arm = mat(o.body || IV.arm, { metalness: 0.3, roughness: 0.6 }), plate = mat(IV.plate, { metalness: 0.55, roughness: 0.4 }), dark = mat(IV.dark, { metalness: 0.3, roughness: 0.6 }), sand = mat(IV.sand, { metalness: 0.05, roughness: 0.9 }), B = glow(IV.blue), body = new THREE.Group();
  body.position.y = 0.84 * k; g.add(body); body.add(at(sph(0.24 * k, 1, 1.1, 0.7, arm), 0, 0.34 * k, 0)); body.add(at(box(0.36 * k, 0.26 * k, 0.05 * k, plate), 0, 0.4 * k, 0.14 * k)); body.add(at(box(0.4 * k, 0.07 * k, 0.3 * k, sand), 0, 0.12 * k, 0)); body.add(at(box(0.3 * k, 0.14 * k, 0.2 * k, dark), 0, 0.02 * k, 0));
  const head = at(sph(0.13 * k, 1, 1, 1, dark), 0, 0.72 * k, 0.01 * k); body.add(head); head.add(at(sph(0.155 * k, 1.05, 0.75, 1.1, plate), 0, 0.05 * k, -0.01 * k)); head.add(at(box(0.2 * k, 0.05 * k, 0.04 * k, B), 0, 0, 0.125 * k));
  for (const s of [-1, 1]) body.add(at(sph(0.1 * k, 1.1, 0.7, 1, plate), s * 0.28 * k, 0.54 * k, 0));
  const A = [-1, 1].map((s) => { const L = limb(0.3 * k, 0.3 * k, 0.06 * k, arm, dark); at(L.hip, s * 0.3 * k, 0.5 * k, 0, 0, 0, s * 0.1); body.add(L.hip); return L; });
  const F = [-1, 1].map((s) => { const L = limb(0.4 * k, 0.4 * k, 0.075 * k, arm, dark); at(L.hip, s * 0.12 * k, 0.84 * k, 0); g.add(L.hip); return L; });
  return { g, body, head, A, F, arm, plate, dark, sand, B, k };
}
export function invInfantry() { // a rifle held across the chest in both hands, a pack on the back
  const P = soldier(1), g = P.g; P.body.add(at(box(0.26, 0.3, 0.12, P.sand), 0, 0.36, -0.2)); const rifle = at(box(0.05, 0.07, 0.7, P.dark), -0.16, -0.3, 0.1, 0.2, 0.5, 0); P.A[1].knee.add(rifle); rifle.add(at(sph(0.025, 1, 1, 1, P.B), 0, 0, 0.36));
  g.step = (t) => { const p = t * 6; march(P, p, 0.55); P.A[1].hip.rotation.x = -0.6; P.A[1].knee.rotation.x = -1.2; P.A[1].hip.rotation.z = 0.25; P.A[0].hip.rotation.x = -0.9; P.A[0].knee.rotation.x = -0.9; P.A[0].hip.rotation.z = -0.45; P.body.rotation.y = Math.sin(p) * 0.08; };
  g.speed = 2.7; g.rate = 6; g.forwardZ = true; return g;
}
export function invShield() { // half as big again, a tall shield with a blue slit held in front, a baton in the other hand
  const P = soldier(1.4, { body: '#35528c' }), g = P.g, k = P.k, sh = at(box(0.62 * k, 1.05 * k, 0.05 * k, P.plate), 0.2 * k, -0.2 * k, 0.2 * k, 1.35, 0, 0); P.A[0].knee.add(sh); sh.add(at(box(0.36 * k, 0.05 * k, 0.02 * k, P.B), 0, 0.3 * k, 0.03 * k)); sh.add(at(box(0.5 * k, 0.07 * k, 0.02 * k, P.sand), 0, -0.2 * k, 0.03 * k));
  const bat = at(new THREE.Mesh(new THREE.CylinderGeometry(0.03 * k, 0.03 * k, 0.6 * k, 6), P.dark), 0, -0.36 * k, 0.16 * k, 1.2, 0, 0); P.A[1].knee.add(bat); bat.add(at(sph(0.045 * k, 1, 1.6, 1, P.B), 0, 0.3 * k, 0));
  g.step = (t) => { const p = t * 4.5; march(P, p, 0.4); P.A[0].hip.rotation.x = -1.25; P.A[0].knee.rotation.x = -0.15; P.A[1].hip.rotation.x = -0.6 + Math.sin(p) * 0.2; P.A[1].knee.rotation.x = -0.6; P.body.rotation.x = 0.1; };
  g.speed = 1.9; g.rate = 4.5; g.forwardZ = true; return g;
}
export function invEnergy() { // a power pack with two glowing cells on the back, a long lance held level, its tip alight
  const P = soldier(1.04), g = P.g; P.body.add(at(box(0.34, 0.4, 0.16, P.dark), 0, 0.38, -0.22)); for (const s of [-1, 1]) P.body.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), P.B), s * 0.09, 0.4, -0.31));
  const lance = at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.0, 7), P.plate), 0, -0.3, 0.3, 1.5, 0, 0); P.A[1].knee.add(lance); lance.add(at(sph(0.075, 1, 1.5, 1, P.B), 0, 0.55, 0)); lance.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 10), P.B), 0, 0.3, 0, Math.PI / 2, 0, 0));
  g.step = (t) => { const p = t * 5.5; march(P, p, 0.45); P.A[1].hip.rotation.x = -0.9; P.A[1].knee.rotation.x = -0.5; P.A[0].hip.rotation.x = -1.0; P.A[0].knee.rotation.x = -0.7; P.A[0].hip.rotation.z = -0.5; P.head.rotation.y = Math.sin(p * 0.5) * 0.2; };
  g.speed = 2.1; g.rate = 5.5; g.forwardZ = true; return g;
}
export function invScout() { // smaller and light, bent low at a run, a blade held back in one hand
  const P = soldier(0.9, { body: '#5578b4' }), g = P.g; const bl = at(box(0.03, 0.5, 0.07, P.plate), 0, -0.5, 0.02); P.A[1].knee.add(bl); bl.add(at(box(0.035, 0.44, 0.02, P.B), 0, 0, 0.04));
  g.step = (t) => { const p = t * 10; march(P, p, 0.95); P.body.rotation.x = 0.42; P.A[0].hip.rotation.x = Math.sin(p + Math.PI) * 0.9; P.A[0].knee.rotation.x = -1.0; P.A[1].hip.rotation.x = 0.7 + Math.sin(p) * 0.25; P.A[1].knee.rotation.x = -0.3; P.g.position.y = Math.abs(Math.sin(p)) * 0.07; };
  g.speed = 4.8; g.rate = 10; g.forwardZ = true; return g;
}
// ---------- the Walking trees (Sean's sheet, 2026-11-16; rebuilt the same day: "Can the trees look more tree like? Like the examples I provided?"): a gnarled trunk that splits into spreading
// branches with clumps of leaves at their tips, a face in the bark, long arms ending in twig claws, short legs on splayed roots: tree ents; walking pines (the living forest); the root walker, dead wood
// with bare antlers on a tangle of roots, fire in its mouth; the spirit tree, alight with green; the forest golem, a broad body of wood under leaves
const TR = { bark: '#6b4a2c', dark: '#3d2a18', leaf: '#4f9a35', leaf2: '#7fbf3f', pine: '#2f6a34', pine2: '#3f8a3c', moss: '#5c7a2e', amber: '#ffb02a', fire: '#ff7a1a', spirit: '#8dff3a', dead: '#5c4a38' };
const TM = (c) => mat(c, { metalness: 0.02, roughness: 0.92 });
const twig = (r0, r1, l, m, n = 6) => { const q = new THREE.CylinderGeometry(r1, r0, l, n); q.translate(0, l / 2, 0); return new THREE.Mesh(q, m); }; // grows up from its joint
// roots spread from a foot: three toes lying on the ground
const toes = (L, b, k, m) => { for (let i = -1; i <= 1; i++) L.knee.add(at(cone(0.045 * k, 0.3 * k, m, 5), i * 0.07 * k, -b + 0.02 * k, 0.1 * k, Math.PI / 2, 0, -i * 0.5)); };
// a face in the bark: slanted amber eyes under a brow, a jagged mouth
function face(p, k, y, z, E, dark, mouth) { for (const s of [-1, 1]) { p.add(at(sph(0.04 * k, 1.4, 0.65, 0.6, E), s * 0.085 * k, y, z, 0, 0, s * -0.45)); p.add(at(box(0.13 * k, 0.035 * k, 0.05 * k, dark), s * 0.09 * k, y + 0.06 * k, z + 0.005 * k, 0, 0, s * -0.5)); } p.add(at(box(0.2 * k, 0.06 * k, 0.04 * k, mouth || dark), 0, y - 0.17 * k, z + 0.01 * k)); for (let i = -1; i <= 1; i++) p.add(at(cone(0.022 * k, 0.07 * k, dark, 4), i * 0.06 * k, y - 0.15 * k, z + 0.03 * k, Math.PI, 0, 0)); p.add(at(cone(0.04 * k, 0.16 * k, dark, 5), 0, y - 0.05 * k, z + 0.05 * k, 1.3, 0, 0)); }
// the spreading top: n branches out and up from the crown's root, each forked, leaves at the tips (bare: none, more forks)
function boughs(crown, k, n, P, o = {}) { for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n + 0.5, t = 0.55 + (i % 3) * 0.2, len = (0.55 + (i % 2) * 0.2) * k, b = at(twig(0.075 * k, 0.03 * k, len, P.bark), 0, 0, 0, Math.cos(a) * t, 0, -Math.sin(a) * t); crown.add(b);
    const f1 = at(twig(0.035 * k, 0.012 * k, len * 0.6, P.bark, 5), 0, len * 0.55, 0, 0.7, a, 0.5), f2 = at(twig(0.03 * k, 0.01 * k, len * 0.5, P.bark, 5), 0, len * 0.95, 0, -0.5, a, -0.6); b.add(f1); b.add(f2);
    if (o.bare) { b.add(at(twig(0.025 * k, 0.008 * k, len * 0.45, P.bark, 4), 0, len * 0.3, 0, -0.8, a + 1, 0.4)); f1.add(at(twig(0.016 * k, 0.006 * k, len * 0.3, P.bark, 4), 0, len * 0.4, 0, 0.6, 0, -0.7)); continue; }
    b.add(at(sph(0.19 * k, 1.25, 0.6, 1.25, i % 2 ? P.leaf : P.leaf2), 0, len * 1.02, 0)); f1.add(at(sph(0.14 * k, 1.2, 0.6, 1.2, i % 2 ? P.leaf2 : P.leaf), 0, len * 0.6, 0)); f2.add(at(sph(0.12 * k, 1.2, 0.6, 1.2, o.tip || P.leaf), 0, len * 0.5, 0)); } }
function ent(k = 1, o = {}) {
  const g = new THREE.Group(), P = { g, k, bark: TM(o.bark || TR.bark), dark: TM(TR.dark), leaf: TM(o.leaf || TR.leaf), leaf2: TM(o.leaf2 || TR.leaf2), moss: TM(TR.moss), E: glow(o.eye || TR.amber) }, body = P.body = new THREE.Group(); body.position.y = 0.55 * k; g.add(body);
  body.add(twig(0.33 * k, 0.21 * k, 0.75 * k, P.bark, 7)); const up = at(twig(0.22 * k, 0.15 * k, 0.5 * k, P.bark, 7), 0.02 * k, 0.7 * k, 0, 0, 0, 0.13); body.add(up); body.add(at(sph(0.16 * k, 1, 0.8, 0.8, P.bark), -0.16 * k, 0.55 * k, -0.08 * k)); body.add(at(sph(0.13 * k, 1.3, 0.5, 0.7, P.moss), 0.1 * k, 0.9 * k, 0.12 * k));
  face(body, k, 0.52 * k, 0.24 * k, P.E, P.dark, o.mouth);
  const crown = P.crown = new THREE.Group(); crown.position.set(-0.04 * k, 1.15 * k, 0); body.add(crown); boughs(crown, k, o.n || 5, P, o);
  P.A = [-1, 1].map((s) => { const L = limb(0.44 * k, 0.46 * k, 0.07 * k, P.bark, P.dark); at(L.hip, s * 0.27 * k, 0.95 * k, 0, 0, 0, s * 0.45); body.add(L.hip); for (let i = -1; i <= 1; i++) L.knee.add(at(cone(0.022 * k, 0.24 * k, P.dark, 4), i * 0.05 * k, -0.55 * k, 0, Math.PI, 0, i * 0.45)); if (!o.bare) body.add(at(sph(0.12 * k, 1.2, 0.6, 1.2, P.leaf), s * 0.3 * k, 1.02 * k, -0.02 * k)); return L; });
  P.F = [-1, 1].map((s) => { const L = limb(0.3 * k, 0.3 * k, 0.11 * k, P.bark, P.dark); at(L.hip, s * 0.17 * k, 0.6 * k, 0, 0, 0, s * 0.12); g.add(L.hip); toes(L, 0.3 * k, k, P.bark); return L; });
  return P;
}
// their walk: slow and swaying, the boughs rolling after the trunk
const sway = (P, p, sw = 0.5) => { P.F.forEach((L, i) => { const q = p + i * Math.PI; L.hip.rotation.x = Math.sin(q) * sw; L.knee.rotation.x = Math.max(0, Math.cos(q)) * 0.8; }); P.g.position.y = Math.abs(Math.sin(p)) * 0.035 * P.k; P.body.rotation.z = Math.sin(p) * 0.07; P.crown.rotation.z = Math.sin(p - 0.8) * 0.09; P.crown.rotation.x = Math.sin(p * 2) * 0.04; };
export function sapling() { // the living forest: a pine on the move, three tiers of needles over a short trunk, twig arms, small roots
  const k = 0.82, g = new THREE.Group(), bark = TM(TR.bark), dark = TM(TR.dark), n1 = TM(TR.pine), n2 = TM(TR.pine2), E = glow(TR.amber), body = new THREE.Group(); body.position.y = 0.36 * k; g.add(body);
  body.add(twig(0.1 * k, 0.07 * k, 0.6 * k, bark)); const top = new THREE.Group(); body.add(top); top.add(at(cone(0.46 * k, 0.65 * k, n1, 8), 0, 0.72 * k, 0)); top.add(at(cone(0.36 * k, 0.6 * k, n2, 8), 0, 1.1 * k, 0)); top.add(at(cone(0.25 * k, 0.55 * k, n1, 8), 0, 1.47 * k, 0)); top.add(at(cone(0.13 * k, 0.4 * k, n2, 7), 0, 1.8 * k, 0));
  for (const s of [-1, 1]) body.add(at(sph(0.04 * k, 1.3, 0.7, 0.6, E), s * 0.07 * k, 0.33 * k, 0.085 * k, 0, 0, s * -0.4)); body.add(at(box(0.1 * k, 0.03 * k, 0.03 * k, dark), 0, 0.2 * k, 0.1 * k));
  const A = [-1, 1].map((s) => { const L = limb(0.26 * k, 0.26 * k, 0.03 * k, bark, dark); at(L.hip, s * 0.1 * k, 0.42 * k, 0.02 * k, 0, 0, s * 0.7); body.add(L.hip); return L; }), F = [-1, 1].map((s) => { const L = limb(0.19 * k, 0.19 * k, 0.055 * k, bark, dark); at(L.hip, s * 0.09 * k, 0.4 * k, 0, 0, 0, s * 0.15); g.add(L.hip); toes(L, 0.19 * k, k * 0.6, bark); return L; });
  g.step = (t) => { const p = t * 9; F.forEach((L, i) => { const q = p + i * Math.PI; L.hip.rotation.x = Math.sin(q) * 0.8; L.knee.rotation.x = Math.max(0, Math.cos(q)) * 0.8; }); g.position.y = Math.abs(Math.sin(p)) * 0.05; top.rotation.z = Math.sin(p) * 0.09; top.rotation.x = Math.sin(p * 2) * 0.05; A.forEach((L, i) => { L.hip.rotation.x = -1.1 + Math.sin(p + i * Math.PI) * 0.4; L.knee.rotation.x = -0.4; }); };
  g.speed = 3.0; g.rate = 9; g.forwardZ = true; return g;
}
export function treant() { // the tree ent: full boughs, one long arm raised to strike
  const P = ent(1.1), g = P.g;
  g.step = (t) => { const p = t * 5; sway(P, p, 0.5); P.A[0].hip.rotation.x = Math.sin(p) * 0.45; P.A[0].knee.rotation.x = -0.4; P.A[1].hip.rotation.x = -1.9 + Math.sin(p * 2) * 0.15; P.A[1].knee.rotation.x = -0.6; };
  g.speed = 2.2; g.rate = 5; g.forwardZ = true; return g;
}
export function rootWalker() { // dead wood: a hollow trunk with fire in its mouth and bare antlers, scuttling on six roots
  const g = new THREE.Group(), P = { bark: TM(TR.dead), dark: TM('#2e241a'), k: 1 }, E = glow(TR.fire), body = new THREE.Group(); body.position.y = 0.62; g.add(body);
  body.add(at(twig(0.3, 0.19, 0.8, P.bark, 7), 0, -0.2, 0, 0.25, 0, 0)); body.add(at(sph(0.17, 1, 0.9, 0.9, P.bark), 0.14, 0.1, -0.08)); face(body, 1.25, 0.28, 0.27, E, P.dark, E);
  const crown = at(new THREE.Group(), 0, 0.55, 0.14, 0.25, 0, 0); body.add(crown); boughs(crown, 0.85, 5, P, { bare: true });
  const L = [0.5, 1.57, 2.64, -0.5, -1.57, -2.64].map((a) => { const q = limb(0.42, 0.58, 0.05, P.bark, P.dark), piv = new THREE.Group(); piv.position.set(Math.sin(a) * 0.22, -0.14, Math.cos(a) * 0.22); piv.rotation.y = a; body.add(piv); piv.add(q.hip); q.knee.add(at(cone(0.025, 0.25, P.dark, 4), 0, -0.6, 0.06, 2.2, 0, 0)); return q; });
  g.step = (t) => { const p = t * 9; L.forEach((q, i) => { const ph = p + (i % 2 ? Math.PI : 0), lift = Math.max(0, Math.sin(ph)); q.hip.rotation.x = -1.85 + lift * 0.4 + Math.cos(ph) * 0.14; q.knee.rotation.x = 1.7 - lift * 0.3; }); body.position.y = 0.62 + Math.sin(p * 2) * 0.02; body.rotation.z = Math.sin(p) * 0.05; crown.rotation.z = Math.sin(p - 0.8) * 0.08; };
  g.speed = 4.4; g.rate = 9; g.forwardZ = true; return g;
}
export function spiritTree() { // an ent alight with green: its eyes, its heart, the tips of its boughs, a ball of green fire in one hand
  const G = glow(TR.spirit), P = ent(1.0, { eye: TR.spirit, mouth: G, tip: G, leaf: '#5fae3a', bark: '#5f4a30' }), g = P.g; P.body.add(at(sph(0.09, 1, 1.4, 0.5, G), 0, 0.2, 0.27)); for (const s of [-1, 1]) P.body.add(at(box(0.02, 0.3, 0.02, G), s * 0.12, 0.75, 0.17, 0, 0, s * 0.3)); P.A[1].knee.add(at(sph(0.11, 1, 1, 1, G), 0, -0.62, 0));
  g.step = (t) => { const p = t * 5; sway(P, p, 0.4); P.A[1].hip.rotation.x = -1.4 + Math.sin(p * 2) * 0.1; P.A[1].knee.rotation.x = -0.3; P.A[0].hip.rotation.x = Math.sin(p) * 0.4; P.A[0].knee.rotation.x = -0.4; };
  g.speed = 1.8; g.rate = 5; g.forwardZ = true; return g;
}
export function forestGolem() { // a broad body of wood under leaves, its head sunk between its shoulders, fists like stumps
  const k = 1.5, g = new THREE.Group(), bark = TM('#5a4028'), dark = TM(TR.dark), leaf = TM('#3f8a2e'), leaf2 = TM(TR.leaf), E = glow(TR.amber), body = new THREE.Group(); body.position.y = 0.72 * k; g.add(body);
  body.add(at(sph(0.4 * k, 1.2, 1, 0.8, bark), 0, 0.42 * k, 0)); body.add(at(sph(0.3 * k, 1.1, 0.8, 0.85, bark), 0, 0.08 * k, 0)); const head = at(sph(0.17 * k, 1, 1, 1, bark), 0, 0.82 * k, 0.1 * k); body.add(head); face(head, k * 0.8, 0.03 * k, 0.15 * k, E, dark);
  const L = [[0, 0.98, 0, 0.22], [0.36, 0.78, -0.02, 0.24], [-0.36, 0.78, -0.02, 0.24], [0.2, 0.62, 0.22, 0.2], [-0.22, 0.55, 0.22, 0.18], [0, 0.6, -0.3, 0.26], [0.26, 0.3, -0.22, 0.2], [-0.26, 0.3, -0.22, 0.2], [0.1, 0.25, 0.26, 0.16], [0.5, 0.62, 0.04, 0.16], [-0.5, 0.62, 0.04, 0.16], [-0.12, 0.9, -0.14, 0.18]];
  L.forEach(([x, y, z, r], i) => body.add(at(sph(r * k, 1.2, 0.65, 1.2, i % 2 ? leaf : leaf2), x * k, y * k, z * k, 0, i, (i % 3 - 1) * 0.3)));
  const A = [-1, 1].map((s) => { const q = limb(0.42 * k, 0.4 * k, 0.12 * k, bark, dark); at(q.hip, s * 0.5 * k, 0.66 * k, 0, 0, 0, s * 0.3); body.add(q.hip); q.knee.add(at(sph(0.17 * k, 1, 1, 1, bark), 0, -0.44 * k, 0)); q.hip.add(at(sph(0.13 * k, 1.2, 0.6, 1.2, leaf), 0, -0.2 * k, -0.06 * k)); return q; }), F = [-1, 1].map((s) => { const q = limb(0.32 * k, 0.32 * k, 0.14 * k, bark, dark); at(q.hip, s * 0.2 * k, 0.72 * k, 0, 0, 0, s * 0.1); g.add(q.hip); toes(q, 0.32 * k, k, bark); return q; });
  g.step = (t) => { const p = t * 4; F.forEach((q, i) => { const a = p + i * Math.PI; q.hip.rotation.x = Math.sin(a) * 0.4; q.knee.rotation.x = Math.max(0, Math.cos(a)) * 0.7; }); g.position.y = Math.abs(Math.sin(p)) * 0.05; body.rotation.z = Math.sin(p) * 0.08; body.rotation.x = 0.12; A.forEach((q, i) => { q.hip.rotation.x = -0.3 + Math.sin(p + (i ? 0 : Math.PI)) * 0.45; q.knee.rotation.x = -0.5; }); };
  g.speed = 1.7; g.rate = 4; g.forwardZ = true; return g;
}
export const BUILD = { sapling, treant, rootWalker, spiritTree, forestGolem, grey, mantis, squid, hound, maw, stalker, plated, orcGrunt, orcArcher, orcBrute, wolfRider, orcShaman, combatBot, assaultBot, spiderBot, sentryDrone, invInfantry, invShield, invEnergy, invScout };
const FRAMES = 10, CAP = 160, SIZE = 1.0;
function record(build) {
  const o = build(), w = new THREE.Group(); if (o.forwardZ) o.rotation.y = Math.PI / 2; w.scale.setScalar(SIZE); w.add(o); const frames = [], c = new THREE.Color(); let glass = null;
  for (let f = 0; f < FRAMES; f++) { o.step(Math.PI * 2 / o.rate * f / FRAMES); w.updateMatrixWorld(true); const parts = []; w.traverse((m) => { if (!m.isMesh) return; if (m.userData.glass) { if (!f) { const p = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld); glass = { y: p.y, r: 0.5 * SIZE }; } return; } const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(m.matrixWorld); g.deleteAttribute('uv'); c.copy(m.material.color); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g); }); frames.push(mergeGeometries(parts)); for (const g of parts) g.dispose(); }
  return { frames, glass, rate: o.rate };
}
export class CreatureLayer {
  // army: only that army's creatures are recorded (figures.js: a unit's army); none: the invasion's, as before
  constructor(scene, max, army) {
    this.scene = scene; this.kinds = []; this.byZt = new Map(); this.helmetT = ZTYPES.findIndex(z => z.id === 'soldier'); this.helm = new Uint8Array(max); this.flying = []; this.last = 0; // helm: 1 on, 2 knocked off
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: '#d6f0ff', transparent: true, opacity: 0.5, roughness: 0.04, metalness: 0.35, depthWrite: false });
    this.ball = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), glass, 80); this.ball.frustumCulled = false; this.ball.renderOrder = 2; scene.add(this.ball);
    ZTYPES.forEach((z, t) => { if (!z.creature || (z.army || null) !== (army || null)) return; const rec = record(BUILD[z.creature]), meshes = rec.frames.map((g) => { const m = new THREE.InstancedMesh(g, this.mat, CAP); m.frustumCulled = false; m.castShadow = true; m.count = 0; scene.add(m); return m; }); const kind = { rec, meshes, n: new Int32Array(FRAMES) }; this.kinds.push(kind); this.byZt.set(t, kind); });
  }
  begin() { for (const k of this.kinds) k.n.fill(0); this.balls = 0; }
  isKind(zt) { return this.byZt.has(zt); }
  // one creature, from the figure's matrix in people.sync (arr at o): true when it is drawn here in place of the figure
  put(i, zt, arr, o, t) {
    const k = this.byZt.get(zt); if (!k) { if (zt === this.helmetT) { if (!this.helm[i]) this.helm[i] = 1; if (this.helm[i] === 1) this.glass(arr, o, 1.62, 0.42, 1); } return false; }
    const f = Math.floor(((t * k.rec.rate / 6.2832 + i * 0.37) % 1) * FRAMES) % FRAMES, m = k.meshes[f], n = k.n[f]; if (n >= CAP) return true; m.instanceMatrix.array.set(arr.subarray(o, o + 16), n * 16); k.n[f] = n + 1; if (k.rec.glass) this.glass(arr, o, k.rec.glass.y, k.rec.glass.r, 0.88); return true;
  }
  glass(a, o, h, r, sy) { const n = this.balls; if (n >= 80) return; const e = this.ball.instanceMatrix.array, q = n * 16; for (let k = 0; k < 3; k++) { e[q + k] = a[o + k] * r; e[q + 4 + k] = a[o + 4 + k] * r * sy; e[q + 8 + k] = a[o + 8 + k] * r; e[q + 12 + k] = a[o + 12 + k] + a[o + 4 + k] * h; } e[q + 3] = e[q + 7] = e[q + 11] = 0; e[q + 15] = 1; this.balls = n + 1; }
  helmetOn(j) { return this.helm[j] === 1; }
  // a punch: off it comes, up and away, bouncing
  knock(j, x, y, z, dx, dz) { this.helm[j] = 2; const d = Math.hypot(dx, dz) || 1; this.flying.push({ x, y: y + 1.62, z, vx: dx / d * 7, vy: 9, vz: dz / d * 7, t: 0 }); }
  end(t) {
    const dt = Math.min(0.05, Math.max(0, t - this.last)); this.last = t; const e = this.ball.instanceMatrix.array;
    for (let i = this.flying.length - 1; i >= 0; i--) { const h = this.flying[i]; h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.vy -= 22 * dt; if (h.y < 0.5) { h.y = 0.5; h.vy = Math.abs(h.vy) * 0.55; h.vx *= 0.7; h.vz *= 0.7; } if (h.t > 3) { this.flying.splice(i, 1); continue; } const n = this.balls; if (n >= 80) continue; const q = n * 16, r = 0.42; e.fill(0, q, q + 16); e[q] = e[q + 5] = e[q + 10] = r; e[q + 12] = h.x; e[q + 13] = h.y; e[q + 14] = h.z; e[q + 15] = 1; this.balls = n + 1; }
    this.ball.count = this.balls; this.ball.instanceMatrix.needsUpdate = true;
    for (const k of this.kinds) k.meshes.forEach((m, f) => { m.count = k.n[f]; m.visible = k.n[f] > 0; if (k.n[f]) m.instanceMatrix.needsUpdate = true; });
  }
  dispose() { for (const k of this.kinds) for (const m of k.meshes) { this.scene.remove(m); m.geometry.dispose(); m.dispose(); } this.scene.remove(this.ball); this.ball.geometry.dispose(); this.ball.material.dispose(); this.ball.dispose(); this.mat.dispose(); }
}
