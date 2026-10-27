// The kaiju: a hunched giant forty-odd metres tall with two heads on thick
// necks, ten tentacles writhing off its back, arms so long its knuckles touch
// the street and a long tail, in dark red flesh plated with green scale. Its
// body is swept as smooth tubes through its joints every frame (flesh.js), so
// it bends rather than hinging and every part grows out of the next; the joints
// ease from pose to pose. It breathes, its heads look about and snap on their
// own, and its tentacles carry their own weight, lagging and swinging.
// It walks in from the edge of the city: every footfall flattens what it lands
// on, it ploughs through the smaller buildings in its way, swipes the tops off
// others, picks up cars and hurls them, and its tentacles snatch people and cars
// off the street and fling them, or slam down on rooftops. Airstrikes hurt it;
// hurt enough (or after a few minutes) it walks back out of the city. In Be The
// Disaster you walk it and choose what it smashes and grabs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Body, hideMaterial, sstep } from './flesh.js';
import { ST } from './people.js';

const THIGH = 12, SHIN = 10, META = 7, UPPER = 18, FORE = 17, NECK = 4.4, LEAN = 0.95, SPEED = 5.5, STRIDE = 20, TP = 12, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (c) => Math.pow(Math.max(0, c), 1.6); // a fold that starts and stops gently
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const ell = (a, b) => (u, c, s) => 1 / Math.sqrt((c / a) ** 2 + (s / b) ** 2); // an oval cross-section, a high, b wide
const claw = (u0) => (u) => { const k = sstep(u0 - 0.05, u0 + 0.03, u); return [1 - 0.8 * k, 1 - 0.8 * k, 1 - 0.78 * k]; }; // the tip darkens to horn

