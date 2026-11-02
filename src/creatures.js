// Options for Sean to choose from (creatures.html, not part of the game): the alien soldiers as they are now, three other
// ground units, and four four-legged alien dogs on the run. Made of plain shapes, so a chosen one still has to be built properly.
import * as THREE from 'three';
import { figureGeometry, figureMaterial, figureAttributes, ARCHETYPES, ZTYPES } from './figures.js';
import { rng } from './textures.js';

const mat = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.25, flatShading: true, ...o });
const glow = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.5) });
const sph = (r, sx, sy, sz, m) => { const q = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); q.scale.set(sx, sy, sz); return q; };
const cap = (r, l, m) => { const g = new THREE.CapsuleGeometry(r, l, 3, 8); g.translate(0, -l / 2, 0); return new THREE.Mesh(g, m); }; // hangs from its joint
const cone = (r, h, m, n = 7) => new THREE.Mesh(new THREE.ConeGeometry(r, h, n), m);
const at = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
// a two-part limb from its joint
function limb(a, b, r, m, footM) { const hip = new THREE.Group(), knee = new THREE.Group(); hip.add(cap(r, a, m)); knee.position.y = -a; hip.add(knee); knee.add(cap(r * 0.72, b, m)); const f = sph(r * 1.05, 1.5, 0.7, 1, footM || m); f.position.y = -b; knee.add(f); return { hip, knee }; }
// a chain that ripples (tails, tentacles)
function chain(n, r0, l, m, tipM) { const root = new THREE.Group(), seg = []; let p = root; for (let i = 0; i < n; i++) { const g = new THREE.Group(), k = 1 - i / n; g.add(cap(r0 * k + 0.012, l, i === n - 1 && tipM ? tipM : m)); p.add(g); if (i) g.position.y = -l; seg.push(g); p = g; } return { root, seg }; }

