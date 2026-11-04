// The Pose Lab (Sean: see the moves frame by frame and put the limbs where they should be; all the moves felt stiff). Its own page, with no town to load.
// Two real fighters (fighttest.js Body, the same pose code as the game) on a bare stage. Scrub or step a move, drag a hand or a foot and the arm or leg
// follows, drag an elbow, a knee, the head or the body to turn it, fine tune on sliders, pin a hand to a place on the other fighter, move the keys in time.
// A change goes on the move at once, into a key of its own if the time has none, and is kept on this device (poses.js), so the game plays it too.
// Export gives the text that makes the changes permanent for everyone (posedata.js).
import * as THREE from 'three';
import { Body, MOVES, PINS, reachArm } from './fighttest.js';
import { rigFor, HS } from './herogame.js';
import { villainRig, relax } from './villains.js';
import { playClip, val, J, NAMES } from './clips.js';
import { loadLocal, saveLocal, warp } from './poses.js';

const $ = (id) => document.getElementById(id);
const FRAME = 1 / 60, MOVE_BY = {}; for (const m of MOVES) MOVE_BY[m.id] = m;
const clone = (x) => JSON.parse(JSON.stringify(x)), round3 = (v) => Math.round(v * 1000) / 1000;
const EASES = [['soft', 'Smooth'], ['out', 'Fast, then slow'], ['in', 'Slow, then fast'], ['snap', 'Snap'], ['linear', 'Even']];
const PIN_NAMES = [['', 'Free'], ['neck', 'Neck'], ['face', 'Face'], ['chest', 'Chest'], ['waist', 'Waist'], ['ankL', 'Left ankle'], ['ankR', 'Right ankle'], ['ownNeck', 'Own neck'], ['ownHead', 'Own head']];

// ---------- the stage
const view = $('view'), gl = $('gl'), dots = $('dots'), dx = dots.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#222a48');
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight('#dfe8ff', '#4a4336', 2.1)); const sun = new THREE.DirectionalLight('#fff2dd', 2.2); sun.position.set(3, 7, 4); scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#39405f', roughness: 1 })); floor.position.y = -0.01; scene.add(floor);
const grid = new THREE.GridHelper(12, 12, '#6f78a8', '#505880'); scene.add(grid);
const A = new Body(rigFor('Nova', HS.outfit('Nova')), 100), B = new Body(villainRig('Tyrant'), 100); A.foe = B; B.foe = A; scene.add(A.r.root, B.r.root); const FIGHTERS = [A, B];
const orbit = { yaw: 0.95, pitch: 0.2, dist: 6.2, x: 0, y: 1.05, z: 0.7 };
function placeCamera() { const c = Math.cos(orbit.pitch); camera.position.set(orbit.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.y + Math.sin(orbit.pitch) * orbit.dist, orbit.z + Math.cos(orbit.yaw) * c * orbit.dist); camera.lookAt(orbit.x, orbit.y, orbit.z); camera.updateMatrixWorld(true); }
let W = 1, H = 1;
function fit() { const w = view.clientWidth, h = view.clientHeight; if (w === W && h === H) return; W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); const d = Math.min(devicePixelRatio, 2); dots.width = w * d; dots.height = h * d; dx.setTransform(d, 0, 0, d, 0, 0); }

// ---------- what is open
const S = { move: MOVE_BY['C.drag'], who: 0, t: 0, playing: false, speed: 1, sel: 'handR', tab: 'pose', hide: false, partner: null, dist: 0, up: 0, undo: [], pose: null, allKeys: false };
const clipT = (w = S.who) => { if (w === 0) return S.t; const m = S.move, hit = blowAt(); return m.pair ? 0 : m.sync && hit != null ? Math.max(0, S.t - hit) : S.t; };
const clockOff = () => (S.who === 0 ? 0 : S.t - clipT(1)); // where on the timeline this fighter's time 0 is
const clipOf = (w = S.who) => (w === 0 ? S.move.clip : S.partner && S.partner.clip);
const moveOf = (w = S.who) => (w === 0 ? S.move : S.partner);
const SPEEDS = [1, 0.5, 0.25, 0.1];
for (const m of MOVES) { m.clip.keys = clone(m.clip.keys); if (!m.changed) m.clip.keys.forEach((k, i) => { k.src = i; }); m.atBase = m.at; } // copies: many moves share a pose as written (the guard), and a change here is to one move
const lastT = (c) => c.keys[c.keys.length - 1].t;
const duration = () => Math.max(lastT(S.move.clip), S.partner ? lastT(S.partner.clip) + (S.partner && S.move.sync ? blowAt() : 0) : 0, 0.5);
function blowAt() { const m = S.move, K = m.clip.keys, h = K.find((k) => k.hit); if (h) return h.t; if (m.atBase != null) return warp(m.atBase, m.base, K); return null; }
function open(m) {
  if (m.other) { S.who = 1; m = MOVE_BY[m.partner]; } else S.who = 0;
  S.move = m; S.partner = m.partner ? MOVE_BY[m.partner] : null; S.dist = m.dist ?? 1.6; S.up = m.up ?? 0; S.t = 0; S.playing = false; S.undo = [];
  orbit.z = m.pair ? 0 : S.dist / 2; orbit.y = m.pair ? 1.25 : 1.05; orbit.dist = m.pair ? 4.6 : 6.2; if (m.pair) { orbit.yaw = 1.45; orbit.pitch = 0.08; } else { orbit.yaw = 0.95; orbit.pitch = 0.2; } $('mv').textContent = m.name + ' ▾'; say(m.code ? 'The game also moves these arms by code, so not all of this shows in a fight' : ''); draw();
}