let M = null;
// the eyes are wet and dark, with a dull amber shine from behind, like an animal's in torchlight
function mats() {
  if (M) return M;
  M = { hide: hideMaterial(), mouth: new THREE.MeshStandardMaterial({ color: '#4a0e10', roughness: 0.28 }), tooth: new THREE.MeshStandardMaterial({ color: '#d6cba8', roughness: 0.38 }),
    eye: new THREE.MeshStandardMaterial({ color: '#1c0906', roughness: 0.06, emissive: new THREE.Color(0.75, 0.42, 0.08), emissiveIntensity: 0.55 }), blind: new THREE.MeshStandardMaterial({ color: '#b8b39c', roughness: 0.12 }) };
  return M;
}
// a row of teeth, no two alike, some missing; upper ones hang from the skull (head space: -y forward, +x up), lower
// ones stand up from the jaw
function teethGeo(seed, lower) {
  const parts = [], rnd = (k) => { const x = Math.sin(seed * 91.7 + k * 12.9898 + (lower ? 7 : 0)) * 43758.5453; return x - Math.floor(x); };
  for (const sd of [-1, 1]) for (let i = 0; i < 10; i++) {
    const r = rnd(i * 2 + sd); if (r < 0.08) continue; // a gap
    const fang = lower ? i === 8 : i === 3 || i === 7, len = (fang ? 1.4 : 0.6 + 0.5 * rnd(i + 30)) * (r < 0.14 ? 0.45 : 1), rad = 0.13 + len * 0.1;
    const g = new THREE.ConeGeometry(rad, len, 5).translate(0, len / 2, 0);
    g.rotateZ(lower ? -Math.PI / 2 + 0.25 : Math.PI / 2 - 0.25); g.rotateY(sd * 0.15 * (lower ? -1 : 1));
    if (lower) g.translate(0.35, -0.9 - i * 0.68, sd * (1.15 - i * 0.065)); else g.translate(-0.35, -1.6 - i * 0.7, sd * (1.35 - i * 0.075));
    parts.push(g);
  }
  return mergeGeometries(parts);
}
// the creature, facing +x, feet at the origin: every joint a pivot; the body swept through them
export function kaijuRig() {
  const m = mats(), root = new THREE.Group(), body = new Body(m.hide), tubes = [];
  const piv = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const add = (mesh, parent) => { mesh.castShadow = true; parent.add(mesh); return mesh; };
  const tube = (o, pts, ref) => { const t = body.add(o); t.src = pts; t.refSrc = ref; tubes.push(t); return t; };
  const hips = piv(root, 0, 27, 0), torso = piv(hips, 0, 0, 0); torso.rotation.z = -LEAN;
  const rig = { root, hips, torso, body, tubes, inhale: 0 };
  // the body: hunched, a deep ribcage showing through the flanks, a ridge of spine, heavy shoulders, scaled on the back
  const TL = 36;
  tube({ rings: 60, cols: 28, len: TL, radii: [3.3, 4.7, 4.3, 5.9, 6.5, 5.7, 4.2], bulge: [0.5, 0, 0.5, 0.3, 0, 0], capStart: true, capEnd: true, seed: 1, lumps: 0.035,
    shape: (u, c, s) => {
      const ribs = 0.045 * s * s * sstep(0.36, 0.46, u) * (1 - sstep(0.7, 0.78, u)) * Math.pow(0.5 + 0.5 * Math.cos(u * TL / 2.1 * TAU), 4) * (c < 0.5 ? 1 : 0.3);
      const spine = 0.06 * Math.exp(-(1 - c) / 0.035) * (0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.cos(u * TL / 1.6 * TAU), 2));
      const hunch = 0.09 * Math.max(0, c) * bump(u, 0.72, 0.12), belly = 0.05 * Math.max(0, -c) * bump(u, 0.45, 0.14);
      const blades = 0.07 * Math.exp(-((c - 0.55) ** 2 + (Math.abs(s) - 0.82) ** 2) / 0.04) * bump(u, 0.73, 0.07);
      return (1 / Math.sqrt((c / 0.94) ** 2 + (s / 1.13) ** 2)) * (1 + ribs + spine + hunch + belly + blades);
    },
    mask: (u, c, s, nz) => sstep(0.05, 0.55, c + 0.7 * (nz - 0.5)), // scale plates down the back and over the shoulders, bare red flanks and belly
    mul: (jc, t) => 1 + (0.03 * Math.sin(t * 1.25) + 0.05 * rig.inhale) * bump(jc, 3.4, 1.3), // it breathes, and draws a breath to roar
  }, [[torso, -0.2, -9, 0], [torso, -1.0, -4, 0], [torso, 0.3, 3, 0], [torso, 0.1, 10, 0], [torso, -0.7, 16, 0], [torso, 0.1, 21.5, 0], [torso, 1.6, 25, 0]], [torso, -1, 0, 0]);
  // legs: thigh, shin and a long ankle bone, standing on its toes like a big cat; a padded foot, three clawed toes
  const legs = [-1, 1].map((s) => {
    const hip = piv(hips, 0, -0.5, s * 5.2), knee = piv(hip, 0, -THIGH, 0), ankle = piv(knee, 0, -SHIN, 0), foot = piv(ankle, 0, -META, 0);
    tube({ rings: 44, cols: 18, len: 33, radii: [2.6, 2.7, 1.75, 1.15, 0.95], bulge: [0.15, 0.45, 0.35, 0.1], capStart: true, capEnd: true, seed: 10 + s, ao: [0.05, 0.2], shape: ell(1, 0.92), mask: (u, c, s2, nz) => sstep(0.1, 0.6, c + 0.7 * (nz - 0.5)) },
      [[hips, 0.6, 2.5, s * 3.0], [hip, 0, 0, 0], [knee, 0, 0, 0], [ankle, 0, 0, 0], [foot, 0, 0, 0]], [null, 1, 0, 0]);
    tube({ rings: 12, cols: 14, len: 3.8, radii: [0.95, 1.1, 0.85], capStart: true, capEnd: true, seed: 20 + s, shape: ell(0.72, 1.2), mask: (u, c) => sstep(-0.2, 0.4, c) },
      [[foot, -1.3, 0.25, 0], [foot, 0.4, -0.35, 0], [foot, 1.9, -0.5, 0]], [foot, 0, 1, 0]);
    for (let k = -1; k <= 1; k++) {
      const z = k * 0.75, lx = k ? 1 : 1.12;
      tube({ rings: 12, cols: 8, len: 4.4, radii: [0.52, 0.46, 0.33, 0], capStart: true, capEnd: true, seed: 30 + k + s * 5, tint: claw(0.74), lumps: 0.03 },
        [[foot, 1.5, -0.6, z * 0.5], [foot, 2.9 * lx, -0.85, z * 0.95], [foot, 4.1 * lx, -0.95, z * 1.25], [foot, 5.1 * lx, -1.3, z * 1.4]], [foot, 0, 1, 0]);
    }
    return { hip, knee, ankle, foot, s };
  });
  // arms: long enough that the knuckles reach the street (the left shoulder rides a little lower), three long clawed fingers
  const arms = [-1, 1].map((s) => {
    const sh = piv(torso, 0.6, 19.5 - (s < 0 ? 0.8 : 0), s * 6.4), el = piv(sh, 0, -UPPER, 0), hand = piv(el, 0, -FORE, 0), fingers = [];
    tube({ rings: 46, cols: 18, len: 40, radii: [3.1, 2.75, 1.5, 1.0, 1.15], bulge: [0.3, 0.5, 0.4, 0.1], capStart: true, capEnd: true, seed: 40 + s, ao: [0.04, 0.12], shape: ell(1, 0.9), mask: (u, c, s2, nz) => sstep(0.1, 0.6, c + 0.7 * (nz - 0.5)) },
      [[torso, -0.8, 18.5, s * 3.4], [sh, 0, 0, 0], [el, 0, 0, 0], [hand, 0, 0, 0], [hand, 0.35, -1.4, 0]], [torso, 0, 0, s]);
    for (let c = 0; c < 3; c++) {
      const f1 = piv(hand, 0.9, -1.8, (c - 1) * 1.0), f2 = piv(f1, 0, -2.5, 0), tip = piv(f2, 0, -2.2, 0); fingers.push(f1, f2);
      tube({ rings: 14, cols: 8, len: 7.5, radii: [0.5, 0.46, 0.36, 0.25, 0], capStart: true, capEnd: true, pt: true, seed: 50 + c + s * 5, tint: claw(0.8), lumps: 0.03 },
        [[hand, 0.45, -1.2, (c - 1) * 0.55], [f1, 0, 0, 0], [f2, 0, 0, 0], [tip, 0, 0, 0], [tip, 0.3, -1.5, 0]], [hand, -1, 0, 0]);
    }
    return { sh, el, hand, fingers, s };
  });
  // two heads on thick necks, one a little bigger than the other: a long low skull with a heavy brow, deep-set eyes,
  // a hinged jaw, ragged teeth (head space: -y is the way it faces, +x is up)
  const heads = [-1, 1].map((s, hi) => {
    const hs = hi ? 1.0 : 1.15, base = piv(torso, 0.9, 22.2, s * 2.3), n1 = piv(base, 0, -NECK, 0), n2 = piv(n1, 0, -NECK, 0), head = piv(n2, 0, -NECK, 0);
    head.scale.setScalar(hs);
    tube({ rings: 34, cols: 18, len: 16, radii: [3.7, 3.3, 2.85, 2.5, 2.25 * hs, 2.0 * hs], bulge: [0.2, 0.2, 0.15, 0.1, 0], capStart: true, capEnd: true, seed: 55 + hi, mask: (u, c, s2, nz) => sstep(0.05, 0.55, c + 0.6 * (nz - 0.5)) },
      [[torso, -0.6, 19.5, s * 1.3], [base, 0, 0, 0], [n1, 0, 0, 0], [n2, 0, 0, 0], [head, 0, 0, 0], [head, 0.3, -1.6, 0]], [null, 0, 1, 0]);
    tube({ rings: 30, cols: 22, len: 11 * hs, radii: [1.5, 2.35, 2.05, 1.3, 0.72].map((r) => r * hs), capStart: true, capEnd: true, seed: 60 + hi, lumps: 0.04,
      shape: (u, c, s2) => {
        const as = Math.abs(s2);
        const brow = 0.13 * Math.exp(-((c - 0.6) ** 2 + (as - 0.72) ** 2) / 0.05) * bump(u, 0.55, 0.07);
        const cheek = 0.08 * Math.exp(-((c + 0.05) ** 2 + (as - 1) ** 2) / 0.06) * bump(u, 0.42, 0.09);
        const socket = -0.1 * Math.exp(-((c - 0.42) ** 2 + (as - 0.88) ** 2) / 0.012) * bump(u, 0.6, 0.035);
        const crest = 0.07 * Math.exp(-(1 - c) / 0.03) * bump(u, 0.3, 0.15);
        return (1 / Math.sqrt((c / 0.78) ** 2 + (s2 / 1.12) ** 2)) * (1 + brow + cheek + socket + crest) * (1 - 0.12 * sstep(-0.2, -0.6, c));
      },
      mask: (u, c, s2, nz) => sstep(-0.1, 0.4, c + 0.5 * (nz - 0.5)) },
      [[head, 0.35, 1.8, 0], [head, 0.95, -0.6, 0], [head, 0.85, -3.6, 0], [head, 0.3, -6.6, 0], [head, -0.1, -8.7, 0]], [head, 1, 0, 0]);
    const jaw = piv(head, -0.95, -0.7, 0);
    tube({ rings: 20, cols: 16, len: 9 * hs, radii: [1.15, 1.3, 1.0, 0.5].map((r) => r * hs), capStart: true, capEnd: true, seed: 70 + hi, shape: ell(0.62, 1.15), mask: (u, c, s2, nz) => sstep(0, 0.5, Math.abs(s2) * 0.8 + 0.4 * (nz - 0.5) - 0.2) },
      [[jaw, 0.25, 0.9, 0], [jaw, -0.25, -2.5, 0], [jaw, -0.3, -5.6, 0], [jaw, 0, -7.7, 0]], [jaw, 1, 0, 0]);
    const mouth = add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), m.mouth), head); mouth.position.set(-0.75, -4.3, 0); mouth.scale.set(0.7, 3.5, 1.15);
    add(new THREE.Mesh(teethGeo(hi + 1, false), m.tooth), head); add(new THREE.Mesh(teethGeo(hi + 1, true), m.tooth), jaw);
    for (const sd of [-1, 1]) [[1.6, -4.5, 1.67, 0.3], [1.95, -3.5, 1.45, 0.17], [2.15, -2.7, 1.25, 0.13]].forEach(([x, y, z, r], k) => {
      if (hi === 1 && sd > 0 && k === 2) return; // the smaller head has lost an eye, and one has gone milky
      const e = add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), hi === 1 && sd < 0 && k === 0 ? m.blind : m.eye), head); e.position.set(x, y, sd * z);
    });
    return { neck: [base, n1, n2], head, jaw, s, hs };
  });
  // the tail: eight joints, tapering to a point, a row of bony knobs down the top
  const tail = []; let tp = piv(hips, -5.8, 0.5, 0);
  for (let i = 0; i < 8; i++) { tail.push(tp); tp = piv(tp, 0, -3.8, 0); }
  tube({ rings: 48, cols: 16, len: 34, radii: [3.5, 3.3, 2.9, 2.5, 2.1, 1.7, 1.35, 1.0, 0.7, 0.42, 0.1], capStart: true, capEnd: true, seed: 80, lumps: 0.04,
    shape: (u, c) => 1 + 0.08 * Math.exp(-(1 - c) / 0.04) * (0.5 + 0.5 * Math.cos(u * 34 / 1.4 * TAU)), mask: (u, c, s2, nz) => sstep(0.0, 0.5, c + 0.6 * (nz - 0.5)) },
    [[hips, -2.5, 1.5, 0], ...tail.map((p) => [p, 0, 0, 0]), [tp, 0, 0, 0], [tp, 0, -2.5, 0]], [null, 0, 1, 0]);
  // ten tentacles out of the back, no two the same length; scaled on top, bare underneath, a horn hook at the tip
  const tents = [[7, -2.6], [9.5, 2.4], [12, -2.2], [13.5, 2.8], [15.5, -2.9], [17, 2.1], [18.5, -1.6], [20, 2.9], [21, -3.2], [22.5, 1.2]].map(([y, z], i) => {
    const len = 30 + ((i * 37) % 11) * 1.4, r0 = 1.45 + ((i * 53) % 7) * 0.08, radii = [];
    for (let k = 0; k < TP; k++) radii.push(k === TP - 1 ? 0 : r0 * Math.pow(1 - k / (TP - 1), 0.8) + 0.08);
    const T = tube({ rings: 34, cols: 9, len, radii, capStart: true, capEnd: true, pt: true, seed: 90 + i, lumps: 0.05, tint: claw(0.95), mask: (u, c, s2, nz) => sstep(0.15, 0.6, c + 0.5 * (nz - 0.5)) }, null, [torso, -1, 0, 0]);
    return { i, T, len, b: new THREE.Vector3(-5.3, y, z), dir: new THREE.Vector3(-1, 0.2, z * 0.18).normalize(), p: new Float32Array(TP * 3), o: new Float32Array(TP * 3), g: new Float32Array(TP * 3),
      ph: i * 2.39, w: 0.22 + ((i * 29) % 10) * 0.02, droop: i % 3 === 0, state: 'idle', t: 0, held: null, ready: false,
      tg: new THREE.Vector3(), bw: new THREE.Vector3(), dw: new THREE.Vector3(), tip: new THREE.Vector3(), aimDir: new THREE.Vector3(1, 0, 0) };
  });
  // every joint the pose sets, for easing from one pose to the next
  const joints = [];
  for (const L of legs) joints.push([L.hip, 'z'], [L.knee, 'z'], [L.ankle, 'z'], [L.foot, 'z']);
  for (const A of arms) { joints.push([A.sh, 'z'], [A.el, 'z'], [A.hand, 'z']); for (const fg of A.fingers) joints.push([fg, 'z']); }
  for (const H of heads) joints.push([H.neck[0], 'z'], [H.neck[0], 'x'], [H.neck[1], 'z'], [H.neck[1], 'x'], [H.neck[2], 'z'], [H.head, 'z'], [H.head, 'x'], [H.jaw, 'z']);
  joints.push([hips, 'x'], [torso, 'y']);
  for (const t of tail) joints.push([t, 'y'], [t, 'z']);
  root.add(body.build([0, 30, 0], 95));
  return Object.assign(rig, { legs, arms, heads, tail, tents, joints });
}