// ---------- ground units
function grey() { // the classic: a huge head on a thin body
  const g = new THREE.Group(), skin = mat('#aebdb0'), eye = new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 0.12, metalness: 0.5 }), suit = mat('#59636e');
  g.add(at(sph(0.17, 1, 1.5, 0.75, suit), 0, 1.0, 0)); const head = at(sph(0.26, 1, 1.22, 1.05, skin), 0, 1.5, 0.02); g.add(head); g.add(at(sph(0.14, 0.9, 1, 0.8, skin), 0, 1.3, 0.09));
  for (const s of [-1, 1]) head.add(at(sph(0.075, 1.25, 0.72, 0.5, eye), s * 0.1, -0.02, 0.21, 0, 0, s * -0.5));
  const A = [-1, 1].map(s => { const L = limb(0.34, 0.36, 0.035, skin); at(L.hip, s * 0.18, 1.2, 0, 0, 0, s * 0.12); g.add(L.hip); return L; }), F = [-1, 1].map(s => { const L = limb(0.42, 0.44, 0.05, suit, mat('#3a424c')); at(L.hip, s * 0.09, 0.86, 0); g.add(L.hip); return L; });
  const gun = at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), mat('#c9d2dc')), 0, -0.36, 0.1); A[1].knee.add(gun); gun.add(at(sph(0.035, 1, 1, 1, glow('#7fe04f')), 0, 0, 0.16));
  g.step = (t) => { const p = t * 6; F.forEach((L, i) => { const q = p + i * Math.PI; L.hip.rotation.x = Math.sin(q) * 0.6; L.knee.rotation.x = Math.max(0, Math.cos(q)) * 0.9; }); A[0].hip.rotation.x = Math.sin(p) * 0.4; A[1].hip.rotation.x = -1.2; A[1].knee.rotation.x = -0.2; g.position.y = Math.abs(Math.sin(p)) * 0.03; head.rotation.y = Math.sin(t * 1.3) * 0.35; };
  g.speed = 3; return g;
}
function mantis() { // a tall insect, its scythes held up
  const g = new THREE.Group(), sh = mat('#6fb83c'), dark = mat('#2f5a2a'), bl = mat('#dfe7f0', { metalness: 0.7, roughness: 0.25 }), body = new THREE.Group(); body.position.set(0, 1.05, 0); body.rotation.x = 0.55; g.add(body);
  body.add(at(sph(0.18, 1, 2, 1, sh), 0, 0.28, 0)); g.add(at(sph(0.22, 1, 1, 1.9, dark), 0, 0.98, -0.38));
  const head = at(sph(0.14, 1.2, 0.8, 1, sh), 0, 0.68, 0.08); body.add(head); for (const s of [-1, 1]) head.add(at(sph(0.06, 1, 1, 1, glow('#e8ff6a')), s * 0.13, 0.03, 0.05));
  const S = [-1, 1].map(s => { const L = limb(0.34, 0.5, 0.04, dark); at(L.hip, s * 0.17, 0.48, 0.05, 0, 0, s * 0.2); body.add(L.hip); const b = at(cone(0.08, 0.85, bl, 4), 0, -0.7, 0, Math.PI); L.knee.add(b); return L; });
  const F = [[-1, 0.15], [1, 0.15], [-1, -0.25], [1, -0.25]].map(([s, z]) => { const L = limb(0.55, 0.62, 0.035, dark); at(L.hip, s * 0.13, 0.98, z, 0, 0, s * 0.55); g.add(L.hip); return L; });
  g.step = (t) => { const p = t * 7; F.forEach((L, i) => { const q = p + [0, Math.PI, Math.PI, 0][i]; L.hip.rotation.x = Math.sin(q) * 0.55; L.knee.rotation.z = (i % 2 ? -1 : 1) * (0.75 - Math.max(0, Math.cos(q)) * 0.35); }); S.forEach((L, i) => { L.hip.rotation.x = -1.1 + Math.sin(t * 2 + i) * 0.12; L.knee.rotation.x = 2.1 + Math.sin(t * 2.4 + i) * 0.14; }); head.rotation.y = Math.sin(t * 1.7) * 0.5; g.position.y = Math.abs(Math.sin(p)) * 0.04; };
  g.speed = 3.6; return g;
}
function squid() { // what is in the tripods' domes, on legs of its own
  const g = new THREE.Group(), red = mat('#c9574f', { flatShading: false, roughness: 0.65 }), ten = mat('#8e3f55'), tip = glow('#7fe04f'), top = new THREE.Group(); top.position.y = 1.02; g.add(top);
  top.add(at(sph(0.4, 1, 0.82, 1, red), 0, 0.14, 0)); top.add(at(sph(0.5, 1, 0.88, 1, new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false })), 0, 0.14, 0));
  const collar = at(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 18), mat('#c9d2dc', { metalness: 0.7, roughness: 0.3 })), 0, -0.1, 0, Math.PI / 2); top.add(collar); for (const s of [-1, 1]) top.add(at(sph(0.055, 1, 1, 1, glow('#e8ff6a')), s * 0.16, 0.14, 0.42));
  const T = []; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, c = chain(6, 0.075, 0.2, ten, tip); at(c.root, Math.cos(a) * 0.3, -0.14, Math.sin(a) * 0.3); c.root.rotation.y = -a + Math.PI / 2; top.add(c.root); T.push(c); }
  g.step = (t) => { T.forEach((c, i) => c.seg.forEach((q, k) => { q.rotation.x = (k ? 0.1 : -0.75) + Math.sin(t * 6 + i * 1.05 - k * 0.8) * (k ? 0.38 : 0.26); })); top.position.y = 1.02 + Math.sin(t * 3) * 0.05; top.rotation.z = Math.sin(t * 1.5) * 0.06; };
  g.speed = 2.4; return g;
}