// ---------- a change: into a key at this moment, kept, undoable
function posedHere(c) { const r = FIGHTERS[S.who].r, T = clipT(); relax(r); playClip(r, c, T); const p = {}; for (const n of NAMES) { const j = J(r, n); if (j) p[n] = { x: round3(j.rotation.x), y: round3(j.rotation.y), z: round3(j.rotation.z) }; } p.bodyY = round3(r.hips.position.y - 0.94); return p; }
function keyHere(c, make = true) { const T = clipT(); let k = c.keys.find((q) => Math.abs(q.t - T) < FRAME / 2); if (k || !make) return k || null; const p = posedHere(c), prev = [...c.keys].reverse().find((q) => q.t < T), next = c.keys.find((q) => q.t > T); k = { t: Math.round(T * 1000) / 1000, p, ease: next ? next.ease : undefined }; if (prev && prev.pin && (!next || (next.pin && JSON.stringify(next.pin) === JSON.stringify(prev.pin)))) k.pin = clone(prev.pin); const i = c.keys.findIndex((q) => q.t > T); c.keys.splice(i < 0 ? c.keys.length : i, 0, k); return k; }
function snapshot() { const c = clipOf(); S.undo.push({ c, keys: clone(c.keys), pair: c.pair ? clone(c.pair) : null, t: S.t }); if (S.undo.length > 40) S.undo.shift(); $('undo').disabled = false; }
function persist(m = moveOf()) { const o = loadLocal(); o[m.id] = { keys: clone(m.clip.keys) }; if (m.clip.pair) o[m.id].pair = clone(m.clip.pair); m.changed = true; saveLocal(o); }
function setJoint(n, comp, v) { const c = clipOf(), k = keyHere(c); if (n === 'bodyY') { k.p.bodyY = v; return k; } k.p[n] = { x: val(k.p, n, 'x'), y: val(k.p, n, 'y'), z: val(k.p, n, 'z') }; k.p[n][comp] = v; return k; }
function setRot(n, e) { const c = clipOf(), k = keyHere(c); k.p[n] = { x: round3(e.x), y: round3(e.y), z: round3(e.z) }; }

