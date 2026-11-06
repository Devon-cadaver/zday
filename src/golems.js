// Rock giant options for Sean (golems.html, not part of the game): four looks (golemkit.js), three sizes beside the town's buildings, and
// the split, 1 to 2 to 4 to a crowd. One canvas, each card drawn in its own square (as creatures.js).
import * as THREE from 'three';
import { GOLEMS, golem } from './golemkit.js';

const canvas = document.getElementById('gl'), ren = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); ren.setPixelRatio(Math.min(devicePixelRatio, 1.75)); ren.setSize(innerWidth, innerHeight, false); ren.setClearColor(0, 0); ren.autoClear = false;
addEventListener('resize', () => ren.setSize(innerWidth, innerHeight, false));
const tiles = []; let pick = 'brute';
// the hero, 1.8 m: pink suit, red cape
function hero() { const g = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), box = (w, h, d, x, y, z, c) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); o.position.set(x, y, z); g.add(o); };
  box(0.16, 0.85, 0.18, -0.11, 0.43, 0, '#3a2a4a'); box(0.16, 0.85, 0.18, 0.11, 0.43, 0, '#3a2a4a'); box(0.46, 0.62, 0.26, 0, 1.18, 0, '#ff5ad5'); box(0.5, 0.95, 0.05, 0, 1.0, -0.17, '#d01d3a'); const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), m('#e0b48a')); h.position.y = 1.65; g.add(h); return g; }