// ---------- the dogs: running along +x in a gallop, the back arching
function dog(o) {
  const g = new THREE.Group(), rear = new THREE.Group(), front = new THREE.Group(), H = o.h, M = o.m; g.add(rear, front); rear.position.set(-o.len / 2, H, 0); front.position.set(o.len / 2, H + o.rise, 0);
  rear.add(sph(o.hip, 1.15, 1, 0.92, M)); front.add(sph(o.chest, 1.15, 1.05, 0.95, M));
  const mid = new THREE.Mesh(new THREE.CapsuleGeometry((o.hip + o.chest) * 0.42, o.len * 0.7, 3, 10), M); mid.rotation.z = Math.PI / 2 + Math.atan2(o.rise, o.len); mid.position.set(0, H + o.rise / 2, 0); g.add(mid); g.mid = mid;
  const w = o.w, mk = (par, x, y, s) => { const L = limb(o.th, o.sh, o.r, o.lm || M, o.fm); at(L.hip, x, y, s * w); par.add(L.hip); return L; };
  const FL = [mk(front, 0.05, -o.chest * 0.4, 1), mk(front, 0.05, -o.chest * 0.4, -1)], BL = [mk(rear, 0, -o.hip * 0.4, 1), mk(rear, 0, -o.hip * 0.4, -1)];
  const neck = at(new THREE.Group(), o.chest * 0.85, o.chest * 0.5, 0, 0, 0, o.nk || -0.5); front.add(neck); o.head(neck); const tail = chain(o.tn || 6, o.tr || 0.05, o.tl || 0.16, M, o.tip); at(tail.root, -o.hip * 0.9, o.hip * 0.3, 0, 0, 0, -0.9); rear.add(tail.root); if (o.extra) o.extra(g, rear, front);
  g.step = (t) => { const p = t * o.rate, b = Math.sin(p); rear.rotation.z = -b * 0.28; front.rotation.z = b * 0.2; g.position.y = (Math.abs(Math.sin(p + 0.8)) - 0.45) * o.hop; FL.forEach((L, i) => { const q = p + i * 0.45; L.hip.rotation.z = -0.05 + Math.sin(q) * o.amp; L.knee.rotation.z = -0.15 - Math.max(0, Math.cos(q)) * 1.2; }); BL.forEach((L, i) => { const q = p + Math.PI + i * 0.45; L.hip.rotation.z = 0.25 + Math.sin(q) * o.amp; L.knee.rotation.z = -0.65 - Math.max(0, Math.cos(q)) * 0.9; }); tail.seg.forEach((q, k) => { q.rotation.z = (k ? -0.12 : 0) + Math.sin(p - k * 0.7) * 0.22; }); neck.rotation.z = (o.nk || -0.5) + Math.sin(p + 1) * 0.1; };
  g.speed = o.run; return g;
}
function hound() { const M = mat('#c5d0dc', { metalness: 0.55, roughness: 0.35 }), G = glow('#7fe04f'); return dog({ m: M, lm: mat('#8f9aa6', { metalness: 0.5 }), h: 0.82, len: 0.95, rise: 0.05, hip: 0.17, chest: 0.25, w: 0.11, th: 0.42, sh: 0.46, r: 0.04, rate: 11, amp: 0.95, hop: 0.2, run: 9, tip: G, tn: 7, tl: 0.15,
  head: (n) => { n.add(at(cap(0.08, 0.24, M), 0, 0, 0, 0, 0, Math.PI / 2 + 0.7)); const h = at(sph(0.12, 1.2, 0.85, 0.85, M), 0.24, 0.18, 0); n.add(h); h.add(at(cone(0.09, 0.26, M), 0.2, -0.02, 0, 0, 0, -Math.PI / 2)); for (const s of [-1, 1]) { h.add(at(sph(0.035, 1.8, 0.6, 0.6, G), 0.07, 0.04, s * 0.09)); h.add(at(cone(0.04, 0.24, M, 4), -0.08, 0.14, s * 0.07, 0, 0, 0.55)); } },
  extra: (g) => { for (let i = 0; i < 4; i++) { for (const s of [-1, 1]) { const r = at(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.015), G), 0.26 - i * 0.14, 0.86, s * 0.185); r.rotation.x = s * 0.2; g.add(r); } } } }); }
function maw() { const M = mat('#3f6b4a', { roughness: 0.6 }), D = mat('#233d2e'), T = mat('#f2ead2'), G = glow('#d6ff5a'); return dog({ m: M, lm: D, h: 0.62, len: 0.75, rise: 0.22, hip: 0.2, chest: 0.42, w: 0.2, th: 0.3, sh: 0.36, r: 0.08, rate: 8.5, amp: 0.75, hop: 0.14, run: 6.5, nk: -0.1, tn: 4, tr: 0.08, tl: 0.12,
  head: (n) => { const up = at(sph(0.3, 1.25, 0.6, 1, M), 0.28, 0.14, 0, 0, 0, 0.34), lo = at(sph(0.26, 1.2, 0.42, 0.92, D), 0.25, -0.17, 0, 0, 0, -0.32); n.add(up, lo); n.add(at(sph(0.2, 1.1, 0.55, 0.8, G), 0.22, -0.02, 0)); for (let i = 0; i < 5; i++) { const z = -0.2 + i * 0.1, x = 0.56 - Math.abs(z) * 0.7; n.add(at(cone(0.035, 0.15, T, 5), x, 0.01 + x * 0.1, z, Math.PI)); n.add(at(cone(0.03, 0.13, T, 5), x - 0.03, -0.14 - x * 0.1, z)); } for (const s of [-1, 1]) up.add(at(sph(0.05, 1, 1, 1, G), 0.1, 0.18, s * 0.17)); },
  extra: (g, rear, front) => { for (let i = 0; i < 5; i++) { const q = cone(0.05 + i * 0.012, 0.28 + i * 0.05, D, 5); q.position.set(-0.42 + i * 0.22, 0.86 + i * 0.07, 0); q.rotation.z = -0.25; g.add(q); } front.add(at(cone(0.06, 0.34, D, 5), 0.05, 0.46, 0, 0, 0, -0.2)); } }); }