const _inv = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _lat = new THREE.Vector3(), _fw = new THREE.Vector3(), _c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
// sweep the body through the rig as it stands (world matrices up to date)
function sweep(r, time) {
  _inv.copy(r.root.matrixWorld).invert();
  for (const T of r.tubes) {
    if (T.src) T.src.forEach(([obj, x, y, z], i) => T.P[i].set(x, y, z).applyMatrix4(obj.matrixWorld).applyMatrix4(_inv));
    const [ro, rx, ry, rz] = T.refSrc; T.ref.set(rx, ry, rz);
    if (ro) T.ref.transformDirection(ro.matrixWorld).transformDirection(_inv);
    T.update(time);
  }
  r.body.commit();
}
// the tentacles, in world space: each a chain of points with weight, pulled towards a guide curve (out of the back,
// then on towards where it wants its tip, writhing along its length) and held to its length, so it lags behind
// the body, swings and overshoots. A tentacle reaching for something may stretch to half as long again.
function tentacles(r, dt, time) {
  const tm = r.torso.matrixWorld; _inv.copy(r.root.matrixWorld).invert(); _fw.set(1, 0, 0).transformDirection(r.root.matrixWorld);
  _c[0].set(0, 6, 0).applyMatrix4(tm); _c[1].set(0, 14, 0).applyMatrix4(tm); _c[2].set(0, 21, 0).applyMatrix4(tm);
  for (const q of r.tents) {
    const L = q.len, p = q.p, o = q.o, g = q.g;
    q.bw.copy(q.b).applyMatrix4(tm); q.dw.copy(q.dir).transformDirection(tm);
    _lat.crossVectors(q.dw, _up); if (_lat.lengthSq() < 1e-4) _lat.set(0, 0, 1); _lat.normalize();
    if (q.state === 'idle') { // its own slow wandering: most curl up and about over the back, some hang down the flanks
      const a = time * q.w + q.ph;
      q.tg.copy(q.bw).addScaledVector(q.dw, L * 0.4).addScaledVector(_up, q.droop ? -L * (0.45 + 0.1 * Math.sin(a * 0.8)) : L * (0.16 + 0.14 * Math.sin(a * 0.7)))
        .addScaledVector(_lat, L * 0.32 * Math.cos(a)).addScaledVector(_fw, L * 0.2 * Math.sin(a * 1.3 + q.i));
    }
    // the guide: a curve from the base, out along the back, arriving at the tip target from above
    const busy = q.state !== 'idle', lift = busy ? L * 0.25 : L * 0.12, wr = L * (busy ? 0.018 : 0.045);
    const ax = q.bw.x, ay = q.bw.y, az = q.bw.z, bx = ax + q.dw.x * L * 0.33, by = ay + q.dw.y * L * 0.33, bz = az + q.dw.z * L * 0.33, cx = q.tg.x, cy = q.tg.y + lift, cz = q.tg.z, dx = q.tg.x, dy = q.tg.y, dz = q.tg.z;
    for (let k = 0; k < TP; k++) {
      const u = k / (TP - 1), v = 1 - u, w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u, s = Math.sin(Math.PI * u);
      const e1 = Math.sin(time * 1.9 + k * 0.7 + q.ph) * wr * s, e2 = Math.cos(time * 1.5 + k * 0.6 + q.ph * 1.3) * wr * s;
      g[k * 3] = w0 * ax + w1 * bx + w2 * cx + w3 * dx + _lat.x * e1;
      g[k * 3 + 1] = w0 * ay + w1 * by + w2 * cy + w3 * dy + e2;
      g[k * 3 + 2] = w0 * az + w1 * bz + w2 * cz + w3 * dz + _lat.z * e1;
    }
    if (!q.ready) { p.set(g); o.set(g); q.ready = true; }
    const seg = (busy ? Math.min(L * 1.5, Math.max(L, q.bw.distanceTo(q.tg) * 1.12)) : L) / (TP - 1), kg = busy ? 9 : 3.2;
    const ns = Math.max(1, Math.min(5, Math.ceil(dt / 0.025))), h = dt / ns, pull = Math.min(1, kg * h);
    for (let n = 0; n < ns; n++) {
      for (let k = 2; k < TP; k++) for (let a = 0; a < 3; a++) {
        const i = k * 3 + a, vel = (p[i] - o[i]) * 0.9; o[i] = p[i]; p[i] += vel + (g[i] - p[i]) * pull - (a === 1 ? 4 * h * h : 0); // a little weight
      }
      p[0] = ax; p[1] = ay; p[2] = az; p[3] = ax + q.dw.x * seg; p[4] = ay + q.dw.y * seg; p[5] = az + q.dw.z * seg;
      for (let it = 0; it < 3; it++) for (let k = 1; k < TP - 1; k++) { // held to its length; the two points at the root are fixed
        const i = k * 3, j = i + 3, ex = p[j] - p[i], ey = p[j + 1] - p[i + 1], ez = p[j + 2] - p[i + 2], d = Math.hypot(ex, ey, ez) || 1e-6, f = (d - seg) / d, wa = k === 1 ? 0 : 0.5, wb = 1 - wa;
        p[i] += ex * f * wa; p[i + 1] += ey * f * wa; p[i + 2] += ez * f * wa; p[j] -= ex * f * wb; p[j + 1] -= ey * f * wb; p[j + 2] -= ez * f * wb;
      }
      for (let k = 2; k < TP; k++) { // kept out of the body and above the street
        const i = k * 3;
        for (const C of _c) { const ex = p[i] - C.x, ey = p[i + 1] - C.y, ez = p[i + 2] - C.z, d = Math.hypot(ex, ey, ez), R = 6.6; if (d < R && d > 1e-4) { p[i] = C.x + ex / d * R; p[i + 1] = C.y + ey / d * R; p[i + 2] = C.z + ez / d * R; } }
        if (p[i + 1] < 0.4) p[i + 1] = 0.4;
      }
    }
    q.tip.set(p[(TP - 1) * 3], p[(TP - 1) * 3 + 1], p[(TP - 1) * 3 + 2]);
    for (let k = 0; k < TP; k++) q.T.P[k].set(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]).applyMatrix4(_inv);
  }
}
// the pose for walk phase ph (ph = null: standing), at time t; returns the hip height that puts the standing foot on the ground
function pose(r, ph, o = {}, t = 0) {
  let low = 0;
  const sw = ph == null ? 0 : 1, P = ph ?? 0;
  r.legs.forEach((L, i) => {
    const p = P + i * Math.PI, c = Math.cos(p);
    const a1 = 0.3 + 0.42 * Math.sin(p) * sw, a2 = -0.95 - 0.45 * ease(c) * sw, a3 = 0.75 + 0.35 * ease(c) * sw; // thigh forward, shin back, ankle bone forward again
    L.hip.rotation.z = a1; L.knee.rotation.z = a2; L.ankle.rotation.z = a3; L.foot.rotation.z = -(a1 + a2 + a3) + 0.2 * ease(-c) * sw; // the foot flat, rolling off the toes
    low = Math.max(low, THIGH * Math.cos(a1) + SHIN * Math.cos(a1 + a2) + META * Math.cos(a1 + a2 + a3) + 1.3);
  });
  r.arms.forEach((A, i) => {
    const p = P + (1 - i) * Math.PI, sw2 = ph == null ? 0.2 : 1;
    let s = LEAN + 0.22 + (i ? 0 : 0.06) + 0.36 * Math.sin(p) * sw2, e = -0.3 - 0.3 * ease(-Math.cos(p)) * sw2, curl = 0.5 + 0.3 * ease(Math.cos(p)) * sw2 + 0.08 * Math.sin(t * 1.7 + i * 2); // the hand closes as it lifts off; the fingers never quite still
    if (o.reach && o.reach.arm === i) { s = LEAN + 1.1 * o.reach.k + 0.22 * (1 - o.reach.k); e = -0.2 - 0.3 * o.reach.k; curl = 0.2 + 0.9 * o.reach.k; }
    if (o.lift && o.lift.arm === i) { s = LEAN + 2.6 * o.lift.k; e = -0.6 * o.lift.k; curl = 1.1; }
    if (o.swipe && o.swipe.arm === i) { s = LEAN + 2.2 - 3.2 * o.swipe.k; e = -0.3; curl = 0.1; }
    A.sh.rotation.z = s; A.el.rotation.z = e; A.hand.rotation.z = -0.35 + 0.2 * Math.sin(p) * sw2;
    A.fingers.forEach((fg, k) => { fg.rotation.z = (k % 2 ? 0.8 : 0.5) * curl; });
  });
  r.inhale = o.inhale || 0;
  r.hips.rotation.x = 0.045 * Math.sin(P) * sw; r.torso.rotation.y = 0.07 * Math.sin(P + 0.6) * sw; // the body rolls and twists with the stride
  r.hips.position.z = 0.6 * Math.sin(P) * sw; // and its weight shifts over the standing leg
  // each neck curves up and forward, splayed apart; each head looks about on its own, snaps now and then, rears back to roar
  r.heads.forEach((H, hi) => {
    const rr = (hi ? o.roar2 : o.roar) || 0, f = ((t + hi * 3.7) / 8.3) % 1, sn = f < 0.085 ? Math.sin(Math.PI * f / 0.085) : 0;
    const ly = 0.28 * Math.sin(t * 0.33 + hi * 2.1) + 0.16 * Math.sin(t * 0.87 + hi * 4.3), lp = 0.12 * Math.sin(t * 0.41 + hi * 1.3) + 0.06 * Math.sin(t * 1.13 + hi);
    const n0 = 0.42 + rr * 0.35 + lp + sn * 0.3 + 0.05 * Math.sin(P * 2 + hi) * sw, n1 = -0.12 + rr * 0.15 - sn * 0.25, n2 = -0.18 - lp * 0.6 + 0.04 * Math.sin(P * 2 + 1 + hi) * sw;
    H.neck[0].rotation.z = Math.PI + n0; H.neck[0].rotation.x = H.s * 0.32 + ly * 0.5; H.neck[1].rotation.z = n1; H.neck[1].rotation.x = ly * 0.4; H.neck[2].rotation.z = n2;
    H.head.rotation.z = 1.42 + rr * 0.6 + sn * 0.2 - (-LEAN + Math.PI + n0 + n1 + n2); H.head.rotation.x = -(H.s * 0.32 + ly * 0.9) * 0.5;
    H.jaw.rotation.z = -(0.08 + rr * 0.85 + sn * 0.7 + 0.07 * Math.max(0, Math.sin(t * 0.7 + hi * 2.6))); // the jaw drops to roar or snap, and hangs a little open now and then
  });
  r.tail.forEach((tl, i) => { tl.rotation.y = Math.sin(t * 1.4 - i * 0.55 + P * 0.5) * (0.06 + i * 0.022) + 0.03; tl.rotation.z = i ? (i < 5 ? 0.07 : -0.11) + 0.04 * Math.sin(t * 0.9 - i * 0.5) : -1.5; }); // a wave running down the tail, which sags, lifts again at the tip and hangs a little to one side
  return low;
}
// standing, for the roster; it breathes, looks about and writhes there too
export function kaijuModel() {
  const r = kaijuRig(); let t = 0.5;
  const step = (dt) => { t += dt; r.hips.position.y = pose(r, 0.8, {}, t); r.root.updateMatrixWorld(true); tentacles(r, dt, t); };
  for (let i = 0; i < 60; i++) step(1 / 20);
  sweep(r, t);
  r.root.userData.tick = (dt) => { step(Math.min(dt, 0.1)); sweep(r, t); };
  return r.root;
}