// ---------- the dots you can drag
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0), _u = new THREE.Vector3();
const sidesOf = (i) => (i ? 'R' : 'L');
const HANDLES = [
  { id: 'head', label: 'Head', at: (r, o) => r.head.getWorldPosition(o), pivot: (r, o) => r.chest.getWorldPosition(o), joint: 'head', sl: [['head', 'x', 'Nod'], ['head', 'y', 'Turn'], ['head', 'z', 'Tilt']] },
  { id: 'chest', label: 'Chest', at: (r, o) => r.chest.localToWorld(o.set(0, 0.2, 0)), pivot: (r, o) => r.chest.getWorldPosition(o), joint: 'chest', sl: [['chest', 'x', 'Bend'], ['chest', 'y', 'Twist'], ['chest', 'z', 'Tilt']] },
  { id: 'torso', label: 'Waist', at: (r, o) => r.torso.localToWorld(o.set(0, 0.14, 0)), pivot: (r, o) => r.torso.getWorldPosition(o), joint: 'torso', sl: [['torso', 'x', 'Bend'], ['torso', 'y', 'Twist'], ['torso', 'z', 'Tilt']] },
  { id: 'body', label: 'Whole body', at: (r, o) => r.hips.getWorldPosition(o), pivot: (r, o) => r.body.getWorldPosition(o), joint: 'body', sl: [['body', 'x', 'Lean'], ['body', 'y', 'Turn'], ['body', 'z', 'Tip'], ['bodyY', 'x', 'Height', -0.8, 0.8]] },
];
[0, 1].forEach((i) => { const s = sidesOf(i), nm = i ? 'Right' : 'Left', arm = (r) => r.arms[i], leg = (r) => r.legs[i];
  HANDLES.push({ id: 'el' + s, side: i, label: nm + ' upper arm', at: (r, o) => arm(r).el.getWorldPosition(o), pivot: (r, o) => arm(r).sh.getWorldPosition(o), joint: 'sh' + s, sl: [['sh' + s, 'x', 'Swing'], ['sh' + s, 'z', 'Out'], ['sh' + s, 'y', 'Twist'], ['el' + s, 'x', 'Elbow', -3, 0]] });
  HANDLES.push({ id: 'hand' + s, side: i, big: true, hand: i, label: nm + ' hand', at: (r, o) => arm(r).wr.getWorldPosition(o), ik: 'arm', sl: [['wr' + s, 'x', 'Bend'], ['wr' + s, 'z', 'Side']] });
  HANDLES.push({ id: 'kn' + s, side: i, label: nm + ' thigh', at: (r, o) => leg(r).knee.getWorldPosition(o), pivot: (r, o) => leg(r).hip.getWorldPosition(o), joint: 'hip' + s, sl: [['hip' + s, 'x', 'Swing'], ['hip' + s, 'z', 'Out'], ['hip' + s, 'y', 'Twist'], ['knee' + s, 'x', 'Knee', 0, 2.9]] });
  HANDLES.push({ id: 'foot' + s, side: i, big: true, foot: i, label: nm + ' foot', at: (r, o) => leg(r).ank.getWorldPosition(o), ik: 'leg', sl: [['ank' + s, 'x', 'Point'], ['ank' + s, 'z', 'Roll']] });
});
const HAND_BY = {}; for (const h of HANDLES) HAND_BY[h.id] = h;
function toScreen(p, o) { o.copy(p).project(camera); return [(o.x * 0.5 + 0.5) * W, (-o.y * 0.5 + 0.5) * H]; }
function drawDots() {
  dx.clearRect(0, 0, W, H); if (S.hide) return; const r = FIGHTERS[S.who].r, P = {};
  for (const h of HANDLES) { h.at(r, _v); P[h.id] = toScreen(_v, _w); }
  const bone = (a, b) => { dx.beginPath(); dx.moveTo(P[a][0], P[a][1]); dx.lineTo(P[b][0], P[b][1]); dx.stroke(); }; dx.lineWidth = 2; dx.strokeStyle = 'rgba(255,255,255,.35)';
  bone('head', 'chest'); bone('chest', 'torso'); bone('torso', 'body'); for (const s of ['L', 'R']) { bone('chest', 'el' + s); bone('el' + s, 'hand' + s); bone('body', 'kn' + s); bone('kn' + s, 'foot' + s); }
  for (const h of HANDLES) { const [x, y] = P[h.id], on = S.sel === h.id, c = h.side === 0 ? '#5fd0ff' : h.side === 1 ? '#ff9a4a' : '#ffffff'; dx.beginPath(); dx.arc(x, y, on ? 11 : h.big ? 8 : 6, 0, 7); dx.fillStyle = on ? '#ffd36b' : c; dx.fill(); dx.lineWidth = 2; dx.strokeStyle = on ? '#fff' : 'rgba(0,0,0,.6)'; dx.stroke(); }
}
function nearestDot(x, y) { let best = null, bd = 30; const r = FIGHTERS[S.who].r; for (const h of HANDLES) { h.at(r, _v); const [sx, sy] = toScreen(_v, _w), d = Math.hypot(sx - x, sy - y) - (h.big ? 4 : 0); if (d < bd) { bd = d; best = h; } } return best; }
function pinnedHere(i) { const k = keyHere(clipOf(), false); return k && k.pin && k.pin[sidesOf(i)]; }
function reachLeg(L, T) { const a = L.knee.position.length(), b = L.ank.position.length(); L.hip.parent.worldToLocal(_u.copy(T)).sub(L.hip.position); const d = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.01, _u.length())), kx = Math.PI - Math.acos((a * a + b * b - d * d) / (2 * a * b)); L.knee.rotation.set(kx, 0, 0); _w.set(0, -b, 0).applyAxisAngle(_x, kx).add(L.knee.position); L.hip.quaternion.setFromUnitVectors(_w.normalize(), _u.normalize()); }

