// The punch hits page (hits.html, this file hitspage.js; Sean, 2026-11-05): punch sounds (hitsound.js) and what a blow looks like (hitfx.js), to pick from.
// Nova throws jab, jab, cross into Tyrant on a street at night, with the game's own post (post.js: HDR, the glow over white), so the
// sparks and the light look as they would in a fight. Not part of the game.
import * as THREE from 'three';
import { villainRig, relax, detail } from './villains.js';
import { heroRig } from './heroes.js';
import { CLIPS, playClip } from './clips.js';
import { Post } from './post.js';
import { HitFx, HIT_FX } from './hitfx.js';
import { HIT_SOUNDS, hitBuffers, SR } from './hitsound.js';

const $ = (id) => document.getElementById(id), gl = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 100);
const hemi = new THREE.HemisphereLight('#8ea2e0', '#191624', 1.1), sun = new THREE.DirectionalLight('#ccd8ff', 1.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); sun.position.set(3, 7, 4); scene.add(hemi, sun);
// a street: asphalt, a kerb and pavement, a wall with windows behind, a lamp post
const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#33363d', roughness: 0.9 })); asphalt.receiveShadow = true; scene.add(asphalt);
const pave = new THREE.Mesh(new THREE.BoxGeometry(30, 0.14, 2.4), new THREE.MeshStandardMaterial({ color: '#6c6862', roughness: 0.95 })); pave.position.set(0, 0.07, -3.2); pave.receiveShadow = true; scene.add(pave);
const winTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#7a6656'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2a3040'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.fillRect(8 + i * 32, 8 + j * 32, 18, 22); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 2); return t; })();
const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 1), new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.9 })); wall.position.set(0, 4, -4.9); wall.receiveShadow = true; scene.add(wall);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.2, 10), new THREE.MeshStandardMaterial({ color: '#3c4148', metalness: 0.6, roughness: 0.5 })); pole.position.set(-3.2, 2.1, -2.4); scene.add(pole);
const lamp = new THREE.PointLight('#ffcf8a', 6, 12, 2); lamp.position.set(-3.2, 4.1, -2.1); scene.add(lamp);
const nova = heroRig('Nova', null, true), tyr = villainRig('Tyrant', undefined, true); scene.add(nova.root, tyr.root);
for (const r of [nova, tyr]) r.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
const fx = new HitFx(scene, camera, { floor: 0.01, viewH: gl.clientHeight || 280 });
const post = new Post(renderer, { samples: 4 }); post.opts.dof = false;

const S = { fx: 'lit', snd: 'body', sound: false, slow: false, light: 'Night', t: 0, i: 0, stop: 0, react: null, rt: 0, shake: 0 };
const LIGHT = { Night: { bg: '#141a33', hemi: ['#8ea2e0', '#191624', 1.1], sun: ['#ccd8ff', 1.6], lamp: 6, glow: 0.35 }, Day: { bg: '#b8c8d8', hemi: ['#ffffff', '#6a6250', 1.6], sun: ['#fff2dd', 2.6], lamp: 0, glow: 0.35 } };
function setLight() { const L = LIGHT[S.light]; scene.background = new THREE.Color(L.bg); hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; lamp.intensity = L.lamp; }
// the blows in turn: the clip, when it lands, how hard, where on Tyrant, his flinch
const SEQ = [{ clip: CLIPS.jabL, at: 0.08, end: 0.36, k: 0.25, y: 1.5, react: CLIPS.hitHeadR }, { clip: CLIPS.jabR, at: 0.08, end: 0.36, k: 0.3, y: 1.48, react: CLIPS.hitHeadL }, { clip: CLIPS.cross, at: 0.1, end: 0.7, k: 1, y: 1.3, react: CLIPS.hitBody }];
const GAP = 0.18, NX = 0.62, TX = 0.62;
nova.root.position.set(-NX, 0, 0); nova.root.rotation.y = Math.PI / 2; tyr.root.position.set(TX, 0, 0); tyr.root.rotation.y = -Math.PI / 2;
function fit() { const w = gl.clientWidth, h = gl.clientHeight; fx.viewH = h || 280; renderer.setSize(w, h, false); post.setSize(); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
addEventListener('resize', fit);

// ---- sound
let AC = null; const BUF = {};
function ac() { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; AC = new C(); } if (AC.state !== 'running') AC.resume(); return AC; }
function play(id, heavy, when = 0) { const c = ac(), key = id + (heavy ? 'h' : 'l'); if (!BUF[key]) BUF[key] = hitBuffers(id)[heavy ? 'heavy' : 'light'].map((x) => { const b = c.createBuffer(1, x.length, SR); b.getChannelData(0).set(x); return b; }); const L = BUF[key], s = c.createBufferSource(), g = c.createGain(); s.buffer = L[Math.floor(Math.random() * L.length)]; s.playbackRate.value = 0.94 + Math.random() * 0.12; g.gain.value = 0.9; s.connect(g).connect(c.destination); s.start(c.currentTime + when); }
function combo(id) { play(id, false, 0); play(id, false, 0.2); play(id, true, 0.44); }