const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
export class Kaiju {
  constructor(D, x, z, o = {}) {
    this.type = 'kaiju'; this.D = D; this.alive = true; this.t = 0; this.hp = o.hp ?? 400; this.life = o.life ?? 200; this.player = !!o.player;
    const B = D.ctx.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    // in from the edge of the city nearest where it was called
    const ex = x - cx, ez = z - cz, side = Math.abs(ex) > Math.abs(ez) ? [Math.sign(ex || 1), 0] : [0, Math.sign(ez || 1)];
    this.x = side[0] ? (side[0] > 0 ? B.x1 + 40 : B.x0 - 40) : clamp(x, B.x0 + 40, B.x1 - 40); this.z = side[1] ? (side[1] > 0 ? B.z1 + 40 : B.z0 - 40) : clamp(z, B.z0 + 40, B.z1 - 40);
    this.goal = [clamp(x, B.x0 + 40, B.x1 - 40), clamp(z, B.z0 + 40, B.z1 - 40)]; this.yaw = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x);
    this.ph = 0; this.state = 'walk'; this.act = null; this.actT = 6; this.roarT = 10; this.goT = 20; this.cars = 0; this.grabbed = 0; this.tentT = 3;
    this.rig = kaijuRig(); D.ctx.scene.add(this.rig.root); this.cur = []; this.hy = null; this.swept = false;
    this._v = new THREE.Vector3();
    if (!o.quiet) D.emit({ type: 'warn', hazard: 'kaiju', x: this.goal[0], z: this.goal[1], r: 60, exact: true, text: 'A giant monster is coming into the city from the ' + (side[0] ? (side[0] > 0 ? 'east' : 'west') : (side[1] > 0 ? 'south' : 'north')) + '!' });
  }
  steer(x, z) { const B = this.D.ctx.city.bounds; this.goal = [clamp(x, B.x0 + 30, B.x1 - 30), clamp(z, B.z0 + 30, B.z1 - 30)]; }
  damage(n) { if (this.state === 'leave') return; this.hp -= n; this.D.ctx.fire.burst(this.x, 30, this.z, 20, 4); if (this.hp <= 0) this.retreat('The monster is hurt and retreating out of the city!'); }
  retreat(text) { if (this.state === 'leave') return; this.state = 'leave'; this.dropCar(); this.act = null; for (const q of this.rig.tents) this.tentIdle(q); const B = this.D.ctx.city.bounds, d = [this.x - B.x0, B.x1 - this.x, this.z - B.z0, B.z1 - this.z], m = Math.min(...d); this.goal = m === d[0] ? [B.x0 - 120, this.z] : m === d[1] ? [B.x1 + 120, this.z] : m === d[2] ? [this.x, B.z0 - 120] : [this.x, B.z1 + 120]; this.D.emit({ type: 'kaijuleave', text }); }
  onEvent(e) { if ((e.type === 'blast' && Math.hypot(e.x - this.x, e.z - this.z) < 35) || ((e.type === 'nuked' || e.type === 'nukeflash') && Math.hypot(e.x - this.x, e.z - this.z) < 200)) this.damage(e.type === 'blast' ? 50 : 999); }
  // pick something to do next: grab a car, swipe a building, roar
  choose() {
    const { traffic, city } = this.D.ctx;
    if ((this.roarT -= 4) <= 0) { this.roarT = 14 + Math.random() * 8; this.act = { kind: 'roar', t: 0 }; return; } // about every third thing it does
    let car = null; traffic.near(this.x + Math.cos(this.yaw) * 14, this.z + Math.sin(this.yaw) * 14, 26, (c) => { if (!car && !c.gone && c.mode === 0 && !c.mission) car = c; });
    if (car && Math.random() < 0.6) { this.act = { kind: 'car', car, t: 0, arm: Math.random() < 0.5 ? 0 : 1 }; return; }
    let bk = -1; city.buildingsNear(this.x + Math.cos(this.yaw) * 16, this.z + Math.sin(this.yaw) * 16, 14, (k) => { if (bk < 0) bk = k; });
    if (bk >= 0) this.act = { kind: 'swipe', k: bk, t: 0, arm: Math.random() < 0.5 ? 0 : 1 };
  }
  dropCar() { const a = this.act; if (a && a.kind === 'car' && a.held && !a.car.gone) this.D.ctx.traffic.fling(a.car, 0, -2, 0); }
  update(h) {
    const D = this.D, B = D.ctx.city.bounds;
    this.t += h;
    if (this.state !== 'leave' && this.t > this.life) this.retreat('The monster is wandering back out of the city');
    if (this.state === 'leave' && (this.x < B.x0 - 100 || this.x > B.x1 + 100 || this.z < B.z0 - 100 || this.z > B.z1 + 100)) { this.alive = false; return; }
    this.tentAI(h);
    const A = this.act;
    if (A) { this.doAct(h, A); if (A.kind !== 'car' || !A.held) return; } // it stops to do it (carrying a car, it walks on)
    else if (!this.player && this.state !== 'leave' && (this.actT -= h) <= 0) { this.actT = 6 + Math.random() * 5; this.choose(); if (this.act) return; }
    if (!this.player && this.state !== 'leave' && ((this.goT -= h) <= 0 || Math.hypot(this.goal[0] - this.x, this.goal[1] - this.z) < 15)) { this.goT = 25; this.newGoal(); }
    // walk: turn towards the goal, turning away from towers too tall to wade through
    let want = Math.atan2(this.goal[1] - this.z, this.goal[0] - this.x);
    const fx = this.x + Math.cos(this.yaw) * 14, fz = this.z + Math.sin(this.yaw) * 14; let tall = null;
    D.ctx.city.buildingsNear(fx, fz, 8, (k, d, b) => { if (b.top - b.baseY > 70) tall = b; });
    if (tall && this.state !== 'leave') { const cx = (tall.x0 + tall.x1) / 2 - this.x, cz = (tall.z0 + tall.z1) / 2 - this.z; want = Math.atan2(cz, cx) + (Math.sin(this.yaw - Math.atan2(cz, cx)) > 0 ? 1.4 : -1.4); }
    if (this.player && Math.hypot(this.goal[0] - this.x, this.goal[1] - this.z) < 6) return; // waiting for your finger
    let da = want - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += clamp(da, -0.5 * h, 0.5 * h);
    const sp = SPEED * (Math.abs(da) > 1 ? 0.4 : 1);
    this.x += Math.cos(this.yaw) * sp * h; this.z += Math.sin(this.yaw) * sp * h;
    const before = this.ph; this.ph += h * sp / STRIDE * Math.PI * 2;
    for (let i = 0; i < 2; i++) { const a = before + i * Math.PI, b = this.ph + i * Math.PI; if (Math.cos(a) > 0 && Math.cos(b) <= 0) this.stomp(i); } // a foot comes down as the leg passes its furthest forward
    this.wade();
  }
  newGoal() {
    const { people, city } = this.D.ctx, B = city.bounds; let best = -1;
    for (let n = 0; n < 10; n++) { const i = Math.floor(Math.random() * people.active); if (!people.hittable(i)) continue; const d = Math.hypot(people.x[i] - this.x, people.z[i] - this.z); if (d < 80 || d > 300) continue; let c = 0; people.around(people.x[i], people.z[i], 12, () => { c++; }); if (c > best) { best = c; this.goal = [people.x[i], people.z[i]]; } }
    if (best < 0) this.goal = [clamp(this.x + (Math.random() - 0.5) * 300, B.x0 + 50, B.x1 - 50), clamp(this.z + (Math.random() - 0.5) * 300, B.z0 + 50, B.z1 - 50)];
  }
  // the tentacles: every couple of seconds a free one goes for someone or something within reach (at most three at once)
  tentAI(h) {
    const T = this.rig.tents;
    if (this.state !== 'leave' && (this.tentT -= h) <= 0) {
      this.tentT = this.player ? 2.5 : 1.2 + Math.random() * 1.3;
      const free = T.filter((q) => q.state === 'idle' && q.ready);
      if (free.length > 7) {
        const q = free[Math.floor(Math.random() * free.length)], roll = Math.random();
        if (roll < 0.55) { if (!this.reachPeople(q, this.x, this.z, 46)) this.reachCar(q, this.x, this.z, 44); }
        else if (roll < 0.88) { if (!this.reachCar(q, this.x, this.z, 44)) this.reachPeople(q, this.x, this.z, 46); }
        else this.reachRoof(q);
      }
    }
    for (const q of T) this.tentStep(q, h);
  }
  // in Be The Disaster: send a tentacle at whoever (or whatever car) is near where you tapped
  tentGrab(x, z) {
    if (Math.hypot(x - this.x, z - this.z) > 55) return false;
    const q = this.rig.tents.find((t) => t.state === 'idle' && t.ready);
    return !!q && (this.reachPeople(q, x, z, 8) || this.reachCar(q, x, z, 8));
  }
  reachPeople(q, x, z, R) {
    const { people } = this.D.ctx; let best = -1, bs = 1e9;
    people.around(x, z, R, (j) => {
      if (people.lvl[j] !== -1 || !people.hittable(j)) return;
      const d = Math.hypot(people.x[j] - this.x, people.z[j] - this.z); if (d < 8 || d > 52) return;
      const sc = Math.abs(d - 28) + Math.random() * 14; if (sc < bs) { bs = sc; best = j; }
    });
    if (best < 0) return false;
    q.state = 'reach'; q.kind = 'people'; q.j = best; q.t = 0; return true;
  }
  reachCar(q, x, z, R) {
    let car = null; this.D.ctx.traffic.near(x, z, R, (c) => { if (car || c.gone || c.mode !== 0 || c.mission) return; const d = Math.hypot(c.x - this.x, c.z - this.z); if (d > 10 && d < 50 && Math.random() < 0.5) car = c; });
    if (!car) return false;
    q.state = 'reach'; q.kind = 'car'; q.car = car; q.t = 0; return true;
  }
  reachRoof(q) {
    const city = this.D.ctx.city; let pick = -1;
    city.buildingsNear(this.x, this.z, 34, (k, d, b) => { if (pick < 0 && !city.dead[k] && b.top - b.baseY < 60 && d > 10 && Math.random() < 0.4) pick = k; });
    if (pick < 0) return false;
    const b = city.buildings[pick]; q.state = 'reach'; q.kind = 'roof'; q.k = pick; q.at = [(b.x0 + b.x1) / 2, b.top, (b.z0 + b.z1) / 2]; q.t = 0; return true;
  }
  tentStep(q, h) {
    const D = this.D, { people, traffic } = D.ctx; q.t += h;
    if (q.state === 'reach') {
      if (q.t > 4) return this.tentIdle(q);
      if (q.kind === 'people') { const j = q.j; if (!people.hittable(j)) return this.tentIdle(q); q.tg.set(people.x[j], people.y[j] + 0.9, people.z[j]); }
      else if (q.kind === 'car') { const c = q.car; if (c.gone || c.mode !== 0) return this.tentIdle(q); q.tg.set(c.x, (c.y || 0) + 1.2, c.z); }
      else q.tg.set(q.at[0], q.at[1], q.at[2]);
      if (q.tip.distanceTo(q.tg) > 3.2) return;
      if (q.kind === 'roof') { this.slam(q); return this.tentIdle(q); }
      if (q.kind === 'car') { if (!traffic.grab(q.car)) return this.tentIdle(q); q.held = { car: q.car }; }
      else {
        const got = []; people.around(q.tg.x, q.tg.z, 3.5, (j) => { if (got.length < 2 && people.lvl[j] === -1 && people.hittable(j) && people.grab(j)) got.push(j); });
        if (!got.length) return this.tentIdle(q);
        q.held = { ppl: got }; this.grabbed += got.length;
      }
      q.state = 'hold'; q.t = 0; q.hold = 1 + Math.random() * 1.6;
      if (!this.saidTent) { this.saidTent = true; D.emit({ type: 'kaijutent', text: 'The monster\'s tentacles are snatching people and cars off the street!' }); }
      return;
    }
    if (q.state === 'hold' || q.state === 'whip') {
      if (!this.carry(q)) return this.tentIdle(q);
      if (q.state === 'hold') { // lifted high over the back
        q.tg.copy(q.bw).addScaledVector(_up, q.len * 0.55).addScaledVector(q.dw, q.len * 0.2);
        if (q.t > q.hold) { q.state = 'whip'; q.t = 0; this.aim(q); }
        return;
      }
      q.tg.copy(q.bw).addScaledVector(_up, q.len * 0.15).addScaledVector(q.aimDir, q.len * 0.9); // whipped forward, and let go
      if (q.t > 0.5) { this.release(q, true); this.tentIdle(q); }
    }
  }
  // what a tentacle holds rides at its tip
  carry(q) {
    const { people } = this.D.ctx, H = q.held, tp = q.tip;
    if (!H) return false;
    if (H.car) { const c = H.car; if (c.gone) return false; c.x = tp.x; c.y = tp.y - 1.4; c.z = tp.z; c.yaw += 0.03; return true; }
    H.ppl = H.ppl.filter((j) => people.st[j] === ST.EXT);
    H.ppl.forEach((j, k) => { people.x[j] = tp.x + (k - 1) * 0.5; people.y[j] = tp.y - 1.2 - k * 0.3; people.z[j] = tp.z + ((k * 7) % 3 - 1) * 0.4; });
    return H.ppl.length > 0;
  }
  aim(q) {
    const { people } = this.D.ctx; let tx = this.x + (Math.random() - 0.5) * 220, tz = this.z + (Math.random() - 0.5) * 220, best = 0;
    people.around(this.x, this.z, 150, (j) => { if (Math.random() < 0.03 && people.hittable(j)) { const d = Math.hypot(people.x[j] - this.x, people.z[j] - this.z); if (d > 50 && d > best) { best = d; tx = people.x[j]; tz = people.z[j]; } } });
    q.at = [tx, tz]; q.aimDir.set(tx - q.bw.x, 0, tz - q.bw.z).normalize();
  }
  // let go: thrown (ballistic, landing at its aim) or just dropped
  release(q, thrown) {
    const H = q.held; if (!H) return; q.held = null;
    const { people, traffic } = this.D.ctx, T = 1.9;
    const vel = (x, y, z) => (thrown ? [(q.at[0] - x) / T, (0.5 * 9.8 * T * T - y) / T, (q.at[1] - z) / T] : [0, -1, 0]);
    if (H.car && !H.car.gone) { const c = H.car, [vx, vy, vz] = vel(c.x, c.y, c.z); traffic.fling(c, vx, vy, vz); if (thrown) { this.cars++; if (this.cars === 1) this.D.emit({ type: 'kaijucar', text: 'The monster is throwing cars!' }); } }
    if (H.ppl) for (const j of H.ppl) if (people.st[j] === ST.EXT) { const [vx, vy, vz] = vel(people.x[j], people.y[j], people.z[j]); people.fling(j, vx + (Math.random() - 0.5) * 3, vy, vz + (Math.random() - 0.5) * 3); }
  }
  tentIdle(q) { if (q.held) this.release(q, false); q.state = 'idle'; q.t = 0; }
  slam(q) {
    const D = this.D, { city, fire } = D.ctx, b = city.buildings[q.k];
    if (!b || city.dead[q.k]) return;
    if (b.top - b.baseY < 26 && Math.random() < 0.5) D.destroyBuilding(q.k, 'collapse', { dir: this.yaw }); else { D.blowWindows(q.k, Math.cos(this.yaw), Math.sin(this.yaw), 1); city.char(q.k, 0.4); }
    fire.dustCloud(q.at[0], q.at[2], 5, 3);
    if (this.near(q.at[0], q.at[2])) D.shake(0.3);
  }
  // the foot world position (the exact pose, not the eased one)
  footAt(i) { this.sync(0, 0); this.rig.root.updateMatrixWorld(true); return this.rig.legs[i].foot.getWorldPosition(this._v); }
  stomp(i) {
    const D = this.D, { city, people, traffic, fire } = D.ctx, p = this.footAt(i), x = p.x, z = p.z;
    people.crushNear(x, z, 4);
    traffic.near(x, z, 7, (c) => { if (c.gone || c.mode === 4 || c.mode === 5) return; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1; if (d < 7) traffic.fling(c, dx / d * 10, 6, dz / d * 10); });
    for (const pc of traffic.parkedNear(x, z, 4)) traffic.burnParked(pc);
    city.buildingsNear(x, z, 4, (k, d, b) => { if (b.top - b.baseY < 45) D.destroyBuilding(k, 'collapse', { dir: this.yaw }); else D.blowWindows(k, Math.cos(this.yaw), Math.sin(this.yaw), 1); });
    D.decals.add('crack', x, z, 9, 9); fire.dustCloud(x, z, 6, 4); people.scare(x, z, 50, 0.8);
    if (this.near(x, z)) D.shake(0.55);
  }
  // the body ploughs through anything smaller than it
  wade() {
    const D = this.D; D.ctx.city.buildingsNear(this.x + Math.cos(this.yaw) * 4, this.z + Math.sin(this.yaw) * 4, 6, (k, d, b) => { if (b.top - b.baseY <= 70) D.destroyBuilding(k, 'collapse', { dir: this.yaw }); });
  }
  doAct(h, A) {
    const D = this.D, { traffic, city, people } = D.ctx; A.t += h;
    if (A.kind === 'roar') {
      if (A.t > 0.5 && !A.done) { A.done = true; people.scare(this.x, this.z, 140, 0.95); if (this.near(this.x, this.z)) D.shake(0.9); if (!this.saidRoar) { this.saidRoar = true; D.emit({ type: 'roar', text: 'The monster roars!' }); } }
      if (A.t > 2.9) this.act = null;
      return;
    }
    if (A.kind === 'swipe') {
      if (A.t > 0.55 && !A.done) {
        A.done = true; const b = city.buildings[A.k];
        if (b && !city.dead[A.k]) { if (b.top - b.baseY < 55) D.destroyBuilding(A.k, 'collapse', { dir: this.yaw + (A.arm ? -1 : 1) * 0.8 }); else { D.blowWindows(A.k, Math.cos(this.yaw), Math.sin(this.yaw), 1.4); city.char(A.k, 0.8); } }
        if (this.near(this.x, this.z)) D.shake(0.5);
      }
      if (A.t > 1.2) this.act = null;
      return;
    }
    // a car: reach down, pick it up, lift it high and throw it
    const c = A.car;
    if (!A.held) {
      if (c.gone || c.mode === 5 || c.mode === 4) { this.act = null; return; }
      if (A.t > 0.9) { if (!traffic.grab(c)) { this.act = null; return; } A.held = true; A.t = 0; }
      return;
    }
    const hp = this.handAt(A.arm); c.x = hp.x; c.y = hp.y; c.z = hp.z; c.yaw += h * 2;
    if (A.t > 1.1) {
      let tx = this.x + Math.cos(this.yaw) * 120, tz = this.z + Math.sin(this.yaw) * 120; // at a crowd ahead, or just far
      let best = 0; people.around(this.x, this.z, 160, (j) => { if (Math.random() < 0.02 && people.hittable(j)) { const d = Math.hypot(people.x[j] - this.x, people.z[j] - this.z); if (d > 50 && d > best) { best = d; tx = people.x[j]; tz = people.z[j]; } } });
      const T = 2.2; traffic.fling(c, (tx - c.x) / T, (0 - c.y + 0.5 * 9.8 * T * T) / T, (tz - c.z) / T);
      this.act = null; this.cars++;
      if (this.cars === 1) D.emit({ type: 'kaijucar', text: 'The monster is throwing cars!' });
    }
  }
  handAt(i) { this.rig.root.updateMatrixWorld(true); return this.rig.arms[i].hand.getWorldPosition(this._v); }
  near(x, z) { const { camera, controls } = this.D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.3; }
  poi() { return { x: this.x, z: this.z, danger: 45, range: 400 }; }
  // on screen (or near enough that its shadow might be)
  seen() { const cam = this.D.ctx.camera; _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm); _sp.center.set(this.x, 30, this.z); _sp.radius = 110; return _fr.intersectsSphere(_sp); }
  // dt 0: exactly the pose (for working out where a foot lands); otherwise each joint eases towards it, the tentacles
  // move, and the body is swept through the rig
  sync(dt = 0) {
    const r = this.rig, A = this.act, o = {};
    if (dt > 0) this.st = (this.st || 0) + dt;
    if (A && A.kind === 'roar') { const k = (tt) => Math.max(0, Math.min(1, tt * 3) * Math.min(1, (2.6 - tt) * 2)); o.roar = k(A.t); o.roar2 = k(A.t - 0.3); o.inhale = A.t < 0.45 ? A.t / 0.45 : Math.max(0, 1 - (A.t - 0.45) * 1.2); }
    if (A && A.kind === 'swipe') o.swipe = { arm: A.arm, k: Math.min(1, A.t / 0.9) };
    if (A && A.kind === 'car') { if (!A.held) o.reach = { arm: A.arm, k: Math.min(1, A.t / 0.9) }; else o.lift = { arm: A.arm, k: Math.min(1, A.t / 0.8) }; }
    const walking = !A || (A.kind === 'car' && A.held);
    const hy = pose(r, walking ? this.ph : null, o, this.st || 0) + (walking ? 0 : 0.3), exact = !(dt > 0), k = 1 - Math.exp(-dt * 10);
    if (!exact) { // the eased pose is kept apart, so working out a footfall does not disturb it
      r.joints.forEach(([j, ax], i) => { const want = j.rotation[ax]; j.rotation[ax] = this.cur[i] = this.cur[i] == null ? want : this.cur[i] + (want - this.cur[i]) * k; });
      this.hy = this.hy == null ? hy : this.hy + (hy - this.hy) * k;
    }
    r.hips.position.y = exact || this.hy == null ? hy : this.hy;
    r.root.position.set(this.x, 0, this.z); r.root.rotation.y = -this.yaw;
    if (!exact) {
      r.root.updateMatrixWorld(true); tentacles(r, Math.min(dt, 0.25), this.st);
      if (!this.swept || this.seen()) { sweep(r, this.st); this.swept = true; }
    }
  }
  dispose() { this.dropCar(); for (const q of this.rig.tents) this.tentIdle(q); this.D.ctx.scene.remove(this.rig.root); this.rig.body.geo.dispose(); }
}
