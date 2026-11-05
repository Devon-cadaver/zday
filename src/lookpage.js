// The look test (fighter.html): the old Tyrant and the detailed one side by side, doing real moves, with the frame rate on show. Its own page, nothing else loaded.
import * as THREE from 'three';
import { MOVES } from './fighttest.js';
import { villainRig, relax, detail } from './villains.js';
import { heroRig } from './heroes.js';
import { playClip } from './clips.js';

const $ = (id) => document.getElementById(id), gl = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const hemi = new THREE.HemisphereLight('#ffffff', '#4a4336', 1), sun = new THREE.DirectionalLight('#ffffff', 1), rim = new THREE.DirectionalLight('#ffffff', 1); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); sun.position.set(2, 5, 4); rim.position.set(-3, 3, -4); scene.add(hemi, sun, rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3d46', roughness: 0.95 })); floor.receiveShadow = true; scene.add(floor);
let oldR = null, newR = null; const FIG = []; function cast(w, of) { for (const r of FIG) scene.remove(r.root); const Tv = w === 'Tyrant'; oldR = Tv ? villainRig('Tyrant', {}) : heroRig('Nova', {}); newR = Tv ? villainRig('Tyrant', of, true) : heroRig('Nova', of, true); scene.add(oldR.root, newR.root); FIG.length = 0; FIG.push(oldR, newR); } cast('Tyrant');
const LIGHT = { Night: { bg: '#141a33', hemi: ['#8ea2e0', '#191624', 1.15], sun: ['#ccd8ff', 2.0], rim: ['#b9c8ff', 3.2], floor: '#23263a' }, Day: { bg: '#b8c8d8', hemi: ['#ffffff', '#6a6250', 1.6], sun: ['#fff2dd', 2.4], rim: ['#ffffff', 0.8], floor: '#8a8678' } };
const S = { show: 'both', view: 'full', yaw: 0.25, pitch: 0.06, move: null, t: 0, light: 'Night' };
function setLight() { const L = LIGHT[S.light]; scene.background = new THREE.Color(L.bg); hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; rim.color.set(L.rim[0]); rim.intensity = L.rim[1]; floor.material.color.set(L.floor); }
const PICK = [['Stand', null], ['Punch', /uppercut/i], ['Kick', /kick/i], ['Hurt', /REACT|hit/]], LIST = PICK.map(([n, re]) => [n, re ? MOVES.find((m) => re.test((m.label || m.name || '') + ' ' + m.id)) : null]).filter((q) => q[0] === 'Stand' || q[1]); window.__lookMoves = MOVES.slice(0, 12).map((m) => m.id + ':' + (m.label || m.name)).join(', ');
function place() {
  const both = S.show === 'both'; oldR.root.visible = S.show !== 'new'; newR.root.visible = S.show !== 'old'; oldR.root.position.x = both ? -0.72 : 0; newR.root.position.x = both ? 0.72 : 0;
  const a = gl.clientWidth / Math.max(1, gl.clientHeight), close = S.view === 'close', top = S.view === 'face', fit = both ? 2.7 : 1.5, hh = top ? 0.34 : close ? 1.15 : 2.05, wd = top ? (both ? 2.2 : 0.5) : close ? (both ? 3 : 1.3) : fit, dist = Math.max(hh / (2 * Math.tan(15 * Math.PI / 180)), wd / (2 * Math.tan(15 * Math.PI / 180) * a)), cy = top ? 1.52 : close ? 0.98 : 0.62, c = Math.cos(S.pitch), rx = S.show === 'both' ? 0 : 0;
  camera.aspect = a; camera.updateProjectionMatrix(); camera.position.set(rx + Math.sin(S.yaw) * c * dist, cy + Math.sin(S.pitch) * dist, Math.cos(S.yaw) * c * dist); camera.lookAt(rx, cy, 0);
}
function fit() { const w = gl.clientWidth, h = gl.clientHeight; renderer.setSize(w, h, false); place(); } addEventListener('resize', fit);
const bar = (id, items, get, set) => { const el = $(id); el.innerHTML = items.map(([k, t]) => '<button type="button" data-k="' + k + '">' + t + '</button>').join(''); const mark = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === String(get()))); el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.k); mark(); place(); }; mark(); };
bar('bShow', [['both', 'Both'], ['old', 'Old'], ['new', 'New']], () => S.show, (k) => { S.show = k; });
bar('bView', [['full', 'Whole'], ['close', 'Close'], ['face', 'Face']], () => S.view, (k) => { S.view = k; });
bar('bMove', LIST.map((q) => [q[0], q[0]]), () => S.moveName || 'Stand', (k) => { S.moveName = k; const q = LIST.find((x) => x[0] === k); S.move = q && q[1]; S.t = 0; });
bar('bLight', [['Night', 'Night'], ['Day', 'Day'], ['Tyrant', 'Tyrant'], ['Nova', 'Nova']], () => null, (k) => { if (k === 'Tyrant' || k === 'Nova') cast(k); else { S.light = k; setLight(); } }); window.__lookDress = (n, of) => { cast(n, of); place(); };
{ let down = null; gl.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, S.yaw, S.pitch]; gl.setPointerCapture(e.pointerId); }); gl.addEventListener('pointermove', (e) => { if (!down) return; S.yaw = down[2] - (e.clientX - down[0]) * 0.012; S.pitch = Math.max(-0.2, Math.min(0.7, down[3] + (e.clientY - down[1]) * 0.006)); place(); }); for (const n of ['pointerup', 'pointercancel']) gl.addEventListener(n, () => { down = null; }); }
function pose(r, dt) {
  relax(r);
  if (S.move) { const c = S.move.clip, end = c.keys[c.keys.length - 1].t ?? c.dur ?? 1; playClip(r, c, (S.t * 0.45) % (end + 0.3)); } else { const b = Math.sin(performance.now() * 0.0016) * 0.008; r.hips.position.y = 0.94 + b; for (const a of r.arms) { a.sh.rotation.set(0.02, 0, a.sx * 0.2); a.el.rotation.set(-0.16, 0, 0); } r.legs[0].hip.rotation.set(0, 0, -0.1); r.legs[1].hip.rotation.set(0, 0, 0.1); }
  r.cape.update(dt, S.move ? 0.25 : 0.13, 0.3); detail(r, null, true);
}
let last = performance.now(), frames = 0, tf = last, worst = 0, cpu = 0; setLight(); fit();
function loop(now) {
  requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); worst = Math.max(worst, now - last); last = now; S.t += dt; const t0 = performance.now(); for (const r of FIG) if (r.root.visible) pose(r, dt); renderer.render(scene, camera); cpu += performance.now() - t0; frames++;
  if (now - tf > 1000) { const i = renderer.info.render; $('fps').textContent = Math.round(frames * 1000 / (now - tf)) + ' fps, ' + (cpu / frames).toFixed(1) + ' ms, ' + Math.round(i.triangles / 1000) + 'k triangles'; window.__look = { fps: frames * 1000 / (now - tf), ms: cpu / frames, tris: i.triangles, calls: i.calls }; frames = 0; tf = now; cpu = 0; worst = 0; }
}
requestAnimationFrame(loop);
window.__lookS = S; window.__lookPlace = place;