// ---- the controls
function tog() { const el = $('tog'); el.innerHTML = '<button type="button" data-k="light">' + S.light + '</button><button type="button" data-k="slow" class="' + (S.slow ? 'on' : '') + '">Slow motion</button><button type="button" data-k="sound" class="' + (S.sound ? 'on' : '') + '">Sound ' + (S.sound ? 'on' : 'off') + '</button>'; }
$('tog').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k; if (k === 'light') { S.light = S.light === 'Night' ? 'Day' : 'Night'; setLight(); } if (k === 'slow') S.slow = !S.slow; if (k === 'sound') { S.sound = !S.sound; if (S.sound) ac(); } tog(); };
$('fx').innerHTML = Object.entries(HIT_FX).map(([k, q]) => '<button type="button" class="opt" data-k="' + k + '"><b>' + q.name + '</b>' + q.note + '</button>').join('');
const markFx = () => $('fx').querySelectorAll('.opt').forEach((b) => b.classList.toggle('on', b.dataset.k === S.fx));
$('fx').onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; S.fx = b.dataset.k; markFx(); };
$('snd').innerHTML = Object.entries(HIT_SOUNDS).map(([k, q]) => '<div class="snd" data-k="' + k + '"><div class="t"><b>' + q.name + '</b>' + q.note + '</div><button type="button" data-p="one">▶ One</button><button type="button" data-p="combo">▶ Combo</button></div>').join('');
const markSnd = () => $('snd').querySelectorAll('.snd').forEach((b) => b.classList.toggle('on', b.dataset.k === S.snd));
$('snd').onclick = (e) => { const row = e.target.closest('.snd'); if (!row) return; S.snd = row.dataset.k; markSnd(); const b = e.target.closest('button'); if (b) { if (b.dataset.p === 'one') play(S.snd, true); else combo(S.snd); } };
markFx(); markSnd(); tog(); setLight(); fit();

// ---- the loop: her blows in turn, each landing with the chosen spark (and sound), his flinch, a beat of hit stop and a shake
function stand(r) { const b = Math.sin(performance.now() * 0.0016) * 0.008; r.hips.position.y = 0.94 + b; for (const a of r.arms) { a.sh.rotation.set(-0.5, 0, a.sx * 0.25); a.el.rotation.set(-1.6, 0, 0); } r.legs[0].hip.rotation.set(0, 0, -0.12); r.legs[1].hip.rotation.set(0, 0, 0.12); }
let last = performance.now(), T0 = 0;
function loop(now) {
  requestAnimationFrame(loop); let dt = Math.min(0.05, (now - last) / 1000); last = now; if (S.slow) dt *= 0.25; T0 += dt;
  const A = SEQ[S.i];
  if (S.stop > 0) S.stop -= dt; else {
    const was = S.t; S.t += dt;
    if (was < A.at && S.t >= A.at) { // it lands
      fx.hit(S.fx, TX - 0.22, A.y, 0, 1, 0, A.k, '#ff5ad5'); S.react = A.react; S.rt = 0; S.stop = 0.04 + 0.06 * A.k; S.shake = 0.03 + 0.06 * A.k;
      if (S.sound) play(S.snd, A.k > 0.6);
    }
    if (S.t > A.end + GAP + (A.k > 0.6 ? 0.5 : 0)) { S.t = 0; S.i = (S.i + 1) % SEQ.length; }
  }
  relax(nova); if (S.t <= A.end) playClip(nova, A.clip, Math.min(S.t, A.end)); else stand(nova);
  relax(tyr); if (S.react) { S.rt += S.stop > 0 ? 0 : dt; if (!playClip(tyr, S.react, S.rt) && S.rt > 0.6) S.react = null; } else stand(tyr);
  for (const r of [nova, tyr]) { if (r.cape) r.cape.update(dt, 0.15, 0.3); detail(r, null, true); }
  fx.step(S.stop > 0 ? dt * 0.15 : dt);
  // the camera a little in front and to the side, at chest height; the shake on a blow
  S.shake *= Math.exp(-dt * 14); const sh = S.shake;
  camera.position.set(0.9 + (Math.random() - 0.5) * sh, 1.55 + (Math.random() - 0.5) * sh, 4.6); camera.lookAt(0, 1.12, 0);
  post.render(scene, camera, 4.6, T0);
}
requestAnimationFrame(loop);
window.__hits = { S, fx, play };