function stalker() { const M = mat('#6a5a99', { roughness: 0.4, metalness: 0.3 }), G = glow('#7fe04f'); return dog({ m: M, lm: mat('#4d4178', { metalness: 0.3 }), h: 1.22, len: 0.72, rise: 0.0, hip: 0.13, chest: 0.17, w: 0.13, th: 0.7, sh: 0.72, r: 0.028, rate: 7, amp: 0.85, hop: 0.24, run: 7.5, nk: -0.95, tn: 9, tr: 0.035, tl: 0.17, tip: G,
  head: (n) => { n.add(at(cap(0.04, 0.3, M), 0, 0, 0, 0, 0, Math.PI / 2 + 0.3)); const h = at(sph(0.13, 1.35, 0.72, 0.9, M), 0.34, 0.1, 0); n.add(h); [[0.14, 0.05, 0.08], [0.14, 0.05, -0.08], [0.08, 0.08, 0.12], [0.08, 0.08, -0.12], [0.03, 0.09, 0.05], [0.03, 0.09, -0.05]].forEach(([x, y, z]) => h.add(at(sph(0.024, 1, 1, 1, G), x, y, z))); for (const s of [-1, 1]) h.add(at(cone(0.022, 0.2, mat('#d8d0e8'), 4), 0.17, -0.11, s * 0.06, Math.PI, 0, 0.3)); } }); }
function plated() { const M = mat('#8d97a3', { metalness: 0.7, roughness: 0.28 }), D = mat('#3c444e', { metalness: 0.5 }), G = glow('#7fe04f'); return dog({ m: D, lm: D, fm: M, h: 0.66, len: 0.9, rise: 0.06, hip: 0.25, chest: 0.3, w: 0.2, th: 0.32, sh: 0.34, r: 0.065, rate: 10, amp: 0.8, hop: 0.16, run: 8, tn: 5, tr: 0.085, tl: 0.13,
  head: (n) => { const h = at(sph(0.2, 1.3, 0.72, 0.9, M), 0.16, 0.06, 0); n.add(h); h.add(at(cone(0.09, 0.36, M, 5), 0.24, 0.1, 0, 0, 0, -0.9)); for (const s of [-1, 1]) { h.add(at(sph(0.04, 1.4, 0.7, 0.7, G), 0.08, 0.05, s * 0.16)); h.add(at(cone(0.05, 0.28, M, 5), -0.12, 0.12, s * 0.12, s * 0.5, 0, 0.9)); } },
  extra: (g) => { for (let i = 0; i < 6; i++) { const x = 0.52 - i * 0.21, r = 0.3 + Math.sin(i / 5 * Math.PI) * 0.08, p = sph(r, 0.5, 0.82, 1.02, M); p.position.set(x, 0.74 + (1 - i / 5) * 0.06, 0); p.rotation.z = -0.25; g.add(p); const s = sph(r * 1.02, 0.09, 0.8, 1.04, G); s.position.set(x - r * 0.46, 0.74 + (1 - i / 5) * 0.06, 0); s.rotation.z = -0.25; g.add(s); } } }); }

