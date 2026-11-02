// Options for Sean to choose from (creatures.html, not part of the game): the alien soldiers as they are now, three other
// ground units, and four four-legged alien dogs on the run. Made of plain shapes, so a chosen one still has to be built properly.
import * as THREE from 'three';
import { figureGeometry, figureMaterial, figureAttributes, ARCHETYPES, ZTYPES } from './figures.js';
import { rng } from './textures.js';
import { grey, mantis, squid, hound, maw, stalker, plated } from './creaturekit.js';

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