// a drag: on a hand or foot the world point under the finger, in the plane through it facing the camera; on anything else the joint turned round the line of sight
let drag = null, orb = null; const touches = new Map();
function pointInPlane(x, y, p, o) { const ndc = _w.set((x / W) * 2 - 1, -(y / H) * 2 + 1, 0.5).unproject(camera), dir = ndc.sub(camera.position).normalize(), n = camera.getWorldDirection(_u), t = p.clone().sub(camera.position).dot(n) / dir.dot(n); return o.copy(camera.position).addScaledVector(dir, t); }
const xy = (e) => { const b = view.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
view.addEventListener('pointerdown', (e) => {
  if (e.target !== view && e.target !== gl) return; const [x, y] = xy(e); touches.set(e.pointerId, [x, y]); try { view.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } if (touches.size === 2) { drag = null; orb = null; return; } if (touches.size > 2) return;
  const h = S.hide ? null : nearestDot(x, y); S.playing = false;
  if (h) { S.sel = h.id; if (S.tab === 'pose') draw(); else tab('pose'); if (h.hand != null && pinnedHere(h.hand)) { say('This hand is pinned here. Set it to Free to move it'); return; } snapshot(); const f = FIGHTERS[S.who]; h.at(f.r, _v); drag = { h, start: _v.clone(), last: Math.atan2(0, 0), rootY: f.r.root.position.y, off: [0, 0] }; const s = toScreen(_v, _w); drag.off = [s[0] - x, s[1] - y]; if (h.pivot) { h.pivot(f.r, _v); const q = toScreen(_v, _w); drag.pv = q; drag.last = Math.atan2(-(y - q[1]), x - q[0]); } }
  else orb = { x, y };
});
view.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return; const [x, y] = xy(e), old = touches.get(e.pointerId); touches.set(e.pointerId, [x, y]);
  if (touches.size === 2) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (S.pinch) { orbit.dist = Math.max(1.5, Math.min(16, orbit.dist * (S.pinch.d / Math.max(d, 1)))); const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, k = orbit.dist * 0.0012; orbit.y += (my - S.pinch.y) * k; orbit.x -= (mx - S.pinch.x) * k * Math.cos(orbit.yaw); orbit.z += (mx - S.pinch.x) * k * Math.sin(orbit.yaw); S.pinch = { d, x: mx, y: my }; } else S.pinch = { d, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }; return; }
  if (orb) { orbit.yaw -= (x - old[0]) * 0.008; orbit.pitch = Math.max(-0.5, Math.min(1.45, orbit.pitch + (y - old[1]) * 0.006)); return; }
  if (drag) moveDrag(x, y);
});
const up = (e) => { touches.delete(e.pointerId); if (touches.size < 2) S.pinch = null; if (drag) { FIGHTERS[S.who].y = 0; drag = null; persist(); draw(); } orb = null; };
view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
view.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(1.5, Math.min(16, orbit.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
function moveDrag(x, y) {
  const h = drag.h, f = FIGHTERS[S.who], r = f.r;
  if (h.ik) { const T = pointInPlane(x + drag.off[0], y + drag.off[1], drag.start, new THREE.Vector3()); r.root.updateMatrixWorld(true);
    if (h.ik === 'arm') { const arm = r.arms[h.hand]; reachArm(arm, T); const s = sidesOf(h.hand); setRot('sh' + s, arm.sh.rotation); const k = keyHere(clipOf()); k.p['el' + s] = round3(arm.el.rotation.x); }
    else { const L = r.legs[h.foot]; reachLeg(L, T); const s = sidesOf(h.foot); setRot('hip' + s, L.hip.rotation); const k = keyHere(clipOf()); k.p['knee' + s] = round3(L.knee.rotation.x); } return; }
  const a = Math.atan2(-(y - drag.pv[1]), x - drag.pv[0]); let da = a - drag.last; da = Math.atan2(Math.sin(da), Math.cos(da)); drag.last = a; if (Math.hypot(x - drag.pv[0], y - drag.pv[1]) < 14) return;
  const n = h.joint, j = J(r, n), parent = j.parent; camera.getWorldPosition(_u); h.pivot(r, _v); const toViewer = _u.sub(_v).normalize(); parent.getWorldQuaternion(_q2); _q.setFromAxisAngle(toViewer, da); const local = _q2.clone().invert().multiply(_q).multiply(_q2); j.quaternion.premultiply(local); setRot(n, j.rotation);
}

// ---------- the frame
function poseFighters(dt) {
  const m = S.move, pair = m.pair && m.clip.pair; A.clip = m.clip; A.blend = 1; A.ct = S.t - dt; A.fl = pair ? 0.35 : 0; A.bodyX = null; A.x = 0; A.z = 0; A.yaw = 0;
  if (drag && S.who === 0 && drag.h.foot != null) { A.y = drag.rootY; } else if (pair) A.y = 0.35 + pair.up; else A.y = 0;
  const gA = !m.air && !(drag && S.who === 0 && drag.h.foot != null); A.vx = 0; A.vz = pair ? 24 : 0; A.pose(dt, 0, gA);
  if (!S.partner) { B.r.root.visible = false; return; } B.r.root.visible = true; B.clip = S.partner.clip; B.blend = 1; B.yaw = Math.PI; B.x = 0; B.vx = 0; B.vz = pair ? 24 : 0;
  B.ct = clipT(1) - dt;
  if (pair) { B.z = -pair.off; B.y = 0.35; B.bodyX = pair.lean; B.fl = 1; B.pose(dt, 0, false); } else { B.z = S.dist; B.fl = 0; B.bodyX = null; const dragged = drag && S.who === 1 && drag.h.foot != null; B.y = dragged ? drag.rootY : S.up; B.pose(dt, 0, !dragged && !S.up && !m.air); }
  A.pose(1e-5, 0, gA); // the other is posed now, so a pinned hand is on this frame's neck
}
let prev = performance.now(), wasT = -1, redrawT = 0;
function frame(now) {
  requestAnimationFrame(frame); fit(); const real = Math.min(0.05, (now - prev) / 1000); prev = now; const D = duration();
  if (S.playing) { S.t += real * S.speed; if (S.t > D + 0.25) S.t = 0; }
  poseFighters(S.playing ? real * S.speed : 1e-4); placeCamera(); grid.visible = true; renderer.render(scene, camera); drawDots();
  if (S.t !== wasT || now > redrawT) { wasT = S.t; redrawT = now + 400; drawTime(); }
}

// ---------- the timeline
const track = $('track');
function drawTime() {
  const c = clipOf() || S.move.clip, D = duration(), span = D + 0.05, near = keyHere(c, false), hit = blowAt(), off = clockOff();
  let h = '<div class="ln"></div>'; for (const k of c.keys) h += '<div class="k' + (k === near ? ' at' : '') + (k.pin ? ' pin' : '') + '" style="left:' + (4 + (Math.min(k.t + off, span) / span) * 92) + '%"></div>'; if (hit != null) h += '<div class="hit" style="left:' + (4 + (hit / span) * 92) + '%"></div>'; h += '<div class="now" style="left:' + (4 + (Math.min(S.t, span) / span) * 92) + '%"></div>'; track.innerHTML = h;
  $('rt').textContent = 'Frame ' + Math.round(S.t * 60) + ' of ' + Math.round(D * 60) + ' · ' + S.t.toFixed(2) + ' s'; $('rk').textContent = near ? 'On key ' + (c.keys.indexOf(near) + 1) + ' of ' + c.keys.length : c.keys.length + ' keys';
  $('play').textContent = S.playing ? 'Pause' : 'Play'; $('spd').textContent = S.speed === 0.1 ? '0.1x' : S.speed + 'x';
}
function scrub(e) { const b = track.getBoundingClientRect(), u = (e.clientX - b.left) / b.width, D = duration(), span = D + 0.05, t = Math.max(0, Math.min(span, ((u * 100 - 4) / 92) * span)), c = clipOf() || S.move.clip, off = S.move.pair ? 0 : clockOff(); S.playing = false; let bestK = null, best = (10 / b.width) * span / 0.92; for (const k of c.keys) { const d = Math.abs(k.t + off - t); if (d < best) { best = d; bestK = k; } } S.t = bestK ? bestK.t + off : Math.round(t * 60) / 60; draw(); }
let scrubbing = false; track.addEventListener('pointerdown', (e) => { scrubbing = true; try { track.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } scrub(e); }); track.addEventListener('pointermove', (e) => { if (scrubbing) scrub(e); }); track.addEventListener('pointerup', () => { scrubbing = false; }); track.addEventListener('pointercancel', () => { scrubbing = false; });
const stepF = (n) => { S.playing = false; S.t = Math.max(0, Math.round((S.t + n * FRAME) * 60) / 60); draw(); };
const stepK = (n) => { S.playing = false; const c = clipOf() || S.move.clip, K = c.keys, E = 0.001, T = clipT(); const q = n > 0 ? K.find((k) => k.t > T + E) : [...K].reverse().find((k) => k.t < T - E); if (q) { S.t += q.t - T; draw(); } };
$('fp').onclick = () => stepF(-1); $('fn').onclick = () => stepF(1); $('kp').onclick = () => stepK(-1); $('kn').onclick = () => stepK(1);
$('play').onclick = () => { S.playing = !S.playing; if (S.playing && S.t >= duration()) S.t = 0; drawTime(); };
$('spd').onclick = () => { S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; drawTime(); };
$('undo').onclick = () => { const u = S.undo.pop(); if (!u) return; u.c.keys = u.keys; if (u.pair) Object.assign(u.c.pair, u.pair); S.t = u.t; persist(MOVES.find((m) => m.clip === u.c)); $('undo').disabled = !S.undo.length; draw(); };

// ---------- the panel
const panel = $('panel');
let sayT = 0; function say(s, ms = 3200) { const e = $('say'); e.textContent = s; e.style.opacity = s ? 1 : 0; clearTimeout(sayT); if (s) sayT = setTimeout(() => { e.style.opacity = 0; }, ms); }
const deg = (v) => Math.round((v * 180) / Math.PI) + '°';
function currentVal(n, comp) { const c = clipOf(), r = FIGHTERS[S.who].r; const k = keyHere(c, false); if (k) return val(k.p, n, comp); relax(r); playClip(r, c, clipT()); if (n === 'bodyY') return r.hips.position.y - 0.94; return J(r, n).rotation[comp]; }
function tab(t) { S.tab = t; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); draw(); }
function sliderRow(label, value, min, max, step, show, data) { return '<label class="sl"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" ' + data + '><output>' + show + '</output></label>'; }
function draw() {
  drawTime(); $('who').innerHTML = S.partner ? '<button type="button" data-w="0" class="' + (S.who === 0 ? 'on' : '') + '">Nova</button><button type="button" data-w="1" class="' + (S.who === 1 ? 'on' : '') + '">Tyrant</button>' : '';
  $('who').querySelectorAll('button').forEach((b) => { b.onclick = () => { S.who = +b.dataset.w; draw(); }; });
  $('undo').disabled = !S.undo.length;
  const c = clipOf(), k = keyHere(c, false); let h = '';
  if (S.tab === 'pose') {
    const H0 = HAND_BY[S.sel]; h += '<div class="t">' + H0.label + ' <small>' + (H0.ik ? 'drag the dot and the limb follows' : 'drag the dot to turn it') + '</small></div>';
    for (const [n, comp, label, min, max] of H0.sl) { const v = currentVal(n, comp), lo = min ?? -3.14, hi = max ?? 3.14; h += sliderRow(label, v, lo, hi, 0.01, n === 'bodyY' ? v.toFixed(2) + ' m' : deg(v), 'data-j="' + n + '" data-c="' + comp + '"'); }
    if (H0.hand != null) { const s = sidesOf(H0.hand), cur = k && k.pin && k.pin[s]; h += '<div class="t">Pin this hand <small>' + (k ? 'on this key' : 'makes a key here') + '</small></div><div class="row">' + PIN_NAMES.map(([id, nm]) => '<button type="button" class="chip' + ((cur || '') === id ? ' on' : '') + '" data-pin="' + id + '">' + nm + '</button>').join('') + '</div><div class="row"><button type="button" class="chip" data-pinall="1">Same pin on every key</button></div>'; }
  } else if (S.tab === 'keys') {
    h += '<div class="t">' + (k ? 'Key ' + (c.keys.indexOf(k) + 1) + ' of ' + c.keys.length + ' at ' + k.t.toFixed(2) + ' s' : 'No key on this frame') + '</div><div class="row"><button type="button" data-k="add">Add key</button><button type="button" data-k="del"' + (k && c.keys.length > 1 ? '' : ' disabled') + '>Delete key</button></div><div class="row"><button type="button" data-k="early"' + (k ? '' : ' disabled') + '>Move key earlier</button><button type="button" data-k="late"' + (k ? '' : ' disabled') + '>Move key later</button></div><div class="row"><button type="button" data-k="copy">Copy pose</button><button type="button" data-k="paste"' + (S.pose ? '' : ' disabled') + '>Paste pose</button><button type="button" data-k="flip">Mirror</button></div>';
    if (k) h += '<div class="t">How it gets to this key</div><div class="row">' + EASES.map(([id, nm]) => '<button type="button" class="chip' + ((k.ease || 'soft') === id ? ' on' : '') + '" data-e="' + id + '">' + nm + '</button>').join('') + '</div>';
    if (S.who === 0 && c.pair) h += '<div class="row"><button type="button" data-k="hit"' + (k ? '' : ' disabled') + '>The blow lands on this key</button></div>';
    h += '<div class="help">Blue marks are keys, a pink ring means a pinned hand, the red arrow is the moment the blow lands.</div>';
  } else if (S.tab === 'stage') {
    const p = S.move.pair && S.move.clip.pair;
    if (p) { h += '<div class="t">In the game too</div>' + sliderRow('Height', p.up, 0.3, 1.6, 0.01, p.up.toFixed(2) + ' m', 'data-p="up"') + sliderRow('Along', p.off, -1, 1, 0.01, p.off.toFixed(2) + ' m', 'data-p="off"') + sliderRow('Hang', p.lean, -1.6, 1.6, 0.01, deg(p.lean), 'data-p="lean"') + sliderRow('Punch every', p.beat, 0.1, 2, 0.05, p.beat.toFixed(2) + ' s', 'data-p="beat"'); }
    else { h += '<div class="t">Other fighter <small>only here, to see it against</small></div><div class="row"><select id="pick" style="flex:1"><option value="">Nobody</option>' + MOVES.filter((m) => !m.pair).map((m) => '<option value="' + m.id + '"' + (S.partner === m ? ' selected' : '') + '>' + m.name + '</option>').join('') + '</select></div>' + sliderRow('Distance', S.dist, 0, 5, 0.05, S.dist.toFixed(2) + ' m', 'data-s="dist"') + sliderRow('Height', S.up, -2, 3, 0.05, S.up.toFixed(2) + ' m', 'data-s="up"'); }
    h += '<div class="help">One finger on the stage turns the camera, two fingers zoom and slide it.</div>';
  } else {
    const local = loadLocal(), names = Object.keys(local).map((id) => (MOVE_BY[id] ? MOVE_BY[id].name : id));
    h += '<div class="help">Changes save by themselves on this device and the game plays them.</div><div class="t">' + (names.length ? names.length + ' changed: <small>' + names.join(', ') + '</small>' : 'Nothing changed yet') + '</div><div class="row"><a class="b" href="./index.html?mode=sandbox&amp;fight=1">Try it in a fight</a><button type="button" data-v="share"' + (names.length ? '' : ' disabled') + '>Export</button></div><div class="row"><button type="button" data-v="reset"' + (S.move.changed || (S.partner && S.partner.changed) ? '' : ' disabled') + '>Reset this move</button><button type="button" data-v="all"' + (names.length ? '' : ' disabled') + '>Reset all</button></div><div id="ex"></div>';
  }
  panel.innerHTML = h; bindPanel();
}
function bindPanel() {
  panel.querySelectorAll('input[data-j]').forEach((i) => { i.oninput = () => { if (!i.dataset.did) { i.dataset.did = '1'; snapshot(); } const n = i.dataset.j, v = +i.value; setJoint(n, i.dataset.c, v); i.parentNode.querySelector('output').textContent = n === 'bodyY' ? v.toFixed(2) + ' m' : deg(v); drawTime(); }; i.onchange = () => { delete i.dataset.did; persist(); }; });
  panel.querySelectorAll('[data-pin]').forEach((b) => { b.onclick = () => { snapshot(); const s = sidesOf(HAND_BY[S.sel].hand), k = keyHere(clipOf()); if (b.dataset.pin) { k.pin = { ...(k.pin || {}), [s]: b.dataset.pin }; } else if (k.pin) { delete k.pin[s]; if (!Object.keys(k.pin).length) delete k.pin; } if (b.dataset.pin && !PINS[b.dataset.pin][4] && !S.partner) say('Pinned, but this move has nobody on the stage to hold'); persist(); draw(); }; });
  panel.querySelectorAll('[data-pinall]').forEach((b) => { b.onclick = () => { snapshot(); const s = sidesOf(HAND_BY[S.sel].hand), k = keyHere(clipOf()), on = k.pin && k.pin[s]; for (const q of clipOf().keys) { if (on) q.pin = { ...(q.pin || {}), [s]: on }; else if (q.pin) { delete q.pin[s]; if (!Object.keys(q.pin).length) delete q.pin; } } persist(); draw(); say(on ? 'Pinned on every key' : 'Free on every key'); }; });
  panel.querySelectorAll('[data-e]').forEach((b) => { b.onclick = () => { snapshot(); keyHere(clipOf()).ease = b.dataset.e; persist(); draw(); }; });
  panel.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => keyAction(b.dataset.k); });
  panel.querySelectorAll('input[data-p]').forEach((i) => { i.oninput = () => { if (!i.dataset.did) { i.dataset.did = '1'; snapshot(); } const P = S.move.clip.pair, n = i.dataset.p, v = +i.value; P[n] = v; i.parentNode.querySelector('output').textContent = n === 'lean' ? deg(v) : n === 'beat' ? v.toFixed(2) + ' s' : v.toFixed(2) + ' m'; }; i.onchange = () => { delete i.dataset.did; persist(S.move); }; });
  panel.querySelectorAll('input[data-s]').forEach((i) => { i.oninput = () => { S[i.dataset.s] = +i.value; i.parentNode.querySelector('output').textContent = (+i.value).toFixed(2) + ' m'; }; });
  const pick = $('pick'); if (pick) pick.onchange = () => { S.partner = pick.value ? MOVE_BY[pick.value] : null; if (!S.partner) S.who = 0; draw(); };
  panel.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => saveAction(b.dataset.v); });
}
function keyAction(a) {
  const c = clipOf(); let k = keyHere(c, false);
  if (a === 'copy') { S.pose = posedHere(c); say('Pose copied'); draw(); return; }
  snapshot();
  if (a === 'add') { if (k) say('There is a key here already'); else keyHere(c); }
  if (a === 'del' && k && c.keys.length > 1) { c.keys.splice(c.keys.indexOf(k), 1); if (!c.keys.some((q) => q.t === 0)) c.keys[0].t = 0; }
  if (a === 'early' || a === 'late') { const d = a === 'late' ? FRAME : -FRAME, i = c.keys.indexOf(k), lo = i > 0 ? c.keys[i - 1].t + FRAME : 0, hi = i < c.keys.length - 1 ? c.keys[i + 1].t - FRAME : 9; if (i === 0) say('The first key stays at the start'); else { const off = clockOff(); k.t = Math.round(Math.max(lo, Math.min(hi, k.t + d)) * 1000) / 1000; S.t = k.t + off; } }
  if (a === 'paste' && S.pose) { k = keyHere(c); k.p = clone(S.pose); }
  if (a === 'flip') { k = keyHere(c); const p = {}; for (const n in k.p) { const m = /L$/.test(n) ? n.slice(0, -1) + 'R' : /R$/.test(n) ? n.slice(0, -1) + 'L' : n, v = k.p[n]; p[m] = typeof v === 'number' ? v : { x: v.x || 0, y: -(v.y || 0), z: -(v.z || 0) }; } k.p = p; }
  if (a === 'hit' && k) { for (const q of c.keys) delete q.hit; k.hit = true; }
  persist(); draw();
}
async function saveAction(a) {
  if (a === 'reset') { const o = loadLocal(); for (const m of [S.move, S.partner]) { if (!m || !m.changed) continue; delete o[m.id]; m.clip.keys = clone(m.base); m.clip.keys.forEach((k, i) => { k.src = i; }); if (m.basePair) Object.assign(m.clip.pair, m.basePair); m.changed = false; } saveLocal(o); S.undo = []; S.t = 0; draw(); say('Back as it was'); return; }
  if (a === 'all') { if (!confirm('Put every move back as it was?')) return; saveLocal({}); location.reload(); return; }
  const txt = 'POSES ' + JSON.stringify(loadLocal()), ex = $('ex'); ex.innerHTML = '<div class="help">Send me this text and I make it permanent for everyone.</div><textarea readonly></textarea><div class="row"><button type="button" id="copy">Copy</button>' + (navigator.share ? '<button type="button" id="shr">Share</button>' : '') + '</div>'; const ta = ex.querySelector('textarea'); ta.value = txt; ex.scrollIntoView();
  $('copy').onclick = async () => { let ok = false; try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } } say(ok ? 'Copied' : 'Press and hold the text to copy it'); };
  const sb = $('shr'); if (sb) sb.onclick = () => { navigator.share({ text: txt }).catch(() => {}); };
}
document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => tab(b.dataset.tab); });
const CAMS = { front: [0, 0.1], side: [Math.PI / 2, 0.1], top: [0.5, 1.3] }; document.querySelectorAll('[data-cam]').forEach((b) => { b.onclick = () => { [orbit.yaw, orbit.pitch] = CAMS[b.dataset.cam]; }; });
$('cape').onclick = () => { const on = !A.r.cape.mesh.visible; for (const f of FIGHTERS) f.r.cape.mesh.visible = on; $('cape').classList.toggle('on', !on); }; // out of the way of the arms
$('hide').onclick = () => { S.hide = !S.hide; $('hide').classList.toggle('on', S.hide); };

// ---------- the list of moves
function fillList() { const G = {}; for (const m of MOVES) (G[m.group] = G[m.group] || []).push(m); $('list').innerHTML = Object.keys(G).map((g) => '<h3>' + g + '</h3><div class="g">' + G[g].map((m) => '<button type="button" data-m="' + m.id + '">' + (m.changed ? '<i></i>' : '') + m.name + '</button>').join('') + '</div>').join(''); $('list').querySelectorAll('button').forEach((b) => { b.onclick = () => { $('sheet').classList.remove('show'); open(MOVE_BY[b.dataset.m]); }; }); }
$('mv').onclick = () => { fillList(); $('sheet').classList.add('show'); }; $('closeS').onclick = () => $('sheet').classList.remove('show');
window.addEventListener('error', (e) => { const l = $('load'); if (l) { l.textContent = 'Something went wrong: ' + e.message; l.style.display = 'block'; } });

window.__pl = { S, A, B, THREE, camera, orbit, HANDLES, MOVES, open, draw, moveDrag, keyAction, toScreen };
open(MOVE_BY[new URLSearchParams(location.search).get('move')] || MOVE_BY['C.drag']); tab('pose'); $('load').style.display = 'none';
requestAnimationFrame(frame);