// ---------- the page: one canvas, each tile drawn in its own square
const canvas = document.getElementById('gl'), ren = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); ren.setPixelRatio(Math.min(devicePixelRatio, 1.75)); ren.setSize(innerWidth, innerHeight, false); ren.setClearColor(0, 0); ren.autoClear = false; addEventListener('resize', () => ren.setSize(innerWidth, innerHeight, false));
const fig = figureMaterial(), tiles = [];
function current() { // the real thing, from the game's own figures
  const g = new THREE.Group(), r = rng(7); ['grunt', 'soldier'].forEach((id, i) => { const Z = ZTYPES.find(q => q.id === id), L = Z.look(ARCHETYPES[0].roll(r)); L.scale = Z.scale || 1; L.torso = Z.torso || 1; const geo = figureGeometry(), fa = figureAttributes(geo, 1); fa.write(0, L); fa.arrays.anim[0] = Z.anim; fa.dirty(); const m = new THREE.InstancedMesh(geo, fig.mat, 1); m.setMatrixAt(0, new THREE.Matrix4()); m.position.x = i ? 0.45 : -0.45; g.add(m); }); g.step = () => {}; g.speed = 2.5; return g;
}
function tile(host, name, note, obj, o = {}) {
  const card = document.createElement('div'); card.className = 'card' + (o.now ? ' now' : ''); card.innerHTML = '<div class="view"></div><div class="lbl"><b>' + name + '</b>' + note + '</div>'; document.getElementById(host).appendChild(card); card.onclick = () => card.classList.toggle('big'); const el = card.querySelector('.view');
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a2a4a', 1.5)); const sun = new THREE.DirectionalLight('#fff0d8', 2.6); sun.position.set(3, 6, 4); scene.add(sun, obj);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3346', roughness: 1 })); floor.position.y = -0.02; scene.add(floor);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(o.shadow || 0.6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35 })); scene.add(shadow);
  const dashes = []; for (let i = 0; i < 26; i++) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.04), new THREE.MeshBasicMaterial({ color: '#7a7290' })); q.position.set(-8 + i * 0.62, 0, -1.6 + (i * 7 % 13) / 13 * 3.2); scene.add(q); dashes.push(q); }
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60), d = o.d || 6; if (o.side) cam.position.set(d * 0.32, d * 0.26, d * 0.9); else cam.position.set(d * 0.55, d * 0.24, d * 0.8); cam.lookAt(0, o.look || 0.95, 0);
  if (!o.side) obj.rotation.y = 0;
  tiles.push({ el, scene, cam, obj, dashes, dir: o.side ? 1 : 0 });
}
tile('ground', 'NOW: silver soldiers', 'What level 1 uses: people-shaped in silver, green heads', current(), { now: true, d: 5.4, look: 0.9 });
tile('ground', 'A: Greys', 'The classic: huge head, black eyes, thin limbs, ray gun', grey(), { d: 5.6, look: 0.95 });
tile('ground', 'B: Mantis drones', 'Tall insects with scythes, nothing like a person', mantis(), { d: 6.4, look: 0.95 });
tile('ground', 'C: Dome walkers', 'The brain from the tripods, on six tentacles', squid(), { d: 5.8, look: 0.85 });
const D = { side: true, d: 7, look: 0.8, shadow: 0.95 };
tile('dogs', '1: Silver hound', 'Lean and fast like a greyhound, glowing ribs', hound(), D);
tile('dogs', '2: Maw', 'Mostly jaw and shoulders, spines down its back', maw(), { ...D, d: 6.4 });
tile('dogs', '3: Stalker', 'Spider-thin legs, six eyes, a whip of a tail', stalker(), { ...D, d: 8.6, look: 1.2 });
tile('dogs', '4: Plated runner', 'Armour bands with green seams, a horned head', plated(), { ...D, d: 6.6 });

let last = performance.now(), T = 0;
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt; fig.uTime.value += dt;
  ren.setScissorTest(false); ren.clear(); ren.setScissorTest(true); const H = innerHeight;
  for (const t of tiles) { const c = t.el.getBoundingClientRect(); if (c.bottom < 0 || c.top > H) continue; t.obj.step(T); const sp = t.obj.speed; for (const q of t.dashes) { if (t.dir) { q.position.x -= sp * dt; if (q.position.x < -8) q.position.x += 16; } else { q.position.x -= sp * dt * 0.0; q.rotation.y = Math.PI / 2; q.position.z += sp * dt; if (q.position.z > 6) q.position.z -= 12; } } t.cam.aspect = c.width / c.height; t.cam.updateProjectionMatrix(); ren.setViewport(c.left, H - c.bottom, c.width, c.height); ren.setScissor(c.left, H - c.bottom, c.width, c.height); ren.render(t.scene, t.cam); }
  requestAnimationFrame(frame);
}
frame();
