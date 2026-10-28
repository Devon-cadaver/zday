// The roster: every figure, vehicle and disaster on its own plinth, rendered
// into one fixed canvas with a scissor viewport per tile (so a phone needs one
// WebGL context, not a hundred), clipped to the panel's scrolling list. Opened
// from the menu (loaded only then), and on its own page (showcase.html).
import * as THREE from 'three';
import { figureGeometry, figureMaterial, figureAttributes, ARCHETYPES, OFFICER_LOOK, FIREFIGHTER_LOOK, SOLDIER_LOOK, CREW_LOOK, HAZMAT_LOOK, MEDIC_LOOK, ZTYPES, FLAG } from './figures.js';
import { heroModel } from './heroes.js';
import { villainModel } from './villains.js';
import { siteModel, tentModel } from './rebuild.js';
import { disasterExamples } from './examples.js';
import { VEHICLES, buildVehicle } from './vehicles.js';
import { rng } from './textures.js';

// canvas: where the tiles are drawn (fixed, over the panel); list: the scrolling list (tiles show only inside it);
// root: where the sections go. Returns stop(), which frees it all
export function startRoster({ canvas, list, root }) {
  const r = rng(2026);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  const fig = figureMaterial();
  const tiles = [];
  let live = true;

  function plinth(size) {
    const g = new THREE.CylinderGeometry(size, size * 1.08, size * 0.12, 6);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#4a3c2a', roughness: 0.8 }));
    m.position.y = -size * 0.06; m.receiveShadow = true; m.rotation.y = Math.PI / 6;
    return m;
  }

  function figure(look, anim) {
    const geo = figureGeometry();
    const fa = figureAttributes(geo, 1);
    fa.write(0, look); fa.arrays.anim[0] = anim; fa.dirty();
    const m = new THREE.InstancedMesh(geo, fig.mat, 1);
    m.setMatrixAt(0, new THREE.Matrix4()); m.castShadow = true;
    const g = new THREE.Group(); g.add(m);
    if (anim === 8) { m.rotation.z = -1.25; m.position.y = 0.05; }
    else if (anim === 3) m.rotation.z = -0.3;
    else if (anim === 9) m.rotation.z = -0.5;
    return g;
  }

  function add(section, name, obj, fit) {
    let grid = root.querySelector('[data-section="' + section + '"]');
    if (!grid) {
      const h = document.createElement('h2'); h.textContent = section;
      grid = document.createElement('div'); grid.className = 'grid'; grid.dataset.section = section;
      root.append(h, grid);
    }
    const el = document.createElement('div'); el.className = 'tile';
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = name;
    el.appendChild(lbl); grid.appendChild(el);
    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight('#dfe7f2', '#2a3340', 1.1);
    const sun = new THREE.DirectionalLight('#fff0d8', 2.6); sun.position.set(4, 8, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512); sun.shadow.camera.left = -fit * 1.5; sun.shadow.camera.right = fit * 1.5; sun.shadow.camera.top = fit * 1.5; sun.shadow.camera.bottom = -fit * 1.5;
    scene.add(hemi, sun, plinth(fit * 0.95));
    const pivot = new THREE.Group(); pivot.add(obj); scene.add(pivot);
    const cam = new THREE.PerspectiveCamera(28, 1, Math.max(0.1, fit * 0.4), Math.max(100, fit * 8)); // far enough for the big dioramas; the near plane well out, for depth precision (no flicker)
    const d = fit * 2.6;
    cam.position.set(d * 0.75, d * 0.62, d * 0.75); cam.lookAt(0, fit * 0.4, 0);
    tiles.push({ el, scene, cam, pivot, obj, rot: r() * 6.28 });
  }

  // ---------- figures
  for (const a of ARCHETYPES) add('Civilians', a.name, figure(a.roll(r), 1), 1.9);
  add('Civilians', 'Infected', figure({ ...ARCHETYPES[0].roll(r), skin: new THREE.Color('#8fae5a') }, 2), 1.9);
  add('Responders', 'Police officer', figure(OFFICER_LOOK(r), 6), 1.9);
  add('Responders', 'Firefighter', figure(FIREFIGHTER_LOOK(r), 1), 1.9);
  add('Responders', 'Soldier', figure(SOLDIER_LOOK(r), 7), 1.9);
  add('Responders', 'Construction crew', figure(CREW_LOOK(r), 1), 1.9);
  add('Responders', 'Hazmat crew', figure(HAZMAT_LOOK(r), 1), 1.9);
  add('Responders', 'Paramedic', figure(MEDIC_LOOK(r), 0), 1.9);
  // ---------- heroes, villains and the rebuilding
  for (const n of ['Dragonfly', 'Nova', 'Tempo']) add('Super heroes', n, heroModel(n), 4.8);
  for (const n of ['Blur', 'Tyrant', 'Weaver']) add('Super villains', n, villainModel(n), 4.8);
  add('Rebuilding', 'Construction site', siteModel(), 30);
  add('Rebuilding', 'Medical tent', tentModel(false), 3.4);
  add('Rebuilding', 'Hazmat decon tent', tentModel(true), 3.4);
  // ---------- the disasters themselves
  for (const [name, obj, fit] of disasterExamples()) add('Disasters', name, obj, fit);
  for (const [k, Z] of ZTYPES.entries()) {
    const base = ARCHETYPES[k % 3 === 0 ? 0 : k % 3 === 1 ? 4 : 2].roll(r);
    const L = Z.look(base); L.scale = Z.scale || 1; L.torso = Z.torso || 1;
    add('Zombies', Z.name, figure(L, Z.anim), 2.3 * (Z.scale || 1));
  }
  // ---------- vehicles
  const order = ['Police', 'Fire and rescue', 'Military', 'Aircraft', 'Civilian'];
  const tints = ['#f2efe8', '#b8b8b4', '#8c2a22', '#2f4566', '#e0b030', '#5b6b4a', '#d8c9a8'];
  for (const sec of order) {
    for (const [id, v] of Object.entries(VEHICLES)) {
      if (v.section !== sec) continue;
      const obj = buildVehicle(id, v.tint ? (id === 'car_taxi' ? '#f2c300' : tints[Math.floor(r() * tints.length)]) : null);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const fit = Math.max(size.x, size.z) * 0.62 + size.y * 0.3;
      if (obj.userData.rotor) obj.position.y = 0.4;
      add(sec, v.name, obj, fit);
    }
  }

  // ---------- render loop
  function resize() { renderer.setSize(innerWidth, innerHeight, false); }
  addEventListener('resize', resize); resize();
  const clock = new THREE.Clock();
  function frame() {
    if (!live) return;
    const dt = Math.min(0.05, clock.getDelta());
    fig.uTime.value += dt;
    renderer.setScissorTest(true);
    const H = innerHeight, L = list.getBoundingClientRect(); // only what shows in the scrolling list
    renderer.setScissor(0, 0, innerWidth, H); renderer.clear();
    for (const t of tiles) {
      const rc = t.el.getBoundingClientRect();
      if (rc.bottom < L.top || rc.top > L.bottom || rc.right < L.left || rc.left > L.right) continue;
      t.rot += dt * 0.5;
      t.pivot.rotation.y = t.rot;
      if (t.obj.userData.tick) t.obj.userData.tick(dt);
      if (t.obj.userData.rotor) { t.obj.userData.rotor.rotation.y += dt * 18; t.obj.position.y = 0.4 + Math.sin(t.rot * 2) * 0.08; }
      const w = rc.width, h = rc.height, left = rc.left, bottom = H - rc.bottom;
      t.cam.aspect = w / h; t.cam.updateProjectionMatrix();
      const sTop = Math.max(rc.top, L.top), sBot = Math.min(rc.bottom, L.bottom);
      renderer.setViewport(left, bottom, w, h); renderer.setScissor(left, H - sBot, w, sBot - sTop);
      renderer.render(t.scene, t.cam);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__sc = { tiles, renderer };
  return { stop() { live = false; removeEventListener('resize', resize); for (const t of tiles) t.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); } };
}