// the hero marked: a pink ring at the feet and a tag over the head, so a person can be found beside a giant
function heroMark(T, x, z, k) { const h = hero(); h.position.set(x, 0, z); T.stuff.add(h); const r = new THREE.Mesh(new THREE.RingGeometry(1.2 * k, 1.7 * k, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5ad5' })); r.position.set(x, 0.05, z); T.stuff.add(r); const l = label('hero'); l.material.color.set('#ff9ae8'); l.position.set(x, 2 + 3 * k, z); l.scale.set(13 * k, 3.25 * k, 1); T.stuff.add(l); }
// a building of the town's kind: walls, rows of windows, a flat roof
const winTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#c9b48f'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#4a5260'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(4 + i * 15, 4 + j * 15, 9, 9); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
function building(w, h, d) { const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(w / 12, h / 12); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#8a7a64' }), new THREE.MeshStandardMaterial({ color: '#8a7a64' }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })]); m.position.y = h / 2; return m; }
const label = (txt) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = 'bold 34px system-ui,sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(txt, 128, 44); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.renderOrder = 9; return s; };
function tile(host, name, note, fill, o = {}) {
  const card = document.createElement('div'); card.className = 'card' + (o.wide ? ' wide' : '') + (o.key === pick ? ' on' : ''); card.innerHTML = '<div class="view"></div><div class="lbl"><b>' + name + '</b>' + note + '</div>'; document.getElementById(host).appendChild(card); const el = card.querySelector('.view');
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#ffe8d0', '#2a2030', 1.6)); const sun = new THREE.DirectionalLight('#fff0d8', 2.4); sun.position.set(40, 80, 60); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a4036', roughness: 1 })); ground.position.y = -0.02; scene.add(ground);
  const stuff = new THREE.Group(); scene.add(stuff); const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 2000); const T = { el, card, scene, stuff, cam, fill, o, gs: [] }; tiles.push(T); T.rebuild = () => { stuff.clear(); T.gs = []; fill(T); }; T.rebuild();
  if (o.key) card.onclick = () => { pick = o.key; for (const q of tiles) { q.card.classList.toggle('on', q.o.key === pick); if (q.o.follow) q.rebuild(); } };
}
const add = (T, g, x, z, s, ry = 0) => { g.root.scale.setScalar(s / 10); g.root.position.set(x, 0, z); g.root.rotation.y = ry; T.stuff.add(g.root); T.gs.push(g); return g; };
const frame = (T, x, y, z, d, ry = 0.5) => { T.cam.position.set(x + Math.sin(ry) * d, y + d * 0.22, z + Math.cos(ry) * d); T.cam.lookAt(x, y, z); };
// the looks: each turning, 40 m tall, the hero at its feet
for (const [key, D] of Object.entries(GOLEMS)) tile('looks', D.name, { brute: 'Hunched like a gorilla, plates of dark basalt, lava between them', magma: 'Boulders held round a glowing core, lava at every joint', obsidian: 'Tall and black, glassy shards, a fault line of lava, horns', mountain: 'A hill that stood up, with the town on its back' }[key], (T) => { const g = add(T, golem(key), 0, 0, 40); g.spin = true; heroMark(T, 11, 9, 1.2); frame(T, 0, 19, 0, 115, 0.55); }, { key });
// the sizes: beside a usual building (13 m) and the tallest in a small town (34 m)
for (const [S, note] of [[30, 'Over most towns, about as tall as a small town\'s tallest'], [50, 'Half again over the tallest in a small town'], [80, 'Twice the tallest in a small town; Metro City\'s towers are 148 m']]) tile('sizes', S + ' m', note, (T) => { const b1 = building(12, 13, 12); b1.position.x = -20; T.stuff.add(b1); const b2 = building(14, 34, 14); b2.position.set(-38, 0, -6); b2.position.y = 17; T.stuff.add(b2); const top = Math.max(S, 34), q = top / 30; add(T, golem(pick), 8 + S * 0.3, 0, S, -0.4); heroMark(T, -6, 10, q); const l1 = label('13 m'); l1.position.set(-20, 13 + 2.5 * q, 7); l1.scale.set(16 * q, 4 * q, 1); const l2 = label('34 m'); l2.position.set(-38, 34 + 2.5 * q, 2); l2.scale.set(16 * q, 4 * q, 1); const l3 = label(S + ' m'); l3.position.set(8 + S * 0.3, S + 3 * q, 6); l3.scale.set(16 * q, 4 * q, 1); T.stuff.add(l1, l2, l3); frame(T, -8 + S * 0.12, top * 0.5, 0, top * 2.9 + 40, 0.2); }, { follow: true, wide: S === 80 });
// the split: one 50 m, two 25 m, four 12.5 m, a crowd at 2 m, and the hero
tile('split', '1, then 2, then 4, then a crowd', 'The first one 50 m; throw its stones back and it falls, stone men come out of the ground, then it splits in two. The four smallest are fought hand to hand; each breaks into a crowd you dust in one hit', (T) => {
  add(T, golem(pick), -78, 0, 50, 0.2); add(T, golem(pick), -34, -4, 25, 0.3); add(T, golem(pick), -10, 4, 25, 0.1); for (let i = 0; i < 4; i++) add(T, golem(pick), 12 + i * 10, (i % 2) * 6 - 3, 12.5, 0.2 * i);
  for (let i = 0; i < 18; i++) add(T, golem(pick), 58 + (i % 6) * 2.8, Math.floor(i / 6) * 2.8 - 2, 2, Math.random() * 6); heroMark(T, 53, 7, 1.6);
  for (const [t, x, y] of [['50 m', -78, 56], ['25 m', -22, 30], ['12.5 m', 27, 17], ['2 m', 65, 7]]) { const l = label(t); l.position.set(x, y, 8); l.scale.set(30, 7.5, 1); T.stuff.add(l); } frame(T, -14, 22, 0, 218, 0.1);
}, { follow: true, wide: true });

let last = performance.now(), T0 = 0;
function draw() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; T0 += dt;
  ren.setScissorTest(false); ren.clear(); ren.setScissorTest(true); const H = innerHeight;
  for (const t of tiles) { const c = t.el.getBoundingClientRect(); if (c.bottom < 0 || c.top > H) continue; for (const g of t.gs) { g.tick(T0 + g.root.position.x * 0.1); if (g.spin) g.root.rotation.y += dt * 0.35; } t.cam.aspect = c.width / c.height; t.cam.updateProjectionMatrix(); ren.setViewport(c.left, H - c.bottom, c.width, c.height); ren.setScissor(c.left, H - c.bottom, c.width, c.height); ren.render(t.scene, t.cam); }
  requestAnimationFrame(draw);
}
draw();
